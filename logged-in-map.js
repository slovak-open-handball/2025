// Importy pre Firebase funkcie
import { doc, getDoc, onSnapshot, updateDoc, addDoc, collection, Timestamp, deleteDoc, GeoPoint, setDoc }
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
    const [nameTypeError, setNameTypeError] = useState(null);
    const [accommodationTypes, setAccommodationTypes] = useState([]);
    const [selectedAccommodationType, setSelectedAccommodationType] = useState('');
    const [editAccommodationType, setEditAccommodationType] = useState('');
    const [capacityError, setCapacityError] = useState(null);
    const [allPlaces, setAllPlaces] = useState([]);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [placeToDelete, setPlaceToDelete] = useState(null);
// Memo pre editáciu (berie do úvahy aktuálnu kapacitu vybraného miesta)
    const accommodationAvailabilityEdit = useMemo(() => {
      if (!accommodationTypes.length || !selectedPlace) return {};
  
      const result = {};
      accommodationTypes.forEach((accType) => {
        const total = accType.capacity || 0;
        let occupied = places
          .filter(p => p.type === 'ubytovanie' && p.accommodationType === accType.type)
          .reduce((sum, p) => sum + (p.capacity || 0), 0);
  
        // Bezpečnostná kontrola – ak editujeme a máme starý typ
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
    // Samostatná funkcia – vytvorí sa iba raz
    const handleAddClick = useCallback((e) => {
        console.log("CLICK NA MAPE zachytený!", e.latlng);
        const pos = { lat: e.latlng.lat, lng: e.latlng.lng };
   
        setSelectedAddPosition(pos);
        setTempAddPosition(pos);
   
        // Zruš handlery
        leafletMap.current?.off('mousemove', moveHandlerRef.current);
        leafletMap.current?.off('click', addClickHandlerRef.current);
        moveHandlerRef.current = null;
        addClickHandlerRef.current = null;
   
        // Vyčisti starý marker (pre istotu)
        if (tempMarkerRef.current) {
            tempMarkerRef.current.remove();
            tempMarkerRef.current = null;
        }
   
        setNewPlaceName('');
        setNewPlaceType('');
        setNewCapacity('');
        setSelectedAccommodationType('');
        setNameTypeError(null);
        setCapacityError(null);
   
        setIsAddingPlace(false);
   
        window.lastAddedPosition = pos;
   
        // ─── Kľúčová zmena ───────────────────────────────────────────────
        // Najprv vytvoríme marker a dáme mu čas na vykreslenie
        if (leafletMap.current) {
            tempMarkerRef.current = L.marker([pos.lat, pos.lng], {
                icon: L.divIcon({
                    className: 'adding-marker',
                    html: `
                        <div style="
                            background: #ef4444;
                            width: 36px;
                            height: 36px;
                            border-radius: 50%;
                            border: 5px solid white;
                            box-shadow: 0 0 15px rgba(0,0,0,0.7);
                            z-index: 99999 !important;
                            position: relative;
                        "></div>
                    `,
                    iconSize: [36, 36],
                    iconAnchor: [18, 18]
                }),
                pane: 'markerPane',
                interactive: false,
                keyboard: false,
                riseOnHover: false
            }).addTo(leafletMap.current);

            console.log("Začínam čakať pred otvorením modálu...");
            let counter = 0;
            const intervalId = setInterval(() => {
               counter++;
                console.log(`ČAKÁM ${counter} (${(counter * 100)} ms)`);
            }, 100);
   
            // Dáme prehliadaču čas na reflow + vykreslenie (väčšinou stačí 50–120 ms)
            setTimeout(() => {
                if (leafletMap.current) {
                    leafletMap.current.invalidateSize(false);
                }
                // Až teraz otvoríme modálne okno
                setShowModal(true);
            }, 250); // ← tu je to oneskorenie, ktoré hľadáš (100 ms je dobrý kompromis)
        } else {
            // fallback – ak by mapa nebola pripravená (veľmi nepravdepodobné)
            setShowModal(true);
        }
    }, []);
    useEffect(() => {
        if (!showModal || !tempAddPosition || !leafletMap.current) return;
   
        // Vyčistenie (pre istotu, hoci by nemal byť)
        if (tempMarkerRef.current) {
            tempMarkerRef.current.remove();
            tempMarkerRef.current = null;
        }
   
        // Vytvor marker
        tempMarkerRef.current = L.marker([tempAddPosition.lat, tempAddPosition.lng], {
            icon: L.divIcon({
                className: 'adding-marker',
                html: `
                    <div style="
                        background: #ef4444;
                        width: 36px;
                        height: 36px;
                        border-radius: 50%;
                        border: 5px solid white;
                        box-shadow: 0 0 15px rgba(0,0,0,0.7);
                        z-index: 99999 !important;
                        position: relative;
                    "></div>
                `,
                iconSize: [36, 36],
                iconAnchor: [18, 18]
            }),
            pane: 'markerPane',
            interactive: false,
            keyboard: false,
            riseOnHover: false
        }).addTo(leafletMap.current);
   
        // Dôležité – daj prehliadaču čas na reflow + invalidate
        setTimeout(() => {
            if (leafletMap.current) {
                leafletMap.current.invalidateSize(false); // false = bez animácie
            }
            // Voliteľné: ak chceš popup hneď
            // tempMarkerRef.current?.openPopup();
        }, 80); // 50–150 ms funguje najlepšie v 90 % prípadov
   
        // Cleanup – keď sa modál zatvorí
        return () => {
            if (tempMarkerRef.current) {
                tempMarkerRef.current.remove();
                tempMarkerRef.current = null;
            }
        };
    }, [showModal, tempAddPosition]);
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
        addClickHandlerRef.current = handleAddClick; // ← toto!
        leafletMap.current.on('click', handleAddClick); // ← toto!
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
        // Odstránenie dočasného markera
        if (tempMarkerRef.current) {
            tempMarkerRef.current.remove();
            tempMarkerRef.current = null;
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
        if (!newPlaceName.trim() || !newPlaceType) return;
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
     
        const nameTrimmed = newPlaceName.trim();
     
        const alreadyExists = allPlaces.some(
            p => p.name.trim().toLowerCase() === nameTrimmed.toLowerCase()
              && p.type === newPlaceType
          );
          if (alreadyExists) {
            setNameTypeError(`Miesto s názvom "${nameTrimmed}" a typom "${typeLabels[newPlaceType] || newPlaceType}" už existuje.`);
            window.showGlobalNotification('Duplicitné miesto – nepridávam', 'error');
            return;
          }
          setNameTypeError(null);
        try {
            const placeData = {
                name: newPlaceName.trim(),
                type: newPlaceType,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                lat: position.lat,
                lng: position.lng,
            };
            if (newPlaceType === 'ubytovanie') {
                if (!selectedAccommodationType) {
                    window.showGlobalNotification('Vyberte typ ubytovania', 'error');
                    return;
                }
                placeData.accommodationType = selectedAccommodationType;
            }
            // kapacita...
            let cap = parseInt(newCapacity, 10);
            if (newPlaceType === 'ubytovanie' || newPlaceType === 'stravovanie') {
                if (isNaN(cap) || cap <= 0) {
                    window.showGlobalNotification('Kapacita musí byť kladné číslo', 'error');
                    return;
                }
            }
            if (newPlaceType === 'ubytovanie' && selectedAccommodationType) {
                const selectedTypeConfig = accommodationTypes.find(t => t.type === selectedAccommodationType);
                const total = selectedTypeConfig ? selectedTypeConfig.capacity || 0 : 0;
                const occupied = places
                    .filter(p => p.type === 'ubytovanie' && p.accommodationType === selectedAccommodationType)
                    .reduce((sum, p) => sum + (p.capacity || 0), 0);
                const free = total - occupied;
                if (cap > free) {
                    window.showGlobalNotification(`Prekročená dostupná kapacita pre typ "${selectedAccommodationType}" (max ${free})`, 'error');
                    return;
                }
            }
            if (!isNaN(cap) && cap > 0) {
                placeData.capacity = cap;
            }
            const newPlaceDoc = await addDoc(collection(window.db, 'places'), placeData);
            const addMessage = `Vytvorené nové miesto: '''${newPlaceName.trim()} (${typeLabels[newPlaceType] || newPlaceType})'` +
                (placeData.capacity != null ? `, kapacita: ${placeData.capacity}` : '') +
                (placeData.accommodationType ? `, typ ubytovania: ${placeData.accommodationType}` : '');
           
            await createPlaceChangeNotification('place_created', [addMessage], {
                id: newPlaceDoc.id,
                name: newPlaceName.trim(),
                type: newPlaceType,
            });
            window.showGlobalNotification('Miesto bolo pridané', 'success');
   
            // Vyčistenie
            setShowModal(false);
            setNewPlaceName('');
            setNewPlaceType('');
            setNewCapacity('');
            setSelectedAccommodationType('');
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
    useEffect(() => {
        if (newPlaceType !== 'ubytovanie' || !selectedAccommodationType || !newCapacity) {
            setCapacityError(null);
            return;
        }
  
        const cap = parseInt(newCapacity, 10);
        if (isNaN(cap) || cap <= 0) {
            setCapacityError('Kapacita musí byť kladné číslo');
            return;
        }
  
        const avail = accommodationAvailabilityAdd[selectedAccommodationType];
        if (!avail) {
            setCapacityError('Neviem zistiť dostupnú kapacitu');
            return;
        }
  
        if (cap > avail.free) {
            setCapacityError(`Maximálne môžete zadať ${avail.free} lôžok (voľných je ${avail.free}/${avail.total})`);
        } else {
            setCapacityError(null);
        }
    }, [newCapacity, selectedAccommodationType, newPlaceType, accommodationAvailabilityAdd]);
    useEffect(() => {
        if (!isEditingNameAndType) {
            setCapacityError(null);
            return;
        }
  
        if (editType !== 'ubytovanie' || !editAccommodationType || !editCapacity) {
            setCapacityError(null);
            return;
        }
  
        const cap = parseInt(editCapacity, 10);
        if (isNaN(cap) || cap <= 0) {
            setCapacityError('Kapacita musí byť kladné číslo');
            return;
        }
  
        const avail = accommodationAvailabilityEdit[editAccommodationType];
        if (!avail) {
            setCapacityError('Neviem zistiť dostupnú kapacitu');
            return;
        }
  
        if (cap > avail.free) {
            setCapacityError(`Maximálne môžete zadať ${avail.free} lôžok (voľných je ${avail.free}/${avail.total})`);
        } else {
            setCapacityError(null);
        }
    }, [editCapacity, editAccommodationType, editType, isEditingNameAndType, accommodationAvailabilityEdit]);
    useEffect(() => {
      if (!window.db) return;
  
      const unsubscribe = onSnapshot(
        doc(window.db, 'settings', 'accommodation'),
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            const typesArray = Array.isArray(data.types) ? data.types : [];
      
            // Očistenie a validácia
            const validTypes = typesArray
              .filter(item => item && typeof item === 'object' && typeof item.type === 'string')
              .map(item => ({
                type: item.type.trim(),
                capacity: Number(item.capacity) || 0
              }));
  
            setAccommodationTypes(validTypes);
          
          console.log("Načítané typy ubytovania:", validTypes);
          } else {
            console.warn("Dokument settings/accommodation neexistuje");
            setAccommodationTypes([]);
          }
          },
        (error) => {
          console.error("Chyba pri načítaní accommodation types:", error);
          setAccommodationTypes([]);
        }
      );
      return () => unsubscribe();
    }, []);
    useEffect(() => {
        if (!showModal && !isAddingPlace) {
            // len pre istotu – ak by niekto zavolal setShowModal(false) inak
            if (tempMarkerRef.current) {
                tempMarkerRef.current.remove();
                tempMarkerRef.current = null;
            }
            // ← NOVÉ: vyčistenie formulára pre pridávanie
            setNewPlaceName('');
            setNewPlaceType('');
            setNewCapacity('');
            setSelectedAccommodationType('');
            setNameTypeError(null);
            setCapacityError(null);
        }
    }, [showModal, isAddingPlace]);
    useEffect(() => {
        if (!newPlaceName.trim() || !newPlaceType || !showModal) {
            setNameTypeError(null);
            return;
        }
        const nameTrimmed = newPlaceName.trim();
        const duplicate = allPlaces.some(
            p => p.name.trim().toLowerCase() === nameTrimmed.toLowerCase()
              && p.type === newPlaceType
        );
   
        if (duplicate) {
            setNameTypeError(`Miesto s názvom "${nameTrimmed}" a typom "${typeLabels[newPlaceType] || newPlaceType}" už existuje.`);
        } else {
            setNameTypeError(null);
        }
    }, [newPlaceName, newPlaceType, showModal, allPlaces, typeLabels]);
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
    }, []); // ← spustiť iba raz pri mount-e komponentu
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
        if (editType === 'ubytovanie' && !editAccommodationType) {
            window.showGlobalNotification('Vyberte typ ubytovania', 'error');
            return;
        }
   
        try {
            const updates = {
                name: editName.trim(),
                type: editType,
                updatedAt: Timestamp.now(),
            };
   
            if (editType === 'ubytovanie') {
                updates.accommodationType = editAccommodationType || null;
            } else {
                updates.accommodationType = null;
            }
   
            let cap = parseInt(editCapacity, 10);
            if (editType === 'ubytovanie' || editType === 'stravovanie') {
                if (isNaN(cap) || cap <= 0) {
                    window.showGlobalNotification('Kapacita musí byť kladné číslo', 'error');
                    return;
                }
            }
            if (editType === 'ubytovanie' && editAccommodationType) {
                const selectedTypeConfig = accommodationTypes.find(t => t.type === editAccommodationType);
                const total = selectedTypeConfig ? selectedTypeConfig.capacity || 0 : 0;
                let occupied = places
                    .filter(p => p.type === 'ubytovanie' && p.accommodationType === editAccommodationType)
                    .reduce((sum, p) => sum + (p.capacity || 0), 0);
                const oldType = selectedPlace.type;
                const oldAccType = selectedPlace.accommodationType;
                const oldCap = selectedPlace.capacity || 0;
                if (oldType === 'ubytovanie' && oldAccType === editAccommodationType) {
                    occupied -= oldCap;
                }
                const free = total - occupied;
                if (cap > free) {
                    window.showGlobalNotification(`Prekročená dostupná kapacita pre typ "${editAccommodationType}" (max ${free})`, 'error');
                    return;
                }
            }
            if (!isNaN(cap) && cap > 0) {
                updates.capacity = cap;
            } else {
                updates.capacity = null;
            }
   
            const placeRef = doc(window.db, 'places', selectedPlace.id);
            const original = {
                name: selectedPlace.name || '',
                type: selectedPlace.type || '',
                capacity: selectedPlace.capacity != null ? selectedPlace.capacity : null,
                accommodationType: selectedPlace.accommodationType || null,
            };
   
            await updateDoc(placeRef, updates);
   
            // ─── TU ZAČÍNA ZBER ZMIEN ───────────────────────────────
            const changesList = [];
            changesList.push(`Úprava miesta s názvom: '''${original.name || '(bez názvu)'}'`);
   
            if (original.name.trim() !== updates.name.trim()) {
                changesList.push(
                    `Zmena názvu miesta z '${original.name}' na '${updates.name}'`
                );
            }
   
            if (original.type !== updates.type) {
                changesList.push(
                    `Zmena typu miesta z '${typeLabels[original.type] || original.type}' na '${typeLabels[updates.type] || updates.type}'`
                );
            }
   
            if (original.capacity !== updates.capacity) {
                const oldCapStr = original.capacity != null ? original.capacity : '–';
                const newCapStr = updates.capacity != null ? updates.capacity : '–';
                changesList.push(
                    `Zmena kapacity z '${oldCapStr}' na '${newCapStr}'`
                );
            }
   
            if (original.accommodationType !== updates.accommodationType) {
                const oldAcc = original.accommodationType || '-';
                const newAcc = updates.accommodationType || '-';
                changesList.push(
                    `Zmena typu ubytovania z '${oldAcc}' na '${newAcc}'`
                );
            }
            // ──────────────────────────────────────────────────────────
   
            // Ak sa niečo zmenilo → uložíme jedno upozornenie s viacerými riadkami
            if (changesList.length > 1) {
                await createPlaceChangeNotification('place_field_updated', changesList, {
                    id: selectedPlace.id,
                    name: updates.name,
                    type: updates.type,
                });
            }
   
            // Aktualizácia lokálneho stavu
            setSelectedPlace(prev => ({
                ...prev,
                name: updates.name,
                type: updates.type,
                capacity: updates.capacity,
                accommodationType: updates.accommodationType || undefined,
            }));
   
            setPlaces(prevPlaces =>
                prevPlaces.map(p =>
                    p.id === selectedPlace.id
                        ? { ...p, name: updates.name, type: updates.type, capacity: updates.capacity, accommodationType: updates.accommodationType || undefined }
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
   
            const originalLocation = {
                lat: selectedPlace.lat,
                lng: selectedPlace.lng,
            };
   
            const newLocation = {
                lat: tempLocation.lat,
                lng: tempLocation.lng,
            };
   
            await updateDoc(placeRef, {
                location: new GeoPoint(tempLocation.lat, tempLocation.lng),
                lat: tempLocation.lat, // ak ukladáte aj samostatne
                lng: tempLocation.lng,
                updatedAt: Timestamp.now(),
            });
   
            // Notifikácia iba ak sa súradnice zmenili
            if (originalLocation.lat !== newLocation.lat || originalLocation.lng !== newLocation.lng) {
                const changesList = [];
                // prvý riadok – úprava miesta s pôvodným názvom
                changesList.push(`Úprava miesta s názvom: '''${selectedPlace.name || '(bez názvu)'}'`);
                // druhý riadok – zmena polohy
                changesList.push(`Zmena polohy z '[${originalLocation.lat?.toFixed(6)}, ${originalLocation.lng?.toFixed(6)}]' na '[${newLocation.lat?.toFixed(6)}, ${newLocation.lng?.toFixed(6)}]'`);
           
                await createPlaceChangeNotification('place_field_updated', changesList, {
                    id: selectedPlace.id,
                    name: selectedPlace.name,
                    type: selectedPlace.type,
                });
            }
   
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
    const confirmDeletePlace = async () => {
        if (!placeToDelete || !window.db) return;
        try {
            const place = { ...placeToDelete };
   
            await deleteDoc(doc(window.db, 'places', place.id));
   
            // Notifikácia – konzistentne ako ostatné
            const deleteMessage = `Odstránené miesto: '''${place.name} (${typeLabels[place.type] || place.type})'` +
                (place.capacity != null ? `, kapacita: ${place.capacity}` : '') +
                (place.accommodationType ? `, typ ubytovania: ${place.accommodationType}` : '');
            await createPlaceChangeNotification('place_deleted', [deleteMessage], {
                id: place.id,
                name: place.name,
                type: place.type,
            });
            window.showGlobalNotification('Miesto bolo odstránené', 'success');
            closeDetail();
        } catch (err) {
            console.error("Chyba pri odstraňovaní:", err);
            window.showGlobalNotification('Nepodarilo sa odstrániť miesto', 'error');
        }
        // Zatvoríme modálne okno
        setShowDeleteConfirm(false);
        setPlaceToDelete(null);
    };
 
    const handleDeletePlace = () => {
        if (!selectedPlace) return;
       
        // Uložíme miesto, ktoré chceme vymazať a otvoríme potvrdenie
        setPlaceToDelete(selectedPlace);
        setShowDeleteConfirm(true);
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
                    duration: 1.0, // jemnejšie
                    easeLinearity: 0.25
                });
                console.log(`Zoom na miesto ${selectedPlace.name} → [${lat.toFixed(6)}, ${lng.toFixed(6)}] zoom 18`);
            }
        }, 300); // 300–600 ms zvyčajne stačí
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
            });
          });
          // Uložíme VŠETKY miesta do allPlaces
          setAllPlaces(loadedPlaces);
          // A filtrovaný zoznam do places (pre mapu)
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
                // L.DomEvent.stopPropagation(e); ← toto NEpoužívaj, inak map.click nikdy nefunguje
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
        if (placesLayerRef.current) placesLayerRef.current.clearLayers();
      };
    }, [activeFilter]);
    const addFreeCapacity = useMemo(() => {
      if (newPlaceType !== 'ubytovanie' || !selectedAccommodationType) return null;
      const selectedTypeConfig = accommodationTypes.find(t => t.type === selectedAccommodationType);
      if (!selectedTypeConfig) return 0;
      const total = selectedTypeConfig.capacity || 0;
      const occupied = places
        .filter(p => p.type === 'ubytovanie' && p.accommodationType === selectedAccommodationType)
        .reduce((sum, p) => sum + (p.capacity || 0), 0);
      return total - occupied;
    }, [newPlaceType, selectedAccommodationType, accommodationTypes, places]);
  
    const editFreeCapacity = useMemo(() => {
      if (editType !== 'ubytovanie' || !editAccommodationType) return null;
      const selectedTypeConfig = accommodationTypes.find(t => t.type === editAccommodationType);
      if (!selectedTypeConfig) return 0;
      const total = selectedTypeConfig.capacity || 0;
      let occupied = places
        .filter(p => p.type === 'ubytovanie' && p.accommodationType === editAccommodationType)
        .reduce((sum, p) => sum + (p.capacity || 0), 0);
      const oldType = selectedPlace?.type;
      const oldAccType = selectedPlace?.accommodationType;
      const oldCap = selectedPlace?.capacity || 0;
      if (oldType === 'ubytovanie' && oldAccType === editAccommodationType) {
        occupied -= oldCap;
      }
      return total - occupied;
    }, [editType, editAccommodationType, accommodationTypes, places, selectedPlace]);
    // ──────────────────────────────────────────────
    // RENDER
    // ──────────────────────────────────────────────
    return React.createElement('div', { className: 'flex-grow flex justify-center items-center p-2 sm:p-4 relative' },
      React.createElement('div', { className: 'w-full max-w-[1920px] mx-auto bg-white rounded-xl shadow-2xl p-4 sm:p-6 lg:p-10' },
        React.createElement('div', { className: 'flex flex-col items-center justify-center mb-5 md:mb-7 p-4 -mx-3 sm:-mx-6 -mt-3 sm:-mt-6 md:-mt-8 rounded-t-xl bg-white text-black' },
          React.createElement('h2', { className: 'text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-center mb-6' }, 'Mapa'),
          // FILTRY
          React.createElement('div', { className: 'flex flex-wrap justify-center gap-3 sm:gap-4' },
            React.createElement('button', {
              onClick: () => { setActiveFilter(activeFilter === 'sportova_hala' ? null : 'sportova_hala'); setSelectedPlace(null); setPlaceHash(null); },
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
              onClick: () => { setActiveFilter(activeFilter === 'ubytovanie' ? null : 'ubytovanie'); setSelectedPlace(null); setPlaceHash(null); },
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
              onClick: () => { setActiveFilter(activeFilter === 'stravovanie' ? null : 'stravovanie'); setSelectedPlace(null); setPlaceHash(null); },
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
              onClick: () => { setActiveFilter(activeFilter === 'zastavka' ? null : 'zastavka'); setSelectedPlace(null); setPlaceHash(null); },
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
          // Mapa
          React.createElement('div', {
            id: 'map',
            ref: mapRef,
            className: 'w-full rounded-xl shadow-inner border border-gray-200 h-[68vh] md:h-[68vh] min-h-[450px]'
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
                typeLabels[selectedPlace.type] || selectedPlace.type || '(nevyplnený)'
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
              )
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
              ),
              React.createElement('button', {
                onClick: () => {
                  setIsEditingNameAndType(true);
                  setEditName(selectedPlace.name || '');
                  setEditType(selectedPlace.type || '');
                  setEditCapacity(selectedPlace.capacity != null ? String(selectedPlace.capacity) : '');
                  setEditAccommodationType(selectedPlace.accommodationType || '');
                },
                className: 'w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition'
              },
                (selectedPlace?.type === 'ubytovanie' || selectedPlace?.type === 'stravovanie')
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
  
          // ──────────────────────────────────────────────
          // Edit modál (názov, typ, kapacita, typ ubytovania)
          // ──────────────────────────────────────────────
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
              // Typ ubytovania + obsadenosť
              editType === 'ubytovanie' && React.createElement('div', { className: 'mb-5' },
                React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1.5' }, 'Typ ubytovania'),
                React.createElement('select', {
                  value: editAccommodationType,
                  onChange: e => setEditAccommodationType(e.target.value),
                  className: 'w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition bg-white'
                },
                  React.createElement('option', { value: '' }, 'Vyberte typ ubytovania'),
                  accommodationTypes.map((item, i) => {
                    const avail = accommodationAvailabilityEdit[item.type] || { isFull: false, free: 0 };
                    const isDisabled = avail.isFull && item.type !== selectedPlace?.accommodationType;
                    return React.createElement('option', {
                      key: i,
                      value: item.type,
                      disabled: isDisabled,
                      className: isDisabled ? 'text-gray-400 cursor-not-allowed' : ''
                    },
                      `${item.type} (${item.capacity} lôžok celkom)${isDisabled ? ' (naplnená kapacita)' : ''}`
                    );
                  })
                ),
                editAccommodationType && accommodationAvailabilityEdit[editAccommodationType] && (() => {
                  const avail = accommodationAvailabilityEdit[editAccommodationType];
                  const capNum = parseInt(editCapacity, 10) || 0;
                  const occupiedWithoutThis = avail.total - avail.free;
                  const predictedOccupied = occupiedWithoutThis + capNum;
                  const predictedFree = avail.total - predictedOccupied;
                  const isFull = predictedFree <= 0;
                  return React.createElement('div', { className: 'mt-3 text-sm flex items-center gap-2' },
                    React.createElement('span', { className: 'font-medium text-gray-700' }, 'Obsadenosť:'),
                    React.createElement('span', {
                      className: isFull
                        ? 'text-red-600 font-semibold'
                        : 'text-gray-700'
                    },
                      `${predictedOccupied} / ${avail.total} lôžok`
                    ),
                    React.createElement('span', { className: 'text-gray-500' },
                      `(voľných: ${predictedFree})`
                    )
                  );
                })()
              ),
              // Kapacita + chyba
              (editType === 'ubytovanie' || editType === 'stravovanie') && React.createElement('div', { className: 'mb-6' },
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
                }),
                capacityError && React.createElement('p', { className: 'mt-2 text-sm text-red-600' }, capacityError)
              ),
              // Tlačidlá
              React.createElement('div', { className: 'flex justify-end gap-3 mt-6' },
                React.createElement('button', {
                  onClick: () => setIsEditingNameAndType(false),
                  className: 'px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition'
                }, 'Zrušiť'),
                React.createElement('button', {
                  onClick: handleSaveNameAndType,
                  disabled: !editName.trim() ||
                           !editType ||
                           !!capacityError ||
                           (editType === 'ubytovanie' && !editAccommodationType),
                  className: 'px-6 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition font-medium'
                }, 'Uložiť zmeny')
              )
            )
          ),
  
          // ──────────────────────────────────────────────
          // Pridať nové miesto modál
          // ──────────────────────────────────────────────
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
              // Typ ubytovania + obsadenosť
              newPlaceType === 'ubytovanie' && React.createElement('div', { className: 'mb-5' },
                React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1.5' }, 'Typ ubytovania'),
                React.createElement('select', {
                  value: selectedAccommodationType,
                  onChange: e => setSelectedAccommodationType(e.target.value),
                  className: 'w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition bg-white'
                },
                  React.createElement('option', { value: '' }, 'Vyberte typ ubytovania'),
                  accommodationTypes.map(item =>
                    React.createElement('option', { key: item.type, value: item.type },
                      `${item.type} (${item.capacity} lôžok celkom)`
                    )
                  )
                ),
                selectedAccommodationType && accommodationAvailabilityAdd[selectedAccommodationType] && React.createElement('div', { className: 'mt-3 text-sm flex items-center gap-2' },
                  React.createElement('span', { className: 'font-medium text-gray-700' }, 'Obsadenosť:'),
                  React.createElement('span', {
                    className: accommodationAvailabilityAdd[selectedAccommodationType].isFull
                      ? 'text-red-600 font-semibold'
                      : 'text-gray-700'
                  },
                    `${accommodationAvailabilityAdd[selectedAccommodationType].total - accommodationAvailabilityAdd[selectedAccommodationType].free} / ${accommodationAvailabilityAdd[selectedAccommodationType].total} lôžok`
                  ),
                  React.createElement('span', { className: 'text-gray-500' },
                    `(voľných: ${accommodationAvailabilityAdd[selectedAccommodationType].free})`
                  )
                )
              ),
              nameTypeError && React.createElement(
                'div',
                { className: 'mt-3 p-3 bg-red-50 border border-red-300 text-red-700 rounded-lg text-sm' },
                nameTypeError
              ),
              // Kapacita
              (newPlaceType === 'ubytovanie' || newPlaceType === 'stravovanie') && React.createElement('div', { className: 'mb-6' },
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
                }),
                capacityError && React.createElement('p', { className: 'mt-2 text-sm text-red-600' }, capacityError)
              ),
              // Tlačidlá
              React.createElement('div', { className: 'flex justify-end gap-3 mt-6' },
                React.createElement('button', {
                  onClick: () => setShowModal(false),
                  className: 'px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition'
                }, 'Zrušiť'),
                React.createElement('button', {
                  onClick: handleAddPlace,
                  disabled:
                    !newPlaceName.trim() ||
                    !newPlaceType ||
                    !!nameTypeError ||
                    !!capacityError ||
                    (newPlaceType === 'ubytovanie' && !selectedAccommodationType),
                  className: `
                    px-6 py-2.5 rounded-lg font-medium transition duration-150 border-2
                    ${(!newPlaceName.trim() || !newPlaceType || !!nameTypeError || !!capacityError || (newPlaceType === 'ubytovanie' && !selectedAccommodationType))
                      ? 'bg-white text-blue-600 border-blue-600 cursor-not-allowed'
                      : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 hover:border-blue-700 active:bg-blue-800 active:border-blue-800'
                    }`
                }, 'Pridať miesto')
              )
            )
          ),
          showDeleteConfirm && React.createElement(
            'div',
            { className: 'fixed inset-0 z-[2200] flex items-center justify-center bg-black/60 backdrop-blur-sm' },
            React.createElement(
              'div',
              { className: 'bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8 transform transition-all duration-300 scale-100 relative' },
              React.createElement('h3', { className: 'text-2xl font-bold mb-6 text-gray-800 text-center' }, 'Odstrániť miesto'),
              React.createElement('p', { className: 'text-gray-700 mb-8 text-center' },
                'Naozaj chcete natrvalo odstrániť miesto',
                React.createElement('br', null),
                React.createElement('strong', { className: 'text-gray-900 text-xl' }, `"${placeToDelete?.name || 'bez názvu'}"`),
                ' ?'
              ),
              React.createElement('div', { className: 'flex justify-end gap-4' },
                React.createElement('button', {
                  onClick: () => {
                    setShowDeleteConfirm(false);
                    setPlaceToDelete(null);
                  },
                  className: 'px-6 py-3 bg-gray-200 text-gray-800 rounded-xl hover:bg-gray-300 transition font-medium'
                }, 'Zrušiť'),
                React.createElement('button', {
                  onClick: confirmDeletePlace,
                  className: 'px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 active:bg-red-800 transition font-medium shadow-md'
                }, 'Odstrániť')
              )
            )
          ),
  
          // Plávajúce tlačidlo + / ×
          React.createElement('button', {
            onClick: isAddingPlace ? cancelAddingPlace : startAddingPlace,
            className: `fixed bottom-6 right-6 z-[1000] w-14 h-14 rounded-full text-white text-3xl font-bold shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center focus:outline-none focus:ring-4 ${
              isAddingPlace
                ? 'bg-red-600 hover:bg-red-700 focus:ring-red-300 scale-110'
                : 'bg-green-600 hover:bg-green-700 focus:ring-green-300'
            }`
          },
            React.createElement('i', { className: isAddingPlace ? 'fa-solid fa-xmark' : 'fa-solid fa-plus' })
          )
        )
      )
    );
  }
const createPlaceChangeNotification = async (actionType, changesArray, placeData) => {
    if (!window.db || !changesArray?.length) return;
    const currentUserEmail = window.globalUserProfileData?.email || null;
    try {
        await addDoc(collection(window.db, 'notifications'), {
            userEmail: currentUserEmail || "",
            performedBy: currentUserEmail || null,
            changes: changesArray,
            timestamp: Timestamp.now(),
            actionType: actionType,
            relatedPlaceId: placeData.id || null,
            relatedPlaceName: placeData.name || null,
            relatedPlaceType: placeData.type || null,
        });
        console.log("[NOTIFIKÁCIA – viaceré zmeny]", changesArray);
    } catch (err) {
        console.error("[CHYBA pri ukladaní notifikácie]", err);
    }
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
