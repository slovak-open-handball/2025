// tables.js
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
// FUNKCIA PRE PRÁCU S URL HASH FILTROM
// ============================================================

const encodeForURL = (text) => {
    if (!text) return '';
    return encodeURIComponent(text.replace(/ /g, '-'));
};

const decodeFromURL = (text) => {
    if (!text) return '';
    return decodeURIComponent(text).replace(/-/g, ' ');
};

const getFilterFromURL = () => {
    const hash = window.location.hash;
    if (!hash || hash === '#') return { category: null, group: null };
    
    try {
        const params = new URLSearchParams(hash.substring(1));
        const category = params.get('category');
        const group = params.get('group');
        return { 
            category: category ? decodeFromURL(category) : null, 
            group: group ? decodeFromURL(group) : null 
        };
    } catch (e) {
        return { category: null, group: null };
    }
};

const updateURLFilter = (category, group) => {
    try {
        const params = new URLSearchParams();
        if (category) params.set('category', encodeForURL(category));
        if (group) params.set('group', encodeForURL(group));
        
        const newHash = params.toString() ? `#${params.toString()}` : '#';
        if (window.location.hash !== newHash) {
            history.replaceState(null, '', newHash);
        }
    } catch (e) {
        console.error('Chyba pri aktualizácii URL:', e);
    }
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
// FUNKCIE PRE ZORAĐOVANIE TÍMOV (rovnaké ako v matchTracker)
// ============================================================

// Výpočet vzájomného zápasu medzi dvoma tímami
const calculateHeadToHead = (teamA, teamB, groupMatches) => {
    let teamAScore = 0;
    let teamBScore = 0;
    let teamAWins = 0;
    let teamBWins = 0;
    let foundMatch = false;
    
    const teamAName = (teamA.name || teamA.id || "").trim();
    const teamBName = (teamB.name || teamB.id || "").trim();
    
    if (!teamAName || !teamBName) {
        return { teamAScore, teamBScore, teamAWins, teamBWins };
    }
    
    const normalizeName = (name) => {
        if (!name) return '';
        return name
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim()
            .replace(/\s+/g, ' ');
    };
    
    const teamANormalized = normalizeName(teamAName);
    const teamBNormalized = normalizeName(teamBName);
    
    for (const match of groupMatches) {
        let homeName = match.homeTeamName || match.homeTeamIdentifier || '';
        let awayName = match.awayTeamName || match.awayTeamIdentifier || '';
        
        if (!homeName || !awayName) continue;
        
        const homeNormalized = normalizeName(homeName);
        const awayNormalized = normalizeName(awayName);
        
        const isMatchBetweenThem = (homeNormalized === teamANormalized && awayNormalized === teamBNormalized) || 
                                   (homeNormalized === teamBNormalized && awayNormalized === teamANormalized);
        
        if (isMatchBetweenThem && match.status === 'completed') {
            foundMatch = true;
            
            let homeScore = match.homeScore || 0;
            let awayScore = match.awayScore || 0;
            
            if (homeNormalized === teamANormalized) {
                teamAScore = homeScore;
                teamBScore = awayScore;
            } else {
                teamAScore = awayScore;
                teamBScore = homeScore;
            }
            
            if (teamAScore > teamBScore) {
                teamAWins = 1;
                teamBWins = 0;
            } else if (teamBScore > teamAScore) {
                teamAWins = 0;
                teamBWins = 1;
            }
            break;
        }
    }
    
    return { teamAScore, teamBScore, teamAWins, teamBWins };
};

// Porovnanie dvoch tímov podľa kritérií
const compareTeams = (teamA, teamB, groupMatches, sortingConditions) => {
    // 1. Najprv porovnáme podľa bodov
    if (teamA.points !== teamB.points) {
        return teamB.points - teamA.points;
    }

    // 2. Ak sú body rovnaké, použijeme nastavené kritériá
    if (sortingConditions && sortingConditions.length > 0) {
        for (const condition of sortingConditions) {
            const { parameter, direction } = condition;
            let comparison = 0;
            
            switch (parameter) {
                case 'headToHead':
                    const headToHeadResult = calculateHeadToHead(teamA, teamB, groupMatches);
                    
                    if (headToHeadResult.teamAWins !== headToHeadResult.teamBWins) {
                        if (direction === 'desc') {
                            comparison = headToHeadResult.teamBWins - headToHeadResult.teamAWins;
                        } else {
                            comparison = headToHeadResult.teamAWins - headToHeadResult.teamBWins;
                        }
                    } else if (headToHeadResult.teamAScore !== headToHeadResult.teamBScore) {
                        if (direction === 'desc') {
                            comparison = headToHeadResult.teamBScore - headToHeadResult.teamAScore;
                        } else {
                            comparison = headToHeadResult.teamAScore - headToHeadResult.teamBScore;
                        }
                    }
                    break;
                
                case 'scoreDifference':
                    if (direction === 'desc') {
                        comparison = teamB.goalDifference - teamA.goalDifference;
                    } else {
                        comparison = teamA.goalDifference - teamB.goalDifference;
                    }
                    break;
                    
                case 'goalsScored':
                    if (direction === 'desc') {
                        comparison = teamB.goalsFor - teamA.goalsFor;
                    } else {
                        comparison = teamA.goalsFor - teamB.goalsFor;
                    }
                    break;
                    
                case 'goalsConceded':
                    if (direction === 'asc') {
                        comparison = teamA.goalsAgainst - teamB.goalsAgainst;
                    } else {
                        comparison = teamB.goalsAgainst - teamA.goalsAgainst;
                    }
                    break;
                
                case 'wins':
                    if (direction === 'desc') {
                        comparison = teamB.wins - teamA.wins;
                    } else {
                        comparison = teamA.wins - teamB.wins;
                    }
                    break;
                
                case 'losses':
                    if (direction === 'asc') {
                        comparison = teamA.losses - teamB.losses;
                    } else {
                        comparison = teamB.losses - teamA.losses;
                    }
                    break;
                
                case 'draw':
                    comparison = 0;
                    break;
                    
                default:
                    comparison = 0;
            }
        
            if (comparison !== 0) return comparison;
        }
    }
    
    // 3. Ak sú všetky kritériá rovnaké, použijeme abecedné poradie
    return teamA.name.localeCompare(teamB.name);
};

// ============================================================
// KOMPONENT PRE ZOBRAZENIE ZOZNAMU ZÁPASOV SKUPINY
// ============================================================

const GroupMatchesList = ({ matches, groupName, categoryName, teamNames, hallNames }) => {
    // Zoradenie zápasov podľa dátumu a času
    const sortedMatches = useMemo(() => {
        return [...matches].sort((a, b) => {
            if (!a.scheduledTime) return 1;
            if (!b.scheduledTime) return -1;
            try {
                return a.scheduledTime.toDate().getTime() - b.scheduledTime.toDate().getTime();
            } catch (e) {
                return 0;
            }
        });
    }, [matches]);

    // Zoskupenie podľa dní
    const matchesByDay = useMemo(() => {
        const groups = {};
        
        sortedMatches.forEach(match => {
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
    }, [sortedMatches]);

    if (matches.length === 0) {
        return React.createElement(
            'div',
            { className: 'text-center py-8 text-gray-400 bg-gray-50 rounded-lg border border-gray-200' },
            React.createElement('i', { className: 'fa-regular fa-calendar-xmark text-3xl mb-2 opacity-50' }),
            React.createElement('p', { className: 'text-sm' }, 'Žiadne zápasy v tejto skupine')
        );
    }

    return React.createElement(
        'div',
        { className: 'mt-8 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden' }, // Pridaný mt-8 pre väčší odstup
        React.createElement(
            'div',
            { className: 'bg-gray-50 px-6 py-3 border-b border-gray-200' },
            React.createElement('h3', { className: 'font-semibold text-gray-800' }, 
                `Zápasy skupiny: ${groupName}`
            )
        ),
        React.createElement(
            'div',
            { className: 'overflow-x-auto' },
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
                        React.createElement('th', { className: 'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32' }, 'Miesto'),
                        React.createElement('th', { className: 'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48' }, 'Info'),
                        React.createElement('th', { className: 'px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20' }, 'Stav')
                    )
                ),
                React.createElement(
                    'tbody',
                    { className: 'divide-y divide-gray-100' },
                    matchesByDay.map((dayGroup, dayIndex) => {
                        const dayDate = dayGroup.date;
                        const dayMatches = dayGroup.matches;
                        const dayRows = [];

                        // Hlavička dňa
                        dayRows.push(
                            React.createElement(
                                'tr',
                                { key: `day-${dayIndex}`, className: 'bg-blue-50' },
                                React.createElement(
                                    'td',
                                    { colSpan: 7, className: 'px-4 py-3 text-left' },
                                    React.createElement(
                                        'div',
                                        { className: 'flex items-center gap-2' },
                                        React.createElement('i', { className: 'fa-regular fa-calendar text-blue-500' }),
                                        React.createElement('span', { className: 'font-semibold text-gray-800 text-sm' }, formatDateHeader(dayDate))
                                    )
                                )
                            )
                        );

                        dayMatches.forEach((match) => {
                            const dateTime = formatMatchDateTime(match.scheduledTime);
                            const matchStatus = match.status || 'scheduled';
                            
                            // Získanie skóre
                            let homeScore = match.homeScore;
                            let awayScore = match.awayScore;
                            
                            // Ak je zápas v priebehu a nemá skóre, skúsime z udalostí
                            if ((matchStatus === 'in-progress' || matchStatus === 'paused') && 
                                (homeScore === undefined || homeScore === null)) {
                                const events = window.matchTracker?.getEvents?.(match.id) || [];
                                const score = getCurrentScoreFromEvents(events);
                                homeScore = score.home;
                                awayScore = score.away;
                            }

                            const hasScore = homeScore !== undefined && homeScore !== null && 
                                           awayScore !== undefined && awayScore !== null;

                            const homeTeamDisplay = teamNames[match.homeTeamIdentifier] || getDisplayTeamName(match.homeTeamIdentifier);
                            const awayTeamDisplay = teamNames[match.awayTeamIdentifier] || getDisplayTeamName(match.awayTeamIdentifier);
                            
                            const matchHallName = hallNames[match.hallId] || 'Športová hala';

                            // Stav zápasu
                            let statusDisplay = '';
                            let statusColor = '';
                            switch (matchStatus) {
                                case 'in-progress':
                                    statusDisplay = 'Prebieha';
                                    statusColor = 'text-green-600 bg-green-50';
                                    break;
                                case 'paused':
                                    statusDisplay = 'Pozastavený';
                                    statusColor = 'text-yellow-600 bg-yellow-50';
                                    break;
                                case 'completed':
                                    statusDisplay = 'Ukončený';
                                    statusColor = 'text-blue-600 bg-blue-50';
                                    break;
                                default:
                                    statusDisplay = 'Naplánovaný';
                                    statusColor = 'text-gray-500 bg-gray-50';
                            }

                            // Info tagy
                            const infoTags = [];
                            
                            if (match.matchType && !match.isPlacementMatch) {
                                infoTags.push(
                                    React.createElement('span', { 
                                        key: 'type',
                                        className: 'inline-block text-xs px-2 py-0.5 rounded-full whitespace-nowrap',
                                        style: {
                                            backgroundColor: '#F3E8FF',
                                            color: '#6B21A5',
                                            fontWeight: '500'
                                        }
                                    },
                                    match.matchType
                                ));
                            }

                            if (match.isPlacementMatch && match.placementRank) {
                                infoTags.push(
                                    React.createElement('span', { 
                                        key: 'placement',
                                        className: 'inline-block text-xs px-2 py-0.5 rounded-full whitespace-nowrap',
                                        style: {
                                            backgroundColor: '#FFEDD5',
                                            color: '#EA580C',
                                            fontWeight: '500'
                                        }
                                    },
                                    `o ${match.placementRank}. miesto`
                                ));
                            }

                            // Kategória
                            let categoryDisplayTag = match.categoryName || categoryName;
                            if (!categoryDisplayTag && match.categoryId && window.categoriesData && window.categoriesData[match.categoryId]) {
                                categoryDisplayTag = window.categoriesData[match.categoryId];
                            }
                            
                            if (categoryDisplayTag) {
                                const categoryColor = getCategoryDrawColor(match.categoryId);
                                const lighterColor = getLighterColor(categoryColor);
                                infoTags.push(
                                    React.createElement('span', { 
                                        key: 'category',
                                        className: 'inline-block text-xs px-2 py-0.5 rounded-full whitespace-nowrap',
                                        style: {
                                            backgroundColor: lighterColor,
                                            color: categoryColor,
                                            fontWeight: '500'
                                        }
                                    },
                                    categoryDisplayTag
                                ));
                            }

                            dayRows.push(
                                React.createElement(
                                    'tr',
                                    { key: `match-${dayIndex}-${match.id}`, className: 'hover:bg-gray-50 transition-colors' },
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
                                        hasScore ?
                                            React.createElement(
                                                'div',
                                                { className: 'flex items-center justify-center gap-1' },
                                                React.createElement('span', { className: 'font-bold text-gray-800' }, homeScore),
                                                React.createElement('span', { className: 'text-gray-400' }, ':'),
                                                React.createElement('span', { className: 'font-bold text-gray-800' }, awayScore)
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
                                        { className: 'px-4 py-3 whitespace-nowrap text-left' },
                                        React.createElement(
                                            'div',
                                            { className: 'flex items-center gap-1' },
                                            React.createElement('i', { className: 'fa-solid fa-location-dot text-blue-400 text-xs' }),
                                            React.createElement('span', { className: 'text-gray-600 text-sm max-w-32 truncate' }, matchHallName)
                                        )
                                    ),
                                    React.createElement(
                                        'td',
                                        { className: 'px-4 py-3' },
                                        React.createElement(
                                            'div',
                                            { className: 'flex flex-wrap gap-1' },
                                            infoTags
                                        )
                                    ),
                                    React.createElement(
                                        'td',
                                        { className: 'px-4 py-3 whitespace-nowrap text-center' },
                                        React.createElement(
                                            'span',
                                            { className: `inline-block text-xs px-2 py-1 rounded-full ${statusColor}` },
                                            statusDisplay
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
    const [groupsDataState, setGroupsDataState] = useState(groupsData || {});
    const [isInitialized, setIsInitialized] = useState(false);
    
    // Načítanie filtra z URL pri inicializácii
    useEffect(() => {
        const urlFilter = getFilterFromURL();
        if (urlFilter.category) {
            setSelectedCategory(urlFilter.category);
        }
        if (urlFilter.group) {
            setSelectedGroup(urlFilter.group);
        }
        setIsInitialized(true);
    }, []);
    
    // Aktualizácia URL pri zmene filtra
    useEffect(() => {
        if (!isInitialized) return;
        updateURLFilter(selectedCategory, selectedGroup);
    }, [selectedCategory, selectedGroup, isInitialized]);
    
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
    
    // PRIAMO NAČÍTANIE TYPOV SKUPÍN Z DATABÁZY
    useEffect(() => {
        const loadGroupsDataFromDB = async () => {
            if (!window.db) return;
            try {
                const groupsRef = doc(window.db, 'settings', 'groups');
                const groupsSnap = await getDoc(groupsRef);
                if (groupsSnap.exists()) {
                    const data = groupsSnap.data();
                    setGroupsDataState(data);
                    window.groupsData = data;
                }
            } catch (err) {
                console.error('Chyba pri načítaní typov skupín:', err);
            }
        };
        loadGroupsDataFromDB();
    }, []);
    
    // Realtime sledovanie zmien typov skupín
    useEffect(() => {
        if (!window.db) return;
        const groupsRef = doc(window.db, 'settings', 'groups');
        const unsubscribe = onSnapshot(groupsRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setGroupsDataState(data);
                window.groupsData = data;
            }
        }, (err) => {
            console.error('Chyba pri sledovaní typov skupín:', err);
        });
        return () => unsubscribe();
    }, []);
    
    // Realtime sledovanie zmien nastavení tabuľky (body, kritériá)
    useEffect(() => {
        if (!window.db) return;
        const settingsRef = doc(window.db, 'settings', 'table');
        const unsubscribe = onSnapshot(settingsRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const newPoints = data.pointsForWin || 3;
                const newConditions = data.sortingConditions || [];
                
                let changed = false;
                if (pointsForWin !== newPoints) {
                    setPointsForWin(newPoints);
                    changed = true;
                }
                if (JSON.stringify(sortingConditions) !== JSON.stringify(newConditions)) {
                    setSortingConditions(newConditions);
                    changed = true;
                }
            }
        }, (err) => {
            console.error('Chyba pri sledovaní nastavení tabuľky:', err);
        });
        return () => unsubscribe();
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
                
                // Vytvorenie zoznamu zápasov pre porovnanie (s mapovanými názvami)
                const matchesForComparison = groupMatches.map(match => {
                    const homeTeam = teamsMap.get(match.homeTeamIdentifier);
                    const awayTeam = teamsMap.get(match.awayTeamIdentifier);
                    
                    let homeName = homeTeam ? homeTeam.name : match.homeTeamIdentifier;
                    let awayName = awayTeam ? awayTeam.name : match.awayTeamIdentifier;
                    
                    return {
                        ...match,
                        homeTeamName: homeName,
                        awayTeamName: awayName,
                        homeScore: match.homeScore || 0,
                        awayScore: match.awayScore || 0
                    };
                });
                
                // ZORADENIE TÍMOV POMOCOU compareTeams
                const sortedTeams = [...teams].sort((a, b) => {
                    return compareTeams(a, b, matchesForComparison, sortingConditions);
                });
                
                // URČENIE TYPU SKUPINY - POUŽIJEME groupsDataState
                let groupType = 'základná';
                
                // Skúsime nájsť skupinu v groupsDataState
                // Najprv potrebujeme získať ID kategórie podľa názvu
                let categoryId = null;
                if (window.categoriesData) {
                    for (const [catId, catName] of Object.entries(window.categoriesData)) {
                        if (catName === category) {
                            categoryId = catId;
                            break;
                        }
                    }
                }
                
                // Ak nemáme ID, skúsime priamo v groupsDataState
                if (!categoryId) {
                    for (const [catId, groups] of Object.entries(groupsDataState)) {
                        const found = groups.find(g => g.name === group);
                        if (found) {
                            categoryId = catId;
                            break;
                        }
                    }
                }
                
                // Ak máme ID a groupsDataState, nájdeme typ skupiny
                if (categoryId && groupsDataState[categoryId]) {
                    const found = groupsDataState[categoryId].find(g => g.name === group);
                    if (found && found.type) {
                        groupType = found.type === 'nadstavbová skupina' ? 'nadstavbová' : 'základná';
                    }
                }
                
                // Ak sme nenašli, skúsime podľa názvu skupiny (fallback)
                if (groupType === 'základná' && group.toLowerCase().includes('nadstavbová')) {
                    groupType = 'nadstavbová';
                }
                
                // Počty zápasov
                const totalMatches = groupMatches.length;
                const completedCount = completedMatches.length;
                
                tables.push({
                    category,
                    categoryId,
                    group,
                    groupType,
                    teams: sortedTeams,  // <-- POUŽIJEME ZORADENÝ ZOZNAM
                    totalMatches,
                    completedCount,
                    matches: groupMatches, // <-- PRIDANÉ: zoznam zápasov skupiny
                    sortingConditions: sortingConditions
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
    }, [matches, categoriesData, groupsDataState, teamNames, pointsForWin, sortingConditions]);
    
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
    
    // Funkcia na kliknutie na hlavičku tabuľky
    const handleTableHeaderClick = (category, group) => {
        // Ak je už táto tabuľka vybraná, zrušíme filter
        if (selectedCategory === category && selectedGroup === group) {
            setSelectedCategory(null);
            setSelectedGroup(null);
        } else {
            setSelectedCategory(category);
            setSelectedGroup(group);
        }
    };
    
    // Funkcia na zrušenie filtrov
    const clearFilters = () => {
        setSelectedCategory(null);
        setSelectedGroup(null);
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
        // Získanie skupín rozdelených podľa typu
        const getGroupsByType = (category) => {
            if (!category) return { basic: [], advanced: [] };
            
            const groups = [];
            groupTables
                .filter(t => t.category === category)
                .forEach(t => groups.push(t.group));
            
            // Zoradenie skupín podľa názvu
            groups.sort();
            
            // Rozdelenie podľa typu
            const basic = [];
            const advanced = [];
            
            groups.forEach(groupName => {
                // Získanie typu skupiny z groupsDataState
                let groupType = 'základná';
                
                // Nájdenie ID kategórie
                let categoryId = null;
                if (window.categoriesData) {
                    for (const [catId, catName] of Object.entries(window.categoriesData)) {
                        if (catName === category) {
                            categoryId = catId;
                            break;
                        }
                    }
                }
                
                if (categoryId && groupsDataState[categoryId]) {
                    const found = groupsDataState[categoryId].find(g => g.name === groupName);
                    if (found && found.type) {
                        groupType = found.type === 'nadstavbová skupina' ? 'nadstavbová' : 'základná';
                    }
                }
                
                // Fallback podľa názvu
                if (groupType === 'základná' && groupName.toLowerCase().includes('nadstavbová')) {
                    groupType = 'nadstavbová';
                }
                
                if (groupType === 'nadstavbová') {
                    advanced.push(groupName);
                } else {
                    basic.push(groupName);
                }
            });
            
            return { basic, advanced };
        };
        
        const { basic: basicGroups, advanced: advancedGroups } = getGroupsByType(selectedCategory);
        
        // Pomocná funkcia na získanie ID kategórie podľa názvu
        const getCategoryIdByName = (categoryName) => {
            if (!categoryName) return null;
            if (window.categoriesData) {
                for (const [catId, catName] of Object.entries(window.categoriesData)) {
                    if (catName === categoryName) {
                        return catId;
                    }
                }
            }
            return null;
        };
        
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
                        onClick: clearFilters,
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
                    // Získanie ID kategórie podľa názvu
                    const categoryId = getCategoryIdByName(cat);
                    // Použitie ID na získanie farby
                    const color = categoryId ? getCategoryDrawColor(categoryId) : '#3B82F6';
                    return React.createElement(
                        'button',
                        {
                            key: cat,
                            onClick: () => {
                                if (isSelected) {
                                    clearFilters();
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
            
            // Skupiny pre vybranú kategóriu - rozdelené podľa typu
            selectedCategory && (basicGroups.length > 0 || advancedGroups.length > 0) && React.createElement(
                'div',
                { className: 'border-t border-gray-200 pt-3 space-y-2' },
                
                // Riadok s názvom "Základné skupiny" (ak existujú) - ZELENÉ
                basicGroups.length > 0 && React.createElement(
                    'div',
                    { className: 'flex flex-wrap items-center gap-2 justify-center' },
                    React.createElement(
                        'span',
                        { className: 'text-xs font-medium text-gray-400 mr-1' },
                        'Základné:'
                    ),
                    basicGroups.map(group => {
                        const isSelected = selectedGroup === group;
                        // ZELENÉ FARBY pre základné skupiny
                        const bgColor = isSelected ? '#166534' : '#DCFCE7';
                        const textColor = isSelected ? '#FFFFFF' : '#166534';
                        
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
                ),
                
                // Riadok s názvom "Nadstavbové skupiny" (ak existujú) - MODRÉ
                advancedGroups.length > 0 && React.createElement(
                    'div',
                    { className: 'flex flex-wrap items-center gap-2 justify-center' },
                    React.createElement(
                        'span',
                        { className: 'text-xs font-medium text-gray-400 mr-1' },
                        'Nadstavbové:'
                    ),
                    advancedGroups.map(group => {
                        const isSelected = selectedGroup === group;
                        // MODRÉ FARBY pre nadstavbové skupiny
                        const bgColor = isSelected ? '#1E40AF' : '#DBEAFE';
                        const textColor = isSelected ? '#FFFFFF' : '#1E40AF';
                        
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
            )
        );
    };
            
    // Render jednej tabuľky
    const renderGroupTable = (table) => {
        const { category, categoryId, group, groupType, teams, totalMatches, completedCount, sortingConditions: tableSorting, matches: groupMatches } = table;
        
        // Správne volanie getGroupTypeColors s categoryId
        const colors = getGroupTypeColors(group, categoryId, groupsDataState);
        const groupTypeLabel = groupType === 'nadstavbová' ? 'NADSTAVBOVÁ' : 'ZÁKLADNÁ';
        
        // Zistíme, či je zobrazená iba jedna tabuľka
        const isOnlyTable = filteredTables.length === 1;
                
        return React.createElement(
            'div',
            { 
                key: `${category}|${group}`,
                className: 'mb-8 transition-all'
            },
            
            // SAMOSTATNÝ BOX PRE TABUĽKU
            React.createElement(
                'div',
                { className: 'bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden' },
                
                // Hlavička tabuľky - klikateľná
                React.createElement(
                    'div',
                    { 
                        className: 'px-6 py-4 border-b cursor-pointer hover:opacity-80 transition-opacity',
                        style: { 
                            backgroundColor: colors.backgroundColor || '#DCFCE7',
                            color: colors.textColor || '#166534'
                        },
                        onClick: () => handleTableHeaderClick(category, group),
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
                        
                        // Riadky - ZORADENÉ POMOCOU compareTeams
                        React.createElement(
                            'tbody',
                            { className: 'divide-y divide-gray-100' },
                            teams.map((team, index) => {
                                const position = index + 1;
                                
                                return React.createElement(
                                    'tr',
                                    { key: team.id, className: 'hover:bg-gray-100 transition-colors' },
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
                )
            ),
            
            // SAMOSTATNÝ BOX PRE ZOZNAM ZÁPASOV - AK JE ZOBRAZENÁ LEN JEDNA TABUĽKA
            isOnlyTable && React.createElement(
                'div',
                { className: 'mt-6' },
                React.createElement(
                    GroupMatchesList,
                    {
                        matches: groupMatches,
                        groupName: group,
                        categoryName: category,
                        teamNames: teamNames,
                        hallNames: hallNames
                    }
                )
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
                        onClick: clearFilters,
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
// HLAVNÁ APLIKÁCIA - TablesApp (IBA TABUĽKY)
// ============================================================

const TablesApp = () => {
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
        root.render(React.createElement(TablesApp));
    }
};

renderApp();
