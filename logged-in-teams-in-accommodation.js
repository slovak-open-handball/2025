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
        case 'error': typeClasses = 'bg-red-500 text-white'; break;
        case 'info': typeClasses = 'bg-blue-500 text-white'; break;
        default: typeClasses = 'bg-gray-700 text-white';
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
    const [isPlaceModalOpen, setIsPlaceModalOpen] = useState(false);
    const [selectedTeamForEdit, setSelectedTeamForEdit] = useState(null);
    const [newHeaderColor, setNewHeaderColor] = useState('#1e40af');
    const [newHeaderTextColor, setNewHeaderTextColor] = useState('#ffffff');
    const [selectedAccommodationForTeam, setSelectedAccommodationForTeam] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    // Real-time ubytovanie + headerColor + headerTextColor
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
                        headerColor: data.headerColor || '#1e40af',
                        headerTextColor: data.headerTextColor || '#ffffff',
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
                            teamArray.forEach((team, teamIndex) => {
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
                                    teamIndex, // ← uložíme index pre neskoršiu úpravu
                                    teamName: team.teamName.trim(),
                                    accommodation: accomType,
                                    totalPeople,
                                    userId: doc.id, // ← ID používateľa, aby sme vedeli kam ukladať
                                });
                            });
                        });
                    }
                });
                console.log("═══════════════════════════════════════════════════════════════════════════════════════");
                console.log(`TÍMY S UBYTOVANÍM — ${new Date().toLocaleTimeString('sk-SK')}`);
                console.log(`Celkom tímov s prideleným ubytovaním: ${withAccom.length}`);
                console.log("═══════════════════════════════════════════════════════════════════════════════════════");
                setTeamsWithAccom(withAccom);
            },
            (err) => console.error("[USERS]", err)
        );
        return () => unsubscribe();
    }, []);
    // Otvorenie modálu pre úpravu farby ubytovania
    const openEditPlaceModal = (place) => {
        setSelectedPlaceForEdit(place);
        setNewHeaderColor(place.headerColor || '#1e40af');
        setNewHeaderTextColor(place.headerTextColor || '#ffffff');
        setIsPlaceModalOpen(true);
    };
    // Otvorenie modálu pre priradenie ubytovania tímu
    const openAssignAccommodationModal = (team) => {
        setSelectedTeamForEdit(team);
        setSelectedAccommodationForTeam(team.accommodation || '');
        setIsModalOpen(true);
    };
    // Uloženie farby ubytovania
    const savePlaceColors = async () => {
        if (!selectedPlaceForEdit || !window.db) return;
        try {
            const placeRef = doc(window.db, 'places', selectedPlaceForEdit.id);
            await updateDoc(placeRef, {
                headerColor: newHeaderColor,
                headerTextColor: newHeaderTextColor
            });
            setAccommodations(prev =>
                prev.map(p =>
                    p.id === selectedPlaceForEdit.id
                        ? { ...p, headerColor: newHeaderColor, headerTextColor: newHeaderTextColor }
                        : p
                )
            );
            window.showGlobalNotification('Farba hlavičky bola aktualizovaná', 'success');
        } catch (err) {
            console.error("Chyba pri ukladaní farieb ubytovania:", err);
            window.showGlobalNotification('Nepodarilo sa uložiť farby', 'error');
        }
        setIsPlaceModalOpen(false);
        setSelectedPlaceForEdit(null);
    };
    // Uloženie priradeného ubytovania pre tím
    const saveTeamAccommodation = async () => {
        if (!selectedTeamForEdit || !window.db) return;
        const { userId, category, teamIndex } = selectedTeamForEdit;
        const selectedPlace = accommodations.find(p => p.name === selectedAccommodationForTeam);
        if (!selectedPlace) {
            window.showGlobalNotification('Nevybrali ste žiadne ubytovanie', 'error');
            return;
        }
        try {
            const userRef = doc(window.db, 'users', userId);
            const userSnap = await getDoc(userRef);
            if (!userSnap.exists()) throw new Error("Používateľ neexistuje");
            const userData = userSnap.data();
            const team = userData.teams?.[category]?.[teamIndex];
            if (!team) throw new Error("Tím nebol nájdený");
            // Aktualizujeme accommodation.name
            await updateDoc(userRef, {
                [`teams.${category}.${teamIndex}.accommodation`]: {
                    name: selectedPlace.name,
                    // môžeš pridať aj id, type atď. ak chceš
                }
            });
            window.showGlobalNotification(`Tím ${team.teamName} bol priradený k ubytovaniu ${selectedPlace.name}`, 'success');
        } catch (err) {
            console.error("Chyba pri priraďovaní ubytovania:", err);
            window.showGlobalNotification('Nepodarilo sa priradiť ubytovanie', 'error');
        }
        setIsModalOpen(false);
        setSelectedTeamForEdit(null);
        setSelectedAccommodationForTeam('');
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
   
                // 1. Ľavá strana – Tímy s prideleným ubytovaním + ikona ceruzky
                React.createElement(
                    'div',
                    { className: 'order-2 lg:order-1' },
                    React.createElement(
                        'div',
                        { className: 'bg-white rounded-xl shadow-lg overflow-hidden h-full flex flex-col' },
                        React.createElement(
                            'div',
                            { className: 'bg-green-700 text-white px-6 py-4' },
                            React.createElement(
                                'h2',
                                { className: 'text-xl font-bold' },
                                `Tímy s prideleným ubytovaním (${teamsWithAccom.length})`
                            )
                        ),
                        React.createElement(
                            'div',
                            { className: 'p-6 flex-grow overflow-y-auto' },
                            teamsWithAccom.length === 0
                                ? React.createElement(
                                    'p',
                                    { className: 'text-gray-500 text-center py-12' },
                                    'Zatiaľ žiadny tím nemá pridelené ubytovanie'
                                  )
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
                                                { className: 'flex items-center gap-3 flex-1' },
                                                React.createElement(
                                                    'span',
                                                    { className: 'font-medium' },
                                                    `[${team.category}] ${team.teamName}`
                                                ),
                                                React.createElement(
                                                    'span',
                                                    { className: 'text-gray-500 text-sm ml-3' },
                                                    `(${team.totalPeople} ľudí)`
                                                )
                                            ),
                                            React.createElement(
                                                'div',
                                                { className: 'flex items-center gap-4' },
                                                React.createElement(
                                                    'span',
                                                    { className: 'font-medium text-green-700' },
                                                    team.accommodation
                                                ),
                                                React.createElement(
                                                    'button',
                                                    {
                                                        onClick: () => openAssignAccommodationModal(team),
                                                        className: 'text-gray-600 hover:text-blue-600 transition-colors focus:outline-none'
                                                    },
                                                    React.createElement(
                                                        'svg',
                                                        {
                                                            className: 'w-5 h-5',
                                                            fill: 'none',
                                                            stroke: 'currentColor',
                                                            viewBox: '0 0 24 24',
                                                            strokeWidth: '2'
                                                        },
                                                        React.createElement('path', {
                                                            strokeLinecap: 'round',
                                                            strokeLinejoin: 'round',
                                                            d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z'
                                                        })
                                                    )
                                                )
                                            )
                                        )
                                    )
                                  )
                        )
                    )
                ),
   
                // 2. Pravá strana – Ubytovacie miesta + zoznam priradených tímov
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
                        : accommodations.map((place) => {
                            // Filtrujeme tímy priradené k tomuto ubytovaniu
                            const assignedTeams = teamsWithAccom.filter(
                                t => t.accommodation === place.name
                            );
   
                            return React.createElement(
                                'div',
                                {
                                    key: place.id,
                                    className: 'bg-white rounded-xl shadow-lg overflow-hidden relative'
                                },
                                // Hlavička ubytovne
                                React.createElement(
                                    'div',
                                    {
                                        className: 'text-white px-6 py-4 relative flex items-center justify-between',
                                        style: {
                                            backgroundColor: place.headerColor,
                                            color: place.headerTextColor || '#ffffff'
                                        }
                                    },
                                    React.createElement(
                                        'h3',
                                        { className: 'text-xl font-bold' },
                                        place.name || 'Ubytovacie miesto'
                                    ),
                                    React.createElement(
                                        'button',
                                        {
                                            onClick: () => openEditPlaceModal(place),
                                            className: 'flex items-center gap-1.5 px-4 py-1.5 bg-white text-black hover:bg-gray-100 active:bg-gray-200 transition-colors text-sm font-medium rounded-full border border-gray-300 shadow-sm'
                                        },
                                        React.createElement(
                                            'svg',
                                            { className: 'w-4 h-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
                                            React.createElement('path', {
                                                strokeLinecap: 'round',
                                                strokeLinejoin: 'round',
                                                strokeWidth: '2',
                                                d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z'
                                            })
                                        ),
                                        React.createElement('span', null, 'Upraviť')
                                    )
                                ),
   
                                // Obsah karty
                                React.createElement(
                                    'div',
                                    { className: 'p-6 space-y-6' },
                                    // Info o ubytovni
                                    React.createElement(
                                        'div',
                                        { className: 'flex flex-wrap items-baseline gap-x-8 gap-y-2 pb-4 border-b border-gray-200' },
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
                                    ),
   
                                    // Sekcia priradených tímov
                                    React.createElement(
                                        'div',
                                        null,
                                        React.createElement(
                                            'h4',
                                            { className: 'text-lg font-semibold text-gray-800 mb-3' },
                                            assignedTeams.length > 0
                                                ? `Priradené tímy (${assignedTeams.length})`
                                                : 'Zatiaľ žiadny tím nepriradený'
                                        ),
                                        assignedTeams.length === 0
                                            ? React.createElement(
                                                'p',
                                                { className: 'text-gray-500 text-sm italic' },
                                                'Priraďte tímy pomocou ikony ceruzky vľavo'
                                              )
                                            : React.createElement(
                                                'ul',
                                                { className: 'space-y-2' },
                                                assignedTeams.map((team, idx) =>
                                                    React.createElement(
                                                        'li',
                                                        {
                                                            key: idx,
                                                            className: 'flex justify-between items-center bg-gray-50 px-4 py-2.5 rounded border-l-4 border-green-400 text-sm'
                                                        },
                                                        React.createElement(
                                                            'span',
                                                            { className: 'font-medium' },
                                                            `[${team.category}] ${team.teamName}`
                                                        ),
                                                        React.createElement(
                                                            'span',
                                                            { className: 'text-gray-600' },
                                                            `${team.totalPeople} ľudí`
                                                        )
                                                    )
                                                )
                                              )
                                    )
                                )
                            );
                          })
                )
            ),
   
            // Modálne okno pre priradenie ubytovania tímu
            isModalOpen &&
            React.createElement(
                'div',
                {
                    className: 'fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[10001]',
                    onClick: (e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }
                },
                React.createElement(
                    'div',
                    { className: 'bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto' },
                    React.createElement(
                        'h3',
                        { className: 'text-2xl font-bold mb-2' },
                        'Priradiť ubytovanie'
                    ),
                    React.createElement(
                        'p',
                        { className: 'text-gray-600 mb-6' },
                        selectedTeamForEdit?.teamName || 'Tím'
                    ),
                    React.createElement(
                        'div',
                        { className: 'mb-6' },
                        React.createElement(
                            'label',
                            { className: 'block text-sm font-medium text-gray-700 mb-2' },
                            'Vyberte ubytovacie miesto'
                        ),
                        React.createElement(
                            'select',
                            {
                                value: selectedAccommodationForTeam,
                                onChange: (e) => setSelectedAccommodationForTeam(e.target.value),
                                className: 'w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                            },
                            React.createElement('option', { value: '' }, '— Vyberte ubytovanie —'),
                            accommodations.map(place =>
                                React.createElement(
                                    'option',
                                    { key: place.id, value: place.name },
                                    `${place.name} (${place.capacity || '?'} miest)`
                                )
                            )
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'flex justify-end gap-4 mt-8' },
                        React.createElement(
                            'button',
                            {
                                onClick: () => setIsModalOpen(false),
                                className: 'px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition'
                            },
                            'Zrušiť'
                        ),
                        React.createElement(
                            'button',
                            {
                                onClick: saveTeamAccommodation,
                                className: 'px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition'
                            },
                            'Priradiť'
                        )
                    )
                )
            ),
   
            // Modálne okno pre úpravu farieb ubytovania
            isPlaceModalOpen &&
            React.createElement(
                'div',
                {
                    className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]',
                    onClick: (e) => { if (e.target === e.currentTarget) setIsPlaceModalOpen(false); }
                },
                React.createElement(
                    'div',
                    { className: 'bg-white rounded-xl shadow-2xl p-8 max-w-md w-full mx-4' },
                    React.createElement(
                        'div',
                        { className: 'mb-6' },
                        React.createElement(
                            'h3',
                            { className: 'text-xl font-bold text-gray-900 inline' },
                            'Upraviť farby'
                        ),
                        React.createElement(
                            'span',
                            { className: 'text-lg font-medium text-gray-600 ml-2' },
                            '– ' + (selectedPlaceForEdit?.name || 'Ubytovacie miesto')
                        )
                    ),
                    // Farba pozadia
                    React.createElement('div', { className: 'mb-10' },
                        React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-3' }, 'Farba pozadia hlavičky'),
                        React.createElement(
                            'div',
                            { className: 'flex flex-col items-center gap-4' },
                            React.createElement('input', {
                                type: 'color',
                                value: newHeaderColor,
                                onChange: (e) => setNewHeaderColor(e.target.value),
                                className: 'w-32 h-32 rounded-lg cursor-pointer border-2 border-gray-300 shadow-md'
                            }),
                            React.createElement(
                                'div',
                                { className: 'w-full text-center text-sm text-gray-600 space-y-1 font-mono' },
                                React.createElement('div', null, `HEX: ${newHeaderColor}`),
                                React.createElement('div', null, `RGB: ${hexToRgb(newHeaderColor)}`),
                                React.createElement('div', null, `HSL: ${hexToHsl(newHeaderColor)}`)
                            )
                        )
                    ),
                    // Farba textu – len dva tlačidlá
                    React.createElement('div', { className: 'mb-10' },
                        React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-3' }, 'Farba textu názvu'),
                        React.createElement(
                            'div',
                            { className: 'flex gap-4' },
                            React.createElement(
                                'button',
                                {
                                    type: 'button',
                                    onClick: () => setNewHeaderTextColor('#ffffff'),
                                    className: `flex-1 px-5 py-3 rounded-lg border text-center font-medium transition-all ${
                                        newHeaderTextColor === '#ffffff'
                                            ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                                            : 'border-gray-300 hover:bg-gray-50'
                                    }`,
                                    style: { backgroundColor: '#ffffff', color: '#000000' }
                                },
                                'Biela'
                            ),
                            React.createElement(
                                'button',
                                {
                                    type: 'button',
                                    onClick: () => setNewHeaderTextColor('#000000'),
                                    className: `flex-1 px-5 py-3 rounded-lg border text-center font-medium transition-all ${
                                        newHeaderTextColor === '#000000'
                                            ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                                            : 'border-gray-300 hover:bg-gray-50'
                                    }`,
                                    style: { backgroundColor: '#000000', color: '#ffffff' }
                                },
                                'Čierna'
                            )
                        )
                    ),
                    // Tlačidlá
                    React.createElement(
                        'div',
                        { className: 'flex justify-end gap-4 mt-8' },
                        React.createElement(
                            'button',
                            {
                                onClick: () => setIsPlaceModalOpen(false),
                                className: 'px-6 py-2.5 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition'
                            },
                            'Zrušiť'
                        ),
                        React.createElement(
                            'button',
                            {
                                onClick: savePlaceColors,
                                className: 'px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition'
                            },
                            'Uložiť'
                        )
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
