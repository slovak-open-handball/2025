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
                                firstName: player.firstName || '',
                                lastName: player.lastName || '',
                                jerseyNumber: player.jerseyNumber || '',
                                registrationNumber: player.registrationNumber || '',
                                userId: userId,
                                originalIndex: idx,
                                dbArrayName: 'playerDetails',
                                teamName: teamName,
                                categoryName: categoryName,
                                // Uložíme aj referenciu na tím pre prípadné neskoršie použitie
                                teamId: team.id || null
                            });
                        });
                    }
                    
                    // Členovia RT (muži)
                    if (team.menTeamMemberDetails && Array.isArray(team.menTeamMemberDetails)) {
                        team.menTeamMemberDetails.forEach((member, idx) => {
                            allMembers.push({
                                type: 'Člen RT (muž)',
                                firstName: member.firstName || '',
                                lastName: member.lastName || '',
                                jerseyNumber: '',
                                registrationNumber: member.registrationNumber || '',
                                userId: userId,
                                originalIndex: idx,
                                dbArrayName: 'menTeamMemberDetails',
                                teamName: teamName,
                                categoryName: categoryName,
                                teamId: team.id || null
                            });
                        });
                    }
                    
                    // Členovia RT (ženy)
                    if (team.womenTeamMemberDetails && Array.isArray(team.womenTeamMemberDetails)) {
                        team.womenTeamMemberDetails.forEach((member, idx) => {
                            allMembers.push({
                                type: 'Člen RT (žena)',
                                firstName: member.firstName || '',
                                lastName: member.lastName || '',
                                jerseyNumber: '',
                                registrationNumber: member.registrationNumber || '',
                                userId: userId,
                                originalIndex: idx,
                                dbArrayName: 'womenTeamMemberDetails',
                                teamName: teamName,
                                categoryName: categoryName,
                                teamId: team.id || null
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

const TeamsOverviewApp = (props) => {
    const [allMembers, setAllMembers] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [allMembersUnsubscribe, setAllMembersUnsubscribe] = useState(null);
    const [uiNotification, setUiNotification] = useState(null);
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

        if (isLoading) {
            return React.createElement(
                'div',
                { className: 'bg-white rounded-xl shadow-xl p-8' },
                React.createElement(
                    'div',
                    { className: 'text-center text-gray-500 py-8' },
                    React.createElement('div', { className: 'animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mx-auto' }),
                    React.createElement('p', { className: 'text-sm mt-4' }, 'Načítavam všetkých členov...')
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
                                React.createElement('td', { className: 'px-3 py-2 text-center font-bold text-green-600' }, ''),
                                React.createElement('td', { className: 'px-3 py-2 text-center font-medium text-teal-600' }, ''),
                                React.createElement('td', { className: 'px-3 py-2 text-center font-bold text-yellow-600' }, ''),
                                React.createElement('td', { className: 'px-3 py-2 text-center font-bold text-red-600' }, ''),
                                React.createElement('td', { className: 'px-3 py-2 text-center font-bold text-blue-600' }, ''),
                                React.createElement('td', { className: 'px-3 py-2 text-center font-bold text-orange-600' }, '')
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
