// Importy pre Firebase funkcie
import { doc, getDoc, onSnapshot, updateDoc, addDoc, collection, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
const { useState, useEffect, useRef } = React;

// ================ Leaflet CDN importy ================
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
        notificationElement.className = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[99999]';
        document.body.appendChild(notificationElement);
    }
    const baseClasses = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[99999]';
    let typeClasses = '';
    switch (type) {
        case 'success': typeClasses = 'bg-green-500 text-white'; break;
        case 'error':   typeClasses = 'bg-red-500 text-white';   break;
        case 'info':    typeClasses = 'bg-blue-500 text-white';  break;
        default:        typeClasses = 'bg-gray-700 text-white';
    }
    notificationElement.className = `${baseClasses} ${typeClasses} opacity-0 scale-95`;
    notificationElement.textContent = message;
    setTimeout(() => notificationElement.className = `${baseClasses} ${typeClasses} opacity-100 scale-100`, 10);
    setTimeout(() => notificationElement.className = `${baseClasses} ${typeClasses} opacity-0 scale-95`, 5000);
};

const AddGroupsApp = ({ userProfileData }) => {
    const mapRef = useRef(null);
    const leafletMap = useRef(null);
    const placesLayerRef = useRef(null);
    const [showModal, setShowModal] = useState(false);
    const [newPlaceName, setNewPlaceName] = useState('');
    const [newPlaceType, setNewPlaceType] = useState('');
    const [places, setPlaces] = useState([]);
    const [selectedPlace, setSelectedPlace] = useState(null);

    const initialBounds = [
        [49.242758, 18.673885],
        [49.156950, 18.882281]
    ];

    const handleAddPlace = async () => {
        if (!newPlaceName.trim() || !newPlaceType) return;
        try {
            if (!window.db) throw new Error("Firestore nie je inicializované");
            const center = leafletMap.current.getCenter();

            const placeData = {
                name: newPlaceName.trim(),
                type: newPlaceType,
                location: new firebase.firestore.GeoPoint(center.lat, center.lng),
                createdAt: Timestamp.now(),
            };

            await addDoc(collection(window.db, 'places'), placeData);
            console.log("Miesto uložené:", placeData);

            setNewPlaceName('');
            setNewPlaceType('');
            setShowModal(false);
            window.showGlobalNotification('Miesto bolo pridané!', 'success');
        } catch (err) {
            console.error("Chyba pri ukladaní:", err);
            window.showGlobalNotification('Nepodarilo sa pridať miesto', 'error');
        }
    };

    useEffect(() => {
        let unsubscribePlaces = null;

        const initMap = () => {
            if (leafletMap.current) return;

            leafletMap.current = L.map(mapRef.current, { zoomControl: false })
                .fitBounds(initialBounds);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(leafletMap.current);

            // Custom Zoom + Home control
            L.Control.ZoomHome = L.Control.extend({
                options: { position: 'topleft' },
                onAdd: function (map) {
                    const container = L.DomUtil.create('div', 'leaflet-control-zoom leaflet-bar');
                    this._zoomInButton = this._createButton('+', 'Priblížiť', 'leaflet-control-zoom-in', container, () => map.zoomIn(), this);
                    this._homeButton = this._createButton('🏠', 'Pôvodné zobrazenie', 'leaflet-control-zoom-home', container, () => map.fitBounds(initialBounds), this);
                    this._zoomOutButton = this._createButton('−', 'Oddialiť', 'leaflet-control-zoom-out', container, () => map.zoomOut(), this);
                    return container;
                },
                _createButton: function (html, title, className, container, fn, context) {
                    const link = L.DomUtil.create('a', className, container);
                    link.innerHTML = html;
                    link.href = '#';
                    link.title = title;
                    L.DomEvent
                        .on(link, 'click', L.DomEvent.stopPropagation)
                        .on(link, 'mousedown', L.DomEvent.stopPropagation)
                        .on(link, 'dblclick', L.DomEvent.stopPropagation)
                        .on(link, 'click', L.DomEvent.preventDefault)
                        .on(link, 'click', fn, context);
                    return link;
                }
            });

            L.control.zoomHome = options => new L.Control.ZoomHome(options);
            L.control.zoomHome().addTo(leafletMap.current);

            const logCurrentView = () => {
                if (!leafletMap.current) return;
                const center = leafletMap.current.getCenter();
                const zoom = leafletMap.current.getZoom();
                console.log(`[MAP VIEW] Center: ${center.lat.toFixed(6)}, ${center.lng.toFixed(6)} | Zoom: ${zoom}`);
            };

            setTimeout(logCurrentView, 800);
            leafletMap.current.on('moveend zoomend resize', logCurrentView);
            setTimeout(() => leafletMap.current?.invalidateSize(), 600);
            console.log("Mapa inicializovaná");
        };

        if (!window.L) {
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

        // Načítanie miest
        if (window.db && leafletMap.current) {
            const placesRef = collection(window.db, 'places');
            unsubscribePlaces = onSnapshot(placesRef, (snapshot) => {
                const loadedPlaces = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const loc = data.location;
                    loadedPlaces.push({
                        id: doc.id,
                        name: data.name,
                        type: data.type,
                        lat: loc?.latitude || data.lat,
                        lng: loc?.longitude || data.lng,
                        createdAt: data.createdAt
                    });
                });

                setPlaces(loadedPlaces);

                console.groupCollapsed(`Načítaných miest: ${loadedPlaces.length}`);
                loadedPlaces.forEach((p, i) => {
                    console.log(`#${i+1} → ${p.name || '?'} (${p.type}) @ ${p.lat?.toFixed(5)}, ${p.lng?.toFixed(5)}`);
                });
                console.groupEnd();

                if (leafletMap.current) {
                    if (!placesLayerRef.current) {
                        placesLayerRef.current = L.layerGroup().addTo(leafletMap.current);
                        console.log("Places layer pridaná do mapy");
                    } else {
                        placesLayerRef.current.clearLayers();
                    }

                    loadedPlaces.forEach(place => {
                        if (typeof place.lat === 'number' && typeof place.lng === 'number') {
                            const marker = L.marker([place.lat, place.lng]);
                            marker.on('click', () => {
                                setSelectedPlace(place);
                                leafletMap.current.setView([place.lat, place.lng], 15, { animate: true });
                            });
                            placesLayerRef.current.addLayer(marker);
                        }
                    });

                    console.log(`Zobrazených ${loadedPlaces.length} špendlíkov`);
                }
            }, err => console.error("onSnapshot error:", err));
        }

        return () => {
            if (unsubscribePlaces) unsubscribePlaces();
            if (leafletMap.current) {
                leafletMap.current.remove();
                leafletMap.current = null;
            }
        };
    }, []);

    return React.createElement(
        'div',
        { className: 'flex-grow flex justify-center items-center p-2 sm:p-4 relative' },
        React.createElement(
            'div',
            { className: 'w-full max-w-7xl bg-white rounded-xl shadow-2xl p-3 sm:p-6 md:p-8' },
            React.createElement(
                'div',
                { className: 'flex flex-col items-center justify-center mb-5 md:mb-7 p-4 -mx-3 sm:-mx-6 -mt-3 sm:-mt-6 md:-mt-8 rounded-t-xl bg-white text-black' },
                React.createElement('h2', { className: 'text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-center' }, 'Mapa')
            ),
            React.createElement(
                'div',
                { className: 'relative' },
                React.createElement('div', {
                    id: 'map',
                    ref: mapRef,
                    className: 'w-full rounded-xl shadow-inner border border-gray-200 h-[68vh] md:h-[68vh] min-h-[400px]'
                }),
                // Sidebar – detail vybraného miesta (zarovnaný s mapou)
                selectedPlace && React.createElement(
                    'div',
                    {
                        className: `
                            absolute top-0 right-0 z-[1100] w-full md:w-80 h-[68vh] md:h-[68vh] min-h-[400px]
                            bg-white shadow-2xl rounded-xl border border-gray-200 overflow-hidden flex flex-col
                            transition-all duration-300
                        `
                    },
                    React.createElement(
                        'div',
                        { className: 'p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50' },
                        React.createElement('h3', { className: 'text-lg font-bold text-gray-800' }, 'Detail miesta'),
                        React.createElement('button', {
                            onClick: () => setSelectedPlace(null),
                            className: 'text-gray-500 hover:text-gray-800 text-2xl leading-none'
                        }, '×')
                    ),
                    React.createElement(
                        'div',
                        { className: 'p-5 flex-1 overflow-y-auto' },
                        React.createElement('h4', { className: 'text-xl font-semibold mb-3' }, selectedPlace.name || '(bez názvu)'),
                        React.createElement('p', { className: 'text-gray-600 mb-4' },
                            React.createElement('strong', null, 'Typ: '),
                            selectedPlace.type || '(nevyplnený)'
                        ),
                        React.createElement('p', { className: 'text-gray-600 mb-4' },
                            React.createElement('strong', null, 'Súradnice: '),
                            `${selectedPlace.lat.toFixed(6)}, ${selectedPlace.lng.toFixed(6)}`
                        ),
                        selectedPlace.createdAt && React.createElement('p', { className: 'text-gray-600' },
                            React.createElement('strong', null, 'Vytvorené: '),
                            selectedPlace.createdAt.toDate
                                ? selectedPlace.createdAt.toDate().toLocaleString('sk-SK')
                                : new Date(selectedPlace.createdAt).toLocaleString('sk-SK')
                        )
                    )
                )
            ),
            // Floating + button
            React.createElement('button', {
                onClick: () => setShowModal(true),
                className: 'fixed bottom-6 right-6 z-[1000] w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-3xl font-bold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center focus:outline-none focus:ring-4 focus:ring-blue-300'
            }, '+'),
            // Modálne okno pre pridanie
            showModal && React.createElement(
                'div',
                { className: 'fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm' },
                React.createElement(
                    'div',
                    { className: 'bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 transform transition-all duration-300 scale-100' },
                    React.createElement('h3', { className: 'text-xl font-bold mb-5 text-gray-800' }, 'Pridať nové miesto'),
                    React.createElement('div', { className: 'mb-5' },
                        React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1.5' }, 'Názov miesta'),
                        React.createElement('input', {
                            type: 'text',
                            value: newPlaceName,
                            onChange: e => setNewPlaceName(e.target.value),
                            placeholder: 'napr. Športová hala Dúbravka',
                            className: 'w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition'
                        })
                    ),
                    React.createElement('div', { className: 'mb-6' },
                        React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1.5' }, 'Typ miesta'),
                        React.createElement('select', {
                            value: newPlaceType,
                            onChange: e => setNewPlaceType(e.target.value),
                            className: 'w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition bg-white'
                        },
                            React.createElement('option', { value: '' }, 'Vyberte typ'),
                            React.createElement('option', { value: 'sportova_hala' }, 'Športová hala'),
                            React.createElement('option', { value: 'ubytovanie' }, 'Ubytovanie'),
                            React.createElement('option', { value: 'stravovanie' }, 'Stravovanie'),
                            React.createElement('option', { value: 'zastavka' }, 'Zastávka')
                        )
                    ),
                    React.createElement('div', { className: 'flex justify-end gap-3 mt-6' },
                        React.createElement('button', {
                            onClick: () => setShowModal(false),
                            className: 'px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition'
                        }, 'Zrušiť'),
                        React.createElement('button', {
                            onClick: handleAddPlace,
                            disabled: !newPlaceName.trim() || !newPlaceType,
                            className: 'px-6 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition font-medium'
                        }, 'Pridať')
                    )
                )
            )
        )
    );
};

// ──────────────────────────────────────────────────────────────────────────────
// Zvyšok kódu (listener, renderovanie, loader) zostáva bez zmeny
// ──────────────────────────────────────────────────────────────────────────────

let isEmailSyncListenerSetup = false;

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
                                await updateDoc(userProfileRef, { email: user.email });
                                const notificationsCollectionRef = collection(window.db, 'notifications');
                                await addDoc(notificationsCollectionRef, {
                                    userEmail: user.email,
                                    changes: `Zmena e-mailovej adresy z '${firestoreEmail}' na '${user.email}'.`,
                                    timestamp: new Date(),
                                });
                                window.showGlobalNotification('E-mail aktualizovaný', 'success');
                            }
                        }
                    } catch (error) {
                        console.error("Chyba pri synchronizácii e-mailu:", error);
                        window.showGlobalNotification('Chyba pri aktualizácii e-mailu', 'error');
                    }
                }
            });
            isEmailSyncListenerSetup = true;
        }

        if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
            const root = ReactDOM.createRoot(rootElement);
            root.render(React.createElement(AddGroupsApp, { userProfileData }));
            console.log("Aplikácia vykreslená");
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

console.log("Registrujem poslucháča 'globalDataUpdated'");
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
