// Importy pre Firebase funkcie
import { doc, getDoc, onSnapshot, updateDoc, addDoc, collection, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const { useState, useEffect } = React;

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
    setTimeout(() => { notificationElement.className = `${baseClasses} ${typeClasses} opacity-100 scale-100`; }, 10);
    setTimeout(() => { notificationElement.className = `${baseClasses} ${typeClasses} opacity-0 scale-95`; }, 5000);
};

let isEmailSyncListenerSetup = false;

const AddGroupsApp = ({ userProfileData }) => {
    const [accommodations, setAccommodations] = useState([]);
    const [teamsWithAccom, setTeamsWithAccom] = useState([]);
    const [selectedPlaceForEdit, setSelectedPlaceForEdit] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newHeaderColor, setNewHeaderColor] = useState('#1e40af');

    // Real-time ubytovanie + headerColor
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
                        accommodationType: data.accommodationType || null,
                        capacity: data.capacity ?? null,
                        headerColor: data.headerColor || '#1e40af',  // fallback tmavomodrá
                    });
                });

                console.clear();
                console.log("═══════════════════════════════════════════════════");
                console.log(`NAČÍTANÉ UBYTOVANIE — ${new Date().toLocaleTimeString('sk-SK')}`);
                console.log(`Celkový počet: ${places.length}`);
                console.log("═══════════════════════════════════════════════════");
                setAccommodations(places);
            },
            (err) => console.error("[PLACES]", err)
        );
        return () => unsubscribe();
    }, []);

    // Real-time tímy – iba tímy S ubytovaním
    useEffect(() => {
        if (!window.db) return;
        const unsubscribe = onSnapshot(
            collection(window.db, 'users'),
            (snapshot) => {
                const withAccom = [];
                snapshot.forEach((doc) => {
                    const data = doc.data() || {};
                    if (data.teams && typeof data.teams === 'object') {
                        Object.entries(data.teams).forEach(([category, teamArray]) => {
                            if (!Array.isArray(teamArray)) return;
                            teamArray.forEach((team) => {
                                if (!team?.teamName) return;
                                const accomType = team.accommodation?.type?.trim?.() || '';
                                const hasAccommodation = accomType !== '' && accomType.toLowerCase() !== 'bez ubytovania';
                                if (!hasAccommodation) return;

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
            },
            (err) => console.error("[USERS]", err)
        );
        return () => unsubscribe();
    }, []);

    // Otvorenie modálu
    const openEditModal = (place) => {
        setSelectedPlaceForEdit(place);
        setNewHeaderColor(place.headerColor || '#1e40af');
        setIsModalOpen(true);
    };

    // Uloženie farby
    const saveHeaderColor = async () => {
        if (!selectedPlaceForEdit || !window.db) return;

        try {
            const placeRef = doc(window.db, 'places', selectedPlaceForEdit.id);
            await updateDoc(placeRef, { headerColor: newHeaderColor });

            setAccommodations(prev =>
                prev.map(p =>
                    p.id === selectedPlaceForEdit.id ? { ...p, headerColor: newHeaderColor } : p
                )
            );

            window.showGlobalNotification('Farba hlavičky bola aktualizovaná', 'success');
        } catch (err) {
            console.error("Chyba pri ukladaní farby:", err);
            window.showGlobalNotification('Nepodarilo sa uložiť farbu', 'error');
        }

        setIsModalOpen(false);
        setSelectedPlaceForEdit(null);
    };

    // ──────────────────────────────────────────────
    // RENDER
    // ──────────────────────────────────────────────
    return React.createElement(
        'div',
        { className: 'min-h-screen bg-gray-50 py-8 px-4' },
        React.createElement(
            'div',
            { className: 'max-w-7xl mx-auto' },

            React.createElement(
                'div',
                { className: 'grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10' },

                // Ľavá strana – Tímy
                React.createElement(
                    'div',
                    { className: 'order-2 lg:order-1' },
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
                            { className: 'p-6 flex-grow overflow-y-auto' },
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

                // Pravá strana – Ubytovacie miesta
                React.createElement(
                    'div',
                    { className: 'order-1 lg:order-2 space-y-6' },
                    React.createElement(
                        'h2',
                        { className: 'text-2xl font-bold text-gray-800 mb-4 lg:hidden' },
                        'Dostupné ubytovacie kapacity'
                    ),
                    accommodations.length === 0
                        ? React.createElement(
                            'div',
                            { className: 'bg-white rounded-xl shadow-lg p-8 text-center' },
                            React.createElement('p', { className: 'text-gray-500 text-lg' }, 'Zatiaľ žiadne ubytovacie miesta...')
                          )
                        : accommodations.map((place) =>
                            React.createElement(
                                'div',
                                { key: place.id, className: 'bg-white rounded-xl shadow-lg overflow-hidden relative' },
                                React.createElement(
                                    'div',
                                    {
                                        className: 'text-white px-6 py-4 relative flex items-center justify-between',
                                        style: { backgroundColor: place.headerColor }
                                    },
                                    React.createElement('h3', { className: 'text-xl font-bold' }, place.name || 'Ubytovacie miesto'),
                                    React.createElement(
                                        'button',
                                        {
                                            onClick: () => openEditModal(place),
                                            className: 'flex items-center gap-1.5 text-white hover:text-gray-200 transition-colors text-sm font-medium'
                                        },
                                        // Nahradili sme emoji ceruzky SVG ikonou
                                        React.createElement(
                                            'svg',
                                            { className: 'w-5 h-5', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
                                            React.createElement('path', {
                                                strokeLinecap: 'round',
                                                strokeLinejoin: 'round',
                                                strokeWidth: '2',
                                                d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z'
                                            })
                                        ),
                                        React.createElement('span', null, 'upraviť')
                                    )
                                ),
                                React.createElement(
                                    'div',
                                    { className: 'p-6' },
                                    React.createElement(
                                        'div',
                                        { className: 'space-y-4' },
                                        React.createElement(
                                            'div',
                                            { className: 'flex flex-wrap items-baseline gap-x-6 gap-y-1' },
                                            React.createElement(
                                                'p',
                                                { className: 'text-gray-700' },
                                                React.createElement('span', { className: 'font-semibold' }, 'Typ: '),
                                                place.accommodationType || 'neurčený'
                                            ),
                                            place.capacity !== null &&
                                                React.createElement(
                                                    'p',
                                                    { className: 'text-gray-700' },
                                                    React.createElement('span', { className: 'font-semibold' }, 'Kapacita: '),
                                                    `${place.capacity} miest`
                                                )
                                        )
                                    )
                                )
                            )
                      )
                )
            )
        ),

        // Modálne okno
        isModalOpen &&
        React.createElement(
            'div',
            {
                className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]',
                onClick: (e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }
            },
            React.createElement(
                'div',
                { className: 'bg-white rounded-xl shadow-2xl p-8 max-w-md w-full mx-4' },
                React.createElement('h3', { className: 'text-xl font-bold mb-6' }, 'Upraviť farbu hlavičky'),
                React.createElement('p', { className: 'text-gray-600 mb-4' }, selectedPlaceForEdit?.name || 'Ubytovacie miesto'),
                React.createElement(
                    'div',
                    { className: 'flex items-center gap-6 mb-8' },
                    React.createElement('input', {
                        type: 'color',
                        value: newHeaderColor,
                        onChange: (e) => setNewHeaderColor(e.target.value),
                        className: 'w-24 h-24 rounded-lg cursor-pointer border-2 border-gray-300 shadow-sm'
                    }),
                    React.createElement(
                        'div',
                        { className: 'flex-1' },
                        React.createElement('div', {
                            className: 'w-full h-16 rounded-lg shadow-inner border border-gray-200',
                            style: { backgroundColor: newHeaderColor }
                        }),
                        React.createElement('p', { className: 'text-center text-sm text-gray-600 mt-2 font-mono' }, newHeaderColor)
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'flex justify-end gap-4' },
                    React.createElement(
                        'button',
                        {
                            onClick: () => setIsModalOpen(false),
                            className: 'px-6 py-2.5 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition'
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            onClick: saveHeaderColor,
                            className: 'px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition'
                        },
                        'Uložiť'
                    )
                )
            )
        )
    );
};

/* ──────────────────────────────────────────────
   Zvyšok kódu (handleDataUpdateAndRender, event listener, loader) ostáva BEZ ZMENY
─────────────────────────────────────────────── */

const handleDataUpdateAndRender = (event) => {
    const userProfileData = event.detail;
    const rootElement = document.getElementById('root');
    if (userProfileData) {
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

        if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
            const root = ReactDOM.createRoot(rootElement);
            root.render(React.createElement(AddGroupsApp, { userProfileData }));
            console.log("Aplikácia vykreslená (AddGroupsApp)");
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

console.log("logged-in-teams-in-accomodation.js: Registrujem poslucháča pre 'globalDataUpdated'.");
window.addEventListener('globalDataUpdated', handleDataUpdateAndRender);

if (window.globalUserProfileData) {
    console.log("Globálne dáta už existujú → vykresľujem okamžite");
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
