// Importy pre Firebase funkcie
import { doc, getDoc, onSnapshot, updateDoc, addDoc, collection, Timestamp, deleteDoc, GeoPoint, setDoc }
  from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const { useState, useEffect, useRef } = React;

// Leaflet + Font Awesome
const leafletCSS = document.createElement('link');
leafletCSS.rel = 'stylesheet';
leafletCSS.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
document.head.appendChild(leafletCSS);

const leafletJS = document.createElement('script');
leafletJS.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
document.head.appendChild(leafletJS);

const faCSS = document.createElement('link');
faCSS.rel = 'stylesheet';
faCSS.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css';
document.head.appendChild(faCSS);

// Globálne predvolené hodnoty (fallback)
const DEFAULT_CENTER = [49.195340, 18.786106];
const DEFAULT_ZOOM = 13;

// Typy a ikony značiek
const typeIcons = {
    sportova_hala: { icon: 'fa-futbol', color: '#dc2626' },
    stravovanie:   { icon: 'fa-utensils', color: '#16a34a' },
    ubytovanie:    { icon: 'fa-bed',      color: '#6b7280' },
    zastavka:      { icon: 'fa-bus',      color: '#2563eb' }
};

const typeLabels = {
    sportova_hala: "Športová hala",
    ubytovanie:    "Ubytovanie",
    stravovanie:   "Stravovanie",
    zastavka:      "Zastávka",
};

// Global notification helper
window.showGlobalNotification = (message, type = 'success') => {
    let el = document.getElementById('global-notification');
    if (!el) {
        el = document.createElement('div');
        el.id = 'global-notification';
        el.className = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[99999]';
        document.body.appendChild(el);
    }
    const base = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[99999]';
    let cls = type === 'success' ? 'bg-green-500 text-white' :
              type === 'error'   ? 'bg-red-500 text-white' :
              type === 'info'    ? 'bg-blue-500 text-white' :
              'bg-gray-700 text-white';
    el.className = `${base} ${cls} opacity-0 scale-95`;
    el.textContent = message;
    setTimeout(() => el.className = `${base} ${cls} opacity-100 scale-100`, 10);
    setTimeout(() => el.className = `${base} ${cls} opacity-0 scale-95`, 5000);
};

const AddGroupsApp = ({ userProfileData }) => {
    const mapRef = useRef(null);
    const leafletMap = useRef(null);
    const placesLayerRef = useRef(null);
    const editMarkerRef = useRef(null);

    const [showModal, setShowModal] = useState(false);
    const [newPlaceName, setNewPlaceName] = useState('');
    const [newPlaceType, setNewPlaceType] = useState('');
    const [places, setPlaces] = useState([]);
    const [selectedPlace, setSelectedPlace] = useState(null);
    const [addressSearch, setAddressSearch] = useState('');
    const [addressSuggestions, setAddressSuggestions] = useState([]);
    const [isEditingLocation, setIsEditingLocation] = useState(false);
    const [tempLocation, setTempLocation] = useState(null);
    const [isEditingNameAndType, setIsEditingNameAndType] = useState(false);
    const [editName, setEditName] = useState('');
    const [editType, setEditType] = useState('');

    // Globálne východzie zobrazenie (načítané z DB)
    const [defaultCenter, setDefaultCenter] = useState(DEFAULT_CENTER);
    const [defaultZoom, setDefaultZoom] = useState(DEFAULT_ZOOM);

    // Referencia na globálny dokument nastavení
    const globalViewRef = doc(window.db, 'settings', 'mapDefaultView');

    // Načítanie globálneho východzieho zobrazenia
    useEffect(() => {
        if (!window.db) return;

        const loadGlobalView = async () => {
            try {
                const snap = await getDoc(globalViewRef);
                if (snap.exists()) {
                    const data = snap.data();
                    if (data.center && typeof data.zoom === 'number') {
                        setDefaultCenter([data.center.lat, data.center.lng]);
                        setDefaultZoom(data.zoom);
                        console.log('Načítané globálne východzie zobrazenie:', data);
                    }
                }
            } catch (err) {
                console.error('Chyba pri načítaní globálneho zobrazenia:', err);
            }
        };

        loadGlobalView();
    }, []);

useEffect(() => {
    let unsubscribePlaces = null;

    // ──────────────────────────────────────────────
    // Inicializácia mapy – spustí sa iba raz
    // ──────────────────────────────────────────────
    const initMap = () => {
        if (leafletMap.current) return;

        leafletMap.current = L.map(mapRef.current, { zoomControl: false })
            .setView(defaultCenter, defaultZoom);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(leafletMap.current);

        // Custom zoom + home control (🏠 vracia na aktuálne default)
        L.Control.ZoomHome = L.Control.extend({
            options: { position: 'topleft' },
            onAdd: function (map) {
                const container = L.DomUtil.create('div', 'leaflet-control-zoom leaflet-bar');
                this._zoomIn = this._createButton('+', 'Priblížiť', 'leaflet-control-zoom-in', container, () => map.zoomIn(), this);
                this._home = this._createButton('🏠', 'Pôvodné zobrazenie (globálne)', 'leaflet-control-zoom-home', container, () => {
                    if (leafletMap.current) {
                        leafletMap.current.setView(defaultCenter, defaultZoom);
                    }
                }, this);
                this._zoomOut = this._createButton('−', 'Oddialiť', 'leaflet-control-zoom-out', container, () => map.zoomOut(), this);
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

        // Tlačidlo ★ – uložiť aktuálne zobrazenie ako globálne východzie
        const setGlobalHome = L.control({ position: 'topright' });
        setGlobalHome.onAdd = function (map) {
            const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
            div.innerHTML = '<a href="#" title="Nastaviť aktuálne zobrazenie ako východzie pre všetkých" style="width:26px;height:26px;line-height:26px;text-align:center;font-size:16px;">★</a>';
            div.firstChild.onclick = async function(e) {
                e.preventDefault();
                e.stopPropagation();

                const center = map.getCenter();
                const zoom = map.getZoom();

                try {
                    await setDoc(globalViewRef, {
                        center: { lat: center.lat, lng: center.lng },
                        zoom: zoom,
                        updatedAt: Timestamp.now()
                    }, { merge: true });

                    setDefaultCenter([center.lat, center.lng]);
                    setDefaultZoom(zoom);

                    window.showGlobalNotification('Globálne východzie zobrazenie uložené!', 'success');
                } catch (err) {
                    console.error('Chyba pri ukladaní globálneho zobrazenia:', err);
                    window.showGlobalNotification('Nepodarilo sa uložiť', 'error');
                }
            };
            return div;
        };
        setGlobalHome.addTo(leafletMap.current);

        // Logovanie pohybu mapy
        leafletMap.current.on('moveend zoomend resize', () => {
            const c = leafletMap.current.getCenter();
            console.log(`[MAP] ${c.lat.toFixed(6)}, ${c.lng.toFixed(6)} | zoom ${leafletMap.current.getZoom()}`);
        });

        setTimeout(() => leafletMap.current?.invalidateSize(), 400);
    };

    // Spustenie inicializácie mapy
    if (window.L) {
        initMap();
    } else if (leafletJS) {
        leafletJS.onload = initMap;
    }

    // ──────────────────────────────────────────────
    // Načítavanie miest a tvorba markerov (pri každej zmene dát)
    // ──────────────────────────────────────────────
    if (window.db) {
        unsubscribePlaces = onSnapshot(collection(window.db, 'places'), (snapshot) => {
            const loadedPlaces = [];
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                const loc = data.location;
                loadedPlaces.push({
                    id: docSnap.id,
                    name: data.name,
                    type: data.type,
                    lat: loc?.latitude ?? data.lat,
                    lng: loc?.longitude ?? data.lng,
                    createdAt: data.createdAt
                });
            });
            setPlaces(loadedPlaces);

            // Ak mapa ešte nie je inicializovaná, počkáme
            if (!leafletMap.current) return;

            if (!placesLayerRef.current) {
                placesLayerRef.current = L.layerGroup().addTo(leafletMap.current);
            } else {
                placesLayerRef.current.clearLayers();
            }

            loadedPlaces.forEach(place => {
                if (typeof place.lat !== 'number' || typeof place.lng !== 'number') return;

                const typeConfig = typeIcons[place.type] || {
                    icon: 'fa-map-pin',
                    color: '#6b7280'
                };

                const markerHtml = `
                    <div style="
                        background: white;
                        width: 38px;
                        height: 38px;
                        border-radius: 50%;
                        border: 3px solid ${typeConfig.color};
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 3px 8px rgba(0,0,0,0.30);
                        color: ${typeConfig.color};
                        font-size: 18px;
                    ">
                        <i class="fa-solid ${typeConfig.icon}"></i>
                    </div>
                `;

                const customIcon = L.divIcon({
                    html: markerHtml,
                    className: 'custom-marker-no-border',
                    iconSize: [38, 38],
                    iconAnchor: [19, 19]
                });

                const marker = L.marker([place.lat, place.lng], { icon: customIcon });

                marker.on('click', () => {
                    setSelectedPlace(place);
                    leafletMap.current.setView([place.lat, place.lng], 18, { animate: true });
                });

                placesLayerRef.current.addLayer(marker);
            });
        }, err => console.error("onSnapshot error:", err));
    }

    // Cleanup
    return () => {
        if (unsubscribePlaces) unsubscribePlaces();
        if (leafletMap.current) {
            leafletMap.current.remove();
            leafletMap.current = null;
        }
    };
}, []);  // ← prázdna závislosť – spustí sa iba raz pri mount-e komponentu

    // ──────────────────────────────────────────────
    // RENDER
    // ──────────────────────────────────────────────
    return React.createElement('div', { className: 'flex-grow flex justify-center items-center p-2 sm:p-4 relative' },
        React.createElement('div', { className: 'w-full max-w-[1920px] mx-auto bg-white rounded-xl shadow-2xl p-4 sm:p-6 lg:p-10' },
            React.createElement('div', { className: 'flex flex-col items-center justify-center mb-5 md:mb-7 p-4 -mx-3 sm:-mx-6 -mt-3 sm:-mt-6 md:-mt-8 rounded-t-xl bg-white text-black' },
                React.createElement('h2', { className: 'text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-center' }, 'Mapa')
            ),
            React.createElement('div', { className: 'relative' },
                React.createElement('div', {
                    id: 'map',
                    ref: mapRef,
                    className: 'w-full rounded-xl shadow-inner border border-gray-200 h-[65vh] md:h-[65vh] min-h-[450px]'
                }),
                selectedPlace && React.createElement(
                    'div',
                    {
                        className: `absolute top-0 right-0 z-[1100] w-full md:w-80 h-[65vh] md:h-[65vh] min-h-[450px]
                                    bg-white shadow-2xl rounded-xl border border-gray-200 overflow-hidden flex flex-col transition-all duration-300`
                    },
                    React.createElement('div', { className: 'p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50' },
                        React.createElement('h3', { className: 'text-lg font-bold text-gray-800' }, 'Detail miesta'),
                        React.createElement('button', {
                            onClick: closeDetail,
                            className: 'text-gray-500 hover:text-gray-800 text-2xl leading-none'
                        }, '×')
                    ),
                    React.createElement('div', { className: 'p-5 flex-1 overflow-y-auto' },
                        React.createElement('h4', { className: 'text-xl font-semibold mb-4' }, selectedPlace.name || '(bez názvu)'),
                        React.createElement('p', { className: 'text-gray-600 mb-3' },
                            React.createElement('strong', null, 'Typ: '),
                            typeLabels[selectedPlace.type] || selectedPlace.type || '(nevyplnený)'
                        ),
                        React.createElement('p', { className: 'text-gray-600 mb-3' },
                            React.createElement('strong', null, 'Súradnice: '),
                            tempLocation
                                ? `${tempLocation.lat.toFixed(6)}, ${tempLocation.lng.toFixed(6)} (dočasné)`
                                : `${selectedPlace.lat.toFixed(6)}, ${selectedPlace.lng.toFixed(6)}`
                        )
                    ),
                    React.createElement('div', { className: 'p-4 border-t border-gray-200 bg-gray-50 space-y-3' },
                        React.createElement('button', {
                            onClick: () => {
                                setIsEditingNameAndType(true);
                                setEditName(selectedPlace.name || '');
                                setEditType(selectedPlace.type || '');
                            },
                            className: 'w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition'
                        }, 'Upraviť názov a typ'),
                        isEditingLocation
                            ? React.createElement('div', { className: 'flex gap-2' },
                                React.createElement('button', {
                                    onClick: handleSaveNewLocation,
                                    className: 'flex-1 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition'
                                }, 'Uložiť novú polohu'),
                                React.createElement('button', {
                                    onClick: handleCancelEditLocation,
                                    className: 'flex-1 py-3 bg-gray-500 hover:bg-gray-600 text-white font-medium rounded-lg transition'
                                }, 'Zrušiť')
                            )
                            : React.createElement('button', {
                                onClick: () => {
                                    setIsEditingLocation(true);
                                    setTempLocation({ lat: selectedPlace.lat, lng: selectedPlace.lng });
                                    if (leafletMap.current) {
                                        editMarkerRef.current = L.marker([selectedPlace.lat, selectedPlace.lng], {
                                            draggable: true,
                                            icon: L.divIcon({
                                                className: 'editing-marker',
                                                html: '<div style="background:red;width:20px;height:20px;border-radius:50%;border:3px solid white;"></div>'
                                            })
                                        }).addTo(leafletMap.current);
                                        editMarkerRef.current.on('dragend', e => {
                                            const pos = e.target.getLatLng();
                                            setTempLocation({ lat: pos.lat, lng: pos.lng });
                                        });
                                        const clickHandler = e => {
                                            setTempLocation({ lat: e.latlng.lat, lng: e.latlng.lng });
                                            if (editMarkerRef.current) editMarkerRef.current.setLatLng(e.latlng);
                                        };
                                        leafletMap.current.on('click', clickHandler);
                                        editMarkerRef.current._clickHandler = clickHandler;
                                    }
                                },
                                className: 'w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition'
                            }, 'Upraviť polohu'),
                        React.createElement('button', {
                            onClick: handleDeletePlace,
                            className: 'w-full py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition'
                        }, 'Odstrániť miesto')
                    )
                ),
                // Edit modál názov + typ
                isEditingNameAndType && React.createElement(
                    'div',
                    { className: 'fixed inset-0 z-[2100] flex items-center justify-center bg-black/60 backdrop-blur-sm' },
                    React.createElement(
                        'div',
                        { className: 'bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 transform transition-all duration-300 scale-100 relative' },
                        React.createElement('h3', { className: 'text-xl font-bold mb-5 text-gray-800' }, 'Upraviť názov a typ'),
                        React.createElement('div', { className: 'mb-5' },
                            React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1.5' }, 'Názov miesta'),
                            React.createElement('input', {
                                type: 'text',
                                value: editName,
                                onChange: e => setEditName(e.target.value),
                                className: 'w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition'
                            })
                        ),
                        React.createElement('div', { className: 'mb-6' },
                            React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1.5' }, 'Typ miesta'),
                            React.createElement('select', {
                                value: editType,
                                onChange: e => setEditType(e.target.value),
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
                                onClick: () => setIsEditingNameAndType(false),
                                className: 'px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition'
                            }, 'Zrušiť'),
                            React.createElement('button', {
                                onClick: handleSaveNameAndType,
                                disabled: !editName.trim() || !editType,
                                className: 'px-6 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition font-medium'
                            }, 'Uložiť zmeny')
                        )
                    )
                ),
                // Plávajúce tlačidlo +
                React.createElement('button', {
                    onClick: () => setShowModal(true),
                    className: 'fixed bottom-6 right-6 z-[1000] w-14 h-14 rounded-full bg-green-600 hover:bg-green-700 text-white text-3xl font-bold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center focus:outline-none focus:ring-4 focus:ring-green-300'
                }, '+'),
                // Modal na pridanie miesta (bez zmeny)
                showModal && React.createElement(
                    'div',
                    { className: 'fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm' },
                    React.createElement(
                        'div',
                        { className: 'bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 transform transition-all duration-300 scale-100 relative' },
                        React.createElement('h3', { className: 'text-xl font-bold mb-5 text-gray-800' }, 'Pridať nové miesto'),
                        React.createElement('div', { className: 'mb-5 relative' },
                            React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1.5' }, 'Vyhľadať adresu'),
                            React.createElement('input', {
                                type: 'text',
                                value: addressSearch,
                                onChange: e => {
                                    setAddressSearch(e.target.value);
                                    debouncedSearch(e.target.value);
                                },
                                placeholder: 'napr. Námestie SNP, Žilina',
                                className: 'w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition'
                            }),
                            addressSuggestions.length > 0 && React.createElement(
                                'div',
                                { className: 'absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto' },
                                addressSuggestions.map((sug, i) =>
                                    React.createElement(
                                        'div',
                                        {
                                            key: i,
                                            onClick: () => selectAddress(sug),
                                            className: 'px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm'
                                        },
                                        sug.properties?.formatted || sug.display_name || '—'
                                    )
                                )
                            )
                        ),
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
        )
    );
};

// ──────────────────────────────────────────────
// Inicializácia + listener na globalDataUpdated
// ──────────────────────────────────────────────

let isEmailSyncListenerSetup = false;
const handleDataUpdateAndRender = (event) => {
    const userProfileData = event.detail;
    const root = document.getElementById('root');
    if (!root || typeof ReactDOM === 'undefined' || typeof React === 'undefined') return;

    if (userProfileData) {
        if (window.auth && window.db && !isEmailSyncListenerSetup) {
            onAuthStateChanged(window.auth, async user => {
                if (user) {
                    try {
                        const ref = doc(window.db, 'users', user.uid);
                        const snap = await getDoc(ref);
                        if (snap.exists()) {
                            const oldEmail = snap.data().email;
                            if (user.email !== oldEmail) {
                                await updateDoc(ref, { email: user.email });
                                await addDoc(collection(window.db, 'notifications'), {
                                    userEmail: user.email,
                                    changes: `Zmena e-mailu z '${oldEmail}' na '${user.email}'`,
                                    timestamp: new Date(),
                                });
                                window.showGlobalNotification('E-mail aktualizovaný', 'success');
                            }
                        }
                    } catch (err) {
                        console.error("Chyba synchronizácie emailu:", err);
                        window.showGlobalNotification('Chyba pri aktualizácii e-mailu', 'error');
                    }
                }
            });
            isEmailSyncListenerSetup = true;
        }
        ReactDOM.createRoot(root).render(React.createElement(AddGroupsApp, { userProfileData }));
    } else {
        ReactDOM.createRoot(root).render(
            React.createElement('div', { className: 'flex justify-center items-center h-full pt-16' },
                React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
            )
        );
    }
};

window.addEventListener('globalDataUpdated', handleDataUpdateAndRender);

if (window.globalUserProfileData) {
    handleDataUpdateAndRender({ detail: window.globalUserProfileData });
} else if (document.getElementById('root')) {
    ReactDOM.createRoot(document.getElementById('root')).render(
        React.createElement('div', { className: 'flex justify-center items-center h-full pt-16' },
            React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
        )
    );
}
