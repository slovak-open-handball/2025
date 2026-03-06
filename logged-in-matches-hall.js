// Importy pre Firebase funkcie (Tieto sa nebudú používať na inicializáciu, ale na typy a funkcie)
import { doc, getDoc, onSnapshot, updateDoc, addDoc, collection, Timestamp, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const { useState, useEffect } = React;

// Ikony pre typy miest (pre prípadné použitie)
const typeIcons = {
    sportova_hala: { icon: 'fa-futbol', color: '#dc2626' },
};

// Funkcia na formátovanie dátumu s dňom v týždni
const getDayName = (date) => {
    const days = ['Nedeľa', 'Pondelok', 'Utorok', 'Streda', 'Štvrtok', 'Piatok', 'Sobota'];
    return days[date.getDay()];
};

const formatDateWithDay = (date) => {
    const dayName = getDayName(date);
    const formattedDate = date.toLocaleDateString('sk-SK', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    return `${dayName} ${formattedDate}`;
};

const formatTime = (timestamp) => {
    if (!timestamp) return '--:--';
    try {
        const date = timestamp.toDate();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    } catch (e) {
        return '--:--';
    }
};

const getLocalDateStr = (date) => {
    if (!date) return null;
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getUrlParameter = (name) => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
};

// Funkcia na aktualizáciu URL bez reloadu
const updateUrlParameters = (homeIdentifier, awayIdentifier) => {
    const url = new URL(window.location.href);
    if (homeIdentifier && awayIdentifier) {
        url.searchParams.set('domaci', homeIdentifier);
        url.searchParams.set('hostia', awayIdentifier);
        // Odstránime starý parameter match ak existuje
        url.searchParams.delete('match');
    } else {
        url.searchParams.delete('domaci');
        url.searchParams.delete('hostia');
    }
    window.history.replaceState({}, '', url);
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

    setTimeout(() => {
        notificationElement.className = `${baseClasses} ${typeClasses} opacity-100 scale-100`;
    }, 10);

    setTimeout(() => {
        notificationElement.className = `${baseClasses} ${typeClasses} opacity-0 scale-95`;
    }, 5000);
};

const matchesHallApp = ({ userProfileData }) => {
    // Extrahujeme hallId z userProfileData
    const hallId = userProfileData?.hallId;
    const [hallName, setHallName] = useState(null);
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [teamData, setTeamData] = useState({ allTeams: [] });
    const [groupedMatches, setGroupedMatches] = useState({});
    const [categories, setCategories] = useState([]);
    const [groupsByCategory, setGroupsByCategory] = useState({});
    const [users, setUsers] = useState([]);
    const [superstructureTeams, setSuperstructureTeams] = useState({});
    // NOVÝ STAV PRE VYBRANÝ ZÁPAS
    const [selectedMatch, setSelectedMatch] = useState(null);

    // Načítanie názvu haly
    useEffect(() => {
        const fetchHallName = async () => {
            if (!hallId || !window.db) {
                setHallName('Žiadna priradená hala');
                setLoading(false);
                return;
            }
            
            try {
                const placeRef = doc(window.db, 'places', hallId);
                const placeSnap = await getDoc(placeRef);
                
                if (placeSnap.exists()) {
                    const placeData = placeSnap.data();
                    setHallName(placeData.name || 'Neznámy názov haly');
                } else {
                    setHallName(hallId);
                }
            } catch (error) {
                console.error("Chyba pri načítaní názvu haly:", error);
                setHallName(hallId || 'Chyba načítania');
            }
        };
        
        fetchHallName();
    }, [hallId]);

    // Načítanie tímov z teamManager
    useEffect(() => {
        if (window.teamManager) {
            if (window.__teamManagerData) {
                setTeamData(window.__teamManagerData);
            }
            
            const unsubscribe = window.teamManager.subscribe((data) => {
                setTeamData(data);
                // VYPÍŠEME TÍMY PRI KAŽDEJ AKTUALIZÁCII
//                console.log('=== TÍMY V SKUPINÁCH (po aktualizácii) ===');
                logAllTeams(data.allTeams);
            });
            
            return () => {
                if (unsubscribe) unsubscribe();
            };
        } else if (window.__teamManagerData) {
            setTeamData(window.__teamManagerData);
            // VYPÍŠEME TÍMY PRI NAČÍTANÍ
//            console.log('=== TÍMY V SKUPINÁCH (pri načítaní) ===');
            logAllTeams(window.__teamManagerData.allTeams);
        }
    }, []);

    // FUNKCIA PRE VYPISOVANIE VŠETKÝCH TÍMOV
    const logAllTeams = (teams) => {
        if (!teams || teams.length === 0) {
//            console.log('Žiadne tímy nie sú k dispozícii');
            return;
        }
        
//        console.log(`Celkový počet tímov: ${teams.length}`);
        
        // Zoskupíme tímy podľa kategórie a skupiny
        const teamsByCategory = {};
        
        teams.forEach(team => {
            const category = team.category || 'Neznáma kategória';
            if (!teamsByCategory[category]) {
                teamsByCategory[category] = {};
            }
            
            const group = team.groupName || 'Bez skupiny';
            if (!teamsByCategory[category][group]) {
                teamsByCategory[category][group] = [];
            }
            
            teamsByCategory[category][group].push(team);
        });
        
        // Vypíšeme tímy podľa kategórií a skupín
//        Object.entries(teamsByCategory).forEach(([category, groups], catIndex) => {
//            console.log(`\nKategória #${catIndex + 1}: ${category}`);
//            
//            Object.entries(groups).forEach(([group, groupTeams]) => {
//                console.log(`  Skupina: ${group}`);
//                
//                // Zoradíme tímy podľa poradia
//                const sortedTeams = [...groupTeams].sort((a, b) => {
//                    const orderA = a.order !== null && a.order !== undefined ? a.order : Infinity;
//                    const orderB = b.order !== null && b.order !== undefined ? b.order : Infinity;
//                    return orderA - orderB;
//                });
//                
//                sortedTeams.forEach((team, teamIndex) => {
//                    const orderText = team.order !== null && team.order !== undefined ? `poradie: ${team.order}` : 'bez poradia';
//                    console.log(`    ${teamIndex + 1}. ${team.teamName} (${orderText})`);
//                    if (team.id) console.log(`       ID: ${team.id}`);
//                    if (team.uid && team.uid !== 'global') console.log(`       UID používateľa: ${team.uid}`);
//                });
//            });
//        });
//        
//        console.log('=========================================');
    };

    // FUNKCIA PRE VYPISOVANIE VŠETKÝCH TÍMOV POUŽÍVATEĽOV V JEDNEJ PREHĽADNEJ TABUĽKE
    const logAllUsers = (usersList) => {
        if (!usersList || usersList.length === 0) {
//            console.log('Žiadni používatelia nie sú k dispozícii');
            return;
        }
        
//        console.log('=== VŠETKY TÍMY POUŽÍVATEĽOV ZORADENÉ PODĽA KATEGÓRIE A SKUPINY ===');
        
        // Vytvoríme centrálnu štruktúru pre všetky tímy
        const allTeamsByCategory = {};
        let totalTeams = 0;
        
        // Prejdeme všetkých používateľov a ich tímy
        usersList.forEach((user) => {
            if (!user.teams || Object.keys(user.teams).length === 0) return;
            
            Object.entries(user.teams).forEach(([categoryName, teamArray]) => {
                if (!Array.isArray(teamArray) || teamArray.length === 0) return;
                
                // Inicializujeme kategóriu, ak ešte neexistuje
                if (!allTeamsByCategory[categoryName]) {
                    allTeamsByCategory[categoryName] = {};
                }
                
                teamArray.forEach(team => {
                    const groupName = team.groupName || 'Bez skupiny';
                    
                    // Inicializujeme skupinu, ak ešte neexistuje
                    if (!allTeamsByCategory[categoryName][groupName]) {
                        allTeamsByCategory[categoryName][groupName] = [];
                    }
                    
                    // Pridáme tím s informáciou o používateľovi
                    allTeamsByCategory[categoryName][groupName].push({
                        teamName: team.teamName,
                        order: team.order,
                        userEmail: user.email || 'Neznámy email',
                        userId: user.id
                    });
                    totalTeams++;
                });
            });
        });
        
//        console.log(`Celkový počet tímov naprieč všetkými používateľmi: ${totalTeams}`);
//        console.log('');
        
        // Zoradíme kategórie podľa abecedy
        const sortedCategories = Object.keys(allTeamsByCategory).sort((a, b) => a.localeCompare(b));
        
        // Prejdeme všetky kategórie
        sortedCategories.forEach(categoryName => {
//            console.log(`\nKategória: ${categoryName}`);
            
            const groups = allTeamsByCategory[categoryName];
            
            // Zoradíme skupiny - "Bez skupiny" dáme na koniec
            const sortedGroups = Object.keys(groups).sort((a, b) => {
                if (a === 'Bez skupiny') return 1;
                if (b === 'Bez skupiny') return -1;
                return a.localeCompare(b);
            });
            
            // Prejdeme všetky skupiny v kategórii
            sortedGroups.forEach(groupName => {
//                console.log(`  Skupina: ${groupName}`);
                
                const teamsInGroup = groups[groupName];
                
                // Zoradíme tímy podľa poradia
                const sortedTeams = [...teamsInGroup].sort((a, b) => {
                    const orderA = a.order !== null && a.order !== undefined ? a.order : Infinity;
                    const orderB = b.order !== null && b.order !== undefined ? b.order : Infinity;
                    return orderA - orderB;
                });
                
                // Vypíšeme každý tím
                sortedTeams.forEach(team => {
                    const orderText = team.order !== null && team.order !== undefined ? `, poradie: ${team.order}` : '';
//                    console.log(`    - ${team.teamName}${orderText} (používateľ: ${team.userEmail})`);
                });
            });
        });
        
//        console.log('\n===========================================');
    };

    // FUNKCIA PRE VYPISOVANIE VŠETKÝCH SUPERSTRUCTURE TÍMOV
    const logSuperstructureTeams = (superstructureData) => {
        if (!superstructureData || Object.keys(superstructureData).length === 0) {
            console.log('Žiadne superstructure tímy nie sú k dispozícii');
            return;
        }
        
        console.log('=== VŠETKY SUPERSTRUCTURE TÍMY ZORADENÉ PODĽA KATEGÓRIE A SKUPINY ===');
        
        let totalTeams = 0;
        
        // Zoradíme kategórie podľa abecedy
        const sortedCategories = Object.keys(superstructureData).sort((a, b) => a.localeCompare(b));
        
        sortedCategories.forEach(categoryName => {
            const teams = superstructureData[categoryName] || [];
            
            if (teams.length === 0) return;
            
            console.log(`\nKategória: ${categoryName}`);
            
            // Zoskupíme tímy podľa skupiny
            const teamsByGroup = {};
            
            teams.forEach(team => {
                const groupName = team.groupName || 'Bez skupiny';
                if (!teamsByGroup[groupName]) {
                    teamsByGroup[groupName] = [];
                }
                teamsByGroup[groupName].push(team);
            });
            
            // Zoradíme skupiny - "Bez skupiny" dáme na koniec
            const sortedGroups = Object.keys(teamsByGroup).sort((a, b) => {
                if (a === 'Bez skupiny') return 1;
                if (b === 'Bez skupiny') return -1;
                return a.localeCompare(b);
            });
            
            sortedGroups.forEach(groupName => {
                const teamsInGroup = teamsByGroup[groupName];
                console.log(`  Skupina: ${groupName}`);
                
                // Zoradíme tímy podľa poradia
                const sortedTeams = [...teamsInGroup].sort((a, b) => {
                    const orderA = a.order !== null && a.order !== undefined ? a.order : Infinity;
                    const orderB = b.order !== null && b.order !== undefined ? b.order : Infinity;
                    return orderA - orderB;
                });
                
                sortedTeams.forEach(team => {
                    const orderText = team.order !== null && team.order !== undefined ? `, poradie: ${team.order}` : '';
                    console.log(`    - ${team.teamName}${orderText}`);
                    if (team.id) console.log(`       ID: ${team.id}`);
                    totalTeams++;
                });
            });
        });
        
        console.log(`\nCelkový počet superstructure tímov: ${totalTeams}`);
        console.log('===========================================');
    };

    // Načítanie kategórií z databázy
    useEffect(() => {
        const loadCategorySettings = async () => {
            if (!window.db) return;
            
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
                    console.log('=== NAČÍTANÉ KATEGÓRIE ===');
                    console.log('Počet kategórií:', categoriesList.length);
                    categoriesList.forEach((cat, index) => {
                        console.log(`Kategória #${index + 1}:`, {
                            id: cat.id,
                            name: cat.name
                        });
                    });
                    console.log('===========================');
                }
            } catch (error) {
                console.error("Chyba pri načítaní kategórií:", error);
            }
        };
        
        loadCategorySettings();
    }, []);

    // Načítanie skupín z databázy
    useEffect(() => {
        if (!window.db) return;

        console.log('Načítavam skupiny z databázy...');

        const loadGroups = async () => {
            try {
                const groupsRef = doc(window.db, 'settings', 'groups');
                const groupsSnap = await getDoc(groupsRef);
                
                if (groupsSnap.exists()) {
                    const groupsData = groupsSnap.data();
                    setGroupsByCategory(groupsData);
                    
                    console.log('=== NAČÍTANÉ SKUPINY PODĽA KATEGÓRIÍ ===');
                    
                    // Pre každú kategóriu vypíšeme jej skupiny
                    Object.entries(groupsData).forEach(([categoryId, groups], catIndex) => {
                        // Nájdeme názov kategórie podľa ID
                        const category = categories.find(c => c.id === categoryId);
                        const categoryName = category ? category.name : `Neznáma kategória (ID: ${categoryId})`;
                        
                        console.log(`Kategória #${catIndex + 1}: ${categoryName} (ID: ${categoryId})`);
                        console.log(`  Počet skupín: ${groups.length}`);
                        
                        // Rozdelíme skupiny podľa typu
                        const basicGroups = groups.filter(g => g.type === 'základná skupina');
                        const superGroups = groups.filter(g => g.type === 'nadstavbová skupina');
                        
                        console.log(`  Základné skupiny (${basicGroups.length}):`);
                        basicGroups.forEach((group, groupIndex) => {
                            console.log(`    ${groupIndex + 1}. ${group.name}`);
                        });
                        
                        console.log(`  Nadstavbové skupiny (${superGroups.length}):`);
                        superGroups.forEach((group, groupIndex) => {
                            console.log(`    ${groupIndex + 1}. ${group.name}`);
                        });
                        console.log('  ---');
                    });
                    
                    console.log('===========================================');
                    
                } else {
                    console.log('Dokument groups neexistuje');
                    setGroupsByCategory({});
                }
            } catch (error) {
                console.error('Chyba pri načítaní skupín:', error);
                setGroupsByCategory({});
            }
        };
        
        loadGroups();
        
        // Môžeme pridať aj real-time listener pre skupiny
        const unsubscribeGroups = onSnapshot(doc(window.db, 'settings', 'groups'), (docSnap) => {
            if (docSnap.exists()) {
                const groupsData = docSnap.data();
                setGroupsByCategory(groupsData);
                console.log('Skupiny boli aktualizované v reálnom čase');
            }
        }, (error) => {
            console.error('Chyba pri real-time sledovaní skupín:', error);
        });
        
        return () => unsubscribeGroups();
    }, [categories]);

    // NOVÝ LISTENER: Načítanie superstructure tímov z kolekcie settings/superstructureGroups
    useEffect(() => {
        if (!window.db) return;

        console.log('Načítavam superstructure tímy z dokumentu settings/superstructureGroups...');

        const superstructureDocRef = doc(window.db, 'settings', 'superstructureGroups');
        
        const unsubscribeSuperstructure = onSnapshot(superstructureDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setSuperstructureTeams(data);
                console.log('=== SUPERSTRUCTURE TÍMY BOLI NAČÍTANÉ ===');
                logSuperstructureTeams(data);
            } else {
                console.log('Dokument settings/superstructureGroups neexistuje');
                setSuperstructureTeams({});
            }
        }, (error) => {
            console.error('Chyba pri načítaní superstructure tímov:', error);
            setSuperstructureTeams({});
        });

        return () => unsubscribeSuperstructure();
    }, []);

    // NOVÝ LISTENER: Načítanie všetkých používateľov z kolekcie users
    useEffect(() => {
        if (!window.db) return;

        console.log('Načítavam používateľov z kolekcie users...');

        const unsubscribeUsers = onSnapshot(query(collection(window.db, 'users')), (querySnapshot) => {
            const usersList = [];
            
            querySnapshot.forEach((doc) => {
                const userData = doc.data();
                usersList.push({
                    id: doc.id,
                    email: userData.email,
                    displayName: userData.displayName,
                    role: userData.role,
                    approved: userData.approved,
                    createdAt: userData.createdAt,
                    teams: userData.teams || {},
                    hallId: userData.hallId,
                    // ďalšie polia podľa potreby
                });
            });
            
            setUsers(usersList);
            
            // VYPÍŠEME VŠETKÝCH POUŽÍVATEĽOV
            logAllUsers(usersList);
            
        }, (error) => {
            console.error('Chyba pri načítaní používateľov:', error);
        });

        return () => unsubscribeUsers();
    }, []); // Prázdne pole závislostí - spustí sa raz pri načítaní

    // Načítanie zápasov pre túto halu
    useEffect(() => {
        if (!window.db || !hallId) {
            setLoading(false);
            return;
        }

        console.log(`Načítavam zápasy pre halu ${hallId}...`);

        const matchesRef = collection(window.db, 'matches');
        const q = query(matchesRef, where("hallId", "==", hallId));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const loadedMatches = [];
            snapshot.forEach((doc) => {
                loadedMatches.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            // Zoradíme podľa času
            loadedMatches.sort((a, b) => {
                if (!a.scheduledTime) return 1;
                if (!b.scheduledTime) return -1;
                return a.scheduledTime.toDate() - b.scheduledTime.toDate();
            });
            
            setMatches(loadedMatches);
            
            // Zoskupenie podľa dňa
            const grouped = {};
            loadedMatches.forEach(match => {
                if (match.scheduledTime) {
                    const date = match.scheduledTime.toDate();
                    const dateStr = getLocalDateStr(date);
                    
                    if (!grouped[dateStr]) {
                        grouped[dateStr] = {
                            date: date,
                            dateStr: dateStr,
                            matches: []
                        };
                    }
                    grouped[dateStr].matches.push(match);
                }
            });
            
            setGroupedMatches(grouped);
            setLoading(false);
            
            console.log(`Načítaných ${loadedMatches.length} zápasov pre halu ${hallId}`);
            
            // VÝPIS KAŽDÉHO ZÁPASU DO KONZOLY
            console.log('=== VŠETKY ZÁPASY V TEJTO HALE ===');
            loadedMatches.forEach((match, index) => {
                const homeTeamName = getTeamNameByIdentifier(match.homeTeamIdentifier);
                const awayTeamName = getTeamNameByIdentifier(match.awayTeamIdentifier);
                const matchTime = match.scheduledTime ? formatTime(match.scheduledTime) : 'neurčený';
                const matchDate = match.scheduledTime ? formatDateWithDay(match.scheduledTime.toDate()) : 'neurčený';
                const categoryName = match.categoryName || 'Neznáma kategória';
                
                console.log(`Zápas #${index + 1}:`);
                console.log(`  ID: ${match.id}`);
                console.log(`  Dátum: ${matchDate}`);
                console.log(`  Čas: ${matchTime}`);
                console.log(`  Kategória: ${categoryName}`);
                console.log(`  Skupina: ${match.groupName || 'neurčená'}`);
                console.log(`  Domáci: ${homeTeamName} (${match.homeTeamIdentifier})`);
                console.log(`  Hostia: ${awayTeamName} (${match.awayTeamIdentifier})`);
                console.log(`  Status: ${match.status || 'neurčený'}`);
                if (match.isPlacementMatch) {
                    console.log(`  Typ: Zápas o ${match.placementRank}. miesto`);
                }
                console.log('---');
            });
            console.log(`Celkový počet zápasov: ${loadedMatches.length}`);
            console.log('=================================');
            
            // Skontrolujeme URL parametre pre domácich a hostí
            const homeIdentifierFromUrl = getUrlParameter('domaci');
            const awayIdentifierFromUrl = getUrlParameter('hostia');
            
            if (homeIdentifierFromUrl && awayIdentifierFromUrl && !selectedMatch) {
                // Hľadáme zápas, ktorý má oba identifikátory
                const matchFromUrl = loadedMatches.find(m => 
                    m.homeTeamIdentifier === homeIdentifierFromUrl && 
                    m.awayTeamIdentifier === awayIdentifierFromUrl
                );
                
                if (matchFromUrl) {
                    setSelectedMatch(matchFromUrl);
                }
            }
            
        }, (error) => {
            console.error("Chyba pri načítaní zápasov:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [hallId]);

    // FUNKCIA NA ZÍSKANIE NÁZVU TÍMU PODĽA IDENTIFIKÁTORA - TERAZ POUŽÍVA DÁTA Z USERS AJ SUPERSTRUCTURE
    const getTeamNameByIdentifier = (identifier) => {
        if (!identifier) return 'Neznámy tím';
        
        // Parsujeme identifikátor v tvare "kategória skupinaorder" (napr. "U12 D F4")
        const parts = identifier.split(' ');
        
        if (parts.length < 2) {
            return identifier; // Fallback na identifikátor
        }
        
        // Posledná časť je skupina + order (napr. "F4")
        const groupAndOrder = parts.pop();
        // Zvyšok je kategória (môže byť viacslovná, napr. "U12 D")
        const category = parts.join(' ');
        
        // Rozdelíme groupAndOrder na groupName a order
        // Order je číselná časť na konci, groupName je zvyšok
        let groupLetter = '';
        let order = '';
        
        for (let i = 0; i < groupAndOrder.length; i++) {
            const char = groupAndOrder[i];
            if (char >= '0' && char <= '9') {
                order = groupAndOrder.substring(i);
                groupLetter = groupAndOrder.substring(0, i);
                break;
            }
        }
        
        if (!order) {
            order = '?';
            groupLetter = groupAndOrder;
        }
        
        // Vytvoríme názov skupiny v tvare "skupina X" (napr. "F" -> "skupina F")
        const fullGroupName = `skupina ${groupLetter}`;
        const orderNum = parseInt(order, 10);
        
        console.log(`Hľadám tím: Kategória: ${category}, Skupina: ${fullGroupName}, Poradie: ${orderNum}`);
        
        // Hľadáme v users (načítaných používateľoch)
        if (users && users.length > 0) {
            for (const user of users) {
                if (!user.teams) continue;
                
                const userTeams = user.teams[category];
                if (!userTeams || !Array.isArray(userTeams)) continue;
                
                const team = userTeams.find(t => 
                    t.groupName === fullGroupName && 
                    t.order === orderNum
                );
                
                if (team) {
                    console.log(`  Nájdený používateľský tím: ${team.teamName} (používateľ: ${user.email})`);
                    
                    // VYPÍSANIE CELÉHO DOKUMENTU POUŽÍVATEĽA
                    console.log('=== CELÝ DOKUMENT POUŽÍVATEĽA ===');
                    console.log('ID používateľa:', user.id);
                    console.log('Email:', user.email);
                    console.log('Meno:', user.displayName);
                    console.log('Rola:', user.role);
                    console.log('Schválený:', user.approved);
                    console.log('Dátum vytvorenia:', user.createdAt);
                    console.log('ID haly:', user.hallId);
                    console.log('Tímy používateľa:', JSON.stringify(user.teams, null, 2));
                    console.log('================================');
                    
                    return team.teamName;
                }
            }
        }
        
        // Pre superstructure tímy - hľadáme podľa kategórie a skupiny+poradia
        if (superstructureTeams && Object.keys(superstructureTeams).length > 0) {
            const categoryTeams = superstructureTeams[category] || [];
            
            console.log(`  Hľadám v superstructure tímoch, kategória ${category} má ${categoryTeams.length} tímov`);
            
            // V superstructure tímoch je názov vo formáte "Kategória ČísloPísmeno" (napr. "U12 D 2B")
            // Potrebujeme nájsť tím, ktorý je v skupine fullGroupName a má order = orderNum
            // Ale v superstructure tímoch order nie je priamo poradie, ale je to order v rámci skupiny
            
            // Najprv získame všetky tímy v tejto skupine
            const teamsInGroup = categoryTeams.filter(t => t.groupName === fullGroupName);
            
            console.log(`    V skupine ${fullGroupName} je ${teamsInGroup.length} tímov`);
            
            // Zoradíme ich podľa poradia
            const sortedTeams = [...teamsInGroup].sort((a, b) => {
                const orderA = a.order !== null && a.order !== undefined ? a.order : Infinity;
                const orderB = b.order !== null && b.order !== undefined ? b.order : Infinity;
                return orderA - orderB;
            });
            
            // Vypíšeme všetky tímy v skupine pre debug
            sortedTeams.forEach((t, idx) => {
                console.log(`      ${idx+1}. ${t.teamName} (order: ${t.order})`);
            });
            
            // Hľadáme tím s týmto poradím
            if (orderNum <= sortedTeams.length && orderNum >= 1) {
                const foundTeam = sortedTeams[orderNum - 1];
                console.log(`    Nájdený superstructure tím na pozícii ${orderNum}: ${foundTeam.teamName}`);
                return foundTeam.teamName;
            } else {
                console.log(`    Poradie ${orderNum} je mimo rozsahu (1-${sortedTeams.length})`);
            }
        }
        
        // Fallback
        console.log(`  Tím NENájdený, používam fallback`);
        return `${category} ${groupLetter}${order}`;
    };

    // FUNKCIA NA ZÍSKANIE KOMPLETNÝCH INFORMÁCIÍ O TÍME
    const getTeamDetails = (identifier) => {
        if (!identifier) return null;
        
        // Parsujeme identifikátor v tvare "kategória skupinaorder" (napr. "U12 D F4")
        const parts = identifier.split(' ');
        
        if (parts.length < 2) {
            return null;
        }
        
        // Posledná časť je skupina + order (napr. "F4")
        const groupAndOrder = parts.pop();
        // Zvyšok je kategória (môže byť viacslovná, napr. "U12 D")
        const category = parts.join(' ');
        
        // Rozdelíme groupAndOrder na groupName a order
        let groupLetter = '';
        let order = '';
        
        for (let i = 0; i < groupAndOrder.length; i++) {
            const char = groupAndOrder[i];
            if (char >= '0' && char <= '9') {
                order = groupAndOrder.substring(i);
                groupLetter = groupAndOrder.substring(0, i);
                break;
            }
        }
        
        if (!order) {
            order = '?';
            groupLetter = groupAndOrder;
        }
        
        // Vytvoríme názov skupiny v tvare "skupina X" (napr. "F" -> "skupina F")
        const fullGroupName = `skupina ${groupLetter}`;
        const orderNum = parseInt(order, 10);
        
        // Hľadáme v users
        if (users && users.length > 0) {
            for (const user of users) {
                if (!user.teams) continue;
                
                const userTeams = user.teams[category];
                if (!userTeams || !Array.isArray(userTeams)) continue;
                
                const team = userTeams.find(t => 
                    t.groupName === fullGroupName && 
                    t.order === orderNum
                );
                
                if (team) {
                    return {
                        team,
                        userEmail: user.email,
                        userId: user.id,
                        userDisplayName: user.displayName
                    };
                }
            }
        }
        
        return null;
    };

    // FUNKCIA PRE ZOBRAZENIE VŠETKÝCH ZÁPASOV
    const showAllMatches = () => {
        setSelectedMatch(null);
        updateUrlParameters(null, null); // Odstránime parametre z URL
    };

    // FUNKCIA PRE VÝBER ZÁPASU
     const selectMatch = (match) => {
        setSelectedMatch(match);
        updateUrlParameters(match.homeTeamIdentifier, match.awayTeamIdentifier);
    };

    // Zoradenie dní podľa dátumu
    const sortedDays = Object.values(groupedMatches).sort((a, b) => 
        a.date - b.date
    );

    // Ak je vybraný zápas, zobrazíme detail
    if (selectedMatch) {
        const homeTeamName = getTeamNameByIdentifier(selectedMatch.homeTeamIdentifier);
        const awayTeamName = getTeamNameByIdentifier(selectedMatch.awayTeamIdentifier);
        const homeTeamDetails = getTeamDetails(selectedMatch.homeTeamIdentifier);
        const awayTeamDetails = getTeamDetails(selectedMatch.awayTeamIdentifier);
        const matchDate = selectedMatch.scheduledTime ? formatDateWithDay(selectedMatch.scheduledTime.toDate()) : 'neurčený';
        const matchTime = selectedMatch.scheduledTime ? formatTime(selectedMatch.scheduledTime) : '--:--';
        const category = categories.find(c => c.name === selectedMatch.categoryName);
        
        // Zistenie, či má zápas typ (finále, semifinále, o umiestnenie)
        const hasMatchType = selectedMatch.isPlacementMatch || selectedMatch.matchType;
        
        // Získanie zoradených zápasov podľa času pre navigáciu
        const sortedMatchesForNavigation = [...matches].sort((a, b) => {
            if (!a.scheduledTime) return 1;
            if (!b.scheduledTime) return -1;
            return a.scheduledTime.toDate() - b.scheduledTime.toDate();
        });
        
        // Nájdenie indexu aktuálneho zápasu v zoradenom zozname
        const currentIndex = sortedMatchesForNavigation.findIndex(m => m.id === selectedMatch.id);
        
        // Zistenie, či existuje predchádzajúci a nasledujúci zápas
        const hasPrevious = currentIndex > 0;
        const hasNext = currentIndex < sortedMatchesForNavigation.length - 1;
        
        // Funkcie pre navigáciu
        const goToPreviousMatch = () => {
            if (hasPrevious) {
                const previousMatch = sortedMatchesForNavigation[currentIndex - 1];
                selectMatch(previousMatch);
            }
        };
        
        const goToNextMatch = () => {
            if (hasNext) {
                const nextMatch = sortedMatchesForNavigation[currentIndex + 1];
                selectMatch(nextMatch);
            }
        };
    
        return React.createElement(
            'div',
            { className: 'flex-grow flex justify-center items-start p-4' },
            React.createElement(
                'div',
                { className: 'w-full max-w-6xl bg-white rounded-xl shadow-xl p-8' },
                
                // Hlavička s názvom haly a navigačnými tlačidlami
                React.createElement(
                    'div',
                    { className: 'flex flex-col items-center justify-center mb-8 p-4 -mx-8 -mt-8 rounded-t-xl bg-gradient-to-r from-red-50 to-white border-b border-red-200 relative' },
                    
                    // Tlačidlo "Všetky zápasy" v ľavom hornom rohu
                    React.createElement(
                        'button',
                        { 
                            onClick: showAllMatches,
                            className: 'absolute left-4 top-4 flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors text-gray-700 font-medium'
                        },
                        React.createElement('i', { className: 'fa-solid fa-arrow-left' }),
                        'Všetky zápasy'
                    ),
                    
                    // Navigačné tlačidlá v pravom hornom rohu
                    React.createElement(
                        'div',
                        { className: 'absolute right-4 top-4 flex items-center gap-2' },
                        
                        // Tlačidlo Predchádzajúci zápas (zobrazí sa len ak existuje)
                        hasPrevious && React.createElement(
                            'button',
                            { 
                                onClick: goToPreviousMatch,
                                className: 'flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors text-gray-700 font-medium'
                            },
                            React.createElement('i', { className: 'fa-solid fa-chevron-left' }),
                            'Predchádzajúci'
                        ),
                        
                        // Tlačidlo Nasledujúci zápas (zobrazí sa len ak existuje)
                        hasNext && React.createElement(
                            'button',
                            { 
                                onClick: goToNextMatch,
                                className: 'flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors text-gray-700 font-medium'
                            },
                            'Nasledujúci',
                            React.createElement('i', { className: 'fa-solid fa-chevron-right' })
                        )
                    ),
                    
                    React.createElement('h2', { className: 'text-3xl font-bold tracking-tight text-center text-gray-800' }, 'Detail zápasu'),
                    hallName && hallName !== 'Žiadna priradená hala' && React.createElement(
                        'div',
                        { className: 'mt-2 text-xl text-gray-600 flex items-center gap-2' },
                        React.createElement('i', { className: 'fa-solid fa-location-dot text-red-500' }),
                        `Športová hala ${hallName}`
                    )
                ),
    
                // Detail zápasu
                React.createElement(
                    'div',
                    { className: 'mx-auto' },
                    
                    // Dátum a čas
                    React.createElement(
                        'div',
                        { className: 'text-center mb-8 p-4 bg-blue-50 rounded-lg' },
                        React.createElement('div', { className: 'text-lg font-semibold text-gray-700' }, matchDate),
                        React.createElement(
                            'div', 
                            { className: 'text-2xl font-bold text-blue-600 mt-1 flex items-center justify-center gap-1' },
                            `${matchTime} hod.`
                        )
                    ),
                    
                    // Tímy
                    React.createElement(
                        'div',
                        { className: 'flex items-center justify-between gap-4 mb-8' },
                        
                        // Domáci tím
                        React.createElement(
                            'div',
                            { className: 'flex-1 text-center' },
                            React.createElement('div', { className: 'text-sm text-gray-500 mb-2' }, 'DOMÁCI'),
                            React.createElement('div', { className: 'text-xl font-bold text-gray-800' }, homeTeamName)
                        ),
                        
                        // VS
                        React.createElement(
                            'div',
                            { className: 'text-center' },
                            React.createElement('div', { className: 'text-3xl font-bold text-gray-400' }, 'VS')
                        ),
                        
                        // Hosťovský tím
                        React.createElement(
                            'div',
                            { className: 'flex-1 text-center' },
                            React.createElement('div', { className: 'text-sm text-gray-500 mb-2' }, 'HOSTIA'),
                            React.createElement('div', { className: 'text-xl font-bold text-gray-800' }, awayTeamName)
                        )
                    ),
                    
                    // Kategória a typ zápasu/skupina
                    React.createElement(
                        'div',
                        { className: 'grid grid-cols-2 gap-4 mb-6' },
                        React.createElement(
                            'div',
                            { className: 'bg-gray-50 p-3 rounded-lg text-center' },
                            React.createElement('div', { className: 'text-xs text-gray-500 mb-1' }, 'Kategória'),
                            React.createElement('div', { className: 'font-medium' }, selectedMatch.categoryName || 'neurčená')
                        ),
                        
                        // Ak má zápas typ, zobrazíme TYP ZÁPASU (aj keď má skupinu, skupina sa ignoruje)
                        hasMatchType ? React.createElement(
                            'div',
                            { className: 'bg-purple-50 p-3 rounded-lg text-center' },
                            React.createElement('div', { className: 'text-xs text-purple-500 mb-1' }, 'Typ zápasu'),
                            React.createElement('div', { className: 'font-medium text-purple-700' },
                                selectedMatch.isPlacementMatch ? `Zápas o ${selectedMatch.placementRank}. miesto` : selectedMatch.matchType
                            )
                        ) : React.createElement(
                            'div',
                            { className: 'bg-gray-50 p-3 rounded-lg text-center' },
                            React.createElement('div', { className: 'text-xs text-gray-500 mb-1' }, 'Skupina'),
                            React.createElement('div', { className: 'font-medium' }, selectedMatch.groupName || 'neurčená')
                        )
                    ),
                    
                    // Status
                    React.createElement(
                        'div',
                        { className: 'bg-gray-50 p-3 rounded-lg text-center mb-8' },
                        React.createElement('div', { className: 'text-xs text-gray-500 mb-1' }, 'Status'),
                        React.createElement(
                            'div', 
                            { className: `font-medium ${selectedMatch.status === 'completed' ? 'text-green-600' : selectedMatch.status === 'in-progress' ? 'text-blue-600' : 'text-gray-600'}` },
                            selectedMatch.status === 'completed' ? 'Odohrané' :
                            selectedMatch.status === 'in-progress' ? 'Prebieha' : 'Naplánované'
                        )
                    ),
                    
                    // DETAILY TÍMOV - realizačný tím a hráči
                    React.createElement(
                        'div',
                        { className: 'grid grid-cols-2 gap-6' },
                        
                        // Domáci tím - detail
                        React.createElement(
                            'div',
                            { className: 'bg-gray-50 rounded-lg p-4 border border-gray-200' },
                            React.createElement(
                                'h3',
                                { className: 'font-bold text-lg text-gray-800 mb-3 text-center border-b border-gray-200 pb-2' },
                                'DOMÁCI - ',
                                homeTeamName
                            ),
                            
                            // Realizačný tím - UPRAVENÉ: odstránené zobrazenie pohlavia
                            React.createElement(
                                'div',
                                { className: 'mb-4' },
                                React.createElement(
                                    'h4',
                                    { className: 'font-semibold text-sm text-gray-700 mb-2 flex items-center gap-1' },
                                    React.createElement('i', { className: 'fa-solid fa-user-tie text-xs text-gray-500' }),
                                    'Realizačný tím'
                                ),
                                
                                homeTeamDetails ? React.createElement(
                                    'div',
                                    { className: 'space-y-2' },
                                    
                                    // Muži v realizačnom tíme - UPRAVENÉ: odstránené (muž)
                                    homeTeamDetails.team.menTeamMemberDetails && homeTeamDetails.team.menTeamMemberDetails.length > 0 && 
                                    homeTeamDetails.team.menTeamMemberDetails.map((member, idx) => 
                                        React.createElement(
                                            'div',
                                            { key: `home-men-${idx}`, className: 'bg-white p-2 rounded border border-gray-200 text-sm' },
                                            React.createElement(
                                                'div',
                                                { className: 'flex items-center gap-2' },
                                                React.createElement('i', { className: 'fa-solid fa-user text-gray-600 text-xs' }),
                                                React.createElement('span', { className: 'font-medium' }, `${member.firstName} ${member.lastName}`)
                                            )
                                        )
                                    ),
                                    
                                    // Ženy v realizačnom tíme - UPRAVENÉ: odstránené (žena)
                                    homeTeamDetails.team.womenTeamMemberDetails && homeTeamDetails.team.womenTeamMemberDetails.length > 0 && 
                                    homeTeamDetails.team.womenTeamMemberDetails.map((member, idx) => 
                                        React.createElement(
                                            'div',
                                            { key: `home-women-${idx}`, className: 'bg-white p-2 rounded border border-gray-200 text-sm' },
                                            React.createElement(
                                                'div',
                                                { className: 'flex items-center gap-2' },
                                                React.createElement('i', { className: 'fa-solid fa-user text-pink-600 text-xs' }),
                                                React.createElement('span', { className: 'font-medium' }, `${member.firstName} ${member.lastName}`)
                                            )
                                        )
                                    ),
                                    
                                    // Ak nie sú žiadni členovia realizačného tímu
                                    (!homeTeamDetails.team.menTeamMemberDetails || homeTeamDetails.team.menTeamMemberDetails.length === 0) &&
                                    (!homeTeamDetails.team.womenTeamMemberDetails || homeTeamDetails.team.womenTeamMemberDetails.length === 0) &&
                                    React.createElement(
                                        'div',
                                        { className: 'text-sm text-gray-500 italic p-2' },
                                        'Žiadni členovia realizačného tímu'
                                    )
                                ) : React.createElement(
                                    'div',
                                    { className: 'text-sm text-gray-500 italic p-2' },
                                    'Nedostupné'
                                )
                            ),
                            
                            // Hráči - UPRAVENÉ: namiesto veku zobrazujeme rok narodenia
                            React.createElement(
                                'div',
                                null,
                                React.createElement(
                                    'h4',
                                    { className: 'font-semibold text-sm text-gray-700 mb-2 flex items-center gap-1' },
                                    React.createElement('i', { className: 'fa-solid fa-users text-xs text-gray-500' }),
                                    `Hráči (${homeTeamDetails?.team.playerDetails?.length || 0})`
                                ),
                                
                                homeTeamDetails ? React.createElement(
                                    'div',
                                    { className: 'space-y-1' },
                                    homeTeamDetails.team.playerDetails && homeTeamDetails.team.playerDetails.length > 0 ? 
                                        [...homeTeamDetails.team.playerDetails]
                                            .sort((a, b) => {
                                                // Zoradenie podľa čísla dresu (ak existuje)
                                                const numA = a.jerseyNumber ? parseInt(a.jerseyNumber) || 999 : 999;
                                                const numB = b.jerseyNumber ? parseInt(b.jerseyNumber) || 999 : 999;
                                                return numA - numB;
                                            })
                                            .map((player, idx) => 
                                                React.createElement(
                                                    'div',
                                                    { key: `home-player-${idx}`, className: 'bg-white p-2 rounded border border-gray-200 text-sm' },
                                                    React.createElement(
                                                        'div',
                                                        { className: 'flex items-center gap-2 flex-wrap' },
                                                        React.createElement('i', { className: 'fa-solid fa-shirt text-gray-600 text-xs' }),
                                                        player.jerseyNumber && React.createElement(
                                                            'span',
                                                            { className: 'font-bold text-gray-700 text-xs bg-gray-100 px-1.5 py-0.5 rounded' },
                                                            `#${player.jerseyNumber}`
                                                        ),
                                                        React.createElement(
                                                            'span',
                                                            { className: 'font-medium' },
                                                            `${player.firstName} ${player.lastName}`
                                                        ),
                                                        player.dateOfBirth && React.createElement(
                                                            'span',
                                                            { className: 'text-xs text-gray-500' },
                                                            `(${new Date(player.dateOfBirth).getFullYear()})`
                                                        )
                                                    )
                                                )
                                            )
                                        : React.createElement(
                                            'div',
                                            { className: 'text-sm text-gray-500 italic p-2' },
                                            'Žiadni hráči'
                                        )
                                ) : React.createElement(
                                    'div',
                                    { className: 'text-sm text-gray-500 italic p-2' },
                                    'Nedostupné'
                                )
                            )
                        ),
                        
                        // Hosťovský tím - detail
                        React.createElement(
                            'div',
                            { className: 'bg-gray-50 rounded-lg p-4 border border-gray-200' },
                            React.createElement(
                                'h3',
                                { className: 'font-bold text-lg text-gray-800 mb-3 text-center border-b border-gray-200 pb-2' },
                                'HOSTIA - ',
                                awayTeamName
                            ),
                            
                            // Realizačný tím - UPRAVENÉ: odstránené zobrazenie pohlavia
                            React.createElement(
                                'div',
                                { className: 'mb-4' },
                                React.createElement(
                                    'h4',
                                    { className: 'font-semibold text-sm text-gray-700 mb-2 flex items-center gap-1' },
                                    React.createElement('i', { className: 'fa-solid fa-user-tie text-xs text-gray-500' }),
                                    'Realizačný tím'
                                ),
                                
                                awayTeamDetails ? React.createElement(
                                    'div',
                                    { className: 'space-y-2' },
                                    
                                    // Muži v realizačnom tíme - UPRAVENÉ: odstránené (muž)
                                    awayTeamDetails.team.menTeamMemberDetails && awayTeamDetails.team.menTeamMemberDetails.length > 0 && 
                                    awayTeamDetails.team.menTeamMemberDetails.map((member, idx) => 
                                        React.createElement(
                                            'div',
                                            { key: `away-men-${idx}`, className: 'bg-white p-2 rounded border border-gray-200 text-sm' },
                                            React.createElement(
                                                'div',
                                                { className: 'flex items-center gap-2' },
                                                React.createElement('i', { className: 'fa-solid fa-user text-gray-600 text-xs' }),
                                                React.createElement('span', { className: 'font-medium' }, `${member.firstName} ${member.lastName}`)
                                            )
                                        )
                                    ),
                                    
                                    // Ženy v realizačnom tíme - UPRAVENÉ: odstránené (žena)
                                    awayTeamDetails.team.womenTeamMemberDetails && awayTeamDetails.team.womenTeamMemberDetails.length > 0 && 
                                    awayTeamDetails.team.womenTeamMemberDetails.map((member, idx) => 
                                        React.createElement(
                                            'div',
                                            { key: `away-women-${idx}`, className: 'bg-white p-2 rounded border border-gray-200 text-sm' },
                                            React.createElement(
                                                'div',
                                                { className: 'flex items-center gap-2' },
                                                React.createElement('i', { className: 'fa-solid fa-user text-pink-600 text-xs' }),
                                                React.createElement('span', { className: 'font-medium' }, `${member.firstName} ${member.lastName}`)
                                            )
                                        )
                                    ),
                                    
                                    // Ak nie sú žiadni členovia realizačného tímu
                                    (!awayTeamDetails.team.menTeamMemberDetails || awayTeamDetails.team.menTeamMemberDetails.length === 0) &&
                                    (!awayTeamDetails.team.womenTeamMemberDetails || awayTeamDetails.team.womenTeamMemberDetails.length === 0) &&
                                    React.createElement(
                                        'div',
                                        { className: 'text-sm text-gray-500 italic p-2' },
                                        'Žiadni členovia realizačného tímu'
                                    )
                                ) : React.createElement(
                                    'div',
                                    { className: 'text-sm text-gray-500 italic p-2' },
                                    'Nedostupné'
                                )
                            ),
                            
                            // Hráči - UPRAVENÉ: namiesto veku zobrazujeme rok narodenia
                            React.createElement(
                                'div',
                                null,
                                React.createElement(
                                    'h4',
                                    { className: 'font-semibold text-sm text-gray-700 mb-2 flex items-center gap-1' },
                                    React.createElement('i', { className: 'fa-solid fa-users text-xs text-gray-500' }),
                                    `Hráči (${awayTeamDetails?.team.playerDetails?.length || 0})`
                                ),
                                
                                awayTeamDetails ? React.createElement(
                                    'div',
                                    { className: 'space-y-1' },
                                    awayTeamDetails.team.playerDetails && awayTeamDetails.team.playerDetails.length > 0 ? 
                                        [...awayTeamDetails.team.playerDetails]
                                            .sort((a, b) => {
                                                // Zoradenie podľa čísla dresu (ak existuje)
                                                const numA = a.jerseyNumber ? parseInt(a.jerseyNumber) || 999 : 999;
                                                const numB = b.jerseyNumber ? parseInt(b.jerseyNumber) || 999 : 999;
                                                return numA - numB;
                                            })
                                            .map((player, idx) => 
                                                React.createElement(
                                                    'div',
                                                    { key: `away-player-${idx}`, className: 'bg-white p-2 rounded border border-gray-200 text-sm' },
                                                    React.createElement(
                                                        'div',
                                                        { className: 'flex items-center gap-2 flex-wrap' },
                                                        React.createElement('i', { className: 'fa-solid fa-shirt text-gray-600 text-xs' }),
                                                        player.jerseyNumber && React.createElement(
                                                            'span',
                                                            { className: 'font-bold text-gray-700 text-xs bg-gray-100 px-1.5 py-0.5 rounded' },
                                                            `#${player.jerseyNumber}`
                                                        ),
                                                        React.createElement(
                                                            'span',
                                                            { className: 'font-medium' },
                                                            `${player.firstName} ${player.lastName}`
                                                        ),
                                                        player.dateOfBirth && React.createElement(
                                                            'span',
                                                            { className: 'text-xs text-gray-500' },
                                                            `(${new Date(player.dateOfBirth).getFullYear()})`
                                                        )
                                                    )
                                                )
                                            )
                                        : React.createElement(
                                            'div',
                                            { className: 'text-sm text-gray-500 italic p-2' },
                                            'Žiadni hráči'
                                        )
                                ) : React.createElement(
                                    'div',
                                    { className: 'text-sm text-gray-500 italic p-2' },
                                    'Nedostupné'
                                )
                            )
                        )
                    ),
                    
                    // Informácia o pozícii v zozname
                    React.createElement(
                        'div',
                        { className: 'text-center text-xs text-gray-400 mt-6' },
                        `${currentIndex + 1} / ${sortedMatchesForNavigation.length}`
                    )
                )
            )
        );
    }

    // Inak zobrazíme zoznam všetkých zápasov
    return React.createElement(
        'div',
        { className: 'flex-grow flex justify-center items-start p-4' },
        React.createElement(
            'div',
            { className: 'w-full max-w-6xl bg-white rounded-xl shadow-xl p-8' },
            
            // Hlavička s názvom haly
            React.createElement(
                'div',
                { className: 'flex flex-col items-center justify-center mb-8 p-4 -mx-8 -mt-8 rounded-t-xl bg-gradient-to-r from-red-50 to-white border-b border-red-200' },
                React.createElement('h2', { className: 'text-3xl font-bold tracking-tight text-center text-gray-800' }, 'Zápasy'),
                hallName && hallName !== 'Žiadna priradená hala' && React.createElement(
                    'div',
                    { className: 'mt-2 text-xl text-gray-600 flex items-center gap-2' },
                    React.createElement('i', { className: 'fa-solid fa-location-dot text-red-500' }),
                    `Športová hala ${hallName}`
                ),
                hallName === 'Žiadna priradená hala' && React.createElement(
                    'div',
                    { className: 'mt-2 text-lg text-gray-600' },
                    hallName
                )
            ),
    
            // Indikátor načítavania
            loading && React.createElement(
                'div',
                { className: 'flex justify-center items-center py-12' },
                React.createElement('div', { className: 'animate-spin rounded-full h-12 w-12 border-b-4 border-blue-500' })
            ),
    
            // Žiadne zápasy
            !loading && matches.length === 0 && React.createElement(
                'div',
                { className: 'text-center py-12 text-gray-500' },
                React.createElement('i', { className: 'fa-solid fa-calendar-xmark text-5xl mb-4 opacity-30' }),
                React.createElement('p', { className: 'text-xl' }, 'Pre túto halu nie sú naplánované žiadne zápasy')
            ),
    
            // Zápasy zoskupené podľa dní
            !loading && matches.length > 0 && React.createElement(
                'div',
                { className: 'space-y-8' },
                sortedDays.map((dayGroup) => 
                    React.createElement(
                        'div',
                        { key: dayGroup.dateStr, className: 'border border-gray-200 rounded-xl overflow-hidden shadow-sm' },
                        
                        // Hlavička dňa
                        React.createElement(
                            'div',
                            { className: 'bg-gray-50 px-6 py-3 border-b border-gray-200' },
                            React.createElement(
                                'h3',
                                { className: 'text-lg font-semibold text-gray-700 flex items-center gap-2' },
                                React.createElement('i', { className: 'fa-regular fa-calendar text-blue-500' }),
                                formatDateWithDay(dayGroup.date),
                                React.createElement(
                                    'span',
                                    { className: 'ml-2 text-sm font-normal text-gray-500' },
                                    `(${dayGroup.matches.length} ${dayGroup.matches.length === 1 ? 'zápas' : dayGroup.matches.length < 5 ? 'zápasy' : 'zápasov'})`
                                )
                            )
                        ),
    
                        // Zoznam zápasov pre tento deň
                        React.createElement(
                            'div',
                            { className: 'divide-y divide-gray-100' },
                            dayGroup.matches.map((match) => {
                                // Použijeme funkciu getTeamNameByIdentifier na získanie názvov tímov
                                const homeTeamName = getTeamNameByIdentifier(match.homeTeamIdentifier);
                                const awayTeamName = getTeamNameByIdentifier(match.awayTeamIdentifier);
                                const category = categories.find(c => c.name === match.categoryName);
                                
                                // Zistenie, či má zápas typ (finále, semifinále, o umiestnenie)
                                const hasMatchType = match.isPlacementMatch || match.matchType;
                                
                                // Príprava textu pre skupinu alebo typ zápasu
                                let groupOrTypeText = '';
                                let groupOrTypeClass = '';
                                
                                if (hasMatchType) {
                                    // Ak má zápas typ, zobrazíme typ
                                    if (match.isPlacementMatch) {
                                        groupOrTypeText = `o ${match.placementRank}. miesto`;
                                    } else {
                                        groupOrTypeText = match.matchType;
                                    }
                                    groupOrTypeClass = 'bg-purple-100 text-purple-700';
                                } else if (match.groupName) {
                                    // Ak má skupinu, zobrazíme skupinu
                                    groupOrTypeText = match.groupName;
                                    groupOrTypeClass = 'bg-green-100 text-green-700';
                                } else {
                                    // Ak nemá nič, zobrazíme pomlčku
                                    groupOrTypeText = '—';
                                    groupOrTypeClass = 'bg-gray-100 text-gray-500';
                                }
                                
                                return React.createElement(
                                    'div',
                                    { 
                                        key: match.id, 
                                        className: 'px-6 py-4 hover:bg-blue-50 transition-colors cursor-pointer',
                                        onClick: () => selectMatch(match)
                                    },
                                    React.createElement(
                                        'div',
                                        { className: 'flex flex-wrap items-center gap-4' },
                                        
                                        // Čas
                                        React.createElement(
                                            'div',
                                            { className: 'flex items-center gap-2 text-gray-600 min-w-[100px]' },
                                            React.createElement('i', { className: 'fa-regular fa-clock text-blue-500' }),
                                            React.createElement('span', { className: 'font-mono font-medium' }, formatTime(match.scheduledTime))
                                        ),
                                        
                                        // VS - ZOBRAZUJEME NÁZVY TÍMOV
                                        React.createElement(
                                            'div',
                                            { className: 'flex items-center gap-3 flex-1' },
                                            React.createElement(
                                                'span',
                                                { className: 'font-medium text-gray-800 text-right flex-1' },
                                                homeTeamName
                                            ),
                                            React.createElement('span', { className: 'text-xs font-bold text-gray-400 px-2' }, 'VS'),
                                            React.createElement(
                                                'span',
                                                { className: 'font-medium text-gray-800 flex-1' },
                                                awayTeamName
                                            )
                                        ),
                                        
                                        // Skupina alebo typ zápasu
                                        React.createElement(
                                            'span',
                                            { 
                                                className: `px-3 py-1 text-xs font-medium rounded-full ${groupOrTypeClass}`,
                                            },
                                            groupOrTypeText
                                        ),

                                        // Kategória (ak existuje)
                                        category && React.createElement(
                                            'span',
                                            { 
                                                className: 'px-3 py-1 text-xs font-medium rounded-full mr-2',
                                                style: { 
                                                    backgroundColor: '#EFF6FF',
                                                    color: '#1E40AF'
                                                }
                                            },
                                            category.name
                                        )
                                    )
                                );
                            })
                        )
                    )
                )
            )
        )
    );
};

// Premenná na sledovanie, či bol poslúcháč už nastavený
let isEmailSyncListenerSetup = false;

/**
 * Táto funkcia je poslúcháčom udalosti 'globalDataUpdated'.
 * Akonáhle sa dáta používateľa načítajú, vykreslí aplikáciu.
 */
const handleDataUpdateAndRender = (event) => {
    const userProfileData = event.detail;
    const rootElement = document.getElementById('root');

    if (userProfileData) {
        // Synchronizácia e-mailu
        if (window.auth && window.db && !isEmailSyncListenerSetup) {
//            console.log("matches-hall.js: Nastavujem poslúcháča na synchronizáciu e-mailu.");
            
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
                                
                                window.showGlobalNotification('E-mailová adresa bola automaticky aktualizovaná.', 'success');
                            }
                        }
                    } catch (error) {
                        console.error("Chyba pri synchronizácii e-mailu:", error);
                        window.showGlobalNotification('Nastala chyba pri synchronizácii e-mailovej adresy.', 'error');
                    }
                }
            });
            isEmailSyncListenerSetup = true;
        }

        if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
            const root = ReactDOM.createRoot(rootElement);
            root.render(React.createElement(matchesHallApp, { userProfileData }));
//            console.log("matches-hall.js: Aplikácia bola vykreslená.");
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

// Registrácia poslúcháča
window.addEventListener('globalDataUpdated', handleDataUpdateAndRender);

// Kontrola existujúcich dát
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
