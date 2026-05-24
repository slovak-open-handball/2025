// logged-in-matches-hall.js
import { collection, getDocs, doc, getDoc, onSnapshot, updateDoc, Timestamp, addDoc, query, where, orderBy, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const { useState, useEffect, useRef } = React;

// Funkcia na formátovanie dátumu a času
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

// Konštanty pre fialové farby (jednotné pre všetky play-off a placement zápasy)
const ELIMINATION_COLORS = {
    backgroundColor: '#F3E8FF',
    textColor: '#6B21A5'
};

// Funkcia na získanie farby kategórie z databázy
const getCategoryDrawColor = (categoryId) => {
    if (!window.categoryDrawColors || !categoryId) return '#3B82F6';
    
    const color = window.categoryDrawColors[categoryId];
    if (color && color !== '#3B82F6') return color;
    
    return '#3B82F6';
};

// Funkcia na vytvorenie svetlejšej verzie farby (80% bledšia)
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

// Funkcia na získanie farieb podľa typu skupiny z databázy
const getGroupTypeColors = (groupName, categoryId, groupsData) => {
    let result = {
        backgroundColor: '#DCFCE7',
        textColor: '#166534'
    };
    
    if (!groupsData || !categoryId) return result;
    
    const categoryGroups = groupsData[categoryId] || [];
    const foundGroup = categoryGroups.find(g => g.name === groupName);
    
    if (foundGroup) {
        if (foundGroup.type === 'nadstavbová skupina') {
            result = {
                backgroundColor: '#DBEAFE',
                textColor: '#1E40AF'
            };
        } else if (foundGroup.type === 'základná skupina') {
            result = {
                backgroundColor: '#DCFCE7',
                textColor: '#166534'
            };
        }
    }
    
    return result;
};

// Funkcia na kontrolu, či ide o eliminačný zápas
const isEliminationMatch = (match) => {
    if (match.isPlacementMatch) return true;
    
    if (match.matchType === 'Playoff' || match.matchType === 'Semifinále' || 
        match.matchType === 'Finále' || match.matchType === 'Štvrťfinále' ||
        match.matchType === 'Osemfinále' || (match.matchType && match.matchType.includes('finále')) ||
        (match.matchType && match.matchType.includes('miesto'))) {
        return true;
    }
    
    return false;
};

// Funkcia na získanie farieb pre zápas
const getMatchColors = (match, groupsData) => {
    if (isEliminationMatch(match)) {
        return ELIMINATION_COLORS;
    }
    
    if (match.groupName && match.categoryId) {
        return getGroupTypeColors(match.groupName, match.categoryId, groupsData);
    }
    
    return {
        backgroundColor: '#DCFCE7',
        textColor: '#166534'
    };
};

// Funkcia na získanie zobrazeného názvu tímu
const getDisplayTeamName = (teamIdentifier) => {
    if (!teamIdentifier) return '???';
    
    if (window.teamManager && typeof window.teamManager.getTeamNameByDisplayIdSync === 'function') {
        const teamName = window.teamManager.getTeamNameByDisplayIdSync(teamIdentifier);
        if (teamName && teamName !== teamIdentifier) return teamName;
    }
    
    return teamIdentifier;
};

const updateTeamNamesInMatches = async (matchesList, setTeamNames, currentTeamNames) => {
    if (!window.matchTracker || typeof window.matchTracker.getTeamNameByDisplayId !== 'function') {
        console.log('⚠️ matchTracker.getTeamNameByDisplayId nie je dostupný');
        return;
    }
    
    const updatedNames = {};
    let needsUpdate = false;
    
    console.log(`🔄 Spúšťam aktualizáciu názvov tímov pre ${matchesList.length} zápasov...`);
    
    for (const match of matchesList) {
        // Získanie názvu kategórie pre tento zápas
        let categoryName = match.categoryName;
        if (!categoryName && match.categoryId && window.categoriesData && window.categoriesData[match.categoryId]) {
            categoryName = window.categoriesData[match.categoryId];
        }
        
        if (!categoryName) {
            console.log(`⚠️ Zápas ${match.id} nemá názov kategórie, preskakujem`);
            continue;
        }
        
        // Spracovanie domáceho tímu
        if (match.homeTeamIdentifier) {
            // Získame aktuálny zobrazený názov tímu
            const currentDisplayName = currentTeamNames[match.homeTeamIdentifier] || getDisplayTeamName(match.homeTeamIdentifier);
            
            // 🔥 KONTROLA: Voláme getTeamNameByDisplayId LEN ak názov tímu obsahuje názov kategórie
            if (currentDisplayName && currentDisplayName.includes(categoryName)) {
                try {
                    console.log(`🔄 Domáci tím "${currentDisplayName}" obsahuje kategóriu "${categoryName}" → volám getTeamNameByDisplayId`);
                    const newName = await window.matchTracker.getTeamNameByDisplayId(currentDisplayName);
                    if (newName && newName !== currentDisplayName && newName !== updatedNames[match.homeTeamIdentifier]) {
                        updatedNames[match.homeTeamIdentifier] = newName;
                        needsUpdate = true;
                        console.log(`✅ Domáci tím "${currentDisplayName}" → "${newName}"`);
                    } else {
                        console.log(`ℹ️ Domáci tím "${currentDisplayName}" sa nezmenil → "${newName}"`);
                    }
                } catch (err) {
                    console.error(`Chyba pri získavaní názvu pre domáci tím ${currentDisplayName}:`, err);
                }
            } else {
                console.log(`⏭️ Domáci tím "${currentDisplayName}" NEOBSAHUJE kategóriu "${categoryName}" → preskakujem`);
            }
        }
        
        // Spracovanie hosťujúceho tímu
        if (match.awayTeamIdentifier) {
            // Získame aktuálny zobrazený názov tímu
            const currentDisplayName = currentTeamNames[match.awayTeamIdentifier] || getDisplayTeamName(match.awayTeamIdentifier);
            
            // 🔥 KONTROLA: Voláme getTeamNameByDisplayId LEN ak názov tímu obsahuje názov kategórie
            if (currentDisplayName && currentDisplayName.includes(categoryName)) {
                try {
                    console.log(`🔄 Hosťujúci tím "${currentDisplayName}" obsahuje kategóriu "${categoryName}" → volám getTeamNameByDisplayId`);
                    const newName = await window.matchTracker.getTeamNameByDisplayId(currentDisplayName);
                    if (newName && newName !== currentDisplayName && newName !== updatedNames[match.awayTeamIdentifier]) {
                        updatedNames[match.awayTeamIdentifier] = newName;
                        needsUpdate = true;
                        console.log(`✅ Hosťujúci tím "${currentDisplayName}" → "${newName}"`);
                    } else {
                        console.log(`ℹ️ Hosťujúci tím "${currentDisplayName}" sa nezmenil → "${newName}"`);
                    }
                } catch (err) {
                    console.error(`Chyba pri získavaní názvu pre hosťujúci tím ${currentDisplayName}:`, err);
                }
            } else {
                console.log(`⏭️ Hosťujúci tím "${currentDisplayName}" NEOBSAHUJE kategóriu "${categoryName}" → preskakujem`);
            }
        }
    }
    
    if (needsUpdate) {
        setTeamNames(prev => ({ ...prev, ...updatedNames }));
        console.log('✅ Aktualizované názvy tímov:', updatedNames);
    } else {
        console.log('ℹ️ Žiadne zmeny v názvoch tímov');
    }
};

// Funkcia na získanie názvu kategórie podľa ID
const getCategoryNameById = (categoryId) => {
    if (!categoryId) return null;
    
    // Najprv skúsime z window.categoriesData (ID -> názov)
    if (window.categoriesData && window.categoriesData[categoryId]) {
        return window.categoriesData[categoryId];
    }
    
    // Ak máme window.categoriesList (pole objektov s id a name)
    if (window.categoriesList) {
        const found = window.categoriesList.find(cat => cat.id === categoryId);
        if (found) return found.name;
    }
    
    return null;
};

// Funkcia na načítanie členov tímu z databázy podľa názvu tímu a NÁZVU kategórie (s real-time aktualizáciou)
const loadTeamMembers = async (teamName, categoryName, onUpdate, onMappedName) => {
    if (!window.db || !teamName || !categoryName) {
        console.log("Chýba db, teamName alebo categoryName");
        if (onUpdate) onUpdate([]);
        if (onMappedName) onMappedName(teamName);
        return () => {};
    }
    
    // 🔥 PRVÝ KROK: Prevedieme teamName cez matchTracker na správny názov
    let actualTeamName = teamName;
    if (window.matchTracker && typeof window.matchTracker.getTeamNameByDisplayId === 'function') {
        try {
            console.log(`🔄 Prevod názvu tímu: "${teamName}" → cez matchTracker`);
            const convertedName = await window.matchTracker.getTeamNameByDisplayId(teamName);
            if (convertedName && convertedName !== teamName) {
                actualTeamName = convertedName;
                console.log(`✅ Prevedený názov: "${teamName}" → "${actualTeamName}"`);
                // 🔥 ODOŠLEME ZMAPOVANÝ NÁZOV HORE
                if (onMappedName) {
                    onMappedName(actualTeamName);
                }
            } else {
                console.log(`ℹ️ Názov tímu sa nezmenil: "${teamName}"`);
                if (onMappedName) {
                    onMappedName(teamName);
                }
            }
        } catch (err) {
            console.error(`Chyba pri prevode názvu tímu "${teamName}":`, err);
            if (onMappedName) {
                onMappedName(teamName);
            }
        }
    } else {
        console.log(`⚠️ window.matchTracker.getTeamNameByDisplayId nie je dostupný, používam pôvodný názov: "${teamName}"`);
        if (onMappedName) {
            onMappedName(teamName);
        }
    }
    
    console.log(`=== VYHĽADÁVANIE ČLENOV TÍMU (real-time) ===`);
    console.log(`Pôvodný názov: "${teamName}"`);
    console.log(`Skutočný názov na vyhľadávanie: "${actualTeamName}"`);
    console.log(`Kategória: "${categoryName}"`);
    
    // Prehľadávame všetkých používateľov (kluby)
    const usersRef = collection(window.db, 'users');
    
    // Vytvoríme unsubscribe funkciu pre real-time počúvanie
    const unsubscribe = onSnapshot(usersRef, (usersSnapshot) => {
        console.log(`Real-time aktualizácia: Načítavam členov pre tím ${actualTeamName}`);
        
        for (const userDoc of usersSnapshot.docs) {
            const userId = userDoc.id;
            const userData = userDoc.data();
            const teams = userData.teams || {};
            
            // Prehľadávame všetky kategórie tohto používateľa
            for (const [categoryKey, teamsArray] of Object.entries(teams)) {
                if (categoryKey !== categoryName) continue;
                
                // Hľadáme tím s daným názvom - používame actualTeamName
                const foundTeam = (teamsArray || []).find(t => t.teamName === actualTeamName);
                
                if (foundTeam) {
                    console.log(`✅ Našiel som tím: "${actualTeamName}" v kategórii ${categoryKey} (real-time)`);
                    
                    // Získame všetkých členov tímu
                    const members = [];
                    
                    // Hráči
                    if (foundTeam.playerDetails && Array.isArray(foundTeam.playerDetails)) {
                        foundTeam.playerDetails.forEach(player => {
                            members.push({
                                type: 'Hráč',
                                firstName: player.firstName || '',
                                lastName: player.lastName || '',
                                jerseyNumber: player.jerseyNumber || '',
                                registrationNumber: player.registrationNumber || ''
                            });
                        });
                    }
                    
                    // Členovia realizačného tímu (muži)
                    if (foundTeam.menTeamMemberDetails && Array.isArray(foundTeam.menTeamMemberDetails)) {
                        foundTeam.menTeamMemberDetails.forEach(member => {
                            members.push({
                                type: 'Člen RT (muž)',
                                firstName: member.firstName || '',
                                lastName: member.lastName || '',
                                jerseyNumber: '',
                                registrationNumber: member.registrationNumber || ''
                            });
                        });
                    }
                    
                    // Členovia realizačného tímu (ženy)
                    if (foundTeam.womenTeamMemberDetails && Array.isArray(foundTeam.womenTeamMemberDetails)) {
                        foundTeam.womenTeamMemberDetails.forEach(member => {
                            members.push({
                                type: 'Člen RT (žena)',
                                firstName: member.firstName || '',
                                lastName: member.lastName || '',
                                jerseyNumber: '',
                                registrationNumber: member.registrationNumber || ''
                            });
                        });
                    }
                    
                    // Šoféri (muži)
                    if (foundTeam.driverDetailsMale && Array.isArray(foundTeam.driverDetailsMale)) {
                        foundTeam.driverDetailsMale.forEach(driver => {
                            members.push({
                                type: 'Šofér (muž)',
                                firstName: driver.firstName || '',
                                lastName: driver.lastName || '',
                                jerseyNumber: '',
                                registrationNumber: driver.registrationNumber || ''
                            });
                        });
                    }
                    
                    // Šoféri (ženy)
                    if (foundTeam.driverDetailsFemale && Array.isArray(foundTeam.driverDetailsFemale)) {
                        foundTeam.driverDetailsFemale.forEach(driver => {
                            members.push({
                                type: 'Šofér (žena)',
                                firstName: driver.firstName || '',
                                lastName: driver.lastName || '',
                                jerseyNumber: '',
                                registrationNumber: driver.registrationNumber || ''
                            });
                        });
                    }
                    
                    console.log(`Celkový počet členov tímu (real-time): ${members.length}`);
                    if (onUpdate) onUpdate(members);
                    return;
                }
            }
        }
        
        console.log(`❌ Nenašiel som tím: "${actualTeamName}" v kategórii: "${categoryName}"`);
        if (onUpdate) onUpdate([]);
    }, (error) => {
        console.error('Chyba pri real-time načítaní členov tímu:', error);
        if (onUpdate) onUpdate([]);
    });
    
    // Vrátime unsubscribe funkciu pre zrušenie odberu
    return unsubscribe;
};

// OPRAVENÝ Komponent pre odpočet času vylúčenia - NEMÁ ŽIADNU DATABÁZOVÚ INTERAKCIU
const ExclusionTimer = ({ member, matchId, teamType, exclusionDuration, matchTimerRef, match }) => {
    const [exclusionEndTimeSeconds, setExclusionEndTimeSeconds] = useState(null);
    const [remainingSeconds, setRemainingSeconds] = useState(0);
    const [isExcluded, setIsExcluded] = useState(false);
    const [currentMatchTime, setCurrentMatchTime] = useState(0);
    const [periodDurationSec, setPeriodDurationSec] = useState(0);
    
    // Získanie referencií na člena
    const memberRef = useRef(member);
    useEffect(() => {
        memberRef.current = member;
    }, [member]);
    
    // Získanie dĺžky periódy z timeru alebo z match objektu
    useEffect(() => {
        if (matchTimerRef?.current) {
            const timer = matchTimerRef.current;
            if (timer.getPeriodDuration) {
                setPeriodDurationSec(timer.getPeriodDuration());
            }
        } else if (match?.periodDuration) {
            setPeriodDurationSec(match.periodDuration * 60);
        } else if (match?.categoryId && window.categoriesData) {
            const categoryId = match.categoryId;
            if (window.categorySettings && window.categorySettings[categoryId]) {
                setPeriodDurationSec(window.categorySettings[categoryId].periodDuration * 60);
            }
        }
    }, [matchTimerRef, match]);
    
    // Sledovanie času zápasu - z MatchTimer aj z Firebase
    useEffect(() => {
        const updateMatchTime = () => {
            let totalTime = 0;
            
            if (matchTimerRef?.current) {
                const timer = matchTimerRef.current;
                if (timer.getTotalTime) {
                    totalTime = timer.getTotalTime();
                } else if (timer.getPeriodTime) {
                    const periodTime = timer.getPeriodTime();
                    const currentPeriod = timer.getCurrentPeriod ? timer.getCurrentPeriod() : 1;
                    totalTime = ((currentPeriod - 1) * periodDurationSec) + periodTime;
                }
            }
            
            if (totalTime === 0 && match) {
                if (match.manualTimeOffset) {
                    totalTime = match.manualTimeOffset;
                }
                if (match.currentPeriod && match.currentPeriod > 1) {
                    totalTime = ((match.currentPeriod - 1) * periodDurationSec) + (match.manualTimeOffset || 0);
                }
            }
            
            setCurrentMatchTime(totalTime);
        };
        
        updateMatchTime();
        
        const interval = setInterval(updateMatchTime, 100);
        
        if (window.db && matchId) {
            const matchRef = doc(window.db, 'matches', matchId);
            const unsubscribe = onSnapshot(matchRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.manualTimeOffset !== undefined) {
                        updateMatchTime();
                    }
                }
            });
            return () => {
                clearInterval(interval);
                unsubscribe();
            };
        }
        
        return () => clearInterval(interval);
    }, [matchTimerRef, match, matchId, periodDurationSec]);
    
    // 🔥 OPRAVA: Iba čítanie udalostí vylúčenia, ŽIADNE ZAPISOVANIE reentry
    useEffect(() => {
        if (!window.db || !matchId || !member) return;
        
        const eventsRef = collection(window.db, 'matchEvents');
        const q = query(eventsRef, where('matchId', '==', matchId));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            let latestExclusion = null;
            let latestReentry = null;
            
            let targetTypeKey = member.dbArrayName;
            let targetIndex = member.originalIndex;
            
            if (!targetTypeKey) {
                if (member.type === 'Hráč') targetTypeKey = 'playerDetails';
                else if (member.type === 'Člen RT (muž)') targetTypeKey = 'menTeamMemberDetails';
                else if (member.type === 'Člen RT (žena)') targetTypeKey = 'womenTeamMemberDetails';
                targetIndex = member.originalIndex !== undefined ? member.originalIndex : 0;
            }
            
            snapshot.forEach((doc) => {
                const event = doc.data();
                
                if (event.team === teamType && 
                    event.memberTypeKey === targetTypeKey && 
                    event.memberIndex === targetIndex) {
                    
                    if (event.eventType === 'exclusion') {
                        if (!latestExclusion || (event.totalTime || 0) > (latestExclusion.totalTime || 0)) {
                            latestExclusion = {
                                totalTime: event.totalTime || 0,
                                period: event.period || 1,
                                docId: doc.id
                            };
                        }
                    } else if (event.eventType === 'reentry') {
                        if (!latestReentry || (event.totalTime || 0) > (latestReentry.totalTime || 0)) {
                            latestReentry = {
                                totalTime: event.totalTime || 0,
                                docId: doc.id
                            };
                        }
                    }
                }
            });
            
            // 🔥 IBA VYHODNOTENIE STAVU - ŽIADNE ZAPISOVANIE DO DB
            if (latestExclusion && (!latestReentry || latestReentry.totalTime < latestExclusion.totalTime)) {
                const exclusionStart = latestExclusion.totalTime;
                const exclusionEnd = exclusionStart + (exclusionDuration * 60);
                setExclusionEndTimeSeconds(exclusionEnd);
                setIsExcluded(true);
            } else {
                setIsExcluded(false);
                setExclusionEndTimeSeconds(null);
            }
        });
        
        return () => unsubscribe();
    }, [matchId, teamType, member, exclusionDuration]);
    
    // 🔥 OPRAVA: IBA VIZUÁLNY ODPOČET - ŽIADNE ZAPISOVANIE DO DB
    useEffect(() => {
        if (!isExcluded || exclusionEndTimeSeconds === null) {
            setRemainingSeconds(0);
            return;
        }
        
        const remaining = Math.max(0, exclusionEndTimeSeconds - currentMatchTime);
        setRemainingSeconds(remaining);
        
        // 🔥 ODSTRÁNENÉ: Žiadne ukladanie reentry eventu do databázy
        // Vylúčenie sa vyhodnocuje len vizuálne, nie je potrebné zapisovať návrat
        
    }, [currentMatchTime, isExcluded, exclusionEndTimeSeconds]);
    
    if (!isExcluded || remainingSeconds <= 0) return null;
    
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    const timeDisplay = mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
    
    return React.createElement(
        'div',
        { className: 'mt-1 text-xs text-orange-600 bg-orange-50 rounded px-2 py-0.5 inline-block' },
        React.createElement('i', { className: 'fa-solid fa-hourglass-half mr-1' }),
        `Zostáva vylúčený: ${timeDisplay}`
    );
};

// OPRAVENÝ TeamMembersList KOMPONENT - SPRÁVNE PRIPOČÍTAVANIE ČASU VYLÚČENIA
const TeamMembersList = ({ teamName, categoryName, teamType, timerRef, onMappedNameUpdate, matchId }) => {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [mappedName, setMappedName] = useState(teamName);
    const [membersStats, setMembersStats] = useState({});
    const [exclusionDuration, setExclusionDuration] = useState(2);
    const [matchData, setMatchData] = useState(null);
    const [excludedPlayers, setExcludedPlayers] = useState({});
    
    // Načítanie dát zápasu z Firebase
    useEffect(() => {
        if (!window.db || !matchId) return;
        
        const matchRef = doc(window.db, 'matches', matchId);
        const unsubscribe = onSnapshot(matchRef, (docSnap) => {
            if (docSnap.exists()) {
                setMatchData(docSnap.data());
            }
        });
        
        return () => unsubscribe();
    }, [matchId]);
    
    // Načítanie nastavení vylúčenia z databázy
    useEffect(() => {
        const loadExclusionSettings = async () => {
            if (!window.db || !matchId) return;
            
            try {
                const matchRef = doc(window.db, 'matches', matchId);
                const matchSnap = await getDoc(matchRef);
                if (matchSnap.exists()) {
                    const matchData = matchSnap.data();
                    const categoryId = matchData.categoryId;
                    
                    if (categoryId) {
                        const settingsRef = doc(window.db, 'settings', 'categories');
                        const settingsSnap = await getDoc(settingsRef);
                        if (settingsSnap.exists()) {
                            const categoryData = settingsSnap.data()[categoryId];
                            if (categoryData && categoryData.exclusionTime) {
                                setExclusionDuration(categoryData.exclusionTime);
                            }
                        }
                    }
                }
            } catch (err) {
                console.error('Chyba pri načítaní nastavení vylúčenia:', err);
            }
        };
        
        loadExclusionSettings();
    }, [matchId]);
    
    // 🔥 OPRAVENÉ: SPRÁVNE PRIPOČÍTAVANIE ČASU PRI VIACNÁSOBNÝCH VYLÚČENIACH
    useEffect(() => {
        if (!window.db || !matchId || members.length === 0) return;
        
        const eventsRef = collection(window.db, 'matchEvents');
        const q = query(eventsRef, where('matchId', '==', matchId));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const excluded = {};
            
            // Získanie aktuálneho času zápasu
            let currentMatchTime = 0;
            if (matchData) {
                currentMatchTime = matchData.manualTimeOffset || 0;
                if (matchData.currentPeriod && matchData.currentPeriod > 1) {
                    const periodLength = (matchData.periodDuration || 20) * 60;
                    currentMatchTime = ((matchData.currentPeriod - 1) * periodLength) + (matchData.manualTimeOffset || 0);
                }
            }
            
            members.forEach((member) => {
                if (member.type !== 'Hráč') return;
                
                let targetTypeKey = member.dbArrayName;
                let targetIndex = member.originalIndex;
                
                if (!targetTypeKey) {
                    if (member.type === 'Hráč') targetTypeKey = 'playerDetails';
                    else if (member.type === 'Člen RT (muž)') targetTypeKey = 'menTeamMemberDetails';
                    else if (member.type === 'Člen RT (žena)') targetTypeKey = 'womenTeamMemberDetails';
                    targetIndex = member.originalIndex !== undefined ? member.originalIndex : 0;
                }
                
                // Zozbierame všetky vylúčenia pre tohto hráča
                const exclusions = [];
                
                snapshot.forEach((doc) => {
                    const event = doc.data();
                    
                    if (event.team === teamType && 
                        event.memberTypeKey === targetTypeKey && 
                        event.memberIndex === targetIndex &&
                        event.eventType === 'exclusion') {
                        
                        exclusions.push({
                            totalTime: event.totalTime || 0
                        });
                    }
                });
                
                // Zoradíme vylúčenia podľa času
                exclusions.sort((a, b) => a.totalTime - b.totalTime);
                
                if (exclusions.length === 0) {
                    excluded[member.originalIndex] = { isExcluded: false, remainingSeconds: 0 };
                    return;
                }
                
                // 🔥 KĽÚČOVÁ LOGIKA: Vypočítame celkový čas vylúčenia
                // Každé vylúčenie trvá exclusionDuration minút
                // Čas vylúčenia sa počíta od času, kedy k nemu došlo
                let activeExclusionEndTime = null;
                let currentPenaltyEnd = 0;
                
                for (let i = 0; i < exclusions.length; i++) {
                    const exclusion = exclusions[i];
                    const exclusionStart = exclusion.totalTime;
                    
                    // Ak je začiatok tohto vylúčenia neskôr ako koniec predchádzajúceho trestu
                    // Tak začína nový trest
                    if (exclusionStart >= currentPenaltyEnd) {
                        currentPenaltyEnd = exclusionStart + (exclusionDuration * 60);
                    } else {
                        // Inak sa pripočítava k existujúcemu trestu
                        currentPenaltyEnd = currentPenaltyEnd + (exclusionDuration * 60);
                    }
                    
                    // Ak sme ešte nenašli aktívny trest a aktuálny čas je pred koncom tohto trestu
                    if (activeExclusionEndTime === null && currentMatchTime < currentPenaltyEnd) {
                        activeExclusionEndTime = currentPenaltyEnd;
                    }
                }
                
                // Ak máme aktívny trest
                if (activeExclusionEndTime !== null && currentMatchTime < activeExclusionEndTime) {
                    const remaining = Math.ceil(activeExclusionEndTime - currentMatchTime);
                    excluded[member.originalIndex] = {
                        isExcluded: true,
                        remainingSeconds: remaining
                    };
                } else {
                    excluded[member.originalIndex] = { isExcluded: false, remainingSeconds: 0 };
                }
            });
            
            setExcludedPlayers(excluded);
        });
        
        return () => unsubscribe();
    }, [matchId, teamType, members, exclusionDuration, matchData]);
    
    // Načítanie členov tímu (zachované z pôvodného kódu)
    useEffect(() => {
        setLoading(true);
        setError(null);
        
        if (!teamName || !categoryName) {
            setLoading(false);
            return;
        }
        
        const handleMembersUpdate = (updatedMembers) => {
            const filteredMembers = updatedMembers.filter(m => m.type === 'Hráč' || m.type === 'Člen RT (muž)' || m.type === 'Člen RT (žena)');
            const rtMembers = filteredMembers.filter(m => m.type !== 'Hráč');
            const players = filteredMembers.filter(m => m.type === 'Hráč');
            const sortedMembers = [...rtMembers, ...players];
            
            const membersWithOriginalIndex = sortedMembers.map((member, displayIdx) => {
                let originalIndex = displayIdx;
                
                if (member.type === 'Hráč') {
                    const allPlayers = updatedMembers.filter(m => m.type === 'Hráč');
                    originalIndex = allPlayers.findIndex(m => 
                        m.firstName === member.firstName && 
                        m.lastName === member.lastName
                    );
                } else if (member.type === 'Člen RT (muž)') {
                    const allMenRT = updatedMembers.filter(m => m.type === 'Člen RT (muž)');
                    originalIndex = allMenRT.findIndex(m => 
                        m.firstName === member.firstName && 
                        m.lastName === member.lastName
                    );
                } else if (member.type === 'Člen RT (žena)') {
                    const allWomenRT = updatedMembers.filter(m => m.type === 'Člen RT (žena)');
                    originalIndex = allWomenRT.findIndex(m => 
                        m.firstName === member.firstName && 
                        m.lastName === member.lastName
                    );
                }
                
                return {
                    ...member,
                    originalIndex: originalIndex !== -1 ? originalIndex : displayIdx,
                    dbArrayName: member.type === 'Hráč' ? 'playerDetails' : 
                                (member.type === 'Člen RT (muž)' ? 'menTeamMemberDetails' : 'womenTeamMemberDetails')
                };
            });
            
            setMembers(membersWithOriginalIndex);
            setLoading(false);
        };
        
        const handleMappedName = (newMappedName) => {
            if (newMappedName !== mappedName) {
                setMappedName(newMappedName);
                if (onMappedNameUpdate && typeof onMappedNameUpdate === 'function') {
                    onMappedNameUpdate(newMappedName);
                }
            }
        };
        
        const unsubscribe = loadTeamMembers(teamName, categoryName, handleMembersUpdate, handleMappedName);
        const timeoutId = setTimeout(() => setLoading(false), 5000);
        
        return () => {
            clearTimeout(timeoutId);
            if (unsubscribe && typeof unsubscribe === 'function') unsubscribe();
        };
    }, [teamName, categoryName]);
    
    // Načítanie štatistík z udalostí (zachované z pôvodného kódu)
    useEffect(() => {
        if (!window.db || !matchId) return;
        
        const eventsRef = collection(window.db, 'matchEvents');
        const q = query(eventsRef, where('matchId', '==', matchId));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const newStats = {};
            
            members.forEach((member, idx) => {
                const memberKey = `${member.type}_${member.originalIndex}`;
                newStats[memberKey] = {
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
            
            snapshot.forEach((doc) => {
                const event = doc.data();
                if (event.team !== teamType) return;
                
                let foundMemberKey = null;
                for (const [memberKey, stat] of Object.entries(newStats)) {
                    if (stat.dbArrayName === event.memberTypeKey && stat.dbIndex === event.memberIndex) {
                        foundMemberKey = memberKey;
                        break;
                    }
                }
                
                if (!foundMemberKey) return;
                const stat = newStats[foundMemberKey];
                
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
                        if (event.eventSubtype === 'yellow') stat.yellowCards++;
                        else if (event.eventSubtype === 'red') stat.redCards++;
                        else if (event.eventSubtype === 'blue') stat.blueCards++;
                        break;
                    case 'exclusion':
                        stat.exclusions++;
                        break;
                }
            });
            
            setMembersStats(newStats);
        });
        
        return () => unsubscribe();
    }, [matchId, teamType, members]);
    
    const getMemberIcon = (memberType) => {
        if (memberType === 'Hráč') {
            return React.createElement('i', { className: 'fa-solid fa-user text-gray-500 mr-2', style: { width: '16px' } });
        } else if (memberType === 'Člen RT (muž)') {
            return React.createElement('i', { className: 'fa-solid fa-user-tie text-blue-500 mr-2', style: { width: '16px' } });
        } else if (memberType === 'Člen RT (žena)') {
            return React.createElement('i', { className: 'fa-solid fa-user-tie text-red-500 mr-2', style: { width: '16px' } });
        }
        return React.createElement('i', { className: 'fa-solid fa-user text-gray-500 mr-2', style: { width: '16px' } });
    };
    
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
    
    const handleMemberClick = async (member) => {
        if (!timerRef) {
            console.error('❌ timerRef nie je dostupný');
            return;
        }
        
        const timerCurrent = timerRef.current;
        let selectedActionsSet = new Set();
        let isTimerRunning = false;
        
        if (timerCurrent && typeof timerCurrent.getSelectedActions === 'function') {
            const actions = timerCurrent.getSelectedActions();
            if (actions && actions.size > 0) {
                selectedActionsSet = actions;
            }
        } 
        else if (timerCurrent && typeof timerCurrent.getSelectedAction === 'function') {
            const action = timerCurrent.getSelectedAction();
            if (action) {
                selectedActionsSet.add(action);
            }
        } else if (typeof timerRef.getSelectedAction === 'function') {
            const action = timerRef.getSelectedAction();
            if (action) {
                selectedActionsSet.add(action);
            }
        }
        
        if (selectedActionsSet.has('goal') && member.type !== 'Hráč') {
            return;
        }
        
        if (selectedActionsSet.has('7m') && member.type !== 'Hráč') {
            return;
        }
        
        if (member.type === 'Hráč') {
            const exclusionInfo = excludedPlayers[member.originalIndex];
            
            if (exclusionInfo && exclusionInfo.isExcluded) {
                if (selectedActionsSet.has('goal')) {
                    return;
                }
                if (selectedActionsSet.has('7m')) {
                    return;
                }
            }
        }
        
        if (timerCurrent && typeof timerCurrent.isTimerRunning === 'function') {
            isTimerRunning = timerCurrent.isTimerRunning();
        } else if (typeof timerRef.isTimerRunning === 'function') {
            isTimerRunning = timerRef.isTimerRunning();
        }
        
        if (selectedActionsSet.size === 0) {
            return;
        }
        
        if (!isTimerRunning) {
            return;
        }
        
        const memberForSave = {
            type: member.type,
            name: `${member.firstName} ${member.lastName}`.trim(),
            index: member.originalIndex,
            typeKey: member.dbArrayName
        };
        
        let success = false;
        
        if (timerCurrent && typeof timerCurrent.saveMatchEvent === 'function') {
            success = await timerCurrent.saveMatchEvent(teamType, memberForSave);
        } else if (typeof timerRef.saveMatchEvent === 'function') {
            success = await timerRef.saveMatchEvent(teamType, memberForSave);
        }
    };
    
    if (loading) {
        return React.createElement(
            'div',
            { className: 'bg-white rounded-lg border border-gray-200 p-4 h-full' },
            React.createElement(
                'div',
                { className: 'text-center py-4' },
                React.createElement('div', { className: 'animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400 mx-auto' }),
                React.createElement('p', { className: 'text-xs text-gray-400 mt-2' }, 'Načítavam členov...')
            )
        );
    }
    
    if (error) {
        return React.createElement(
            'div',
            { className: 'bg-white rounded-lg border border-gray-200 p-4 h-full' },
            React.createElement(
                'div',
                { className: 'text-center py-4 text-red-500 text-sm' },
                'Nepodarilo sa načítať členov tímu'
            )
        );
    }
    
    const displayTeamName = mappedName !== teamName ? mappedName : teamName;
    
    const sortedPlayers = [...members.filter(m => m.type === 'Hráč')].sort((a, b) => {
        const aNum = parseInt(a.jerseyNumber) || 999;
        const bNum = parseInt(b.jerseyNumber) || 999;
        return aNum - bNum;
    });
    const rtMembers = members.filter(m => m.type !== 'Hráč');
    const allMembersSorted = [...sortedPlayers, ...rtMembers];
    
    // OPRAVENÁ časť TeamMembersList - správne odstránenie štýlu po skončení vylúčenia
    return React.createElement(
        'div',
        { className: 'bg-white rounded-lg border border-gray-200 overflow-hidden h-full' },
        React.createElement(
            'div',
            { className: 'bg-gray-50 px-4 py-2 border-b border-gray-200' },
            React.createElement('h3', { className: 'font-semibold text-gray-800' }, displayTeamName),
            React.createElement('p', { className: 'text-xs text-gray-500 mt-0.5' }, 'Spolu: ' + members.length + ' členov')
        ),
        React.createElement(
            'div',
            { className: 'overflow-x-auto' },
            React.createElement(
                'table',
                { className: 'min-w-full text-sm' },
                React.createElement(
                    'thead',
                    { className: 'bg-gray-100 sticky top-0' },
                    React.createElement(
                        'tr',
                        { className: 'border-b border-gray-200' },
                        React.createElement('th', { className: 'px-2 py-2 text-left text-xs font-medium text-gray-500', style: { width: '30px' } }, ''),
                        React.createElement('th', { className: 'px-2 py-2 text-left text-xs font-medium text-gray-500' }, 'Č. dresu'),
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
                    allMembersSorted.map((member, idx) => {
                        const stats = getMemberStats(member);
                        const fullName = (member.firstName + ' ' + member.lastName).trim() || 'Neznámy';
                        const jerseyDisplay = member.jerseyNumber || '';
                        
                        const memberIcon = member.type === 'Hráč' 
                            ? React.createElement('i', { className: 'fa-solid fa-user text-gray-500 text-sm' })
                            : (member.type === 'Člen RT (muž)' 
                                ? React.createElement('i', { className: 'fa-solid fa-user-tie text-blue-500 text-sm' })
                                : React.createElement('i', { className: 'fa-solid fa-user-tie text-red-500 text-sm' }));
                        
                        const totalPenalties = stats.convertedPenalties + stats.missedPenalties;
                        const penaltiesDisplay = totalPenalties > 0 ? `${stats.convertedPenalties}/${totalPenalties}` : '';
                        
                        // 🔥 OPRAVA: Skontrolujeme, či je hráč naozaj vylúčený (remainingSeconds > 0)
                        const exclusionInfo = member.type === 'Hráč' ? excludedPlayers[member.originalIndex] : null;
                        const isPlayerExcluded = exclusionInfo?.isExcluded === true && (exclusionInfo?.remainingSeconds || 0) > 0;
                        
                        let exclusionTooltip = '';
                        let exclusionDisplay = null;
                        
                        if (isPlayerExcluded) {
                            const remainingSeconds = exclusionInfo.remainingSeconds;
                            const mins = Math.floor(remainingSeconds / 60);
                            const secs = remainingSeconds % 60;
                            const timeDisplay = mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
                            exclusionTooltip = `Vylúčený! Zostáva: ${timeDisplay}`;
                            
                            // Vytvoríme odpočet pre zobrazenie pod riadkom
                            exclusionDisplay = React.createElement(
                                'tr',
                                { key: `exclusion-${idx}`, className: 'bg-orange-50' },
                                React.createElement('td', { colSpan: 9, className: 'px-2 py-1 text-center' },
                                    React.createElement(
                                        'div',
                                        { className: 'text-xs text-orange-600 font-medium flex items-center justify-center gap-1' },
                                        React.createElement('i', { className: 'fa-solid fa-hourglass-half' }),
                                        React.createElement('span', {}, `Vylúčený! Zostáva: ${timeDisplay}`)
                                    )
                                )
                            );
                        }
                        
                        // 🔥 OPRAVA: CSS štýl sa aplikuje LEN ak je hráč naozaj vylúčený (remainingSeconds > 0)
                        const rowClassName = isPlayerExcluded 
                            ? 'hover:bg-gray-50 transition-colors cursor-pointer opacity-60' 
                            : 'hover:bg-gray-50 transition-colors cursor-pointer';
                        
                        return React.createElement(
                            React.Fragment,
                            { key: idx },
                            React.createElement(
                                'tr',
                                { 
                                    className: rowClassName,
                                    onClick: () => handleMemberClick(member),
                                    title: exclusionTooltip || undefined
                                },
                                React.createElement('td', { className: 'px-2 py-2 text-center' }, memberIcon),
                                React.createElement('td', { className: 'px-2 py-2 font-mono font-medium text-gray-700 text-center' }, jerseyDisplay || ''),
                                React.createElement('td', { className: 'px-2 py-2 text-gray-800' }, fullName),
                                React.createElement('td', { className: 'px-2 py-2 text-center font-bold text-green-600' }, stats.goals > 0 ? stats.goals : ''),
                                React.createElement('td', { className: 'px-2 py-2 text-center font-medium text-teal-600' }, penaltiesDisplay),
                                React.createElement('td', { className: 'px-2 py-2 text-center font-bold text-yellow-600' }, stats.yellowCards > 0 ? stats.yellowCards : ''),
                                React.createElement('td', { className: 'px-2 py-2 text-center font-bold text-red-600' }, stats.redCards > 0 ? stats.redCards : ''),
                                React.createElement('td', { className: 'px-2 py-2 text-center font-bold text-blue-600' }, stats.blueCards > 0 ? stats.blueCards : ''),
                                React.createElement('td', { className: 'px-2 py-2 text-center font-bold text-orange-600' }, stats.exclusions > 0 ? stats.exclusions : '')
                            ),
                            exclusionDisplay
                        );
                    })
                )
            )
        ),
        members.length === 0 && React.createElement(
            'div',
            { className: 'text-center py-8 text-gray-400 text-sm' },
            'Žiadni členovia tímu'
        )
    );
};

const MatchTimer = React.forwardRef(({ match, matchId, onTimeUpdate, categorySettings, teamNames, onActionSelected, selectedAction: externalSelectedAction }, ref) => {
    const [isRunning, setIsRunning] = useState(false);
    const [period, setPeriod] = useState(1);
    const [totalPeriods, setTotalPeriods] = useState(1);
    const [periodDuration, setPeriodDuration] = useState(20);
    const [displaySeconds, setDisplaySeconds] = useState(0);
    const [showEndMatchModal, setShowEndMatchModal] = useState(false);
    const [showForfeitModal, setShowForfeitModal] = useState(false);
    const [forfeitTeam, setForfeitTeam] = useState(null);
    const [selectedForfeitTeam, setSelectedForfeitTeam] = useState(null);
    const [showManualResultModal, setShowManualResultModal] = useState(false);
    const [manualHomeScore, setManualHomeScore] = useState('');
    const [manualAwayScore, setManualAwayScore] = useState('');
    const [modalLoadingMapping, setModalLoadingMapping] = useState(false);

    // Stavy pre udalosti
    const [selectedAction, setSelectedAction] = useState(externalSelectedAction || null);
    const [matchEvents, setMatchEvents] = useState([]);
    const [eventsLoading, setEventsLoading] = useState(true);

    const [selectedActions, setSelectedActions] = useState(new Set());
    const [externalActionSync, setExternalActionSync] = useState(null);
    
    const intervalRef = useRef(null);
    const isRunningRef = useRef(false);
    const startTimeRef = useRef(null);
    const localStartOffsetRef = useRef(0);
    const periodDurationRef = useRef(periodDuration);
    const totalPeriodsRef = useRef(totalPeriods);
    const periodRef = useRef(period);
    const lastServerUpdateRef = useRef(0);
    const displaySecondsRef = useRef(0);
    
    const matchTimerRef = useRef(null);

    useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);
    useEffect(() => { periodDurationRef.current = periodDuration; }, [periodDuration]);
    useEffect(() => { totalPeriodsRef.current = totalPeriods; }, [totalPeriods]);
    useEffect(() => { periodRef.current = period; }, [period]);
    useEffect(() => { displaySecondsRef.current = displaySeconds; }, [displaySeconds]);

    // 🔥 FUNKCIA: Výpočet času v rámci aktuálnej periódy
    const getPeriodTime = (totalSeconds) => {
        return totalSeconds;
    };

    // 🔥 FUNKCIA: Získanie celkového času (pre celý zápas)
    const getTotalTime = () => {
        // Celkový čas je jednoducho displaySeconds (neobsahuje prestávky)
        return displaySeconds;
    };

    // 🔥 FUNKCIA: Kontrola, či sme na konci periódy
    const isEndOfPeriod = () => {
        const periodLength = periodDuration * 60;
        return displaySeconds >= periodLength;
    };

    // 🔥 FUNKCIA: Kontrola, či sme na konci celého zápasu
    const isEndOfMatch = () => {
        return period > totalPeriods;
    };

    useEffect(() => {
        if (onActionSelected && typeof onActionSelected === 'function') {
            // Ak je vybratá presne jedna akcia, odošleme ju, inak null
            const singleAction = selectedActions.size === 1 ? Array.from(selectedActions)[0] : null;
            onActionSelected(singleAction);
        }
    }, [selectedActions, onActionSelected]);

    // Synchronizácia s externým selectedAction (pre spätnú kompatibilitu)
    useEffect(() => {
        if (externalSelectedAction !== undefined && externalSelectedAction !== externalActionSync) {
            setExternalActionSync(externalSelectedAction);
            if (externalSelectedAction) {
                // Pridáme externú akciu do množiny
                setSelectedActions(prev => new Set([...prev, externalSelectedAction]));
            } else {
                // Vyčistíme všetky akcie
                setSelectedActions(new Set());
            }
        }
    }, [externalSelectedAction]);

    // Notifikácia rodičovi o zmene vybranej akcie
    useEffect(() => {
        if (onActionSelected && typeof onActionSelected === 'function') {
            onActionSelected(selectedAction);
        }
    }, [selectedAction, onActionSelected]);

    // Synchronizácia s externým selectedAction
    useEffect(() => {
        if (externalSelectedAction !== undefined && externalSelectedAction !== selectedAction) {
            setSelectedAction(externalSelectedAction);
        }
    }, [externalSelectedAction]);

    // Funkcia pre kliknutie na tlačidlo akcie (UPRAVENÁ)
    const handleActionClick = (action) => {
        setSelectedActions(prev => {
            // 🔥 ŠPECIÁLNA LOGIKA:
            // Ak je vybratý GÓL a kliknem na 7m -> GÓL sa zruší, vyberie sa len 7m
            if (action === '7m' && prev.has('goal')) {
                const newSet = new Set();
                newSet.add('7m');
                return newSet;
            }
            
            // Ak je vybratá 7m a kliknem na GÓL -> obe ostanú vybraté (7m + gól)
            if (action === 'goal' && prev.has('7m')) {
                const newSet = new Set(prev);
                newSet.add('goal');
                return newSet;
            }
            
            // 🔥 PRE VŠETKY OSTATNÉ PRÍPADY: exclusive režim
            // Ak klikneme na akúkoľvek akciu (yellow, red, blue, exclusion, alebo samostatný goal/7m)
            const newSet = new Set();
            
            // Ak je kliknutá akcia už aktívna, zrušíme ju (prázdna množina)
            if (prev.has(action)) {
                return newSet;
            }
            
            // Inak vyberieme len túto jednu akciu
            newSet.add(action);
            return newSet;
        });
    };

    const isActionSelected = (action) => {
        return selectedActions.has(action);
    };

    const getActionButtonClass = (action) => {
        const baseClass = "px-5 py-2 rounded-lg font-semibold transition-colors text-sm cursor-pointer";
        const isActive = isActionSelected(action);
        
        const colorStyles = {
            goal: { bg: "bg-green-500", hover: "hover:bg-green-600", border: "border-green-500", text: "text-green-600" },
            '7m': { bg: "bg-teal-500", hover: "hover:bg-teal-600", border: "border-teal-500", text: "text-teal-600" },
            yellow: { bg: "bg-yellow-500", hover: "hover:bg-yellow-600", border: "border-yellow-500", text: "text-yellow-600" },
            red: { bg: "bg-red-600", hover: "hover:bg-red-700", border: "border-red-600", text: "text-red-700" },
            blue: { bg: "bg-blue-400", hover: "hover:bg-blue-500", border: "border-blue-500", text: "text-blue-600" },
            exclusion: { bg: "bg-orange-500", hover: "hover:bg-orange-600", border: "border-orange-500", text: "text-orange-600" }
        };
    
        const style = colorStyles[action];
        
        if (isActive) {
            // AKTÍVNE tlačidlo - pôvodný štýl (farba výplne, biely text)
            return `${baseClass} ${style.bg} ${style.hover} text-white`;
        } else {
            // NEaktívne tlačidlá - biely štýl s farebným rámikom a farebným textom
            return `${baseClass} bg-white border-2 ${style.border} ${style.text} hover:bg-gray-50`;
        }
    };

    // Načítanie udalostí pre zápas
    const loadMatchEvents = async () => {
        if (!window.db || !matchId) return;
        
        try {
            const eventsRef = collection(window.db, 'matchEvents');
            const q = query(eventsRef, where('matchId', '==', matchId), orderBy('timestamp', 'desc'));
            const querySnapshot = await getDocs(q);
            const events = [];
            querySnapshot.forEach((doc) => {
                events.push({ id: doc.id, ...doc.data() });
            });
            setMatchEvents(events);
        } catch (err) {
            console.error('Chyba pri načítaní udalostí:', err);
        } finally {
            setEventsLoading(false);
        }
    };

    // Real-time listener pre udalosti
    useEffect(() => {
        if (!window.db || !matchId) return;
        
        loadMatchEvents();
        
        const eventsRef = collection(window.db, 'matchEvents');
        const q = query(eventsRef, where('matchId', '==', matchId), orderBy('timestamp', 'desc'));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const events = [];
            snapshot.forEach((doc) => {
                events.push({ id: doc.id, ...doc.data() });
            });
            setMatchEvents(events);
            setEventsLoading(false);
        }, (error) => {
            console.error('Chyba pri real-time načítaní udalostí:', error);
            setEventsLoading(false);
        });
        
        return () => unsubscribe();
    }, [matchId]);

    const calculateTotalMatchTime = () => {
        const periodLengthSeconds = periodDuration * 60;
        const currentPeriodTime = displaySeconds;

        if (period <= 1) {
            return currentPeriodTime;
        }
        
        const totalPreviousPeriodsTime = (period - 1) * periodLengthSeconds;
        const totalTime = totalPreviousPeriodsTime + currentPeriodTime;
    
        return totalTime;
    };

    const saveMatchEventInternalWithAction = async (teamType, member, action) => {
        // Ak nie je žiadna akcia vybraná, nič neukladáme
        if (selectedActions.size === 0 || !window.db || !matchId) {
            return false;
        }
        
        if (!isRunningRef.current) {
            return false;
        }
        
        // Kontrola: Gól môže dať len Hráč
        if (selectedActions.has('goal') && member.type !== 'Hráč') {
            console.log('❌ Gól môže dať len hráč, nie člen RT');
            return false;
        }
        
        if (selectedActions.has('7m') && member.type !== 'Hráč') {
            return false;
        }
        
        // 🔥 ZMENA: Namiesto displaySeconds použijeme calculateTotalMatchTime()
        const totalMatchTime = calculateTotalMatchTime();
        const currentPeriodNum = period;
        const categoryNameForMatch = match.categoryName || (match.categoryId && window.categoriesData ? window.categoriesData[match.categoryId] : null);
        
        // Získanie userId
        let userId = null;
        let teamNameForSearch = null;
        if (teamType === 'home') {
            teamNameForSearch = teamNames?.[match.homeTeamIdentifier] || match.homeTeamIdentifier;
        } else {
            teamNameForSearch = teamNames?.[match.awayTeamIdentifier] || match.awayTeamIdentifier;
        }
        
        if (window.db && teamNameForSearch && categoryNameForMatch) {
            try {
                const usersRef = collection(window.db, 'users');
                const usersSnapshot = await getDocs(usersRef);
                
                for (const userDoc of usersSnapshot.docs) {
                    const userData = userDoc.data();
                    const teams = userData.teams || {};
                    
                    for (const [categoryKey, teamsArray] of Object.entries(teams)) {
                        if (categoryKey !== categoryNameForMatch) continue;
                        
                        const foundTeam = (teamsArray || []).find(t => t.teamName === teamNameForSearch);
                        
                        if (foundTeam) {
                            let memberExists = false;
                            
                            if (member.typeKey === 'playerDetails') {
                                if (foundTeam.playerDetails && foundTeam.playerDetails[member.index]) {
                                    memberExists = true;
                                }
                            } else if (member.typeKey === 'menTeamMemberDetails') {
                                if (foundTeam.menTeamMemberDetails && foundTeam.menTeamMemberDetails[member.index]) {
                                    memberExists = true;
                                }
                            } else if (member.typeKey === 'womenTeamMemberDetails') {
                                if (foundTeam.womenTeamMemberDetails && foundTeam.womenTeamMemberDetails[member.index]) {
                                    memberExists = true;
                                }
                            }
                            
                            if (memberExists) {
                                userId = userDoc.id;
                                break;
                            }
                        }
                    }
                    if (userId) break;
                }
            } catch (err) {
                console.error('Chyba pri vyhľadávaní userId:', err);
            }
        }
        
        // Uloženie udalostí pre každú vybranú akciu
        const savedEvents = [];
        
        for (const selectedAction of selectedActions) {
            let eventType = '';
            let eventSubtype = null;
            
            switch (selectedAction) {
                case 'goal':
                    eventType = 'goal';
                    break;
                case '7m':
                    eventType = 'penalty';
                    eventSubtype = '7m';
                    break;
                case 'yellow':
                    eventType = 'card';
                    eventSubtype = 'yellow';
                    break;
                case 'red':
                    eventType = 'card';
                    eventSubtype = 'red';
                    break;
                case 'blue':
                    eventType = 'card';
                    eventSubtype = 'blue';
                    break;
                case 'exclusion':
                    eventType = 'exclusion';
                    break;
                default:
                    continue;
            }
            
            if (selectedActions.has('7m') && selectedActions.has('goal')) {
                if (selectedAction === '7m') {
                    continue;
                }
                eventType = 'goal';
                eventSubtype = 'converted_penalty'; 
            }
            
            // 🔥 ZMENA: Používame totalMatchTime namiesto displaySeconds
            const eventData = {
                matchId: matchId,
                totalTime: totalMatchTime,  // Celkový čas zápasu (súčet periód)
                period: currentPeriodNum,
                eventType: eventType,
                eventSubtype: eventSubtype,
                team: teamType,
                memberType: member.type,
                memberTypeKey: member.typeKey,
                memberIndex: member.index,
                userId: userId,
                categoryName: categoryNameForMatch,
                createdAt: Timestamp.now(),
                timestamp: Timestamp.now()
            };
            
            try {
                const eventsRef = collection(window.db, 'matchEvents');
                await addDoc(eventsRef, eventData);
                savedEvents.push(selectedAction);
                console.log(`Udalosť uložená: ${selectedAction} pre ${member.name} (${teamType}), celkový čas: ${totalMatchTime}s, perióda: ${currentPeriodNum}`);
            } catch (err) {
                console.error('Chyba pri ukladaní udalosti:', err);
            }
        }
        
        // Po úspešnom uložení vyčistíme vybrané akcie
        if (savedEvents.length > 0) {
            setSelectedActions(new Set());
            if (onActionSelected && typeof onActionSelected === 'function') {
                onActionSelected(null);
            }
            return true;
        }
        
        return false;
    };

    const saveMatchEvent = async (teamType, member) => {
        return await saveMatchEventInternalWithAction(teamType, member, selectedAction);
    };

    React.useImperativeHandle(ref, () => ({
        saveMatchEvent: saveMatchEvent,
        getSelectedAction: () => {
            if (selectedActions.size > 0) {
                return Array.from(selectedActions)[0];
            }
            return null;
        },
        getSelectedActions: () => {
            return selectedActions;
        },
        isTimerRunning: () => {
            return isRunningRef.current;
        },
        saveEventWithAction: async (teamType, member, action) => {
            return await saveMatchEventInternalWithAction(teamType, member, action);
        },
        getTotalTime: () => {
            return calculateTotalMatchTime();
        },
        getCurrentPeriod: () => {
            return period;
        }
    }));

    const handleManualResultSubmit = async () => {
        const homeScoreInt = parseInt(manualHomeScore);
        const awayScoreInt = parseInt(manualAwayScore);
        
        if (isNaN(homeScoreInt) || isNaN(awayScoreInt)) {
            return;
        }
        
        if (homeScoreInt < 0 || awayScoreInt < 0) {
            return;
        }
        
        if (window.db && matchId) {
            try {
                if (isRunningRef.current) {
                    stopLocalInterval();
                    setIsRunning(false);
                    isRunningRef.current = false;
                }
                
                const matchRef = doc(window.db, 'matches', matchId);
                
                await updateDoc(matchRef, {
                    homeScore: homeScoreInt,
                    awayScore: awayScoreInt,
                    finalScore: {
                        home: homeScoreInt,
                        away: awayScoreInt
                    },
                    status: 'completed',
                    manualResultEntered: true,
                    manualResultEnteredAt: Timestamp.now(),
                    manualTimeOffset: displaySeconds,
                    startedAt: null,
                    pausedAt: null,
                    updatedAt: Timestamp.now()
                });
                
                console.log(`Zápas ${matchId} bol ukončený s manuálnym výsledkom ${homeScoreInt}:${awayScoreInt}`);
                setShowManualResultModal(false);
                setManualHomeScore('');
                setManualAwayScore('');
                
                if (onTimeUpdate) onTimeUpdate({ totalSeconds: displaySeconds, period, isRunning: false });
                
                if (window.updateTeamNamesGlobally && typeof window.updateTeamNamesGlobally === 'function') {
                    await window.updateTeamNamesGlobally();
                }
            } catch (err) {
                console.error('Chyba pri ukladaní manuálneho výsledku:', err);
            }
        }
    };

    // Render modálov (renderManualResultModal, renderForfeitModal, renderEndMatchModal)
    const renderManualResultModal = () => {
        if (!showManualResultModal) return null;
        
        const homeTeamDisplayName = teamNames?.[match.homeTeamIdentifier] || getDisplayTeamName(match.homeTeamIdentifier);
        const awayTeamDisplayName = teamNames?.[match.awayTeamIdentifier] || getDisplayTeamName(match.awayTeamIdentifier);
        
        if (modalLoadingMapping) {
            return React.createElement(
                'div',
                { 
                    className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
                    onClick: () => {
                        setShowManualResultModal(false);
                        setManualHomeScore('');
                        setManualAwayScore('');
                    }
                },
                React.createElement(
                    'div',
                    { 
                        className: 'bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 p-6 text-center',
                        onClick: (e) => e.stopPropagation()
                    },
                    React.createElement('div', { className: 'animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4' }),
                    React.createElement('p', { className: 'text-gray-600' }, 'Načítavam názvy tímov...')
                )
            );
        }
        
        return React.createElement(
            'div',
            { 
                className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
                onClick: () => {
                    setShowManualResultModal(false);
                    setManualHomeScore('');
                    setManualAwayScore('');
                }
            },
            React.createElement(
                'div',
                { 
                    className: 'bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 p-6',
                    onClick: (e) => e.stopPropagation()
                },
                React.createElement(
                    'h3',
                    { className: 'text-xl font-bold text-gray-800 mb-4 text-center' },
                    'Zadať výsledok manuálne'
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-600 mb-6 text-center text-sm' },
                    'Zadajte konečný výsledok zápasu'
                ),
                React.createElement(
                    'div',
                    { className: 'flex gap-6 mb-8' },
                    React.createElement(
                        'div',
                        { className: 'flex-1 text-center' },
                        React.createElement(
                            'label',
                            { className: 'block text-base font-medium text-gray-700 mb-3' },
                            homeTeamDisplayName
                        ),
                        React.createElement(
                            'input',
                            {
                                type: 'number',
                                value: manualHomeScore,
                                onChange: (e) => setManualHomeScore(e.target.value),
                                className: 'w-full px-6 py-4 text-center text-3xl font-bold border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none',
                                min: '0',
                                step: '1'
                            }
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'flex items-center justify-center text-3xl font-bold text-gray-400 px-2' },
                        ':'
                    ),
                    React.createElement(
                        'div',
                        { className: 'flex-1 text-center' },
                        React.createElement(
                            'label',
                            { className: 'block text-base font-medium text-gray-700 mb-3' },
                            awayTeamDisplayName
                        ),
                        React.createElement(
                            'input',
                            {
                                type: 'number',
                                value: manualAwayScore,
                                onChange: (e) => setManualAwayScore(e.target.value),
                                className: 'w-full px-6 py-4 text-center text-3xl font-bold border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none',
                                min: '0',
                                step: '1'
                            }
                        )
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'flex gap-4' },
                    React.createElement(
                        'button',
                        {
                            onClick: () => {
                                setShowManualResultModal(false);
                                setManualHomeScore('');
                                setManualAwayScore('');
                            },
                            className: 'flex-1 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium transition-colors cursor-pointer text-center'
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            onClick: handleManualResultSubmit,
                            disabled: manualHomeScore === '' || manualAwayScore === '',
                            className: `flex-1 py-3 rounded-xl font-semibold transition-colors text-center ${
                                manualHomeScore !== '' && manualAwayScore !== ''
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                                    : 'bg-white text-blue-600 border-2 border-blue-600 cursor-not-allowed'
                            }`
                        },
                        'Potvrdiť'
                    )
                )
            )
        );
    };

    const handleForfeit = async () => {
        if (!window.db || !matchId || !selectedForfeitTeam) return;
        
        try {
            if (isRunningRef.current) {
                stopLocalInterval();
                setIsRunning(false);
                isRunningRef.current = false;
            }
            
            let homeScore = 0;
            let awayScore = 0;
            
            if (selectedForfeitTeam === 'home') {
                homeScore = 10;
                awayScore = 0;
            } else if (selectedForfeitTeam === 'away') {
                homeScore = 0;
                awayScore = 10;
            }
            
            const matchRef = doc(window.db, 'matches', matchId);
            
            await updateDoc(matchRef, {
                homeScore: homeScore,
                awayScore: awayScore,
                status: 'completed',
                isForfeit: true,
                forfeitTeam: selectedForfeitTeam,
                forfeitAt: Timestamp.now(),
                forfeitResult: {
                    isForfeit: true,
                    home: homeScore,
                    away: awayScore,
                    team: selectedForfeitTeam,
                    timestamp: Timestamp.now()
                },
                manualTimeOffset: 0,
                startedAt: null,
                pausedAt: null,
                updatedAt: Timestamp.now()
            });
            
            console.log(`Zápas ${matchId} bol kontumovaný`);
            setShowForfeitModal(false);
            setSelectedForfeitTeam(null);
            
            if (onTimeUpdate) onTimeUpdate({ totalSeconds: 0, period: 1, isRunning: false });
            
            if (window.updateTeamNamesGlobally && typeof window.updateTeamNamesGlobally === 'function') {
                await window.updateTeamNamesGlobally();
            }
        } catch (err) {
            console.error('Chyba pri kontumácii zápasu:', err);
        }
    };

    const renderForfeitModal = () => {
        if (!showForfeitModal) return null;
        
        const homeTeamDisplayName = teamNames?.[match.homeTeamIdentifier] || getDisplayTeamName(match.homeTeamIdentifier);
        const awayTeamDisplayName = teamNames?.[match.awayTeamIdentifier] || getDisplayTeamName(match.awayTeamIdentifier);
        
        if (modalLoadingMapping) {
            return React.createElement(
                'div',
                { 
                    className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
                    onClick: () => {
                        setShowForfeitModal(false);
                        setSelectedForfeitTeam(null);
                    }
                },
                React.createElement(
                    'div',
                    { 
                        className: 'bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 p-6 text-center',
                        onClick: (e) => e.stopPropagation()
                    },
                    React.createElement('div', { className: 'animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4' }),
                    React.createElement('p', { className: 'text-gray-600' }, 'Načítavam názvy tímov...')
                )
            );
        }
        
        return React.createElement(
            'div',
            { 
                className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
                onClick: () => {
                    setShowForfeitModal(false);
                    setSelectedForfeitTeam(null);
                }
            },
            React.createElement(
                'div',
                { 
                    className: 'bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 p-6',
                    onClick: (e) => e.stopPropagation()
                },
                React.createElement(
                    'h3',
                    { className: 'text-2xl font-bold text-gray-800 mb-4 text-center' },
                    'Kontumácia zápasu'
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-600 mb-6 text-center text-base' },
                    'Vyberte tím, v prospech ktorého sa zápas kontumuje (10:0)'
                ),
                React.createElement(
                    'div',
                    { className: 'flex gap-6 mb-8' },
                    React.createElement(
                        'button',
                        {
                            onClick: () => setSelectedForfeitTeam('home'),
                            className: `flex-1 py-4 rounded-xl font-bold transition-colors cursor-pointer text-center ${
                                selectedForfeitTeam === 'home' 
                                    ? 'bg-yellow-400 text-yellow-900 border-2 border-yellow-600' 
                                    : 'bg-gray-300 hover:bg-gray-400 text-gray-700'
                            }`
                        },
                            React.createElement('span', { className: 'block text-lg font-bold' }, 'Domáci'),
                            React.createElement('span', { className: 'block text-sm opacity-90 mt-1' }, homeTeamDisplayName)
                    ),
                    React.createElement(
                        'button',
                        {
                            onClick: () => setSelectedForfeitTeam('away'),
                            className: `flex-1 py-4 rounded-xl font-bold transition-colors cursor-pointer text-center ${
                                selectedForfeitTeam === 'away' 
                                    ? 'bg-yellow-400 text-yellow-900 border-2 border-yellow-600' 
                                    : 'bg-gray-300 hover:bg-gray-400 text-gray-700'
                            }`
                        },
                            React.createElement('span', { className: 'block text-lg font-bold' }, 'Hostia'),
                            React.createElement('span', { className: 'block text-sm opacity-90 mt-1' }, awayTeamDisplayName)
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'flex gap-4' },
                    React.createElement(
                        'button',
                        {
                            onClick: () => {
                                setShowForfeitModal(false);
                                setSelectedForfeitTeam(null);
                            },
                            className: 'flex-1 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold transition-colors cursor-pointer text-center'
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            onClick: () => handleForfeit(),
                            disabled: !selectedForfeitTeam,
                            className: `flex-1 py-3 rounded-xl font-bold transition-colors text-center ${
                                selectedForfeitTeam 
                                    ? 'bg-green-600 hover:bg-green-700 text-white cursor-pointer' 
                                    : 'bg-white text-green-600 border-2 border-green-600 cursor-not-allowed'
                            }`
                        },
                        'Potvrdiť'
                    )
                )
            )
        );
    };

    const renderEndMatchModal = () => {
        if (!showEndMatchModal) return null;
        
        return React.createElement(
            'div',
            { 
                className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
                onClick: () => setShowEndMatchModal(false)
            },
            React.createElement(
                'div',
                { 
                    className: 'bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6',
                    onClick: (e) => e.stopPropagation()
                },
                React.createElement(
                    'h3',
                    { className: 'text-xl font-bold text-gray-800 mb-4' },
                    'Ukončiť zápas'
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-600 mb-4' },
                    'Naozaj chcete ukončiť tento zápas?'
                ),
                React.createElement(
                    'p',
                    { className: 'text-sm text-blue-600 bg-blue-50 p-2 rounded-lg mb-6' },
                    React.createElement('i', { className: 'fa-solid fa-calculator mr-2' }),
                    'Konečný výsledok bude automaticky vypočítaný z gólových udalostí.'
                ),
                React.createElement(
                    'div',
                    { className: 'flex gap-3 justify-end' },
                    React.createElement(
                        'button',
                        {
                            onClick: () => setShowEndMatchModal(false),
                            className: 'px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 transition-colors cursor-pointer'
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            onClick: endMatch,
                            className: 'px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer'
                        },
                        'Ukončiť zápas'
                    )
                )
            )
        );
    };

    const formatTime = (totalSeconds) => {
        const totalMins = Math.floor(Math.max(0, totalSeconds) / 60);
        const totalSecs = Math.max(0, totalSeconds) % 60;
        return `${totalMins.toString().padStart(2, '0')}:${totalSecs.toString().padStart(2, '0')}`;
    };

    const formatPeriodTime = (periodSeconds) => {
        const mins = Math.floor(periodSeconds / 60);
        const secs = periodSeconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const updateDisplay = () => {
        if (!isRunningRef.current) return;
        const now = Date.now();
        const elapsed = Math.floor((now - startTimeRef.current) / 1000);
        const total = localStartOffsetRef.current + elapsed;
        const periodLength = periodDuration * 60;
        let clamped = Math.min(total, periodLength);
    
        const oldSeconds = displaySecondsRef.current;
        
        // Aktualizujeme čas
        setDisplaySeconds(clamped);
        
        // 🔥 OPRAVENÁ LOGIKA: AK SME DOSIAHLI ALEBO PREKROČILI KONIEC PERIÓDY, ZASTAVÍME ČASOVAČ
        if (clamped >= periodLength && isRunningRef.current) {
            console.log(`⏹️ Koniec periódy ${periodRef.current} - automatické zastavenie časovača (čas: ${clamped}s >= ${periodLength}s)`);
            stopTimerAndSave(true);
        }
    };

    const startLocalInterval = (startSeconds) => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        startTimeRef.current = Date.now();
        localStartOffsetRef.current = startSeconds;
        intervalRef.current = setInterval(updateDisplay, 200);
    };

    const stopLocalInterval = () => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        startTimeRef.current = null;
    };

    const stopTimerAndSave = async (isPeriodEnd = false) => {
        if (!isRunningRef.current) return;
        const finalSeconds = displaySeconds;
        stopLocalInterval();
        setIsRunning(false);
        isRunningRef.current = false;
        
        if (window.db && matchId) {
            try {
                lastServerUpdateRef.current = Date.now();
                const matchRef = doc(window.db, 'matches', matchId);
                
                const periodLength = periodDuration * 60;
                const isMatchComplete = period >= totalPeriods && finalSeconds >= periodLength;
                
                if (isMatchComplete) {
                    // Koniec zápasu
                    console.log(`🏆 Zápas bol ukončený, počítam výsledok z udalostí...`);
                    
                    const eventsRef = collection(window.db, 'matchEvents');
                    const q = query(eventsRef, where('matchId', '==', matchId));
                    const eventsSnapshot = await getDocs(q);
                    
                    let homeGoals = 0;
                    let awayGoals = 0;
                    
                    eventsSnapshot.forEach((eventDoc) => {
                        const event = eventDoc.data();
                        if (event.eventType === 'goal') {
                            if (event.team === 'home') homeGoals++;
                            else if (event.team === 'away') awayGoals++;
                        }
                    });
                    
                    console.log(`🏆 Vypočítaný výsledok: DOMÁCI ${homeGoals} : ${awayGoals} HOSTIA`);
                    
                    await updateDoc(matchRef, {
                        manualTimeOffset: finalSeconds,
                        status: 'completed',
                        startedAt: null,
                        pausedAt: Timestamp.now(),
                        updatedAt: Timestamp.now(),
                        homeScore: homeGoals,
                        awayScore: awayGoals,
                        finalScore: {
                            home: homeGoals,
                            away: awayGoals
                        },
                        completedAt: Timestamp.now(),
                        resultCalculatedFromEvents: true
                    });
                } else {
                    // Bežné zastavenie alebo koniec periódy
                    await updateDoc(matchRef, {
                        manualTimeOffset: finalSeconds,
                        status: 'paused',
                        startedAt: null,
                        pausedAt: Timestamp.now(),
                        updatedAt: Timestamp.now()
                    });
                    
                    if (isPeriodEnd) {
                        console.log(`⏹️ Koniec periódy ${period} - časovač zastavený na čase ${formatTime(finalSeconds)}`);
                    }
                }
                
                if (onTimeUpdate) onTimeUpdate({ 
                    totalSeconds: finalSeconds, 
                    period, 
                    isRunning: false,
                    periodEnded: isPeriodEnd && !isMatchComplete
                });
                
                setTimeout(() => { lastServerUpdateRef.current = 0; }, 300);
            } catch (err) { console.error(err); }
        }
    };

    const startTimer = async () => {
        if (match?.status === 'completed') return;
        if (isRunningRef.current) return;
        const currentSeconds = displaySeconds;
        const periodLength = periodDuration * 60;
        
        // 🔥 KONTROLA: Nemôžeme spustiť časovač ak sme na konci periódy
        if (currentSeconds >= periodLength) {
            console.log(`⚠️ Nemôžete spustiť časovač na konci periódy ${period}`);
            return;
        }
        
        startLocalInterval(currentSeconds);
        setIsRunning(true);
        isRunningRef.current = true;
        if (window.db && matchId) {
            try {
                lastServerUpdateRef.current = Date.now();
                const matchRef = doc(window.db, 'matches', matchId);
                await updateDoc(matchRef, {
                    manualTimeOffset: currentSeconds,
                    startedAt: Timestamp.now(),
                    status: 'in-progress',
                    pausedAt: null,
                    updatedAt: Timestamp.now()
                });
                if (onTimeUpdate) onTimeUpdate({ totalSeconds: currentSeconds, period, isRunning: true });
                setTimeout(() => { lastServerUpdateRef.current = 0; }, 300);
            } catch (err) {
                console.error(err);
                stopLocalInterval();
                setIsRunning(false);
                isRunningRef.current = false;
            }
        }
    };

    const addTime = (deltaSeconds) => {
        if (match?.status === 'completed') return;
        let newSeconds = displaySeconds + deltaSeconds;
        const periodLength = periodDuration * 60;
        if (newSeconds < 0) newSeconds = 0;
        if (newSeconds > periodLength) newSeconds = periodLength;
        setDisplaySeconds(newSeconds);
        
        // 🔥 AK SME DOSIAHLI KONIEC PERIÓDY, ZASTAVÍME ČASOVAČ
        if (newSeconds >= periodLength && isRunningRef.current) {
            console.log(`⏹️ Koniec periódy ${period} dosiahnutý manuálnym pridaním času - zastavujem časovač`);
            stopTimerAndSave(true);
        }
        
        if (isRunningRef.current) {
            startTimeRef.current = Date.now();
            localStartOffsetRef.current = newSeconds;
        }
        if (window.db && matchId) {
            lastServerUpdateRef.current = Date.now();
            const status = isRunningRef.current ? 'in-progress' : 'paused';
            const updateData = {
                manualTimeOffset: newSeconds,
                status: status,
                updatedAt: Timestamp.now()
            };
            if (!isRunningRef.current) updateData.pausedAt = Timestamp.now();
            if (isRunningRef.current) updateData.startedAt = Timestamp.now();
            updateDoc(doc(window.db, 'matches', matchId), updateData)
                .then(() => setTimeout(() => { lastServerUpdateRef.current = 0; }, 300))
                .catch(console.error);
        }
    };

    // Synchronizácia z DB (pre iné zariadenia)
    useEffect(() => {
        if (!window.db || !matchId) return;
        const matchRef = doc(window.db, 'matches', matchId);
        const unsubscribe = onSnapshot(matchRef, (docSnap) => {
            if (!docSnap.exists()) return;
            const now = Date.now();
            if (lastServerUpdateRef.current && (now - lastServerUpdateRef.current) < 300) return;
            const data = docSnap.data();
            const serverStatus = data.status;
            let serverSeconds = data.manualTimeOffset || 0;
            
            if (serverStatus === 'in-progress' && data.startedAt) {
                const elapsed = Math.floor((now - data.startedAt.toDate().getTime()) / 1000);
                const periodLength = periodDuration * 60;
                serverSeconds = Math.min(serverSeconds + elapsed, periodLength);
            }
            
            setDisplaySeconds(serverSeconds);
            
            if (serverStatus === 'in-progress') {
                if (!isRunningRef.current) {
                    startLocalInterval(serverSeconds);
                    setIsRunning(true);
                    isRunningRef.current = true;
                    if (onTimeUpdate) onTimeUpdate({ totalSeconds: serverSeconds, period, isRunning: true });
                } else {
                    const diff = Math.abs(serverSeconds - displaySecondsRef.current);
                    if (diff > 0.5) {
                        startLocalInterval(serverSeconds);
                        if (onTimeUpdate) onTimeUpdate({ totalSeconds: serverSeconds, period, isRunning: true });
                    }
                }
            } else if (serverStatus === 'paused' && isRunningRef.current) {
                stopLocalInterval();
                setIsRunning(false);
                isRunningRef.current = false;
                if (onTimeUpdate) onTimeUpdate({ totalSeconds: serverSeconds, period, isRunning: false });
            }
        });
        return () => unsubscribe();
    }, [matchId]);

    // Inicializácia z props
    useEffect(() => {
        if (!match) return;
        if (categorySettings) {
            if (categorySettings.periods !== undefined) setTotalPeriods(categorySettings.periods);
            if (categorySettings.periodDuration !== undefined) setPeriodDuration(categorySettings.periodDuration);
        }
        
        let initialSeconds = match.manualTimeOffset || 0;
        const periodLength = periodDuration * 60;
        
        if (match.status === 'in-progress' && match.startedAt) {
            const elapsed = Math.floor((Date.now() - match.startedAt.toDate().getTime()) / 1000);
            initialSeconds = Math.min(initialSeconds + elapsed, periodLength);
        }
        
        setDisplaySeconds(initialSeconds);
        
        if (match.status === 'in-progress') {
            startLocalInterval(initialSeconds);
            setIsRunning(true);
            isRunningRef.current = true;
        } else {
            stopLocalInterval();
            setIsRunning(false);
            isRunningRef.current = false;
        }
        
        return () => stopLocalInterval();
    }, [match?.id]);

    // 🔥 UPRAVENÉ: Kontrolné funkcie pre tlačidlá
    const periodLength = periodDuration * 60;
    const isAtPeriodEnd = displaySeconds >= periodLength;
    const canSubtractMinute = () => displaySeconds >= 60 && match?.status !== 'completed' && !isAtPeriodEnd;
    const canAddMinute = () => displaySeconds + 60 <= periodLength && match?.status !== 'completed';
    const canSubtractSecond = () => displaySeconds >= 1 && match?.status !== 'completed' && !isAtPeriodEnd;
    const canAddSecond = () => displaySeconds + 1 <= periodLength && match?.status !== 'completed';
    const canReset = () => true;

    const addMinute = () => canAddMinute() && addTime(60);
    const subtractMinute = () => canSubtractMinute() && addTime(-60);
    const addSecond = () => canAddSecond() && addTime(1);
    const subtractSecond = () => canSubtractSecond() && addTime(-1);
    const toggleTimer = () => {
        if (match?.status === 'completed') return;
    
        const periodLength = periodDuration * 60;
        const isAtPeriodEnd = displaySeconds >= periodLength;
    
        // 🔥 KONTROLA: Nemôžeme štartovať na konci periódy
        if (!isRunningRef.current && isAtPeriodEnd) {
            console.log(`⚠️ Nemôžete spustiť časovač na konci periódy ${period} (čas: ${formatTime(displaySeconds)})`);
            return;
        }
        
        isRunningRef.current ? stopTimerAndSave() : startTimer();
    };

    const resetTime = async () => {
        if (!canReset()) return;
    
        if (isRunningRef.current) {
            stopLocalInterval();
            setIsRunning(false);
            isRunningRef.current = false;
        }
    
        setDisplaySeconds(0);
        setPeriod(1);
        
        if (window.db && matchId) {
            try {
                lastServerUpdateRef.current = Date.now();
                const matchRef = doc(window.db, 'matches', matchId);
                
                const matchSnap = await getDoc(matchRef);
                const currentMatchData = matchSnap.exists() ? matchSnap.data() : {};
                
                console.log(`🗑️ Mažem všetky udalosti pre zápas ${matchId}...`);
                
                const eventsRef = collection(window.db, 'matchEvents');
                const q = query(eventsRef, where('matchId', '==', matchId));
                const eventsSnapshot = await getDocs(q);
                
                const deletePromises = [];
                eventsSnapshot.forEach((eventDoc) => {
                    deletePromises.push(deleteDoc(doc(window.db, 'matchEvents', eventDoc.id)));
                });
                
                if (deletePromises.length > 0) {
                    await Promise.all(deletePromises);
                    console.log(`✅ Vymazaných ${deletePromises.length} udalostí`);
                }
                
                const updateData = {
                    manualTimeOffset: 0,
                    currentPeriod: 1,
                    status: 'scheduled',
                    startedAt: null,
                    pausedAt: null,
                    updatedAt: Timestamp.now(),
                    homeScore: null,
                    awayScore: null,
                    isForfeit: null,
                    forfeitTeam: null,
                    forfeitAt: null,
                    forfeitResult: null
                };
                
                const fieldsToPreserve = [
                    'hallId', 'categoryId', 'categoryName', 'groupName', 
                    'homeTeamIdentifier', 'awayTeamIdentifier', 'matchType',
                    'isPlacementMatch', 'placementRank', 'scheduledTime'
                ];
                
                fieldsToPreserve.forEach(field => {
                    if (currentMatchData[field] !== undefined) {
                        updateData[field] = currentMatchData[field];
                    }
                });
                
                await updateDoc(matchRef, updateData);
                
                if (onTimeUpdate) onTimeUpdate({ 
                    totalSeconds: 0, 
                    period: 1, 
                    isRunning: false,
                    resetComplete: true,
                    resetEvents: true
                });
                
                setTimeout(() => { lastServerUpdateRef.current = 0; }, 300);
                
                console.log(`✅ Zápas ${matchId} bol resetovaný`);
                
            } catch (err) {
                console.error('Chyba pri resetovaní časovača:', err);
            }
        }
    };

    // 🔥 nextPeriod - manuálne prepnutie na ďalšiu periódu (neresetuje čas, len zvyšuje číslo periódy)
    const nextPeriod = async () => {
        if (match?.status === 'completed') return;
        if (period >= totalPeriods) return;
        
        // Zastavíme časovač ak beží
        if (isRunningRef.current) {
            await stopTimerAndSave();
        }
        
        const newPeriodNum = period + 1;
        const currentTimeSeconds = displaySeconds;
        
        if (window.db && matchId) {
            try {
                const matchRef = doc(window.db, 'matches', matchId);
                await updateDoc(matchRef, {
                    currentPeriod: newPeriodNum,
                    status: 'paused',
                    manualTimeOffset: currentTimeSeconds,  // Zachováme aktuálny čas
                    updatedAt: Timestamp.now()
                });
                setPeriod(newPeriodNum);
                periodRef.current = newPeriodNum;
                
                console.log(`⏩ Prepnuté na periódu ${newPeriodNum}, čas zostáva: ${formatTime(currentTimeSeconds)}`);
                
                if (onTimeUpdate) onTimeUpdate({ 
                    totalSeconds: currentTimeSeconds, 
                    period: newPeriodNum, 
                    isRunning: false 
                });
            } catch (err) {
                console.error('Chyba pri manuálnom prepnutí periódy:', err);
            }
        }
    };
    
    // 🔥 prevPeriod - manuálne prepnutie na predchádzajúcu periódu
    const prevPeriod = async () => {
        if (match?.status === 'completed') return;
        if (period <= 1) return;
        
        // Zastavíme časovač ak beží
        if (isRunningRef.current) {
            await stopTimerAndSave();
        }
        
        const newPeriodNum = period - 1;
        
        if (window.db && matchId) {
            try {
                const matchRef = doc(window.db, 'matches', matchId);
                await updateDoc(matchRef, {
                    currentPeriod: newPeriodNum,
                    status: 'paused',
                    updatedAt: Timestamp.now()
                });
                setPeriod(newPeriodNum);
                periodRef.current = newPeriodNum;
                
                if (onTimeUpdate) onTimeUpdate({ 
                    totalSeconds: displaySeconds, 
                    period: newPeriodNum, 
                    isRunning: false 
                });
            } catch (err) {
                console.error('Chyba pri manuálnom prepnutí periódy:', err);
            }
        }
    };

    // Upravená endMatch funkcia - automatický výpočet výsledku z gólových udalostí
    const endMatch = async () => {
        if (window.db && matchId) {
            try {
                if (isRunningRef.current) {
                    stopLocalInterval();
                    setIsRunning(false);
                    isRunningRef.current = false;
                }
                
                // 🔥 NAČÍTANIE VŠETKÝCH UDALOSTÍ ZÁPASU PRE VÝPOČET VÝSLEDKU
                console.log(`📊 Výpočet konečného výsledku z gólových udalostí pre zápas ${matchId}...`);
                
                const eventsRef = collection(window.db, 'matchEvents');
                const q = query(eventsRef, where('matchId', '==', matchId));
                const eventsSnapshot = await getDocs(q);
                
                let homeGoals = 0;
                let awayGoals = 0;
                
                eventsSnapshot.forEach((eventDoc) => {
                    const event = eventDoc.data();
                    if (event.eventType === 'goal') {
                        if (event.team === 'home') {
                            homeGoals++;
                        } else if (event.team === 'away') {
                            awayGoals++;
                        }
                    }
                });
                
                console.log(`🏆 Vypočítaný výsledok: DOMÁCI ${homeGoals} : ${awayGoals} HOSTIA`);
                
                // 🔥 AKTUALIZÁCIA ZÁPASU S VÝSLEDKOM
                const matchRef = doc(window.db, 'matches', matchId);
                
                // Získame aktuálne dáta zápasu pre zachovanie existujúcich údajov
                const matchSnap = await getDoc(matchRef);
                const currentMatchData = matchSnap.exists() ? matchSnap.data() : {};
                
                const updateData = {
                    status: 'completed',
                    updatedAt: Timestamp.now(),
                    homeScore: homeGoals,
                    awayScore: awayGoals,
                    finalScore: {
                        home: homeGoals,
                        away: awayGoals
                    },
                    completedAt: Timestamp.now(),
                    resultCalculatedFromEvents: true
                };
                
                // Zachováme existujúce údaje, ktoré nechceme prepísať
                const fieldsToPreserve = [
                    'hallId', 'categoryId', 'categoryName', 'groupName', 
                    'homeTeamIdentifier', 'awayTeamIdentifier', 'matchType',
                    'isPlacementMatch', 'placementRank', 'scheduledTime',
                    'manualTimeOffset', 'currentPeriod'
                ];
                
                fieldsToPreserve.forEach(field => {
                    if (currentMatchData[field] !== undefined) {
                        updateData[field] = currentMatchData[field];
                    }
                });
                
                await updateDoc(matchRef, updateData);
                
                console.log(`✅ Zápas ${matchId} bol ukončený s výsledkom ${homeGoals}:${awayGoals} (automaticky vypočítaný z udalostí)`);
                setShowEndMatchModal(false);
                
                if (onTimeUpdate) onTimeUpdate({ 
                    totalSeconds: displaySeconds, 
                    period, 
                    isRunning: false,
                    finalScore: { home: homeGoals, away: awayGoals }
                });
                
                if (window.updateTeamNamesGlobally && typeof window.updateTeamNamesGlobally === 'function') {
                    await window.updateTeamNamesGlobally();
                }
                
            } catch (err) {
                console.error('Chyba pri ukončovaní zápasu:', err);
            }
        }
    };

    const isMatchCompleted = match?.status === 'completed';
    
    // 🔥 Zobrazenie času
    const periodStart = 0;
    const periodEnd = periodDuration;
    const isMinusMinuteDisabled = !canSubtractMinute();
    const isMinusSecondDisabled = !canSubtractSecond();
    const isPlusMinuteDisabled = !canAddMinute();
    const isPlusSecondDisabled = !canAddSecond();
    
    if (isMatchCompleted) {
        return React.createElement('div', { className: 'bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden' },
            React.createElement('div', { className: 'bg-gray-50 px-6 py-3 border-b border-gray-200' },
                React.createElement('h3', { className: 'font-semibold text-gray-800' }, 'Športový časovač'),
                React.createElement('p', { className: 'text-xs text-gray-500 mt-0.5' }, `Trvanie periódy: ${periodDuration} min | Počet periód: ${totalPeriods}`)
            ),
            React.createElement('div', { className: 'p-6' },
                React.createElement('div', { className: 'text-center mb-6 py-4' },
                    React.createElement('div', { className: 'inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-50 text-green-700' },
                        React.createElement('i', { className: 'fa-solid fa-flag-checkered' }),
                        React.createElement('span', { className: 'font-medium' }, 'Zápas bol ukončený')
                    )
                ),
                React.createElement('div', { className: 'flex flex-wrap items-center justify-center gap-2' },
                    React.createElement('button', { 
                        onClick: resetTime, 
                        className: 'px-4 py-2 rounded-lg font-semibold transition-colors text-sm bg-yellow-500 hover:bg-yellow-600 text-white cursor-pointer'
                    }, 
                        React.createElement('i', { className: 'fa-solid fa-arrow-rotate-left mr-1' }), 'Reset'
                    )
                )
            )
        );
    }
    
    return React.createElement('div', { className: 'bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden' },
        React.createElement('div', { className: 'bg-gray-50 px-6 py-3 border-b border-gray-200' },
            React.createElement('h3', { className: 'font-semibold text-gray-800' }, 'Športový časovač'),
            React.createElement('p', { className: 'text-xs text-gray-500 mt-0.5' }, `Trvanie periódy: ${periodDuration} min | Počet periód: ${totalPeriods}`)
        ),
        React.createElement('div', { className: 'p-6' },
            // 🔥 Zobrazenie času - čas v perióde (bez prestávok)
            React.createElement('div', { className: 'text-center mb-4' },
                React.createElement('div', { className: 'text-6xl font-mono font-bold text-gray-800' }, formatTime(displaySeconds)),
                React.createElement('div', { className: 'text-sm text-gray-500' }, 
                    `Perióda ${period} / ${totalPeriods}`
                ),
                isAtPeriodEnd && React.createElement('div', { className: 'mt-1 text-xs text-red-500 font-medium' }, 
                    '⏹️ Koniec periódy - použite tlačidlo "Ďalšia perióda"'
                )
            ),
            
            React.createElement('div', { className: 'flex flex-wrap items-center justify-center gap-2 mb-6' },
                React.createElement('button', { 
                    onClick: toggleTimer, 
                    disabled: isAtPeriodEnd,
                    className: `px-4 py-2 rounded-lg font-semibold transition-colors text-sm ${
                        isAtPeriodEnd ? 'bg-gray-300 text-gray-500 cursor-not-allowed' :
                        isRunning ? 'bg-red-600 hover:bg-red-700 text-white cursor-pointer' : 'bg-green-600 hover:bg-green-700 text-white cursor-pointer'
                    }` 
                },
                    React.createElement('i', { className: isRunning ? 'fa-solid fa-stop mr-1' : 'fa-solid fa-play mr-1' }), isRunning ? 'Stop' : 'Štart'
                ),
                React.createElement('span', { className: 'text-gray-300 mx-1' }, '|'),
                React.createElement('button', { 
                    onClick: subtractMinute, 
                    disabled: isMinusMinuteDisabled,
                    title: isMinusMinuteDisabled ? (displaySeconds < 60 ? 'Nie je možné odpočítať minútu (menej ako 1 minúta)' : '') : '',
                    className: `px-3 py-2 rounded-lg font-semibold transition-colors text-sm ${isMinusMinuteDisabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300 text-gray-700 cursor-pointer'}` 
                }, React.createElement('i', { className: 'fa-solid fa-minus' })),
                React.createElement('span', { className: 'text-sm text-gray-600 px-1 font-medium' }, 'Min'),
                React.createElement('button', { 
                    onClick: addMinute, 
                    disabled: isPlusMinuteDisabled,
                    title: isPlusMinuteDisabled ? (displaySeconds + 60 > periodLength ? 'Nie je možné pridať minútu (koniec periódy)' : '') : '',
                    className: `px-3 py-2 rounded-lg font-semibold transition-colors text-sm ${isPlusMinuteDisabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300 text-gray-700 cursor-pointer'}` 
                }, React.createElement('i', { className: 'fa-solid fa-plus' })),
                React.createElement('span', { className: 'text-gray-300 mx-1' }, '|'),
                React.createElement('button', { 
                    onClick: subtractSecond, 
                    disabled: isMinusSecondDisabled,
                    title: isMinusSecondDisabled ? (displaySeconds < 1 ? 'Nie je možné odpočítať sekundu (menej ako 1 sekunda)' : '') : '',
                    className: `px-3 py-2 rounded-lg font-semibold transition-colors text-sm ${isMinusSecondDisabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300 text-gray-700 cursor-pointer'}` 
                }, React.createElement('i', { className: 'fa-solid fa-minus' })),
                React.createElement('span', { className: 'text-sm text-gray-600 px-1 font-medium' }, 'Sec'),
                React.createElement('button', { 
                    onClick: addSecond, 
                    disabled: isPlusSecondDisabled,
                    title: isPlusSecondDisabled ? (displaySeconds + 1 > periodLength ? 'Nie je možné pridať sekundu (koniec periódy)' : '') : '',
                    className: `px-3 py-2 rounded-lg font-semibold transition-colors text-sm ${isPlusSecondDisabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300 text-gray-700 cursor-pointer'}` 
                }, React.createElement('i', { className: 'fa-solid fa-plus' })),
                React.createElement('span', { className: 'text-gray-300 mx-1' }, '|'),
                React.createElement('button', { 
                    onClick: prevPeriod, 
                    disabled: period <= 1 || isRunning,
                    title: period <= 1 ? 'Už ste na prvej perióde' : (isRunning ? 'Zastavte časovač pre prepnutie periódy' : ''),
                    className: `px-3 py-2 rounded-lg font-semibold transition-colors text-sm ${period <= 1 || isRunning ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300 text-gray-700 cursor-pointer'}` 
                }, React.createElement('i', { className: 'fa-solid fa-chevron-left' })),
                React.createElement('span', { className: 'text-sm text-gray-800 font-semibold px-1' }, 'Perióda'),
                React.createElement('button', { 
                    onClick: nextPeriod, 
                    disabled: period >= totalPeriods || isRunning,
                    title: period >= totalPeriods ? 'Už ste na poslednej perióde' : (isRunning ? 'Zastavte časovač pre prepnutie periódy' : ''),
                    className: `px-3 py-2 rounded-lg font-semibold transition-colors text-sm ${period >= totalPeriods || isRunning ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300 text-gray-700 cursor-pointer'}` 
                }, React.createElement('i', { className: 'fa-solid fa-chevron-right' })),
                React.createElement('span', { className: 'text-gray-300 mx-1' }, '|'),
                React.createElement('button', { onClick: resetTime, className: 'px-4 py-2 rounded-lg font-semibold transition-colors text-sm bg-yellow-500 hover:bg-yellow-600 text-white cursor-pointer' }, React.createElement('i', { className: 'fa-solid fa-arrow-rotate-left mr-1' }), 'Reset')
            ),
            
            React.createElement('div', { className: 'flex flex-wrap items-center justify-center gap-2 mb-6 pt-2 border-t border-gray-100' },
                React.createElement('button', { 
                    onClick: () => setShowEndMatchModal(true), 
                    className: 'px-4 py-2 rounded-lg font-semibold transition-colors text-sm bg-red-600 hover:bg-red-700 text-white cursor-pointer'
                },
                    React.createElement('i', { className: 'fa-solid fa-flag-checkered mr-1' }), 'Ukončiť zápas'
                ),
                React.createElement('button', { 
                    onClick: () => setShowManualResultModal(true), 
                    className: 'px-4 py-2 rounded-lg font-semibold transition-colors text-sm bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                },
                    React.createElement('i', { className: 'fa-solid fa-pen-to-square mr-1' }), 'Zadať výsledok manuálne'
                ),
                React.createElement('button', { 
                    onClick: () => setShowForfeitModal(true), 
                    className: 'px-4 py-2 rounded-lg font-semibold transition-colors text-sm bg-purple-600 hover:bg-purple-700 text-white cursor-pointer'
                },
                    React.createElement('i', { className: 'fa-solid fa-gavel mr-1' }), 'Kontumácia'
                )
            ),
            
            React.createElement('div', { className: 'flex flex-wrap items-center justify-center gap-2 pt-2 border-t border-gray-100' },
                React.createElement('button', { 
                    onClick: () => handleActionClick('goal'), 
                    className: getActionButtonClass('goal')
                }, 'Gól'),
                React.createElement('button', { 
                    onClick: () => handleActionClick('7m'), 
                    className: getActionButtonClass('7m')
                }, '7m'),
                React.createElement('button', { 
                    onClick: () => handleActionClick('yellow'), 
                    className: getActionButtonClass('yellow')
                }, 'ŽK'),
                React.createElement('button', { 
                    onClick: () => handleActionClick('red'), 
                    className: getActionButtonClass('red')
                }, 'ČK'),
                React.createElement('button', { 
                    onClick: () => handleActionClick('blue'), 
                    className: getActionButtonClass('blue')
                }, 'MK'),
                React.createElement('button', { 
                    onClick: () => handleActionClick('exclusion'), 
                    className: getActionButtonClass('exclusion')
                }, 'Vylúčenie')
            )
        ),
        renderEndMatchModal(),
        renderForfeitModal(),
        renderManualResultModal()
    );
});

// Komponent pre detail zápasu (s navigáciou medzi zápasmi a časovačom)
const MatchDetailView = ({ match, teamNames, onBack, hallInfo, categoryDrawColors, groupsData, allMatches, currentMatchIndex, onNavigate, onMatchUpdate }) => {
    const dateTime = formatMatchDateTime(match.scheduledTime);
    const [currentHomeScore, setCurrentHomeScore] = React.useState(match.homeScore);
    const [currentAwayScore, setCurrentAwayScore] = React.useState(match.awayScore);
    const isResultAvailable = currentHomeScore !== undefined && currentHomeScore !== null && currentAwayScore !== undefined && currentAwayScore !== null;
    const homeTeamDisplay = teamNames[match.homeTeamIdentifier] || getDisplayTeamName(match.homeTeamIdentifier);
    const awayTeamDisplay = teamNames[match.awayTeamIdentifier] || getDisplayTeamName(match.awayTeamIdentifier);
    const categoryColor = getCategoryDrawColor(match.categoryId);
    const lighterCategoryColor = getLighterColor(categoryColor);
    const matchColors = getMatchColors(match, groupsData);

    const matchTimerRef = React.useRef(null);
    
    // STATE pre nastavenia kategórie
    const [categorySettings, setCategorySettings] = React.useState(null);
    const [loadingSettings, setLoadingSettings] = React.useState(true);
    
    // STATE pre aktuálny status zápasu (pre prípad, že by sa zmenil)
    const [currentMatchStatus, setCurrentMatchStatus] = React.useState(match.status || 'scheduled');

    const [homeTeamMappedName, setHomeTeamMappedName] = React.useState(homeTeamDisplay);
    const [awayTeamMappedName, setAwayTeamMappedName] = React.useState(awayTeamDisplay);
    
    // Stavy pre udalosti
    const [matchEvents, setMatchEvents] = React.useState([]);
    const [eventsLoading, setEventsLoading] = React.useState(true);
    
    // 🔥 NOVÉ: Stavy pre počítanie gólov z udalostí (pre manuálne zadaný výsledok)
    const [calculatedHomeScore, setCalculatedHomeScore] = React.useState(0);
    const [calculatedAwayScore, setCalculatedAwayScore] = React.useState(0);
    const [useCalculatedScore, setUseCalculatedScore] = React.useState(false);
    
    // Získanie názvu kategórie z ID (pre vyhľadávanie členov tímu)
    const getCategoryDisplayName = () => {
        if (match.categoryName) return match.categoryName;
        if (match.categoryId && window.categoriesData && window.categoriesData[match.categoryId]) {
            return window.categoriesData[match.categoryId];
        }
        return null;
    };
    
    const categoryDisplayName = getCategoryDisplayName();
    
    // 🔥 FUNKCIA: Výpočet gólov z udalostí
    const calculateGoalsFromEvents = (events) => {
        let homeGoals = 0;
        let awayGoals = 0;
        
        events.forEach(event => {
            if (event.eventType === 'goal') {
                if (event.team === 'home') {
                    homeGoals++;
                } else if (event.team === 'away') {
                    awayGoals++;
                }
            }
        });
        
        return { homeGoals, awayGoals };
    };

    React.useEffect(() => {
        // Ak je resetComplete a resetEvents, vynulujeme vypočítané skóre
        if (match.resetComplete || match.resetEvents) {
            setCalculatedHomeScore(0);
            setCalculatedAwayScore(0);
            setUseCalculatedScore(false);
        }
    }, [match.resetComplete, match.resetEvents]);
    
    // 🔥 EFEKT: Počítanie gólov z udalostí (vždy pre prebiehajúce zápasy)
    React.useEffect(() => {
        // Ak je zápas v stave 'in-progress' alebo 'paused', vždy používame skóre z udalostí
        const isMatchInProgress = currentMatchStatus === 'in-progress' || currentMatchStatus === 'paused';
    
        if (isMatchInProgress) {
            const { homeGoals, awayGoals } = calculateGoalsFromEvents(matchEvents);
            setCalculatedHomeScore(homeGoals);
            setCalculatedAwayScore(awayGoals);
            setUseCalculatedScore(true);
            console.log(`📊 Výpočet gólov z udalostí (prebiehajúci zápas): DOMÁCI ${homeGoals} : ${awayGoals} HOSTIA`);
        } else {
            setUseCalculatedScore(false);
        }
    }, [matchEvents, currentMatchStatus]);
        
    // Načítanie udalostí pre zápas
    const loadMatchEvents = async () => {
        if (!window.db || !match.id) return;
        
        try {
            const eventsRef = collection(window.db, 'matchEvents');
            const q = query(eventsRef, where('matchId', '==', match.id), orderBy('timestamp', 'desc'));
            const querySnapshot = await getDocs(q);
            const events = [];
            querySnapshot.forEach((doc) => {
                events.push({ id: doc.id, ...doc.data() });
            });
            setMatchEvents(events);
        } catch (err) {
            console.error('Chyba pri načítaní udalostí:', err);
        } finally {
            setEventsLoading(false);
        }
    };

    // Real-time listener pre udalosti
    React.useEffect(() => {
        if (!window.db || !match.id) return;
        
        loadMatchEvents();
        
        const eventsRef = collection(window.db, 'matchEvents');
        const q = query(eventsRef, where('matchId', '==', match.id), orderBy('timestamp', 'desc'));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const events = [];
            snapshot.forEach((doc) => {
                events.push({ id: doc.id, ...doc.data() });
            });
            setMatchEvents(events);
            setEventsLoading(false);
        }, (error) => {
            console.error('Chyba pri real-time načítaní udalostí:', error);
            setEventsLoading(false);
        });
        
        return () => unsubscribe();
    }, [match.id]);
    
    // 🔥 FUNKCIA: Získanie aktuálneho skóre pre zobrazenie
    const getDisplayScore = () => {
        // Ak je zápas ukončený a má výsledok v databáze, zobrazíme ten
        if (currentMatchStatus === 'completed' && currentHomeScore !== undefined && currentHomeScore !== null) {
            return { home: currentHomeScore, away: currentAwayScore };
        }
        
        // Ak používame vypočítané skóre z udalostí (časovač beží alebo je pozastavený)
        if (useCalculatedScore) {
            return { home: calculatedHomeScore, away: calculatedAwayScore };
        }
        
        // Inak zobrazíme pôvodný výsledok (ak existuje)
        if (currentHomeScore !== undefined && currentHomeScore !== null) {
            return { home: currentHomeScore, away: currentAwayScore };
        }
        
        return null;
    };
    
    // Funkcia na získanie textu stavu zápasu
    const getMatchStatusText = () => {
        switch (currentMatchStatus) {
            case 'in-progress':
                return 'Práve prebieha';
            case 'paused':
                return 'Pozastavený';
            case 'completed':
                return 'Ukončený';
            case 'scheduled':
            default:
                return 'Naplánovaný';
        }
    };
    
    // Funkcia na získanie farby stavu zápasu
    const getMatchStatusColor = () => {
        switch (currentMatchStatus) {
            case 'in-progress':
                return 'text-green-600 bg-green-50';
            case 'paused':
                return 'text-yellow-600 bg-yellow-50';
            case 'completed':
                return 'text-blue-600 bg-blue-50';
            case 'scheduled':
            default:
                return 'text-gray-500 bg-gray-50';
        }
    };

    // Opravená renderMatchEvents funkcia v MatchDetailView komponente
    const renderMatchEvents = () => {
        const [memberDataCache, setMemberDataCache] = React.useState({});
        
        // 🔥 FUNKCIA: Načítanie údajov člena z databázy podľa userId, categoryName, teamName, typeKey a indexu
        const loadMemberDetails = async (userId, categoryName, teamName, memberTypeKey, memberIndex, eventId) => {
            if (!userId || !memberTypeKey || memberIndex === undefined) {
                return { name: 'Neznámy hráč', jerseyNumber: '' };
            }
            
            // Skontrolujeme cache - pridáme aj categoryName a teamName do cache kľúča
            const cacheKey = `${userId}_${categoryName}_${teamName}_${memberTypeKey}_${memberIndex}`;
            if (memberDataCache[cacheKey]) {
                return memberDataCache[cacheKey];
            }
            
            try {
                const userRef = doc(window.db, 'users', userId);
                const userSnap = await getDoc(userRef);
                
                if (userSnap.exists()) {
                    const userData = userSnap.data();
                    const teams = userData.teams || {};
                    
                    // 🔥 HĽADÁME TÍM V SPRÁVNEJ KATEGÓRII A S PRESNÝM NÁZVOM
                    for (const [categoryKey, teamsArray] of Object.entries(teams)) {
                        if (categoryKey !== categoryName) continue;
                        
                        // Hľadáme tím s presným názvom
                        const foundTeam = (teamsArray || []).find(t => t.teamName === teamName);
                        
                        if (foundTeam) {
                            let member = null;
                            
                            if (memberTypeKey === 'playerDetails' && foundTeam.playerDetails && foundTeam.playerDetails[memberIndex]) {
                                member = foundTeam.playerDetails[memberIndex];
                            } else if (memberTypeKey === 'menTeamMemberDetails' && foundTeam.menTeamMemberDetails && foundTeam.menTeamMemberDetails[memberIndex]) {
                                member = foundTeam.menTeamMemberDetails[memberIndex];
                            } else if (memberTypeKey === 'womenTeamMemberDetails' && foundTeam.womenTeamMemberDetails && foundTeam.womenTeamMemberDetails[memberIndex]) {
                                member = foundTeam.womenTeamMemberDetails[memberIndex];
                            }
                            
                            if (member) {
                                const memberData = {
                                    name: `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Neznámy hráč',
                                    jerseyNumber: member.jerseyNumber || ''
                                };
                                
                                // Uložíme do cache
                                setMemberDataCache(prev => ({ ...prev, [cacheKey]: memberData }));
                                return memberData;
                            }
                        }
                    }
                }
            } catch (err) {
                console.error('Chyba pri načítaní člena:', err);
            }
            
            return { name: 'Neznámy hráč', jerseyNumber: '' };
        };
        
        const getEventIcon = (eventType, eventSubtype) => {
            switch (eventType) {
                case 'goal':
                    if (eventSubtype === 'converted_penalty') {
                        return React.createElement('i', { className: 'fa-solid fa-futbol text-green-600', style: { fontSize: '18px' } });
                    }
                    return React.createElement('i', { className: 'fa-solid fa-futbol text-black', style: { fontSize: '18px' } });
                case 'penalty':
                    return React.createElement('i', { className: 'fa-solid fa-futbol text-red-600', style: { fontSize: '18px' } });
                case 'card':
                    if (eventSubtype === 'yellow') return React.createElement('i', { className: 'fa-solid fa-square text-yellow-500', style: { fontSize: '18px' } });
                    if (eventSubtype === 'red') return React.createElement('i', { className: 'fa-solid fa-square text-red-600', style: { fontSize: '18px' } });
                    if (eventSubtype === 'blue') return React.createElement('i', { className: 'fa-solid fa-square text-blue-500', style: { fontSize: '18px' } });
                    return React.createElement('i', { className: 'fa-solid fa-id-card', style: { fontSize: '18px' } });
                case 'exclusion':
                    return React.createElement('i', { className: 'fa-solid fa-clock text-orange-600', style: { fontSize: '18px' } });
                default:
                    return React.createElement('i', { className: 'fa-solid fa-circle-info', style: { fontSize: '18px' } });
            }
        };
        
        const formatMatchTime = (event) => {
            let seconds = event.totalTime;
            if (seconds === undefined || seconds === null) {
                seconds = event.matchTime;
            }
            if (seconds === undefined || seconds === null) {
                return '?:??';
            }
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        };
        
        // 🔥 FUNKCIA: Získanie zobrazenia pre hráča (načítava údaje z databázy)
        const PlayerDisplay = ({ event, isHomeEvent }) => {
            const [memberData, setMemberData] = React.useState({ name: 'Načítavam...', jerseyNumber: '' });
            const [loading, setLoading] = React.useState(true);
            
            // Získanie názvu tímu podľa toho, či ide o domáci alebo hosťujúci tím
            const teamName = isHomeEvent 
                ? (teamNames?.[match.homeTeamIdentifier] || getDisplayTeamName(match.homeTeamIdentifier))
                : (teamNames?.[match.awayTeamIdentifier] || getDisplayTeamName(match.awayTeamIdentifier));
            
            React.useEffect(() => {
                const loadData = async () => {
                    const data = await loadMemberDetails(
                        event.userId, 
                        event.categoryName,  // 🔥 POUŽIJEME KATEGÓRIU Z UDALOSTI
                        teamName,            // 🔥 POUŽIJEME NÁZOV TÍMU
                        event.memberTypeKey, 
                        event.memberIndex, 
                        event.id
                    );
                    setMemberData(data);
                    setLoading(false);
                };
                loadData();
            }, [event.userId, event.categoryName, teamName, event.memberTypeKey, event.memberIndex]);
            
            if (loading) {
                return React.createElement('span', { className: 'text-gray-400 text-xs' }, 'Načítavam...');
            }
            
            const displayName = memberData.name;
            const jerseyNumber = memberData.jerseyNumber;
            
            if (isHomeEvent) {
                return React.createElement(
                    'div',
                    { className: 'flex items-center justify-end gap-2' },
                    React.createElement('span', { className: 'text-gray-800' }, displayName),
                    jerseyNumber && React.createElement(
                        'span',
                        { className: 'inline-flex items-center justify-center bg-gray-100 text-gray-600 rounded-full w-6 h-6 text-xs font-mono font-bold' },
                        jerseyNumber
                    )
                );
            } else {
                return React.createElement(
                    'div',
                    { className: 'flex items-center gap-2' },
                    jerseyNumber && React.createElement(
                        'span',
                        { className: 'inline-flex items-center justify-center bg-gray-100 text-gray-600 rounded-full w-6 h-6 text-xs font-mono font-bold' },
                        jerseyNumber
                    ),
                    React.createElement('span', { className: 'text-gray-800' }, displayName)
                );
            }
        };
        
        // 🔥 FUNKCIA: Výpočet skóre v čase udalosti (pre góly)
        const getScoreAtEvent = (currentEventIndex, targetEvent) => {
            if (targetEvent.eventType !== 'goal') return null;
            
            let homeGoals = 0;
            let awayGoals = 0;
            
            const reversedEvents = [...matchEvents].reverse();
            
            for (let i = 0; i < reversedEvents.length; i++) {
                const event = reversedEvents[i];
                if (event.id === targetEvent.id) break;
                
                if (event.eventType === 'goal') {
                    if (event.team === 'home') homeGoals++;
                    else if (event.team === 'away') awayGoals++;
                }
            }
            
            if (targetEvent.team === 'home') homeGoals++;
            else if (targetEvent.team === 'away') awayGoals++;
            
            return { home: homeGoals, away: awayGoals };
        };
        
        return React.createElement(
            'div',
            { className: 'mt-6 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden' },
            React.createElement(
                'div',
                { className: 'bg-gray-50 px-6 py-3 border-b border-gray-200' },
                React.createElement('h3', { className: 'font-semibold text-center text-gray-800' }, 'Udalosti zápasu'),
            ),
            React.createElement(
                'div',
                { className: 'w-full' },
                eventsLoading ? 
                    React.createElement('div', { className: 'text-center py-8 text-gray-400' }, 
                        React.createElement('div', { className: 'animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400 mx-auto' }),
                        React.createElement('p', { className: 'text-sm mt-2' }, 'Načítavam udalosti...')
                    ) :
                    matchEvents.length === 0 ?
                        React.createElement('div', { className: 'text-center py-8 text-gray-400' },
                            React.createElement('i', { className: 'fa-regular fa-clock text-3xl mb-2 opacity-50' }),
                            React.createElement('p', { className: 'text-sm' }, 'Žiadne udalosti zápasu.')
                        ) :
                        React.createElement(
                            'table',
                            { className: 'min-w-full divide-y divide-gray-100' },
                            React.createElement(
                                'thead',
                                { className: 'bg-gray-50' },
                                React.createElement(
                                    'tr',
                                    null,
                                    React.createElement('th', { className: 'px-4 py-2 text-right text-xs font-medium text-gray-500 w-1/4' }, 'Domáci'),
                                    React.createElement('th', { className: 'px-4 py-2 text-center text-xs font-medium text-gray-500 w-16' }, 'Skóre'),
                                    React.createElement('th', { className: 'px-4 py-2 text-center text-xs font-medium text-gray-500 w-12' }, 'Udalosť'),
                                    React.createElement('th', { className: 'px-4 py-2 text-center text-xs font-medium text-gray-500 w-20' }, 'Čas'),
                                    React.createElement('th', { className: 'px-4 py-2 text-center text-xs font-medium text-gray-500 w-12' }, 'Udalosť'),
                                    React.createElement('th', { className: 'px-4 py-2 text-center text-xs font-medium text-gray-500 w-16' }, 'Skóre'),
                                    React.createElement('th', { className: 'px-4 py-2 text-left text-xs font-medium text-gray-500 w-1/4' }, 'Hostia')
                                )
                            ),
                            React.createElement(
                                'tbody',
                                { className: 'divide-y divide-gray-100' },
                                matchEvents.map((event, idx) => {
                                    const isHomeEvent = event.team === 'home';
                                    const isGoal = event.eventType === 'goal';
                                    const score = isGoal ? getScoreAtEvent(idx, event) : null;
                                    
                                    const getActionTitle = () => {
                                        switch (event.eventType) {
                                            case 'goal': 
                                                if (event.eventSubtype === 'converted_penalty') return '7m (premenený)';
                                                return 'Gól';
                                            case 'penalty': 
                                                return '7m (nepremenený)';
                                            case 'card':
                                                if (event.eventSubtype === 'yellow') return 'Žltá karta';
                                                if (event.eventSubtype === 'red') return 'Červená karta';
                                                if (event.eventSubtype === 'blue') return 'Modrá karta';
                                                return 'Karta';
                                            case 'exclusion': 
                                                return 'Vylúčenie';
                                            default: 
                                                return 'Udalosť';
                                        }
                                    };
                                    
                                    const formattedTime = formatMatchTime(event);
                                    
                                    return React.createElement(
                                        'tr',
                                        { key: event.id, className: 'hover:bg-gray-50 transition-colors' },
                                        
                                        // Stĺpec pre domácich (meno + číslo dresu)
                                        React.createElement(
                                            'td',
                                            { className: 'px-4 py-2 text-sm text-right' },
                                            isHomeEvent ? 
                                                React.createElement(PlayerDisplay, { event: event, isHomeEvent: true }) :
                                                React.createElement('div', {}, '')
                                        ),
                                        
                                        // Skóre pre domácich
                                        React.createElement(
                                            'td',
                                            { className: 'px-4 py-2 text-center font-mono text-sm font-bold' },
                                            isGoal && isHomeEvent && score ? 
                                                React.createElement(
                                                    'span',
                                                    { className: 'inline-block px-2 py-0.5 rounded text-black-700' },
                                                    `${score.home}:${score.away}`
                                                ) :
                                                React.createElement('span', { className: 'text-gray-300' }, '')
                                        ),
                                        
                                        // Ikona udalosti (ľavá)
                                        React.createElement(
                                            'td',
                                            { className: 'px-4 py-2 text-center' },
                                            isHomeEvent && React.createElement(
                                                'div',
                                                { className: 'flex justify-center', title: getActionTitle() },
                                                getEventIcon(event.eventType, event.eventSubtype)
                                            )
                                        ),
                                        
                                        // Čas udalosti
                                        React.createElement(
                                            'td',
                                            { className: 'px-4 py-2 text-center font-mono text-sm font-medium text-gray-600' },
                                            formattedTime
                                        ),
                                        
                                        // Ikona udalosti (pravá)
                                        React.createElement(
                                            'td',
                                            { className: 'px-4 py-2 text-center' },
                                            !isHomeEvent && React.createElement(
                                                'div',
                                                { className: 'flex justify-center', title: getActionTitle() },
                                                getEventIcon(event.eventType, event.eventSubtype)
                                            )
                                        ),
                                        
                                        // Skóre pre hostí
                                        React.createElement(
                                            'td',
                                            { className: 'px-4 py-2 text-center font-mono text-sm font-bold' },
                                            isGoal && !isHomeEvent && score ? 
                                                React.createElement(
                                                    'span',
                                                    { className: 'inline-block px-2 py-0.5 rounded text-black-700' },
                                                    `${score.home}:${score.away}`
                                                ) :
                                                React.createElement('span', { className: 'text-gray-300' }, '')
                                        ),
                                        
                                        // Stĺpec pre hostí (číslo dresu + meno)
                                        React.createElement(
                                            'td',
                                            { className: 'px-4 py-2 text-sm text-left' },
                                            !isHomeEvent ? 
                                                React.createElement(PlayerDisplay, { event: event, isHomeEvent: false }) :
                                                React.createElement('div', {}, '')
                                        )
                                    );
                                })
                            )
                        )
            )
        );
    };

    React.useEffect(() => {
        if (homeTeamMappedName !== homeTeamDisplay && match.homeTeamIdentifier) {
            console.log(`🔄 Aktualizujem názov domáceho tímu v zozname: "${homeTeamDisplay}" → "${homeTeamMappedName}"`);
            if (onMatchUpdate) {
                onMatchUpdate(match.id, { 
                    updatedHomeTeamName: homeTeamMappedName,
                    homeTeamIdentifier: match.homeTeamIdentifier
                });
            }
            if (window.updateTeamNamesGlobally && typeof window.updateTeamNamesGlobally === 'function') {
                window.updateTeamNamesGlobally();
            }
        }
    }, [homeTeamMappedName]);
    
    React.useEffect(() => {
        if (awayTeamMappedName !== awayTeamDisplay && match.awayTeamIdentifier) {
            console.log(`🔄 Aktualizujem názov hosťujúceho tímu v zozname: "${awayTeamDisplay}" → "${awayTeamMappedName}"`);
            if (onMatchUpdate) {
                onMatchUpdate(match.id, { 
                    updatedAwayTeamName: awayTeamMappedName,
                    awayTeamIdentifier: match.awayTeamIdentifier
                });
            }
            if (window.updateTeamNamesGlobally && typeof window.updateTeamNamesGlobally === 'function') {
                window.updateTeamNamesGlobally();
            }
        }
    }, [awayTeamMappedName]);

    React.useEffect(() => {
        if (!window.db || !match.id) return;

        const matchRef = doc(window.db, 'matches', match.id);
        const unsubscribe = onSnapshot(matchRef, (docSnap) => {
            if (docSnap.exists()) {
                const updatedMatch = docSnap.data();
                const newHomeScore = updatedMatch.homeScore;
                const newAwayScore = updatedMatch.awayScore;
                const newStatus = updatedMatch.status || 'scheduled';
            
                setCurrentHomeScore(newHomeScore);
                setCurrentAwayScore(newAwayScore);
                setCurrentMatchStatus(newStatus);
            
                if (onMatchUpdate) {
                    onMatchUpdate(match.id, { 
                        homeScore: newHomeScore, 
                        awayScore: newAwayScore,
                        status: newStatus
                    });
                }
            }
        });
    
        return () => unsubscribe();
    }, [match.id]);
    
    // Real-time počúvanie zmien statusu zápasu
    React.useEffect(() => {
        if (!window.db || !match.id) return;
        
        console.log(`[MatchDetailView] Nastavujem real-time listener pre zápas ${match.id}`);
        
        const matchRef = doc(window.db, 'matches', match.id);
        const unsubscribe = onSnapshot(matchRef, (docSnap) => {
            if (docSnap.exists()) {
                const updatedMatch = docSnap.data();
                const newStatus = updatedMatch.status || 'scheduled';
                const oldStatus = currentMatchStatus;
                
                console.log(`[MatchDetailView] Zmena statusu: ${oldStatus} -> ${newStatus}`);
                
                setCurrentMatchStatus(newStatus);
                
                if (onMatchUpdate) {
                    onMatchUpdate(match.id, { status: newStatus });
                }
            }
        }, (error) => {
            console.error(`[MatchDetailView] Chyba pri počúvaní zápasu ${match.id}:`, error);
        });
        
        return () => {
            console.log(`[MatchDetailView] Ruším real-time listener pre zápas ${match.id}`);
            unsubscribe();
        };
    }, [match.id]);
    
    // Načítanie nastavení kategórie z databázy
    React.useEffect(() => {
        const loadCategorySettings = async () => {
            if (!window.db || !match.categoryId) {
                setLoadingSettings(false);
                return;
            }
            
            try {
                const settingsRef = doc(window.db, 'settings', 'categories');
                const settingsSnap = await getDoc(settingsRef);
                
                if (settingsSnap.exists()) {
                    const data = settingsSnap.data();
                    const categoryData = data[match.categoryId];
                    if (categoryData) {
                        setCategorySettings({
                            periods: categoryData.periods ?? 2,
                            periodDuration: categoryData.periodDuration ?? 20,
                            breakDuration: categoryData.breakDuration ?? 2,
                            matchBreak: categoryData.matchBreak ?? 5,
                            timeoutCount: categoryData.timeoutCount ?? 2,
                            timeoutDuration: categoryData.timeoutDuration ?? 1,
                            exclusionTime: categoryData.exclusionTime ?? 2
                        });
                        console.log(`[MatchDetailView] Načítané nastavenia pre kategóriu ${match.categoryId}:`, {
                            periods: categoryData.periods ?? 2,
                            periodDuration: categoryData.periodDuration ?? 20
                        });
                    } else {
                        console.log(`[MatchDetailView] Kategória ${match.categoryId} nemá vlastné nastavenia, používam default`);
                        setCategorySettings({
                            periods: 2,
                            periodDuration: 20,
                            breakDuration: 2,
                            matchBreak: 5,
                            timeoutCount: 2,
                            timeoutDuration: 1,
                            exclusionTime: 2
                        });
                    }
                } else {
                    setCategorySettings({
                        periods: 2,
                        periodDuration: 20,
                        breakDuration: 2,
                        matchBreak: 5,
                        timeoutCount: 2,
                        timeoutDuration: 1,
                        exclusionTime: 2
                    });
                }
            } catch (err) {
                console.error('Chyba pri načítaní nastavení kategórie:', err);
                setCategorySettings({
                    periods: 2,
                    periodDuration: 20,
                    breakDuration: 2,
                    matchBreak: 5,
                    timeoutCount: 2,
                    timeoutDuration: 1,
                    exclusionTime: 2
                });
            } finally {
                setLoadingSettings(false);
            }
        };
        
        loadCategorySettings();
    }, [match.categoryId]);
    
    // Sledujeme zmeny match.status z props (napr. pri navigácii medzi zápasmi)
    React.useEffect(() => {
        if (match.status && match.status !== currentMatchStatus) {
            console.log(`[MatchDetailView] Aktualizujem status z props: ${match.status}`);
            setCurrentMatchStatus(match.status);
        }
    }, [match.status]);
    
    // Získanie informácií o skupine
    let groupInfo = null;
    if (match.groupName && !match.isPlacementMatch) {
        groupInfo = getGroupTypeColors(match.groupName, match.categoryId, groupsData);
    }
    
    // Formátovanie dátumu pre detail
    const formattedDate = dateTime?.dateObj ? formatDateHeader(dateTime.dateObj) : 'Dátum neznámy';
    
    // Či existuje predchádzajúci a nasledujúci zápas
    const hasPrevious = currentMatchIndex > 0;
    const hasNext = currentMatchIndex < allMatches.length - 1;
    
    // Handler pre aktualizáciu časovača
    const handleTimeUpdate = (timeData) => {
        if (onMatchUpdate) {
            onMatchUpdate(match.id, {
                timerMinutes: timeData.minutes,
                timerSeconds: timeData.seconds,
                currentPeriod: timeData.period,
                timerRunning: timeData.isRunning
            });
        }
    };
    
    // Získanie aktuálneho skóre pre zobrazenie
    let finalDisplayScore = null;
    const isMatchInProgress = currentMatchStatus === 'in-progress' || currentMatchStatus === 'paused';

    if (isMatchInProgress && useCalculatedScore) {
        // Prebiehajúci zápas - vždy zobrazíme skóre z udalostí (aj 0:0)
        finalDisplayScore = { home: calculatedHomeScore, away: calculatedAwayScore };
    } else if (currentMatchStatus === 'completed' && currentHomeScore !== undefined && currentHomeScore !== null) {
        // Ukončený zápas s výsledkom v DB
        finalDisplayScore = { home: currentHomeScore, away: currentAwayScore };
    } else if (currentHomeScore !== undefined && currentHomeScore !== null) {
        // Existujúci výsledok v DB (napr. manuálne zadaný počas zápasu - ale to by nemalo nastať)
        finalDisplayScore = { home: currentHomeScore, away: currentAwayScore };
    }
    
    const showScore = finalDisplayScore !== null;
    
    return React.createElement(
        'div',
        { className: 'max-w-6xl mx-auto px-4 py-6' },
        
        // Hlavička s tlačidlami navigácie
        React.createElement(
            'div',
            { className: 'mb-6 flex flex-wrap items-center justify-between gap-3' },
            React.createElement(
                'button',
                {
                    onClick: onBack,
                    className: 'flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors cursor-pointer'
                },
                React.createElement('i', { className: 'fa-solid fa-arrow-left' }),
                React.createElement('span', {}, 'Späť na zoznam zápasov')
            ),
            React.createElement(
                'div',
                { className: 'flex gap-3' },
                React.createElement(
                    'button',
                    {
                        onClick: () => hasPrevious && onNavigate('prev'),
                        disabled: !hasPrevious,
                        className: `flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                            hasPrevious 
                                ? 'bg-blue-500 hover:bg-blue-600 text-white cursor-pointer' 
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`
                    },
                    React.createElement('i', { className: 'fa-solid fa-chevron-left' }),
                    React.createElement('span', {}, 'Predchádzajúci')
                ),
                React.createElement(
                    'button',
                    {
                        onClick: () => hasNext && onNavigate('next'),
                        disabled: !hasNext,
                        className: `flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                            hasNext 
                                ? 'bg-blue-500 hover:bg-blue-600 text-white cursor-pointer' 
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`
                    },
                    React.createElement('span', {}, 'Nasledujúci'),
                    React.createElement('i', { className: 'fa-solid fa-chevron-right' })
                )
            )
        ),
        
        // Nadpis s názvom haly a poradím zápasu
        React.createElement(
            'div',
            { className: 'text-center mb-6' },
            React.createElement('h1', { className: 'text-2xl font-bold text-gray-800' }, 'Detail zápasu'),
            React.createElement(
                'div',
                { className: 'flex items-center justify-center gap-2 mt-1' },
                React.createElement('i', { className: 'fa-solid fa-location-dot text-blue-500 text-sm' }),
                React.createElement('span', { className: 'text-gray-600' }, hallInfo?.name || 'Športová hala')
            ),
            React.createElement(
                'p',
                { className: 'text-xs text-gray-400 mt-1' },
                `Zápas ${currentMatchIndex + 1} z ${allMatches.length}`
            )
        ),
        
        // Karta s detailom zápasu
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden mb-6' },
            
            // Hlavička zápasu - dátum, čas, typy
            React.createElement(
                'div',
                { className: 'bg-gray-50 px-6 py-3 border-b border-gray-200' },
                React.createElement(
                    'div',
                    { className: 'flex flex-wrap items-center justify-between gap-3' },
                    React.createElement(
                        'div',
                        { className: 'flex items-center gap-4' },
                        React.createElement(
                            'div',
                            { className: 'flex items-center gap-2' },
                            React.createElement('i', { className: 'fa-regular fa-calendar text-gray-400' }),
                            React.createElement('span', { className: 'text-gray-700 text-sm' }, formattedDate)
                        ),
                        React.createElement(
                            'div',
                            { className: 'flex items-center gap-2' },
                            React.createElement('i', { className: 'fa-regular fa-clock text-gray-400' }),
                            React.createElement('span', { className: 'font-mono text-gray-700 text-sm' }, dateTime?.time || '--:--')
                        ),
                        // Zobrazenie stavu zápasu
                        React.createElement(
                            'div',
                            { className: `inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getMatchStatusColor()}` },
                            React.createElement('i', { 
                                className: currentMatchStatus === 'in-progress' ? 'fa-solid fa-play' :
                                          currentMatchStatus === 'paused' ? 'fa-solid fa-pause' :
                                          currentMatchStatus === 'completed' ? 'fa-solid fa-check' :
                                          'fa-regular fa-clock'
                            }),
                            React.createElement('span', {}, getMatchStatusText())
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'flex flex-wrap gap-2' },
                        match.matchType && !match.isPlacementMatch && React.createElement(
                            'span',
                            {
                                className: 'inline-block text-xs px-2 py-0.5 rounded-full',
                                style: {
                                    backgroundColor: matchColors.backgroundColor,
                                    color: matchColors.textColor,
                                    fontWeight: '500'
                                }
                            },
                            match.matchType
                        ),
                        match.isPlacementMatch && React.createElement(
                            'span',
                            {
                                className: 'inline-block text-xs px-2 py-0.5 rounded-full',
                                style: {
                                    backgroundColor: ELIMINATION_COLORS.backgroundColor,
                                    color: ELIMINATION_COLORS.textColor,
                                    fontWeight: '500'
                                }
                            },
                            'o ' + match.placementRank + '. miesto'
                        ),
                        match.groupName && !match.isPlacementMatch && React.createElement(
                            'span',
                            {
                                className: 'inline-block text-xs px-2 py-0.5 rounded-full',
                                style: {
                                    backgroundColor: groupInfo?.backgroundColor || matchColors.backgroundColor,
                                    color: groupInfo?.textColor || matchColors.textColor,
                                    fontWeight: '500'
                                }
                            },
                            match.groupName
                        ),
                        (match.categoryName || categoryDisplayName) && React.createElement(
                            'span',
                            {
                                className: 'inline-block text-xs px-2 py-0.5 rounded-full',
                                style: {
                                    backgroundColor: lighterCategoryColor,
                                    color: categoryColor,
                                    fontWeight: '500'
                                }
                            },
                            match.categoryName || categoryDisplayName
                        )
                    )
                )
            ),
            
            // Výsledok zápasu - UPRAVENÝ pre dynamické zobrazenie skóre
            React.createElement(
                'div',
                { className: 'px-6 py-6 bg-gradient-to-r from-gray-50 to-white' },
                React.createElement(
                    'div',
                    { className: 'grid grid-cols-3 gap-4 items-center' },
                    React.createElement(
                        'div',
                        { className: 'text-center' },
                        React.createElement('div', { className: 'text-xs text-gray-500 mb-1' }, 'DOMÁCI'),
                        React.createElement('div', { className: 'text-lg font-bold text-gray-800' }, homeTeamDisplay)
                    ),
                    React.createElement(
                        'div',
                        { className: 'text-center' },
                        showScore && finalDisplayScore ?
                            React.createElement(
                                'div',
                                { className: 'flex items-center justify-center gap-3' },
                                React.createElement('span', { className: 'text-3xl font-bold text-gray-800' }, finalDisplayScore.home),
                                React.createElement('span', { className: 'text-xl text-gray-400' }, ':'),
                                React.createElement('span', { className: 'text-3xl font-bold text-gray-800' }, finalDisplayScore.away)
                            ) :
                            React.createElement(
                                'div',
                                { className: 'text-center' },
                                React.createElement('span', { className: 'text-lg text-gray-400 font-medium' }, 'VS'),
                                React.createElement('div', { className: 'text-xs text-gray-400 mt-1' }, getMatchStatusText())
                            )
                    ),
                    React.createElement(
                        'div',
                        { className: 'text-center' },
                        React.createElement('div', { className: 'text-xs text-gray-500 mb-1' }, 'HOSTIA'),
                        React.createElement('div', { className: 'text-lg font-bold text-gray-800' }, awayTeamDisplay)
                    )
                )
            ),
            
            // Detailné informácie - typ zápasu a umiestnenie
            (match.matchType || (match.isPlacementMatch && match.placementRank)) && React.createElement(
                'div',
                { className: 'border-t border-gray-200 px-6 py-2' },
                React.createElement(
                    'div',
                    { className: 'flex flex-wrap gap-4 text-sm' },
                    match.matchType && React.createElement(
                        'div',
                        null,
                        React.createElement('span', { className: 'text-gray-500' }, 'Typ zápasu: '),
                        React.createElement('span', { className: 'text-gray-800' }, match.matchType)
                    ),
                    match.isPlacementMatch && match.placementRank && React.createElement(
                        'div',
                        null,
                        React.createElement('span', { className: 'text-gray-500' }, 'O umiestnenie: '),
                        React.createElement('span', { className: 'text-gray-800' }, match.placementRank + '. miesto')
                    )
                )
            )
        ),
        
        // Časovač zápasu
        !loadingSettings && React.createElement(MatchTimer, {
            ref: matchTimerRef,
            match: { ...match, status: currentMatchStatus, homeScore: currentHomeScore, awayScore: currentAwayScore },
            matchId: match.id,
            onTimeUpdate: handleTimeUpdate,
            categorySettings: categorySettings,
            teamNames: teamNames
        }),
        
        // Ak sa ešte načítavajú nastavenia, zobrazíme spinner
        loadingSettings && React.createElement(
            'div',
            { className: 'bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl p-4 text-white shadow-xl text-center' },
            React.createElement('div', { className: 'animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto' }),
            React.createElement('p', { className: 'text-sm mt-2' }, 'Načítavam nastavenia časovača...')
        ),
        
        // Dva boxy s členmi tímov vedľa seba
        React.createElement(
            'div',
            { className: 'grid grid-cols-1 md:grid-cols-2 gap-6 mt-6' },
            React.createElement(TeamMembersList, {
                teamName: homeTeamDisplay,
                categoryName: categoryDisplayName,
                teamType: 'home',
                timerRef: matchTimerRef,
                onMappedNameUpdate: setHomeTeamMappedName,
                matchId: match.id
            }),
            React.createElement(TeamMembersList, {
                teamName: awayTeamDisplay,
                categoryName: categoryDisplayName,
                teamType: 'away',
                timerRef: matchTimerRef,
                onMappedNameUpdate: setAwayTeamMappedName,
                matchId: match.id
            })
        ),
        
        // Box s udalosťami zápasu (pod boxmi členov tímov)
        renderMatchEvents()
    );
};

// Hlavný komponent MatchesHallApp - upravený s podporou URL parametrov a real-time aktualizáciou farieb tlačidiel
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
    
    // Nové stavy pre detail zápasu
    const [selectedMatch, setSelectedMatch] = useState(null);
    const [showingDetail, setShowingDetail] = useState(false);
    const [allMatchesList, setAllMatchesList] = useState([]);
    const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
    
    // Stav pre real-time aktualizáciu statusov zápasov
    const [matchStatuses, setMatchStatuses] = useState({});
    const [matchScoresFromEvents, setMatchScoresFromEvents] = useState({});    

    // V MatchesHallApp, pridajte túto funkciu
    const calculateGoalsFromEvents = (events) => {
        let homeGoals = 0;
        let awayGoals = 0;
    
        events.forEach(event => {
            if (event.eventType === 'goal') {
                if (event.team === 'home') homeGoals++;
                else if (event.team === 'away') awayGoals++;
            }
        });
        
        return { home: homeGoals, away: awayGoals };
    };
    
    // Funkcia na vytvorenie hash pre zápas
    const createMatchHash = (homeTeamId, awayTeamId) => {
        // Nahradíme medzery za pomlčky a potom zakódujeme
        const encodedHome = encodeURIComponent(homeTeamId.replace(/ /g, '-'));
        const encodedAway = encodeURIComponent(awayTeamId.replace(/ /g, '-'));
        return `#match/${encodedHome}/${encodedAway}`;
    };
    
    // Funkcia na parsovanie hash z URL
    const parseMatchHash = () => {
        const hash = window.location.hash;
        const matchPattern = /^#match\/([^/]+)\/([^/]+)$/;
        const match = hash.match(matchPattern);
        if (match) {
            // Dekódujeme a nahradíme pomlčky späť na medzery
            const homeTeamIdentifier = decodeURIComponent(match[1]).replace(/-/g, ' ');
            const awayTeamIdentifier = decodeURIComponent(match[2]).replace(/-/g, ' ');
            return {
                homeTeamIdentifier: homeTeamIdentifier,
                awayTeamIdentifier: awayTeamIdentifier
            };
        }
        return null;
    };
    
    // Funkcia na vyhľadanie zápasu podľa identifikátorov
    const findMatchByIdentifiers = (homeTeamIdentifier, awayTeamIdentifier, matchesList) => {
        return matchesList.findIndex(match => 
            match.homeTeamIdentifier === homeTeamIdentifier && 
            match.awayTeamIdentifier === awayTeamIdentifier
        );
    };
    
    // Funkcia na aktualizáciu URL pri zmene zápasu
    const updateUrlForMatch = (match) => {
        if (match && match.homeTeamIdentifier && match.awayTeamIdentifier) {
            const newHash = createMatchHash(match.homeTeamIdentifier, match.awayTeamIdentifier);
            // Použijeme replaceState aby sme neukladali každý krok do histórie zbytočne
            window.history.replaceState(null, '', newHash);
        }
    };
    
    // Funkcia na zobrazenie detailu zápasu podľa URL
    const showMatchFromUrl = (matchesList) => {
        const urlMatch = parseMatchHash();
        if (urlMatch && matchesList.length > 0) {
            const matchIndex = findMatchByIdentifiers(
                urlMatch.homeTeamIdentifier, 
                urlMatch.awayTeamIdentifier, 
                matchesList
            );
            if (matchIndex !== -1) {
                setSelectedMatch(matchesList[matchIndex]);
                setCurrentMatchIndex(matchIndex);
                setShowingDetail(true);
                // Nezabudneme nastaviť loading na false, ak už bol true
                setLoading(false);
                return true;
            }
        }
        // Ak sme nenašli zápas podľa URL, uistíme sa, že nie sme v detaile
        setShowingDetail(false);
        setSelectedMatch(null);
        return false;
    };
    
    // Funkcia na nastavenie real-time listenera pre zmeny statusov a výsledkov zápasov
    const setupMatchesRealTimeListener = (hallId) => {
        if (!window.db || !hallId) return;
        
        const matchesRef = collection(window.db, 'matches');
        
        // LOKÁLNA CACHE PRE STATUSY (mimo React state)
        let localMatchStatuses = {};
        
        // Inicializácia lokálnej cache z aktuálneho React state
        setMatchStatuses(prev => {
            localMatchStatuses = { ...prev };
            return prev;
        });
        
        // Premenná pre timeout, aby sme nehromadili viacero volaní
        let pendingUpdateTimeout = null;
        
        const unsubscribe = onSnapshot(matchesRef, (snapshot) => {
            const updatedStatuses = {};
            const updatedMatches = [];
            let hasMatchCompletedAnywhere = false;
            let completedMatchesList = []; // Zoznam zápasov, ktoré boli dokončené
            
            snapshot.docChanges().forEach(change => {
                const match = {
                    id: change.doc.id,
                    ...change.doc.data()
                };
                
                const oldStatus = localMatchStatuses[match.id];
                const newStatus = match.status || 'scheduled';
                
                // 🔥 DETEGUJEME ZMENU NA completed (len pri zmene, nie pri prvom načítaní)
                if (change.type === 'modified' && oldStatus && oldStatus !== 'completed' && newStatus === 'completed') {
                    hasMatchCompletedAnywhere = true;
                    completedMatchesList.push({
                        id: match.id,
                        hallId: match.hallId,
                        category: match.categoryName,
                        group: match.groupName,
                        oldStatus: oldStatus,
                        newStatus: newStatus
                    });
                    console.log(`🏆 Zápas ${match.id} (hala: ${match.hallId || 'neznáma'}) bol práve ukončený!`);
                    console.log(`   Starý status: ${oldStatus} → Nový status: ${newStatus}`);
                }
                
                // Aktualizujeme lokálnu cache
                localMatchStatuses[match.id] = newStatus;
                updatedStatuses[match.id] = newStatus;
                
                // Aktualizujeme matches pre našu halu
                if (match.hallId === hallId) {
                    updatedMatches.push(match);
                    
                    // Aktualizujeme matches (hlavný zoznam)
                    setMatches(prevMatches => {
                        const existingIndex = prevMatches.findIndex(m => m.id === match.id);
                        if (existingIndex !== -1) {
                            const updatedPrevMatches = [...prevMatches];
                            updatedPrevMatches[existingIndex] = { ...updatedPrevMatches[existingIndex], ...match };
                            return updatedPrevMatches;
                        } else {
                            return [...prevMatches, match];
                        }
                    });
                    
                    // Aktualizujeme allMatchesList (zoznam pre detail)
                    setAllMatchesList(prevList => {
                        const existingIndex = prevList.findIndex(m => m.id === match.id);
                        if (existingIndex !== -1) {
                            const updatedList = [...prevList];
                            updatedList[existingIndex] = { ...updatedList[existingIndex], ...match };
                            return updatedList;
                        } else {
                            return [...prevList, match];
                        }
                    });
                }
            });
            
            // Aktualizujeme React state matchStatuses (pre zobrazenie)
            if (Object.keys(updatedStatuses).length > 0) {
                setMatchStatuses(prev => ({ ...prev, ...updatedStatuses }));
            }
            
            // 🔥 AK BOL AKÝKOĽVEK ZÁPAS V CELEJ DATABÁZE DOKONČENÝ, SPUSTÍME AKTUALIZÁCIU NÁZVOV TÍMOV S ONSKORENÍM 5 SEKÚND
            if (hasMatchCompletedAnywhere) {
                console.log(`🏁 Zistené dokončenie ${completedMatchesList.length} zápasov v databáze!`);
                completedMatchesList.forEach(m => {
                    console.log(`   ✅ ${m.id} (hala: ${m.hallId}) - ${m.category} - ${m.group}`);
                });
                
                // Zrušíme predchádzajúci pending timeout, ak existuje
                if (pendingUpdateTimeout) {
                    clearTimeout(pendingUpdateTimeout);
                    console.log(`⏹️ Zrušený predchádzajúci pending timeout pre aktualizáciu`);
                }
                
                // 🔥 PRIDANÉ 5-SEKUNDOVÉ ONSKORENIE
                console.log(`⏰ Spúšťam aktualizáciu názvov tímov o 5 sekúnd...`);
                pendingUpdateTimeout = setTimeout(() => {
                    console.log(`🌐 Spúšťam globálnu aktualizáciu názvov tímov pre všetky zápasy (po 5s oneskorení)...`);
                    if (window.updateTeamNamesGlobally && typeof window.updateTeamNamesGlobally === 'function') {
                        window.updateTeamNamesGlobally();
                    } else {
                        console.error('❌ window.updateTeamNamesGlobally nie je dostupný!');
                    }
                    pendingUpdateTimeout = null;
                }, 5000); // 5000 milisekúnd = 5 sekúnd
            }
            
            // Zoradíme matches podľa času (len pre našu halu)
            setMatches(prevMatches => {
                return [...prevMatches].sort((a, b) => {
                    if (!a.scheduledTime) return 1;
                    if (!b.scheduledTime) return -1;
                    try {
                        const timeA = a.scheduledTime.toDate().getTime();
                        const timeB = b.scheduledTime.toDate().getTime();
                        return timeA - timeB;
                    } catch (e) {
                        return 0;
                    }
                });
            });
            
            setAllMatchesList(prevList => {
                return [...prevList].sort((a, b) => {
                    if (!a.scheduledTime) return 1;
                    if (!b.scheduledTime) return -1;
                    try {
                        const timeA = a.scheduledTime.toDate().getTime();
                        const timeB = b.scheduledTime.toDate().getTime();
                        return timeA - timeB;
                    } catch (e) {
                        return 0;
                    }
                });
            });
            
        }, (error) => {
            console.error('Chyba pri real-time načítaní zápasov:', error);
        });
        
        // Cleanup funkcia pre timeout pri odpojení listenera
        const cleanup = () => {
            if (pendingUpdateTimeout) {
                clearTimeout(pendingUpdateTimeout);
                pendingUpdateTimeout = null;
            }
        };
        
        // Vrátime unsubscribe funkciu, ktorá zároveň vyčistí timeout
        return () => {
            cleanup();
            unsubscribe();
        };
    };

    // Načítanie farieb kategórií a názvov z databázy
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

    // Načítanie skupín z databázy
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

    // Načítanie informácií o hale
    const loadHallInfo = async (hallId) => {
        if (!window.db || !hallId) return;
        
        try {
            const hallRef = doc(window.db, 'places', hallId);
            const hallSnap = await getDoc(hallRef);
            if (hallSnap.exists()) {
                setHallInfo({ id: hallSnap.id, ...hallSnap.data() });
            }
        } catch (err) {
            console.error('Chyba pri načítaní haly:', err);
        }
    };

    // Spracovanie názvov tímov pre všetky zápasy - ASYNCHRÓNNA VERZIA S MAPOVANÍM
    const processTeamNames = async (matches) => {
        const names = { ...teamNames };
        let needsUpdate = false;
        
        for (const match of matches) {
            // Získanie názvu kategórie pre tento zápas
            let categoryName = match.categoryName;
            if (!categoryName && match.categoryId && window.categoriesData && window.categoriesData[match.categoryId]) {
                categoryName = window.categoriesData[match.categoryId];
            }
            
            if (!categoryName) {
                console.log(`⚠️ Zápas ${match.id} nemá názov kategórie, preskakujem mapovanie`);
                continue;
            }
            
            // Spracovanie domáceho tímu
            if (match.homeTeamIdentifier) {
                const currentDisplayName = names[match.homeTeamIdentifier] || getDisplayTeamName(match.homeTeamIdentifier);
                
                // 🔥 KONTROLA: Mapujeme LEN ak názov tímu obsahuje názov kategórie
                if (currentDisplayName && currentDisplayName.includes(categoryName)) {
                    if (window.matchTracker && typeof window.matchTracker.getTeamNameByDisplayId === 'function') {
                        try {
                            console.log(`🔄 [PROCESS] Domáci tím "${currentDisplayName}" obsahuje kategóriu "${categoryName}" → volám getTeamNameByDisplayId`);
                            const newName = await window.matchTracker.getTeamNameByDisplayId(currentDisplayName);
                            if (newName && newName !== currentDisplayName && newName !== names[match.homeTeamIdentifier]) {
                                names[match.homeTeamIdentifier] = newName;
                                needsUpdate = true;
                                console.log(`✅ [PROCESS] Domáci tím "${currentDisplayName}" → "${newName}"`);
                            }
                        } catch (err) {
                            console.error(`Chyba pri mapovaní domáceho tímu ${currentDisplayName}:`, err);
                        }
                    } else {
                        console.log(`⚠️ [PROCESS] window.matchTracker.getTeamNameByDisplayId nie je dostupný pre domáci tím`);
                    }
                } else if (!names[match.homeTeamIdentifier]) {
                    // Ak nemáme žiadny názov, použijeme základný
                    names[match.homeTeamIdentifier] = currentDisplayName;
                }
            }
            
            // Spracovanie hosťujúceho tímu
            if (match.awayTeamIdentifier) {
                const currentDisplayName = names[match.awayTeamIdentifier] || getDisplayTeamName(match.awayTeamIdentifier);
                
                // 🔥 KONTROLA: Mapujeme LEN ak názov tímu obsahuje názov kategórie
                if (currentDisplayName && currentDisplayName.includes(categoryName)) {
                    if (window.matchTracker && typeof window.matchTracker.getTeamNameByDisplayId === 'function') {
                        try {
                            console.log(`🔄 [PROCESS] Hosťujúci tím "${currentDisplayName}" obsahuje kategóriu "${categoryName}" → volám getTeamNameByDisplayId`);
                            const newName = await window.matchTracker.getTeamNameByDisplayId(currentDisplayName);
                            if (newName && newName !== currentDisplayName && newName !== names[match.awayTeamIdentifier]) {
                                names[match.awayTeamIdentifier] = newName;
                                needsUpdate = true;
                                console.log(`✅ [PROCESS] Hosťujúci tím "${currentDisplayName}" → "${newName}"`);
                            }
                        } catch (err) {
                            console.error(`Chyba pri mapovaní hosťujúceho tímu ${currentDisplayName}:`, err);
                        }
                    } else {
                        console.log(`⚠️ [PROCESS] window.matchTracker.getTeamNameByDisplayId nie je dostupný pre hosťujúci tím`);
                    }
                } else if (!names[match.awayTeamIdentifier]) {
                    // Ak nemáme žiadny názov, použijeme základný
                    names[match.awayTeamIdentifier] = currentDisplayName;
                }
            }
        }
        
        if (needsUpdate) {
            setTeamNames(prev => ({ ...prev, ...names }));
            console.log('✅ [PROCESS] Aktualizované názvy tímov pri načítaní:', names);
        } else {
            setTeamNames(names);
            console.log('ℹ️ [PROCESS] Žiadne zmeny v názvoch tímov pri načítaní');
        }
    };

    const loadMatches = async (hallId) => {
        if (!window.db) {
            setError('Databáza nie je inicializovaná');
            setLoading(false);
            return;
        }
    
        if (!hallId) {
            setError('Používateľ nemá priradenú žiadnu halu');
            setLoading(false);
            return;
        }
    
        setLoading(true);
        setError(null);
    
        try {
            const matchesRef = collection(window.db, 'matches');
            const querySnapshot = await getDocs(matchesRef);
            
            const hallMatches = [];
            const allStatuses = {};
            
            querySnapshot.forEach((doc) => {
                const match = {
                    id: doc.id,
                    ...doc.data()
                };
                
                // Uložíme status pre KAŽDÝ zápas v databáze (aj z iných hál)
                allStatuses[doc.id] = match.status || 'scheduled';
                
                if (match.hallId === hallId) {
                    hallMatches.push(match);
                }
            });
            
            hallMatches.sort((a, b) => {
                if (!a.scheduledTime) return 1;
                if (!b.scheduledTime) return -1;
                try {
                    const timeA = a.scheduledTime.toDate().getTime();
                    const timeB = b.scheduledTime.toDate().getTime();
                    return timeA - timeB;
                } catch (e) {
                    return 0;
                }
            });
            
            setMatches(hallMatches);
            setAllMatchesList(hallMatches);
            
            // Nastavíme počiatočné statusy pre VŠETKY zápasy
            setMatchStatuses(allStatuses);
            
            // 🔥 POČKÁME NA DOKONČENIE PROCESS TEAM NAMES
            await processTeamNames(hallMatches);
            
            // Po načítaní zápasov skúsime zobraziť detail podľa URL
            const matchShown = showMatchFromUrl(hallMatches);
            if (!matchShown) {
                // Ak sa nezobrazil detail, ukončíme loading
                setLoading(false);
            }
            
            // Spustíme real-time listener pre aktualizáciu statusov
            const unsubscribe = setupMatchesRealTimeListener(hallId);
            
            // Uložíme unsubscribe funkciu pre cleanup
            window.__matchesRealTimeUnsubscribe = unsubscribe;
            
        } catch (err) {
            console.error('Chyba pri načítaní zápasov:', err);
            setError('Nepodarilo sa načítať zápasy: ' + err.message);
            setLoading(false);
        }
    };

    const globalUpdateTeamNames = async () => {
        if (allMatchesList.length > 0) {
            console.log('🌐 Spúšťam globálnu aktualizáciu názvov tímov pre všetky zápasy...');
            await updateTeamNamesInMatches(allMatchesList, setTeamNames, teamNames);
        }
    };

    useEffect(() => {
        window.updateTeamNamesGlobally = globalUpdateTeamNames;
        
        return () => {
            delete window.updateTeamNamesGlobally;
        };
    }, [allMatchesList, teamNames]);

    // Handler pre kliknutie na Detail
    const handleDetailClick = (match, index) => {
        setSelectedMatch(match);
        setCurrentMatchIndex(index);
        setShowingDetail(true);
        updateUrlForMatch(match);
        window.scrollTo(0, 0);
    };

    // Funkcia pre navigáciu medzi zápasmi
    const handleNavigateMatch = (direction) => {
        let newIndex;
        if (direction === 'prev') {
            newIndex = currentMatchIndex - 1;
        } else {
            newIndex = currentMatchIndex + 1;
        }
        
        if (newIndex >= 0 && newIndex < allMatchesList.length) {
            const newMatch = allMatchesList[newIndex];
            setSelectedMatch(newMatch);
            setCurrentMatchIndex(newIndex);
            updateUrlForMatch(newMatch);
            window.scrollTo(0, 0);
        }
    };

    // Upravená funkcia refreshMatchInList v hlavnom komponente MatchesHallApp
    const refreshMatchInList = (matchId, updates) => {
        // 🔥 SPRACOVANIE AKTUALIZÁCIE NÁZVOV TÍMOV Z DETAILU (LEN PRE MANUÁLNE ZMENY V DETAILI)
        let teamNamesUpdates = {};
        if (updates.updatedHomeTeamName && updates.homeTeamIdentifier) {
            teamNamesUpdates[updates.homeTeamIdentifier] = updates.updatedHomeTeamName;
            console.log(`📝 Aktualizujem názov domáceho tímu v zozname: ${updates.homeTeamIdentifier} → ${updates.updatedHomeTeamName}`);
        }
        if (updates.updatedAwayTeamName && updates.awayTeamIdentifier) {
            teamNamesUpdates[updates.awayTeamIdentifier] = updates.updatedAwayTeamName;
            console.log(`📝 Aktualizujem názov hosťujúceho tímu v zozname: ${updates.awayTeamIdentifier} → ${updates.updatedAwayTeamName}`);
        }
        
        // Ak máme aktualizácie názvov tímov, vykonáme ich
        if (Object.keys(teamNamesUpdates).length > 0) {
            setTeamNames(prev => ({ ...prev, ...teamNamesUpdates }));
        }
    
        // Aktualizujeme v matches
        setMatches(prevMatches => 
            prevMatches.map(m => m.id === matchId ? { ...m, ...updates } : m)
        );
    
        // Aktualizujeme v allMatchesList
        setAllMatchesList(prevList => 
            prevList.map(m => m.id === matchId ? { ...m, ...updates } : m)
        );
    
        // Aktualizujeme v selectedMatch ak je zobrazený
        if (selectedMatch && selectedMatch.id === matchId) {
            setSelectedMatch(prev => ({ ...prev, ...updates }));
        }
    };
    
    const handleMatchUpdate = (matchId, updates) => {
        // Ak update obsahuje resetComplete, znamená to že výsledok bol vymazaný
        if (updates.resetComplete) {
            // Špeciálne spracovanie pre reset - vymažeme výsledky
            refreshMatchInList(matchId, {
                homeScore: undefined,
                awayScore: undefined,
                status: 'scheduled'
            });
        } else {
            refreshMatchInList(matchId, updates);
        }
    };

    // Handler pre návrat z detailu
    const handleBackToList = () => {
        setSelectedMatch(null);
        setShowingDetail(false);
        setCurrentMatchIndex(0); // Reset indexu
        // Odstránime hash z URL
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
    };

    // Počúvanie na zmeny hash v URL
    useEffect(() => {
        const handleHashChange = () => {
            // Ak sme v detaile, skúsime nájsť zápas podľa URL
            if (allMatchesList.length > 0) {
                const urlMatch = parseMatchHash();
                if (urlMatch) {
                    const matchIndex = findMatchByIdentifiers(
                        urlMatch.homeTeamIdentifier,
                        urlMatch.awayTeamIdentifier,
                        allMatchesList
                    );
                    if (matchIndex !== -1 && (!showingDetail || selectedMatch?.homeTeamIdentifier !== urlMatch.homeTeamIdentifier)) {
                        setSelectedMatch(allMatchesList[matchIndex]);
                        setCurrentMatchIndex(matchIndex);
                        setShowingDetail(true);
                        window.scrollTo(0, 0);
                    }
                } else if (showingDetail) {
                    // Ak hash neexistuje a sme v detaile, vrátime sa na zoznam
                    setSelectedMatch(null);
                    setShowingDetail(false);
                }
            }
        };
        
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [allMatchesList, showingDetail, selectedMatch]);

    // Real-time listener pre skóre z udalostí (góly)
    useEffect(() => {
        if (!window.db) return;
        
        console.log('🔄 Nastavujem real-time listener pre udalosti (góly)...');
        
        const eventsRef = collection(window.db, 'matchEvents');
        
        const unsubscribe = onSnapshot(eventsRef, (snapshot) => {
            // Skupinujeme góly podľa matchId
            const goalsByMatch = {};
            
            // Prvý prechod: zozbierame všetky matchId, ktoré majú góly
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
            
            // 🔥 OPRAVA: Vymažeme staré skóre pre matchId, ktoré už nemajú žiadne góly
            setMatchScoresFromEvents(prev => {
                const newScores = {};
                
                // Zachováme len tie matchId, ktoré majú aspoň jeden gól v aktuálnom snapshot-e
                Object.keys(goalsByMatch).forEach(matchId => {
                    newScores[matchId] = goalsByMatch[matchId];
                });
                
                // Voliteľné: Pridáme matchId z prev, ktoré majú stále góly (pre prípad, že snapshot neobsahuje všetky)
                // Ale v našom prípade onSnapshot vracia celú kolekciu, takže nemusíme
                
                console.log('📊 Aktualizované skóre z udalostí (len s gólmi):', newScores);
                return newScores;
            });
            
        }, (error) => {
            console.error('❌ Chyba pri real-time počúvaní udalostí:', error);
        });
        
        return () => {
            console.log('🔌 Ruším real-time listener pre udalosti');
            unsubscribe();
        };
    }, [window.db]);
    
    // Cleanup real-time listenera pri odmontovaní komponentu
    useEffect(() => {
        return () => {
            if (window.__matchesRealTimeUnsubscribe && typeof window.__matchesRealTimeUnsubscribe === 'function') {
                window.__matchesRealTimeUnsubscribe();
            }
        };
    }, []);

    // Inicializácia
    useEffect(() => {
        const init = async () => {
            if (window.globalUserProfileData) {
                setUserProfile(window.globalUserProfileData);
                const hallId = window.globalUserProfileData.hallId;
                if (hallId) {
                    await loadCategoryColors();
                    await loadGroupsData();
                    await loadHallInfo(hallId);
                    await loadMatches(hallId);
                } else {
                    setError('Používateľ nemá priradenú žiadnu halu');
                    setLoading(false);
                }
            }
        };

        if (window.globalUserProfileData) {
            init();
        } else {
            window.addEventListener('globalDataUpdated', init);
            return () => window.removeEventListener('globalDataUpdated', init);
        }
    }, []);

    const renderDetailButton = (match, dayIndex, matchIndex) => {
        // 🔥 POUŽIJEME matchStatuses PRE SPRÁVNY STATUS
        const matchStatus = matchStatuses[match.id] || match.status || 'scheduled';
        // Tlačidlo bude žlté pre zápasy s statusom 'in-progress' ALEBO 'paused'
        const isActive = matchStatus === 'in-progress' || matchStatus === 'paused';

        const buttonClass = isActive 
            ? 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800 text-xs px-3 py-1 rounded-full transition-colors cursor-pointer'
            : 'bg-gray-200 hover:bg-gray-300 text-gray-900 text-xs px-3 py-1 rounded-full transition-colors cursor-pointer';

        return React.createElement(
            'button',
            {
                onClick: () => {
                    // Výpočet globálneho indexu zápasu
                    let globalIndex = 0;
                    for (let i = 0; i < dayIndex; i++) {
                        globalIndex += matchesByDay[i].matches.length;
                    }
                    globalIndex += matchIndex;
                    handleDetailClick(match, globalIndex);
                },
                className: buttonClass,
                style: { fontWeight: '500' }
            },
            'Detail'
        );
    };

    // Zoskupenie zápasov podľa dní
    const getMatchesByDay = () => {
        const groups = {};
        
        matches.forEach(match => {
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
    };

    // Ak sa zobrazuje detail, vykreslíme detail komponent
    if (showingDetail && selectedMatch) {
        return React.createElement(MatchDetailView, {
            match: selectedMatch,
            teamNames: teamNames,
            onBack: handleBackToList,
            hallInfo: hallInfo,
            categoryDrawColors: categoryDrawColors,
            groupsData: groupsData,
            allMatches: allMatchesList,
            currentMatchIndex: currentMatchIndex,
            onNavigate: handleNavigateMatch,
            onMatchUpdate: handleMatchUpdate
        });
    }

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

    const matchesByDay = getMatchesByDay();
    const totalMatches = matches.length;

    return React.createElement(
        'div',
        { className: 'max-w-7xl mx-auto px-4 py-6' },
        
        React.createElement(
            'div',
            { className: 'mb-8 text-center' },
            React.createElement('h1', { className: 'text-2xl font-bold text-gray-800' }, 'Zápasy'),
            React.createElement(
                'div',
                { className: 'flex items-center justify-center gap-2 mt-1' },
                React.createElement('i', { className: 'fa-solid fa-location-dot text-blue-500 text-sm' }),
                React.createElement('span', { className: 'text-gray-600' }, hallInfo?.name || 'Športová hala'),
                React.createElement('span', { className: 'text-gray-400 text-sm ml-2' }, `(${totalMatches} zápasov)`)
            )
        ),
        
        matchesByDay.length === 0 ? 
            React.createElement(
                'div',
                { className: 'text-center py-12 text-gray-500 bg-gray-50 rounded-xl' },
                React.createElement('i', { className: 'fa-solid fa-calendar-xmark text-5xl mb-3 opacity-50' }),
                React.createElement('p', { className: 'text-lg' }, 'Žiadne zápasy pre túto halu')
            ) :
            React.createElement(
                'div',
                { className: 'overflow-x-auto border border-gray-200 rounded-lg bg-white' },
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
                            React.createElement('th', { className: 'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48' }, 'Info'),
                            React.createElement('th', { className: 'px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20' }, '')
                        )
                    ),
                    
                    React.createElement(
                        'tbody',
                        { className: 'divide-y divide-gray-100' },
                        matchesByDay.map((dayGroup, dayIndex) => {
                            const dayMatches = dayGroup.matches;
                            const dayDate = dayGroup.date;
                            const dayRows = [];
                            
                            dayRows.push(
                                React.createElement(
                                    'tr',
                                    { key: `day-${dayIndex}`, className: 'bg-blue-50' },
                                    React.createElement(
                                        'td',
                                        { colSpan: 6, className: 'px-4 py-4 text-left' },
                                        React.createElement(
                                            'div',
                                            { className: 'flex items-center gap-2' },
                                            React.createElement('i', { className: 'fa-regular fa-calendar text-blue-500 text-lg' }),
                                            React.createElement('span', { className: 'font-semibold text-gray-800 text-base' }, formatDateHeader(dayDate)),
                                            React.createElement('span', { className: 'text-sm text-gray-500 ml-2' }, `(${dayMatches.length} zápasov)`)
                                        )
                                    )
                                )
                            );
                            
                            // Vytvorenie riadkov zápasov v tabuľke (vo vnútri dayMatches.forEach)
                            dayMatches.forEach((match, matchIndex) => {
                                const dateTime = formatMatchDateTime(match.scheduledTime);
                                const eventsScore = matchScoresFromEvents[match.id];
                                const matchStatus = matchStatuses[match.id] || match.status || 'scheduled';
                                const isMatchInProgress = matchStatus === 'in-progress' || matchStatus === 'paused';
                                const hasDbScore = match.homeScore !== undefined && match.homeScore !== null && match.awayScore !== undefined && match.awayScore !== null;
                            
                                // Rozhodneme, čo zobraziť
                                let displayHomeScore = null;
                                let displayAwayScore = null;
                                let showScore = false;
                            
                                if (isMatchInProgress) {
                                    // 🔥 PREBIEHAJÚCI ZÁPAS - vždy zobrazíme skóre (aj keď je 0:0)
                                    if (eventsScore && (eventsScore.home > 0 || eventsScore.away > 0)) {
                                        // Máme aspoň jeden gól z udalostí
                                        displayHomeScore = eventsScore.home;
                                        displayAwayScore = eventsScore.away;
                                    } else {
                                        // Žiadne gólové udalosti - zobrazíme 0:0
                                        displayHomeScore = 0;
                                        displayAwayScore = 0;
                                    }
                                    showScore = true;
                                    console.log(`📊 Zápas ${match.id} (${matchStatus}): zobrazujem skóre ${displayHomeScore}:${displayAwayScore}`);
                                } else if (hasDbScore) {
                                    // Ukončený zápas alebo manuálne zadané skóre
                                    displayHomeScore = match.homeScore;
                                    displayAwayScore = match.awayScore;
                                    showScore = true;
                                }
                                
                                const homeTeamDisplay = teamNames[match.homeTeamIdentifier] || getDisplayTeamName(match.homeTeamIdentifier);
                                const awayTeamDisplay = teamNames[match.awayTeamIdentifier] || getDisplayTeamName(match.awayTeamIdentifier);
                                
                                const categoryColor = getCategoryDrawColor(match.categoryId);
                                const lighterCategoryColor = getLighterColor(categoryColor);
                                
                                const matchColors = getMatchColors(match, groupsData);
                                
                                // 🔥 DEFINÍCIA infoTags (toto chýbalo)
                                const infoTags = [];
                                
                                // Tag pre typ zápasu
                                if (match.matchType && !match.isPlacementMatch) {
                                    infoTags.push(
                                        React.createElement('span', { 
                                            key: 'type',
                                            className: 'inline-block text-xs px-2 py-0.5 rounded-full whitespace-nowrap',
                                            style: {
                                                backgroundColor: matchColors.backgroundColor,
                                                color: matchColors.textColor,
                                                fontWeight: '500'
                                            }
                                        },
                                        match.matchType
                                    ));
                                }
                                
                                // Tag pre zápas o umiestnenie
                                if (match.isPlacementMatch) {
                                    infoTags.push(
                                        React.createElement('span', { 
                                            key: 'placement',
                                            className: 'inline-block text-xs px-2 py-0.5 rounded-full whitespace-nowrap',
                                            style: {
                                                backgroundColor: ELIMINATION_COLORS.backgroundColor,
                                                color: ELIMINATION_COLORS.textColor,
                                                fontWeight: '500'
                                            }
                                        },
                                        `o ${match.placementRank}. miesto`
                                    ));
                                }
                                
                                // Tag pre skupinu
                                if (match.groupName && !match.isPlacementMatch) {
                                    let groupColors;
                                    if (isEliminationMatch(match)) {
                                        groupColors = ELIMINATION_COLORS;
                                    } else {
                                        groupColors = getGroupTypeColors(match.groupName, match.categoryId, groupsData);
                                    }
                                    
                                    infoTags.push(
                                        React.createElement('span', { 
                                            key: 'group',
                                            className: 'inline-block text-xs px-2 py-0.5 rounded-full whitespace-nowrap',
                                            style: {
                                                backgroundColor: groupColors.backgroundColor,
                                                color: groupColors.textColor,
                                                fontWeight: '500'
                                            }
                                        },
                                        match.groupName
                                    ));
                                }
                                
                                // Tag pre kategóriu - použitie názvu z ID ak treba
                                let categoryDisplayTag = match.categoryName;
                                if (!categoryDisplayTag && match.categoryId && categoriesData[match.categoryId]) {
                                    categoryDisplayTag = categoriesData[match.categoryId];
                                }
                                
                                if (categoryDisplayTag) {
                                    infoTags.push(
                                        React.createElement('span', { 
                                            key: 'category',
                                            className: 'inline-block text-xs px-2 py-0.5 rounded-full whitespace-nowrap',
                                            style: {
                                                backgroundColor: lighterCategoryColor,
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
                                        { key: `match-${dayIndex}-${matchIndex}`, className: 'hover:bg-gray-50 transition-colors' },
                                        
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
                                            { className: 'px-4 py-3' },
                                            React.createElement(
                                                'div',
                                                { className: 'flex flex-col gap-1' },
                                                infoTags
                                            )
                                        ),
                                        
                                        React.createElement(
                                            'td',
                                            { className: 'px-4 py-3 whitespace-nowrap text-center' },
                                            renderDetailButton(match, dayIndex, matchIndex)
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

// Renderovanie
const renderApp = () => {
    const rootElement = document.getElementById('root');
    if (rootElement && ReactDOM) {
        const root = ReactDOM.createRoot(rootElement);
        root.render(React.createElement(MatchesHallApp));
    }
};

if (window.db && window.globalUserProfileData) {
    renderApp();
} else {
    window.addEventListener('globalDataUpdated', () => {
        if (window.db && window.globalUserProfileData) {
            renderApp();
        }
    });
    setTimeout(() => {
        if (window.db && window.globalUserProfileData) {
            renderApp();
        }
    }, 3000);
}

// Funkcia pre verejnú verziu - NEPOSIELA žiadny token
async function fetchPlayerFromWorker(teamName, categoryName, playerType, playerIndex) {
    const WORKER_URL = 'https://soh-2025.turnaj-slovak-open-handball.workers.dev/';
  
    try {
        console.log(`📡 Volám Worker pre hráča:`, { teamName, categoryName, playerType, playerIndex });
        
        const response = await fetch(WORKER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                teamName: teamName,
                categoryName: categoryName,
                playerType: playerType,
                playerIndex: playerIndex
            })
        });
  
        if (!response.ok) {
            const errorData = await response.json();
            console.error('❌ Worker error:', errorData);
            return null;
        }
  
        const result = await response.json();
        
        if (result.success && result.data) {
            console.log(`✅ Údaje z Worker:`, result.data);
            return {
                firstName: result.data.firstName,
                lastName: result.data.lastName,
                jerseyNumber: result.data.jerseyNumber,
                memberType: result.data.memberType  // 🔥 PRIDANÉ: typ člena
            };
        }
        
        return null;
    } catch (error) {
        console.error('❌ Chyba pri volaní Worker:', error);
        return null;
    }
}
