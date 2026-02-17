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

    // Funkcia na identifikáciu typu zápasu v pavúkovom systéme
    const identifyMatchType = (match, allMatches) => {
        // Predpokladáme, že semifinále sú zápasy, ktoré:
        // 1. Sú v rovnakej kategórii/skupine
        // 2. Ich víťazi postupujú do finále
        // 3. Porazení idú do zápasu o 3. miesto
        
        // Hľadáme finálový zápas (najvyššie kolo)
        const finalMatch = allMatches.find(m => 
            m.categoryId === match.categoryId &&
            m.groupName === match.groupName &&
            (m.matchType === 'final' || 
             (m.homeTeamIdentifier?.includes('winner') || m.awayTeamIdentifier?.includes('winner')))
        );
        
        // Hľadáme zápas o 3. miesto
        const thirdPlaceMatch = allMatches.find(m => 
            m.categoryId === match.categoryId &&
            m.groupName === match.groupName &&
            (m.matchType === 'third_place' ||
             (m.homeTeamIdentifier?.includes('loser') || m.awayTeamIdentifier?.includes('loser')))
        );
        
        // Ak je to finálový zápas
        if (finalMatch && (finalMatch.id === match.id || 
            match.homeTeamIdentifier?.includes('winner') || 
            match.awayTeamIdentifier?.includes('winner'))) {
            return 'final';
        }
        
        // Ak je to zápas o 3. miesto
        if (thirdPlaceMatch && (thirdPlaceMatch.id === match.id ||
            match.homeTeamIdentifier?.includes('loser') || 
            match.awayTeamIdentifier?.includes('loser'))) {
            return 'third_place';
        }
        
        // Inak je to semifinále
        return 'semi_final';
    };

    // Funkcia na vytvorenie štruktúry pavúka
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
            
            // Roztriedime zápasy podľa typu
            const semiFinals = [];
            const final = null;
            const thirdPlace = null;
            
            filteredMatches.forEach(match => {
                const matchType = identifyMatchType(match, filteredMatches);
                
                // Zápasy, ktoré nie sú finále ani o 3. miesto, považujeme za semifinále
                if (matchType === 'semi_final') {
                    semiFinals.push(match);
                } else if (matchType === 'final') {
                    final = match;
                } else if (matchType === 'third_place') {
                    thirdPlace = match;
                }
            });
            
            // Ak nemáme identifikované finále podľa špeciálnych indikátorov,
            // skúsime ho identifikovať podľa logiky
            if (!final && filteredMatches.length >= 3) {
                // Finále je pravdepodobne posledný zápas v poradí
                const sortedByDate = [...filteredMatches].sort((a, b) => {
                    const dateA = a.date ? new Date(a.date) : new Date(0);
                    const dateB = b.date ? new Date(b.date) : new Date(0);
                    return dateB - dateA;
                });
                
                // Posledný zápas je finále
                if (sortedByDate.length > 0) {
                    final = sortedByDate[0];
                }
            }
            
            setSpiderData({
                semiFinals: semiFinals,
                final: final,
                thirdPlace: thirdPlace,
                allMatches: filteredMatches
            });
            
        } catch (error) {
            console.error('Chyba pri vytváraní pavúkovej tabuľky:', error);
            window.showGlobalNotification('Chyba pri vytváraní pavúkovej tabuľky', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Komponent pre zobrazenie jedného zápasu v pavúkovom zobrazení
    const MatchCard = ({ match, title, isFinal = false, isThirdPlace = false }) => {
        if (!match) return null;
        
        const homeTeam = getTeamDisplayText(match.homeTeamIdentifier);
        const awayTeam = getTeamDisplayText(match.awayTeamIdentifier);
        
        const homeTeamName = typeof homeTeam === 'object' ? homeTeam.name : homeTeam;
        const awayTeamName = typeof awayTeam === 'object' ? awayTeam.name : awayTeam;
        
        const homeTeamId = typeof homeTeam === 'object' ? homeTeam.id : match.homeTeamIdentifier;
        const awayTeamId = typeof awayTeam === 'object' ? awayTeam.id : match.awayTeamIdentifier;
        
        const matchDate = match.date ? new Date(match.date) : null;
        const formattedDate = matchDate ? formatDateWithDay(matchDate) : 'Dátum neurčený';
        
        // Zistenie výsledku
        const hasResult = match.homeScore !== undefined && match.awayScore !== undefined;
        const winner = hasResult && match.homeScore > match.awayScore ? 'home' :
                      hasResult && match.awayScore > match.homeScore ? 'away' : null;
        
        return React.createElement(
            'div',
            { 
                className: `bg-white rounded-lg shadow-md p-4 border-2 ${
                    isFinal ? 'border-yellow-400' : 
                    isThirdPlace ? 'border-bronze-400' : 
                    'border-blue-300'
                } hover:shadow-lg transition-shadow`
            },
            React.createElement(
                'div',
                { className: 'text-sm font-semibold mb-2 text-center pb-1 border-b' },
                title
            ),
            React.createElement(
                'div',
                { className: 'flex flex-col gap-2' },
                // Domáci tím
                React.createElement(
                    'div',
                    { 
                        className: `flex justify-between items-center p-2 rounded ${
                            winner === 'home' ? 'bg-green-100 font-bold' : ''
                        }`
                    },
                    React.createElement(
                        'div',
                        { className: 'flex-1' },
                        displayMode === 'both' 
                            ? React.createElement(
                                'div',
                                { className: 'flex flex-col' },
                                React.createElement('span', null, homeTeamName),
                                React.createElement('span', { className: 'text-xs text-gray-500 font-mono' }, extractPureId(homeTeamId))
                            )
                            : (displayMode === 'name' ? homeTeamName : extractPureId(homeTeamId))
                    ),
                    hasResult && React.createElement(
                        'span',
                        { className: 'font-mono font-bold' },
                        match.homeScore
                    )
                ),
                
                // Hosťovský tím
                React.createElement(
                    'div',
                    { 
                        className: `flex justify-between items-center p-2 rounded ${
                            winner === 'away' ? 'bg-green-100 font-bold' : ''
                        }`
                    },
                    React.createElement(
                        'div',
                        { className: 'flex-1' },
                        displayMode === 'both' 
                            ? React.createElement(
                                'div',
                                { className: 'flex flex-col' },
                                React.createElement('span', null, awayTeamName),
                                React.createElement('span', { className: 'text-xs text-gray-500 font-mono' }, extractPureId(awayTeamId))
                            )
                            : (displayMode === 'name' ? awayTeamName : extractPureId(awayTeamId))
                    ),
                    hasResult && React.createElement(
                        'span',
                        { className: 'font-mono font-bold' },
                        match.awayScore
                    )
                ),
                
                // Dátum
                React.createElement(
                    'div',
                    { className: 'text-xs text-gray-500 mt-2 text-center' },
                    React.createElement('i', { className: 'fa-regular fa-calendar mr-1' }),
                    formattedDate
                )
            )
        );
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
                                onClick: () => {
                                    // Nastavíme view=spider do URL a znovu načítame stránku
                                    const url = new URL(window.location.href);
                                    url.searchParams.set('view', 'matches');
                                    window.location.href = url.toString();
                                },
                                className: 'px-4 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors whitespace-nowrap ml-2',
                                title: 'Prejsť do zobrazenia zápasov'
                            },
                            'Zápasy'
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
                { className: 'bg-white p-8', style: { width: '100%', maxWidth: '1200px' } },
                
                !spiderData ? (
                    React.createElement(
                        'div',
                        { className: 'text-center py-16 text-gray-500' },
                        React.createElement('i', { className: 'fa-solid fa-sitemap text-6xl mb-4 opacity-30' }),
                        React.createElement('h2', { className: 'text-2xl font-semibold mb-2' }, 'Pavúk play-off'),
                        React.createElement('p', { className: 'text-lg' }, 'Vyberte kategóriu a kliknite na "Generovať pavúka"')
                    )
                ) : (
                    React.createElement(
                        'div',
                        { className: 'flex flex-col gap-8' },
                        
                        // Semifinále
                        spiderData.semiFinals.length > 0 && React.createElement(
                            'div',
                            null,
                            React.createElement(
                                'h3',
                                { className: 'text-xl font-semibold mb-4 text-blue-800 border-b-2 border-blue-200 pb-2' },
                                'Semifinále'
                            ),
                            React.createElement(
                                'div',
                                { className: 'grid grid-cols-1 md:grid-cols-2 gap-6' },
                                spiderData.semiFinals.map((match, index) => 
                                    React.createElement(
                                        'div',
                                        { key: match.id || index },
                                        React.createElement(MatchCard, { 
                                            match: match, 
                                            title: `Semifinále ${index + 1}`,
                                            isFinal: false,
                                            isThirdPlace: false
                                        })
                                    )
                                )
                            )
                        ),
                        
                        // Finále a zápas o 3. miesto v jednom riadku
                        (spiderData.final || spiderData.thirdPlace) && React.createElement(
                            'div',
                            null,
                            React.createElement(
                                'h3',
                                { className: 'text-xl font-semibold mb-4 text-purple-800 border-b-2 border-purple-200 pb-2' },
                                'Finálové zápasy'
                            ),
                            React.createElement(
                                'div',
                                { className: 'grid grid-cols-1 md:grid-cols-2 gap-6' },
                                spiderData.final && React.createElement(
                                    MatchCard, 
                                    { 
                                        match: spiderData.final, 
                                        title: 'Finále',
                                        isFinal: true,
                                        isThirdPlace: false
                                    }
                                ),
                                spiderData.thirdPlace && React.createElement(
                                    MatchCard, 
                                    { 
                                        match: spiderData.thirdPlace, 
                                        title: 'O 3. miesto',
                                        isFinal: false,
                                        isThirdPlace: true
                                    }
                                )
                            )
                        ),
                        
                        // Ak nemáme žiadne zápasy v štruktúre pavúka
                        spiderData.semiFinals.length === 0 && !spiderData.final && !spiderData.thirdPlace && React.createElement(
                            'div',
                            { className: 'text-center py-8 text-gray-500 bg-gray-50 rounded-lg' },
                            React.createElement('i', { className: 'fa-solid fa-info-circle text-3xl mb-2 opacity-50' }),
                            React.createElement('p', null, 'Pre vybranú kategóriu/skupinu sa nenašli žiadne zápasy play-off.')
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
