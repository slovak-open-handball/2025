// Importy pre Firebase funkcie (Tieto sa nebudú používať na inicializáciu, ale na typy a funkcie)
import { doc, getDoc, onSnapshot, updateDoc, addDoc, collection, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const { useState, useEffect, useRef, useSyncExternalStore } = React;

// Definície typov pre športové haly (prevzaté z mapovej aplikácie)
const typeLabels = {
    sportova_hala: "Športová hala",
    ubytovanie: "Ubytovanie",
    stravovanie: "Stravovanie",
    zastavka: "Zastávka",
};

// Ikony pre typy miest
const typeIcons = {
    sportova_hala: { icon: 'fa-futbol', color: '#dc2626' },
    stravovanie: { icon: 'fa-utensils', color: '#16a34a' },
    ubytovanie: { icon: 'fa-bed', color: '#6b7280' },
    zastavka: { icon: 'fa-bus', color: '#2563eb' }
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

    // Zobrazenie notifikácie
    setTimeout(() => {
        notificationElement.className = `${baseClasses} ${typeClasses} opacity-100 scale-100`;
    }, 10);

    // Skrytie notifikácie po 5 sekundách
    setTimeout(() => {
        notificationElement.className = `${baseClasses} ${typeClasses} opacity-0 scale-95`;
    }, 5000);
};

const AddMatchesApp = ({ userProfileData }) => {
    const [sportHalls, setSportHalls] = useState([]); // State pre športové haly
    const [loading, setLoading] = useState(true); // State pre načítavanie
    const [selectedHall, setSelectedHall] = useState(null); // State pre vybranú halu

    // Načítanie športových hál z Firebase (prevzaté z mapovej aplikácie)
    useEffect(() => {
        if (!window.db) {
            console.error("Firestore databáza nie je inicializovaná");
            setLoading(false);
            return;
        }

        console.log("AddMatchesApp: Načítavam športové haly z databázy...");
        
        // Reálny časový poslucháč na kolekciu 'places' (prevzaté z mapovej aplikácie)
        const unsubscribe = onSnapshot(
            collection(window.db, 'places'),
            (snapshot) => {
                const loadedPlaces = [];
                snapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    const loc = data.location;
                    
                    // Načítame všetky miesta, ale v komponente ich môžeme filtrovať len na športové haly
                    loadedPlaces.push({
                        id: docSnap.id,
                        name: data.name,
                        type: data.type,
                        lat: loc?.latitude ?? data.lat,
                        lng: loc?.longitude ?? data.lng,
                        createdAt: data.createdAt,
                        capacity: data.capacity || null,
                        accommodationType: data.accommodationType || null,
                        note: data.note || null,
                    });
                });
                
                // Filtrujeme len športové haly pre zobrazenie
                const filteredHalls = loadedPlaces.filter(place => place.type === 'sportova_hala');
                setSportHalls(filteredHalls);
                setLoading(false);
                
                console.log(`AddMatchesApp: Načítaných ${filteredHalls.length} športových hál z celkovo ${loadedPlaces.length} miest`);
            },
            (error) => {
                console.error("AddMatchesApp: Chyba pri načítaní miest:", error);
                window.showGlobalNotification('Nepodarilo sa načítať športové haly', 'error');
                setLoading(false);
            }
        );

        // Odhlásenie poslucháča pri unmount
        return () => unsubscribe();
    }, []); // Prázdne pole závislostí = spustí sa len raz pri načítaní komponenty

    // Funkcia pre výber haly
    const handleSelectHall = (hall) => {
        setSelectedHall(hall);
        console.log("Vybraná hala:", hall);
    };

    // Render komponenty
    return React.createElement(
        'div',
        { className: 'flex-grow flex justify-center items-start w-full' },
        React.createElement(
            'div',
            { className: 'w-full bg-white rounded-xl shadow-xl p-8 mx-4' },
            React.createElement(
                'div',
                { className: 'flex flex-col items-center justify-center mb-6 p-4 -mx-8 -mt-8 rounded-t-xl' },
                React.createElement('h2', { className: 'text-3xl font-bold tracking-tight text-center text-gray-800' }, 'Zápasy')
            ),
            
            // Zobrazenie športových hál
            React.createElement(
                'div',
                { className: 'mt-4' },
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
                
                // Zoznam športových hál (keď nie je načítavanie)
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
                    { className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' },
                    sportHalls.map((hall) => {
                        const typeConfig = typeIcons[hall.type] || { icon: 'fa-futbol', color: '#dc2626' };
                        
                        return React.createElement(
                            'div',
                            { 
                                key: hall.id,
                                onClick: () => handleSelectHall(hall),
                                className: `p-5 bg-white rounded-xl border-2 shadow-sm hover:shadow-md transition-all cursor-pointer transform hover:-translate-y-1 ${
                                    selectedHall?.id === hall.id 
                                        ? 'border-red-400 bg-red-50 shadow-lg' 
                                        : 'border-gray-200 hover:border-red-200'
                                }`
                            },
                            React.createElement(
                                'div',
                                { className: 'flex items-center mb-3' },
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
                            ),
                            
                            // Kapacita (ak existuje)
                            hall.capacity && React.createElement(
                                'div',
                                { className: 'mt-3 pt-3 border-t border-gray-200 text-sm text-gray-600 flex items-center' },
                                React.createElement('i', { className: 'fa-solid fa-users mr-2 text-gray-400' }),
                                React.createElement('span', null, 
                                    React.createElement('strong', null, 'Kapacita: '),
                                    `${hall.capacity} miest`
                                )
                            ),
                            
                            // Poznámka (ak existuje)
                            hall.note && React.createElement(
                                'div',
                                { className: 'mt-2 text-sm text-gray-500 italic' },
                                React.createElement('i', { className: 'fa-solid fa-note-sticky mr-2' }),
                                React.createElement('span', null, hall.note)
                            ),
                            
                            // Indikátor výberu
                            selectedHall?.id === hall.id && React.createElement(
                                'div',
                                { className: 'mt-3 pt-2 text-right' },
                                React.createElement('span', { className: 'inline-flex items-center text-red-600 text-sm font-medium' },
                                    React.createElement('i', { className: 'fa-solid fa-check-circle mr-1' }),
                                    'Vybraná hala'
                                )
                            )
                        );
                    })
                )
            ),
            
            // Sekcia pre detail vybranej haly (ak je vybraná)
            selectedHall && React.createElement(
                'div',
                { className: 'mt-8 p-6 bg-gray-50 rounded-xl border border-gray-200' },
                React.createElement(
                    'div',
                    { className: 'flex justify-between items-center mb-4' },
                    React.createElement('h3', { className: 'text-xl font-bold text-gray-800' },
                        React.createElement('i', { className: 'fa-solid fa-circle-info mr-2 text-blue-500' }),
                        'Detail haly'
                    ),
                    React.createElement('button', {
                        onClick: () => setSelectedHall(null),
                        className: 'text-gray-500 hover:text-gray-700 text-2xl'
                    }, '×')
                ),
                React.createElement('h4', { className: 'text-2xl font-semibold text-gray-800 mb-4' }, selectedHall.name),
                React.createElement('div', { className: 'grid grid-cols-2 gap-4' },
                    React.createElement('div', null,
                        React.createElement('p', { className: 'text-gray-600 mb-2' },
                            React.createElement('strong', null, 'Typ: '),
                            typeLabels[selectedHall.type] || selectedHall.type
                        ),
                        selectedHall.capacity && React.createElement('p', { className: 'text-gray-600 mb-2' },
                            React.createElement('strong', null, 'Kapacita: '),
                            selectedHall.capacity
                        ),
                    ),
                    React.createElement('div', null,
                        React.createElement('p', { className: 'text-gray-600 mb-2' },
                            React.createElement('strong', null, 'Súradnice: '),
                            `${selectedHall.lat.toFixed(6)}, ${selectedHall.lng.toFixed(6)}`
                        ),
                        selectedHall.note && React.createElement('div', { className: 'mt-2' },
                            React.createElement('strong', { className: 'block text-gray-700 mb-1' }, 'Poznámka:'),
                            React.createElement('p', { className: 'text-gray-600 whitespace-pre-line bg-white p-3 rounded border border-gray-200' },
                                selectedHall.note
                            )
                        )
                    )
                ),
                React.createElement('div', { className: 'mt-6 flex gap-3' },
                    React.createElement('button', {
                        onClick: () => {
                            const url = `https://www.google.com/maps/dir/?api=1&destination=${selectedHall.lat},${selectedHall.lng}`;
                            window.open(url, '_blank', 'noopener,noreferrer');
                        },
                        className: 'flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition flex items-center justify-center gap-2'
                    },
                        React.createElement('i', { className: 'fa-solid fa-directions' }),
                        'Navigovať'
                    ),
                    React.createElement('button', {
                        onClick: () => {
                            window.showGlobalNotification('Funkcia na pridanie zápasu bude čoskoro dostupná', 'info');
                        },
                        className: 'flex-1 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition flex items-center justify-center gap-2'
                    },
                        React.createElement('i', { className: 'fa-solid fa-plus' }),
                        'Pridať zápas'
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
        // Ak sa dáta načítali, nastavíme poslucháča na synchronizáciu e-mailu, ak ešte nebol nastavený
        // Používame window.auth a window.db, ktoré by mali byť nastavené pri načítaní aplikácie.
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
                                console.log(`logged-in-matches.js: E-mail v autentifikácii (${user.email}) sa líši od e-mailu vo Firestore (${firestoreEmail}). Aktualizujem...`);
                                
                                await updateDoc(userProfileRef, {
                                    email: user.email
                                });
            
                                // Vytvorenie notifikácie v databáze s novou štruktúrou
                                const notificationsCollectionRef = collection(window.db, 'notifications');
                                await addDoc(notificationsCollectionRef, {
                                    userEmail: user.email, // Používame userEmail namiesto userId a userName
                                    changes: `Zmena e-mailovej adresy z '${firestoreEmail}' na '${user.email}'.`,
                                    timestamp: new Date(), // Používame timestamp namiesto createdAt
                                });
                                
                                window.showGlobalNotification('E-mailová adresa bola automaticky aktualizovaná a synchronizovaná.', 'success');
                                console.log("logged-in-matches.js: E-mail vo Firestore bol aktualizovaný a notifikácia vytvorená.");
            
                            } else {
                                console.log("logged-in-matches.js: E-maily sú synchronizované, nie je potrebné nič aktualizovať.");
                            }
                        }
                    } catch (error) {
                        console.error("logged-in-matches.js: Chyba pri porovnávaní a aktualizácii e-mailu:", error);
                        window.showGlobalNotification('Nastala chyba pri synchronizácii e-mailovej adresy.', 'error');
                    }
                }
            });
            isEmailSyncListenerSetup = true; // Označíme, že poslucháč je nastavený
        }

        if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
            const root = ReactDOM.createRoot(rootElement);
            root.render(React.createElement(AddMatchesApp, { userProfileData }));
            console.log("logged-in-matches.js: Aplikácia bola vykreslená po udalosti 'globalDataUpdated'.");
        } else {
            console.error("logged-in-matches.js: HTML element 'root' alebo React/ReactDOM nie sú dostupné.");
        }
    } else {
        // Ak dáta nie sú dostupné, zobrazíme loader
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
        console.error("logged-in-matches.js: Dáta používateľa nie sú dostupné v udalosti 'globalDataUpdated'. Zobrazujem loader.");
    }
};

// Zaregistrujeme poslucháča udalosti 'globalDataUpdated'.
console.log("logged-in-matches.js: Registrujem poslucháča pre 'globalDataUpdated'.");
window.addEventListener('globalDataUpdated', handleDataUpdateAndRender);

// Aby sme predišli premeškaniu udalosti, ak sa načíta skôr, ako sa tento poslucháč zaregistruje,
// skontrolujeme, či sú dáta už dostupné.
console.log("logged-in-matches.js: Kontrolujem, či existujú globálne dáta.");
if (window.globalUserProfileData) {
    console.log("logged-in-matches.js: Globálne dáta už existujú. Vykresľujem aplikáciu okamžite.");
    handleDataUpdateAndRender({ detail: window.globalUserProfileData });
} else {
    // Ak dáta nie sú dostupné, čakáme na event listener, zatiaľ zobrazíme loader
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
