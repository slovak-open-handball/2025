// logged-in-teams.js
import React from "https://esm.sh/react@18.2.0";
import ReactDOM from "https://esm.sh/react-dom@18.2.0";
import { doc, getDoc, onSnapshot, updateDoc, collection, query, getDocs, setDoc, addDoc, serverTimestamp, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
const { useState, useEffect, useRef } = React;
const listeners = new Set();

const NotificationPortal = () => {
  const [notification, setNotification] = React.useState(null);
  useEffect(() => {
    let timer;
    const unsubscribe = subscribe((notif) => {
      setNotification(notif);
      clearTimeout(timer);
      timer = setTimeout(() => setNotification(null), 5000);
    });
    
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, []);
  if (!notification) return null;
  const typeClasses = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-blue-600',
    default: 'bg-gray-700'
  }[notification.type || 'default'];
  return ReactDOM.createPortal(
    React.createElement(
      'div',
      {
        key: notification.id,
        className: `fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-2xl text-white text-center z-[9999] transition-all duration-400 ease-in-out opacity-100 scale-100 translate-y-0 ${typeClasses}`
      },
      notification.message
    ),
    document.body
  );
};

export const subscribe = (cb) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

const slovakCollator = new Intl.Collator('sk', { 
    sensitivity: 'base',
    ignorePunctuation: true,
    numeric: false
});

const removeSuffix = (teamName) => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÄČĎÉÍĽĹŇÓÔŘŠŤÚÝŽ';
    const lettersLower = letters.toLowerCase();
    const allLetters = letters + lettersLower;
    
    if (teamName.length >= 2) {
        const lastChar = teamName[teamName.length - 1];
        const secondLastChar = teamName[teamName.length - 2];
        
        if (secondLastChar === ' ' && allLetters.includes(lastChar)) {
            return teamName.slice(0, -2).trim();
        }
    }
    
    return teamName;
};

const loadTeamMembers = (teamName, categoryName, onUpdate, onMappedName) => {
    if (!window.db || !teamName || !categoryName) {
        if (onUpdate) onUpdate([]);
        if (onMappedName) onMappedName(teamName);
        return () => {};
    }
    
    const actualTeamName = teamName;    
    
    if (onMappedName) {
        onMappedName(actualTeamName);
    }
    
    const usersRef = collection(window.db, 'users');
    
    const unsubscribe = onSnapshot(usersRef, (usersSnapshot) => {
        const members = [];
        let foundAnyTeam = false;
        let userCount = 0;        
        
        for (const userDoc of usersSnapshot.docs) {
            const userId = userDoc.id;
            const userData = userDoc.data();
            const teams = userData.teams || {};
            userCount++;            
            
            for (const [categoryKey, teamsArray] of Object.entries(teams)) {
                if (categoryKey !== categoryName) continue;                
                
                const foundTeam = (teamsArray || []).find(t => t.teamName === actualTeamName);
                
                if (foundTeam) {
                    foundAnyTeam = true;
                    
                    if (foundTeam.playerDetails && Array.isArray(foundTeam.playerDetails)) {
                        foundTeam.playerDetails.forEach((player, idx) => {
                            members.push({
                                type: 'Hráč',
                                firstName: player.firstName || '',
                                lastName: player.lastName || '',
                                jerseyNumber: player.jerseyNumber || '',
                                registrationNumber: player.registrationNumber || '',
                                userId: userId,
                                originalIndex: idx,
                                dbArrayName: 'playerDetails',
                                teamName: actualTeamName,
                                categoryName: categoryName
                            });
                        });
                    }
                    
                    if (foundTeam.menTeamMemberDetails && Array.isArray(foundTeam.menTeamMemberDetails)) {
                        foundTeam.menTeamMemberDetails.forEach((member, idx) => {
                            members.push({
                                type: 'Člen RT (muž)',
                                firstName: member.firstName || '',
                                lastName: member.lastName || '',
                                jerseyNumber: '',
                                registrationNumber: member.registrationNumber || '',
                                userId: userId,
                                originalIndex: idx,
                                dbArrayName: 'menTeamMemberDetails',
                                teamName: actualTeamName,
                                categoryName: categoryName
                            });
                        });
                    }
                    
                    if (foundTeam.womenTeamMemberDetails && Array.isArray(foundTeam.womenTeamMemberDetails)) {
                        foundTeam.womenTeamMemberDetails.forEach((member, idx) => {
                            members.push({
                                type: 'Člen RT (žena)',
                                firstName: member.firstName || '',
                                lastName: member.lastName || '',
                                jerseyNumber: '',
                                registrationNumber: member.registrationNumber || '',
                                userId: userId,
                                originalIndex: idx,
                                dbArrayName: 'womenTeamMemberDetails',
                                teamName: actualTeamName,
                                categoryName: categoryName
                            });
                        });
                    }
                    
                    break;
                }
            }
        }
        
        const rtMembers = members.filter(m => m.type !== 'Hráč');
        const players = members.filter(m => m.type === 'Hráč');
        const sortedMembers = [...rtMembers, ...players];        
        
        if (onUpdate) onUpdate(sortedMembers);
    }, (error) => {
        if (onUpdate) onUpdate([]);
    });
    
    return unsubscribe;
};

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

const getDisplayTeamName = (teamIdentifier) => {
    if (!teamIdentifier) return '???';
    if (window.teamManager && typeof window.teamManager.getTeamNameByDisplayIdSync === 'function') {
        const teamName = window.teamManager.getTeamNameByDisplayIdSync(teamIdentifier);
        if (teamName && teamName !== teamIdentifier) return teamName;
    }
    return teamIdentifier;
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

const getMatchColors = (match) => {
    if (match.isPlacementMatch) return { backgroundColor: '#F3E8FF', textColor: '#6B21A5' };
    if (match.matchType === 'Playoff' || match.matchType === 'Semifinále' || 
        match.matchType === 'Finále' || match.matchType === 'Štvrťfinále' ||
        (match.matchType && match.matchType.includes('finále')) ||
        match.matchType === 'o 3. miesto') {
        return { backgroundColor: '#F3E8FF', textColor: '#6B21A5' };
    }
    return { backgroundColor: '#DCFCE7', textColor: '#166534' };
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

const TeamMatchesList = ({ teamName, categoryName, categoryId }) => {
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [teamNames, setTeamNames] = useState({});
    const [matchStatuses, setMatchStatuses] = useState({});
    const [hallNames, setHallNames] = useState({});
    const [groupsData, setGroupsData] = useState({});
    const [matchScoresFromEvents, setMatchScoresFromEvents] = useState({});
    const [matchScoresFromDb, setMatchScoresFromDb] = useState({});
    const [categoriesData, setCategoriesData] = useState({});
    const [allMatchesList, setAllMatchesList] = useState([]);

    useEffect(() => {
        setLoading(true);
        setMatches([]);
        setAllMatchesList([]);
        setMatchScoresFromEvents({});
        setMatchScoresFromDb({});
    }, [teamName, categoryName]);

    useEffect(() => {
        const loadGroups = async () => {
            if (!window.db) return;
            try {
                const groupsRef = doc(window.db, 'settings', 'groups');
                const groupsSnap = await getDoc(groupsRef);
                if (groupsSnap.exists()) {
                    const data = groupsSnap.data();
                    setGroupsData(data);
                    window.groupsData = data;
                }
            } catch (err) {}
        };
        loadGroups();
    }, []);

    useEffect(() => {
        const loadCategories = async () => {
            if (!window.db) return;
            try {
                const settingsRef = doc(window.db, 'settings', 'categories');
                const settingsSnap = await getDoc(settingsRef);
                if (settingsSnap.exists()) {
                    const data = settingsSnap.data();
                    const categories = {};
                    Object.entries(data).forEach(([catId, catData]) => {
                        if (catData.name) categories[catId] = catData.name;
                    });
                    setCategoriesData(categories);
                    window.categoriesData = categories;
                }
            } catch (err) {}
        };
        loadCategories();
    }, []);

    const loadHallNames = async (matchesList) => {
        const hallIds = new Set();
        matchesList.forEach(match => {
            if (match.hallId) hallIds.add(match.hallId);
        });
        const names = {};
        for (const hallId of hallIds) {
            try {
                const hallRef = doc(window.db, 'places', hallId);
                const hallSnap = await getDoc(hallRef);
                names[hallId] = hallSnap.exists() ? hallSnap.data().name : 'Športová hala';
            } catch (err) {
                names[hallId] = 'Športová hala';
            }
        }
        setHallNames(names);
    };

    const convertTeamNames = async (matchesList) => {
        const names = { ...teamNames };
        let needsUpdate = false;
        
        let attempts = 0;
        while (!window.matchTracker && attempts < 10) {
            await new Promise(resolve => setTimeout(resolve, 200));
            attempts++;
        }
        
        const teamIdentifiers = new Set();
        matchesList.forEach(match => {
            if (match.homeTeamIdentifier) teamIdentifiers.add(match.homeTeamIdentifier);
            if (match.awayTeamIdentifier) teamIdentifiers.add(match.awayTeamIdentifier);
        });
        
        if (window.matchTracker && typeof window.matchTracker.getTeamNameByDisplayId === 'function') {
            for (const identifier of teamIdentifiers) {
                const currentDisplayName = names[identifier] || getDisplayTeamName(identifier);
                if (currentDisplayName) {
                    try {
                        const convertedName = await window.matchTracker.getTeamNameByDisplayId(currentDisplayName);
                        if (convertedName && convertedName !== currentDisplayName && convertedName !== names[identifier]) {
                            names[identifier] = convertedName;
                            needsUpdate = true;
                        } else if (!names[identifier]) {
                            names[identifier] = currentDisplayName;
                        }
                    } catch (err) {
                        if (!names[identifier]) {
                            names[identifier] = currentDisplayName;
                        }
                    }
                } else if (!names[identifier]) {
                    names[identifier] = identifier;
                }
            }
        } else {
            for (const identifier of teamIdentifiers) {
                if (!names[identifier]) {
                    names[identifier] = getDisplayTeamName(identifier) || identifier;
                }
            }
        }
        
        if (needsUpdate) {
            setTeamNames(names);
        }
        
        return names;
    };

    const filterMatches = (allMatches, names) => {
        const filtered = [];
        
        allMatches.forEach(match => {
            const homeName = names[match.homeTeamIdentifier] || getDisplayTeamName(match.homeTeamIdentifier) || match.homeTeamIdentifier;
            const awayName = names[match.awayTeamIdentifier] || getDisplayTeamName(match.awayTeamIdentifier) || match.awayTeamIdentifier;
            
            let matchCategory = match.categoryName;
            if (!matchCategory && match.categoryId && categoriesData[match.categoryId]) {
                matchCategory = categoriesData[match.categoryId];
            }
            
            if ((homeName === teamName || awayName === teamName) && matchCategory === categoryName) {
                filtered.push({
                    ...match,
                    _homeDisplay: homeName,
                    _awayDisplay: awayName
                });
            }
        });
        
        return filtered;
    };

    useEffect(() => {
        if (!window.db || !teamName || !categoryName) {
            setLoading(false);
            return;
        }

        const matchesRef = collection(window.db, 'matches');
        let unsubscribe = null;

        const processSnapshot = async (snapshot) => {
            const allMatches = [];
            const statuses = {};
            const scores = {};

            snapshot.forEach((doc) => {
                const match = { id: doc.id, ...doc.data() };
                allMatches.push(match);
                statuses[doc.id] = match.status || 'scheduled';
                if (match.homeScore !== undefined && match.awayScore !== undefined) {
                    scores[doc.id] = { home: match.homeScore, away: match.awayScore };
                }
            });

            allMatches.sort((a, b) => {
                if (!a.scheduledTime) return 1;
                if (!b.scheduledTime) return -1;
                try {
                    return a.scheduledTime.toDate().getTime() - b.scheduledTime.toDate().getTime();
                } catch (e) { return 0; }
            });

            setMatchStatuses(statuses);
            setMatchScoresFromDb(scores);
            await loadHallNames(allMatches);
            
            const convertedNames = await convertTeamNames(allMatches);
            
            setAllMatchesList(allMatches);
            
            const filtered = filterMatches(allMatches, convertedNames);
            setMatches(filtered);
            setLoading(false);
        };

        const loadMatchesData = async () => {
            try {
                const querySnapshot = await getDocs(matchesRef);
                await processSnapshot(querySnapshot);
            } catch (err) {
                setLoading(false);
            }
        };

        loadMatchesData();

        unsubscribe = onSnapshot(matchesRef, async (snapshot) => {
            const allMatches = [];
            const statuses = {};
            const scores = {};

            snapshot.forEach((doc) => {
                const match = { id: doc.id, ...doc.data() };
                allMatches.push(match);
                statuses[doc.id] = match.status || 'scheduled';
                if (match.homeScore !== undefined && match.awayScore !== undefined) {
                    scores[doc.id] = { home: match.homeScore, away: match.awayScore };
                }
            });

            allMatches.sort((a, b) => {
                if (!a.scheduledTime) return 1;
                if (!b.scheduledTime) return -1;
                try {
                    return a.scheduledTime.toDate().getTime() - b.scheduledTime.toDate().getTime();
                } catch (e) { return 0; }
            });

            setMatchStatuses(statuses);
            setMatchScoresFromDb(scores);
            await loadHallNames(allMatches);
            
            const convertedNames = await convertTeamNames(allMatches);
            
            setAllMatchesList(allMatches);
            
            const filtered = filterMatches(allMatches, convertedNames);
            setMatches(filtered);
            setLoading(false);
        }, (error) => {
            setLoading(false);
        });

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [teamName, categoryName, categoriesData]);

    useEffect(() => {
        if (!window.db || allMatchesList.length === 0) return;

        const eventsRef = collection(window.db, 'matchEvents');
        const unsubscribe = onSnapshot(eventsRef, (snapshot) => {
            const goalsByMatch = {};
            snapshot.forEach(doc => {
                const event = doc.data();
                if (event.eventType === 'goal') {
                    if (!goalsByMatch[event.matchId]) {
                        goalsByMatch[event.matchId] = { home: 0, away: 0 };
                    }
                    if (event.team === 'home') goalsByMatch[event.matchId].home++;
                    else if (event.team === 'away') goalsByMatch[event.matchId].away++;
                }
            });
            setMatchScoresFromEvents(goalsByMatch);
        });

        return () => unsubscribe();
    }, [allMatchesList]);

    if (loading) {
        return React.createElement(
            'div',
            { className: 'mt-4 bg-white rounded-xl shadow-xl p-6' },
            React.createElement(
                'div',
                { className: 'text-center text-gray-500 py-4' },
                React.createElement('div', { className: 'animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400 mx-auto' }),
                React.createElement('p', { className: 'text-sm mt-2' }, 'Načítavam zápasy tímu...')
            )
        );
    }

    if (matches.length === 0) {
        return React.createElement(
            'div',
            { className: 'mt-4 bg-white rounded-xl shadow-xl p-6' },
            React.createElement(
                'h3',
                { className: 'text-lg font-semibold text-gray-700 mb-2' },
                'Zápasy tímu'
            ),
            React.createElement(
                'p',
                { className: 'text-gray-500 text-sm' },
                'Pre tento tím neboli nájdené žiadne zápasy.'
            )
        );
    }

    const getMatchesByDay = (matchesList) => {
        const groups = {};
        matchesList.forEach(match => {
            if (match.scheduledTime) {
                try {
                    const date = match.scheduledTime.toDate();
                    const dateKey = date.toDateString();
                    if (!groups[dateKey]) {
                        groups[dateKey] = { date, matches: [] };
                    }
                    groups[dateKey].matches.push(match);
                } catch (e) {}
            }
        });
        return Object.values(groups).sort((a, b) => a.date - b.date);
    };

    const displayDays = getMatchesByDay(matches);

    return React.createElement(
        'div',
        { className: 'mt-4 bg-white rounded-xl shadow-xl p-6 overflow-hidden' },
        React.createElement(
            'h3',
            { className: 'text-lg font-semibold text-gray-700 mb-4' },
            `Zápasy tímu: ${teamName}`
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
                        React.createElement('th', { className: 'px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20' }, '')
                    )
                ),
                React.createElement(
                    'tbody',
                    { className: 'divide-y divide-gray-100' },
                    displayDays.map((dayGroup, dayIndex) => {
                        const rows = [];
                        rows.push(
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
                                        React.createElement('span', { className: 'font-semibold text-gray-800' }, formatDateHeader(dayGroup.date))
                                    )
                                )
                            )
                        );

                        dayGroup.matches.forEach((match, matchIndex) => {
                            const dateTime = formatMatchDateTime(match.scheduledTime);
                            const eventsScore = matchScoresFromEvents[match.id];
                            const dbScore = matchScoresFromDb[match.id];
                            const matchStatus = matchStatuses[match.id] || match.status || 'scheduled';
                            const isMatchInProgress = matchStatus === 'in-progress' || matchStatus === 'paused';
                            const isMatchCompleted = matchStatus === 'completed';
                            const hasDbScore = dbScore && (dbScore.home !== undefined && dbScore.home !== null);

                            let displayHomeScore = null, displayAwayScore = null, showScore = false;

                            if (isMatchCompleted && hasDbScore) {
                                displayHomeScore = dbScore.home;
                                displayAwayScore = dbScore.away;
                                showScore = true;
                            } else if (isMatchInProgress) {
                                if (eventsScore && (eventsScore.home > 0 || eventsScore.away > 0)) {
                                    displayHomeScore = eventsScore.home;
                                    displayAwayScore = eventsScore.away;
                                } else {
                                    displayHomeScore = 0;
                                    displayAwayScore = 0;
                                }
                                showScore = true;
                            } else if (hasDbScore) {
                                displayHomeScore = dbScore.home;
                                displayAwayScore = dbScore.away;
                                showScore = true;
                            }

                            const homeTeamDisplay = teamNames[match.homeTeamIdentifier] || match._homeDisplay || getDisplayTeamName(match.homeTeamIdentifier) || match.homeTeamIdentifier;
                            const awayTeamDisplay = teamNames[match.awayTeamIdentifier] || match._awayDisplay || getDisplayTeamName(match.awayTeamIdentifier) || match.awayTeamIdentifier;
                            const matchHallName = hallNames[match.hallId] || 'Športová hala';
                            const categoryColor = getCategoryDrawColor(match.categoryId);
                            const lighterCategoryColor = getLighterColor(categoryColor);
                            const matchColors = getMatchColors(match);

                            const infoTags = [];
                            if (match.matchType && !match.isPlacementMatch && match.matchType !== 'o 3. miesto') {
                                infoTags.push(
                                    React.createElement('span', {
                                        key: 'type',
                                        className: 'inline-block text-xs px-2 py-0.5 rounded-full whitespace-nowrap',
                                        style: { backgroundColor: matchColors.backgroundColor, color: matchColors.textColor, fontWeight: '500' }
                                    }, match.matchType)
                                );
                            }
                            if (match.isPlacementMatch || match.matchType === 'o 3. miesto') {
                                infoTags.push(
                                    React.createElement('span', {
                                        key: 'placement',
                                        className: 'inline-block text-xs px-2 py-0.5 rounded-full whitespace-nowrap',
                                        style: { backgroundColor: '#F3E8FF', color: '#6B21A5', fontWeight: '500' }
                                    }, match.isPlacementMatch ? `o ${match.placementRank}. miesto` : 'o 3. miesto')
                                );
                            }
                            if (match.groupName && !match.isPlacementMatch && match.matchType !== 'Zápas o 3. miesto') {
                                const groupColors = getGroupTypeColors(match.groupName, match.categoryId, groupsData);
                                infoTags.push(
                                    React.createElement('span', {
                                        key: 'group',
                                        className: 'inline-block text-xs px-2 py-0.5 rounded-full whitespace-nowrap',
                                        style: { backgroundColor: groupColors.backgroundColor, color: groupColors.textColor, fontWeight: '500' }
                                    }, match.groupName)
                                );
                            }
                                                      
                            const createMatchHash = (homeTeamId, awayTeamId) => {
                                const encodedHome = encodeURIComponent(homeTeamId.replace(/ /g, '-'));
                                const encodedAway = encodeURIComponent(awayTeamId.replace(/ /g, '-'));
                                return `matches.html#match/${encodedHome}/${encodedAway}`;
                            };

                            rows.push(
                                React.createElement(
                                    'tr',
                                    { key: `match-${dayIndex}-${matchIndex}`, className: 'hover:bg-gray-50 transition-colors' },
                                    React.createElement(
                                        'td',
                                        { className: 'px-4 py-3 whitespace-nowrap' },
                                        React.createElement('span', { className: 'font-mono font-medium text-gray-700 text-sm' }, dateTime?.time || '--:--')
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
                                            React.createElement('span', { className: 'text-gray-600 text-sm max-w-32' }, matchHallName)
                                        )
                                    ),
                                    React.createElement(
                                        'td',
                                        { className: 'px-4 py-3' },
                                        React.createElement('div', { className: 'flex flex-wrap gap-1' }, infoTags)
                                    ),
                                    React.createElement(
                                        'td',
                                        { className: 'px-4 py-3 whitespace-nowrap text-center' },
                                        React.createElement(
                                            'a',
                                            {
                                                href: createMatchHash(match.homeTeamIdentifier, match.awayTeamIdentifier),
                                                className: (() => {
                                                    const matchStatus = matchStatuses[match.id] || match.status || 'scheduled';
                                                    const isActive = matchStatus === 'in-progress' || matchStatus === 'paused';
                                                    return isActive 
                                                        ? 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800 text-xs px-3 py-1 rounded-full transition-colors inline-block'
                                                        : 'bg-gray-200 hover:bg-gray-300 text-gray-900 text-xs px-3 py-1 rounded-full transition-colors inline-block';
                                                })(),
                                                style: { fontWeight: '500', textDecoration: 'none' }
                                            },
                                            'Detail'
                                        )
                                    )
                                )
                            );
                        });

                        return rows;
                    }).flat()
                )
            )
        ),
        React.createElement(
            'div',
            { className: 'mt-3 pt-2 border-t border-gray-200 text-xs text-gray-400' },
            `Počet zápasov: ${matches.length}`
        )
    );
};

const TeamsOverviewApp = (props) => {
    const { userProfileData } = props;

    const [myTeams, setMyTeams] = useState([]);          // [{ category, teamName, categoryId, ... }]
    const [categoryIdToNameMap, setCategoryIdToNameMap] = useState({});
    const [selectedTeam, setSelectedTeam] = useState(null); // { category, teamName, categoryId }
    const [teamRoster, setTeamRoster] = useState([]);
    const [isLoadingRoster, setIsLoadingRoster] = useState(false);
    const [rosterTeamName, setRosterTeamName] = useState('');
    const [rosterCategoryName, setRosterCategoryName] = useState('');
    const [rosterUnsubscribe, setRosterUnsubscribe] = useState(null);
    const [membersStats, setMembersStats] = useState({});
    const [updateTrigger, setUpdateTrigger] = useState(0);
    const [isLoadingTeams, setIsLoadingTeams] = useState(true);

    const [isRostersVisible, setIsRostersVisible] = useState(
        window.pagesVisibility && 
        window.pagesVisibility['rosters'] && 
        window.pagesVisibility['rosters'].visible === true
    );

    const [isMatchesVisible, setIsMatchesVisible] = useState(
        window.pagesVisibility && 
        window.pagesVisibility['matches'] && 
        window.pagesVisibility['matches'].visible === true
    );

    // Sledovanie viditeľnosti rosters/matches
    useEffect(() => {
        if (!window.db) return;

        const updateRostersVisibility = () => {
            const visible = window.pagesVisibility && 
                           window.pagesVisibility['rosters'] && 
                           window.pagesVisibility['rosters'].visible === true;
            setIsRostersVisible(visible);
        };

        updateRostersVisibility();

        const pagesRef = collection(window.db, 'pages');
        const unsubscribe = onSnapshot(pagesRef, (snapshot) => {
            let rostersVisible = false;
            let matchesVisible = false;
            
            snapshot.forEach((doc) => {
                if (doc.id === 'rosters') {
                    const data = doc.data();
                    rostersVisible = data.visible === true;
                }
                if (doc.id === 'matches') {
                    const data = doc.data();
                    matchesVisible = data.visible === true;
                }
            });
            
            if (!window.pagesVisibility) window.pagesVisibility = {};
            window.pagesVisibility['rosters'] = { visible: rostersVisible };
            window.pagesVisibility['matches'] = { visible: matchesVisible };
            
            setIsRostersVisible(rostersVisible);
            setIsMatchesVisible(matchesVisible);
        }, (error) => {
        });

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, []);

    // Načítanie kategórií (id -> name)
    useEffect(() => {
        if (!window.db) return;
        const unsubscribeCategories = onSnapshot(doc(window.db, 'settings', 'categories'), (docSnap) => {
            const categoryIdToName = {};
            if (docSnap.exists()) {
                const categoryData = docSnap.data();
                Object.entries(categoryData).forEach(([categoryId, categoryObject]) => {
                    if (categoryObject && categoryObject.name) {
                        categoryIdToName[categoryId] = categoryObject.name;
                    }
                });
            }
            setCategoryIdToNameMap(categoryIdToName);
        });
        return () => unsubscribeCategories();
    }, []);

    // Načítanie týmov PRIHLÁSENÉHO používateľa
    useEffect(() => {
        if (!window.db || !userProfileData || !userProfileData.id) {
            setMyTeams([]);
            setIsLoadingTeams(false);
            return;
        }

        setIsLoadingTeams(true);
        const userDocRef = doc(window.db, 'users', userProfileData.id);

        const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
            if (!docSnap.exists()) {
                setMyTeams([]);
                setIsLoadingTeams(false);
                return;
            }

            const data = docSnap.data();
            const teamsObj = data.teams || {};
            const list = [];

            Object.entries(teamsObj).forEach(([categoryName, teamArray]) => {
                if (Array.isArray(teamArray)) {
                    teamArray.forEach(team => {
                        if (team.teamName) {
                            list.push({
                                category: categoryName,
                                teamName: team.teamName,
                                uid: docSnap.id,
                                id: team.id,
                                groupName: team.groupName || null,
                                order: team.order ?? null,
                            });
                        }
                    });
                }
            });

            // Zoradenie podľa kategórie a názvu tímu
            list.sort((a, b) => {
                const catCompare = slovakCollator.compare(a.category, b.category);
                if (catCompare !== 0) return catCompare;
                return slovakCollator.compare(a.teamName, b.teamName);
            });

            setMyTeams(list);
            setIsLoadingTeams(false);

            // Ak ešte nie je vybraný tím, vyberieme prvý
            if (list.length > 0 && !selectedTeam) {
                setSelectedTeam({
                    category: list[0].category,
                    teamName: list[0].teamName
                });
            }
        }, (error) => {
            setMyTeams([]);
            setIsLoadingTeams(false);
        });

        return () => unsubscribe();
    }, [userProfileData?.id]);

    // Načítanie súpisky keď sa zmení vybraný tím
    useEffect(() => {
        if (!selectedTeam) {
            setTeamRoster([]);
            return;
        }

        const { teamName, category } = selectedTeam;
        
        if (rosterUnsubscribe) {
            try { rosterUnsubscribe(); } catch (e) {}
            setRosterUnsubscribe(null);
        }

        setIsLoadingRoster(true);
        setRosterTeamName(teamName);
        setRosterCategoryName(category);

        const handleMembersUpdate = (members) => {
            setTeamRoster(members);
            setIsLoadingRoster(false);
        };

        try {
            const unsubscribe = loadTeamMembers(teamName, category, handleMembersUpdate);
            setRosterUnsubscribe(() => unsubscribe);
        } catch (error) {
            setIsLoadingRoster(false);
            setTeamRoster([]);
        }

        const timeoutId = setTimeout(() => setIsLoadingRoster(false), 10000);
        return () => clearTimeout(timeoutId);
    }, [selectedTeam]);

    // Výpočet štatistík členov (góly, karty, ...)
    useEffect(() => {    
        if (!teamRoster || teamRoster.length === 0 || !window.db) {
            setMembersStats({});
            return;
        }
    
        const currentTeamName = rosterTeamName || selectedTeam?.teamName || '';
        const currentCategoryName = rosterCategoryName || selectedTeam?.category || '';
        
        if (!currentTeamName || !currentCategoryName) {
            setMembersStats({});
            return;
        }
    
        const matchesRef = collection(window.db, 'matches');
        const matchesQuery = query(matchesRef);
    
        let matchIds = new Set();
        let isFirstLoad = true;
    
        const convertIdentifierToDisplayName = (identifier) => {
            if (!identifier) return identifier;
            if (window.teamManager && typeof window.teamManager.getTeamNameByDisplayIdSync === 'function') {
                try {
                    const convertedName = window.teamManager.getTeamNameByDisplayIdSync(identifier);
                    if (convertedName && convertedName !== identifier) return convertedName;
                } catch (err) {}
            }
            return identifier;
        };
    
        const calculateStatsFromEvents = (eventsSnapshot) => {    
            const stats = {};
            teamRoster.forEach((member) => {
                const memberKey = `${member.type}_${member.originalIndex}`;
                stats[memberKey] = {
                    goals: 0, convertedPenalties: 0, missedPenalties: 0,
                    yellowCards: 0, redCards: 0, blueCards: 0, exclusions: 0,
                    dbArrayName: member.dbArrayName,
                    dbIndex: member.originalIndex,
                    name: `${member.firstName} ${member.lastName}`.trim(),
                    jerseyNumber: member.jerseyNumber || '',
                    memberType: member.type,
                    teamName: member.teamName,
                    categoryName: member.categoryName
                };
            });
        
            eventsSnapshot.forEach((doc) => {
                const eventData = doc.data();
                const matchId = eventData.matchId;
                
                if (eventData.categoryName && eventData.categoryName !== currentCategoryName) return;
                
                const matchInfo = matchTeamMap[matchId];
                if (!matchInfo) return;
                
                let isOurTeam = false;
                if (eventData.team === 'home' && matchInfo.homeTeam === currentTeamName) isOurTeam = true;
                else if (eventData.team === 'away' && matchInfo.awayTeam === currentTeamName) isOurTeam = true;
                else return;
                
                let foundMemberKey = null;
                for (const [memberKey, stat] of Object.entries(stats)) {
                    if (stat.dbArrayName === eventData.memberTypeKey && stat.dbIndex === eventData.memberIndex) {
                        foundMemberKey = memberKey;
                        break;
                    }
                }
                
                if (!foundMemberKey) return;
                
                const stat = stats[foundMemberKey];
                
                switch (eventData.eventType) {
                    case 'goal':
                        stat.goals++;
                        if (eventData.eventSubtype === 'converted_penalty') stat.convertedPenalties++;
                        break;
                    case 'penalty':
                        stat.missedPenalties++;
                        break;
                    case 'card':
                        if (eventData.eventSubtype === 'yellow') stat.yellowCards++;
                        else if (eventData.eventSubtype === 'red') stat.redCards++;
                        else if (eventData.eventSubtype === 'blue') stat.blueCards++;
                        break;
                    case 'exclusion':
                        stat.exclusions++;
                        break;
                }
            });
                
            return stats;
        };
    
        let eventsUnsubscribe = null;
        let matchTeamMap = {};
    
        const setupEventsListener = (matchIdsArray) => {
            if (eventsUnsubscribe) {
                try { eventsUnsubscribe(); } catch (e) {}
                eventsUnsubscribe = null;
            }
    
            if (matchIdsArray.length === 0) {
                const emptyStats = {};
                teamRoster.forEach((member) => {
                    const memberKey = `${member.type}_${member.originalIndex}`;
                    emptyStats[memberKey] = {
                        goals: 0, convertedPenalties: 0, missedPenalties: 0,
                        yellowCards: 0, redCards: 0, blueCards: 0, exclusions: 0,
                        dbArrayName: member.dbArrayName,
                        dbIndex: member.originalIndex,
                        name: `${member.firstName} ${member.lastName}`.trim(),
                        jerseyNumber: member.jerseyNumber || '',
                        memberType: member.type
                    };
                });
                setMembersStats(emptyStats);
                return;
            }
    
            const chunkSize = 10;
            const chunks = [];
            for (let i = 0; i < matchIdsArray.length; i += chunkSize) {
                chunks.push(matchIdsArray.slice(i, i + chunkSize));
            }
    
            const listeners = [];
            let processedChunks = 0;
            const combinedStats = {};
    
            chunks.forEach((chunk) => {
                const eventsRef = collection(window.db, 'matchEvents');
                const eventsQuery = query(eventsRef, where('matchId', 'in', chunk));
    
                const listener = onSnapshot(eventsQuery, (eventsSnapshot) => {
                    const chunkStats = calculateStatsFromEvents(eventsSnapshot);
                    
                    Object.entries(chunkStats).forEach(([memberKey, stat]) => {
                        if (!combinedStats[memberKey]) {
                            combinedStats[memberKey] = { ...stat };
                        } else {
                            combinedStats[memberKey].goals += stat.goals;
                            combinedStats[memberKey].convertedPenalties += stat.convertedPenalties;
                            combinedStats[memberKey].missedPenalties += stat.missedPenalties;
                            combinedStats[memberKey].yellowCards += stat.yellowCards;
                            combinedStats[memberKey].redCards += stat.redCards;
                            combinedStats[memberKey].blueCards += stat.blueCards;
                            combinedStats[memberKey].exclusions += stat.exclusions;
                        }
                    });
    
                    processedChunks++;
                    if (processedChunks === chunks.length) {
                        setMembersStats({ ...combinedStats });
                        processedChunks = 0;
                    }
                }, (error) => {
                    processedChunks++;
                    if (processedChunks === chunks.length) processedChunks = 0;
                });
    
                listeners.push(listener);
            });
    
            eventsUnsubscribe = () => {
                listeners.forEach(listener => { try { listener(); } catch (e) {} });
            };
        };
    
        let unsubscribeMatches = null;
    
        const processMatches = (matchesSnapshot) => {
            const newMatchIds = new Set();
            const newMatchTeamMap = {};
            const fullTeamName = currentTeamName;
            
            matchesSnapshot.forEach(doc => {
                const matchData = doc.data();
                let convertedHome = convertIdentifierToDisplayName(matchData.homeTeamIdentifier);
                let convertedAway = convertIdentifierToDisplayName(matchData.awayTeamIdentifier);
                
                newMatchTeamMap[doc.id] = { homeTeam: convertedHome, awayTeam: convertedAway };
                
                if (convertedHome === fullTeamName || convertedAway === fullTeamName) {
                    newMatchIds.add(doc.id);
                }
            });
        
            matchTeamMap = newMatchTeamMap;
        
            const newMatchIdsArray = Array.from(newMatchIds);
            const oldMatchIdsArray = Array.from(matchIds);
            const matchIdsChanged = newMatchIdsArray.length !== oldMatchIdsArray.length || 
                                   newMatchIdsArray.some(id => !oldMatchIdsArray.includes(id));        
        
            if (matchIdsChanged || isFirstLoad) {
                matchIds = newMatchIds;
                isFirstLoad = false;
                setupEventsListener(newMatchIdsArray);
            }
        };
        
        unsubscribeMatches = onSnapshot(matchesQuery, (matchesSnapshot) => {
            processMatches(matchesSnapshot);
        }, (error) => {});
    
        return () => {
            if (unsubscribeMatches) { try { unsubscribeMatches(); } catch (e) {} }
            if (eventsUnsubscribe) { try { eventsUnsubscribe(); } catch (e) {} }
        };
    }, [teamRoster, rosterTeamName, rosterCategoryName, selectedTeam, updateTrigger]);

    const handleTeamButtonClick = (team) => {
        setSelectedTeam({
            category: team.category,
            teamName: team.teamName
        });
    };

    const renderTeamButtons = () => {
        if (isLoadingTeams) {
            return React.createElement(
                'div',
                { className: 'text-center text-gray-500 py-4' },
                React.createElement('div', { className: 'animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400 mx-auto' }),
                React.createElement('p', { className: 'text-sm mt-2' }, 'Načítavam vaše tímy...')
            );
        }

        if (myTeams.length === 0) {
            return React.createElement(
                'div',
                { className: 'bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800 text-sm' },
                'Pre váš účet neboli nájdené žiadne tímy. Skontrolujte, či máte priradené tímy v kategóriách.'
            );
        }

        return React.createElement(
            'div',
            { className: 'flex flex-wrap gap-3' },
            myTeams.map((team, index) => {
                const isSelected = selectedTeam && 
                                   selectedTeam.category === team.category && 
                                   selectedTeam.teamName === team.teamName;
                const label = `${team.category} | ${team.teamName}`;
                return React.createElement(
                    'button',
                    {
                        key: index,
                        onClick: () => handleTeamButtonClick(team),
                        className: `px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
                            isSelected
                                ? 'bg-blue-500 text-white hover:bg-blue-600'
                                : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                        }`
                    },
                    label
                );
            })
        );
    };

    const renderTeamRoster = () => {
        if (!selectedTeam) return null;
        if (!isRostersVisible) return null;

        if (isLoadingRoster) {
            return React.createElement(
                'div',
                { className: 'mt-4 bg-white rounded-xl shadow-xl p-6' },
                React.createElement(
                    'div',
                    { className: 'text-center text-gray-500 py-4' },
                    React.createElement('div', { className: 'animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400 mx-auto' }),
                    React.createElement('p', { className: 'text-sm mt-2' }, 'Načítavam súpisku tímu...')
                )
            );
        }

        const displayTeamName = rosterTeamName || selectedTeam?.teamName || '';
        const displayCategoryName = rosterCategoryName || selectedTeam?.category || '';

        if (!teamRoster || teamRoster.length === 0) {
            return React.createElement(
                'div',
                { className: 'mt-4 bg-white rounded-xl shadow-xl p-6' },
                React.createElement(
                    'h3',
                    { className: 'text-lg font-semibold text-gray-700 mb-2' },
                    `Súpiska tímu: ${displayTeamName}`
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-500' },
                    'Tento tím momentálne nemá žiadnych hráčov v súpiske.'
                )
            );
        }

        const players = teamRoster.filter(m => m.type === 'Hráč').sort((a, b) => {
            const aNum = parseInt(a.jerseyNumber) || 999;
            const bNum = parseInt(b.jerseyNumber) || 999;
            return aNum - bNum;
        });
        const rtMembers = teamRoster.filter(m => m.type !== 'Hráč');
        const sortedRoster = [...players, ...rtMembers];

        const getMemberStats = (member) => {
            const memberKey = `${member.type}_${member.originalIndex}`;
            const stats = membersStats[memberKey];
            if (!stats) {
                return { goals: 0, convertedPenalties: 0, missedPenalties: 0, yellowCards: 0, redCards: 0, blueCards: 0, exclusions: 0 };
            }
            return stats;
        };

        return React.createElement(
            'div',
            { className: 'mt-4 bg-white rounded-xl shadow-xl p-6 overflow-hidden' },
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mb-4' },
                React.createElement(
                    'h3',
                    { className: 'text-lg font-semibold text-gray-700' },
                    `Súpiska tímu: ${displayTeamName}`
                ),
                React.createElement(
                    'span',
                    { className: 'text-sm text-gray-500' },
                    `Kategória: ${displayCategoryName}`
                )
            ),
            React.createElement(
                'div',
                { className: 'overflow-x-auto' },
                React.createElement(
                    'table',
                    { className: 'w-full border-collapse text-sm' },
                    React.createElement(
                        'thead',
                        { className: 'bg-gray-100 sticky top-0' },
                        React.createElement(
                            'tr',
                            { className: 'border-b border-gray-200' },
                            React.createElement('th', { className: 'px-2 py-2 text-left text-xs font-medium text-gray-500', style: { width: '30px' } }, ''),
                            React.createElement('th', { className: 'px-2 py-2 text-left text-xs font-medium text-gray-500', style: { width: '40px' } }, 'Č.'),
                            React.createElement('th', { className: 'px-2 py-2 text-left text-xs font-medium text-gray-500' }, 'Meno a priezvisko'),
                            React.createElement('th', { className: 'px-2 py-2 text-center text-xs font-medium text-gray-500', style: { width: '45px' } }, 
                                React.createElement('div', { className: 'flex flex-col items-center' },
                                    React.createElement('i', { className: 'fa-solid fa-futbol text-green-600 text-sm' }),
                                    React.createElement('span', { className: 'text-xs mt-0.5' }, 'Gól')
                                )
                            ),
                            React.createElement('th', { className: 'px-2 py-2 text-center text-xs font-medium text-gray-500', style: { width: '55px' } }, 
                                React.createElement('div', { className: 'flex flex-col items-center' },
                                    React.createElement('i', { className: 'fa-solid fa-futbol text-teal-500 text-sm' }),
                                    React.createElement('span', { className: 'text-xs mt-0.5' }, '7m')
                                )
                            ),
                            React.createElement('th', { className: 'px-2 py-2 text-center text-xs font-medium text-gray-500', style: { width: '45px' } }, 
                                React.createElement('div', { className: 'flex flex-col items-center' },
                                    React.createElement('i', { className: 'fa-solid fa-square text-yellow-500 text-sm' }),
                                    React.createElement('span', { className: 'text-xs mt-0.5' }, 'ŽK')
                                )
                            ),
                            React.createElement('th', { className: 'px-2 py-2 text-center text-xs font-medium text-gray-500', style: { width: '45px' } }, 
                                React.createElement('div', { className: 'flex flex-col items-center' },
                                    React.createElement('i', { className: 'fa-solid fa-square text-red-600 text-sm' }),
                                    React.createElement('span', { className: 'text-xs mt-0.5' }, 'ČK')
                                )
                            ),
                            React.createElement('th', { className: 'px-2 py-2 text-center text-xs font-medium text-gray-500', style: { width: '45px' } }, 
                                React.createElement('div', { className: 'flex flex-col items-center' },
                                    React.createElement('i', { className: 'fa-solid fa-square text-blue-500 text-sm' }),
                                    React.createElement('span', { className: 'text-xs mt-0.5' }, 'MK')
                                )
                            ),
                            React.createElement('th', { className: 'px-2 py-2 text-center text-xs font-medium text-gray-500', style: { width: '55px' } }, 
                                React.createElement('div', { className: 'flex flex-col items-center' },
                                    React.createElement('i', { className: 'fa-solid fa-clock text-orange-500 text-sm' }),
                                    React.createElement('span', { className: 'text-xs mt-0.5' }, 'Vylúč.')
                                )
                            )
                        )
                    ),
                    React.createElement(
                        'tbody',
                        { className: 'divide-y divide-gray-100' },
                        sortedRoster.map((member, index) => {
                            const fullName = `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Neznámy';
                            const stats = getMemberStats(member);
                            const totalPenalties = stats.convertedPenalties + stats.missedPenalties;
                            const penaltiesDisplay = totalPenalties > 0 ? `${stats.convertedPenalties}/${totalPenalties}` : '';                            
                            
                            const memberIcon = member.type === 'Hráč' 
                                ? React.createElement('i', { className: 'fa-solid fa-user text-gray-500 text-sm' })
                                : (member.type === 'Člen RT (muž)' 
                                    ? React.createElement('i', { className: 'fa-solid fa-user-tie text-blue-500 text-sm' })
                                    : (member.type === 'Člen RT (žena)'
                                        ? React.createElement('i', { className: 'fa-solid fa-user-tie text-red-500 text-sm' })
                                        : React.createElement('i', { className: 'fa-solid fa-user text-gray-400 text-sm' })));
                            
                            const rowClass = index % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50 hover:bg-gray-100';
                            
                            return React.createElement(
                                'tr',
                                { 
                                    key: `${member.type}_${member.originalIndex || index}`,
                                    className: `${rowClass} transition-colors cursor-default`
                                },
                                React.createElement('td', { className: 'px-2 py-2 text-center' }, memberIcon),
                                React.createElement('td', { className: 'px-2 py-2 font-mono font-medium text-gray-700 text-center' }, member.jerseyNumber || ''),
                                React.createElement('td', { className: 'px-2 py-2 text-gray-800' }, fullName),
                                React.createElement('td', { className: 'px-2 py-2 text-center font-bold text-green-600' }, stats.goals > 0 ? stats.goals : ''),
                                React.createElement('td', { className: 'px-2 py-2 text-center font-medium text-teal-600' }, penaltiesDisplay),
                                React.createElement('td', { className: 'px-2 py-2 text-center font-bold text-yellow-600' }, stats.yellowCards > 0 ? stats.yellowCards : ''),
                                React.createElement('td', { className: 'px-2 py-2 text-center font-bold text-red-600' }, stats.redCards > 0 ? stats.redCards : ''),
                                React.createElement('td', { className: 'px-2 py-2 text-center font-bold text-blue-600' }, stats.blueCards > 0 ? stats.blueCards : ''),
                                React.createElement('td', { className: 'px-2 py-2 text-center font-bold text-orange-600' }, stats.exclusions > 0 ? stats.exclusions : '')
                            );
                        })
                    )
                )
            ),
            React.createElement(
                'div',
                { className: 'mt-4 pt-3 border-t border-gray-200 text-xs text-gray-400' },
                `Počet členov: ${teamRoster.length}`
            )
        );
    };

    return React.createElement(
        'div',
        { className: 'flex flex-col w-full p-4 relative text-[87.5%]' },
        React.createElement(NotificationPortal, null),
        React.createElement(
            'div',
            { className: 'mb-6' },
            React.createElement(
                'h1',
                { className: 'text-3xl font-bold text-gray-800 text-center' },
                'Moje tímy'
            ),
            React.createElement(
                'p',
                { className: 'text-center text-gray-500 mt-1' },
                'Kliknutím na tlačidlo vyberiete konkrétny tím'
            )
        ),
        // Tlačidlá s tímami používateľa
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-xl p-6 mb-4' },
            React.createElement(
                'h3',
                { className: 'text-lg font-semibold text-gray-700 mb-4' },
                'Vaše tímy:'
            ),
            renderTeamButtons()
        ),
        // Zápasy tímu (len ak je matches zverejnená a je vybraný tím)
        (isMatchesVisible && selectedTeam) ? React.createElement(TeamMatchesList, {
            teamName: selectedTeam.teamName,
            categoryName: selectedTeam.category,
            categoryId: (() => {
                const foundId = Object.keys(categoryIdToNameMap).find(id => categoryIdToNameMap[id] === selectedTeam.category);
                return foundId || null;
            })()
        }) : null,
        // Súpiska tímu
        renderTeamRoster()
    );
};

let isEmailSyncListenerSetup = false;

const handleDataUpdateAndRender = (event) => {
    const userProfileData = event?.detail || null;
    const rootElement = document.getElementById('root');
    
    if (!rootElement || typeof ReactDOM === 'undefined' || typeof React === 'undefined') {
        return;
    }

    try {
        const root = ReactDOM.createRoot(rootElement);
        root.render(React.createElement(TeamsOverviewApp, { 
            userProfileData: userProfileData || null 
        }));
        
        if (window.auth && window.db && !isEmailSyncListenerSetup && userProfileData) {
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
                                    changes: `zmena: e-mailovej adresy z '${firestoreEmail}' na '${user.email}'.`,
                                    timestamp: new Date(),
                                });
                            }
                        }
                    } catch (error) {
                    }
                }
            });
            isEmailSyncListenerSetup = true;
        }
    } catch (error) {
        rootElement.innerHTML = `
            <div class="text-center py-16">
                <p class="text-red-600 text-lg">Chyba pri načítaní aplikácie</p>
                <p class="text-gray-500 text-sm">${error.message}</p>
            </div>
        `;
    }
};

window.addEventListener('globalDataUpdated', handleDataUpdateAndRender);

const rootElement = document.getElementById('root');
if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
    const root = ReactDOM.createRoot(rootElement);
    root.render(React.createElement(TeamsOverviewApp, { 
        userProfileData: window.globalUserProfileData || null 
    }));
}

window.TeamsOverviewApp = TeamsOverviewApp;
