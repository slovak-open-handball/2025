// logged-in-spider.js
import { doc, getDoc, getDocs, setDoc, onSnapshot, updateDoc, addDoc, deleteDoc, collection, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const { useState, useEffect } = React;

// Stav pre aktuálny režim zobrazenia (globálny)
window.currentViewMode = window.currentViewMode || 'matches';

// Funkcia na získanie názvu dňa v týždni v slovenčine
const getDayName = (date) => {
    const days = ['Nedeľa', 'Pondelok', 'Utorok', 'Streda', 'Štvrtok', 'Piatok', 'Sobota'];
    return days[date.getDay()];
};

// Funkcia na formátovanie dátumu s dňom v týždni
const formatDateWithDay = (date) => {
    const dayName = getDayName(date);
    const formattedDate = date.toLocaleDateString('sk-SK', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    return `${dayName} ${formattedDate}`;
};

const getLocalDateStr = (date) => {
    if (!date) return null;
    if (typeof date === 'string') return date;
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Komponent pre pavúkovú tabuľku
const SpiderApp = ({ userProfileData }) => {
    const [categories, setCategories] = useState([]);
    const [matches, setMatches] = useState([]);
    const [teams, setTeams] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedGroup, setSelectedGroup] = useState('');
    const [groupsByCategory, setGroupsByCategory] = useState({});
    const [availableGroups, setAvailableGroups] = useState([]);
    const [spiderData, setSpiderData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [displayMode, setDisplayMode] = useState('name');

    // Načítanie všetkých potrebných dát
    useEffect(() => {
        if (!window.db) {
            console.error("Firestore databáza nie je inicializovaná");
            setLoading(false);
            return;
        }

        console.log("SpiderApp: Načítavam dáta...");

        const loadCategorySettings = async () => {
            try {
                const catRef = doc(window.db, 'settings', 'categories');
                const catSnap = await getDoc(catRef);
                
                if (catSnap.exists()) {
                    const data = catSnap.data() || {};
                    const categoriesList = [];
                    
                    Object.entries(data).forEach(([id, obj]) => {
                        categoriesList.push({
                            id: id,
                            name: obj.name || `Kategória ${id}`,
                        });
                    });
                    
                    setCategories(categoriesList);
                }
            } catch (error) {
                console.error("Chyba pri načítaní kategórií:", error);
            }
        };

        const loadGroups = async () => {
            try {
                const groupsRef = doc(window.db, 'settings', 'groups');
                const groupsSnap = await getDoc(groupsRef);
                
                if (groupsSnap.exists()) {
                    setGroupsByCategory(groupsSnap.data());
                }
            } catch (error) {
                console.error("Chyba pri načítaní skupín:", error);
            }
        };

        const loadMatches = () => {
            const matchesRef = collection(window.db, 'matches');
            
            const unsubscribe = onSnapshot(matchesRef, (snapshot) => {
                const loadedMatches = [];
                snapshot.forEach((doc) => {
                    loadedMatches.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
                loadedMatches.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                setMatches(loadedMatches);
                setLoading(false);
            }, (error) => {
                console.error('Chyba pri načítaní zápasov:', error);
                setLoading(false);
            });

            return unsubscribe;
        };

        const loadTeams = () => {
            if (window.teamManager) {
                if (window.__teamManagerData) {
                    setTeams(window.__teamManagerData.allTeams || []);
                }
                
                const unsubscribe = window.teamManager.subscribe((data) => {
                    setTeams(data.allTeams || []);
                });
                
                return unsubscribe;
            } else if (window.__teamManagerData) {
                setTeams(window.__teamManagerData.allTeams || []);
            }
        };

        loadCategorySettings();
        loadGroups();
        loadMatches();
        const unsubscribeTeams = loadTeams();

        return () => {
            if (unsubscribeTeams) unsubscribeTeams();
        };
    }, []);

    // Aktualizácia dostupných skupín pri zmene kategórie
    useEffect(() => {
        if (selectedCategory && groupsByCategory[selectedCategory]) {
            const sortedGroups = [...groupsByCategory[selectedCategory]]
                .sort((a, b) => a.name.localeCompare(b.name));
            setAvailableGroups(sortedGroups);
        } else {
            setAvailableGroups([]);
        }
        setSelectedGroup('');
        setSpiderData(null);
    }, [selectedCategory, groupsByCategory]);

    // Funkcia na parsovanie identifikátora tímu
    const parseTeamIdentifier = (identifier) => {
        if (!identifier) return null;
        
        const parts = identifier.split(' ');
        if (parts.length < 2) return null;
        
        const groupAndOrder = parts.pop();
        const category = parts.join(' ');
        
        let groupName = '';
        let order = '';
        
        for (let i = 0; i < groupAndOrder.length; i++) {
            const char = groupAndOrder[i];
            if (char >= '0' && char <= '9') {
                order = groupAndOrder.substring(i);
                groupName = groupAndOrder.substring(0, i);
                break;
            }
        }
        
        if (!order) {
            order = '?';
            groupName = groupAndOrder;
        }
        
        return { category, groupName, order, fullIdentifier: identifier };
    };

    // Funkcia na získanie názvu tímu podľa identifikátora
    const getTeamNameByIdentifier = (identifier) => {
        if (!identifier) return 'Neznámy tím';
        
        const parsed = parseTeamIdentifier(identifier);
        if (!parsed) return identifier;
        
        const { category, groupName, order } = parsed;
        
        const groupNameWithPrefix = `skupina ${groupName}`;
        
        const team = teams.find(t => 
            t.category === category && 
            (t.groupName === groupNameWithPrefix || t.groupName === groupName) &&
            t.order?.toString() === order
        );
        
        if (team) {
            return team.teamName;
        }
        
        return `${category} ${groupName}${order}`;
    };

    // Funkcia na získanie zobrazovaného textu pre tím
    const getTeamDisplayText = (identifier) => {
        if (!identifier) return '---';
        
        const teamName = getTeamNameByIdentifier(identifier);
        
        switch (displayMode) {
            case 'name':
                return teamName;
            case 'id':
                return identifier;
            case 'both':
                return { name: teamName, id: identifier };
            default:
                return teamName;
        }
    };

    // Funkcia na extrahovanie čistého ID
    const extractPureId = (identifier) => {
        if (!identifier) return '';
        const parts = identifier.split(' ');
        if (parts.length >= 2) {
            return parts[parts.length - 1];
        }
        return identifier;
    };

    // Funkcia na vytvorenie pavúkovej tabuľky
    const generateSpider = () => {
        if (!selectedCategory) {
            window.showGlobalNotification('Vyberte kategóriu', 'error');
            return;
        }

        setLoading(true);
        
        try {
            let filteredMatches = matches.filter(m => m.categoryId === selectedCategory);
            
            if (selectedGroup) {
                filteredMatches = filteredMatches.filter(m => m.groupName === selectedGroup);
            }
            
            if (filteredMatches.length === 0) {
                window.showGlobalNotification('Žiadne zápasy pre vybranú kategóriu/skupinu', 'warning');
                setLoading(false);
                return;
            }
            
            const teamIdentifiers = new Set();
            filteredMatches.forEach(match => {
                teamIdentifiers.add(match.homeTeamIdentifier);
                teamIdentifiers.add(match.awayTeamIdentifier);
            });
            
            const teamsList = Array.from(teamIdentifiers).sort();
            
            const matrix = {};
            const teamNames = {};
            const teamPureIds = {};
            
            teamsList.forEach(teamId => {
                matrix[teamId] = {};
                teamsList.forEach(opponentId => {
                    if (teamId !== opponentId) {
                        matrix[teamId][opponentId] = null;
                    }
                });
                teamNames[teamId] = getTeamNameByIdentifier(teamId);
                teamPureIds[teamId] = extractPureId(teamId);
            });
            
            filteredMatches.forEach(match => {
                const home = match.homeTeamIdentifier;
                const away = match.awayTeamIdentifier;
                
                if (matrix[home] && matrix[home][away] !== undefined) {
                    matrix[home][away] = { exists: true };
                }
            });
            
            const statistics = {};
            teamsList.forEach(teamId => {
                statistics[teamId] = {
                    played: 0,
                    wins: 0,
                    draws: 0,
                    losses: 0,
                    goalsFor: 0,
                    goalsAgainst: 0,
                    points: 0
                };
            });
            
            filteredMatches.forEach(match => {
                const home = match.homeTeamIdentifier;
                const away = match.awayTeamIdentifier;
                
                if (statistics[home]) statistics[home].played++;
                if (statistics[away]) statistics[away].played++;
            });
            
            setSpiderData({
                teams: teamsList,
                matrix: matrix,
                statistics: statistics,
                teamNames: teamNames,
                teamPureIds: teamPureIds,
                matches: filteredMatches
            });
            
        } catch (error) {
            console.error('Chyba pri vytváraní pavúkovej tabuľky:', error);
            window.showGlobalNotification('Chyba pri vytváraní pavúkovej tabuľky', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDisplayModeChange = (mode) => {
        setDisplayMode(mode);
    };

    const sortedCategories = React.useMemo(() => {
        return [...categories].sort((a, b) => a.name.localeCompare(b.name));
    }, [categories]);

    const switchToMatches = () => {
        window.currentViewMode = 'matches';
        localStorage.setItem('preferredViewMode', 'matches');
        window.location.href = window.location.pathname + '?view=matches';
    };

    return React.createElement(
        React.Fragment,
        null,
        React.createElement(
            'div',
            { 
                className: 'fixed top-12 left-0 right-0 z-40 flex justify-center pt-2',
                style: { pointerEvents: 'none' }
            },
            React.createElement(
                'div',
                { 
                    className: 'group',
                    style: { pointerEvents: 'auto' }
                },
                React.createElement(
                    'div',
                    { 
                        className: 'flex flex-col gap-2 transition-opacity duration-300 ease-in-out opacity-100'
                    },
                    React.createElement(
                        'div',
                        { className: 'flex flex-wrap items-center justify-center gap-2 bg-white/95 backdrop-blur-sm p-3 rounded-xl shadow-lg border border-gray-200' },
                        
                        React.createElement(
                            'div',
                            { className: 'flex items-center gap-1' },
                            React.createElement('label', { className: 'text-sm font-medium text-gray-700 whitespace-nowrap' }, 'Kategória:'),
                            React.createElement(
                                'select',
                                {
                                    value: selectedCategory,
                                    onChange: (e) => setSelectedCategory(e.target.value),
                                    className: 'px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-black min-w-[180px]'
                                },
                                React.createElement('option', { value: '' }, '-- Vyberte kategóriu --'),
                                sortedCategories.map(cat => 
                                    React.createElement('option', { key: cat.id, value: cat.id }, cat.name)
                                )
                            )
                        ),
                        
                        React.createElement(
                            'div',
                            { className: 'flex items-center gap-1' },
                            React.createElement('label', { className: 'text-sm font-medium text-gray-700 whitespace-nowrap' }, 'Skupina:'),
                            React.createElement(
                                'select',
                                {
                                    value: selectedGroup,
                                    onChange: (e) => setSelectedGroup(e.target.value),
                                    disabled: !selectedCategory,
                                    className: `px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-black min-w-[140px] ${!selectedCategory ? 'bg-gray-100 cursor-not-allowed' : ''}`
                                },
                                React.createElement('option', { value: '' }, 'Všetky skupiny'),
                                availableGroups.map(group => 
                                    React.createElement('option', { key: group.name, value: group.name }, group.name)
                                )
                            )
                        ),
                        
                        React.createElement(
                            'button',
                            {
                                onClick: generateSpider,
                                disabled: !selectedCategory || loading,
                                className: `px-4 py-1.5 text-sm rounded-lg transition-colors whitespace-nowrap ${
                                    !selectedCategory || loading
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : 'bg-purple-600 hover:bg-purple-700 text-white'
                                }`
                            },
                            loading ? 'Načítavam...' : 'Generovať pavúka'
                        ),
                        
                        React.createElement('div', { className: 'w-px h-8 bg-gray-300 mx-1' }),
                        
                        React.createElement(
                            'div',
                            { className: 'flex items-center gap-1 bg-white/95 p-1 rounded-lg border border-gray-200' },
                            React.createElement(
                                'button',
                                { 
                                    className: `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                                        displayMode === 'name' 
                                            ? 'bg-blue-600 text-white shadow-sm' 
                                            : 'text-gray-600 hover:bg-gray-200'
                                    }`,
                                    onClick: () => handleDisplayModeChange('name')
                                },
                                'Názvy'
                            ),
                            React.createElement(
                                'button',
                                { 
                                    className: `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                                        displayMode === 'id' 
                                            ? 'bg-blue-600 text-white shadow-sm' 
                                            : 'text-gray-600 hover:bg-gray-200'
                                    }`,
                                    onClick: () => handleDisplayModeChange('id')
                                },
                                'ID'
                            ),
                            React.createElement(
                                'button',
                                { 
                                    className: `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                                        displayMode === 'both' 
                                            ? 'bg-blue-600 text-white shadow-sm' 
                                            : 'text-gray-600 hover:bg-gray-200'
                                    }`,
                                    onClick: () => handleDisplayModeChange('both')
                                },
                                'Oboje'
                            )
                        ),
                        
                        React.createElement(
                            'button',
                            {
                                onClick: switchToMatches,
                                className: 'px-4 py-1.5 text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors whitespace-nowrap ml-2'
                            },
                            React.createElement('i', { className: 'fa-solid fa-calendar-alt mr-1' }),
                            'Prejsť na zápasy'
                        )
                    )
                )
            )
        ),

        React.createElement(
            'div',
            { className: 'flex-grow flex justify-center items-start w-full pt-24' },
            React.createElement(
                'div',
                { className: 'bg-white p-8', style: { width: '100%', maxWidth: '100%' } },
                
                !spiderData ? (
                    React.createElement(
                        'div',
                        { className: 'text-center py-16 text-gray-500' },
                        React.createElement('i', { className: 'fa-solid fa-sitemap text-6xl mb-4 opacity-30' }),
                        React.createElement('h2', { className: 'text-2xl font-semibold mb-2' }, 'Pavúková tabuľka'),
                        React.createElement('p', { className: 'text-lg' }, 'Vyberte kategóriu a kliknite na "Generovať pavúka"')
                    )
                ) : (
                    React.createElement(
                        'div',
                        { className: 'overflow-x-auto' },
                        React.createElement(
                            'table',
                            { className: 'min-w-full border-collapse border border-gray-300 text-sm' },
                            React.createElement(
                                'thead',
                                null,
                                React.createElement(
                                    'tr',
                                    { className: 'bg-gray-100' },
                                    React.createElement(
                                        'th',
                                        { className: 'border border-gray-300 p-2 font-semibold text-left sticky left-0 bg-gray-100 z-10' },
                                        'Tím'
                                    ),
                                    spiderData.teams.map(teamId => {
                                        const display = getTeamDisplayText(teamId);
                                        const teamName = typeof display === 'object' ? display.name : display;
                                        const pureId = spiderData.teamPureIds[teamId];
                                        
                                        return React.createElement(
                                            'th',
                                            { 
                                                key: teamId,
                                                className: 'border border-gray-300 p-2 font-semibold text-center min-w-[100px]'
                                            },
                                            displayMode === 'both' 
                                                ? React.createElement(
                                                    'div',
                                                    { className: 'flex flex-col items-center' },
                                                    React.createElement('span', null, teamName),
                                                    React.createElement('span', { className: 'text-xs text-gray-500 font-mono' }, pureId)
                                                )
                                                : (displayMode === 'name' ? teamName : pureId)
                                        );
                                    }),
                                    React.createElement(
                                        'th',
                                        { className: 'border border-gray-300 p-2 font-semibold text-center min-w-[120px]' },
                                        'Štatistiky'
                                    )
                                )
                            ),
                            React.createElement(
                                'tbody',
                                null,
                                spiderData.teams.map((teamId, rowIndex) => {
                                    const display = getTeamDisplayText(teamId);
                                    const teamName = typeof display === 'object' ? display.name : display;
                                    const pureId = spiderData.teamPureIds[teamId];
                                    const stats = spiderData.statistics[teamId];
                                    
                                    return React.createElement(
                                        'tr',
                                        { 
                                            key: teamId,
                                            className: rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                                        },
                                        React.createElement(
                                            'td',
                                            { className: 'border border-gray-300 p-2 font-medium sticky left-0 z-10',
                                              style: { backgroundColor: rowIndex % 2 === 0 ? 'white' : '#f9fafb' } },
                                            displayMode === 'both'
                                                ? React.createElement(
                                                    'div',
                                                    { className: 'flex flex-col' },
                                                    React.createElement('span', null, teamName),
                                                    React.createElement('span', { className: 'text-xs text-gray-500 font-mono' }, pureId)
                                                )
                                                : (displayMode === 'name' ? teamName : pureId)
                                        ),
                                        
                                        spiderData.teams.map(opponentId => {
                                            if (teamId === opponentId) {
                                                return React.createElement(
                                                    'td',
                                                    { key: opponentId, className: 'border border-gray-300 p-2 bg-gray-200' }
                                                );
                                            }
                                            
                                            const match = spiderData.matrix[teamId]?.[opponentId];
                                            const hasMatch = match?.exists;
                                            
                                            return React.createElement(
                                                'td',
                                                { 
                                                    key: opponentId,
                                                    className: `border border-gray-300 p-2 text-center ${
                                                        hasMatch ? 'cursor-pointer hover:bg-blue-50' : 'text-gray-400'
                                                    }`
                                                },
                                                hasMatch ? '✓' : '—'
                                            );
                                        }),
                                        
                                        React.createElement(
                                            'td',
                                            { className: 'border border-gray-300 p-2 text-center' },
                                            React.createElement(
                                                'div',
                                                { className: 'flex flex-col items-center text-xs' },
                                                React.createElement('span', null, `Z: ${stats.played}`),
                                                React.createElement('span', null, `V: ${stats.wins} R: ${stats.draws} P: ${stats.losses}`),
                                                React.createElement('span', { className: 'font-bold mt-1' }, `${stats.points} bodov`)
                                            )
                                        )
                                    );
                                })
                            )
                        )
                    )
                )
            )
        )
    );
};

const handleDataUpdateAndRender = (event) => {
    const userProfileData = event.detail;
    const rootElement = document.getElementById('root');

    if (userProfileData) {
        if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
            const root = ReactDOM.createRoot(rootElement);
            root.render(React.createElement(SpiderApp, { userProfileData }));
        }
    } else {
        if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
            const root = ReactDOM.createRoot(rootElement);
            root.render(
                React.createElement(
                    'div',
                    { className: 'flex justify-center items-center h-full pt-16 w-full' },
                    React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
                )
            );
        }
    }
};

window.addEventListener('globalDataUpdated', handleDataUpdateAndRender);

if (window.globalUserProfileData) {
    handleDataUpdateAndRender({ detail: window.globalUserProfileData });
}
