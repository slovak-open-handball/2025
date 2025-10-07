import { doc, getDoc, onSnapshot, updateDoc, collection, Timestamp, query, getDocs, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
const { useState, useEffect, useRef } = React;
const SUPERSTRUCTURE_TEAMS_DOC_PATH = 'settings/superstructureGroups';

const NewTeamModal = ({ isOpen, onClose, allGroupsByCategoryId, categoryIdToNameMap, unifiedSaveHandler, teamToEdit, allTeams, defaultCategoryId, defaultGroupName }) => {
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedGroup, setSelectedGroup] = useState('');
    const [teamName, setTeamName] = useState('');
    const [isDuplicate, setIsDuplicate] = useState(false);
    const [originalTeamName, setOriginalTeamName] = useState('');
    const [originalCategory, setOriginalCategory] = useState('');
    const [originalGroup, setOriginalGroup] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (teamToEdit) {
                const categoryId = Object.keys(categoryIdToNameMap).find(id => categoryIdToNameMap[id] === teamToEdit.category) || '';
                setSelectedCategory(categoryId);
                const teamNameWithoutPrefix = teamToEdit.teamName.replace(new RegExp(`^${teamToEdit.category} `), '');
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
        if (!defaultGroupName) {
            setSelectedGroup('');
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (isSubmitDisabled) return;
        unifiedSaveHandler({
            categoryId: selectedCategory,
            groupName: selectedGroup,
            teamName: teamName,
            isEdit: !!teamToEdit,
            originalTeam: teamToEdit
        });
    };

    const isCategoryValid = !!selectedCategory;
    const isGroupValid = !!selectedGroup;
    const isTeamNameValid = teamName.trim().length > 0;
    const isSubmitDisabled = !isCategoryValid || !isGroupValid || !isTeamNameValid || isDuplicate;

    if (!isOpen) return null;

    const isCategoryFixed = !!defaultCategoryId && !teamToEdit;
    const isGroupFixed = !!defaultGroupName && !teamToEdit;
    const isCategoryDisabledInEdit = !!teamToEdit;

    const modalTitle = teamToEdit ? 'Upraviť Globálny Tím' : 'Pridať Nový Tím';
    const buttonText = teamToEdit ? 'Potvrdiť a Aktualizovať Tím' : 'Potvrdiť a Uložiť Tím';
    const buttonBaseClasses = 'px-4 py-2 rounded-lg transition-colors duration-200';
    const activeClasses = 'bg-indigo-600 text-white hover:bg-indigo-700';
    const disabledClasses = 'bg-white text-indigo-600 border border-indigo-600 cursor-default shadow-none cursor-not-allowed';

    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[100]', onClick: onClose },
        React.createElement(
            'div',
            { className: 'bg-white p-8 rounded-xl shadow-2xl w-full max-w-lg transition-all transform scale-100', onClick: (e) => e.stopPropagation() },
            React.createElement('h2', { className: 'text-2xl font-bold text-gray-800 mb-6 border-b pb-2' }, modalTitle),
            React.createElement(
                'form',
                { onSubmit: handleSubmit, className: 'space-y-4' },
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
                        sortedCategoryEntries.map(([id, name]) =>
                            React.createElement('option', { key: id, value: id }, name)
                        )
                    ),
                    isCategoryDisabledInEdit && React.createElement('p', { className: 'text-xs text-red-600 mt-1' }, `Pri editácii tímu nemôžete zmeniť kategóriu.`),
                    isCategoryFixed && !isCategoryDisabledInEdit && React.createElement('p', { className: 'text-xs text-indigo-600 mt-1' }, `Kategória je predvolená filtrom na stránke: ${categoryIdToNameMap[defaultCategoryId]}`)
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
                        availableGroups.map((group, index) =>
                            React.createElement('option', { key: index, value: group.name }, `${group.name} (${group.type})`)
                        )
                    ),
                    isGroupFixed && React.createElement('p', { className: 'text-xs text-indigo-600 mt-1' }, `Skupina je predvolená filtrom na stránke: ${defaultGroupName}`)
                ),
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
                    ),
                    isDuplicate && React.createElement('p', { className: 'text-sm text-red-600 mt-2 font-medium p-2 bg-red-50 rounded-lg border border-red-300' }, `Tím s názvom "${categoryIdToNameMap[selectedCategory]} ${teamName.trim()}" už existuje. Zmeňte prosím názov.`)
                ),
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
                            className: `${buttonBaseClasses} ${isSubmitDisabled ? disabledClasses : activeClasses}`,
                            disabled: isSubmitDisabled
                        },
                        buttonText
                    )
                )
            )
        )
    );
};

const AddGroupsApp = ({ userProfileData: initialUserProfileData }) => {
    const [allTeams, setAllTeams] = useState([]);
    const [userTeamsData, setUserTeamsData] = useState([]);
    const [superstructureTeams, setSuperstructureTeams] = useState({});
    const [allGroupsByCategoryId, setAllGroupsByCategoryId] = useState({});
    const [categoryIdToNameMap, setCategoryIdToNameMap] = useState({});
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [selectedGroupName, setSelectedGroupName] = useState('');
    const [notification, setNotification] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [teamToEdit, setTeamToEdit] = useState(null);
    const [isInitialHashReadComplete, setIsInitialHashReadComplete] = useState(false);
    const [isDraggingSuperstructureTeam, setIsDraggingSuperstructureTeam] = useState(false);
    const [isOverFabToDelete, setIsOverFabToDelete] = useState(false);
    const draggedItem = useRef(null);
    const listRefs = useRef({});
    const [dropTarget, setDropTarget] = useState({ groupId: null, categoryId: null, index: null });
    const teamsWithoutGroupRef = useRef(null);

    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => {
                setNotification(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    const closeModal = () => {
        setIsModalOpen(false);
        setTeamToEdit(null);
    };

    const openEditModal = (team) => {
        if (team.isSuperstructureTeam) {
            setTeamToEdit(team);
            setIsModalOpen(true);
        } else {
            setNotification({ id: Date.now(), message: "Môžete upravovať len globálne (žlté) tímy.", type: 'info' });
        }
    };

    const openAddModal = () => {
        setTeamToEdit(null);
        setIsModalOpen(true);
    };

    const unifiedSaveHandler = async (data) => {
        if (data.isEdit) {
            await handleUpdateTeam(data);
        } else {
            await handleAddNewTeam(data);
        }
        closeModal();
    };

    const slugifyName = (name) => {
        if (!name) return '';
        return name.replace(/ /g, '-');
    };

    const deslugifyName = (slug) => {
        if (!slug) return '';
        return slug.replace(/-/g, ' ');
    };

    const mapSuperstructureTeams = (globalTeams) => {
        let globalTeamsList = [];
        Object.entries(globalTeams).forEach(([categoryName, teamArray]) => {
            if (Array.isArray(teamArray)) {
                teamArray.forEach(team => {
                    if (team.teamName) {
                        const hasGroup = team.groupName && team.groupName.trim() !== '';
                        globalTeamsList.push({
                            uid: 'global',
                            category: categoryName,
                            id: team.id || crypto.randomUUID(),
                            teamName: team.teamName,
                            groupName: team.groupName || null,
                            order: hasGroup ? (team.order ?? 0) : null,
                            isSuperstructureTeam: true,
                        });
                    }
                });
            }
        });
        return globalTeamsList;
    };

    useEffect(() => {
        if (!window.db) return;
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
                                    const hasGroup = team.groupName && team.groupName.trim() !== '';
                                    userTeamsList.push({
                                        uid: doc.id,
                                        category: categoryName,
                                        id: team.id || `${doc.id}-${team.teamName}`,
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

        const superstructureDocRef = doc(window.db, ...SUPERSTRUCTURE_TEAMS_DOC_PATH.split('/'));
        const unsubscribeSuperstructure = onSnapshot(superstructureDocRef, (docSnap) => {
            let globalTeams = {};
            if (docSnap.exists()) {
                globalTeams = docSnap.data();
            }
            setSuperstructureTeams(globalTeams);
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
            unsubscribeUsers();
            unsubscribeSuperstructure();
            unsubscribeCategories();
            unsubscribeGroups();
        };
    }, []);

    useEffect(() => {
        const globalTeamsList = mapSuperstructureTeams(superstructureTeams);
        setAllTeams([...userTeamsData, ...globalTeamsList]);
    }, [userTeamsData, superstructureTeams]);

    const categoryNameToIdMap = Object.entries(categoryIdToNameMap).reduce((acc, [id, name]) => {
        acc[name] = id;
        return acc;
    }, {});

    const readHashAndSetState = (map) => {
        const hash = window.location.hash.substring(1);
        if (Object.keys(map).length === 0 && hash) {
            if (hash) return;
        }
        if (hash) {
            const parts = hash.split('/');
            const categorySlugFromUrl = parts[0];
            const groupSlugFromUrl = parts[1];
            const categoryNameFromUrl = deslugifyName(decodeURIComponent(categorySlugFromUrl));
            const groupNameFromUrl = groupSlugFromUrl ? deslugifyName(decodeURIComponent(groupSlugFromUrl)) : '';
            const categoryId = map[categoryNameFromUrl];
            setSelectedCategoryId(categoryId || '');
            setSelectedGroupName(groupNameFromUrl || '');
        } else {
            setSelectedCategoryId('');
            setSelectedGroupName('');
        }
        if (Object.keys(map).length > 0 && !isInitialHashReadComplete) {
            setIsInitialHashReadComplete(true);
        }
    };

    useEffect(() => {
        readHashAndSetState(categoryNameToIdMap);
        const handleHashChange = () => {
            readHashAndSetState(categoryNameToIdMap);
        };
        window.addEventListener('hashchange', handleHashChange);
        return () => {
            window.removeEventListener('hashchange', handleHashChange);
        };
    }, [categoryNameToIdMap, isInitialHashReadComplete]);

    useEffect(() => {
        if (!isInitialHashReadComplete) return;
        let hash = '';
        const categoryName = categoryIdToNameMap[selectedCategoryId];
        if (categoryName) {
            const categorySlug = slugifyName(categoryName);
            hash = encodeURIComponent(categorySlug);
            if (selectedGroupName) {
                const groupSlug = slugifyName(selectedGroupName);
                hash += `/${encodeURIComponent(groupSlug)}`;
            }
        }
        const currentHash = window.location.hash.substring(1);
        if (currentHash !== hash) {
            window.location.replace(`#${hash}`);
        }
    }, [selectedCategoryId, selectedGroupName, categoryIdToNameMap, isInitialHashReadComplete]);

    const handleCategorySelect = (e) => {
        const newCategoryId = e.target.value;
        const categoryName = categoryIdToNameMap[newCategoryId];
        if (categoryName) {
            const categorySlug = slugifyName(categoryName);
            const newHash = `#${encodeURIComponent(categorySlug)}`;
            window.location.replace(newHash);
        } else {
            window.location.replace(`#`);
        }
    };

    const handleGroupSelect = (e) => {
        const newGroupName = e.target.value;
        const categoryName = categoryIdToNameMap[selectedCategoryId];
        if (categoryName) {
            const categorySlug = slugifyName(categoryName);
            let newHash = `#${encodeURIComponent(categorySlug)}`;
            if (newGroupName) {
                const groupSlug = slugifyName(newGroupName);
                newHash += `/${encodeURIComponent(groupSlug)}`;
            }
            window.location.replace(newHash);
        }
    };

    const handleAddNewTeam = async ({ categoryId, groupName, teamName }) => {
        if (!window.db) {
            setNotification({ id: Date.now(), message: "Firestore nie je inicializovaný.", type: 'error' });
            return;
        }
        const categoryName = categoryIdToNameMap[categoryId];
        const superstructureDocRef = doc(window.db, ...SUPERSTRUCTURE_TEAMS_DOC_PATH.split('/'));
        const finalTeamName = `${categoryName} ${teamName}`;
        const isDuplicateFinal = allTeams.some(team => team.teamName === finalTeamName);
        if (isDuplicateFinal) {
            setNotification({ id: Date.now(), message: `Globálny tím '${finalTeamName}' už existuje. Ukladanie zrušené.`, type: 'error' });
            return;
        }
        try {
            const docSnap = await getDoc(superstructureDocRef);
            const globalTeamsData = docSnap.exists() ? docSnap.data() : {};
            const currentTeamsForCategory = globalTeamsData[categoryName] || [];
            const teamsInTargetGroup = currentTeamsForCategory.filter(t => t.groupName === groupName);
            let maxOrder = 0;
            teamsInTargetGroup.forEach(t => {
                if (t.order > maxOrder) {
                    maxOrder = t.order;
                }
            });
            const newOrder = groupName ? (maxOrder + 1) : null;
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

    const handleUpdateTeam = async ({ categoryId, groupName, teamName, originalTeam }) => {
        if (!window.db || !originalTeam) return;
        const categoryName = categoryIdToNameMap[categoryId];
        const superstructureDocRef = doc(window.db, ...SUPERSTRUCTURE_TEAMS_DOC_PATH.split('/'));
        const finalTeamName = `${categoryName} ${teamName}`;
        const originalGroupName = originalTeam.groupName;
        try {
            const docSnap = await getDoc(superstructureDocRef);
            const globalTeamsData = docSnap.exists() ? docSnap.data() : {};
            let teams = globalTeamsData[originalTeam.category] || [];
            const originalTeamIndex = teams.findIndex(t => t.id === originalTeam.id);
            if (originalTeamIndex === -1) {
                setNotification({ id: Date.now(), message: `Chyba: Aktualizovaný globálny tím sa nenašiel.`, type: 'error' });
                return;
            }
            const oldOrder = originalTeam.order;
            const newGroupName = groupName || null;
            let newOrder = originalTeam.order;
            const teamToUpdate = teams[originalTeamIndex];
            teams.splice(originalTeamIndex, 1);
            if (originalGroupName !== newGroupName) {
                teams = teams.map(t => {
                    if (t.groupName === originalGroupName && t.order != null && t.order > oldOrder) {
                        return { ...t, order: t.order - 1 };
                    }
                    return t;
                });
                const teamsInTargetGroup = teams.filter(t => t.groupName === newGroupName);
                const maxOrder = teamsInTargetGroup.reduce((max, t) => (t.order != null ? Math.max(max, t.order) : max), 0);
                newOrder = newGroupName ? (maxOrder + 1) : null;
            }
            const updatedTeam = {
                ...teamToUpdate,
                teamName: finalTeamName,
                groupName: newGroupName,
                order: newOrder,
            };
            if (originalGroupName !== newGroupName) {
                teams.push(updatedTeam);
            } else {
                teams.splice(originalTeamIndex, 0, updatedTeam);
            }
            await setDoc(superstructureDocRef, {
                ...globalTeamsData,
                [originalTeam.category]: teams
            }, { merge: true });
            setNotification({
                id: Date.now(),
                message: `Globálny tím '${finalTeamName}' bol úspešne aktualizovaný.`,
                type: 'success'
            });
        } catch (error) {
            console.error("Chyba pri aktualizácii globálneho tímu:", error);
            setNotification({ id: Date.now(), message: "Chyba pri aktualizácii tímu v globálnom dokumente.", type: 'error' });
        }
    };

    const handleDeleteTeam = async (teamToDelete) => {
        if (!window.db || !teamToDelete || !teamToDelete.isSuperstructureTeam) {
            setNotification({ id: Date.now(), message: "Chyba: Možno odstrániť len globálne tímy.", type: 'error' });
            return;
        }
        const superstructureDocRef = doc(window.db, ...SUPERSTRUCTURE_TEAMS_DOC_PATH.split('/'));
        try {
            const docSnap = await getDoc(superstructureDocRef);
            const globalTeamsData = docSnap.exists() ? docSnap.data() : {};
            let teams = globalTeamsData[teamToDelete.category] || [];
            const teamIndex = teams.findIndex(t => t.id === teamToDelete.id);
            if (teamIndex === -1) {
                setNotification({ id: Date.now(), message: `Chyba: Odstraňovaný globálny tím sa nenašiel.`, type: 'error' });
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
            setNotification({
                id: Date.now(),
                message: `Globálny tím '${teamToDelete.teamName}' bol úspešne odstránený.`,
                type: 'success'
            });
        } catch (error) {
            console.error("Chyba pri odstraňovaní globálneho tímu:", error);
            setNotification({ id: Date.now(), message: "Chyba pri odstraňovaní tímu z globálneho dokumentu.", type: 'error' });
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
    };

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
                const nextRect = teamElements[i + 1];
                const nextRectBounds = nextRect.getBoundingClientRect();
                const gapStart = rect.bottom + 2;
                const gapEnd = nextRectBounds.top - 2;
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
    };

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
        const listRefKey = targetGroup === null ? `${targetCategoryId}-null` : `${targetCategoryId}-${targetGroup}`;
        const containerRef = listRefs.current[listRefKey];
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
        const newOrder = targetGroup ? finalDropTarget.index : null;
        const finalGroupName = targetGroup === null ? null : targetGroup;
        const finalOrder = targetGroup === null ? null : newOrder;
        try {
            if (teamData.isSuperstructureTeam) {
                const superstructureDocRef = doc(window.db, ...SUPERSTRUCTURE_TEAMS_DOC_PATH.split('/'));
                const docSnap = await getDoc(superstructureDocRef);
                const globalTeamsData = docSnap.exists() ? docSnap.data() : {};
                let teams = globalTeamsData[teamCategoryName] || [];
                const originalTeamIndex = teams.findIndex(t => t.teamName === teamData.teamName);
                if (originalTeamIndex === -1) {
                    setNotification({ id: Date.now(), message: `Chyba: Presúvaný globálny tím (${teamData.teamName}) sa nenašiel v cieľovej kategórii.`, type: 'error' });
                    return;
                }
                const updatedDraggedTeam = {
                    ...teams[originalTeamIndex],
                    groupName: finalGroupName,
                    order: finalOrder
                };
                teams = [...teams];
                teams.splice(originalTeamIndex, 1);
                const reorderedTeams = teams.map(t => {
                    const t_is_in_original_group = t.groupName === originalGroup && t.order != null;
                    const t_is_in_target_group = t.groupName === finalGroupName && t.order != null;
                    if (originalGroup !== finalGroupName && t_is_in_original_group && t.order > originalOrder) {
                        return { ...t, order: t.order - 1 };
                    }
                    else if (t_is_in_target_group && finalOrder !== null && t.order >= finalOrder) {
                        return { ...t, order: t.order + 1 };
                    }
                    else if (originalGroup === finalGroupName && t_is_in_target_group) {
                        if (finalOrder > originalOrder && t.order > originalOrder && t.order <= finalOrder) {
                            return { ...t, order: t.order - 1 };
                        }
                        else if (finalOrder < originalOrder && t.order >= finalOrder && t.order < originalOrder) {
                            return { ...t, order: t.order + 1 };
                        }
                    }
                    return t;
                });
                if (finalGroupName !== null) {
                    reorderedTeams.splice(finalOrder - 1, 0, updatedDraggedTeam);
                } else {
                    reorderedTeams.push(updatedDraggedTeam);
                }
                await setDoc(superstructureDocRef, {
                    ...globalTeamsData,
                    [teamCategoryName]: reorderedTeams
                }, { merge: true });
            } else {
                const ownerUid = teamData.uid;
                const ownerDocRef = doc(window.db, 'users', ownerUid);
                const docSnap = await getDoc(ownerDocRef);
                if (!docSnap.exists() || !docSnap.data().teams || !docSnap.data().teams[teamCategoryName]) {
                    setNotification({ id: Date.now(), message: `Chyba: Dokument vlastníka tímu (${ownerUid}) alebo pole tímov v kategórii ${teamCategoryName} nenájdené.`, type: 'error' });
                    return;
                }
                const ownerTeamsData = docSnap.data().teams;
                let teams = [...ownerTeamsData[teamCategoryName]];
                const originalTeamIndex = teams.findIndex(t => t.teamName === teamData.teamName);
                if (originalTeamIndex === -1) {
                    setNotification({ id: Date.now(), message: `Chyba: Presúvaný používateľský tím (${teamData.teamName}) sa nenašiel v dokumente vlastníka.`, type: 'error' });
                    return;
                }
                const updatedDraggedTeam = {
                    ...teams[originalTeamIndex],
                    groupName: finalGroupName,
                    order: finalOrder
                };
                teams.splice(originalTeamIndex, 1);
                const reorderedTeams = teams.map(t => {
                    const t_is_in_original_group = t.groupName === originalGroup && t.order != null;
                    const t_is_in_target_group = t.groupName === targetGroup && t.order != null;
                    if (originalGroup !== null && originalGroup !== finalGroupName && t_is_in_original_group && t.order > originalOrder) {
                        return { ...t, order: t.order - 1 };
                    }
                    else if (targetGroup !== null && targetGroup === t.groupName && t_is_in_target_group && finalOrder !== null && t.order >= finalOrder) {
                        return { ...t, order: t.order + 1 };
                    }
                    else if (originalGroup === finalGroupName && originalGroup !== null && t_is_in_target_group) {
                        if (finalOrder > originalOrder && t.order > originalOrder && t.order <= finalOrder) {
                            return { ...t, order: t.order - 1 };
                        }
                        else if (finalOrder < originalOrder && t.order >= finalOrder && t.order < originalOrder) {
                            return { ...t, order: t.order + 1 };
                        }
                    }
                    return t;
                });
                if (finalGroupName !== null) {
                    reorderedTeams.splice(finalOrder - 1, 0, updatedDraggedTeam);
                } else {
                    reorderedTeams.push(updatedDraggedTeam);
                }
                await updateDoc(ownerDocRef, {
                    [`teams.${teamCategoryName}`]: reorderedTeams
                });
            }
            const targetDocPath = teamData.isSuperstructureTeam ? SUPERSTRUCTURE_TEAMS_DOC_PATH : `users/${teamData.uid}`;
            const notificationMessage = `Tím ${teamData.teamName} bol presunutý z ${originalGroup ? `'${originalGroup}'` : 'bez skupiny'} do ${finalGroupName ? `'${finalGroupName}' na pozíciu ${finalOrder}` : 'bez skupiny'}. (Dokument: ${targetDocPath}).`;
            setNotification({ id: Date.now(), message: notificationMessage, type: 'success' });
        } catch (error) {
            console.error("Chyba pri aktualizácii databázy:", error);
            if (!notification || notification.type !== 'error') {
                setNotification({ id: Date.now(), message: "Nastala chyba pri ukladaní údajov do databázy.", type: 'error' });
            }
        }
    };

    const handleDragStart = (e, team) => {
        draggedItem.current = { team };
        e.dataTransfer.setData("text/plain", JSON.stringify(team));
        e.dataTransfer.effectAllowed = "move";
        if (team.isSuperstructureTeam) {
            setIsDraggingSuperstructureTeam(true);
        }
    };

    const handleDragEnd = () => {
        draggedItem.current = null;
        setDropTarget({ groupId: null, categoryId: null, index: null });
        setIsDraggingSuperstructureTeam(false);
        setIsOverFabToDelete(false);
    };

    const handleFabDragEnter = (e) => {
        e.preventDefault();
        const dragData = draggedItem.current;
        if (dragData && dragData.team.isSuperstructureTeam) {
            setIsOverFabToDelete(true);
            e.dataTransfer.dropEffect = "copy";
        }
    };

    const handleFabDragLeave = () => {
        setIsOverFabToDelete(false);
    };

    const handleFabDrop = (e) => {
        e.preventDefault();
        const dragData = draggedItem.current;
        setIsOverFabToDelete(false);
        setIsDraggingSuperstructureTeam(false);
        if (dragData && dragData.team.isSuperstructureTeam) {
            handleDeleteTeam(dragData.team);
            draggedItem.current = null;
        }
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
            const isDropIndicatorVisible = dropTarget.groupId === targetGroupId && dropTarget.categoryId === targetCategoryId && dropTarget.index === index;
            const showActionButtons = team.isSuperstructureTeam && !isWithoutGroup;
            return React.createElement(
                React.Fragment,
                { key: team.id || `${team.uid}-${team.teamName}-${team.groupName}-${index}` },
                isDropIndicatorVisible && React.createElement('div', { className: 'drop-indicator h-1 bg-blue-500 rounded-full my-1 transition-all duration-100' }),
                React.createElement(
                    'li',
                    {
                        className: `flex justify-between items-center px-4 py-2 ${teamBgClass} rounded-lg text-gray-700 shadow-sm border border-gray-200`,
                        draggable: "true",
                        onDragStart: (e) => handleDragStart(e, team),
                        onDragEnd: handleDragEnd,
                        onDragOver: (e) => handleDragOverTeam(e, targetGroupId, targetCategoryId, index),
                    },
                    React.createElement('span', { className: 'flex-grow cursor-grab' }, teamNameDisplay),
                    showActionButtons && React.createElement(
                        'div',
                        { className: 'flex space-x-2 ml-4 flex-shrink-0' },
                        React.createElement(
                            'button',
                            {
                                type: 'button',
                                onClick: () => openEditModal(team),
                                className: 'text-gray-500 hover:text-indigo-600 p-1 rounded-full transition-colors duration-150',
                                title: 'Upraviť tím'
                            },
                            React.createElement('svg', { className: 'w-4 h-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24', xmlns: 'http://www.w3.org/2000/svg' },
                                React.createElement('path', { 'strokeLinecap': 'round', 'strokeLinejoin': 'round', 'strokeWidth': '2', d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' })
                            )
                        ),
                        React.createElement(
                            'button',
                            {
                                type: 'button',
                                onClick: () => handleDeleteTeam(team),
                                className: 'text-gray-500 hover:text-red-600 p-1 rounded-full transition-colors duration-150',
                                title: 'Odstrániť tím'
                            },
                            React.createElement('svg', { className: 'w-4 h-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24', xmlns: 'http://www.w3.org/2000/svg' },
                                React.createElement('path', { 'strokeLinecap': 'round', 'strokeLinejoin': 'round', 'strokeWidth': '2', d: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' })
                            )
                        )
                    )
                )
            );
        });
        const isDropIndicatorVisibleAtEnd = dropTarget.groupId === targetGroupId && dropTarget.categoryId === targetCategoryId && dropTarget.index === sortedTeams.length;
        const listRefKey = targetGroupId === null ? `${targetCategoryId}-null` : `${targetCategoryId}-${targetGroupId}`;
        if (sortedTeams.length === 0) {
            const isDropOnEmptyContainer = dropTarget.groupId === targetGroupId && dropTarget.categoryId === targetCategoryId && dropTarget.index === 0;
            return React.createElement(
                'div',
                {
                    onDragOver: (e) => handleDragOverEmptyContainer(e, targetGroupId, targetCategoryId),
                    onDrop: (e) => handleDrop(e, targetGroupId, targetCategoryId),
                    className: `min-h-[50px] p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center relative ${isDropOnEmptyContainer ? 'border-blue-500 bg-blue-50' : ''}`,
                    ref: el => {
                        if (el) {
                            listRefs.current[listRefKey] = el;
                        } else {
                            delete listRefs.current[listRefKey];
                        }
                    },
                },
                React.createElement('p', { className: 'text-center text-gray-400' }, 'Sem presuňte tím')
            );
        }
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

    const getGroupColorClass = (type) => {
        switch (type) {
            case 'základná skupina': return 'bg-gray-100';
            case 'nadstavbová skupina': return 'bg-blue-100';
            default: return 'bg-white';
        }
    };

    const renderGroupedCategories = () => {
        if (Object.keys(allGroupsByCategoryId).length === 0) {
            return React.createElement(
                'div',
                { className: 'w-full max-w-xl mx-auto' },
                React.createElement('p', { className: 'text-center text-gray-500' }, 'Žiadne skupiny neboli nájdené.')
            );
        }
        const sortedCategoryEntries = Object.entries(categoryIdToNameMap).sort(([, nameA], [, nameB]) => nameA.localeCompare(nameB));
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
                    React.createElement('h3', { className: 'text-2xl font-semibold mb-4 text-center whitespace-nowrap' }, categoryName),
                    React.createElement(
                        'ul',
                        { className: 'space-y-2' },
                        sortedGroups.map((group, groupIndex) =>
                            React.createElement(
                                'li',
                                { key: groupIndex, className: `px-4 py-2 rounded-lg text-gray-700 whitespace-nowrap ${getGroupColorClass(group.type)}` },
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
        const teamsWithoutGroupHeight = teamsWithoutGroupRef.current ? teamsWithoutGroupRef.current.offsetHeight : null;
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
                                customStyle = { minHeight: `${teamsWithoutGroupHeight}px` };
                            }
                        }
                        return React.createElement(
                            'div',
                            {
                                key: groupIndex,
                                className: `flex flex-col rounded-xl shadow-xl p-8 mb-6 flex-shrink-0 ${getGroupColorClass(group.type)}`,
                                style: customStyle,
                            },
                            React.createElement('h3', { className: 'text-2xl font-semibold mb-2 text-center whitespace-nowrap' }, group.name),
                            React.createElement('p', { className: 'text-center text-sm text-gray-600 mb-4' }, group.type),
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

    const sortedCategoryEntries = Object.entries(categoryIdToNameMap).sort(([, nameA], [, nameB]) => nameA.localeCompare(nameB));
    const notificationClasses = `fixed-notification fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl text-white text-center transition-opacity duration-300 transform z-50 flex items-center justify-center ${notification ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`;
    let typeClasses = '';
    switch (notification?.type) {
        case 'success': typeClasses = 'bg-green-500'; break;
        case 'error': typeClasses = 'bg-red-500'; break;
        case 'info': typeClasses = 'bg-blue-500'; break;
        default: typeClasses = 'bg-gray-700';
    }

    const availableGroupsForSelect = (allGroupsByCategoryId[selectedCategoryId] || []).sort((a, b) => a.name.localeCompare(b.name));
    const fabBaseClasses = 'fixed bottom-8 right-8 p-5 rounded-full shadow-2xl transition-all duration-300 transform hover:scale-110 focus:outline-none';
    const fabButton = isDraggingSuperstructureTeam && !isModalOpen
        ? React.createElement(
            'button',
            {
                className: `${fabBaseClasses} ${isOverFabToDelete ? 'bg-red-600 focus:ring-red-400' : 'bg-red-400 focus:ring-red-300'} text-white`,
                onDragEnter: handleFabDragEnter,
                onDragLeave: handleFabDragLeave,
                onDragOver: (e) => e.preventDefault(),
                onDrop: handleFabDrop,
            },
            React.createElement('span', { className: 'text-2xl font-bold' }, '−')
        )
        : React.createElement(
            'button',
            {
                className: `${fabBaseClasses} bg-green-500 hover:bg-green-600 text-white focus:ring-green-400`,
                onClick: openAddModal,
            },
            React.createElement('span', { className: 'text-2xl font-bold' }, '+')
        );

    const teamsWithoutGroup = selectedCategoryId
        ? allTeams.filter(team => team.category === categoryIdToNameMap[selectedCategoryId] && !team.groupName).sort((a, b) => a.teamName.localeCompare(b.teamName))
        : allTeams.filter(team => !team.groupName).sort((a, b) => a.teamName.localeCompare(b.teamName));
    const teamsInGroups = selectedCategoryId
        ? allTeams.filter(team => team.category === categoryIdToNameMap[selectedCategoryId] && team.groupName)
        : allTeams.filter(team => team.groupName);

    return React.createElement(
        'div',
        { className: 'flex flex-col w-full relative' },
        React.createElement(
            'div',
            { className: `${notificationClasses} ${typeClasses}` },
            notification?.message
        ),
        React.createElement(NewTeamModal, {
            isOpen: isModalOpen,
            onClose: closeModal,
            allGroupsByCategoryId: allGroupsByCategoryId,
            categoryIdToNameMap: categoryIdToNameMap,
            unifiedSaveHandler: unifiedSaveHandler,
            teamToEdit: teamToEdit,
            allTeams: allTeams,
            defaultCategoryId: selectedCategoryId,
            defaultGroupName: selectedGroupName,
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
                    { className: `w-full lg:w-1/4 max-w-sm bg-white rounded-xl shadow-xl p-8 mb-6 flex-shrink-0` },
                    React.createElement('h3', { className: 'text-2xl font-semibold mb-4 text-center' }, 'Zoznam všetkých tímov'),
                    renderTeamList(teamsWithoutGroup, null, null, true)
                ),
                React.createElement(
                    'div',
                    { className: 'flex-grow min-w-0' },
                    renderGroupedCategories()
                )
            ),
        fabButton
    );
};

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
