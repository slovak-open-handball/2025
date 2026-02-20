// logged-in-spider.js (upravený - symetrické rozloženie s osemfinále a šestnásťfinále)
import { doc, getDoc, getDocs, setDoc, onSnapshot, updateDoc, addDoc, deleteDoc, collection, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const { createPortal } = ReactDOM;
const { useState, useEffect } = React;

const faCSS = document.createElement('link');
faCSS.rel = 'stylesheet';
faCSS.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css';document.head.appendChild(faCSS);

// GLOBÁLNY SYSTÉM NOTIFIKÁCIÍ
if (!window.notificationContainer) {
    // Vytvorenie kontajnera pre notifikácie
    const container = document.createElement('div');
    container.id = 'global-notification-container';
    container.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 9999;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        pointer-events: none;
    `;
    document.body.appendChild(container);
    window.notificationContainer = container;
}

// Pridanie CSS pre čiary v pavúkovom zobrazení
if (!document.getElementById('spider-line-styles')) {
    const style = document.createElement('style');
    style.id = 'spider-line-styles';
    style.textContent = `
        .spider-cell {
            position: relative;
        }
        
        .spider-line-horizontal {
            position: absolute;
            height: 2px;
            background-color: #9ca3af;
            top: 50%;
            transform: translateY(-50%);
            z-index: 5;
            pointer-events: none;
        }
        
        .spider-line-vertical {
            position: absolute;
            width: 2px;
            height: 100%;
            top: 0;
            background-color: #9ca3af;
            left: 50%;
            transform: translateX(-50%);
            z-index: 5;
            pointer-events: none;
        }
        
        .spider-line-vertical-top {
            top: 0;
            height: 50%;
        }
        
        .spider-line-vertical-bottom {
            bottom: 0;
            height: 50%;
        }
        
        .spider-line-right {
            right: 0;
            width: 50%;
        }
        
        .spider-line-left {
            left: 0;
            width: 50%;
        }
    `;
    document.head.appendChild(style);
}

// Funkcia na zobrazenie globálnej notifikácie
window.showGlobalNotification = function(message, type = 'info', duration = 3000) {
    const container = window.notificationContainer;
    if (!container) return;
    
    // Vytvorenie notifikácie
    const notification = document.createElement('div');
    notification.style.cssText = `
        background-color: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : type === 'warning' ? '#ff9800' : '#2196F3'};
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        font-size: 14px;
        font-weight: 500;
        min-width: 300px;
        text-align: center;
        pointer-events: auto;
        animation: slideIn 0.3s ease;
        margin-bottom: 10px;
        backdrop-filter: blur(5px);
        border: 1px solid rgba(255,255,255,0.2);
        text-shadow: 0 1px 2px rgba(0,0,0,0.2);
    `;
    
    notification.textContent = message;
    container.appendChild(notification);
    
    // Automatické odstránenie po čase
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }, duration);
    
    return notification;
};

// Pridanie CSS animácií
if (!document.getElementById('notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateY(-100%);
                opacity: 0;
            }
            to {
                transform: translateY(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOut {
            from {
                transform: translateY(0);
                opacity: 1;
            }
            to {
                transform: translateY(-100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

// Pomocná funkcia pre skloňovanie pri mazaní
const getDeletionMessage = (count) => {
    if (count === 1) {
        return `Zmazaný ${count} pavúkový zápas`;
    } else if (count >= 2 && count <= 4) {
        return `Zmazané ${count} pavúkové zápasy`;
    } else {
        return `Zmazaných ${count} pavúkových zápasov`;
    }
};

// Stav pre aktuálny režim zobrazenia (globálny)
window.currentViewMode = window.currentViewMode || 'matches';

// Funkcia na získanie názvu dňa v týždni v slovenčine
const getDayName = (date) => {
    const days = ['Nedeľa', 'Pondelok', 'Utorok', 'Streda', 'Štvrtok', 'Piatok', 'Sobota'];
    return days[date.getDay()];
};

// Funkcia na formátovanie dátumu s dňom v týždni
const formatDateWithDay = (date) => {
    const dayName = getDayName(date);
    const formattedDate = date.toLocaleDateString('sk-SK', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    return `${dayName} ${formattedDate}`;
};

// Pomocná funkcia na aktualizáciu URL s hash parametrom (názov kategórie)
const updateUrlWithCategoryName = (categoryName) => {
    if (categoryName) {
        // Odstránime diakritiku a nahradíme medzery pomlčkami pre URL
        const urlFriendlyName = categoryName
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // odstráni diakritiku
            .replace(/\s+/g, '-') // nahradí medzery pomlčkami
            .toLowerCase();
        
        window.location.hash = urlFriendlyName;
    } else {
        window.location.hash = '';
    }
};

// Pomocná funkcia na získanie názvu kategórie z URL hash
const getCategoryNameFromUrl = () => {
    const hash = window.location.hash.substring(1); // odstráni #
    if (!hash) return '';
    
    // Konvertujeme späť z URL-friendly formátu (pomlčky na medzery)
    return hash.replace(/-/g, ' ');
};

// Funkcia na nájdenie ID kategórie podľa názvu
const findCategoryIdByName = (categories, categoryName) => {
    if (!categoryName || !categories.length) return '';
    
    const category = categories.find(c => 
        c.name.toLowerCase() === categoryName.toLowerCase()
    );
    
    return category ? category.id : '';
};

// Komponent pre pavúkovú tabuľku
const SpiderApp = ({ userProfileData }) => {
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [loading, setLoading] = useState(true);
    const [spiderData, setSpiderData] = useState(null);
    const [allMatches, setAllMatches] = useState([]); // Všetky zápasy z databázy (aj bežné, aj pavúkové)
    const [isSelectOpen, setIsSelectOpen] = useState(false);
    const [generationInProgress, setGenerationInProgress] = useState(false);
    const [isDeleteMatchesModalOpen, setIsDeleteMatchesModalOpen] = useState(false);
    const [hasSpiderMatches, setHasSpiderMatches] = useState(false);
    const [hoveredMissingMatch, setHoveredMissingMatch] = useState(null);
    const [spiderLevel, setSpiderLevel] = useState(1); // 1 = semifinále+, 2 = štvrťfinále+, 3 = osemfinále+, 4 = šestnásťfinále+
    
    // NOVÝ STAV: Dáta tímov pre debug
    const [teamsData, setTeamsData] = useState({
        userTeams: [],
        superstructureTeams: [],
        allTeams: []
    });

    // Definícia isFilterActive - filter je aktívny, ak je vybratá nejaká kategória
    const isFilterActive = selectedCategory !== '';

    // Načítanie kategórií a všetkých zápasov
    useEffect(() => {
        if (!window.db) {
            console.error("Firestore databáza nie je inicializovaná");
            setLoading(false);
            return;
        }

        const loadCategorySettings = async () => {
            try {
                const catRef = doc(window.db, 'settings', 'categories');
                const catSnap = await getDoc(catRef);
                
                if (catSnap.exists()) {
                    const data = catSnap.data() || {};
                    const categoriesList = [];
                    
                    Object.entries(data).forEach(([id, obj]) => {
                        categoriesList.push({
                            id: id,
                            name: obj.name || `Kategória ${id}`,
                        });
                    });
                    
                    setCategories(categoriesList);
                }
                setLoading(false);
            } catch (error) {
                console.error("Chyba pri načítaní kategórií:", error);
                setLoading(false);
            }
        };

        // Načítanie VŠETKÝCH zápasov z Firebase (kolekcia 'matches')
        const loadAllMatches = () => {
            const matchesRef = collection(window.db, 'matches');
            
            const unsubscribe = onSnapshot(matchesRef, (snapshot) => {
                const loadedMatches = [];
                snapshot.forEach((doc) => {
                    loadedMatches.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
                setAllMatches(loadedMatches);
                console.log('Načítané všetky zápasy:', loadedMatches.length);
            }, (error) => {
                console.error('Chyba pri načítaní zápasov:', error);
            });

            return unsubscribe;
        };

        // NOVÁ FUNKCIA: Načítanie tímov z databázy
        const loadTeamsData = async () => {
            try {
                // Načítanie používateľských tímov
                const usersSnapshot = await getDocs(collection(window.db, 'users'));
                const userTeams = [];
                
                usersSnapshot.forEach((doc) => {
                    const userData = doc.data();
                    if (userData && userData.teams) {
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
                                            order: team.order || null,
                                            source: 'user'
                                        });
                                    }
                                });
                            }
                        });
                    }
                });
                
                // Načítanie superštruktúrnych tímov
                const SUPERSTRUCTURE_TEAMS_DOC_PATH = 'settings/superstructureGroups';
                const superstructureDoc = await getDoc(doc(window.db, ...SUPERSTRUCTURE_TEAMS_DOC_PATH.split('/')));
                const superstructureTeams = [];
                
                if (superstructureDoc.exists()) {
                    const data = superstructureDoc.data() || {};
                    Object.entries(data).forEach(([categoryName, teamArray]) => {
                        if (Array.isArray(teamArray)) {
                            teamArray.forEach(team => {
                                superstructureTeams.push({
                                    uid: 'global',
                                    category: categoryName,
                                    id: team.id || crypto.randomUUID(),
                                    teamName: team.teamName,
                                    groupName: team.groupName || null,
                                    order: team.order || null,
                                    source: 'superstructure'
                                });
                            });
                        }
                    });
                }
                
                setTeamsData({
                    userTeams,
                    superstructureTeams,
                    allTeams: [...userTeams, ...superstructureTeams]
                });
                
                console.log('Načítané tímy:', {
                    userTeams: userTeams.length,
                    superstructureTeams: superstructureTeams.length,
                    total: userTeams.length + superstructureTeams.length
                });
                
            } catch (error) {
                console.error('Chyba pri načítaní tímov:', error);
            }
        };

        loadCategorySettings();
        const unsubscribe = loadAllMatches();
        loadTeamsData();

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, []);

    // Načítanie kategórie z URL hash po načítaní kategórií
    useEffect(() => {
        if (categories.length > 0) {
            const categoryNameFromUrl = getCategoryNameFromUrl();
            if (categoryNameFromUrl) {
                const categoryId = findCategoryIdByName(categories, categoryNameFromUrl);
                if (categoryId) {
                    setSelectedCategory(categoryId);
                }
            }
        }
    }, [categories]);

    // NOVÁ FUNKCIA: Debug výpis tímov pre aktuálnu kategóriu
    const debugTeamsInCategory = () => {
        if (!selectedCategory) {
            console.warn('Nie je vybratá žiadna kategória');
            return;
        }
        
        const category = categories.find(c => c.id === selectedCategory);
        const categoryName = category ? category.name : `Kategória ${selectedCategory}`;
        
        console.log('========================================');
        console.log(`🔍 DEBUG TÍMOV PRE KATEGÓRIU: ${categoryName}`);
        console.log('========================================');
        
        // Filtrujeme tímy pre aktuálnu kategóriu
        const teamsInCategory = teamsData.allTeams.filter(team => 
            team.category === categoryName
        );
        
        if (teamsInCategory.length === 0) {
            console.log('ℹ️ Žiadne tímy v tejto kategórii');
            return;
        }
        
        // Zoskupenie podľa skupiny
        const teamsByGroup = {};
        const teamsWithoutGroup = [];
        
        teamsInCategory.forEach(team => {
            if (team.groupName) {
                if (!teamsByGroup[team.groupName]) {
                    teamsByGroup[team.groupName] = [];
                }
                teamsByGroup[team.groupName].push(team);
            } else {
                teamsWithoutGroup.push(team);
            }
        });
        
        // Výpis tímov bez skupiny
        if (teamsWithoutGroup.length > 0) {
            console.log('\n📋 TÍMY BEZ SKUPINY:');
            console.table(
                teamsWithoutGroup.map(team => ({
                    'Názov tímu': team.teamName,
                    'Zdroj': team.source === 'superstructure' ? 'Nadstavbový' : 'Používateľský',
                    'Order': team.order || '-'
                }))
            );
        }
        
        // Výpis skupín a ich tímov
        const sortedGroups = Object.keys(teamsByGroup).sort();
        
        for (const groupName of sortedGroups) {
            const teams = teamsByGroup[groupName];
            
            // Zistenie typu skupiny (základná/nadstavbová)
            const hasSuperstructureTeam = teams.some(t => t.source === 'superstructure');
            const groupType = hasSuperstructureTeam ? '🏆 NADSTAVBOVÁ' : '📘 ZÁKLADNÁ';
            
            console.log(`\n${groupType} SKUPINA: ${groupName} (${teams.length} tímov)`);
            
            // Zoradenie podľa order
            const sortedTeams = [...teams].sort((a, b) => {
                const oa = typeof a.order === 'number' ? a.order : Infinity;
                const ob = typeof b.order === 'number' ? b.order : Infinity;
                return oa - ob;
            });
            
            console.table(
                sortedTeams.map(team => ({
                    'Order': team.order || '?',
                    'Názov tímu': team.teamName,
                    'Zdroj': team.source === 'superstructure' ? 'Nadstavbový' : 'Používateľský'
                }))
            );
            
            // Kontrola duplicitných order hodnôt
            const orders = teams.map(t => t.order).filter(o => o !== null && o !== undefined);
            const duplicates = orders.filter((item, index) => orders.indexOf(item) !== index);
            
            if (duplicates.length > 0) {
                console.warn(`⚠️  Upozornenie: V skupine ${groupName} sú duplicitné order hodnoty: ${[...new Set(duplicates)].join(', ')}`);
            }
            
            // Kontrola dier v poradí
            const validOrders = orders.filter(o => typeof o === 'number' && o >= 1);
            if (validOrders.length > 0) {
                const maxOrder = Math.max(...validOrders);
                const expectedCount = maxOrder;
                if (validOrders.length < expectedCount) {
                    console.warn(`⚠️  V skupine ${groupName} chýbajú tímy (očakávaný počet: ${expectedCount}, aktuálny: ${validOrders.length})`);
                }
            }
        }
        
        console.log('\n========================================');
        console.log(`📊 CELKOVÝ POČET TÍMOV: ${teamsInCategory.length}`);
        console.log('========================================');
    };

    // Načítanie pavúka pre vybranú kategóriu
    useEffect(() => {
        if (selectedCategory) {
            // Filtrujeme LEN pavúkové zápasy pre vybranú kategóriu (podľa matchType)
            const spiderMatches = allMatches.filter(m => 
                m.categoryId === selectedCategory && 
                m.matchType && // Iba zápasy, ktoré majú matchType
                ['finále', 'semifinále 1', 'semifinále 2', 'o 3. miesto', 
                 'štvrťfinále 1', 'štvrťfinále 2', 'štvrťfinále 3', 'štvrťfinále 4',
                 'osemfinále 1', 'osemfinále 2', 'osemfinále 3', 'osemfinále 4',
                 'osemfinále 5', 'osemfinále 6', 'osemfinále 7', 'osemfinále 8',
                 'šestnásťfinále 1', 'šestnásťfinále 2', 'šestnásťfinále 3', 'šestnásťfinále 4',
                 'šestnásťfinále 5', 'šestnásťfinále 6', 'šestnásťfinále 7', 'šestnásťfinále 8',
                 'šestnásťfinále 9', 'šestnásťfinále 10', 'šestnásťfinále 11', 'šestnásťfinále 12',
                 'šestnásťfinále 13', 'šestnásťfinále 14', 'šestnásťfinále 15', 'šestnásťfinále 16'].includes(m.matchType)
            );
            
            console.log('Nájdené pavúkové zápasy pre kategóriu:', spiderMatches);
            
            // Zistíme, či existujú nejaké pavúkové zápasy a aká je úroveň
            const hasSemifinalMatches = spiderMatches.some(m => ['semifinále 1', 'semifinále 2'].includes(m.matchType));
            const hasQuarterfinalMatches = spiderMatches.some(m => ['štvrťfinále 1', 'štvrťfinále 2', 'štvrťfinále 3', 'štvrťfinále 4'].includes(m.matchType));
            const hasEightfinalMatches = spiderMatches.some(m => ['osemfinále 1', 'osemfinále 2', 'osemfinále 3', 'osemfinále 4',
                                                                  'osemfinále 5', 'osemfinále 6', 'osemfinále 7', 'osemfinále 8'].includes(m.matchType));
            const hasSixteenfinalMatches = spiderMatches.some(m => ['šestnásťfinále 1', 'šestnásťfinále 2', 'šestnásťfinále 3', 'šestnásťfinále 4',
                                                                    'šestnásťfinále 5', 'šestnásťfinále 6', 'šestnásťfinále 7', 'šestnásťfinále 8',
                                                                    'šestnásťfinále 9', 'šestnásťfinále 10', 'šestnásťfinále 11', 'šestnásťfinále 12',
                                                                    'šestnásťfinále 13', 'šestnásťfinále 14', 'šestnásťfinále 15', 'šestnásťfinále 16'].includes(m.matchType));
            
            setHasSpiderMatches(spiderMatches.length > 0);
            
            if (hasSixteenfinalMatches) {
                setSpiderLevel(4);
            } else if (hasEightfinalMatches) {
                setSpiderLevel(3);
            } else if (hasQuarterfinalMatches) {
                setSpiderLevel(2);
            } else if (hasSemifinalMatches) {
                setSpiderLevel(1);
            }
            
            if (spiderMatches.length > 0) {
                // Vytvoríme štruktúru z existujúcich zápasov
                const spiderStructure = {
                    final: spiderMatches.find(m => m.matchType === 'finále') || { 
                        id: 'final', 
                        homeTeam: '---', 
                        awayTeam: '---', 
                        homeScore: '', 
                        awayScore: '', 
                        date: null,
                        exists: false
                    },
                    semiFinals: [
                        spiderMatches.find(m => m.matchType === 'semifinále 1') || { 
                            id: 'sf1', 
                            homeTeam: '---', 
                            awayTeam: '---', 
                            homeScore: '', 
                            awayScore: '', 
                            date: null,
                            exists: false
                        },
                        spiderMatches.find(m => m.matchType === 'semifinále 2') || { 
                            id: 'sf2', 
                            homeTeam: '---', 
                            awayTeam: '---', 
                            homeScore: '', 
                            awayScore: '', 
                            date: null,
                            exists: false
                        }
                    ],
                    quarterFinals: [
                        spiderMatches.find(m => m.matchType === 'štvrťfinále 1') || { 
                            id: 'qf1', 
                            homeTeam: '---', 
                            awayTeam: '---', 
                            homeScore: '', 
                            awayScore: '', 
                            date: null,
                            exists: false
                        },
                        spiderMatches.find(m => m.matchType === 'štvrťfinále 2') || { 
                            id: 'qf2', 
                            homeTeam: '---', 
                            awayTeam: '---', 
                            homeScore: '', 
                            awayScore: '', 
                            date: null,
                            exists: false
                        },
                        spiderMatches.find(m => m.matchType === 'štvrťfinále 3') || { 
                            id: 'qf3', 
                            homeTeam: '---', 
                            awayTeam: '---', 
                            homeScore: '', 
                            awayScore: '', 
                            date: null,
                            exists: false
                        },
                        spiderMatches.find(m => m.matchType === 'štvrťfinále 4') || { 
                            id: 'qf4', 
                            homeTeam: '---', 
                            awayTeam: '---', 
                            homeScore: '', 
                            awayScore: '', 
                            date: null,
                            exists: false
                        }
                    ],
                    eightFinals: [
                        spiderMatches.find(m => m.matchType === 'osemfinále 1') || { 
                            id: 'ef1', 
                            homeTeam: '---', 
                            awayTeam: '---', 
                            homeScore: '', 
                            awayScore: '', 
                            date: null,
                            exists: false
                        },
                        spiderMatches.find(m => m.matchType === 'osemfinále 2') || { 
                            id: 'ef2', 
                            homeTeam: '---', 
                            awayTeam: '---', 
                            homeScore: '', 
                            awayScore: '', 
                            date: null,
                            exists: false
                        },
                        spiderMatches.find(m => m.matchType === 'osemfinále 3') || { 
                            id: 'ef3', 
                            homeTeam: '---', 
                            awayTeam: '---', 
                            homeScore: '', 
                            awayScore: '', 
                            date: null,
                            exists: false
                        },
                        spiderMatches.find(m => m.matchType === 'osemfinále 4') || { 
                            id: 'ef4', 
                            homeTeam: '---', 
                            awayTeam: '---', 
                            homeScore: '', 
                            awayScore: '', 
                            date: null,
                            exists: false
                        },
                        spiderMatches.find(m => m.matchType === 'osemfinále 5') || { 
                            id: 'ef5', 
                            homeTeam: '---', 
                            awayTeam: '---', 
                            homeScore: '', 
                            awayScore: '', 
                            date: null,
                            exists: false
                        },
                        spiderMatches.find(m => m.matchType === 'osemfinále 6') || { 
                            id: 'ef6', 
                            homeTeam: '---', 
                            awayTeam: '---', 
                            homeScore: '', 
                            awayScore: '', 
                            date: null,
                            exists: false
                        },
                        spiderMatches.find(m => m.matchType === 'osemfinále 7') || { 
                            id: 'ef7', 
                            homeTeam: '---', 
                            awayTeam: '---', 
                            homeScore: '', 
                            awayScore: '', 
                            date: null,
                            exists: false
                        },
                        spiderMatches.find(m => m.matchType === 'osemfinále 8') || { 
                            id: 'ef8', 
                            homeTeam: '---', 
                            awayTeam: '---', 
                            homeScore: '', 
                            awayScore: '', 
                            date: null,
                            exists: false
                        }
                    ],
                    sixteenFinals: [
                        spiderMatches.find(m => m.matchType === 'šestnásťfinále 1') || { 
                            id: 'sf1', 
                            homeTeam: '---', 
                            awayTeam: '---', 
                            homeScore: '', 
                            awayScore: '', 
                            date: null,
                            exists: false
                        },
                        spiderMatches.find(m => m.matchType === 'šestnásťfinále 2') || { 
                            id: 'sf2', 
                            homeTeam: '---', 
                            awayTeam: '---', 
                            homeScore: '', 
                            awayScore: '', 
                            date: null,
                            exists: false
                        },
                        spiderMatches.find(m => m.matchType === 'šestnásťfinále 3') || { 
                            id: 'sf3', 
                            homeTeam: '---', 
                            awayTeam: '---', 
                            homeScore: '', 
                            awayScore: '', 
                            date: null,
                            exists: false
                        },
                        spiderMatches.find(m => m.matchType === 'šestnásťfinále 4') || { 
                            id: 'sf4', 
                            homeTeam: '---', 
                            awayTeam: '---', 
                            homeScore: '', 
                            awayScore: '', 
                            date: null,
                            exists: false
                        },
                        spiderMatches.find(m => m.matchType === 'šestnásťfinále 5') || { 
                            id: 'sf5', 
                            homeTeam: '---', 
                            awayTeam: '---', 
                            homeScore: '', 
                            awayScore: '', 
                            date: null,
                            exists: false
                        },
                        spiderMatches.find(m => m.matchType === 'šestnásťfinále 6') || { 
                            id: 'sf6', 
                            homeTeam: '---', 
                            awayTeam: '---', 
                            homeScore: '', 
                            awayScore: '', 
                            date: null,
                            exists: false
                        },
                        spiderMatches.find(m => m.matchType === 'šestnásťfinále 7') || { 
                            id: 'sf7', 
                            homeTeam: '---', 
                            awayTeam: '---', 
                            homeScore: '', 
                            awayScore: '', 
                            date: null,
                            exists: false
                        },
                        spiderMatches.find(m => m.matchType === 'šestnásťfinále 8') || { 
                            id: 'sf8', 
                            homeTeam: '---', 
                            awayTeam: '---', 
                            homeScore: '', 
                            awayScore: '', 
                            date: null,
                            exists: false
                        },
                        spiderMatches.find(m => m.matchType === 'šestnásťfinále 9') || { 
                            id: 'sf9', 
                            homeTeam: '---', 
                            awayTeam: '---', 
                            homeScore: '', 
                            awayScore: '', 
                            date: null,
                            exists: false
                        },
                        spiderMatches.find(m => m.matchType === 'šestnásťfinále 10') || { 
                            id: 'sf10', 
                            homeTeam: '---', 
                            awayTeam: '---', 
                            homeScore: '', 
                            awayScore: '', 
                            date: null,
                            exists: false
                        },
                        spiderMatches.find(m => m.matchType === 'šestnásťfinále 11') || { 
                            id: 'sf11', 
                            homeTeam: '---', 
                            awayTeam: '---', 
                            homeScore: '', 
                            awayScore: '', 
                            date: null,
                            exists: false
                        },
                        spiderMatches.find(m => m.matchType === 'šestnásťfinále 12') || { 
                            id: 'sf12', 
                            homeTeam: '---', 
                            awayTeam: '---', 
                            homeScore: '', 
                            awayScore: '', 
                            date: null,
                            exists: false
                        },
                        spiderMatches.find(m => m.matchType === 'šestnásťfinále 13') || { 
                            id: 'sf13', 
                            homeTeam: '---', 
                            awayTeam: '---', 
                            homeScore: '', 
                            awayScore: '', 
                            date: null,
                            exists: false
                        },
                        spiderMatches.find(m => m.matchType === 'šestnásťfinále 14') || { 
                            id: 'sf14', 
                            homeTeam: '---', 
                            awayTeam: '---', 
                            homeScore: '', 
                            awayScore: '', 
                            date: null,
                            exists: false
                        },
                        spiderMatches.find(m => m.matchType === 'šestnásťfinále 15') || { 
                            id: 'sf15', 
                            homeTeam: '---', 
                            awayTeam: '---', 
                            homeScore: '', 
                            awayScore: '', 
                            date: null,
                            exists: false
                        },
                        spiderMatches.find(m => m.matchType === 'šestnásťfinále 16') || { 
                            id: 'sf16', 
                            homeTeam: '---', 
                            awayTeam: '---', 
                            homeScore: '', 
                            awayScore: '', 
                            date: null,
                            exists: false
                        }
                    ],
                    thirdPlace: spiderMatches.find(m => m.matchType === 'o 3. miesto') || { 
                        id: 'third', 
                        homeTeam: '---', 
                        awayTeam: '---', 
                        homeScore: '', 
                        awayScore: '', 
                        date: null,
                        exists: false
                    }
                };
                
                // Označíme existujúce zápasy a naplníme ich dátami
                spiderMatches.forEach(match => {
                    if (match.matchType === 'finále') {
                        spiderStructure.final.exists = true;
                        spiderStructure.final.id = match.id;
                        spiderStructure.final.homeTeam = match.homeTeamIdentifier || match.homeTeam || '---';
                        spiderStructure.final.awayTeam = match.awayTeamIdentifier || match.awayTeam || '---';
                        spiderStructure.final.homeScore = match.homeScore;
                        spiderStructure.final.awayScore = match.awayScore;
                        spiderStructure.final.date = match.date;
                    } else if (match.matchType === 'semifinále 1') {
                        spiderStructure.semiFinals[0].exists = true;
                        spiderStructure.semiFinals[0].id = match.id;
                        spiderStructure.semiFinals[0].homeTeam = match.homeTeamIdentifier || match.homeTeam || '---';
                        spiderStructure.semiFinals[0].awayTeam = match.awayTeamIdentifier || match.awayTeam || '---';
                        spiderStructure.semiFinals[0].homeScore = match.homeScore;
                        spiderStructure.semiFinals[0].awayScore = match.awayScore;
                        spiderStructure.semiFinals[0].date = match.date;
                    } else if (match.matchType === 'semifinále 2') {
                        spiderStructure.semiFinals[1].exists = true;
                        spiderStructure.semiFinals[1].id = match.id;
                        spiderStructure.semiFinals[1].homeTeam = match.homeTeamIdentifier || match.homeTeam || '---';
                        spiderStructure.semiFinals[1].awayTeam = match.awayTeamIdentifier || match.awayTeam || '---';
                        spiderStructure.semiFinals[1].homeScore = match.homeScore;
                        spiderStructure.semiFinals[1].awayScore = match.awayScore;
                        spiderStructure.semiFinals[1].date = match.date;
                    } else if (match.matchType === 'o 3. miesto') {
                        spiderStructure.thirdPlace.exists = true;
                        spiderStructure.thirdPlace.id = match.id;
                        spiderStructure.thirdPlace.homeTeam = match.homeTeamIdentifier || match.homeTeam || '---';
                        spiderStructure.thirdPlace.awayTeam = match.awayTeamIdentifier || match.awayTeam || '---';
                        spiderStructure.thirdPlace.homeScore = match.homeScore;
                        spiderStructure.thirdPlace.awayScore = match.awayScore;
                        spiderStructure.thirdPlace.date = match.date;
                    } else if (match.matchType === 'štvrťfinále 1') {
                        spiderStructure.quarterFinals[0].exists = true;
                        spiderStructure.quarterFinals[0].id = match.id;
                        spiderStructure.quarterFinals[0].homeTeam = match.homeTeamIdentifier || match.homeTeam || '---';
                        spiderStructure.quarterFinals[0].awayTeam = match.awayTeamIdentifier || match.awayTeam || '---';
                        spiderStructure.quarterFinals[0].homeScore = match.homeScore;
                        spiderStructure.quarterFinals[0].awayScore = match.awayScore;
                        spiderStructure.quarterFinals[0].date = match.date;
                    } else if (match.matchType === 'štvrťfinále 2') {
                        spiderStructure.quarterFinals[1].exists = true;
                        spiderStructure.quarterFinals[1].id = match.id;
                        spiderStructure.quarterFinals[1].homeTeam = match.homeTeamIdentifier || match.homeTeam || '---';
                        spiderStructure.quarterFinals[1].awayTeam = match.awayTeamIdentifier || match.awayTeam || '---';
                        spiderStructure.quarterFinals[1].homeScore = match.homeScore;
                        spiderStructure.quarterFinals[1].awayScore = match.awayScore;
                        spiderStructure.quarterFinals[1].date = match.date;
                    } else if (match.matchType === 'štvrťfinále 3') {
                        spiderStructure.quarterFinals[2].exists = true;
                        spiderStructure.quarterFinals[2].id = match.id;
                        spiderStructure.quarterFinals[2].homeTeam = match.homeTeamIdentifier || match.homeTeam || '---';
                        spiderStructure.quarterFinals[2].awayTeam = match.awayTeamIdentifier || match.awayTeam || '---';
                        spiderStructure.quarterFinals[2].homeScore = match.homeScore;
                        spiderStructure.quarterFinals[2].awayScore = match.awayScore;
                        spiderStructure.quarterFinals[2].date = match.date;
                    } else if (match.matchType === 'štvrťfinále 4') {
                        spiderStructure.quarterFinals[3].exists = true;
                        spiderStructure.quarterFinals[3].id = match.id;
                        spiderStructure.quarterFinals[3].homeTeam = match.homeTeamIdentifier || match.homeTeam || '---';
                        spiderStructure.quarterFinals[3].awayTeam = match.awayTeamIdentifier || match.awayTeam || '---';
                        spiderStructure.quarterFinals[3].homeScore = match.homeScore;
                        spiderStructure.quarterFinals[3].awayScore = match.awayScore;
                        spiderStructure.quarterFinals[3].date = match.date;
                    } else if (match.matchType.startsWith('osemfinále')) {
                        const index = parseInt(match.matchType.split(' ')[1]) - 1;
                        if (index >= 0 && index < 8) {
                            spiderStructure.eightFinals[index].exists = true;
                            spiderStructure.eightFinals[index].id = match.id;
                            spiderStructure.eightFinals[index].homeTeam = match.homeTeamIdentifier || match.homeTeam || '---';
                            spiderStructure.eightFinals[index].awayTeam = match.awayTeamIdentifier || match.awayTeam || '---';
                            spiderStructure.eightFinals[index].homeScore = match.homeScore;
                            spiderStructure.eightFinals[index].awayScore = match.awayScore;
                            spiderStructure.eightFinals[index].date = match.date;
                        }
                    } else if (match.matchType.startsWith('šestnásťfinále')) {
                        const index = parseInt(match.matchType.split(' ')[1]) - 1;
                        if (index >= 0 && index < 16) {
                            spiderStructure.sixteenFinals[index].exists = true;
                            spiderStructure.sixteenFinals[index].id = match.id;
                            spiderStructure.sixteenFinals[index].homeTeam = match.homeTeamIdentifier || match.homeTeam || '---';
                            spiderStructure.sixteenFinals[index].awayTeam = match.awayTeamIdentifier || match.awayTeam || '---';
                            spiderStructure.sixteenFinals[index].homeScore = match.homeScore;
                            spiderStructure.sixteenFinals[index].awayScore = match.awayScore;
                            spiderStructure.sixteenFinals[index].date = match.date;
                        }
                    }
                });
                
                setSpiderData(spiderStructure);
            } else {
                // Žiadne pavúkové zápasy - nezobrazujeme boxy
                setSpiderData(null);
            }
        } else {
            // Žiadna vybratá kategória
            setSpiderData(null);
            setHasSpiderMatches(false);
        }
    }, [selectedCategory, allMatches]);

    // Funkcia na vymazanie jednotlivého pavúkového zápasu
    const deleteSingleMatch = async (matchId, matchType) => {
        if (!window.db) {
            window.showGlobalNotification('Databáza nie je inicializovaná', 'error');
            return;
        }
    
        if (userProfileData?.role !== 'admin') {
            window.showGlobalNotification('Na mazanie zápasov potrebujete administrátorské práva', 'error');
            return;
        }
    
        setGenerationInProgress(true);
        
        try {
            // Najprv získame dáta zápasu, ktorý mažeme
            const matchToDelete = allMatches.find(m => m.id === matchId);
            
            if (!matchToDelete) {
                window.showGlobalNotification('Zápas sa nenašiel', 'error');
                return;
            }
    
            // Ak mažeme šestnásťfinálový zápas, aktualizujeme príslušný osemfinálový zápas
            if (matchType.startsWith('šestnásťfinále')) {
                // Získame číslo šestnásťfinále (1-16)
                const matchNumber = parseInt(matchType.split(' ')[1]);
                
                // Určíme, ktorý osemfinálový zápas a ktorú pozíciu (domáci/hosť) treba aktualizovať
                let eightfinalMatchType = '';
                let position = ''; // 'home' alebo 'away'
                
                // Mapovanie šestnásťfinále na osemfinále
                // Šestnásťfinále 1 a 2 -> Osemfinále 1 (domáci a hosť)
                // Šestnásťfinále 3 a 4 -> Osemfinále 2 (domáci a hosť)
                // Šestnásťfinále 5 a 6 -> Osemfinále 3 (domáci a hosť)
                // Šestnásťfinále 7 a 8 -> Osemfinále 4 (domáci a hosť)
                // Šestnásťfinále 9 a 10 -> Osemfinále 5 (domáci a hosť)
                // Šestnásťfinále 11 a 12 -> Osemfinále 6 (domáci a hosť)
                // Šestnásťfinále 13 a 14 -> Osemfinále 7 (domáci a hosť)
                // Šestnásťfinále 15 a 16 -> Osemfinále 8 (domáci a hosť)
                
                const eightfinalNumber = Math.ceil(matchNumber / 2);
                eightfinalMatchType = `osemfinále ${eightfinalNumber}`;
                position = matchNumber % 2 === 1 ? 'home' : 'away';
                
                // Nájdeme príslušný osemfinálový zápas
                const eightfinalMatch = allMatches.find(m => 
                    m.categoryId === selectedCategory && 
                    m.matchType === eightfinalMatchType
                );
                
                if (eightfinalMatch) {
                    // Aktualizujeme príslušný identifikátor na '---'
                    const updateData = {};
                    if (position === 'home') {
                        updateData.homeTeamIdentifier = '---';
                    } else {
                        updateData.awayTeamIdentifier = '---';
                    }
                    
                    await updateDoc(doc(window.db, 'matches', eightfinalMatch.id), updateData);
                }
            }
            
            // Ak mažeme osemfinálový zápas, aktualizujeme príslušný štvrťfinálový zápas
            else if (matchType.startsWith('osemfinále')) {
                // Získame číslo osemfinále (1-8)
                const matchNumber = parseInt(matchType.split(' ')[1]);
                
                // Určíme, ktorý štvrťfinálový zápas a ktorú pozíciu (domáci/hosť) treba aktualizovať
                let quarterfinalMatchType = '';
                let position = ''; // 'home' alebo 'away'
                
                // Mapovanie osemfinále na štvrťfinále
                // Osemfinále 1 a 2 -> Štvrťfinále 1 (domáci a hosť)
                // Osemfinále 3 a 4 -> Štvrťfinále 2 (domáci a hosť)
                // Osemfinále 5 a 6 -> Štvrťfinále 3 (domáci a hosť)
                // Osemfinále 7 a 8 -> Štvrťfinále 4 (domáci a hosť)
                
                if (matchNumber === 1 || matchNumber === 2) {
                    quarterfinalMatchType = 'štvrťfinále 1';
                    position = matchNumber === 1 ? 'home' : 'away';
                } else if (matchNumber === 3 || matchNumber === 4) {
                    quarterfinalMatchType = 'štvrťfinále 2';
                    position = matchNumber === 3 ? 'home' : 'away';
                } else if (matchNumber === 5 || matchNumber === 6) {
                    quarterfinalMatchType = 'štvrťfinále 3';
                    position = matchNumber === 5 ? 'home' : 'away';
                } else if (matchNumber === 7 || matchNumber === 8) {
                    quarterfinalMatchType = 'štvrťfinále 4';
                    position = matchNumber === 7 ? 'home' : 'away';
                }
                
                // Nájdeme príslušný štvrťfinálový zápas
                const quarterfinalMatch = allMatches.find(m => 
                    m.categoryId === selectedCategory && 
                    m.matchType === quarterfinalMatchType
                );
                
                if (quarterfinalMatch) {
                    // Aktualizujeme príslušný identifikátor na '---'
                    const updateData = {};
                    if (position === 'home') {
                        updateData.homeTeamIdentifier = '---';
                    } else {
                        updateData.awayTeamIdentifier = '---';
                    }
                    
                    await updateDoc(doc(window.db, 'matches', quarterfinalMatch.id), updateData);
                }
            }
            
            // Ak mažeme štvrťfinálový zápas, aktualizujeme príslušný semifinálový zápas
            else if (matchType.startsWith('štvrťfinále')) {
                // Získame číslo štvrťfinále (1-4)
                const matchNumber = parseInt(matchType.split(' ')[1]);
                
                // Určíme, ktorý semifinálový zápas a ktorú pozíciu treba aktualizovať
                let semifinalMatchType = '';
                let position = '';
                
                // Mapovanie štvrťfinále na semifinále
                // Štvrťfinále 1 a 2 -> Semifinále 1 (domáci a hosť)
                // Štvrťfinále 3 a 4 -> Semifinále 2 (domáci a hosť)
                
                if (matchNumber === 1 || matchNumber === 2) {
                    semifinalMatchType = 'semifinále 1';
                    position = matchNumber === 1 ? 'home' : 'away';
                } else if (matchNumber === 3 || matchNumber === 4) {
                    semifinalMatchType = 'semifinále 2';
                    position = matchNumber === 3 ? 'home' : 'away';
                }
                
                // Nájdeme príslušný semifinálový zápas
                const semifinalMatch = allMatches.find(m => 
                    m.categoryId === selectedCategory && 
                    m.matchType === semifinalMatchType
                );
                
                if (semifinalMatch) {
                    // Aktualizujeme príslušný identifikátor na '---'
                    const updateData = {};
                    if (position === 'home') {
                        updateData.homeTeamIdentifier = '---';
                    } else {
                        updateData.awayTeamIdentifier = '---';
                    }
                    
                    await updateDoc(doc(window.db, 'matches', semifinalMatch.id), updateData);
                }
            }
            
            // Ak mažeme semifinálový zápas, aktualizujeme finále a o 3. miesto
            else if (matchType.startsWith('semifinále')) {
                const matchNumber = parseInt(matchType.split(' ')[1]); // 1 alebo 2
                
                // Nájdeme finálový zápas
                const finalMatch = allMatches.find(m => 
                    m.categoryId === selectedCategory && 
                    m.matchType === 'finále'
                );
                
                // Nájdeme zápas o 3. miesto
                const thirdPlaceMatch = allMatches.find(m => 
                    m.categoryId === selectedCategory && 
                    m.matchType === 'o 3. miesto'
                );
                
                // Aktualizujeme finále
                if (finalMatch) {
                    if (matchNumber === 1) {
                        // Semifinále 1 ovplyvňuje domáci tím vo finále (WSF01)
                        await updateDoc(doc(window.db, 'matches', finalMatch.id), {
                            homeTeamIdentifier: '---'
                        });
                    } else if (matchNumber === 2) {
                        // Semifinále 2 ovplyvňuje hosťovský tím vo finále (WSF02)
                        await updateDoc(doc(window.db, 'matches', finalMatch.id), {
                            awayTeamIdentifier: '---'
                        });
                    }
                }
                
                // Aktualizujeme zápas o 3. miesto
                if (thirdPlaceMatch) {
                    if (matchNumber === 1) {
                        // Semifinále 1 ovplyvňuje domáci tím o 3. miesto (LSF01)
                        await updateDoc(doc(window.db, 'matches', thirdPlaceMatch.id), {
                            homeTeamIdentifier: '---'
                        });
                    } else if (matchNumber === 2) {
                        // Semifinále 2 ovplyvňuje hosťovský tím o 3. miesto (LSF02)
                        await updateDoc(doc(window.db, 'matches', thirdPlaceMatch.id), {
                            awayTeamIdentifier: '---'
                        });
                    }
                }
            }
            
            // Ak mažeme finále, nemusíme aktualizovať nič (je to najvyššia úroveň)
            // Ak mažeme o 3. miesto, tiež nemusíme aktualizovať nič (je to finálová vetva)
            
            // Vymažeme samotný zápas
            await deleteDoc(doc(window.db, 'matches', matchId));
            
            window.showGlobalNotification(`Zápas ${matchType} bol zmazaný`, 'success');
    
        } catch (error) {
            console.error('Chyba pri mazaní zápasu:', error);
            window.showGlobalNotification('Chyba pri mazaní zápasu: ' + error.message, 'error');
        } finally {
            setGenerationInProgress(false);
        }
    };

    // Funkcia na vytvorenie štruktúry pavúka a uloženie do databázy (do kolekcie 'matches')
    const generateSpider = async () => {
        const categoryId = selectedCategory;
        
        if (!categoryId) {
            window.showGlobalNotification('Vyberte kategóriu', 'error');
            return;
        }
    
        if (!window.db) {
            window.showGlobalNotification('Databáza nie je inicializovaná', 'error');
            return;
        }
    
        if (userProfileData?.role !== 'admin') {
            window.showGlobalNotification('Na generovanie pavúka potrebujete administrátorské práva', 'error');
            return;
        }
    
        setGenerationInProgress(true);
        
        try {
            // Zistíme, či už existujú pavúkové zápasy pre túto kategóriu
            const existingSpiderMatches = allMatches.filter(m => 
                m.categoryId === categoryId && 
                m.matchType && 
                ['finále', 'semifinále 1', 'semifinále 2', 'o 3. miesto', 
                 'štvrťfinále 1', 'štvrťfinále 2', 'štvrťfinále 3', 'štvrťfinále 4',
                 'osemfinále 1', 'osemfinále 2', 'osemfinále 3', 'osemfinále 4',
                 'osemfinále 5', 'osemfinále 6', 'osemfinále 7', 'osemfinále 8',
                 'šestnásťfinále 1', 'šestnásťfinále 2', 'šestnásťfinále 3', 'šestnásťfinále 4',
                 'šestnásťfinále 5', 'šestnásťfinále 6', 'šestnásťfinále 7', 'šestnásťfinále 8',
                 'šestnásťfinále 9', 'šestnásťfinále 10', 'šestnásťfinále 11', 'šestnásťfinále 12',
                 'šestnásťfinále 13', 'šestnásťfinále 14', 'šestnásťfinále 15', 'šestnásťfinále 16'].includes(m.matchType)
            );
            
            const hasSemifinals = existingSpiderMatches.some(m => ['semifinále 1', 'semifinále 2'].includes(m.matchType));
            const hasQuarterfinals = existingSpiderMatches.some(m => ['štvrťfinále 1', 'štvrťfinále 2', 'štvrťfinále 3', 'štvrťfinále 4'].includes(m.matchType));
            const hasEightfinals = existingSpiderMatches.some(m => ['osemfinále 1', 'osemfinále 2', 'osemfinále 3', 'osemfinále 4',
                                                                     'osemfinále 5', 'osemfinále 6', 'osemfinále 7', 'osemfinále 8'].includes(m.matchType));
            const hasSixteenfinals = existingSpiderMatches.some(m => ['šestnásťfinále 1', 'šestnásťfinále 2', 'šestnásťfinále 3', 'šestnásťfinále 4',
                                                                      'šestnásťfinále 5', 'šestnásťfinále 6', 'šestnásťfinále 7', 'šestnásťfinále 8',
                                                                      'šestnásťfinále 9', 'šestnásťfinále 10', 'šestnásťfinále 11', 'šestnásťfinále 12',
                                                                      'šestnásťfinále 13', 'šestnásťfinále 14', 'šestnásťfinále 15', 'šestnásťfinále 16'].includes(m.matchType));
            
            // Ak už existujú šestnásťfinále, nebudeme generovať nič
            if (hasSixteenfinals) {
                window.showGlobalNotification('Pavúk už má šestnásťfinále. Ďalšia úroveň zatiaľ nie je implementovaná.', 'warning');
                setGenerationInProgress(false);
                return;
            }
            
            // Získanie názvu kategórie
            const category = categories.find(c => c.id === categoryId);
            const categoryName = category ? category.name : `Kategória ${categoryId}`;
            
            // Odstránenie diakritiky z názvu kategórie pre identifikátory
            const categoryWithoutDiacritics = categoryName
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, ''); // odstráni diakritiku, ale zachová medzery
            
            let matchesToSave = [];
            
            if (!hasSemifinals) {
                // Prvé generovanie - semifinále, finále, o 3. miesto
                matchesToSave = [
                    // Semifinále 1
                    {
                        homeTeamIdentifier: '---',
                        awayTeamIdentifier: '---',
                        time: '--:--',
                        hallId: null,
                        categoryId: categoryId,
                        categoryName: categoryName,
                        groupName: null,
                        matchType: 'semifinále 1',
                        status: 'pending',
                        createdAt: Timestamp.now(),
                        createdBy: userProfileData?.email || 'unknown',
                        createdByUid: userProfileData?.uid || null
                    },
                    // Semifinále 2
                    {
                        homeTeamIdentifier: '---',
                        awayTeamIdentifier: '---',
                        time: '--:--',
                        hallId: null,
                        categoryId: categoryId,
                        categoryName: categoryName,
                        groupName: null,
                        matchType: 'semifinále 2',
                        status: 'pending',
                        createdAt: Timestamp.now(),
                        createdBy: userProfileData?.email || 'unknown',
                        createdByUid: userProfileData?.uid || null
                    },
                    // Finále
                    {
                        homeTeamIdentifier: `${categoryWithoutDiacritics} WSF01`,
                        awayTeamIdentifier: `${categoryWithoutDiacritics} WSF02`,
                        time: '--:--',
                        hallId: null,
                        categoryId: categoryId,
                        categoryName: categoryName,
                        groupName: null,
                        matchType: 'finále',
                        status: 'pending',
                        createdAt: Timestamp.now(),
                        createdBy: userProfileData?.email || 'unknown',
                        createdByUid: userProfileData?.uid || null
                    },
                    // o 3. miesto
                    {
                        homeTeamIdentifier: `${categoryWithoutDiacritics} LSF01`,
                        awayTeamIdentifier: `${categoryWithoutDiacritics} LSF02`,
                        time: '--:--',
                        hallId: null,
                        categoryId: categoryId,
                        categoryName: categoryName,
                        groupName: null,
                        matchType: 'o 3. miesto',
                        status: 'pending',
                        createdAt: Timestamp.now(),
                        createdBy: userProfileData?.email || 'unknown',
                        createdByUid: userProfileData?.uid || null
                    }
                ];
                
                setSpiderLevel(1);
            } else if (!hasQuarterfinals) {
                // Druhé generovanie - štvrťfinále (4 zápasy)
                matchesToSave = [
                    // Štvrťfinále 1
                    {
                        homeTeamIdentifier: '---',
                        awayTeamIdentifier: '---',
                        time: '--:--',
                        hallId: null,
                        categoryId: categoryId,
                        categoryName: categoryName,
                        groupName: null,
                        matchType: 'štvrťfinále 1',
                        status: 'pending',
                        createdAt: Timestamp.now(),
                        createdBy: userProfileData?.email || 'unknown',
                        createdByUid: userProfileData?.uid || null
                    },
                    // Štvrťfinále 2
                    {
                        homeTeamIdentifier: '---',
                        awayTeamIdentifier: '---',
                        time: '--:--',
                        hallId: null,
                        categoryId: categoryId,
                        categoryName: categoryName,
                        groupName: null,
                        matchType: 'štvrťfinále 2',
                        status: 'pending',
                        createdAt: Timestamp.now(),
                        createdBy: userProfileData?.email || 'unknown',
                        createdByUid: userProfileData?.uid || null
                    },
                    // Štvrťfinále 3
                    {
                        homeTeamIdentifier: '---',
                        awayTeamIdentifier: '---',
                        time: '--:--',
                        hallId: null,
                        categoryId: categoryId,
                        categoryName: categoryName,
                        groupName: null,
                        matchType: 'štvrťfinále 3',
                        status: 'pending',
                        createdAt: Timestamp.now(),
                        createdBy: userProfileData?.email || 'unknown',
                        createdByUid: userProfileData?.uid || null
                    },
                    // Štvrťfinále 4
                    {
                        homeTeamIdentifier: '---',
                        awayTeamIdentifier: '---',
                        time: '--:--',
                        hallId: null,
                        categoryId: categoryId,
                        categoryName: categoryName,
                        groupName: null,
                        matchType: 'štvrťfinále 4',
                        status: 'pending',
                        createdAt: Timestamp.now(),
                        createdBy: userProfileData?.email || 'unknown',
                        createdByUid: userProfileData?.uid || null
                    }
                ];

                // Nájdeme existujúce semifinálové zápasy a aktualizujeme ich identifikátory
                const semifinal1 = existingSpiderMatches.find(m => m.matchType === 'semifinále 1');
                const semifinal2 = existingSpiderMatches.find(m => m.matchType === 'semifinále 2');

                if (semifinal1) {
                    await updateDoc(doc(window.db, 'matches', semifinal1.id), {
                        homeTeamIdentifier: `${categoryWithoutDiacritics} WQF01`,
                        awayTeamIdentifier: `${categoryWithoutDiacritics} WQF02`
                    });
                }

                if (semifinal2) {
                    await updateDoc(doc(window.db, 'matches', semifinal2.id), {
                        homeTeamIdentifier: `${categoryWithoutDiacritics} WQF03`,
                        awayTeamIdentifier: `${categoryWithoutDiacritics} WQF04`
                    });
                }
                
                setSpiderLevel(2);
            } else if (!hasEightfinals) {
                // Tretie generovanie - osemfinále (8 zápasov)
                matchesToSave = [
                    // Osemfinále 1
                    {
                        homeTeamIdentifier: '---',
                        awayTeamIdentifier: '---',
                        time: '--:--',
                        hallId: null,
                        categoryId: categoryId,
                        categoryName: categoryName,
                        groupName: null,
                        matchType: 'osemfinále 1',
                        status: 'pending',
                        createdAt: Timestamp.now(),
                        createdBy: userProfileData?.email || 'unknown',
                        createdByUid: userProfileData?.uid || null
                    },
                    // Osemfinále 2
                    {
                        homeTeamIdentifier: '---',
                        awayTeamIdentifier: '---',
                        time: '--:--',
                        hallId: null,
                        categoryId: categoryId,
                        categoryName: categoryName,
                        groupName: null,
                        matchType: 'osemfinále 2',
                        status: 'pending',
                        createdAt: Timestamp.now(),
                        createdBy: userProfileData?.email || 'unknown',
                        createdByUid: userProfileData?.uid || null
                    },
                    // Osemfinále 3
                    {
                        homeTeamIdentifier: '---',
                        awayTeamIdentifier: '---',
                        time: '--:--',
                        hallId: null,
                        categoryId: categoryId,
                        categoryName: categoryName,
                        groupName: null,
                        matchType: 'osemfinále 3',
                        status: 'pending',
                        createdAt: Timestamp.now(),
                        createdBy: userProfileData?.email || 'unknown',
                        createdByUid: userProfileData?.uid || null
                    },
                    // Osemfinále 4
                    {
                        homeTeamIdentifier: '---',
                        awayTeamIdentifier: '---',
                        time: '--:--',
                        hallId: null,
                        categoryId: categoryId,
                        categoryName: categoryName,
                        groupName: null,
                        matchType: 'osemfinále 4',
                        status: 'pending',
                        createdAt: Timestamp.now(),
                        createdBy: userProfileData?.email || 'unknown',
                        createdByUid: userProfileData?.uid || null
                    },
                    // Osemfinále 5
                    {
                        homeTeamIdentifier: '---',
                        awayTeamIdentifier: '---',
                        time: '--:--',
                        hallId: null,
                        categoryId: categoryId,
                        categoryName: categoryName,
                        groupName: null,
                        matchType: 'osemfinále 5',
                        status: 'pending',
                        createdAt: Timestamp.now(),
                        createdBy: userProfileData?.email || 'unknown',
                        createdByUid: userProfileData?.uid || null
                    },
                    // Osemfinále 6
                    {
                        homeTeamIdentifier: '---',
                        awayTeamIdentifier: '---',
                        time: '--:--',
                        hallId: null,
                        categoryId: categoryId,
                        categoryName: categoryName,
                        groupName: null,
                        matchType: 'osemfinále 6',
                        status: 'pending',
                        createdAt: Timestamp.now(),
                        createdBy: userProfileData?.email || 'unknown',
                        createdByUid: userProfileData?.uid || null
                    },
                    // Osemfinále 7
                    {
                        homeTeamIdentifier: '---',
                        awayTeamIdentifier: '---',
                        time: '--:--',
                        hallId: null,
                        categoryId: categoryId,
                        categoryName: categoryName,
                        groupName: null,
                        matchType: 'osemfinále 7',
                        status: 'pending',
                        createdAt: Timestamp.now(),
                        createdBy: userProfileData?.email || 'unknown',
                        createdByUid: userProfileData?.uid || null
                    },
                    // Osemfinále 8
                    {
                        homeTeamIdentifier: '---',
                        awayTeamIdentifier: '---',
                        time: '--:--',
                        hallId: null,
                        categoryId: categoryId,
                        categoryName: categoryName,
                        groupName: null,
                        matchType: 'osemfinále 8',
                        status: 'pending',
                        createdAt: Timestamp.now(),
                        createdBy: userProfileData?.email || 'unknown',
                        createdByUid: userProfileData?.uid || null
                    }
                ];

                // Nájdeme existujúce štvrťfinálové zápasy a aktualizujeme ich identifikátory
                const quarterfinal1 = existingSpiderMatches.find(m => m.matchType === 'štvrťfinále 1');
                const quarterfinal2 = existingSpiderMatches.find(m => m.matchType === 'štvrťfinále 2');
                const quarterfinal3 = existingSpiderMatches.find(m => m.matchType === 'štvrťfinále 3');
                const quarterfinal4 = existingSpiderMatches.find(m => m.matchType === 'štvrťfinále 4');

                if (quarterfinal1) {
                    await updateDoc(doc(window.db, 'matches', quarterfinal1.id), {
                        homeTeamIdentifier: `${categoryWithoutDiacritics} W8F01`,
                        awayTeamIdentifier: `${categoryWithoutDiacritics} W8F02`
                    });
                }

                if (quarterfinal2) {
                    await updateDoc(doc(window.db, 'matches', quarterfinal2.id), {
                        homeTeamIdentifier: `${categoryWithoutDiacritics} W8F03`,
                        awayTeamIdentifier: `${categoryWithoutDiacritics} W8F04`
                    });
                }

                if (quarterfinal3) {
                    await updateDoc(doc(window.db, 'matches', quarterfinal3.id), {
                        homeTeamIdentifier: `${categoryWithoutDiacritics} W8F05`,
                        awayTeamIdentifier: `${categoryWithoutDiacritics} W8F06`
                    });
                }

                if (quarterfinal4) {
                    await updateDoc(doc(window.db, 'matches', quarterfinal4.id), {
                        homeTeamIdentifier: `${categoryWithoutDiacritics} W8F07`,
                        awayTeamIdentifier: `${categoryWithoutDiacritics} W8F08`
                    });
                }
                
                setSpiderLevel(3);
            } else {
                // Štvrté generovanie - šestnásťfinále (16 zápasov)
                matchesToSave = [];
                
                // Vytvoríme 16 šestnásťfinálových zápasov
                for (let i = 1; i <= 16; i++) {
                    matchesToSave.push({
                        homeTeamIdentifier: '---',
                        awayTeamIdentifier: '---',
                        time: '--:--',
                        hallId: null,
                        categoryId: categoryId,
                        categoryName: categoryName,
                        groupName: null,
                        matchType: `šestnásťfinále ${i}`,
                        status: 'pending',
                        createdAt: Timestamp.now(),
                        createdBy: userProfileData?.email || 'unknown',
                        createdByUid: userProfileData?.uid || null
                    });
                }

                // Nájdeme existujúce osemfinálové zápasy a aktualizujeme ich identifikátory
                for (let i = 1; i <= 8; i++) {
                    const eightfinalMatch = existingSpiderMatches.find(m => m.matchType === `osemfinále ${i}`);
                    
                    if (eightfinalMatch) {
                        const homeIdentifier = `W16F${(i * 2) - 1}`;
                        const awayIdentifier = `W16F${i * 2}`;
                        
                        await updateDoc(doc(window.db, 'matches', eightfinalMatch.id), {
                            homeTeamIdentifier: `${categoryWithoutDiacritics} ${homeIdentifier}`,
                            awayTeamIdentifier: `${categoryWithoutDiacritics} ${awayIdentifier}`
                        });
                    }
                }
                
                setSpiderLevel(4);
            }
    
            // Uložíme zápasy do Firebase
            const matchesRef = collection(window.db, 'matches');
            
            const savedMatches = [];
            for (const match of matchesToSave) {
                const docRef = await addDoc(matchesRef, match);
                savedMatches.push({
                    id: docRef.id,
                    ...match,
                    exists: true
                });
            }
    
            // Počkáme chvíľu, aby sa dáta stihli načítať
            setTimeout(() => {
                setGenerationInProgress(false);
            }, 1000);
            
            let message;
            if (!hasSemifinals) {
                message = `Pavúk bol vygenerovaný a uložených ${savedMatches.length} zápasov do databázy`;
            } else if (!hasQuarterfinals) {
                message = `Štvrťfinále bolo vygenerované (${savedMatches.length} zápasov)`;
            } else if (!hasEightfinals) {
                message = `Osemfinále bolo vygenerované (${savedMatches.length} zápasov)`;
            } else {
                message = `Šestnásťfinále bolo vygenerované (${savedMatches.length} zápasov)`;
            }
            
            window.showGlobalNotification(message, 'success');
    
        } catch (error) {
            console.error('Chyba pri generovaní pavúka:', error);
            window.showGlobalNotification('Chyba pri generovaní pavúka: ' + error.message, 'error');
            setGenerationInProgress(false);
        }
    };

    // Funkcia na vytvorenie jednotlivého chýbajúceho zápasu
    const generateSingleMatch = async (matchType) => {
        const categoryId = selectedCategory;
        
        if (!categoryId) {
            window.showGlobalNotification('Vyberte kategóriu', 'error');
            return;
        }
    
        if (!window.db) {
            window.showGlobalNotification('Databáza nie je inicializovaná', 'error');
            return;
        }
    
        if (userProfileData?.role !== 'admin') {
            window.showGlobalNotification('Na generovanie zápasu potrebujete administrátorské práva', 'error');
            return;
        }
    
        setGenerationInProgress(true);
        
        try {
            // Skontrolujeme, či už zápas neexistuje
            const existingMatch = allMatches.find(m => 
                m.categoryId === categoryId && 
                m.matchType === matchType
            );
            
            if (existingMatch) {
                window.showGlobalNotification('Tento zápas už existuje', 'warning');
                return;
            }
    
            // Získanie názvu kategórie
            const category = categories.find(c => c.id === categoryId);
            const categoryName = category ? category.name : `Kategória ${categoryId}`;
            
            // Odstránenie diakritiky z názvu kategórie pre identifikátory
            const categoryWithoutDiacritics = categoryName
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '');
            
            // Príprava dát pre zápas podľa typu
            let matchData = {
                homeTeamIdentifier: '---',
                awayTeamIdentifier: '---',
                time: '--:--',
                hallId: null,
                categoryId: categoryId,
                categoryName: categoryName,
                groupName: null,
                matchType: matchType,
                status: 'pending',
                createdAt: Timestamp.now(),
                createdBy: userProfileData?.email || 'unknown',
                createdByUid: userProfileData?.uid || null
            };
            
            // Pre šestnásťfinálový zápas - nastavíme identifikátory podľa toho, či existujú podradené zápasy
            if (matchType.startsWith('šestnásťfinále')) {
                // Šestnásťfinále nemá podradené zápasy, takže identifikátory zostávajú '---'
            }
            
            // Pre osemfinálový zápas - nastavíme identifikátory podľa existujúcich šestnásťfinálových zápasov
            else if (matchType.startsWith('osemfinále')) {
                const matchNumber = parseInt(matchType.split(' ')[1]);
                
                // Zistíme, ktoré šestnásťfinálové zápasy patria pod tento osemfinálový zápas
                const sixteenfinal1Number = (matchNumber * 2) - 1;
                const sixteenfinal2Number = matchNumber * 2;
                
                // Skontrolujeme, či existujú príslušné šestnásťfinálové zápasy
                const sixteenfinal1Exists = allMatches.some(m => 
                    m.categoryId === selectedCategory && 
                    m.matchType === `šestnásťfinále ${sixteenfinal1Number}`
                );
                
                const sixteenfinal2Exists = allMatches.some(m => 
                    m.categoryId === selectedCategory && 
                    m.matchType === `šestnásťfinále ${sixteenfinal2Number}`
                );
                
                // Ak existuje šestnásťfinále 1, nastavíme homeTeamIdentifier, inak necháme '---'
                if (sixteenfinal1Exists) {
                    matchData.homeTeamIdentifier = `${categoryWithoutDiacritics} W16F${sixteenfinal1Number}`;
                }
                
                // Ak existuje šestnásťfinále 2, nastavíme awayTeamIdentifier, inak necháme '---'
                if (sixteenfinal2Exists) {
                    matchData.awayTeamIdentifier = `${categoryWithoutDiacritics} W16F${sixteenfinal2Number}`;
                }
            }
            
            // Pre štvrťfinálový zápas - nastavíme identifikátory podľa existujúcich osemfinálových zápasov
            else if (matchType.startsWith('štvrťfinále')) {
                const matchNumber = parseInt(matchType.split(' ')[1]);
                
                // Zistíme, ktoré osemfinálové zápasy patria pod tento štvrťfinálový zápas
                let eightfinal1Number, eightfinal2Number;
                let homeIdentifier, awayIdentifier;
                
                if (matchNumber === 1) {
                    eightfinal1Number = 1;
                    eightfinal2Number = 2;
                    homeIdentifier = 'W8F01';
                    awayIdentifier = 'W8F02';
                } else if (matchNumber === 2) {
                    eightfinal1Number = 3;
                    eightfinal2Number = 4;
                    homeIdentifier = 'W8F03';
                    awayIdentifier = 'W8F04';
                } else if (matchNumber === 3) {
                    eightfinal1Number = 5;
                    eightfinal2Number = 6;
                    homeIdentifier = 'W8F05';
                    awayIdentifier = 'W8F06';
                } else if (matchNumber === 4) {
                    eightfinal1Number = 7;
                    eightfinal2Number = 8;
                    homeIdentifier = 'W8F07';
                    awayIdentifier = 'W8F08';
                }
                
                // Skontrolujeme, či existujú príslušné osemfinálové zápasy
                const eightfinal1Exists = allMatches.some(m => 
                    m.categoryId === selectedCategory && 
                    m.matchType === `osemfinále ${eightfinal1Number}`
                );
                
                const eightfinal2Exists = allMatches.some(m => 
                    m.categoryId === selectedCategory && 
                    m.matchType === `osemfinále ${eightfinal2Number}`
                );
                
                // Ak existuje osemfinále 1, nastavíme homeTeamIdentifier, inak necháme '---'
                if (eightfinal1Exists) {
                    matchData.homeTeamIdentifier = `${categoryWithoutDiacritics} ${homeIdentifier}`;
                }
                
                // Ak existuje osemfinále 2, nastavíme awayTeamIdentifier, inak necháme '---'
                if (eightfinal2Exists) {
                    matchData.awayTeamIdentifier = `${categoryWithoutDiacritics} ${awayIdentifier}`;
                }
            }
            
            // Pre semifinálový zápas - nastavíme identifikátory podľa existujúcich štvrťfinálových zápasov
            else if (matchType.startsWith('semifinále')) {
                const matchNumber = parseInt(matchType.split(' ')[1]); // 1 alebo 2
                
                let quarterfinal1Number, quarterfinal2Number;
                let homeIdentifier, awayIdentifier;
                
                if (matchNumber === 1) {
                    quarterfinal1Number = 1;
                    quarterfinal2Number = 2;
                    homeIdentifier = 'WQF01';
                    awayIdentifier = 'WQF02';
                } else if (matchNumber === 2) {
                    quarterfinal1Number = 3;
                    quarterfinal2Number = 4;
                    homeIdentifier = 'WQF03';
                    awayIdentifier = 'WQF04';
                }
                
                // Skontrolujeme, či existujú príslušné štvrťfinálové zápasy
                const quarterfinal1Exists = allMatches.some(m => 
                    m.categoryId === selectedCategory && 
                    m.matchType === `štvrťfinále ${quarterfinal1Number}`
                );
                
                const quarterfinal2Exists = allMatches.some(m => 
                    m.categoryId === selectedCategory && 
                    m.matchType === `štvrťfinále ${quarterfinal2Number}`
                );
                
                // Ak existuje štvrťfinále 1, nastavíme homeTeamIdentifier, inak necháme '---'
                if (quarterfinal1Exists) {
                    matchData.homeTeamIdentifier = `${categoryWithoutDiacritics} ${homeIdentifier}`;
                }
                
                // Ak existuje štvrťfinále 2, nastavíme awayTeamIdentifier, inak necháme '---'
                if (quarterfinal2Exists) {
                    matchData.awayTeamIdentifier = `${categoryWithoutDiacritics} ${awayIdentifier}`;
                }
            }
            
            // Pre finále - nastavíme identifikátory podľa existujúcich semifinálových zápasov
            else if (matchType === 'finále') {
                // Skontrolujeme, či existujú semifinálové zápasy
                const semifinal1Exists = allMatches.some(m => 
                    m.categoryId === selectedCategory && 
                    m.matchType === 'semifinále 1'
                );
                
                const semifinal2Exists = allMatches.some(m => 
                    m.categoryId === selectedCategory && 
                    m.matchType === 'semifinále 2'
                );
                
                // Ak existuje semifinále 1, nastavíme homeTeamIdentifier, inak necháme '---'
                if (semifinal1Exists) {
                    matchData.homeTeamIdentifier = `${categoryWithoutDiacritics} WSF01`;
                }
                
                // Ak existuje semifinále 2, nastavíme awayTeamIdentifier, inak necháme '---'
                if (semifinal2Exists) {
                    matchData.awayTeamIdentifier = `${categoryWithoutDiacritics} WSF02`;
                }
            }
            
            // Pre o 3. miesto - nastavíme identifikátory podľa existujúcich semifinálových zápasov
            else if (matchType === 'o 3. miesto') {
                // Skontrolujeme, či existujú semifinálové zápasy
                const semifinal1Exists = allMatches.some(m => 
                    m.categoryId === selectedCategory && 
                    m.matchType === 'semifinále 1'
                );
                
                const semifinal2Exists = allMatches.some(m => 
                    m.categoryId === selectedCategory && 
                    m.matchType === 'semifinále 2'
                );
                
                // Ak existuje semifinále 1, nastavíme homeTeamIdentifier, inak necháme '---'
                if (semifinal1Exists) {
                    matchData.homeTeamIdentifier = `${categoryWithoutDiacritics} LSF01`;
                }
                
                // Ak existuje semifinále 2, nastavíme awayTeamIdentifier, inak necháme '---'
                if (semifinal2Exists) {
                    matchData.awayTeamIdentifier = `${categoryWithoutDiacritics} LSF02`;
                }
            }
            
            // Uložíme zápas do Firebase
            const matchesRef = collection(window.db, 'matches');
            const docRef = await addDoc(matchesRef, matchData);
            
            // Po úspešnom vytvorení zápasu aktualizujeme nadväzujúce zápasy (o úroveň vyššie)
            const newMatchId = docRef.id;
            
            // Ak sme vytvorili šestnásťfinálový zápas, aktualizujeme príslušný osemfinálový zápas
            if (matchType.startsWith('šestnásťfinále')) {
                // Získame číslo šestnásťfinále (1-16)
                const matchNumber = parseInt(matchType.split(' ')[1]);
                
                // Určíme, ktorý osemfinálový zápas a ktorú pozíciu (domáci/hosť) treba aktualizovať
                const eightfinalNumber = Math.ceil(matchNumber / 2);
                const position = matchNumber % 2 === 1 ? 'home' : 'away';
                const identifierSuffix = `W16F${matchNumber}`;
                
                // Nájdeme príslušný osemfinálový zápas
                const eightfinalMatch = allMatches.find(m => 
                    m.categoryId === selectedCategory && 
                    m.matchType === `osemfinále ${eightfinalNumber}`
                );
                
                if (eightfinalMatch) {
                    // Aktualizujeme príslušný identifikátor
                    const updateData = {};
                    if (position === 'home') {
                        updateData.homeTeamIdentifier = `${categoryWithoutDiacritics} ${identifierSuffix}`;
                    } else {
                        updateData.awayTeamIdentifier = `${categoryWithoutDiacritics} ${identifierSuffix}`;
                    }
                    
                    await updateDoc(doc(window.db, 'matches', eightfinalMatch.id), updateData);
                }
            }
            
            // Ak sme vytvorili osemfinálový zápas, aktualizujeme príslušný štvrťfinálový zápas
            else if (matchType.startsWith('osemfinále')) {
                // Získame číslo osemfinále (1-8)
                const matchNumber = parseInt(matchType.split(' ')[1]);
                
                // Určíme, ktorý štvrťfinálový zápas a ktorú pozíciu (domáci/hosť) treba aktualizovať
                let quarterfinalMatchType = '';
                let position = ''; // 'home' alebo 'away'
                let identifierSuffix = '';
                
                // Mapovanie osemfinále na štvrťfinále
                if (matchNumber === 1 || matchNumber === 2) {
                    quarterfinalMatchType = 'štvrťfinále 1';
                    position = matchNumber === 1 ? 'home' : 'away';
                    identifierSuffix = matchNumber === 1 ? 'W8F01' : 'W8F02';
                } else if (matchNumber === 3 || matchNumber === 4) {
                    quarterfinalMatchType = 'štvrťfinále 2';
                    position = matchNumber === 3 ? 'home' : 'away';
                    identifierSuffix = matchNumber === 3 ? 'W8F03' : 'W8F04';
                } else if (matchNumber === 5 || matchNumber === 6) {
                    quarterfinalMatchType = 'štvrťfinále 3';
                    position = matchNumber === 5 ? 'home' : 'away';
                    identifierSuffix = matchNumber === 5 ? 'W8F05' : 'W8F06';
                } else if (matchNumber === 7 || matchNumber === 8) {
                    quarterfinalMatchType = 'štvrťfinále 4';
                    position = matchNumber === 7 ? 'home' : 'away';
                    identifierSuffix = matchNumber === 7 ? 'W8F07' : 'W8F08';
                }
                
                // Nájdeme príslušný štvrťfinálový zápas
                const quarterfinalMatch = allMatches.find(m => 
                    m.categoryId === selectedCategory && 
                    m.matchType === quarterfinalMatchType
                );
                
                if (quarterfinalMatch) {
                    // Aktualizujeme príslušný identifikátor
                    const updateData = {};
                    if (position === 'home') {
                        updateData.homeTeamIdentifier = `${categoryWithoutDiacritics} ${identifierSuffix}`;
                    } else {
                        updateData.awayTeamIdentifier = `${categoryWithoutDiacritics} ${identifierSuffix}`;
                    }
                    
                    await updateDoc(doc(window.db, 'matches', quarterfinalMatch.id), updateData);
                }
            }
            
            // Ak sme vytvorili štvrťfinálový zápas, aktualizujeme príslušný semifinálový zápas
            else if (matchType.startsWith('štvrťfinále')) {
                // Získame číslo štvrťfinále (1-4)
                const matchNumber = parseInt(matchType.split(' ')[1]);
                
                // Určíme, ktorý semifinálový zápas a ktorú pozíciu treba aktualizovať
                let semifinalMatchType = '';
                let position = '';
                let identifierSuffix = '';
                
                // Mapovanie štvrťfinále na semifinále
                if (matchNumber === 1 || matchNumber === 2) {
                    semifinalMatchType = 'semifinále 1';
                    position = matchNumber === 1 ? 'home' : 'away';
                    identifierSuffix = matchNumber === 1 ? 'WQF01' : 'WQF02';
                } else if (matchNumber === 3 || matchNumber === 4) {
                    semifinalMatchType = 'semifinále 2';
                    position = matchNumber === 3 ? 'home' : 'away';
                    identifierSuffix = matchNumber === 3 ? 'WQF03' : 'WQF04';
                }
                
                // Nájdeme príslušný semifinálový zápas
                const semifinalMatch = allMatches.find(m => 
                    m.categoryId === selectedCategory && 
                    m.matchType === semifinalMatchType
                );
                
                if (semifinalMatch) {
                    // Aktualizujeme príslušný identifikátor
                    const updateData = {};
                    if (position === 'home') {
                        updateData.homeTeamIdentifier = `${categoryWithoutDiacritics} ${identifierSuffix}`;
                    } else {
                        updateData.awayTeamIdentifier = `${categoryWithoutDiacritics} ${identifierSuffix}`;
                    }
                    
                    await updateDoc(doc(window.db, 'matches', semifinalMatch.id), updateData);
                }
            }
            
            // Ak sme vytvorili semifinálový zápas, aktualizujeme finále a o 3. miesto
            else if (matchType.startsWith('semifinále')) {
                const matchNumber = parseInt(matchType.split(' ')[1]); // 1 alebo 2
                
                // Nájdeme finálový zápas
                const finalMatch = allMatches.find(m => 
                    m.categoryId === selectedCategory && 
                    m.matchType === 'finále'
                );
                
                // Nájdeme zápas o 3. miesto
                const thirdPlaceMatch = allMatches.find(m => 
                    m.categoryId === selectedCategory && 
                    m.matchType === 'o 3. miesto'
                );
                
                // Aktualizujeme finále
                if (finalMatch) {
                    if (matchNumber === 1) {
                        // Semifinále 1 ovplyvňuje domáci tím vo finále (WSF01)
                        await updateDoc(doc(window.db, 'matches', finalMatch.id), {
                            homeTeamIdentifier: `${categoryWithoutDiacritics} WSF01`
                        });
                    } else if (matchNumber === 2) {
                        // Semifinále 2 ovplyvňuje hosťovský tím vo finále (WSF02)
                        await updateDoc(doc(window.db, 'matches', finalMatch.id), {
                            awayTeamIdentifier: `${categoryWithoutDiacritics} WSF02`
                        });
                    }
                }
                
                // Aktualizujeme zápas o 3. miesto
                if (thirdPlaceMatch) {
                    if (matchNumber === 1) {
                        // Semifinále 1 ovplyvňuje domáci tím o 3. miesto (LSF01)
                        await updateDoc(doc(window.db, 'matches', thirdPlaceMatch.id), {
                            homeTeamIdentifier: `${categoryWithoutDiacritics} LSF01`
                        });
                    } else if (matchNumber === 2) {
                        // Semifinále 2 ovplyvňuje hosťovský tím o 3. miesto (LSF02)
                        await updateDoc(doc(window.db, 'matches', thirdPlaceMatch.id), {
                            awayTeamIdentifier: `${categoryWithoutDiacritics} LSF02`
                        });
                    }
                }
            }
            
            window.showGlobalNotification(`Zápas ${matchType} bol vygenerovaný`, 'success');
    
        } catch (error) {
            console.error('Chyba pri generovaní zápasu:', error);
            window.showGlobalNotification('Chyba pri generovaní zápasu: ' + error.message, 'error');
        } finally {
            setGenerationInProgress(false);
        }
    };

    // Funkcia na vymazanie pavúkových zápasov pre vybranú kategóriu (po úrovniach)
    const deleteSpiderMatches = async () => {
        const categoryId = selectedCategory;
        
        if (!categoryId) {
            window.showGlobalNotification('Vyberte kategóriu', 'error');
            return;
        }
    
        if (!window.db) {
            window.showGlobalNotification('Databáza nie je inicializovaná', 'error');
            return;
        }
    
        if (userProfileData?.role !== 'admin') {
            window.showGlobalNotification('Na mazanie pavúka potrebujete administrátorské práva', 'error');
            return;
        }
    
        setGenerationInProgress(true);
        
        try {
            // Nájdeme existujúce pavúkové zápasy pre túto kategóriu
            const existingSpiderMatches = allMatches.filter(m => 
                m.categoryId === categoryId && 
                m.matchType && 
                ['finále', 'semifinále 1', 'semifinále 2', 'o 3. miesto', 
                 'štvrťfinále 1', 'štvrťfinále 2', 'štvrťfinále 3', 'štvrťfinále 4',
                 'osemfinále 1', 'osemfinále 2', 'osemfinále 3', 'osemfinále 4',
                 'osemfinále 5', 'osemfinále 6', 'osemfinále 7', 'osemfinále 8',
                 'šestnásťfinále 1', 'šestnásťfinále 2', 'šestnásťfinále 3', 'šestnásťfinále 4',
                 'šestnásťfinále 5', 'šestnásťfinále 6', 'šestnásťfinále 7', 'šestnásťfinále 8',
                 'šestnásťfinále 9', 'šestnásťfinále 10', 'šestnásťfinále 11', 'šestnásťfinále 12',
                 'šestnásťfinále 13', 'šestnásťfinále 14', 'šestnásťfinále 15', 'šestnásťfinále 16'].includes(m.matchType)
            );
            
            if (existingSpiderMatches.length === 0) {
                window.showGlobalNotification('Pre túto kategóriu neexistujú žiadne pavúkové zápasy', 'info');
                return;
            }
    
            // Zistíme, aká je najvyššia úroveň
            const hasSixteenfinals = existingSpiderMatches.some(m => ['šestnásťfinále 1', 'šestnásťfinále 2', 'šestnásťfinále 3', 'šestnásťfinále 4',
                                                                      'šestnásťfinále 5', 'šestnásťfinále 6', 'šestnásťfinále 7', 'šestnásťfinále 8',
                                                                      'šestnásťfinále 9', 'šestnásťfinále 10', 'šestnásťfinále 11', 'šestnásťfinále 12',
                                                                      'šestnásťfinále 13', 'šestnásťfinále 14', 'šestnásťfinále 15', 'šestnásťfinále 16'].includes(m.matchType));
            const hasEightfinals = existingSpiderMatches.some(m => ['osemfinále 1', 'osemfinále 2', 'osemfinále 3', 'osemfinále 4',
                                                                     'osemfinále 5', 'osemfinále 6', 'osemfinále 7', 'osemfinále 8'].includes(m.matchType));
            const hasQuarterfinals = existingSpiderMatches.some(m => ['štvrťfinále 1', 'štvrťfinále 2', 'štvrťfinále 3', 'štvrťfinále 4'].includes(m.matchType));
            
            let matchesToDelete = [];
            let message = '';
            
            if (hasSixteenfinals) {
                // Ak existujú šestnásťfinále, zmažeme len ich
                matchesToDelete = existingSpiderMatches.filter(m => 
                    ['šestnásťfinále 1', 'šestnásťfinále 2', 'šestnásťfinále 3', 'šestnásťfinále 4',
                     'šestnásťfinále 5', 'šestnásťfinále 6', 'šestnásťfinále 7', 'šestnásťfinále 8',
                     'šestnásťfinále 9', 'šestnásťfinále 10', 'šestnásťfinále 11', 'šestnásťfinále 12',
                     'šestnásťfinále 13', 'šestnásťfinále 14', 'šestnásťfinále 15', 'šestnásťfinále 16'].includes(m.matchType)
                );
                
                // Aktualizujeme identifikátory osemfinálových zápasov späť na '---'
                for (let i = 1; i <= 8; i++) {
                    const eightfinalMatch = existingSpiderMatches.find(m => m.matchType === `osemfinále ${i}`);
                    
                    if (eightfinalMatch) {
                        await updateDoc(doc(window.db, 'matches', eightfinalMatch.id), {
                            homeTeamIdentifier: '---',
                            awayTeamIdentifier: '---'
                        });
                    }
                }
                
                setSpiderLevel(3);
                message = `Zmazané šestnásťfinále (${matchesToDelete.length} zápasov)`;
                
            } else if (hasEightfinals) {
                // Ak existujú osemfinále (ale nie šestnásťfinále), zmažeme ich
                matchesToDelete = existingSpiderMatches.filter(m => 
                    ['osemfinále 1', 'osemfinále 2', 'osemfinále 3', 'osemfinále 4',
                     'osemfinále 5', 'osemfinále 6', 'osemfinále 7', 'osemfinále 8'].includes(m.matchType)
                );
                
                // Aktualizujeme identifikátory štvrťfinálových zápasov späť na '---'
                const quarterfinal1 = existingSpiderMatches.find(m => m.matchType === 'štvrťfinále 1');
                const quarterfinal2 = existingSpiderMatches.find(m => m.matchType === 'štvrťfinále 2');
                const quarterfinal3 = existingSpiderMatches.find(m => m.matchType === 'štvrťfinále 3');
                const quarterfinal4 = existingSpiderMatches.find(m => m.matchType === 'štvrťfinále 4');
    
                if (quarterfinal1) {
                    await updateDoc(doc(window.db, 'matches', quarterfinal1.id), {
                        homeTeamIdentifier: '---',
                        awayTeamIdentifier: '---'
                    });
                }
    
                if (quarterfinal2) {
                    await updateDoc(doc(window.db, 'matches', quarterfinal2.id), {
                        homeTeamIdentifier: '---',
                        awayTeamIdentifier: '---'
                    });
                }
    
                if (quarterfinal3) {
                    await updateDoc(doc(window.db, 'matches', quarterfinal3.id), {
                        homeTeamIdentifier: '---',
                        awayTeamIdentifier: '---'
                    });
                }
    
                if (quarterfinal4) {
                    await updateDoc(doc(window.db, 'matches', quarterfinal4.id), {
                        homeTeamIdentifier: '---',
                        awayTeamIdentifier: '---'
                    });
                }
                
                setSpiderLevel(2);
                message = `Zmazané osemfinále (${matchesToDelete.length} zápasov)`;
                
            } else if (hasQuarterfinals) {
                // Ak existujú štvrťfinále (ale nie osemfinále), zmažeme ich
                matchesToDelete = existingSpiderMatches.filter(m => 
                    ['štvrťfinále 1', 'štvrťfinále 2', 'štvrťfinále 3', 'štvrťfinále 4'].includes(m.matchType)
                );
                
                // Aktualizujeme identifikátory semifinálových zápasov späť na '---'
                const semifinal1 = existingSpiderMatches.find(m => m.matchType === 'semifinále 1');
                const semifinal2 = existingSpiderMatches.find(m => m.matchType === 'semifinále 2');
    
                if (semifinal1) {
                    await updateDoc(doc(window.db, 'matches', semifinal1.id), {
                        homeTeamIdentifier: '---',
                        awayTeamIdentifier: '---'
                    });
                }
    
                if (semifinal2) {
                    await updateDoc(doc(window.db, 'matches', semifinal2.id), {
                        homeTeamIdentifier: '---',
                        awayTeamIdentifier: '---'
                    });
                }
                
                setSpiderLevel(1);
                message = `Zmazané štvrťfinále (${matchesToDelete.length} zápasov)`;
                
            } else {
                // Inak zmažeme všetky pavúkové zápasy (semifinále, finále, o 3. miesto)
                matchesToDelete = existingSpiderMatches.filter(m => 
                    ['finále', 'semifinále 1', 'semifinále 2', 'o 3. miesto'].includes(m.matchType)
                );
                
                setSpiderLevel(0);
                setHasSpiderMatches(false);
                message = `Zmazaný celý pavúk (${matchesToDelete.length} zápasov)`;
            }
            
            // Vymažeme vybrané zápasy
            for (const match of matchesToDelete) {
                await deleteDoc(doc(window.db, 'matches', match.id));
            }
    
            window.showGlobalNotification(message, 'success');
    
        } catch (error) {
            console.error('Chyba pri mazaní pavúka:', error);
            window.showGlobalNotification('Chyba pri mazaní pavúka: ' + error.message, 'error');
        } finally {
            setGenerationInProgress(false);
            setIsDeleteMatchesModalOpen(false);
        }
    };

    // Funkcia na kontrolu, či máme skryť panel
    const shouldHidePanel = () => {
        // Ak je selectbox rozbalený, panel neskrývame
        if (isSelectOpen) {
            return false;
        }
        
        // Ináč použijeme štandardnú kontrolu hoveru
        const hoveredElement = document.querySelector(':hover');
        const panel = document.querySelector('[style*="pointer-events: auto"]');
        
        return !(hoveredElement !== null && panel && (hoveredElement === panel || panel.contains(hoveredElement)));
    };

    // Handler pre zmenu kategórie - aktualizuje URL hash a stav
    const handleCategoryChange = (e) => {
        const newCategoryId = e.target.value;
        setSelectedCategory(newCategoryId);
        
        // Aktualizujeme URL hash podľa názvu kategórie
        if (newCategoryId) {
            const category = categories.find(c => c.id === newCategoryId);
            if (category) {
                updateUrlWithCategoryName(category.name);
            }
        } else {
            updateUrlWithCategoryName('');
        }
        
        e.target.blur();
        
        const panel = e.currentTarget.closest('[style*="pointer-events: auto"]');
        if (panel) {
            if (window.spiderPanelTimeout) {
                clearTimeout(window.spiderPanelTimeout);
            }

            window.spiderPanelTimeout = setTimeout(() => {
                if (shouldHidePanel()) {
                    panel.style.opacity = '0';
                }
                window.spiderPanelTimeout = null;
            }, 750);
        }
    };

    // Komponent pre zobrazenie jedného zápasu v pavúkovom zobrazení
    const MatchCell = ({ match, title = '', matchType, userProfileData, generationInProgress, onGenerate, onDelete }) => {
        const [isHovered, setIsHovered] = useState(false);
        const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    
        // Kontrola, či zápas existuje v databáze
        if (!match.exists) {
            // Chýbajúci zápas - sivý čiarkovaný box s možnosťou generovania
            return React.createElement(
                'div',
                { 
                    className: `border-2 border-dashed border-gray-400 rounded-lg p-3 min-w-[220px] transition-all duration-200 ${
                        isHovered && userProfileData?.role === 'admin' && !generationInProgress 
                            ? 'bg-green-50 border-green-500' 
                            : 'bg-gray-100'
                    }`,
                    style: { 
                        zIndex: 10, 
                        position: 'relative',
                        minHeight: '140px',
                        display: 'flex',
                        flexDirection: 'column',
                        cursor: userProfileData?.role === 'admin' ? 'pointer' : 'default'
                    },
                    onMouseEnter: () => {
                        if (userProfileData?.role === 'admin' && !generationInProgress) {
                            setIsHovered(true);
                        }
                    },
                    onMouseLeave: () => {
                        setIsHovered(false);
                    },
                    onClick: () => {
                        if (userProfileData?.role === 'admin' && !generationInProgress) {
                            onGenerate(matchType);
                        }
                    }
                },
                // Nadpis (ak existuje)
                title && React.createElement(
                    'div',
                    { className: `text-sm font-semibold mb-2 pb-1 border-b border-dashed text-center ${
                        isHovered && userProfileData?.role === 'admin' && !generationInProgress 
                            ? 'text-green-700 border-green-300' 
                            : 'text-gray-500 border-gray-300'
                    }` },
                    title
                ),
                // Obsah - buď otáznik alebo tlačidlo +
                React.createElement(
                    'div',
                    { 
                        className: 'flex-grow flex items-center justify-center',
                        style: { minHeight: title ? '80px' : '120px' }
                    },
                    isHovered && userProfileData?.role === 'admin' && !generationInProgress ? (
                        React.createElement(
                            'div',
                            { 
                                className: 'w-12 h-12 rounded-full bg-green-500 flex items-center justify-center shadow-lg transform transition-transform hover:scale-110',
                                style: { animation: 'pulse 2s infinite' }
                            },
                            React.createElement(
                                'span',
                                { 
                                    className: 'text-white text-3xl font-bold',
                                    style: { marginTop: '-4px' } 
                                },
                                '+'
                            )
                        )
                    ) : (
                        React.createElement(
                            'span',
                            { 
                                className: 'text-gray-400',
                                style: { fontSize: '72px', fontWeight: '300', lineHeight: 1 }
                            },
                            '?'
                        )
                    )
                )
            );
        }
    
        // Existujúci zápas - normálne zobrazenie
        const matchDate = match.date ? new Date(match.date) : null;
        const formattedDate = matchDate ? formatDateWithDay(matchDate) : '';
        
        // Použijeme homeTeamIdentifier a awayTeamIdentifier ak existujú, inak homeTeam/awayTeam
        const homeTeam = match.homeTeamIdentifier || match.homeTeam || '---';
        const awayTeam = match.awayTeamIdentifier || match.awayTeam || '---';
        const homeScore = match.homeScore !== undefined ? match.homeScore : '';
        const awayScore = match.awayScore !== undefined ? match.awayScore : '';
        
        // Názov zápasu pre modálne okno
        const matchDisplayName = `${title} - ${homeTeam} vs ${awayTeam}`;
        
        // NOVÁ FUNKCIA: Handler pre kliknutie na "---"
        const handleTeamClick = (teamName) => {
            if (teamName === '---') {
                debugTeamsInCategory();
            }
        };
        
        return React.createElement(
            React.Fragment,
            null,
            React.createElement(
                'div',
                { 
                    className: 'border-2 border-gray-300 rounded-lg p-3 min-w-[220px] bg-white shadow-sm group relative',
                    'data-match-id': match.id,
                    style: { 
                        zIndex: isDeleteModalOpen ? 1 : 10,
                        position: 'relative',
                        backgroundColor: 'white' // Vždy biele pozadie
                    },
                    onMouseEnter: () => setIsHovered(true),
                    onMouseLeave: () => setIsHovered(false)
                },
                // Ikona koša pre adminov (zobrazí sa pri hoveri)
                userProfileData?.role === 'admin' && match.exists && React.createElement(
                    'div',
                    { 
                        className: `absolute -top-2 -right-2 transition-all duration-200 ${
                            isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
                        }`,
                        style: { zIndex: 20 }
                    },
                    React.createElement(
                        'button',
                        {
                            onClick: (e) => {
                                e.stopPropagation();
                                setIsDeleteModalOpen(true);
                            },
                            className: 'w-8 h-8 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow-md hover:shadow-lg transform hover:scale-110 transition-all duration-200',
                            style: { color: 'white' }, // Pridaný inline style pre istotu
                            title: 'Odstrániť zápas'
                        },
                        React.createElement('i', { 
                            className: 'fa-solid fa-trash-can text-sm',
                            style: { color: 'white' } // Pridaný inline style pre ikonu
                        })
                    )
                ),
                // Nadpis (ak existuje)
                title && React.createElement(
                    'div',
                    { className: 'text-sm font-semibold text-center mb-2 pb-1 border-b border-gray-200' },
                    title
                ),
                // Domáci tím
                React.createElement(
                    'div',
                    { 
                        className: `flex justify-between items-center py-2 border-b border-gray-100 ${homeTeam === '---' ? 'cursor-pointer hover:bg-gray-50' : ''}`,
                        onClick: () => handleTeamClick(homeTeam)
                    },
                    React.createElement('span', { className: 'text-sm font-medium' }, homeTeam),
                    homeScore !== '' && React.createElement('span', { className: 'font-mono font-bold text-lg' }, homeScore)
                ),
                // Hosťovský tím
                React.createElement(
                    'div',
                    { 
                        className: `flex justify-between items-center py-2 ${awayTeam === '---' ? 'cursor-pointer hover:bg-gray-50' : ''}`,
                        onClick: () => handleTeamClick(awayTeam)
                    },
                    React.createElement('span', { className: 'text-sm font-medium' }, awayTeam),
                    awayScore !== '' && React.createElement('span', { className: 'font-mono font-bold text-lg' }, awayScore)
                ),
                // Dátum (ak existuje)
                formattedDate && React.createElement(
                    'div',
                    { className: 'text-xs text-gray-500 mt-2 text-center border-t border-gray-100 pt-2' },
                    React.createElement('i', { className: 'fa-regular fa-calendar mr-1' }),
                    formattedDate
                )
            ),
            
            // Modálne okno pre potvrdenie zmazania konkrétneho zápasu - použijeme Portal
            isDeleteModalOpen && createPortal(
                React.createElement(
                    'div',
                    {
                        className: 'fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-center justify-center',
                        onClick: () => setIsDeleteModalOpen(false),
                        style: { backdropFilter: 'blur(4px)' }
                    },
                    React.createElement(
                        'div',
                        {
                            className: 'bg-white rounded-xl p-6 w-full max-w-md shadow-2xl',
                            onClick: (e) => e.stopPropagation()
                        },
                        React.createElement(
                            'div',
                            { className: 'flex justify-between items-center mb-4' },
                            React.createElement(
                                'h3',
                                { className: 'text-xl font-semibold text-gray-800' },
                                'Potvrdenie zmazania zápasu'
                            ),
                            React.createElement(
                                'button',
                                {
                                    onClick: () => setIsDeleteModalOpen(false),
                                    className: 'text-gray-400 hover:text-gray-600 transition-colors'
                                },
                                React.createElement('i', { className: 'fa-solid fa-times text-2xl' })
                            )
                        ),
                        
                        React.createElement(
                            'p',
                            { className: 'text-gray-600 mb-2' },
                            'Naozaj chcete zmazať tento zápas?'
                        ),
                        
                        React.createElement(
                            'div',
                            { className: 'bg-gray-50 p-4 rounded-lg mb-6 border border-gray-200' },
                            React.createElement(
                                'p',
                                { className: 'font-medium text-gray-800 mb-1' },
                                matchDisplayName
                            ),
                            React.createElement(
                                'p',
                                { className: 'text-sm text-gray-500' },
                                `Typ: ${matchType}`
                            ),
                            match.date && React.createElement(
                                'p',
                                { className: 'text-sm text-gray-500' },
                                `Dátum: ${formattedDate}`
                            )
                        ),
                        
                        React.createElement(
                            'div',
                            { className: 'flex justify-end gap-2' },
                            React.createElement(
                                'button',
                                {
                                    onClick: () => setIsDeleteModalOpen(false),
                                    className: 'px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors'
                                },
                                'Zrušiť'
                            ),
                            React.createElement(
                                'button',
                                {
                                    onClick: () => {
                                        onDelete(match.id, matchType);
                                        setIsDeleteModalOpen(false);
                                    },
                                    disabled: generationInProgress,
                                    className: `px-4 py-2 text-sm rounded-lg transition-colors ${
                                        generationInProgress
                                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                            : 'bg-red-600 hover:bg-red-700 text-white'
                                    }`
                                },
                                'Zmazať zápas'
                            )
                        )
                    )
                ),
                document.body // Vykreslíme modálne okno priamo do body
            )
        );
    };

    const sortedCategories = React.useMemo(() => {
        return [...categories].sort((a, b) => a.name.localeCompare(b.name));
    }, [categories]);

    return React.createElement(
        React.Fragment,
        null,
        // Hlavička s ovládacími prvkami - opravená pre hover
        React.createElement(
            'div',
            { 
                className: 'fixed top-12 left-0 right-0 z-40 flex flex-col items-center pt-4',
                style: { pointerEvents: 'none' }
            },
            React.createElement(
                'div',
                { 
                    className: 'group relative',
                    style: { pointerEvents: 'auto' }
                },
                // Hlavný panel s ovládacími prvkami
                React.createElement(
                    'div',
                    { 
                        className: `transition-opacity duration-300 ease-in-out opacity-0 group-hover:opacity-100 group-focus-within:opacity-100`,
                        style: { 
                            pointerEvents: 'auto',
                            transition: 'opacity 300ms ease-in-out'
                        },
                        onMouseLeave: (e) => {
                            const panel = e.currentTarget.closest('[style*="pointer-events: auto"]');
                            if (panel) {
                                if (window.spiderPanelTimeout) {
                                    clearTimeout(window.spiderPanelTimeout);
                                }
                                
                                window.spiderPanelTimeout = setTimeout(() => {
                                    if (shouldHidePanel()) {
                                        panel.style.opacity = '0';
                                    }
                                    window.spiderPanelTimeout = null;
                                }, 750);
                            }
                        },
                        onMouseEnter: (e) => {
                            if (window.spiderPanelTimeout) {
                                clearTimeout(window.spiderPanelTimeout);
                                window.spiderPanelTimeout = null;
                            }
                            e.currentTarget.style.opacity = '1';
                        }
                    },
                    React.createElement(
                        'div',
                        { className: 'flex flex-wrap items-center justify-center gap-2 bg-white/95 backdrop-blur-sm p-3 rounded-xl shadow-lg border border-gray-200' },
                        
                        React.createElement(
                            'div',
                            { className: 'flex items-center gap-1' },
                            React.createElement('label', { className: 'text-sm font-medium text-gray-700 whitespace-nowrap' }, 'Kategória:'),
                            React.createElement(
                                'select',
                                {
                                    value: selectedCategory,
                                    onChange: handleCategoryChange,
                                    onMouseEnter: (e) => {
                                        if (window.spiderPanelTimeout) {
                                            clearTimeout(window.spiderPanelTimeout);
                                            window.spiderPanelTimeout = null;
                                        }
                                        
                                        const panel = e.currentTarget.closest('[style*="pointer-events: auto"]');
                                        if (panel) {
                                            panel.style.opacity = '1';
                                        }
                                    },
                                    onMouseLeave: (e) => {
                                        const panel = e.currentTarget.closest('[style*="pointer-events: auto"]');
                                        if (panel) {
                                            if (window.spiderPanelTimeout) {
                                                clearTimeout(window.spiderPanelTimeout);
                                            }
                                            
                                            window.spiderPanelTimeout = setTimeout(() => {
                                                if (shouldHidePanel()) {
                                                    panel.style.opacity = '0';
                                                }
                                                window.spiderPanelTimeout = null;
                                            }, 750);
                                        }
                                    },
                                    onFocus: () => setIsSelectOpen(true),
                                    onBlur: () => setIsSelectOpen(false),
                                    onMouseDown: () => setIsSelectOpen(true),
                                    className: 'px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-black min-w-[180px]'
                                },
                                React.createElement('option', { value: '' }, '-- Vyberte kategóriu --'),
                                sortedCategories.map(cat => {
                                    const spiderMatches = allMatches.filter(m => 
                                        m.categoryId === cat.id && 
                                        m.matchType && 
                                        ['finále', 'semifinále 1', 'semifinále 2', 'o 3. miesto', 
                                         'štvrťfinále 1', 'štvrťfinále 2', 'štvrťfinále 3', 'štvrťfinále 4',
                                         'osemfinále 1', 'osemfinále 2', 'osemfinále 3', 'osemfinále 4',
                                         'osemfinále 5', 'osemfinále 6', 'osemfinále 7', 'osemfinále 8',
                                         'šestnásťfinále 1', 'šestnásťfinále 2', 'šestnásťfinále 3', 'šestnásťfinále 4',
                                         'šestnásťfinále 5', 'šestnásťfinále 6', 'šestnásťfinále 7', 'šestnásťfinále 8',
                                         'šestnásťfinále 9', 'šestnásťfinále 10', 'šestnásťfinále 11', 'šestnásťfinále 12',
                                         'šestnásťfinále 13', 'šestnásťfinále 14', 'šestnásťfinále 15', 'šestnásťfinále 16'].includes(m.matchType)
                                    ).length;
                                    
                                    const level = spiderMatches >= 28 ? 4 : (spiderMatches >= 12 ? 3 : (spiderMatches >= 8 ? 2 : (spiderMatches >= 4 ? 1 : 0)));
                                    
                                    return React.createElement('option', { 
                                        key: cat.id, 
                                        value: cat.id 
                                    }, `${cat.name} (úroveň ${level})`);
                                })
                            )
                        ),
                        
                        React.createElement(
                            'button',
                            {
                                onClick: () => {
                                    const url = new URL(window.location.href);
                                    url.searchParams.set('view', 'matches');
                                    window.location.href = url.toString();
                                },
                                onMouseEnter: (e) => {
                                    if (window.spiderPanelTimeout) {
                                        clearTimeout(window.spiderPanelTimeout);
                                        window.spiderPanelTimeout = null;
                                    }
                                    
                                    const panel = e.currentTarget.closest('[style*="pointer-events: auto"]');
                                    if (panel) {
                                        panel.style.opacity = '1';
                                    }
                                },
                                onMouseLeave: (e) => {
                                    const panel = e.currentTarget.closest('[style*="pointer-events: auto"]');
                                    if (panel) {
                                        if (window.spiderPanelTimeout) {
                                            clearTimeout(window.spiderPanelTimeout);
                                        }
        
                                        window.spiderPanelTimeout = setTimeout(() => {
                                            if (shouldHidePanel()) {
                                                panel.style.opacity = '0';
                                            }
                                            window.spiderPanelTimeout = null;
                                        }, 750);
                                    }
                                },
                                className: 'px-4 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors whitespace-nowrap',
                                title: 'Prejsť do zobrazenia zápasov'
                            },
                            'Zápasy'
                        )
                    )
                )
            )
        ),
                
        // NOVÉ: Rozdelené kruhové tlačidlo v pravom dolnom rohu - TEXT V POLOVICIACH
        React.createElement(
            'div',
            { 
                className: 'fixed bottom-8 right-8 z-50',
                style: { 
                    filter: 'drop-shadow(0 10px 15px rgba(0,0,0,0.2))',
                    width: '64px',
                    height: '64px'
                }
            },
            // Hlavný kruhový kontajner
            React.createElement(
                'div',
                {
                    className: 'relative w-full h-full rounded-full overflow-hidden',
                },
                // Prvá polovica - Zelená (Generovať) - s textom "+" v ľavom hornom rohu
                React.createElement(
                    'button',
                    { 
                        className: `absolute inset-0 transition-all duration-200 outline-none ring-0 focus:outline-none focus:ring-0 ${
                            generationInProgress || !selectedCategory 
                                ? 'bg-white cursor-not-allowed' 
                                : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700'
                        }`,
                        style: { 
                            clipPath: 'polygon(0 0, 100% 0, 0 100%)',
                        },
                        onClick: generateSpider,
                        disabled: generationInProgress || !selectedCategory,
                        title: !selectedCategory ? 'Najprv vyberte kategóriu' : 
                               (spiderLevel === 1 ? 'Generovať štvrťfinále' : 
                                spiderLevel === 2 ? 'Generovať osemfinále' : 
                                spiderLevel === 3 ? 'Generovať šestnásťfinále' : 
                                'Generovať pavúka')
                    },
                    React.createElement(
                        'div',
                        {
                            style: {
                                position: 'absolute',
                                inset: 0,
                                boxShadow: !selectedCategory && !generationInProgress ? 'inset 0 0 0 2px rgb(34 197 94)' : 'none',
                                borderRadius: '50%',
                                pointerEvents: 'none'
                            }
                        }
                    ),
                    React.createElement(
                        'span',
                        {
                            style: {
                                position: 'absolute',
                                top: '6px',
                                left: '12px',
                                fontSize: '28px',
                                fontWeight: 'bold',
                                lineHeight: 1,
                                color: !selectedCategory || generationInProgress ? 'rgb(34 197 94)' : 'white',
                                zIndex: !selectedCategory && !generationInProgress ? 22 : 'auto'
                            }
                        },
                        '+'
                    )
                ),
                // Druhá polovica - Červená (Zmazať) - s textom "-" v pravom dolnom rohu
                React.createElement(
                    'button',
                    { 
                        className: `absolute inset-0 transition-all duration-200 outline-none ring-0 focus:outline-none focus:ring-0 ${
                            generationInProgress || !selectedCategory 
                                ? 'bg-white cursor-not-allowed' 
                                : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
                        }`,
                        style: { 
                            clipPath: 'polygon(100% 0, 100% 100%, 0 100%)',
                        },
                        onClick: () => {
                            if (selectedCategory && !generationInProgress) {
                                setIsDeleteMatchesModalOpen(true);
                            }
                        },
                        disabled: generationInProgress || !selectedCategory,
                        title: !selectedCategory ? 'Najprv vyberte kategóriu' : 'Zmazať pavúka'
                    },
                    React.createElement(
                        'div',
                        {
                            style: {
                                position: 'absolute',
                                inset: 0,
                                boxShadow: !selectedCategory && !generationInProgress ? 'inset 0 0 0 2px rgb(239 68 68)' : 'none',
                                borderRadius: '50%',
                                pointerEvents: 'none'
                            }
                        }
                    ),
                    React.createElement(
                        'span',
                        {
                            style: {
                                position: 'absolute',
                                bottom: '10px',
                                right: '12px',
                                fontSize: '28px',
                                fontWeight: 'bold',
                                lineHeight: 1,
                                color: !selectedCategory || generationInProgress ? 'rgb(239 68 68)' : 'white'
                            }
                        },
                        '-'
                    ),
                    // Pridanie dvoch šikmých čiar pre zablokovaný stav
                    !selectedCategory && !generationInProgress && React.createElement(
                        React.Fragment,
                        null,
                        // Zelená čiara
                        React.createElement('div', {
                            style: {
                                position: 'absolute',
                                top: '0px',
                                right: '0px',
                                width: '100%',
                                height: '100%',
                                background: 'linear-gradient(135deg, transparent calc(50% - 3px), rgb(34 197 94) calc(50% - 2px), rgb(34 197 94) calc(50% + 2px), transparent calc(50% + 2px))',
                                pointerEvents: 'none',
                                transform: 'rotate(180deg)',
                                transformOrigin: 'center',
                                zIndex: 50
                            }
                        }),
                        // Červená čiara
                        React.createElement('div', {
                            style: {
                                position: 'absolute',
                                top: '2px',
                                right: '-2px',
                                width: '100%',
                                height: '100%',
                                background: 'linear-gradient(135deg, transparent calc(50% - 2px), rgb(239 68 68) calc(50% - 2px), rgb(239 68 68) calc(50% + 2px), transparent calc(50% + 2px))',
                                pointerEvents: 'none',
                                transform: 'rotate(180deg)',
                                transformOrigin: 'center',
                                zIndex: 49
                            }
                        })
                    )
                )
            )
        ),

        // Modálne okno pre potvrdenie mazania
        isDeleteMatchesModalOpen && React.createElement(
            'div',
            {
                className: 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center',
                onClick: () => setIsDeleteMatchesModalOpen(false),
                style: { backdropFilter: 'blur(4px)' }
            },
            React.createElement(
                'div',
                {
                    className: 'bg-white rounded-xl p-6 w-full max-w-md shadow-2xl',
                    onClick: (e) => e.stopPropagation()
                },
                React.createElement(
                    'div',
                    { className: 'flex justify-between items-center mb-4' },
                    React.createElement(
                        'h3',
                        { className: 'text-xl font-semibold text-gray-800' },
                        'Potvrdenie zmazania'
                    ),
                    React.createElement(
                        'button',
                        {
                            onClick: () => setIsDeleteMatchesModalOpen(false),
                            className: 'text-gray-400 hover:text-gray-600 transition-colors'
                        },
                        React.createElement('i', { className: 'fa-solid fa-times text-2xl' })
                    )
                ),
                
                // Zistenie aktuálnej úrovne pre zobrazenie konkrétnej správy
                (() => {
                    const existingSpiderMatches = allMatches.filter(m => 
                        m.categoryId === selectedCategory && 
                        m.matchType && 
                        ['finále', 'semifinále 1', 'semifinále 2', 'o 3. miesto', 
                         'štvrťfinále 1', 'štvrťfinále 2', 'štvrťfinále 3', 'štvrťfinále 4',
                         'osemfinále 1', 'osemfinále 2', 'osemfinále 3', 'osemfinále 4',
                         'osemfinále 5', 'osemfinále 6', 'osemfinále 7', 'osemfinále 8',
                         'šestnásťfinále 1', 'šestnásťfinále 2', 'šestnásťfinále 3', 'šestnásťfinále 4',
                         'šestnásťfinále 5', 'šestnásťfinále 6', 'šestnásťfinále 7', 'šestnásťfinále 8',
                         'šestnásťfinále 9', 'šestnásťfinále 10', 'šestnásťfinále 11', 'šestnásťfinále 12',
                         'šestnásťfinále 13', 'šestnásťfinále 14', 'šestnásťfinále 15', 'šestnásťfinále 16'].includes(m.matchType)
                    );
                    
                    const hasSixteenfinals = existingSpiderMatches.some(m => 
                        ['šestnásťfinále 1', 'šestnásťfinále 2', 'šestnásťfinále 3', 'šestnásťfinále 4',
                         'šestnásťfinále 5', 'šestnásťfinále 6', 'šestnásťfinále 7', 'šestnásťfinále 8',
                         'šestnásťfinále 9', 'šestnásťfinále 10', 'šestnásťfinále 11', 'šestnásťfinále 12',
                         'šestnásťfinále 13', 'šestnásťfinále 14', 'šestnásťfinále 15', 'šestnásťfinále 16'].includes(m.matchType)
                    );
                    const hasEightfinals = existingSpiderMatches.some(m => 
                        ['osemfinále 1', 'osemfinále 2', 'osemfinále 3', 'osemfinále 4',
                         'osemfinále 5', 'osemfinále 6', 'osemfinále 7', 'osemfinále 8'].includes(m.matchType)
                    );
                    const hasQuarterfinals = existingSpiderMatches.some(m => 
                        ['štvrťfinále 1', 'štvrťfinále 2', 'štvrťfinále 3', 'štvrťfinále 4'].includes(m.matchType)
                    );
                    
                    let deleteMessage = '';
                    let deleteCount = 0;
                    
                    if (hasSixteenfinals) {
                        deleteCount = existingSpiderMatches.filter(m => 
                            ['šestnásťfinále 1', 'šestnásťfinále 2', 'šestnásťfinále 3', 'šestnásťfinále 4',
                             'šestnásťfinále 5', 'šestnásťfinále 6', 'šestnásťfinále 7', 'šestnásťfinále 8',
                             'šestnásťfinále 9', 'šestnásťfinále 10', 'šestnásťfinále 11', 'šestnásťfinále 12',
                             'šestnásťfinále 13', 'šestnásťfinále 14', 'šestnásťfinále 15', 'šestnásťfinále 16'].includes(m.matchType)
                        ).length;
                        deleteMessage = `Naozaj chcete zmazať všetky šestnásťfinálové zápasy (${deleteCount}) pre kategóriu "${categories.find(c => c.id === selectedCategory)?.name || selectedCategory}"?`;
                    } else if (hasEightfinals) {
                        deleteCount = existingSpiderMatches.filter(m => 
                            ['osemfinále 1', 'osemfinále 2', 'osemfinále 3', 'osemfinále 4',
                             'osemfinále 5', 'osemfinále 6', 'osemfinále 7', 'osemfinále 8'].includes(m.matchType)
                        ).length;
                        deleteMessage = `Naozaj chcete zmazať všetky osemfinálové zápasy (${deleteCount}) pre kategóriu "${categories.find(c => c.id === selectedCategory)?.name || selectedCategory}"?`;
                    } else if (hasQuarterfinals) {
                        deleteCount = existingSpiderMatches.filter(m => 
                            ['štvrťfinále 1', 'štvrťfinále 2', 'štvrťfinále 3', 'štvrťfinále 4'].includes(m.matchType)
                        ).length;
                        deleteMessage = `Naozaj chcete zmazať všetky štvrťfinálové zápasy (${deleteCount}) pre kategóriu "${categories.find(c => c.id === selectedCategory)?.name || selectedCategory}"?`;
                    } else {
                        deleteCount = existingSpiderMatches.filter(m => 
                            ['finále', 'semifinále 1', 'semifinále 2', 'o 3. miesto'].includes(m.matchType)
                        ).length;
                        deleteMessage = `Naozaj chcete zmazať celý pavúk (${deleteCount} zápasov: finále, semifinále a o 3. miesto) pre kategóriu "${categories.find(c => c.id === selectedCategory)?.name || selectedCategory}"?`;
                    }
                    
                    return React.createElement(
                        'p',
                        { className: 'text-gray-600 mb-6' },
                        deleteMessage
                    );
                })(),
                
                React.createElement(
                    'div',
                    { className: 'flex justify-end gap-2' },
                    React.createElement(
                        'button',
                        {
                            onClick: () => setIsDeleteMatchesModalOpen(false),
                            className: 'px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors'
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            onClick: deleteSpiderMatches,
                            disabled: generationInProgress,
                            className: `px-4 py-2 text-sm rounded-lg transition-colors ${
                                generationInProgress
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    : 'bg-red-600 hover:bg-red-700 text-white'
                            }`
                        },
                        generationInProgress ? 'Zmazať' : 'Zmazať'
                    )
                )
            )
        ),

        // Obsah - pavúková tabuľka (s tabuľkou)
        React.createElement(
            'div',
            { className: 'flex-grow flex justify-center items-start w-full pt-24 pb-20' },
            React.createElement(
                'div',
                { 
                    className: 'bg-white p-8 rounded-xl shadow-lg overflow-x-auto',
                    style: { 
                        width: '100%', 
                        maxWidth: spiderLevel === 4 ? `${7 * (240 + 24 + 4)}px` : 
                                    spiderLevel === 3 ? `${5 * (240 + 24 + 4)}px` : 
                                      (spiderLevel === 2 ? `${3 * (260 + 24 + 4)}px` : 
                                                        `${2 * (280 + 24 + 4)}px`),
                    }
                },
                
                !selectedCategory ? (
                    React.createElement(
                        'div',
                        { className: 'text-center py-16 text-gray-500' },
                        React.createElement('i', { className: 'fa-solid fa-sitemap text-6xl mb-4 opacity-30' }),
                        React.createElement('h2', { className: 'text-2xl font-semibold mb-2' }, 'Pavúk play-off'),
                        React.createElement('p', { className: 'text-lg' }, 'Vyberte kategóriu pre zobrazenie pavúka')
                    )
                ) : !hasSpiderMatches ? (
                    React.createElement(
                        'div',
                        { className: 'text-center py-16 text-gray-500' },
                        React.createElement('i', { className: 'fa-solid fa-sitemap text-6xl mb-4 opacity-30' }),
                        React.createElement('h2', { className: 'text-2xl font-semibold mb-2' }, 'Pavúk play-off'),
                        React.createElement('p', { className: 'text-lg' }, 'Pre túto kategóriu neexistujú žiadne pavúkové zápasy. Kliknite na zelenú polovicu tlačidla "+" pre vygenerovanie pavúka.')
                    )
                ) : !spiderData ? (
                    React.createElement(
                        'div',
                        { className: 'text-center py-16 text-gray-500' },
                        React.createElement('i', { className: 'fa-solid fa-sitemap text-6xl mb-4 opacity-30' }),
                        React.createElement('h2', { className: 'text-2xl font-semibold mb-2' }, 'Pavúk play-off'),
                        React.createElement('p', { className: 'text-lg' }, 'Načítavam dáta...')
                    )
                ) : (
                    React.createElement(
                        'div',
                        { 
                            className: 'flex flex-col items-center',
                            style: { 
                                minHeight: '700px',
                                padding: '20px'
                            }
                        },
                        
                        // Nadpis
                        React.createElement(
                            'h2',
                            { 
                                className: 'text-2xl font-bold mb-12 text-gray-800',
                            },
                            `Play-off ${spiderLevel === 4 ? '(šestnásťfinále)' : (spiderLevel === 3 ? '(osemfinále)' : (spiderLevel === 2 ? '(štvrťfinále)' : ''))} - ${categories.find(c => c.id === selectedCategory)?.name || selectedCategory}`
                        ),
                        
                        // Tabuľka pre pavúka - s orámovaním každej bunky
                        React.createElement(
                            'table',
                            {
                                style: {
                                    borderCollapse: 'collapse',
                                    width: '100%',
                                    tableLayout: 'fixed',
                                    border: '0px solid #d1d5db'
                                }
                            },
                            
                            // Vytvorenie tela tabuľky
                            React.createElement(
                                'tbody',
                                null,
                                
                                // ===== ÚROVEŇ 1 (len semifinále a finále) =====
                                spiderLevel === 1 && React.createElement(
                                    React.Fragment,
                                    null,
                                    
                                    // PRVÝ RIADOK - Finále (zabezpečený horizontálne) - so zvislou čiarou nadol
                                    React.createElement(
                                        'tr',
                                        { style: { height: '150px' } },
                                        React.createElement(
                                            'td',
                                            { 
                                                colSpan: 2,
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.final, 
                                                    title: 'Finále',
                                                    matchType: 'finále',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Zvislá čiara od stredu bunky do spodného okraja
                                            React.createElement('div', { 
                                                style: {
                                                    position: 'absolute',
                                                    width: '2px',
                                                    backgroundColor: '#9ca3af',
                                                    left: '50%',
                                                    top: '50%',
                                                    bottom: 0,
                                                    transform: 'translateX(-50%)',
                                                    zIndex: 5,
                                                    pointerEvents: 'none'
                                                }
                                            })
                                        )
                                    ),
                                                                        
                                    React.createElement(
                                        'tr',
                                        { style: { height: '150px' } },
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '50%',
                                                    border: '0px solid #d1d5db',
                                                    borderRight: '2px solid #9ca3af', // Zvislé orámovanie medzi bunkami
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.semiFinals[0], 
                                                    title: 'Semifinále 1',
                                                    matchType: 'semifinále 1',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Vodorovná čiara z ľavej bunky doprava (od stredu)
                                            React.createElement('div', { className: 'spider-line-horizontal spider-line-right' })
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '50%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.semiFinals[1], 
                                                    title: 'Semifinále 2',
                                                    matchType: 'semifinále 2',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Vodorovná čiara z pravej bunky doľava (od stredu)
                                            React.createElement('div', { className: 'spider-line-horizontal spider-line-left' })
                                        )
                                    ),
                                    
                                    // TRETÍ RIADOK - O 3. miesto (zabezpečený horizontálne) - so zvislou čiarou nahor
                                    React.createElement(
                                        'tr',
                                        { style: { height: '150px' } },
                                        React.createElement(
                                            'td',
                                            { 
                                                colSpan: 2,
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.thirdPlace, 
                                                    title: 'O 3. miesto',
                                                    matchType: 'o 3. miesto',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Zvislá čiara od stredu bunky do horného okraja
                                            React.createElement('div', { className: 'spider-line-vertical spider-line-vertical-top' })
                                        )
                                    )
                                ),
                                
                                // ===== ÚROVEŇ 2 (so štvrťfinále) =====
                                spiderLevel === 2 && React.createElement(
                                    React.Fragment,
                                    null,
                                    
                                    // PRVÝ RIADOK - QF1, Finále, QF3
                                    React.createElement(
                                        'tr',
                                        { style: { height: '150px' } },
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '33.33%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.quarterFinals[0], 
                                                    title: 'Štvrťfinále 1',
                                                    matchType: 'štvrťfinále 1',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // V ľavej hornej bunke vodorovná čiara od stredu doprava
                                            React.createElement('div', { className: 'spider-line-horizontal spider-line-right' }),
                                            
                                            // Pravé orámovanie od stredu výšky po pravý dolný roh
                                            React.createElement('div', { 
                                                style: {
                                                    position: 'absolute',
                                                    width: '2px',
                                                    backgroundColor: '#9ca3af',
                                                    right: 0,
                                                    top: '50%',
                                                    bottom: 0,
                                                    zIndex: 5,
                                                    pointerEvents: 'none'
                                                }
                                            })
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '33.33%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.final, 
                                                    title: 'Finále',
                                                    matchType: 'finále',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // V hornej prostrednej bunke zvislá čiara od stredu po spodný okraj
                                            React.createElement('div', { 
                                                style: {
                                                    position: 'absolute',
                                                    width: '2px',
                                                    backgroundColor: '#9ca3af',
                                                    left: '50%',
                                                    top: '50%',
                                                    bottom: 0,
                                                    transform: 'translateX(-50%)',
                                                    zIndex: 5,
                                                    pointerEvents: 'none'
                                                }
                                            })
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '33.33%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.quarterFinals[2], 
                                                    title: 'Štvrťfinále 3',
                                                    matchType: 'štvrťfinále 3',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // V pravej hornej bunke vodorovná čiara od stredu doľava
                                            React.createElement('div', { className: 'spider-line-horizontal spider-line-left' }),
                                            
                                            // Ľavé orámovanie od stredu výšky po ľavý dolný roh
                                            React.createElement('div', { 
                                                style: {
                                                    position: 'absolute',
                                                    width: '2px',
                                                    backgroundColor: '#9ca3af',
                                                    left: 0,
                                                    top: '50%',
                                                    bottom: 0,
                                                    zIndex: 5,
                                                    pointerEvents: 'none'
                                                }
                                            })
                                        )
                                    ),
                                    
                                    // DRUHÝ RIADOK - VŠETKY TRI STĹPCE ZLÚČENÉ a rozdelené na dva rovnaké
                                    React.createElement(
                                        'tr',
                                        { style: { height: '150px' } },
                                        React.createElement(
                                            'td',
                                            { 
                                                colSpan: 3,
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { 
                                                    style: { 
                                                        display: 'flex',
                                                        justifyContent: 'center',
                                                        alignItems: 'center',
                                                        width: '100%',
                                                        gap: '20%',
                                                        position: 'relative',
                                                        zIndex: 10
                                                    }
                                                },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.semiFinals[0], 
                                                    title: 'Semifinále 1',
                                                    matchType: 'semifinále 1',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                }),
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.semiFinals[1], 
                                                    title: 'Semifinále 2',
                                                    matchType: 'semifinále 2',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            
                                            // Zvislá čiara v strede na celú výšku bunky
                                            React.createElement('div', { 
                                                className: 'spider-line-vertical',
                                                style: { 
                                                    left: '50%',
                                                    height: '100%',
                                                    top: 0,
                                                    transform: 'translateX(-50%)'
                                                }
                                            }),
                                            
                                            // Zvislá čiara na 1/3 od ľavého okraja (33.333%)
                                            React.createElement('div', { 
                                                className: 'spider-line-vertical',
                                                style: { 
                                                    left: '33.33333%',
                                                    height: '100%',
                                                    top: 0,
                                                    transform: 'translateX(-50%) translateX(-1px)'
                                                }
                                            }),
                                            
                                            // Zvislá čiara na 1/3 od pravého okraja (66.66667% od ľavého okraja)
                                            React.createElement('div', { 
                                                className: 'spider-line-vertical',
                                                style: { 
                                                    left: '66.66667%',
                                                    height: '100%',
                                                    top: 0,
                                                    transform: 'translateX(-50%) translateX(1px)'
                                                }
                                            }),
                                            
                                            // Vodorovná čiara v strede od 33.33% do 66.67%
                                            React.createElement('div', { 
                                                style: {
                                                    position: 'absolute',
                                                    height: '2px',
                                                    backgroundColor: '#9ca3af',
                                                    left: '33.33333%',
                                                    width: '33.33334%',
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    zIndex: 5,
                                                    pointerEvents: 'none'
                                                }
                                            }),
                                            
                                            // Zvislé čiary od 1/3 do 2/3 (iba v hornej a dolnej polovici)
                                            React.createElement('div', { 
                                                style: {
                                                    position: 'absolute',
                                                    width: '2px',
                                                    backgroundColor: '#9ca3af',
                                                    left: '33.33333%',
                                                    top: '25%',
                                                    height: '50%',
                                                    transform: 'translateX(-50%)',
                                                    zIndex: 5,
                                                    pointerEvents: 'none'
                                                }
                                            }),
                                            React.createElement('div', { 
                                                style: {
                                                    position: 'absolute',
                                                    width: '2px',
                                                    backgroundColor: '#9ca3af',
                                                    left: '66.66667%',
                                                    top: '25%',
                                                    height: '50%',
                                                    transform: 'translateX(-50%)',
                                                    zIndex: 5,
                                                    pointerEvents: 'none'
                                                }
                                            })
                                        )
                                    ),
                                    
                                    // TRETÍ RIADOK - QF2, O 3. miesto, QF4
                                    React.createElement(
                                        'tr',
                                        { style: { height: '150px' } },
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '33.33%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.quarterFinals[1], 
                                                    title: 'Štvrťfinále 2',
                                                    matchType: 'štvrťfinále 2',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // V ľavej dolnej bunke vodorovná čiara od stredu doprava
                                            React.createElement('div', { className: 'spider-line-horizontal spider-line-right' }),
                                            
                                            // Pravé orámovanie od stredu výšky po pravý horný roh
                                            React.createElement('div', { 
                                                style: {
                                                    position: 'absolute',
                                                    width: '2px',
                                                    backgroundColor: '#9ca3af',
                                                    right: 0,
                                                    top: 0,
                                                    bottom: '50%',
                                                    zIndex: 5,
                                                    pointerEvents: 'none'
                                                }
                                            })
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '33.33%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.thirdPlace, 
                                                    title: 'O 3. miesto',
                                                    matchType: 'o 3. miesto',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // V spodnej prostrednej bunke zvislá čiara od stredu po horný okraj
                                            React.createElement('div', { className: 'spider-line-vertical spider-line-vertical-top' })
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '33.33%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.quarterFinals[3], 
                                                    title: 'Štvrťfinále 4',
                                                    matchType: 'štvrťfinále 4',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // V pravej dolnej bunke vodorovná čiara od stredu doľava
                                            React.createElement('div', { className: 'spider-line-horizontal spider-line-left' }),
                                            
                                            // Ľavé orámovanie od stredu výšky po ľavý horný roh
                                            React.createElement('div', { 
                                                style: {
                                                    position: 'absolute',
                                                    width: '2px',
                                                    backgroundColor: '#9ca3af',
                                                    left: 0,
                                                    top: 0,
                                                    bottom: '50%',
                                                    zIndex: 5,
                                                    pointerEvents: 'none'
                                                }
                                            })
                                        )
                                    )
                                ),
                                
                                // ===== ÚROVEŇ 3 (s osemfinále) =====
                                spiderLevel === 3 && React.createElement(
                                    React.Fragment,
                                    null,
                                    
                                    // RIADOK 1 - Osemfinále 1, prázdno, prázdno, prázdno, Osemfinále 5
                                    React.createElement(
                                        'tr',
                                        { style: { height: '150px' } },
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.eightFinals[0], 
                                                    title: 'Osemfinále 1',
                                                    matchType: 'osemfinále 1',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Vodorovná čiara od stredu bunky po pravý okraj
                                            React.createElement('div', { className: 'spider-line-horizontal spider-line-right' }),
                                            
                                            // Pravé orámovanie bunky od stredu pravej strany po spodný pravý roh
                                            React.createElement('div', { 
                                                style: {
                                                    position: 'absolute',
                                                    width: '2px',
                                                    backgroundColor: '#9ca3af',
                                                    right: 0,
                                                    top: '50%',
                                                    bottom: 0,
                                                    zIndex: 5,
                                                    pointerEvents: 'none'
                                                }
                                            })
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            }
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            }
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            }
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.eightFinals[4], 
                                                    title: 'Osemfinále 5',
                                                    matchType: 'osemfinále 5',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Vodorovná čiara od stredu bunky po ľavý okraj
                                            React.createElement('div', { className: 'spider-line-horizontal spider-line-left' }),
                                            
                                            // Ľavé orámovanie bunky od stredu ľavej strany po spodný ľavý roh
                                            React.createElement('div', { 
                                                style: {
                                                    position: 'absolute',
                                                    width: '2px',
                                                    backgroundColor: '#9ca3af',
                                                    left: 0,
                                                    top: '50%',
                                                    bottom: 0,
                                                    zIndex: 5,
                                                    pointerEvents: 'none'
                                                }
                                            })
                                        )
                                    ),
                                    
                                    // RIADOK 2 - Štvrťfinále 1 (colspan=2), prázdno, Štvrťfinále 3 (colspan=2)
                                    React.createElement(
                                        'tr',
                                        { style: { height: '150px' } },
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                colSpan: 2,
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '40%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }        },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.quarterFinals[0], 
                                                    title: 'Štvrťfinále 1',
                                                    matchType: 'štvrťfinále 1',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Zvislá čiara presne doprostred na celú výšku bunky
                                            React.createElement('div', { className: 'spider-line-vertical' }),
                                            
                                            // Vodorovná čiara od stredu bunky po jej 3/4 šírky (od 50% do 75%)
                                            React.createElement('div', { 
                                                style: {
                                                    position: 'absolute',
                                                    height: '2px',
                                                    backgroundColor: '#9ca3af',
                                                    left: '50%',
                                                    width: '25%',
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    zIndex: 5,
                                                    pointerEvents: 'none'
                                                }
                                            }),
                                            
                                            // Zvislá čiara od stredu výšky bunky po jej spodný okraj vo vzdialenosti 3/4 od ľavého okraja
                                            React.createElement('div', { 
                                                style: {
                                                    position: 'absolute',
                                                    width: '2px',
                                                    backgroundColor: '#9ca3af',
                                                    left: '75%',
                                                    top: '50%',
                                                    bottom: 0,
                                                    transform: 'translateX(-50%)',
                                                    zIndex: 5,
                                                    pointerEvents: 'none'
                                                }
                                            })
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            }
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                colSpan: 2,
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '40%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.quarterFinals[2], 
                                                    title: 'Štvrťfinále 3',
                                                    matchType: 'štvrťfinále 3',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Zvislá čiara presne doprostred na celú výšku bunky
                                            React.createElement('div', { className: 'spider-line-vertical' }),
                                            
                                            // Vodorovná čiara od 1/4 šírky po stred bunky (od 25% do 50%)
                                            React.createElement('div', { 
                                                style: {
                                                    position: 'absolute',
                                                    height: '2px',
                                                    backgroundColor: '#9ca3af',
                                                    left: '25%',
                                                    width: '25%',
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    zIndex: 5,
                                                    pointerEvents: 'none'
                                                }
                                            }),
                                            
                                            // Zvislá čiara od stredu výšky bunky po jej spodný okraj vo vzdialenosti 1/4 od ľavého okraja
                                            React.createElement('div', { 
                                                style: {
                                                    position: 'absolute',
                                                    width: '2px',
                                                    backgroundColor: '#9ca3af',
                                                    left: '25%',
                                                    top: '50%',
                                                    bottom: 0,
                                                    transform: 'translateX(-50%)',
                                                    zIndex: 5,
                                                    pointerEvents: 'none'
                                                }
                                            })
                                        )
                                    ),
                                    
                                    // RIADOK 3 - Osemfinále 2, prázdno, Finále, prázdno, Osemfinále 6
                                    React.createElement(
                                        'tr',
                                        { style: { height: '150px' } },
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.eightFinals[1], 
                                                    title: 'Osemfinále 2',
                                                    matchType: 'osemfinále 2',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Vodorovná čiara od stredu bunky po pravý okraj
                                            React.createElement('div', { className: 'spider-line-horizontal spider-line-right' }),
                                            
                                            // Pravé orámovanie bunky od stredu pravej strany po horný pravý roh
                                            React.createElement('div', { 
                                                style: {
                                                    position: 'absolute',
                                                    width: '2px',
                                                    backgroundColor: '#9ca3af',
                                                    right: 0,
                                                    top: 0,
                                                    bottom: '50%',
                                                    zIndex: 5,
                                                    pointerEvents: 'none'
                                                }
                                            })
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            null,
                                            // Zvislá čiara presne doprostred na celú výšku bunky
                                            React.createElement('div', { className: 'spider-line-vertical' })
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block' } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.final, 
                                                    title: 'Finále',
                                                    matchType: 'finále',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Zvislá čiara od stredu bunky po jej spodný okraj (pridanie)
                                            React.createElement('div', { 
                                                className: 'spider-line-vertical',
                                                style: { 
                                                    height: '50%',
                                                    top: '50%'
                                                }
                                            })
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            null,
                                            // Zvislá čiara presne doprostred na celú výšku bunky
                                            React.createElement('div', { className: 'spider-line-vertical' })
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.eightFinals[5], 
                                                    title: 'Osemfinále 6',
                                                    matchType: 'osemfinále 6',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Vodorovná čiara od stredu bunky po ľavý okraj
                                            React.createElement('div', { className: 'spider-line-horizontal spider-line-left' }),
                                            
                                            // Ľavé orámovanie bunky od stredu ľavej strany po horný ľavý roh
                                            React.createElement('div', { 
                                                style: {
                                                    position: 'absolute',
                                                    width: '2px',
                                                    backgroundColor: '#9ca3af',
                                                    left: 0,
                                                    top: 0,
                                                    bottom: '50%',
                                                    zIndex: 5,
                                                    pointerEvents: 'none'
                                                }
                                            })
                                        )
                                    ),
                                    
                                    // RIADOK 4 - prázdno, Semifinále 1, prázdno, Semifinále 2, prázdno
                                    React.createElement(
                                        'tr',
                                        { style: { height: '150px' } },
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            }
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block' } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.semiFinals[0], 
                                                    title: 'Semifinále 1',
                                                    matchType: 'semifinále 1',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Vodorovná čiara od stredu bunky po pravý okraj
                                            React.createElement('div', { className: 'spider-line-horizontal spider-line-right' }),
                                            
                                            // Zvislá čiara od horného okraja po spodný okraj v strede bunky
                                            React.createElement('div', { 
                                                className: 'spider-line-vertical',
                                                style: { 
                                                    height: '100%',
                                                    top: 0
                                                }
                                            })
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            null,
                                            // Zvislá čiara presne doprostred na celú výšku bunky
                                            React.createElement('div', { className: 'spider-line-vertical' }),
                                            // Vodorovná čiara presne doprostred na celú šírku bunky
                                            React.createElement('div', { 
                                                style: {
                                                    position: 'absolute',
                                                    height: '2px',
                                                    backgroundColor: '#9ca3af',
                                                    left: 0,
                                                    width: '100%',
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    zIndex: 5,
                                                    pointerEvents: 'none'
                                                }
                                            })
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block' } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.semiFinals[1], 
                                                    title: 'Semifinále 2',
                                                    matchType: 'semifinále 2',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Vodorovná čiara od stredu bunky po ľavý okraj
                                            React.createElement('div', { className: 'spider-line-horizontal spider-line-left' }),
                                            
                                            // Zvislá čiara od horného okraja po spodný okraj v strede bunky
                                            React.createElement('div', { 
                                                className: 'spider-line-vertical',
                                                style: { 
                                                    height: '100%',
                                                    top: 0
                                                }
                                            })
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            }
                                        )
                                    ),
                                    
                                    // RIADOK 5 - Osemfinále 3, prázdno, O 3. miesto, prázdno, Osemfinále 7
                                    React.createElement(
                                        'tr',
                                        { style: { height: '150px' } },
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.eightFinals[2], 
                                                    title: 'Osemfinále 3',
                                                    matchType: 'osemfinále 3',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Vodorovná čiara od stredu bunky po pravý okraj
                                            React.createElement('div', { className: 'spider-line-horizontal spider-line-right' }),
                                            
                                            // Pravé orámovanie bunky od stredu pravej strany po dolný pravý roh
                                            React.createElement('div', { 
                                                style: {
                                                    position: 'absolute',
                                                    width: '2px',
                                                    backgroundColor: '#9ca3af',
                                                    right: 0,
                                                    top: '50%',
                                                    bottom: 0,
                                                    zIndex: 5,
                                                    pointerEvents: 'none'
                                                }
                                            })
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            null,
                                            // Zvislá čiara presne doprostred na celú výšku bunky
                                            React.createElement('div', { className: 'spider-line-vertical' })
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block' } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.thirdPlace, 
                                                    title: 'O 3. miesto',
                                                    matchType: 'o 3. miesto',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Zvislá čiara od stredu bunky po jej horný okraj (pridanie)
                                            React.createElement('div', { 
                                                className: 'spider-line-vertical',
                                                style: { 
                                                    height: '50%',
                                                    top: 0
                                                }
                                            })
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            null,
                                            // Zvislá čiara presne doprostred na celú výšku bunky
                                            React.createElement('div', { className: 'spider-line-vertical' })
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.eightFinals[6], 
                                                    title: 'Osemfinále 7',
                                                    matchType: 'osemfinále 7',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Vodorovná čiara od stredu bunky po ľavý okraj
                                            React.createElement('div', { className: 'spider-line-horizontal spider-line-left' }),
                                            
                                            // Ľavé orámovanie bunky od stredu ľavej strany po dolný ľavý roh
                                            React.createElement('div', { 
                                                style: {
                                                    position: 'absolute',
                                                    width: '2px',
                                                    backgroundColor: '#9ca3af',
                                                    left: 0,
                                                    top: '50%',
                                                    bottom: 0,
                                                    zIndex: 5,
                                                    pointerEvents: 'none'
                                                }
                                            })
                                        )
                                    ),
                                    
                                    // RIADOK 6 - Štvrťfinále 2 (colspan=2), prázdno, Štvrťfinále 4 (colspan=2)
                                    React.createElement(
                                        'tr',
                                        { style: { height: '150px' } },
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                colSpan: 2,
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '40%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.quarterFinals[1], 
                                                    title: 'Štvrťfinále 2',
                                                    matchType: 'štvrťfinále 2',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Zvislá čiara presne doprostred na celú výšku bunky
                                            React.createElement('div', { className: 'spider-line-vertical' }),
                                            
                                            // Vodorovná čiara od stredu bunky po jej 3/4 šírky (od 50% do 75%)
                                            React.createElement('div', { 
                                                style: {
                                                    position: 'absolute',
                                                    height: '2px',
                                                    backgroundColor: '#9ca3af',
                                                    left: '50%',
                                                    width: '25%',
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    zIndex: 5,
                                                    pointerEvents: 'none'
                                                }
                                            }),
                                            
                                            // Zvislá čiara od stredu výšky bunky po jej horný okraj vo vzdialenosti 3/4 od ľavého okraja
                                            React.createElement('div', { 
                                                style: {
                                                    position: 'absolute',
                                                    width: '2px',
                                                    backgroundColor: '#9ca3af',
                                                    left: '75%',
                                                    top: 0,
                                                    bottom: '50%',
                                                    transform: 'translateX(-50%)',
                                                    zIndex: 5,
                                                    pointerEvents: 'none'
                                                }
                                            })
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            }
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                colSpan: 2,
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '40%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.quarterFinals[3], 
                                                    title: 'Štvrťfinále 4',
                                                    matchType: 'štvrťfinále 4',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Zvislá čiara presne doprostred na celú výšku bunky
                                            React.createElement('div', { className: 'spider-line-vertical' }),
                                            
                                            // Vodorovná čiara od 1/4 šírky po stred bunky (od 25% do 50%)
                                            React.createElement('div', { 
                                                style: {
                                                    position: 'absolute',
                                                    height: '2px',
                                                    backgroundColor: '#9ca3af',
                                                    left: '25%',
                                                    width: '25%',
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    zIndex: 5,
                                                    pointerEvents: 'none'
                                                }
                                            }),
                                            
                                            // Zvislá čiara od stredu výšky bunky po jej horný okraj vo vzdialenosti 1/4 od ľavého okraja
                                            React.createElement('div', { 
                                                style: {
                                                    position: 'absolute',
                                                    width: '2px',
                                                    backgroundColor: '#9ca3af',
                                                    left: '25%',
                                                    top: 0,
                                                    bottom: '50%',
                                                    transform: 'translateX(-50%)',
                                                    zIndex: 5,
                                                    pointerEvents: 'none'
                                                }
                                            })
                                        )
                                    ),
                                    
                                    // RIADOK 7 - Osemfinále 4, prázdno, prázdno, prázdno, Osemfinále 8
                                    React.createElement(
                                        'tr',
                                        { style: { height: '150px' } },
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.eightFinals[3], 
                                                    title: 'Osemfinále 4',
                                                    matchType: 'osemfinále 4',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Vodorovná čiara od stredu bunky po pravý okraj
                                            React.createElement('div', { className: 'spider-line-horizontal spider-line-right' }),
                                            
                                            // Ľavé orámovanie bunky od stredu pravej strany po horný pravý roh
                                            React.createElement('div', { 
                                                style: {
                                                    position: 'absolute',
                                                    width: '2px',
                                                    backgroundColor: '#9ca3af',
                                                    right: 0,
                                                    top: 0,
                                                    bottom: '50%',
                                                    zIndex: 5,
                                                    pointerEvents: 'none'
                                                }
                                            })
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            }
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            }
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            }
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.eightFinals[7], 
                                                    title: 'Osemfinále 8',
                                                    matchType: 'osemfinále 8',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Vodorovná čiara od stredu bunky po ľavý okraj
                                            React.createElement('div', { className: 'spider-line-horizontal spider-line-left' }),
                                            
                                            // Ľavé orámovanie bunky od stredu ľavej strany po horný ľavý roh
                                            React.createElement('div', { 
                                                style: {
                                                    position: 'absolute',
                                                    width: '2px',
                                                    backgroundColor: '#9ca3af',
                                                    left: 0,
                                                    top: 0,
                                                    bottom: '50%',
                                                    zIndex: 5,
                                                    pointerEvents: 'none'
                                                }
                                            })
                                        )
                                    )
                                ),
                                
                                // ===== ÚROVEŇ 4 (so šestnásťfinále) =====
                                spiderLevel === 4 && React.createElement(
                                    React.Fragment,
                                    null,
                                    
                                    // RIADOK 1: 16F1, prázdno, prázdno, prázdno, prázdno, prázdno, 16F9
                                    React.createElement(
                                        'tr',
                                        { style: { height: '120px' } },
                                        // 16F1
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.sixteenFinals[0], 
                                                    title: '16-finále 1',
                                                    matchType: 'šestnásťfinále 1',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Vodorovná čiara od stredu po pravý okraj
                                            React.createElement('div', { className: 'spider-line-horizontal spider-line-right' }),
                                            // Zvislá čiara od stredu na pravej strane po spodný pravý roh
                                            React.createElement('div', { 
                                                className: 'spider-line-vertical',
                                                style: { 
                                                    left: '100%',
                                                    height: '50%',
                                                    top: '50%'
                                                }
                                            })
                                        ),
                                        // 5 prázdnych buniek
                                        ...Array(5).fill(null).map((_, i) => 
                                            React.createElement('td', { 
                                                key: `empty-1a-${i}`,
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            })
                                        ),
                                        // 16F9
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.sixteenFinals[8], 
                                                    title: '16-finále 9',
                                                    matchType: 'šestnásťfinále 9',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Vodorovná čiara od stredu po ľavý okraj
                                            React.createElement('div', { className: 'spider-line-horizontal spider-line-left' }),
                                            // Zvislá čiara od stredu na ľavej strane po spodný ľavý roh
                                            React.createElement('div', { 
                                                className: 'spider-line-vertical',
                                                style: { 
                                                    left: 0,
                                                    height: '50%',
                                                    top: '50%'
                                                }
                                            })
                                        )
                                    ),
                                    
                                    // RIADOK 2: Osemfinále 1 (colspan=2), prázdno, prázdno, prázdno, Osemfinále 5 (colspan=2)
                                    React.createElement(
                                        'tr',
                                        { style: { height: '120px' } },
                                        // Osemfinále 1 (colspan=2)
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                colSpan: 2,
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '28.56%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.eightFinals[0], 
                                                    title: 'Osemfinále 1',
                                                    matchType: 'osemfinále 1',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Zvislá čiara v strede
                                            React.createElement('div', { className: 'spider-line-vertical' }),
                                            // Vodorovná čiara od stredu po 3/4 šírky smerom doprava
                                            React.createElement('div', { 
                                                className: 'spider-line-horizontal',
                                                style: { 
                                                    left: '50%',
                                                    width: '25%' // 1/4 z celkovej šírky bunky = od 1/2 do 3/4
                                                }
                                            }),
                                            // Zvislá čiara na úrovni 3/4 šírky od stredu bunky po jej spodný okraj
                                            React.createElement('div', { 
                                                className: 'spider-line-vertical',
                                                style: { 
                                                    left: '75%',
                                                    height: '50%',
                                                    top: '50%'
                                                }
                                            })
                                        ),
                                        // 3 prázdne bunky
                                        ...Array(3).fill(null).map((_, i) => 
                                            React.createElement('td', { 
                                                key: `empty-2a-${i}`,
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            })
                                        ),
                                        // Osemfinále 5 (colspan=2)
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                colSpan: 2,
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '28.56%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.eightFinals[4], 
                                                    title: 'Osemfinále 5',
                                                    matchType: 'osemfinále 5',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Zvislá čiara v strede
                                            React.createElement('div', { className: 'spider-line-vertical' }),
                                            // Vodorovná čiara od stredu po 1/4 šírky smerom doľava
                                            React.createElement('div', { 
                                                className: 'spider-line-horizontal',
                                                style: { 
                                                    left: '25%', // 1/4 od ľavého okraja
                                                    width: '25%' // od 1/4 do 1/2
                                                }
                                            }),
                                            // Zvislá čiara na úrovni 1/4 šírky od stredu bunky po jej spodný okraj
                                            React.createElement('div', { 
                                                className: 'spider-line-vertical',
                                                style: { 
                                                    left: '25%',
                                                    height: '50%',
                                                    top: '50%'
                                                }
                                            })
                                        )
                                    ),
                                    
                                    // RIADOK 3: 16F2, prázdno, prázdno, prázdno, prázdno, prázdno, 16F10
                                    React.createElement(
                                        'tr',
                                        { style: { height: '120px' } },
                                        // 16F2 (stlpec 1)
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.sixteenFinals[1], 
                                                    title: '16-finále 2',
                                                    matchType: 'šestnásťfinále 2',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Vodorovná čiara od stredu po pravý okraj
                                            React.createElement('div', { className: 'spider-line-horizontal spider-line-right' }),
                                            // Zvislá čiara od stredu na pravej strane po horný pravý roh
                                            React.createElement('div', { 
                                                className: 'spider-line-vertical',
                                                style: { 
                                                    left: '100%',
                                                    height: '50%',
                                                    top: 0
                                                }
                                            })
                                        ),
                                        // Prázdna bunka - stlpec 2
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            // Zvislá čiara uprostred na celú výšku bunky
                                            React.createElement('div', { className: 'spider-line-vertical' })
                                        ),
                                        // Prázdna bunka - stlpec 3
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            }
                                        ),
                                        // Prázdna bunka - stlpec 4
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            }
                                        ),
                                        // Prázdna bunka - stlpec 5
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            }
                                        ),
                                        // Prázdna bunka - stlpec 6 - s čiarou
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            // Zvislá čiara uprostred na celú výšku bunky
                                            React.createElement('div', { className: 'spider-line-vertical' })
                                        ),
                                        // 16F10 (stlpec 7)
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.sixteenFinals[9], 
                                                    title: '16-finále 10',
                                                    matchType: 'šestnásťfinále 10',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Vodorovná čiara od stredu po ľavý okraj
                                            React.createElement('div', { className: 'spider-line-horizontal spider-line-left' }),
                                            // Zvislá čiara od stredu na ľavej strane po horný ľavý roh
                                            React.createElement('div', { 
                                                className: 'spider-line-vertical',
                                                style: { 
                                                    left: 0,
                                                    height: '50%',
                                                    top: 0
                                                }
                                            })
                                        )
                                    ),
                                    
                                    // RIADOK 4: prázdno, Štvrťfinále 1, prázdno, prázdno, prázdno, Štvrťfinále 3, prázdno
                                    React.createElement(
                                        'tr',
                                        { style: { height: '120px' } },
                                        // prázdno (stlpec 1)
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            }
                                        ),
                                        // Štvrťfinále 1 (stlpec 2)
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.quarterFinals[0], 
                                                    title: 'Štvrťfinále 1',
                                                    matchType: 'štvrťfinále 1',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Vodorovná čiara od stredu po pravý okraj
                                            React.createElement('div', { className: 'spider-line-horizontal spider-line-right' }),
                                            // Zvislá čiara v strede
                                            React.createElement('div', { className: 'spider-line-vertical' }),
                                            // Zvislá čiara od stredu na pravej strane po spodný pravý roh
                                            React.createElement('div', { 
                                                className: 'spider-line-vertical',
                                                style: { 
                                                    left: '100%',
                                                    height: '50%',
                                                    top: '50%'
                                                }
                                            })
                                        ),
                                        // 3 prázdne bunky (stlpce 3-5)
                                        ...Array(3).fill(null).map((_, i) => 
                                            React.createElement('td', { 
                                                key: `empty-4a-${i}`,
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            })
                                        ),
                                        // Štvrťfinále 3 (stlpec 6)
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.quarterFinals[2], 
                                                    title: 'Štvrťfinále 3',
                                                    matchType: 'štvrťfinále 3',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Vodorovná čiara od stredu po ľavý okraj
                                            React.createElement('div', { className: 'spider-line-horizontal spider-line-left' }),
                                            // Zvislá čiara v strede
                                            React.createElement('div', { className: 'spider-line-vertical' }),
                                            // Zvislá čiara od stredu na ľavej strane po spodný ľavý roh
                                            React.createElement('div', { 
                                                className: 'spider-line-vertical',
                                                style: { 
                                                    left: 0,
                                                    height: '50%',
                                                    top: '50%'
                                                }
                                            })
                                        ),
                                        // prázdno (stlpec 7)
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            }
                                        )
                                    ),
                                    
                                    // RIADOK 5: 16F3, prázdno, prázdno, prázdno, prázdno, prázdno, 16F11
                                    React.createElement(
                                        'tr',
                                        { style: { height: '120px' } },
                                        // 16F3
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.sixteenFinals[2], 
                                                    title: '16-finále 3',
                                                    matchType: 'šestnásťfinále 3',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Vodorovná čiara od stredu po pravý okraj
                                            React.createElement('div', { className: 'spider-line-horizontal spider-line-right' }),
                                            // Zvislá čiara od stredu na pravej strane po spodný pravý roh
                                            React.createElement('div', { 
                                                className: 'spider-line-vertical',
                                                style: { 
                                                    left: '100%',
                                                    height: '50%',
                                                    top: '50%'
                                                }
                                            })
                                        ),
                                        // Prázdna bunka - stlpec 2
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            // Zvislá čiara uprostred na celú výšku bunky
                                            React.createElement('div', { className: 'spider-line-vertical' }),
                                            // Pravé orámovanie pomocou spider-line-vertical (nie borderRight)
                                            React.createElement('div', { 
                                                className: 'spider-line-vertical',
                                                style: { 
                                                    left: '100%',
                                                    height: '100%',
                                                    top: 0
                                                }
                                            })
                                        ),
                                        // 3 prázdne bunky (stlpce 3-5)
                                        ...Array(3).fill(null).map((_, i) => 
                                            React.createElement('td', { 
                                                key: `empty-5a-${i}`,
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            })
                                        ),
                                        // Prázdna bunka - stlpec 6
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            // Zvislá čiara uprostred na celú výšku bunky
                                            React.createElement('div', { className: 'spider-line-vertical' }),
                                            // Ľavé orámovanie pomocou spider-line-vertical (nie borderLeft)
                                            React.createElement('div', { 
                                                className: 'spider-line-vertical',
                                                style: { 
                                                    left: 0,
                                                    height: '100%',
                                                    top: 0
                                                }
                                            })
                                        ),
                                        // 16F11
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.sixteenFinals[10], 
                                                    title: '16-finále 11',
                                                    matchType: 'šestnásťfinále 11',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Vodorovná čiara od stredu po ľavý okraj
                                            React.createElement('div', { className: 'spider-line-horizontal spider-line-left' }),
                                            // Zvislá čiara od stredu na ľavej strane po spodný ľavý roh
                                            React.createElement('div', { 
                                                className: 'spider-line-vertical',
                                                style: { 
                                                    left: 0,
                                                    height: '50%',
                                                    top: '50%'
                                                }
                                            })
                                        )
                                    ),
                                    
                                    // RIADOK 6: Osemfinále 2 (colspan=2), prázdno, prázdno, prázdno, Osemfinále 6 (colspan=2)
                                    React.createElement(
                                        'tr',
                                        { style: { height: '120px' } },
                                        // Osemfinále 2 (colspan=2)
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                colSpan: 2,
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '28.56%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.eightFinals[1], 
                                                    title: 'Osemfinále 2',
                                                    matchType: 'osemfinále 2',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Zvislá čiara v strede
                                            React.createElement('div', { className: 'spider-line-vertical' }),
                                            // Vodorovná čiara výškovo uprostred od stredu po 3/4 šírky
                                            React.createElement('div', { 
                                                className: 'spider-line-horizontal',
                                                style: { 
                                                    left: '50%',
                                                    width: '25%' // od 1/2 do 3/4
                                                }
                                            }),
                                            // Zvislá čiara na úrovni 3/4 šírky od horného okraja do stredu
                                            React.createElement('div', { 
                                                className: 'spider-line-vertical',
                                                style: { 
                                                    left: '75%',
                                                    height: '50%',
                                                    top: 0
                                                }
                                            }),
                                            // Pravé orámovanie (namiesto borderRight) - celá výška od horného okraja po spodný okraj
                                            React.createElement('div', { 
                                                className: 'spider-line-vertical',
                                                style: { 
                                                    left: '100%',
                                                    height: '100%',
                                                    top: 0
                                                }
                                            })
                                        ),
                                        // 3 prázdne bunky
                                        ...Array(3).fill(null).map((_, i) => 
                                            React.createElement('td', { 
                                                key: `empty-6a-${i}`,
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            })
                                        ),
                                        // Osemfinále 6 (colspan=2)
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                colSpan: 2,
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '28.56%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.eightFinals[5], 
                                                    title: 'Osemfinále 6',
                                                    matchType: 'osemfinále 6',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Zvislá čiara v strede
                                            React.createElement('div', { className: 'spider-line-vertical' }),
                                            // Zvislá čiara na úrovni 1/4 šírky od horného okraja do stredu
                                            React.createElement('div', { 
                                                className: 'spider-line-vertical',
                                                style: { 
                                                    left: '25%',
                                                    height: '50%',
                                                    top: 0
                                                }
                                            }),
                                            // Vodorovná čiara výškovo uprostred od stredu po 1/4 šírky
                                            React.createElement('div', { 
                                                className: 'spider-line-horizontal',
                                                style: { 
                                                    left: '25%',
                                                    width: '25%' // od 1/4 do 1/2
                                                }
                                            }),
                                            // Ľavé orámovanie (namiesto borderLeft) - celá výška od horného okraja po spodný okraj
                                            React.createElement('div', { 
                                                className: 'spider-line-vertical',
                                                style: { 
                                                    left: 0,
                                                    height: '100%',
                                                    top: 0
                                                }
                                            })
                                        )
                                    ),
                                    
                                    // RIADOK 7: 16F4, prázdno, prázdno, Finále, prázdno, prázdno, 16F12
                                    React.createElement(
                                        'tr',
                                        { style: { height: '120px' } },
                                        // 16F4 (stlpec 1)
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.sixteenFinals[3], 
                                                    title: '16-finále 4',
                                                    matchType: 'šestnásťfinále 4',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Vodorovná čiara od stredu po pravý okraj
                                            React.createElement('div', { className: 'spider-line-horizontal spider-line-right' }),
                                            // Pravé orámovanie od stredu po horný pravý roh (opravené)
                                            React.createElement('div', { 
                                                className: 'spider-line-vertical',
                                                style: { 
                                                    left: '100%',
                                                    height: '50%',
                                                    top: 0
                                                }
                                            })
                                        ),
                                        // Prázdna bunka - stlpec 2
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            // Pravé orámovanie na celú výšku bunky (namiesto borderRight)
                                            React.createElement('div', { 
                                                className: 'spider-line-vertical',
                                                style: { 
                                                    left: '100%',
                                                    height: '100%',
                                                    top: 0
                                                }
                                            })
                                        ),
                                        // Prázdna bunka - stlpec 3
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            }
                                        ),
                                        // Finále (stlpec 4)
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block' } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.final, 
                                                    title: 'Finále',
                                                    matchType: 'finále',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Zvislá čiara od stredu po spodný okraj
                                            React.createElement('div', { 
                                                className: 'spider-line-vertical',
                                                style: { 
                                                    height: '50%',
                                                    top: '50%'
                                                }
                                            })
                                        ),
                                        // Prázdna bunka - stlpec 5
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            }
                                        ),
                                        // Prázdna bunka - stlpec 6
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            // Ľavé orámovanie na celú výšku bunky (namiesto borderLeft)
                                            React.createElement('div', { 
                                                className: 'spider-line-vertical',
                                                style: { 
                                                    left: 0,
                                                    height: '100%',
                                                    top: 0
                                                }
                                            })
                                        ),
                                        // 16F12 (stlpec 7)
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.sixteenFinals[11], 
                                                    title: '16-finále 12',
                                                    matchType: 'šestnásťfinále 12',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Vodorovná čiara od stredu po ľavý okraj
                                            React.createElement('div', { className: 'spider-line-horizontal spider-line-left' }),
                                            // Ľavé orámovanie od stredu po horný ľavý roh (opravené)
                                            React.createElement('div', { 
                                                className: 'spider-line-vertical',
                                                style: { 
                                                    left: 0,
                                                    height: '50%',
                                                    top: 0
                                                }
                                            })
                                        )
                                    ),
                                    
                                    // RIADOK 8: prázdno, Semifinále 1 (colspan=2), prázdno, Semifinále 2 (colspan=2), prázdno
                                    React.createElement(
                                        'tr',
                                        { style: { height: '120px' } },
                                        // prázdno (stlpec 1)
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            }
                                        ),
                                        // Semifinále 1 (colspan=2) - stlpce 2-3
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                colSpan: 2,
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '28.56%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block' } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.semiFinals[0], 
                                                    title: 'Semifinále 1',
                                                    matchType: 'semifinále 1',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Zvislá čiara v strede
                                            React.createElement('div', { className: 'spider-line-vertical' }),
                                            // Vodorovná čiara od 1/2 šírky po pravý okraj výškovo uprostred
                                            React.createElement('div', { 
                                                className: 'spider-line-horizontal',
                                                style: { 
                                                    left: '50%',
                                                    width: '50%'
                                                }
                                            })
                                        ),
                                        // prázdno - stlpec 4
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            // Vodorovná čiara na celú šírku bunky výškovo uprostred
                                            React.createElement('div', { 
                                                className: 'spider-line-horizontal',
                                                style: { 
                                                    left: 0,
                                                    width: '100%'
                                                }
                                            }),
                                            // Zvislá čiara na 50% šírky bunky (v strede) na celú výšku
                                            React.createElement('div', { 
                                                className: 'spider-line-vertical',
                                                style: { 
                                                    left: '50%',
                                                    height: '100%',
                                                    top: 0
                                                }
                                            })
                                        ),
                                        // Semifinále 2 (colspan=2) - stlpce 5-6
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                colSpan: 2,
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '28.56%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block' } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.semiFinals[1], 
                                                    title: 'Semifinále 2',
                                                    matchType: 'semifinále 2',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Zvislá čiara v strede
                                            React.createElement('div', { className: 'spider-line-vertical' }),
                                            // Vodorovná čiara od 1/2 šírky po ľavý okraj výškovo uprostred
                                            React.createElement('div', { 
                                                className: 'spider-line-horizontal',
                                                style: { 
                                                    left: 0,
                                                    width: '50%'
                                                }
                                            })
                                        ),
                                        // prázdno (stlpec 7)
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            }
                                        )
                                    ),
                                    
                                    // RIADOK 9: 16F5, prázdno, prázdno, o 3. miesto, prázdno, prázdno, 16F13
                                    React.createElement(
                                        'tr',
                                        { style: { height: '120px' } },
                                        // 16F5 (stlpec 1)
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.sixteenFinals[4], 
                                                    title: '16-finále 5',
                                                    matchType: 'šestnásťfinále 5',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Vodorovná čiara od stredu po pravý okraj
                                            React.createElement('div', { className: 'spider-line-horizontal spider-line-right' }),
                                            // Zvislá čiara od stredu na pravej strane po spodný pravý roh
                                            React.createElement('div', { 
                                                className: 'spider-line-vertical',
                                                style: { 
                                                    left: '100%',
                                                    height: '50%',
                                                    top: '50%'
                                                }
                                            })
                                        ),
                                        // Prázdna bunka - stlpec 2
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            // Zvislá čiara na pravom okraji
                                            React.createElement('div', { 
                                                className: 'spider-line-vertical',
                                                style: { 
                                                    left: '100%',
                                                    height: '100%',
                                                    top: 0
                                                }
                                            })
                                        ),
                                        // Prázdna bunka - stlpec 3
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            }
                                            // Zvislá čiara odstránená
                                        ),
                                        // o 3. miesto (stlpec 4)
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block' } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.thirdPlace, 
                                                    title: 'O 3. miesto',
                                                    matchType: 'o 3. miesto',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Zvislá čiara od stredu po horný okraj (ponechaná, lebo má height: '50%')
                                            React.createElement('div', { 
                                                className: 'spider-line-vertical',
                                                style: { 
                                                    height: '50%',
                                                    top: 0
                                                }
                                            })
                                        ),
                                        // Prázdna bunka - stlpec 5
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            }
                                        ),
                                        // Prázdna bunka - stlpec 6
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            // Zvislá čiara na ľavom okraji
                                            React.createElement('div', { 
                                                className: 'spider-line-vertical',
                                                style: { 
                                                    left: 0,
                                                    height: '100%',
                                                    top: 0
                                                }
                                            })
                                        ),
                                        // 16F13 (stlpec 7)
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.sixteenFinals[12], 
                                                    title: '16-finále 13',
                                                    matchType: 'šestnásťfinále 13',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Vodorovná čiara od stredu po ľavý okraj
                                            React.createElement('div', { className: 'spider-line-horizontal spider-line-left' }),
                                            // Zvislá čiara od polovice po ľavý spodný roh
                                            React.createElement('div', { 
                                                className: 'spider-line-vertical',
                                                style: { 
                                                    left: 0,
                                                    height: '50%',
                                                    top: '50%'
                                                }
                                            })
                                        )
                                    ),
                                    
                                    // RIADOK 10: Osemfinále 3 (colspan=2), prázdno, prázdno, prázdno, Osemfinále 7 (colspan=2)
                                    React.createElement(
                                        'tr',
                                        { style: { height: '120px' } },
                                        // Osemfinále 3 (colspan=2)
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                colSpan: 2,
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '28.56%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.eightFinals[2], 
                                                    title: 'Osemfinále 3',
                                                    matchType: 'osemfinále 3',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Zvislá čiara v strede
                                            React.createElement('div', { className: 'spider-line-vertical' }),
                                            // Vodorovná čiara výškovo uprostred od stredu po 3/4 šírky
                                            React.createElement('div', { 
                                                className: 'spider-line-horizontal',
                                                style: { 
                                                    left: '50%',
                                                    width: '25%' // od 1/2 do 3/4
                                                }
                                            }),
                                            // Zvislá čiara na úrovni 3/4 šírky od stredu po spodný okraj
                                            React.createElement('div', { 
                                                className: 'spider-line-vertical',
                                                style: { 
                                                    left: '75%',
                                                    height: '50%',
                                                    top: '50%'
                                                }
                                            }),
                                            // Pravé orámovanie na celú výšku
                                            React.createElement('div', { 
                                                className: 'spider-line-vertical',
                                                style: { 
                                                    left: '100%',
                                                    height: '100%',
                                                    top: 0
                                                }
                                            })
                                        ),
                                        // 3 prázdne bunky
                                        ...Array(3).fill(null).map((_, i) => 
                                            React.createElement('td', { 
                                                key: `empty-10a-${i}`,
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            })
                                        ),
                                        // Osemfinále 7 (colspan=2)
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                colSpan: 2,
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '28.56%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.eightFinals[6], 
                                                    title: 'Osemfinále 7',
                                                    matchType: 'osemfinále 7',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Zvislá čiara v strede
                                            React.createElement('div', { className: 'spider-line-vertical' }),
                                            // Zvislá čiara na úrovni 1/4 šírky od stredu po spodný okraj
                                            React.createElement('div', { 
                                                className: 'spider-line-vertical',
                                                style: { 
                                                    left: '25%',
                                                    height: '50%',
                                                    top: '50%'
                                                }
                                            }),
                                            // Vodorovná čiara výškovo uprostred od stredu po 1/4 šírky
                                            React.createElement('div', { 
                                                className: 'spider-line-horizontal',
                                                style: { 
                                                    left: '25%',
                                                    width: '25%' // od 1/4 do 1/2
                                                }
                                            }),
                                            // Ľavé orámovanie na celú výšku
                                            React.createElement('div', { 
                                                className: 'spider-line-vertical',
                                                style: { 
                                                    left: 0,
                                                    height: '100%',
                                                    top: 0
                                                }
                                            })
                                        )
                                    ),
                                    
                                    // RIADOK 11: 16F6, prázdno, prázdno, prázdno, prázdno, prázdno, 16F14
                                    React.createElement(
                                        'tr',
                                        { style: { height: '120px' } },
                                        // 16F6 (stlpec 1)
                                        React.createElement(
                                            'td',
                                            {
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, {
                                                    match: spiderData.sixteenFinals[5],
                                                    title: '16-finále 6',
                                                    matchType: 'šestnásťfinále 6',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Vodorovná čiara od stredu po pravý okraj
                                            React.createElement('div', { className: 'spider-line-horizontal spider-line-right' }),
                                            // Zvislá čiara od stredu na pravej strane po horný okraj
                                            React.createElement('div', {
                                                className: 'spider-line-vertical',
                                                style: {
                                                    left: '100%',
                                                    height: '50%',
                                                    top: 0
                                                }
                                            })
                                        ),
                                        // Prázdna bunka - stlpec 2
                                        React.createElement(
                                            'td',
                                            {
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            // Zvislá čiara uprostred na celú výšku bunky
                                            React.createElement('div', { className: 'spider-line-vertical' }),
                                            // Zvislá čiara na pravej strane na celú výšku bunky
                                            React.createElement('div', {
                                                className: 'spider-line-vertical',
                                                style: {
                                                    left: '100%',
                                                    height: '100%',
                                                    top: 0
                                                }
                                            })
                                        ),
                                        // Prázdna bunka - stlpec 3
                                        React.createElement(
                                            'td',
                                            {
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            }
                                        ),
                                        // Prázdna bunka - stlpec 4
                                        React.createElement(
                                            'td',
                                            {
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            }
                                        ),
                                        // Prázdna bunka - stlpec 5 (čiaru sme odstránili)
                                        React.createElement(
                                            'td',
                                            {
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db'
                                                    // position: 'relative' odstránené, lebo už nemáme čiaru
                                                }
                                            }
                                        ),
                                        // Prázdna bunka - stlpec 6 - s čiarami (v strede a na ľavej strane)
                                        React.createElement(
                                            'td',
                                            {
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            // Zvislá čiara uprostred na celú výšku bunky
                                            React.createElement('div', { className: 'spider-line-vertical' }),
                                            // Zvislá čiara na ľavej strane na celú výšku bunky
                                            React.createElement('div', {
                                                className: 'spider-line-vertical',
                                                style: {
                                                    left: 0,
                                                    height: '100%',
                                                    top: 0
                                                }
                                            })
                                        ),
                                        // 16F14 (stlpec 7)
                                        React.createElement(
                                            'td',
                                            {
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, {
                                                    match: spiderData.sixteenFinals[13],
                                                    title: '16-finále 14',
                                                    matchType: 'šestnásťfinále 14',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Vodorovná čiara od stredu po ľavý okraj
                                            React.createElement('div', { className: 'spider-line-horizontal spider-line-left' }),
                                            // Zvislá čiara od stredu na ľavej strane po horný okraj
                                            React.createElement('div', {
                                                className: 'spider-line-vertical',
                                                style: {
                                                    left: 0,
                                                    height: '50%',
                                                    top: 0
                                                }
                                            })
                                        )
                                    ),
                                    
                                    // RIADOK 12: prázdno, Štvrťfinále 2, prázdno, prázdno, prázdno, Štvrťfinále 4, prázdno
                                    React.createElement(
                                        'tr',
                                        { style: { height: '120px' } },
                                        // prázdno (stlpec 1)
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            }
                                        ),
                                        // Štvrťfinále 2 (stlpec 2)
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.quarterFinals[1], 
                                                    title: 'Štvrťfinále 2',
                                                    matchType: 'štvrťfinále 2',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Vodorovná čiara od stredu po pravý okraj
                                            React.createElement('div', { className: 'spider-line-horizontal spider-line-right' }),
                                            // Zvislá čiara v strede
                                            React.createElement('div', { className: 'spider-line-vertical' }),
                                            // Zvislá čiara od stredu na pravej strane po horný pravý roh
                                            React.createElement('div', { 
                                                className: 'spider-line-vertical',
                                                style: { 
                                                    left: '100%',
                                                    height: '50%',
                                                    top: 0
                                                }
                                            })
                                        ),
                                        // 3 prázdne bunky (stlpce 3-5)
                                        ...Array(3).fill(null).map((_, i) => 
                                            React.createElement('td', { 
                                                key: `empty-12a-${i}`,
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            })
                                        ),
                                        // Štvrťfinále 4 (stlpec 6)
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.quarterFinals[3], 
                                                    title: 'Štvrťfinále 4',
                                                    matchType: 'štvrťfinále 4',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Vodorovná čiara od stredu po ľavý okraj
                                            React.createElement('div', { className: 'spider-line-horizontal spider-line-left' }),
                                            // Zvislá čiara v strede
                                            React.createElement('div', { className: 'spider-line-vertical' }),
                                            // Zvislá čiara od stredu na ľavej strane po horný ľavý roh
                                            React.createElement('div', { 
                                                className: 'spider-line-vertical',
                                                style: { 
                                                    left: 0,
                                                    height: '50%',
                                                    top: 0
                                                }
                                            })
                                        ),
                                        // prázdno (stlpec 7)
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            }
                                        )
                                    ),
                                    
                                    // RIADOK 13: 16F7, prázdno, prázdno, prázdno, prázdno, prázdno, 16F15
                                    React.createElement(
                                        'tr',
                                        { style: { height: '120px' } },
                                        // 16F7 (stlpec 1)
                                        React.createElement(
                                            'td',
                                            {
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, {
                                                    match: spiderData.sixteenFinals[6],
                                                    title: '16-finále 7',
                                                    matchType: 'šestnásťfinále 7',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Vodorovná čiara od stredu po pravý okraj
                                            React.createElement('div', { className: 'spider-line-horizontal spider-line-right' }),
                                            // Zvislá čiara od stredu na pravej strane po dolný okraj (zmena top: '50%')
                                            React.createElement('div', {
                                                className: 'spider-line-vertical',
                                                style: {
                                                    left: '100%',
                                                    height: '50%',
                                                    top: '50%'  // začína v strede, ide dole
                                                }
                                            })
                                        ),
                                        // Prázdna bunka - stlpec 2
                                        React.createElement(
                                            'td',
                                            {
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            // Zvislá čiara uprostred na celú výšku bunky
                                            React.createElement('div', { className: 'spider-line-vertical' })
                                        ),
                                        // Prázdna bunka - stlpec 3
                                        React.createElement(
                                            'td',
                                            {
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            }
                                        ),
                                        // Prázdna bunka - stlpec 4
                                        React.createElement(
                                            'td',
                                            {
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            }
                                        ),
                                        // Prázdna bunka - stlpec 5
                                        React.createElement(
                                            'td',
                                            {
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            }
                                        ),
                                        // Prázdna bunka - stlpec 6 - s čiarou
                                        React.createElement(
                                            'td',
                                            {
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            // Zvislá čiara uprostred na celú výšku bunky
                                            React.createElement('div', { className: 'spider-line-vertical' })
                                        ),
                                        // 16F15 (stlpec 7)
                                        React.createElement(
                                            'td',
                                            {
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, {
                                                    match: spiderData.sixteenFinals[14],
                                                    title: '16-finále 15',
                                                    matchType: 'šestnásťfinále 15',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            React.createElement('div', {
                                                className: 'spider-line-vertical',
                                                style: {
                                                    left: 0,
                                                    height: '50%',
                                                    top: '50%',
                                                }
                                            }),
                                            React.createElement('div', {
                                                className: 'spider-line-horizontal',
                                                style: {
                                                    left: 0,
                                                    width: '50%',
                                                }
                                            })
                                        )
                                    ),
                                    
                                    // RIADOK 14: Osemfinále 4 (colspan=2), prázdno, prázdno, prázdno, Osemfinále 8 (colspan=2)
                                    React.createElement(
                                        'tr',
                                        { style: { height: '120px' } },
                                        // Osemfinále 4 (colspan=2)
                                        React.createElement(
                                            'td',
                                            {
                                                className: 'spider-cell',
                                                colSpan: 2,
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '28.56%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, {
                                                    match: spiderData.eightFinals[3],
                                                    title: 'Osemfinále 4',
                                                    matchType: 'osemfinále 4',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            React.createElement('div', { className: 'spider-line-vertical' }),
                                            
                                            // Vodorovná čiara výškovo uprostred od stredu po 3/4 šírky
                                            React.createElement('div', {
                                                className: 'spider-line-horizontal',
                                                style: {
                                                    left: '50%',
                                                    width: '25%' // od 1/2 do 3/4
                                                }
                                            }),
                                            // Zvislá čiara na úrovni 3/4 šírky od stredu po horný okraj (height: 50%)
                                            React.createElement('div', {
                                                className: 'spider-line-vertical',
                                                style: {
                                                    left: '75%',
                                                    height: '50%',
                                                    top: 0
                                                }
                                            }),
                                        ),
                                        // 3 prázdne bunky
                                        ...Array(3).fill(null).map((_, i) => 
                                            React.createElement('td', {
                                                key: `empty-14a-${i}`,
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            })
                                        ),
                                        // Osemfinále 8 (colspan=2) - ZRKADLOVO SYMETRICKY K ĽAVEJ BUNKE
                                        React.createElement(
                                            'td',
                                            {
                                                className: 'spider-cell',
                                                colSpan: 2,
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '28.56%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, {
                                                    match: spiderData.eightFinals[7],
                                                    title: 'Osemfinále 8',
                                                    matchType: 'osemfinále 8',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),                                           
                                            React.createElement('div', {
                                                className: 'spider-line-vertical',
                                                style: {
                                                    left: '25%', 
                                                    height: '50%',
                                                    top: 0
                                                }
                                            }),                                            
                                            React.createElement('div', {
                                                className: 'spider-line-vertical',
                                                style: {
                                                    left: '50%', 
                                                    height: '100%',
                                                    top: 0
                                                }
                                            }),
                                            React.createElement('div', {
                                                className: 'spider-line-horizontal',
                                                style: {
                                                    left: '25%',
                                                    width: '25%',
                                                    top: '50%'
                                                }
                                            })
                                        )
                                    ),
                                    
                                    // RIADOK 15: 16F8, prázdno, prázdno, prázdno, prázdno, prázdno, 16F16
                                    React.createElement(
                                        'tr',
                                        { style: { height: '120px' } },
                                        // 16F8 (stlpec 1)
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.sixteenFinals[7], 
                                                    title: '16-finále 8',
                                                    matchType: 'šestnásťfinále 8',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Vodorovná čiara od stredu po pravý okraj
                                            React.createElement('div', { className: 'spider-line-horizontal spider-line-right' }),
                                            // Zvislá čiara od stredu na pravej strane po spodný pravý roh (height: 50% - PONECHÁVAM)
                                            React.createElement('div', { 
                                                className: 'spider-line-vertical',
                                                style: { 
                                                    left: '100%',
                                                    height: '50%',
                                                    top: 0
                                                }
                                            })
                                        ),
                                        // Prázdna bunka - stlpec 2
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            }
                                            // Zvislá čiara uprostred na celú výšku bunky - OSTRÁNENÁ (height: 100%)
                                            // Pravé orámovanie na celú výšku - OSTRÁNENÉ (height: 100%)
                                        ),
                                        // Prázdna bunka - stlpec 3
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            }
                                        ),
                                        // Prázdna bunka - stlpec 4
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            }
                                        ),
                                        // Prázdna bunka - stlpec 5
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            }
                                        ),
                                        // Prázdna bunka - stlpec 6
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            }
                                            // Zvislá čiara uprostred na celú výšku bunky - OSTRÁNENÁ (height: 100%)
                                            // Ľavé orámovanie na celú výšku - OSTRÁNENÉ (height: 100%)
                                        ),
                                        // 16F16 (stlpec 7)
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '8px',
                                                    width: '14.28%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.sixteenFinals[15], 
                                                    title: '16-finále 16',
                                                    matchType: 'šestnásťfinále 16',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch,
                                                    onDelete: deleteSingleMatch
                                                })
                                            ),
                                            // Vodorovná čiara od stredu po ľavý okraj
                                            React.createElement('div', { className: 'spider-line-horizontal spider-line-left' }),
                                            // Zvislá čiara od stredu na ľavej strane po spodný ľavý roh (height: 50% - PONECHÁVAM)
                                            React.createElement('div', { 
                                                className: 'spider-line-vertical',
                                                style: { 
                                                    left: 0,
                                                    height: '50%',
                                                    top: 0
                                                }
                                            })
                                        )
                                    )                                    
                                )
                            )
                        )
                    )
                )
            )
        )
    );
};

const handleDataUpdateAndRender = (event) => {
    const userProfileData = event.detail;
    const rootElement = document.getElementById('root');

    if (userProfileData) {
        if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
            const root = ReactDOM.createRoot(rootElement);
            root.render(React.createElement(SpiderApp, { userProfileData }));
        }
    } else {
        if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
            const root = ReactDOM.createRoot(rootElement);
            root.render(
                React.createElement(
                    'div',
                    { className: 'flex justify-center items-center h-full pt-16 w-full' },
                    React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
                )
            );
        }
    }
};

window.addEventListener('globalDataUpdated', handleDataUpdateAndRender);

if (window.globalUserProfileData) {
    handleDataUpdateAndRender({ detail: window.globalUserProfileData });
}
