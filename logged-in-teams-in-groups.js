// Importy pre Firebase funkcie
import { doc, getDoc, onSnapshot, updateDoc, addDoc, collection, Timestamp, query, getDocs, where, limit, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
const { useState, useEffect, useRef } = React;

const AddGroupsApp = ({ userProfileData: initialUserProfileData }) => {
    const [allTeams, setAllTeams] = useState([]);
    const [allGroupsByCategoryId, setAllGroupsByCategoryId] = useState({});
    const [categoryIdToNameMap, setCategoryIdToNameMap] = useState({});
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [selectedGroupName, setSelectedGroupName] = useState(''); // Vybraná skupina
    const [nextOrderMap, setNextOrderMap] = useState({});
    const [notification, setNotification] = useState(null);
    
    // Stav pre drag & drop
    const draggedItem = useRef(null);
    const listRefs = useRef({}); // Refy pre UL kontajnery (pre presné meranie)
    
    // Nový stav pre presnú pozíciu, kam bude tím vložený (pre vizuálnu spätnú väzbu)
    // { groupId: string | null, categoryId: string | null, index: number | null }
    const [dropTarget, setDropTarget] = useState({ groupId: null, categoryId: null, index: null });
    
    // REF pre meranie výšky kontajnera s tímami bez skupiny
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
            const newNextOrderMap = {};
            querySnapshot.forEach((doc) => {
                const userData = doc.data();
                if (userData && userData.teams) {
                    Object.entries(userData.teams).forEach(([categoryName, teamArray]) => {
                        if (Array.isArray(teamArray)) {
                            teamArray.forEach(team => {
                                if (team.teamName) {
                                    teamsList.push({
                                        uid: doc.id,
                                        category: categoryName,
                                        ...team
                                    });
                                }
                            });
                        }
                    });
                }
            });
            setAllTeams(teamsList);
            // Vypočítanie nextOrderMap na základe aktuálnych dát (len ako fallback pre prázdny drop)
            teamsList.forEach(team => {
                if (team.groupName) {
                    const key = `${team.category}-${team.groupName}`;
                    if (!newNextOrderMap[key] || team.order >= newNextOrderMap[key]) {
                        newNextOrderMap[key] = (team.order || 0) + 1;
                    }
                }
            });
            setNextOrderMap(newNextOrderMap);
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

    // Funkcia na spracovanie drag over na li elemente (tíme)
    const handleDragOverTeam = (e, targetGroup, targetCategoryId, index) => {
        e.preventDefault();
        // ZABRÁNI BUBBLINGU: Dôležité, aby rodičovský UL neprepísal presný index,
        // keď je kurzor jasne nad LI elementom.
        e.stopPropagation(); 
        
        const rect = e.currentTarget.getBoundingClientRect();
        // Rozdelenie LI na hornú polovicu (insert PRED) a dolnú polovicu (insert ZA)
        const isOverTopHalf = e.clientY - rect.top < rect.height / 2;
        
        // Ak sa presúva cez tím, vloží sa pred tím (horná polovica) alebo za tím (dolná polovica)
        const insertionIndex = isOverTopHalf ? index : index + 1;
        
        // Nastavíme vizuálnu spätnú väzbu
        setDropTarget({
            groupId: targetGroup, // null pre tímy bez skupiny
            categoryId: targetCategoryId,
            index: insertionIndex
        });

        e.dataTransfer.dropEffect = "move";
    };

    /**
     * Pomocná funkcia na presné určenie indexu, keď sa kurzor nachádza v medzerách
     * medzi LI prvkami (keď sa spustí UL handler).
     */
    const getInsertionIndexInGap = (e, teamElements, sortedTeams) => {
        if (teamElements.length === 0) return 0;
        
        // 1. Kontrola PRED prvým elementom
        const firstRect = teamElements[0].getBoundingClientRect();
        // Ak je Y-pozícia myši nad top hranou prvého tímu, vrátime index 0
        if (e.clientY < firstRect.top) { 
            return 0;
        }

        for (let i = 0; i < teamElements.length; i++) {
            const teamEl = teamElements[i];
            const rect = teamEl.getBoundingClientRect();
            
            // Check 2: Je kurzor v medzere POD aktuálnym elementom 'i' a NAD nasledujúcim 'i+1'?
            if (i < teamElements.length - 1) {
                const nextRect = teamElements[i + 1].getBoundingClientRect();
                
                // Medzera začína pod spodnou hranou 'rect.bottom' a končí pri hornej hrane 'nextRect.top'
                if (e.clientY > rect.bottom && e.clientY < nextRect.top) {
                     // Ak sme v GAPE, vkladáme ZA aktuálny element 'i', teda na index 'i + 1'
                     return i + 1;
                }
            } else {
                // Check 3: Sme pod POSLEDNÝM elementom
                // Ak je Y-pozícia myši pod spodnou hranou POSLEDNÉHO tímu, vrátime index na koniec
                if (e.clientY > rect.bottom) {
                    return sortedTeams.length;
                }
            }
        }
        
        // Ak nebola detekovaná žiadna presná medzera ani koniec, vrátime index na koniec.
        // Toto by malo byť už len bezpečnostné pravidlo.
        return sortedTeams.length; 
    }


    // Funkcia na spracovanie drag over na UL kontajneri, keď kurzor nie je nad LI elementom
    // Toto zachytáva presun myši v medzerách (gapoch) medzi tímami.
    const handleDragOverEnd = (e, targetGroup, targetCategoryId, sortedTeams) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        
        const containerRef = listRefs.current[`${targetCategoryId}-${targetGroup}`];
        if (!containerRef) return;

        const teamElements = Array.from(containerRef.children).filter(el => el.tagName === 'LI');
        
        // Použijeme robustnú geometrickú funkciu na zistenie, či sme v medzerách medzi prvkami
        const insertionIndex = getInsertionIndexInGap(e, teamElements, sortedTeams);

        // Nastavíme index na vypočítanú pozíciu
        setDropTarget({
            groupId: targetGroup,
            categoryId: targetCategoryId,
            index: insertionIndex
        });
    };


    // Funkcia na spracovanie drag over na PRÁZDNOM kontajneri (skupine/zozname bez tímu)
    const handleDragOverEmptyContainer = (e, targetGroup, targetCategoryId) => {
        const dragData = draggedItem.current;
        if (!dragData) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "none";
            return;
        }

        const teamCategoryId = dragData.teamCategoryId;
        const targetCategoryName = categoryIdToNameMap[targetCategoryId];
        const teamCategoryName = categoryIdToNameMap[teamCategoryId];

        // Ak sa kategórie nezhodujú, zabránime presunu
        if (targetCategoryName && teamCategoryName && targetCategoryName !== teamCategoryName) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "none";
            e.currentTarget.style.cursor = 'not-allowed';
            return;
        } else {
            e.currentTarget.style.cursor = 'move';
            e.dataTransfer.dropEffect = "move";
        }

        e.preventDefault();
        
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
        const targetCategoryName = categoryIdToNameMap[targetCategoryId || finalDropTarget.categoryId]; // Používame categoryId z dropTarget, ak je k dispozícii

        console.log(`\n--- Presun tímu: '${teamData.teamName}' ---`);
        console.log(`Pôvodná skupina: ${originalGroup || 'bez skupiny'}`);
        console.log(`Pôvodné poradie: ${originalOrder != null ? originalOrder : 'žiadne'}`);
        console.log(`Cieľová skupina: ${targetGroup || 'bez skupiny'}`);
        console.log(`Cieľový index (0-based): ${finalDropTarget.index}`);
        
        // Vypočítame 1-based nové poradie (ak je v skupine)
        const newOrder = targetGroup ? (finalDropTarget.index + 1) : null;
        console.log(`Nové poradie (1-based, ak v skupine): ${newOrder}`);


        // Zastaviť, ak sa presúva tím do rovnakej cieľovej skupiny a na rovnakú pozíciu (komplikovanejšia kontrola, zjednodušme ju)
        if (originalGroup === targetGroup && teamData.category === targetCategoryName) {
            setNotification({ id: Date.now(), message: "Tím sa už nachádza v tejto skupine.", type: 'info' });
            return;
        }

        if (targetCategoryId && teamCategoryName !== targetCategoryName) {
            setNotification({ id: Date.now(), message: "Skupina nepatrí do rovnakej kategórie ako tím.", type: 'error' });
            return;
        }

        try {
            const usersRef = collection(window.db, 'users');
            const userDocs = await getDocs(usersRef);
            const batchPromises = [];

            userDocs.forEach(userDoc => {
                const userData = userDoc.data();
                if (userData.teams?.[teamCategoryName]) {
                    const teams = userData.teams[teamCategoryName];
                    let shouldUpdate = false;
                    
                    const updatedUserTeams = teams.map(t => {
                        const isDraggedTeam = userDoc.id === teamData.uid && t.teamName === teamData.teamName;

                        // A. Decrement v Pôvodnej Skupine (pre tímy, ktoré zostali a mali vyššie poradie)
                        if (originalGroup && t.groupName === originalGroup && t.order != null && t.order > originalOrder) {
                            shouldUpdate = true;
                            // Zmenšenie poradia o 1
                            return { ...t, order: t.order - 1 };
                        }

                        // B. Increment v Cieľovej Skupine (pre existujúce tímy, ktoré sa musia posunúť)
                        // Aplikuje sa len ak cieľová skupina je definovaná a poradie existuje
                        if (!isDraggedTeam && targetGroup && t.groupName === targetGroup && t.order != null && newOrder !== null && t.order >= newOrder) {
                            shouldUpdate = true;
                            // Zvýšenie poradia o 1
                            return { ...t, order: t.order + 1 };
                        }
                        
                        // C. Update Presunutého Tímu (iba pre majiteľa tímu)
                        if (isDraggedTeam) {
                            shouldUpdate = true;
                            // Nastavíme novú skupinu a vypočítané nové poradie
                            return { ...t, groupName: targetGroup, order: newOrder }; 
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
        const teamCategoryId = Object.keys(categoryIdToNameMap).find(key => categoryIdToNameMap[key] === team.category);
        draggedItem.current = { team, teamCategoryId };
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
                return (a.order || 0) - (b.order || 0);
            } else {
                return a.teamName.localeCompare(b.teamName);
            }
        });
        
        // Vytvorenie React elementov s pridaním indikátorov
        const listItems = sortedTeams.map((team, index) => {
            const teamNameWithOrder = !isWithoutGroup && team.order != null ? `${team.order}. ${team.teamName}` : team.teamName;
            const teamBgClass = !isWithoutGroup ? 'bg-white' : 'bg-gray-100';
            
            // Indikátor pre vloženie PRED aktuálny tím
            const isDropIndicatorVisible = 
                dropTarget.groupId === targetGroupId && 
                dropTarget.categoryId === targetCategoryId && 
                dropTarget.index === index;

            return React.createElement(
                React.Fragment, 
                { key: `${team.uid}-${team.teamName}-${team.groupName}-${index}` },
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
                    `${!selectedCategoryId && team.category && !isWithoutGroup ? `${team.category}: ` : ''}${teamNameWithOrder}`
                )
            );
        });

        // Kontrola, či sa má zobraziť indikátor na úplnom konci zoznamu
        // Aktivuje sa v handleDragOverEnd, ak sa kurzor nachádza pod posledným tímom
        const isDropIndicatorVisibleAtEnd = 
            sortedTeams.length > 0 && 
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
                // Toto zachytáva presun myši V MEDZERÁCH (GAPOCH) medzi prvkami, kde LI.onDragOver nebola spustená
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
                React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
            )
        );
    }
}
