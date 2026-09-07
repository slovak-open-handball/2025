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

const slovakCollator = new Intl.Collator('sk', { 
    sensitivity: 'base',
    ignorePunctuation: true,
    numeric: false
});

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

const TeamsOverviewApp = (props) => {
    const [allTeams, setAllTeams] = useState([]);
    const [categoryIdToNameMap, setCategoryIdToNameMap] = useState({});
    const [uiNotification, setUiNotification] = useState(null);
    const currentUserEmail = window.globalUserProfileData?.email || null;
    
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [selectedTeamNameFilter, setSelectedTeamNameFilter] = useState('');
    const [selectedTeamDetails, setSelectedTeamDetails] = useState(null);
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    const tableContainerRef = useRef(null);

    const [maxTableHeight, setMaxTableHeight] = useState('60vh');

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
    
        return () => {
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
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
    }, [allTeams, selectedCategoryId, selectedTeamNameFilter]);

    const COLUMN_WIDTHS = {
        teamName: { minWidth: '180px', maxWidth: '250px', width: '180px' },
        category: { minWidth: '80px', width: '80px' },
        total: { minWidth: '80px', width: '80px' }
    };

    const TOP_OFFSET = '0px'; 

    // Funkcia na aktualizáciu URL hashu
    const updateUrlHash = (teamName, categoryName = null) => {
        let hashParts = [];
        if (teamName) {
            hashParts.push(`team=${encodeURIComponent(teamName)}`);
        }
        if (categoryName) {
            hashParts.push(`category=${encodeURIComponent(categoryName)}`);
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
                    result.teamName = decodeURIComponent(value);
                } else if (key === 'category') {
                    result.categoryName = decodeURIComponent(value);
                }
            });
            
            return result;
        }
        return { teamName: null, categoryName: null };
    };

    // Načítanie tímu z URL pri prvom načítaní
    useEffect(() => {
        if (allTeams.length > 0 && categoryIdToNameMap && Object.keys(categoryIdToNameMap).length > 0 && isInitialLoad) {
            const { teamName: teamNameFromUrl, categoryName: categoryNameFromUrl } = parseUrlHash();
            
            // Ak je v URL kategória, nastavíme filter
            if (categoryNameFromUrl) {
                const categoryId = Object.keys(categoryIdToNameMap).find(id => categoryIdToNameMap[id] === categoryNameFromUrl);
                if (categoryId) {
                    setSelectedCategoryId(categoryId);
                }
            }
            
            if (teamNameFromUrl) {
                // Nájdi tím podľa názvu
                const teamOccurrences = allTeams
                    .filter(team => {
                        let cleanName = removeSuffix(team.teamName);
                        if (team.category && cleanName.startsWith(team.category + ' ')) {
                            cleanName = cleanName.substring(team.category.length + 1).trim();
                        }
                        return cleanName === teamNameFromUrl;
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
                        occurrences: teamOccurrences
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

    // Počúvanie na zmeny v URL hash (pre prípad, že používateľ klikne na späť/ďalej)
    useEffect(() => {
        const handleHashChange = () => {
            if (!isInitialLoad) {
                const { teamName: teamNameFromUrl, categoryName: categoryNameFromUrl } = parseUrlHash();
                
                // Aktualizácia filtra kategórie
                if (categoryNameFromUrl) {
                    const categoryId = Object.keys(categoryIdToNameMap).find(id => categoryIdToNameMap[id] === categoryNameFromUrl);
                    if (categoryId) {
                        setSelectedCategoryId(categoryId);
                    }
                } else {
                    setSelectedCategoryId('');
                }
                
                // Aktualizácia detailu tímu
                if (teamNameFromUrl) {
                    const teamOccurrences = allTeams
                        .filter(team => {
                            let cleanName = removeSuffix(team.teamName);
                            if (team.category && cleanName.startsWith(team.category + ' ')) {
                                cleanName = cleanName.substring(team.category.length + 1).trim();
                            }
                            return cleanName === teamNameFromUrl;
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
                            occurrences: teamOccurrences
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
    }, [allTeams, categoryIdToNameMap, isInitialLoad]);

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
                    updateUrlHash(selectedTeamDetails.teamName, null);
                } else {
                    updateUrlHash(null);
                }
            } else {
                setSelectedCategoryId(categoryId);
                // Aktualizujeme URL - pridáme kategóriu
                if (selectedTeamDetails) {
                    updateUrlHash(selectedTeamDetails.teamName, categoryName);
                } else {
                    updateUrlHash(null, categoryName);
                }
            }
        }
    };

    const handleTeamNameClick = (teamName) => {
        const teamOccurrences = allTeams
            .filter(team => {
                let cleanName = removeSuffix(team.teamName);
                if (team.category && cleanName.startsWith(team.category + ' ')) {
                    cleanName = cleanName.substring(team.category.length + 1).trim();
                }
                return cleanName === teamName;
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
                teamName: teamName,
                occurrences: teamOccurrences
            });
            // Zachováme aktuálnu kategóriu ak je nastavená
            const categoryName = selectedCategoryId ? categoryIdToNameMap[selectedCategoryId] : null;
            updateUrlHash(teamName, categoryName);
        }
    };

    const closeTeamDetails = () => {
        setSelectedTeamDetails(null);
        // Zachováme kategóriu ak je nastavená
        const categoryName = selectedCategoryId ? categoryIdToNameMap[selectedCategoryId] : null;
        updateUrlHash(null, categoryName);
    };

    const handleTeamOccurrenceClick = (occ) => {
        // Nastavíme filter na kategóriu
        const categoryId = Object.keys(categoryIdToNameMap).find(id => categoryIdToNameMap[id] === occ.category);
        if (categoryId) {
            setSelectedCategoryId(categoryId);
        }
        
        // Zavrieme detail tímu
        setSelectedTeamDetails(null);
        
        // Aktualizujeme URL s kategóriou aj tímom
        updateUrlHash(occ.teamName, occ.category);
        
        notify(`Vybratý: ${occ.teamName} (${occ.category})`, 'info');
    };

    const renderTeamDetails = () => {
        if (!selectedTeamDetails) return null;

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
                    'Výskyty tímu v kategóriách:'
                ),
                React.createElement(
                    'div',
                    { className: 'flex flex-wrap gap-3 mt-2' },
                    selectedTeamDetails.occurrences.map((occ, index) => {
                        const buttonLabel = `${occ.category} | ${occ.teamName}`;
                        return React.createElement(
                            'button',
                            {
                                key: index,
                                className: 'px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium',
                                onClick: () => handleTeamOccurrenceClick(occ)
                            },
                            buttonLabel
                        );
                    })
                ),
                React.createElement(
                    'div',
                    { className: 'mt-6 pt-4 border-t border-gray-200 text-sm text-gray-500' },
                    `Celkový počet výskytov: ${selectedTeamDetails.occurrences.length}`
                )
            )
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
                        updateUrlHash(null);
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
                selectedTeamDetails ? 'Kliknutím na tlačidlo vyberiete konkrétny výskyt tímu' : 'Kliknite na názov tímu pre zobrazenie detailov'
            )
        ),
        renderMainContent()
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
