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
        days.push({
            date: new Date(current),
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
        });
        current.setDate(current.getDate() + 1);
    }

    return days;
};

/**
 * Pomocná funkcia: načíta všetky používateľské tímy z kolekcie 'users'.
 * Vráti zoradené pole objektov { uid, teamName, category, id }.
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

    // Zoradíme podľa kategórie a názvu tímu
    teams.sort((a, b) => {
        const catCompare = (a.category || '').localeCompare(b.category || '');
        if (catCompare !== 0) return catCompare;
        return (a.teamName || '').localeCompare(b.teamName || '');
    });

    return teams;
};

const cateringApp = ({ userProfileData }) => {
    const [tournamentDays, setTournamentDays] = useState([]);
    const [userTeams, setUserTeams] = useState([]);
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
    // TABUĽKA STRAVOVANIA
    // ============================================================
    // Štruktúra:
    //   Prvý stĺpec: Názov tímu
    //   Pre každý deň: dva podstĺpce (Obed, Večera)
    // ============================================================

    return React.createElement(
        'div',
        { className: 'flex-grow flex justify-center items-start p-6' },
        React.createElement(
            'div',
            { className: 'w-full max-w-full bg-white rounded-xl shadow-xl p-8' },
            React.createElement(
                'div',
                { className: 'flex flex-col items-center justify-center mb-6' },
                React.createElement('h2', { className: 'text-3xl font-bold tracking-tight text-center' }, 'Stravovanie')
            ),
            // Horizontálne scrollovateľný kontajner pre tabuľku
            React.createElement(
                'div',
                { className: 'overflow-x-auto pb-4' },
                React.createElement(
                    'table',
                    {
                        className: 'min-w-max border-collapse text-sm',
                    },
                    // HLAVIČKA TABUĽKY
                    React.createElement(
                        'thead',
                        null,
                        // Prvý riadok hlavičky: názvy dní (colspan=2 pre každý deň)
                        React.createElement(
                            'tr',
                            null,
                            // Prvý stĺpec - prázdny (alebo "Tím") s rowspan=2
                            React.createElement(
                                'th',
                                {
                                    rowSpan: 2,
                                    className:
                                        'border border-gray-300 bg-gray-100 px-3 py-2 text-left font-bold text-gray-700 sticky left-0 z-10 min-w-[180px]',
                                },
                                'Tím'
                            ),
                            // Za každý deň jeden th s colspan=2
                            tournamentDays.map((day, index) =>
                                React.createElement(
                                    'th',
                                    {
                                        key: `day-header-${index}`,
                                        colSpan: 2,
                                        className:
                                            'border border-gray-300 bg-gray-100 px-3 py-2 text-center font-bold text-gray-700 whitespace-nowrap',
                                        title: day.fullLabel,
                                    },
                                    day.label
                                )
                            )
                        ),
                        // Druhý riadok hlavičky: Obed / Večera pre každý deň
                        React.createElement(
                            'tr',
                            null,
                            tournamentDays.map((day, index) =>
                                React.Fragment
                                    ? React.createElement(
                                          React.Fragment,
                                          { key: `sub-header-${index}` },
                                          React.createElement(
                                              'th',
                                              {
                                                  className:
                                                      'border border-gray-300 bg-blue-50 px-2 py-1 text-center font-semibold text-blue-700 text-xs',
                                              },
                                              'Obed'
                                          ),
                                          React.createElement(
                                              'th',
                                              {
                                                  className:
                                                      'border border-gray-300 bg-purple-50 px-2 py-1 text-center font-semibold text-purple-700 text-xs',
                                              },
                                              'Večera'
                                          )
                                      )
                                    : null
                            )
                        )
                    ),
                    // TELO TABUĽKY - jeden riadok pre každý tím
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
                                          colSpan: 1 + tournamentDays.length * 2,
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
                                      // Prvý stĺpec - názov tímu
                                      React.createElement(
                                          'td',
                                          {
                                              className:
                                                  'border border-gray-300 px-3 py-2 font-medium text-gray-800 sticky left-0 bg-inherit z-10 whitespace-nowrap',
                                          },
                                          team.teamName
                                      ),
                                      // Pre každý deň dva podstĺpce
                                      tournamentDays.map((day, dayIndex) =>
                                          React.createElement(
                                              React.Fragment,
                                              { key: `cell-${rowIndex}-${dayIndex}` },
                                              // Obed
                                              React.createElement(
                                                  'td',
                                                  {
                                                      className:
                                                          'border border-gray-300 px-2 py-2 text-center text-gray-400 text-xs min-w-[90px]',
                                                  },
                                                  '—'
                                              ),
                                              // Večera
                                              React.createElement(
                                                  'td',
                                                  {
                                                      className:
                                                          'border border-gray-300 px-2 py-2 text-center text-gray-400 text-xs min-w-[90px]',
                                                  },
                                                  '—'
                                              )
                                          )
                                      )
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
