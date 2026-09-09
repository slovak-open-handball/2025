// statistics.js
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

// Funkcia na odstránenie sufixu
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

// Debugovacie funkcie
const debugMatches = async () => {
    // ... (zachované z pôvodného kódu)
};

setTimeout(() => {
    debugMatches();
}, 3000);

window.debugMatches = debugMatches;

const debugMatchEvents = async () => {
    // ... (zachované z pôvodného kódu)
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

// --- KOMPONENTA PRE JEDNOTLIVÝ TÍM ---
const TeamRosterItem = ({ teamName, cleanName, categoryName }) => {
    const [rosterData, setRosterData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [unsubscribe, setUnsubscribe] = useState(null);
    
    const hasSuffix = teamName !== cleanName;
    
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
                console.error(`[TeamRosterItem] Chyba pri načítaní súpisky pre ${teamName}:`, error);
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
    
    // Renderovanie súpisky pre jeden tím
    const renderRosterTable = () => {
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
        { className: 'bg-white rounded-lg shadow-md overflow-hidden border border-gray-200' },
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
            renderRosterTable()  // <-- OPRAVENÉ: teraz je to renderRosterTable
        )
    );
};

// --- HLAVNÁ KOMPONENTA ---
const TeamsOverviewApp = (props) => {
    const [allTeams, setAllTeams] = useState([]);
    const [categoryIdToNameMap, setCategoryIdToNameMap] = useState({});
    const [uiNotification, setUiNotification] = useState(null);
    const [selectedTeamNameFilter, setSelectedTeamNameFilter] = useState('');
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [isRostersVisible, setIsRostersVisible] = useState(
        window.pagesVisibility && 
        window.pagesVisibility['rosters'] && 
        window.pagesVisibility['rosters'].visible === true
    );

    const tableContainerRef = useRef(null);
    const [maxTableHeight, setMaxTableHeight] = useState('60vh');

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
    }, [allTeams]);

    // Načítanie tímov a kategórií
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

        // Filtrovanie podľa názvu
        let filteredTeams = uniqueTeams;
        if (selectedTeamNameFilter) {
            filteredTeams = uniqueTeams.filter(team => 
                team.cleanName.toLowerCase().includes(selectedTeamNameFilter.toLowerCase())
            );
        }

        // Zoradenie tímov podľa názvu
        const sortedTeams = filteredTeams.sort((a, b) => {
            return slovakCollator.compare(a.cleanName, b.cleanName);
        });

        if (sortedTeams.length === 0) {
            return React.createElement(
                'div',
                { className: 'text-center py-16 text-gray-500' },
                'Žiadne tímy nevyhovujú zadanému filtru.'
            );
        }

        return React.createElement(
            'div',
            { 
                className: 'w-full overflow-y-auto relative',
                ref: tableContainerRef,
                style: { maxHeight: maxTableHeight }
            },
            React.createElement(
                'div',
                { className: 'space-y-4 p-2' },
                sortedTeams.map((teamGroup, index) => {
                    const teamName = teamGroup.teamName;
                    const cleanName = teamGroup.cleanName;
                    const categoryName = teamGroup.category;
                    
                    // Použijeme samostatnú komponentu pre každý tím
                    return React.createElement(TeamRosterItem, {
                        key: `${categoryName}_${teamName}_${index}`,
                        teamName: teamName,
                        cleanName: cleanName,
                        categoryName: categoryName
                    });
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
