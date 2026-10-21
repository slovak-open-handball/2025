// logged-in-transport.js
import { doc, getDoc, getDocs, onSnapshot, updateDoc, addDoc, collection, Timestamp, setDoc, deleteDoc, writeBatch, deleteField } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const { useState, useEffect, useRef, useSyncExternalStore } = React;

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

const cleanCategory = (cat) => String(cat || '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

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

const TransportApp = ({ userProfileData }) => {
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

    // ==== PLÁNOVANIE – AUTOBUSY A DNI TURNAJA ====
    const [buses, setBuses] = useState([]);
    const [tournamentDays, setTournamentDays] = useState([]);
    const [tournamentDaysLoaded, setTournamentDaysLoaded] = useState(false);
    const [busSaving, setBusSaving] = useState(false);
    const [confirmModal, setConfirmModal] = useState(null);

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
        lines.push(`\n  [TRANSPORT] Tím: ${teamName} (${events.length} udalostí)`);

        if (isSuperstructureTeam) {
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
            rebuildAndLogTimeline();
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
    const rebuildAndLogTimeline = () => {
        if (!matchesLoadedRef.current || !cateringLoadedRef.current || !teamsLoadedRef.current) {
            return;
        }
    
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

                // DEBUG
                console.log('[TRANSPORT][DEBUG-GROUP]', {
                    groupKey,
                    hasData: !!fromSuperstructure,
                    size: fromSuperstructure ? fromSuperstructure.size : 0,
                    teams: fromSuperstructure ? [...fromSuperstructure] : [],
                    allKeys: Object.keys(superstructureGroupsRef.current),
                });

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
    
        const formatDayWithTime = (dayRefTs, hh, mm) => {
            const ts = timestampOnDay(dayRefTs, hh, mm);
            if (ts == null) return null;
            return formatDateTime(new Date(ts));
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
    
        console.log('[TRANSPORT][DEBUG] globalFirstDay:', globalFirstDay);

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
        
        console.log('[TRANSPORT][DEBUG] globalLastDay:', globalLastDay);

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
        // NOVÉ: Pomocná funkcia – získa ubytovania pre danú kategóriu a skupinu
        // ============================================================
        const getAccommodationsForGroup = (category, groupName) => {
            if (!category || !groupName) return [];
            const targetCategory = cleanCategory(category);
            const targetGroup = String(groupName).trim();
            const result = new Set();
    
            teamsArrivalBufferRef.current.forEach((t) => {
                if (cleanCategory(t.category) !== targetCategory) return;
                const teamGroup = t.groupName ? String(t.groupName).trim() : null;
                if (!teamGroup || teamGroup !== targetGroup) return;
                if (t.accommodationName && t.accommodationName.trim()) {
                    result.add(t.accommodationName.trim());
                }
            });
    
            return [...result].sort((a, b) => a.localeCompare(b, 'sk', { sensitivity: 'base' }));
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
            const groupEndLocationsPerDay = {};
            const groupEndLocationsByLastCharPerDay = {};
    
            Object.entries(grouped).forEach(([category, teamsObj]) => {
                Object.entries(teamsObj).forEach(([teamName, events]) => {
                    const teamGroup = (() => {
                        const groups = teamsByGroup[category] || {};
                        for (const [gName, teamSet] of Object.entries(groups)) {
                            if (teamSet.has(teamName)) return gName;
                        }
                        return null;
                    })();

                    // POZOR: teamGroup môže byť null (tím nemá skupinu).
                    // Stále chceme spracovať jeho udalosti, ale "end locations per group"
                    // logiku preskočíme.

                    const lastEventsByDay = {};
                    events.forEach((ev) => {
                        if (ev.type !== 'match' && ev.type !== 'catering') return;
                        const dayKey = extractDayKeyFromWhen(ev.when);
                        if (!dayKey) return;
                        const endTs =
                            ev.endTs != null ? ev.endTs :
                            ev.startTs != null ? ev.startTs :
                            null;
                        if (endTs == null) return;
    
                        if (
                            !lastEventsByDay[dayKey] ||
                            endTs > (lastEventsByDay[dayKey].endTs ?? -Infinity)
                        ) {
                            lastEventsByDay[dayKey] = { ev, endTs };
                        }
                    });
    
                    Object.entries(lastEventsByDay).forEach(([dayKey, { ev, endTs }]) => {
                        const location = ev.location || null;
                        if (!location) return;
                        if (!teamGroup) return;   // ← NOVÉ: bez skupiny nerob "end locations" logiku

                        const key = `${category}|${teamGroup}|${dayKey}`;
                        if (!groupEndLocationsPerDay[key]) {
                            groupEndLocationsPerDay[key] = new Map();
                        }
                        const locMap = groupEndLocationsPerDay[key];
                        if (!locMap.has(location) || endTs > (locMap.get(location).endTs ?? -Infinity)) {
                            locMap.set(location, { location, endTs });
                        }
    
                        const groupLastChar = teamGroup.trim().slice(-1).toUpperCase();
                        if (groupLastChar && /[A-ZÁ-Ž]/.test(groupLastChar)) {
                            const keyChar = `${category}|${groupLastChar}|${dayKey}`;
                            if (!groupEndLocationsByLastCharPerDay[keyChar]) {
                                groupEndLocationsByLastCharPerDay[keyChar] = new Map();
                            }
                            const locMapChar = groupEndLocationsByLastCharPerDay[keyChar];
                            if (!locMapChar.has(location) || endTs > (locMapChar.get(location).endTs ?? -Infinity)) {
                                locMapChar.set(location, { location, endTs });
                            }
                        }
                    });
                });
            });

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

                    // IBA zápasy, ktoré sú priradené priamo do skupiny s daným písmenom.
                    const matchGroup = m.groupName ? String(m.groupName).trim() : null;
                    if (!matchGroup) return;
                    if (!groupBelongsToChar(matchGroup, char)) return;

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
                            // Nájdi všetky hracie dni skupiny, kedy tím NEMÁ udalosť
                            const teamEventDays = new Set();
                            events.forEach((ev) => {
                                const evDay = extractDayKeyFromWhen(ev.when);
                                if (evDay) teamEventDays.add(evDay);
                            });
                    
                            const groupPlayDays = [...ssPlayDatesByTeam[ssTeamKeyPre]].sort();
                    
                            groupPlayDays.forEach((groupPlayDay) => {
                                // Ak tím má udalosť v tento deň, preskoč – rieši sa v cykle
                                if (teamEventDays.has(groupPlayDay)) return;
                    
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

                                // Pomocná: zisti, či tím má ubytovanie (alebo je to tím zo skupiny s ubytovaním)
                                const getTeamAccommodationPre = (tn) => {
                                    if (!tn) return null;
                                    const info = (teamsArrivalBufferRef.current || []).find(
                                        (t) => cleanCategory(t.category) === cleanCategory(category) && t.teamName === tn
                                    );
                                    if (!info) return null;
                                    if (!info.accommodationName || info.accommodationName.trim() === '') return null;
                                    return info.accommodationName.trim();
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
                                        return [m.home, m.away].some((tn) => teamBelongsToChar(tn, category));
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
                                        return teamBelongsToChar(tn, category);
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
                                //  - Ak deň JE hrací deň skupiny (groupHasAnyEventOnCurrentDay) →
                                //    generuj presuny z MIEST POSLEDNÝCH UDALOSTÍ tímov zo skupiny
                                //    (NIE z ubytovní).
                                //  - Inak → generuj ranné presuny z ubytovní (pôvodná logika).
                                // ============================================================
                                const useGroupEndLocationsAsSource = groupHasAnyEventOnCurrentDay;
                            
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
                                        (teamsArrivalBufferRef.current || []).forEach((t) => {
                                            if (cleanCategory(t.category) !== cleanCategory(category)) return;
                                            if (!t.teamName) return;
                                            if (t.teamName === teamName) return;
                                            if (!t.accommodationName || t.accommodationName.trim() === '') return;
                                            if (!isRealRegisteredTeam(t.teamName, category)) return;
                                            if (!teamBelongsToChar(t.teamName, category)) return;
                                            updateUniqueSource(t.accommodationName.trim(), null);
                                        });
                            
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
                                    // Deň NIE JE hrací deň skupiny a žiadny tím zo skupiny nemá
                                    // udalosť → použijeme pôvodnú logiku ranných presunov z ubytovní.
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
                            
                                        // Ubytovania tímov zo skupiny s rovnakým písmenom
                                        (teamsArrivalBufferRef.current || []).forEach((t) => {
                                            if (cleanCategory(t.category) !== cleanCategory(category)) return;
                                            if (!t.teamName) return;
                                            if (t.teamName === teamName) return;
                                            if (!t.accommodationName || t.accommodationName.trim() === '') return;
                                            if (!isRealRegisteredTeam(t.teamName, category)) return;
                                            if (!teamBelongsToChar(t.teamName, category)) return;
                                            updateUniqueSource(t.accommodationName.trim(), null);
                                        });
                            
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
                        
                                if (isPureSuperstructureGroup && anySSGroupTeamPlaysToday && current.location) {
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
                                    isPureSuperstructureGroup && anySSGroupTeamPlaysToday;
                                
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
                                    ssPlayDatesByTeam[ssTeamKey] &&
                                    currentDay != null &&
                                    ssPlayDatesByTeam[ssTeamKey].has(currentDay);
                                
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
                                                ? `zastávky ${fromLocationName}`
                                                : `ubytovania ${fromLocationName}`;
                                
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
                                            text: `Presun z ${current.location} do ubytovania ${accomName}`,
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

        if (!window.__transport_preloadDone) {
            window.__transport_preloadDone = true;
            preloadAccommodationsForSuperstructureTeams().then(() => {
                // Po načítaní cache znova zavolaj rebuild
                rebuildAndLogTimeline();
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
                }
                setTravelTimes(map);
            }, (err) => {
                console.error('[TRANSPORT] onSnapshot(settings/transportTravelTimes) error:', err);
            });
        } catch (e) {
            console.error('[TRANSPORT] Nepodarilo sa nastaviť listener na transportTravelTimes:', e);
        }

        // 0a1d) KOLEKCIA `transport` – autobusy (dokumenty typu 'bus')
        let unsubscribeBuses = null;
        try {
            const transportRef = collection(window.db, 'transport');
            unsubscribeBuses = onSnapshot(transportRef, (snapshot) => {
                const list = [];
                snapshot.forEach((docSnap) => {
                    const data = docSnap.data() || {};
                    if (data.type !== 'bus') return;
                    const num = Number(data.number);
                    list.push({
                        id: docSnap.id,
                        name: data.name || (Number.isFinite(num) ? `Bus ${num}` : 'Bus'),
                        number: Number.isFinite(num) ? num : 0,
                    });
                });
                list.sort((a, b) => a.number - b.number);
                setBuses(list);
            }, (err) => {
                console.error('[TRANSPORT] onSnapshot(transport – buses) error:', err);
            });
        } catch (e) {
            console.error('[TRANSPORT] Nepodarilo sa nastaviť listener na transport (buses):', e);
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

        // 0a3) KATEGÓRIE (trvanie zápasu)
        try {
            const catRef = doc(window.db, 'settings', 'categories');
            unsubscribeCategorySettings = onSnapshot(catRef, (snap) => {
                const map = {};
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
                    });
                }
                window.__transport_categories = map;
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

                const ssCount = buffer.filter((b) => b.isSuperstructure).length;
                console.log(
                    `[TRANSPORT][SS-FALLBACK] Superstructure tímy detegované (nie sú v users): ${ssCount}`
                );
                if (ssCount > 0) {
                    console.log(
                        '[TRANSPORT][SS-FALLBACK] Zoznam:',
                        buffer
                            .filter((b) => b.isSuperstructure)
                            .map((b) => `${b.category} / ${b.teamName}`)
                    );
                }

                teamsArrivalBufferRef.current = buffer;
                teamsLoadedRef.current = true;

                rebuildAndLogTimeline();

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

            rebuildAndLogTimeline();
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
    // PRIDANIE NOVÉHO AUTOBUSU
    // ============================================================
    const addNewBus = async () => {
        if (!window.db || busSaving) return;
        setBusSaving(true);
        try {
            const maxNumber = buses.reduce(
                (max, b) => (b.number > max ? b.number : max),
                0
            );
            const nextNumber = maxNumber + 1;

            const docRef = doc(collection(window.db, 'transport'));
            await setDoc(docRef, {
                type: 'bus',
                number: nextNumber,
                name: `Bus ${nextNumber}`,
                createdAt: Timestamp.fromDate(new Date()),
                createdBy: userProfileData?.email || null,
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
                                className: 'border border-gray-300 bg-gray-100 p-0 whitespace-nowrap sticky left-0 z-10',
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
                                    className: `border border-gray-300 bg-gray-100 px-3 py-2 text-left font-bold text-gray-700 whitespace-nowrap sticky left-0 z-10 ${
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
                                return React.createElement(
                                    'td',
                                    {
                                        key: `td-${fromStop.id}-${toStop.id}`,
                                        className: 'border border-gray-300 px-1 py-1 text-center'
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
                                        className: `w-24 px-2 py-1 border rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 text-black ${
                                            changed ? 'border-amber-400 bg-amber-50' : 'border-gray-300 bg-white'
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
    // RENDER – plánovanie
    // ============================================================
    const renderPlanning = () => {
        return React.createElement(
            'div',
            { className: 'w-full flex flex-col items-start justify-start py-6 relative min-h-[400px]' },

            buses.length === 0
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
                    buses.map((bus) =>
                        React.createElement(
                            'div',
                            {
                                key: bus.id,
                                className: 'bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden flex-shrink-0',
                                style: { width: '650px', maxWidth: '100%' }
                            },
                            // ... pôvodný obsah boxu autobusu ...
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
                                : React.createElement(
                                    'table',
                                    { className: 'w-full border-collapse text-sm' },
                                    React.createElement(
                                        'tbody',
                                        null,
                                        tournamentDays.map((day, idx) =>
                                            React.createElement(
                                                'tr',
                                                {
                                                    key: day.dayKey,
                                                    className: idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                                                },
                                                React.createElement(
                                                    'td',
                                                    { className: 'border border-gray-200 px-4 py-2 text-gray-800 text-center' },
                                                    React.createElement(
                                                        'span',
                                                        { className: 'font-semibold capitalize' },
                                                        day.dayName
                                                    ),
                                                    React.createElement(
                                                        'span',
                                                        { className: 'text-gray-500 mx-2' },
                                                        '–'
                                                    ),
                                                    React.createElement(
                                                        'span',
                                                        null,
                                                        day.dateLabel
                                                    )
                                                )
                                            )
                                        )
                                    )
                                )
                        )
                    ),
                    // NOVÉ: zelené tlačidlo "+" napravo od posledného boxu autobusu
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
    // HLAVNÝ RENDER
    // ============================================================
    return React.createElement(
        'div',
        { className: 'w-full flex-1 flex flex-col' },
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
            'button',
            {
                onClick: () => {
                    console.log('[TRANSPORT] Bolo kliknuté na plávajúce zelené tlačidlo "+" v pravom dolnom rohu (bez akcie).');
                },
                className: `fixed bottom-8 right-8 w-14 h-14 rounded-full bg-green-600 text-white shadow-xl hover:bg-green-700 active:scale-95 transition-all duration-200 flex items-center justify-center text-2xl font-bold z-[9999]`,
                title: 'Plávajúce tlačidlo (iba log)'
            },
            React.createElement('i', {
                className: 'fa-solid fa-plus'
            })
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
