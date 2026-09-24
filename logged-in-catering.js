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

            teamArray.forEach((team) => {
                if (!team?.teamName) return;

                // 🔥 Spočítame členov jednotlivých polí
                const playersCount = Array.isArray(team.playerDetails) ? team.playerDetails.length : 0;
                const menTeamMembersCount = Array.isArray(team.menTeamMemberDetails) ? team.menTeamMemberDetails.length : 0;
                const womenTeamMembersCount = Array.isArray(team.womenTeamMemberDetails) ? team.womenTeamMemberDetails.length : 0;
                const menDriversCount = Array.isArray(team.driverDetailsMale) ? team.driverDetailsMale.length : 0;
                const womenDriversCount = Array.isArray(team.driverDetailsFemale) ? team.driverDetailsFemale.length : 0;

                teams.push({
                    uid: userDoc.id,
                    id: team.id || `${userDoc.id}-${team.teamName}`,
                    teamName: team.teamName,
                    category: categoryName,
                    playersCount,
                    othersCount: menTeamMembersCount + womenTeamMembersCount + menDriversCount + womenDriversCount,
                    accommodationName: team.accommodation?.name || null,
                });
            });
        });
    });

    // 🔥 ZORADENIE: najprv podľa kategórie, potom podľa názvu tímu
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

/** Prevedie "HH:MM" na minúty od polnoci. Vráti null, ak je vstup neplatný. */
const timeToMinutes = (t) => {
    if (!t || typeof t !== 'string') return null;
    const parts = t.split(':');
    if (parts.length < 2) return null;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
};

/** Naformátuje minúty od polnoci na "HH:MM". */
const minutesToTime = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/**
 * Skontroluje, či má dané jedlo v danom dni platný časový rozptyl
 * a či je možné z neho vygenerovať aspoň jeden slot.
 */
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

/**
 * Rozdelí interval from–to na sloty podľa unitMinutes.
 * Vráti pole objektov { from, to, label } – label je začiatok slotu.
 * Ak nie je možné deliť (neplatné vstupy alebo unit <= 0), vráti prázdne pole.
 */
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
    // 🔥 NOVÉ: ubytovne s farbami pre vyfarbenie buniek Hráči a RT
    const [accommodations, setAccommodations] = useState([]);

    // 🔥 NOVÉ: stravovacie miesta (places typu "stravovanie")
    const [cateringPlaces, setCateringPlaces] = useState([]);

    // 🔥 NOVÉ: uložené priradenia stravovania z kolekcie "catering"
    const [cateringAssignments, setCateringAssignments] = useState([]);

    // 🔥 NOVÉ: modálne okno pre priradenie stravovania
    const [showCateringModal, setShowCateringModal] = useState(false);
    const [selectedCateringCell, setSelectedCateringCell] = useState(null);
    const [selectedCateringPlaceId, setSelectedCateringPlaceId] = useState('');
    const [savingCatering, setSavingCatering] = useState(false);

    // 🔥 NOVÉ: potvrdenie zmeny priradenia (ak už existuje)
    const [showChangeConfirm, setShowChangeConfirm] = useState(false);
    const [pendingChange, setPendingChange] = useState(null);

    // Načítanie nastavení turnaja z Firestore
    useEffect(() => {
        if (!window.db) {
            console.warn('cateringApp: window.db nie je dostupné.');
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
                console.error('cateringApp: Chyba pri načítaní nastavení turnaja:', error);
                window.showGlobalNotification('Nepodarilo sa načítať nastavenia turnaja.', 'error');
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    // 🔥 Načítanie nastavení stravovania (časy + jednotka)
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
                console.error('cateringApp: Chyba pri načítaní nastavení stravovania:', error);
                window.showGlobalNotification('Nepodarilo sa načítať nastavenia stravovania.', 'error');
            }
        );

        return () => unsubscribe();
    }, []);

    // Načítanie používateľských tímov z kolekcie 'users'
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
                    console.error('cateringApp: Chyba pri načítaní tímov:', err);
                    window.showGlobalNotification('Nepodarilo sa načítať tímy.', 'error');
                }
            },
            (error) => {
                console.error('cateringApp: Chyba pri sledovaní používateľov:', error);
            }
        );

        return () => unsubscribe();
    }, []);

    // 🔥 NOVÉ: Načítanie ubytovní (places) s farbami
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
            (error) => {
                console.error('cateringApp: Chyba pri načítaní ubytovní:', error);
            }
        );

        return () => unsubscribe();
    }, []);

    // 🔥 NOVÉ: Načítanie stravovacích miest (places typu "stravovanie") – aj s farbami
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
                    });
                });
                places.sort((a, b) => a.name.localeCompare(b.name, 'sk', { sensitivity: 'base' }));
                setCateringPlaces(places);
            },
            (error) => {
                console.error('cateringApp: Chyba pri načítaní stravovacích miest:', error);
            }
        );

        return () => unsubscribe();
    }, []);

    // 🔥 NOVÉ: Načítanie priradení stravovania z kolekcie "catering"
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
            (error) => {
                console.error('cateringApp: Chyba pri načítaní priradení stravovania:', error);
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

    // ============================================================
    // Predpočítame sloty pre každý deň a každé jedlo.
    // ============================================================
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

    const totalMealColumns = visibleDays.reduce(
        (acc, day) => acc + dayColumnCount(day.key),
        0
    );

    // 🔥 Získanie farby ubytovne pre tím (bez ubytovne = žltá #FFFF00)
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

    // 🔥 Nájde existujúce priradenie pre konkrétnu bunku (tím + deň + jedlo + slot)
    const findCateringAssignment = (team, dayKey, mealType, slotFrom) => {
        return cateringAssignments.find(
            (a) =>
                a.teamId === team.id &&
                (a.category === team.category || a.categoryName === team.category) &&
                a.dayKey === dayKey &&
                a.mealType === mealType &&
                a.slotFrom === slotFrom
        );
    };

    // 🔥 Nájde stravovacie miesto podľa placeId a vráti jeho farby
    const getCateringPlaceColors = (placeId) => {
        const place = cateringPlaces.find((p) => p.id === placeId);
        if (!place) return { bg: '#1e40af', text: '#000000' };
        return {
            bg: place.headerColor || '#1e40af',
            text: place.headerTextColor || '#000000',
        };
    };    
    
    // 🔥 Otvorí modálne okno pre priradenie stravovacieho miesta
    const openCateringModal = (team, day, mealType, slot) => {
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
        setShowCateringModal(true);
    };

    const buildCateringPayload = (placeId) => {
        const place = cateringPlaces.find((p) => p.id === placeId);
        return {
            teamId: selectedCateringCell.team.id,
            teamName: selectedCateringCell.team.teamName, 
            category: selectedCateringCell.team.category, 
            categoryName: selectedCateringCell.team.category, 
            uid: selectedCateringCell.team.uid,
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
                // 1) vymaž staré priradenia pre daný tím + deň + typ jedla
                for (const id of oldIds) {
                    await deleteDoc(doc(window.db, 'catering', id));
                }
                // 2) vytvor nové (bez createdAt / updatedAt)
                await addDoc(collection(window.db, 'catering'), payload);
                window.showGlobalNotification('Priradenie bolo zmenené.', 'success');
            } else {
                // bez createdAt / updatedAt
                await addDoc(collection(window.db, 'catering'), payload);
                window.showGlobalNotification('Priradenie bolo uložené.', 'success');
            }

            setShowCateringModal(false);
            setSelectedCateringCell(null);
            setSelectedCateringPlaceId('');
        } catch (err) {
            console.error('cateringApp: Chyba pri ukladaní priradenia stravovania:', err);
            window.showGlobalNotification('Nepodarilo sa uložiť priradenie.', 'error');
        } finally {
            setSavingCatering(false);
        }
    };

    // 🔥 Uloží priradenie stravovacieho miesta do DB (s potvrdením pri zmene)
    const saveCateringAssignment = async () => {
        if (!selectedCateringCell || !selectedCateringPlaceId || !window.db) return;

        const payload = buildCateringPayload(selectedCateringPlaceId);

        // Zisti, či pre tento tím, tento deň a tento typ jedla už existuje priradenie.
        // Podľa pravidla: každý tím má pre každý deň a typ jedla PRÁVE JEDNO priradenie.
        const existingForTeamDayMeal = cateringAssignments.filter(
            (a) =>
                a.teamId === selectedCateringCell.team.id &&
                (a.category === selectedCateringCell.team.category ||
                 a.categoryName === selectedCateringCell.team.category) &&
                a.dayKey === selectedCateringCell.dayKey &&
                a.mealType === selectedCateringCell.mealType
        );

        // Ak neexistuje žiadne priradenie pre daný deň + typ jedla → rovno ulož
        if (existingForTeamDayMeal.length === 0) {
            setSavingCatering(true);
            await performSaveCateringAssignment(payload, false, null);
            return;
        }

        // Ak existuje a je úplne identické (rovnaký slot aj miesto) → nič sa nemení
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

        // Inak → zobraz potvrdenie o zmene.
        // Vymažú sa len priradenia pre daný deň + typ jedla (nie celý tím).
        setPendingChange({
            payload,
            oldIds: existingForTeamDayMeal.map((a) => a.id),
        });
        setShowChangeConfirm(true);
    };

    // 🔥 Potvrdenie zmeny – vymaž staré a ulož nové
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

    // 🔥 Zrušenie zmeny – nič sa neukladá
    const cancelChangeAssignment = () => {
        setShowChangeConfirm(false);
        setPendingChange(null);
        setSavingCatering(false);
    };

    // 🔥 Odstráni priradenie stravovacieho miesta
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
            console.error('cateringApp: Chyba pri odstraňovaní priradenia:', err);
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
                React.createElement('h2', { className: 'text-3xl font-bold tracking-tight text-center' }, 'Stravovanie')
            ),
            React.createElement(
                'div',
                { className: 'overflow-x-auto pb-4 w-full min-w-0' },
                React.createElement(
                    'table',
                    { className: 'min-w-max border-collapse text-sm' },
                    // HLAVIČKA TABUĽKY
                    React.createElement(
                        'thead',
                        null,
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
                            visibleDays.map((day, index) => {
                                const total = dayColumnCount(day.key);
                                const isLastDay = index === visibleDays.length - 1;
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
                        React.createElement(
                            'tr',
                            null,
                            visibleDays.map((day, index) => {
                                const lunchCount = slotCountFor(day.key, 'lunch');
                                const dinnerCount = slotCountFor(day.key, 'dinner');
                                const isLastDay = index === visibleDays.length - 1;
                                const parts = [];

                                if (lunchCount > 0) {
                                    const lunchHasThickRight =
                                        (dinnerCount > 0) || (!isLastDay);
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
                        React.createElement(
                            'tr',
                            null,
                            visibleDays.map((day, dayIndex) => {
                                const lunchSlots = daySlots[day.key]?.lunch || [];
                                const dinnerSlots = daySlots[day.key]?.dinner || [];
                                const isLastDay = dayIndex === visibleDays.length - 1;
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
                        userTeams.length === 0
                            ? React.createElement(
                                  'tr',
                                  null,
                                  React.createElement(
                                      'td',
                                      {
                                          colSpan: 4 + totalMealColumns,
                                          className: 'border border-gray-300 px-3 py-4 text-center text-gray-500',
                                      },
                                      'Žiadne tímy neboli nájdené v kolekcii users.'
                                  )
                              )
                            : userTeams.map((team, rowIndex) =>
                                  React.createElement(
                                      'tr',
                                      {
                                          key: team.id || `${team.uid}-${team.teamName}-${rowIndex}`,
                                          className: rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50',
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
                                      visibleDays.map((day, dayIndex) => {
                                          const lunchCount = slotCountFor(day.key, 'lunch');
                                          const dinnerCount = slotCountFor(day.key, 'dinner');
                                          const isLastDay = dayIndex === visibleDays.length - 1;
                                          const cells = [];

                                          for (let i = 0; i < lunchCount; i++) {
                                              const slot = daySlots[day.key].lunch[i];
                                              const isLastLunchCell = i === lunchCount - 1;
                                              const hasThickRight =
                                                  isLastLunchCell &&
                                                  ((dinnerCount > 0) || !isLastDay);
                                              const existing = findCateringAssignment(team, day.key, 'lunch', slot.from);
                                              const colors = existing
                                                  ? getCateringPlaceColors(existing.placeId)
                                                  : null;
                                              const teamTotal = (team.playersCount || 0) + (team.othersCount || 0);

                                              cells.push(
                                                  React.createElement(
                                                      'td',
                                                      {
                                                          key: `cell-lunch-${rowIndex}-${dayIndex}-${i}`,
                                                          onClick: () => openCateringModal(team, day, 'lunch', slot),
                                                          className:
                                                              'border border-gray-300 px-2 py-2 text-center text-xs min-w-[70px] cursor-pointer transition ' +
                                                              (existing ? 'font-semibold ' : 'text-gray-400 hover:bg-blue-50 ') +
                                                              (hasThickRight ? 'border-r-4 border-r-gray-500' : ''),
                                                          style: existing && colors
                                                              ? {
                                                                    backgroundColor: colors.bg,
                                                                    color: colors.text,
                                                                }
                                                              : {},
                                                          title: existing
                                                              ? `${existing.placeName} (${slot.from} – ${slot.to})`
                                                              : `Kliknutím priradíte miesto (${slot.from} – ${slot.to})`,
                                                      },
                                                      existing ? teamTotal : '—'
                                                  )
                                              );
                                          }

                                          for (let i = 0; i < dinnerCount; i++) {
                                              const slot = daySlots[day.key].dinner[i];
                                              const isLastDinnerCell = i === dinnerCount - 1;
                                              const hasThickRight = isLastDinnerCell && !isLastDay;
                                              const existing = findCateringAssignment(team, day.key, 'dinner', slot.from);
                                              const colors = existing
                                                  ? getCateringPlaceColors(existing.placeId)
                                                  : null;
                                              const teamTotal = (team.playersCount || 0) + (team.othersCount || 0);

                                              cells.push(
                                                  React.createElement(
                                                      'td',
                                                      {
                                                          key: `cell-dinner-${rowIndex}-${dayIndex}-${i}`,
                                                          onClick: () => openCateringModal(team, day, 'dinner', slot),
                                                          className:
                                                              'border border-gray-300 px-2 py-2 text-center text-xs min-w-[70px] cursor-pointer transition ' +
                                                              (existing ? 'font-semibold ' : 'text-gray-400 hover:bg-blue-50 ') +
                                                              (hasThickRight ? 'border-r-4 border-r-gray-500' : ''),
                                                          style: existing && colors
                                                              ? {
                                                                    backgroundColor: colors.bg,
                                                                    color: colors.text,
                                                                }
                                                              : {},
                                                          title: existing
                                                              ? `${existing.placeName} (${slot.from} – ${slot.to})`
                                                              : `Kliknutím priradíte miesto (${slot.from} – ${slot.to})`,
                                                      },
                                                      existing ? teamTotal : '—'
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
                              )
                    )
                )
            ),
            // 🔥 Modálne okno pre priradenie stravovacieho miesta
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
            )            ,
            // 🔥 Potvrdzovacie okno pri zmene priradenia
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
            console.log("logged-in-catering.js: Nastavujem poslucháča na synchronizáciu e-mailu.");

            onAuthStateChanged(window.auth, async (user) => {
                if (user) {
                    try {
                        const userProfileRef = doc(window.db, 'users', user.uid);
                        const docSnap = await getDoc(userProfileRef);

                        if (docSnap.exists()) {
                            const firestoreEmail = docSnap.data().email;
                            if (user.email !== firestoreEmail) {
                                console.log(`logged-in-catering.js: E-mail v autentifikácii (${user.email}) sa líši od e-mailu vo Firestore (${firestoreEmail}). Aktualizujem...`);

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
                        console.error("logged-in-catering.js: Chyba pri porovnávaní a aktualizácii e-mailu:", error);
                        window.showGlobalNotification('Nastala chyba pri synchronizácii e-mailovej adresy.', 'error');
                    }
                }
            });
            isEmailSyncListenerSetup = true;
        }

        if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
            const root = ReactDOM.createRoot(rootElement);
            root.render(React.createElement(cateringApp, { userProfileData }));
        } else {
            console.error("logged-in-catering.js: HTML element 'root' alebo React/ReactDOM nie sú dostupné.");
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
