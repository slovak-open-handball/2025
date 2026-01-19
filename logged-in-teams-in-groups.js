import { doc, getDoc, onSnapshot, updateDoc, collection, Timestamp, query, getDocs, setDoc, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// Referencia na globálny konfiguračný dokument pre nadstavbové tímy
const SUPERSTRUCTURE_TEAMS_DOC_PATH = 'settings/superstructureGroups';

// --- HLAVNÉ UPDATE FUNKCIE ---

const handleUpdateTeam = async ({ categoryId, groupName, teamName, order, originalTeam, categoryIdToNameMap, setNotification }) => {
    if (!window.db || !originalTeam) return;

    const categoryName = categoryIdToNameMap[categoryId];
    const superstructureDocRef = doc(window.db, ...SUPERSTRUCTURE_TEAMS_DOC_PATH.split('/'));

    const finalTeamName = `${categoryName} ${teamName}`;
    const originalGroupName = originalTeam.groupName;

    try {
        const docSnap = await getDoc(superstructureDocRef);
        if (!docSnap.exists()) return;
        const globalTeamsData = docSnap.data();

        let teams = [...(globalTeamsData[originalTeam.category] || [])];
        const originalTeamIndex = teams.findIndex(t => t.id === originalTeam.id);

        if (originalTeamIndex === -1) {
            setNotification({ id: Date.now(), message: "Tím sa nenašiel pri aktualizácii", type: 'error' });
            return;
        }

        const newGroupName = groupName || null;
        let newOrder = originalTeam.order;

        // Odstránime tím z pôvodného miesta
        const teamToUpdate = teams.splice(originalTeamIndex, 1)[0];

        if (newGroupName) {
            if (originalGroupName === newGroupName) {
                newOrder = originalTeam.order ?? null;
            } else {
                const teamsInTargetGroup = teams.filter(t => t.groupName === newGroupName);
                const maxOrder = teamsInTargetGroup.reduce((max, t) => Math.max(max, t.order || 0), 0);
                newOrder = maxOrder + 1;
            }
        
            if (order !== undefined && order !== null && !isNaN(order)) {
                newOrder = parseInt(order, 10);
            }
        } else {
            newOrder = null;
        }
        
        const updatedTeam = {
            ...teamToUpdate,
            teamName: finalTeamName,
            groupName: newGroupName,
            order: newOrder
        };        

        teams.push(updatedTeam);
        
        await setDoc(superstructureDocRef, {
            ...globalTeamsData,
            [originalTeam.category]: teams
        }, { merge: true });

        setNotification({
            id: Date.now(),
            message: `Tím ${finalTeamName} bol aktualizovaný`,
            type: 'success'
        });
    } catch (err) {
        console.error("Chyba pri update:", err);
        setNotification({ id: Date.now(), message: "Chyba pri aktualizácii tímu", type: 'error' });
    }
};

// --- KOMPONENTY ---

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
                const categoryId = Object.keys(categoryIdToNameMap).find(id => categoryIdToNameMap[id] === teamToEdit.category) || '';
                setSelectedCategory(categoryId);
                const teamNameWithoutPrefix = teamToEdit.teamName.replace(new RegExp(`^${teamToEdit.category} `), '');
                setTeamName(teamNameWithoutPrefix);
                setSelectedGroup(teamToEdit.groupName || '');
                setOriginalTeamName(teamToEdit.teamName);
            } else {
                setSelectedCategory(defaultCategoryId || '');
                setSelectedGroup(defaultGroupName || '');
                setTeamName('');
                setOriginalTeamName('');
            }
        } else {
             setSelectedCategory('');
             setSelectedGroup('');
             setTeamName('');
             setIsDuplicate(false);
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
            groupName: selectedGroup,
            teamName: teamName,
            order: orderInputValue,
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
   
    const buttonText = teamToEdit ? 'Potvrdiť a Aktualizovať Tím' : 'Potvrdiť a Uložiť Tím';
    const buttonBaseClasses = 'px-4 py-2 rounded-lg transition-colors duration-200';
    const activeClasses = 'bg-indigo-600 text-white hover:bg-indigo-700';
    const disabledClasses = 'bg-white text-indigo-600 border border-indigo-600 shadow-none cursor-not-allowed';

    return React.createElement(
        'div',
        {
            className: 'fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[100]',
            onClick: onClose
        },
        React.createElement(
            'div',
            {
                className: 'bg-white p-8 rounded-xl shadow-2xl w-full max-w-lg transition-all transform scale-100',
                onClick: (e) => e.stopPropagation()
            },
            React.createElement('h2', { className: 'text-2xl font-bold text-gray-800 mb-2' }, teamToEdit ? 'Upraviť tím' : 'Pridať nový tím'),
            React.createElement('div', { className: 'text-xl font-semibold text-indigo-700 mb-6' }, teamToEdit ? teamToEdit.teamName : 'Nový tím'),
    
            React.createElement(
                'form',
                { onSubmit: handleSubmit, className: 'space-y-6' },
                // 1. Kategória
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
                    )
                ),
                // 2. Skupina
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
                    )
                ),
                // 3. Poradové číslo (FIX: Správne uzatvorenie elementov)
                selectedGroup ? React.createElement(
                    'div',
                    { className: 'flex flex-col' },
                    React.createElement('label', { className: 'text-sm font-medium text-gray-700 mb-1' }, 'Poradové číslo v skupine:'),
                    React.createElement(
                        'input',
                        {
                            type: 'number',
                            min: '1',
                            className: 'p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 w-32',
                            value: orderInputValue ?? '',
                            onChange: (e) => {
                                const val = e.target.value;
                                setOrderInputValue(val === '' ? null : parseInt(val, 10));
                            },
                            placeholder: 'napr. 5'
                        }
                    ),
                    React.createElement('p', { className: 'text-xs text-gray-500 mt-1' }, 'Číslo určuje poradie v skupine. Prázdne = na koniec.')
                ) : null,
    
                // Tlačidlá
                React.createElement(
                    'div',
                    { className: 'pt-6 flex justify-end space-x-4' },
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            className: 'px-5 py-2.5 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors',
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

const AddGroupsApp = (props) => {
    const { useState, useEffect } = React;
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
      
    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [notification]);
   
    const closeModal = () => {
        setIsModalOpen(false);
        setTeamToEdit(null);
    };
   
    const openAddModal = () => {
        setTeamToEdit(null);
        setIsModalOpen(true);
    };
   
    const unifiedSaveHandler = async (data) => {
        const params = { ...data, categoryIdToNameMap, setNotification };
        if (data.isEdit) {
            if (data.originalTeam.isSuperstructureTeam) {
                await handleUpdateTeam(params);
            } else {
                await handleUpdateUserTeam(params);
            }
        } else {
            await handleAddNewTeam(params);
        }
        closeModal();
    };

    const handleUpdateUserTeam = async ({ categoryId, groupName, teamName, order, originalTeam }) => {
        if (!window.db || !originalTeam?.uid) return;
        const categoryName = categoryIdToNameMap[categoryId];
        const newGroupName = groupName || null;
        const finalTeamName = `${categoryName} ${teamName.trim() || ''}`;
    
        try {
            const userRef = doc(window.db, 'users', originalTeam.uid);
            const userSnap = await getDoc(userRef);
            if (!userSnap.exists()) return;
    
            const userData = userSnap.data();
            let teamsInCategory = [...(userData.teams?.[categoryName] || [])];
            const teamIndex = teamsInCategory.findIndex(t => t.id === originalTeam.id);
            if (teamIndex === -1) return;
    
            let newOrder = (order !== undefined && order !== null && !isNaN(order)) ? parseInt(order, 10) : (originalTeam.order ?? null);
            const teamToUpdate = teamsInCategory.splice(teamIndex, 1)[0];
            const updatedTeam = { ...teamToUpdate, teamName: finalTeamName, groupName: newGroupName, order: newOrder };
    
            if (originalTeam.groupName === newGroupName) {
                teamsInCategory.splice(teamIndex, 0, updatedTeam);
            } else {
                teamsInCategory.push(updatedTeam);
            }
    
            await updateDoc(userRef, { [`teams.${categoryName}`]: teamsInCategory });
            setNotification({ id: Date.now(), message: `Tím ${finalTeamName} aktualizovaný.`, type: 'success' });
        } catch (err) {
            console.error(err);
            setNotification({ id: Date.now(), message: "Chyba pri aktualizácii.", type: 'error' });
        }
    };
            
    const slugifyName = (name) => name ? name.replace(/ /g, '-') : '';
    const deslugifyName = (slug) => slug ? slug.replace(/-/g, ' ') : '';

    const mapSuperstructureTeams = (globalTeams) => {
        let list = [];
        Object.entries(globalTeams).forEach(([cat, teams]) => {
            if (Array.isArray(teams)) {
                teams.forEach(t => {
                    list.push({
                        uid: 'global',
                        category: cat,
                        id: t.id || crypto.randomUUID(),
                        teamName: t.teamName,
                        groupName: t.groupName || null,
                        order: (t.groupName && t.groupName.trim() !== '') ? (t.order ?? 0) : null,
                        isSuperstructureTeam: true
                    });
                });
            }
        });
        return list;
    };
   
    useEffect(() => {
        if (!window.db) return;
        const unsubscribeUsers = onSnapshot(collection(window.db, 'users'), (snap) => {
            let list = [];
            snap.forEach(doc => {
                const data = doc.data();
                if (data.teams) {
                    Object.entries(data.teams).forEach(([cat, teams]) => {
                        if (Array.isArray(teams)) {
                            teams.forEach(t => {
                                list.push({
                                    uid: doc.id,
                                    category: cat,
                                    id: t.id || `${doc.id}-${t.teamName}`,
                                    teamName: t.teamName,
                                    groupName: t.groupName || null,
                                    order: (t.groupName && t.groupName.trim() !== '') ? (t.order ?? 0) : null,
                                    isSuperstructureTeam: false
                                });
                            });
                        }
                    });
                }
            });
            setUserTeamsData(list);
        });

        const unsubscribeSuper = onSnapshot(doc(window.db, ...SUPERSTRUCTURE_TEAMS_DOC_PATH.split('/')), (snap) => {
            setSuperstructureTeams(snap.exists() ? snap.data() : {});
        });
       
        const unsubscribeCats = onSnapshot(doc(window.db, 'settings', 'categories'), (snap) => {
            const map = {};
            if (snap.exists()) {
                Object.entries(snap.data()).forEach(([id, obj]) => { if (obj.name) map[id] = obj.name; });
            }
            setCategoryIdToNameMap(map);
        });

        const unsubscribeGroups = onSnapshot(doc(window.db, 'settings', 'groups'), (snap) => {
            const map = {};
            if (snap.exists()) {
                Object.entries(snap.data()).forEach(([id, arr]) => { if (Array.isArray(arr)) map[id] = arr.map(g => ({ name: g.name, type: g.type })); });
            }
            setAllGroupsByCategoryId(map);
        });

        return () => { unsubscribeUsers(); unsubscribeSuper(); unsubscribeCats(); unsubscribeGroups(); };
    }, []);

    useEffect(() => {
        setAllTeams([...userTeamsData, ...mapSuperstructureTeams(superstructureTeams)]);
    }, [userTeamsData, superstructureTeams]);

    const categoryNameToIdMap = React.useMemo(() => 
        Object.entries(categoryIdToNameMap).reduce((acc, [id, name]) => ({ ...acc, [name]: id }), {}), 
    [categoryIdToNameMap]);
   
    useEffect(() => {
        const hash = window.location.hash.substring(1);
        if (hash) {
            const [catSlug, groupSlug] = hash.split('/');
            const catName = deslugifyName(decodeURIComponent(catSlug));
            const groupName = groupSlug ? deslugifyName(decodeURIComponent(groupSlug)) : '';
            setSelectedCategoryId(categoryNameToIdMap[catName] || '');
            setSelectedGroupName(groupName);
        }
        setIsInitialHashReadComplete(true);
    }, [categoryNameToIdMap]);

    useEffect(() => {
        if (!isInitialHashReadComplete) return;
        const name = categoryIdToNameMap[selectedCategoryId];
        let hash = name ? encodeURIComponent(slugifyName(name)) : '';
        if (hash && selectedGroupName) hash += `/${encodeURIComponent(slugifyName(selectedGroupName))}`;
        if (window.location.hash !== `#${hash}`) window.location.replace(`#${hash}`);
    }, [selectedCategoryId, selectedGroupName, categoryIdToNameMap, isInitialHashReadComplete]);

    const handleAddNewTeam = async ({ categoryId, groupName, teamName, order }) => {
        const categoryName = categoryIdToNameMap[categoryId];
        const docRef = doc(window.db, ...SUPERSTRUCTURE_TEAMS_DOC_PATH.split('/'));
        const finalName = `${categoryName} ${teamName}`;
        try {
            const snap = await getDoc(docRef);
            const data = snap.exists() ? snap.data() : {};
            const current = data[categoryName] || [];
            const newOrder = order != null ? parseInt(order, 10) : (groupName ? (current.filter(t => t.groupName === groupName).reduce((m, t) => Math.max(m, t.order || 0), 0) + 1) : null);
            const updated = [...current, { teamName: finalName, groupName: groupName || null, order: newOrder, id: crypto.randomUUID() }];
            await setDoc(docRef, { ...data, [categoryName]: updated }, { merge: true });
            setNotification({ id: Date.now(), message: "Tím pridaný.", type: 'success' });
        } catch (e) { console.error(e); }
    };

    const teamsWithoutGroup = selectedCategoryId
        ? allTeams.filter(t => t.category === categoryIdToNameMap[selectedCategoryId] && !t.groupName).sort((a, b) => a.teamName.localeCompare(b.teamName))
        : allTeams.filter(t => !t.groupName).sort((a, b) => a.teamName.localeCompare(b.teamName));

    const renderTeamList = (teams, isWithoutGroup = false) => {
        const sorted = [...teams].sort((a, b) => (!isWithoutGroup && a.order != null && b.order != null) ? a.order - b.order : a.teamName.localeCompare(b.teamName));
        return React.createElement('ul', { className: 'space-y-2' }, sorted.map((team, idx) => 
            React.createElement('li', { key: team.id || idx, className: `flex justify-between items-center px-4 py-3 rounded-lg border ${team.isSuperstructureTeam ? 'bg-yellow-50' : 'bg-white'}` },
                React.createElement('span', null, team.order != null && !isWithoutGroup ? `${team.order}. ${team.teamName}` : team.teamName),
                React.createElement('button', { onClick: () => { setTeamToEdit(team); setIsModalOpen(true); }, className: 'text-gray-500 hover:text-indigo-600' }, '✎')
            )
        ));
    };

    return React.createElement('div', { className: 'p-4' },
        notification && React.createElement('div', { className: `fixed top-4 left-1/2 -translate-x-1/2 p-4 rounded bg-gray-800 text-white z-[200]` }, notification.message),
        React.createElement(NewTeamModal, { isOpen: isModalOpen, onClose: closeModal, allGroupsByCategoryId, categoryIdToNameMap, unifiedSaveHandler, teamToEdit, allTeams, defaultCategoryId: selectedCategoryId, defaultGroupName: selectedGroupName }),
        React.createElement('div', { className: 'max-w-xs mx-auto mb-8 space-y-4' },
            React.createElement('select', { className: 'w-full p-2 border rounded', value: selectedCategoryId, onChange: (e) => setSelectedCategoryId(e.target.value) },
                React.createElement('option', { value: '' }, 'Všetky kategórie'),
                Object.entries(categoryIdToNameMap).map(([id, name]) => React.createElement('option', { key: id, value: id }, name))
            ),
            React.createElement('select', { className: 'w-full p-2 border rounded', value: selectedGroupName, onChange: (e) => setSelectedGroupName(e.target.value), disabled: !selectedCategoryId },
                React.createElement('option', { value: '' }, 'Všetky skupiny'),
                (allGroupsByCategoryId[selectedCategoryId] || []).map((g, i) => React.createElement('option', { key: i, value: g.name }, g.name))
            )
        ),
        React.createElement('div', { className: 'flex flex-wrap gap-4' },
            React.createElement('div', { className: 'w-64 p-4 bg-white shadow rounded' }, React.createElement('h3', null, 'Bez skupiny'), renderTeamList(teamsWithoutGroup, true)),
            Object.entries(allGroupsByCategoryId).filter(([id]) => !selectedCategoryId || id === selectedCategoryId).map(([id, groups]) => 
                groups.filter(g => !selectedGroupName || g.name === selectedGroupName).map((g, i) => 
                    React.createElement('div', { key: `${id}-${i}`, className: 'w-64 p-4 bg-blue-50 shadow rounded' },
                        React.createElement('h3', null, g.name),
                        renderTeamList(allTeams.filter(t => t.category === categoryIdToNameMap[id] && t.groupName === g.name))
                    )
                )
            )
        ),
        React.createElement('button', { className: 'fixed bottom-8 right-8 bg-green-500 text-white p-4 rounded-full text-2xl shadow-xl', onClick: openAddModal }, '+')
    );
};

// Inicializácia
const handleDataUpdateAndRender = (event) => {
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(AddGroupsApp, { userProfileData: event.detail }));
};
window.addEventListener('globalDataUpdated', handleDataUpdateAndRender);
if (window.globalUserProfileData) handleDataUpdateAndRender({ detail: window.globalUserProfileData });
