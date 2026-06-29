// Importy pre Firebase funkcie
import { doc, getDoc, getDocs, onSnapshot, updateDoc, addDoc, collection, Timestamp, deleteDoc, GeoPoint, setDoc }
  from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
const { useState, useEffect, useRef, useCallback, useMemo } = React;
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
const MapApp = ({ userProfileData }) => {
    const mapRef = useRef(null);
    const leafletMap = useRef(null);
    const placesLayerRef = useRef(null);
    const editMarkerRef = useRef(null);
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
    const markersRef = useRef({});
    const currentSelectedIdRef = useRef(null);
    const [newCapacity, setNewCapacity] = useState('');
    const [editCapacity, setEditCapacity] = useState('');
    const [nameTypeError, setNameTypeError] = useState(null);
    const [accommodationTypes, setAccommodationTypes] = useState([]);
    const [selectedAccommodationType, setSelectedAccommodationType] = useState('');
    const [editAccommodationType, setEditAccommodationType] = useState('');
    const [capacityError, setCapacityError] = useState(null);
    const [allPlaces, setAllPlaces] = useState([]);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [placeToDelete, setPlaceToDelete] = useState(null);
    const [newPlaceNote, setNewPlaceNote] = useState('');
    const [editNote, setEditNote] = useState('');
    // Premenné pre cenu ubytovania
    const [newPricePerNight, setNewPricePerNight] = useState('');
    const [editPricePerNight, setEditPricePerNight] = useState('');
    const [newCostPerNight, setNewCostPerNight] = useState(''); 
    const [editCostPerNight, setEditCostPerNight] = useState('');
    const [priceError, setPriceError] = useState(null);
  
    const [newBreakfastPrice, setNewBreakfastPrice] = useState('');
    const [newLunchPrice, setNewLunchPrice] = useState('');
    const [newDinnerPrice, setNewDinnerPrice] = useState('');
    const [editBreakfastPrice, setEditBreakfastPrice] = useState('');
    const [editLunchPrice, setEditLunchPrice] = useState('');
    const [editDinnerPrice, setEditDinnerPrice] = useState('');
    const [mealPriceError, setMealPriceError] = useState(null);

    const [hallRentalPrices, setHallRentalPrices] = useState({});
    const [editHallRentalPrices, setEditHallRentalPrices] = useState({});
    const [tournamentDates, setTournamentDates] = useState({ start: null, end: null, days: [] });

    const [showAccommodationTypesDropdown, setShowAccommodationTypesDropdown] = useState(false);
    const [selectedAccommodationTypeFilter, setSelectedAccommodationTypeFilter] = useState(null);

    const [isSportHallAssigned, setIsSportHallAssigned] = useState(false);

    const [newHeaderColor, setNewHeaderColor] = useState('#1e40af');
    const [editHeaderColor, setEditHeaderColor] = useState('#1e40af');
    const [newHeaderTextColor, setNewHeaderTextColor] = useState('#000000');
    const [editHeaderTextColor, setEditHeaderTextColor] = useState('#000000');
  
    const accommodationAvailabilityEdit = useMemo(() => {
      if (!accommodationTypes.length || !selectedPlace) return {};
 
      const result = {};
      accommodationTypes.forEach((accType) => {
        const total = accType.capacity || 0;
        let occupied = places
          .filter(p => p.type === 'ubytovanie' && p.accommodationType === accType.type)
          .reduce((sum, p) => sum + (p.capacity || 0), 0);
 
        if (
          selectedPlace?.type === 'ubytovanie' &&
          selectedPlace?.accommodationType === accType.type
        ) {
          occupied -= selectedPlace?.capacity || 0;
        }
        const free = total - occupied;
        result[accType.type] = {
          free,
          isFull: free <= 0,
          total,
        };
      });
      return result;
    }, [accommodationTypes, places, selectedPlace]);
    
    const accommodationAvailabilityAdd = useMemo(() => {
        if (!accommodationTypes.length) return {};
        const result = {};
        accommodationTypes.forEach((accType) => {
          const total = accType.capacity || 0;
          const occupied = places
            .filter(p => p.type === 'ubytovanie' && p.accommodationType === accType.type)
            .reduce((sum, p) => sum + (p.capacity || 0), 0);
          const free = total - occupied;
          result[accType.type] = {
            free,
            isFull: free <= 0,
            total,
          };
        });
        return result;
      }, [accommodationTypes, places]);
    
    // Ref pre kontajner zoznamu miest
    const placesListRef = useRef(null);
    
    // Ref pre rozbaľovacie menu
    const dropdownRef = useRef(null);
    
    // Funkcia na scrollovanie k vybranému miestu v zozname
    const scrollToSelectedPlace = useCallback(() => {
        if (!selectedPlace || !placesListRef.current) return;
    
        // Počkáme na renderovanie DOM
        setTimeout(() => {
            if (placesListRef.current) {
                const selectedElement = placesListRef.current.querySelector(`[data-place-id="${selectedPlace.id}"]`);
                if (selectedElement) {
                    selectedElement.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'center',
                        inline: 'nearest'
                    });
                }
            }
        }, 200);
    }, [selectedPlace]);

    useEffect(() => {
        if (!window.db) return;
    
        const fetchTournamentDates = async () => {
            try {
                const settingsRef = doc(window.db, 'settings', 'registration');
                const settingsSnap = await getDoc(settingsRef);
                
                if (settingsSnap.exists()) {
                    const data = settingsSnap.data();
                    const startDate = data.tournamentStart?.toDate();
                    const endDate = data.tournamentEnd?.toDate();
                    
                    if (startDate && endDate && startDate <= endDate) {
                        const days = [];
                        const currentDate = new Date(startDate);
                        currentDate.setHours(0, 0, 0, 0);
                        const endDateTime = new Date(endDate);
                        endDateTime.setHours(0, 0, 0, 0);
                        
                        while (currentDate <= endDateTime) {
                            const dateStr = currentDate.toISOString().split('T')[0];
                            days.push(dateStr);
                            currentDate.setDate(currentDate.getDate() + 1);
                        }
                        
                        setTournamentDates({
                            start: startDate,
                            end: endDate,
                            days: days
                        });
                    } else {
                        setTournamentDates({ start: null, end: null, days: [] });
                    }
                }
            } catch (err) {
                console.error("Chyba pri načítaní dátumov turnaja:", err);
            }
        };
        
        fetchTournamentDates();
        
        // Počúvanie na zmeny v settings/registration
        const unsubscribe = onSnapshot(doc(window.db, 'settings', 'registration'), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const startDate = data.tournamentStart?.toDate();
                const endDate = data.tournamentEnd?.toDate();
                
                if (startDate && endDate && startDate <= endDate) {
                    const days = [];
                    const currentDate = new Date(startDate);
                    currentDate.setHours(0, 0, 0, 0);
                    const endDateTime = new Date(endDate);
                    endDateTime.setHours(0, 0, 0, 0);
                    
                    while (currentDate <= endDateTime) {
                        const dateStr = currentDate.toISOString().split('T')[0];
                        days.push(dateStr);
                        currentDate.setDate(currentDate.getDate() + 1);
                    }
                    
                    setTournamentDates({
                        start: startDate,
                        end: endDate,
                        days: days
                    });
                } else {
                    setTournamentDates({ start: null, end: null, days: [] });
                }
            }
        });
        
        return () => unsubscribe();
    }, []);

    // NOVÉ: Effect pre zatváranie dropdownu pri kliknutí mimo
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowAccommodationTypesDropdown(false);
            }
        };
        
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

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
        scrollToSelectedPlace();
    }, [selectedPlace, scrollToSelectedPlace]);
    
    // Funkcia na kliknutie na miesto (používa sa pri kliknutí na kartu aj na mape)
    const handlePlaceClick = useCallback((place) => {
        setSelectedPlace(place);
        setPlaceHash(place.id);
    
        // Reset filtrov, ak klikáme na miesto
        if (activeFilter !== place.type) {
            setActiveFilter(null);
            setSelectedAccommodationTypeFilter(null);
            setShowAccommodationTypesDropdown(false);
        }
        
        if (leafletMap.current) {
          leafletMap.current.setView([place.lat, place.lng], 18, { animate: true });
        }  
    }, [activeFilter]);
    
    const setPlaceHash = (placeId) => {
      if (placeId) {
        window.history.replaceState(null, '', `#place-${placeId}`);
      } else {
        window.history.replaceState(null, '', window.location.pathname);
      }
    };

    useEffect(() => {
        if (newPlaceType !== 'ubytovanie') {
            setPriceError(null);
            return;
        }
    
        const price = parseFloat(newPricePerNight);
        const cost = parseFloat(newCostPerNight);
        
        if (!newPricePerNight || !newCostPerNight) {
            setPriceError(null);
            return;
        }
      
        if (isNaN(price) || price <= 0) {
            setPriceError('Cena pre kluby musí byť kladné číslo');
        } else if (isNaN(cost) || cost <= 0) {
            setPriceError('Náklady musia byť kladné číslo');
        } else {
            setPriceError(null);
        }
    }, [newPricePerNight, newCostPerNight, newPlaceType]);

    // Validácia ceny a nákladov pre ubytovanie (editácia)
    useEffect(() => {
        if (!isEditingNameAndType || editType !== 'ubytovanie') {
            setPriceError(null);
            return;
        }

        const price = parseFloat(editPricePerNight);
        const cost = parseFloat(editCostPerNight);
    
        if (!editPricePerNight || !editCostPerNight) {
            setPriceError(null);
            return;
        }
    
        if (isNaN(price) || price <= 0) {
            setPriceError('Cena pre kluby musí byť kladné číslo');
        } else if (isNaN(cost) || cost <= 0) {
            setPriceError('Náklady musia byť kladné číslo');
        } else {
            setPriceError(null);
        }
    }, [editPricePerNight, editCostPerNight, editType, isEditingNameAndType]);
    
    // NOVÉ: Validácia cien pre stravovanie (editácia)
    useEffect(() => {
        if (!isEditingNameAndType || editType !== 'stravovanie') {
            setMealPriceError(null);
            return;
        }
 
        const breakfastPrice = editBreakfastPrice ? parseFloat(editBreakfastPrice) : null;
        const lunchPrice = editLunchPrice ? parseFloat(editLunchPrice) : null;
        const dinnerPrice = editDinnerPrice ? parseFloat(editDinnerPrice) : null;
        
        let error = null;
        
        if (breakfastPrice !== null && (isNaN(breakfastPrice) || breakfastPrice < 0)) {
            error = 'Cena za raňajky musí byť kladné číslo';
        } else if (lunchPrice !== null && (isNaN(lunchPrice) || lunchPrice < 0)) {
            error = 'Cena za obed musí byť kladné číslo';
        } else if (dinnerPrice !== null && (isNaN(dinnerPrice) || dinnerPrice < 0)) {
            error = 'Cena za večeru musí byť kladné číslo';
        }
        
        setMealPriceError(error);
    }, [editBreakfastPrice, editLunchPrice, editDinnerPrice, editType, isEditingNameAndType]);
    
    useEffect(() => {
      if (!window.db) return;
 
      const unsubscribe = onSnapshot(
        doc(window.db, 'settings', 'accommodation'),
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            const typesArray = Array.isArray(data.types) ? data.types : [];
     
            const validTypes = typesArray
              .filter(item => item && typeof item === 'object' && typeof item.type === 'string')
              .map(item => ({
                type: item.type.trim(),
                capacity: Number(item.capacity) || 0
              }));

            setAccommodationTypes(validTypes);
         
          } else {
            setAccommodationTypes([]);
          }
          },
        (error) => {
          setAccommodationTypes([]);
        }
      );
      return () => unsubscribe();
    }, []);
    
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
        };
        handleHashChange();
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [places]);
    
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
              if (leafletMap.current) {
                leafletMap.current.setView(newCenter, data.zoom, { animate: true });
              }
            }
          }
        } catch (err) {
        }
      };
      loadGlobalView();
    }, []);
    
    // Pomocné funkcie
    const closeDetail = () => {
        setSelectedPlace(null);
        setIsEditingLocation(false);
        setTempLocation(null);
        setIsEditingNameAndType(false);
        setEditCapacity('');
        setEditNote('');
        setEditPricePerNight('');
        setEditCostPerNight('');
        setEditBreakfastPrice('');
        setEditLunchPrice('');
        setEditDinnerPrice('');
        setMealPriceError(null);
        setActiveFilter(null);
        setSelectedAccommodationTypeFilter(null);
        setShowAccommodationTypesDropdown(false);
        setHallRentalPrices({});
        setEditHallRentalPrices({});
        
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

        Object.keys(markersRef.current).forEach(placeId => {
            const markerObj = markersRef.current[placeId];
            if (markerObj && markerObj.marker) {
              markerObj.marker.setIcon(markerObj.normalIcon);
              markerObj.marker.setZIndexOffset(0);
            }
        });
    
        // NOVÉ: Scroll na začátek seznamu míst
        setTimeout(() => {
            if (placesListRef.current) {
                placesListRef.current.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
            }
        }, 100);
    };
    
    // NOVÉ: Upravené funkcie pre tlačidlo Ubytovanie
    const handleAccommodationButtonClick = () => {
        if (activeFilter === 'ubytovanie') {
            // Ak už je filter aktívny, zruš ho (zobraz všetky miesta)
            setActiveFilter(null);
            setSelectedAccommodationTypeFilter(null);
            setShowAccommodationTypesDropdown(false);
            setSelectedPlace(null);
            setPlaceHash(null);
            window.goToDefaultView?.();
        } else {  
            // Ak filter nie je aktívny, aktivuj filter ubytovanie (všetky typy)
            setActiveFilter('ubytovanie');
            setSelectedAccommodationTypeFilter(null);
            setShowAccommodationTypesDropdown(false);
            setSelectedPlace(null);
            setPlaceHash(null);
            window.goToDefaultView?.();
        }
    };

    // NOVÉ: Funkcia pre kliknutie na šipku (len rozbalenie/zatvorenie dropdownu)
    const handleAccommodationArrowClick = (e) => {
        e.stopPropagation(); // Zastaví event aby sa nespustil handleAccommodationButtonClick
        
        // Ak filter ešte nie je aktivovaný, aktivuj ho
        if (activeFilter !== 'ubytovanie') {
            setActiveFilter('ubytovanie');
            setSelectedAccommodationTypeFilter(null);
            setSelectedPlace(null);
            setPlaceHash(null);
            window.goToDefaultView?.();
        }
        
        // Toggle dropdown menu
        setShowAccommodationTypesDropdown(!showAccommodationTypesDropdown);
    }; 

    // NOVÉ: Funkcia pre výber všetkých ubytovní
    const handleSelectAllAccommodations = () => {
        setSelectedAccommodationTypeFilter(null);
        setActiveFilter('ubytovanie');
        setShowAccommodationTypesDropdown(false);
        setSelectedPlace(null);
        setPlaceHash(null);
        window.goToDefaultView?.();
    };

    // NOVÉ: Upravená funkcia pre výber typu ubytovania
    const handleSelectAccommodationTypeFilter = (type) => {
        if (type === selectedAccommodationTypeFilter) {
            // Ak klikneme na už vybraný typ, zrušíme filter typu, ale ponecháme filter ubytovanie
            setSelectedAccommodationTypeFilter(null);
        } else {
            setSelectedAccommodationTypeFilter(type);
        }
        setSelectedPlace(null);
        setPlaceHash(null);
        window.goToDefaultView?.();
    };
    
    // NOVÉ: Výpočet počtu ubytovní podľa typu
    const getAccommodationCountByType = (type) => {
        return allPlaces.filter(p => p.type === 'ubytovanie' && p.accommodationType === type).length;
    };
    
    // Inicializácia mapy
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
              .setView(defaultCenter, defaultZoom);
    
            // Hlavná vrstva
            const mainLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                detectRetina: false, // Zmena z true na false
                crossOrigin: 'anonymous', // Upresnenie crossOrigin
                noWrap: true, // Zabrániť opakovaniu dlaždíc
                errorTileUrl: '', // Prázdna URL pre chybové dlaždice
                updateWhenIdle: true, // Optimizácia aktualizácie
                reuseTiles: false, // Zmena z true na false
                updateWhenZooming: false // Zmena z true na false
            });
    
            // Fallback vrstva (len pre prípad potreby)
            const fallbackLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© OpenStreetMap contributors',
                subdomains: ['a', 'b', 'c'], // Pridané subdomény pre lepšiu dostupnosť
                detectRetina: false
            });
    
            // Skúste pridať hlavnú vrstvu
            mainLayer.addTo(leafletMap.current);
            
            // Ak hlavná vrstva zlyhá, prepnite na fallback
            mainLayer.on('tileerror', function(e) {
                console.warn('Tile error on main layer, tile:', e.tile.src);
                
                // Vytvor novú dlaždicu na chybovú
                const errorImg = e.tile;
                errorImg.onload = null;
                errorImg.onerror = null;
                
                // Skús alternatívnu URL
                const originalSrc = e.tile.src;
                const altSrc = originalSrc.replace('tile.openstreetmap.org', '{s}.tile.openstreetmap.org');
                e.tile.src = altSrc.replace('{s}', 'a');
            });  
            
            // Custom Zoom + Home control
            L.Control.ZoomHome = L.Control.extend({
                options: { position: 'topleft' },
                onAdd: function (map) {
                    const container = L.DomUtil.create('div', 'leaflet-control-zoom leaflet-bar');
                    
                    this._zoomIn = L.DomUtil.create('a', 'leaflet-control-zoom-in', container);
                    this._zoomIn.innerHTML = '+';
                    this._zoomIn.href = '#';
                    this._zoomIn.title = 'Priblížiť';
                    L.DomEvent.on(this._zoomIn, 'click', L.DomEvent.stopPropagation);
                    L.DomEvent.on(this._zoomIn, 'click', () => {
                        const current = map.getZoom();
                        map.setZoom(current + 1, { animate: true });
                    });
                    
                    this._home = L.DomUtil.create('a', 'leaflet-control-zoom-home', container);
                    this._home.innerHTML = '🏠';
                    this._home.href = '#';
                    this._home.title = 'Pôvodné zobrazenie (z databázy)';
                    L.DomEvent.on(this._home, 'click', L.DomEvent.stopPropagation);
                    L.DomEvent.on(this._home, 'click', () => {
                        console.log("DOMČEK – aktuálne default hodnoty:", defaultCenter, defaultZoom);
                        window.goToDefaultView?.();
                    });
                    
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
        } else {
            // Pridajte listener pre načítanie scriptu
            leafletJS.onload = () => {
                console.log("Leaflet script načítaný");
                setTimeout(() => {
                    if (window.L) initMap();
                }, 100);
            };
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
        
        const timer = setTimeout(() => {
            if (leafletMap.current) {
                leafletMap.current.setView([lat, lng], 18, {
                    animate: true,
                    duration: 1.0,
                    easeLinearity: 0.25
                });
                console.log(`Zoom na miesto ${selectedPlace.name} → [${lat.toFixed(6)}, ${lng.toFixed(6)}] zoom 18`);
            }
        }, 300);
        
        return () => clearTimeout(timer);
    }, [selectedPlace, leafletMap.current]);
    
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
              accommodationType: data.accommodationType || null,
              pricePerNight: data.pricePerNight || null,
              costPerNight: data.costPerNight || null,
              breakfastPrice: data.breakfastPrice || null,
              lunchPrice: data.lunchPrice || null,
              dinnerPrice: data.dinnerPrice || null,
              note: data.note || null,
              hallRentalPrices: data.hallRentalPrices || null,
              headerColor: data.headerColor || '#1e40af',
              headerTextColor: data.headerTextColor || '#000000' 
            });
          });
          
          setAllPlaces(loadedPlaces);
          
          let filteredPlaces = loadedPlaces;
          if (activeFilter) {
            if (activeFilter === 'ubytovanie' && selectedAccommodationTypeFilter) {
              // Filter podľa typu ubytovania
              filteredPlaces = loadedPlaces.filter(place => 
                place.type === 'ubytovanie' && place.accommodationType === selectedAccommodationTypeFilter
              );
            } else {
              filteredPlaces = loadedPlaces.filter(place => place.type === activeFilter);
            }
          }
          setPlaces(filteredPlaces);
          
          // Přidejte podmínku - nerefreshujte markery pokud máme otevřený detail
          if (!leafletMap.current || selectedPlace) return;
          
          if (placesLayerRef.current) {
            placesLayerRef.current.clearLayers();
          } else {
            placesLayerRef.current = L.layerGroup().addTo(leafletMap.current);
          }
          
          filteredPlaces.forEach(place => {
            if (typeof place.lat !== 'number' || typeof place.lng !== 'number') return;
     
            const typeConfig = typeIcons[place.type] || {
              icon: 'fa-map-pin',
              color: '#6b7280'
            };
     
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
     
            const marker = L.marker([place.lat, place.lng], { 
              icon: normalIcon,
              zIndexOffset: 0
            });
     
            marker.on('click', (e) => {
              handlePlaceClick(place);
            });
     
            placesLayerRef.current.addLayer(marker);
     
            markersRef.current[place.id] = {
              marker,
              normalIcon,
              selectedIcon
            };
          });
          
          // Po pridaní všetkých markerov, nastav vybraný marker (ak existuje)
          if (selectedPlace && markersRef.current[selectedPlace.id]) {
            const selectedMarker = markersRef.current[selectedPlace.id];
            if (selectedMarker && selectedMarker.marker) {
              selectedMarker.marker.setIcon(selectedMarker.selectedIcon);
              selectedMarker.marker.setZIndexOffset(1000);
            }
          }
        }, err => console.error("onSnapshot error:", err));
      }
      return () => {
        if (unsubscribePlaces) unsubscribePlaces();
        // Nemažeme vrstvu pokud máme otevřený detail
        if (placesLayerRef.current && !selectedPlace) {
          placesLayerRef.current.clearLayers();
        }
      };
    }, [activeFilter, selectedAccommodationTypeFilter]); // Odstraňte handlePlaceClick z dependency array
    
    // Potom přidejte samostatný efekt pro aktualizaci ikon při změně selectedPlace:
    useEffect(() => {
        if (!leafletMap.current || !placesLayerRef.current || !selectedPlace) return;

        // Reset všetkých markerov na normálnu ikonu
        Object.keys(markersRef.current).forEach(placeId => {
            const markerObj = markersRef.current[placeId];
            if (markerObj && markerObj.marker) {
                markerObj.marker.setIcon(markerObj.normalIcon);
                markerObj.marker.setZIndexOffset(0);
            }
        });
    
        // Nastav vybranému markeru selected ikonu
        if (selectedPlace && markersRef.current[selectedPlace.id]) {
            const selectedMarker = markersRef.current[selectedPlace.id];
            if (selectedMarker && selectedMarker.marker) {
                selectedMarker.marker.setIcon(selectedMarker.selectedIcon);
                selectedMarker.marker.setZIndexOffset(1000);
            }
        }
    }, [selectedPlace]);
    
    // NOVÉ: Získanie názvu vybraného typu ubytovania pre zobrazenie v tlačidle
    const getSelectedAccommodationTypeLabel = () => {
        if (!selectedAccommodationTypeFilter) return 'Všetky typy';
        const type = accommodationTypes.find(t => t.type === selectedAccommodationTypeFilter);
        return type ? type.type : selectedAccommodationTypeFilter;
    };
    
    // RENDER
    return React.createElement('div', { className: 'flex-grow flex justify-center items-center p-0 sm:p-2 relative' },
      React.createElement('div', { className: 'w-full max-w-[1920px] mx-auto bg-white rounded-xl shadow-2xl p-2 sm:p-4 lg:p-6' },
        // NADPIS A ŠTATISTIKY PREHĽADU
        React.createElement('div', { className: 'flex flex-col items-center justify-center mb-1 md:mb-2 p-3 -mx-2 sm:-mx-4 -mt-2 sm:-mt-4 rounded-t-xl bg-white text-black' },
          React.createElement('h2', { className: 'text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-center mb-3' }, 'Mapa'),
          
          // ŠTATISTIKY PREHĽADU (nahradili tlačidlá filtrov)
          React.createElement('div', { className: 'w-full mb-2' },
            React.createElement('div', { className: 'grid grid-cols-2 sm:grid-cols-4 gap-3' },
              // Športové haly
              React.createElement('button', {
                onClick: () => { 
                  setActiveFilter(activeFilter === 'sportova_hala' ? null : 'sportova_hala'); 
                  setSelectedAccommodationTypeFilter(null);
                  setShowAccommodationTypesDropdown(false);
                  setSelectedPlace(null); 
                  setPlaceHash(null); 
                  window.goToDefaultView?.(); 
                },
                className: `p-3 rounded-lg border-2 transition-all duration-200 flex items-start shadow-sm h-18 ${
                  activeFilter === 'sportova_hala'
                    ? 'bg-red-50 border-red-300 scale-105'
                    : 'bg-white border-gray-200 hover:bg-red-50 hover:border-red-200'
                }`
              },

                React.createElement('div', { className: 'flex items-start w-full' },
                  React.createElement('div', { className: 'w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mr-3 mt-1' },
                    React.createElement('i', { className: 'fa-solid fa-futbol text-red-600 text-3xl' })
                  ),
                  React.createElement('div', { className: 'flex-1 text-left' },
                    React.createElement('p', { className: 'text-3xl font-bold text-gray-800 leading-tight' }, 
                      allPlaces.filter(p => p.type === 'sportova_hala').length
                    ),
                    React.createElement('p', { className: `text-2xl font-medium mt-1 leading-tight ${
                      activeFilter === 'sportova_hala' ? 'text-red-700' : 'text-gray-600'
                    }` }, 'Športové haly')
                  )
                )
              ),
              
              // Ubytovanie (s rozbaľovacím menu)
              React.createElement('div', { 
                  ref: dropdownRef,
                  className: 'relative'
              },
                  React.createElement('button', {
                      onClick: handleAccommodationButtonClick,
                      className: `p-3 rounded-lg border-2 transition-all duration-200 flex items-start shadow-sm h-18 w-full ${
                          activeFilter === 'ubytovanie'
                              ? 'bg-gray-50 border-gray-300 scale-105'
                              : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                      }`
                  },
                      React.createElement('div', { className: 'flex items-start w-full' },
                          React.createElement('div', { className: 'w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mr-3 mt-1' },
                              React.createElement('i', { className: 'fa-solid fa-bed text-gray-600 text-3xl' })
                          ),
                          React.createElement('div', { className: 'flex-1 text-left' },
                              React.createElement('p', { className: 'text-3xl font-bold text-gray-800 leading-tight' }, 
                                  selectedAccommodationTypeFilter 
                                      ? allPlaces.filter(p => p.type === 'ubytovanie' && p.accommodationType === selectedAccommodationTypeFilter).length
                                      : allPlaces.filter(p => p.type === 'ubytovanie').length
                              ),
                              React.createElement('div', { className: 'flex justify-between items-center' },
                                  React.createElement('p', { className: `text-2xl font-medium mt-1 leading-tight ${
                                      activeFilter === 'ubytovanie' ? 'text-gray-700' : 'text-gray-600'
                                  }` }, 
                                      selectedAccommodationTypeFilter 
                                          ? `Ubytovanie (${getSelectedAccommodationTypeLabel()})`
                                          : 'Ubytovanie'
                                  ),
                                  React.createElement('button', {
                                      onClick: handleAccommodationArrowClick,
                                      className: `ml-2 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors ${
                                          activeFilter === 'ubytovanie' ? 'text-gray-700' : 'text-gray-600'
                                      }`
                                  },
                                      React.createElement('i', { 
                                          className: `fas fa-chevron-down text-lg transition-transform ${showAccommodationTypesDropdown ? 'transform rotate-180' : ''}`
                                      })
                                  )
                              )
                          )
                      )
                  ),
                  
                  // Rozbaľovacie menu typov ubytovania (zobrazené iba keď je filter aktívny)
                  showAccommodationTypesDropdown && React.createElement('div', {
                      className: 'absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto'
                  },
                      // Položka "Všetky typy"
                      React.createElement('button', {
                          onClick: () => {
                              handleSelectAllAccommodations();
                              setShowAccommodationTypesDropdown(false);
                          },
                          className: `w-full px-4 py-3 text-left hover:bg-gray-50 flex justify-between items-center ${
                              !selectedAccommodationTypeFilter ? 'bg-gray-100' : ''
                          }`
                      },
                          React.createElement('span', { 
                              className: `text-lg font-medium ${!selectedAccommodationTypeFilter ? 'text-gray-800' : 'text-gray-600'}`
                          }, 'Všetky typy'),
                          React.createElement('span', { className: 'text-gray-500 text-lg' },
                              allPlaces.filter(p => p.type === 'ubytovanie').length
                          )
                      ),
                      
                      // Oddeľovač
                      React.createElement('div', { className: 'border-t border-gray-200' }),
                      
                      // Typy ubytovania
                      accommodationTypes.map((item, index) => {
                          const count = getAccommodationCountByType(item.type);
                          const isSelected = selectedAccommodationTypeFilter === item.type;
                          return React.createElement('button', {
                              key: index,
                              onClick: () => {
                                  handleSelectAccommodationTypeFilter(item.type);
                                  setShowAccommodationTypesDropdown(false);
                              },
                              className: `w-full px-4 py-3 text-left hover:bg-gray-50 flex justify-between items-center ${
                                  isSelected ? 'bg-gray-100' : ''
                              }`
                          },
                              React.createElement('span', { 
                                  className: `text-lg font-medium ${isSelected ? 'text-gray-800' : 'text-gray-600'}`
                              }, item.type),
                              React.createElement('span', { className: 'text-gray-500 text-base' },
                                  count
                              )
                          );
                      })
                  )
              ),
              
              // Stravovanie
              React.createElement('button', {
                onClick: () => { 
                  setActiveFilter(activeFilter === 'stravovanie' ? null : 'stravovanie'); 
                  setSelectedAccommodationTypeFilter(null); 
                  setShowAccommodationTypesDropdown(false); 
                  setSelectedPlace(null); 
                  setPlaceHash(null); 
                  window.goToDefaultView?.(); 
                },
                className: `p-3 rounded-lg border-2 transition-all duration-200 flex items-start shadow-sm h-18 ${
                  activeFilter === 'stravovanie'
                    ? 'bg-green-50 border-green-300 scale-105'
                    : 'bg-white border-gray-200 hover:bg-green-50 hover:border-green-200'
                }`
              },
                React.createElement('div', { className: 'flex items-start w-full' },
                  React.createElement('div', { className: 'w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mr-3 mt-1' },
                    React.createElement('i', { className: 'fa-solid fa-utensils text-green-600 text-3xl' })
                  ),
                  React.createElement('div', { className: 'flex-1 text-left' },
                    React.createElement('p', { className: 'text-3xl font-bold text-gray-800 leading-tight' }, 
                      allPlaces.filter(p => p.type === 'stravovanie').length
                    ),
                    React.createElement('p', { className: `text-2xl font-medium mt-1 leading-tight ${
                      activeFilter === 'stravovanie' ? 'text-green-700' : 'text-gray-600'
                    }` }, 'Stravovanie')
                  )
                )
              ),
              
              // Zastávky
              React.createElement('button', {
                onClick: () => { 
                  setActiveFilter(activeFilter === 'zastavka' ? null : 'zastavka'); 
                  setSelectedAccommodationTypeFilter(null); 
                  setShowAccommodationTypesDropdown(false); 
                  setSelectedPlace(null); 
                  setPlaceHash(null); 
                  window.goToDefaultView?.(); 
                },
                className: `p-3 rounded-lg border-2 transition-all duration-200 flex items-start shadow-sm h-18 ${
                  activeFilter === 'zastavka'
                    ? 'bg-blue-50 border-blue-300 scale-105'
                    : 'bg-white border-gray-200 hover:bg-blue-50 hover:border-blue-200'
                }`
              },
                React.createElement('div', { className: 'flex items-start w-full' },
                  React.createElement('div', { className: 'w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mr-3 mt-1' },
                    React.createElement('i', { className: 'fa-solid fa-bus text-blue-600 text-3xl' })
                  ),
                  React.createElement('div', { className: 'flex-1 text-left' },
                    React.createElement('p', { className: 'text-3xl font-bold text-gray-800 leading-tight' }, 
                      allPlaces.filter(p => p.type === 'zastavka').length
                    ),
                    React.createElement('p', { className: `text-2xl font-medium mt-1 leading-tight ${
                      activeFilter === 'zastavka' ? 'text-blue-700' : 'text-gray-600'
                    }` }, 'Zastávky')
                  )
                )
              )
            )
          )
        ),

        // ZMENENÉ: Main content s flex layoutom
        React.createElement('div', { className: 'flex flex-col lg:flex-row gap-3 lg:gap-4' },
          // Ľavá časť - Mapa a jej kontroly
          React.createElement('div', { className: 'lg:w-3/4 relative' },
            React.createElement('div', { className: 'relative' },
              // Mapa
              React.createElement('div', {
                id: 'map',
                ref: mapRef,
                className: 'w-full rounded-xl shadow-inner border border-gray-200 h-[68vh] md:h-[68vh] min-h-[450px] z-0'
              }),

              // Detail vybraného miesta (sidebar)
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
                  React.createElement('h4', { className: 'text-xl font-semibold mb-4' }, selectedPlace.name || '(bez názvu)'),
                  React.createElement('p', { className: 'text-gray-600 mb-3' },
                    React.createElement('strong', null, 'Typ: '),
                    selectedPlace.type === 'ubytovanie' && selectedPlace.accommodationType ? `${typeLabels[selectedPlace.type]} (${selectedPlace.accommodationType})` : typeLabels[selectedPlace.type] || selectedPlace.type || '(nevyplnený)'
                  ),
                  (selectedPlace.capacity && (selectedPlace.type === 'ubytovanie' || selectedPlace.type === 'stravovanie')) &&
                    React.createElement('p', { className: 'text-gray-600 mb-3 flex items-center gap-2' },
                      React.createElement('strong', null,
                        selectedPlace.type === 'ubytovanie' ? 'Počet lôžok:' : 'Kapacita:'
                      ),
                      selectedPlace.capacity
                    ),
                  
                  React.createElement('p', { className: 'text-gray-600 mb-3' },
                    React.createElement('strong', null, 'Súradnice: '),
                    tempLocation
                      ? `${tempLocation.lat.toFixed(6)}, ${tempLocation.lng.toFixed(6)} (dočasné)`
                      : `${selectedPlace.lat.toFixed(6)}, ${selectedPlace.lng.toFixed(6)}`
                  ),
                  
                  selectedPlace.note && React.createElement('div', { className: 'mb-3' },
                    React.createElement('strong', { className: 'block text-gray-700 mb-1' }, 'Poznámka:'),
                    React.createElement('p', { className: 'text-gray-600 whitespace-pre-line' },  
                      selectedPlace.note
                    )
                  ),
                ),
                React.createElement('div', { className: 'p-4 border-t border-gray-200 bg-gray-50 space-y-3' },
                  React.createElement('button', {
                    onClick: () => {
                      if (selectedPlace?.lat && selectedPlace?.lng) {
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
                  )
                )
              )
            )
          ),
          
          // Pravá časť - ZOZNAM MIEST (teraz už bez štatistík)
          React.createElement('div', { className: 'lg:w-1/4' },
            React.createElement('div', { className: 'bg-gray-50 rounded-xl p-6 shadow-inner h-full flex flex-col' },
              
              // ZOZNAM MIEST
              React.createElement('div', { className: 'flex-1' },
                React.createElement('h3', { className: 'text-2xl font-bold mb-4 text-gray-800 border-b pb-3' }, 
                  React.createElement('i', { className: 'fa-solid fa-list mr-3' }),
                  'Zoznam miest',
                  React.createElement('span', { className: 'ml-3 text-lg font-normal text-gray-600' }, 
                    `(${allPlaces.length} ${allPlaces.length === 1 ? 'miesto' : allPlaces.length < 5 ? 'miesta' : 'miest'})`
                  )
                ),
                
                allPlaces.length === 0 ? 
                  React.createElement('div', { className: 'text-center py-8 text-gray-500' },
                    React.createElement('i', { className: 'fa-solid fa-map-pin text-4xl mb-3 opacity-50' }),
                    React.createElement('p', null, 'Žiadne miesta na zobrazenie')
                  ) :
                  React.createElement('div', { 
                    ref: placesListRef,
                    className: 'overflow-y-auto h-[60vh] md:h-[60vh] min-h-[300px] pr-2'
                  },
                    // Filtrovanie miest podľa aktívneho filtra a typu ubytovania
                    (() => {
                      let filtered = allPlaces;
                      
                      if (activeFilter) {
                        filtered = filtered.filter(p => p.type === activeFilter);
                        
                        // Ak je aktívny filter ubytovanie a máme vybratý konkrétny typ
                        if (activeFilter === 'ubytovanie' && selectedAccommodationTypeFilter) {
                          filtered = filtered.filter(p => p.accommodationType === selectedAccommodationTypeFilter);
                        }
                      }
                      
                      return filtered
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map(place => {
                          const typeConfig = typeIcons[place.type] || { icon: 'fa-map-pin', color: '#6b7280' };
                          return React.createElement('div', { 
                            key: place.id, 
                            'data-place-id': place.id,
                            className: `mb-3 rounded-lg border shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden ${
                              selectedPlace?.id === place.id 
                                ? 'ring-2 ring-blue-400 border-blue-400' 
                                : 'border-gray-200'
                            }`,
                            onClick: () => handlePlaceClick(place)
                          },
                            // JEDNOTNÁ HLAVIČKA PRE VŠETKY TYPY MIEST (vrátane ubytovania)
                            React.createElement('div', { className: 'p-4' },
                              React.createElement('div', { className: 'flex justify-between items-start' },
                                React.createElement('div', null,
                                  React.createElement('div', { className: 'flex items-center mb-2' },
                                    React.createElement('div', { 
                                      className: 'w-8 h-8 rounded-full flex items-center justify-center mr-3',
                                      style: { 
                                        backgroundColor: (typeIcons[place.type]?.color || '#6b7280') + '20',
                                        color: typeIcons[place.type]?.color || '#6b7280',
                                        border: `2px solid ${typeIcons[place.type]?.color || '#6b7280'}`
                                      }
                                    },
                                      React.createElement('i', { className: `fa-solid ${typeIcons[place.type]?.icon || 'fa-map-pin'} text-sm` })
                                    ),
                                    React.createElement('div', null,
                                      React.createElement('h4', { className: 'font-bold text-gray-800' }, place.name),
                                      React.createElement('span', { 
                                        className: 'text-xs px-2 py-1 rounded-full font-medium',
                                        style: { 
                                          backgroundColor: (typeIcons[place.type]?.color || '#6b7280') + '20',
                                          color: typeIcons[place.type]?.color || '#6b7280'
                                        }
                                      },
                                        place.type === 'ubytovanie' && place.accommodationType 
                                          ? `${typeLabels[place.type]} (${place.accommodationType})` 
                                          : typeLabels[place.type] || place.type
                                      )
                                    )
                                  )
                                )
                              )
                            ),
                            
                            // Obsah karty (kapacity, ceny, atď.)
                            React.createElement('div', { className: 'px-4 pb-4' },
                              React.createElement('div', { className: "text-sm text-gray-600 space-y-1" },
                                place.capacity && (place.type === 'ubytovanie' || place.type === 'stravovanie') &&
                                  React.createElement('div', null,
                                    React.createElement('span', { className: 'font-medium' }, place.type === 'ubytovanie' ? 'Lôžok: ' : 'Kapacita: '),
                                    place.capacity
                                  )
                              )
                            )
                          );
                        });
                    })()
                  )
              )
            )
          )
        )
    )
  );
};

let isEmailSyncListenerSetup = false;

const renderMap = (userProfileData) => {
    const root = document.getElementById('root');
    if (!root || typeof ReactDOM === 'undefined' || typeof React === 'undefined') return;
    
    console.log("Renderujem mapu, userProfileData:", userProfileData ? 'prihlásený' : 'neprihlásený');
    ReactDOM.createRoot(root).render(React.createElement(MapApp, { userProfileData: userProfileData || null }));
};

const handleDataUpdateAndRender = (event) => {
    const userProfileData = event.detail;
    renderMap(userProfileData);
};

window.addEventListener('globalDataUpdated', handleDataUpdateAndRender);

if (document.getElementById('root')) {
    const waitForLeaflet = () => {
        if (typeof L !== 'undefined') {
            renderMap(window.globalUserProfileData || null);
        } else {
            setTimeout(waitForLeaflet, 100);
        }
    };
    
    waitForLeaflet();
}
