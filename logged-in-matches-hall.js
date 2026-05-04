// logged-in-matches-hall.js
import { collection, getDocs, doc, getDoc, query, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const { useState, useEffect } = React;

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

// Funkcia na načítanie členov tímu z databázy podľa názvu tímu a kategórie
const loadTeamMembers = async (teamName, categoryIdOrName) => {
    if (!window.db || !teamName || !categoryIdOrName) {
        console.log("Chýba db, teamName alebo categoryIdOrName");
        return [];
    }
    
    try {
        console.log(`Hľadám tím: ${teamName} v kategórii: ${categoryIdOrName}`);
        
        // Prehľadávame všetkých používateľov (kluby)
        const usersRef = collection(window.db, 'users');
        const usersSnapshot = await getDocs(usersRef);
        
        for (const userDoc of usersSnapshot.docs) {
            const userData = userDoc.data();
            const teams = userData.teams || {};
            
            // Prehľadávame všetky kategórie tohto používateľa
            for (const [category, teamsArray] of Object.entries(teams)) {
                // Porovnanie kategórie - podľa ID alebo názvu
                let categoryMatches = false;
                
                // Ak categoryIdOrName je číselný string alebo ID, porovnávame s kľúčom kategórie
                if (category === categoryIdOrName) {
                    categoryMatches = true;
                }
                // Inak skúsime porovnať s názvom kategórie (ak máme kategóriu načítanú)
                else if (window.categoriesData && window.categoriesData[categoryIdOrName]) {
                    // categoryIdOrName je ID, porovnávame s kľúčom
                    if (category === categoryIdOrName) {
                        categoryMatches = true;
                    }
                }
                // Ak je categoryIdOrName názov kategórie, hľadáme podľa názvu v settings/categories
                else if (window.categoriesData) {
                    for (const [catId, catData] of Object.entries(window.categoriesData)) {
                        if (catData.name === categoryIdOrName && category === catId) {
                            categoryMatches = true;
                            break;
                        }
                    }
                }
                
                if (!categoryMatches) continue;
                
                // Hľadáme tím s daným názvom
                const foundTeam = (teamsArray || []).find(t => t.teamName === teamName);
                
                if (foundTeam) {
                    console.log(`Našiel som tím: ${teamName} v kategórii ${category}`);
                    
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
                    
                    return members;
                }
            }
        }
        
        console.log(`Nenašiel som tím: ${teamName} v kategórii: ${categoryIdOrName}`);
        return [];
        
    } catch (err) {
        console.error('Chyba pri načítaní členov tímu:', err);
        return [];
    }
};

// Komponent pre zoznam členov tímu
const TeamMembersList = ({ teamName, categoryId, categoryName }) => {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    useEffect(() => {
        const fetchMembers = async () => {
            setLoading(true);
            setError(null);
            
            // Použijeme categoryId ak existuje, inak categoryName
            const categoryIdentifier = categoryId || categoryName;
            
            if (!teamName || !categoryIdentifier) {
                setLoading(false);
                return;
            }
            
            const result = await loadTeamMembers(teamName, categoryIdentifier);
            setMembers(result);
            setLoading(false);
        };
        
        fetchMembers();
    }, [teamName, categoryId, categoryName]);
    
    if (loading) {
        return React.createElement(
            'div',
            { className: 'text-center py-4' },
            React.createElement('div', { className: 'animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400 mx-auto' }),
            React.createElement('p', { className: 'text-xs text-gray-400 mt-2' }, 'Načítavam členov...')
        );
    }
    
    if (error) {
        return React.createElement(
            'div',
            { className: 'text-center py-4 text-red-500 text-sm' },
            'Nepodarilo sa načítať členov tímu'
        );
    }
    
    if (members.length === 0) {
        return React.createElement(
            'div',
            { className: 'text-center py-4 text-gray-400 text-sm' },
            'Žiadni členovia tímu'
        );
    }
    
    return React.createElement(
        'div',
        { className: 'mt-2' },
        React.createElement(
            'div',
            { className: 'space-y-1 max-h-64 overflow-y-auto' },
            members.map((member, idx) => {
                const fullName = `${member.firstName} ${member.lastName}`.trim() || 'Neznámy';
                const jerseyDisplay = member.jerseyNumber ? ` (#${member.jerseyNumber})` : '';
                const regDisplay = member.registrationNumber ? ` (reg: ${member.registrationNumber})` : '';
                
                return React.createElement(
                    'div',
                    { key: idx, className: 'text-sm text-gray-600 py-1 border-b border-gray-100 last:border-0' },
                    React.createElement('span', { className: 'font-medium' }, member.type),
                    ': ',
                    React.createElement('span', null, fullName),
                    jerseyDisplay,
                    regDisplay
                );
            })
        )
    );
};

// Komponent pre detail zápasu
const MatchDetailView = ({ match, teamNames, onBack, hallInfo, categoryDrawColors, groupsData }) => {
    const dateTime = formatMatchDateTime(match.scheduledTime);
    const isResultAvailable = match.homeScore !== undefined && match.awayScore !== undefined;
    const homeTeamDisplay = teamNames[match.homeTeamIdentifier] || getDisplayTeamName(match.homeTeamIdentifier);
    const awayTeamDisplay = teamNames[match.awayTeamIdentifier] || getDisplayTeamName(match.awayTeamIdentifier);
    const categoryColor = getCategoryDrawColor(match.categoryId);
    const lighterCategoryColor = getLighterColor(categoryColor);
    const matchColors = getMatchColors(match, groupsData);
    
    // Získanie informácií o skupine
    let groupInfo = null;
    if (match.groupName && !match.isPlacementMatch) {
        groupInfo = getGroupTypeColors(match.groupName, match.categoryId, groupsData);
    }
    
    // Formátovanie dátumu pre detail
    const formattedDate = dateTime?.dateObj ? formatDateHeader(dateTime.dateObj) : 'Dátum neznámy';
    
    return React.createElement(
        'div',
        { className: 'max-w-4xl mx-auto px-4 py-6' },
        
        // Hlavička s tlačidlom späť
        React.createElement(
            'div',
            { className: 'mb-6' },
            React.createElement(
                'button',
                {
                    onClick: onBack,
                    className: 'flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors cursor-pointer'
                },
                React.createElement('i', { className: 'fa-solid fa-arrow-left' }),
                React.createElement('span', {}, 'Späť na zoznam zápasov')
            )
        ),
        
        // Nadpis s názvom haly
        React.createElement(
            'div',
            { className: 'text-center mb-8' },
            React.createElement('h1', { className: 'text-2xl font-bold text-gray-800' }, 'Detail zápasu'),
            React.createElement(
                'div',
                { className: 'flex items-center justify-center gap-2 mt-1' },
                React.createElement('i', { className: 'fa-solid fa-location-dot text-blue-500 text-sm' }),
                React.createElement('span', { className: 'text-gray-600' }, hallInfo?.name || 'Športová hala')
            )
        ),
        
        // Karta s detailom zápasu
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden' },
            
            // Hlavička zápasu - dátum, čas, typy
            React.createElement(
                'div',
                { className: 'bg-gray-50 px-6 py-4 border-b border-gray-200' },
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
                            React.createElement('span', { className: 'text-gray-700' }, formattedDate)
                        ),
                        React.createElement(
                            'div',
                            { className: 'flex items-center gap-2' },
                            React.createElement('i', { className: 'fa-regular fa-clock text-gray-400' }),
                            React.createElement('span', { className: 'font-mono text-gray-700' }, dateTime?.time || '--:--')
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'flex flex-wrap gap-2' },
                        match.matchType && !match.isPlacementMatch && React.createElement(
                            'span',
                            {
                                className: 'inline-block text-xs px-3 py-1 rounded-full',
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
                                className: 'inline-block text-xs px-3 py-1 rounded-full',
                                style: {
                                    backgroundColor: ELIMINATION_COLORS.backgroundColor,
                                    color: ELIMINATION_COLORS.textColor,
                                    fontWeight: '500'
                                }
                            },
                            `o ${match.placementRank}. miesto`
                        ),
                        match.groupName && !match.isPlacementMatch && React.createElement(
                            'span',
                            {
                                className: 'inline-block text-xs px-3 py-1 rounded-full',
                                style: {
                                    backgroundColor: groupInfo?.backgroundColor || matchColors.backgroundColor,
                                    color: groupInfo?.textColor || matchColors.textColor,
                                    fontWeight: '500'
                                }
                            },
                            match.groupName
                        ),
                        match.categoryName && React.createElement(
                            'span',
                            {
                                className: 'inline-block text-xs px-3 py-1 rounded-full',
                                style: {
                                    backgroundColor: lighterCategoryColor,
                                    color: categoryColor,
                                    fontWeight: '500'
                                }
                            },
                            match.categoryName
                        )
                    )
                )
            ),
            
            // Výsledok zápasu
            React.createElement(
                'div',
                { className: 'px-6 py-8 bg-gradient-to-r from-gray-50 to-white' },
                React.createElement(
                    'div',
                    { className: 'grid grid-cols-3 gap-4 items-center' },
                    // Domáci tím
                    React.createElement(
                        'div',
                        { className: 'text-center' },
                        React.createElement('div', { className: 'text-sm text-gray-500 mb-2' }, 'DOMÁCI'),
                        React.createElement('div', { className: 'text-xl font-bold text-gray-800' }, homeTeamDisplay)
                    ),
                    // Skóre
                    React.createElement(
                        'div',
                        { className: 'text-center' },
                        isResultAvailable ?
                            React.createElement(
                                'div',
                                { className: 'flex items-center justify-center gap-4' },
                                React.createElement('span', { className: 'text-4xl font-bold text-gray-800' }, match.homeScore),
                                React.createElement('span', { className: 'text-2xl text-gray-400' }, ':'),
                                React.createElement('span', { className: 'text-4xl font-bold text-gray-800' }, match.awayScore)
                            ) :
                            React.createElement(
                                'div',
                                { className: 'text-center' },
                                React.createElement('span', { className: 'text-xl text-gray-400 font-medium' }, 'VS'),
                                React.createElement('div', { className: 'text-xs text-gray-400 mt-1' }, 'Zápas ešte nebol odohraný')
                            )
                    ),
                    // Hosťujúci tím
                    React.createElement(
                        'div',
                        { className: 'text-center' },
                        React.createElement('div', { className: 'text-sm text-gray-500 mb-2' }, 'HOSTIA'),
                        React.createElement('div', { className: 'text-xl font-bold text-gray-800' }, awayTeamDisplay)
                    )
                )
            ),
            
            // Detailné informácie s členmi tímov
            React.createElement(
                'div',
                { className: 'border-t border-gray-200' },
                React.createElement(
                    'div',
                    { className: 'divide-y divide-gray-100' },
                    
                    // Riadok - Typ zápasu
                    match.matchType && React.createElement(
                        'div',
                        { className: 'flex py-4 px-6' },
                        React.createElement('div', { className: 'w-32 text-sm text-gray-500' }, 'Typ zápasu'),
                        React.createElement('div', { className: 'flex-1 text-sm text-gray-800' }, match.matchType)
                    ),
                    
                    // Riadok - Umiestnenie pre placement match
                    match.isPlacementMatch && match.placementRank && React.createElement(
                        'div',
                        { className: 'flex py-4 px-6' },
                        React.createElement('div', { className: 'w-32 text-sm text-gray-500' }, 'O umiestnenie'),
                        React.createElement('div', { className: 'flex-1 text-sm text-gray-800' }, `${match.placementRank}. miesto`)
                    ),
                    
                    // Riadok - Zoznam členov domáceho tímu
                    React.createElement(
                        'div',
                        { className: 'flex py-4 px-6' },
                        React.createElement('div', { className: 'w-32 text-sm text-gray-500' }, 'Domáci tím'),
                        React.createElement(
                            'div',
                            { className: 'flex-1' },
                            React.createElement(
                                'details',
                                { className: 'group' },
                                React.createElement(
                                    'summary',
                                    { className: 'text-sm text-blue-600 cursor-pointer hover:text-blue-800' },
                                    React.createElement('span', { className: 'font-medium' }, homeTeamDisplay),
                                    ' (',
                                    React.createElement('span', { className: 'text-gray-500' }, 'klikni pre zobrazenie členov'),
                                    ')'
                                ),
                                React.createElement(
                                    'div',
                                    { className: 'mt-2 pl-2 border-l-2 border-blue-200' },
                                    React.createElement(TeamMembersList, {
                                        teamName: homeTeamDisplay,
                                        categoryId: match.categoryId,
                                        categoryName: match.categoryName
                                    })
                                )
                            )
                        )
                    ),
                    
                    // Riadok - Zoznam členov hosťujúceho tímu
                    React.createElement(
                        'div',
                        { className: 'flex py-4 px-6' },
                        React.createElement('div', { className: 'w-32 text-sm text-gray-500' }, 'Hosťujúci tím'),
                        React.createElement(
                            'div',
                            { className: 'flex-1' },
                            React.createElement(
                                'details',
                                { className: 'group' },
                                React.createElement(
                                    'summary',
                                    { className: 'text-sm text-blue-600 cursor-pointer hover:text-blue-800' },
                                    React.createElement('span', { className: 'font-medium' }, awayTeamDisplay),
                                    ' (',
                                    React.createElement('span', { className: 'text-gray-500' }, 'klikni pre zobrazenie členov'),
                                    ')'
                                ),
                                React.createElement(
                                    'div',
                                    { className: 'mt-2 pl-2 border-l-2 border-blue-200' },
                                    React.createElement(TeamMembersList, {
                                        teamName: awayTeamDisplay,
                                        categoryId: match.categoryId,
                                        categoryName: match.categoryName
                                    })
                                )
                            )
                        )
                    )
                )
            )
        )
    );
};

// Hlavný komponent
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
    
    // Nové stavy pre detail zápasu
    const [selectedMatch, setSelectedMatch] = useState(null);
    const [showingDetail, setShowingDetail] = useState(false);

    // Načítanie farieb kategórií z databázy
    const loadCategoryColors = async () => {
        if (!window.db) return;
        
        try {
            const settingsRef = doc(window.db, 'settings', 'categories');
            const settingsSnap = await getDoc(settingsRef);
            
            if (settingsSnap.exists()) {
                const data = settingsSnap.data();
                const colors = {};
                const categories = {};
                
                Object.entries(data).forEach(([catId, catData]) => {
                    if (catData.drawColor) {
                        colors[catId] = catData.drawColor;
                    }
                    if (catData.name) {
                        categories[catId] = catData.name;
                    }
                });
                
                setCategoryDrawColors(colors);
                setCategoriesData(categories);
                window.categoryDrawColors = colors;
                window.categoriesData = categories;
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

    // Spracovanie názvov tímov pre všetky zápasy
    const processTeamNames = (matches) => {
        const names = { ...teamNames };
        
        matches.forEach(match => {
            if (match.homeTeamIdentifier) {
                const homeKey = match.homeTeamIdentifier;
                if (!names[homeKey]) {
                    names[homeKey] = getDisplayTeamName(homeKey);
                }
            }
            if (match.awayTeamIdentifier) {
                const awayKey = match.awayTeamIdentifier;
                if (!names[awayKey]) {
                    names[awayKey] = getDisplayTeamName(awayKey);
                }
            }
        });
        
        setTeamNames(names);
    };

    // Načítanie zápasov
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
            
            querySnapshot.forEach((doc) => {
                const match = {
                    id: doc.id,
                    ...doc.data()
                };
                
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
            processTeamNames(hallMatches);
            
        } catch (err) {
            console.error('Chyba pri načítaní zápasov:', err);
            setError('Nepodarilo sa načítať zápasy: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // Handler pre kliknutie na Detail
    const handleDetailClick = (match) => {
        setSelectedMatch(match);
        setShowingDetail(true);
        window.scrollTo(0, 0);
    };

    // Handler pre návrat z detailu
    const handleBackToList = () => {
        setSelectedMatch(null);
        setShowingDetail(false);
    };

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
            groupsData: groupsData
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
                            
                            dayMatches.forEach((match, matchIndex) => {
                                const dateTime = formatMatchDateTime(match.scheduledTime);
                                const isResultAvailable = match.homeScore !== undefined && match.awayScore !== undefined;
                                
                                const homeTeamDisplay = teamNames[match.homeTeamIdentifier] || getDisplayTeamName(match.homeTeamIdentifier);
                                const awayTeamDisplay = teamNames[match.awayTeamIdentifier] || getDisplayTeamName(match.awayTeamIdentifier);
                                
                                const categoryColor = getCategoryDrawColor(match.categoryId);
                                const lighterCategoryColor = getLighterColor(categoryColor);
                                
                                const matchColors = getMatchColors(match, groupsData);
                                
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
                                
                                // Tag pre kategóriu
                                if (match.categoryName) {
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
                                        match.categoryName
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
                                            isResultAvailable ?
                                                React.createElement(
                                                    'div',
                                                    { className: 'flex items-center justify-center gap-1' },
                                                    React.createElement('span', { className: 'font-bold text-gray-800' }, match.homeScore),
                                                    React.createElement('span', { className: 'text-gray-400' }, ':'),
                                                    React.createElement('span', { className: 'font-bold text-gray-800' }, match.awayScore)
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
                                            React.createElement(
                                                'button',
                                                {
                                                    onClick: () => handleDetailClick(match),
                                                    className: 'bg-gray-200 hover:bg-gray-300 text-gray-900 text-xs px-3 py-1 rounded-full transition-colors cursor-pointer',
                                                    style: {
                                                        fontWeight: '500'
                                                    }
                                                },
                                                'Detail'
                                            )
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
