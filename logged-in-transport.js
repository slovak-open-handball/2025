// logged-in-transport.js
import { doc, getDoc, getDocs, onSnapshot, updateDoc, addDoc, collection, Timestamp, setDoc, deleteDoc, writeBatch, deleteField } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const { useState, useEffect, useRef } = React;

/**
 * Globálna funkcia pre zobrazenie notifikácií
 */
window.showGlobalNotification = (message, type = 'success') => {
    let notificationElement = document.getElementById('global-notification');
    if (!notificationElement) {
        notificationElement = document.createElement('div');
        notificationElement.id = 'global-notification';
        notificationElement.className = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[99999] opacity-0 transition-opacity duration-300';
        document.body.appendChild(notificationElement);
    }

    const baseClasses = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[99999] transition-all duration-500 ease-in-out transform';
    let typeClasses = '';
    switch (type) {
        case 'success': typeClasses = 'bg-green-500 text-white'; break;
        case 'error':   typeClasses = 'bg-red-500 text-white';   break;
        case 'info':    typeClasses = 'bg-blue-500 text-white';  break;
        default:        typeClasses = 'bg-gray-700 text-white';
    }

    notificationElement.className = `${baseClasses} ${typeClasses} opacity-0 scale-95`;
    notificationElement.textContent = message;

    setTimeout(() => {
        notificationElement.className = `${baseClasses} ${typeClasses} opacity-100 scale-100`;
    }, 10);

    setTimeout(() => {
        notificationElement.className = `${baseClasses} ${typeClasses} opacity-0 scale-95`;
    }, 5000);
};

// Pomocná funkcia: Firestore Timestamp / Date / ISO string → "DD. MM. YYYY"
const formatDateDDMMYYYY = (ts) => {
    if (!ts) return null;
    let date;
    if (typeof ts.toDate === 'function') date = ts.toDate();
    else if (ts instanceof Date) date = ts;
    else date = new Date(ts);
    if (isNaN(date.getTime())) return null;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}. ${month}. ${year}`;
};

// Pomocná funkcia: Firestore Timestamp / Date → "DD. MM. YYYY HH:MM"
const formatDateTime = (ts) => {
    if (!ts) return null;
    let date;
    if (typeof ts.toDate === 'function') date = ts.toDate();
    else if (ts instanceof Date) date = ts;
    else date = new Date(ts);
    if (isNaN(date.getTime())) return null;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}. ${month}. ${year} ${hours}:${minutes}`;
};

// Pomocná: timestamp → "DD. MM. YYYY HH:MM"
const formatTsLocal = (ts) => {
    if (ts == null || !isFinite(ts)) return null;
    const d = new Date(ts);
    if (isNaN(d.getTime())) return null;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}. ${month}. ${year} ${hours}:${minutes}`;
};

const cleanCategory = (cat) => String(cat || '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// ============================================================
// Normalizuje názov miesta – odstráni predpony ako "zastávka ",
// "ubytovanie ", "ubytovňa " a odstráni medzery na okrajoch
// ============================================================
const normalizePlaceName = (name) => {
    if (!name) return '';
    return String(name)
        .trim()
        .replace(/^zastávka\s+/i, '')
        .replace(/^zastavka\s+/i, '')
        .replace(/^ubytovanie\s+/i, '')
        .replace(/^ubytovňa\s+/i, '')
        .replace(/^ubytovna\s+/i, '')
        .replace(/^miesto\s+zrazu\s+/i, '')
        .replace(/^miesta\s+zrazu\s+/i, '')
        .trim();
};

// ============================================================
// Prevedie identifikátor tímu na zobrazovaný názov
// ============================================================
const resolveTeamName = (identifier) => {
    if (!identifier) return '---';

    if (window.teamManager && typeof window.teamManager.getTeamNameByDisplayIdSync === 'function') {
        try {
            const resolved = window.teamManager.getTeamNameByDisplayIdSync(identifier);
            if (resolved && typeof resolved === 'string' && resolved.trim() !== '') {
                return resolved;
            }
        } catch (e) { /* ignore */ }
    }
    return identifier;
};

// ============================================================
// Naformátuje typ dopravy a čas príchodu
// ============================================================
const formatArrival = (arrival) => {
    if (!arrival || !arrival.type) return '---';
    const type = String(arrival.type).trim();
    const time = arrival.time ? String(arrival.time).trim() : '';
    if (!type) return '---';
    if (time) return `${type} (${time})`;
    return type;
};

// ============================================================
// Z `dayKey` (YYYY-MM-DD) + `slotFrom` (HH:MM) vytvorí timestamp
// ============================================================
const dayKeyAndSlotToTimestamp = (dayKey, slotFrom) => {
    if (!dayKey) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
    if (!m) return null;
    const year = Number(m[1]);
    const month = Number(m[2]) - 1;
    const day = Number(m[3]);
    let hours = 0, minutes = 0;
    if (slotFrom && /^\d{1,2}:\d{2}$/.test(slotFrom)) {
        const [h, mi] = slotFrom.split(':').map(Number);
        hours = h; minutes = mi;
    }
    return new Date(year, month, day, hours, minutes, 0, 0).getTime();
};

// ============================================================
// Pomocné mapovanie typu miesta na ikonu + farbu
// ============================================================
const placeTypeIcons = {
    sportova_hala: { icon: 'fa-futbol', color: '#dc2626', label: 'Športová hala' },
    stravovanie:   { icon: 'fa-utensils', color: '#16a34a', label: 'Stravovanie' },
    ubytovanie:    { icon: 'fa-bed', color: '#6b7280', label: 'Ubytovanie' },
    zastavka:      { icon: 'fa-bus', color: '#2563eb', label: 'Zastávka' },
};

// ============================================================
// KOLEKCIA PRE ULOŽENÉ VYGENEROVANÉ PRESUNY
// (rovnaká kolekcia ako nastavenia časov medzi zastávkami)
// ============================================================
const TRANSPORT_SETTINGS_COLLECTION = 'settings';
const TRANSPORT_SETTINGS_DOC = 'transportTravelTimes';
const TRANSPORT_TRANSFERS_FIELD = 'transfers';

// Pomocná: stabilný kľúč pre presun (aby sme vedeli identifikovať duplicitný)
const buildTransferKey = (category, teamName, when, text) => {
    return [
        cleanCategory(category || ''),
        String(teamName || '').trim(),
        String(when || '').trim(),
        String(text || '').trim(),
    ].join('||');
};

const buildDefaultSegments = (parent) => {
    const stops = Array.isArray(parent.intermediateStops) ? parent.intermediateStops : [];
    const routeRaw = [parent.fromLocation, ...stops, parent.toLocation].filter(Boolean);
    const route = [];
    routeRaw.forEach((loc) => {
        const n = normalizePlaceName(loc);
        if (route.length === 0 || normalizePlaceName(route[route.length - 1]) !== n) route.push(loc);
    });
    const out = [];
    for (let i = 0; i < route.length - 1; i++) {
        out.push({
            from: route[i],
            to: route[i + 1],
            startTs: null,
            endTs: null,
            when: null,
            isWalking: false,
            busAssigned: false,
            walkingSetAt: null,
            walkingSetBy: null,
        });
    }
    return out;
};

const findSegmentIndex = (segments, fromLoc, toLoc) => {
    const f = normalizePlaceName(fromLoc);
    const t = normalizePlaceName(toLoc);
    return segments.findIndex(
        (s) => normalizePlaceName(s.from) === f && normalizePlaceName(s.to) === t
    );
};

const TransportApp = ({ userProfileData }) => {
    const timelineGenerationRequestedRef = useRef(false);
    // Mapa placeId → placeName
    const placesMapRef = useRef({});

    // Lookup pre názvy tímov (userId|category|teamIndex → teamName)
    const teamsLookupRef = useRef({});

    const savedTransfersRef = useRef([]);

    const findTeamIdentifiersByName = (category, teamName) => {
        const cat = cleanCategory(category);
        const name = String(teamName || '').trim();
        if (!cat || !name) return null;
    
        const lookup = teamsLookupRef.current || {};
        
        for (const [key, info] of Object.entries(lookup)) {
            if (!info) continue;
            if (info.teamName === name && cleanCategory(info.category) === cat) {
                return {
                    teamUid: info.userId,
                    teamIndex: info.teamIndex,
                    category: cat,
                };
            }
        }
        return null;
    };

    // ============================================================
    // NOVÉ: Pomocná funkcia – vypíše do konzoly DB dokument pre presun
    // ============================================================
    const logTransferDbDocument = async (transfer) => {
        if (!window.db || !transfer) {
            console.warn('[TRANSPORT] logTransferDbDocument: chýba window.db alebo transfer');
            return;
        }

        const collectionPath = TRANSPORT_SETTINGS_COLLECTION; // 'settings'
        const docPath = TRANSPORT_SETTINGS_DOC;              // 'transportTravelTimes'
        const fieldPath = TRANSPORT_TRANSFERS_FIELD;         // 'transfers'

        // Kľúč parent záznamu (pre segmenty je to _parentKey)
        const parentKey = transfer._parentKey || transfer.key;

        console.log('%c[TRANSPORT][DB-DOC] ===== DB dokument pre presun =====', 'color:#2563eb;font-weight:bold;');
        console.log('[TRANSPORT][DB-DOC] Kolekcia:', collectionPath);
        console.log('[TRANSPORT][DB-DOC] Dokument:', docPath);
        console.log('[TRANSPORT][DB-DOC] Pole:', fieldPath);
        console.log('[TRANSPORT][DB-DOC] Kľúč záznamu (parent):', parentKey);
        console.log('[TRANSPORT][DB-DOC] Celá cesta:', `${collectionPath}/${docPath} → ${fieldPath}.${parentKey}`);
        console.log('[TRANSPORT][DB-DOC] Transfer objekt (z pamäte):', transfer);

        try {
            const docRef = doc(window.db, collectionPath, docPath);
            const snap = await getDoc(docRef);

            if (!snap.exists()) {
                console.warn('[TRANSPORT][DB-DOC] Dokument v DB neexistuje:', `${collectionPath}/${docPath}`);
                return;
            }

            const data = snap.data() || {};
            const rawTransfers = data[fieldPath] || {};
            const dbRecord = rawTransfers[parentKey] || null;

            if (!dbRecord) {
                console.warn(
                    '[TRANSPORT][DB-DOC] Záznam pre kľúč neexistuje v DB:',
                    parentKey,
                    '\nDostupné kľúče:',
                    Object.keys(rawTransfers)
                );
                return;
            }

            console.log('%c[TRANSPORT][DB-DOC] Záznam z DB:', 'color:#16a34a;font-weight:bold;', {
                key: parentKey,
                path: `${collectionPath}/${docPath} → ${fieldPath}.${parentKey}`,
                value: dbRecord,
            });
        } catch (err) {
            console.error('[TRANSPORT][DB-DOC] Chyba pri načítaní dokumentu z DB:', err);
        }
    };

    // ============================================================
    // POMOCNÁ: Parsovanie času z "when" pre porovnanie intervalov
    // Vráti { startTs, endTs } alebo null
    // ============================================================
    const parseTransferWhenToRange = (when) => {
        if (!when) return null;
        const s = String(when);
        const regex = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/g;
        const found = [];
        let m;
        while ((m = regex.exec(s)) !== null) {
            const d = Number(m[1]);
            const mo = Number(m[2]) - 1;
            const y = Number(m[3]);
            const hh = m[4] != null ? Number(m[4]) : 0;
            const mi = m[5] != null ? Number(m[5]) : 0;
            const ts = new Date(y, mo, d, hh, mi, 0, 0).getTime();
            if (isFinite(ts)) found.push(ts);
        }
        if (found.length === 0) return null;
        return {
            startTs: found[0],
            endTs: found.length > 1 ? found[1] : found[0],
        };
    };

    const parseWhenRangeToTs = (when) => {
        if (!when) return null;
        const s = String(when);
        const regex = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/g;
        const found = [];
        let m;
        while ((m = regex.exec(s)) !== null) {
            const d = Number(m[1]);
            const mo = Number(m[2]) - 1;
            const y = Number(m[3]);
            const hh = m[4] != null ? Number(m[4]) : 0;
            const mi = m[5] != null ? Number(m[5]) : 0;
            const ts = new Date(y, mo, d, hh, mi, 0, 0).getTime();
            if (isFinite(ts)) found.push(ts);
        }
        if (found.length === 0) return null;
        return {
            startTs: found[0],
            endTs: found.length > 1 ? found[1] : found[0],
        };
    };

    const computeProvisionalSegmentRange = (transfer) => {
        if (!transfer) return null;
        const parentKey = transfer._parentKey || transfer.key;
        if (!parentKey) return null;
    
        const parentRec = (savedTransfersRef.current || []).find((s) => s.key === parentKey);
        if (!parentRec) return null;
    
        // ============================================================
        // 1) Zisti PEVNÝ rozsah parenta (parentRec.when).
        //    Toto je JEDINÝ povolený interval pre všetky segmenty.
        //    Ak parent nemá when, skús poskladať z reálnych časov segmentov.
        // ============================================================
        let parentRange = null;
        if (parentRec.when && String(parentRec.when).trim() !== '') {
            parentRange = parseTransferWhenToRange(parentRec.when);
        }
        if (!parentRange || parentRange.startTs == null || parentRange.endTs == null) {
            // Fallback – poskladaj z reálnych časov segmentov parenta
            let earliestStart = null;
            let latestEnd = null;
            (parentRec.segments || []).forEach((s) => {
                if (s.startTs != null && (earliestStart == null || s.startTs < earliestStart)) earliestStart = s.startTs;
                if (s.endTs != null && (latestEnd == null || s.endTs > latestEnd)) latestEnd = s.endTs;
            });
            if (earliestStart != null && latestEnd != null) {
                parentRange = { startTs: earliestStart, endTs: latestEnd };
            }
        }
        if (!parentRange || parentRange.startTs == null || parentRange.endTs == null) return null;
    
        const PARENT_START = parentRange.startTs;
        const PARENT_END = parentRange.endTs;
    
        // ============================================================
        // 2) Zoznam všetkých segmentov parenta
        // ============================================================
        const parentSegments = [];
        if (Array.isArray(parentRec.segments) && parentRec.segments.length > 0) {
            parentRec.segments.forEach((seg, idx) => {
                const segFrom = String(seg.from || '').trim();
                const segTo = String(seg.to || '').trim();
                if (!segFrom || !segTo) return;
        
                // ============================================================
                // NOVÉ: Peší segment má trvanie 0 minút.
                // Preto:
                //  - ak má startTs, berieme ho ako endTs (trvanie = 0)
                //  - ak má len endTs, berieme ho ako startTs (trvanie = 0)
                //  - ak nemá ani jeden, range = null
                //
                // Tým sa zabezpečí, že pri hľadaní provizórneho intervalu
                // pre aktuálny segment sa peší segment NEPOČÍTA ako časová
                // prekážka – aktuálny segment môže začínať hneď na konci
                // predchádzajúceho BUS segmentu (pešo sa ide "zadarmo").
                // ============================================================
                const isWalkingSeg = seg.isWalking === true;
        
                let range = null;
                if (isWalkingSeg) {
                    // Peší segment: trvanie 0 min → startTs = endTs
                    if (seg.startTs != null) {
                        range = { startTs: seg.startTs, endTs: seg.startTs };
                    } else if (seg.endTs != null) {
                        range = { startTs: seg.endTs, endTs: seg.endTs };
                    }
                } else {
                    if (seg.startTs != null && seg.endTs != null && seg.endTs > seg.startTs) {
                        range = { startTs: seg.startTs, endTs: seg.endTs };
                    } else if (seg.startTs != null) {
                        range = { startTs: seg.startTs, endTs: null };
                    } else if (seg.endTs != null) {
                        range = { startTs: null, endTs: seg.endTs };
                    }
                }
        
                // ============================================================
                // NOVÉ: Peší segment sa NIKDY nepovažuje za "resolved with time"
                // pre účely hľadania okolia (prev/next resolved segment).
                // Dôvod: peší segment nemá reálny časový interval – jeho
                // trvanie je 0 min, takže nesmie "blokovať" hľadanie
                // predchádzajúceho/nasledujúceho BUS segmentu.
                // ============================================================
                const isResolvedWithTime =
                    !isWalkingSeg && (
                        (seg.busAssigned === true && seg.startTs != null && seg.endTs != null) ||
                        (seg.startTs != null && seg.endTs != null)
                    );
    
                parentSegments.push({
                    idx,
                    fromLocation: segFrom,
                    toLocation: segTo,
                    isWalking: seg.isWalking === true,
                    isResolvedWithTime,
                    range,
                });
            });
        }
    
        const currentFromNorm = normalizePlaceName(transfer.fromLocation);
        const currentToNorm = normalizePlaceName(transfer.toLocation);
        const isCurrentInList = parentSegments.some(
            (seg) =>
                normalizePlaceName(seg.fromLocation) === currentFromNorm &&
                normalizePlaceName(seg.toLocation) === currentToNorm
        );
        if (!isCurrentInList) {
            parentSegments.push({
                idx: parentSegments.length,
                fromLocation: transfer.fromLocation,
                toLocation: transfer.toLocation,
                isWalking: transfer.isWalking === true,
                isResolvedWithTime: false,
                range: null,
            });
        }
        parentSegments.sort((a, b) => (a.idx || 0) - (b.idx || 0));
    
        // ============================================================
        // 3) Predchádzajúci resolved segment – berieme LEN ak jeho
        //    endTs je v rámci [PARENT_START, PARENT_END].
        // ============================================================
        let prevResolvedEndTs = null;
        for (const seg of parentSegments) {
            const isCurrent =
                normalizePlaceName(seg.fromLocation) === currentFromNorm &&
                normalizePlaceName(seg.toLocation) === currentToNorm;
            if (isCurrent) break;
        
            // NOVÉ: Pešie segmenty preskoč – nemajú reálny časový interval
            if (seg.isWalking === true) continue;
        
            if (seg.isResolvedWithTime && seg.range && seg.range.endTs != null) {
                const e = seg.range.endTs;
                if (e >= PARENT_START && e <= PARENT_END) {
                    if (prevResolvedEndTs == null || e > prevResolvedEndTs) {
                        prevResolvedEndTs = e;
                    }
                }
            }
        }
    
        // ============================================================
        // 4) Nasledujúci resolved segment – berieme LEN ak jeho
        //    startTs je v rámci [PARENT_START, PARENT_END].
        // ============================================================
        let nextResolvedStartTs = null;
        let foundCurrent = false;
        for (const seg of parentSegments) {
            const isCurrent =
                normalizePlaceName(seg.fromLocation) === currentFromNorm &&
                normalizePlaceName(seg.toLocation) === currentToNorm;
            if (isCurrent) { foundCurrent = true; continue; }
            if (!foundCurrent) continue;
        
            // NOVÉ: Pešie segmenty preskoč
            if (seg.isWalking === true) continue;
        
            if (seg.isResolvedWithTime && seg.range && seg.range.startTs != null) {
                const s = seg.range.startTs;
                if (s >= PARENT_START && s <= PARENT_END) {
                    if (nextResolvedStartTs == null || s < nextResolvedStartTs) {
                        nextResolvedStartTs = s;
                    }
                }
            }
        }
    
        // ============================================================
        // 5) Zostav výsledok – VŽDY v rámci [PARENT_START, PARENT_END]
        // ============================================================
        let startTsForDisplay = prevResolvedEndTs != null ? prevResolvedEndTs : PARENT_START;
        // Orezanie na PARENT_START
        if (startTsForDisplay < PARENT_START) startTsForDisplay = PARENT_START;
    
        let endTsForDisplay;
        if (nextResolvedStartTs != null && nextResolvedStartTs > startTsForDisplay) {
            endTsForDisplay = nextResolvedStartTs;
        } else {
            endTsForDisplay = PARENT_END;
        }
        // Orezanie na PARENT_END
        if (endTsForDisplay > PARENT_END) endTsForDisplay = PARENT_END;
    
        if (endTsForDisplay <= startTsForDisplay) {
            // Fallback – celý parent rozsah
            return { startTs: PARENT_START, endTs: PARENT_END };
        }
    
        return { startTs: startTsForDisplay, endTs: endTsForDisplay };
    };

    // ============================================================
    // Pomocná: obohatí transfer o teamUid/teamIndex (ak chýbajú)
    // a odstráni teamName (neukladá sa do DB).
    //
    // teamUid  = ID dokumentu používateľa v kolekcii users
    // teamIndex = poradie tímu v poli teams[category] v tomto dokumente
    // ============================================================
    const toDbTransfer = (src, fallbackCategory, fallbackTeamName) => {
        if (!src) return src;
        const category = cleanCategory(src.category || fallbackCategory || '');
        const teamName = String(src.teamName || fallbackTeamName || '').trim();
        const ids = (src.teamUid != null && src.teamIndex != null)
            ? { teamUid: src.teamUid, teamIndex: src.teamIndex }
            : findTeamIdentifiersByName(category, teamName);

        const out = { ...src, category };
        if (ids) {
            out.teamUid = ids.teamUid;
            out.teamIndex = ids.teamIndex;
        }
        delete out.teamName;
        return out;
    };

    // Buffery pre udalosti z jednotlivých kolekcií
    const matchesBufferRef = useRef([]);
    const cateringBufferRef = useRef([]);
    const teamsArrivalBufferRef = useRef([]);

    // Zrkadlo `allPlaces` pre použitie v `rebuildAndLogTimeline`
    const allPlacesRef = useRef([]);

    // Mapa: category|groupName → Set(teamName) – reálne priradenie zo settings/superstructureGroups
    const superstructureGroupsRef = useRef({});

    // Mapa: názov kategórie → hex farba pre dopravu (z settings/categories)
    const transportColorsRef = useRef({});

    // Zabráni opakovanému spracovaniu pred prvým načítaním
    const matchesLoadedRef = useRef(false);
    const cateringLoadedRef = useRef(false);
    const teamsLoadedRef = useRef(false);

    const teamsLookupLoadedRef = useRef(false);

    const travelTimesLoadedRef = useRef(false);

    // UI prepínač: 'planovanie' | 'nastavenia'
    const [activeView, setActiveView] = useState('planovanie');

    // Zoznam všetkých miest (z kolekcie `places`)
    const [allPlaces, setAllPlaces] = useState([]);

    // Uložené zastávky pre select
    const [stopsList, setStopsList] = useState([]);

    // ==== TRVANIA JÁZDY MEDZI ZASTÁVKAMI ====
    const [travelTimes, setTravelTimes] = useState({});
    const [travelTimesDraft, setTravelTimesDraft] = useState({});
    const [travelTimesSaving, setTravelTimesSaving] = useState(false);
    const [travelTimesLoaded, setTravelTimesLoaded] = useState(false);

    // Mapa: category|teamName → { players, menRT, womenRT, menDrivers, womenDrivers }
    const [teamCounts, setTeamCounts] = useState({});

    // ==== PLÁNOVANIE – AUTOBUSY A DNI TURNAJA ====
    const [buses, setBuses] = useState([]);
    // Mapa: busId|dayKey → [ { id, order, timeFrom, timeTo, placeFrom, placeTo, teamsIn, teamsOut, count } ]
    const [busRows, setBusRows] = useState({});
    const [tournamentDays, setTournamentDays] = useState([]);
    const [tournamentDaysLoaded, setTournamentDaysLoaded] = useState(false);
    const [busSaving, setBusSaving] = useState(false);
    const [confirmModal, setConfirmModal] = useState(null);    
    const [stopTypeModal, setStopTypeModal] = useState(null); 
    const [selectedDayKey, setSelectedDayKey] = useState('');
    const [selectedBusId, setSelectedBusId] = useState('');
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');
    const [savedTransfers, setSavedTransfers] = useState([]);
    // Farba dopravy pre kategórie (na re-render pri zmene)
    const [transportColors, setTransportColors] = useState({});
    // ==== MODÁLNE OKNO PRE VÝBER KATEGÓRIE (tlačidlo "+") ====
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [selectedCategoryForTimeline, setSelectedCategoryForTimeline] = useState('');

    // ==== NOVÉ: Filter – zobraziť iba presuny s textom "časť presunu" ====
    const [showOnlyPartialTransfers, setShowOnlyPartialTransfers] = useState(false);

    // ==== MODÁLNE OKNO PRE MAZANIE PRESUNOV (červená polovica FAB) ====
    const [showDeleteTransfersModal, setShowDeleteTransfersModal] = useState(false);
    const [selectedCategoryForDelete, setSelectedCategoryForDelete] = useState('');
    
    // ==== VAROVANIE: CHÝBAJÚCE TRVANIE JÁZDY ====
    const [missingTravelTimeWarning, setMissingTravelTimeWarning] = useState([]);

    // ==== NOVÉ: príznak, že zoznam zastávok (places) už bol načítaný ====
    const [placesLoaded, setPlacesLoaded] = useState(false);

    // ==== NOVÉ: Prepínač záložiek v Nastaveniach ====
    const [settingsTab, setSettingsTab] = useState('travelTimes'); // 'travelTimes' | 'teamShortcuts'

    // ==== NOVÉ: Skratky názvov tímov (category|teamName → shortcut) ====
    const [teamShortcuts, setTeamShortcuts] = useState({});
    const [teamShortcutsLoaded, setTeamShortcutsLoaded] = useState(false);

    // ==== NOVÉ: Modálne okno pre výber typu presunu ====
    const [showTransferTypeModal, setShowTransferTypeModal] = useState(false);

    // ==== NOVÉ: Modálne okno pre vytvorenie vlastného presunu ====
    const [showCustomTransferModal, setShowCustomTransferModal] = useState(false);
    const [customTransferCategory, setCustomTransferCategory] = useState('');
    const [customTransferTeamName, setCustomTransferTeamName] = useState('');

    // ==== NOVÉ: Modálne okno pre úpravu skratky tímu ====
    const [shortcutEditModal, setShortcutEditModal] = useState(null); // { category, teamName, shortcut }
    const [shortcutSaving, setShortcutSaving] = useState(false);
    const [shortcutConflict, setShortcutConflict] = useState(null);
    
    // ==== NOVÉ: Modálne okno pre potvrdenie zmazania skratky tímu ====
    const [deleteShortcutModal, setDeleteShortcutModal] = useState(null); // { category, teamName, shortcut }
    const [deleteShortcutSaving, setDeleteShortcutSaving] = useState(false);

    // ==== MODÁLNE OKNO PRE ÚPRAVU VYGENEROVANÉHO PRESUNU ====
    const [editingTransfer, setEditingTransfer] = useState(null);
    const [editingTransferStops, setEditingTransferStops] = useState([]); // medzizastávky medzi from a to
    const [editingTransferSaving, setEditingTransferSaving] = useState(false);

    // ==== ROZHODOVACIE MODÁLNE OKNO PO KLIKNUTÍ NA PRESUN ====
    const [transferActionModal, setTransferActionModal] = useState(null); // { transfer }
    const [showAssignBusModal, setShowAssignBusModal] = useState(false);
    const [assignBusTransfer, setAssignBusTransfer] = useState(null);
    const [assignBusMatches, setAssignBusMatches] = useState([]); // pole { bus, row, side } – side = 'in' | 'out'
    const [assignBusSelectedKey, setAssignBusSelectedKey] = useState(''); // `${busId}|${rowId}|${side}`
    const [assignBusSaving, setAssignBusSaving] = useState(false);

    // ==== MODÁLNE OKNO PRE ODSTRÁNENIE "PEŠI" PRÍZNAKU ====
    const [removeWalkingModal, setRemoveWalkingModal] = useState(null); // { transfer }
    const [removeWalkingSaving, setRemoveWalkingSaving] = useState(false);

    // ==== MODÁLNE OKNO PRE ODSTRÁNENIE KONKRÉTNEHO PRESUNU ====
    const [deleteTransferModal, setDeleteTransferModal] = useState(null); // { transfer }
    const [deleteTransferSaving, setDeleteTransferSaving] = useState(false);

    // ==== MODÁLNE OKNO PRE POTVRDENIE REGENERÁCIE PRESUNOV ====
    const [regenTransfersModal, setRegenTransfersModal] = useState(null); // { category, existingCount }

    // ============================================================
    // PREDNAČÍTANIE UBYTOVNÍ PRE SUPERSTRUCTURE TÍMY
    // ============================================================
    const preloadAccommodationsForSuperstructureTeams = async () => {
        if (!window.__transport_accommodationsByGroup) {
            window.__transport_accommodationsByGroup = {};
        }

        // Zbieraj všetky (category, derivedGroupName) dvojice, ktoré treba prednačítať
        const toLoad = new Set();
    
        (teamsArrivalBufferRef.current || []).forEach((t) => {
            if (!t.isSuperstructure) return;
            if (!t.teamName) return;
            const lastCharMatch = /\d([A-ZÁ-Ž])\s*$/.exec(String(t.teamName).trim());
            if (!lastCharMatch) return;
            const derivedGroupName = `skupina ${lastCharMatch[1].toUpperCase()}`;
            const key = `${cleanCategory(t.category)}|${derivedGroupName}`;
            toLoad.add(key);
        });

        for (const key of toLoad) {
            if (window.__transport_accommodationsByGroup[key]) continue; // už načítané
            const [cat, grp] = key.split('|');
            try {
                const result = await window.listAccommodationsByCategoryAndGroup(cat, grp);
                window.__transport_accommodationsByGroup[key] = Array.isArray(result) ? result : [];
            } catch (err) {
                console.error(`[TRANSPORT] Chyba pri prednačítaní ubytovní pre ${key}:`, err);
                window.__transport_accommodationsByGroup[key] = [];
            }
        }
    
        console.log('[TRANSPORT] Prednačítané ubytovne pre superstructure tímy:', window.__transport_accommodationsByGroup);
    };

    // ============================================================
    // POMOCNÁ FUNKCIA – vykreslí časovú os pre jeden tím
    // ============================================================
    const renderTeamTimeline = (category, teamName, events, options) => {
        const {
            isSuperstructureTeam,
            teamGroupName,
            getGroupLastChar,
            groupBelongsToChar,
            formatDateDDMMYYYY,
            extractDayKeyFromWhen,
        } = options;

        const lines = [];
        lines.push(`\n  [TRANSPORT] Tím: ${teamName} (počet udalostí: ${events.length})`);

        // Pomocná: zisti, či je tím pavúkový (WSF/LSF/WQF/W8F/W16F v názve)
        const isPavukTeam = /\b(WSF|LSF|WQF|W8F|W16F)\d*/i.test(String(teamName));
        
        if (isSuperstructureTeam && !isPavukTeam) {
            let groupChar = getGroupLastChar(teamGroupName);
            if (!groupChar) groupChar = getGroupLastChar(teamName);

            if (groupChar) {
                const datesSet = new Set();
                (matchesBufferRef.current || []).forEach((m) => {
                    if (cleanCategory(m.category) !== cleanCategory(category)) return;
                    const matchGroup = m.groupName ? String(m.groupName).trim() : null;
                    if (!matchGroup) return;
                    if (!groupBelongsToChar(matchGroup, groupChar)) return;

                    let dayKey = null;
                    if (m.scheduledTime) {
                        const mm = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(m.scheduledTime);
                        if (mm) {
                            const d = String(mm[1]).padStart(2, '0');
                            const mo = String(mm[2]).padStart(2, '0');
                            const y = mm[3];
                            dayKey = `${y}-${mo}-${d}`;
                        }
                    }
                    if (!dayKey && m.scheduledTs != null) {
                        const dt = new Date(m.scheduledTs);
                        dayKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                    }
                    if (!dayKey) return;
                    datesSet.add(dayKey);
                });

                const formattedDates = [...datesSet].sort().map((dk) => formatDateDDMMYYYY(dk) || dk);
                lines.push(`     [superstructure] Písmeno skupiny: "${groupChar}" – jedinečné dátumy zápasov v skupinách s týmto písmenom:`);
                if (formattedDates.length === 0) lines.push('       (žiadne dátumy)');
                else formattedDates.forEach((d) => lines.push(`       • ${d}`));
            }
        }

        let lastPrintedDayKey = null;
        events.forEach((ev) => {
            const currentDayKey = extractDayKeyFromWhen(ev.when);
            if (currentDayKey && currentDayKey !== lastPrintedDayKey) {
                lines.push('');
                const dayLabel = formatDateDDMMYYYY(currentDayKey) || currentDayKey;
                lines.push(`───── ${dayLabel} ─────`);
                lastPrintedDayKey = currentDayKey;
            }

            let icon = '•';
            if (ev.type === 'match') icon = '🏑';
            else if (ev.type === 'catering') icon = '🍽';
            else if (ev.type === 'arrival') icon = '🚌';
            else if (ev.type === 'accommodation') icon = '🛏';
            else if (ev.type === 'group') icon = '📂';
            else if (ev.type === 'transfer') icon = '🚐';

            const when = ev.when || '—';
            lines.push(`     ${icon} ${when}  |  ${ev.text}`);
        });

        return lines;
    };

    // ============================================================
    // GLOBÁLNA FUNKCIA – výpis časovej osi konkrétneho tímu do konzoly
    // ============================================================
    window.printTeamTimeline = (teamName) => {
        if (!teamName || typeof teamName !== 'string') {
            return;
        }

        const targetTeam = teamName.trim();
        const originalLog = console.log;
        const captured = []; // { text, css } – css môže byť null
        let found = false;
        let captureDone = false;

        console.log = (...args) => {
            // Zisti, či ide o %c formátovaný výpis
            let cleanText;
            let css = null;

            const firstArg = args[0];
            if (typeof firstArg === 'string' && firstArg.startsWith('%c')) {
                cleanText = firstArg.replace(/^%c/, '');
                // Druhý argument je CSS štýl
                if (args.length > 1 && typeof args[1] === 'string') {
                    css = args[1];
                }
            } else {
                cleanText = args.map(String).join(' ');
            }

            if (!found && cleanText.includes(`Tím: ${targetTeam} `)) {
                found = true;
                captured.push({ text: cleanText, css });
                return;
            }

            if (found && !captureDone) {
                // Ak narazíme na ďalší tím alebo kategóriu, ukončíme zachytávanie
                if (
                    cleanText.includes('[TRANSPORT] Tím: ') ||
                    cleanText.includes('[TRANSPORT] ██ Kategória:')
                ) {
                    captureDone = true;
                    return;
                }
                captured.push({ text: cleanText, css });
            }
        };

        try {
            rebuildAndLogTimeline(true); 
        } finally {
            console.log = originalLog;
        }

        if (!found) {
            console.warn(`[TRANSPORT] Tím "${targetTeam}" sa nenašiel v časovej osi.`);
            return;
        }

        // Vypíšeme zachytené riadky s pôvodnými farbami
        captured.forEach(({ text, css }) => {
            if (css) {
                console.log('%c' + text, css);
            } else {
                console.log(text);
            }
        });
    };

    // ============================================================
    // ZBUILDÍ A VYPÍŠE ČASOVÚ OS PRE KAŽDÝ TÍM V KAŽDEJ KATEGÓRII
    // ============================================================
    const rebuildAndLogTimeline = (force = false, categoryFilter = null) => {
        if (!force && !timelineGenerationRequestedRef.current) return;
        if (!matchesLoadedRef.current || !cateringLoadedRef.current || !teamsLoadedRef.current) return;
        if (!teamsLookupLoadedRef.current) return;
        if (!travelTimesLoaded) {
            console.log('[TRANSPORT] rebuildAndLogTimeline: čakám na načítanie travelTimes');
            return;
        }

        const normalizedFilter = categoryFilter ? cleanCategory(categoryFilter) : null;
    
        const grouped = {};
        const accommodationByTeam = {};
        const arrivalTypeByTeam = {};
        const arrivalTimeByTeam = {};
        const superstructureInfoByTeam = {};
        const teamsByGroup = {};
    
        // Nájdi zastávku označenú ako nástupnú pre externé tímy
        const externalArrivalStop = (() => {
            const fromAllPlaces = (allPlacesRef.current || []).find((p) => p.isExternalArrivalStop === true);
            if (fromAllPlaces) return fromAllPlaces;
            const fromStops = (stopsList || []).find((p) => p.isExternalArrivalStop === true);
            if (fromStops) return fromStops;
            return null;
        })();

        const meetingPointStop = (() => {
            const fromAllPlaces = (allPlacesRef.current || []).find((p) => p.isMeetingPointStop === true);
            if (fromAllPlaces) return fromAllPlaces;
            const fromStops = (stopsList || []).find((p) => p.isMeetingPointStop === true);
            if (fromStops) return fromStops;
            return null;
        })();
    
        const ensure = (category, teamName) => {
            if (!grouped[category]) grouped[category] = {};
            if (!grouped[category][teamName]) grouped[category][teamName] = [];
            return grouped[category][teamName];
        };
    
        const formatFullFromTs = (ts) => {
            if (ts == null || !isFinite(ts)) return null;
            return formatDateTime(new Date(ts));
        };
    
        // 1) TÍMY
        teamsArrivalBufferRef.current.forEach((t) => {
            const arr = ensure(t.category, t.teamName);
    
            if (t.isSuperstructure) {
                if (!superstructureInfoByTeam[t.category]) superstructureInfoByTeam[t.category] = {};
                const lastChar = t.teamName ? t.teamName.trim().slice(-1).toUpperCase() : null;
                superstructureInfoByTeam[t.category][t.teamName] = {
                    isSuperstructure: true,
                    groupName: t.groupName,
                    lastChar,
                };
            }
    
            if (t.groupName) {
                if (!teamsByGroup[t.category]) teamsByGroup[t.category] = {};
                if (!teamsByGroup[t.category][t.groupName]) teamsByGroup[t.category][t.groupName] = new Set();
                teamsByGroup[t.category][t.groupName].add(t.teamName);
            }
    
            if (t.accommodationName) {
                if (!accommodationByTeam[t.category]) accommodationByTeam[t.category] = {};
                accommodationByTeam[t.category][t.teamName] = t.accommodationName;
            }
    
            if (t.arrivalType) {
                if (!arrivalTypeByTeam[t.category]) arrivalTypeByTeam[t.category] = {};
                arrivalTypeByTeam[t.category][t.teamName] = t.arrivalType;
            }
    
            if (t.arrivalTime) {
                if (!arrivalTimeByTeam[t.category]) arrivalTimeByTeam[t.category] = {};
                arrivalTimeByTeam[t.category][t.teamName] = t.arrivalTime;
            }
    
            if (t.groupName) {
                const orderStr = t.order != null ? `, poradie ${t.order}` : '';

                const groupKey = `${cleanCategory(t.category)}|${String(t.groupName).trim()}`;
                const fromSuperstructure = superstructureGroupsRef.current[groupKey];

                const teamsInThisGroup = (() => {
                    if (fromSuperstructure && fromSuperstructure.size > 0) {
                        return [...fromSuperstructure].sort((a, b) =>
                            a.localeCompare(b, 'sk', { sensitivity: 'base' })
                        );
                    }
                    return [];
                })();
            
                let teamsListStr = '';
                if (teamsInThisGroup.length > 0) {
                    teamsListStr = '\n       • ' + teamsInThisGroup.join('\n       • ');
                } else {
                    teamsListStr = '\n       (žiadne tímy)';
                }
            
                arr.push({
                    ts: -Infinity,
                    startTs: null,
                    endTs: null,
                    when: '—',
                    type: 'group',
                    text: `Kategória: ${t.category}, Skupina: ${t.groupName}${orderStr}${teamsListStr}`,
                    location: null,
                });
            }
    
            if (t.accommodationName) {
                arr.push({
                    ts: -Infinity,
                    startTs: null,
                    endTs: null,
                    when: '—',
                    type: 'accommodation',
                    text: `Ubytovanie: ${t.accommodationName} (typ: ${t.accommodationType || 'neurčený'})`,
                    location: t.accommodationName,
                });
            }
    
            if (t.arrivalDisplay && t.arrivalDisplay !== '---') {
                arr.push({
                    ts: -Infinity,
                    startTs: null,
                    endTs: null,
                    when: '—',
                    type: 'arrival',
                    text: `Doprava / príchod: ${t.arrivalDisplay}`,
                    location: null,
                });
            }
        });
    
        // 2) ZÁPASY
        matchesBufferRef.current.forEach((m) => {
            const timeRange = m.scheduledTime
                ? (m.scheduledEndTime ? `${m.scheduledTime} – ${m.scheduledEndTime}` : m.scheduledTime)
                : 'nenaplánované';
            const text = `${m.home} vs ${m.away}${m.special}${m.hallName ? ` | ${m.hallName}` : ''}`;
    
            const startTs = m.scheduledTs ?? null;
            const endTs = m.scheduledEndTs ?? startTs;
    
            ensure(m.category, m.home).push({
                ts: m.scheduledTs ?? Number.POSITIVE_INFINITY,
                startTs,
                endTs,
                when: timeRange,
                type: 'match',
                text,
                location: m.hallName || null,
            });
            if (m.away !== m.home) {
                ensure(m.category, m.away).push({
                    ts: m.scheduledTs ?? Number.POSITIVE_INFINITY,
                    startTs,
                    endTs,
                    when: timeRange,
                    type: 'match',
                    text,
                    location: m.hallName || null,
                });
            }
    
            if (m.groupName) {
                const cat = m.category;
                const grp = String(m.groupName).trim();
                if (!teamsByGroup[cat]) teamsByGroup[cat] = {};
                if (!teamsByGroup[cat][grp]) teamsByGroup[cat][grp] = new Set();
                if (m.home) teamsByGroup[cat][grp].add(m.home);
                if (m.away) teamsByGroup[cat][grp].add(m.away);
            }
        });
    
        // 3) STRAVOVANIA
        cateringBufferRef.current.forEach((c) => {
            const flags = [];
            if (c.isPriority) flags.push('PRIORITA');
            const flagStr = flags.length ? ` [${flags.join(', ')}]` : '';
            const mealLabel = c.mealType === 'lunch' ? 'Obed' : c.mealType === 'dinner' ? 'Večera' : c.mealType;
    
            const superstructureStr = c.isSuperstructure
                ? ` ${c.superstructureTeamName}`
                : '';
    
            const formattedDay = c.dayKey ? (formatDateDDMMYYYY(c.dayKey) || c.dayKey) : '?';
            const timeRange = c.slotFrom
                ? (c.slotTo ? `${c.slotFrom} – ${c.slotTo}` : c.slotFrom)
                : '--:--';
    
            const startTs = c.ts ?? null;
            const endTs = c.slotToTs ?? startTs;
    
            ensure(c.category, c.teamName).push({
                ts: c.ts ?? Number.POSITIVE_INFINITY,
                startTs,
                endTs,
                when: ` ${formattedDay} ${timeRange}`.trim(),
                type: 'catering',
                text: `${mealLabel} (${timeRange}) → ${c.placeName}${superstructureStr}${flagStr}`,
                location: c.placeName || null,
            });
        });
    
        const extractDayKeyFromWhen = (when) => {
            if (!when) return null;
            const m = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(when);
            if (!m) return null;
            const d = String(m[1]).padStart(2, '0');
            const mo = String(m[2]).padStart(2, '0');
            const y = m[3];
            return `${y}-${mo}-${d}`;
        };
    
        const timestampOnDay = (dayRefTs, hh, mm) => {
            if (dayRefTs == null || !isFinite(dayRefTs)) return null;
            const d = new Date(dayRefTs);
            if (isNaN(d.getTime())) return null;
            return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm, 0, 0).getTime();
        };
    
        const midnightFromWhen = (when) => {
            if (!when) return null;
            const m = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(when);
            if (!m) return null;
            const day = Number(m[1]);
            const month = Number(m[2]) - 1;
            const year = Number(m[3]);
            const d = new Date(year, month, day, 0, 0, 0, 0);
            return isNaN(d.getTime()) ? null : d.getTime();
        };
    
        const buildTransferText = (
            fromEvent,
            toEvent,
            fromLabel,
            toLabel,
            arrivalOnly = false,
            overrideDepartureStr = null,
            overrideArrivalStr = null
        ) => {
            const arrivalTs = toEvent && toEvent.startTs != null ? toEvent.startTs : null;
            const computedArrivalStr = formatFullFromTs(arrivalTs) || '—';
            const arrivalStr = overrideArrivalStr != null ? overrideArrivalStr : computedArrivalStr;
    
            if (arrivalOnly) {
                return `Presun z ${fromLabel} do ${toLabel} (príchod: ${arrivalStr})`;
            }
    
            const departureTs = fromEvent && fromEvent.endTs != null ? fromEvent.endTs : (fromEvent ? fromEvent.startTs : null);
            const computedDepartureStr = formatFullFromTs(departureTs) || '—';
            const departureStr = overrideDepartureStr != null ? overrideDepartureStr : computedDepartureStr;
    
            return `Presun z ${fromLabel} do ${toLabel}`;
        };
    
        console.log('[TRANSPORT] ===== ČASOVÁ OS UDALOSTÍ PRE KAŽDÝ TÍM =====');
    
        const globalFirstDay = (() => {
            const keys = [];
            Object.values(grouped).forEach((teamsObj) => {
                Object.values(teamsObj).forEach((events) => {
                    events.forEach((ev) => {
                        const dk = extractDayKeyFromWhen(ev.when);
                        if (dk) keys.push(dk);
                    });
                });
            });
            if (keys.length === 0) return null;
            keys.sort();
            return keys[0];
        })();    

        const globalLastDay = (() => {
            const keys = [];
            Object.values(grouped).forEach((teamsObj) => {
                Object.values(teamsObj).forEach((events) => {
                    events.forEach((ev) => {
                        const dk = extractDayKeyFromWhen(ev.when);
                        if (dk) keys.push(dk);
                    });
                });
            });
            if (keys.length === 0) return null;
            keys.sort();
            return keys[keys.length - 1];
        })();        

        // ============================================================
        // Pomocná funkcia – zisti písmeno skupiny (posledné A-Z písmeno)
        // Príklady:
        //   "skupina B"  → "B"
        //   "skupina 1B" → "B"
        //   "CH B"       → "B"
        //   "U12 D 5B"   → "B"
        // ============================================================
        const getGroupLastChar = (groupNameOrTeamName) => {
            if (!groupNameOrTeamName) return null;
            const s = String(groupNameOrTeamName).trim();
            if (!s) return null;
            // Nájdi posledné veľké písmeno A-Z / Á-Ž
            const m = /([A-ZÁ-Ž])(?=[^A-ZÁ-Ž]*$)/.exec(s.toUpperCase());
            if (m) return m[1];
            return null;
        };

        // ============================================================
        // Pomocná funkcia – zisti, či skupina patrí pod dané písmeno
        // (napr. skupina "skupina 1B" patrí pod písmeno "B")
        // ============================================================
        const groupBelongsToChar = (groupName, char) => {
            if (!groupName || !char) return false;
            const gChar = getGroupLastChar(groupName);
            return gChar === char;
        };
    
        // ============================================================
        // NOVÉ: Pomocná funkcia – získa skupinu pre superstructure tím
        // ============================================================
        const getGroupForSuperstructureTeam = (category, teamName) => {
            // Skús nájsť skupinu z teamsByGroup
            const groups = teamsByGroup[category] || {};
            for (const [gName, teamSet] of Object.entries(groups)) {
                if (teamSet.has(teamName)) return gName;
            }
            return null;
        };
    
        const categories = Object.keys(grouped).sort((a, b) =>
            a.localeCompare(b, 'sk', { sensitivity: 'base' })
        );
    
        if (categories.length === 0) {
            console.log('[TRANSPORT] Žiadne udalosti.');
        } else {
            // ============================================================
            // Pre každý superstructure tím zisti zoznam jeho "hráčských"
            // dátumov (dni, kedy sa hrá akýkoľvek zápas v skupinách s jeho
            // písmenom). Použije sa neskôr pri generovaní ranných presunov.
            // ============================================================
            const ssPlayDatesByTeam = {}; // key: category|teamName → Set(dayKey)
            const ssGroupCharByTeam = {}; // key: category|teamName → char

            (teamsArrivalBufferRef.current || []).forEach((t) => {
                if (!t.isSuperstructure) return;
                if (!t.teamName) return;

                let char = getGroupLastChar(t.groupName);
                if (!char) char = getGroupLastChar(t.teamName);
                if (!char) return;

                const key = `${cleanCategory(t.category)}|${t.teamName}`;
                ssGroupCharByTeam[key] = char;
                if (!ssPlayDatesByTeam[key]) ssPlayDatesByTeam[key] = new Set();
            });

            // NOVÉ: množina názvov superstructure tímov (celý názov) → rýchle vyhľadanie
            const superstructureTeamNames = new Set();
            (teamsArrivalBufferRef.current || []).forEach((t) => {
                if (t.isSuperstructure && t.teamName) {
                    superstructureTeamNames.add(t.teamName);
                }
            });

            // Naplň dátumy
            Object.keys(ssGroupCharByTeam).forEach((key) => {
                const [cat, teamName] = key.split('|');
                const char = ssGroupCharByTeam[key];
                const set = ssPlayDatesByTeam[key];
            
                matchesBufferRef.current.forEach((m) => {
                    if (cleanCategory(m.category) !== cleanCategory(cat)) return;
            
                    // ============================================================
                    // NOVÉ: Zápas patrí do skupiny s daným písmenom LEN ak:
                    //  1) Má vyplnené `groupName` (t.j. je to skupinový zápas, NIE pavúkový)
                    //  2) A zároveň to `groupName` patrí pod dané písmeno
                    //     (napr. "skupina B" → "B", "skupina 1B" → "B")
                    //
                    // Tým sa zabezpečí, že pavúkové zápasy (bez groupName) sa
                    // NEPOČÍTAJÚ do hracích dní skupiny. To je dôležité pre
                    // generovanie ranných presunov z ubytovní – tie sa majú
                    // generovať pre dni, kedy tím hrá LEN skupinový zápas,
                    // nie pavúkový.
                    // ============================================================
                    const matchGroupName = m.groupName ? String(m.groupName).trim() : null;
                    if (!matchGroupName) return; // pavúkový zápas – nepočítaj
                    if (!groupBelongsToChar(matchGroupName, char)) return;
            
                    let dayKey = null;
                    if (m.scheduledTime) {
                        const mm = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(m.scheduledTime);
                        if (mm) {
                            const d = String(mm[1]).padStart(2, '0');
                            const mo = String(mm[2]).padStart(2, '0');
                            const y = mm[3];
                            dayKey = `${y}-${mo}-${d}`;
                        }
                    }
                    if (!dayKey && m.scheduledTs != null) {
                        const dt = new Date(m.scheduledTs);
                        dayKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                    }
                    if (!dayKey) return;
            
                    set.add(dayKey);
                });
            });
    
            categories.forEach((category) => {
                if (normalizedFilter && cleanCategory(category) !== normalizedFilter) return;
                console.log(`\n[TRANSPORT] ██ Kategória: ${category} ██`);
                const teams = Object.keys(grouped[category]).sort((a, b) =>
                    a.localeCompare(b, 'sk', { sensitivity: 'base' })
                );
    
                teams.forEach((teamName) => {
                    const events = grouped[category][teamName];
    
                    events.sort((a, b) => {
                        if (a.ts !== b.ts) return a.ts - b.ts;
                        return String(a.text).localeCompare(String(b.text), 'sk');
                    });
    
                    const accommodationName =
                        (accommodationByTeam[category] && accommodationByTeam[category][teamName]) || null;
                    const teamArrivalType =
                        (arrivalTypeByTeam[category] && arrivalTypeByTeam[category][teamName]) || '';
    
                    const enriched = [];
    
                    const ssInfo = superstructureInfoByTeam[category] && superstructureInfoByTeam[category][teamName];

                    // ============================================================
                    // Zisti skupinu tímu – buď z ssInfo, alebo z názvu tímu (posledné písmeno)
                    // ============================================================
                    const teamGroupName = (() => {
                        if (ssInfo && ssInfo.groupName) return ssInfo.groupName;
                        const g = getGroupForSuperstructureTeam(category, teamName);
                        if (g) return g;
                        if (ssInfo && ssInfo.lastChar) return `skupina ${ssInfo.lastChar}`;
                        
                        // NOVÉ: Skús odvodiť skupinu z názvu tímu (napr. "U12 CH 5B" → "skupina B")
                        // Toto je potrebné pre superstructure tímy, ktoré sú v users (majú ubytovanie),
                        // ale nemajú groupName v DB.
                        const nameMatch = /\d([A-ZÁ-Ž])\s*$/.exec(String(teamName).trim());
                        if (nameMatch) {
                            const lastChar = nameMatch[1];
                            // Over, či existuje skupina s týmto posledným písmenom v tejto kategórii
                            const groups = teamsByGroup[category] || {};
                            for (const [gName, teamSet] of Object.entries(groups)) {
                                const gLastChar = gName.trim().slice(-1).toUpperCase();
                                if (gLastChar === lastChar) return gName;
                            }
                            // Ak neexistuje, použi aspoň "skupina X"
                            return `skupina ${lastChar}`;
                        }
                        
                        return null;
                    })();

                    const isSuperstructureTeam = (() => {
                        if (ssInfo && ssInfo.isSuperstructure) return true;
                        // Ak tím nie je v users vôbec, je to superstructure
                        const inUsers = teamsArrivalBufferRef.current.some(
                            (t) => cleanCategory(t.category) === cleanCategory(category)
                                && t.teamName === teamName
                                && t.isRegistered === true
                        );
                        if (!inUsers) return true;
                        // Ak tím je v users, ale má v názve posledné písmeno (napr. "5B"), je to superstructure
                        // (bol pridaný do users len kvôli ubytovaniu)
                        if (/\d[A-ZÁ-Ž]\s*$/.test(String(teamName).trim())) return true;
                        return false;
                    })();

                    // ============================================================
                    // NOVÉ: Pre superstructure tím, ktorý NEMÁ udalosť v deň,
                    // kedy skupina hrá (ale má udalosť v nasledujúci deň), vygeneruj
                    // ranné presuny z ubytovní tímov zo skupiny na miesto prvej
                    // udalosti tímu v nasledujúci deň.
                    //
                    // Príklad: tím "U12 CH 4D" nemá udalosť 26.12.2026 (skupina D hrá),
                    // ale má udalosť 27.12.2026 08:38 Javorku. Vygeneruj presuny
                    // z ubytovní tímov zo skupiny D (1A, 1B, 2A, 3B) na Javorku.
                    // ============================================================
                    if (isSuperstructureTeam) {
                        const ssTeamKeyPre = `${cleanCategory(category)}|${teamName}`;
                        const groupCharPre = ssGroupCharByTeam[ssTeamKeyPre];
                    
                        if (groupCharPre && ssPlayDatesByTeam[ssTeamKeyPre]) {                    
                            const groupPlayDays = [...ssPlayDatesByTeam[ssTeamKeyPre]].sort();                            
                    
                            groupPlayDays.forEach((groupPlayDay) => {
                                // Zisti, či tím má udalosť v daný deň (z events AJ z matches/catering)
                                const teamHasEventOnDay = (() => {
                                    const fromEvents = events.some((ev) => extractDayKeyFromWhen(ev.when) === groupPlayDay);
                                    if (fromEvents) return true;
                                    const fromMatches = (matchesBufferRef.current || []).some((m) => {
                                        if (cleanCategory(m.category) !== cleanCategory(category)) return false;
                                        if (m.home !== teamName && m.away !== teamName) return false;
                                        let dk = null;
                                        if (m.scheduledTime) {
                                            const mm = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(m.scheduledTime);
                                            if (mm) dk = `${mm[3]}-${String(mm[2]).padStart(2, '0')}-${String(mm[1]).padStart(2, '0')}`;
                                        }
                                        if (!dk && m.scheduledTs != null) {
                                            const dt = new Date(m.scheduledTs);
                                            dk = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                                        }
                                        return dk === groupPlayDay;
                                    });
                                    if (fromMatches) return true;
                                    const fromCatering = (cateringBufferRef.current || []).some((c) => {
                                        if (cleanCategory(c.category) !== cleanCategory(category)) return false;
                                        if (c.teamName !== teamName) return false;
                                        return c.dayKey === groupPlayDay;
                                    });
                                    return fromCatering;
                                })();
                                
                                if (teamHasEventOnDay) return;

                                // NOVÉ: NEGENERUJ presuny z ubytovní pre dni PRED prvou udalosťou tímu
                                const firstTeamEventDay = (() => {
                                    let first = null;
                                    events.forEach((ev) => {
                                        const d = extractDayKeyFromWhen(ev.when);
                                        if (d && (first == null || d < first)) first = d;
                                    });
                                    return first;
                                })();
                                
                                if (firstTeamEventDay != null && groupPlayDay < firstTeamEventDay) {
                                    return; // deň pred prvou udalosťou – neriešime tu
                                }
                    
                                // Nájdi prvú udalosť tímu v nasledujúcom dni (po groupPlayDay)
                                let destEvent = null;
                                const sortedTeamEvents = [...events].sort((a, b) => {
                                    if (a.ts !== b.ts) return a.ts - b.ts;
                                    return String(a.text).localeCompare(String(b.text), 'sk');
                                });
                                for (const ev of sortedTeamEvents) {
                                    const evDay = extractDayKeyFromWhen(ev.when);
                                    if (evDay && evDay > groupPlayDay) {
                                        destEvent = ev;
                                        break;
                                    }
                                }
                                if (!destEvent || !destEvent.location) return;
                    
                                const destination = destEvent.location;
                    
                                // Pomocné funkcie
                                // ============================================================
                                // Pomocná: zisti, či tím patrí do skupiny s daným písmenom.
                                // Kontrola cez groupName, alebo fallback cez názov tímu.
                                // ============================================================
                                const teamBelongsToCharPre = (tn) => {
                                    if (!tn) return false;
                                    if (String(tn).startsWith('(row team:')) return false;
                                    // Fallback: odvoď z názvu tímu (napr. "U12 CH 2B" → "B")
                                    const nameMatch = /\d([A-ZÁ-Ž])\s*$/.exec(String(tn).trim());
                                    if (nameMatch && nameMatch[1].toUpperCase() === groupCharPre) {
                                        return true;
                                    }
                                    // Skús cez groupName v teamsArrivalBufferRef
                                    const teamInfo = (teamsArrivalBufferRef.current || []).find(
                                        (t) => cleanCategory(t.category) === cleanCategory(category) && t.teamName === tn
                                    );
                                    if (teamInfo && teamInfo.groupName) {
                                        return groupBelongsToChar(teamInfo.groupName, groupCharPre);
                                    }
                                    return false;
                                };
                    
                                // Zisti, či je to prvý hrací deň tímu
                                const firstPlayDayPre = (() => {
                                    let firstDayKey = null;
                                    events.forEach((ev) => {
                                        const evDay = extractDayKeyFromWhen(ev.when);
                                        if (!evDay) return;
                                        if (firstDayKey == null || evDay < firstDayKey) {
                                            firstDayKey = evDay;
                                        }
                                    });
                                    return firstDayKey;
                                })();
                    
                                const isFirstPlayDayPre = firstPlayDayPre != null && groupPlayDay === firstPlayDayPre;
                    
                                // Zber zdrojov
                                const uniqueSourceLocationsPre = new Map();
                                const updateUniqueSourcePre = (loc, endTs) => {
                                    if (!loc) return;
                                    if (loc === destination) return;
                                    const existing = uniqueSourceLocationsPre.get(loc);
                                    if (!existing || (endTs != null && endTs > (existing.endTs ?? -Infinity))) {
                                        uniqueSourceLocationsPre.set(loc, { location: loc, endTs });
                                    }
                                };
                    
                                // PRVÝ hrací deň tímu → miesta posledných udalostí tímov zo skupiny
                                if (isFirstPlayDayPre) {
                                    // Zápasy
                                    matchesBufferRef.current.forEach((m) => {
                                        if (cleanCategory(m.category) !== cleanCategory(category)) return;
                                        let dayKey = null;
                                        if (m.scheduledTime) {
                                            const mm = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(m.scheduledTime);
                                            if (mm) {
                                                const d = String(mm[1]).padStart(2, '0');
                                                const mo = String(mm[2]).padStart(2, '0');
                                                const y = mm[3];
                                                dayKey = `${y}-${mo}-${d}`;
                                            }
                                        }
                                        if (!dayKey && m.scheduledTs != null) {
                                            const dt = new Date(m.scheduledTs);
                                            dayKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                                        }
                                        if (!dayKey || dayKey !== groupPlayDay) return;
                                        const endTs = m.scheduledEndTs != null
                                            ? m.scheduledEndTs
                                            : (m.scheduledTs != null ? m.scheduledTs : null);
                                        [m.home, m.away].forEach((tn) => {
                                            if (!tn) return;
                                            if (tn === teamName) return;
                                            if (!isRealRegisteredTeamPre(tn)) return;
                                            if (!teamBelongsToCharPre(tn)) return;
                                            updateUniqueSourcePre(m.hallName || null, endTs);
                                        });
                                    });
                                    // Stravovania
                                    cateringBufferRef.current.forEach((c) => {
                                        if (cleanCategory(c.category) !== cleanCategory(category)) return;
                                        if (c.isSuperstructure === true) return;
                                        const dayKey = c.dayKey || null;
                                        if (!dayKey || dayKey !== groupPlayDay) return;
                                        const tn = c.teamName;
                                        if (!tn) return;
                                        if (tn === teamName) return;
                                        if (!isRealRegisteredTeamPre(tn)) return;
                                        if (!teamBelongsToCharPre(tn)) return;
                                        const endTs = c.slotToTs != null ? c.slotToTs : (c.ts != null ? c.ts : null);
                                        updateUniqueSourcePre(c.placeName || null, endTs);
                                    });
                                } else {
                                    // Deň, kedy skupina hrá, ale tím nemá udalosť → ubytovania
                                    // tímov zo skupiny s rovnakým písmenom (z posledného písmena názvu tímu).
                                    (teamsArrivalBufferRef.current || []).forEach((t) => {
                                        if (cleanCategory(t.category) !== cleanCategory(category)) return;
                                        if (!t.teamName) return;
                                        if (t.teamName === teamName) return;
                                        if (!t.accommodationName || t.accommodationName.trim() === '') return;
                                        if (!teamBelongsToCharPre(t.teamName)) return;
                                        updateUniqueSourcePre(t.accommodationName.trim(), null);
                                    });
                                }
                    
                                if (uniqueSourceLocationsPre.size === 0) return;
                    
                                const destinationArrivalStr =
                                    formatFullFromTs(destEvent.startTs) || destEvent.when;
                                const dayRefTs = destEvent.startTs != null
                                    ? destEvent.startTs
                                    : midnightFromWhen(destEvent.when);
                                const departureTs = timestampOnDay(dayRefTs, 0, 0);
                                const departureStr = formatFullFromTs(departureTs) || '00:00';
                    
                                Array.from(uniqueSourceLocationsPre.values())
                                    .sort((a, b) => {
                                        if (a.endTs != null && b.endTs != null) return a.endTs - b.endTs;
                                        return String(a.location).localeCompare(String(b.location), 'sk');
                                    })
                                    .forEach((info) => {
                                        let whenStr;
                                        if (departureStr && destinationArrivalStr) {
                                            whenStr = `${departureStr} – ${destinationArrivalStr}`;
                                        } else if (destinationArrivalStr) {
                                            whenStr = destinationArrivalStr;
                                        } else {
                                            whenStr = destEvent.when;
                                        }
                                        enriched.push({
                                            ts: destEvent.ts - 1,
                                            when: whenStr,
                                            type: 'transfer',
                                            text: `Presun z ${info.location} do ${destination}`,
                                            location: null,
                                            isTransfer: true,
                                        });
                                    });
                            });
                        }
                    }
    
                    for (let i = 0; i < events.length; i++) {
                        const current = events[i];
                        const prev = events[i - 1];
                        const next = events[i + 1];
                    
                        const currentDay = extractDayKeyFromWhen(current.when);
                        const prevDay = prev ? extractDayKeyFromWhen(prev.when) : null;
                        const nextDay = next ? extractDayKeyFromWhen(next.when) : null;
                    
                        const isFirstEventOfDay =
                            currentDay != null && (prev == null || prevDay == null || prevDay !== currentDay);
                    
                        const isLastEventOfDay =
                            currentDay != null && (next == null || nextDay == null || nextDay !== currentDay);
                    
                        // ============================================================
                        // NOVÉ: Pomocná funkcia – zisti, či tím má vôbec nejaké ubytovanie
                        // ============================================================
                        // Pravidlá:
                        //  - Superstructure tím: VŽDY generuj presuny (ranné aj večerné),
                        //    ak existuje aspoň jedno ubytovanie v jeho skupine (cez cache).
                        //    Ak cache je prázdna, použije sa prázdny zoznam → presuny sa negenerujú
                        //    (nemá z/do čoho ísť).
                        //  - Bežný tím z users: generuj len ak má vyplnené accommodationName.
                        // ============================================================
                    
                        // ============================================================
                        // Zisti, či je tím reálne registrovaný v kolekcii `users`.
                        // ============================================================
                        const teamIsInUsers = teamsArrivalBufferRef.current.some(
                            (t) => cleanCategory(t.category) === cleanCategory(category)
                                && t.teamName === teamName
                                && t.isRegistered === true
                        );

                        // ============================================================
                        // Zoznam ubytovní tímu:
                        //  - Ak je tím REÁLNE v users → použijeme LEN jeho vlastné
                        //    accommodationName (žiadna skupinová cache).
                        //  - Ak tím NIE JE v users (skutočný superstructure) → použijeme
                        //    skupinovú cache ubytovní.
                        // ============================================================
                        const teamAccommodationsList = (() => {
                            if (teamIsInUsers) {
                                // Registrovaný tím – vždy len vlastné ubytovanie
                                return accommodationName && accommodationName.trim() !== ''
                                    ? [accommodationName]
                                    : [];
                            }
                            // Superstructure tím (nie je v users) – skupinová cache
                            if (teamGroupName) {
                                const lastCharMatch = /\d([A-ZÁ-Ž])\s*$/.exec(String(teamName).trim());
                                const derivedGroupName = lastCharMatch
                                    ? `skupina ${lastCharMatch[1].toUpperCase()}`
                                    : teamGroupName;
                                if (!derivedGroupName) return [];
                                const cacheKey = `${cleanCategory(category)}|${derivedGroupName}`;
                                return (window.__transport_accommodationsByGroup || {})[cacheKey] || [];
                            }
                            return [];
                        })();

                        // ============================================================
                        // PRAVIDLO: Presuny z/do ubytovania sa generujú LEN ak tím
                        // má aspoň jedno ubytovanie v `teamAccommodationsList`.
                        //
                        // To znamená:
                        //  - Registrovaný tím z users bez ubytovania → žiadne presuny.
                        //  - Registrovaný tím z users s ubytovaním → presuny len z/do
                        //    svojho vlastného ubytovania.
                        //  - Superstructure tím (nie je v users) → presuny podľa
                        //    skupinovej cache (ak je prázdna, žiadne presuny).
                        // ============================================================
                        const shouldGenerateAccommodationTransfers = teamAccommodationsList.length > 0;  
                        
                        // A) Začiatok dňa – presun na prvú udalosť dňa.
                        if (isFirstEventOfDay && current.location) {
                        
                            const ssTeamKey = `${cleanCategory(category)}|${teamName}`;
                            const groupCharForSS = ssGroupCharByTeam[ssTeamKey];
                        
                            // ============================================================
                            // Pomocná: zisti, či v danom dni existuje aspoň jeden users tím
                            // v rovnakej skupine (podľa posledného písmena) s nejakou udalosťou.
                            // ============================================================
                            const usersTeamHasEventsOnDay = (() => {
                                if (!groupCharForSS) return false;
                                if (!currentDay) return false;
                        
                                return (teamsArrivalBufferRef.current || []).some((t) => {
                                    if (cleanCategory(t.category) !== cleanCategory(category)) return false;
                                    if (t.isRegistered !== true) return false;
                                    if (t.isSuperstructure === true) return false;
                                    if (!t.groupName) return false;
                                    if (!groupBelongsToChar(t.groupName, groupCharForSS)) return false;
                        
                                    const hasMatch = (matchesBufferRef.current || []).some((m) => {
                                        if (cleanCategory(m.category) !== cleanCategory(category)) return false;
                                        if (m.home !== t.teamName && m.away !== t.teamName) return false;
                        
                                        let dayKey = null;
                                        if (m.scheduledTime) {
                                            const mm = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(m.scheduledTime);
                                            if (mm) {
                                                const d = String(mm[1]).padStart(2, '0');
                                                const mo = String(mm[2]).padStart(2, '0');
                                                const y = mm[3];
                                                dayKey = `${y}-${mo}-${d}`;
                                            }
                                        }
                                        if (!dayKey && m.scheduledTs != null) {
                                            const dt = new Date(m.scheduledTs);
                                            dayKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                                        }
                                        return dayKey === currentDay;
                                    });
                        
                                    if (hasMatch) return true;
                        
                                    const hasCatering = (cateringBufferRef.current || []).some((c) => {
                                        if (cleanCategory(c.category) !== cleanCategory(category)) return false;
                                        if (c.isSuperstructure === true) return false;
                                        if (c.teamName !== t.teamName) return false;
                                        return c.dayKey === currentDay;
                                    });
                        
                                    return hasCatering;
                                });
                            })();
                        
                            const currentTeamHasOwnEventOnDay = (() => {
                                if (!currentDay) return false;
                            
                                // 1) Zápasy aktuálneho tímu v daný deň
                                const hasMatch = (matchesBufferRef.current || []).some((m) => {
                                    if (cleanCategory(m.category) !== cleanCategory(category)) return false;
                                    if (m.home !== teamName && m.away !== teamName) return false;
                            
                                    let dayKey = null;
                                    if (m.scheduledTime) {
                                        const mm = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(m.scheduledTime);
                                        if (mm) {
                                            const d = String(mm[1]).padStart(2, '0');
                                            const mo = String(mm[2]).padStart(2, '0');
                                            const y = mm[3];
                                            dayKey = `${y}-${mo}-${d}`;
                                        }
                                    }
                                    if (!dayKey && m.scheduledTs != null) {
                                        const dt = new Date(m.scheduledTs);
                                        dayKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                                    }
                                    return dayKey === currentDay;
                                });
                            
                                if (hasMatch) return true;
                            
                                // 2) Stravovania aktuálneho tímu v daný deň
                                const hasCatering = (cateringBufferRef.current || []).some((c) => {
                                    if (cleanCategory(c.category) !== cleanCategory(category)) return false;
                                    if (c.teamName !== teamName) return false;
                                    return c.dayKey === currentDay;
                                });
                            
                                return hasCatering;
                            })();
                            
                            const isSSPlayDay =
                                isSuperstructureTeam &&
                                ssPlayDatesByTeam[ssTeamKey] &&
                                currentDay != null &&
                                ssPlayDatesByTeam[ssTeamKey].has(currentDay);

                            const isSSLastDayWithUsers =
                                !isSSPlayDay &&
                                isSuperstructureTeam &&
                                currentDay != null &&
                                globalLastDay != null &&
                                currentDay === globalLastDay &&
                                groupCharForSS != null &&
                                usersTeamHasEventsOnDay;

                            // ============================================================
                            // NOVÉ PRAVIDLO:
                            // Ak je aktuálny deň v zozname hracích dní skupiny (t.j. deň,
                            // kedy hrá akýkoľvek tím zo skupiny s daným písmenom – bez ohľadu
                            // na to, či aktuálny tím má vlastnú udalosť), MUSÍ sa použiť
                            // skupinová logika (presuny z miest posledných udalostí tímov
                            // zo skupiny). NEgenerujeme ranný presun z ubytovní.
                            //
                            // Tým sa zabezpečí, že pre tím "U12 CH 5A" dňa 26.12.2026
                            // (kedy skupina A hrá) sa nevygeneruje "Presun z ubytovania
                            // Rosinská do UNIZA", ale presuny z miest posledných udalostí
                            // tímov zo skupiny A (napr. Javorku, SOŠ Stavebná, UNIZA).
                            // ============================================================
                            const useGroupBasedMorningTransfers =
                                isSuperstructureTeam &&
                                currentDay != null &&
                                groupCharForSS != null &&
                                (
                                    // Hlavná podmienka: deň je v zozname hracích dní skupiny
                                    isSSPlayDay ||
                                    // Alebo posledný deň turnaja s users tímami
                                    isSSLastDayWithUsers ||
                                    // Alebo existuje aspoň jeden users tím v skupine s udalosťou
                                    usersTeamHasEventsOnDay
                                );
                        
                            // ============================================================
                            // Pomocná funkcia: Zisti, či pavúkový tím (identifier obsahujúci WSF/LSF/WQF/...)
                            // má nadväzujúci zápas v pavúku. Ak áno, vráti true (t.j. tím pokračuje inde).
                            // ============================================================
                            const pavukTeamNextMatchInfo = (teamIdentifier, category) => {
                                if (!teamIdentifier || typeof teamIdentifier !== 'string') return null;
                                const s = teamIdentifier.toUpperCase();
                        
                                let targetMatchType = null;
                                const w16 = /W16F(\d{1,2})/.exec(s);
                                const w8 = /W8F(\d{1,2})/.exec(s);
                                const wqf = /WQF(\d{1,2})/.exec(s);
                                const wsf = /WSF(\d{1,2})/.exec(s);
                                const lsf = /LSF(\d{1,2})/.exec(s);
                        
                                if (w16) {
                                    const num = parseInt(w16[1], 10);
                                    targetMatchType = `osemfinále ${Math.ceil(num / 2)}`;
                                } else if (w8) {
                                    const num = parseInt(w8[1], 10);
                                    targetMatchType = `štvrťfinále ${Math.ceil(num / 2)}`;
                                } else if (wqf) {
                                    const num = parseInt(wqf[1], 10);
                                    targetMatchType = `semifinále ${num <= 2 ? 1 : 2}`;
                                } else if (wsf) {
                                    targetMatchType = 'finále';
                                } else if (lsf) {
                                    targetMatchType = 'o 3. miesto';
                                } else {
                                    return null;
                                }
                        
                                const nextMatch = matchesBufferRef.current.find((m) => {
                                    if (cleanCategory(m.category) !== cleanCategory(category)) return false;
                                    return m.matchType === targetMatchType;
                                });
                        
                                if (!nextMatch) {
                                    return { hasNext: false, nextHallId: null, nextHallName: null };
                                }
                        
                                return {
                                    hasNext: true,
                                    nextHallId: nextMatch.hallId || null,
                                    nextHallName: nextMatch.hallName || null,
                                };
                            };
                        
                            // ============================================================
                            // NOVÉ PRAVIDLO PRE GENEROVANIE RANNÝCH PRESUNOV
                            // ============================================================
                            // Ak je splnená podmienka `useGroupBasedMorningTransfers`, vygenerujeme
                            // presuny zo VŠETKÝCH ubytovní tímov, ktoré patria do skupín s rovnakým
                            // písmenom (posledné písmeno názvu tímu), na miesto prvej udalosti
                            // tohto tímu v danom dni.
                            //
                            // To pokrýva aj prípad, kedy superstructure tím (napr. "U12 CH 4D")
                            // hrá v deň, kedy žiadny iný tím z jeho skupiny nemá udalosť – vtedy
                            // sa použijú ubytovania tímov zo skupín s rovnakým písmenom
                            // (napr. A, B pre písmeno D).
                            //
                            // DÔLEŽITÉ: Ak je aktuálny deň v zozname hracích dní skupiny
                            // (ssPlayDatesByTeam), ranné presuny z ubytovní sa NEGENERUJÚ –
                            // namiesto toho sa použijú presuny z miest posledných udalostí
                            // tímov zo skupiny (logika nižšie v kóde).
                            // ============================================================
                            if (useGroupBasedMorningTransfers) {
                                const groupChar = ssGroupCharByTeam[ssTeamKey];
                                
                                // Pomocné funkcie pre zber zdrojov (definované vždy, aby boli dostupné v oboch vetvách)
                                const isRealRegisteredTeam = (tn, category) => {
                                    if (!tn) return false;
                                    if (String(tn).startsWith('(row team:')) return false;
                                    if (superstructureTeamNames.has(tn)) return false;
                                    const info = (teamsArrivalBufferRef.current || []).find(
                                        (t) => cleanCategory(t.category) === cleanCategory(category)
                                            && t.teamName === tn
                                    );
                                    if (!info) return false;
                                    if (info.isRegistered !== true) return false;
                                    if (info.isSuperstructure === true) return false;
                                    return true;
                                };
                            
                                const teamBelongsToChar = (tn, category) => {
                                    if (!tn) return false;
                                    if (!isRealRegisteredTeam(tn, category)) return false;
                                    const teamInfo = (teamsArrivalBufferRef.current || []).find(
                                        (t) => cleanCategory(t.category) === cleanCategory(category) && t.teamName === tn
                                    );
                                    if (teamInfo && teamInfo.groupName) {
                                        return groupBelongsToChar(teamInfo.groupName, groupChar);
                                    }
                                    const m = /\d([A-ZÁ-Ž])\s*$/.exec(String(tn).trim());
                                    if (m && m[1].toUpperCase() === groupChar) return true;
                                    return false;
                                };
                            
                                // ============================================================
                                // Zisti, či v danom dni (currentDay) existuje ASPOŇ JEDEN iný tím
                                // zo skupiny s rovnakým písmenom, ktorý má udalosť (zápas/stravovanie).
                                // ============================================================
                                const groupHasAnyEventOnCurrentDay = (() => {
                                    // Pomocná: zisti, či tím patrí do skupiny s daným písmenom
                                    // (bez požiadavky na isRegistered – berieme aj superstructure tímy)
                                    const teamBelongsToCharLocal = (tn) => {
                                        if (!tn) return false;
                                        if (String(tn).startsWith('(row team:')) return false;
                                        // 1) Skús cez groupName v teamsArrivalBufferRef
                                        const teamInfo = (teamsArrivalBufferRef.current || []).find(
                                            (t) => cleanCategory(t.category) === cleanCategory(category) && t.teamName === tn
                                        );
                                        if (teamInfo && teamInfo.groupName) {
                                            return groupBelongsToChar(teamInfo.groupName, groupChar);
                                        }
                                        // 2) Fallback: odvoď z názvu tímu (napr. "U12 CH 2B" → "B")
                                        const m = /\d([A-ZÁ-Ž])\s*$/.exec(String(tn).trim());
                                        if (m && m[1].toUpperCase() === groupChar) return true;
                                        return false;
                                    };

                                    // Zápasy
                                    const hasMatch = (matchesBufferRef.current || []).some((m) => {
                                        if (cleanCategory(m.category) !== cleanCategory(category)) return false;
                                        let dayKey = null;
                                        if (m.scheduledTime) {
                                            const mm = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(m.scheduledTime);
                                            if (mm) {
                                                const d = String(mm[1]).padStart(2, '0');
                                                const mo = String(mm[2]).padStart(2, '0');
                                                const y = mm[3];
                                                dayKey = `${y}-${mo}-${d}`;
                                            }
                                        }
                                        if (!dayKey && m.scheduledTs != null) {
                                            const dt = new Date(m.scheduledTs);
                                            dayKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                                        }
                                        if (!dayKey || dayKey !== currentDay) return false;
                                        return [m.home, m.away].some((tn) => teamBelongsToCharLocal(tn));
                                    });
                                    if (hasMatch) return true;
                                
                                    // Stravovania
                                    const hasCatering = (cateringBufferRef.current || []).some((c) => {
                                        if (cleanCategory(c.category) !== cleanCategory(category)) return false;
                                        if (c.isSuperstructure === true) return false;
                                        const dayKey = c.dayKey || null;
                                        if (!dayKey || dayKey !== currentDay) return false;
                                        const tn = c.teamName;
                                        if (!tn) return false;
                                        return teamBelongsToCharLocal(tn);
                                    });
                                    return hasCatering;
                                })();
                            
                                // ============================================================
                                // Zisti, či má aktuálny tím vlastnú udalosť v danom dni.
                                // ============================================================
                                const currentTeamHasOwnEventOnThisDay = (() => {
                                    const hasMatch = (matchesBufferRef.current || []).some((m) => {
                                        if (cleanCategory(m.category) !== cleanCategory(category)) return false;
                                        if (m.home !== teamName && m.away !== teamName) return false;
                                        let dayKey = null;
                                        if (m.scheduledTime) {
                                            const mm = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(m.scheduledTime);
                                            if (mm) {
                                                const d = String(mm[1]).padStart(2, '0');
                                                const mo = String(mm[2]).padStart(2, '0');
                                                const y = mm[3];
                                                dayKey = `${y}-${mo}-${d}`;
                                            }
                                        }
                                        if (!dayKey && m.scheduledTs != null) {
                                            const dt = new Date(m.scheduledTs);
                                            dayKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                                        }
                                        return dayKey === currentDay;
                                    });
                                    if (hasMatch) return true;
                                    const hasCatering = (cateringBufferRef.current || []).some((c) => {
                                        if (cleanCategory(c.category) !== cleanCategory(category)) return false;
                                        if (c.teamName !== teamName) return false;
                                        return c.dayKey === currentDay;
                                    });
                                    return hasCatering;
                                })();
                            
                                // ============================================================
                                // Urči cieľovú udalosť (destination) pre presuny:
                                //  - Ak má tím vlastnú udalosť v daný deň → použijeme current.
                                //  - Ak NEMÁ → nájdeme prvú udalosť tímu v najbližšom nasledujúcom dni.
                                // ============================================================
                                let destinationEvent = null;
                                if (currentTeamHasOwnEventOnThisDay) {
                                    destinationEvent = current;
                                } else {
                                    const teamEvents = grouped[category][teamName] || [];
                                    const sortedEvents = [...teamEvents].sort((a, b) => {
                                        if (a.ts !== b.ts) return a.ts - b.ts;
                                        return String(a.text).localeCompare(String(b.text), 'sk');
                                    });
                                    for (const ev of sortedEvents) {
                                        const evDay = extractDayKeyFromWhen(ev.when);
                                        if (evDay && evDay > currentDay) {
                                            destinationEvent = ev;
                                            break;
                                        }
                                    }
                                    if (!destinationEvent) {
                                        destinationEvent = sortedEvents.find((ev) => ev.location) || null;
                                    }
                                }
                            
                                // ============================================================
                                // ROZHODNUTIE:
                                //  - Ak deň JE hrací deň skupiny (isSSPlayDay) → generuj
                                //    presuny z MIEST POSLEDNÝCH UDALOSTÍ tímov zo skupiny
                                //    (NIE z ubytovní).
                                //  - Inak (deň NIE JE v zozname hracích dní skupiny,
                                //    ale tím má v ten deň udalosť, napr. pavúkový zápas)
                                //    → generuj ranné presuny z ubytovní.
                                //
                                // POZOR: Predtým sa používalo `groupHasAnyEventOnCurrentDay`,
                                // čo spôsobovalo, že ak mal iný tím zo skupiny udalosť v ten
                                // deň, negenerovali sa ranné presuny z ubytovní pre aktuálny
                                // tím, aj keď jeho deň nebol v zozname hracích dní skupiny.
                                // Rozhodujúce je, či deň je v zozname `ssPlayDatesByTeam`.
                                // ============================================================
                                const useGroupEndLocationsAsSource = isSSPlayDay;

                                if (useGroupEndLocationsAsSource) {
                                    // ============================================================
                                    // SKUPINOVÁ LOGIKA: presuny z miest posledných udalostí
                                    // tímov zo skupiny s rovnakým písmenom.
                                    // ============================================================
                                    if (!destinationEvent || !destinationEvent.location) {
                                        // Nemáme cieľovú udalosť – nič negenerujeme
                                    } else {
                                        const destination = destinationEvent.location;
                            
                                        const uniqueSourceLocations = new Map();
                                        const updateUniqueSource = (loc, endTs) => {
                                            if (!loc) return;
                                            if (loc === destination) return;
                                            const existing = uniqueSourceLocations.get(loc);
                                            if (!existing || (endTs != null && endTs > (existing.endTs ?? -Infinity))) {
                                                uniqueSourceLocations.set(loc, { location: loc, endTs });
                                            }
                                        };
                            
                                        const referenceDay = currentDay;
                            
                                        // 1) Zápasy tímov zo skupiny s rovnakým písmenom
                                        matchesBufferRef.current.forEach((m) => {
                                            if (cleanCategory(m.category) !== cleanCategory(category)) return;
                            
                                            let dayKey = null;
                                            if (m.scheduledTime) {
                                                const mm = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(m.scheduledTime);
                                                if (mm) {
                                                    const d = String(mm[1]).padStart(2, '0');
                                                    const mo = String(mm[2]).padStart(2, '0');
                                                    const y = mm[3];
                                                    dayKey = `${y}-${mo}-${d}`;
                                                }
                                            }
                                            if (!dayKey && m.scheduledTs != null) {
                                                const dt = new Date(m.scheduledTs);
                                                dayKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                                            }
                                            if (!dayKey || dayKey !== referenceDay) return;
                            
                                            const endTs = m.scheduledEndTs != null
                                                ? m.scheduledEndTs
                                                : (m.scheduledTs != null ? m.scheduledTs : null);
                            
                                            [
                                                { name: m.home, identifier: m.homeTeamIdentifier },
                                                { name: m.away, identifier: m.awayTeamIdentifier },
                                            ].forEach(({ name: tn, identifier }) => {
                                                if (!tn) return;
                                                if (tn === teamName) return;
                                                if (!isRealRegisteredTeam(tn, category)) return;
                                                if (!teamBelongsToChar(tn, category)) return;
                            
                                                if (identifier) {
                                                    const nextInfo = pavukTeamNextMatchInfo(identifier, category);
                                                    if (nextInfo && nextInfo.hasNext) {
                                                        if (nextInfo.nextHallId != null && m.hallId != null && nextInfo.nextHallId === m.hallId) {
                                                            return;
                                                        }
                                                        if (nextInfo.nextHallId == null) {
                                                            return;
                                                        }
                                                    }
                                                }
                                                updateUniqueSource(m.hallName || null, endTs);
                                            });
                                        });
                            
                                        // 2) Stravovania tímov zo skupiny s rovnakým písmenom
                                        cateringBufferRef.current.forEach((c) => {
                                            if (cleanCategory(c.category) !== cleanCategory(category)) return;
                                            if (c.isSuperstructure === true) return;
                                            const dayKey = c.dayKey || null;
                                            if (!dayKey || dayKey !== referenceDay) return;
                            
                                            const tn = c.teamName;
                                            if (!tn) return;
                                            if (tn === teamName) return;
                                            if (!isRealRegisteredTeam(tn, category)) return;
                                            if (!teamBelongsToChar(tn, category)) return;
                            
                                            const endTs = c.slotToTs != null ? c.slotToTs : (c.ts != null ? c.ts : null);
                                            updateUniqueSource(c.placeName || null, endTs);
                                        });
                            
                                        // 3) Ubytovania tímov zo skupiny – LEN ak v daný deň NEMÁ
                                        //    žiadny iný tím zo skupiny udalosť (skupina v ten deň nehrá).
                                        if (!groupHasAnyEventOnCurrentDay) {
                                            (teamsArrivalBufferRef.current || []).forEach((t) => {
                                                if (cleanCategory(t.category) !== cleanCategory(category)) return;
                                                if (!t.teamName) return;
                                                if (t.teamName === teamName) return;
                                                if (!t.accommodationName || t.accommodationName.trim() === '') return;
                                                if (!isRealRegisteredTeam(t.teamName, category)) return;
                                                if (!teamBelongsToChar(t.teamName, category)) return;
                                                updateUniqueSource(t.accommodationName.trim(), null);
                                            });
                                        }
                            
                                        const destinationArrivalStr =
                                            formatFullFromTs(destinationEvent.startTs) || destinationEvent.when;
                            
                                        const dayRefTs = destinationEvent.startTs != null
                                            ? destinationEvent.startTs
                                            : midnightFromWhen(destinationEvent.when);
                            
                                        Array.from(uniqueSourceLocations.values())
                                            .sort((a, b) => {
                                                if (a.endTs != null && b.endTs != null) return a.endTs - b.endTs;
                                                return String(a.location).localeCompare(String(b.location), 'sk');
                                            })
                                            .forEach((info) => {
                                                let departureStr;
                                                let whenStr;
                            
                                                if (info.endTs != null && currentTeamHasOwnEventOnThisDay) {
                                                    departureStr = formatFullFromTs(info.endTs) || '—';
                                                } else {
                                                    const departureTs = timestampOnDay(dayRefTs, 0, 0);
                                                    departureStr = formatFullFromTs(departureTs) || '00:00';
                                                }
                            
                                                if (departureStr && destinationArrivalStr) {
                                                    whenStr = `${departureStr} – ${destinationArrivalStr}`;
                                                } else if (destinationArrivalStr) {
                                                    whenStr = destinationArrivalStr;
                                                } else {
                                                    whenStr = destinationEvent.when;
                                                }
                            
                                                enriched.push({
                                                    ts: (currentTeamHasOwnEventOnThisDay ? current.ts : destinationEvent.ts) - 1,
                                                    when: whenStr,
                                                    type: 'transfer',
                                                    text: `Presun z ${info.location} do ${destination}`,
                                                    location: null,
                                                    isTransfer: true,
                                                });
                                            });
                                    }
                                } else {
                                    // ============================================================
                                    // Deň NIE JE hrací deň skupiny a žiadny tím zo skupiny nemá
                                    // udalosť → použijeme pôvodnú logiku ranných presunov z ubytovní.
                                    // ============================================================
                                    console.log(
                                        '%c[TRANSPORT][FALLBACK-ACCOM] ' + teamName + ' @ ' + currentDay + ' → groupHasAnyEventOnCurrentDay=false, generujem ranné presuny z ubytovní',
                                        'color:#dc2626;font-weight:bold;'
                                    );
                                    if (!destinationEvent || !destinationEvent.location) {
                                        // Nemáme cieľovú udalosť – nič negenerujeme
                                    } else {
                                        const destination = destinationEvent.location;
                            
                                        const uniqueSourceLocations = new Map();
                                        const updateUniqueSource = (loc, endTs) => {
                                            if (!loc) return;
                                            if (loc === destination) return;
                                            const existing = uniqueSourceLocations.get(loc);
                                            if (!existing || (endTs != null && endTs > (existing.endTs ?? -Infinity))) {
                                                uniqueSourceLocations.set(loc, { location: loc, endTs });
                                            }
                                        };
                            
                                        // Ubytovania tímov zo skupiny s rovnakým písmenom
                                        // Prednostne použi skupinovú cache (rovnako ako pri večerných presunoch)
                                        const derivedGroupName = `skupina ${groupCharPre}`;
                                        const cacheKey = `${cleanCategory(category)}|${derivedGroupName}`;
                                        const cacheAccoms = (window.__transport_accommodationsByGroup || {})[cacheKey] || [];

                                        if (cacheAccoms.length > 0) {
                                            // Máme cache – použi ju
                                            cacheAccoms.forEach((accomName) => {
                                                if (!accomName) return;
                                                updateUniqueSource(accomName.trim(), null);
                                            });
                                        } else {
                                            // Fallback – skús teamsArrivalBufferRef (pre prípad, že cache ešte nie je načítaná)
                                            (teamsArrivalBufferRef.current || []).forEach((t) => {
                                                if (cleanCategory(t.category) !== cleanCategory(category)) return;
                                                if (!t.teamName) return;
                                                if (t.teamName === teamName) return;
                                                if (!t.accommodationName || t.accommodationName.trim() === '') return;
                                                // NEvyžaduj isRegistered – berieme aj superstructure tímy s ubytovaním
                                        
                                                let belongsToChar = false;
                                                if (t.groupName) {
                                                    belongsToChar = groupBelongsToChar(t.groupName, groupCharPre);
                                                } else {
                                                    const m = /\d([A-ZÁ-Ž])\s*$/.exec(String(t.teamName).trim());
                                                    if (m && m[1].toUpperCase() === groupCharPre) {
                                                        belongsToChar = true;
                                                    }
                                                }
                                                if (!belongsToChar) return;

                                                updateUniqueSource(t.accommodationName.trim(), null);
                                            });
                                        }
                            
                                        const destinationArrivalStr =
                                            formatFullFromTs(destinationEvent.startTs) || destinationEvent.when;
                            
                                        const dayRefTs = destinationEvent.startTs != null
                                            ? destinationEvent.startTs
                                            : midnightFromWhen(destinationEvent.when);
                            
                                        Array.from(uniqueSourceLocations.values())
                                            .sort((a, b) => {
                                                if (a.endTs != null && b.endTs != null) return a.endTs - b.endTs;
                                                return String(a.location).localeCompare(String(b.location), 'sk');
                                            })
                                            .forEach((info) => {
                                                const departureTs = timestampOnDay(dayRefTs, 0, 0);
                                                const departureStr = formatFullFromTs(departureTs) || '00:00';
                            
                                                let whenStr;
                                                if (departureStr && destinationArrivalStr) {
                                                    whenStr = `${departureStr} – ${destinationArrivalStr}`;
                                                } else if (destinationArrivalStr) {
                                                    whenStr = destinationArrivalStr;
                                                } else {
                                                    whenStr = destinationEvent.when;
                                                }
                            
                                                enriched.push({
                                                    ts: destinationEvent.ts - 1,
                                                    when: whenStr,
                                                    type: 'transfer',
                                                    text: `Presun z ${info.location} do ${destination}`,
                                                    location: null,
                                                    isTransfer: true,
                                                });
                                            });
                                    }
                                }
                                // DÔLEŽITÉ: V tomto prípade NEgenerujeme klasické ranné presuny
                                // z ubytovní – preskočíme zvyšok bloku.
                            } else {
                                // ============================================================
                                // PÔVODNÁ LOGIKA pre bežné (ne-superstructure) tímy
                                // alebo superstructure tímy v deň, kedy nehrajú.
                                // ============================================================
                        
                                // ============================================================
                                // NOVÉ: SUPERSTRUCTURE TÍM ZO SKUPINY TVORENEJ IBA SUPERSTRUCTURE TÍMAMI
                                // ============================================================
                                const ssTeamKeyForGroup = `${cleanCategory(category)}|${teamName}`;
                                const groupCharForSSGroup = ssGroupCharByTeam[ssTeamKeyForGroup];
                                const ssTeamKey = ssTeamKeyForGroup;
                                
                                const isPureSuperstructureGroup = (() => {
                                    if (!isSuperstructureTeam || !groupCharForSSGroup) return false;
                        
                                    let hasUsersTeam = false;
                                    let hasAnyTeam = false;
                        
                                    (teamsArrivalBufferRef.current || []).forEach((t) => {
                                        if (cleanCategory(t.category) !== cleanCategory(category)) return;
                        
                                        let belongsToChar = false;
                                        if (t.groupName) {
                                            belongsToChar = groupBelongsToChar(t.groupName, groupCharForSSGroup);
                                        } else if (t.teamName) {
                                            const m = /\d([A-ZÁ-Ž])\s*$/.exec(String(t.teamName).trim());
                                            if (m && m[1].toUpperCase() === groupCharForSSGroup) {
                                                belongsToChar = true;
                                            }
                                        }
                                        if (!belongsToChar) return;
                        
                                        hasAnyTeam = true;
                        
                                        if (t.isRegistered === true && t.isSuperstructure !== true) {
                                            hasUsersTeam = true;
                                        }
                                    });
                        
                                    return hasAnyTeam && !hasUsersTeam;
                                })();
                        
                                const ssTeamHasMatchOnDay = (teamNameToCheck) => {
                                    return (matchesBufferRef.current || []).some((m) => {
                                        if (cleanCategory(m.category) !== cleanCategory(category)) return false;
                                        if (m.home !== teamNameToCheck && m.away !== teamNameToCheck) return false;
                        
                                        let dayKey = null;
                                        if (m.scheduledTime) {
                                            const mm = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(m.scheduledTime);
                                            if (mm) {
                                                const d = String(mm[1]).padStart(2, '0');
                                                const mo = String(mm[2]).padStart(2, '0');
                                                const y = mm[3];
                                                dayKey = `${y}-${mo}-${d}`;
                                            }
                                        }
                                        if (!dayKey && m.scheduledTs != null) {
                                            const dt = new Date(m.scheduledTs);
                                            dayKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                                        }
                                        return dayKey === currentDay;
                                    });
                                };
                        
                                const anySSGroupTeamPlaysToday = (() => {
                                    if (!isPureSuperstructureGroup || currentDay == null) return false;
                                    return (teamsArrivalBufferRef.current || []).some((t) => {
                                        if (cleanCategory(t.category) !== cleanCategory(category)) return false;
                                        if (t.isSuperstructure !== true) return false;
                                        if (!t.teamName) return false;
                        
                                        let belongsToChar = false;
                                        if (t.groupName) {
                                            belongsToChar = groupBelongsToChar(t.groupName, groupCharForSSGroup);
                                        } else {
                                            const m = /\d([A-ZÁ-Ž])\s*$/.exec(String(t.teamName).trim());
                                            if (m && m[1].toUpperCase() === groupCharForSSGroup) {
                                                belongsToChar = true;
                                            }
                                        }
                                        if (!belongsToChar) return false;
                        
                                        return ssTeamHasMatchOnDay(t.teamName);
                                    });
                                })();
                        
                                if (isPureSuperstructureGroup && anySSGroupTeamPlaysToday && current.location && isSSPlayDay) {
                                    const destination = current.location;
                        
                                    const ssTeamLastEnd = new Map();
                        
                                    const updateSSLastEnd = (tn, location, endTs) => {
                                        if (!tn || !location || endTs == null) return;
                                        if (tn === teamName) return;
                                        const existing = ssTeamLastEnd.get(tn);
                                        if (!existing || endTs > existing.endTs) {
                                            ssTeamLastEnd.set(tn, { location, endTs });
                                        }
                                    };
                        
                                    matchesBufferRef.current.forEach((m) => {
                                        if (cleanCategory(m.category) !== cleanCategory(category)) return;
                        
                                        let dayKey = null;
                                        if (m.scheduledTime) {
                                            const mm = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(m.scheduledTime);
                                            if (mm) {
                                                const d = String(mm[1]).padStart(2, '0');
                                                const mo = String(mm[2]).padStart(2, '0');
                                                const y = mm[3];
                                                dayKey = `${y}-${mo}-${d}`;
                                            }
                                        }
                                        if (!dayKey && m.scheduledTs != null) {
                                            const dt = new Date(m.scheduledTs);
                                            dayKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                                        }
                                        if (!dayKey || dayKey !== currentDay) return;
                        
                                        const endTs = m.scheduledEndTs != null
                                            ? m.scheduledEndTs
                                            : (m.scheduledTs != null ? m.scheduledTs : null);
                        
                                        [m.home, m.away].forEach((tn) => {
                                            if (!tn) return;
                                            if (tn === teamName) return;
                        
                                            const info = (teamsArrivalBufferRef.current || []).find(
                                                (t) => cleanCategory(t.category) === cleanCategory(category) && t.teamName === tn
                                            );
                                            if (!info) return;
                                            if (info.isSuperstructure !== true) return;
                        
                                            let belongsToChar = false;
                                            if (info.groupName) {
                                                belongsToChar = groupBelongsToChar(info.groupName, groupCharForSSGroup);
                                            } else {
                                                const mm2 = /\d([A-ZÁ-Ž])\s*$/.exec(String(tn).trim());
                                                if (mm2 && mm2[1].toUpperCase() === groupCharForSSGroup) {
                                                    belongsToChar = true;
                                                }
                                            }
                                            if (!belongsToChar) return;
                        
                                            const identifier = tn === m.home ? m.homeTeamIdentifier : m.awayTeamIdentifier;
                                            if (identifier) {
                                                const nextInfo = pavukTeamNextMatchInfo(identifier, category);
                                                if (nextInfo && nextInfo.hasNext) {
                                                    if (nextInfo.nextHallId != null && m.hallId != null && nextInfo.nextHallId === m.hallId) {
                                                        return;
                                                    }
                                                    if (nextInfo.nextHallId == null) {
                                                        return;
                                                    }
                                                }
                                            }
                        
                                            updateSSLastEnd(tn, m.hallName || null, endTs);
                                        });
                                    });
                        
                                    cateringBufferRef.current.forEach((c) => {
                                        if (cleanCategory(c.category) !== cleanCategory(category)) return;
                                        if (c.isSuperstructure !== true) return;
                                        if (c.dayKey !== currentDay) return;
                                        if (c.teamName === teamName) return;
                        
                                        let belongsToChar = false;
                                        const info = (teamsArrivalBufferRef.current || []).find(
                                            (t) => cleanCategory(t.category) === cleanCategory(category) && t.teamName === c.teamName
                                        );
                                        if (info && info.groupName) {
                                            belongsToChar = groupBelongsToChar(info.groupName, groupCharForSSGroup);
                                        } else {
                                            const m = /\d([A-ZÁ-Ž])\s*$/.exec(String(c.teamName).trim());
                                            if (m && m[1].toUpperCase() === groupCharForSSGroup) {
                                                belongsToChar = true;
                                            }
                                        }
                                        if (!belongsToChar) return;
                        
                                        const endTs = c.slotToTs != null ? c.slotToTs : (c.ts != null ? c.ts : null);
                                        updateSSLastEnd(c.teamName, c.placeName || null, endTs);
                                    });
                        
                                    const uniqueSourceLocations = new Map();
                                    ssTeamLastEnd.forEach((info) => {
                                        if (!info || !info.location) return;
                                        if (info.location === destination) return;
                        
                                        const existing = uniqueSourceLocations.get(info.location);
                                        if (!existing || info.endTs > existing.endTs) {
                                            uniqueSourceLocations.set(info.location, info);
                                        }
                                    });
                        
                                    const destinationArrivalStr = formatFullFromTs(current.startTs) || current.when;
                        
                                    Array.from(uniqueSourceLocations.values())
                                        .sort((a, b) => a.endTs - b.endTs)
                                        .forEach((info) => {
                                            if (info.endTs != null && current.startTs != null && info.endTs >= current.startTs) {
                                                return;
                                            }
                        
                                            const departureStr = formatFullFromTs(info.endTs) || '—';
                        
                                            let whenStr;
                                            if (departureStr && destinationArrivalStr) {
                                                whenStr = `${departureStr} – ${destinationArrivalStr}`;
                                            } else if (destinationArrivalStr) {
                                                whenStr = destinationArrivalStr;
                                            } else {
                                                whenStr = current.when;
                                            }
                        
                                            enriched.push({
                                                ts: current.ts - 1,
                                                when: whenStr,
                                                type: 'transfer',
                                                text: `Presun z ${info.location} do ${destination}`,
                                                location: null,
                                                isTransfer: true,
                                            });
                                        });
                                }
                        
                                const skipClassicMorningTransfers =
                                    isPureSuperstructureGroup && anySSGroupTeamPlaysToday && isSSPlayDay;
                                
                                // ============================================================
                                // NOVÉ: Ak je aktuálny deň v zozname hracích dní skupiny (t.j.
                                // deň, ktorý sa vypisuje v odrážkovom zozname "Písmeno skupiny:
                                // ... – jedinečné dátumy zápasov v skupinách s týmto písmenom"),
                                // NESMÚ sa generovať klasické ranné presuny z ubytovní pre
                                // superstructure tím – bez ohľadu na to, či tím má vlastnú
                                // udalosť alebo nie. Namiesto toho sa má použiť skupinová logika
                                // (ktorá sa spustila vyššie v bloku useGroupBasedMorningTransfers).
                                // ============================================================
                                const isSSPlayDayForSkip =
                                    isSuperstructureTeam &&
                                    ssPlayDatesByTeam[ssTeamKeyForGroup] &&
                                    currentDay != null &&
                                    ssPlayDatesByTeam[ssTeamKeyForGroup].has(currentDay); 
                                
                                if (!skipClassicMorningTransfers && !isSSPlayDayForSkip) {
                                
                                    const hasTransportType = (() => {
                                        if (!teamArrivalType) return false;
                                        const norm = String(teamArrivalType)
                                            .toLowerCase()
                                            .normalize('NFD')
                                            .replace(/[\u0300-\u036f]/g, '')
                                            .trim();
                                        if (!norm) return false;
                                        if (norm.includes('vlastn')) return false;
                                        if (norm.includes('bez dopravy')) return false;
                                        if (norm.includes('ziadna')) return false;
                                        if (norm.includes('žiadna')) return false;
                                        return true;
                                    })();
                                
                                    // NOVÉ: Typ dopravy "vlastná doprava" alebo "bez dopravy"
                                    const isOwnOrNoTransport = (() => {
                                        if (!teamArrivalType) return false;
                                        const norm = String(teamArrivalType)
                                            .toLowerCase()
                                            .normalize('NFD')
                                            .replace(/[\u0300-\u036f]/g, '')
                                            .trim();
                                        if (!norm) return false;
                                        if (norm.includes('vlastn')) return true;
                                        if (norm.includes('bez dopravy')) return true;
                                        if (norm.includes('ziadna')) return true;
                                        if (norm.includes('žiadna')) return true;
                                        return false;
                                    })();
                                
                                    const isGlobalFirstDay =
                                        currentDay != null &&
                                        globalFirstDay != null &&
                                        currentDay === globalFirstDay;
                                
                                    const useExternalStopOnFirstDay =
                                        isGlobalFirstDay &&
                                        hasTransportType &&
                                        !!externalArrivalStop;
                                
                                    // NOVÉ: Prvý deň turnaja + vlastná doprava / bez dopravy
                                    // → presun z miesta zrazu na miesto prvej udalosti dňa.
                                    const useMeetingPointOnFirstDay =
                                        isGlobalFirstDay &&
                                        isOwnOrNoTransport &&
                                        !!meetingPointStop;
                                
                                    const useAccommodationAsSource = (() => {
                                        if (!isGlobalFirstDay) {
                                            return shouldGenerateAccommodationTransfers;
                                        }
                                        return hasTransportType
                                            && !useExternalStopOnFirstDay
                                            && shouldGenerateAccommodationTransfers;
                                    })();
                                
                                    const shouldGenerateMorningTransfer =
                                        useExternalStopOnFirstDay || useAccommodationAsSource || useMeetingPointOnFirstDay;
                                
                                    if (shouldGenerateMorningTransfer) {
                                        const morningFromLocations = (() => {
                                            if (useExternalStopOnFirstDay) {
                                                return [{
                                                    name: externalArrivalStop.name,
                                                    isExternalStop: true,
                                                    isMeetingPoint: false,
                                                }];
                                            }
                                            if (useMeetingPointOnFirstDay) {
                                                return [{
                                                    name: meetingPointStop.name,
                                                    isExternalStop: false,
                                                    isMeetingPoint: true,
                                                }];
                                            }
                                            if (useAccommodationAsSource) {
                                                return teamAccommodationsList.map((n) => ({
                                                    name: n,
                                                    isExternalStop: false,
                                                    isMeetingPoint: false,
                                                }));
                                            }
                                            return [];
                                        })();
                                
                                        morningFromLocations.forEach(({ name: fromLocationName, isExternalStop, isMeetingPoint }) => {
                                            if (!fromLocationName) return;
                                            if (fromLocationName === current.location) return;
                                
                                            const fromLabel = isExternalStop
                                                ? `zastávka ${fromLocationName}`
                                                : isMeetingPoint
                                                    ? `miesto zrazu ${fromLocationName}`
                                                    : `ubytovanie ${fromLocationName}`;
                                
                                            const dayRefTs =
                                                current.startTs != null
                                                    ? current.startTs
                                                    : midnightFromWhen(current.when);
                                
                                            const arrivalTs = current.startTs != null ? current.startTs : null;
                                            const arrivalStr =
                                                formatFullFromTs(arrivalTs) || current.when;
                                
                                            let departureTs;
                                            let departureStr;
                                            const teamArrivalTime = (arrivalTimeByTeam[category] && arrivalTimeByTeam[category][teamName]) || '';
                                            if (isExternalStop && teamArrivalTime && /^\d{1,2}:\d{2}$/.test(teamArrivalTime)) {
                                                const [h, mi] = teamArrivalTime.split(':').map(Number);
                                                departureTs = timestampOnDay(dayRefTs, h, mi);
                                                departureStr = formatFullFromTs(departureTs) || teamArrivalTime;
                                            } else {
                                                departureTs = timestampOnDay(dayRefTs, 0, 0);
                                                departureStr = formatFullFromTs(departureTs) || '00:00';
                                            }
                                
                                            if (
                                                departureTs != null &&
                                                arrivalTs != null &&
                                                departureTs >= arrivalTs
                                            ) {
                                                return;
                                            }
                                
                                            let whenStr;
                                            if (departureStr && arrivalStr) {
                                                whenStr = `${departureStr} – ${arrivalStr}`;
                                            } else if (arrivalStr) {
                                                whenStr = arrivalStr;
                                            } else {
                                                whenStr = current.when;
                                            }
                                
                                            enriched.push({
                                                ts: current.ts - 1,
                                                when: whenStr,
                                                type: 'transfer',
                                                text: buildTransferText(
                                                    null,
                                                    current,
                                                    fromLabel,
                                                    `${current.location}`,
                                                    false,
                                                    departureStr,
                                                    arrivalStr
                                                ),
                                                location: null,
                                                isTransfer: true,
                                            });
                                        });
                                    }
                                }
                            }
                        }

                        enriched.push(current);

                        const currentIsTimedEvent =
                            current.type === 'match' || current.type === 'catering';
                        
                        if (
                            next &&
                            currentIsTimedEvent &&
                            current.location &&
                            next.location &&
                            current.location !== next.location &&
                            currentDay != null &&
                            nextDay != null &&
                            currentDay === nextDay
                        ) {
                            const departureTs =
                                current.endTs != null ? current.endTs : current.startTs;
                            const arrivalTs =
                                next.startTs != null ? next.startTs : null;
                        
                            // NOVÉ: Ak je začiatok presunu neskorší alebo rovnaký ako príchod,
                            // presun sa nesmie vygenerovať.
                            if (
                                departureTs != null &&
                                arrivalTs != null &&
                                departureTs >= arrivalTs
                            ) {
                                // preskočíme generovanie tohto presunu
                            } else {
                                const departureStr = formatFullFromTs(departureTs);
                                const arrivalStr = formatFullFromTs(arrivalTs);
                        
                                let whenStr;
                                if (departureStr && arrivalStr) {
                                    whenStr = `${departureStr} – ${arrivalStr}`;
                                } else if (departureStr) {
                                    whenStr = departureStr;
                                } else if (arrivalStr) {
                                    whenStr = arrivalStr;
                                } else {
                                    whenStr = current.when;
                                }
                        
                                enriched.push({
                                    ts: current.ts + 0.5,
                                    when: whenStr,
                                    type: 'transfer',
                                    text: buildTransferText(
                                        current,
                                        next,
                                        `${current.location}`,
                                        `${next.location}`
                                    ),
                                    location: null,
                                    isTransfer: true,
                                });
                            }
                        }

                        const isPavukTeamName = /\b(WSF|LSF|WQF|W8F|W16F)\d*/i.test(String(teamName));
                        if (
                            isPavukTeamName &&
                            next &&
                            currentIsTimedEvent &&
                            current.location &&
                            next.location &&
                            current.location !== next.location &&
                            currentDay != null &&
                            nextDay != null &&
                            currentDay !== nextDay
                        ) {
                            const departureTs =
                                current.endTs != null ? current.endTs : current.startTs;
                            const arrivalTs =
                                next.startTs != null ? next.startTs : null;

                            if (
                                departureTs != null &&
                                arrivalTs != null &&
                                departureTs < arrivalTs
                            ) {
                                const departureStr = formatFullFromTs(departureTs);
                                const arrivalStr = formatFullFromTs(arrivalTs);

                                let whenStr;
                                if (departureStr && arrivalStr) {
                                    whenStr = `${departureStr} – ${arrivalStr}`;
                                } else if (departureStr) {
                                    whenStr = departureStr;
                                } else if (arrivalStr) {
                                    whenStr = arrivalStr;
                                } else {
                                    whenStr = current.when;
                                }

                                enriched.push({
                                    ts: current.ts + 0.5,
                                    when: whenStr,
                                    type: 'transfer',
                                    text: `Presun z ${current.location} do ${next.location}`,
                                    location: null,
                                    isTransfer: true,
                                });
                            }
                        }
                                            
                        const isVeryLastEventOfTeam = (next == null);
                    
                        // B) Koniec dňa – večerné presuny na ubytovanie
                        if (
                            isLastEventOfDay &&
                            !isVeryLastEventOfTeam &&
                            currentDay !== globalLastDay &&
                            current.location
                        ) {
                            if (shouldGenerateAccommodationTransfers) {
                                const departureTs =
                                    current.endTs != null ? current.endTs : current.startTs;
                        
                                const dayRefTs =
                                    departureTs != null
                                        ? departureTs
                                        : midnightFromWhen(current.when);
                        
                                const departureStr =
                                    formatFullFromTs(departureTs) || current.when;
                        
                                // NOVÉ: Vypočítaj arrivalTs (23:59 v deň odchodu) a skontroluj.
                                const arrivalTs =
                                    dayRefTs != null
                                        ? timestampOnDay(dayRefTs, 23, 59)
                                        : null;
                        
                                const arrivalStr =
                                    formatFullFromTs(arrivalTs) || '23:59';
                        
                                // NOVÉ: Ak je začiatok presunu neskorší alebo rovnaký ako príchod,
                                // presun sa nesmie vygenerovať.
                                if (
                                    departureTs != null &&
                                    arrivalTs != null &&
                                    departureTs >= arrivalTs
                                ) {
                                    // preskočíme generovanie večerných presunov
                                } else {
                                    let whenStr;
                                    if (departureStr && arrivalStr) {
                                        whenStr = `${departureStr} – ${arrivalStr}`;
                                    } else if (departureStr) {
                                        whenStr = departureStr;
                                    } else {
                                        whenStr = current.when;
                                    }
                        
                                    teamAccommodationsList.forEach((accomName) => {
                                        if (!accomName) return;
                                        if (accomName === current.location) return;
                        
                                        enriched.push({
                                            ts: current.ts + 1,
                                            when: whenStr,
                                            type: 'transfer',
                                            text: `Presun z ${current.location} do ubytovanie ${accomName}`,
                                            location: null,
                                            isTransfer: true,
                                        });
                                    });
                                }
                            }
                        }
                    }

                    enriched.sort((a, b) => {
                        if (a.ts !== b.ts) return a.ts - b.ts;
                        return String(a.text).localeCompare(String(b.text), 'sk');
                    });

                    // ============================================================
                    // NOVÉ: Uloženie vygenerovaných presunov pre tento tím do DB
                    // (s čistením starých záznamov pre tento tím/kategóriu)
                    // ============================================================
                    try {
                        const transfersForTeam = enriched.filter((ev) => ev.isTransfer === true);
                        if (transfersForTeam.length > 0 && window.db) {
                    
                            // ============================================================
                            // NOVÉ: Zisti, či je tím superstructure (nie je v users).
                            // Pre superstructure tímy nemáme teamUid/teamIndex – uložíme
                            // ich s teamName priamo v DB.
                            // ============================================================
                            const foundTeamIdentifiers = findTeamIdentifiersByName(category, teamName);
                            const isSuperstructureTeamForDb = !foundTeamIdentifiers;
                            
                            const effectiveTeamIdentifiers = isSuperstructureTeamForDb
                                ? { teamUid: null, teamIndex: null, category }
                                : foundTeamIdentifiers;

                            if (isSuperstructureTeamForDb) {
                                console.log(
                                    '%c[TRANSPORT][SUPERSTRUCTURE] Ukladám presuny pre superstructure tím:',
                                    'color:#7c3aed;font-weight:bold;',
                                    teamName, 'v kategórii', category,
                                    '(teamUid=null, teamIndex=null, teamName="' + teamName + '")'
                                );
                            } else {
                                // Tím z users – over, že máme platný identifikátor
                                if (effectiveTeamIdentifiers.teamUid == null || effectiveTeamIdentifiers.teamIndex == null) {
                                    console.warn(
                                        '[TRANSPORT] Tím z users nemá platný teamUid/teamIndex – presuny sa neukladajú:',
                                        { category, teamName }
                                    );
                                    return;
                                }
                            }
                    
                            const transfersPatch = {};
                            const newKeys = new Set();
                    
                            transfersForTeam.forEach((ev) => {
                                // ============================================================
                                // NOVÉ: Najprv zisti from/to z textu – potrebujeme ich
                                // na vyhľadanie existujúceho parent záznamu s medzizastávkami.
                                // ============================================================
                                let fromLocation = '';
                                let toLocation = '';
                                const m = /^Presun z (.+?) do (.+)$/.exec(String(ev.text || ''));
                                if (m) {
                                    fromLocation = m[1].trim();
                                    toLocation = m[2].trim();
                                }
                    
                                const evDayKey = extractDayKeyFromWhen(ev.when) || null;
                    
                                // ============================================================
                                // NOVÉ: Skontroluj, či už existuje PARENT záznam
                                // s rovnakou kategóriou, tímom, fromLocation, toLocation
                                // a dayKey, ktorý má intermediateStops (medzizastávky).
                                //
                                // Ak áno, MUSÍME zachovať JEHO kľúč (a jeho úpravy),
                                // inak by sa vygeneroval nový duplicitný záznam a starý
                                // (s medzizastávkami) by zostal v DB.
                                // ============================================================
                                const existingParentWithStops = (savedTransfersRef.current || []).find((s) => {
                                    if (cleanCategory(s.category || '') !== cleanCategory(category)) return false;
                                    if (String(s.teamName || '').trim() !== teamName) return false;
                                    if (normalizePlaceName(s.fromLocation || '') !== normalizePlaceName(fromLocation)) return false;
                                    if (normalizePlaceName(s.toLocation || '') !== normalizePlaceName(toLocation)) return false;
                                    if ((s.dayKey || '') !== (evDayKey || '')) return false;
                                    // Musí ísť o parent záznam (nie segment)
                                    if (s._parentKey && s._parentKey !== s.key) return false;
                                    // Musí mať medzizastávky
                                    if (!Array.isArray(s.intermediateStops) || s.intermediateStops.length === 0) return false;
                                    return true;
                                });
                    
                                // ============================================================
                                // KĽÚČ: Ak existuje parent s medzizastávkami, použi
                                // JEHO kľúč. Inak vytvor nový kľúč cez buildTransferKey.
                                // ============================================================
                                const key = existingParentWithStops
                                    ? existingParentWithStops.key
                                    : buildTransferKey(category, teamName, ev.when, ev.text);
                                newKeys.add(key);
                    
                                const existingSaved = existingParentWithStops || (savedTransfersRef.current || []).find((s) => s.key === key);
                    
                                // Základný záznam (bez segments – tie dopočítame nižšie)
                                const baseRecord = {
                                    category: cleanCategory(category),
                                    teamUid: effectiveTeamIdentifiers.teamUid,
                                    teamIndex: effectiveTeamIdentifiers.teamIndex,
                                    when: String(ev.when || '').trim(),
                                    text: String(ev.text || '').trim(),
                                    fromLocation,
                                    toLocation,
                                    dayKey: extractDayKeyFromWhen(ev.when) || null,
                                };
                    
                                // ============================================================
                                // NOVÉ: Pre superstructure tímy ulož aj teamName (nemajú
                                // teamUid/teamIndex v users).
                                // ============================================================
                                if (isSuperstructureTeamForDb) {
                                    baseRecord.teamName = teamName;
                                }
                    
                                // Ak existuje manuálne upravený záznam, prenesieme si jeho úpravy
                                if (existingSaved) {
                                    if (Array.isArray(existingSaved.intermediateStops) && existingSaved.intermediateStops.length > 0) {
                                        baseRecord.intermediateStops = existingSaved.intermediateStops;
                                    }
                                    if (existingSaved.isWalking === true) {
                                        baseRecord.isWalking = true;
                                        baseRecord.walkingSetAt = existingSaved.walkingSetAt || Timestamp.fromDate(new Date());
                                        baseRecord.walkingSetBy = existingSaved.walkingSetBy || (userProfileData && userProfileData.email) || null;
                                    }
                                }
                    
                                // ============================================================
                                // NOVÉ: Vždy vytvoríme draft so segments a dopočítame časy
                                // podľa aktuálnych busRows (recomputeParentSegmentsInPlace).
                                //
                                // Tým sa zabezpečí, že KAŽDÝ presun má v DB:
                                //  - intermediateStops (ak existujú)
                                //  - segments s reálnymi časmi z busu (ak je priradený)
                                //  - segments bez časov pre pešie segmenty
                                // ============================================================
                                const draft = {
                                    ...baseRecord,
                                    key,
                                    segments: Array.isArray(existingSaved?.segments)
                                        ? existingSaved.segments.map((s) => ({ ...s }))
                                        : buildDefaultSegments(baseRecord),
                                };
                    
                                // Dopočítaj časy segmentov podľa busRows
                                recomputeParentSegmentsInPlace(draft);
                    
                                // Zapíšeme výsledok do patche
                                const finalWhen = (draft.when && String(draft.when).trim() !== '')
                                    ? draft.when
                                    : (baseRecord.when && String(baseRecord.when).trim() !== '' ? baseRecord.when : '');
                    
                                transfersPatch[key] = {
                                    category: draft.category,
                                    teamUid: draft.teamUid,
                                    teamIndex: draft.teamIndex,
                                    dayKey: draft.dayKey,
                                    fromLocation: draft.fromLocation,
                                    toLocation: draft.toLocation,
                                    when: finalWhen,
                                    text: draft.text,
                                    segments: draft.segments,
                                };
                                
                                // ============================================================
                                // NOVÉ: Pre superstructure tímy ulož aj teamName.
                                // Pre tímy z users sa teamName NIKDY neukladá.
                                // ============================================================
                                if (isSuperstructureTeamForDb) {
                                    transfersPatch[key].teamName = teamName;
                                }
                    
                                if (Array.isArray(draft.intermediateStops) && draft.intermediateStops.length > 0) {
                                    transfersPatch[key].intermediateStops = draft.intermediateStops;
                                }
                    
                                if (draft.isWalking === true) {
                                    transfersPatch[key].isWalking = true;
                                    transfersPatch[key].walkingSetAt = draft.walkingSetAt;
                                    transfersPatch[key].walkingSetBy = draft.walkingSetBy;
                    
                                    // ============================================================
                                    // NOVÉ: Peší presun NEMÁ ČASY.
                                    // - `when` sa nastaví na prázdny string (alebo null)
                                    // - segments dostanú null časy
                                    // ============================================================
                                    transfersPatch[key].when = '';
                                    transfersPatch[key].segments = (draft.segments || []).map((s) => ({
                                        ...s,
                                        startTs: null,
                                        endTs: null,
                                        when: null,
                                        busAssigned: false,
                                    }));
                                }
                    
                                if (existingSaved) {
                                    if (existingSaved.isWalking === true) {
                                        transfersPatch[key].isWalking = true;
                                        transfersPatch[key].walkingSetAt = existingSaved.walkingSetAt || Timestamp.fromDate(new Date());
                                        transfersPatch[key].walkingSetBy = existingSaved.walkingSetBy || (userProfileData && userProfileData.email) || null;
                                    }
                                    if (Array.isArray(existingSaved.intermediateStops) && existingSaved.intermediateStops.length > 0) {
                                        transfersPatch[key].intermediateStops = existingSaved.intermediateStops;
                                    }
                                }
                            });
                    
                            // ============================================================
                            // OPRAVA (Chyba 3): Zmaž staré záznamy pre tento tím,
                            // ktoré už nemajú byť (parent aj segmenty), aby sa nehromadili.
                            //
                            // NOVÉ: Rozšírené o superstructure tímy – porovnávame buď
                            // cez teamUid/teamIndex, alebo (pre superstructure) cez teamName.
                            // ============================================================
                            const categoryClean = cleanCategory(category);
                            (savedTransfersRef.current || []).forEach((s) => {
                                if (cleanCategory(s.category || '') !== categoryClean) return;
                    
                                // Musí ísť o rovnaký tím – buď cez teamUid/teamIndex,
                                // alebo (pre superstructure) cez teamName.
                                const sameTeam =
                                    (effectiveTeamIdentifiers.teamUid != null
                                        && s.teamUid === effectiveTeamIdentifiers.teamUid
                                        && s.teamIndex === effectiveTeamIdentifiers.teamIndex)
                                    || (effectiveTeamIdentifiers.teamUid == null
                                        && String(s.teamName || '').trim() === teamName);
                    
                                if (!sameTeam) return;
                                if (newKeys.has(s.key)) return;
                                // Zmaž len ak nie je súčasťou parent bloku s intermediateStops
                                if (Array.isArray(s.intermediateStops) && s.intermediateStops.length > 0) return;
                                if (s._parentKey && s._parentKey !== s.key) {
                                    // Je to segment iného parenta – tiež zmaž, ak nový parent neexistuje
                                    const parentExists = (savedTransfersRef.current || []).some(
                                        (p) => p.key === s._parentKey && Array.isArray(p.intermediateStops) && p.intermediateStops.length > 0
                                    );
                                    if (parentExists) return;
                                }
                                transfersPatch[s.key] = deleteField();
                            });
                    
                            if (Object.keys(transfersPatch).length > 0) {
                                setDoc(
                                    doc(window.db, TRANSPORT_SETTINGS_COLLECTION, TRANSPORT_SETTINGS_DOC),
                                    { [TRANSPORT_TRANSFERS_FIELD]: transfersPatch },
                                    { merge: true }
                                ).catch((err) => {
                                    console.error('[TRANSPORT] Chyba pri ukladaní presunov do DB:', err);
                                });
                            }
                        }
                    } catch (e) {
                        console.error('[TRANSPORT] Chyba pri príprave presunov na uloženie:', e);
                    }
    
                    const timelineLines = renderTeamTimeline(category, teamName, enriched, {
                        isSuperstructureTeam,
                        teamGroupName,
                        getGroupLastChar,
                        groupBelongsToChar,
                        formatDateDDMMYYYY,
                        extractDayKeyFromWhen,
                    });

                    timelineLines.forEach((line) => {
                        // Zachovaj farebné zvýraznenie pre transfery
                        if (line.includes('🚐')) {
                            console.log('%c' + line, 'font-weight: bold; color: #2563eb;');
                        } else if (line.startsWith('─────')) {
                            console.log('%c' + line, 'color: #16a34a; font-weight: bold;');
                        } else if (line.includes('[superstructure]')) {
                            console.log('%c' + line, 'color:#7c3aed;font-weight:bold;');
                        } else {
                            console.log(line);
                        }
                    });
                });
            });
        }
        
        console.log('[TRANSPORT] ===============================================');
    };

    useEffect(() => {
        if (!window.db) return;

        let unsubscribeRegistration = null;
        let unsubscribeMatches = null;
        let unsubscribeCatering = null;
        let unsubscribePlaces = null;
        let unsubscribeAllPlaces = null;
        let unsubscribeCateringSettings = null;
        let unsubscribeCategorySettings = null;

        // 0a) MIESTO (places) – mapa placeId → názov (pre zápasy)
        try {
            const placesRef = collection(window.db, 'places');
            unsubscribePlaces = onSnapshot(placesRef, (snapshot) => {
                const map = {};
                snapshot.forEach((docSnap) => {
                    const data = docSnap.data() || {};
                    map[docSnap.id] = data.name || '(bez názvu)';
                });
                placesMapRef.current = map;
            }, (err) => {
                console.error('[TRANSPORT] onSnapshot(places) error:', err);
            });
        } catch (e) {
            console.error('[TRANSPORT] Nepodarilo sa nastaviť listener na places:', e);
        }

        // 0a1) VŠETKY MIESTA (places) – pre záložku „Nastavenia"
        try {
            const placesRef = collection(window.db, 'places');
            unsubscribeAllPlaces = onSnapshot(placesRef, (snapshot) => {
                const list = [];
                snapshot.forEach((docSnap) => {
                    const data = docSnap.data() || {};
                    const loc = data.location;
                    list.push({
                        id: docSnap.id,
                        name: data.name || '(bez názvu)',
                        type: data.type || '(neznámy typ)',
                        capacity: data.capacity ?? null,
                        accommodationType: data.accommodationType || null,
                        note: data.note || null,
                        lat: loc?.latitude ?? data.lat ?? null,
                        lng: loc?.longitude ?? data.lng ?? null,
                        headerColor: data.headerColor || '#1e40af',
                        headerTextColor: data.headerTextColor || '#000000',
                        isExternalArrivalStop: data.isExternalArrivalStop === true,
                        isMeetingPointStop: data.isMeetingPointStop === true,
                    });
                });
                list.sort((a, b) => a.name.localeCompare(b.name, 'sk', { sensitivity: 'base' }));
                setAllPlaces(list);
                allPlacesRef.current = list; // okamžite aktualizuj ref
                setPlacesLoaded(true);        // ← NOVÉ: označ, že places sú načítané

                // Prepočítaj timeline, aby sa nové flagy prejavili
                if (matchesLoadedRef.current && cateringLoadedRef.current && teamsLoadedRef.current) {
                    rebuildAndLogTimeline();
                }
            }, (err) => {
                console.error('[TRANSPORT] onSnapshot(places) pre záložku Nastavenia error:', err);
            });
        } catch (e) {
            console.error('[TRANSPORT] Nepodarilo sa nastaviť listener na places (Nastavenia):', e);
        }

        // 0a1c) TRVANIA JÁZDY MEDZI ZASTÁVKAMI (settings/transportTravelTimes)
        let unsubscribeTravelTimes = null;
        try {
            const ttRef = doc(window.db, 'settings', 'transportTravelTimes');
            unsubscribeTravelTimes = onSnapshot(ttRef, (snap) => {
                const map = {};
                const transfers = [];
                if (snap.exists()) {
                    const data = snap.data() || {};
                    const raw = data.times || {};
                    Object.entries(raw).forEach(([key, v]) => {
                        if (v == null) return;
                        map[key] = {
                            fromId: v.fromId || null,
                            fromName: v.fromName || null,
                            toId: v.toId || null,
                            toName: v.toName || null,
                            minutes: Number(v.minutes) || 0,
                        };
                    });
        
                    // NOVÉ: načítaj uložené vygenerované presuny
                    const rawTransfers = data[TRANSPORT_TRANSFERS_FIELD] || {};
                    Object.entries(rawTransfers).forEach(([key, v]) => {
                        if (!v) return;
                        transfers.push({
                            key,
                            category: v.category || '',
                            teamUid: v.teamUid || null,
                            teamIndex: v.teamIndex ?? null,
                            teamName: v.teamName || null,
                            when: v.when || '',
                            text: v.text || '',
                            fromLocation: v.fromLocation || '',
                            toLocation: v.toLocation || '',
                            dayKey: v.dayKey || null,
                            isWalking: v.isWalking === true,
                            walkingSetAt: v.walkingSetAt || null,
                            walkingSetBy: v.walkingSetBy || null,
                            intermediateStops: Array.isArray(v.intermediateStops) ? v.intermediateStops : [],
                            segments: Array.isArray(v.segments) ? v.segments : [],
                        });
                    });
                    // Po naplnení transfers (pred setSavedTransfers) dopočítaj teamName
                    const lookup = teamsLookupRef.current || {};
                    transfers.forEach((t) => {
                        if (t.teamName && t.teamName.trim() !== '') return; // už máme
                        if (t.teamUid == null || t.teamIndex == null) return;
                        const cat = cleanCategory(t.category);
                        const key = `${t.teamUid}|${cat}|${t.teamIndex}`;
                        const info = lookup[key];
                        if (info && info.teamName) {
                            t.teamName = info.teamName;
                        }
                    });
                    transfers.sort((a, b) => {
                        const catA = String(a.category || '');
                        const catB = String(b.category || '');
                        if (catA !== catB) {
                            return catA.localeCompare(catB, 'sk', { sensitivity: 'base' });
                        }
                        const teamA = String(a.teamName || '');
                        const teamB = String(b.teamName || '');
                        if (teamA !== teamB) {
                            return teamA.localeCompare(teamB, 'sk', { sensitivity: 'base' });
                        }
                        return String(a.when || '').localeCompare(String(b.when || ''), 'sk');
                    });
                }
                setTravelTimes(map);
                savedTransfersRef.current = transfers;
                setSavedTransfers(transfers);
                setTravelTimesLoaded(true);
                travelTimesLoadedRef.current = true;
            }, (err) => {
                console.error('[TRANSPORT] onSnapshot(settings/transportTravelTimes) error:', err);
            });
        } catch (e) {
            console.error('[TRANSPORT] Nepodarilo sa nastaviť listener na transportTravelTimes:', e);
        }

        // 0a1d) KOLEKCIA `transport` – autobusy (type='bus') + riadky (type='busRow')
        let unsubscribeBuses = null;
        try {
            const transportRef = collection(window.db, 'transport');
            unsubscribeBuses = onSnapshot(transportRef, (snapshot) => {
                const busesList = [];
                const rowsGrouped = {};

                snapshot.forEach((docSnap) => {
                    const data = docSnap.data() || {};

                    // --- AUTOBUSY ---
                    if (data.type === 'bus') {
                        const num = Number(data.number);
                        busesList.push({
                            id: docSnap.id,
                            name: data.name || (Number.isFinite(num) ? `Bus ${num}` : 'Bus'),
                            number: Number.isFinite(num) ? num : 0,
                        });
                        return;
                    }

                    // --- RIADKY AUTOBUSOV ---
                    if (data.type === 'busRow') {
                        if (!data.busId || !data.dayKey) return;
                        const key = `${data.busId}|${data.dayKey}`;
                        if (!rowsGrouped[key]) rowsGrouped[key] = [];
                        rowsGrouped[key].push({
                            id: docSnap.id,
                            order: Number(data.order) || 0,
                            timeFrom: data.timeFrom || '',
                            timeTo: data.timeTo || '',
                            placeFrom: data.placeFrom || '',
                            placeTo: data.placeTo || '',
                            teamsIn: Array.isArray(data.teamsIn) ? data.teamsIn : [],
                            teamsOut: Array.isArray(data.teamsOut) ? data.teamsOut : [],
                            count: data.count ?? null,
                        });
                    }
                });

                busesList.sort((a, b) => a.number - b.number);
                Object.values(rowsGrouped).forEach(arr => arr.sort((a, b) => a.order - b.order));

                setBuses(busesList);
                setBusRows(rowsGrouped);
            }, (err) => {
                console.error('[TRANSPORT] onSnapshot(transport) error:', err);
            });
        } catch (e) {
            console.error('[TRANSPORT] Nepodarilo sa nastaviť listener na transport:', e);
        }

        // 0a1f) NOVÉ: SKRATKY NÁZVOV TÍMOV (transport, type='teamShortcut')
        let unsubscribeTeamShortcuts = null;
        try {
            const transportRef = collection(window.db, 'transport');
            unsubscribeTeamShortcuts = onSnapshot(transportRef, (snapshot) => {
                const map = {};
                snapshot.forEach((docSnap) => {
                    const data = docSnap.data() || {};
                    if (data.type !== 'teamShortcut') return;
                    if (!data.category || !data.teamName) return;
                    if (!data.shortcut) return;
                    const key = `${cleanCategory(data.category)}|${String(data.teamName).trim()}`;
                    map[key] = String(data.shortcut).trim();
                });
                setTeamShortcuts(map);
                setTeamShortcutsLoaded(true);
            }, (err) => {
                console.error('[TRANSPORT] onSnapshot(transport – teamShortcuts) error:', err);
            });
        } catch (e) {
            console.error('[TRANSPORT] Nepodarilo sa nastaviť listener na transport (teamShortcuts):', e);
        }        
        
        // 0a2) STRAVOVACIA JEDNOTKA (unitMinutes)
        try {
            const cateringSettingsRef = doc(window.db, 'settings', 'catering');
            unsubscribeCateringSettings = onSnapshot(cateringSettingsRef, (snap) => {
                if (!snap.exists()) {
                    window.__transport_unitMinutes = null;
                    return;
                }
                const data = snap.data() || {};
                const parsed = data.unitMinutes != null
                    ? parseInt(String(data.unitMinutes), 10)
                    : null;
                window.__transport_unitMinutes = (!isNaN(parsed) && parsed > 0) ? parsed : null;
                if (cateringLoadedRef.current) rebuildAndLogTimeline();
            }, (err) => {
                console.error('[TRANSPORT] onSnapshot(settings/catering) error:', err);
            });
        } catch (e) {
            console.error('[TRANSPORT] Nepodarilo sa nastaviť listener na settings/catering:', e);
        }

        // 0a1e) SUPERSTRUCTURE GROUPS – reálne priradenie tímov do skupín
        let unsubscribeSuperstructureGroups = null;
        try {
            const ssgRef = doc(window.db, 'settings', 'superstructureGroups');
            unsubscribeSuperstructureGroups = onSnapshot(ssgRef, (snap) => {
                const map = {};
                if (snap.exists()) {
                    const data = snap.data() || {};
                    console.log('[TRANSPORT][SSG-RAW] Raw data zo settings/superstructureGroups:', data);
                    Object.entries(data).forEach(([categoryName, teamArray]) => {
                        if (!Array.isArray(teamArray)) return;
                        teamArray.forEach((team) => {
                            if (!team || !team.teamName) return;
                            if (!team.groupName) return;
                            const cat = cleanCategory(categoryName);
                            const grp = String(team.groupName).trim();
                            const key = `${cat}|${grp}`;
                            if (!map[key]) map[key] = new Set();
                            map[key].add(String(team.teamName).trim());
                        });
                    });
                } else {
                    console.warn('[TRANSPORT][SSG-RAW] Dokument settings/superstructureGroups NEEXISTUJE!');
                }
                superstructureGroupsRef.current = map;
                console.log('[TRANSPORT][SSG-MAP] Vytvorená mapa:', 
                    Object.fromEntries(Object.entries(map).map(([k, v]) => [k, [...v]]))
                );
                if (matchesLoadedRef.current && cateringLoadedRef.current && teamsLoadedRef.current) {
                    rebuildAndLogTimeline();
                }
            }, (err) => {
                console.error('[TRANSPORT] onSnapshot(settings/superstructureGroups) error:', err);
            });
        } catch (e) {
            console.error('[TRANSPORT] Nepodarilo sa nastaviť listener na superstructureGroups:', e);
        }

        // 0a3) KATEGÓRIE (trvanie zápasu + farby pre dopravu)
        try {
            const catRef = doc(window.db, 'settings', 'categories');
            unsubscribeCategorySettings = onSnapshot(catRef, (snap) => {
                const map = {};
                const colorMap = {};
                if (snap.exists()) {
                    const data = snap.data() || {};
                    Object.entries(data).forEach(([catId, catData]) => {
                        if (!catData) return;
                        const periods = catData.periods ?? 2;
                        const periodDuration = catData.periodDuration ?? 20;
                        const breakDuration = catData.breakDuration ?? 2;
                        const matchBreak = catData.matchBreak ?? 5;
                        const matchDuration = (periodDuration + breakDuration) * periods - breakDuration;
                        const info = { matchDuration, matchBreak };
                        if (catData.name) map[catData.name] = info;
                        map[catId] = info;

                        // NOVÉ: farba pre dopravu – uložíme pod názov aj pod ID
                        const transportColor = catData.transportColor || null;
                        const drawColor = catData.drawColor || null;
                        if (transportColor) {
                            if (catData.name) colorMap[String(catData.name).trim()] = transportColor;
                            colorMap[catId] = transportColor;
                        }
                        // Voliteľne aj drawColor (ak by si ho chcel použiť inde)
                        if (drawColor) {
                            if (catData.name) colorMap[`__draw__|${String(catData.name).trim()}`] = drawColor;
                            colorMap[`__draw__|${catId}`] = drawColor;
                        }
                    });
                }
                window.__transport_categories = map;
                transportColorsRef.current = colorMap;
                setTransportColors(colorMap);
                if (matchesLoadedRef.current) rebuildAndLogTimeline();
            }, (err) => {
                console.error('[TRANSPORT] onSnapshot(settings/categories) error:', err);
            });
        } catch (e) {
            console.error('[TRANSPORT] Nepodarilo sa nastaviť listener na settings/categories:', e);
        }

        // 0b) POUŽÍVATELIA (users) – lookup pre názvy tímov
        const loadTeamsLookup = async () => {
            try {
                const usersRef = collection(window.db, 'users');
                const usersSnap = await getDocs(usersRef);
                const lookup = {};
        
                usersSnap.forEach((userDoc) => {
                    const userData = userDoc.data() || {};
                    const teams = userData.teams;
                    if (!teams || typeof teams !== 'object') return;
        
                    Object.entries(teams).forEach(([category, teamArray]) => {
                        if (!Array.isArray(teamArray)) return;
                        teamArray.forEach((team, teamIndex) => {
                            if (!team || !team.teamName) return;
                            const cat = cleanCategory(category);
                            const key = `${userDoc.id}|${cat}|${teamIndex}`;
                            lookup[key] = {
                                teamName: team.teamName,
                                category: cat,
                                teamIndex,
                                userId: userDoc.id,   // ID používateľa (dokumentu v users)
                            };
                        });
                    });
                });
        
                teamsLookupRef.current = lookup;
                teamsLookupLoadedRef.current = true;
        
                // Doplň teamName do už načítaných savedTransfers (ak chýba)
                setSavedTransfers((prev) => {
                    const updated = prev.map((t) => {
                        if (t.teamName && t.teamName.trim() !== '') return t;
                        if (t.teamUid == null || t.teamIndex == null) return t;
                        const cat = cleanCategory(t.category);
                        const k = `${t.teamUid}|${cat}|${t.teamIndex}`;
                        const info = lookup[k];
                        return info && info.teamName ? { ...t, teamName: info.teamName } : t;
                    });
                    savedTransfersRef.current = updated;   // ← NOVÉ
                    return updated;
                });
        
                // Ak už boli načítané matches/catering/teams, prerob timeline
                // (aby sa presuny uložili s teamUid/teamIndex)
                if (matchesLoadedRef.current && cateringLoadedRef.current && teamsLoadedRef.current) {
                    rebuildAndLogTimeline();
                }
            } catch (err) {
                console.error('[TRANSPORT] Chyba pri načítaní lookup tímov:', err);
            }
        };
        
        loadTeamsLookup();

        // 0b2) VEĽKOSTI POLÍ TÍMOV (počty členov) – pre zobrazenie za názvom tímu v presunoch
        let unsubscribeTeamCounts = null;
        try {
            const usersRef = collection(window.db, 'users');
            unsubscribeTeamCounts = onSnapshot(usersRef, (snapshot) => {
                const map = {};
                snapshot.forEach((userDoc) => {
                    const userData = userDoc.data() || {};
                    const teams = userData.teams;
                    if (!teams || typeof teams !== 'object') return;
        
                    Object.entries(teams).forEach(([category, teamArray]) => {
                        if (!Array.isArray(teamArray)) return;
                        const cat = cleanCategory(category);
                        teamArray.forEach((team) => {
                            if (!team || !team.teamName) return;
                            const teamName = String(team.teamName).trim();
                            const key = `${cat}|${teamName}`;
                            map[key] = {
                                players: Array.isArray(team.playerDetails) ? team.playerDetails.length : 0,
                                menRT: Array.isArray(team.menTeamMemberDetails) ? team.menTeamMemberDetails.length : 0,
                                womenRT: Array.isArray(team.womenTeamMemberDetails) ? team.womenTeamMemberDetails.length : 0,
                                menDrivers: Array.isArray(team.driverDetailsMale) ? team.driverDetailsMale.length : 0,
                                womenDrivers: Array.isArray(team.driverDetailsFemale) ? team.driverDetailsFemale.length : 0,
                            };
                        });
                    });
                });
                setTeamCounts(map);
            }, (err) => {
                console.error('[TRANSPORT] onSnapshot(users – team counts) error:', err);
            });
        } catch (e) {
            console.error('[TRANSPORT] Nepodarilo sa nastaviť listener na users (team counts):', e);
        }

        // 1) DÁTUMY TURNAJA + GENEROVANIE DNI PRE PLÁNOVANIE
        try {
            const regRef = doc(window.db, 'settings', 'registration');
            unsubscribeRegistration = onSnapshot(regRef, (snap) => {
                if (!snap.exists()) {
                    setTournamentDays([]);
                    setTournamentDaysLoaded(true);
                    return;
                }
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

                if (!start || !end) {
                    setTournamentDays([]);
                    setTournamentDaysLoaded(true);
                    return;
                }

                const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
                const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());

                const days = [];
                const cursor = new Date(startDay);
                while (cursor <= endDay) {
                    const dateObj = new Date(cursor);
                    const dayKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
                    days.push({
                        dayKey,
                        dateLabel: formatDateDDMMYYYY(dateObj),
                        dayName: dateObj.toLocaleDateString('sk-SK', { weekday: 'long' }),
                    });
                    cursor.setDate(cursor.getDate() + 1);
                }
                setTournamentDays(days);
                setTournamentDaysLoaded(true);
            }, (err) => {
                console.error('[TRANSPORT] onSnapshot(settings/registration) error:', err);
            });
        } catch (e) {
            console.error('[TRANSPORT] Nepodarilo sa nastaviť listener na settings/registration:', e);
        }

        // 2) TÍMY – ubytovanie + typ dopravy + čas príchodu + skupina
        const loadTeamsWithAccommodation = async () => {
            try {
                const usersRef = collection(window.db, 'users');
                const usersSnap = await getDocs(usersRef);

                const buffer = [];

                // Pomocná funkcia na spracovanie jedného tímu
                const processTeam = (team, cat, isSuperstructureTeam, isRegistered = false) => {
                    if (!team || !team.teamName) return;
                    const trimmedName = team.teamName.trim();
                    const accomType = team.accommodation?.type?.trim?.() || '';
                    const accomName = team.accommodation?.name?.trim?.() || '';

                    // arrivalType môže byť buď string alebo objekt { type, time }
                    let arrivalTypeRaw = '';
                    let arrivalDisplayRaw = '---';
                    let arrivalTimeRaw = '';
                    if (team.arrival) {
                        if (typeof team.arrival === 'string') {
                            arrivalTypeRaw = team.arrival.trim();
                            arrivalDisplayRaw = arrivalTypeRaw || '---';
                        } else if (typeof team.arrival === 'object') {
                            if (team.arrival.type) {
                                arrivalTypeRaw = String(team.arrival.type).trim();
                            }
                            if (team.arrival.time) {
                                arrivalTimeRaw = String(team.arrival.time).trim();
                            }
                            arrivalDisplayRaw = formatArrival(team.arrival);
                        }
                    }

                    // isSuperstructure = true, ak tím pochádza z kolekcie `superstructure`
                    // ALEBO má explicitný flag v DB
                    const isSS = isSuperstructureTeam === true || team.isSuperstructure === true;

                    buffer.push({
                        category: cat,
                        teamName: trimmedName,
                        accommodationType: accomType || '(nešpecifikovaný)',
                        accommodationName: accomName,
                        arrivalDisplay: arrivalDisplayRaw,
                        arrivalType: arrivalTypeRaw,
                        arrivalTime: arrivalTimeRaw,
                        groupName: team.groupName ? String(team.groupName).trim() : null,
                        order: (typeof team.order === 'number' && team.order > 0) ? team.order : null,
                        isSuperstructure: isSS,
                        isRegistered: isRegistered,
                    });
                };

                // 2a) Používatelia (users) – bežné (registrované) tímy
                //     Zároveň si vytvoríme Set všetkých názvov tímov z users (per kategória),
                //     aby sme vedeli rozlíšiť, ktoré tímy z matches sú superstructure (nie sú v users).
                const registeredTeamNamesByCategory = {}; // category → Set(teamName)
                usersSnap.forEach((userDoc) => {
                    const userData = userDoc.data() || {};
                    const teams = userData.teams;
                    if (!teams || typeof teams !== 'object') return;

                    Object.entries(teams).forEach(([category, teamArray]) => {
                        if (!Array.isArray(teamArray)) return;
                        const cat = cleanCategory(category);
                        if (!registeredTeamNamesByCategory[cat]) {
                            registeredTeamNamesByCategory[cat] = new Set();
                        }
                        teamArray.forEach((team) => {
                            if (!team || !team.teamName) return;
                            const trimmed = team.teamName.trim();
                            registeredTeamNamesByCategory[cat].add(trimmed);
                            processTeam(team, cat, false, true);
                        });
                    });
                });

                // 2b) Superstructure – z kolekcie `superstructure` (ak je dostupná)
                //     A ZÁROVEŇ – všetky tímy z `matches`, ktoré NIE SÚ v `users`.
                //
                //     Superstructure tímy sú generované turnajovým systémom (napr. "U12 D 1A",
                //     "U10 D LSF01", "U12 CH WSF02") a NIE SÚ registrované v `users`.

                const ssTeamsFromMatches = new Map(); // key: category|teamName → { category, teamName }

                (matchesBufferRef.current || []).forEach((m) => {
                    [m.home, m.away].forEach((teamName) => {
                        if (!teamName) return;
                        const cat = m.category;
                        const registeredSet = registeredTeamNamesByCategory[cat];
                        const isRegistered = registeredSet && registeredSet.has(teamName);
        
                        // NOVÉ: Aj registrované tímy, ktoré majú v názve posledné písmeno (napr. "5B"),
                        // považuj za superstructure (boli pridané do users len kvôli ubytovaniu).
                        const looksLikeSuperstructure = /\d[A-ZÁ-Ž]\s*$/.test(String(teamName).trim());
        
                        if (isRegistered && !looksLikeSuperstructure) return; // je to skutočný registrovaný tím
                        
                        const key = `${cat}|${teamName}`;
                        if (!ssTeamsFromMatches.has(key)) {
                            ssTeamsFromMatches.set(key, { category: cat, teamName });
                        }
                    });
                });

                // Skús tiež kolekciu `superstructure` (ak by bola dostupná pre rules)
                try {
                    const ssRef = collection(window.db, 'superstructure');
                    const ssSnap = await getDocs(ssRef);
                    ssSnap.forEach((docSnap) => {
                        const data = docSnap.data() || {};
                        const cat = cleanCategory(
                            data.category || data.categoryName || '(bez kategórie)'
                        );
                        if (Array.isArray(data.teams)) {
                            data.teams.forEach((team) => {
                                if (!team || !team.teamName) return;
                                const trimmedName = team.teamName.trim();
                                const key = `${cat}|${trimmedName}`;
                                if (!ssTeamsFromMatches.has(key)) {
                                    ssTeamsFromMatches.set(key, { category: cat, teamName: trimmedName });
                                }
                            });
                        } else if (data.teams && typeof data.teams === 'object') {
                            Object.entries(data.teams).forEach(([catKey, teamArray]) => {
                                if (!Array.isArray(teamArray)) return;
                                const c = cleanCategory(catKey);
                                teamArray.forEach((team) => {
                                    if (!team || !team.teamName) return;
                                    const trimmedName = team.teamName.trim();
                                    const key = `${c}|${trimmedName}`;
                                    if (!ssTeamsFromMatches.has(key)) {
                                        ssTeamsFromMatches.set(key, { category: c, teamName: trimmedName });
                                    }
                                });
                            });
                        } else if (data.teamName) {
                            const trimmedName = data.teamName.trim();
                            const key = `${cat}|${trimmedName}`;
                            if (!ssTeamsFromMatches.has(key)) {
                                ssTeamsFromMatches.set(key, { category: cat, teamName: trimmedName });
                            }
                        }
                    });
                } catch (ssErr) {
                    // Ak rules nedovolia prístup, ignorujeme (očakávané)
                }

                // Zapíš superstructure tímy do bufferu (existujúce označ, nové pridaj)
                const existingByKey = new Map();
                buffer.forEach((b) => {
                    existingByKey.set(`${b.category}|${b.teamName}`, b);
                });

                ssTeamsFromMatches.forEach(({ category: cat, teamName: trimmedName }) => {
                    const key = `${cat}|${trimmedName}`;
                    if (existingByKey.has(key)) {
                        // Tím už je v bufferi (napr. z users 2a) – označ ho ako superstructure
                        const existing = existingByKey.get(key);
                        existing.isSuperstructure = true;
                        existing.isRegistered = false;
                    } else {
                        // Tím ešte nie je v bufferi – pridaj ho ako superstructure
                        // NOVÉ: Skús odvodiť groupName z názvu tímu (napr. "U12 CH 5B" → "skupina B")
                        let derivedGroupName = null;
                        const nameMatch = /\d([A-ZÁ-Ž])\s*$/.exec(String(trimmedName).trim());
                        if (nameMatch) {
                            const lastChar = nameMatch[1];
                            // Prejdi všetky existujúce skupiny v bufferi a nájdi takú, ktorá končí na rovnaké písmeno
                            const candidateGroups = new Set();
                            buffer.forEach((b) => {
                                if (b.category === cat && b.groupName) {
                                    const gLastChar = String(b.groupName).trim().slice(-1).toUpperCase();
                                    if (gLastChar === lastChar) candidateGroups.add(b.groupName);
                                }
                            });
                            if (candidateGroups.size > 0) {
                                derivedGroupName = [...candidateGroups][0];
                            } else {
                                derivedGroupName = `skupina ${lastChar}`;
                            }
                        }
                        
                        buffer.push({
                            category: cat,
                            teamName: trimmedName,
                            accommodationType: '(nešpecifikovaný)',
                            accommodationName: '',
                            arrivalDisplay: '---',
                            arrivalType: '',
                            groupName: derivedGroupName,  // ← TOTO JE KĽÚČOVÉ
                            order: null,
                            isSuperstructure: true,
                            isRegistered: false,
                        });
                    }
                });
                
                teamsArrivalBufferRef.current = buffer;
                teamsLoadedRef.current = true;

                // Načítaj cache pre superstructure tímy a potom rebuild
                preloadAccommodationsForSuperstructureTeams().then(() => {
                    rebuildAndLogTimeline();
                });

            } catch (err) {
                console.error('[TRANSPORT] Chyba pri načítaní tímov s ubytovaním:', err);
            }
        };

        // 3) VŠETKY ZÁPASY PODĽA KATEGÓRIÍ
        const buildMatchesBuffer = (snapshot) => {
            const buffer = [];

            snapshot.forEach((docSnap) => {
                const data = docSnap.data() || {};
                const category = cleanCategory(data.categoryName || data.categoryId || '(neznáma kategória)');

                const homeDisplayName = resolveTeamName(data.homeTeamIdentifier);
                const awayDisplayName = resolveTeamName(data.awayTeamIdentifier);

                const hallId = data.hallId || null;
                const hallName = hallId
                    ? (placesMapRef.current[hallId] || `(neznáma hala: ${hallId})`)
                    : null;

                let scheduledTs = null;
                if (data.scheduledTime) {
                    try {
                        scheduledTs = data.scheduledTime.toDate
                            ? data.scheduledTime.toDate().getTime()
                            : new Date(data.scheduledTime).getTime();
                    } catch (e) {
                        scheduledTs = null;
                    }
                }

                const special = data.isPlacementMatch
                    ? ` [o ${data.placementRank}. miesto]`
                    : data.matchType
                        ? ` [${data.matchType}]`
                        : '';

                let scheduledEndTs = null;
                let scheduledEndTime = null;
                if (scheduledTs != null) {
                    const catInfo = window.__transport_categories
                        ? (window.__transport_categories[category] || window.__transport_categories[data.categoryId])
                        : null;
                    const matchDuration = catInfo?.matchDuration ?? 0;
                    if (matchDuration > 0) {
                        scheduledEndTs = scheduledTs + matchDuration * 60000;
                        scheduledEndTime = formatDateTime(new Date(scheduledEndTs));
                    }
                }

                const groupName = cleanCategory(data.groupName || '');

                buffer.push({
                    category,
                    home: homeDisplayName,
                    away: awayDisplayName,
                    scheduledTs,
                    scheduledTime: data.scheduledTime ? formatDateTime(data.scheduledTime) : null,
                    scheduledEndTs,
                    scheduledEndTime,
                    hallName,
                    hallId,
                    special,
                    groupName: groupName || null,
                    matchType: data.matchType || null,
                    homeTeamIdentifier: data.homeTeamIdentifier || null,
                    awayTeamIdentifier: data.awayTeamIdentifier || null,
                });
            });

            matchesBufferRef.current = buffer;
            matchesLoadedRef.current = true;

            // DÔLEŽITÉ: Po načítaní matches musia byť znovu načítané aj tímy,
            // aby sa z matches detegovali superstructure tímy (ktoré nie sú v users).
            if (typeof loadTeamsWithAccommodation === 'function') {
                loadTeamsWithAccommodation();
            }
        };

        try {
            const matchesRef = collection(window.db, 'matches');
            unsubscribeMatches = onSnapshot(matchesRef, (snapshot) => {
                buildMatchesBuffer(snapshot);
            }, (err) => {
                console.error('[TRANSPORT] onSnapshot(matches) error:', err);
            });
        } catch (e) {
            console.error('[TRANSPORT] Nepodarilo sa nastaviť listener na matches:', e);
        }

        // 4) VŠETKY NAPLÁNOVANÉ STRAVOVANIA
        const getRowTeamName = (a) => {
            const lookup = teamsLookupRef.current;

            if (a.isSuperstructure === true) {
                const cat = cleanCategory(a.clickedTeamCategory || '');
                const key = `${a.clickedTeamUid}|${cat}|${a.clickedTeamIndex}`;
                const found = lookup[key];
                if (found) return found.teamName;
                return `(row team: ${a.clickedTeamUid || '?'} / ${a.clickedTeamCategory || '?'} / ${a.clickedTeamIndex ?? '?'})`;
            }

            const cat = cleanCategory(a.category || a.categoryName || '');
            const key = `${a.teamUid}|${cat}|${a.teamIndex}`;
            const found = lookup[key];
            if (found) return found.teamName;
            return a.teamName || '---';
        };

        const buildCateringBuffer = (snapshot) => {
            const buffer = [];

            snapshot.forEach((docSnap) => {
                const data = docSnap.data() || {};

                const dayKey = data.dayKey || null;
                const mealType = data.mealType || null;
                const slotFrom = data.slotFrom || null;
                const placeName = data.placeName || data.placeId || '(bez miesta)';
                let category;
                let teamName;

                if (data.isSuperstructure === true) {
                    category = cleanCategory(data.categoryName || data.category || '(bez kategórie)');
                    teamName = (data.teamName || '').trim() || '(neznámy superstructure tím)';
                } else {
                    category = cleanCategory(data.category || data.categoryName || '(bez kategórie)');
                    teamName = getRowTeamName(data);
                }

                const ts = dayKeyAndSlotToTimestamp(dayKey, slotFrom);

                let slotTo = null;
                let slotToTs = null;
                const unitMin = window.__transport_unitMinutes;
                if (slotFrom && unitMin && unitMin > 0) {
                    const [h, mi] = slotFrom.split(':').map(Number);
                    const startMin = h * 60 + mi;
                    const endMin = startMin + unitMin;
                    const endH = String(Math.floor(endMin / 60)).padStart(2, '0');
                    const endM = String(endMin % 60).padStart(2, '0');
                    slotTo = `${endH}:${endM}`;
                    slotToTs = ts != null ? ts + unitMin * 60000 : null;
                }

                buffer.push({
                    category,
                    teamName,
                    ts,
                    dayKey,
                    slotFrom,
                    slotTo,
                    slotToTs,
                    mealType,
                    placeName,
                    isSuperstructure: data.isSuperstructure === true,
                    isPriority: data.isPriority === true,
                    superstructureTeamName: data.isSuperstructure === true
                        ? (data.teamName || '').trim() || null
                        : null,
                });
            });

            cateringBufferRef.current = buffer;
            cateringLoadedRef.current = true;

            rebuildAndLogTimeline();
        };

        try {
            const cateringRef = collection(window.db, 'catering');
            unsubscribeCatering = onSnapshot(cateringRef, (snapshot) => {
                buildCateringBuffer(snapshot);
            }, (err) => {
                console.error('[TRANSPORT] onSnapshot(catering) error:', err);
            });
        } catch (e) {
            console.error('[TRANSPORT] Nepodarilo sa nastaviť listener na catering:', e);
        }

        return () => {
            if (unsubscribeRegistration) unsubscribeRegistration();
            if (unsubscribeMatches) unsubscribeMatches();
            if (unsubscribeCatering) unsubscribeCatering();
            if (unsubscribePlaces) unsubscribePlaces();
            if (unsubscribeAllPlaces) unsubscribeAllPlaces();
            if (unsubscribeCateringSettings) unsubscribeCateringSettings();
            if (unsubscribeCategorySettings) unsubscribeCategorySettings();
            if (unsubscribeTravelTimes) unsubscribeTravelTimes();
            if (unsubscribeSuperstructureGroups) unsubscribeSuperstructureGroups();
            if (unsubscribeBuses) unsubscribeBuses();
            if (unsubscribeTeamCounts) unsubscribeTeamCounts();
            if (unsubscribeTeamShortcuts) unsubscribeTeamShortcuts();
        };
    }, []);

    // Zrkadlenie allPlaces pre rebuildAndLogTimeline
    useEffect(() => {
        allPlacesRef.current = allPlaces;
    }, [allPlaces]);

    // Naplnenie `stopsList` pri zmene `allPlaces`
    useEffect(() => {
        const stops = allPlaces
            .filter((p) => p.type === 'zastavka')
            .sort((a, b) => a.name.localeCompare(b.name, 'sk', { sensitivity: 'base' }));
        setStopsList(stops);
    }, [allPlaces]);

    useEffect(() => {
        const draft = {};
        Object.entries(travelTimes).forEach(([key, v]) => {
            draft[key] = v.minutes != null ? String(v.minutes) : '';
        });
        setTravelTimesDraft(draft);
    }, [travelTimes]);

    // ============================================================
    // AUTOMATICKÝ PREPOČET timeTo PRE VŠETKY RIADKY AUTOBUSOV
    // (spustí sa pri zmene busRows alebo travelTimes)
    // ============================================================
    useEffect(() => {
        if (!window.db) return;
        // NOVÉ: Kým nie je načítaný travelTimes, neprepočítavaj timeTo
        // (inak by sa pri prvotnom načítavaní zbytočne zapisovalo do DB
        // a spôsobilo by to viacnásobný re-render + duplicitné varovanie)
        if (!travelTimesLoaded) return;
        if (!busRows || Object.keys(busRows).length === 0) return;

        Object.values(busRows).forEach((rows) => {
            (rows || []).forEach((row) => {
                // Použiť rovnakú logiku ako v renderBusRow
                const placeFrom = row.placeFrom;
                const placeTo = row.placeTo;
                if (!placeFrom || !placeTo) return;
    
                let minutes = null;
                const keyId = `${placeFrom}|${placeTo}`;
                if (travelTimes[keyId] && travelTimes[keyId].minutes != null) {
                    minutes = Number(travelTimes[keyId].minutes);
                } else {
                    const fromStop = stopsList.find((s) => s.name === placeFrom || s.id === placeFrom);
                    const toStop = stopsList.find((s) => s.name === placeTo || s.id === placeTo);
                    if (fromStop && toStop) {
                        const key = `${fromStop.id}|${toStop.id}`;
                        if (travelTimes[key] && travelTimes[key].minutes != null) {
                            minutes = Number(travelTimes[key].minutes);
                        }
                    }
                }
    
                if (minutes == null) return;
                if (!row.timeFrom || !/^\d{1,2}:\d{2}$/.test(row.timeFrom)) return;
    
                const [h, m] = row.timeFrom.split(':').map(Number);
                const total = h * 60 + m + minutes;
                const endH = Math.floor(total / 60) % 24;
                const endM = total % 60;
                const computed = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
    
                if (computed !== (row.timeTo || '')) {
                    updateBusRowField(row.id, 'timeTo', computed);
                }
            });
        });
    }, [busRows, travelTimes, stopsList, travelTimesLoaded]);

    // ============================================================
    // NOVÉ: Automatická synchronizácia "Miesto od" s predchádzajúcim
    // riadkom. Ak predchádzajúci riadok má placeTo, aktuálny riadok
    // musí mať placeFrom = prevRow.placeTo.
    // ============================================================
    useEffect(() => {
        if (!window.db) return;
        // NOVÉ: Kým nie je načítaný travelTimes, nesynchronizuj placeFrom
        if (!travelTimesLoaded) return;
        if (!busRows || Object.keys(busRows).length === 0) return;

        Object.values(busRows).forEach((rows) => {
            const sorted = (rows || [])
                .slice()
                .sort((a, b) => (a.order || 0) - (b.order || 0));

            for (let i = 1; i < sorted.length; i++) {
                const prevRow = sorted[i - 1];
                const currRow = sorted[i];
                if (!prevRow.placeTo || prevRow.placeTo.trim() === '') continue;
                if ((currRow.placeFrom || '') === prevRow.placeTo) continue;

                updateBusRowField(currRow.id, 'placeFrom', prevRow.placeTo);
            }
        });
    }, [busRows, travelTimesLoaded]);

    // ============================================================
    // DETEKCIA CHÝBAJÚCICH TRVANÍ JÁZDY PRE RIADKY AUTOBUSOV
    // (placeFrom + placeTo vyplnené, ale travelTimes[fromId|toId] chýba)
    // ============================================================
    useEffect(() => {
        // Kým nie je načítaný prvý snapshot travelTimes, varovanie nerieš
        if (!travelTimesLoaded) {
            setMissingTravelTimeWarning([]);
            return;
        }

        // NOVÉ: Kým nie je načítaný zoznam zastávok (places), varovanie
        // nerieš. Bez zastávok sa nedá overiť, či trvanie existuje,
        // pretože getTravelMinutes potrebuje ID zastávok z `stopsList`.
        // Tým sa zabráni falošnému varovaniu pri prvotnom načítaní,
        // keď ešte places nedorazili z Firestore.
        if (!placesLoaded || !stopsList || stopsList.length === 0) {
            setMissingTravelTimeWarning([]);
            return;
        }
    
        if (!busRows || Object.keys(busRows).length === 0) {
            setMissingTravelTimeWarning([]);
            return;
        }
    
        const missing = [];
        const seen = new Set();
    
        Object.values(busRows).forEach((rows) => {
            (rows || []).forEach((row) => {
                const placeFrom = row.placeFrom;
                const placeTo = row.placeTo;
                if (!placeFrom || !placeTo) return;
    
                // Zisti, či existuje trvanie (rovnaká logika ako getTravelMinutes)
                let minutes = null;
    
                // 1) Priamo ID
                const keyId = `${placeFrom}|${placeTo}`;
                if (travelTimes[keyId] && travelTimes[keyId].minutes != null) {
                    minutes = Number(travelTimes[keyId].minutes);
                } else {
                    // 2) Cez názvy → ID
                    const fromStop = stopsList.find((s) => s.name === placeFrom || s.id === placeFrom);
                    const toStop = stopsList.find((s) => s.name === placeTo || s.id === placeTo);
                    if (fromStop && toStop) {
                        const key = `${fromStop.id}|${toStop.id}`;
                        if (travelTimes[key] && travelTimes[key].minutes != null) {
                            minutes = Number(travelTimes[key].minutes);
                        }
                    }
                }
    
                if (minutes != null) return; // trvanie existuje – OK
    
                // Chýba trvanie → pridaj do zoznamu (bez duplicitov)
                const dedupKey = `${placeFrom}|${placeTo}`;
                if (seen.has(dedupKey)) return;
                seen.add(dedupKey);
    
                missing.push({
                    from: placeFrom,
                    to: placeTo,
                    rowId: row.id,
                });
            });
        });
    
        setMissingTravelTimeWarning(missing);
    }, [busRows, travelTimes, stopsList, travelTimesLoaded, placesLoaded]);
    // ============================================================
    // PRIDANIE RIADKU DO AUTOBUSU PRE DANÝ DEŇ
    // ============================================================
    const addBusRow = async (bus, dayKey) => {
        if (!window.db || !bus || !dayKey) return;
        try {
            const existing = busRows[`${bus.id}|${dayKey}`] || [];
            const nextOrder = existing.length > 0
                ? Math.max(...existing.map(r => r.order || 0)) + 1
                : 1;
    
            // Predvyplnenie z posledného riadku
            let initialPlaceFrom = '';
            let initialTimeFrom = '';
    
            if (existing.length > 0) {
                // Zober riadok s najvyšším order (posledný)
                const lastRow = existing.reduce((a, b) => (a.order > b.order ? a : b));
    
                // Miesto od = miesto do predchádzajúceho riadku
                if (lastRow.placeTo) {
                    initialPlaceFrom = lastRow.placeTo;
                }
    
                // Čas od = čas do predchádzajúceho riadku + 2 minúty
                if (lastRow.timeTo && /^\d{1,2}:\d{2}$/.test(lastRow.timeTo)) {
                    const [h, m] = lastRow.timeTo.split(':').map(Number);
                    const total = h * 60 + m + 2;
                    const endH = Math.floor(total / 60) % 24;
                    const endM = total % 60;
                    initialTimeFrom = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
                }
            }
    
            await addDoc(collection(window.db, 'transport'), {
                type: 'busRow',
                busId: bus.id,
                busName: bus.name,
                dayKey,
                order: nextOrder,
                timeFrom: initialTimeFrom,
                timeTo: '',
                placeFrom: initialPlaceFrom,
                placeTo: '',
                teamsIn: [],
                teamsOut: [],
            });
            window.showGlobalNotification('Riadok pridaný.', 'success');
        } catch (err) {
            console.error('[TRANSPORT] Chyba pri pridávaní riadku:', err);
            window.showGlobalNotification('Nepodarilo sa pridať riadok.', 'error');
        }
    };

    // ============================================================
    // VLOŽENIE RIADKU MEDZI DVA EXISTUJÚCE RIADKY (hover "+" v medzere)
    //
    // Pravidlá pre zastávky:
    //  - placeFrom = prevRow.placeTo
    //  - placeTo   = nextRow.placeFrom
    //  - ak sú placeFrom a placeTo rovnaké → použijú sa obe (placeFrom = placeTo)
    // ============================================================
    const insertBusRowBetween = async (bus, dayKey, prevRow, nextRow) => {
        if (!window.db || !bus || !dayKey || !prevRow || !nextRow) return;
    
        try {
            const rowsKey = `${bus.id}|${dayKey}`;
            const allRows = (busRows[rowsKey] || [])
                .slice()
                .sort((a, b) => (a.order || 0) - (b.order || 0));
    
            const prevIdx = allRows.findIndex((r) => r.id === prevRow.id);
            const nextIdx = allRows.findIndex((r) => r.id === nextRow.id);
            if (prevIdx === -1 || nextIdx === -1 || nextIdx !== prevIdx + 1) return;
    
            // Zastávky podľa pravidla
            const placeFrom = prevRow.placeTo || '';
            const placeTo = nextRow.placeFrom || '';
    
            // Čas od = čas do predchádzajúceho riadku
            let initialTimeFrom = '';
            if (prevRow.timeTo && /^\d{1,2}:\d{2}$/.test(prevRow.timeTo)) {
                const [h, m] = prevRow.timeTo.split(':').map(Number);
                let total = h * 60 + m + 2;
                total = ((total % (24 * 60)) + (24 * 60)) % (24 * 60);
                const endH = Math.floor(total / 60);
                const endM = total % 60;
                initialTimeFrom = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
            }
    
            // Nový order – vložíme medzi prev a next; ostatné posunieme
            const newOrder = (prevRow.order || 0) + 1;
    
            // Posunieme order všetkých nasledujúcich riadkov (od nextRow ďalej)
            const shiftPromises = [];
            for (let i = nextIdx; i < allRows.length; i++) {
                const r = allRows[i];
                const newOrderValue = (r.order || 0) + 1;
                if (newOrderValue !== r.order) {
                    shiftPromises.push(
                        updateDoc(doc(window.db, 'transport', r.id), { order: newOrderValue })
                    );
                }
            }
            await Promise.all(shiftPromises);
    
            // Vytvor nový riadok
            await addDoc(collection(window.db, 'transport'), {
                type: 'busRow',
                busId: bus.id,
                busName: bus.name,
                dayKey,
                order: newOrder,
                timeFrom: initialTimeFrom,
                timeTo: '',
                placeFrom,
                placeTo,
                teamsIn: [],
                teamsOut: [],
            });
    
            window.showGlobalNotification('Riadok vložený medzi existujúce riadky.', 'success');
        } catch (err) {
            console.error('[TRANSPORT] Chyba pri vkladaní riadku medzi riadky:', err);
            window.showGlobalNotification('Nepodarilo sa vložiť riadok.', 'error');
        }
    };

    // ============================================================
    // AKTUALIZÁCIA POĽA RIADKU
    // ============================================================
    const updateBusRowField = async (rowId, field, value) => {
        if (!window.db || !rowId) return;
        try {
            await updateDoc(doc(window.db, 'transport', rowId), { [field]: value });
        } catch (err) {
            console.error('[TRANSPORT] Chyba pri aktualizácii riadku:', err);
            window.showGlobalNotification('Nepodarilo sa uložiť zmenu.', 'error');
        }
    };

    const shiftBusRowsAfterChange = async (busId, dayKey, currentRowId, deltaMinutes) => {
        if (!window.db || !busId || !dayKey) return;
        if (!deltaMinutes || isNaN(deltaMinutes) || deltaMinutes === 0) return;
    
        const rowsKey = `${busId}|${dayKey}`;
        const allRows = (busRows[rowsKey] || [])
            .slice()
            .sort((a, b) => (a.order || 0) - (b.order || 0));
    
        const currentIdx = allRows.findIndex((r) => r.id === currentRowId);
        if (currentIdx === -1) return;
    
        // Pomocná: posun "HH:MM" o daný počet minút
        const shiftTime = (timeStr, delta) => {
            if (!timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) return timeStr;
            const [h, m] = timeStr.split(':').map(Number);
            let total = h * 60 + m + Number(delta);
            total = ((total % (24 * 60)) + (24 * 60)) % (24 * 60);
            const endH = Math.floor(total / 60);
            const endM = total % 60;
            return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
        };
    
        const updates = [];
    
        for (let i = currentIdx + 1; i < allRows.length; i++) {
            const prev = allRows[i - 1];
            const curr = allRows[i];
    
            // ============================================================
            // NOVÉ: Pre PRVÝ nasledujúci riadok NEKONTROLUJ gap.
            // Dôvod: aktuálny riadok má nový timeFrom, ale jeho timeTo
            // sa ešte neprepočítal (useEffect ho dopočíta asynchrónne).
            // Takže prev.timeTo je starý a gap by bol nesprávny.
            // Pre ďalšie riadky (i > currentIdx + 1) už máme aktuálne
            // hodnoty, takže gap kontrolovať môžeme.
            // ============================================================
            if (i > currentIdx + 1) {
                const gap = getGapMinutes(prev.timeTo, curr.timeFrom);
                if (gap != null && gap > 2) {
                    break;
                }
            }
    
            const newTimeFrom = shiftTime(curr.timeFrom, deltaMinutes);
            const newTimeTo = shiftTime(curr.timeTo, deltaMinutes);
    
            const patch = {};
            if (newTimeFrom !== curr.timeFrom) patch.timeFrom = newTimeFrom;
            if (newTimeTo !== curr.timeTo) patch.timeTo = newTimeTo;
    
            if (Object.keys(patch).length > 0) {
                updates.push({ id: curr.id, patch });
            }
        }
    
        if (updates.length === 0) return;
    
        try {
            await Promise.all(
                updates.map(({ id, patch }) =>
                    updateDoc(doc(window.db, 'transport', id), patch)
                )
            );
            window.showGlobalNotification(
                `Posunutých ${updates.length} nasledujúcich riadkov o ${deltaMinutes} min.`,
                'info'
            );
        } catch (err) {
            console.error('[TRANSPORT] Chyba pri posune nasledujúcich riadkov:', err);
            window.showGlobalNotification('Nepodarilo sa posunúť nasledujúce riadky.', 'error');
        }
    };

    // ============================================================
    // PO ZMENE placeTo (a prepočte timeTo) ZOSÚLAĎ NASLEDUJÚCE RIADKY
    //
    // Princíp:
    //  - aktuálny riadok má nový časTo (vypočítaný z timeFrom + travelMinutes)
    //  - nasledujúce riadky (až po prvý "červený" – medzera > 2 min) sa
    //    posunú tak, aby ich timeFrom nadväzoval na nový časTo
    //    predchádzajúceho riadku (+ prípadná pôvodná medzera, ak existuje)
    //  - ak bola medzi riadkami medzera ≤ 2 min, zachová sa rovnaká medzera
    //  - ak bola medzera > 2 min (červený riadok), zastavíme sa
    // ============================================================
    const resyncFollowingRowsAfterPlaceToChange = async (busId, dayKey, currentRowId) => {
        if (!window.db || !busId || !dayKey || !currentRowId) return;
    
        const rowsKey = `${busId}|${dayKey}`;
        const allRows = (busRows[rowsKey] || [])
            .slice()
            .sort((a, b) => (a.order || 0) - (b.order || 0));
    
        const currentIdx = allRows.findIndex((r) => r.id === currentRowId);
        if (currentIdx === -1) return;
    
        const currentRow = allRows[currentIdx];
    
        // Vypočítaj nový timeTo aktuálneho riadku (rovnaká logika ako v renderBusRow / useEffect)
        const travelMinutes = getTravelMinutes(currentRow.placeFrom, currentRow.placeTo);
        if (travelMinutes == null) return; // timeTo sa nedá vypočítať
        if (!currentRow.timeFrom || !/^\d{1,2}:\d{2}$/.test(currentRow.timeFrom)) return;
    
        const [ch, cm] = currentRow.timeFrom.split(':').map(Number);
        const currentStartMin = ch * 60 + cm;
        let newCurrentEndMin = currentStartMin + travelMinutes;
        newCurrentEndMin = ((newCurrentEndMin % (24 * 60)) + (24 * 60)) % (24 * 60);
    
        // Pomocná: "HH:MM" → minúty od 00:00
        const toMinutes = (timeStr) => {
            if (!timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) return null;
            const [h, m] = timeStr.split(':').map(Number);
            return h * 60 + m;
        };
    
        // Pomocná: minúty → "HH:MM" (s mod 24h)
        const fromMinutes = (totalMin) => {
            const norm = ((totalMin % (24 * 60)) + (24 * 60)) % (24 * 60);
            const h = Math.floor(norm / 60);
            const m = norm % 60;
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        };
    
        // Pomocná: posun času o delta minút
        const shiftTime = (timeStr, delta) => {
            const min = toMinutes(timeStr);
            if (min == null) return timeStr;
            return fromMinutes(min + delta);
        };
    
        // Prechádzaj nasledujúce riadky, kým nenarazíš na "červený" (medzera > 2 min)
        const updates = [];
        let prevRow = currentRow;
        let prevEndMin = newCurrentEndMin;
    
        for (let i = currentIdx + 1; i < allRows.length; i++) {
            const curr = allRows[i];
    
            const prevTimeToMin = prevEndMin; // koniec predchádzajúceho riadku (po prepočte)
            const currTimeFromMin = toMinutes(curr.timeFrom);
    
            if (prevTimeToMin == null || currTimeFromMin == null) {
                // Ak nie sú časy, nedá sa pokračovať – skonči
                break;
            }
    
            // Zisti pôvodnú medzeru medzi predchádzajúcim a aktuálnym riadkom
            // (pred akýmkoľvek posunom). Použijeme pôvodné hodnoty z allRows.
            const originalPrevTimeToMin = toMinutes(allRows[i - 1].timeTo);
            const originalCurrTimeFromMin = currTimeFromMin;
    
            let originalGap = null;
            if (originalPrevTimeToMin != null && originalCurrTimeFromMin != null) {
                originalGap = originalCurrTimeFromMin - originalPrevTimeToMin;
                if (originalGap < 0) originalGap += 24 * 60;
            }
    
            // Ak je medzera > 2 min → červený riadok, zastav
            if (originalGap != null && originalGap > 2) {
                break;
            }
    
            // Nový timeFrom = koniec predchádzajúceho + pôvodná medzera (ak existuje)
            const gapToPreserve = originalGap != null && originalGap > 0 ? originalGap : 0;
            const newTimeFromMin = prevEndMin + gapToPreserve;
            const newTimeFromStr = fromMinutes(newTimeFromMin);
    
            // Nový timeTo = nový timeFrom + travelMinutes aktuálneho riadku
            const currTravelMinutes = getTravelMinutes(curr.placeFrom, curr.placeTo);
            let newTimeToStr = curr.timeTo || '';
            let newEndMin = null;
    
            if (currTravelMinutes != null) {
                newEndMin = newTimeFromMin + currTravelMinutes;
                newTimeToStr = fromMinutes(newEndMin);
            }
    
            const patch = {};
            if (newTimeFromStr !== curr.timeFrom) patch.timeFrom = newTimeFromStr;
            if (currTravelMinutes != null && newTimeToStr !== curr.timeTo) patch.timeTo = newTimeToStr;
    
            if (Object.keys(patch).length > 0) {
                updates.push({ id: curr.id, patch });
            }
    
            // Posuň prev referenciu
            prevEndMin = (newEndMin != null) ? newEndMin : newTimeFromMin;
        }
    
        if (updates.length === 0) return;
    
        try {
            await Promise.all(
                updates.map(({ id, patch }) =>
                    updateDoc(doc(window.db, 'transport', id), patch)
                )
            );
            window.showGlobalNotification(
                `Zosúladených ${updates.length} nasledujúcich riadkov.`,
                'info'
            );
        } catch (err) {
            console.error('[TRANSPORT] Chyba pri zosúlaďovaní nasledujúcich riadkov:', err);
            window.showGlobalNotification('Nepodarilo sa zosúladiť nasledujúce riadky.', 'error');
        }
    };

    const cascadeFollowingRowsAfterTimeFromChange = async (busId, dayKey, currentRowId, newTimeFrom, newTimeTo) => {
        if (!window.db || !busId || !dayKey || !currentRowId) return;
        if (!newTimeFrom || !/^\d{1,2}:\d{2}$/.test(newTimeFrom)) return;
        if (!newTimeTo || !/^\d{1,2}:\d{2}$/.test(newTimeTo)) return;
    
        const rowsKey = `${busId}|${dayKey}`;
        const allRows = (busRows[rowsKey] || [])
            .slice()
            .sort((a, b) => (a.order || 0) - (b.order || 0));
    
        const currentIdx = allRows.findIndex((r) => r.id === currentRowId);
        if (currentIdx === -1) return;
    
        const toMinutes = (timeStr) => {
            if (!timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) return null;
            const [h, m] = timeStr.split(':').map(Number);
            return h * 60 + m;
        };
    
        const fromMinutes = (totalMin) => {
            const norm = ((totalMin % (24 * 60)) + (24 * 60)) % (24 * 60);
            const h = Math.floor(norm / 60);
            const m = norm % 60;
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        };
    
        // ============================================================
        // KĽÚČOVÉ: Použi PRIAMO newTimeTo (už vypočítaný v onBlur),
        // nie starý currentRow.timeTo z busRows.
        // ============================================================
        let prevEndMin = toMinutes(newTimeTo);
        if (prevEndMin == null) return;
    
        const updates = [];
    
        for (let i = currentIdx + 1; i < allRows.length; i++) {
            const curr = allRows[i];
    
            // Pôvodná medzera (z pôvodných hodnôt v busRows)
            const originalPrevTimeToMin = toMinutes(allRows[i - 1].timeTo);
            const originalCurrTimeFromMin = toMinutes(curr.timeFrom);
    
            let originalGap = null;
            if (originalPrevTimeToMin != null && originalCurrTimeFromMin != null) {
                originalGap = originalCurrTimeFromMin - originalPrevTimeToMin;
                if (originalGap < 0) originalGap += 24 * 60;
            }
    
            // Ak je medzera > 2 min → červený riadok, zastav
            if (originalGap != null && originalGap > 2) {
                break;
            }
    
            // Nový timeFrom = koniec predchádzajúceho + 2 min
            const newTimeFromMin = prevEndMin + 2;
            const newTimeFromStr = fromMinutes(newTimeFromMin);
    
            // Nový timeTo = nový timeFrom + travelMinutes
            const currTravelMinutes = getTravelMinutes(curr.placeFrom, curr.placeTo);
            let newTimeToStr = curr.timeTo || '';
            let newEndMin = null;
    
            if (currTravelMinutes != null) {
                newEndMin = newTimeFromMin + currTravelMinutes;
                newTimeToStr = fromMinutes(newEndMin);
            }
    
            const patch = {};
            if (newTimeFromStr !== curr.timeFrom) patch.timeFrom = newTimeFromStr;
            if (currTravelMinutes != null && newTimeToStr !== curr.timeTo) patch.timeTo = newTimeToStr;
    
            if (Object.keys(patch).length > 0) {
                updates.push({ id: curr.id, patch });
            }
    
            prevEndMin = (newEndMin != null) ? newEndMin : newTimeFromMin;
        }
    
        if (updates.length === 0) return;
    
        try {
            await Promise.all(
                updates.map(({ id, patch }) =>
                    updateDoc(doc(window.db, 'transport', id), patch)
                )
            );
            window.showGlobalNotification(
                `Zosúladených ${updates.length} nasledujúcich riadkov.`,
                'info'
            );
        } catch (err) {
            console.error('[TRANSPORT] Chyba pri zosúlaďovaní nasledujúcich riadkov:', err);
            window.showGlobalNotification('Nepodarilo sa zosúladiť nasledujúce riadky.', 'error');
        }
    };

    // ============================================================
    // POSUN RIADKOV PO "OBRÁTENOM" ČERVENOM RIADKU
    // (miesto od == miesto do, ale čas od > čas do)
    //
    // Posunie všetky timeFrom a timeTo v nasledujúcich riadkoch
    // až po prvý ďalší červený riadok o hodnotu (medzera + 2 min).
    // ============================================================
    const shiftFollowingRowsAfterInvertedGap = async (busId, dayKey, gapRowPrevId, gapRowNextId) => {
        if (!window.db || !busId || !dayKey || !gapRowPrevId || !gapRowNextId) return;
    
        const rowsKey = `${busId}|${dayKey}`;
        const allRows = (busRows[rowsKey] || [])
            .slice()
            .sort((a, b) => (a.order || 0) - (b.order || 0));
    
        const prevIdx = allRows.findIndex((r) => r.id === gapRowPrevId);
        const nextIdx = allRows.findIndex((r) => r.id === gapRowNextId);
        if (prevIdx === -1 || nextIdx === -1 || nextIdx <= prevIdx) return;
    
        const prevRow = allRows[prevIdx];
        const nextRow = allRows[nextIdx];
    
        // Medzera (rovnaká logika ako getGapMinutes – s prechodom cez polnoc)
        // Pomocná: "HH:MM" → minúty od 00:00
        const toMinutes = (timeStr) => {
            if (!timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) return null;
            const [h, m] = timeStr.split(':').map(Number);
            return h * 60 + m;
        };
        
        const prevToMin = toMinutes(prevRow.timeTo);
        const nextFromMin = toMinutes(nextRow.timeFrom);
        if (prevToMin == null || nextFromMin == null) return;
        
        // ABSOLÚTNA HODNOTA rozdielu (bez prechodu cez polnoc)
        const gap = Math.abs(nextFromMin - prevToMin);
        if (gap <= 2) return; // nie je červený riadok
        
        // Posun = medzera + 2 minúty
        const deltaMinutes = gap + 2;
    
        // Pomocná: posun "HH:MM" o daný počet minút
        const shiftTime = (timeStr, delta) => {
            if (!timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) return timeStr;
            const [h, m] = timeStr.split(':').map(Number);
            let total = h * 60 + m + Number(delta);
            total = ((total % (24 * 60)) + (24 * 60)) % (24 * 60);
            const endH = Math.floor(total / 60);
            const endM = total % 60;
            return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
        };
    
        // Prejdi nasledujúce riadky od nextIdx ďalej, ale zastav
        // pred ďalším červeným riadkom (medzera > 2 min).
        const updates = [];
        for (let i = nextIdx; i < allRows.length; i++) {
            const curr = allRows[i];
    
            // Ak nie sme na prvom riadku za gapom, over medzeru
            // medzi predchádzajúcim a aktuálnym riadkom.
            if (i > nextIdx) {
                const prev = allRows[i - 1];
                const betweenGap = getGapMinutes(prev.timeTo, curr.timeFrom);
                if (betweenGap != null && betweenGap > 2) {
                    // Ďalší červený riadok → stop (tento riadok už neposúvame)
                    break;
                }
            }
    
            const newTimeFrom = shiftTime(curr.timeFrom, deltaMinutes);
            const newTimeTo = shiftTime(curr.timeTo, deltaMinutes);
    
            const patch = {};
            if (newTimeFrom !== curr.timeFrom) patch.timeFrom = newTimeFrom;
            if (newTimeTo !== curr.timeTo) patch.timeTo = newTimeTo;
    
            if (Object.keys(patch).length > 0) {
                updates.push({ id: curr.id, patch });
            }
        }
    
        if (updates.length === 0) return;
    
        try {
            await Promise.all(
                updates.map(({ id, patch }) =>
                    updateDoc(doc(window.db, 'transport', id), patch)
                )
            );
            window.showGlobalNotification(
                `Posunutých ${updates.length} nasledujúcich riadkov o ${deltaMinutes} min (medzera ${gap} + 2).`,
                'info'
            );
        } catch (err) {
            console.error('[TRANSPORT] Chyba pri posune riadkov po obrátenom červenom riadku:', err);
            window.showGlobalNotification('Nepodarilo sa posunúť nasledujúce riadky.', 'error');
        }
    };

    // ============================================================
    // ODSTRÁNENIE RIADKU
    // ============================================================
    const removeBusRow = async (rowId) => {
        if (!window.db || !rowId) return;
        try {
            await deleteDoc(doc(window.db, 'transport', rowId));
            window.showGlobalNotification('Riadok odstránený.', 'info');
        } catch (err) {
            console.error('[TRANSPORT] Chyba pri odstraňovaní riadku:', err);
            window.showGlobalNotification('Nepodarilo sa odstrániť riadok.', 'error');
        }
    };

    // ============================================================
    // POMOCNÁ: pripočíta minúty k "HH:MM" a vráti "HH:MM"
    // ============================================================
    const addMinutesToTime = (timeStr, minutes) => {
        if (!timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) return '';
        if (minutes == null || isNaN(minutes)) return '';
        const [h, m] = timeStr.split(':').map(Number);
        const total = h * 60 + m + Number(minutes);
        const endH = Math.floor(total / 60) % 24;
        const endM = total % 60;
        return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
    };
    
    // ============================================================
    // POMOCNÁ: nájde trvanie jazdy medzi dvoma zastávkami
    // ============================================================
    const getTravelMinutes = (placeFrom, placeTo) => {
        if (!placeFrom || !placeTo) return null;
    
        const normFrom = normalizePlaceName(placeFrom);
        const normTo = normalizePlaceName(placeTo);
    
        // 1) Priamo ID (presná zhoda)
        const keyId = `${placeFrom}|${placeTo}`;
        if (travelTimes[keyId] && travelTimes[keyId].minutes != null) {
            return Number(travelTimes[keyId].minutes);
        }
    
        // 2) Cez normalizovaný názov → nájdi zastávku
        const fromStop = stopsList.find((s) =>
            normalizePlaceName(s.name) === normFrom || s.id === placeFrom
        );
        const toStop = stopsList.find((s) =>
            normalizePlaceName(s.name) === normTo || s.id === placeTo
        );
        if (fromStop && toStop) {
            const key = `${fromStop.id}|${toStop.id}`;
            if (travelTimes[key] && travelTimes[key].minutes != null) {
                return Number(travelTimes[key].minutes);
            }
        }
    
        // 3) Fallback: prejdi všetky travelTimes a porovnaj normalizované názvy
        for (const [key, v] of Object.entries(travelTimes)) {
            if (!v) continue;
            if (
                normalizePlaceName(v.fromName) === normFrom &&
                normalizePlaceName(v.toName) === normTo &&
                v.minutes != null
            ) {
                return Number(v.minutes);
            }
        }
    
        return null;
    };

    // ============================================================
    // RENDER HLAVIČKY RIADKOV (8 stĺpcov)
    // ============================================================
    const renderBusRowsHeader = () => React.createElement(
        'thead',
        null,
        React.createElement(
            'tr',
            { className: 'bg-gray-100 text-xs font-semibold text-gray-700' },
            React.createElement('th', { className: 'border border-gray-300 px-2 py-1', style: { width: '70px' } }, 'Od'),
            React.createElement('th', { className: 'border border-gray-300 px-2 py-1', style: { width: '70px' } }, 'Do'),
            React.createElement('th', { className: 'border border-gray-300 px-2 py-1', style: { width: '200px' } }, 'Miesto od'),
            React.createElement('th', { className: 'border border-gray-300 px-2 py-1', style: { width: '200px' } }, 'Miesto do'),
            React.createElement('th', { className: 'border border-gray-300 px-2 py-1' }, 'Nástup'),
            React.createElement('th', { className: 'border border-gray-300 px-2 py-1' }, 'Výstup'),
            React.createElement('th', { className: 'border border-gray-300 px-2 py-1', style: { width: '60px' } }, 'Počet'),
            React.createElement('th', { className: 'border border-gray-300 px-2 py-1', style: { width: '60px' } }, 'Min'),
            React.createElement('th', { className: 'border border-gray-300 px-2 py-1', style: { width: '36px' } }, '')
        )
    );

    // ============================================================
    // POMOCNÁ: vypočíta počet členov tímu z teamKey "Názov|Kategória"
    // Ak tím nie je v users (nemá známe počty), použije sa priemer
    // kategórie (rovnaká logika ako getCategoryAverageForTransfer).
    // ============================================================
    const getTeamMembersCount = (teamKey) => {
        const parts = String(teamKey).split('|');
        const teamName = parts[0] || '';
        const category = parts[1] || '';

        const counts = getTeamCountsForTransfer(category, teamName);
        if (counts) {
            return (counts.players || 0)
                + (counts.menRT || 0)
                + (counts.womenRT || 0)
                + (counts.menDrivers || 0)
                + (counts.womenDrivers || 0);
        }

        // Fallback: tím nie je v users (napr. superstructure) → priemer kategórie
        const avg = getCategoryAverageForTransfer(category);
        if (avg != null) return avg;

        return 0;
    };

    // ============================================================
    // POMOCNÁ: vytvorí tooltip pre tím v autobuse
    // ("Tím • 15 členov — kliknutím odstrániť z autobusu")
    // ============================================================
    const getTeamTooltipLabel = (teamKey) => {
        const parts = String(teamKey).split('|');
        const teamName = (parts[0] || '').trim();
        const category = (parts[1] || '').trim();
    
        const counts = getTeamCountsForTransfer(category, teamName);
        let membersText = null;
    
        if (counts) {
            const total =
                (counts.players || 0) +
                (counts.menRT || 0) +
                (counts.womenRT || 0) +
                (counts.menDrivers || 0) +
                (counts.womenDrivers || 0);
            membersText = `${total}`;
        } else {
            const avg = getCategoryAverageForTransfer(category);
            if (avg != null) {
                membersText = `${avg}`;
            }
        }
    
        if (membersText != null) {
            return `${teamName} • ${membersText} členov`;
        }
    
        return `${teamName}`;
    };

    // ============================================================
    // POMOCNÁ: zistí, ktoré tímy sú "v autobuse" po tomto riadku
    // (nastúpili v tomto alebo skoršom riadku a ešte nevystúpili)
    // ============================================================
    const getTeamsInBusAfterRow = (busId, dayKey, rowId) => {
        const rowsKey = `${busId}|${dayKey}`;
        const allRows = (busRows[rowsKey] || [])
            .slice()
            .sort((a, b) => (a.order || 0) - (b.order || 0));

        const currentIdx = allRows.findIndex((r) => r.id === rowId);
        if (currentIdx === -1) return [];

        const inBus = new Set();

        // 1) Predchádzajúce riadky – plná logika (in pridaj, out odober)
        for (let i = 0; i < currentIdx; i++) {
            const r = allRows[i];
            (r.teamsIn || []).forEach((t) => inBus.add(String(t)));
            (r.teamsOut || []).forEach((t) => inBus.delete(String(t)));
        }

        // 2) Aktuálny riadok – pridaj teamsIn, ale NEODOBERAJ teamsOut
        //    (tím ešte sedí v buse počas jazdy z placeFrom do placeTo)
        const currentRow = allRows[currentIdx];
        (currentRow.teamsIn || []).forEach((t) => inBus.add(String(t)));

        return [...inBus].filter((teamKey) => {
            if (!selectedCategoryFilter) return true;
            const parts = String(teamKey).split('|');
            const cat = cleanCategory(parts[1] || '');
            return cat === cleanCategory(selectedCategoryFilter);
        });
    };

    // ============================================================
    // POMOCNÁ: výpočet medzery v minútach medzi dvoma "HH:MM"
    // Vráti počet minút (môže byť aj > 24h, ale ošetríme mod 24h)
    // alebo null, ak sa nedá vypočítať.
    // ============================================================
    const getGapMinutes = (timeTo, timeFrom) => {
        if (!timeTo || !timeFrom) return null;
        const re = /^(\d{1,2}):(\d{2})$/;
        const a = re.exec(String(timeTo));
        const b = re.exec(String(timeFrom));
        if (!a || !b) return null;
        const toMin = Number(a[1]) * 60 + Number(a[2]);
        const fromMin = Number(b[1]) * 60 + Number(b[2]);
        let diff = fromMin - toMin;
        // Ak je záporný, berieme to ako prechod cez polnoc
        if (diff < 0) diff += 24 * 60;
        return diff;
    };

    // ============================================================
    // NOVÉ: Zisti, či je segment (from → to) pokrytý trasou autobusu,
    // v ktorej tím sedí. To znamená:
    //  - nájdi autobus, kde tím nastúpil na zastávke `from` alebo skôr
    //  - a vystúpil na zastávke `to` alebo neskôr
    //  - a medzi nimi autobus prejde cez `from` a `to` v správnom poradí
    // ============================================================
    const isSegmentCoveredByBusPath = (dayKey, teamName, category, fromLoc, toLoc) => {
        const fromNorm = normalizePlaceName(fromLoc);
        const toNorm = normalizePlaceName(toLoc);
        if (!fromNorm || !toNorm) return false;
        if (fromNorm === toNorm) return false;
    
        let covered = false;
    
        Object.entries(busRows || {}).forEach(([busKey, rows]) => {
            if (covered) return;
            const bDayKey = busKey.split('|')[1];
            if (bDayKey !== dayKey) return;
    
            const sorted = (rows || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
            if (sorted.length === 0) return;
    
            // Nájdi všetky nástupy a výstupy tímu
            const boardIdxs = [];
            const alightIdxs = [];
    
            sorted.forEach((row, idx) => {
                const hasTeamIn = (row.teamsIn || []).some((tk) => {
                    const [tn, cat] = String(tk).split('|');
                    return String(tn).trim() === teamName && cleanCategory(cat) === category;
                });
                const hasTeamOut = (row.teamsOut || []).some((tk) => {
                    const [tn, cat] = String(tk).split('|');
                    return String(tn).trim() === teamName && cleanCategory(cat) === category;
                });
                if (hasTeamIn) boardIdxs.push(idx);
                if (hasTeamOut) alightIdxs.push(idx);
            });
    
            if (boardIdxs.length === 0 || alightIdxs.length === 0) return;
    
            // Pre každý nástup nájdi NAJBLIŽŠÍ výstup po ňom (súvislý pobyt)
            boardIdxs.forEach((boardIdx) => {
                if (covered) return;
                // Nájdi prvý alightIdx >= boardIdx
                const nextAlight = alightIdxs.find((ai) => ai >= boardIdx);
                if (nextAlight == null) return;
    
                // Over, či sa from a to nachádzajú v riadkoch medzi boardIdx a nextAlight (vrátane)
                // v správnom poradí
                let fromIdx = -1;
                let toIdx = -1;
    
                for (let i = boardIdx; i <= nextAlight; i++) {
                    const rowFromNorm = normalizePlaceName(sorted[i].placeFrom);
                    const rowToNorm = normalizePlaceName(sorted[i].placeTo);
    
                    if (fromIdx === -1 && (rowFromNorm === fromNorm || rowToNorm === fromNorm)) {
                        fromIdx = i;
                    }
                    if (fromIdx !== -1 && (rowFromNorm === toNorm || rowToNorm === toNorm)) {
                        if (toIdx === -1) toIdx = i;
                    }
                }
    
                if (fromIdx !== -1 && toIdx !== -1 && toIdx >= fromIdx) {
                    covered = true;
                }
            });
        });
    
        return covered;
    };

    // ============================================================
    // RENDER JEDNÉHO RIADKU (upravený – Do read-only, miesta selectboxy)
    // ============================================================
    const renderBusRow = (row, busId, dayKey) => {
        const travelMinutes = getTravelMinutes(row.placeFrom, row.placeTo);
        const computedTimeTo = addMinutesToTime(row.timeFrom, travelMinutes);

        const rowsKey = `${busId}|${dayKey}`;
        const allRows = (busRows[rowsKey] || [])
            .slice()
            .sort((a, b) => (a.order || 0) - (b.order || 0));
        const currentIdx = allRows.findIndex((r) => r.id === row.id);
        const prevRow = currentIdx > 0 ? allRows[currentIdx - 1] : null;
        const lockedPlaceFrom = prevRow && prevRow.placeTo && prevRow.placeTo.trim() !== ''
            ? prevRow.placeTo
            : null;
    
        const inputCls = 'w-full px-1 py-1 text-sm border border-gray-300 rounded text-black focus:outline-none focus:ring-2 focus:ring-green-500';
        const selectCls = 'w-full px-1 py-1 text-sm border border-gray-300 rounded text-black bg-white focus:outline-none focus:ring-2 focus:ring-green-500';

        const filterTeamsByCategory = (teams) => {
            if (!Array.isArray(teams)) return [];
            if (!selectedCategoryFilter) return teams;
            const targetCat = cleanCategory(selectedCategoryFilter);
            return teams.filter((teamKey) => {
                const parts = String(teamKey).split('|');
                const cat = cleanCategory(parts[1] || '');
            return cat === targetCat;
            });    
        };
    
        // Všetky zastávky pre "Miesto od"
        const stopOptionsFrom = stopsList.map((s) =>
            React.createElement('option', { key: s.id, value: s.name }, s.name)
        );

        // Zastávky pre "Miesto do" – bez tej, ktorá je vybraná v "Miesto od"
        const stopOptionsTo = stopsList
            .filter((s) => s.name !== (row.placeFrom || ''))
            .map((s) =>
                React.createElement('option', { key: s.id, value: s.name }, s.name)
            );
    
        // ============================================================
        // NOVÉ: Odstráni CELÝ SEGMENT (nástup + výstup) pre daný tím,
        // ale LEN pre ten konkrétny segment, v ktorom sa nachádza
        // aktuálny riadok. Ostatné segmenty toho istého tímu
        // v iných riadkoch zostanú nedotknuté.
        //
        // clickSide = 'in' | 'out' – podľa toho, na ktorý stĺpec
        // používateľ klikol (nástup alebo výstup).
        // ============================================================
        const removeTeamSegment = async (teamKeyToRemove, clickSide) => {
            if (!window.db || !busId || !dayKey || !row?.id) return;

            const rowsKey = `${busId}|${dayKey}`;
            const allRows = (busRows[rowsKey] || [])
                .slice()
                .sort((a, b) => (a.order || 0) - (b.order || 0));

            const currentIdx = allRows.findIndex((r) => r.id === row.id);
            if (currentIdx === -1) return;

            // Pomocná: zistí, či daný riadok obsahuje tím v teamsIn/teamsOut
            const hasTeamIn = (r) =>
                (r.teamsIn || []).some((t) => String(t) === String(teamKeyToRemove));
            const hasTeamOut = (r) =>
                (r.teamsOut || []).some((t) => String(t) === String(teamKeyToRemove));

            // Nájdeme nástupný a výstupný riadok pre SEGMENT, v ktorom
            // sa nachádza aktuálny riadok.
            let boardIdx = null;
            let alightIdx = null;

            // 1) Ak kliknutie prišlo z teamsIn → aktuálny riadok je nástupný
            if (clickSide === 'in' && hasTeamIn(allRows[currentIdx])) {
                boardIdx = currentIdx;
                // Hľadaj nasledujúci riadok, kde tím vystupuje
                for (let i = currentIdx; i < allRows.length; i++) {
                    if (hasTeamOut(allRows[i])) {
                        alightIdx = i;
                        break;
                    }
                }
            }

            // 2) Ak kliknutie prišlo z teamsOut → aktuálny riadok je výstupný
            if (clickSide === 'out' && hasTeamOut(allRows[currentIdx])) {
                alightIdx = currentIdx;
                // Hľadaj predchádzajúci riadok, kde tím nastupuje
                for (let i = currentIdx; i >= 0; i--) {
                    if (hasTeamIn(allRows[i])) {
                        boardIdx = i;
                        break;
                    }
                }
            }

            // 3) Fallback – ak sa nenašla dvojica, odstráň len z aktuálneho riadku
            if (boardIdx == null && alightIdx == null) {
                const currentTeams = clickSide === 'in'
                    ? (row.teamsIn || [])
                    : (row.teamsOut || []);
                const newTeams = currentTeams.filter((t) => String(t) !== String(teamKeyToRemove));
                if (newTeams.length === currentTeams.length) return;
                try {
                    await updateDoc(doc(window.db, 'transport', row.id), {
                        [clickSide === 'in' ? 'teamsIn' : 'teamsOut']: newTeams,
                    });
                    window.showGlobalNotification('Tím bol odstránený z riadku.', 'info');
                } catch (err) {
                    console.error('[TRANSPORT] Chyba pri odstraňovaní tímu z riadku:', err);
                    window.showGlobalNotification('Nepodarilo sa odstrániť tím z riadku.', 'error');
                }
                return;
            }

            // Zostavíme zoznam zmien (riadok → nové teamsIn/teamsOut)
            const updates = {};

            if (boardIdx != null) {
                const r = allRows[boardIdx];
                const newTeamsIn = (r.teamsIn || []).filter(
                    (t) => String(t) !== String(teamKeyToRemove)
                );
                if (newTeamsIn.length !== (r.teamsIn || []).length) {
                    updates[r.id] = { ...(updates[r.id] || {}), teamsIn: newTeamsIn };
                }
            }

            if (alightIdx != null) {
                const r = allRows[alightIdx];
                const newTeamsOut = (r.teamsOut || []).filter(
                    (t) => String(t) !== String(teamKeyToRemove)
                );
                if (newTeamsOut.length !== (r.teamsOut || []).length) {
                    updates[r.id] = { ...(updates[r.id] || {}), teamsOut: newTeamsOut };
                }
            }

            if (Object.keys(updates).length === 0) return;

            try {
                await Promise.all(
                    Object.entries(updates).map(([rid, data]) =>
                        updateDoc(doc(window.db, 'transport', rid), data)
                    )
                );
                window.showGlobalNotification(
                    'Tím bol odstránený z celého segmentu (nástup + výstup).',
                    'info'
                );

                // ============================================================
                // NOVÉ: Po odstránení segmentu z autobusu treba prepočítať
                // VŠETKY parent záznamy daného tímu v ten istý deň.
                //
                // recomputeParentSegmentsInPlace totiž pre každý segment
                // hľadá, či je pokrytý busom (findBusTimesForSegment).
                // Ak už tím v danom buse nesedí (bol odstránený), segment
                // nedostane startTs/endTs a busAssigned sa nastaví na false
                // + busId sa odstráni.
                //
                // Tým sa zabezpečí, že:
                //  - z DB zmiznú časy (startTs/endTs) pre odstránený segment,
                //  - zmizne busAssigned aj busId.
                // ============================================================
                try {
                    await new Promise((r) => setTimeout(r, 400)); // počkať na onSnapshot

                    const teamKeyParts = String(teamKeyToRemove).split('|');
                    const removedTeamName = (teamKeyParts[0] || '').trim();
                    const removedCategory = cleanCategory(teamKeyParts[1] || '');

                    // 1) Nájdi VŠETKY parent záznamy tohto tímu v tento deň
                    //    (parent = bez _parentKey, t.j. key === _parentKey alebo chýba)
                    const parentCandidates = (savedTransfersRef.current || [])
                        .filter((s) => {
                            if (String(s.teamName || '').trim() !== removedTeamName) return false;
                            if (cleanCategory(s.category || '') !== removedCategory) return false;
                            if ((s.dayKey || '') !== dayKey) return false;
                            // parent záznam nemá _parentKey alebo je rovný svojmu key
                            if (s._parentKey && s._parentKey !== s.key) return false;
                            return true;
                        });

                    // ============================================================
                    // NOVÉ: Pre každý parent:
                    //  1) Explicitne vynuluj časy všetkých segmentov, ktoré
                    //     zodpovedajú odstránenému tímu (from → to mohol byť
                    //     priradený k tomuto busu). Tým sa zaručí, že časy
                    //     zmiznú z DB aj v prípade, že recomputeParentSegmentsInPlace
                    //     by ich našiel v ešte neaktualizovanom busRows.
                    //  2) Potom zavolaj recomputeParentSegments, ktorá dopočíta
                    //     časy pre ostatné segmenty (ak sú priradené k iným busom).
                    // ============================================================
                    for (const parent of parentCandidates) {
                        try {
                            const docRef = doc(window.db, TRANSPORT_SETTINGS_COLLECTION, TRANSPORT_SETTINGS_DOC);
                            const draft = {
                                ...parent,
                                segments: Array.isArray(parent.segments)
                                    ? parent.segments.map((s) => ({ ...s }))
                                    : buildDefaultSegments(parent),
                            };

                            // Vynuluj časy pre segmenty, ktoré zodpovedajú
                            // odstránenému tímu. Keďže parent patrí tomuto tímu,
                            // vynulujeme VŠETKY segmenty, ktoré mali priradenie
                            // k tomuto busu (busId === busId, alebo ak busId chýba,
                            // tak všetky s reálnymi časmi).
                            let changed = false;
                            draft.segments = draft.segments.map((seg) => {
                                if (!seg) return seg;
                                // Ak segment bol priradený k tomuto busu (alebo nemá
                                // busId, ale má časy – pre istotu vynuluj), vymaž časy.
                                const wasAssignedToThisBus =
                                    seg.busId === busId ||
                                    (seg.busId == null && (seg.startTs != null || seg.endTs != null));
                                if (!wasAssignedToThisBus) return seg;

                                // Ak segment má reálne časy, treba ich vymazať.
                                if (
                                    seg.startTs != null ||
                                    seg.endTs != null ||
                                    seg.when != null ||
                                    seg.busAssigned === true ||
                                    seg.busId != null
                                ) {
                                    changed = true;
                                    return {
                                        ...seg,
                                        startTs: null,
                                        endTs: null,
                                        when: null,
                                        busAssigned: false,
                                        busId: null,
                                    };
                                }
                                return seg;
                            });

                            // Zapíš vynulované segmenty do DB okamžite
                            if (changed) {
                                const payload = {
                                    category: draft.category,
                                    teamUid: draft.teamUid,
                                    teamIndex: draft.teamIndex,
                                    dayKey: draft.dayKey,
                                    fromLocation: draft.fromLocation,
                                    toLocation: draft.toLocation,
                                    when: draft.when,
                                    text: draft.text,
                                    segments: draft.segments,
                                };
                                if (Array.isArray(draft.intermediateStops) && draft.intermediateStops.length > 0) {
                                    payload.intermediateStops = draft.intermediateStops;
                                }
                                if (draft.isWalking === true) {
                                    payload.isWalking = true;
                                    payload.walkingSetAt = draft.walkingSetAt || null;
                                    payload.walkingSetBy = draft.walkingSetBy || null;
                                }
                                await setDoc(
                                    docRef,
                                    { [TRANSPORT_TRANSFERS_FIELD]: { [parent.key]: payload } },
                                    { merge: true }
                                );
                            }

                            // 3) Prepočítaj parent (dopočíta časy pre ostatné
                            //    segmenty, ktoré sú priradené k iným busom).
                            await recomputeParentSegments({
                                ...parent,
                                segments: draft.segments,
                            });
                        } catch (e) {
                            console.error('[TRANSPORT] Chyba pri prepočte parent segmentov po odstránení z busu:', e);
                        }
                    }
                } catch (postErr) {
                    console.error('[TRANSPORT] Chyba pri post-spracovaní po odstránení segmentu:', postErr);
                }
            } catch (err) {
                console.error('[TRANSPORT] Chyba pri odstraňovaní segmentu tímu:', err);
                window.showGlobalNotification('Nepodarilo sa odstrániť segment tímu.', 'error');
            }
        };
    
        return React.createElement(
            'tr',
            { key: row.id, className: 'hover:bg-gray-50 group relative' },
            // 1. čas začiatok
            React.createElement('td', { className: 'border border-gray-300 p-1' },
                React.createElement('input', {
                    type: 'time',
                    key: `timeFrom-${row.id}-${row.timeFrom || ''}`,   // ← NOVÉ
                    defaultValue: row.timeFrom || '',
                    onBlur: async (e) => {
                        const newValue = e.target.value;
                        const oldValue = row.timeFrom || '';
                        if (newValue === oldValue) return;
                    
                        if (!newValue) {
                            await updateBusRowField(row.id, 'timeFrom', newValue);
                            return;
                        }
                    
                        await updateBusRowField(row.id, 'timeFrom', newValue);
                    
                        let newTimeTo = null;
                        const travelMinutes = getTravelMinutes(row.placeFrom, row.placeTo);
                        if (travelMinutes != null && /^\d{1,2}:\d{2}$/.test(newValue)) {
                            const [h, m] = newValue.split(':').map(Number);
                            let total = h * 60 + m + travelMinutes;
                            total = ((total % (24 * 60)) + (24 * 60)) % (24 * 60);
                            const endH = Math.floor(total / 60);
                            const endM = total % 60;
                            newTimeTo = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
                            if (newTimeTo !== (row.timeTo || '')) {
                                await updateBusRowField(row.id, 'timeTo', newTimeTo);
                            }
                        }
                    
                        if (newTimeTo != null) {
                            cascadeFollowingRowsAfterTimeFromChange(busId, dayKey, row.id, newValue, newTimeTo);
                        }
                    },
                    onKeyDown: async (e) => {
                        if (e.key === 'Enter') {
                            e.target.blur();
                        }
                    },
                    className: inputCls,
                })
            ),
            // 2. čas koniec (READ-ONLY, vypočítaný)
            React.createElement('td', { className: 'border border-gray-300 p-1' },
                React.createElement('input', {
                    type: 'time',
                    value: computedTimeTo || '',
                    readOnly: true,
                    disabled: true,
                    title: travelMinutes != null
                        ? `Vypočítané: ${row.timeFrom || '—'} + ${travelMinutes} min`
                        : 'Chýba trvanie jazdy medzi zastávkami',
                    className: inputCls + ' bg-gray-100 cursor-not-allowed text-center font-semibold',
                    style: { color: computedTimeTo ? '#1d4ed8' : '#9ca3af' },
                })
            ),
            // 3. miesto od
            //    - Ak predchádzajúci riadok má vyplnené placeTo → READ-ONLY text
            //      (hodnota = prevRow.placeTo, nedá sa meniť)
            //    - Inak → SELECT (pôvodné správanie)
            React.createElement('td', { className: 'border border-gray-300 p-1' },
                lockedPlaceFrom != null
                    ? React.createElement(
                        'div',
                        {
                            className: 'w-full px-1 py-1 text-sm text-left font-semibold bg-gray-100 border border-gray-300 rounded text-gray-700 whitespace-nowrap overflow-hidden text-ellipsis',
                            title: `Miesto od je automaticky nastavené z predchádzajúceho riadku (${prevRow.placeTo}). Nedá sa meniť.`,
                        },
                        lockedPlaceFrom
                    )
                    : React.createElement('select', {
                        value: row.placeFrom || '',
                        onChange: (e) => updateBusRowField(row.id, 'placeFrom', e.target.value),
                        className: selectCls,
                    },
                        React.createElement('option', { value: '' }, '— vyber zastávku —'),
                        stopOptionsFrom
                    )
            ),
            // 4. miesto do (SELECT)
            React.createElement('td', { className: 'border border-gray-300 p-1' },
                React.createElement('select', {
                    value: row.placeTo || '',
                    onChange: async (e) => {
                        const newPlaceTo = e.target.value;
                        const oldPlaceTo = row.placeTo || '';
                    
                        // Ulož novú hodnotu
                        await updateBusRowField(row.id, 'placeTo', newPlaceTo);

                        // Ak sa zmenilo placeTo a nové placeTo nie je prázdne → prepočítaj timeTo
                        // a zosúlaď nasledujúce riadky
                        if (newPlaceTo !== oldPlaceTo && newPlaceTo) {
                            // Počkaj, kým sa timeTo uloží (useEffect ho dopočíta asynchrónne).
                            // Radšej ho dopočítaj priamo tu a zapíš, aby bol konzistentný pred
                            // zosúladením nasledujúcich riadkov.
                    
                            const travelMinutes = getTravelMinutes(row.placeFrom, newPlaceTo);
                            if (travelMinutes != null && row.timeFrom && /^\d{1,2}:\d{2}$/.test(row.timeFrom)) {
                                const [h, m] = row.timeFrom.split(':').map(Number);
                                let total = h * 60 + m + travelMinutes;
                                total = ((total % (24 * 60)) + (24 * 60)) % (24 * 60);
                                const endH = Math.floor(total / 60);
                                const endM = total % 60;
                                const newTimeTo = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
                    
                                if (newTimeTo !== (row.timeTo || '')) {
                                    await updateBusRowField(row.id, 'timeTo', newTimeTo);
                                }
                            }
                    
                            // Počkaj jeden frame, aby sa busRows stihol aktualizovať z Firestore
                            // (onSnapshot), inak by funkcia pracovala so starým busRows.
                            // Použijeme menší delay (napr. 300 ms).
                            setTimeout(() => {
                                resyncFollowingRowsAfterPlaceToChange(busId, dayKey, row.id);
                            }, 300);
                        }
                    },
                    className: selectCls,
                },
                    React.createElement('option', { value: '' }, '— vyber zastávku —'),
                    stopOptionsTo
                )
            ),
            // 5. tímy nástup (len text vo farbe kategórie, bez pozadia a rámčeka)
            React.createElement('td', { className: 'border border-gray-300 p-1 align-middle whitespace-nowrap' },
                (() => {
                    const filteredTeamsIn = filterTeamsByCategory(row.teamsIn);
                    if (filteredTeamsIn.length === 0) {
                        return React.createElement('span', { className: 'text-xs text-gray-400 italic' }, '—');
                    }
                    return React.createElement(
                        'div',
                        { className: 'flex flex-nowrap gap-2 items-center' },
                        filteredTeamsIn.map((tn, i) => {
                            const parts = String(tn).split('|');
                            const teamName = parts[0] || tn;
                            const teamCategory = parts[1] || '';
                            const shortcut = getTeamShortcut(teamCategory, teamName);
                            const teamLabel = shortcut || teamName;
                            const textColor = getCategoryTextColor(teamCategory);
                            return React.createElement(
                                'span',
                                {
                                    key: `in-${i}`,
                                    onClick: () => removeTeamSegment(tn, 'in'),
                                    title: getTeamTooltipLabel(tn),
                                    className: 'inline-flex items-center gap-1 text-sm font-semibold cursor-pointer hover:underline whitespace-nowrap',
                                    style: { color: textColor }
                                },
                                teamLabel
                            );
                        })
                    );
                })()
            ),
            // 6. tímy výstup (len text vo farbe kategórie, bez pozadia a rámčeka)
            React.createElement('td', { className: 'border border-gray-300 p-1 align-middle whitespace-nowrap' },
                (() => {
                    const filteredTeamsOut = filterTeamsByCategory(row.teamsOut);
                    if (filteredTeamsOut.length === 0) {
                        return React.createElement('span', { className: 'text-xs text-gray-400 italic' }, '—');
                    }
                    return React.createElement(
                        'div',
                        { className: 'flex flex-nowrap gap-2 items-center' },
                        filteredTeamsOut.map((tn, i) => {
                            const parts = String(tn).split('|');
                            const teamName = parts[0] || tn;
                            const teamCategory = parts[1] || '';
                            const shortcut = getTeamShortcut(teamCategory, teamName);
                            const teamLabel = shortcut || teamName;
                            const textColor = getCategoryTextColor(teamCategory);
                            return React.createElement(
                                'span',
                                {
                                    key: `out-${i}`,
                                    onClick: () => removeTeamSegment(tn, 'out'),
                                    title: getTeamTooltipLabel(tn),
                                    className: 'inline-flex items-center gap-1 text-sm font-semibold cursor-pointer hover:underline whitespace-nowrap',
                                    style: { color: textColor }
                                },
                                teamLabel
                            );
                        })
                    );
                })()
            ),
            // 7. počet (AUTOMATICKY – súčet členov tímov v autobuse, s fallbackom na priemer kategórie)
            React.createElement('td', {
                className: 'border border-gray-300 px-2 py-1 text-center text-sm font-semibold',
                style: { color: '#1d4ed8' },
                title: 'Automaticky vypočítaný počet členov tímov, ktoré sú práve v autobuse (medzi zastávkami). Ak tím nie je v users, použije sa priemer kategórie.',
            },
                (() => {
                    const teamsInBus = getTeamsInBusAfterRow(busId, dayKey, row.id);
                    if (teamsInBus.length === 0) {
                        return React.createElement('span', { className: 'text-gray-400' }, '—');
                    }
                    const total = teamsInBus.reduce((sum, tk) => sum + getTeamMembersCount(tk), 0);
                    return total > 0 ? total : React.createElement('span', { className: 'text-gray-400' }, '—');
                })()
            ),
            // 8. trvanie v min (read-only, VYPOČÍTANÉ zo zobrazených časov Od / Do)
            //    Min = timeTo − timeFrom (s prechodom cez polnoc)
            //    Ak je timeFrom > timeTo → zobraz "chyba" (červené)
            //    Ak chýba čas Od alebo Do → zobraz "—" (sivé)
            React.createElement('td', {
                className: 'border border-gray-300 px-2 py-1 text-center text-sm font-semibold',
                style: {
                    color: (() => {
                        const timeRe = /^\d{1,2}:\d{2}$/;
                        if (!row.timeFrom || !row.timeTo ||
                            !timeRe.test(row.timeFrom) || !timeRe.test(row.timeTo)) {
                            return '#9ca3af';
                        }
                        const [fh, fm] = row.timeFrom.split(':').map(Number);
                        const [th, tm] = row.timeTo.split(':').map(Number);
                        const fromMin = fh * 60 + fm;
                        const toMin = th * 60 + tm;
                        if (fromMin > toMin) return '#dc2626'; // červená
                        return '#b45309';
                    })(),
                },
                title: (() => {
                    const timeRe = /^\d{1,2}:\d{2}$/;
                    if (!row.timeFrom || !row.timeTo ||
                        !timeRe.test(row.timeFrom) || !timeRe.test(row.timeTo)) {
                        return 'Trvanie sa počíta zo zobrazených časov Od a Do – jeden z nich chýba';
                    }
                    const [fh, fm] = row.timeFrom.split(':').map(Number);
                    const [th, tm] = row.timeTo.split(':').map(Number);
                    if (fh * 60 + fm > th * 60 + tm) {
                        return `Chyba: čas od (${row.timeFrom}) je neskorší ako čas do (${row.timeTo})`;
                    }
                    return `Trvanie vypočítané zo zobrazených časov: ${row.timeFrom} → ${row.timeTo}`;
                })(),
            }, (() => {
                const timeRe = /^\d{1,2}:\d{2}$/;
                // Ak chýba čas Od alebo Do → "—"
                if (!row.timeFrom || !row.timeTo ||
                    !timeRe.test(row.timeFrom) || !timeRe.test(row.timeTo)) {
                    return '—';
                }
                const [fh, fm] = row.timeFrom.split(':').map(Number);
                const [th, tm] = row.timeTo.split(':').map(Number);
                const fromMin = fh * 60 + fm;
                const toMin = th * 60 + tm;
                // Ak je čas Od > čas Do → "chyba"
                if (fromMin > toMin) {
                    return 'chyba';
                }
                // Inak vráť rozdiel v minútach (s prechodom cez polnoc)
                let diff = toMin - fromMin;
                if (diff < 0) diff += 24 * 60;
                return diff;
            })()),
            // 9. mazanie riadku
            React.createElement('td', { className: 'border border-gray-300 p-1 text-center' },
                React.createElement('button', {
                    type: 'button',
                    onClick: () => removeBusRow(row.id),
                    className: 'text-red-600 hover:text-red-800 hover:bg-red-50 rounded w-7 h-7 flex items-center justify-center mx-auto',
                    title: 'Odstrániť riadok',
                }, React.createElement('i', { className: 'fa-solid fa-xmark' })),
            
                // 10. HOVER "+" VYCIELENÝ NA STRED BOXU AUTOBUSU
                //     Overlay je vnútri posledného <td>, ale <td> NEMÁ position: relative,
                //     takže absolute sa vzťahuje na <tr> (ktoré má "group relative").
                //     left: 50% + translateX(-50%) = stred celého riadku (celého boxu).
                React.createElement(
                    'div',
                    {
                        className: 'absolute left-1/2 -translate-x-1/2 pointer-events-none',
                        style: {
                            bottom: '-12px',
                            zIndex: 100,
                        }
                    },
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: async () => {
                                const rowsKey = `${busId}|${dayKey}`;
                                const allRows = (busRows[rowsKey] || [])
                                    .slice()
                                    .sort((a, b) => (a.order || 0) - (b.order || 0));
                                const idx = allRows.findIndex((r) => r.id === row.id);
                                if (idx === -1) return;
                                const nextRow = allRows[idx + 1];
                                const realBus = buses.find((b) => b.id === busId) || { id: busId, name: '' };
                                if (!nextRow) {
                                    await addBusRow(realBus, dayKey);
                                    return;
                                }
                                await insertBusRowBetween(realBus, dayKey, row, nextRow);
                            },
                            className:
                                'pointer-events-auto w-6 h-6 rounded-full bg-green-600 text-white shadow-md ' +
                                'hover:bg-green-700 active:scale-95 transition-all duration-150 ' +
                                'flex items-center justify-center opacity-0 group-hover:opacity-100',
                        },
                        React.createElement('i', { className: 'fa-solid fa-plus text-[10px]' })
                    )
                )
            )
        );
    };

    // ============================================================
    // PRIDANIE NOVÉHO AUTOBUSU
    // ============================================================
    const addNewBus = async () => {
        if (!window.db || busSaving) return;
        setBusSaving(true);
        try {
            // Zoznam existujúcich čísel autobusov (kladné celé čísla)
            const existingNumbers = new Set(
                buses
                    .map((b) => Number(b.number))
                    .filter((n) => Number.isFinite(n) && n > 0)
                    .map((n) => Math.floor(n))
            );
    
            // Nájdi najnižšie voľné číslo začínajúc od 1
            let nextNumber = 1;
            while (existingNumbers.has(nextNumber)) {
                nextNumber += 1;
            }

            const docRef = doc(collection(window.db, 'transport'));
            await setDoc(docRef, {
                type: 'bus',
                number: nextNumber,
                name: `Bus ${nextNumber}`,
            });
    
            window.showGlobalNotification(`Pridaný Bus ${nextNumber}.`, 'success');
        } catch (err) {
            console.error('[TRANSPORT] Chyba pri pridávaní autobusu:', err);
            window.showGlobalNotification('Nepodarilo sa pridať autobus.', 'error');
        } finally {
            setBusSaving(false);
        }
    };

    const removeBus = async (bus) => {
        if (!window.db || !bus) return;
        try {
            await deleteDoc(doc(window.db, 'transport', bus.id));
            window.showGlobalNotification(`${bus.name} bol odstránený.`, 'info');
        } catch (err) {
            console.error('[TRANSPORT] Chyba pri odstraňovaní autobusu:', err);
            window.showGlobalNotification('Nepodarilo sa odstrániť autobus.', 'error');
        }
    };

    // ============================================================
    // ZMAZANIE VYGENEROVANÝCH PRESUNOV Z DB
    // ============================================================
    const deleteTransfers = async ({ categoryId, categoryName }) => {
        if (!window.db) {
            window.showGlobalNotification('Databáza nie je inicializovaná', 'error');
            return;
        }
        try {
            const targetCat = cleanCategory(categoryName);

            // ============================================================
            // 1) Zmazať presuny z settings/transportTravelTimes.transfers
            // ============================================================
            const docRef = doc(window.db, TRANSPORT_SETTINGS_COLLECTION, TRANSPORT_SETTINGS_DOC);
            const snap = await getDoc(docRef);

            let keysToDelete = [];
            if (snap.exists()) {
                const data = snap.data() || {};
                const rawTransfers = data[TRANSPORT_TRANSFERS_FIELD] || {};
                Object.entries(rawTransfers).forEach(([key, v]) => {
                    if (!v) return;
                    if (cleanCategory(v.category) === targetCat) {
                        keysToDelete.push(key);
                    }
                });
            }

            if (keysToDelete.length > 0) {
                const transfersPatch = {};
                keysToDelete.forEach((key) => {
                    transfersPatch[key] = deleteField();
                });
                await setDoc(
                    docRef,
                    {
                        [TRANSPORT_TRANSFERS_FIELD]: transfersPatch,
                    },
                    { merge: true }
                );
            }

            // ============================================================
            // 2) Odstrániť tím z danej kategórie z ALL busRows
            //    (teamsIn / teamsOut) vo všetkých autobusoch a dňoch
            // ============================================================
            const rowsUpdates = {}; // rowId → { teamsIn?, teamsOut? }
            let rowsTouchedCount = 0;

            // Prejdi všetky busRows v aktuálnom stave (z React state `busRows`)
            Object.entries(busRows || {}).forEach(([busKey, rows]) => {
                (rows || []).forEach((row) => {
                    const currentTeamsIn = Array.isArray(row.teamsIn) ? row.teamsIn : [];
                    const currentTeamsOut = Array.isArray(row.teamsOut) ? row.teamsOut : [];

                    // Pomocná: zisti, či teamKey patrí do cieľovej kategórie
                    const isFromTargetCategory = (teamKey) => {
                        const [tn, cat] = String(teamKey).split('|');
                        return cleanCategory(cat || '') === targetCat;
                    };

                    const newTeamsIn = currentTeamsIn.filter((tk) => !isFromTargetCategory(tk));
                    const newTeamsOut = currentTeamsOut.filter((tk) => !isFromTargetCategory(tk));

                    const teamsInChanged = newTeamsIn.length !== currentTeamsIn.length;
                    const teamsOutChanged = newTeamsOut.length !== currentTeamsOut.length;

                    if (teamsInChanged || teamsOutChanged) {
                        const patch = {};
                        if (teamsInChanged) patch.teamsIn = newTeamsIn;
                        if (teamsOutChanged) patch.teamsOut = newTeamsOut;
                        rowsUpdates[row.id] = patch;
                        rowsTouchedCount += 1;
                    }
                });
            });

            if (rowsTouchedCount > 0) {
                const promises = Object.entries(rowsUpdates).map(([rid, patch]) =>
                    updateDoc(doc(window.db, 'transport', rid), patch)
                );
                await Promise.all(promises);
            }

            // ============================================================
            // 3) Notifikácia
            // ============================================================
            if (keysToDelete.length === 0 && rowsTouchedCount === 0) {
                window.showGlobalNotification(
                    `Pre kategóriu ${categoryName} neexistujú žiadne presuny ani priradenia na zmazanie.`,
                    'info'
                );
                return;
            }

            const parts = [];
            if (keysToDelete.length > 0) {
                parts.push(`${keysToDelete.length} presunov`);
            }
            if (rowsTouchedCount > 0) {
                parts.push(`${rowsTouchedCount} priradení v autobusoch`);
            }

            window.showGlobalNotification(
                `Zmazané pre kategóriu ${categoryName}: ${parts.join(', ')}.`,
                'success'
            );
        } catch (err) {
            console.error('[TRANSPORT] Chyba pri mazaní presunov:', err);
            window.showGlobalNotification('Nepodarilo sa zmazať presuny.', 'error');
        }
    };

    const deleteSingleTransfer = async (transfer) => {
        if (!window.db || !transfer) return;
        setDeleteTransferSaving(true);
        try {
            const parentKey = transfer._parentKey || transfer.key;
            const docRef = doc(window.db, TRANSPORT_SETTINGS_COLLECTION, TRANSPORT_SETTINGS_DOC);
            await setDoc(
                docRef,
                {
                    [TRANSPORT_TRANSFERS_FIELD]: { [parentKey]: deleteField() },
                },
                { merge: true }
            );
            window.showGlobalNotification(
                `Presun ${transfer.fromLocation} → ${transfer.toLocation} bol odstránený.`,
                'success'
            );
            setDeleteTransferModal(null);
        } catch (err) {
            console.error('[TRANSPORT] Chyba pri mazaní konkrétneho presunu:', err);
            window.showGlobalNotification('Nepodarilo sa odstrániť presun.', 'error');
        } finally {
            setDeleteTransferSaving(false);
        }
    };

    const saveEditedTransfer = async () => {
        if (!window.db || !editingTransfer) return;
        const original = editingTransfer;
        const stops = (editingTransferStops || []).map((s) => String(s || '').trim()).filter(Boolean);
        const parentKey = original._parentKey || original.key;
    
        // ============================================================
        // NOVÉ: Vždy použi `when` z PARENTA (nie zo segmentu).
        //
        // Ak je `editingTransfer` segment (má `_parentKey`), jeho `when`
        // môže byť `null`. V takom prípade treba vziať `when` z parenta,
        // aby sa po úprave trasy nezmenil čas konca presunu.
        //
        // NOVÉ: Ak parent nemá `when` (je prázdny), skús ho poskladať
        // z reálnych časov segmentov (startTs/endTs), aby sa nestratil
        // čas, ktorý bol predtým definovaný.
        // ============================================================
        const originalWhen = (() => {
            // 1) Skús parent záznam
            const parentRec = savedTransfersRef.current.find((s) => s.key === parentKey);
            if (parentRec && parentRec.when && String(parentRec.when).trim() !== '') {
                return parentRec.when;
            }
    
            // 2) Skús `original.when`
            if (original.when && String(original.when).trim() !== '') {
                return original.when;
            }
    
            // 3) NOVÉ: Poskladaj z reálnych časov segmentov parenta
            if (parentRec && Array.isArray(parentRec.segments) && parentRec.segments.length > 0) {
                let earliestStart = null;
                let latestEnd = null;
                parentRec.segments.forEach((s) => {
                    if (s.startTs != null && (earliestStart == null || s.startTs < earliestStart)) {
                        earliestStart = s.startTs;
                    }
                    if (s.endTs != null && (latestEnd == null || s.endTs > latestEnd)) {
                        latestEnd = s.endTs;
                    }
                });
                if (earliestStart != null && latestEnd != null) {
                    return `${formatTsLocal(earliestStart)} – ${formatTsLocal(latestEnd)}`;
                } else if (earliestStart != null) {
                    return formatTsLocal(earliestStart);
                } else if (latestEnd != null) {
                    return formatTsLocal(latestEnd);
                }
            }
    
            // 4) Skús `original.segments`
            if (Array.isArray(original.segments) && original.segments.length > 0) {
                let earliestStart = null;
                let latestEnd = null;
                original.segments.forEach((s) => {
                    if (s.startTs != null && (earliestStart == null || s.startTs < earliestStart)) {
                        earliestStart = s.startTs;
                    }
                    if (s.endTs != null && (latestEnd == null || s.endTs > latestEnd)) {
                        latestEnd = s.endTs;
                    }
                });
                if (earliestStart != null && latestEnd != null) {
                    return `${formatTsLocal(earliestStart)} – ${formatTsLocal(latestEnd)}`;
                } else if (earliestStart != null) {
                    return formatTsLocal(earliestStart);
                } else if (latestEnd != null) {
                    return formatTsLocal(latestEnd);
                }
            }
    
            return null;
        })();
    
        setEditingTransferSaving(true);
        try {
            await updateParentTransfer(parentKey, (draft) => {
                draft.intermediateStops = stops;
                draft.segments = buildDefaultSegments({ ...draft, intermediateStops: stops });
                
                // Zachovaj walking flagy pre segmenty, ktoré ostali rovnaké
                const oldSegments = Array.isArray(original.segments) ? original.segments : [];
                draft.segments.forEach((s) => {
                    const old = oldSegments.find(
                        (o) => normalizePlaceName(o.from) === normalizePlaceName(s.from)
                            && normalizePlaceName(o.to) === normalizePlaceName(s.to)
                    );
                    if (old) {
                        s.isWalking = old.isWalking === true;
                        s.walkingSetAt = old.walkingSetAt || null;
                        s.walkingSetBy = old.walkingSetBy || null;
                    }
                });
    
                // ============================================================
                // NOVÉ: Po úprave medzizastávok VŽDY vráť pôvodný `when`
                // parenta (ak existoval). Tým sa zabezpečí, že celkový
                // interval presunu sa NEMENÍ – iba sa rozdelí na segmenty.
                // ============================================================
                if (originalWhen && originalWhen.trim() !== '') {
                    draft.when = originalWhen;
                }
            });
    
            window.showGlobalNotification(
                stops.length > 0
                    ? `Presun bol upravený (${stops.length} medzizastávok).`
                    : 'Medzizastávky boli odstránené.',
                'success'
            );
            setEditingTransfer(null);
            setEditingTransferStops([]);
        } catch (err) {
            console.error('[TRANSPORT] Chyba pri ukladaní upraveného presunu:', err);
            window.showGlobalNotification('Nepodarilo sa uložiť úpravu presunu.', 'error');
        } finally {
            setEditingTransferSaving(false);
        }
    };

    // ============================================================
    // Pomocná: Zisti, či je konkrétny segment pokrytý autobusom
    // ============================================================
    const isSegmentCoveredByBus = (segment) => {
        if (!segment) return false;
    
        const teamName = String(segment.teamName || '').trim();
        const category = cleanCategory(segment.category || '');
        const dayKey = segment.dayKey || '';
        const fromLoc = normalizePlaceName(segment.fromLocation || '');
        const toLoc = normalizePlaceName(segment.toLocation || '');
        if (!fromLoc || !toLoc) return false;
    
        let found = false;
        Object.entries(busRows || {}).forEach(([busKey, rows]) => {
            if (found) return;
            const bDayKey = busKey.split('|')[1];
            if (bDayKey !== dayKey) return;
    
            const sorted = (rows || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    
            let boardIdx = -1;
            let alightIdx = -1;
    
            for (let i = 0; i < sorted.length; i++) {
                const row = sorted[i];
                const rowFrom = normalizePlaceName(row.placeFrom);
                const rowTo = normalizePlaceName(row.placeTo);
    
                const hasTeamIn = (row.teamsIn || []).some((t) => {
                    const [tn, cat] = String(t).split('|');
                    return String(tn).trim() === teamName && cleanCategory(cat) === category;
                });
                const hasTeamOut = (row.teamsOut || []).some((t) => {
                    const [tn, cat] = String(t).split('|');
                    return String(tn).trim() === teamName && cleanCategory(cat) === category;
                });
    
                if (hasTeamIn && rowFrom === fromLoc && boardIdx === -1) {
                    boardIdx = i;
                }
                if (hasTeamOut && rowTo === toLoc && boardIdx !== -1) {
                    alightIdx = i;
                    break;
                }
            }
    
            if (boardIdx !== -1) {
                found = true;
            }
        });
    
        return found;
    };
    
    // ============================================================
    // Pomocná: Zisti, či všetky PREDCHÁDZAJÚCE segmenty toho istého tímu
    // v ten istý deň už boli vyriešené (peši alebo autobusom).
    // ============================================================
    const arePreviousSegmentsResolved = (transfer) => {
        if (!transfer) return true;
    
        // ============================================================
        // NOVÉ: Vždy použi AKTUÁLNY parent záznam zo savedTransfers.
        //
        // DÔVOD: `transfer` (napr. assignBusTransfer) môže byť zastaraný
        // snapshot z okamihu otvorenia modálneho okna. Ak sa medzitým
        // zmenil parent (napr. si označil predchádzajúci segment ako
        // peši), `transfer.segments` neobsahuje aktuálne `isWalking: true`.
        //
        // Preto VŽDY použijeme aktuálny parent z savedTransfersRef.current
        // a z neho odvodíme `effectiveTransfer` (vrátane aktuálneho
        // isWalking pre konkrétny segment).
        // ============================================================
        const parentKey = transfer._parentKey || transfer.key;
        const currentParent = (savedTransfersRef.current || []).find(
            (s) => s.key === parentKey
        );
    
        let effectiveTransfer = transfer;
        if (currentParent) {
            if (transfer._parentKey) {
                // transfer je segment – nájdi ho v aktuálnom parentovi
                const segIdx = findSegmentIndex(
                    currentParent.segments || [],
                    transfer.fromLocation,
                    transfer.toLocation
                );
                const seg = segIdx !== -1 ? currentParent.segments[segIdx] : null;
                effectiveTransfer = {
                    ...transfer,
                    segments: currentParent.segments,
                    isWalking: seg ? seg.isWalking === true : false,
                };
            } else {
                effectiveTransfer = {
                    ...transfer,
                    segments: currentParent.segments,
                };
            }
        }
    
        // ============================================================
        // OD TOHTO MOMENTU POUŽÍVAME LEN `effectiveTransfer` (NIE `transfer`)
        // ============================================================
        const teamName = String(effectiveTransfer.teamName || '').trim();
        const category = cleanCategory(effectiveTransfer.category || '');
        const dayKey = effectiveTransfer.dayKey || '';
    
        // ============================================================
        // Fallback pre `when` – rovnaká logika ako vo findMatchingBusRows
        //  1) effectiveTransfer.when
        //  2) reálne časy segmentov
        //  3) `when` z PARENT záznamu
        // ============================================================
        let effectiveWhen = effectiveTransfer.when;
    
        if (!effectiveWhen || String(effectiveWhen).trim() === '') {
            const segs = Array.isArray(effectiveTransfer.segments) ? effectiveTransfer.segments : [];
            let earliestStart = null;
            let latestEnd = null;
            segs.forEach((s) => {
                if (s.startTs != null && (earliestStart == null || s.startTs < earliestStart)) earliestStart = s.startTs;
                if (s.endTs != null && (latestEnd == null || s.endTs > latestEnd)) latestEnd = s.endTs;
            });
            if (earliestStart != null && latestEnd != null) {
                effectiveWhen = `${formatTsLocal(earliestStart)} – ${formatTsLocal(latestEnd)}`;
            } else if (earliestStart != null) {
                effectiveWhen = formatTsLocal(earliestStart);
            } else if (latestEnd != null) {
                effectiveWhen = formatTsLocal(latestEnd);
            }
        }
    
        // NOVÉ: fallback z parenta
        if (!effectiveWhen || String(effectiveWhen).trim() === '') {
            if (parentKey) {
                const parentRec = (savedTransfersRef.current || []).find((s) => s.key === parentKey);
                if (parentRec && parentRec.when && String(parentRec.when).trim() !== '') {
                    effectiveWhen = parentRec.when;
                } else if (parentRec && Array.isArray(parentRec.segments) && parentRec.segments.length > 0) {
                    let earliestStart = null;
                    let latestEnd = null;
                    parentRec.segments.forEach((s) => {
                        if (s.startTs != null && (earliestStart == null || s.startTs < earliestStart)) earliestStart = s.startTs;
                        if (s.endTs != null && (latestEnd == null || s.endTs > latestEnd)) latestEnd = s.endTs;
                    });
                    if (earliestStart != null && latestEnd != null) {
                        effectiveWhen = `${formatTsLocal(earliestStart)} – ${formatTsLocal(latestEnd)}`;
                    }
                }
            }
        }
    
        const trRange = parseTransferWhenToRange(effectiveWhen);
        if (!trRange) {
            console.warn('[TRANSPORT][arePreviousSegmentsResolved] Žiadny trRange pre:', { transfer: effectiveTransfer, effectiveWhen });
            return true;
        }
    
        // ============================================================
        // Rozlož VŠETKY presuny toho istého tímu v ten istý deň
        // na segmenty (vrátane tých s intermediateStops), aby sme
        // videli aj predchádzajúce segmenty, ktoré sú súčasťou
        // rovnakého pôvodného presunu.
        // ============================================================

        const targetParentKey = effectiveTransfer._parentKey || effectiveTransfer.key;
        const allSegments = [];
    
        savedTransfers
            .filter((t) =>
                String(t.teamName || '').trim() === teamName &&
                cleanCategory(t.category || '') === category &&
                t.dayKey === dayKey &&
                t.key === targetParentKey
            )
            .forEach((t) => {
                const stops = Array.isArray(t.intermediateStops) ? t.intermediateStops : [];
    
                if (stops.length === 0) {
                    const range = parseTransferWhenToRange(t.when);
                    if (range) {
                        allSegments.push({
                            ...t,
                            range,
                            fromLocation: t.fromLocation,
                            toLocation: t.toLocation,
                            isWalking: t.isWalking === true,
                            _parentKey: t.key,
                        });
                    }
                    return;
                }
    
                // Rozlož parent s medzizastávkami na segmenty
                const routeRaw = [t.fromLocation, ...stops, t.toLocation].filter(Boolean);
                const route = [];
                routeRaw.forEach((loc) => {
                    const normalized = normalizePlaceName(loc);
                    if (route.length === 0 || normalizePlaceName(route[route.length - 1]) !== normalized) {
                        route.push(loc);
                    }
                });
    
                if (route.length < 2) return;
    
                const timeRange = parseTransferWhenToRange(t.when);
                if (!timeRange) return;
    
                const teamKey = `${teamName}|${category}`;
                const allBusRowsForDay = [];
                Object.entries(busRows || {}).forEach(([busKey, rows]) => {
                    const bDayKey = busKey.split('|')[1];
                    if (bDayKey !== dayKey) return;
                    (rows || []).forEach((row) => {
                        allBusRowsForDay.push(row);
                    });
                });
    
                const matchesTeam = (rowTeams) => {
                    if (!Array.isArray(rowTeams)) return false;
                    return rowTeams.some((tk) => {
                        const s = String(tk).trim();
                        if (s === teamKey) return true;
                        const [tn, cat] = s.split('|');
                        return String(tn).trim() === teamName && cleanCategory(cat) === category;
                    });
                };
    
                for (let i = 0; i < route.length - 1; i++) {
                    const segFrom = normalizePlaceName(route[i]);
                    const segTo = normalizePlaceName(route[i + 1]);
    
                    let boardingTs = null;
                    let alightingTs = null;
    
                    allBusRowsForDay.forEach((row) => {
                        const rowFrom = normalizePlaceName(row.placeFrom);
                        const rowTo = normalizePlaceName(row.placeTo);
                        const hasTeamIn = matchesTeam(row.teamsIn);
                        const hasTeamOut = matchesTeam(row.teamsOut);
    
                        if (hasTeamIn && rowFrom === segFrom && row.timeFrom && boardingTs == null) {
                            const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
                            if (dm) {
                                const [h, mi] = row.timeFrom.split(':').map(Number);
                                boardingTs = new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), h, mi, 0, 0).getTime();
                            }
                        }
                        if (hasTeamOut && rowTo === segTo && row.timeTo && alightingTs == null) {
                            const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
                            if (dm) {
                                const [h, mi] = row.timeTo.split(':').map(Number);
                                alightingTs = new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), h, mi, 0, 0).getTime();
                            }
                        }
                    });
    
                    // Zisti isWalking z parent.segments – PRIORITNE
                    const parentSegForThisIdx = Array.isArray(t.segments)
                        ? t.segments.find((s) =>
                            normalizePlaceName(s.from) === normalizePlaceName(route[i]) &&
                            normalizePlaceName(s.to) === normalizePlaceName(route[i + 1])
                        )
                        : null;
                    const isWalkingInParent = parentSegForThisIdx && parentSegForThisIdx.isWalking === true;
                    const isSegmentWalking = t.isWalking === true || isWalkingInParent;
    
                    let segStartTs, segEndTs;
                    if (isSegmentWalking) {
                        // Peší segment: trvanie 0 min → startTs = endTs
                        if (boardingTs != null) {
                            segStartTs = boardingTs;
                            segEndTs = boardingTs;
                        } else if (alightingTs != null) {
                            segStartTs = alightingTs;
                            segEndTs = alightingTs;
                        } else {
                            segStartTs = timeRange.startTs;
                            segEndTs = timeRange.startTs;
                        }
                    } else if (boardingTs != null && alightingTs != null) {
                        segStartTs = boardingTs;
                        segEndTs = alightingTs;
                    } else if (boardingTs != null) {
                        segStartTs = boardingTs;
                        segEndTs = timeRange.endTs;
                    } else if (alightingTs != null) {
                        segStartTs = timeRange.startTs;
                        segEndTs = alightingTs;
                    } else {
                        segStartTs = (i > 0 && allSegments.length > 0)
                            ? allSegments[allSegments.length - 1].range.endTs
                            : timeRange.startTs;
                        segEndTs = timeRange.endTs;
                    }
    
                    allSegments.push({
                        ...t,
                        key: buildTransferKey(t.category, t.teamName, `${formatTsLocal(segStartTs)} – ${formatTsLocal(segEndTs)}`, `Presun z ${route[i]} do ${route[i + 1]}`),
                        range: { startTs: segStartTs, endTs: segEndTs },
                        fromLocation: route[i],
                        toLocation: route[i + 1],
                        isWalking: isSegmentWalking,
                        _parentKey: t.key,
                        _isAssigned: boardingTs != null || alightingTs != null,
                    });
                }
            });
    
        allSegments.sort((a, b) => a.range.startTs - b.range.startTs);
    
        // ============================================================
        // Pre porovnanie aktuálneho segmentu použijeme `from` a `to`.
        // ============================================================
        const transferFromNorm = normalizePlaceName(effectiveTransfer.fromLocation || '');
        const transferToNorm = normalizePlaceName(effectiveTransfer.toLocation || '');
    
        for (const seg of allSegments) {
            // Preskoč samotný aktuálny transfer (podľa from → to)
            const segFromNorm = normalizePlaceName(seg.fromLocation || '');
            const segToNorm = normalizePlaceName(seg.toLocation || '');
            if (segFromNorm === transferFromNorm && segToNorm === transferToNorm) continue;
    
            // ============================================================
            // Peší segment NIKDY neblokuje priradenie.
            // (Kontrola musí byť PRED kontrolou "prvý segment parenta",
            //  aby sa peší segment, ktorý je prvý v parentovi, tiež preskočil.)
            // ============================================================
            if (seg.isWalking === true) continue;
    
            // ============================================================
            // Ak ide o prvý segment parenta (začína tam, kde parent),
            // nemôže mať žiadny predchádzajúci segment. Tým pádom nemôže blokovať priradenie.
            // ============================================================
            if (seg._parentKey) {
                const parent = savedTransfers.find(p => p.key === seg._parentKey);
                if (parent) {
                    const pFromNorm = normalizePlaceName(parent.fromLocation || '');
                    if (segFromNorm === pFromNorm) {
                        continue;
                    }
                }
            }
    
            // Preskoč neskoršie segmenty
            if (seg.range.startTs >= trRange.startTs) continue;
    
            // Ak je segment priradený (má _isAssigned=true), je vyriešený
            if (seg._isAssigned === true) continue;
    
            // Inak over cez isSegmentCoveredByBus
            if (!isSegmentCoveredByBus(seg)) {
                // ============================================================
                // NOVÉ: Debug log – aby si v konzole videl, KTORÝ segment
                // blokuje priradenie.
                // ============================================================
                console.warn('[TRANSPORT][arePreviousSegmentsResolved] BLOKUJÚCI segment:', {
                    seg,
                    trRange,
                    effectiveTransfer: {
                        key: effectiveTransfer.key,
                        _parentKey: effectiveTransfer._parentKey,
                        fromLocation: effectiveTransfer.fromLocation,
                        toLocation: effectiveTransfer.toLocation,
                        when: effectiveTransfer.when,
                    },
                    allSegments: allSegments.map((s) => ({
                        from: s.fromLocation,
                        to: s.toLocation,
                        isWalking: s.isWalking,
                        _isAssigned: s._isAssigned,
                        _parentKey: s._parentKey,
                        range: s.range,
                    })),
                });
                return false;
            }
        }
    
        return true;
    };

    // ============================================================
    // POMOCNÁ: Prevod "HH:MM" + dayKey → timestamp
    // ============================================================
    const timeOnDayKeyToTs = (dayKey, timeStr) => {
        if (!dayKey || !timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) return null;
        const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
        if (!dm) return null;
        const [h, mi] = timeStr.split(':').map(Number);
        return new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), h, mi, 0, 0).getTime();
    };

    // ============================================================
    // NÁJDI VHODNÉ AUTOBUSY PRE PRESUN
    // Vracia len autobusy, ktoré majú AJ nástup AJ výstup
    // (aby tím v buse neuviazol).
    // ============================================================
    const findMatchingBusRows = (transfer) => {
        if (!transfer) return [];
    
        // ============================================================
        // NOVÉ: Pre NEPRIradený segment (má _parentKey a nemá reálne časy)
        // použi PROVIZÓRNY interval z computeProvisionalSegmentRange.
        //
        // Tým sa zabezpečí, že hľadanie autobusov pracuje s ROVNAKÝM
        // intervalom, aký je zobrazený v boxe "Vygenerované presuny".
        // ============================================================
        let effectiveWhen = transfer.when;
    
        // 1) Ak segment má reálny `when`, použi ho
        if (effectiveWhen && String(effectiveWhen).trim() !== '') {
            // OK – použijeme transfer.when
        } else {
            // 2) Skús reálne časy segmentov (startTs/endTs)
            const segs = Array.isArray(transfer.segments) ? transfer.segments : [];
            let earliestStart = null;
            let latestEnd = null;
            segs.forEach((s) => {
                if (s.startTs != null && (earliestStart == null || s.startTs < earliestStart)) {
                    earliestStart = s.startTs;
                }
                if (s.endTs != null && (latestEnd == null || s.endTs > latestEnd)) {
                    latestEnd = s.endTs;
                }
            });
            if (earliestStart != null && latestEnd != null) {
                effectiveWhen = `${formatTsLocal(earliestStart)} – ${formatTsLocal(latestEnd)}`;
            } else if (earliestStart != null) {
                effectiveWhen = formatTsLocal(earliestStart);
            } else if (latestEnd != null) {
                effectiveWhen = formatTsLocal(latestEnd);
            }
        }
    
        // ============================================================
        // NOVÉ: Ak stále nemáme `when` (nepriradený segment), použi
        // PROVIZÓRNY interval – rovnaký, aký sa zobrazuje v boxe.
        // ============================================================
        if (!effectiveWhen || String(effectiveWhen).trim() === '') {
            const provisional = computeProvisionalSegmentRange(transfer);
            if (provisional) {
                effectiveWhen = `${formatTsLocal(provisional.startTs)} – ${formatTsLocal(provisional.endTs)}`;
                console.log('[TRANSPORT][findMatchingBusRows] Použitý provizórny interval:', effectiveWhen);
            }
        }
    
        // ============================================================
        // Posledný fallback – `when` z parenta (nemal by sa použiť, ak
        // computeProvisionalSegmentRange vrátil hodnotu, ale necháme
        // ako poistku).
        // ============================================================
        if (!effectiveWhen || String(effectiveWhen).trim() === '') {
            const parentKey = transfer._parentKey || transfer.key;
            if (parentKey) {
                const parentRec = (savedTransfersRef.current || []).find((s) => s.key === parentKey);
                if (parentRec && parentRec.when && String(parentRec.when).trim() !== '') {
                    effectiveWhen = parentRec.when;
                }
            }
        }
    
        const trRange = parseTransferWhenToRange(effectiveWhen);
        const trFrom = normalizePlaceName(transfer.fromLocation);
        const trTo = normalizePlaceName(transfer.toLocation);
        const trDayKey = transfer.dayKey || null;
    
        if (!trRange || !trFrom || !trTo || !trDayKey) {
            console.warn(`❌ Chýba vstup – končím:`, {
                effectiveWhen, trRange, trFrom, trTo, trDayKey,
            });
            console.groupEnd();
            return [];
        }
    
        const results = [];
    
        Object.entries(busRows || {}).forEach(([key, rows]) => {
            const [busId, dayKey] = key.split('|');
            if (dayKey !== trDayKey) return;
    
            const bus = buses.find((b) => b.id === busId);
            if (!bus) {
                console.warn(`⚠️ Bus ${busId} sa nenašiel v zozname buses`);
                return;
            }
            if (!rows || rows.length === 0) return;
    
            const sortedRows = [...rows].sort((a, b) => (a.order || 0) - (b.order || 0));
    
            console.log(`🚌 Kontrolujem bus "${bus.name}" (${bus.id}), riadkov: ${sortedRows.length}`);
    
            const boardingCandidates = [];
            const alightingCandidates = [];
            let isCurrentSegmentAlreadyAssignedToThisBus = false;
            const currentTeamKey = `${transfer.teamName}|${transfer.category || ''}`;
    
            sortedRows.forEach((row) => {
                const rowFrom = normalizePlaceName(row.placeFrom);
                const rowTo = normalizePlaceName(row.placeTo);
                const rowTimeFromTs = timeOnDayKeyToTs(dayKey, row.timeFrom);
                const rowTimeToTs = timeOnDayKeyToTs(dayKey, row.timeTo);
    
                const matchesFrom = rowFrom && rowFrom === trFrom;
                const matchesTo = rowTo && rowTo === trTo;
    
                // Detailný log pre každý riadok
                if (matchesFrom || matchesTo) {
                    console.log(`  Riadok ${row.id} (order ${row.order}):`, {
                        placeFrom: row.placeFrom,
                        placeTo: row.placeTo,
                        timeFrom: row.timeFrom,
                        timeTo: row.timeTo,
                        rowTimeFromTs,
                        rowTimeToTs,
                        matchesFrom,
                        matchesTo,
                        trRangeStart: trRange.startTs,
                        trRangeEnd: trRange.endTs,
                        timeFromInRange: rowTimeFromTs != null && rowTimeFromTs >= trRange.startTs && rowTimeFromTs <= trRange.endTs,
                        timeToInRange: rowTimeToTs != null && rowTimeToTs >= trRange.startTs && rowTimeToTs <= trRange.endTs,
                    });
                }
    
                // Nástupný kandidát
                if (
                    rowFrom &&
                    rowFrom === trFrom &&
                    rowTimeFromTs != null &&
                    rowTimeFromTs >= trRange.startTs &&
                    rowTimeFromTs <= trRange.endTs
                ) {
                    console.log(`  ✅ NÁSTUPNÝ kandidát: ${row.timeFrom} na ${row.placeFrom}`);
                    boardingCandidates.push({ row, timeTs: rowTimeFromTs });
                } else if (matchesFrom) {
                    if (rowTimeFromTs == null) {
                        console.warn(`  ❌ Riadok má placeFrom=${row.placeFrom}, ale timeFrom je neplatný: "${row.timeFrom}"`);
                    } else if (rowTimeFromTs < trRange.startTs) {
                        console.warn(`  ❌ Čas odchodu ${row.timeFrom} je PRED intervalom presunu (${formatTsLocal(trRange.startTs)})`);
                    } else if (rowTimeFromTs > trRange.endTs) {
                        console.warn(`  ❌ Čas odchodu ${row.timeFrom} je PO intervale presunu (${formatTsLocal(trRange.endTs)})`);
                    }
                }
    
                // Výstupný kandidát
                if (
                    rowTo &&
                    rowTo === trTo &&
                    rowTimeToTs != null &&
                    rowTimeToTs >= trRange.startTs &&
                    rowTimeToTs <= trRange.endTs
                ) {
                    console.log(`  ✅ VÝSTUPNÝ kandidát: ${row.timeTo} na ${row.placeTo}`);
                    alightingCandidates.push({ row, timeTs: rowTimeToTs });
                } else if (matchesTo) {
                    if (rowTimeToTs == null) {
                        console.warn(`  ❌ Riadok má placeTo=${row.placeTo}, ale timeTo je neplatný: "${row.timeTo}"`);
                    } else if (rowTimeToTs < trRange.startTs) {
                        console.warn(`  ❌ Čas príchodu ${row.timeTo} je PRED intervalom presunu (${formatTsLocal(trRange.startTs)})`);
                    } else if (rowTimeToTs > trRange.endTs) {
                        console.warn(`  ❌ Čas príchodu ${row.timeTo} je PO intervale presunu (${formatTsLocal(trRange.endTs)})`);
                    }
                }
    
                // Detekcia už priradeného segmentu
                const hasTeamIn = (row.teamsIn || []).includes(currentTeamKey);
                const hasTeamOut = (row.teamsOut || []).includes(currentTeamKey);
                if (hasTeamIn && rowFrom === trFrom) {
                    isCurrentSegmentAlreadyAssignedToThisBus = true;
                }
                if (hasTeamOut && rowTo === trTo) {
                    isCurrentSegmentAlreadyAssignedToThisBus = true;
                }
            });
    
            console.log(`  Bus "${bus.name}": nástupných=${boardingCandidates.length}, výstupných=${alightingCandidates.length}, už priradený=${isCurrentSegmentAlreadyAssignedToThisBus}`);
    
            if (
                (boardingCandidates.length === 0 || alightingCandidates.length === 0) &&
                !isCurrentSegmentAlreadyAssignedToThisBus
            ) {
                console.warn(`  ⏭️ Bus "${bus.name}" VYNECHANÝ (chýba nástup alebo výstup)`);
                return;
            }
    
            boardingCandidates.forEach((board) => {
                alightingCandidates.forEach((alight) => {
                    if ((alight.row.order || 0) < (board.row.order || 0)) {
                        console.warn(`  ⏭️ Výstup (order ${alight.row.order}) je pred nástupom (order ${board.row.order})`);
                        return;
                    }
    
                    const boardTs = timeOnDayKeyToTs(dayKey, board.row.timeFrom);
                    const alightTs = timeOnDayKeyToTs(dayKey, alight.row.timeTo);
                    if (boardTs != null && alightTs != null && alightTs < boardTs) {
                        console.warn(`  ⏭️ Výstup (${alight.row.timeTo}) je časovo pred nástupom (${board.row.timeFrom})`);
                        return;
                    }
    
                    const segmentFrom = normalizePlaceName(board.row.placeFrom) || trFrom;
                    const segmentTo = normalizePlaceName(alight.row.placeTo) || trTo;
    
                    console.log(`  ✅ PÁR: ${board.row.timeFrom} ${segmentFrom} → ${alight.row.timeTo} ${segmentTo}`);
    
                    results.push({
                        bus,
                        trip: {
                            bus,
                            dayKey,
                            fromPlace: segmentFrom,
                            toPlace: segmentTo,
                            timeFrom: board.row.timeFrom || '',
                            timeTo: alight.row.timeTo || '',
                            firstRowId: board.row.id,
                            lastRowId: alight.row.id,
                            rows: sortedRows,
                        },
                        boardingRow: board.row,
                        alightingRow: alight.row,
                        side: 'in',
                        boardingTime: board.row.timeFrom,
                        alightingTime: alight.row.timeTo,
                    });
                });
            });
        });
    
        console.log(`📊 Nájdených párov PRED deduplikáciou: ${results.length}`);
    
        // ============================================================
        // Deduplikácia
        // ============================================================
        const computeTripDurationMinutes = (boardingRow, alightingRow) => {
            const timeRe = /^\d{1,2}:\d{2}$/;
            if (!boardingRow || !alightingRow) return null;
            if (!timeRe.test(boardingRow.timeFrom || '') || !timeRe.test(alightingRow.timeTo || '')) {
                return null;
            }
            const [bh, bm] = boardingRow.timeFrom.split(':').map(Number);
            const [ah, am] = alightingRow.timeTo.split(':').map(Number);
            let diff = (ah * 60 + am) - (bh * 60 + bm);
            if (diff < 0) diff += 24 * 60;
            return diff;
        };

        // Pomocná: vráti "efektívne" trvanie pre porovnanie.
        // Ak sa trvanie nedá vypočítať, vráti Number.POSITIVE_INFINITY,
        // aby takýto kandidát nikdy nevyhral proti vypočítateľnému.
        const getEffectiveDuration = (r) => {
            const d = computeTripDurationMinutes(r.boardingRow, r.alightingRow);
            return d != null ? d : Number.POSITIVE_INFINITY;
        };

        // Pomocná: z danej skupiny vyberie toho s najkratším trvaním.
        // Pri zhode trvania (napr. obe Infinity) nechá pôvodné poradie
        // a vyberie prvého – ale keďže ide o rovnaký čas začiatku/konca,
        // je to jedno.
        const pickShortestDuration = (group) => {
            if (!group || group.length === 0) return null;
            if (group.length === 1) return group[0];
            let best = group[0];
            let bestDuration = getEffectiveDuration(best);
            for (let i = 1; i < group.length; i++) {
                const r = group[i];
                const d = getEffectiveDuration(r);
                if (d < bestDuration) {
                    best = r;
                    bestDuration = d;
                }
            }
            return best;
        };

        // ============================================================
        // KROK 1: Deduplikácia podľa rovnakého času ZAČIATKU.
        //
        // Kľúč: busId|dayKey|boardingTime|fromPlace
        // (fromPlace je súčasťou kľúča, aby sa nezlievali rôzne trasy
        //  v tom istom buse s rovnakým časom začiatku – tie sa majú
        //  zobraziť obe, keďže idú z iného miesta.)
        // ============================================================
        const groupedByBoarding = new Map();
        results.forEach((r) => {
            const busId = r.bus?.id || '';
            const dayKey = r.trip?.dayKey || '';
            const boardingTime = r.boardingTime || '';
            const fromPlace = normalizePlaceName(r.trip?.fromPlace || '');
            const key = `${busId}|${dayKey}|${boardingTime}|${fromPlace}`;
            if (!groupedByBoarding.has(key)) groupedByBoarding.set(key, []);
            groupedByBoarding.get(key).push(r);
        });

        const afterBoardingDedup = [];
        groupedByBoarding.forEach((group) => {
            const best = pickShortestDuration(group);
            if (best) afterBoardingDedup.push(best);
        });

        // ============================================================
        // KROK 2: Deduplikácia podľa rovnakého času KONCA.
        //
        // Kľúč: busId|dayKey|alightingTime|toPlace
        // (toPlace je súčasťou kľúča, aby sa nezlievali rôzne trasy
        //  končiace na inom mieste v tom istom buse s rovnakým časom
        //  konca.)
        // ============================================================
        const groupedByAlighting = new Map();
        afterBoardingDedup.forEach((r) => {
            const busId = r.bus?.id || '';
            const dayKey = r.trip?.dayKey || '';
            const alightingTime = r.alightingTime || '';
            const toPlace = normalizePlaceName(r.trip?.toPlace || '');
            const key = `${busId}|${dayKey}|${alightingTime}|${toPlace}`;
            if (!groupedByAlighting.has(key)) groupedByAlighting.set(key, []);
            groupedByAlighting.get(key).push(r);
        });

        const dedupedResults = [];
        groupedByAlighting.forEach((group) => {
            const best = pickShortestDuration(group);
            if (best) dedupedResults.push(best);
        });

        console.log(`📊 Po deduplikácii: ${dedupedResults.length}`);
    
        // ============================================================
        // Filter trvania <= 60 min
        // ============================================================
        const MAX_TRIP_DURATION_MINUTES = 60;
        const filteredByDuration = dedupedResults.filter((r) => {
            const duration = computeTripDurationMinutes(r.boardingRow, r.alightingRow);
            if (duration == null) return true;
            if (duration > MAX_TRIP_DURATION_MINUTES) {
                console.warn(`❌ Vyradené (trvanie ${duration} min > ${MAX_TRIP_DURATION_MINUTES}):`, {
                    bus: r.bus.name,
                    boarding: r.boardingTime,
                    alighting: r.alightingTime,
                });
                return false;
            }
            return true;
        });
    
        filteredByDuration.sort((a, b) => {
            const timeA = a.boardingTime || a.alightingTime || '';
            const timeB = b.boardingTime || b.alightingTime || '';
            if (timeA !== timeB) return timeA.localeCompare(timeB);
            return String(a.bus.name).localeCompare(String(b.bus.name), 'sk');
        });
    
        console.log(`✅ VÝSLEDOK: ${filteredByDuration.length} autobusov`, filteredByDuration.map(r => ({
            bus: r.bus.name,
            from: r.trip.fromPlace,
            to: r.trip.toPlace,
            timeFrom: r.boardingTime,
            timeTo: r.alightingTime,
        })));
        console.groupEnd();
    
        return filteredByDuration;
    };

    // Čistý výpočet – bez zápisu do DB
    const recomputeParentSegmentsInPlace = (draft) => {
        if (!draft) return;
    
        const originalWhenFromDraft = draft.when;
        const stops = Array.isArray(draft.intermediateStops) ? draft.intermediateStops : [];
        const routeRaw = [draft.fromLocation, ...stops, draft.toLocation].filter(Boolean);
        const route = [];
        routeRaw.forEach((loc) => {
            const n = normalizePlaceName(loc);
            if (route.length === 0 || normalizePlaceName(route[route.length - 1]) !== n) route.push(loc);
        });
        if (route.length < 2) return;
    
        // Ak segments chýbajú alebo nesedia s route, pregeneruj ich (from/to)
        if (!Array.isArray(draft.segments) || draft.segments.length !== route.length - 1) {
            draft.segments = route.slice(0, -1).map((fromLoc, i) => ({
                from: fromLoc,
                to: route[i + 1],
                startTs: null,
                endTs: null,
                when: null,
                isWalking: false,
                busAssigned: false,
                walkingSetAt: null,
                walkingSetBy: null,
            }));
        } else {
            // Zosúlaď from/to so skutočnou route (kvôli úprave stops)
            draft.segments = draft.segments.map((s, i) => ({
                ...s,
                from: route[i],
                to: route[i + 1],
            }));
        }
    
        const dayKey = draft.dayKey || '';
        const teamName = String(draft.teamName || '').trim();
        const category = cleanCategory(draft.category || '');
    
        // Bus rows pre daný deň
        const allBusRowsForDay = [];
        Object.entries(busRows || {}).forEach(([busKey, rows]) => {
            const bDayKey = busKey.split('|')[1];
            if (bDayKey !== dayKey) return;
            (rows || []).forEach((row) => allBusRowsForDay.push({ ...row, _busKey: busKey }));
        });
        allBusRowsForDay.sort((a, b) => (a.timeFrom || '').localeCompare(b.timeFrom || ''));
    
        const teamKey = `${teamName}|${category}`;
        const matchesTeam = (rowTeams) => {
            if (!Array.isArray(rowTeams)) return false;
            return rowTeams.some((tk) => {
                const s = String(tk).trim();
                if (s === teamKey) return true;
                const [tn, cat] = s.split('|');
                return String(tn).trim() === teamName && cleanCategory(cat) === category;
            });
        };
    
        const findBusTimesForSegment = (fromLoc, toLoc) => {
            const fromNorm = normalizePlaceName(fromLoc);
            const toNorm = normalizePlaceName(toLoc);
            let boardingTs = null;
            let alightingTs = null;
            let busId = null;
            allBusRowsForDay.forEach((row) => {
                const rowFrom = normalizePlaceName(row.placeFrom);
                const rowTo = normalizePlaceName(row.placeTo);
                const hasTeamIn = matchesTeam(row.teamsIn);
                const hasTeamOut = matchesTeam(row.teamsOut);
                if (hasTeamIn && rowFrom === fromNorm && row.timeFrom && boardingTs == null) {
                    const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
                    if (dm) {
                        const [h, mi] = row.timeFrom.split(':').map(Number);
                        boardingTs = new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), h, mi, 0, 0).getTime();
                        busId = row._busKey ? String(row._busKey).split('|')[0] : null;
                    }
                }
                if (hasTeamOut && rowTo === toNorm && row.timeTo && alightingTs == null) {
                    const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
                    if (dm) {
                        const [h, mi] = row.timeTo.split(':').map(Number);
                        alightingTs = new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), h, mi, 0, 0).getTime();
                    }
                }
            });
            return { boardingTs, alightingTs, busId };
        };
    
        // ============================================================
        // NOVÉ: Segmenty dostanú časy LEN ak sú priradené k busu.
        // Pešie segmenty a nepriradené segmenty NEMAJÚ časy.
        //
        // DÔLEŽITÉ: Ak segment už má explicitne nastavené busId a časy
        // (napr. z assignTransferToBus), ZACHOVAJ ich – nehľadaj znova
        // v busRows (mohli by byť ešte neaktualizované kvôli onSnapshot).
        // ============================================================
        draft.segments = draft.segments.map((seg) => {
            // Ak segment už má explicitne nastavené busId + startTs + endTs,
            // zachovaj ich (neprepisuj na null).
            if (
                seg.busAssigned === true &&
                seg.busId != null &&
                seg.startTs != null &&
                seg.endTs != null &&
                seg.endTs > seg.startTs
            ) {
                return {
                    ...seg,
                    isWalking: false,
                    when: `${formatTsLocal(seg.startTs)} – ${formatTsLocal(seg.endTs)}`,
                };
            }
        
            const busTimes = findBusTimesForSegment(seg.from, seg.to);
            if (busTimes.boardingTs != null && busTimes.alightingTs != null && busTimes.alightingTs > busTimes.boardingTs) {
                return {
                    ...seg,
                    startTs: busTimes.boardingTs,
                    endTs: busTimes.alightingTs,
                    when: `${formatTsLocal(busTimes.boardingTs)} – ${formatTsLocal(busTimes.alightingTs)}`,
                    isWalking: false,
                    busAssigned: true,
                    busId: busTimes.busId || seg.busId || null,
                };
            }
            // ============================================================
            // NOVÉ: Nepriradené segmenty (ani bus, ani walking) NEDOSTÁVAJÚ
            // nové časy – ALE ak segment UŽ MAL reálne časy z predošlého
            // priradenia (busAssigned === true && busId != null && startTs/endTs),
            // ZACHOVAJ ICH.
            //
            // DÔVOD: recomputeParentSegmentsInPlace sa volá pri každej zmene
            // busRows (onSnapshot). Ak sa zavolá v momente, keď onSnapshot
            // ešte nestihol aktualizovať busRows (napr. tesne po zápise
            // teamsIn/teamsOut), findBusTimesForSegment nič nenájde a bez
            // tejto ochrany by sa prepísal busAssigned na false a časy na null
            // – čo je nesprávne, pretože tím v buse SKUTOČNE sedí.
            // ============================================================
            const hadRealBusTimes =
                seg.busAssigned === true &&
                seg.busId != null &&
                seg.startTs != null &&
                seg.endTs != null &&
                seg.endTs > seg.startTs;
            
            if (hadRealBusTimes) {
                return {
                    ...seg,
                    isWalking: false,
                    when: `${formatTsLocal(seg.startTs)} – ${formatTsLocal(seg.endTs)}`,
                };
            }
            
            return {
                ...seg,
                startTs: null,
                endTs: null,
                when: null,
                busAssigned: false,
                busId: null,
            };
        });
    
        // ============================================================
        // NOVÉ: Celkový `when` parenta sa NIKDY nemení pri úprave
        // medzizastávok. Zachová sa pôvodný `when` (ak existoval).
        // ============================================================
        const nonWalkingSegments = draft.segments.filter((s) => s.isWalking !== true);
        const busSegments = nonWalkingSegments.filter((s) => s.busAssigned === true);
        
        const parentIsFullyWalking =
            draft.segments.length > 0 &&
            draft.segments.every((s) => s.isWalking === true);
        
        const savedParentWhen = (() => {
            if (!draft.key) return null;
            const savedRec = (savedTransfersRef.current || []).find((s) => s.key === draft.key);
            if (savedRec && savedRec.when && String(savedRec.when).trim() !== '') {
                return savedRec.when;
            }
            return null;
        })();
        
        if (originalWhenFromDraft && String(originalWhenFromDraft).trim() !== '') {
            draft.when = originalWhenFromDraft;
        } else if (savedParentWhen) {
            draft.when = savedParentWhen;
        } else if (parentIsFullyWalking) {
            draft.when = '';
        } else if (busSegments.length > 0) {
            const busStart = busSegments.map((s) => s.startTs).filter((ts) => ts != null);
            const busEnd = busSegments.map((s) => s.endTs).filter((ts) => ts != null);
            if (busStart.length > 0 && busEnd.length > 0) {
                draft.when = `${formatTsLocal(Math.min(...busStart))} – ${formatTsLocal(Math.max(...busEnd))}`;
            } else {
                draft.when = '';
            }
        } else {
            const allSegStart = draft.segments.map((s) => s.startTs).filter((ts) => ts != null);
            const allSegEnd = draft.segments.map((s) => s.endTs).filter((ts) => ts != null);
            if (allSegStart.length > 0 && allSegEnd.length > 0) {
                draft.when = `${formatTsLocal(Math.min(...allSegStart))} – ${formatTsLocal(Math.max(...allSegEnd))}`;
            } else {
                draft.when = '';
            }
        }
    };
    
    // Zápis verzia – zavolá inPlace a zapíše parenta
    const recomputeParentSegments = async (parent) => {
        if (!window.db || !parent) return;
        const docRef = doc(window.db, TRANSPORT_SETTINGS_COLLECTION, TRANSPORT_SETTINGS_DOC);
        const draft = {
            ...parent,
            segments: Array.isArray(parent.segments)
                ? parent.segments.map((s) => ({ ...s }))
                : buildDefaultSegments(parent),
        };
        recomputeParentSegmentsInPlace(draft);
    
        const payload = {
            category: draft.category,
            teamUid: draft.teamUid,
            teamIndex: draft.teamIndex,
            dayKey: draft.dayKey,
            fromLocation: draft.fromLocation,
            toLocation: draft.toLocation,
            when: draft.when,
            text: draft.text,
            segments: draft.segments,
        };
        if (Array.isArray(draft.intermediateStops) && draft.intermediateStops.length > 0) {
            payload.intermediateStops = draft.intermediateStops;
        }
        if (draft.isWalking === true) {
            payload.isWalking = true;
            payload.walkingSetAt = draft.walkingSetAt || Timestamp.fromDate(new Date());
            payload.walkingSetBy = draft.walkingSetBy || (userProfileData && userProfileData.email) || null;
        }
    
        await setDoc(docRef, { [TRANSPORT_TRANSFERS_FIELD]: { [parent.key]: payload } }, { merge: true });
    };

    const updateParentTransfer = async (parentKey, mutator) => {
        if (!window.db || !parentKey) return;
        const parent = savedTransfersRef.current.find((s) => s.key === parentKey);
        if (!parent) {
            console.warn('[TRANSPORT] updateParentTransfer: parent sa nenašiel', parentKey);
            return;
        }
    
        const draft = {
            ...parent,
            segments: Array.isArray(parent.segments)
                ? parent.segments.map((s) => ({ ...s }))
                : buildDefaultSegments(parent),
        };
    
        mutator(draft);
        recomputeParentSegmentsInPlace(draft);
    
        const docRef = doc(window.db, TRANSPORT_SETTINGS_COLLECTION, TRANSPORT_SETTINGS_DOC);
        const payload = {
            category: draft.category,
            teamUid: draft.teamUid,
            teamIndex: draft.teamIndex,
            dayKey: draft.dayKey,
            fromLocation: draft.fromLocation,
            toLocation: draft.toLocation,
            when: draft.when,
            text: draft.text,
            segments: draft.segments,
        };
    
        if (Array.isArray(draft.intermediateStops) && draft.intermediateStops.length > 0) {
            payload.intermediateStops = draft.intermediateStops;
        } else {
            payload.intermediateStops = deleteField();
        }
    
        if (draft.isWalking === true) {
            payload.when = '';
            payload.segments = (draft.segments || []).map((s) => ({
                ...s,
                startTs: null,
                endTs: null,
                when: null,
                busAssigned: false,
            }));
            payload.isWalking = true;
            payload.walkingSetAt = draft.walkingSetAt || Timestamp.fromDate(new Date());
            payload.walkingSetBy = draft.walkingSetBy || (userProfileData && userProfileData.email) || null;
        } else {
            payload.isWalking = deleteField();
            payload.walkingSetAt = deleteField();
            payload.walkingSetBy = deleteField();
        }
    
        await setDoc(docRef, { [TRANSPORT_TRANSFERS_FIELD]: { [parentKey]: payload } }, { merge: true });
    };

    // ============================================================
    // NASTAVENIE PRESUNU AKO "PEŠI"
    // ============================================================
    const setTransferAsWalking = async (transfer) => {
        if (!window.db || !transfer) return;
        try {
            const parentKey = transfer._parentKey || transfer.key;
            const parent = savedTransfersRef.current.find((s) => s.key === parentKey);
            if (!parent) {
                window.showGlobalNotification('Parent presun sa nenašiel.', 'error');
                return;
            }
    
            // ============================================================
            // NOVÉ: Ak bol segment priradený k busu, odstráň ho z busu.
            // (Tím ide peši, nemá byť v buse.)
            // ============================================================
            if (transfer._parentKey) {
                const teamKey = `${transfer.teamName}|${transfer.category || ''}`;
                const trFrom = normalizePlaceName(transfer.fromLocation);
                const trTo = normalizePlaceName(transfer.toLocation);
                const rowsUpdates = {};
            
                // Nájdi konkrétny segment v parent zázname, aby sme zistili,
                // do ktorého busu bol priradený a aké mal časy.
                const parentRec = savedTransfersRef.current.find((s) => s.key === parentKey);
                let targetSeg = null;
                if (parentRec && Array.isArray(parentRec.segments)) {
                    const segIdx = findSegmentIndex(parentRec.segments, transfer.fromLocation, transfer.toLocation);
                    if (segIdx !== -1) targetSeg = parentRec.segments[segIdx];
                }
            
                Object.entries(busRows || {}).forEach(([busKey, rows]) => {
                    const [busId, dayKey] = busKey.split('|');
                    if (dayKey !== (transfer.dayKey || '')) return;
            
                    // Ak máme informáciu o buse pre tento segment, filtruj len
                    // riadky v tomto buse. Inak (nemáme info) prejdi všetky.
                    if (targetSeg && targetSeg.busId && busId !== targetSeg.busId) return;
            
                    (rows || []).forEach((row) => {
                        const rowFrom = normalizePlaceName(row.placeFrom);
                        const rowTo = normalizePlaceName(row.placeTo);
            
                        // Odstráň tím LEN z riadkov, ktoré zodpovedajú tomuto
                        // segmentu: nástupný riadok (placeFrom === trFrom) alebo
                        // výstupný riadok (placeTo === trTo).
                        const isBoardingRow = rowFrom === trFrom;
                        const isAlightingRow = rowTo === trTo;
            
                        if (!isBoardingRow && !isAlightingRow) return;
            
                        const hasIn = (row.teamsIn || []).some((t) => String(t) === teamKey);
                        const hasOut = (row.teamsOut || []).some((t) => String(t) === teamKey);
                        if (!hasIn && !hasOut) return;
            
                        rowsUpdates[row.id] = {
                            teamsIn: (row.teamsIn || []).filter((t) => String(t) !== teamKey),
                            teamsOut: (row.teamsOut || []).filter((t) => String(t) !== teamKey),
                        };
                    });
                });
            
                if (Object.keys(rowsUpdates).length > 0) {
                    await Promise.all(
                        Object.entries(rowsUpdates).map(([rid, data]) =>
                            updateDoc(doc(window.db, 'transport', rid), data)
                        )
                    );
                }
            }
    
            await updateParentTransfer(parentKey, (draft) => {
                const segIdx = transfer._parentKey
                    ? findSegmentIndex(draft.segments, transfer.fromLocation, transfer.toLocation)
                    : -1;
                if (segIdx !== -1) {
                    draft.segments[segIdx].isWalking = true;
                    draft.segments[segIdx].busAssigned = false;
                    draft.segments[segIdx].walkingSetAt = Timestamp.fromDate(new Date());
                    draft.segments[segIdx].walkingSetBy = (userProfileData && userProfileData.email) || null;
                } else {
                    // Celý parent walking
                    draft.segments.forEach((s) => {
                        s.isWalking = true;
                        s.busAssigned = false;
                        s.walkingSetAt = Timestamp.fromDate(new Date());
                        s.walkingSetBy = (userProfileData && userProfileData.email) || null;
                    });
                    draft.isWalking = true;
                    draft.walkingSetAt = Timestamp.fromDate(new Date());
                    draft.walkingSetBy = (userProfileData && userProfileData.email) || null;
                }
            });
    
            window.showGlobalNotification('Presun bol označený ako „peši".', 'success');
            setTransferActionModal(null);
        } catch (err) {
            console.error('[TRANSPORT] Chyba pri označení presunu ako peši:', err);
            window.showGlobalNotification('Nepodarilo sa označiť presun ako peši.', 'error');
        }
    };

    // ============================================================
    // ODSTRÁNENIE PRÍZNAKU "PEŠI" – presun sa vráti medzi vygenerované
    // ============================================================
    const removeWalkingFlag = async () => {
        if (!window.db || !removeWalkingModal?.transfer) return;
        const transfer = removeWalkingModal.transfer;
        setRemoveWalkingSaving(true);
        try {
            const parentKey = transfer._parentKey || transfer.key;
            await updateParentTransfer(parentKey, (draft) => {
                const segIdx = transfer._parentKey
                    ? findSegmentIndex(draft.segments, transfer.fromLocation, transfer.toLocation)
                    : -1;
                if (segIdx !== -1) {
                    draft.segments[segIdx].isWalking = false;
                    draft.segments[segIdx].walkingSetAt = null;
                    draft.segments[segIdx].walkingSetBy = null;
                } else {
                    draft.segments.forEach((s) => {
                        s.isWalking = false;
                        s.walkingSetAt = null;
                        s.walkingSetBy = null;
                    });
                    draft.isWalking = false;
                    draft.walkingSetAt = null;
                    draft.walkingSetBy = null;
                }
            });
            window.showGlobalNotification('Príznak „peši" bol odstránený.', 'success');
            setRemoveWalkingModal(null);
        } catch (err) {
            console.error('[TRANSPORT] Chyba pri odstraňovaní príznaku peši:', err);
            window.showGlobalNotification('Nepodarilo sa odstrániť príznak peši.', 'error');
        } finally {
            setRemoveWalkingSaving(false);
        }
    };

    // ============================================================
    // PRIRADENIE PRESUNU K AUTOBUSU
    // ============================================================
    const assignTransferToBus = async () => {
        if (!window.db || !assignBusTransfer) return;
    
        // ============================================================
        // NOVÉ: Obnov assignBusTransfer z aktuálneho savedTransfers
        // (rovnaká logika ako v modálnom okne).
        // ============================================================
        const parentKeyForFresh = assignBusTransfer._parentKey || assignBusTransfer.key;
        const freshParent = savedTransfersRef.current.find((s) => s.key === parentKeyForFresh);
    
        const transfer = (() => {
            if (!freshParent) return assignBusTransfer;
            if (assignBusTransfer._parentKey) {
                const segIdx = findSegmentIndex(
                    freshParent.segments || [],
                    assignBusTransfer.fromLocation,
                    assignBusTransfer.toLocation
                );
                const seg = segIdx !== -1 ? freshParent.segments[segIdx] : null;
                return {
                    ...assignBusTransfer,
                    segments: freshParent.segments,
                    isWalking: seg ? seg.isWalking === true : false,
                };
            }
            return {
                ...assignBusTransfer,
                segments: freshParent.segments,
            };
        })();
    
//        if (!arePreviousSegmentsResolved(transfer)) {
//            window.showGlobalNotification(
//                'Najprv musíte priradiť predchádzajúce segmenty tohto presunu (alebo ich označiť ako „peši").',
//                'error'
//            );
//            return;
//        }
    
        if (!assignBusSelectedKey) {
            window.showGlobalNotification('Vyberte autobus/riadok.', 'error');
            return;
        }
    
        const [busId, boardingRowId, alightingRowId, side] = assignBusSelectedKey.split('|');
    
        const teamKey = `${transfer.teamName}|${transfer.category || ''}`;
        const trFrom = normalizePlaceName(transfer.fromLocation);
        const trTo = normalizePlaceName(transfer.toLocation);
        const trDayKey = transfer.dayKey || null;
    
        const busRowsKey = `${busId}|${trDayKey}`;
        const rows = busRows[busRowsKey] || [];
    
        let boardingRow = null;
        let alightingRow = null;
    
        if (boardingRowId) {
            boardingRow = rows.find((r) => r.id === boardingRowId) || null;
        }
        if (alightingRowId) {
            alightingRow = rows.find((r) => r.id === alightingRowId) || null;
        }
    
        if (!boardingRow || !alightingRow) {
            rows.forEach((row) => {
                const rowFrom = normalizePlaceName(row.placeFrom);
                const rowTo = normalizePlaceName(row.placeTo);
                if (!boardingRow && rowFrom && rowFrom === trFrom) boardingRow = row;
                if (!alightingRow && rowTo && rowTo === trTo) alightingRow = row;
            });
        }
    
        setAssignBusSaving(true);
        try {
            const updates = {};
    
            if (boardingRow) {
                const newTeamsIn = Array.from(new Set([...(boardingRow.teamsIn || []), teamKey]));
                updates[boardingRow.id] = { ...(updates[boardingRow.id] || {}), teamsIn: newTeamsIn };
            }
    
            if (alightingRow) {
                const newTeamsOut = Array.from(new Set([...(alightingRow.teamsOut || []), teamKey]));
                updates[alightingRow.id] = { ...(updates[alightingRow.id] || {}), teamsOut: newTeamsOut };
            }
    
            if (!boardingRow && !alightingRow) {
                const fallbackRowId = boardingRowId || alightingRowId;
                let currentRow = rows.find(r => r.id === fallbackRowId);
                if (currentRow) {
                    if (side === 'in') {
                        const newTeamsIn = Array.from(new Set([...(currentRow.teamsIn || []), teamKey]));
                        updates[currentRow.id] = { teamsIn: newTeamsIn };
                    } else {
                        const newTeamsOut = Array.from(new Set([...(currentRow.teamsOut || []), teamKey]));
                        updates[currentRow.id] = { teamsOut: newTeamsOut };
                    }
                }
            }
    
            await Promise.all(
                Object.entries(updates).map(([rid, data]) =>
                    updateDoc(doc(window.db, 'transport', rid), data)
                )
            );
    
            // Po zápise teamsIn/teamsOut do busRows:
            // NOVÉ: Počkaj dostatočne dlho, aby onSnapshot stihol aktualizovať busRows
            // (inak recomputeParentSegmentsInPlace nenájde tím v busRows a prepíše časy na null)
            await new Promise((r) => setTimeout(r, 600));
    
            // ============================================================
            // NOVÉ: Vypočítaj reálne časy pre segment PRIAMO z vybraných
            // nástupných/výstupných riadkov autobusu (busId, startTs, endTs)
            // a zapíš ich do segmentu v parent zázname.
            // ============================================================
            const computeSegmentTimesFromRows = () => {
                let startTs = null;
                let endTs = null;

                if (boardingRow && boardingRow.timeFrom) {
                    startTs = timeOnDayKeyToTs(trDayKey, boardingRow.timeFrom);
                }
                if (alightingRow && alightingRow.timeTo) {
                    endTs = timeOnDayKeyToTs(trDayKey, alightingRow.timeTo);
                }

                // Ak chýba nástupný alebo výstupný čas, skús dopočítať z trvania jázdy
                if (startTs != null && endTs == null) {
                    const mins = getTravelMinutes(transfer.fromLocation, transfer.toLocation);
                    if (mins != null) endTs = startTs + mins * 60000;
                }
                if (endTs != null && startTs == null) {
                    const mins = getTravelMinutes(transfer.fromLocation, transfer.toLocation);
                    if (mins != null) startTs = endTs - mins * 60000;
                }

                return { startTs, endTs };
            };

            const segTimes = computeSegmentTimesFromRows();

            const parentKey = transfer._parentKey || transfer.key;
            await updateParentTransfer(parentKey, (draft) => {
                const segIdx = findSegmentIndex(draft.segments, transfer.fromLocation, transfer.toLocation);
                if (segIdx !== -1) {
                    draft.segments[segIdx].busAssigned = true;
                    draft.segments[segIdx].isWalking = false;
                    draft.segments[segIdx].busId = busId || null;

                    // ============================================================
                    // NOVÉ: Zapíš reálne časy začiatku a konca presunu v buse
                    // priamo do segmentu.
                    // ============================================================
                    if (segTimes.startTs != null && segTimes.endTs != null) {
                        draft.segments[segIdx].startTs = segTimes.startTs;
                        draft.segments[segIdx].endTs = segTimes.endTs;
                        draft.segments[segIdx].when = `${formatTsLocal(segTimes.startTs)} – ${formatTsLocal(segTimes.endTs)}`;
                    } else if (segTimes.startTs != null) {
                        draft.segments[segIdx].startTs = segTimes.startTs;
                        draft.segments[segIdx].endTs = null;
                        draft.segments[segIdx].when = formatTsLocal(segTimes.startTs);
                    } else if (segTimes.endTs != null) {
                        draft.segments[segIdx].startTs = null;
                        draft.segments[segIdx].endTs = segTimes.endTs;
                        draft.segments[segIdx].when = formatTsLocal(segTimes.endTs);
                    }
                }
            });
    
            // ============================================================
            // NOVÉ: Po priradení k busu ešte raz dopočítaj segments
            // (updateParentTransfer už volá recomputeParentSegmentsInPlace,
            //  ale pre istotu ešte raz explicitne).
            // ============================================================
            const parent = savedTransfersRef.current.find((s) => s.key === parentKey);
            if (parent) {
                await recomputeParentSegments(parent);
            }
    
            const parts = [];
            if (boardingRow) parts.push('nástup');
            if (alightingRow) parts.push('výstup');
            if (parts.length === 0) parts.push(side === 'in' ? 'nástup' : 'výstup');
    
            window.showGlobalNotification(
                `Tím "${transfer.teamName}" bol priradený (${parts.join(' + ')}).`,
                'success'
            );
    
            setShowAssignBusModal(false);
            setTransferActionModal(null);
            setAssignBusTransfer(null);
            setAssignBusMatches([]);
            setAssignBusSelectedKey('');
        } catch (err) {
            console.error('[TRANSPORT] Chyba pri priraďovaní presunu k autobusu:', err);
            window.showGlobalNotification('Nepodarilo sa priradiť presun k autobusu.', 'error');
        } finally {
            setAssignBusSaving(false);
        }
    };

    // ============================================================
    // TRVANIA JÁZDY
    // ============================================================
    const saveTravelTime = async (fromStop, toStop, rawValue) => {
        if (!window.db || !fromStop || !toStop) return;

        const key = `${fromStop.id}|${toStop.id}`;
        const rawStr = rawValue == null ? '' : String(rawValue).trim();
        const minutes = rawStr === '' ? null : parseInt(rawStr, 10);

        if (minutes != null && (isNaN(minutes) || minutes < 0)) {
            window.showGlobalNotification('Trvanie musí byť nezáporné číslo (minúty).', 'error');
            return;
        }

        setTravelTimesSaving(true);
        try {
            const docRef = doc(window.db, 'settings', 'transportTravelTimes');

            if (minutes == null) {
                await setDoc(docRef, {
                    times: { [key]: deleteField() },
                }, { merge: true });

                window.showGlobalNotification(
                    `Trvanie ${fromStop.name} → ${toStop.name} bolo odstránené.`,
                    'success'
                );
            } else {
                await setDoc(docRef, {
                    times: {
                        [key]: {
                            fromId: fromStop.id,
                            fromName: fromStop.name,
                            toId: toStop.id,
                            toName: toStop.name,
                            minutes,
                        },
                    },
                }, { merge: true });

                window.showGlobalNotification(
                    `Trvanie ${fromStop.name} → ${toStop.name} = ${minutes} min.`,
                    'success'
                );
            }
        } catch (err) {
            console.error('[TRANSPORT] Chyba pri ukladaní trvania jazdy:', err);
            window.showGlobalNotification('Nepodarilo sa uložiť trvanie.', 'error');
        } finally {
            setTravelTimesSaving(false);
        }
    };

    // ============================================================
    // NOVÉ: Uloženie / odstránenie skratky tímu (transport, type='teamShortcut')
    // ============================================================
    const saveTeamShortcut = async (category, teamName, newShortcutRaw) => {
        if (!window.db) return;
        const cat = cleanCategory(category);
        const name = String(teamName || '').trim();
        if (!cat || !name) return;

        // ============================================================
        // NOVÉ: Normalizácia skratky – všetko na VEĽKÉ písmená
        // (diakritika zostáva zachovaná, iba sa zmení veľkosť).
        // ============================================================
        const newShortcut = String(newShortcutRaw || '')
            .trim()
            .toLocaleUpperCase('sk-SK');

        setShortcutSaving(true);
        try {
            const transportRef = collection(window.db, 'transport');
            const snap = await getDocs(transportRef);

            // Nájdi existujúci záznam pre (category, teamName)
            // + NOVÉ: zisti, či v tej istej kategórii už neexistuje
            //   INÝ tím s rovnakou skratkou.
            let existingDocId = null;
            let conflictingTeamName = null;

            snap.forEach((docSnap) => {
                const data = docSnap.data() || {};
                if (data.type !== 'teamShortcut') return;
                if (cleanCategory(data.category) !== cat) return;

                const docTeamName = String(data.teamName || '').trim();
                const docShortcut = String(data.shortcut || '').trim().toLocaleUpperCase('sk-SK');

                // Záznam pre aktuálny tím (rovnaký tím) – zapamätaj si ID
                if (docTeamName === name) {
                    existingDocId = docSnap.id;
                    return;
                }

                // Iný tím v tej istej kategórii s rovnakou skratkou → konflikt
                if (
                    newShortcut &&
                    docShortcut &&
                    docShortcut === newShortcut
                ) {
                    conflictingTeamName = docTeamName;
                }
            });

            // ============================================================
            // NOVÉ: Ak existuje konflikt (iný tím s rovnakou skratkou),
            // zablokuj uloženie.
            // ============================================================
            if (newShortcut && conflictingTeamName) {
                window.showGlobalNotification(
                    `Skratka "${newShortcut}" je už použitá pre tím "${conflictingTeamName}" v kategórii "${cat}". Zvoľte inú skratku.`,
                    'error'
                );
                return;
            }

            if (!newShortcut) {
                // Prázdna skratka → zmaž záznam (ak existuje)
                if (existingDocId) {
                    await deleteDoc(doc(window.db, 'transport', existingDocId));
                    window.showGlobalNotification(`Skratka pre tím "${name}" bola odstránená.`, 'info');
                }
            } else {
                if (existingDocId) {
                    await updateDoc(doc(window.db, 'transport', existingDocId), {
                        shortcut: newShortcut,
                    });
                } else {
                    await addDoc(transportRef, {
                        type: 'teamShortcut',
                        category: cat,
                        teamName: name,
                        shortcut: newShortcut,
                        createdAt: Timestamp.fromDate(new Date()),
                        createdBy: (userProfileData && userProfileData.email) || null,
                    });
                }
                window.showGlobalNotification(`Skratka pre tím "${name}" bola uložená: "${newShortcut}".`, 'success');
            }
        } catch (err) {
            console.error('[TRANSPORT] Chyba pri ukladaní skratky tímu:', err);
            window.showGlobalNotification('Nepodarilo sa uložiť skratku tímu.', 'error');
        } finally {
            setShortcutSaving(false);
        }
    };    

    // ============================================================
    // NOVÉ: Zmazanie skratky tímu (transport, type='teamShortcut')
    // ============================================================
    const deleteTeamShortcut = async (category, teamName) => {
        if (!window.db) return;
        const cat = cleanCategory(category);
        const name = String(teamName || '').trim();
        if (!cat || !name) return;

        setDeleteShortcutSaving(true);
        try {
            const transportRef = collection(window.db, 'transport');
            const snap = await getDocs(transportRef);

            let existingDocId = null;
            snap.forEach((docSnap) => {
                const data = docSnap.data() || {};
                if (data.type !== 'teamShortcut') return;
                if (cleanCategory(data.category) !== cat) return;
                if (String(data.teamName || '').trim() !== name) return;
                existingDocId = docSnap.id;
            });

            if (!existingDocId) {
                window.showGlobalNotification(
                    `Skratka pre tím "${name}" sa nenašla.`,
                    'info'
                );
                setDeleteShortcutModal(null);
                return;
            }

            await deleteDoc(doc(window.db, 'transport', existingDocId));
            window.showGlobalNotification(
                `Skratka pre tím "${name}" bola odstránená.`,
                'success'
            );
            setDeleteShortcutModal(null);
        } catch (err) {
            console.error('[TRANSPORT] Chyba pri mazaní skratky tímu:', err);
            window.showGlobalNotification('Nepodarilo sa odstrániť skratku tímu.', 'error');
        } finally {
            setDeleteShortcutSaving(false);
        }
    };    

    // ============================================================
    // VLASTNÉ MODÁLNE POTVRDENIE (Promise-based)
    // ============================================================
    const askConfirm = (message) => {
        return new Promise((resolve) => {
            setConfirmModal({ message, resolve });
        });
    };

    const closeConfirmModal = (result) => {
        if (confirmModal && typeof confirmModal.resolve === 'function') {
            confirmModal.resolve(result);
        }
        setConfirmModal(null);
    };

    // ============================================================
    // NASTAVENIE NÁSTUPNEJ/VÝSTUPNEJ ZASTÁVKY
    // ============================================================
    const setExternalArrivalStop = async (placeId) => {
        if (!window.db) return;
        try {
            const batch = writeBatch(window.db);
    
            for (const p of allPlaces) {
                if (p.type !== 'zastavka') continue;
                const shouldBe = p.id === placeId;
                if (p.isExternalArrivalStop !== shouldBe) {
                    batch.update(doc(window.db, 'places', p.id), {
                        isExternalArrivalStop: shouldBe,
                    });
                }
            }
    
            await batch.commit();
            window.showGlobalNotification('Nástupná/výstupná zastávka bola zmenená.', 'success');
        } catch (err) {
            console.error('[TRANSPORT] Chyba pri nastavovaní nástupnej zastávky:', err);
            window.showGlobalNotification('Nepodarilo sa zmeniť nástupnú zastávku.', 'error');
        }
    };
    
    // ============================================================
    // NOVÉ: NASTAVENIE ZASTÁVKY AKO "MIESTO ZRAZU"
    // ============================================================
    const setMeetingPointStop = async (placeId) => {
        if (!window.db) return;
        try {
            const batch = writeBatch(window.db);
    
            for (const p of allPlaces) {
                if (p.type !== 'zastavka') continue;
                const shouldBe = p.id === placeId;
                if (p.isMeetingPointStop !== shouldBe) {
                    batch.update(doc(window.db, 'places', p.id), {
                        isMeetingPointStop: shouldBe,
                    });
                }
            }
    
            await batch.commit();
            window.showGlobalNotification('Miesto zrazu bolo zmenené.', 'success');
        } catch (err) {
            console.error('[TRANSPORT] Chyba pri nastavovaní miesta zrazu:', err);
            window.showGlobalNotification('Nepodarilo sa zmeniť miesto zrazu.', 'error');
        }
    };
    
    // ============================================================
    // RENDER – matica trvania jázd
    // ============================================================
    const renderTravelTimes = () => {
        if (stopsList.length === 0) {
            return React.createElement(
                'div',
                { className: 'text-gray-400 italic text-sm px-1' },
                'Žiadne zastávky.'
            );
        }

        if (stopsList.length === 1) {
            return React.createElement(
                'div',
                { className: 'text-gray-500 italic text-sm px-1' },
                'Pre výpočet trvania jázd sú potrebné aspoň 2 zastávky.'
            );
        }

        const getInputValue = (fromId, toId) => {
            const key = `${fromId}|${toId}`;
            return travelTimesDraft[key] != null ? travelTimesDraft[key] : '';
        };

        const handleDraftChange = (fromId, toId, value) => {
            const key = `${fromId}|${toId}`;
            setTravelTimesDraft((prev) => ({ ...prev, [key]: value }));
        };

        const handleBlur = (fromStop, toStop) => {
            const key = `${fromStop.id}|${toStop.id}`;
            const raw = travelTimesDraft[key] != null ? travelTimesDraft[key] : '';
            const existing = travelTimes[key];
            const existingMinutes = existing ? String(existing.minutes) : '';
    
            if (raw === existingMinutes) return;
    
            saveTravelTime(fromStop, toStop, raw);
        };

        // ============================================================
        // NOVÉ: Kliknutie na hlavičkovú bunku (riadok/stĺpec) zastávky
        // ============================================================
        const handleStopHeaderClick = (stop) => {
            // Otvor modálne okno pre výber typu zastávky
            setStopTypeModal({ stop });
        };

        // ============================================================
        // NOVÉ: Render štítku s názvom zastávky + prípadný badge
        // ============================================================
        const renderStopLabel = (stop) => {
            const isExternal = stop.isExternalArrivalStop === true;
            const isMeeting = stop.isMeetingPointStop === true;
        
            return React.createElement(
                'span',
                { className: 'inline-flex flex-col items-center gap-1' },
                React.createElement(
                    'span',
                    { className: 'inline-flex items-center' },
                    React.createElement('i', { className: 'fa-solid fa-bus text-blue-600 mr-1' }),
                    stop.name
                ),
                isExternal &&
                    React.createElement(
                        'span',
                        {
                            className:
                                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-300',
                            title: 'Nástupná/výstupná zastávka pre externé tímy'
                        },
                        React.createElement('i', { className: 'fa-solid fa-right-to-bracket' }),
                        'NÁSTUPNÁ/VÝSTUPNÁ'
                    ),
                isMeeting &&
                    React.createElement(
                        'span',
                        {
                            className:
                                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300',
                            title: 'Miesto zrazu'
                        },
                        React.createElement('i', { className: 'fa-solid fa-people-group' }),
                        'MIESTO ZRAZU'
                    )
            );
        };

        // ============================================================
        // NOVÉ: Pomocná – zisti, či pre danú dvojicu (fromStop, toStop)
        // existuje chýbajúce trvanie podľa `missingTravelTimeWarning`.
        //
        // Porovnávame podľa názvov zastávok (from/to), pretože
        // `missingTravelTimeWarning` obsahuje názvy, nie ID.
        // (V `useEffect` pre detekciu sa používajú názvy `placeFrom`/`placeTo`.)
        // ============================================================
        const isMissingTravelTime = (fromStop, toStop) => {
            const fromName = normalizePlaceName(fromStop?.name || '');
            const toName = normalizePlaceName(toStop?.name || '');
            if (!fromName || !toName) return false;
            return missingTravelTimeWarning.some((m) => {
                const mFrom = normalizePlaceName(m.from || '');
                const mTo = normalizePlaceName(m.to || '');
                return mFrom === fromName && mTo === toName;
            });
        };
    
        return React.createElement(
            'div',
            { className: 'w-full overflow-x-auto' },
            React.createElement(
                'p',
                { className: 'text-xs text-gray-500 mb-3 italic' },
                'Hodnota predstavuje počet minút jazdy z riadkovej zastávky (z) do stĺpcovej zastávky (do). Prázdne pole = nezadané. Kliknutím na názov zastávky v hlavičke ju označíte ako nástupnú/výstupnú.'
            ),
            React.createElement(
                'table',
                { className: 'min-w-max border-collapse text-sm' },
                React.createElement(
                    'thead',
                    null,
                    React.createElement(
                        'tr',
                        null,
                        React.createElement(
                            'th',
                            {
                                className: 'border border-gray-300 bg-gray-100 p-0 whitespace-nowrap sticky left-0 z-[1]',
                                style: { width: '90px', minWidth: '90px', height: '48px', position: 'relative' }
                            },
                            React.createElement(
                                'div',
                                {
                                    style: {
                                        position: 'relative',
                                        width: '100%',
                                        height: '100%',
                                        background: `linear-gradient(to bottom left, transparent calc(50% - 1px), #9ca3af calc(50% - 1px), #9ca3af calc(50% + 1px), transparent calc(50% + 1px))`,
                                    }
                                },
                                React.createElement(
                                    'span',
                                    {
                                        style: {
                                            position: 'absolute',
                                            bottom: '4px',
                                            left: '6px',
                                            fontWeight: 'bold',
                                            color: '#374151',
                                            fontSize: '12px',
                                        }    
                                    },
                                    'Odkiaľ'
                                ),
                                React.createElement(
                                    'span',
                                    {
                                        style: {
                                            position: 'absolute',
                                            top: '4px',
                                            right: '6px',
                                            fontWeight: 'bold',
                                            color: '#374151',
                                            fontSize: '12px',
                                        }
                                    },
                                    'Kam'
                                )
                            )
                        ),
                        stopsList.map((toStop) =>
                            React.createElement(
                                'th',
                                {
                                    key: `th-${toStop.id}`,
                                    onClick: () => handleStopHeaderClick(toStop),
                                    className: `border border-gray-300 bg-gray-100 px-3 py-2 text-center font-bold text-gray-700 whitespace-nowrap min-w-[110px] ${
                                        toStop.isExternalArrivalStop
                                            ? ''
                                            : 'cursor-pointer hover:bg-gray-200'
                                    }`,
                                    title: toStop.isExternalArrivalStop
                                        ? 'Táto zastávka je nástupná/výstupná'
                                        : 'Kliknutím nastaviť ako nástupnú/výstupnú zastávku'
                                },
                                renderStopLabel(toStop)
                            )
                        )
                    )
                ),
                React.createElement(
                    'tbody',
                    null,
                    stopsList.map((fromStop, rowIdx) =>
                        React.createElement(
                            'tr',
                            {
                                key: `tr-${fromStop.id}`,
                                className: rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                            },
                            React.createElement(
                                'th',
                                {
                                    onClick: () => handleStopHeaderClick(fromStop),
                                    className: `border border-gray-300 bg-gray-100 px-3 py-2 text-left font-bold text-gray-700 whitespace-nowrap sticky left-0 z-[1] ${
                                        fromStop.isExternalArrivalStop
                                            ? ''
                                            : 'cursor-pointer hover:bg-gray-200'
                                    }`,
                                    title: fromStop.isExternalArrivalStop
                                        ? 'Táto zastávka je nástupná/výstupná'
                                        : 'Kliknutím nastaviť ako nástupnú/výstupnú zastávku'
                                },
                                renderStopLabel(fromStop)
                            ),
                            stopsList.map((toStop) => {
                                const isDiagonal = fromStop.id === toStop.id;
                                if (isDiagonal) {
                                    return React.createElement(
                                        'td',
                                        {
                                            key: `td-${fromStop.id}-${toStop.id}`,
                                            className: 'border border-gray-300 px-2 py-1 text-center text-gray-400 bg-gray-100'
                                        },
                                        ''
                                    );
                                }
                                const value = getInputValue(fromStop.id, toStop.id);
                                const key = `${fromStop.id}|${toStop.id}`;
                                const existing = travelTimes[key];
                                const changed = (value || '') !== (existing ? String(existing.minutes) : '');

                                // NOVÉ: ak pre túto dvojicu chýba trvanie (a je použitá v autobusoch),
                                // podfarbi bunku (aj input) červeno.
                                const missing = isMissingTravelTime(fromStop, toStop);

                                return React.createElement(
                                    'td',
                                    {
                                        key: `td-${fromStop.id}-${toStop.id}`,
                                        className: 'border border-gray-300 px-1 py-1 text-center',
                                        style: missing ? { backgroundColor: '#FECACA' } : undefined, // red-200
                                    },
                                    React.createElement('input', {
                                        type: 'number',
                                        min: '0',
                                        step: '1',
                                        value: value,
                                        onChange: (e) => handleDraftChange(fromStop.id, toStop.id, e.target.value),
                                        onBlur: () => handleBlur(fromStop, toStop),
                                        onKeyDown: (e) => { if (e.key === 'Enter') e.target.blur(); },
                                        placeholder: '—',
                                        title: missing ? 'Chýba trvanie jazdy – je potrebné pre výpočet trasy autobusu.' : '',
                                        className: `w-24 px-2 py-1 border rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 text-black ${
                                            missing
                                                ? 'border-red-500 bg-red-100'
                                                : changed
                                                    ? 'border-amber-400 bg-amber-50'
                                                    : 'border-gray-300 bg-white'
                                        }`
                                    })
                                );
                            })
                        )
                    )
                )
            ),
            travelTimesSaving && React.createElement(
                'div',
                { className: 'text-xs text-blue-600 mt-2 italic' },
                'Ukladám...'
            )
        );
    };

    // ============================================================
    // NOVÉ: RENDER – tabuľka skratiek názvov tímov
    // ============================================================
    const renderTeamShortcuts = () => {
        // Zoznam kategórií z tímov (users + matches + catering)
        const categories = (() => {
            const set = new Set();
            (teamsArrivalBufferRef.current || []).forEach((t) => {
                if (t.category && t.isRegistered === true) set.add(cleanCategory(t.category));
            });
            return [...set].sort((a, b) => a.localeCompare(b, 'sk', { sensitivity: 'base' }));
        })();

        if (categories.length === 0) {
            return React.createElement(
                'div',
                { className: 'text-gray-400 italic text-sm px-1' },
                'Žiadne registrované tímy v users.'
            );
        }

        return React.createElement(
            'div',
            { className: 'space-y-6', style: { maxWidth: '760px' } },
            React.createElement(
                'p',
                { className: 'text-xs text-gray-500 italic' },
                'Pre každý tím môžete nastaviť skratku, ktorá sa zobrazí v stĺpcoch Nástup / Výstup v Plánovaní. Ak skratka nie je nastavená, zobrazí sa plný názov tímu.'
            ),
            categories.map((category) => {
                // Všetky tímy v danej kategórii z users (registrované)
                const teams = (teamsArrivalBufferRef.current || [])
                    .filter((t) => cleanCategory(t.category) === category && t.isRegistered === true)
                    .map((t) => String(t.teamName || '').trim())
                    .filter(Boolean)
                    .filter((v, i, a) => a.indexOf(v) === i)
                    .sort((a, b) => a.localeCompare(b, 'sk', { sensitivity: 'base' }));

                if (teams.length === 0) return null;

                return React.createElement(
                    'div',
                    { key: category, className: 'border border-gray-200 rounded-lg overflow-hidden' },
                    React.createElement(
                        'div',
                        {
                            className: 'px-4 py-2 font-semibold text-gray-800 text-sm flex items-center gap-2',
                            style: {
                                backgroundColor: lightenHex(getTransportColorForCategory(category), 0.15) || '#f3f4f6',
                                borderLeft: `6px solid ${getTransportColorForCategory(category) || '#9ca3af'}`,
                            }
                        },
                        React.createElement('i', { className: 'fa-solid fa-layer-group' }),
                        `Kategória: ${category}`,
                        React.createElement(
                            'span',
                            { className: 'ml-auto text-xs text-gray-500 font-normal' },
                            `${teams.length} tímov`
                        )
                    ),
                    React.createElement(
                        'table',
                        { className: 'w-full border-collapse text-sm' },
                        React.createElement(
                            'thead',
                            null,
                            React.createElement(
                                'tr',
                                { className: 'bg-gray-100 text-xs font-semibold text-gray-700' },
                                React.createElement('th', { className: 'border border-gray-300 px-3 py-2 text-left', style: { width: '200px', maxWidth: '200px' } }, 'Tím'),
                                React.createElement('th', { className: 'border border-gray-300 px-3 py-2 text-left', style: { width: '200px' } }, 'Skratka'),
                                React.createElement('th', { className: 'border border-gray-300 px-3 py-2 text-center', style: { width: '80px' } }, '')
                            )
                        ),
                        React.createElement(
                            'tbody',
                            null,
                            teams.map((teamName) => {
                                const shortcut = getTeamShortcut(category, teamName);
                                return React.createElement(
                                    'tr',
                                    { key: teamName, className: 'hover:bg-gray-50' },
                                    React.createElement(
                                        'td',
                                        {
                                            className: 'border border-gray-300 px-3 py-1 text-gray-800',
                                            style: { width: '200px', maxWidth: '200px' },
                                            title: teamName,
                                        },
                                        React.createElement(
                                            'div',
                                            {
                                                style: {
                                                    maxWidth: '200px',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }
                                            },
                                            teamName
                                        )
                                    ),
                                    React.createElement(
                                        'td',
                                        { className: 'border border-gray-300 px-3 py-1' },
                                        shortcut
                                            ? React.createElement(
                                                'span',
                                                {
                                                    className: 'font-semibold',
                                                    style: { color: getCategoryTextColor(category) },
                                                },
                                                shortcut
                                            )
                                            : React.createElement('span', { className: 'text-gray-400 italic' }, '—')
                                    ),
                                    React.createElement(
                                        'td',
                                        { className: 'border border-gray-300 px-3 py-1 text-center' },
                                        React.createElement(
                                            'div',
                                            { className: 'flex items-center justify-center gap-2' },
                                            // Ikona ceruzky – otvorí modálne okno na pridanie/úpravu skratky
                                            React.createElement(
                                                'button',
                                                {
                                                    type: 'button',
                                                    onClick: () => {
                                                        setShortcutConflict(null);
                                                        setShortcutEditModal({
                                                            category,
                                                            teamName,
                                                            shortcut: shortcut || '',
                                                        });
                                                    },
                                                    title: shortcut ? 'Upraviť skratku' : 'Pridať skratku',
                                                    className: 'text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded w-7 h-7 flex items-center justify-center transition-colors',
                                                },
                                                React.createElement('i', { className: 'fa-solid fa-pen' })
                                            ),
                                            // Ikona koša – otvorí modálne okno na potvrdenie zmazania skratky
                                            // Zobrazí sa LEN ak skratka existuje
                                            shortcut &&
                                                React.createElement(
                                                    'button',
                                                    {
                                                        type: 'button',
                                                        onClick: () => {
                                                            setDeleteShortcutModal({
                                                                category,
                                                                teamName,
                                                                shortcut,
                                                            });
                                                        },
                                                        title: 'Odstrániť skratku',
                                                        className: 'text-red-600 hover:text-red-800 hover:bg-red-50 rounded w-7 h-7 flex items-center justify-center transition-colors',
                                                    },
                                                    React.createElement('i', { className: 'fa-solid fa-trash' })
                                                )
                                        )
                                    )
                                );
                            })
                        )
                    )
                );
            })
        );
    };    

    // ============================================================
    // Zoznam dostupných kategórií (z tímov + zápasov + stravovania)
    // ============================================================
    const getAvailableCategories = () => {
        const set = new Set();

        (teamsArrivalBufferRef.current || []).forEach((t) => {
            if (t.category) set.add(cleanCategory(t.category));
        });
        (matchesBufferRef.current || []).forEach((m) => {
            if (m.category) set.add(cleanCategory(m.category));
        });
        (cateringBufferRef.current || []).forEach((c) => {
            if (c.category) set.add(cleanCategory(c.category));
        });

        return [...set]
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b, 'sk', { sensitivity: 'base' }));
    };

    // ============================================================
    // NOVÉ: Pomocná – získa farbu dopravy pre kategóriu
    // (skúsi presný názov, potom cleanCategory, potom fallback)
    // ============================================================
    const getTransportColorForCategory = (categoryName) => {
        const map = transportColorsRef.current || {};
        const raw = String(categoryName || '').trim();
        if (!raw) return null;
        if (map[raw]) return map[raw];
        const cleaned = cleanCategory(raw);
        if (map[cleaned]) return map[cleaned];
        // Skús aj case-insensitive
        const lower = raw.toLowerCase();
        for (const [k, v] of Object.entries(map)) {
            if (k.startsWith('__draw__|')) continue;
            if (k.toLowerCase() === lower) return v;
        }
        return null;
    };

    // ============================================================
    // Pomocná: získa počty členov pre daný tím z `users`
    // ============================================================
    const getTeamCountsForTransfer = (category, teamName) => {
        const cat = cleanCategory(category);
        const name = String(teamName || '').trim();
        if (!cat || !name) return null;
        return teamCounts[`${cat}|${name}`] || null;
    };

    // ============================================================
    // Pomocná: celočíselný priemer členov tímu v kategórii
    // (rovnaký štýl ako "Spolu", len pre tímy, ktoré nie sú v users)
    // ============================================================
    const getCategoryAverageForTransfer = (category) => {
        const cat = cleanCategory(category);
        if (!cat) return null;

        // Prejdi všetky tímy v teamCounts pre danú kategóriu
        let total = 0;
        let count = 0;
        Object.entries(teamCounts || {}).forEach(([key, counts]) => {
            const [kCat] = key.split('|');
            if (cleanCategory(kCat) !== cat) return;
            if (!counts) return;
            const sum =
                (counts.players || 0) +
                (counts.menRT || 0) +
                (counts.womenRT || 0) +
                (counts.menDrivers || 0) +
                (counts.womenDrivers || 0);
            total += sum;
            count += 1;
        });
    
        if (count === 0) return null;
        return Math.ceil(total / count);
    };

    // ============================================================
    // NOVÉ: Pomocná – získa farbu pre rozlosovanie (drawColor)
    // ============================================================
    const getDrawColorForCategory = (categoryName) => {
        const map = transportColorsRef.current || {};
        const raw = String(categoryName || '').trim();
        if (!raw) return null;
        if (map[`__draw__|${raw}`]) return map[`__draw__|${raw}`];
        const cleaned = cleanCategory(raw);
        if (map[`__draw__|${cleaned}`]) return map[`__draw__|${cleaned}`];
        return null;
    };

    // ============================================================
    // Pomocná: z hex farby (#rrggbb) vytvorí bledý variant zmiešaný s bielou
    // (ratio = 0 → biela, ratio = 1 → pôvodná farba)
    // ============================================================
    const lightenHex = (hex, ratio = 0.15) => {
        if (!hex) return null;
        let h = String(hex).trim().replace(/^#/, '');
        if (h.length === 3) {
            h = h.split('').map((c) => c + c).join('');
        }
        if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
        const r = parseInt(h.slice(0, 2), 16);
        const g = parseInt(h.slice(2, 4), 16);
        const b = parseInt(h.slice(4, 6), 16);
        const mix = (c) => Math.round(c * ratio + 255 * (1 - ratio));
        const toHex = (c) => c.toString(16).padStart(2, '0');
        return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
    };
    
    // ============================================================
    // Pomocná: farba textu pre tím podľa kategórie
    // ============================================================
    const getCategoryTextColor = (categoryName) => {
        const hex = getTransportColorForCategory(categoryName);
        return hex || '#374151'; // fallback tmavosivá
    };

    // ============================================================
    // NOVÉ: Získa skratku pre tím v kategórii (alebo null)
    // ============================================================
    const getTeamShortcut = (category, teamName) => {
        const cat = cleanCategory(category);
        const name = String(teamName || '').trim();
        if (!cat || !name) return null;
        const raw = teamShortcuts[`${cat}|${name}`];
        if (!raw) return null;
        return String(raw).trim().toLocaleUpperCase('sk-SK');
    };

    // ============================================================
    // NOVÉ: Vráti text pre tím v autobuse – skratka alebo plný názov
    // ============================================================
    const getTeamDisplayLabel = (teamKey) => {
        const parts = String(teamKey).split('|');
        const teamName = (parts[0] || '').trim();
        const category = (parts[1] || '').trim();
        const shortcut = getTeamShortcut(category, teamName);
        return shortcut || teamName;
    };    

    // ============================================================
    // RENDER – plánovanie
    // ============================================================
    const renderPlanning = () => {
        // Filtrovanie dní podľa vybraného dňa v selectboxe
        const daysToRender = selectedDayKey
            ? tournamentDays.filter((d) => d.dayKey === selectedDayKey)
            : tournamentDays;
        
        const filteredBuses = selectedBusId
            ? buses.filter((b) => b.id === selectedBusId)
            : buses;
    
        const hasAnythingToRender =
            filteredBuses.length > 0 ||
            savedTransfers.some((t) => t.isWalking === true && (!selectedDayKey || t.dayKey === selectedDayKey));
    
        return React.createElement(
            'div',
            { className: 'w-full flex flex-col items-start justify-start py-6 relative min-h-[400px]' },
    
            !hasAnythingToRender
                ? React.createElement(
                    'div',
                    { className: 'w-full flex flex-col items-center justify-center py-16 text-gray-500' },
                    React.createElement('i', { className: 'fa-solid fa-bus text-6xl mb-4 opacity-30' }),
                    React.createElement('p', { className: 'text-lg font-medium' }, 'Plánovanie'),
                    React.createElement(
                        'p',
                        { className: 'text-sm mt-1' },
                        'Kliknutím na tlačidlo "+" pridáte prvý autobus.'
                    ),
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: addNewBus,
                            disabled: busSaving,
                            className: `mt-6 w-14 h-14 rounded-full bg-green-600 text-white shadow-xl hover:bg-green-700 active:scale-95 transition-all duration-200 flex items-center justify-center text-2xl font-bold ${busSaving ? 'opacity-60 cursor-not-allowed' : ''}`,
                            title: 'Pridať autobus'
                        },
                        React.createElement('i', {
                            className: busSaving ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-plus'
                        })
                    )
                )
                : React.createElement(
                    'div',
                    { className: 'w-full flex flex-row flex-nowrap gap-6 pb-24 overflow-visible items-start' },
                
                    // === ĽAVÝ STĹPEC – uložené vygenerované presuny ===
                    renderSavedTransfers(),
    
                    // === BOXY AUTOBUSOV ===
                    filteredBuses.map((bus) =>
                        React.createElement(
                            'div',
                            {
                                key: bus.id,
                                className: 'bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden flex-shrink-0',
                                style: { minWidth: '1000px', width: 'max-content' }
                            },
                            // Hlavička autobusu
                            React.createElement(
                                'div',
                                {
                                    className: 'relative px-5 py-3 flex items-center justify-center text-gray-900',
                                    style: { backgroundColor: '#39D4F3' }
                                },
                                React.createElement('i', { className: 'fa-solid fa-bus mr-2' }),
                                React.createElement('h3', { className: 'text-lg font-bold text-center' }, bus.name),
                                (() => {
                                    // Zisti, či autobus má aspoň jeden riadok s časmi a miestami (v ľubovoľnom dni)
                                    let hasAnyRowWithData = false;
                                    Object.entries(busRows || {}).forEach(([key, rows]) => {
                                        if (hasAnyRowWithData) return;
                                        const [bId] = key.split('|');
                                        if (bId !== bus.id) return;
                                        if ((rows || []).length > 0) {
                                            hasAnyRowWithData = true;
                                        }
                                    });
                            
                                    const isDisabled = hasAnyRowWithData;
                            
                                    return React.createElement(
                                        'button',
                                        {
                                            type: 'button',
                                            onClick: isDisabled ? undefined : () => removeBus(bus),
                                            disabled: isDisabled,
                                            className: isDisabled
                                                ? 'absolute right-3 rounded-full w-8 h-8 flex items-center justify-center transition-colors cursor-not-allowed border-2 border-red-600 bg-white'
                                                : 'absolute right-3 rounded-full w-8 h-8 flex items-center justify-center transition-colors bg-red-600 text-white hover:bg-red-700',
                                            title: isDisabled
                                                ? 'Najprv odstráňte všetky riadky s časmi a miestami v tomto autobuse'
                                                : 'Odstrániť autobus',
                                            style: isDisabled ? { color: '#dc2626' } : undefined,
                                        },
                                        React.createElement('i', { className: 'fa-solid fa-trash' })
                                    );
                                })()
                            ),
                            tournamentDays.length === 0
                                ? React.createElement(
                                    'p',
                                    { className: 'text-center text-gray-500 py-6 text-sm italic' },
                                    tournamentDaysLoaded
                                        ? 'Žiadne dátumy turnaja (skontrolujte nastavenie registrácie).'
                                        : 'Načítavam dátumy turnaja...'
                                )
                                : daysToRender.length === 0
                                    ? React.createElement(
                                        'p',
                                        { className: 'text-center text-gray-500 py-6 text-sm italic' },
                                        'Pre zvolený deň nie sú žiadne dátumy.'
                                    )
                                    : React.createElement(
                                        'table',
                                        { className: 'w-full border-collapse text-sm' },
                                        React.createElement(
                                            'tbody',
                                            null,
                                            daysToRender.map((day, idx) =>
                                                React.createElement(
                                                    React.Fragment,
                                                    { key: day.dayKey },
                                                    // 1) Riadok s dátumom
                                                    React.createElement(
                                                        'tr',
                                                        { className: idx % 2 === 0 ? 'bg-white' : 'bg-gray-50' },
                                                        React.createElement(
                                                            'td',
                                                            { className: 'border border-gray-200 px-4 py-2 text-gray-800 text-center text-sm' },
                                                            React.createElement('span', { className: 'font-semibold capitalize' }, day.dayName),
                                                            React.createElement('span', { className: 'text-gray-500 mx-2' }, '–'),
                                                            React.createElement('span', null, day.dateLabel)
                                                        )
                                                    ),
                                            
                                                    // 2) Tabuľka s riadkami (ak existujú)
                                                    (() => {
                                                        const key = `${bus.id}|${day.dayKey}`;
                                                        const rows = (busRows[key] || []);
                                                        if (rows.length === 0) return null;

                                                        // Zoraď podľa order
                                                        const sortedRows = [...rows].sort(
                                                            (a, b) => (a.order || 0) - (b.order || 0)
                                                        );

                                                        // Postupne renderuj riadky + prípadné volné riadky
                                                        const rowElements = [];
                                                        sortedRows.forEach((r, idx) => {
                                                            // Najprv pridaj "voľný riadok", ak je medzera > 2 min
                                                            if (idx > 0) {
                                                                const prev = sortedRows[idx - 1];
                                                                const rawGap = getGapMinutes(prev.timeTo, r.timeFrom);
                                                                if (rawGap != null && rawGap > 2) {
                                                                    const prevRow = prev;
                                                                    const nextRow = r;
                                                                    const gapRowKey = `gap-${prevRow.id}-${nextRow.id}`;
                                                                
                                                                    // ============================================================
                                                                    // NOVÉ: Zisti, či ide o "obrátený" prípad (čas od > čas do).
                                                                    // Ak áno, použijeme ABSOLÚTNU HODNOTU rozdielu (bez prechodu
                                                                    // cez polnoc), aby sme nepočítali nezmyselne veľkú medzeru.
                                                                    // ============================================================
                                                                    const timeReLocal = /^\d{1,2}:\d{2}$/;
                                                                    let isInverted = false;
                                                                    let gap = rawGap;
                                                                
                                                                    if (timeReLocal.test(prevRow.timeTo || '') && timeReLocal.test(nextRow.timeFrom || '')) {
                                                                        const [fh, fm] = prevRow.timeTo.split(':').map(Number);
                                                                        const [th, tm] = nextRow.timeFrom.split(':').map(Number);
                                                                        const fromMin = fh * 60 + fm;
                                                                        const toMin = th * 60 + tm;
                                                                        if (fromMin > toMin) {
                                                                            isInverted = true;
                                                                            gap = fromMin - toMin; // ABSOLÚTNA HODNOTA (väčší - menší)
                                                                        }
                                                                    }
                                                                                                                        
                                                                    // ============================================================
                                                                    // NOVÉ: Detekcia "obráteného" červeného riadku:
                                                                    //  - miesto od (prevRow.placeTo) == miesto do (nextRow.placeFrom)
                                                                    //  - čas od (prevRow.timeTo) > čas do (nextRow.timeFrom)
                                                                    //    (t.j. prevRow.timeTo > nextRow.timeFrom)
                                                                    // ============================================================
                                                                    const timeRe = /^\d{1,2}:\d{2}$/;
                                                                    const sameFromTo =
                                                                        normalizePlaceName(prevRow.placeTo) !== '' &&
                                                                        normalizePlaceName(prevRow.placeTo) === normalizePlaceName(nextRow.placeFrom);
                                                        
                                                                    let isInvertedGap = false;
                                                                    if (
                                                                        sameFromTo &&
                                                                        prevRow.timeTo && nextRow.timeFrom &&
                                                                        timeRe.test(prevRow.timeTo) && timeRe.test(nextRow.timeFrom)
                                                                    ) {
                                                                        const [fh, fm] = prevRow.timeTo.split(':').map(Number);
                                                                        const [th, tm] = nextRow.timeFrom.split(':').map(Number);
                                                                        if (fh * 60 + fm > th * 60 + tm) {
                                                                            isInvertedGap = true;
                                                                        }
                                                                    }
                                                        
                                                                    rowElements.push(
                                                                        React.createElement(
                                                                            'tr',
                                                                            {
                                                                                key: gapRowKey,
                                                                                className: 'group gap-row',
                                                                                style: { backgroundColor: '#FC9A9C' }
                                                                            },
                                                                            // 1. čas od
                                                                            React.createElement(
                                                                                'td',
                                                                                { className: 'border border-gray-300 px-2 py-1 text-center text-sm font-semibold text-gray-800' },
                                                                                prevRow.timeTo || '—'
                                                                            ),
                                                                            // 2. čas do
                                                                            React.createElement(
                                                                                'td',
                                                                                { className: 'border border-gray-300 px-2 py-1 text-center text-sm font-semibold text-gray-800' },
                                                                                nextRow.timeFrom || '—'
                                                                            ),
                                                                            // 3. + 4. miesto od / miesto do
                                                                            //    Ak sú miesta rovnaké → zlúčiť do jednej bunky (colspan=2) so stredovým zarovnaním
                                                                            (() => {
                                                                                const placeFromNorm = normalizePlaceName(prevRow.placeTo || '');
                                                                                const placeToNorm = normalizePlaceName(nextRow.placeFrom || '');
                                                                                const samePlace = placeFromNorm !== '' && placeFromNorm === placeToNorm;
                                                                            
                                                                                if (samePlace) {
                                                                                    return React.createElement(
                                                                                        'td',
                                                                                        {
                                                                                            colSpan: 2,
                                                                                            className: 'border border-gray-300 px-2 py-1 text-sm text-gray-800 font-semibold text-center',
                                                                                            title: 'Miesto od a miesto do sú rovnaké',
                                                                                        },
                                                                                        prevRow.placeTo || nextRow.placeFrom || '—'
                                                                                    );
                                                                                }
                                                                            
                                                                                return [
                                                                                    React.createElement(
                                                                                        'td',
                                                                                        { key: 'gap-from', className: 'border border-gray-300 px-2 py-1 text-sm text-gray-800 font-medium' },
                                                                                        prevRow.placeTo || '—'
                                                                                    ),
                                                                                    React.createElement(
                                                                                        'td',
                                                                                        { key: 'gap-to', className: 'border border-gray-300 px-2 py-1 text-sm text-gray-800 font-medium' },
                                                                                        nextRow.placeFrom || '—'
                                                                                    ),
                                                                                ];
                                                                            })(),
                                                                            // 5. Nástup – prázdne
                                                                            React.createElement('td', { className: 'border border-gray-300 px-2 py-1' }, ''),
                                                                            // 6. Výstup – prázdne
                                                                            React.createElement('td', { className: 'border border-gray-300 px-2 py-1' }, ''),
                                                                            // 7. Počet – prázdne
                                                                            React.createElement('td', { className: 'border border-gray-300 px-2 py-1' }, ''),
                                                                            // 8. Min – medzera
                                                                            React.createElement(
                                                                                'td',
                                                                                {
                                                                                    className: 'border border-gray-300 px-2 py-1 text-center text-sm font-semibold',
                                                                                    style: { color: '#7f1d1d' },
                                                                                    title: 'Voľný čas (prestoj)'
                                                                                },
                                                                                (() => {
                                                                                    const fromOk = prevRow.timeTo && timeRe.test(prevRow.timeTo);
                                                                                    const toOk = nextRow.timeFrom && timeRe.test(nextRow.timeFrom);
                                                                                    if (!fromOk || !toOk) return '—';
                                                        
                                                                                    const [fh, fm] = prevRow.timeTo.split(':').map(Number);
                                                                                    const [th, tm] = nextRow.timeFrom.split(':').map(Number);
                                                                                    const fromMin = fh * 60 + fm;
                                                                                    const toMin = th * 60 + tm;
                                                        
                                                                                    if (fromMin > toMin) return 'chyba';
                                                                                    return gap;
                                                                                })()
                                                                            ),
                                                                            // 9. Mazanie / "+" + NOVÉ tlačidlo "Posunúť" pri obrátenom riadku
                                                                            React.createElement(
                                                                                'td',
                                                                                { className: 'border border-gray-300 px-2 py-1 text-center relative' },
                                                                                // NOVÉ: ak ide o obrátený riadok (rovnaké miesto, čas od > čas do),
                                                                                // zobraz tlačidlo na posun nasledujúcich riadkov.
                                                                                isInvertedGap &&
                                                                                    React.createElement(
                                                                                        'button',
                                                                                        {
                                                                                            type: 'button',
                                                                                            onClick: async () => {
                                                                                                const ok = await askConfirm(
                                                                                                    `Posunúť všetky nasledujúce riadky (až po prvý ďalší červený riadok) o ${gap + 2} minút?`
                                                                                                );
                                                                                                if (!ok) return;
                                                                                                await shiftFollowingRowsAfterInvertedGap(
                                                                                                    bus.id,
                                                                                                    day.dayKey,
                                                                                                    prevRow.id,
                                                                                                    nextRow.id
                                                                                                );
                                                                                            },
                                                                                            className:
                                                                                                'w-7 h-7 rounded-full bg-red-700 text-white shadow hover:bg-red-800 active:scale-95 transition-all duration-150 flex items-center justify-center mx-auto mr-1',
                                                                                            title: `Posunúť nasledujúce riadky o ${gap + 2} min (medzera ${gap} + 2)`
                                                                                        },
                                                                                        React.createElement('i', { className: 'fa-solid fa-arrows-down-to-line text-[10px]' })
                                                                                    ),
                                                                                // Pôvodné hover "+" tlačidlo
                                                                                React.createElement(
                                                                                    'button',
                                                                                    {
                                                                                        type: 'button',
                                                                                        onClick: () => insertBusRowBetween(bus, day.dayKey, prevRow, nextRow),
                                                                                        className:
                                                                                            'w-7 h-7 rounded-full bg-green-600 text-white shadow hover:bg-green-700 active:scale-95 transition-all duration-150 flex items-center justify-center mx-auto ' +
                                                                                            'opacity-0 group-hover:opacity-100 focus:opacity-100',
                                                                                    },
                                                                                    React.createElement('i', { className: 'fa-solid fa-plus text-xs' })
                                                                                )
                                                                            )
                                                                        )
                                                                    );
                                                                }
                                                            }
                                                        
                                                            // Pridaj samotný riadok
                                                            rowElements.push(renderBusRow(r, bus.id, day.dayKey));
                                                        });

                                                        return React.createElement(
                                                            'tr',
                                                            null,
                                                            React.createElement(
                                                                'td',
                                                                { colSpan: 1, className: 'border border-gray-200 p-0' },
                                                                React.createElement(
                                                                    'table',
                                                                    { className: 'w-full border-collapse text-xs', style: { tableLayout: 'auto', minWidth: '100%' } },
                                                                    renderBusRowsHeader(),
                                                                    React.createElement('tbody', null, rowElements)
                                                                )
                                                            )
                                                        );
                                                    })(),
                                            
                                                    // 3) Riadok s tlačidlom "+" – AŽ POD posledným riadkom udalosti
                                                    //    Zobrazí sa LEN ak pre daný bus + deň neexistuje žiadny riadok.
                                                    //    Ak už riadky existujú, nové sa pridávajú cez hover "+" na hraniciach riadkov.
                                                    (() => {
                                                        const rowsKey = `${bus.id}|${day.dayKey}`;
                                                        const existingRows = busRows[rowsKey] || [];
                                                        if (existingRows.length > 0) return null;
                                                    
                                                        return React.createElement(
                                                            'tr',
                                                            { className: idx % 2 === 0 ? 'bg-white' : 'bg-gray-50' },
                                                            React.createElement(
                                                                'td',
                                                                { className: 'border border-gray-200 px-4 py-2 text-center' },
                                                                React.createElement(
                                                                    'button',
                                                                    {
                                                                        type: 'button',
                                                                        onClick: () => addBusRow(bus, day.dayKey),
                                                                        className: 'w-9 h-9 rounded-full bg-green-600 text-white shadow hover:bg-green-700 active:scale-95 transition-all duration-150 flex items-center justify-center text-lg font-bold mx-auto',
                                                                        title: `Pridať prvý riadok pre deň ${day.dateLabel}`
                                                                    },
                                                                    React.createElement('i', { className: 'fa-solid fa-plus' })
                                                                )
                                                            )
                                                        );
                                                    })()
                                                )
                                            )
                                        )
                                    )
                        )
                    ),
    
                    // === NOVÉ: PEŠIE PRESUNY – ZA BOXOM POSLEDNÉHO AUTOBUSU ===
                    renderWalkingTransfersBox(),
                
                    // Zelené tlačidlo "+" napravo od posledného boxu
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: addNewBus,
                            disabled: busSaving,
                            className: `flex-shrink-0 mt-4 w-14 h-14 rounded-full bg-green-600 text-white shadow-md hover:bg-green-700 active:scale-95 transition-all duration-200 flex items-center justify-center text-2xl font-bold ${busSaving ? 'opacity-60 cursor-not-allowed' : ''}`,
                            title: 'Pridať ďalší autobus'
                        },
                        React.createElement('i', {
                            className: busSaving ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-plus'
                        })
                    )
                )
        );
    };

    // ============================================================
    // RENDER – ľavý stĺpec s uloženými vygenerovanými presunmi
    // ============================================================
    const renderSavedTransfers = () => {
        // ============================================================
        // NOVÉ: Kým nie je načítaný travelTimes, zobraz "Načítavam..."
        // (inak by box mohol byť prázdny, kým sa načítajú dáta z DB)
        // ============================================================
        if (!travelTimesLoaded) {
            return React.createElement(
                'div',
                {
                    className: 'bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden flex-shrink-0',
                    style: { width: '420px', maxWidth: '100%' }
                },
                React.createElement(
                    'div',
                    {
                        className: 'relative px-5 py-3 flex items-center justify-center text-white',
                        style: { backgroundColor: '#7c3aed' }
                    },
                    React.createElement('i', { className: 'fa-solid fa-van-shuttle mr-2' }),
                    React.createElement(
                        'h3',
                        { className: 'text-lg font-bold text-center' },
                        'Vygenerované presuny'
                    )
                ),
                React.createElement(
                    'p',
                    { className: 'text-center text-gray-500 py-6 text-sm italic px-3' },
                    'Načítavam presuny...'
                )
            );
        }

        // Filtrovanie podľa zvoleného dňa
        // === NOVÉ: Filter podľa dňa AJ kategórie ===
        const filteredByDay = savedTransfers.filter((t) => {
            if (selectedDayKey && t.dayKey !== selectedDayKey) return false;
            if (selectedCategoryFilter && cleanCategory(t.category || '') !== cleanCategory(selectedCategoryFilter)) return false;
            return true;
        });

        const parseWhenRangeFull = (when) => {
            if (!when) return null;
            const s = String(when);
            const regex = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/g;
            const found = [];
            let m;
            while ((m = regex.exec(s)) !== null) {
                const d = String(m[1]).padStart(2, '0');
                const mo = String(m[2]).padStart(2, '0');
                const y = m[3];
                const hh = m[4] != null ? String(m[4]).padStart(2, '0') : null;
                const mi = m[5] != null ? String(m[5]).padStart(2, '0') : null;
                found.push({
                    dayKey: `${y}-${mo}-${d}`,
                    label: `${d}. ${mo}. ${y}`,
                    time: (hh != null && mi != null) ? `${hh}:${mi}` : null,
                });
            }
            if (found.length === 0) return null;
            if (found.length === 1) {
                return {
                    startDayKey: found[0].dayKey,
                    endDayKey: found[0].dayKey,
                    startLabel: found[0].label,
                    endLabel: found[0].label,
                    startTime: found[0].time,
                    endTime: found[0].time,
                };
            }
            return {
                startDayKey: found[0].dayKey,
                endDayKey: found[1].dayKey,
                startLabel: found[0].label,
                endLabel: found[1].label,
                startTime: found[0].time,
                endTime: found[1].time,
            };
        };
    
        // ============================================================
        // Pomocná: z textu "Presun z X do Y" vytiahne { from, to }.
        // ============================================================
        const parseTransferText = (text) => {
            if (!text) return null;
            const s = String(text).trim();
            const m = /^Presun z (.+?) do (.+)$/.exec(s);
            if (!m) return null;
    
            const normalizePlace = (str) => String(str)
                .replace(/\bubytovania\b/gi, 'ubytovňa')
                .replace(/\bubytovanie\b/gi, 'ubytovňa')
                .replace(/\bzastávky\b/gi, 'zastávka')
                .replace(/\bzastávok\b/gi, 'zastávka')
                .replace(/\bmiesta zrazu\b/gi, 'miesto zrazu')
                .replace(/\bmiesto zrazu\b/gi, 'miesto zrazu');
    
            return {
                from: normalizePlace(m[1].trim()),
                to: normalizePlace(m[2].trim()),
            };
        };
    
        // ============================================================
        // assignedSegmentKeys – segmenty, ktoré sú už priradené
        // ============================================================
        const assignedSegmentsByTeam = new Map();
        
        const addAssignedSegment = (dayKey, teamName, category, fromLoc, toLoc) => {
            const key = `${dayKey}|${teamName}|${category}`;
            if (!assignedSegmentsByTeam.has(key)) assignedSegmentsByTeam.set(key, []);
            assignedSegmentsByTeam.get(key).push({
                from: normalizePlaceName(fromLoc),
                to: normalizePlaceName(toLoc),
            });
        };
        
        // 1) Autobusy
        Object.entries(busRows || {}).forEach(([busKey, rows]) => {
            const dayKey = busKey.split('|')[1];
            const sorted = (rows || [])
                .slice()
                .sort((a, b) => (a.order || 0) - (b.order || 0));
        
            const teamsInThisBus = new Map();
        
            sorted.forEach((row, idx) => {
                (row.teamsIn || []).forEach((teamKey) => {
                    const key = String(teamKey);
                    if (!teamsInThisBus.has(key)) {
                        teamsInThisBus.set(key, { boardIdx: idx, alightIdxs: [] });
                    }
                });
                (row.teamsOut || []).forEach((teamKey) => {
                    const key = String(teamKey);
                    const entry = teamsInThisBus.get(key);
                    if (entry && entry.boardIdx != null) {
                        entry.alightIdxs.push(idx);
                    }
                });
            });
        
            teamsInThisBus.forEach(({ boardIdx, alightIdxs }, teamKey) => {
                if (boardIdx == null || alightIdxs.length === 0) return;
            
                const [teamName, category] = teamKey.split('|');
                const tn = String(teamName).trim();
                const cat = cleanCategory(category || '');

                alightIdxs.forEach((alightIdx) => {
                    if (alightIdx < boardIdx) return;

                    // ============================================================
                    // OPRAVA: Pridaj LEN presnú dvojicu (from → to), ktorá
                    // zodpovedá nástupu a výstupu tímu v tomto buse.
                    //
                    // Predtým sa pridávali VŠETKY kombinácie [i, j] medzi
                    // boardIdx a alightIdx, čo spôsobovalo, že sa ako
                    // "priradené" označili aj segmenty, ktoré tím v buse
                    // vôbec neabsolvoval (napr. Rosinská → Predmestská,
                    // aj keď tím nastúpil inde a vystúpil inde).
                    // ============================================================
                    const fromLoc = sorted[boardIdx].placeFrom;
                    const toLoc = sorted[alightIdx].placeTo;
                    if (!fromLoc || !toLoc) return;
                    addAssignedSegment(dayKey, tn, cat, fromLoc, toLoc);
                });
            });
        });
        
        // 2) Pešie presuny
        savedTransfers.forEach((t) => {
            if (t.isWalking !== true) return;
            const tn = String(t.teamName || '').trim();
            const cat = cleanCategory(t.category || '');
            const dayKey = t.dayKey || '';
            addAssignedSegment(dayKey, tn, cat, t.fromLocation, t.toLocation);
        });
        
        // ============================================================
        // Pomocná: zistí, či je konkrétny segment už priradený
        // ============================================================
        const isSegmentAssigned = (t) => {
            const tn = String(t.teamName || '').trim();
            const cat = cleanCategory(t.category || '');
            const dayKey = t.dayKey || '';
            const fromLoc = normalizePlaceName(t.fromLocation || '');
            const toLoc = normalizePlaceName(t.toLocation || '');
            if (!fromLoc || !toLoc) return false;
        
            // 1) Presná zhoda (tím nastúpil/vystúpil presne na týchto zastávkach)
            const key = `${dayKey}|${tn}|${cat}`;
            const list = assignedSegmentsByTeam.get(key) || [];
            const exactMatch = list.some((s) => s.from === fromLoc && s.to === toLoc);
            if (exactMatch) return true;
        
            // ============================================================
            // NOVÉ: Fallback cez isSegmentCoveredByBusPath – LEN pre segmenty,
            // ktoré MAJÚ reálne časy z busu (busAssigned === true).
            //
            // DÔVOD: Ak tím v buse absolvoval dlhšiu trasu (napr. Hájik →
            // Internátna → UNIZA) a vystúpil až na UNIZA, tak segment
            // Hájik → Internátna NIE JE v assignedSegmentsByTeam (lebo tím
            // vystúpil na UNIZA, nie na Internátna), ale JE pokrytý trasou
            // busu – tím ho absolvoval. Preto sa má skryť.
            //
            // Pre NEPRIradené segmenty (busAssigned !== true) fallback
            // NEPOUŽÍVAME – tie sa majú zobraziť ako "čakajúce na priradenie".
            // ============================================================
            const segmentHasRealBusTimes =
                t.busAssigned === true ||
                (t._hasRealTime === true && t._isAssigned === true);
        
            if (segmentHasRealBusTimes) {
                if (isSegmentCoveredByBusPath(dayKey, tn, cat, t.fromLocation, t.toLocation)) {
                    return true;
                }
            }
        
            return false;
        };
    
        // ============================================================
        // NOVÉ: Rozlož presuny s intermediateStops na segmenty
        // ============================================================
        const expandedTransfers = [];
    
        filteredByDay.forEach((t) => {
            const stops = Array.isArray(t.intermediateStops) ? t.intermediateStops : [];

            // ============================================================
            // NOVÉ: Segmenty sa NIKDY neukladajú do DB – parent záznam
            // s intermediateStops zostáva v DB vždy ako jeden celok.
            // Preto tu nie je žiadna kontrola _parentKey / hasChildSegments.
            // ============================================================
        
            if (stops.length === 0) {
                // Klasický parent presun bez medzizastávok
                const isAssigned = isSegmentAssigned(t);
    
                // ============================================================
                // Ak `when` je prázdny, skús ho doplniť:
                //  1) z parent záznamu v savedTransfers (rovnaký key)
                //  2) z reálnych časov segmentov (startTs/endTs)
                // ============================================================
                let displayWhen = t.when;
                if (!displayWhen || String(displayWhen).trim() === '') {
                    const parentRec = savedTransfers.find((s) => s.key === t.key);
                    if (parentRec && parentRec.when && String(parentRec.when).trim() !== '') {
                        displayWhen = parentRec.when;
                    } else if (Array.isArray(t.segments) && t.segments.length > 0) {
                        // NOVÉ: poskladaj `when` z reálnych časov segmentov
                        let earliestStart = null;
                        let latestEnd = null;
                        t.segments.forEach((s) => {
                            if (s.startTs != null && (earliestStart == null || s.startTs < earliestStart)) {
                                earliestStart = s.startTs;
                            }
                            if (s.endTs != null && (latestEnd == null || s.endTs > latestEnd)) {
                                latestEnd = s.endTs;
                            }
                        });
                        if (earliestStart != null && latestEnd != null) {
                            displayWhen = `${formatTsLocal(earliestStart)} – ${formatTsLocal(latestEnd)}`;
                        } else if (earliestStart != null) {
                            displayWhen = formatTsLocal(earliestStart);
                        } else if (latestEnd != null) {
                            displayWhen = formatTsLocal(latestEnd);
                        }
                    }
                }
            
                expandedTransfers.push({
                    ...t,
                    when: displayWhen,
                    _isAssigned: isAssigned,
                    _hasRealTime: !!(displayWhen && String(displayWhen).trim() !== ''),
                });
                return;
            }
    
            // Odstráň duplicitné po sebe idúce zastávky z route
            const routeRaw = [t.fromLocation, ...stops, t.toLocation].filter(Boolean);
            const route = [];
            routeRaw.forEach((loc) => {
                const normalized = normalizePlaceName(loc);
                if (route.length === 0 || normalizePlaceName(route[route.length - 1]) !== normalized) {
                    route.push(loc);
                }
            });
    
            if (route.length < 2) {
                expandedTransfers.push(t);
                return;
            }
    
            const timeRange = parseWhenRangeToTs(t.when);
            if (!timeRange || timeRange.startTs == null || timeRange.endTs == null || timeRange.endTs <= timeRange.startTs) {
                // Fallback – nevieme vypočítať časy parenta.
                // Vytvor segmenty BEZ časov (zobrazia sa ako "čakajúce na priradenie").
                for (let i = 0; i < route.length - 1; i++) {
                    const fromLoc = String(route[i] || '').trim();
                    const toLoc = String(route[i + 1] || '').trim();
                    if (normalizePlaceName(fromLoc) === normalizePlaceName(toLoc)) continue;
            
                    // Zisti, či je tento segment označený ako peši
                    const parentSegmentForThisIdx = (() => {
                        if (!Array.isArray(t.segments)) return null;
                        const segFromNorm = normalizePlaceName(fromLoc);
                        const segToNorm = normalizePlaceName(toLoc);
                        return t.segments.find(
                            (s) => normalizePlaceName(s.from) === segFromNorm
                                && normalizePlaceName(s.to) === segToNorm
                        ) || null;
                    })();
            
                    const isSegmentWalking =
                        (parentSegmentForThisIdx && parentSegmentForThisIdx.isWalking === true) ||
                        t.isWalking === true;
            
                    if (isSegmentWalking) continue;
            
                    const text = `Presun z ${fromLoc} do ${toLoc}`;
                    const key = buildTransferKey(t.category, t.teamName, '', text);
            
                    expandedTransfers.push({
                        ...t,
                        key,
                        when: null,
                        text,
                        fromLocation: fromLoc,
                        toLocation: toLoc,
                        intermediateStops: [],
                        _parentKey: t.key,
                        _parentRoute: `${t.fromLocation} → ${t.toLocation}`,
                        _remainingMinutes: null,
                        _isAssigned: false,
                        _hasRealTime: false,
                        isWalking: false,
                    });
                }
                return;
            }
            
            // KROK 1: Reálne časy z autobusu
            const teamName = String(t.teamName || '').trim();
            const category = cleanCategory(t.category || '');
            const dayKey = t.dayKey || '';
            const teamKey = `${teamName}|${category}`;
    
            const allBusRowsForDay = [];
            Object.entries(busRows || {}).forEach(([busKey, rows]) => {
                const bDayKey = busKey.split('|')[1];
                if (bDayKey !== dayKey) return;
                (rows || []).forEach((row) => {
                    allBusRowsForDay.push({ ...row, _busKey: busKey });
                });
            });
            allBusRowsForDay.sort((a, b) => {
                const ta = a.timeFrom || '';
                const tb = b.timeFrom || '';
                return ta.localeCompare(tb);
            });
    
            const matchesTeam = (rowTeams) => {
                if (!Array.isArray(rowTeams)) return false;
                return rowTeams.some((tk) => {
                    const s = String(tk).trim();
                    if (s === teamKey) return true;
                    const [tn, cat] = s.split('|');
                    return String(tn).trim() === teamName && cleanCategory(cat) === category;
                });
            };
    
            const segmentRealTimes = [];
            const segmentAssigned = [];
    
            for (let i = 0; i < route.length - 1; i++) {
                const segFrom = normalizePlaceName(route[i]);
                const segTo = normalizePlaceName(route[i + 1]);
                let boardingTs = null;
                let alightingTs = null;
    
                allBusRowsForDay.forEach((row) => {
                    const rowFrom = normalizePlaceName(row.placeFrom);
                    const rowTo = normalizePlaceName(row.placeTo);
                    const hasTeamIn = matchesTeam(row.teamsIn);
                    const hasTeamOut = matchesTeam(row.teamsOut);
    
                    if (hasTeamIn && rowFrom === segFrom && row.timeFrom && boardingTs == null) {
                        const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
                        if (dm) {
                            const [h, mi] = row.timeFrom.split(':').map(Number);
                            boardingTs = new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), h, mi, 0, 0).getTime();
                        }
                    }
                    if (hasTeamOut && rowTo === segTo && row.timeTo && alightingTs == null) {
                        const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
                        if (dm) {
                            const [h, mi] = row.timeTo.split(':').map(Number);
                            alightingTs = new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), h, mi, 0, 0).getTime();
                        }
                    }
                });
    
                if (boardingTs != null && alightingTs != null && alightingTs > boardingTs) {
                    segmentRealTimes.push({ startTs: boardingTs, endTs: alightingTs });
                    segmentAssigned.push(true);
                } else if (boardingTs != null) {
                    segmentRealTimes.push({ startTs: boardingTs, endTs: null });
                    segmentAssigned.push(true);
                } else if (alightingTs != null) {
                    segmentRealTimes.push({ startTs: null, endTs: alightingTs });
                    segmentAssigned.push(true);
                } else {
                    segmentRealTimes.push(null);
                    segmentAssigned.push(false);
                }
            }
    
            // ============================================================
            // KROK 2: Vypočítaj časy
            //
            // PRAVIDLÁ:
            //  1) Ak segment má reálny čas z busu (segmentRealTimes), použije sa.
            //  2) Ak segment má reálny čas zo savedTransfers (realSegmentTimes),
            //     použije sa.
            //  3) Ak segment nemá reálny čas (nie je priradený k busu ani
            //     označený ako peši), NEDOSTANE ŽIADNY ČAS (startTs = null,
            //     endTs = null). Nebude sa mu prisudzovať celý interval parenta,
            //     pretože medzi segmentami môže byť "hluchý" čas a každý
            //     segment môže mať iné trvanie.
            //
            // DÔLEŽITÉ: Segmenty sa NIKDY nerozdeľujú rovnomerne ani podľa
            // trvania jázd. Čas sa im priradí až keď ich používateľ priradí
            // k busu (alebo označí ako peši).
            // ============================================================
            const finalTimes = new Array(route.length - 1).fill(null);
            
            // 1) Plne vyriešené segmenty – priorita:
            //    a) reálny čas z autobusu (segmentRealTimes)
            //    b) reálny čas zo savedTransfers (realSegmentTimes)
            for (let i = 0; i < route.length - 1; i++) {
                const rt = segmentRealTimes[i];
                if (rt && rt.startTs != null && rt.endTs != null) {
                    finalTimes[i] = { startTs: rt.startTs, endTs: rt.endTs };
                    continue;
                }
            }
            
            // 2) Čiastočne vyriešené segmenty (máme len nástup alebo len výstup)
            //    → doplníme chýbajúci koniec z parent intervalu, ale len ak
            //    je to jediný spôsob, ako segment zobraziť. Tento segment
            //    sa zobrazí v boxe ako "priraďte dokončenie".
            for (let i = 0; i < route.length - 1; i++) {
                if (finalTimes[i]) continue;
                const rt = segmentRealTimes[i];
                if (rt) {
                    const startTs = rt.startTs != null ? rt.startTs : timeRange.startTs;
                    const endTs = rt.endTs != null ? rt.endTs : timeRange.endTs;
                    finalTimes[i] = { startTs, endTs };
                }
            }
            
            // 3) Plne nevyriešené segmenty → ŽIADNY ČAS (null).
            //    NEprideľujeme im celý interval parenta, pretože:
            //     - medzi segmentami môže byť "hluchý" čas,
            //     - každý segment môže mať iné trvanie,
            //     - čas sa priradí až po priradení k busu / označení ako peši.
            for (let i = 0; i < route.length - 1; i++) {
                if (finalTimes[i]) continue;
                finalTimes[i] = { startTs: null, endTs: null };
            }

            // ============================================================
            // NOVÉ: Zisti, či parent mal `when` (alebo segmenty mali reálne časy).
            // Ak áno, pre PRVÝ nepriradený segment použi tento `when`.
            // ============================================================
            const parentEffectiveWhen = (() => {
                if (t.when && String(t.when).trim() !== '') return t.when;
                if (Array.isArray(t.segments) && t.segments.length > 0) {
                    let earliestStart = null;
                    let latestEnd = null;
                    t.segments.forEach((s) => {
                        if (s.startTs != null && (earliestStart == null || s.startTs < earliestStart)) {
                            earliestStart = s.startTs;
                        }
                        if (s.endTs != null && (latestEnd == null || s.endTs > latestEnd)) {
                            latestEnd = s.endTs;
                        }
                    });
                    if (earliestStart != null && latestEnd != null) {
                        return `${formatTsLocal(earliestStart)} – ${formatTsLocal(latestEnd)}`;
                    } else if (earliestStart != null) {
                        return formatTsLocal(earliestStart);
                    } else if (latestEnd != null) {
                        return formatTsLocal(latestEnd);
                    }
                }
                return null;
            })();

            // Nájdi index PRVÉHO nepriradeného segmentu (hasRealTime === false)
            const firstUnassignedIdx = (() => {
                for (let i = 0; i < route.length - 1; i++) {
                    const ft = finalTimes[i];
                    const hasRealTime = ft && ft.startTs != null && ft.endTs != null;
                    if (!hasRealTime) return i;
                }
                return -1;
            })();
    
            // ============================================================
            // KROK 3: Vytvor segmenty
            //
            // Ak segment nemá reálny čas (finalTimes[i].startTs == null),
            // NEZOBRAZUJE sa v boxe "Vygenerované presuny" s časom –
            // zobrazí sa len s výzvou "priraďte tento segment".
            //
            // Zvyšný čas (_remainingMinutes) sa počíta LEN pre segmenty,
            // ktoré majú reálny čas a zároveň nie sú priradené k busu
            // (t.j. čakajú na priradenie).
            // ============================================================
            for (let i = 0; i < route.length - 1; i++) {
                const ft = finalTimes[i];
                if (!ft) continue;
            
                // Preskoč segment, ak from === to
                const fromLoc = String(route[i] || '').trim();
                const toLoc = String(route[i + 1] || '').trim();
                if (normalizePlaceName(fromLoc) === normalizePlaceName(toLoc)) continue;
            
                // ============================================================
                // NOVÉ: Zisti, či je TENTO konkrétny segment označený ako peši
                // v parent.segments (rovnaká logika ako vo fallback vetve).
                // ============================================================
                const parentSegmentForThisIdx = (() => {
                    if (!Array.isArray(t.segments)) return null;
                    const segFromNorm = normalizePlaceName(fromLoc);
                    const segToNorm = normalizePlaceName(toLoc);
                    return t.segments.find(
                        (s) => normalizePlaceName(s.from) === segFromNorm
                            && normalizePlaceName(s.to) === segToNorm
                    ) || null;
                })();
            
                const isSegmentWalking =
                    (parentSegmentForThisIdx && parentSegmentForThisIdx.isWalking === true) ||
                    t.isWalking === true;
            
                // ============================================================
                // NOVÉ: Pešie segmenty patria do boxu "Peši" – NEPRIDÁVAJ ich
                // do expandedTransfers, aby sa nezobrazili vo vygenerovaných presunoch.
                // ============================================================
                if (isSegmentWalking) {
                    continue;
                }
            
                const hasRealTime = ft.startTs != null && ft.endTs != null;
                let whenStr = hasRealTime
                    ? `${formatTsLocal(ft.startTs)} – ${formatTsLocal(ft.endTs)}`
                    : null;
            
                const text = `Presun z ${fromLoc} do ${toLoc}`;
                const key = buildTransferKey(
                    t.category,
                    t.teamName,
                    whenStr || '',
                    text
                );
            
                let remainingMinutes = null;
            
                if (hasRealTime && !segmentAssigned[i]) {
                    let endTs = null;
                    for (let k = i + 1; k < route.length - 1; k++) {
                        if (segmentAssigned[k] && finalTimes[k] && finalTimes[k].startTs != null) {
                            endTs = finalTimes[k].startTs;
                            break;
                        }
                    }
                    if (endTs == null) endTs = timeRange.endTs;
            
                    if (endTs != null && ft.startTs != null && endTs > ft.startTs) {
                        remainingMinutes = Math.round((endTs - ft.startTs) / 60000);
                    }
                }

                console.log('[TRANSPORT][EXPANDED] Pushing segment', {
                    fromLoc,
                    toLoc,
                    isSegmentWalking,
                    hasRealTime,
                    whenStr,
                });
            
                expandedTransfers.push({
                    ...t,
                    key,
                    when: whenStr,
                    text,
                    fromLocation: fromLoc,
                    toLocation: toLoc,
                    intermediateStops: [],
                    _parentKey: t.key,
                    _parentRoute: `${t.fromLocation} → ${t.toLocation}`,
                    _remainingMinutes: remainingMinutes,
                    _isAssigned: segmentAssigned[i],
                    _hasRealTime: hasRealTime,
                    isWalking: false,   // sem sa dostanú len nepešie segmenty
                });
            }
        });
    
        // ============================================================
        // NOVÉ: Zisti, ktoré parent bloky (parentKey + tím + kat. + deň)
        // sú ÚPLNE priradené (všetky ich segmenty sú priradené alebo peši).
        // Len takéto parent bloky môžeme skryť z zoznamu.
        //
        // DÔVOD: Ak má tím v ten istý deň DVA parent presuny
        // (napr. A→B→C a D→E→F), a jeden z nich je priradený
        // k autobusu, nesmieme skryť segmenty toho druhého parenta
        // len preto, že ich náhodou pokrýva trasa autobusu
        // (isSegmentAssigned by vrátil true pre A→B, aj keď patrí
        // k inému parentovi).
        // ============================================================
        const fullyAssignedParentKeys = new Set();

        const parentKeysInExpanded = new Set();
        expandedTransfers.forEach((t) => {
            if (t._parentKey) parentKeysInExpanded.add(t._parentKey);
        });

        parentKeysInExpanded.forEach((parentKey) => {
            const parent = savedTransfers.find((s) => s.key === parentKey);
            if (!parent || !Array.isArray(parent.segments)) return;
        
            // Parent je úplne priradený, ak KAŽDÝ segment v parent.segments
            // je buď walking alebo má reálne časy z busu.
            const allAssigned = parent.segments.every((seg) => {
                if (!seg) return false;
                if (seg.isWalking === true) return true;
                if (seg.busAssigned === true && seg.startTs != null && seg.endTs != null) return true;
                return false;
            });
            if (allAssigned) fullyAssignedParentKeys.add(parentKey);
        });

        const baseFiltered = expandedTransfers.filter((t) => {
            // Pešie segmenty patria do boxu "Peši"
            if (t.isWalking === true) return false;
        
            if (t._parentKey) {
                // ============================================================
                // Pre segmenty parenta:
                //  - Ak je segment označený ako walking → patrí do boxu "Peši",
                //    nie sem.
                //  - Ak je segment MANUÁLNE priradený k busu (má reálne časy
                //    z busu a tím v ňom SKUTOČNE sedí), skry ho.
                //
                // DÔLEŽITÉ: NEpoužívame `seg.busAssigned` z parent.segments,
                // pretože ten sa môže stať nesynchronizovaným s aktuálnym
                // stavom busRows (napr. po odstránení tímu z busu).
                // Namiesto toho používame `isSegmentAssigned(t)`, ktorá
                // pracuje s AKTUÁLNYMI busRows (cez assignedSegmentsByTeam
                // a isSegmentCoveredByBusPath).
                // ============================================================
                const parent = savedTransfers.find((s) => s.key === t._parentKey);
                if (parent && Array.isArray(parent.segments)) {
                    const segIdx = findSegmentIndex(parent.segments, t.fromLocation, t.toLocation);
                    if (segIdx !== -1) {
                        const seg = parent.segments[segIdx];
                        // Walking segment patrí do boxu "Peši"
                        if (seg && seg.isWalking === true) {
                            return false;
                        }
                    }
                }

                // ============================================================
                // Skry len ak je segment SKUTOČNE priradený k busu
                // (tím v ňom sedí podľa aktuálnych busRows).
                // ============================================================
                if (isSegmentAssigned(t)) return false;

                // Skontroluj, či je parent úplne priradený (všetky segmenty
                // walking alebo priradené k busu) – v takom prípade ho skry.
                if (t._parentKey && fullyAssignedParentKeys.has(t._parentKey)) return false;
                return true;
            }
        
            // ============================================================
            // Pre samostatné (non-segment) presuny:
            //  - Ak je walking → patrí do boxu "Peši".
            //  - Skry len ak je SKUTOČNE priradený k busu.
            // ============================================================
            const parentRec = savedTransfers.find((s) => s.key === t.key);
            if (parentRec && Array.isArray(parentRec.segments)) {
                const segIdx = findSegmentIndex(parentRec.segments, t.fromLocation, t.toLocation);
                if (segIdx !== -1) {
                    const seg = parentRec.segments[segIdx];
                    if (seg && seg.isWalking === true) {
                        return false;
                    }
                }
            }

            if (isSegmentAssigned(t)) return false;

            if (t._remainingMinutes != null && t._remainingMinutes <= 0) {
                return false;
            }
            return true;
        });

        // ============================================================
        // Výber prvého segmentu z každého parent bloku
        //
        // JEDINÁ priorita: NAJMENŠÍ INDEX segmentu v parent.segments
        // (t.j. najskorší segment v poradí trasy).
        //
        // Žiadne ďalšie priority (isFirstFromParent, startTs) sa už
        // nepoužívajú – rozhoduje výhradne poradie segmentu v trase
        // parenta. Ak je najskorší segment už priradený k busu (a teda
        // nie je v `baseFiltered`), vyberie sa najskorší segment spomedzi
        // tých, ktoré v `baseFiltered` zostali.
        // ============================================================
        const firstSegmentPerParent = new Map();

        // Pomocná: získa index segmentu (from → to) v parent.segments
        const getParentSegmentIndex = (t) => {
            if (!t._parentKey) return Number.POSITIVE_INFINITY;
            const parent = savedTransfers.find((s) => s.key === t._parentKey);
            if (!parent || !Array.isArray(parent.segments)) return Number.POSITIVE_INFINITY;
            const idx = findSegmentIndex(parent.segments, t.fromLocation, t.toLocation);
            return idx === -1 ? Number.POSITIVE_INFINITY : idx;
        };

        baseFiltered.forEach((t) => {
            const blockKey = t._parentKey
                ? `${t._parentKey}||${cleanCategory(t.category || '')}||${String(t.teamName || '').trim()}`
                : `solo||${t.key}`;

            const segmentIdx = getParentSegmentIndex(t);

            const existing = firstSegmentPerParent.get(blockKey);
            if (!existing) {
                firstSegmentPerParent.set(blockKey, { segment: t, segmentIdx });
                return;
            }

            // Jediná priorita: najmenší index segmentu v parent.segments
            if (segmentIdx < existing.segmentIdx) {
                firstSegmentPerParent.set(blockKey, { segment: t, segmentIdx });
            }
        });
        
        const allowedKeys = new Set();
        firstSegmentPerParent.forEach(({ segment }) => {
            allowedKeys.add(segment.key);
        });
        
        const baseFilteredFirstOnlyRaw = baseFiltered.filter((t) => allowedKeys.has(t.key));

        const baseFilteredFirstOnly = baseFilteredFirstOnlyRaw.map((t) => {
            if (!t._parentKey) return t;

            // ============================================================
            // NOVÉ: Použi spoločnú pomocnú funkciu na výpočet provizórneho
            // intervalu. Tá istá funkcia sa používa aj vo findMatchingBusRows,
            // takže zobrazený čas a čas použitý pri hľadaní autobusov sú
            // IDENTICKÉ.
            // ============================================================
            const provisional = computeProvisionalSegmentRange(t);
            if (!provisional) {
                return {
                    ...t,
                    when: null,
                    _remainingMinutes: null,
                };
            }

            const provisionalWhenStr = `${formatTsLocal(provisional.startTs)} – ${formatTsLocal(provisional.endTs)}`;
        
            return {
                ...t,
                when: provisionalWhenStr,
                _remainingMinutes: null,
                _hasRealTime: false,
            };
        });
        
        const filtered = showOnlyPartialTransfers
            ? baseFilteredFirstOnly.filter((t) => t._parentKey && t._parentRoute)
            : baseFilteredFirstOnly;
    
        // Zoradenie
        const buildStartSortKey = (t) => {
            const r = parseWhenRangeFull(t.when);
            const dayKey = r ? r.startDayKey : (t.dayKey || '');
            const time = r && r.startTime ? r.startTime : '00:00';
            const datePart = String(dayKey || '').replace(/-/g, '');
            const timePart = String(time || '').replace(':', '');
            return `${datePart}${timePart}`;
        };
    
        const buildEndSortKey = (t) => {
            const r = parseWhenRangeFull(t.when);
            const dayKey = r ? r.endDayKey : (t.dayKey || '');
            const time = r && r.endTime ? r.endTime : '23:59';
            const datePart = String(dayKey || '').replace(/-/g, '');
            const timePart = String(time || '').replace(':', '');
            return `${datePart}${timePart}`;
        };
    
        const sortedTransfers = [...filtered].sort((a, b) => {
            const startA = buildStartSortKey(a);
            const startB = buildStartSortKey(b);
            if (startA !== startB) return startA.localeCompare(startB);
    
            const endA = buildEndSortKey(a);
            const endB = buildEndSortKey(b);
            if (endA !== endB) return endA.localeCompare(endB);
    
            const ca = cleanCategory(a.category) || '';
            const cb = cleanCategory(b.category) || '';
            if (ca !== cb) return ca.localeCompare(cb, 'sk', { sensitivity: 'base' });
    
            const ta = String(a.teamName || '');
            const tb = String(b.teamName || '');
            return ta.localeCompare(tb, 'sk', { sensitivity: 'base' });
        });
    
        return React.createElement(
            'div',
            {
                className: 'bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden flex-shrink-0',
                style: { width: '420px', maxWidth: '100%' }
            },
            React.createElement(
                'div',
                {
                    className: 'relative px-5 py-3 flex items-center justify-center text-white',
                    style: { backgroundColor: '#7c3aed' }
                },
                React.createElement('i', { className: 'fa-solid fa-van-shuttle mr-2' }),
                React.createElement(
                    'h3',
                    { className: 'text-lg font-bold text-center' },
                    'Vygenerované presuny'
                ),
                React.createElement(
                    'span',
                    { className: 'absolute right-3 text-xs bg-white/20 rounded-full px-2 py-0.5' },
                    `${filtered.length}`
                )
            ),
            // ============================================================
            // NOVÉ: Checkbox – zobraziť iba presuny s textom "časť presunu"
            // (umiestnený POD hlavičkou boxu)
            // ============================================================
            React.createElement(
                'div',
                { className: 'px-3 pt-2 pb-1 border-b border-gray-100 flex items-center justify-end' },
                React.createElement(
                    'label',
                    {
                        className: 'flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer select-none',
                        title: 'Zobraziť iba tie presuny, ktoré sú časťou väčšieho presunu (majú medzizastávky)',
                    },
                    React.createElement('input', {
                        type: 'checkbox',
                        checked: showOnlyPartialTransfers,
                        onChange: (e) => setShowOnlyPartialTransfers(e.target.checked),
                        className: 'w-4 h-4 rounded accent-violet-600 cursor-pointer',
                    }),
                    React.createElement('span', { className: 'whitespace-nowrap' }, 'Iba časti presunov')
                )
            ),
            filtered.length === 0
                ? React.createElement(
                    'p',
                    { className: 'text-center text-gray-500 py-6 text-sm italic px-3' },
                    showOnlyPartialTransfers
                        ? 'Žiadne presuny, ktoré by boli časťou väčšieho presunu (s medzizastávkami).'
                        : 'Zatiaľ žiadne vygenerované presuny. Kliknite na "+" vpravo dole a vygenerujte časovú os.'
                )
                : React.createElement(
                    'div',
                    { className: 'p-3' },
                    React.createElement(
                        'ul',
                        { className: 'space-y-2' },
                        sortedTransfers.map((t) => {
                            const rangeInfo = parseWhenRangeFull(t.when);
                            const transferInfo = parseTransferText(t.text);
    
                            const transportColor = getTransportColorForCategory(t.category);
                            const boxBg = transportColor
                                ? lightenHex(transportColor, 0.15)
                                : null;
    
                            let dateLabel = null;
                            if (rangeInfo) {
                                dateLabel = (rangeInfo.startDayKey === rangeInfo.endDayKey)
                                    ? rangeInfo.startLabel
                                    : `${rangeInfo.startLabel} – ${rangeInfo.endLabel}`;
                            } else if (t.dayKey) {
                                dateLabel = formatDateDDMMYYYY(t.dayKey) || t.dayKey;
                            }
    
                            // ============================================================
                            // Zobraz čas vždy, keď ho máme. Fallback:
                            //  1) ak `rangeInfo` má čas → "HH:MM – HH:MM"
                            //  2) ak `t.when` je neprázdny string → zobraz ho priamo
                            //  3) ak `t.segments` majú reálne časy → poskladaj z nich
                            //  4) NOVÉ: ak je to segment (má `_parentKey`), skús `when` parenta
                            //     – ale zobraz IBA ČAS (HH:MM – HH:MM), bez dátumu
                            //  5) ak máme len `dayKey` → "DD. MM. YYYY (čas neurčený)"
                            // ============================================================
                            
                            // Pomocná: z ľubovoľného "when" stringu vytiahne iba časy "HH:MM – HH:MM"
                            const extractTimesOnly = (whenStr) => {
                                if (!whenStr) return null;
                                const s = String(whenStr);
                                const regex = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/g;
                                const times = [];
                                let m;
                                while ((m = regex.exec(s)) !== null) {
                                    if (m[4] != null && m[5] != null) {
                                        times.push(`${String(m[4]).padStart(2, '0')}:${String(m[5]).padStart(2, '0')}`);
                                    }
                                }
                                if (times.length === 0) return null;
                                if (times.length === 1) return times[0];
                                return `${times[0]} – ${times[1]}`;
                            };
                            
                            let timeLabel = null;
                            if (rangeInfo && (rangeInfo.startTime || rangeInfo.endTime)) {
                                const st = rangeInfo.startTime;
                                const et = rangeInfo.endTime;
                                if (st && et) timeLabel = `${st} – ${et}`;
                                else if (st) timeLabel = st;
                                else if (et) timeLabel = et;
                            } else if (t.when && String(t.when).trim() !== '') {
                                // z `t.when` zobraz iba časy (bez dátumu)
                                timeLabel = extractTimesOnly(t.when) || String(t.when).trim();
                            } else if (Array.isArray(t.segments) && t.segments.length > 0) {
                                // skús vytiahnuť aspoň HH:MM z reálnych časov segmentov
                                let earliestStart = null;
                                let latestEnd = null;
                                t.segments.forEach((s) => {
                                    if (s.startTs != null && (earliestStart == null || s.startTs < earliestStart)) {
                                        earliestStart = s.startTs;
                                    }
                                    if (s.endTs != null && (latestEnd == null || s.endTs > latestEnd)) {
                                        latestEnd = s.endTs;
                                    }
                                });
                                const startStr = earliestStart != null ? formatTsLocal(earliestStart) : null;
                                const endStr = latestEnd != null ? formatTsLocal(latestEnd) : null;
                                const startTime = startStr ? /(\d{2}:\d{2})$/.exec(startStr)?.[1] : null;
                                const endTime = endStr ? /(\d{2}:\d{2})$/.exec(endStr)?.[1] : null;
                                if (startTime && endTime) timeLabel = `${startTime} – ${endTime}`;
                                else if (startTime) timeLabel = startTime;
                                else if (endTime) timeLabel = endTime;
                            }

                            // ============================================================
                            // NOVÉ: Ak stále nemáme čas, skús PROVIZÓRNY interval
                            // (rovnaká logika ako v modálnom okne „Priradiť presun
                            //  k autobusu" a v „Upraviť presun").
                            //
                            // Tým sa zabezpečí, že v zozname sa zobrazí ROVNAKÝ
                            // čas, aký sa zobrazí po kliknutí na presun v modálnom
                            // okne (napr. pri nepriradenom segmente parenta,
                            // ktorý má provizórny interval z okolitých segmentov).
                            // ============================================================
                            if (!timeLabel && t._parentKey) {
                                const provisional = computeProvisionalSegmentRange(t);
                                if (provisional) {
                                    const startFmt = formatTsLocal(provisional.startTs);
                                    const endFmt = formatTsLocal(provisional.endTs);
                                    const startTime = startFmt ? /(\d{2}:\d{2})$/.exec(startFmt)?.[1] : null;
                                    const endTime = endFmt ? /(\d{2}:\d{2})$/.exec(endFmt)?.[1] : null;
                                    if (startTime && endTime) timeLabel = `${startTime} – ${endTime}`;
                                    else if (startTime) timeLabel = startTime;
                                    else if (endTime) timeLabel = endTime;
                                }
                            }
                            
                            if (!timeLabel && t.dayKey) {
                                const dayLabel = formatDateDDMMYYYY(t.dayKey) || t.dayKey;
                                timeLabel = `${dayLabel} (čas neurčený)`;
                            }

                            // ============================================================
                            // NOVÉ: routeLabel – zostav z `transferInfo` alebo z parent route
                            // (musí byť definované, inak render padá na ReferenceError)
                            // ============================================================
                            let routeLabel = null;
                            if (transferInfo) {
                                if (t.intermediateStops && t.intermediateStops.length > 0) {
                                    routeLabel = [t.fromLocation, ...t.intermediateStops, t.toLocation]
                                        .filter(Boolean)
                                        .join(' → ');
                                } else {
                                    routeLabel = `${transferInfo.from} → ${transferInfo.to}`;
                                }
                            } else if (t.fromLocation && t.toLocation) {
                                // Fallback – ak sa z textu nedá parsovať, použi priamo from/to
                                routeLabel = `${t.fromLocation} → ${t.toLocation}`;
                            }
    
                            // NOVÉ: informácia o pôvodnom presune
                            const parentInfoLabel = t._parentKey && t._parentRoute
                                ? `časť presunu ${t._parentRoute}`
                                : null;
    
                            // NOVÉ: zvyšný čas na presun (len pre segmenty s reálnym časom)
                            const remainingLabel = (t._remainingMinutes != null && t._remainingMinutes > 0)
                                ? `zvyšný čas na presun: ${t._remainingMinutes} min`
                                : null;
    
                            return React.createElement(
                                'li',
                                {
                                    key: t.key,
                                    onClick: () => {
                                        logTransferDbDocument(t);
                                        setTransferActionModal({ transfer: t });
                                    },
                                    className: 'relative text-sm text-gray-700 flex flex-col leading-snug rounded-md px-2 py-1.5 cursor-pointer hover:shadow-md transition-shadow' +
                                        (boxBg ? '' : ' bg-violet-50/40'),
                                    style: {
                                        position: 'relative',
                                        borderLeft: transportColor
                                            ? `6px solid ${transportColor}`
                                            : '2px solid #c4b5fd',
                                        ...(boxBg ? { backgroundColor: boxBg } : {}),
                                    }
                                },
                                // 1. riadok – KATEGÓRIA • TÍM
                                (() => {
                                    const counts = getTeamCountsForTransfer(t.category, t.teamName);
                                    const totalMembers = counts
                                        ? counts.players + counts.menRT + counts.womenRT + counts.menDrivers + counts.womenDrivers
                                        : null;
    
                                    let valueText = null;
                                    let displayTitle = null;
    
                                    if (totalMembers != null) {
                                        valueText = `${totalMembers}`;
                                    } else {
                                        const avg = getCategoryAverageForTransfer(t.category);
                                        if (avg != null) {
                                            valueText = `${avg}`;
                                            displayTitle = `Priemer členov tímu v kategórii ${t.category} (zaokrúhlené nahor)`;
                                        }
                                    }
    
                                    const teamLabel = t.teamName || '(neznámy tím)';
                                    const fullText = valueText ? `${teamLabel} ● ${valueText} členov` : teamLabel;
    
                                    return React.createElement(
                                        'span',
                                        {
                                            className: 'font-semibold',
                                            style: { color: transportColor || '#5b21b6' },
                                            title: displayTitle || ''
                                        },
                                        fullText
                                    );
                                })(),
                                // 2. riadok – dátum
                                dateLabel &&
                                    React.createElement(
                                        'span',
                                        { className: 'text-sm text-gray-500' },
                                        dateLabel
                                    ),
                                // 3. riadok – čas
                                timeLabel &&
                                    React.createElement(
                                        'span',
                                        { className: 'text-sm text-gray-600' },
                                        timeLabel
                                    ),
                                // 4. riadok – miesta
                                routeLabel &&
                                    React.createElement(
                                        'span',
                                        { className: 'text-sm text-gray-900 font-medium' },
                                        routeLabel
                                    ),
                                // 5. riadok – informácia o pôvodnom presune
                                parentInfoLabel &&
                                    React.createElement(
                                        'span',
                                        { className: 'text-sm text-violet-600 italic mt-0.5 inline-flex items-center gap-1' },
                                        React.createElement('i', { className: 'fa-solid fa-code-branch' }),
                                        parentInfoLabel
                                    ),
                                // 6. riadok – NOVÉ: zvyšný čas na presun
                                remainingLabel &&
                                    React.createElement(
                                        'span',
                                        { className: 'text-xs text-amber-700 font-semibold mt-0.5 inline-flex items-center gap-1' },
                                        React.createElement('i', { className: 'fa-solid fa-hourglass-half' }),
                                        remainingLabel
                                    ),
                                // 7. riadok – príznak "peši"
                                t.isWalking === true &&
                                    React.createElement(
                                        'span',
                                        { className: 'text-xs font-semibold text-emerald-700 mt-0.5 inline-flex items-center gap-1' },
                                        React.createElement('i', { className: 'fa-solid fa-person-walking' }),
                                        'PEŠI'
                                    ),
                                // NOVÉ: ikona koša vpravo – odstráni len tento konkrétny presun
                                // (rovnaký štýl ako v hlavičke busu, keď je tlačidlo odblokované)
                                React.createElement(
                                    'button',
                                    {
                                        type: 'button',
                                        onClick: (e) => {
                                            e.stopPropagation();
                                            setDeleteTransferModal({ transfer: t });
                                        },
                                        title: 'Odstrániť tento presun',
                                        className: 'absolute top-1.5 right-1.5 rounded-full w-8 h-8 flex items-center justify-center transition-colors bg-red-600 text-white hover:bg-red-700',
                                    },
                                    React.createElement('i', { className: 'fa-solid fa-trash' })
                                ),
                                // Fallback
                                (!dateLabel && !timeLabel && !routeLabel) &&
                                    React.createElement(
                                        'span',
                                        { className: 'text-sm text-gray-800' },
                                        String(t.text || '')
                                            .replace(/^Presun z /, '')
                                            .replace(/\bubytovania\b/gi, 'ubytovňa')
                                            .replace(/\bubytovanie\b/gi, 'ubytovňa')
                                            .replace(/\bzastávky\b/gi, 'zastávka')
                                            .replace(/\bzastávok\b/gi, 'zastávka')
                                    ),
                            );
                        })
                    )
                )
        );
    };

    // ============================================================
    // NOVÉ: Získa zoznam udalostí pre daný tím (rovnaký ako v konzole)
    // + doplní vygenerované presuny ROZLOŽENÉ NA SEGMENTY
    //
    // Každý segment (časť presunu) je samostatná udalosť:
    //  - ak je priradený k busu → zobrazí sa názov busu + čas
    //  - ak je peši → zobrazí sa "PEŠI"
    //  - ak nie je priradený → "nepriradený"
    //  - všetky segmenty sú oranžové (rovnako ako príchod)
    // ============================================================
    const getTeamEventsForCustomTransfer = (category, teamName) => {
        if (!category || !teamName) return [];

        const cat = cleanCategory(category);
        const name = String(teamName || '').trim();

        // Zber udalostí z matchesBufferRef
        const events = [];

        // 1) Zápasy
        (matchesBufferRef.current || []).forEach((m) => {
            if (cleanCategory(m.category) !== cat) return;
            if (m.home !== name && m.away !== name) return;

            const startTs = m.scheduledTs ?? null;
            const endTs = m.scheduledEndTs ?? startTs;
            const timeRange = m.scheduledTime
                ? (m.scheduledEndTime ? `${m.scheduledTime} – ${m.scheduledEndTime}` : m.scheduledTime)
                : 'nenaplánované';
            const text = `${m.home} vs ${m.away}${m.special}${m.hallName ? ` | ${m.hallName}` : ''}`;

            events.push({
                ts: m.scheduledTs ?? Number.POSITIVE_INFINITY,
                startTs,
                endTs,
                when: timeRange,
                type: 'match',
                text,
                location: m.hallName || null,
            });
        });

        // 2) Stravovania
        (cateringBufferRef.current || []).forEach((c) => {
            if (cleanCategory(c.category) !== cat) return;
            if (c.teamName !== name) return;

            const mealLabel = c.mealType === 'lunch' ? 'Obed' : c.mealType === 'dinner' ? 'Večera' : c.mealType;
            const formattedDay = c.dayKey ? (formatDateDDMMYYYY(c.dayKey) || c.dayKey) : '?';
            const timeRange = c.slotFrom
                ? (c.slotTo ? `${c.slotFrom} – ${c.slotTo}` : c.slotFrom)
                : '--:--';

            const startTs = c.ts ?? null;
            const endTs = c.slotToTs ?? startTs;

            events.push({
                ts: c.ts ?? Number.POSITIVE_INFINITY,
                startTs,
                endTs,
                when: ` ${formattedDay} ${timeRange}`.trim(),
                type: 'catering',
                text: `${mealLabel} (${timeRange}) → ${c.placeName}`,
                location: c.placeName || null,
            });
        });

        // 3) Ubytovanie + príchod (z teamsArrivalBufferRef)
        const teamInfo = (teamsArrivalBufferRef.current || []).find(
            (t) => cleanCategory(t.category) === cat && t.teamName === name
        );

        if (teamInfo) {
            if (teamInfo.accommodationName) {
                events.push({
                    ts: -Infinity,
                    startTs: null,
                    endTs: null,
                    when: '—',
                    type: 'accommodation',
                    text: `Ubytovanie: ${teamInfo.accommodationName} (typ: ${teamInfo.accommodationType || 'neurčený'})`,
                    location: teamInfo.accommodationName,
                });
            }
            if (teamInfo.arrivalDisplay && teamInfo.arrivalDisplay !== '---') {
                events.push({
                    ts: -Infinity,
                    startTs: null,
                    endTs: null,
                    when: '—',
                    type: 'arrival',
                    text: `Doprava / príchod: ${teamInfo.arrivalDisplay}`,
                    location: null,
                });
            }
        }

        // ============================================================
        // NOVÉ: Doplniť vygenerované presuny ROZLOŽENÉ NA SEGMENTY
        //
        // Pre každý parent záznam:
        //  - zisti route (fromLocation → intermediateStops → toLocation)
        //  - pre každý segment (from → to):
        //      * ak je isWalking → "PEŠI"
        //      * ak je busAssigned (má startTs/endTs a busId) → "Bus X" + čas
        //      * inak → "nepriradený"
        //  - každý segment je samostatná udalosť typu 'transfer'
        //    s príznakom _isTransferRow = true (pre oranžové zafarbenie)
        // ============================================================
        (savedTransfersRef.current || []).forEach((t) => {
            if (cleanCategory(t.category || '') !== cat) return;
            if (String(t.teamName || '').trim() !== name) return;
            // Len parent záznamy (nie segmenty)
            if (t._parentKey && t._parentKey !== t.key) return;

            const stops = Array.isArray(t.intermediateStops) ? t.intermediateStops : [];
            const routeRaw = [t.fromLocation, ...stops, t.toLocation].filter(Boolean);
            const route = [];
            routeRaw.forEach((loc) => {
                const normalized = normalizePlaceName(loc);
                if (route.length === 0 || normalizePlaceName(route[route.length - 1]) !== normalized) {
                    route.push(loc);
                }
            });
            if (route.length < 2) return;

            const parentSegments = Array.isArray(t.segments) ? t.segments : [];
            const parentWhenRange = parseTransferWhenToRange(t.when);

            const parentRoutePlaces = (() => {
                const places = [];
                const fromLoc = String(t.fromLocation || '').trim();
                const toLoc = String(t.toLocation || '').trim();
                if (fromLoc) places.push(fromLoc);
                stops.forEach((s) => {
                    const v = String(s || '').trim();
                    if (v) places.push(v);
                });
                if (toLoc) places.push(toLoc);
                return places;
            })();

            // Pre každý segment (from → to)
            for (let i = 0; i < route.length - 1; i++) {
                const fromLoc = String(route[i] || '').trim();
                const toLoc = String(route[i + 1] || '').trim();
                if (!fromLoc || !toLoc) continue;
                if (normalizePlaceName(fromLoc) === normalizePlaceName(toLoc)) continue;

                // Nájdi zodpovedajúci segment v parent.segments
                const segIdx = findSegmentIndex(parentSegments, fromLoc, toLoc);
                const seg = segIdx !== -1 ? parentSegments[segIdx] : null;

                const isWalking = !!(seg && seg.isWalking === true);
                const hasRealTimes = !!(seg && seg.startTs != null && seg.endTs != null && seg.endTs > seg.startTs);
                const busId = seg && seg.busId ? String(seg.busId) : null;
                const busName = busId
                    ? (buses.find((b) => b.id === busId)?.name || `Bus ${busId}`)
                    : null;

                // Zisti čas pre tento segment
                let startTs = null;
                let endTs = null;
                let timeLabel = '';

                if (isWalking) {
                    // Peší segment – žiadne časy
                    timeLabel = 'PEŠI';
                } else if (hasRealTimes) {
                    startTs = seg.startTs;
                    endTs = seg.endTs;
                    const startTime = /(\d{2}:\d{2})$/.exec(formatTsLocal(startTs) || '')?.[1] || '';
                    const endTime = /(\d{2}:\d{2})$/.exec(formatTsLocal(endTs) || '')?.[1] || '';
                    timeLabel = `${startTime} – ${endTime}`;
                } else {
                    // Nepriradený segment – skús provizórny interval
                    try {
                        const provisional = computeProvisionalSegmentRange({
                            ...t,
                            fromLocation: fromLoc,
                            toLocation: toLoc,
                            _parentKey: t.key,
                        });
                        if (provisional && provisional.startTs != null) {
                            const startTime = /(\d{2}:\d{2})$/.exec(formatTsLocal(provisional.startTs) || '')?.[1] || '';
                            const endTime = provisional.endTs != null
                                ? /(\d{2}:\d{2})$/.exec(formatTsLocal(provisional.endTs) || '')?.[1] || ''
                                : '';
                            timeLabel = endTime ? `${startTime} – ${endTime}` : startTime;
                        }
                    } catch (e) { /* ignore */ }
                    if (!timeLabel) timeLabel = 'nepriradený';
                }

                // Zisti dayKey pre zoskupenie
                let dayKey = t.dayKey || null;
                if (!dayKey) {
                    if (startTs != null) {
                        const d = new Date(startTs);
                        dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    } else if (parentWhenRange && parentWhenRange.startTs != null) {
                        const d = new Date(parentWhenRange.startTs);
                        dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    } else if (t.when) {
                        const m = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(String(t.when));
                        if (m) {
                            const d = String(m[1]).padStart(2, '0');
                            const mo = String(m[2]).padStart(2, '0');
                            const y = m[3];
                            dayKey = `${y}-${mo}-${d}`;
                        }
                    }
                }

                // Pre zoradenie použijeme startTs, inak parentRange.startTs,
                // inak Number.POSITIVE_INFINITY
                const sortTs = startTs != null
                    ? startTs
                    : (parentWhenRange && parentWhenRange.startTs != null ? parentWhenRange.startTs : Number.POSITIVE_INFINITY);

                const routeLabel = `${fromLoc} → ${toLoc}`;

                events.push({
                    ts: sortTs,
                    startTs: startTs,
                    endTs: endTs,
                    when: timeLabel,
                    type: 'transfer',
                    text: `Presun: ${routeLabel}${busName ? ` (${busName})` : ''}`,
                    location: null,
                    // NOVÉ: samostatné príznaky pre ikonu
                    _isAssigned: hasRealTimes,
                    _isWalking: isWalking,
                    _busName: busName,
                    _routeLabel: routeLabel,
                    _fromLocation: fromLoc,
                    _toLocation: toLoc,
                    _dayKey: dayKey,
                    _isTransferRow: true,  // príznak pre oranžové zafarbenie
                    _routePlaces: parentRoutePlaces,
                });
            }
        });

        // Zoraď podľa ts
        events.sort((a, b) => {
            if (a.ts !== b.ts) return a.ts - b.ts;
            return String(a.text).localeCompare(String(b.text), 'sk');
        });

        return events;
    };

    // ============================================================
    // RENDER – box pre pešie presuny (zobrazí sa vedľa autobusov)
    //
    // NOVÉ PRAVIDLÁ:
    //  - Pešie segmenty NEMAJÚ časy v DB (startTs/endTs = null).
    //  - Ich časy sa počítajú DYNAMICKY pri renderi z okolitých
    //    bus segmentov:
    //      startTs = endTs predchádzajúceho bus segmentu
    //      endTs   = startTs nasledujúceho bus segmentu
    //  - Ak nie je predchádzajúci bus → startTs = null
    //  - Ak nie je nasledujúci bus → endTs = null
    //  - Ak nie je ani jeden → riadok sa nezobrazí (nemá čo ukázať)
    //  - Pešie segmenty sú VŽDY súčasťou parent záznamu
    //    (parent.intermediateStops + segments s isWalking: true)
    // ============================================================
    const renderWalkingTransfersBox = () => {
        // ============================================================
        // 1) ZBER PEŠÍCH SEGMENTOV Z PARENT ZÁZNAMOV
        //
        // Pre každý parent záznam:
        //  - Ak je celý parent walking (isWalking: true, bez stops)
        //    → jeden walking segment (fromLocation → toLocation)
        //  - Ak má parent intermediateStops a niektoré segments majú
        //    isWalking: true → rozlož na walking segmenty v pamäti
        // ============================================================
        const walkingTransfers = [];

        savedTransfers.forEach((t) => {
            if (selectedDayKey && t.dayKey !== selectedDayKey) return;
            // === NOVÉ: Filter podľa kategórie ===
            if (selectedCategoryFilter && cleanCategory(t.category || '') !== cleanCategory(selectedCategoryFilter)) return;
    
            const stops = Array.isArray(t.intermediateStops) ? t.intermediateStops : [];
            const segments = Array.isArray(t.segments) ? t.segments : [];
    
            // ------------------------------------------------------------
            // A) Celý parent je walking (bez medzizastávok)
            // ------------------------------------------------------------
            if (t.isWalking === true && stops.length === 0) {
                walkingTransfers.push({
                    ...t,
                    _displayFromLocation: t.fromLocation,
                    _displayToLocation: t.toLocation,
                    _segmentIndex: -1,
                });
                return;
            }
    
            // ------------------------------------------------------------
            // B) Parent s medzizastávkami – rozlož na walking segmenty
            // ------------------------------------------------------------
            if (stops.length > 0 && segments.length > 0) {
                // Zostav route (parent.fromLocation → stops → parent.toLocation)
                const routeRaw = [t.fromLocation, ...stops, t.toLocation].filter(Boolean);
                const route = [];
                routeRaw.forEach((loc) => {
                    const normalized = normalizePlaceName(loc);
                    if (route.length === 0 || normalizePlaceName(route[route.length - 1]) !== normalized) {
                        route.push(loc);
                    }
                });
    
                // Prejdi segments a nájdi walking
                segments.forEach((seg, segIdx) => {
                    if (seg.isWalking !== true) return;
                    if (segIdx < 0 || segIdx >= route.length - 1) return;
    
                    const fromLoc = route[segIdx];
                    const toLoc = route[segIdx + 1];
    
                    walkingTransfers.push({
                        ...t,
                        key: `${t.key}||walking||${segIdx}`,
                        fromLocation: fromLoc,
                        toLocation: toLoc,
                        text: `Presun z ${fromLoc} do ${toLoc}`,
                        isWalking: true,
                        _parentKey: t.key,
                        _parentRoute: `${t.fromLocation} → ${t.toLocation}`,
                        _segmentIndex: segIdx,
                        _displayFromLocation: fromLoc,
                        _displayToLocation: toLoc,
                        intermediateStops: [],
                    });
                });
            }
        });
    
        // ============================================================
        // 2) POMOCNÉ FUNKCIE
        // ============================================================
    
        // Parsovanie "when" → { startTime, endTime } (pre fallback)
        const parseWhenRange = (when) => {
            if (!when) return null;
            const s = String(when);
            const regex = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/g;
            const found = [];
            let m;
            while ((m = regex.exec(s)) !== null) {
                const d = String(m[1]).padStart(2, '0');
                const mo = String(m[2]).padStart(2, '0');
                const y = m[3];
                const hh = m[4] != null ? String(m[4]).padStart(2, '0') : null;
                const mi = m[5] != null ? String(m[5]).padStart(2, '0') : null;
                found.push({
                    dayKey: `${y}-${mo}-${d}`,
                    label: `${d}. ${mo}. ${y}`,
                    time: (hh != null && mi != null) ? `${hh}:${mi}` : null,
                });
            }
            if (found.length === 0) return null;
            if (found.length === 1) {
                return { startTime: found[0].time, endTime: found[0].time };
            }
            return { startTime: found[0].time, endTime: found[1].time };
        };
    
        // Parsovanie textu "Presun z X do Y"
        const parseTransferText = (text) => {
            if (!text) return null;
            const m = /^Presun z (.+?) do (.+)$/.exec(String(text).trim());
            if (!m) return null;
            const normalizePlace = (str) => String(str)
                .replace(/\bubytovania\b/gi, 'ubytovňa')
                .replace(/\bubytovanie\b/gi, 'ubytovňa')
                .replace(/\bzastávky\b/gi, 'zastávka')
                .replace(/\bzastávok\b/gi, 'zastávka')
            return {
                from: normalizePlace(m[1].trim()),
                to: normalizePlace(m[2].trim()),
            };
        };
    
        // Získa názov dňa z dayKey (napr. "Piatok")
        const getDayNameFromDayKey = (dayKey) => {
            if (!dayKey) return '';
            const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
            if (!m) return '';
            const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
            if (isNaN(d.getTime())) return '';
            return d.toLocaleDateString('sk-SK', { weekday: 'long' });
        };
    
        const enrichedWalking = walkingTransfers.map((t) => {
            // ------------------------------------------------------------
            // A) Celý parent walking (bez medzizastávok) – nemá zmysel
            //    počítať z okolitých bus segmentov, patrí sem len ak má
            //    parent aspoň jeden bus segment (t.j. má intermediateStops).
            // ------------------------------------------------------------
            if (!t._parentKey) {
                return {
                    ...t,
                    when: null,
                    _displayStartTs: null,
                    _displayEndTs: null,
                    _displayRemainingMinutes: null,
                    _hasAnyBus: false,
                };
            }
        
            // ------------------------------------------------------------
            // B) Walking segment z parenta s medzizastávkami
            // ------------------------------------------------------------
            const parentKey = t._parentKey;
            const parent = savedTransfers.find((s) => s.key === parentKey);
        
            if (!parent) {
                return {
                    ...t,
                    when: null,
                    _displayStartTs: null,
                    _displayEndTs: null,
                    _displayRemainingMinutes: null,
                    _hasAnyBus: false,
                };
            }
        
            const parentSegments = Array.isArray(parent.segments) ? parent.segments : [];
            const segmentIndex = t._segmentIndex;
        
            // ============================================================
            // NOVÉ: Zisti celkový začiatok a koniec parent presunu.
            //  - Prednostne z parent.when (rozsah celého presunu)
            //  - Inak z reálnych časov segmentov (startTs / endTs)
            // ============================================================
            const parentRange = (() => {
                const parsed = parseWhenRangeToTs(parent.when);
                if (parsed && parsed.startTs != null && parsed.endTs != null) {
                    return { startTs: parsed.startTs, endTs: parsed.endTs };
                }
                let earliestStart = null;
                let latestEnd = null;
                parentSegments.forEach((s) => {
                    if (s.startTs != null && (earliestStart == null || s.startTs < earliestStart)) {
                        earliestStart = s.startTs;
                    }
                    if (s.endTs != null && (latestEnd == null || s.endTs > latestEnd)) {
                        latestEnd = s.endTs;
                    }
                });
                if (earliestStart != null && latestEnd != null) {
                    return { startTs: earliestStart, endTs: latestEnd };
                }
                return null;
            })();
        
            // ------------------------------------------------------------
            // Nájdi koniec predchádzajúceho segmentu (bus aj walking)
            // – berieme endTs, inak startTs
            // ------------------------------------------------------------
            let prevSegmentEndTs = null;
            for (let i = segmentIndex - 1; i >= 0; i--) {
                const seg = parentSegments[i];
                if (!seg) continue;
                if (seg.endTs != null) {
                    prevSegmentEndTs = seg.endTs;
                    break;
                }
                if (seg.startTs != null) {
                    prevSegmentEndTs = seg.startTs;
                    break;
                }
            }
        
            // ------------------------------------------------------------
            // Nájdi začiatok nasledujúceho segmentu (bus aj walking)
            // – berieme startTs, inak endTs
            // ------------------------------------------------------------
            let nextSegmentStartTs = null;
            for (let i = segmentIndex + 1; i < parentSegments.length; i++) {
                const seg = parentSegments[i];
                if (!seg) continue;
                if (seg.startTs != null) {
                    nextSegmentStartTs = seg.startTs;
                    break;
                }
                if (seg.endTs != null) {
                    nextSegmentStartTs = seg.endTs;
                    break;
                }
            }
        
            // ============================================================
            // NOVÉ PRAVIDLÁ pre zobrazené časy:
            //
            //  - PRVÝ walking segment (segmentIndex === 0 alebo nemá
            //    predchádzajúci segment s časom):
            //      startTs = parentRange.startTs (začiatok celého presunu)
            //      endTs   = nextSegmentStartTs (začiatok nasledujúceho segmentu)
            //
            //  - POSLEDNÝ walking segment (segmentIndex === parentSegments.length - 1
            //    alebo nemá nasledujúci segment s časom):
            //      startTs = prevSegmentEndTs (koniec predchádzajúceho segmentu)
            //      endTs   = parentRange.endTs (koniec celého presunu)
            //
            //  - VNÚTORNÝ walking segment:
            //      startTs = prevSegmentEndTs
            //      endTs   = nextSegmentStartTs
            //
            // Ak chýba parentRange alebo príslušný sused, použije sa
            // fallback (null).
            // ============================================================
            const isFirstWalkingSegment =
                prevSegmentEndTs == null && parentRange && parentRange.startTs != null;
            const isLastWalkingSegment =
                nextSegmentStartTs == null && parentRange && parentRange.endTs != null;
        
            let displayStartTs = null;
            let displayEndTs = null;
        
            if (isFirstWalkingSegment) {
                displayStartTs = parentRange.startTs;
            } else if (prevSegmentEndTs != null) {
                displayStartTs = prevSegmentEndTs;
            }
        
            if (isLastWalkingSegment) {
                displayEndTs = parentRange.endTs;
            } else if (nextSegmentStartTs != null) {
                displayEndTs = nextSegmentStartTs;
            }
        
            // Ak ide o jediný walking segment v parentovi (parent má len
            // jeden segment a ten je walking), použijeme celý parent rozsah.
            if (
                parentSegments.length === 1 &&
                parentRange &&
                parentRange.startTs != null &&
                parentRange.endTs != null
            ) {
                displayStartTs = parentRange.startTs;
                displayEndTs = parentRange.endTs;
            }
        
            // ============================================================
            // Zostav when string
            // ============================================================
            let whenStr = null;
            if (displayStartTs != null && displayEndTs != null) {
                whenStr = `${formatTsLocal(displayStartTs)} – ${formatTsLocal(displayEndTs)}`;
            } else if (displayStartTs != null) {
                whenStr = formatTsLocal(displayStartTs);
            } else if (displayEndTs != null) {
                whenStr = formatTsLocal(displayEndTs);
            }
        
            // Zvyšný čas na presun (minúty)
            let remainingMinutes = null;
            if (
                displayStartTs != null &&
                displayEndTs != null &&
                displayEndTs > displayStartTs
            ) {
                remainingMinutes = Math.round((displayEndTs - displayStartTs) / 60000);
            }
        
            return {
                ...t,
                when: whenStr,
                _displayStartTs: displayStartTs,
                _displayEndTs: displayEndTs,
                _displayRemainingMinutes: remainingMinutes,
                _hasAnyBus: displayStartTs != null || displayEndTs != null,
            };
        });
    
        // ============================================================
        // 4) FILTRÁCIA – zobraz len tie, ktoré majú aspoň jeden bus čas
        // (inak by riadok nemal čo ukázať – žiadny čas)
        // ============================================================
        const filteredWalking = enrichedWalking.filter((t) => t._hasAnyBus === true);
    
        // ============================================================
        // 5) ZORADENIE podľa času začiatku (startTs), potom podľa tímu
        // ============================================================
        const sorted = [...filteredWalking].sort((a, b) => {
            const aStart = a._displayStartTs != null ? a._displayStartTs : Number.POSITIVE_INFINITY;
            const bStart = b._displayStartTs != null ? b._displayStartTs : Number.POSITIVE_INFINITY;
            if (aStart !== bStart) return aStart - bStart;
    
            const aTeam = String(a.teamName || '');
            const bTeam = String(b.teamName || '');
            return aTeam.localeCompare(bTeam, 'sk', { sensitivity: 'base' });
        });
    
        // ============================================================
        // 6) RENDER
        // ============================================================
        return React.createElement(
            'div',
            {
                className: 'bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden flex-shrink-0 pb-4',
                style: { width: '720px', maxWidth: '100%' }
            },
            // Hlavička
            React.createElement(
                'div',
                {
                    className: 'relative px-5 py-3 flex items-center justify-center text-white',
                    style: { backgroundColor: '#059669' }
                },
                React.createElement('i', { className: 'fa-solid fa-person-walking mr-2' }),
                React.createElement(
                    'h3',
                    { className: 'text-lg font-bold text-center' },
                    'Peši'
                ),
                React.createElement(
                    'span',
                    { className: 'absolute right-3 text-xs bg-white/20 rounded-full px-2 py-0.5' },
                    `${sorted.length}`
                )
            ),
            // Telo
            sorted.length === 0
                ? React.createElement(
                    'p',
                    { className: 'text-center text-gray-500 py-6 text-sm italic px-3' },
                    'Žiadne pešie presuny pre zvolený deň.'
                )
                : React.createElement(
                    'div',
                    { className: 'w-full' },
                    React.createElement(
                        'table',
                        { className: 'w-full border-collapse text-sm' },
                        React.createElement(
                            'tbody',
                            null,
                            (() => {
                                // ============================================================
                                // Zoskup walking segmenty podľa dňa
                                // ============================================================
                                const groupsByDay = new Map();
                                sorted.forEach((t) => {
                                    const dayKey = t.dayKey || '';
                                    if (!groupsByDay.has(dayKey)) groupsByDay.set(dayKey, []);
                                    groupsByDay.get(dayKey).push(t);
                                });
    
                                const sortedDayKeys = [...groupsByDay.keys()].sort();
    
                                const elements = [];
    
                                sortedDayKeys.forEach((dayKey, dayIdx) => {
                                    const items = groupsByDay.get(dayKey) || [];
    
                                    // ------------------------------------------------------------
                                    // 1) Riadok s dátumom
                                    // ------------------------------------------------------------
                                    const dateLabel = dayKey
                                        ? (formatDateDDMMYYYY(dayKey) || dayKey)
                                        : '—';
                                    const dayName = dayKey ? getDayNameFromDayKey(dayKey) : '';
                                    const capitalizedDayName = dayName
                                        ? dayName.charAt(0).toUpperCase() + dayName.slice(1)
                                        : '';
    
                                    elements.push(
                                        React.createElement(
                                            'tr',
                                            {
                                                key: `day-${dayKey || 'unknown'}`,
                                                className: dayIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                                            },
                                            React.createElement(
                                                'td',
                                                {
                                                    colSpan: 7,
                                                    className: 'border border-gray-200 px-4 py-2 text-gray-800 text-center text-sm'
                                                },
                                                capitalizedDayName &&
                                                    React.createElement(
                                                        'span',
                                                        { className: 'font-semibold capitalize' },
                                                        capitalizedDayName
                                                    ),
                                                capitalizedDayName &&
                                                    React.createElement(
                                                        'span',
                                                        { className: 'text-gray-500 mx-2' },
                                                        '–'
                                                    ),
                                                React.createElement(
                                                    'span',
                                                    null,
                                                    dateLabel
                                                )
                                            )
                                        )
                                    );
    
                                    // ------------------------------------------------------------
                                    // 2) Hlavička stĺpcov pre daný deň
                                    // ------------------------------------------------------------
                                    elements.push(
                                        React.createElement(
                                            'tr',
                                            {
                                                key: `header-${dayKey || 'unknown'}`,
                                                className: 'bg-gray-100 text-xs font-semibold text-gray-700'
                                            },
                                            React.createElement('th', { className: 'border border-gray-300 px-2 py-1', style: { width: '70px' } }, 'Od'),
                                            React.createElement('th', { className: 'border border-gray-300 px-2 py-1', style: { width: '70px' } }, 'Do'),
                                            React.createElement('th', { className: 'border border-gray-300 px-2 py-1', style: { width: '200px' } }, 'Miesto od'),
                                            React.createElement('th', { className: 'border border-gray-300 px-2 py-1', style: { width: '200px' } }, 'Miesto do'),
                                            React.createElement('th', { className: 'border border-gray-300 px-2 py-1' }, 'Tím'),
                                            React.createElement('th', { className: 'border border-gray-300 px-2 py-1', style: { width: '80px' } }, 'Min'),
                                            React.createElement('th', { className: 'border border-gray-300 px-2 py-1', style: { width: '36px' } }, '')
                                        )
                                    );
    
                                    // ------------------------------------------------------------
                                    // 3) Riadky s pešími presunmi pre daný deň
                                    // ------------------------------------------------------------
                                    items.forEach((t) => {
                                        const info = parseTransferText(t.text);
    
                                        // ============================================================
                                        // NOVÉ: Použi dynamicky vypočítané časy
                                        // (_displayStartTs / _displayEndTs), ktoré už
                                        // obsahujú časy z okolitých bus segmentov.
                                        // ============================================================
                                        let timeFrom = '';
                                        let timeTo = '';
    
                                        if (t._displayStartTs != null) {
                                            const startFmt = formatTsLocal(t._displayStartTs);
                                            const startTimeMatch = startFmt ? /(\d{2}:\d{2})$/.exec(startFmt) : null;
                                            if (startTimeMatch) timeFrom = startTimeMatch[1];
                                        }
                                        if (t._displayEndTs != null) {
                                            const endFmt = formatTsLocal(t._displayEndTs);
                                            const endTimeMatch = endFmt ? /(\d{2}:\d{2})$/.exec(endFmt) : null;
                                            if (endTimeMatch) timeTo = endTimeMatch[1];
                                        }
    
                                        const placeFrom = info?.from || t._displayFromLocation || '';
                                        const placeTo = info?.to || t._displayToLocation || '';
                                        const textColor = getCategoryTextColor(t.category);
    
                                        // Zvyšný čas
                                        const remainingMinutes = t._displayRemainingMinutes;
    
                                        elements.push(
                                            React.createElement(
                                                'tr',
                                                { key: t.key, className: 'hover:bg-gray-50' },
                                                // 1. čas od
                                                React.createElement(
                                                    'td',
                                                    { className: 'border border-gray-300 p-1 text-center text-sm font-semibold text-blue-700' },
                                                    timeFrom || '—'
                                                ),
                                                // 2. čas do
                                                React.createElement(
                                                    'td',
                                                    { className: 'border border-gray-300 p-1 text-center text-sm font-semibold text-blue-700' },
                                                    timeTo || '—'
                                                ),
                                                // 3. miesto od
                                                React.createElement(
                                                    'td',
                                                    { className: 'border border-gray-300 p-1 text-sm text-gray-800' },
                                                    placeFrom || '—'
                                                ),
                                                // 4. miesto do
                                                React.createElement(
                                                    'td',
                                                    { className: 'border border-gray-300 p-1 text-sm text-gray-800' },
                                                    placeTo || '—'
                                                ),
                                                // 5. tím (skratka alebo plný názov)
                                                React.createElement(
                                                    'td',
                                                    {
                                                        className: 'border border-gray-300 p-1 text-sm font-semibold align-middle whitespace-nowrap',
                                                        style: { color: textColor }
                                                    },
                                                    (() => {
                                                        const shortcut = getTeamShortcut(t.category, t.teamName);
                                                        return shortcut || t.teamName || '(neznámy tím)';
                                                    })()
                                                ),
                                                // 6. zvyšný čas na presun
                                                React.createElement(
                                                    'td',
                                                    {
                                                        className: 'border border-gray-300 p-1 text-center text-xs font-semibold',
                                                        style: { color: remainingMinutes != null ? '#b45309' : '#9ca3af' },
                                                        title: 'Zvyšný čas na presun (od konca predchádzajúceho busu po začiatok nasledujúceho busu)'
                                                    },
                                                    remainingMinutes != null ? `${remainingMinutes}` : '—'
                                                ),
                                                // 7. mazanie (X) – odstráni príznak „peši"
                                                React.createElement(
                                                    'td',
                                                    { className: 'border border-gray-300 p-1 text-center' },
                                                    React.createElement(
                                                        'button',
                                                        {
                                                            type: 'button',
                                                            onClick: () => setRemoveWalkingModal({ transfer: t }),
                                                            title: 'Odstrániť príznak „peši" (presun sa vráti medzi vygenerované)',
                                                            className: 'text-red-600 hover:text-red-800 hover:bg-red-50 rounded w-7 h-7 inline-flex items-center justify-center'
                                                        },
                                                        React.createElement('i', { className: 'fa-solid fa-xmark' })
                                                    )
                                                )
                                            )
                                        );
                                    });
                                });
    
                                return elements;
                            })()
                        )
                    )
                )
        );
    };
    
    // ============================================================
    // HLAVNÝ RENDER
    // ============================================================
    return React.createElement(
        'div',
        { className: 'w-full flex-1 flex flex-col' },
        // === ČERVENÝ PÁSIK – CHÝBAJÚCE TRVANIE JÁZDY ===
        missingTravelTimeWarning.length > 0 &&
            React.createElement(
                'div',
                {
                    className: 'fixed top-0 left-0 right-0 z-[99999] bg-red-600 text-white shadow-xl px-4 py-2 flex items-start gap-3',
                    role: 'alert'
                },
                React.createElement('i', {
                    className: 'fa-solid fa-triangle-exclamation text-xl mt-0.5 flex-shrink-0'
                }),
                React.createElement(
                    'div',
                    { className: 'flex-1 text-sm' },
                    React.createElement(
                        'div',
                        { className: 'font-bold mb-1' },
                        'Chýba trvanie jazdy autobusu medzi zastávkami:'
                    ),
                    React.createElement(
                        'ul',
                        { className: 'list-disc list-inside space-y-0.5' },
                        missingTravelTimeWarning.map((m, idx) =>
                            React.createElement(
                                'li',
                                { key: `${m.from}|${m.to}|${idx}` },
                                `Medzi zastávkami „${m.from}" a „${m.to}" nie je nastavené trvanie jazdy autobusu.`
                            )
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'mt-1 text-xs opacity-90 italic' },
                        'Nastavte trvanie v záložke „Nastavenia" → „Trvania jazdy medzi zastávkami".'
                    )
                )
            ),
        // === PÔVODNÝ OBSAH (bez ďalšieho obalenia) ===
        React.createElement(
            'div',
            {
                className: 'bg-white rounded-xl shadow-xl p-8 flex flex-col items-start justify-start w-max min-w-full transition-all duration-500'
            },
            React.createElement(
                'div',
                { className: 'w-full flex flex-col items-center mb-6' },
                React.createElement('h2', { className: 'text-3xl font-bold tracking-tight text-center mb-4' }, 'Doprava')
            ),
            React.createElement(
                'div',
                { className: 'w-full flex flex-wrap items-center justify-center gap-3 mb-6' },
                React.createElement(
                    'button',
                    {
                        onClick: () => setActiveView('planovanie'),
                        className: `px-5 py-2.5 rounded-lg font-medium border-2 transition-colors duration-200 flex items-center gap-2 ${
                            activeView === 'planovanie'
                                ? 'bg-green-600 text-white border-green-600 hover:bg-green-700'
                                : 'bg-white text-green-600 border-green-600 hover:bg-green-50'
                        }`
                    },
                    React.createElement('i', { className: 'fa-solid fa-calendar-days' }),
                    'Plánovanie'
                ),
                React.createElement(
                    'button',
                    {
                        onClick: () => setActiveView('nastavenia'),
                        className: `px-5 py-2.5 rounded-lg font-medium border-2 transition-colors duration-200 flex items-center gap-2 ${
                            activeView === 'nastavenia'
                                ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                                : 'bg-white text-blue-600 border-blue-600 hover:bg-blue-50'
                        }`
                    },
                    React.createElement('i', { className: 'fa-solid fa-gear' }),
                    'Nastavenia'
                )
            ),
            // === SELECTBOXY (AUTOBUS, KATEGÓRIA, DEŇ) – len v režime Plánovanie ===
            activeView === 'planovanie' && React.createElement(
                'div',
                { className: 'w-full flex flex-wrap items-center justify-center gap-3 mb-6' },
            
                // === 1. SELECTBOX PRE AUTOBUS ===
                React.createElement(
                    'select',
                    {
                        value: selectedBusId,
                        onChange: (e) => setSelectedBusId(e.target.value),
                        disabled: buses.length === 0,
                        className: 'px-4 py-2 rounded-lg border-2 border-gray-300 bg-white text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed'
                    },
                    React.createElement('option', { value: '' }, 'Všetky autobusy'),
                    buses.map((bus) =>
                        React.createElement(
                            'option',
                            { key: bus.id, value: bus.id },
                            bus.name
                        )
                    )
                ),
            
                // === 2. SELECTBOX PRE KATEGÓRIU ===
                React.createElement(
                    'select',
                    {
                        value: selectedCategoryFilter,
                        onChange: (e) => setSelectedCategoryFilter(e.target.value),
                        disabled: getAvailableCategories().length === 0,
                        className: 'px-4 py-2 rounded-lg border-2 border-gray-300 bg-white text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed'
                    },
                    React.createElement('option', { value: '' }, 'Všetky kategórie'),
                    getAvailableCategories().map((cat) =>
                        React.createElement(
                            'option',
                            { key: cat, value: cat },
                            cat
                        )
                    )
                ),
            
                // === 3. SELECTBOX PRE DEŇ ===
                React.createElement(
                    'select',
                    {
                        value: selectedDayKey,
                        onChange: (e) => setSelectedDayKey(e.target.value),
                        disabled: tournamentDays.length === 0,
                        className: 'px-4 py-2 rounded-lg border-2 border-gray-300 bg-white text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed'
                    },
                    React.createElement('option', { value: '' }, 'Všetky dni'),
                    tournamentDays.map((day) =>
                        React.createElement(
                            'option',
                            { key: day.dayKey, value: day.dayKey },
                            `${day.dayName.charAt(0).toUpperCase() + day.dayName.slice(1)} – ${day.dateLabel}`
                        )
                    )
                )
            ),
            React.createElement(
                'div',
                { className: 'w-full flex-1' },
                activeView === 'nastavenia'
                    ? React.createElement(
                        'div',
                        { className: 'w-full' },
                        // NOVÉ: Prepínač záložiek Nastavení
                        React.createElement(
                            'div',
                            { className: 'flex flex-wrap items-center justify-center gap-3 mb-6' },
                            React.createElement(
                                'button',
                                {
                                    type: 'button',
                                    onClick: () => setSettingsTab('travelTimes'),
                                    className: `px-4 py-2 rounded-lg font-medium border-2 transition-colors duration-200 flex items-center gap-2 ${
                                        settingsTab === 'travelTimes'
                                            ? 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700'
                                            : 'bg-white text-purple-600 border-purple-600 hover:bg-purple-50'
                                    }`
                                },
                                React.createElement('i', { className: 'fa-solid fa-clock' }),
                                'Trvania jazdy medzi zastávkami'
                            ),
                            React.createElement(
                                'button',
                                {
                                    type: 'button',
                                    onClick: () => setSettingsTab('teamShortcuts'),
                                    className: `px-4 py-2 rounded-lg font-medium border-2 transition-colors duration-200 flex items-center gap-2 ${
                                        settingsTab === 'teamShortcuts'
                                            ? 'bg-orange-600 text-white border-orange-600 hover:bg-orange-700'
                                            : 'bg-white text-orange-600 border-orange-600 hover:bg-orange-50'
                                    }`
                                },
                                React.createElement('i', { className: 'fa-solid fa-tag' }),
                                'Skratky názvov tímov'
                            )
                        ),
                        // NOVÉ: Obsah podľa zvolenej záložky
                        settingsTab === 'travelTimes'
                            ? React.createElement(
                                'div',
                                { className: 'w-full' },
                                React.createElement(
                                    'div',
                                    { className: 'flex items-center justify-between mb-4 pb-3 border-b border-gray-200' },
                                    React.createElement('h3', { className: 'text-xl font-semibold text-gray-700' }, 'Trvania jazdy medzi zastávkami'),
                                    React.createElement('span', { className: 'text-sm text-gray-500' }, `Zastávok: ${stopsList.length}`)
                                ),
                                renderTravelTimes()
                            )
                            : React.createElement(
                                'div',
                                { className: 'w-full' },
                                React.createElement(
                                    'div',
                                    { className: 'flex items-center justify-between mb-4 pb-3 border-b border-gray-200' },
                                    React.createElement('h3', { className: 'text-xl font-semibold text-gray-700' }, 'Skratky názvov tímov'),
                                    React.createElement(
                                        'span',
                                        { className: 'text-sm text-gray-500' },
                                        `Definovaných skratiek: ${Object.keys(teamShortcuts).length}`
                                    )
                                ),
                                renderTeamShortcuts()
                            )
                    )
                    : renderPlanning()
            ),
        ),
        activeView === 'planovanie' && React.createElement(
            'div',
            {
                className: 'fixed bottom-8 right-8 z-[9999]',
                style: {
                    filter: 'drop-shadow(0 10px 15px rgba(0,0,0,0.2))',
                    width: '64px',
                    height: '64px'
                }
            },
            // === ZELENÁ POLOVICA (hore/ľavá) – Vygenerovať presuny ===
            React.createElement(
                'div',
                {
                    className: 'absolute rounded-full overflow-hidden',
                    style: {
                        width: '64px',
                        height: '64px',
                        clipPath: 'polygon(0 0, 100% 0, 0 100%)',
                        top: 0,
                        left: 0
                    }
                },
                React.createElement(
                    'button',
                    {
                        onClick: () => {
                            const cats = getAvailableCategories();
                            if (cats.length === 0) {
                                window.showGlobalNotification('Nie sú dostupné žiadne kategórie.', 'error');
                                return;
                            }
                            setShowTransferTypeModal(true);
                        },
                        className: 'w-full h-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 transition-all duration-200 outline-none ring-0 focus:outline-none focus:ring-0',
                        title: 'Vygenerovať presuny'
                    },
                    React.createElement(
                        'div',
                        {
                            style: {
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '100%',
                                height: '100%',
                                position: 'relative'
                            }
                        },
                        React.createElement('i', {
                            className: 'fa-solid fa-plus text-2xl text-white',
                            style: {
                                position: 'absolute',
                                top: '30%',
                                left: '30%',
                                transform: 'translate(-50%, -50%)'
                            }
                        })
                    )
                )
            ),
            // === ČERVENÁ POLOVICA (dole/pravá) – Zmazať presuny ===
            React.createElement(
                'div',
                {
                    className: 'absolute rounded-full overflow-hidden',
                    style: {
                        width: '64px',
                        height: '64px',
                        clipPath: 'polygon(100% 0, 100% 100%, 0 100%)',
                        top: 0,
                        left: 0
                    }
                },
                React.createElement(
                    'button',
                    {
                        onClick: () => {
                            const cats = getAvailableCategories();
                            if (cats.length === 0) {
                                window.showGlobalNotification('Nie sú dostupné žiadne kategórie.', 'error');
                                return;
                            }
                            setSelectedCategoryForDelete(cats[0]);
                            setShowDeleteTransfersModal(true);
                        },
                        className: 'w-full h-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 transition-all duration-200 outline-none ring-0 focus:outline-none focus:ring-0',
                        title: 'Zmazať presuny'
                    },
                    React.createElement(
                        'div',
                        {
                            style: {
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '100%',
                                height: '100%',
                                position: 'relative'
                            }
                        },
                        React.createElement('i', {
                            className: 'fa-solid fa-minus text-2xl text-white',
                            style: {
                                position: 'absolute',
                                bottom: '30%',
                                right: '30%',
                                transform: 'translate(50%, 50%)'
                            }
                        })
                    )
                )
            )
        ),
        confirmModal && React.createElement(
            'div',
            {
                className: 'fixed inset-0 bg-black/50 flex items-center justify-center z-[100000] p-4',
                onClick: () => closeConfirmModal(false)
            },
            React.createElement(
                'div',
                {
                    className: 'bg-white rounded-xl shadow-2xl max-w-md w-full p-6',
                    onClick: (e) => e.stopPropagation()
                },
                React.createElement(
                    'div',
                    { className: 'flex items-start gap-3 mb-4' },
                    React.createElement('i', {
                        className: 'fa-solid fa-circle-question text-blue-600 text-2xl mt-0.5'
                    }),
                    React.createElement(
                        'h3',
                        { className: 'text-lg font-semibold text-gray-800' },
                        'Potvrdenie'
                    )
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-700 mb-6 whitespace-pre-line' },
                    confirmModal.message
                ),
                React.createElement(
                    'div',
                    { className: 'flex justify-end gap-3' },
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: () => closeConfirmModal(false),
                            className: 'px-4 py-2 rounded-lg border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors'
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: () => closeConfirmModal(true),
                            className: 'px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors'
                        },
                        'Potvrdiť'
                    )
                )
            )
        ),
        // ============================================================
        // NOVÉ: MODÁLNE OKNO – Výber typu zastávky (nástupná/výstupná alebo miesto zrazu)
        // ============================================================
        stopTypeModal && React.createElement(
            'div',
            {
                className: 'fixed inset-0 bg-black/50 flex items-center justify-center z-[100000] p-4',
                onClick: () => setStopTypeModal(null)
            },
            React.createElement(
                'div',
                {
                    className: 'bg-white rounded-xl shadow-2xl max-w-md w-full p-6',
                    onClick: (e) => e.stopPropagation()
                },
                React.createElement(
                    'div',
                    { className: 'flex items-start gap-3 mb-4' },
                    React.createElement('i', {
                        className: 'fa-solid fa-bus text-blue-600 text-2xl mt-0.5'
                    }),
                    React.createElement(
                        'h3',
                        { className: 'text-lg font-semibold text-gray-800' },
                        'Nastaviť typ zastávky'
                    )
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-700 mb-4 text-sm' },
                    `Zastávka: „${stopTypeModal.stop.name}"`
                ),
                React.createElement(
                    'div',
                    { className: 'space-y-2 mb-4' },
                    // 1) Nástupná/výstupná
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            disabled: stopTypeModal.stop.isExternalArrivalStop === true,
                            onClick: async () => {
                                const stop = stopTypeModal.stop;
                                setStopTypeModal(null);
                                const ok = await askConfirm(
                                    `Nastaviť zastávku „${stop.name}" ako nástupnú/výstupnú pre externé tímy?`
                                );
                                if (!ok) return;
                                setExternalArrivalStop(stop.id);
                            },
                            className: `w-full text-left px-4 py-3 rounded-lg border-2 transition-colors flex items-center gap-3 ${
                                stopTypeModal.stop.isExternalArrivalStop === true
                                    ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                                    : 'border-amber-200 bg-amber-50 hover:bg-amber-100'
                            }`
                        },
                        React.createElement('i', { className: 'fa-solid fa-right-to-bracket text-amber-600 text-xl w-6 text-center' }),
                        React.createElement(
                            'div',
                            { className: 'flex-1' },
                            React.createElement('div', { className: 'font-semibold text-gray-800' }, 'Nástupná/výstupná zastávka'),
                            React.createElement(
                                'div',
                                { className: 'text-xs text-gray-500' },
                                stopTypeModal.stop.isExternalArrivalStop === true
                                    ? 'Táto zastávka je už nastavená ako nástupná/výstupná.'
                                    : 'Pre externé tímy (príchod/odchod).'
                            )
                        )
                    ),
                    // 2) Miesto zrazu
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            disabled: stopTypeModal.stop.isMeetingPointStop === true,
                            onClick: async () => {
                                const stop = stopTypeModal.stop;
                                setStopTypeModal(null);
                                const ok = await askConfirm(
                                    `Nastaviť zastávku „${stop.name}" ako miesto zrazu?`
                                );
                                if (!ok) return;
                                setMeetingPointStop(stop.id);
                            },
                            className: `w-full text-left px-4 py-3 rounded-lg border-2 transition-colors flex items-center gap-3 ${
                                stopTypeModal.stop.isMeetingPointStop === true
                                    ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                                    : 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100'
                            }`
                        },
                        React.createElement('i', { className: 'fa-solid fa-people-group text-emerald-600 text-xl w-6 text-center' }),
                        React.createElement(
                            'div',
                            { className: 'flex-1' },
                            React.createElement('div', { className: 'font-semibold text-gray-800' }, 'Miesto zrazu'),
                            React.createElement(
                                'div',
                                { className: 'text-xs text-gray-500' },
                                stopTypeModal.stop.isMeetingPointStop === true
                                    ? 'Táto zastávka je už nastavená ako miesto zrazu.'
                                    : 'Miesto, kde sa tím/tímy stretávajú.'
                            )
                        )
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'flex justify-end' },
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: () => setStopTypeModal(null),
                            className: 'px-4 py-2 rounded-lg border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors'
                        },
                        'Zatvoriť'
                    )
                )
            )
        ),
        // ============================================================
        // MODÁLNE OKNO – Zmazať presuny pre kategóriu
        // ============================================================
        showDeleteTransfersModal && React.createElement(
            'div',
            {
                className: 'fixed inset-0 bg-black/50 flex items-center justify-center z-[100000] p-4',
                onClick: () => setShowDeleteTransfersModal(false)
            },
            React.createElement(
                'div',
                {
                    className: 'bg-white rounded-xl shadow-2xl max-w-md w-full p-6',
                    onClick: (e) => e.stopPropagation()
                },
                React.createElement(
                    'div',
                    { className: 'flex items-start gap-3 mb-4' },
                    React.createElement('i', {
                        className: 'fa-solid fa-trash-can text-red-600 text-2xl mt-0.5'
                    }),
                    React.createElement(
                        'h3',
                        { className: 'text-lg font-semibold text-gray-800' },
                        'Zmazať presuny'
                    )
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-700 mb-4 text-sm' },
                    'Vyberte kategóriu, pre ktorú sa majú zmazať všetky vygenerované presuny z databázy.'
                ),
                React.createElement(
                    'label',
                    { className: 'block text-sm font-medium text-gray-700 mb-1' },
                    'Kategória'
                ),
                React.createElement(
                    'select',
                    {
                        value: selectedCategoryForDelete,
                        onChange: (e) => setSelectedCategoryForDelete(e.target.value),
                        className: 'w-full px-4 py-2 rounded-lg border-2 border-gray-300 bg-white text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors mb-4'
                    },
                    getAvailableCategories().map((cat) =>
                        React.createElement(
                            'option',
                            { key: cat, value: cat },
                            cat
                        )
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'mb-4 p-3 bg-red-50 border border-red-200 rounded-lg' },
                    React.createElement(
                        'p',
                        { className: 'text-xs text-red-600 flex items-center gap-2' },
                        React.createElement('i', { className: 'fa-solid fa-exclamation-triangle' }),
                        'Táto akcia je nenávratná. Všetky presuny pre vybranú kategóriu budú natrvalo odstránené z databázy.'
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'flex justify-end gap-3' },
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: () => setShowDeleteTransfersModal(false),
                            className: 'px-4 py-2 rounded-lg border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors'
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: async () => {
                                const cat = selectedCategoryForDelete;
                                if (!cat) {
                                    window.showGlobalNotification('Najprv vyberte kategóriu.', 'error');
                                    return;
                                }
                                await deleteTransfers({ categoryName: cat });
                                setShowDeleteTransfersModal(false);
                            },
                            className: 'px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors'
                        },
                        'Zmazať presuny'
                    )
                )
            )
        ),
        showCategoryModal && React.createElement(
            'div',
            {
                className: 'fixed inset-0 bg-black/50 flex items-center justify-center z-[100000] p-4',
                onClick: () => setShowCategoryModal(false)
            },
            React.createElement(
                'div',
                {
                    className: 'bg-white rounded-xl shadow-2xl max-w-md w-full p-6',
                    onClick: (e) => e.stopPropagation()
                },
                React.createElement(
                    'div',
                    { className: 'flex items-start gap-3 mb-4' },
                    React.createElement('i', {
                        className: 'fa-solid fa-list-check text-green-600 text-2xl mt-0.5'
                    }),
                    React.createElement(
                        'h3',
                        { className: 'text-lg font-semibold text-gray-800' },
                        'Vygenerovať presuny'
                    )
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-700 mb-4 text-sm' },
                    'Vyberte kategóriu, pre ktorú sa majú vygenerovať presuny.'
                ),
                React.createElement(
                    'label',
                    { className: 'block text-sm font-medium text-gray-700 mb-1' },
                    'Kategória'
                ),
                React.createElement(
                    'select',
                    {
                        value: selectedCategoryForTimeline,
                        onChange: (e) => setSelectedCategoryForTimeline(e.target.value),
                        className: 'w-full px-4 py-2 rounded-lg border-2 border-gray-300 bg-white text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors mb-6'
                    },
                    getAvailableCategories().map((cat) =>
                        React.createElement(
                            'option',
                            { key: cat, value: cat },
                            cat
                        )
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'flex justify-end gap-3' },
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: () => setShowCategoryModal(false),
                            className: 'px-4 py-2 rounded-lg border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors'
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: async () => {
                                const cat = selectedCategoryForTimeline;
                                if (!cat) {
                                    window.showGlobalNotification('Najprv vyberte kategóriu.', 'error');
                                    return;
                                }
                            
                                const existingForCat = savedTransfers.filter(
                                    (t) => cleanCategory(t.category || '') === cleanCategory(cat)
                                );
                            
                                if (existingForCat.length > 0) {
                                    setRegenTransfersModal({
                                        category: cat,
                                        existingCount: existingForCat.length,
                                    });
                                    setShowCategoryModal(false);
                                    return;
                                }
                            
                                timelineGenerationRequestedRef.current = true;
                                rebuildAndLogTimeline(true, cat);
                                setShowCategoryModal(false);
                                window.showGlobalNotification(
                                    `Časová os pre kategóriu ${cat} bola vygenerovaná.`,
                                    'success'
                                );
                            },
                            className: 'px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition-colors'
                        },
                        'Vygenerovať'
                    )
                )
            )
        ),
        // ============================================================
        // NOVÉ: MODÁLNE OKNO – Výber typu presunu
        // (po kliknutí na zelené "+")
        // ============================================================
        showTransferTypeModal && React.createElement(
            'div',
            {
                className: 'fixed inset-0 bg-black/50 flex items-center justify-center z-[100001] p-4',
                onClick: () => setShowTransferTypeModal(false)
            },
            React.createElement(
                'div',
                {
                    className: 'bg-white rounded-xl shadow-2xl max-w-md w-full p-6',
                    onClick: (e) => e.stopPropagation()
                },
                React.createElement(
                    'div',
                    { className: 'flex items-start gap-3 mb-4' },
                    React.createElement('i', {
                        className: 'fa-solid fa-plus text-green-600 text-2xl mt-0.5'
                    }),
                    React.createElement(
                        'h3',
                        { className: 'text-lg font-semibold text-gray-800' },
                        'Vyberte typ presunu'
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'space-y-2 mb-4' },
                    // 1) Generovanie potrebných presunov
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: () => {
                                setShowTransferTypeModal(false);
                                const cats = getAvailableCategories();
                                if (cats.length === 0) {
                                    window.showGlobalNotification('Nie sú dostupné žiadne kategórie.', 'error');
                                    return;
                                }
                                setSelectedCategoryForTimeline(cats[0]);
                                setShowCategoryModal(true);
                            },
                            className: 'w-full text-left px-4 py-3 rounded-lg border-2 border-green-200 bg-green-50 hover:bg-green-100 transition-colors flex items-center gap-3'
                        },
                        React.createElement('i', { className: 'fa-solid fa-wand-magic-sparkles text-green-600 text-xl w-6 text-center' }),
                        React.createElement(
                            'div',
                            { className: 'flex-1' },
                            React.createElement('div', { className: 'font-semibold text-gray-800' }, 'Generovanie potrebných presunov'),
                            React.createElement('div', { className: 'text-xs text-gray-500' }, 'Automaticky vygeneruje presuny z časovej osi')
                        )
                    ),
                    // 2) Vytvoriť vlastný presun
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: () => {
                                setShowTransferTypeModal(false);
                                const cats = getAvailableCategories();
                                setCustomTransferCategory(cats.length > 0 ? cats[0] : '');
                                setCustomTransferTeamName('');
                                setShowCustomTransferModal(true);
                            },
                            className: 'w-full text-left px-4 py-3 rounded-lg border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors flex items-center gap-3'
                        },
                        React.createElement('i', { className: 'fa-solid fa-pen-to-square text-blue-600 text-xl w-6 text-center' }),
                        React.createElement(
                            'div',
                            { className: 'flex-1' },
                            React.createElement('div', { className: 'font-semibold text-gray-800' }, 'Vytvoriť vlastný presun'),
                            React.createElement('div', { className: 'text-xs text-gray-500' }, 'Manuálne zadáte trasu a čas presunu')
                        )
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'flex justify-end' },
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: () => setShowTransferTypeModal(false),
                            className: 'px-4 py-2 rounded-lg border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors'
                        },
                        'Zrušiť'
                    )
                )
            )
        ),
        // ============================================================
        // NOVÉ: MODÁLNE OKNO – Vytvoriť vlastný presun
        // ============================================================
        showCustomTransferModal && (() => {
            // Zoznam tímov v zvolenej kategórii (z users + superstructure)
            const teamsInCategory = (() => {
                const cat = cleanCategory(customTransferCategory);
                if (!cat) return [];
                const set = new Set();
                (teamsArrivalBufferRef.current || []).forEach((t) => {
                    if (cleanCategory(t.category) !== cat) return;
                    if (!t.teamName) return;
                    set.add(String(t.teamName).trim());
                });
                return [...set].sort((a, b) => a.localeCompare(b, 'sk', { sensitivity: 'base' }));
            })();
        
            // Udalosti zvoleného tímu
            const teamEvents = customTransferTeamName
                ? getTeamEventsForCustomTransfer(customTransferCategory, customTransferTeamName)
                : [];
        
            return React.createElement(
                'div',
                {
                    className: 'fixed inset-0 bg-black/50 flex items-center justify-center z-[100002] p-4',
                    onClick: () => setShowCustomTransferModal(false)
                },
                React.createElement(
                    'div',
                    {
                        className: 'bg-white rounded-xl shadow-2xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto',
                        onClick: (e) => e.stopPropagation()
                    },
                    React.createElement(
                        'div',
                        { className: 'flex items-start gap-3 mb-4' },
                        React.createElement('i', {
                            className: 'fa-solid fa-pen-to-square text-blue-600 text-2xl mt-0.5'
                        }),
                        React.createElement(
                            'div',
                            { className: 'flex-1' },
                            React.createElement(
                                'h3',
                                { className: 'text-lg font-semibold text-gray-800' },
                                'Vytvoriť vlastný presun'
                            ),
                            React.createElement(
                                'p',
                                { className: 'text-xs text-gray-500 mt-0.5' },
                                'Zvoľte kategóriu a tím. Zobrazí sa zoznam udalostí tímu.'
                            )
                        )
                    ),
                    // Selectbox kategórie
                    React.createElement(
                        'label',
                        { className: 'block text-sm font-medium text-gray-700 mb-1' },
                        'Kategória'
                    ),
                    React.createElement(
                        'select',
                        {
                            value: customTransferCategory,
                            onChange: (e) => {
                                setCustomTransferCategory(e.target.value);
                                setCustomTransferTeamName('');
                            },
                            className: 'w-full px-4 py-2 rounded-lg border-2 border-gray-300 bg-white text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors mb-4'
                        },
                        React.createElement('option', { value: '' }, '— vyber kategóriu —'),
                        getAvailableCategories().map((cat) =>
                            React.createElement(
                                'option',
                                { key: cat, value: cat },
                                cat
                            )
                        )
                    ),
                    // Selectbox tímu
                    React.createElement(
                        'label',
                        { className: 'block text-sm font-medium text-gray-700 mb-1' },
                        'Tím'
                    ),
                    React.createElement(
                        'select',
                        {
                            value: customTransferTeamName,
                            onChange: (e) => setCustomTransferTeamName(e.target.value),
                            disabled: !customTransferCategory || teamsInCategory.length === 0,
                            className: 'w-full px-4 py-2 rounded-lg border-2 border-gray-300 bg-white text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors mb-4 disabled:opacity-60 disabled:cursor-not-allowed'
                        },
                        React.createElement('option', { value: '' }, '— vyber tím —'),
                        teamsInCategory.map((tn) =>
                            React.createElement(
                                'option',
                                { key: tn, value: tn },
                                tn
                            )
                        )
                    ),
                    // Zoznam udalostí tímu – prehľadne zoskupený podľa dní
                    customTransferTeamName && React.createElement(
                        'div',
                        { className: 'mb-4' },
                        React.createElement(
                            'div',
                            { className: 'text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2' },
                            React.createElement('i', { className: 'fa-solid fa-list-ul text-blue-600' }),
                            'Udalosti tímu:',
                            React.createElement(
                                'span',
                                { className: 'text-xs font-normal text-gray-500' },
                                `(${teamEvents.length})`
                            )
                        ),
                        teamEvents.length === 0
                            ? React.createElement(
                                'p',
                                { className: 'text-xs text-gray-400 italic px-1' },
                                'Tím nemá žiadne udalosti.'
                            )
                            : (() => {
                                // ------------------------------------------------------------
                                // Pomocná: z "when" vytiahne dayKey (YYYY-MM-DD)
                                // ------------------------------------------------------------
                                const extractDayKey = (when) => {
                                    if (!when) return null;
                                    const m = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(String(when));
                                    if (!m) return null;
                                    const d = String(m[1]).padStart(2, '0');
                                    const mo = String(m[2]).padStart(2, '0');
                                    const y = m[3];
                                    return `${y}-${mo}-${d}`;
                                };
                    
                                // ------------------------------------------------------------
                                // Pomocná: z "when" vytiahne iba časť s časom (HH:MM – HH:MM)
                                // ------------------------------------------------------------
                                const extractTimeLabel = (when) => {
                                    if (!when) return '';
                                    const s = String(when);
                                    const times = [];
                                    const regex = /(\d{1,2}):(\d{2})/g;
                                    let m;
                                    while ((m = regex.exec(s)) !== null) {
                                        times.push(`${String(m[1]).padStart(2, '0')}:${m[2]}`);
                                    }
                                    if (times.length === 0) return '';
                                    if (times.length === 1) return times[0];
                                    return `${times[0]} – ${times[1]}`;
                                };
                    
                                // ------------------------------------------------------------
                                // Pomocná: meta informácie podľa typu udalosti
                                // ------------------------------------------------------------
                                const getEventMeta = (type, ev) => {
                                    switch (type) {
                                        case 'match':
                                            return { icon: 'fa-hockey-puck', color: '#2563eb', label: 'Zápas', bg: '#eff6ff', border: '#bfdbfe', placeIcon: 'fa-location-dot' };
                                        case 'catering':
                                            return { icon: 'fa-utensils', color: '#16a34a', label: 'Stravovanie', bg: '#f0fdf4', border: '#bbf7d0', placeIcon: 'fa-location-dot' };
                                        case 'arrival':
                                            return { icon: 'fa-bus', color: '#ea580c', label: 'Príchod', bg: '#fff7ed', border: '#fed7aa', placeIcon: 'fa-location-dot' };
                                        case 'accommodation':
                                            return { icon: 'fa-bed', color: '#7c3aed', label: 'Ubytovanie', bg: '#f5f3ff', border: '#ddd6fe', placeIcon: 'fa-location-dot' };
                                        case 'transfer': {
                                            // ============================================================
                                            // NOVÉ: Ikona podľa stavu presunu:
                                            //  - peši → ikona chôdze
                                            //  - busom/priradený → ikona busu (rovnaká ako Príchod)
                                            //  - nepriradený → ikona otáznika
                                            // ============================================================
                                            if (ev && ev._isWalking) {
                                                return { icon: 'fa-person-walking', color: '#ea580c', label: 'Presun (peši)', bg: '#fff7ed', border: '#fed7aa', placeIcon: 'fa-location-dot' };
                                            }
                                            if (ev && ev._isAssigned) {
                                                return { icon: 'fa-bus', color: '#ea580c', label: 'Presun (bus)', bg: '#fff7ed', border: '#fed7aa', placeIcon: 'fa-location-dot' };
                                            }
                                            return { icon: 'fa-van-shuttle', color: '#ea580c', label: 'Presun', bg: '#fff7ed', border: '#fed7aa', placeIcon: 'fa-location-dot' };
                                        }
                                        default:
                                            return { icon: 'fa-circle-dot', color: '#6b7280', label: 'Udalosť', bg: '#f9fafb', border: '#e5e7eb', placeIcon: 'fa-location-dot' };
                                    }
                                };

                                // ------------------------------------------------------------
                                // Pomocná: vytiahne z textu udalosti názov miesta (ak existuje)
                                //   - match:      "Tím A vs Tím B [..] | HALA"  → "HALA"
                                //   - catering:   "Obed (12:00 – 12:30) → JEDÁLEŇ" → "JEDÁLEŇ"
                                //   - accommodation: "Ubytovanie: UBytovňa X (typ: ...)" → "UBytovňa X"
                                //   - arrival:    "Doprava / príchod: ..."  → null (nemá miesto)
                                //   - transfer:   z parenta zobraz medzizastávky + from + to
                                // ------------------------------------------------------------
                                const extractPlaceFromEvent = (ev) => {
                                    if (!ev) return null;
                                    const text = String(ev.text || '').trim();
                                    if (!text) return null;

                                    if (ev.type === 'match') {
                                        // Za posledným "|" je názov haly
                                        const idx = text.lastIndexOf('|');
                                        if (idx !== -1) {
                                            const hall = text.slice(idx + 1).trim();
                                            if (hall) return hall;
                                        }
                                        return ev.location || null;
                                    }

                                    if (ev.type === 'catering') {
                                        // Za "→" je názov jedálne
                                        const idx = text.lastIndexOf('→');
                                        if (idx !== -1) {
                                            const place = text.slice(idx + 1).trim();
                                            if (place) return place;
                                        }
                                        return ev.location || null;
                                    }

                                    if (ev.type === 'accommodation') {
                                        // "Ubytovanie: NÁZOV (typ: ...)" → "NÁZOV"
                                        const m = /^Ubytovanie:\s*(.+?)(?:\s*\(typ:.*\))?$/i.exec(text);
                                        if (m && m[1]) return m[1].trim();
                                        return ev.location || null;
                                    }

                                    // arrival a ostatné – použi location, ak existuje
                                    return ev.location || null;
                                };

                                // ============================================================
                                // NOVÉ: Pre presun vráti zoznam miest (from, medzizastávky, to)
                                // pre zobrazenie v poslednom stĺpci – každé na samostatnom riadku
                                // ============================================================
                                const extractPlacesForTransferEvent = (ev) => {
                                    if (!ev || ev.type !== 'transfer') return [];
                                    // Ak má event uloženú celú trasu parenta, použi ju
                                    if (Array.isArray(ev._routePlaces) && ev._routePlaces.length > 0) {
                                        return ev._routePlaces;
                                    }
                                    // Fallback – aspoň from a to
                                    const places = [];
                                    const fromLoc = String(ev._fromLocation || '').trim();
                                    const toLoc = String(ev._toLocation || '').trim();
                                    if (fromLoc) places.push(fromLoc);
                                    if (toLoc) places.push(toLoc);
                                    return places;
                                };
                                
                                const buildEventDescription = (ev) => {
                                    if (!ev) return '';
                                    const raw = String(ev.text || '').trim();
                                
                                    if (ev.type === 'match') {
                                        // Odrež všetko za posledným "|" (názov haly)
                                        const idx = raw.lastIndexOf('|');
                                        if (idx !== -1) return raw.slice(0, idx).trim();
                                        return raw;
                                    }
                                
                                    if (ev.type === 'catering') {
                                        // 1) Odrež všetko za "→" (názov jedálne)
                                        let s = raw;
                                        const arrowIdx = s.lastIndexOf('→');
                                        if (arrowIdx !== -1) s = s.slice(0, arrowIdx).trim();
                                    
                                        // 2) Odrež aj čas v zátvorke: "Obed (12:00 – 12:30)" → "Obed"
                                        //    (čas je už zobrazený v samostatnom stĺpci vľavo)
                                        s = s.replace(/\s*\(\s*\d{1,2}:\d{2}(?:\s*[–-]\s*\d{1,2}:\d{2})?\s*\)\s*$/, '').trim();
                                    
                                        return s;
                                    }
                                
                                    if (ev.type === 'accommodation') {
                                        // "Ubytovanie: NÁZOV (typ: TYP)"  →  "Ubytovanie (typ: TYP)"
                                        const m = /^Ubytovanie:\s*(.+?)\s*\(typ:\s*(.+?)\)\s*$/i.exec(raw);
                                        if (m) {
                                            return `Ubytovanie (typ: ${m[2].trim()})`;
                                        }
                                        // Ak nemá "(typ: ...)", skús aspoň odrezať názov za dvojbodkou
                                        const m2 = /^Ubytovanie:\s*(.+)$/i.exec(raw);
                                        if (m2) {
                                            const typMatch = /\(typ:\s*(.+?)\)/i.exec(m2[1]);
                                            if (typMatch) {
                                                return `Ubytovanie (typ: ${typMatch[1].trim()})`;
                                            }
                                            return 'Ubytovanie';
                                        }
                                        return raw;
                                    }
                                
                                    // arrival a ostatné – ponechaj pôvodný text
                                    return raw;
                                };
        
                                const parseMatchTeams = (ev) => {
                                    if (!ev || ev.type !== 'match') return null;
                                    const raw = String(ev.text || '').trim();
                                    // "Tím A vs Tím B [..] | Hala" – najprv odrež haly (za posledným "|")
                                    let s = raw;
                                    const pipeIdx = s.lastIndexOf('|');
                                    if (pipeIdx !== -1) s = s.slice(0, pipeIdx).trim();
                                
                                    // Nájdi " vs " (prípadne " VS ", " Vs ")
                                    const vsMatch = /\s+vs\.?\s+/i.exec(s);
                                    if (!vsMatch) return null;
                                
                                    const home = s.slice(0, vsMatch.index).trim();
                                    const away = s.slice(vsMatch.index + vsMatch[0].length).trim();
                                    return { home, away };
                                };
                    
                                // ------------------------------------------------------------
                                // Zoskup udalosti podľa dňa (dayKey), zachovaj poradie
                                // ------------------------------------------------------------
                                const groups = new Map(); // dayKey → [event, ...]
                                const order = [];         // poradie dayKey
                                teamEvents.forEach((ev) => {
                                    // ============================================================
                                    // NOVÉ: Pre presuny použi `_dayKey` (priradený v getTeamEventsForCustomTransfer),
                                    // pretože `when` pri presune obsahuje iba čas (HH:MM – HH:MM) bez dátumu.
                                    // ============================================================
                                    const dk = ev._dayKey || extractDayKey(ev.when) || '__none__';
                                    if (!groups.has(dk)) {
                                        groups.set(dk, []);
                                        order.push(dk);
                                    }
                                    groups.get(dk).push(ev);
                                });
                    
                                // ------------------------------------------------------------
                                // Render
                                // ------------------------------------------------------------
                                return React.createElement(
                                    'div',
                                    {
                                        className: 'bg-gray-50 border border-gray-200 rounded-lg p-2 max-h-[340px] overflow-y-auto'
                                    },
                                    order.map((dk) => {
                                        const items = groups.get(dk) || [];
                                        const dayLabel = dk !== '__none__'
                                            ? (formatDateDDMMYYYY(dk) || dk)
                                            : 'Bez dátumu';
                    
                                        return React.createElement(
                                            'div',
                                            { key: dk, className: 'mb-2 last:mb-0' },
                                            // Hlavička dňa – vľavo dátum, vpravo "Miesto"
                                            React.createElement(
                                                'div',
                                                {
                                                    className: 'flex items-center gap-2 px-2 py-1 mb-1 rounded bg-gray-200/70'
                                                },
                                                React.createElement('i', { className: 'fa-regular fa-calendar text-gray-600 text-xs' }),
                                                React.createElement(
                                                    'span',
                                                    { className: 'text-xs font-bold text-gray-700' },
                                                    dayLabel
                                                ),
                                                React.createElement(
                                                    'span',
                                                    { className: 'text-[10px] text-gray-500 ml-2' },
                                                    `${items.length} udalostí`
                                                ),
                                                // "Miesto" – hlavička pravého stĺpca
                                                React.createElement(
                                                    'span',
                                                    {
                                                        className: 'ml-auto text-[10px] font-bold text-gray-600 uppercase tracking-wide flex items-center gap-1'
                                                    },
                                                    React.createElement('i', { className: 'fa-solid fa-location-dot' }),
                                                    'Miesto'
                                                )
                                            ),
                                            // Riadky udalostí
                                            React.createElement(
                                                'div',
                                                { className: 'space-y-1' },
                                                items.map((ev, idx) => {
                                                    const meta = getEventMeta(ev.type, ev);
                                                    const timeLabel = extractTimeLabel(ev.when);
                                                    const text = buildEventDescription(ev);
                                                
                                                    // ============================================================
                                                    // NOVÉ: Miesta pre posledný stĺpec
                                                    //  - presun → zoznam miest (from, medzizastávky, to) – každé na samostatnom riadku
                                                    //  - ostatné → jedno miesto (placeName)
                                                    // ============================================================
                                                    const isTransferEvent = ev.type === 'transfer';
                                                    const transferPlaces = isTransferEvent ? extractPlacesForTransferEvent(ev) : [];
                                                    const placeName = !isTransferEvent ? extractPlaceFromEvent(ev) : null;
                                                    const hasAnyPlace = isTransferEvent
                                                        ? transferPlaces.length > 0
                                                        : !!placeName;

                                                    // ============================================================
                                                    // NOVÉ: Presun má oranžový box a čierny text (rovnako ako Príchod)
                                                    // ============================================================
                                                    const textColor = isTransferEvent ? '#000000' : '#1f2937';
                                                    const metaTextColor = isTransferEvent ? '#000000' : meta.color;

                                                    // ============================================================
                                                    // NOVÉ: Rozdelenie popisu na dva stĺpce:
                                                    //  - "Tím" (domáci/hostia pre zápas, inak prázdne)
                                                    //  - "Miesto" (hala/jedáleň/ubytovanie/presun)
                                                    // ============================================================
                                                    const matchTeamsForRow = ev.type === 'match' ? parseMatchTeams(ev) : null;

                                                    return React.createElement(
                                                        'div',
                                                        {
                                                            key: `${dk}-${idx}`,
                                                            className: 'flex items-start gap-2 px-2 py-1.5 rounded border text-xs',
                                                            style: {
                                                                backgroundColor: meta.bg,
                                                                borderColor: meta.border,
                                                            },
                                                            title: `${meta.label}: ${text}`
                                                        },
                                                        // 1) Ikona + typ
                                                        React.createElement(
                                                            'div',
                                                            {
                                                                className: 'flex flex-col items-center justify-start flex-shrink-0 pt-0.5',
                                                                style: { width: '54px', minWidth: '54px' }
                                                            },
                                                            React.createElement(
                                                                'div',
                                                                {
                                                                    className: 'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0',
                                                                    style: {
                                                                        backgroundColor: isTransferEvent ? '#ea580c22' : meta.color + '22',
                                                                        color: metaTextColor,
                                                                    }
                                                                },
                                                                React.createElement('i', { className: `fa-solid ${meta.icon} text-[11px]` })
                                                            ),
                                                            React.createElement(
                                                                'span',
                                                                {
                                                                    className: 'text-[9px] font-semibold mt-0.5 text-center leading-tight',
                                                                    style: { color: metaTextColor }
                                                                },
                                                                meta.label
                                                            )
                                                        ),
                                                        // 2) Čas (ak existuje) – pevná šírka + oddelenie
                                                        timeLabel
                                                            ? React.createElement(
                                                                'div',
                                                                {
                                                                    className: 'flex-shrink-0 font-mono font-semibold pt-0.5 whitespace-nowrap text-center',
                                                                    style: {
                                                                        width: '84px',
                                                                        minWidth: '84px',
                                                                        color: textColor,
                                                                    }
                                                                },
                                                                timeLabel
                                                            )
                                                            : React.createElement(
                                                                'div',
                                                                {
                                                                    className: 'flex-shrink-0 pt-0.5',
                                                                    style: { width: '84px', minWidth: '84px' }
                                                                }
                                                            ),
                                                        // 3) + 4) TÍM a MIESTO – spoločný flex kontajner
                                                        React.createElement(
                                                            'div',
                                                            {
                                                                className: 'flex-1 flex items-start gap-2 pt-0.5',
                                                                style: { minWidth: 0, color: textColor },
                                                            },
                                                            (() => {
                                                                // ------------------------------------------------------------
                                                                // ZÁPAS – domáci vľavo, hostia vpravo (dva flex stĺpce)
                                                                // + NOVÉ: názov haly pod tímami (v poslednom stĺpci)
                                                                // ------------------------------------------------------------
                                                                if (ev.type === 'match') {
                                                                    const teams = matchTeamsForRow;
                                                                    if (teams) {
                                                                        const selectedTeam = String(customTransferTeamName || '').trim();
                                                                        const isHomeSelected = teams.home === selectedTeam;
                                                                        const isAwaySelected = teams.away === selectedTeam;
                                                        
                                                                        // NOVÉ: vytiahni názov haly z textu (za posledným "|")
                                                                        const hallName = (() => {
                                                                            const raw = String(ev.text || '').trim();
                                                                            const idx = raw.lastIndexOf('|');
                                                                            if (idx !== -1) {
                                                                                const hall = raw.slice(idx + 1).trim();
                                                                                if (hall) return hall;
                                                                            }
                                                                            return ev.location || null;
                                                                        })();
                                                        
                                                                        return React.createElement(
                                                                            React.Fragment,
                                                                            null,
                                                                            // Domáci – vpravo (zarovnané na pravý okraj svojho stĺpca)
                                                                            React.createElement(
                                                                                'div',
                                                                                {
                                                                                    className: 'flex-1 text-right truncate',
                                                                                    style: {
                                                                                        fontWeight: isHomeSelected ? '700' : '400',
                                                                                        minWidth: 0,
                                                                                    },
                                                                                    title: teams.home,
                                                                                },
                                                                                teams.home
                                                                            ),
                                                                            // Hostia – vľavo (zarovnané na ľavý okraj svojho stĺpca)
                                                                            React.createElement(
                                                                                'div',
                                                                                {
                                                                                    className: 'flex-1 text-left truncate',
                                                                                    style: {
                                                                                        fontWeight: isAwaySelected ? '700' : '400',
                                                                                        minWidth: 0,
                                                                                    },
                                                                                    title: teams.away,
                                                                                },
                                                                                teams.away
                                                                            ),
                                                                            // NOVÉ: názov haly – malý badge vpravo
                                                                            hallName &&
                                                                                React.createElement(
                                                                                    'span',
                                                                                    {
                                                                                        className: 'inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0',
                                                                                        style: {
                                                                                            color: '#1f2937',
                                                                                            backgroundColor: meta.color + '11',
                                                                                        },
                                                                                        title: hallName,
                                                                                    },
                                                                                    React.createElement('i', { className: `fa-solid ${meta.placeIcon} text-[9px]` }),
                                                                                    React.createElement(
                                                                                        'span',
                                                                                        { className: 'truncate', style: { maxWidth: '140px' } },
                                                                                        hallName
                                                                                    )
                                                                                )
                                                                        );
                                                                    }
                                                                }
                                                        
                                                                // ------------------------------------------------------------
                                                                // PRESUN – colspan 2
                                                                // NOVÉ: zarovnané vpravo ako ostatné miesta (badge na konci riadku),
                                                                // každé miesto na samostatnom riadku, BEZ ikony pred názvom.
                                                                // ------------------------------------------------------------
                                                                if (ev.type === 'transfer') {
                                                                    // Zoznam miest pre tento presun (celá trasa parenta)
                                                                    const places = extractPlacesForTransferEvent(ev);
                                                                
                                                                    return React.createElement(
                                                                        'div',
                                                                        {
                                                                            className: 'flex-1 flex flex-col items-end gap-0.5',
                                                                            style: { minWidth: 0 }
                                                                        },
                                                                        // Badge riadok (bus / PEŠI / nepriradený) – zostáva hore
                                                                        React.createElement(
                                                                            'div',
                                                                            {
                                                                                className: 'flex flex-wrap items-center justify-end gap-x-2 gap-y-0.5',
                                                                                style: { minWidth: 0 }
                                                                            },
                                                                            // Názov busu
                                                                            ev._busName &&
                                                                                React.createElement(
                                                                                    'span',
                                                                                    {
                                                                                        className: 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold',
                                                                                        style: { backgroundColor: '#fed7aa', color: '#9a3412' },
                                                                                        title: 'Priradené k autobusu'
                                                                                    },
                                                                                    React.createElement('i', { className: 'fa-solid fa-bus text-[9px]' }),
                                                                                    ev._busName
                                                                                ),
                                                                            // PEŠI badge
                                                                            ev._isWalking &&
                                                                                React.createElement(
                                                                                    'span',
                                                                                    {
                                                                                        className: 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold',
                                                                                        style: { backgroundColor: '#bbf7d0', color: '#15803d' },
                                                                                        title: 'Peší presun'
                                                                                    },
                                                                                    React.createElement('i', { className: 'fa-solid fa-person-walking text-[9px]' }),
                                                                                    'PEŠI'
                                                                                ),
                                                                            // Nepriradený badge
                                                                            !ev._isWalking && !ev._isAssigned &&
                                                                                React.createElement(
                                                                                    'span',
                                                                                    {
                                                                                        className: 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold',
                                                                                        style: { backgroundColor: '#fef3c7', color: '#92400e' },
                                                                                        title: 'Nepriradený k autobusu'
                                                                                    },
                                                                                    React.createElement('i', { className: 'fa-solid fa-question text-[9px]' }),
                                                                                    'nepriradený'
                                                                                )
                                                                        ),
                                                                        // NOVÉ: Zoznam miest – každé na samostatnom riadku, vpravo,
                                                                        // BEZ ikony pred názvom miesta
                                                                        places.length > 0 &&
                                                                            React.createElement(
                                                                                'div',
                                                                                {
                                                                                    className: 'flex flex-col items-end gap-0.5',
                                                                                    style: { minWidth: 0 }
                                                                                },
                                                                                places.map((place, placeIdx) =>
                                                                                    React.createElement(
                                                                                        'span',
                                                                                        {
                                                                                            key: `place-${placeIdx}`,
                                                                                            className: 'inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded',
                                                                                            style: {
                                                                                                color: '#1f2937',
                                                                                                backgroundColor: '#fed7aa66',
                                                                                                maxWidth: '220px',
                                                                                            },
                                                                                            title: place,
                                                                                        },
                                                                                        React.createElement(
                                                                                            'span',
                                                                                            {
                                                                                                className: 'truncate',
                                                                                                style: { maxWidth: '220px' },
                                                                                            },
                                                                                            place
                                                                                        )
                                                                                    )
                                                                                )
                                                                            )
                                                                    );
                                                                }
                                                        
                                                                // ------------------------------------------------------------
                                                                // STRAVOVANIE / UBYTOVANIE / PRÍCHOD – colspan 2
                                                                // NOVÉ: zarovnané rovnako ako zápas – vpravo (badge na konci riadku)
                                                                // ------------------------------------------------------------
                                                                return React.createElement(
                                                                    'div',
                                                                    {
                                                                        className: 'flex-1 flex items-center justify-end gap-2',
                                                                        style: { minWidth: 0 }
                                                                    },
                                                                    hasAnyPlace
                                                                        ? React.createElement(
                                                                            'span',
                                                                            {
                                                                                className: 'inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0',
                                                                                style: {
                                                                                    color: '#1f2937',
                                                                                    backgroundColor: meta.color + '11',
                                                                                },
                                                                                title: placeName || ''
                                                                            },
                                                                            React.createElement('i', { className: `fa-solid ${meta.placeIcon} text-[10px] flex-shrink-0` }),
                                                                            React.createElement(
                                                                                'span',
                                                                                {
                                                                                    className: 'truncate',
                                                                                    style: { maxWidth: '220px' }
                                                                                },
                                                                                placeName
                                                                            )
                                                                        )
                                                                        : React.createElement(
                                                                            'span',
                                                                            {
                                                                                className: 'text-[11px] italic',
                                                                                style: { color: '#9ca3af' }
                                                                            },
                                                                            '—'
                                                                        )
                                                                );
                                                            })()
                                                        ),
                                                    );
                                                })
                                            )
                                        );
                                    })
                                );
                            })()
                    ),
                    // Tlačidlá
                    React.createElement(
                        'div',
                        { className: 'flex justify-end gap-3' },
                        React.createElement(
                            'button',
                            {
                                type: 'button',
                                onClick: () => {
                                    setShowCustomTransferModal(false);
                                },
                                className: 'px-4 py-2 rounded-lg border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors'
                            },
                            'Zatvoriť'
                        )
                    )
                )
            );
        })(),
        // ============================================================
        // MODÁLNE OKNO – Úprava vygenerovaného presunu (medzizastávky)
        // ============================================================
        editingTransfer && React.createElement(
            'div',
            {
                className: 'fixed inset-0 bg-black/50 flex items-center justify-center z-[100000] p-4',
                onClick: () => {
                    setEditingTransfer(null);
                    setEditingTransferStops([]);
                }
            },
            React.createElement(
                'div',
                {
                    className: 'bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto',
                    onClick: (e) => e.stopPropagation()
                },
                // Hlavička – BEZ názvu tímu a kategórie
                React.createElement(
                    'div',
                    { className: 'flex items-start gap-3 mb-4' },
                    React.createElement('i', {
                        className: 'fa-solid fa-route text-blue-600 text-2xl mt-0.5'
                    }),
                    React.createElement(
                        'div',
                        { className: 'flex-1' },
                        React.createElement(
                            'h3',
                            { className: 'text-lg font-semibold text-gray-800' },
                            'Upraviť presun'
                        )
                    )
                ),
                // ============================================================
                // NOVÝ BOX – rovnaký vizuál ako v "Priradiť presun k autobusu"
                // ============================================================
                (() => {
                    const tr = editingTransfer;
                
                    // Vypočítaj zobrazený čas (rovnaká logika ako v "Priradiť presun")
                    let displayWhen = null;
                
                    if (tr.when && String(tr.when).trim() !== '') {
                        displayWhen = tr.when;
                    }
                
                    if (!displayWhen && Array.isArray(tr.segments) && tr.segments.length > 0) {
                        let earliestStart = null;
                        let latestEnd = null;
                        tr.segments.forEach((s) => {
                            if (s.startTs != null && (earliestStart == null || s.startTs < earliestStart)) {
                                earliestStart = s.startTs;
                            }
                            if (s.endTs != null && (latestEnd == null || s.endTs > latestEnd)) {
                                latestEnd = s.endTs;
                            }
                        });
                        if (earliestStart != null && latestEnd != null) {
                            displayWhen = `${formatTsLocal(earliestStart)} – ${formatTsLocal(latestEnd)}`;
                        } else if (earliestStart != null) {
                            displayWhen = formatTsLocal(earliestStart);
                        } else if (latestEnd != null) {
                            displayWhen = formatTsLocal(latestEnd);
                        }
                    }
                
                    if (!displayWhen) {
                        const provisional = computeProvisionalSegmentRange(tr);
                        if (provisional) {
                            displayWhen = `${formatTsLocal(provisional.startTs)} – ${formatTsLocal(provisional.endTs)}`;
                        }
                    }
                
                    // Počet členov tímu
                    const counts = getTeamCountsForTransfer(tr.category, tr.teamName);
                    let membersCount = null;
                    let membersTitle = '';
                    if (counts) {
                        membersCount =
                            (counts.players || 0) +
                            (counts.menRT || 0) +
                            (counts.womenRT || 0) +
                            (counts.menDrivers || 0) +
                            (counts.womenDrivers || 0);
                        membersTitle = 'Počet členov tímu z users';
                    } else {
                        const avg = getCategoryAverageForTransfer(tr.category);
                        if (avg != null) {
                            membersCount = avg;
                            membersTitle = `Priemer členov tímu v kategórii ${tr.category} (zaokrúhlené nahor)`;
                        }
                    }
                
                    const transportColor = getTransportColorForCategory(tr.category);
                    const boxBg = transportColor ? lightenHex(transportColor, 0.15) : null;
                
                    return React.createElement(
                        'div',
                        {
                            className: 'mb-4 text-sm text-gray-700 flex flex-col leading-snug rounded-md px-3 py-2',
                            style: {
                                position: 'relative',
                                borderLeft: transportColor ? `6px solid ${transportColor}` : '2px solid #c4b5fd',
                                ...(boxBg ? { backgroundColor: boxBg } : { backgroundColor: '#f5f3ff' }),
                            },
                        },
                        // 1. riadok – tím • počet
                        React.createElement(
                            'div',
                            { className: 'flex flex-wrap items-center gap-x-2 gap-y-1' },
                            tr.teamName &&
                                React.createElement(
                                    'span',
                                    {
                                        className: 'text-sm font-semibold',
                                        style: { color: transportColor || '#5b21b6' },
                                        title: 'Tím',
                                    },
                                    tr.teamName
                                ),
                            membersCount != null &&
                                React.createElement(
                                    'span',
                                    {
                                        className: 'text-sm font-semibold',
                                        style: { color: transportColor || '#5b21b6' },
                                        title: membersTitle,
                                    },
                                    `• ${membersCount} členov`
                                )
                        ),
                        // 2. riadok – trasa (celá trasa parenta)
                        React.createElement(
                            'span',
                            { className: 'text-sm text-gray-900 font-medium' },
                            `${tr.fromLocation || '?'} → ${tr.toLocation || '?'}`
                        ),
                        // 3. riadok – dátum a čas
                        displayWhen &&
                            React.createElement(
                                'span',
                                { className: 'text-sm text-gray-600' },
                                displayWhen
                            )
                    );
                })(),
                // Info o medzizastávkach (zobrazí sa len ak sú nejaké)
                editingTransferStops.length > 0 && React.createElement(
                    'div',
                    { className: 'mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-sm' },
                    React.createElement(
                        'div',
                        { className: 'font-medium text-indigo-700 mb-1' },
                        'Medzizastávky:'
                    ),
                    React.createElement(
                        'div',
                        { className: 'text-indigo-800' },
                        editingTransferStops.join(', ')
                    )
                ),
                // Medzizastávky
                React.createElement(
                    'div',
                    { className: 'mb-4' },
                    React.createElement(
                        'label',
                        { className: 'block text-sm font-medium text-gray-700 mb-2' },
                        'Medzizastávky (voliteľné)'
                    ),
                    editingTransferStops.length === 0 &&
                        React.createElement(
                            'p',
                            { className: 'text-xs text-gray-400 italic mb-2' },
                            'Žiadne medzizastávky. Presun pôjde priamo z „' + editingTransfer.fromLocation + '" do „' + editingTransfer.toLocation + '".'
                        ),
                    editingTransferStops.length > 0 &&
                        React.createElement(
                            'ul',
                            { className: 'space-y-2' },
                            editingTransferStops.map((stopValue, idx) => {
                                // Všetky už vybrané zastávky (okrem aktuálneho indexu)
                                const selectedElsewhere = new Set(
                                    editingTransferStops
                                        .filter((_, i) => i !== idx)
                                        .map((s) => String(s || '').trim())
                                        .filter(Boolean)
                                );
                                // Zastávky, ktoré ešte nie sú vybrané (alebo sú aktuálna hodnota)
                                const availableStops = stopsList.filter((s) => {
                                    if (s.name === stopValue) return true; // aktuálna hodnota vždy dostupná
                                    return !selectedElsewhere.has(s.name);
                                });
                
                                return React.createElement(
                                    'li',
                                    {
                                        key: `stop-${idx}`,
                                        className: 'flex items-center gap-2'
                                    },
                                    React.createElement(
                                        'span',
                                        { className: 'text-xs text-gray-500 w-6 text-right' },
                                        `${idx + 1}.`
                                    ),
                                    React.createElement(
                                        'select',
                                        {
                                            value: stopValue,
                                            onChange: (e) => {
                                                const v = e.target.value;
                                                setEditingTransferStops((prev) => {
                                                    const copy = [...prev];
                                                    copy[idx] = v;
                                                    return copy;
                                                });
                                            },
                                            className: 'flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500'
                                        },
                                        React.createElement('option', { value: '' }, '— vyber zastávku —'),
                                        availableStops.map((s) =>
                                            React.createElement(
                                                'option',
                                                { key: s.id, value: s.name },
                                                s.name
                                            )
                                        )
                                    ),
                                    // Tlačidlo "+" – vloží nové prázdne miesto POD aktuálny riadok
                                    React.createElement(
                                        'button',
                                        {
                                            type: 'button',
                                            onClick: () => {
                                                setEditingTransferStops((prev) => {
                                                    const copy = [...prev];
                                                    copy.splice(idx + 1, 0, '');
                                                    return copy;
                                                });
                                            },
                                            className: 'text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded w-7 h-7 flex items-center justify-center',
                                            title: 'Vložiť medzizastávku pod tento riadok'
                                        },
                                        React.createElement('i', { className: 'fa-solid fa-plus text-xs' })
                                    ),
                                    // Tlačidlo "X" – odstráni tento riadok
                                    React.createElement(
                                        'button',
                                        {
                                            type: 'button',
                                            onClick: () => {
                                                setEditingTransferStops((prev) => prev.filter((_, i) => i !== idx));
                                            },
                                            className: 'text-red-600 hover:text-red-800 hover:bg-red-50 rounded w-7 h-7 flex items-center justify-center',
                                            title: 'Odstrániť medzizastávku'
                                        },
                                        React.createElement('i', { className: 'fa-solid fa-xmark' })
                                    )
                                );
                            })
                        ),
                    // Tlačidlo "+" – POD zoznamom, vycentrované
                    // ZOBRAZÍ SA LEN AK NEEXISTUJE ŽIADNY SELECTBOX (t.j. zoznam je prázdny)
                    editingTransferStops.length === 0 &&
                        React.createElement(
                            'div',
                            { className: 'mt-3 flex justify-center' },
                            React.createElement(
                                'button',
                                {
                                    type: 'button',
                                    onClick: () => setEditingTransferStops((prev) => [...prev, '']),
                                    className: 'text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded w-7 h-7 flex items-center justify-center',
                                    title: 'Pridať medzizastávku'
                                },
                                React.createElement('i', { className: 'fa-solid fa-plus text-xs' })
                            )
                        )
                ),
                // Náhľad novej trasy
                React.createElement(
                    'div',
                    { className: 'mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm' },
                    React.createElement(
                        'div',
                        { className: 'font-medium text-blue-700 mb-1' },
                        'Nová trasa:'
                    ),
                    React.createElement(
                        'div',
                        { className: 'text-blue-800' },
                        [editingTransfer.fromLocation, ...(editingTransferStops || []).filter(Boolean), editingTransfer.toLocation]
                            .filter(Boolean)
                            .join(' → ')
                    )
                ),
                // Tlačidlá
                React.createElement(
                    'div',
                    { className: 'flex justify-end gap-3' },
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: () => {
                                setEditingTransfer(null);
                                setEditingTransferStops([]);
                            },
                            disabled: editingTransferSaving,
                            className: 'px-4 py-2 rounded-lg border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors disabled:opacity-60'
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: saveEditedTransfer,
                            disabled: editingTransferSaving,
                            className: 'px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center gap-2'
                        },
                        editingTransferSaving &&
                            React.createElement('i', { className: 'fa-solid fa-spinner fa-spin' }),
                        'Uložiť'
                    )
                )
            )
        ),
        // ============================================================
        // ROZHODOVACIE MODÁLNE OKNO PO KLIKNUTÍ NA PRESUN
        // ============================================================
        transferActionModal && React.createElement(
            'div',
            {
                className: 'fixed inset-0 bg-black/50 flex items-center justify-center z-[100000] p-4',
                onClick: () => setTransferActionModal(null)
            },
            React.createElement(
                'div',
                {
                    className: 'bg-white rounded-xl shadow-2xl max-w-md w-full p-6',
                    onClick: (e) => e.stopPropagation()
                },
                React.createElement(
                    'div',
                    { className: 'flex-1' },
                    React.createElement(
                        'h3',
                        { className: 'text-lg font-semibold text-gray-800' },
                        'Upraviť presun'
                    )
                ),
                // Info o presune – rovnaký box ako v "Priradiť presun k autobusu"
                (() => {
                    const tr = transferActionModal.transfer;
                
                    let displayWhen = null;
                
                    if (tr.when && String(tr.when).trim() !== '') {
                        displayWhen = tr.when;
                    }
                
                    if (!displayWhen && Array.isArray(tr.segments) && tr.segments.length > 0) {
                        let earliestStart = null;
                        let latestEnd = null;
                        tr.segments.forEach((s) => {
                            if (s.startTs != null && (earliestStart == null || s.startTs < earliestStart)) {
                                earliestStart = s.startTs;
                            }
                            if (s.endTs != null && (latestEnd == null || s.endTs > latestEnd)) {
                                latestEnd = s.endTs;
                            }
                        });
                        if (earliestStart != null && latestEnd != null) {
                            displayWhen = `${formatTsLocal(earliestStart)} – ${formatTsLocal(latestEnd)}`;
                        } else if (earliestStart != null) {
                            displayWhen = formatTsLocal(earliestStart);
                        } else if (latestEnd != null) {
                            displayWhen = formatTsLocal(latestEnd);
                        }
                    }
                
                    if (!displayWhen) {
                        const provisional = computeProvisionalSegmentRange(tr);
                        if (provisional) {
                            displayWhen = `${formatTsLocal(provisional.startTs)} – ${formatTsLocal(provisional.endTs)}`;
                        }
                    }
                
                    const counts = getTeamCountsForTransfer(tr.category, tr.teamName);
                    let membersCount = null;
                    let membersTitle = '';
                    if (counts) {
                        membersCount =
                            (counts.players || 0) +
                            (counts.menRT || 0) +
                            (counts.womenRT || 0) +
                            (counts.menDrivers || 0) +
                            (counts.womenDrivers || 0);
                        membersTitle = 'Počet členov tímu z users';
                    } else {
                        const avg = getCategoryAverageForTransfer(tr.category);
                        if (avg != null) {
                            membersCount = avg;
                            membersTitle = `Priemer členov tímu v kategórii ${tr.category} (zaokrúhlené nahor)`;
                        }
                    }
                
                    const transportColor = getTransportColorForCategory(tr.category);
                    const boxBg = transportColor ? lightenHex(transportColor, 0.15) : null;
                
                    // Rovnaký štýl ako box vo vygenerovaných presunoch / v "Priradiť presun k autobusu"
                    return React.createElement(
                        'div',
                        {
                            className: 'mb-4 text-sm text-gray-700 flex flex-col leading-snug rounded-md px-3 py-2',
                            style: {
                                position: 'relative',
                                borderLeft: transportColor ? `6px solid ${transportColor}` : '2px solid #c4b5fd',
                                ...(boxBg ? { backgroundColor: boxBg } : { backgroundColor: '#f5f3ff' }),
                            },
                        },
                        // 1. riadok – tím • počet
                        React.createElement(
                            'div',
                            { className: 'flex flex-wrap items-center gap-x-2 gap-y-1' },
                            tr.teamName &&
                                React.createElement(
                                    'span',
                                    {
                                        className: 'text-sm font-semibold',
                                        style: { color: transportColor || '#5b21b6' },
                                        title: 'Tím',
                                    },
                                    tr.teamName
                                ),
                            membersCount != null &&
                                React.createElement(
                                    'span',
                                    {
                                        className: 'text-sm font-semibold',
                                        style: { color: transportColor || '#5b21b6' },
                                        title: membersTitle,
                                    },
                                    `• ${membersCount} členov`
                                )
                        ),
                        // 2. riadok – trasa
                        React.createElement(
                            'span',
                            { className: 'text-sm text-gray-900 font-medium' },
                            `${tr.fromLocation || '?'} → ${tr.toLocation || '?'}`
                        ),
                        // 3. riadok – dátum a čas
                        displayWhen &&
                            React.createElement(
                                'span',
                                { className: 'text-sm text-gray-600' },
                                displayWhen
                            )
                    );
                })(),
                // Možnosti
                React.createElement(
                    'div',
                    { className: 'space-y-2 mb-4' },
                    // 1) Pridať medzizastávku
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: () => {
                                const t = transferActionModal.transfer;
                                
                                // ============================================================
                                // NOVÉ: Ak je to segment, pracuj s parent záznamom.
                                // ============================================================
                                let transferToEdit = t;
                                let existingStops = [];
    
                                if (t._parentKey) {
                                    const parent = savedTransfers.find((s) => s.key === t._parentKey);
                                    if (parent) {
                                        transferToEdit = {
                                            ...parent,
                                            _parentKey: undefined,
                                        };
                                        if (Array.isArray(parent.intermediateStops)) {
                                            existingStops = [...parent.intermediateStops];
                                        }
                                    }
                                } else if (Array.isArray(t.intermediateStops)) {
                                    existingStops = [...t.intermediateStops];
                                }
    
                                setEditingTransfer(transferToEdit);
                                setEditingTransferStops(existingStops);
                                setTransferActionModal(null);
                            },
                            className: 'w-full text-left px-4 py-3 rounded-lg border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors flex items-center gap-3'
                        },
                        React.createElement('i', { className: 'fa-solid fa-route text-blue-600 text-xl w-6 text-center' }),
                        React.createElement(
                            'div',
                            { className: 'flex-1' },
                            React.createElement('div', { className: 'font-semibold text-gray-800' }, 'Upraviť presun'),
                            React.createElement('div', { className: 'text-xs text-gray-500' }, 'Rozdeliť trasu na viac segmentov')
                        )
                    ),
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: () => {
                                const transferToAssign = transferActionModal.transfer;
                                const matches = findMatchingBusRows(transferActionModal.transfer);
                                setAssignBusMatches(matches);
                                setAssignBusSelectedKey(
                                    matches.length > 0
                                        ? `${matches[0].bus.id}|${matches[0].boardingRow?.id || ''}|${matches[0].alightingRow?.id || ''}|${matches[0].side}`
                                        : ''
                                );
                                setAssignBusTransfer(transferToAssign);
                                setTransferActionModal(null);
                                setShowAssignBusModal(true);
                            },
                            className: 'w-full text-left px-4 py-3 rounded-lg border-2 border-amber-200 bg-amber-50 hover:bg-amber-100 transition-colors flex items-center gap-3'
                        },
                        React.createElement('i', { className: 'fa-solid fa-bus text-amber-600 text-xl w-6 text-center' }),
                        React.createElement(
                            'div',
                            { className: 'flex-1' },
                            React.createElement('div', { className: 'font-semibold text-gray-800' }, 'Priradiť presun autobusu'),
                            React.createElement('div', { className: 'text-xs text-gray-500' }, 'Vytvoriť riadok v plánovaní autobusu')
                        )
                    ),
                    // 3) Nastaviť presun peši
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: () => setTransferAsWalking(transferActionModal.transfer),
                            className: 'w-full text-left px-4 py-3 rounded-lg border-2 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors flex items-center gap-3'
                        },
                        React.createElement('i', { className: 'fa-solid fa-person-walking text-emerald-600 text-xl w-6 text-center' }),
                        React.createElement(
                            'div',
                            { className: 'flex-1' },
                            React.createElement('div', { className: 'font-semibold text-gray-800' }, 'Nastaviť presun peši'),
                            React.createElement('div', { className: 'text-xs text-gray-500' }, 'Označiť, že tím ide peši')
                        )
                    )
                ),
                // Zatvoriť
                React.createElement(
                    'div',
                    { className: 'flex justify-end' },
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: () => setTransferActionModal(null),
                            className: 'px-4 py-2 rounded-lg border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors'
                        },
                        'Zatvoriť'
                    )
                )
            )
        ),
        showAssignBusModal && assignBusTransfer && (() => {
            // ============================================================
            // NOVÉ: Vždy obnov assignBusTransfer z aktuálneho savedTransfers.
            //
            // DÔVOD: assignBusTransfer je snapshot z okamihu otvorenia modálneho
            // okna. Ak sa medzitým zmenil parent (napr. si označil predchádzajúci
            // segment ako peši), assignBusTransfer neobsahuje aktuálne
            // isWalking: true pre peší segment.
            //
            // Preto pri každom renderi modálneho okna obnovíme `currentTransfer`
            // z aktuálneho savedTransfers a použijeme ho všade.
            // ============================================================
            const parentKey = assignBusTransfer._parentKey || assignBusTransfer.key;
            const currentParent = savedTransfers.find((s) => s.key === parentKey);
        
            const currentTransfer = (() => {
                if (!currentParent) return assignBusTransfer;
                if (assignBusTransfer._parentKey) {
                    const segIdx = findSegmentIndex(
                        currentParent.segments || [],
                        assignBusTransfer.fromLocation,
                        assignBusTransfer.toLocation
                    );
                    const seg = segIdx !== -1 ? currentParent.segments[segIdx] : null;
                    return {
                        ...assignBusTransfer,
                        segments: currentParent.segments,
                        isWalking: seg ? seg.isWalking === true : false,
                    };
                }
                return {
                    ...assignBusTransfer,
                    segments: currentParent.segments,
                };
            })();
        
            return React.createElement(
                'div',
                {
                    className: 'fixed inset-0 bg-black/50 flex items-center justify-center z-[100001] p-4',
                    onClick: () => {
                        setShowAssignBusModal(false);
                        setAssignBusTransfer(null);
                    },
                },
                React.createElement(
                    'div',
                    {
                        className: 'bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto',
                        onClick: (e) => e.stopPropagation()
                    },
                    // ============================================================
                    // HLAVIČKA
                    // ============================================================
                    React.createElement(
                        'div',
                        { className: 'flex items-start gap-3 mb-4' },
                        React.createElement('i', {
                            className: 'fa-solid fa-bus text-amber-600 text-2xl mt-0.5'
                        }),
                        React.createElement(
                            'div',
                            { className: 'flex-1' },
                            React.createElement(
                                'h3',
                                { className: 'text-lg font-semibold text-gray-800' },
                                'Priradiť presun k autobusu'
                            ),
                            React.createElement(
                                'p',
                                { className: 'text-xs text-gray-500 mt-0.5' },
                                'Zobrazujú sa len autobusy s riadkom, ktorý zodpovedá trase a času presunu.'
                            )
                        )
                    ),
        
//                    // ============================================================
//                    // VAROVANIE – použijeme currentTransfer
//                    // ============================================================
//                    !arePreviousSegmentsResolved(currentTransfer) &&
//                    React.createElement(
//                        'div',
//                        { className: 'mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm' },
//                        React.createElement(
//                            'p',
//                            { className: 'text-amber-700 flex items-start gap-2' },
//                            React.createElement('i', { className: 'fa-solid fa-triangle-exclamation mt-0.5' }),
//                            React.createElement(
//                                'span',
//                                null,
//                                'Najprv musíte priradiť predchádzajúce segmenty tohto presunu (alebo ich označiť ako „peši"). ',
//                                'Tento presun začína neskôr, takže tím sa musí najprv dostať na miesto odchodu.'
//                            )
//                        )
//                    ),
                    // ============================================================
                    // INFO O PRESUNE
                    // ============================================================
                    (() => {
                        const tr = currentTransfer;
        
                        let displayWhen = null;
        
                        if (tr.when && String(tr.when).trim() !== '') {
                            displayWhen = tr.when;
                        }
        
                        if (!displayWhen && Array.isArray(tr.segments) && tr.segments.length > 0) {
                            let earliestStart = null;
                            let latestEnd = null;
                            tr.segments.forEach((s) => {
                                if (s.startTs != null && (earliestStart == null || s.startTs < earliestStart)) {
                                    earliestStart = s.startTs;
                                }
                                if (s.endTs != null && (latestEnd == null || s.endTs > latestEnd)) {
                                    latestEnd = s.endTs;
                                }
                            });
                            if (earliestStart != null && latestEnd != null) {
                                displayWhen = `${formatTsLocal(earliestStart)} – ${formatTsLocal(latestEnd)}`;
                            } else if (earliestStart != null) {
                                displayWhen = formatTsLocal(earliestStart);
                            } else if (latestEnd != null) {
                                displayWhen = formatTsLocal(latestEnd);
                            }
                        }
        
                        if (!displayWhen) {
                            const provisional = computeProvisionalSegmentRange(tr);
                            if (provisional) {
                                displayWhen = `${formatTsLocal(provisional.startTs)} – ${formatTsLocal(provisional.endTs)}`;
                            }
                        }
        
                        const counts = getTeamCountsForTransfer(tr.category, tr.teamName);
                        let membersCount = null;
                        let membersTitle = '';
                        if (counts) {
                            membersCount =
                                (counts.players || 0) +
                                (counts.menRT || 0) +
                                (counts.womenRT || 0) +
                                (counts.menDrivers || 0) +
                                (counts.womenDrivers || 0);
                            membersTitle = 'Počet členov tímu z users';
                        } else {
                            const avg = getCategoryAverageForTransfer(tr.category);
                            if (avg != null) {
                                membersCount = avg;
                                membersTitle = `Priemer členov tímu v kategórii ${tr.category} (zaokrúhlené nahor)`;
                            }
                        }
        
                        const transportColor = getTransportColorForCategory(tr.category);
                        const boxBg = transportColor ? lightenHex(transportColor, 0.15) : null;
        
                        return React.createElement(
                            'div',
                            {
                                className: 'mb-4 text-sm text-gray-700 flex flex-col leading-snug rounded-md px-3 py-2',
                                style: {
                                    position: 'relative',
                                    borderLeft: transportColor ? `6px solid ${transportColor}` : '2px solid #c4b5fd',
                                    ...(boxBg ? { backgroundColor: boxBg } : { backgroundColor: '#f5f3ff' }),
                                },
                            },
                            React.createElement(
                                'div',
                                { className: 'flex flex-wrap items-center gap-x-2 gap-y-1' },
                                tr.teamName &&
                                    React.createElement(
                                        'span',
                                        {
                                            className: 'text-sm font-semibold',
                                            style: { color: transportColor || '#5b21b6' },
                                            title: 'Tím',
                                        },
                                        tr.teamName
                                    ),
                                membersCount != null &&
                                    React.createElement(
                                        'span',
                                        {
                                            className: 'text-sm font-semibold',
                                            style: { color: transportColor || '#5b21b6' },
                                            title: membersTitle,
                                        },
                                        `• ${membersCount} členov`
                                    )
                            ),
                            React.createElement(
                                'span',
                                { className: 'text-sm text-gray-900 font-medium' },
                                `${tr.fromLocation || '?'} → ${tr.toLocation || '?'}`
                            ),
                            displayWhen &&
                                React.createElement(
                                    'span',
                                    { className: 'text-sm text-gray-600' },
                                    displayWhen
                                )
                        );
                    })(),
                    // ============================================================
                    // DYNAMICKÝ VÝPOČET ZOZNAMU AUTOBUSOV
                    // ============================================================
                    (() => {
                        const currentMatches = findMatchingBusRows(currentTransfer);
        
                        if (currentMatches.length === 0) {
                            return React.createElement(
                                'div',
                                { className: 'mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm' },
                                React.createElement(
                                    'p',
                                    { className: 'text-red-700 flex items-start gap-2' },
                                    React.createElement('i', { className: 'fa-solid fa-triangle-exclamation mt-0.5' }),
                                    React.createElement(
                                        'span',
                                        null,
                                        'Pre tento presun neexistuje žiadny autobus s trasou, ktorá by zodpovedala miestam a času presunu. ',
                                        'Najprv pridajte riadky do autobusu (v Plánovaní) tak, aby trasa autobusu obsahovala miesto odchodu a príchodu presunu.'
                                    )
                                )
                            );
                        }
        
                        return React.createElement(
                            'div',
                            { className: 'mb-4' },
                            React.createElement(
                                'label',
                                { className: 'block text-sm font-medium text-gray-700 mb-2' },
                                'Vyberte autobus / trasu:'
                            ),
                            React.createElement(
                                'ul',
                                { className: 'space-y-2' },
                                currentMatches.map((m, idx) => {
                                    if (!m || !m.bus || !m.trip) {
                                        console.warn('[TRANSPORT] Neplatný výsledok v currentMatches:', m);
                                        return null;
                                    }
        
                                    const key = `${m.bus.id}|${m.boardingRow?.id || ''}|${m.alightingRow?.id || ''}|${m.side}`;
                                    const isSelected = assignBusSelectedKey === key;
        
                                    const hasBoarding = !!m.boardingRow;
                                    const hasAlighting = !!m.alightingRow;
        
                                    const teamKey = `${currentTransfer.teamName}|${currentTransfer.category || ''}`;
        
                                    return React.createElement(
                                        'li',
                                        { key },
                                        React.createElement(
                                            'button',
                                            {
                                                type: 'button',
                                                onClick: () => setAssignBusSelectedKey(key),
                                                className: `w-full text-left px-3 py-2 rounded-lg border-2 transition-colors ${
                                                    isSelected
                                                        ? 'border-amber-500 bg-amber-50'
                                                        : 'border-gray-200 bg-white hover:bg-gray-50'
                                                }`
                                            },
                                            React.createElement(
                                                'div',
                                                { className: 'flex items-center justify-between gap-2' },
                                                React.createElement(
                                                    'div',
                                                    { className: 'flex-1' },
                                                    React.createElement(
                                                        'div',
                                                        { className: 'font-semibold text-gray-800 text-sm' },
                                                        m.bus.name
                                                    ),
                                                    React.createElement(
                                                        'div',
                                                        { className: 'text-xs text-gray-600 mt-0.5' },
                                                        `${m.trip.fromPlace} → ${m.trip.toPlace}`
                                                    ),
                                                    React.createElement(
                                                        'div',
                                                        { className: 'text-xs text-gray-500 mt-0.5' },
                                                        `Odchod: ${m.boardingTime || '—'}${m.alightingTime ? ` · Príchod: ${m.alightingTime}` : ''}`
                                                    )
                                                ),
                                                React.createElement(
                                                    'div',
                                                    { className: 'flex flex-row items-center gap-6 text-xs font-semibold' },
                                                    (() => {
                                                        const busId = m.bus.id;
                                                        const dayKey = m.trip?.dayKey;
                                                        const boardingRow = m.boardingRow;
                                                        const alightingRow = m.alightingRow;
                                                        if (!busId || !dayKey || !boardingRow || !alightingRow) return null;
                                                
                                                        // ============================================================
                                                        // Dĺžka jazdy – počíta sa VŽDY z boardingRow.timeFrom → alightingRow.timeTo
                                                        // (nezávisle od počtu členov v autobuse).
                                                        // ============================================================
                                                        const computeTripDuration = () => {
                                                            const timeRe = /^\d{1,2}:\d{2}$/;
                                                            const boardStr = String(m.boardingTime || '').trim();
                                                            const alightStr = String(m.alightingTime || '').trim();
                                                            if (!timeRe.test(boardStr) || !timeRe.test(alightStr)) return null;
                                                            const [bh, bm] = boardStr.split(':').map(Number);
                                                            const [ah, am] = alightStr.split(':').map(Number);
                                                            let diff = (ah * 60 + am) - (bh * 60 + bm);
                                                            if (diff < 0) diff += 24 * 60;
                                                            return diff > 0 ? diff : null;
                                                        };
                                                
                                                        const tripDurationMin = computeTripDuration();
                                                
                                                        // ============================================================
                                                        // Počet členov v autobuse – voliteľný údaj.
                                                        // ============================================================
                                                        const rowsKey = `${busId}|${dayKey}`;
                                                        const allRows = (busRows[rowsKey] || [])
                                                            .slice()
                                                            .sort((a, b) => (a.order || 0) - (b.order || 0));
                                                
                                                        const boardIdx = allRows.findIndex((r) => r.id === boardingRow.id);
                                                        const alightIdx = allRows.findIndex((r) => r.id === alightingRow.id);
                                                        let total = 0;
                                                        if (boardIdx !== -1 && alightIdx !== -1 && alightIdx >= boardIdx) {
                                                            const inBus = new Set();
                                                            for (let i = 0; i <= boardIdx; i++) {
                                                                const r = allRows[i];
                                                                (r.teamsIn || []).forEach((t) => inBus.add(String(t)));
                                                                (r.teamsOut || []).forEach((t) => inBus.delete(String(t)));
                                                            }
                                                            (boardingRow.teamsIn || []).forEach((t) => inBus.add(String(t)));
                                                            for (let i = boardIdx + 1; i < alightIdx; i++) {
                                                                const r = allRows[i];
                                                                (r.teamsIn || []).forEach((t) => inBus.add(String(t)));
                                                                (r.teamsOut || []).forEach((t) => inBus.delete(String(t)));
                                                            }
                                                            total = [...inBus].reduce((sum, tk) => sum + getTeamMembersCount(tk), 0);
                                                        }
                                                
                                                        // ============================================================
                                                        // Render: dĺžka jazdy sa zobrazí VŽDY (ak je vypočítateľná),
                                                        // počet členov len ak je > 0.
                                                        // ============================================================
                                                        return React.createElement(
                                                            React.Fragment,
                                                            null,
                                                            // 1) Počet členov v autobuse (len ak > 0)
                                                            total > 0 &&
                                                                React.createElement(
                                                                    'span',
                                                                    {
                                                                        className: 'flex items-center gap-1 text-blue-700',
                                                                        title: `V autobuse v tomto čase: ${total} členov`,
                                                                    },
                                                                    React.createElement('i', { className: 'fa-solid fa-users' }),
                                                                    `${total}`
                                                                ),
                                                            // 2) Dĺžka jazdy (trvanie) – vždy, ak je vypočítateľná
                                                            tripDurationMin != null &&
                                                                React.createElement(
                                                                    'span',
                                                                    {
                                                                        className: 'flex items-center gap-1 text-amber-700',
                                                                        title: `Dĺžka jazdy: ${tripDurationMin} min (${boardingRow.timeFrom} → ${alightingRow.timeTo})`,
                                                                    },
                                                                    React.createElement('i', { className: 'fa-solid fa-clock' }),
                                                                    `${tripDurationMin} min`
                                                                )
                                                        );
                                                    })(),
                                                    React.createElement(
                                                        'div',
                                                        { className: 'flex flex-col items-end gap-1' },
                                                        hasBoarding && React.createElement(
                                                            'span',
                                                            { className: 'flex items-center gap-1 text-emerald-600' },
                                                            React.createElement('i', { className: 'fa-solid fa-right-to-bracket' }),
                                                            'Nástup'
                                                        ),
                                                        hasAlighting && React.createElement(
                                                            'span',
                                                            { className: 'flex items-center gap-1 text-red-600' },
                                                            React.createElement('i', { className: 'fa-solid fa-right-from-bracket' }),
                                                            'Výstup'
                                                        )
                                                    )
                                                )
                                            )
                                        )
                                    );
                                }).filter(Boolean)
                            )
                        );
                    })(),
        
                    // ============================================================
                    // TLAČIDLÁ – used currentTransfer
                    // ============================================================
                    React.createElement(
                        'div',
                        { className: 'flex justify-end gap-3' },
                        React.createElement(
                            'button',
                            {
                                type: 'button',
                                onClick: () => {
                                    setShowAssignBusModal(false);
                                    setAssignBusTransfer(null);
                                },
                                disabled: assignBusSaving,
                                className: 'px-4 py-2 rounded-lg border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors disabled:opacity-60'
                            },
                            'Zrušiť'
                        ),
                        (() => {
                            // ============================================================
                            // Zisti, či má byť tlačidlo zablokované.
                            //
                            // POZOR: Zámerne TU NIE JE kontrola
                            // `!arePreviousSegmentsResolved(currentTransfer)`.
                            // Tlačidlo „Priradiť" sa nemá blokovať kvôli
                            // nevyriešeným predchádzajúcim segmentom – tie
                            // sa dajú priradiť neskôr.
                            // ============================================================
                            const isBlocked =
                                assignBusSaving ||
                                !assignBusSelectedKey ||
                                assignBusMatches.length === 0;
                        
                            const baseCls =
                                'px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2';
                            // Odblokované: oranžová výplň, biely text
                            const enabledCls = 'bg-amber-600 text-white hover:bg-amber-700';
                            // Zablokované: biele pozadie, oranžový text, oranžové rámovanie,
                            // cursor: not-allowed (zakázaná myš)
                            const blockedCls =
                                'bg-white border-2 border-amber-600 text-amber-600 cursor-not-allowed';
                        
                            return React.createElement(
                                'button',
                                {
                                    type: 'button',
                                    onClick: assignTransferToBus,
                                    disabled: isBlocked,
                                    title: isBlocked
                                        ? 'Tlačidlo je neaktívne – najprv vyberte autobus.'
                                        : undefined,
                                    className: `${baseCls} ${isBlocked ? blockedCls : enabledCls}`,
                                },
                                assignBusSaving && React.createElement('i', { className: 'fa-solid fa-spinner fa-spin' }),
                                'Priradiť'
                            );
                        })()
                    )
                )
            );
        })() || null,
        // ============================================================
        // MODÁLNE OKNO – Odstrániť príznak "peši"
        // ============================================================
        removeWalkingModal && React.createElement(
            'div',
            {
                className: 'fixed inset-0 bg-black/50 flex items-center justify-center z-[100001] p-4',
                onClick: () => setRemoveWalkingModal(null)
            },
            React.createElement(
                'div',
                {
                    className: 'bg-white rounded-xl shadow-2xl max-w-md w-full p-6',
                    onClick: (e) => e.stopPropagation()
                },
                React.createElement(
                    'div',
                    { className: 'flex items-start gap-3 mb-4' },
                    React.createElement('i', {
                        className: 'fa-solid fa-person-walking text-emerald-600 text-2xl mt-0.5'
                    }),
                    React.createElement(
                        'h3',
                        { className: 'text-lg font-semibold text-gray-800' },
                        'Odstrániť príznak „peši"'
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700' },
                    React.createElement('div', { className: 'font-medium' },
                        `${removeWalkingModal.transfer.fromLocation} → ${removeWalkingModal.transfer.toLocation}`),
                    React.createElement('div', { className: 'text-xs text-gray-500 mt-1' },
                        `${removeWalkingModal.transfer.teamName || ''}${removeWalkingModal.transfer.when ? ' • ' + removeWalkingModal.transfer.when : ''}`)
                ),
                React.createElement(
                    'p',
                    { className: 'text-sm text-gray-600 mb-4' },
                    'Presun sa tým vráti späť medzi vygenerované presuny a bude ho možné znova upraviť, priradiť autobusu alebo označiť ako peši.'
                ),
                React.createElement(
                    'div',
                    { className: 'flex justify-end gap-3' },
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: () => setRemoveWalkingModal(null),
                            disabled: removeWalkingSaving,
                            className: 'px-4 py-2 rounded-lg border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors disabled:opacity-60'
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: removeWalkingFlag,
                            disabled: removeWalkingSaving,
                            className: 'px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center gap-2'
                        },
                        removeWalkingSaving && React.createElement('i', { className: 'fa-solid fa-spinner fa-spin' }),
                        'Odstrániť'
                    )
                )
            )
        ),
        // ============================================================
        // MODÁLNE OKNO – Potvrdenie odstránenia konkrétneho presunu
        // ============================================================
        deleteTransferModal && React.createElement(
            'div',
            {
                className: 'fixed inset-0 bg-black/50 flex items-center justify-center z-[100001] p-4',
                onClick: () => setDeleteTransferModal(null)
            },
            React.createElement(
                'div',
                {
                    className: 'bg-white rounded-xl shadow-2xl max-w-md w-full p-6',
                    onClick: (e) => e.stopPropagation()
                },
                React.createElement(
                    'div',
                    { className: 'flex items-start gap-3 mb-4' },
                    React.createElement('i', {
                        className: 'fa-solid fa-trash text-red-600 text-2xl mt-0.5'
                    }),
                    React.createElement(
                        'h3',
                        { className: 'text-lg font-semibold text-gray-800' },
                        'Odstrániť presun'
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700' },
                    React.createElement('div', { className: 'font-medium' },
                        `${deleteTransferModal.transfer.fromLocation} → ${deleteTransferModal.transfer.toLocation}`),
                    React.createElement('div', { className: 'text-xs text-gray-500 mt-1' },
                        `${deleteTransferModal.transfer.teamName || ''}${deleteTransferModal.transfer.when ? ' • ' + deleteTransferModal.transfer.when : ''}`)
                ),
                React.createElement(
                    'p',
                    { className: 'text-sm text-gray-600 mb-4' },
                    'Naozaj chcete odstrániť tento konkrétny presun? Táto akcia je nenávratná.'
                ),
                React.createElement(
                    'div',
                    { className: 'flex justify-end gap-3' },
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: () => setDeleteTransferModal(null),
                            disabled: deleteTransferSaving,
                            className: 'px-4 py-2 rounded-lg border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors disabled:opacity-60'
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: () => deleteSingleTransfer(deleteTransferModal.transfer),
                            disabled: deleteTransferSaving,
                            className: 'px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center gap-2'
                        },
                        deleteTransferSaving && React.createElement('i', { className: 'fa-solid fa-spinner fa-spin' }),
                        'Odstrániť'
                    )
                )
            )
        ),
        // ============================================================
        // MODÁLNE OKNO – Potvrdenie regenerácie presunov pre kategóriu
        // ============================================================
        regenTransfersModal && React.createElement(
            'div',
            {
                className: 'fixed inset-0 bg-black/50 flex items-center justify-center z-[100001] p-4',
                onClick: () => setRegenTransfersModal(null)
            },
            React.createElement(
                'div',
                {
                    className: 'bg-white rounded-xl shadow-2xl max-w-md w-full p-6',
                    onClick: (e) => e.stopPropagation()
                },
                React.createElement(
                    'div',
                    { className: 'flex items-start gap-3 mb-4' },
                    React.createElement('i', {
                        className: 'fa-solid fa-triangle-exclamation text-amber-500 text-2xl mt-0.5'
                    }),
                    React.createElement(
                        'h3',
                        { className: 'text-lg font-semibold text-gray-800' },
                        'Presuny už boli vygenerované'
                    )
                ),
                React.createElement(
                    'p',
                    { className: 'text-sm text-gray-700 mb-4' },
                    `Pre kategóriu „${regenTransfersModal.category}" už existuje ${regenTransfersModal.existingCount} presunov.`,
                    ' ',
                    'Chcete časovú os vygenerovať znova?',
                    ' ',
                    'Existujúce presuny (s rovnakým tímom, časom a trasou) zostanú zachované a dogenerujú sa len tie, ktoré chýbajú.'
                ),
                React.createElement(
                    'div',
                    { className: 'mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg' },
                    React.createElement(
                        'p',
                        { className: 'text-xs text-amber-700 flex items-start gap-2' },
                        React.createElement('i', { className: 'fa-solid fa-circle-info mt-0.5' }),
                        React.createElement(
                            'span',
                            null,
                            'Presuny, ktoré ste už manuálne upravili (označili ako „peši", pridali medzizastávky alebo ich priradili autobusu), zostanú nedotknuté.'
                        )
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'flex justify-end gap-3' },
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: () => setRegenTransfersModal(null),
                            className: 'px-4 py-2 rounded-lg border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors'
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: async () => {
                                const cat = regenTransfersModal.category;
                                setRegenTransfersModal(null);
                                timelineGenerationRequestedRef.current = true;
                                rebuildAndLogTimeline(true, cat);
                                window.showGlobalNotification(
                                    `Časová os pre kategóriu ${cat} bola znova vygenerovaná (dogenerované len chýbajúce).`,
                                    'success'
                                );
                            },
                            className: 'px-4 py-2 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-700 transition-colors'
                        },
                        'Vygenerovať znova'
                    )
                )
            )
        ),
        // ============================================================
        // NOVÉ: MODÁLNE OKNO – Úprava skratky tímu
        // ============================================================
        shortcutEditModal && React.createElement(
            'div',
            {
                className: 'fixed inset-0 bg-black/50 flex items-center justify-center z-[100001] p-4',
                onClick: () => setShortcutEditModal(null)
            },
            React.createElement(
                'div',
                {
                    className: 'bg-white rounded-xl shadow-2xl max-w-md w-full p-6',
                    onClick: (e) => e.stopPropagation()
                },
                React.createElement(
                    'div',
                    { className: 'flex items-start gap-3 mb-4' },
                    React.createElement('i', {
                        className: 'fa-solid fa-tag text-orange-600 text-2xl mt-0.5'
                    }),
                    React.createElement(
                        'div',
                        { className: 'flex-1' },
                        React.createElement(
                            'h3',
                            { className: 'text-lg font-semibold text-gray-800' },
                            shortcutEditModal.shortcut ? 'Upraviť skratku tímu' : 'Pridať skratku tímu'
                        ),
                        React.createElement(
                            'p',
                            { className: 'text-xs text-gray-500 mt-0.5' },
                            `${shortcutEditModal.category} • ${shortcutEditModal.teamName}`
                        )
                    )
                ),
                React.createElement(
                    'label',
                    { className: 'block text-sm font-medium text-gray-700 mb-1' },
                    'Skratka'
                ),
                React.createElement('input', {
                    type: 'text',
                    autoFocus: true,
                    value: shortcutEditModal.shortcut || '',
                    onChange: (e) => {
                        const v = e.target.value.toLocaleUpperCase('sk-SK');
                        setShortcutEditModal((prev) => prev ? { ...prev, shortcut: v } : prev);
                        // ============================================================
                        // NOVÉ: Live kontrola konfliktu – hneď po zadaní znaku
                        // over, či skratka neexistuje pre iný tím v tej istej
                        // kategórii. Ak áno, nastav `shortcutConflict` a zobraz
                        // chybovú hlášku pod inputom.
                        // ============================================================
                        const trimmed = String(v || '').trim();
                        if (!trimmed) {
                            setShortcutConflict(null);
                            return;
                        }
                        const cat = cleanCategory(shortcutEditModal.category || '');
                        const currentTeam = String(shortcutEditModal.teamName || '').trim();
                        let conflict = null;
                        Object.entries(teamShortcuts || {}).forEach(([key, shortcutVal]) => {
                            const [kCat, kTeam] = String(key).split('|');
                            if (cleanCategory(kCat) !== cat) return;
                            if (String(kTeam || '').trim() === currentTeam) return; // vlastná skratka
                            const normalized = String(shortcutVal || '').trim().toLocaleUpperCase('sk-SK');
                            if (normalized && normalized === trimmed) {
                                conflict = {
                                    conflictingTeamName: String(kTeam || '').trim(),
                                    conflictingCategory: cleanCategory(kCat),
                                };
                            }
                        });
                        setShortcutConflict(conflict);
                    },
                    onKeyDown: async (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            // ============================================================
                            // NOVÉ: Ak existuje konflikt, Enter nesmie uložiť.
                            // ============================================================
                            if (shortcutConflict) return;
                            const m = shortcutEditModal;
                            if (!m) return;
                            await saveTeamShortcut(m.category, m.teamName, m.shortcut);
                            setShortcutEditModal(null);
                            setShortcutConflict(null);
                        }
                    },
                    className: 'w-full px-3 py-2 text-sm border border-gray-300 rounded text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 mb-4'
                }),
                // ============================================================
                // NOVÉ: Ak existuje konflikt, zobraz červenú chybovú hlášku
                // pod inputom (nad pomocným textom).
                // ============================================================
                shortcutConflict &&
                    React.createElement(
                        'div',
                        {
                            className: 'mb-3 p-2 rounded-md bg-red-50 border border-red-300 text-sm text-red-700 flex items-start gap-2'
                        },
                        React.createElement('i', { className: 'fa-solid fa-triangle-exclamation mt-0.5' }),
                        React.createElement(
                            'span',
                            null,
                            'Táto skratka „',
                            String(shortcutEditModal.shortcut || '').trim(),
                            '" už existuje pre tím „',
                            shortcutConflict.conflictingTeamName,
                            '" v kategórii „',
                            shortcutConflict.conflictingCategory,
                            '". Zvoľte inú skratku.'
                        )
                    ),
                React.createElement(
                    'p',
                    { className: 'text-xs text-gray-500 mb-4 italic' },
                    'Prázdna hodnota skratku odstráni (zobrazí sa plný názov tímu).'
                ),
                React.createElement(
                    'div',
                    { className: 'flex justify-end gap-3' },
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: () => {
                                setShortcutEditModal(null);
                                setShortcutConflict(null);
                            },
                            disabled: shortcutSaving,
                            className: 'px-4 py-2 rounded-lg border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors disabled:opacity-60'
                        },
                        'Zrušiť'
                    ),
                    (() => {
                        // ============================================================
                        // NOVÉ: Tlačidlo „Uložiť" je zablokované, ak:
                        //  - beží ukladanie (shortcutSaving), alebo
                        //  - existuje konflikt skratky (shortcutConflict).
                        //
                        // Vizuál zablokovaného tlačidla:
                        //  - biele pozadie
                        //  - oranžový obrys a oranžový text (rovnaká farba ako
                        //    výplň odblokovaného tlačidla)
                        //  - cursor: not-allowed (disabled myš)
                        // ============================================================
                        const isBlocked = shortcutSaving || !!shortcutConflict;

                        const baseCls = 'px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2';
                        const enabledCls = 'bg-orange-600 text-white hover:bg-orange-700';
                        const blockedCls = 'bg-white border-2 border-orange-600 text-orange-600 cursor-not-allowed';

                        return React.createElement(
                            'button',
                            {
                                type: 'button',
                                onClick: async () => {
                                    if (isBlocked) return;
                                    const m = shortcutEditModal;
                                    if (!m) return;
                                    await saveTeamShortcut(m.category, m.teamName, m.shortcut);
                                    setShortcutEditModal(null);
                                },
                                disabled: isBlocked,
                                title: shortcutConflict
                                    ? 'Skratka už existuje pre iný tím v tejto kategórii.'
                                    : undefined,
                                className: `${baseCls} ${isBlocked ? blockedCls : enabledCls}`,
                            },
                            shortcutSaving && React.createElement('i', { className: 'fa-solid fa-spinner fa-spin' }),
                            'Uložiť'
                        );
                    })()
                )
            )
        ),
        // ============================================================
        // NOVÉ: MODÁLNE OKNO – Potvrdenie zmazania skratky tímu
        // ============================================================
        deleteShortcutModal && React.createElement(
            'div',
            {
                className: 'fixed inset-0 bg-black/50 flex items-center justify-center z-[100002] p-4',
                onClick: () => {
                    if (deleteShortcutSaving) return;
                    setDeleteShortcutModal(null);
                }
            },
            React.createElement(
                'div',
                {
                    className: 'bg-white rounded-xl shadow-2xl max-w-md w-full p-6',
                    onClick: (e) => e.stopPropagation()
                },
                React.createElement(
                    'div',
                    { className: 'flex items-start gap-3 mb-4' },
                    React.createElement('i', {
                        className: 'fa-solid fa-tag text-red-600 text-2xl mt-0.5'
                    }),
                    React.createElement(
                        'h3',
                        { className: 'text-lg font-semibold text-gray-800' },
                        'Odstrániť skratku tímu'
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700' },
                    React.createElement(
                        'div',
                        { className: 'font-medium' },
                        `${deleteShortcutModal.teamName}`
                    ),
                    React.createElement(
                        'div',
                        { className: 'text-xs text-gray-500 mt-1' },
                        `Kategória: ${deleteShortcutModal.category}`
                    ),
                    React.createElement(
                        'div',
                        { className: 'text-xs text-gray-500 mt-1' },
                        `Aktuálna skratka: `,
                        React.createElement(
                            'span',
                            { className: 'font-semibold text-orange-600' },
                            deleteShortcutModal.shortcut
                        )
                    )
                ),
                React.createElement(
                    'p',
                    { className: 'text-sm text-gray-600 mb-4' },
                    'Naozaj chcete odstrániť túto skratku? V plánovaní sa potom pre tím zobrazí plný názov. Táto akcia je nenávratná.'
                ),
                React.createElement(
                    'div',
                    { className: 'flex justify-end gap-3' },
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: () => setDeleteShortcutModal(null),
                            disabled: deleteShortcutSaving,
                            className: 'px-4 py-2 rounded-lg border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors disabled:opacity-60'
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: () => deleteTeamShortcut(
                                deleteShortcutModal.category,
                                deleteShortcutModal.teamName
                            ),
                            disabled: deleteShortcutSaving,
                            className: 'px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center gap-2'
                        },
                        deleteShortcutSaving && React.createElement('i', { className: 'fa-solid fa-spinner fa-spin' }),
                        'Odstrániť'
                    )
                )
            )
        )
    );
};

let isEmailSyncListenerSetup = false;

const handleDataUpdateAndRender = (event) => {
    const userProfileData = event.detail;
    const rootElement = document.getElementById('root');

    if (userProfileData) {
        if (window.auth && window.db && !isEmailSyncListenerSetup) {
            onAuthStateChanged(window.auth, async (user) => {
                if (user) {
                    try {
                        // E-MAIL SYNCHRONIZUJEME DO usersprivate, NIE DO users
                        const userPrivateRef = doc(window.db, 'usersprivate', user.uid);
                        const privateSnap = await getDoc(userPrivateRef);
                        if (privateSnap.exists()) {
                            const privateFirestoreEmail = privateSnap.data().email;
                            if (user.email !== privateFirestoreEmail) {
                                await updateDoc(userPrivateRef, { email: user.email });
                                const notificationsCollectionRef = collection(window.db, 'notifications');
                                await addDoc(notificationsCollectionRef, {
                                    userEmail: user.email,
                                    changes: `Zmena e-mailovej adresy z '${privateFirestoreEmail || '-'}' na '${user.email}'.`,
                                    timestamp: new Date(),
                                });
                                window.showGlobalNotification('E-mailová adresa bola automaticky aktualizovaná v usersprivate.', 'success');
                            }
                        } else {
                            // Ak usersprivate dokument neexistuje, vytvoríme ho s e-mailom
                            await setDoc(userPrivateRef, { email: user.email }, { merge: true });
                        }
                    } catch (error) {
                        window.showGlobalNotification('Nastala chyba pri synchronizácii e-mailovej adresy.', 'error');
                    }
                }
            });
            isEmailSyncListenerSetup = true;
        }

        if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
            const root = ReactDOM.createRoot(rootElement);
            root.render(React.createElement(TransportApp, { userProfileData }));
        }
    } else {
        if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
            const root = ReactDOM.createRoot(rootElement);
            root.render(
                React.createElement(
                    'div',
                    { className: 'flex justify-center items-center h-full pt-16' },
                    React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
                )
            );
        }
    }
};

window.listAccommodationsByCategoryAndGroup = async (categoryName, groupName, visitedGroups = new Set()) => {
    if (!window.db) {
        console.error('[TRANSPORT] Firebase nie je inicializovaný (window.db chýba).');
        return;
    }
    if (!categoryName || !groupName) {
        console.error('[TRANSPORT] Zadajte dva parametre: názov kategórie a názov skupiny.');
        console.error('  Príklad: listAccommodationsByCategoryAndGroup("U12 D", "skupina F")');
        return;
    }

    const targetCategory = cleanCategory(categoryName);
    const targetGroup = String(groupName).trim();

    // Ak už bola táto skupina navštívená, vráť prázdne (predídeme cyklu)
    const groupKey = `${targetCategory}|${targetGroup}`;
    if (visitedGroups.has(groupKey)) {
        console.log(`[TRANSPORT] Skupina "${targetGroup}" už bola navštívená – preskakujem.`);
        return [];
    }
    visitedGroups.add(groupKey);

    const targetGroupLastChar = targetGroup.replace(/\s+/g, '').slice(-1).toUpperCase();

    const nameEndsWithTargetChar = (teamName) => {
        if (!targetGroupLastChar) return false;
        const match = /\d([A-ZÁ-Ž])\s*$/.exec(String(teamName).trim());
        if (!match) return false;
        return match[1].toUpperCase() === targetGroupLastChar;
    };

    try {
        const usersRef = collection(window.db, 'users');
        const usersSnap = await getDocs(usersRef);

        const teamsByGroupName = {};
        const accommodationByTeamName = {};

        usersSnap.forEach((userDoc) => {
            const userData = userDoc.data() || {};
            const teams = userData.teams;
            if (!teams || typeof teams !== 'object') return;

            Object.entries(teams).forEach(([category, teamArray]) => {
                if (!Array.isArray(teamArray)) return;
                if (cleanCategory(category) !== targetCategory) return;

                teamArray.forEach((team) => {
                    if (!team || !team.teamName) return;
                    const trimmedName = team.teamName.trim();
                    const teamGroup = team.groupName ? String(team.groupName).trim() : null;
                    const accomName = team.accommodation?.name?.trim?.() || '';

                    if (teamGroup) {
                        if (!teamsByGroupName[teamGroup]) teamsByGroupName[teamGroup] = new Set();
                        teamsByGroupName[teamGroup].add(trimmedName);
                    }

                    if (accomName) {
                        if (!accommodationByTeamName[trimmedName]) {
                            accommodationByTeamName[trimmedName] = new Set();
                        }
                        accommodationByTeamName[trimmedName].add(accomName);
                    }
                });
            });
        });

        // 1) PRIAMA ZHODA
        if (teamsByGroupName[targetGroup] && teamsByGroupName[targetGroup].size > 0) {
            const directAccommodations = new Set();
            teamsByGroupName[targetGroup].forEach((teamName) => {
                const accoms = accommodationByTeamName[teamName];
                if (accoms) accoms.forEach((a) => directAccommodations.add(a));
            });

            const sorted = [...directAccommodations].sort((a, b) =>
                a.localeCompare(b, 'sk', { sensitivity: 'base' })
            );

            console.log(`[TRANSPORT] ===== UBYTOVNE PRE KATEGÓRIU ${targetCategory} A SKUPINU ${targetGroup} =====`);
            if (sorted.length === 0) {
                console.log('[TRANSPORT] Žiadne priradené ubytovne sa nenašli.');
            } else {
                sorted.forEach((name) => console.log(`   • ${name}`));
            }
            console.log(`[TRANSPORT] Spolu: ${sorted.length} jedinečných ubytovní.`);
            console.log('[TRANSPORT] =========================================================');

            return sorted;
        }

        // 2) FALLBACK
        console.log(`[TRANSPORT] Skupina "${targetGroup}" sa nenašla v users – spúšťam fallback cez matches.`);

        const matchesRef = collection(window.db, 'matches');
        const matchesSnap = await getDocs(matchesRef);

        const allCategoryMatches = [];
        matchesSnap.forEach((docSnap) => {
            const data = docSnap.data() || {};
            const matchCategory = cleanCategory(data.categoryName || data.categoryId || '');
            if (matchCategory !== targetCategory) return;
            allCategoryMatches.push(data);
        });

        const teamsInTargetGroup = new Set();

        allCategoryMatches.forEach((data) => {
            const matchGroupName = data.groupName ? String(data.groupName).trim() : null;

            const candidates = [];
            if (data.homeTeamIdentifier) candidates.push(data.homeTeamIdentifier);
            if (data.awayTeamIdentifier) candidates.push(data.awayTeamIdentifier);

            candidates.forEach((identifier) => {
                const teamName = resolveTeamName(identifier);
                if (!teamName || teamName === '---') return;
                const trimmed = String(teamName).trim();
                if (!trimmed) return;

                if (nameEndsWithTargetChar(trimmed)) return;

                const matchesGroupByField =
                    matchGroupName && matchGroupName === targetGroup;
                if (matchesGroupByField) {
                    teamsInTargetGroup.add(trimmed);
                }
            });
        });

        console.log(
            `[TRANSPORT] Fallback – tímy v skupine "${targetGroup}" (z matches, bez tímov končiacich na "${targetGroupLastChar}"):`,
            [...teamsInTargetGroup]
        );

        const findGroupsInUsersByChar = (char) => {
            const result = new Set();
            Object.keys(teamsByGroupName).forEach((gName) => {
                const gLastChar = gName.trim().slice(-1).toUpperCase();
                if (gLastChar === char) result.add(gName);
            });
            return result;
        };

        const fallbackAccommodations = new Set();
        const visitedChars = new Set();

        // Priame ubytovne pre tímy v cieľovej skupine
        teamsInTargetGroup.forEach((teamName) => {
            const accoms = accommodationByTeamName[teamName];
            if (accoms) accoms.forEach((a) => fallbackAccommodations.add(a));
        });

        console.log(
            `[TRANSPORT] Fallback – priame ubytovne pre tímy v skupine "${targetGroup}":`,
            [...fallbackAccommodations]
        );

        const initialChars = new Set();
        teamsInTargetGroup.forEach((teamName) => {
            const m = /\d([A-ZÁ-Ž])\s*$/.exec(String(teamName).trim());
            if (m) initialChars.add(m[1].toUpperCase());
        });

        console.log(
            `[TRANSPORT] Fallback – počiatočné písmená z tímov v skupine "${targetGroup}":`,
            [...initialChars]
        );

        const queue = [...initialChars];

        while (queue.length > 0) {
            const char = queue.shift();
            if (visitedChars.has(char)) continue;
            visitedChars.add(char);

            // 1) Skús nájsť existujúce skupiny v users pre toto písmeno
            const groupsInUsers = findGroupsInUsersByChar(char);
            if (groupsInUsers.size > 0) {
                console.log(
                    `[TRANSPORT] Fallback – pre písmeno "${char}" existujú skupiny v users:`,
                    [...groupsInUsers]
                );
                groupsInUsers.forEach((gName) => {
                    const teamsInGroup = teamsByGroupName[gName];
                    if (!teamsInGroup) return;
                    teamsInGroup.forEach((teamName) => {
                        const accoms = accommodationByTeamName[teamName];
                        if (accoms) accoms.forEach((a) => fallbackAccommodations.add(a));
                    });
                });
                continue;
            }

            // 2) Ak neexistujú skupiny v users, rekurzívne zavolaj tú istú funkciu
            //    pre skupinu zodpovedajúcu písmenu (napr. "D" → "skupina D")
            const derivedGroupName = `skupina ${char}`;
            console.log(
                `[TRANSPORT] Fallback – pre písmeno "${char}" neexistuje skupina v users, rekurzívne volám listAccommodationsByCategoryAndGroup("${targetCategory}", "${derivedGroupName}")`
            );

            try {
                const recursiveResult = await window.listAccommodationsByCategoryAndGroup(
                    targetCategory,
                    derivedGroupName,
                    visitedGroups
                );
                if (Array.isArray(recursiveResult)) {
                    recursiveResult.forEach((a) => fallbackAccommodations.add(a));
                }
            } catch (recursiveErr) {
                console.error(
                    `[TRANSPORT] Fallback – chyba pri rekurzívnom volaní pre "${derivedGroupName}":`,
                    recursiveErr
                );
            }
        }

        const sorted = [...fallbackAccommodations].sort((a, b) =>
            a.localeCompare(b, 'sk', { sensitivity: 'base' })
        );

        console.log(`[TRANSPORT] ===== UBYTOVNE PRE KATEGÓRIU ${targetCategory} A SKUPINU ${targetGroup} (fallback) =====`);
        if (sorted.length === 0) {
            console.log('[TRANSPORT] Žiadne priradené ubytovne sa nenašli (ani cez fallback).');
        } else {
            sorted.forEach((name) => console.log(`   • ${name}`));
        }
        console.log(`[TRANSPORT] Spolu: ${sorted.length} jedinečných ubytovní.`);
        console.log('[TRANSPORT] =========================================================');

        return sorted;
    } catch (err) {
        console.error('[TRANSPORT] Chyba pri načítaní ubytovní pre kategóriu a skupinu:', err);
        return [];
    }
};

window.addEventListener('globalDataUpdated', handleDataUpdateAndRender);

if (window.globalUserProfileData) {
    handleDataUpdateAndRender({ detail: window.globalUserProfileData });
} else {
    const rootElement = document.getElementById('root');
    if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
        const root = ReactDOM.createRoot(rootElement);
        root.render(
            React.createElement(
                'div',
                { className: 'flex justify-center items-center h-full pt-16' },
                React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
            )
        );
    }
}

window.listTeamsByCategoryAndGroup = async (categoryName, groupName) => {
    if (!window.db) {
        console.error('[TRANSPORT] Firebase nie je inicializovaný (window.db chýba).');
        return;
    }
    if (!categoryName || !groupName) {
        console.error('[TRANSPORT] Zadajte dva parametre: názov kategórie a názov skupiny.');
        console.error('  Príklad: listTeamsByCategoryAndGroup("U12 D", "skupina D")');
        return;
    }

    const targetCategory = cleanCategory(categoryName);
    const targetGroup = String(groupName).trim();

    try {
        // 1) Registrované tímy z users
        const usersRef = collection(window.db, 'users');
        const usersSnap = await getDocs(usersRef);

        const teamsSet = new Set();
        const registeredTeamNames = new Set(); // pre rozlíšenie superstructure

        usersSnap.forEach((userDoc) => {
            const userData = userDoc.data() || {};
            const teams = userData.teams;
            if (!teams || typeof teams !== 'object') return;

            Object.entries(teams).forEach(([category, teamArray]) => {
                if (!Array.isArray(teamArray)) return;
                if (cleanCategory(category) !== targetCategory) return;

                teamArray.forEach((team) => {
                    if (!team || !team.teamName) return;

                    const teamGroup = team.groupName ? String(team.groupName).trim() : null;
                    if (!teamGroup || teamGroup !== targetGroup) return;

                    const trimmed = team.teamName.trim();
                    teamsSet.add(trimmed);
                    registeredTeamNames.add(trimmed);
                });
            });
        });

        // 2) Superstructure tímy z matches – IBA ak majú v zápase groupName presne rovný zadanej skupine
        const matchesRef = collection(window.db, 'matches');
        const matchesSnap = await getDocs(matchesRef);

        matchesSnap.forEach((docSnap) => {
            const data = docSnap.data() || {};
            const matchCategory = cleanCategory(data.categoryName || data.categoryId || '');
            if (matchCategory !== targetCategory) return;

            const matchGroupName = data.groupName ? String(data.groupName).trim() : null;
            if (!matchGroupName || matchGroupName !== targetGroup) return;

            const candidates = [];
            if (data.homeTeamIdentifier) candidates.push(data.homeTeamIdentifier);
            if (data.awayTeamIdentifier) candidates.push(data.awayTeamIdentifier);

            candidates.forEach((identifier) => {
                const teamName = resolveTeamName(identifier);
                if (!teamName || teamName === '---') return;
                const trimmed = String(teamName).trim();
                if (!trimmed) return;

                // Ak je to registrovaný tím, už je v sete
                if (registeredTeamNames.has(trimmed)) return;

                teamsSet.add(trimmed);
            });
        });

        const sortedTeams = [...teamsSet].sort((a, b) =>
            a.localeCompare(b, 'sk', { sensitivity: 'base' })
        );

        console.log(`[TRANSPORT] ===== TÍMY PRE KATEGÓRIU ${targetCategory} A SKUPINU ${targetGroup} =====`);
        if (sortedTeams.length === 0) {
            console.log('[TRANSPORT] Žiadne tímy sa nenašli.');
        } else {
            sortedTeams.forEach((name) => {
                const isRegistered = registeredTeamNames.has(name);
                const tag = isRegistered ? '' : ' [superstructure]';
                console.log(`   • ${name}${tag}`);
            });
        }
        console.log(`[TRANSPORT] Spolu: ${sortedTeams.length} tímov.`);
        console.log('[TRANSPORT] =========================================================');

        return sortedTeams;
    } catch (err) {
        console.error('[TRANSPORT] Chyba pri načítaní tímov pre kategóriu a skupinu:', err);
        return [];
    }
};
