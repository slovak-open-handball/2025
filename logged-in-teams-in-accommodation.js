// Importy pre Firebase funkcie
import { doc, getDoc, onSnapshot, updateDoc, addDoc, collection, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js"; // OPRAVENÉ: z /js/ na /js9/

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
    const [allTeams, setAllTeams] = useState([]);
    const [selectedPlaceForEdit, setSelectedPlaceForEdit] = useState(null);
    const [isColorModalOpen, setIsColorModalOpen] = useState(false);
    const [newHeaderColor, setNewHeaderColor] = useState('#1e40af');
    const [newHeaderTextColor, setNewHeaderTextColor] = useState('#ffffff');
    
    // Nové stavy pre priradenie ubytovne
    const [selectedTeam, setSelectedTeam] = useState(null);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [availableAccommodations, setAvailableAccommodations] = useState([]);
    const [selectedAccommodationId, setSelectedAccommodationId] = useState('');
    const [isLoading, setIsLoading] = useState(false);

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
                        headerColor: data.headerColor || '#1e40af',
                        headerTextColor: data.headerTextColor || '#ffffff',
                        assignedTeams: [] // Pridáme pole pre priradené tímy
                    });
                });

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

    // Real-time tímy – všetky tímy s ubytovaním
    useEffect(() => {
        if (!window.db) return;
        const unsubscribe = onSnapshot(
            collection(window.db, 'users'),
            (snapshot) => {
                const teams = [];
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

                                teams.push({
                                    category,
                                    teamName: team.teamName.trim(),
                                    accommodation: accomType,
                                    totalPeople,
                                    fullTeamData: team,
                                    userId: doc.id,
                                    teamId: team.teamId || team.teamName.toLowerCase().replace(/\s+/g, '-'),
                                    assignedPlace: team.accommodation?.name || null,
                                    teamPath: {
                                        userId: doc.id,
                                        category: category,
                                        teamIndex: teamArray.indexOf(team)
                                    }
                                });
                            });
                        });
                    }
                });

                console.log("═══════════════════════════════════════════════════════════════════════════════════════");
                console.log(`VŠETKY TÍMY S UBYTOVANÍM — ${new Date().toLocaleTimeString('sk-SK')}`);
                console.log(`Celkom tímov: ${teams.length}`);
                console.log("═══════════════════════════════════════════════════════════════════════════════════════");
                setAllTeams(teams);
            },
            (err) => console.error("[USERS]", err)
        );
        return () => unsubscribe();
    }, []);

    // Funkcia na zoradenie tímov: najprv podľa kategórie (A-Z), potom podľa názvu tímu (A-Z)
    const sortTeams = (teams) => {
        return [...teams].sort((a, b) => {
            // Porovnanie kategórií
            const categoryCompare = a.category.localeCompare(b.category, 'sk', { sensitivity: 'base' });
            if (categoryCompare !== 0) return categoryCompare;
            
            // Ak sú kategórie rovnaké, porovnanie názvov tímov
            return a.teamName.localeCompare(b.teamName, 'sk', { sensitivity: 'base' });
        });
    };

    // Rozdelenie tímov na priradené a nepriradené a ich zoradenie
    const unassignedTeams = sortTeams(allTeams.filter(team => !team.assignedPlace));
    const assignedTeams = sortTeams(allTeams.filter(team => team.assignedPlace));

    // Priradenie tímov ku konkrétnym ubytovniam - UPRAVENÉ pre správne získanie dát
    const accommodationsWithTeams = accommodations.map(place => {
        const teamsInPlace = sortTeams(assignedTeams.filter(team => team.assignedPlace === place.name));
        const usedCapacity = teamsInPlace.reduce((sum, team) => sum + team.totalPeople, 0);
        const remainingCapacity = place.capacity !== null ? place.capacity - usedCapacity : null;
        
        return {
            ...place,
            assignedTeams: teamsInPlace,
            usedCapacity: usedCapacity,
            remainingCapacity: remainingCapacity
        };
    });

    // Otvorenie modálu pre farby
    const openEditModal = (place) => {
        setSelectedPlaceForEdit(place);
        setNewHeaderColor(place.headerColor || '#1e40af');
        setNewHeaderTextColor(place.headerTextColor || '#ffffff');
        setIsColorModalOpen(true);
    };

    // Uloženie farby
    const saveHeaderColor = async () => {
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
            console.error("Chyba pri ukladaní farby:", err);
            window.showGlobalNotification('Nepodarilo sa uložiť farbu', 'error');
        }

        setIsColorModalOpen(false);
        setSelectedPlaceForEdit(null);
    };

    // Otvorenie modálu pre priradenie ubytovne
    const openAssignModal = async (team) => {
        setSelectedTeam(team);
        setIsLoading(true);
        
        // Filtrovanie ubytovní podľa typu tímu
        const filteredAccommodations = accommodationsWithTeams.filter(place => 
            place.accommodationType && 
            team.accommodation && 
            place.accommodationType.toLowerCase().includes(team.accommodation.toLowerCase())
        );
        
        setAvailableAccommodations(filteredAccommodations);
        
        // Ak tímy už má priradenú ubytovňu, nastavíme ju ako predvolenú
        if (team.assignedPlace) {
            const assignedPlace = filteredAccommodations.find(p => p.name === team.assignedPlace);
            if (assignedPlace) {
                setSelectedAccommodationId(assignedPlace.id);
            }
        } else {
            setSelectedAccommodationId('');
        }
        
        setIsLoading(false);
        setIsAssignModalOpen(true);
    };

    // Uloženie priradenia ubytovne
    const saveAccommodationAssignment = async () => {
        if (!selectedTeam || !selectedAccommodationId || !window.db) return;

        const selectedPlace = availableAccommodations.find(p => p.id === selectedAccommodationId);
        if (!selectedPlace) return;

        setIsLoading(true);

        try {
            // 1. Načítanie aktuálnych dát používateľa
            const userRef = doc(window.db, 'users', selectedTeam.userId);
            const userDoc = await getDoc(userRef);
            
            if (!userDoc.exists()) {
                throw new Error('Používateľský dokument neexistuje');
            }

            const userData = userDoc.data();
            const teams = userData.teams || {};
            const teamArray = teams[selectedTeam.category] || [];

            // 2. Aktualizácia konkrétneho tímu
            const updatedTeamArray = teamArray.map(teamItem => {
                if (teamItem.teamName === selectedTeam.teamName) {
                    return {
                        ...teamItem,
                        accommodation: {
                            ...teamItem.accommodation,
                            name: selectedPlace.name
                        }
                    };
                }
                return teamItem;
            });

            // 3. Uloženie späť do Firebase
            await updateDoc(userRef, {
                [`teams.${selectedTeam.category}`]: updatedTeamArray
            });

            window.showGlobalNotification(
                `Tím "${selectedTeam.teamName}" bol priradený do "${selectedPlace.name}"`,
                'success'
            );

            // 5. Zavretie modálu a reset stavu
            setIsAssignModalOpen(false);
            setSelectedTeam(null);
            setSelectedAccommodationId('');

        } catch (err) {
            console.error("Chyba pri ukladaní priradenia:", err);
            window.showGlobalNotification('Nepodarilo sa priradiť ubytovňu', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    // Odstránenie priradenia tímu
    const removeTeamAssignment = async (team) => {
        if (!window.db) return;

        const confirmRemove = window.confirm(`Naozaj chcete odstrániť priradenie tímu "${team.teamName}" z ubytovne "${team.assignedPlace}"?`);
        if (!confirmRemove) return;

        setIsLoading(true);

        try {
            // 1. Načítanie aktuálnych dát používateľa
            const userRef = doc(window.db, 'users', team.userId);
            const userDoc = await getDoc(userRef);
            
            if (!userDoc.exists()) {
                throw new Error('Používateľský dokument neexistuje');
            }

            const userData = userDoc.data();
            const teams = userData.teams || {};
            const teamArray = teams[team.category] || [];

            // 2. Odstránenie priradenia ubytovne
            const updatedTeamArray = teamArray.map(teamItem => {
                if (teamItem.teamName === team.teamName) {
                    return {
                        ...teamItem,
                        accommodation: {
                            ...teamItem.accommodation,
                            name: null
                        }
                    };
                }
                return teamItem;
            });

            // 3. Uloženie späť do Firebase
            await updateDoc(userRef, {
                [`teams.${team.category}`]: updatedTeamArray
            });

            window.showGlobalNotification(
                `Priradenie tímu "${team.teamName}" bolo odstránené`,
                'success'
            );

        } catch (err) {
            console.error("Chyba pri odstraňovaní priradenia:", err);
            window.showGlobalNotification('Nepodarilo sa odstrániť priradenie', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    // Pomocné funkcie na konverziu farieb
    const hexToRgb = (hex) => {
        const r = parseInt(hex.slice(1,3), 16);
        const g = parseInt(hex.slice(3,5), 16);
        const b = parseInt(hex.slice(5,7), 16);
        return `rgb(${r}, ${g}, ${b})`;
    };
    
    const hexToHsl = (hex) => {
        let r = parseInt(hex.slice(1,3), 16) / 255;
        let g = parseInt(hex.slice(3,5), 16) / 255;
        let b = parseInt(hex.slice(5,7), 16) / 255;
    
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
    
        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
    
        h = Math.round(h * 360);
        s = Math.round(s * 100);
        l = Math.round(l * 100);
        return `hsl(${h}, ${s}%, ${l}%)`;
    };

    // ──────────────────────────────────────────────
    // RENDER
    // ──────────────────────────────────────────────
    return React.createElement(
        'div',
        { className: 'min-h-screen bg-gray-50 py-8 px-4' },
        React.createElement(
            'div',
            { className: 'max-w-7xl mx-auto h-full' },

            React.createElement(
                'div',
                { className: 'grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 h-full' },

                // Ľavá strana – Tímy bez priradenia
                React.createElement(
                    'div',
                    { className: 'order-2 lg:order-1 h-full flex flex-col' },
                    React.createElement(
                        'div',
                        { className: 'bg-white rounded-xl shadow-lg overflow-hidden h-full flex flex-col' },
                        React.createElement(
                            'div',
                            { className: 'bg-green-700 text-white px-6 py-4' },
                            React.createElement('h2', { className: 'text-xl font-bold' }, `Tímy bez priradenia (${unassignedTeams.length})`)
                        ),
                        React.createElement(
                            'div',
                            { className: 'p-6 flex-grow overflow-y-auto' },
                            unassignedTeams.length === 0
                                ? React.createElement('p', { className: 'text-gray-500 text-center py-12' }, 'Všetky tímy už majú priradené ubytovanie')
                                : React.createElement(
                                    'ul',
                                    { className: 'space-y-3' },
                                    unassignedTeams.map((team, i) =>
                                        React.createElement(
                                            'li',
                                            {
                                                key: i,
                                                className: 'py-3 px-4 bg-gray-50 rounded border-l-4 border-green-500 flex justify-between items-center'
                                            },
                                            React.createElement(
                                                'div',
                                                null,
                                                React.createElement('span', { className: 'font-medium' }, `${team.category}: ${team.teamName}`),
                                                React.createElement('span', { className: 'text-gray-500 ml-3 text-sm' }, `(${team.totalPeople} osôb)`)
                                            ),
                                            React.createElement(
                                                'div',
                                                { className: 'flex items-center gap-3' },
                                                React.createElement('span', { className: 'font-medium text-green-700' }, team.accommodation),
                                                React.createElement(
                                                    'button',
                                                    {
                                                        onClick: () => openAssignModal(team),
                                                        className: 'p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors',
                                                        title: 'Priradiť ubytovňu'
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

                // Pravá strana – Ubytovacie miesta s tímami
                React.createElement(
                    'div',
                    { className: 'order-1 lg:order-2 h-full flex flex-col' },
                    React.createElement(
                        'div',
                        { className: 'h-full flex flex-col' },
                        React.createElement(
                            'h2',
                            { className: 'text-2xl font-bold text-gray-800 mb-4 lg:hidden' },
                            'Ubytovacie miesta s priradenými tímami'
                        ),
                        accommodationsWithTeams.length === 0
                            ? React.createElement(
                                'div',
                                { className: 'bg-white rounded-xl shadow-lg p-8 text-center flex-grow' },
                                React.createElement('p', { className: 'text-gray-500 text-lg' }, 'Zatiaľ žiadne ubytovacie miesta...')
                              )
                            : React.createElement(
                                'div',
                                { className: 'space-y-6 flex-grow overflow-y-auto pr-2' },
                                accommodationsWithTeams.map((place) =>
                                    React.createElement(
                                        'div',
                                        { key: place.id, className: 'bg-white rounded-xl shadow-lg overflow-hidden relative' },
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
                                                'div',
                                                null,
                                                React.createElement('h3', { className: 'text-xl font-bold' }, place.name || 'Ubytovacie miesto'),
                                                React.createElement('div', { className: 'text-sm opacity-90 mt-1' },
                                                    `${place.assignedTeams.length} tímov • ${place.usedCapacity} osôb`
                                                )
                                            ),
                                            React.createElement(
                                                'button',
                                                {
                                                    onClick: () => openEditModal(place),
                                                    className: 'flex items-center gap-1.5 px-4 py-1.5 bg-white text-black hover:bg-gray-100 active:bg-gray-200 transition-colors text-sm font-medium rounded-full border border-gray-300 shadow-sm'
                                                },
                                                React.createElement(
                                                    'svg',
                                                    { 
                                                        className: 'w-4 h-4', 
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
                                                ),
                                                React.createElement('span', null, 'Upraviť')
                                            )
                                        ),
                                        React.createElement(
                                            'div',
                                            { className: 'p-6' },
                                            React.createElement(
                                                'div',
                                                { className: 'space-y-6' },
                                                // Informácie o ubytovni
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
                                                            `${place.usedCapacity} / ${place.capacity} osôb`
                                                        ),
                                                    place.remainingCapacity !== null &&
                                                        React.createElement(
                                                            'p',
                                                            { className: place.remainingCapacity < 0 ? 'text-red-600 font-semibold' : 'text-gray-700' },
                                                            React.createElement('span', { className: 'font-semibold' }, 'Zostáva: '),
                                                            `${place.remainingCapacity} osôb`
                                                        )
                                                ),
                                                
                                                // Zoznam priradených tímov
                                                place.assignedTeams.length > 0 &&
                                                React.createElement(
                                                    'div',
                                                    { className: 'mt-4' },
                                                    React.createElement(
                                                        'h4',
                                                        { className: 'font-semibold text-gray-800 mb-3' },
                                                        `Priradené tímy (${place.assignedTeams.length})`
                                                    ),
                                                    React.createElement(
                                                        'ul',
                                                        { className: 'space-y-2' },
                                                        place.assignedTeams.map((team, index) =>
                                                            React.createElement(
                                                                'li',
                                                                {
                                                                    key: index,
                                                                    className: 'py-2 px-3 bg-gray-50 rounded border border-gray-200 flex justify-between items-center hover:bg-gray-100'
                                                                },
                                                                React.createElement(
                                                                    'div',
                                                                    null,
                                                                    React.createElement('span', { className: 'font-medium' }, `${team.category}: ${team.teamName}`),
                                                                    React.createElement('span', { className: 'text-gray-500 ml-3 text-sm' }, `(${team.totalPeople} osôb)`)
                                                                ),
                                                                React.createElement(
                                                                    'div',
                                                                    { className: 'flex items-center gap-2' },
                                                                    React.createElement(
                                                                        'button',
                                                                        {
                                                                            onClick: () => openAssignModal(team),
                                                                            className: 'p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors',
                                                                            title: 'Zmeniť ubytovňu'
                                                                        },
                                                                        React.createElement(
                                                                            'svg',
                                                                            { 
                                                                                className: 'w-4 h-4', 
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
                                                                    ),
                                                                    React.createElement(
                                                                        'button',
                                                                        {
                                                                            onClick: () => removeTeamAssignment(team),
                                                                            className: 'p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors',
                                                                            title: 'Odstrániť priradenie'
                                                                        },
                                                                        React.createElement(
                                                                            'svg',
                                                                            { 
                                                                                className: 'w-4 h-4', 
                                                                                fill: 'none', 
                                                                                stroke: 'currentColor', 
                                                                                viewBox: '0 0 24 24',
                                                                                strokeWidth: '2'
                                                                            },
                                                                            React.createElement('path', {
                                                                                strokeLinecap: 'round',
                                                                                strokeLinejoin: 'round',
                                                                                d: 'M6 18L18 6M6 6l12 12'
                                                                            })
                                                                        )
                                                                    )
                                                                )
                                                            )
                                                        )
                                                    )
                                                )
                                            )
                                        )
                                    )
                                )
                            )
                    )
                )
            )
        ),

        // Modálne okno – zmena farieb
        isColorModalOpen &&
        React.createElement(
            'div',
            {
                className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]',
                onClick: (e) => { if (e.target === e.currentTarget) setIsColorModalOpen(false); }
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
        
                React.createElement(
                    'div',
                    { className: 'flex justify-end gap-4 mt-8' },
                    React.createElement(
                        'button',
                        {
                            onClick: () => setIsColorModalOpen(false),
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
        ),

        // Modálne okno – priradenie ubytovne (UPRAVENÉ - správne zobrazenie kapacity)
        isAssignModalOpen &&
        React.createElement(
            'div',
            {
                className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]',
                onClick: (e) => { if (e.target === e.currentTarget) setIsAssignModalOpen(false); }
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
                        'Priradiť ubytovňu'
                    ),
                    React.createElement(
                        'span',
                        { className: 'text-lg font-medium text-gray-600 ml-2' },
                        `– ${selectedTeam?.teamName}`
                    )
                ),

                React.createElement('div', { className: 'mb-6' },
                    React.createElement('p', { className: 'text-sm text-gray-600 mb-3' },
                        `Typ ubytovania tímu: ${selectedTeam?.accommodation}`
                    ),
                    React.createElement('p', { className: 'text-sm text-gray-600' },
                        `Počet osôb v tíme: ${selectedTeam?.totalPeople || 0}`
                    )
                ),

                React.createElement('div', { className: 'mb-8' },
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-3' }, 'Vyberte ubytovňu'),
                    isLoading
                        ? React.createElement(
                            'div',
                            { className: 'flex justify-center py-8' },
                            React.createElement('div', { className: 'animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500' })
                        )
                        : availableAccommodations.length === 0
                            ? React.createElement(
                                'div',
                                { className: 'bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center' },
                                React.createElement('p', { className: 'text-yellow-700' },
                                    `Žiadne dostupné ubytovne pre typ "${selectedTeam?.accommodation}"`
                                )
                            )
                            : React.createElement(
                                'div',
                                { className: 'space-y-3' },
                                availableAccommodations.map(place => {
                                    const canAccommodate = place.capacity === null || 
                                        (place.remainingCapacity !== null && place.remainingCapacity >= (selectedTeam?.totalPeople || 0));
                                    
                                    return React.createElement(
                                        'div',
                                        { 
                                            key: place.id,
                                            className: `p-4 rounded-lg border cursor-pointer transition-all ${
                                                selectedAccommodationId === place.id
                                                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                                                    : 'border-gray-300 hover:bg-gray-50'
                                            } ${
                                                !canAccommodate ? 'opacity-60 cursor-not-allowed' : ''
                                            }`
                                        },
                                        React.createElement(
                                            'div',
                                            { 
                                                className: 'flex items-start gap-3',
                                                onClick: () => canAccommodate && setSelectedAccommodationId(place.id)
                                            },
                                            React.createElement(
                                                'div',
                                                { 
                                                    className: `w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 ${
                                                        selectedAccommodationId === place.id
                                                            ? 'border-blue-500 bg-blue-500'
                                                            : 'border-gray-400'
                                                    }` 
                                                },
                                                selectedAccommodationId === place.id &&
                                                React.createElement(
                                                    'svg',
                                                    { 
                                                        className: 'w-3 h-3 text-white', 
                                                        fill: 'none', 
                                                        stroke: 'currentColor', 
                                                        viewBox: '0 0 24 24',
                                                        strokeWidth: '3'
                                                    },
                                                    React.createElement('path', {
                                                        strokeLinecap: 'round',
                                                        strokeLinejoin: 'round',
                                                        d: 'M5 13l4 4L19 7'
                                                    })
                                                )
                                            ),
                                            React.createElement(
                                                'div',
                                                { className: 'flex-grow' },
                                                React.createElement(
                                                    'div',
                                                    { className: 'font-medium text-gray-900' },
                                                    place.name
                                                ),
                                                React.createElement(
                                                    'div',
                                                    { className: 'text-sm text-gray-600 mt-1' },
                                                    `Typ: ${place.accommodationType || 'neurčený'}`
                                                ),
                                                place.capacity !== null && (
                                                    React.createElement(
                                                        'div',
                                                        { 
                                                            className: `text-sm font-medium mt-1 ${
                                                                place.remainingCapacity < 0 ? 'text-red-600' :
                                                                place.remainingCapacity < (selectedTeam?.totalPeople || 0) ? 'text-orange-600' :
                                                                'text-green-600'
                                                            }` 
                                                        },
                                                        `Kapacita: ${place.usedCapacity}/${place.capacity} osôb`,
                                                        place.remainingCapacity !== null && (
                                                            React.createElement(
                                                                'span',
                                                                { className: 'ml-2' },
                                                                place.remainingCapacity >= 0 ? 
                                                                    `(zostáva ${place.remainingCapacity} osôb)` :
                                                                    `(prekročená o ${Math.abs(place.remainingCapacity)} osôb)`
                                                            )
                                                        )
                                                    )
                                                ),
                                                !canAccommodate && (
                                                    React.createElement(
                                                        'div',
                                                        { className: 'text-sm text-red-600 mt-1 font-medium' },
                                                        `Nedostatočná kapacita pre tím (${selectedTeam?.totalPeople || 0} osôb)`
                                                    )
                                                )
                                            )
                                        )
                                    );
                                })
                            )
                ),

                React.createElement(
                    'div',
                    { className: 'flex justify-end gap-4 mt-8' },
                    React.createElement(
                        'button',
                        {
                            onClick: () => setIsAssignModalOpen(false),
                            disabled: isLoading,
                            className: 'px-6 py-2.5 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition disabled:opacity-50'
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            onClick: saveAccommodationAssignment,
                            disabled: !selectedAccommodationId || isLoading,
                            className: `px-6 py-2.5 text-white rounded-lg transition ${
                                selectedAccommodationId && !isLoading
                                    ? 'bg-green-600 hover:bg-green-700'
                                    : 'bg-green-400 cursor-not-allowed'
                            }`
                        },
                        isLoading
                            ? React.createElement(
                                'span',
                                { className: 'flex items-center gap-2' },
                                React.createElement('div', { className: 'animate-spin rounded-full h-4 w-4 border-b-2 border-white' }),
                                'Ukladám...'
                            )
                            : selectedTeam?.assignedPlace ? 'Zmeniť' : 'Priradiť'
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
