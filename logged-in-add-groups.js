// Importy pre Firebase funkcie (Tieto sa nebudú používať na inicializáciu, ale na typy a funkcie)
import { doc, getDoc, onSnapshot, updateDoc, addDoc, collection, Timestamp, getDocs, setDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const { useState, useEffect, useRef, useSyncExternalStore, useCallback } = React;

/**
 * Funkcia na načítanie a vypísanie všetkých údajov z dokumentu users
 */
const loadAndLogAllUsersData = async () => {
    try {
//        console.log("=== NAČÍTAVANIE TÍMOV Z DATABÁZY ===");
        
        // 1. Načítanie všetkých používateľských dokumentov
        const usersCollectionRef = collection(window.db, 'users');
        const querySnapshot = await getDocs(usersCollectionRef);
        
//        console.log(`Počet používateľov v databáze: ${querySnapshot.size}`);
        
        let allTeams = [];
        
        // 2. Prechádzanie všetkých dokumentov
        querySnapshot.forEach((docSnap) => {
            const userData = docSnap.data();
            
            // Získame tímy používateľa
            const teams = userData.teams || {};
            
            // Prechádzame cez všetky kategórie používateľa
            Object.keys(teams).forEach(categoryId => {
                const teamsInCategory = teams[categoryId] || [];
                
                teamsInCategory.forEach((team) => {
                    const teamName = team.teamName || "Názov tímu neznámy";
                    const groupName = team.groupName || "Skupina neznáma";
                    
                    // Uložíme tím do zoznamu
                    allTeams.push({
                        category: categoryId,
                        teamName: teamName,
                        groupName: groupName,
                        userId: docSnap.id,
                        userName: `${userData.firstName || ''} ${userData.lastName || ''}`.trim()
                    });
                });
            });
        });
        
        // Zoradenie tímov podľa kategórie a názvu tímu
        allTeams.sort((a, b) => {
            if (a.category !== b.category) {
                return a.category.localeCompare(b.category);
            }
            return a.teamName.localeCompare(b.teamName);
        });
        
        // Vypíšeme všetky tímy v požadovanom formáte
//        console.log("\n--- VŠETKY TÍMY ---");
//        if (allTeams.length === 0) {
//            console.log("Žiadne tímy v databáze.");
//        } else {
//            allTeams.forEach(team => {
//                console.log(`${team.category}: "${team.teamName}" ("${team.groupName}")`);
//            });
//        }
        
//        console.log("\n=== SÚHRN ===");
//        console.log(`Celkový počet používateľov: ${querySnapshot.size}`);
//        console.log(`Celkový počet tímov: ${allTeams.length}`);
        
        // Zoskupenie tímov podľa kategórie pre štatistiky
        const teamsByCategory = {};
        allTeams.forEach(team => {
            if (!teamsByCategory[team.category]) {
                teamsByCategory[team.category] = [];
            }
            teamsByCategory[team.category].push(team);
        });
        
//        console.log("\nPočet tímov podľa kategórie:");
//        Object.keys(teamsByCategory).sort().forEach(category => {
//            console.log(`  ${category}: ${teamsByCategory[category].length} tímov`);
//        });
        
//        console.log("=== KONIEC NAČÍTAVANIA ÚDAJOV ===");
        
        return { querySnapshot, allTeams, teamsByCategory };
    } catch (error) {
        console.error("Chyba pri načítavaní údajov z databázy:", error);
        window.showGlobalNotification('Nastala chyba pri načítavaní údajov z databázy.', 'error');
        throw error;
    }
};

/**
 * Funkcia na načítanie a vypísanie superštruktúrových tímov z dokumentu superstructureGroups
 */
const loadAndLogSuperstructureTeams = async () => {
    try {
//        console.log("\n=== NAČÍTAVANIE SUPERŠTRUKTÚROVÝCH TÍMOV ===");
//        console.log("Hľadám dokument 'superstructureGroups' v kolekcii 'settings'...");
        
        // Načítanie dokumentu superstructureGroups z kolekcie settings
        const superstructureDocRef = doc(window.db, 'settings', 'superstructureGroups');
        const docSnap = await getDoc(superstructureDocRef);
        
        if (!docSnap.exists()) {
//            console.log("❌ Dokument 'superstructureGroups' nebol nájdený v kolekcii 'settings'.");
//            console.log("Skúšam alternatívny názov dokumentu 'superstructureGroups'...");
            
            // Skúsime alternatívny názov dokumentu
            const altSuperstructureDocRef = doc(window.db, 'settings', 'superstructureGroups');
            const altDocSnap = await getDoc(altSuperstructureDocRef);
            
            if (!altDocSnap.exists()) {
//                console.log("❌ Ani dokument 'superstructureGroups' nebol nájdený.");
                return [];
            }
            
            return processSuperstructureData(altDocSnap.data());
        }
        
        return processSuperstructureData(docSnap.data());
        
    } catch (error) {
        console.error("Chyba pri načítavaní superštruktúrových tímov:", error);
        console.error("Detail chyby:", error.message);
        window.showGlobalNotification('Nastala chyba pri načítavaní superštruktúrových tímov.', 'error');
        return [];
    }
};

/**
 * Pomocná funkcia na spracovanie dát superštruktúrových tímov
 */
const processSuperstructureData = (superstructureData) => {
//    console.log("✅ Dokument bol úspešne načítaný.");
//    console.log("Štruktúra dokumentu:", Object.keys(superstructureData));
    
    let allSuperstructureTeams = [];
    
    // Prechádzame cez všetky polia v dokumente (kategórie)
    Object.keys(superstructureData).forEach(categoryId => {
        const categoryData = superstructureData[categoryId];
        
//        console.log(`\n📂 Kategória: ${categoryId}`);
        
        // Kontrolujeme, či kategória obsahuje pole (array)
        if (Array.isArray(categoryData)) {
//            console.log(`  Typ: Pole s ${categoryData.length} prvkami`);
            
            categoryData.forEach((teamItem, index) => {
                // TeamItem môže byť objekt so štyrmi poliami
                if (typeof teamItem === 'object' && teamItem !== null) {
                    const teamName = teamItem.teamName || teamItem.name || `Tím ${index + 1}`;
                    const groupName = teamItem.groupName || teamItem.group || "Skupina neznáma";
                    const order = teamItem.order || teamItem.position || index + 1;
                    
                    // Vypíšeme tím v požadovanom formáte
//                    console.log(`${categoryId}: "${teamName}" ("${groupName}")`);
                    
                    allSuperstructureTeams.push({
                        category: categoryId,
                        teamName: teamName,
                        groupName: groupName,
                        order: order,
                        allFields: teamItem
                    });
                } else {
//                    console.log(`  Prvok ${index + 1}:`, teamItem);
                }
            });
        } else if (typeof categoryData === 'object' && categoryData !== null) {
//            console.log(`  Typ: Objekt s ${Object.keys(categoryData).length} poliami`);
            
            // Ak je to objekt, môže obsahovať ďalšie polia
            Object.keys(categoryData).forEach(key => {
                const item = categoryData[key];
                
                if (typeof item === 'object' && item !== null) {
                    const teamName = item.teamName || item.name || key;
                    const groupName = item.groupName || item.group || "Skupina neznáma";
                    const order = item.order || item.position || 0;
                    
                    // Vypíšeme tím v požadovanom formáte
//                    console.log(`${categoryId}: "${teamName}" ("${groupName}")`);
                    
                    allSuperstructureTeams.push({
                        category: categoryId,
                        subCategory: key,
                        teamName: teamName,
                        groupName: groupName,
                        order: order,
                        allFields: item
                    });
                }
            });
        } else {
//            console.log(`  Typ: ${typeof categoryData}, Hodnota:`, categoryData);
        }
    });
    
    // Zoradenie tímov podľa kategórie a poradia
    allSuperstructureTeams.sort((a, b) => {
        if (a.category !== b.category) {
            return a.category.localeCompare(b.category);
        }
        if (a.subCategory !== b.subCategory) {
            return (a.subCategory || '').localeCompare(b.subCategory || '');
        }
        if (a.order !== b.order) {
            return a.order - b.order;
        }
        return a.teamName.localeCompare(b.teamName);
    });
    
    // Vypíšeme súhrn superštruktúrových tímov v požadovanom formáte
//    console.log("\n=== SÚHRN SUPERŠTRUKTÚROVÝCH TÍMOV (formátované) ===");
    if (allSuperstructureTeams.length === 0) {
//        console.log("❌ V dokumente neboli nájdené žiadne tímy.");
    } else {
//        console.log(`✅ Celkový počet superštruktúrových tímov: ${allSuperstructureTeams.length}`);
//        console.log("\n--- Všetky tímy ---");
        
        // Vypíšeme všetky tímy v požadovanom formáte
        allSuperstructureTeams.forEach(team => {
            const teamName = team.teamName || "Názov tímu neznámy";
            const groupName = team.groupName || "Skupina neznáma";
//            console.log(`${team.category}: "${teamName}" ("${groupName}")`);
        });
        
        // Zoskupenie podľa kategórie pre štatistiky
        const teamsByCategory = {};
        allSuperstructureTeams.forEach(team => {
            if (!teamsByCategory[team.category]) {
                teamsByCategory[team.category] = [];
            }
            teamsByCategory[team.category].push(team);
        });
        
//        console.log("\n=== Štatistika ===");
//        console.log("Počet tímov podľa kategórie:");
        Object.keys(teamsByCategory).sort().forEach(category => {
//            console.log(`  ${category}: ${teamsByCategory[category].length} tímov`);
        });
    }
    
//    console.log("\n=== KONIEC NAČÍTAVANIA SUPERŠTRUKTÚROVÝCH TÍMOV ===");
    
    return allSuperstructureTeams;
};

/**
 * Funkcia na sledovanie zmien v reálnom čase pre všetkých používateľov
 */
const setupRealTimeUsersListener = () => {
    try {
//        console.log("Nastavujem sledovanie v reálnom čase pre kolekciu 'users'...");
        
        const usersCollectionRef = collection(window.db, 'users');
        
        const unsubscribe = onSnapshot(usersCollectionRef, (snapshot) => {
//            console.log(`\n=== ZMENA V REÁLNOM ČASE ===`);
            
            let newTeams = [];
            
            // Získame všetky tímy po zmene
            snapshot.forEach((docSnap) => {
                const userData = docSnap.data();
                const teams = userData.teams || {};
                
                Object.keys(teams).forEach(categoryId => {
                    const teamsInCategory = teams[categoryId] || [];
                    
                    teamsInCategory.forEach((team) => {
                        const teamName = team.teamName || "Názov tímu neznámy";
                        const groupName = team.groupName || "Skupina neznáma";
                        
                        newTeams.push({
                            category: categoryId,
                            teamName: teamName,
                            groupName: groupName,
                            userId: docSnap.id
                        });
                    });
                });
            });
            
            // Zoradenie
            newTeams.sort((a, b) => {
                if (a.category !== b.category) {
                    return a.category.localeCompare(b.category);
                }
                return a.teamName.localeCompare(b.teamName);
            });
            
            // Vypíšeme zmeny
//            console.log(`Počet tímov po zmene: ${newTeams.length}`);
//            console.log("Aktuálny stav tímov:");
            
//            if (newTeams.length === 0) {
//                console.log("Žiadne tímy v databáze.");
//            } else {
//                newTeams.forEach(team => {
//                    console.log(`${team.category}: "${team.teamName}" ("${team.groupName}")`);
//                });
//            }
            
            // Zobrazenie zmien
            snapshot.docChanges().forEach((change) => {
                const userData = change.doc.data();
                const userEmail = userData.email || "N/A";
                const userName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || "N/A";
            });
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
    const [nameError, setNameError] = useState('');
    const [allFieldsFilled, setAllFieldsFilled] = useState(false);

    // Funkcia na formátovanie názvu skupiny pri úprave
    const formatGroupName = (input) => {
        // Odstránime predošlý text "skupina " ak existuje
        const cleanInput = input.replace(/^skupina\s+/i, '');
        
        if (!cleanInput.trim()) return '';
        
        const firstChar = cleanInput.charAt(0);
        const upperChar = firstChar.toUpperCase();
        
        return `skupina ${upperChar}`;
    };

    useEffect(() => {
        const fieldsFilled = groupName.trim() !== '' && groupType !== '';
        setAllFieldsFilled(fieldsFilled);
    }, [groupName, groupType]);

    useEffect(() => {
        if (groupToEdit) {
            // Pri načítaní skupiny na úpravu zobrazíme existujúci názov
            setGroupName(groupToEdit.name);
            setGroupType(groupToEdit.type);
            setNameError('');
        }
    }, [groupToEdit]);

    const isButtonDisabled = !allFieldsFilled || !!nameError;

    // Funkcia na kontrolu duplicity názvu skupiny
    const checkGroupNameDuplicate = () => {
        if (!categoryId || !groupName.trim()) {
            setNameError('');
            return false;
        }

        const formattedGroupName = formatGroupName(groupName);
        const groupsInCategory = existingGroups[categoryId] || [];
        const isDuplicate = groupsInCategory.some(group => 
            group.name.toLowerCase() === formattedGroupName.toLowerCase() && 
            group.name.toLowerCase() !== groupToEdit.name.toLowerCase()
        );

        if (isDuplicate) {
            setNameError('Názov skupiny už v tejto kategórii existuje.');
            return true;
        } else {
            setNameError('');
            return false;
        }
    };

    // Pridané: Kontrola duplicity pri zmene názvu skupiny
    useEffect(() => {
        if (groupName.trim() && categoryId && groupToEdit) {
            checkGroupNameDuplicate();
        } else {
            setNameError('');
        }
    }, [groupName, categoryId]);

    if (!isVisible || !groupToEdit) return null;

    const handleUpdateGroup = async () => {
        if (!groupName || !groupType) {
            window.showGlobalNotification('Prosím, vyplňte všetky polia.', 'error');
            return;
        }

        const formattedGroupName = formatGroupName(groupName);
        
        // Kontrola duplicity pred odoslaním
        const isDuplicate = checkGroupNameDuplicate();
        if (isDuplicate) {
            return;
        }

        try {
            const groupsDocRef = doc(window.db, 'settings', 'groups');
            const newGroup = {
                name: formattedGroupName,
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

    // Funkcia na spracovanie zmeny v inpute
    const handleGroupNameChange = (e) => {
        const input = e.target.value;
        if (input.length > 0) {
            const formattedName = formatGroupName(input);
            setGroupName(formattedName);
        } else {
            setGroupName('');
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
                                className: `mt-1 block w-full pl-3 pr-3 py-2 border ${nameError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'} rounded-md shadow-sm focus:outline-none sm:text-sm`,
                                value: groupName,
                                onChange: handleGroupNameChange,
                                placeholder: 'Zadajte písmeno (napr. A, B, C...)'
                            }
                        ),
                        React.createElement(
                            'p',
                            { className: 'mt-1 text-sm text-gray-500 text-left' },
                            groupName.trim() ? 
                                `Názov bude formátovaný do tvaru ${formatGroupName(groupName)}` : 
                                'Názov bude formátovaný do tvaru skupina X'
                        ),
                        nameError && React.createElement(
                            'p',
                            { className: 'mt-1 text-sm text-red-600 text-left' },
                            nameError
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
                            className: `flex-1 w-full px-4 py-2 text-base font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 sm:ml-3 ${isButtonDisabled ? 'bg-white text-blue-500 border border-blue-500 cursor-not-allowed hover:cursor-default' : 'bg-blue-500 hover:bg-blue-700 text-white focus:ring-blue-500'}`,
                            onClick: handleUpdateGroup,
                            disabled: isButtonDisabled
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
                            className: 'flex-1 mt-2 w-full px-4 py-2 bg-gray-500 text-white text-base fontmedium rounded-md shadow-sm hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 sm:mt-0',
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
    // Pridaný stav pre sledovanie chybového hlásenia
    const [nameError, setNameError] = useState('');
    const [allFieldsFilled, setAllFieldsFilled] = useState(false);

    // Funkcia na automatické formátovanie názvu skupiny
    const formatGroupName = (input) => {
        // Odstránime predošlý text "skupina " ak existuje
        const cleanInput = input.replace(/^skupina\s+/i, '');
        
        // Ak je vstup prázdny, vrátime prázdny reťazec
        if (!cleanInput.trim()) return '';
        
        // Získame iba prvé písmeno
        const firstChar = cleanInput.charAt(0);
        
        // Premeníme písmeno na veľké
        const upperChar = firstChar.toUpperCase();
        
        // Vrátime formátovaný reťazec
        return `skupina ${upperChar}`;
    };

    // Funkcia na kontrolu duplicity názvu skupiny
    const checkGroupNameDuplicate = useCallback(() => {
        if (!selectedCategoryId || !groupName.trim()) {
            setNameError('');
            return false;
        }

        const formattedGroupName = formatGroupName(groupName);
        const groupsInCategory = existingGroups[selectedCategoryId] || [];
        const isDuplicate = groupsInCategory.some(group => 
            group.name.toLowerCase() === formattedGroupName.toLowerCase()
        );

        if (isDuplicate) {
            setNameError('Názov skupiny už v tejto kategórii existuje.');
            return true;
        } else {
            setNameError('');
            return false;
        }
    }, [selectedCategoryId, groupName, existingGroups]);

    const isButtonDisabled = !allFieldsFilled || !!nameError;

    useEffect(() => {
        const fieldsFilled = selectedCategoryId !== '' && groupName.trim() !== '' && groupType !== '';
        setAllFieldsFilled(fieldsFilled);
    }, [selectedCategoryId, groupName, groupType]);

    // Pridané: Kontrola duplicity pri zmene názvu skupiny
    useEffect(() => {
        if (groupName.trim() && selectedCategoryId) {
            checkGroupNameDuplicate();
        } else {
            setNameError('');
        }
    }, [groupName, selectedCategoryId, checkGroupNameDuplicate]);

    // Pridané: Kontrola duplicity pri zmene kategórie
    useEffect(() => {
        if (selectedCategoryId && groupName.trim()) {
            checkGroupNameDuplicate();
        } else {
            setNameError('');
        }
    }, [selectedCategoryId, groupName.trim(), checkGroupNameDuplicate]);

    // Reset formulára pri otvorení/zatvorení modálu
    useEffect(() => {
        if (!isVisible) {
            setSelectedCategoryId('');
            setGroupName('');
            setGroupType('základná skupina');
            setNameError('');
        }
    }, [isVisible]);

    if (!isVisible) return null;

    const handleCreateGroup = async () => {
        if (!selectedCategoryId || !groupName || !groupType) {
            window.showGlobalNotification('Prosím, vyplňte všetky polia.', 'error');
            return;
        }
        
        const formattedGroupName = formatGroupName(groupName);
        
        // Kontrola duplicity pred odoslaním
        const isDuplicate = checkGroupNameDuplicate();
        if (isDuplicate) {
            return;
        }

        try {
            const groupsDocRef = doc(window.db, 'settings', 'groups');
            const newGroup = {
                name: formattedGroupName,
                type: groupType,
            };

            await updateDoc(groupsDocRef, {
                [selectedCategoryId]: arrayUnion(newGroup)
            });

            window.showGlobalNotification('Skupina bola úspešne vytvorená.', 'success');
            onClose();
        } catch (e) {
            if (e.code === 'not-found') {
                const groupsDocRef = doc(window.db, 'settings', 'groups');
                const newGroup = {
                    name: formattedGroupName,
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

    // Funkcia na spracovanie zmeny v inpute
    const handleGroupNameChange = (e) => {
        const input = e.target.value;
        // Ak používateľ zadá viac ako jedno písmeno, vezmeme iba prvé
        if (input.length > 0) {
            const formattedName = formatGroupName(input);
            setGroupName(formattedName);
        } else {
            setGroupName('');
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
                                className: `mt-1 block w-full pl-3 pr-3 py-2 border ${nameError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'} rounded-md shadow-sm focus:outline-none sm:text-sm`,
                                value: groupName,
                                onChange: handleGroupNameChange,
                                placeholder: 'Zadajte písmeno (napr. A, B, C...)'
                            }
                        ),
                        // Pridané: Zobrazenie pomôcky a chybového hlásenia
                        React.createElement(
                            'p',
                            { className: 'mt-1 text-sm text-gray-500 text-left' },
                            groupName.trim() ? 
                                `Názov bude formátovaný do tvaru ${formatGroupName(groupName)}` : 
                                'Názov bude formátovaný do tvaru skupina X'
                        ),
                        nameError && React.createElement(
                            'p',
                            { className: 'mt-1 text-sm text-red-600 text-left' },
                            nameError
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
                            className: `flex-1 w-full px-4 py-2 text-base font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 sm:ml-3 ${isButtonDisabled ? 'bg-white text-blue-500 border border-blue-500 cursor-not-allowed hover:cursor-default' : 'bg-blue-500 hover:bg-blue-700 text-white focus:ring-blue-500'}`,
                            onClick: handleCreateGroup,
                            disabled: isButtonDisabled
                        },
                        'Vytvoriť'
                    ),
                    React.createElement(
                        'button',
                        {
                            className: 'flex-1 mt-2 w-full px-4 py-2 bg-gray-500 text-white text-base font-medium rounded-md shadow-sm hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 sm:mt-0',
                            onClick: () => {
                                setSelectedCategoryId('');
                                setGroupName('');
                                setGroupType('základná skupina');
                                setNameError('');
                                onClose();
                            }
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
    
    // PRIDANÉ: stav pre ukladanie tímov z databázy
    const [databaseTeams, setDatabaseTeams] = useState([]);
    // PRIDANÉ: stav pre ukladanie superštruktúrových tímov
    const [superstructureTeams, setSuperstructureTeams] = useState([]);

    useEffect(() => {
        // Načítanie kategórií v reálnom čase
        const unsubscribeCategories = onSnapshot(doc(window.db, 'settings', 'categories'), (docSnap) => {
                if (docSnap.exists()) {
                    const categoriesData = docSnap.data();
//                    console.log("DEBUG: Všetky kategórie z databázy:", categoriesData);
                    
                    const loadedCategories = Object.keys(categoriesData).map(id => ({
                        id: id,
                        name: categoriesData[id].name
                    }));
                    loadedCategories.sort((a, b) => a.name.localeCompare(b.name));
                    setCategories(loadedCategories);
            
                    // Debug: Vypíšeme ID a názvy
                    loadedCategories.forEach(cat => {
//                        console.log(`DEBUG Kategória: id="${cat.id}", name="${cat.name}"`);
                    });
                } else {
                    setCategories([]);
//                    console.log("Dokument 'categories' nebol nájdený v 'settings'.");
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
                const { allTeams } = await loadAndLogAllUsersData();
                // Uložíme tímy z databázy do stavu
                setDatabaseTeams(allTeams);
                setUsersDataLoaded(true);
                
                // Nastavíme sledovanie v reálnom čase
                const unsubscribe = setupRealTimeUsersListener();
                setRealTimeListener(() => unsubscribe);
            } catch (error) {
                console.error("Chyba pri automatickom načítavaní údajov používateľov:", error);
            }
        };
        
        // PRIDANÉ: Načítame superštruktúrové tímy
        const loadSuperstructureTeams = async () => {
            try {
                const teams = await loadAndLogSuperstructureTeams();
                setSuperstructureTeams(teams);
            } catch (error) {
                console.error("Chyba pri načítavaní superštruktúrových tímov:", error);
            }
        };
        
        loadUsersData();
        loadSuperstructureTeams();

        return () => {
            unsubscribeCategories();
            unsubscribeGroups();
            
            // PRIDANÉ: Zastavíme sledovanie v reálnom čase pri odstránení komponentu
            if (realTimeListener) {
                realTimeListener();
            }
        };
    }, []);

    const getCategoryNameById = (categoryId) => {
        const category = categories.find(cat => cat.id === categoryId);
        return category ? category.name : categoryId;
    };

    // PRIDANÉ: Funkcia na získanie ID kategórie z názvu
    const getCategoryIdByName = (categoryName) => {
        const category = categories.find(cat => cat.name === categoryName);
        return category ? category.id : categoryName;
    };

    // PRIDANÉ: Funkcia na kontrolu, či skupina má tímy v databáze
    const isGroupUsedInDatabase = (categoryId, groupName) => {
        if (!databaseTeams || databaseTeams.length === 0) {
            return false;
        }
        
        // Získame názov kategórie z ID
        const categoryName = getCategoryNameById(categoryId);
//        console.log(`DEBUG isGroupUsedInDatabase: Hľadám ${categoryName} ("${groupName}")`);
        
        // Skontrolujeme, či existuje aspoň jeden tím v tejto kategórii s danou skupinou
        const found = databaseTeams.some(team => {
            const teamCategory = team.category;
            const teamGroup = team.groupName;
            
            // Porovnávame názvy kategórií, nie ID!
            return teamCategory === categoryName && teamGroup === groupName;
        });
        
        // DEBUG log
//        if (found) {
//            console.log(`DEBUG: Nájdený tím v databáze: ${categoryName} - "${groupName}"`);
//        }
        
        return found;
    };
    
    // PRIDANÉ: Funkcia na kontrolu, či skupina je v superštruktúre
    const isGroupInSuperstructure = (categoryId, groupName) => {
        if (!superstructureTeams || superstructureTeams.length === 0) {
            return false;
        }
        
        // Získame názov kategórie z ID
        const categoryName = getCategoryNameById(categoryId);
//        console.log(`DEBUG isGroupInSuperstructure: Hľadám ${categoryName} ("${groupName}")`);
        
        // Skontrolujeme, či existuje aspoň jeden superštruktúrový tím v tejto kategórii s danou skupinou
        const found = superstructureTeams.some(team => {
            const teamCategory = team.category;
            const teamGroup = team.groupName;
            
            // Porovnávame názvy kategórií, nie ID!
            return teamCategory === categoryName && teamGroup === groupName;
        });
        
        // DEBUG log
//        if (found) {
//            console.log(`DEBUG: Nájdený superštruktúrový tím: ${categoryName} - "${groupName}"`);
//        }
        
        return found;
    };
    
    // PRIDANÉ: Kombinovaná funkcia na kontrolu, či skupina je používaná
    const isGroupUsed = (categoryId, groupName) => {
        const categoryName = getCategoryNameById(categoryId);
//        console.log(`DEBUG isGroupUsed: Kontrolujem ${categoryName} (ID: ${categoryId}) - "${groupName}"`);
//        console.log(`DEBUG: databaseTeams dĺžka: ${databaseTeams ? databaseTeams.length : 'null'}`);
//        console.log(`DEBUG: superstructureTeams dĺžka: ${superstructureTeams ? superstructureTeams.length : 'null'}`);
        
        const usedInDatabase = isGroupUsedInDatabase(categoryId, groupName);
        const usedInSuperstructure = isGroupInSuperstructure(categoryId, groupName);
        const isUsed = usedInDatabase || usedInSuperstructure;
        
        // Log pre debug
//        console.log(`DEBUG isGroupUsed výsledok pre ${categoryName} - "${groupName}": ${isUsed} (DB: ${usedInDatabase}, Super: ${usedInSuperstructure})`);
        
        return isUsed;
    };

    const handleEditClick = (group, categoryId) => {
        setGroupToEdit(group);
        setCategoryOfGroupToEdit(categoryId);
        setEditModalVisible(true);
    };

    const handleDeleteClick = (group, categoryId) => {
        // Kontrola, či je skupina používaná v databáze alebo superštruktúre
        const isUsed = isGroupUsed(categoryId, group.name);
        
        if (isUsed) {
            window.showGlobalNotification('Túto skupinu nie je možné zmazať, pretože je priradená k existujúcim tímom.', 'error');
            return; // Ukončíme funkciu, neukážeme dialógové okno
        }
        
        // Ak skupina nie je používaná, zobrazíme dialógové okno na potvrdenie
        setGroupToDelete(group);
        setCategoryOfGroupToDelete(categoryId);
        setDeleteModalVisible(true);
    };

    const handleConfirmDelete = async () => {
        if (!groupToDelete || !categoryOfGroupToDelete) return;

        // Dvojitá kontrola - ale táto by už nemala byť potrebná
        // pretože sme zabránili zobrazeniu dialógového okna pre používané skupiny
        const isUsed = isGroupUsed(categoryOfGroupToDelete, groupToDelete.name);
        if (isUsed) {
            window.showGlobalNotification('Túto skupinu nie je možné zmazať, pretože obsahuje apoň jeden tím.', 'error');
            setDeleteModalVisible(false);
            setGroupToDelete(null);
            setCategoryOfGroupToDelete('');
            return;
        }

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
                            sortedGroups.map((group, groupIndex) => {
                                // PRIDANÉ: Kontrola, či sa skupina používa
                                const isUsed = isGroupUsed(category.id, group.name);
                                
                                return React.createElement('li', {
                                    key: groupIndex,
                                    className: `
                                        ${group.type === 'nadstavbová skupina' ? 'bg-blue-100' : 'bg-gray-100'}
                                        rounded-md p-2 my-1 text-sm flex justify-between items-center
                                    `.trim()
                                }, 
                                    React.createElement('div', { className: 'flex-1 text-left' },
                                        React.createElement('div', { className: 'font-semibold' }, group.name),
                                        React.createElement('div', { className: 'text-gray-500 text-xs' }, group.type),
                                        // PRIDANÉ: Zobrazenie indikátora, ak je skupina používaná
//                                        isUsed && React.createElement(
//                                            'div',
//                                            { className: 'text-xs text-red-500 mt-1' },
//                                            'Obsahuje tímy v databáze'
//                                        )
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
                                                className: `transition-colors duration-200 ${isUsed ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:text-red-500'}`,
                                                onClick: () => {
//                                                    console.log(`DEBUG: Klik na zmazanie skupiny: ${group.name} v ${category.id}`);
//                                                    console.log(`DEBUG: isUsed hodnota: ${isUsed}`);
                                                    if (isUsed) {
//                                                        console.log(`DEBUG: Skupina je používaná, zobrazujem notifikáciu`);
                                                        window.showGlobalNotification(`Skupinu "${group.name}" nie je možné zmazať, pretože je priradená k existujúcim tímom.`, 'error');
                                                    } else {
//                                                        console.log(`DEBUG: Skupina nie je používaná, volám handleDeleteClick`);
                                                        handleDeleteClick(group, category.id);
                                                    }
                                                },
                                                disabled: isUsed,
                                                title: isUsed ? `Skupina ${group.name} obsahuje tímy v databáze a nie je možné ju zmazať.` : `Zmazať skupinu ${group.name}`
                                            },
                                            React.createElement(
                                                'svg',
                                                {
                                                    xmlns: 'http://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js',
                                                    className: 'h-4 w-4',
                                                    viewBox: '0 0 20 20',
                                                    fill: 'currentColor'
                                                },
                                                React.createElement('path', { fillRule: 'evenodd', d: 'M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z', clipRule: 'evenodd' })
                                            )
                                        )
                                    )
                                );
                            })
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
//            console.log("logged-in-add-groups.js: Nastavujem poslucháča na synchronizáciu e-mailu.");
            
            onAuthStateChanged(window.auth, async (user) => {
                if (user) {
                    try {
                        const userProfileRef = doc(window.db, 'users', user.uid);
                        const docSnap = await getDoc(userProfileRef);
            
                        if (docSnap.exists()) {
                            const firestoreEmail = docSnap.data().email;
                            if (user.email !== firestoreEmail) {
//                                console.log(`logged-in-add-groups.js: E-mail v autentifikácii (${user.email}) sa líši od e-mailu vo Firestore (${firestoreEmail}). Aktualizujem...`);
                                
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
//                                console.log("logged-in-add-groups.js: E-mail vo Firestore bol aktualizovaný a notifikácia vytvorená.");
            
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
//            console.log("logged-in-add-groups.js: Aplikácia bola vykreslená po udalosti 'globalDataUpdated'.");
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
//console.log("logged-in-add-groups.js: Registrujem poslucháča pre 'globalDataUpdated'.");
window.addEventListener('globalDataUpdated', handleDataUpdateAndRender);

// Aby sme predišli premeškaniu udalosti, ak sa načíta skôr, ako sa tento poslucháč zaregistruje,
// skontrolujeme, či sú dáta už dostupné.
//console.log("logged-in-add-groups.js: Kontrolujem, či existujú globálne dáta.");
if (window.globalUserProfileData) {
//    console.log("logged-in-add-groups.js: Globálne dáta už existujú. Vykresľujem aplikáciu okamžite.");
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
