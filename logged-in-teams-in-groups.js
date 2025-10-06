import { doc, getDoc, onSnapshot, updateDoc, collection, Timestamp, query, getDocs, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
const { useState, useEffect, useRef } = React;

// Referencia na globálny konfiguračný dokument pre nadstavbové tímy
const SUPERSTRUCTURE_TEAMS_DOC_PATH = 'settings/superstructureGroups';

// --- Komponent Modálne Okno pre Pridanie Tímu/Konfigurácie ---
// Prijíma nové props: defaultCategoryId, defaultGroupName, allTeams
const NewTeamModal = ({ isOpen, onClose, allGroupsByCategoryId, categoryIdToNameMap, handleSave, defaultCategoryId, defaultGroupName, allTeams }) => {
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedGroup, setSelectedGroup] = useState('');
    const [teamName, setTeamName] = useState('');
    const [isDuplicate, setIsDuplicate] = useState(false); // NOVÝ STAV pre kontrolu duplikátov

    // Nastavenie/reset stavu pri otvorení/zatvorení modálu alebo zmene predvolených hodnôt
    useEffect(() => {
        if (isOpen) {
            // Ak je k dispozícii predvolená kategória (z filtra hlavnej stránky), použije sa
            setSelectedCategory(defaultCategoryId || '');
            
            // Ak je k dispozícii predvolená skupina, použije sa, inak prázdny reťazec
            setSelectedGroup(defaultGroupName || ''); 
            
            setTeamName('');
        } else {
             // Reset stavu pri zatvorení
             setSelectedCategory('');
             setSelectedGroup('');
             setTeamName('');
             setIsDuplicate(false); // Reset aj pre duplikát
        }
    }, [isOpen, defaultCategoryId, defaultGroupName]); // Pridaná závislosť defaultGroupName

    // EFEKT: Kontrola duplicitného názvu tímu
    useEffect(() => {
        if (!isOpen) return;

        const name = teamName.trim();
        const categoryName = categoryIdToNameMap[selectedCategory] || '';

        if (name && selectedCategory && categoryName) {
            // Vytvoríme finálny názov tímu, ako bude uložený v databáze (s názvom kategórie)
            const finalName = `${categoryName} ${name}`;
            
            // Kontrola duplikátu v existujúcich tímoch (userTeams aj superstructureTeams)
            const duplicate = allTeams.some(team => team.teamName === finalName);
            setIsDuplicate(duplicate);
        } else {
            setIsDuplicate(false);
        }
    }, [teamName, selectedCategory, allTeams, isOpen, categoryIdToNameMap]); // Pridané závislosti allTeams a categoryIdToNameMap

    const sortedCategoryEntries = Object.entries(categoryIdToNameMap)
        .sort(([, nameA], [, nameB]) => nameA.localeCompare(nameB));

    const availableGroups = selectedCategory && allGroupsByCategoryId[selectedCategory]
        ? allGroupsByCategoryId[selectedCategory].sort((a, b) => a.name.localeCompare(b.name))
        : [];
        
    const handleCategoryChange = (e) => {
        setSelectedCategory(e.target.value);
        // Ak sa zmení kategória, resetujeme skupinu, pokiaľ nebola nastavená filtrom
        if (!defaultGroupName) {
            setSelectedGroup(''); 
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        // Zabezpečenie, že aj pri odoslaní formulára nie je duplikát alebo neplatné vstupy
        if (isSubmitDisabled) {
            return;
        }

        handleSave({ 
            categoryId: selectedCategory, 
            groupName: selectedGroup, 
            teamName: teamName // Pôvodný názov tímu, kým ho funkcia handleAddNewTeam neformátuje
        });
    };
    
    // NOVÁ LOGIKA BLOKOVANIA TLAČIDLA:
    const isCategoryValid = !!selectedCategory;
    const isGroupValid = !!selectedGroup; // KONTROLA SKUPINY (MUSÍ BYŤ VYBRANÁ)
    const isTeamNameValid = teamName.trim().length > 0;
    
    const isSubmitDisabled = !isCategoryValid || !isGroupValid || !isTeamNameValid || isDuplicate;

    if (!isOpen) return null;
    
    // Zistíme, či je pole kategórie disabled
    const isCategoryFixed = !!defaultCategoryId;
    // NOVÉ: Zistíme, či je pole skupiny disabled
    const isGroupFixed = !!defaultGroupName;
    
    // KONTROLA PRE TLAČIDLO:
    const buttonBaseClasses = 'px-4 py-2 rounded-lg transition-colors duration-200';
    const activeClasses = 'bg-indigo-600 text-white hover:bg-indigo-700';
    
    // UPRAVENÉ TRIEDY PRE ZABLOKOVANÉ TLAČIDLO
    const disabledClasses = `
        bg-white 
        text-indigo-600 
        border 
        border-indigo-600 
        cursor-default
        shadow-none 
        cursor-not-allowed
    `; 

    return React.createElement(
        'div',
        { 
            className: 'fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[100]',
            onClick: onClose
        },
        React.createElement(
            'div',
            { 
                className: 'bg-white p-8 rounded-xl shadow-2xl w-full max-w-lg transition-all transform scale-100',
                onClick: (e) => e.stopPropagation()
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
                            className: `p-3 border rounded-lg focus:ring-indigo-500 focus:border-indigo-500 ${isCategoryFixed ? 'bg-gray-100 cursor-not-allowed' : 'border-gray-300'}`,
                            value: selectedCategory,
                            onChange: handleCategoryChange,
                            required: true,
                            disabled: isCategoryFixed // Zakázanie zmeny, ak je kategória nastavená filtrom
                        },
                        React.createElement('option', { value: '' }, '--- Vyberte kategóriu ---'),
                        sortedCategoryEntries.map(([id, name]) =>
                            React.createElement('option', { key: id, value: id }, name)
                        )
                    ),
                    isCategoryFixed && React.createElement('p', { className: 'text-xs text-indigo-600 mt-1' }, `Kategória je predvolená filtrom na stránke: ${categoryIdToNameMap[defaultCategoryId]}`)
                ),

                // 2. Select Skupiny
                React.createElement(
                    'div',
                    { className: 'flex flex-col' },
                    // Skupina je teraz povinná!
                    React.createElement('label', { className: 'text-sm font-medium text-gray-700 mb-1' }, 'Vyberte skupinu:'), 
                    React.createElement(
                        'select',
                        {
                            className: `p-3 border rounded-lg focus:ring-indigo-500 focus:border-indigo-500 ${!selectedCategory || isGroupFixed ? 'bg-gray-100 cursor-not-allowed' : ''}`,
                            value: selectedGroup,
                            onChange: (e) => setSelectedGroup(e.target.value),
                            required: true, // Skupina je teraz povinná
                            disabled: !selectedCategory || isGroupFixed
                        },
                        React.createElement('option', { value: '' }, availableGroups.length > 0 ? '--- Vyberte skupinu ---' : 'Najprv vyberte kategóriu'),
                        availableGroups.map((group, index) =>
                            // ZOBRAZENIE: Pridaný typ skupiny v zátvorkách
                            React.createElement('option', { key: index, value: group.name }, `${group.name} (${group.type})`)
                        )
                    ),
                    // NOVÉ: Zobrazenie upozornenia, ak je skupina predvolená
                    isGroupFixed && React.createElement('p', { className: 'text-xs text-indigo-600 mt-1' }, `Skupina je predvolená filtrom na stránke: ${defaultGroupName}`)
                ),

                // 3. Input Názov Tímu
                React.createElement(
                    'div',
                    { className: 'flex flex-col' },
                    React.createElement('label', { className: 'text-sm font-medium text-gray-700 mb-1' }, `Zadajte názov tímu (Uloží sa ako: "${categoryIdToNameMap[selectedCategory] || 'Kategória'} [Váš Názov])":`),
                    React.createElement(
                        'input',
                        {
                            type: 'text',
                            className: 'p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500',
                            value: teamName,
                            onChange: (e) => setTeamName(e.target.value),
                            required: true,
                            placeholder: 'Napr. Tím Alfa (Váš názov)'
                        }
                    ),
                    // Zobrazenie upozornenia pre duplikát
                    isDuplicate && React.createElement('p', { className: 'text-sm text-red-600 mt-2 font-medium p-2 bg-red-50 rounded-lg border border-red-300' }, `Tím s názvom "${categoryIdToNameMap[selectedCategory]} ${teamName.trim()}" už existuje v globálnych alebo používateľských dátach. Zmeňte prosím názov.`)
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
                            className: `${buttonBaseClasses} ${isSubmitDisabled ? disabledClasses : activeClasses}`,
                            disabled: isSubmitDisabled
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
    const [userTeamsData, setUserTeamsData] = useState([]); // NOVÝ STAV pre tímy z user dokumentov
    const [superstructureTeams, setSuperstructureTeams] = useState({}); // Stav pre globálne tímy
    const [allGroupsByCategoryId, setAllGroupsByCategoryId] = useState({});
    const [categoryIdToNameMap, setCategoryIdToNameMap] = useState({});
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [selectedGroupName, setSelectedGroupName] = useState(''); 
    const [notification, setNotification] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false); 
    // NOVÝ STAV pre zabránenie prepisu hashu pri prvotnom načítaní
    const [isInitialHashReadComplete, setIsInitialHashReadComplete] = useState(false); 
    
    // Stav pre drag & drop
    const draggedItem = useRef(null);
    const listRefs = useRef({}); 
    const [dropTarget, setDropTarget] = useState({ groupId: null, categoryId: null, index: null });
    const teamsWithoutGroupRef = useRef(null); 
    
    // Efekt pre manažovanie notifikácií
    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => {
                setNotification(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    // --- UPRAVENÉ POMOCNÉ FUNKCIE PRE URL SLUG ---

    /**
     * Prevedie názov (kategória alebo skupina) s medzerami na URL slug (s pomlčkami).
     * @param {string} name - Názov.
     * @returns {string} - URL slug.
     */
    const slugifyName = (name) => {
        if (!name) return '';
        // Používame regulárny výraz / /g na nahradenie všetkých medzier pomlčkami
        return name.replace(/ /g, '-'); 
    };

    /**
     * Prevedie URL slug (s pomlčkami) späť na pôvodný názov (s medzerami).
     * @param {string} slug - URL slug.
     * @returns {string} - Pôvodný názov.
     */
    const deslugifyName = (slug) => {
        if (!slug) return '';
        // Používame regulárny výraz /-/g na nahradenie všetkých pomlčiek medzerami
        return slug.replace(/-/g, ' '); 
    };

    // **Pomocná funkcia: Mapuje globálne dáta na jednotný formát poľa**
    const mapSuperstructureTeams = (globalTeams) => {
        let globalTeamsList = [];
        Object.entries(globalTeams).forEach(([categoryName, teamArray]) => {
             if (Array.isArray(teamArray)) {
                teamArray.forEach(team => {
                    if (team.teamName) {
                        const hasGroup = team.groupName && team.groupName.trim() !== '';

                        globalTeamsList.push({
                            uid: 'global', // UNIKÁTNE ID pre globálne tímy
                            category: categoryName,
                            // UDRŽÍME LOKÁLNU ID GENERÁCIU PRE PRÍPADNÉ CHÝBAJÚCE ID V DB
                            id: team.id || crypto.randomUUID(), 
                            teamName: team.teamName,
                            groupName: team.groupName || null,
                            // FIX 2: Poradie je relevantné len ak má tím skupinu
                            order: hasGroup ? (team.order ?? 0) : null,
                            isSuperstructureTeam: true, // KLASIFIKÁTOR PÔVODU
                        });
                    }
                });
             }
        });
        return globalTeamsList;
    };
    
    // **EFEKT 1: Nastavenie všetkých Firestore Listenerov (beží len raz)**
    useEffect(() => {
        if (!window.db) return; 

        // 1. Tímy od používateľov (Primárne tímy)
        const usersRef = collection(window.db, 'users');
        const userDocs = query(usersRef);
        
        const unsubscribeUsers = onSnapshot(userDocs, (querySnapshot) => {
            let userTeamsList = [];
            querySnapshot.forEach((doc) => {
                const userData = doc.data();
                if (userData && userData.teams) {
                    Object.entries(userData.teams).forEach(([categoryName, teamArray]) => {
                        if (Array.isArray(teamArray)) {
                            teamArray.forEach(team => {
                                if (team.teamName) {
                                    const hasGroup = team.groupName && team.groupName.trim() !== '';

                                    userTeamsList.push({
                                        uid: doc.id,
                                        category: categoryName,
                                        // UDRŽÍME LOKÁLNU ID GENERÁCIU PRE PRÍPADNÉ CHÝBAJÚCE ID V DB
                                        id: team.id || `${doc.id}-${team.teamName}`,
                                        teamName: team.teamName,
                                        groupName: team.groupName || null,
                                        // FIX 2: Poradie je relevantné len ak má tím skupinu
                                        order: hasGroup ? (team.order ?? 0) : null, 
                                        isSuperstructureTeam: false,
                                    });
                                }
                            });
                        }
                    });
                }
            });
            // Uložíme RAW dáta používateľských tímov
            setUserTeamsData(userTeamsList); 
        });

        // 2. Globálne tímy (Superštruktúra)
        const superstructureDocRef = doc(window.db, ...SUPERSTRUCTURE_TEAMS_DOC_PATH.split('/'));
        const unsubscribeSuperstructure = onSnapshot(superstructureDocRef, (docSnap) => {
            let globalTeams = {};
            if (docSnap.exists()) {
                globalTeams = docSnap.data();
            }
            // Uložíme RAW dáta globálnych tímov
            setSuperstructureTeams(globalTeams); 
        });
        
        // 3. Načítanie Kategórií a Skupín
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
            unsubscribeUsers();
            unsubscribeSuperstructure();
            unsubscribeCategories();
            unsubscribeGroups();
        };
    }, []); 

    // **EFEKT 2: Spájanie tímov (beží pri zmene userTeamsData alebo superstructureTeams)**
    useEffect(() => {
        const globalTeamsList = mapSuperstructureTeams(superstructureTeams);
        // Spojíme oba zoznamy do finálneho zoznamu
        setAllTeams([...userTeamsData, ...globalTeamsList]);
    }, [userTeamsData, superstructureTeams]); 

    // NOVÉ: Vytvorenie inverznej mapy pre preklad z URL mena na ID (Reaktívny stav)
    const categoryNameToIdMap = Object.entries(categoryIdToNameMap).reduce((acc, [id, name]) => {
        acc[name] = id;
        return acc;
    }, {});
    
    // --- NOVO UPRAVENÁ LOGIKA SYNCHRONIZÁCIE HASHA (S podorou SLUG/DE-SLUG pre Kategóriu a Skupinu) ---
    
    // Pomocná funkcia na čítanie hashu a nastavenie stavu
    const readHashAndSetState = (map) => {
        const hash = window.location.hash.substring(1);
        
        // Ak ešte nie sú načítané mapy, ale v hashi je hodnota, počkáme
        if (Object.keys(map).length === 0 && hash) {
            // V tomto prípade sa neukončujeme, necháme prebehnúť, ale len ak je prázdny hash
            if (hash) return; // Ak je hash a mapa nie je hotová, čakáme
        } 

        if (hash) {
            const parts = hash.split('/');
            const categorySlugFromUrl = parts[0]; 
            const groupSlugFromUrl = parts[1]; // NOVÉ: Získame slug skupiny

            // 1. KATEGÓRIA: Dekódujeme URL časť a prevedieme slug späť na názov kategórie (s medzerami)
            const categoryNameFromUrl = deslugifyName(decodeURIComponent(categorySlugFromUrl));

            // 2. SKUPINA: Dekódujeme URL časť a prevedieme slug späť na názov skupiny (s medzerami)
            const groupNameFromUrl = groupSlugFromUrl ? deslugifyName(decodeURIComponent(groupSlugFromUrl)) : '';
            
            // 3. Nájdeme ID kategórie podľa pôvodného názvu
            const categoryId = map[categoryNameFromUrl]; 
            
            // Nastavenie ID, ak je nájdené, inak reset
            setSelectedCategoryId(categoryId || '');
            setSelectedGroupName(groupNameFromUrl || ''); // Nastavíme deslugifikovaný názov skupiny
        } else {
            // Reset filtrov, ak je hash prázdny
            setSelectedCategoryId('');
            setSelectedGroupName('');
        }
        
        // KĽÚČOVÁ ZMENA: Ak už mapa bola načítaná a spracovali sme hash (alebo zistili, že je prázdny), nastavíme flag na true
        if (Object.keys(map).length > 0 && !isInitialHashReadComplete) {
            setIsInitialHashReadComplete(true);
        }
    };

    // **LOGIKA 3: Načítanie hashu z URL a Listener pre zmeny**
    useEffect(() => {
        // 1. Inicializácia: Načíta hash po prvom renderi a pri pripravenosti mapy
        readHashAndSetState(categoryNameToIdMap);
        
        // 2. Hashchange Listener: Zabezpečuje obojsmernú synchronizáciu (napr. pri Back/Forward alebo manuálnej zmene)
        const handleHashChange = () => {
            readHashAndSetState(categoryNameToIdMap);
        };

        window.addEventListener('hashchange', handleHashChange);
        
        return () => {
            window.removeEventListener('hashchange', handleHashChange);
        };
    // Pridáme isInitialHashReadComplete do dependencies, aj keď hlavnú prácu robí categoryNameToIdMap
    }, [categoryNameToIdMap, isInitialHashReadComplete]); 

    // **LOGIKA 4: Ukladanie hashu (zápis SLUG kategórie a SLUG skupiny do URL)**
    useEffect(() => {
        
        // KĽÚČOVÁ ZMENA: Zastavíme zápis, kým sa nenačíta mapa a neprebehne prvotné čítanie hashu
        if (!isInitialHashReadComplete) {
            return;
        }
        
        let hash = '';
        
        // Získame NÁZOV kategórie z ID
        const categoryName = categoryIdToNameMap[selectedCategoryId]; 

        if (categoryName) { 
            // 1. KATEGÓRIA: Prevedieme NÁZOV na SLUG (s pomlčkami)
            const categorySlug = slugifyName(categoryName);
            
            // 2. Encódujeme SLUG pre URL
            hash = encodeURIComponent(categorySlug); 
            
            if (selectedGroupName) {
                // 3. SKUPINA: Prevedieme NÁZOV SKUPINY na SLUG
                const groupSlug = slugifyName(selectedGroupName); 
                // 4. Encódujeme SLUG SKUPINY a pripojíme
                hash += `/${encodeURIComponent(groupSlug)}`;
            }
        }
        
        // Prečítame aktuálny hash v URL pre kontrolu pretekárskeho stavu/ slučky
        const currentHash = window.location.hash.substring(1); 

        // Zabránenie nekonečnej slučke: nastavujeme hash len ak sa líši od aktuálneho
        if (currentHash !== hash) {
            // Používame replace() namiesto priradenia, aby sme nezaplnili históriu prehliadača
            window.location.replace(`#${hash}`); 
        }

    }, [selectedCategoryId, selectedGroupName, categoryIdToNameMap, isInitialHashReadComplete]); // Pridanie isInitialHashReadComplete
    // --- KONIEC NOVEJ LOGIKY SYNCHRONIZÁCIE HASHA ---

    // --- OPRAVA: FUNKCIE PRE SELECT BOXY (Priamy zápis do URL hash) ---
    
    const handleCategorySelect = (e) => {
        const newCategoryId = e.target.value;
        const categoryName = categoryIdToNameMap[newCategoryId];

//        console.log("Kategória zmenená (Priama zmena HASH). Nové ID:", newCategoryId); 
        
        // Ak je vybraná kategória (nie 'Všetky kategórie')
        if (categoryName) {
            const categorySlug = slugifyName(categoryName);
            const newHash = `#${encodeURIComponent(categorySlug)}`;
            
            // Priamo prepíšeme hash. LOGIKA 3 následne prečíta hash a nastaví stav.
            window.location.replace(newHash); 
        } else {
             // Reset hashu, ak je vybraná prázdna hodnota
             window.location.replace(`#`); 
        }
        
        // NEvoláme setSelectedCategoryId, aby sme sa vyhli zbytočnej zmene stavu/race condition
    };

    const handleGroupSelect = (e) => {
        const newGroupName = e.target.value;
        const categoryName = categoryIdToNameMap[selectedCategoryId];
        
//        console.log("Skupina zmenená (Priama zmena HASH). Nový názov:", newGroupName); 
        
        if (categoryName) {
            const categorySlug = slugifyName(categoryName);
            let newHash = `#${encodeURIComponent(categorySlug)}`;
            
            if (newGroupName) {
                const groupSlug = slugifyName(newGroupName);
                newHash += `/${encodeURIComponent(groupSlug)}`;
            }
            
            // Priamo prepíšeme hash. LOGIKA 3 následne prečíta hash a nastaví stav.
            window.location.replace(newHash); 
        } 
        
        // NEvoláme setSelectedGroupName, aby sme sa vyhli zbytočnej zmene stavu/race condition
    };

    // --- KONIEC OPRAVENÝCH FUNKCIÍ PRE SELECT BOXY ---


    // --- FUNKCIA: Uloženie nového Tímu do /settings/superstructureGroups ---
    const handleAddNewTeam = async ({ categoryId, groupName, teamName }) => {
        if (!window.db) {
            setNotification({ id: Date.now(), message: "Firestore nie je inicializovaný.", type: 'error' });
            return;
        }

        const categoryName = categoryIdToNameMap[categoryId];
        const superstructureDocRef = doc(window.db, ...SUPERSTRUCTURE_TEAMS_DOC_PATH.split('/'));
        
        // ** NOVÁ LOGIKA: Formátovanie názvu tímu **
        const finalTeamName = `${categoryName} ${teamName}`;

        // Kontrola duplikátu pri finálnom ukladaní pre istotu (aj keď je kontrolované v modále)
        const isDuplicateFinal = allTeams.some(team => team.teamName === finalTeamName);
        if (isDuplicateFinal) {
             setNotification({ id: Date.now(), message: `Globálny tím '${finalTeamName}' už existuje. Ukladanie zrušené.`, type: 'error' });
             setIsModalOpen(false);
             return;
        }

        try {
            const docSnap = await getDoc(superstructureDocRef);
            const globalTeamsData = docSnap.exists() ? docSnap.data() : {};
            const currentTeamsForCategory = globalTeamsData[categoryName] || [];

            const teamsInTargetGroup = currentTeamsForCategory.filter(t => 
                t.groupName === groupName
            );
            
            let maxOrder = 0;
            teamsInTargetGroup.forEach(t => {
                if (t.order > maxOrder) {
                    maxOrder = t.order;
                }
            });
            
            // Nový tím je vždy s najvyšším poradím, ak má skupinu
            const newOrder = groupName ? (maxOrder + 1) : null; 
            
            const newTeam = {
                teamName: finalTeamName, // Použijeme formátovaný názov
                groupName: groupName || null,
                order: newOrder,
                id: crypto.randomUUID()
            };
            
            const updatedTeamsArray = [...currentTeamsForCategory, newTeam];
            
            await setDoc(superstructureDocRef, {
                ...globalTeamsData,
                [categoryName]: updatedTeamsArray
            });
            
            setIsModalOpen(false);
            setNotification({ 
                id: Date.now(), 
                message: `Globálny tím '${finalTeamName}' bol úspešne pridaný. (Cesta: ${SUPERSTRUCTURE_TEAMS_DOC_PATH})`, 
                type: 'success' 
            });

        } catch (error) {
            console.error("Chyba pri pridávaní nového globálneho tímu:", error);
            setNotification({ id: Date.now(), message: "Chyba pri ukladaní nového tímu do globálneho dokumentu.", type: 'error' });
        }
    };
    // --- KONIEC FUNKCIE PRE GLOBÁLNE UKLADANIE ---
    
    // Filtrovanie pre zobrazenie (zostáva bezo zmeny)
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

    const checkCategoryMatch = (targetCategoryId) => {
        const dragData = draggedItem.current;
        if (!dragData) return false;

        const teamCategoryName = dragData.team.category; 
        const targetCategoryName = categoryIdToNameMap[targetCategoryId];

        if (targetCategoryName && teamCategoryName && targetCategoryName !== teamCategoryName) {
            return false;
        }
        return true;
    }
    
    const handleDragOverTeam = (e, targetGroup, targetCategoryId, index) => {
        e.preventDefault();
        
        if (!checkCategoryMatch(targetCategoryId)) {
            e.dataTransfer.dropEffect = "none";
            e.currentTarget.style.cursor = 'not-allowed';
            setDropTarget({ groupId: null, categoryId: null, index: null });
            return;
        }

        e.dataTransfer.dropEffect = "move";
        e.currentTarget.style.cursor = 'move';
        e.stopPropagation(); 
        
        const rect = e.currentTarget.getBoundingClientRect();
        const isOverTopHalf = e.clientY - rect.top < rect.height / 2;
        
        let insertionIndex = isOverTopHalf ? index : index + 1;
        
        setDropTarget({
            groupId: targetGroup,
            categoryId: targetCategoryId,
            index: insertionIndex
        });
    };

    const getInsertionIndexInGap = (e, teamElements, sortedTeams) => {
        if (teamElements.length === 0) return 0;
        
        const firstRect = teamElements[0].getBoundingClientRect();
        if (e.clientY < firstRect.top) { 
            return 0;
        }

        for (let i = 0; i < teamElements.length; i++) {
            const teamEl = teamElements[i];
            const rect = teamEl.getBoundingClientRect();
            
            if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
                return -1; 
            }
            
            if (i < teamElements.length - 1) {
                const nextRect = teamElements[i + 1];
                const nextRectBounds = nextRect.getBoundingClientRect();
                
                const gapStart = rect.bottom + 2; 
                const gapEnd = nextRectBounds.top - 2; 
                
                if (e.clientY > gapStart && e.clientY < gapEnd) {
                     return i + 1;
                }
            } else {
                if (e.clientY > rect.bottom) {
                    return sortedTeams.length;
                }
            }
        }
        
        return -1; 
    }

    const handleDragOverEnd = (e, targetGroup, targetCategoryId, sortedTeams) => {
        e.preventDefault();
        
        if (!checkCategoryMatch(targetCategoryId)) {
            e.dataTransfer.dropEffect = "none";
            e.currentTarget.style.cursor = 'not-allowed';
            setDropTarget({ groupId: null, categoryId: null, index: null });
            return;
        }
        
        e.dataTransfer.dropEffect = "move";
        e.currentTarget.style.cursor = 'move';
        
        // Ak targetGroup je null (bez skupiny), použijeme špeciálnu referenciu
        const listRefKey = targetGroup === null 
            ? `${targetCategoryId}-null` 
            : `${targetCategoryId}-${targetGroup}`;
            
        const containerRef = listRefs.current[listRefKey];
        if (!containerRef) return;

        const teamElements = Array.from(containerRef.children).filter(el => el.tagName === 'LI');
        
        let insertionIndex = getInsertionIndexInGap(e, teamElements, sortedTeams);
        
        if (insertionIndex === -1) {
            insertionIndex = sortedTeams.length;
        }

        setDropTarget({
            groupId: targetGroup,
            categoryId: targetCategoryId,
            index: insertionIndex
        });
    };

    const handleDragOverEmptyContainer = (e, targetGroup, targetCategoryId) => {
        e.preventDefault();
        
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
        
        e.dataTransfer.dropEffect = "move";
        e.currentTarget.style.cursor = 'move';
        
        setDropTarget({
            groupId: targetGroup,
            categoryId: targetCategoryId,
            index: 0
        });
    };
    
    // --- OPRAVENÁ FUNKCIA handleDrop (Oprava vyhľadávania tímu podľa teamName) ---
    const handleDrop = async (e, targetGroup, targetCategoryId) => {
        e.preventDefault();
        const dragData = draggedItem.current;
        const finalDropTarget = dropTarget; 

        if (!checkCategoryMatch(targetCategoryId)) {
            setNotification({ id: Date.now(), message: "Skupina nepatrí do rovnakej kategórie ako tím. Presun bol zrušený.", type: 'error' });
            setDropTarget({ groupId: null, categoryId: null, index: null });
            draggedItem.current = null;
            return;
        }

        setDropTarget({ groupId: null, categoryId: null, index: null });
        
        if (!dragData || (finalDropTarget.index === null || finalDropTarget.index === undefined)) {
            console.error("Žiadne dáta na presunutie alebo neplatný cieľový index.");
            return;
        }

        const teamData = dragData.team;
        const originalGroup = teamData.groupName;
        const originalOrder = teamData.order; 
        const teamCategoryName = teamData.category; 
        
        // Ak je targetGroup null (presun do zoznamu bez skupiny), newOrder je null.
        const newOrder = targetGroup ? (finalDropTarget.index + 1) : null;
        
        // Vynútené nastavenie null hodnôt, ak je cieľ 'Bez skupiny'
        const finalGroupName = targetGroup === null ? null : targetGroup;
        const finalOrder = targetGroup === null ? null : newOrder; 
        
        const originalGroupDisplay = originalGroup ? `'${originalGroup}'` : `'bez skupiny'`;
        const targetGroupDisplay = finalGroupName ? `'${finalGroupName}' na pozíciu ${finalOrder}.` : `'bez skupiny'.`;

        try {
            if (teamData.isSuperstructureTeam) {
                // --- UPDATE GLOBÁLNEHO DOKUMENTU (/settings/superstructureGroups) ---
                const superstructureDocRef = doc(window.db, ...SUPERSTRUCTURE_TEAMS_DOC_PATH.split('/'));
                const docSnap = await getDoc(superstructureDocRef);
                const globalTeamsData = docSnap.exists() ? docSnap.data() : {};
                
                let teams = globalTeamsData[teamCategoryName] || [];
                
                // OPRAVA: Nájdeme tím podľa teamName, nie podľa lokálneho ID
                const originalTeamIndex = teams.findIndex(t => t.teamName === teamData.teamName);
                
                if (originalTeamIndex === -1) {
                    setNotification({ id: Date.now(), message: `Chyba: Presúvaný globálny tím (${teamData.teamName}) sa nenašiel v cieľovej kategórii.`, type: 'error' });
                    return;
                }
                
                // 1. Vytvoríme aktualizovaný tím s novými hodnotami (null alebo Group/Order)
                const updatedDraggedTeam = { 
                    ...teams[originalTeamIndex], 
                    groupName: finalGroupName, 
                    order: finalOrder 
                };

                // 2. Odstránime tím z pôvodnej pozície (pre reordering ostatných)
                // Musíme použiť slice/splice na kópiu, ak by sme teams použili priamo z doc.data()
                teams = [...teams];
                teams.splice(originalTeamIndex, 1);
                
                // 3. Spustíme reordering logiku na ostatných tímoch
                const reorderedTeams = teams.map(t => {
                    const t_is_in_original_group = t.groupName === originalGroup && t.order != null;
                    const t_is_in_target_group = t.groupName === targetGroup && t.order != null;

                    // Ak tím zostal v PÔVODNEJ skupine a má vyššie poradie, posunieme ho hore (-1)
                    if (originalGroup !== null && originalGroup !== finalGroupName && t_is_in_original_group && t.order > originalOrder) {
                        return { ...t, order: t.order - 1 };
                    }
                    
                    // Ak tím je v CIEĽOVEJ skupine a má vyššie alebo rovnaké poradie ako vkladaný tím, posunieme ho dole (+1)
                    if (targetGroup !== null && targetGroup === t.groupName && t_is_in_target_group && finalOrder !== null && t.order >= finalOrder) {
                        return { ...t, order: t.order + 1 };
                    }
                    
                    // Ak presúvame v rámci rovnakej skupiny (len zmena poradia)
                    if (originalGroup === finalGroupName && originalGroup !== null && t_is_in_target_group) {
                        if (finalOrder > originalOrder && t.order > originalOrder && t.order < finalOrder) { 
                             return { ...t, order: t.order - 1 };
                        } else if (finalOrder < originalOrder && t.order >= finalOrder && t.order < originalOrder) {
                             return { ...t, order: t.order + 1 };
                        }
                    }

                    return t;
                });
                
                // 4. Vložíme presunutý tím naspäť na správnu pozíciu
                if (finalGroupName !== null) {
                    // Vložíme na pozíciu finalOrder - 1 (pretože poradie 1 je index 0)
                    reorderedTeams.splice(finalOrder - 1, 0, updatedDraggedTeam);
                } else {
                    // Ak je bez skupiny, vložíme ho na koniec (order je null, takže sa zaradí podľa názvu)
                    reorderedTeams.push(updatedDraggedTeam); 
                }
                
                // 5. Zápis do databázy
                await setDoc(superstructureDocRef, {
                    ...globalTeamsData,
                    [teamCategoryName]: reorderedTeams
                });


            } else {
                // --- UPDATE UŽÍVATEĽSKÉHO DOKUMENTU (Zameranie iba na dokument vlastníka) ---
                const ownerUid = teamData.uid;
                const ownerDocRef = doc(window.db, 'users', ownerUid);

                // 1. Získanie aktuálnych dát vlastníka
                const docSnap = await getDoc(ownerDocRef);
                if (!docSnap.exists() || !docSnap.data().teams || !docSnap.data().teams[teamCategoryName]) {
                    setNotification({ id: Date.now(), message: `Chyba: Dokument vlastníka tímu (${ownerUid}) alebo pole tímov v kategórii ${teamCategoryName} nenájdené.`, type: 'error' });
                    return;
                }
                
                const ownerTeamsData = docSnap.data().teams;
                // Musíme urobiť kópiu pre manipuláciu
                let teams = [...ownerTeamsData[teamCategoryName]]; 
                
                // OPRAVA: Nájdeme tím podľa teamName, nie podľa lokálneho ID
                const originalTeamIndex = teams.findIndex(t => t.teamName === teamData.teamName);

                if (originalTeamIndex === -1) {
                    setNotification({ id: Date.now(), message: `Chyba: Presúvaný používateľský tím (${teamData.teamName}) sa nenašiel v dokumente vlastníka.`, type: 'error' });
                    return;
                }

                // 1. Vytvoríme aktualizovaný tím s novými hodnotami (null alebo Group/Order)
                const updatedDraggedTeam = { 
                    ...teams[originalTeamIndex], 
                    groupName: finalGroupName, // Použijeme finalGroupName (môže byť null)
                    order: finalOrder // Použijeme finalOrder (môže byť null)
                };
                
                // 2. Odstránime tím z pôvodnej pozície (pre reordering ostatných)
                teams.splice(originalTeamIndex, 1);
                
                // 3. Spustíme reordering logiku na ostatných tímoch
                const reorderedTeams = teams.map(t => {
                    const t_is_in_original_group = t.groupName === originalGroup && t.order != null;
                    const t_is_in_target_group = t.groupName === targetGroup && t.order != null;

                    // Ak tím zostal v PÔVODNEJ skupine a má vyššie poradie, posunieme ho hore (-1)
                    if (originalGroup !== null && originalGroup !== finalGroupName && t_is_in_original_group && t.order > originalOrder) {
                        return { ...t, order: t.order - 1 };
                    }
                    
                    // Ak tím je v CIEĽOVEJ skupine a má vyššie alebo rovnaké poradie ako vkladaný tím, posunieme ho dole (+1)
                    if (targetGroup !== null && targetGroup === t.groupName && t_is_in_target_group && finalOrder !== null && t.order >= finalOrder) {
                        return { ...t, order: t.order + 1 };
                    }
                    
                    // Ak presúvame v rámci rovnakej skupiny (len zmena poradia)
                    if (originalGroup === finalGroupName && originalGroup !== null && t_is_in_target_group) {
                        if (finalOrder > originalOrder && t.order > originalOrder && t.order < finalOrder) { 
                             return { ...t, order: t.order - 1 };
                        } else if (finalOrder < originalOrder && t.order >= finalOrder && t.order < originalOrder) {
                             return { ...t, order: t.order + 1 };
                        }
                    }
                    
                    return t;
                });
                
                // 4. Vložíme presunutý tím naspäť na správnu pozíciu
                if (finalGroupName !== null) {
                    // Vložíme na pozíciu finalOrder - 1 (pretože poradie 1 je index 0)
                    reorderedTeams.splice(finalOrder - 1, 0, updatedDraggedTeam);
                } else {
                    // Ak je bez skupiny, vložíme ho na koniec
                    reorderedTeams.push(updatedDraggedTeam); 
                }
                
                // 5. Zápis do databázy
                await updateDoc(ownerDocRef, {
                    [`teams.${teamCategoryName}`]: reorderedTeams
                });
            }
            
            // Oznámenie o úspechu s pridaním cieľovej cesty pre overenie
            const targetDocPath = teamData.isSuperstructureTeam 
                ? SUPERSTRUCTURE_TEAMS_DOC_PATH 
                : `users/${teamData.uid}`;

            const notificationMessage = `Tím ${teamData.teamName} bol presunutý z ${originalGroupDisplay} do skupiny ${targetGroupDisplay} (Dokument: ${targetDocPath}).`;
            setNotification({ id: Date.now(), message: notificationMessage, type: 'success' });

        } catch (error) {
            console.error("Chyba pri aktualizácii databázy:", error);
            // Zabezpečenie, že notifikácia chyby sa zobrazí, ak k nej došlo
            if (!notification || notification.type !== 'error') {
                 setNotification({ id: Date.now(), message: "Nastala chyba pri ukladaní údajov do databázy.", type: 'error' });
            }
        }
    };
    // --- KONIEC OPRAVENEJ FUNKCIE handleDrop ---

    const handleDragStart = (e, team) => {
        draggedItem.current = { team };
        e.dataTransfer.setData("text/plain", JSON.stringify(team));
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragEnd = () => {
        draggedItem.current = null;
        setDropTarget({ groupId: null, categoryId: null, index: null });
    };

    const renderTeamList = (teamsToRender, targetGroupId, targetCategoryId, isWithoutGroup = false) => {
        const sortedTeams = [...teamsToRender].sort((a, b) => {
            if (!isWithoutGroup) {
                // Pre tímy v skupine triedime podľa 'order'
                return (a.order || 0) - (b.order || 0);
            } else {
                // Pre tímy bez skupiny triedime len podľa názvu
                return a.category.localeCompare(b.category) || a.teamName.localeCompare(b.teamName);
            }
        });
        
        const listItems = sortedTeams.map((team, index) => {
            let teamNameDisplay = team.teamName;
            const teamBgClass = !isWithoutGroup ? (team.isSuperstructureTeam ? 'bg-yellow-50' : 'bg-white') : 'bg-gray-100';
            
            if (!isWithoutGroup && team.order != null) {
                teamNameDisplay = `${team.order}. ${team.teamName}`;
            }

            if (!selectedCategoryId && team.category && (isWithoutGroup || team.groupName)) {
                const globalTag = team.isSuperstructureTeam ? ' ' : ''; 
                // V globálnom zobrazení už nezobrazujeme kategóriu, pretože názov ju už obsahuje
                teamNameDisplay = `${teamNameDisplay}${globalTag}`;
            } else if (team.isSuperstructureTeam) {
                teamNameDisplay = `${teamNameDisplay} `;
            }
            
            const isDropIndicatorVisible = 
                dropTarget.groupId === targetGroupId && 
                dropTarget.categoryId === targetCategoryId && 
                dropTarget.index === index;

            return React.createElement(
                React.Fragment, 
                { key: team.id || `${team.uid}-${team.teamName}-${team.groupName}-${index}` },
                isDropIndicatorVisible && React.createElement('div', { className: 'drop-indicator h-1 bg-blue-500 rounded-full my-1 transition-all duration-100' }),
                React.createElement(
                    'li',
                    {
                        className: `px-4 py-2 ${teamBgClass} rounded-lg text-gray-700 cursor-grab shadow-sm border border-gray-200`,
                        draggable: "true",
                        onDragStart: (e) => handleDragStart(e, team),
                        onDragEnd: handleDragEnd,
                        onDragOver: (e) => handleDragOverTeam(e, targetGroupId, targetCategoryId, index),
                    },
                    teamNameDisplay
                )
            );
        });

        const isDropIndicatorVisibleAtEnd = 
            dropTarget.groupId === targetGroupId && 
            dropTarget.categoryId === targetCategoryId && 
            dropTarget.index === sortedTeams.length; 
            
        // Kľúč pre referenciu (dôležité pre správne fungovanie dropu na prázdny priestor)
        const listRefKey = targetGroupId === null 
            ? `${targetCategoryId}-null` 
            : `${targetCategoryId}-${targetGroupId}`;
            
        if (sortedTeams.length === 0) {
            const isDropOnEmptyContainer = 
                dropTarget.groupId === targetGroupId && 
                dropTarget.categoryId === targetCategoryId && 
                dropTarget.index === 0;

            return React.createElement(
                'div',
                {
                    onDragOver: (e) => handleDragOverEmptyContainer(e, targetGroupId, targetCategoryId),
                    onDrop: (e) => handleDrop(e, targetGroupId, targetCategoryId),
                    className: `min-h-[50px] p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center relative ${isDropOnEmptyContainer ? 'border-blue-500 bg-blue-50' : ''}`,
                    // Pridanie referencie aj pre prázdny kontajner
                    ref: el => {
                        if (el) {
                            listRefs.current[listRefKey] = el;
                        } else {
                            delete listRefs.current[listRefKey];
                        }
                    },
                },
                React.createElement('p', { className: 'text-center text-gray-400' }, 'Sem presuňte tím')
            );
        }

        return React.createElement(
            'ul',
            { 
                ref: el => {
                    if (el) {
                        listRefs.current[listRefKey] = el;
                    } else {
                        delete listRefs.current[listRefKey];
                    }
                },
                className: 'space-y-2 relative',
                onDragOver: (e) => handleDragOverEnd(e, targetGroupId, targetCategoryId, sortedTeams),
                onDrop: (e) => handleDrop(e, targetGroupId, targetCategoryId),
            },
            ...listItems,
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
                                },
                                React.createElement(
                                    'div',
                                    null,
                                    React.createElement('p', { className: 'font-semibold whitespace-nowrap' }, group.name),
                                    // TYP SKUPINY (UŽ BOL)
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
        
        if (selectedGroupName) {
            groups = groups.filter(g => g.name === selectedGroupName);
        }

        const sortedGroups = [...groups].sort((a, b) => {
            if (a.type === 'základná skupina' && b.type !== 'základná skupina') return -1;
            if (b.type === 'základná skupina' && a.type !== 'základná skupina') return 1;
            return a.name.localeCompare(b.name);
        });
        
        const teamsWithoutGroupHeight = teamsWithoutGroupRef.current 
            ? teamsWithoutGroupRef.offsetHeight 
            : null;

        return React.createElement(
            'div',
            { className: 'flex flex-col lg:flex-row justify-center space-x-0 lg:space-x-4 w-full px-4' },
            React.createElement(
                'div',
                {
                    ref: teamsWithoutGroupRef,
                    className: "w-full lg:w-1/4 max-w-sm bg-white rounded-xl shadow-xl p-8 mb-6 flex-shrink-0",
                },
                React.createElement('h3', { className: 'text-2xl font-semibold mb-4 text-center' }, `Tímy bez skupiny v kategórii: ${categoryName}`),
                // TargetGroupId je nastavené na null pre nezaradené tímy
                renderTeamList(teamsWithoutGroup, null, selectedCategoryId, true) 
            ),
            React.createElement(
                'div',
                { className: 'flex-grow min-w-0 flex flex-col gap-4' },
                sortedGroups.length > 0 ? (
                    sortedGroups.map((group, groupIndex) => {
                        let customStyle = {};
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
                                style: customStyle,
                            },
                            React.createElement('h3', { className: 'text-2xl font-semibold mb-2 text-center whitespace-nowrap' }, group.name),
                            // NOVÝ TYP SKUPINY PRE SINGLE VIEW A FILTROVANÝ VIEW
                            React.createElement('p', { className: 'text-center text-sm text-gray-600 mb-4' }, group.type), 
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

    const sortedCategoryEntries = Object.entries(categoryIdToNameMap)
        .sort(([, nameA], [, nameB]) => nameA.localeCompare(nameB));
    
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
    
    // Získame všetky dostupné skupiny pre zvolenú kategóriu na zobrazenie vo filtri
    const availableGroupsForSelect = (allGroupsByCategoryId[selectedCategoryId] || [])
        .sort((a, b) => a.name.localeCompare(b.name));

    return React.createElement(
        'div',
        { className: 'flex flex-col w-full relative' },
        // Lokálna notifikácia
        React.createElement(
            'div',
            { className: `${notificationClasses} ${typeClasses}`},
            notification?.message
        ),
        
        // Modálne okno - odovzdáme selectedCategoryId ako defaultCategoryId a selectedGroupName ako defaultGroupName
        React.createElement(NewTeamModal, {
            isOpen: isModalOpen,
            onClose: () => setIsModalOpen(false),
            allGroupsByCategoryId: allGroupsByCategoryId,
            categoryIdToNameMap: categoryIdToNameMap,
            handleSave: handleAddNewTeam,
            defaultCategoryId: selectedCategoryId, // Existujúca prop
            defaultGroupName: selectedGroupName, // NOVÁ prop
            allTeams: allTeams // NOVÁ prop pre kontrolu duplikátov
        }),

        React.createElement(
            'div',
            { className: 'w-full max-w-xs mx-auto mb-8' },
            React.createElement('label', { className: 'block text-center text-xl font-semibold mb-2' }, 'Vyberte kategóriu:'),
            React.createElement(
                'select',
                {
                    className: 'w-full px-4 py-2 rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200',
                    value: selectedCategoryId,
                    // POUŽITIE NOVÉHO HANDLERA (priamy zápis HASH)
                    onChange: handleCategorySelect
                },
                React.createElement('option', { value: '' }, 'Všetky kategórie'),
                sortedCategoryEntries.map(([id, name]) =>
                    React.createElement('option', { key: id, value: id }, name)
                )
            ),

            React.createElement('label', { className: 'block text-center text-xl font-semibold mb-2 mt-4' }, 'Vyberte skupinu (Voliteľné):'),
            React.createElement(
                'select',
                {
                    className: `w-full px-4 py-2 rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200 ${!selectedCategoryId ? 'opacity-50' : ''}`,
                    value: selectedGroupName,
                    // POUŽITIE NOVÉHO HANDLERA (priamy zápis HASH)
                    onChange: handleGroupSelect,
                    disabled: !selectedCategoryId,
                    style: { cursor: !selectedCategoryId ? 'not-allowed' : 'pointer' } 
                },
                React.createElement('option', { value: '' }, 'Zobraziť všetky skupiny'),
                availableGroupsForSelect.map((group, index) =>
                    // ZOBRAZENIE: Pridaný typ skupiny do <option>
                    React.createElement('option', { key: index, value: group.name }, `${group.name} (${group.type})`)
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

// Inicializácia aplikácie (štandardný kód)
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
