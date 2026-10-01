// catering.js
// Importy pre Firebase funkcie
import { doc, onSnapshot, collection, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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

// ============================================================
// Pomocná funkcia: zistí, či má člen tímu daný typ stravovania v danom dni
// ============================================================
const memberHasMeal = (member, dayKey, mealType, teamPackageDetails) => {
    const memberMealSetting = member?.packageDetails?.meals?.[dayKey]?.[mealType];
    if (memberMealSetting !== undefined) {
        return memberMealSetting === 1 || memberMealSetting === true;
    }
    const teamMealSetting = teamPackageDetails?.meals?.[dayKey]?.[mealType];
    if (teamMealSetting !== undefined) {
        return teamMealSetting === 1 || teamMealSetting === true;
    }
    return true;
};

// ============================================================
// Pomocná funkcia: spočíta koľko členov tímu má daný typ stravovania
// ============================================================
const countMembersWithMeal = (teamData, dayKey, mealType) => {
    if (!teamData) return { players: 0, others: 0 };

    const teamPackageDetails = teamData.packageDetails || null;

    const countInArray = (arr) => {
        if (!Array.isArray(arr)) return 0;
        return arr.filter((member) => memberHasMeal(member, dayKey, mealType, teamPackageDetails)).length;
    };

    const players = countInArray(teamData.playerDetails);
    const menTeamMembers = countInArray(teamData.menTeamMemberDetails);
    const womenTeamMembers = countInArray(teamData.womenTeamMemberDetails);
    const menDrivers = countInArray(teamData.driverDetailsMale);
    const womenDrivers = countInArray(teamData.driverDetailsFemale);

    return {
        players,
        others: menTeamMembers + womenTeamMembers + menDrivers + womenDrivers,
    };
};

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
                    rawTeamData: team,
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

// ============================================================
// Pomocná funkcia: namapuje názov tímu cez matchTracker.getTeamNameByDisplayId
// ============================================================
const resolveTeamName = async (categoryName, teamName) => {
    if (!teamName) return teamName;

    // Kandidát na vstup: "{kategória} {tím}" (ak tam ešte nie je)
    let candidate = teamName;
    if (categoryName && !teamName.includes(categoryName)) {
        candidate = `${categoryName} ${teamName}`;
    }

    if (
        window.matchTracker &&
        typeof window.matchTracker.getTeamNameByDisplayId === 'function'
    ) {
        try {
            const mapped = await window.matchTracker.getTeamNameByDisplayId(candidate);

            // Ak matchTracker vráti niečo iné ako null/undefined/"null",
            // považujeme to za platný výsledok (aj keď sa rovná vstupu – vtedy
            // ho vrátime ako teamName, ale nenastavíme mapu – nižšie).
            if (mapped !== null && mapped !== undefined && mapped !== 'null') {
                return mapped;
            }
        } catch (e) {
            // ignore
        }
    }

    return teamName;
};

const cateringApp = ({ userProfileData }) => {
    // ============================================================
    // 1) VŠETKY useState
    // ============================================================
    const [tournamentDays, setTournamentDays] = useState([]);
    const [userTeams, setUserTeams] = useState([]);
    const [cateringTimes, setCateringTimes] = useState({});
    const [unitMinutes, setUnitMinutes] = useState('');
    const [loading, setLoading] = useState(true);
    const [cateringPlaces, setCateringPlaces] = useState([]);
    const [cateringAssignments, setCateringAssignments] = useState([]);
    const [filterCategory, setFilterCategory] = useState('');
    const [filterDayKey, setFilterDayKey] = useState('');
    const [filterMealType, setFilterMealType] = useState('');
    const [sortMode, setSortMode] = useState('chronological');

    // Mapa namapovaných názvov tímov: kľúč = "kategória||pôvodnýNázov", hodnota = nový názov
    const [teamNameMap, setTeamNameMap] = useState({});

    // Ref na aktuálne userTeams, aby retry funkcia videla vždy aktuálne dáta
    const userTeamsRef = useRef([]);
    useEffect(() => {
        userTeamsRef.current = userTeams;
    }, [userTeams]);

    // Ref na aktuálnu mapu (aby sme predišli zbytočným re-renderom)
    const teamNameMapRef = useRef({});
    useEffect(() => {
        teamNameMapRef.current = teamNameMap;
    }, [teamNameMap]);

    // ============================================================
    // 2) useMemo – odvodené hodnoty
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
    // 3) URL filtre
    // ============================================================
    const loadFiltersFromURL = () => {
        const params = new URLSearchParams(window.location.search);
        const categoryRaw = params.get('category') || '';
        const categoryName = categoryRaw ? categoryRaw.replace(/-/g, ' ') : '';
        const dayKey = params.get('day') || '';
        const mealType = params.get('mealType') || '';
        const sort = params.get('sort') || 'chronological';
        return { category: categoryName, day: dayKey, mealType, sort };
    };

    const updateURLWithFilters = (filters) => {
        const params = new URLSearchParams();
        if (filters.category) {
            params.set('category', filters.category.replace(/\s+/g, '-'));
        }
        if (filters.day) params.set('day', filters.day);
        if (filters.mealType) params.set('mealType', filters.mealType);
        if (filters.sort && filters.sort !== 'chronological') {
            params.set('sort', filters.sort);
        }
        const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}${window.location.hash}`;
        window.history.replaceState({}, '', newUrl);
    };

    // ============================================================
    // 4) URL useEffect-y
    // ============================================================
    useEffect(() => {
        if (availableCategories.length === 0 && tournamentDays.length === 0) return;
        if (!unitMinutes && Object.keys(cateringTimes).length === 0) return;

        const filters = loadFiltersFromURL();

        if (filters.category && availableCategories.includes(filters.category)) {
            setFilterCategory(filters.category);
        }

        if (filters.day && tournamentDays.some((d) => d.key === filters.day)) {
            setFilterDayKey(filters.day);
        }

        if (filters.mealType === 'lunch' || filters.mealType === 'dinner') {
            setFilterMealType(filters.mealType);
        }

        if (filters.sort === 'team' || filters.sort === 'chronological') {
            setSortMode(filters.sort);
        }
    }, [availableCategories, tournamentDays, cateringTimes, unitMinutes]);

    useEffect(() => {
        if (availableCategories.length === 0 && tournamentDays.length === 0) return;

        const timeoutId = setTimeout(() => {
            updateURLWithFilters({
                category: filterCategory,
                day: filterDayKey,
                mealType: filterMealType,
                sort: sortMode,
            });
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [filterCategory, filterDayKey, filterMealType, sortMode, availableCategories, tournamentDays]);

    // ============================================================
    // 5) Data useEffect-y – Firestore
    // ============================================================
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

    // ============================================================
    // 5b) Mapovacia funkcia s retry – spustí sa viackrát
    // ============================================================
    const triggerTeamNameRemap = async () => {
        const teams = userTeamsRef.current || [];
        if (teams.length === 0) return;

        const newMap = {};

        for (const team of teams) {
            if (!team.teamName || !team.category) continue;

            const key = `${team.category}||${team.teamName}`;

            try {
                const mapped = await resolveTeamName(team.category, team.teamName);
                // Ak sa namapovaný názov LÍŠI od pôvodného, uložíme
                if (mapped && mapped !== team.teamName) {
                    newMap[key] = mapped;
                }
            } catch (e) {
                // ignore
            }
        }

        if (Object.keys(newMap).length > 0) {
            setTeamNameMap((prev) => {
                // Zistíme, či sa niečo reálne zmenilo
                let changed = false;
                for (const k of Object.keys(newMap)) {
                    if (prev[k] !== newMap[k]) {
                        changed = true;
                        break;
                    }
                }
                if (!changed) return prev; // žiadny re-render
                return { ...prev, ...newMap };
            });
        }
    };

    // Retry verzia – spustí mapovanie niekoľkokrát s oneskorením,
    // aby zachytila aj oneskorené aktualizácie v matchTracker cache.
    const triggerTeamNameRemapWithRetry = (maxAttempts = 10, delayMs = 1000) => {
        let attempt = 0;

        const runAttempt = async () => {
            attempt++;
            try {
                await triggerTeamNameRemap();
            } catch (e) {
                // ignore
            }

            if (attempt < maxAttempts) {
                setTimeout(runAttempt, delayMs);
            }
        };

        // Prvé spustenie hneď, ďalšie s oneskorením
        setTimeout(runAttempt, 0);
    };

    // ============================================================
    // 5c) Listener na matches – ak sa nejaký zápas zmení na 'completed',
    //     spustíme mapovanie názvov tímov S RETRY
    // ============================================================
    const prevMatchStatusesRef = useRef({});
    const hasInitialRemapRun = useRef(false);

    useEffect(() => {
        if (!window.db) return;

        const matchesRef = collection(window.db, 'matches');

        const unsubscribe = onSnapshot(matchesRef, (snapshot) => {
            let shouldRemap = false;

            snapshot.docChanges().forEach((change) => {
                const matchId = change.doc.id;
                const data = change.doc.data() || {};
                const newStatus = data.status || 'scheduled';
                const oldStatus = prevMatchStatusesRef.current[matchId];

                // Ak sa status zmenil na 'completed' (a predtým nebol 'completed'), spustíme remap
                if (newStatus === 'completed' && oldStatus !== 'completed') {
                    shouldRemap = true;
                }

                prevMatchStatusesRef.current[matchId] = newStatus;
            });

            // Pri prvom načítaní tiež spustíme remap (aby sa namapovali existujúce názvy)
            if (!hasInitialRemapRun.current) {
                hasInitialRemapRun.current = true;
                shouldRemap = true;
            }

            if (shouldRemap) {
                // Použijeme retry verziu, aby sme zachytili oneskorené aktualizácie
                triggerTeamNameRemapWithRetry(10, 1000);
            }
        }, (error) => { });

        return () => unsubscribe();
    }, []);

    // ============================================================
    // 5d) Listener na globálne eventy matchTrackera
    //     (teamNameMappingReady, teamNamesReplaced) – spustí remap
    // ============================================================
    useEffect(() => {
        const handleMappingReady = () => {
            triggerTeamNameRemapWithRetry(5, 1000);
        };

        window.addEventListener('teamNameMappingReady', handleMappingReady);
        window.addEventListener('teamNamesReplaced', handleMappingReady);

        return () => {
            window.removeEventListener('teamNameMappingReady', handleMappingReady);
            window.removeEventListener('teamNamesReplaced', handleMappingReady);
        };
    }, []);

    // Ak sa zmení userTeams (napr. po načítaní), spustíme mapovanie S RETRY
    useEffect(() => {
        if (userTeams.length > 0) {
            triggerTeamNameRemapWithRetry(5, 800);
        }
    }, [userTeams]);

    // ============================================================
    // 6) useMemo – assignmentsBySlot, daySlots
    // ============================================================
    const assignmentsBySlot = React.useMemo(() => {
        const map = new Map();
        (cateringAssignments || []).forEach((a) => {
            if (a.isSuperstructure === true) return;
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

    // ============================================================
    // 7) Pomocné funkcie
    // ============================================================
    const getCateringPlaceColors = (placeId) => {
        const place = cateringPlaces.find((p) => p.id === placeId);
        if (!place) return { bg: '#1e40af', text: '#000000' };
        return {
            bg: place.headerColor || '#1e40af',
            text: place.headerTextColor || '#000000',
        };
    };

    const findCateringAssignment = (team, dayKey, mealType, slotFrom) => {
        const cat = cleanCategory(team.category);
        const key = `${team.uid}|${team.teamIndex}|${cat}|${dayKey}|${mealType}|${slotFrom}`;
        return assignmentsBySlot.get(key) || null;
    };

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

    const getPlaceTeamDisplayName = (teamName, category) => {
        if (!teamName) return '';
        if (category && teamName.startsWith(category + ' ')) {
            return teamName.substring(category.length + 1).trim();
        }
        return teamName;
    };

    // 🔥 Získanie zobrazeného názvu tímu s mapovaním
    const getMappedTeamName = (category, teamName) => {
        if (!teamName) return teamName;
        const key = `${category}||${teamName}`;
        return teamNameMap[key] || teamName;
    };

    // ============================================================
    // 8) Pomocné funkcie pre render
    // ============================================================
    const shouldShowMealType = (mealType) => {
        if (!filterMealType) return true;
        return filterMealType === mealType;
    };

    const filteredTeams = filterCategory
        ? userTeams.filter((t) => t.category === filterCategory)
        : userTeams;

    // ============================================================
    // 9) assignmentRows (useMemo) – MUSÍ BYŤ PRED RETURN-MI
    // ============================================================
    const assignmentRows = React.useMemo(() => {
        const rows = [];

        const daysToUse = filterDayKey
            ? visibleDays.filter((d) => d.key === filterDayKey)
            : visibleDays;

        filteredTeams.forEach((team) => {
            daysToUse.forEach((day) => {
                ['lunch', 'dinner'].forEach((mealType) => {
                    if (!shouldShowMealType(mealType)) return;

                    const slots = daySlots[day.key]?.[mealType] || [];
                    slots.forEach((slot) => {
                        const existing = findCateringAssignment(team, day.key, mealType, slot.from);
                        const ss = findSuperstructureAssignmentForCell(team, day.key, mealType, slot.from);

                        // 🔥 Namapovaný názov tímu pre klasické priradenie
                        const mappedTeamName = getMappedTeamName(team.category, team.teamName);

                        if (existing) {
                            rows.push({
                                key: `${team.id}-${day.key}-${mealType}-${slot.from}-cl`,
                                category: team.category,
                                teamName: mappedTeamName,
                                dayKey: day.key,
                                dayLabel: day.fullLabelNumeric,
                                daySort: day.date.getTime(),
                                mealType,
                                mealTypeLabel: mealType === 'lunch' ? 'Obed' : 'Večera',
                                slotFrom: slot.from,
                                slotTo: slot.to,
                                placeId: existing.placeId,
                                placeName: existing.placeName || '',
                                type: 'classic',
                            });
                            return;
                        }

                        if (ss) {
                            // 🔥 Pri superstructure skúsime namapovať aj názov superstructure tímu
                            const ssRawName = getPlaceTeamDisplayName(ss.teamName, ss.category) || ss.teamName;
                            const ssMappedName = getMappedTeamName(ss.category, ssRawName);

                            rows.push({
                                key: `${team.id}-${day.key}-${mealType}-${slot.from}-ss`,
                                category: team.category,
                                teamName: ssMappedName,
                                dayKey: day.key,
                                dayLabel: day.fullLabelNumeric,
                                daySort: day.date.getTime(),
                                mealType,
                                mealTypeLabel: mealType === 'lunch' ? 'Obed' : 'Večera',
                                slotFrom: slot.from,
                                slotTo: slot.to,
                                placeId: ss.placeId,
                                placeName: ss.placeName || '',
                                type: 'superstructure',
                                isPriority: ss.isPriority === true,
                            });
                        }
                    });
                });
            });
        });

        // Zoradenie
        if (sortMode === 'team') {
            rows.sort((a, b) => {
                const catCmp = (a.category || '').localeCompare(b.category || '', 'sk', { sensitivity: 'base' });
                if (catCmp !== 0) return catCmp;

                const teamCmp = (a.teamName || '').localeCompare(b.teamName || '', 'sk', { sensitivity: 'base' });
                if (teamCmp !== 0) return teamCmp;

                if (a.daySort !== b.daySort) return a.daySort - b.daySort;

                const am = timeToMinutes(a.slotFrom);
                const bm = timeToMinutes(b.slotFrom);
                if (am != null && bm != null && am !== bm) return am - bm;

                if (a.mealType !== b.mealType) {
                    return a.mealType === 'lunch' ? -1 : 1;
                }
                return 0;
            });
        } else {
            rows.sort((a, b) => {
                if (a.daySort !== b.daySort) return a.daySort - b.daySort;

                const am = timeToMinutes(a.slotFrom);
                const bm = timeToMinutes(b.slotFrom);
                if (am != null && bm != null && am !== bm) return am - bm;

                const catCmp = (a.category || '').localeCompare(b.category || '', 'sk', { sensitivity: 'base' });
                if (catCmp !== 0) return catCmp;

                return (a.teamName || '').localeCompare(b.teamName || '', 'sk', { sensitivity: 'base' });
            });
        }

        return rows;
    }, [
        filteredTeams,
        filterDayKey,
        visibleDays,
        daySlots,
        filterMealType,
        cateringAssignments,
        sortMode,
        teamNameMap,
    ]);

    // ============================================================
    // 10) Až TERAZ môžu prísť skoré return-y
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

    // ============================================================
    // 11) RENDER
    // ============================================================
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

                React.createElement(
                    'div',
                    { className: 'flex flex-wrap items-center justify-center gap-4 w-full' },

                    React.createElement(
                        'div',
                        { className: 'flex items-center gap-2' },
                        React.createElement('label', { className: 'text-sm font-medium text-gray-700' }, 'Kategória:'),
                        React.createElement(
                            'select',
                            {
                                value: filterCategory,
                                onChange: (e) => setFilterCategory(e.target.value),
                                className: 'px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition',
                            },
                            React.createElement('option', { value: '' }, 'Všetky'),
                            availableCategories.map((cat) =>
                                React.createElement('option', { key: cat, value: cat }, cat)
                            )
                        )
                    ),

                    React.createElement(
                        'div',
                        { className: 'flex items-center gap-2' },
                        React.createElement('label', { className: 'text-sm font-medium text-gray-700' }, 'Dátum:'),
                        React.createElement(
                            'select',
                            {
                                value: filterDayKey,
                                onChange: (e) => setFilterDayKey(e.target.value),
                                className: 'px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition',
                            },
                            React.createElement('option', { value: '' }, 'Všetky'),
                            visibleDays.map((day) =>
                                React.createElement('option', { key: day.key, value: day.key }, day.label)
                            )
                        )
                    ),

                    React.createElement(
                        'div',
                        { className: 'flex items-center gap-2' },
                        React.createElement('label', { className: 'text-sm font-medium text-gray-700' }, 'Typ jedla:'),
                        React.createElement(
                            'select',
                            {
                                value: filterMealType,
                                onChange: (e) => setFilterMealType(e.target.value),
                                className: 'px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition',
                            },
                            React.createElement('option', { value: '' }, 'Všetky'),
                            React.createElement('option', { value: 'lunch' }, 'Obed'),
                            React.createElement('option', { value: 'dinner' }, 'Večera')
                        )
                    )
                ),

                React.createElement(
                    'div',
                    { className: 'flex items-center justify-center gap-1 mt-4 bg-gray-100 rounded-lg p-1 w-fit mx-auto' },
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: () => setSortMode('chronological'),
                            className:
                                'px-4 py-2 rounded-md text-sm font-medium transition ' +
                                (sortMode === 'chronological'
                                    ? 'bg-white text-gray-900 shadow'
                                    : 'text-gray-600 hover:text-gray-900'),
                        },
                        '📅 Chronologicky'
                    ),
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: () => setSortMode('team'),
                            className:
                                'px-4 py-2 rounded-md text-sm font-medium transition ' +
                                (sortMode === 'team'
                                    ? 'bg-white text-gray-900 shadow'
                                    : 'text-gray-600 hover:text-gray-900'),
                        },
                        '🔤 Podľa tímu'
                    )
                )
            ),

            assignmentRows.length === 0
                ? React.createElement(
                      'p',
                      { className: 'text-center text-gray-500 py-8' },
                      'Žiadne priradenia stravovania pre zvolené filtre.'
                  )
                : React.createElement(
                      'div',
                      { className: 'overflow-x-auto pb-4 w-full min-w-0' },
                      React.createElement(
                          'table',
                          { className: 'min-w-full border-collapse text-sm' },
                          React.createElement(
                              'thead',
                              null,
                              React.createElement(
                                  'tr',
                                  { className: 'bg-gray-100' },
                                  React.createElement('th', { className: 'border border-gray-300 px-3 py-2 text-left font-bold text-gray-700 whitespace-nowrap' }, 'Kategória'),
                                  React.createElement('th', { className: 'border border-gray-300 px-3 py-2 text-left font-bold text-gray-700 whitespace-nowrap' }, 'Tím'),
                                  React.createElement('th', { className: 'border border-gray-300 px-3 py-2 text-left font-bold text-gray-700 whitespace-nowrap' }, 'Dátum'),
                                  React.createElement('th', { className: 'border border-gray-300 px-3 py-2 text-left font-bold text-gray-700 whitespace-nowrap' }, 'Typ jedla'),
                                  React.createElement('th', { className: 'border border-gray-300 px-3 py-2 text-left font-bold text-gray-700 whitespace-nowrap' }, 'Čas'),
                                  React.createElement('th', { className: 'border border-gray-300 px-3 py-2 text-left font-bold text-gray-700 whitespace-nowrap' }, 'Miesto')
                              )
                          ),
                          React.createElement(
                              'tbody',
                              null,
                              assignmentRows.map((row) => {
                                  const colors = row.placeId ? getCateringPlaceColors(row.placeId) : null;

                                  return React.createElement(
                                      'tr',
                                      {
                                          key: row.key,
                                          className:
                                              'border-b border-gray-200 ' +
                                              (row.type === 'superstructure' ? 'bg-blue-50/40' : 'bg-white'),
                                      },
                                      React.createElement('td', { className: 'border border-gray-300 px-3 py-2 text-gray-700 whitespace-nowrap text-xs' }, row.category),
                                      React.createElement(
                                          'td',
                                          { className: 'border border-gray-300 px-3 py-2 font-medium text-gray-800 whitespace-nowrap' },
                                          row.teamName
                                      ),
                                      React.createElement('td', { className: 'border border-gray-300 px-3 py-2 text-gray-700 whitespace-nowrap text-xs' }, row.dayLabel),
                                      React.createElement('td', { className: 'border border-gray-300 px-3 py-2 text-gray-700 whitespace-nowrap text-xs' }, row.mealTypeLabel),
                                      React.createElement(
                                          'td',
                                          { className: 'border border-gray-300 px-3 py-2 text-gray-700 whitespace-nowrap text-xs' },
                                          `${row.slotFrom} – ${row.slotTo}`
                                      ),
                                      React.createElement(
                                          'td',
                                          {
                                              className: 'border border-gray-300 px-3 py-2 text-xs whitespace-nowrap',
                                              style:
                                                  row.type === 'superstructure' && colors
                                                      ? {
                                                            backgroundColor: colors.bg,
                                                            color: colors.text,
                                                            ...(row.isPriority
                                                                ? { border: '3px solid #000000', fontWeight: 'bold' }
                                                                : {}),
                                                        }
                                                      : row.type === 'classic' && colors
                                                          ? { backgroundColor: colors.bg, color: colors.text }
                                                          : {},
                                          },
                                          row.placeName || '–'
                                      )
                                  );
                              })
                          )
                      )
                  )
        )
    );
};

// ============================================================
// Render
// ============================================================
const renderCateringApp = () => {
    const rootElement = document.getElementById('root');
    if (!rootElement) return;
    if (typeof ReactDOM === 'undefined' || typeof React === 'undefined') return;

    const userProfileData = window.globalUserProfileData || null;
    const root = ReactDOM.createRoot(rootElement);
    root.render(React.createElement(cateringApp, { userProfileData }));
};

window.addEventListener('globalDataUpdated', renderCateringApp);

renderCateringApp();
