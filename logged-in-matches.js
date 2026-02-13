// Importy pre Firebase funkcie
import { doc, getDoc, onSnapshot, updateDoc, addDoc, collection, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const { useState, useEffect } = React;

const faCSS = document.createElement('link');
faCSS.rel = 'stylesheet';
faCSS.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css';document.head.appendChild(faCSS);

// Definície typov pre športové haly
const typeLabels = {
    sportova_hala: "Športová hala",
};

// Ikony pre typy miest
const typeIcons = {
    sportova_hala: { icon: 'fa-futbol', color: '#dc2626' },
};

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

const AddMatchesApp = ({ userProfileData }) => {
    const [sportHalls, setSportHalls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [categories, setCategories] = useState([]);
    const [matches, setMatches] = useState([]); // State pre zápasy

    // Funkcia na výpočet celkového času zápasu pre kategóriu
    const calculateTotalMatchTime = (category) => {
        if (!category) return { playingTime: 0, breaksBetweenPeriods: 0, totalTimeWithMatchBreak: 0 };
        
        const periods = category.periods ?? 2;
        const periodDuration = category.periodDuration ?? 20;
        const breakDuration = category.breakDuration ?? 2;
        const matchBreak = category.matchBreak ?? 5;
        
        const playingTime = periods * periodDuration;
        const breaksBetweenPeriods = (periods - 1) * breakDuration;
        const totalTimeWithMatchBreak = playingTime + breaksBetweenPeriods + matchBreak;
        
        return {
            playingTime,
            breaksBetweenPeriods,
            totalTimeWithMatchBreak
        };
    };

    // Načítanie športových hál a kategórií z Firebase
    useEffect(() => {
        if (!window.db) {
            console.error("Firestore databáza nie je inicializovaná");
            setLoading(false);
            return;
        }

        console.log("AddMatchesApp: Načítavam športové haly a kategórie z databázy...");
        
        // Načítame nastavenia kategórií
        const loadCategorySettings = async () => {
            try {
                const catRef = doc(window.db, 'settings', 'categories');
                const catSnap = await getDoc(catRef);
                
                if (catSnap.exists()) {
                    const data = catSnap.data() || {};
                    const categoriesList = [];
                    
                    Object.entries(data).forEach(([id, obj]) => {
                        const category = {
                            id: id,
                            name: obj.name || `Kategória ${id}`,
                            maxTeams: obj.maxTeams ?? 12,
                            periods: obj.periods ?? 2,
                            periodDuration: obj.periodDuration ?? 20,
                            breakDuration: obj.breakDuration ?? 2,
                            matchBreak: obj.matchBreak ?? 5,
                            drawColor: obj.drawColor ?? '#3B82F6',
                            transportColor: obj.transportColor ?? '#10B981',
                            timeoutCount: obj.timeoutCount ?? 2,
                            timeoutDuration: obj.timeoutDuration ?? 1,
                            exclusionTime: obj.exclusionTime ?? 2
                        };
                        
                        categoriesList.push(category);
                        
                        // Výpočet času pre túto kategóriu
                        const matchTime = calculateTotalMatchTime(category);
                        
                        // Výpis do konzoly pre každú kategóriu
                        console.log(`Kategória: ${category.name} (ID: ${category.id})`);
                        console.log(`  - Farba pre rozlosovanie: ${category.drawColor}`);
                        console.log(`  - Celkový čas zápasu: ${matchTime.totalTimeWithMatchBreak} min`);
                        console.log(`    (Čistý hrací čas: ${matchTime.playingTime} min, Prestávky: ${matchTime.breaksBetweenPeriods} min)`);
                        console.log(`  - Nastavenia:`);
                        console.log(`    • Počet periód: ${category.periods}`);
                        console.log(`    • Trvanie periódy: ${category.periodDuration} min`);
                        console.log(`    • Prestávka medzi periódami: ${category.breakDuration} min`);
                        console.log(`    • Prestávka medzi zápasmi: ${category.matchBreak} min`);
                        console.log(`    • Počet timeoutov: ${category.timeoutCount}`);
                        console.log(`    • Trvanie timeoutu: ${category.timeoutDuration} min`);
                        console.log(`    • Čas vylúčenia: ${category.exclusionTime} min`);
                        console.log(`    • Farba pre dopravu: ${category.transportColor}`);
                        console.log('---');
                    });
                    
                    setCategories(categoriesList);
                    console.log(`AddMatchesApp: Načítaných ${categoriesList.length} kategórií`);
                } else {
                    console.log("AddMatchesApp: Žiadne kategórie neboli nájdené");
                }
            } catch (error) {
                console.error("AddMatchesApp: Chyba pri načítaní nastavení kategórií:", error);
            }
        };
        
        loadCategorySettings();
        
        const unsubscribe = onSnapshot(
            collection(window.db, 'places'),
            (snapshot) => {
                const loadedPlaces = [];
                snapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    const loc = data.location;
                    
                    loadedPlaces.push({
                        id: docSnap.id,
                        name: data.name,
                        type: data.type,
                        lat: loc?.latitude ?? data.lat,
                        lng: loc?.longitude ?? data.lng,
                    });
                });
                
                // Filtrujeme len športové haly
                const filteredHalls = loadedPlaces.filter(place => place.type === 'sportova_hala');
                setSportHalls(filteredHalls);
                setLoading(false);
                
                console.log(`AddMatchesApp: Načítaných ${filteredHalls.length} športových hál`);
            },
            (error) => {
                console.error("AddMatchesApp: Chyba pri načítaní miest:", error);
                window.showGlobalNotification('Nepodarilo sa načítať športové haly', 'error');
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    // Simulované zápasy pre ukážku (neskôr sa budú generovať)
    useEffect(() => {
        // Toto je dočasné, kým sa implementuje generovanie zápasov
        const demoMatches = [
            { id: 1, homeTeam: "Tím A", awayTeam: "Tím B", time: "10:00", hall: "Hala 1", category: "Muži" },
            { id: 2, homeTeam: "Tím C", awayTeam: "Tím D", time: "11:30", hall: "Hala 1", category: "Muži" },
            { id: 3, homeTeam: "Tím E", awayTeam: "Tím F", time: "13:00", hall: "Hala 2", category: "Ženy" },
            { id: 4, homeTeam: "Tím G", awayTeam: "Tím H", time: "14:30", hall: "Hala 2", category: "Ženy" },
            { id: 5, homeTeam: "Tím I", awayTeam: "Tím J", time: "16:00", hall: "Hala 3", category: "Juniori" },
        ];
        setMatches(demoMatches);
    }, []);

    // ZJEDNODUŠENÝ RENDER - dva stĺpce (ľavý - zápasy, pravý - haly)
    return React.createElement(
        'div',
        { className: 'flex-grow flex justify-center items-start w-full' },
        React.createElement(
            'div',
            { className: 'w-full bg-white rounded-xl shadow-xl p-8 mx-4' },
            
            // Hlavička
            React.createElement(
                'div',
                { className: 'flex flex-col items-center justify-center mb-6 p-4 -mx-8 -mt-8 rounded-t-xl' },
                React.createElement('h2', { className: 'text-3xl font-bold tracking-tight text-center text-gray-800' }, 'Zápasy')
            ),
            
            // Dva stĺpce - ľavý pre zápasy, pravý pre haly
            React.createElement(
                'div',
                { className: 'flex flex-col lg:flex-row gap-6 mt-4' },
                
                // ĽAVÝ STĹPEC - Zoznam zápasov
                React.createElement(
                    'div',
                    { className: 'lg:w-1/3 bg-gray-50 rounded-xl p-4 border border-gray-200' },
                    React.createElement(
                        'h3',
                        { className: 'text-xl font-semibold mb-4 text-gray-700 border-b pb-2 flex items-center' },
                        React.createElement('i', { className: 'fa-solid fa-trophy mr-2 text-yellow-500' }),
                        'Zoznam zápasov',
                        React.createElement('span', { className: 'ml-2 text-sm font-normal text-gray-500' },
                            `(${matches.length})`
                        )
                    ),
                    
                    // Zoznam zápasov
                    matches.length === 0 ? 
                        React.createElement(
                            'div',
                            { className: 'text-center py-8 text-gray-500' },
                            React.createElement('i', { className: 'fa-solid fa-calendar-xmark text-4xl mb-3 opacity-30' }),
                            React.createElement('p', { className: 'text-sm' }, 'Žiadne zápasy')
                        ) :
                        React.createElement(
                            'div',
                            { className: 'space-y-3 max-h-[600px] overflow-y-auto pr-2' },
                            matches.map(match => (
                                React.createElement(
                                    'div',
                                    { 
                                        key: match.id,
                                        className: 'bg-white p-4 rounded-lg border border-gray-200 hover:shadow-md transition-shadow cursor-pointer'
                                    },
                                    React.createElement(
                                        'div',
                                        { className: 'flex justify-between items-start mb-2' },
                                        React.createElement(
                                            'span',
                                            { className: 'text-xs font-medium px-2 py-1 bg-blue-100 text-blue-700 rounded-full' },
                                            match.time
                                        ),
                                        React.createElement(
                                            'span',
                                            { className: 'text-xs text-gray-500' },
                                            match.category
                                        )
                                    ),
                                    React.createElement(
                                        'div',
                                        { className: 'flex items-center justify-between' },
                                        React.createElement(
                                            'span',
                                            { className: 'font-semibold text-gray-800' },
                                            match.homeTeam
                                        ),
                                        React.createElement('i', { className: 'fa-solid fa-vs text-xs text-gray-400 mx-2' }),
                                        React.createElement(
                                            'span',
                                            { className: 'font-semibold text-gray-800' },
                                            match.awayTeam
                                        )
                                    ),
                                    React.createElement(
                                        'div',
                                        { className: 'mt-2 text-xs text-gray-500 flex items-center' },
                                        React.createElement('i', { className: 'fa-solid fa-location-dot mr-1 text-gray-400' }),
                                        match.hall
                                    )
                                )
                            ))
                        ),
                    
                    // Tlačidlo pre generovanie zápasov (zatiaľ neaktívne)
                    React.createElement(
                        'button',
                        { 
                            className: 'mt-4 w-full py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2',
                            onClick: () => console.log('Generovanie zápasov - bude implementované')
                        },
                        React.createElement('i', { className: 'fa-solid fa-plus-circle' }),
                        'Generovať zápasy'
                    )
                ),
                
                // PRAVÝ STĹPEC - Športové haly
                React.createElement(
                    'div',
                    { className: 'lg:w-2/3' },
                    React.createElement(
                        'h3',
                        { className: 'text-xl font-semibold mb-4 text-gray-700 border-b pb-2' },
                        React.createElement('i', { className: 'fa-solid fa-futbol mr-2 text-red-500' }),
                        'Športové haly',
                        React.createElement('span', { className: 'ml-2 text-sm font-normal text-gray-500' },
                            `(${sportHalls.length} ${sportHalls.length === 1 ? 'hala' : sportHalls.length < 5 ? 'haly' : 'hál'})`
                        )
                    ),
                    
                    // Indikátor načítavania
                    loading && React.createElement(
                        'div',
                        { className: 'flex justify-center items-center py-12' },
                        React.createElement('div', { className: 'animate-spin rounded-full h-12 w-12 border-b-4 border-blue-500' })
                    ),
                    
                    // Žiadne haly
                    !loading && sportHalls.length === 0 && React.createElement(
                        'div',
                        { className: 'text-center py-12 text-gray-500 bg-gray-50 rounded-lg' },
                        React.createElement('i', { className: 'fa-solid fa-map-pin text-5xl mb-4 opacity-30' }),
                        React.createElement('p', { className: 'text-lg' }, 'Žiadne športové haly nie sú k dispozícii'),
                        React.createElement('p', { className: 'text-sm mt-2' }, 'Pridajte prvú športovú halu v mape.')
                    ),
                    
                    // Grid zoznam športových hál
                    !loading && sportHalls.length > 0 && React.createElement(
                        'div',
                        { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                        sportHalls.map((hall) => {
                            const typeConfig = typeIcons[hall.type] || { icon: 'fa-futbol', color: '#dc2626' };
                            
                            return React.createElement(
                                'div',
                                { 
                                    key: hall.id,
                                    className: `p-5 bg-white rounded-xl border-2 border-gray-200 shadow-sm hover:shadow-md transition-shadow`
                                },
                                React.createElement(
                                    'div',
                                    { className: 'flex items-center' },
                                    React.createElement(
                                        'div',
                                        { 
                                            className: 'w-14 h-14 rounded-full flex items-center justify-center mr-4',
                                            style: { 
                                                backgroundColor: typeConfig.color + '20',
                                                border: `3px solid ${typeConfig.color}`
                                            }
                                        },
                                        React.createElement('i', { 
                                            className: `fa-solid ${typeConfig.icon} text-2xl`,
                                            style: { color: typeConfig.color }
                                        })
                                    ),
                                    React.createElement(
                                        'div',
                                        { className: 'flex-1' },
                                        React.createElement('h4', { className: 'font-bold text-xl text-gray-800' }, hall.name),
                                        React.createElement('span', { 
                                            className: 'inline-block px-3 py-1 text-xs font-medium rounded-full mt-1',
                                            style: { 
                                                backgroundColor: typeConfig.color + '20',
                                                color: typeConfig.color
                                            }
                                        }, 'Športová hala')
                                    )
                                )
                            );
                        })
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
 * Akonáhle sa dáta používateľa načítajú, vykreslí aplikáciu AddMatchesApp.
 */
const handleDataUpdateAndRender = (event) => {
    const userProfileData = event.detail;
    const rootElement = document.getElementById('root');

    if (userProfileData) {
        // Synchronizácia e-mailu (ponechané pre funkcionalitu)
        if (window.auth && window.db && !isEmailSyncListenerSetup) {
            console.log("logged-in-matches.js: Nastavujem poslucháča na synchronizáciu e-mailu.");
            
            onAuthStateChanged(window.auth, async (user) => {
                if (user) {
                    try {
                        const userProfileRef = doc(window.db, 'users', user.uid);
                        const docSnap = await getDoc(userProfileRef);
            
                        if (docSnap.exists()) {
                            const firestoreEmail = docSnap.data().email;
                            if (user.email !== firestoreEmail) {
                                console.log(`E-mail v autentifikácii (${user.email}) sa líši od e-mailu vo Firestore (${firestoreEmail}). Aktualizujem...`);
                                
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
                        console.error("Chyba pri porovnávaní a aktualizácii e-mailu:", error);
                        window.showGlobalNotification('Nastala chyba pri synchronizácii e-mailovej adresy.', 'error');
                    }
                }
            });
            isEmailSyncListenerSetup = true;
        }

        if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
            const root = ReactDOM.createRoot(rootElement);
            root.render(React.createElement(AddMatchesApp, { userProfileData }));
        }
    } else {
        // Loader keď nie sú dáta
        if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
            const root = ReactDOM.createRoot(rootElement);
            root.render(
                React.createElement(
                    'div',
                    { className: 'flex justify-center items-center h-full pt-16 w-full' },
                    React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
                )
            );
        }
    }
};

// Registrácia poslucháča
window.addEventListener('globalDataUpdated', handleDataUpdateAndRender);

// Kontrola existujúcich dát
if (window.globalUserProfileData) {
    handleDataUpdateAndRender({ detail: window.globalUserProfileData });
} else {
    const rootElement = document.getElementById('root');
    if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
        const root = ReactDOM.createRoot(rootElement);
        root.render(
            React.createElement(
                'div',
                { className: 'flex justify-center items-center h-full pt-16 w-full' },
                React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
            )
        );
    }
}
