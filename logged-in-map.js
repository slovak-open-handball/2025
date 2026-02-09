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
    const [isModalOpening, setIsModalOpening] = useState(false);
    const [newPlaceNote, setNewPlaceNote] = useState('');
    const [editNote, setEditNote] = useState('');
    // Premenné pre cenu ubytovania
    const [newPricePerNight, setNewPricePerNight] = useState('');
    const [editPricePerNight, setEditPricePerNight] = useState('');
    const [priceError, setPriceError] = useState(null);
    
    // NOVÉ: Premenné pre ceny stravovania
    const [newBreakfastPrice, setNewBreakfastPrice] = useState('');
    const [newLunchPrice, setNewLunchPrice] = useState('');
    const [newDinnerPrice, setNewDinnerPrice] = useState('');
    const [editBreakfastPrice, setEditBreakfastPrice] = useState('');
    const [editLunchPrice, setEditLunchPrice] = useState('');
    const [editDinnerPrice, setEditDinnerPrice] = useState('');
    const [mealPriceError, setMealPriceError] = useState(null);

    const formatPrice = (price) => {
        if (price == null) return '';
        return price.toFixed(2).replace('.', ',');
    };

    const waitForMarkerRender = () => {
      return new Promise((resolve) => {
        const check = () => {
          if (tempMarkerRef.current && mapRef.current && leafletMap.current) {
            requestAnimationFrame(() => {
              resolve();
            });
          } else {
            setTimeout(check, 50);
          }
        };
        check();
      });
    };
  
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
    
    // Samostatná funkcia – vytvorí sa iba raz
    const handleAddClick = useCallback(async (e) => {
      console.log("CLICK NA MAPE zachytený!", e.latlng);
      const pos = { lat: e.latlng.lat, lng: e.latlng.lng };
    
      setSelectedAddPosition(pos);
      setTempAddPosition(pos);
    
      leafletMap.current?.off('mousemove', moveHandlerRef.current);
      leafletMap.current?.off('click', addClickHandlerRef.current);
      moveHandlerRef.current = null;
      addClickHandlerRef.current = null;
    
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
      setNewPricePerNight('');
      setPriceError(null);
      // NOVÉ: Vynulovať ceny stravovania
      setNewBreakfastPrice('');
      setNewLunchPrice('');
      setNewDinnerPrice('');
      setMealPriceError(null);
    
      setIsAddingPlace(false);
      window.lastAddedPosition = pos;
    
      // Vytvor marker
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
    
        await waitForMarkerRender();
    
        requestAnimationFrame(() => {
          if (leafletMap.current) {
            leafletMap.current.invalidateSize(false);
          }
          setShowModal(true);
        });
      } else {
        setShowModal(true);
      }
    }, []);
    
    useEffect(() => {
      if (!showModal || !tempAddPosition || !leafletMap.current) return;

      if (tempMarkerRef.current) {
        tempMarkerRef.current.remove();
        tempMarkerRef.current = null;
      }
    
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
    
      setIsModalOpening(true);
    
      const timeoutId = setTimeout(() => {
        if (leafletMap.current) {
          leafletMap.current.invalidateSize(false);
        }
        setTimeout(() => {
          setIsModalOpening(false);
          setShowModal(true);
        }, 500);
      }, 500);
    
      return () => {
        clearTimeout(timeoutId);
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
        
        if (moveHandlerRef.current) {
            leafletMap.current?.off('mousemove', moveHandlerRef.current);
            moveHandlerRef.current = null;
        }
        
        const onMouseMove = (e) => {
            setTempAddPosition({ lat: e.latlng.lat, lng: e.latlng.lng });
        };
        leafletMap.current.on('mousemove', onMouseMove);
        moveHandlerRef.current = onMouseMove;
        
        if (addClickHandlerRef.current) {
            leafletMap.current.off('click', addClickHandlerRef.current);
        }
        addClickHandlerRef.current = handleAddClick;
        leafletMap.current.on('click', handleAddClick);
        console.log("→ pridávací click handler (handleAddClick) pridaný");
    };
    
    const cancelAddingPlace = () => {
        console.log("Ruším režim pridávania");
        setIsAddingPlace(false);
        setTempAddPosition(null);
        setShowModal(false);
        setSelectedAddPosition(null);
        window.lastAddedPosition = null;
        
        if (moveHandlerRef.current) {
            leafletMap.current?.off('mousemove', moveHandlerRef.current);
            moveHandlerRef.current = null;
        }
        
        if (leafletMap.current && addClickHandlerRef.current) {
            leafletMap.current.off('click', addClickHandlerRef.current);
            addClickHandlerRef.current = null;
            console.log("→ pridávací click handler odstránený");
        }
        
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
        
        let position = selectedAddPosition;
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
            setNameTypeError(
                React.createElement('span', null,
                    "Miesto s názvom ",
                    React.createElement('strong', { className: "font-bold text-red-900" }, nameTrimmed),
                    " a typom ",
                    React.createElement('strong', { className: "font-bold text-red-900" },
                        typeLabels[newPlaceType] || newPlaceType
                    ),
                    " už existuje."
                )
            );
            window.showGlobalNotification("Duplicitné miesto – nepridávam", "error");
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
            
            // Ubytovanie - cena za noc
            if (newPlaceType === 'ubytovanie') {
                if (!selectedAccommodationType) {
                    window.showGlobalNotification('Vyberte typ ubytovania', 'error');
                    return;
                }
                placeData.accommodationType = selectedAccommodationType;
                
                const price = parseFloat(newPricePerNight);
                if (isNaN(price) || price <= 0) {
                    setPriceError('Cena musí byť kladné číslo');
                    return;
                }
                placeData.pricePerNight = price;
            }
            
            // Stravovanie - ceny za jedlá
            if (newPlaceType === 'stravovanie') {
                // Validácia cien pre stravovanie
                const breakfastPrice = newBreakfastPrice ? parseFloat(newBreakfastPrice) : null;
                const lunchPrice = newLunchPrice ? parseFloat(newLunchPrice) : null;
                const dinnerPrice = newDinnerPrice ? parseFloat(newDinnerPrice) : null;
                
                if (breakfastPrice !== null && (isNaN(breakfastPrice) || breakfastPrice < 0)) {
                    setMealPriceError('Cena za raňajky musí byť kladné číslo');
                    return;
                }
                if (lunchPrice !== null && (isNaN(lunchPrice) || lunchPrice < 0)) {
                    setMealPriceError('Cena za obed musí byť kladné číslo');
                    return;
                }
                if (dinnerPrice !== null && (isNaN(dinnerPrice) || dinnerPrice < 0)) {
                    setMealPriceError('Cena za večeru musí byť kladné číslo');
                    return;
                }
                
                // Uloženie cien do placeData
                if (breakfastPrice !== null) placeData.breakfastPrice = breakfastPrice;
                if (lunchPrice !== null) placeData.lunchPrice = lunchPrice;
                if (dinnerPrice !== null) placeData.dinnerPrice = dinnerPrice;
            }
            
            // Kapacita...
            let cap = parseInt(newCapacity, 10);
            if (newPlaceType === 'ubytovanie' || newPlaceType === 'stravovanie') {
                if (isNaN(cap) || cap <= 0) {
                    window.showGlobalNotification('Kapacita musí byť kladné číslo', 'error');
                    return;
                }
                placeData.capacity = cap;
            }
            
            if (newPlaceType === 'ubytovanie' && selectedAccommodationType) {
                const selectedTypeConfig = accommodationTypes.find(t => t.type === selectedAccommodationType);
                const total = selectedTypeConfig ? selectedTypeConfig.capacity || 0 : 0;
                const occupied = places
                    .filter(p => p.type === 'ubytovanie' && p.accommodationType === selectedAccommodationType)
                    .reduce((sum, p) => sum + (p.capacity || 0), 0);
                const free = total - occupied;
                if (cap > free) {
                    window.showGlobalNotification(`Prekročená dostupná kapacita pre typ ${selectedAccommodationType} (max ${free})`, 'error');
                    return;
                }
            }
            
            if (!isNaN(cap) && cap > 0) {
                placeData.capacity = cap;
            }
            
            // Poznámka
            if (newPlaceNote.trim()) {
                placeData.note = newPlaceNote.trim();
            }
            
            const newPlaceDoc = await addDoc(collection(window.db, 'places'), placeData);
            
            // Zostavenie správy pre notifikáciu
            let addMessage = `Vytvorené nové miesto: '''${newPlaceName.trim()} (${typeLabels[newPlaceType] || newPlaceType})'`;
            
            if (placeData.capacity != null) {
                addMessage += `, kapacita: ${placeData.capacity}`;
            }
            
            if (placeData.accommodationType) {
                addMessage += `, typ ubytovania: ${placeData.accommodationType}`;
            }
            
            if (placeData.pricePerNight != null) {
                addMessage += `, cena: ${formatPrice(placeData.pricePerNight)} €/os/noc`;
            }
            
            // NOVÉ: Pridanie cien stravovania do notifikácie
            if (newPlaceType === 'stravovanie') {
                const mealPrices = [];
                if (placeData.breakfastPrice != null) mealPrices.push(`raňajky: ${formatPrice(placeData.breakfastPrice)}€`);
                if (placeData.lunchPrice != null) mealPrices.push(`obed: ${formatPrice(placeData.lunchPrice)}€`);
                if (placeData.dinnerPrice != null) mealPrices.push(`večera: ${formatPrice(placeData.dinnerPrice)}€`);
                
                if (mealPrices.length > 0) {
                    addMessage += `, ceny: ${mealPrices.join(', ')}`;
                }
            }
            
            if (placeData.note) {
                addMessage += `, poznámka: ${placeData.note}`;
            }
            
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
            setNewPricePerNight('');
            // NOVÉ: Vynulovať ceny stravovania
            setNewBreakfastPrice('');
            setNewLunchPrice('');
            setNewDinnerPrice('');
            setNewPlaceNote('');
            
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
    
    // Validácia ceny pre ubytovanie (pridávanie)
    useEffect(() => {
        if (newPlaceType !== 'ubytovanie' || !newPricePerNight) {
            setPriceError(null);
            return;
        }
 
        const price = parseFloat(newPricePerNight);
        if (isNaN(price) || price <= 0) {
            setPriceError('Cena musí byť kladné číslo');
        } else {
            setPriceError(null);
        }
    }, [newPricePerNight, newPlaceType]);
    
    // Validácia ceny pre ubytovanie (editácia)
    useEffect(() => {
        if (!isEditingNameAndType || editType !== 'ubytovanie' || !editPricePerNight) {
            setPriceError(null);
            return;
        }
 
        const price = parseFloat(editPricePerNight);
        if (isNaN(price) || price <= 0) {
            setPriceError('Cena musí byť kladné číslo');
        } else {
            setPriceError(null);
        }
    }, [editPricePerNight, editType, isEditingNameAndType]);
    
    // NOVÉ: Validácia cien pre stravovanie (pridávanie)
    useEffect(() => {
        if (newPlaceType !== 'stravovanie') {
            setMealPriceError(null);
            return;
        }
 
        const breakfastPrice = newBreakfastPrice ? parseFloat(newBreakfastPrice) : null;
        const lunchPrice = newLunchPrice ? parseFloat(newLunchPrice) : null;
        const dinnerPrice = newDinnerPrice ? parseFloat(newDinnerPrice) : null;
        
        let error = null;
        
        if (breakfastPrice !== null && (isNaN(breakfastPrice) || breakfastPrice < 0)) {
            error = 'Cena za raňajky musí byť kladné číslo';
        } else if (lunchPrice !== null && (isNaN(lunchPrice) || lunchPrice < 0)) {
            error = 'Cena za obed musí byť kladné číslo';
        } else if (dinnerPrice !== null && (isNaN(dinnerPrice) || dinnerPrice < 0)) {
            error = 'Cena za večeru musí byť kladné číslo';
        }
        
        setMealPriceError(error);
    }, [newBreakfastPrice, newLunchPrice, newDinnerPrice, newPlaceType]);
    
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
            setNewPlaceNote('');
            setNewPricePerNight('');
            setPriceError(null);
            // NOVÉ: Vynulovať ceny stravovania
            setNewBreakfastPrice('');
            setNewLunchPrice('');
            setNewDinnerPrice('');
            setMealPriceError(null);
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
            setNameTypeError(
                React.createElement('span', null,
                    "Miesto s názvom ",
                    React.createElement('strong', { className: "font-bold text-red-900" }, nameTrimmed),
                    " a typom ",
                    React.createElement('strong', { className: "font-bold text-red-900" },
                        typeLabels[newPlaceType] || newPlaceType
                    ),
                    " už existuje."
                )
            );
        } else {
            setNameTypeError(null);
        }
    }, [newPlaceName, newPlaceType, showModal, allPlaces]);
    
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
        // NOVÉ: Vynulovať ceny stravovania
        setEditBreakfastPrice('');
        setEditLunchPrice('');
        setEditDinnerPrice('');
        setMealPriceError(null);
        
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
        
        // Validácia ceny pre ubytovanie
        if (editType === 'ubytovanie') {
            const price = parseFloat(editPricePerNight);
            if (isNaN(price) || price <= 0) {
                setPriceError('Cena musí byť kladné číslo');
                return;
            }
        }
        
        // Validácia cien pre stravovanie
        if (editType === 'stravovanie') {
            const breakfastPrice = editBreakfastPrice ? parseFloat(editBreakfastPrice) : null;
            const lunchPrice = editLunchPrice ? parseFloat(editLunchPrice) : null;
            const dinnerPrice = editDinnerPrice ? parseFloat(editDinnerPrice) : null;
            
            if (breakfastPrice !== null && (isNaN(breakfastPrice) || breakfastPrice < 0)) {
                setMealPriceError('Cena za raňajky musí byť kladné číslo');
                return;
            }
            if (lunchPrice !== null && (isNaN(lunchPrice) || lunchPrice < 0)) {
                setMealPriceError('Cena za obed musí byť kladné číslo');
                return;
            }
            if (dinnerPrice !== null && (isNaN(dinnerPrice) || dinnerPrice < 0)) {
                setMealPriceError('Cena za večeru musí byť kladné číslo');
                return;
            }
        }
    
        try {
            const oldName = selectedPlace.name;
            const newName = editName.trim();
            let totalTransferredTeams = 0;
            
            // Ak sa mení názov ubytovne, aktualizuj všetky priradené tímy
            if (oldName !== newName && editType === 'ubytovanie') {
                const allUsers = await getDocs(collection(window.db, 'users'));
                const userUpdates = [];
                
                for (const userDoc of allUsers.docs) {
                    const userData = userDoc.data();
                    const teams = userData.teams || {};
                    let userTransferredCount = 0;
                    let needsUpdate = false;
                    const updatedTeams = { ...teams };
                    
                    for (const category in teams) {
                        const teamArray = teams[category];
                        if (!Array.isArray(teamArray)) continue;
                        
                        const updatedTeamArray = teamArray.map(team => {
                            if (team.accommodation?.name === oldName) {
                                needsUpdate = true;
                                userTransferredCount++;
                                return {
                                    ...team,
                                    accommodation: {
                                        ...team.accommodation,
                                        name: newName
                                    }
                                };
                            }
                            return team;
                        });
                        
                        if (needsUpdate) {
                            updatedTeams[category] = updatedTeamArray;
                        }
                    }
                    
                    if (needsUpdate) {
                        userUpdates.push({
                            userId: userDoc.id,
                            teams: updatedTeams,
                            transferredCount: userTransferredCount
                        });
                        totalTransferredTeams += userTransferredCount;
                    }
                }
                
                for (const update of userUpdates) {
                    await updateDoc(doc(window.db, 'users', update.userId), {
                        teams: updatedTeams
                    });
                    console.log(`[AUTOMATICKÁ AKTUALIZÁCIA] ${update.transferredCount} tímov používateľa ${update.userId} bolo prenesené z '${oldName}' na '${newName}'`);
                }
            }
    
            const updates = {
                name: newName,
                type: editType,
                updatedAt: Timestamp.now(),
            };
    
            if (editType === 'ubytovanie') {
                updates.accommodationType = editAccommodationType || null;
                const price = parseFloat(editPricePerNight);
                if (!isNaN(price) && price > 0) {
                    updates.pricePerNight = price;
                }
            } else {
                updates.accommodationType = null;
                updates.pricePerNight = null;
            }
            
            // NOVÉ: Ceny pre stravovanie
            if (editType === 'stravovanie') {
                const breakfastPrice = editBreakfastPrice ? parseFloat(editBreakfastPrice) : null;
                const lunchPrice = editLunchPrice ? parseFloat(editLunchPrice) : null;
                const dinnerPrice = editDinnerPrice ? parseFloat(editDinnerPrice) : null;
                
                if (breakfastPrice !== null) {
                    updates.breakfastPrice = breakfastPrice;
                } else {
                    updates.breakfastPrice = null;
                }
                
                if (lunchPrice !== null) {
                    updates.lunchPrice = lunchPrice;
                } else {
                    updates.lunchPrice = null;
                }
                
                if (dinnerPrice !== null) {
                    updates.dinnerPrice = dinnerPrice;
                } else {
                    updates.dinnerPrice = null;
                }
            } else {
                // Ak sa zmení typ z 'stravovanie' na iný, vymaž ceny
                updates.breakfastPrice = null;
                updates.lunchPrice = null;
                updates.dinnerPrice = null;
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
                    window.showGlobalNotification(`Prekročená dostupná kapacita pre typ ${editAccommodationType} (max ${free})`, 'error');
                    return;
                }
            }
            
            if (!isNaN(cap) && cap > 0) {
                updates.capacity = cap;
            } else {
                updates.capacity = null;
            }

            updates.note = editNote.trim() || null;
    
            const placeRef = doc(window.db, 'places', selectedPlace.id);
            const original = {
                name: selectedPlace.name || '',
                type: selectedPlace.type || '',
                capacity: selectedPlace.capacity != null ? selectedPlace.capacity : null,
                accommodationType: selectedPlace.accommodationType || null,
                pricePerNight: selectedPlace.pricePerNight != null ? selectedPlace.pricePerNight : null,
                breakfastPrice: selectedPlace.breakfastPrice != null ? selectedPlace.breakfastPrice : null,
                lunchPrice: selectedPlace.lunchPrice != null ? selectedPlace.lunchPrice : null,
                dinnerPrice: selectedPlace.dinnerPrice != null ? selectedPlace.dinnerPrice : null,
                note: selectedPlace.note || null,
            };
    
            await updateDoc(placeRef, updates);
    
            // ZBER ZMIEN
            const changesList = [];
            const placeTypeLabel = typeLabels[original.type] || original.type || 'neznámy typ';
            changesList.push(`Úprava miesta: '''${original.name || '(bez názvu)'} (${placeTypeLabel})'`);
    
            if (original.name.trim() !== updates.name.trim()) {
                changesList.push(
                    `Zmena názvu miesta z '${original.name}' na '${updates.name}'`
                );
                
                if (editType === 'ubytovanie' && totalTransferredTeams > 0) {
                    changesList.push(
                        `Automaticky prenesených ${totalTransferredTeams} tímov z ubytovne '${original.name}' na '${updates.name}'`
                    );
                }
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
            
            // Zmena ceny ubytovania
            if (original.pricePerNight !== updates.pricePerNight) {
                const oldPriceStr = original.pricePerNight != null ? `${formatPrice(original.pricePerNight)}€` : '–'; 
                const newPriceStr = updates.pricePerNight != null ? `${formatPrice(updates.pricePerNight)}€` : '–';
                changesList.push(
                    `Zmena ceny z '${oldPriceStr}/os/noc' na '${newPriceStr}/os/noc'`
                );
            }
            
            // NOVÉ: Zmeny cien stravovania
            if (original.breakfastPrice !== updates.breakfastPrice) {
                const oldPriceStr = original.breakfastPrice != null ? `${formatPrice(original.breakfastPrice)}€` : '–';
                const newPriceStr = updates.breakfastPrice != null ? `${formatPrice(updates.breakfastPrice)}€` : '–';
                changesList.push(
                    `Zmena ceny za raňajky z '${oldPriceStr}' na '${newPriceStr}'`
                );
            }
            
            if (original.lunchPrice !== updates.lunchPrice) {
                const oldPriceStr = original.lunchPrice != null ? `${formatPrice(original.lunchPrice)}€` : '–';
                const newPriceStr = updates.lunchPrice != null ? `${formatPrice(updates.lunchPrice)}€` : '–';
                changesList.push(
                    `Zmena ceny za obed z '${oldPriceStr}' na '${newPriceStr}'`
                );
            }
            
            if (original.dinnerPrice !== updates.dinnerPrice) {
                const oldPriceStr = original.dinnerPrice != null ? `${formatPrice(original.dinnerPrice)}€` : '–';
                const newPriceStr = updates.dinnerPrice != null ? `${formatPrice(updates.dinnerPrice)}€` : '–';
                changesList.push(
                    `Zmena ceny za večeru z '${oldPriceStr}' na '${newPriceStr}'`
                );
            }
    
            if (original.note !== updates.note) {
                const oldNote = original.note ? `${original.note}` : '–';
                const newNote = updates.note ? `${updates.note}` : '–';
                changesList.push(
                    `Zmena poznámky z '${oldNote}' na '${newNote}'`
                );
            }
    
            // Ak sa niečo zmenilo → uložíme jedno upozornenie s viacerými riadkami
            if (changesList.length > 1) {
                await createPlaceChangeNotification('place_field_updated', changesList, {
                    id: selectedPlace.id,
                    name: updates.name,
                    type: updates.type,
                });
            }
    
            // Ak boli prenesené tímy, pošli samostatnú notifikáciu (iba raz)
            if (totalTransferredTeams > 0) {
                await createPlaceChangeNotification('accommodation_name_updated', [
                    `Automatická aktualizácia tímov: ${totalTransferredTeams} tímov bolo prenesených z ubytovne '${oldName}' do ubytovne '${newName}'`
                ], {
                    id: selectedPlace.id,
                    name: newName,
                    type: editType
                });
            }
    
            // Aktualizácia lokálneho stavu
            setSelectedPlace(prev => ({
                ...prev,
                name: updates.name,
                type: updates.type,
                capacity: updates.capacity,
                accommodationType: updates.accommodationType || undefined,
                pricePerNight: updates.pricePerNight || undefined,
                breakfastPrice: updates.breakfastPrice || undefined,
                lunchPrice: updates.lunchPrice || undefined,
                dinnerPrice: updates.dinnerPrice || undefined,
                note: updates.note || undefined,
            }));
    
            setPlaces(prevPlaces =>
                prevPlaces.map(p =>
                    p.id === selectedPlace.id
                        ? { ...p, 
                            name: updates.name, 
                            type: updates.type, 
                            capacity: updates.capacity, 
                            accommodationType: updates.accommodationType || undefined,
                            pricePerNight: updates.pricePerNight || undefined,
                            breakfastPrice: updates.breakfastPrice || undefined,
                            lunchPrice: updates.lunchPrice || undefined,
                            dinnerPrice: updates.dinnerPrice || undefined,
                            note: updates.note || undefined
                          }
                        : p
                )
            );
    
            setAllPlaces(prevPlaces =>
                prevPlaces.map(p =>
                    p.id === selectedPlace.id
                        ? { ...p, 
                            name: updates.name, 
                            type: updates.type, 
                            capacity: updates.capacity, 
                            accommodationType: updates.accommodationType || undefined,
                            pricePerNight: updates.pricePerNight || undefined,
                            breakfastPrice: updates.breakfastPrice || undefined,
                            lunchPrice: updates.lunchPrice || undefined,
                            dinnerPrice: updates.dinnerPrice || undefined,
                            note: updates.note || undefined
                          }
                        : p
                )
            );
    
            let successMessage = 'Údaje boli aktualizované';
            if (totalTransferredTeams > 0) {
                successMessage += ` a ${totalTransferredTeams} tímov bolo automaticky prenesených`;
            }
            window.showGlobalNotification(successMessage, 'success');
            
            setIsEditingNameAndType(false);
            setEditCapacity('');
            setEditNote('');
            setEditPricePerNight('');
            // NOVÉ: Vynulovať ceny stravovania
            setEditBreakfastPrice('');
            setEditLunchPrice('');
            setEditDinnerPrice('');
            setMealPriceError(null);
    
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
                lat: tempLocation.lat,
                lng: tempLocation.lng,
                updatedAt: Timestamp.now(),
            });
  
            // Notifikácia iba ak sa súradnice zmenili
            if (originalLocation.lat !== newLocation.lat || originalLocation.lng !== newLocation.lng) {
                const changesList = [];
                const placeTypeLabel = typeLabels[selectedPlace.type] || selectedPlace.type || 'neznámy typ';
                changesList.push(`Úprava miesta: '''${selectedPlace.name || '(bez názvu)'} (${placeTypeLabel})'`);
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
  
            // Notifikácia
            let deleteMessage = `Odstránené miesto: '''${place.name} (${typeLabels[place.type] || place.type})'`;
            
            if (place.capacity != null) {
                deleteMessage += `, kapacita: ${place.capacity}`;
            }
            
            if (place.accommodationType) {
                deleteMessage += `, typ ubytovania: ${place.accommodationType}`;
            }
            
            if (place.pricePerNight != null) {
                deleteMessage += `, cena: ${formatPrice(place.pricePerNight)} €/os/noc`;
            }
            
            // NOVÉ: Ceny stravovania v notifikácii
            if (place.type === 'stravovanie') {
                const mealPrices = [];
                if (place.breakfastPrice != null) mealPrices.push(`raňajky: ${formatPrice(place.breakfastPrice)}€`);
                if (place.lunchPrice != null) mealPrices.push(`obed: ${formatPrice(place.lunchPrice)}€`);
                if (place.dinnerPrice != null) mealPrices.push(`večera: ${formatPrice(place.dinnerPrice)}€`);
                
                if (mealPrices.length > 0) {
                    deleteMessage += `, ceny: ${mealPrices.join(', ')}`;
                }
            }
            
            if (place.note) {
                deleteMessage += `, poznámka: ${place.note}`;
            }
            
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
      
        setPlaceToDelete(selectedPlace);
        setShowDeleteConfirm(true);
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
              breakfastPrice: data.breakfastPrice || null,
              lunchPrice: data.lunchPrice || null,
              dinnerPrice: data.dinnerPrice || null,
              note: data.note || null,
            });
          });
          
          setAllPlaces(loadedPlaces);
          
          let filteredPlaces = loadedPlaces;
          if (activeFilter) {
            filteredPlaces = loadedPlaces.filter(place => place.type === activeFilter);
          }
          setPlaces(filteredPlaces);
          
          if (!leafletMap.current) return;
          
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
     
            // Normálna ikona (BIELE pozadie, FARBENÝ okraj a ikona)
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
     
            // Vybraná ikona (FARBENÉ pozadie, BIELE okraj a ikona) - OPAČNÉ FARBY
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
              // Reset všetkých markerov
              Object.keys(markersRef.current).forEach(placeId => {
                const markerObj = markersRef.current[placeId];
                if (markerObj && markerObj.marker) {
                  markerObj.marker.setIcon(markerObj.normalIcon);
                  markerObj.marker.setZIndexOffset(0);
                }
              });
              
              // Nastav vybraný marker
              marker.setIcon(selectedIcon);
              marker.setZIndexOffset(1000);
              
              setSelectedPlace(place);
              setPlaceHash(place.id);
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
        if (placesLayerRef.current) placesLayerRef.current.clearLayers();
      };
    }, [activeFilter]);
    
    // Dodatočný useEffect pre správnu aktualizáciu ikony pri zmene selectedPlace
    useEffect(() => {
      if (!leafletMap.current || !placesLayerRef.current) return;
    
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
    
    // RENDER
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
  
        // ZMENENÉ: Main content s flex layoutom
        React.createElement('div', { className: 'flex flex-col lg:flex-row gap-6 lg:gap-8' },
          // Ľavá časť - Mapa a jej kontroly
          React.createElement('div', { className: 'lg:w-2/3 relative' },
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
                  
                  // Cena ubytovania
                  selectedPlace.pricePerNight && selectedPlace.type === 'ubytovanie' &&
                    React.createElement('p', { className: 'text-gray-600 mb-3 flex items-center gap-2' },
                      React.createElement('strong', null, 'Cena: '),
                      `${formatPrice(selectedPlace.pricePerNight)} €/os/noc`
                    ),
                  
                  // NOVÉ: Ceny stravovania
                  selectedPlace.type === 'stravovanie' && (
                    React.createElement('div', { className: 'mb-3' },
                      React.createElement('strong', { className: 'block text-gray-700 mb-1' }, 'Ceny:'),
                      selectedPlace.breakfastPrice != null && 
                        React.createElement('p', { className: 'text-gray-600' }, `• Raňajky: ${formatPrice(selectedPlace.breakfastPrice)} €`),
                      selectedPlace.lunchPrice != null && 
                        React.createElement('p', { className: 'text-gray-600' }, `• Obed: ${formatPrice(selectedPlace.lunchPrice)} €`),
                      selectedPlace.dinnerPrice != null && 
                        React.createElement('p', { className: 'text-gray-600' }, `• Večera: ${formatPrice(selectedPlace.dinnerPrice)} €`),
                      (selectedPlace.breakfastPrice == null && selectedPlace.lunchPrice == null && selectedPlace.dinnerPrice == null) &&
                        React.createElement('p', { className: 'text-gray-500 italic' }, 'Ceny nie sú nastavené')
                    )
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
                  ),
                  React.createElement('button', {
                    onClick: () => {
                      setIsEditingNameAndType(true);
                      setEditName(selectedPlace.name || '');
                      setEditType(selectedPlace.type || '');
                      setEditCapacity(selectedPlace.capacity != null ? String(selectedPlace.capacity) : '');
                      setEditAccommodationType(selectedPlace.accommodationType || '');
                      setEditPricePerNight(selectedPlace.pricePerNight != null ? String(selectedPlace.pricePerNight) : '');
                      // NOVÉ: Nastavenie cien stravovania pre editáciu
                      setEditBreakfastPrice(selectedPlace.breakfastPrice != null ? String(selectedPlace.breakfastPrice) : '');
                      setEditLunchPrice(selectedPlace.lunchPrice != null ? String(selectedPlace.lunchPrice) : '');
                      setEditDinnerPrice(selectedPlace.dinnerPrice != null ? String(selectedPlace.dinnerPrice) : '');
                      setEditNote(selectedPlace.note || '');
                    },
                    className: 'w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition'
                  },
                    (selectedPlace?.type === 'ubytovanie' || selectedPlace?.type === 'stravovanie')
                      ? 'Upraviť názov/typ/kapacitu/cenu/poznámku'
                      : 'Upraviť názov/typ/poznámku'
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
            ),
          ),
          
          // Pravá časť - Štatistiky a zoznam miest
          React.createElement('div', { className: 'lg:w-1/3' },
            React.createElement('div', { className: 'bg-gray-50 rounded-xl p-6 shadow-inner h-full flex flex-col' },
              
              // ŠTATISTIKY
              React.createElement('div', { className: 'mb-6' },
                React.createElement('h3', { className: 'text-2xl font-bold mb-4 text-gray-800 border-b pb-3' }, 
                  React.createElement('i', { className: 'fa-solid fa-chart-bar mr-3' }),
                  'Prehľad miest'
                ),
                React.createElement('div', { className: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4' },
                  React.createElement('div', { className: 'bg-white p-4 rounded-lg border border-gray-200 shadow-sm' },
                    React.createElement('div', { className: 'flex items-center' },
                      React.createElement('div', { className: 'w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mr-3' },
                        React.createElement('i', { className: 'fa-solid fa-futbol text-red-600' })
                      ),
                      React.createElement('div', null,
                        React.createElement('p', { className: 'text-2xl font-bold text-gray-800' }, 
                          allPlaces.filter(p => p.type === 'sportova_hala').length
                        ),
                        React.createElement('p', { className: 'text-gray-600 text-sm' }, 'Športové haly')
                      )
                    )
                  ),
                  React.createElement('div', { className: 'bg-white p-4 rounded-lg border border-gray-200 shadow-sm' },
                    React.createElement('div', { className: 'flex items-center' },
                      React.createElement('div', { className: 'w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mr-3' },
                        React.createElement('i', { className: 'fa-solid fa-bed text-gray-600' })
                      ),
                      React.createElement('div', null,
                        React.createElement('p', { className: 'text-2xl font-bold text-gray-800' }, 
                          allPlaces.filter(p => p.type === 'ubytovanie').length
                        ),
                        React.createElement('p', { className: 'text-gray-600 text-sm' }, 'Ubytovanie')
                      )
                    )
                  ),
                  React.createElement('div', { className: 'bg-white p-4 rounded-lg border border-gray-200 shadow-sm' },
                    React.createElement('div', { className: 'flex items-center' },
                      React.createElement('div', { className: 'w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mr-3' },
                        React.createElement('i', { className: 'fa-solid fa-utensils text-green-600' })
                      ),
                      React.createElement('div', null,
                        React.createElement('p', { className: 'text-2xl font-bold text-gray-800' }, 
                          allPlaces.filter(p => p.type === 'stravovanie').length
                        ),
                        React.createElement('p', { className: 'text-gray-600 text-sm' }, 'Stravovanie')
                      )
                    )
                  ),
                  React.createElement('div', { className: 'bg-white p-4 rounded-lg border border-gray-200 shadow-sm' },
                    React.createElement('div', { className: 'flex items-center' },
                      React.createElement('div', { className: 'w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mr-3' },
                        React.createElement('i', { className: 'fa-solid fa-bus text-blue-600' })
                      ),
                      React.createElement('div', null,
                        React.createElement('p', { className: 'text-2xl font-bold text-gray-800' }, 
                          allPlaces.filter(p => p.type === 'zastavka').length
                        ),
                        React.createElement('p', { className: 'text-gray-600 text-sm' }, 'Zastávky')
                      )
                    )
                  )
                )
              ),
              
              // ZOZNAM MIEST
              React.createElement('div', { className: 'flex-1' },
                React.createElement('h3', { className: 'text-2xl font-bold mb-4 text-gray-800 border-b pb-3' }, 
                  React.createElement('i', { className: 'fa-solid fa-list mr-3' }),
                  'Zoznam miest',
                  React.createElement('span', { className: 'ml-3 text-lg font-normal text-gray-600' }, 
                    `(${allPlaces.length} ${allPlaces.length === 1 ? 'miesto' : allPlaces.length < 5 ? 'miesta' : 'miest'})`
                  )
                ),
                
                activeFilter ? 
                  React.createElement('div', { className: 'mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200' },
                    React.createElement('div', { className: 'flex justify-between items-center' },
                      React.createElement('span', { className: 'text-gray-700' },
                        'Filtrovanie: ',
                        React.createElement('span', { className: 'font-bold text-gray-800' }, 
                          typeLabels[activeFilter] || activeFilter
                        )
                      ),
                      React.createElement('button', {
                        onClick: () => setActiveFilter(null),
                        className: 'px-3 py-1 bg-white text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-50 transition text-sm'
                      }, 'Zobraziť všetko')
                    )
                  ) : null,
                
                allPlaces.length === 0 ? 
                  React.createElement('div', { className: 'text-center py-8 text-gray-500' },
                    React.createElement('i', { className: 'fa-solid fa-map-pin text-4xl mb-3 opacity-50' }),
                    React.createElement('p', null, 'Žiadne miesta na zobrazenie')
                  ) :
                  React.createElement('div', { className: 'overflow-y-auto max-h-[500px] pr-2' },
                    (activeFilter ? allPlaces.filter(p => p.type === activeFilter) : allPlaces)
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map(place => {
                        const typeConfig = typeIcons[place.type] || { icon: 'fa-map-pin', color: '#6b7280' };
                        return React.createElement('div', { 
                          key: place.id, 
                          className: `mb-3 p-4 bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow ${selectedPlace?.id === place.id ? 'border-blue-300 bg-blue-50' : ''}` 
                        },
                          React.createElement('div', { className: 'flex justify-between items-start' },
                            React.createElement('div', { className: 'flex-1' },
                              React.createElement('div', { className: 'flex items-center mb-2' },
                                React.createElement('div', { 
                                  className: 'w-8 h-8 rounded-full flex items-center justify-center mr-3',
                                  style: { 
                                    backgroundColor: typeConfig.color + '20',
                                    color: typeConfig.color,
                                    border: `2px solid ${typeConfig.color}`
                                  }
                                },
                                  React.createElement('i', { className: `fa-solid ${typeConfig.icon} text-sm` })
                                ),
                                React.createElement('div', null,
                                  React.createElement('h4', { className: 'font-bold text-gray-800' }, place.name),
                                  React.createElement('span', { 
                                    className: 'text-xs px-2 py-1 rounded-full font-medium',
                                    style: { 
                                      backgroundColor: typeConfig.color + '20',
                                      color: typeConfig.color
                                    }
                                  },
                                    typeLabels[place.type] || place.type
                                  )
                                )
                              ),
                              
                              React.createElement('div', { className: "text-sm text-gray-600 space-y-1" },
                                place.capacity && (place.type === 'ubytovanie' || place.type === 'stravovanie') &&
                                  React.createElement('div', null,
                                    React.createElement('span', { className: 'font-medium' }, place.type === 'ubytovanie' ? 'Lôžok: ' : 'Kapacita: '),
                                    place.capacity
                                  ),
                                
                                place.type === 'ubytovanie' && place.pricePerNight &&
                                  React.createElement('div', null,
                                    React.createElement('span', { className: 'font-medium' }, 'Cena: '),
                                    `${formatPrice(place.pricePerNight)} €/os/noc`
                                  ),
                                
                                place.type === 'stravovanie' && (
                                  React.createElement('div', null,
                                    React.createElement('span', { className: 'font-medium' }, 'Ceny: '),
                                    (place.breakfastPrice || place.lunchPrice || place.dinnerPrice) ?
                                      React.createElement('span', null,
                                        place.breakfastPrice ? `Raňajky: ${formatPrice(place.breakfastPrice)}€ ` : '',
                                        place.lunchPrice ? `Obed: ${formatPrice(place.lunchPrice)}€ ` : '',
                                        place.dinnerPrice ? `Večera: ${formatPrice(place.dinnerPrice)}€` : ''
                                      ) :
                                      React.createElement('span', { className: 'text-gray-400' }, '–')
                                  )
                                )
                              )
                            ),
                            
                            React.createElement('button', {
                              onClick: () => {
                                setSelectedPlace(place);
                                setPlaceHash(place.id);
                                if (leafletMap.current) {
                                  leafletMap.current.setView([place.lat, place.lng], 18, { animate: true });
                                }
                              },
                              className: 'ml-3 px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg transition text-sm font-medium whitespace-nowrap'
                            },
                              React.createElement('i', { className: 'fa-solid fa-map-pin mr-1' }),
                              'Na mape'
                            )
                          )
                        );
                      })
                  )
              )
            )
          )
        ),
 
          // Edit modál (názov, typ, kapacita, cena, typ ubytovania)
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
              (editType === 'ubytovanie' || editType === 'stravovanie') && React.createElement('div', { className: 'mb-5' },
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
              // Cena ubytovania
              editType === 'ubytovanie' && React.createElement('div', { className: 'mb-5' },
                React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1.5' },
                  'Cena za osobu/noc (€)'
                ),
                React.createElement('div', { className: 'relative' },
                  React.createElement('input', {
                    type: 'number',
                    step: '0.01',
                    min: '0.01',
                    value: editPricePerNight,
                    onChange: e => setEditPricePerNight(e.target.value),
                    placeholder: 'napr. 25.50',
                    className: 'w-full px-4 py-3 pl-10 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition'
                  }),
                  React.createElement('span', { className: 'absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium' }, '€')
                ),
                priceError && React.createElement('p', { className: 'mt-2 text-sm text-red-600' }, priceError)
              ),
              // NOVÉ: Ceny stravovania
              editType === 'stravovanie' && React.createElement('div', { className: 'mb-5' },
                React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1.5' },
                  'Ceny za jedlá (€)'
                ),
                React.createElement('div', { className: 'space-y-3' },
                  React.createElement('div', { className: 'flex items-center gap-2' },
                    React.createElement('span', { className: 'w-20 text-sm text-gray-600' }, 'Raňajky:'),
                    React.createElement('div', { className: 'flex-1 relative' },
                      React.createElement('input', {
                        type: 'number',
                        step: '0.01',
                        min: '0',
                        value: editBreakfastPrice,
                        onChange: e => setEditBreakfastPrice(e.target.value),
                        placeholder: 'napr. 5.50',
                        className: 'w-full px-4 py-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition pl-8'
                      }),
                      React.createElement('span', { className: 'absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm' }, '€')
                    )
                  ),
                  React.createElement('div', { className: 'flex items-center gap-2' },
                    React.createElement('span', { className: 'w-20 text-sm text-gray-600' }, 'Obed:'),
                    React.createElement('div', { className: 'flex-1 relative' },
                      React.createElement('input', {
                        type: 'number',
                        step: '0.01',
                        min: '0',
                        value: editLunchPrice,
                        onChange: e => setEditLunchPrice(e.target.value),
                        placeholder: 'napr. 8.90',
                        className: 'w-full px-4 py-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition pl-8'
                      }),
                      React.createElement('span', { className: 'absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm' }, '€')
                    )
                  ),
                  React.createElement('div', { className: 'flex items-center gap-2' },
                    React.createElement('span', { className: 'w-20 text-sm text-gray-600' }, 'Večera:'),
                    React.createElement('div', { className: 'flex-1 relative' },
                      React.createElement('input', {
                        type: 'number',
                        step: '0.01',
                        min: '0',
                        value: editDinnerPrice,
                        onChange: e => setEditDinnerPrice(e.target.value),
                        placeholder: 'napr. 7.50',
                        className: 'w-full px-4 py-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition pl-8'
                      }),
                      React.createElement('span', { className: 'absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm' }, '€')
                    )
                  )
                ),
                mealPriceError && React.createElement('p', { className: 'mt-2 text-sm text-red-600' }, mealPriceError)
              ),
              // Poznámka
              React.createElement('div', { className: 'mb-6' },
                React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1.5' }, 'Poznámka'),
                React.createElement('textarea', {
                  value: editNote,
                  onChange: e => setEditNote(e.target.value),
                  placeholder: 'text poznámky, informácia...',
                  rows: 3,
                  className: 'w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition resize-none'
                })
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
                           !!priceError ||
                           !!mealPriceError ||
                           (editType === 'ubytovanie' && !editAccommodationType),
                  className: 'px-6 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition font-medium'
                }, 'Uložiť zmeny')
              )
            )
          ),
 
          // Pridať nové miesto modál
          (showModal && !isModalOpening) && React.createElement(
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
                  accommodationTypes.map(item => {
                    const avail = accommodationAvailabilityAdd[item.type] || { isFull: false, free: 0, total: 0 };
                    const isDisabled = avail.isFull;
                    const label = `${item.type} (${item.capacity} lôžok celkom)${isDisabled ? ' (naplnená kapacita)' : ''}`;
              
                    return React.createElement('option', {
                      key: item.type,
                      value: item.type,
                      disabled: isDisabled,
                      className: isDisabled ? 'text-gray-400 cursor-not-allowed' : ''
                    }, label);
                  })
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
                  { 
                      className: 'mt-3 p-3 bg-red-50 border border-red-300 text-red-700 rounded-lg text-sm' 
                  },
                  nameTypeError
              ),
              // Kapacita
              (newPlaceType === 'ubytovanie' || newPlaceType === 'stravovanie') && React.createElement('div', { className: 'mb-5' },
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
              // Cena ubytovania
              newPlaceType === 'ubytovanie' && React.createElement('div', { className: 'mb-5' },
                React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1.5' },
                  'Cena za osobu/noc (€)'
                ),
                React.createElement('div', { className: 'relative' },
                  React.createElement('input', {
                    type: 'number',
                    step: '0.01',
                    min: '0.01',
                    value: newPricePerNight,
                    onChange: e => setNewPricePerNight(e.target.value),
                    placeholder: 'napr. 25.50',
                    className: 'w-full px-4 py-3 pl-10 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition'
                  }),
                  React.createElement('span', { className: 'absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium' }, '€')
                ),
                priceError && React.createElement('p', { className: 'mt-2 text-sm text-red-600' }, priceError)
              ),
              // NOVÉ: Ceny stravovania
              newPlaceType === 'stravovanie' && React.createElement('div', { className: 'mb-5' },
                React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1.5' },
                  'Ceny za jedlá (€) - voliteľné'
                ),
                React.createElement('div', { className: 'space-y-3' },
                  React.createElement('div', { className: 'flex items-center gap-2' },
                    React.createElement('span', { className: 'w-20 text-sm text-gray-600' }, 'Raňajky:'),
                    React.createElement('div', { className: 'flex-1 relative' },
                      React.createElement('input', {
                        type: 'number',
                        step: '0.01',
                        min: '0',
                        value: newBreakfastPrice,
                        onChange: e => setNewBreakfastPrice(e.target.value),
                        placeholder: 'napr. 5.50',
                        className: 'w-full px-4 py-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition pl-8'
                      }),
                      React.createElement('span', { className: 'absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm' }, '€')
                    )
                  ),
                  React.createElement('div', { className: 'flex items-center gap-2' },
                    React.createElement('span', { className: 'w-20 text-sm text-gray-600' }, 'Obed:'),
                    React.createElement('div', { className: 'flex-1 relative' },
                      React.createElement('input', {
                        type: 'number',
                        step: '0.01',
                        min: '0',
                        value: newLunchPrice,
                        onChange: e => setNewLunchPrice(e.target.value),
                        placeholder: 'napr. 8.90',
                        className: 'w-full px-4 py-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition pl-8'
                      }),
                      React.createElement('span', { className: 'absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm' }, '€')
                    )
                  ),
                  React.createElement('div', { className: 'flex items-center gap-2' },
                    React.createElement('span', { className: 'w-20 text-sm text-gray-600' }, 'Večera:'),
                    React.createElement('div', { className: 'flex-1 relative' },
                      React.createElement('input', {
                        type: 'number',
                        step: '0.01',
                        min: '0',
                        value: newDinnerPrice,
                        onChange: e => setNewDinnerPrice(e.target.value),
                        placeholder: 'napr. 7.50',
                        className: 'w-full px-4 py-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition pl-8'
                      }),
                      React.createElement('span', { className: 'absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm' }, '€')
                    )
                  )
                ),
                mealPriceError && React.createElement('p', { className: 'mt-2 text-sm text-red-600' }, mealPriceError)
              ),
              // Poznámka
              React.createElement('div', { className: 'mb-6' },
                React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1.5' }, 'Poznámka (voliteľné)'),
                React.createElement('textarea', {
                  value: newPlaceNote,
                  onChange: e => setNewPlaceNote(e.target.value),
                  placeholder: 'text poznámky, informácia...',
                  rows: 3,
                  className: 'w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition resize-none'
                })
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
                    !!priceError ||
                    !!mealPriceError ||
                    (newPlaceType === 'ubytovanie' && !selectedAccommodationType) ||
                    ((newPlaceType === 'ubytovanie' || newPlaceType === 'stravovanie') && 
                     (!newCapacity.trim() || parseInt(newCapacity, 10) <= 0 || isNaN(parseInt(newCapacity, 10)))) ||
                    (newPlaceType === 'ubytovanie' && 
                     (!newPricePerNight.trim() || parseFloat(newPricePerNight) <= 0 || isNaN(parseFloat(newPricePerNight)))),
              
                  className: `
                    px-6 py-2.5 rounded-lg font-medium transition duration-150 border-2
                    ${(!newPlaceName.trim() || 
                       !newPlaceType || 
                       !!nameTypeError || 
                       !!capacityError ||
                       !!priceError ||
                       !!mealPriceError ||
                       (newPlaceType === 'ubytovanie' && !selectedAccommodationType) ||
                       ((newPlaceType === 'ubytovanie' || newPlaceType === 'stravovanie') && 
                        (!newCapacity.trim() || parseInt(newCapacity, 10) <= 0 || isNaN(parseInt(newCapacity, 10)))) ||
                       (newPlaceType === 'ubytovanie' && 
                        (!newPricePerNight.trim() || parseFloat(newPricePerNight) <= 0 || isNaN(parseFloat(newPricePerNight)))))
                      ? 'bg-white text-blue-600 border-blue-600 cursor-not-allowed opacity-60'
                      : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 hover:border-blue-700 active:bg-blue-800 active:border-blue-800'
                    }`
                }, 'Pridať miesto')
              )
            )
          ),
          
          // Potvrdenie vymazania
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
                React.createElement('strong', { className: 'text-gray-900 text-xl' }, `${placeToDelete?.name || 'bez názvu'}`),
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
    );
}

const createPlaceChangeNotification = async (actionType, changesArray, placeData) => {
    if (!window.db || !changesArray?.length) return;
    const currentUserEmail = window.globalUserProfileData?.email || null;
    
    const placeType = placeData?.type ? typeLabels[placeData.type] || placeData.type : 'neznámy typ';
    
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
