// Importy pre Firebase funkcie (Tieto sa nebudú používať na inicializáciu, ale na typy a funkcie)
import { doc, getDoc, onSnapshot, updateDoc, addDoc, collection, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const { useState, useEffect, useRef, useSyncExternalStore } = React;

// ================ Leaflet CDN importy (pridávame sem) ================
const leafletCSS = document.createElement('link');
leafletCSS.rel = 'stylesheet';
leafletCSS.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
document.head.appendChild(leafletCSS);

const leafletJS = document.createElement('script');
leafletJS.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
document.head.appendChild(leafletJS);
// =====================================================================

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

const AddGroupsApp = ({ userProfileData }) => {
    const mapRef = useRef(null);
    const leafletMap = useRef(null);

    useEffect(() => {
        if (!window.L) {
            console.warn("Leaflet sa ešte nenačítal...");
            const timer = setInterval(() => {
                if (window.L && mapRef.current && !leafletMap.current) {
                    initMap();
                    clearInterval(timer);
                }
            }, 300);
            return () => clearInterval(timer);
        } else {
            initMap();
        }

        function initMap() {
            if (leafletMap.current) return;

            leafletMap.current = window.L.map(mapRef.current).fitBounds([
                [49.242758, 18.673885],    // severozápad
                [49.156950, 18.882281]     // juhovýchod
            ]);

            window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(leafletMap.current);

            const logCurrentView = () => {
                if (!leafletMap.current) return;

                const center = leafletMap.current.getCenter();
                const zoom = leafletMap.current.getZoom();
                const bounds = leafletMap.current.getBounds();
        
                console.log('╔══════════════════════════════════════════════╗');
                console.log('║          Aktuálne zobrazenie mapy            ║');
                console.log('╠══════════════════════════════════════════════╣');
                console.log(`║ Center (lat, lng) : ${center.lat.toFixed(6)}, ${center.lng.toFixed(6)}`);
                console.log(`║ Zoom              : ${zoom}`);
                console.log(`║ Bounds (lat,lng)  :`);
                console.log(`║   severozápad     : ${bounds.getNorthWest().lat.toFixed(6)}, ${bounds.getNorthWest().lng.toFixed(6)}`);
                console.log(`║   juhovýchod      : ${bounds.getSouthEast().lat.toFixed(6)}, ${bounds.getSouthEast().lng.toFixed(6)}`);
                console.log('╚══════════════════════════════════════════════╝');
        
                // Ak chceš kratšiu verziu, stačí toto:
                // console.log(`map view → center: [${center.lat.toFixed(6)}, ${center.lng.toFixed(6)}], zoom: ${zoom}`);
            };

            setTimeout(logCurrentView, 500);   // malé oneskorenie, kým sa mapa naozaj vykreslí

            // Poslucháče zmien zobrazenia
            leafletMap.current.on('moveend', logCurrentView);     // po posunutí / dokončení dragu
            leafletMap.current.on('zoomend', logCurrentView);     // po zmene zoomu (koleso, +/-, doubleclick...)
            leafletMap.current.on('resize', logCurrentView);            

            // Voliteľné: centruj mapu podľa veľkosti okna po načítaní (už tam bolo)
            setTimeout(() => {
                if (leafletMap.current) {
                    leafletMap.current.invalidateSize();
                }
            }, 400);

            // Voliteľné: pridaj marker do stredu Žiliny (pre lepšiu orientáciu)
            // window.L.marker([49.2232, 18.7394])
            //     .addTo(leafletMap.current)
            //     .bindPopup('Žilina – centrum')
            //     .openPopup();

            console.log("Leaflet mapa bola inicializovaná – centrum: Žilina");
        }

        return () => {
            if (leafletMap.current) {
                leafletMap.current.remove();
                leafletMap.current = null;
            }
        };
    }, []);

    return React.createElement(
        'div',
        { className: 'flex-grow flex justify-center items-center p-2 sm:p-4' },
        React.createElement(
            'div',
            {
                className: `
                    w-full max-w-7xl bg-white rounded-xl shadow-2xl
                    p-3 sm:p-6 md:p-8 transform transition-all duration-500 hover:scale-[1.005]
                `
            },
            React.createElement(
                'div',
                {
                    className: `
                        flex flex-col items-center justify-center mb-5 md:mb-7
                        p-4 -mx-3 sm:-mx-6 -mt-3 sm:-mt-6 md:-mt-8 rounded-t-xl
                        bg-white text-black
                    `
                },
                React.createElement(
                    'h2',
                    { className: 'text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-center' },
                    'Mapa'
                )
            ),
            React.createElement(
                'div',
                {
                    id: 'map',
                    ref: mapRef,
                    className: `
                        w-full rounded-xl shadow-inner border border-gray-200
                        h-[68vh] md:h-[68vh] min-h-[400px]
                    `
                }
            )
        )
    );
};

// Premenná na sledovanie, či bol poslucháč už nastavený
let isEmailSyncListenerSetup = false;

/**
 * Táto funkcia je poslucháčom udalosti 'globalDataUpdated'.
 * Akonáhle sa dáta používateľa načítajú, vykreslí aplikáciu MyDataApp.
 */
const handleDataUpdateAndRender = (event) => {
    const userProfileData = event.detail;
    const rootElement = document.getElementById('root');
    if (userProfileData) {
        if (window.auth && window.db && !isEmailSyncListenerSetup) {
            console.log("logged-in-template.js: Nastavujem poslucháča na synchronizáciu e-mailu.");
           
            onAuthStateChanged(window.auth, async (user) => {
                if (user) {
                    try {
                        const userProfileRef = doc(window.db, 'users', user.uid);
                        const docSnap = await getDoc(userProfileRef);
           
                        if (docSnap.exists()) {
                            const firestoreEmail = docSnap.data().email;
                            if (user.email !== firestoreEmail) {
                                console.log(`logged-in-map.js: E-mail v autentifikácii (${user.email}) sa líši od e-mailu vo Firestore (${firestoreEmail}). Aktualizujem...`);
                               
                                await updateDoc(userProfileRef, { email: user.email });
           
                                const notificationsCollectionRef = collection(window.db, 'notifications');
                                await addDoc(notificationsCollectionRef, {
                                    userEmail: user.email,
                                    changes: `Zmena e-mailovej adresy z '${firestoreEmail}' na '${user.email}'.`,
                                    timestamp: new Date(),
                                });
                               
                                window.showGlobalNotification('E-mailová adresa bola automaticky aktualizovaná a synchronizovaná.', 'success');
                            } else {
                                console.log("logged-in-map.js: E-maily sú synchronizované.");
                            }
                        }
                    } catch (error) {
                        console.error("logged-in-map.js: Chyba pri synchronizácii e-mailu:", error);
                        window.showGlobalNotification('Nastala chyba pri synchronizácii e-mailovej adresy.', 'error');
                    }
                }
            });
            isEmailSyncListenerSetup = true;
        }

        if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
            const root = ReactDOM.createRoot(rootElement);
            root.render(React.createElement(AddGroupsApp, { userProfileData }));
            console.log("logged-in-map.js: Aplikácia bola vykreslená po udalosti 'globalDataUpdated'.");
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

console.log("logged-in-map.js: Registrujem poslucháča pre 'globalDataUpdated'.");
window.addEventListener('globalDataUpdated', handleDataUpdateAndRender);

if (window.globalUserProfileData) {
    console.log("logged-in-map.js: Globálne dáta už existujú. Vykresľujem aplikáciu okamžite.");
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
