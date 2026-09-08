// teams.js - Zjednodušená verzia len so súhrnnou tabuľkou všetkých členov
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

// Funkcia na konverziu identifikátora tímu na zobrazený názov
const convertIdentifierToDisplayName = (identifier) => {
    if (!identifier) return identifier;
    
    if (window.teamManager && typeof window.teamManager.getTeamNameByDisplayIdSync === 'function') {
        try {
            const convertedName = window.teamManager.getTeamNameByDisplayIdSync(identifier);
            if (convertedName && convertedName !== identifier) {
                return convertedName;
            }
        } catch (err) {
            // Ignorujeme chyby
        }
    }
    return identifier;
};

// Funkcia na načítanie všetkých členov všetkých tímov do jedného zoznamu
const loadAllTeamMembers = (onUpdate) => {
    if (!window.db) {
        if (onUpdate) onUpdate([]);
        return () => {};
    }
    
    const usersRef = collection(window.db, 'users');
    
    const unsubscribe = onSnapshot(usersRef, (usersSnapshot) => {
        const allMembers = [];
        
        for (const userDoc of usersSnapshot.docs) {
            const userId = userDoc.id;
            const userData = userDoc.data();
            const teams = userData.teams || {};
            
            for (const [categoryName, teamsArray] of Object.entries(teams)) {
                if (!Array.isArray(teamsArray)) continue;
                
                for (const team of teamsArray) {
                    const teamName = team.teamName || 'Neznámy tím';
                    
                    // Hráči
                    if (team.playerDetails && Array.isArray(team.playerDetails)) {
                        team.playerDetails.forEach((player, idx) => {
                            allMembers.push({
                                type: 'Hráč',
                                typeKey: 'playerDetails',
                                firstName: player.firstName || '',
                                lastName: player.lastName || '',
                                jerseyNumber: player.jerseyNumber || '',
                                registrationNumber: player.registrationNumber || '',
                                userId: userId,
                                originalIndex: idx,
                                dbArrayName: 'playerDetails',
                                teamName: teamName,
                                categoryName: categoryName,
                                teamId: team.id || null,
                                memberIdentifier: `playerDetails_${idx}`
                            });
                        });
                    }
                    
                    // Členovia RT (muži)
                    if (team.menTeamMemberDetails && Array.isArray(team.menTeamMemberDetails)) {
                        team.menTeamMemberDetails.forEach((member, idx) => {
                            allMembers.push({
                                type: 'Člen RT (muž)',
                                typeKey: 'menTeamMemberDetails',
                                firstName: member.firstName || '',
                                lastName: member.lastName || '',
                                jerseyNumber: '',
                                registrationNumber: member.registrationNumber || '',
                                userId: userId,
                                originalIndex: idx,
                                dbArrayName: 'menTeamMemberDetails',
                                teamName: teamName,
                                categoryName: categoryName,
                                teamId: team.id || null,
                                memberIdentifier: `menTeamMemberDetails_${idx}`
                            });
                        });
                    }
                    
                    // Členovia RT (ženy)
                    if (team.womenTeamMemberDetails && Array.isArray(team.womenTeamMemberDetails)) {
                        team.womenTeamMemberDetails.forEach((member, idx) => {
                            allMembers.push({
                                type: 'Člen RT (žena)',
                                typeKey: 'womenTeamMemberDetails',
                                firstName: member.firstName || '',
                                lastName: member.lastName || '',
                                jerseyNumber: '',
                                registrationNumber: member.registrationNumber || '',
                                userId: userId,
                                originalIndex: idx,
                                dbArrayName: 'womenTeamMemberDetails',
                                teamName: teamName,
                                categoryName: categoryName,
                                teamId: team.id || null,
                                memberIdentifier: `womenTeamMemberDetails_${idx}`
                            });
                        });
                    }
                }
            }
        }
        
        // Zoradenie: najprv RT členovia, potom hráči, podľa priezviska
        const rtMembers = allMembers.filter(m => m.type !== 'Hráč');
        const players = allMembers.filter(m => m.type === 'Hráč');
        
        const sortedMembers = [...rtMembers, ...players].sort((a, b) => {
            const aName = `${a.lastName} ${a.firstName}`.trim();
            const bName = `${b.lastName} ${b.firstName}`.trim();
            return slovakCollator.compare(aName, bName);
        });
        
        if (onUpdate) onUpdate(sortedMembers);
    }, (error) => {
        console.error('[loadAllTeamMembers] Chyba:', error);
        if (onUpdate) onUpdate([]);
    });
    
    return unsubscribe;
};

// Funkcia na výpočet štatistík z udalostí
const calculateStatsFromEvents = (eventsSnapshot, membersMap) => {
    console.log('[Stats] Spracúvam udalosti, počet:', eventsSnapshot.size);
    
    // Inicializujeme štatistiky pre každého člena
    const stats = {};
    membersMap.forEach((member, key) => {
        stats[key] = {
            goals: 0,
            convertedPenalties: 0,
            missedPenalties: 0,
            yellowCards: 0,
            redCards: 0,
            blueCards: 0,
            exclusions: 0,
            name: `${member.firstName} ${member.lastName}`.trim(),
            jerseyNumber: member.jerseyNumber || '',
            memberType: member.type,
            teamName: member.teamName,
            categoryName: member.categoryName,
            userId: member.userId
        };
    });

    // Prejdeme všetky udalosti a pripočítame ich k príslušným členom
    eventsSnapshot.forEach((doc) => {
        const event = doc.data();
        
        let foundMemberKey = null;
        
        // 1. Skúsime nájsť podľa memberIdentifier (memberTypeKey + memberIndex)
        const memberIdentifier = `${event.memberTypeKey}_${event.memberIndex}`;
        for (const [key, member] of membersMap) {
            if (member.memberIdentifier === memberIdentifier) {
                foundMemberKey = key;
                break;
            }
        }
        
        // 2. Skúsime nájsť podľa userId + memberTypeKey + memberIndex
        if (!foundMemberKey && event.userId) {
            for (const [key, member] of membersMap) {
                if (member.userId === event.userId && 
                    member.dbArrayName === event.memberTypeKey && 
                    member.originalIndex === event.memberIndex) {
                    foundMemberKey = key;
                    break;
                }
            }
        }
        
        // 3. Skúsime nájsť podľa memberTypeKey + memberIndex (bez userId)
        if (!foundMemberKey) {
            for (const [key, member] of membersMap) {
                if (member.dbArrayName === event.memberTypeKey && 
                    member.originalIndex === event.memberIndex) {
                    foundMemberKey = key;
                    break;
                }
            }
        }
        
        // 4. Skúsime nájsť podľa mena
        if (!foundMemberKey) {
            const eventMemberName = `${event.memberFirstName || ''} ${event.memberLastName || ''}`.trim();
            if (eventMemberName) {
                for (const [key, member] of membersMap) {
                    const memberName = `${member.firstName} ${member.lastName}`.trim();
                    if (memberName === eventMemberName) {
                        foundMemberKey = key;
                        break;
                    }
                }
            }
        }
        
        // 5. Skúsime nájsť podľa mena a tímu
        if (!foundMemberKey) {
            const eventMemberName = `${event.memberFirstName || ''} ${event.memberLastName || ''}`.trim();
            if (eventMemberName) {
                for (const [key, member] of membersMap) {
                    const memberName = `${member.firstName} ${member.lastName}`.trim();
                    if (memberName === eventMemberName && member.teamName === event.team) {
                        foundMemberKey = key;
                        break;
                    }
                }
            }
        }
        
        // 6. Skúsime nájsť podľa čísla dresu a tímu
        if (!foundMemberKey && event.memberJerseyNumber) {
            for (const [key, member] of membersMap) {
                if (member.jerseyNumber === event.memberJerseyNumber && 
                    member.teamName === event.team) {
                    foundMemberKey = key;
                    break;
                }
            }
        }
        
        if (!foundMemberKey) {
            // Logujeme len prvé 3 nepriradené udalosti
            if (!window._unmatchedEventsLogged) {
                window._unmatchedEventsLogged = 0;
            }
            if (window._unmatchedEventsLogged < 3) {
                console.log('[Stats] ⚠️ Nenašiel sa člen pre udalosť:', {
                    memberTypeKey: event.memberTypeKey,
                    memberIndex: event.memberIndex,
                    userId: event.userId,
                    memberName: `${event.memberFirstName || ''} ${event.memberLastName || ''}`.trim(),
                    team: event.team
                });
                window._unmatchedEventsLogged++;
            }
            return;
        }
        
        const stat = stats[foundMemberKey];
        
        // Pripočítame štatistiky podľa typu udalosti
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
            default:
                break;
        }
    });

    console.log('[Stats] Spracovaných udalostí:', eventsSnapshot.size);
    console.log('[Stats] Počet členov so štatistikami:', Object.keys(stats).length);
    
    return stats;
};

const TeamsOverviewApp = (props) => {
    const [allMembers, setAllMembers] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [allMembersUnsubscribe, setAllMembersUnsubscribe] = useState(null);
    const [uiNotification, setUiNotification] = useState(null);
    const [membersStats, setMembersStats] = useState({});
    const [isLoadingStats, setIsLoadingStats] = useState(false);
    const [statsUnsubscribe, setStatsUnsubscribe] = useState(null);
    const [categoryIdToNameMap, setCategoryIdToNameMap] = useState({});

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
    const [maxTableHeight, setMaxTableHeight] = useState('70vh');

    useEffect(() => {
        const updateHeight = () => {
            if (tableContainerRef.current) {
                const rect = tableContainerRef.current.getBoundingClientRect();
                const calculatedMaxHeight = window.innerHeight - rect.top - 50; 
                setMaxTableHeight(`${Math.max(calculatedMaxHeight, 300)}px`);
            }
        };

        updateHeight();
        window.addEventListener('resize', updateHeight);
        return () => window.removeEventListener('resize', updateHeight);
    }, [allMembers]);

    // Načítanie kategórií
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

        return () => {
            unsubscribeCategories();
        };
    }, []);

    // Načítanie štatistík pre všetkých členov
    useEffect(() => {
        if (!allMembers || allMembers.length === 0 || !window.db) {
            setMembersStats({});
            return;
        }

        console.log('[Stats] Spúšťam načítanie štatistík pre', allMembers.length, 'členov');
        setIsLoadingStats(true);

        // Vytvoríme mapu členov pre rýchle vyhľadávanie
        const membersMap = new Map();
        allMembers.forEach((member, index) => {
            const key = `${member.type}_${member.originalIndex}_${member.userId}`;
            membersMap.set(key, member);
        });

        if (statsUnsubscribe) {
            try {
                statsUnsubscribe();
            } catch (e) {}
            setStatsUnsubscribe(null);
        }

        const matchesRef = collection(window.db, 'matches');
        const matchesQuery = query(matchesRef);

        let matchIds = new Set();
        let isFirstLoad = true;

        const setupEventsListener = (matchIdsArray) => {
            console.log('[Stats] Nastavujem listener na udalosti, počet zápasov:', matchIdsArray.length);
            
            if (statsUnsubscribe) {
                try {
                    statsUnsubscribe();
                } catch (e) {}
                setStatsUnsubscribe(null);
            }

            if (matchIdsArray.length === 0) {
                console.log('[Stats] Žiadne zápasy, vymazávam štatistiky');
                const emptyStats = {};
                allMembers.forEach((member, index) => {
                    const key = `${member.type}_${member.originalIndex}_${member.userId}`;
                    emptyStats[key] = {
                        goals: 0,
                        convertedPenalties: 0,
                        missedPenalties: 0,
                        yellowCards: 0,
                        redCards: 0,
                        blueCards: 0,
                        exclusions: 0,
                        name: `${member.firstName} ${member.lastName}`.trim(),
                        jerseyNumber: member.jerseyNumber || '',
                        memberType: member.type,
                        teamName: member.teamName,
                        categoryName: member.categoryName,
                        userId: member.userId
                    };
                });
                setMembersStats(emptyStats);
                setIsLoadingStats(false);
                return;
            }

            const chunkSize = 10;
            const chunks = [];
            for (let i = 0; i < matchIdsArray.length; i += chunkSize) {
                chunks.push(matchIdsArray.slice(i, i + chunkSize));
            }
            console.log(`[Stats] Rozdelené do ${chunks.length} chunkov`);

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
                    console.log(`[Stats] 📦 chunk ${index + 1}: prijatých ${eventsSnapshot.size} udalostí`);
                    
                    const chunkStats = calculateStatsFromEvents(eventsSnapshot, membersMap);
                    
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
                                name: stat.name,
                                jerseyNumber: stat.jerseyNumber,
                                memberType: stat.memberType,
                                teamName: stat.teamName,
                                categoryName: stat.categoryName,
                                userId: stat.userId
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
                        console.log('[Stats] ✅ Všetky chunk-y spracované, aktualizujem štatistiky');
                        
                        const finalStats = {};
                        allMembers.forEach((member) => {
                            const key = `${member.type}_${member.originalIndex}_${member.userId}`;
                            if (combinedStats[key]) {
                                finalStats[key] = combinedStats[key];
                            } else {
                                finalStats[key] = {
                                    goals: 0,
                                    convertedPenalties: 0,
                                    missedPenalties: 0,
                                    yellowCards: 0,
                                    redCards: 0,
                                    blueCards: 0,
                                    exclusions: 0,
                                    name: `${member.firstName} ${member.lastName}`.trim(),
                                    jerseyNumber: member.jerseyNumber || '',
                                    memberType: member.type,
                                    teamName: member.teamName,
                                    categoryName: member.categoryName,
                                    userId: member.userId
                                };
                            }
                        });
                        
                        setMembersStats(finalStats);
                        setIsLoadingStats(false);
                        processedChunks = 0;
                        
                        Object.keys(combinedStats).forEach(key => delete combinedStats[key]);
                    }
                }, (error) => {
                    console.error(`[Stats] ❌ Chyba pri načítaní udalostí pre chunk ${index + 1}:`, error);
                    processedChunks++;
                    if (processedChunks === chunks.length) {
                        console.log('[Stats] Všetky chunk-y spracované (s chybami)');
                        setIsLoadingStats(false);
                        processedChunks = 0;
                    }
                });

                listeners.push(listener);
            });

            const unsubscribeAll = () => {
                console.log('[Stats] Ruším všetky listenery na udalosti');
                listeners.forEach(listener => {
                    try {
                        listener();
                    } catch (e) {}
                });
            };
            setStatsUnsubscribe(() => unsubscribeAll);
        };

        const unsubscribeMatches = onSnapshot(matchesQuery, (matchesSnapshot) => {
            const newMatchIds = new Set();
            
            console.log('[Stats] Načítavam zápasy, počet:', matchesSnapshot.size);
            
            const teamNamesSet = new Set();
            allMembers.forEach(member => {
                teamNamesSet.add(member.teamName);
            });
            
            matchesSnapshot.forEach(doc => {
                const matchData = doc.data();
                
                const homeTeam = convertIdentifierToDisplayName(matchData.homeTeamIdentifier);
                const awayTeam = convertIdentifierToDisplayName(matchData.awayTeamIdentifier);
                
                if (teamNamesSet.has(homeTeam) || teamNamesSet.has(awayTeam)) {
                    newMatchIds.add(doc.id);
                }
            });
            
            const newMatchIdsArray = Array.from(newMatchIds);
            const oldMatchIdsArray = Array.from(matchIds);
            const matchIdsChanged = newMatchIdsArray.length !== oldMatchIdsArray.length || 
                                   newMatchIdsArray.some(id => !oldMatchIdsArray.includes(id));
            
            console.log('[Stats] Nájdených zápasov pre tímy:', newMatchIdsArray.length);
            
            if (matchIdsChanged || isFirstLoad) {
                matchIds = newMatchIds;
                isFirstLoad = false;
                setupEventsListener(newMatchIdsArray);
            }
        }, (error) => {
            console.error('[Stats] ❌ Chyba pri načítaní zápasov:', error);
            setIsLoadingStats(false);
        });

        return () => {
            console.log('[Stats] 🧹 CLEANUP - ruším všetky listenery');
            if (unsubscribeMatches) {
                try {
                    unsubscribeMatches();
                } catch (e) {}
            }
            if (statsUnsubscribe) {
                try {
                    statsUnsubscribe();
                } catch (e) {}
                setStatsUnsubscribe(null);
            }
        };
    }, [allMembers]);

    // Načítanie všetkých členov
    useEffect(() => {
        console.log('[TeamsOverviewApp] Spúšťam načítanie všetkých členov');
        
        if (allMembersUnsubscribe) {
            try {
                allMembersUnsubscribe();
            } catch (e) {}
            setAllMembersUnsubscribe(null);
        }
        
        setIsLoading(true);
        
        try {
            const unsubscribe = loadAllTeamMembers((members) => {
                console.log('[TeamsOverviewApp] Načítaných', members.length, 'členov');
                setAllMembers(members);
                setIsLoading(false);
            });
            setAllMembersUnsubscribe(() => unsubscribe);
        } catch (error) {
            console.error('[TeamsOverviewApp] Chyba pri načítaní:', error);
            setIsLoading(false);
            setAllMembers([]);
        }
        
        return () => {
            if (allMembersUnsubscribe) {
                try {
                    allMembersUnsubscribe();
                } catch (e) {}
                setAllMembersUnsubscribe(null);
            }
        };
    }, []);

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

    // Render tabuľky všetkých členov
    const renderAllMembersTable = () => {
        if (!isRostersVisible) {
            return React.createElement(
                'div',
                { className: 'bg-white rounded-xl shadow-xl p-8 text-center' },
                React.createElement(
                    'p',
                    { className: 'text-gray-500 text-lg' },
                    'Súpisky sú momentálne skryté.'
                )
            );
        }

        if (isLoading || isLoadingStats) {
            return React.createElement(
                'div',
                { className: 'bg-white rounded-xl shadow-xl p-8' },
                React.createElement(
                    'div',
                    { className: 'text-center text-gray-500 py-8' },
                    React.createElement('div', { className: 'animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mx-auto' }),
                    React.createElement('p', { className: 'text-sm mt-4' }, 
                        isLoading ? 'Načítavam všetkých členov...' : 'Načítavam štatistiky...'
                    )
                )
            );
        }
        
        if (!allMembers || allMembers.length === 0) {
            return React.createElement(
                'div',
                { className: 'bg-white rounded-xl shadow-xl p-8' },
                React.createElement(
                    'h2',
                    { className: 'text-xl font-semibold text-gray-700 mb-2' },
                    'Všetci členovia tímov'
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-500' },
                    'Momentálne nie sú žiadni členovia v žiadnom tíme.'
                )
            );
        }
        
        const getMemberStats = (member) => {
            const key = `${member.type}_${member.originalIndex}_${member.userId}`;
            const stats = membersStats[key];
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
            { 
                className: 'bg-white rounded-xl shadow-xl p-6 overflow-hidden',
                ref: tableContainerRef
            },
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mb-4' },
                React.createElement(
                    'h2',
                    { className: 'text-xl font-semibold text-gray-700' },
                    'Všetci členovia tímov'
                ),
                React.createElement(
                    'span',
                    { className: 'text-sm text-gray-500' },
                    `Celkom: ${allMembers.length} členov`
                )
            ),
            React.createElement(
                'div',
                { 
                    className: 'overflow-x-auto overflow-y-auto',
                    style: { maxHeight: maxTableHeight }
                },
                React.createElement(
                    'table',
                    { className: 'w-full border-collapse text-sm' },
                    React.createElement(
                        'thead',
                        { className: 'bg-gray-100 sticky top-0 z-10' },
                        React.createElement(
                            'tr',
                            { className: 'border-b border-gray-200' },
                            React.createElement('th', { className: 'px-3 py-2 text-left text-xs font-medium text-gray-500', style: { width: '35px' } }, ''),
                            React.createElement('th', { className: 'px-3 py-2 text-left text-xs font-medium text-gray-500', style: { width: '50px' } }, 'Č.'),
                            React.createElement('th', { className: 'px-3 py-2 text-left text-xs font-medium text-gray-500', style: { minWidth: '150px' } }, 'Meno a priezvisko'),
                            React.createElement('th', { className: 'px-3 py-2 text-left text-xs font-medium text-gray-500', style: { minWidth: '120px' } }, 'Kategória'),
                            React.createElement('th', { className: 'px-3 py-2 text-left text-xs font-medium text-gray-500', style: { minWidth: '150px' } }, 'Tím'),
                            React.createElement('th', { className: 'px-3 py-2 text-center text-xs font-medium text-gray-500', style: { width: '50px' } }, 
                                React.createElement('div', { className: 'flex flex-col items-center' },
                                    React.createElement('i', { className: 'fa-solid fa-futbol text-green-600 text-sm' }),
                                    React.createElement('span', { className: 'text-xs mt-0.5' }, 'G')
                                )
                            ),
                            React.createElement('th', { className: 'px-3 py-2 text-center text-xs font-medium text-gray-500', style: { width: '60px' } }, 
                                React.createElement('div', { className: 'flex flex-col items-center' },
                                    React.createElement('i', { className: 'fa-solid fa-futbol text-teal-500 text-sm' }),
                                    React.createElement('span', { className: 'text-xs mt-0.5' }, '7m')
                                )
                            ),
                            React.createElement('th', { className: 'px-3 py-2 text-center text-xs font-medium text-gray-500', style: { width: '50px' } }, 
                                React.createElement('div', { className: 'flex flex-col items-center' },
                                    React.createElement('i', { className: 'fa-solid fa-square text-yellow-500 text-sm' }),
                                    React.createElement('span', { className: 'text-xs mt-0.5' }, 'ŽK')
                                )
                            ),
                            React.createElement('th', { className: 'px-3 py-2 text-center text-xs font-medium text-gray-500', style: { width: '50px' } }, 
                                React.createElement('div', { className: 'flex flex-col items-center' },
                                    React.createElement('i', { className: 'fa-solid fa-square text-red-600 text-sm' }),
                                    React.createElement('span', { className: 'text-xs mt-0.5' }, 'ČK')
                                )
                            ),
                            React.createElement('th', { className: 'px-3 py-2 text-center text-xs font-medium text-gray-500', style: { width: '50px' } }, 
                                React.createElement('div', { className: 'flex flex-col items-center' },
                                    React.createElement('i', { className: 'fa-solid fa-square text-blue-500 text-sm' }),
                                    React.createElement('span', { className: 'text-xs mt-0.5' }, 'MK')
                                )
                            ),
                            React.createElement('th', { className: 'px-3 py-2 text-center text-xs font-medium text-gray-500', style: { width: '60px' } }, 
                                React.createElement('div', { className: 'flex flex-col items-center' },
                                    React.createElement('i', { className: 'fa-solid fa-clock text-orange-500 text-sm' }),
                                    React.createElement('span', { className: 'text-xs mt-0.5' }, 'Vyl.')
                                )
                            )
                        )
                    ),
                    React.createElement(
                        'tbody',
                        { className: 'divide-y divide-gray-100' },
                        allMembers.map((member, index) => {
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
                                    key: `${member.type}_${member.originalIndex}_${member.userId}_${index}`,
                                    className: `${rowClass} transition-colors cursor-default`
                                },
                                React.createElement('td', { className: 'px-3 py-2 text-center' }, memberIcon),
                                React.createElement('td', { className: 'px-3 py-2 font-mono font-medium text-gray-700 text-center' }, member.jerseyNumber || ''),
                                React.createElement('td', { className: 'px-3 py-2 text-gray-800 whitespace-nowrap' }, fullName),
                                React.createElement('td', { className: 'px-3 py-2 text-gray-600 text-sm' }, member.categoryName || ''),
                                React.createElement('td', { className: 'px-3 py-2 text-gray-600 text-sm' }, member.teamName || ''),
                                React.createElement('td', { className: 'px-3 py-2 text-center font-bold text-green-600' }, stats.goals > 0 ? stats.goals : ''),
                                React.createElement('td', { className: 'px-3 py-2 text-center font-medium text-teal-600' }, penaltiesDisplay),
                                React.createElement('td', { className: 'px-3 py-2 text-center font-bold text-yellow-600' }, stats.yellowCards > 0 ? stats.yellowCards : ''),
                                React.createElement('td', { className: 'px-3 py-2 text-center font-bold text-red-600' }, stats.redCards > 0 ? stats.redCards : ''),
                                React.createElement('td', { className: 'px-3 py-2 text-center font-bold text-blue-600' }, stats.blueCards > 0 ? stats.blueCards : ''),
                                React.createElement('td', { className: 'px-3 py-2 text-center font-bold text-orange-600' }, stats.exclusions > 0 ? stats.exclusions : '')
                            );
                        })
                    )
                )
            ),
            React.createElement(
                'div',
                { className: 'mt-4 pt-3 border-t border-gray-200 text-xs text-gray-400' },
                `Celkový počet členov: ${allMembers.length}`
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
                'Prehľad všetkých členov tímov'
            ),
            React.createElement(
                'p',
                { className: 'text-center text-gray-500 mt-1' },
                'Kompletný zoznam všetkých hráčov a členov realizačných tímov v systéme'
            )
        ),
        renderAllMembersTable()
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
