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

// Funkcia na načítanie členov tímu s reálnym sledovaním - POUŽÍVA CELÝ NÁZOV VRÁTANE SUFIXU
const loadTeamMembers = (teamName, categoryName, onUpdate, onMappedName) => {
    if (!window.db || !teamName || !categoryName) {
        if (onUpdate) onUpdate([]);
        if (onMappedName) onMappedName(teamName);
        return () => {};
    }
    
    // Používame celý názov tímu vrátane sufixu
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
                
                // Vyhľadávame PRESNE podľa celého názvu tímu vrátane sufixu
                const foundTeam = (teamsArray || []).find(t => t.teamName === actualTeamName);
                
                if (foundTeam) {
                    foundAnyTeam = true;
                    
                    // Hráči
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
                    
                    // Členovia RT (muži)
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
                    
                    // Členovia RT (ženy)
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
        
        // Zoradenie: najprv RT členovia, potom hráči
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
    
    // Skontrolujeme, či je teamManager dostupný
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
            
            // Konvertujeme identifikátory tímov
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
        
        // Hľadáme zápasy pre konkrétny tím (príklad - možno upraviť podľa potreby)
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
                
                // Skúsime nájsť podobné názvy (po konverzii)
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

// Spustíme debug po načítaní
setTimeout(() => {
    debugMatches();
}, 3000);

// Pridáme funkciu do window objektu
window.debugMatches = debugMatches;

// Všeobecná debugovacia funkcia pre udalosti
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
        
        // Štatistika podľa typov udalostí
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

// Spustíme debug udalostí po načítaní
setTimeout(() => {
    debugMatchEvents();
}, 4000);

// Pridáme funkciu do window objektu
window.debugMatchEvents = debugMatchEvents;

// --- FUNKCIA NA MANUÁLNU AKTUALIZÁCIU UI ---
const forceUpdateUI = () => {
    console.log('🔄 [forceUpdateUI] Manuálna aktualizácia UI...');
    
    // Nájdeme root element a znovu vykreslíme aplikáciu
    const rootElement = document.getElementById('root');
    if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
        try {
            // Získame aktuálny stav z window objektu
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

// Pridáme do window objektu
window.forceUpdateUI = forceUpdateUI;































// ============================================================
// NOVÝ KOMPONENT PRE ZOBRAZENIE ZÁPASOV TÍMU
// Vložte tento kód do teams.js, napríklad pred TeamsOverviewApp
// ============================================================

// Pomocné funkcie pre zobrazenie zápasov
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
        (match.matchType && match.matchType.includes('finále'))) {
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

// ============================================================
// OPRAVENÝ KOMPONENT TeamMatchesList - jednoduchá a spoľahlivá verzia
// ============================================================

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
    const [processedMatches, setProcessedMatches] = useState([]);

    // Načítanie groupsData
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

    // Načítanie kategórií
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

    // Načítanie názvov hál
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

    // Funkcia na filtrovanie zápasov pre aktuálny tím
    const filterMatchesForTeam = (allMatches, names) => {
        const filtered = [];
        
        allMatches.forEach(match => {
            // Získame konvertované názvy tímov
            const homeName = names[match.homeTeamIdentifier] || getDisplayTeamName(match.homeTeamIdentifier) || match.homeTeamIdentifier;
            const awayName = names[match.awayTeamIdentifier] || getDisplayTeamName(match.awayTeamIdentifier) || match.awayTeamIdentifier;
            
            // Kontrola kategórie - zápas musí byť v rovnakej kategórii
            let matchCategory = match.categoryName;
            if (!matchCategory && match.categoryId && categoriesData[match.categoryId]) {
                matchCategory = categoriesData[match.categoryId];
            }
            
            // Porovnávame konvertované názvy s názvom tímu a kategóriou
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

    // Hlavná funkcia na spracovanie zápasov - načítava všetky zápasy
    // a konvertuje názvy tímov cez matchTracker
    const processMatchesWithTeamNames = async (matchesList) => {
        const names = { ...teamNames };
        let needsUpdate = false;
        
        // Počkáme na dostupnosť matchTracker
        let attempts = 0;
        while (!window.matchTracker && attempts < 10) {
            await new Promise(resolve => setTimeout(resolve, 200));
            attempts++;
        }
        
        // Získame všetky unikátne identifikátory tímov zo všetkých zápasov
        const teamIdentifiers = new Set();
        matchesList.forEach(match => {
            if (match.homeTeamIdentifier) teamIdentifiers.add(match.homeTeamIdentifier);
            if (match.awayTeamIdentifier) teamIdentifiers.add(match.awayTeamIdentifier);
        });
        
        // Pre každý identifikátor zavoláme matchTracker.getTeamNameByDisplayId
        if (window.matchTracker && typeof window.matchTracker.getTeamNameByDisplayId === 'function') {
            for (const identifier of teamIdentifiers) {
                // Získame aktuálny zobrazený názov
                const currentDisplayName = names[identifier] || getDisplayTeamName(identifier);
                
                if (currentDisplayName) {
                    try {
                        // Zavoláme matchTracker pre konverziu
                        const convertedName = await window.matchTracker.getTeamNameByDisplayId(currentDisplayName);
                        if (convertedName && convertedName !== currentDisplayName && convertedName !== names[identifier]) {
                            names[identifier] = convertedName;
                            needsUpdate = true;
                        } else if (!names[identifier]) {
                            names[identifier] = currentDisplayName;
                        }
                    } catch (err) {
                        // Ak zlyhá, použijeme pôvodný názov
                        if (!names[identifier]) {
                            names[identifier] = currentDisplayName;
                        }
                    }
                } else if (!names[identifier]) {
                    names[identifier] = identifier;
                }
            }
        } else {
            // Fallback - použijeme synchrónnu verziu
            for (const identifier of teamIdentifiers) {
                if (!names[identifier]) {
                    names[identifier] = getDisplayTeamName(identifier) || identifier;
                }
            }
        }
        
        if (needsUpdate) {
            setTeamNames(prev => ({ ...prev, ...names }));
        } else {
            setTeamNames(names);
        }
        
        return names; // Vrátime konvertované názvy
    };

    // EFEKT: Keď sa zmení allMatchesList alebo teamNames, prefiltrujeme zápasy
    useEffect(() => {
        if (allMatchesList.length > 0 && Object.keys(teamNames).length > 0) {
            const filtered = filterMatchesForTeam(allMatchesList, teamNames);
            setMatches(filtered);
        }
    }, [allMatchesList, teamNames, teamName, categoryName]);

    // EFEKT: Keď sa zmenia matches, uložíme ich do processedMatches
    useEffect(() => {
        setProcessedMatches(matches);
    }, [matches]);

    // Výpočet gólov z udalostí
    const calculateGoalsFromEvents = (events) => {
        let homeGoals = 0, awayGoals = 0;
        events.forEach(event => {
            if (event.eventType === 'goal') {
                if (event.team === 'home') homeGoals++;
                else if (event.team === 'away') awayGoals++;
            }
        });
        return { home: homeGoals, away: awayGoals };
    };

    // Real-time listener na všetky zápasy (rovnako ako v matches.js)
    useEffect(() => {
        if (!window.db || !teamName || !categoryName) {
            setLoading(false);
            return;
        }

        const matchesRef = collection(window.db, 'matches');
        let unsubscribe = null;

        const loadMatchesData = async () => {
            try {
                const querySnapshot = await getDocs(matchesRef);
                const allMatches = [];
                const statuses = {};
                const scores = {};

                querySnapshot.forEach((doc) => {
                    const match = { id: doc.id, ...doc.data() };
                    allMatches.push(match);
                    statuses[doc.id] = match.status || 'scheduled';
                    if (match.homeScore !== undefined && match.awayScore !== undefined) {
                        scores[doc.id] = { home: match.homeScore, away: match.awayScore };
                    }
                });

                // Zoradenie podľa času
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
                
                // Spracujeme všetky zápasy cez matchTracker a získame konvertované názvy
                const convertedNames = await processMatchesWithTeamNames(allMatches);
                
                // Nastavíme allMatchesList - to spustí useEffect ktorý prefiltruje zápasy
                setAllMatchesList(allMatches);
                setLoading(false);

                // Real-time listener na všetky zmeny v zápasoch
                if (unsubscribe) unsubscribe();
                unsubscribe = onSnapshot(matchesRef, async (snapshot) => {
                    const updatedMatches = [];
                    const updatedStatuses = {};
                    const updatedScores = {};
                    let hasChanges = false;

                    snapshot.docChanges().forEach(change => {
                        const match = { id: change.doc.id, ...change.doc.data() };
                        updatedMatches.push(match);
                        updatedStatuses[change.doc.id] = match.status || 'scheduled';
                        if (match.homeScore !== undefined && match.awayScore !== undefined) {
                            updatedScores[change.doc.id] = { home: match.homeScore, away: match.awayScore };
                        }
                        hasChanges = true;
                    });

                    if (hasChanges) {
                        // Aktualizujeme allMatchesList
                        setAllMatchesList(prev => {
                            const newList = [...prev];
                            updatedMatches.forEach(um => {
                                const idx = newList.findIndex(m => m.id === um.id);
                                if (idx !== -1) newList[idx] = { ...newList[idx], ...um };
                                else newList.push(um);
                            });
                            newList.sort((a, b) => {
                                if (!a.scheduledTime) return 1;
                                if (!b.scheduledTime) return -1;
                                try {
                                    return a.scheduledTime.toDate().getTime() - b.scheduledTime.toDate().getTime();
                                } catch (e) { return 0; }
                            });
                            return newList;
                        });
                        
                        // Aktualizujeme statusy a skóre
                        setMatchStatuses(prev => ({ ...prev, ...updatedStatuses }));
                        setMatchScoresFromDb(prev => ({ ...prev, ...updatedScores }));
                        
                        // Znovu spracujeme názvy tímov pre aktualizované zápasy
                        const currentNames = { ...teamNames };
                        let namesUpdated = false;
                        
                        if (window.matchTracker && typeof window.matchTracker.getTeamNameByDisplayId === 'function') {
                            for (const match of updatedMatches) {
                                if (match.homeTeamIdentifier) {
                                    const currentName = currentNames[match.homeTeamIdentifier] || getDisplayTeamName(match.homeTeamIdentifier);
                                    if (currentName) {
                                        try {
                                            const converted = await window.matchTracker.getTeamNameByDisplayId(currentName);
                                            if (converted && converted !== currentName && converted !== currentNames[match.homeTeamIdentifier]) {
                                                currentNames[match.homeTeamIdentifier] = converted;
                                                namesUpdated = true;
                                            }
                                        } catch (err) {}
                                    }
                                }
                                if (match.awayTeamIdentifier) {
                                    const currentName = currentNames[match.awayTeamIdentifier] || getDisplayTeamName(match.awayTeamIdentifier);
                                    if (currentName) {
                                        try {
                                            const converted = await window.matchTracker.getTeamNameByDisplayId(currentName);
                                            if (converted && converted !== currentName && converted !== currentNames[match.awayTeamIdentifier]) {
                                                currentNames[match.awayTeamIdentifier] = converted;
                                                namesUpdated = true;
                                            }
                                        } catch (err) {}
                                    }
                                }
                            }
                        }
                        
                        if (namesUpdated) {
                            setTeamNames(currentNames);
                        }
                    }
                });

            } catch (err) {
                console.error('[TeamMatchesList] Chyba pri načítaní:', err);
                setLoading(false);
            }
        };

        loadMatchesData();

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [teamName, categoryName, categoriesData]);

    // Real-time listener na udalosti pre skóre
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

    // Použijeme processedMatches pre zobrazenie
    const displayMatches = processedMatches.length > 0 ? processedMatches : matches;

    if (displayMatches.length === 0) {
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

    // Zoskupenie podľa dní
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

    const displayDays = getMatchesByDay(displayMatches);

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
                        React.createElement('th', { className: 'px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20' }, 'Stav')
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

                            // Použijeme konvertované názvy z teamNames
                            const homeTeamDisplay = teamNames[match.homeTeamIdentifier] || match._homeDisplay || getDisplayTeamName(match.homeTeamIdentifier) || match.homeTeamIdentifier;
                            const awayTeamDisplay = teamNames[match.awayTeamIdentifier] || match._awayDisplay || getDisplayTeamName(match.awayTeamIdentifier) || match.awayTeamIdentifier;
                            const matchHallName = hallNames[match.hallId] || 'Športová hala';
                            const categoryColor = getCategoryDrawColor(match.categoryId);
                            const lighterCategoryColor = getLighterColor(categoryColor);
                            const matchColors = getMatchColors(match);

                            // Info tagy
                            const infoTags = [];
                            if (match.matchType && !match.isPlacementMatch) {
                                infoTags.push(
                                    React.createElement('span', {
                                        key: 'type',
                                        className: 'inline-block text-xs px-2 py-0.5 rounded-full whitespace-nowrap',
                                        style: { backgroundColor: matchColors.backgroundColor, color: matchColors.textColor, fontWeight: '500' }
                                    }, match.matchType)
                                );
                            }
                            if (match.isPlacementMatch) {
                                infoTags.push(
                                    React.createElement('span', {
                                        key: 'placement',
                                        className: 'inline-block text-xs px-2 py-0.5 rounded-full whitespace-nowrap',
                                        style: { backgroundColor: '#F3E8FF', color: '#6B21A5', fontWeight: '500' }
                                    }, `o ${match.placementRank}. miesto`)
                                );
                            }
                            if (match.groupName && !match.isPlacementMatch) {
                                const groupColors = getGroupTypeColors(match.groupName, match.categoryId, groupsData);
                                infoTags.push(
                                    React.createElement('span', {
                                        key: 'group',
                                        className: 'inline-block text-xs px-2 py-0.5 rounded-full whitespace-nowrap',
                                        style: { backgroundColor: groupColors.backgroundColor, color: groupColors.textColor, fontWeight: '500' }
                                    }, match.groupName)
                                );
                            }
                            let categoryDisplayTag = match.categoryName;
                            if (!categoryDisplayTag && match.categoryId && categoriesData[match.categoryId]) {
                                categoryDisplayTag = categoriesData[match.categoryId];
                            }
                            if (categoryDisplayTag) {
                                infoTags.push(
                                    React.createElement('span', {
                                        key: 'category',
                                        className: 'inline-block text-xs px-2 py-0.5 rounded-full whitespace-nowrap',
                                        style: { backgroundColor: lighterCategoryColor, color: categoryColor, fontWeight: '500' }
                                    }, categoryDisplayTag)
                                );
                            }

                            // Stavový badge
                            const statusBadge = (() => {
                                const colors = {
                                    'in-progress': 'bg-green-100 text-green-800',
                                    'paused': 'bg-yellow-100 text-yellow-800',
                                    'completed': 'bg-blue-100 text-blue-800',
                                    'scheduled': 'bg-gray-100 text-gray-600'
                                };
                                const labels = {
                                    'in-progress': 'Prebieha',
                                    'paused': 'Pozastavený',
                                    'completed': 'Ukončený',
                                    'scheduled': 'Naplánovaný'
                                };
                                return React.createElement(
                                    'span',
                                    { className: `inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colors[matchStatus] || colors.scheduled}` },
                                    labels[matchStatus] || labels.scheduled
                                );
                            })();

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
                                        statusBadge
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
            `Počet zápasov: ${displayMatches.length}`
        )
    );
};

// ============================================================
// UPRAVENÁ FUNKCIA renderTeamDetails - vložte TeamMatchesList
// ============================================================

// Pôvodná funkcia renderTeamDetails v teams.js bola takáto:
// const renderTeamDetails = () => {
//     if (!selectedTeamDetails) return null;
//     ...
//     return React.createElement(
//         'div',
//         { className: 'w-full' },
//         ... (box s kategóriami) ...
//         renderTeamRoster()
//     );
// };

// UPRAVENÁ VERZIA - medzi box s kategóriami a súpisku vkladáme TeamMatchesList:

const renderTeamDetails = () => {
    if (!selectedTeamDetails) return null;

    const categoryFromUrl = getCategoryFromUrl();
    const hasCategoryInUrl = !!categoryFromUrl;

    const sortedOccurrences = [...selectedTeamDetails.occurrences].sort((a, b) => {
        const categoryCompare = slovakCollator.compare(a.category, b.category);
        if (categoryCompare !== 0) return categoryCompare;
        return slovakCollator.compare(a.teamName, b.teamName);
    });

    // Získame categoryId pre vybranú kategóriu
    let categoryId = null;
    const currentCategoryName = selectedTeamDetails.category || categoryFromUrl;
    if (currentCategoryName) {
        const foundId = Object.keys(categoryIdToNameMap).find(id => categoryIdToNameMap[id] === currentCategoryName);
        if (foundId) categoryId = foundId;
    }

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
        // --- BOX S KATEGÓRIAMI (pôvodný) ---
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
        // --- NOVÝ KOMPONENT: ZÁPASY TÍMU (vložený medzi kategórie a súpisku) ---
        React.createElement(TeamMatchesList, {
            teamName: selectedTeamDetails.teamName,
            categoryName: selectedTeamDetails.category || categoryFromUrl || '',
            categoryId: categoryId
        }),
        // --- SÚPISKA TÍMU (pôvodná) ---
        renderTeamRoster()
    );
};

































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
        
        // Skúsime použiť teamManager na synchrónnu konverziu
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

    // --- LISTENER PRE ZMENY V matchEvents PRE AKTUALIZÁCIU UI ---
    useEffect(() => {
        if (!window.db) return;

        console.log('🔄 [UI Updater] Nastavujem listener na matchEvents pre aktualizáciu UI...');
        
        // Počúvame na všetky zmeny v matchEvents
        const eventsRef = collection(window.db, 'matchEvents');
        const eventsQuery = query(eventsRef);
        
        const unsubscribe = onSnapshot(eventsQuery, (snapshot) => {
            console.log(`🔄 [UI Updater] Zmena v matchEvents: ${snapshot.size} udalostí`);
            
            // Ak máme otvorený detail tímu, aktualizujeme štatistiky
            if (selectedTeamDetails && teamRoster.length > 0) {
                console.log('🔄 [UI Updater] Aktualizujem UI po zmene v matchEvents');
                // Zvýšime trigger pre aktualizáciu
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

    // Vymeňte celý useEffect pre štatistiky (od riadku cca 612) za tento:
    
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
    
        // --- 1. ZÍSKAME VŠETKY matchId PRE TÍM ---
        const matchesRef = collection(window.db, 'matches');
        const matchesQuery = query(matchesRef);
    
        let matchIds = new Set();
        let isFirstLoad = true;
    
        // --- FUNKCIA NA ZÍSKANIE ZÁKLADNÉHO NÁZVU BEZ SUFIXU ---
        const getBaseTeamName = (teamName) => {
            if (!teamName) return teamName;
            // Odstránime sufix (posledné písmeno oddelené medzerou)
            const parts = teamName.trim().split(' ');
            if (parts.length >= 2) {
                const lastPart = parts[parts.length - 1];
                // Ak je posledná časť jedno písmeno (A-Z), považujeme to za sufix
                if (lastPart.length === 1 && /[A-ZÁÄČĎÉÍĽĹŇÓÔŘŠŤÚÝŽa-záäčďéíĺľňóôřšťúýž]/.test(lastPart)) {
                    return parts.slice(0, -1).join(' ');
                }
            }
            return teamName;
        };
    
        const calculateStatsFromEvents = (eventsSnapshot, chunkIndex) => {
            console.log(`[Stats Effect] 📦 chunk ${chunkIndex}: spracúvam ${eventsSnapshot.size} udalostí`);
            
            // Inicializujeme štatistiky pre každého člena
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
        
            // Prejdeme všetky udalosti a pripočítame ich k príslušným členom
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
                
                // Kontrola kategórie - udalosť musí byť v rovnakej kategórii ako tím
                if (eventData.categoryName && eventData.categoryName !== currentCategoryName) {
                    console.log(`[Stats Effect] ⏭️ Preskakujem udalosť - kategória sa nezhoduje: udalosť=${eventData.categoryName}, tím=${currentCategoryName}`);
                    return;
                }
                
                // Získame informácie o zápase z mapovania
                const matchInfo = matchTeamMap[matchId];
                if (!matchInfo) {
                    console.log(`[Stats Effect] ⚠️ Nenašli sa informácie o zápase ${matchId}`);
                    return;
                }
                
                // Zistíme, či udalosť patrí nášmu tímu
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
                
                // Nájdeme príslušného člena tímu podľa memberTypeKey a memberIndex
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
                
                // Pripočítame štatistiky podľa typu udalosti
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
    
        // --- 3. POČÚVAME NA UDALOSTI PRE VŠETKY ZÁPASY TÍMU ---
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
    
        // --- 4. POČÚVAME NA ZMENY V ZÁPASOCH A AKTUALIZUJEME UDALOSTI ---
        let unsubscribeMatches = null;
        let matchTeamMap = {};
    
        const processMatches = (matchesSnapshot) => {
            const newMatchIds = new Set();
            const newMatchTeamMap = {};
            
            console.log('[Stats Effect] 📦 Všetky zápasy - počet:', matchesSnapshot.size);
            
            // Použijeme celý názov tímu (nie základný)
            const fullTeamName = currentTeamName;
            console.log('[Stats Effect] Celý názov tímu (vrátane sufixu):', fullTeamName);
            
            matchesSnapshot.forEach(doc => {
                const matchData = doc.data();
                const matchId = doc.id;
                
                // Konvertujeme identifikátory tímov z zápasu na zobrazené názvy
                const convertedHome = convertIdentifierToDisplayName(matchData.homeTeamIdentifier);
                const convertedAway = convertIdentifierToDisplayName(matchData.awayTeamIdentifier);
                
                // Uložíme si mapovanie pre tento zápas
                newMatchTeamMap[matchId] = {
                    homeTeam: convertedHome,
                    awayTeam: convertedAway
                };
                
                // Porovnávame CELÉ názvy (vrátane sufixu)
                if (convertedHome === fullTeamName || convertedAway === fullTeamName) {
                    console.log(`[Stats Effect]   ✅ Nájdený zápas pre "${fullTeamName}": ${matchId} - ${convertedHome} vs ${convertedAway}`);
                    newMatchIds.add(matchId);
                }
            });
        
            // Aktualizujeme mapovanie tímov pre zápasy
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
    
        // --- 5. CLEANUP ---
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

    const closeTeamDetails = () => {
        const { categoryName: categoryNameFromUrl } = parseUrlHash();
        
        if (rosterUnsubscribe) {
            try {
                rosterUnsubscribe();
            } catch (e) {}
            setRosterUnsubscribe(null);
        }
        
        setSelectedTeamDetails(null);
        setTeamRoster([]);
        setRosterTeamName('');
        setRosterCategoryName('');
        setMembersStats({});
        
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
        
        setSelectedTeamDetails({
            teamName: normalizedTeamName,
            category: normalizedCategory,
            occurrences: allOccurrences
        });
        
        let categoryName = occ.category;
        if (categoryIdToNameMap[categoryName]) {
            categoryName = categoryIdToNameMap[categoryName];
        }
        loadTeamRoster(occ.teamName, categoryName);
    };

    // Vymeňte časť renderTeamRoster v teams.js (od cca riadku 1500) za:
    
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
        
        // Debug - vypíšeme štatistiky do konzoly
        console.log('[renderTeamRoster] membersStats:', membersStats);
        console.log('[renderTeamRoster] teamRoster:', teamRoster);
        
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
                            
                            // Debug pre každého člena
                            console.log(`[renderTeamRoster] ${fullName} (${member.type}_${member.originalIndex}):`, stats);
                            
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

        // Získame categoryId pre vybranú kategóriu
        let categoryId = null;
        const currentCategoryName = selectedTeamDetails.category || categoryFromUrl;
        if (currentCategoryName) {
            const foundId = Object.keys(categoryIdToNameMap).find(id => categoryIdToNameMap[id] === currentCategoryName);
            if (foundId) categoryId = foundId;
        }

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
            // --- BOX S KATEGÓRIAMI ---
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
            // --- NOVÝ KOMPONENT: ZÁPASY TÍMU ---
            React.createElement(TeamMatchesList, {
                teamName: selectedTeamDetails.teamName,
                categoryName: selectedTeamDetails.category || categoryFromUrl || '',
                categoryId: categoryId
            }),
            // --- SÚPISKA TÍMU ---
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
