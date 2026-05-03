// Importy pre Firebase funkcie
import { collection, query, where, onSnapshot, getDoc, doc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const { useState, useEffect } = React;

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
    if (!timestamp) return '-- : --';
    try {
        const date = timestamp.toDate();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    } catch (e) {
        return '-- : --';
    }
};

const getLocalDateStr = (date) => {
    if (!date) return null;
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Hlavný komponent
const matchesHallApp = ({ userProfileData }) => {
    const hallId = userProfileData?.hallId;
    const [hallName, setHallName] = useState(null);
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [groupedMatches, setGroupedMatches] = useState({});
    const [categories, setCategories] = useState([]);
    const [categoryIdMap, setCategoryIdMap] = useState({});
    const [groupsData, setGroupsData] = useState({});

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
                setHallName(hallId || 'Chyba načítania');
            }
        };
        
        fetchHallName();
    }, [hallId]);

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
                    const idMap = {};
                    
                    Object.entries(data).forEach(([id, obj]) => {
                        const categoryName = obj.name || `Kategória ${id}`;
                        categoriesList.push({
                            id: id,
                            name: categoryName,
                            maxTeams: obj.maxTeams ?? 12,
                            maxPlayers: obj.maxPlayers ?? 12,
                            maxImplementationTeam: obj.maxImplementationTeam ?? 3,
                            periods: obj.periods ?? 2,
                            periodDuration: obj.periodDuration ?? 20,
                            breakDuration: obj.breakDuration ?? 2,
                            matchBreak: obj.matchBreak ?? 5,
                            drawColor: obj.drawColor ?? '#3B82F6',
                            transportColor: obj.transportColor ?? '#10B981',
                            dateFrom: obj.dateFrom ?? '',
                            dateTo: obj.dateTo ?? '',
                            dateFromActive: obj.dateFromActive ?? false,
                            dateToActive: obj.dateToActive ?? false,
                            timeoutCount: obj.timeoutCount ?? 2,
                            timeoutDuration: obj.timeoutDuration ?? 1,
                            exclusionTime: obj.exclusionTime ?? 2
                        });
                        
                        idMap[categoryName] = id;
                    });
                    
                    setCategories(categoriesList);
                    setCategoryIdMap(idMap);
                } else {
                    setCategories([]);
                    setCategoryIdMap({});
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

        const groupsRef = doc(window.db, 'settings', 'groups');
        const unsubscribe = onSnapshot(groupsRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setGroupsData(data);
            } else {
                setGroupsData({});
            }
        }, (error) => {
            console.error('Chyba pri načítaní skupín:', error);
        });
        
        return () => unsubscribe();
    }, []);

    // Načítanie zápasov pre halu
    useEffect(() => {
        if (!window.db) return;
        
        if (!hallId || typeof hallId !== 'string') {
            setLoading(false);
            return;
        }
        
        const matchesRef = collection(window.db, 'matches');
        const q = query(matchesRef, where("hallId", "==", hallId));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const loadedMatches = [];
            
            snapshot.forEach((doc) => {
                const data = doc.data();
                loadedMatches.push({
                    id: doc.id,
                    ...data,
                    currentPeriod: data.currentPeriod || 1,
                    manualTimeOffset: data.manualTimeOffset || 0
                });
            });
            
            // Zoradenie podľa času
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
        }, (error) => {
            console.error("Chyba pri načítaní zápasov:", error);
            setLoading(false);
        });
        
        return () => unsubscribe();
    }, [hallId]);

    // Zoradenie dní podľa dátumu
    const sortedDays = Object.values(groupedMatches).sort((a, b) => a.date - b.date);

    // Získanie názvu tímu z identifikátora (zjednodušená verzia)
    const getTeamNameFromIdentifier = (identifier) => {
        if (!identifier) return 'Neznámy tím';
        
        // Jednoduché parsovanie pre zobrazenie
        const parts = identifier.split(' ');
        if (parts.length >= 2) {
            const groupAndOrder = parts.pop();
            const category = parts.join(' ');
            
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
            
            if (order && groupLetter) {
                const orderNum = parseInt(order, 10);
                // Vrátime formátovaný názov
                return `${category} - skupina ${groupLetter}, poradie ${orderNum}`;
            }
        }
        
        return identifier;
    };

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
                                const homeTeamName = getTeamNameFromIdentifier(match.homeTeamIdentifier);
                                const awayTeamName = getTeamNameFromIdentifier(match.awayTeamIdentifier);
                                const category = categories.find(c => c.name === match.categoryName);
                                
                                // Zistenie, či má zápas typ
                                const hasMatchType = match.isPlacementMatch || match.matchType;
                                
                                let groupOrTypeText = '';
                                
                                if (hasMatchType) {
                                    if (match.isPlacementMatch) {
                                        groupOrTypeText = `o ${match.placementRank}. miesto`;
                                    } else {
                                        groupOrTypeText = match.matchType;
                                    }
                                } else if (match.groupName) {
                                    groupOrTypeText = match.groupName;
                                }
                                
                                // Zistenie stavu zápasu
                                const isMatchInProgress = match.status === 'in-progress' || match.status === 'paused';
                                
                                return React.createElement(
                                    'div',
                                    { 
                                        key: match.id, 
                                        className: 'px-6 py-4 hover:bg-blue-50 transition-colors'
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
                                        
                                        // VS
                                        React.createElement(
                                            'div',
                                            { className: 'flex items-center gap-3 flex-1' },
                                            React.createElement('span', { className: 'font-medium text-gray-800 text-right flex-1' }, homeTeamName),
                                            React.createElement('span', { className: 'text-xs font-bold text-gray-400 px-2' }, 'VS'),
                                            React.createElement('span', { className: 'font-medium text-gray-800 flex-1' }, awayTeamName)
                                        ),
                                        
                                        // Skupina alebo typ zápasu
                                        groupOrTypeText && React.createElement(
                                            'span',
                                            { 
                                                className: `px-3 py-1 text-xs font-medium rounded-full ${
                                                    hasMatchType 
                                                        ? 'bg-purple-100 text-purple-700' 
                                                        : 'bg-green-100 text-green-700'
                                                }`
                                            },
                                            groupOrTypeText
                                        ),
                                        
                                        // Kategória
                                        category && React.createElement(
                                            'span',
                                            { 
                                                className: 'px-3 py-1 text-xs font-medium rounded-full',
                                                style: { 
                                                    backgroundColor: `${category.drawColor}20`,
                                                    color: category.drawColor
                                                }
                                            },
                                            category.name
                                        ),
                                        
                                        // Status
                                        React.createElement(
                                            'span',
                                            { 
                                                className: `inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full ${
                                                    match.status === 'completed' 
                                                        ? 'bg-green-100 text-green-700' 
                                                        : isMatchInProgress
                                                        ? 'bg-yellow-100 text-yellow-700'
                                                        : 'bg-gray-100 text-gray-600'
                                                }`
                                            },
                                            match.status === 'completed' ? 'Odohrané' :
                                            isMatchInProgress ? 'Prebieha' : 'Naplánované'
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
        if (window.auth && window.db && !isEmailSyncListenerSetup) {
            // Jednoduchá synchronizácia e-mailu
            import("https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js").then(({ onAuthStateChanged }) => {
                onAuthStateChanged(window.auth, async (user) => {
                    if (user) {
                        try {
                            const userProfileRef = doc(window.db, 'users', user.uid);
                            const docSnap = await getDoc(userProfileRef);
                
                            if (docSnap.exists()) {
                                const firestoreEmail = docSnap.data().email;
                                if (user.email !== firestoreEmail) {
                                    const { updateDoc } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");
                                    await updateDoc(userProfileRef, { email: user.email });
                                }
                            }
                        } catch (error) {}
                    }
                });
            });
            isEmailSyncListenerSetup = true;
        }

        if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
            const root = ReactDOM.createRoot(rootElement);
            root.render(React.createElement(matchesHallApp, { userProfileData }));
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
