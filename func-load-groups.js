// volanie názvu tímu v konzole podla ID
// teamManager.getTeamNameByDisplayIdSync("U10 D 1A")


// ============================================================
// func-load-groups.js - Tímový manažér (globálna verzia)
// ============================================================
// Tento skript sa načíta cez <script src="func-load-groups.js"></script>
// a poskytuje globálny objekt window.teamManager so všetkými funkciami
// ============================================================

(function() {
    // ============================================================
    // Import Firebase funkcií (dynamic import)
    // ============================================================
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
//            console.error("[TeamManager] Chyba pri načítaní Firebase modulov:", error);
            return null;
        }
    }

    // ============================================================
    // Konštanty pre cesty v databáze
    // ============================================================
    const SUPERSTRUCTURE_TEAMS_DOC_PATH = 'settings/superstructureGroups';

    // ============================================================
    // Event systém pre odosielanie dát ostatným častiam aplikácie
    // ============================================================
    const teamManagerListeners = new Set();

    /**
     * Prihlásenie na odber zmien v tímoch
     * @param {Function} callback - Funkcia, ktorá sa zavolá pri každej zmene dát
     * @returns {Function} - Funkcia na odhlásenie odberu
     */
    function subscribeToTeams(callback) {
        teamManagerListeners.add(callback);
        
        // Ak už máme dáta, pošleme ich hneď
        if (window.__teamManagerData) {
            setTimeout(() => {
                try {
                    callback(window.__teamManagerData);
                } catch (error) {
//                    console.error("[TeamManager] Chyba pri volaní listenera:", error);
                }
            }, 0);
        }
        
        return () => teamManagerListeners.delete(callback);
    }

    /**
     * Odstráni text "skupina " z názvu skupiny (ak existuje)
     */
    function cleanGroupName(groupName) {
        if (!groupName) return 'bez skupiny';
        
        // Odstráni "skupina " z názvu (case insensitive)
        return groupName.replace(/^skupina\s+/i, '');
    }

    /**
     * Vytvorí zobrazené ID tímu v rovnakom formáte ako v konzole
     * @param {Object} team - Tímový objekt
     * @returns {string} - Zobrazené ID (napr. "U12 CH A1")
     */
    function createTeamDisplayId(team) {
        const kategoria = team.category || '';
        const skupina = team.groupName ? cleanGroupName(team.groupName) : '';
        const poradie = team.order !== null && team.order !== undefined ? team.order : '';
        
        return `${kategoria} ${skupina}${poradie}`.trim();
    }

    /**
     * Vypíše tímy v požadovanom formáte: kategória skupina poradie názov
     */
    function printTeamsInFormat(teams) {
//        console.log('=== TÍMY PODĽA KATEGÓRIÍ A SKUPÍN ===');
        
        // Zoradenie podľa kategórie, skupiny a poradia
        const sortedTeams = [...teams].sort((a, b) => {
            if (a.category !== b.category) return a.category.localeCompare(b.category);
            
            const groupA = a.groupName ? cleanGroupName(a.groupName) : '';
            const groupB = b.groupName ? cleanGroupName(b.groupName) : '';
            if (groupA !== groupB) return groupA.localeCompare(groupB);
            
            return (a.order || 999) - (b.order || 999);
        });
        
        // Výpis v požadovanom formáte
        sortedTeams.forEach(team => {
            const displayId = createTeamDisplayId(team);
            const nazov = team.teamName || 'neznámy názov';
            
            console.log(`${displayId} ${nazov}`);
        });
        
//        console.log(`Celkový počet tímov: ${teams.length}`);
//        console.log('=======================================');
    }

    /**
     * Interná funkcia na odoslanie dát všetkým prihláseným odberateľom
     */
    function notifyListeners(data) {
        // Uložíme dáta pre prípad, že by sa niekto prihlásil neskôr
        window.__teamManagerData = data;
        
        // Vypíšeme základné informácie
//        console.log('=== TÍMOVÝ MANAŽÉR - AKTUALIZÁCIA DÁT ===');
//        console.log('Čas:', new Date().toLocaleTimeString());
//        console.log('Typ udalosti:', data.type);
        
        if (data.type === 'update' || data.type === 'initialLoad') {
//            console.log('Počet všetkých tímov:', data.allTeams.length);
//            console.log('Počet používateľských tímov:', data.userTeams.length);
//            console.log('Počet nadstavbových tímov:', 
//                Object.values(data.superstructureTeams).reduce((sum, arr) => sum + arr.length, 0));
            
            // Výpis v požadovanom formáte
            printTeamsInFormat(data.allTeams);
        }
        
        if (data.type === 'categoriesUpdate' || data.type === 'initialLoad') {
//            console.log('Kategórie (ID -> názov):', data.categoryIdToNameMap);
//            console.log('Počet kategórií:', Object.keys(data.categoryIdToNameMap || {}).length);
        }
        
        if (data.type === 'groupsUpdate' || data.type === 'initialLoad') {
            // Vyčistené názvy skupín pre výpis
            const cleanedGroups = {};
            Object.entries(data.groupsByCategoryId || {}).forEach(([catId, groups]) => {
                cleanedGroups[catId] = groups.map(g => ({
                    ...g,
                    cleanName: cleanGroupName(g.name)
                }));
            });
//            console.log('Skupiny podľa kategórií (s vyčistenými názvami):', cleanedGroups);
            
            const totalGroups = Object.values(data.groupsByCategoryId || {})
                .reduce((sum, arr) => sum + arr.length, 0);
//            console.log('Počet skupín:', totalGroups);
        }
        
        // Notifikujeme všetkých listenerov
        teamManagerListeners.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
//                console.error("[TeamManager] Chyba pri volaní listenera:", error);
            }
        });
        
        // Vytvoríme a spustíme custom event pre ostatné JS kódy
        const event = new CustomEvent('teamManagerUpdate', { 
            detail: data 
        });
        window.dispatchEvent(event);
    }

    // ============================================================
    // Hlavná funkcia - inicializácia načúvania na zmeny v databáze
    // ============================================================
    async function initializeTeamManager() {
//        console.log("[TeamManager] Inicializácia...");
        
        if (!window.db) {
//            console.error("[TeamManager] Firestore nie je inicializovaný! Čakám na window.db...");
            
            // Počkáme na window.db (max 5 sekúnd)
            for (let i = 0; i < 50; i++) {
                await new Promise(resolve => setTimeout(resolve, 100));
                if (window.db) {
//                    console.log("[TeamManager] window.db nájdený, pokračujem...");
                    break;
                }
            }
            
            if (!window.db) {
//                console.error("[TeamManager] Firestore stále nie je inicializovaný! Končím.");
                return;
            }
        }

        // Načítanie Firebase modulov
        const firebase = await loadFirebaseModules();
        if (!firebase) {
//            console.error("[TeamManager] Nepodarilo sa načítať Firebase moduly!");
            return;
        }
        
        const { doc, onSnapshot, collection, query, getDocs, getDoc } = firebase;

        let allTeams = [];              // Všetky tímy dokopy
        let userTeams = [];              // Tímy používateľov
        let superstructureTeams = {};    // Nadstavbové tímy podľa kategórií
        let categoryIdToNameMap = {};    // Mapovanie ID -> názov kategórie
        let groupsByCategoryId = {};      // Skupiny podľa kategórií

        // ========================================================
        // Pomocná funkcia: rozbalenie nadstavbových tímov
        // ========================================================
        const flattenSuperstructureTeams = (superstructureData) => {
            const result = [];
            
            Object.entries(superstructureData || {}).forEach(([categoryName, teamArray]) => {
                (teamArray || []).forEach(team => {
                    result.push({
                        uid: 'global',                       // Špeciálny identifikátor
                        category: categoryName,               // Názov kategórie
                        id: team.id,                           // ID tímu
                        teamName: team.teamName,               // Celý názov tímu
                        groupName: team.groupName || null,     // Názov skupiny (alebo null)
                        order: team.groupName ? (team.order ?? 0) : null, // Poradie v skupine
                        isSuperstructureTeam: true,            // Flag pre typ tímu
                        source: 'superstructure'               // Zdroj dát
                    });
                });
            });
            
            return result;
        };

        // ========================================================
        // 1. Načúvanie na zmeny v používateľských tímoch
        // ========================================================
        const unsubscribeUsers = onSnapshot(
            query(collection(window.db, 'users')),
            (querySnapshot) => {
//                console.log("[TeamManager] Načítavam používateľské tímy...");
                const newUserTeams = [];

                querySnapshot.forEach((doc) => {
                    const userData = doc.data();
                    if (userData?.teams) {
                        Object.entries(userData.teams).forEach(([categoryName, teamArray]) => {
                            if (Array.isArray(teamArray)) {
                                teamArray.forEach(team => {
                                    if (team.teamName) {
                                        newUserTeams.push({
                                            uid: doc.id,                    // ID používateľa
                                            category: categoryName,         // Názov kategórie
                                            id: team.id,                     // ID tímu
                                            teamName: team.teamName,         // Celý názov tímu
                                            groupName: team.groupName || null, // Názov skupiny (alebo null)
                                            order: team.groupName ? (team.order ?? 0) : null, // Poradie v skupine
                                            isSuperstructureTeam: false,     // Flag pre typ tímu
                                            source: 'users'                  // Zdroj dát
                                        });
                                    }
                                });
                            }
                        });
                    }
                });

                userTeams = newUserTeams;
                allTeams = [...userTeams, ...flattenSuperstructureTeams(superstructureTeams)];
                
                // Odoslanie aktualizovaných dát
                notifyListeners({
                    type: 'update',
                    allTeams,
                    userTeams,
                    superstructureTeams,
                    categoryIdToNameMap,
                    groupsByCategoryId,
                    timestamp: new Date().toISOString()
                });
                
//                console.log(`[TeamManager] Načítaných ${userTeams.length} používateľských tímov`);
            },
            (error) => {
//                console.error("[TeamManager] Chyba pri načítaní používateľských tímov:", error);
            }
        );

        // ========================================================
        // 2. Načúvanie na zmeny v nadstavbových tímoch
        // ========================================================
        const unsubscribeSuperstructure = onSnapshot(
            doc(window.db, ...SUPERSTRUCTURE_TEAMS_DOC_PATH.split('/')),
            (docSnap) => {
//                console.log("[TeamManager] Načítavam nadstavbové tímy...");
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
//                console.log(`[TeamManager] Načítaných ${totalSuperTeams} nadstavbových tímov`);
            },
            (error) => {
//                console.error("[TeamManager] Chyba pri načítaní nadstavbových tímov:", error);
            }
        );

        // ========================================================
        // 3. Načúvanie na zmeny v kategóriách
        // ========================================================
        const unsubscribeCategories = onSnapshot(
            doc(window.db, 'settings', 'categories'),
            (docSnap) => {
//                console.log("[TeamManager] Načítavam kategórie...");
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
                
//                console.log(`[TeamManager] Načítaných ${Object.keys(newMap).length} kategórií`);
            },
            (error) => {
//                console.error("[TeamManager] Chyba pri načítaní kategórií:", error);
            }
        );

        // ========================================================
        // 4. Načúvanie na zmeny v skupinách
        // ========================================================
        const unsubscribeGroups = onSnapshot(
            doc(window.db, 'settings', 'groups'),
            (docSnap) => {
//                console.log("[TeamManager] Načítavam skupiny...");
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
//                console.log(`[TeamManager] Načítaných ${totalGroups} skupín`);
            },
            (error) => {
//                console.error("[TeamManager] Chyba pri načítaní skupín:", error);
            }
        );

        // ========================================================
        // 5. Jednorazové načítanie všetkých tímov (pre istotu)
        // ========================================================
        try {
            const initialData = await loadAllTeamsOnce(getDoc, getDocs, collection, doc);
//            console.log("[TeamManager] Počiatočné načítanie dokončené:", {
                totalTeams: initialData.allTeams.length,
                userTeams: initialData.userTeams.length,
                superstructureTeams: initialData.superstructureTeams.length
            });
            
            notifyListeners({
                type: 'initialLoad',
                ...initialData,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
//            console.error("[TeamManager] Chyba pri počiatočnom načítaní:", error);
        }

        // ========================================================
        // Návratová funkcia na odhlásenie všetkých listenerov
        // ========================================================
        window.__teamManagerCleanup = () => {
//            console.log("[TeamManager] Uzatváram všetky listenery...");
            unsubscribeUsers();
            unsubscribeSuperstructure();
            unsubscribeCategories();
            unsubscribeGroups();
            teamManagerListeners.clear();
        };
        
        return window.__teamManagerCleanup;
    }

    // ============================================================
    // Jednorazové načítanie všetkých tímov (pre počiatočné dáta)
    // ============================================================
    async function loadAllTeamsOnce(getDoc, getDocs, collection, doc) {
//        console.log("[TeamManager] Jednorazové načítanie všetkých tímov...");
        
        if (!window.db) {
            throw new Error("[TeamManager] Firestore nie je inicializovaný!");
        }

        // Načítanie používateľských tímov
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

        // Načítanie nadstavbových tímov
        const superstructureDoc = await getDoc(doc(window.db, ...SUPERSTRUCTURE_TEAMS_DOC_PATH.split('/')));
        const superstructureData = superstructureDoc.exists() ? superstructureDoc.data() : {};
        const superstructureTeams = flattenSuperstructureTeamsGlobal(superstructureData);

        // Načítanie kategórií
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

        // Načítanie skupín
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

//        console.log(`[TeamManager] Jednorazové načítanie dokončené: ${allTeams.length} tímov`);

        return {
            allTeams,
            userTeams,
            superstructureTeams,
            categoryIdToNameMap: categoryIdToName,
            groupsByCategoryId
        };
    }

    // ============================================================
    // Pomocná funkcia: rozbalenie nadstavbových tímov (globálna verzia)
    // ============================================================
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

    // ============================================================
    // Pomocné funkcie pre ostatné časti aplikácie
    // ============================================================

    /**
     * Získa všetky tímy (jednorazovo, nie listener)
     */
    async function getAllTeams() {
        const firebase = await loadFirebaseModules();
        if (!firebase) return [];
        
        const { getDoc, getDocs, collection, doc } = firebase;
        const data = await loadAllTeamsOnce(getDoc, getDocs, collection, doc);
        return data.allTeams;
    }

    /**
     * Získa tímy podľa kategórie
     */
    async function getTeamsByCategory(categoryName) {
        const allTeams = await getAllTeams();
        return allTeams.filter(team => team.category === categoryName);
    }

    /**
     * Získa tímy podľa skupiny
     */
    async function getTeamsByGroup(categoryName, groupName) {
        const allTeams = await getAllTeams();
        return allTeams.filter(team => 
            team.category === categoryName && team.groupName === groupName
        );
    }

    /**
     * Získa mapovanie ID kategórií na názvy
     */
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

    /**
     * Získa skupiny podľa kategórie
     */
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

    /**
     * Získa vyčistený názov skupiny (bez "skupina ")
     */
    function getCleanGroupName(groupName) {
        return cleanGroupName(groupName);
    }

    /**
     * Získa názov tímu podľa jeho interného ID
     * @param {string} teamId - Interné ID tímu
     * @returns {Promise<string|null>} - Názov tímu alebo null, ak sa nenašiel
     */
    async function getTeamNameById(teamId) {
        if (!teamId) return null;
        
        const allTeams = await getAllTeams();
        const team = allTeams.find(t => t.id === teamId);
        
        return team ? team.teamName : null;
    }

    /**
     * Získa názov tímu podľa jeho interného ID (synchronna verzia z cache)
     * @param {string} teamId - Interné ID tímu
     * @returns {string|null} - Názov tímu alebo null, ak sa nenašiel
     */
    function getTeamNameByIdSync(teamId) {
        if (!teamId || !window.__teamManagerData?.allTeams) return null;
        
        const team = window.__teamManagerData.allTeams.find(t => t.id === teamId);
        return team ? team.teamName : null;
    }

    /**
     * Získa názov tímu podľa zobrazeného ID (formát: "kategória skupinaporadie")
     * @param {string} displayId - Zobrazené ID tímu (napr. "U12 CH A1")
     * @returns {Promise<string|null>} - Názov tímu alebo null, ak sa nenašiel
     */
    async function getTeamNameByDisplayId(displayId) {
        if (!displayId) return null;
        
        const allTeams = await getAllTeams();
        
        // Prejdeme všetky tímy a vytvoríme pre každý zobrazené ID v rovnakom formáte
        const team = allTeams.find(team => {
            const teamDisplayId = createTeamDisplayId(team);
            return teamDisplayId === displayId;
        });
        
        return team ? team.teamName : null;
    }

    /**
     * Získa názov tímu podľa zobrazeného ID (synchrónna verzia z cache)
     * @param {string} displayId - Zobrazené ID tímu (napr. "U12 CH A1")
     * @returns {string|null} - Názov tímu alebo null, ak sa nenašiel
     */
    function getTeamNameByDisplayIdSync(displayId) {
        if (!displayId || !window.__teamManagerData?.allTeams) return null;
        
        const team = window.__teamManagerData.allTeams.find(team => {
            const teamDisplayId = createTeamDisplayId(team);
            return teamDisplayId === displayId;
        });
        
        return team ? team.teamName : null;
    }

    /**
     * Získa celý objekt tímu podľa zobrazeného ID
     * @param {string} displayId - Zobrazené ID tímu (napr. "U12 CH A1")
     * @returns {Promise<Object|null>} - Tímový objekt alebo null
     */
    async function getTeamByDisplayId(displayId) {
        if (!displayId) return null;
        
        const allTeams = await getAllTeams();
        
        const team = allTeams.find(team => {
            const teamDisplayId = createTeamDisplayId(team);
            return teamDisplayId === displayId;
        });
        
        return team || null;
    }

    /**
     * Získa celý objekt tímu podľa zobrazeného ID (synchrónna verzia)
     * @param {string} displayId - Zobrazené ID tímu (napr. "U12 CH A1")
     * @returns {Object|null} - Tímový objekt alebo null
     */
    function getTeamByDisplayIdSync(displayId) {
        if (!displayId || !window.__teamManagerData?.allTeams) return null;
        
        const team = window.__teamManagerData.allTeams.find(team => {
            const teamDisplayId = createTeamDisplayId(team);
            return teamDisplayId === displayId;
        });
        
        return team || null;
    }

    // ============================================================
    // Vytvorenie globálneho objektu
    // ============================================================
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
        getTeamNameByDisplayId,        // Nová funkcia podľa zobrazeného ID
        getTeamNameByDisplayIdSync,     // Nová funkcia podľa zobrazeného ID (sync)
        getTeamByDisplayId,              // Získa celý objekt tímu
        getTeamByDisplayIdSync           // Získa celý objekt tímu (sync)
    };

    // ============================================================
    // Automatická inicializácia, keď je DOM pripravený
    // ============================================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
//            console.log("[TeamManager] DOM pripravený, spúšťam inicializáciu...");
            initializeTeamManager();
        });
    } else {
//        console.log("[TeamManager] DOM už je pripravený, spúšťam inicializáciu...");
        setTimeout(() => initializeTeamManager(), 100);
    }

//    console.log("[TeamManager] Skript načítaný, window.teamManager je k dispozícii");
})();
