
// Importy pre Firebase funkcie (Tieto sa nebudú používať na inicializáciu, ale na typy a funkcie)
import { doc, getDoc, onSnapshot, updateDoc, addDoc, collection, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
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
    // Zobrazenie notifikácie
    setTimeout(() => {
        notificationElement.className = `${baseClasses} ${typeClasses} opacity-100 scale-100`;
    }, 10);
    // Skrytie notifikácie po 5 sekundách
    setTimeout(() => {
        notificationElement.className = `${baseClasses} ${typeClasses} opacity-0 scale-95`;
    }, 5000);
};

let isEmailSyncListenerSetup = false;

const AddGroupsApp = ({ userProfileData }) => {
    // ─── Stavy pre dáta ───────────────────────────────────────────────
    const [accommodations, setAccommodations] = useState([]);
    const [teamsWithoutAccommodation, setTeamsWithoutAccommodation] = useState([]);
    const [teamsWithAccommodation, setTeamsWithAccommodation] = useState([]); // voliteľné – ak chceš zobraziť aj priradené
    const [loading, setLoading] = useState(true);

    // 1. Načítanie ubytovacích miest (places)
    useEffect(() => {
        if (!window.db) return;

        const unsubscribePlaces = onSnapshot(
            collection(window.db, 'places'),
            (snapshot) => {
                const places = [];
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    if (data.type !== "ubytovanie") return;
                    places.push({
                        id: doc.id,
                        name: data.name || '(bez názvu)',
                        accommodationType: data.accommodationType || 'neurčený',
                        capacity: data.capacity ?? '?',
                    });
                });
                setAccommodations(places);
            },
            (err) => console.error("Chyba pri načítaní places:", err)
        );

        return () => unsubscribePlaces();
    }, []);

    // 2. Načítanie tímov – rozdelenie na s/bez ubytovania
    useEffect(() => {
        if (!window.db) return;

        const unsubscribeUsers = onSnapshot(
            collection(window.db, 'users'),
            (snapshot) => {
                const without = [];
                const withAcc = [];

                snapshot.forEach((doc) => {
                    const data = doc.data() || {};

                    if (data.teams && typeof data.teams === 'object') {
                        Object.entries(data.teams).forEach(([category, teamArray]) => {
                            if (!Array.isArray(teamArray)) return;

                            teamArray.forEach((team) => {
                                if (!team?.teamName) return;

                                const accType = team.accommodation?.type?.trim() || '';
                                const hasAccommodation = 
                                    accType !== '' && 
                                    accType.toLowerCase() !== 'bez ubytovania';

                                const teamInfo = {
                                    category,
                                    name: team.teamName.trim(),
                                    people: 
                                        (Array.isArray(team.playerDetails) ? team.playerDetails.length : 0) +
                                        (Array.isArray(team.womenTeamMemberDetails) ? team.womenTeamMemberDetails.length : 0) +
                                        (Array.isArray(team.menTeamMemberDetails) ? team.menTeamMemberDetails.length : 0) +
                                        (Array.isArray(team.driverDetailsFemale) ? team.driverDetailsFemale.length : 0) +
                                        (Array.isArray(team.driverDetailsMale) ? team.driverDetailsMale.length : 0),
                                };

                                if (hasAccommodation) {
                                    withAcc.push({ ...teamInfo, accommodation: accType });
                                } else {
                                    without.push(teamInfo);
                                }
                            });
                        });
                    }
                });

                setTeamsWithoutAccommodation(without);
                setTeamsWithAccommodation(withAcc); // voliteľné
                setLoading(false);
            },
            (err) => {
                console.error("Chyba pri načítaní users:", err);
                setLoading(false);
            }
        );

        return () => unsubscribeUsers();
    }, []);

    // ─── Render ───────────────────────────────────────────────────────
    if (loading) {
        return React.createElement(
            'div',
            { className: 'flex justify-center items-center h-full' },
            React.createElement('div', { className: 'animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500' })
        );
    }

    return React.createElement(
        'div',
        { className: 'flex-grow p-6 bg-gray-50' },
        React.createElement(
            'h2',
            { className: 'text-3xl font-bold text-center mb-8 text-gray-800' },
            'Ubytovanie tímov'
        ),

        // Dva stĺpce
        React.createElement(
            'div',
            { className: 'grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto' },

            // ─── Ľavý stĺpec: Tímy BEZ ubytovania ──────────────────────
            React.createElement(
                'div',
                { className: 'bg-white rounded-xl shadow-lg p-6 border border-red-100' },
                React.createElement(
                    'h3',
                    { className: 'text-xl font-semibold mb-4 text-red-700' },
                    `Tímy bez prideleného ubytovania (${teamsWithoutAccommodation.length})`
                ),
                teamsWithoutAccommodation.length === 0
                    ? React.createElement(
                        'p',
                        { className: 'text-gray-500 italic' },
                        'Všetky tímy už majú ubytovanie ✓'
                      )
                    : React.createElement(
                        'ul',
                        { className: 'space-y-3' },
                        teamsWithoutAccommodation.map((team, i) =>
                            React.createElement(
                                'li',
                                { key: i, className: 'flex justify-between items-center bg-red-50 p-3 rounded-lg' },
                                React.createElement(
                                    'div',
                                    null,
                                    React.createElement('span', { className: 'font-medium' }, `[${team.category}] ${team.name}`),
                                    React.createElement('span', { className: 'text-sm text-gray-600 ml-3' }, `(${team.people} ľudí)`)
                                )
                            )
                        )
                      )
            ),

            // ─── Pravý stĺpec: Dostupné ubytovne ───────────────────────
            React.createElement(
                'div',
                { className: 'bg-white rounded-xl shadow-lg p-6 border border-green-100' },
                React.createElement(
                    'h3',
                    { className: 'text-xl font-semibold mb-4 text-green-700' },
                    `Dostupné ubytovacie miesta (${accommodations.length})`
                ),
                accommodations.length === 0
                    ? React.createElement(
                        'p',
                        { className: 'text-gray-500 italic' },
                        'Žiadne ubytovacie miesta v databáze'
                      )
                    : React.createElement(
                        'ul',
                        { className: 'space-y-3' },
                        accommodations.map((place) =>
                            React.createElement(
                                'li',
                                { key: place.id, className: 'flex justify-between items-center bg-green-50 p-3 rounded-lg' },
                                React.createElement(
                                    'div',
                                    null,
                                    React.createElement('span', { className: 'font-medium' }, place.name),
                                    React.createElement(
                                        'span',
                                        { className: 'text-sm text-gray-600 ml-3' },
                                        `(${place.accommodationType}, kapacita: ${place.capacity})`
                                    )
                                )
                            )
                        )
                  )
            )
        )
    );
};

/**
 * Táto funkcia je poslucháčom udalosti 'globalDataUpdated'.
 * Akonáhle sa dáta používateľa načítajú, vykreslí aplikáciu MyDataApp.
 */
const handleDataUpdateAndRender = (event) => {
    const userProfileData = event.detail;
    const rootElement = document.getElementById('root');

    if (userProfileData) {
        // Synchronizácia emailu (pôvodná logika)
        if (window.auth && window.db && !isEmailSyncListenerSetup) {
            console.log("logged-in-teams-in-accomodation.js: Nastavujem poslucháča na synchronizáciu e-mailu.");
            
            onAuthStateChanged(window.auth, async (user) => {
                if (user) {
                    try {
                        const userProfileRef = doc(window.db, 'users', user.uid);
                        const docSnap = await getDoc(userProfileRef);

                        if (docSnap.exists()) {
                            const firestoreEmail = docSnap.data().email;
                            if (user.email !== firestoreEmail) {
                                console.log(`E-mail rozdiel: auth → ${user.email} vs firestore → ${firestoreEmail}`);
                                await updateDoc(userProfileRef, { email: user.email });

                                await addDoc(collection(window.db, 'notifications'), {
                                    userEmail: user.email,
                                    changes: `Zmena e-mailovej adresy z '${firestoreEmail}' na '${user.email}'.`,
                                    timestamp: new Date(),
                                });

                                window.showGlobalNotification('E-mail bol automaticky aktualizovaný.', 'success');
                            }
                        }
                    } catch (error) {
                        console.error("Chyba pri synchronizácii e-mailu:", error);
                        window.showGlobalNotification('Chyba pri synchronizácii e-mailu.', 'error');
                    }
                }
            });

            isEmailSyncListenerSetup = true;
        }

        // Vykreslenie
        if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
            const root = ReactDOM.createRoot(rootElement);
            root.render(React.createElement(AddGroupsApp, { userProfileData }));
            console.log("Aplikácia vykreslená (AddGroupsApp)");
        }
    } else {
        // loader ...
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

// Zaregistrujeme poslucháča udalosti 'globalDataUpdated'.
console.log("logged-in-teams-in-accomodation.js: Registrujem poslucháča pre 'globalDataUpdated'.");
window.addEventListener('globalDataUpdated', handleDataUpdateAndRender);

if (window.globalUserProfileData) {
    console.log("Globálne dáta už existujú → vykresľujem okamžite");
    handleDataUpdateAndRender({ detail: window.globalUserProfileData });
} else {
    // loader fallback
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
