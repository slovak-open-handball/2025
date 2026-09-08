// teams.js
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

// Funkcia na odstránenie sufixu - používame pre zobrazenie v tabuľke a pre načítanie z URL
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

// Funkcia na načítanie členov tímu s reálnym sledovaním
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

// --- FUNKCIA NA MANUÁLNU AKTUALIZÁCIU UI ---
const forceUpdateUI = () => {
    console.log('🔄 [forceUpdateUI] Manuálna aktualizácia UI...');
    
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

const TeamsOverviewApp = (props) => {
    const [allTeams, setAllTeams] = useState([]);
    const [categoryIdToNameMap, setCategoryIdToNameMap] = useState({});
    const [uiNotification, setUiNotification] = useState(null);
    
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [selectedTeamNameFilter, setSelectedTeamNameFilter] = useState('');
    const [selectedTeamDetails, setSelectedTeamDetails] = useState(null);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [teamRoster, setTeamRoster] = useState([]);
    const [isLoadingRoster, setIsLoadingRoster] = useState(false);
    const [rosterTeamName, setRosterTeamName] = useState('');
    const [rosterCategoryName, setRosterCategoryName] = useState('');
    const [rosterUnsubscribe, setRosterUnsubscribe] = useState(null);
    const [membersStats, setMembersStats] = useState({});
    const [updateTrigger, setUpdateTrigger] = useState(0);
    const [currentTeamKey, setCurrentTeamKey] = useState('');
    const [isTeamSwitchInProgress, setIsTeamSwitchInProgress] = useState(false);

    // --- STAV PRE VIDITEĽNOSŤ SÚPISIEK ---
    const [isRostersVisible, setIsRostersVisible] = useState(
        window.pagesVisibility && 
        window.pagesVisibility['rosters'] && 
        window.pagesVisibility['rosters'].visible === true
    );

    // --- REAL-TIME LISTENER PRE ZMENY VIDITEĽNOSTI SÚPISIEK ---
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

    const tableContainerRef = useRef(null);

    const [maxTableHeight, setMaxTableHeight] = useState('60vh');

    useEffect(() => {
        if (selectedTeamDetails) {
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
        } else {
            document.body.style.overflow = 'hidden';
            document.documentElement.style.overflow = 'hidden';
        }
    
        return () => {
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
        };
    }, [selectedTeamDetails]);

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
    }, [allTeams, selectedCategoryId, selectedTeamNameFilter]);

    const COLUMN_WIDTHS = {
        teamName: { minWidth: '180px', maxWidth: '250px', width: '180px' },
        category: { minWidth: '80px', width: '80px' },
        total: { minWidth: '80px', width: '80px' }
    };

    const TOP_OFFSET = '0px'; 

    // --- FUNKCIA NA KONVERZIU IDENTIFIKÁTORA NA ZOBRAZENÝ NÁZOV ---
    const convertIdentifierToDisplayName = (identifier) => {
        if (!identifier) return identifier;
        
        if (window.teamManager && typeof window.teamManager.getTeamNameByDisplayIdSync === 'function') {
            try {
                const convertedName = window.teamManager.getTeamNameByDisplayIdSync(identifier);
                if (convertedName && convertedName !== identifier) {
                    return convertedName;
                }
            } catch (err) {
                // Tichá chyba
            }
        }
        return identifier;
    };

    // --- LISTENER PRE ZMENY V matchEvents ---
    useEffect(() => {
        if (!window.db || !selectedTeamDetails || teamRoster.length === 0) {
            return;
        }

        console.log('🔄 [UI Updater] Nastavujem listener na matchEvents pre tím:', selectedTeamDetails.teamName);
        
        const eventsRef = collection(window.db, 'matchEvents');
        const eventsQuery = query(eventsRef);
        
        const unsubscribe = onSnapshot(eventsQuery, (snapshot) => {
            // SKONTROLUJEME, ČI STÁLE PLATÍ AKTÍVNY TÍM
            if (selectedTeamDetails && teamRoster.length > 0) {
                console.log('🔄 [UI Updater] Zmena v matchEvents, aktualizujem štatistiky pre:', selectedTeamDetails.teamName);
                setUpdateTrigger(prev => prev + 1);
            }
        }, (error) => {
            console.error('❌ [UI Updater] Chyba pri počúvaní matchEvents:', error);
        });

        return () => {
            console.log('🔄 [UI Updater] Ruším listener na matchEvents');
            if (unsubscribe) unsubscribe();
        };
    }, [selectedTeamDetails?.teamName, selectedTeamDetails?.category, teamRoster.length]);

    // --- OPRAVENÝ useEffect PRE ŠTATISTIKY ---
    useEffect(() => {
        console.log('[Stats Effect] Spúšťam useEffect pre štatistiky');
        console.log('[Stats Effect] teamRoster length:', teamRoster?.length || 0);
        console.log('[Stats Effect] currentTeamKey:', currentTeamKey);
        console.log('[Stats Effect] isTeamSwitchInProgress:', isTeamSwitchInProgress);
        
        // AK PREBIEHA PREPÍNANIE TÍMU, NEROBÍME NIČ
        if (isTeamSwitchInProgress) {
            console.log('[Stats Effect] ⏳ Prepínanie tímu prebieha, čakám...');
            return;
        }
        
        const teamKey = `${rosterTeamName || selectedTeamDetails?.teamName || ''}_${rosterCategoryName || selectedTeamDetails?.category || ''}`;
        
        if (!teamRoster || teamRoster.length === 0 || !window.db) {
            console.log('[Stats Effect] Podmienka TRUE: žiadni členovia alebo db');
            setMembersStats({});
            return;
        }
    
        const currentTeamName = rosterTeamName || selectedTeamDetails?.teamName || '';
        const currentCategoryName = rosterCategoryName || selectedTeamDetails?.category || '';
    
        console.log('[Stats Effect] currentTeamName:', currentTeamName);
        console.log('[Stats Effect] currentCategoryName:', currentCategoryName);
    
        if (!currentTeamName || !currentCategoryName) {
            console.log('[Stats Effect] Podmienka TRUE: chýba teamName alebo categoryName');
            setMembersStats({});
            return;
        }
    
        // AK SA ZMENIL KĽÚČ, VYMAŽEME STARÉ ŠTATISTIKY
        if (currentTeamKey && currentTeamKey !== teamKey) {
            console.log('[Stats Effect] 🧹 Zmena tímu, vymazávam staré štatistiky');
            setMembersStats({});
            setCurrentTeamKey('');
            return;
        }
    
        setCurrentTeamKey(teamKey);
    
        const matchesRef = collection(window.db, 'matches');
        const matchesQuery = query(matchesRef);
    
        let matchIds = new Set();
        let isFirstLoad = true;
        let eventsUnsubscribe = null;
        let unsubscribeMatches = null;
        let isStatsMounted = true;
    
        const calculateStatsFromEvents = (eventsSnapshot) => {
            const stats = {};
            teamRoster.forEach((member, idx) => {
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
                    memberType: member.type
                };
            });
    
            eventsSnapshot.forEach((doc) => {
                const event = doc.data();
                
                let foundMemberKey = null;
                for (const [memberKey, stat] of Object.entries(stats)) {
                    if (stat.dbArrayName === event.memberTypeKey && stat.dbIndex === event.memberIndex) {
                        foundMemberKey = memberKey;
                        break;
                    }
                }
                
                if (!foundMemberKey) return;
                
                const stat = stats[foundMemberKey];
                
                switch (event.eventType) {
                    case 'goal':
                        stat.goals++;
                        if (event.eventSubtype === 'converted_penalty') {
                            stat.convertedPenalties++;
                        }
                        break;
                    case 'penalty':
                        stat.missedPenalties++;
                        break;
                    case 'card':
                        if (event.eventSubtype === 'yellow') {
                            stat.yellowCards++;
                        } else if (event.eventSubtype === 'red') {
                            stat.redCards++;
                        } else if (event.eventSubtype === 'blue') {
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
            if (eventsUnsubscribe) {
                try { eventsUnsubscribe(); } catch (e) {}
                eventsUnsubscribe = null;
            }
    
            if (matchIdsArray.length === 0) {
                const emptyStats = {};
                teamRoster.forEach((member, idx) => {
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
                        memberType: member.type
                    };
                });
                if (isStatsMounted) {
                    setMembersStats(emptyStats);
                }
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
                    // SKONTROLUJEME, ČI STÁLE IDE O ROVNAKÝ TÍM
                    const currentTeamKeyCheck = `${rosterTeamName || selectedTeamDetails?.teamName || ''}_${rosterCategoryName || selectedTeamDetails?.category || ''}`;
                    if (currentTeamKeyCheck !== teamKey) {
                        console.log('[Stats Effect] ⚠️ Tím sa zmenil, ignorujem výsledky chunk-u');
                        return;
                    }
                    
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
                                memberType: stat.memberType
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
                        // SKONTROLUJEME, ČI STÁLE IDE O ROVNAKÝ TÍM
                        const currentTeamKeyCheck2 = `${rosterTeamName || selectedTeamDetails?.teamName || ''}_${rosterCategoryName || selectedTeamDetails?.category || ''}`;
                        if (currentTeamKeyCheck2 === teamKey && isStatsMounted) {
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
                                    memberType: stat.memberType
                                };
                            });
                            console.log('[Stats Effect] ✅ Nastavujem štatistiky pre tím:', currentTeamKeyCheck2);
                            setMembersStats(finalStats);
                        } else {
                            console.log('[Stats Effect] ⚠️ Tím sa zmenil počas načítavania, ignorujem výsledky');
                        }
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
                                memberType: combinedStats[key].memberType
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
                    try { listener(); } catch (e) {}
                });
            };
        };
    
        const processMatches = (matchesSnapshot) => {
            const newMatchIds = new Set();
            
            matchesSnapshot.forEach(doc => {
                const matchData = doc.data();
                const convertedHome = convertIdentifierToDisplayName(matchData.homeTeamIdentifier);
                const convertedAway = convertIdentifierToDisplayName(matchData.awayTeamIdentifier);
                
                if (convertedHome === currentTeamName || convertedAway === currentTeamName) {
                    newMatchIds.add(doc.id);
                }
            });
    
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
            console.log('[Stats Effect] 🧹 CLEANUP - ruším všetky listenery pre tím:', currentTeamName);
            isStatsMounted = false;
            if (unsubscribeMatches) {
                try { unsubscribeMatches(); } catch (e) {}
                unsubscribeMatches = null;
            }
            if (eventsUnsubscribe) {
                try { eventsUnsubscribe(); } catch (e) {}
                eventsUnsubscribe = null;
            }
        };
    }, [teamRoster, rosterTeamName, rosterCategoryName, selectedTeamDetails, updateTrigger, isTeamSwitchInProgress]);

    // OPRAVENÁ FUNKCIA loadTeamRoster
    const loadTeamRoster = (teamName, categoryName) => {
        console.log('[loadTeamRoster] Volaná s teamName:', teamName, 'categoryName:', categoryName);
        
        // Zrušíme predchádzajúci listener
        if (rosterUnsubscribe) {
            console.log('[loadTeamRoster] Ruším predchádzajúci listener');
            try {
                rosterUnsubscribe();
            } catch (e) {
                // Ignorujeme chyby pri odhlasovaní
            }
            setRosterUnsubscribe(null);
        }
        
        // NASTAVÍME, ŽE PREBIEHA PREPÍNANIE TÍMU
        setIsTeamSwitchInProgress(true);
        
        // OKAMŽITE VYMAŽEME STARÉ DÁTA
        setTeamRoster([]);
        setMembersStats({});
        setCurrentTeamKey('');
        
        if (!teamName || !categoryName) {
            console.log('[loadTeamRoster] Chýba teamName alebo categoryName - vymazávam');
            setIsLoadingRoster(false);
            setRosterTeamName('');
            setRosterCategoryName('');
            setIsTeamSwitchInProgress(false);
            return;
        }        
        
        console.log('[loadTeamRoster] Nastavujem loading, teamName:', teamName, 'categoryName:', categoryName);
        setIsLoadingRoster(true);
        
        setRosterTeamName(teamName);
        setRosterCategoryName(categoryName);
        
        let isMounted = true;
        
        const handleMembersUpdate = (members) => {
            if (!isMounted) return;
            console.log('[loadTeamRoster] handleMembersUpdate - načítaných', members.length, 'členov');
            
            // AK SA ZMENIL TÍM POČAS NAČÍTANIA, IGNORUJEME
            if (rosterTeamName !== teamName || rosterCategoryName !== categoryName) {
                console.log('[loadTeamRoster] ⚠️ Tím sa zmenil, ignorujem výsledky');
                return;
            }
            
            setTeamRoster(members);
            setIsLoadingRoster(false);
            setIsTeamSwitchInProgress(false);
        };
        
        const handleMappedName = (mappedName) => {
            if (!isMounted) return;
            console.log('[loadTeamRoster] handleMappedName:', mappedName);
        };
        
        try {
            const unsubscribe = loadTeamMembers(teamName, categoryName, handleMembersUpdate, handleMappedName);
            setRosterUnsubscribe(() => unsubscribe);
        } catch (error) {
            console.error('[loadTeamRoster] Chyba pri načítaní:', error);
            if (isMounted) {
                setIsLoadingRoster(false);
                setTeamRoster([]);
                setMembersStats({});
                setIsTeamSwitchInProgress(false);
            }
        }
        
        const timeoutId = setTimeout(() => {
            if (isMounted) {
                console.log('[loadTeamRoster] Timeout - ukončujem loading');
                setIsLoadingRoster(false);
                setIsTeamSwitchInProgress(false);
            }
        }, 10000);
        
        window.__rosterTimeoutId = timeoutId;
        
        return () => {
            isMounted = false;
            if (window.__rosterTimeoutId) {
                clearTimeout(window.__rosterTimeoutId);
                window.__rosterTimeoutId = null;
            }
        };
    };

    // Čistenie listenera pri zmene výberu
    useEffect(() => {
        return () => {
            if (rosterUnsubscribe) {
                try {
                    rosterUnsubscribe();
                } catch (e) {}
                setRosterUnsubscribe(null);
            }
            if (window.__rosterTimeoutId) {
                clearTimeout(window.__rosterTimeoutId);
                window.__rosterTimeoutId = null;
            }
            // VYMAŽEME ŠTATISTIKY PRI ODMOUNTOVANÍ
            setMembersStats({});
            setCurrentTeamKey('');
            setIsTeamSwitchInProgress(false);
        };
    }, []);

    // OPRAVENÝ useEffect PRE NAČÍTANIE SÚPISKY
    useEffect(() => {
        const categoryFromUrl = getCategoryFromUrl();
        const hasCategoryInUrl = !!categoryFromUrl;
        
        if (selectedTeamDetails && selectedTeamDetails.occurrences && selectedTeamDetails.occurrences.length > 0 && hasCategoryInUrl) {
            let selectedOcc = null;
            
            if (selectedTeamDetails.category && selectedTeamDetails.teamName) {
                selectedOcc = selectedTeamDetails.occurrences.find(
                    occ => occ.category === selectedTeamDetails.category && 
                           occ.teamName === selectedTeamDetails.teamName
                );
            }
            
            if (!selectedOcc) {
                const { teamName: teamNameFromUrl } = parseUrlHash();
                if (categoryFromUrl && teamNameFromUrl) {
                    selectedOcc = selectedTeamDetails.occurrences.find(
                        occ => occ.category === categoryFromUrl && 
                               occ.teamName === teamNameFromUrl
                    );
                }
            }
            
            if (!selectedOcc && categoryFromUrl) {
                selectedOcc = selectedTeamDetails.occurrences.find(
                    occ => occ.category === categoryFromUrl
                );
            }
            
            if (!selectedOcc && selectedTeamDetails.occurrences.length > 0) {
                selectedOcc = selectedTeamDetails.occurrences[0];
                setSelectedTeamDetails(prev => ({
                    ...prev,
                    teamName: selectedOcc.teamName,
                    category: selectedOcc.category
                }));
            }
            
            if (selectedOcc) {
                let categoryName = selectedOcc.category;
                if (categoryIdToNameMap[categoryName]) {
                    categoryName = categoryIdToNameMap[categoryName];
                }
                // VOLÁME LEN AK SA ZMENIL NÁZOV TÍMU ALEBO KATEGÓRIA
                const currentTeamName = rosterTeamName || selectedTeamDetails?.teamName || '';
                const currentCategoryName = rosterCategoryName || selectedTeamDetails?.category || '';
                if (selectedOcc.teamName !== currentTeamName || categoryName !== currentCategoryName) {
                    loadTeamRoster(selectedOcc.teamName, categoryName);
                }
            }
        } else {
            if (rosterUnsubscribe) {
                try {
                    rosterUnsubscribe();
                } catch (e) {}
                setRosterUnsubscribe(null);
            }
            setTeamRoster([]);
            setIsLoadingRoster(false);
            setRosterTeamName('');
            setRosterCategoryName('');
            setMembersStats({});
            setCurrentTeamKey('');
            setIsTeamSwitchInProgress(false);
        }
    }, [selectedTeamDetails, categoryIdToNameMap]);

    // Funkcia na aktualizáciu URL hashu
    const updateUrlHash = (teamName, categoryName = null) => {
        let hashParts = [];
        if (categoryName) {
            const normalizedCategory = categoryName.replace(/\s+/g, ' ').trim();
            let encodedCategory = normalizedCategory.replace(/ - /g, '___TRIPLE_DASH___');
            encodedCategory = encodedCategory.replace(/ /g, '-');
            encodedCategory = encodedCategory.replace(/___TRIPLE_DASH___/g, '---');
            hashParts.push(`category=${encodeURIComponent(encodedCategory)}`);
        }
        if (teamName) {
            const normalizedTeam = teamName.replace(/\s+/g, ' ').trim();
            let encodedTeam = normalizedTeam.replace(/ - /g, '___TRIPLE_DASH___');
            encodedTeam = encodedTeam.replace(/ /g, '-');
            encodedTeam = encodedTeam.replace(/___TRIPLE_DASH___/g, '---');
            hashParts.push(`team=${encodeURIComponent(encodedTeam)}`);
        }
        
        if (hashParts.length > 0) {
            window.location.hash = hashParts.join('&');
        } else {
            window.location.hash = '';
        }
    };

    // Funkcia na parsovanie URL hashu
    const parseUrlHash = () => {
        const hash = window.location.hash;
        if (hash && hash.startsWith('#')) {
            const params = hash.substring(1).split('&');
            const result = { teamName: null, categoryName: null };
            
            params.forEach(param => {
                const [key, value] = param.split('=');
                if (key === 'team') {
                    let decoded = decodeURIComponent(value);
                    decoded = decoded.replace(/---/g, '___TRIPLE_DASH___');
                    decoded = decoded.replace(/-/g, ' ');
                    decoded = decoded.replace(/___TRIPLE_DASH___/g, ' - ');
                    result.teamName = decoded.replace(/\s+/g, ' ').trim();
                } else if (key === 'category') {
                    let decoded = decodeURIComponent(value);
                    decoded = decoded.replace(/---/g, '___TRIPLE_DASH___');
                    decoded = decoded.replace(/-/g, ' ');
                    decoded = decoded.replace(/___TRIPLE_DASH___/g, ' - ');
                    result.categoryName = decoded.replace(/\s+/g, ' ').trim();
                }
            });
            
            return result;
        }
        return { teamName: null, categoryName: null };
    };

    // Pomocná funkcia na získanie kategórie z URL
    const getCategoryFromUrl = () => {
        const { categoryName } = parseUrlHash();
        return categoryName;
    };

    // Načítanie tímu z URL pri prvom načítaní
    useEffect(() => {
        if (allTeams.length > 0 && categoryIdToNameMap && Object.keys(categoryIdToNameMap).length > 0 && isInitialLoad) {
            const { teamName: teamNameFromUrl, categoryName: categoryNameFromUrl } = parseUrlHash();
            
            let categoryIdFromUrl = '';
            let categoryNameToStore = null;
            
            if (categoryNameFromUrl) {
                const categoryId = Object.keys(categoryIdToNameMap).find(id => categoryIdToNameMap[id] === categoryNameFromUrl);
                if (categoryId) {
                    categoryIdFromUrl = categoryId;
                    categoryNameToStore = categoryNameFromUrl;
                }
            }
            
            if (categoryIdFromUrl) {
                setSelectedCategoryId(categoryIdFromUrl);
            }
            
            if (teamNameFromUrl) {
                let teamOccurrences = allTeams
                    .filter(team => team.teamName === teamNameFromUrl)
                    .map(team => ({
                        category: team.category,
                        teamName: team.teamName,
                        uid: team.uid,
                        id: team.id,
                        groupName: team.groupName,
                        order: team.order
                    }));
        
                if (teamOccurrences.length === 0) {
                    const baseTeamNameFromUrl = removeSuffix(teamNameFromUrl);
                    teamOccurrences = allTeams
                        .filter(team => {
                            let cleanName = removeSuffix(team.teamName);
                            if (team.category && cleanName.startsWith(team.category + ' ')) {
                                cleanName = cleanName.substring(team.category.length + 1).trim();
                            }
                            cleanName = removeSuffix(cleanName);
                            return cleanName === baseTeamNameFromUrl;
                        })
                        .map(team => ({
                            category: team.category,
                            teamName: team.teamName,
                            uid: team.uid,
                            id: team.id,
                            groupName: team.groupName,
                            order: team.order
                        }));
                }
        
                if (teamOccurrences.length > 0) {
                    const baseTeamName = removeSuffix(teamNameFromUrl);
                    const allOccurrences = allTeams
                        .filter(team => {
                            let cleanName = removeSuffix(team.teamName);
                            if (team.category && cleanName.startsWith(team.category + ' ')) {
                                cleanName = cleanName.substring(team.category.length + 1).trim();
                            }
                            cleanName = removeSuffix(cleanName);
                            return cleanName === baseTeamName;
                        })
                        .map(team => ({
                            category: team.category,
                            teamName: team.teamName,
                            uid: team.uid,
                            id: team.id,
                            groupName: team.groupName,
                            order: team.order
                        }));
                    
                    let selectedTeamName = teamNameFromUrl;
                    if (categoryNameFromUrl) {
                        const exactMatch = teamOccurrences.find(occ => occ.category === categoryNameFromUrl);
                        if (exactMatch) {
                            selectedTeamName = exactMatch.teamName;
                        }
                    }
                    
                    setSelectedTeamDetails({
                        teamName: selectedTeamName,
                        category: categoryNameToStore,
                        occurrences: allOccurrences
                    });
                }
            }
            setIsInitialLoad(false);
        }
    }, [allTeams, categoryIdToNameMap, isInitialLoad]);

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

        return () => {
            unsubscribeUsers();
            unsubscribeCategories();
        };
    }, []);

    // Počúvanie na zmeny v URL hash
    useEffect(() => {
        const handleHashChange = () => {
            if (!isInitialLoad) {
                const { teamName: teamNameFromUrl, categoryName: categoryNameFromUrl } = parseUrlHash();
                
                let newCategoryId = '';
                if (categoryNameFromUrl) {
                    const categoryId = Object.keys(categoryIdToNameMap).find(id => categoryIdToNameMap[id] === categoryNameFromUrl);
                    if (categoryId) {
                        newCategoryId = categoryId;
                    }
                }
                
                setSelectedCategoryId(newCategoryId);
                
                if (teamNameFromUrl) {
                    let teamOccurrences = allTeams
                        .filter(team => team.teamName === teamNameFromUrl)
                        .map(team => ({
                            category: team.category,
                            teamName: team.teamName,
                            uid: team.uid,
                            id: team.id,
                            groupName: team.groupName,
                            order: team.order
                        }));
                    
                    if (teamOccurrences.length === 0) {
                        const baseTeamNameFromUrl = removeSuffix(teamNameFromUrl);
                        teamOccurrences = allTeams
                            .filter(team => {
                                let cleanName = removeSuffix(team.teamName);
                                if (team.category && cleanName.startsWith(team.category + ' ')) {
                                    cleanName = cleanName.substring(team.category.length + 1).trim();
                                }
                                cleanName = removeSuffix(cleanName);
                                return cleanName === baseTeamNameFromUrl;
                            })
                            .map(team => ({
                                category: team.category,
                                teamName: team.teamName,
                                uid: team.uid,
                                id: team.id,
                                groupName: team.groupName,
                                order: team.order
                            }));
                    }
                    
                    if (teamOccurrences.length > 0) {
                        const baseTeamName = removeSuffix(teamNameFromUrl);
                        const allOccurrences = allTeams
                            .filter(team => {
                                let cleanName = removeSuffix(team.teamName);
                                if (team.category && cleanName.startsWith(team.category + ' ')) {
                                    cleanName = cleanName.substring(team.category.length + 1).trim();
                                }
                                cleanName = removeSuffix(cleanName);
                                return cleanName === baseTeamName;
                            })
                            .map(team => ({
                                category: team.category,
                                teamName: team.teamName,
                                uid: team.uid,
                                id: team.id,
                                groupName: team.groupName,
                                order: team.order
                            }));
                        
                        let selectedTeamName = teamNameFromUrl;
                        if (categoryNameFromUrl) {
                            const exactMatch = teamOccurrences.find(occ => occ.category === categoryNameFromUrl);
                            if (exactMatch) {
                                selectedTeamName = exactMatch.teamName;
                            }
                        }
                        
                        setSelectedTeamDetails({
                            teamName: selectedTeamName,
                            category: categoryNameFromUrl || null,
                            occurrences: allOccurrences
                        });
                    } else {
                        setSelectedTeamDetails(null);
                    }
                } else {
                    setSelectedTeamDetails(null);
                }
            }
        };
    
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [allTeams, categoryIdToNameMap, isInitialLoad, selectedTeamDetails]);

    const getTableData = () => {
        if (allTeams.length === 0 || Object.keys(categoryIdToNameMap).length === 0) {
            return { teamNames: [], categoryNames: [], matrix: {} };
        }

        const categoryNames = Object.values(categoryIdToNameMap).sort((a, b) => slovakCollator.compare(a, b));
        
        const cleanedTeams = allTeams.map(team => ({
            ...team,
            cleanName: removeSuffix(team.teamName)
        }));
        
        const teamNamesSet = new Set();
        cleanedTeams.forEach(team => {
            let cleanName = team.cleanName;
            if (team.category && cleanName.startsWith(team.category + ' ')) {
                cleanName = cleanName.substring(team.category.length + 1).trim();
            }
            cleanName = removeSuffix(cleanName);
            
            if (selectedTeamNameFilter && !cleanName.toLowerCase().includes(selectedTeamNameFilter.toLowerCase())) {
                return;
            }
            teamNamesSet.add(cleanName);
        });
        
        const teamNames = Array.from(teamNamesSet).sort((a, b) => slovakCollator.compare(a, b));
        
        const matrix = {};
        teamNames.forEach(name => {
            matrix[name] = {};
            categoryNames.forEach(cat => {
                const count = cleanedTeams.filter(team => {
                    let cleanName = team.cleanName;
                    if (team.category && cleanName.startsWith(team.category + ' ')) {
                        cleanName = cleanName.substring(team.category.length + 1).trim();
                    }
                    cleanName = removeSuffix(cleanName);
                    return team.category === cat && cleanName === name;
                }).length;
                matrix[name][cat] = count;
            });
        });

        return { teamNames, categoryNames, matrix };
    };

    const { teamNames, categoryNames, matrix } = getTableData();
    const filteredCategoryNames = categoryNames;

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

    const handleCategoryHeaderClick = (categoryName) => {
        const categoryId = Object.keys(categoryIdToNameMap).find(id => categoryIdToNameMap[id] === categoryName);
        if (categoryId) {
            if (selectedCategoryId === categoryId) {
                setSelectedCategoryId('');
                if (selectedTeamDetails) {
                    const normalizedTeam = selectedTeamDetails.teamName.replace(/\s+/g, ' ').trim();
                    updateUrlHash(normalizedTeam, null);
                } else {
                    updateUrlHash(null);
                }
            } else {
                setSelectedCategoryId(categoryId);
                if (selectedTeamDetails) {
                    const normalizedTeam = selectedTeamDetails.teamName.replace(/\s+/g, ' ').trim();
                    updateUrlHash(normalizedTeam, categoryName);
                } else {
                    updateUrlHash(null, categoryName);
                }
            }
        }
    };

    const handleTeamNameClick = (teamName) => {
        const normalizedTeamName = teamName.replace(/\s+/g, ' ').trim();
        const currentCategoryName = selectedCategoryId ? categoryIdToNameMap[selectedCategoryId] : null;
        const baseTeamName = removeSuffix(normalizedTeamName);
        
        const teamOccurrences = allTeams
            .filter(team => {
                const cleanName = removeSuffix(team.teamName);
                return cleanName === baseTeamName;
            })
            .map(team => ({
                category: team.category,
                teamName: team.teamName,
                uid: team.uid,
                id: team.id,
                groupName: team.groupName,
                order: team.order
            }));

        if (teamOccurrences.length > 0) {
            setSelectedTeamDetails({
                teamName: normalizedTeamName,
                category: currentCategoryName,
                occurrences: teamOccurrences
            });
            updateUrlHash(normalizedTeamName, currentCategoryName);
        }
    };

    // OPRAVENÁ FUNKCIA closeTeamDetails
    const closeTeamDetails = () => {
        const { categoryName: categoryNameFromUrl } = parseUrlHash();
        
        // ZRUŠÍME LISTENER
        if (rosterUnsubscribe) {
            try {
                rosterUnsubscribe();
            } catch (e) {}
            setRosterUnsubscribe(null);
        }
        
        // VYMAŽEME VŠETKY DÁTA
        setSelectedTeamDetails(null);
        setTeamRoster([]);
        setRosterTeamName('');
        setRosterCategoryName('');
        setMembersStats({});
        setCurrentTeamKey('');
        setIsTeamSwitchInProgress(false);
        
        if (categoryNameFromUrl) {
            const categoryId = Object.keys(categoryIdToNameMap).find(id => categoryIdToNameMap[id] === categoryNameFromUrl);
            if (categoryId) {
                setSelectedCategoryId(categoryId);
            }
        } else {
            setSelectedCategoryId('');
        }
        
        updateUrlHash(null, categoryNameFromUrl || null);
    };

    // OPRAVENÁ FUNKCIA handleTeamOccurrenceClick
    const handleTeamOccurrenceClick = (occ) => {
        const normalizedTeamName = occ.teamName.replace(/\s+/g, ' ').trim();
        const normalizedCategory = occ.category.replace(/\s+/g, ' ').trim();        
        
        const hashParts = [];
        if (normalizedCategory) {
            let encodedCategory = normalizedCategory.replace(/ - /g, '___TRIPLE_DASH___');
            encodedCategory = encodedCategory.replace(/ /g, '-');
            encodedCategory = encodedCategory.replace(/___TRIPLE_DASH___/g, '---');
            hashParts.push(`category=${encodeURIComponent(encodedCategory)}`);
        }
        if (normalizedTeamName) {
            let encodedTeam = normalizedTeamName.replace(/ - /g, '___TRIPLE_DASH___');
            encodedTeam = encodedTeam.replace(/ /g, '-');
            encodedTeam = encodedTeam.replace(/___TRIPLE_DASH___/g, '---');
            hashParts.push(`team=${encodeURIComponent(encodedTeam)}`);
        }
        
        const newHash = hashParts.length > 0 ? `#${hashParts.join('&')}` : '';
        if (window.location.hash !== newHash) {
            window.history.replaceState(null, '', newHash);
        }
        
        const baseTeamName = removeSuffix(normalizedTeamName);
        const allOccurrences = allTeams
            .filter(team => {
                const cleanName = removeSuffix(team.teamName);
                return cleanName === baseTeamName;
            })
            .map(team => ({
                category: team.category,
                teamName: team.teamName,
                uid: team.uid,
                id: team.id,
                groupName: team.groupName,
                order: team.order
            }));
        
        // NASTAVÍME NOVÝ DETAIL TÍMU
        setSelectedTeamDetails({
            teamName: normalizedTeamName,
            category: normalizedCategory,
            occurrences: allOccurrences
        });
        
        // NAČÍTAME SÚPISKU
        let categoryName = occ.category;
        if (categoryIdToNameMap[categoryName]) {
            categoryName = categoryIdToNameMap[categoryName];
        }
        loadTeamRoster(occ.teamName, categoryName);
    };

    // Render súpisky tímu so štatistikami
    const renderTeamRoster = () => {
        const categoryFromUrl = getCategoryFromUrl();
        const hasCategoryInUrl = !!categoryFromUrl;
        
        if (!hasCategoryInUrl) {
            return null;
        }
        
        if (!isRostersVisible) {
            return null;
        }
        
        if (!selectedTeamDetails) return null;
        
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
        
        const displayTeamName = rosterTeamName || selectedTeamDetails?.teamName || '';
        const displayCategoryName = rosterCategoryName || selectedTeamDetails?.category || '';
        
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
                return {
                    goals: 0,
                    convertedPenalties: 0,
                    missedPenalties: 0,
                    yellowCards: 0,
                    redCards: 0,
                    blueCards: 0,
                    exclusions: 0
                };
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

    const renderTeamDetails = () => {
        if (!selectedTeamDetails) return null;

        const categoryFromUrl = getCategoryFromUrl();
        const hasCategoryInUrl = !!categoryFromUrl;

        const sortedOccurrences = [...selectedTeamDetails.occurrences].sort((a, b) => {
            const categoryCompare = slovakCollator.compare(a.category, b.category);
            if (categoryCompare !== 0) {
                return categoryCompare;
            }
            return slovakCollator.compare(a.teamName, b.teamName);
        });

        return React.createElement(
            'div',
            { className: 'w-full' },
            React.createElement(
                'div',
                { className: 'mb-6' },
                React.createElement(
                    'div',
                    { className: 'flex justify-between items-center' },
                    React.createElement(
                        'div',
                        null,
                        React.createElement(
                            'button',
                            {
                                onClick: closeTeamDetails,
                                className: 'px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors flex items-center gap-2'
                            },
                            '← Späť na prehľad'
                        ),
                        React.createElement(
                            'h2',
                            { className: 'text-2xl font-bold text-gray-800 mt-4' },
                            `Tím: ${selectedTeamDetails.teamName}`
                        )
                    )
                )
            ),
            React.createElement(
                'div',
                { className: 'bg-white rounded-xl shadow-xl p-6' },
                React.createElement(
                    'h3',
                    { className: 'text-lg font-semibold text-gray-700 mb-4' },
                    'Tím v kategóriách:'
                ),
                React.createElement(
                    'div',
                    { className: 'flex flex-wrap gap-3 mt-2' },
                    sortedOccurrences.map((occ, index) => {
                        let isSelected = false;
                        if (hasCategoryInUrl) {
                            if (selectedTeamDetails.category === null) {
                                isSelected = occ.teamName === selectedTeamDetails.teamName;
                            } else {
                                isSelected = occ.category === selectedTeamDetails.category && 
                                           occ.teamName === selectedTeamDetails.teamName;
                            }
                        }
                        
                        const buttonLabel = `${occ.category} | ${occ.teamName}`;
                        return React.createElement(
                            'button',
                            {
                                key: index,
                                className: `px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
                                    hasCategoryInUrl && isSelected 
                                        ? 'bg-blue-500 text-white hover:bg-blue-600' 
                                        : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                                }`,
                                onClick: () => handleTeamOccurrenceClick(occ)
                            },
                            buttonLabel
                        );
                    })
                ),
                React.createElement(
                    'div',
                    { className: 'mt-6 pt-4 border-t border-gray-200 text-sm text-gray-500' },
                    `Celkový počet tímov: ${selectedTeamDetails.occurrences.length}`
                )
            ),
            renderTeamRoster()
        );
    };

    const renderOverviewTable = () => {
        if (teamNames.length === 0 || filteredCategoryNames.length === 0) {
            return React.createElement(
                'div',
                { className: 'text-center py-16 text-gray-500' },
                'Žiadne údaje.'
            );
        }

        const getTotalForTeam = (teamName) => {
            let total = 0;
            filteredCategoryNames.forEach(cat => {
                total += (matrix[teamName]?.[cat] || 0);
            });
            return total;
        };

        let filteredTeamNames = teamNames;
        if (selectedCategoryId) {
            const selectedCategoryName = categoryIdToNameMap[selectedCategoryId];
            filteredTeamNames = teamNames.filter(teamName => {
                const count = matrix[teamName]?.[selectedCategoryName] || 0;
                return count > 0;
            });
        }

        const sortedTeamNames = filteredTeamNames;

        if (sortedTeamNames.length === 0) {
            return React.createElement(
                'div',
                { className: 'text-center py-16 text-gray-500' },
                'Žiadne tímy v tejto kategórii.'
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
                    className: 'w-full border-collapse bg-white',
                    style: { minWidth: '600px' }
                },
                React.createElement(
                    'thead',
                    { className: 'bg-gray-800 text-white' },
                    React.createElement(
                        'tr',
                        null,
                        React.createElement(
                            'th',
                            { 
                                className: 'px-4 py-3 text-left font-semibold sticky left-0 bg-gray-800 z-20 border-r border-gray-600',
                                style: { ...COLUMN_WIDTHS.teamName, top: TOP_OFFSET }
                            },
                            'Názov tímu'
                        ),
                        filteredCategoryNames.map((catName) => {
                            const isSelected = selectedCategoryId && categoryIdToNameMap[selectedCategoryId] === catName;
                            
                            return React.createElement(
                                'th',
                                { 
                                    key: catName,
                                    onClick: () => handleCategoryHeaderClick(catName),
                                    className: `px-4 py-3 text-center font-semibold whitespace-nowrap cursor-pointer hover:bg-gray-700 transition-colors duration-200 sticky z-10 border-r border-gray-600 ${isSelected ? 'bg-[#1d4ed8]' : 'bg-gray-800'}`,
                                    style: { ...COLUMN_WIDTHS.category, top: TOP_OFFSET },
                                    title: isSelected ? 'Kliknite pre zrušenie filtra' : 'Kliknite pre filtrovanie podľa tejto kategórie'
                                },
                                React.createElement(
                                    'span',
                                    { className: 'flex items-center justify-center gap-1' },
                                    catName,
                                    isSelected && React.createElement('span', { className: 'text-xs ml-1' }, '✕')
                                )
                            );
                        }),
                        React.createElement(
                            'th',
                            { 
                                className: 'px-4 py-3 text-center font-semibold bg-gray-700 whitespace-nowrap sticky z-10',
                                style: { ...COLUMN_WIDTHS.total, top: TOP_OFFSET }
                            },
                            'Celkom'
                        )
                    )
                ),
                React.createElement(
                    'tbody',
                    null,
                    sortedTeamNames.map((teamName, rowIndex) => {
                        const total = getTotalForTeam(teamName);
                        const isEvenRow = rowIndex % 2 === 0;
                        
                        return React.createElement(
                            'tr',
                            { 
                                key: teamName,
                                className: `${isEvenRow ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors duration-150`
                            },
                            React.createElement(
                                'td',
                                { 
                                    className: 'px-4 py-3 font-medium text-gray-800 sticky left-0 bg-inherit z-10 border-r border-gray-200 cursor-pointer hover:text-blue-600 hover:underline',
                                    style: COLUMN_WIDTHS.teamName,
                                    onClick: () => handleTeamNameClick(teamName)
                                },
                                teamName
                            ),
                            filteredCategoryNames.map((catName) => {
                                const count = matrix[teamName]?.[catName] || 0;
                                return React.createElement(
                                    'td',
                                    { 
                                        key: catName,
                                        className: 'px-4 py-3 text-center font-semibold border-r border-gray-200',
                                        style: COLUMN_WIDTHS.category
                                    },
                                    count > 0 ? count : ''
                                );
                            }),
                            React.createElement(
                                'td',
                                { 
                                    className: `px-4 py-3 text-center font-bold ${total > 0 ? 'text-gray-800' : 'text-gray-400'}`,
                                    style: COLUMN_WIDTHS.total
                                },
                                total > 0 ? total : ''
                            )
                        );
                    })
                ),
                React.createElement(
                    'tfoot',
                    { className: 'bg-gray-200 font-semibold' },
                    React.createElement(
                        'tr',
                        null,
                        React.createElement(
                            'td',
                            { 
                                className: 'px-4 py-3 text-left text-gray-700 sticky left-0 bottom-0 bg-gray-200 z-20 border-r border-gray-300 border-t border-gray-400',
                                style: { ...COLUMN_WIDTHS.teamName, bottom: 0 }
                            },
                            'Celkom tímov'
                        ),
                        filteredCategoryNames.map((catName) => {
                            let totalInCategory = 0;
                            sortedTeamNames.forEach(teamName => {
                                totalInCategory += (matrix[teamName]?.[catName] || 0);
                            });
                            
                            return React.createElement(
                                'td',
                                { 
                                    key: catName,
                                    className: 'px-4 py-3 text-center text-gray-700 sticky bottom-0 bg-gray-200 z-10 border-r border-gray-300 border-t border-gray-400',
                                    style: { ...COLUMN_WIDTHS.category, bottom: 0 }
                                },
                                totalInCategory
                            );
                        }),
                        React.createElement(
                            'td',
                            { 
                                className: 'px-4 py-3 text-center text-gray-700 bg-gray-300 sticky bottom-0 z-10 border-t border-gray-400',
                                style: { ...COLUMN_WIDTHS.total, bottom: 0 }
                            },
                            sortedTeamNames.reduce((sum, name) => sum + getTotalForTeam(name), 0)
                        )
                    )
                )
            )
        );
    };

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
            (selectedCategoryId || selectedTeamNameFilter) && React.createElement(
                'button',
                {
                    onClick: () => {
                        setSelectedCategoryId('');
                        setSelectedTeamNameFilter('');
                        if (selectedTeamDetails) {
                            const normalizedTeam = selectedTeamDetails.teamName.replace(/\s+/g, ' ').trim();
                            updateUrlHash(normalizedTeam, null);
                        } else {
                            updateUrlHash(null);
                        }
                    },
                    className: 'px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors'
                },
                'Vymazať filtre ✕'
            )
        );
    };

    // Hlavný render
    const renderMainContent = () => {
        if (selectedTeamDetails) {
            return renderTeamDetails();
        }

        return React.createElement(
            React.Fragment,
            null,
            renderFilters(),
            React.createElement(
                'div',
                { className: 'bg-white rounded-xl shadow-xl p-4' },
                renderOverviewTable()
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
                selectedTeamDetails ? `Detail tímu: ${selectedTeamDetails.teamName}` : 'Prehľad tímov podľa kategórií'
            ),
            React.createElement(
                'p',
                { className: 'text-center text-gray-500 mt-1' },
                selectedTeamDetails ? 'Kliknutím na tlačidlo vyberiete konkrétny tím' : 'Kliknite na názov tímu pre zobrazenie detailov'
            )
        ),
        renderMainContent()
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
