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

// Všeobecná debugovacia funkcia pre zápasy
const debugMatches = async () => {
    if (!window.db) {
        console.log('❌ window.db nie je dostupné');
        return;
    }
    
    if (!window.teamManager || typeof window.teamManager.getTeamNameByDisplayIdSync !== 'function') {
        console.log('⚠️ window.teamManager.getTeamNameByDisplayIdSync nie je dostupný');
    } else {
        console.log('✅ window.teamManager.getTeamNameByDisplayIdSync je dostupný');
    }
    
    try {
        console.log('🔍 DEBUG: Načítavam všetky zápasy z databázy...');
        const matchesRef = collection(window.db, 'matches');
        const querySnapshot = await getDocs(matchesRef);
        
        console.log(`📊 Celkový počet zápasov: ${querySnapshot.size}`);
        
        if (querySnapshot.size === 0) {
            console.log('ℹ️ V databáze nie sú žiadne zápasy');
            return;
        }
        
        console.log('📋 Zoznam všetkých zápasov (s konvertovanými názvami tímov):');
        console.log('─────────────────────────────────────────────────────────────');
        
        querySnapshot.forEach((doc, index) => {
            const match = doc.data();
            
            let homeTeamDisplay = match.homeTeamIdentifier || 'N/A';
            let awayTeamDisplay = match.awayTeamIdentifier || 'N/A';
            
            if (window.teamManager && typeof window.teamManager.getTeamNameByDisplayIdSync === 'function') {
                try {
                    if (match.homeTeamIdentifier) {
                        const convertedHome = window.teamManager.getTeamNameByDisplayIdSync(match.homeTeamIdentifier);
                        if (convertedHome && convertedHome !== match.homeTeamIdentifier) {
                            homeTeamDisplay = `${match.homeTeamIdentifier} -> ${convertedHome}`;
                        } else {
                            homeTeamDisplay = match.homeTeamIdentifier;
                        }
                    }
                } catch (err) {
                    console.log(`   ⚠️ Chyba pri konverzii domáceho tímu "${match.homeTeamIdentifier}":`, err);
                }
                
                try {
                    if (match.awayTeamIdentifier) {
                        const convertedAway = window.teamManager.getTeamNameByDisplayIdSync(match.awayTeamIdentifier);
                        if (convertedAway && convertedAway !== match.awayTeamIdentifier) {
                            awayTeamDisplay = `${match.awayTeamIdentifier} -> ${convertedAway}`;
                        } else {
                            awayTeamDisplay = match.awayTeamIdentifier;
                        }
                    }
                } catch (err) {
                    console.log(`   ⚠️ Chyba pri konverzii hosťujúceho tímu "${match.awayTeamIdentifier}":`, err);
                }
            }
            
            console.log(`📄 Zápas #${index + 1}`);
            console.log(`   ID: ${doc.id}`);
            console.log(`   Domáci (homeTeamIdentifier): ${homeTeamDisplay}`);
            console.log(`   Hostia (awayTeamIdentifier): ${awayTeamDisplay}`);
            console.log(`   Kategória: ${match.categoryName || match.categoryId || 'N/A'}`);
            console.log(`   Stav: ${match.status || 'N/A'}`);
            console.log(`   Dáta:`, match);
            console.log('─────────────────────────────────────────────────────────────');
        });
        
        console.log('🔍 Hľadám zápasy s tímom...');
        let found = false;
        const searchTeamName = window.debugSearchTeamName || '';
        
        if (searchTeamName) {
            querySnapshot.forEach((doc) => {
                const match = doc.data();
                let homeConverted = match.homeTeamIdentifier;
                let awayConverted = match.awayTeamIdentifier;
                
                if (window.teamManager && typeof window.teamManager.getTeamNameByDisplayIdSync === 'function') {
                    try {
                        if (match.homeTeamIdentifier) {
                            const converted = window.teamManager.getTeamNameByDisplayIdSync(match.homeTeamIdentifier);
                            if (converted) homeConverted = converted;
                        }
                    } catch (e) {}
                    try {
                        if (match.awayTeamIdentifier) {
                            const converted = window.teamManager.getTeamNameByDisplayIdSync(match.awayTeamIdentifier);
                            if (converted) awayConverted = converted;
                        }
                    } catch (e) {}
                }
                
                if (homeConverted === searchTeamName || awayConverted === searchTeamName) {
                    console.log(`✅ Nájdený zápas: ${homeConverted} vs ${awayConverted}`);
                    found = true;
                }
            });
            
            if (!found) {
                console.log(`❌ Žiadny zápas s tímom "${searchTeamName}" nebol nájdený.`);
                console.log('💡 Skúste hľadať pod iným názvom (napr. bez sufixu)');
                
                console.log('🔍 Hľadám podobné názvy (po konverzii)...');
                querySnapshot.forEach((doc) => {
                    const match = doc.data();
                    let homeConverted = match.homeTeamIdentifier || '';
                    let awayConverted = match.awayTeamIdentifier || '';
                    
                    if (window.teamManager && typeof window.teamManager.getTeamNameByDisplayIdSync === 'function') {
                        try {
                            if (match.homeTeamIdentifier) {
                                const converted = window.teamManager.getTeamNameByDisplayIdSync(match.homeTeamIdentifier);
                                if (converted) homeConverted = converted;
                            }
                        } catch (e) {}
                        try {
                            if (match.awayTeamIdentifier) {
                                const converted = window.teamManager.getTeamNameByDisplayIdSync(match.awayTeamIdentifier);
                                if (converted) awayConverted = converted;
                            }
                        } catch (e) {}
                    }
                    
                    if (homeConverted.includes(searchTeamName) || awayConverted.includes(searchTeamName)) {
                        console.log(`   Nájdený podobný zápas: ${homeConverted} vs ${awayConverted}`);
                    }
                });
            }
        } else {
            console.log('ℹ️ Nastavte window.debugSearchTeamName pre vyhľadávanie konkrétneho tímu');
        }
        
        console.log('✅ DEBUG dokončený');
        
    } catch (error) {
        console.error('❌ Chyba pri debugovaní:', error);
    }
};

setTimeout(() => {
    debugMatches();
}, 3000);

window.debugMatches = debugMatches;

const debugMatchEvents = async () => {
    if (!window.db) {
        console.log('❌ window.db nie je dostupné');
        return;
    }
    
    try {
        console.log('🔍 DEBUG: Načítavam všetky udalosti z kolekcie matchEvents...');
        const eventsRef = collection(window.db, 'matchEvents');
        const querySnapshot = await getDocs(eventsRef);
        
        console.log(`📊 Celkový počet udalostí: ${querySnapshot.size}`);
        
        if (querySnapshot.size === 0) {
            console.log('ℹ️ Kolekcia matchEvents je prázdna');
            return;
        }
        
        console.log('📋 Zoznam všetkých udalostí:');
        console.log('─────────────────────────────────────────────────────────────');
        
        querySnapshot.forEach((doc, index) => {
            const event = doc.data();
            console.log(`📄 Udalosť #${index + 1}`);
            console.log(`   ID: ${doc.id}`);
            console.log(`   matchId: ${event.matchId || 'N/A'}`);
            console.log(`   eventType: ${event.eventType || 'N/A'}`);
            console.log(`   eventSubtype: ${event.eventSubtype || 'N/A'}`);
            console.log(`   team: ${event.team || 'N/A'}`);
            console.log(`   memberType: ${event.memberType || 'N/A'}`);
            console.log(`   memberTypeKey: ${event.memberTypeKey || 'N/A'}`);
            console.log(`   memberIndex: ${event.memberIndex !== undefined ? event.memberIndex : 'N/A'}`);
            console.log(`   userId: ${event.userId || 'N/A'}`);
            console.log(`   totalTime: ${event.totalTime !== undefined ? event.totalTime : 'N/A'}`);
            console.log(`   periodTime: ${event.periodTime !== undefined ? event.periodTime : 'N/A'}`);
            console.log(`   period: ${event.period || 'N/A'}`);
            console.log(`   categoryName: ${event.categoryName || 'N/A'}`);
            console.log(`   Dáta:`, event);
            console.log('─────────────────────────────────────────────────────────────');
        });
        
        const eventTypes = {};
        const eventSubtypes = {};
        const teamTypes = {};
        
        querySnapshot.forEach((doc) => {
            const event = doc.data();
            const type = event.eventType || 'unknown';
            eventTypes[type] = (eventTypes[type] || 0) + 1;
            
            if (event.eventSubtype) {
                const subtype = event.eventSubtype;
                eventSubtypes[subtype] = (eventSubtypes[subtype] || 0) + 1;
            }
            
            if (event.team) {
                const team = event.team;
                teamTypes[team] = (teamTypes[team] || 0) + 1;
            }
        });
        
        console.log('📊 Štatistika typov udalostí:');
        Object.entries(eventTypes).forEach(([type, count]) => {
            console.log(`   ${type}: ${count}`);
        });
        
        if (Object.keys(eventSubtypes).length > 0) {
            console.log('📊 Štatistika podtypov udalostí:');
            Object.entries(eventSubtypes).forEach(([subtype, count]) => {
                console.log(`   ${subtype}: ${count}`);
            });
        }
        
        if (Object.keys(teamTypes).length > 0) {
            console.log('📊 Štatistika tímov:');
            Object.entries(teamTypes).forEach(([team, count]) => {
                console.log(`   ${team}: ${count}`);
            });
        }
        
        console.log('✅ DEBUG udalostí dokončený');
        
    } catch (error) {
        console.error('❌ Chyba pri debugovaní udalostí:', error);
    }
};

setTimeout(() => {
    debugMatchEvents();
}, 4000);

window.debugMatchEvents = debugMatchEvents;

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

    const TOP_OFFSET = '0px'; 

    const convertIdentifierToDisplayName = (identifier) => {
        if (!identifier) return identifier;
        
        if (window.teamManager && typeof window.teamManager.getTeamNameByDisplayIdSync === 'function') {
            try {
                const convertedName = window.teamManager.getTeamNameByDisplayIdSync(identifier);
                if (convertedName && convertedName !== identifier) {
                    console.log(`[Stats Effect] 🔄 Konverzia: "${identifier}" -> "${convertedName}"`);
                    return convertedName;
                }
            } catch (err) {
                console.log(`[Stats Effect] ⚠️ Chyba pri konverzii "${identifier}":`, err);
            }
        }
        return identifier;
    };

    useEffect(() => {
        if (!window.db) return;

        console.log('🔄 [UI Updater] Nastavujem listener na matchEvents pre aktualizáciu UI...');
        
        const eventsRef = collection(window.db, 'matchEvents');
        const eventsQuery = query(eventsRef);
        
        const unsubscribe = onSnapshot(eventsQuery, (snapshot) => {
            console.log(`🔄 [UI Updater] Zmena v matchEvents: ${snapshot.size} udalostí`);
            
            if (selectedTeamDetails && teamRoster.length > 0) {
                console.log('🔄 [UI Updater] Aktualizujem UI po zmene v matchEvents');
                setUpdateTrigger(prev => prev + 1);
            } else {
                console.log('🔄 [UI Updater] Žiadny otvorený detail tímu, UI sa neaktualizuje');
            }
        }, (error) => {
            console.error('❌ [UI Updater] Chyba pri počúvaní matchEvents:', error);
        });

        return () => {
            console.log('🔄 [UI Updater] Ruším listener na matchEvents');
            if (unsubscribe) unsubscribe();
        };
    }, [selectedTeamDetails, teamRoster]);

    useEffect(() => {
        console.log('[Stats Effect] Spúšťam useEffect pre štatistiky');
        console.log('[Stats Effect] teamRoster length:', teamRoster?.length || 0);
        console.log('[Stats Effect] rosterTeamName:', rosterTeamName);
        console.log('[Stats Effect] rosterCategoryName:', rosterCategoryName);
        console.log('[Stats Effect] updateTrigger:', updateTrigger);
    
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
    
        const matchesRef = collection(window.db, 'matches');
        const matchesQuery = query(matchesRef);
    
        let matchIds = new Set();
        let isFirstLoad = true;
    
        const getBaseTeamName = (teamName) => {
            if (!teamName) return teamName;
            const parts = teamName.trim().split(' ');
            if (parts.length >= 2) {
                const lastPart = parts[parts.length - 1];
                if (lastPart.length === 1 && /[A-ZÁÄČĎÉÍĽĹŇÓÔŘŠŤÚÝŽa-záäčďéíĺľňóôřšťúýž]/.test(lastPart)) {
                    return parts.slice(0, -1).join(' ');
                }
            }
            return teamName;
        };
    
        const calculateStatsFromEvents = (eventsSnapshot, chunkIndex) => {
            console.log(`[Stats Effect] 📦 chunk ${chunkIndex}: spracúvam ${eventsSnapshot.size} udalostí`);
            
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
                    memberType: member.type,
                    teamName: member.teamName,
                    categoryName: member.categoryName
                };
            });
        
            eventsSnapshot.forEach((doc) => {
                const eventData = doc.data();
                const matchId = eventData.matchId;
                
                console.log(`[Stats Effect] 📄 Udalosť:`, {
                    id: doc.id,
                    matchId: matchId,
                    eventType: eventData.eventType,
                    eventSubtype: eventData.eventSubtype,
                    memberTypeKey: eventData.memberTypeKey,
                    memberIndex: eventData.memberIndex,
                    team: eventData.team,
                    categoryName: eventData.categoryName
                });
                
                if (eventData.categoryName && eventData.categoryName !== currentCategoryName) {
                    console.log(`[Stats Effect] ⏭️ Preskakujem udalosť - kategória sa nezhoduje: udalosť=${eventData.categoryName}, tím=${currentCategoryName}`);
                    return;
                }
                
                const matchInfo = matchTeamMap[matchId];
                if (!matchInfo) {
                    console.log(`[Stats Effect] ⚠️ Nenašli sa informácie o zápase ${matchId}`);
                    return;
                }
                
                let isOurTeam = false;
                if (eventData.team === 'home' && matchInfo.homeTeam === currentTeamName) {
                    isOurTeam = true;
                    console.log(`[Stats Effect] ✅ Udalosť patrí nášmu tímu ako DOMÁCI`);
                } else if (eventData.team === 'away' && matchInfo.awayTeam === currentTeamName) {
                    isOurTeam = true;
                    console.log(`[Stats Effect] ✅ Udalosť patrí nášmu tímu ako HOSŤ`);
                } else {
                    console.log(`[Stats Effect] ⏭️ Preskakujem udalosť - nepatrí nášmu tímu (team=${eventData.team}, matchInfo: home=${matchInfo.homeTeam}, away=${matchInfo.awayTeam})`);
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
                    console.log(`[Stats Effect] ⚠️ Nenašiel sa člen pre udalosť: memberTypeKey=${eventData.memberTypeKey}, memberIndex=${eventData.memberIndex}`);
                    return;
                }
                
                const stat = stats[foundMemberKey];
                console.log(`[Stats Effect] ✅ Priradené k členovi: ${stat.name} (${foundMemberKey}) v kategórii ${currentCategoryName}`);
                
                switch (eventData.eventType) {
                    case 'goal':
                        stat.goals++;
                        console.log(`[Stats Effect] ⚽ Gól pre ${stat.name} (celkom: ${stat.goals})`);
                        if (eventData.eventSubtype === 'converted_penalty') {
                            stat.convertedPenalties++;
                        }
                        break;
                    case 'penalty':
                        stat.missedPenalties++;
                        console.log(`[Stats Effect] ❌ Nepremenená 7m pre ${stat.name}`);
                        break;
                    case 'card':
                        if (eventData.eventSubtype === 'yellow') {
                            stat.yellowCards++;
                            console.log(`[Stats Effect] 🟨 ŽK pre ${stat.name} (celkom: ${stat.yellowCards})`);
                        } else if (eventData.eventSubtype === 'red') {
                            stat.redCards++;
                            console.log(`[Stats Effect] 🟥 ČK pre ${stat.name} (celkom: ${stat.redCards})`);
                        } else if (eventData.eventSubtype === 'blue') {
                            stat.blueCards++;
                            console.log(`[Stats Effect] 🟦 MK pre ${stat.name} (celkom: ${stat.blueCards})`);
                        }
                        break;
                    case 'exclusion':
                        stat.exclusions++;
                        console.log(`[Stats Effect] ⏱️ Vylúčenie pre ${stat.name} (celkom: ${stat.exclusions})`);
                        break;
                }
            });
        
            console.log(`[Stats Effect] 📊 Spracovaných udalostí pre chunk ${chunkIndex}: ${eventsSnapshot.size}`);
            console.log(`[Stats Effect] 📊 Počet členov so štatistikami: ${Object.keys(stats).length}`);
        
            return stats;
        };
    
        let eventsUnsubscribe = null;
    
        const setupEventsListener = (matchIdsArray) => {
            console.log('[Stats Effect] setupEventsListener - matchIds:', matchIdsArray);
            
            if (eventsUnsubscribe) {
                console.log('[Stats Effect] Ruším predchádzajúci listener na udalosti');
                try {
                    eventsUnsubscribe();
                } catch (e) {}
                eventsUnsubscribe = null;
            }
    
            if (matchIdsArray.length === 0) {
                console.log('[Stats Effect] Žiadne zápasy pre tím, vymazávam štatistiky');
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
                setMembersStats(emptyStats);
                return;
            }
    
            const chunkSize = 10;
            const chunks = [];
            for (let i = 0; i < matchIdsArray.length; i += chunkSize) {
                chunks.push(matchIdsArray.slice(i, i + chunkSize));
            }
            console.log(`[Stats Effect] Rozdelené do ${chunks.length} chunkov`);
    
            const listeners = [];
            let processedChunks = 0;
            const combinedStats = {};
    
            chunks.forEach((chunk, index) => {
                console.log(`[Stats Effect] Vytváram listener pre chunk ${index + 1}:`, chunk);
                
                const eventsRef = collection(window.db, 'matchEvents');
                const eventsQuery = query(
                    eventsRef,
                    where('matchId', 'in', chunk)
                );
    
                const listener = onSnapshot(eventsQuery, (eventsSnapshot) => {
                    console.log(`[Stats Effect] 📦 chunk ${index + 1}: prijatých ${eventsSnapshot.size} udalostí`);
                    
                    const chunkStats = calculateStatsFromEvents(eventsSnapshot, index + 1);
                    
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
                        console.log('[Stats Effect] ✅ Všetky chunk-y spracované, aktualizujem štatistiky');
                        console.log('[Stats Effect] 📊 Výsledné štatistiky:', combinedStats);
                        
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
                        setMembersStats(finalStats);
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
                        console.log('[Stats Effect] Všetky chunk-y spracované (s chybami)');
                        processedChunks = 0;
                    }
                });
    
                listeners.push(listener);
            });
    
            eventsUnsubscribe = () => {
                console.log('[Stats Effect] Ruším všetky listenery na udalosti');
                listeners.forEach(listener => {
                    try {
                        listener();
                    } catch (e) {}
                });
            };
        };
    
        let unsubscribeMatches = null;
        let matchTeamMap = {};
    
        const processMatches = (matchesSnapshot) => {
            const newMatchIds = new Set();
            const newMatchTeamMap = {};
            
            console.log('[Stats Effect] 📦 Všetky zápasy - počet:', matchesSnapshot.size);
            
            const fullTeamName = currentTeamName;
            console.log('[Stats Effect] Celý názov tímu (vrátane sufixu):', fullTeamName);
            
            matchesSnapshot.forEach(doc => {
                const matchData = doc.data();
                const matchId = doc.id;
                
                const convertedHome = convertIdentifierToDisplayName(matchData.homeTeamIdentifier);
                const convertedAway = convertIdentifierToDisplayName(matchData.awayTeamIdentifier);
                
                newMatchTeamMap[matchId] = {
                    homeTeam: convertedHome,
                    awayTeam: convertedAway
                };
                
                if (convertedHome === fullTeamName || convertedAway === fullTeamName) {
                    console.log(`[Stats Effect]   ✅ Nájdený zápas pre "${fullTeamName}": ${matchId} - ${convertedHome} vs ${convertedAway}`);
                    newMatchIds.add(matchId);
                }
            });
        
            matchTeamMap = newMatchTeamMap;
        
            const newMatchIdsArray = Array.from(newMatchIds);
            const oldMatchIdsArray = Array.from(matchIds);
            const matchIdsChanged = newMatchIdsArray.length !== oldMatchIdsArray.length || 
                                   newMatchIdsArray.some(id => !oldMatchIdsArray.includes(id));
        
            console.log('[Stats Effect] Celkovo nájdených zápasov pre tím:', newMatchIdsArray.length);
            console.log('[Stats Effect] matchIdsChanged:', matchIdsChanged);
        
            if (matchIdsChanged || isFirstLoad) {
                matchIds = newMatchIds;
                isFirstLoad = false;
                setupEventsListener(newMatchIdsArray);
            }
        
            console.log('[Stats Effect] 📋 Všetky matchId pre tím:', Array.from(matchIds));
        };
    
        console.log('[Stats Effect] ✅ Spúšťam listener na všetky zápasy');
        unsubscribeMatches = onSnapshot(matchesQuery, (matchesSnapshot) => {
            processMatches(matchesSnapshot);
        }, (error) => {
            console.error('[Stats Effect] ❌ Chyba pri načítaní zápasov:', error);
        });
    
        return () => {
            console.log('[Stats Effect] 🧹 CLEANUP - ruším všetky listenery');
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
            console.log('[Stats Effect] 🧹 CLEANUP dokončený');
        };
    }, [teamRoster, rosterTeamName, rosterCategoryName, selectedTeamDetails, updateTrigger]);
    
    // Funkcia na načítanie súpisky tímu pomocou loadTeamMembers
    const loadTeamRoster = (teamName, categoryName) => {
        console.log('[loadTeamRoster] Volaná s teamName:', teamName, 'categoryName:', categoryName);
        
        if (rosterUnsubscribe) {
            console.log('[loadTeamRoster] Ruším predchádzajúci listener');
            try {
                rosterUnsubscribe();
            } catch (e) {
            }
            setRosterUnsubscribe(null);
        }
        
        if (!teamName || !categoryName) {
            console.log('[loadTeamRoster] Chýba teamName alebo categoryName - vymazávam');
            setTeamRoster([]);
            setIsLoadingRoster(false);
            setRosterTeamName('');
            setRosterCategoryName('');
            setMembersStats({});
            return;
        }        
        
        console.log('[loadTeamRoster] Nastavujem loading, teamName:', teamName, 'categoryName:', categoryName);
        setIsLoadingRoster(true);
        
        setRosterTeamName(teamName);
        setRosterCategoryName(categoryName);
        
        const handleMembersUpdate = (members) => {
            console.log('[loadTeamRoster] handleMembersUpdate - načítaných', members.length, 'členov');
            setTeamRoster(members);
            setIsLoadingRoster(false);
        };
        
        const handleMappedName = (mappedName) => {
            console.log('[loadTeamRoster] handleMappedName:', mappedName);
        };
        
        try {
            const unsubscribe = loadTeamMembers(teamName, categoryName, handleMembersUpdate, handleMappedName);
            setRosterUnsubscribe(() => unsubscribe);
        } catch (error) {
            console.error('[loadTeamRoster] Chyba pri načítaní:', error);
            setIsLoadingRoster(false);
            setTeamRoster([]);
            setMembersStats({});
        }
        
        const timeoutId = setTimeout(() => {
            console.log('[loadTeamRoster] Timeout - ukončujem loading');
            setIsLoadingRoster(false);
        }, 10000);
        
        window.__rosterTimeoutId = timeoutId;
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
        };
    }, []);

    // Načítanie súpisky pri zmene vybraného výskytu
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
                loadTeamRoster(selectedOcc.teamName, categoryName);
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

    // Získanie všetkých unikátnych tímov
    const getAllUniqueTeams = () => {
        const teamsMap = new Map();
        
        allTeams.forEach(team => {
            const cleanName = removeSuffix(team.teamName);
            const key = `${cleanName}_${team.category}`;
            
            if (!teamsMap.has(key)) {
                teamsMap.set(key, {
                    teamName: team.teamName,
                    cleanName: cleanName,
                    category: team.category,
                    occurrences: []
                });
            }
            
            const existing = teamsMap.get(key);
            existing.occurrences.push(team);
        });
        
        return Array.from(teamsMap.values());
    };

    const renderAllTeamRosters = () => {
        if (!isRostersVisible) {
            return React.createElement(
                'div',
                { className: 'text-center py-12 text-gray-500' },
                'Súpisky tímov nie sú momentálne dostupné.'
            );
        }

        const uniqueTeams = getAllUniqueTeams();
        
        if (uniqueTeams.length === 0) {
            return React.createElement(
                'div',
                { className: 'text-center py-16 text-gray-500' },
                'Žiadne tímy neboli nájdené.'
            );
        }

        // Zoradenie tímov podľa názvu
        const sortedTeams = uniqueTeams.sort((a, b) => {
            return slovakCollator.compare(a.cleanName, b.cleanName);
        });

        return React.createElement(
            'div',
            { 
                className: 'w-full overflow-y-auto relative',
                ref: tableContainerRef,
                style: { maxHeight: maxTableHeight }
            },
            React.createElement(
                'div',
                { className: 'space-y-6 p-2' },
                sortedTeams.map((teamGroup, index) => {
                    const teamName = teamGroup.teamName;
                    const cleanName = teamGroup.cleanName;
                    const categoryName = teamGroup.category;
                    
                    // Skontrolujeme, či má tím sufix
                    const hasSuffix = teamName !== cleanName;
                    
                    // Načítame súpisku pre tento tím
                    const [rosterData, setRosterData] = useState([]);
                    const [isLoading, setIsLoading] = useState(false);
                    const [rosterStats, setRosterStats] = useState({});
                    
                    useEffect(() => {
                        let unsubscribe = null;
                        let timeoutId = null;
                        
                        const loadRoster = () => {
                            setIsLoading(true);
                            
                            const handleMembersUpdate = (members) => {
                                setRosterData(members);
                                setIsLoading(false);
                            };
                            
                            try {
                                unsubscribe = loadTeamMembers(teamName, categoryName, handleMembersUpdate);
                            } catch (error) {
                                console.error(`[TeamsOverview] Chyba pri načítaní súpisky pre ${teamName}:`, error);
                                setIsLoading(false);
                                setRosterData([]);
                            }
                            
                            timeoutId = setTimeout(() => {
                                setIsLoading(false);
                            }, 10000);
                        };
                        
                        loadRoster();
                        
                        return () => {
                            if (unsubscribe) {
                                try {
                                    unsubscribe();
                                } catch (e) {}
                            }
                            if (timeoutId) {
                                clearTimeout(timeoutId);
                            }
                        };
                    }, [teamName, categoryName]);

                    // Renderovanie súpisky pre jeden tím
                    const renderSingleTeamRoster = () => {
                        if (isLoading) {
                            return React.createElement(
                                'div',
                                { className: 'text-center text-gray-500 py-4' },
                                React.createElement('div', { className: 'animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400 mx-auto' }),
                                React.createElement('p', { className: 'text-sm mt-2' }, 'Načítavam súpisku...')
                            );
                        }
                        
                        if (!rosterData || rosterData.length === 0) {
                            return React.createElement(
                                'p',
                                { className: 'text-sm text-gray-500 py-2' },
                                'Tento tím nemá žiadnych členov v súpiske.'
                            );
                        }
                        
                        const players = rosterData.filter(m => m.type === 'Hráč').sort((a, b) => {
                            const aNum = parseInt(a.jerseyNumber) || 999;
                            const bNum = parseInt(b.jerseyNumber) || 999;
                            return aNum - bNum;
                        });
                        const rtMembers = rosterData.filter(m => m.type !== 'Hráč');
                        const sortedRoster = [...players, ...rtMembers];
                        
                        return React.createElement(
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
                                        null,
                                        React.createElement('th', { className: 'px-2 py-1.5 text-left text-xs font-medium text-gray-500', style: { width: '30px' } }, ''),
                                        React.createElement('th', { className: 'px-2 py-1.5 text-left text-xs font-medium text-gray-500', style: { width: '35px' } }, 'Č.'),
                                        React.createElement('th', { className: 'px-2 py-1.5 text-left text-xs font-medium text-gray-500' }, 'Meno a priezvisko')
                                    )
                                ),
                                React.createElement(
                                    'tbody',
                                    { className: 'divide-y divide-gray-100' },
                                    sortedRoster.map((member, idx) => {
                                        const fullName = `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Neznámy';
                                        const memberIcon = member.type === 'Hráč' 
                                            ? React.createElement('i', { className: 'fa-solid fa-user text-gray-500 text-xs' })
                                            : (member.type === 'Člen RT (muž)' 
                                                ? React.createElement('i', { className: 'fa-solid fa-user-tie text-blue-500 text-xs' })
                                                : (member.type === 'Člen RT (žena)'
                                                    ? React.createElement('i', { className: 'fa-solid fa-user-tie text-red-500 text-xs' })
                                                    : React.createElement('i', { className: 'fa-solid fa-user text-gray-400 text-xs' })));
                                        
                                        return React.createElement(
                                            'tr',
                                            { 
                                                key: `${member.type}_${member.originalIndex || idx}`,
                                                className: idx % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50 hover:bg-gray-100'
                                            },
                                            React.createElement('td', { className: 'px-2 py-1.5 text-center' }, memberIcon),
                                            React.createElement('td', { className: 'px-2 py-1.5 font-mono font-medium text-gray-700 text-center text-xs' }, member.jerseyNumber || ''),
                                            React.createElement('td', { className: 'px-2 py-1.5 text-gray-800 text-sm' }, fullName)
                                        );
                                    })
                                )
                            )
                        );
                    };

                    return React.createElement(
                        'div',
                        { 
                            key: `${categoryName}_${teamName}_${index}`,
                            className: 'bg-white rounded-lg shadow-md overflow-hidden border border-gray-200'
                        },
                        React.createElement(
                            'div',
                            { 
                                className: 'px-4 py-3 bg-gradient-to-r from-blue-50 to-gray-50 border-b border-gray-200 flex justify-between items-center'
                            },
                            React.createElement(
                                'div',
                                { className: 'flex items-center gap-3' },
                                React.createElement(
                                    'h3',
                                    { className: 'font-semibold text-gray-800' },
                                    cleanName
                                ),
                                hasSuffix && React.createElement(
                                    'span',
                                    { className: 'text-xs text-gray-400' },
                                    `(${teamName})`
                                )
                            ),
                            React.createElement(
                                'span',
                                { className: 'text-xs text-gray-500 bg-white px-2 py-1 rounded-full border border-gray-200' },
                                categoryName
                            )
                        ),
                        React.createElement(
                            'div',
                            { className: 'p-3' },
                            renderSingleTeamRoster()
                        )
                    );
                })
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

    // Hlavný render
    const renderMainContent = () => {
        return React.createElement(
            React.Fragment,
            null,
            renderFilters(),
            React.createElement(
                'div',
                { className: 'bg-white rounded-xl shadow-xl p-4' },
                renderAllTeamRosters()
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
                'Súpisky tímov'
            ),
            React.createElement(
                'p',
                { className: 'text-center text-gray-500 mt-1' },
                'Prehľad všetkých tímov a ich súpisiek'
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
