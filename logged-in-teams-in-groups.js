// Importy pre Firebase funkcie
import { doc, getDoc, onSnapshot, updateDoc, addDoc, collection, Timestamp, query, getDocs, runTransaction, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";


const { useState, useEffect, useRef } = React;

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
    
    // Používame useRef na uloženie dát presúvaného tímu
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

        // POZNÁMKA K CHYBÁM 429:
        // Načítavanie celej kolekcie 'users' pomocou onSnapshot môže viesť k chybám
        // 'Too Many Requests' (429), ak je kolekcia príliš veľká alebo sa často mení.
        // Pre malé aplikácie je to akceptovateľné, no pre rozsiahle systémy by bolo lepšie
        // zvážiť iný dátový model (napr. mať samostatnú verejnú kolekciu 'teams').
        // Súčasný prístup je nutný, aby bolo možné zobraziť tímy od všetkých používateľov.
        
        // Listener pre tímy
        const usersRef = collection(window.db, 'users');
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
                                        ...team
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

        // Listener pre kategórie
        const categoriesRef = doc(window.db, 'settings', 'categories');
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

        // Listener pre skupiny
        const groupsRef = doc(window.db, 'settings', 'groups');
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

    const teamsWithoutGroup = selectedCategoryId
        ? allTeams.filter(team => team.category === categoryIdToNameMap[selectedCategoryId] && !team.groupName)
        : allTeams.filter(team => !team.groupName);

    const teamsInGroups = selectedCategoryId
        ? allTeams.filter(team => team.category === categoryIdToNameMap[selectedCategoryId] && team.groupName)
        : allTeams.filter(team => team.groupName);

    // Helper funkcia na získanie správnej triedy farby pozadia na základe typu skupiny
    const getGroupColorClass = (type) => {
        switch (type) {
            case 'základná skupina':
                return 'bg-gray-100';
            case 'nadstavbová skupina':
                return 'bg-blue-100';
            default:
                return 'bg-white';
        }
    };
    
    /**
     * Aktualizuje stav a databázu po presune tímu.
     * @param {string} draggedTeamData Tím, ktorý sa presúva.
     * @param {string|null} targetGroup Názov cieľovej skupiny alebo null pre zoznam nepriradených tímov.
     * @param {number|null} targetIndex Index, kam sa má tím vložiť. Ak je null, pridá sa na koniec zoznamu.
     */
    const handleDrop = async (e, targetGroup, targetCategoryId) => {
        e.preventDefault();
        const dragData = draggedItem.current;
        if (!dragData) {
            console.error("Žiadne dáta na pustenie.");
            return;
        }

        const teamData = dragData.team;
        const teamCategoryId = dragData.teamCategoryId;
        
        // Kontrola, či sa presúva v rámci rovnakej kategórie
        if (targetCategoryId && teamCategoryId !== targetCategoryId) {
            window.showGlobalNotification("Skupina nepatrí do rovnakej kategórie ako tím.", 'error');
            return;
        }
        
        const categoryName = categoryIdToNameMap[teamCategoryId];
        const userRef = doc(window.db, 'users', teamData.uid);
        
        try {
            const userDocSnap = await getDoc(userRef);
            if (!userDocSnap.exists()) {
                throw new Error("Dokument používateľa neexistuje!");
            }
            const userData = userDocSnap.data();
            const teamsInCategory = userData.teams?.[categoryName] || [];
            
            // Nájdeme index tímu, ktorý presúvame
            const teamIndex = teamsInCategory.findIndex(t => t.teamName === teamData.teamName);
            if (teamIndex === -1) {
                throw new Error("Presúvaný tím sa nenašiel v databáze.");
            }
            
            // Zmeníme skupinu pre tím, ktorý sa presúva
            teamsInCategory[teamIndex].groupName = targetGroup;
            
            // Vypočítame nové poradie
            if (targetGroup !== null) {
                const teamsInTargetGroup = teamsInCategory.filter(t => t.groupName === targetGroup);
                const newOrder = teamsInTargetGroup.length - 1; // Nový tím bude mať posledné poradie
                teamsInCategory[teamIndex].order = newOrder;
            } else {
                delete teamsInCategory[teamIndex].order; // Ak sa tím presúva mimo skupiny, odstránime poradie
            }

            // Prečíslovanie všetkých skupín (pre istotu)
            // Urobíme to tak, že prejdeme skupiny a prečislujeme ich
            const allGroupsInThisCategory = [...new Set(teamsInCategory.map(t => t.groupName).filter(g => g !== null))];
            allGroupsInThisCategory.forEach(group => {
                const teamsInGroup = teamsInCategory.filter(t => t.groupName === group).sort((a,b) => a.order - b.order);
                teamsInGroup.forEach((team, index) => {
                    const originalIndex = teamsInCategory.findIndex(t => t.teamName === team.teamName && t.category === team.category);
                    teamsInCategory[originalIndex].order = index;
                });
            });

            await updateDoc(userRef, {
                teams: {
                    ...userData.teams,
                    [categoryName]: teamsInCategory
                }
            });
            window.showGlobalNotification(`Tím '${teamData.teamName}' bol úspešne presunutý.`, 'success');
        } catch (error) {
            console.error("Chyba pri aktualizácii databázy:", error);
            window.showGlobalNotification("Nastala chyba pri ukladaní údajov do databázy.", 'error');
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
        
        e.dataTransfer.dropEffect = "move";
    };
    
    const handleDragEnd = () => {
        draggedItem.current = null;
    }
    
    const renderTeamList = (teamsToRender, targetGroupId, targetCategoryId) => {
        const sortedTeams = [...teamsToRender].sort((a, b) => {
            if (a.groupName && b.groupName) {
                return a.order - b.order;
            }
            return a.teamName.localeCompare(b.teamName);
        });
        
        // Ak zoznam tímov neobsahuje žiadne tímy, vytvoríme drop-zónu.
        if (sortedTeams.length === 0) {
            return React.createElement(
                'div',
                {
                    className: `min-h-[50px] p-2 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center`,
                    onDragOver: (e) => handleDragOver(e, null, targetGroupId, targetCategoryId),
                    onDrop: (e) => handleDrop(e, targetGroupId, targetCategoryId),
                },
                React.createElement('p', { className: 'text-center text-gray-400' }, 'Sem presuňte tím')
            );
        }
        
        return React.createElement(
            'ul',
            { 
                className: 'space-y-2'
            },
            sortedTeams.map((team, index) => {
                const teamText = team.groupName != null ? `${team.order + 1}. ${team.teamName}` : team.teamName;
                
                return React.createElement(
                    'li',
                    {
                        key: `${team.uid}-${team.teamName}-${team.groupName}`,
                        className: `px-4 py-2 bg-gray-100 rounded-lg text-gray-700 cursor-grab`,
                        draggable: "true",
                        onDragStart: (e) => handleDragStart(e, team),
                        onDragEnd: handleDragEnd
                    },
                    `${!selectedCategoryId ? `${team.category}: ` : ''}${teamText}`
                );
            })
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
                        { 
                          className: 'text-2xl font-semibold mb-4 text-center whitespace-nowrap cursor-pointer',
                          onDragOver: (e) => handleDragOver(e, null, null, categoryId),
                          // Pustenie na názov kategórie (všetky tímy sa vrátia do zoznamu bez skupiny)
                          onDrop: (e) => handleDrop(e, null, categoryId) 
                        },
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
                                    onDragOver: (e) => handleDragOver(e, null, group.name, categoryId),
                                    // Pustenie na názov skupiny: tím sa pridá na koniec skupiny (index: null)
                                    onDrop: (e) => handleDrop(e, group.name, categoryId),
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
                    onDragOver: (e) => handleDragOver(e, null, null, selectedCategoryId),
                    onDrop: (e) => handleDrop(e, null, selectedCategoryId),
                },
                React.createElement(
                    'h3',
                    { className: 'text-2xl font-semibold mb-4 text-center' },
                    `Tímy v kategórii: ${categoryName}`
                ),
                renderTeamList(teamsWithoutGroup, null, selectedCategoryId)
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
                                onDragOver: (e) => handleDragOver(e, null, group.name, selectedCategoryId),
                                // Pustenie na názov skupiny: tím sa pridá na koniec skupiny (index: null)
                                onDrop: (e) => handleDrop(e, group.name, selectedCategoryId),
                            },
                            React.createElement(
                                'h3',
                                { className: 'text-2xl font-semibold mb-4 text-center whitespace-nowrap' },
                                group.name
                            ),
                            React.createElement(
                                'div',
                                { className: 'mt-2 space-y-1' },
                                renderTeamList(teamsInGroups.filter(team => team.groupName === group.name), group.name, selectedCategoryId)
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
                        onDragOver: (e) => handleDragOver(e, null, null, null),
                        onDrop: (e) => handleDrop(e, null, null),
                    },
                    React.createElement(
                        'h3',
                        { className: 'text-2xl font-semibold mb-4 text-center' },
                        'Zoznam všetkých tímov'
                    ),
                    renderTeamList(teamsWithoutGroup, null, null)
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
