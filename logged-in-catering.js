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
    const [superstructureTeams, setSuperstructureTeams] = useState([]);
    const [selectedPlaceTeamId, setSelectedPlaceTeamId] = useState('');
    const [savingPlaceAssignment, setSavingPlaceAssignment] = useState(false);
    const [placeAssignmentSearch, setPlaceAssignmentSearch] = useState('');    

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

    // Spočíta počet členov VŠETKÝCH tímov priradených na dané miesto + deň + jedlo + slot
    const getAssignedCountForPlace = (placeId, dayKey, mealType, slotFrom) => {
        let total = 0;
        userTeams.forEach((team) => {
            const assignment = findCateringAssignment(team, dayKey, mealType, slotFrom);
            if (assignment && assignment.placeId === placeId) {
                total += (team.playersCount || 0) + (team.othersCount || 0);
            }
        });
        return total;
    };

    // Otvorí modálne okno pre priradenie
    const openCateringModal = (team, day, mealType, slot) => {
        // Skontrolujeme, či pre túto bunku už existuje klasické priradenie
        const existing = findCateringAssignment(team, day.key, mealType, slot.from);

        // Ak áno → otvoríme ROVNO modálne okno na priradenie pre tím
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

        // 🔥 Ak tím NEMÁ daný typ stravovania v balíku → otvoríme ROVNO
        // modálne okno "Priradiť podľa umiestnenia" (superstructure tím).
        const hasMealInPackage = teamHasMealInPackage(team, day.key, mealType);
        if (!hasMealInPackage) {
            setPendingAssignmentCell({ team, day, mealType, slot });

            // Predvolíme prvý superstructure tím z rovnakej kategórie
            const teamsInCategory = superstructureTeams.filter(
                (t) => t.category === team.category
            );
            setSelectedPlaceTeamId(teamsInCategory[0]?.id || '');
            setPlaceAssignmentSearch('');
            setShowAssignmentTypeModal(false);
            setShowPlaceAssignmentModal(true);
            return;
        }

        // Ak má tím stravovanie v balíku → otvoríme modálne okno s výberom typu
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
        });
        setSelectedCateringPlaceId(existing?.placeId || '');
        setShowAssignmentTypeModal(false);
        setShowCateringModal(true);
    };

    const handleAssignByPlace = () => {
        if (!pendingAssignmentCell) return;

        const { team } = pendingAssignmentCell;

        const teamsInCategory = superstructureTeams.filter(
            (t) => t.category === team.category
        );

        setSelectedPlaceTeamId(teamsInCategory[0]?.id || '');
        setPlaceAssignmentSearch('');
        setShowAssignmentTypeModal(false);
        setShowPlaceAssignmentModal(true);
    };

    const cancelAssignmentType = () => {
        setShowAssignmentTypeModal(false);
        setPendingAssignmentCell(null);
    };

    const buildCateringPayload = (placeId) => {
        const place = cateringPlaces.find((p) => p.id === placeId);
        return {
            teamUid: selectedCateringCell.team.uid,
            teamIndex: selectedCateringCell.team.teamIndex,
            category: selectedCateringCell.team.category,
            categoryName: selectedCateringCell.team.category,
            dayKey: selectedCateringCell.dayKey,
            dayLabel: selectedCateringCell.dayLabel,
            mealType: selectedCateringCell.mealType,
            slotFrom: selectedCateringCell.slotFrom,
            slotTo: selectedCateringCell.slotTo,
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
        } catch (err) {
            window.showGlobalNotification('Nepodarilo sa uložiť priradenie.', 'error');
        } finally {
            setSavingCatering(false);
        }
    };

    // Uloží priradenie stravovacieho miesta do DB (s potvrdením pri zmene)
    const saveCateringAssignment = async () => {
        if (!selectedCateringCell || !selectedCateringPlaceId || !window.db) return;

        const payload = buildCateringPayload(selectedCateringPlaceId);

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

        // 🔥 NOVÉ: Uloží priradenie stravovania podľa umiestnenia
    const savePlaceAssignment = async () => {
        if (!pendingAssignmentCell || !selectedPlaceTeamId || !window.db) return;

        const { team, day, mealType, slot } = pendingAssignmentCell;

        const placeTeam = superstructureTeams.find((t) => t.id === selectedPlaceTeamId);
        if (!placeTeam) {
            window.showGlobalNotification('Vybraný superstructure tím sa nenašiel.', 'error');
            return;
        }

        setSavingPlaceAssignment(true);

        try {
            const payload = {
                clickedTeamUid: team.uid,
                clickedTeamIndex: team.teamIndex,
                clickedTeamCategory: team.category,

                teamUid: 'global',
                teamIndex: placeTeam.id,
                category: placeTeam.category,
                categoryName: placeTeam.category,
                teamName: placeTeam.teamName,
                groupName: placeTeam.groupName || null,
                isSuperstructure: true,

                dayKey: day.key,
                dayLabel: day.fullLabelNumeric,
                mealType: mealType,
                slotFrom: slot.from,
                slotTo: slot.to,

                placeId: '',
                placeName: '',
            };

            await addDoc(collection(window.db, 'catering'), payload);

            window.showGlobalNotification(
                `Priradenie podľa umiestnenia pre tím "${placeTeam.teamName}" bolo uložené.`,
                'success'
            );

            setShowPlaceAssignmentModal(false);
            setPendingAssignmentCell(null);
            setSelectedPlaceTeamId('');
        } catch (err) {
            console.error('Chyba pri ukladaní priradenia podľa umiestnenia:', err);
            window.showGlobalNotification('Nepodarilo sa uložiť priradenie.', 'error');
        } finally {
            setSavingPlaceAssignment(false);
        }
    };

    const deleteCateringAssignment = async () => {
        if (!selectedCateringCell?.existingId || !window.db) return;
        setSavingCatering(true);
        try {
            await deleteDoc(doc(window.db, 'catering', selectedCateringCell.existingId));
            window.showGlobalNotification('Priradenie bolo odstránené.', 'success');
            setShowCateringModal(false);
            setSelectedCateringCell(null);
            setSelectedCateringPlaceId('');
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
                    { className: 'min-w-max border-collapse text-sm', key: filterCategory },
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
                                const total = visibleColumnCountForDay(day.key);
                                const isLastDay = index === filteredDays.length - 1;
                                return React.createElement(
                                    'th',
                                    {
                                        key: `day-header-${index}`,
                                        colSpan: total,
                                        className:
                                            'border border-gray-300 bg-gray-100 px-3 py-2 text-center font-bold text-gray-700 whitespace-nowrap' +
                                            (isLastDay ? '' : ' border-r-4 border-r-gray-500'),
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
                                const isLastDay = index === filteredDays.length - 1;
                                const parts = [];

                                if (lunchCount > 0) {
                                    const lunchHasThickRight = (dinnerCount > 0) || !isLastDay;
                                    parts.push(
                                        React.createElement(
                                            'th',
                                            {
                                                key: `lunch-header-${index}`,
                                                colSpan: lunchCount,
                                                className:
                                                    'border border-gray-300 bg-blue-50 px-2 py-1 text-center font-semibold text-blue-700 text-xs' +
                                                    (lunchHasThickRight ? ' border-r-4 border-r-gray-500' : ''),
                                            },
                                            'Obed'
                                        )
                                    );
                                }

                                if (dinnerCount > 0) {
                                    parts.push(
                                        React.createElement(
                                            'th',
                                            {
                                                key: `dinner-header-${index}`,
                                                colSpan: dinnerCount,
                                                className:
                                                    'border border-gray-300 bg-blue-50 px-2 py-1 text-center font-semibold text-blue-700 text-xs' +
                                                    (!isLastDay ? ' border-r-4 border-r-gray-500' : ''),
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
                                const isLastDay = dayIndex === filteredDays.length - 1;
                                const parts = [];

                                lunchSlots.forEach((slot, i) => {
                                    const isLastLunchSlot = i === lunchSlots.length - 1;
                                    const hasThickRight =
                                        isLastLunchSlot &&
                                        ((dinnerSlots.length > 0) || !isLastDay);
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

                                dinnerSlots.forEach((slot, i) => {
                                    const isLastDinnerSlot = i === dinnerSlots.length - 1;
                                    const hasThickRight = isLastDinnerSlot && !isLastDay;
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
                                              (acc, d) => acc + visibleColumnCountForDay(d.key),
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
                                          const isLastDay = dayIndex === filteredDays.length - 1;
                                          const cells = [];

                                          for (let i = 0; i < lunchCount; i++) {
                                              const slot = daySlots[day.key].lunch[i];
                                              const isLastLunchCell = i === lunchCount - 1;
                                              const hasThickRight =
                                                  isLastLunchCell &&
                                                  ((dinnerCount > 0) || !isLastDay);
                                              const existing = findCateringAssignment(team, day.key, 'lunch', slot.from);
                                              const superstructureAssignment = findSuperstructureAssignmentForCell(team, day.key, 'lunch', slot.from);
                                              const colors = existing
                                                  ? getCateringPlaceColors(existing.placeId)
                                                  : null;
                                              const teamTotal = (team.playersCount || 0) + (team.othersCount || 0);

                                              const hasMealInPackage = teamHasMealInPackage(team, day.key, 'lunch');
                                              // 🔥 Klik je povolený vždy (aj keď tím nemá stravovanie v balíku)
                                              const canClick = true;

                                              // 🔥 Ak existuje superstructure priradenie, zobrazíme názov tímu
                                              const displaySuperstructureName = superstructureAssignment?.teamName || null;
                                              const superstructureColors = superstructureAssignment
                                                  ? getCateringPlaceColors(superstructureAssignment.placeId)
                                                  : null;

                                              let cellClass =
                                                  'border border-gray-300 px-2 py-2 text-center text-xs min-w-[70px] transition cursor-pointer ';
                                              if (existing && colors) {
                                                  // klasické priradenie – bez zmeny
                                              } else if (hasMealInPackage) {
                                                  cellClass += 'text-gray-400 hover:bg-blue-50 ';
                                              } else {
                                                  // 🔥 Tím nemá stravovanie v balíku – stále klikateľné, ale odlíšené
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

                                          for (let i = 0; i < dinnerCount; i++) {
                                              const slot = daySlots[day.key].dinner[i];
                                              const isLastDinnerCell = i === dinnerCount - 1;
                                              const hasThickRight = isLastDinnerCell && !isLastDay;
                                              const existing = findCateringAssignment(team, day.key, 'dinner', slot.from);
                                              const superstructureAssignment = findSuperstructureAssignmentForCell(team, day.key, 'dinner', slot.from);
                                              const colors = existing
                                                  ? getCateringPlaceColors(existing.placeId)
                                                  : null;
                                              const teamTotal = (team.playersCount || 0) + (team.othersCount || 0);

                                              const hasMealInPackage = teamHasMealInPackage(team, day.key, 'dinner');
                                              // 🔥 Klik je povolený vždy
                                              const canClick = true;

                                              // 🔥 Ak existuje superstructure priradenie, zobrazíme názov tímu
                                              const displaySuperstructureName = superstructureAssignment?.teamName || null;
                                              const superstructureColors = superstructureAssignment
                                                  ? getCateringPlaceColors(superstructureAssignment.placeId)
                                                  : null;

                                              let cellClass =
                                                  'border border-gray-300 px-2 py-2 text-center text-xs min-w-[70px] transition cursor-pointer ';
                                              if (existing && colors) {
                                                  // klasické priradenie – bez zmeny
                                              } else if (hasMealInPackage) {
                                                  cellClass += 'text-gray-400 hover:bg-blue-50 ';
                                              } else {
                                                  // 🔥 Tím nemá stravovanie v balíku – stále klikateľné
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

                                          return React.createElement(
                                              React.Fragment,
                                              { key: `cells-${rowIndex}-${dayIndex}` },
                                              ...cells
                                          );
                                      })
                                  )
                              ),
                        // 🔥 SÚHRNNÉ RIADKY PRE KAŽDÉ STRAVOVACIE MIESTO (vždy zobrazené)
                        // Farba bunky = farba konkrétneho stravovacieho miesta
                        // Ak je prekročená kapacita miesta v danom slote, bunka má červené písmo a bold
                        React.createElement(
                            'tr',
                            { key: 'summary-header', className: 'bg-gray-100' },
                            React.createElement(
                                'td',
                                {
                                    colSpan: 5 + filteredDays.reduce(
                                        (acc, d) => acc + visibleColumnCountForDay(d.key), 0
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
                                // 1) Názov miesta (zlúčené 2 stĺpce: "Kategória" + "Tím")
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
                                // 2) Kapacita miesta (zlúčené 2 stĺpce: "Hráči" + "RT")
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
                                    placeCapacity != null
                                        ? `${placeCapacity}`
                                        : '–'
                                ),
                                ...filteredDays.flatMap((day, dayIndex) => {
                                    const lunchSlots = shouldShowMealType('lunch') ? (daySlots[day.key]?.lunch || []) : [];
                                    const dinnerSlots = shouldShowMealType('dinner') ? (daySlots[day.key]?.dinner || []) : [];
                                    const isLastDay = dayIndex === filteredDays.length - 1;
                                    const cells = [];

                                    lunchSlots.forEach((slot, i) => {
                                        const isLastLunchCell = i === lunchSlots.length - 1;
                                        const hasThickRight = isLastLunchCell && ((dinnerSlots.length > 0) || !isLastDay);
                                        const count = getAssignedCountForPlace(place.id, day.key, 'lunch', slot.from);

                                        const overCapacity =
                                            placeCapacity != null &&
                                            count > placeCapacity;

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

                                    dinnerSlots.forEach((slot, i) => {
                                        const isLastDinnerCell = i === dinnerSlots.length - 1;
                                        const hasThickRight = isLastDinnerCell && !isLastDay;
                                        const count = getAssignedCountForPlace(place.id, day.key, 'dinner', slot.from);

                                        const overCapacity =
                                            placeCapacity != null &&
                                            count > placeCapacity;

                                        cells.push(React.createElement(
                                            'td',
                                            {
                                                key: `summary-${place.id}-dinner-${dayIndex}-${i}`,
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
                                    'w-full py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition',
                            },
                            'Priradiť stravovanie pre tím'
                        ),
                        React.createElement(
                            'button',
                            {
                                onClick: handleAssignByPlace,
                                className:
                                    'w-full py-3 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition',
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

                    // Info o kliknutej bunke
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

                    // Vyhľadávanie
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

                    // Zoznam superstructure tímov filtrovaný podľa kategórie kliknutej bunky
                    (() => {
                        const categoryName = pendingAssignmentCell.team.category;
                        const filtered = superstructureTeams
                            .filter((t) => t.category === categoryName)
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
                                return (a.order || 0) - (b.order || 0);
                            });

                        if (filtered.length === 0) {
                            return React.createElement(
                                'p',
                                { className: 'text-sm text-gray-500 italic text-center py-4' },
                                'Pre túto kategóriu neboli nájdené žiadne superstructure tímy.'
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
                                            t.groupName
                                                ? `${t.groupName} ${t.order != null ? t.order + '. ' : ''}${t.teamName}`
                                                : t.teamName
                                        ),
                                        React.createElement(
                                            'span',
                                            { className: 'text-xs text-gray-500' },
                                            t.category
                                        )
                                    )
                                )
                            )
                        );
                    })(),

                    // Tlačidlá
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
                            React.createElement('strong', null, 'Tím: '),
                            selectedCateringCell.team.teamName
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
