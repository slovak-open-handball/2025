import { doc, getDoc, onSnapshot, updateDoc, collection, Timestamp, query, getDocs, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
const { useState, useEffect, useRef } = React;

// Referencia na globálny konfiguračný dokument pre nadstavbové tímy
const SUPERSTRUCTURE_TEAMS_DOC_PATH = 'settings/superstructureGroups';

// --- Komponent Modálne Okno pre Pridanie Tímu/Konfigurácie ---
// Prijíma nový prop: defaultCategoryId
const NewTeamModal = ({ isOpen, onClose, allGroupsByCategoryId, categoryIdToNameMap, handleSave, defaultCategoryId }) => {
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedGroup, setSelectedGroup] = useState('');
    const [teamName, setTeamName] = useState('');

    // Nastavenie/reset stavu pri otvorení/zatvorení modálu alebo zmene predvolenej kategórie
    useEffect(() => {
        if (isOpen) {
            // Ak je k dispozícii predvolená kategória (z filtra hlavnej stránky), použije sa
            setSelectedCategory(defaultCategoryId || '');
            setSelectedGroup('');
            setTeamName('');
        } else {
             // Reset stavu pri zatvorení
             setSelectedCategory('');
             setSelectedGroup('');
             setTeamName('');
        }
    }, [isOpen, defaultCategoryId]); // Pridaná závislosť defaultCategoryId

    const sortedCategoryEntries = Object.entries(categoryIdToNameMap)
        .sort(([, nameA], [, nameB]) => nameA.localeCompare(nameB));

    const availableGroups = selectedCategory && allGroupsByCategoryId[selectedCategory]
        ? allGroupsByCategoryId[selectedCategory].sort((a, b) => a.name.localeCompare(b.name))
        : [];
        
    const handleCategoryChange = (e) => {
        setSelectedCategory(e.target.value);
        setSelectedGroup(''); 
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        handleSave({ 
            categoryId: selectedCategory, 
            groupName: selectedGroup, 
            teamName: teamName 
        });
    };

    if (!isOpen) return null;
    
    // Zistíme, či je pole kategórie disabled
    const isCategoryFixed = !!defaultCategoryId;

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
                            disabled: !selectedCategory || !teamName
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

    // **Pomocná funkcia: Mapuje globálne dáta na jednotný formát poľa**
    const mapSuperstructureTeams = (globalTeams) => {
        let globalTeamsList = [];
        Object.entries(globalTeams).forEach(([categoryName, teamArray]) => {
             if (Array.isArray(teamArray)) {
                teamArray.forEach(team => {
                    if (team.teamName) {
                        globalTeamsList.push({
                            uid: 'global', // UNIKÁTNE ID pre globálne tímy
                            category: categoryName,
                            id: team.id || crypto.randomUUID(), 
                            teamName: team.teamName,
                            groupName: team.groupName || null,
                            order: team.order || 0,
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
                                    userTeamsList.push({
                                        uid: doc.id,
                                        category: categoryName,
                                        id: team.id || `${doc.id}-${team.teamName}`,
                                        teamName: team.teamName,
                                        groupName: team.groupName || null,
                                        order: team.order || 0, 
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

    // **LOGIKA: Načítanie a synchronizácia hashu (zostáva bezo zmeny)**
    useEffect(() => {
        const hash = window.location.hash.substring(1);
        if (hash) {
            const parts = hash.split('/');
            const categoryId = parts[0];
            const groupNameEncoded = parts[1];
            const groupName = groupNameEncoded ? decodeURIComponent(groupNameEncoded) : '';

            setSelectedCategoryId(categoryId);
            setSelectedGroupName(groupName); 
        }
    }, []);

    useEffect(() => {
        let hash = '';
        if (selectedCategoryId) {
            hash = selectedCategoryId;
            if (selectedGroupName) {
                hash += `/${encodeURIComponent(selectedGroupName)}`;
            }
        }

        if (window.location.hash.substring(1) !== hash) {
            window.location.hash = hash;
        }

    }, [selectedCategoryId, selectedGroupName]);

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
            
            const newOrder = groupName ? (maxOrder + 1) : null; 
            
            const newTeam = {
                teamName: finalTeamName, // Použijeme formátovaný názov
                groupName: groupName || null,
                order: newOrder,
                timestamp: Timestamp.now(),
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
                const nextRect = teamElements[i + 1].getBoundingClientRect();
                
                const gapStart = rect.bottom + 2; 
                const gapEnd = nextRect.top - 2; 
                
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
        
        const containerRef = listRefs.current[`${targetCategoryId}-${targetGroup}`];
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
        const newOrder = targetGroup ? (finalDropTarget.index + 1) : null;
        
        try {
            if (teamData.isSuperstructureTeam) {
                // --- UPDATE GLOBÁLNEHO DOKUMENTU (/settings/superstructureGroups) ---
                const superstructureDocRef = doc(window.db, ...SUPERSTRUCTURE_TEAMS_DOC_PATH.split('/'));
                const docSnap = await getDoc(superstructureDocRef);
                const globalTeamsData = docSnap.exists() ? docSnap.data() : {};
                
                let teams = globalTeamsData[teamCategoryName] || [];
                let shouldUpdate = false;
                
                const updatedTeamsArray = teams.map(t => {
                    const isDraggedTeam = t.id === teamData.id;
                    
                    if (isDraggedTeam) {
                        shouldUpdate = true;
                        return { ...t, groupName: targetGroup, order: newOrder }; 
                    }
                    
                    const isMovingWithinSameGroup = targetGroup && (targetGroup === originalGroup);
                    const isMovingFromGroup = originalGroup && !targetGroup;
                    const isMovingToGroup = !originalGroup && targetGroup;
                    const isMovingBetweenGroups = originalGroup && targetGroup && originalGroup !== targetGroup;

                    if (isMovingWithinSameGroup && t.groupName === targetGroup && t.order != null) {
                        if (newOrder > originalOrder && t.order > originalOrder && t.order <= newOrder - 1) { 
                            shouldUpdate = true;
                            return { ...t, order: t.order - 1 };
                        } else if (newOrder < originalOrder && t.order >= newOrder && t.order < originalOrder) {
                            shouldUpdate = true;
                            return { ...t, order: t.order + 1 };
                        }
                        return t;
                    }

                    if ((isMovingFromGroup || isMovingBetweenGroups) && t.groupName === originalGroup && t.order != null && t.order > originalOrder) {
                        shouldUpdate = true;
                        return { ...t, order: t.order - 1 };
                    }

                    if ((isMovingToGroup || isMovingBetweenGroups) && targetGroup && t.groupName === targetGroup && t.order != null && newOrder !== null && t.order >= newOrder) {
                        shouldUpdate = true;
                        return { ...t, order: t.order + 1 };
                    }
                    
                    return t;
                });
                
                if (shouldUpdate) {
                    await setDoc(superstructureDocRef, {
                        ...globalTeamsData,
                        [teamCategoryName]: updatedTeamsArray
                    });
                }


            } else {
                // --- PÔVODNÁ LOGIKA: UPDATE UŽÍVATEĽSKÝCH DOKUMENTOV ---
                const usersRef = collection(window.db, 'users');
                const userDocs = await getDocs(usersRef);
                const batchPromises = [];

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
                            const isDraggedTeam = userDoc.id === teamData.uid && t.id === teamData.id;
                            
                            if (isDraggedTeam) {
                                shouldUpdate = true;
                                return { ...t, groupName: targetGroup, order: newOrder }; 
                            }

                            if (isMovingWithinSameGroup && t.groupName === targetGroup && t.order != null) {
                                if (newOrder > originalOrder && t.order > originalOrder && t.order <= newOrder - 1) { 
                                    shouldUpdate = true;
                                    return { ...t, order: t.order - 1 };
                                } else if (newOrder < originalOrder && t.order >= newOrder && t.order < originalOrder) {
                                    shouldUpdate = true;
                                    return { ...t, order: t.order + 1 };
                                }
                                return t;
                            }

                            if ((isMovingFromGroup || isMovingBetweenGroups) && t.groupName === originalGroup && t.order != null && t.order > originalOrder) {
                                shouldUpdate = true;
                                return { ...t, order: t.order - 1 };
                            }

                            if ((isMovingToGroup || isMovingBetweenGroups) && targetGroup && t.groupName === targetGroup && t.order != null && newOrder !== null && t.order >= newOrder) {
                                shouldUpdate = true;
                                return { ...t, order: t.order + 1 };
                            }
                            
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
            }
            
            // Oznámenie o úspechu
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
                return (a.order || 0) - (b.order || 0);
            } else {
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
                const globalTag = team.isSuperstructureTeam ? ' [G]' : ''; 
                // V globálnom zobrazení už nezobrazujeme kategóriu, pretože názov ju už obsahuje
                teamNameDisplay = `${teamNameDisplay}${globalTag}`;
            } else if (team.isSuperstructureTeam) {
                teamNameDisplay = `${teamNameDisplay} [G]`;
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
                    className: `min-h-[50px] p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center relative ${isDropOnEmptyContainer ? 'border-blue-500 bg-blue-50' : ''}`
                },
                React.createElement('p', { className: 'text-center text-gray-400' }, 'Sem presuňte tím')
            );
        }

        const listRefKey = `${targetCategoryId}-${targetGroupId}`;
        
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
                },
                React.createElement('h3', { className: 'text-2xl font-semibold mb-4 text-center' }, `Tímy bez skupiny v kategórii: ${categoryName}`),
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

    return React.createElement(
        'div',
        { className: 'flex flex-col w-full relative' },
        // Lokálna notifikácia
        React.createElement(
            'div',
            { className: `${notificationClasses} ${typeClasses}`},
            notification?.message
        ),
        
        // Modálne okno - odovzdáme selectedCategoryId ako defaultCategoryId
        React.createElement(NewTeamModal, {
            isOpen: isModalOpen,
            onClose: () => setIsModalOpen(false),
            allGroupsByCategoryId: allGroupsByCategoryId,
            categoryIdToNameMap: categoryIdToNameMap,
            handleSave: handleAddNewTeam,
            defaultCategoryId: selectedCategoryId // Nová prop
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
                    onChange: (e) => {
                        setSelectedCategoryId(e.target.value);
                        setSelectedGroupName('');
                    }
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
                    onChange: (e) => setSelectedGroupName(e.target.value),
                    disabled: !selectedCategoryId,
                    style: { cursor: !selectedCategoryId ? 'not-allowed' : 'pointer' } 
                },
                React.createElement('option', { value: '' }, 'Zobraziť všetky skupiny'),
                (allGroupsByCategoryId[selectedCategoryId] || [])
                    .sort((a, b) => a.name.localeCompare(b.name))
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
