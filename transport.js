// transport.js
// Modul zobrazuje PRESUNY tímov (transfery) v rovnakom vizuálnom štýle.
//
// Dáta čerpá z Firestore kolekcií:
//   - settings/transportTravelTimes  (times, transfers)
//   - transport                      (bus, busRow, teamShortcut, walkingRule)
//   - places, users
//   - settings/categories, settings/registration,
//     settings/superstructureGroups
//
// Renderovanie je plne cez React.createElement (žiadne JSX).

import {
  doc, getDoc, getDocs, onSnapshot, collection, Timestamp,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const { useState, useEffect, useRef, useMemo } = React;

/* ------------------------------------------------------------------ */
/* Pomocné funkcie                                                     */
/* ------------------------------------------------------------------ */

window.showGlobalNotification = (message, type = 'success') => {
  let el = document.getElementById('global-notification');
  if (!el) {
    el = document.createElement('div');
    el.id = 'global-notification';
    el.className = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[99999] opacity-0 transition-opacity duration-300';
    document.body.appendChild(el);
  }
  const base = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[99999] transition-all duration-500 ease-in-out transform';
  const map = {
    success: 'bg-green-500 text-white',
    error: 'bg-red-500 text-white',
    info: 'bg-blue-500 text-white',
  };
  el.className = `${base} ${map[type] || 'bg-gray-700 text-white'} opacity-0 scale-95`;
  el.textContent = message;
  setTimeout(() => { el.className = `${base} ${map[type] || 'bg-gray-700 text-white'} opacity-100 scale-100`; }, 10);
  setTimeout(() => { el.className = `${base} ${map[type] || 'bg-gray-700 text-white'} opacity-0 scale-95`; }, 5000);
};

const formatDateDDMMYYYY = (ts) => {
  if (!ts) return null;
  let d;
  if (typeof ts.toDate === 'function') d = ts.toDate();
  else if (ts instanceof Date) d = ts;
  else d = new Date(ts);
  if (isNaN(d.getTime())) return null;
  return `${String(d.getDate()).padStart(2, '0')}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${d.getFullYear()}`;
};

const formatDateTime = (ts) => {
  if (!ts) return null;
  let d;
  if (typeof ts.toDate === 'function') d = ts.toDate();
  else if (ts instanceof Date) d = ts;
  else d = new Date(ts);
  if (isNaN(d.getTime())) return null;
  return `${String(d.getDate()).padStart(2, '0')}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const formatTsLocal = (ts) => {
  if (ts == null || !isFinite(ts)) return null;
  const d = new Date(ts);
  if (isNaN(d.getTime())) return null;
  return `${String(d.getDate()).padStart(2, '0')}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const formatTimeOnly = (ts) => {
  if (ts == null || !isFinite(ts)) return '';
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const cleanCategory = (cat) => String(cat || '')
  .replace(/\u00A0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const normalizePlaceName = (name) => {
  if (!name) return '';
  return String(name).trim()
    .replace(/^zastávka\s+/i, '')
    .replace(/^zastavka\s+/i, '')
    .replace(/^ubytovanie\s+/i, '')
    .replace(/^ubytovňa\s+/i, '')
    .replace(/^ubytovna\s+/i, '')
    .replace(/^miesto\s+zrazu\s+/i, '')
    .replace(/^miesta\s+zrazu\s+/i, '')
    .trim();
};

const parseWhenRangeToTs = (when) => {
  if (!when) return null;
  const s = String(when);
  const regex = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/g;
  const found = [];
  let m;
  while ((m = regex.exec(s)) !== null) {
    const ts = new Date(
      Number(m[3]),
      Number(m[2]) - 1,
      Number(m[1]),
      m[4] != null ? Number(m[4]) : 0,
      m[5] != null ? Number(m[5]) : 0,
      0, 0
    ).getTime();
    if (isFinite(ts)) found.push(ts);
  }
  if (!found.length) return null;
  return { startTs: found[0], endTs: found.length > 1 ? found[1] : found[0] };
};

const getGroupCharFromTeamName = (teamName) => {
  if (!teamName) return null;
  const m = /\d([A-ZÁ-Ž])\s*$/.exec(String(teamName).trim());
  return m ? m[1].toUpperCase() : null;
};

const buildRowId = (busId, dayKey, order) => `${busId}__${dayKey}__${order}`;

/* ------------------------------------------------------------------ */
/* Resolve názvu tímu cez teamManager + matchTracker                   */
/* ------------------------------------------------------------------ */

// "I1", "B4", "E5" – písmeno+číslo
const isLetterDigitCode = (s) => /^[A-ZÁ-Ž]\d+$/.test(String(s || '').trim());

// "1I", "4B" – číslo+písmeno
const isDigitLetterCode = (s) => /^\d+[A-ZÁ-Ž]$/.test(String(s || '').trim());

// Vráti true, ak názov tímu obsahuje kategóriu a po jej odfiltrovaní
// zostane tvar "písmeno+číslo" (typ = 'letter-digit') alebo
// "číslo+písmeno" (typ = 'digit-letter'). Inak vráti null.
const detectGroupCodeType = (teamName, categoryName) => {
  if (!teamName || !categoryName) return null;
  const tn = String(teamName).trim();
  const cat = String(categoryName).trim();
  if (!cat || !tn.includes(cat)) return null;

  const withoutCategory = tn.split(cat).join('').replace(/\s+/g, '').trim();
  if (!withoutCategory) return null;

  if (isLetterDigitCode(withoutCategory)) return 'letter-digit';
  if (isDigitLetterCode(withoutCategory)) return 'digit-letter';
  return null;
};

// Kompletná kaskáda:
//   1) teamManager.getTeamNameByDisplayIdSync(vstup)
//   2) ak výsledok obsahuje kategóriu ALEBO sa zmenil oproti vstupu ALEBO
//      stále vyzerá ako group kód → matchTracker.getTeamNameByDisplayId(výsledok)
//   3) ak matchTracker vráti niečo iné, vráť to
//   4) inak vráť výsledok z teamManager (alebo pôvodný vstup)
const resolveTeamNameForDisplay = async (identifier, categoryName) => {
  if (!identifier) return identifier;

  const original = String(identifier).trim();
  const cat = categoryName ? String(categoryName).trim() : '';

  // KROK 1 – teamManager sync (volaj vždy, ak existuje)
  let intermediate = original;
  try {
    if (window.teamManager && typeof window.teamManager.getTeamNameByDisplayIdSync === 'function') {
      const syncRes = window.teamManager.getTeamNameByDisplayIdSync(original);
      if (
        syncRes &&
        String(syncRes).trim() !== '' &&
        String(syncRes).trim() !== 'null'
      ) {
        intermediate = String(syncRes).trim();
      }
    }
  } catch (e) {}

  // KROK 2 – rozhodni, či volať matchTracker
  let shouldCallMatchTracker = false;

  // 2a) teamManager niečo zmenil → chceme finálny názov
  if (intermediate !== original) {
    shouldCallMatchTracker = true;
  }

  // 2b) intermediate stále obsahuje kategóriu → treba mapovať
  if (!shouldCallMatchTracker && cat && intermediate.includes(cat)) {
    shouldCallMatchTracker = true;
  }

  // 2c) intermediate (po odfiltrovaní kategórie) vyzerá ako group kód
  if (!shouldCallMatchTracker) {
    const withoutCat = cat
      ? intermediate.split(cat).join('').replace(/\s+/g, '').trim()
      : intermediate.replace(/\s+/g, '').trim();
    if (isLetterDigitCode(withoutCat) || isDigitLetterCode(withoutCat)) {
      shouldCallMatchTracker = true;
    }
  }

  // KROK 2 – matchTracker async
  if (shouldCallMatchTracker) {
    try {
      if (window.matchTracker && typeof window.matchTracker.getTeamNameByDisplayId === 'function') {
        const asyncRes = await window.matchTracker.getTeamNameByDisplayId(intermediate);
        if (
          asyncRes &&
          String(asyncRes).trim() !== '' &&
          String(asyncRes).trim() !== 'null' &&
          String(asyncRes).trim() !== intermediate
        ) {
          return String(asyncRes).trim();
        }
      }
    } catch (e) {}
  }

  // KROK 3 – vráť intermediate (teamManager výsledok alebo pôvodný)
  return intermediate;
};

/* ------------------------------------------------------------------ */
/* Čakanie na pripravenosť mapovania (teamManager + matchTracker)      */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Čakanie na pripravenosť mapovania – event-based (okamžitá reakcia)  */
/* ------------------------------------------------------------------ */

// Skontroluje, či mapovanie už je pripravené (viacero možných signálov)
const isMappingReady = () => {
  if (window.mappingReady === true) return true;
  if (window.isMappingReady === true) return true;
  if (window.teamNameMappingReady === true) return true;
  if (window.mappingCompleted === true) return true;
  if (window.teamManagerReady === true) return true;

  try {
    if (window.teamManager && typeof window.teamManager.isReady === 'function') {
      if (window.teamManager.isReady()) return true;
    }
  } catch (e) {}

  return false;
};

const waitForMappingReady = (eventTimeoutMs = 2000, pollMs = 50) => {
  return new Promise((resolve) => {
    if (isMappingReady()) { resolve(true); return; }

    let done = false;
    let pollTimer = null;

    const finish = (val) => {
      if (done) return;
      done = true;
      window.removeEventListener('mappingReady', onReady);
      if (pollTimer) clearInterval(pollTimer);
      resolve(val);
    };

    const onReady = () => finish(true);
    window.addEventListener('mappingReady', onReady);

    // Fallback polling po eventTimeoutMs, ak event neprišiel
    setTimeout(() => {
      if (done) return;
      pollTimer = setInterval(() => {
        if (isMappingReady()) finish(true);
      }, pollMs);
    }, eventTimeoutMs);

    // Žiadny celkový timeout – čaká, kým sa mapping naozaj nestane ready
  });
};

/* ------------------------------------------------------------------ */
/* Ikonky pre typy miest                                              */
/* ------------------------------------------------------------------ */

const placeTypeIcons = {
  sportova_hala: { icon: 'fa-futbol', color: '#dc2626', label: 'Športová hala' },
  stravovanie:   { icon: 'fa-utensils', color: '#16a34a', label: 'Stravovanie' },
  ubytovanie:    { icon: 'fa-bed', color: '#6b7280', label: 'Ubytovanie' },
  zastavka:      { icon: 'fa-bus', color: '#2563eb', label: 'Zastávka' },
};

/* ------------------------------------------------------------------ */
/* Farby pre typy udalostí (catering aj zápasy odstránené)            */
/* ------------------------------------------------------------------ */

const EVENT_COLORS = {
  transfer_bus:        { bg: 'bg-blue-50',   text: 'text-blue-800',   icon: 'fa-bus',             label: 'Presun busom' },
  transfer_walking:    { bg: 'bg-amber-50',  text: 'text-amber-800',  icon: 'fa-person-walking',  label: 'Peší presun' },
  transfer_unassigned: { bg: 'bg-gray-50',   text: 'text-gray-700',   icon: 'fa-question-circle', label: 'Nepriradený presun' },
  accommodation:       { bg: 'bg-purple-50', text: 'text-purple-800', icon: 'fa-bed',             label: 'Ubytovanie' },
};

/* ------------------------------------------------------------------ */
/* Hlavná komponenta                                                  */
/* ------------------------------------------------------------------ */

const TransportApp = ({ userProfileData }) => {
  /* -------------------- Refs -------------------- */
  const placesMapRef = useRef({});
  const allPlacesRef = useRef([]);
  const teamsLookupRef = useRef({});
  const teamsArrivalBufferRef = useRef([]);
  const savedTransfersRef = useRef([]);
  const superstructureGroupsRef = useRef({});
  const transportColorsRef = useRef({});
  const teamsLoadedRef = useRef(false);
  const travelTimesLoadedRef = useRef(false);
  const completedTeamsRef = useRef(new Set());
  const matchesLoadedRef = useRef(false);

  /* -------------------- State -------------------- */
  const [loading, setLoading] = useState(true);
  const [allPlaces, setAllPlaces] = useState([]);
  const [stopsList, setStopsList] = useState([]);
  const [buses, setBuses] = useState([]);
  const [busRows, setBusRows] = useState({});
  const [savedTransfers, setSavedTransfers] = useState([]);
  const [tournamentDays, setTournamentDays] = useState([]);
  const [selectedDayKey, setSelectedDayKey] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [availableTeams, setAvailableTeams] = useState([]);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [matchesVersion, setMatchesVersion] = useState(0);
  const matchStatusesRef = useRef({});
  const trackerResolvedNamesRef = useRef({});
  const [trackerResolvedNames, setTrackerResolvedNames] = useState({});

  /* -------------------- Pomocné resolve funkcie -------------------- */
  const resolvePlaceNameById = (placeId) => {
    if (!placeId) return '';
    const id = String(placeId);
    const fromMap = placesMapRef.current[id];
    if (fromMap) return fromMap;
    const fromAll = (allPlacesRef.current || []).find((p) => p.id === id);
    if (fromAll) return fromAll.name;
    const fromStops = (stopsList || []).find((s) => s.id === id);
    if (fromStops) return fromStops.name;
    return id;
  };

  const resolvePlaceIdByName = (placeName) => {
    if (!placeName) return null;
    const raw = String(placeName).trim();
    const direct = (allPlacesRef.current || []).find((p) => p.id === raw);
    if (direct) return direct.id;
    const norm = normalizePlaceName(raw);
    const found = (allPlacesRef.current || []).find((p) => normalizePlaceName(p.name) === norm);
    return found ? found.id : null;
  };

  const getPlaceIconForName = (placeName) => {
    if (!placeName) return null;
    const norm = normalizePlaceName(placeName);
    const found = (allPlacesRef.current || []).find((p) => normalizePlaceName(p.name) === norm)
      || (stopsList || []).find((s) => normalizePlaceName(s.name) === norm);
    if (!found) return null;
    const meta = placeTypeIcons[found.type] || { icon: 'fa-circle-dot', color: '#6b7280' };
    return React.createElement('i', {
      className: `fa-solid ${meta.icon}`,
      style: { color: meta.color, marginRight: '4px' },
      title: meta.label || found.type || '',
    });
  };

  /* -------------------- Výpočet zobrazenia pešieho segmentu (rovnako ako v logged-in-transport.js) -------------------- */
  const getWalkingSegmentDisplayRange = (parent, segmentIndex) => {
    if (!parent || !Array.isArray(parent.segments)) return null;

    const segments = parent.segments;
    const currentSegment = segments[segmentIndex];
    if (!currentSegment || currentSegment.isWalking !== true) return null;

    const parentRange = parseWhenRangeToTs(parent.when);

    let previousBusIndex = -1;
    let previousBusEndTs = null;
    for (let i = segmentIndex - 1; i >= 0; i--) {
      const segment = segments[i];
      if (!segment || segment.isWalking === true) continue;
      if (segment.endTs != null) {
        previousBusIndex = i;
        previousBusEndTs = segment.endTs;
        break;
      }
      if (segment.startTs != null) {
        previousBusIndex = i;
        previousBusEndTs = segment.startTs;
        break;
      }
    }

    let nextBusIndex = segments.length;
    let nextBusStartTs = null;
    for (let i = segmentIndex + 1; i < segments.length; i++) {
      const segment = segments[i];
      if (!segment || segment.isWalking === true) continue;
      if (segment.startTs != null) {
        nextBusIndex = i;
        nextBusStartTs = segment.startTs;
        break;
      }
      if (segment.endTs != null) {
        nextBusIndex = i;
        nextBusStartTs = segment.endTs;
        break;
      }
    }

    const intervalStartTs = previousBusEndTs != null
      ? previousBusEndTs
      : (parentRange?.startTs ?? null);

    const intervalEndTs = nextBusStartTs != null
      ? nextBusStartTs
      : (parentRange?.endTs ?? null);

    if (
      intervalStartTs == null ||
      intervalEndTs == null ||
      intervalEndTs <= intervalStartTs
    ) {
      return null;
    }

    const walkingIndexes = [];
    for (let i = previousBusIndex + 1; i < nextBusIndex; i++) {
      if (segments[i] && segments[i].isWalking === true) {
        walkingIndexes.push(i);
      }
    }

    const walkingCount = walkingIndexes.length || 1;
    const walkingPosition = Math.max(0, walkingIndexes.indexOf(segmentIndex));

    const intervalDuration = intervalEndTs - intervalStartTs;
    const walkingPartDuration = intervalDuration / walkingCount;

    const displayStartTs = intervalStartTs + walkingPosition * walkingPartDuration;
    const displayEndTs = walkingPosition === walkingCount - 1
      ? intervalEndTs
      : displayStartTs + walkingPartDuration;

    return { startTs: displayStartTs, endTs: displayEndTs };
  };

  /* -------------------- Rozdelenie celkového času medzi segmenty bez vlastných časov -------------------- */
  const getUnassignedSegmentDisplayRange = (parent, segmentIndex, routeIds, parentSegments) => {
    if (!parent) return null;
    const parentRange = parseWhenRangeToTs(parent.when);
    if (!parentRange || parentRange.startTs == null || parentRange.endTs == null) return null;
    if (parentRange.endTs <= parentRange.startTs) return null;

    // Zistíme, ktoré segmenty (indexy v routeIds) nemajú vlastné časy a nie sú pešie
    const unassignedIndexes = [];
    for (let i = 0; i < routeIds.length - 1; i++) {
      const fromId = routeIds[i];
      const toId = routeIds[i + 1];
      if (fromId === toId) continue;
      const seg = parentSegments.find((s) => s && s.fromId === fromId && s.toId === toId) || null;
      const isWalking = !!(seg && seg.isWalking === true);
      const hasTimes = !!(seg && seg.startTs != null && seg.endTs != null && seg.endTs > seg.startTs);
      if (!isWalking && !hasTimes) {
        unassignedIndexes.push(i);
      }
    }

    if (unassignedIndexes.length === 0) return null;
    const position = unassignedIndexes.indexOf(segmentIndex);
    if (position === -1) return null;

    const count = unassignedIndexes.length;

    // Ak je len JEDEN segment bez vlastných časov a je to zároveň celý presun
    // (t. j. žiadne medzizastávky), zobraz CELÝ parent interval.
    const isOnlySegment = (routeIds.length - 1) === 1;
    if (count === 1 && isOnlySegment) {
      return { startTs: parentRange.startTs, endTs: parentRange.endTs };
    }

    // Inak rozdeľ interval rovnomerne medzi segmenty bez vlastných časov
    const intervalDuration = parentRange.endTs - parentRange.startTs;
    const partDuration = intervalDuration / count;

    const displayStartTs = parentRange.startTs + position * partDuration;
    const displayEndTs = displayStartTs + partDuration;

    return { startTs: displayStartTs, endTs: displayEndTs };
  };

  /* -------------------- Firestore subscriptions -------------------- */
  useEffect(() => {
    if (!window.db) {
      console.error('transport.js: window.db nie je inicializované.');
      setLoading(false);
      return;
    }
    const unsubs = [];

    // places (map + list)
    try {
      const placesRef = collection(window.db, 'places');
      unsubs.push(onSnapshot(placesRef, (snap) => {
        const map = {};
        const list = [];
        snap.forEach((d) => {
          const data = d.data() || {};
          map[d.id] = data.name || '(bez názvu)';
          list.push({
            id: d.id,
            name: data.name || '(bez názvu)',
            type: data.type || '(neznámy typ)',
            capacity: data.capacity ?? null,
            accommodationType: data.accommodationType || null,
            lat: data.location?.latitude ?? data.lat ?? null,
            lng: data.location?.longitude ?? data.lng ?? null,
          });
        });
        list.sort((a, b) => a.name.localeCompare(b.name, 'sk', { sensitivity: 'base' }));
        placesMapRef.current = map;
        allPlacesRef.current = list;
        setAllPlaces(list);
        setStopsList(list.filter((p) => p.type === 'zastavka'));
      }, (e) => {}));
    } catch (e) {}

    // settings/transportTravelTimes → times + transfers
    try {
      const ttRef = doc(window.db, 'settings', 'transportTravelTimes');
      unsubs.push(onSnapshot(ttRef, (snap) => {
        const transfers = [];
        if (snap.exists()) {
          const data = snap.data() || {};
          const rawTransfers = data.transfers || {};
          Object.entries(rawTransfers).forEach(([key, v]) => {
            if (!v) return;
            transfers.push({
              key,
              category: v.category || '',
              categoryId: v.categoryId || null,
              teamUid: v.teamUid || null,
              teamIndex: v.teamIndex ?? null,
              teamName: v.teamName || null,
              when: v.when || '',
              fromId: v.fromId || resolvePlaceIdByName(v.fromLocation),
              toId: v.toId || resolvePlaceIdByName(v.toLocation),
              fromLocation: resolvePlaceNameById(v.fromId) || v.fromLocation || '',
              toLocation: resolvePlaceNameById(v.toId) || v.toLocation || '',
              text: v.text || '',
              dayKey: v.dayKey || null,
              isWalking: v.isWalking === true,
              intermediateStopIds: Array.isArray(v.intermediateStopIds)
                ? v.intermediateStopIds
                : (Array.isArray(v.intermediateStops)
                    ? v.intermediateStops.map(resolvePlaceIdByName).filter(Boolean)
                    : []),
              intermediateStops: Array.isArray(v.intermediateStopIds)
                ? v.intermediateStopIds.map(resolvePlaceNameById)
                : (Array.isArray(v.intermediateStops) ? v.intermediateStops : []),
              segments: (v.segments || []).map((s) => ({
                ...s,
                fromId: s.fromId || resolvePlaceIdByName(s.from),
                toId: s.toId || resolvePlaceIdByName(s.to),
              })),
            });
          });
          transfers.sort((a, b) => {
            const c = String(a.category || '').localeCompare(String(b.category || ''), 'sk');
            if (c !== 0) return c;
            const t = String(a.teamName || '').localeCompare(String(b.teamName || ''), 'sk');
            if (t !== 0) return t;
            return String(a.when || '').localeCompare(String(b.when || ''), 'sk');
          });
        }
        savedTransfersRef.current = transfers;
        setSavedTransfers(transfers);
        travelTimesLoadedRef.current = true;
        setLoading(false);
        resolveTransfersViaMatchTracker(transfers);
      }, (e) => {
        console.error('transportTravelTimes error', e);
        setLoading(false);
      }));
    } catch (e) {}

    // transport → bus + busRow
    try {
      const transportRef = collection(window.db, 'transport');
      unsubs.push(onSnapshot(transportRef, (snap) => {
        const busesList = [];
        const rowsGrouped = {};
        snap.forEach((d) => {
          const data = d.data() || {};
          if (data.type === 'bus') {
            const num = Number(data.number);
            busesList.push({
              id: d.id,
              name: data.name || (isFinite(num) ? `Bus ${num}` : 'Bus'),
              number: isFinite(num) ? num : 0,
            });
            return;
          }
          if (data.type === 'busRow') {
            if (!data.busId || !data.dayKey) return;
            const key = `${data.busId}|${data.dayKey}`;
            if (!rowsGrouped[key]) rowsGrouped[key] = [];
            const order = Number(data.order) || 0;
            rowsGrouped[key].push({
              id: d.id,
              order,
              rowId: data.rowId || buildRowId(data.busId, data.dayKey, order),
              timeFrom: data.timeFrom || '',
              timeTo: data.timeTo || '',
              placeFromId: data.placeFromId || null,
              placeToId: data.placeToId || null,
              placeFrom: data.placeFromId ? resolvePlaceNameById(data.placeFromId) : '',
              placeTo: data.placeToId ? resolvePlaceNameById(data.placeToId) : '',
            });
          }
        });
        busesList.sort((a, b) => a.number - b.number);
        Object.values(rowsGrouped).forEach((arr) => arr.sort((a, b) => a.order - b.order));
        setBuses(busesList);
        setBusRows(rowsGrouped);
      }, (e) => {}));
    } catch (e) {}

    // users → teams lookup + arrival buffer + kategórie
    const loadTeams = async () => {
      try {
        const usersSnap = await getDocs(collection(window.db, 'users'));
        const lookup = {};
        const buffer = [];
        const cats = new Set();
        const teamsSet = new Set();

        usersSnap.forEach((userDoc) => {
          const ud = userDoc.data() || {};
          const teams = ud.teams;
          if (!teams || typeof teams !== 'object') return;
          Object.entries(teams).forEach(([category, arr]) => {
            if (!Array.isArray(arr)) return;
            const cat = cleanCategory(category);
            cats.add(cat);
            arr.forEach((team, idx) => {
              if (!team || !team.teamName) return;
              const tn = String(team.teamName).trim();
              teamsSet.add(`${cat}|${tn}`);
              lookup[`${userDoc.id}|${cat}|${idx}`] = { teamName: tn, category: cat, teamIndex: idx, userId: userDoc.id };
              buffer.push({
                category: cat,
                teamName: tn,
                accommodationName: team.accommodation?.name || '',
                accommodationType: team.accommodation?.type || '(nešpecifikovaný)',
                isRegistered: true,
                isSuperstructure: false,
              });
            });
          });
        });

        teamsLookupRef.current = lookup;
        teamsArrivalBufferRef.current = buffer;
        teamsLoadedRef.current = true;
        setAvailableCategories([...cats].sort((a, b) => a.localeCompare(b, 'sk')));
        setAvailableTeams([...teamsSet].sort((a, b) => a.localeCompare(b, 'sk')));
      } catch (e) {}
    };
    loadTeams();

    // settings/registration → tournament days
    try {
      const regRef = doc(window.db, 'settings', 'registration');
      unsubs.push(onSnapshot(regRef, (snap) => {
        if (!snap.exists()) { setTournamentDays([]); return; }
        const data = snap.data() || {};
        const toDate = (ts) => {
          if (!ts) return null;
          if (typeof ts.toDate === 'function') return ts.toDate();
          if (ts instanceof Date) return ts;
          const d = new Date(ts);
          return isNaN(d.getTime()) ? null : d;
        };
        const start = toDate(data.tournamentStart);
        const end = toDate(data.tournamentEnd);
        if (!start || !end) { setTournamentDays([]); return; }
        const days = [];
        const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
        while (cursor <= endDay) {
          const d = new Date(cursor);
          const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          days.push({
            dayKey,
            dateLabel: formatDateDDMMYYYY(d),
            dayName: d.toLocaleDateString('sk-SK', { weekday: 'long' }),
          });
          cursor.setDate(cursor.getDate() + 1);
        }
        setTournamentDays(days);
      }, (e) => {}));
    } catch (e) {}

    // settings/categories → drawColors (farba pre rozlosovanie)
    try {
      const catRef = doc(window.db, 'settings', 'categories');
      unsubs.push(onSnapshot(catRef, (snap) => {
        const colorMap = {};
        if (snap.exists()) {
          const data = snap.data() || {};
          Object.entries(data).forEach(([catId, catData]) => {
            if (!catData) return;
            const dc = catData.drawColor || null;
            if (dc) {
              if (catData.name) colorMap[String(catData.name).trim()] = dc;
              colorMap[catId] = dc;
            }
          });
        }
        transportColorsRef.current = colorMap;
      }, (e) => {}));
    } catch (e) {}

    // settings/superstructureGroups
    try {
      const ssgRef = doc(window.db, 'settings', 'superstructureGroups');
      unsubs.push(onSnapshot(ssgRef, (snap) => {
        const map = {};
        if (snap.exists()) {
          const data = snap.data() || {};
          Object.entries(data).forEach(([catName, arr]) => {
            if (!Array.isArray(arr)) return;
            arr.forEach((team) => {
              if (!team?.teamName || !team?.groupName) return;
              const cat = cleanCategory(catName);
              const grp = String(team.groupName).trim();
              const key = `${cat}|${grp}`;
              if (!map[key]) map[key] = new Set();
              map[key].add(String(team.teamName).trim());
            });
          });
        }
        superstructureGroupsRef.current = Object.fromEntries(
          Object.entries(map).map(([k, v]) => [k, [...v]])
        );
      }, (e) => {}));
    } catch (e) {}

    // matches → sledovanie VŠETKÝCH zápasov + completed stavov + matchTracker mapovanie
    try {
      const matchesRef = collection(window.db, 'matches');
      unsubs.push(onSnapshot(matchesRef, (snap) => {
        const completedTeams = new Set();
        let anyMatchCompletedNow = false;
        let anyChangeDetected = false;
    
        // 1) Detekcia zmien v statusoch (completed)
        snap.docChanges().forEach((change) => {
          const data = change.doc.data() || {};
          const prevStatus = matchStatusesRef.current[change.doc.id];
          const currStatus = data.status || 'scheduled';
          matchStatusesRef.current[change.doc.id] = currStatus;
    
          if (change.type !== 'removed') {
            anyChangeDetected = true;
          }
    
          if (currStatus === 'completed' && prevStatus !== 'completed') {
            anyMatchCompletedNow = true;
            console.log(`✅ Zápas UKONČENÝ: ${change.doc.id}`, {
              homeTeam: data.homeTeamName || data.homeTeamIdentifier || data.homeTeam || '?',
              awayTeam: data.awayTeamName || data.awayTeamIdentifier || data.awayTeam || '?',
              homeScore: data.homeScore,
              awayScore: data.awayScore,
              categoryId: data.categoryId,
              categoryName: data.categoryName,
              status: currStatus,
            });
          }
        });
    
        // 2) Zozbieranie VŠETKÝCH zápasov (nielen completed)
        const allMatches = [];
        snap.forEach((d) => {
          const data = d.data() || {};
          allMatches.push({
            id: d.id,
            status: data.status || 'scheduled',
            categoryId: data.categoryId || null,
            categoryName: data.categoryName || null,
            groupName: data.groupName || null,
            matchType: data.matchType || null,
            isPlacementMatch: data.isPlacementMatch === true,
            homeTeamIdentifier: data.homeTeamIdentifier || null,
            awayTeamIdentifier: data.awayTeamIdentifier || null,
            homeTeamName: data.homeTeamName || null,
            awayTeamName: data.awayTeamName || null,
            homeTeam: data.homeTeam || null,
            awayTeam: data.awayTeam || null,
            homeScore: data.homeScore ?? null,
            awayScore: data.awayScore ?? null,
            scheduledTime: data.scheduledTime || data.matchDate || null,
          });
    
          // Zber completed tímov (pre existujúcu logiku skrývania nerozriešených presunov)
          if (data.status === 'completed') {
            const candidates = [
              data.homeTeamIdentifier,
              data.awayTeamIdentifier,
              data.homeTeamName,
              data.awayTeamName,
              data.homeTeam,
              data.awayTeam,
            ].filter(Boolean).map((v) => String(v).trim());
    
            candidates.forEach((name) => {
              completedTeams.add(name);
              completedTeams.add(name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
            });
          }
        });
    
        // 3) Namapuj názvy tímov a vypíš VŠETKY zápasy do konzoly
        if (anyChangeDetected || matchesLoadedRef.current === false) {
          (async () => {
            // 🔥 KĽÚČOVÉ: počkaj, kým mapovací kód nastaví príznak pripravenosti
            const ready = await waitForMappingReady(15000);
            if (!ready) {
              console.warn('[transport.js] Mapovanie nie je pripravené, výpis zápasov preskočený (skúsim pri ďalšej zmene).');
              return;
            }
        
            const mappedMatches = [];
            for (const m of allMatches) {
              const categoryName = m.categoryName
                || (m.categoryId && window.categoriesData ? window.categoriesData[m.categoryId] : null)
                || null;
        
              const homeRaw = m.homeTeamName || m.homeTeamIdentifier || m.homeTeam || '?';
              const awayRaw = m.awayTeamName || m.awayTeamIdentifier || m.awayTeam || '?';
        
              const homeMapped = await resolveTeamNameForDisplay(homeRaw, categoryName);
              const awayMapped = await resolveTeamNameForDisplay(awayRaw, categoryName);
        
              mappedMatches.push({
                id: m.id,
                status: m.status,
                kategória: m.categoryName || m.categoryId || '-',
                skupina: m.groupName || '-',
                typ: m.matchType || '-',
                domáci: homeMapped,
                hostia: awayMapped,
                skóre: (m.homeScore ?? '-') + ':' + (m.awayScore ?? '-'),
              });
            }
        
            console.log(`📋 TRANSPORT.JS – načítaných ${mappedMatches.length} zápasov z kolekcie 'matches':`);
            if (console.table) {
              console.table(mappedMatches);
            } else {
              console.log(mappedMatches);
            }
          })();
        }
    
        completedTeamsRef.current = completedTeams;
        matchesLoadedRef.current = true;
        setMatchesVersion((v) => v + 1);
    
        // 4) Pri akejkoľvek zmene zápasov skús znova namapovať názvy tímov v presunoch
        if (anyChangeDetected || anyMatchCompletedNow) {
          resolveTransfersViaMatchTracker(savedTransfersRef.current);
        }
      }, (e) => {
        console.error('transport.js: matches snapshot error', e);
        matchesLoadedRef.current = true;
      }));
    } catch (e) {
      console.error('transport.js: nepodarilo sa prihlásiť na matches', e);
    }

    return () => unsubs.forEach((u) => u && u());
  }, []);

  const resolveTransfersViaMatchTracker = async (transfersList) => {
    const fn = window.matchTracker?.getTeamNameByDisplayId;
    if (typeof fn !== 'function') return;

    const sourceList = Array.isArray(transfersList) ? transfersList : savedTransfersRef.current;
    if (!Array.isArray(sourceList) || sourceList.length === 0) return;

    const updates = {};
    let hasChanges = false;

    for (const tr of sourceList) {
      const rawTeamName = tr?.teamName != null ? String(tr.teamName).trim() : '';
      const rawCategory = tr?.category != null ? cleanCategory(tr.category) : '';

      if (!rawTeamName || !rawCategory) continue;
      if (!rawTeamName.includes(rawCategory)) continue;

      try {
        const result = await fn.call(window.matchTracker, rawTeamName);
        if (
          result !== undefined &&
          result !== null &&
          result !== '' &&
          String(result).trim() !== '' &&
          String(result).trim() !== 'null' &&
          String(result).trim() !== rawTeamName
        ) {
          const cleanResult = String(result).trim();
          if (trackerResolvedNamesRef.current[rawTeamName] !== cleanResult) {
            updates[rawTeamName] = cleanResult;
            hasChanges = true;
          }
        }
      } catch (e) {
        // ignorovať chybu pri jednotlivých názvoch
      }
    }

    if (hasChanges) {
      const nextMap = { ...trackerResolvedNamesRef.current, ...updates };
      trackerResolvedNamesRef.current = nextMap;
      setTrackerResolvedNames(nextMap);
      setMatchesVersion((v) => v + 1);
    }
  };

  useEffect(() => {
    if (!savedTransfers || savedTransfers.length === 0) return;

    resolveTransfersViaMatchTracker(savedTransfers);

    const retryTimer = setTimeout(() => {
      resolveTransfersViaMatchTracker(savedTransfersRef.current);
    }, 800);

    return () => clearTimeout(retryTimer);
  }, [savedTransfers]);

  const isTeamNameResolved = (teamName, categoryName) => {
    if (!teamName) return false;
    const tn = String(teamName).trim();
    const cat = categoryName ? cleanCategory(categoryName) : '';

    // Ak názov tímu neobsahuje názov kategórie, nevyžaduje mapovanie cez matchTracker
    if (!cat || !tn.includes(cat)) return true;

    // Ak názov tímu obsahuje názov kategórie, riadok sa zobrazí až keď je k dispozícii
    // platný výsledok z window.matchTracker.getTeamNameByDisplayId (iný ako vstup, nie "" alebo null)
    const mapped = trackerResolvedNamesRef.current[tn] ?? trackerResolvedNames[tn];
    return (
      mapped !== undefined &&
      mapped !== null &&
      mapped !== '' &&
      String(mapped).trim() !== '' &&
      String(mapped).trim() !== 'null' &&
      String(mapped).trim() !== tn
    );
  };

  /* -------------------- Zostavenie timeline eventov -------------------- */
  const timelineEvents = useMemo(() => {
    if (!travelTimesLoadedRef.current) return [];
    const events = [];

    const dayFilter = selectedDayKey || null;
    const catFilter = selectedCategory ? cleanCategory(selectedCategory) : null;
    const teamFilter = selectedTeam ? selectedTeam : null;

    /* --- 1) Transfery – CELÝ PRESUN ako jeden riadok s rozpismi --- */
    (savedTransfers || []).forEach((parent) => {
      if (parent._parentKey && parent._parentKey !== parent.key) return;
      if (catFilter && cleanCategory(parent.category || '') !== catFilter) return;
      if (teamFilter && String(parent.teamName || '').trim() !== teamFilter) return;

      // Skryť presuny s nerozriešeným názvom tímu (obsahuje názov kategórie
      // a tím ešte nemá žiadny completed zápas)
      if (!isTeamNameResolved(parent.teamName, parent.category)) return;

      const stopsIds = Array.isArray(parent.intermediateStopIds) ? parent.intermediateStopIds.filter(Boolean) : [];
      const parentSegments = Array.isArray(parent.segments) ? parent.segments : [];

      const routeIdsRaw = [parent.fromId, ...stopsIds, parent.toId].filter(Boolean);
      const routeIds = [];
      routeIdsRaw.forEach((id) => {
        if (routeIds.length === 0 || routeIds[routeIds.length - 1] !== id) routeIds.push(id);
      });
      if (routeIds.length < 2) return;

      const parentWhenRange = parseWhenRangeToTs(parent.when);

      // --- Zostavíme LEGS (čiastkové segmenty medzi zastávkami) ---
      const legs = [];
      let startTs = null, endTs = null;
      let hasRealTimes = false;
      let busId = null;
      let busName = null;
      let anyWalking = false;
      let allWalking = true;

      for (let i = 0; i < routeIds.length - 1; i++) {
        const fromId = routeIds[i];
        const toId = routeIds[i + 1];
        if (fromId === toId) continue;

        const seg = parentSegments.find((s) => s && s.fromId === fromId && s.toId === toId) || null;
        const legWalking = !!(seg && seg.isWalking === true);
        const legHasTimes = !!(seg && seg.startTs != null && seg.endTs != null && seg.endTs > seg.startTs);

        const legFromName = resolvePlaceNameById(fromId);
        const legToName = resolvePlaceNameById(toId);

        let legStartTs = null, legEndTs = null, legTimeLabel = '';
        if (legWalking) {
          // Rovnaká logika ako v logged-in-transport.js (getWalkingSegmentDisplayRange)
          const walkingRange = getWalkingSegmentDisplayRange(parent, i);

          if (walkingRange) {
            legStartTs = walkingRange.startTs;
            legEndTs = walkingRange.endTs;
            legTimeLabel = `${formatTimeOnly(legStartTs)} – ${formatTimeOnly(legEndTs)}`;
          } else if (seg?.startTs != null) {
            legStartTs = seg.startTs;
            legEndTs = seg.endTs != null ? seg.endTs : seg.startTs + 60 * 1000;
            legTimeLabel = `${formatTimeOnly(legStartTs)} – ${formatTimeOnly(legEndTs)}`;
          } else {
            legTimeLabel = 'PEŠI';
          }
        } else if (legHasTimes) {
          legStartTs = seg.startTs;
          legEndTs = seg.endTs;
          legTimeLabel = `${formatTimeOnly(legStartTs)} – ${formatTimeOnly(legEndTs)}`;
        } else {
          // Segment bez vlastných časov – rozdeľ celkový čas presunu medzi takéto segmenty
          const unassignedRange = getUnassignedSegmentDisplayRange(parent, i, routeIds, parentSegments);
          if (unassignedRange) {
            legStartTs = unassignedRange.startTs;
            legEndTs = unassignedRange.endTs;
            legTimeLabel = `${formatTimeOnly(legStartTs)} – ${formatTimeOnly(legEndTs)}`;
          } else {
            legTimeLabel = 'nepriradený';
          }
        }

        const legBusId = seg?.busId ? String(seg.busId) : null;
        const legBusName = legBusId
          ? (buses.find((b) => b.id === legBusId)?.name || `Bus ${legBusId}`)
          : null;

        // agregácia pre celkový presun
        if (legStartTs != null && (startTs == null || legStartTs < startTs)) startTs = legStartTs;
        if (legEndTs != null && (endTs == null || legEndTs > endTs)) endTs = legEndTs;
        if (legHasTimes) hasRealTimes = true;
        if (!busId && legBusId) { busId = legBusId; busName = legBusName; }
        if (legWalking) anyWalking = true;
        if (!legWalking) allWalking = false;

        legs.push({
          fromName: legFromName,
          toName: legToName,
          isWalking: legWalking,
          busName: legBusName,
          timeLabel: legTimeLabel,
          startTime: legStartTs != null ? formatTimeOnly(legStartTs) : '',
          endTime: legEndTs != null ? formatTimeOnly(legEndTs) : '',
          startTs: legStartTs,
          endTs: legEndTs,
          hasTimes: legHasTimes,
        });
      }

      if (legs.length === 0) return;

      const overallIsWalking = legs.every((l) => l.isWalking);

      // --- Celkový čas ---
      let timeLabel = '';
      if (overallIsWalking) {
        if (startTs != null) {
          if (endTs == null) endTs = startTs + 60 * 1000;
          timeLabel = `${formatTimeOnly(startTs)} – ${formatTimeOnly(endTs)}`;
        } else {
          timeLabel = 'PEŠI';
        }
      } else if (hasRealTimes && startTs != null) {
        timeLabel = endTs != null
          ? `${formatTimeOnly(startTs)} – ${formatTimeOnly(endTs)}`
          : formatTimeOnly(startTs);
      } else {
        timeLabel = 'nepriradený';
      }

      // --- Deň ---
      let dayKey = parent.dayKey || null;
      if (!dayKey && startTs != null) {
        const d = new Date(startTs);
        dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
      if (!dayKey && parentWhenRange) {
        const d = new Date(parentWhenRange.startTs);
        dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
      if (dayFilter && dayKey !== dayFilter) return;

      // --- Názvy miest pre celú trasu ---
      const fromName = resolvePlaceNameById(routeIds[0]);
      const toName = resolvePlaceNameById(routeIds[routeIds.length - 1]);

      const sortTs = startTs != null
        ? startTs
        : (parentWhenRange?.startTs ?? Number.POSITIVE_INFINITY);

      let typeKey;
      if (overallIsWalking) typeKey = 'transfer_walking';
      else if (hasRealTimes) typeKey = 'transfer_bus';
      else typeKey = 'transfer_unassigned';

      events.push({
        id: parent.key,
        dayKey,
        sortTs,
        startTs,
        endTs,
        timeLabel,
        typeKey,
        title: `${fromName} → ${toName}`,
        category: cleanCategory(parent.category || ''),
        categoryId: parent.categoryId || null,
        teamName: String(parent.teamName || '').trim(),
        fromName,
        toName,
        busName,
        isWalking: overallIsWalking,
        hasRealTimes,
        placeIcon: getPlaceIconForName(fromName),
        legs,
        extra: null,
      });
    });

    events.sort((a, b) => {
      if (a.sortTs !== b.sortTs) return a.sortTs - b.sortTs;
      return String(a.title).localeCompare(String(b.title), 'sk');
    });

    return events;
  }, [savedTransfers, buses, selectedDayKey, selectedCategory, selectedTeam, allPlaces, matchesVersion, trackerResolvedNames]);

  /* --- Skupiny podľa dňa --- */
  const eventsByDay = useMemo(() => {
    const map = {};
    timelineEvents.forEach((e) => {
      const dk = e.dayKey || 'neznamy';
      if (!map[dk]) map[dk] = [];
      map[dk].push(e);
    });
    Object.values(map).forEach((arr) => arr.sort((a, b) => a.sortTs - b.sortTs));
    return map;
  }, [timelineEvents]);

  /* -------------------- Render: loading -------------------- */
  if (loading) {
    return React.createElement('div', { className: 'flex justify-center pt-16' },
      React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
    );
  }

  const dayKeys = Object.keys(eventsByDay).sort();

  /* -------------------- Render: hlavička -------------------- */
  const headerSection = React.createElement('div', { className: 'mb-6' },
    React.createElement('h1', { className: 'text-2xl font-bold text-gray-800 flex items-center gap-2' },
      React.createElement('i', { className: 'fa-solid fa-bus text-blue-600' }),
      'Doprava'
    )
  );

  /* -------------------- Render: filtre -------------------- */
  const filtersSection = React.createElement('div', { className: 'bg-white rounded-lg shadow p-4 mb-6 border border-gray-200' },
    React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-3 gap-4' },
      // Deň
      React.createElement('div', null,
        React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Deň'),
        React.createElement('select', {
          className: 'w-full border border-gray-300 rounded px-3 py-2 text-sm',
          value: selectedDayKey,
          onChange: (e) => setSelectedDayKey(e.target.value),
        },
          React.createElement('option', { value: '' }, 'Všetky dni'),
          ...tournamentDays.map((d) =>
            React.createElement('option', { key: d.dayKey, value: d.dayKey }, `${d.dateLabel} (${d.dayName})`)
          )
        )
      ),
      // Kategória
      React.createElement('div', null,
        React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Kategória'),
        React.createElement('select', {
          className: 'w-full border border-gray-300 rounded px-3 py-2 text-sm',
          value: selectedCategory,
          onChange: (e) => setSelectedCategory(e.target.value),
        },
          React.createElement('option', { value: '' }, 'Všetky kategórie'),
          ...availableCategories.map((c) => React.createElement('option', { key: c, value: c }, c))
        )
      ),
      // Tím
      React.createElement('div', null,
        React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Tím'),
        React.createElement('select', {
          className: 'w-full border border-gray-300 rounded px-3 py-2 text-sm',
          value: selectedTeam,
          onChange: (e) => setSelectedTeam(e.target.value),
        },
          React.createElement('option', { value: '' }, 'Všetky tímy'),
          ...availableTeams.map((t) => {
            const [cat, name] = t.split('|');
            return React.createElement('option', { key: t, value: name }, `${name} (${cat})`);
          })
        )
      )
    )
  );

  /* -------------------- Render: prázdny stav -------------------- */
  const emptySection = React.createElement('div', { className: 'bg-white rounded-lg shadow p-12 text-center text-gray-500' },
    React.createElement('i', { className: 'fa-solid fa-inbox text-4xl mb-3 text-gray-300' }),
    React.createElement('p', null, 'Žiadne udalosti pre zvolené filtre.')
  );

  /* -------------------- Render: jedna udalosť -------------------- */
  const renderEvent = (ev) => {
    const color = EVENT_COLORS[ev.typeKey] || EVENT_COLORS.transfer_unassigned;

    // Podzoznam čiastkových segmentov (legs)
    const hasWalkingLeg = !!(ev.legs && ev.legs.some((l) => l.isWalking));

    // Špeciálny prípad: presun má iba jeden segment, je peší a nemá nastavené časy
    const isSingleWalkingNoTime =
      ev.legs &&
      ev.legs.length === 1 &&
      ev.legs[0].isWalking === true &&
      !ev.legs[0].startTime &&
      !ev.legs[0].endTime;

    const legsBlock = (ev.legs && ev.legs.length > 0)
      ? React.createElement('div', { className: 'mt-2 pl-2 border-l-2 border-gray-200 space-y-1' },
          // Hlavička stĺpcov – stĺpce vždy existujú, texty podmienečne
          React.createElement('div', { className: 'flex items-center gap-2 text-[10px] uppercase tracking-wide text-gray-400 pb-1' },
            React.createElement('span', { className: 'w-4 flex-shrink-0' }, ''),
            React.createElement('span', { className: 'w-20 flex-shrink-0' }, 'Typ'),
            // Čas (Od) – skryť text v špeciálnom prípade
            React.createElement('span', { className: 'w-16 flex-shrink-0' }, isSingleWalkingNoTime ? '' : 'Čas'),
            React.createElement('span', { className: 'w-1/3 min-w-0' }, 'Odkiaľ'),
            // Čas (Do) – skryť text v špeciálnom prípade
            React.createElement('span', { className: 'w-16 flex-shrink-0' }, isSingleWalkingNoTime ? '' : 'Čas'),
            React.createElement('span', { className: 'w-1/3 min-w-0' }, 'Kam'),
            // Poznámka – skryť text v špeciálnom prípade
            React.createElement('span', { className: 'w-1/3 min-w-0' }, (hasWalkingLeg && !isSingleWalkingNoTime) ? 'Poznámka' : '')
          ),
          ...ev.legs.map((leg, idx) => {
            const legIcon = leg.isWalking ? 'fa-person-walking text-amber-600' : 'fa-bus text-blue-600';

            const legBusLabelText = leg.isWalking
              ? 'PEŠI'
              : (leg.busName || '');

            const startTimeText = leg.startTime || '';
            const endTimeText = leg.endTime || '';

            // Špeciálny prípad: jediný segment, peší, bez času → v stĺpcoch Čas nič
            const isSingleWalkingNoTimeRow =
              ev.legs.length === 1 &&
              leg.isWalking === true &&
              !leg.startTime &&
              !leg.endTime;

            const displayStartTime = isSingleWalkingNoTimeRow ? '' : (startTimeText || '--:--');
            const displayEndTime = isSingleWalkingNoTimeRow ? '' : (endTimeText || '--:--');

            const legBusLabel = React.createElement('span', {
              className: `text-xs font-medium w-20 flex-shrink-0 truncate ${leg.isWalking ? 'text-amber-700 italic' : 'text-blue-700'}`,
            }, legBusLabelText);

            // Poznámka – v špeciálnom prípade prázdna
            const noteText = (leg.isWalking && !isSingleWalkingNoTimeRow)
              ? 'Disponibilný čas na presun peši'
              : '';

            return React.createElement('div', {
              key: idx,
              className: 'flex items-center gap-2 text-xs text-gray-600',
            },
              // 1. stĺpec: ikona
              React.createElement('span', { className: 'w-4 flex-shrink-0 text-center' },
                React.createElement('i', { className: `fa-solid ${legIcon}` })
              ),
              // 2. stĺpec: bus / PEŠI
              legBusLabel,
              // 3. stĺpec: Čas (Od)
              React.createElement('span', { className: 'font-mono w-16 flex-shrink-0 text-gray-700' }, displayStartTime),
              // 4. stĺpec: Odkiaľ
              React.createElement('span', { className: 'text-gray-500 w-1/3 min-w-0 truncate' }, leg.fromName),
              // 5. stĺpec: Čas (Do)
              React.createElement('span', { className: 'font-mono w-16 flex-shrink-0 text-gray-700' }, displayEndTime),
              // 6. stĺpec: Kam
              React.createElement('span', { className: 'text-gray-500 w-1/3 min-w-0 truncate' }, leg.toName),
              // 7. stĺpec: Poznámka
              React.createElement('span', { className: 'text-gray-400 italic w-1/3 min-w-0 truncate' }, noteText)
            );
          })
        )
      : null;

    return React.createElement('div', {
      key: ev.id,
      className: 'px-5 py-3 hover:bg-gray-50 transition-colors',
    },
      React.createElement('div', { className: 'flex-1 min-w-0' },
        (() => {
          const catColor = ev.category
            ? (transportColorsRef.current[ev.category] || transportColorsRef.current[ev.categoryId] || null)
            : null;

          let badgeBg = undefined;
          if (catColor) {
            const isHex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(catColor.trim());
            badgeBg = isHex ? `${catColor.trim()}20` : `color-mix(in srgb, ${catColor} 12%, white)`;
          }

          const badgeStyle = catColor
            ? { color: catColor, backgroundColor: badgeBg }
            : undefined;

          return (ev.category || ev.teamName)
            ? React.createElement('div', { className: 'flex items-center gap-2 flex-wrap mb-1' },
                ev.category
                  ? React.createElement('span', {
                      className: 'text-xs px-2 py-0.5 rounded font-medium border',
                      style: badgeStyle
                        ? { ...badgeStyle, borderColor: catColor }
                        : { backgroundColor: '#f3f4f6', color: '#4b5563', borderColor: '#e5e7eb' },
                    }, ev.category)
                  : null,
                ev.teamName
                  ? React.createElement('span', {
                      className: 'text-xs px-2 py-0.5 rounded font-medium border',
                      style: badgeStyle
                        ? { ...badgeStyle, borderColor: catColor }
                        : { backgroundColor: '#eff6ff', color: '#1d4ed8', borderColor: '#dbeafe' },
                    }, ev.teamName)
                  : null
              )
            : null;
        })(),
        React.createElement('div', { className: `font-medium ${color.text}` }, ev.title),
        legsBlock
      )
    );
  };
  
  /* -------------------- Render: jeden deň -------------------- */
  const renderDay = (dayKey) => {
    const dayMeta = tournamentDays.find((d) => d.dayKey === dayKey);
    const dayLabel = dayMeta ? `${dayMeta.dateLabel} (${dayMeta.dayName})` : dayKey;
    const dayEvents = eventsByDay[dayKey];

    return React.createElement('div', {
      key: dayKey,
      className: 'bg-white rounded-lg shadow border border-gray-200 overflow-hidden',
    },
      // Hlavička dňa
      React.createElement('div', { className: 'bg-gradient-to-r from-blue-600 to-blue-500 text-white px-5 py-3 flex items-center justify-between' },
        React.createElement('h2', { className: 'text-lg font-semibold flex items-center gap-2' },
          React.createElement('i', { className: 'fa-regular fa-calendar' }),
          dayLabel
        )
      ),
      // Zoznam udalostí – prvý bez farebného pásika
      React.createElement('div', { className: 'divide-y divide-gray-100' },
        ...dayEvents.map((ev) => renderEvent(ev))
      )
    );
  };

  /* -------------------- Render: timeline -------------------- */
  const timelineSection = dayKeys.length === 0
    ? emptySection
    : React.createElement('div', { className: 'space-y-8' },
        ...dayKeys.map(renderDay)
      );

  /* -------------------- Render: root -------------------- */
  return React.createElement('div', { className: 'p-4 max-w-7xl mx-auto' },
    headerSection,
    filtersSection,
    timelineSection
  );
};

/* ------------------------------------------------------------------ */
/* Export / mount                                                     */
/* ------------------------------------------------------------------ */

export default function Transport({ userProfileData }) {
  return React.createElement(TransportApp, { userProfileData });
}

/* ------------------------------------------------------------------ */
/* Auto-mount do #root (ak ešte nie je namountovaný)                  */
/* ------------------------------------------------------------------ */

const rootEl = document.getElementById('root');

if (rootEl && !rootEl.dataset.reactMounted) {
  // Počkáme, kým authentication.js nastaví window.db a prípadne userProfileData
  const tryMount = () => {
    if (!window.db) {
      // Firestore ešte nie je pripravený – skús o chvíľu
      setTimeout(tryMount, 200);
      return;
    }

    const userProfileData = window.currentUserProfile || window.userProfileData || null;

    // Odstránime pôvodný spinner z HTML
    rootEl.dataset.reactMounted = 'true';

    const root = ReactDOM.createRoot(rootEl);
    root.render(React.createElement(Transport, { userProfileData }));
  };

  tryMount();
}
