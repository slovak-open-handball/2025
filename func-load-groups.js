// volanie názvu tímu v konzole podla ID
// teamManager.getTeamNameByDisplayIdSync("U10 CH A1")
(function() {
    async function loadFirebaseModules() {
        try {
            const module = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");
            return {
                doc: module.doc,
                onSnapshot: module.onSnapshot,
                collection: module.collection,
                query: module.query,
                getDocs: module.getDocs,
                getDoc: module.getDoc
            };
        } catch (error) {
            return null;
        }
    }
    const SUPERSTRUCTURE_TEAMS_DOC_PATH = 'settings/superstructureGroups';
    const teamManagerListeners = new Set();
    function subscribeToTeams(callback) {
        teamManagerListeners.add(callback);        
        if (window.__teamManagerData) {
            setTimeout(() => {
                try {
                    callback(window.__teamManagerData);
                } catch (error) {
                }
            }, 0);
        }
        
        return () => teamManagerListeners.delete(callback);
    }
    function cleanGroupName(groupName) {
        if (!groupName) return 'bez skupiny';        
        return groupName.replace(/^skupina\s+/i, '');
    }
    function createTeamDisplayId(team) {
        const kategoria = team.category || '';
        const skupina = team.groupName ? cleanGroupName(team.groupName) : '';
        const poradie = team.order !== null && team.order !== undefined ? team.order : '';        
        return `${kategoria} ${skupina}${poradie}`.trim();
    }
    function printTeamsInFormat(teams) {        
        const sortedTeams = [...teams].sort((a, b) => {
            if (a.category !== b.category) return a.category.localeCompare(b.category);            
            const groupA = a.groupName ? cleanGroupName(a.groupName) : '';
            const groupB = b.groupName ? cleanGroupName(b.groupName) : '';
            if (groupA !== groupB) return groupA.localeCompare(groupB);            
            return (a.order || 999) - (b.order || 999);
        });
        sortedTeams.forEach(team => {
            const displayId = createTeamDisplayId(team);
            const nazov = team.teamName || 'neznámy názov';            
        });        
    }
    function notifyListeners(data) {
        window.__teamManagerData = data; 
        if (data.type === 'update' || data.type === 'initialLoad') {            
            printTeamsInFormat(data.allTeams);
        }        
        if (data.type === 'groupsUpdate' || data.type === 'initialLoad') {
            const cleanedGroups = {};
            Object.entries(data.groupsByCategoryId || {}).forEach(([catId, groups]) => {
                cleanedGroups[catId] = groups.map(g => ({
                    ...g,
                    cleanName: cleanGroupName(g.name)
                }));
            });            
            const totalGroups = Object.values(data.groupsByCategoryId || {})
                .reduce((sum, arr) => sum + arr.length, 0);
        }        
        teamManagerListeners.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
            }
        });        
        const event = new CustomEvent('teamManagerUpdate', { 
            detail: data 
        });
        window.dispatchEvent(event);
    }
    async function initializeTeamManager() {        
        if (!window.db) {            
            for (let i = 0; i < 50; i++) {
                await new Promise(resolve => setTimeout(resolve, 100));
                if (window.db) {
                    break;
                }
            }            
            if (!window.db) {
                return;
            }
        }
        const firebase = await loadFirebaseModules();
        if (!firebase) {
            return;
        }        
        const { doc, onSnapshot, collection, query, getDocs, getDoc } = firebase;
        let allTeams = [];
        let userTeams = [];
        let superstructureTeams = {};
        let categoryIdToNameMap = {};
        let groupsByCategoryId = {};
        const flattenSuperstructureTeams = (superstructureData) => {
            const result = [];            
            Object.entries(superstructureData || {}).forEach(([categoryName, teamArray]) => {
                (teamArray || []).forEach(team => {
                    result.push({
                        uid: 'global',
                        category: categoryName,
                        id: team.id,
                        teamName: team.teamName,
                        groupName: team.groupName || null,
                        order: team.groupName ? (team.order ?? 0) : null,
                        isSuperstructureTeam: true, 
                        source: 'superstructure'
                    });
                });
            });            
            return result;
        };
        const unsubscribeUsers = onSnapshot(
            query(collection(window.db, 'users')),
            (querySnapshot) => {
                const newUserTeams = [];
                querySnapshot.forEach((doc) => {
                    const userData = doc.data();
                    if (userData?.teams) {
                        Object.entries(userData.teams).forEach(([categoryName, teamArray]) => {
                            if (Array.isArray(teamArray)) {
                                teamArray.forEach(team => {
                                    if (team.teamName) {
                                        newUserTeams.push({
                                            uid: doc.id, 
                                            category: categoryName,
                                            id: team.id,
                                            teamName: team.teamName,
                                            groupName: team.groupName || null,
                                            order: team.groupName ? (team.order ?? 0) : null,
                                            isSuperstructureTeam: false,
                                            source: 'users' 
                                        });
                                    }
                                });
                            }
                        });
                    }
                });
                userTeams = newUserTeams;
                allTeams = [...userTeams, ...flattenSuperstructureTeams(superstructureTeams)];                
                notifyListeners({
                    type: 'update',
                    allTeams,
                    userTeams,
                    superstructureTeams,
                    categoryIdToNameMap,
                    groupsByCategoryId,
                    timestamp: new Date().toISOString()
                });                
            },
            (error) => {
            }
        );
        const unsubscribeSuperstructure = onSnapshot(
            doc(window.db, ...SUPERSTRUCTURE_TEAMS_DOC_PATH.split('/')),
            (docSnap) => {
                superstructureTeams = docSnap.exists() ? docSnap.data() : {};
                allTeams = [...userTeams, ...flattenSuperstructureTeams(superstructureTeams)];                
                notifyListeners({
                    type: 'update',
                    allTeams,
                    userTeams,
                    superstructureTeams,
                    categoryIdToNameMap,
                    groupsByCategoryId,
                    timestamp: new Date().toISOString()
                });                
                const totalSuperTeams = flattenSuperstructureTeams(superstructureTeams).length;
            },
            (error) => {
            }
        );
        const unsubscribeCategories = onSnapshot(
            doc(window.db, 'settings', 'categories'),
            (docSnap) => {
                const newMap = {};                
                if (docSnap.exists()) {
                    const categoryData = docSnap.data();
                    Object.entries(categoryData).forEach(([categoryId, categoryObject]) => {
                        if (categoryObject?.name) {
                            newMap[categoryId] = categoryObject.name;
                        }
                    });
                }                
                categoryIdToNameMap = newMap;                
                notifyListeners({
                    type: 'categoriesUpdate',
                    categoryIdToNameMap,
                    groupsByCategoryId,
                    timestamp: new Date().toISOString()
                });                
            },
            (error) => {
            }
        );
        const unsubscribeGroups = onSnapshot(
            doc(window.db, 'settings', 'groups'),
            (docSnap) => {
                const newGroups = {};                
                if (docSnap.exists()) {
                    const groupData = docSnap.data();
                    Object.entries(groupData).forEach(([categoryId, groupArray]) => {
                        if (Array.isArray(groupArray)) {
                            newGroups[categoryId] = groupArray.map(group => ({
                                name: group.name,
                                type: group.type
                            }));
                        }
                    });
                }                
                groupsByCategoryId = newGroups;                
                notifyListeners({
                    type: 'groupsUpdate',
                    groupsByCategoryId,
                    categoryIdToNameMap,
                    timestamp: new Date().toISOString()
                });                
                const totalGroups = Object.values(newGroups).reduce((sum, arr) => sum + arr.length, 0);
            },
            (error) => {
            }
        );
        try {
            const initialData = await loadAllTeamsOnce(getDoc, getDocs, collection, doc);            
            notifyListeners({
                type: 'initialLoad',
                ...initialData,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
        }
        window.__teamManagerCleanup = () => {
            unsubscribeUsers();
            unsubscribeSuperstructure();
            unsubscribeCategories();
            unsubscribeGroups();
            teamManagerListeners.clear();
        };        
        return window.__teamManagerCleanup;
    }
    async function loadAllTeamsOnce(getDoc, getDocs, collection, doc) {        
        if (!window.db) {
            throw new Error("[TeamManager] Firestore nie je inicializovaný!");
        }
        const usersSnapshot = await getDocs(collection(window.db, 'users'));
        const userTeams = [];        
        usersSnapshot.forEach((doc) => {
            const userData = doc.data();
            if (userData?.teams) {
                Object.entries(userData.teams).forEach(([categoryName, teamArray]) => {
                    if (Array.isArray(teamArray)) {
                        teamArray.forEach(team => {
                            if (team.teamName) {
                                userTeams.push({
                                    uid: doc.id,
                                    category: categoryName,
                                    id: team.id,
                                    teamName: team.teamName,
                                    groupName: team.groupName || null,
                                    order: team.groupName ? (team.order ?? 0) : null,
                                    isSuperstructureTeam: false,
                                    source: 'users'
                                });
                            }
                        });
                    }
                });
            }
        });
        const superstructureDoc = await getDoc(doc(window.db, ...SUPERSTRUCTURE_TEAMS_DOC_PATH.split('/')));
        const superstructureData = superstructureDoc.exists() ? superstructureDoc.data() : {};
        const superstructureTeams = flattenSuperstructureTeamsGlobal(superstructureData);
        const categoriesDoc = await getDoc(doc(window.db, 'settings', 'categories'));
        const categoryIdToName = {};
        if (categoriesDoc.exists()) {
            const categoryData = categoriesDoc.data();
            Object.entries(categoryData).forEach(([categoryId, categoryObject]) => {
                if (categoryObject?.name) {
                    categoryIdToName[categoryId] = categoryObject.name;
                }
            });
        }
        const groupsDoc = await getDoc(doc(window.db, 'settings', 'groups'));
        const groupsByCategoryId = {};
        if (groupsDoc.exists()) {
            const groupData = groupsDoc.data();
            Object.entries(groupData).forEach(([categoryId, groupArray]) => {
                if (Array.isArray(groupArray)) {
                    groupsByCategoryId[categoryId] = groupArray.map(group => ({
                        name: group.name,
                        type: group.type
                    }));
                }
            });
        }
        const allTeams = [...userTeams, ...superstructureTeams];
        return {
            allTeams,
            userTeams,
            superstructureTeams,
            categoryIdToNameMap: categoryIdToName,
            groupsByCategoryId
        };
    }
    function flattenSuperstructureTeamsGlobal(superstructureData) {
        const result = [];        
        Object.entries(superstructureData || {}).forEach(([categoryName, teamArray]) => {
            (teamArray || []).forEach(team => {
                result.push({
                    uid: 'global',
                    category: categoryName,
                    id: team.id,
                    teamName: team.teamName,
                    groupName: team.groupName || null,
                    order: team.groupName ? (team.order ?? 0) : null,
                    isSuperstructureTeam: true,
                    source: 'superstructure'
                });
            });
        });        
        return result;
    }
    async function getAllTeams() {
        const firebase = await loadFirebaseModules();
        if (!firebase) return [];
        
        const { getDoc, getDocs, collection, doc } = firebase;
        const data = await loadAllTeamsOnce(getDoc, getDocs, collection, doc);
        return data.allTeams;
    }
    async function getTeamsByCategory(categoryName) {
        const allTeams = await getAllTeams();
        return allTeams.filter(team => team.category === categoryName);
    }
    async function getTeamsByGroup(categoryName, groupName) {
        const allTeams = await getAllTeams();
        return allTeams.filter(team => 
            team.category === categoryName && team.groupName === groupName
        );
    }
    async function getCategoryMap() {
        const firebase = await loadFirebaseModules();
        if (!firebase) return {};        
        const { getDoc, doc } = firebase;
        const categoriesDoc = await getDoc(doc(window.db, 'settings', 'categories'));
        const categoryIdToName = {};        
        if (categoriesDoc.exists()) {
            const categoryData = categoriesDoc.data();
            Object.entries(categoryData).forEach(([categoryId, categoryObject]) => {
                if (categoryObject?.name) {
                    categoryIdToName[categoryId] = categoryObject.name;
                }
            });
        }        
        return categoryIdToName;
    }
    async function getGroupsByCategory(categoryId) {
        const firebase = await loadFirebaseModules();
        if (!firebase) return [];        
        const { getDoc, doc } = firebase;
        const groupsDoc = await getDoc(doc(window.db, 'settings', 'groups'));        
        if (groupsDoc.exists()) {
            const groupData = groupsDoc.data();
            if (groupData[categoryId]) {
                return groupData[categoryId].map(group => ({
                    name: group.name,
                    type: group.type
                }));
            }
        }        
        return [];
    }
    function getCleanGroupName(groupName) {
        return cleanGroupName(groupName);
    }
    async function getTeamNameById(teamId) {
        if (!teamId) return null;        
        const allTeams = await getAllTeams();
        const team = allTeams.find(t => t.id === teamId);        
        return team ? team.teamName : null;
    }
    function getTeamNameByIdSync(teamId) {
        if (!teamId || !window.__teamManagerData?.allTeams) return null;
        
        const team = window.__teamManagerData.allTeams.find(t => t.id === teamId);
        return team ? team.teamName : null;
    }
    async function getTeamNameByDisplayId(displayId) {
        if (!displayId) return null;        
        const allTeams = await getAllTeams();        
        const team = allTeams.find(team => {
            const teamDisplayId = createTeamDisplayId(team);
            return teamDisplayId === displayId;
        });        
        return team ? team.teamName : null;
    }
    function getTeamNameByDisplayIdSync(displayId) {
        if (!displayId || !window.__teamManagerData?.allTeams) return null;        
        const team = window.__teamManagerData.allTeams.find(team => {
            const teamDisplayId = createTeamDisplayId(team);
            return teamDisplayId === displayId;
        });        
        return team ? team.teamName : null;
    }
    async function getTeamByDisplayId(displayId) {
        if (!displayId) return null;        
        const allTeams = await getAllTeams();        
        const team = allTeams.find(team => {
            const teamDisplayId = createTeamDisplayId(team);
            return teamDisplayId === displayId;
        });        
        return team || null;
    }
    function getTeamByDisplayIdSync(displayId) {
        if (!displayId || !window.__teamManagerData?.allTeams) return null;        
        const team = window.__teamManagerData.allTeams.find(team => {
            const teamDisplayId = createTeamDisplayId(team);
            return teamDisplayId === displayId;
        });        
        return team || null;
    }
    window.teamManager = {
        initialize: initializeTeamManager,
        subscribe: subscribeToTeams,
        getAllTeams,
        getTeamsByCategory,
        getTeamsByGroup,
        getCategoryMap,
        getGroupsByCategory,
        cleanGroupName: getCleanGroupName,
        getTeamNameById,
        getTeamNameByIdSync,
        getTeamNameByDisplayId,
        getTeamNameByDisplayIdSync,
        getTeamByDisplayId,
        getTeamByDisplayIdSync 
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initializeTeamManager();
        });
    } else {
        setTimeout(() => initializeTeamManager(), 100);
    }
})();
