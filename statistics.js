// statistics.js
import React from "https://esm.sh/react@18.2.0";
import ReactDOM from "https://esm.sh/react-dom@18.2.0";
import { doc, getDoc, onSnapshot, updateDoc, collection, query, getDocs, setDoc, addDoc, serverTimestamp, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
const { useState, useEffect, useRef, useCallback, useMemo } = React;
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
        // Použijeme Mapu na deduplikáciu
        const membersMap = new Map();
        
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
                            // Kľúč: Tím + Kategória + Typ + Meno + Priezvisko + Číslo dresu (alebo index)
                            const uniqueKey = `${actualTeamName}_${categoryName}_Hrac_${player.firstName || ''}_${player.lastName || ''}_${player.jerseyNumber || idx}`;
                            if (!membersMap.has(uniqueKey)) {
                                membersMap.set(uniqueKey, {
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
                            }
                        });
                    }
                    
                    if (foundTeam.menTeamMemberDetails && Array.isArray(foundTeam.menTeamMemberDetails)) {
                        foundTeam.menTeamMemberDetails.forEach((member, idx) => {
                            const uniqueKey = `${actualTeamName}_${categoryName}_RT_M_${member.firstName || ''}_${member.lastName || ''}_${member.jerseyNumber || idx}`;
                            if (!membersMap.has(uniqueKey)) {
                                membersMap.set(uniqueKey, {
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
                            }
                        });
                    }
                    
                    if (foundTeam.womenTeamMemberDetails && Array.isArray(foundTeam.womenTeamMemberDetails)) {
                        foundTeam.womenTeamMemberDetails.forEach((member, idx) => {
                            const uniqueKey = `${actualTeamName}_${categoryName}_RT_Z_${member.firstName || ''}_${member.lastName || ''}_${member.jerseyNumber || idx}`;
                            if (!membersMap.has(uniqueKey)) {
                                membersMap.set(uniqueKey, {
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
                            }
                        });
                    }
                    
                    break;
                }
            }
        }
        
        // Prevedieme Mapu späť na pole
        const members = Array.from(membersMap.values());
        
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
        } catch (error) {
        }
    }
};

window.forceUpdateUI = forceUpdateUI;

// --- KOMPONENTA PRE ZBER ŠTATISTÍK PRE JEDEN TÍM ---
const TeamStatsCollector = ({ teamName, categoryName, onStatsUpdate }) => {
    const [rosterData, setRosterData] = useState([]);
    const [unsubscribe, setUnsubscribe] = useState(null);
    const [membersStats, setMembersStats] = useState({});
    
    // Načítanie súpisky
    useEffect(() => {
        let timeoutId = null;
        let unsub = null;
        
        const loadRoster = () => {
            const handleMembersUpdate = (members) => {
                setRosterData(members);
            };
            
            try {
                unsub = loadTeamMembers(teamName, categoryName, handleMembersUpdate);
                setUnsubscribe(() => unsub);
            } catch (error) {
                setRosterData([]);
            }
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
                
                // KONTROLA KATEGÓRIE - udalosť musí mať rovnakú kategóriu ako tím
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
                
                // Kontrola, či udalosť patrí nášmu tímu a KATEGÓRII
                if (eventData.team === 'home') {
                    if (homeTeam === fullTeamName && matchInfo.homeCategory === currentCategoryName) {
                        isOurTeam = true;
                    }
                } else if (eventData.team === 'away') {                    
                    if (awayTeam === fullTeamName && matchInfo.awayCategory === currentCategoryName) {
                        isOurTeam = true;
                    }
                }
                
                if (!isOurTeam) {
                    return;
                }
                
                // --- UPRAVENÉ POROVNANIE PRE memberTypeKey a memberIndex ---
                let foundMemberKey = null;
                const eventMemberTypeKey = eventData.memberTypeKey || eventData.memberType || '';
                const eventMemberIndex = eventData.memberIndex;
                
                // Ak nemáme memberIndex, nemôžeme priradiť
                if (eventMemberIndex === undefined || eventMemberIndex === null) {
                    return;
                }                
                
                // --- KĽÚČOVÁ ZMENA: Hľadáme člena podľa dbArrayName, dbIndex A KATEGÓRIE ---
                for (const [memberKey, stat] of Object.entries(stats)) {
                    // Kontrolujeme aj kategóriu člena!
                    if (stat.dbArrayName === eventMemberTypeKey && 
                        stat.dbIndex === eventMemberIndex && 
                        stat.categoryName === currentCategoryName) {
                        foundMemberKey = memberKey;
                        break;
                    }
                }
                
                // Ak sme nenašli podľa presnej zhody, skúsime alternatívne mapovanie
                if (!foundMemberKey) {
                    const typeMapping = {
                        'players': 'playerDetails',
                        'playerDetails': 'players',
                        'menTeamMemberDetails': 'menTeamMemberDetails',
                        'womenTeamMemberDetails': 'womenTeamMemberDetails'
                    };
                    
                    const mappedType = typeMapping[eventMemberTypeKey] || eventMemberTypeKey;
                    
                    for (const [memberKey, stat] of Object.entries(stats)) {
                        // Kontrolujeme aj kategóriu člena!
                        if (stat.dbArrayName === mappedType && 
                            stat.dbIndex === eventMemberIndex && 
                            stat.categoryName === currentCategoryName) {
                            foundMemberKey = memberKey;
                            break;
                        }
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
            
            chunks.forEach((chunk, index) => {
                const eventsRef = collection(window.db, 'matchEvents');
                const eventsQuery = query(
                    eventsRef,
                    where('matchId', 'in', chunk)
                );
    
                const listener = onSnapshot(eventsQuery, (eventsSnapshot) => {                    
                    const combinedStats = {};
                    
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
                    }
                }, (error) => {
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
                
                const homeCategory = matchData.homeCategory || matchData.categoryName || matchData.categoryId || '';
                const awayCategory = matchData.awayCategory || matchData.categoryName || matchData.categoryId || '';                
                
                newMatchTeamMap[matchId] = {
                    homeTeam: convertedHome,
                    awayTeam: convertedAway,
                    homeCategory: homeCategory,
                    awayCategory: awayCategory,
                    rawMatchData: matchData
                };
                
                const isHomeMatch = convertedHome === fullTeamName && homeCategory === currentCategoryName;
                const isAwayMatch = convertedAway === fullTeamName && awayCategory === currentCategoryName;                
                
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
    }, [rosterData, teamName, categoryName]);
    
    return null;
};

// --- KOMPONENTA PRE TABUĽKU SÚPISIEK ---
const RostersTable = ({ isRostersVisible }) => {
    const [allTeams, setAllTeams] = useState([]);
    const [allMembersData, setAllMembersData] = useState([]);
    const [allStatsData, setAllStatsData] = useState({});
    const [unsubscribes, setUnsubscribes] = useState([]);
    const [isStatsReady, setIsStatsReady] = useState(false);
    const [totalTeamsCount, setTotalTeamsCount] = useState(0);
    const [statsReceivedCount, setStatsReceivedCount] = useState(0);
    const [receivedTeams, setReceivedTeams] = useState(new Set());
    
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

    // NAČÍTANIE ČLENOV - SPUSTÍ SA IBA PRI ZMENE TEAMOV
    useEffect(() => {
        if (!window.db || allTeams.length === 0) return;
    
        // Zrušíme predchádzajúce listenery
        unsubscribes.forEach(unsub => {
            try { unsub(); } catch (e) {}
        });
        setUnsubscribes([]);
    
        const uniqueTeams = getUniqueTeams();
        
        // Zoradenie tímov
        const sortedTeams = uniqueTeams.sort((a, b) => {
            return slovakCollator.compare(a.teamName, b.teamName);
        });
    
        if (sortedTeams.length === 0) {
            setAllMembersData([]);
            setTotalTeamsCount(0);
            setStatsReceivedCount(0);
            setIsStatsReady(false);
            setReceivedTeams(new Set());
            return;
        }
    
        // Reset stavov - VŽDY NOVÉ (ale iba pri zmene tímov)
        setTotalTeamsCount(sortedTeams.length);
        setStatsReceivedCount(0);
        setIsStatsReady(false);
        setReceivedTeams(new Set());
        setAllMembersData([]);
    
        // Použijeme NOVÚ Mapu a NOVÉ sety
        const membersMap = new Map();
        const loadedTeamsSet = new Set();
        let loadedCount = 0;
        const totalTeams = sortedTeams.length;
        const newUnsubscribes = [];
    
        sortedTeams.forEach((teamGroup) => {
            const teamName = teamGroup.teamName;
            const categoryName = teamGroup.category;
            const teamKey = `${teamName}_${categoryName}`;
            
            const handleMembersUpdate = (members) => {
                // Pridávame členov do Mapy s DEDUPLIKÁCIOU
                members.forEach(m => {
                    // Vytvoríme unikátny kľúč pre hráča
                    const uniqueKey = `${teamName}_${categoryName}_${m.type}_${m.firstName || ''}_${m.lastName || ''}_${m.jerseyNumber || m.originalIndex}`;
                    
                    // Ak hráč ešte nie je v mape, pridáme ho
                    if (!membersMap.has(uniqueKey)) {
                        membersMap.set(uniqueKey, {
                            ...m,
                            teamNameDisplay: teamName,
                            categoryNameDisplay: categoryName,
                            uniqueTeamKey: teamKey
                        });
                    }
                });
                
                // Ak už bol tím načítaný, nepočítame ho znova
                if (!loadedTeamsSet.has(teamKey)) {
                    loadedTeamsSet.add(teamKey);
                    loadedCount++;
                }
                
                if (loadedCount === totalTeams) {
                    const allMembers = Array.from(membersMap.values());
                    setAllMembersData(allMembers);
                }
            };
            
            try {
                const unsub = loadTeamMembers(teamName, categoryName, handleMembersUpdate);
                newUnsubscribes.push(unsub);
            } catch (error) {
                if (!loadedTeamsSet.has(teamKey)) {
                    loadedTeamsSet.add(teamKey);
                    loadedCount++;
                }
                if (loadedCount === totalTeams) {
                    const allMembers = Array.from(membersMap.values());
                    setAllMembersData(allMembers);
                }
            }
        });
    
        setUnsubscribes(newUnsubscribes);
    
        return () => {
            newUnsubscribes.forEach(unsub => {
                try { unsub(); } catch (e) {}
            });
        };
    }, [allTeams]);

    // Spracovanie štatistík z komponentov TeamStatsCollector
    const handleStatsUpdate = (teamName, stats, categoryName) => {
        const uniqueKey = `${teamName}_${categoryName}`;
        
        // NAHRADÍME štatistiky, NIE PRIDÁVAME!
        setAllStatsData(prev => {
            const newStats = {
                ...prev,
                [uniqueKey]: stats
            };
            return newStats;
        });
        
        // Kontrola, či už sme dostali štatistiky pre tento tím
        setReceivedTeams(prev => {
            const newSet = new Set(prev);
            const teamKey = `${teamName}_${categoryName}`;
            
            // Ak ešte nemáme štatistiky pre tento tím, pridáme ho
            if (!newSet.has(teamKey)) {
                newSet.add(teamKey);
                
                // Aktualizujeme počet prijatých
                setStatsReceivedCount(prevCount => {
                    const newCount = prevCount + 1;
                    // Ak sme dostali všetky štatistiky, nastavíme ready stav
                    if (newCount >= totalTeamsCount && totalTeamsCount > 0) {
                        setIsStatsReady(true);
                    }
                    return newCount;
                });
            }
            
            return newSet;
        });
    };

    // Renderovanie kolektorov pre každý tím (neviditeľné)
    const renderStatsCollectors = () => {
        if (!isRostersVisible || allTeams.length === 0) return null;

        const uniqueTeams = getUniqueTeams();
        
        const sortedTeams = uniqueTeams.sort((a, b) => {
            return slovakCollator.compare(a.teamName, b.teamName);
        });

        return sortedTeams.map((teamGroup) => {
            return React.createElement(TeamStatsCollector, {
                key: `${teamGroup.category}_${teamGroup.teamName}`,
                teamName: teamGroup.teamName,
                categoryName: teamGroup.category,
                onStatsUpdate: (teamName, stats) => handleStatsUpdate(teamName, stats, teamGroup.category)
            });
        });
    };

    // ZORADENIE - používame displayMembers s memoizáciou
    const displayMembers = useMemo(() => {
        if (!isStatsReady || allMembersData.length === 0) return [];
        
        // Vytvoríme kopiu členov s ich aktuálnymi štatistikami
        const membersWithStats = allMembersData.map(member => {
            const key = `${member.teamNameDisplay}_${member.categoryNameDisplay}`;
            const teamStats = allStatsData[key] || {};
            const memberKey = `${member.type}_${member.originalIndex}`;
            const stats = teamStats[memberKey] || { goals: 0 };
            return {
                ...member,
                goals: Number(stats.goals || 0)
            };
        });

        // Rozdelíme na strelcov a neskórujúcich
        const goalsScorers = membersWithStats.filter(m => m.goals > 0);
        const nonScorers = membersWithStats.filter(m => m.goals === 0);

        // Zoradíme strelcov podľa gólov (zostupne)
        goalsScorers.sort((a, b) => {
            if (b.goals !== a.goals) return b.goals - a.goals;
            
            const teamCompare = slovakCollator.compare(a.teamNameDisplay, b.teamNameDisplay);
            if (teamCompare !== 0) return teamCompare;
            
            return slovakCollator.compare(`${a.firstName} ${a.lastName}`, `${b.firstName} ${b.lastName}`);
        });

        // Zoradíme ostatných podľa abecedy
        nonScorers.sort((a, b) => {
            const teamCompare = slovakCollator.compare(a.teamNameDisplay, b.teamNameDisplay);
            if (teamCompare !== 0) return teamCompare;
            
            const nameCompare = slovakCollator.compare(`${a.firstName} ${a.lastName}`, `${b.firstName} ${b.lastName}`);
            if (nameCompare !== 0) return nameCompare;
            
            const aNum = parseInt(a.jerseyNumber) || 999;
            const bNum = parseInt(b.jerseyNumber) || 999;
            return aNum - bNum;
        });

        return [...goalsScorers, ...nonScorers];
    }, [allMembersData, allStatsData, isStatsReady]);

    // POUŽIJEME useRef na uchovanie predchádzajúceho poradia
    const previousDisplayMembersRef = useRef([]);
    // POUŽIJEME useRef na uchovanie predchádzajúcich gólov
    const previousGoalsRef = useRef(new Map());

    // Porovnáme, či sa zmenilo poradie podľa gólov
    const getStableDisplayMembers = useCallback(() => {
        if (displayMembers.length === 0) return [];
    
        // Ak ešte nemáme predchádzajúce poradie, uložíme ho
        if (previousDisplayMembersRef.current.length === 0) {
            previousDisplayMembersRef.current = displayMembers;
            // Uložíme aj góly
            const goalsMap = new Map();
            displayMembers.forEach(m => {
                const key = `${m.teamNameDisplay}_${m.categoryNameDisplay}_${m.type}_${m.originalIndex}`;
                goalsMap.set(key, m.goals || 0);
            });
            previousGoalsRef.current = goalsMap;
            return displayMembers;
        }
    
        // Skontrolujeme, či sa zmenil počet gólov u niektorého hráča
        const prevGoals = previousGoalsRef.current;
        const currentGoals = new Map();
        displayMembers.forEach(m => {
            const key = `${m.teamNameDisplay}_${m.categoryNameDisplay}_${m.type}_${m.originalIndex}`;
            currentGoals.set(key, m.goals || 0);
        });
    
        // Skontrolujeme, či sa zmenil počet gólov u niektorého hráča
        let goalsChanged = false;
        let anyGoalsGreaterThanZero = false;
        for (const [key, goals] of currentGoals) {
            const prevGoalsCount = prevGoals.get(key) || 0;
            if (prevGoalsCount !== goals) {
                goalsChanged = true;
                if (goals > 0) {
                    anyGoalsGreaterThanZero = true;
                }
                break;
            }
        }
    
        // Ak sa zmenili góly, vždy aktualizujeme poradie
        if (goalsChanged) {
            previousDisplayMembersRef.current = displayMembers;
            previousGoalsRef.current = currentGoals;
            return displayMembers;
        }
    
        // Ak sa nezmenili góly, vraciame predchádzajúce poradie
        return previousDisplayMembersRef.current;
    }, [displayMembers]);

    // Získame stabilné poradie
    const stableDisplayMembers = getStableDisplayMembers();

    // Zobrazenie tabuľky - používa stableDisplayMembers
    const renderTable = () => {
        if (!isRostersVisible) {
            return React.createElement(
                'div',
                { className: 'text-center py-12 text-gray-500' },
                'Súpisky tímov nie sú momentálne dostupné.'
            );
        }

        if (allMembersData.length === 0 || !isStatsReady) {
            const progressText = totalTeamsCount > 0 
                ? `Načítavam štatistiky... (${statsReceivedCount}/${totalTeamsCount})` 
                : 'Načítavam dáta...';
            
            return React.createElement(
                'div',
                { className: 'text-center py-8' },
                React.createElement('div', { className: 'animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto' }),
                React.createElement('p', { className: 'text-sm text-gray-500 mt-2' }, progressText)
            );
        }

        // Ak nemáme žiadnych členov na zobrazenie
        if (stableDisplayMembers.length === 0) {
            return React.createElement(
                'div',
                { className: 'text-center py-8 text-gray-500' },
                'Žiadni členovia tímu'
            );
        }

        // Zoradenie členov podľa gólov, priezviska, mena, a ďalších kritérií
        // Ak sa zmení počet gólov, poradie sa aktualizuje automaticky
        const membersWithGoals = useMemo(() => {
            if (!isStatsReady || allMembersData.length === 0) return [];
        
            // Vytvoríme kopiu členov s ich aktuálnymi štatistikami
            const membersWithStats = allMembersData.map(member => {
                const key = `${member.teamNameDisplay}_${member.categoryNameDisplay}`;
                const teamStats = allStatsData[key] || {};
                const memberKey = `${member.type}_${member.originalIndex}`;
                const stats = teamStats[memberKey] || { goals: 0 };
                return {
                    ...member,
                    goals: Number(stats.goals || 0)
                };
            });
        
            // Rozdelíme na strelcov a neskórujúcich
            const goalsScorers = membersWithStats.filter(m => m.goals > 0);
            const nonScorers = membersWithStats.filter(m => m.goals === 0);
        
            // Zoradíme strelcov podľa gólov (zostupne)
            goalsScorers.sort((a, b) => {
                if (b.goals !== a.goals) return b.goals - a.goals;
        
                // Porovnávanie podľa priezviska
                const lastNameCompare = slovakCollator.compare(a.lastName || '', b.lastName || '');
                if (lastNameCompare !== 0) return lastNameCompare;
        
                // Porovnávanie podľa mena
                const firstNameCompare = slovakCollator.compare(a.firstName || '', b.firstName || '');
                if (firstNameCompare !== 0) return firstNameCompare;
        
                // Alternatívne porovnanie podľa jerseyNumber
                const aNum = parseInt(a.jerseyNumber) || 999;
                const bNum = parseInt(b.jerseyNumber) || 999;
                return aNum - bNum;
            });
        
            // Zoradíme ostatných podľa abecedy (najskôr priezvisko, potom meno)
            nonScorers.sort((a, b) => {
                const lastNameCompare = slovakCollator.compare(a.lastName || '', b.lastName || '');
                if (lastNameCompare !== 0) return lastNameCompare;
                const firstNameCompare = slovakCollator.compare(a.firstName || '', b.firstName || '');
                if (firstNameCompare !== 0) return firstNameCompare;
                const aNum = parseInt(a.jerseyNumber) || 999;
                const bNum = parseInt(b.jerseyNumber) || 999;
                return aNum - bNum;
            });
        
            return [...goalsScorers, ...nonScorers];
        }, [allMembersData, allStatsData, isStatsReady]);

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
                    stableDisplayMembers.map((member, idx) => {
                        const fullName = `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Neznámy';
                        
                        const teamStatsKey = `${member.teamNameDisplay}_${member.categoryNameDisplay}`;
                        const teamStats = allStatsData[teamStatsKey] || {};
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
                        
                        const hasGoals = Number((stats.goals || 0)) > 0;
                        const rowClass = idx % 2 === 0 
                            ? 'bg-white hover:bg-blue-50'
                            : 'bg-gray-50 hover:bg-blue-50';
                        
                        let rank = '';
                        if (hasGoals) {
                            const goalRank = membersWithGoals.findIndex(m => {
                                const mKey = `${m.teamNameDisplay}_${m.categoryNameDisplay}`;
                                const mStats = allStatsData[mKey] || {};
                                const mMemberKey = `${m.type}_${m.originalIndex}`;
                                return m.teamNameDisplay === member.teamNameDisplay && 
                                       m.categoryNameDisplay === member.categoryNameDisplay &&
                                       m.type === member.type &&
                                       m.originalIndex === member.originalIndex;
                            });
                            rank = goalRank + 1;
                        }
                        
                        return React.createElement(
                            'tr',
                            { 
                                key: `${member.teamNameDisplay}_${member.categoryNameDisplay}_${member.type}_${member.originalIndex || idx}`,
                                className: `${rowClass} transition-colors duration-150`
                            },
                            React.createElement('td', { className: 'px-2 py-2 text-center text-xs text-gray-400' }, rank),
                            React.createElement('td', { className: 'px-2 py-2 font-mono font-medium text-gray-700 text-center text-xs' }, member.jerseyNumber || ''),
                            React.createElement('td', { className: 'px-2 py-2 text-gray-800 text-sm' }, fullName),
                            React.createElement('td', { className: 'px-2 py-2 text-gray-600 text-xs' }, member.teamNameDisplay),
                            React.createElement('td', { className: 'px-2 py-2 text-gray-600 text-xs' }, member.categoryNameDisplay),
                            React.createElement('td', { className: 'px-2 py-2 text-center font-bold text-green-600 text-sm' }, Number((stats.goals || 0)) > 0 ? stats.goals : ''),
                            React.createElement('td', { className: 'px-2 py-2 text-center font-medium text-teal-600 text-sm' }, penaltiesDisplay),
                            React.createElement('td', { className: 'px-2 py-2 text-center font-bold text-yellow-600 text-sm' }, (stats.yellowCards || 0) > 0 ? stats.yellowCards : ''),
                            React.createElement('td', { className: 'px-2 py-2 text-center font-bold text-red-600 text-sm' }, (stats.redCards || 0) > 0 ? stats.redCards : ''),
                            React.createElement('td', { className: 'px-2 py-2 text-center font-bold text-blue-600 text-sm' }, (stats.blueCards || 0) > 0 ? stats.blueCards : ''),
                            React.createElement('td', { className: 'px-2 py-2 text-center font-bold text-orange-600 text-sm' }, (stats.exclusions || 0) > 0 ? stats.exclusions : '')
                        );
                    })
                ),
                React.createElement(
                    'tfoot',
                    { className: 'bg-gray-200 font-semibold' },
                    React.createElement(
                        'tr',
                        null,
                        React.createElement('td', { colSpan: '11', className: 'px-2 py-2 text-center text-xs text-gray-600' },
                            `Celkový počet členov: ${stableDisplayMembers.length}`
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
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-xl p-4' },
            React.createElement(RostersTable, {
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
