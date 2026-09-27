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
    // ============================================================
    // 1) VŠETKY useState – na začiatku, bez výnimky
    // ============================================================
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
    const [categoriesReady, setCategoriesReady] = useState(false);
    const [categories, setCategories] = useState([]);
    const [scheduledMatches, setScheduledMatches] = useState([]);

    // ============================================================
    // 2) useMemo – odvodené hodnoty, ktoré potrebujú useEffect-y
    // ============================================================
    const availableCategories = React.useMemo(() => {
        return Array.from(
            new Set(
                userTeams.map((t) => t.category).filter(Boolean)
            )
        ).sort((a, b) => a.localeCompare(b, 'sk', { sensitivity: 'base' }));
    }, [userTeams]);

    const visibleDays = React.useMemo(() => {
        if (!tournamentDays || tournamentDays.length === 0) return [];
        return tournamentDays.filter((day) => {
            const t = cateringTimes[day.key] || {};
            const lunchTimes = t.lunch || null;
            const dinnerTimes = t.dinner || null;
            const lunchSlots = hasValidMealRange(lunchTimes, unitMinutes)
                ? buildMealSlots(lunchTimes.from, lunchTimes.to, unitMinutes)
                : [];
            const dinnerSlots = hasValidMealRange(dinnerTimes, unitMinutes)
                ? buildMealSlots(dinnerTimes.from, dinnerTimes.to, unitMinutes)
                : [];
            return lunchSlots.length + dinnerSlots.length > 0;
        });
    }, [tournamentDays, cateringTimes, unitMinutes]);

    // ============================================================
    // 3) Pomocné funkcie pre URL filtre (nie sú hooky, ale patria sem)
    // ============================================================
    const loadFiltersFromURL = () => {
        const params = new URLSearchParams(window.location.search);
        const categoryRaw = params.get('category') || '';
        const categoryName = categoryRaw ? categoryRaw.replace(/-/g, ' ') : '';
        const dayKey = params.get('day') || '';
        const mealType = params.get('mealType') || '';
        return { category: categoryName, day: dayKey, mealType };
    };

    const updateURLWithFilters = (filters) => {
        const params = new URLSearchParams();
        if (filters.category) {
            params.set('category', filters.category.replace(/\s+/g, '-'));
        }
        if (filters.day) params.set('day', filters.day);
        if (filters.mealType) params.set('mealType', filters.mealType);
        const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}${window.location.hash}`;
        window.history.replaceState({}, '', newUrl);
    };

    // ============================================================
    // 4) URL useEffect-y – MUSIA byť pred skorými returnmi!
    // ============================================================
    useEffect(() => {
        if (availableCategories.length === 0 && visibleDays.length === 0) return;

        const filters = loadFiltersFromURL();

        if (filters.category && availableCategories.includes(filters.category)) {
            setFilterCategory(filters.category);
        }
        if (filters.day && visibleDays.some((d) => d.key === filters.day)) {
            setFilterDayKey(filters.day);
        }
        if (filters.mealType === 'lunch' || filters.mealType === 'dinner') {
            setFilterMealType(filters.mealType);
        }
    }, [availableCategories, visibleDays]);

    useEffect(() => {
        if (availableCategories.length === 0 && visibleDays.length === 0) return;

        const timeoutId = setTimeout(() => {
            updateURLWithFilters({
                category: filterCategory,
                day: filterDayKey,
                mealType: filterMealType,
            });
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [filterCategory, filterDayKey, filterMealType, availableCategories, visibleDays]);

    // ============================================================
    // 5) Ostatné useEffect-y – načítanie dát z Firestore
    //    (tie, ktoré si mal pôvodne, len presunuté sem)
    // ============================================================

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

    // Načítanie balíkov (settings/packages/list)
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

    // Načítanie superstructure tímov
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
            (error) => { }
        );

        return () => unsubscribe();
    }, []);

    // Načítanie kategórií (pre fallback categoryId → categoryName)
    useEffect(() => {
        if (!window.db) return;

        const loadCategories = async () => {
            try {
                const categoriesDocRef = doc(window.db, 'settings', 'categories');
                const snap = await getDoc(categoriesDocRef);
                if (snap.exists()) {
                    const data = snap.data() || {};
                    const categoriesMap = {};
                    const categoriesList = [];

                    Object.entries(data).forEach(([catId, catData]) => {
                        if (catData?.name) {
                            categoriesMap[catId] = catData.name;
                            categoriesList.push({
                                id: catId,
                                name: catData.name,
                                maxTeams: catData.maxTeams ?? 12,
                                periods: catData.periods ?? 2,
                                periodDuration: catData.periodDuration ?? 20,
                                breakDuration: catData.breakDuration ?? 2,
                                matchBreak: catData.matchBreak ?? 5,
                                drawColor: catData.drawColor ?? '#3B82F6',
                                transportColor: catData.transportColor ?? '#10B981',
                                timeoutCount: catData.timeoutCount ?? 2,
                                timeoutDuration: catData.timeoutDuration ?? 1,
                                exclusionTime: catData.exclusionTime ?? 2,
                                carryOverPoints: catData.carryOverPoints ?? false,
                            });
                        }
                    });

                    window.categoriesData = categoriesMap;
                    setCategories(categoriesList);
                }
            } catch (err) {
                console.error('[Stravovanie] Chyba pri načítaní kategórií:', err);
            } finally {
                setCategoriesReady(true);
            }
        };

        loadCategories();
    }, []);

    // Načítanie matchTeams
    useEffect(() => {
        if (!window.db || !categoriesReady) return;

        const unsubscribe = onSnapshot(
            collection(window.db, 'matches'),
            (snapshot) => {
                const teamsMap = new Map();

                snapshot.forEach((docSnap) => {
                    const data = docSnap.data() || {};

                    let categoryName = data.categoryName || '';
                    if (!categoryName && data.categoryId && window.categoriesData) {
                        categoryName = window.categoriesData[data.categoryId] || '';
                    }
                    categoryName = cleanCategory(categoryName);
                    if (!categoryName) return;

                    const groupName = data.groupName || null;

                    const addTeam = (identifierFromMatch, teamNameFromMatch) => {
                        if (!identifierFromMatch) return;
                        const key = `${categoryName}||${identifierFromMatch}`;
                        if (teamsMap.has(key)) return;

                        let displayName = null;
                        if (
                            window.teamManager &&
                            typeof window.teamManager.getTeamNameByDisplayIdSync === 'function'
                        ) {
                            try {
                                const resolved = window.teamManager.getTeamNameByDisplayIdSync(identifierFromMatch);
                                if (resolved) displayName = resolved;
                            } catch (e) { /* ignore */ }
                        }
                        if (!displayName && teamNameFromMatch) displayName = teamNameFromMatch;
                        if (!displayName) displayName = identifierFromMatch;

                        displayName = String(displayName).trim();
                        if (!displayName) return;
                        if (displayName === 'null' || displayName === 'undefined') {
                            displayName = identifierFromMatch;
                        }
                        if (!displayName.includes(categoryName)) {
                            if (identifierFromMatch.includes(categoryName)) {
                                displayName = identifierFromMatch;
                            } else {
                                displayName = `${categoryName} ${identifierFromMatch}`;
                            }
                        }

                        teamsMap.set(key, {
                            id: identifierFromMatch,
                            teamName: displayName,
                            identifier: identifierFromMatch,
                            category: categoryName,
                            groupName: groupName,
                        });
                    };

                    addTeam(data.homeTeamIdentifier, data.homeTeamName);
                    addTeam(data.awayTeamIdentifier, data.awayTeamName);
                });

                setMatchTeams(Array.from(teamsMap.values()));
            },
            (error) => { }
        );

        return () => unsubscribe();
    }, [categoriesReady]);

    // Načítanie naplánovaných zápasov (scheduledTime + hallId)
    useEffect(() => {
        if (!window.db) return;

        const unsubscribe = onSnapshot(
            collection(window.db, 'matches'),
            (snapshot) => {
                const scheduledMatchesLocal = [];

                snapshot.forEach((docSnap) => {
                    const data = docSnap.data() || {};
                    if (!data.hallId) return;
                    if (!data.scheduledTime) return;

                    let categoryName = data.categoryName || '';
                    if (!categoryName && data.categoryId && window.categoriesData) {
                        categoryName = window.categoriesData[data.categoryId] || '';
                    }

                    scheduledMatchesLocal.push({
                        id: docSnap.id,
                        homeTeamIdentifier: data.homeTeamIdentifier || null,
                        awayTeamIdentifier: data.awayTeamIdentifier || null,
                        homeTeamName: data.homeTeamName || null,
                        awayTeamName: data.awayTeamName || null,
                        categoryId: data.categoryId || null,
                        categoryName: cleanCategory(categoryName),
                        groupName: data.groupName || null,
                        hallId: data.hallId,
                        scheduledTime: data.scheduledTime,
                        scheduledEndTime: data.scheduledEndTime || null,
                        duration: data.duration ?? null,
                        status: data.status || null,
                        isPlacementMatch: data.isPlacementMatch === true,
                        placementRank: data.placementRank ?? null,
                        matchType: data.matchType || null,
                    });
                });

                scheduledMatchesLocal.sort((a, b) => {
                    try {
                        const ta = a.scheduledTime?.toDate ? a.scheduledTime.toDate().getTime() : 0;
                        const tb = b.scheduledTime?.toDate ? b.scheduledTime.toDate().getTime() : 0;
                        if (ta !== tb) return ta - tb;
                    } catch (e) { /* ignore */ }
                    return String(a.id).localeCompare(String(b.id));
                });

                // Filtrovanie len zápasov prekrývajúcich sa so stravovacími slotmi
                const cateringSlotsByDay = {};
                (tournamentDays || []).forEach((day) => {
                    const t = cateringTimes[day.key] || {};
                    const daySlots = [];

                    if (hasValidMealRange(t.lunch, unitMinutes)) {
                        const built = buildMealSlots(t.lunch.from, t.lunch.to, unitMinutes);
                        built.forEach((s) => {
                            const fromMin = timeToMinutes(s.from);
                            const toMin = timeToMinutes(s.to);
                            if (fromMin != null && toMin != null) daySlots.push({ fromMin, toMin });
                        });
                    }

                    if (hasValidMealRange(t.dinner, unitMinutes)) {
                        const built = buildMealSlots(t.dinner.from, t.dinner.to, unitMinutes);
                        built.forEach((s) => {
                            const fromMin = timeToMinutes(s.from);
                            const toMin = timeToMinutes(s.to);
                            if (fromMin != null && toMin != null) daySlots.push({ fromMin, toMin });
                        });
                    }

                    cateringSlotsByDay[day.key] = daySlots;
                });

                const filteredScheduledMatches = scheduledMatchesLocal.filter((match) => {
                    if (!match.scheduledTime) return false;
                    let matchDate;
                    try {
                        matchDate = match.scheduledTime.toDate
                            ? match.scheduledTime.toDate()
                            : new Date(match.scheduledTime.seconds * 1000);
                    } catch (e) { return false; }

                    const matchDay = String(matchDate.getDate()).padStart(2, '0');
                    const matchMonth = String(matchDate.getMonth() + 1).padStart(2, '0');
                    const matchYear = matchDate.getFullYear();
                    const matchDayKey = `${matchYear}-${matchMonth}-${matchDay}`;

                    const slotsForDay = cateringSlotsByDay[matchDayKey];
                    if (!slotsForDay || slotsForDay.length === 0) return false;

                    let matchDurationMin = match.duration;
                    if (matchDurationMin == null) {
                        const category = categories.find((c) => c.name === match.categoryName)
                            || categories.find((c) => c.id === match.categoryId);
                        if (category) {
                            const periods = category.periods || 2;
                            const periodDuration = category.periodDuration || 20;
                            const breakDuration = category.breakDuration || 2;
                            matchDurationMin = (periodDuration + breakDuration) * periods - breakDuration;
                        } else {
                            matchDurationMin = 0;
                        }
                    }

                    const matchStartMin = matchDate.getHours() * 60 + matchDate.getMinutes();
                    const matchEndMin = matchStartMin + matchDurationMin;

                    return slotsForDay.some(
                        (slot) => matchStartMin < slot.toMin && matchEndMin > slot.fromMin
                    );
                });

                setScheduledMatches(filteredScheduledMatches);
            },
            (error) => {
                console.error('[Stravovanie] Chyba pri načítavaní naplánovaných zápasov:', error);
            }
        );

        return () => unsubscribe();
    }, [categories, cateringTimes, unitMinutes, tournamentDays]);

    const assignmentsBySlot = React.useMemo(() => {
        const map = new Map();
        (cateringAssignments || []).forEach((a) => {
            if (a.isSuperstructure === true) return;
            // 🔥 KĽÚČ OBSAHUJE AJ KATEGÓRIU, aby sa tímy s rovnakým uid/teamIndex
            //    v rôznych kategóriách navzájom neprepisovali.
            const cat = cleanCategory(a.category || a.categoryName || '');
            const key = `${a.teamUid}|${a.teamIndex}|${cat}|${a.dayKey}|${a.mealType}|${a.slotFrom}`;
            if (!map.has(key)) {
                map.set(key, a);
            }
        });
        return map;
    }, [cateringAssignments]);

    const daySlots = React.useMemo(() => {
        const result = {};
        (tournamentDays || []).forEach((day) => {
            const t = cateringTimes[day.key] || {};
            const lunchTimes = t.lunch || null;
            const dinnerTimes = t.dinner || null;
            result[day.key] = {
                lunch: hasValidMealRange(lunchTimes, unitMinutes)
                    ? buildMealSlots(lunchTimes.from, lunchTimes.to, unitMinutes)
                    : [],
                dinner: hasValidMealRange(dinnerTimes, unitMinutes)
                    ? buildMealSlots(dinnerTimes.from, dinnerTimes.to, unitMinutes)
                    : [],
            };
        });
        return result;
    }, [tournamentDays, cateringTimes, unitMinutes]);

    const superstructureAvgByCategory = React.useMemo(() => {
        const map = new Map();
        const teamsByCategory = new Map();
    
        (userTeams || []).forEach((t) => {
            const cat = cleanCategory(t.category);
            if (!cat) return;
            if (!teamsByCategory.has(cat)) teamsByCategory.set(cat, []);
            teamsByCategory.get(cat).push(t);
        });
    
        teamsByCategory.forEach((teams, cat) => {
            if (teams.length === 0) return;
            const total = teams.reduce(
                (acc, t) => acc + (t.playersCount || 0) + (t.othersCount || 0),
                0
            );
            const avg = total / teams.length;
            // 🔥 NOVÉ: zaokrúhli priemer nahor na celé číslo
            // a TÚTO hodnotu použi pre každý superstructure tím v kategórii
            map.set(cat, Math.ceil(avg));
        });
    
        return map;
    }, [userTeams]);

    // ============================================================
    // 6) Až TERAZ môžu prísť skoré return-y
    // ============================================================
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

    const slotCountFor = (dayKey, mealType) => {
        const slots = daySlots[dayKey]?.[mealType] || [];
        return slots.length;
    };

    const shouldShowMealType = (mealType) => {
        if (!filterMealType) return true;
        return filterMealType === mealType;
    };

    const visibleColumnCountForDay = (dayKey) => {
        const slots = daySlots[dayKey] || { lunch: [], dinner: [] };
        let count = 0;
        if (shouldShowMealType('lunch')) count += slots.lunch.length;
        if (shouldShowMealType('dinner')) count += slots.dinner.length;
        return count;
    };

    const dailySummaryColumnsForDay = (dayKey) => {
        const slots = daySlots[dayKey] || { lunch: [], dinner: [] };
        let count = 0;
        if (shouldShowMealType('lunch') && slots.lunch.length > 0) count += 1;
        if (shouldShowMealType('dinner') && slots.dinner.length > 0) count += 1;
        return count;
    };

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
        // 🔥 Kategória je súčasťou kľúča – tím sa hľadá v tej kategórii, v ktorej je.
        const cat = cleanCategory(team.category);
        const key = `${team.uid}|${team.teamIndex}|${cat}|${dayKey}|${mealType}|${slotFrom}`;
        return assignmentsBySlot.get(key) || null;
    };

    // 🔥 Nájde superstructure priradenie pre konkrétnu bunku (kliknutý tím + deň + jedlo + slot)
    const findSuperstructureAssignmentForCell = (team, dayKey, mealType, slotFrom) => {
        const teamCat = cleanCategory(team.category);
        return cateringAssignments.find(
            (a) =>
                a.isSuperstructure === true &&
                a.clickedTeamUid === team.uid &&
                a.clickedTeamIndex === team.teamIndex &&
                cleanCategory(a.clickedTeamCategory) === teamCat &&
                a.dayKey === dayKey &&
                a.mealType === mealType &&
                a.slotFrom === slotFrom
        );
    };

    // 🔥 NOVÉ: Nájde superstructure priradenie pre CELÝ RIADOK (tím + deň + typ jedla),
    // bez ohľadu na slot. Použije sa, ak klikneme na inú bunku v tom istom riadku.
    const findSuperstructureAssignmentForRow = (team, dayKey, mealType) => {
        const teamCat = cleanCategory(team.category);
        return cateringAssignments.find(
            (a) =>
                a.isSuperstructure === true &&
                a.clickedTeamUid === team.uid &&
                a.clickedTeamIndex === team.teamIndex &&
                cleanCategory(a.clickedTeamCategory) === teamCat &&
                a.dayKey === dayKey &&
                a.mealType === mealType
        );
    };  

    const findAllSuperstructureAssignmentsForRow = (team, dayKey, mealType) => {
        const teamCat = cleanCategory(team.category);
        return cateringAssignments.filter(
            (a) =>
                a.isSuperstructure === true &&
                a.clickedTeamUid === team.uid &&
                a.clickedTeamIndex === team.teamIndex &&
                cleanCategory(a.clickedTeamCategory) === teamCat &&
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

    const isSuperstructureTeamAlreadyAssigned = (placeTeamName, dayKey, mealType, category) => {
        const cat = category ? cleanCategory(category) : null;
        return cateringAssignments.some(
            (a) =>
                a.isSuperstructure === true &&
                (a.teamName === placeTeamName || a.teamIdentifier === placeTeamName) &&
                (cat == null || cleanCategory(a.category || a.categoryName) === cat) &&
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

    const teamPlaysDuringSlot = (team, dayKey, slotFrom, slotTo) => {
        if (!team || !dayKey || !slotFrom || !slotTo) return false;
    
        const slotFromMin = timeToMinutes(slotFrom);
        const slotToMin = timeToMinutes(slotTo);
        if (slotFromMin == null || slotToMin == null) return false;
    
        const slotMidMin = slotFromMin + (slotToMin - slotFromMin) / 2;
    
        // 🔥 Kategória tímu – OČISTENÁ
        const teamCategory = cleanCategory(team.category);
    
        // 🔥 Krátky názov tímu (bez kategórie)
        const teamShortName = String(team.teamName || '').trim();
    
        // 🔥 Plný názov = kategória + krátky názov
        const teamFullName = teamCategory && teamShortName
            ? `${teamCategory} ${teamShortName}`
            : teamShortName;
    
        // 🔥 Množina povolených variantov pre porovnanie
        const teamNameVariants = new Set();
        if (teamShortName) teamNameVariants.add(teamShortName);
        if (teamFullName) teamNameVariants.add(teamFullName);
        // Ak teamName už obsahuje kategóriu, pridáme aj verziu bez nej
        if (teamCategory && teamShortName.startsWith(teamCategory + ' ')) {
            teamNameVariants.add(teamShortName.substring(teamCategory.length + 1).trim());
        }
    
        for (const match of scheduledMatches) {
            if (!match.scheduledTime) continue;
    
            let matchDate;
            try {
                matchDate = match.scheduledTime.toDate
                    ? match.scheduledTime.toDate()
                    : new Date(match.scheduledTime.seconds * 1000);
            } catch (e) {
                continue;
            }
    
            const matchDay = String(matchDate.getDate()).padStart(2, '0');
            const matchMonth = String(matchDate.getMonth() + 1).padStart(2, '0');
            const matchYear = matchDate.getFullYear();
            const matchDayKey = `${matchYear}-${matchMonth}-${matchDay}`;
    
            if (matchDayKey !== dayKey) continue;
    
            // 🔥 Kategória zápasu – ak sa NEDÁ určiť, preskočíme ho (radšej false negative než false positive)
            const matchCategory = cleanCategory(
                match.categoryName ||
                (match.categoryId && window.categoriesData
                    ? window.categoriesData[match.categoryId]
                    : '')
            );
    
            // 🔥 AK SA KATEGÓRIE NEZHODUJÚ → tento zápas tímu nepatrí
            //    (a teda neblokuje slot)
            if (matchCategory && teamCategory && matchCategory !== teamCategory) {
                continue;
            }
    
            // 🔥 Identifikátory tímu v zápase
            const matchTeamIdentifiers = [
                match.homeTeamIdentifier,
                match.awayTeamIdentifier,
                match.homeTeamName,
                match.awayTeamName,
            ].filter(Boolean);
    
            const isTeamInMatch = matchTeamIdentifiers.some((identifier) => {
                const idStr = String(identifier).trim();
                if (!idStr) return false;
    
                // 1) Priama zhoda s hociktorým variantom
                if (teamNameVariants.has(idStr)) return true;
    
                // 2) Skúsime vyriešiť cez teamManager
                if (
                    window.teamManager &&
                    typeof window.teamManager.getTeamNameByDisplayIdSync === 'function'
                ) {
                    try {
                        const resolved = window.teamManager.getTeamNameByDisplayIdSync(identifier);
                        if (resolved) {
                            const resolvedStr = String(resolved).trim();
                            if (teamNameVariants.has(resolvedStr)) return true;
                            if (teamCategory && teamNameVariants.has(`${teamCategory} ${resolvedStr}`)) {
                                return true;
                            }
                        }
                    } catch (e) {
                        /* ignore */
                    }
                }
    
                // 3) Fallback: identifier končí na krátky názov tímu
                //    A ZÁROVEŇ začína (alebo obsahuje) kategóriu
                if (teamShortName && teamCategory) {
                    const idStartsWithCategory = idStr.startsWith(teamCategory + ' ') || idStr === teamCategory;
                    const idEndsWithShort = idStr.endsWith(teamShortName) || idStr.includes(` ${teamShortName}`);
    
                    if (idStartsWithCategory && idEndsWithShort) return true;
                }
    
                return false;
            });
    
            if (!isTeamInMatch) continue;
    
            const matchStartMin = matchDate.getHours() * 60 + matchDate.getMinutes();
    
            let matchDurationMin = match.duration;
            if (matchDurationMin == null) {
                const category = categories.find((c) => c.name === matchCategory);
                if (category) {
                    const periods = category.periods || 2;
                    const periodDuration = category.periodDuration || 20;
                    const breakDuration = category.breakDuration || 2;
                    matchDurationMin =
                        (periodDuration + breakDuration) * periods - breakDuration;
                } else {
                    matchDurationMin = 0;
                }
            }
    
            const matchEndMin = matchStartMin + matchDurationMin;
    
            if (
                matchEndMin > slotFromMin &&
                matchEndMin < slotToMin &&
                matchEndMin <= slotMidMin
            ) {
                continue;
            }
    
            if (
                matchStartMin >= slotMidMin &&
                matchStartMin < slotToMin &&
                matchEndMin > slotToMin
            ) {
                continue;
            }
    
            const overlaps = matchStartMin < slotToMin && matchEndMin > slotFromMin;
            if (overlaps) return true;
        }
    
        return false;
    };

    const superstructureTeamPlaysDuringSlot = (
        placeTeamName,
        placeTeamCategory,
        dayKey,
        slotFrom,
        slotTo
    ) => {
        if (!placeTeamName || !dayKey || !slotFrom || !slotTo) return false;
    
        const slotFromMin = timeToMinutes(slotFrom);
        const slotToMin = timeToMinutes(slotTo);
        if (slotFromMin == null || slotToMin == null) return false;
    
        const slotMidMin = slotFromMin + (slotToMin - slotFromMin) / 2;
    
        const targetCategory = cleanCategory(placeTeamCategory);
        const targetNameRaw = String(placeTeamName || '').trim();
    
        // 🔥 Krátky názov = posledný token (napr. "1A")
        const targetShortName = targetNameRaw.split(/\s+/).pop();
    
        // 🔥 Plný názov = kategória + krátky názov
        const targetFullName = targetCategory && targetShortName
            ? `${targetCategory} ${targetShortName}`
            : targetNameRaw;
    
        // 🔥 Množina povolených variantov
        const targetVariants = new Set();
        if (targetNameRaw) targetVariants.add(targetNameRaw);
        if (targetFullName) targetVariants.add(targetFullName);
        // Ak placeTeamName už obsahuje kategóriu, pridáme aj verziu bez nej
        if (targetCategory && targetNameRaw.startsWith(targetCategory + ' ')) {
            targetVariants.add(targetNameRaw.substring(targetCategory.length + 1).trim());
        }
    
        for (const match of scheduledMatches) {
            if (!match.scheduledTime) continue;
    
            let matchDate;
            try {
                matchDate = match.scheduledTime.toDate
                    ? match.scheduledTime.toDate()
                    : new Date(match.scheduledTime.seconds * 1000);
            } catch (e) {
                continue;
            }
    
            const matchDay = String(matchDate.getDate()).padStart(2, '0');
            const matchMonth = String(matchDate.getMonth() + 1).padStart(2, '0');
            const matchYear = matchDate.getFullYear();
            const matchDayKey = `${matchYear}-${matchMonth}-${matchDay}`;
    
            if (matchDayKey !== dayKey) continue;
    
            // 🔥 Kategória zápasu
            const matchCategory = cleanCategory(
                match.categoryName ||
                (match.categoryId && window.categoriesData
                    ? window.categoriesData[match.categoryId]
                    : '')
            );
    
            // 🔥 AK SA KATEGÓRIE NEZHODUJÚ → preskočíme
            if (matchCategory && targetCategory && matchCategory !== targetCategory) {
                continue;
            }
    
            const matchTeamIdentifiers = [
                match.homeTeamIdentifier,
                match.awayTeamIdentifier,
                match.homeTeamName,
                match.awayTeamName,
            ].filter(Boolean);
    
            const isTeamInMatch = matchTeamIdentifiers.some((identifier) => {
                const idStr = String(identifier).trim();
                if (!idStr) return false;
    
                // 1) Priama zhoda
                if (targetVariants.has(idStr)) return true;
    
                // 2) Cez teamManager
                if (
                    window.teamManager &&
                    typeof window.teamManager.getTeamNameByDisplayIdSync === 'function'
                ) {
                    try {
                        const resolved = window.teamManager.getTeamNameByDisplayIdSync(identifier);
                        if (resolved) {
                            const resolvedStr = String(resolved).trim();
                            if (targetVariants.has(resolvedStr)) return true;
                            if (targetCategory && targetVariants.has(`${targetCategory} ${resolvedStr}`)) {
                                return true;
                            }
                        }
                    } catch (e) {
                        /* ignore */
                    }
                }
    
                // 3) Fallback: identifier začína kategóriou a končí krátkym názvom
                if (targetShortName && targetCategory) {
                    const idStartsWithCategory = idStr.startsWith(targetCategory + ' ') || idStr === targetCategory;
                    const idEndsWithShort = idStr.endsWith(targetShortName) || idStr.includes(` ${targetShortName}`);
    
                    if (idStartsWithCategory && idEndsWithShort) return true;
                }
    
                return false;
            });
    
            if (!isTeamInMatch) continue;
    
            const matchStartMin = matchDate.getHours() * 60 + matchDate.getMinutes();
    
            let matchDurationMin = match.duration;
            if (matchDurationMin == null) {
                const category = categories.find((c) => c.name === matchCategory);
                if (category) {
                    const periods = category.periods || 2;
                    const periodDuration = category.periodDuration || 20;
                    const breakDuration = category.breakDuration || 2;
                    matchDurationMin =
                        (periodDuration + breakDuration) * periods - breakDuration;
                } else {
                    matchDurationMin = 0;
                }
            }
    
            const matchEndMin = matchStartMin + matchDurationMin;
    
            if (
                matchEndMin > slotFromMin &&
                matchEndMin < slotToMin &&
                matchEndMin <= slotMidMin
            ) {
                continue;
            }
    
            if (
                matchStartMin >= slotMidMin &&
                matchStartMin < slotToMin &&
                matchEndMin > slotToMin
            ) {
                continue;
            }
    
            const overlaps = matchStartMin < slotToMin && matchEndMin > slotFromMin;
            if (overlaps) return true;
        }
    
        return false;
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

    const getAssignedCountForPlace = (placeId, dayKey, mealType, slotFrom) => {
        const key = `${placeId}|${dayKey}|${mealType}|${slotFrom}`;
        const raw = placeCountsBySlot.get(key) || 0;
        return Number.isInteger(raw) ? raw : Math.ceil(raw);
    };

    const teamHasAnyAssignmentInRow = (team, dayKey, mealType) => {
        if (!team) return false;

        const teamCat = cleanCategory(team.category);

        // 1) Klasické priradenie – musí sedieť aj kategória
        const hasClassic = (cateringAssignments || []).some(
            (a) =>
                a.isSuperstructure !== true &&
                a.teamUid === team.uid &&
                a.teamIndex === team.teamIndex &&
                cleanCategory(a.category || a.categoryName) === teamCat &&
                a.dayKey === dayKey &&
                a.mealType === mealType
        );
        if (hasClassic) return true;

        // 2) Superstructure priradenie (kliknuté týmto tímom) – musí sedieť aj kategória
        const hasSS = (cateringAssignments || []).some(
            (a) =>
                a.isSuperstructure === true &&
                a.clickedTeamUid === team.uid &&
                a.clickedTeamIndex === team.teamIndex &&
                cleanCategory(a.clickedTeamCategory) === teamCat &&
                a.dayKey === dayKey &&
                a.mealType === mealType
        );
        return hasSS;
    };

        const placeCountsBySlot = React.useMemo(() => {
        const counts = new Map();
    
        // 🔥 Pomocná funkcia – zisti, či dané superstructure priradenie v danom slote hrá zápas
        const superstructurePlaysInSlot = (ss, dayKey, slotFrom, slotTo) => {
            return superstructureTeamPlaysDuringSlot(
                ss.teamName || ss.teamIdentifier,
                ss.category,
                dayKey,
                slotFrom,
                slotTo
            );
        };
    
        const findSS = (team, dayKey, mealType, slotFrom) => {
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
    
        const findCL = (team, dayKey, mealType, slotFrom) => {
            const cat = cleanCategory(team.category);
            const key = `${team.uid}|${team.teamIndex}|${cat}|${dayKey}|${mealType}|${slotFrom}`;
            return assignmentsBySlot.get(key) || null;
        };
    
        (userTeams || []).forEach((team) => {
            Object.entries(daySlots).forEach(([dayKey, meals]) => {
                ['lunch', 'dinner'].forEach((mealType) => {
                    // 🔥 Predpočítame pre CELÝ RIADOK (tím + deň + jedlo):
                    //    - či tím hrá v tomto slote
                    //    - či má v riadku vôbec nejaké priradenie
                    //    - či nejaké superstructure priradenie v riadku hrá v tomto slote
                    const hasAnyAssignmentInRow = teamHasAnyAssignmentInRow(team, dayKey, mealType);
    
                    const allSuperstructureInRow = findAllSuperstructureAssignmentsForRow(
                        team, dayKey, mealType
                    );
    
                    (meals[mealType] || []).forEach((slot) => {
                        const isPlaying = teamPlaysDuringSlot(team, dayKey, slot.from, slot.to);
    
                        const superstructureIsPlayingForForceDash = allSuperstructureInRow.some(
                            (ss) => superstructurePlaysInSlot(ss, dayKey, slot.from, slot.to)
                        );
    
                        const forceDash =
                            (isPlaying && hasAnyAssignmentInRow) ||
                            superstructureIsPlayingForForceDash;
    
                        // 🔥 Ak je v riadku forceDash, bunka sa v tabuľke zobrazí ako "−",
                        //    takže priradenie sa NESMIE započítať do súčtu pre miesto.
                        if (forceDash) return;
    
                        const ss = findSS(team, dayKey, mealType, slot.from);
                        if (ss) {
                            const ssCategory = cleanCategory(ss.categoryName || ss.category);
                            const avg = superstructureAvgByCategory.get(ssCategory);
                            if (avg == null) return;
                            const key = `${ss.placeId}|${dayKey}|${mealType}|${slot.from}`;
                            counts.set(key, (counts.get(key) || 0) + avg);
                            return;
                        }
    
                        const cl = findCL(team, dayKey, mealType, slot.from);
                        if (cl) {
                            const members = (team.playersCount || 0) + (team.othersCount || 0);
                            const key = `${cl.placeId}|${dayKey}|${mealType}|${slot.from}`;
                            counts.set(key, (counts.get(key) || 0) + members);
                        }
                    });
                });
            });
        });
    
        return counts;
    }, [
        cateringAssignments,
        userTeams,
        superstructureTeams,
        daySlots,
        assignmentsBySlot,
        superstructureAvgByCategory,
        scheduledMatches,
        categories,
    ]);

    const getDailyAssignedCountForPlace = (placeId, dayKey, mealType) => {
        const slots = daySlots[dayKey]?.[mealType] || [];
        let total = 0;
        slots.forEach((slot) => {
            const key = `${placeId}|${dayKey}|${mealType}|${slot.from}`;
            total += placeCountsBySlot.get(key) || 0;  // presné hodnoty
        });
        return Number.isInteger(total) ? total : Math.ceil(total);
    };

    // Otvorí modálne okno pre priradenie
    const openCateringModal = (team, day, mealType, slot) => {
        // 🔥 NOVÉ: Spočítame VŠETKY priradenia v riadku (klasické + superstructure)
        // pre konkrétny tím + deň + typ jedla (všetky časy stravovania).
        const allSuperstructureInRow = findAllSuperstructureAssignmentsForRow(
            team, day.key, mealType
        );
        const teamCat = cleanCategory(team.category);
        const allClassicInRow = cateringAssignments.filter(
            (a) =>
                a.isSuperstructure !== true &&
                a.teamUid === team.uid &&
                a.teamIndex === team.teamIndex &&
                cleanCategory(a.category || a.categoryName) === teamCat &&
                a.dayKey === day.key &&
                a.mealType === mealType
        );
        const totalAssignedInRow = allSuperstructureInRow.length + allClassicInRow.length;
    
        // 1a) Superstructure priradenie pre túto konkrétnu bunku
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
        
            // 🔥 NOVÉ: Zistíme, či v riadku existuje INÉ superstructure priradenie
            //    (okrem tohto kliknutého). Ak NIE, checkbox pre prioritu sa nezobrazí.
            const otherSuperstructureInRow = allSuperstructureInRow.filter(
                (a) => a.id !== superstructureExisting.id
            );
            const hasOtherSuperstructureInRow = otherSuperstructureInRow.length > 0;
        
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
                isPriority: false,
                // 🔥 Checkbox zobrazíme LEN ak v riadku existuje iné superstructure priradenie
                showPriorityCheckbox: hasOtherSuperstructureInRow,
            });
            setCateringModalIsPriority(superstructureExisting.isPriority === true);
            setSelectedCateringPlaceId(superstructureExisting.placeId || '');
            setShowCateringModal(true);
            return;
        }
    
        // 1b) Klasické priradenie pre túto konkrétnu bunku
        const existingClassic = findCateringAssignment(team, day.key, mealType, slot.from);
        if (existingClassic) {
            setSelectedCateringCell({
                team,
                dayKey: day.key,
                dayLabel: day.fullLabelNumeric,
                mealType,
                slotFrom: slot.from,
                slotTo: slot.to,
                existingId: existingClassic.id || null,
                isSuperstructure: false,
                showPriorityCheckbox: false,
            });
            setSelectedCateringPlaceId(existingClassic.placeId || '');
            setCateringModalIsPriority(false);
            setShowCateringModal(true);
            return;
        }
    
        // ============================================================
        // 🔥 Až teraz: Ak bunka NEMÁ existujúce priradenie, aplikujeme
        //    pravidlo maximálne 2 priradených tímov v riadku.
        // ============================================================
    
        // Ak totalAssignedInRow >= 2 → automaticky modálne okno "Vyberte tím na preplánovanie".
        if (totalAssignedInRow >= 2) {
            const items = [];
    
            // Najprv superstructure priradenia
            allSuperstructureInRow.forEach((a) => {
                const placeTeam = superstructureTeams.find((t) => t.id === a.teamIndex) || {
                    id: a.teamIndex,
                    teamName: a.teamName,
                    category: a.category,
                    groupName: a.groupName || null,
                };
                items.push({ assignment: a, placeTeam, isClassic: false });
            });
    
            // Potom klasické priradenia
            allClassicInRow.forEach((a) => {
                items.push({
                    assignment: a,
                    placeTeam: {
                        id: a.teamUid + '-' + a.teamIndex,
                        teamName: a.teamName || team.teamName,
                        category: a.categoryName || a.category,
                        groupName: null,
                    },
                    isClassic: true,
                });
            });
    
            setPendingSuperstructureDecision({
                type: 'row',
                team,
                day,
                mealType,
                slot,
                existingId: null,
                placeTeam: null,
                existingAssignment: null,
            });
    
            setSuperstructureReplanPickerItems(items);
            setShowSuperstructureReplanPickerModal(true);
            return;
        }
    
        // 🔥 Ak totalAssignedInRow < 2 → pokračujeme pôvodnou logikou.
    
        // 2) Ak v TOM ISTOM RIADKU existuje SUPERSTRUCTURE priradenie v INOM SLOTE
        //    → otvoríme ROZHODOVACIE modálne okno "Superstructure priradenie".
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
    
        // 3) Ak tím NEMÁ ŽIADNY balík → otvoríme ROVNO modálne okno
        if (!teamHasAnyPackage(team)) {
            setPendingAssignmentCell({ team, day, mealType, slot });
            setSelectedPlaceTeamId(''); 
            setPlaceAssignmentSearch('');
            setShowAssignmentTypeModal(false);
            setShowPlaceAssignmentModal(true);
            return;
        }
    
        // 4) Tím MÁ balík, ale NEMÁ daný typ stravovania v balíku
        if (!teamHasMealInPackage(team, day.key, mealType)) {
            setPendingAssignmentCell({ team, day, mealType, slot });
            setSelectedPlaceTeamId('');
            setPlaceAssignmentSearch('');
            setShowAssignmentTypeModal(false);
            setShowPlaceAssignmentModal(true);
            return;
        }
    
        // 5) Tím MÁ balík AJ daný typ stravovania → otvoríme modálne okno s výberom typu.
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
    
        // 🔥 Vždy otvor modálne okno bez predvyplneného tímu
        setSelectedPlaceTeamId('');
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
        // Klasické priradenie pre tím (pôvodné správanie)
        const teamCat = cleanCategory(cell.team.category);
        return {
            teamUid: cell.team.uid,
            teamIndex: cell.team.teamIndex,
            category: teamCat,
            categoryName: teamCat,
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

    // 🔥 NOVÉ: Používateľ vybral konkrétne priradenie na preplánovanie
    const handlePickSuperstructureReplan = (item) => {
        if (!pendingSuperstructureDecision || !item) return;
    
        const { team, day, mealType, slot } = pendingSuperstructureDecision;
        const { assignment, placeTeam, isClassic } = item;
    
        if (isClassic) {
            // 🔥 Klasické priradenie → otvoríme klasické modálne okno
            setSelectedCateringCell({
                team,
                dayKey: day.key,
                dayLabel: day.fullLabelNumeric,
                mealType,
                slotFrom: assignment.slotFrom || slot.from,
                slotTo: assignment.slotTo || slot.to,
                existingId: assignment.id || null,
                // NIE je superstructure
            });
            setSelectedCateringPlaceId(assignment.placeId || '');
            setCateringModalIsPriority(false);
            setShowSuperstructureReplanPickerModal(false);
            setSuperstructureReplanPickerItems([]);
            setPendingSuperstructureDecision(null);
            setShowCateringModal(true);
            return;
        }
    
        // 🔥 Superstructure priradenie
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
            isPriority: false,
            showPriorityCheckbox: true,
        });
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
    
    const handleSuperstructurePriority = () => {
        if (!pendingSuperstructureDecision) return;
        const { team, day, mealType, slot } = pendingSuperstructureDecision;

        setPendingAssignmentCell({ team, day, mealType, slot });
        setSelectedPlaceTeamId('');
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
    
            if (selectedCateringCell.existingId) {
                // 🔥 Pri preplánovaní vždy AKTUALIZUJEME existujúci záznam (žiadna duplikácia).
                const oldAssignment = cateringAssignments.find(
                    (a) => a.id === selectedCateringCell.existingId
                );
                const oldWasPriority = oldAssignment?.isPriority === true;
            
                const newIsPriority = !!cateringModalIsPriority;
            
                const updatePayload = { ...payload, isPriority: newIsPriority };
            
                // 1) Aktualizujeme tento záznam (priorita sa pridá alebo odstráni)
                await updateDoc(
                    doc(window.db, 'catering', selectedCateringCell.existingId),
                    updatePayload
                );
            
                // 2) 🔥 Zistíme VŠETKY ostatné superstructure priradenia v tom istom riadku
                //    (tím + deň + typ jedla), okrem tohto aktuálneho.
                const payloadClickedCat = cleanCategory(payload.clickedTeamCategory);
                const siblings = cateringAssignments.filter(
                    (a) =>
                        a.isSuperstructure === true &&
                        a.id !== selectedCateringCell.existingId &&
                        a.clickedTeamUid === payload.clickedTeamUid &&
                        a.clickedTeamIndex === payload.clickedTeamIndex &&
                        cleanCategory(a.clickedTeamCategory) === payloadClickedCat &&
                        a.dayKey === payload.dayKey &&
                        a.mealType === payload.mealType
                );
            
                if (newIsPriority) {
                    // 🔥 NOVÉ: Ak NOVÝ záznam má byť prioritný → ostatným v riadku
                    //    MUSÍME odstrániť prioritu (aby bola len jedna).
                    for (const sib of siblings) {
                        if (sib.isPriority === true) {
                            await updateDoc(doc(window.db, 'catering', sib.id), {
                                isPriority: false,
                            });
                        }
                    }
                    window.showGlobalNotification(
                        'Priorita bola presunutá na tento tím.',
                        'success'
                    );
                } else if (oldWasPriority && !newIsPriority) {
                    // 🔥 Ak STARÝ záznam bol prioritný a NOVÝ nemá byť prioritný
                    //    → musíme nájsť iné superstructure priradenie v tom istom riadku
                    //    a tomu nastaviť isPriority: true.
                    if (siblings.length > 0) {
                        // Nastavíme prioritu prvému inému superstructure priradeniu v riadku
                        await updateDoc(doc(window.db, 'catering', siblings[0].id), {
                            isPriority: true,
                        });
                        window.showGlobalNotification(
                            'Priorita bola presunutá na iný tím v riadku.',
                            'success'
                        );
                    } else {
                        // Žiadny iný tím v riadku → priorita sa jednoducho odstránila
                        window.showGlobalNotification(
                            'Priorita bola odstránená.',
                            'success'
                        );
                    }
                } else {
                    // Nič sa nezmenilo v priorite – len update miesta/času
                    window.showGlobalNotification(
                        'Priradenie bolo preplánované.',
                        'success'
                    );
                }
            
                setShowCateringModal(false);
                setSelectedCateringCell(null);
                setSelectedCateringPlaceId('');
                setCateringModalIsPriority(false);
                setSavingCatering(false);
                return;
            } else {
                // 🔥 NOVÉ: Nové superstructure priradenie (bez existingId).
                // Ak je to nový tím do riadku, kde už existuje iný superstructure tím,
                // a nový NEMÁ prioritu → prioritu dostane existujúci (pôvodný) tím.
                const newIsPriority = !!cateringModalIsPriority;
    
                // Pridáme nový záznam (s prioritou, ak ju má)
                await addDoc(collection(window.db, 'catering'), {
                    ...payload,
                    isPriority: newIsPriority,
                });
    
                // Ak nový NEMÁ prioritu, skontrolujeme, či v riadku existuje iný superstructure tím.
                if (!newIsPriority) {
                    const payloadClickedCat = cleanCategory(payload.clickedTeamCategory);
                    const siblings = cateringAssignments.filter(
                        (a) =>
                            a.isSuperstructure === true &&
                            a.id !== selectedCateringCell.existingId &&
                            a.clickedTeamUid === payload.clickedTeamUid &&
                            a.clickedTeamIndex === payload.clickedTeamIndex &&
                            cleanCategory(a.clickedTeamCategory) === payloadClickedCat &&
                            a.dayKey === payload.dayKey &&
                            a.mealType === payload.mealType
                    );
    
                    if (siblings.length > 0) {
                        // Existuje pôvodný tím v riadku → nastavíme mu prioritu
                        await updateDoc(doc(window.db, 'catering', siblings[0].id), {
                            isPriority: true,
                        });
                        window.showGlobalNotification(
                            'Priorita bola nastavená pôvodnému tímu v riadku.',
                            'success'
                        );
                    } else {
                        window.showGlobalNotification('Priradenie bolo uložené.', 'success');
                    }
                } else {
                    window.showGlobalNotification('Priradenie bolo uložené.', 'success');
                }
    
                setShowCateringModal(false);
                setSelectedCateringCell(null);
                setSelectedCateringPlaceId('');
                setCateringModalIsPriority(false);
                setSavingCatering(false);
                return;
            }
        }
    
        // 🔥 Kategória sa porovnáva cez cleanCategory, aby zhoda fungovala
        //    aj pri NBSP / viacnásobných medzerách v DB.
        const currentCat = cleanCategory(selectedCateringCell.team.category);
        const existingForTeamDayMeal = cateringAssignments.filter(
            (a) =>
                a.isSuperstructure !== true &&
                a.teamUid === selectedCateringCell.team.uid &&
                a.teamIndex === selectedCateringCell.team.teamIndex &&
                cleanCategory(a.category || a.categoryName) === currentCat &&
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
    
        // 🔥 Hľadáme podľa id (identifier), NIE podľa teamName
        const placeTeam = matchTeams.find((t) => t.id === selectedPlaceTeamId);
        if (!placeTeam) {
            window.showGlobalNotification('Vybraný tím sa nenašiel.', 'error');
            return;
        }
    
        // 🔥 ZISTÍME, či v riadku (kliknutý tím + deň + typ jedla) už existuje
        // nejaké superstructure priradenie (okrem tohto nového).
        const existingInRow = findAllSuperstructureAssignmentsForRow(
            team, day.key, mealType
        );
    
        // 🔥 Ak v riadku NEEXISTUJE iné superstructure priradenie →
        //    checkbox sa nezobrazí a priorita sa nenastaví.
        const hasOtherAssignmentInRow = existingInRow.length > 0;
    
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
            // 🔥 Checkbox zobrazíme LEN ak v riadku existuje iné priradenie
            showPriorityCheckbox: hasOtherAssignmentInRow,
        });
    
        // 🔥 Predvyplníme checkbox na true LEN ak je čo prioritizovať
        setCateringModalIsPriority(hasOtherAssignmentInRow);
        setSelectedCateringPlaceId('');
        setShowPlaceAssignmentModal(false);
        setShowCateringModal(true);
    };

    const deleteCateringAssignment = async () => {
        if (!selectedCateringCell?.existingId || !window.db) return;
        setSavingCatering(true);
        try {
            // 🔥 Zapamätáme si kontext MAZANÉHO záznamu, aby sme po zmazaní
            //    mohli skontrolovať, či v riadku nezostalo len 1 priradenie.
            const deletedAssignment = cateringAssignments.find(
                (a) => a.id === selectedCateringCell.existingId
            );
    
            // 1) Zmažeme záznam
            await deleteDoc(doc(window.db, 'catering', selectedCateringCell.existingId));
    
            // 2) 🔥 NOVÉ: Ak sme mazali SUPERSTRUCTURE priradenie, skontrolujeme,
            //    či v tom istom riadku (kliknutý tím + deň + typ jedla) nezostalo
            //    len JEDNO superstructure priradenie. Ak áno a má isPriority: true,
            //    automaticky mu prioritu odstránime.
            if (
                selectedCateringCell.isSuperstructure &&
                deletedAssignment &&
                deletedAssignment.isSuperstructure === true
            ) {
                const deletedCat = cleanCategory(deletedAssignment.clickedTeamCategory);
                const remainingInRow = cateringAssignments.filter(
                    (a) =>
                        a.isSuperstructure === true &&
                        a.id !== selectedCateringCell.existingId &&
                        a.clickedTeamUid === deletedAssignment.clickedTeamUid &&
                        a.clickedTeamIndex === deletedAssignment.clickedTeamIndex &&
                        cleanCategory(a.clickedTeamCategory) === deletedCat &&
                        a.dayKey === deletedAssignment.dayKey &&
                        a.mealType === deletedAssignment.mealType
                );
    
                // Ak zostalo len JEDNO superstructure priradenie v riadku a má prioritu
                // → odstránime mu prioritu (priorita má zmysel len pri 2+ tímoch).
                if (remainingInRow.length === 1 && remainingInRow[0].isPriority === true) {
                    await updateDoc(doc(window.db, 'catering', remainingInRow[0].id), {
                        isPriority: false,
                    });
                    window.showGlobalNotification(
                        'Superstructure priradenie bolo odstránené. Priorita zvyšného tímu bola automaticky zrušená.',
                        'success'
                    );
                } else {
                    window.showGlobalNotification(
                        'Superstructure priradenie bolo odstránené.',
                        'success'
                    );
                }
            } else {
                const message = selectedCateringCell.isSuperstructure
                    ? 'Superstructure priradenie bolo odstránené.'
                    : 'Priradenie bolo odstránené.';
                window.showGlobalNotification(message, 'success');
            }
    
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
                                    // 🔥 Hrubá čiara za obedom VŽDY
                                    const lunchHasThickRight = true;
                                    parts.push(
                                        React.createElement(
                                            'th',
                                            {
                                                key: `lunch-header-${index}`,
                                                colSpan: lunchColSpan,
                                                className:
                                                    'border border-gray-300 bg-blue-50 px-2 py-1 text-center font-semibold text-blue-700 text-xs border-r-4 border-r-gray-500',
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
                                    // 🔥 Hrubá čiara za posledným obedovým slotom VŽDY (ak nie je „∑ Obed")
                                    const hasThickRight = isLastLunchSlot && !hasLunchSummary;
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
                                    // 🔥 Hrubá čiara za „∑ Obed" VŽDY
                                    parts.push(
                                        React.createElement(
                                            'th',
                                            {
                                                key: `lunch-summary-${dayIndex}`,
                                                className:
                                                    'border border-gray-300 bg-amber-100 px-2 py-1 text-center text-[11px] font-bold text-amber-800 whitespace-nowrap min-w-[70px] border-r-4 border-r-gray-500',
                                                title: 'Denný súčet obeda',
                                            },
                                            '∑'
                                        )
                                    );
                                }

                                // Večerové sloty
                                dinnerSlots.forEach((slot, i) => {
                                    const isLastDinnerSlot = i === dinnerSlots.length - 1;
                                    // 🔥 Hrubá čiara za posledným večerovým slotom VŽDY (ak nie je „∑ Večera")
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
                                    // 🔥 Hrubá čiara za „∑ Večera" VŽDY
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
                                              const hasThickRight = isLastLunchCell;
                                          
                                              const isPlaying = teamPlaysDuringSlot(team, day.key, slot.from, slot.to);

                                              const existing = findCateringAssignment(team, day.key, 'lunch', slot.from);
                                              const superstructureAssignment = findSuperstructureAssignmentForCell(team, day.key, 'lunch', slot.from);

                                              // 🔥 NOVÉ: Zisti, či NIEKTORÉ superstructure priradenie v tomto RIADKU hrá v tomto slote
                                              const allSuperstructureInRow = findAllSuperstructureAssignmentsForRow(team, day.key, 'lunch');
                                              const superstructureIsPlayingForForceDash = allSuperstructureInRow.some((ss) =>
                                                  superstructureTeamPlaysDuringSlot(
                                                      ss.teamName || ss.teamIdentifier,
                                                      ss.category,
                                                      day.key,
                                                      slot.from,
                                                      slot.to
                                                  )
                                              );

                                              const hasAnyAssignmentInRow = teamHasAnyAssignmentInRow(team, day.key, 'lunch');
                                              const forceDash = (isPlaying && hasAnyAssignmentInRow) || superstructureIsPlayingForForceDash;
                                          
                                              const effectiveExisting = forceDash ? null : existing;
                                              const effectiveSuperstructure = forceDash ? null : superstructureAssignment;
                                              const hasAnyAssignment = !!effectiveExisting || !!effectiveSuperstructure;
                                          
                                              const colors = effectiveExisting
                                                  ? getCateringPlaceColors(effectiveExisting.placeId)
                                                  : null;
                                              const teamTotal = (team.playersCount || 0) + (team.othersCount || 0);
                                          
                                              const hasMealInPackage = teamHasMealInPackage(team, day.key, 'lunch');
                                          
                                              // 🔥 Klikateľnosť: ak je forceDash, bunka je neklikateľná (ako pri hre bez priradenia)
                                              const canClick = forceDash ? false : (hasAnyAssignment ? true : !isPlaying);
                                          
                                              const displaySuperstructureName = effectiveSuperstructure
                                                  ? getPlaceTeamDisplayName(
                                                        effectiveSuperstructure.teamName,
                                                        effectiveSuperstructure.category
                                                    )
                                                  : null;
                                              const superstructureColors = effectiveSuperstructure
                                                  ? getCateringPlaceColors(effectiveSuperstructure.placeId)
                                                  : null;
                                          
                                              const superstructureIsPlaying = effectiveSuperstructure
                                                  ? superstructureTeamPlaysDuringSlot(
                                                        effectiveSuperstructure.teamName ||
                                                            effectiveSuperstructure.teamIdentifier,
                                                        effectiveSuperstructure.category,
                                                        day.key,
                                                        slot.from,
                                                        slot.to
                                                    )
                                                  : false;
                                          
                                              let cellClass =
                                                  'border border-gray-300 px-2 py-2 text-center text-xs min-w-[70px] transition ';
                                          
                                              if (forceDash) {
                                                  // 🔥 Tím hrá a má priradenie v riadku → zobrazí sa "−" ako pri hre bez priradenia
                                                  cellClass += 'bg-gray-100 text-gray-500 cursor-not-allowed ';
                                              } else if (hasAnyAssignment) {
                                                  cellClass += 'cursor-pointer ';
                                                  if (effectiveExisting && colors) {
                                                      // klasické priradenie
                                                  } else if (effectiveSuperstructure) {
                                                      if (superstructureIsPlaying) {
                                                          cellClass += 'font-bold text-red-600 ';
                                                      } else if (effectiveSuperstructure.isPriority) {
                                                          cellClass += 'font-bold ';
                                                      }
                                                  }
                                              } else if (isPlaying) {
                                                  cellClass += 'bg-gray-100 text-gray-500 cursor-not-allowed ';
                                              } else {
                                                  cellClass += 'cursor-pointer ';
                                                  if (hasMealInPackage) {
                                                      cellClass += 'text-gray-500 hover:bg-blue-50 ';
                                                  } else {
                                                      cellClass += 'bg-gray-100 text-gray-500 hover:bg-green-50 ';
                                                  }
                                              }
                                              cellClass += (hasThickRight ? 'border-r-4 border-r-gray-500' : '');
                                          
                                              // Obsah bunky
                                              let cellContent;
                                              if (forceDash) {
                                                  cellContent = '-';
                                              } else if (effectiveExisting) {
                                                  cellContent = teamTotal;
                                              } else if (displaySuperstructureName) {
                                                  cellContent = displaySuperstructureName;
                                              } else if (isPlaying) {
                                                  cellContent = '-';
                                              } else {
                                                  cellContent = hasMealInPackage ? '' : '–';
                                              }
                                          
                                              // Title (tooltip)
                                              let cellTitle;
                                              if (forceDash) {
                                                  cellTitle = `Tím hrá zápas v čase ${slot.from} – ${slot.to}`;
                                              } else if (effectiveExisting) {
                                                  cellTitle = `${effectiveExisting.placeName} (${slot.from} – ${slot.to})`;
                                              } else if (effectiveSuperstructure) {
                                                  cellTitle = `${effectiveSuperstructure.teamName} (${slot.from} – ${slot.to})`;
                                              } else if (isPlaying) {
                                                  cellTitle = `Tím hrá zápas v čase ${slot.from} – ${slot.to}`;
                                              } else if (hasMealInPackage) {
                                                  cellTitle = `Kliknutím priradíte miesto (${slot.from} – ${slot.to})`;
                                              } else {
                                                  cellTitle = `Tím nemá v balíku '${team.packageName}' obed pre ${day.fullLabelNumeric}. Kliknutím priradíte podľa umiestnenia.`;
                                              }
                                          
                                              cells.push(
                                                  React.createElement(
                                                      'td',
                                                      {
                                                          key: `cell-lunch-${rowIndex}-${dayIndex}-${i}`,
                                                          onClick: canClick
                                                              ? () => openCateringModal(team, day, 'lunch', slot)
                                                              : undefined,
                                                          className: cellClass,
                                                          style: effectiveExisting && colors
                                                              ? {
                                                                    backgroundColor: colors.bg,
                                                                    color: colors.text,
                                                                }
                                                              : effectiveSuperstructure && superstructureColors
                                                                  ? {
                                                                        backgroundColor: superstructureColors.bg,
                                                                        color: superstructureIsPlaying
                                                                            ? '#dc2626'
                                                                            : superstructureColors.text,
                                                                        ...(superstructureIsPlaying
                                                                            ? { fontWeight: 'bold' }
                                                                            : effectiveSuperstructure.isPriority
                                                                                ? { border: '4px solid #000000', fontWeight: 'bold' }
                                                                                : {}),
                                                                    }
                                                                  : {},
                                                          title: cellTitle,
                                                      },
                                                      cellContent
                                                  )
                                              );
                                          }

                                          if (shouldShowMealType('lunch') && lunchCount > 0) {
                                              // 🔥 Hrubá čiara za prázdnou obedovou summary bunkou VŽDY
                                              const hasThickRight = true;
                                              cells.push(
                                                  React.createElement('td', {
                                                      key: `empty-lunch-summary-${rowIndex}-${dayIndex}`,
                                                      className:
                                                          'border border-gray-300 px-2 py-2 text-center text-xs min-w-[70px] border-r-4 border-r-gray-500',
                                                  })
                                              );
                                          }

                                          for (let i = 0; i < dinnerCount; i++) {
                                              const slot = daySlots[day.key].dinner[i];
                                              const isLastDinnerCell = i === dinnerCount - 1;
                                              const hasThickRight = isLastDinnerCell;
                                          
                                              const isPlaying = teamPlaysDuringSlot(team, day.key, slot.from, slot.to);

                                              const existing = findCateringAssignment(team, day.key, 'dinner', slot.from);
                                              const superstructureAssignment = findSuperstructureAssignmentForCell(team, day.key, 'dinner', slot.from);

                                              // 🔥 NOVÉ: Zisti, či NIEKTORÉ superstructure priradenie v tomto RIADKU hrá v tomto slote
                                              const allSuperstructureInRow = findAllSuperstructureAssignmentsForRow(team, day.key, 'dinner');
                                              const superstructureIsPlayingForForceDash = allSuperstructureInRow.some((ss) =>
                                                  superstructureTeamPlaysDuringSlot(
                                                      ss.teamName || ss.teamIdentifier,
                                                      ss.category,
                                                      day.key,
                                                      slot.from,
                                                      slot.to
                                                  )
                                              );

                                              const hasAnyAssignmentInRow = teamHasAnyAssignmentInRow(team, day.key, 'dinner');
                                              const forceDash = (isPlaying && hasAnyAssignmentInRow) || superstructureIsPlayingForForceDash;
                                          
                                              const effectiveExisting = forceDash ? null : existing;
                                              const effectiveSuperstructure = forceDash ? null : superstructureAssignment;
                                              const hasAnyAssignment = !!effectiveExisting || !!effectiveSuperstructure;
                                          
                                              const colors = effectiveExisting
                                                  ? getCateringPlaceColors(effectiveExisting.placeId)
                                                  : null;
                                              const teamTotal = (team.playersCount || 0) + (team.othersCount || 0);
                                          
                                              const hasMealInPackage = teamHasMealInPackage(team, day.key, 'dinner');
                                              const canClick = forceDash ? false : (hasAnyAssignment ? true : !isPlaying);
                                          
                                              const displaySuperstructureName = effectiveSuperstructure
                                                  ? getPlaceTeamDisplayName(
                                                        effectiveSuperstructure.teamName,
                                                        effectiveSuperstructure.category
                                                    )
                                                  : null;
                                              const superstructureColors = effectiveSuperstructure
                                                  ? getCateringPlaceColors(effectiveSuperstructure.placeId)
                                                  : null;
                                          
                                              const superstructureIsPlaying = effectiveSuperstructure
                                                  ? superstructureTeamPlaysDuringSlot(
                                                        effectiveSuperstructure.teamName ||
                                                            effectiveSuperstructure.teamIdentifier,
                                                        effectiveSuperstructure.category,
                                                        day.key,
                                                        slot.from,
                                                        slot.to
                                                    )
                                                  : false;
                                          
                                              let cellClass =
                                                  'border border-gray-300 px-2 py-2 text-center text-xs min-w-[70px] transition ';
                                          
                                              if (forceDash) {
                                                  cellClass += 'bg-gray-100 text-gray-500 cursor-not-allowed ';
                                              } else if (hasAnyAssignment) {
                                                  cellClass += 'cursor-pointer ';
                                                  if (effectiveExisting && colors) {
                                                      // klasické
                                                  } else if (effectiveSuperstructure) {
                                                      if (superstructureIsPlaying) {
                                                          cellClass += 'font-bold text-red-600 ';
                                                      } else if (effectiveSuperstructure.isPriority) {
                                                          cellClass += 'font-bold ';
                                                      }
                                                  }
                                              } else if (isPlaying) {
                                                  cellClass += 'bg-gray-100 text-gray-500 cursor-not-allowed ';
                                              } else {
                                                  cellClass += 'cursor-pointer ';
                                                  if (hasMealInPackage) {
                                                      cellClass += 'text-gray-500 hover:bg-blue-50 ';
                                                  } else {
                                                      cellClass += 'bg-gray-100 text-gray-500 hover:bg-green-50 ';
                                                  }
                                              }
                                              cellClass += (hasThickRight ? 'border-r-4 border-r-gray-500' : '');
                                          
                                              let cellContent;
                                              if (forceDash) {
                                                  cellContent = '-';
                                              } else if (effectiveExisting) {
                                                  cellContent = teamTotal;
                                              } else if (displaySuperstructureName) {
                                                  cellContent = displaySuperstructureName;
                                              } else if (isPlaying) {
                                                  cellContent = '-';
                                              } else {
                                                  cellContent = hasMealInPackage ? '' : '–';
                                              }
                                          
                                              let cellTitle;
                                              if (forceDash) {
                                                  cellTitle = `Tím hrá zápas v čase ${slot.from} – ${slot.to}`;
                                              } else if (effectiveExisting) {
                                                  cellTitle = `${effectiveExisting.placeName} (${slot.from} – ${slot.to})`;
                                              } else if (effectiveSuperstructure) {
                                                  cellTitle = `${effectiveSuperstructure.teamName} (${slot.from} – ${slot.to})`;
                                              } else if (isPlaying) {
                                                  cellTitle = `Tím hrá zápas v čase ${slot.from} – ${slot.to}`;
                                              } else if (hasMealInPackage) {
                                                  cellTitle = `Kliknutím priradíte miesto (${slot.from} – ${slot.to})`;
                                              } else {
                                                  cellTitle = `Tím nemá v balíku '${team.packageName}' večeru pre ${day.fullLabelNumeric}. Kliknutím priradíte podľa umiestnenia.`;
                                              }
                                          
                                              cells.push(
                                                  React.createElement(
                                                      'td',
                                                      {
                                                          key: `cell-dinner-${rowIndex}-${dayIndex}-${i}`,
                                                          onClick: canClick
                                                              ? () => openCateringModal(team, day, 'dinner', slot)
                                                              : undefined,
                                                          className: cellClass,
                                                          style: effectiveExisting && colors
                                                              ? {
                                                                    backgroundColor: colors.bg,
                                                                    color: colors.text,
                                                                }
                                                              : effectiveSuperstructure && superstructureColors
                                                                  ? {
                                                                        backgroundColor: superstructureColors.bg,
                                                                        color: superstructureIsPlaying
                                                                            ? '#dc2626'
                                                                            : superstructureColors.text,
                                                                        ...(superstructureIsPlaying
                                                                            ? { fontWeight: 'bold' }
                                                                            : effectiveSuperstructure.isPriority
                                                                                ? { border: '4px solid #000000', fontWeight: 'bold' }
                                                                                : {}),
                                                                    }
                                                                  : {},
                                                          title: cellTitle,
                                                      },
                                                      cellContent
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
                                        // 🔥 Hrubá čiara za posledným obedovým slotom v summary VŽDY
                                        const hasThickRight = isLastLunchCell;
                                        const count = getAssignedCountForPlace(place.id, day.key, 'lunch', slot.from);
                                        // 🔥 Kontrola kapacity LEN pre konkrétny časový slot
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
                                        // 🔥 NOVÉ: Pre denný súčet sa kapacita NEKONTROLUJE
                                        //    (kapacita sa kontroluje iba pre konkrétny čas)
                                        // 🔥 Hrubá čiara za „∑ Obed" VŽDY
                                        cells.push(React.createElement(
                                            'td',
                                            {
                                                key: `summary-daily-${place.id}-lunch-${dayIndex}`,
                                                className:
                                                    'border border-gray-300 px-2 py-2 text-center text-sm font-bold min-w-[70px] border-r-4 border-r-gray-500',
                                                style: dailyLunchTotal > 0
                                                    ? {
                                                          backgroundColor: colors.bg,
                                                          color: colors.text,
                                                      }
                                                    : {},
                                                title: `Denný súčet obeda pre ${place.name}: ${dailyLunchTotal}`,
                                            },
                                            dailyLunchTotal > 0 ? dailyLunchTotal : ''
                                        ));
                                    }
                                
                                    dinnerSlots.forEach((slot, i) => {
                                        const isLastDinnerCell = i === dinnerSlots.length - 1;
                                        // 🔥 Hrubá čiara za posledným večerovým slotom VŽDY
                                        const hasThickRight = isLastDinnerCell;
                                        const count = getAssignedCountForPlace(place.id, day.key, 'dinner', slot.from);
                                        // 🔥 Kontrola kapacity LEN pre konkrétny časový slot
                                        const overCapacity = placeCapacity != null && count > placeCapacity;
                                
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
                                
                                    if (shouldShowMealType('dinner') && dinnerSlots.length > 0) {
                                        const dailyDinnerTotal = getDailyAssignedCountForPlace(place.id, day.key, 'dinner');
                                        // 🔥 NOVÉ: Pre denný súčet sa kapacita NEKONTROLUJE
                                        //    (kapacita sa kontroluje iba pre konkrétny čas)
                                
                                        cells.push(React.createElement(
                                            'td',
                                            {
                                                key: `summary-daily-${place.id}-dinner-${dayIndex}`,
                                                className:
                                                    'border border-gray-300 px-2 py-2 text-center text-sm font-bold min-w-[70px] border-r-4 border-r-gray-500',
                                                style: dailyDinnerTotal > 0
                                                    ? {
                                                          backgroundColor: colors.bg,
                                                          color: colors.text,
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
                        // 🔥 OPRAVA: filtrujeme podľa categoryName, nie podľa teamName
                        const categoryName = cleanCategory(pendingAssignmentCell.team.category);
                        const dayKey = pendingAssignmentCell.day.key;
                        const mealType = pendingAssignmentCell.mealType;
                    
                        const slot = pendingAssignmentCell.slot;

                        const filtered = matchTeams
                            .filter((t) => cleanCategory(t.category) === categoryName)
                            .filter((t) => !isSuperstructureTeamAlreadyAssigned(t.teamName, dayKey, mealType, t.category))
                            .filter((t) => {
                                const displayName = getPlaceTeamDisplayName(t.teamName, t.category) || '';
                                if (/^[A-Za-z]\d+$/.test(displayName)) return false;
                                return true;
                            })
                            // 🔥 NOVÉ: Vyhodí tímy, ktoré v danom čase hrajú zápas
                            .filter((t) => {
                                const resolvedName = t.teamName || t.identifier;
                                return !superstructureTeamPlaysDuringSlot(resolvedName, t.category, dayKey, slot.from, slot.to);
                            })
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
                                    'px-6 py-2.5 rounded-lg transition font-medium ' +
                                    (
                                        savingPlaceAssignment || !selectedPlaceTeamId
                                            ? 'bg-white text-green-600 border-2 border-green-600 cursor-not-allowed'
                                            : 'bg-green-600 text-white hover:bg-green-700 border-2 border-green-600'
                                    ),
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
