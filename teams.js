import React from "https://esm.sh/react@18.2.0";
import ReactDOM from "https://esm.sh/react-dom@18.2.0";
import { doc, getDoc, onSnapshot, updateDoc, collection, query, getDocs, setDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
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
    
    console.log(`[loadTeamMembers] Načítavam súpisku pre tím: "${actualTeamName}", kategória: "${categoryName}"`);
    
    if (onMappedName) {
        onMappedName(actualTeamName);
    }
    
    const usersRef = collection(window.db, 'users');
    
    const unsubscribe = onSnapshot(usersRef, (usersSnapshot) => {
        const members = [];
        let foundAnyTeam = false;
        let userCount = 0;
        
        console.log(`[loadTeamMembers] Spracúvam ${usersSnapshot.docs.length} používateľov...`);
        
        for (const userDoc of usersSnapshot.docs) {
            const userId = userDoc.id;
            const userData = userDoc.data();
            const teams = userData.teams || {};
            userCount++;
            
            console.log(`[loadTeamMembers] Používateľ ${userCount}: ${userId}, má ${Object.keys(teams).length} kategórií`);
            
            for (const [categoryKey, teamsArray] of Object.entries(teams)) {
                if (categoryKey !== categoryName) continue;
                
                console.log(`[loadTeamMembers] Kategória "${categoryKey}" - hľadám tím "${actualTeamName}" v poli s ${teamsArray ? teamsArray.length : 0} tímami`);
                
                // Vyhľadávame PRESNE podľa celého názvu tímu vrátane sufixu
                const foundTeam = (teamsArray || []).find(t => t.teamName === actualTeamName);
                
                if (foundTeam) {
                    foundAnyTeam = true;
                    console.log(`[loadTeamMembers] ✅ Našiel som tím "${actualTeamName}" u používateľa ${userId}`);
                    console.log(`[loadTeamMembers] Dáta tímu:`, JSON.stringify(foundTeam, null, 2));
                    
                    // Hráči
                    if (foundTeam.playerDetails && Array.isArray(foundTeam.playerDetails)) {
                        console.log(`[loadTeamMembers] Hráči (${foundTeam.playerDetails.length}):`, JSON.stringify(foundTeam.playerDetails, null, 2));
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
                        console.log(`[loadTeamMembers] Členovia RT (muži) (${foundTeam.menTeamMemberDetails.length}):`, JSON.stringify(foundTeam.menTeamMemberDetails, null, 2));
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
                        console.log(`[loadTeamMembers] Členovia RT (ženy) (${foundTeam.womenTeamMemberDetails.length}):`, JSON.stringify(foundTeam.womenTeamMemberDetails, null, 2));
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
                    
                    // Šoféri (muži)
                    if (foundTeam.driverDetailsMale && Array.isArray(foundTeam.driverDetailsMale)) {
                        console.log(`[loadTeamMembers] Šoféri (muži) (${foundTeam.driverDetailsMale.length}):`, JSON.stringify(foundTeam.driverDetailsMale, null, 2));
                        foundTeam.driverDetailsMale.forEach((driver, idx) => {
                            members.push({
                                type: 'Šofér (muž)',
                                firstName: driver.firstName || '',
                                lastName: driver.lastName || '',
                                jerseyNumber: '',
                                registrationNumber: driver.registrationNumber || '',
                                userId: userId,
                                originalIndex: idx,
                                dbArrayName: 'driverDetailsMale',
                                teamName: actualTeamName,
                                categoryName: categoryName
                            });
                        });
                    }
                    
                    // Šoféri (ženy)
                    if (foundTeam.driverDetailsFemale && Array.isArray(foundTeam.driverDetailsFemale)) {
                        console.log(`[loadTeamMembers] Šoféri (ženy) (${foundTeam.driverDetailsFemale.length}):`, JSON.stringify(foundTeam.driverDetailsFemale, null, 2));
                        foundTeam.driverDetailsFemale.forEach((driver, idx) => {
                            members.push({
                                type: 'Šofér (žena)',
                                firstName: driver.firstName || '',
                                lastName: driver.lastName || '',
                                jerseyNumber: '',
                                registrationNumber: driver.registrationNumber || '',
                                userId: userId,
                                originalIndex: idx,
                                dbArrayName: 'driverDetailsFemale',
                                teamName: actualTeamName,
                                categoryName: categoryName
                            });
                        });
                    }
                    
                    break;
                }
            }
        }
        
        if (!foundAnyTeam) {
            console.log(`[loadTeamMembers] ❌ Tím "${actualTeamName}" nebol nájdený u žiadneho používateľa v kategórii "${categoryName}"`);
        }
        
        // Zoradenie: najprv RT členovia, potom hráči
        const rtMembers = members.filter(m => m.type !== 'Hráč');
        const players = members.filter(m => m.type === 'Hráč');
        const sortedMembers = [...rtMembers, ...players];
        
        console.log(`[loadTeamMembers] ✅ Celkovo nájdených členov: ${sortedMembers.length}`);
        console.log(`[loadTeamMembers] Členovia:`, sortedMembers.map(m => `${m.type}: ${m.firstName} ${m.lastName}`).join(', '));
        
        if (onUpdate) onUpdate(sortedMembers);
    }, (error) => {
        console.error(`[loadTeamMembers] Chyba pri načítavaní:`, error);
        if (onUpdate) onUpdate([]);
    });
    
    return unsubscribe;
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

    // Funkcia na načítanie štatistík členov tímu
    useEffect(() => {
        if (!teamRoster || teamRoster.length === 0 || !window.db) {
            setMembersStats({});
            return;
        }

        // Vytvoríme mapu pre štatistiky
        const initialStats = {};
        teamRoster.forEach((member, idx) => {
            const memberKey = `${member.type}_${member.originalIndex}`;
            initialStats[memberKey] = {
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

        // Nastavíme počiatočné štatistiky
        setMembersStats(initialStats);

        // Načítame udalosti z matchEvents
        const eventsRef = collection(window.db, 'matchEvents');
        const unsubscribeEvents = onSnapshot(eventsRef, (snapshot) => {
            const newStats = { ...initialStats };

            snapshot.forEach((doc) => {
                const event = doc.data();
                
                // Zistíme, či udalosť patrí k niektorému členovi tímu
                for (const [memberKey, stat] of Object.entries(newStats)) {
                    if (stat.dbArrayName === event.memberTypeKey && stat.dbIndex === event.memberIndex) {
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
                        break;
                    }
                }
            });

            setMembersStats(newStats);
        }, (error) => {
            // Ak nastane chyba, ponecháme počiatočné štatistiky
        });

        return () => {
            unsubscribeEvents();
        };
    }, [teamRoster]);

    // Funkcia na načítanie súpisky tímu pomocou loadTeamMembers
    const loadTeamRoster = (teamName, categoryName) => {
        // Zrušíme predchádzajúci listener
        if (rosterUnsubscribe) {
            try {
                rosterUnsubscribe();
            } catch (e) {
                // Ignorujeme chyby pri odhlasovaní
            }
            setRosterUnsubscribe(null);
        }
        
        if (!teamName || !categoryName) {
            setTeamRoster([]);
            setIsLoadingRoster(false);
            setRosterTeamName('');
            setRosterCategoryName('');
            setMembersStats({});
            return;
        }
        
        setIsLoadingRoster(true);
        setTeamRoster([]);
        setRosterTeamName(teamName);
        setRosterCategoryName(categoryName);
        setMembersStats({});
        
        const handleMembersUpdate = (members) => {
            setTeamRoster(members);
            setIsLoadingRoster(false);
        };
        
        const handleMappedName = (mappedName) => {
            // Môžeme použiť na aktualizáciu zobrazeného názvu
        };
        
        try {
            const unsubscribe = loadTeamMembers(teamName, categoryName, handleMembersUpdate, handleMappedName);
            setRosterUnsubscribe(() => unsubscribe);
        } catch (error) {
            setIsLoadingRoster(false);
        }
        
        // Timeout pre prípad, že sa načítanie zasekne
        const timeoutId = setTimeout(() => {
            setIsLoadingRoster(false);
        }, 10000);
        
        // Uložíme timeout pre cleanup
        window.__rosterTimeoutId = timeoutId;
    };

    // Čistenie listenera pri zmene výberu
    useEffect(() => {
        return () => {
            if (rosterUnsubscribe) {
                try {
                    rosterUnsubscribe();
                } catch (e) {
                    // Ignorujeme chyby pri odhlasovaní
                }
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
        // Zistíme, či je v URL kategória
        const categoryFromUrl = getCategoryFromUrl();
        const hasCategoryInUrl = !!categoryFromUrl;
        
        if (selectedTeamDetails && selectedTeamDetails.occurrences && selectedTeamDetails.occurrences.length > 0 && hasCategoryInUrl) {
            // Nájdeme aktuálne vybraný výskyt
            let selectedOcc = null;
            
            // Najprv skúsime nájsť podľa uloženej kategórie a názvu
            if (selectedTeamDetails.category && selectedTeamDetails.teamName) {
                selectedOcc = selectedTeamDetails.occurrences.find(
                    occ => occ.category === selectedTeamDetails.category && 
                           occ.teamName === selectedTeamDetails.teamName
                );
            }
            
            // Ak sme nenašli, skúsime podľa kategórie z URL
            if (!selectedOcc && categoryFromUrl) {
                selectedOcc = selectedTeamDetails.occurrences.find(
                    occ => occ.category === categoryFromUrl
                );
            }
            
            // Ak stále nemáme, použijeme prvý výskyt, ale zapamätáme si jeho celý názov
            if (!selectedOcc && selectedTeamDetails.occurrences.length > 0) {
                selectedOcc = selectedTeamDetails.occurrences[0];
                // Aktualizujeme selectedTeamDetails s celým názvom
                setSelectedTeamDetails(prev => ({
                    ...prev,
                    teamName: selectedOcc.teamName,
                    category: selectedOcc.category
                }));
            }
            
            if (selectedOcc) {
                // Získame čistý názov kategórie
                let categoryName = selectedOcc.category;
                if (categoryIdToNameMap[categoryName]) {
                    categoryName = categoryIdToNameMap[categoryName];
                }
                console.log(`[useEffect] Načítavam súpisku pre tím: "${selectedOcc.teamName}", kategória: "${categoryName}"`);
                loadTeamRoster(selectedOcc.teamName, categoryName);
            }
        } else {
            // Zrušíme listener a vyčistíme
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
        // Najprv kategória, potom tím
        if (categoryName) {
            // Normalizujeme viacnásobné medzery na jednu
            const normalizedCategory = categoryName.replace(/\s+/g, ' ').trim();
            // Najprv nahradíme " - " za špeciálny placeholder
            let encodedCategory = normalizedCategory.replace(/ - /g, '___TRIPLE_DASH___');
            // Potom nahradíme medzery za "-"
            encodedCategory = encodedCategory.replace(/ /g, '-');
            // Nakoniec nahradíme placeholder za "---"
            encodedCategory = encodedCategory.replace(/___TRIPLE_DASH___/g, '---');
            hashParts.push(`category=${encodeURIComponent(encodedCategory)}`);
        }
        if (teamName) {
            // Normalizujeme viacnásobné medzery na jednu
            const normalizedTeam = teamName.replace(/\s+/g, ' ').trim();
            // Najprv nahradíme " - " za špeciálny placeholder
            let encodedTeam = normalizedTeam.replace(/ - /g, '___TRIPLE_DASH___');
            // Potom nahradíme medzery za "-"
            encodedTeam = encodedTeam.replace(/ /g, '-');
            // Nakoniec nahradíme placeholder za "---"
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
            
            // Získame ID kategórie z URL priamo
            let categoryIdFromUrl = '';
            let categoryNameToStore = null;
            
            if (categoryNameFromUrl) {
                const categoryId = Object.keys(categoryIdToNameMap).find(id => categoryIdToNameMap[id] === categoryNameFromUrl);
                if (categoryId) {
                    categoryIdFromUrl = categoryId;
                    categoryNameToStore = categoryNameFromUrl;
                }
            }
            
            // Nastavíme filter kategórie
            if (categoryIdFromUrl) {
                setSelectedCategoryId(categoryIdFromUrl);
            }
            
            if (teamNameFromUrl) {
                // Najprv skúsime nájsť presnú zhodu podľa celého názvu (vrátane sufixu)
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
    
                // Ak sme nenašli presnú zhodu, skúsime bez sufixu
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
                    // Ak máme kategóriu, vyberieme konkrétny výskyt
                    let selectedOccurrences = teamOccurrences;
                    let selectedTeamName = teamNameFromUrl;
                    
                    // Ak je v URL kategória, vyberieme len výskyty v tejto kategórii
                    if (categoryNameFromUrl) {
                        const filteredOccurrences = teamOccurrences.filter(occ => occ.category === categoryNameFromUrl);
                        if (filteredOccurrences.length > 0) {
                            selectedOccurrences = filteredOccurrences;
                            // Ak máme presný názov, použijeme ho
                            const exactMatch = filteredOccurrences.find(occ => occ.teamName === teamNameFromUrl);
                            if (exactMatch) {
                                selectedTeamName = exactMatch.teamName;
                            }
                        }
                    }
                    
                    setSelectedTeamDetails({
                        teamName: selectedTeamName, // Uložíme celý názov vrátane sufixu
                        category: categoryNameToStore,
                        occurrences: selectedOccurrences
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
                
                // Najprv zistíme ID kategórie z URL
                let newCategoryId = '';
                if (categoryNameFromUrl) {
                    const categoryId = Object.keys(categoryIdToNameMap).find(id => categoryIdToNameMap[id] === categoryNameFromUrl);
                    if (categoryId) {
                        newCategoryId = categoryId;
                    }
                }
                
                // Aktualizácia filtra kategórie
                setSelectedCategoryId(newCategoryId);
                
                // Aktualizácia detailu tímu - IBA ak sa zmenil tím v URL
                if (teamNameFromUrl) {
                    // Odstránime sufix z názvu z URL pre vyhľadávanie
                    const baseTeamNameFromUrl = removeSuffix(teamNameFromUrl);
                    
                    // Skontrolujeme, či už nemáme rovnaký tím zobrazený (porovnanie bez sufixu)
                    const currentBaseName = selectedTeamDetails ? removeSuffix(selectedTeamDetails.teamName) : null;
                    
                    if (!selectedTeamDetails || currentBaseName !== baseTeamNameFromUrl) {
                        const teamOccurrences = allTeams
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

                        if (teamOccurrences.length > 0) {
                            setSelectedTeamDetails({
                                teamName: teamNameFromUrl,
                                category: categoryNameFromUrl || null,
                                occurrences: teamOccurrences
                            });
                        } else {
                            setSelectedTeamDetails(null);
                        }
                    } else {
                        // Ak je rovnaký tím, aktualizujeme len kategóriu v detaile
                        setSelectedTeamDetails(prev => ({
                            ...prev,
                            category: categoryNameFromUrl || null
                        }));
                    }
                } else {
                    // Ak v URL nie je tím, zobrazíme tabuľku s filtrom kategórie
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
        
        // Pre tabuľku potrebujeme zobraziť názvy BEZ sufixu
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
            // Odstráň sufix pre zobrazenie v tabuľke
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
                    // Odstráň sufix pre porovnanie
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
                // Aktualizujeme URL - odstránime kategóriu
                if (selectedTeamDetails) {
                    const normalizedTeam = selectedTeamDetails.teamName.replace(/\s+/g, ' ').trim();
                    updateUrlHash(normalizedTeam, null);
                } else {
                    updateUrlHash(null);
                }
            } else {
                setSelectedCategoryId(categoryId);
                // Aktualizujeme URL - pridáme kategóriu
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
        // Normalizujeme názov - odstránime viacnásobné medzery
        const normalizedTeamName = teamName.replace(/\s+/g, ' ').trim();
        
        // Získame aktuálnu kategóriu
        const currentCategoryName = selectedCategoryId ? categoryIdToNameMap[selectedCategoryId] : null;
        
        // Nájdeme VŠETKY výskyty tímu s týmto názvom (bez sufixu)
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
                teamName: normalizedTeamName, // Ukladáme názov BEZ sufixu pre zobrazenie
                category: currentCategoryName,
                occurrences: teamOccurrences // Obsahuje všetky výskyty s rôznymi sufixmi
            });
            // Zachováme aktuálnu kategóriu ak je nastavená
            updateUrlHash(normalizedTeamName, currentCategoryName);
        }
    };

    const closeTeamDetails = () => {
        // Získame aktuálnu kategóriu z URL
        const { categoryName: categoryNameFromUrl } = parseUrlHash();
        
        // Zrušíme listener na súpisku
        if (rosterUnsubscribe) {
            try {
                rosterUnsubscribe();
            } catch (e) {
                // Ignorujeme chyby pri odhlasovaní
            }
            setRosterUnsubscribe(null);
        }
        
        // Nastavíme detail na null
        setSelectedTeamDetails(null);
        setTeamRoster([]);
        setRosterTeamName('');
        setRosterCategoryName('');
        setMembersStats({});
        
        // Ak je v URL kategória, nastavíme filter
        if (categoryNameFromUrl) {
            const categoryId = Object.keys(categoryIdToNameMap).find(id => categoryIdToNameMap[id] === categoryNameFromUrl);
            if (categoryId) {
                setSelectedCategoryId(categoryId);
            }
        } else {
            // Ak nie je kategória v URL, zachováme aktuálnu alebo ju vymažeme
            setSelectedCategoryId('');
        }
        
        // Aktualizujeme URL - zachováme kategóriu ak je v URL
        updateUrlHash(null, categoryNameFromUrl || null);
    };

    const handleTeamOccurrenceClick = (occ) => {
        const normalizedTeamName = occ.teamName.replace(/\s+/g, ' ').trim();
        const normalizedCategory = occ.category.replace(/\s+/g, ' ').trim();
        
        console.log(`[handleTeamOccurrenceClick] Klik na tím: "${normalizedTeamName}", kategória: "${normalizedCategory}"`);
        
        // Aktualizujeme URL s kategóriou aj tímom - používame CELÝ NÁZOV VRÁTANE SUFIXU
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
        
        // AKTUALIZUJEME selectedTeamDetails - zmeníme názov aj kategóriu
        // Nájdeme všetky výskyty pre tento tím (rovnaký base názov)
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
        
        // Uložíme celý názov vrátane sufixu
        setSelectedTeamDetails({
            teamName: normalizedTeamName, // Uložíme celý názov vrátane sufixu
            category: normalizedCategory, // Uložíme vybranú kategóriu
            occurrences: allOccurrences
        });
        
        // Načítame súpisku pre vybraný výskyt - používame CELÝ NÁZOV VRÁTANE SUFIXU
        let categoryName = occ.category;
        if (categoryIdToNameMap[categoryName]) {
            categoryName = categoryIdToNameMap[categoryName];
        }
        console.log(`[handleTeamOccurrenceClick] Načítavam súpisku pre: "${occ.teamName}" v kategórii "${categoryName}"`);
        loadTeamRoster(occ.teamName, categoryName);
    };

    // Render súpisky tímu so štatistikami
    const renderTeamRoster = () => {
        // Zistíme, či je v URL kategória
        const categoryFromUrl = getCategoryFromUrl();
        const hasCategoryInUrl = !!categoryFromUrl;
        
        // Ak nie je v URL kategória, nezobrazujeme súpisku
        if (!hasCategoryInUrl) {
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
        
        // Zoradenie: najprv hráči podľa čísla, potom RT členovia
        const players = teamRoster.filter(m => m.type === 'Hráč').sort((a, b) => {
            const aNum = parseInt(a.jerseyNumber) || 999;
            const bNum = parseInt(b.jerseyNumber) || 999;
            return aNum - bNum;
        });
        const rtMembers = teamRoster.filter(m => m.type !== 'Hráč');
        const sortedRoster = [...players, ...rtMembers];
        
        // Získame štatistiky pre každého člena
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
                    `Počet členov: ${teamRoster.length}`
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
                `Kategória: ${displayCategoryName}`
            )
        );
    };

    const renderTeamDetails = () => {
        if (!selectedTeamDetails) return null;

        // Zistíme, či je v URL kategória
        const categoryFromUrl = getCategoryFromUrl();
        const hasCategoryInUrl = !!categoryFromUrl;

        // Zoradíme výskyty podľa kategórie a potom podľa názvu tímu
        const sortedOccurrences = [...selectedTeamDetails.occurrences].sort((a, b) => {
            // Najprv porovnáme kategórie
            const categoryCompare = slovakCollator.compare(a.category, b.category);
            if (categoryCompare !== 0) {
                return categoryCompare;
            }
            // Ak sú kategórie rovnaké, porovnáme názvy tímov
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
                        // Ak nie je v URL kategória, všetky tlačidlá sú sivé
                        let isSelected = false;
                        if (hasCategoryInUrl) {
                            // Porovnávame celý názov tímu (vrátane sufixu) a kategóriu
                            if (selectedTeamDetails.category === null) {
                                // Ak nie je kategória nastavená, porovnávame len celý názov
                                isSelected = occ.teamName === selectedTeamDetails.teamName;
                            } else {
                                // Inak porovnávame aj kategóriu a celý názov
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
            // Box so súpiskou tímu so štatistikami - zobrazí sa LEN ak je v URL kategória
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
                        // Ak je zobrazený detail, zachováme tím, inak vymažeme všetko
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

    // Hlavný render - podmienené zobrazenie
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
