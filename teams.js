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

export const notify = (message, type = 'info') => {
  const id = Date.now() + Math.random();
  listeners.forEach(cb => cb({ id, message, type }));
};

export const subscribe = (cb) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

// HLAVNÝ KOMPONENT - ZOBRAZUJE PREHĽADOVÚ TABUĽKU LEN Z POUŽÍVATEĽSKÝCH TÍMOV
const TeamsOverviewApp = (props) => {
    const [allTeams, setAllTeams] = useState([]);
    const [categoryIdToNameMap, setCategoryIdToNameMap] = useState({});
    const [uiNotification, setUiNotification] = useState(null);
    const currentUserEmail = window.globalUserProfileData?.email || null;
    
    // Stav pre filtrovanie
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [selectedTeamNameFilter, setSelectedTeamNameFilter] = useState('');

    // ===================================================================
    // LISTENERY PRE DÁTA - LEN POUŽÍVATEĽSKÉ TÍMY (BEZ SUPERSTRUCTURE)
    // ===================================================================
    useEffect(() => {
        if (!window.db) return;

        // Načítanie používateľských tímov - IBA TOTO, BEZ SUPERSTRUCTURE
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
            setAllTeams(userTeamsList); // IBA používateľské tímy
        });

        // Načítanie kategórií
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

    // ===================================================================
    // VÝPOČET DÁT PRE TABUĽKU
    // ===================================================================
    const getTableData = () => {
        if (allTeams.length === 0 || Object.keys(categoryIdToNameMap).length === 0) {
            return { teamNames: [], categoryNames: [], matrix: {} };
        }

        // Získame všetky kategórie (zoradené)
        const categoryNames = Object.values(categoryIdToNameMap).sort();
        
        // Získame všetky unikátne názvy tímov (bez kategórie)
        const teamNamesSet = new Set();
        allTeams.forEach(team => {
            let cleanName = team.teamName;
            // Odstránime prefix kategórie
            if (team.category && cleanName.startsWith(team.category + ' ')) {
                cleanName = cleanName.substring(team.category.length + 1).trim();
            }
            // Filtrovanie podľa vybraného názvu
            if (selectedTeamNameFilter && !cleanName.toLowerCase().includes(selectedTeamNameFilter.toLowerCase())) {
                return;
            }
            teamNamesSet.add(cleanName);
        });
        
        const teamNames = Array.from(teamNamesSet).sort();
        
        // Vytvoríme maticu počtov
        const matrix = {};
        teamNames.forEach(name => {
            matrix[name] = {};
            categoryNames.forEach(cat => {
                // Spočítame tímy v tejto kategórii s týmto názvom
                const count = allTeams.filter(team => {
                    let cleanName = team.teamName;
                    if (team.category && cleanName.startsWith(team.category + ' ')) {
                        cleanName = cleanName.substring(team.category.length + 1).trim();
                    }
                    return team.category === cat && cleanName === name;
                }).length;
                matrix[name][cat] = count;
            });
        });

        return { teamNames, categoryNames, matrix };
    };

    const { teamNames, categoryNames, matrix } = getTableData();

    // Filtrovanie podľa kategórie - ak je vybraná kategória, zobrazíme len tú
    const filteredCategoryNames = selectedCategoryId 
        ? [categoryIdToNameMap[selectedCategoryId]].filter(Boolean)
        : categoryNames;

    // ===================================================================
    // NOTIFIKÁCIE
    // ===================================================================
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

    // ===================================================================
    // RENDER - PREHĽADOVÁ TABUĽKA
    // ===================================================================
    const renderOverviewTable = () => {
        if (teamNames.length === 0 || filteredCategoryNames.length === 0) {
            return React.createElement(
                'div',
                { className: 'text-center py-16 text-gray-500' },
                'Žiadne dáta pre zobrazenie. Najprv vytvorte kategórie a tímy.'
            );
        }

        // Získame celkové počty pre každý tím (súčet cez všetky kategórie)
        const getTotalForTeam = (teamName) => {
            let total = 0;
            filteredCategoryNames.forEach(cat => {
                total += (matrix[teamName]?.[cat] || 0);
            });
            return total;
        };

        // Zoradenie tímov podľa celkového počtu (zostupne)
        const sortedTeamNames = [...teamNames].sort((a, b) => {
            const totalA = getTotalForTeam(a);
            const totalB = getTotalForTeam(b);
            return totalB - totalA;
        });

        return React.createElement(
            'div',
            { className: 'w-full overflow-x-auto' },
            React.createElement(
                'table',
                { 
                    className: 'w-full border-collapse bg-white shadow-lg rounded-lg overflow-hidden',
                    style: { minWidth: '600px' }
                },
                // HLAVIČKA TABUĽKY
                React.createElement(
                    'thead',
                    { className: 'bg-gray-800 text-white' },
                    React.createElement(
                        'tr',
                        null,
                        React.createElement(
                            'th',
                            { 
                                className: 'px-4 py-3 text-left font-semibold sticky left-0 bg-gray-800 z-10',
                                style: { minWidth: '180px', maxWidth: '250px' }
                            },
                            'Názov tímu'
                        ),
                        filteredCategoryNames.map(catName => 
                            React.createElement(
                                'th',
                                { 
                                    key: catName,
                                    className: 'px-4 py-3 text-center font-semibold whitespace-nowrap'
                                },
                                catName
                            )
                        ),
                        React.createElement(
                            'th',
                            { 
                                className: 'px-4 py-3 text-center font-semibold bg-gray-700 whitespace-nowrap'
                            },
                            'Celkom'
                        )
                    )
                ),
                // TELO TABUĽKY
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
                            // Názov tímu (prvý stĺpec - fixný)
                            React.createElement(
                                'td',
                                { 
                                    className: 'px-4 py-3 font-medium text-gray-800 sticky left-0 bg-inherit z-10 border-r border-gray-200',
                                    style: { minWidth: '180px', maxWidth: '250px' }
                                },
                                teamName
                            ),
                            // Hodnoty pre každú kategóriu
                            filteredCategoryNames.map(catName => {
                                const count = matrix[teamName]?.[catName] || 0;
                                // Farba podľa počtu
                                let bgColor = 'bg-gray-100';
                                if (count > 0 && count <= 2) bgColor = 'bg-green-100';
                                else if (count >= 3 && count <= 5) bgColor = 'bg-yellow-100';
                                else if (count >= 6) bgColor = 'bg-red-100';
                                
                                return React.createElement(
                                    'td',
                                    { 
                                        key: catName,
                                        className: `px-4 py-3 text-center font-semibold ${bgColor}`
                                    },
                                    count > 0 ? count : '—'
                                );
                            }),
                            // Celkový súčet
                            React.createElement(
                                'td',
                                { 
                                    className: `px-4 py-3 text-center font-bold ${total > 0 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-400'}`
                                },
                                total
                            )
                        );
                    })
                ),
                // PATIČKA TABUĽKY - SÚČTY PRE KATEGÓRIE
                React.createElement(
                    'tfoot',
                    { className: 'bg-gray-200 font-semibold' },
                    React.createElement(
                        'tr',
                        null,
                        React.createElement(
                            'td',
                            { 
                                className: 'px-4 py-3 text-left text-gray-700 sticky left-0 bg-gray-200 z-10 border-r border-gray-300'
                            },
                            'Celkom tímov'
                        ),
                        filteredCategoryNames.map(catName => {
                            let totalInCategory = 0;
                            teamNames.forEach(teamName => {
                                totalInCategory += (matrix[teamName]?.[catName] || 0);
                            });
                            return React.createElement(
                                'td',
                                { 
                                    key: catName,
                                    className: 'px-4 py-3 text-center text-gray-700'
                                },
                                totalInCategory
                            );
                        }),
                        React.createElement(
                            'td',
                            { 
                                className: 'px-4 py-3 text-center text-gray-700 bg-gray-300'
                            },
                            teamNames.reduce((sum, name) => sum + getTotalForTeam(name), 0)
                        )
                    )
                )
            )
        );
    };

    // ===================================================================
    // FILTRE A OVLÁDANIE
    // ===================================================================
    const renderFilters = () => {
        const categoryOptions = Object.entries(categoryIdToNameMap)
            .sort(([, a], [, b]) => a.localeCompare(b))
            .map(([id, name]) => 
                React.createElement('option', { key: id, value: id }, name)
            );

        return React.createElement(
            'div',
            { className: 'flex flex-wrap gap-4 mb-6 items-end' },
            // Filter podľa kategórie
            React.createElement(
                'div',
                { className: 'flex flex-col' },
                React.createElement('label', { className: 'text-sm font-medium text-gray-600 mb-1' }, 'Kategória'),
                React.createElement(
                    'select',
                    {
                        value: selectedCategoryId,
                        onChange: (e) => setSelectedCategoryId(e.target.value),
                        className: 'px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white'
                    },
                    React.createElement('option', { value: '' }, 'Všetky kategórie'),
                    ...categoryOptions
                )
            ),
            // Filter podľa názvu tímu
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
            // Tlačidlo na vymazanie filtra
            (selectedCategoryId || selectedTeamNameFilter) && React.createElement(
                'button',
                {
                    onClick: () => {
                        setSelectedCategoryId('');
                        setSelectedTeamNameFilter('');
                    },
                    className: 'px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors'
                },
                'Vymazať filtre ✕'
            ),
            // Informácia o počte tímov
            React.createElement(
                'div',
                { className: 'ml-auto text-sm text-gray-500' },
                `Počet tímov: ${teamNames.length}`
            )
        );
    };

    // ===================================================================
    // HLAVNÝ RENDER
    // ===================================================================
    return React.createElement(
        'div',
        { className: 'flex flex-col w-full p-4 relative text-[87.5%]' },
        React.createElement(NotificationPortal, null),
        
        // Hlavička
        React.createElement(
            'div',
            { className: 'mb-6' },
            React.createElement(
                'h1',
                { className: 'text-3xl font-bold text-gray-800 text-center' },
                'Prehľad tímov podľa kategórií'
            ),
            React.createElement(
                'p',
                { className: 'text-center text-gray-500 mt-1' },
                'Zobrazenie počtu výskytov každého tímu v jednotlivých kategóriách'
            )
        ),
        
        // Filtre
        renderFilters(),
        
        // Tabuľka
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-xl p-4' },
            renderOverviewTable()
        ),
        
        // Legenda
        React.createElement(
            'div',
            { className: 'mt-4 flex flex-wrap gap-4 justify-center text-sm' },
            React.createElement(
                'div',
                { className: 'flex items-center gap-2' },
                React.createElement('div', { className: 'w-4 h-4 bg-green-100 rounded border border-green-300' }),
                '1-2 tímy'
            ),
            React.createElement(
                'div',
                { className: 'flex items-center gap-2' },
                React.createElement('div', { className: 'w-4 h-4 bg-yellow-100 rounded border border-yellow-300' }),
                '3-5 tímov'
            ),
            React.createElement(
                'div',
                { className: 'flex items-center gap-2' },
                React.createElement('div', { className: 'w-4 h-4 bg-red-100 rounded border border-red-300' }),
                '6+ tímov'
            ),
            React.createElement(
                'div',
                { className: 'flex items-center gap-2' },
                React.createElement('div', { className: 'w-4 h-4 bg-gray-100 rounded border border-gray-300' }),
                'Žiadny tím'
            )
        )
    );
};

// ============================================================
// INICIALIZÁCIA APLIKÁCIE
// ============================================================
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

// Okamžité vykreslenie
const rootElement = document.getElementById('root');
if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
    const root = ReactDOM.createRoot(rootElement);
    root.render(React.createElement(TeamsOverviewApp, { 
        userProfileData: window.globalUserProfileData || null 
    }));
}
