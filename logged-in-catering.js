// logged-in-catering.js
// Importy pre Firebase funkcie
import { doc, getDoc, onSnapshot, updateDoc, addDoc, collection, Timestamp, query, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
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
        case 'success':
            typeClasses = 'bg-green-500 text-white';
            break;
        case 'error':
            typeClasses = 'bg-red-500 text-white';
            break;
        case 'info':
            typeClasses = 'bg-blue-500 text-white';
            break;
        default:
            typeClasses = 'bg-gray-700 text-white';
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

/**
 * Pomocná funkcia: vráti zoznam všetkých dní medzi arrivalDate a tournamentEnd.
 */
const buildTournamentDays = (arrivalDate, tournamentEnd) => {
    if (!arrivalDate || !tournamentEnd) return [];

    const start = new Date(arrivalDate);
    const end = new Date(tournamentEnd);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];

    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    if (start > end) return [];

    const days = [];
    const current = new Date(start);

    while (current <= end) {
        const y = current.getFullYear();
        const m = String(current.getMonth() + 1).padStart(2, '0');
        const d = String(current.getDate()).padStart(2, '0');
        const key = `${y}-${m}-${d}`;

        days.push({
            date: new Date(current),
            key,
            label: current.toLocaleDateString('sk-SK', {
                weekday: 'short',
                day: 'numeric',
                month: 'numeric',
            }),
            fullLabel: current.toLocaleDateString('sk-SK', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
            }),
            fullLabelNumeric: `${d}. ${m}. ${y}`,
        });
        current.setDate(current.getDate() + 1);
    }

    return days;
};

const cleanCategory = (cat) => String(cat || '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const loadUserTeams = async (db) => {
    if (!db) return [];

    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);

    const teams = [];

    snapshot.forEach((userDoc) => {
        const userData = userDoc.data() || {};
        const userTeams = userData.teams;

        if (!userTeams || typeof userTeams !== 'object') return;

        Object.entries(userTeams).forEach(([categoryName, teamArray]) => {
            if (!Array.isArray(teamArray)) return;

            teamArray.forEach((team, teamIndex) => {
                if (!team?.teamName) return;

                const playersCount = Array.isArray(team.playerDetails) ? team.playerDetails.length : 0;
                const menTeamMembersCount = Array.isArray(team.menTeamMemberDetails) ? team.menTeamMemberDetails.length : 0;
                const womenTeamMembersCount = Array.isArray(team.womenTeamMemberDetails) ? team.womenTeamMemberDetails.length : 0;
                const menDriversCount = Array.isArray(team.driverDetailsMale) ? team.driverDetailsMale.length : 0;
                const womenDriversCount = Array.isArray(team.driverDetailsFemale) ? team.driverDetailsFemale.length : 0;

                const cleanCat = cleanCategory(categoryName);

                teams.push({
                    uid: userDoc.id,
                    teamIndex: teamIndex,
                    id: team.id || `${userDoc.id}-${cleanCat}-${teamIndex}`,
                    teamName: team.teamName,
                    category: cleanCat,
                    playersCount,
                    othersCount: menTeamMembersCount + womenTeamMembersCount + menDriversCount + womenDriversCount,
                    accommodationName: team.accommodation?.name || null,
                    packageName: team.packageDetails?.name || null,
                });
            });
        });
    });

    teams.sort((a, b) => {
        const catCompare = (a.category || '').localeCompare(b.category || '', 'sk', { sensitivity: 'base' });
        if (catCompare !== 0) return catCompare;
        return (a.teamName || '').localeCompare(b.teamName || '', 'sk', { sensitivity: 'base' });
    });

    return teams;
};

// ============================================================
// Pomocné funkcie pre delenie stravovacích slotov
// ============================================================

const timeToMinutes = (t) => {
    if (!t || typeof t !== 'string') return null;
    const parts = t.split(':');
    if (parts.length < 2) return null;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
};

const minutesToTime = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const hasValidMealRange = (mealTimes, unitMinutes) => {
    if (!mealTimes) return false;
    const fromMin = timeToMinutes(mealTimes.from);
    const toMin = timeToMinutes(mealTimes.to);
    const unit = parseInt(unitMinutes, 10);

    if (fromMin == null || toMin == null) return false;
    if (isNaN(unit) || unit <= 0) return false;
    if (toMin - fromMin < unit) return false;

    return true;
};

const buildMealSlots = (from, to, unitMinutes) => {
    const fromMin = timeToMinutes(from);
    const toMin = timeToMinutes(to);
    const unit = parseInt(unitMinutes, 10);

    if (fromMin == null || toMin == null) return [];
    if (isNaN(unit) || unit <= 0) return [];

    const total = toMin - fromMin;
    if (total <= 0) return [];

    const count = Math.floor(total / unit);
    if (count <= 0) return [];

    const slots = [];
    for (let i = 0; i < count; i++) {
        const slotFrom = fromMin + i * unit;
        const slotTo = slotFrom + unit;
        slots.push({
            from: minutesToTime(slotFrom),
            to: minutesToTime(slotTo),
            label: minutesToTime(slotFrom),
        });
    }
    return slots;
};

const cateringApp = ({ userProfileData }) => {
    const [tournamentDays, setTournamentDays] = useState([]);
    const [userTeams, setUserTeams] = useState([]);
    const [cateringTimes, setCateringTimes] = useState({});
    const [unitMinutes, setUnitMinutes] = useState('');
    const [loading, setLoading] = useState(true);
    const [accommodations, setAccommodations] = useState([]);
    const [cateringPlaces, setCateringPlaces] = useState([]);
    const [cateringAssignments, setCateringAssignments] = useState([]);

    const [showCateringModal, setShowCateringModal] = useState(false);
    const [selectedCateringCell, setSelectedCateringCell] = useState(null);
    const [selectedCateringPlaceId, setSelectedCateringPlaceId] = useState('');
    const [savingCatering, setSavingCatering] = useState(false);

    const [showChangeConfirm, setShowChangeConfirm] = useState(false);
    const [pendingChange, setPendingChange] = useState(null);
    const [packagesList, setPackagesList] = useState([]);
    const [filterCategory, setFilterCategory] = useState('');
    const [filterDayKey, setFilterDayKey] = useState('');
    const [filterMealType, setFilterMealType] = useState('');
    const [showAssignmentTypeModal, setShowAssignmentTypeModal] = useState(false);
    const [pendingAssignmentCell, setPendingAssignmentCell] = useState(null);
    const [showPlaceAssignmentModal, setShowPlaceAssignmentModal] = useState(false);
    const [showSuperstructureDecisionModal, setShowSuperstructureDecisionModal] = useState(false);
    const [pendingSuperstructureDecision, setPendingSuperstructureDecision] = useState(null);
    const [superstructureTeams, setSuperstructureTeams] = useState([]);
    const [matchTeams, setMatchTeams] = useState([]);    
    const [selectedPlaceTeamId, setSelectedPlaceTeamId] = useState('');
    const [savingPlaceAssignment, setSavingPlaceAssignment] = useState(false);
    const [placeAssignmentSearch, setPlaceAssignmentSearch] = useState('');    
    const [showSuperstructureReplanPickerModal, setShowSuperstructureReplanPickerModal] = useState(false);
    const [superstructureReplanPickerItems, setSuperstructureReplanPickerItems] = useState([]);
    const [cateringModalIsPriority, setCateringModalIsPriority] = useState(false);

    // Načítanie nastavení turnaja z Firestore
    useEffect(() => {
        if (!window.db) {
            setLoading(false);
            return;
        }

        const settingsDocRef = doc(window.db, 'settings', 'registration');

        const unsubscribe = onSnapshot(
            settingsDocRef,
            (docSnapshot) => {
                if (docSnapshot.exists()) {
                    const data = docSnapshot.data();

                    const arrivalDate = data.arrivalDate ? data.arrivalDate.toDate() : null;
                    const tournamentEnd = data.tournamentEnd ? data.tournamentEnd.toDate() : null;

                    const days = buildTournamentDays(arrivalDate, tournamentEnd);
                    setTournamentDays(days);
                } else {
                    setTournamentDays([]);
                }
                setLoading(false);
            },
            (error) => {
                window.showGlobalNotification('Nepodarilo sa načítať nastavenia turnaja.', 'error');
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    // Načítanie nastavení stravovania (časy + jednotka)
    useEffect(() => {
        if (!window.db) return;

        const cateringDocRef = doc(window.db, 'settings', 'catering');

        const unsubscribe = onSnapshot(
            cateringDocRef,
            (snap) => {
                if (snap.exists()) {
                    const data = snap.data() || {};
                    setCateringTimes(data.times || {});
                    setUnitMinutes(data.unitMinutes != null ? String(data.unitMinutes) : '');
                } else {
                    setCateringTimes({});
                    setUnitMinutes('');
                }
            },
            (error) => {
                window.showGlobalNotification('Nepodarilo sa načítať nastavenia stravovania.', 'error');
            }
        );

        return () => unsubscribe();
    }, []);

    // Načítanie používateľských tímov
    useEffect(() => {
        if (!window.db) return;

        const usersRef = collection(window.db, 'users');

        const unsubscribe = onSnapshot(
            usersRef,
            async () => {
                try {
                    const teams = await loadUserTeams(window.db);
                    setUserTeams(teams);
                } catch (err) {
                    window.showGlobalNotification('Nepodarilo sa načítať tímy.', 'error');
                }
            },
            (error) => { }
        );

        return () => unsubscribe();
    }, []);

    // Načítanie ubytovní (places) s farbami
    useEffect(() => {
        if (!window.db) return;

        const unsubscribe = onSnapshot(
            collection(window.db, 'places'),
            (snapshot) => {
                const places = [];
                snapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    if (data.type !== "ubytovanie") return;
                    places.push({
                        id: docSnap.id,
                        name: data.name || '(bez názvu)',
                        headerColor: data.headerColor || '#1e40af',
                        headerTextColor: data.headerTextColor || '#000000',
                    });
                });
                setAccommodations(places);
            },
            (error) => { }
        );

        return () => unsubscribe();
    }, []);

    // Načítanie stravovacích miest
    useEffect(() => {
        if (!window.db) return;

        const unsubscribe = onSnapshot(
            collection(window.db, 'places'),
            (snapshot) => {
                const places = [];
                snapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    if (data.type !== 'stravovanie') return;
                    places.push({
                        id: docSnap.id,
                        name: data.name || '(bez názvu)',
                        headerColor: data.headerColor || '#1e40af',
                        headerTextColor: data.headerTextColor || '#000000',
                        capacity: data.capacity != null ? Number(data.capacity) : null,
                    });
                });
                places.sort((a, b) => a.name.localeCompare(b.name, 'sk', { sensitivity: 'base' }));
                setCateringPlaces(places);
            },
            (error) => { }
        );

        return () => unsubscribe();
    }, []);

    // Načítanie priradení stravovania
    useEffect(() => {
        if (!window.db) return;

        const unsubscribe = onSnapshot(
            collection(window.db, 'catering'),
            (snapshot) => {
                const items = [];
                snapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    items.push({
                        id: docSnap.id,
                        ...data,
                    });
                });
                setCateringAssignments(items);
            },
            (error) => { }
        );

        return () => unsubscribe();
    }, []);

    // 🔥 NOVÉ: Načítanie balíkov (settings/packages/list)
    useEffect(() => {
        if (!window.db) return;

        const packagesCollectionRef = collection(window.db, 'settings', 'packages', 'list');

        const unsubscribe = onSnapshot(
            packagesCollectionRef,
            (snapshot) => {
                const items = [];
                snapshot.forEach((docSnap) => {
                    const data = docSnap.data() || {};
                    items.push({
                        id: docSnap.id,
                        name: data.name || '',
                        meals: data.meals || {},
                        accommodationTypes: data.accommodationTypes || [],
                    });
                });
                setPackagesList(items);
            },
            (error) => { }
        );

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!window.db) return;

        const superstructureDocRef = doc(window.db, 'settings', 'superstructureGroups');

        const unsubscribe = onSnapshot(
            superstructureDocRef,
            (docSnap) => {
                const teams = [];
                if (docSnap.exists()) {
                    const data = docSnap.data() || {};
                    Object.entries(data).forEach(([categoryName, teamArray]) => {
                        if (!Array.isArray(teamArray)) return;
                        teamArray.forEach((team, idx) => {
                            if (!team?.teamName) return;
                            teams.push({
                                id: team.id || `${categoryName}-${idx}`,
                                teamName: team.teamName,
                                category: categoryName,
                                groupName: team.groupName || null,
                                order: team.order ?? null,
                            });
                        });
                    });
                }
                setSuperstructureTeams(teams);
            },
            (error) => {
                console.error('Chyba pri načítaní superstructure tímov:', error);
            }
        );

        return () => unsubscribe();
    }, []);

    // 🔥 ZMENA: Načítanie všetkých tímov z kolekcie 'matches'
    // (domáci aj hostia z každého zápasu), aby sa dali použiť
    // v modálnom okne "Priradiť stravovanie podľa umiestnenia".
    useEffect(() => {
        if (!window.db) return;
    
        const unsubscribe = onSnapshot(
            collection(window.db, 'matches'),
            (snapshot) => {
                const teamsMap = new Map(); // kľúč = `${category}||${teamIdentifier}`
    
                snapshot.forEach((docSnap) => {
                    const data = docSnap.data() || {};
                    const categoryName = data.categoryName || '';
                    const groupName = data.groupName || null;
    
                    const addTeam = (identifier) => {
                        if (!identifier) return;
                        const key = `${categoryName}||${identifier}`;
                        if (teamsMap.has(key)) return;
    
                        // Skúsime získať "pekný" názov tímu (rovnaká logika ako inde)
                        let teamName = identifier;
                        if (window.teamManager && typeof window.teamManager.getTeamNameByDisplayIdSync === 'function') {
                            try {
                                const resolved = window.teamManager.getTeamNameByDisplayIdSync(identifier);
                                if (resolved) teamName = resolved;
                            } catch (e) { /* ignore */ }
                        }
    
                        teamsMap.set(key, {
                            id: identifier,
                            teamName: teamName,
                            identifier: identifier,
                            category: categoryName,
                            groupName: groupName,
                        });
                    };
    
                    addTeam(data.homeTeamIdentifier);
                    addTeam(data.awayTeamIdentifier);
                });
    
                setMatchTeams(Array.from(teamsMap.values()));
            },
            (error) => {
                console.error('Chyba pri načítaní tímov z matches:', error);
            }
        );
    
        return () => unsubscribe();
    }, []);

    if (loading) {
        return React.createElement(
            'div',
            { className: 'flex justify-center items-center h-full pt-16' },
            React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
        );
    }

    if (tournamentDays.length === 0) {
        return React.createElement(
            'div',
            { className: 'flex-grow flex justify-center items-start p-6' },
            React.createElement(
                'div',
                { className: 'w-full max-w-7xl bg-white rounded-xl shadow-xl p-8' },
                React.createElement('h2', { className: 'text-3xl font-bold tracking-tight text-center mb-6' }, 'Stravovanie'),
                React.createElement(
                    'p',
                    { className: 'text-center text-gray-500' },
                    'Nie sú dostupné žiadne dátumy turnaja. Nastavte prosím dátum príchodu a koniec turnaja.'
                )
            )
        );
    }

    // Predpočítame sloty pre každý deň a každé jedlo.
    const daySlots = {};
    tournamentDays.forEach((day) => {
        const t = cateringTimes[day.key] || {};
        const lunchTimes = t.lunch || null;
        const dinnerTimes = t.dinner || null;

        daySlots[day.key] = {
            lunch: hasValidMealRange(lunchTimes, unitMinutes)
                ? buildMealSlots(lunchTimes.from, lunchTimes.to, unitMinutes)
                : [],
            dinner: hasValidMealRange(dinnerTimes, unitMinutes)
                ? buildMealSlots(dinnerTimes.from, dinnerTimes.to, unitMinutes)
                : [],
        };
    });

    const dayColumnCount = (dayKey) => {
        const slots = daySlots[dayKey] || { lunch: [], dinner: [] };
        return slots.lunch.length + slots.dinner.length;
    };

    const visibleDays = tournamentDays.filter((day) => dayColumnCount(day.key) > 0);

    if (visibleDays.length === 0) {
        return React.createElement(
            'div',
            { className: 'flex-grow flex justify-center items-start p-6' },
            React.createElement(
                'div',
                { className: 'w-full max-w-7xl bg-white rounded-xl shadow-xl p-8' },
                React.createElement('h2', { className: 'text-3xl font-bold tracking-tight text-center mb-6' }, 'Stravovanie'),
                React.createElement(
                    'p',
                    { className: 'text-center text-gray-500' },
                    'Nie sú nastavené žiadne platné časové rozptyly pre stravovanie. Nastavte prosím časy obeda/večere a jednotku delenia.'
                )
            )
        );
    }

    const slotCountFor = (dayKey, mealType) => {
        const slots = daySlots[dayKey]?.[mealType] || [];
        return slots.length;
    };

    // Pomocná funkcia: má sa daný typ jedla zobraziť?
    const shouldShowMealType = (mealType) => {
        if (!filterMealType) return true;
        return filterMealType === mealType;
    };

    // Počet zobrazených stĺpcov pre daný deň (rešpektuje filter typu jedla)
    const visibleColumnCountForDay = (dayKey) => {
        const slots = daySlots[dayKey] || { lunch: [], dinner: [] };
        let count = 0;
        if (shouldShowMealType('lunch')) count += slots.lunch.length;
        if (shouldShowMealType('dinner')) count += slots.dinner.length;
        return count;
    };

    // 🔥 NOVÉ: Počet denných summary stĺpcov pre daný deň (obed spolu, večera spolu)
    // Rešpektuje filter typu jedla.
    const dailySummaryColumnsForDay = (dayKey) => {
        const slots = daySlots[dayKey] || { lunch: [], dinner: [] };
        let count = 0;
        // Obed summary stĺpec len ak existujú obedové sloty a zobrazujeme obed
        if (shouldShowMealType('lunch') && slots.lunch.length > 0) count += 1;
        // Večera summary stĺpec len ak existujú večerové sloty a zobrazujeme večeru
        if (shouldShowMealType('dinner') && slots.dinner.length > 0) count += 1;
        return count;
    };

    const availableCategories = Array.from(
        new Set(
            userTeams
                .map((t) => t.category)
                .filter(Boolean)
        )
    ).sort((a, b) => a.localeCompare(b, 'sk', { sensitivity: 'base' }));

    // 🔥 NAJPRV vypočítame filteredDays (potrebné pre categoryHasVisibleColumns)
    const filteredDays = (filterDayKey
        ? visibleDays.filter((d) => d.key === filterDayKey)
        : visibleDays
    ).filter((d) => visibleColumnCountForDay(d.key) > 0);

    const categoryHasVisibleColumns = () => true;

    const filteredTeams = (filterCategory
        ? userTeams.filter((t) => t.category === filterCategory)
        : userTeams
    ).filter((t) => categoryHasVisibleColumns(t.category));

    // Farby ubytovne pre tím
    const getTeamAccommodationColor = (team) => {
        if (!team.accommodationName) return '#FFFF00';
        const accommodation = accommodations.find(place => place.name === team.accommodationName);
        if (!accommodation) return '#FFFF00';
        return accommodation.headerColor || '#FFFF00';
    };

    const getTeamAccommodationTextColor = (team) => {
        if (!team.accommodationName) return '#000000';
        const accommodation = accommodations.find(place => place.name === team.accommodationName);
        if (!accommodation) return '#000000';
        return accommodation.headerTextColor || '#000000';
    };

    const findCateringAssignment = (team, dayKey, mealType, slotFrom) => {
        return cateringAssignments.find(
            (a) =>
                a.teamUid === team.uid &&
                a.teamIndex === team.teamIndex &&
                (a.category === team.category || a.categoryName === team.category) &&
                a.dayKey === dayKey &&
                a.mealType === mealType &&
                a.slotFrom === slotFrom
        );
    };

    // 🔥 NOVÉ: Nájde superstructure priradenie pre konkrétnu bunku (kliknutý tím + deň + jedlo + slot)
    const findSuperstructureAssignmentForCell = (team, dayKey, mealType, slotFrom) => {
        return cateringAssignments.find(
            (a) =>
                a.isSuperstructure === true &&
                a.clickedTeamUid === team.uid &&
                a.clickedTeamIndex === team.teamIndex &&
                a.clickedTeamCategory === team.category &&
                a.dayKey === dayKey &&
                a.mealType === mealType &&
                a.slotFrom === slotFrom
        );
    };

    // 🔥 NOVÉ: Nájde superstructure priradenie pre CELÝ RIADOK (tím + deň + typ jedla),
    // bez ohľadu na slot. Použije sa, ak klikneme na inú bunku v tom istom riadku.
    const findSuperstructureAssignmentForRow = (team, dayKey, mealType) => {
        return cateringAssignments.find(
            (a) =>
                a.isSuperstructure === true &&
                a.clickedTeamUid === team.uid &&
                a.clickedTeamIndex === team.teamIndex &&
                a.clickedTeamCategory === team.category &&
                a.dayKey === dayKey &&
                a.mealType === mealType
        );
    };    

    // 🔥 NOVÉ: Nájde VŠETKY superstructure priradenia pre daný riadok
    // (kliknutý tím + deň + typ jedla), bez ohľadu na slot.
    const findAllSuperstructureAssignmentsForRow = (team, dayKey, mealType) => {
        return cateringAssignments.filter(
            (a) =>
                a.isSuperstructure === true &&
                a.clickedTeamUid === team.uid &&
                a.clickedTeamIndex === team.teamIndex &&
                a.clickedTeamCategory === team.category &&
                a.dayKey === dayKey &&
                a.mealType === mealType
        );
    };

    // 🔥 NOVÉ: Odstráni názov kategórie z názvu superstructure tímu
    // napr. "U12 CH Skupina A 1. 1A" → "Skupina A 1. 1A"
    const getPlaceTeamDisplayName = (teamName, category) => {
        if (!teamName) return '';
        if (category && teamName.startsWith(category + ' ')) {
            return teamName.substring(category.length + 1).trim();
        }
        return teamName;
    };

    // 🔥 NOVÉ: Zistí, či superstructure tím už má priradené stravovanie
    // pre daný deň + typ jedla (v hociktorom slote a hociktorou bunkou).
    const isSuperstructureTeamAlreadyAssigned = (placeTeamId, dayKey, mealType) => {
        return cateringAssignments.some(
            (a) =>
                a.isSuperstructure === true &&
                a.teamIndex === placeTeamId &&
                a.dayKey === dayKey &&
                a.mealType === mealType
        );
    };

    // Farby stravovacieho miesta
    const getCateringPlaceColors = (placeId) => {
        const place = cateringPlaces.find((p) => p.id === placeId);
        if (!place) return { bg: '#1e40af', text: '#000000' };
        return {
            bg: place.headerColor || '#1e40af',
            text: place.headerTextColor || '#000000',
        };
    };

    // Vráti kapacitu daného stravovacieho miesta (alebo null)
    const getCateringPlaceCapacity = (placeId) => {
        const place = cateringPlaces.find((p) => p.id === placeId);
        if (!place) return null;
        return place.capacity != null ? Number(place.capacity) : null;
    };

    // Zistí, či má tím v balíku povolený daný typ stravovania pre daný deň
    const teamHasMealInPackage = (team, dayKey, mealType) => {
        if (!team) return false;

        // 1) Ak tím nemá balík, povolíme klik (aby sa dalo priradiť ručne)
        if (!team.packageName) return true;

        // 2) Nájdeme balík v packagesList
        const pkg = packagesList.find(p => p.name === team.packageName);
        if (!pkg) return true;

        // 3) Štruktúra pkg.meals: { 'YYYY-MM-DD': { breakfast: 1|0, lunch: 1|0, dinner: 1|0, refreshment: 1|0 }, ... }
        const mealsForDay = pkg.meals?.[dayKey];
        if (!mealsForDay) return false;

        const val = mealsForDay[mealType];
        return val === 1 || val === true;
    };

    // 🔥 NOVÉ: Zistí, či tím má vôbec nejaký balík priradený
    const teamHasAnyPackage = (team) => {
        if (!team) return false;
        if (!team.packageName) return false;

        // Skontrolujeme, či balík existuje v packagesList
        const pkg = packagesList.find(p => p.name === team.packageName);
        return !!pkg;
    };

    // 🔥 UPRAVENÉ: Spočíta hodnotu pre dané miesto + deň + jedlo + slot.
    // - Pre klasické priradenia sa započíta počet členov (hráči + RT).
    // - Pre superstructure priradenia sa započíta PRIEMER členov na jeden tím
    //   v príslušnej kategórii (počet členov superstructure tímu / počet tímov v kategórii).
    const getAssignedCountForPlace = (placeId, dayKey, mealType, slotFrom) => {
        let total = 0;

        // 1) Klasické priradenia – započítame počet členov tímu
        userTeams.forEach((team) => {
            const assignment = findCateringAssignment(team, dayKey, mealType, slotFrom);
            if (assignment && assignment.placeId === placeId) {
                total += (team.playersCount || 0) + (team.othersCount || 0);
            }
        });

        // 2) Superstructure priradenia – započítame priemer členov na jeden tím v kategórii
        const superstructureOnPlace = cateringAssignments.filter(
            (a) =>
                a.isSuperstructure === true &&
                a.placeId === placeId &&
                a.dayKey === dayKey &&
                a.mealType === mealType &&
                a.slotFrom === slotFrom
        );

        superstructureOnPlace.forEach((assignment) => {
            // Nájdeme používateľský tím, ktorý klikol (clickedTeam*) a spočítame
            // jeho členov. Ak by existovalo viac superstructure priradení z tej istej
            // kategórie, priemer sa počíta z priemeru členov všetkých tímov v kategórii.
            const categoryName = assignment.categoryName || assignment.category;
            const teamsInCategory = userTeams.filter(
                (t) => t.category === categoryName
            );

            if (teamsInCategory.length === 0) {
                // fallback – započítame 0
                return;
            }

            // Spočítame počet členov VŠETKÝCH tímov v kategórii
            const totalMembersInCategory = teamsInCategory.reduce(
                (acc, t) => acc + (t.playersCount || 0) + (t.othersCount || 0),
                0
            );

            // Priemer na jeden tím v kategórii
            const averagePerTeam = Math.ceil(
                totalMembersInCategory / teamsInCategory.length
            );

            total += averagePerTeam;
        });

        return total;
    };

    // 🔥 NOVÉ: Denný súčet pre dané miesto + deň + typ jedla (spolu za všetky sloty).
    const getDailyAssignedCountForPlace = (placeId, dayKey, mealType) => {
        const slots = daySlots[dayKey]?.[mealType] || [];
        let total = 0;
        slots.forEach((slot) => {
            total += getAssignedCountForPlace(placeId, dayKey, mealType, slot.from);
        });
        return total;
    };

    // Otvorí modálne okno pre priradenie
    const openCateringModal = (team, day, mealType, slot) => {
        // 1) 🔥 Ak pre túto KONKRÉTNU BUNKU existuje SUPERSTRUCTURE priradenie →
        //    otvoríme ROVNO modálne okno "Priradiť stravovacie miesto"
        //    s príznakom isSuperstructure a existingId (pre možnosť odstránenia).
        const superstructureExisting = findSuperstructureAssignmentForCell(
            team, day.key, mealType, slot.from
        );
        if (superstructureExisting) {
            const placeTeam = superstructureTeams.find(
                (t) => t.id === superstructureExisting.teamIndex
            ) || {
                id: superstructureExisting.teamIndex,
                teamName: superstructureExisting.teamName,
                category: superstructureExisting.category,
                groupName: superstructureExisting.groupName || null,
            };
        
            setSelectedCateringCell({
                team,
                dayKey: day.key,
                dayLabel: day.fullLabelNumeric,
                mealType,
                slotFrom: superstructureExisting.slotFrom || slot.from,
                slotTo: superstructureExisting.slotTo || slot.to,
                existingId: superstructureExisting.id || null,
                isSuperstructure: true,
                placeTeam,
                isPriority: false, // bude sa brať z checkboxu
            });
            // 🔥 Predvyplníme checkbox podľa pôvodnej priority
            setCateringModalIsPriority(superstructureExisting.isPriority === true);
            setSelectedCateringPlaceId(superstructureExisting.placeId || '');
            setShowCateringModal(true);
            return;
        }
        
        // 2) 🔥 Ak v TOM ISTOM RIADKU (tím + deň + typ jedla) existuje
        //    SUPERSTRUCTURE priradenie v INOM SLOTE → tiež otvoríme
        //    ROZHODOVACIE modálne okno.
        const superstructureInRow = findSuperstructureAssignmentForRow(
            team, day.key, mealType
        );
        if (superstructureInRow) {
            const placeTeam = superstructureTeams.find(
                (t) => t.id === superstructureInRow.teamIndex
            ) || {
                id: superstructureInRow.teamIndex,
                teamName: superstructureInRow.teamName,
                category: superstructureInRow.category,
                groupName: superstructureInRow.groupName || null,
            };
        
            setPendingSuperstructureDecision({
                type: 'row',
                team,
                day,
                mealType,
                slot,
                existingId: superstructureInRow.id || null,
                placeTeam,
                existingAssignment: superstructureInRow,
            });
            setShowSuperstructureDecisionModal(true);
            return;
        }

        // 3) Ak pre túto bunku existuje KLASICKÉ priradenie →
        //    otvoríme ROVNO modálne okno "Priradiť stravovacie miesto".
        const existing = findCateringAssignment(team, day.key, mealType, slot.from);
        if (existing) {
            setSelectedCateringCell({
                team,
                dayKey: day.key,
                dayLabel: day.fullLabelNumeric,
                mealType,
                slotFrom: slot.from,
                slotTo: slot.to,
                existingId: existing.id || null,
            });
            setSelectedCateringPlaceId(existing.placeId || '');
            setShowCateringModal(true);
            return;
        }

        // 4) 🔥 Ak tím NEMÁ ŽIADNY balík → otvoríme ROVNO modálne okno
        //    "Priradiť podľa umiestnenia" (superstructure tím).
        if (!teamHasAnyPackage(team)) {
            setPendingAssignmentCell({ team, day, mealType, slot });

            const teamsInCategory = matchTeams.filter(
                (t) => t.category === team.category
            );
            setSelectedPlaceTeamId(teamsInCategory[0]?.id || '');
            setPlaceAssignmentSearch('');
            setShowAssignmentTypeModal(false);
            setShowPlaceAssignmentModal(true);
            return;
        }

        // 5) 🔥 Tím MÁ balík, ale NEMÁ daný typ stravovania v balíku →
        //    otvoríme ROVNO modálne okno "Priradiť podľa umiestnenia".
        if (!teamHasMealInPackage(team, day.key, mealType)) {
            setPendingAssignmentCell({ team, day, mealType, slot });

            const teamsInCategory = matchTeams.filter(
                (t) => t.category === team.category
            );
            setSelectedPlaceTeamId(teamsInCategory[0]?.id || '');
            setPlaceAssignmentSearch('');
            setShowAssignmentTypeModal(false);
            setShowPlaceAssignmentModal(true);
            return;
        }

        // 6) 🔥 Tím MÁ balík AJ daný typ stravovania →
        //    otvoríme modálne okno s výberom typu.
        setPendingAssignmentCell({ team, day, mealType, slot });
        setShowAssignmentTypeModal(true);
    };

    // Používateľ zvolil "Priradiť pre tím" → otvorí existujúce modálne okno
    const handleAssignForTeam = () => {
        if (!pendingAssignmentCell) return;
        const { team, day, mealType, slot } = pendingAssignmentCell;
        const existing = findCateringAssignment(team, day.key, mealType, slot.from);
        setSelectedCateringCell({
            team,
            dayKey: day.key,
            dayLabel: day.fullLabelNumeric,
            mealType,
            slotFrom: slot.from,
            slotTo: slot.to,
            existingId: existing?.id || null,
            showPriorityCheckbox: false,
        });
        setSelectedCateringPlaceId(existing?.placeId || '');
        setCateringModalIsPriority(false);
        setShowAssignmentTypeModal(false);
        setShowCateringModal(true);
    };

    const handleAssignByPlace = () => {
        if (!pendingAssignmentCell) return;

        const { team } = pendingAssignmentCell;

        // 🔥 ZMENA: použijeme matchTeams namiesto superstructureTeams
        const teamsInCategory = matchTeams.filter(
            (t) => t.category === team.category
        );
    
        setSelectedPlaceTeamId(teamsInCategory[0]?.id || '');
        setPlaceAssignmentSearch('');
        setCateringModalIsPriority(false);
        setShowAssignmentTypeModal(false);
        setShowPlaceAssignmentModal(true);
    };

    const cancelAssignmentType = () => {
        setShowAssignmentTypeModal(false);
        setPendingAssignmentCell(null);
    };

    const buildCateringPayload = (placeId) => {
        const place = cateringPlaces.find((p) => p.id === placeId);
        const cell = selectedCateringCell;
    
        // 🔥 Ak ide o superstructure priradenie (podľa umiestnenia)
        if (cell.isSuperstructure && cell.placeTeam) {
            return {
                // Kontext kliknutej bunky (používateľský tím)
                clickedTeamUid: cell.team.uid,
                clickedTeamIndex: cell.team.teamIndex,
                clickedTeamCategory: cell.team.category,
    
                // Priradený superstructure tím
                teamUid: 'global',
                teamIndex: cell.placeTeam.id,
                category: cell.placeTeam.category,
                categoryName: cell.placeTeam.category,
                teamName: cell.placeTeam.teamName,
                groupName: cell.placeTeam.groupName || null,
                isSuperstructure: true,
                // 🔥 NOVÉ: príznak prioritného priradenia
                isPriority: !!cateringModalIsPriority,
    
                // Časové údaje
                dayKey: cell.dayKey,
                dayLabel: cell.dayLabel,
                mealType: cell.mealType,
                slotFrom: cell.slotFrom,
                slotTo: cell.slotTo,
    
                // Miesto
                placeId: placeId,
                placeName: place?.name || '',
            };
        }

        // Klasické priradenie pre tím (pôvodné správanie)
        return {
            teamUid: cell.team.uid,
            teamIndex: cell.team.teamIndex,
            category: cell.team.category,
            categoryName: cell.team.category,
            dayKey: cell.dayKey,
            dayLabel: cell.dayLabel,
            mealType: cell.mealType,
            slotFrom: cell.slotFrom,
            slotTo: cell.slotTo,
            placeId: placeId,
            placeName: place?.name || '',
        };
    };

    const performSaveCateringAssignment = async (payload, isChange, oldIds) => {
        try {
            if (isChange && Array.isArray(oldIds) && oldIds.length > 0) {
                for (const id of oldIds) {
                    await deleteDoc(doc(window.db, 'catering', id));
                }
                await addDoc(collection(window.db, 'catering'), payload);
                window.showGlobalNotification('Priradenie bolo zmenené.', 'success');
            } else {
                await addDoc(collection(window.db, 'catering'), payload);
                window.showGlobalNotification('Priradenie bolo uložené.', 'success');
            }

            setShowCateringModal(false);
            setSelectedCateringCell(null);
            setSelectedCateringPlaceId('');
            setCateringModalIsPriority(false);
        } catch (err) {
            window.showGlobalNotification('Nepodarilo sa uložiť priradenie.', 'error');
        } finally {
            setSavingCatering(false);
        }
    };

    // 🔥 UPRAVENÉ: Používateľ zvolil "Preplánovať existujúce miesto a čas"
    const handleSuperstructureReplan = () => {
        if (!pendingSuperstructureDecision) return;
    
        const { team, day, mealType, slot } = pendingSuperstructureDecision;
    
        // Nájdeme VŠETKY superstructure priradenia pre tento riadok
        const allInRow = findAllSuperstructureAssignmentsForRow(
            team, day.key, mealType
        );
    
        // Ak existuje len jedno (alebo žiadne) → rovno otvoríme showCateringModal
        if (allInRow.length <= 1) {
            const existingAssignment = allInRow[0] || null;
            const existingId = existingAssignment?.id || null;
            const teamIndex = existingAssignment?.teamIndex || null;
        
            const placeTeam = teamIndex
                ? (superstructureTeams.find((t) => t.id === teamIndex) || {
                      id: teamIndex,
                      teamName: existingAssignment.teamName,
                      category: existingAssignment.category,
                      groupName: existingAssignment.groupName || null,
                  })
                : null;
        
            setSelectedCateringCell({
                team,
                dayKey: day.key,
                dayLabel: day.fullLabelNumeric,
                mealType,
                // 🔥 OPRAVA: kliknutý slot, nie slot pôvodného priradenia
                slotFrom: slot.from,
                slotTo: slot.to,
                existingId: existingId,
                isSuperstructure: true,
                placeTeam,
                isPriority: false,
                // 🔥 OPRAVA: pri jedinom priradení checkbox nezobrazujeme
                showPriorityCheckbox: false,
            });
            setCateringModalIsPriority(existingAssignment?.isPriority === true);
            setSelectedCateringPlaceId(existingAssignment?.placeId || '');
            setShowSuperstructureDecisionModal(false);
            setPendingSuperstructureDecision(null);
            setShowCateringModal(true);
            return;
        }
    
        // 🔥 Ak existujú 2+ superstructure priradenia v tomto riadku →
        //    otvoríme nové modálne okno na výber konkrétneho superstructure tímu
        const items = allInRow.map((a) => {
            const placeTeam = superstructureTeams.find((t) => t.id === a.teamIndex) || {
                id: a.teamIndex,
                teamName: a.teamName,
                category: a.category,
                groupName: a.groupName || null,
            };
            return {
                assignment: a,
                placeTeam,
            };
        });
    
        setSuperstructureReplanPickerItems(items);
        setShowSuperstructureDecisionModal(false);
        setShowSuperstructureReplanPickerModal(true);
    };

    // 🔥 NOVÉ: Používateľ vybral konkrétne superstructure priradenie na preplánovanie
    const handlePickSuperstructureReplan = (item) => {
        if (!pendingSuperstructureDecision || !item) return;

        // 🔥 OPRAVA: doplnený slot z pendingSuperstructureDecision
        const { team, day, mealType, slot } = pendingSuperstructureDecision;
        const { assignment, placeTeam } = item;
    
        setSelectedCateringCell({
            team,
            dayKey: day.key,
            dayLabel: day.fullLabelNumeric,
            mealType,
            slotFrom: slot.from,
            slotTo: slot.to,
            existingId: assignment.id || null,
            isSuperstructure: true,
            placeTeam,
            isPriority: false, // bude sa brať z checkboxu
            showPriorityCheckbox: true,
        });
        // 🔥 Predvyplníme checkbox podľa pôvodnej priority
        setCateringModalIsPriority(assignment.isPriority === true);
        setSelectedCateringPlaceId(assignment.placeId || '');
        setShowSuperstructureReplanPickerModal(false);
        setSuperstructureReplanPickerItems([]);
        setPendingSuperstructureDecision(null);
        setShowCateringModal(true);
    };
    
    const cancelSuperstructureReplanPicker = () => {
        setShowSuperstructureReplanPickerModal(false);
        setSuperstructureReplanPickerItems([]);
        setPendingSuperstructureDecision(null);
    };
    
    // 🔥 NOVÉ: Používateľ zvolil "Naplánovať prioritnejšie miesto a čas pre iný tím"
    const handleSuperstructurePriority = () => {
        if (!pendingSuperstructureDecision) return;
        const { team, day, mealType, slot } = pendingSuperstructureDecision;
    
        setPendingAssignmentCell({ team, day, mealType, slot });
    
        const teamsInCategory = matchTeams.filter(
            (t) => t.category === team.category
        );
        setSelectedPlaceTeamId(teamsInCategory[0]?.id || '');
        setPlaceAssignmentSearch('');
        setShowSuperstructureDecisionModal(false);
        setPendingSuperstructureDecision(null);
        setShowAssignmentTypeModal(false);
        setShowPlaceAssignmentModal(true);
    };
    
    const cancelSuperstructureDecision = () => {
        setShowSuperstructureDecisionModal(false);
        setPendingSuperstructureDecision(null);
    };

    // Uloží priradenie stravovacieho miesta do DB (s potvrdením pri zmene)
    const saveCateringAssignment = async () => {
        if (!selectedCateringCell || !selectedCateringPlaceId || !window.db) return;

        const payload = buildCateringPayload(selectedCateringPlaceId);

        if (selectedCateringCell.isSuperstructure) {
            setSavingCatering(true);

            // Ak kliknuté miesto je rovnaké ako existujúce, nič nerobíme
            const isSameAsExisting =
                selectedCateringCell.existingId &&
                selectedCateringCell._originalPlaceId === selectedCateringPlaceId;

            // (Voliteľné – ak nechceš riešiť „bez zmeny", môžeš túto kontrolu vynechať.)

            if (selectedCateringCell.existingId) {
                // Upravujeme existujúce superstructure priradenie → replace
                await performSaveCateringAssignment(
                    payload,
                    true,
                    [selectedCateringCell.existingId]
                );
            } else {
                // Nové superstructure priradenie
                await performSaveCateringAssignment(payload, false, null);
            }
            return;
        }

        // Klasická logika pre používateľský tím
        const existingForTeamDayMeal = cateringAssignments.filter(
            (a) =>
                a.teamUid === selectedCateringCell.team.uid &&
                a.teamIndex === selectedCateringCell.team.teamIndex &&
                (a.category === selectedCateringCell.team.category ||
                 a.categoryName === selectedCateringCell.team.category) &&
                a.dayKey === selectedCateringCell.dayKey &&
                a.mealType === selectedCateringCell.mealType
        );

        if (existingForTeamDayMeal.length === 0) {
            setSavingCatering(true);
            await performSaveCateringAssignment(payload, false, null);
            return;
        }

        const identical = existingForTeamDayMeal.find(
            (a) =>
                a.slotFrom === selectedCateringCell.slotFrom &&
                a.placeId === selectedCateringPlaceId
        );
        if (identical) {
            setShowCateringModal(false);
            setSelectedCateringCell(null);
            setSelectedCateringPlaceId('');
            setCateringModalIsPriority(false);
            return;
        }

        setPendingChange({
            payload,
            oldIds: existingForTeamDayMeal.map((a) => a.id),
        });
        setShowChangeConfirm(true);
    };

    const confirmChangeAssignment = async () => {
        if (!pendingChange || !window.db) return;
        setSavingCatering(true);
        setShowChangeConfirm(false);

        await performSaveCateringAssignment(
            pendingChange.payload,
            true,
            pendingChange.oldIds
        );

        setPendingChange(null);
    };

    const cancelChangeAssignment = () => {
        setShowChangeConfirm(false);
        setPendingChange(null);
        setSavingCatering(false);
    };

    const savePlaceAssignment = async () => {
        if (!pendingAssignmentCell || !selectedPlaceTeamId) return;
    
        const { team, day, mealType, slot } = pendingAssignmentCell;
    
        // 🔥 ZMENA: hľadáme v matchTeams
        const placeTeam = matchTeams.find((t) => t.id === selectedPlaceTeamId);
        if (!placeTeam) {
            window.showGlobalNotification('Vybraný tím sa nenašiel.', 'error');
            return;
        }
    
        // Pripravíme "selectedCateringCell" pre superstructure priradenie.
        setSelectedCateringCell({
            team,
            dayKey: day.key,
            dayLabel: day.fullLabelNumeric,
            mealType,
            slotFrom: slot.from,
            slotTo: slot.to,
            existingId: null,
            isSuperstructure: true,
            placeTeam,
            isPriority: false,
            showPriorityCheckbox: true,
        });

        // 🔥 Pri novom prioritnom priradení predvyplníme checkbox na true
        setCateringModalIsPriority(true);
        setSelectedCateringPlaceId('');
        setShowPlaceAssignmentModal(false);
        setShowCateringModal(true);
    };

    const deleteCateringAssignment = async () => {
        if (!selectedCateringCell?.existingId || !window.db) return;
        setSavingCatering(true);
        try {
            await deleteDoc(doc(window.db, 'catering', selectedCateringCell.existingId));

            const message = selectedCateringCell.isSuperstructure
                ? 'Superstructure priradenie bolo odstránené.'
                : 'Priradenie bolo odstránené.';
            window.showGlobalNotification(message, 'success');

            setShowCateringModal(false);
            setSelectedCateringCell(null);
            setSelectedCateringPlaceId('');
            setCateringModalIsPriority(false);
        } catch (err) {
            window.showGlobalNotification('Nepodarilo sa odstrániť priradenie.', 'error');
        } finally {
            setSavingCatering(false);
        }
    };

    return React.createElement(
        'div',
        { className: 'flex-grow flex justify-center items-start p-6 w-full min-w-0' },
        React.createElement(
            'div',
            { className: 'w-full min-w-0 bg-white rounded-xl shadow-xl p-8' },
            React.createElement(
                'div',
                { className: 'flex flex-col items-center justify-center mb-6' },
                React.createElement('h2', { className: 'text-3xl font-bold tracking-tight text-center mb-4' }, 'Stravovanie'),

                // Filtre (kategória, dátum, typ jedla)
                React.createElement(
                    'div',
                    { className: 'flex flex-wrap items-center justify-center gap-4 w-full' },

                    // Filter kategórie
                    React.createElement(
                        'div',
                        { className: 'flex items-center gap-2' },
                        React.createElement('label', { className: 'text-sm font-medium text-gray-700' }, 'Kategória:'),
                        React.createElement(
                            'select',
                            {
                                value: filterCategory,
                                onChange: (e) => {
                                    const val = e.target.value;
                                    setFilterCategory(val);
                                },
                                className:
                                    'px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition',
                            },
                            React.createElement('option', { value: '' }, 'Všetky'),
                            availableCategories.map((cat) =>
                                React.createElement(
                                    'option',
                                    { key: cat, value: cat },
                                    cat
                                )
                            )
                        )
                    ),

                    // Filter dňa
                    React.createElement(
                        'div',
                        { className: 'flex items-center gap-2' },
                        React.createElement('label', { className: 'text-sm font-medium text-gray-700' }, 'Dátum:'),
                        React.createElement(
                            'select',
                            {
                                value: filterDayKey,
                                onChange: (e) => setFilterDayKey(e.target.value),
                                className:
                                    'px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition',
                            },
                            React.createElement('option', { value: '' }, 'Všetky'),
                            visibleDays.map((day) =>
                                React.createElement(
                                    'option',
                                    { key: day.key, value: day.key },
                                    day.label
                                )
                            )
                        )
                    ),

                    // Filter typu jedla
                    React.createElement(
                        'div',
                        { className: 'flex items-center gap-2' },
                        React.createElement('label', { className: 'text-sm font-medium text-gray-700' }, 'Typ jedla:'),
                        React.createElement(
                            'select',
                            {
                                value: filterMealType,
                                onChange: (e) => setFilterMealType(e.target.value),
                                className:
                                    'px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition',
                            },
                            React.createElement('option', { value: '' }, 'Všetky'),
                            React.createElement('option', { value: 'lunch' }, 'Obed'),
                            React.createElement('option', { value: 'dinner' }, 'Večera')
                        )
                    )
                )
            ),
            React.createElement(
                'div',
                { className: 'overflow-x-auto pb-4 w-full min-w-0' },
                React.createElement(
                    'table',
                    {
                        className: 'min-w-max border-collapse text-sm',
                        key: `${filterCategory}|${filterDayKey}|${filterMealType}`,
                    },
                    // HLAVIČKA TABUĽKY
                    React.createElement(
                        'thead',
                        null,
                        // Riadok 1: Kategória, Tím, Hráči, RT, dni
                        React.createElement(
                            'tr',
                            null,
                            React.createElement(
                                'th',
                                {
                                    rowSpan: 3,
                                    className:
                                        'border border-gray-300 bg-gray-100 px-3 py-2 text-left font-bold text-gray-700 min-w-[70px]',
                                },
                                'Kategória'
                            ),
                            React.createElement(
                                'th',
                                {
                                    rowSpan: 3,
                                    className:
                                        'border border-gray-300 bg-gray-100 px-3 py-2 text-left font-bold text-gray-700 min-w-[180px]',
                                },
                                'Tím'
                            ),
                            React.createElement(
                                'th',
                                {
                                    rowSpan: 3,
                                    className:
                                        'border border-gray-300 bg-gray-100 px-3 py-2 text-center font-bold text-gray-700 whitespace-nowrap min-w-[60px]',
                                },
                                'Hráči'
                            ),
                            React.createElement(
                                'th',
                                {
                                    rowSpan: 3,
                                    className:
                                        'border border-gray-300 bg-gray-100 px-3 py-2 text-center font-bold text-gray-700 whitespace-nowrap min-w-[60px] border-r-4 border-r-gray-500',
                                },
                                'RT'
                            ),
                            React.createElement(
                                'th',
                                {
                                    rowSpan: 3,
                                    className:
                                        'border border-gray-300 bg-gray-100 px-3 py-2 text-center font-bold text-gray-700 whitespace-nowrap min-w-[50px] border-r-4 border-r-gray-500',
                                },
                                'Balík'
                            ),
                            filteredDays.map((day, index) => {
                                const total = visibleColumnCountForDay(day.key) + dailySummaryColumnsForDay(day.key);
                                return React.createElement(
                                    'th',
                                    {
                                        key: `day-header-${index}`,
                                        colSpan: total,
                                        className:
                                            'border border-gray-300 bg-gray-100 px-3 py-2 text-center font-bold text-gray-700 whitespace-nowrap border-r-4 border-r-gray-500',
                                        title: day.fullLabel,
                                    },
                                    day.label
                                );
                            })
                        ),
                        // Riadok 2: Obed / Večera
                        React.createElement(
                            'tr',
                            null,
                            filteredDays.map((day, index) => {
                                const lunchCount = shouldShowMealType('lunch')
                                    ? slotCountFor(day.key, 'lunch')
                                    : 0;
                                const dinnerCount = shouldShowMealType('dinner')
                                    ? slotCountFor(day.key, 'dinner')
                                    : 0;
                                const hasLunchSummary = shouldShowMealType('lunch') && lunchCount > 0;
                                const hasDinnerSummary = shouldShowMealType('dinner') && dinnerCount > 0;
                                const parts = [];

                                if (lunchCount > 0 || hasLunchSummary) {
                                    const lunchColSpan = lunchCount + (hasLunchSummary ? 1 : 0);
                                    // 🔥 Hrubá čiara za obedom len ak v tomto dni nie je večera
                                    const lunchHasThickRight =
                                        (dinnerCount === 0 && !hasDinnerSummary);
                                    parts.push(
                                        React.createElement(
                                            'th',
                                            {
                                                key: `lunch-header-${index}`,
                                                colSpan: lunchColSpan,
                                                className:
                                                    'border border-gray-300 bg-blue-50 px-2 py-1 text-center font-semibold text-blue-700 text-xs' +
                                                    (lunchHasThickRight ? ' border-r-4 border-r-gray-500' : ''),
                                            },
                                            'Obed'
                                        )
                                    );
                                }

                                if (dinnerCount > 0 || hasDinnerSummary) {
                                    const dinnerColSpan = dinnerCount + (hasDinnerSummary ? 1 : 0);
                                    parts.push(
                                        React.createElement(
                                            'th',
                                            {
                                                key: `dinner-header-${index}`,
                                                colSpan: dinnerColSpan,
                                                className:
                                                    'border border-gray-300 bg-blue-50 px-2 py-1 text-center font-semibold text-blue-700 text-xs border-r-4 border-r-gray-500',
                                            },
                                            'Večera'
                                        )
                                    );
                                }

                                return React.createElement(
                                    React.Fragment,
                                    { key: `meal-header-${index}` },
                                    ...parts
                                );
                            })
                        ),
                        // Riadok 3: Popisky časov
                        React.createElement(
                            'tr',
                            null,
                            filteredDays.map((day, dayIndex) => {
                                const lunchSlots = shouldShowMealType('lunch')
                                    ? (daySlots[day.key]?.lunch || [])
                                    : [];
                                const dinnerSlots = shouldShowMealType('dinner')
                                    ? (daySlots[day.key]?.dinner || [])
                                    : [];
                                const hasLunchSummary = lunchSlots.length > 0;
                                const hasDinnerSummary = dinnerSlots.length > 0;
                                const parts = [];

                                // Obedové sloty
                                lunchSlots.forEach((slot, i) => {
                                    const isLastLunchSlot = i === lunchSlots.length - 1;
                                    // 🔥 Hrubá čiara len ak nie je lunch summary a nie je večera v tomto dni
                                    const hasThickRight =
                                        isLastLunchSlot &&
                                        !hasLunchSummary &&
                                        (dinnerSlots.length === 0 && !hasDinnerSummary);
                                    parts.push(
                                        React.createElement(
                                            'th',
                                            {
                                                key: `lunch-slot-${dayIndex}-${i}`,
                                                className:
                                                    'border border-gray-300 bg-blue-50 px-2 py-1 text-center text-[11px] text-blue-700 whitespace-nowrap min-w-[70px]' +
                                                    (hasThickRight ? ' border-r-4 border-r-gray-500' : ''),
                                                title: slot.from && slot.to ? `${slot.from} – ${slot.to}` : '',
                                            },
                                            slot.label
                                        )
                                    );
                                });

                                // Stĺpec „∑ Obed" (denný súčet)
                                if (hasLunchSummary) {
                                    // 🔥 Hrubá čiara za "∑ Obed" len ak v tomto dni nie je večera
                                    const hasThickRight = (dinnerSlots.length === 0 && !hasDinnerSummary);
                                    parts.push(
                                        React.createElement(
                                            'th',
                                            {
                                                key: `lunch-summary-${dayIndex}`,
                                                className:
                                                    'border border-gray-300 bg-amber-100 px-2 py-1 text-center text-[11px] font-bold text-amber-800 whitespace-nowrap min-w-[70px]' +
                                                    (hasThickRight ? ' border-r-4 border-r-gray-500' : ''),
                                                title: 'Denný súčet obeda',
                                            },
                                            '∑'
                                        )
                                    );
                                }

                                // Večerové sloty
                                dinnerSlots.forEach((slot, i) => {
                                    const isLastDinnerSlot = i === dinnerSlots.length - 1;
                                    // 🔥 Hrubá čiara za posledným večerovým slotom VŽDY (ak nie je summary)
                                    const hasThickRight = isLastDinnerSlot && !hasDinnerSummary;
                                    parts.push(
                                        React.createElement(
                                            'th',
                                            {
                                                key: `dinner-slot-${dayIndex}-${i}`,
                                                className:
                                                    'border border-gray-300 bg-blue-50 px-2 py-1 text-center text-[11px] text-blue-700 whitespace-nowrap min-w-[70px]' +
                                                    (hasThickRight ? ' border-r-4 border-r-gray-500' : ''),
                                                title: slot.from && slot.to ? `${slot.from} – ${slot.to}` : '',
                                            },
                                            slot.label
                                        )
                                    );
                                });

                                // Stĺpec „∑ Večera" (denný súčet)
                                if (hasDinnerSummary) {
                                    // 🔥 Hrubá čiara za "∑ Večera" VŽDY
                                    parts.push(
                                        React.createElement(
                                            'th',
                                            {
                                                key: `dinner-summary-${dayIndex}`,
                                                className:
                                                    'border border-gray-300 bg-amber-100 px-2 py-1 text-center text-[11px] font-bold text-amber-800 whitespace-nowrap min-w-[70px] border-r-4 border-r-gray-500',
                                                title: 'Denný súčet večere',
                                            },
                                            '∑'
                                        )
                                    );
                                }

                                return React.createElement(
                                    React.Fragment,
                                    { key: `slot-headers-${dayIndex}` },
                                    ...parts
                                );
                            })
                        )
                    ),
                    // TELO TABUĽKY
                    React.createElement(
                        'tbody',
                        null,
                        filteredTeams.length === 0
                            ? React.createElement(
                                  'tr',
                                  null,
                                  React.createElement(
                                      'td',
                                      {
                                          colSpan: 5 + filteredDays.reduce(
                                              (acc, d) =>
                                                  acc + visibleColumnCountForDay(d.key) + dailySummaryColumnsForDay(d.key),
                                              0
                                          ),
                                          className: 'border border-gray-300 px-3 py-4 text-center text-gray-500',
                                      },
                                      'Žiadne tímy neboli nájdené.'
                                  )
                              )
                            : filteredTeams.map((team, rowIndex) =>
                                  React.createElement(
                                      'tr',
                                      {
                                          key: team.id || `${team.uid}-${team.teamName}-${rowIndex}`,
                                          className: 'bg-white border-b border-gray-200',
                                      },
                                      React.createElement(
                                          'td',
                                          {
                                              className:
                                                  'border border-gray-300 px-3 py-2 text-gray-600 whitespace-nowrap text-xs',
                                          },
                                          team.category
                                      ),
                                      React.createElement(
                                          'td',
                                          {
                                              className:
                                                  'border border-gray-300 px-3 py-2 font-medium text-gray-800 whitespace-nowrap',
                                          },
                                          team.teamName
                                      ),
                                      React.createElement(
                                          'td',
                                          {
                                              className:
                                                  'border border-gray-300 px-3 py-2 text-center whitespace-nowrap text-xs font-medium',
                                              style: {
                                                  backgroundColor: getTeamAccommodationColor(team),
                                                  color: getTeamAccommodationTextColor(team),
                                              },
                                          },
                                          team.playersCount
                                      ),
                                      React.createElement(
                                          'td',
                                          {
                                              className:
                                                  'border border-gray-300 px-3 py-2 text-center whitespace-nowrap text-xs font-medium border-r-4 border-r-gray-500',
                                              style: {
                                                  backgroundColor: getTeamAccommodationColor(team),
                                                  color: getTeamAccommodationTextColor(team),
                                              },
                                          },
                                          team.othersCount
                                      ),
                                      React.createElement(
                                          'td',
                                          {
                                              className:
                                                  'border border-gray-300 px-3 py-2 text-center whitespace-nowrap text-xs font-medium border-r-4 border-r-gray-500',
                                          },
                                          team.packageName || '–'
                                      ),
                                      filteredDays.map((day, dayIndex) => {
                                          const lunchCount = shouldShowMealType('lunch')
                                              ? slotCountFor(day.key, 'lunch')
                                              : 0;
                                          const dinnerCount = shouldShowMealType('dinner')
                                              ? slotCountFor(day.key, 'dinner')
                                              : 0;
                                          const cells = [];

                                          for (let i = 0; i < lunchCount; i++) {
                                              const slot = daySlots[day.key].lunch[i];
                                              const isLastLunchCell = i === lunchCount - 1;
                                              // 🔥 Hrubá čiara za obedom len ak v tomto dni nie je večera
                                              const hasThickRight =
                                                  isLastLunchCell &&
                                                  (dinnerCount === 0);
                                              const existing = findCateringAssignment(team, day.key, 'lunch', slot.from);
                                              const superstructureAssignment = findSuperstructureAssignmentForCell(team, day.key, 'lunch', slot.from);
                                              const colors = existing
                                                  ? getCateringPlaceColors(existing.placeId)
                                                  : null;
                                              const teamTotal = (team.playersCount || 0) + (team.othersCount || 0);

                                              const hasMealInPackage = teamHasMealInPackage(team, day.key, 'lunch');
                                              const canClick = true;

                                              const displaySuperstructureName = superstructureAssignment
                                                  ? getPlaceTeamDisplayName(
                                                        superstructureAssignment.teamName,
                                                        superstructureAssignment.category
                                                    )
                                                  : null;
                                              const superstructureColors = superstructureAssignment
                                                  ? getCateringPlaceColors(superstructureAssignment.placeId)
                                                  : null;

                                              let cellClass =
                                                  'border border-gray-300 px-2 py-2 text-center text-xs min-w-[70px] transition cursor-pointer ';
                                              if (existing && colors) {
                                                  // klasické priradenie – bez zmeny
                                              } else if (superstructureAssignment && superstructureAssignment.isPriority) {
                                                  cellClass += 'font-bold ';
                                              } else if (hasMealInPackage) {
                                                  cellClass += 'text-gray-400 hover:bg-blue-50 ';
                                              } else {
                                                  cellClass += 'bg-gray-100 text-gray-500 hover:bg-green-50 ';
                                              }
                                              cellClass += (hasThickRight ? 'border-r-4 border-r-gray-500' : '');

                                              cells.push(
                                                  React.createElement(
                                                      'td',
                                                      {
                                                          key: `cell-lunch-${rowIndex}-${dayIndex}-${i}`,
                                                          onClick: canClick
                                                              ? () => openCateringModal(team, day, 'lunch', slot)
                                                              : undefined,
                                                          className: cellClass,
                                                          style: existing && colors
                                                              ? {
                                                                    backgroundColor: colors.bg,
                                                                    color: colors.text,
                                                                }
                                                              : superstructureAssignment && superstructureColors
                                                                  ? {
                                                                        backgroundColor: superstructureColors.bg,
                                                                        color: superstructureColors.text,
                                                                        ...(superstructureAssignment.isPriority
                                                                            ? {
                                                                                  border: '4px solid #000000',
                                                                                  fontWeight: 'bold',
                                                                              }
                                                                            : {}),
                                                                    }
                                                                  : {},
                                                          title: existing
                                                              ? `${existing.placeName} (${slot.from} – ${slot.to})`
                                                              : superstructureAssignment
                                                                  ? `${superstructureAssignment.teamName} (${slot.from} – ${slot.to})`
                                                                  : hasMealInPackage
                                                                      ? `Kliknutím priradíte miesto (${slot.from} – ${slot.to})`
                                                                      : `Tím nemá v balíku '${team.packageName}' obed pre ${day.fullLabelNumeric}. Kliknutím priradíte podľa umiestnenia.`,
                                                      },
                                                      existing
                                                          ? teamTotal
                                                          : displaySuperstructureName
                                                              ? displaySuperstructureName
                                                              : (hasMealInPackage ? '' : '–')
                                                  )
                                              );
                                          }

                                          if (shouldShowMealType('lunch') && lunchCount > 0) {
                                              // 🔥 Hrubá čiara za prázdnou obedovou summary bunkou len ak nie je večera
                                              const hasThickRight =
                                                  !(shouldShowMealType('dinner') && dinnerCount > 0);
                                              cells.push(
                                                  React.createElement('td', {
                                                      key: `empty-lunch-summary-${rowIndex}-${dayIndex}`,
                                                      className:
                                                          'border border-gray-300 px-2 py-2 text-center text-xs min-w-[70px]' +
                                                          (hasThickRight ? ' border-r-4 border-r-gray-500' : ''),
                                                  })
                                              );
                                          }

                                          for (let i = 0; i < dinnerCount; i++) {
                                              const slot = daySlots[day.key].dinner[i];
                                              const isLastDinnerCell = i === dinnerCount - 1;
                                              // 🔥 Hrubá čiara za posledným večerovým slotom VŽDY
                                              const hasThickRight = isLastDinnerCell;
                                              const existing = findCateringAssignment(team, day.key, 'dinner', slot.from);
                                              const superstructureAssignment = findSuperstructureAssignmentForCell(team, day.key, 'dinner', slot.from);
                                              const colors = existing
                                                  ? getCateringPlaceColors(existing.placeId)
                                                  : null;
                                              const teamTotal = (team.playersCount || 0) + (team.othersCount || 0);

                                              const hasMealInPackage = teamHasMealInPackage(team, day.key, 'dinner');
                                              const canClick = true;

                                              const displaySuperstructureName = superstructureAssignment
                                                  ? getPlaceTeamDisplayName(
                                                        superstructureAssignment.teamName,
                                                        superstructureAssignment.category
                                                    )
                                                  : null;
                                              const superstructureColors = superstructureAssignment
                                                  ? getCateringPlaceColors(superstructureAssignment.placeId)
                                                  : null;

                                              let cellClass =
                                                  'border border-gray-300 px-2 py-2 text-center text-xs min-w-[70px] transition cursor-pointer ';
                                              if (existing && colors) {
                                                  // klasické priradenie – bez zmeny
                                              } else if (superstructureAssignment && superstructureAssignment.isPriority) {
                                                  cellClass += 'font-bold ';
                                              } else if (hasMealInPackage) {
                                                  cellClass += 'text-gray-400 hover:bg-blue-50 ';
                                              } else {
                                                  cellClass += 'bg-gray-100 text-gray-500 hover:bg-green-50 ';
                                              }
                                              cellClass += (hasThickRight ? 'border-r-4 border-r-gray-500' : '');

                                              cells.push(
                                                  React.createElement(
                                                      'td',
                                                      {
                                                          key: `cell-dinner-${rowIndex}-${dayIndex}-${i}`,
                                                          onClick: canClick
                                                              ? () => openCateringModal(team, day, 'dinner', slot)
                                                              : undefined,
                                                          className: cellClass,
                                                          style: existing && colors
                                                              ? {
                                                                    backgroundColor: colors.bg,
                                                                    color: colors.text,
                                                                }
                                                              : superstructureAssignment && superstructureColors
                                                                  ? {
                                                                        backgroundColor: superstructureColors.bg,
                                                                        color: superstructureColors.text,
                                                                        ...(superstructureAssignment.isPriority
                                                                            ? {
                                                                                  border: '4px solid #000000',
                                                                                  fontWeight: 'bold',
                                                                              }
                                                                            : {}),
                                                                    }
                                                                  : {},
                                                          title: existing
                                                              ? `${existing.placeName} (${slot.from} – ${slot.to})`
                                                              : superstructureAssignment
                                                                  ? `${superstructureAssignment.teamName} (${slot.from} – ${slot.to})`
                                                                  : hasMealInPackage
                                                                      ? `Kliknutím priradíte miesto (${slot.from} – ${slot.to})`
                                                                      : `Tím nemá v balíku '${team.packageName}' večeru pre ${day.fullLabelNumeric}. Kliknutím priradíte podľa umiestnenia.`,
                                                      },
                                                      existing
                                                          ? teamTotal
                                                          : displaySuperstructureName
                                                              ? displaySuperstructureName
                                                              : (hasMealInPackage ? '' : '–')
                                                  )
                                              );
                                          }

                                          // Prázdna bunka pre stĺpec "Večera – denný súčet"
                                          if (shouldShowMealType('dinner') && dinnerCount > 0) {
                                              // 🔥 Hrubá čiara za prázdnou večerovou summary bunkou VŽDY
                                              cells.push(
                                                  React.createElement('td', {
                                                      key: `empty-dinner-summary-${rowIndex}-${dayIndex}`,
                                                      className:
                                                          'border border-gray-300 px-2 py-2 text-center text-xs min-w-[70px] border-r-4 border-r-gray-500',
                                                  })
                                              );
                                          }

                                          return React.createElement(
                                              React.Fragment,
                                              { key: `cells-${rowIndex}-${dayIndex}` },
                                              ...cells
                                          );
                                      })
                                  )
                              ),
                        // SÚHRNNÉ RIADKY PRE KAŽDÉ STRAVOVACIE MIESTO
                        React.createElement(
                            'tr',
                            { key: 'summary-header', className: 'bg-gray-100' },
                            React.createElement(
                                'td',
                                {
                                    colSpan: 5 + filteredDays.reduce(
                                        (acc, d) =>
                                            acc + visibleColumnCountForDay(d.key) + dailySummaryColumnsForDay(d.key),
                                        0
                                    ),
                                    className: 'border border-gray-300 px-3 py-2 text-left text-sm font-bold text-gray-700'
                                },
                                'Súčty podľa stravovacích miest:'
                            )
                        ),
                        ...cateringPlaces.flatMap((place) => {
                            const colors = getCateringPlaceColors(place.id);
                            const placeCapacity = getCateringPlaceCapacity(place.id);

                            return [React.createElement(
                                'tr',
                                {
                                    key: `summary-place-${place.id}`,
                                    className: 'border-t-2 border-gray-300',
                                },
                                React.createElement(
                                    'td',
                                    {
                                        colSpan: 2,
                                        className: 'border border-gray-300 px-3 py-2 text-left font-semibold whitespace-nowrap',
                                        style: {
                                            backgroundColor: colors.bg,
                                            color: colors.text,
                                        },
                                    },
                                    `${place.name}`
                                ),
                                React.createElement(
                                    'td',
                                    {
                                        colSpan: 3,
                                        className: 'border border-gray-300 px-3 py-2 text-right font-semibold whitespace-nowrap border-r-4 border-r-gray-500',
                                        style: {
                                            backgroundColor: colors.bg,
                                            color: colors.text,
                                        },
                                    },
                                    placeCapacity != null ? `${placeCapacity}` : '–'
                                ),
                                ...filteredDays.flatMap((day, dayIndex) => {
                                    const lunchSlots = shouldShowMealType('lunch') ? (daySlots[day.key]?.lunch || []) : [];
                                    const dinnerSlots = shouldShowMealType('dinner') ? (daySlots[day.key]?.dinner || []) : [];
                                    const cells = [];

                                    lunchSlots.forEach((slot, i) => {
                                        const isLastLunchCell = i === lunchSlots.length - 1;
                                        // 🔥 Hrubá čiara za obedom len ak v tomto dni nie je večera
                                        const hasThickRight = isLastLunchCell && (dinnerSlots.length === 0);
                                        const count = getAssignedCountForPlace(place.id, day.key, 'lunch', slot.from);
                                        const overCapacity = placeCapacity != null && count > placeCapacity;

                                        cells.push(React.createElement(
                                            'td',
                                            {
                                                key: `summary-${place.id}-lunch-${dayIndex}-${i}`,
                                                className:
                                                    'border border-gray-300 px-2 py-2 text-center text-xs font-semibold min-w-[70px]' +
                                                    (hasThickRight ? ' border-r-4 border-r-gray-500' : '') +
                                                    (overCapacity ? ' font-bold text-red-600' : ''),
                                                style: count > 0
                                                    ? {
                                                        backgroundColor: colors.bg,
                                                        color: overCapacity ? '#dc2626' : colors.text,
                                                    }
                                                    : {},
                                            },
                                            count > 0 ? count : ''
                                        ));
                                    });

                                    if (shouldShowMealType('lunch') && lunchSlots.length > 0) {
                                        const dailyLunchTotal = getDailyAssignedCountForPlace(place.id, day.key, 'lunch');
                                        const overCapacity = placeCapacity != null && dailyLunchTotal > placeCapacity;
                                        // 🔥 Hrubá čiara za "∑ Obed" len ak nie je večera v tomto dni
                                        const hasThickRight =
                                            !(shouldShowMealType('dinner') && dinnerSlots.length > 0);

                                        cells.push(React.createElement(
                                            'td',
                                            {
                                                key: `summary-daily-${place.id}-lunch-${dayIndex}`,
                                                className:
                                                    'border border-gray-300 px-2 py-2 text-center text-sm font-bold min-w-[70px]' +
                                                    (hasThickRight ? ' border-r-4 border-r-gray-500' : '') +
                                                    (overCapacity ? ' text-red-600' : ''),
                                                style: dailyLunchTotal > 0
                                                    ? {
                                                          backgroundColor: colors.bg,
                                                          color: overCapacity ? '#dc2626' : colors.text,
                                                      }
                                                    : {},
                                                title: `Denný súčet obeda pre ${place.name}: ${dailyLunchTotal}`,
                                            },
                                            dailyLunchTotal > 0 ? dailyLunchTotal : ''
                                        ));
                                    }

                                    dinnerSlots.forEach((slot, i) => {
                                        const isLastDinnerCell = i === dinnerSlots.length - 1;
                                        // 🔥 Hrubá čiara za posledným večerovým slotom VŽDY (ak nie je summary)
                                        const hasThickRight = isLastDinnerCell && !(shouldShowMealType('dinner') && dinnerSlots.length > 0) === false
                                            ? false
                                            : isLastDinnerCell; // zjednodušené nižšie
                                        const count = getAssignedCountForPlace(place.id, day.key, 'dinner', slot.from);
                                        const overCapacity = placeCapacity != null && count > placeCapacity;

                                        // Ak existuje večerový summary, hrubá čiara patrí summary bunke (nie poslednému slotu)
                                        const thickRight = isLastDinnerCell && !(shouldShowMealType('dinner') && dinnerSlots.length > 0 && false);
                                        // (vždy je summary, keď dinnerSlots.length > 0, takže posledný slot NEMÁ hrubú čiaru)

                                        cells.push(React.createElement(
                                            'td',
                                            {
                                                key: `summary-${place.id}-dinner-${dayIndex}-${i}`,
                                                className:
                                                    'border border-gray-300 px-2 py-2 text-center text-xs font-semibold min-w-[70px]' +
                                                    (overCapacity ? ' font-bold text-red-600' : ''),
                                                style: count > 0
                                                    ? {
                                                        backgroundColor: colors.bg,
                                                        color: overCapacity ? '#dc2626' : colors.text,
                                                    }
                                                    : {},
                                            },
                                            count > 0 ? count : ''
                                        ));
                                    });

                                    if (shouldShowMealType('dinner') && dinnerSlots.length > 0) {
                                        const dailyDinnerTotal = getDailyAssignedCountForPlace(place.id, day.key, 'dinner');
                                        const overCapacity = placeCapacity != null && dailyDinnerTotal > placeCapacity;

                                        cells.push(React.createElement(
                                            'td',
                                            {
                                                key: `summary-daily-${place.id}-dinner-${dayIndex}`,
                                                className:
                                                    'border border-gray-300 px-2 py-2 text-center text-sm font-bold min-w-[70px] border-r-4 border-r-gray-500' +
                                                    (overCapacity ? ' text-red-600' : ''),
                                                style: dailyDinnerTotal > 0
                                                    ? {
                                                          backgroundColor: colors.bg,
                                                          color: overCapacity ? '#dc2626' : colors.text,
                                                      }
                                                    : {},
                                                title: `Denný súčet večere pre ${place.name}: ${dailyDinnerTotal}`,
                                            },
                                            dailyDinnerTotal > 0 ? dailyDinnerTotal : ''
                                        ));
                                    }

                                    return cells;
                                })
                            )];
                        })
                    ),
                )
            ),
            // 🔥 NOVÉ: Modálne okno – výber typu priradenia
            showAssignmentTypeModal && React.createElement(
                'div',
                {
                    className:
                        'fixed inset-0 z-[3050] flex items-center justify-center bg-black/60 backdrop-blur-sm',
                    onClick: () => {
                        cancelAssignmentType();
                    },
                },
                React.createElement(
                    'div',
                    {
                        className:
                            'bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6',
                        onClick: (e) => e.stopPropagation(),
                    },
                    React.createElement(
                        'h3',
                        { className: 'text-xl font-bold mb-4 text-gray-800 text-center' },
                        'Vyberte typ priradenia'
                    ),
                    React.createElement(
                        'p',
                        { className: 'text-gray-600 text-sm mb-6 text-center' },
                        'Ako chcete priradiť stravovanie pre túto bunku?'
                    ),
                    React.createElement(
                        'div',
                        { className: 'flex flex-col gap-3' },
                        React.createElement(
                            'button',
                            {
                                onClick: handleAssignForTeam,
                                className:
                                    'w-full py-3 rounded-lg text-gray-800 font-medium hover:brightness-95 transition border border-green-200',
                                style: { backgroundColor: '#DCFCE7' },
                            },
                            'Priradiť stravovanie pre tím'
                        ),
                        React.createElement(
                            'button',
                            {
                                onClick: handleAssignByPlace,
                                className:
                                    'w-full py-3 rounded-lg text-gray-800 font-medium hover:brightness-95 transition border border-blue-200',
                                style: { backgroundColor: '#DBEAFE' },
                            },
                            'Priradiť stravovanie podľa umiestnenia'
                        ),
                        React.createElement(
                            'button',
                            {
                                onClick: cancelAssignmentType,
                                className:
                                    'w-full py-3 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition',
                            },
                            'Zrušiť'
                        )
                    )
                )
            ),

            // 🔥 NOVÉ: Modálne okno pre priradenie podľa umiestnenia
            showPlaceAssignmentModal && pendingAssignmentCell && React.createElement(
                'div',
                {
                    className:
                        'fixed inset-0 z-[3050] flex items-center justify-center bg-black/60 backdrop-blur-sm',
                    onClick: () => {
                        if (!savingPlaceAssignment) {
                            setShowPlaceAssignmentModal(false);
                            setPendingAssignmentCell(null);
                            setSelectedPlaceTeamId('');
                            setCateringModalIsPriority(false);
                        }
                    },
                },
                React.createElement(
                    'div',
                    {
                        className:
                            'bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 max-h-[85vh] overflow-y-auto',
                        onClick: (e) => e.stopPropagation(),
                    },
                    React.createElement(
                        'h3',
                        { className: 'text-xl font-bold mb-4 text-gray-800' },
                        'Priradiť stravovanie podľa umiestnenia'
                    ),

                    React.createElement(
                        'div',
                        { className: 'mb-4 text-sm text-gray-700 space-y-1' },
                        React.createElement(
                            'p',
                            null,
                            React.createElement('strong', null, 'Kategória: '),
                            pendingAssignmentCell.team.category || '—'
                        ),
                        React.createElement(
                            'p',
                            null,
                            React.createElement('strong', null, 'Deň: '),
                            pendingAssignmentCell.day.fullLabelNumeric
                        ),
                        React.createElement(
                            'p',
                            null,
                            React.createElement('strong', null, 'Jedlo: '),
                            pendingAssignmentCell.mealType === 'lunch' ? 'Obed' : 'Večera'
                        ),
                        React.createElement(
                            'p',
                            null,
                            React.createElement('strong', null, 'Čas: '),
                            `${pendingAssignmentCell.slot.from} – ${pendingAssignmentCell.slot.to}`
                        )
                    ),

                    React.createElement(
                        'div',
                        { className: 'mb-3' },
                        React.createElement(
                            'label',
                            { className: 'block text-sm font-medium text-gray-700 mb-1.5' },
                            'Vyhľadať superstructure tím'
                        ),
                        React.createElement('input', {
                            type: 'text',
                            value: placeAssignmentSearch,
                            onChange: (e) => setPlaceAssignmentSearch(e.target.value),
                            placeholder: 'Napíšte časť názvu tímu...',
                            className:
                                'w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition',
                        })
                    ),

                    (() => {
                        const categoryName = pendingAssignmentCell.team.category;
                        const dayKey = pendingAssignmentCell.day.key;
                        const mealType = pendingAssignmentCell.mealType;

                        const filtered = matchTeams
                            .filter((t) => t.category === categoryName)
                            .filter((t) => !isSuperstructureTeamAlreadyAssigned(t.id, dayKey, mealType))
                            .filter((t) => {
                                if (!placeAssignmentSearch.trim()) return true;
                                return t.teamName
                                    .toLowerCase()
                                    .includes(placeAssignmentSearch.trim().toLowerCase());
                            })
                            .sort((a, b) => {
                                const ga = a.groupName || '';
                                const gb = b.groupName || '';
                                const gcmp = ga.localeCompare(gb, 'sk', { sensitivity: 'base' });
                                if (gcmp !== 0) return gcmp;
                                return (a.teamName || '').localeCompare(b.teamName || '', 'sk', { sensitivity: 'base' });
                            });

                        if (filtered.length === 0) {
                            return React.createElement(
                                'p',
                                { className: 'text-sm text-gray-500 italic text-center py-4' },
                                'Pre túto kategóriu neboli nájdené žiadne tímy.'
                            );
                        }

                        return React.createElement(
                            'div',
                            {
                                className:
                                    'max-h-64 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100',
                            },
                            ...filtered.map((t) =>
                                React.createElement(
                                    'label',
                                    {
                                        key: t.id,
                                        className:
                                            'flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-blue-50 transition' +
                                            (selectedPlaceTeamId === t.id ? ' bg-blue-100' : ''),
                                    },
                                    React.createElement('input', {
                                        type: 'radio',
                                        name: 'placeTeam',
                                        value: t.id,
                                        checked: selectedPlaceTeamId === t.id,
                                        onChange: () => setSelectedPlaceTeamId(t.id),
                                        className:
                                            'w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300',
                                    }),
                                    React.createElement(
                                        'div',
                                        { className: 'flex flex-col' },
                                        React.createElement(
                                            'span',
                                            { className: 'text-sm font-medium text-gray-800' },
                                            getPlaceTeamDisplayName(t.teamName, t.category)
                                        )
                                    )
                                )
                            )
                        );
                    })(),

                    React.createElement(
                        'div',
                        { className: 'flex justify-end gap-3 mt-6' },
                        React.createElement(
                            'button',
                            {
                                onClick: () => {
                                    if (!savingPlaceAssignment) {
                                        setShowPlaceAssignmentModal(false);
                                        setPendingAssignmentCell(null);
                                        setSelectedPlaceTeamId('');
                                        setCateringModalIsPriority(false);
                                    }
                                },
                                disabled: savingPlaceAssignment,
                                className:
                                    'px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50 transition',
                            },
                            'Zrušiť'
                        ),
                        React.createElement(
                            'button',
                            {
                                onClick: savePlaceAssignment,
                                disabled: savingPlaceAssignment || !selectedPlaceTeamId,
                                className:
                                    'px-6 py-2.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:bg-white disabled:text-green-600 disabled:border-2 disabled:border-green-600 disabled:cursor-not-allowed transition font-medium',
                            },
                            savingPlaceAssignment ? 'Ukladám...' : 'Uložiť priradenie'
                        )
                    )
                )
            ),
            // 🔥 NOVÉ: Rozhodovacie modálne okno pre superstructure bunku
            showSuperstructureDecisionModal && pendingSuperstructureDecision && React.createElement(
                'div',
                {
                    className:
                        'fixed inset-0 z-[3050] flex items-center justify-center bg-black/60 backdrop-blur-sm',
                    onClick: () => {
                        cancelSuperstructureDecision();
                    },
                },
                React.createElement(
                    'div',
                    {
                        className:
                            'bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6',
                        onClick: (e) => e.stopPropagation(),
                    },
                    React.createElement(
                        'h3',
                        { className: 'text-xl font-bold mb-4 text-gray-800 text-center' },
                        'Superstructure priradenie'
                    ),
                    React.createElement(
                        'p',
                        { className: 'text-gray-600 text-sm mb-6 text-center' },
                        'Pre túto bunku už existuje superstructure priradenie. Čo chcete urobiť?'
                    ),
                    React.createElement(
                        'div',
                        { className: 'flex flex-col gap-3' },
                        React.createElement(
                            'button',
                            {
                                onClick: handleSuperstructureReplan,
                                className:
                                    'w-full py-3 rounded-lg text-gray-800 font-medium hover:brightness-95 transition border border-green-200',
                                style: { backgroundColor: '#DCFCE7' },
                            },
                            'Preplánovať existujúce miesto a čas pre existujúci tím'
                        ),
                        React.createElement(
                            'button',
                            {
                                onClick: handleSuperstructurePriority,
                                className:
                                    'w-full py-3 rounded-lg text-gray-800 font-medium hover:brightness-95 transition border border-blue-200',
                                style: { backgroundColor: '#DBEAFE' },
                            },
                            'Naplánovať prioritnejšie miesto a čas pre iný tím (o umiestnenie)'
                        ),
                        React.createElement(
                            'button',
                            {
                                onClick: cancelSuperstructureDecision,
                                className:
                                    'w-full py-3 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition',
                            },
                            'Zrušiť'
                        )
                    )
                )
            ),
            // 🔥 NOVÉ: Modálne okno na výber konkrétneho superstructure tímu na preplánovanie
            showSuperstructureReplanPickerModal && superstructureReplanPickerItems.length > 0 && React.createElement(
                'div',
                {
                    className:
                        'fixed inset-0 z-[3050] flex items-center justify-center bg-black/60 backdrop-blur-sm',
                    onClick: () => {
                        cancelSuperstructureReplanPicker();
                    },
                },
                React.createElement(
                    'div',
                    {
                        className:
                            'bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 max-h-[85vh] overflow-y-auto',
                        onClick: (e) => e.stopPropagation(),
                    },
                    React.createElement(
                        'h3',
                        { className: 'text-xl font-bold mb-4 text-gray-800 text-center' },
                        'Vyberte tím na preplánovanie'
                    ),
                    React.createElement(
                        'p',
                        { className: 'text-gray-600 text-sm mb-4 text-center' },
                        'V tomto riadku (tím, deň a typ jedla) existuje viac superstructure priradení. Ktoré chcete preplánovať?'
                    ),
                    React.createElement(
                        'div',
                        { className: 'flex flex-col gap-2' },
                        ...superstructureReplanPickerItems.map((item, idx) => {
                            const { assignment, placeTeam } = item;
                            const placeName =
                                cateringPlaces.find((p) => p.id === assignment.placeId)?.name ||
                                assignment.placeName ||
                                '—';

                            return React.createElement(
                                'button',
                                {
                                    key: assignment.id || idx,
                                    onClick: () => handlePickSuperstructureReplan(item),
                                    className:
                                        'w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-blue-50 hover:border-blue-400 transition',
                                },
                                React.createElement(
                                    'div',
                                    { className: 'flex flex-col gap-1' },
                                    React.createElement(
                                        'span',
                                        { className: 'text-sm font-semibold text-gray-800' },
                                        getPlaceTeamDisplayName(
                                            placeTeam?.teamName,
                                            placeTeam?.category
                                        ) || '—'
                                    ),
                                    React.createElement(
                                        'span',
                                        { className: 'text-xs text-gray-500' },
                                        `Čas: ${assignment.slotFrom} – ${assignment.slotTo} | Miesto: ${placeName}`
                                    )
                                )
                            );
                        })
                    ),
                    React.createElement(
                        'div',
                        { className: 'flex justify-end mt-6' },
                        React.createElement(
                            'button',
                            {
                                onClick: cancelSuperstructureReplanPicker,
                                className:
                                    'px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition',
                            },
                            'Zrušiť'
                        )
                    )
                )
            ),
            // Modálne okno pre priradenie stravovacieho miesta
            showCateringModal && selectedCateringCell && React.createElement(
                'div',
                {
                    className:
                        'fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm',
                    onClick: () => {
                        if (!savingCatering) {
                            setShowCateringModal(false);
                            setSelectedCateringCell(null);
                            setSelectedCateringPlaceId('');
                            setCateringModalIsPriority(false);
                        }
                    },
                },
                React.createElement(
                    'div',
                    {
                        className:
                            'bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6',
                        onClick: (e) => e.stopPropagation(),
                    },
                    React.createElement(
                        'h3',
                        { className: 'text-xl font-bold mb-4 text-gray-800' },
                        'Priradiť stravovacie miesto'
                    ),
                    React.createElement(
                        'div',
                        { className: 'mb-4 text-sm text-gray-700 space-y-1' },
                        React.createElement(
                            'p',
                            null,
                            React.createElement('strong', null, 'Kategória: '),
                            selectedCateringCell.team.category || '—'
                        ),
                        React.createElement(
                            'p',
                            null,
                            React.createElement('strong', null,
                                selectedCateringCell.isSuperstructure ? 'Superstructure tím: ' : 'Tím: '
                            ),
                            selectedCateringCell.isSuperstructure
                                ? getPlaceTeamDisplayName(
                                      selectedCateringCell.placeTeam?.teamName,
                                      selectedCateringCell.placeTeam?.category
                                  ) || '—'
                                : selectedCateringCell.team.teamName
                        ),
                        React.createElement(
                            'p',
                            null,
                            React.createElement('strong', null, 'Deň: '),
                            selectedCateringCell.dayLabel
                        ),
                        React.createElement(
                            'p',
                            null,
                            React.createElement('strong', null, 'Jedlo: '),
                            selectedCateringCell.mealType === 'lunch' ? 'Obed' : 'Večera'
                        ),
                        React.createElement(
                            'p',
                            null,
                            React.createElement('strong', null, 'Čas: '),
                            `${selectedCateringCell.slotFrom} – ${selectedCateringCell.slotTo}`
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'mb-5' },
                        React.createElement(
                            'label',
                            { className: 'block text-sm font-medium text-gray-700 mb-1.5' },
                            'Stravovacie miesto'
                        ),
                        React.createElement(
                            'select',
                            {
                                value: selectedCateringPlaceId,
                                onChange: (e) => setSelectedCateringPlaceId(e.target.value),
                                className:
                                    'w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition bg-white',
                            },
                            React.createElement('option', { value: '' }, 'Vyberte miesto...'),
                            cateringPlaces.map((place) =>
                                React.createElement(
                                    'option',
                                    { key: place.id, value: place.id },
                                    place.name
                                )
                            )
                        )
                    ),
                    // Checkbox pre prioritné priradenie (len pri superstructure)
                    selectedCateringCell.isSuperstructure && selectedCateringCell.showPriorityCheckbox && React.createElement(
                        'div',
                        { className: 'mb-5 p-3 bg-amber-50 border border-amber-200 rounded-lg' },
                        React.createElement(
                            'label',
                            { className: 'flex items-center gap-2 cursor-pointer' },
                            React.createElement('input', {
                                type: 'checkbox',
                                checked: cateringModalIsPriority,
                                onChange: (e) => setCateringModalIsPriority(e.target.checked),
                                className: 'w-4 h-4 text-amber-600 focus:ring-amber-500 border-gray-300 rounded',
                            }),
                            React.createElement(
                                'span',
                                { className: 'text-sm font-medium text-gray-800' },
                                'Prioritné priradenie (zvýrazní sa hrubým čiernym orámovaním)'
                            )
                        ),
                        React.createElement(
                            'p',
                            { className: 'text-xs text-amber-700 mt-1 ml-6' },
                            cateringModalIsPriority
                                ? 'Toto priradenie bude prioritné.'
                                : 'Priorita zostane pôvodnému tímu (ak nejakú mal).'
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'flex justify-end gap-3' },
                        selectedCateringCell.existingId &&
                            React.createElement(
                                'button',
                                {
                                    onClick: deleteCateringAssignment,
                                    disabled: savingCatering,
                                    className:
                                        'px-4 py-2.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition font-medium',
                                },
                                'Odstrániť'
                            ),
                        React.createElement(
                            'button',
                            {
                                onClick: () => {
                                    setShowCateringModal(false);
                                    setSelectedCateringCell(null);
                                    setSelectedCateringPlaceId('');
                                    setCateringModalIsPriority(false);
                                },
                                disabled: savingCatering,
                                className:
                                    'px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50 transition',
                            },
                            'Zrušiť'
                        ),
                        React.createElement(
                            'button',
                            {
                                onClick: saveCateringAssignment,
                                disabled: savingCatering || !selectedCateringPlaceId,
                                className:
                                    'px-6 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-white disabled:text-blue-600 disabled:border-2 disabled:border-blue-600 disabled:cursor-not-allowed transition font-medium',
                            },
                            savingCatering ? 'Ukladám...' : 'Uložiť'
                        )
                    )
                )
            ),
            // Potvrdzovacie okno pri zmene priradenia
            showChangeConfirm && pendingChange && React.createElement(
                'div',
                {
                    className:
                        'fixed inset-0 z-[3100] flex items-center justify-center bg-black/60 backdrop-blur-sm',
                },
                React.createElement(
                    'div',
                    {
                        className:
                            'bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6',
                    },
                    React.createElement(
                        'h3',
                        { className: 'text-xl font-bold mb-4 text-gray-800' },
                        'Zmeniť priradenie?'
                    ),
                    React.createElement(
                        'p',
                        { className: 'text-gray-700 mb-6' },
                        'Pre tento tím, deň a typ jedla už existuje priradené stravovacie miesto. Prajete si ho nahradiť novým? Pôvodné priradenie pre tento deň a typ jedla bude odstránené.'
                    ),
                    React.createElement(
                        'div',
                        { className: 'flex justify-end gap-3' },
                        React.createElement(
                            'button',
                            {
                                onClick: cancelChangeAssignment,
                                disabled: savingCatering,
                                className:
                                    'px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50 transition',
                            },
                            'Nie'
                        ),
                        React.createElement(
                            'button',
                            {
                                onClick: confirmChangeAssignment,
                                disabled: savingCatering,
                                className:
                                    'px-6 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition font-medium',
                            },
                            savingCatering ? 'Ukladám...' : 'Áno, zmeniť'
                        )
                    )
                )
            )
        )
    );
};

// Premenná na sledovanie, či bol poslucháč už nastavený
let isEmailSyncListenerSetup = false;

/**
 * Táto funkcia je poslucháčom udalosti 'globalDataUpdated'.
 */
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
                                await updateDoc(userProfileRef, {
                                    email: user.email
                                });

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
            root.render(React.createElement(cateringApp, { userProfileData }));
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
