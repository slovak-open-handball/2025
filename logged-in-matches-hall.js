// logged-in-matches-hall.js
import { collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const { useState, useEffect } = React;

// Funkcia na formátovanie dátumu a času
const formatMatchDateTime = (timestamp) => {
    if (!timestamp) return null;
    try {
        const date = timestamp.toDate();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return { time: `${hours}:${minutes}`, dateObj: date };
    } catch (e) {
        return null;
    }
};

const formatDateHeader = (date) => {
    const days = ['Nedeľa', 'Pondelok', 'Utorok', 'Streda', 'Štvrtok', 'Piatok', 'Sobota'];
    const dayName = days[date.getDay()];
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${dayName} ${day}. ${month}. ${year}`;
};

// Funkcia na získanie farby kategórie z databázy
const getCategoryDrawColor = (categoryId) => {
    if (!window.categoryDrawColors || !categoryId) return '#3B82F6';
    
    const color = window.categoryDrawColors[categoryId];
    if (color && color !== '#3B82F6') return color;
    
    return '#3B82F6';
};

// Funkcia na vytvorenie svetlejšej verzie farby (80% bledšia)
const getLighterColor = (color) => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    const lighterR = Math.min(255, Math.floor(r + (255 - r) * 0.8));
    const lighterG = Math.min(255, Math.floor(g + (255 - g) * 0.8));
    const lighterB = Math.min(255, Math.floor(b + (255 - b) * 0.8));
    
    return `#${lighterR.toString(16).padStart(2, '0')}${lighterG.toString(16).padStart(2, '0')}${lighterB.toString(16).padStart(2, '0')}`;
};

// Funkcia na získanie farieb podľa typu skupiny z databázy
const getGroupTypeColors = (groupName, categoryId, groupsData) => {
    // Predvolené farby pre základnú skupinu
    let result = {
        backgroundColor: '#DCFCE7',
        textColor: '#166534'
    };
    
    // Ak nemáme dáta o skupinách, vrátime predvolené
    if (!groupsData || !categoryId) return result;
    
    // Nájdenie skupiny podľa názvu v danej kategórii
    const categoryGroups = groupsData[categoryId] || [];
    const foundGroup = categoryGroups.find(g => g.name === groupName);
    
    if (foundGroup) {
        if (foundGroup.type === 'nadstavbová skupina') {
            result = {
                backgroundColor: '#DBEAFE',
                textColor: '#1E40AF'
            };
        } else if (foundGroup.type === 'základná skupina') {
            result = {
                backgroundColor: '#DCFCE7',
                textColor: '#166534'
            };
        }
    }
    
    return result;
};

// Funkcia na získanie farieb pre zápas (podľa typu zápasu a skupiny)
const getMatchColors = (match, groupsData) => {
    // Zápas o umiestnenie (placement match)
    if (match.isPlacementMatch) {
        return {
            backgroundColor: '#F3E8FF',
            textColor: '#6B21A5'
        };
    }
    
    // Zápas z pavúka (playoff / elimination)
    if (match.matchType === 'Playoff' || match.matchType === 'Semifinále' || 
        match.matchType === 'Finále' || match.matchType === 'Štvrťfinále' ||
        match.matchType === 'Osemfinále' || (match.matchType && match.matchType.includes('finále'))) {
        return {
            backgroundColor: '#F3E8FF',
            textColor: '#6B21A5'
        };
    }
    
    // Podľa skupiny z databázy
    if (match.groupName && match.categoryId) {
        return getGroupTypeColors(match.groupName, match.categoryId, groupsData);
    }
    
    // Predvolené - základná skupina
    return {
        backgroundColor: '#DCFCE7',
        textColor: '#166534'
    };
};

// Funkcia na získanie zobrazeného názvu tímu
const getDisplayTeamName = (teamIdentifier) => {
    if (!teamIdentifier) return '???';
    
    if (window.teamManager && typeof window.teamManager.getTeamNameByDisplayIdSync === 'function') {
        const teamName = window.teamManager.getTeamNameByDisplayIdSync(teamIdentifier);
        if (teamName && teamName !== teamIdentifier) return teamName;
    }
    
    return teamIdentifier;
};

// Hlavný komponent
const MatchesHallApp = () => {
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [hallInfo, setHallInfo] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [teamNames, setTeamNames] = useState({});
    const [categoryDrawColors, setCategoryDrawColors] = useState({});
    const [groupsData, setGroupsData] = useState({}); // Dáta o skupinách z databázy

    // Načítanie farieb kategórií z databázy
    const loadCategoryColors = async () => {
        if (!window.db) return;
        
        try {
            const settingsRef = doc(window.db, 'settings', 'categories');
            const settingsSnap = await getDoc(settingsRef);
            
            if (settingsSnap.exists()) {
                const data = settingsSnap.data();
                const colors = {};
                
                Object.entries(data).forEach(([catId, catData]) => {
                    if (catData.drawColor) {
                        colors[catId] = catData.drawColor;
                    }
                });
                
                setCategoryDrawColors(colors);
                window.categoryDrawColors = colors;
            }
        } catch (err) {
            console.error('Chyba pri načítaní farieb kategórií:', err);
        }
    };

    // Načítanie skupín z databázy
    const loadGroupsData = async () => {
        if (!window.db) return;
        
        try {
            const groupsRef = doc(window.db, 'settings', 'groups');
            const groupsSnap = await getDoc(groupsRef);
            
            if (groupsSnap.exists()) {
                const data = groupsSnap.data();
                setGroupsData(data);
                window.groupsData = data; // Uloženie do globálneho priestoru
                console.log("[Groups Data] Načítané skupiny:", data);
            }
        } catch (err) {
            console.error('Chyba pri načítaní skupín:', err);
        }
    };

    // Načítanie informácií o hale
    const loadHallInfo = async (hallId) => {
        if (!window.db || !hallId) return;
        
        try {
            const hallRef = doc(window.db, 'places', hallId);
            const hallSnap = await getDoc(hallRef);
            if (hallSnap.exists()) {
                setHallInfo({ id: hallSnap.id, ...hallSnap.data() });
            }
        } catch (err) {
            console.error('Chyba pri načítaní haly:', err);
        }
    };

    // Spracovanie názvov tímov pre všetky zápasy
    const processTeamNames = (matches) => {
        const names = { ...teamNames };
        
        matches.forEach(match => {
            if (match.homeTeamIdentifier) {
                const homeKey = match.homeTeamIdentifier;
                if (!names[homeKey]) {
                    names[homeKey] = getDisplayTeamName(homeKey);
                }
            }
            if (match.awayTeamIdentifier) {
                const awayKey = match.awayTeamIdentifier;
                if (!names[awayKey]) {
                    names[awayKey] = getDisplayTeamName(awayKey);
                }
            }
        });
        
        setTeamNames(names);
    };

    // Načítanie zápasov
    const loadMatches = async (hallId) => {
        if (!window.db) {
            setError('Databáza nie je inicializovaná');
            setLoading(false);
            return;
        }

        if (!hallId) {
            setError('Používateľ nemá priradenú žiadnu halu');
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const matchesRef = collection(window.db, 'matches');
            const querySnapshot = await getDocs(matchesRef);
            
            const hallMatches = [];
            
            querySnapshot.forEach((doc) => {
                const match = {
                    id: doc.id,
                    ...doc.data()
                };
                
                if (match.hallId === hallId) {
                    hallMatches.push(match);
                }
            });
            
            // Zoradenie podľa dátumu a času
            hallMatches.sort((a, b) => {
                if (!a.scheduledTime) return 1;
                if (!b.scheduledTime) return -1;
                try {
                    const timeA = a.scheduledTime.toDate().getTime();
                    const timeB = b.scheduledTime.toDate().getTime();
                    return timeA - timeB;
                } catch (e) {
                    return 0;
                }
            });
            
            setMatches(hallMatches);
            processTeamNames(hallMatches);
            
        } catch (err) {
            console.error('Chyba pri načítaní zápasov:', err);
            setError('Nepodarilo sa načítať zápasy: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // Inicializácia
    useEffect(() => {
        const init = async () => {
            if (window.globalUserProfileData) {
                setUserProfile(window.globalUserProfileData);
                const hallId = window.globalUserProfileData.hallId;
                if (hallId) {
                    await loadCategoryColors();
                    await loadGroupsData(); // Načítanie skupín
                    await loadHallInfo(hallId);
                    await loadMatches(hallId);
                } else {
                    setError('Používateľ nemá priradenú žiadnu halu');
                    setLoading(false);
                }
            }
        };

        if (window.globalUserProfileData) {
            init();
        } else {
            window.addEventListener('globalDataUpdated', init);
            return () => window.removeEventListener('globalDataUpdated', init);
        }
    }, []);

    // Zoskupenie zápasov podľa dní
    const getMatchesByDay = () => {
        const groups = {};
        
        matches.forEach(match => {
            if (match.scheduledTime) {
                try {
                    const date = match.scheduledTime.toDate();
                    const dateKey = date.toDateString();
                    if (!groups[dateKey]) {
                        groups[dateKey] = {
                            date: date,
                            matches: []
                        };
                    }
                    groups[dateKey].matches.push(match);
                } catch(e) {}
            }
        });
        
        return Object.values(groups).sort((a, b) => a.date - b.date);
    };

    if (loading) {
        return React.createElement(
            'div',
            { className: 'flex justify-center items-center py-16' },
            React.createElement('div', { className: 'animate-spin rounded-full h-12 w-12 border-b-4 border-blue-500' })
        );
    }

    if (error) {
        return React.createElement(
            'div',
            { className: 'bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center m-4' },
            React.createElement('i', { className: 'fa-solid fa-exclamation-triangle text-yellow-500 text-3xl mb-3' }),
            React.createElement('p', { className: 'text-yellow-700' }, error)
        );
    }

    const matchesByDay = getMatchesByDay();
    const totalMatches = matches.length;

    return React.createElement(
        'div',
        { className: 'max-w-7xl mx-auto px-4 py-6' },
        
        React.createElement(
            'div',
            { className: 'mb-8 text-center' },
            React.createElement('h1', { className: 'text-2xl font-bold text-gray-800' }, 'Zápasy'),
            React.createElement(
                'div',
                { className: 'flex items-center justify-center gap-2 mt-1' },
                React.createElement('i', { className: 'fa-solid fa-location-dot text-blue-500 text-sm' }),
                React.createElement('span', { className: 'text-gray-600' }, hallInfo?.name || 'Športová hala'),
                React.createElement('span', { className: 'text-gray-400 text-sm ml-2' }, `(${totalMatches} zápasov)`)
            )
        ),
        
        matchesByDay.length === 0 ? 
            React.createElement(
                'div',
                { className: 'text-center py-12 text-gray-500 bg-gray-50 rounded-xl' },
                React.createElement('i', { className: 'fa-solid fa-calendar-xmark text-5xl mb-3 opacity-50' }),
                React.createElement('p', { className: 'text-lg' }, 'Žiadne zápasy pre túto halu')
            ) :
            React.createElement(
                'div',
                { className: 'overflow-x-auto border border-gray-200 rounded-lg bg-white' },
                React.createElement(
                    'table',
                    { className: 'min-w-full divide-y divide-gray-200' },
                    
                    React.createElement(
                        'thead',
                        { className: 'bg-gray-50' },
                        React.createElement(
                            'tr',
                            null,
                            React.createElement('th', { className: 'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24' }, 'Čas'),
                            React.createElement('th', { className: 'px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider' }, 'Domáci'),
                            React.createElement('th', { className: 'px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20' }, 'VS'),
                            React.createElement('th', { className: 'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider' }, 'Hostia'),
                            React.createElement('th', { className: 'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48' }, 'Info')
                        )
                    ),
                    
                    React.createElement(
                        'tbody',
                        { className: 'divide-y divide-gray-100' },
                        matchesByDay.map((dayGroup, dayIndex) => {
                            const dayMatches = dayGroup.matches;
                            const dayDate = dayGroup.date;
                            const dayRows = [];
                            
                            dayRows.push(
                                React.createElement(
                                    'tr',
                                    { key: `day-${dayIndex}`, className: 'bg-blue-50' },
                                    React.createElement(
                                        'td',
                                        { colSpan: 5, className: 'px-4 py-4 text-left' },
                                        React.createElement(
                                            'div',
                                            { className: 'flex items-center gap-2' },
                                            React.createElement('i', { className: 'fa-regular fa-calendar text-blue-500 text-lg' }),
                                            React.createElement('span', { className: 'font-semibold text-gray-800 text-base' }, formatDateHeader(dayDate)),
                                            React.createElement('span', { className: 'text-sm text-gray-500 ml-2' }, `(${dayMatches.length} zápasov)`)
                                        )
                                    )
                                )
                            );
                            
                            dayMatches.forEach((match, matchIndex) => {
                                const dateTime = formatMatchDateTime(match.scheduledTime);
                                const isResultAvailable = match.homeScore !== undefined && match.awayScore !== undefined;
                                
                                const homeTeamDisplay = teamNames[match.homeTeamIdentifier] || getDisplayTeamName(match.homeTeamIdentifier);
                                const awayTeamDisplay = teamNames[match.awayTeamIdentifier] || getDisplayTeamName(match.awayTeamIdentifier);
                                
                                const categoryColor = getCategoryDrawColor(match.categoryId);
                                const lighterCategoryColor = getLighterColor(categoryColor);
                                
                                // Získanie farieb pre daný zápas (podľa typu skupiny z databázy)
                                const matchColors = getMatchColors(match, groupsData);
                                
                                const infoTags = [];
                                
                                // Tag pre typ zápasu (matchType)
                                if (match.matchType && !match.isPlacementMatch) {
                                    infoTags.push(
                                        React.createElement('span', { 
                                            key: 'type',
                                            className: 'inline-block text-xs px-2 py-0.5 rounded-full whitespace-nowrap',
                                            style: {
                                                backgroundColor: matchColors.backgroundColor,
                                                color: matchColors.textColor,
                                                fontWeight: '500'
                                            }
                                        },
                                        match.matchType
                                    ));
                                }
                                
                                // Tag pre zápas o umiestnenie
                                if (match.isPlacementMatch) {
                                    infoTags.push(
                                        React.createElement('span', { 
                                            key: 'placement',
                                            className: 'inline-block text-xs px-2 py-0.5 rounded-full whitespace-nowrap',
                                            style: {
                                                backgroundColor: '#F3E8FF',
                                                color: '#6B21A5',
                                                fontWeight: '500'
                                            }
                                        },
                                        `o ${match.placementRank}. miesto`
                                    ));
                                }
                                
                                // Tag pre skupinu - s farbou podľa typu z databázy
                                if (match.groupName) {
                                    const groupColors = getGroupTypeColors(match.groupName, match.categoryId, groupsData);
                                    
                                    infoTags.push(
                                        React.createElement('span', { 
                                            key: 'group',
                                            className: 'inline-block text-xs px-2 py-0.5 rounded-full whitespace-nowrap',
                                            style: {
                                                backgroundColor: groupColors.backgroundColor,
                                                color: groupColors.textColor,
                                                fontWeight: '500'
                                            }
                                        },
                                        match.groupName
                                    ));
                                }
                                
                                // Tag pre kategóriu
                                if (match.categoryName) {
                                    infoTags.push(
                                        React.createElement('span', { 
                                            key: 'category',
                                            className: 'inline-block text-xs px-2 py-0.5 rounded-full whitespace-nowrap',
                                            style: {
                                                backgroundColor: lighterCategoryColor,
                                                color: categoryColor,
                                                fontWeight: '500'
                                            }
                                        },
                                        match.categoryName
                                    ));
                                }
                                
                                dayRows.push(
                                    React.createElement(
                                        'tr',
                                        { key: `match-${dayIndex}-${matchIndex}`, className: 'hover:bg-gray-50 transition-colors' },
                                        
                                        React.createElement(
                                            'td',
                                            { className: 'px-4 py-3 whitespace-nowrap' },
                                            React.createElement(
                                                'div',
                                                { className: 'flex items-center gap-1' },
                                                React.createElement('i', { className: 'fa-regular fa-clock text-gray-400 text-xs' }),
                                                React.createElement('span', { className: 'font-mono font-medium text-gray-700 text-sm' }, dateTime?.time || '--:--')
                                            )
                                        ),
                                        
                                        React.createElement(
                                            'td',
                                            { className: 'px-4 py-3 whitespace-nowrap text-right' },
                                            React.createElement('span', { className: 'font-medium text-gray-800 text-sm' }, homeTeamDisplay)
                                        ),
                                        
                                        React.createElement(
                                            'td',
                                            { className: 'px-4 py-3 whitespace-nowrap text-center' },
                                            isResultAvailable ?
                                                React.createElement(
                                                    'div',
                                                    { className: 'flex items-center justify-center gap-1' },
                                                    React.createElement('span', { className: 'font-bold text-gray-800' }, match.homeScore),
                                                    React.createElement('span', { className: 'text-gray-400' }, ':'),
                                                    React.createElement('span', { className: 'font-bold text-gray-800' }, match.awayScore)
                                                ) :
                                                React.createElement('span', { className: 'text-gray-400 font-medium text-sm' }, 'VS')
                                        ),
                                        
                                        React.createElement(
                                            'td',
                                            { className: 'px-4 py-3 whitespace-nowrap text-left' },
                                            React.createElement('span', { className: 'font-medium text-gray-800 text-sm' }, awayTeamDisplay)
                                        ),
                                        
                                        React.createElement(
                                            'td',
                                            { className: 'px-4 py-3' },
                                            React.createElement(
                                                'div',
                                                { className: 'flex flex-col gap-1' },
                                                infoTags
                                            )
                                        )
                                    )
                                );
                            });
                            
                            return dayRows;
                        }).flat()
                    )
                )
            )
    );
};

// Renderovanie
const renderApp = () => {
    const rootElement = document.getElementById('root');
    if (rootElement && ReactDOM) {
        const root = ReactDOM.createRoot(rootElement);
        root.render(React.createElement(MatchesHallApp));
    }
};

if (window.db && window.globalUserProfileData) {
    renderApp();
} else {
    window.addEventListener('globalDataUpdated', () => {
        if (window.db && window.globalUserProfileData) {
            renderApp();
        }
    });
    setTimeout(() => {
        if (window.db && window.globalUserProfileData) {
            renderApp();
        }
    }, 3000);
}
