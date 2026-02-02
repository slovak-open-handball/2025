// Importy pre Firebase funkcie
import { doc, getDoc, onSnapshot, updateDoc, addDoc, collection, Timestamp, deleteDoc, GeoPoint, setDoc, query, where, getDocs }
  from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
const { useState, useEffect, useRef, useCallback } = React;

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
    stravovanie: { icon: 'fa-utensils', color: '#16a34a' },
    ubytovanie: { icon: 'fa-bed', color: '#6b7280' },
    zastavka: { icon: 'fa-bus', color: '#2563eb' }
};

const typeLabels = {
    sportova_hala: "Športová hala",
    ubytovanie: "Ubytovanie",
    stravovanie: "Stravovanie",
    zastavka: "Zastávka",
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
              type === 'error' ? 'bg-red-500 text-white' :
              type === 'info' ? 'bg-blue-500 text-white' :
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
    const [defaultCenter, setDefaultCenter] = useState(DEFAULT_CENTER);
    const [defaultZoom, setDefaultZoom] = useState(DEFAULT_ZOOM);
    const [activeFilter, setActiveFilter] = useState(null);
    const globalViewRef = doc(window.db, 'settings', 'mapDefaultView');
    const [hashProcessed, setHashProcessed] = useState(false);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const markersRef = useRef({});
    const currentSelectedIdRef = useRef(null);
    const [newCapacity, setNewCapacity] = useState('');

    const [isAddingPlace, setIsAddingPlace] = useState(false);
    const [tempAddPosition, setTempAddPosition] = useState(null); 
    const tempMarkerRef = useRef(null);
    const moveHandlerRef = useRef(null);

    const addClickHandlerRef = useRef(null);
    const [selectedAddPosition, setSelectedAddPosition] = useState(null);

    const [editCapacity, setEditCapacity] = useState('');

    // Samostatná funkcia – vytvorí sa iba raz
    const handleAddClick = useCallback((e) => {
        console.log("CLICK NA MAPE zachytený v režime pridávania!", e.latlng);
    
        const pos = { lat: e.latlng.lat, lng: e.latlng.lng };
    
        // Uložíme pozíciu
        setSelectedAddPosition(pos);
        setTempAddPosition(pos);
    
        // Zastavíme mousemove
        if (moveHandlerRef.current) {
            leafletMap.current?.off('mousemove', moveHandlerRef.current);
            moveHandlerRef.current = null;
        }
    
        // Odstránime tento click handler (už nepotrebujeme ďalšie kliky)
        if (leafletMap.current && addClickHandlerRef.current) {
            leafletMap.current.off('click', addClickHandlerRef.current);
            addClickHandlerRef.current = null;
        }
    
        // Dočasný marker
        if (leafletMap.current) {
            tempMarkerRef.current = L.marker([pos.lat, pos.lng], {
                icon: L.divIcon({
                    className: 'adding-marker pointer-events-none',
                    html: '<div style="background:#ef4444;width:28px;height:28px;border-radius:50%;border:4px solid white;box-shadow:0 0 12px rgba(0,0,0,0.6);"></div>',
                    iconSize: [28, 28],
                    iconAnchor: [14, 14]
                }),
                interactive: false,
                bubblingMouseEvents: false,
                pane: 'overlayPane'
            }).addTo(leafletMap.current);
        }

        setIsAddingPlace(false);

        setTimeout(() => {
            setShowModal(true);
        }, 350);
    
        // Fallback pre istotu
        window.lastAddedPosition = pos;
    
    }, []);  // ← závislosti prázdne, lebo už nepotrebujeme isAddingPlace
    
    
    const startAddingPlace = () => {
        if (isAddingPlace) return;
    
        console.log("Spúšťam režim pridávania");
    
        setIsAddingPlace(true);
        setTempAddPosition(null);
        setShowModal(false);

        // Čistenie starého mousemove (ak existuje)
        if (moveHandlerRef.current) {
            leafletMap.current?.off('mousemove', moveHandlerRef.current);
            moveHandlerRef.current = null;
        }
    
        const onMouseMove = (e) => {
            setTempAddPosition({ lat: e.latlng.lat, lng: e.latlng.lng });
        };
    
        leafletMap.current.on('mousemove', onMouseMove);
        moveHandlerRef.current = onMouseMove;
    
        // ← TU JE KLÚČOVÁ ZMENA: používaj skutočný handler, nie testovací
        if (addClickHandlerRef.current) {
            leafletMap.current.off('click', addClickHandlerRef.current);
        }
    
        addClickHandlerRef.current = handleAddClick;          // ← toto!
        leafletMap.current.on('click', handleAddClick);       // ← toto!
    
        console.log("→ pridávací click handler (handleAddClick) pridaný");
    };
    
    
    const cancelAddingPlace = () => {
        console.log("Ruším režim pridávania");
    
        setIsAddingPlace(false);
        setTempAddPosition(null);
        setShowModal(false);
        setSelectedAddPosition(null);
        window.lastAddedPosition = null;

        // Odstránenie mousemove
        if (moveHandlerRef.current) {
            leafletMap.current?.off('mousemove', moveHandlerRef.current);
            moveHandlerRef.current = null;
        }

        // Odstránenie click handlera
        if (leafletMap.current && addClickHandlerRef.current) {
            leafletMap.current.off('click', addClickHandlerRef.current);
            addClickHandlerRef.current = null;
            console.log("→ pridávací click handler odstránený");
        }
    
        // ← Kľúčová zmena: odstránenie dočasného markera
        if (tempMarkerRef.current) {
            tempMarkerRef.current.remove();
            tempMarkerRef.current = null;
            console.log("Dočasný červený marker odstránený");
        }
    };
    
    const setPlaceHash = (placeId) => {
      if (placeId) {
        window.history.replaceState(null, '', `#place-${placeId}`);
      } else {
        window.history.replaceState(null, '', window.location.pathname);
      }
    };

    const handleAddPlace = async () => {
        console.log("handleAddPlace volané");
        console.log("selectedAddPosition:", selectedAddPosition);
        console.log("window.lastAddedPosition:", window.lastAddedPosition);
    
        if (!newPlaceName.trim() || !newPlaceType) {
            window.showGlobalNotification('Názov a typ sú povinné', 'error');
            return;
        }
    
        // ----------------- NOVÉ: kontrola duplicity -----------------
        const nameTrimmed = newPlaceName.trim();
        const hasDuplicate = await checkDuplicateNameAndType(nameTrimmed, newPlaceType);
    
        if (hasDuplicate) {
            window.showGlobalNotification(
                `Miesto s názvom "${nameTrimmed}" už existuje v kategórii ${typeLabels[newPlaceType] || newPlaceType}!`,
                'error'
            );
            // voliteľné – focus na input
            document.querySelector('input[placeholder="napr. ŠH Rosinská"]')?.focus();
            return;
        }
        // -------------------------------------------------------------
    
    
        // Najprv skúsime state
        let position = selectedAddPosition;
    
        // Ak state ešte nie je aktualizovaný → fallback
        if (!position && window.lastAddedPosition) {
            position = window.lastAddedPosition;
            console.log("Používam fallback window.lastAddedPosition:", position);
        }
    
        if (!position) {
            window.showGlobalNotification('Najprv kliknite na mapu pre výber polohy', 'error');
            return;
        }
    
        try {
            const placeData = {
                name: nameTrimmed,
                name_lower: nameTrimmed.toLowerCase(),
                type: newPlaceType,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                lat: position.lat,
                lng: position.lng,
            };
    
            // kapacita...
            if (newPlaceType === 'ubytovanie' || newPlaceType === 'stravovanie') {
                const cap = parseInt(newCapacity, 10);
                if (!isNaN(cap) && cap > 0) {
                    placeData.capacity = cap;
                }
            }
    
            await addDoc(collection(window.db, 'places'), placeData);
    
            window.showGlobalNotification('Miesto bolo pridané', 'success');
    
            // Vyčistenie
            setShowModal(false);
            setNewPlaceName('');
            setNewPlaceType('');
            setNewCapacity('');
            setTempAddPosition(null);
            setSelectedAddPosition(null);
            window.lastAddedPosition = null;
    
            if (tempMarkerRef.current) {
                tempMarkerRef.current.remove();
                tempMarkerRef.current = null;
            }
    
        } catch (err) {
            console.error("Chyba pri pridávaní:", err);
            window.showGlobalNotification('Nepodarilo sa pridať miesto', 'error');
        }
    };

    const checkDuplicateNameAndType = async (name, type) => {
        if (!window.db) {
            console.error("window.db nie je dostupné!");
            return false;
        }
    
        try {
            console.log("Kontrolujem duplicitu → názov:", name);
            console.log("Typ:", type);
            console.log("Hľadám name_lower == ", name.toLowerCase());
    
            const q = query(
                collection(window.db, 'places'),
                where('name_lower', '==', name.toLowerCase()),
                where('type', '==', type)
            );
    
            const snap = await getDocs(q);
            
            console.log("Nájdených dokumentov:", snap.size);
            snap.forEach(doc => {
                console.log("Nájdené duplicitné miesto:", doc.id, doc.data().name, doc.data().name_lower);
            });
    
            const exists = !snap.empty;
            console.log("Duplicita existuje?", exists);
            return exists;
        } catch (err) {
            console.error("!!! CHYBA PRI KONTROLE DUPLICITY !!!", err);
            console.error("Stack:", err.stack);
            return false;
        }
    };

    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash;
            if (!hash || !hash.startsWith('#place-')) return;

            const placeId = hash.replace('#place-', '');
            if (!placeId) return;

            const place = places.find(p => p.id === placeId);
            if (!place) return;

            setSelectedPlace(place);
            setHashProcessed(true);

            // Nepokúšame sa zoomovať tu – presúvame to do samostatného efektu
        };
  
        handleHashChange();
        window.addEventListener('hashchange', handleHashChange);
    
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [places]);

    useEffect(() => {
        window.goToDefaultView = () => {
            if (leafletMap.current) {
                console.log("Klik na domček → idem na:", defaultCenter, defaultZoom);
                leafletMap.current.setView(defaultCenter, defaultZoom, { animate: true });
            }
        };

        return () => {
            delete window.goToDefaultView;
        };
    }, [defaultCenter, defaultZoom]);

    useEffect(() => {
      if (!leafletMap.current) return;
    
      const prevId = currentSelectedIdRef.current;
    
      // Vráť starý marker do normálu
      if (prevId && prevId !== selectedPlace?.id && markersRef.current[prevId]) {
        markersRef.current[prevId].marker.setIcon(
          markersRef.current[prevId].normalIcon
        );
      }

      // Nastav invertovaný na nový
      if (selectedPlace && markersRef.current[selectedPlace.id]) {
        markersRef.current[selectedPlace.id].marker.setIcon(
          markersRef.current[selectedPlace.id].selectedIcon
        );
      }

      currentSelectedIdRef.current = selectedPlace?.id || null;
    }, [selectedPlace, places.length]);
  

    // Načítanie globálneho východzieho zobrazenia
    // 1. useEffect – načítanie default view z DB (už máš, ale pridáme logiku)
    useEffect(() => {
      const loadGlobalView = async () => {
        try {
          const snap = await getDoc(globalViewRef);
          if (snap.exists()) {
            const data = snap.data();
            if (data.center && typeof data.zoom === 'number') {
              const newCenter = [data.center.lat, data.center.lng];
              setDefaultCenter(newCenter);
              setDefaultZoom(data.zoom);
              console.log("Načítané default view z DB:", newCenter, data.zoom);

              // Ak mapa už existuje → hneď presuň
              if (leafletMap.current) {
                leafletMap.current.setView(newCenter, data.zoom, { animate: true });
                console.log("Mapa presunutá hneď po načítaní z DB");
              }
            }
          }
        } catch (err) {
          console.error("CHYBA pri čítaní default view:", err);
        }
      };

      loadGlobalView();
    }, []);   // ← spustiť iba raz pri mount-e komponentu

    // ──────────────────────────────────────────────
    // Pomocné funkcie
    // ──────────────────────────────────────────────
    const closeDetail = () => {
        setSelectedPlace(null);
        setIsEditingLocation(false);
        setTempLocation(null);
        setIsEditingNameAndType(false);
        setEditCapacity('');
        if (editMarkerRef.current) {
            if (editMarkerRef.current._clickHandler) {
                leafletMap.current.off('click', editMarkerRef.current._clickHandler);
            }
            editMarkerRef.current.remove();
            editMarkerRef.current = null;
        }
        if (leafletMap.current) {
            leafletMap.current.setView(defaultCenter, defaultZoom, { animate: true });
        }
        setPlaceHash(null);
    };

    const handleSaveNameAndType = async () => {
        if (!selectedPlace || !window.db) return;
        if (!editName.trim() || !editType) {
            window.showGlobalNotification('Názov a typ musia byť vyplnené', 'error');
            return;
        }
    
        try {
            const updates = {
                name: editName.trim(),
                type: editType,
                updatedAt: Timestamp.now(),
            };
    
            // Ak je typ ubytovanie alebo stravovanie → ukladáme kapacitu
            if (editType === 'ubytovanie' || editType === 'stravovanie') {
                const cap = parseInt(editCapacity, 10);
                if (!isNaN(cap) && cap > 0) {
                    updates.capacity = cap;
                } else {
                    // ak je pole prázdne alebo neplatné → môžeme vymazať capacity
                    updates.capacity = null; // alebo deleteField() ak chceš úplne odstrániť pole
                }
            } else {
                // iné typy → odstránime capacity ak existovalo
                updates.capacity = null;
            }
    
            const placeRef = doc(window.db, 'places', selectedPlace.id);
            await updateDoc(placeRef, updates);
    
            // Aktualizácia lokálneho stavu
            setSelectedPlace(prev => ({
                ...prev,
                name: editName.trim(),
                type: editType,
                capacity: updates.capacity
            }));
    
            setPlaces(prevPlaces =>
                prevPlaces.map(p =>
                    p.id === selectedPlace.id
                        ? { ...p, name: editName.trim(), type: editType, capacity: updates.capacity }
                        : p
                )
            );
    
            window.showGlobalNotification('Údaje boli aktualizované', 'success');
            setIsEditingNameAndType(false);
            setEditCapacity('');
        } catch (err) {
            console.error("Chyba pri ukladaní:", err);
            window.showGlobalNotification('Nepodarilo sa uložiť zmeny', 'error');
        }
    };

    const handleSaveNewLocation = async () => {
        if (!selectedPlace || !tempLocation || !window.db) return;
        try {
            const placeRef = doc(window.db, 'places', selectedPlace.id);
            await updateDoc(placeRef, {
                location: new GeoPoint(tempLocation.lat, tempLocation.lng),
                updatedAt: Timestamp.now(),
            });
            setSelectedPlace(prev => prev ? {
                ...prev,
                lat: tempLocation.lat,
                lng: tempLocation.lng
            } : null);
            window.showGlobalNotification('Poloha bola aktualizovaná', 'success');
            setIsEditingLocation(false);
            setTempLocation(null);
            if (editMarkerRef.current) {
                if (editMarkerRef.current._clickHandler) {
                    leafletMap.current.off('click', editMarkerRef.current._clickHandler);
                }
                editMarkerRef.current.remove();
                editMarkerRef.current = null;
            }
        } catch (err) {
            console.error("Chyba pri ukladaní novej polohy:", err);
            window.showGlobalNotification('Nepodarilo sa uložiť novú polohu', 'error');
        }
    };

    const handleCancelEditLocation = () => {
        setIsEditingLocation(false);
        setTempLocation(null);
        if (editMarkerRef.current) {
            if (editMarkerRef.current._clickHandler) {
                leafletMap.current.off('click', editMarkerRef.current._clickHandler);
            }
            editMarkerRef.current.remove();
            editMarkerRef.current = null;
        }
    };

    const handleDeletePlace = async () => {
        if (!selectedPlace || !window.db) return;
        if (!confirm(`Naozaj chcete odstrániť miesto "${selectedPlace.name || 'bez názvu'}"?`)) return;
        try {
            await deleteDoc(doc(window.db, 'places', selectedPlace.id));
            window.showGlobalNotification('Miesto bolo odstránené', 'success');
            closeDetail();
        } catch (err) {
            console.error("Chyba pri odstraňovaní:", err);
            window.showGlobalNotification('Nepodarilo sa odstrániť miesto', 'error');
        }
    };

    // ─── Inicializácia mapy (iba raz) ───
    useEffect(() => {
        if (leafletMap.current) return;        

        const initMap = () => {

            const initialCenter = defaultCenter;
            const initialZoom = defaultZoom;
          
            leafletMap.current = L.map(mapRef.current, { 
                zoomControl: false,
                zoomDelta: 0.25,
                wheelPxPerZoomLevel: 100 
              })
              .setView(defaultCenter, defaultZoom)

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(leafletMap.current);

            // Custom Zoom + Home control
            L.Control.ZoomHome = L.Control.extend({
                options: { position: 'topleft' },
                onAdd: function (map) {
                    const container = L.DomUtil.create('div', 'leaflet-control-zoom leaflet-bar');

                    // +
                    this._zoomIn = L.DomUtil.create('a', 'leaflet-control-zoom-in', container);
                    this._zoomIn.innerHTML = '+';
                    this._zoomIn.href = '#';
                    this._zoomIn.title = 'Priblížiť';
                    L.DomEvent.on(this._zoomIn, 'click', L.DomEvent.stopPropagation);
                    L.DomEvent.on(this._zoomIn, 'click', () => {
                        const current = map.getZoom();
                        map.setZoom(current + 1, { animate: true });
                    });
                    // 🏠
                    this._home = L.DomUtil.create('a', 'leaflet-control-zoom-home', container);
                    this._home.innerHTML = '🏠';
                    this._home.href = '#';
                    this._home.title = 'Pôvodné zobrazenie (z databázy)';
                    L.DomEvent.on(this._home, 'click', L.DomEvent.stopPropagation);
                    L.DomEvent.on(this._home, 'click', () => {
                        console.log("DOMČEK – aktuálne default hodnoty:", defaultCenter, defaultZoom);
                        window.goToDefaultView?.();
                    });

                    // −
                    this._zoomOut = L.DomUtil.create('a', 'leaflet-control-zoom-out', container);
                    this._zoomOut.innerHTML = '−';
                    this._zoomOut.href = '#';
                    this._zoomOut.title = 'Oddialiť';
                    L.DomEvent.on(this._zoomOut, 'click', L.DomEvent.stopPropagation);
                    L.DomEvent.on(this._zoomOut, 'click', () => {
                        const current = map.getZoom();
                        map.setZoom(current - 1, { animate: true });
                    });
                  
                    return container;
                }
            });
            L.control.zoomHome = function (options) {
                return new L.Control.ZoomHome(options);
            };
            L.control.zoomHome().addTo(leafletMap.current);

            // Tlačidlo ★
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
                        map.setView([center.lat, center.lng], zoom, { animate: true });
                        window.showGlobalNotification('Globálne východzie uložené a nastavené!', 'success');
                    } catch (err) {
                        console.error('Chyba pri ukladaní:', err);
                        window.showGlobalNotification('Nepodarilo sa uložiť', 'error');
                    }
                };
                return div;
            };
            setGlobalHome.addTo(leafletMap.current);

            leafletMap.current.on('moveend zoomend resize', () => {
                const c = leafletMap.current.getCenter();
                console.log(`[MAP] ${c.lat.toFixed(6)}, ${c.lng.toFixed(6)} | zoom ${leafletMap.current.getZoom()}`);
            });

            setTimeout(() => leafletMap.current?.invalidateSize(), 400);
            console.log("Mapa inicializovaná na fallback súradniciach");

            leafletMap.current.on('click', (e) => {
                console.log("RAW MAP CLICK EVENT FIRED", e.latlng);
            });
        };

        if (defaultCenter !== DEFAULT_CENTER || defaultZoom !== DEFAULT_ZOOM) {
          leafletMap.current.setView(defaultCenter, defaultZoom, { animate: true });
        }

        if (window.L) {
            initMap();
        } else if (leafletJS) {
            leafletJS.onload = initMap;
        }

        return () => {
            if (leafletMap.current) {
                leafletMap.current.eachLayer(layer => leafletMap.current.removeLayer(layer));
                leafletMap.current.off();
                leafletMap.current.remove();
                leafletMap.current = null;
            }
            if (placesLayerRef.current) {
                placesLayerRef.current.clearLayers();
                placesLayerRef.current = null;
            }
            if (editMarkerRef.current) {
                editMarkerRef.current.remove();
                editMarkerRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (!leafletMap.current || !selectedPlace) return;
    
        const { lat, lng } = selectedPlace;
    
        // Čakáme, kým je mapa "ready" (niekedy treba malé oneskorenie)
        const timer = setTimeout(() => {
            if (leafletMap.current) {
                leafletMap.current.setView([lat, lng], 18, {
                    animate: true,
                    duration: 1.0,           // jemnejšie
                    easeLinearity: 0.25
                });
                console.log(`Zoom na miesto ${selectedPlace.name} → [${lat.toFixed(6)}, ${lng.toFixed(6)}] zoom 18`);
            }
        }, 300);   // 300–600 ms zvyčajne stačí

        return () => clearTimeout(timer);
    }, [selectedPlace, leafletMap.current]);
    
    // Posun mapy po načítaní default view z DB
//    useEffect(() => {
//        if (!leafletMap.current) return;
//
//        if (!isInitialLoad || selectedPlace || hashProcessed) {
//          console.log("Preskakujem default view – nie je to prvé načítanie alebo niečo je vybrané");
//          return;
//        }
//      
//        console.log("Prvé načítanie – aplikujem default view:", defaultCenter, defaultZoom);
//        leafletMap.current.setView(defaultCenter, defaultZoom, {
//          animate: true,
//          duration: 1.2
//        });
//        setIsInitialLoad(false);
//    }, [defaultCenter, defaultZoom, leafletMap.current, isInitialLoad, selectedPlace, hashProcessed]);

    // Načítanie a filtrovanie miest
    useEffect(() => {
      let unsubscribePlaces = null;
    
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
              createdAt: data.createdAt,
              capacity: data.capacity || null,
            });
          });
    
          // FILTROVANIE podľa activeFilter
          let filteredPlaces = loadedPlaces;
          if (activeFilter) {
            filteredPlaces = loadedPlaces.filter(place => place.type === activeFilter);
          }
    
          setPlaces(filteredPlaces);
    
          if (!leafletMap.current) return;
    
          // VŽDY najprv vyčistíme staré markery
          if (placesLayerRef.current) {
            placesLayerRef.current.clearLayers();
          } else {
            placesLayerRef.current = L.layerGroup().addTo(leafletMap.current);
          }
    
          // Teraz pridáme nové markery s aktuálnym selectedPlace
          filteredPlaces.forEach(place => {
            if (typeof place.lat !== 'number' || typeof place.lng !== 'number') return;
          
            const typeConfig = typeIcons[place.type] || {
              icon: 'fa-map-pin',
              color: '#6b7280'
            };
          
            // Normálna ikona
            const normalHtml = `
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
                transition: all 0.2s ease;
              ">
                <i class="fa-solid ${typeConfig.icon}"></i>
              </div>
            `;
          
            const normalIcon = L.divIcon({
              html: normalHtml,
              className: 'custom-marker-no-border',
              iconSize: [38, 38],
              iconAnchor: [19, 19]
            });
          
            // Invertovaná ikona (pre vybrané)
            const selectedHtml = `
              <div style="
                background: ${typeConfig.color};
                width: 38px;
                height: 38px;
                border-radius: 50%;
                border: 3px solid white;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 3px 8px rgba(0,0,0,0.30);
                color: white;
                font-size: 18px;
                transition: all 0.2s ease;
              ">
                <i class="fa-solid ${typeConfig.icon}"></i>
              </div>
            `;
          
            const selectedIcon = L.divIcon({
              html: selectedHtml,
              className: 'custom-marker-no-border',
              iconSize: [38, 38],
              iconAnchor: [19, 19]
            });
          
            const marker = L.marker([place.lat, place.lng], { icon: normalIcon });
          
            marker.on('click', (e) => {
                // Zastavíme propagáciu iba ak nechceme, aby map.click bežal
                // L.DomEvent.stopPropagation(e);   ← toto NEpoužívaj, inak map.click nikdy nefunguje
                setSelectedPlace(place);
                setPlaceHash(place.id);
            });
          
            placesLayerRef.current.addLayer(marker);
          
            // Ulož obe ikony
            markersRef.current[place.id] = {
              marker,
              normalIcon,
              selectedIcon
            };
          });
        }, err => console.error("onSnapshot error:", err));
      }
    
      return () => {
        if (unsubscribePlaces) unsubscribePlaces();
      };
    }, [activeFilter]); 

    // ──────────────────────────────────────────────
    // RENDER
    // ──────────────────────────────────────────────
    return React.createElement('div', { className: 'flex-grow flex justify-center items-center p-2 sm:p-4 relative' },
        React.createElement('div', { className: 'w-full max-w-[1920px] mx-auto bg-white rounded-xl shadow-2xl p-4 sm:p-6 lg:p-10' },
            React.createElement('div', { className: 'flex flex-col items-center justify-center mb-5 md:mb-7 p-4 -mx-3 sm:-mx-6 -mt-3 sm:-mt-6 md:-mt-8 rounded-t-xl bg-white text-black' },
                React.createElement('h2', { className: 'text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-center mb-6' }, 'Mapa'),

                // 4 tlačidlá filtrovania
                React.createElement('div', { className: 'flex flex-wrap justify-center gap-3 sm:gap-4' },
                    React.createElement('button', {
                        onClick: () => setActiveFilter(activeFilter === 'sportova_hala' ? null : 'sportova_hala'),
                        className: `px-5 py-2.5 rounded-full font-medium transition-all duration-200 flex items-center gap-2 shadow-sm ${
                            activeFilter === 'sportova_hala'
                                ? 'bg-red-600 text-white border-2 border-red-800 scale-105'
                                : 'bg-white text-gray-800 border-2 border-[#dc2626] hover:bg-red-50'
                        }`
                    },
                        React.createElement('i', { className: 'fa-solid fa-futbol' }),
                        'Športové haly'
                    ),

                    React.createElement('button', {
                        onClick: () => setActiveFilter(activeFilter === 'ubytovanie' ? null : 'ubytovanie'),
                        className: `px-5 py-2.5 rounded-full font-medium transition-all duration-200 flex items-center gap-2 shadow-sm ${
                            activeFilter === 'ubytovanie'
                                ? 'bg-gray-700 text-white border-2 border-gray-900 scale-105'
                                : 'bg-white text-gray-800 border-2 border-[#6b7280] hover:bg-gray-100'
                        }`
                    },
                        React.createElement('i', { className: 'fa-solid fa-bed' }),
                        'Ubytovanie'
                    ),

                    React.createElement('button', {
                        onClick: () => setActiveFilter(activeFilter === 'stravovanie' ? null : 'stravovanie'),
                        className: `px-5 py-2.5 rounded-full font-medium transition-all duration-200 flex items-center gap-2 shadow-sm ${
                            activeFilter === 'stravovanie'
                                ? 'bg-green-700 text-white border-2 border-green-900 scale-105'
                                : 'bg-white text-gray-800 border-2 border-[#16a34a] hover:bg-green-50'
                        }`
                    },
                        React.createElement('i', { className: 'fa-solid fa-utensils' }),
                        'Stravovanie'
                    ),

                    React.createElement('button', {
                        onClick: () => setActiveFilter(activeFilter === 'zastavka' ? null : 'zastavka'),
                        className: `px-5 py-2.5 rounded-full font-medium transition-all duration-200 flex items-center gap-2 shadow-sm ${
                            activeFilter === 'zastavka'
                                ? 'bg-blue-700 text-white border-2 border-blue-900 scale-105'
                                : 'bg-white text-gray-800 border-2 border-[#2563eb] hover:bg-blue-50'
                        }`
                    },
                        React.createElement('i', { className: 'fa-solid fa-bus' }),
                        'Zastávky'
                    )
                )
            ),

            React.createElement('div', { className: 'relative' },
                React.createElement('div', {
                    id: 'map',
                    ref: mapRef,
                    className: 'w-full rounded-xl shadow-inner border border-gray-200 h-[68vh] md:h-[68vh] min-h-[450px]'
                }),

                selectedPlace && React.createElement(
                  'div',
                    {
                      key: selectedPlace.id,
                      className: `absolute top-0 right-0 z-[1100] w-full md:w-80 h-[68vh] md:h-[68vh] min-h-[450px]
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
                      // Názov
                      React.createElement('h4', { className: 'text-xl font-semibold mb-4' }, selectedPlace.name || '(bez názvu)'),
              
                      // Typ
                      React.createElement('p', { className: 'text-gray-600 mb-3' },
                          React.createElement('strong', null, 'Typ: '),
                          typeLabels[selectedPlace.type] || selectedPlace.type || '(nevyplnený)'
                      ),

                      // Kapacita – NOVÉ
                      (selectedPlace.capacity &&
                       (selectedPlace.type === 'ubytovanie' || selectedPlace.type === 'stravovanie')) &&
                          React.createElement('p', { className: 'text-gray-600 mb-3 flex items-center gap-2' },
                             React.createElement('strong', null, 
                                  selectedPlace.type === 'ubytovanie'
                                      ? 'Počet lôžok:'
                                      : 'Kapacita:'
                              ),
                              ' ',  // medzera pred hodnotou
                              selectedPlace.type === 'ubytovanie'
                                  ? `${selectedPlace.capacity}`
                                  : `${selectedPlace.capacity}`
                          ),
                                      
                      // Súradnice
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
                                if (selectedPlace && selectedPlace.lat && selectedPlace.lng) {
                                    const url = `https://www.google.com/maps/dir/?api=1&destination=${selectedPlace.lat},${selectedPlace.lng}`;
                                    window.open(url, '_blank', 'noopener,noreferrer');
                                } else {
                                    window.showGlobalNotification('Poloha miesta nie je dostupná', 'error');
                                }
                            },
                            className: 'w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition flex items-center justify-center gap-2'
                        },
                            React.createElement('i', { className: 'fa-solid fa-directions text-lg' }),
                            'Navigovať'
                        ),
                        React.createElement('button', {
                            onClick: () => {
                                setIsEditingNameAndType(true);
                                setEditName(selectedPlace.name || '');
                                setEditType(selectedPlace.type || '');
                                setEditCapacity(
                                    selectedPlace.capacity != null
                                        ? String(selectedPlace.capacity)
                                        : ''
                                );
                            },
                            className: 'w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition'
                        },
                            selectedPlace?.type === 'ubytovanie' || selectedPlace?.type === 'stravovanie'
                                ? 'Upraviť názov/typ/kapacitu'
                                : 'Upraviť názov/typ'
                        ),
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
                      
                      React.createElement('h3', { className: 'text-xl font-bold mb-5 text-gray-800' }, 'Upraviť údaje miesta'),
                      
                      // Názov
                      React.createElement('div', { className: 'mb-5' },
                          React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1.5' }, 'Názov miesta'),
                          React.createElement('input', {
                              type: 'text',
                              value: editName,
                              onChange: e => setEditName(e.target.value),
                              className: 'w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition'
                          })
                      ),
                      
                      // Typ
                      React.createElement('div', { className: 'mb-5' },
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
                      
                      // Kapacita – zobrazí sa iba pri ubytovanie / stravovanie
                      (editType === 'ubytovanie' || editType === 'stravovanie') &&
                          React.createElement('div', { className: 'mb-6' },
                              React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1.5' },
                                  editType === 'ubytovanie' ? 'Počet lôžok' : 'Kapacita (miesta / porcie)'
                              ),
                              React.createElement('input', {
                                  type: 'number',
                                  min: '1',
                                  value: editCapacity,
                                  onChange: e => setEditCapacity(e.target.value),
                                  placeholder: editType === 'ubytovanie' ? 'napr. 48' : 'napr. 120',
                                  className: 'w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition'
                              })
                          )
                      ,
                      
                      // Tlačidlá
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
                    onClick: isAddingPlace ? cancelAddingPlace : startAddingPlace,
                    className: `fixed bottom-6 right-6 z-[1000] w-14 h-14 rounded-full text-white text-3xl font-bold shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center focus:outline-none focus:ring-4 ${
                        isAddingPlace
                            ? 'bg-red-600 hover:bg-red-700 focus:ring-red-300 scale-110'
                            : 'bg-green-600 hover:bg-green-700 focus:ring-green-300'
                    }`
                },
                    React.createElement('i', {
                        className: isAddingPlace ? 'fa-solid fa-xmark' : 'fa-solid fa-plus'
                    })
                ),
                // Modal na pridanie miesta (tu len kostra – ak máš logiku pridávania, vlož ju)
                showModal && React.createElement(
                    'div',
                    { className: 'fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm' },
                    React.createElement(
                        'div',
                        { className: 'bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 transform transition-all duration-300 scale-100 relative' },
                        
                        React.createElement('h3', { className: 'text-xl font-bold mb-5 text-gray-800' }, 'Pridať nové miesto'),

                        tempAddPosition && React.createElement('div', { className: 'mb-5 text-sm text-gray-600' },
                            React.createElement('strong', null, 'Vybraná poloha: '),
                            `${tempAddPosition.lat.toFixed(6)}, ${tempAddPosition.lng.toFixed(6)}`
                        ),
                        
                        // Názov
                        React.createElement('div', { className: 'mb-5' },
                            React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1.5' }, 'Názov miesta'),
                            React.createElement('input', {
                                type: 'text',
                                value: newPlaceName,
                                onChange: e => setNewPlaceName(e.target.value),
                                placeholder: 'napr. ŠH Rosinská',
                                className: 'w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition'
                            })
                        ),
                        
                        // Typ
                        React.createElement('div', { className: 'mb-5' },
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
                        
                        // Kapacita – zobrazí sa len pri Ubytovanie alebo Stravovanie
                        (newPlaceType === 'ubytovanie' || newPlaceType === 'stravovanie') && 
                            React.createElement('div', { className: 'mb-6' },
                                React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1.5' }, 
                                    newPlaceType === 'ubytovanie' ? 'Počet lôžok' : 'Kapacita'
                                ),
                                React.createElement('input', {
                                    type: 'number',
                                    min: '1',
                                    value: newCapacity,
                                    onChange: e => setNewCapacity(e.target.value),
                                    placeholder: newPlaceType === 'ubytovanie' ? 'napr. 48' : 'napr. 120',
                                    className: 'w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition'
                                    // Poznámka: ak chceš ukladať kapacitu, musíš pridať nový state napr. [newCapacity, setNewCapacity]
                                })
                            ),
                        
                        // Tlačidlá
                        React.createElement('div', { className: 'flex justify-end gap-3 mt-6' },
                            React.createElement('button', {
                                onClick: cancelAddingPlace,
                                className: 'px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition'
                            }, 'Zrušiť'),
                            
                            React.createElement('button', {
                                onClick: handleAddPlace,
                                disabled: !newPlaceName.trim() || !newPlaceType,
                                className: 'px-6 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition font-medium'
                            }, 'Pridať miesto')
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
