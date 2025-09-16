// Importy pre Firebase funkcie
import { doc, getDoc, onSnapshot, updateDoc, addDoc, collection, Timestamp, query, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";


const { useState, useEffect, useRef, useSyncExternalStore } = React;

/**
 * Globálna funkcia pre zobrazenie notifikácií
 */
window.showGlobalNotification = (message, type = 'success') => {
    let notificationElement = document.getElementById('global-notification');
    if (!notificationElement) {
        notificationElement = document.createElement('div');
        notificationElement.id = 'global-notification';
        notificationElement.className = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[99999] opacity-0 transition-opacity duration-300';
        document.body.appendChild(notificationElement);
    }

    const baseClasses = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[99999] transition-all duration-500 ease-in-out transform';
    let typeClasses = '';
    switch (type) {
        case 'success':
            typeClasses = 'bg-green-500 text-white';
            break;
        case 'error':
            typeClasses = 'bg-red-500 text-white';
            break;
        case 'info':
            typeClasses = 'bg-blue-500 text-white';
            break;
        default:
            typeClasses = 'bg-gray-700 text-white';
    }

    notificationElement.className = `${baseClasses} ${typeClasses} opacity-0 scale-95`;
    notificationElement.textContent = message;

    // Zobrazenie notifikácie
    setTimeout(() => {
        notificationElement.className = `${baseClasses} ${typeClasses} opacity-100 scale-100`;
    }, 10);

    // Skrytie notifikácie po 5 sekundách
    setTimeout(() => {
        notificationElement.className = `${baseClasses} ${typeClasses} opacity-0 scale-95`;
    }, 5000);
};


const AddGroupsApp = ({ userProfileData }) => {
    const [allTeams, setAllTeams] = useState([]);
    const [allGroupsByCategoryId, setAllGroupsByCategoryId] = useState({});
    const [categoryIdToNameMap, setCategoryIdToNameMap] = useState({});
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [dragOverIndex, setDragOverIndex] = useState(null);
    const [dragOverGroupId, setDragOverGroupId] = useState(null);
    
    // Používame useRef na uloženie dát presúvaného tímu, vrátane jeho poradia
    const draggedItem = useRef(null);

    // Načítanie kategórie z URL hashu pri prvom renderovaní
    useEffect(() => {
        const hash = window.location.hash.substring(1);
        if (hash) {
            setSelectedCategoryId(hash);
        }
    }, []);

    // Synchronizácia URL hashu so stavom `selectedCategoryId`
    useEffect(() => {
        if (selectedCategoryId) {
            window.location.hash = selectedCategoryId;
        } else {
            window.location.hash = '';
        }
    }, [selectedCategoryId]);

    useEffect(() => {
        if (!window.db) {
            console.error("Firebase Firestore nie je inicializovaný.");
            return;
        }

        const usersRef = collection(window.db, 'users');
        const groupsRef = doc(window.db, 'settings', 'groups');
        const categoriesRef = doc(window.db, 'settings', 'categories');
        
        // Listener na zmeny v kolekcii 'users' (pre tímy)
        const unsubscribeTeams = onSnapshot(usersRef, (querySnapshot) => {
            console.log("onSnapshot: Načítavam tímy z kolekcie 'users'...");
            const teamsList = [];
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
                                        teamName: team.teamName, 
                                        groupName: team.groupName || null,
                                        order: team.order !== undefined ? team.order : -1
                                    });
                                }
                            });
                        }
                    });
                }
            });
            setAllTeams(teamsList);
            console.log("onSnapshot: Celkový zoznam tímov aktualizovaný:", teamsList);
        }, (error) => {
            console.error("onSnapshot: Chyba pri načítaní tímov: ", error);
        });

        // Listener na zmeny v dokumente 'categories'
        const unsubscribeCategories = onSnapshot(categoriesRef, (docSnap) => {
            console.log("onSnapshot: Načítavam kategórie...");
            const categoryIdToName = {};
            if (docSnap.exists()) {
                const categoryData = docSnap.data();
                Object.entries(categoryData).forEach(([categoryId, categoryObject]) => {
                    if (categoryObject && categoryObject.name) {
                        categoryIdToName[categoryId] = categoryObject.name;
                    }
                });
            } else {
                console.log("onSnapshot: Dokument s kategóriami nebol nájdený!");
            }
            setCategoryIdToNameMap(categoryIdToName);
            console.log("onSnapshot: Mapa kategórií aktualizovaná:", categoryIdToName);
        }, (error) => {
            console.error("onSnapshot: Chyba pri načítaní kategórií: ", error);
        });

        // Listener na zmeny v dokumente 'groups'
        const unsubscribeGroups = onSnapshot(groupsRef, (docSnap) => {
            console.log("onSnapshot: Načítavam skupiny...");
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
            } else {
                console.log("onSnapshot: Dokument so skupinami nebol nájdený!");
            }
            setAllGroupsByCategoryId(groupsByCategoryId);
            console.log("onSnapshot: Skupiny rozdelené podľa kategórií aktualizované:", groupsByCategoryId);
        }, (error) => {
            console.error("onSnapshot: Chyba pri načítaní skupín: ", error);
        });
        
        // Funkcia na vyčistenie poslucháčov pri odpojení komponentu
        return () => {
            unsubscribeTeams();
            unsubscribeCategories();
            unsubscribeGroups();
            console.log("onSnapshot: Všetci poslucháči boli zrušení.");
        };

    }, []);

    // Filtered teams based on selected category and if they are not yet assigned to a group
    const teamsWithoutGroup = selectedCategoryId
        ? allTeams.filter(team => team.category === categoryIdToNameMap[selectedCategoryId] && !team.groupName)
        : allTeams.filter(team => !team.groupName);

    const teamsInGroups = selectedCategoryId
        ? allTeams.filter(team => team.category === categoryIdToNameMap[selectedCategoryId] && team.groupName)
        : allTeams.filter(team => team.groupName);

    // Helper function to get the correct background color class based on group type
    const getGroupColorClass = (type) => {
        switch (type) {
            case 'základná skupina':
                return 'bg-gray-100'; // Corresponds to 0xF3F4F6
            case 'nadstavbová skupina':
                return 'bg-blue-100'; // Corresponds to 0xDBEAFE
            default:
                return 'bg-white'; // Default fallback color
        }
    };

    /**
     * Uloží alebo odstráni názov skupiny k tímu v databáze.
     * @param {string} uid ID používateľa, ku ktorému tím patrí.
     * @param {string} category Kategória tímu.
     * @param {string} teamName Názov tímu, ktorý sa aktualizuje.
     * @param {string|null} groupName Názov skupiny, do ktorej sa tím presunul, alebo null ak sa odstraňuje.
     * @param {number|null} order Poradové číslo tímu v skupine, alebo null.
     */
    const updateTeamInDb = async (uid, category, teamName, groupName, order) => {
        if (!uid || !category || !teamName) {
            console.error("Nedostatočné údaje pre priradenie/odstránenie tímu zo skupiny.");
            window.showGlobalNotification("Nastala chyba: Chýbajú dáta pre priradenie tímu.", 'error');
            return;
        }

        try {
            const userRef = doc(window.db, 'users', uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const userData = userSnap.data();
                const teamsForCategory = userData.teams[category] || [];
                
                const updatedTeams = teamsForCategory.map(team => 
                    team.teamName === teamName ? { ...team, groupName, order } : team
                );

                await updateDoc(userRef, {
                    [`teams.${category}`]: updatedTeams
                });

                if (groupName) {
                    console.log(`Tím '${teamName}' bol úspešne priradený do skupiny '${groupName}' s poradím ${order}.`);
                    window.showGlobalNotification(`Tím '${teamName}' bol úspešne priradený do skupiny '${groupName}'.`, 'success');
                } else {
                    console.log(`Tím '${teamName}' bol úspešne odstránený zo skupiny.`);
                    window.showGlobalNotification(`Tím '${teamName}' bol úspešne vrátený do zoznamu tímov.`, 'success');
                }
            } else {
                console.error("Dokument používateľa nebol nájdený!");
                window.showGlobalNotification("Nastala chyba: Používateľský záznam nebol nájdený.", 'error');
            }
        } catch (error) {
            console.error("Chyba pri aktualizácii databázy:", error);
            window.showGlobalNotification("Nastala chyba pri ukladaní údajov do databázy.", 'error');
        }
    };
    
    /**
     * Uloží nové poradie tímov v databáze po reorderingu.
     * @param {string} category Kategória, v ktorej sa reorderuje.
     * @param {Array} updatedTeamList Nový zoznam tímov s aktualizovaným poradím.
     */
    const updateTeamOrderInDb = async (category, updatedTeamList) => {
        if (!category || !updatedTeamList) {
            console.error("Nedostatočné údaje pre aktualizáciu poradia tímov.");
            window.showGlobalNotification("Nastala chyba: Chýbajú dáta pre aktualizáciu poradia.", 'error');
            return;
        }
        
        // Zoskupíme tímy podľa UID, aby sme vykonali čo najmenej volaní na Firestore
        const teamsByUid = updatedTeamList.reduce((acc, team) => {
            acc[team.uid] = acc[team.uid] || [];
            acc[team.uid].push(team);
            return acc;
        }, {});
        
        try {
            const userUids = Object.keys(teamsByUid);
            for (const uid of userUids) {
                const userRef = doc(window.db, 'users', uid);
                const userSnap = await getDoc(userRef);
                
                if (userSnap.exists()) {
                    const userData = userSnap.data();
                    const teamsForCategory = userData.teams[category] || [];
                    
                    const updatedTeamsForDb = teamsForCategory.map(team => {
                        const updatedTeam = teamsByUid[uid].find(t => t.teamName === team.teamName);
                        return updatedTeam ? { ...team, order: updatedTeam.order } : team;
                    });
                    
                    await updateDoc(userRef, {
                        [`teams.${category}`]: updatedTeamsForDb
                    });
                }
            }
            console.log(`Poradie tímov v kategórii '${category}' bolo úspešne aktualizované.`);
            window.showGlobalNotification('Poradie tímov bolo úspešne zmenené.', 'success');
        } catch (error) {
            console.error("Chyba pri aktualizácii poradia tímov:", error);
            window.showGlobalNotification("Nastala chyba pri ukladaní poradia tímov.", 'error');
        }
    };
    
    const handleDragStart = (e, team) => {
        const teamCategoryId = Object.keys(categoryIdToNameMap).find(key => categoryIdToNameMap[key] === team.category);
        draggedItem.current = { team, teamCategoryId };
        
        e.dataTransfer.setData("text/plain", JSON.stringify(team));
        e.dataTransfer.effectAllowed = "move";
        
        console.log(`Začiatok presúvania: Tím '${team.teamName}'.`);
    };
    
    const handleDragOver = (e, targetTeam, targetGroupId, targetCategoryId) => {
        e.preventDefault();
        
        const dragData = draggedItem.current;
        if (!dragData) {
            e.dataTransfer.dropEffect = "none";
            return;
        }

        const teamCategoryId = dragData.teamCategoryId;
        if (targetCategoryId && teamCategoryId !== targetCategoryId) {
            e.dataTransfer.dropEffect = "none";
            return;
        }
        
        // Vizuálna indikácia pri presúvaní v rámci skupiny
        if (targetGroupId) {
            const teamsInTargetGroup = allTeams
                .filter(t => t.groupName === targetGroupId && t.category === categoryIdToNameMap[targetCategoryId])
                .sort((a, b) => a.order - b.order);
                
            const targetIndex = teamsInTargetGroup.findIndex(t => t.teamName === targetTeam.teamName);
            
            // Set drag over index only if the target is not the same as the dragged item
            if (dragData.team.teamName !== targetTeam.teamName || dragData.team.groupName !== targetGroupId) {
                 setDragOverIndex(targetIndex);
            }
            
            setDragOverGroupId(targetGroupId);
        } else {
            setDragOverIndex(null);
            setDragOverGroupId(null);
        }

        e.dataTransfer.dropEffect = "move";
    };
    
    const handleDrop = (e, targetGroup, targetCategoryId) => {
        e.preventDefault();
        const dragData = draggedItem.current;
        if (!dragData) {
            console.error("Žiadne dáta na pustenie.");
            return;
        }

        const teamData = dragData.team;
        const teamCategoryId = dragData.teamCategoryId;

        setDragOverIndex(null);
        setDragOverGroupId(null);

        // Kontrola, či sa presúva v rámci rovnakej kategórie
        if (targetCategoryId && teamCategoryId !== targetCategoryId) {
            window.showGlobalNotification("Skupina nepatrí do rovnakej kategórie ako tím.", 'error');
            return;
        }
        
        // Optimistická aktualizácia lokálneho stavu
        setAllTeams(prevTeams => {
            let updatedTeams;

            // Presun do novej skupiny alebo zrušenie priradenia
            if (teamData.groupName !== targetGroup) {
                updatedTeams = prevTeams.map(team => {
                    if (team.uid === teamData.uid && team.category === teamData.category && team.teamName === teamData.teamName) {
                        return { ...team, groupName: targetGroup, order: targetGroup ? 0 : -1 };
                    }
                    return team;
                });
                updateTeamInDb(teamData.uid, teamData.category, teamData.teamName, targetGroup, targetGroup ? 0 : -1);

            } else { // Reorder v rámci tej istej skupiny
                const teamsInTargetGroup = prevTeams
                    .filter(t => t.groupName === targetGroup && t.category === teamData.category)
                    .sort((a, b) => a.order - b.order);

                const draggedTeam = teamsInTargetGroup.find(t => t.uid === teamData.uid && t.teamName === teamData.teamName);
                if (!draggedTeam) return prevTeams;
                
                const sourceIndex = teamsInTargetGroup.findIndex(t => t.uid === draggedTeam.uid && t.teamName === draggedTeam.teamName);
                const targetIndex = dragOverIndex;

                if (sourceIndex === targetIndex || targetIndex === null) {
                    return prevTeams; // Zmena pozície je rovnaká alebo neplatná
                }

                // Odstránime tím z pôvodnej pozície
                teamsInTargetGroup.splice(sourceIndex, 1);
                
                // Vložíme tím na novú pozíciu
                teamsInTargetGroup.splice(targetIndex, 0, draggedTeam);

                // Aktualizujeme poradie a prefiltrujeme duplikáty
                const reorderedTeams = teamsInTargetGroup.map((team, index) => ({
                    ...team,
                    order: index
                }));
                
                // Vytvoríme nový, čistý stav pre všetky tímy
                const teamsNotInGroup = prevTeams.filter(t => t.groupName !== targetGroup || t.category !== teamData.category);
                updatedTeams = [...teamsNotInGroup, ...reorderedTeams];

                updateTeamOrderInDb(teamData.category, reorderedTeams);
                window.showGlobalNotification(`Poradie tímu '${teamData.teamName}' bolo zmenené.`, 'success');
            }
            return updatedTeams;
        });
    };

    const handleDragEnd = () => {
        draggedItem.current = null;
        setDragOverIndex(null);
        setDragOverGroupId(null);
    }

    const renderTeamList = (teamsToRender, title, targetGroupId, targetCategoryId) => {
        if (teamsToRender.length === 0) {
            return React.createElement(
                'p',
                { className: 'text-center text-gray-500' },
                'Žiadne tímy neboli nájdené.'
            );
        }
        
        const sortedTeams = [...teamsToRender].sort((a, b) => {
            if (a.groupName && b.groupName) {
                return a.order - b.order;
            }
            return a.teamName.localeCompare(b.teamName);
        });

        return React.createElement(
            'ul',
            { 
                className: 'space-y-2',
                onDragOver: (e) => handleDragOver(e, undefined, targetGroupId, targetCategoryId),
                onDrop: (e) => handleDrop(e, targetGroupId, targetCategoryId)
            },
            sortedTeams.map((team, index) =>
                React.createElement(
                    'div',
                    { key: `${team.uid}-${team.teamName}` },
                    (dragOverIndex === index && dragOverGroupId === targetGroupId) && (
                        React.createElement('div', { className: 'h-1 bg-blue-500 rounded-full my-2 animate-pulse' })
                    ),
                    React.createElement(
                        'li',
                        { 
                            className: 'px-4 py-2 bg-gray-100 rounded-lg text-gray-700 cursor-grab',
                            draggable: "true",
                            onDragStart: (e) => handleDragStart(e, team),
                            onDragOver: (e) => handleDragOver(e, team, targetGroupId, targetCategoryId),
                            onDrop: (e) => handleDrop(e, team.groupName, targetCategoryId),
                            onDragEnd: handleDragEnd
                        },
                        `${!selectedCategoryId ? `${team.category}: ` : ''}${team.teamName}`
                    )
                )
            )
        );
    };

    const renderGroupedCategories = () => {
        if (Object.keys(allGroupsByCategoryId).length === 0) {
            return React.createElement(
                'div',
                { className: 'w-full max-w-xl mx-auto' },
                React.createElement(
                    'p',
                    { className: 'text-center text-gray-500' },
                    'Žiadne skupiny neboli nájdené.'
                )
            );
        }

        const sortedCategoryIds = Object.keys(allGroupsByCategoryId).sort((a, b) => {
            const nameA = categoryIdToNameMap[a] || '';
            const nameB = categoryIdToNameMap[b] || '';
            return nameA.localeCompare(nameB);
        });

        return React.createElement(
            'div',
            { className: 'flex flex-wrap gap-4 justify-center' },
            sortedCategoryIds.map((categoryId, index) => {
                const groups = allGroupsByCategoryId[categoryId];
                const categoryName = categoryIdToNameMap[categoryId] || "Neznáma kategória";
                const teamsInThisCategory = allTeams.filter(team => team.category === categoryIdToNameMap[categoryId]);
                
                const sortedGroups = [...groups].sort((a, b) => {
                    if (a.type === 'základná skupina' && b.type !== 'základná skupina') {
                        return -1;
                    }
                    if (b.type === 'základná skupina' && a.type !== 'základná skupina') {
                        return 1;
                    }
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
                                    onDragOver: (e) => handleDragOver(e, undefined, group.name, categoryId),
                                    onDrop: (e) => handleDrop(e, group.name, categoryId)
                                },
                                React.createElement(
                                    'div',
                                    null,
                                    React.createElement(
                                        'p',
                                        { className: 'font-semibold whitespace-nowrap' },
                                        group.name
                                    ),
                                    React.createElement(
                                        'p',
                                        { className: 'text-sm text-gray-500 whitespace-nowrap' },
                                        group.type
                                    ),
                                    React.createElement(
                                        'ul',
                                        { className: 'mt-2 space-y-1' },
                                        teamsInThisCategory.filter(team => team.groupName === group.name).sort((a,b) => a.order - b.order).map((team, teamIndex) => 
                                            React.createElement(
                                                'div',
                                                { key: `${team.uid}-${team.teamName}` },
                                                (dragOverIndex === teamIndex && dragOverGroupId === group.name) && (
                                                    React.createElement('div', { className: 'h-1 bg-blue-500 rounded-full my-2 animate-pulse' })
                                                ),
                                                React.createElement(
                                                    'li',
                                                    { 
                                                        className: 'px-2 py-1 bg-white rounded-md text-gray-800 cursor-grab',
                                                        draggable: "true",
                                                        onDragStart: (e) => handleDragStart(e, team),
                                                        onDragOver: (e) => handleDragOver(e, team, group.name, categoryId),
                                                        onDrop: (e) => handleDrop(e, group.name, categoryId),
                                                        onDragEnd: handleDragEnd
                                                    },
                                                    team.teamName
                                                )
                                            )
                                        )
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
        const groups = allGroupsByCategoryId[selectedCategoryId] || [];
        
        const sortedGroups = [...groups].sort((a, b) => {
            if (a.type === 'základná skupina' && b.type !== 'základná skupina') {
                return -1;
            }
            if (b.type === 'základná skupina' && a.type !== 'základná skupina') {
                return 1;
            }
            return a.name.localeCompare(b.name);
        });

        return React.createElement(
            'div',
            { className: 'flex flex-col lg:flex-row justify-center space-x-0 lg:space-x-4 w-full px-4' },
            React.createElement(
                'div',
                { 
                    className: "w-full lg:w-1/4 max-w-sm bg-white rounded-xl shadow-xl p-8 mb-6 flex-shrink-0",
                    onDragOver: (e) => handleDragOver(e, undefined, null, selectedCategoryId),
                    onDrop: (e) => handleDrop(e, null, selectedCategoryId)
                },
                React.createElement(
                    'h3',
                    { className: 'text-2xl font-semibold mb-4 text-center' },
                    `Tímy v kategórii: ${categoryName}`
                ),
                teamsWithoutGroup.length > 0 ? (
                    renderTeamList(teamsWithoutGroup, `Tímy v kategórii: ${categoryName}`, null, selectedCategoryId)
                ) : (
                    React.createElement(
                        'p',
                        { className: 'text-center text-gray-500' },
                        'Žiadne tímy na priradenie.'
                    )
                )
            ),
            React.createElement(
                'div',
                { className: 'flex-grow min-w-0 flex flex-col gap-4' },
                sortedGroups.length > 0 ? (
                    sortedGroups.map((group, groupIndex) =>
                        React.createElement(
                            'div',
                            { 
                                key: groupIndex, 
                                className: `flex flex-col rounded-xl shadow-xl p-8 mb-6 flex-shrink-0 ${getGroupColorClass(group.type)}`,
                                onDragOver: (e) => handleDragOver(e, undefined, group.name, selectedCategoryId),
                                onDrop: (e) => handleDrop(e, group.name, selectedCategoryId)
                            },
                            React.createElement(
                                'h3',
                                { className: 'text-2xl font-semibold mb-4 text-center whitespace-nowrap' },
                                group.name
                            ),
                            React.createElement(
                                'ul',
                                { className: 'space-y-2' },
                                teamsInGroups.filter(team => team.groupName === group.name).sort((a,b) => a.order - b.order).map((team, teamIndex) => 
                                    React.createElement(
                                        'div',
                                        { key: `${team.uid}-${team.teamName}` },
                                        (dragOverIndex === teamIndex && dragOverGroupId === group.name) && (
                                            React.createElement('div', { className: 'h-1 bg-blue-500 rounded-full my-2 animate-pulse' })
                                        ),
                                        React.createElement(
                                            'li',
                                            { 
                                                className: 'px-2 py-1 bg-white rounded-md text-gray-800 cursor-grab',
                                                draggable: "true",
                                                onDragStart: (e) => handleDragStart(e, team),
                                                onDragOver: (e) => handleDragOver(e, team, group.name, categoryId),
                                                onDrop: (e) => handleDrop(e, group.name, categoryId),
                                                onDragEnd: handleDragEnd
                                            },
                                            team.teamName
                                        )
                                    )
                                )
                            )
                        )
                    )
                ) : (
                    React.createElement(
                        'p',
                        { className: 'text-center text-gray-500' },
                        'Žiadne skupiny v tejto kategórii.'
                    )
                )
            )
        );
    };
    
    const sortedCategoryEntries = Object.entries(categoryIdToNameMap)
        .sort(([, nameA], [, nameB]) => nameA.localeCompare(nameB));

    return React.createElement(
        'div',
        { className: 'flex flex-col w-full' },
        React.createElement(
            'div',
            { className: 'w-full max-w-xs mx-auto mb-8' },
            React.createElement(
                'label',
                { className: 'block text-center text-xl font-semibold mb-2' },
                'Vyberte kategóriu:'
            ),
            React.createElement(
                'select',
                {
                    className: 'w-full px-4 py-2 rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200',
                    value: selectedCategoryId,
                    onChange: (e) => setSelectedCategoryId(e.target.value)
                },
                React.createElement(
                    'option',
                    { value: '' },
                    'Všetky kategórie'
                ),
                sortedCategoryEntries.map(([id, name]) =>
                    React.createElement(
                        'option',
                        { key: id, value: id },
                        name
                    )
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
                        onDragOver: (e) => handleDragOver(e, undefined, null, null),
                        onDrop: (e) => handleDrop(e, null, null) 
                    },
                    React.createElement(
                        'h3',
                        { className: 'text-2xl font-semibold mb-4 text-center' },
                        'Zoznam všetkých tímov'
                    ),
                    renderTeamList(teamsWithoutGroup, 'Zoznam všetkých tímov', null, null)
                ),
                React.createElement(
                    'div',
                    { className: 'flex-grow min-w-0' },
                    renderGroupedCategories()
                )
            )
    );
};


// Premenná na sledovanie, či bol poslucháč už nastavený
let isEmailSyncListenerSetup = false;

/**
 * Táto funkcia je poslucháčom udalosti 'globalDataUpdated'.
 * Akonáhle sa dáta používateľa načítajú, vykreslí aplikáciu MyDataApp.
 */
const handleDataUpdateAndRender = (event) => {
    const userProfileData = event.detail;
    const rootElement = document.getElementById('root');

    if (userProfileData) {
        if (window.auth && window.db && !isEmailSyncListenerSetup) {
            console.log("logged-in-teams-in-groups.js: Nastavujem poslucháča na synchronizáciu e-mailu.");
            
            onAuthStateChanged(window.auth, async (user) => {
                if (user) {
                    try {
                        const userProfileRef = doc(window.db, 'users', user.uid);
                        const docSnap = await getDoc(userProfileRef);
            
                        if (docSnap.exists()) {
                            const firestoreEmail = docSnap.data().email;
                            if (user.email !== firestoreEmail) {
                                console.log(`logged-in-teams-in-groups.js: E-mail v autentifikácii (${user.email}) sa líši od e-mailu vo Firestore (${firestoreEmail}). Aktualizujem...`);
                                
                                await updateDoc(userProfileRef, {
                                    email: user.email
                                });
            
                                const notificationsCollectionRef = collection(window.db, 'notifications');
                                await addDoc(notificationsCollectionRef, {
                                    userEmail: user.email,
                                    changes: `Zmena e-mailovej adresy z '${firestoreEmail}' na '${user.email}'.`,
                                    timestamp: new Date(),
                                });
                                
                                window.showGlobalNotification('E-mailová adresa bola automaticky aktualizovaná a synchronizovaná.', 'success');
                                console.log("logged-in-teams-in-groups.js: E-mail vo Firestore bol aktualizovaný a notifikácia vytvorená.");
            
                            } else {
                                console.log("logged-in-teams-in-groups.js: E-maily sú synchronizované, nie je potrebné nič aktualizovať.");
                            }
                        }
                    } catch (error) {
                        console.error("logged-in-teams-in-groups.js: Chyba pri porovnávaní a aktualizácii e-mailu:", error);
                        window.showGlobalNotification('Nastala chyba pri synchronizácii e-mailovej adresy.', 'error');
                    }
                }
            });
            isEmailSyncListenerSetup = true;
        }

        if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
            const root = ReactDOM.createRoot(rootElement);
            root.render(React.createElement(AddGroupsApp, { userProfileData }));
            console.log("logged-in-teams-in-groups.js: Aplikácia bola vykreslená po udalosti 'globalDataUpdated'.");
        } else {
            console.error("logged-in-teams-in-groups.js: HTML element 'root' alebo React/ReactDOM nie sú dostupné.");
        }
    } else {
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
        console.error("logged-in-teams-in-groups.js: Dáta používateľa nie sú dostupné v udalosti 'globalDataUpdated'. Zobrazujem loader.");
    }
};

console.log("logged-in-teams-in-groups.js: Registrujem poslucháča pre 'globalDataUpdated'.");
window.addEventListener('globalDataUpdated', handleDataUpdateAndRender);

console.log("logged-in-teams-in-groups.js: Kontrolujem, či existujú globálne dáta.");
if (window.globalUserProfileData) {
    console.log("logged-in-teams-in-groups.js: Globálne dáta už existujú. Vykresľujem aplikáciu okamžite.");
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
