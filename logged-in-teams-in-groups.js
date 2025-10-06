<!-- Tento kód je upravený pre pridávanie tímov a ukladanie poradového čísla (order) do databázy. -->
import { doc, getDoc, onSnapshot, updateDoc, collection, Timestamp, query, getDocs, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
const { useState, useEffect, useRef } = React;

// --- Komponent Modálne Okno pre Pridanie Tímu/Konfigurácie ---
const NewTeamModal = ({ isOpen, onClose, allGroupsByCategoryId, categoryIdToNameMap, handleSave }) => {
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedGroup, setSelectedGroup] = useState('');
    const [teamName, setTeamName] = useState('');

    useEffect(() => {
        // Reset stavov pri otvorení/zatvorení modálu
        if (!isOpen) {
            setSelectedCategory('');
            setSelectedGroup('');
            setTeamName('');
        }
    }, [isOpen]);

    // Získanie zoradených kategórií pre Select box
    const sortedCategoryEntries = Object.entries(categoryIdToNameMap)
        .sort(([, nameA], [, nameB]) => nameA.localeCompare(nameB));

    // Získanie zoradených skupín pre vybranú kategóriu
    const availableGroups = selectedCategory && allGroupsByCategoryId[selectedCategory]
        ? allGroupsByCategoryId[selectedCategory].sort((a, b) => a.name.localeCompare(b.name))
        : [];
        
    // Reset skupiny, ak sa zmení kategória
    const handleCategoryChange = (e) => {
        setSelectedCategory(e.target.value);
        setSelectedGroup(''); // Reset skupiny pri zmene kategórie
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        // Spustenie funkcie ukladania z rodičovského komponentu
        handleSave({ 
            categoryId: selectedCategory, 
            groupName: selectedGroup, 
            teamName: teamName 
        });
    };

    if (!isOpen) return null;

    return React.createElement(
        'div',
        { 
            className: 'fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[100]',
            onClick: onClose // Zatvorenie po kliknutí mimo modál
        },
        React.createElement(
            'div',
            { 
                className: 'bg-white p-8 rounded-xl shadow-2xl w-full max-w-lg transition-all transform scale-100',
                onClick: (e) => e.stopPropagation() // Zabránenie zatvoreniu po kliknutí vnútri modálu
            },
            React.createElement('h2', { className: 'text-2xl font-bold text-gray-800 mb-6 border-b pb-2' }, 'Pridať Nový Tím'),

            React.createElement(
                'form',
                { onSubmit: handleSubmit, className: 'space-y-4' },
                
                // 1. Select Kategórie
                React.createElement(
                    'div',
                    { className: 'flex flex-col' },
                    React.createElement('label', { className: 'text-sm font-medium text-gray-700 mb-1' }, 'Vyberte kategóriu:'),
                    React.createElement(
                        'select',
                        {
                            className: 'p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500',
                            value: selectedCategory,
                            onChange: handleCategoryChange,
                            required: true
                        },
                        React.createElement('option', { value: '' }, '--- Vyberte kategóriu ---'),
                        sortedCategoryEntries.map(([id, name]) =>
                            React.createElement('option', { key: id, value: id }, name)
                        )
                    )
                ),

                // 2. Select Skupiny
                React.createElement(
                    'div',
                    { className: 'flex flex-col' },
                    React.createElement('label', { className: 'text-sm font-medium text-gray-700 mb-1' }, 'Vyberte skupinu (Voliteľné):'),
                    React.createElement(
                        'select',
                        {
                            className: `p-3 border rounded-lg focus:ring-indigo-500 focus:border-indigo-500 ${!selectedCategory ? 'bg-gray-100 cursor-not-allowed' : ''}`,
                            value: selectedGroup,
                            onChange: (e) => setSelectedGroup(e.target.value),
                            disabled: !selectedCategory
                        },
                        React.createElement('option', { value: '' }, availableGroups.length > 0 ? 'Bez skupiny (Zoznam pre priradenie)' : 'Najprv vyberte kategóriu'),
                        availableGroups.map((group, index) =>
                            React.createElement('option', { key: index, value: group.name }, group.name)
                        )
                    )
                ),

                // 3. Input Názov Tímu
                React.createElement(
                    'div',
                    { className: 'flex flex-col' },
                    React.createElement('label', { className: 'text-sm font-medium text-gray-700 mb-1' }, 'Zadajte názov tímu:'),
                    React.createElement(
                        'input',
                        {
                            type: 'text',
                            className: 'p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500',
                            value: teamName,
                            onChange: (e) => setTeamName(e.target.value),
                            required: true,
                            placeholder: 'Napr. Tím Alfa'
                        }
                    )
                ),

                // Tlačidlá
                React.createElement(
                    'div',
                    { className: 'pt-4 flex justify-end space-x-3' },
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            className: 'px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors',
                            onClick: onClose
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            type: 'submit',
                            className: 'px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors',
                            disabled: !selectedCategory || !teamName // Povinné polia
                        },
                        'Potvrdiť a Uložiť Tím'
                    )
                )
            )
        )
    );
};

const AddGroupsApp = ({ userProfileData: initialUserProfileData }) => {
    const [allTeams, setAllTeams] = useState([]);
    const [allGroupsByCategoryId, setAllGroupsByCategoryId] = useState({});
    const [categoryIdToNameMap, setCategoryIdToNameMap] = useState({});
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [selectedGroupName, setSelectedGroupName] = useState(''); 
    const [notification, setNotification] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false); 
    
    // Stav pre drag & drop
    const draggedItem = useRef(null);
    const listRefs = useRef({}); 
    const [dropTarget, setDropTarget] = useState({ groupId: null, categoryId: null, index: null });
    const teamsWithoutGroupRef = useRef(null); 
    
    // Efekt pre manažovanie notifikácií a vymazanie po 5 sekundách
    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => {
                setNotification(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    // Efekt pre načítanie dát z Firebase
    useEffect(() => {
        if (!window.db) {
            console.error("Firebase Firestore nie je inicializovaný.");
            return;
        }

        const usersRef = collection(window.db, 'users');
        const unsubscribeTeams = onSnapshot(usersRef, (querySnapshot) => {
            const teamsList = [];
            querySnapshot.forEach((doc) => {
                const userData = doc.data();
                if (userData && userData.teams) {
                    Object.entries(userData.teams).forEach(([categoryName, teamArray]) => {
                        if (Array.isArray(teamArray)) {
                            teamArray.forEach(team => {
                                if (team.teamName) {
                                    // Zabezpečíme, že tím má order a ID (pre staré tímy fallback)
                                    teamsList.push({
                                        uid: doc.id,
                                        category: categoryName,
                                        id: team.id || `${doc.id}-${team.teamName}`, // Použitie unikátneho ID alebo fallback
                                        teamName: team.teamName,
                                        groupName: team.groupName || null,
                                        order: team.order || 0, // Zabezpečíme, že order je číslo (0 pre default/bez skupiny)
                                    });
                                }
                            });
                        }
                    });
                }
            });
            setAllTeams(teamsList);
        });

        const categoriesRef = doc(window.db, 'settings', 'categories');
        const unsubscribeCategories = onSnapshot(categoriesRef, (docSnap) => {
            const categoryIdToName = {};
            if (docSnap.exists()) {
                const categoryData = docSnap.data();
                Object.entries(categoryData).forEach(([categoryId, categoryObject]) => {
                    if (categoryObject && categoryObject.name) {
                        categoryIdToName[categoryId] = categoryObject.name;
                    }
                });
            }
            setCategoryIdToNameMap(categoryIdToName);
        });

        const groupsRef = doc(window.db, 'settings', 'groups');
        const unsubscribeGroups = onSnapshot(groupsRef, (docSnap) => {
            const groupsByCategoryId = {};
            if (docSnap.exists()) {
                const groupData = docSnap.data();
                Object.entries(groupData).forEach(([categoryId, groupArray]) => {
                    if (Array.isArray(groupArray)) {
                        groupsByCategoryId[categoryId] = groupArray.map(group => ({
                            name: group.name,
                            type: group.type
                        }));
                    }
                });
            }
            setAllGroupsByCategoryId(groupsByCategoryId);
        });

        return () => {
            unsubscribeTeams();
            unsubscribeCategories();
            unsubscribeGroups();
        };
    }, []);

    // **LOGIKA: Načítanie kategórie a skupiny z URL hashu pri štarte**
    useEffect(() => {
        const hash = window.location.hash.substring(1);
        if (hash) {
            const parts = hash.split('/');
            const categoryId = parts[0];
            const groupNameEncoded = parts[1];
            const groupName = groupNameEncoded ? decodeURIComponent(groupNameEncoded) : '';

            setSelectedCategoryId(categoryId);
            setSelectedGroupName(groupName); // Nastaví skupinu, ak je v URL
        }
    }, []);

    // **LOGIKA: Synchronizácia stavu s URL hashom**
    useEffect(() => {
        let hash = '';
        if (selectedCategoryId) {
            hash = selectedCategoryId;
            if (selectedGroupName) {
                // Kódujeme názov skupiny pre URL
                hash += `/${encodeURIComponent(selectedGroupName)}`;
            }
        }

        if (window.location.hash.substring(1) !== hash) {
            window.location.hash = hash;
        }

    }, [selectedCategoryId, selectedGroupName]);

    // --- NOVÁ FUNKCIA: Uloženie nového Tímu ---
    const handleAddNewTeam = async ({ categoryId, groupName, teamName }) => {
        if (!window.db || !window.auth.currentUser) {
            setNotification({ id: Date.now(), message: "Pre pridanie tímu musíte byť prihlásený.", type: 'error' });
            return;
        }

        const userId = window.auth.currentUser.uid;
        const categoryName = categoryIdToNameMap[categoryId];
        // Kľúč pre poľa tímov v dokumente používateľa (napr. teams.Kategoria A)
        const teamCategoryKey = `teams.${categoryName}`; 

        // 1. Nájdeme tímy v cieľovej kategórii a skupine (len pre výpočet poradia)
        // Toto funguje vďaka tomu, že 'allTeams' je aktuálny stav celej databázy.
        const teamsInTargetGroup = allTeams.filter(t => 
            t.category === categoryName && 
            t.groupName === groupName
        );
        
        // Zistíme maximálne poradie v tejto skupine/kategórii
        let maxOrder = 0;
        teamsInTargetGroup.forEach(t => {
            if (t.order > maxOrder) {
                maxOrder = t.order;
            }
        });
        
        // Nové poradie: null ak bez skupiny, inak maxOrder + 1
        // Poradové číslo (order) sa ukladá rovnako ako pri drag & drop
        const newOrder = groupName ? (maxOrder + 1) : null; 
        
        try {
            // Referencia na dokument používateľa, kde sú uložené jeho tímy
            const userDocRef = doc(window.db, 'users', userId);
            
            // 1. Získame aktuálne pole tímov pre danú kategóriu (ak existuje)
            const userDocSnap = await getDoc(userDocRef);
            const currentTeams = userDocSnap.data()?.teams?.[categoryName] || [];

            // 2. Vytvorenie nového tímu s poradovým číslom
            const newTeam = {
                teamName: teamName,
                groupName: groupName || null,
                order: newOrder,
                timestamp: Timestamp.now(),
                // Pridáme ID pre unikátnu identifikáciu v rámci poľa
                id: crypto.randomUUID() 
            };
            
            // 3. Aktualizácia poľa tímov o nový tím
            const updatedTeamsArray = [...currentTeams, newTeam];
            
            // Použijeme updateDoc na aktualizáciu len konkrétneho poľa
            await updateDoc(userDocRef, {
                [teamCategoryKey]: updatedTeamsArray
            });
            
            setIsModalOpen(false);
            setNotification({ 
                id: Date.now(), 
                message: `Tím '${teamName}' bol úspešne pridaný a zaradený (Poradie: ${newOrder || 'bez poradia'}).`, 
                type: 'success' 
            });

        } catch (error) {
            console.error("Chyba pri pridávaní nového tímu:", error);
            setNotification({ id: Date.now(), message: "Chyba pri ukladaní nového tímu do databázy.", type: 'error' });
        }
    };
    // --- KONIEC NOVEJ FUNKCIE ---

    const teamsWithoutGroup = selectedCategoryId
        ? allTeams.filter(team => team.category === categoryIdToNameMap[selectedCategoryId] && !team.groupName).sort((a, b) => a.teamName.localeCompare(b.teamName))
        : allTeams.filter(team => !team.groupName).sort((a, b) => a.teamName.localeCompare(b.teamName));

    const teamsInGroups = selectedCategoryId
        ? allTeams.filter(team => team.category === categoryIdToNameMap[selectedCategoryId] && team.groupName)
        : allTeams.filter(team => team.groupName);

    const getGroupColorClass = (type) => {
        switch (type) {
            case 'základná skupina': return 'bg-gray-100';
            case 'nadstavbová skupina': return 'bg-blue-100';
            default: return 'bg-white';
        }
    };

    // Všeobecná funkcia pre kontrolu kategórie pri drag over
    const checkCategoryMatch = (targetCategoryId) => {
        const dragData = draggedItem.current;
        if (!dragData) return false;

        const teamCategoryName = dragData.team.category; 
        const targetCategoryName = categoryIdToNameMap[targetCategoryId];

        // Ak sa presúva tím bez skupiny do skupiny, musia sa zhodovať kategórie
        if (targetCategoryName && teamCategoryName && targetCategoryName !== teamCategoryName) {
            return false;
        }
        return true;
    }
    
    // Funkcia na spracovanie drag over na li elemente (tíme)
    const handleDragOverTeam = (e, targetGroup, targetCategoryId, index) => {
        e.preventDefault();
        
        // **NOVÁ KONTROLA KATEGÓRIE**
        if (!checkCategoryMatch(targetCategoryId)) {
            e.dataTransfer.dropEffect = "none";
            e.currentTarget.style.cursor = 'not-allowed';
            setDropTarget({ groupId: null, categoryId: null, index: null });
            return;
        }

        // Vizuál kurzora a povolenie dropu
        e.dataTransfer.dropEffect = "move";
        e.currentTarget.style.cursor = 'move';
        
        // ZABRÁNI BUBBLINGU, ak sme nad LI elementom.
        e.stopPropagation(); 
        
        const rect = e.currentTarget.getBoundingClientRect();
        // Rozdelenie LI na hornú polovicu (insert PRED) a dolnú polovicu (insert ZA)
        const isOverTopHalf = e.clientY - rect.top < rect.height / 2;
        
        // Ak sa presúva cez tím:
        let insertionIndex;
        if (isOverTopHalf) {
             insertionIndex = index;
        } else {
             insertionIndex = index + 1;
        }
        
        // Nastavíme vizuálnu spätnú väzbu
        setDropTarget({
            groupId: targetGroup, // null pre tímy bez skupiny
            categoryId: targetCategoryId,
            index: insertionIndex
        });
    };

    /**
     * Pomocná funkcia na presné určenie indexu, keď sa kurzor nachádza v medzerách
     * medzi LI prvkami (keď sa spustí UL handler).
     */
    const getInsertionIndexInGap = (e, teamElements, sortedTeams) => {
        if (teamElements.length === 0) return 0;
        
        // 1. Kontrola PRED prvým elementom
        const firstRect = teamElements[0].getBoundingClientRect();
        if (e.clientY < firstRect.top) { 
            return 0;
        }

        for (let i = 0; i < teamElements.length; i++) {
            const teamEl = teamElements[i];
            const rect = teamEl.getBoundingClientRect();
            
            // Check: Sme NAD aktuálnym prvkom? Ak áno, LI handler by to mal chytiť.
            if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
                // Sme nad LI prvkom, necháme to riešiť handleDragOverTeam
                return -1; 
            }
            
            // Check 2: Sme POD aktuálnym elementom 'i' a NAD nasledujúcim 'i+1'? (Priestor medzi)
            if (i < teamElements.length - 1) {
                const nextRect = teamElements[i + 1].getBoundingClientRect();
                
                // Hľadáme priestor medzi elementmi
                const gapStart = rect.bottom + 2; 
                const gapEnd = nextRect.top - 2; 
                
                if (e.clientY > gapStart && e.clientY < gapEnd) {
                     return i + 1;
                }
            } else {
                // Check 3: Sme pod POSLEDNÝM elementom
                if (e.clientY > rect.bottom) {
                    return sortedTeams.length;
                }
            }
        }
        
        return -1; 
    }


    // Funkcia na spracovanie drag over na UL kontajneri (zvyšok priestoru skupiny)
    const handleDragOverEnd = (e, targetGroup, targetCategoryId, sortedTeams) => {
        e.preventDefault();
        
        // **NOVÁ KONTROLA KATEGÓRIE**
        if (!checkCategoryMatch(targetCategoryId)) {
            e.dataTransfer.dropEffect = "none";
            e.currentTarget.style.cursor = 'not-allowed';
            setDropTarget({ groupId: null, categoryId: null, index: null });
            return;
        }
        
        // Povolenie dropu
        e.dataTransfer.dropEffect = "move";
        e.currentTarget.style.cursor = 'move';
        
        const containerRef = listRefs.current[`${targetCategoryId}-${targetGroup}`];
        if (!containerRef) return;

        // Vylúčime Drop Indicator prvky z merania
        const teamElements = Array.from(containerRef.children).filter(el => el.tagName === 'LI');
        
        // 1. Skúsi zistiť, či je kurzor v presnej medzere
        let insertionIndex = getInsertionIndexInGap(e, teamElements, sortedTeams);
        
        // 2. Ak sa nenašiel presný index v medzere (-1), predpokladáme koniec zoznamu
        if (insertionIndex === -1) {
            insertionIndex = sortedTeams.length;
        }

        // Nastavíme index na vypočítanú pozíciu (koniec zoznamu alebo presnú medzeru)
        setDropTarget({
            groupId: targetGroup,
            categoryId: targetCategoryId,
            index: insertionIndex
        });
    };


    // Funkcia na spracovanie drag over na PRÁZDNOM kontajneri (skupine/zozname bez tímu)
    const handleDragOverEmptyContainer = (e, targetGroup, targetCategoryId) => {
        e.preventDefault();
        
        // **NOVÁ KONTROLA KATEGÓRIE**
        if (!checkCategoryMatch(targetCategoryId)) {
            e.dataTransfer.dropEffect = "none";
            e.currentTarget.style.cursor = 'not-allowed';
            setDropTarget({ groupId: null, categoryId: null, index: null });
            return;
        }
        
        const dragData = draggedItem.current;
        if (!dragData) {
            e.dataTransfer.dropEffect = "none";
            return;
        }
        
        // Povolenie dropu
        e.dataTransfer.dropEffect = "move";
        e.currentTarget.style.cursor = 'move';
        
        // Ak kontajner nemá žiadne tímy, nastavíme index na 0 (vloží sa ako prvý/jediný)
        setDropTarget({
            groupId: targetGroup,
            categoryId: targetCategoryId,
            index: 0
        });
    };
    

    const handleDrop = async (e, targetGroup, targetCategoryId) => {
        e.preventDefault();
        const dragData = draggedItem.current;
        const finalDropTarget = dropTarget; // Získame poslednú platnú cieľovú pozíciu

        // **DOPLNKOVÁ KONTROLA KATEGÓRIE pri dropnutí** (Ak by sa nejakým spôsobom obišiel DragOver)
        if (!checkCategoryMatch(targetCategoryId)) {
            setNotification({ id: Date.now(), message: "Skupina nepatrí do rovnakej kategórie ako tím. Presun bol zrušený.", type: 'error' });
            // Vyčistíme dropTarget a dragItem
            setDropTarget({ groupId: null, categoryId: null, index: null });
            draggedItem.current = null;
            return;
        }


        // Vyčistíme dropTarget hneď po pustení
        setDropTarget({ groupId: null, categoryId: null, index: null });
        
        // Kontrola platnosti cieľového indexu
        if (!dragData || (finalDropTarget.index === null || finalDropTarget.index === undefined)) {
            console.error("Žiadne dáta na presunutie alebo neplatný cieľový index.");
            return;
        }

        // Pôvodné dáta tímu obsahujú staré poradie a skupinu
        const teamData = dragData.team;
        const originalGroup = teamData.groupName;
        const originalOrder = teamData.order; // Získame pôvodné poradové číslo
        const teamCategoryName = teamData.category; 
        
        // Vypočítame 1-based nové poradie (ak je v skupine)
        const newOrder = targetGroup ? (finalDropTarget.index + 1) : null;
        
        // **NOVÁ KONTROLA PRE ZABRÁNENIE ZBYTOČNÉHO ZÁPISU**
        // Ak sa presúva do rovnakej skupiny (targetGroup === originalGroup) a pozícia sa nemení 
        if (targetGroup === originalGroup) {
            // Zistíme aktuálne zoradený zoznam
            const teamsInOriginalGroup = allTeams
                .filter(t => t.category === teamCategoryName && t.groupName === originalGroup)
                .sort((a, b) => (a.order || 0) - (b.order || 0));
            
            // Nájdeme index tímu v aktuálnom zoradenom zozname
            const teamIndexInOriginal = teamsInOriginalGroup.findIndex(t => t.id === teamData.id); // Používame ID pre spoľahlivú identifikáciu
            
            // Ak je finálny index rovnaký ako pôvodný index alebo posunutý o 1 kvôli odstráneniu 
            // V rámci internej logiky, ak je index ten istý, nebudeme prečíslovať.
            if (teamIndexInOriginal !== -1 && finalDropTarget.index === teamIndexInOriginal) {
                 setNotification({ id: Date.now(), message: "Tím sa presunul do pôvodnej pozície a poradie sa nezmenilo.", type: 'info' });
                 return;
            }
        }
        
        // Ak sa presúva v rámci listu "bez skupiny" a kategória sedí, tak nie je čo meniť, pretože tam nie je poradie.
        if (!targetGroup && !originalGroup) {
            // Kontrola kategórie je už vyššie, stačí len notifikovať o prebytočnom presune
            setNotification({ id: Date.now(), message: "Tím sa už nachádza v tomto zozname.", type: 'info' });
            return;
        }


        try {
            const usersRef = collection(window.db, 'users');
            const userDocs = await getDocs(usersRef);
            const batchPromises = [];

            // Určenie typu presunu pre internú logiku posúvania
            const isMovingWithinSameGroup = targetGroup && (targetGroup === originalGroup);
            const isMovingFromGroup = originalGroup && !targetGroup;
            const isMovingToGroup = !originalGroup && targetGroup;
            const isMovingBetweenGroups = originalGroup && targetGroup && originalGroup !== targetGroup;


            userDocs.forEach(userDoc => {
                const userData = userDoc.data();
                if (userData.teams?.[teamCategoryName]) {
                    const teams = userData.teams[teamCategoryName];
                    let shouldUpdate = false;
                    
                    const updatedUserTeams = teams.map(t => {
                        // Identifikujeme presúvaný tím (použijeme stabilné ID)
                        const isDraggedTeam = userDoc.id === teamData.uid && t.id === teamData.id;
                        
                        // 1. Spracovanie tímu, ktorý sa presúva (platí pre jeho majiteľa)
                        if (isDraggedTeam) {
                            // Nastavíme novú skupinu a vypočítané nové poradie
                            shouldUpdate = true;
                            return { ...t, groupName: targetGroup, order: newOrder }; 
                        }

                        // 2. Spracovanie ostatných tímov (posúvanie poradia)

                        // --- Prípad: Presun v rámci TEJ ISTEJ skupiny (Internal Reorder) ---
                        if (isMovingWithinSameGroup && t.groupName === targetGroup && t.order != null) {
                            // A. Pohyb smerom dole (originalOrder < newOrder). Tímy medzi (originalOrder, newOrder-1) musia klesnúť o 1.
                            if (newOrder > originalOrder && t.order > originalOrder && t.order <= newOrder - 1) { 
                                shouldUpdate = true;
                                return { ...t, order: t.order - 1 };
                            }
                            // B. Pohyb smerom hore (newOrder < originalOrder). Tímy medzi (newOrder, originalOrder-1) musia stúpnuť o 1.
                            else if (newOrder < originalOrder && t.order >= newOrder && t.order < originalOrder) {
                                shouldUpdate = true;
                                return { ...t, order: t.order + 1 };
                            }
                            // Ostatné tímy sa nemenia
                            return t;
                        }


                        // --- Prípady: Insertion/Deletion shift (presun medzi listami) ---
                        
                        // C. Posun v Pôvodnej Skupine (DEKREMENT - ak tím odchádza)
                        if ((isMovingFromGroup || isMovingBetweenGroups) && t.groupName === originalGroup && t.order != null && t.order > originalOrder) {
                            shouldUpdate = true;
                            // Zmenšenie poradia o 1
                            return { ...t, order: t.order - 1 };
                        }

                        // D. Posun v Cieľovej Skupine (INKREMENT - ak tím prichádza)
                        if ((isMovingToGroup || isMovingBetweenGroups) && targetGroup && t.groupName === targetGroup && t.order != null && newOrder !== null && t.order >= newOrder) {
                            shouldUpdate = true;
                            // Zvýšenie poradia o 1
                            return { ...t, order: t.order + 1 };
                        }
                        
                        // Tím sa nezmenil
                        return t;
                    });
                    
                    if (shouldUpdate) {
                         batchPromises.push(
                            updateDoc(userDoc.ref, {
                                [`teams.${teamCategoryName}`]: updatedUserTeams
                            })
                        );
                    }
                }
            });

            await Promise.all(batchPromises);
            
            // Zápis záznamu o notifikácii do databázy
            if (window.db && window.auth && window.auth.currentUser) {
                try {
                    const originalOrderDisplay = originalGroup && originalOrder != null ? `(pôvodné poradie: ${originalOrder})` : '';
                    const originalGroupInfo = originalGroup ? `'${originalGroup}' ${originalOrderDisplay}` : `'bez skupiny'`;
                    const targetGroupInfo = targetGroup ? `'${targetGroup}' (nové poradie: ${newOrder})` : `'bez skupiny'`;
                    
                    const notificationsCollectionRef = collection(window.db, 'notifications');
                    await addDoc(notificationsCollectionRef, {
                        changes: [`Tím ${teamData.teamName} v kategórii ${teamCategoryName} bol presunutý z ${originalGroupInfo} do skupiny ${targetGroupInfo}. Ostatné tímy v pôvodnej aj cieľovej skupine boli prečíslované.`],
                        recipientId: 'all_admins',
                        timestamp: Timestamp.now(),
                        userEmail: window.auth.currentUser.email
                    });
                } catch (dbError) {
                    console.error("Chyba pri ukladaní notifikácie do databázy:", dbError);
                }
            }
            
            // Notifikácia sa zobrazí bez obnovenia stránky
            const originalGroupDisplay = originalGroup ? `'${originalGroup}'` : `'bez skupiny'`;
            const targetGroupDisplay = targetGroup ? `'${targetGroup}' na pozíciu ${newOrder}.` : `'bez skupiny'.`;
            const notificationMessage = `Tím ${teamData.teamName} bol presunutý z ${originalGroupDisplay} do skupiny ${targetGroupDisplay}`;
            setNotification({ id: Date.now(), message: notificationMessage, type: 'success' });
        } catch (error) {
            console.error("Chyba pri aktualizácii databázy:", error);
            setNotification({ id: Date.now(), message: "Nastala chyba pri ukladaní údajov do databázy.", type: 'error' });
        }
    };

    const handleDragStart = (e, team) => {
        // Uloženie len potrebných dát (tímu a kategórie)
        draggedItem.current = { team };
        e.dataTransfer.setData("text/plain", JSON.stringify(team));
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragEnd = () => {
        // Toto sa volá, len keď používateľ PUSTÍ tím
        draggedItem.current = null;
        setDropTarget({ groupId: null, categoryId: null, index: null }); // Vyčistí vizuál
    };

    const renderTeamList = (teamsToRender, targetGroupId, targetCategoryId, isWithoutGroup = false) => {
        const sortedTeams = [...teamsToRender].sort((a, b) => {
            if (!isWithoutGroup) {
                // Zoradenie podľa order (ak nie je definovaný, použijeme 0)
                return (a.order || 0) - (b.order || 0);
            } else {
                // Zoradenie podľa kategórie a potom podľa mena pre tímy bez skupiny
                return a.category.localeCompare(b.category) || a.teamName.localeCompare(b.teamName);
            }
        });
        
        // Vytvorenie React elementov s pridaním indikátorov
        const listItems = sortedTeams.map((team, index) => {
            let teamNameDisplay = team.teamName;
            const teamBgClass = !isWithoutGroup ? 'bg-white' : 'bg-gray-100';
            
            // Logika pre zobrazenie poradia v skupine
            if (!isWithoutGroup && team.order != null) {
                teamNameDisplay = `${team.order}. ${team.teamName}`;
            }

            // Logika pre zobrazenie kategórie (Ak nie je filter kategórie ALEBO ak je to tím pridelený do skupiny)
            if (!selectedCategoryId && team.category && (isWithoutGroup || team.groupName)) {
                teamNameDisplay = `${team.category}: ${teamNameDisplay}`;
            }
            
            // Indikátor pre vloženie PRED aktuálny tím
            const isDropIndicatorVisible = 
                dropTarget.groupId === targetGroupId && 
                dropTarget.categoryId === targetCategoryId && 
                dropTarget.index === index;

            return React.createElement(
                React.Fragment, 
                { key: team.id || `${team.uid}-${team.teamName}-${team.groupName}-${index}` }, // Používame stabilné ID
                // Indikátor pred tímom
                isDropIndicatorVisible && React.createElement('div', { className: 'drop-indicator h-1 bg-blue-500 rounded-full my-1 transition-all duration-100' }),
                React.createElement(
                    'li',
                    {
                        className: `px-4 py-2 ${teamBgClass} rounded-lg text-gray-700 cursor-grab shadow-sm`,
                        draggable: "true",
                        onDragStart: (e) => handleDragStart(e, team),
                        onDragEnd: handleDragEnd,
                        onDragOver: (e) => handleDragOverTeam(e, targetGroupId, targetCategoryId, index),
                    },
                    teamNameDisplay
                )
            );
        });

        // Kontrola, či sa má zobraziť indikátor na úplnom konci zoznamu
        const isDropIndicatorVisibleAtEnd = 
            dropTarget.groupId === targetGroupId && 
            dropTarget.categoryId === targetCategoryId && 
            dropTarget.index === sortedTeams.length; 
            
        // Prázdny kontajner (pre drop na prázdnu skupinu)
        if (sortedTeams.length === 0) {
            const isDropOnEmptyContainer = 
                dropTarget.groupId === targetGroupId && 
                dropTarget.categoryId === targetCategoryId && 
                dropTarget.index === 0;

            return React.createElement(
                'div',
                {
                    // Udalosti sú tu, aby zachytili drop na prázdnu oblasť
                    onDragOver: (e) => handleDragOverEmptyContainer(e, targetGroupId, targetCategoryId),
                    onDrop: (e) => handleDrop(e, targetGroupId, targetCategoryId),
                    className: `min-h-[50px] p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center relative ${isDropOnEmptyContainer ? 'border-blue-500 bg-blue-50' : ''}`
                },
                React.createElement('p', { className: 'text-center text-gray-400' }, 'Sem presuňte tím')
            );
        }

        // Kľúč pre ref kontajnera
        const listRefKey = `${targetCategoryId}-${targetGroupId}`;
        
        return React.createElement(
            'ul',
            { 
                ref: el => {
                    // Uloženie ref pre UL kontajner
                    if (el) {
                        listRefs.current[listRefKey] = el;
                    } else {
                        delete listRefs.current[listRefKey];
                    }
                },
                className: 'space-y-2 relative',
                // Toto zachytáva presun myši V MEDZERÁCH (GAPOCH) a v mŕtvych zónach v rámci kontajnera
                onDragOver: (e) => handleDragOverEnd(e, targetGroupId, targetCategoryId, sortedTeams),
                onDrop: (e) => handleDrop(e, targetGroupId, targetCategoryId),
            },
            ...listItems,
            // Vloženie koncového indikátora
            isDropIndicatorVisibleAtEnd && React.createElement('div', { className: 'drop-indicator h-1 bg-blue-500 rounded-full my-1 transition-all duration-100' }),
        );
    };

    const renderGroupedCategories = () => {
        if (Object.keys(allGroupsByCategoryId).length === 0) {
            return React.createElement(
                'div',
                { className: 'w-full max-w-xl mx-auto' },
                React.createElement('p', { className: 'text-center text-gray-500' }, 'Žiadne skupiny neboli nájdené.')
            );
        }
        
        // OPRAVENÉ: Použitie nameA a nameB pre zoradenie
        const sortedCategoryEntries = Object.entries(categoryIdToNameMap)
            .sort(([, nameA], [, nameB]) => nameA.localeCompare(nameB));
        
        return React.createElement(
            'div',
            { className: 'flex flex-wrap gap-4 justify-center' },
            sortedCategoryEntries.map(([categoryId, categoryName], index) => {
                const groups = allGroupsByCategoryId[categoryId];
                const teamsInThisCategory = allTeams.filter(team => team.category === categoryIdToNameMap[categoryId]);

                const sortedGroups = [...groups].sort((a, b) => {
                    if (a.type === 'základná skupina' && b.type !== 'základná skupina') return -1;
                    if (b.type === 'základná skupina' && a.type !== 'základná skupina') return 1;
                    return a.name.localeCompare(b.name);
                });

                return React.createElement(
                    'div',
                    { key: index, className: 'flex flex-col bg-white rounded-xl shadow-xl p-8 mb-6 flex-shrink-0' },
                    React.createElement(
                        'h3',
                        { className: 'text-2xl font-semibold mb-4 text-center whitespace-nowrap' },
                        categoryName
                    ),
                    React.createElement(
                        'ul',
                        { className: 'space-y-2' },
                        sortedGroups.map((group, groupIndex) =>
                            React.createElement(
                                'li',
                                {
                                    key: groupIndex,
                                    className: `px-4 py-2 rounded-lg text-gray-700 whitespace-nowrap ${getGroupColorClass(group.type)}`,
                                    // Drop/DragOver sa rieši v renderTeamList, aby sa zabránilo kolíziám
                                },
                                React.createElement(
                                    'div',
                                    null,
                                    React.createElement('p', { className: 'font-semibold whitespace-nowrap' }, group.name),
                                    React.createElement('p', { className: 'text-sm text-gray-500 whitespace-nowrap' }, group.type),
                                    React.createElement(
                                        'div',
                                        { className: 'mt-2 space-y-1' },
                                        renderTeamList(teamsInThisCategory.filter(team => team.groupName === group.name), group.name, categoryId)
                                    )
                                )
                            )
                        )
                    )
                );
            })
        );
    };

    const renderSingleCategoryView = () => {
        const categoryName = categoryIdToNameMap[selectedCategoryId] || "Neznáma kategória";
        let groups = allGroupsByCategoryId[selectedCategoryId] || [];
        
        // FILTROVANIE: Ak je vybraná konkrétna skupina, zobrazí sa iba tá
        if (selectedGroupName) {
            groups = groups.filter(g => g.name === selectedGroupName);
        }

        const sortedGroups = [...groups].sort((a, b) => {
            if (a.type === 'základná skupina' && b.type !== 'základná skupina') return -1;
            if (b.type === 'základná skupina' && a.type !== 'základná skupina') return 1;
            return a.name.localeCompare(b.name);
        });
        
        // Zistenie výšky nepriradených tímov
        const teamsWithoutGroupHeight = teamsWithoutGroupRef.current 
            ? teamsWithoutGroupRef.current.offsetHeight 
            : null;

        return React.createElement(
            'div',
            { className: 'flex flex-col lg:flex-row justify-center space-x-0 lg:space-x-4 w-full px-4' },
            React.createElement(
                'div',
                {
                    ref: teamsWithoutGroupRef,
                    className: "w-full lg:w-1/4 max-w-sm bg-white rounded-xl shadow-xl p-8 mb-6 flex-shrink-0",
                    // Drop/DragOver sa rieši v renderTeamList
                },
                React.createElement('h3', { className: 'text-2xl font-semibold mb-4 text-center' }, `Tímy bez skupiny v kategórii: ${categoryName}`),
                renderTeamList(teamsWithoutGroup, null, selectedCategoryId, true) // true, lebo sú bez skupiny (sorted by name)
            ),
            React.createElement(
                'div',
                { className: 'flex-grow min-w-0 flex flex-col gap-4' },
                sortedGroups.length > 0 ? (
                    sortedGroups.map((group, groupIndex) => {
                        let customStyle = {};
                        // Dynamické nastavenie výšky, ak je vybraná konkrétna skupina
                        if (selectedGroupName) {
                            if (teamsWithoutGroupHeight) {
                                customStyle = {
                                    minHeight: `${teamsWithoutGroupHeight}px`,
                                };
                            }
                        }

                        return React.createElement(
                            'div',
                            {
                                key: groupIndex,
                                className: `flex flex-col rounded-xl shadow-xl p-8 mb-6 flex-shrink-0 ${getGroupColorClass(group.type)}`,
                                // Drop/DragOver sa rieši v renderTeamList
                                style: customStyle, // Aplikovanie dynamickej výšky
                            },
                            React.createElement('h3', { className: 'text-2xl font-semibold mb-4 text-center whitespace-nowrap' }, group.name),
                            React.createElement(
                                'div',
                                { className: 'mt-2 space-y-1' },
                                renderTeamList(teamsInGroups.filter(team => team.groupName === group.name), group.name, selectedCategoryId)
                            )
                        );
                    })
                ) : (
                    React.createElement('p', { className: 'text-center text-gray-500' }, 'Žiadne skupiny v tejto kategórii.')
                )
            )
        );
    };

    // OPRAVENÉ: Použitie nameA a nameB pre zoradenie
    const sortedCategoryEntries = Object.entries(categoryIdToNameMap)
        .sort(([, nameA], [, nameB]) => nameA.localeCompare(nameB));
    
    // Dynamické triedy pre notifikáciu
    const notificationClasses = `fixed-notification fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl text-white text-center transition-opacity duration-300 transform z-50 flex items-center justify-center 
                  ${notification ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`;
    let typeClasses = '';
    switch (notification?.type) {
        case 'success':
            typeClasses = 'bg-green-500';
            break;
        case 'error':
            typeClasses = 'bg-red-500';
            break;
        case 'info':
            typeClasses = 'bg-blue-500';
            break;
        default:
            typeClasses = 'bg-gray-700';
    }

    return React.createElement(
        'div',
        { className: 'flex flex-col w-full relative' },
        // Lokálna notifikácia
        React.createElement(
            'div',
            { className: `${notificationClasses} ${typeClasses}`},
            notification?.message
        ),
        
        // Modálne okno
        React.createElement(NewTeamModal, {
            isOpen: isModalOpen,
            onClose: () => setIsModalOpen(false),
            allGroupsByCategoryId: allGroupsByCategoryId,
            categoryIdToNameMap: categoryIdToNameMap,
            handleSave: handleAddNewTeam // Spustí upravenú funkciu ukladania
        }),

        React.createElement(
            'div',
            { className: 'w-full max-w-xs mx-auto mb-8' },
            // Select pre kategóriu
            React.createElement('label', { className: 'block text-center text-xl font-semibold mb-2' }, 'Vyberte kategóriu:'),
            React.createElement(
                'select',
                {
                    className: 'w-full px-4 py-2 rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200',
                    value: selectedCategoryId,
                    onChange: (e) => {
                        setSelectedCategoryId(e.target.value);
                        setSelectedGroupName(''); // Reset skupiny pri zmene kategórie
                    }
                },
                React.createElement('option', { value: '' }, 'Všetky kategórie'),
                sortedCategoryEntries.map(([id, name]) =>
                    React.createElement('option', { key: id, value: id }, name)
                )
            ),

            // Select pre skupinu
            React.createElement('label', { className: 'block text-center text-xl font-semibold mb-2 mt-4' }, 'Vyberte skupinu (Voliteľné):'),
            React.createElement(
                'select',
                {
                    className: `w-full px-4 py-2 rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200 ${!selectedCategoryId ? 'opacity-50' : ''}`,
                    value: selectedGroupName,
                    onChange: (e) => setSelectedGroupName(e.target.value),
                    disabled: !selectedCategoryId, // Zablokované, ak nie je vybraná kategória
                    style: { cursor: !selectedCategoryId ? 'not-allowed' : 'pointer' } 
                },
                React.createElement('option', { value: '' }, 'Zobraziť všetky skupiny'),
                // Zobrazí iba skupiny pre vybranú kategóriu
                (allGroupsByCategoryId[selectedCategoryId] || [])
                    .sort((a, b) => a.name.localeCompare(b.name)) // Abecedné zoradenie
                    .map((group, index) =>
                        React.createElement('option', { key: index, value: group.name }, group.name)
                    )
            )
        ),
        selectedCategoryId
            ? renderSingleCategoryView()
            : React.createElement(
                'div',
                { className: 'flex flex-col lg:flex-row justify-center space-x-0 lg:space-x-4 w-full px-4' },
                React.createElement(
                    'div',
                    {
                        className: `w-full lg:w-1/4 max-w-sm bg-white rounded-xl shadow-xl p-8 mb-6 flex-shrink-0`,
                        // Drop/DragOver sa rieši v renderTeamList
                    },
                    React.createElement('h3', { className: 'text-2xl font-semibold mb-4 text-center' }, 'Zoznam všetkých tímov'),
                    renderTeamList(teamsWithoutGroup, null, null, true)
                ),
                React.createElement(
                    'div',
                    { className: 'flex-grow min-w-0' },
                    renderGroupedCategories()
                )
            ),
            
        // NOVÉ: Floating Action Button (FAB)
        React.createElement(
            'button',
            {
                className: 'fixed bottom-8 right-8 bg-green-500 hover:bg-green-600 text-white p-5 rounded-full shadow-2xl transition-all duration-300 transform hover:scale-110 focus:outline-none focus:ring-4 focus:ring-green-400',
                onClick: () => setIsModalOpen(true)
            },
            React.createElement('span', { className: 'text-2xl font-bold' }, '+')
        )
    );
};

// Inicializácia aplikácie
let isEmailSyncListenerSetup = false;
const handleDataUpdateAndRender = (event) => {
    const userProfileData = event.detail;
    const rootElement = document.getElementById('root');
    if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
        const root = ReactDOM.createRoot(rootElement);
        if (userProfileData) {
            root.render(React.createElement(AddGroupsApp, { userProfileData }));
            if (window.auth && window.db && !isEmailSyncListenerSetup) {
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
                                }
                            }
                        } catch (error) {
                            console.error("Chyba pri synchronizácii e-mailu:", error);
                        }
                    }
                });
                isEmailSyncListenerSetup = true;
            }
        } else {
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
                React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-b-4 border-blue-500' })
            )
        );
    }
}
