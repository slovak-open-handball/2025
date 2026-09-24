// Importy pre Firebase funkcie
import { doc, getDoc, onSnapshot, updateDoc, addDoc, collection, Timestamp, query, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
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

/**
 * Pomocná funkcia: načíta všetky používateľské tímy z kolekcie 'users'.
 * Vráti zoradené pole objektov { uid, teamName, category, id }.
 *
 * ZORADENIE:
 *   1. abecedne podľa názvu KATEGÓRIE (sk locale)
 *   2. potom abecedne podľa názvu TÍMU (sk locale)
 */
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

                teams.push({
                    uid: userDoc.id,
                    id: team.id || `${userDoc.id}-${team.teamName}`,
                    teamName: team.teamName,
                    category: categoryName,
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
    // Ak jedlo nemá platný rozptyl, sloty budú prázdne a stĺpce sa negenerujú.
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

    // Pomocná funkcia: vráti počet stĺpcov pre daný deň (0 = deň sa nezobrazí)
    const dayColumnCount = (dayKey) => {
        const slots = daySlots[dayKey] || { lunch: [], dinner: [] };
        return slots.lunch.length + slots.dinner.length;
    };

    // Vyfiltrujeme len dni, ktoré majú aspoň jeden stĺpec
    const visibleDays = tournamentDays.filter((day) => dayColumnCount(day.key) > 0);

    // Ak ani jeden deň nemá platné rozptyly, zobrazíme upozornenie
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

    // Koľko stĺpcov pre dané jedlo v danom dni (0 ak nie je platný rozptyl)
    const slotCountFor = (dayKey, mealType) => {
        const slots = daySlots[dayKey]?.[mealType] || [];
        return slots.length;
    };

    // Celkový počet stĺpcov vpravo od dvoch fixných (Kategória, Tím)
    const totalMealColumns = visibleDays.reduce(
        (acc, day) => acc + dayColumnCount(day.key),
        0
    );

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
                        // Riadok 1: Kategória (rowspan=3), Tím (rowspan=3), Deň (colspan=počet slotov), ...
                        React.createElement(
                            'tr',
                            null,
                            React.createElement(
                                'th',
                                {
                                    rowSpan: 3,
                                    className:
                                        'border border-gray-300 bg-gray-100 px-3 py-2 text-left font-bold text-gray-700 min-w-[140px]',
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
                        // Riadok 2: Obed / Večera s colspan = počet slotov (len ak existujú)
                        React.createElement(
                            'tr',
                            null,
                            visibleDays.map((day, index) => {
                                const lunchCount = slotCountFor(day.key, 'lunch');
                                const dinnerCount = slotCountFor(day.key, 'dinner');
                                const isLastDay = index === visibleDays.length - 1;
                                const parts = [];

                                if (lunchCount > 0) {
                                    parts.push(
                                        React.createElement(
                                            'th',
                                            {
                                                key: `lunch-header-${index}`,
                                                colSpan: lunchCount,
                                                className:
                                                    'border border-gray-300 bg-blue-50 px-2 py-1 text-center font-semibold text-blue-700 text-xs' +
                                                    ((dinnerCount === 0 && !isLastDay) ? ' border-r-4 border-r-gray-500' : ''),
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
                        // 🔥 Riadok 3: Popisky začiatkov jednotlivých slotov (len ak existujú)
                        React.createElement(
                            'tr',
                            null,
                            visibleDays.map((day, dayIndex) => {
                                const lunchSlots = daySlots[day.key]?.lunch || [];
                                const dinnerSlots = daySlots[day.key]?.dinner || [];
                                const isLastDay = dayIndex === visibleDays.length - 1;
                                const totalSlots = lunchSlots.length + dinnerSlots.length;
                                const parts = [];

                                lunchSlots.forEach((slot, i) => {
                                    const isLastSlotOfDay = (i === lunchSlots.length - 1) && dinnerSlots.length === 0;
                                    parts.push(
                                        React.createElement(
                                            'th',
                                            {
                                                key: `lunch-slot-${dayIndex}-${i}`,
                                                className:
                                                    'border border-gray-300 bg-blue-50 px-2 py-1 text-center text-[11px] text-blue-700 whitespace-nowrap min-w-[70px]' +
                                                    ((isLastSlotOfDay && !isLastDay) ? ' border-r-4 border-r-gray-500' : ''),
                                                title: slot.from && slot.to ? `${slot.from} – ${slot.to}` : '',
                                            },
                                            slot.label
                                        )
                                    );
                                });

                                dinnerSlots.forEach((slot, i) => {
                                    const isLastSlotOfDay = i === dinnerSlots.length - 1;
                                    parts.push(
                                        React.createElement(
                                            'th',
                                            {
                                                key: `dinner-slot-${dayIndex}-${i}`,
                                                className:
                                                    'border border-gray-300 bg-blue-50 px-2 py-1 text-center text-[11px] text-blue-700 whitespace-nowrap min-w-[70px]' +
                                                    ((isLastSlotOfDay && !isLastDay) ? ' border-r-4 border-r-gray-500' : ''),
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
                                          colSpan: 2 + totalMealColumns,
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
                                      visibleDays.map((day, dayIndex) => {
                                          const lunchCount = slotCountFor(day.key, 'lunch');
                                          const dinnerCount = slotCountFor(day.key, 'dinner');
                                          const isLastDay = dayIndex === visibleDays.length - 1;
                                          const cells = [];

                                          for (let i = 0; i < lunchCount; i++) {
                                              const isLastCellOfDay = (i === lunchCount - 1) && dinnerCount === 0;
                                              cells.push(
                                                  React.createElement(
                                                      'td',
                                                      {
                                                          key: `cell-lunch-${rowIndex}-${dayIndex}-${i}`,
                                                          className:
                                                              'border border-gray-300 px-2 py-2 text-center text-gray-400 text-xs min-w-[70px]' +
                                                              ((isLastCellOfDay && !isLastDay) ? ' border-r-4 border-r-gray-500' : ''),
                                                      },
                                                      '—'
                                                  )
                                              );
                                          }

                                          for (let i = 0; i < dinnerCount; i++) {
                                              const isLastCellOfDay = i === dinnerCount - 1;
                                              cells.push(
                                                  React.createElement(
                                                      'td',
                                                      {
                                                          key: `cell-dinner-${rowIndex}-${dayIndex}-${i}`,
                                                          className:
                                                              'border border-gray-300 px-2 py-2 text-center text-gray-400 text-xs min-w-[70px]' +
                                                              ((isLastCellOfDay && !isLastDay) ? ' border-r-4 border-r-gray-500' : ''),
                                                      },
                                                      '—'
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
