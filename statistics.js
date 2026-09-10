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

    // --- POMOCNÉ FUNKCIE PRE MAPOVANIE NÁZVU TÍMU, AK OBSAHUJE NÁZOV KATEGÓRIE ---
    const teamNameContainsCategory = (teamNameToCheck, categoryNameToCheck) => {
        if (!teamNameToCheck || !categoryNameToCheck) return false;
        return teamNameToCheck.includes(categoryNameToCheck);
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
        let eventsUnsubscribe = null;
        let unsubscribeMatches = null;
        let isCancelled = false;
        let matchTrackerReadyListener = null;
    
        // Sledovanie, či bolo mapovanie neúspešné (nejaký tím vrátil null)
        let mappingIncomplete = false;
        // Sledovanie predchádzajúcich statusov, aby sme detekovali prechod na 'completed'
        let previousMatchStatuses = {};
        // Flag, či sme už mali možnosť robiť mapovanie (matchTracker pripravený)
        let matchTrackerWasReady = false;
        let matchTrackerReadyHandled = false;
    
        // Pomocné funkcie
        const teamNameContainsCategory = (teamNameToCheck, categoryNameToCheck) => {
            if (!teamNameToCheck || !categoryNameToCheck) return false;
            return teamNameToCheck.includes(categoryNameToCheck);
        };
    
        const categoryMatches = (matchCat, currentCat) => {
            if (!matchCat || !currentCat) return false;
            if (matchCat === currentCat) return true;
            if (window.categoriesData && window.categoriesData[matchCat] === currentCat) return true;
            return false;
        };
    
        const mapMatchTeamName = async (matchTeamName, categoryNameForMapping) => {
            if (!matchTeamName) {
                return { mapped: matchTeamName, incomplete: false, reason: null };
            }
            
            // 🔥 VŽDY skús getTeamNameByDisplayId, aj keď tím neobsahuje názov kategórie
            // (rovnako ako teams.js convertTeamNames)
            
            if (!window.matchTracker || typeof window.matchTracker.getTeamNameByDisplayId !== 'function') {
                return { mapped: matchTeamName, incomplete: true, reason: 'tracker_missing' };
            }
            
            if (typeof window.matchTracker.isDataReady === 'function' && !window.matchTracker.isDataReady()) {
                console.log('[mapMatchTeamName] matchTracker ešte nie je pripravený');
                return { mapped: matchTeamName, incomplete: true, reason: 'tracker_not_ready' };
            }
            
            try {
                const mapped = await window.matchTracker.getTeamNameByDisplayId(matchTeamName);
                console.log('[mapMatchTeamName] VÝSTUP:', { matchTeamName, mapped });
                if (mapped && mapped !== matchTeamName) {
                    return { mapped, incomplete: false, reason: null };
                }
                // Tracker je ready, ale nevrátil namapovaný názov
                // → skús zistiť, či to má zmysel (obsahuje kategóriu)
                const containsCategory = teamNameContainsCategory(matchTeamName, categoryNameForMapping);
                if (containsCategory) {
                    // Očakávali sme mapovanie, ale neprišlo → skupina nie je 100%
                    return { mapped: matchTeamName, incomplete: true, reason: 'group_not_ready' };
                }
                // Neobsahuje kategóriu → nepotrebuje mapovanie → complete
                return { mapped: matchTeamName, incomplete: false, reason: null };
            } catch (err) {
                console.log('[mapMatchTeamName] CHYBA:', err);
                return { mapped: matchTeamName, incomplete: true, reason: 'error' };
            }
        };
    
        const calculateStatsFromEvents = (eventsSnapshot) => {
            const stats = {};
            rosterData.forEach((member) => {
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

                console.log('[calculateStatsFromEvents] matchId:', matchId, 'matchInfo:', matchInfo);
        
                let isOurTeam = false;
                const homeTeam = matchInfo.homeTeam || '';
                const awayTeam = matchInfo.awayTeam || '';
        
                if (eventData.team === 'home') {
                    if (homeTeam === currentTeamName && categoryMatches(matchInfo.homeCategory, currentCategoryName)) {
                        isOurTeam = true;
                    }
                } else if (eventData.team === 'away') {
                    if (awayTeam === currentTeamName && categoryMatches(matchInfo.awayCategory, currentCategoryName)) {
                        isOurTeam = true;
                    }
                }
        
                if (!isOurTeam) {
                    return;
                }
        
                let foundMemberKey = null;
                const eventMemberTypeKey = eventData.memberTypeKey || eventData.memberType || '';
                const eventMemberIndex = eventData.memberIndex;
        
                if (eventMemberIndex === undefined || eventMemberIndex === null) {
                    return;
                }
        
                for (const [memberKey, stat] of Object.entries(stats)) {
                    if (stat.dbArrayName === eventMemberTypeKey &&
                        stat.dbIndex === eventMemberIndex &&
                        stat.categoryName === currentCategoryName) {
                        foundMemberKey = memberKey;
                        break;
                    }
                }
        
                if (!foundMemberKey) {
                    const typeMapping = {
                        'players': 'playerDetails',
                        'playerDetails': 'players',
                        'menTeamMemberDetails': 'menTeamMemberDetails',
                        'womenTeamMemberDetails': 'womenTeamMemberDetails'
                    };
                    const mappedType = typeMapping[eventMemberTypeKey] || eventMemberTypeKey;
        
                    for (const [memberKey, stat] of Object.entries(stats)) {
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
    
        const setupEventsListener = (matchIdsArray) => {
            console.log('[setupEventsListener] matchIdsArray:', matchIdsArray.length, 'matchTeamMap keys:', Object.keys(matchTeamMap).length);
            console.log('[setupEventsListener] matchTeamMap sample:', Object.entries(matchTeamMap).slice(0, 2));
            console.log('[setupEventsListener] matchIdsArray.length:', matchIdsArray.length, 'matchTeamMap keys:', Object.keys(matchTeamMap).length);
            if (eventsUnsubscribe) {
                try { eventsUnsubscribe(); } catch (e) {}
                eventsUnsubscribe = null;
            }
    
            if (matchIdsArray.length === 0) {
                const emptyStats = {};
                rosterData.forEach((member) => {
                    const memberKey = `${member.type}_${member.originalIndex}`;
                    emptyStats[memberKey] = {
                        goals: 0, convertedPenalties: 0, missedPenalties: 0,
                        yellowCards: 0, redCards: 0, blueCards: 0, exclusions: 0,
                        dbArrayName: member.dbArrayName, dbIndex: member.originalIndex,
                        name: `${member.firstName} ${member.lastName}`.trim(),
                        jerseyNumber: member.jerseyNumber || '', memberType: member.type,
                        teamName: member.teamName, categoryName: member.categoryName
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
    
            chunks.forEach((chunk) => {
                const eventsRef = collection(window.db, 'matchEvents');
                const eventsQuery = query(eventsRef, where('matchId', 'in', chunk));
    
                const listener = onSnapshot(eventsQuery, (eventsSnapshot) => {
                    const combinedStats = {};
                    const chunkStats = calculateStatsFromEvents(eventsSnapshot);
    
                    Object.entries(chunkStats).forEach(([memberKey, stat]) => {
                        if (!combinedStats[memberKey]) {
                            combinedStats[memberKey] = {
                                goals: 0, convertedPenalties: 0, missedPenalties: 0,
                                yellowCards: 0, redCards: 0, blueCards: 0, exclusions: 0,
                                dbArrayName: stat.dbArrayName, dbIndex: stat.dbIndex,
                                name: stat.name, jerseyNumber: stat.jerseyNumber,
                                memberType: stat.memberType, teamName: stat.teamName,
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
                                goals: stat.goals || 0, convertedPenalties: stat.convertedPenalties || 0,
                                missedPenalties: stat.missedPenalties || 0, yellowCards: stat.yellowCards || 0,
                                redCards: stat.redCards || 0, blueCards: stat.blueCards || 0,
                                exclusions: stat.exclusions || 0, dbArrayName: stat.dbArrayName,
                                dbIndex: stat.dbIndex, name: stat.name, jerseyNumber: stat.jerseyNumber,
                                memberType: stat.memberType, teamName: stat.teamName,
                                categoryName: stat.categoryName
                            };
                        });
                        setMembersStats(finalStats);
                        if (onStatsUpdate) onStatsUpdate(teamName, finalStats);
                        processedChunks = 0;
                    }
                }, (error) => {
                    processedChunks++;
                    if (processedChunks === chunks.length) processedChunks = 0;
                });
    
                listeners.push(listener);
            });
    
            eventsUnsubscribe = () => {
                listeners.forEach(listener => {
                    try { listener(); } catch (e) {}
                });
            };
            console.log('[setupEventsListener] matchIdsArray.length:', matchIdsArray.length, 'matchTeamMap keys:', Object.keys(matchTeamMap).length);
        };

        // Uložíme si posledný snapshot, aby sme ho mohli spracovať, keď bude matchTracker ready
        let pendingSnapshot = null;
        let pendingProcessResolve = null;
        let retryTimeoutId = null;
        
        const processMatches = async (matchesSnapshot, forceRemap = false) => {
            if (isCancelled) return;
        
            // 🔥 DEKLARÁCIA HNEĎ NA ZAČIATKU
            const isMatchTrackerReady = 
                typeof window.matchTracker?.isDataReady === 'function' && 
                window.matchTracker.isDataReady();
        
            console.log('[processMatches] VOLANIE, isCancelled:', isCancelled);
            console.log('[processMatches] VOLANIE, isFirstLoad:', isFirstLoad, 'matchTrackerWasReady:', matchTrackerWasReady, 'pendingSnapshot:', !!pendingSnapshot, 'forceRemap:', forceRemap);
            console.log('[processMatches] isMatchTrackerReady:', isMatchTrackerReady, 'matchTrackerWasReady:', matchTrackerWasReady);
        
            if (!isMatchTrackerReady && !matchTrackerWasReady) {
                console.log('[processMatches] matchTracker ešte nie je pripravený, ukladám snapshot');
                pendingSnapshot = matchesSnapshot;
                return;
            }
        
            if (isMatchTrackerReady && !matchTrackerWasReady) {
                matchTrackerWasReady = true;
                console.log('[processMatches] matchTracker je teraz pripravený');
            }
        
            const newMatchIds = new Set();
            const newMatchTeamMap = {};
        
            const rawMatches = [];
            matchesSnapshot.forEach(doc => {
                rawMatches.push({ id: doc.id, data: doc.data() });
            });
        
            // Detekcia nového completed zápasu
            let hasNewCompletedMatch = false;
            rawMatches.forEach(({ id: matchId, data: matchData }) => {
                const currentStatus = matchData.status || 'scheduled';
                const previousStatus = previousMatchStatuses[matchId];
                if (currentStatus === 'completed' && previousStatus !== 'completed') {
                    hasNewCompletedMatch = true;
                }
            });
        
            // 🔥 ROZŠÍRENÉ: remap spustíme aj keď je mappingIncomplete, aj bez nového completed zápasu
            const shouldRemap = forceRemap 
                || hasNewCompletedMatch 
                || mappingIncomplete;
        
            console.log('[processMatches] shouldRemap:', shouldRemap, 'mappingIncomplete:', mappingIncomplete, 'hasNewCompletedMatch:', hasNewCompletedMatch, 'forceRemap:', forceRemap);
        
            // Ak netreba remapovať, len uložíme statusy a skončíme
            if (!shouldRemap) {
                rawMatches.forEach(({ id: matchId, data: matchData }) => {
                    previousMatchStatuses[matchId] = matchData.status || 'scheduled';
                });
                return;
            }
        
            if (!isFirstLoad && mappingIncomplete && hasNewCompletedMatch) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        
            mappingIncomplete = false;
        
            // 🔥 NOVÝ FLAG: retry má zmysel len ak je dôvod retryovateľný (tracker not ready / error)
            let retryableIncomplete = false;
        
            // 🔥 KĽÚČOVÉ: previousMatchTeamMap musí byť PRED cyklom for,
            // aby obsahoval staré namapované názvy z predchádzajúceho behu
            const previousMatchTeamMap = matchTeamMap || {};
        
            // 🔥 NAJPRV ZMAPUJEME VŠETKY TÍMY
            for (const { id: matchId, data: matchData } of rawMatches) {
                if (isCancelled) return;
        
                let convertedHome = convertIdentifierToDisplayName(matchData.homeTeamIdentifier);
                let convertedAway = convertIdentifierToDisplayName(matchData.awayTeamIdentifier);
        
                const homeCategory = matchData.homeCategory || matchData.categoryName || matchData.categoryId || '';
                const awayCategory = matchData.awayCategory || matchData.categoryName || matchData.categoryId || '';
        
                const homeContainsCategory = teamNameContainsCategory(convertedHome, homeCategory);
                const awayContainsCategory = teamNameContainsCategory(convertedAway, awayCategory);
        
                const homeResult = await mapMatchTeamName(convertedHome, homeCategory);
                const awayResult = await mapMatchTeamName(convertedAway, awayCategory);
        
                const homeIncomplete = homeContainsCategory && homeResult.incomplete;
                const awayIncomplete = awayContainsCategory && awayResult.incomplete;
        
                if (homeIncomplete) {
                    mappingIncomplete = true;
                    if (homeResult.reason === 'tracker_not_ready' || 
                        homeResult.reason === 'error' || 
                        homeResult.reason === 'tracker_missing') {
                        retryableIncomplete = true;
                    }
                }
                if (awayIncomplete) {
                    mappingIncomplete = true;
                    if (awayResult.reason === 'tracker_not_ready' || 
                        awayResult.reason === 'error' || 
                        awayResult.reason === 'tracker_missing') {
                        retryableIncomplete = true;
                    }
                }
        
                // 🔥 Zisti, či nové mapovanie prinieslo reálny názov (líši sa od identifikátora)
                const homeMapped = homeResult.mapped && homeResult.mapped !== matchData.homeTeamIdentifier;
                const awayMapped = awayResult.mapped && awayResult.mapped !== matchData.awayTeamIdentifier;
        
                // 🔥 Ak nové mapovanie zlyhalo, skús použiť staré mapovanie z previousMatchTeamMap
                let finalHome = homeResult.mapped;
                let finalAway = awayResult.mapped;
        
                if (!homeMapped && previousMatchTeamMap[matchId]) {
                    const oldHome = previousMatchTeamMap[matchId].homeTeam;
                    if (oldHome && oldHome !== matchData.homeTeamIdentifier && oldHome !== convertedHome) {
                        finalHome = oldHome;
                        console.log(`[processMatches] Používam starý namapovaný názov pre home: ${oldHome}`);
                    }
                }
                if (!awayMapped && previousMatchTeamMap[matchId]) {
                    const oldAway = previousMatchTeamMap[matchId].awayTeam;
                    if (oldAway && oldAway !== matchData.awayTeamIdentifier && oldAway !== convertedAway) {
                        finalAway = oldAway;
                        console.log(`[processMatches] Používam starý namapovaný názov pre away: ${oldAway}`);
                    }
                }
        
                convertedHome = finalHome;
                convertedAway = finalAway;
        
                newMatchTeamMap[matchId] = {
                    homeTeam: convertedHome,
                    awayTeam: convertedAway,
                    homeCategory: homeCategory,
                    awayCategory: awayCategory,
                    rawMatchData: matchData
                };
        
                // 🔥 NAJPRV zisti, či je náš tím v tomto zápase
                const isHomeMatch = convertedHome === currentTeamName && categoryMatches(homeCategory, currentCategoryName);
                const isAwayMatch = convertedAway === currentTeamName && categoryMatches(awayCategory, currentCategoryName);
        
                // 🔥 Ak je náš tím v zápase, PRIDAJ matchId do newMatchIds VŽDY
                if (isHomeMatch || isAwayMatch) {
                    newMatchIds.add(matchId);
                }
        
                // 🔥 Ak je aspoň jeden tím nezmapovaný, zápas sa nezapočíta do štatistík (continue),
                // ale matchId JE v newMatchIds → listener sa vytvorí
                if (homeIncomplete || awayIncomplete) {
                    console.log(`[processMatches] Zápas ${matchId} má nezmapovaného súpera (homeReason=${homeResult.reason}, awayReason=${awayResult.reason})`);
                    continue;
                }
            }
        
            rawMatches.forEach(({ id: matchId, data: matchData }) => {
                previousMatchStatuses[matchId] = matchData.status || 'scheduled';
            });
        
            // 🔥 AŽ TERAZ NASTAVÍME matchTeamMap - PRED setupEventsListener
            matchTeamMap = newMatchTeamMap;
            isFirstLoad = false;
            console.log('[processMatches] Nájdených matchIds:', newMatchIds.size, 'mappingIncomplete:', mappingIncomplete, 'retryableIncomplete:', retryableIncomplete);
        
            const newMatchIdsArray = Array.from(newMatchIds);
            const oldMatchIdsArray = Array.from(matchIds);
            const matchIdsChanged = newMatchIdsArray.length !== oldMatchIdsArray.length ||
                                   newMatchIdsArray.some(id => !oldMatchIdsArray.includes(id));
        
            // 🔥 KĽÚČOVÉ: Ak sme robili mapovanie (shouldRemap === true), VŽDY znovu nastavíme listenery.
            if (shouldRemap) {
                matchIds = newMatchIds;
                setupEventsListener(newMatchIdsArray);
            } else if (matchIdsChanged) {
                matchIds = newMatchIds;
                setupEventsListener(newMatchIdsArray);
            }
        
            // 🔥 RETRY LEN AK JE DÔVOD RETRYOVATEĽNÝ
            if (retryableIncomplete && !isCancelled) {
                console.log('[processMatches] retryableIncomplete = true, naplánujem retry o 5s');
                if (retryTimeoutId) clearTimeout(retryTimeoutId);
                retryTimeoutId = setTimeout(() => {
                    if (isCancelled) return;
                    console.log('[processMatches] Retry mapovania po 5s');
                    getDocs(matchesQuery).then(snapshot => {
                        processMatches(snapshot, true).catch(err => {
                            console.log('[processMatches retry] CHYBA:', err);
                        });
                    }).catch(err => {
                        console.log('[getDocs retry] CHYBA:', err);
                    });
                }, 5000);
            } else if (mappingIncomplete) {
                console.log('[processMatches] mappingIncomplete = true, ale dôvod je "group_not_ready" → žiadny retry (čaká sa na dokončenie skupiny)');
            }
        };
        
        // onSnapshot
        unsubscribeMatches = onSnapshot(matchesQuery, (matchesSnapshot) => {
            processMatches(matchesSnapshot).catch(err => {
                console.log('[processMatches] CHYBA:', err);
            });
        }, (error) => {
            console.log('[onSnapshot matches] CHYBA:', error);
        });

        let readyCheckInterval = null;
        let readyCheckAttempts = 0;
        const MAX_READY_ATTEMPTS = 600; // 600 * 100ms = 60 sekúnd
        
        const handleMatchTrackerReady = () => {
            console.log('[TeamStatsCollector] matchTrackerReady event prijatý');
            if (isCancelled) return;
            if (matchTrackerReadyHandled) return;
            matchTrackerReadyHandled = true;
            matchTrackerWasReady = true;
            
            // 🔥 Vyčisti polling, ak ešte beží (event vyhral)
            if (typeof readyCheckInterval !== 'undefined' && readyCheckInterval) {
                clearInterval(readyCheckInterval);
                readyCheckInterval = null;
            }
            
            if (pendingSnapshot) {
                const snap = pendingSnapshot;
                pendingSnapshot = null;
                processMatches(snap, true).catch(err => {
                    console.log('[processMatches po matchTrackerReady] CHYBA:', err);
                });
            } else {
                getDocs(matchesQuery).then(snapshot => {
                    processMatches(snapshot, true).catch(err => {
                        console.log('[processMatches po matchTrackerReady] CHYBA:', err);
                    });
                }).catch(err => {
                    console.log('[getDocs po matchTrackerReady] CHYBA:', err);
                });
            }
        };
        
        window.addEventListener('matchTrackerReady', handleMatchTrackerReady);
        matchTrackerReadyListener = handleMatchTrackerReady;
        
        const checkTrackerReady = () => {
            if (isCancelled) {
                if (readyCheckInterval) {
                    clearInterval(readyCheckInterval);
                    readyCheckInterval = null;
                }
                return;
            }
            
            // Ak už bolo spracované cez event, zastav polling
            if (matchTrackerReadyHandled) {
                if (readyCheckInterval) {
                    clearInterval(readyCheckInterval);
                    readyCheckInterval = null;
                }
                return;
            }
            
            // Skontroluj, či je tracker pripravený
            if (typeof window.matchTracker?.isDataReady === 'function' && window.matchTracker.isDataReady()) {
                console.log('[TeamStatsCollector] Polling: matchTracker je pripravený, spúšťam mapovanie');
                matchTrackerReadyHandled = true;
                matchTrackerWasReady = true;
                
                if (readyCheckInterval) {
                    clearInterval(readyCheckInterval);
                    readyCheckInterval = null;
                }
                
                // Použi pendingSnapshot ak existuje, inak načítaj aktuálne dáta
                if (pendingSnapshot) {
                    const snap = pendingSnapshot;
                    pendingSnapshot = null;
                    processMatches(snap, true).catch(err => {
                        console.log('[processMatches z pollingu] CHYBA:', err);
                    });
                } else {
                    getDocs(matchesQuery).then(snapshot => {
                        processMatches(snapshot, true).catch(err => {
                            console.log('[processMatches z pollingu] CHYBA:', err);
                        });
                    }).catch(err => {
                        console.log('[getDocs z pollingu] CHYBA:', err);
                    });
                }
                return;
            }
            
            readyCheckAttempts++;
            if (readyCheckAttempts >= MAX_READY_ATTEMPTS) {
                console.log('[TeamStatsCollector] Polling: prekročený maximálny počet pokusov, zastavujem');
                if (readyCheckInterval) {
                    clearInterval(readyCheckInterval);
                    readyCheckInterval = null;
                }
            }
        };
        
        // Prvá kontrola hneď (pre prípad, že tracker je už pripravený)
        checkTrackerReady();
        
        // Ak ešte nie je pripravený, spustíme polling každých 100ms
        if (!matchTrackerReadyHandled) {
            readyCheckInterval = setInterval(checkTrackerReady, 100);
        }
        
        return () => {
            isCancelled = true;
            pendingSnapshot = null;

            if (retryTimeoutId) {
                clearTimeout(retryTimeoutId);
                retryTimeoutId = null;
            }
            
            // 🔥 NOVÉ: Vyčisti polling interval
            if (readyCheckInterval) {
                clearInterval(readyCheckInterval);
                readyCheckInterval = null;
            }
            
            if (matchTrackerReadyListener) {
                window.removeEventListener('matchTrackerReady', matchTrackerReadyListener);
                matchTrackerReadyListener = null;
            }
            if (unsubscribeMatches) {
                try { unsubscribeMatches(); } catch (e) {}
                unsubscribeMatches = null;
            }
            if (eventsUnsubscribe) {
                try { eventsUnsubscribe(); } catch (e) {}
                eventsUnsubscribe = null;
            }
        };
    }, [rosterData, teamName, categoryName]);
    
    return null;
};

const RostersTable = ({ isRostersVisible }) => {
    const [allTeams, setAllTeams] = useState([]);
    const [allMembersData, setAllMembersData] = useState([]);
    const [allStatsData, setAllStatsData] = useState({});
    const [unsubscribes, setUnsubscribes] = useState([]);
    const [isStatsReady, setIsStatsReady] = useState(false);
    const [totalTeamsCount, setTotalTeamsCount] = useState(0);
    const [statsReceivedCount, setStatsReceivedCount] = useState(0);
    const [receivedTeams, setReceivedTeams] = useState(new Set());
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [categoryColors, setCategoryColors] = useState({}); // NOVÝ STATE PRE FARBY KATEGÓRIÍ

    const [statsUpdateTrigger, setStatsUpdateTrigger] = useState(0);
    const tableContainerRef = useRef(null);
    const [maxTableHeight, setMaxTableHeight] = useState('60vh');

    // FUNKCIA NA ZÍSKANIE SVETLEJŠEJ FARBY
    const getLighterColor = (color) => {
        if (!color) return '#E5E7EB';
        const hex = color.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        
        const lighterR = Math.min(255, Math.floor(r + (255 - r) * 0.85));
        const lighterG = Math.min(255, Math.floor(g + (255 - g) * 0.85));
        const lighterB = Math.min(255, Math.floor(b + (255 - b) * 0.85));
        
        return `#${lighterR.toString(16).padStart(2, '0')}${lighterG.toString(16).padStart(2, '0')}${lighterB.toString(16).padStart(2, '0')}`;
    };

    // NAČÍTANIE FARIEB KATEGÓRIÍ Z DATABÁZY
    useEffect(() => {
        if (!window.db) return;

        const loadCategoryColors = async () => {
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
                        // Uložíme aj názov kategórie pre prípad, že by sme ho potrebovali
                        if (catData.name) {
                            if (!window.categoriesData) window.categoriesData = {};
                            window.categoriesData[catId] = catData.name;
                        }
                    });
                    
                    setCategoryColors(colors);
                    window.categoryDrawColors = colors;
                }
            } catch (err) {
            }
        };

        loadCategoryColors();
    }, []);

    // FUNKCIA NA AKTUÁLNE NASTAVENIE VÝŠKY
    const updateTableHeight = useCallback(() => {
        if (tableContainerRef.current) {
            const rect = tableContainerRef.current.getBoundingClientRect();
            const topOffset = rect.top || 0;
            const calculatedMaxHeight = window.innerHeight - topOffset - 80;
            const newHeight = Math.max(calculatedMaxHeight, 200);
            setMaxTableHeight(`${newHeight}px`);
        }
    }, []);

    // Sledovanie zmien veľkosti okna
    useEffect(() => {
        const handleResize = () => {
            requestAnimationFrame(() => {
                updateTableHeight();
            });
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [updateTableHeight]);

    // Získanie unikátnych kategórií s ich ID
    const getUniqueCategoriesWithIds = useCallback(() => {
        const categoriesMap = new Map();
        allMembersData.forEach(member => {
            if (member.categoryNameDisplay) {
                // Pokúsime sa nájsť ID kategórie
                let categoryId = null;
                if (window.categoriesData) {
                    for (const [id, name] of Object.entries(window.categoriesData)) {
                        if (name === member.categoryNameDisplay) {
                            categoryId = id;
                            break;
                        }
                    }
                }
                if (!categoriesMap.has(member.categoryNameDisplay)) {
                    categoriesMap.set(member.categoryNameDisplay, {
                        name: member.categoryNameDisplay,
                        id: categoryId
                    });
                }
            }
        });
        return Array.from(categoriesMap.values()).sort((a, b) => 
            slovakCollator.compare(a.name, b.name)
        );
    }, [allMembersData]);

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

    useEffect(() => {
        if (!window.db || allTeams.length === 0) return;

        unsubscribes.forEach(unsub => {
            try { unsub(); } catch (e) {}
        });
        setUnsubscribes([]);

        const uniqueTeams = getUniqueTeams();
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

        setTotalTeamsCount(sortedTeams.length);
        setStatsReceivedCount(0);
        setIsStatsReady(false);
        setReceivedTeams(new Set());
        setAllMembersData([]);
        setStatsUpdateTrigger(0);

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
                members.forEach(m => {
                    const uniqueKey = `${teamName}_${categoryName}_${m.type}_${m.firstName || ''}_${m.lastName || ''}_${m.jerseyNumber || m.originalIndex}`;
                    if (!membersMap.has(uniqueKey)) {
                        membersMap.set(uniqueKey, {
                            ...m,
                            teamNameDisplay: teamName,
                            categoryNameDisplay: categoryName,
                            uniqueTeamKey: teamKey
                        });
                    }
                });

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

    const handleStatsUpdate = (teamName, stats, categoryName) => {
        const uniqueKey = `${teamName}_${categoryName}`;
        setAllStatsData(prev => {
            const newStats = {
                ...prev,
                [uniqueKey]: stats
            };
            return newStats;
        });

        setStatsUpdateTrigger(prev => prev + 1);

        setReceivedTeams(prev => {
            const newSet = new Set(prev);
            const teamKey = `${teamName}_${categoryName}`;

            if (!newSet.has(teamKey)) {
                newSet.add(teamKey);
                setStatsReceivedCount(prevCount => {
                    const newCount = prevCount + 1;
                    if (newCount >= totalTeamsCount && totalTeamsCount > 0) {
                        setIsStatsReady(true);
                    }
                    return newCount;
                });
            }
            return newSet;
        });
    };

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

    // ZORADENIE
    const displayMembers = useMemo(() => {
        if (!isStatsReady || allMembersData.length === 0) {
            return [];
        }

        let filteredMembers = allMembersData;

        if (selectedCategory) {
            filteredMembers = allMembersData.filter(member => 
                member.categoryNameDisplay === selectedCategory
            );
        }

        const membersWithStats = filteredMembers.map(member => {
            const key = `${member.teamNameDisplay}_${member.categoryNameDisplay}`;
            const teamStats = allStatsData[key] || {};
            const memberKey = `${member.type}_${member.originalIndex}`;
            const stats = teamStats[memberKey] || { goals: 0 };
            return {
                ...member,
                goals: Number(stats.goals || 0)
            };
        });

        const goalsScorers = membersWithStats.filter(m => m.goals > 0);
        const nonScorers = membersWithStats.filter(m => m.goals === 0);

        goalsScorers.sort((a, b) => {
            if (b.goals !== a.goals) return b.goals - a.goals;
            const teamCompare = slovakCollator.compare(a.teamNameDisplay, b.teamNameDisplay);
            if (teamCompare !== 0) return teamCompare;
            return slovakCollator.compare(`${a.firstName} ${a.lastName}`, `${b.firstName} ${b.lastName}`);
        });

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
    }, [allMembersData, allStatsData, isStatsReady, statsUpdateTrigger, selectedCategory]);

    // NASTAVENIE VÝŠKY PO KAŽDEJ ZMENE DÁT
    useEffect(() => {
        const timer = setTimeout(() => {
            updateTableHeight();
        }, 100);

        return () => clearTimeout(timer);
    }, [allMembersData, isStatsReady, displayMembers, updateTableHeight]);

    // FUNKCIA PRE RESET FILTRA
    const handleCategoryFilter = (category) => {
        setSelectedCategory(prev => prev === category ? null : category);
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

        if (displayMembers.length === 0) {
            return React.createElement(
                'div',
                { className: 'text-center py-8 text-gray-500' },
                selectedCategory ? `Žiadni členovia v kategórii: ${selectedCategory}` : 'Žiadni členovia tímu'
            );
        }

        // Vytvoríme mapu poradia podľa gólov (pre rank)
        const goalRankMap = new Map();
        let currentRank = 1;
        displayMembers.forEach((member, idx) => {
            const key = `${member.teamNameDisplay}_${member.categoryNameDisplay}_${member.type}_${member.originalIndex}`;
            if (member.goals > 0) {
                goalRankMap.set(key, currentRank);
                currentRank++;
            }
        });

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
                React.createElement(
                    'thead',
                    { className: 'bg-gray-100 sticky top-0 z-20' },
                    React.createElement(
                        'tr',
                        { className: 'border-b border-gray-200' },
                        React.createElement('th', { className: 'px-2 py-2 text-left text-xs font-medium text-gray-500', style: { width: '30px' } }, '#'),
                        React.createElement('th', { className: 'px-2 py-2 text-left text-xs font-medium text-gray-500', style: { width: '40px' } }, 'č. dresu'),
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
                React.createElement(
                    'tbody',
                    { className: 'divide-y divide-gray-100' },
                    displayMembers.map((member, idx) => {
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

                        const rowClass = idx % 2 === 0
                            ? 'bg-white hover:bg-blue-50'
                            : 'bg-gray-50 hover:bg-blue-50';

                        const uniqueMemberKey = `${member.teamNameDisplay}_${member.categoryNameDisplay}_${member.type}_${member.originalIndex}`;
                        const rank = goalRankMap.get(uniqueMemberKey) || '';

                        return React.createElement(
                            'tr',
                            {
                                key: uniqueMemberKey,
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
                            selectedCategory 
                                ? `Počet členov v kategórii ${selectedCategory}: ${displayMembers.length}` 
                                : `Celkový počet členov: ${displayMembers.length}`
                        )
                    )
                )
            )
        );
    };

    // RENDER FILTROVACÍCH TLAČIDIEL S FARBAMI
    const renderCategoryFilters = () => {
        const categories = getUniqueCategoriesWithIds();
        if (categories.length === 0) return null;

        return React.createElement(
            'div',
            { className: 'mb-4 flex flex-wrap gap-2 items-center' },
            React.createElement(
                'span',
                { className: 'text-sm font-medium text-gray-700 mr-2' },
                'Filtrovať podľa kategórie:'
            ),
            React.createElement(
                'button',
                {
                    onClick: () => setSelectedCategory(null),
                    className: `px-3 py-1.5 text-sm rounded-full transition-all duration-200 ${
                        selectedCategory === null 
                            ? 'bg-blue-600 text-white shadow-md' 
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`
                },
                'Všetky'
            ),
            categories.map(category => {
                const isActive = selectedCategory === category.name;
                
                // Získame farbu pre kategóriu
                const color = categoryColors[category.id] || '#6B7280';
                const lighterColor = getLighterColor(color);
                
                return React.createElement(
                    'button',
                    {
                        key: category.name,
                        onClick: () => handleCategoryFilter(category.name),
                        className: `px-3 py-1.5 text-sm rounded-full transition-all duration-200 ${
                            isActive 
                                ? 'text-white shadow-md scale-105' 
                                : 'text-gray-700 hover:opacity-80'
                        }`,
                        style: {
                            backgroundColor: isActive ? color : lighterColor,
                            color: isActive ? '#FFFFFF' : (getContrastColor(lighterColor) || '#1F2937')
                        }
                    },
                    category.name
                );
            })
        );
    };

    // POMOCNÁ FUNKCIA PRE KONTRASTNÚ FARBU TEXTU
    const getContrastColor = (hexColor) => {
        if (!hexColor) return '#1F2937';
        const hex = hexColor.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.5 ? '#1F2937' : '#FFFFFF';
    };

    return React.createElement(
        React.Fragment,
        null,
        renderStatsCollectors(),
        renderCategoryFilters(),
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
