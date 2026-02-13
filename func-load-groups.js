// ============================================================
// Tímový manažér - čistý data loader
// ============================================================
// Tento modul sa stará o načítavanie všetkých tímov z Firestore:
// - tímy používateľov (z kolekcie 'users')
// - nadstavbové tímy (z dokumentu 'settings/superstructureGroups')
// - mapovanie kategórií a skupín
// ============================================================

import { doc, onSnapshot, collection, query, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Konštanty pre cesty v databáze
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
export const subscribeToTeams = (callback) => {
    teamManagerListeners.add(callback);
    return () => teamManagerListeners.delete(callback);
};

/**
 * Interná funkcia na odoslanie dát všetkým prihláseným odberateľom
 */
const notifyListeners = (data) => {
    teamManagerListeners.forEach(callback => {
        try {
            callback(data);
        } catch (error) {
            console.error("[TeamManager] Chyba pri volaní listenera:", error);
        }
    });
};

// ============================================================
// Hlavná funkcia - inicializácia načúvania na zmeny v databáze
// ============================================================
export const initializeTeamManager = () => {
    console.log("[TeamManager] Inicializácia...");
    
    if (!window.db) {
        console.error("[TeamManager] Firestore nie je inicializovaný!");
        return;
    }

    let allTeams = [];              // Všetky tímy dokopy
    let userTeams = [];              // Tímy používateľov
    let superstructureTeams = {};    // Nadstavbové tímy podľa kategórií
    let categoryIdToNameMap = {};    // Mapovanie ID -> názov kategórie
    let groupsByCategoryId = {};      // Skupiny podľa kategórií

    // ========================================================
    // 1. Načúvanie na zmeny v používateľských tímoch
    // ========================================================
    const unsubscribeUsers = onSnapshot(
        query(collection(window.db, 'users')),
        (querySnapshot) => {
            console.log("[TeamManager] Načítavam používateľské tímy...");
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
            
            console.log(`[TeamManager] Načítaných ${userTeams.length} používateľských tímov`);
        },
        (error) => {
            console.error("[TeamManager] Chyba pri načítaní používateľských tímov:", error);
        }
    );

    // ========================================================
    // 2. Načúvanie na zmeny v nadstavbových tímoch
    // ========================================================
    const unsubscribeSuperstructure = onSnapshot(
        doc(window.db, ...SUPERSTRUCTURE_TEAMS_DOC_PATH.split('/')),
        (docSnap) => {
            console.log("[TeamManager] Načítavam nadstavbové tímy...");
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
            console.log(`[TeamManager] Načítaných ${totalSuperTeams} nadstavbových tímov`);
        },
        (error) => {
            console.error("[TeamManager] Chyba pri načítaní nadstavbových tímov:", error);
        }
    );

    // ========================================================
    // 3. Načúvanie na zmeny v kategóriách
    // ========================================================
    const unsubscribeCategories = onSnapshot(
        doc(window.db, 'settings', 'categories'),
        (docSnap) => {
            console.log("[TeamManager] Načítavam kategórie...");
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
                timestamp: new Date().toISOString()
            });
            
            console.log(`[TeamManager] Načítaných ${Object.keys(newMap).length} kategórií`);
        },
        (error) => {
            console.error("[TeamManager] Chyba pri načítaní kategórií:", error);
        }
    );

    // ========================================================
    // 4. Načúvanie na zmeny v skupinách
    // ========================================================
    const unsubscribeGroups = onSnapshot(
        doc(window.db, 'settings', 'groups'),
        (docSnap) => {
            console.log("[TeamManager] Načítavam skupiny...");
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
                timestamp: new Date().toISOString()
            });
            
            const totalGroups = Object.values(newGroups).reduce((sum, arr) => sum + arr.length, 0);
            console.log(`[TeamManager] Načítaných ${totalGroups} skupín`);
        },
        (error) => {
            console.error("[TeamManager] Chyba pri načítaní skupín:", error);
        }
    );

    // ========================================================
    // 5. Jednorazové načítanie všetkých tímov (pre istotu)
    // ========================================================
    loadAllTeamsOnce().then((initialData) => {
        console.log("[TeamManager] Počiatočné načítanie dokončené:", {
            totalTeams: initialData.allTeams.length,
            userTeams: initialData.userTeams.length,
            superstructureTeams: initialData.superstructureTeams.length
        });
        
        notifyListeners({
            type: 'initialLoad',
            ...initialData,
            timestamp: new Date().toISOString()
        });
    });

    // ========================================================
    // Návratová funkcia na odhlásenie všetkých listenerov
    // ========================================================
    return () => {
        console.log("[TeamManager] Uzatváram všetky listenery...");
        unsubscribeUsers();
        unsubscribeSuperstructure();
        unsubscribeCategories();
        unsubscribeGroups();
        teamManagerListeners.clear();
    };
};

// ============================================================
// Pomocná funkcia: rozbalenie nadstavbových tímov
// ============================================================
const flattenSuperstructureTeams = (superstructureData) => {
    const result = [];
    
    Object.entries(superstructureData).forEach(([categoryName, teamArray]) => {
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

// ============================================================
// Jednorazové načítanie všetkých tímov (pre počiatočné dáta)
// ============================================================
const loadAllTeamsOnce = async () => {
    console.log("[TeamManager] Jednorazové načítanie všetkých tímov...");
    
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
    const superstructureTeams = flattenSuperstructureTeams(superstructureData);

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

    console.log(`[TeamManager] Jednorazové načítanie dokončené: ${allTeams.length} tímov`);

    return {
        allTeams,
        userTeams,
        superstructureTeams,
        categoryIdToNameMap: categoryIdToName,
        groupsByCategoryId
    };
};

// ============================================================
// Pomocné funkcie pre ostatné časti aplikácie
// ============================================================

/**
 * Získa všetky tímy (jednorazovo, nie listener)
 */
export const getAllTeams = async () => {
    const data = await loadAllTeamsOnce();
    return data.allTeams;
};

/**
 * Získa tímy podľa kategórie
 */
export const getTeamsByCategory = async (categoryName) => {
    const data = await loadAllTeamsOnce();
    return data.allTeams.filter(team => team.category === categoryName);
};

/**
 * Získa tímy podľa skupiny
 */
export const getTeamsByGroup = async (categoryName, groupName) => {
    const data = await loadAllTeamsOnce();
    return data.allTeams.filter(team => 
        team.category === categoryName && team.groupName === groupName
    );
};

/**
 * Získa mapovanie ID kategórií na názvy
 */
export const getCategoryMap = async () => {
    const data = await loadAllTeamsOnce();
    return data.categoryIdToNameMap;
};

/**
 * Získa skupiny podľa kategórie
 */
export const getGroupsByCategory = async (categoryId) => {
    const data = await loadAllTeamsOnce();
    return data.groupsByCategoryId[categoryId] || [];
};

// ============================================================
// Automatická inicializácia, ak je k dispozícii window.db
// ============================================================
if (window.db) {
    // Krátke oneskorenie pre istotu, že ostatné časti sú pripravené
    setTimeout(() => {
        initializeTeamManager();
    }, 100);
}

// ============================================================
// Export pre použitie v iných moduloch
// ============================================================
export default {
    initialize: initializeTeamManager,
    subscribe: subscribeToTeams,
    getAllTeams,
    getTeamsByCategory,
    getTeamsByGroup,
    getCategoryMap,
    getGroupsByCategory
};
