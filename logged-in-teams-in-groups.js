import { doc, getDoc, onSnapshot, updateDoc, collection, Timestamp, query, getDocs, setDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// Referencia na globálny konfiguračný dokument pre nadstavbové tímy
const SUPERSTRUCTURE_TEAMS_DOC_PATH = 'settings/superstructureGroups';

const listeners = new Set();

export const notify = (message, type = 'info') => {
  const id = Date.now() + Math.random();
  listeners.forEach(cb => cb({ id, message, type }));
};

export const subscribe = (cb) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
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
    const [uiNotification, setUiNotification] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [teamToEdit, setTeamToEdit] = useState(null);
    const [isInitialHashReadComplete, setIsInitialHashReadComplete] = useState(false);
    
    const currentUserEmail = window.globalUserProfileData?.email || null;

    const createTeamAssignmentNotification = async (action, team) => {
        if (!window.db) return;

        if (!currentUserEmail) {
            console.warn("Nie je dostupný e-mail prihláseného používateľa → notifikácia nebude mať userEmail");
        }

        let message = '';
        let category = team.category || '?';
        let group = team.groupName || 'bez skupiny';
        let teamName = team.teamName || 'Neznámy tím';

        switch (action) {
            case 'assign_global':
                message = `Globálny tím "${teamName}" priradený do skupiny "${group}" (${category})`;
                break;
            case 'change_group_global':
                message = `Zmena skupiny globálneho tímu "${teamName}" → "${group}" (${category})`;
                break;
            case 'unassign_global':
                message = `Globálny tím "${teamName}" odstránený zo skupiny (${category})`;
                break;
            case 'assign_user':
                message = `Používateľský tím "${teamName}" zaradený do skupiny "${group}" (${category})`;
                break;
            case 'change_group_user':
                message = `Zmena skupiny používateľského tímu "${teamName}" → "${group}" (${category})`;
                break;
            case 'unassign_user':
                message = `Používateľský tím "${teamName}" presunutý medzi tímy bez skupiny (${category})`;
                break;
            case 'add_new_global':
                message = `Nový globálny tím "${teamName}" vytvorený a zaradený do "${group}" (${category})`;
                break;
            default:
                message = `Zmena tímu "${teamName}" (${action})`;
        }

        try {
            const notificationsRef = collection(window.db, 'notifications');
            await addDoc(notificationsRef, {
                userEmail: currentUserEmail || "", 
                performedBy: currentUserEmail || null,  
                changes: [message],
                timestamp: serverTimestamp(),
                relatedTeamId: team.id,
                relatedCategory: category,
                relatedGroup: group || null,
                actionType: action
            });
            console.log("[NOTIFIKÁCIA] Uložená:", message);
        } catch (err) {
            console.error("[NOTIFIKÁCIA] Chyba pri ukladaní:", err);
        }
    };

    // Efekt pre manažovanie notifikácií
    useEffect(() => {
        let timer;
        const unsubscribe = subscribe((notification) => {
            setUiNotification(notification);
            clearTimeout(timer);
            timer = setTimeout(() => {
                setUiNotification(null);
            }, 5000);
        });
        return () => {
            unsubscribe();
            clearTimeout(timer);
        };
    }, []);

    // ===================================================================
    // VNÚTORNÉ FUNKCIE – všetky majú prístup k setUiNotification, categoryIdToNameMap atď.
    // ===================================================================

    const handleDeleteTeam = async (teamToDelete) => {
        if (!window.db || !teamToDelete || !teamToDelete.isSuperstructureTeam) {
            notify("Možno odstrániť len globálne tímy",   "error");
            return;
        }
    
        const superstructureDocRef = doc(window.db, ...SUPERSTRUCTURE_TEAMS_DOC_PATH.split('/'));
        try {
            const docSnap = await getDoc(superstructureDocRef);
            const globalTeamsData = docSnap.exists() ? docSnap.data() : {};
            let teams = globalTeamsData[teamToDelete.category] || [];
            const teamIndex = teams.findIndex(t => t.id === teamToDelete.id);
            if (teamIndex === -1) {
                notify("Odstraňovaný tím sa nenašiel",   "error");
                return;
            }
    
            const originalGroup = teamToDelete.groupName;
            const originalOrder = teamToDelete.order;
            teams.splice(teamIndex, 1);
    
            const reorderedTeams = teams.map(t => {
                if (t.groupName === originalGroup && t.order != null && t.order > originalOrder) {
                    return { ...t, order: t.order - 1 };
                }
                return t;
            });
    
            await setDoc(superstructureDocRef, {
                ...globalTeamsData,
                [teamToDelete.category]: reorderedTeams
            }, { merge: true });
    
            await createTeamAssignmentNotification('unassign_global', {
                id: teamToDelete.id,
                teamName: teamToDelete.teamName,
                category: teamToDelete.category,
                groupName: teamToDelete.groupName
            });
    
            notify(`Tím '${teamToDelete.teamName}' bol odstránený zo skupiny.`, "success");
        } catch (error) {
            console.error("Chyba pri odstraňovaní globálneho tímu:", error);
            notify("Nepodarilo sa odstrániť tím zo skupiny.",   "error");  
        }
    };

    const handleUnassignUserTeam = async (team) => {
        if (!window.db || !team?.uid) return;
    
        try {
            const userRef = doc(window.db, 'users', team.uid);
            const userSnap = await getDoc(userRef);
            if (!userSnap.exists()) {
                  notify(`Používateľ '${team.uid}' už neexistuje.`,   "error");
                return;
            }
    
            const userData = userSnap.data();
            const categoryName = team.category;
            const teamsInCategory = [...(userData.teams?.[categoryName] || [])];
            const teamIndex = teamsInCategory.findIndex(t => t.id === team.id);
            if (teamIndex === -1) {
                notify("Tím sa nenašiel v profile používateľa.",   "error");  
                return;
            }
    
            teamsInCategory[teamIndex] = {
                ...teamsInCategory[teamIndex],
                groupName: null,
                order: null
            };
    
            await updateDoc(userRef, { [`teams.${categoryName}`]: teamsInCategory });
    
            await createTeamAssignmentNotification('unassign_user', {
                id: team.id,
                teamName: team.teamName,
                category: team.category,
                groupName: team.groupName
            });
    
            notify(`Tím '${team.teamName}' bol presunutý medzi tímy bez skupiny.`, "success");
        } catch (err) {
            console.error("Chyba pri zrušení zaradenia tímu:", err);
            notify("Nepodarilo sa presunúť tím medzi tímy bez skupiny.",   "error");
        }
    };

    const handleRemoveOrDeleteTeam = (team) => {
        if (team.isSuperstructureTeam) {
            if (!window.confirm(`Naozaj chcete úplne odstrániť tím "${team.teamName}"?`)) return;
            handleDeleteTeam(team);
        } else {
            if (!window.confirm(`Presunúť tím "${team.teamName}" medzi tímy bez skupiny?`)) return;
            handleUnassignUserTeam(team);
        }
    };

    const handleUpdateAnyTeam = async ({ categoryId, groupName, teamName, order, originalTeam }) => {
        if (!window.db || !originalTeam) return;
        const categoryName = categoryIdToNameMap[categoryId];
        if (!categoryName) return;
    
        const finalTeamName = `${categoryName} ${teamName.trim()}`;
    
        // === Globálny tím (superštruktúra) ===
        if (originalTeam.isSuperstructureTeam) {
            const superstructureDocRef = doc(window.db, ...SUPERSTRUCTURE_TEAMS_DOC_PATH.split('/'));
    
            try {
                const docSnap = await getDoc(superstructureDocRef);
                if (!docSnap.exists()) return;
                const data = docSnap.data() || {};
                const oldCategory = originalTeam.category;
                let oldTeams = [...(data[oldCategory] || [])];
                const idx = oldTeams.findIndex(t => t.id === originalTeam.id);
                if (idx === -1) {
                    notify("Pôvodný tím sa nenašiel", "error");
                    return;
                }
                oldTeams.splice(idx, 1);
    
                const categoryChanged = oldCategory !== categoryName;
                let targetTeams = categoryChanged ? [...(data[categoryName] || [])] : oldTeams;
    
                let newOrder = null;
                const newGroup = groupName || null;
                if (newGroup) {
                    const inGroup = targetTeams.filter(t => t.groupName === newGroup);
                    const max = inGroup.reduce((m, t) => Math.max(m, t.order || 0), 0);
                    newOrder = (originalTeam.groupName === newGroup && !categoryChanged)
                        ? (originalTeam.order ?? max + 1)
                        : max + 1;
                    if (order != null && !isNaN(order)) newOrder = parseInt(order, 10);
                }
    
                const updatedTeam = {
                    id: originalTeam.id,
                    teamName: finalTeamName,
                    groupName: newGroup,
                    order: newOrder,
                };
    
                targetTeams.push(updatedTeam);
    
                const updatePayload = { [oldCategory]: oldTeams };
                if (categoryChanged) updatePayload[categoryName] = targetTeams;
                else updatePayload[oldCategory] = targetTeams;
    
                await updateDoc(superstructureDocRef, updatePayload);
    
                const action = originalTeam.groupName === groupName ? 'change_group_global' : 'assign_global';
                await createTeamAssignmentNotification(action, {
                    id: originalTeam.id,
                    teamName: finalTeamName,
                    category: categoryName,
                    groupName: newGroup || null
                });
    
                notify(`Globálny tím '${finalTeamName}' bol ${groupName ? 'zaradený/upravený' : 'odstránený zo skupiny'} v kategórii '${categoryName}'.`, "success");
            } catch (err) {
                console.error("Chyba pri aktualizácii globálneho tímu:", err);
                notify("Nepodarilo sa aktualizovať globálny tím.", "error");
            }
        }
    
        // === Používateľský tím (ktokoľvek) ===
        else {
            if (!originalTeam?.uid || !originalTeam?.id) return;
    
            // Voliteľné potvrdenie pri cudzieho tíme
            // if (!window.confirm(`Naozaj chceš upraviť tím používateľa ${originalTeam.uid}?`)) return;
    
            const userRef = doc(window.db, 'users', originalTeam.uid);
    
            try {
                const userSnap = await getDoc(userRef);
                if (!userSnap.exists()) {
                    notify("Používateľ už neexistuje.", "error");
                    return;
                }
    
                const userData = userSnap.data();
                const teamsInCategory = [...(userData.teams?.[originalTeam.category] || [])];
                const teamIndex = teamsInCategory.findIndex(t => t.teamName === originalTeam.teamName);
                if (teamIndex === -1) {
                    notify("Tím sa nenašiel v profile používateľa (podľa názvu).", "error");
                    return;
                }
    
                let newOrder = null;
                const newGroup = groupName || null;
                if (newGroup) {
                    const othersInGroup = teamsInCategory.filter(t => t.groupName === newGroup && t.id !== originalTeam.id);
                    const max = othersInGroup.reduce((m, t) => Math.max(m, t.order || 0), 0);
                    newOrder = order != null ? parseInt(order, 10) : max + 1;
                }
    
                teamsInCategory[teamIndex] = {
                    ...teamsInCategory[teamIndex],
                    teamName: finalTeamName,
                    groupName: newGroup,
                    order: newOrder
                };
    
                await updateDoc(userRef, { [`teams.${originalTeam.category}`]: teamsInCategory });
    
                const action = originalTeam.groupName === groupName ? 'change_group_user' : 'assign_user';
                await createTeamAssignmentNotification(action, {
                    id: originalTeam.id,
                    teamName: finalTeamName,
                    category: originalTeam.category,
                    groupName: newGroup || null
                });
    
                notify(`Tím '${finalTeamName}' bol ${groupName ? 'zaradený/upravený' : 'odstránený zo skupiny'} v kategórii '${categoryName}'.`, "success");
            } catch (err) {
                console.error("Chyba pri aktualizácii používateľského tímu:", err);
                notify("Nepodarilo sa aktualizovať používateľský tím.","error");
            }
        }
    };

    const handleAddNewTeam = async ({ categoryId, groupName, teamName, order }) => {
        if (!window.db) {
            notify("Firestore nie je inicializovaný.", "error");
            return;
        }
        const categoryName = categoryIdToNameMap[categoryId];
        const finalTeamName = `${categoryName} ${teamName}`;
        const isDuplicateFinal = allTeams.some(team => team.teamName === finalTeamName);
        if (isDuplicateFinal) {
            notify(`Tím '${finalTeamName}' už existuje. Ukladanie zrušené.`, "error");
            return;
        }
        try {
            const superstructureDocRef = doc(window.db, ...SUPERSTRUCTURE_TEAMS_DOC_PATH.split('/'));
            const docSnap = await getDoc(superstructureDocRef);
            const globalTeamsData = docSnap.exists() ? docSnap.data() : {};
            const currentTeamsForCategory = globalTeamsData[categoryName] || [];
            const teamsInTargetGroup = currentTeamsForCategory.filter(t => t.groupName === groupName);
            let maxOrder = 0;
            teamsInTargetGroup.forEach(t => {
                if (t.order > maxOrder) maxOrder = t.order;
            });
            const newOrder = order != null ? parseInt(order, 10) : (groupName ? maxOrder + 1 : null);
            const newTeam = {
                teamName: finalTeamName,
                groupName: groupName || null,
                order: newOrder,
                id: crypto.randomUUID()
            };
            const updatedTeamsArray = [...currentTeamsForCategory, newTeam];
            await setDoc(superstructureDocRef, {
                ...globalTeamsData,
                [categoryName]: updatedTeamsArray
            }, { merge: true });

            await createTeamAssignmentNotification('add_new_global', {
                id: newTeam.id,
                teamName: finalTeamName,
                category: categoryName,
                groupName: groupName || null
            });
    
            notify(`Nový tím '${finalTeamName}' bol pridaný ${groupName ? `do skupiny ${groupName}` : `bez skupiny`}.`, "success");
        } catch (error) {
            console.error("Chyba pri pridávaní nového globálneho tímu:", error);
            notify("Nepodarilo sa pridať nový tím do skupiny.", "error");
        }
    };

    const handleUpdateUserTeam = async ({ categoryId, groupName, teamName, order, originalTeam }) => {
        if (!window.db || !originalTeam?.uid || !originalTeam?.id) return;
    
        const categoryName = categoryIdToNameMap[categoryId];
        if (categoryName !== originalTeam.category) {
            notify("Kategóriu používateľského tímu nemôžete meniť.", "error");
            return;
        }
    
        const finalTeamName = `${categoryName} ${teamName.trim()}`;
        const userRef = doc(window.db, 'users', originalTeam.uid);
    
        try { 
            const userSnap = await getDoc(userRef);
            if (!userSnap.exists()) {
                notify("Používateľ už neexistuje.", "error");
                return;
            }

            const userData = userSnap.data();
            const teamsInCategory = [...(userData.teams?.[categoryName] || [])];
            const teamIndex = teamsInCategory.findIndex(t => t.teamName === originalTeam.teamName);
            if (teamIndex === -1) {
                notify("Tím sa nenašiel v profile používateľa (podľa názvu).", "error");
                return;
            }
    
            let newOrder = null;
            if (groupName) {
                const othersInGroup = teamsInCategory.filter(t => t.groupName === groupName && t.id !== originalTeam.id);
                const max = othersInGroup.reduce((m, t) => Math.max(m, t.order || 0), 0);
                newOrder = order != null ? parseInt(order, 10) : max + 1;
            }
    
            teamsInCategory[teamIndex] = {
                ...teamsInCategory[teamIndex],
                teamName: finalTeamName,
                groupName: groupName || null,
                order: newOrder
            };

            await updateDoc(userRef, { [`teams.${categoryName}`]: teamsInCategory });
    
            const action = originalTeam.groupName === groupName ? 'change_group_user' : 'assign_user';
            await createTeamAssignmentNotification(action, {
                id: originalTeam.id,
                teamName: finalTeamName,
                category: categoryName,
                groupName: groupName || null
            });
    
            notify(`Tím '${finalTeamName}' bol ${groupName ? 'zaradený/upravený' : 'odstránený zo skupiny'} v kategórii '${categoryName}'.`, "success");
        } catch (err) {
            console.error("Chyba pri aktualizácii používateľského tímu:", err);
            notify("Nepodarilo sa aktualizovať zaradenie tímu do skupiny.", "error");
        }
    };

    // ===================================================================
    // MODÁLNE OKNO (ako vnútorný komponent)
    // ===================================================================

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
        const { useState, useEffect } = React;
        const [orderInputValue, setOrderInputValue] = useState(null);
        const [selectedCategory, setSelectedCategory] = useState('');
        const [selectedGroup, setSelectedGroup] = useState('');
        const [teamName, setTeamName] = useState('');
        const [isDuplicate, setIsDuplicate] = useState(false);
        const [originalTeamName, setOriginalTeamName] = useState('');
        const [originalCategory, setOriginalCategory] = useState('');
        const [originalGroup, setOriginalGroup] = useState('');

        useEffect(() => {
            if (!isOpen || !selectedGroup) {
                setOrderInputValue(null);
                return;
            }
            if (teamToEdit && teamToEdit.groupName === selectedGroup && teamToEdit.order != null) {
                setOrderInputValue(teamToEdit.order);
                return;
            }
            const teamsInGroup = allTeams.filter(
                t => t.category === categoryIdToNameMap[selectedCategory] && t.groupName === selectedGroup
            );
            const maxOrder = teamsInGroup.reduce((max, t) => Math.max(max, t.order || 0), 0);
            setOrderInputValue(maxOrder + 1);
        }, [selectedGroup, isOpen, teamToEdit, allTeams, selectedCategory, categoryIdToNameMap]);

        useEffect(() => {
            if (isOpen) {
                if (teamToEdit) {
                    const categoryId = Object.keys(categoryIdToNameMap).find(
                        id => categoryIdToNameMap[id] === teamToEdit.category
                    ) || '';
                    setSelectedCategory(categoryId);
                    const teamNameWithoutPrefix = teamToEdit.teamName.replace(
                        new RegExp(`^${teamToEdit.category} `), ''
                    );
                    setTeamName(teamNameWithoutPrefix);
                    setSelectedGroup(teamToEdit.groupName || '');
                    setOriginalTeamName(teamToEdit.teamName);
                    setOriginalCategory(categoryId);
                    setOriginalGroup(teamToEdit.groupName || '');
                } else {
                    setSelectedCategory(defaultCategoryId || '');
                    setSelectedGroup(defaultGroupName || '');
                    setTeamName('');
                    setOriginalTeamName('');
                    setOriginalCategory('');
                    setOriginalGroup('');
                }
            } else {
                setSelectedCategory('');
                setSelectedGroup('');
                setTeamName('');
                setIsDuplicate(false);
                setOriginalTeamName('');
                setOriginalCategory('');
                setOriginalGroup('');
                setOrderInputValue(null);
            }
        }, [isOpen, teamToEdit, defaultCategoryId, defaultGroupName, categoryIdToNameMap]);

        useEffect(() => {
            if (!isOpen) return;
            const name = teamName.trim();
            const categoryName = categoryIdToNameMap[selectedCategory] || '';
            if (name && selectedCategory && categoryName) {
                const finalName = `${categoryName} ${name}`;
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
            if (!defaultGroupName) setSelectedGroup('');
        };

        const handleSubmit = (e) => {
            e.preventDefault();
            if (isSubmitDisabled) return;
            unifiedSaveHandler({
                categoryId: selectedCategory,
                groupName: selectedGroup || null,
                teamName: teamName.trim(),
                order: orderInputValue,
                isEdit: !!teamToEdit,
                originalTeam: teamToEdit
            });
        };

        const isCategoryValid = !!selectedCategory;
        const isGroupValid = !!selectedGroup;
        const isTeamNameValid = teamName.trim().length > 0;
        const isSubmitDisabled = !isCategoryValid || !isGroupValid || !isTeamNameValid || isDuplicate;

        const isCategoryFixed = !!defaultCategoryId && !teamToEdit;
        const isGroupFixed = !!defaultGroupName && !teamToEdit;
        const isCategoryDisabledInEdit = false;

        const modalTitle = teamToEdit ? 'Upraviť tím' : 'Pridať nový tím';
        const buttonText = teamToEdit ? 'Aktualizovať tím' : 'Pridať tím';
        const buttonBaseClasses = 'px-4 py-2 rounded-lg transition-colors duration-200';
        const activeClasses = 'bg-indigo-600 text-white hover:bg-indigo-700';
        const disabledClasses = 'bg-white text-indigo-600 border border-indigo-600 cursor-not-allowed shadow-none';

        if (!isOpen) return null;

        const currentCategoryName = categoryIdToNameMap[selectedCategory] || '';
        const finalTeamNamePreview = teamName.trim() ? `${currentCategoryName} ${teamName.trim()}` : '';

        return React.createElement(
            'div',
            {
                className: 'fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[100]',
                onClick: onClose
            },
            React.createElement(
                'div',
                {
                    className: 'bg-white p-8 rounded-xl shadow-2xl w-full max-w-lg',
                    onClick: (e) => e.stopPropagation()
                },
                React.createElement(
                    'h2',
                    { className: 'text-2xl font-bold text-gray-800 mb-6 text-center' },
                    modalTitle
                ),
                !teamToEdit
                    ? React.createElement(
                        'div',
                        { className: 'mb-6' },
                        React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-2' }, 'Názov tímu (bez názvu kategórie):'),
                        React.createElement('input', {
                            type: 'text',
                            className: `w-full p-3 border rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition-colors ${isDuplicate ? 'border-red-500' : 'border-gray-300'}`,
                            value: teamName,
                            onChange: (e) => setTeamName(e.target.value),
                            required: true,
                            autoFocus: true
                        }),
                        finalTeamNamePreview && React.createElement(
                            'div',
                            { className: 'mt-3 p-3 bg-indigo-50 rounded-lg text-center' },
                            React.createElement('p', { className: 'text-sm text-gray-600' }, 'Finálny názov v databáze bude:'),
                            React.createElement('p', { className: 'text-lg font-bold text-indigo-700 mt-1' }, finalTeamNamePreview)
                        ),
                        isDuplicate && React.createElement('p', { className: 'mt-2 text-sm text-red-600 font-medium' }, '⚠️ Tím s týmto názvom už existuje!')
                    )
                    : React.createElement(
                        'div',
                        { className: 'mb-6 text-center' },
                        React.createElement('p', { className: 'text-sm text-gray-600' }, 'Aktuálny názov tímu:'),
                        React.createElement('p', { className: 'text-2xl font-bold text-indigo-700 mt-1' }, teamToEdit.teamName)
                    ),

                React.createElement(
                    'form',
                    { onSubmit: handleSubmit, className: 'space-y-6' },
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
                            sortedCategoryEntries.map(([id, name]) => React.createElement('option', { key: id, value: id }, name))
                        ),
                        isCategoryFixed && React.createElement('p', { className: 'text-xs text-indigo-600 mt-1' }, `Predvolená kategória: ${categoryIdToNameMap[defaultCategoryId]}`)
                    ),
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
                            availableGroups.map((group) => React.createElement('option', { key: group.name, value: group.name }, `${group.name} (${group.type})`))
                        ),
                        isGroupFixed && React.createElement('p', { className: 'text-xs text-indigo-600 mt-1' }, `Predvolená skupina: ${defaultGroupName}`)
                    ),
                    selectedGroup && React.createElement(
                        'div',
                        { className: 'flex flex-col' },
                        React.createElement('label', { className: 'text-sm font-medium text-gray-700 mb-1' }, 'Poradie v skupine:'),
                        React.createElement('input', {
                            type: 'number',
                            min: '1',
                            className: 'p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 w-32',
                            value: orderInputValue ?? '',
                            onChange: (e) => setOrderInputValue(e.target.value === '' ? null : parseInt(e.target.value, 10)),
                            placeholder: 'auto'
                        }),
                    ),
                    React.createElement(
                        'div',
                        { className: 'pt-8 flex justify-end space-x-4' },
                        React.createElement('button', {
                            type: 'button',
                            className: 'px-6 py-2.5 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors',
                            onClick: onClose
                        }, 'Zrušiť'),
                        React.createElement('button', {
                            type: 'submit',
                            className: `${buttonBaseClasses} ${isSubmitDisabled ? disabledClasses : activeClasses}`,
                            disabled: isSubmitDisabled
                        }, buttonText)
                    )
                )
            )
        );
    };

    // Zjednotený handler pre uloženie
    const unifiedSaveHandler = async (data) => {
      if (data.isEdit) {
        await handleUpdateAnyTeam(data);
      } else {
        await handleAddNewTeam(data);
      }
      closeModal();
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setTeamToEdit(null);
    };

    const openAddModal = () => {
        setTeamToEdit(null);
        setIsModalOpen(true);
    };

    // ===================================================================
    // Zvyšok kódu – listenery, render funkcie, return
    // ===================================================================

    useEffect(() => {
        if (!window.db) return;
        const unsubscribeUsers = onSnapshot(query(collection(window.db, 'users')), (querySnapshot) => {
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
                                        order: hasGroup ? (team.order ?? 0) : null,
                                        isSuperstructureTeam: false,
                                    });
                                }
                            });
                        }
                    });
                }
            });
            setUserTeamsData(userTeamsList);
        });

        const unsubscribeSuperstructure = onSnapshot(doc(window.db, ...SUPERSTRUCTURE_TEAMS_DOC_PATH.split('/')), (docSnap) => {
            setSuperstructureTeams(docSnap.exists() ? docSnap.data() : {});
        });

        const unsubscribeCategories = onSnapshot(doc(window.db, 'settings', 'categories'), (docSnap) => {
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

        const unsubscribeGroups = onSnapshot(doc(window.db, 'settings', 'groups'), (docSnap) => {
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

    useEffect(() => {
        const globalTeamsList = Object.entries(superstructureTeams).flatMap(([categoryName, teamArray]) => 
            (teamArray || []).map(team => ({
                uid: 'global',
                category: categoryName,
                id: team.id || crypto.randomUUID(),
                teamName: team.teamName,
                groupName: team.groupName || null,
                order: team.groupName ? (team.order ?? 0) : null,
                isSuperstructureTeam: true
            }))
        );
        setAllTeams([...userTeamsData, ...globalTeamsList]);
    }, [userTeamsData, superstructureTeams]);

    // Hash sync logika (nezmenená)
    useEffect(() => {
        const readHash = () => {
            const hash = window.location.hash.substring(1);
            if (!hash) {
                setSelectedCategoryId('');
                setSelectedGroupName('');
                return;
            }
            const [catSlug, groupSlug] = hash.split('/');
            const catName = decodeURIComponent(catSlug).replace(/-/g, ' ');
            const groupName = groupSlug ? decodeURIComponent(groupSlug).replace(/-/g, ' ') : '';
            const catId = Object.entries(categoryIdToNameMap).find(([, name]) => name === catName)?.[0];
            setSelectedCategoryId(catId || '');
            setSelectedGroupName(groupName);
        };

        readHash();
        window.addEventListener('hashchange', readHash);
        return () => window.removeEventListener('hashchange', readHash);
    }, [categoryIdToNameMap]);

    useEffect(() => {
        if (!isInitialHashReadComplete) return;
        const catName = categoryIdToNameMap[selectedCategoryId];
        if (!catName) {
            window.location.replace('#');
            return;
        }
        let hash = encodeURIComponent(catName.replace(/ /g, '-'));
        if (selectedGroupName) {
            hash += `/${encodeURIComponent(selectedGroupName.replace(/ /g, '-'))}`;
        }
        window.location.replace(`#${hash}`);
    }, [selectedCategoryId, selectedGroupName, categoryIdToNameMap, isInitialHashReadComplete]);

    const handleCategorySelect = (e) => {
        const id = e.target.value;
        setSelectedCategoryId(id);
        const name = categoryIdToNameMap[id];
        window.location.replace(name ? `#${encodeURIComponent(name.replace(/ /g, '-'))}` : '#');
    };

    const handleGroupSelect = (e) => {
        const group = e.target.value;
        setSelectedGroupName(group);
        const catName = categoryIdToNameMap[selectedCategoryId];
        if (!catName) return;
        let hash = `#${encodeURIComponent(catName.replace(/ /g, '-'))}`;
        if (group) hash += `/${encodeURIComponent(group.replace(/ /g, '-'))}`;
        window.location.replace(hash);
    };

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
                if (t.order != null) orderCountMap.set(t.order, (orderCountMap.get(t.order) || 0) + 1);
            });
        }

        const items = sortedTeams.map((team, idx) => {
            const hasDuplicateOrder = !isWithoutGroup && team.order != null && (orderCountMap.get(team.order) || 0) > 1;
            const textColor = hasDuplicateOrder ? 'text-red-600 font-bold' : 'text-gray-800';
    
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
    
            // Rozhodnutie, či vôbec zobrazíme tlačidlo s košom
            const showDeleteButton = !isWithoutGroup || team.isSuperstructureTeam;
    
            return React.createElement(
                'li',
                {
                    key: team.id || `${team.uid || 'g'}-${team.teamName}-${team.groupName || ''}-${idx}`,
                    className: `flex justify-between items-center px-4 py-3 rounded-lg border shadow-sm ${team.isSuperstructureTeam ? 'bg-yellow-50' : 'bg-white'}`
                },
                React.createElement('span', { className: `flex-grow ${textColor}` }, display),
                React.createElement(
                    'div',
                    { className: 'flex items-center space-x-1' },
                    React.createElement(
                        'button',
                        {
                            onClick: () => {
                                setTeamToEdit(team);
                                setIsModalOpen(true);
                            },
                            className: 'text-gray-500 hover:text-indigo-600 p-1.5 rounded-full hover:bg-indigo-50 transition-colors',
                            title: 'Upraviť tím'
                        },
                        React.createElement('svg', { className: 'w-5 h-5', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
                            React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' })
                        )
                    ),
                    // Ikonka koša sa zobrazí LEN ak showDeleteButton === true
                    showDeleteButton &&
                    React.createElement(
                        'button',
                        {
                            onClick: () => handleRemoveOrDeleteTeam(team),
                            className: 'text-gray-500 hover:text-red-600 p-1.5 rounded-full hover:bg-red-50 transition-colors',
                            title: team.isSuperstructureTeam ? 'Odstrániť tím' : 'Zrušiť zaradenie do skupiny'
                        },
                        React.createElement('svg', { className: 'w-5 h-5', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
                            React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' })
                        )
                    )
                )
            );
        });
    
        return React.createElement('ul', { className: 'space-y-2' }, ...items);
    };

    const renderGroupedCategories = () => {
        if (Object.keys(allGroupsByCategoryId).length === 0) {
            return React.createElement('div', { className: 'w-full max-w-xl mx-auto' },
                React.createElement('p', { className: 'text-center text-gray-500' }, 'Žiadne skupiny neboli nájdené.')
            );
        }

        const sortedCategoryEntries = Object.entries(categoryIdToNameMap).sort(([, a], [, b]) => a.localeCompare(b));

        return React.createElement(
            'div',
            { className: 'flex flex-wrap gap-2 sm:gap-2 justify-center' },
            sortedCategoryEntries.map(([categoryId, categoryName], index) => {
                const groups = allGroupsByCategoryId[categoryId] || [];
                const teamsInThisCategory = allTeams.filter(team => team.category === categoryName);
                const sortedGroups = [...groups].sort((a, b) => {
                    if (a.type === 'základná skupina' && b.type !== 'základná skupina') return -1;
                    if (b.type === 'základná skupina' && a.type !== 'základná skupina') return 1;
                    return a.name.localeCompare(b.name);
                });

                return React.createElement(
                    'div',
                    { key: index, className: 'flex flex-col bg-white rounded-xl shadow-xl p-6 mb-3 flex-shrink-0' },
                    React.createElement('h3', { className: 'text-2xl font-semibold mb-4 text-center whitespace-nowrap' }, categoryName),
                    React.createElement('ul', { className: 'space-y-2' },
                        sortedGroups.map((group, groupIndex) =>
                            React.createElement(
                                'li',
                                { key: groupIndex, className: `px-4 py-2 rounded-lg text-gray-700 whitespace-nowrap ${getGroupColorClass(group.type)}` },
                                React.createElement('div', null,
                                    React.createElement('p', { className: 'font-semibold whitespace-nowrap' }, group.name),
                                    React.createElement('p', { className: 'text-sm text-gray-500 whitespace-nowrap' }, group.type),
                                    React.createElement('div', { className: 'mt-2 space-y-1' },
                                        renderTeamList(teamsInThisCategory.filter(t => t.groupName === group.name), group.name, categoryId)
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

        const teamsWithoutGroupHeight = teamsWithoutGroupRef.current?.offsetHeight || null;

        return React.createElement(
            'div',
            { className: 'flex flex-col lg:flex-row justify-center space-x-0 lg:space-x-3 w-full px-4' },
            React.createElement(
                'div',
                {
                    ref: teamsWithoutGroupRef,
                    className: "w-full lg:w-1/4 max-w-sm bg-white rounded-xl shadow-xl p-6 mb-4 flex-shrink-0"
                },
                React.createElement('h3', { className: 'text-2xl font-semibold mb-4 text-center' }, `Tímy bez skupiny v\u00A0kategórii: ${categoryName}`),
                renderTeamList(teamsWithoutGroup, null, selectedCategoryId, true)
            ),
            React.createElement(
                'div',
                { className: 'flex-grow min-w-0 flex flex-col gap-3' },
                sortedGroups.length > 0 ? sortedGroups.map((group, groupIndex) => {
                    const customStyle = selectedGroupName && teamsWithoutGroupHeight
                        ? { minHeight: `${teamsWithoutGroupHeight}px` }
                        : {};
                    return React.createElement(
                        'div',
                        {
                            key: groupIndex,
                            className: `flex flex-col rounded-xl shadow-xl p-6 mb-3 flex-shrink-0 ${getGroupColorClass(group.type)}`,
                            style: customStyle
                        },
                        React.createElement('h3', { className: 'text-2xl font-semibold mb-2 text-center whitespace-nowrap' }, group.name),
                        React.createElement('p', { className: 'text-center text-sm text-gray-600 mb-4' }, group.type),
                        React.createElement('div', { className: 'mt-2 space-y-1' },
                            renderTeamList(teamsInGroups.filter(t => t.groupName === group.name), group.name, selectedCategoryId)
                        )
                    );
                }) : React.createElement('p', { className: 'text-center text-gray-500' }, 'Žiadne skupiny v tejto kategórii.')
            )
        );
    };

    const teamsWithoutGroup = selectedCategoryId
        ? allTeams.filter(t => t.category === categoryIdToNameMap[selectedCategoryId] && !t.groupName).sort((a, b) => a.teamName.localeCompare(b.teamName))
        : allTeams.filter(t => !t.groupName).sort((a, b) => a.teamName.localeCompare(b.teamName));

    const teamsInGroups = selectedCategoryId
        ? allTeams.filter(t => t.category === categoryIdToNameMap[selectedCategoryId] && t.groupName)
        : allTeams.filter(t => t.groupName);

    const sortedCategoryEntries = Object.entries(categoryIdToNameMap).sort(([,a], [,b]) => a.localeCompare(b));

    const availableGroupsForSelect = (allGroupsByCategoryId[selectedCategoryId] || []).sort((a, b) => a.name.localeCompare(b.name));

    const uiNotificationClasses = `fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-2xl text-white text-center z-[9999] transition-all duration-400 ease-in-out ${
        uiNotification 
            ? 'opacity-100 scale-100 translate-y-0' 
            : 'opacity-0 scale-95 -translate-y-4 pointer-events-none'
    }`;

    let typeClasses = '';
    switch (uiNotification?.type) {
        case 'success': typeClasses = 'bg-green-500'; break;
        case 'error': typeClasses = 'bg-red-500'; break;
        case 'info': typeClasses = 'bg-blue-500'; break;
        default: typeClasses = 'bg-gray-700';
    }

    const fabBaseClasses = 'fixed bottom-8 right-8 p-5 rounded-full shadow-2xl transition-all duration-300 transform hover:scale-110 focus:outline-none';

    const fabButton = React.createElement(
        'button',
        {
            className: `
                fixed bottom-8 right-8 
                w-16 h-16  
                rounded-full
                bg-green-600 
                hover:bg-green-700 
                text-white 
                text-4xl 
                font-bold 
                shadow-2xl 
                flex items-center justify-center
                transition-all duration-200 
                hover:scale-110 
                focus:outline-none 
                focus:ring-4 focus:ring-green-300
                z-40
            `,
            onClick: openAddModal,
            title: "Pridať nový tím",
            'aria-label': "Pridať nový tím"
        },
        '+'
    );

    return React.createElement(
        'div',
        { className: 'flex flex-col w-full relative' },
        React.createElement('div', { key: uiNotification?.id || 'no-notification', className: `${uiNotificationClasses} ${typeClasses}` }, uiNotification?.message),
        React.createElement(NewTeamModal, {
            isOpen: isModalOpen,
            onClose: closeModal,
            teamToEdit,
            allTeams,
            categoryIdToNameMap,
            allGroupsByCategoryId,
            defaultCategoryId: selectedCategoryId,
            defaultGroupName: selectedGroupName,
            unifiedSaveHandler
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
                sortedCategoryEntries.map(([id, name]) => React.createElement('option', { key: id, value: id }, name))
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
                    { className: 'w-full lg:w-1/4 max-w-sm bg-white rounded-xl shadow-xl p-8 mb-6 flex-shrink-0' },
                    React.createElement('h3', { className: 'text-2xl font-semibold mb-4 text-center' }, 'Zoznam všetkých tímov'),
                    renderTeamList(teamsWithoutGroup, null, null, true)
                ),
                React.createElement('div', { className: 'flex-grow min-w-0' }, renderGroupedCategories())
            ),
        fabButton
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
            root.render(React.createElement('div', { className: 'flex justify-center items-center h-full pt-16' },
                React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
            ));
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
        root.render(React.createElement('div', { className: 'flex justify-center items-center h-full pt-16' },
            React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
        ));
    }
}
