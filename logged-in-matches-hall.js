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
    const [users, setUsers] = useState([]); // NOVÝ STAV PRE POUŽÍVATEĽOV
    
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
                console.log('=== TÍMY V SKUPINÁCH (po aktualizácii) ===');
                logAllTeams(data.allTeams);
            });
            
            return () => {
                if (unsubscribe) unsubscribe();
            };
        } else if (window.__teamManagerData) {
            setTeamData(window.__teamManagerData);
            // VYPÍŠEME TÍMY PRI NAČÍTANÍ
            console.log('=== TÍMY V SKUPINÁCH (pri načítaní) ===');
            logAllTeams(window.__teamManagerData.allTeams);
        }
    }, []);

    // FUNKCIA PRE VYPISOVANIE VŠETKÝCH TÍMOV
    const logAllTeams = (teams) => {
        if (!teams || teams.length === 0) {
            console.log('Žiadne tímy nie sú k dispozícii');
            return;
        }
        
        console.log(`Celkový počet tímov: ${teams.length}`);
        
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

    // FUNKCIA PRE VYPISOVANIE VŠETKÝCH POUŽÍVATEĽOV V PREHĽADNEJ TABUĽKE
    const logAllUsers = (usersList) => {
        if (!usersList || usersList.length === 0) {
            console.log('Žiadni používatelia nie sú k dispozícii');
            return;
        }
        
        console.log('=== VŠETCI POUŽÍVATELIA Z KOLEKCIE USERS ===');
        console.log(`Celkový počet používateľov: ${usersList.length}`);
        console.log('');
        
        // Pre každého používateľa vypíšeme jeho tímy
        usersList.forEach((user, index) => {
            console.log(`Používateľ #${index + 1}: ${user.email || 'Neznámy email'} (ID: ${user.id})`);
            console.log(`  Rola: ${user.role || 'Nezadaná'} | Schválený: ${user.approved ? 'Áno' : 'Nie'}`);
            
            if (user.teams && Object.keys(user.teams).length > 0) {
                console.log(`  Tímy používateľa:`);
                
                // Získame všetky kategórie a zoradíme ich podľa abecedy
                const categories = Object.keys(user.teams).sort((a, b) => a.localeCompare(b));
                
                categories.forEach(categoryName => {
                    const teamArray = user.teams[categoryName] || [];
                    
                    if (teamArray.length > 0) {
                        console.log(`    Kategória: ${categoryName}`);
                        
                        // Zoskupíme tímy podľa skupiny
                        const teamsByGroup = {};
                        
                        teamArray.forEach(team => {
                            const groupName = team.groupName || 'Bez skupiny';
                            if (!teamsByGroup[groupName]) {
                                teamsByGroup[groupName] = [];
                            }
                            teamsByGroup[groupName].push(team);
                        });
                        
                        // Zoradíme skupiny podľa abecedy
                        const sortedGroups = Object.keys(teamsByGroup).sort((a, b) => {
                            // "Bez skupiny" dáme na koniec
                            if (a === 'Bez skupiny') return 1;
                            if (b === 'Bez skupiny') return -1;
                            return a.localeCompare(b);
                        });
                        
                        sortedGroups.forEach(groupName => {
                            const teamsInGroup = teamsByGroup[groupName];
                            
                            // Zoradíme tímy v skupine podľa poradia
                            const sortedTeams = [...teamsInGroup].sort((a, b) => {
                                const orderA = a.order !== null && a.order !== undefined ? a.order : Infinity;
                                const orderB = b.order !== null && b.order !== undefined ? b.order : Infinity;
                                return orderA - orderB;
                            });
                            
                            sortedTeams.forEach(team => {
                                const groupText = groupName !== 'Bez skupiny' ? `, skupina: ${groupName}` : '';
                                const orderText = team.order !== null && team.order !== undefined ? `, poradie: ${team.order}` : '';
                                console.log(`      - ${team.teamName}${groupText}${orderText}`);
                            });
                        });
                    }
                });
            } else {
                console.log(`  Žiadne tímy`);
            }
            
            console.log('  ---');
        });
        
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
//                    Object.entries(groupsData).forEach(([categoryId, groups], catIndex) => {
//                        // Nájdeme názov kategórie podľa ID
//                        const category = categories.find(c => c.id === categoryId);
//                        const categoryName = category ? category.name : `Neznáma kategória (ID: ${categoryId})`;
//                        
//                        console.log(`Kategória #${catIndex + 1}: ${categoryName} (ID: ${categoryId})`);
//                        console.log(`  Počet skupín: ${groups.length}`);
//                        
//                        // Rozdelíme skupiny podľa typu
//                        const basicGroups = groups.filter(g => g.type === 'základná skupina');
//                        const superGroups = groups.filter(g => g.type === 'nadstavbová skupina');
//                        
//                        console.log(`  Základné skupiny (${basicGroups.length}):`);
//                        basicGroups.forEach((group, groupIndex) => {
//                            console.log(`    ${groupIndex + 1}. ${group.name}`);
//                        });
//                        
//                        console.log(`  Nadstavbové skupiny (${superGroups.length}):`);
//                        superGroups.forEach((group, groupIndex) => {
//                            console.log(`    ${groupIndex + 1}. ${group.name}`);
//                        });
//                        console.log('  ---');
//                    });
//                    
//                    console.log('===========================================');
                    
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
                console.log(`  Hosť: ${awayTeamName} (${match.awayTeamIdentifier})`);
                console.log(`  Status: ${match.status || 'neurčený'}`);
                if (match.isPlacementMatch) {
                    console.log(`  Typ: Zápas o ${match.placementRank}. miesto`);
                }
                console.log('---');
            });
            console.log(`Celkový počet zápasov: ${loadedMatches.length}`);
            console.log('=================================');
            
        }, (error) => {
            console.error("Chyba pri načítaní zápasov:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [hallId]);

    // FUNKCIA NA ZÍSKANIE NÁZVU TÍMU PODĽA IDENTIFIKÁTORA - UPRAVENÁ PRE FORMÁT "skupina X"
    const getTeamNameByIdentifier = (identifier) => {
        if (!identifier) return 'Neznámy tím';
        
        // Parsujeme identifikátor v tvare "kategória skupinaorder" (napr. "U10 A1")
        const parts = identifier.split(' ');
        
        if (parts.length < 2) {
            return identifier; // Fallback na identifikátor
        }
        
        // Posledná časť je skupina + order (napr. "A1")
        const groupAndOrder = parts.pop();
        // Zvyšok je kategória (môže byť viacslovná)
        const category = parts.join(' ');
        
        // Rozdelíme groupAndOrder na groupName a order
        // Order je číselná časť na konci, groupName je zvyšok
        let groupName = '';
        let order = '';
        
        for (let i = 0; i < groupAndOrder.length; i++) {
            const char = groupAndOrder[i];
            if (char >= '0' && char <= '9') {
                order = groupAndOrder.substring(i);
                groupName = groupAndOrder.substring(0, i);
                break;
            }
        }
        
        if (!order) {
            order = '?';
            groupName = groupAndOrder;
        }
        
        // Vytvoríme názov skupiny v tvare "skupina X" (napr. "A" -> "skupina A")
        const fullGroupName = `skupina ${groupName}`;
        
        // Hľadáme v teamData
        if (teamData.allTeams && teamData.allTeams.length > 0) {
            const team = teamData.allTeams.find(t => 
                t.category === category && 
                t.groupName === fullGroupName && // Používame fullGroupName
                t.order?.toString() === order
            );
            
            if (team) {
                return team.teamName;
            }
        }
        
        // Skúsime v __teamManagerData
        if (window.__teamManagerData?.allTeams) {
            const team = window.__teamManagerData.allTeams.find(t => 
                t.category === category && 
                t.groupName === fullGroupName && // Používame fullGroupName
                t.order?.toString() === order
            );
            
            if (team) {
                setTeamData(window.__teamManagerData); // Aktualizujeme teamData
                return team.teamName;
            }
        }
        
        // Fallback - vrátime identifikátor v čitateľnej forme
        return `${category} ${groupName}${order}`;
    };

    // Zoradenie dní podľa dátumu
    const sortedDays = Object.values(groupedMatches).sort((a, b) => 
        a.date - b.date
    );

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
                                
                                return React.createElement(
                                    'div',
                                    { key: match.id, className: 'px-6 py-4 hover:bg-blue-50 transition-colors' },
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
                                        
                                        // VS - TERAZ ZOBRAZUJEME NÁZVY TÍMOV
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
                                        
                                        // Kategória (ak existuje)
                                        category && React.createElement(
                                            'span',
                                            { 
                                                className: 'px-3 py-1 text-xs font-medium rounded-full',
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
            console.log("matches-hall.js: Nastavujem poslúcháča na synchronizáciu e-mailu.");
            
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
            console.log("matches-hall.js: Aplikácia bola vykreslená.");
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
