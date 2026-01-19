import { doc, getDoc, onSnapshot, updateDoc, collection, Timestamp, query, getDocs, setDoc, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
// Referencia na globálny konfiguračný dokument pre nadstavbové tímy
const SUPERSTRUCTURE_TEAMS_DOC_PATH = 'settings/superstructureGroups';
// --- Komponent Modálne Okno pre Pridanie/Editáciu Tímu ---
// Zjednotený Modál pre pridávanie (Add) a úpravu (Edit)

const handleUpdateTeam = async ({ categoryId, groupName, teamName, order, originalTeam }) => {
    if (!window.db || !originalTeam?.isSuperstructureTeam) return;

    const newCategoryName = categoryIdToNameMap[categoryId];
    if (!newCategoryName) return;

    const finalTeamName = `${newCategoryName} ${teamName.trim()}`;
    const superstructureDocRef = doc(window.db, ...SUPERSTRUCTURE_TEAMS_DOC_PATH.split('/'));

    try {
        const docSnap = await getDoc(superstructureDocRef);
        if (!docSnap.exists()) return;
        const data = docSnap.data() || {};

        const oldCategory = originalTeam.category;
        let oldTeams = [...(data[oldCategory] || [])];

        // Nájdeme a odstránime starý tím
        const idx = oldTeams.findIndex(t => t.id === originalTeam.id);
        if (idx === -1) {
            setNotification({ message: "Pôvodný tím sa nenašiel", type: 'error' });
            return;
        }
        oldTeams.splice(idx, 1);

        const categoryChanged = oldCategory !== newCategoryName;

        // Cieľové pole
        let targetTeams = categoryChanged 
            ? [...(data[newCategoryName] || [])] 
            : oldTeams;

        // Logika poradia (rovnaká ako máš, len na targetTeams)
        let newOrder = null;
        const newGroup = groupName || null;
        if (newGroup) {
            const inGroup = targetTeams.filter(t => t.groupName === newGroup);
            const max = inGroup.reduce((m, t) => Math.max(m, t.order || 0), 0);
            
            if (!categoryChanged && originalTeam.groupName === newGroup) {
                newOrder = originalTeam.order ?? max + 1;
            } else {
                newOrder = max + 1;
            }

            if (order !== undefined && order !== null && !isNaN(order)) {
                newOrder = parseInt(order, 10);
            }
        }

        const updatedTeam = {
            id: originalTeam.id,
            teamName: finalTeamName,
            groupName: newGroup,
            order: newOrder,
        };

        targetTeams.push(updatedTeam);

        // Pripravíme update payload
        const updatePayload = { [oldCategory]: oldTeams };
        if (categoryChanged) {
            updatePayload[newCategoryName] = targetTeams;
        } else {
            updatePayload[oldCategory] = targetTeams;
        }

        await updateDoc(superstructureDocRef, updatePayload);

        setNotification({
            message: `Tím aktualizovaný${categoryChanged ? ` (presunutý do ${newCategoryName})` : ''}`,
            type: 'success'
        });
    } catch (err) {
        console.error(err);
        setNotification({ message: "Chyba pri aktualizácii", type: 'error' });
    }
};

const NewTeamModal = ({
    isOpen,
    onClose,
    teamToEdit,
    allTeams = [],
    categoryIdToNameMap = {},
    allGroupsByCategoryId = {},
    defaultCategoryId = '',
    defaultGroupName = '',
    unifiedSaveHandler
}) => {
        
    const { useState, useEffect, useRef } = React;

    const [orderInputValue, setOrderInputValue] = useState(null);

    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedGroup, setSelectedGroup] = useState('');
    const [teamName, setTeamName] = useState('');
    const [isDuplicate, setIsDuplicate] = useState(false);
    // Nové stavy na uchovanie pôvodných hodnôt pre Edit mód a kontrolu duplikátov
    const [originalTeamName, setOriginalTeamName] = useState('');
    const [originalCategory, setOriginalCategory] = useState('');
    const [originalGroup, setOriginalGroup] = useState('');
        
    // Automatické nastavenie poradia pri zmene skupiny alebo otvorení modálu
    useEffect(() => {
        if (!isOpen || !selectedGroup) {
            setOrderInputValue(null);
            return;
        }
    
        // Ak editujeme tím, ktorý už má order → prednastavíme ho
        if (teamToEdit && teamToEdit.groupName === selectedGroup && teamToEdit.order != null) {
            setOrderInputValue(teamToEdit.order);
            return;
        }
    
        // Inak navrhneme poradie na konci aktuálnej skupiny
        const teamsInGroup = allTeams.filter(
            t => t.category === categoryIdToNameMap[selectedCategory] && t.groupName === selectedGroup
        );
        const maxOrder = teamsInGroup.reduce((max, t) => Math.max(max, t.order || 0), 0);
        setOrderInputValue(maxOrder + 1);
    }, [selectedGroup, isOpen, teamToEdit, allTeams, selectedCategory, categoryIdToNameMap]);
    
    // Nastavenie/reset stavu pri otvorení/zatvorení modálu alebo zmene predvolených hodnôt
    useEffect(() => {
        if (isOpen) {
            if (teamToEdit) {
                // --- EDIT MÓD ---
                const categoryId = Object.keys(categoryIdToNameMap).find(id => categoryIdToNameMap[id] === teamToEdit.category) || '';
                setSelectedCategory(categoryId);
               
                // Názov tímu bez prefixu kategórie
                const teamNameWithoutPrefix = teamToEdit.teamName.replace(new RegExp(`^${teamToEdit.category} `), '');
                setTeamName(teamNameWithoutPrefix);
                setSelectedGroup(teamToEdit.groupName || '');
               
                // Uloženie originálnych hodnôt pre logiku duplikátov/kontroly zmien
                setOriginalTeamName(teamToEdit.teamName);
                setOriginalCategory(categoryId);
                setOriginalGroup(teamToEdit.groupName || '');
               
            } else {
                // --- ADD MÓD ---
                setSelectedCategory(defaultCategoryId || '');
                setSelectedGroup(defaultGroupName || '');
                setTeamName('');
                setOriginalTeamName('');
                setOriginalCategory('');
                setOriginalGroup('');
            }
        } else {
             // Reset stavu pri zatvorení
             setSelectedCategory('');
             setSelectedGroup('');
             setTeamName('');
             setIsDuplicate(false);
             setOriginalTeamName('');
             setOriginalCategory('');
             setOriginalGroup('');
        }
    }, [isOpen, teamToEdit, defaultCategoryId, defaultGroupName, categoryIdToNameMap]);
    // EFEKT: Kontrola duplicitného názvu tímu (upravená pre edit mód)
    useEffect(() => {
        if (!isOpen) return;
        const name = teamName.trim();
        const categoryName = categoryIdToNameMap[selectedCategory] || '';
        if (name && selectedCategory && categoryName) {
            const finalName = `${categoryName} ${name}`;
           
            // Kontrola duplikátu: V edit móde ignorujeme duplikát, ak je to pôvodný názov tímu, ktorý upravujeme
            const duplicate = allTeams.some(team =>
                team.teamName === finalName && (!teamToEdit || team.teamName !== originalTeamName)
            );
            setIsDuplicate(duplicate);
        } else {
            setIsDuplicate(false);
        }
    }, [teamName, selectedCategory, allTeams, isOpen, categoryIdToNameMap, teamToEdit, originalTeamName]);
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
       
        if (isSubmitDisabled) {
            return;
        }
        unifiedSaveHandler({
            categoryId: selectedCategory,
            groupName: selectedGroup,
            teamName: teamName,              // stále posielame, ale už sa nepoužíva na zmenu
            order: orderInputValue,          // ← NOVÉ
            isEdit: !!teamToEdit,
            originalTeam: teamToEdit
        });
    };
   
    // LOGIKA BLOKOVANIA TLAČIDLA:
    const isCategoryValid = !!selectedCategory;
    const isGroupValid = !!selectedGroup; // KONTROLA SKUPINY (MUSÍ BYŤ VYBRANÁ)
    const isTeamNameValid = teamName.trim().length > 0;
   
    const isSubmitDisabled = !isCategoryValid || !isGroupValid || !isTeamNameValid || isDuplicate;
    if (!isOpen) return null;
   
    // Zistíme, či je pole kategórie disabled
    const isCategoryFixed = !!defaultCategoryId && !teamToEdit; // Len ak pridávame a filter je aktívny
    // NOVÉ: Zistíme, či je pole skupiny disabled
    const isGroupFixed = !!defaultGroupName && !teamToEdit;
   
    // EDIT MÓD nastaví pole kategórie na disabled, aby sa tím nepresúval medzi kategóriami
    const isCategoryDisabledInEdit = !!teamToEdit && !teamToEdit.isSuperstructureTeam;
   
    const modalTitle = teamToEdit ? 'Upraviť Globálny Tím' : 'Pridať Nový Tím';
    const buttonText = teamToEdit ? 'Potvrdiť a Aktualizovať Tím' : 'Potvrdiť a Uložiť Tím';
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
            // Nadpis s názvom tímu (statický)
            React.createElement(
                'h2',
                { className: 'text-2xl font-bold text-gray-800 mb-2' },
                teamToEdit ? 'Upraviť tím' : 'Pridať nový tím'
            ),
            React.createElement(
                'div',
                { className: 'text-xl font-semibold text-indigo-700 mb-6' },
                teamToEdit ? teamToEdit.teamName : 'Nový tím'
            ),
    
            React.createElement(
                'form',
                { onSubmit: handleSubmit, className: 'space-y-6' },
    
                // 1. Kategória (zostáva rovnaká)
                React.createElement(
                    'div',
                    { className: 'flex flex-col' },
                    React.createElement('label', { className: 'text-sm font-medium text-gray-700 mb-1' }, 'Kategória:'),
                    React.createElement(
                        'select',
                        {
                            className: `p-3 border rounded-lg focus:ring-indigo-500 focus:border-indigo-500 ${isCategoryFixed || isCategoryDisabledInEdit ? 'bg-gray-100 cursor-not-allowed' : 'border-gray-300'}`,
                            value: selectedCategory,
                            onChange: handleCategoryChange,
                            required: true,
                            disabled: isCategoryFixed || isCategoryDisabledInEdit
                        },
                        React.createElement('option', { value: '' }, '--- Vyberte kategóriu ---'),
                        sortedCategoryEntries.map(([id, name]) =>
                            React.createElement('option', { key: id, value: id }, name)
                        )
                    ),
                    isCategoryDisabledInEdit && React.createElement('p', { className: 'text-xs text-red-600 mt-1' }, `Pri editácii tímu nemôžete zmeniť kategóriu.`),
                    isCategoryFixed && !isCategoryDisabledInEdit && React.createElement('p', { className: 'text-xs text-indigo-600 mt-1' }, `Kategória je predvolená filtrom: ${categoryIdToNameMap[defaultCategoryId]}`)
                ),
    
                // 2. Skupina (zostáva rovnaká)
                React.createElement(
                    'div',
                    { className: 'flex flex-col' },
                    React.createElement('label', { className: 'text-sm font-medium text-gray-700 mb-1' }, 'Skupina:'),
                    React.createElement(
                        'select',
                        {
                            className: `p-3 border rounded-lg focus:ring-indigo-500 focus:border-indigo-500 ${!selectedCategory || isGroupFixed ? 'bg-gray-100 cursor-not-allowed' : ''}`,
                            value: selectedGroup,
                            onChange: (e) => setSelectedGroup(e.target.value),
                            required: true,
                            disabled: !selectedCategory || isGroupFixed
                        },
                        React.createElement('option', { value: '' }, availableGroups.length > 0 ? '--- Vyberte skupinu ---' : 'Najprv vyberte kategóriu'),
                        availableGroups.map((group, index) =>
                            React.createElement('option', { key: index, value: group.name }, `${group.name} (${group.type})`)
                        )
                    ),
                    isGroupFixed && React.createElement('p', { className: 'text-xs text-indigo-600 mt-1' }, `Skupina je predvolená: ${defaultGroupName}`)
                ),
    
                // 3. NOVÉ: Poradové číslo (order) – len ak je vybraná skupina
                selectedGroup && React.createElement(
                    'div',
                    { className: 'flex flex-col' },
                    React.createElement('label', { className: 'text-sm font-medium text-gray-700 mb-1' }, 'Poradové číslo v skupine:'),
                    React.createElement(
                        'input',
                        {
                            type: 'number',
                            min: '1',
                            className: 'p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 w-32',
                            value: orderInputValue ?? '',  // ← dôležité: null → prázdne pole
                            onChange: (e) => {
                                const val = e.target.value;
                                setOrderInputValue(val === '' ? null : parseInt(val, 10));
                            },
                            placeholder: 'napr. 5 (alebo prázdne = na koniec)'
                        }
                    ),
                    React.createElement(
                        'p',
                        { className: 'text-xs text-gray-500 mt-1' },
                        'Číslo určuje poradie v skupine. Necháš prázdne → tím sa zaradí na koniec.'
                    )
                ),
    
                // Tlačidlá
                React.createElement(
                    'div',
                    { className: 'pt-6 flex justify-end space-x-4' },
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            className: 'px-5 py-2.5 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors',
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
                        buttonText
                    )
                )
            )
        )
    );
};

const AddGroupsApp = (props) => {
    const { useState, useEffect, useRef } = React;
    const teamsWithoutGroupRef = React.useRef(null);
    const [allTeams, setAllTeams] = useState([]);
    const [userTeamsData, setUserTeamsData] = useState([]);
    const [superstructureTeams, setSuperstructureTeams] = useState({});
    const [allGroupsByCategoryId, setAllGroupsByCategoryId] = useState({});
    const [categoryIdToNameMap, setCategoryIdToNameMap] = useState({});
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [selectedGroupName, setSelectedGroupName] = useState('');
    const [notification, setNotification] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [teamToEdit, setTeamToEdit] = useState(null); // NOVÝ STAV pre tím, ktorý sa bude upravovať
    const [isInitialHashReadComplete, setIsInitialHashReadComplete] = useState(false);
      
    // Efekt pre manažovanie notifikácií
    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => {
                setNotification(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [notification]);
   
    // --- NOVÉ ZJEDNOTENÉ HANDLERY PRE MODÁL ---
   
    // Zjednotený handler pre zatvorenie modálu
    const closeModal = () => {
        setIsModalOpen(false);
        setTeamToEdit(null); // Resetujeme tím na editáciu
    };
   
    // Handler pre otvorenie modálu na pridanie
    const openAddModal = () => {
        setTeamToEdit(null); // Uistíme sa, že nie je aktívny edit mód
        setIsModalOpen(true);
    };
   
    // ZJEDNOTENÝ HANDLE SAVE/UPDATE:
    const unifiedSaveHandler = async (data) => {
        if (data.isEdit) {
            if (data.originalTeam.isSuperstructureTeam) {
                await handleUpdateTeam(data);
            } else {
                await handleUpdateUserTeam(data);
            }
        } else {
            // pridávanie zostáva len pre globálne tímy (alebo môžeš umožniť aj pre používateľa)
            await handleAddNewTeam(data);
        }
        closeModal();
    };

    // Nová funkcia na aktualizáciu používateľského tímu
    const handleUpdateUserTeam = async ({ categoryId, groupName, teamName, order, originalTeam }) => {
        if (!window.db || !originalTeam?.uid) return;

        if (categoryIdToNameMap[categoryId] !== originalTeam.category) {
            setNotification({
                message: "Kategóriu používateľského tímu nemôžete meniť.",
                type: 'error'
            });
            return;
        }

        const userId = originalTeam.uid;
        const categoryName = categoryIdToNameMap[categoryId];
        if (!categoryName) return;
    
        const finalTeamName = `${categoryName} ${teamName.trim()}`;
    
        try {
            const userRef = doc(window.db, 'users', userId);
            const userSnap = await getDoc(userRef);
    
            if (!userSnap.exists()) {
                setNotification({
                    id: Date.now(),
                    message: `Používateľ ${userId} už neexistuje v databáze.`,
                    type: 'error'
                });
                return;
            }
    
            const userData = userSnap.data();
            const teamsInCategory = [...(userData.teams?.[categoryName] || [])];
    
            // Hľadáme tím podľa pôvodného názvu (pre istotu)
            const teamIndex = teamsInCategory.findIndex(t => t.teamName === originalTeam.teamName);
            if (teamIndex === -1) {
                setNotification({
                    id: Date.now(),
                    message: `Tím "${originalTeam.teamName}" sa nenašiel v profile používateľa.`,
                    type: 'error'
                });
                return;
            }
    
            const teamToUpdate = teamsInCategory[teamIndex];
    
            // -------------------------------
            // Bez spread operátora
            const updatedTeam = {
                id: teamToUpdate.id || crypto.randomUUID(),
                teamName: finalTeamName,
                groupName: groupName || null,          // ← tu používame parameter groupName
                order: null,                           // bude prepísané nižšie ak treba
                // skopírujeme ostatné polia, ktoré chceme zachovať
                // (pridaj ďalšie polia podľa potreby, napr. players, createdAt, atď.)
            };
    
            // Logika poradia – rovnaká ako pri globálnych tímoch
            let newOrder = null;
            const newGroupName = groupName || null;
            const originalGroupName = originalTeam.groupName || null;
    
            if (newGroupName) {
                if (originalGroupName === newGroupName) {
                    newOrder = originalTeam.order ?? null;
                } else {
                    const teamsInTargetGroup = teamsInCategory.filter(t => t.groupName === newGroupName);
                    const maxOrder = teamsInTargetGroup.reduce((max, t) => Math.max(max, t.order || 0), 0);
                    newOrder = maxOrder + 1;
                }
    
                // Explicitne zadané poradie má prednosť
                if (order !== undefined && order !== null && !isNaN(order)) {
                    newOrder = parseInt(order, 10);
                }
            }
    
            updatedTeam.order = newOrder;
    
            // Odstránime starý tím a vložíme aktualizovaný
            teamsInCategory.splice(teamIndex, 1);
            teamsInCategory.push(updatedTeam);
    
            // Uložíme celé pole naspäť
            await updateDoc(userRef, {
                [`teams.${categoryName}`]: teamsInCategory
            });
    
            setNotification({
                id: Date.now(),
                message: `Používateľský tím ${finalTeamName} bol aktualizovaný (poradie: ${newOrder ?? 'bez poradia'})`,
                type: 'success'
            });
    
        } catch (err) {
            console.error("Chyba pri update používateľského tímu:", err);
            setNotification({
                id: Date.now(),
                message: "Chyba pri aktualizácii používateľského tímu",
                type: 'error'
            });
        }
    };
            
    // --- UPRAVENÉ POMOCNÉ FUNKCIE PRE URL SLUG ---
    const slugifyName = (name) => {
        if (!name) return '';
        return name.replace(/ /g, '-');
    };
    const deslugifyName = (slug) => {
        if (!slug) return '';
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
                                        id: team.id || crypto.randomUUID(),
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
       
        if (Object.keys(map).length === 0 && hash) {
            if (hash) return;
        }
        if (hash) {
            const parts = hash.split('/');
            const categorySlugFromUrl = parts[0];
            const groupSlugFromUrl = parts[1];
            const categoryNameFromUrl = deslugifyName(decodeURIComponent(categorySlugFromUrl));
            const groupNameFromUrl = groupSlugFromUrl ? deslugifyName(decodeURIComponent(groupSlugFromUrl)) : '';
           
            const categoryId = map[categoryNameFromUrl];
           
            setSelectedCategoryId(categoryId || '');
            setSelectedGroupName(groupNameFromUrl || '');
        } else {
            setSelectedCategoryId('');
            setSelectedGroupName('');
        }
       
        if (Object.keys(map).length > 0 && !isInitialHashReadComplete) {
            setIsInitialHashReadComplete(true);
        }
    };
    // **LOGIKA 3: Načítanie hashu z URL a Listener pre zmeny**
    useEffect(() => {
        readHashAndSetState(categoryNameToIdMap);
       
        const handleHashChange = () => {
            readHashAndSetState(categoryNameToIdMap);
        };
        window.addEventListener('hashchange', handleHashChange);
       
        return () => {
            window.removeEventListener('hashchange', handleHashChange);
        };
    }, [categoryNameToIdMap, isInitialHashReadComplete]);
    // **LOGIKA 4: Ukladanie hashu (zápis SLUG kategórie a SLUG skupiny do URL)**
    useEffect(() => {
       
        if (!isInitialHashReadComplete) {
            return;
        }
       
        let hash = '';
       
        const categoryName = categoryIdToNameMap[selectedCategoryId];
        if (categoryName) {
            const categorySlug = slugifyName(categoryName);
            hash = encodeURIComponent(categorySlug);
           
            if (selectedGroupName) {
                const groupSlug = slugifyName(selectedGroupName);
                hash += `/${encodeURIComponent(groupSlug)}`;
            }
        }
       
        const currentHash = window.location.hash.substring(1);
        if (currentHash !== hash) {
            window.location.replace(`#${hash}`);
        }
    }, [selectedCategoryId, selectedGroupName, categoryIdToNameMap, isInitialHashReadComplete]);
    // --- OPRAVA: FUNKCIE PRE SELECT BOXY (Priamy zápis do URL hash) ---
   
    const handleCategorySelect = (e) => {
        const newCategoryId = e.target.value;
        const categoryName = categoryIdToNameMap[newCategoryId];
        if (categoryName) {
            const categorySlug = slugifyName(categoryName);
            const newHash = `#${encodeURIComponent(categorySlug)}`;
            window.location.replace(newHash);
        } else {
             window.location.replace(`#`);
        }
    };
    const handleGroupSelect = (e) => {
        const newGroupName = e.target.value;
        const categoryName = categoryIdToNameMap[selectedCategoryId];
       
        if (categoryName) {
            const categorySlug = slugifyName(categoryName);
            let newHash = `#${encodeURIComponent(categorySlug)}`;
           
            if (newGroupName) {
                const groupSlug = slugifyName(newGroupName);
                newHash += `/${encodeURIComponent(groupSlug)}`;
            }
           
            window.location.replace(newHash);
        }
    };
    // --- FUNKCIA: Uloženie nového Tímu do /settings/superstructureGroups ---
    const handleAddNewTeam = async ({ categoryId, groupName, teamName, order }) => {
        if (!window.db) {
            setNotification({ id: Date.now(), message: "Firestore nie je inicializovaný.", type: 'error' });
            return;
        }
        const categoryName = categoryIdToNameMap[categoryId];
        const superstructureDocRef = doc(window.db, ...SUPERSTRUCTURE_TEAMS_DOC_PATH.split('/'));
       
        const finalTeamName = `${categoryName} ${teamName}`;
        const isDuplicateFinal = allTeams.some(team => team.teamName === finalTeamName);
        if (isDuplicateFinal) {
             setNotification({ id: Date.now(), message: `Globálny tím '${finalTeamName}' už existuje. Ukladanie zrušené.`, type: 'error' });
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
            const newOrder = order != null ? parseInt(order, 10) : (groupName ? maxOrder + 1 : null);
           
            const newTeam = {
                teamName: finalTeamName,
                groupName: groupName || null,
                order: newOrder,
                id: crypto.randomUUID() // Pridanie ID
            };
           
            const updatedTeamsArray = [...currentTeamsForCategory, newTeam];
           
            await setDoc(superstructureDocRef, {
                ...globalTeamsData,
                [categoryName]: updatedTeamsArray
            }, { merge: true });
           
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

    // --- FUNKCIA: Odstránenie existujúceho Tímu z /settings/superstructureGroups ---
    const handleDeleteTeam = async (teamToDelete) => {
        if (!window.db || !teamToDelete || !teamToDelete.isSuperstructureTeam) {
             setNotification({ id: Date.now(), message: "Chyba: Možno odstrániť len globálne tímy.", type: 'error' });
             return;
        }
        const superstructureDocRef = doc(window.db, ...SUPERSTRUCTURE_TEAMS_DOC_PATH.split('/'));
       
        try {
            const docSnap = await getDoc(superstructureDocRef);
            const globalTeamsData = docSnap.exists() ? docSnap.data() : {};
            let teams = globalTeamsData[teamToDelete.category] || [];
           
            // 1. Nájdeme tím, ktorý sa má odstrániť (používame ID pre istotu)
            const teamIndex = teams.findIndex(t => t.id === teamToDelete.id);
           
            if (teamIndex === -1) {
                setNotification({ id: Date.now(), message: `Chyba: Odstraňovaný globálny tím sa nenašiel.`, type: 'error' });
                return;
            }
           
            const originalGroup = teamToDelete.groupName;
            const originalOrder = teamToDelete.order;
           
            // 2. Odstránime tím
            teams.splice(teamIndex, 1);
           
            // 3. Reordering v PÔVODNEJ skupine (len ak mal tím skupinu)
            const reorderedTeams = teams.map(t => {
                if (t.groupName === originalGroup && t.order != null && t.order > originalOrder) {
                     return { ...t, order: t.order - 1 };
                }
                return t;
            });
            // 4. Zápis do databázy
            await setDoc(superstructureDocRef, {
                ...globalTeamsData,
                [teamToDelete.category]: reorderedTeams
            }, { merge: true });
            setNotification({
                id: Date.now(),
                message: `Globálny tím '${teamToDelete.teamName}' bol úspešne odstránený.`,
                type: 'success'
            });
        } catch (error) {
            console.error("Chyba pri odstraňovaní globálneho tímu:", error);
            setNotification({ id: Date.now(), message: "Chyba pri odstraňovaní tímu z globálneho dokumentu.", type: 'error' });
        }
    };
   
    // --- KONIEC FUNKCIÍ PRE UKLADANIE, UPDATE A MAZANIE ---
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
   
    const renderTeamList = (teamsToRender, targetGroupId, targetCategoryId, isWithoutGroup = false) => {
        const sortedTeams = [...teamsToRender].sort((a, b) => {
            if (!isWithoutGroup && a.order != null && b.order != null) return a.order - b.order;
            return a.teamName.localeCompare(b.teamName);
        });
    
        const orderCountMap = new Map();
        if (!isWithoutGroup) {
            sortedTeams.forEach(t => {
                if (t.order != null) {
                    orderCountMap.set(t.order, (orderCountMap.get(t.order) || 0) + 1);
                }
            });
        }
    
        const items = sortedTeams.map((team, idx) => {
            const hasDuplicateOrder = !isWithoutGroup && team.order != null && (orderCountMap.get(team.order) || 0) > 1;
            const textColor = hasDuplicateOrder ? 'text-red-600 font-medium' : 'text-gray-800';
    
            let displayName = team.teamName;

            if (!team.isSuperstructureTeam && team.category && displayName.startsWith(team.category + ' ')) {
                displayName = displayName.substring(team.category.length + 1).trim();
            } 
    
            let display = team.order != null && !isWithoutGroup 
                ? `${team.order}. ${displayName}`
                : displayName;
    
            if (!selectedCategoryId && !team.groupName && team.category) {
                display = `${team.category}: ${display}`;
            }
            // ────────────────────────────────────────────────
    
            return React.createElement(
                'li',
                {
                    key: team.id || `${team.uid || 'g'}-${team.teamName}-${team.groupName || ''}-${idx}`,
                    className: `flex justify-between items-center px-4 py-3 rounded-lg border shadow-sm ${
                        team.isSuperstructureTeam ? 'bg-yellow-50' : 'bg-white'
                    }`
                },
                React.createElement('span', { className: `flex-grow ${textColor}` }, display),
    
                React.createElement(
                    'button',
                    {
                        onClick: async () => {
                            console.log("Pokus o editáciu tímu:", {
                                uid: team.uid,
                                id: team.id,
                                name: team.teamName,
                                category: team.category,
                                group: team.groupName
                            });
    
                            if (!team.isSuperstructureTeam && team.uid) {
                                try {
                                    const userRef = doc(window.db, 'users', team.uid);
                                    const snap = await getDoc(userRef);
    
                                    if (!snap.exists()) {
                                        setNotification({
                                            id: Date.now(),
                                            message: `Profil používateľa ${team.uid} už neexistuje.`,
                                            type: 'error'
                                        });
                                        return;
                                    }
    
//                                    const data = snap.data();
//                                    const cat = team.category;
//                                    const teamsArr = data.teams?.[cat] || [];
//                                    const exists = teamsArr.some(t => t.id === team.id);
    
//                                    if (!exists) {
//                                        setNotification({
//                                            id: Date.now(),
//                                            message: `Tím "${team.teamName}" už nie je v profile používateľa. Zoznam sa aktualizuje.`,
//                                            type: 'warning'
//                                        });
//                                        return;
//                                    }
                                } catch (err) {
                                    console.error("Chyba pri overovaní tímu:", err);
                                    setNotification({
                                        id: Date.now(),
                                        message: "Nepodarilo sa overiť existenciu tímu. Skús neskôr.",
                                        type: 'error'
                                    });
                                    return;
                                }
                            }
    
                            setTeamToEdit(team);
                            setIsModalOpen(true);
                        },
                        className: 'text-gray-500 hover:text-indigo-600 p-1.5 rounded-full hover:bg-indigo-50 transition-colors',
                        title: 'Upraviť tím'
                    },
                    React.createElement(
                        'svg',
                        {
                            className: 'w-5 h-5',
                            fill: 'none',
                            stroke: 'currentColor',
                            viewBox: '0 0 24 24'
                        },
                        React.createElement('path', {
                            strokeLinecap: 'round',
                            strokeLinejoin: 'round',
                            strokeWidth: '2',
                            d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z'
                        })
                    )
                )
            );
        });
    
        return React.createElement('ul', { className: 'space-y-2' }, ...items);
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
       
    // NOVÉ: Triedy a logika pre FAB Drag-to-Delete
    const fabBaseClasses = 'fixed bottom-8 right-8 p-5 rounded-full shadow-2xl transition-all duration-300 transform hover:scale-110 focus:outline-none';
   
    const fabButton = React.createElement(
            'button',
            {
                // Tlačidlo na pridávanie (zelené a plus)
                className: `${fabBaseClasses} bg-green-500 hover:bg-green-600 text-white focus:ring-green-400`,
                onClick: openAddModal, // NOVÝ HANDLER
            },
            React.createElement('span', { className: 'text-2xl font-bold' }, '+')
        );
    return React.createElement(
        'div',
        { className: 'flex flex-col w-full relative' },
        // Lokálna notifikácia
        React.createElement(
            'div',
            { className: `${notificationClasses} ${typeClasses}`},
            notification?.message
        ),
       
        // Modálne okno - odovzdáme unifiedSaveHandler a teamToEdit
        React.createElement(NewTeamModal, {
            isOpen: isModalOpen,
            onClose: closeModal,
            allGroupsByCategoryId: allGroupsByCategoryId,
            categoryIdToNameMap: categoryIdToNameMap,
            unifiedSaveHandler: unifiedSaveHandler, // ZJEDNOTENÝ HANDLER
            teamToEdit: teamToEdit, // DÁTA PRE EDITÁCIU
            allTeams: allTeams,
            defaultCategoryId: selectedCategoryId,
            defaultGroupName: selectedGroupName,
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
                    onChange: handleGroupSelect,
                    disabled: !selectedCategoryId,
                    style: { cursor: !selectedCategoryId ? 'not-allowed' : 'pointer' }
                },
                React.createElement('option', { value: '' }, 'Zobraziť všetky skupiny'),
                availableGroupsForSelect.map((group, index) =>
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
        fabButton
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
