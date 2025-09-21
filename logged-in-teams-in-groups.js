// Importy pre Firebase funkcie
import { doc, getDoc, onSnapshot, updateDoc, addDoc, collection, Timestamp, query, getDocs, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
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
    notificationElement.className = `${baseClasses} ${typeClasses} opacity-100 scale-100`;
    notificationElement.textContent = message;
    setTimeout(() => {
        notificationElement.className = `${baseClasses} ${typeClasses} opacity-0 scale-95`;
    }, 5000);
};

const AddGroupsApp = ({ userProfileData }) => {
    const [allTeams, setAllTeams] = useState([]);
    const [allGroupsByCategoryId, setAllGroupsByCategoryId] = useState({});
    const [categoryIdToNameMap, setCategoryIdToNameMap] = useState({});
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [nextOrderMap, setNextOrderMap] = useState({});

    // Stav pre drag & drop
    const draggedItem = useRef(null);
    const lastDragOverGroup = useRef(null); // Ref na uloženie poslednej skupiny, nad ktorou bol kurzor

    // Načítanie kategórie z URL hashu
    useEffect(() => {
        const hash = window.location.hash.substring(1);
        if (hash) {
            setSelectedCategoryId(hash);
        }
    }, []);

    // Synchronizácia URL hashu
    useEffect(() => {
        if (selectedCategoryId) {
            window.location.hash = selectedCategoryId;
        } else {
            window.location.hash = '';
        }
    }, [selectedCategoryId]);

    // Načítanie dát z Firebase
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
            // Vypočítanie nextOrderMap na základe aktuálnych dát
            teamsList.forEach(team => {
                if (team.groupName) {
                    const key = `${team.category}-${team.groupName}`;
                    if (!newNextOrderMap[key] || team.order >= newNextOrderMap[key]) {
                        newNextOrderMap[key] = (team.order || 0) + 1;
                    }
                }
            });
            setNextOrderMap(newNextOrderMap);
            // Logovanie do konzoly v novom prehľadnom formáte
            const teamsByCategoryAndGroup = teamsList.reduce((acc, team) => {
                const category = team.category;
                const group = team.groupName || 'Tímy bez skupiny';
                if (!acc[category]) {
                    acc[category] = {};
                }
                if (!acc[category][group]) {
                    acc[category][group] = [];
                }
                acc[category][group].push(team);
                return acc;
            }, {});

            console.log("Stav tímov po načítaní:");
            console.log("-----------------------------------------");
            Object.entries(teamsByCategoryAndGroup).forEach(([category, groups]) => {
                console.log(`\nKategória: ${category}`);
                Object.entries(groups).forEach(([groupName, teams]) => {
                    if (groupName === 'Tímy bez skupiny') {
                        // Tímy bez skupiny abecedne
                        const sortedTeams = teams.sort((a, b) => a.teamName.localeCompare(b.teamName));
                        console.log(`\n-- ${groupName} (Počet tímov: ${teams.length}) --`);
                        console.table(sortedTeams.map(team => ({
                            'Názov tímu': team.teamName,
                            'Poradie v databáze': team.order || null,
                        })));
                    } else {
                        // Tímy v skupine podla poradia
                        const sortedTeams = teams.sort((a, b) => (a.order || 0) - (b.order || 0));
                        const nextOrder = newNextOrderMap[`${category}-${groupName}`] || 1;
                        console.log(`\n-- Skupina: ${groupName} (Počet tímov: ${teams.length}, Ďalšie poradie: ${nextOrder}) --`);
                        console.table(sortedTeams.map((team) => ({
                            'Názov tímu': team.teamName,
                            'Poradie v skupine': team.order
                        })));
                    }
                });
                console.log("-----------------------------------------");
            });
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

    const handleDragOver = (e, targetGroup, targetCategoryId) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";

        // Kontrola, či sa kurzor presunul nad novú skupinu
        if (lastDragOverGroup.current !== targetGroup) {
            lastDragOverGroup.current = targetGroup;
            const teamsInTargetGroup = allTeams.filter(t => t.groupName === targetGroup);
            const nextOrder = nextOrderMap[`${categoryIdToNameMap[targetCategoryId]}-${targetGroup}`] || 1;

            console.log("--- Drag & Drop Informácie ---");
            console.log(`Cieľová skupina: ${targetGroup || 'bez skupiny'}`);
            console.log(`Počet tímov v skupine: ${teamsInTargetGroup.length}`);
            console.log(`Nasledujúce poradie pre nový tím: ${nextOrder}`);
            console.log("-------------------------------");
        }
    };

    const handleDrop = async (e, targetGroup, targetCategoryId) => {
        e.preventDefault();
        const dragData = draggedItem.current;
        if (!dragData) {
            console.error("Žiadne dáta na presunutie.");
            return;
        }
        const teamData = dragData.team;
        const teamCategoryId = dragData.teamCategoryId;
        const originalGroup = teamData.groupName;

        if (originalGroup === targetGroup) {
            console.log("Zablokovaný presun tímu: rovnaká počiatočná aj cieľová skupina.");
            return;
        }
        if (targetCategoryId && teamCategoryId !== targetCategoryId) {
            window.showGlobalNotification("Skupina nepatrí do rovnakej kategórie ako tím.", 'error');
            return;
        }

        const categoryName = categoryIdToNameMap[teamCategoryId];
        const userRef = doc(window.db, 'users', teamData.uid);

        try {
            const nextOrder = nextOrderMap[`${categoryName}-${targetGroup}`] || 1;
            console.log(`Používam poradie z onSnapshot: ${nextOrder}`);

            const userDocSnap = await getDoc(userRef);
            if (!userDocSnap.exists()) {
                throw new Error("Dokument používateľa neexistuje!");
            }
            const userData = userDocSnap.data();
            const teamsByCategory = userData.teams;
            const currentCategoryTeams = teamsByCategory[categoryName] || [];

            // Vytvoríme novú sadu tímov a prečíslovanie pôvodnej skupiny
            let updatedTeams = [];
            let teamsInOriginalGroup = [];
            let movedTeamData = null;

            // Roztriedenie tímov
            currentCategoryTeams.forEach(team => {
                if (team.teamName === teamData.teamName) {
                    // Presunutý tím
                    movedTeamData = targetGroup
                        ? { ...team, groupName: targetGroup, order: nextOrder }
                        : { ...team, groupName: null, order: null };
                } else if (team.groupName === originalGroup) {
                    // Tímy, ktoré zostali v pôvodnej skupine
                    teamsInOriginalGroup.push(team);
                } else {
                    // Tímy, ktoré nepatria ani do pôvodnej ani do novej skupiny
                    updatedTeams.push(team);
                }
            });

            // Prečíslovanie zostávajúcich tímov v pôvodnej skupine
            teamsInOriginalGroup.sort((a, b) => (a.order || 0) - (b.order || 0));
            const reorderedOriginalTeams = teamsInOriginalGroup.map((team, index) => ({
                ...team,
                order: index + 1
            }));

            // Spojenie všetkých tímov do jedného poľa
            if (movedTeamData) {
                updatedTeams.push(movedTeamData);
            }
            updatedTeams = [...updatedTeams, ...reorderedOriginalTeams];

            // Aktualizácia dokumentu
            await updateDoc(userRef, {
                teams: {
                    ...teamsByCategory,
                    [categoryName]: updatedTeams
                }
            });

            window.showGlobalNotification(`Tím '${teamData.teamName}' bol úspešne pridaný do skupiny '${targetGroup || "bez skupiny"}'.`, 'success');
        } catch (error) {
            console.error("Chyba pri aktualizácii databázy:", error);
            window.showGlobalNotification("Nastala chyba pri ukladaní údajov do databázy.", 'error');
        } finally {
            console.log("----- Koniec operácie Drag & Drop -----");
        }
    };

    const handleDragStart = (e, team) => {
        const teamCategoryId = Object.keys(categoryIdToNameMap).find(key => categoryIdToNameMap[key] === team.category);
        draggedItem.current = { team, teamCategoryId };
        e.dataTransfer.setData("text/plain", JSON.stringify(team));
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragEnd = () => {
        draggedItem.current = null;
        lastDragOverGroup.current = null;
    };

    const renderTeamList = (teamsToRender, targetGroupId, targetCategoryId) => {
        const sortedTeams = [...teamsToRender].sort((a, b) => {
            if (a.groupName && b.groupName) {
                return (a.order || 0) - (b.order || 0);
            } else {
                return a.teamName.localeCompare(b.teamName);
            }
        });

        if (sortedTeams.length === 0 && targetGroupId) {
            return React.createElement(
                'div',
                {
                    className: `min-h-[50px] p-2 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center`,
                    onDragOver: (e) => handleDragOver(e, targetGroupId, targetCategoryId),
                    onDrop: (e) => handleDrop(e, targetGroupId, targetCategoryId),
                },
                React.createElement('p', { className: 'text-center text-gray-400' }, 'Sem presuňte tím')
            );
        }

        return React.createElement(
            'ul',
            { className: 'space-y-2 relative' },
            sortedTeams.map((team, index) => {
                const teamNameWithOrder = team.groupName && team.order != null ? `${team.order}. ${team.teamName}` : team.teamName;
                return React.createElement(
                    'li',
                    {
                        key: `${team.uid}-${team.teamName}-${team.groupName}-${index}`,
                        className: `px-4 py-2 bg-gray-100 rounded-lg text-gray-700 cursor-grab`,
                        draggable: "true",
                        onDragStart: (e) => handleDragStart(e, team),
                        onDragEnd: handleDragEnd,
                    },
                    `${!selectedCategoryId && team.category ? `${team.category}: ` : ''}${teamNameWithOrder}`
                );
            })
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
                                    onDragOver: (e) => handleDragOver(e, group.name, categoryId),
                                    onDrop: (e) => handleDrop(e, group.name, categoryId),
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
        const groups = allGroupsByCategoryId[selectedCategoryId] || [];

        const sortedGroups = [...groups].sort((a, b) => {
            if (a.type === 'základná skupina' && b.type !== 'základná skupina') return -1;
            if (b.type === 'základná skupina' && a.type !== 'základná skupina') return 1;
            return a.name.localeCompare(b.name);
        });
        return React.createElement(
            'div',
            { className: 'flex flex-col lg:flex-row justify-center space-x-0 lg:space-x-4 w-full px-4' },
            React.createElement(
                'div',
                {
                    className: "w-full lg:w-1/4 max-w-sm bg-white rounded-xl shadow-xl p-8 mb-6 flex-shrink-0",
                    onDragOver: (e) => handleDragOver(e, null, selectedCategoryId),
                    onDrop: (e) => handleDrop(e, null, selectedCategoryId),
                },
                React.createElement('h3', { className: 'text-2xl font-semibold mb-4 text-center' }, `Tímy v kategórii: ${categoryName}`),
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
                                onDragOver: (e) => handleDragOver(e, group.name, selectedCategoryId),
                                onDrop: (e) => handleDrop(e, group.name, selectedCategoryId),
                            },
                            React.createElement('h3', { className: 'text-2xl font-semibold mb-4 text-center whitespace-nowrap' }, group.name),
                            React.createElement(
                                'div',
                                { className: 'mt-2 space-y-1' },
                                renderTeamList(teamsInGroups.filter(team => team.groupName === group.name), group.name, selectedCategoryId)
                            )
                        )
                    )
                ) : (
                    React.createElement('p', { className: 'text-center text-gray-500' }, 'Žiadne skupiny v tejto kategórii.')
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
            React.createElement('label', { className: 'block text-center text-xl font-semibold mb-2' }, 'Vyberte kategóriu:'),
            React.createElement(
                'select',
                {
                    className: 'w-full px-4 py-2 rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200',
                    value: selectedCategoryId,
                    onChange: (e) => setSelectedCategoryId(e.target.value)
                },
                React.createElement('option', { value: '' }, 'Všetky kategórie'),
                sortedCategoryEntries.map(([id, name]) =>
                    React.createElement('option', { key: id, value: id }, name)
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
                        onDragOver: (e) => handleDragOver(e, null, null),
                        onDrop: (e) => handleDrop(e, null, null),
                    },
                    React.createElement('h3', { className: 'text-2xl font-semibold mb-4 text-center' }, 'Zoznam všetkých tímov'),
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

// Inicializácia aplikácie
let isEmailSyncListenerSetup = false;
const handleDataUpdateAndRender = (event) => {
    const userProfileData = event.detail;
    const rootElement = document.getElementById('root');
    if (userProfileData) {
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
                                window.showGlobalNotification('E-mailová adresa bola automaticky aktualizovaná a synchronizovaná.', 'success');
                            }
                        }
                    } catch (error) {
                        console.error("Chyba pri synchronizácii e-mailu:", error);
                        window.showGlobalNotification('Nastala chyba pri synchronizácii e-mailovej adresy.', 'error');
                    }
                }
            });
            isEmailSyncListenerSetup = true;
        }
        if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
            const root = ReactDOM.createRoot(rootElement);
            root.render(React.createElement(AddGroupsApp, { userProfileData }));
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
