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
    setTimeout(() => {
        notificationElement.className = `${baseClasses} ${typeClasses} opacity-100 scale-100`;
    }, 10);
    setTimeout(() => {
        notificationElement.className = `${baseClasses} ${typeClasses} opacity-0 scale-95`;
    }, 5000);
};

const AddGroupsApp = ({ userProfileData }) => {
    const [allTeams, setAllTeams] = useState([]);
    const [allGroupsByCategoryId, setAllGroupsByCategoryId] = useState({});
    const [categoryIdToNameMap, setCategoryIdToNameMap] = useState({});
    const [selectedCategoryId, setSelectedCategoryId] = useState('');

    // Stav pre drag & drop
    const draggedItem = useRef(null);
    const [dropIndicator, setDropIndicator] = useState({
        groupName: null,
        categoryId: null,
        index: null,
        position: null,
    });

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
        ? allTeams.filter(team => team.category === categoryIdToNameMap[selectedCategoryId] && !team.groupName)
        : allTeams.filter(team => !team.groupName);

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

    const handleDragOver = (e, targetTeam, targetGroupId, targetCategoryId, index) => {
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
        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const isTopHalf = y < rect.height / 2;
        setDropIndicator({
            groupName: targetGroupId,
            categoryId: targetCategoryId,
            index: index,
            position: isTopHalf ? 'top' : 'bottom',
        });
    };

    const handleDrop = async (e, targetGroup, targetCategoryId, targetIndex) => {
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
            // Vytvoríme kópiu poľa tímov, s ktorou budeme pracovať
            const teamsInCategory = [...(userData.teams?.[categoryName] || [])];

            // Nájdeme a odstránime presúvaný tím z pôvodného zoznamu
            const remainingTeams = teamsInCategory.filter(t => t.teamName !== teamData.teamName);
            const movedTeam = teamsInCategory.find(t => t.teamName === teamData.teamName);

            if (!movedTeam) {
                throw new Error("Presúvaný tím sa nenašiel v databáze.");
            }

            // Aktualizujeme skupinu pre presúvaný tím
            movedTeam.groupName = targetGroup;

            // Rozdelíme zostávajúce tímy na tie v cieľovej skupine a ostatné
            let teamsInTargetGroup = remainingTeams.filter(t => t.groupName === targetGroup);
            const otherTeams = remainingTeams.filter(t => t.groupName !== targetGroup);
            
            // Vložíme presunutý tím na správnu pozíciu v rámci cieľovej skupiny
            const newTeamsInTargetGroup = [...teamsInTargetGroup];
            newTeamsInTargetGroup.splice(targetIndex, 0, movedTeam);

            // Prepočítame poradie pre všetky tímy v cieľovej skupine.
            newTeamsInTargetGroup.forEach((team, index) => {
                team.order = index;
            });

            // Spojíme zoznamy späť do jedného poľa pre uloženie
            const finalTeams = [...newTeamsInTargetGroup, ...otherTeams];

            // Aktualizácia databázy
            await updateDoc(userRef, {
                teams: {
                    ...userData.teams,
                    [categoryName]: finalTeams
                }
            });

            window.showGlobalNotification(`Tím '${teamData.teamName}' bol úspešne presunutý.`, 'success');
        } catch (error) {
            console.error("Chyba pri aktualizácii databázy:", error);
            window.showGlobalNotification("Nastala chyba pri ukladaní údajov do databázy.", 'error');
        } finally {
            setDropIndicator({ groupName: null, categoryId: null, index: null, position: null });
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
        setDropIndicator({ groupName: null, categoryId: null, index: null, position: null });
    };

const renderTeamList = (teamsToRender, targetGroupId, targetCategoryId) => {
    // Rozdelíme tímy na tie s poradím a tie bez
    const teamsWithOrder = teamsToRender.filter(team => team.order !== undefined);
    const teamsWithoutOrder = teamsToRender.filter(team => team.order === undefined);

    // Zoradíme tímy, ktoré majú poradie
    const sortedTeamsWithOrder = teamsWithOrder.sort((a, b) => a.order - b.order);

    // Zvyšné tímy zoradíme abecedne
    const sortedTeamsWithoutOrder = teamsWithoutOrder.sort((a, b) => a.teamName.localeCompare(b.teamName));

    // Spojíme oba zoznamy
    const sortedTeams = [...sortedTeamsWithOrder, ...sortedTeamsWithoutOrder];

    // Ak zoznam tímov neobsahuje žiadne tímy, vytvoríme drop-zónu.
    if (sortedTeams.length === 0) {
        return React.createElement(
            'div',
            {
                className: `min-h-[50px] p-2 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center`,
                onDragOver: (e) => handleDragOver(e, null, targetGroupId, targetCategoryId, 0),
                onDrop: (e) => handleDrop(e, targetGroupId, targetCategoryId, 0),
            },
            React.createElement('p', { className: 'text-center text-gray-400' }, 'Sem presuňte tím')
        );
    }

    return React.createElement(
        'ul',
        { className: 'space-y-2 relative' },
        sortedTeams.map((team, index) => {
            // Indikátor nad týmto prvkom
            const showTopIndicator =
                dropIndicator.groupName === targetGroupId &&
                dropIndicator.categoryId === targetCategoryId &&
                dropIndicator.index === index &&
                dropIndicator.position === 'top';

            // Indikátor pod týmto prvkom
            const showBottomIndicator =
                dropIndicator.groupName === targetGroupId &&
                dropIndicator.categoryId === targetCategoryId &&
                dropIndicator.index === index &&
                dropIndicator.position === 'bottom';

            return React.createElement(
                React.Fragment,
                { key: `${team.uid}-${team.teamName}-${team.groupName}-${index}` },
                // Indikátor nad prvkom
                showTopIndicator && React.createElement('div', {
                    className: 'h-1 bg-blue-500 w-full my-1 rounded-full',
                }),
                // Samotný tím
                React.createElement(
                    'li',
                    {
                        className: `px-4 py-2 bg-gray-100 rounded-lg text-gray-700 cursor-grab`,
                        draggable: "true",
                        onDragStart: (e) => handleDragStart(e, team),
                        onDragEnd: handleDragEnd,
                        onDragOver: (e) => handleDragOver(e, team, targetGroupId, targetCategoryId, index),
                        onDrop: (e) => handleDrop(e, targetGroupId, targetCategoryId, index),
                    },
                    `${!selectedCategoryId ? `${team.category}: ` : ''}${team.groupName != null ? `${team.order + 1}. ${team.teamName}` : team.teamName}`
                ),
                // Indikátor pod prvkom
                showBottomIndicator && React.createElement('div', {
                    className: 'h-1 bg-blue-500 w-full my-1 rounded-full',
                }),
            );
        }),
        // Indikátor na konci zoznamu
        dropIndicator.groupName === targetGroupId &&
        dropIndicator.categoryId === targetCategoryId &&
        dropIndicator.index === sortedTeams.length &&
        dropIndicator.position === 'bottom' &&
        React.createElement('div', {
            className: 'h-1 bg-blue-500 w-full my-1 rounded-full',
        }),
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
                        {
                          className: 'text-2xl font-semibold mb-4 text-center whitespace-nowrap cursor-pointer',
                          onDragOver: (e) => handleDragOver(e, null, null, categoryId, 0),
                          onDrop: (e) => handleDrop(e, null, categoryId, 0)
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
                                    onDragOver: (e) => handleDragOver(e, null, group.name, categoryId, teamsInThisCategory.filter(t => t.groupName === group.name).length),
                                    onDrop: (e) => handleDrop(e, group.name, categoryId, teamsInThisCategory.filter(t => t.groupName === group.name).length),
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
                    onDragOver: (e) => handleDragOver(e, null, null, selectedCategoryId, 0),
                    onDrop: (e) => handleDrop(e, null, selectedCategoryId, 0),
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
                                onDragOver: (e) => handleDragOver(e, null, group.name, selectedCategoryId, teamsInGroups.filter(t => t.groupName === group.name).length),
                                onDrop: (e) => handleDrop(e, group.name, selectedCategoryId, teamsInGroups.filter(t => t.groupName === group.name).length),
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
                        onDragOver: (e) => handleDragOver(e, null, null, null, 0),
                        onDrop: (e) => handleDrop(e, null, null, 0),
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
