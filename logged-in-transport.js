// logged-in-transport.js
import { doc, getDoc, getDocs, onSnapshot, updateDoc, addDoc, collection, Timestamp, setDoc, deleteDoc, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
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
    // Zabráni opakovanému spracovaniu pred prvým načítaním
    const matchesLoadedRef = useRef(false);
    const cateringLoadedRef = useRef(false);
    const teamsLoadedRef = useRef(false);

    // UI prepínač: 'planovanie' | 'nastavenia'
    const [activeView, setActiveView] = useState('planovanie');

    // Zoznam všetkých miest (z kolekcie `places`)
    const [allPlaces, setAllPlaces] = useState([]);

    // Priradenia miesto → zastávka (z kolekcie `transport`)
    //   transportAssignments[placeId] = { stopId, stopName }
    const [transportAssignments, setTransportAssignments] = useState({});
    // Uložené zastávky pre select
    const [stopsList, setStopsList] = useState([]);

    // ==== MODÁLNE OKNO PRE PRIRADENIE ====
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [assignTargetStop, setAssignTargetStop] = useState(null); // zastávka, ku ktorej priradujeme
    const [assignSelectedIds, setAssignSelectedIds] = useState({}); // { placeId: true/false }
    const [assignSaving, setAssignSaving] = useState(false);
    const [assignSearch, setAssignSearch] = useState('');

    // ==== MODÁLNE OKNO PRE PRIRADENIE MIESTA K ZASTÁVKE ====
    const [isPlaceForStopModalOpen, setIsPlaceForStopModalOpen] = useState(false);
    const [placeForStopTarget, setPlaceForStopTarget] = useState(null); // miesto, ktorému priradujeme zastávku
    const [placeForStopSelectedStopId, setPlaceForStopSelectedStopId] = useState('');
    const [placeForStopSaving, setPlaceForStopSaving] = useState(false);

    // ==== POD-ZÁLOŽKA V NASTAVENIACH ====
    // 'priradenie' | 'trvanie'
    const [nastaveniaTab, setNastaveniaTab] = useState('trvanie');

    // ==== TRVANIA JÁZDY MEDZI ZASTÁVKAMI ====
    // travelTimes[`${fromId}|${toId}`] = { fromId, fromName, toId, toName, minutes }
    const [travelTimes, setTravelTimes] = useState({});
    // Maticový editor – dočasné hodnoty (string), kľúč `fromId|toId`
    const [travelTimesDraft, setTravelTimesDraft] = useState({});
    const [travelTimesSaving, setTravelTimesSaving] = useState(false);

    // ==== PLÁNOVANIE – AUTOBUSY A DNI TURNAJA ====
    // Zoznam autobusov: [{ id, name, number }]
    const [buses, setBuses] = useState([]);
    // Zoznam dní turnaja: [{ dayKey, dateLabel, dayName }]
    const [tournamentDays, setTournamentDays] = useState([]);
    // Načítané? (aby sme pred prvým snapshotom nezobrazovali „žiadne dátumy“)
    const [tournamentDaysLoaded, setTournamentDaysLoaded] = useState(false);
    const [busSaving, setBusSaving] = useState(false);

    // ============================================================
    // ZBUILDÍ A VYPÍŠE ČASOVÚ OS PRE KAŽDÝ TÍM V KAŽDEJ KATEGÓRII
    // ============================================================
    const rebuildAndLogTimeline = () => {
        if (!matchesLoadedRef.current || !cateringLoadedRef.current || !teamsLoadedRef.current) {
            return;
        }

        const grouped = {};

        const ensure = (category, teamName) => {
            if (!grouped[category]) grouped[category] = {};
            if (!grouped[category][teamName]) grouped[category][teamName] = [];
            return grouped[category][teamName];
        };

        // 1) TÍMY – info o skupine, ubytovaní a doprave
        teamsArrivalBufferRef.current.forEach((t) => {
            const arr = ensure(t.category, t.teamName);

            if (t.groupName) {
                const orderStr = t.order != null ? `, poradie ${t.order}` : '';
                arr.push({
                    ts: -Infinity,
                    when: '—',
                    type: 'group',
                    text: `Skupina: ${t.groupName}${orderStr}`,
                });
            }

            if (t.accommodationName) {
                arr.push({
                    ts: -Infinity,
                    when: '—',
                    type: 'accommodation',
                    text: `Ubytovanie: "${t.accommodationName}" (typ: ${t.accommodationType || 'neurčený'})`,
                });
            }

            if (t.arrivalDisplay && t.arrivalDisplay !== '---') {
                arr.push({
                    ts: -Infinity,
                    when: '—',
                    type: 'arrival',
                    text: `Doprava / príchod: ${t.arrivalDisplay}`,
                });
            }
        });

        // 2) ZÁPASY
        matchesBufferRef.current.forEach((m) => {
            const timeRange = m.scheduledTime
                ? (m.scheduledEndTime ? `${m.scheduledTime} – ${m.scheduledEndTime}` : m.scheduledTime)
                : 'nenaplánované';
            const text = `${m.home} vs ${m.away}${m.special}${m.hallName ? ` | ${m.hallName}` : ''}${m.status ? ` | status=${m.status}` : ''}`;

            ensure(m.category, m.home).push({
                ts: m.scheduledTs ?? Number.POSITIVE_INFINITY,
                when: timeRange,
                type: 'match',
                text,
            });
            if (m.away !== m.home) {
                ensure(m.category, m.away).push({
                    ts: m.scheduledTs ?? Number.POSITIVE_INFINITY,
                    when: timeRange,
                    type: 'match',
                    text,
                });
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

            ensure(c.category, c.teamName).push({
                ts: c.ts ?? Number.POSITIVE_INFINITY,
                when: `${formattedDay} ${timeRange}`.trim(),
                type: 'catering',
                text: `${mealLabel} (${timeRange}) → ${c.placeName}${superstructureStr}${flagStr}`,
            });
        });

        // ============================================================
        // VÝPIS
        // ============================================================
        console.log('[TRANSPORT] ===== ČASOVÁ OS UDALOSTÍ PRE KAŽDÝ TÍM =====');
        const categories = Object.keys(grouped).sort((a, b) =>
            a.localeCompare(b, 'sk', { sensitivity: 'base' })
        );

        if (categories.length === 0) {
            console.log('[TRANSPORT] Žiadne udalosti.');
        } else {
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

                    console.log(`\n  [TRANSPORT] Tím: ${teamName} (${events.length} udalostí)`);
                    events.forEach((ev) => {
                        let icon = '•';
                        if (ev.type === 'match') icon = '🏑';
                        else if (ev.type === 'catering') icon = '🍽';
                        else if (ev.type === 'arrival') icon = '🚌';
                        else if (ev.type === 'accommodation') icon = '🛏';
                        else if (ev.type === 'group') icon = '📂';

                        const when = ev.when || '—';
                        console.log(`     ${icon} ${when}  |  ${ev.text}`);
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
        let unsubscribeTransport = null;

        // ============================================================
        // 0a) MIESTO (places) – mapa placeId → názov (pre zápasy)
        // ============================================================
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

        // ============================================================
        // 0a1) VŠETKY MIESTA (places) – pre záložku „Nastavenia"
        // ============================================================
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
                    });
                });
                list.sort((a, b) => a.name.localeCompare(b.name, 'sk', { sensitivity: 'base' }));
                setAllPlaces(list);
            }, (err) => {
                console.error('[TRANSPORT] onSnapshot(places) pre záložku Nastavenia error:', err);
            });
        } catch (e) {
            console.error('[TRANSPORT] Nepodarilo sa nastaviť listener na places (Nastavenia):', e);
        }

        // ============================================================
        // 0a1b) KOLEKCIA `transport` – priradenia miesto → zastávka
        // ============================================================
        try {
            const transportRef = collection(window.db, 'transport');
            unsubscribeTransport = onSnapshot(transportRef, (snapshot) => {
                const map = {};
                snapshot.forEach((docSnap) => {
                    const data = docSnap.data() || {};
                    if (data.placeId) {
                        map[data.placeId] = {
                            stopId: data.stopId || null,
                            stopName: data.stopName || null,
                        };
                    } else {
                        map[docSnap.id] = {
                            stopId: data.stopId || null,
                            stopName: data.stopName || null,
                        };
                    }
                });
                setTransportAssignments(map);
            }, (err) => {
                console.error('[TRANSPORT] onSnapshot(transport) error:', err);
            });
        } catch (e) {
            console.error('[TRANSPORT] Nepodarilo sa nastaviť listener na transport:', e);
        }

        // ============================================================
        // 0a1c) TRVANIA JÁZDY MEDZI ZASTÁVKAMI (settings/transportTravelTimes)
        // ============================================================
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

        // ============================================================
        // 0a1d) KOLEKCIA `transport` – autobusy (dokumenty typu 'bus')
        // ============================================================
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

        // ============================================================
        // 0a2) STRAVOVACIA JEDNOTKA (unitMinutes)
        // ============================================================
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

        // ============================================================
        // 0a3) KATEGÓRIE (trvanie zápasu)
        // ============================================================
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

        // ============================================================
        // 0b) POUŽÍVATELIA (users) – lookup pre názvy tímov
        // ============================================================
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

        // ============================================================
        // 1) DÁTUMY TURNAJA + GENEROVANIE DNI PRE PLÁNOVANIE
        // ============================================================
        try {
            const regRef = doc(window.db, 'settings', 'registration');
            unsubscribeRegistration = onSnapshot(regRef, (snap) => {
                if (!snap.exists()) {
                    setTournamentDays([]);
                    setTournamentDaysLoaded(true);
                    return;
                }
                const data = snap.data() || {};

                console.log('[TRANSPORT] (live) tournamentStart:', formatDateDDMMYYYY(data.tournamentStart));
                console.log('[TRANSPORT] (live) tournamentEnd:  ', formatDateDDMMYYYY(data.tournamentEnd));

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

        // ============================================================
        // 2) TÍMY – ubytovanie + typ dopravy + čas príchodu + skupina
        // ============================================================
        const loadTeamsWithAccommodation = async () => {
            try {
                const usersRef = collection(window.db, 'users');
                const usersSnap = await getDocs(usersRef);

                const buffer = [];

                usersSnap.forEach((userDoc) => {
                    const userData = userDoc.data() || {};
                    const teams = userData.teams;
                    if (!teams || typeof teams !== 'object') return;

                    Object.entries(teams).forEach(([category, teamArray]) => {
                        if (!Array.isArray(teamArray)) return;
                        const cat = cleanCategory(category);
                        teamArray.forEach((team) => {
                            if (!team || !team.teamName) return;
                            const accomType = team.accommodation?.type?.trim?.() || '';
                            const accomName = team.accommodation?.name?.trim?.() || '';

                            buffer.push({
                                category: cat,
                                teamName: team.teamName.trim(),
                                accommodationType: accomType || '(nešpecifikovaný)',
                                accommodationName: accomName,
                                arrivalDisplay: formatArrival(team.arrival),
                                groupName: team.groupName ? String(team.groupName).trim() : null,
                                order: (typeof team.order === 'number' && team.order > 0) ? team.order : null,
                            });
                        });
                    });
                });

                teamsArrivalBufferRef.current = buffer;
                teamsLoadedRef.current = true;

                rebuildAndLogTimeline();

            } catch (err) {
                console.error('[TRANSPORT] Chyba pri načítaní tímov s ubytovaním:', err);
            }
        };

        // ============================================================
        // 3) VŠETKY ZÁPASY PODĽA KATEGÓRIÍ
        // ============================================================
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

                buffer.push({
                    category,
                    home: homeDisplayName,
                    away: awayDisplayName,
                    scheduledTs,
                    scheduledTime: data.scheduledTime ? formatDateTime(data.scheduledTime) : null,
                    scheduledEndTs,
                    scheduledEndTime,
                    hallName,
                    status: data.status || 'pending',
                    special,
                });
            });

            matchesBufferRef.current = buffer;
            matchesLoadedRef.current = true;

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

        // ============================================================
        // 4) VŠETKY NAPLÁNOVANÉ STRAVOVANIA
        // ============================================================
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

        loadTeamsWithAccommodation();

        return () => {
            if (unsubscribeRegistration) unsubscribeRegistration();
            if (unsubscribeMatches) unsubscribeMatches();
            if (unsubscribeCatering) unsubscribeCatering();
            if (unsubscribePlaces) unsubscribePlaces();
            if (unsubscribeAllPlaces) unsubscribeAllPlaces();
            if (unsubscribeCateringSettings) unsubscribeCateringSettings();
            if (unsubscribeCategorySettings) unsubscribeCategorySettings();
            if (unsubscribeTransport) unsubscribeTransport();
            if (unsubscribeTravelTimes) unsubscribeTravelTimes();
            if (unsubscribeBuses) unsubscribeBuses();
        };
    }, []);

    // ============================================================
    // Naplnenie `stopsList` pri zmene `allPlaces`
    // ============================================================
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
    // PRIDANIE NOVÉHO AUTOBUSU (plánovanie) – uloženie do Firestore
    // ============================================================
    const addNewBus = async () => {
        if (!window.db || busSaving) return;
        setBusSaving(true);
        try {
            // 1) Zisti najvyššie existujúce číslo busu
            const maxNumber = buses.reduce(
                (max, b) => (b.number > max ? b.number : max),
                0
            );
            const nextNumber = maxNumber + 1;

            // 2) Vytvor dokument v kolekcii `transport`
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

    // ============================================================
    // ODSTRÁNENIE AUTOBUSU
    // ============================================================
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
    // OTVORENIE MODÁLU PRE PRIradenie miest k zastávke
    // ============================================================
    const openAssignModalForStop = (stop) => {
        // Predvyplníme checkboxy podľa aktuálnych priradení
        const preselected = {};
        Object.entries(transportAssignments).forEach(([placeId, a]) => {
            if (a && a.stopId === stop.id) {
                preselected[placeId] = true;
            }
        });
        setAssignTargetStop(stop);
        setAssignSelectedIds(preselected);
        setAssignSearch('');
        setIsAssignModalOpen(true);
    };

    const closeAssignModal = () => {
        setIsAssignModalOpen(false);
        setAssignTargetStop(null);
        setAssignSelectedIds({});
        setAssignSearch('');
    };

    const toggleAssignSelection = (placeId) => {
        setAssignSelectedIds((prev) => {
            const next = { ...prev };
            if (next[placeId]) delete next[placeId];
            else next[placeId] = true;
            return next;
        });
    };

    // ============================================================
    // ULOŽENIE PRIradenia miest k zastávke (batch)
    // ============================================================
    const saveAssignmentsForStop = async () => {
        if (!window.db || !assignTargetStop) return;
        setAssignSaving(true);
        try {
            const batch = writeBatch(window.db);

            // 1) Zmažeme existujúce priradenia pre túto zastávku (všetky miesta, ktoré k nej patrili)
            Object.entries(transportAssignments).forEach(([placeId, a]) => {
                if (a && a.stopId === assignTargetStop.id) {
                    const ref = doc(window.db, 'transport', placeId);
                    batch.delete(ref);
                }
            });

            // 2) Pridáme nové priradenia pre všetky zaškrtnuté miesta
            const now = Timestamp.fromDate(new Date());
            const selectedIds = Object.keys(assignSelectedIds).filter((id) => assignSelectedIds[id]);

            selectedIds.forEach((placeId) => {
                const place = allPlaces.find((p) => p.id === placeId);
                if (!place) return;
                const ref = doc(window.db, 'transport', placeId);
                batch.set(ref, {
                    placeId: place.id,
                    placeName: place.name,
                    placeType: place.type || null,
                    stopId: assignTargetStop.id,
                    stopName: assignTargetStop.name,
                    updatedAt: now,
                    updatedBy: userProfileData?.email || null,
                }, { merge: true });
            });

            await batch.commit();

            window.showGlobalNotification(
                `Zastávka "${assignTargetStop.name}" – priradených ${selectedIds.length} miest.`,
                'success'
            );
            closeAssignModal();
        } catch (err) {
            console.error('[TRANSPORT] Chyba pri ukladaní priradení:', err);
            window.showGlobalNotification('Nepodarilo sa uložiť priradenia.', 'error');
        } finally {
            setAssignSaving(false);
        }
    };

    // ============================================================
    // OTVORENIE MODÁLU PRE PRIRADENIE MIESTA K ZASTÁVKE
    // ============================================================
    const openAssignStopToPlaceModal = (place) => {
        const existing = transportAssignments[place.id];
        setPlaceForStopTarget(place);
        setPlaceForStopSelectedStopId(existing?.stopId || '');
        setIsPlaceForStopModalOpen(true);
    };

    const closeAssignStopToPlaceModal = () => {
        setIsPlaceForStopModalOpen(false);
        setPlaceForStopTarget(null);
        setPlaceForStopSelectedStopId('');
    };

    const saveStopForPlace = async () => {
        if (!window.db || !placeForStopTarget) return;
        setPlaceForStopSaving(true);
        try {
            const place = placeForStopTarget;
            const stopId = placeForStopSelectedStopId;
            const stop = stopsList.find((s) => s.id === stopId) || null;
            const docRef = doc(window.db, 'transport', place.id);

            if (!stop) {
                // Odstrániť priradenie
                await deleteDoc(docRef);
                window.showGlobalNotification(
                    `Priradenie miesta "${place.name}" bolo odstránené.`,
                    'info'
                );
            } else {
                await setDoc(docRef, {
                    placeId: place.id,
                    placeName: place.name,
                    placeType: place.type || null,
                    stopId: stop.id,
                    stopName: stop.name,
                    updatedAt: Timestamp.fromDate(new Date()),
                    updatedBy: userProfileData?.email || null,
                }, { merge: true });
                window.showGlobalNotification(
                    `Miesto "${place.name}" priradené k zastávke "${stop.name}".`,
                    'success'
                );
            }
            closeAssignStopToPlaceModal();
        } catch (err) {
            console.error('[TRANSPORT] Chyba pri ukladaní priradenia miesta k zastávke:', err);
            window.showGlobalNotification('Nepodarilo sa uložiť priradenie.', 'error');
        } finally {
            setPlaceForStopSaving(false);
        }
    };

    // ============================================================
    // ULOŽENIE TRVANIA JÁZDY MEDZI DVOMA ZASTÁVKAMI
    // ============================================================
    const saveTravelTime = async (fromStop, toStop, rawValue) => {
        if (!window.db || !fromStop || !toStop) return;

        const key = `${fromStop.id}|${toStop.id}`;
        const minutes = rawValue === '' ? null : parseInt(rawValue, 10);

        if (minutes != null && (isNaN(minutes) || minutes < 0)) {
            window.showGlobalNotification('Trvanie musí byť nezáporné číslo (minúty).', 'error');
            return;
        }

        setTravelTimesSaving(true);
        try {
            const docRef = doc(window.db, 'settings', 'transportTravelTimes');
            // Načítame aktuálne dáta (aby sme neprepísali ostatné dvojice)
            const snap = await getDoc(docRef);
            const data = snap.exists() ? (snap.data() || {}) : {};
            const times = { ...(data.times || {}) };

            if (minutes == null) {
                delete times[key];
            } else {
                times[key] = {
                    fromId: fromStop.id,
                    fromName: fromStop.name,
                    toId: toStop.id,
                    toName: toStop.name,
                    minutes,
                };
            }

            await setDoc(docRef, {
                times,
                updatedAt: Timestamp.fromDate(new Date()),
                updatedBy: userProfileData?.email || null,
            }, { merge: true });

            window.showGlobalNotification(
                minutes == null
                    ? `Trvanie "${fromStop.name} → ${toStop.name}" bolo odstránené.`
                    : `Trvanie "${fromStop.name} → ${toStop.name}" = ${minutes} min.`,
                'success'
            );
        } catch (err) {
            console.error('[TRANSPORT] Chyba pri ukladaní trvania jazdy:', err);
            window.showGlobalNotification('Nepodarilo sa uložiť trvanie.', 'error');
        } finally {
            setTravelTimesSaving(false);
        }
    };

    // ============================================================
    // ZOZNAM ZASTÁVOK S ODSAdeným ZOZNAMOM PRIRADENÝCH MIEST
    // ============================================================
    const renderStopsWithAssignments = () => {
        if (stopsList.length === 0) {
            return React.createElement(
                'div',
                { className: 'text-gray-400 italic text-sm px-1' },
                'Žiadne zastávky.'
            );
        }

        // Zoskupenie priradení podľa stopId
        const byStop = {};
        Object.entries(transportAssignments).forEach(([placeId, a]) => {
            if (!a || !a.stopId) return;
            if (!byStop[a.stopId]) byStop[a.stopId] = [];
            const place = allPlaces.find((p) => p.id === placeId);
            if (place) byStop[a.stopId].push(place);
        });

        const getPlaceIcon = (type) => {
            const config = placeTypeIcons[type] || { icon: 'fa-location-dot', color: '#6b7280' };
            return React.createElement('i', {
                className: `fa-solid ${config.icon} mr-2`,
                style: { color: config.color },
            });
        };

        return React.createElement(
            'ul',
            { className: 'space-y-3' },
            stopsList.map((stop) => {
                const assigned = (byStop[stop.id] || []).sort((a, b) =>
                    a.name.localeCompare(b.name, 'sk', { sensitivity: 'base' })
                );
                return React.createElement(
                    'li',
                    { key: stop.id, className: 'bg-white rounded-lg border border-gray-200 shadow-sm' },
                    // Hlavička zastávky – klikateľná
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: () => openAssignModalForStop(stop),
                            className: 'w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-blue-50 transition-colors rounded-t-lg'
                        },
                        React.createElement('i', { className: 'fa-solid fa-bus text-blue-600' }),
                        React.createElement(
                            'span',
                            { className: 'text-gray-800 font-medium flex-1' },
                            stop.name
                        ),
                        React.createElement(
                            'span',
                            { className: 'text-xs text-gray-500' },
                            `${assigned.length} miest`
                        ),
                        React.createElement('i', { className: 'fa-solid fa-pen-to-square text-gray-400 ml-2' })
                    ),
                    // Odsadený zoznam priradených miest
                    assigned.length > 0 &&
                        React.createElement(
                            'ul',
                            { className: 'pl-10 pr-4 pb-3 pt-1 space-y-1 border-t border-gray-100' },
                            assigned.map((place) =>
                                React.createElement(
                                    'li',
                                    { key: place.id, className: 'text-sm text-gray-700 flex items-center' },
                                    getPlaceIcon(place.type),
                                    place.name
                                )
                            )
                        )
                );
            })
        );
    };

    // ============================================================
    // ZOZNAM OSTATNÝCH MIEST (bez zastávok)
    // ============================================================
    const renderOtherPlaces = () => {
        const others = allPlaces
            .filter((p) => p.type !== 'zastavka')
            .sort((a, b) => a.name.localeCompare(b.name, 'sk', { sensitivity: 'base' }));

        if (others.length === 0) {
            return React.createElement(
                'div',
                { className: 'text-gray-400 italic text-sm px-1' },
                'Žiadne ďalšie miesta.'
            );
        }

        const getPlaceIcon = (type) => {
            const config = placeTypeIcons[type] || { icon: 'fa-location-dot', color: '#6b7280' };
            return React.createElement('i', {
                className: `fa-solid ${config.icon} mr-2`,
                style: { color: config.color },
            });
        };

        return React.createElement(
            'ul',
            { className: 'space-y-2' },
            others.map((place) => {
                const a = transportAssignments[place.id];
                const stopName = a?.stopName || null;
                return React.createElement(
                    'li',
                    {
                        key: place.id,
                        onClick: () => openAssignStopToPlaceModal(place),
                        className: 'bg-white rounded-lg border border-gray-200 shadow-sm px-4 py-2.5 flex items-center gap-3 cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-colors',
                        title: 'Kliknutím priradíte zastávku tomuto miestu'
                    },
                    getPlaceIcon(place.type),
                    React.createElement(
                        'span',
                        { className: 'text-gray-800 font-medium truncate flex-1' },
                        place.name
                    ),
                    stopName &&
                        React.createElement(
                            'span',
                            { className: 'text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5 whitespace-nowrap' },
                            React.createElement('i', { className: 'fa-solid fa-bus mr-1' }),
                            stopName
                        ),
                    React.createElement('i', { className: 'fa-solid fa-pen-to-square text-gray-400 ml-1' })
                );
            })
        );
    };

    // ============================================================
    // RENDER – TRVANIA JÁZDY MEDZI ZASTÁVKAMI (matica NxN)
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

            // Ak sa hodnota nezmenila, nič neukladáme
            if (raw === existingMinutes) return;

            saveTravelTime(fromStop, toStop, raw);
        };

        return React.createElement(
            'div',
            { className: 'w-full overflow-x-auto' },
            React.createElement(
                'p',
                { className: 'text-xs text-gray-500 mb-3 italic' },
                'Hodnota predstavuje počet minút jazdy z riadkovej zastávky (z) do stĺpcovej zastávky (do). Prázdne pole = nezadané.'
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
                                    className: 'border border-gray-300 bg-gray-100 px-3 py-2 text-center font-bold text-gray-700 whitespace-nowrap min-w-[110px]'
                                },
                                React.createElement('i', { className: 'fa-solid fa-bus text-blue-600 mr-1' }),
                                toStop.name
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
                                    className: 'border border-gray-300 bg-gray-100 px-3 py-2 text-left font-bold text-gray-700 whitespace-nowrap sticky left-0 z-10'
                                },
                                React.createElement('i', { className: 'fa-solid fa-bus text-blue-600 mr-1' }),
                                fromStop.name
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
    // RENDER – PLÁNOVANIE (autobusy + dni turnaja)
    // ============================================================
    const renderPlanning = () => {
        return React.createElement(
            'div',
            { className: 'w-full flex flex-col items-center justify-start py-6 relative min-h-[400px]' },

            // Ak ešte nie je pridaný žiadny autobus
            buses.length === 0
                ? React.createElement(
                    'div',
                    { className: 'flex flex-col items-center justify-center py-16 text-gray-500' },
                    React.createElement('i', { className: 'fa-solid fa-bus text-6xl mb-4 opacity-30' }),
                    React.createElement('p', { className: 'text-lg font-medium' }, 'Plánovanie'),
                    React.createElement(
                        'p',
                        { className: 'text-sm mt-1' },
                        'Kliknutím na zelené tlačidlo "+" v pravom dolnom rohu pridáte autobus.'
                    )
                )
                : React.createElement(
                    'div',
                    { className: 'w-full flex flex-col gap-8 pb-24' },
                    buses.map((bus) =>
                        React.createElement(
                            'div',
                            {
                                key: bus.id,
                                className: 'w-full bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden'
                            },
                            // Hlavička autobusu
                            React.createElement(
                                'div',
                                { className: 'bg-green-600 text-white px-5 py-3 flex items-center gap-3' },
                                React.createElement('i', { className: 'fa-solid fa-bus' }),
                                React.createElement('h3', { className: 'text-lg font-bold flex-1' }, bus.name),
                                React.createElement(
                                    'button',
                                    {
                                        type: 'button',
                                        onClick: () => removeBus(bus),
                                        className: 'text-white/80 hover:text-white hover:bg-white/10 rounded-full w-8 h-8 flex items-center justify-center transition-colors',
                                        title: 'Odstrániť autobus'
                                    },
                                    React.createElement('i', { className: 'fa-solid fa-trash' })
                                )
                            ),
                            // Tabuľka dní
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
                                        'thead',
                                        null,
                                        React.createElement(
                                            'tr',
                                            { className: 'bg-gray-100 text-gray-700' },
                                            React.createElement(
                                                'th',
                                                { className: 'border border-gray-200 px-4 py-2 text-left font-semibold' },
                                                'Dátum'
                                            ),
                                            React.createElement(
                                                'th',
                                                { className: 'border border-gray-200 px-4 py-2 text-left font-semibold' },
                                                'Deň'
                                            )
                                        )
                                    ),
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
                                                    { className: 'border border-gray-200 px-4 py-2 text-gray-800' },
                                                    day.dateLabel
                                                ),
                                                React.createElement(
                                                    'td',
                                                    { className: 'border border-gray-200 px-4 py-2 text-gray-800 capitalize' },
                                                    day.dayName
                                                )
                                            )
                                        )
                                    )
                                )
                        )
                    )
                ),

            // Zelené okrúhle tlačidlo „+“ v pravom dolnom rohu
            React.createElement(
                'button',
                {
                    onClick: addNewBus,
                    disabled: busSaving,
                    className: `fixed bottom-8 right-8 w-14 h-14 rounded-full bg-green-600 text-white shadow-xl hover:bg-green-700 active:scale-95 transition-all duration-200 flex items-center justify-center text-2xl font-bold z-[2000] ${busSaving ? 'opacity-60 cursor-not-allowed' : ''}`,
                    title: 'Pridať autobus'
                },
                React.createElement('i', {
                    className: busSaving ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-plus'
                })
            )
        );
    };

    // ============================================================
    // MODÁLNE OKNO – priradenie miest k zastávke
    // ============================================================
    const renderAssignModal = () => {
        if (!isAssignModalOpen || !assignTargetStop) return null;

        const assignable = allPlaces
            .filter((p) => p.type !== 'zastavka')
            .filter((p) => {
                const a = transportAssignments[p.id];
                if (a && a.stopId && a.stopId !== assignTargetStop.id) return false;
                return true;
            })
            .filter((p) => {
                if (!assignSearch.trim()) return true;
                return p.name.toLowerCase().includes(assignSearch.trim().toLowerCase());
            })
            .sort((a, b) => {
                const aAssign = transportAssignments[a.id];
                const bAssign = transportAssignments[b.id];
                const aIsAssigned = !!(aAssign && aAssign.stopId === assignTargetStop.id);
                const bIsAssigned = !!(bAssign && bAssign.stopId === assignTargetStop.id);
                if (aIsAssigned !== bIsAssigned) return aIsAssigned ? -1 : 1;
                return a.name.localeCompare(b.name, 'sk', { sensitivity: 'base' });
            });

        const selectedCount = Object.keys(assignSelectedIds).filter((id) => assignSelectedIds[id]).length;

        const getPlaceIcon = (type) => {
            const config = placeTypeIcons[type] || { icon: 'fa-location-dot', color: '#6b7280' };
            return React.createElement('i', {
                className: `fa-solid ${config.icon} mr-2`,
                style: { color: config.color },
            });
        };

        return React.createElement(
            'div',
            {
                className: 'fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm',
                onClick: (e) => { if (e.target === e.currentTarget) closeAssignModal(); }
            },
            React.createElement(
                'div',
                {
                    className: 'bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[85vh] flex flex-col',
                    onClick: (e) => e.stopPropagation()
                },
                React.createElement(
                    'div',
                    { className: 'mb-4' },
                    React.createElement('h3', { className: 'text-xl font-bold text-gray-800' },
                        'Priradiť miesta k zastávke'
                    ),
                    React.createElement(
                        'p',
                        { className: 'text-sm text-gray-600 mt-1 flex items-center gap-2' },
                        React.createElement('i', { className: 'fa-solid fa-bus text-blue-600' }),
                        React.createElement('span', { className: 'font-medium' }, assignTargetStop.name)
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'mb-3' },
                    React.createElement('input', {
                        type: 'text',
                        value: assignSearch,
                        onChange: (e) => setAssignSearch(e.target.value),
                        placeholder: 'Hľadať miesto...',
                        className: 'w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-black'
                    })
                ),
                React.createElement(
                    'div',
                    { className: 'flex-1 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100 mb-4' },
                    assignable.length === 0
                        ? React.createElement(
                            'p',
                            { className: 'text-center text-gray-500 py-6 text-sm italic' },
                            'Žiadne miesta na priradenie.'
                        )
                        : assignable.map((place) => {
                            const checked = !!assignSelectedIds[place.id];
                            const typeConfig = placeTypeIcons[place.type] || { label: place.type || '—' };
                            return React.createElement(
                                'label',
                                {
                                    key: place.id,
                                    className: `flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-blue-50 transition-colors ${checked ? 'bg-blue-100' : ''}`
                                },
                                React.createElement('input', {
                                    type: 'checkbox',
                                    checked: checked,
                                    onChange: () => toggleAssignSelection(place.id),
                                    className: 'w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500'
                                }),
                                getPlaceIcon(place.type),
                                React.createElement(
                                    'span',
                                    { className: 'text-sm text-gray-800 flex-1 truncate' },
                                    place.name
                                ),
                                React.createElement(
                                    'span',
                                    { className: 'text-xs text-gray-500 whitespace-nowrap' },
                                    typeConfig.label
                                )
                            );
                        })
                ),
                React.createElement(
                    'div',
                    { className: 'flex items-center justify-between gap-3' },
                    React.createElement(
                        'span',
                        { className: 'text-sm text-gray-600' },
                        `Vybraných: ${selectedCount}`
                    ),
                    React.createElement(
                        'div',
                        { className: 'flex gap-3' },
                        React.createElement(
                            'button',
                            {
                                onClick: closeAssignModal,
                                disabled: assignSaving,
                                className: 'px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition disabled:opacity-50'
                            },
                            'Zrušiť'
                        ),
                        React.createElement(
                            'button',
                            {
                                onClick: saveAssignmentsForStop,
                                disabled: assignSaving,
                                className: 'px-6 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition font-medium disabled:opacity-50'
                            },
                            assignSaving ? 'Ukladám...' : 'Uložiť'
                        )
                    )
                )
            )
        );
    };

    // ============================================================
    // MODÁLNE OKNO – priradenie zastávky k miestu
    // ============================================================
    const renderAssignStopToPlaceModal = () => {
        if (!isPlaceForStopModalOpen || !placeForStopTarget) return null;

        const place = placeForStopTarget;
        const currentStopId = placeForStopSelectedStopId || '';

        return React.createElement(
            'div',
            {
                className: 'fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm',
                onClick: (e) => { if (e.target === e.currentTarget) closeAssignStopToPlaceModal(); }
            },
            React.createElement(
                'div',
                {
                    className: 'bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6',
                    onClick: (e) => e.stopPropagation()
                },
                React.createElement(
                    'div',
                    { className: 'mb-5' },
                    React.createElement('h3', { className: 'text-xl font-bold text-gray-800' },
                        'Priradiť zastávku k miestu'
                    ),
                    React.createElement(
                        'p',
                        { className: 'text-sm text-gray-600 mt-1 flex items-center gap-2' },
                        (() => {
                            const config = placeTypeIcons[place.type] || { icon: 'fa-location-dot', color: '#6b7280' };
                            return React.createElement('i', {
                                className: `fa-solid ${config.icon}`,
                                style: { color: config.color }
                            });
                        })(),
                        React.createElement('span', { className: 'font-medium' }, place.name)
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'mb-6' },
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-2' },
                        'Zastávka:'
                    ),
                    stopsList.length === 0
                        ? React.createElement(
                            'div',
                            { className: 'text-center py-4 text-amber-700 bg-amber-50 rounded-lg border border-amber-200 text-sm' },
                            'Žiadne zastávky. Najprv pridajte zastávku v sekcii Mapa.'
                        )
                        : React.createElement(
                            'select',
                            {
                                value: currentStopId,
                                onChange: (e) => setPlaceForStopSelectedStopId(e.target.value),
                                className: 'w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white'
                            },
                            React.createElement('option', { value: '' }, '— nepriradené —'),
                            stopsList.map((stop) =>
                                React.createElement('option', { key: stop.id, value: stop.id }, stop.name)
                            )
                        )
                ),
                React.createElement(
                    'div',
                    { className: 'flex justify-end gap-3' },
                    React.createElement(
                        'button',
                        {
                            onClick: closeAssignStopToPlaceModal,
                            disabled: placeForStopSaving,
                            className: 'px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition disabled:opacity-50'
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            onClick: saveStopForPlace,
                            disabled: placeForStopSaving || stopsList.length === 0,
                            className: 'px-6 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition font-medium disabled:opacity-50'
                        },
                        placeForStopSaving ? 'Ukladám...' : 'Uložiť'
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
        React.createElement(
            'div',
            { className: 'w-full flex-1 bg-white rounded-xl shadow-xl p-8 flex flex-col items-start justify-start transform transition-all duration-500' },
            // Nadpis
            React.createElement(
                'div',
                { className: 'w-full flex flex-col items-center mb-6' },
                React.createElement('h2', { className: 'text-3xl font-bold tracking-tight text-center mb-4' }, 'Doprava')
            ),
            // Dve tlačidlá
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
            // Obsah záložky
            React.createElement(
                'div',
                { className: 'w-full flex-1' },
                activeView === 'nastavenia'
                    ? React.createElement(
                        'div',
                        { className: 'w-full' },
                        // Pod-záložky
                        React.createElement(
                            'div',
                            { className: 'w-full flex flex-wrap items-center justify-center gap-3 mb-6' },
                            React.createElement(
                                'button',
                                {
                                    onClick: () => setNastaveniaTab('trvanie'),
                                    className: `px-4 py-2 rounded-lg font-medium border-2 transition-colors duration-200 flex items-center gap-2 ${
                                        nastaveniaTab === 'trvanie'
                                            ? 'bg-blue-600 text-white border-blue-600'
                                            : 'bg-white text-blue-600 border-blue-600 hover:bg-blue-50'
                                    }`
                                },
                                React.createElement('i', { className: 'fa-solid fa-clock' }),
                                'Trvania jazdy medzi zastávkami'
                            ),
                            React.createElement(
                                'button',
                                {
                                    onClick: () => setNastaveniaTab('priradenie'),
                                    className: `px-4 py-2 rounded-lg font-medium border-2 transition-colors duration-200 flex items-center gap-2 ${
                                        nastaveniaTab === 'priradenie'
                                            ? 'bg-blue-600 text-white border-blue-600'
                                            : 'bg-white text-blue-600 border-blue-600 hover:bg-blue-50'
                                    }`
                                },
                                React.createElement('i', { className: 'fa-solid fa-link' }),
                                'Priradenie miest k zastávkam'
                            )
                        ),
                        // Obsah pod-záložky
                        nastaveniaTab === 'priradenie'
                            ? React.createElement(
                                'div',
                                { className: 'w-full' },
                                React.createElement(
                                    'div',
                                    { className: 'flex items-center justify-between mb-4 pb-3 border-b border-gray-200' },
                                    React.createElement('h3', { className: 'text-xl font-semibold text-gray-700' }, 'Zoznam všetkých miest'),
                                    React.createElement('span', { className: 'text-sm text-gray-500' }, `Spolu: ${allPlaces.length}`)
                                ),
                                React.createElement(
                                    'div',
                                    { className: 'flex flex-col md:flex-row gap-6 w-full' },
                                    React.createElement(
                                        'div',
                                        { className: 'flex-1 min-w-0' },
                                        React.createElement(
                                            'h4',
                                            { className: 'text-sm font-bold uppercase tracking-wide mb-3 text-blue-700' },
                                            `Zastávky (${stopsList.length})`
                                        ),
                                        renderStopsWithAssignments()
                                    ),
                                    React.createElement(
                                        'div',
                                        { className: 'flex-1 min-w-0' },
                                        React.createElement(
                                            'h4',
                                            { className: 'text-sm font-bold uppercase tracking-wide mb-3 text-gray-700' },
                                            `Ostatné miesta (${allPlaces.filter((p) => p.type !== 'zastavka').length})`
                                        ),
                                        renderOtherPlaces()
                                    )
                                )
                            )
                            : React.createElement(
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
                    )
                    : renderPlanning()
            ),
            // Modálne okná
            renderAssignModal(),
            renderAssignStopToPlaceModal()
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
                        const userProfileRef = doc(window.db, 'users', user.uid);
                        const docSnap = await getDoc(userProfileRef);
                        if (docSnap.exists()) {
                            const firestoreEmail = docSnap.data().email;
                            if (user.email !== firestoreEmail) {
                                await updateDoc(userProfileRef, { email: user.email });
                                const notificationsCollectionRef = collection(window.db, 'notifications');
                                await addDoc(notificationsCollectionRef, {
                                    userEmail: user.email,
                                    changes: `Zmena e-mailovej adresy z '${firestoreEmail}' na '${user.email}'.`,
                                    timestamp: new Date(),
                                });
                                window.showGlobalNotification('E-mailová adresa bola automaticky aktualizovaná a synchronizovaná.', 'success');
                            }
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

window.listAccommodationsByCategoryAndGroup = async (categoryName, groupName) => {
    if (!window.db) {
        console.error('[TRANSPORT] Firebase nie je inicializovaný (window.db chýba).');
        return;
    }
    if (!categoryName || !groupName) {
        console.error('[TRANSPORT] Zadajte dva parametre: názov kategórie a názov skupiny.');
        console.error('  Príklad: listAccommodationsByCategoryAndGroup("U12 D", "skupina D")');
        return;
    }

    const targetCategory = cleanCategory(categoryName);
    const targetGroup = String(groupName).trim();

    try {
        const usersRef = collection(window.db, 'users');
        const usersSnap = await getDocs(usersRef);

        const uniqueAccommodations = new Set();

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

                    const accomName = team.accommodation?.name?.trim?.() || '';
                    if (accomName) uniqueAccommodations.add(accomName);
                });
            });
        });

        const sortedAccommodations = [...uniqueAccommodations].sort((a, b) =>
            a.localeCompare(b, 'sk', { sensitivity: 'base' })
        );

        console.log(`[TRANSPORT] ===== UBYTOVNE PRE KATEGÓRIU "${targetCategory}" A SKUPINU "${targetGroup}" =====`);
        if (sortedAccommodations.length === 0) {
            console.log('[TRANSPORT] Žiadne priradené ubytovne sa nenašli.');
        } else {
            sortedAccommodations.forEach((name) => {
                console.log(`   • ${name}`);
            });
        }
        console.log(`[TRANSPORT] Spolu: ${sortedAccommodations.length} jedinečných ubytovní.`);
        console.log('[TRANSPORT] =========================================================');

        return sortedAccommodations;
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
