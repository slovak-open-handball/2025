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

const GroupMatchesList = ({ matches, groupName, categoryName, teamNames, hallNames, transferredMatches = [] }) => {
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

    // Pridáme prenesené zápasy do zoznamu
    const allMatches = useMemo(() => {
        const result = [...sortedMatches];
        
        // Pridáme prenesené zápasy (označíme ich ako prenesené)
        if (transferredMatches && transferredMatches.length > 0) {
            transferredMatches.forEach(transferred => {
                // Skontrolujeme, či už neexistuje rovnaký zápas (podľa ID)
                const exists = result.some(m => m.id === transferred.id);
                if (!exists) {
                    // 🔥 NÁJDENIE PÔVODNÉHO ZÁPASU PODĽA ID
                    let originalMatch = null;
                    if (window.matchesData) {
                        originalMatch = window.matchesData.find(m => m.id === transferred.id);
                    }
                    
                    // Ak sme nenašli v window.matchesData, skúsime v matches
                    if (!originalMatch) {
                        originalMatch = matches.find(m => m.id === transferred.id);
                    }
                    
                    // Pridáme prenesený zápas s indikátorom a údajmi z pôvodného zápasu
                    result.push({
                        ...transferred,
                        isTransferred: true,
                        // 🔥 POUŽIJEME scheduledTime Z PÔVODNÉHO ZÁPASU (ak existuje)
                        scheduledTime: originalMatch?.scheduledTime || transferred.scheduledTime || null,
                        // 🔥 POUŽIJEME hallId Z PÔVODNÉHO ZÁPASU (ak existuje)
                        hallId: originalMatch?.hallId || transferred.hallId || null,
                        homeScore: transferred.homeScore !== undefined ? transferred.homeScore : 0,
                        awayScore: transferred.awayScore !== undefined ? transferred.awayScore : 0,
                        status: 'completed'
                    });
                }
            });
        }
        
        // Zoradenie: normálne zápasy podľa dátumu, prenesené podľa dátumu (nie na koniec)
        result.sort((a, b) => {
            // Oba sú normálne alebo oba prenesené
            if (!a.scheduledTime && !b.scheduledTime) return 0;
            if (!a.scheduledTime) return 1;
            if (!b.scheduledTime) return -1;
            try {
                return a.scheduledTime.toDate().getTime() - b.scheduledTime.toDate().getTime();
            } catch (e) {
                return 0;
            }
        });
        
        return result;
    }, [sortedMatches, transferredMatches, matches]);

    // Zoskupenie podľa dní
    const matchesByDay = useMemo(() => {
        const groups = {};
        
        allMatches.forEach(match => {
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
        
        // Zoradenie podľa dátumu
        const result = Object.values(groups).sort((a, b) => a.date - b.date);
        
        return result;
    }, [allMatches]);

    // Funkcia na vytvorenie URL pre detail zápasu
    const createMatchDetailUrl = (match) => {
        if (!match.homeTeamIdentifier || !match.awayTeamIdentifier) return '#';
        const encodedHome = encodeURIComponent(match.homeTeamIdentifier.replace(/ /g, '-'));
        const encodedAway = encodeURIComponent(match.awayTeamIdentifier.replace(/ /g, '-'));
        return `matches.html#match/${encodedHome}/${encodedAway}`;
    };

    // Funkcia na zistenie, či má byť tlačidlo žlté
    const isMatchActive = (match) => {
        const status = matchStatuses[match.id] || match.status || 'scheduled';
        return status === 'in-progress' || status === 'paused';
    };

    // --- REALTIME SLEDOVANIE SKÓRE Z UDALOSTÍ ---
    const [matchScoresFromEvents, setMatchScoresFromEvents] = useState({});
    const [matchScoresFromDb, setMatchScoresFromDb] = useState({});
    const [matchStatuses, setMatchStatuses] = useState({});
    
    // Realtime sledovanie zmien zápasov
    useEffect(() => {
        if (!window.db) return;
        
        const matchesRef = collection(window.db, 'matches');
        
        const unsubscribe = onSnapshot(matchesRef, (snapshot) => {
            const updatedStatuses = {};
            const updatedScores = {};
            
            snapshot.docChanges().forEach(change => {
                const match = {
                    id: change.doc.id,
                    ...change.doc.data()
                };
                
                const newStatus = match.status || 'scheduled';
                updatedStatuses[match.id] = newStatus;
                
                if (match.homeScore !== undefined || match.awayScore !== undefined) {
                    updatedScores[match.id] = {
                        home: match.homeScore,
                        away: match.awayScore
                    };
                }
            });
            
            if (Object.keys(updatedStatuses).length > 0) {
                setMatchStatuses(prev => ({ ...prev, ...updatedStatuses }));
            }
            
            if (Object.keys(updatedScores).length > 0) {
                setMatchScoresFromDb(prev => ({ ...prev, ...updatedScores }));
            }
        }, (error) => {
        });
        
        return () => unsubscribe();
    }, []);
    
    // Realtime sledovanie udalostí (gólov)
    useEffect(() => {
        if (!window.db) return;
        
        const eventsRef = collection(window.db, 'matchEvents');
        
        const unsubscribe = onSnapshot(eventsRef, (snapshot) => {
            const goalsByMatch = {};
            
            snapshot.forEach(doc => {
                const event = doc.data();
                if (event.eventType === 'goal') {
                    if (!goalsByMatch[event.matchId]) {
                        goalsByMatch[event.matchId] = { home: 0, away: 0 };
                    }
                    if (event.team === 'home') {
                        goalsByMatch[event.matchId].home++;
                    } else if (event.team === 'away') {
                        goalsByMatch[event.matchId].away++;
                    }
                }
            });
            
            setMatchScoresFromEvents(prev => {
                const newScores = {};
                Object.keys(goalsByMatch).forEach(matchId => {
                    newScores[matchId] = goalsByMatch[matchId];
                });
                return newScores;
            });
        }, (error) => {
        });
        
        return () => unsubscribe();
    }, []);

    if (allMatches.length === 0) {
        return React.createElement(
            'div',
            { className: 'text-center py-8 text-gray-400 bg-gray-50 rounded-lg border border-gray-200' },
            React.createElement('i', { className: 'fa-regular fa-calendar-xmark text-3xl mb-2 opacity-50' }),
            React.createElement('p', { className: 'text-sm' }, 'Žiadne zápasy v tejto skupine')
        );
    }

    return React.createElement(
        'div',
        { className: 'mt-8 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden' },
        React.createElement(
            'div',
            { className: 'bg-gray-50 px-6 py-3 border-b border-gray-200' },
            React.createElement('h3', { className: 'font-semibold text-gray-800' }, 
                `Zápasy skupiny`
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
                        React.createElement('th', { className: 'px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24' }, '')
                    )
                ),
                React.createElement(
                    'tbody',
                    { className: 'divide-y divide-gray-100' },
                    matchesByDay.map((dayGroup, dayIndex) => {
                        const dayDate = dayGroup.date;
                        const dayMatches = dayGroup.matches;
                        const dayRows = [];

                        // Hlavička dňa - ROVNAKÁ PRE VŠETKY ZÁPASY
                        dayRows.push(
                            React.createElement(
                                'tr',
                                { key: `day-${dayIndex}`, className: 'bg-blue-50' },
                                React.createElement(
                                    'td',
                                    { colSpan: 6, className: 'px-4 py-3 text-left' },
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
                            const dateTime = match.scheduledTime ? formatMatchDateTime(match.scheduledTime) : null;
                            const matchStatus = matchStatuses[match.id] || match.status || 'scheduled';
                            const isActive = isMatchActive(match);
                            const isTransferred = match.isTransferred || false;
                            
                            // --- ZÍSKANIE SKÓRE Z REALTIME DÁT ---
                            const eventsScore = matchScoresFromEvents[match.id];
                            const dbScore = matchScoresFromDb[match.id];
                            const isMatchInProgress = matchStatus === 'in-progress' || matchStatus === 'paused';
                            const isMatchCompleted = matchStatus === 'completed';
                            const hasDbScore = dbScore && (dbScore.home !== undefined && dbScore.home !== null && dbScore.away !== undefined && dbScore.away !== null);
                            
                            let displayHomeScore = null;
                            let displayAwayScore = null;
                            let showScore = false;
                            
                            // Ak je zápas ukončený, použijeme skóre z databázy
                            if (isMatchCompleted && hasDbScore) {
                                displayHomeScore = dbScore.home;
                                displayAwayScore = dbScore.away;
                                showScore = true;
                            }
                            // Ak zápas prebieha, použijeme skóre z udalostí
                            else if (isMatchInProgress) {
                                if (eventsScore && (eventsScore.home > 0 || eventsScore.away > 0)) {
                                    displayHomeScore = eventsScore.home;
                                    displayAwayScore = eventsScore.away;
                                } else {
                                    displayHomeScore = 0;
                                    displayAwayScore = 0;
                                }
                                showScore = true;
                            }
                            // Inak použijeme uložené skóre z databázy
                            else if (hasDbScore) {
                                displayHomeScore = dbScore.home;
                                displayAwayScore = dbScore.away;
                                showScore = true;
                            }
                            // Ak je to prenesený zápas, použijeme jeho skóre
                            else if (isTransferred && match.homeScore !== undefined && match.awayScore !== undefined) {
                                displayHomeScore = match.homeScore;
                                displayAwayScore = match.awayScore;
                                showScore = true;
                            }

                            const homeTeamDisplay = teamNames[match.homeTeamIdentifier] || getDisplayTeamName(match.homeTeamIdentifier) || match.homeTeamName || match.homeTeamIdentifier || '???';
                            const awayTeamDisplay = teamNames[match.awayTeamIdentifier] || getDisplayTeamName(match.awayTeamIdentifier) || match.awayTeamName || match.awayTeamIdentifier || '???';
                            
                            // 🔥 PRE PRENESENÉ ZÁPASY - POUŽIJEME HALL NAME Z PÔVODNÉHO ZÁPASU
                            let matchHallName = 'Športová hala';
                            
                            if (match.hallId && hallNames[match.hallId]) {
                                matchHallName = hallNames[match.hallId];
                            } else if (match.fromGroup) {
                                matchHallName = match.fromGroup;
                            }

                            // Vytvorenie URL pre detail
                            const detailUrl = createMatchDetailUrl(match);
                            
                            // Tlačidlo Detail - žlté ak je zápas aktívny
                            const buttonClass = isActive
                                ? 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800 text-xs px-3 py-1 rounded-full transition-colors cursor-pointer font-medium'
                                : 'bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs px-3 py-1 rounded-full transition-colors cursor-pointer font-medium';

                            // 🔥 ROVNAKÁ HOVER FARBA PRE VŠETKY RIADKY - bg-gray-200
                            const rowClass = isTransferred
                                ? 'hover:bg-gray-200 transition-colors bg-gray-100'
                                : 'hover:bg-gray-200 transition-colors';

                            dayRows.push(
                                React.createElement(
                                    'tr',
                                    { key: `match-${dayIndex}-${match.id || match._id || Math.random()}`, className: rowClass },
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
                                        showScore ?
                                            React.createElement(
                                                'div',
                                                { className: 'flex items-center justify-center gap-1' },
                                                React.createElement('span', { className: 'font-bold text-gray-800' }, displayHomeScore),
                                                React.createElement('span', { className: 'text-gray-400' }, ':'),
                                                React.createElement('span', { className: 'font-bold text-gray-800' }, displayAwayScore)
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
                                        { className: 'px-4 py-3 whitespace-nowrap text-center' },
                                        React.createElement(
                                            'a',
                                            {
                                                href: detailUrl,
                                                className: buttonClass
                                            },
                                            'Detail'
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
    const [categorySettings, setCategorySettings] = useState({});
    
    // Cache pre prenesené zápasy (aby sme ich nepočítali viackrát)
    const [processedCarryOverGroups, setProcessedCarryOverGroups] = useState(new Set());
    
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
                    // 🔥 NASTAVÍME pointsForWin Z DATABÁZY
                    const newPoints = data.pointsForWin !== undefined ? data.pointsForWin : 3;
                    setPointsForWin(newPoints);
                    setSortingConditions(data.sortingConditions || []);
                    
                    // 🔥 AKTUALIZUJEME AJ GLOBÁLNU PREMENNÚ PRE ĎALŠIE POUŽITIE
                    window.__pointsForWin = newPoints;
                                    }
            } catch (err) {
            }
        };
        loadSettings();
    }, []);
    
    // 🔥 PRIDANÉ: Funkcia na získanie aktuálnych bodov za výhru
    const getCurrentPointsForWin = useCallback(() => {
        return pointsForWin;
    }, [pointsForWin]);
    
    // Načítanie nastavení kategórií (carryOverPoints)
    useEffect(() => {
        const loadCategorySettings = async () => {
            if (!window.db) return;
            try {
                const settingsRef = doc(window.db, 'settings', 'categories');
                const settingsSnap = await getDoc(settingsRef);
                if (settingsSnap.exists()) {
                    const data = settingsSnap.data();
                    const settings = {};
                    for (const [catId, catData] of Object.entries(data)) {
                        if (catData.name) {
                            settings[catData.name] = {
                                carryOverPoints: catData.carryOverPoints ?? false,
                                id: catId
                            };
                        }
                    }
                    setCategorySettings(settings);
                    window.categorySettings = settings;
                }
            } catch (err) {
            }
        };
        loadCategorySettings();
    }, []);
    
    // Realtime sledovanie zmien nastavení kategórií
    useEffect(() => {
        if (!window.db) return;
        const settingsRef = doc(window.db, 'settings', 'categories');
        const unsubscribe = onSnapshot(settingsRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const settings = {};
                for (const [catId, catData] of Object.entries(data)) {
                    if (catData.name) {
                        settings[catData.name] = {
                            carryOverPoints: catData.carryOverPoints ?? false,
                            id: catId
                        };
                    }
                }
                setCategorySettings(settings);
                window.categorySettings = settings;
            }
        }, (err) => {
        });
        return () => unsubscribe();
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
        });
        return () => unsubscribe();
    }, []);
    
    // 🔥 OPRAVENÉ: Realtime sledovanie zmien nastavení tabuľky (body, kritériá)
    useEffect(() => {
        if (!window.db) return;
        const settingsRef = doc(window.db, 'settings', 'table');
        const unsubscribe = onSnapshot(settingsRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const newPoints = data.pointsForWin !== undefined ? data.pointsForWin : 3;
                const newConditions = data.sortingConditions || [];
                
                let changed = false;
                if (pointsForWin !== newPoints) {
                    setPointsForWin(newPoints);
                    window.__pointsForWin = newPoints;
                    changed = true;
                }
                if (JSON.stringify(sortingConditions) !== JSON.stringify(newConditions)) {
                    setSortingConditions(newConditions);
                    changed = true;
                }
                
                // Ak sa zmenili body alebo kritériá, prepočítame tabuľky
                if (changed) {
                    // Spustíme prepočet - useEffect závisí na pointsForWin a sortingConditions
                    // takže sa prepočíta automaticky
                }
            }
        }, (err) => {
        });
        return () => unsubscribe();
    }, [pointsForWin, sortingConditions]);
    
    // ============================================================
    // POMOCNÁ FUNKCIA: Získanie skóre z udalostí
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
    // FUNKCIA: Výpočet tabuľky pre základnú skupinu
    // ============================================================
    const calculateGroupTable = useCallback((category, group, groupMatches) => {
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
        
        // 🔥 Použijeme aktuálne body za výhru
        const currentPointsForWin = pointsForWin;
        
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
                homeTeam.points += currentPointsForWin;
                awayTeam.losses++;
            } else if (awayScore > homeScore) {
                awayTeam.wins++;
                awayTeam.points += currentPointsForWin;
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
            
            let homeScore = match.homeScore || 0;
            let awayScore = match.awayScore || 0;
            
            if (homeScore === 0 && awayScore === 0 && match.id) {
                const events = window.matchTracker?.getEvents?.(match.id) || [];
                const score = getCurrentScoreFromEvents(events);
                homeScore = score.home;
                awayScore = score.away;
            }
            
            return {
                ...match,
                homeTeamName: homeName,
                awayTeamName: awayName,
                homeScore: homeScore,
                awayScore: awayScore
            };
        });
        
        // ZORADENIE TÍMOV
        const sortedTeams = [...teams].sort((a, b) => {
            return compareTeams(a, b, matchesForComparison, sortingConditions);
        });
        
        // Počty zápasov
        const totalMatches = groupMatches.length;
        const completedCount = completedMatches.length;
        
        return {
            category,
            group,
            groupType: 'základná',
            teams: sortedTeams,
            totalMatches,
            completedCount,
            matches: groupMatches,
            matchesForComparison: matchesForComparison,
            sortingConditions: sortingConditions,
            completionPercentage: totalMatches > 0 ? (completedCount / totalMatches * 100) : 0,
            isFullyCompleted: totalMatches === completedCount,
            pointsForWin: currentPointsForWin
        };
    }, [teamNames, pointsForWin, sortingConditions]);
    
    // ============================================================
    // FUNKCIA: Výpočet tabuľky pre nadstavbovú skupinu s prenášaním výsledkov
    // ============================================================
    const calculateAdvancedGroupTable = useCallback((category, group, groupMatches, allBaseGroupTables) => {
        // Získanie typu skupiny
        const groupType = 'nadstavbová';
        
        // Získanie ID kategórie
        let categoryId = null;
        if (window.categoriesData) {
            for (const [catId, catName] of Object.entries(window.categoriesData)) {
                if (catName === category) {
                    categoryId = catId;
                    break;
                }
            }
        }
        
        // Získanie nastavenia pre prenášanie bodov
        const carryOverEnabled = categorySettings[category]?.carryOverPoints ?? false;
        
        // Získanie všetkých tímov v nadstavbovej skupine
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
        
        // 🔥 VYTVORÍME MAPU NÁZVOV PRE RÝCHLE VYHĽADÁVANIE (rovnako ako v druhom kóde)
        const teamNameMap = new Map();
        for (const [id, team] of teamsMap) {
            teamNameMap.set(id, team.name);
            // Ak sa názov líši od ID, pridáme aj mapovanie
            if (team.name !== id) {
                teamNameMap.set(team.name, team.name);
            }
        }
        
        // 🔥 Použijeme aktuálne body za výhru
        const currentPointsForWin = pointsForWin;
        
        // Vytvorenie zoznamu všetkých zápasov pre porovnanie (vrátane prenesených)
        const allMatchesForComparison = [];
        const transferredMatches = [];
        const processedPairs = new Set();
        
        // ============================================================
        // 🔥 KROK 1: Spracujeme zápasy z NADSTAVBOVEJ skupiny
        // ============================================================
        groupMatches.forEach(match => {
            const homeTeam = teamsMap.get(match.homeTeamIdentifier);
            const awayTeam = teamsMap.get(match.awayTeamIdentifier);
            
            let homeName = homeTeam ? homeTeam.name : match.homeTeamIdentifier;
            let awayName = awayTeam ? awayTeam.name : match.awayTeamIdentifier;
            
            let homeScore = match.homeScore || 0;
            let awayScore = match.awayScore || 0;
            
            if (homeScore === 0 && awayScore === 0 && match.id) {
                const events = window.matchTracker?.getEvents?.(match.id) || [];
                const score = getCurrentScoreFromEvents(events);
                homeScore = score.home;
                awayScore = score.away;
            }
            
            const matchData = {
                ...match,
                homeTeamName: homeName,
                awayTeamName: awayName,
                homeScore: homeScore,
                awayScore: awayScore,
                isTransferred: false
            };
            allMatchesForComparison.push(matchData);
            
            // Spracovanie štatistík pre dokončené zápasy v nadstavbovej skupine
            if (match.status === 'completed' && homeTeam && awayTeam) {
                const pairKey = homeName < awayName ? `${homeName}|${awayName}` : `${awayName}|${homeName}`;
                if (!processedPairs.has(pairKey)) {
                    processedPairs.add(pairKey);
                    
                    homeTeam.played++;
                    awayTeam.played++;
                    homeTeam.goalsFor += homeScore;
                    homeTeam.goalsAgainst += awayScore;
                    awayTeam.goalsFor += awayScore;
                    awayTeam.goalsAgainst += homeScore;
                    
                    if (homeScore > awayScore) {
                        homeTeam.wins++;
                        homeTeam.points += currentPointsForWin;
                        awayTeam.losses++;
                    } else if (awayScore > homeScore) {
                        awayTeam.wins++;
                        awayTeam.points += currentPointsForWin;
                        homeTeam.losses++;
                    } else {
                        homeTeam.draws++;
                        homeTeam.points += 1;
                        awayTeam.draws++;
                        awayTeam.points += 1;
                    }
                }
            }
        });
        
        // ============================================================
        // 🔥 KROK 2: PRENESENIE VÝSLEDKOV ZO ZÁKLADNÝCH SKUPÍN
        // ============================================================
        if (carryOverEnabled && allBaseGroupTables && allBaseGroupTables.length > 0) {
            for (const baseTable of allBaseGroupTables) {
                // Získame všetky dokončené zápasy zo základnej skupiny
                const baseCompletedMatches = baseTable.matches.filter(m => m.status === 'completed');
                
                for (const match of baseCompletedMatches) {
                    // Získame mapované názvy tímov zo základnej tabuľky
                    let homeFinalName = null;
                    let awayFinalName = null;
                    
                    for (const team of baseTable.teams) {
                        if (team.id === match.homeTeamIdentifier) {
                            homeFinalName = team.name;
                        }
                        if (team.id === match.awayTeamIdentifier) {
                            awayFinalName = team.name;
                        }
                    }
                    
                    if (!homeFinalName || !awayFinalName) continue;
                    
                    // 🔥 KĽÚČOVÉ: HĽADÁME TÍMY V NADSTAVBOVEJ PODĽA NÁZVU (rovnako ako v druhom kóde)
                    const homeInAdvanced = teamsMap.has(match.homeTeamIdentifier) || 
                                           Array.from(teamsMap.values()).some(t => t.name === homeFinalName);
                    const awayInAdvanced = teamsMap.has(match.awayTeamIdentifier) || 
                                           Array.from(teamsMap.values()).some(t => t.name === awayFinalName);
                    
                    if (homeInAdvanced && awayInAdvanced) {
                        const pairKey = homeFinalName < awayFinalName ? 
                            `${homeFinalName}|${awayFinalName}` : `${awayFinalName}|${homeFinalName}`;
                        
                        if (!processedPairs.has(pairKey)) {
                            let homeScore = match.homeScore || 0;
                            let awayScore = match.awayScore || 0;
                            
                            if (homeScore === 0 && awayScore === 0 && match.id) {
                                const events = window.matchTracker?.getEvents?.(match.id) || [];
                                const score = getCurrentScoreFromEvents(events);
                                homeScore = score.home;
                                awayScore = score.away;
                            }
                            
                            // 🔥 NÁJDENE SPRÁVNE TÍMY PODĽA NÁZVU
                            let homeTeam = teamsMap.get(match.homeTeamIdentifier);
                            let awayTeam = teamsMap.get(match.awayTeamIdentifier);
                            
                            // Ak sme nenašli podľa ID, skúsime podľa názvu
                            if (!homeTeam) {
                                homeTeam = Array.from(teamsMap.values()).find(t => t.name === homeFinalName);
                            }
                            if (!awayTeam) {
                                awayTeam = Array.from(teamsMap.values()).find(t => t.name === awayFinalName);
                            }
                            
                            if (homeTeam && awayTeam) {
                                // 🔥 DÔLEŽITÉ: Aplikujeme prenesený výsledok na štatistiky
                                homeTeam.played++;
                                awayTeam.played++;
                                homeTeam.goalsFor += homeScore;
                                homeTeam.goalsAgainst += awayScore;
                                awayTeam.goalsFor += awayScore;
                                awayTeam.goalsAgainst += homeScore;
                                
                                if (homeScore > awayScore) {
                                    homeTeam.wins++;
                                    homeTeam.points += currentPointsForWin;
                                    awayTeam.losses++;
                                } else if (awayScore > homeScore) {
                                    awayTeam.wins++;
                                    awayTeam.points += currentPointsForWin;
                                    homeTeam.losses++;
                                } else {
                                    homeTeam.draws++;
                                    homeTeam.points += 1;
                                    awayTeam.draws++;
                                    awayTeam.points += 1;
                                }
                                
                                processedPairs.add(pairKey);
                                
                                // Pridáme do zoznamu prenesených zápasov
                                transferredMatches.push({
                                    id: `transferred_${match.id}`,
                                    homeTeamIdentifier: match.homeTeamIdentifier,
                                    awayTeamIdentifier: match.awayTeamIdentifier,
                                    homeTeamName: homeFinalName,
                                    awayTeamName: awayFinalName,
                                    homeScore: homeScore,
                                    awayScore: awayScore,
                                    status: 'completed',
                                    isTransferred: true,
                                    fromGroup: match.groupName,
                                    scheduledTime: match.scheduledTime || null,
                                    hallId: match.hallId || null,
                                    categoryName: match.categoryName,
                                    categoryId: match.categoryId
                                });
                                
                                // Pridáme aj do zoznamu pre porovnanie
                                allMatchesForComparison.push({
                                    ...match,
                                    homeTeamName: homeFinalName,
                                    awayTeamName: awayFinalName,
                                    homeScore: homeScore,
                                    awayScore: awayScore,
                                    isTransferred: true,
                                    fromGroup: match.groupName
                                });
                            }
                        }
                    }
                }
            }
        }
        
        // ============================================================
        // 🔥 KROK 3: Výpočet rozdielu skóre a zoradenie
        // ============================================================
        const teams = Array.from(teamsMap.values());
        teams.forEach(team => {
            team.goalDifference = team.goalsFor - team.goalsAgainst;
        });
        
        // ZORADENIE TÍMOV
        const sortedTeams = [...teams].sort((a, b) => {
            return compareTeams(a, b, allMatchesForComparison, sortingConditions);
        });
        
        // Počty zápasov
        const totalMatches = groupMatches.length;
        const completedCount = groupMatches.filter(m => m.status === 'completed').length;
        
        return {
            category,
            categoryId,
            group,
            groupType: groupType,
            teams: sortedTeams,
            totalMatches,
            completedCount,
            matches: groupMatches,
            matchesForComparison: allMatchesForComparison,
            transferredMatches: transferredMatches,
            sortingConditions: sortingConditions,
            completionPercentage: totalMatches > 0 ? (completedCount / totalMatches * 100) : 0,
            isFullyCompleted: totalMatches === completedCount,
            carryOverEnabled: carryOverEnabled,
            baseGroups: allBaseGroupTables ? allBaseGroupTables.map(t => t.group) : [],
            pointsForWin: currentPointsForWin
        };
    }, [teamNames, categorySettings, pointsForWin, sortingConditions]);
        
        // ============================================================
        // HLAVNÁ FUNKCIA: Výpočet všetkých tabuliek skupín
        // ============================================================
        useEffect(() => {
            if (!matches || matches.length === 0) {
                setLoading(false);
                return;
            }
            
            const calculateAllTables = () => {
                // 1. Zoskupenie zápasov podľa kategórie a skupiny
                const groupsMap = new Map();
                
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
            
            // 2. Najprv vypočítame všetky ZÁKLADNÉ skupiny
            const baseGroupTables = [];
            const advancedGroupData = [];
            
            for (const [key, groupData] of groupsMap) {
                const { category, group, matches: groupMatches } = groupData;
                
                // Zistíme typ skupiny
                let isAdvanced = false;
                let categoryId = null;
                
                // Získame ID kategórie
                if (window.categoriesData) {
                    for (const [catId, catName] of Object.entries(window.categoriesData)) {
                        if (catName === category) {
                            categoryId = catId;
                            break;
                        }
                    }
                }
                
                // Skontrolujeme typ skupiny v groupsDataState
                if (categoryId && groupsDataState[categoryId]) {
                    const found = groupsDataState[categoryId].find(g => g.name === group);
                    if (found && found.type === 'nadstavbová skupina') {
                        isAdvanced = true;
                    }
                }
                
                // Fallback podľa názvu
                if (!isAdvanced && group.toLowerCase().includes('nadstavbová')) {
                    isAdvanced = true;
                }
                
                if (isAdvanced) {
                    advancedGroupData.push({
                        category,
                        categoryId,
                        group,
                        matches: groupMatches,
                        key
                    });
                } else {
                    // Základná skupina - vypočítame hneď
                    const table = calculateGroupTable(category, group, groupMatches);
                    if (table) {
                        baseGroupTables.push(table);
                    }
                }
            }
            
            // 3. Teraz vypočítame NADSTAVBOVÉ skupiny s prenášaním výsledkov
            const allTables = [...baseGroupTables];
            
            // Vytvoríme mapu základných skupín podľa kategórie
            const baseGroupsByCategory = {};
            for (const baseTable of baseGroupTables) {
                if (!baseGroupsByCategory[baseTable.category]) {
                    baseGroupsByCategory[baseTable.category] = [];
                }
                baseGroupsByCategory[baseTable.category].push(baseTable);
            }
            
            for (const advData of advancedGroupData) {
                const { category, group, matches: groupMatches } = advData;
                
                // Získame základné skupiny pre túto kategóriu
                const baseGroups = baseGroupsByCategory[category] || [];
                
                // Vypočítame nadstavbovú tabuľku s prenášaním
                const table = calculateAdvancedGroupTable(category, group, groupMatches, baseGroups);
                if (table) {
                    allTables.push(table);
                }
            }
            
            // 4. Zoradenie tabuliek
            allTables.sort((a, b) => {
                if (a.category !== b.category) return a.category.localeCompare(b.category);
                // Nadstavbové skupiny na konci
                const aIsAdvanced = a.groupType === 'nadstavbová';
                const bIsAdvanced = b.groupType === 'nadstavbová';
                if (aIsAdvanced !== bIsAdvanced) return aIsAdvanced ? 1 : -1;
                return a.group.localeCompare(b.group);
            });
            
            setGroupTables(allTables);
            setLoading(false);
        };
        
        calculateAllTables();
    }, [matches, categoriesData, groupsDataState, teamNames, pointsForWin, sortingConditions, categorySettings, calculateGroupTable, calculateAdvancedGroupTable]);
    
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
    
    // Render filtrov (rovnaký ako predtým)
    const renderFilters = () => {
        // ... (rovnaký kód ako v pôvodnom súbore)
        const getGroupsByType = (category) => {
            if (!category) return { basic: [], advanced: [] };
            
            const groups = [];
            groupTables
                .filter(t => t.category === category)
                .forEach(t => groups.push(t.group));
            
            groups.sort();
            
            const basic = [];
            const advanced = [];
            
            groups.forEach(groupName => {
                let groupType = 'základná';
                
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
                
                if (groupType === 'nadstavbová') {
                    advanced.push(groupName);
                } else {
                    basic.push(groupName);
                }
            });
            
            return { basic, advanced };
        };
        
        const { basic: basicGroups, advanced: advancedGroups } = getGroupsByType(selectedCategory);
        
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
                    const categoryId = getCategoryIdByName(cat);
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
            
            selectedCategory && (basicGroups.length > 0 || advancedGroups.length > 0) && React.createElement(
                'div',
                { className: 'border-t border-gray-200 pt-3 space-y-2' },
                
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
    
    // Render jednej tabuľky (upravený pre nadstavbové skupiny)
    const renderGroupTable = (table) => {
        const { category, categoryId, group, groupType, teams, totalMatches, completedCount, matches: groupMatches, transferredMatches, carryOverEnabled } = table;
        
        const colors = getGroupTypeColors(group, categoryId, groupsDataState);
        const groupTypeLabel = groupType === 'nadstavbová' ? 'NADSTAVBOVÁ' : 'ZÁKLADNÁ';
        const isAdvanced = groupType === 'nadstavbová';
        const isOnlyTable = filteredTables.length === 1;
        
        // Zobrazenie informácie o prenášaní pre nadstavbové skupiny
        const showCarryOverInfo = isAdvanced && carryOverEnabled && transferredMatches && transferredMatches.length > 0;
        
        return React.createElement(
            'div',
            { 
                key: `${category}|${group}`,
                className: 'mb-8 transition-all'
            },
            
            React.createElement(
                'div',
                { className: 'bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden' },
                
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
                        ),
                        React.createElement(
                            'div',
                            { className: 'flex items-center gap-3 text-xs' },
                            React.createElement(
                                'span',
                                { className: 'text-gray-600' },
                                `${completedCount}/${totalMatches} zápasov`
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
            
            // Zoznam zápasov - ak je zobrazená len jedna tabuľka
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
                        hallNames: hallNames,
                        transferredMatches: transferredMatches || []  // 🔥 PRIDANÉ: odovzdáme prenesené zápasy
                    }
                )
            )
        );
    };
    
    // Hlavný render
    return React.createElement(
        'div',
        { className: 'max-w-7xl mx-auto px-4 py-6' },
        
        React.createElement(
            'div',
            { className: 'mb-6 text-center' },
            React.createElement('h1', { className: 'text-2xl font-bold text-gray-800' }, 'Tabuľky skupín'),
        ),
        
        renderFilters(),
        
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
    
    // 🔥 STAV PRE SLEDOVANIE ZMENY STAVU ZÁPASOV
    const [matchStatuses, setMatchStatuses] = useState({});
    const [shouldRecalculate, setShouldRecalculate] = useState(false);
    const [lastCompletedMatchId, setLastCompletedMatchId] = useState(null);
    
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
        }
    };
    
    // 🔥 FUNKCIA NA PREPOČITANIE VŠETKÝCH NÁZVOV TÍMOV
    const recalculateAllTeamNames = useCallback(async () => {
        
        if (!window.matchTracker || typeof window.matchTracker.getTeamNameByDisplayId !== 'function') {
            return;
        }
        
        const names = { ...teamNames };
        let needsUpdate = false;
        
        for (const match of matches) {
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
            window.teamNames = { ...window.teamNames, ...names };
        } else {
        }
    }, [matches, teamNames]);
    
    // 🔥 FUNKCIA NA PREPOČITANIE VŠETKÝCH TABULIEK
    const recalculateAllTables = useCallback(() => {
        setShouldRecalculate(prev => !prev);
    }, []);
    
    // 🔥 REALTIME SLEDOVANIE ZMIEN ZÁPASOV SO ZAMERANÍM NA STAV "completed"
    useEffect(() => {
        if (!window.db) return;
        
        const matchesRef = collection(window.db, 'matches');
        let previousStatuses = {};
        
        const unsubscribe = onSnapshot(matchesRef, (snapshot) => {
            const updatedStatuses = {};
            let hasNewCompleted = false;
            let completedMatchId = null;
            let completedMatchData = null;
            
            snapshot.docChanges().forEach(change => {
                const match = {
                    id: change.doc.id,
                    ...change.doc.data()
                };
                
                const newStatus = match.status || 'scheduled';
                const oldStatus = previousStatuses[match.id];
                
                updatedStatuses[match.id] = newStatus;
                
                if (change.type === 'modified' && oldStatus && oldStatus !== 'completed' && newStatus === 'completed') {
                    hasNewCompleted = true;
                    completedMatchId = match.id;
                    completedMatchData = match;
                }
            });
            
            // Ak sa zmenili statusy, aktualizujeme stav
            if (Object.keys(updatedStatuses).length > 0) {
                previousStatuses = { ...previousStatuses, ...updatedStatuses };
                setMatchStatuses(prev => ({ ...prev, ...updatedStatuses }));
            }
            
            // 🔥 AK BOL ZÁPAS DOHRANÝ - SPUSTÍME PREPOČET
            if (hasNewCompleted) {
                setLastCompletedMatchId(completedMatchId);
                
                setTimeout(async () => {                    
                    await recalculateAllTeamNames();                    
                    recalculateAllTables();                    
                    if (window.updateTeamNamesGlobally && typeof window.updateTeamNamesGlobally === 'function') {
                        window.updateTeamNamesGlobally();
                    }
                    
                }, 1000);
            }
            
        }, (err) => {
        });
        
        return () => unsubscribe();
    }, [recalculateAllTeamNames, recalculateAllTables]);
    
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
                const initialStatuses = {};
                querySnapshot.forEach((doc) => {
                    const match = { id: doc.id, ...doc.data() };
                    allMatches.push(match);
                    initialStatuses[doc.id] = match.status || 'scheduled';
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
                setMatchStatuses(initialStatuses);
                
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
    
    // 🔥 REALTIME SLEDOVANIE ZMIEN (používame na aktualizáciu matches)
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
