// teams.js - opravená verzia so samostatnou komponentou pre tabuľku
import React from "https://esm.sh/react@18.2.0";
import ReactDOM from "https://esm.sh/react-dom@18.2.0";
import { doc, getDoc, onSnapshot, updateDoc, collection, query, getDocs, setDoc, addDoc, serverTimestamp, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
const { useState, useEffect, useRef } = React;
const listeners = new Set();

// Stabilná notifikácia cez portál
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

// Funkcia na načítanie členov tímu
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
        
        for (const userDoc of usersSnapshot.docs) {
            const userId = userDoc.id;
            const userData = userDoc.data();
            const teams = userData.teams || {};
            
            for (const [categoryKey, teamsArray] of Object.entries(teams)) {
                if (categoryKey !== categoryName) continue;                
                
                const foundTeam = (teamsArray || []).find(t => t.teamName === actualTeamName);
                
                if (foundTeam) {
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

const forceUpdateUI = () => {    
    const rootElement = document.getElementById('root');
    if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
        try {
            const userProfileData = window.globalUserProfileData || null;
            const root = ReactDOM.createRoot(rootElement);
            root.render(React.createElement(TeamsOverviewApp, { 
                userProfileData: userProfileData 
            }));
            console.log('✅ [forceUpdateUI] UI bolo aktualizované');
        } catch (error) {
            console.error('❌ [forceUpdateUI] Chyba pri aktualizácii UI:', error);
        }
    }
};

window.forceUpdateUI = forceUpdateUI;

// --- KOMPONENTA PRE ZBER ŠTATISTÍK PRE JEDEN TÍM ---
const TeamStatsCollector = ({ teamName, categoryName, onStatsUpdate }) => {
    const [rosterData, setRosterData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [unsubscribe, setUnsubscribe] = useState(null);
    const [membersStats, setMembersStats] = useState({});
    const [updateTrigger, setUpdateTrigger] = useState(0);
    
    // Načítanie súpisky
    useEffect(() => {
        let timeoutId = null;
        let unsub = null;
        
        const loadRoster = () => {
            setIsLoading(true);
            
            const handleMembersUpdate = (members) => {
                setRosterData(members);
                setIsLoading(false);
            };
            
            try {
                unsub = loadTeamMembers(teamName, categoryName, handleMembersUpdate);
                setUnsubscribe(() => unsub);
            } catch (error) {
                console.error(`[TeamStatsCollector] Chyba pri načítaní súpisky pre ${teamName}:`, error);
                setIsLoading(false);
                setRosterData([]);
            }
            
            timeoutId = setTimeout(() => {
                setIsLoading(false);
            }, 10000);
        };
        
        loadRoster();
        
        return () => {
            if (unsub) {
                try {
                    unsub();
                } catch (e) {}
            }
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    }, [teamName, categoryName]);
    
    // --- FUNKCIA NA KONVERZIU IDENTIFIKÁTORA ---
    const convertIdentifierToDisplayName = (identifier) => {
        if (!identifier) return identifier;
        
        if (window.teamManager && typeof window.teamManager.getTeamNameByDisplayIdSync === 'function') {
            try {
                const convertedName = window.teamManager.getTeamNameByDisplayIdSync(identifier);
                if (convertedName && convertedName !== identifier) {
                    return convertedName;
                }
            } catch (err) {
                console.log(`[Stats Effect] ⚠️ Chyba pri konverzii "${identifier}":`, err);
            }
        }
        return identifier;
    };
    
    // --- ŠTATISTIKY ---
    useEffect(() => {
        if (!rosterData || rosterData.length === 0 || !window.db) {
            setMembersStats({});
            if (onStatsUpdate) onStatsUpdate(teamName, {});
            return;
        }
    
        const currentTeamName = teamName;
        const currentCategoryName = categoryName;
    
        if (!currentTeamName || !currentCategoryName) {
            setMembersStats({});
            if (onStatsUpdate) onStatsUpdate(teamName, {});
            return;
        }
    
        const matchesRef = collection(window.db, 'matches');
        const matchesQuery = query(matchesRef);
    
        let matchIds = new Set();
        let isFirstLoad = true;
        let matchTeamMap = {};
    
        const calculateStatsFromEvents = (eventsSnapshot) => {
            const stats = {};
            rosterData.forEach((member, idx) => {
                const memberKey = `${member.type}_${member.originalIndex}`;
                stats[memberKey] = {
                    goals: 0,
                    convertedPenalties: 0,
                    missedPenalties: 0,
                    yellowCards: 0,
                    redCards: 0,
                    blueCards: 0,
                    exclusions: 0,
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
                
                if (eventData.categoryName && eventData.categoryName !== currentCategoryName) {
                    return;
                }
                
                const matchInfo = matchTeamMap[matchId];
                if (!matchInfo) {
                    return;
                }
                
                let isOurTeam = false;
                const fullTeamName = currentTeamName;
                const homeTeam = matchInfo.homeTeam || '';
                const awayTeam = matchInfo.awayTeam || '';
                
                if (eventData.team === 'home') {
                    if (homeTeam === fullTeamName) {
                        isOurTeam = true;
                    }
                } else if (eventData.team === 'away') {
                    if (awayTeam === fullTeamName) {
                        isOurTeam = true;
                    }
                }
                
                if (!isOurTeam) {
                    return;
                }
                
                let foundMemberKey = null;
                for (const [memberKey, stat] of Object.entries(stats)) {
                    if (stat.dbArrayName === eventData.memberTypeKey && stat.dbIndex === eventData.memberIndex) {
                        foundMemberKey = memberKey;
                        break;
                    }
                }
                
                if (!foundMemberKey) {
                    return;
                }
                
                const stat = stats[foundMemberKey];
                
                switch (eventData.eventType) {
                    case 'goal':
                        stat.goals++;
                        if (eventData.eventSubtype === 'converted_penalty') {
                            stat.convertedPenalties++;
                        }
                        break;
                    case 'penalty':
                        stat.missedPenalties++;
                        break;
                    case 'card':
                        if (eventData.eventSubtype === 'yellow') {
                            stat.yellowCards++;
                        } else if (eventData.eventSubtype === 'red') {
                            stat.redCards++;
                        } else if (eventData.eventSubtype === 'blue') {
                            stat.blueCards++;
                        }
                        break;
                    case 'exclusion':
                        stat.exclusions++;
                        break;
                }
            });
        
            return stats;
        };
    
        let eventsUnsubscribe = null;
    
        const setupEventsListener = (matchIdsArray) => {
            if (eventsUnsubscribe) {
                try {
                    eventsUnsubscribe();
                } catch (e) {}
                eventsUnsubscribe = null;
            }
    
            if (matchIdsArray.length === 0) {
                const emptyStats = {};
                rosterData.forEach((member, idx) => {
                    const memberKey = `${member.type}_${member.originalIndex}`;
                    emptyStats[memberKey] = {
                        goals: 0,
                        convertedPenalties: 0,
                        missedPenalties: 0,
                        yellowCards: 0,
                        redCards: 0,
                        blueCards: 0,
                        exclusions: 0,
                        dbArrayName: member.dbArrayName,
                        dbIndex: member.originalIndex,
                        name: `${member.firstName} ${member.lastName}`.trim(),
                        jerseyNumber: member.jerseyNumber || '',
                        memberType: member.type,
                        teamName: member.teamName,
                        categoryName: member.categoryName
                    };
                });
                setMembersStats(emptyStats);
                if (onStatsUpdate) onStatsUpdate(teamName, emptyStats);
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
    
            chunks.forEach((chunk, index) => {
                const eventsRef = collection(window.db, 'matchEvents');
                const eventsQuery = query(
                    eventsRef,
                    where('matchId', 'in', chunk)
                );
    
                const listener = onSnapshot(eventsQuery, (eventsSnapshot) => {
                    const chunkStats = calculateStatsFromEvents(eventsSnapshot);
                    
                    Object.entries(chunkStats).forEach(([memberKey, stat]) => {
                        if (!combinedStats[memberKey]) {
                            combinedStats[memberKey] = {
                                goals: 0,
                                convertedPenalties: 0,
                                missedPenalties: 0,
                                yellowCards: 0,
                                redCards: 0,
                                blueCards: 0,
                                exclusions: 0,
                                dbArrayName: stat.dbArrayName,
                                dbIndex: stat.dbIndex,
                                name: stat.name,
                                jerseyNumber: stat.jerseyNumber,
                                memberType: stat.memberType,
                                teamName: stat.teamName,
                                categoryName: stat.categoryName
                            };
                        }
                        combinedStats[memberKey].goals += stat.goals;
                        combinedStats[memberKey].convertedPenalties += stat.convertedPenalties;
                        combinedStats[memberKey].missedPenalties += stat.missedPenalties;
                        combinedStats[memberKey].yellowCards += stat.yellowCards;
                        combinedStats[memberKey].redCards += stat.redCards;
                        combinedStats[memberKey].blueCards += stat.blueCards;
                        combinedStats[memberKey].exclusions += stat.exclusions;
                    });
    
                    processedChunks++;
    
                    if (processedChunks === chunks.length) {
                        const finalStats = {};
                        Object.entries(combinedStats).forEach(([memberKey, stat]) => {
                            finalStats[memberKey] = {
                                goals: stat.goals || 0,
                                convertedPenalties: stat.convertedPenalties || 0,
                                missedPenalties: stat.missedPenalties || 0,
                                yellowCards: stat.yellowCards || 0,
                                redCards: stat.redCards || 0,
                                blueCards: stat.blueCards || 0,
                                exclusions: stat.exclusions || 0,
                                dbArrayName: stat.dbArrayName,
                                dbIndex: stat.dbIndex,
                                name: stat.name,
                                jerseyNumber: stat.jerseyNumber,
                                memberType: stat.memberType,
                                teamName: stat.teamName,
                                categoryName: stat.categoryName
                            };
                        });
                        setMembersStats(finalStats);
                        if (onStatsUpdate) onStatsUpdate(teamName, finalStats);
                        processedChunks = 0;
                        
                        Object.keys(combinedStats).forEach(key => {
                            combinedStats[key] = {
                                goals: 0,
                                convertedPenalties: 0,
                                missedPenalties: 0,
                                yellowCards: 0,
                                redCards: 0,
                                blueCards: 0,
                                exclusions: 0,
                                dbArrayName: combinedStats[key].dbArrayName,
                                dbIndex: combinedStats[key].dbIndex,
                                name: combinedStats[key].name,
                                jerseyNumber: combinedStats[key].jerseyNumber,
                                memberType: combinedStats[key].memberType,
                                teamName: combinedStats[key].teamName,
                                categoryName: combinedStats[key].categoryName
                            };
                        });
                    }
                }, (error) => {
                    console.error(`[Stats Effect] ❌ Chyba pri načítaní udalostí pre chunk ${index + 1}:`, error);
                    processedChunks++;
                    if (processedChunks === chunks.length) {
                        processedChunks = 0;
                    }
                });
    
                listeners.push(listener);
            });
    
            eventsUnsubscribe = () => {
                listeners.forEach(listener => {
                    try {
                        listener();
                    } catch (e) {}
                });
            };
        };
    
        let unsubscribeMatches = null;
    
        const processMatches = (matchesSnapshot) => {
            const newMatchIds = new Set();
            const newMatchTeamMap = {};
            
            const fullTeamName = currentTeamName;
            
            matchesSnapshot.forEach(doc => {
                const matchData = doc.data();
                const matchId = doc.id;
                
                const convertedHome = convertIdentifierToDisplayName(matchData.homeTeamIdentifier);
                const convertedAway = convertIdentifierToDisplayName(matchData.awayTeamIdentifier);
                
                newMatchTeamMap[matchId] = {
                    homeTeam: convertedHome,
                    awayTeam: convertedAway
                };
                
                const isHomeMatch = convertedHome === fullTeamName;
                const isAwayMatch = convertedAway === fullTeamName;
                
                if (isHomeMatch || isAwayMatch) {
                    newMatchIds.add(matchId);
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
        }, (error) => {
            console.error('[Stats Effect] ❌ Chyba pri načítaní zápasov:', error);
        });
    
        return () => {
            if (unsubscribeMatches) {
                try {
                    unsubscribeMatches();
                } catch (e) {}
                unsubscribeMatches = null;
            }
            if (eventsUnsubscribe) {
                try {
                    eventsUnsubscribe();
                } catch (e) {}
                eventsUnsubscribe = null;
            }
        };
    }, [rosterData, teamName, categoryName, updateTrigger]);
    
    // --- LISTENER NA ZMENY V matchEvents ---
    useEffect(() => {
        if (!window.db || !teamName || !categoryName) return;
        
        const eventsRef = collection(window.db, 'matchEvents');
        const eventsQuery = query(eventsRef);
        
        const unsubscribe = onSnapshot(eventsQuery, (snapshot) => {
            if (rosterData.length > 0) {
                setUpdateTrigger(prev => prev + 1);
            }
        }, (error) => {
            console.error('❌ [UI Updater] Chyba pri počúvaní matchEvents:', error);
        });

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [teamName, categoryName, rosterData.length]);
    
    return null;
};

// --- KOMPONENTA PRE TABUĽKU SÚPISIEK ---
const RostersTable = ({ selectedTeamNameFilter, isRostersVisible }) => {
    const [allTeams, setAllTeams] = useState([]);
    const [allMembersData, setAllMembersData] = useState([]);
    const [allStatsData, setAllStatsData] = useState({});
    const [isLoadingAll, setIsLoadingAll] = useState(true);
    const [unsubscribes, setUnsubscribes] = useState([]);
    
    const tableContainerRef = useRef(null);
    const [maxTableHeight, setMaxTableHeight] = useState('60vh');

    // Nastavenie výšky tabuľky
    useEffect(() => {
        const updateHeight = () => {
            if (tableContainerRef.current) {
                const rect = tableContainerRef.current.getBoundingClientRect();
                const calculatedMaxHeight = window.innerHeight - rect.top - 50; 
                setMaxTableHeight(`${Math.max(calculatedMaxHeight, 200)}px`);
            }
        };

        updateHeight();
        window.addEventListener('resize', updateHeight);
        return () => window.removeEventListener('resize', updateHeight);
    }, [allMembersData]);

    // Načítanie tímov
    useEffect(() => {
        if (!window.db) return;

        const unsubscribeUsers = onSnapshot(query(collection(window.db, 'users')), (querySnapshot) => {
            let userTeamsList = [];
            querySnapshot.forEach((doc) => {
                const userData = doc.data();
                if (userData && userData.teams) {
                    Object.entries(userData.teams).forEach(([categoryName, teamArray]) => {
                        if (Array.isArray(teamArray)) {
                            teamArray.forEach(team => {
                                if (team.teamName) {
                                    userTeamsList.push({
                                        uid: doc.id,
                                        category: categoryName,
                                        id: team.id,
                                        teamName: team.teamName,
                                        groupName: team.groupName || null,
                                        order: team.order ?? null,
                                        isSuperstructureTeam: false,
                                    });
                                }
                            });
                        }
                    });
                }
            });
            setAllTeams(userTeamsList);
        });

        return () => {
            if (unsubscribeUsers) unsubscribeUsers();
        };
    }, []);

    // Získanie unikátnych tímov
    const getUniqueTeams = () => {
        const teamsMap = new Map();
        
        allTeams.forEach(team => {
            const key = `${team.teamName}_${team.category}`;
            
            if (!teamsMap.has(key)) {
                teamsMap.set(key, {
                    teamName: team.teamName,
                    category: team.category
                });
            }
        });
        
        return Array.from(teamsMap.values());
    };

    // Načítanie členov všetkých tímov
    useEffect(() => {
        if (!window.db || allTeams.length === 0) return;

        // Zrušíme predchádzajúce listenery
        unsubscribes.forEach(unsub => {
            try { unsub(); } catch (e) {}
        });
        setUnsubscribes([]);

        const uniqueTeams = getUniqueTeams();
        
        // Filtrovanie tímov
        let filteredTeams = uniqueTeams;
        if (selectedTeamNameFilter) {
            filteredTeams = uniqueTeams.filter(team => 
                team.teamName.toLowerCase().includes(selectedTeamNameFilter.toLowerCase())
            );
        }

        // Zoradenie tímov
        const sortedTeams = filteredTeams.sort((a, b) => {
            return slovakCollator.compare(a.teamName, b.teamName);
        });

        if (sortedTeams.length === 0) {
            setAllMembersData([]);
            setIsLoadingAll(false);
            return;
        }

        setIsLoadingAll(true);
        let allMembers = [];
        let loadedCount = 0;
        const totalTeams = sortedTeams.length;
        const newUnsubscribes = [];

        sortedTeams.forEach((teamGroup) => {
            const teamName = teamGroup.teamName;
            const categoryName = teamGroup.category;
            
            const handleMembersUpdate = (members) => {
                const membersWithTeamInfo = members.map(m => ({
                    ...m,
                    teamNameDisplay: teamName,
                    categoryNameDisplay: categoryName
                }));
                allMembers = [...allMembers, ...membersWithTeamInfo];
                loadedCount++;
                
                if (loadedCount === totalTeams) {
                    // Zoradenie členov podľa GÓLOV (zostupne - najviac gólov navrchu)
                    // a potom podľa názvu tímu a čísla dresu
                    allMembers.sort((a, b) => {
                        // Získame štatistiky pre každého člena
                        const teamStatsA = allStatsData[a.teamNameDisplay] || {};
                        const teamStatsB = allStatsData[b.teamNameDisplay] || {};
                        const keyA = `${a.type}_${a.originalIndex}`;
                        const keyB = `${b.type}_${b.originalIndex}`;
                        const goalsA = (teamStatsA[keyA] && teamStatsA[keyA].goals) || 0;
                        const goalsB = (teamStatsB[keyB] && teamStatsB[keyB].goals) || 0;
                        
                        // Najprv podľa gólov (zostupne)
                        if (goalsB !== goalsA) {
                            return goalsB - goalsA;
                        }
                        
                        // Potom podľa názvu tímu
                        const teamCompare = slovakCollator.compare(a.teamNameDisplay, b.teamNameDisplay);
                        if (teamCompare !== 0) return teamCompare;
                        
                        // Nakoniec podľa čísla dresu
                        const aNum = parseInt(a.jerseyNumber) || 999;
                        const bNum = parseInt(b.jerseyNumber) || 999;
                        return aNum - bNum;
                    });
                    
                    setAllMembersData(allMembers);
                    setIsLoadingAll(false);
                }
            };
            
            try {
                const unsub = loadTeamMembers(teamName, categoryName, handleMembersUpdate);
                newUnsubscribes.push(unsub);
            } catch (error) {
                console.error(`[loadTeamMembers] Chyba pre ${teamName}:`, error);
                loadedCount++;
                if (loadedCount === totalTeams) {
                    setAllMembersData(allMembers);
                    setIsLoadingAll(false);
                }
            }
        });

        setUnsubscribes(newUnsubscribes);

        return () => {
            newUnsubscribes.forEach(unsub => {
                try { unsub(); } catch (e) {}
            });
        };
    }, [allTeams, selectedTeamNameFilter, allStatsData]);

    // Spracovanie štatistík z komponentov TeamStatsCollector
    const handleStatsUpdate = (teamName, stats) => {
        setAllStatsData(prev => {
            const newStats = {
                ...prev,
                [teamName]: stats
            };
            
            // Po aktualizácii štatistík preusporiadame členov podľa gólov
            if (allMembersData.length > 0) {
                const sortedMembers = [...allMembersData];
                sortedMembers.sort((a, b) => {
                    const teamStatsA = newStats[a.teamNameDisplay] || {};
                    const teamStatsB = newStats[b.teamNameDisplay] || {};
                    const keyA = `${a.type}_${a.originalIndex}`;
                    const keyB = `${b.type}_${b.originalIndex}`;
                    const goalsA = (teamStatsA[keyA] && teamStatsA[keyA].goals) || 0;
                    const goalsB = (teamStatsB[keyB] && teamStatsB[keyB].goals) || 0;
                    
                    if (goalsB !== goalsA) {
                        return goalsB - goalsA;
                    }
                    
                    const teamCompare = slovakCollator.compare(a.teamNameDisplay, b.teamNameDisplay);
                    if (teamCompare !== 0) return teamCompare;
                    
                    const aNum = parseInt(a.jerseyNumber) || 999;
                    const bNum = parseInt(b.jerseyNumber) || 999;
                    return aNum - bNum;
                });
                setAllMembersData(sortedMembers);
            }
            
            return newStats;
        });
    };

    // Renderovanie kolektorov pre každý tím
    const renderStatsCollectors = () => {
        if (!isRostersVisible || allTeams.length === 0) return null;

        const uniqueTeams = getUniqueTeams();
        let filteredTeams = uniqueTeams;
        if (selectedTeamNameFilter) {
            filteredTeams = uniqueTeams.filter(team => 
                team.teamName.toLowerCase().includes(selectedTeamNameFilter.toLowerCase())
            );
        }

        const sortedTeams = filteredTeams.sort((a, b) => {
            return slovakCollator.compare(a.teamName, b.teamName);
        });

        return sortedTeams.map((teamGroup) => {
            return React.createElement(TeamStatsCollector, {
                key: `${teamGroup.category}_${teamGroup.teamName}`,
                teamName: teamGroup.teamName,
                categoryName: teamGroup.category,
                onStatsUpdate: handleStatsUpdate
            });
        });
    };

    // Zobrazenie tabuľky
    const renderTable = () => {
        if (!isRostersVisible) {
            return React.createElement(
                'div',
                { className: 'text-center py-12 text-gray-500' },
                'Súpisky tímov nie sú momentálne dostupné.'
            );
        }

        if (isLoadingAll) {
            return React.createElement(
                'div',
                { className: 'text-center py-8' },
                React.createElement('div', { className: 'animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto' }),
                React.createElement('p', { className: 'text-sm text-gray-500 mt-2' }, 'Načítavam súpisky...')
            );
        }

        if (allMembersData.length === 0) {
            return React.createElement(
                'div',
                { className: 'text-center py-16 text-gray-500' },
                'Žiadni členovia neboli nájdení.'
            );
        }

        return React.createElement(
            'div',
            { 
                className: 'w-full overflow-x-auto overflow-y-auto relative shadow-lg rounded-lg',
                ref: tableContainerRef,
                style: { maxHeight: maxTableHeight }
            },
            React.createElement(
                'table',
                { 
                    className: 'w-full border-collapse bg-white text-sm',
                    style: { minWidth: '900px' }
                },
                // HLAVIČKA TABUĽKY
                React.createElement(
                    'thead',
                    { className: 'bg-gray-100 sticky top-0 z-20' },
                    React.createElement(
                        'tr',
                        { className: 'border-b border-gray-200' },
                        React.createElement('th', { className: 'px-2 py-2 text-left text-xs font-medium text-gray-500', style: { width: '30px' } }, ''),
                        React.createElement('th', { className: 'px-2 py-2 text-left text-xs font-medium text-gray-500', style: { width: '40px' } }, 'Č.'),
                        React.createElement('th', { className: 'px-2 py-2 text-left text-xs font-medium text-gray-500' }, 'Meno a priezvisko'),
                        React.createElement('th', { className: 'px-2 py-2 text-left text-xs font-medium text-gray-500' }, 'Tím'),
                        React.createElement('th', { className: 'px-2 py-2 text-left text-xs font-medium text-gray-500' }, 'Kategória'),
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
                // TELO TABUĽKY
                React.createElement(
                    'tbody',
                    { className: 'divide-y divide-gray-100' },
                    allMembersData.map((member, idx) => {
                        const fullName = `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Neznámy';
                        
                        const teamStats = allStatsData[member.teamNameDisplay] || {};
                        const memberKey = `${member.type}_${member.originalIndex}`;
                        const stats = teamStats[memberKey] || {
                            goals: 0,
                            convertedPenalties: 0,
                            missedPenalties: 0,
                            yellowCards: 0,
                            redCards: 0,
                            blueCards: 0,
                            exclusions: 0
                        };
                        
                        const totalPenalties = (stats.convertedPenalties || 0) + (stats.missedPenalties || 0);
                        const penaltiesDisplay = totalPenalties > 0 ? `${stats.convertedPenalties || 0}/${totalPenalties}` : '';
                        
                        const memberIcon = member.type === 'Hráč' 
                            ? React.createElement('i', { className: 'fa-solid fa-user text-gray-500 text-xs' })
                            : (member.type === 'Člen RT (muž)' 
                                ? React.createElement('i', { className: 'fa-solid fa-user-tie text-blue-500 text-xs' })
                                : (member.type === 'Člen RT (žena)'
                                    ? React.createElement('i', { className: 'fa-solid fa-user-tie text-red-500 text-xs' })
                                    : React.createElement('i', { className: 'fa-solid fa-user text-gray-400 text-xs' })));
                        
                        // Zvýraznenie riadkov s gólmi
                        const hasGoals = (stats.goals || 0) > 0;
                        const rowClass = idx % 2 === 0 
                            ? 'bg-white hover:bg-blue-50'
                            : 'bg-gray-50 hover:bg-blue-50';

                        
                        // Poradie podľa gólov (zobrazenie čísla poradia)
                        const rank = idx + 1;
                        
                        return React.createElement(
                            'tr',
                            { 
                                key: `${member.teamNameDisplay}_${member.type}_${member.originalIndex || idx}`,
                                className: `${rowClass} transition-colors duration-150`
                            },
                            React.createElement('td', { className: 'px-2 py-2 text-center text-xs text-gray-400' }, hasGoals ? rank : ''),
                            React.createElement('td', { className: 'px-2 py-2 font-mono font-medium text-gray-700 text-center text-xs' }, member.jerseyNumber || ''),
                            React.createElement('td', { className: 'px-2 py-2 text-gray-800 text-sm' }, fullName),
                            React.createElement('td', { className: 'px-2 py-2 text-gray-600 text-xs' }, member.teamNameDisplay),
                            React.createElement('td', { className: 'px-2 py-2 text-gray-600 text-xs' }, member.categoryNameDisplay),
                            React.createElement('td', { className: 'px-2 py-2 text-center font-bold text-green-600 text-sm' }, (stats.goals || 0) > 0 ? stats.goals : ''),
                            React.createElement('td', { className: 'px-2 py-2 text-center font-medium text-teal-600 text-sm' }, penaltiesDisplay),
                            React.createElement('td', { className: 'px-2 py-2 text-center font-bold text-yellow-600 text-sm' }, (stats.yellowCards || 0) > 0 ? stats.yellowCards : ''),
                            React.createElement('td', { className: 'px-2 py-2 text-center font-bold text-red-600 text-sm' }, (stats.redCards || 0) > 0 ? stats.redCards : ''),
                            React.createElement('td', { className: 'px-2 py-2 text-center font-bold text-blue-600 text-sm' }, (stats.blueCards || 0) > 0 ? stats.blueCards : ''),
                            React.createElement('td', { className: 'px-2 py-2 text-center font-bold text-orange-600 text-sm' }, (stats.exclusions || 0) > 0 ? stats.exclusions : '')
                        );
                    })
                ),
                // PÄTA TABUĽKY
                React.createElement(
                    'tfoot',
                    { className: 'bg-gray-200 font-semibold' },
                    React.createElement(
                        'tr',
                        null,
                        React.createElement('td', { colSpan: '11', className: 'px-2 py-2 text-center text-xs text-gray-600' },
                            `Celkový počet členov: ${allMembersData.length}`
                        )
                    )
                )
            )
        );
    };

    return React.createElement(
        React.Fragment,
        null,
        renderStatsCollectors(),
        renderTable()
    );
};

// --- HLAVNÁ KOMPONENTA ---
const TeamsOverviewApp = (props) => {
    const [uiNotification, setUiNotification] = useState(null);
    const [selectedTeamNameFilter, setSelectedTeamNameFilter] = useState('');
    const [isRostersVisible, setIsRostersVisible] = useState(
        window.pagesVisibility && 
        window.pagesVisibility['rosters'] && 
        window.pagesVisibility['rosters'].visible === true
    );

    // Real-time listener pre viditeľnosť súpisiek
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
            
            snapshot.forEach((doc) => {
                if (doc.id === 'rosters') {
                    const data = doc.data();
                    rostersVisible = data.visible === true;
                }
            });
            
            if (!window.pagesVisibility) window.pagesVisibility = {};
            window.pagesVisibility['rosters'] = { visible: rostersVisible };
            setIsRostersVisible(rostersVisible);
        }, (error) => {
        });

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, []);

    // Notifikácie
    useEffect(() => {
        let timer;
        const unsubscribe = subscribe((notification) => {
            setUiNotification(notification);
            clearTimeout(timer);
            timer = setTimeout(() => {
                setUiNotification(null);
            }, 5000);
        });
        return () => {
            unsubscribe();
            clearTimeout(timer);
        };
    }, []);

    const renderFilters = () => {
        return React.createElement(
            'div',
            { className: 'flex flex-wrap gap-4 mb-6 items-end' },
            React.createElement(
                'div',
                { className: 'flex flex-col flex-1 min-w-[200px]' },
                React.createElement('label', { className: 'text-sm font-medium text-gray-600 mb-1' }, 'Hľadať tím'),
                React.createElement(
                    'input',
                    {
                        type: 'text',
                        value: selectedTeamNameFilter,
                        onChange: (e) => setSelectedTeamNameFilter(e.target.value),
                        placeholder: 'Zadajte názov tímu...',
                        className: 'px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                    }
                )
            ),
            selectedTeamNameFilter && React.createElement(
                'button',
                {
                    onClick: () => {
                        setSelectedTeamNameFilter('');
                    },
                    className: 'px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors'
                },
                'Vymazať filter ✕'
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
                'Štatistiky'
            )
        ),
        renderFilters(),
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-xl p-4' },
            React.createElement(RostersTable, {
                selectedTeamNameFilter: selectedTeamNameFilter,
                isRostersVisible: isRostersVisible
            })
        )
    );
};

// Definícia funkcie handleDataUpdateAndRender
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
