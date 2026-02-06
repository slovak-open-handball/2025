
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
    const [accommodations, setAccommodations] = useState([]);
    const [teamsWithAccom, setTeamsWithAccom] = useState([]);
    // const [teamsWithoutAccom, setTeamsWithoutAccom] = useState([]);  ← už nepotrebujeme

    // ──────────────────────────────────────────────
    // Real-time ubytovanie (type = "ubytovanie") — BEZ ZMENY
    // ──────────────────────────────────────────────
    useEffect(() => {
        if (!window.db) return;
        const unsubscribe = onSnapshot(
            collection(window.db, 'places'),
            (snapshot) => {
                const places = [];
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    if (data.type !== "ubytovanie") return;
                    places.push({
                        id: doc.id,
                        name: data.name || '(bez názvu)',
                        type: data.type || '?',
                        lat: data.lat ?? data.location?.latitude ?? '?',
                        lng: data.lng ?? data.location?.longitude ?? '?',
                        accommodationType: data.accommodationType || null,
                        capacity: data.capacity ?? null,
                        createdAt: data.createdAt
                            ? new Date(data.createdAt.toMillis()).toLocaleString('sk-SK')
                            : '?',
                    });
                });

                console.clear();
                console.log("═══════════════════════════════════════════════════");
                console.log(`NAČÍTANÉ UBYTOVANIE — ${new Date().toLocaleTimeString('sk-SK')}`);
                console.log(`Celkový počet: ${places.length}`);
                console.log("═══════════════════════════════════════════════════");
                // ... zvyšok console.log bez zmeny ...

                setAccommodations(places);
            },
            (err) => console.error("[PLACES]", err)
        );
        return () => unsubscribe();
    }, []);

    // ──────────────────────────────────────────────
    // Real-time tímy – iba tímy S ubytovaním
    // ──────────────────────────────────────────────
    useEffect(() => {
        if (!window.db) return;
        const unsubscribe = onSnapshot(
            collection(window.db, 'users'),
            (snapshot) => {
                const withAccom = [];
                // withoutAccom už nezbierame

                snapshot.forEach((doc) => {
                    const data = doc.data() || {};
                    if (data.teams && typeof data.teams === 'object') {
                        Object.entries(data.teams).forEach(([category, teamArray]) => {
                            if (!Array.isArray(teamArray)) return;
                            teamArray.forEach((team) => {
                                if (!team?.teamName) return;

                                const accomType = team.accommodation?.type?.trim?.() || '';
                                const hasAccommodation =
                                    accomType !== '' &&
                                    accomType.toLowerCase() !== 'bez ubytovania';

                                if (!hasAccommodation) return; // ← TU JE HLAVNÁ ZMENA – preskočíme

                                const playerCount = Array.isArray(team.playerDetails) ? team.playerDetails.length : 0;
                                const womenRTCount = Array.isArray(team.womenTeamMemberDetails) ? team.womenTeamMemberDetails.length : 0;
                                const menRTCount = Array.isArray(team.menTeamMemberDetails) ? team.menTeamMemberDetails.length : 0;
                                const femaleDrivers = Array.isArray(team.driverDetailsFemale) ? team.driverDetailsFemale.length : 0;
                                const maleDrivers = Array.isArray(team.driverDetailsMale) ? team.driverDetailsMale.length : 0;
                                const totalPeople = playerCount + womenRTCount + menRTCount + femaleDrivers + maleDrivers;

                                withAccom.push({
                                    category,
                                    teamName: team.teamName.trim(),
                                    accommodation: accomType,
                                    totalPeople,
                                });
                            });
                        });
                    }
                });

                // Console log – zachovaný
                console.log("═══════════════════════════════════════════════════════════════════════════════════════");
                console.log(`TÍMY S UBYTOVANÍM — ${new Date().toLocaleTimeString('sk-SK')}`);
                console.log(`Celkom tímov s prideleným ubytovaním: ${withAccom.length}`);
                console.log("═══════════════════════════════════════════════════════════════════════════════════════");
                if (withAccom.length === 0) {
                    console.log("Momentálne žiadny tím nemá pridelené ubytovanie");
                } else {
                    console.log("Zoznam tímov s ubytovaním:");
                    withAccom.forEach((t, i) => {
                        console.log(` [${t.category}] ${t.teamName.padEnd(38)} → ${t.accommodation.padEnd(22)} (ľudia: ${t.totalPeople})`);
                    });
                }
                console.log("═══════════════════════════════════════════════════════════════════════════════════════");

                setTeamsWithAccom(withAccom);
                // setTeamsWithoutAccom už nevoláme
            },
            (err) => console.error("[USERS]", err)
        );
        return () => unsubscribe();
    }, []);

    // ──────────────────────────────────────────────
    // RENDER – bez oranžovej sekcie
    // ──────────────────────────────────────────────
    return React.createElement(
        'div',
        { className: 'min-h-screen bg-gray-50 py-8 px-4' },
        React.createElement(
            'div',
            { className: 'max-w-7xl mx-auto' },  // trochu širší kontajner
    
            // Hlavný grid – 2 stĺpce na lg+, na menších 1 stĺpec
            React.createElement(
                'div',
                { className: 'grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10' },
    
                // 1. Ľavá polovica – Tímy s ubytovaním
                React.createElement(
                    'div',
                    { className: 'order-2 lg:order-1' },  // na mobile dole, na lg hore vľavo
                    React.createElement(
                        'div',
                        { className: 'bg-white rounded-xl shadow-lg overflow-hidden h-full flex flex-col' },
                        React.createElement(
                            'div',
                            { className: 'bg-green-700 text-white px-6 py-4' },
                            React.createElement('h2', { className: 'text-xl font-bold' }, `Tímy s prideleným ubytovaním (${teamsWithAccom.length})`)
                        ),
                        React.createElement(
                            'div',
                            { className: 'p-6 flex-grow' },
                            teamsWithAccom.length === 0
                                ? React.createElement('p', { className: 'text-gray-500 text-center py-12' }, 'Zatiaľ žiadny tím nemá pridelené ubytovanie')
                                : React.createElement(
                                    'ul',
                                    { className: 'space-y-3' },
                                    teamsWithAccom.map((team, i) =>
                                        React.createElement(
                                            'li',
                                            {
                                                key: i,
                                                className: 'flex justify-between items-center py-3 px-4 bg-gray-50 rounded border-l-4 border-green-500'
                                            },
                                            React.createElement(
                                                'div',
                                                null,
                                                React.createElement('span', { className: 'font-medium' }, `[${team.category}] ${team.teamName}`),
                                                React.createElement('span', { className: 'text-gray-500 ml-3 text-sm' }, `(${team.totalPeople} ľudí)`)
                                            ),
                                            React.createElement('span', { className: 'font-medium text-green-700' }, team.accommodation)
                                        )
                                    )
                                )
                        )
                    )
                ),
    
                // 2. Pravá polovica – Ubytovacie kapacity
                React.createElement(
                    'div',
                    { className: 'order-1 lg:order-2' },  // na mobile hore, na lg vpravo
                    React.createElement(
                        'div',
                        { className: 'bg-white rounded-xl shadow-lg overflow-hidden h-full flex flex-col' },
                        React.createElement(
                            'div',
                            { className: 'bg-blue-700 text-white px-6 py-4' },
                            React.createElement('h2', { className: 'text-xl font-bold' }, 'Dostupné ubytovacie kapacity')
                        ),
                        React.createElement(
                            'div',
                            { className: 'p-6 flex-grow' },
                            accommodations.length === 0
                                ? React.createElement('p', { className: 'text-gray-500 text-center py-12' }, 'Zatiaľ žiadne ubytovacie miesta...')
                                : React.createElement(
                                    'div',
                                    { className: 'grid grid-cols-1 md:grid-cols-2 gap-6' },  // vnútorný grid – 2 stĺpce na md+
                                    accommodations.map((place) =>
                                        React.createElement(
                                            'div',
                                            {
                                                key: place.id,
                                                className: 'border rounded-lg p-5 hover:shadow-md transition-shadow bg-gray-50'
                                            },
                                            React.createElement('h3', { className: 'font-bold text-lg mb-2' }, place.name),
                                            React.createElement('p', { className: 'text-sm text-gray-600 mb-1' }, `Typ: ${place.accommodationType || 'neurčený'}`),
                                            place.capacity !== null && React.createElement('p', { className: 'text-sm font-medium' }, `Kapacita: ${place.capacity} miest`),
                                            React.createElement('p', { className: 'text-xs text-gray-500 mt-3' }, `ID: ${place.id.slice(0,8)}…`)
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
