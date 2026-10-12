// logged-in-transport.js
import { doc, getDoc, getDocs, onSnapshot, updateDoc, addDoc, collection, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
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
// Pomocná funkcia: prevedie identifikátor tímu na zobrazovaný názov
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
// Pomocná funkcia: naformátuje typ dopravy a čas príchodu
// ============================================================
const formatArrival = (arrival) => {
    if (!arrival || !arrival.type) return '---';
    const type = String(arrival.type).trim();
    const time = arrival.time ? String(arrival.time).trim() : '';
    if (!type) return '---';
    if (time) return `${type} (${time})`;
    return type;
};

const TransportApp = ({ userProfileData }) => {
    // Mapa placeId → placeName (aby sme pri zápasoch vedeli zobraziť názov haly)
    const placesMapRef = useRef({});

    // ============================================================
    // Mapa pre rýchle vyhľadanie názvu tímu:
    //   key = `${userId}|${category}|${teamIndex}` → { teamName, ... }
    // ============================================================
    const teamsLookupRef = useRef({});

    useEffect(() => {
        if (!window.db) return;

        let unsubscribeRegistration = null;
        let unsubscribeMatches = null;
        let unsubscribeCatering = null;
        let unsubscribePlaces = null;

        // ============================================================
        // 0a) MIESTO (places) – mapa placeId → názov
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
        // 1) DÁTUMY TURNAJA
        // ============================================================
        const loadTournamentDates = async () => {
            try {
                const regRef = doc(window.db, 'settings', 'registration');
                const snap = await getDoc(regRef);
                if (!snap.exists()) {
                    console.log('[TRANSPORT] settings/registration neexistuje.');
                    return;
                }
                const data = snap.data();
                console.log('[TRANSPORT] ===== DÁTUMY TURNAJA =====');
                console.log('[TRANSPORT] tournamentStart:', formatDateDDMMYYYY(data.tournamentStart));
                console.log('[TRANSPORT] tournamentEnd:  ', formatDateDDMMYYYY(data.tournamentEnd));
                console.log('[TRANSPORT] ============================');
            } catch (err) {
                console.error('[TRANSPORT] Chyba pri načítaní dátumov turnaja:', err);
            }
        };

        try {
            const regRef = doc(window.db, 'settings', 'registration');
            unsubscribeRegistration = onSnapshot(regRef, (snap) => {
                if (!snap.exists()) return;
                const data = snap.data();
                console.log('[TRANSPORT] (live) tournamentStart:', formatDateDDMMYYYY(data.tournamentStart));
                console.log('[TRANSPORT] (live) tournamentEnd:  ', formatDateDDMMYYYY(data.tournamentEnd));
            }, (err) => {
                console.error('[TRANSPORT] onSnapshot(settings/registration) error:', err);
            });
        } catch (e) {
            console.error('[TRANSPORT] Nepodarilo sa nastaviť listener na settings/registration:', e);
        }

        // ============================================================
        // 2) TÍMY – ubytovanie + typ dopravy + čas príchodu
        // ============================================================
        const loadTeamsWithAccommodation = async () => {
            try {
                const usersRef = collection(window.db, 'users');
                const usersSnap = await getDocs(usersRef);
                const grouped = {};

                usersSnap.forEach((userDoc) => {
                    const userData = userDoc.data() || {};
                    const teams = userData.teams;
                    if (!teams || typeof teams !== 'object') return;

                    Object.entries(teams).forEach(([category, teamArray]) => {
                        if (!Array.isArray(teamArray)) return;
                        teamArray.forEach((team) => {
                            if (!team || !team.teamName) return;
                            const accomType = team.accommodation?.type?.trim?.() || '';
                            const accomName = team.accommodation?.name?.trim?.() || '';
                            if (!accomName) return;

                            if (!grouped[category]) grouped[category] = [];
                            grouped[category].push({
                                teamName: team.teamName.trim(),
                                accommodationType: accomType || '(nešpecifikovaný)',
                                accommodationName: accomName,
                                arrivalDisplay: formatArrival(team.arrival),
                                userId: userDoc.id
                            });
                        });
                    });
                });

                console.log('[TRANSPORT] ===== TÍMY S PRIRADENOU UBYTOVŇOU PODĽA KATEGÓRIÍ =====');
                const categories = Object.keys(grouped).sort((a, b) =>
                    a.localeCompare(b, 'sk', { sensitivity: 'base' })
                );

                if (categories.length === 0) {
                    console.log('[TRANSPORT] Žiadne tímy s priradenou ubytovňou.');
                } else {
                    categories.forEach((category) => {
                        console.log(`\n[TRANSPORT] Kategória: ${category} (${grouped[category].length} tímov)`);
                        grouped[category]
                            .sort((a, b) => a.teamName.localeCompare(b.teamName, 'sk', { sensitivity: 'base' }))
                            .forEach((t) => {
                                console.log(`   • ${t.teamName}  →  ubytovňa: "${t.accommodationName}"  (typ: ${t.accommodationType})  |  doprava: ${t.arrivalDisplay}`);
                            });
                    });
                }
                console.log('[TRANSPORT] =====================================================');
            } catch (err) {
                console.error('[TRANSPORT] Chyba pri načítaní tímov s ubytovaním:', err);
            }
        };

        // ============================================================
        // 3) VŠETKY ZÁPASY PODĽA KATEGÓRIÍ
        // ============================================================
        const buildAndLogMatches = (snapshot) => {
            const grouped = {};

            snapshot.forEach((docSnap) => {
                const data = docSnap.data() || {};
                const category = cleanCategory(data.categoryName || data.categoryId || '(neznáma kategória)');
                const groupName = data.groupName || '(bez skupiny)';

                const homeDisplayName = resolveTeamName(data.homeTeamIdentifier);
                const awayDisplayName = resolveTeamName(data.awayTeamIdentifier);

                const hallId = data.hallId || null;
                const hallName = hallId
                    ? (placesMapRef.current[hallId] || `(neznáma hala: ${hallId})`)
                    : null;

                if (!grouped[category]) grouped[category] = {};
                if (!grouped[category][groupName]) grouped[category][groupName] = [];
                grouped[category][groupName].push({
                    id: docSnap.id,
                    home: homeDisplayName,
                    away: awayDisplayName,
                    homeRaw: data.homeTeamIdentifier || '---',
                    awayRaw: data.awayTeamIdentifier || '---',
                    hallId,
                    hallName,
                    scheduledTime: data.scheduledTime ? formatDateTime(data.scheduledTime) : null,
                    status: data.status || 'pending',
                    isPlacementMatch: data.isPlacementMatch === true,
                    placementRank: data.placementRank ?? null,
                    matchType: data.matchType || null,
                });
            });

            console.log('[TRANSPORT] ===== VŠETKY ZÁPASY PODĽA KATEGÓRIÍ =====');
            const categories = Object.keys(grouped).sort((a, b) =>
                a.localeCompare(b, 'sk', { sensitivity: 'base' })
            );

            if (categories.length === 0) {
                console.log('[TRANSPORT] Žiadne zápasy v databáze.');
            } else {
                categories.forEach((category) => {
                    const groups = Object.keys(grouped[category]).sort((a, b) =>
                        a.localeCompare(b, 'sk', { sensitivity: 'base' })
                    );
                    const totalMatches = groups.reduce((sum, g) => sum + grouped[category][g].length, 0);
                    console.log(`\n[TRANSPORT] Kategória: ${category} (${totalMatches} zápasov, ${groups.length} skupín)`);

                    groups.forEach((groupName) => {
                        console.log(`  [TRANSPORT] Skupina: ${groupName} (${grouped[category][groupName].length} zápasov)`);
                        grouped[category][groupName].forEach((m) => {
                            const special = m.isPlacementMatch
                                ? ` [o ${m.placementRank}. miesto]`
                                : m.matchType
                                    ? ` [${m.matchType}]`
                                    : '';
                            const when = m.scheduledTime ? m.scheduledTime : 'nenaplánované';
                            const hall = m.hallName ? `hala="${m.hallName}"` : 'hala=-';
                            console.log(`     • ${m.home} vs ${m.away}${special}  |  ${when}  |  ${hall}  |  status=${m.status}`);
                        });
                    });
                });
            }
            console.log('[TRANSPORT] ===========================================');
        };

        try {
            const matchesRef = collection(window.db, 'matches');
            unsubscribeMatches = onSnapshot(matchesRef, (snapshot) => {
                buildAndLogMatches(snapshot);
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

        const buildAndLogCatering = (snapshot) => {
            const items = [];
            snapshot.forEach((docSnap) => {
                const data = docSnap.data() || {};
                items.push({
                    id: docSnap.id,
                    ...data,
                });
            });

            const grouped = {};
            items.forEach((a) => {
                const dayKey = a.dayKey || '(bez dňa)';
                const mealType = a.mealType || '(bez typu)';
                const slotFrom = a.slotFrom || '--:--';
                const placeName = a.placeName || a.placeId || '(bez miesta)';
                const category = cleanCategory(
                    a.isSuperstructure === true
                        ? (a.clickedTeamCategory || a.category || a.categoryName || '(bez kategórie)')
                        : (a.category || a.categoryName || '(bez kategórie)')
                );

                const rowTeamName = getRowTeamName(a);

                if (!grouped[dayKey]) grouped[dayKey] = {};
                if (!grouped[dayKey][mealType]) grouped[dayKey][mealType] = {};
                if (!grouped[dayKey][mealType][slotFrom]) grouped[dayKey][mealType][slotFrom] = {};
                if (!grouped[dayKey][mealType][slotFrom][placeName]) {
                    grouped[dayKey][mealType][slotFrom][placeName] = [];
                }
                grouped[dayKey][mealType][slotFrom][placeName].push({
                    teamName: rowTeamName,
                    category,
                    isSuperstructure: a.isSuperstructure === true,
                    isPriority: a.isPriority === true,
                });
            });

            console.log('[TRANSPORT] ===== NAPLÁNOVANÉ STRAVOVANIA =====');
            const days = Object.keys(grouped).sort();
            if (days.length === 0) {
                console.log('[TRANSPORT] Žiadne naplánované stravovania.');
            } else {
                days.forEach((dayKey) => {
                    console.log(`\n[TRANSPORT] Deň: ${dayKey}`);
                    const mealTypes = Object.keys(grouped[dayKey]).sort();
                    mealTypes.forEach((mealType) => {
                        const mealLabel = mealType === 'lunch' ? 'Obed' : mealType === 'dinner' ? 'Večera' : mealType;
                        console.log(`  [TRANSPORT] ${mealLabel}:`);
                        const slots = Object.keys(grouped[dayKey][mealType]).sort();
                        slots.forEach((slotFrom) => {
                            const places = Object.keys(grouped[dayKey][mealType][slotFrom]).sort();
                            places.forEach((placeName) => {
                                const list = grouped[dayKey][mealType][slotFrom][placeName];
                                console.log(`     • ${slotFrom}  →  ${placeName} (${list.length} položiek)`);
                                list.forEach((item) => {
                                    const flags = [];
                                    if (item.isSuperstructure) flags.push('superstructure');
                                    if (item.isPriority) flags.push('PRIORITA');
                                    const flagStr = flags.length ? ` [${flags.join(', ')}]` : '';
                                    console.log(`         - ${item.category}: ${item.teamName}${flagStr}`);
                                });
                            });
                        });
                    });
                });
            }
            console.log('[TRANSPORT] ====================================');
        };

        try {
            const cateringRef = collection(window.db, 'catering');
            unsubscribeCatering = onSnapshot(cateringRef, (snapshot) => {
                buildAndLogCatering(snapshot);
            }, (err) => {
                console.error('[TRANSPORT] onSnapshot(catering) error:', err);
            });
        } catch (e) {
            console.error('[TRANSPORT] Nepodarilo sa nastaviť listener na catering:', e);
        }

        loadTournamentDates();
        loadTeamsWithAccommodation();

        return () => {
            if (unsubscribeRegistration) unsubscribeRegistration();
            if (unsubscribeMatches) unsubscribeMatches();
            if (unsubscribeCatering) unsubscribeCatering();
            if (unsubscribePlaces) unsubscribePlaces();
        };
    }, []);

    return React.createElement(
        'div',
        { className: 'w-full flex-1 flex flex-col' },
        React.createElement(
            'div',
            { className: 'w-full flex-1 bg-white rounded-xl shadow-xl p-8 flex flex-col items-center justify-start transform transition-all duration-500' },
            React.createElement(
                'div',
                { className: 'flex flex-col items-center mb-6' },
                React.createElement('h2', { className: 'text-3xl font-bold tracking-tight text-center' }, 'Doprava')
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
