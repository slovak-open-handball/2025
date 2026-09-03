// Nahraďte celý obsah súboru matches.js nasledujúcim kódom:

import { collection, getDocs, doc, getDoc, onSnapshot, updateDoc, Timestamp, addDoc, query, where, orderBy, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ============================================================
// POMOCNÉ FUNKCIE
// ============================================================

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

const getCategoryDrawColor = (categoryId) => {
    if (!window.categoryDrawColors || !categoryId) return '#3B82F6';
    const color = window.categoryDrawColors[categoryId];
    if (color && color !== '#3B82F6') return color;
    return '#3B82F6';
};

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

const getGroupTypeColors = (groupName, categoryId, groupsData) => {
    let result = { backgroundColor: '#DCFCE7', textColor: '#166534' };
    if (!groupsData || !categoryId) return result;
    const categoryGroups = groupsData[categoryId] || [];
    const foundGroup = categoryGroups.find(g => g.name === groupName);
    if (foundGroup) {
        if (foundGroup.type === 'nadstavbová skupina') {
            result = { backgroundColor: '#DBEAFE', textColor: '#1E40AF' };
        } else if (foundGroup.type === 'základná skupina') {
            result = { backgroundColor: '#DCFCE7', textColor: '#166534' };
        }
    }
    return result;
};

const getDisplayTeamName = (teamIdentifier) => {
    if (!teamIdentifier) return '???';
    if (window.teamManager && typeof window.teamManager.getTeamNameByDisplayIdSync === 'function') {
        const teamName = window.teamManager.getTeamNameByDisplayIdSync(teamIdentifier);
        if (teamName && teamName !== teamIdentifier) return teamName;
    }
    return teamIdentifier;
};

const getCategoryNameById = (categoryId) => {
    if (!categoryId) return null;
    if (window.categoriesData && window.categoriesData[categoryId]) {
        return window.categoriesData[categoryId];
    }
    if (window.categoriesList) {
        const found = window.categoriesList.find(cat => cat.id === categoryId);
        if (found) return found.name;
    }
    return null;
};

// ============================================================
// FUNKCIA NA ZÍSKANIE SKÓRE Z UDALOSTÍ
// ============================================================

const getCurrentScoreFromEvents = (events) => {
    if (!events || events.length === 0) {
        return { home: 0, away: 0 };
    }
    
    const sortedEvents = [...events].sort((a, b) => {
        if (a.minute !== b.minute) return (a.minute || 0) - (b.minute || 0);
        return (a.second || 0) - (b.second || 0);
    });
    
    const lastEvent = sortedEvents[sortedEvents.length - 1];
    
    if (lastEvent && lastEvent.scoreAfter) {
        return {
            home: lastEvent.scoreAfter.home || 0,
            away: lastEvent.scoreAfter.away || 0
        };
    }
    
    let homeScore = 0;
    let awayScore = 0;
    
    sortedEvents.forEach(event => {
        if (event.type === 'goal') {
            if (event.team === 'home') homeScore++;
            else if (event.team === 'away') awayScore++;
        } else if (event.type === 'penalty' && event.subType === 'scored') {
            if (event.team === 'home') homeScore++;
            else if (event.team === 'away') awayScore++;
        }
    });
    
    return { home: homeScore, away: awayScore };
};

// ============================================================
// KOMPONENT PRE ZOBRAZENIE TABULIEK SKUPÍN
// ============================================================

const GroupTablesView = ({ matches, categoriesData, groupsData, teamNames, hallNames }) => {
    const [groupTables, setGroupTables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [pointsForWin, setPointsForWin] = useState(3);
    const [sortingConditions, setSortingConditions] = useState([]);
    
    // Načítanie bodov za výhru a kritérií poradia z databázy
    useEffect(() => {
        const loadSettings = async () => {
            if (!window.db) return;
            try {
                const settingsRef = doc(window.db, 'settings', 'table');
                const settingsSnap = await getDoc(settingsRef);
                if (settingsSnap.exists()) {
                    const data = settingsSnap.data();
                    setPointsForWin(data.pointsForWin || 3);
                    setSortingConditions(data.sortingConditions || []);
                }
            } catch (err) {
                console.error('Chyba pri načítaní nastavení tabuľky:', err);
            }
        };
        loadSettings();
    }, []);
    
    // Výpočet tabuliek skupín
    useEffect(() => {
        if (!matches || matches.length === 0) {
            setLoading(false);
            return;
        }
        
        const calculateGroupTables = () => {
            const groupsMap = new Map();
            
            // Zoskupenie zápasov podľa kategórie a skupiny
            matches.forEach(match => {
                if (match.isPlacementMatch) return;
                if (!match.categoryName || !match.groupName) return;
                
                const key = `${match.categoryName}|${match.groupName}`;
                if (!groupsMap.has(key)) {
                    groupsMap.set(key, {
                        category: match.categoryName,
                        group: match.groupName,
                        matches: []
                    });
                }
                groupsMap.get(key).matches.push(match);
            });
            
            const tables = [];
            
            for (const [key, groupData] of groupsMap) {
                const { category, group, matches: groupMatches } = groupData;
                
                // Získanie všetkých tímov v skupine
                const teamsMap = new Map();
                groupMatches.forEach(match => {
                    if (match.homeTeamIdentifier && !teamsMap.has(match.homeTeamIdentifier)) {
                        const teamName = teamNames[match.homeTeamIdentifier] || getDisplayTeamName(match.homeTeamIdentifier);
                        teamsMap.set(match.homeTeamIdentifier, {
                            id: match.homeTeamIdentifier,
                            name: teamName,
                            played: 0,
                            wins: 0,
                            draws: 0,
                            losses: 0,
                            goalsFor: 0,
                            goalsAgainst: 0,
                            points: 0,
                            goalDifference: 0
                        });
                    }
                    if (match.awayTeamIdentifier && !teamsMap.has(match.awayTeamIdentifier)) {
                        const teamName = teamNames[match.awayTeamIdentifier] || getDisplayTeamName(match.awayTeamIdentifier);
                        teamsMap.set(match.awayTeamIdentifier, {
                            id: match.awayTeamIdentifier,
                            name: teamName,
                            played: 0,
                            wins: 0,
                            draws: 0,
                            losses: 0,
                            goalsFor: 0,
                            goalsAgainst: 0,
                            points: 0,
                            goalDifference: 0
                        });
                    }
                });
                
                // Spracovanie odohraných zápasov
                const completedMatches = groupMatches.filter(m => m.status === 'completed');
                completedMatches.forEach(match => {
                    const homeTeam = teamsMap.get(match.homeTeamIdentifier);
                    const awayTeam = teamsMap.get(match.awayTeamIdentifier);
                    
                    if (!homeTeam || !awayTeam) return;
                    
                    let homeScore = match.homeScore || 0;
                    let awayScore = match.awayScore || 0;
                    
                    // Ak nie je skóre v zápase, skúsime získať z udalostí
                    if (homeScore === 0 && awayScore === 0 && match.id) {
                        const events = window.matchTracker?.getEvents?.(match.id) || [];
                        const score = getCurrentScoreFromEvents(events);
                        homeScore = score.home;
                        awayScore = score.away;
                    }
                    
                    homeTeam.played++;
                    awayTeam.played++;
                    homeTeam.goalsFor += homeScore;
                    homeTeam.goalsAgainst += awayScore;
                    awayTeam.goalsFor += awayScore;
                    awayTeam.goalsAgainst += homeScore;
                    
                    if (homeScore > awayScore) {
                        homeTeam.wins++;
                        homeTeam.points += pointsForWin;
                        awayTeam.losses++;
                    } else if (awayScore > homeScore) {
                        awayTeam.wins++;
                        awayTeam.points += pointsForWin;
                        homeTeam.losses++;
                    } else {
                        homeTeam.draws++;
                        homeTeam.points += 1;
                        awayTeam.draws++;
                        awayTeam.points += 1;
                    }
                });
                
                // Výpočet rozdielu skóre
                const teams = Array.from(teamsMap.values());
                teams.forEach(team => {
                    team.goalDifference = team.goalsFor - team.goalsAgainst;
                });
                
                // Zoradenie tímov podľa kritérií
                teams.sort((a, b) => {
                    if (a.points !== b.points) return b.points - a.points;
                    if (a.goalDifference !== b.goalDifference) return b.goalDifference - a.goalDifference;
                    if (a.goalsFor !== b.goalsFor) return b.goalsFor - a.goalsFor;
                    return a.name.localeCompare(b.name);
                });
                
                // Určenie typu skupiny
                let groupType = 'základná';
                if (groupsData && groupsData[category]) {
                    const found = groupsData[category].find(g => g.name === group);
                    if (found) groupType = found.type === 'nadstavbová skupina' ? 'nadstavbová' : 'základná';
                }
                
                // Počty zápasov
                const totalMatches = groupMatches.length;
                const completedCount = completedMatches.length;
                const completionPercentage = totalMatches > 0 ? (completedCount / totalMatches * 100) : 0;
                const isFullyCompleted = completionPercentage === 100;
                
                tables.push({
                    category,
                    group,
                    groupType,
                    teams,
                    totalMatches,
                    completedCount,
                    completionPercentage,
                    isFullyCompleted,
                    matches: groupMatches
                });
            }
            
            // Zoradenie tabuliek podľa kategórie a názvu skupiny
            tables.sort((a, b) => {
                if (a.category !== b.category) return a.category.localeCompare(b.category);
                return a.group.localeCompare(b.group);
            });
            
            setGroupTables(tables);
            setLoading(false);
        };
        
        calculateGroupTables();
    }, [matches, categoriesData, groupsData, teamNames, pointsForWin]);
    
    // Získanie unikátnych kategórií
    const categories = useMemo(() => {
        const cats = new Set();
        groupTables.forEach(table => cats.add(table.category));
        return Array.from(cats).sort();
    }, [groupTables]);
    
    // Filtrovanie tabuliek
    const filteredTables = useMemo(() => {
        let filtered = groupTables;
        if (selectedCategory) {
            filtered = filtered.filter(t => t.category === selectedCategory);
        }
        if (selectedGroup) {
            filtered = filtered.filter(t => t.group === selectedGroup);
        }
        return filtered;
    }, [groupTables, selectedCategory, selectedGroup]);
    
    // Získanie unikátnych skupín pre vybranú kategóriu
    const groupsForCategory = useMemo(() => {
        if (!selectedCategory) return [];
        const groups = new Set();
        groupTables
            .filter(t => t.category === selectedCategory)
            .forEach(t => groups.add(t.group));
        return Array.from(groups).sort();
    }, [groupTables, selectedCategory]);
    
    // Generovanie progress baru
    const generateProgressBar = (percentage) => {
        const barLength = 20;
        const filledLength = Math.round(percentage / 100 * barLength);
        const emptyLength = barLength - filledLength;
        const filled = '█'.repeat(filledLength);
        const empty = '░'.repeat(emptyLength);
        return { filled, empty, filledLength, emptyLength };
    };
    
    // Získanie farby pre tím podľa pozície
    const getPositionColor = (position) => {
        if (position === 1) return 'bg-yellow-50';
        if (position === 2) return 'bg-gray-50';
        if (position === 3) return 'bg-orange-50';
        return '';
    };
    
    if (loading) {
        return React.createElement(
            'div',
            { className: 'flex justify-center items-center py-16' },
            React.createElement('div', { className: 'animate-spin rounded-full h-12 w-12 border-b-4 border-blue-500' })
        );
    }
    
    if (groupTables.length === 0) {
        return React.createElement(
            'div',
            { className: 'text-center py-12 text-gray-500 bg-gray-50 rounded-xl' },
            React.createElement('i', { className: 'fa-solid fa-table text-5xl mb-3 opacity-50' }),
            React.createElement('p', { className: 'text-lg' }, 'Žiadne tabuľky skupín')
        );
    }
    
    // Render filtrov
    const renderFilters = () => {
        return React.createElement(
            'div',
            { className: 'mb-6 space-y-3' },
            
            // Kategórie
            React.createElement(
                'div',
                { className: 'flex flex-wrap gap-2 justify-center' },
                React.createElement(
                    'button',
                    {
                        onClick: () => { setSelectedCategory(null); setSelectedGroup(null); },
                        className: `px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                            selectedCategory === null 
                                ? 'bg-blue-600 text-white shadow-md' 
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`
                    },
                    'Všetky kategórie'
                ),
                categories.map(cat => {
                    const isSelected = selectedCategory === cat;
                    const color = getCategoryDrawColor(cat) || '#3B82F6';
                    return React.createElement(
                        'button',
                        {
                            key: cat,
                            onClick: () => {
                                if (isSelected) {
                                    setSelectedCategory(null);
                                    setSelectedGroup(null);
                                } else {
                                    setSelectedCategory(cat);
                                    setSelectedGroup(null);
                                }
                            },
                            className: `px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                                isSelected 
                                    ? 'text-white shadow-md' 
                                    : 'text-gray-700 hover:bg-gray-300'
                            }`,
                            style: isSelected ? { backgroundColor: color } : { backgroundColor: getLighterColor(color) }
                        },
                        cat
                    );
                })
            ),
            
            // Skupiny pre vybranú kategóriu
            selectedCategory && groupsForCategory.length > 0 && React.createElement(
                'div',
                { className: 'flex flex-wrap gap-2 justify-center border-t border-gray-200 pt-3' },
                React.createElement(
                    'button',
                    {
                        onClick: () => setSelectedGroup(null),
                        className: `px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                            selectedGroup === null 
                                ? 'bg-purple-600 text-white shadow-md' 
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`
                    },
                    'Všetky skupiny'
                ),
                groupsForCategory.map(group => {
                    const isSelected = selectedGroup === group;
                    const table = groupTables.find(t => t.category === selectedCategory && t.group === group);
                    const colors = table ? getGroupTypeColors(group, selectedCategory, groupsData) : { backgroundColor: '#DCFCE7', textColor: '#166534' };
                    const bgColor = isSelected ? colors.textColor : colors.backgroundColor;
                    const textColor = isSelected ? '#FFFFFF' : colors.textColor;
                    
                    return React.createElement(
                        'button',
                        {
                            key: group,
                            onClick: () => setSelectedGroup(isSelected ? null : group),
                            className: `px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                                isSelected ? 'shadow-md' : 'hover:opacity-80'
                            }`,
                            style: { backgroundColor: bgColor, color: textColor }
                        },
                        group
                    );
                })
            )
        );
    };
    
    // Render jednej tabuľky
    const renderGroupTable = (table) => {
        const { category, group, groupType, teams, totalMatches, completedCount, completionPercentage, isFullyCompleted } = table;
        
        const colors = getGroupTypeColors(group, category, groupsData);
        const progress = generateProgressBar(completionPercentage);
        const statusIcon = isFullyCompleted ? '✅' : '⏳';
        const groupTypeLabel = groupType === 'nadstavbová' ? '🏆 NADSTAVBOVÁ' : '📚 ZÁKLADNÁ';
        
        return React.createElement(
            'div',
            { 
                key: `${category}|${group}`,
                className: 'bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden mb-8'
            },
            
            // Hlavička tabuľky
            React.createElement(
                'div',
                { 
                    className: 'px-6 py-4 border-b',
                    style: { 
                        backgroundColor: colors.backgroundColor || '#DCFCE7',
                        color: colors.textColor || '#166534'
                    }
                },
                React.createElement(
                    'div',
                    { className: 'flex flex-wrap items-center justify-between gap-3' },
                    React.createElement(
                        'div',
                        { className: 'flex items-center gap-3' },
                        React.createElement('h3', { className: 'text-lg font-bold' }, `${category} - ${group}`),
                        React.createElement(
                            'span',
                            { 
                                className: 'text-xs px-2 py-0.5 rounded-full font-medium',
                                style: { backgroundColor: 'rgba(255,255,255,0.6)', color: colors.textColor }
                            },
                            groupTypeLabel
                        )
                    )
                )
            ),
            
            // Telo tabuľky
            React.createElement(
                'div',
                { className: 'overflow-x-auto' },
                React.createElement(
                    'table',
                    { className: 'min-w-full divide-y divide-gray-200' },
                    
                    // Hlavička tabuľky
                    React.createElement(
                        'thead',
                        { className: 'bg-gray-50' },
                        React.createElement(
                            'tr',
                            null,
                            React.createElement('th', { className: 'px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-12' }, '#'),
                            React.createElement('th', { className: 'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider' }, 'Tím'),
                            React.createElement('th', { className: 'px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-10' }, 'Z'),
                            React.createElement('th', { className: 'px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-10' }, 'V'),
                            React.createElement('th', { className: 'px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-10' }, 'R'),
                            React.createElement('th', { className: 'px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-10' }, 'P'),
                            React.createElement('th', { className: 'px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16' }, 'Skóre'),
                            React.createElement('th', { className: 'px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-12' }, '+/-'),
                            React.createElement('th', { className: 'px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-12' }, 'Body')
                        )
                    ),
                    
                    // Riadky
                    React.createElement(
                        'tbody',
                        { className: 'divide-y divide-gray-100' },
                        teams.map((team, index) => {
                            const position = index + 1;
                            const rowClass = getPositionColor(position);
                            
                            return React.createElement(
                                'tr',
                                { key: team.id, className: `${rowClass} hover:bg-gray-100 transition-colors` },
                                React.createElement(
                                    'td',
                                    { className: 'px-4 py-3 text-center font-bold text-gray-700' },
                                    position
                                ),
                                React.createElement(
                                    'td',
                                    { className: 'px-4 py-3 font-medium text-gray-800' },
                                    team.name || '???'
                                ),
                                React.createElement(
                                    'td',
                                    { className: 'px-4 py-3 text-center text-gray-600' },
                                    team.played
                                ),
                                React.createElement(
                                    'td',
                                    { className: 'px-4 py-3 text-center text-green-600 font-bold' },
                                    team.wins
                                ),
                                React.createElement(
                                    'td',
                                    { className: 'px-4 py-3 text-center text-yellow-600' },
                                    team.draws
                                ),
                                React.createElement(
                                    'td',
                                    { className: 'px-4 py-3 text-center text-red-600' },
                                    team.losses
                                ),
                                React.createElement(
                                    'td',
                                    { className: 'px-4 py-3 text-center font-mono' },
                                    `${team.goalsFor}:${team.goalsAgainst}`
                                ),
                                React.createElement(
                                    'td',
                                    { className: 'px-4 py-3 text-center font-mono font-bold' },
                                    team.goalDifference > 0 ? `+${team.goalDifference}` : team.goalDifference
                                ),
                                React.createElement(
                                    'td',
                                    { className: 'px-4 py-3 text-center font-bold text-blue-600' },
                                    team.points
                                )
                            );
                        })
                    )
                )
            ),
            
            // Päta - informácie o zápasoch
            React.createElement(
                'div',
                { className: 'px-6 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500 flex justify-between' },
                React.createElement('span', {}, `Celkom ${totalMatches} zápasov`),
            )
        );
    };
    
    // Hlavný render
    return React.createElement(
        'div',
        { className: 'max-w-7xl mx-auto px-4 py-6' },
        
        // Hlavička
        React.createElement(
            'div',
            { className: 'mb-6 text-center' },
            React.createElement('h1', { className: 'text-2xl font-bold text-gray-800' }, 'Tabuľky skupín'),
        ),
        
        // Filtre
        renderFilters(),
        
        // Tabuľky
        filteredTables.length === 0 ? (
            React.createElement(
                'div',
                { className: 'text-center py-12 bg-gray-50 rounded-xl border border-gray-200' },
                React.createElement('i', { className: 'fa-solid fa-filter text-4xl mb-4 text-gray-400' }),
                React.createElement('p', { className: 'text-lg font-medium text-gray-700' }, 'Pre zvolený filter neexistujú žiadne tabuľky'),
                React.createElement(
                    'button',
                    {
                        onClick: () => { setSelectedCategory(null); setSelectedGroup(null); },
                        className: 'mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer'
                    },
                    'Zrušiť filtre'
                )
            )
        ) : (
            filteredTables.map(table => renderGroupTable(table))
        )
    );
};

// ============================================================
// HLAVNÁ APLIKÁCIA - MatchesHallApp (IBA TABUĽKY)
// ============================================================

const MatchesHallApp = () => {
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [hallInfo, setHallInfo] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [teamNames, setTeamNames] = useState({});
    const [categoryDrawColors, setCategoryDrawColors] = useState({});
    const [groupsData, setGroupsData] = useState({});
    const [categoriesData, setCategoriesData] = useState({});
    const [categoriesList, setCategoriesList] = useState([]);
    const [hallNames, setHallNames] = useState({});
    
    // Načítanie farieb kategórií
    const loadCategoryColors = async () => {
        if (!window.db) return;
        try {
            const settingsRef = doc(window.db, 'settings', 'categories');
            const settingsSnap = await getDoc(settingsRef);
            if (settingsSnap.exists()) {
                const data = settingsSnap.data();
                const colors = {};
                const categories = {};
                const list = [];
                Object.entries(data).forEach(([catId, catData]) => {
                    if (catData.drawColor) {
                        colors[catId] = catData.drawColor;
                    }
                    if (catData.name) {
                        categories[catId] = catData.name;
                        list.push({ id: catId, name: catData.name });
                    }
                });
                setCategoryDrawColors(colors);
                setCategoriesData(categories);
                setCategoriesList(list);
                window.categoryDrawColors = colors;
                window.categoriesData = categories;
                window.categoriesList = list;
            }
        } catch (err) {
            console.error('Chyba pri načítaní farieb kategórií:', err);
        }
    };
    
    // Načítanie skupín
    const loadGroupsData = async () => {
        if (!window.db) return;
        try {
            const groupsRef = doc(window.db, 'settings', 'groups');
            const groupsSnap = await getDoc(groupsRef);
            if (groupsSnap.exists()) {
                const data = groupsSnap.data();
                setGroupsData(data);
                window.groupsData = data;
            }
        } catch (err) {
            console.error('Chyba pri načítaní skupín:', err);
        }
    };
    
    // Načítanie mien tímov
    const loadTeamNames = async (matchesList) => {
        const names = { ...teamNames };
        let needsUpdate = false;
        
        if (!window.matchTracker || typeof window.matchTracker.getTeamNameByDisplayId !== 'function') {
            for (const match of matchesList) {
                if (match.homeTeamIdentifier && !names[match.homeTeamIdentifier]) {
                    names[match.homeTeamIdentifier] = match.homeTeamIdentifier;
                }
                if (match.awayTeamIdentifier && !names[match.awayTeamIdentifier]) {
                    names[match.awayTeamIdentifier] = match.awayTeamIdentifier;
                }
            }
            setTeamNames(names);
            return;
        }
        
        for (const match of matchesList) {
            let categoryName = match.categoryName;
            if (!categoryName && match.categoryId && window.categoriesData && window.categoriesData[match.categoryId]) {
                categoryName = window.categoriesData[match.categoryId];
            }
            if (!categoryName) continue;
            
            if (match.homeTeamIdentifier) {
                const currentDisplayName = names[match.homeTeamIdentifier] || getDisplayTeamName(match.homeTeamIdentifier);
                if (currentDisplayName && currentDisplayName.includes(categoryName)) {
                    try {
                        const newName = await window.matchTracker.getTeamNameByDisplayId(currentDisplayName);
                        if (newName && newName !== currentDisplayName && newName !== names[match.homeTeamIdentifier]) {
                            names[match.homeTeamIdentifier] = newName;
                            needsUpdate = true;
                        }
                    } catch (err) {}
                } else if (!names[match.homeTeamIdentifier]) {
                    names[match.homeTeamIdentifier] = currentDisplayName;
                }
            }
            
            if (match.awayTeamIdentifier) {
                const currentDisplayName = names[match.awayTeamIdentifier] || getDisplayTeamName(match.awayTeamIdentifier);
                if (currentDisplayName && currentDisplayName.includes(categoryName)) {
                    try {
                        const newName = await window.matchTracker.getTeamNameByDisplayId(currentDisplayName);
                        if (newName && newName !== currentDisplayName && newName !== names[match.awayTeamIdentifier]) {
                            names[match.awayTeamIdentifier] = newName;
                            needsUpdate = true;
                        }
                    } catch (err) {}
                } else if (!names[match.awayTeamIdentifier]) {
                    names[match.awayTeamIdentifier] = currentDisplayName;
                }
            }
        }
        
        if (needsUpdate) {
            setTeamNames(prev => ({ ...prev, ...names }));
        } else {
            setTeamNames(names);
        }
    };
    
    // Načítanie názvov hál
    const loadHallNames = async (matchesList) => {
        const hallIds = new Set();
        matchesList.forEach(match => {
            if (match.hallId) hallIds.add(match.hallId);
        });
        
        const names = { ...hallNames };
        let needsUpdate = false;
        
        for (const hallId of hallIds) {
            if (!names[hallId]) {
                try {
                    const hallRef = doc(window.db, 'places', hallId);
                    const hallSnap = await getDoc(hallRef);
                    if (hallSnap.exists()) {
                        const hallData = hallSnap.data();
                        names[hallId] = hallData.name || 'Športová hala';
                        needsUpdate = true;
                    } else {
                        names[hallId] = 'Športová hala';
                        needsUpdate = true;
                    }
                } catch (err) {
                    names[hallId] = 'Športová hala';
                    needsUpdate = true;
                }
            }
        }
        
        if (needsUpdate) {
            setHallNames(names);
        }
    };
    
    // Hlavné načítanie dát
    useEffect(() => {
        const init = async () => {
            if (!window.db) {
                setError('Databáza nie je inicializovaná');
                setLoading(false);
                return;
            }
            
            setLoading(true);
            setError(null);
            
            try {
                await loadCategoryColors();
                await loadGroupsData();
                
                // Načítanie zápasov
                const matchesRef = collection(window.db, 'matches');
                const querySnapshot = await getDocs(matchesRef);
                
                const allMatches = [];
                querySnapshot.forEach((doc) => {
                    const match = { id: doc.id, ...doc.data() };
                    allMatches.push(match);
                });
                
                // Zoradenie zápasov
                allMatches.sort((a, b) => {
                    if (!a.scheduledTime) return 1;
                    if (!b.scheduledTime) return -1;
                    try {
                        return a.scheduledTime.toDate().getTime() - b.scheduledTime.toDate().getTime();
                    } catch (e) {
                        return 0;
                    }
                });
                
                setMatches(allMatches);
                
                // Načítanie názvov hál
                await loadHallNames(allMatches);
                
                // Načítanie mien tímov
                await loadTeamNames(allMatches);
                
                // Nastavenie globálnych premenných
                window.matchesData = allMatches;
                
            } catch (err) {
                setError('Nepodarilo sa načítať dáta: ' + err.message);
            } finally {
                setLoading(false);
            }
        };
        
        init();
    }, []);
    
    // Realtime sledovanie zmien
    useEffect(() => {
        if (!window.db) return;
        
        const matchesRef = collection(window.db, 'matches');
        const unsubscribe = onSnapshot(matchesRef, (snapshot) => {
            const updatedMatches = [];
            snapshot.forEach((doc) => {
                const match = { id: doc.id, ...doc.data() };
                updatedMatches.push(match);
            });
            
            updatedMatches.sort((a, b) => {
                if (!a.scheduledTime) return 1;
                if (!b.scheduledTime) return -1;
                try {
                    return a.scheduledTime.toDate().getTime() - b.scheduledTime.toDate().getTime();
                } catch (e) {
                    return 0;
                }
            });
            
            setMatches(updatedMatches);
            window.matchesData = updatedMatches;
        }, (err) => {
            console.error('Chyba pri sledovaní zápasov:', err);
        });
        
        return () => unsubscribe();
    }, []);
    
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
    
    // Zobrazenie tabuliek skupín
    return React.createElement(GroupTablesView, {
        matches: matches,
        categoriesData: categoriesData,
        groupsData: groupsData,
        teamNames: teamNames,
        hallNames: hallNames
    });
};

// ============================================================
// RENDER APLIKÁCIE
// ============================================================

const renderApp = () => {
    const rootElement = document.getElementById('root');
    if (rootElement && ReactDOM) {
        const root = ReactDOM.createRoot(rootElement);
        root.render(React.createElement(MatchesHallApp));
    }
};

renderApp();
