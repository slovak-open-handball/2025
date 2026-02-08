// Importy pre Firebase funkcie (Tieto sa nebudú používať na inicializáciu, ale na typy a funkcie)
import { doc, getDoc, onSnapshot, updateDoc, addDoc, collection, Timestamp, getDocs, setDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";


// Import zoznamu predvolieb
import { countryDialCodes } from "./countryDialCodes.js";


const { useState, useEffect, useRef, useSyncExternalStore } = React;

/**
 * Funkcia na načítanie a vypísanie všetkých údajov z dokumentu users
 */
const loadAndLogAllUsersData = async () => {
    try {
        console.log("=== NAČÍTAVANIE VŠETKÝCH ÚDAJOV Z DATABÁZY (users) ===");
        
        // 1. Načítanie všetkých používateľských dokumentov
        const usersCollectionRef = collection(window.db, 'users');
        const querySnapshot = await getDocs(usersCollectionRef);
        
        console.log(`Počet používateľov v databáze: ${querySnapshot.size}`);
        
        // 2. Prechádzanie všetkých dokumentov
        querySnapshot.forEach((docSnap) => {
            const userData = docSnap.data();
            
            // Získame základné informácie o používateľovi
            const userEmail = userData.email || "N/A";
            const userName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || "N/A";
            const clubName = userData.billing?.clubName || "N/A";
            
            console.log(`\n--- Používateľ ID: ${docSnap.id} ---`);
            console.log(`Email: ${userEmail}`);
            console.log(`Meno: ${userName}`);
            console.log(`Klub: ${clubName}`);
            
            // Získame kategórie a tímy používateľa
            const categories = userData.categories || {};
            const teams = userData.teams || {};
            
            console.log("Kategórie a tímy:");
            
            // Prechádzame cez všetky kategórie používateľa
            Object.keys(categories).forEach(categoryId => {
                const categoryInfo = categories[categoryId];
                const numberOfTeams = categoryInfo.numberOfTeams || 0;
                
                console.log(`  • Kategória: ${categoryId}`);
                console.log(`    Počet tímov: ${numberOfTeams}`);
                
                // Získame tímy pre túto kategóriu
                const teamsInCategory = teams[categoryId] || [];
                
                if (teamsInCategory.length > 0) {
                    teamsInCategory.forEach((team, index) => {
                        const teamName = team.teamName || "Názov tímu neznámy";
                        const groupName = team.groupName || "Skupina neznáma";
                        
                        console.log(`    Tím ${index + 1}: ${teamName}`);
                        console.log(`      Skupina: ${groupName}`);
                    });
                } else {
                    console.log(`    Žiadne tímy v tejto kategórii`);
                }
            });
            
            // Ak používateľ nemá žiadne kategórie, ale má tímy
            if (Object.keys(categories).length === 0 && Object.keys(teams).length > 0) {
                console.log("  Používateľ má tímy, ale nie sú priradené ku kategóriám:");
                Object.keys(teams).forEach(categoryId => {
                    const teamsInCategory = teams[categoryId] || [];
                    if (teamsInCategory.length > 0) {
                        console.log(`  • Kategória z tímov: ${categoryId}`);
                        teamsInCategory.forEach((team, index) => {
                            const teamName = team.teamName || "Názov tímu neznámy";
                            const groupName = team.groupName || "Skupina neznáma";
                            
                            console.log(`    Tím ${index + 1}: ${teamName}`);
                            console.log(`      Skupina: ${groupName}`);
                        });
                    }
                });
            }
            
            // Ak používateľ nemá žiadne kategórie ani tímy
            if (Object.keys(categories).length === 0 && Object.keys(teams).length === 0) {
                console.log("  Používateľ nemá žiadne kategórie ani tímy");
            }
            
            console.log("--- Koniec údajov používateľa ---");
        });
        
        console.log("\n=== SÚHRN ===");
        console.log(`Celkový počet používateľov: ${querySnapshot.size}`);
        
        // Spočítame celkový počet tímov
        let totalTeams = 0;
        let usersWithTeams = 0;
        
        querySnapshot.forEach((docSnap) => {
            const userData = docSnap.data();
            const teams = userData.teams || {};
            
            let userTeamsCount = 0;
            Object.keys(teams).forEach(categoryId => {
                userTeamsCount += (teams[categoryId] || []).length;
            });
            
            if (userTeamsCount > 0) {
                usersWithTeams++;
                totalTeams += userTeamsCount;
            }
        });
        
        console.log(`Počet používateľov s aspoň jedným tímom: ${usersWithTeams}`);
        console.log(`Celkový počet tímov: ${totalTeams}`);
        
        console.log("=== KONIEC NAČÍTAVANIA ÚDAJOV Z DATABÁZY ===");
        
        return querySnapshot;
    } catch (error) {
        console.error("Chyba pri načítavaní údajov z databázy:", error);
        window.showGlobalNotification('Nastala chyba pri načítavaní údajov z databázy.', 'error');
        throw error;
    }
};

/**
 * Funkcia na sledovanie zmien v reálnom čase pre všetkých používateľov
 */
const setupRealTimeUsersListener = () => {
    try {
        console.log("Nastavujem sledovanie v reálnom čase pre kolekciu 'users'...");
        
        const usersCollectionRef = collection(window.db, 'users');
        
        const unsubscribe = onSnapshot(usersCollectionRef, (snapshot) => {
            console.log(`\n=== ZMENA V REÁLNOM ČASE - Počet dokumentov: ${snapshot.size} ===`);
            
            snapshot.docChanges().forEach((change) => {
                const userData = change.doc.data();
                const userEmail = userData.email || "N/A";
                const userName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || "N/A";
                
                console.log(`\nZmena typu: ${change.type}`);
                console.log(`ID dokumentu: ${change.doc.id}`);
                console.log(`Email: ${userEmail}`);
                console.log(`Meno: ${userName}`);
                
                // Vypíšeme zmeny v tímoch
                const categories = userData.categories || {};
                const teams = userData.teams || {};
                
                if (Object.keys(categories).length > 0) {
                    console.log("Aktualizované tímy:");
                    Object.keys(categories).forEach(categoryId => {
                        const teamsInCategory = teams[categoryId] || [];
                        if (teamsInCategory.length > 0) {
                            console.log(`  Kategória: ${categoryId}`);
                            teamsInCategory.forEach((team, index) => {
                                const teamName = team.teamName || "Názov tímu neznámy";
                                const groupName = team.groupName || "Skupina neznáma";
                                
                                console.log(`    Tím: ${teamName} (Skupina: ${groupName})`);
                            });
                        }
                    });
                }
                
                if (change.type === 'added') {
                    console.log("💾 Nový používateľ pridaný do databázy");
                } else if (change.type === 'modified') {
                    console.log("✏️ Používateľ aktualizovaný");
                } else if (change.type === 'removed') {
                    console.log("🗑️ Používateľ odstránený z databázy");
                }
            });
            
            // Celkový prehľad
            console.log("\n--- CELKOVÝ PREHĽAD POUŽÍVATEĽOV ---");
            let totalTeams = 0;
            
            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                const userEmail = data.email || 'N/A';
                const userName = `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'N/A';
                const categories = data.categories || {};
                const teams = data.teams || {};
                
                let userTeamsCount = 0;
                Object.keys(teams).forEach(categoryId => {
                    userTeamsCount += (teams[categoryId] || []).length;
                });
                
                totalTeams += userTeamsCount;
                
                console.log(`${docSnap.id}: ${userEmail} (${userName}) - tímov: ${userTeamsCount}`);
            });
            
            console.log(`\nCelkový počet tímov všetkých používateľov: ${totalTeams}`);
        }, (error) => {
            console.error("Chyba pri sledovaní zmien v reálnom čase:", error);
        });
        
        // Vrátime unsubscribe funkciu pre možnosť zastaviť sledovanie
        return unsubscribe;
    } catch (error) {
        console.error("Chyba pri nastavovaní sledovania v reálnom čase:", error);
    }
};

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

// Modal pre úpravu skupiny
const EditGroupModal = ({ isVisible, onClose, groupToEdit, categoryId, existingGroups, onUpdate }) => {
    const [groupName, setGroupName] = useState(groupToEdit?.name || '');
    const [groupType, setGroupType] = useState(groupToEdit?.type || 'základná skupina');

    useEffect(() => {
        if (groupToEdit) {
            setGroupName(groupToEdit.name);
            setGroupType(groupToEdit.type);
        }
    }, [groupToEdit]);

    if (!isVisible || !groupToEdit) return null;

    const handleUpdateGroup = async () => {
        if (!groupName || !groupType) {
            window.showGlobalNotification('Prosím, vyplňte všetky polia.', 'error');
            return;
        }

        const groupsInCategory = existingGroups[categoryId] || [];
        const isDuplicate = groupsInCategory.some(group => group.name.toLowerCase() === groupName.toLowerCase() && group.name.toLowerCase() !== groupToEdit.name.toLowerCase());

        if (isDuplicate) {
            window.showGlobalNotification('Skupina s týmto názvom už v tejto kategórii existuje.', 'error');
            return;
        }

        try {
            const groupsDocRef = doc(window.db, 'settings', 'groups');
            const newGroup = {
                name: groupName,
                type: groupType,
            };

            await updateDoc(groupsDocRef, {
                [categoryId]: arrayRemove(groupToEdit)
            });
            await updateDoc(groupsDocRef, {
                [categoryId]: arrayUnion(newGroup)
            });

            window.showGlobalNotification('Skupina bola úspešne aktualizovaná.', 'success');
            onClose();
            onUpdate();
        } catch (e) {
            console.error("Chyba pri aktualizácii skupiny: ", e);
            window.showGlobalNotification('Nastala chyba pri aktualizácii skupiny.', 'error');
        }
    };

    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center z-50' },
        React.createElement(
            'div',
            { className: 'relative p-5 border w-96 shadow-lg rounded-md bg-white' },
            React.createElement(
                'div',
                { className: 'mt-3 text-center' },
                React.createElement('h3', { className: 'text-lg leading-6 font-medium text-gray-900' }, 'Upraviť skupinu'),
                React.createElement(
                    'div',
                    { className: 'mt-2 px-7 py-3' },
                    React.createElement(
                        'div',
                        { className: 'mb-4' },
                        React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1 text-left' }, 'Názov skupiny'),
                        React.createElement(
                            'input',
                            {
                                type: 'text',
                                className: 'mt-1 block w-full pl-3 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm',
                                value: groupName,
                                onChange: (e) => setGroupName(e.target.value),
                                placeholder: 'Zadajte názov skupiny'
                            }
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'mb-4' },
                        React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1 text-left' }, 'Typ skupiny'),
                        React.createElement(
                            'select',
                            {
                                className: 'mt-1 block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md',
                                value: groupType,
                                onChange: (e) => setGroupType(e.target.value)
                            },
                            React.createElement('option', { value: 'základná skupina' }, 'Základná skupina'),
                            React.createElement('option', { value: 'nadstavbová skupina' }, 'Nadstavbová skupina')
                        )
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'items-center px-4 py-3 sm:flex sm:flex-row-reverse' },
                    React.createElement(
                        'button',
                        {
                            className: 'flex-1 w-full px-4 py-2 bg-blue-500 text-white text-base font-medium rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:ml-3',
                            onClick: handleUpdateGroup
                        },
                        'Aktualizovať'
                    ),
                    React.createElement(
                        'button',
                        {
                            className: 'flex-1 mt-2 w-full px-4 py-2 bg-gray-500 text-white text-base font-medium rounded-md shadow-sm hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 sm:mt-0',
                            onClick: onClose
                        },
                        'Zrušiť'
                    )
                )
            )
        )
    );
};

// Modal pre potvrdenie zmazania
const DeleteConfirmationModal = ({ isVisible, onClose, onConfirm, groupName }) => {
    if (!isVisible) return null;

    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center z-50' },
        React.createElement(
            'div',
            { className: 'relative p-5 border w-96 shadow-lg rounded-md bg-white' },
            React.createElement(
                'div',
                { className: 'mt-3 text-center' },
                React.createElement('h3', { className: 'text-lg leading-6 font-medium text-gray-900' }, 'Potvrdiť zmazanie'),
                React.createElement(
                    'div',
                    { className: 'mt-2 px-7 py-3' },
                    React.createElement('p', { className: 'text-sm text-gray-500' }, `Naozaj chcete zmazať skupinu "${groupName}"?`)
                ),
                React.createElement(
                    'div',
                    { className: 'items-center px-4 py-3 sm:flex sm:flex-row-reverse' },
                    React.createElement(
                        'button',
                        {
                            className: 'flex-1 w-full px-4 py-2 bg-red-500 text-white text-base font-medium rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 sm:ml-3',
                            onClick: onConfirm
                        },
                        'Zmazať'
                    ),
                    React.createElement(
                        'button',
                        {
                            className: 'flex-1 mt-2 w-full px-4 py-2 bg-gray-500 text-white text-base font-medium rounded-md shadow-sm hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 sm:mt-0',
                            onClick: onClose
                        },
                        'Zrušiť'
                    )
                )
            )
        )
    );
};


// Modal pre vytvorenie skupiny
const CreateGroupModal = ({ isVisible, onClose, categories, existingGroups }) => {
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [groupName, setGroupName] = useState('');
    const [groupType, setGroupType] = useState('základná skupina');

    if (!isVisible) return null;

    const handleCreateGroup = async () => {
        if (!selectedCategoryId || !groupName || !groupType) {
            window.showGlobalNotification('Prosím, vyplňte všetky polia.', 'error');
            return;
        }
        
        // Kontrola, či názov skupiny už existuje v danej kategórii
        const groupsInCategory = existingGroups[selectedCategoryId] || [];
        const isDuplicate = groupsInCategory.some(group => group.name.toLowerCase() === groupName.toLowerCase());

        if (isDuplicate) {
            window.showGlobalNotification('Skupina s týmto názvom už v tejto kategórii existuje.', 'error');
            return;
        }

        try {
            const groupsDocRef = doc(window.db, 'settings', 'groups');
            const newGroup = {
                name: groupName,
                type: groupType,
            };

            await updateDoc(groupsDocRef, {
                [selectedCategoryId]: arrayUnion(newGroup)
            });

            window.showGlobalNotification('Skupina bola úspešne vytvorená.', 'success');
            onClose(); // Zatvorenie modálneho okna po úspešnom uložení
        } catch (e) {
            // Ak dokument 'groups' neexistuje, vytvoríme ho
            if (e.code === 'not-found') {
                const groupsDocRef = doc(window.db, 'settings', 'groups');
                const newGroup = {
                    name: groupName,
                    type: groupType,
                };
                await setDoc(groupsDocRef, {
                    [selectedCategoryId]: [newGroup]
                });
                window.showGlobalNotification('Skupina bola úspešne vytvorená.', 'success');
                onClose();
            } else {
                console.error("Chyba pri pridávaní skupiny: ", e);
                window.showGlobalNotification('Nastala chyba pri vytváraní skupiny.', 'error');
            }
        }
    };

    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center z-50' },
        React.createElement(
            'div',
            { className: 'relative p-5 border w-96 shadow-lg rounded-md bg-white' },
            React.createElement(
                'div',
                { className: 'mt-3 text-center' },
                React.createElement('h3', { className: 'text-lg leading-6 font-medium text-gray-900' }, 'Vytvoriť novú skupinu'),
                React.createElement(
                    'div',
                    { className: 'mt-2 px-7 py-3' },
                    React.createElement(
                        'div',
                        { className: 'mb-4' },
                        React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1 text-left' }, 'Kategória'),
                        React.createElement(
                            'select',
                            {
                                className: 'mt-1 block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md',
                                value: selectedCategoryId,
                                onChange: (e) => setSelectedCategoryId(e.target.value)
                            },
                            React.createElement('option', { value: '' }, 'Vyberte kategóriu'),
                            categories.map(category =>
                                React.createElement('option', { key: category.id, value: category.id }, category.name)
                            )
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'mb-4' },
                        React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1 text-left' }, 'Názov skupiny'),
                        React.createElement(
                            'input',
                            {
                                type: 'text',
                                className: 'mt-1 block w-full pl-3 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm',
                                value: groupName,
                                onChange: (e) => setGroupName(e.target.value),
                                placeholder: 'Zadajte názov skupiny'
                            }
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'mb-4' },
                        React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1 text-left' }, 'Typ skupiny'),
                        React.createElement(
                            'select',
                            {
                                className: 'mt-1 block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md',
                                value: groupType,
                                onChange: (e) => setGroupType(e.target.value)
                            },
                            React.createElement('option', { value: 'základná skupina' }, 'Základná skupina'),
                            React.createElement('option', { value: 'nadstavbová skupina' }, 'Nadstavbová skupina')
                        )
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'items-center px-4 py-3 sm:flex sm:flex-row-reverse' },
                    React.createElement(
                        'button',
                        {
                            className: 'flex-1 w-full px-4 py-2 bg-blue-500 text-white text-base font-medium rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:ml-3',
                            onClick: handleCreateGroup
                        },
                        'Vytvoriť'
                    ),
                    React.createElement(
                        'button',
                        {
                            className: 'flex-1 mt-2 w-full px-4 py-2 bg-gray-500 text-white text-base font-medium rounded-md shadow-sm hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 sm:mt-0',
                            onClick: onClose
                        },
                        'Zrušiť'
                    )
                )
            )
        )
    );
};

const AddGroupsApp = ({ userProfileData }) => {
    const [categories, setCategories] = useState([]);
    const [groups, setGroups] = useState({});
    const [isCreateModalVisible, setCreateModalVisible] = useState(false);
    const [isEditModalVisible, setEditModalVisible] = useState(false);
    const [isDeleteModalVisible, setDeleteModalVisible] = useState(false);
    const [groupToEdit, setGroupToEdit] = useState(null);
    const [categoryOfGroupToEdit, setCategoryOfGroupToEdit] = useState('');
    const [groupToDelete, setGroupToDelete] = useState(null);
    const [categoryOfGroupToDelete, setCategoryOfGroupToDelete] = useState('');
    
    // Pridané: stav pre sledovanie, či sa majú načítať údaje
    const [usersDataLoaded, setUsersDataLoaded] = useState(false);
    const [realTimeListener, setRealTimeListener] = useState(null);

    useEffect(() => {
        // Načítanie kategórií v reálnom čase
        const unsubscribeCategories = onSnapshot(doc(window.db, 'settings', 'categories'), (docSnap) => {
            if (docSnap.exists()) {
                const categoriesData = docSnap.data();
                const loadedCategories = Object.keys(categoriesData).map(id => ({
                    id: id,
                    name: categoriesData[id].name
                }));
                loadedCategories.sort((a, b) => a.name.localeCompare(b.name));
                setCategories(loadedCategories);
            } else {
                setCategories([]);
                console.log("Dokument 'categories' nebol nájdený v 'settings'.");
            }
        }, (error) => {
            console.error("Chyba pri načítavaní kategórií v reálnom čase:", error);
        });

        // Načítanie skupín v reálnom čase
        const unsubscribeGroups = onSnapshot(doc(window.db, 'settings', 'groups'), (docSnap) => {
            if (docSnap.exists()) {
                setGroups(docSnap.data());
            } else {
                setGroups({});
            }
        }, (error) => {
            console.error("Chyba pri načítavaní skupín v reálnom čase:", error);
        });
        
        // PRIDANÉ: Automaticky načítame údaje o používateľoch pri načítaní komponentu
        const loadUsersData = async () => {
            try {
                await loadAndLogAllUsersData();
                setUsersDataLoaded(true);
                
                // Nastavíme sledovanie v reálnom čase
                const unsubscribe = setupRealTimeUsersListener();
                setRealTimeListener(() => unsubscribe);
            } catch (error) {
                console.error("Chyba pri automatickom načítavaní údajov používateľov:", error);
            }
        };
        
        loadUsersData();

        return () => {
            unsubscribeCategories();
            unsubscribeGroups();
            
            // PRIDANÉ: Zastavíme sledovanie v reálnom čase pri odstránení komponentu
            if (realTimeListener) {
                realTimeListener();
            }
        };
    }, []);

    const handleEditClick = (group, categoryId) => {
        setGroupToEdit(group);
        setCategoryOfGroupToEdit(categoryId);
        setEditModalVisible(true);
    };

    const handleDeleteClick = (group, categoryId) => {
        setGroupToDelete(group);
        setCategoryOfGroupToDelete(categoryId);
        setDeleteModalVisible(true);
    };

    const handleConfirmDelete = async () => {
        if (!groupToDelete || !categoryOfGroupToDelete) return;

        try {
            const groupsDocRef = doc(window.db, 'settings', 'groups');
            await updateDoc(groupsDocRef, {
                [categoryOfGroupToDelete]: arrayRemove(groupToDelete)
            });
            window.showGlobalNotification('Skupina bola úspešne zmazaná.', 'success');
        } catch (e) {
            console.error("Chyba pri mazaní skupiny: ", e);
            window.showGlobalNotification('Nastala chyba pri mazaní skupiny.', 'error');
        } finally {
            setDeleteModalVisible(false);
            setGroupToDelete(null);
            setCategoryOfGroupToDelete('');
        }
    };
    
    // Vytvorenie mapy pre rýchle vyhľadávanie názvov kategórií
    const categoryNamesMap = categories.reduce((map, category) => {
        map[category.id] = category.name;
        return map;
    }, {});

    return React.createElement(
        'div',
        { className: 'flex-grow flex justify-center items-center' },
        React.createElement(
            'div',
            { className: `w-full transform transition-all duration-500` },
            React.createElement(
                'div',
                { className: `w-full flex flex-col items-center justify-center mb-6` },
                React.createElement('h2', { className: 'text-3xl font-bold tracking-tight text-center' }, 'Vytvorenie skupín'),
                // PRIDANÉ: Informácia o načítaných dátach
                usersDataLoaded && React.createElement(
                    'div',
                    { className: 'mt-2 text-sm text-gray-500' },
                    'Dáta používateľov boli načítané do konzoly'
                )
            ),
            React.createElement(
                'div',
                { className: 'flex flex-wrap justify-center gap-4' },
                categories.map(category => {
                    // Zoradenie skupín v rámci kategórie
                    const categoryGroups = groups[category.id] || [];
                    const zakladneSkupiny = categoryGroups.filter(g => g.type === 'základná skupina').sort((a, b) => a.name.localeCompare(b.name));
                    const nadstavboveSkupiny = categoryGroups.filter(g => g.type === 'nadstavbová skupina').sort((a, b) => a.name.localeCompare(b.name));
                    const sortedGroups = [...zakladneSkupiny, ...nadstavboveSkupiny];
                    
                    return React.createElement(
                        'div',
                        { key: category.id, className: 'w-1/5 bg-white rounded-lg shadow-md p-4 flex flex-col items-center text-center' },
                        React.createElement('h3', { className: 'text-lg font-semibold mb-2' }, category.name),
                        React.createElement('ul', { className: 'w-full' },
                            sortedGroups.map((group, groupIndex) =>
                                React.createElement('li', {
                                    key: groupIndex,
                                    className: `
                                        ${group.type === 'nadstavbová skupina' ? 'bg-blue-100' : 'bg-gray-100'}
                                        rounded-md p-2 my-1 text-sm flex justify-between items-center
                                    `.trim()
                                }, 
                                    React.createElement('div', { className: 'flex-1 text-left' },
                                        React.createElement('div', { className: 'font-semibold' }, group.name),
                                        React.createElement('div', { className: 'text-gray-500 text-xs' }, group.type)
                                    ),
                                    React.createElement('div', { className: 'flex gap-2' },
                                        React.createElement(
                                            'button',
                                            {
                                                className: 'text-gray-500 hover:text-blue-500 transition-colors duration-200',
                                                onClick: () => handleEditClick(group, category.id)
                                            },
                                            React.createElement(
                                                'svg',
                                                {
                                                    xmlns: 'http://www.w3.org/2000/svg',
                                                    className: 'h-4 w-4',
                                                    viewBox: '0 0 20 20',
                                                    fill: 'currentColor'
                                                },
                                                React.createElement('path', { d: 'M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z' }),
                                                React.createElement('path', { fillRule: 'evenodd', d: 'M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z', clipRule: 'evenodd' })
                                            )
                                        ),
                                        React.createElement(
                                            'button',
                                            {
                                                className: 'text-gray-500 hover:text-red-500 transition-colors duration-200',
                                                onClick: () => handleDeleteClick(group, category.id)
                                            },
                                            React.createElement(
                                                'svg',
                                                {
                                                    xmlns: 'http://www.w3.org/2000/svg',
                                                    className: 'h-4 w-4',
                                                    viewBox: '0 0 20 20',
                                                    fill: 'currentColor'
                                                },
                                                React.createElement('path', { fillRule: 'evenodd', d: 'M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z', clipRule: 'evenodd' })
                                            )
                                        )
                                    )
                                )
                            )
                        )
                    )
                })
            )
        ),
        React.createElement(
            'button',
            {
                className: 'fixed bottom-4 right-4 bg-green-500 text-white rounded-full p-4 shadow-lg hover:bg-green-600 transition-colors duration-300',
                onClick: () => setCreateModalVisible(true)
            },
            React.createElement(
                'svg',
                {
                    xmlns: 'http://www.w3.org/2000/svg',
                    className: 'h-6 w-6',
                    fill: 'none',
                    viewBox: '0 0 24 24',
                    stroke: 'currentColor'
                },
                React.createElement('path', {
                    strokeLinecap: 'round',
                    strokeLinejoin: 'round',
                    strokeWidth: 2,
                    d: 'M12 4v16m8-8H4'
                })
            )
        ),
        React.createElement(CreateGroupModal, {
            isVisible: isCreateModalVisible,
            onClose: () => setCreateModalVisible(false),
            categories: categories,
            existingGroups: groups
        }),
        React.createElement(EditGroupModal, {
            isVisible: isEditModalVisible,
            onClose: () => {
                setEditModalVisible(false);
                setGroupToEdit(null);
            },
            groupToEdit: groupToEdit,
            categoryId: categoryOfGroupToEdit,
            existingGroups: groups,
            onUpdate: () => {
                // Toto sa volá po aktualizácii, aby sa zabezpečilo, že stav je čistý
                setGroupToEdit(null);
                setCategoryOfGroupToEdit('');
            }
        }),
        React.createElement(DeleteConfirmationModal, {
            isVisible: isDeleteModalVisible,
            onClose: () => setDeleteModalVisible(false),
            onConfirm: handleConfirmDelete,
            groupName: groupToDelete?.name
        })
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
        // Ak sa dáta načítali, nastavíme poslucháča na synchronizáciu e-mailu, ak ešte nebol nastavený
        // Používame window.auth a window.db, ktoré by mali byť nastavené pri načítaní aplikácie.
        if (window.auth && window.db && !isEmailSyncListenerSetup) {
            console.log("logged-in-add-groups.js: Nastavujem poslucháča na synchronizáciu e-mailu.");
            
            onAuthStateChanged(window.auth, async (user) => {
                if (user) {
                    try {
                        const userProfileRef = doc(window.db, 'users', user.uid);
                        const docSnap = await getDoc(userProfileRef);
            
                        if (docSnap.exists()) {
                            const firestoreEmail = docSnap.data().email;
                            if (user.email !== firestoreEmail) {
                                console.log(`logged-in-add-groups.js: E-mail v autentifikácii (${user.email}) sa líši od e-mailu vo Firestore (${firestoreEmail}). Aktualizujem...`);
                                
                                await updateDoc(userProfileRef, {
                                    email: user.email
                                });
            
                                // Vytvorenie notifikácie v databáze s novou štruktúrou
                                const notificationsCollectionRef = collection(window.db, 'notifications');
                                await addDoc(notificationsCollectionRef, {
                                    userEmail: user.email, // Používame userEmail namiesto userId a userName
                                    changes: `Zmena e-mailovej adresy z '${firestoreEmail}' na '${user.email}'.`,
                                    timestamp: new Date(), // Používame timestamp namiesto createdAt
                                });
                                
                                window.showGlobalNotification('E-mailová adresa bola automaticky aktualizovaná a synchronizovaná.', 'success');
                                console.log("logged-in-add-groups.js: E-mail vo Firestore bol aktualizovaný a notifikácia vytvorená.");
            
                            } else {
                                console.log("logged-in-add-groups.js: E-maily sú synchronizované, nie je potrebné nič aktualizovať.");
                            }
                        }
                    } catch (error) {
                        console.error("logged-in-add-groups.js: Chyba pri porovnávaní a aktualizácii e-mailu:", error);
                        window.showGlobalNotification('Nastala chyba pri synchronizácii e-mailovej adresy.', 'error');
                    }
                }
            });
            isEmailSyncListenerSetup = true; // Označíme, že poslucháč je nastavený
        }

        if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
            const root = ReactDOM.createRoot(rootElement);
            root.render(React.createElement(AddGroupsApp, { userProfileData }));
            console.log("logged-in-add-groups.js: Aplikácia bola vykreslená po udalosti 'globalDataUpdated'.");
        } else {
            console.error("logged-in-add-groups.js: HTML element 'root' alebo React/ReactDOM nie sú dostupné.");
        }
    } else {
        // Ak dáta nie sú dostupné, zobrazíme loader
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
    console.error("logged-in-add-groups.js: Dáta používateľa nie sú dostupné v udalosti 'globalDataUpdated'. Zobrazujem loader.");
    }
};

// Zaregistrujeme poslucháča udalosti 'globalDataUpdated'.
console.log("logged-in-add-groups.js: Registrujem poslucháča pre 'globalDataUpdated'.");
window.addEventListener('globalDataUpdated', handleDataUpdateAndRender);

// Aby sme predišli premeškaniu udalosti, ak sa načíta skôr, ako sa tento poslucháč zaregistruje,
// skontrolujeme, či sú dáta už dostupné.
console.log("logged-in-add-groups.js: Kontrolujem, či existujú globálne dáta.");
if (window.globalUserProfileData) {
    console.log("logged-in-add-groups.js: Globálne dáta už existujú. Vykresľujem aplikáciu okamžite.");
    handleDataUpdateAndRender({ detail: window.globalUserProfileData });
} else {
    // Ak dáta nie sú dostupné, čakáme na event listener, zatiaľ zobrazíme loader
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
