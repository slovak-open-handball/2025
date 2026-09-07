import { doc, getDoc, onSnapshot, updateDoc, addDoc, collection, Timestamp, getDocs, setDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
const { useState, useEffect, useRef, useSyncExternalStore, useCallback } = React;
const createGroupChangeNotification = async (actionType, changesArray, groupData) => {
    if (!window.db || !changesArray?.length) return;    
    try {
        const currentUserEmail = window.globalUserProfileData?.email || null;        
        await addDoc(collection(window.db, 'notifications'), {
            userEmail: currentUserEmail || "",
            performedBy: currentUserEmail || null,
            changes: changesArray,
            timestamp: Timestamp.now(),
            actionType: actionType,
            relatedCategoryId: groupData.categoryId || null,
            relatedCategoryName: groupData.categoryName || null,
            relatedGroupName: groupData.groupName || null,
            relatedGroupType: groupData.groupType || null,
        });
    } catch (err) {
    }
};
const loadAndLogAllUsersData = async () => {
    try {      
        const usersCollectionRef = collection(window.db, 'users');
        const querySnapshot = await getDocs(usersCollectionRef);                
        let allTeams = [];        
        querySnapshot.forEach((docSnap) => {
            const userData = docSnap.data();            
            const teams = userData.teams || {};            
            Object.keys(teams).forEach(categoryId => {
                const teamsInCategory = teams[categoryId] || [];                
                teamsInCategory.forEach((team) => {
                    const teamName = team.teamName || "Názov tímu neznámy";
                    const groupName = team.groupName || "Skupina neznáma";                    
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
        allTeams.sort((a, b) => {
            if (a.category !== b.category) {
                return a.category.localeCompare(b.category);
            }
            return a.teamName.localeCompare(b.teamName);
        });
        const teamsByCategory = {};
        allTeams.forEach(team => {
            if (!teamsByCategory[team.category]) {
                teamsByCategory[team.category] = [];
            }
            teamsByCategory[team.category].push(team);
        });        
        return { querySnapshot, allTeams, teamsByCategory };
    } catch (error) {
        window.showGlobalNotification('Nastala chyba pri načítavaní údajov z databázy.', 'error');
        throw error;
    }
};
const loadAndLogSuperstructureTeams = async () => {
    try {
        const superstructureDocRef = doc(window.db, 'settings', 'superstructureGroups');
        const docSnap = await getDoc(superstructureDocRef);        
        if (!docSnap.exists()) {
            const altSuperstructureDocRef = doc(window.db, 'settings', 'superstructureGroups');
            const altDocSnap = await getDoc(altSuperstructureDocRef);            
            if (!altDocSnap.exists()) {
                return [];
            }            
            return processSuperstructureData(altDocSnap.data());
        }        
        return processSuperstructureData(docSnap.data());        
    } catch (error) {
        window.showGlobalNotification('Nastala chyba pri načítavaní superštruktúrových tímov.', 'error');
        return [];
    }
};
const processSuperstructureData = (superstructureData) => {    
    let allSuperstructureTeams = [];    
    Object.keys(superstructureData).forEach(categoryId => {
        const categoryData = superstructureData[categoryId];        
        if (Array.isArray(categoryData)) {            
            categoryData.forEach((teamItem, index) => {
                if (typeof teamItem === 'object' && teamItem !== null) {
                    const teamName = teamItem.teamName || teamItem.name || `Tím ${index + 1}`;
                    const groupName = teamItem.groupName || teamItem.group || "Skupina neznáma";
                    const order = teamItem.order || teamItem.position || index + 1;                                        
                    allSuperstructureTeams.push({
                        category: categoryId,
                        teamName: teamName,
                        groupName: groupName,
                        order: order,
                        allFields: teamItem
                    });
                }
            });
        } else if (typeof categoryData === 'object' && categoryData !== null) {            
            Object.keys(categoryData).forEach(key => {
                const item = categoryData[key];                
                if (typeof item === 'object' && item !== null) {
                    const teamName = item.teamName || item.name || key;
                    const groupName = item.groupName || item.group || "Skupina neznáma";
                    const order = item.order || item.position || 0;                                        
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
        }
    });    
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
    if (allSuperstructureTeams.length === 0) {
    } else {
        allSuperstructureTeams.forEach(team => {
            const teamName = team.teamName || "Názov tímu neznámy";
            const groupName = team.groupName || "Skupina neznáma";
        });        
        const teamsByCategory = {};
        allSuperstructureTeams.forEach(team => {
            if (!teamsByCategory[team.category]) {
                teamsByCategory[team.category] = [];
            }
            teamsByCategory[team.category].push(team);
        });        
        Object.keys(teamsByCategory).sort().forEach(category => {
        });
    }        
    return allSuperstructureTeams;
};
const setupRealTimeUsersListener = () => {
    try {        
        const usersCollectionRef = collection(window.db, 'users');        
        const unsubscribe = onSnapshot(usersCollectionRef, (snapshot) => {            
            let newTeams = [];            
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
            newTeams.sort((a, b) => {
                if (a.category !== b.category) {
                    return a.category.localeCompare(b.category);
                }
                return a.teamName.localeCompare(b.teamName);
            });                        
            snapshot.docChanges().forEach((change) => {
                const userData = change.doc.data();
                const userEmail = userData.email || "N/A";
                const userName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || "N/A";
            });
        }, (error) => {
        });
        return unsubscribe;
    } catch (error) {
    }
};
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
const EditGroupModal = ({ isVisible, onClose, groupToEdit, categoryId, existingGroups, onUpdate, categories }) => {
    const [groupName, setGroupName] = useState('');
    const [groupType, setGroupType] = useState('základná skupina');
    const [nameError, setNameError] = useState('');
    const [allFieldsFilled, setAllFieldsFilled] = useState(false);
    const handleGroupNameChange = (e) => {
        const input = e.target.value;        
        if (input === '') {
            setGroupName('');
            return;
        }        
        const lastChar = input.charAt(input.length - 1);        
        if (/^[A-Za-z]$/.test(lastChar)) {
            const upperChar = lastChar.toUpperCase();
            setGroupName(`skupina ${upperChar}`);
        }
    };
    useEffect(() => {
        const fieldsFilled = groupName.trim() !== '' && groupType !== '';
        setAllFieldsFilled(fieldsFilled);
    }, [groupName, groupType]);
    useEffect(() => {
        if (groupToEdit) {
            setGroupName(groupToEdit.name);
            setGroupType(groupToEdit.type);
            setNameError('');
        }
    }, [groupToEdit]);
    const isButtonDisabled = !allFieldsFilled || !!nameError;
    const checkGroupNameDuplicate = () => {
        if (!categoryId || !groupName) {
            setNameError('');
            return false;
        }
        const groupsInCategory = existingGroups[categoryId] || [];
        const isDuplicate = groupsInCategory.some(group => 
            group.name.toLowerCase() === groupName.toLowerCase() && 
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
    useEffect(() => {
        if (groupName && categoryId && groupToEdit) {
            checkGroupNameDuplicate();
        } else {
            setNameError('');
        }
    }, [groupName, categoryId, groupToEdit]);
    if (!isVisible || !groupToEdit) return null;
    const handleUpdateGroup = async () => {
        if (!groupName || !groupType) {
            window.showGlobalNotification('Prosím, vyplňte všetky polia.', 'error');
            return;
        }    
        const isDuplicate = checkGroupNameDuplicate();
        if (isDuplicate) {
            return;
        }    
        try {
            const groupsDocRef = doc(window.db, 'settings', 'groups');
            const newGroup = {
                name: groupName, 
                type: groupType,
            };    
            const categoryName = categories && categories.find ? categories.find(c => c.id === categoryId)?.name || categoryId : categoryId;
            const oldGroupName = groupToEdit.name;
            const oldGroupType = groupToEdit.type;            
            await updateDoc(groupsDocRef, {
                [categoryId]: arrayRemove(groupToEdit)
            });
            await updateDoc(groupsDocRef, {
                [categoryId]: arrayUnion(newGroup)
            });    
            const changesList = [];            
            changesList.push(`Úprava skupiny v kategórii '''${categoryName}'`);
            changesList.push(`Názov: z '${oldGroupName}' na '${groupName}'`);
            changesList.push(`Typ: z '${oldGroupType}' na '${groupType}'`);
            if (oldGroupName === groupName && oldGroupType === groupType) {
                changesList.length = 0; 
                changesList.push(`Skupina v kategórii '''${categoryName}' bola upravená`);
                changesList.push(`Názov skupiny '''${groupName}'`);
                changesList.push(`Typ skupiny '''${groupType}'`);
            }    
            await createGroupChangeNotification('group_updated', 
                changesList,
                {
                    categoryId: categoryId,
                    categoryName: categoryName,
                    groupName: groupName,
                    oldGroupName: oldGroupName,
                    groupType: groupType,
                    oldGroupType: oldGroupType
                }
            );    
            window.showGlobalNotification('Skupina bola aktualizovaná.', 'success');
            onClose();
            onUpdate();
        } catch (e) {
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
                                className: `mt-1 block w-full pl-3 pr-3 py-2 border ${nameError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'} rounded-md shadow-sm focus:outline-none sm:text-sm`,
                                value: groupName,
                                onChange: handleGroupNameChange,
                                placeholder: 'Zadajte písmeno (A, B, C...)'
                            }
                        ),
                        React.createElement(
                            'p',
                            { className: 'mt-1 text-sm text-gray-500 text-left' },
                            groupName ? groupName : 'Názov skupiny bude skupina X'
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
                            className: `flex-1 w-full px-4 py-2 text-base font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 sm:ml-3 ${
                                isButtonDisabled 
                                    ? 'bg-white text-blue-500 border border-blue-500 cursor-not-allowed' 
                                    : 'bg-blue-500 hover:bg-blue-700 text-white focus:ring-blue-500'
                            }`,
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
const CreateGroupModal = ({ isVisible, onClose, categories, existingGroups }) => {
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [groupName, setGroupName] = useState('');
    const [groupType, setGroupType] = useState('základná skupina');
    const [nameError, setNameError] = useState('');
    const [allFieldsFilled, setAllFieldsFilled] = useState(false);
    const handleGroupNameChange = (e) => {
        const input = e.target.value;        
        if (input === '') {
            setGroupName('');
            return;
        }        
        const lastChar = input.charAt(input.length - 1);        
        if (/^[A-Za-z]$/.test(lastChar)) {
            const upperChar = lastChar.toUpperCase();
            setGroupName(`skupina ${upperChar}`);
        }
    };
    const checkGroupNameDuplicate = useCallback(() => {
        if (!selectedCategoryId || !groupName) {
            setNameError('');
            return false;
        }
        const groupsInCategory = existingGroups[selectedCategoryId] || [];
        const isDuplicate = groupsInCategory.some(group => 
            group.name.toLowerCase() === groupName.toLowerCase()
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
        const fieldsFilled = selectedCategoryId !== '' && groupName !== '' && groupType !== '';
        setAllFieldsFilled(fieldsFilled);
    }, [selectedCategoryId, groupName, groupType]);
    useEffect(() => {
        if (groupName && selectedCategoryId) {
            checkGroupNameDuplicate();
        } else {
            setNameError('');
        }
    }, [groupName, selectedCategoryId, checkGroupNameDuplicate]);
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
        const isDuplicate = checkGroupNameDuplicate();
        if (isDuplicate) {
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
            const categoryName = categories.find(c => c.id === selectedCategoryId)?.name || selectedCategoryId;
            await createGroupChangeNotification('group_created', 
                [`Vytvorená nová skupina: '${groupName} (${groupType})' v kategórii '${categoryName}'`],
                {
                    categoryId: selectedCategoryId,
                    categoryName: categoryName,
                    groupName: groupName,
                    groupType: groupType
                }
            );    
            window.showGlobalNotification('Skupina bola vytvorená.', 'success');
            onClose();
        } catch (e) {
            if (e.code === 'not-found') {
                const groupsDocRef = doc(window.db, 'settings', 'groups');
                const newGroup = {
                    name: groupName,
                    type: groupType,
                };
                await setDoc(groupsDocRef, {
                    [selectedCategoryId]: [newGroup]
                });                
                const categoryName = categories.find(c => c.id === selectedCategoryId)?.name || selectedCategoryId;
                await createGroupChangeNotification('group_created', 
                    [`Vytvorená nová skupina: '${groupName} (${groupType})' v kategórii '${categoryName}'`],
                    {
                        categoryId: selectedCategoryId,
                        categoryName: categoryName,
                        groupName: groupName,
                        groupType: groupType
                    }
                );                
                window.showGlobalNotification('Skupina bola vytvorená.', 'success');
                onClose();
            } else {
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
                                className: `mt-1 block w-full pl-3 pr-3 py-2 border ${nameError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'} rounded-md shadow-sm focus:outline-none sm:text-sm`,
                                value: groupName,
                                onChange: handleGroupNameChange,
                                placeholder: 'Zadajte písmeno (A, B, C...)'
                            }
                        ),
                        React.createElement(
                            'p',
                            { className: 'mt-1 text-sm text-gray-500 text-left' },
                            groupName ? groupName : 'Názov skupiny bude skupina X'
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
                            className: `flex-1 w-full px-4 py-2 text-base font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 sm:ml-3 ${
                                isButtonDisabled 
                                    ? 'bg-white text-blue-500 border border-blue-500 cursor-not-allowed' 
                                    : 'bg-blue-500 hover:bg-blue-700 text-white focus:ring-blue-500'
                            }`,
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
    const [usersDataLoaded, setUsersDataLoaded] = useState(false);
    const [realTimeListener, setRealTimeListener] = useState(null);    
    const [databaseTeams, setDatabaseTeams] = useState([]);
    const [superstructureTeams, setSuperstructureTeams] = useState([]);
    useEffect(() => {
        const unsubscribeCategories = onSnapshot(doc(window.db, 'settings', 'categories'), (docSnap) => {
                if (docSnap.exists()) {
                    const categoriesData = docSnap.data();                    
                    const loadedCategories = Object.keys(categoriesData).map(id => ({
                        id: id,
                        name: categoriesData[id].name
                    }));
                    loadedCategories.sort((a, b) => a.name.localeCompare(b.name));
                    setCategories(loadedCategories);            
                    loadedCategories.forEach(cat => {
                    });
                } else {
                    setCategories([]);
                }
            }, (error) => {
            });
        const unsubscribeGroups = onSnapshot(doc(window.db, 'settings', 'groups'), (docSnap) => {
            if (docSnap.exists()) {
                setGroups(docSnap.data());
            } else {
                setGroups({});
            }
        }, (error) => {
        });        
        const loadUsersData = async () => {
            try {
                const { allTeams } = await loadAndLogAllUsersData();
                setDatabaseTeams(allTeams);
                setUsersDataLoaded(true);                
                const unsubscribe = setupRealTimeUsersListener();
                setRealTimeListener(() => unsubscribe);
            } catch (error) {
            }
        };        
        const loadSuperstructureTeams = async () => {
            try {
                const teams = await loadAndLogSuperstructureTeams();
                setSuperstructureTeams(teams);
            } catch (error) {
            }
        };        
        loadUsersData();
        loadSuperstructureTeams();
        return () => {
            unsubscribeCategories();
            unsubscribeGroups();            
            if (realTimeListener) {
                realTimeListener();
            }
        };
    }, []);
    const getCategoryNameById = (categoryId) => {
        const category = categories.find(cat => cat.id === categoryId);
        return category ? category.name : categoryId;
    };
    const getCategoryIdByName = (categoryName) => {
        const category = categories.find(cat => cat.name === categoryName);
        return category ? category.id : categoryName;
    };
    const isGroupUsedInDatabase = (categoryId, groupName) => {
        if (!databaseTeams || databaseTeams.length === 0) {
            return false;
        }        
        const categoryName = getCategoryNameById(categoryId);        
        const found = databaseTeams.some(team => {
            const teamCategory = team.category;
            const teamGroup = team.groupName;
            return teamCategory === categoryName && teamGroup === groupName;
        });        
        return found;
    };    
    const isGroupInSuperstructure = (categoryId, groupName) => {
        if (!superstructureTeams || superstructureTeams.length === 0) {
            return false;
        }        
        const categoryName = getCategoryNameById(categoryId);        
        const found = superstructureTeams.some(team => {
            const teamCategory = team.category;
            const teamGroup = team.groupName;            
            return teamCategory === categoryName && teamGroup === groupName;
        });                
        return found;
    };    
    const isGroupUsed = (categoryId, groupName) => {
        const categoryName = getCategoryNameById(categoryId);        
        const usedInDatabase = isGroupUsedInDatabase(categoryId, groupName);
        const usedInSuperstructure = isGroupInSuperstructure(categoryId, groupName);
        const isUsed = usedInDatabase || usedInSuperstructure;    
        return isUsed;
    };
    const handleEditClick = (group, categoryId) => {
        setGroupToEdit(group);
        setCategoryOfGroupToEdit(categoryId);
        setEditModalVisible(true);
    };
    const handleDeleteClick = (group, categoryId) => {
        const isUsed = isGroupUsed(categoryId, group.name);        
        if (isUsed) {
            window.showGlobalNotification('Túto skupinu nie je možné zmazať, pretože je priradená k existujúcim tímom.', 'error');
            return; 
        }        
        setGroupToDelete(group);
        setCategoryOfGroupToDelete(categoryId);
        setDeleteModalVisible(true);
    };
    const handleConfirmDelete = async () => {
        if (!groupToDelete || !categoryOfGroupToDelete) return;    
        const isUsed = isGroupUsed(categoryOfGroupToDelete, groupToDelete.name);
        if (isUsed) {
            window.showGlobalNotification('Túto skupinu nie je možné zmazať, pretože obsahuje aspoň jeden tím.', 'error');
            setDeleteModalVisible(false);
            setGroupToDelete(null);
            setCategoryOfGroupToDelete('');
            return;
        }    
        try {
            const groupsDocRef = doc(window.db, 'settings', 'groups');            
            const categoryName = categories.find(c => c.id === categoryOfGroupToDelete)?.name || categoryOfGroupToDelete;            
            await updateDoc(groupsDocRef, {
                [categoryOfGroupToDelete]: arrayRemove(groupToDelete)
            });    
            await createGroupChangeNotification('group_deleted', 
                [`Odstránená skupina: '${groupToDelete.name} (${groupToDelete.type})' z kategórie '${categoryName}'`],
                {
                    categoryId: categoryOfGroupToDelete,
                    categoryName: categoryName,
                    groupName: groupToDelete.name,
                    groupType: groupToDelete.type
                }
            );    
            window.showGlobalNotification('Skupina bola odstránená.', 'success');
        } catch (e) {
            window.showGlobalNotification('Nastala chyba pri mazaní skupiny.', 'error');
        } finally {
            setDeleteModalVisible(false);
            setGroupToDelete(null);
            setCategoryOfGroupToDelete('');
        }
    };    
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
                                    ),
                                    React.createElement('div', { className: 'flex gap-2' },
                                        React.createElement(
                                            'button',
                                            {
                                                className: `${isUsed ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:text-blue-500'} transition-colors duration-200`,
                                                onClick: () => {
                                                    if (isUsed) {
                                                        window.showGlobalNotification(`Skupinu "${group.name}" nie je možné upravovať, pretože je priradená k existujúcim tímom.`, 'error');
                                                    } else {
                                                        handleEditClick(group, category.id);
                                                    }
                                                },
                                                disabled: isUsed,
                                                title: isUsed ? `${group.name.charAt(0).toUpperCase() + group.name.slice(1)} obsahuje tímy v databáze a nie je možné ju upravovať.` : `Upraviť skupinu ${group.name}`
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
                                                className: `${isUsed ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:text-red-500'} transition-colors duration-200`,
                                                onClick: () => {
                                                    if (isUsed) {
                                                        window.showGlobalNotification(`Skupinu "${group.name}" nie je možné zmazať, pretože je priradená k existujúcim tímom.`, 'error');
                                                    } else {
                                                        handleDeleteClick(group, category.id);
                                                    }
                                                },
                                                disabled: isUsed,
                                                title: isUsed ? `${group.name.charAt(0).toUpperCase() + group.name.slice(1)} obsahuje tímy v databáze a nie je možné ju zmazať.` : `Zmazať skupinu ${group.name}`
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
            categories: categories,
            onUpdate: () => {
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
                            }
                        }
                    } catch (error) {
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
