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

// ===================================================================
// POMOCNÁ FUNKCIA PRE SLOVENSKÉ ABECEDNÉ RADENIE
// ===================================================================
const slovakCollator = new Intl.Collator('sk', { 
    sensitivity: 'base',
    ignorePunctuation: true,
    numeric: false
});

// ===================================================================
// POMOCNÁ FUNKCIA PRE ODSTRÁNENIE SUFIXU (A, B, C, ...)
// ===================================================================
const removeSuffix = (teamName) => {
    // Zoznam písmen slovenskej abecedy (veľké aj malé)
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÄČĎÉÍĽĹŇÓÔŘŠŤÚÝŽ';
    const lettersLower = letters.toLowerCase();
    const allLetters = letters + lettersLower;
    
    // Skontrolujeme, či názov končí na medzeru a písmeno (A, B, C, ...)
    // a to písmeno je posledným znakom
    if (teamName.length >= 2) {
        const lastChar = teamName[teamName.length - 1];
        const secondLastChar = teamName[teamName.length - 2];
        
        // Ak je predposledný znak medzera a posledný je písmeno
        if (secondLastChar === ' ' && allLetters.includes(lastChar)) {
            // Odstránime medzeru a písmeno
            return teamName.slice(0, -2).trim();
        }
    }
    
    return teamName;
};

// ===================================================================
// HLAVNÝ KOMPONENT - ZOBRAZUJE PREHĽADOVÚ TABUĽKU LEN Z POUŽÍVATEĽSKÝCH TÍMOV
// ===================================================================
const TeamsOverviewApp = (props) => {
    const [allTeams, setAllTeams] = useState([]);
    const [categoryIdToNameMap, setCategoryIdToNameMap] = useState({});
    const [uiNotification, setUiNotification] = useState(null);
    const [showFixedHeader, setShowFixedHeader] = useState(false);
    const currentUserEmail = window.globalUserProfileData?.email || null;
    
    // Stav pre filtrovanie
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [selectedTeamNameFilter, setSelectedTeamNameFilter] = useState('');

    // Referencie pre IntersectionObserver
    const tableContainerRef = useRef(null);
    const headerSentinelRef = useRef(null);
    const observerRef = useRef(null);
    const fixedHeaderRef = useRef(null);

    // Konštanty pre šírky stĺpcov
    const COLUMN_WIDTHS = {
        teamName: { minWidth: '180px', maxWidth: '250px', width: '180px' },
        category: { minWidth: '80px', width: '80px' },
        total: { minWidth: '80px', width: '80px' }
    };

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
            setAllTeams(userTeamsList);
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

        // Získame všetky kategórie (zoradené podľa slovenskej abecedy)
        const categoryNames = Object.values(categoryIdToNameMap).sort((a, b) => slovakCollator.compare(a, b));
        
        // Najprv si pripravíme zoznam tímov s očistenými názvami (bez suffixov)
        const cleanedTeams = allTeams.map(team => ({
            ...team,
            cleanName: removeSuffix(team.teamName)
        }));
        
        // Získame všetky unikátne názvy tímov (bez kategórie) - použijeme očistené názvy
        const teamNamesSet = new Set();
        cleanedTeams.forEach(team => {
            let cleanName = team.cleanName;
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
        
        // Zoradenie názvov tímov podľa slovenskej abecedy
        const teamNames = Array.from(teamNamesSet).sort((a, b) => slovakCollator.compare(a, b));
        
        // Vytvoríme maticu počtov - použijeme očistené názvy pre porovnávanie
        const matrix = {};
        teamNames.forEach(name => {
            matrix[name] = {};
            categoryNames.forEach(cat => {
                // Spočítame tímy v tejto kategórii s týmto názvom (použijeme očistené názvy)
                const count = cleanedTeams.filter(team => {
                    let cleanName = team.cleanName;
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

    // Všetky kategórie zostávajú viditeľné - NEFILTRUJEME STĹPCE
    const filteredCategoryNames = categoryNames;

    // ===================================================================
    // INTERSECTION OBSERVER PRE FIXNÚ HLAVIČKU
    // ===================================================================
    useEffect(() => {
        // Počkáme na vykreslenie sentinel elementu
        const timeoutId = setTimeout(() => {
            const sentinel = headerSentinelRef.current;
            if (!sentinel) return;

            // Zrušíme starý observer
            if (observerRef.current) {
                observerRef.current.disconnect();
            }

            const observer = new IntersectionObserver(
                (entries) => {
                    entries.forEach(entry => {
                        setShowFixedHeader(!entry.isIntersecting);
                    });
                },
                {
                    threshold: 0,
                    rootMargin: '-70px 0px 0px 0px'
                }
            );

            observer.observe(sentinel);
            observerRef.current = observer;

            return () => {
                observer.disconnect();
                observerRef.current = null;
            };
        }, 100);

        return () => {
            clearTimeout(timeoutId);
            if (observerRef.current) {
                observerRef.current.disconnect();
                observerRef.current = null;
            }
        };
    }, [teamNames, filteredCategoryNames, selectedCategoryId, selectedTeamNameFilter]);

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
    // FUNKCIA PRE KLIKNUTIE NA HLAVIČKU KATEGÓRIE
    // ===================================================================
    const handleCategoryHeaderClick = (categoryName) => {
        // Nájdeme ID kategórie podľa názvu
        const categoryId = Object.keys(categoryIdToNameMap).find(id => categoryIdToNameMap[id] === categoryName);
        
        if (categoryId) {
            // Ak je už vybraná tá istá kategória, zrušíme filter (zobrazíme všetky tímy)
            if (selectedCategoryId === categoryId) {
                setSelectedCategoryId('');
            } else {
                setSelectedCategoryId(categoryId);
            }
        }
    };

    // ===================================================================
    // RENDER FIXNEJ HLAVIČKY (zobrazí sa len pri skrolovaní)
    // ===================================================================
    const renderFixedHeader = () => {
        if (teamNames.length === 0 || filteredCategoryNames.length === 0) {
            return null;
        }
    
        // Vypočítame celkový počet stĺpcov
        const totalColumns = 1 + filteredCategoryNames.length + 1; // názov + kategórie + celkom
    
        return React.createElement(
            'div',
            { 
                ref: fixedHeaderRef,
                className: `fixed top-14 left-1/2 transform -translate-x-1/2 z-50 bg-gray-800 text-white shadow-lg transition-all duration-300 ${
                    showFixedHeader ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'
                }`,
                style: { 
                    width: '90%',
                    maxWidth: '1080px',
                    transition: 'transform 0.3s ease, opacity 0.3s ease',
                    borderRadius: '8px',
                    overflow: 'hidden'
                }
            },
            React.createElement(
                'div',
                { 
                    style: { 
                        display: 'table',
                        width: '100%',
                        tableLayout: 'fixed',
                        minWidth: '600px'
                    }
                },
                // Riadok ako tabuľkový riadok
                React.createElement(
                    'div',
                    { style: { display: 'table-row' } },
                    // Prvý stĺpec - Názov tímu
                    React.createElement(
                        'div',
                        { 
                            style: { 
                                display: 'table-cell',
                                padding: '12px 16px',
                                fontWeight: '600',
                                position: 'sticky',
                                left: 0,
                                backgroundColor: '#1f2937',
                                zIndex: 10,
                                borderRight: '1px solid #4b5563',
                                width: '180px',
                                minWidth: '180px',
                                maxWidth: '250px'
                            }
                        },
                        'Názov tímu'
                    ),
                    // Stĺpce kategórií
                    filteredCategoryNames.map((catName) => {
                        const isSelected = selectedCategoryId && categoryIdToNameMap[selectedCategoryId] === catName;
                        
                        return React.createElement(
                            'div',
                            { 
                                key: catName,
                                onClick: () => handleCategoryHeaderClick(catName),
                                style: { 
                                    display: 'table-cell',
                                    padding: '12px 16px',
                                    textAlign: 'center',
                                    fontWeight: '600',
                                    whiteSpace: 'nowrap',
                                    cursor: 'pointer',
                                    backgroundColor: isSelected ? '#2563eb' : '#1f2937',
                                    borderRight: '1px solid #4b5563',
                                    width: '80px',
                                    minWidth: '80px'
                                },
                                title: isSelected ? 'Kliknite pre zrušenie filtra' : 'Kliknite pre filtrovanie podľa tejto kategórie'
                            },
                            React.createElement(
                                'span',
                                { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' } },
                                catName,
                                isSelected && React.createElement(
                                    'span',
                                    { style: { fontSize: '0.75rem', marginLeft: '4px' } },
                                    '✕'
                                )
                            )
                        );
                    }),
                    // Stĺpec Celkom
                    React.createElement(
                        'div',
                        { 
                            style: { 
                                display: 'table-cell',
                                padding: '12px 16px',
                                textAlign: 'center',
                                fontWeight: '600',
                                backgroundColor: '#374151',
                                whiteSpace: 'nowrap',
                                width: '80px',
                                minWidth: '80px'
                            }
                        },
                        'Celkom'
                    )
                )
            )
        );
    };

    // ===================================================================
    // RENDER - PREHĽADOVÁ TABUĽKA
    // ===================================================================
    const renderOverviewTable = () => {
        if (teamNames.length === 0 || filteredCategoryNames.length === 0) {
            return React.createElement(
                'div',
                { className: 'text-center py-16 text-gray-500' },
                'Žiadne údaje.'
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

        // Filtrovanie tímov - ak je vybraná kategória, zobrazíme len tímy, ktoré majú v tejto kategórii hodnotu > 0
        let filteredTeamNames = teamNames;
        if (selectedCategoryId) {
            const selectedCategoryName = categoryIdToNameMap[selectedCategoryId];
            filteredTeamNames = teamNames.filter(teamName => {
                const count = matrix[teamName]?.[selectedCategoryName] || 0;
                return count > 0;
            });
        }

        // Tímy sú už zoradené abecedne, zachováme toto poradie
        const sortedTeamNames = filteredTeamNames;

        // Ak po filtri nezostali žiadne tímy, zobrazíme správu
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
                className: 'w-full overflow-x-auto relative',
                ref: tableContainerRef
            },
            // Sentinel element - sledujeme, či je viditeľný
            React.createElement(
                'div',
                {
                    ref: headerSentinelRef,
                    className: 'h-0 w-full',
                    style: { position: 'absolute', top: '0', left: '0', pointerEvents: 'none' }
                }
            ),
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
                                className: 'px-4 py-3 text-left font-semibold sticky left-0 bg-gray-800 z-10 border-r border-gray-600',
                                style: COLUMN_WIDTHS.teamName
                            },
                            'Názov tímu'
                        ),
                        filteredCategoryNames.map((catName) => {
                            // Zistíme, či je táto kategória vybraná - LEN AK selectedCategoryId NIE JE PRÁZDNE
                            const isSelected = selectedCategoryId && categoryIdToNameMap[selectedCategoryId] === catName;
                            // Pridáme border na pravú stranu pre všetky okrem posledného
                            const borderClass = 'border-r border-gray-600';
                            
                            return React.createElement(
                                'th',
                                { 
                                    key: catName,
                                    onClick: () => handleCategoryHeaderClick(catName),
                                    className: `px-4 py-3 text-center font-semibold whitespace-nowrap cursor-pointer hover:bg-gray-700 transition-colors duration-200 ${isSelected ? 'bg-blue-600' : ''} ${borderClass}`,
                                    style: COLUMN_WIDTHS.category,
                                    title: isSelected ? 'Kliknite pre zrušenie filtra' : 'Kliknite pre filtrovanie podľa tejto kategórie'
                                },
                                React.createElement(
                                    'span',
                                    { className: 'flex items-center justify-center gap-1' },
                                    catName,
                                    isSelected && React.createElement(
                                        'span',
                                        { className: 'text-xs ml-1' },
                                        '✕'
                                    )
                                )
                            );
                        }),
                        React.createElement(
                            'th',
                            { 
                                className: 'px-4 py-3 text-center font-semibold bg-gray-700 whitespace-nowrap',
                                style: COLUMN_WIDTHS.total
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
                                    style: COLUMN_WIDTHS.teamName
                                },
                                teamName
                            ),
                            // Hodnoty pre každú kategóriu - BEZ PODFARBOVANIA
                            filteredCategoryNames.map((catName) => {
                                const count = matrix[teamName]?.[catName] || 0;
                                const displayValue = count > 0 ? count : '';
                                const borderClass = 'border-r border-gray-200';
                                
                                return React.createElement(
                                    'td',
                                    { 
                                        key: catName,
                                        className: `px-4 py-3 text-center font-semibold ${borderClass}`,
                                        style: COLUMN_WIDTHS.category
                                    },
                                    displayValue
                                );
                            }),
                            // Celkový súčet - BEZ PODFARBOVANIA
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
                                className: 'px-4 py-3 text-left text-gray-700 sticky left-0 bg-gray-200 z-10 border-r border-gray-300',
                                style: COLUMN_WIDTHS.teamName
                            },
                            'Celkom tímov'
                        ),
                        filteredCategoryNames.map((catName) => {
                            let totalInCategory = 0;
                            sortedTeamNames.forEach(teamName => {
                                totalInCategory += (matrix[teamName]?.[catName] || 0);
                            });
                            const borderClass = 'border-r border-gray-300';
                            
                            return React.createElement(
                                'td',
                                { 
                                    key: catName,
                                    className: `px-4 py-3 text-center text-gray-700 ${borderClass}`,
                                    style: COLUMN_WIDTHS.category
                                },
                                totalInCategory
                            );
                        }),
                        React.createElement(
                            'td',
                            { 
                                className: 'px-4 py-3 text-center text-gray-700 bg-gray-300',
                                style: COLUMN_WIDTHS.total
                            },
                            sortedTeamNames.reduce((sum, name) => sum + getTotalForTeam(name), 0)
                        )
                    )
                )
            )
        );
    };

    // ===================================================================
    // FILTRE - IBA VYHĽADÁVANIE (BEZ SELECTBOXU)
    // ===================================================================
    const renderFilters = () => {
        return React.createElement(
            'div',
            { className: 'flex flex-wrap gap-4 mb-6 items-end' },
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
        
        // Fixná hlavička (zobrazí sa pri skrolovaní)
        renderFixedHeader(),
        
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
                'Kliknite na názov kategórie v hlavičke pre filtrovanie'
            )
        ),
        
        // Filtre
        renderFilters(),
        
        // Tabuľka
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-xl p-4' },
            renderOverviewTable()
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
