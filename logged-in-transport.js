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

const TransportApp = ({ userProfileData }) => {
    const timelineGenerationRequestedRef = useRef(false);
    // Mapa placeId → placeName
    const placesMapRef = useRef({});

    // Lookup pre názvy tímov (userId|category|teamIndex → teamName)
    const teamsLookupRef = useRef({});

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
    const [selectedDayKey, setSelectedDayKey] = useState('');
    const [savedTransfers, setSavedTransfers] = useState([]);
    // Farba dopravy pre kategórie (na re-render pri zmene)
    const [transportColors, setTransportColors] = useState({});
    // ==== MODÁLNE OKNO PRE VÝBER KATEGÓRIE (tlačidlo "+") ====
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [selectedCategoryForTimeline, setSelectedCategoryForTimeline] = useState('');

    // ==== MODÁLNE OKNO PRE MAZANIE PRESUNOV (červená polovica FAB) ====
    const [showDeleteTransfersModal, setShowDeleteTransfersModal] = useState(false);
    const [selectedCategoryForDelete, setSelectedCategoryForDelete] = useState('');
    
    // ==== VAROVANIE: CHÝBAJÚCE TRVANIE JÁZDY ====
    const [missingTravelTimeWarning, setMissingTravelTimeWarning] = useState([]);

    // ==== MODÁLNE OKNO PRE ÚPRAVU VYGENEROVANÉHO PRESUNU ====
    const [editingTransfer, setEditingTransfer] = useState(null);
    const [editingTransferStops, setEditingTransferStops] = useState([]); // medzizastávky medzi from a to
    const [editingTransferSaving, setEditingTransferSaving] = useState(false);

    // ==== ROZHODOVACIE MODÁLNE OKNO PO KLIKNUTÍ NA PRESUN ====
    const [transferActionModal, setTransferActionModal] = useState(null); // { transfer }
    const [showAssignBusModal, setShowAssignBusModal] = useState(false);
    const [assignBusMatches, setAssignBusMatches] = useState([]); // pole { bus, row, side } – side = 'in' | 'out'
    const [assignBusSelectedKey, setAssignBusSelectedKey] = useState(''); // `${busId}|${rowId}|${side}`
    const [assignBusSaving, setAssignBusSaving] = useState(false);
    const [mergeMode, setMergeMode] = useState(false);

    // ==== MODÁLNE OKNO PRE ZLÚČENIE PRESUNOV ====
    const [mergeTransfersModal, setMergeTransfersModal] = useState(null); // { first, second }
    const [mergeTransfersSaving, setMergeTransfersSaving] = useState(false);

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
            console.warn('[TRANSPORT] printTeamTimeline: Zadajte názov tímu, napr. "U12 CH 1C".');
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
        // Ak používateľ ešte neklikol na tlačidlo "+", negeneruj časovú os
        // (pokiaľ nie je volanie vynútené cez force=true, napr. z printTeamTimeline)
        if (!force && !timelineGenerationRequestedRef.current) {
            return;
        }
        if (!matchesLoadedRef.current || !cateringLoadedRef.current || !teamsLoadedRef.current) {
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
                                
                                    const isGlobalFirstDay =
                                        currentDay != null &&
                                        globalFirstDay != null &&
                                        currentDay === globalFirstDay;
                                
                                    const useExternalStopOnFirstDay =
                                        isGlobalFirstDay &&
                                        hasTransportType &&
                                        !!externalArrivalStop;
                                
                                    const useAccommodationAsSource = (() => {
                                        if (!isGlobalFirstDay) {
                                            return shouldGenerateAccommodationTransfers;
                                        }
                                        return hasTransportType
                                            && !useExternalStopOnFirstDay
                                            && shouldGenerateAccommodationTransfers;
                                    })();
                                
                                    const shouldGenerateMorningTransfer =
                                        useExternalStopOnFirstDay || useAccommodationAsSource;
                                
                                    if (shouldGenerateMorningTransfer) {
                                        const morningFromLocations = (() => {
                                            if (useExternalStopOnFirstDay) {
                                                return [{
                                                    name: externalArrivalStop.name,
                                                    isExternalStop: true,
                                                }];
                                            }
                                            if (useAccommodationAsSource) {
                                                return teamAccommodationsList.map((n) => ({ name: n, isExternalStop: false }));
                                            }
                                            return [];
                                        })();
                                
                                        morningFromLocations.forEach(({ name: fromLocationName, isExternalStop }) => {
                                            if (!fromLocationName) return;
                                            if (fromLocationName === current.location) return;
                                
                                            const fromLabel = isExternalStop
                                                ? `zastávka ${fromLocationName}`
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
                    // ============================================================
                    try {
                        const transfersForTeam = enriched.filter((ev) => ev.isTransfer === true);
                        if (transfersForTeam.length > 0 && window.db) {
                            const transfersPatch = {};
                            transfersForTeam.forEach((ev) => {
                                const key = buildTransferKey(category, teamName, ev.when, ev.text);
                                // Zisti from/to z textu "Presun z X do Y"
                                let fromLocation = '';
                                let toLocation = '';
                                const m = /^Presun z (.+?) do (.+)$/.exec(String(ev.text || ''));
                                if (m) {
                                    fromLocation = m[1].trim();
                                    toLocation = m[2].trim();
                                }
                                // Zisti, či už existuje záznam s rovnakým kľúčom (a zachovaj manuálne úpravy)
                                const existingSaved = savedTransfers.find((s) => s.key === key);

                                transfersPatch[key] = {
                                    category: cleanCategory(category),
                                    teamName: String(teamName).trim(),
                                    when: String(ev.when || '').trim(),
                                    text: String(ev.text || '').trim(),
                                    fromLocation,
                                    toLocation,
                                    dayKey: extractDayKeyFromWhen(ev.when) || null,
                                };

                                // Zachovaj manuálne pridané vlastnosti z existujúceho záznamu
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
                    
                            if (Object.keys(transfersPatch).length > 0) {
                                setDoc(
                                    doc(window.db, TRANSPORT_SETTINGS_COLLECTION, TRANSPORT_SETTINGS_DOC),
                                    {
                                        [TRANSPORT_TRANSFERS_FIELD]: transfersPatch,
                                    },
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
                    });
                });
                list.sort((a, b) => a.name.localeCompare(b.name, 'sk', { sensitivity: 'base' }));
                setAllPlaces(list);
                allPlacesRef.current = list; // okamžite aktualizuj ref

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
                            teamName: v.teamName || '',
                            when: v.when || '',
                            text: v.text || '',
                            fromLocation: v.fromLocation || '',
                            toLocation: v.toLocation || '',
                            dayKey: v.dayKey || null,
                            isWalking: v.isWalking === true,
                            walkingSetAt: v.walkingSetAt || null,
                            walkingSetBy: v.walkingSetBy || null,
                            intermediateStops: Array.isArray(v.intermediateStops) ? v.intermediateStops : [],  // ← NOVÉ
                        });
                    });
                    transfers.sort((a, b) => {
                        if (a.category !== b.category) {
                            return a.category.localeCompare(b.category, 'sk', { sensitivity: 'base' });
                        }
                        if (a.teamName !== b.teamName) {
                            return a.teamName.localeCompare(b.teamName, 'sk', { sensitivity: 'base' });
                        }
                        return String(a.when).localeCompare(String(b.when), 'sk');
                    });
                }
                setTravelTimes(map);
                setSavedTransfers(transfers);
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
                                userId: userDoc.id,
                            };
                        });
                    });
                });

                teamsLookupRef.current = lookup;
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
    }, [busRows, travelTimes, stopsList]);

    // ============================================================
    // NOVÉ: Automatická synchronizácia "Miesto od" s predchádzajúcim
    // riadkom. Ak predchádzajúci riadok má placeTo, aktuálny riadok
    // musí mať placeFrom = prevRow.placeTo.
    // ============================================================
    useEffect(() => {
        if (!window.db) return;
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
    }, [busRows]);

    // ============================================================
    // DETEKCIA CHÝBAJÚCICH TRVANÍ JÁZDY PRE RIADKY AUTOBUSOV
    // (placeFrom + placeTo vyplnené, ale travelTimes[fromId|toId] chýba)
    // ============================================================
    useEffect(() => {
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
    }, [busRows, travelTimes, stopsList]);

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

    // ============================================================
    // POSUN ČASOV RIADKOV PO ZMENE "timeFrom" V JEDNOM RIADKU
    // Posunie len riadky medzi aktuálnym riadkom a najbližším
    // "červeným" riadkom (medzera > 2 min). Za červeným riadkom
    // sa už nič neposúva.
    // ============================================================
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
            // Normalizácia do 0..1439
            total = ((total % (24 * 60)) + (24 * 60)) % (24 * 60);
            const endH = Math.floor(total / 60);
            const endM = total % 60;
            return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
        };
    
        // Zisti, ktoré nasledujúce riadky treba posunúť:
        // postupné od aktuálneho riadku ďalej, ale zastav pri prvom
        // "červenom" riadku (medzera > 2 min medzi prev.timeTo a next.timeFrom).
        const updates = [];
    
        for (let i = currentIdx + 1; i < allRows.length; i++) {
            const prev = allRows[i - 1];
            const curr = allRows[i];
    
            // Ak je medzi predchádzajúcim a aktuálnym riadkom medzera > 2 min,
            // aktuálny riadok je už ZA červeným riadkom → stop.
            const gap = getGapMinutes(prev.timeTo, curr.timeFrom);
            if (gap != null && gap > 2) {
                break;
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
    
        // 1) Skús priamo ID
        const keyId = `${placeFrom}|${placeTo}`;
        if (travelTimes[keyId] && travelTimes[keyId].minutes != null) {
            return Number(travelTimes[keyId].minutes);
        }
    
        // 2) Skús nájsť zastávky podľa názvu → ID
        const fromStop = stopsList.find((s) => s.name === placeFrom || s.id === placeFrom);
        const toStop = stopsList.find((s) => s.name === placeTo || s.id === placeTo);
        if (fromStop && toStop) {
            const key = `${fromStop.id}|${toStop.id}`;
            if (travelTimes[key] && travelTimes[key].minutes != null) {
                return Number(travelTimes[key].minutes);
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
            return `${teamName} • ${membersText} členov\nKliknutím odstrániť tím z celého autobusu (nástup aj výstup, všetky riadky)`;
        }
    
        return `${teamName}\nKliknutím odstrániť tím z celého autobusu (nástup aj výstup, všetky riadky)`;
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

        return [...inBus];
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
    // POMOCNÁ: zistí, či sa dva presuny dajú zlúčiť.
    // Podmienka: čas a miesto konca prvého presunu sa zhoduje
    // s časom a miestom začiatku druhého presunu.
    // (Rovnaký tím, kategória, deň.)
    // ============================================================
    const canMergeTransfers = (a, b) => {
        if (!a || !b) return false;
        if (a.key === b.key) return false;

        // Rovnaký tím a kategória
        const aTeam = String(a.teamName || '').trim();
        const bTeam = String(b.teamName || '').trim();
        const aCat = cleanCategory(a.category || '');
        const bCat = cleanCategory(b.category || '');
        if (aTeam !== bTeam || aCat !== bCat) return false;

        // Rovnaký deň
        const aDay = a.dayKey || '';
        const bDay = b.dayKey || '';
        if (!aDay || aDay !== bDay) return false;

        // Konec prvého = koniec intervalu z `when` (druhý timestamp)
        // a začiatok druhého = začiatok intervalu z `when` (prvý timestamp)
        const aRange = parseTransferWhenToRange(a.when);
        const bRange = parseTransferWhenToRange(b.when);
        if (!aRange || !bRange) return false;

        // Čas konca A musí byť rovnaký ako čas začiatku B
        if (aRange.endTs == null || bRange.startTs == null) return false;
        if (aRange.endTs !== bRange.startTs) return false;

        // Miesto konca A musí byť rovnaké ako miesto začiatku B
        const aTo = normalizePlaceName(a.toLocation || '');
        const bFrom = normalizePlaceName(b.fromLocation || '');
        if (!aTo || !bFrom) return false;
        if (aTo !== bFrom) return false;

        return true;
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
                    defaultValue: row.timeFrom || '',
                    onBlur: async (e) => {
                        const newValue = e.target.value;
                        const oldValue = row.timeFrom || '';

                        if (newValue === oldValue) return; // bez zmeny

                        if (!newValue) {
                            // Prázdnu hodnotu len ulož, nič neposúvaj
                            await updateBusRowField(row.id, 'timeFrom', newValue);
                            return;
                        }

                        // Ak je stará aj nová hodnota platný čas, spočítaj rozdiel v minútach
                        let deltaMinutes = 0;
                        if (oldValue && /^\d{1,2}:\d{2}$/.test(oldValue) && /^\d{1,2}:\d{2}$/.test(newValue)) {
                            const [oh, om] = oldValue.split(':').map(Number);
                            const [nh, nm] = newValue.split(':').map(Number);
                            deltaMinutes = (nh * 60 + nm) - (oh * 60 + om);
                        }

                        // Najprv ulož novú hodnotu aktuálneho riadku
                        await updateBusRowField(row.id, 'timeFrom', newValue);

                        // Potom posuň nasledujúce riadky (len po najbližší červený)
                        if (deltaMinutes !== 0) {
                            await shiftBusRowsAfterChange(busId, dayKey, row.id, deltaMinutes);
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
            React.createElement('td', { className: 'border border-gray-300 p-1 align-top' },
                (row.teamsIn || []).length === 0
                    ? React.createElement('span', { className: 'text-xs text-gray-400 italic' }, '—')
                    : React.createElement(
                        'div',
                        { className: 'flex flex-wrap gap-2' },
                        (row.teamsIn || []).map((tn, i) => {
                            const parts = String(tn).split('|');
                            const teamLabel = parts[0] || tn;
                            const teamCategory = parts[1] || '';
                            const textColor = getCategoryTextColor(teamCategory);
                            return React.createElement(
                                'span',
                                {
                                    key: `in-${i}`,
                                    onClick: () => removeTeamSegment(tn, 'in'),
                                    title: getTeamTooltipLabel(tn),
                                    className: 'inline-flex items-center gap-1 text-[11px] font-semibold cursor-pointer hover:underline',
                                    style: { color: textColor }
                                },
                                teamLabel
                            );
                        })
                    )
            ),
            // 6. tímy výstup (len text vo farbe kategórie, bez pozadia a rámčeka)
            React.createElement('td', { className: 'border border-gray-300 p-1 align-top' },
                (row.teamsOut || []).length === 0
                    ? React.createElement('span', { className: 'text-xs text-gray-400 italic' }, '—')
                    : React.createElement(
                        'div',
                        { className: 'flex flex-wrap gap-2' },
                        (row.teamsOut || []).map((tn, i) => {
                            const parts = String(tn).split('|');
                            const teamLabel = parts[0] || tn;
                            const teamCategory = parts[1] || '';
                            const textColor = getCategoryTextColor(teamCategory);
                            return React.createElement(
                                'span',
                                {
                                    key: `out-${i}`,
                                    onClick: () => removeTeamSegment(tn, 'out'),
                                    title: getTeamTooltipLabel(tn),
                                    className: 'inline-flex items-center gap-1 text-[11px] font-semibold cursor-pointer hover:underline',
                                    style: { color: textColor }
                                },
                                teamLabel
                            );
                        })
                    )
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
            // 8. trvanie v min (read-only, z travelTimes)
            //    Ak je timeFrom > timeTo → zobraz "chyba" (červené)
            //    Inak zobraz travelMinutes (modré) alebo "—" (sivé, ak trvanie nie je nastavené)
            React.createElement('td', {
                className: 'border border-gray-300 px-2 py-1 text-center text-sm font-semibold',
                style: {
                    color: (() => {
                        // Skontroluj, či timeFrom > timeTo
                        const timeRe = /^\d{1,2}:\d{2}$/;
                        if (row.timeFrom && row.timeTo &&
                            timeRe.test(row.timeFrom) && timeRe.test(row.timeTo)) {
                            const [fh, fm] = row.timeFrom.split(':').map(Number);
                            const [th, tm] = row.timeTo.split(':').map(Number);
                            const fromMin = fh * 60 + fm;
                            const toMin = th * 60 + tm;
                            if (fromMin > toMin) return '#dc2626'; // červená
                        }
                        return travelMinutes != null ? '#1d4ed8' : '#9ca3af';
                    })(),
                },
                title: (() => {
                    const timeRe = /^\d{1,2}:\d{2}$/;
                    if (row.timeFrom && row.timeTo &&
                        timeRe.test(row.timeFrom) && timeRe.test(row.timeTo)) {
                        const [fh, fm] = row.timeFrom.split(':').map(Number);
                        const [th, tm] = row.timeTo.split(':').map(Number);
                        if (fh * 60 + fm > th * 60 + tm) {
                            return `Chyba: čas od (${row.timeFrom}) je neskorší ako čas do (${row.timeTo})`;
                        }
                    }
                    return travelMinutes != null ? 'Trvanie z Nastavení' : 'Trvanie nie je nastavené';
                })(),
            }, (() => {
                // Skontroluj, či timeFrom > timeTo
                const timeRe = /^\d{1,2}:\d{2}$/;
                if (row.timeFrom && row.timeTo &&
                    timeRe.test(row.timeFrom) && timeRe.test(row.timeTo)) {
                    const [fh, fm] = row.timeFrom.split(':').map(Number);
                    const [th, tm] = row.timeTo.split(':').map(Number);
                    if (fh * 60 + fm > th * 60 + tm) {
                        return 'chyba';
                    }
                }
                return travelMinutes != null ? travelMinutes : '—';
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
                        updatedAt: Timestamp.fromDate(new Date()),
                        updatedBy: (userProfileData && userProfileData.email) || null,
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

    // ============================================================
    // POMOCNÁ: Prepočíta časy zostávajúcich segmentov presunu
    // tak, aby celkový interval zostal zachovaný a časy sa
    // dopočítali podľa reálnych trvaní jázd (travelTimes).
    //
    // Vstupy:
    //  - originalWhen: pôvodný "when" celého presunu (start – end)
    //  - route: pole miest [A, B, C, ...]
    //  - resolvedSegments: Set indexov segmentov, ktoré sú už vyriešené
    //    (napr. {0, 2} znamená A→B a C→D sú vyriešené)
    //  - resolvedDurationMinutes: súčet trvaní vyriešených segmentov
    //    (v minútach) – ak nie je známy, použije sa getTravelMinutes
    //
    // Výstup:
    //  - pole { startTs, endTs, whenStr } pre KAŽDÝ segment
    //    (vrátane vyriešených – tie si zachovajú svoj pôvodný čas,
    //     ak bol známy; inak dostanú null)
    // ============================================================
    const recomputeRemainingSegments = (originalWhen, route, resolvedSegments = new Set()) => {
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
    
        const timeRange = parseWhenRangeToTs(originalWhen);
        const segmentsCount = route.length - 1;
        if (segmentsCount <= 0) return [];
    
        // Zisti trvania všetkých segmentov
        const durations = [];
        for (let i = 0; i < segmentsCount; i++) {
            const mins = getTravelMinutes(route[i], route[i + 1]);
            durations.push(mins != null ? Number(mins) : null);
        }
    
        // Fallback pre chýbajúce trvania – priemer zo známych
        const known = durations.filter((d) => d != null);
        const fallback = known.length > 0
            ? Math.round(known.reduce((a, b) => a + b, 0) / known.length)
            : null;
    
        const finalDurations = durations.map((d) =>
            d != null ? d : (fallback != null ? fallback : null)
        );
    
        // Ak nemáme platný interval → všetky segmenty dostanú pôvodný when
        if (!timeRange || timeRange.startTs == null || timeRange.endTs == null || timeRange.endTs <= timeRange.startTs) {
            return Array.from({ length: segmentsCount }, () => ({
                startTs: null,
                endTs: null,
                whenStr: originalWhen,
            }));
        }
    
        const totalMs = timeRange.endTs - timeRange.startTs;
    
        // ============================================================
        // Rozdeľ čas:
        //  - Vyriešené segmenty si zachovajú svoj podiel podľa trvania
        //    (alebo ak nemajú trvanie, dostanú 0 – ich čas sa „stratí").
        //  - Zvyšné segmenty si rozdelia ZVYŠNÝ čas podľa svojich trvaní.
        // ============================================================
        const resolvedIndexes = Array.from(resolvedSegments).filter(
            (i) => i >= 0 && i < segmentsCount
        );
        const remainingIndexes = [];
        for (let i = 0; i < segmentsCount; i++) {
            if (!resolvedSegments.has(i)) remainingIndexes.push(i);
        }
    
        // Trvania vyriešených segmentov
        const resolvedDurationsSum = resolvedIndexes.reduce(
            (sum, i) => sum + (finalDurations[i] || 0),
            0
        );
    
        // Trvania zostávajúcich segmentov
        const remainingDurationsSum = remainingIndexes.reduce(
            (sum, i) => sum + (finalDurations[i] || 0),
            0
        );
    
        // Čas, ktorý zostáva na rozdelenie medzi zostávajúce segmenty
        // (celkový čas – podiel vyriešených segmentov)
        let remainingMs;
        if (resolvedDurationsSum + remainingDurationsSum > 0) {
            // Podiel vyriešených segmentov z celkového času
            const resolvedMs = Math.round(
                (resolvedDurationsSum / (resolvedDurationsSum + remainingDurationsSum)) * totalMs
            );
            remainingMs = totalMs - resolvedMs;
        } else {
            remainingMs = totalMs;
        }
    
        // ============================================================
        // Vypočítaj časy pre jednotlivé segmenty
        // ============================================================
        const results = new Array(segmentsCount).fill(null);
    
        // 1) Vyriešené segmenty – rozdeľ im ich podiel
        let cursorTs = timeRange.startTs;
        if (resolvedDurationsSum > 0) {
            const resolvedMsTotal = totalMs - remainingMs;
            for (const i of resolvedIndexes) {
                const dur = finalDurations[i] || 0;
                const segMs = Math.round((dur / resolvedDurationsSum) * resolvedMsTotal);
                const segStartTs = cursorTs;
                const segEndTs = cursorTs + segMs;
                results[i] = {
                    startTs: segStartTs,
                    endTs: segEndTs,
                    whenStr: `${formatTsLocal(segStartTs)} – ${formatTsLocal(segEndTs)}`,
                };
                cursorTs = segEndTs;
            }
        } else {
            // Vyriešené segmenty bez trvania → dostanú nulový čas
            for (const i of resolvedIndexes) {
                results[i] = {
                    startTs: cursorTs,
                    endTs: cursorTs,
                    whenStr: `${formatTsLocal(cursorTs)} – ${formatTsLocal(cursorTs)}`,
                };
            }
        }
    
        // 2) Zostávajúce segmenty – rozdeľ im zvyšný čas
        if (remainingIndexes.length > 0) {
            if (remainingDurationsSum > 0) {
                for (const i of remainingIndexes) {
                    const dur = finalDurations[i] || 0;
                    const isLastRemaining = i === remainingIndexes[remainingIndexes.length - 1];
                    const segMs = isLastRemaining
                        ? (timeRange.endTs - cursorTs)
                        : Math.round((dur / remainingDurationsSum) * remainingMs);
                    const segStartTs = cursorTs;
                    const segEndTs = cursorTs + segMs;
                    results[i] = {
                        startTs: segStartTs,
                        endTs: segEndTs,
                        whenStr: `${formatTsLocal(segStartTs)} – ${formatTsLocal(segEndTs)}`,
                    };
                    cursorTs = segEndTs;
                }
            } else {
                // Rovnomerné rozdelenie
                const segMs = Math.round(remainingMs / remainingIndexes.length);
                for (let k = 0; k < remainingIndexes.length; k++) {
                    const i = remainingIndexes[k];
                    const isLast = k === remainingIndexes.length - 1;
                    const segStartTs = cursorTs;
                    const segEndTs = isLast ? timeRange.endTs : cursorTs + segMs;
                    results[i] = {
                        startTs: segStartTs,
                        endTs: segEndTs,
                        whenStr: `${formatTsLocal(segStartTs)} – ${formatTsLocal(segEndTs)}`,
                    };
                    cursorTs = segEndTs;
                }
            }
        }
    
        return results;
    };

    // ============================================================
    // ZMAZANIE KONKRÉTNEHO PRESUNU (len jeden záznam z DB)
    // ============================================================
    const deleteSingleTransfer = async (transfer) => {
        if (!window.db || !transfer) return;
        setDeleteTransferSaving(true);
        try {
            const docRef = doc(window.db, TRANSPORT_SETTINGS_COLLECTION, TRANSPORT_SETTINGS_DOC);
    
            // ============================================================
            // 1) Načítaj aktuálny stav z DB (nie z React state),
            //    aby sme mali istotu, že vidíme všetky záznamy.
            // ============================================================
            const snap = await getDoc(docRef);
            const rawTransfers = snap.exists()
                ? (snap.data() || {})[TRANSPORT_TRANSFERS_FIELD] || {}
                : {};
    
            // ============================================================
            // 2) Zisti, ktorý _parentKey sa má skontrolovať.
            //
            //  - Ak odstraňujeme segment (má _parentKey a ten != key)
            //    → kontrolujeme _parentKey.
            //  - Ak odstraňujeme priamo parent (key == _parentKey alebo
            //    transfer nemá _parentKey) → kontrolujeme jeho vlastný key.
            // ============================================================
            const parentKeyToCheck =
                transfer._parentKey && transfer._parentKey !== transfer.key
                    ? transfer._parentKey
                    : transfer.key;
    
            // ============================================================
            // 3) Nájdi VŠETKY zostávajúce záznamy v DB, ktoré patria
            //    k tomu istému parentKey (okrem odstraňovaného).
            //
            //    Zahŕňa to:
            //      - samotný parent záznam (key === parentKeyToCheck)
            //      - segmenty, ktoré majú _parentKey === parentKeyToCheck
            //      - AJ priradené segmenty (tie majú v DB stále _parentKey,
            //        aj keď sú v busRows/peši)
            // ============================================================
            const remainingRelated = Object.entries(rawTransfers).filter(([key, v]) => {
                if (!v) return false;
                if (key === transfer.key) return false; // odstraňovaný
                if (key === parentKeyToCheck) return true; // parent
                if (v._parentKey === parentKeyToCheck) return true; // segment
                return false;
            });
    
            // ============================================================
            // 4) Priprav patch
            // ============================================================
            const transfersPatch = {
                [transfer.key]: deleteField(),
            };
    
            // ============================================================
            // 5) Ak po odstránení nezostane ŽIADNY súvisiaci záznam
            //    (ani parent, ani segment), zmaž aj parent (ak ešte existuje).
            //
            //    Tým sa zabezpečí, že v DB nezostanú siroty.
            // ============================================================
            if (remainingRelated.length === 0 && parentKeyToCheck !== transfer.key) {
                transfersPatch[parentKeyToCheck] = deleteField();
            }
    
            // ============================================================
            // 6) Špeciálny prípad: ak odstraňujeme PRIAMO parent záznam
            //    (transfer.key === parentKeyToCheck), musíme zmazať
            //    AJ všetky jeho segmenty, ktoré ešte v DB zostali.
            //
            //    Inak by v DB zostali sirotské segmenty bez parenta.
            // ============================================================
            if (parentKeyToCheck === transfer.key) {
                const segmentsToDelete = Object.entries(rawTransfers).filter(
                    ([key, v]) => v && v._parentKey === transfer.key && key !== transfer.key
                );
                segmentsToDelete.forEach(([key]) => {
                    transfersPatch[key] = deleteField();
                });
            }
    
            // ============================================================
            // 7) Zapíš patch do DB
            // ============================================================
            await setDoc(
                docRef,
                {
                    [TRANSPORT_TRANSFERS_FIELD]: transfersPatch,
                    updatedAt: Timestamp.fromDate(new Date()),
                    updatedBy: (userProfileData && userProfileData.email) || null,
                },
                { merge: true }
            );
    
            const deletedParent = !!transfersPatch[parentKeyToCheck];
            const deletedSegmentsCount = Object.keys(transfersPatch).length
                - 1 /* samotný transfer */
                - (deletedParent ? 1 : 0);
    
            let suffix = '';
            if (deletedParent) {
                suffix = ' (a aj pôvodný záznam celého presunu, keďže žiadne iné časti nezostali)';
            }
            if (deletedSegmentsCount > 0) {
                suffix += ` (spolu odstránených ${deletedSegmentsCount + 1} častí presunu)`;
            }
    
            window.showGlobalNotification(
                `Presun ${transfer.fromLocation} → ${transfer.toLocation} bol odstránený${suffix}.`,
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

    // ============================================================
    // UNIVERZÁLNA: Prepočíta blok segmentov okolo daného transferu.
    //
    // DÔLEŽITÉ: 
    //  - Vyriešené segmenty (peši alebo autobus) si zachovajú svoj čas.
    //  - Ak je segment vyriešený autobusom, jeho REÁLNY čas sa zistí
    //    z busRows (čas nástupu tímu v boardingRow, čas výstupu v alightingRow).
    //    Tento reálny čas je FIXNÝ — zvyšné segmenty sa dopočítajú
    //    od tohto reálneho času do konca pôvodného intervalu.
    //  - Ak segment nemá reálny čas (napr. peši), dopočíta sa z pôvodného intervalu.
    //  - Zostávajúce segmenty sa dopočítajú podľa trvaní jázd (travelTimes).
    // ============================================================
    const recomputeBlock = async (transfer, resolvedKeys = new Set(), excludeKeys = new Set()) => {
        if (!window.db || !transfer) return;
    
        const teamName = String(transfer.teamName || '').trim();
        const category = cleanCategory(transfer.category || '');
        const dayKey = transfer.dayKey || '';
    
        // Zoznam všetkých segmentov tohto tímu v daný deň (okrem aktuálneho)
        const sameTeamSegments = savedTransfers
            .filter((t) =>
                String(t.teamName || '').trim() === teamName &&
                cleanCategory(t.category || '') === category &&
                t.dayKey === dayKey &&
                t.key !== transfer.key
            )
            .map((t) => ({ ...t, range: parseTransferWhenToRange(t.when) }))
            .filter((t) => t.range != null);
    
        const trRange = parseTransferWhenToRange(transfer.when);
        if (!trRange) return;
    
        const chain = [{ ...transfer, range: trRange }, ...sameTeamSegments];
        chain.sort((a, b) => a.range.startTs - b.range.startTs);
    
        const isContinuous = (a, b) => {
            const ra = a.range || parseTransferWhenToRange(a.when);
            const rb = b.range || parseTransferWhenToRange(b.when);
            if (!ra || !rb) return false;
            return ra.endTs === rb.startTs &&
                normalizePlaceName(a.toLocation) === normalizePlaceName(b.fromLocation);
        };
    
        const currentIdx = chain.findIndex((t) => t.key === transfer.key);
        if (currentIdx === -1) return;
    
        let blockStart = currentIdx;
        let blockEnd = currentIdx;
        while (blockStart > 0 && isContinuous(chain[blockStart - 1], chain[blockStart])) blockStart--;
        
        // ============================================================
        // NOVÉ PRAVIDLO: Blok sa rozširuje LEN cez segmenty, ktoré na seba
        // PRIAMO nadväzujú (isContinuous – koniec jedného = začiatok
        // druhého a miesto konca = miesto začiatku).
        //
        // Ak tím má v ten istý deň DVA NESÚVISLÉ presuny (napr. A→B a C→D),
        // sú to DVA SAMOSTATNÉ BLOKY. Priradenie jedného k autobusu
        // NESMIE prepočítať čas toho druhého – ten si musí zachovať
        // svoj pôvodný vygenerovaný čas.
        // ============================================================
        while (blockEnd < chain.length - 1) {
            const nextSeg = chain[blockEnd + 1];
            // Ak ďalší segment priamo nenadväzuje → stop (iný blok)
            if (!isContinuous(chain[blockEnd], nextSeg)) break;
            blockEnd++;
        }
    
        const block = chain.slice(blockStart, blockEnd + 1);
        if (block.length < 2) return;
    
        const firstRange = block[0].range || parseTransferWhenToRange(block[0].when);
        const lastRange = block[block.length - 1].range || parseTransferWhenToRange(block[block.length - 1].when);
        if (!firstRange || !lastRange) return;
    
        const blockRoute = [block[0].fromLocation];
        for (let i = 0; i < block.length; i++) blockRoute.push(block[i].toLocation);
    
        // ============================================================
        // KROK 1: Pre KAŽDÝ segment v bloku over, či je vyriešený
        //         (peši ALEBO autobusom) a zisti jeho REÁLNY čas.
        //
        // Pre autobus: hľadaj v busRows riadok, kde tím nastupuje
        // (teamsIn obsahuje tím) a row.placeFrom zodpovedá segment.from.
        // Tak získaš reálny čas odchodu. Podobne pre výstup.
        //
        // Pre peši: segment má isWalking=true a jeho čas sa zachová.
        // ============================================================
        const resolvedIndexes = new Set();
        const resolvedRealTimes = new Map(); // idx → { startTs, endTs }
    
        // Normalizovaný kľúč tímu pre porovnanie v busRows
        const teamKey = `${teamName}|${category}`;
    
        // Predpriprav všetky busRows pre tento deň a tím
        const allBusRowsForDay = [];
        Object.entries(busRows || {}).forEach(([busKey, rows]) => {
            const parts = busKey.split('|');
            const busDayKey = parts[1];
            if (busDayKey !== dayKey) return;
            (rows || []).forEach((row) => {
                allBusRowsForDay.push({ ...row, _busKey: busKey });
            });
        });
        // Zoraď podľa času odchodu (pre istotu)
        allBusRowsForDay.sort((a, b) => {
            const ta = a.timeFrom || '';
            const tb = b.timeFrom || '';
            return ta.localeCompare(tb);
        });
    
        // Pomocná: normalizované porovnanie tímového kľúča
        const matchesTeam = (rowTeams, targetKey) => {
            if (!Array.isArray(rowTeams)) return false;
            return rowTeams.some((t) => {
                const s = String(t).trim();
                // Presná zhoda
                if (s === targetKey) return true;
                // Alternatívne: "teamName|category" s medzerami
                const [tn, cat] = s.split('|');
                return String(tn).trim() === teamName && cleanCategory(cat) === category;
            });
        };
    
        block.forEach((seg, idx) => {
            const segFrom = normalizePlaceName(seg.fromLocation);
            const segTo = normalizePlaceName(seg.toLocation);
    
            // 1) Peši — resolvedKeys alebo isWalking
            const isWalkingResolved =
                (resolvedKeys.has(seg.key) || seg.isWalking === true) &&
                !excludeKeys.has(seg.key);
    
            if (isWalkingResolved) {
                resolvedIndexes.add(idx);
                const range = seg.range || parseTransferWhenToRange(seg.when);
                if (range) {
                    resolvedRealTimes.set(idx, { startTs: range.startTs, endTs: range.endTs });
                }
                return;
            }
    
            // 2) Autobus — hľadaj reálny čas v busRows
            let boardingTimeStr = null;
            let alightingTimeStr = null;
            let boardingTs = null;
            let alightingTs = null;
    
            allBusRowsForDay.forEach((row) => {
                const rowFrom = normalizePlaceName(row.placeFrom);
                const rowTo = normalizePlaceName(row.placeTo);
    
                const hasTeamIn = matchesTeam(row.teamsIn, teamKey);
                const hasTeamOut = matchesTeam(row.teamsOut, teamKey);
    
                if (hasTeamIn && rowFrom === segFrom && row.timeFrom && boardingTs == null) {
                    const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
                    if (dm) {
                        const [h, mi] = row.timeFrom.split(':').map(Number);
                        boardingTs = new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), h, mi, 0, 0).getTime();
                        boardingTimeStr = row.timeFrom;
                    }
                }
    
                if (hasTeamOut && rowTo === segTo && row.timeTo && alightingTs == null) {
                    const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
                    if (dm) {
                        const [h, mi] = row.timeTo.split(':').map(Number);
                        alightingTs = new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), h, mi, 0, 0).getTime();
                        alightingTimeStr = row.timeTo;
                    }
                }
            });
    
            // Ak máme reálny čas nástupu aj výstupu → segment je vyriešený autobusom
            if (boardingTs != null && alightingTs != null && alightingTs > boardingTs) {
                resolvedIndexes.add(idx);
                resolvedRealTimes.set(idx, { startTs: boardingTs, endTs: alightingTs });
                return;
            }
    
            // Ak máme aspoň reálny čas nástupu (tím nastúpil, ale ešte nevystúpil)
            // → segment je čiastočne vyriešený. Použijeme reálny čas odchodu,
            // ale koniec dopočítame.
            if (boardingTs != null && alightingTs == null) {
                resolvedIndexes.add(idx);
                // endTs bude dopočítaný neskôr z trvania segmentu
                const mins = getTravelMinutes(segFrom, segTo);
                const computedEndTs = (mins != null) ? boardingTs + mins * 60000 : null;
                resolvedRealTimes.set(idx, { startTs: boardingTs, endTs: computedEndTs });
                return;
            }
    
            // Ak máme aspoň reálny čas výstupu (tím vystúpil, ale nenastúpil v našom buse)
            if (boardingTs == null && alightingTs != null) {
                resolvedIndexes.add(idx);
                const mins = getTravelMinutes(segFrom, segTo);
                const computedStartTs = (mins != null) ? alightingTs - mins * 60000 : null;
                resolvedRealTimes.set(idx, { startTs: computedStartTs, endTs: alightingTs });
                return;
            }
        });
    
        // ============================================================
        // KROK 2: Vypočítaj časy pre všetky segmenty.
        //
        // Princíp:
        //  - Vyriešené segmenty s reálnym časom → fixný čas.
        //  - Vyriešené segmenty bez reálneho času → dopočítaj z pôvodného intervalu.
        //  - Zostávajúce segmenty → dopočítaj podľa trvaní, oddelene po úsekoch
        //    medzi fixnými bodmi.
        // ============================================================
        const newTimes = new Array(block.length).fill(null);
    
        // 1) Vyriešené segmenty s reálnym časom
        resolvedRealTimes.forEach(({ startTs, endTs }, idx) => {
            if (startTs != null && endTs != null) {
                newTimes[idx] = {
                    startTs,
                    endTs,
                    whenStr: `${formatTsLocal(startTs)} – ${formatTsLocal(endTs)}`,
                };
            }
        });
    
        // 2) Vyriešené segmenty bez reálneho času → z pôvodného intervalu
        resolvedIndexes.forEach((idx) => {
            if (newTimes[idx]) return;
            const seg = block[idx];
            const range = seg.range || parseTransferWhenToRange(seg.when);
            if (range) {
                newTimes[idx] = {
                    startTs: range.startTs,
                    endTs: range.endTs,
                    whenStr: seg.when,
                };
            }
        });
    
        // 3) Zostávajúce segmenty → dopočítaj po úsekoch
        const segments = []; // { indexes: [], startTs, endTs }
        let currentSegment = null;
    
        for (let i = 0; i < block.length; i++) {
            if (newTimes[i]) {
                if (currentSegment) {
                    segments.push(currentSegment);
                    currentSegment = null;
                }
            } else {
                if (!currentSegment) {
                    let segmentStartTs = null;
                    for (let k = i - 1; k >= 0; k--) {
                        if (newTimes[k]) {
                            segmentStartTs = newTimes[k].endTs;
                            break;
                        }
                    }
                    if (segmentStartTs == null) segmentStartTs = firstRange.startTs;
                    currentSegment = { indexes: [], startTs: segmentStartTs, endTs: null };
                }
                currentSegment.indexes.push(i);
            }
        }
        if (currentSegment) segments.push(currentSegment);
    
        // Pre každý úsek dopočítaj koniec
        segments.forEach((segment) => {
            const lastIdx = segment.indexes[segment.indexes.length - 1];
            let segmentEndTs = null;
            for (let k = lastIdx + 1; k < block.length; k++) {
                if (newTimes[k]) {
                    segmentEndTs = newTimes[k].startTs;
                    break;
                }
            }
            if (segmentEndTs == null) segmentEndTs = lastRange.endTs;
            segment.endTs = segmentEndTs;
        });
    
        // Pre každý úsek rozdeľ čas podľa trvaní
        segments.forEach((segment) => {
            const route = [block[segment.indexes[0]].fromLocation];
            for (let i = 0; i < segment.indexes.length; i++) {
                route.push(block[segment.indexes[i]].toLocation);
            }
    
            const totalMs = segment.endTs - segment.startTs;
            if (totalMs <= 0) {
                segment.indexes.forEach((blockIdx) => {
                    newTimes[blockIdx] = {
                        startTs: segment.startTs,
                        endTs: segment.startTs,
                        whenStr: `${formatTsLocal(segment.startTs)} – ${formatTsLocal(segment.startTs)}`,
                    };
                });
                return;
            }
    
            const durations = [];
            for (let i = 0; i < segment.indexes.length; i++) {
                const mins = getTravelMinutes(route[i], route[i + 1]);
                durations.push(mins != null ? Number(mins) : null);
            }
            const known = durations.filter((d) => d != null);
            const fallback = known.length > 0
                ? Math.round(known.reduce((a, b) => a + b, 0) / known.length)
                : null;
            const finalDurations = durations.map((d) =>
                d != null ? d : (fallback != null ? fallback : null)
            );
            const durationsSum = finalDurations.reduce((sum, d) => sum + (d || 0), 0);
    
            let cursorTs = segment.startTs;
            segment.indexes.forEach((blockIdx, j) => {
                const isLast = j === segment.indexes.length - 1;
                const dur = finalDurations[j] || 0;
                const segMs = isLast
                    ? (segment.endTs - cursorTs)
                    : (durationsSum > 0
                        ? Math.round((dur / durationsSum) * totalMs)
                        : Math.round(totalMs / segment.indexes.length));
                const segStartTs = cursorTs;
                const segEndTs = cursorTs + segMs;
                newTimes[blockIdx] = {
                    startTs: segStartTs,
                    endTs: segEndTs,
                    whenStr: `${formatTsLocal(segStartTs)} – ${formatTsLocal(segEndTs)}`,
                };
                cursorTs = segEndTs;
            });
        });
    
        // ============================================================
        // KROK 3: Zapíš nové časy do DB
        // ============================================================
        const docRef = doc(window.db, TRANSPORT_SETTINGS_COLLECTION, TRANSPORT_SETTINGS_DOC);
        const patch = {};
    
        block.forEach((seg, idx) => {
            const newTime = newTimes[idx];
            if (!newTime) return;
    
            const newText = `Presun z ${blockRoute[idx]} do ${blockRoute[idx + 1]}`;
            const newWhen = newTime.whenStr;
            const newKey = buildTransferKey(category, teamName, newWhen, newText);
    
            if (seg.key !== newKey) patch[seg.key] = deleteField();
    
            const base = {
                category,
                teamName,
                when: newWhen,
                text: newText,
                fromLocation: blockRoute[idx],
                toLocation: blockRoute[idx + 1],
                dayKey,
            };
            
            // NOVÉ: Zachovaj intermediateStops, ak existujú
            if (seg.intermediateStops && seg.intermediateStops.length > 0) {
                base.intermediateStops = seg.intermediateStops;
            }

            if (seg.isWalking === true) {
                base.isWalking = true;
                base.walkingSetAt = seg.walkingSetAt || Timestamp.fromDate(new Date());
                base.walkingSetBy = seg.walkingSetBy || (userProfileData && userProfileData.email) || null;
            }
    
            if (seg.isWalking === true) {
                base.isWalking = true;
                base.walkingSetAt = seg.walkingSetAt || Timestamp.fromDate(new Date());
                base.walkingSetBy = seg.walkingSetBy || (userProfileData && userProfileData.email) || null;
            }
    
            patch[newKey] = base;
        });
    
        await setDoc(docRef, { [TRANSPORT_TRANSFERS_FIELD]: patch }, { merge: true });
    };

    // ============================================================
    // ULOŽENIE UPRAVENÉHO PRESUNU (s medzizastávkami)
    // + ZACHOVANIE CELKOVÉHO ČASOVÉHO INTERVALU
    // + DOPOČÍTANIE ČASOV SEGMENTOV PODĽA REÁLNYCH TRVANÍ JÁZDY
    // ============================================================
    const saveEditedTransfer = async () => {
        if (!window.db || !editingTransfer) return;
    
        const original = editingTransfer;
        const stops = (editingTransferStops || []).map((s) => String(s || '').trim()).filter(Boolean);
        
        setEditingTransferSaving(true);
        try {
            const docRef = doc(window.db, TRANSPORT_SETTINGS_COLLECTION, TRANSPORT_SETTINGS_DOC);
            
            // NOVÉ: Zachovaj pôvodný záznam A→B a pridaj intermediateStops
            const updatedTransfer = {
                category: original.category,
                teamName: original.teamName,
                when: original.when,
                text: original.text,
                fromLocation: original.fromLocation,
                toLocation: original.toLocation,
                dayKey: original.dayKey,
            };
            
            // Zachovaj intermediateStops (ak sú)
            if (stops.length > 0) {
                updatedTransfer.intermediateStops = stops;
            }
            
            // Zachovaj isWalking (ak existuje)
            if (original.isWalking === true) {
                updatedTransfer.isWalking = true;
                updatedTransfer.walkingSetAt = original.walkingSetAt || Timestamp.fromDate(new Date());
                updatedTransfer.walkingSetBy = original.walkingSetBy || (userProfileData && userProfileData.email) || null;
            }
            
            await setDoc(
                docRef,
                {
                    [TRANSPORT_TRANSFERS_FIELD]: {
                        [original.key]: updatedTransfer,
                    },
                    updatedAt: Timestamp.fromDate(new Date()),
                    updatedBy: (userProfileData && userProfileData.email) || null,
                },
                { merge: true }
            );
            
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
    // ZLÚČENIE DVOCH PRESUNOV DO JEDNÉHO
    // ============================================================
    const mergeTransfers = async () => {
        if (!window.db || !mergeTransfersModal) return;
        const { first, second } = mergeTransfersModal;

        // Over, že sa dajú zlúčiť
        if (!canMergeTransfers(first, second)) {
            window.showGlobalNotification('Presuny sa nedajú zlúčiť.', 'error');
            return;
        }

        setMergeTransfersSaving(true);
        try {
            const docRef = doc(window.db, TRANSPORT_SETTINGS_COLLECTION, TRANSPORT_SETTINGS_DOC);

            // Nový zlúčený presun:
            //  - fromLocation = first.fromLocation
            //  - toLocation = second.toLocation
            //  - when = začiatok prvého – koniec druhého
            //  - text = "Presun z X do Y"
            const firstRange = parseTransferWhenToRange(first.when);
            const secondRange = parseTransferWhenToRange(second.when);

            if (!firstRange || !secondRange) {
                window.showGlobalNotification('Nepodarilo sa zistiť časový interval.', 'error');
                return;
            }

            const newFrom = first.fromLocation;
            const newTo = second.toLocation;
            const newWhen = `${formatTsLocal(firstRange.startTs)} – ${formatTsLocal(secondRange.endTs)}`;
            const newText = `Presun z ${newFrom} do ${newTo}`;
            const newKey = buildTransferKey(first.category, first.teamName, newWhen, newText);

            // 1) Zmazať pôvodné dva záznamy
            const deletePatch = {
                [first.key]: deleteField(),
                [second.key]: deleteField(),
            };

            // 2) Vytvoriť nový záznam
            const newTransfer = {
                category: first.category,
                teamName: first.teamName,
                when: newWhen,
                text: newText,
                fromLocation: newFrom,
                toLocation: newTo,
                dayKey: first.dayKey,
            };

            await setDoc(
                docRef,
                {
                    [TRANSPORT_TRANSFERS_FIELD]: {
                        ...deletePatch,
                        [newKey]: newTransfer,
                    },
                    updatedAt: Timestamp.fromDate(new Date()),
                    updatedBy: (userProfileData && userProfileData.email) || null,
                },
                { merge: true }
            );

            window.showGlobalNotification(
                `Presuny boli zlúčené do jedného: ${newFrom} → ${newTo}.`,
                'success'
            );
            setMergeTransfersModal(null);
        } catch (err) {
            console.error('[TRANSPORT] Chyba pri zlučovaní presunov:', err);
            window.showGlobalNotification('Nepodarilo sa zlúčiť presuny.', 'error');
        } finally {
            setMergeTransfersSaving(false);
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
    
        const teamName = String(transfer.teamName || '').trim();
        const category = cleanCategory(transfer.category || '');
        const dayKey = transfer.dayKey || '';
        const trRange = parseTransferWhenToRange(transfer.when);
        if (!trRange) return true;
    
        // ============================================================
        // NOVÉ: Rozlož VŠETKY presuny toho istého tímu v ten istý deň
        // na segmenty (vrátane tých s intermediateStops), aby sme
        // videli aj predchádzajúce segmenty, ktoré sú súčasťou
        // rovnakého pôvodného presunu.
        // ============================================================
        const allSegments = [];
    
        savedTransfers
            .filter((t) =>
                String(t.teamName || '').trim() === teamName &&
                cleanCategory(t.category || '') === category &&
                t.dayKey === dayKey
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
    
                // Rozlož na segmenty
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
    
                // Pre každý segment dopočítaj čas z busRows, ak je priradený
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
    
                    let segStartTs, segEndTs;
                    if (boardingTs != null && alightingTs != null) {
                        segStartTs = boardingTs;
                        segEndTs = alightingTs;
                    } else if (boardingTs != null) {
                        segStartTs = boardingTs;
                        segEndTs = timeRange.endTs;
                    } else if (alightingTs != null) {
                        segStartTs = timeRange.startTs;
                        segEndTs = alightingTs;
                    } else {
                        // Nepriradený segment – použi pôvodný interval
                        // (začiatok = koniec predchádzajúceho, ak existuje)
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
                        isWalking: t.isWalking === true,
                        _parentKey: t.key,
                        _isAssigned: boardingTs != null || alightingTs != null,
                    });
                }
            });
    
        allSegments.sort((a, b) => a.range.startTs - b.range.startTs);
    
        for (const seg of allSegments) {
            // Preskoč samotný aktuálny transfer
            if (seg.key === transfer.key) continue;
            // Preskoč neskoršie segmenty
            if (seg.range.startTs >= trRange.startTs) continue;
    
            // Peši → vyriešené
            if (seg.isWalking === true) continue;
    
            // Ak je segment priradený (má _isAssigned=true), je vyriešený
            if (seg._isAssigned === true) continue;
    
            // Inak over cez isSegmentCoveredByBus
            if (!isSegmentCoveredByBus(seg)) {
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
        // NOVÉ: Ak predchádzajúce segmenty nie sú vyriešené, vráť
        // prázdny zoznam – ale s informáciou, prečo (pre debug).
        // ============================================================
        if (!arePreviousSegmentsResolved(transfer)) {
            console.warn('[TRANSPORT] findMatchingBusRows: predchádzajúce segmenty nie sú vyriešené pre', transfer);
            return [];
        }
    
        const trRange = parseTransferWhenToRange(transfer.when);
        const trFrom = normalizePlaceName(transfer.fromLocation);
        const trTo = normalizePlaceName(transfer.toLocation);
        const trDayKey = transfer.dayKey || null;
    
        if (!trRange || !trFrom || !trTo || !trDayKey) return [];
    
        const results = [];
    
        Object.entries(busRows || {}).forEach(([key, rows]) => {
            const [busId, dayKey] = key.split('|');
            if (dayKey !== trDayKey) return;
    
            const bus = buses.find((b) => b.id === busId);
            if (!bus) return;
            if (!rows || rows.length === 0) return;
    
            const sortedRows = [...rows].sort((a, b) => (a.order || 0) - (b.order || 0));
    
            // Nájdi VŠETKY nástupné kandidáty (placeFrom === trFrom)
            // a VŠETKY výstupné kandidáty (placeTo === trTo)
            const boardingCandidates = [];
            const alightingCandidates = [];
    
            sortedRows.forEach((row) => {
                const rowFrom = normalizePlaceName(row.placeFrom);
                const rowTo = normalizePlaceName(row.placeTo);
                const rowTimeFromTs = timeOnDayKeyToTs(dayKey, row.timeFrom);
                const rowTimeToTs = timeOnDayKeyToTs(dayKey, row.timeTo);
    
                // Nástupný kandidát
                if (
                    rowFrom &&
                    rowFrom === trFrom &&
                    rowTimeFromTs != null &&
                    rowTimeFromTs >= trRange.startTs &&
                    rowTimeFromTs <= trRange.endTs
                ) {
                    boardingCandidates.push({ row, timeTs: rowTimeFromTs });
                }
    
                // Výstupný kandidát
                if (
                    rowTo &&
                    rowTo === trTo &&
                    rowTimeToTs != null &&
                    rowTimeToTs >= trRange.startTs &&
                    rowTimeToTs <= trRange.endTs
                ) {
                    alightingCandidates.push({ row, timeTs: rowTimeToTs });
                }
            });
    
            // ============================================================
            // NOVÉ: Ak nemáme AJ nástup AJ výstup → bus nie je vhodný.
            // (Predtým sa zobrazovali aj bus-y len s nástupom alebo len s výstupom,
            //  čo spôsobovalo, že tím v buse uviazol.)
            // ============================================================
            if (boardingCandidates.length === 0 || alightingCandidates.length === 0) {
                return;
            }
    
            // ============================================================
            // NOVÉ: `trip` musí obsahovať LEN konkrétny segment
            // (od nástupnej zastávky po výstupnú zastávku), NIE celú
            // trasu autobusu. Celá trasa sa zobrazuje len vtedy, ak
            // nástup aj výstup sú na krajných zastávkach.
            // ============================================================
            // Vytvor dvojice (nástup, výstup) – len také, kde výstup je po nástupe
            boardingCandidates.forEach((board) => {
                alightingCandidates.forEach((alight) => {
                    // Výstup musí byť po nástupe (order) ALEBO v tom istom riadku
                    if ((alight.row.order || 0) < (board.row.order || 0)) return;
    
                    // Časová konzistencia
                    const boardTs = timeOnDayKeyToTs(dayKey, board.row.timeFrom);
                    const alightTs = timeOnDayKeyToTs(dayKey, alight.row.timeTo);
                    if (boardTs != null && alightTs != null && alightTs < boardTs) return;
    
                    // ============================================================
                    // NOVÉ: trip pre tento konkrétny výsledok – len segment
                    // od nástupu po výstup (nie celá trasa autobusu).
                    // ============================================================
                    const segmentFrom = normalizePlaceName(board.row.placeFrom) || trFrom;
                    const segmentTo = normalizePlaceName(alight.row.placeTo) || trTo;
    
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
    
        // ============================================================
        // NOVÉ: Deduplikácia – ak majú viaceré kandidáti rovnaký
        // `boardingTime` (čas odchodu z nástupnej zastávky), necháme
        // len toho s NAJKRAJŠÍM trvaním jazdy medzi nástupnou
        // a výstupnou zastávkou.
        //
        // Trvanie jazdy vypočítame ako:
        //   (timeTo výstupného riadku) − (timeFrom nástupného riadku)
        // s prechodom cez polnoc (mod 24h).
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

        // Zoskup kandidátov podľa kľúča:
        //   busId | dayKey | boardingTime | fromPlace
        // (t. j. rovnaký autobus, rovnaký deň, rovnaký čas odchodu
        //  z rovnakej nástupnej zastávky)
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

        // Pre každú skupinu nechaj len kandidáta s najkratším trvaním jazdy
        const dedupedResults = [];
        groupedByBoarding.forEach((group) => {
            if (group.length === 1) {
                dedupedResults.push(group[0]);
                return;
            }

            // Vypočítaj trvanie pre každého kandidáta
            const withDuration = group.map((r) => ({
                candidate: r,
                duration: computeTripDurationMinutes(r.boardingRow, r.alightingRow),
            }));

            // Nájdi minimum (null = neznáme → berieme ako najhoršie)
            let best = null;
            withDuration.forEach((item) => {
                if (item.duration == null) return; // neznáme trvanie – preskoč
                if (best == null || item.duration < best.duration) {
                    best = item;
                }
            });

            if (best != null) {
                // Máme kandidáta s najkratším trvaním – nechaj len jeho
                dedupedResults.push(best.candidate);
            } else {
                // Ak sa nedá vypočítať trvanie pre nikoho, nechaj všetkých
                // (nemáme podklad na výber)
                group.forEach((r) => dedupedResults.push(r));
            }
        });

        // Zoraď výsledky (po deduplikácii)
        dedupedResults.sort((a, b) => {
            const timeA = a.boardingTime || a.alightingTime || '';
            const timeB = b.boardingTime || b.alightingTime || '';
            if (timeA !== timeB) return timeA.localeCompare(timeB);
            return String(a.bus.name).localeCompare(String(b.bus.name), 'sk');
        });

        return dedupedResults;
    };

    // ============================================================
    // NASTAVENIE PRESUNU AKO "PEŠI"
    // ============================================================
    const setTransferAsWalking = async (transfer) => {
        if (!window.db || !transfer) return;
        try {
            const docRef = doc(window.db, TRANSPORT_SETTINGS_COLLECTION, TRANSPORT_SETTINGS_DOC);
    
            // 1) Označ tento segment ako peši
            await setDoc(
                docRef,
                {
                    [TRANSPORT_TRANSFERS_FIELD]: {
                        [transfer.key]: {
                            ...transfer,
                            isWalking: true,
                            walkingSetAt: Timestamp.fromDate(new Date()),
                            walkingSetBy: (userProfileData && userProfileData.email) || null,
                        },
                    },
                    updatedAt: Timestamp.fromDate(new Date()),
                    updatedBy: (userProfileData && userProfileData.email) || null,
                },
                { merge: true }
            );
    
            // 2) Prepočítaj celý blok (tento segment je vyriešený, zvyšné sa dopočítajú)
            await recomputeBlock(
                { ...transfer, isWalking: true },
                new Set([transfer.key])
            );
    
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
            const docRef = doc(window.db, TRANSPORT_SETTINGS_COLLECTION, TRANSPORT_SETTINGS_DOC);
    
            // 1) Odstráň príznak "peši"
            await setDoc(
                docRef,
                {
                    [TRANSPORT_TRANSFERS_FIELD]: {
                        [transfer.key]: {
                            ...transfer,
                            isWalking: false,
                            walkingSetAt: deleteField(),
                            walkingSetBy: deleteField(),
                        },
                    },
                    updatedAt: Timestamp.fromDate(new Date()),
                    updatedBy: (userProfileData && userProfileData.email) || null,
                },
                { merge: true }
            );
    
            // 2) Prepočítaj blok – tento segment už NIE je vyriešený,
            //    takže dostane svoj podiel času z celkového intervalu.
            //    POZOR: savedTransfers ešte obsahuje starý stav (isWalking: true),
            //    preto odovzdávame explicitne prázdny set a v recomputeBlock
            //    kontrolujeme aj seg.isWalking – ten ale musíme dočasne ignorovať.
            //    Riešenie: prepočítame s upraveným transferom a prázdnym resolvedKeys,
            //    pričom v recomputeBlock ignorujeme isWalking pre tento kľúč.
            const updatedTransfer = { ...transfer, isWalking: false };
            await recomputeBlock(updatedTransfer, new Set(), new Set([transfer.key]));
    
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
        if (!window.db || !transferActionModal?.transfer) return;
        const transfer = transferActionModal.transfer;

        if (!arePreviousSegmentsResolved(transfer)) {
            window.showGlobalNotification(
                'Najprv musíte priradiť predchádzajúce segmenty tohto presunu (alebo ich označiť ako „peši").',
                'error'
            );
            return;
        }

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
        
        // Najprv skús priamo podľa ID z výberu
        if (boardingRowId) {
            boardingRow = rows.find((r) => r.id === boardingRowId) || null;
        }
        if (alightingRowId) {
            alightingRow = rows.find((r) => r.id === alightingRowId) || null;
        }

        // Fallback – ak sa nenašli, skús podľa miest
        if (!boardingRow || !alightingRow) {
            rows.forEach((row) => {
                const rowFrom = normalizePlaceName(row.placeFrom);
                const rowTo = normalizePlaceName(row.placeTo);
                if (!boardingRow && rowFrom && rowFrom === trFrom) boardingRow = row;
                if (!alightingRow && rowTo && rowTo === trTo) alightingRow = row;
            });
        }

        rows.forEach((row) => {
            const rowFrom = normalizePlaceName(row.placeFrom);
            const rowTo = normalizePlaceName(row.placeTo);
            if (rowFrom && rowFrom === trFrom && !boardingRow) boardingRow = row;
            if (rowTo && rowTo === trTo && !alightingRow) alightingRow = row;
        });

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

            // Fallback – ak sa nenašiel ani nástup ani výstup
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

            const promises = Object.entries(updates).map(([rid, data]) =>
                updateDoc(doc(window.db, 'transport', rid), data)
            );
            await Promise.all(promises);

            // Prepočítaj zostávajúce segmenty bloku po priradení k autobusu
            try {
                await recomputeBlock(transfer, new Set([transfer.key]));
            } catch (precomputeErr) {
                console.error('[TRANSPORT] Chyba pri prepočte bloku po priradení:', precomputeErr);
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
                    updatedAt: Timestamp.fromDate(new Date()),
                    updatedBy: userProfileData?.email || null,
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
                    updatedAt: Timestamp.fromDate(new Date()),
                    updatedBy: userProfileData?.email || null,
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
        const handleStopHeaderClick = async (stop) => {
            if (stop.isExternalArrivalStop) {
                // už je nastavená – nič nerob
                return;
            }
            const ok = await askConfirm(
                `Chcete nastaviť zastávku "${stop.name}" ako nástupnú/výstupnú zastávku pre externé tímy?`
            );
            if (!ok) return;
            setExternalArrivalStop(stop.id);
        };

        // ============================================================
        // NOVÉ: Render štítku s názvom zastávky + prípadný badge
        // ============================================================
        const renderStopLabel = (stop) => {
            const isExternal = stop.isExternalArrivalStop === true;
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
    // RENDER – plánovanie
    // ============================================================
    const renderPlanning = () => {
        // Filtrovanie dní podľa vybraného dňa v selectboxe
        const daysToRender = selectedDayKey
            ? tournamentDays.filter((d) => d.dayKey === selectedDayKey)
            : tournamentDays;
    
        const hasAnythingToRender =
            buses.length > 0 ||
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
                    buses.map((bus) =>
                        React.createElement(
                            'div',
                            {
                                key: bus.id,
                                className: 'bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden flex-shrink-0 pb-4',
                                style: { width: '1000px', maxWidth: '100%' }
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
                                React.createElement(
                                    'button',
                                    {
                                        type: 'button',
                                        onClick: () => removeBus(bus),
                                        className: 'absolute right-3 text-gray-900/70 hover:text-gray-900 hover:bg-black/10 rounded-full w-8 h-8 flex items-center justify-center transition-colors',
                                        title: 'Odstrániť autobus'
                                    },
                                    React.createElement('i', { className: 'fa-solid fa-trash' })
                                )
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
                                                            { className: 'border border-gray-200 px-4 py-2 text-gray-800 text-center' },
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
                                                                    { className: 'w-full border-collapse text-xs' },
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
        // Filtrovanie podľa zvoleného dňa
        const filteredByDay = selectedDayKey
            ? savedTransfers.filter((t) => t.dayKey === selectedDayKey)
            : savedTransfers;
    
        // ============================================================
        // Pomocná: parsovanie "when" → čas od/do
        // ============================================================
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
                return {
                    startDayKey: found[0].dayKey,
                    endDayKey: found[0].dayKey,
                    startLabel: found[0].label,
                    endLabel: found[0].label,
                    startTime: found[0].time,
                    endTime: found[0].time,
                    startTs: null,
                    endTs: null,
                };
            }
    
            return {
                startDayKey: found[0].dayKey,
                endDayKey: found[1].dayKey,
                startLabel: found[0].label,
                endLabel: found[1].label,
                startTime: found[0].time,
                endTime: found[1].time,
                startTs: null,
                endTs: null,
            };
        };
    
        // ============================================================
        // Pomocná: parsovanie "when" → timestampy (pre výpočet zvyšného času)
        // ============================================================
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
                .replace(/\bzastávok\b/gi, 'zastávka');
    
            return {
                from: normalizePlace(m[1].trim()),
                to: normalizePlace(m[2].trim()),
            };
        };
    
        // ============================================================
        // assignedSegmentKeys – segmenty, ktoré sú už priradené
        // ============================================================
        const assignedSegmentKeys = new Set();
    
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
                        teamsInThisBus.set(key, { boardIdx: idx, alightIdx: null });
                    }
                });
                (row.teamsOut || []).forEach((teamKey) => {
                    const key = String(teamKey);
                    const entry = teamsInThisBus.get(key);
                    if (entry && entry.alightIdx == null) {
                        entry.alightIdx = idx;
                    } else if (!entry) {
                        teamsInThisBus.set(key, { boardIdx: null, alightIdx: idx });
                    }
                });
            });
    
            teamsInThisBus.forEach(({ boardIdx, alightIdx }, teamKey) => {
                const [teamName, category] = teamKey.split('|');
                const tn = String(teamName).trim();
                const cat = cleanCategory(category || '');
    
                if (boardIdx == null || alightIdx == null) return;
                if (alightIdx < boardIdx) return;
    
                const boardRow = sorted[boardIdx];
                const alightRow = sorted[alightIdx];
                const boardFrom = normalizePlaceName(boardRow.placeFrom);
                const alightTo = normalizePlaceName(alightRow.placeTo);
    
                if (boardFrom && alightTo) {
                    assignedSegmentKeys.add(`${dayKey}|${tn}|${cat}|${boardFrom}→${alightTo}`);
                }
    
                for (let k = boardIdx; k <= alightIdx; k++) {
                    const row = sorted[k];
                    const rowFrom = normalizePlaceName(row.placeFrom);
                    const rowTo = normalizePlaceName(row.placeTo);
                    if (!rowFrom || !rowTo) continue;
                    assignedSegmentKeys.add(`${dayKey}|${tn}|${cat}|${rowFrom}→${rowTo}`);
                }
            });
        });
    
        // 2) Pešie presuny
        savedTransfers.forEach((t) => {
            if (t.isWalking !== true) return;
            const fromLoc = normalizePlaceName(t.fromLocation || '');
            const toLoc = normalizePlaceName(t.toLocation || '');
            if (!fromLoc || !toLoc) return;
            assignedSegmentKeys.add(
                `${t.dayKey || ''}|${String(t.teamName || '').trim()}|${cleanCategory(t.category || '')}|${fromLoc}→${toLoc}`
            );
        });
    
        // ============================================================
        // Pomocná: zistí, či je konkrétny segment už priradený
        // ============================================================
        const isSegmentAssigned = (t) => {
            const teamName = String(t.teamName || '').trim();
            const category = cleanCategory(t.category || '');
            const dayKey = t.dayKey || '';
            const fromLoc = normalizePlaceName(t.fromLocation || '');
            const toLoc = normalizePlaceName(t.toLocation || '');
            if (!fromLoc || !toLoc) return false;
            return assignedSegmentKeys.has(`${dayKey}|${teamName}|${category}|${fromLoc}→${toLoc}`);
        };
    
        // ============================================================
        // NOVÉ: Rozlož presuny s intermediateStops na segmenty
        // ============================================================
        const expandedTransfers = [];
    
        filteredByDay.forEach((t) => {
            const stops = Array.isArray(t.intermediateStops) ? t.intermediateStops : [];
    
            if (stops.length === 0) {
                expandedTransfers.push(t);
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
                // Fallback – nevieme vypočítať časy
                for (let i = 0; i < route.length - 1; i++) {
                    const fromLoc = String(route[i] || '').trim();
                    const toLoc = String(route[i + 1] || '').trim();
                    if (normalizePlaceName(fromLoc) === normalizePlaceName(toLoc)) continue;
                    const text = `Presun z ${fromLoc} do ${toLoc}`;
                    const key = buildTransferKey(t.category, t.teamName, t.when, text);
                    expandedTransfers.push({
                        ...t,
                        key,
                        text,
                        fromLocation: fromLoc,
                        toLocation: toLoc,
                        intermediateStops: [],
                        _parentKey: t.key,
                        _parentRoute: `${t.fromLocation} → ${t.toLocation}`,
                        _remainingMinutes: null,
                        _isAssigned: false,
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
            // DÔLEŽITÉ: Čas sa NEROZDEĽUJE medzi segmenty!
            // Každý nevyriešený segment dostane PÔVODNÝ CELÝ INTERVAL.
            // Ak je segment vyriešený autobusom, dostane reálny čas z autobusu.
            // ============================================================
            const finalTimes = new Array(route.length - 1).fill(null);
    
            // 1) Plne vyriešené segmenty (máme reálny čas z autobusu)
            for (let i = 0; i < route.length - 1; i++) {
                const rt = segmentRealTimes[i];
                if (rt && rt.startTs != null && rt.endTs != null) {
                    finalTimes[i] = { startTs: rt.startTs, endTs: rt.endTs };
                }
            }
    
            // 2) Čiastočne vyriešené segmenty (máme len nástup alebo len výstup)
            //    → použijeme reálny čas pre známu časť, pôvodný interval pre zvyšok.
            for (let i = 0; i < route.length - 1; i++) {
                if (finalTimes[i]) continue;
                const rt = segmentRealTimes[i];
                if (rt) {
                    const startTs = rt.startTs != null ? rt.startTs : timeRange.startTs;
                    const endTs = rt.endTs != null ? rt.endTs : timeRange.endTs;
                    finalTimes[i] = { startTs, endTs };
                }
            }
    
            // 3) Plne nevyriešené segmenty → PÔVODNÝ CELÝ INTERVAL,
            //    ale ak predchádzajúci segment je vyriešený autobusom,
            //    začni od jeho konca.
            for (let i = 0; i < route.length - 1; i++) {
                if (finalTimes[i]) continue;
                
                let startTs = timeRange.startTs;
                // Ak predchádzajúci segment je vyriešený, začni od jeho konca
                if (i > 0 && finalTimes[i - 1]) {
                    startTs = finalTimes[i - 1].endTs;
                }

                // ============================================================
                // NOVÉ: Nájdi najbližší NASLEDUJÚCI vyriešený segment
                // a nastav endTs na jeho startTs. Tým sa zabezpečí, že
                // nevyriešený segment nepresiahne začiatok nasledujúceho
                // priradeného segmentu.
                // ============================================================
                let endTs = timeRange.endTs;
                for (let k = i + 1; k < route.length - 1; k++) {
                    if (finalTimes[k] && finalTimes[k].startTs != null) {
                        endTs = finalTimes[k].startTs;
                        break;
                    }
                }

                finalTimes[i] = { startTs, endTs };
            }
    
            // ============================================================
            // KROK 3: Vytvor segmenty + vypočítaj zvyšný čas pre nepriradené
            // ============================================================
            for (let i = 0; i < route.length - 1; i++) {
                const ft = finalTimes[i];
                if (!ft) continue;
    
                // Preskoč segment, ak from === to
                const fromLoc = String(route[i] || '').trim();
                const toLoc = String(route[i + 1] || '').trim();
                if (normalizePlaceName(fromLoc) === normalizePlaceName(toLoc)) continue;
    
                const whenStr = `${formatTsLocal(ft.startTs)} – ${formatTsLocal(ft.endTs)}`;
                const text = `Presun z ${fromLoc} do ${toLoc}`;
                const key = buildTransferKey(t.category, t.teamName, whenStr, text);
    
                // Ak segment NIE JE priradený, vypočítaj zvyšný čas
                let remainingMinutes = null;
    
                if (!segmentAssigned[i]) {
                    let endTs = timeRange.endTs;
                    for (let k = i + 1; k < route.length - 1; k++) {
                        if (segmentAssigned[k] && finalTimes[k]) {
                            endTs = finalTimes[k].startTs;
                            break;
                        }
                    }
    
                    if (endTs != null && ft.startTs != null && endTs > ft.startTs) {
                        remainingMinutes = Math.round((endTs - ft.startTs) / 60000);
                    }
                }
    
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
                });
            }
        });
    
        // Filtrovanie – skry len priradené segmenty
        const baseFiltered = expandedTransfers.filter((t) => {
            if (t.isWalking === true) return false;
            if (isSegmentAssigned(t)) return false;

            // ============================================================
            // NOVÉ: Ak je to časť rozdeleného presunu (má _parentKey),
            // ale NEMÁ zvyšný čas na presun, tak ju nezobrazuj.
            // (Zobrazujú sa len časti, ktoré majú v sebe info o zvyšnom čase)
            // ============================================================
            if (t._parentKey && (t._remainingMinutes == null || t._remainingMinutes <= 0)) {
                return false;
            }

            return true;
        });
    
        const filtered = mergeMode
            ? baseFiltered.filter((t) =>
                baseFiltered.some((other) => canMergeTransfers(t, other))
            )
            : baseFiltered;
    
        // Zoradenie
        const buildStartSortKey = (t) => {
            const r = parseWhenRange(t.when);
            const dayKey = r ? r.startDayKey : (t.dayKey || '');
            const time = r && r.startTime ? r.startTime : '00:00';
            const datePart = String(dayKey || '').replace(/-/g, '');
            const timePart = String(time || '').replace(':', '');
            return `${datePart}${timePart}`;
        };
    
        const buildEndSortKey = (t) => {
            const r = parseWhenRange(t.when);
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
            React.createElement(
                'div',
                { className: 'px-4 py-2 border-b border-gray-200 bg-gray-50 flex items-center gap-2' },
                React.createElement('input', {
                    type: 'checkbox',
                    id: 'merge-transfers-checkbox',
                    checked: mergeMode,
                    onChange: (e) => setMergeMode(e.target.checked),
                    className: 'w-4 h-4 text-violet-600 border-gray-300 rounded focus:ring-violet-500 cursor-pointer',
                }),
                React.createElement(
                    'label',
                    {
                        htmlFor: 'merge-transfers-checkbox',
                        className: 'text-sm font-medium text-gray-700 cursor-pointer select-none'
                    },
                    'Zlúčiť presuny'
                )
            ),
            filtered.length === 0
                ? React.createElement(
                    'p',
                    { className: 'text-center text-gray-500 py-6 text-sm italic px-3' },
                    'Zatiaľ žiadne vygenerované presuny. Kliknite na "+" vpravo dole a vygenerujte časovú os.'
                )
                : React.createElement(
                    'div',
                    { className: 'max-h-[70vh] overflow-y-auto p-3' },
                    React.createElement(
                        'ul',
                        { className: 'space-y-2' },
                        sortedTransfers.map((t) => {
                            const rangeInfo = parseWhenRange(t.when);
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
    
                            let timeLabel = null;
                            if (rangeInfo) {
                                const st = rangeInfo.startTime;
                                const et = rangeInfo.endTime;
                                if (st && et) timeLabel = `${st} – ${et}`;
                                else if (st) timeLabel = st;
                                else if (et) timeLabel = et;
                            }
    
                            let routeLabel = null;
                            if (transferInfo) {
                                if (t.intermediateStops && t.intermediateStops.length > 0) {
                                    routeLabel = [t.fromLocation, ...t.intermediateStops, t.toLocation]
                                        .filter(Boolean)
                                        .join(' → ');
                                } else {
                                    routeLabel = `${transferInfo.from} → ${transferInfo.to}`;
                                }
                            }
    
                            // NOVÉ: informácia o pôvodnom presune
                            const parentInfoLabel = t._parentKey && t._parentRoute
                                ? `časť presunu ${t._parentRoute}`
                                : null;
    
                            // NOVÉ: zvyšný čas na presun (len pre nepriradené segmenty)
                            const remainingLabel = (t._remainingMinutes != null && t._remainingMinutes > 0)
                                ? `zvyšný čas na presun: ${t._remainingMinutes} min`
                                : null;
    
                            return React.createElement(
                                'li',
                                {
                                    key: t.key,
                                    onClick: () => {
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
                                    const fullText = valueText ? `${teamLabel} ● ${valueText}` : teamLabel;
    
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
                                        { className: 'text-[11px] text-violet-600 italic mt-0.5 inline-flex items-center gap-1' },
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
                                React.createElement(
                                    'button',
                                    {
                                        type: 'button',
                                        onClick: (e) => {
                                            e.stopPropagation();
                                            setDeleteTransferModal({ transfer: t });
                                        },
                                        title: 'Odstrániť tento presun',
                                        className: 'absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-white/90 text-red-600 hover:bg-red-100 hover:text-red-800 shadow-sm flex items-center justify-center transition-colors',
                                    },
                                    React.createElement('i', { className: 'fa-solid fa-trash text-[11px]' })
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
                                // Tlačidlo "Zlúčiť"
                                mergeMode &&
                                    (() => {
                                        const mergeCandidate = baseFiltered.find(
                                            (other) => other.key !== t.key && canMergeTransfers(t, other)
                                        );
                                        if (!mergeCandidate) return null;
                                        return React.createElement(
                                            'button',
                                            {
                                                type: 'button',
                                                onClick: (e) => {
                                                    e.stopPropagation();
                                                    setMergeTransfersModal({ first: t, second: mergeCandidate });
                                                },
                                                className: 'mt-1 self-start px-2 py-1 rounded bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 transition-colors'
                                            },
                                            React.createElement('i', { className: 'fa-solid fa-link mr-1' }),
                                            'Zlúčiť s: ',
                                            mergeCandidate.fromLocation,
                                            ' → ',
                                            mergeCandidate.toLocation
                                        );
                                    })(),
                            );
                        })
                    )
                )
        );
    };

    // ============================================================
    // RENDER – box pre pešie presuny (zobrazí sa vedľa autobusov)
    // ============================================================
    const renderWalkingTransfersBox = () => {
        // Zober len pešie presuny pre zvolený deň
        const walkingTransfers = savedTransfers.filter((t) => {
            if (t.isWalking !== true) return false;
            if (selectedDayKey && t.dayKey !== selectedDayKey) return false;
            return true;
        });
    
        // Pomocná: parsovanie "when" → čas od/do
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
                return {
                    startTime: found[0].time,
                    endTime: found[0].time,
                };
            }
            return {
                startTime: found[0].time,
                endTime: found[1].time,
            };
        };
    
        // Pomocná: parsovanie textu "Presun z X do Y"
        const parseTransferText = (text) => {
            if (!text) return null;
            const m = /^Presun z (.+?) do (.+)$/.exec(String(text).trim());
            if (!m) return null;
            const normalizePlace = (str) => String(str)
                .replace(/\bubytovania\b/gi, 'ubytovňa')
                .replace(/\bubytovanie\b/gi, 'ubytovňa')
                .replace(/\bzastávky\b/gi, 'zastávka')
                .replace(/\bzastávok\b/gi, 'zastávka');
            return {
                from: normalizePlace(m[1].trim()),
                to: normalizePlace(m[2].trim()),
            };
        };
    
        // Zoradenie podľa času začiatku
        const sorted = [...walkingTransfers].sort((a, b) => {
            const rA = parseWhenRange(a.when);
            const rB = parseWhenRange(b.when);
            const tA = rA?.startTime || '00:00';
            const tB = rB?.startTime || '00:00';
            return tA.localeCompare(tB);
        });
    
        return React.createElement(
            'div',
            {
                className: 'bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden flex-shrink-0',
                style: { width: '720px', maxWidth: '100%' }
            },
            // Hlavička
            React.createElement(
                'div',
                {
                    className: 'relative px-5 py-3 flex items-center justify-center text-white',
                    style: { backgroundColor: '#059669' } // zelená (emerald-600)
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
                    { className: 'max-h-[70vh] overflow-y-auto p-3' },
                    React.createElement(
                        'table',
                        { className: 'w-full border-collapse text-xs' },
                        React.createElement(
                            'thead',
                            null,
                            React.createElement(
                                'tr',
                                { className: 'bg-gray-100 text-xs font-semibold text-gray-700' },
                                React.createElement('th', { className: 'border border-gray-300 px-2 py-1', style: { width: '70px' } }, 'Od'),
                                React.createElement('th', { className: 'border border-gray-300 px-2 py-1', style: { width: '70px' } }, 'Do'),
                                React.createElement('th', { className: 'border border-gray-300 px-2 py-1' }, 'Miesto od'),
                                React.createElement('th', { className: 'border border-gray-300 px-2 py-1' }, 'Miesto do'),
                                React.createElement('th', { className: 'border border-gray-300 px-2 py-1' }, 'Tím')
                            )
                        ),
                        React.createElement(
                            'tbody',
                            null,
                            sorted.map((t) => {
                                const range = parseWhenRange(t.when);
                                const info = parseTransferText(t.text);
                                const timeFrom = range?.startTime || '';
                                const timeTo = range?.endTime || '';
                                const placeFrom = info?.from || '';
                                const placeTo = info?.to || '';
                                const textColor = getCategoryTextColor(t.category);
    
                                return React.createElement(
                                    'tr',
                                    { key: t.key, className: 'hover:bg-gray-50' },
                                    React.createElement('td', { className: 'border border-gray-300 px-2 py-1 text-center font-semibold text-blue-700' }, timeFrom || '—'),
                                    React.createElement('td', { className: 'border border-gray-300 px-2 py-1 text-center font-semibold text-blue-700' }, timeTo || '—'),
                                    React.createElement('td', { className: 'border border-gray-300 px-2 py-1' }, placeFrom || '—'),
                                    React.createElement('td', { className: 'border border-gray-300 px-2 py-1' }, placeTo || '—'),
                                    React.createElement(
                                        'td',
                                        { className: 'border border-gray-300 px-2 py-1 font-semibold', style: { color: textColor } },
                                        t.teamName || '(neznámy tím)'
                                    ),
                                    // NOVÉ: tlačidlo na odstránenie príznaku "peši"
                                    React.createElement(
                                        'td',
                                        { className: 'border border-gray-300 px-2 py-1 text-center' },
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
                                );
                            })
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
            // === SELECTBOX S DŇAMI TURNAJA (len v režime Plánovanie) ===
            activeView === 'planovanie' && React.createElement(
                'div',
                { className: 'w-full flex flex-wrap items-center justify-center gap-3 mb-6' },
                React.createElement(
                    'label',
                    { className: 'flex items-center gap-2 text-sm font-medium text-gray-700' },
                    React.createElement('i', { className: 'fa-solid fa-filter text-gray-500' }),
                    'Zobraziť deň:'
                ),
                React.createElement(
                    'select',
                    {
                        value: selectedDayKey,
                        onChange: (e) => setSelectedDayKey(e.target.value),
                        disabled: tournamentDays.length === 0,
                        className: 'px-4 py-2 rounded-lg border-2 border-gray-300 bg-white text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed'
                    },
                    React.createElement(
                        'option',
                        { value: '' },
                        'Všetky dni'
                    ),
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
                        React.createElement(
                            'div',
                            { className: 'flex items-center justify-between mb-4 pb-3 border-b border-gray-200' },
                            React.createElement('h3', { className: 'text-xl font-semibold text-gray-700' }, 'Trvania jazdy medzi zastávkami'),
                            React.createElement('span', { className: 'text-sm text-gray-500' }, `Zastávok: ${stopsList.length}`)
                        ),
                        renderTravelTimes()
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
                            setSelectedCategoryForTimeline(cats[0]);
                            setShowCategoryModal(true);
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
                            onClick: () => {
                                const cat = selectedCategoryForTimeline;
                                if (!cat) {
                                    window.showGlobalNotification('Najprv vyberte kategóriu.', 'error');
                                    return;
                                }

                                // Skontroluj, či už pre túto kategóriu existujú nejaké presuny
                                const existingForCat = savedTransfers.filter(
                                    (t) => cleanCategory(t.category || '') === cleanCategory(cat)
                                );

                                if (existingForCat.length > 0) {
                                    // Zobraz potvrdzovacie modálne okno
                                    setRegenTransfersModal({
                                        category: cat,
                                        existingCount: existingForCat.length,
                                    });
                                    setShowCategoryModal(false);
                                    return;
                                }

                                // Žiadne existujúce → generuj priamo
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
        // MODÁLNE OKNO – Potvrdenie zlúčenia presunov
        // ============================================================
        mergeTransfersModal && React.createElement(
            'div',
            {
                className: 'fixed inset-0 bg-black/50 flex items-center justify-center z-[100000] p-4',
                onClick: () => setMergeTransfersModal(null)
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
                        className: 'fa-solid fa-link text-violet-600 text-2xl mt-0.5'
                    }),
                    React.createElement(
                        'h3',
                        { className: 'text-lg font-semibold text-gray-800' },
                        'Zlúčiť presuny'
                    )
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-700 mb-4 text-sm' },
                    'Naozaj chcete zlúčiť tieto dva presuny do jedného?'
                ),
                React.createElement(
                    'div',
                    { className: 'mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm space-y-2' },
                    React.createElement(
                        'div',
                        null,
                        React.createElement('div', { className: 'font-medium text-gray-700' }, 'Prvý presun:'),
                        React.createElement(
                            'div',
                            { className: 'text-gray-600' },
                            `${mergeTransfersModal.first.fromLocation} → ${mergeTransfersModal.first.toLocation}`
                        ),
                        React.createElement(
                            'div',
                            { className: 'text-xs text-gray-500' },
                            mergeTransfersModal.first.when
                        )
                    ),
                    React.createElement(
                        'div',
                        null,
                        React.createElement('div', { className: 'font-medium text-gray-700' }, 'Druhý presun:'),
                        React.createElement(
                            'div',
                            { className: 'text-gray-600' },
                            `${mergeTransfersModal.second.fromLocation} → ${mergeTransfersModal.second.toLocation}`
                        ),
                        React.createElement(
                            'div',
                            { className: 'text-xs text-gray-500' },
                            mergeTransfersModal.second.when
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'pt-2 border-t border-gray-300' },
                        React.createElement('div', { className: 'font-medium text-violet-700' }, 'Výsledný presun:'),
                        React.createElement(
                            'div',
                            { className: 'text-violet-800 font-semibold' },
                            `${mergeTransfersModal.first.fromLocation} → ${mergeTransfersModal.second.toLocation}`
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
                            onClick: () => setMergeTransfersModal(null),
                            disabled: mergeTransfersSaving,
                            className: 'px-4 py-2 rounded-lg border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors disabled:opacity-60'
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: mergeTransfers,
                            disabled: mergeTransfersSaving,
                            className: 'px-4 py-2 rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-700 transition-colors disabled:opacity-60 flex items-center gap-2'
                        },
                        mergeTransfersSaving && React.createElement('i', { className: 'fa-solid fa-spinner fa-spin' }),
                        'Zlúčiť'
                    )
                )
            )
        ),
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
                // Hlavička
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
                        ),
                        React.createElement(
                            'p',
                            { className: 'text-xs text-gray-500 mt-0.5' },
                            `${editingTransfer.teamName} • ${editingTransfer.category}`
                        )
                    )
                ),
                // Info o pôvodnom presune
                React.createElement(
                    'div',
                    { className: 'mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm' },
                    React.createElement(
                        'div',
                        { className: 'font-medium text-gray-700 mb-1' },
                        'Pôvodná trasa:'
                    ),
                    React.createElement(
                        'div',
                        { className: 'text-gray-600' },
                        `${editingTransfer.fromLocation} → ${editingTransfer.toLocation}`
                    ),
                    editingTransfer.when &&
                        React.createElement(
                            'div',
                            { className: 'text-xs text-gray-500 mt-1' },
                            editingTransfer.when
                        )
                ),
                // Medzizastávky
                React.createElement(
                    'div',
                    { className: 'mb-4' },
                    React.createElement(
                        'div',
                        { className: 'flex items-center justify-between mb-2' },
                        React.createElement(
                            'label',
                            { className: 'block text-sm font-medium text-gray-700' },
                            'Medzizastávky (voliteľné)'
                        ),
                        React.createElement(
                            'button',
                            {
                                type: 'button',
                                onClick: () => setEditingTransferStops((prev) => [...prev, '']),
                                className: 'text-sm px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1'
                            },
                            React.createElement('i', { className: 'fa-solid fa-plus' }),
                            'Pridať'
                        )
                    ),
                    editingTransferStops.length === 0 &&
                        React.createElement(
                            'p',
                            { className: 'text-xs text-gray-400 italic' },
                            'Žiadne medzizastávky. Presun pôjde priamo z „' + editingTransfer.fromLocation + '" do „' + editingTransfer.toLocation + '".'
                        ),
                    editingTransferStops.length > 0 &&
                        React.createElement(
                            'ul',
                            { className: 'space-y-2' },
                            editingTransferStops.map((stopValue, idx) =>
                                React.createElement(
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
                                        stopsList.map((s) =>
                                            React.createElement(
                                                'option',
                                                { key: s.id, value: s.name },
                                                s.name
                                            )
                                        )
                                    ),
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
                                )
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
                    { className: 'flex items-start gap-3 mb-4' },
                    React.createElement('i', {
                        className: 'fa-solid fa-circle-question text-blue-600 text-2xl mt-0.5'
                    }),
                    React.createElement(
                        'div',
                        { className: 'flex-1' },
                        React.createElement(
                            'h3',
                            { className: 'text-lg font-semibold text-gray-800' },
                            'Upraviť presun'
                        ),
                        React.createElement(
                            'p',
                            { className: 'text-xs text-gray-500 mt-0.5' },
                            `${transferActionModal.transfer.teamName || ''} • ${transferActionModal.transfer.category || ''}`
                        )
                    )
                ),
                // Info o presune
                React.createElement(
                    'div',
                    { className: 'mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm' },
                    React.createElement(
                        'div',
                        { className: 'text-gray-600 font-medium' },
                        `${transferActionModal.transfer.fromLocation || '?'} → ${transferActionModal.transfer.toLocation || '?'}`
                    ),
                    transferActionModal.transfer.when &&
                        React.createElement(
                            'div',
                            { className: 'text-xs text-gray-500 mt-1' },
                            transferActionModal.transfer.when
                        )
                ),
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
                                setEditingTransfer(t);
                                setEditingTransferStops([]);
                                setTransferActionModal(null);
                            },
                            className: 'w-full text-left px-4 py-3 rounded-lg border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors flex items-center gap-3'
                        },
                        React.createElement('i', { className: 'fa-solid fa-route text-blue-600 text-xl w-6 text-center' }),
                        React.createElement(
                            'div',
                            { className: 'flex-1' },
                            React.createElement('div', { className: 'font-semibold text-gray-800' }, 'Pridať medzizastávku'),
                            React.createElement('div', { className: 'text-xs text-gray-500' }, 'Rozdeliť trasu na viac segmentov')
                        )
                    ),
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: () => {
                                const matches = findMatchingBusRows(transferActionModal.transfer);
                                setAssignBusMatches(matches);
                                setAssignBusSelectedKey(
                                    matches.length > 0
                                        ? `${matches[0].bus.id}|${matches[0].boardingRow?.id || ''}|${matches[0].alightingRow?.id || ''}|${matches[0].side}`
                                        : ''
                                );
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
                // Zavrieť
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
                        'Zavrieť'
                    )
                )
            )
        ),
        showAssignBusModal && transferActionModal?.transfer && React.createElement(
            'div',
            {
                className: 'fixed inset-0 bg-black/50 flex items-center justify-center z-[100001] p-4',
                onClick: () => setShowAssignBusModal(false)
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

                // ============================================================
                // VAROVANIE – presunuté DOVNÚTRA modálneho okna (pod hlavičku)
                // ============================================================
                !arePreviousSegmentsResolved(transferActionModal.transfer) &&
                React.createElement(
                    'div',
                    { className: 'mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm' },
                    React.createElement(
                        'p',
                        { className: 'text-amber-700 flex items-start gap-2' },
                        React.createElement('i', { className: 'fa-solid fa-triangle-exclamation mt-0.5' }),
                        React.createElement(
                            'span',
                            null,
                            'Najprv musíte priradiť predchádzajúce segmenty tohto presunu (alebo ich označiť ako „peši"). ',
                            'Tento presun začína neskôr, takže tím sa musí najprv dostať na miesto odchodu.'
                        )
                    )
                ),

                // ============================================================
                // INFO O PRESUNE
                // ============================================================
                React.createElement(
                    'div',
                    { className: 'mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700' },
                    React.createElement('div', { className: 'font-medium' },
                        `${transferActionModal.transfer.fromLocation} → ${transferActionModal.transfer.toLocation}`),
                    React.createElement('div', { className: 'text-xs text-gray-500 mt-1' },
                        `${transferActionModal.transfer.teamName || ''}${transferActionModal.transfer.when ? ' • ' + transferActionModal.transfer.when : ''}`)
                ),

                // ============================================================
                // DYNAMICKÝ VÝPOČET ZOZNAMU AUTOBUSOV
                // ============================================================
                (() => {
                    const currentMatches = findMatchingBusRows(transferActionModal.transfer);

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
                                                { className: 'flex flex-col items-end gap-1 text-xs font-semibold' },
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
                                );
                            }).filter(Boolean)
                        )
                    );
                })(),

                // ============================================================
                // TLAČIDLÁ
                // ============================================================
                React.createElement(
                    'div',
                    { className: 'flex justify-end gap-3' },
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: () => setShowAssignBusModal(false),
                            disabled: assignBusSaving,
                            className: 'px-4 py-2 rounded-lg border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors disabled:opacity-60'
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: assignTransferToBus,
                            disabled: assignBusSaving || !assignBusSelectedKey || assignBusMatches.length === 0 || !arePreviousSegmentsResolved(transferActionModal.transfer),
                            className: 'px-4 py-2 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-700 transition-colors disabled:opacity-60 flex items-center gap-2'
                        },
                        assignBusSaving && React.createElement('i', { className: 'fa-solid fa-spinner fa-spin' }),
                        'Priradiť'
                    )
                )
            )
        ),
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
                            onClick: () => {
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
