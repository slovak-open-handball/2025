// Importy pre Firebase funkcie
import { doc, getDoc, onSnapshot, updateDoc, addDoc, collection, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const { useState, useEffect } = React;

const faCSS = document.createElement('link');
faCSS.rel = 'stylesheet';
faCSS.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css';document.head.appendChild(faCSS);

// Definície typov pre športové haly
const typeLabels = {
    sportova_hala: "Športová hala",
};

// Ikony pre typy miest
const typeIcons = {
    sportova_hala: { icon: 'fa-futbol', color: '#dc2626' },
};

/**
 * Globálna funkcia pre zobrazenie notifikácií
 */
window.showGlobalNotification = (message, type = 'success') => {
    let notificationElement = document.getElementById('global-notification');
    if (!notificationElement) {
        notificationElement = document.createElement('div');
        notificationElement.id = 'global-notification';
        notificationElement.className = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[99999] opacity-0 transition-opacity duration-300';
        document.body.appendChild(notificationElement);
    }

    const baseClasses = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[99999] transition-all duration-500 ease-in-out transform';
    let typeClasses = '';
    switch (type) {
        case 'success':
            typeClasses = 'bg-green-500 text-white';
            break;
        case 'error':
            typeClasses = 'bg-red-500 text-white';
            break;
        case 'info':
            typeClasses = 'bg-blue-500 text-white';
            break;
        default:
            typeClasses = 'bg-gray-700 text-white';
    }

    notificationElement.className = `${baseClasses} ${typeClasses} opacity-0 scale-95`;
    notificationElement.textContent = message;

    setTimeout(() => {
        notificationElement.className = `${baseClasses} ${typeClasses} opacity-100 scale-100`;
    }, 10);

    setTimeout(() => {
        notificationElement.className = `${baseClasses} ${typeClasses} opacity-0 scale-95`;
    }, 5000);
};

// Modálne okno pre výber typu generovania
const GenerationModal = ({ isOpen, onClose, onConfirm, categories, groupsByCategory }) => {
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedGroup, setSelectedGroup] = useState('');
    const [withRepetitions, setWithRepetitions] = useState(false);
    const [availableGroups, setAvailableGroups] = useState([]);
    const [selectedGroupType, setSelectedGroupType] = useState('');

    // Zoradenie kategórií podľa abecedy
    const sortedCategories = React.useMemo(() => {
        return [...categories].sort((a, b) => a.name.localeCompare(b.name));
    }, [categories]);

    // Aktualizácia dostupných skupín pri zmene kategórie
    useEffect(() => {
        if (selectedCategory && groupsByCategory[selectedCategory]) {
            // Zoradenie skupín podľa abecedy
            const sortedGroups = [...groupsByCategory[selectedCategory]].sort((a, b) => 
                a.name.localeCompare(b.name)
            );
            setAvailableGroups(sortedGroups);
            setSelectedGroup('');
            setSelectedGroupType('');
        } else {
            setAvailableGroups([]);
            setSelectedGroup('');
            setSelectedGroupType('');
        }
    }, [selectedCategory, groupsByCategory]);

    // Zistenie typu vybranej skupiny
    useEffect(() => {
        if (selectedGroup && availableGroups.length > 0) {
            const group = availableGroups.find(g => g.name === selectedGroup);
            if (group) {
                setSelectedGroupType(group.type === 'basic' ? 'Základná skupina' : 'Nadstavbová skupina');
            } else {
                setSelectedGroupType('');
            }
        } else {
            setSelectedGroupType('');
        }
    }, [selectedGroup, availableGroups]);

    if (!isOpen) return null;

    return React.createElement(
        'div',
        {
            className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
            onClick: (e) => {
                if (e.target === e.currentTarget) onClose();
            }
        },
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4' },
            
            // Hlavička
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mb-4' },
                React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, 'Generovať zápasy'),
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'text-gray-500 hover:text-gray-700'
                    },
                    React.createElement('i', { className: 'fa-solid fa-times text-xl' })
                )
            ),

            // Výber kategórie - zoradené podľa abecedy
            React.createElement(
                'div',
                { className: 'mb-4' },
                React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' },
                    'Kategória:'
                ),
                React.createElement(
                    'select',
                    {
                        value: selectedCategory,
                        onChange: (e) => setSelectedCategory(e.target.value),
                        className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black'
                    },
                    React.createElement('option', { value: '' }, '-- Vyberte kategóriu --'),
                    sortedCategories.map(cat => 
                        React.createElement('option', { key: cat.id, value: cat.id }, cat.name)
                    )
                )
            ),

            // Výber skupiny (ak je kategória vybraná) - skupiny sú už zoradené v availableGroups
            selectedCategory && React.createElement(
                'div',
                { className: 'mb-4' },
                React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' },
                    'Skupina:'
                ),
                React.createElement(
                    'select',
                    {
                        value: selectedGroup,
                        onChange: (e) => setSelectedGroup(e.target.value),
                        className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black'
                    },
                    React.createElement('option', { value: '' }, '-- Všetky skupiny --'),
                    availableGroups.map((group, index) => 
                        React.createElement('option', { key: index, value: group.name }, group.name)
                    )
                ),
                
                // Zobrazenie typu skupiny pod selectboxom
                selectedGroup && selectedGroupType && React.createElement(
                    'div',
                    { className: 'mt-2 text-sm' },
                    React.createElement(
                        'span',
                        { 
                            className: `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                selectedGroupType === 'Základná skupina' 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-purple-100 text-purple-800'
                            }` 
                        },
                        React.createElement('i', { 
                            className: `fa-solid ${
                                selectedGroupType === 'Základná skupina' 
                                    ? 'fa-layer-group' 
                                    : 'fa-chart-line'
                            } mr-1 text-xs` 
                        }),
                        selectedGroupType
                    )
                )
            ),

            // Checkbox pre kombinácie s opakovaním
            React.createElement(
                'div',
                { className: 'mb-6' },
                React.createElement(
                    'label',
                    { className: 'flex items-center gap-2 cursor-pointer' },
                    React.createElement('input', {
                        type: 'checkbox',
                        checked: withRepetitions,
                        onChange: (e) => setWithRepetitions(e.target.checked),
                        className: 'w-4 h-4 text-blue-600 rounded'
                    }),
                    React.createElement('span', { className: 'text-gray-700' }, 'Kombinácie s opakovaním (každý s každým doma/vonku)')
                ),
                !withRepetitions && React.createElement(
                    'p',
                    { className: 'text-xs text-gray-500 mt-1 ml-6' },
                    'Vygenerujú sa jedinečné dvojice, každý tím sa stretne s každým práve raz'
                )
            ),

            // Tlačidlá
            React.createElement(
                'div',
                { className: 'flex justify-end gap-3' },
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors'
                    },
                    'Zrušiť'
                ),
                React.createElement(
                    'button',
                    {
                        onClick: () => {
                            onConfirm({
                                categoryId: selectedCategory,
                                groupName: selectedGroup || null,
                                withRepetitions
                            });
                            onClose();
                        },
                        disabled: !selectedCategory,
                        className: `px-4 py-2 text-white rounded-lg transition-colors ${
                            selectedCategory 
                                ? 'bg-green-600 hover:bg-green-700 cursor-pointer' 
                                : 'bg-gray-400 cursor-not-allowed'
                        }`
                    },
                    'Generovať'
                )
            )
        )
    );
};

// Modálne okno pre potvrdenie opätovného generovania
const ConfirmRegenerateModal = ({ isOpen, onClose, onConfirm, categoryName, groupName }) => {
    if (!isOpen) return null;

    return React.createElement(
        'div',
        {
            className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]',
            onClick: (e) => {
                if (e.target === e.currentTarget) onClose();
            }
        },
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4' },
            
            // Hlavička
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mb-4' },
                React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, 'Potvrdenie generovania'),
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'text-gray-500 hover:text-gray-700'
                    },
                    React.createElement('i', { className: 'fa-solid fa-times text-xl' })
                )
            ),

            // Obsah
            React.createElement(
                'div',
                { className: 'mb-6' },
                React.createElement(
                    'p',
                    { className: 'text-gray-700 mb-2' },
                    'Pre kategóriu ',
                    React.createElement('span', { className: 'font-semibold' }, categoryName),
                    groupName ? React.createElement('span', null, ' a skupinu ', React.createElement('span', { className: 'font-semibold' }, groupName)) : null,
                    ' už boli zápasy vygenerované.'
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-700' },
                    'Chcete ich vygenerovať znovu?'
                )
            ),

            // Tlačidlá
            React.createElement(
                'div',
                { className: 'flex justify-end gap-3' },
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors'
                    },
                    'Nie'
                ),
                React.createElement(
                    'button',
                    {
                        onClick: () => {
                            onConfirm();
                            onClose();
                        },
                        className: 'px-4 py-2 text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors'
                    },
                    'Áno, generovať'
                )
            )
        )
    );
};

const AddMatchesApp = ({ userProfileData }) => {
    const [sportHalls, setSportHalls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [categories, setCategories] = useState([]);
    const [matches, setMatches] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [pendingGeneration, setPendingGeneration] = useState(null);
    const [groupsByCategory, setGroupsByCategory] = useState({});
    const [teamData, setTeamData] = useState({ allTeams: [] });
    const [showTeamId, setShowTeamId] = useState(false);
    
    // NOVÉ STAVY PRE ZOZNAM POUŽÍVATEĽOV
    const [users, setUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(true);

    // Funkcia na získanie názvu tímu podľa ID alebo priamo z objektu
    const getTeamName = (team) => {
        if (!team) return 'Neznámy tím';
        return team.teamName || 'Neznámy tím';
    };

    // Funkcia na získanie ID tímu (ak existuje)
    const getTeamId = (team) => {
        if (!team) return null;
        return team.id || null;
    };

    // Funkcia na získanie názvu tímu podľa ID (pre existujúce zápasy)
    const getTeamNameById = (teamId) => {
        if (!teamId) {
            return 'Neznámy tím';
        }
        
        // ZISTÍME KATEGÓRIU Z AKTUÁLNEHO ZÁPASU
        const currentMatch = matches.find(m => m.homeTeamId === teamId || m.awayTeamId === teamId);
        
        if (!currentMatch || !currentMatch.categoryName) {
            // Ak nemáme informáciu o kategórii, vrátime pôvodné ID
            return typeof teamId === 'string' && teamId.length > 0 ? teamId : 'Neznámy tím';
        }
        
        const categoryName = currentMatch.categoryName;
        
        // Skúsime nájsť v teamData podľa kategórie a názvu
        if (teamData.allTeams && teamData.allTeams.length > 0) {
            const team = teamData.allTeams.find(t => 
                t.category === categoryName && 
                t.teamName === teamId
            );
            
            if (team) {
                return getTeamName(team);
            }
        }
        
        // Ak nie je v teamData, skúsime priamo z window.__teamManagerData
        if (window.__teamManagerData?.allTeams) {
            const team = window.__teamManagerData.allTeams.find(t => 
                t.category === categoryName && 
                t.teamName === teamId
            );
            
            if (team) {
                setTeamData(window.__teamManagerData);
                return getTeamName(team);
            }
        }

        // Ak ide o priamy názov tímu (fallback), vrátime ho
        if (typeof teamId === 'string' && teamId.length > 0) {
            return teamId;
        }
        
        return 'Neznámy tím';
    };

    // Funkcia na získanie zobrazovaného textu pre tím
    const getTeamDisplayText = (teamId) => {
        if (showTeamId) {
            // Zobraziť ID v požadovanom formáte: '{názov kategorie}' '{názov skupiny}' 'poradove číslo'
            if (!teamId) return '---';
            
            // ZISTÍME KATEGÓRIU Z AKTUÁLNEHO ZÁPASU
            const currentMatch = matches.find(m => m.homeTeamId === teamId || m.awayTeamId === teamId);
            
            if (!currentMatch || !currentMatch.categoryName) {
                // Ak nemáme informáciu o kategórii, vrátime pôvodné ID
                return typeof teamId === 'string' && teamId.length > 20 
                    ? `${teamId.substring(0, 8)}...${teamId.substring(teamId.length - 4)}`
                    : teamId;
            }
            
            const categoryName = currentMatch.categoryName;
            
            // VYHĽADÁME TÍM PODĽA KATEGÓRIE A NÁZVU
            if (teamData.allTeams && teamData.allTeams.length > 0) {
                const team = teamData.allTeams.find(t => 
                    t.category === categoryName && 
                    t.teamName === teamId
                );
                
                if (team) {
                    // Našli sme tím, teraz zistíme jeho poradové číslo v skupine
                    const teamsInSameGroup = teamData.allTeams.filter(t => 
                        t.category === categoryName && t.groupName === team.groupName
                    );
                    
                    const sortedTeams = [...teamsInSameGroup].sort((a, b) => 
                        (a.teamName || '').localeCompare(b.teamName || '')
                    );
                    
                    const teamIndex = sortedTeams.findIndex(t => 
                        t.id === team.id || t.teamName === teamId
                    );
                    const teamNumber = teamIndex !== -1 ? teamIndex + 1 : '?';
                    
                    return `${categoryName} ${team.groupName}${teamNumber}`;
                }
            }
            
            // Ak sa nám nepodarilo nájsť tím, vrátime pôvodný názov
            if (typeof teamId === 'string' && teamId.length > 20) {
                return `${teamId.substring(0, 8)}...${teamId.substring(teamId.length - 4)}`;
            }
            return teamId;
        } else {
            // Zobraziť názov tímu
            return getTeamNameById(teamId);
        }
    };

    // Funkcia na kontrolu, či už boli zápasy pre danú kategóriu/skupinu vygenerované
    const hasExistingMatches = (categoryId, groupName) => {
        return matches.some(match => 
            match.categoryId === categoryId && 
            (groupName ? match.groupName === groupName : true)
        );
    };

    // Funkcia na načítanie zápasov z Firebase
    const loadMatches = () => {
        if (!window.db) return;

        const matchesRef = collection(window.db, 'matches');
        
        const unsubscribe = onSnapshot(matchesRef, (snapshot) => {
            const loadedMatches = [];
            snapshot.forEach((doc) => {
                loadedMatches.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            // Zoradenie podľa času vytvorenia (najnovšie prvé)
            loadedMatches.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setMatches(loadedMatches);
        }, (error) => {
            console.error('Chyba pri načítaní zápasov:', error);
        });

        return unsubscribe;
    };

    // NOVÁ FUNKCIA: Načítanie používateľov z Firebase
    const loadUsers = () => {
        if (!window.db) return;

        const usersRef = collection(window.db, 'users');
        
        const unsubscribe = onSnapshot(usersRef, (snapshot) => {
            const loadedUsers = [];
            snapshot.forEach((doc) => {
                loadedUsers.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            // Zoradenie podľa emailu
            loadedUsers.sort((a, b) => (a.email || '').localeCompare(b.email || ''));
            setUsers(loadedUsers);
            setLoadingUsers(false);
            
            console.log(`Načítaných ${loadedUsers.length} používateľov:`);
            loadedUsers.forEach(user => {
                console.log(`- ${user.email} (UID: ${user.id}, Rola: ${user.role || 'bežný'}, Schválený: ${user.approved ? 'áno' : 'nie'})`);
            });
        }, (error) => {
            console.error('Chyba pri načítaní používateľov:', error);
            setLoadingUsers(false);
        });

        return unsubscribe;
    };

    // Funkcia na získanie počtu zápasov pre používateľa
    const getUserMatchesCount = (userEmail) => {
        if (!userEmail) return 0;
        return matches.filter(match => match.createdBy === userEmail).length;
    };

    // Funkcia na získanie zoznamu kategórií, pre ktoré používateľ generoval zápasy
    const getUserCategories = (userEmail) => {
        if (!userEmail) return [];
        const userMatches = matches.filter(match => match.createdBy === userEmail);
        const categories = [...new Set(userMatches.map(match => match.categoryName).filter(Boolean))];
        return categories.sort();
    };

    // Funkcia na získanie celkového počtu zápasov
    const getTotalMatchesCount = () => {
        return matches.length;
    };

    // Funkcia na získanie počtu zápasov podľa kategórie
    const getMatchesCountByCategory = () => {
        const counts = {};
        matches.forEach(match => {
            if (match.categoryName) {
                counts[match.categoryName] = (counts[match.categoryName] || 0) + 1;
            }
        });
        return counts;
    };

    // Prihlásenie na odber zmien v teamManager
    useEffect(() => {
        if (window.teamManager) {
            console.log('Prihlasujem sa na odber teamManager');
            
            // Okamžite skúsime načítať existujúce dáta
            if (window.__teamManagerData) {
                console.log('Našiel som existujúce teamManager data, počet tímov:', window.__teamManagerData.allTeams?.length);
                setTeamData(window.__teamManagerData);
            }
            
            const unsubscribe = window.teamManager.subscribe((data) => {
                console.log('TeamManager data aktualizované, počet tímov:', data.allTeams?.length);
                setTeamData(data);
            });
            
            return () => {
                console.log('Odhlasujem sa z odberu teamManager');
                if (unsubscribe) unsubscribe();
            };
        } else {
            console.log('teamManager nie je k dispozícii');
        }
    }, []);

    // Funkcia na výpočet celkového času zápasu pre kategóriu
    const calculateTotalMatchTime = (category) => {
        if (!category) return { playingTime: 0, breaksBetweenPeriods: 0, totalTimeWithMatchBreak: 0 };
        
        const periods = category.periods ?? 2;
        const periodDuration = category.periodDuration ?? 20;
        const breakDuration = category.breakDuration ?? 2;
        const matchBreak = category.matchBreak ?? 5;
        
        const playingTime = periods * periodDuration;
        const breaksBetweenPeriods = (periods - 1) * breakDuration;
        const totalTimeWithMatchBreak = playingTime + breaksBetweenPeriods + matchBreak;
        
        return {
            playingTime,
            breaksBetweenPeriods,
            totalTimeWithMatchBreak
        };
    };

    // Funkcia na generovanie zápasov pre skupinu
    const generateMatchesForGroup = (teams, withRepetitions) => {
        const matches = [];
        
        // Pre každý tím vytvoríme identifikátor (ID alebo názov)
        const teamIdentifiers = teams.map(t => ({
            id: getTeamId(t),
            name: getTeamName(t)
        }));
        
        console.log('Generujem zápasy pre tímy:', teamIdentifiers);
        
        if (withRepetitions) {
            // Každý s každým doma/vonku v rámci skupiny
            for (let i = 0; i < teamIdentifiers.length; i++) {
                for (let j = 0; j < teamIdentifiers.length; j++) {
                    if (i !== j) {
                        matches.push({
                            homeTeamId: teamIdentifiers[i].id || teamIdentifiers[i].name,
                            awayTeamId: teamIdentifiers[j].id || teamIdentifiers[j].name,
                        });
                    }
                }
            }
        } else {
            // Jedinečné dvojice (každý s každým raz) v rámci skupiny
            for (let i = 0; i < teamIdentifiers.length; i++) {
                for (let j = i + 1; j < teamIdentifiers.length; j++) {
                    matches.push({
                        homeTeamId: teamIdentifiers[i].id || teamIdentifiers[i].name,
                        awayTeamId: teamIdentifiers[j].id || teamIdentifiers[j].name,
                    });
                }
            }
        }
        
        console.log(`Vygenerovaných ${matches.length} zápasov`);
        return matches;
    };

    // Funkcia na získanie všetkých skupín v kategórii
    const getAllGroupsInCategory = (categoryName) => {
        const groups = [];
        
        // Prejdeme všetky tímy a extrahujeme unikátne skupiny
        const teamsToUse = teamData.allTeams || window.__teamManagerData?.allTeams || [];
        
        if (teamsToUse.length > 0) {
            const teamsInCategory = teamsToUse.filter(t => t.category === categoryName);
            const groupNames = [...new Set(teamsInCategory.map(t => t.groupName).filter(g => g))];
            
            // Zoradenie názvov skupín podľa abecedy
            const sortedGroupNames = groupNames.sort((a, b) => a.localeCompare(b));
            
            sortedGroupNames.forEach(groupName => {
                const teamsInGroup = teamsInCategory.filter(t => t.groupName === groupName);
                if (teamsInGroup.length >= 2) {
                    groups.push({
                        name: groupName,
                        teams: teamsInGroup
                    });
                }
            });
        }
        
        return groups;
    };

    // Funkcia na uloženie zápasov do Firebase
    const saveMatchesToFirebase = async (matchesToSave) => {
        if (!window.db) {
            throw new Error('Databáza nie je inicializovaná');
        }
    
        // DEBUG: Vypíšeme informácie o používateľovi
        console.log('Kontrola admin práv pre ukladanie:');
        console.log('userProfileData:', userProfileData);
        console.log('role:', userProfileData?.role);
        console.log('approved:', userProfileData?.approved);
        console.log('email:', userProfileData?.email);
    
        // Skontrolujeme, či je používateľ admin
        if (userProfileData?.role !== 'admin') {
            console.error('Používateľ nie je admin. Role:', userProfileData?.role);
            throw new Error('Na ukladanie zápasov potrebujete administrátorské práva. Vaša rola: ' + (userProfileData?.role || 'žiadna'));
        }
    
        if (!userProfileData?.approved) {
            console.error('Používateľ nie je schválený. Approved:', userProfileData?.approved);
            throw new Error('Váš účet ešte nebol schválený administrátorom.');
        }
    
        const matchesRef = collection(window.db, 'matches');
        const savedMatches = [];
    
        // Pridáme index do cyklu
        for (let i = 0; i < matchesToSave.length; i++) {
            const match = matchesToSave[i];
            try {
                // Pripravíme dáta pre uloženie
                const matchData = {
                    homeTeamId: match.homeTeamId,
                    awayTeamId: match.awayTeamId,
                    time: match.time,
                    hallId: match.hallId,
                    categoryId: match.categoryId,
                    categoryName: match.categoryName,
                    groupName: match.groupName,
                    status: match.status,
                    createdAt: Timestamp.now(),
                    createdBy: userProfileData?.email || 'unknown',
                    createdByUid: userProfileData?.uid || null
                };
    
                // Uložíme do Firebase a získame ID
                const docRef = await addDoc(matchesRef, matchData);
                savedMatches.push({
                    id: docRef.id,
                    ...matchData
                });
                
                console.log(`Zápas ${i + 1}/${matchesToSave.length} uložený s ID: ${docRef.id}`);
            } catch (error) {
                console.error('Chyba pri ukladaní zápasu:', error);
                
                if (error.code === 'permission-denied') {
                    throw new Error('Nemáte oprávnenie na ukladanie zápasov. Ste prihlásený ako admin? (kód: permission-denied)');
                }
                
                throw error;
            }
        }
    
        return savedMatches;
    };

    // Funkcia na generovanie zápasov
    const generateMatches = async ({ categoryId, groupName, withRepetitions }) => {
        try {
            console.log('Generujem zápasy:', { categoryId, groupName, withRepetitions });
    
            // DEBUG: Skontrolujeme admin práva
            console.log('Kontrola admin práv v generateMatches:');
            console.log('userProfileData:', userProfileData);
            console.log('Je admin?', userProfileData?.role === 'admin');
            
            if (userProfileData?.role !== 'admin') {
                window.showGlobalNotification('Na generovanie zápasov potrebujete administrátorské práva', 'error');
                return;
            }       
            
            // Získanie kategórie
            const category = categories.find(c => c.id === categoryId);
            if (!category) {
                window.showGlobalNotification('Kategória nebola nájdená', 'error');
                return;
            }
    
            // Skontrolujeme, či máme teamManager dáta
            if (!window.teamManager) {
                window.showGlobalNotification('TeamManager nie je inicializovaný', 'error');
                return;
            }
    
            let allGeneratedMatches = [];
    
            if (groupName) {
                // Konkrétna skupina
                const teamsInGroup = await window.teamManager.getTeamsByGroup(category.name, groupName);
                
                console.log(`Našiel som ${teamsInGroup.length} tímov v skupine ${groupName}:`, 
                    teamsInGroup.map(t => ({ 
                        id: t.id, 
                        name: t.teamName || t.name,
                        hasId: !!t.id 
                    })));
                
                if (teamsInGroup.length < 2) {
                    window.showGlobalNotification(`V skupine ${groupName} sú menej ako 2 tímy`, 'error');
                    return;
                }
    
                // Generovanie zápasov pre túto skupinu
                const groupMatches = generateMatchesForGroup(teamsInGroup, withRepetitions);
                
                // Pridanie informácií o skupine ku každému zápasu
                const matchesWithInfo = groupMatches.map((match, index) => ({
                    homeTeamId: match.homeTeamId,
                    awayTeamId: match.awayTeamId,
                    time: '--:--',
                    hallId: null,
                    categoryId: category.id,
                    categoryName: category.name,
                    groupName: groupName,
                    status: 'pending'
                }));
    
                allGeneratedMatches = [...allGeneratedMatches, ...matchesWithInfo];
                
            } else {
                // Všetky skupiny v kategórii
                const groups = getAllGroupsInCategory(category.name);
                
                if (groups.length === 0) {
                    window.showGlobalNotification('V tejto kategórii nie sú žiadne skupiny s aspoň 2 tímami', 'error');
                    return;
                }
    
                console.log(`Našiel som ${groups.length} skupín v kategórii ${category.name}:`, 
                    groups.map(g => g.name));
    
                // Pre každú skupinu vygenerujeme zápasy (skupiny sú už zoradené z getAllGroupsInCategory)
                for (const group of groups) {
                    const teamsInGroup = await window.teamManager.getTeamsByGroup(category.name, group.name);
                    
                    if (teamsInGroup.length >= 2) {
                        console.log(`Generujem zápasy pre skupinu ${group.name} s ${teamsInGroup.length} tímami`);
                        
                        const groupMatches = generateMatchesForGroup(teamsInGroup, withRepetitions);
                        
                        const matchesWithInfo = groupMatches.map((match, index) => ({
                            homeTeamId: match.homeTeamId,
                            awayTeamId: match.awayTeamId,
                            time: '--:--',
                            hallId: null,
                            categoryId: category.id,
                            categoryName: category.name,
                            groupName: group.name,
                            status: 'pending'
                        }));
    
                        allGeneratedMatches = [...allGeneratedMatches, ...matchesWithInfo];
                    }
                }
            }
    
            // Uloženie zápasov do Firebase
            if (allGeneratedMatches.length > 0) {
                console.log('Ukladám zápasy do Firebase...');
                
                // Zobrazíme loading notifikáciu
                window.showGlobalNotification(`Ukladám ${allGeneratedMatches.length} zápasov...`, 'info');
                
                // Uložíme do Firebase
                const savedMatches = await saveMatchesToFirebase(allGeneratedMatches);
                
                console.log(`Úspešne uložených ${savedMatches.length} zápasov`);
                
                // Pridáme do lokálneho stavu (matches sa aktualizujú cez onSnapshot)
                window.showGlobalNotification(
                    `Vygenerovaných a uložených ${savedMatches.length} zápasov pre ${category.name}${groupName ? ' - ' + groupName : ''}`,
                    'success'
                );
            }
    
        } catch (error) {
            console.error('Chyba pri generovaní zápasov:', error);
            window.showGlobalNotification('Chyba pri generovaní zápasov: ' + error.message, 'error');
        }
    };

    // Handler pre kliknutie na Generovať
    const handleGenerateClick = (params) => {
        const category = categories.find(c => c.id === params.categoryId);
        if (!category) return;

        // Skontrolujeme, či už existujú zápasy pre túto kategóriu/skupinu
        if (hasExistingMatches(params.categoryId, params.groupName)) {
            setPendingGeneration(params);
            setIsConfirmModalOpen(true);
        } else {
            // Ak neexistujú, rovno generujeme
            generateMatches(params);
        }
    };

    // Handler pre potvrdenie opätovného generovania
    const handleConfirmRegenerate = () => {
        if (pendingGeneration) {
            generateMatches(pendingGeneration);
            setPendingGeneration(null);
        }
    };

    // Načítanie športových hál, kategórií a používateľov z Firebase
    useEffect(() => {
        if (!window.db) {
            console.error("Firestore databáza nie je inicializovaná");
            setLoading(false);
            setLoadingUsers(false);
            return;
        }

        console.log("AddMatchesApp: Načítavam športové haly, kategórie a používateľov z databázy...");
        
        // Načítame zápasy
        const unsubscribeMatches = loadMatches();
        
        // Načítame používateľov
        const unsubscribeUsers = loadUsers();
        
        // Načítame nastavenia kategórií
        const loadCategorySettings = async () => {
            try {
                const catRef = doc(window.db, 'settings', 'categories');
                const catSnap = await getDoc(catRef);
                
                if (catSnap.exists()) {
                    const data = catSnap.data() || {};
                    const categoriesList = [];
                    
                    Object.entries(data).forEach(([id, obj]) => {
                        const category = {
                            id: id,
                            name: obj.name || `Kategória ${id}`,
                            maxTeams: obj.maxTeams ?? 12,
                            periods: obj.periods ?? 2,
                            periodDuration: obj.periodDuration ?? 20,
                            breakDuration: obj.breakDuration ?? 2,
                            matchBreak: obj.matchBreak ?? 5,
                            drawColor: obj.drawColor ?? '#3B82F6',
                            transportColor: obj.transportColor ?? '#10B981',
                            timeoutCount: obj.timeoutCount ?? 2,
                            timeoutDuration: obj.timeoutDuration ?? 1,
                            exclusionTime: obj.exclusionTime ?? 2
                        };
                        
                        categoriesList.push(category);
                        
                        // Výpočet času pre túto kategóriu
                        const matchTime = calculateTotalMatchTime(category);
                        
                        // Výpis do konzoly pre každú kategóriu
                        console.log(`Kategória: ${category.name} (ID: ${category.id})`);
                        console.log(`  - Farba pre rozlosovanie: ${category.drawColor}`);
                        console.log(`  - Celkový čas zápasu: ${matchTime.totalTimeWithMatchBreak} min`);
                        console.log(`    (Čistý hrací čas: ${matchTime.playingTime} min, Prestávky: ${matchTime.breaksBetweenPeriods} min)`);
                        console.log(`  - Nastavenia:`);
                        console.log(`    • Počet periód: ${category.periods}`);
                        console.log(`    • Trvanie periódy: ${category.periodDuration} min`);
                        console.log(`    • Prestávka medzi periódami: ${category.breakDuration} min`);
                        console.log(`    • Prestávka medzi zápasmi: ${category.matchBreak} min`);
                        console.log(`    • Počet timeoutov: ${category.timeoutCount}`);
                        console.log(`    • Trvanie timeoutu: ${category.timeoutDuration} min`);
                        console.log(`    • Čas vylúčenia: ${category.exclusionTime} min`);
                        console.log(`    • Farba pre dopravu: ${category.transportColor}`);
                        console.log('---');
                    });
                    
                    setCategories(categoriesList);
                    console.log(`AddMatchesApp: Načítaných ${categoriesList.length} kategórií`);
                } else {
                    console.log("AddMatchesApp: Žiadne kategórie neboli nájdené");
                }
            } catch (error) {
                console.error("AddMatchesApp: Chyba pri načítaní nastavení kategórií:", error);
            }
        };
        
        loadCategorySettings();

        // Načítanie skupín
        const loadGroups = async () => {
            try {
                const groupsRef = doc(window.db, 'settings', 'groups');
                const groupsSnap = await getDoc(groupsRef);
                
                if (groupsSnap.exists()) {
                    setGroupsByCategory(groupsSnap.data());
                }
            } catch (error) {
                console.error("AddMatchesApp: Chyba pri načítaní skupín:", error);
            }
        };

        loadGroups();
        
        const unsubscribePlaces = onSnapshot(
            collection(window.db, 'places'),
            (snapshot) => {
                const loadedPlaces = [];
                snapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    const loc = data.location;
                    
                    loadedPlaces.push({
                        id: docSnap.id,
                        name: data.name,
                        type: data.type,
                        lat: loc?.latitude ?? data.lat,
                        lng: loc?.longitude ?? data.lng,
                    });
                });
                
                // Filtrujeme len športové haly
                const filteredHalls = loadedPlaces.filter(place => place.type === 'sportova_hala');
                setSportHalls(filteredHalls);
                setLoading(false);
                
                console.log(`AddMatchesApp: Načítaných ${filteredHalls.length} športových hál`);
            },
            (error) => {
                console.error("AddMatchesApp: Chyba pri načítaní miest:", error);
                window.showGlobalNotification('Nepodarilo sa načítať športové haly', 'error');
                setLoading(false);
            }
        );

        return () => {
            if (unsubscribeMatches) unsubscribeMatches();
            if (unsubscribeUsers) unsubscribeUsers();
            unsubscribePlaces();
        };
    }, []);

    // ZJEDNODUŠENÝ RENDER - tri stĺpce (ľavý - zápasy, stredný - používatelia, pravý - haly)
    return React.createElement(
        React.Fragment,
        null,
        React.createElement(GenerationModal, {
            isOpen: isModalOpen,
            onClose: () => setIsModalOpen(false),
            onConfirm: handleGenerateClick,
            categories: categories,
            groupsByCategory: groupsByCategory
        }),
        React.createElement(ConfirmRegenerateModal, {
            isOpen: isConfirmModalOpen,
            onClose: () => {
                setIsConfirmModalOpen(false);
                setPendingGeneration(null);
            },
            onConfirm: handleConfirmRegenerate,
            categoryName: pendingGeneration ? categories.find(c => c.id === pendingGeneration.categoryId)?.name : '',
            groupName: pendingGeneration?.groupName
        }),
        React.createElement(
            'div',
            { className: 'flex-grow flex justify-center items-start w-full' },
            React.createElement(
                'div',
                { className: 'w-full bg-white rounded-xl shadow-xl p-8 mx-4' },
                
                // Hlavička s prepínačom
                React.createElement(
                    'div',
                    { className: 'flex flex-col items-center justify-center mb-6 p-4 -mx-8 -mt-8 rounded-t-xl' },
                    React.createElement('h2', { className: 'text-3xl font-bold tracking-tight text-center text-gray-800 mb-4' }, 'Zápasy'),
                    
                    // NOVÝ PREPÍNAČ
                    React.createElement(
                        'div',
                        { className: 'flex items-center gap-3 bg-gray-100 p-2 rounded-lg' },
                        React.createElement(
                            'span',
                            { 
                                className: `px-3 py-1 rounded-md text-sm font-medium cursor-pointer transition-colors ${
                                    !showTeamId 
                                        ? 'bg-blue-600 text-white shadow-sm' 
                                        : 'text-gray-600 hover:bg-gray-200'
                                }`,
                                onClick: () => setShowTeamId(false)
                            },
                            'Názvy tímov'
                        ),
                        React.createElement(
                            'span',
                            { 
                                className: `px-3 py-1 rounded-md text-sm font-medium cursor-pointer transition-colors ${
                                    showTeamId 
                                        ? 'bg-blue-600 text-white shadow-sm' 
                                        : 'text-gray-600 hover:bg-gray-200'
                                }`,
                                onClick: () => setShowTeamId(true)
                            },
                            'ID tímov'
                        )
                    )
                ),
                
                // Štatistika zápasov
                React.createElement(
                    'div',
                    { className: 'grid grid-cols-1 md:grid-cols-3 gap-4 mb-6' },
                    React.createElement(
                        'div',
                        { className: 'bg-blue-50 p-4 rounded-lg border border-blue-200' },
                        React.createElement('div', { className: 'text-sm text-blue-600 font-medium' }, 'Celkový počet zápasov'),
                        React.createElement('div', { className: 'text-3xl font-bold text-blue-800' }, getTotalMatchesCount())
                    ),
                    React.createElement(
                        'div',
                        { className: 'bg-green-50 p-4 rounded-lg border border-green-200' },
                        React.createElement('div', { className: 'text-sm text-green-600 font-medium' }, 'Počet používateľov'),
                        React.createElement('div', { className: 'text-3xl font-bold text-green-800' }, users.length)
                    ),
                    React.createElement(
                        'div',
                        { className: 'bg-purple-50 p-4 rounded-lg border border-purple-200' },
                        React.createElement('div', { className: 'text-sm text-purple-600 font-medium' }, 'Počet hál'),
                        React.createElement('div', { className: 'text-3xl font-bold text-purple-800' }, sportHalls.length)
                    )
                ),
                
                // Tri stĺpce - ľavý pre zápasy, stredný pre používateľov, pravý pre haly
                React.createElement(
                    'div',
                    { className: 'flex flex-col lg:flex-row gap-6 mt-4' },
                    
                    // ĽAVÝ STĹPEC - Zoznam zápasov
                    React.createElement(
                        'div',
                        { className: 'lg:w-1/3 bg-gray-50 rounded-xl p-4 border border-gray-200' },
                        React.createElement(
                            'h3',
                            { className: 'text-xl font-semibold mb-4 text-gray-700 border-b pb-2 flex items-center' },
                            React.createElement('i', { className: 'fa-solid fa-calendar-alt mr-2 text-blue-500' }),
                            'Zoznam zápasov',
                            React.createElement('span', { className: 'ml-2 text-sm font-normal text-gray-500' },
                                `(${matches.length})`
                            )
                        ),
                        
                        // Zoznam zápasov
                        matches.length === 0 ? 
                            React.createElement(
                                'div',
                                { className: 'text-center py-8 text-gray-500' },
                                React.createElement('i', { className: 'fa-solid fa-calendar-xmark text-4xl mb-3 opacity-30' }),
                                React.createElement('p', { className: 'text-sm' }, 'Žiadne zápasy')
                            ) :
                            React.createElement(
                                'div',
                                { className: 'space-y-3 max-h-[600px] overflow-y-auto pr-2' },
                                matches.map(match => {
                                    // Použijeme prepínač pre zobrazenie
                                    const homeTeamDisplay = getTeamDisplayText(match.homeTeamId);
                                    const awayTeamDisplay = getTeamDisplayText(match.awayTeamId);
                                    
                                    return React.createElement(
                                        'div',
                                        { 
                                            key: match.id,
                                            className: 'bg-white p-4 rounded-lg border border-gray-200 hover:shadow-md transition-shadow cursor-pointer'
                                        },
                                        React.createElement(
                                            'div',
                                            { className: 'flex justify-between items-start mb-2' },
                                            React.createElement(
                                                'span',
                                                { className: 'text-xs font-medium px-2 py-1 bg-blue-100 text-blue-700 rounded-full' },
                                                match.time
                                            ),
                                            React.createElement(
                                                'span',
                                                { className: 'text-xs text-gray-500' },
                                                match.categoryName || 'Neznáma kategória'
                                            )
                                        ),
                                        React.createElement(
                                            'div',
                                            { className: 'flex items-center justify-between' },
                                            React.createElement(
                                                'span',
                                                { 
                                                    className: `font-semibold ${showTeamId ? 'font-mono' : ''} text-gray-800`,
                                                    title: showTeamId ? match.homeTeamId : homeTeamDisplay
                                                },
                                                homeTeamDisplay
                                            ),
                                            React.createElement('i', { className: 'fa-solid fa-vs text-xs text-gray-400 mx-2' }),
                                            React.createElement(
                                                'span',
                                                { 
                                                    className: `font-semibold ${showTeamId ? 'font-mono' : ''} text-gray-800`,
                                                    title: showTeamId ? match.awayTeamId : awayTeamDisplay
                                                },
                                                awayTeamDisplay
                                            )
                                        ),
                                        React.createElement(
                                            'div',
                                            { className: 'mt-2 text-xs text-gray-500 flex items-center' },
                                            React.createElement('i', { className: 'fa-solid fa-user mr-1 text-gray-400' }),
                                            match.createdBy || 'Neznámy',
                                            React.createElement('span', { className: 'mx-2' }, '•'),
                                            React.createElement('i', { className: 'fa-solid fa-location-dot mr-1 text-gray-400' }),
                                            match.hallId ? 'Hala' : 'Nepriradené',
                                            match.groupName && React.createElement(
                                                'span',
                                                { className: 'ml-2 px-2 py-0.5 bg-gray-100 rounded-full' },
                                                match.groupName
                                            )
                                        )
                                    );
                                })
                            ),
                        
                        // Tlačidlo pre generovanie zápasov
                        React.createElement(
                            'button',
                            { 
                                className: 'mt-4 w-full py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2',
                                onClick: () => setIsModalOpen(true)
                            },
                            React.createElement('i', { className: 'fa-solid fa-plus-circle' }),
                            'Generovať zápasy'
                        )
                    ),
                    
                    // STREDNÝ STĹPEC - Zoznam používateľov
                    React.createElement(
                        'div',
                        { className: 'lg:w-1/3 bg-gray-50 rounded-xl p-4 border border-gray-200' },
                        React.createElement(
                            'h3',
                            { className: 'text-xl font-semibold mb-4 text-gray-700 border-b pb-2 flex items-center' },
                            React.createElement('i', { className: 'fa-solid fa-users mr-2 text-green-500' }),
                            'Používatelia so zápasmi',
                            React.createElement('span', { className: 'ml-2 text-sm font-normal text-gray-500' },
                                `(${users.length})`
                            )
                        ),
                        
                        // Indikátor načítavania
                        loadingUsers && React.createElement(
                            'div',
                            { className: 'flex justify-center items-center py-8' },
                            React.createElement('div', { className: 'animate-spin rounded-full h-8 w-8 border-b-4 border-green-500' })
                        ),
                        
                        // Zoznam používateľov
                        !loadingUsers && users.length === 0 ? 
                            React.createElement(
                                'div',
                                { className: 'text-center py-8 text-gray-500' },
                                React.createElement('i', { className: 'fa-solid fa-users-slash text-4xl mb-3 opacity-30' }),
                                React.createElement('p', { className: 'text-sm' }, 'Žiadni používatelia')
                            ) :
                            !loadingUsers && React.createElement(
                                'div',
                                { className: 'space-y-3 max-h-[600px] overflow-y-auto pr-2' },
                                users.map(user => {
                                    const matchesCount = getUserMatchesCount(user.email);
                                    const userCategories = getUserCategories(user.email);
                                    
                                    // Zobrazíme len používateľov, ktorí majú aspoň jeden zápas
                                    if (matchesCount === 0) return null;
                                    
                                    return React.createElement(
                                        'div',
                                        { 
                                            key: user.id,
                                            className: 'bg-white p-4 rounded-lg border border-gray-200 hover:shadow-md transition-shadow'
                                        },
                                        React.createElement(
                                            'div',
                                            { className: 'flex items-start justify-between mb-2' },
                                            React.createElement(
                                                'div',
                                                { className: 'flex items-center gap-2' },
                                                React.createElement(
                                                    'div',
                                                    { 
                                                        className: 'w-8 h-8 rounded-full bg-green-100 flex items-center justify-center',
                                                    },
                                                    React.createElement('i', { className: 'fa-solid fa-user text-green-600' })
                                                ),
                                                React.createElement(
                                                    'div',
                                                    null,
                                                    React.createElement(
                                                        'div',
                                                        { className: 'font-medium text-gray-800' },
                                                        user.email || 'Bez emailu'
                                                    ),
                                                    React.createElement(
                                                        'div',
                                                        { className: 'text-xs text-gray-500' },
                                                        `UID: ${user.id.substring(0, 8)}...`
                                                    )
                                                )
                                            ),
                                            React.createElement(
                                                'span',
                                                { 
                                                    className: `px-2 py-1 text-xs font-medium rounded-full ${
                                                        user.role === 'admin' 
                                                            ? 'bg-purple-100 text-purple-700' 
                                                            : 'bg-blue-100 text-blue-700'
                                                    }` 
                                                },
                                                user.role === 'admin' ? 'Admin' : 'Bežný'
                                            )
                                        ),
                                        React.createElement(
                                            'div',
                                            { className: 'mt-2 flex items-center gap-2' },
                                            React.createElement(
                                                'span',
                                                { className: 'text-xs bg-gray-100 px-2 py-1 rounded-full' },
                                                React.createElement('i', { className: 'fa-solid fa-calendar mr-1' }),
                                                `Zápasy: ${matchesCount}`
                                            ),
                                            user.approved ? 
                                                React.createElement(
                                                    'span',
                                                    { className: 'text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full' },
                                                    React.createElement('i', { className: 'fa-solid fa-check-circle mr-1' }),
                                                    'Schválený'
                                                ) :
                                                React.createElement(
                                                    'span',
                                                    { className: 'text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full' },
                                                    React.createElement('i', { className: 'fa-solid fa-clock mr-1' }),
                                                    'Čaká na schválenie'
                                                )
                                        ),
                                        userCategories.length > 0 && React.createElement(
                                            'div',
                                            { className: 'mt-2' },
                                            React.createElement(
                                                'div',
                                                { className: 'text-xs text-gray-500 mb-1' },
                                                'Kategórie:'
                                            ),
                                            React.createElement(
                                                'div',
                                                { className: 'flex flex-wrap gap-1' },
                                                userCategories.map(cat => 
                                                    React.createElement(
                                                        'span',
                                                        { key: cat, className: 'text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full' },
                                                        cat
                                                    )
                                                )
                                            )
                                        )
                                    );
                                })
                            )
                    ),
                    
                    // PRAVÝ STĹPEC - Športové haly
                    React.createElement(
                        'div',
                        { className: 'lg:w-1/3' },
                        React.createElement(
                            'h3',
                            { className: 'text-xl font-semibold mb-4 text-gray-700 border-b pb-2' },
                            React.createElement('i', { className: 'fa-solid fa-futbol mr-2 text-red-500' }),
                            'Športové haly',
                            React.createElement('span', { className: 'ml-2 text-sm font-normal text-gray-500' },
                                `(${sportHalls.length} ${sportHalls.length === 1 ? 'hala' : sportHalls.length < 5 ? 'haly' : 'hál'})`
                            )
                        ),
                        
                        // Indikátor načítavania
                        loading && React.createElement(
                            'div',
                            { className: 'flex justify-center items-center py-12' },
                            React.createElement('div', { className: 'animate-spin rounded-full h-12 w-12 border-b-4 border-blue-500' })
                        ),
                        
                        // Žiadne haly
                        !loading && sportHalls.length === 0 && React.createElement(
                            'div',
                            { className: 'text-center py-12 text-gray-500 bg-gray-50 rounded-lg' },
                            React.createElement('i', { className: 'fa-solid fa-map-pin text-5xl mb-4 opacity-30' }),
                            React.createElement('p', { className: 'text-lg' }, 'Žiadne športové haly nie sú k dispozícii'),
                            React.createElement('p', { className: 'text-sm mt-2' }, 'Pridajte prvú športovú halu v mape.')
                        ),
                        
                        // Grid zoznam športových hál
                        !loading && sportHalls.length > 0 && React.createElement(
                            'div',
                            { className: 'grid grid-cols-1 gap-4' },
                            sportHalls.map((hall) => {
                                const typeConfig = typeIcons[hall.type] || { icon: 'fa-futbol', color: '#dc2626' };
                                
                                return React.createElement(
                                    'div',
                                    { 
                                        key: hall.id,
                                        className: `p-5 bg-white rounded-xl border-2 border-gray-200 shadow-sm hover:shadow-md transition-shadow`
                                    },
                                    React.createElement(
                                        'div',
                                        { className: 'flex items-center' },
                                        React.createElement(
                                            'div',
                                            { 
                                                className: 'w-14 h-14 rounded-full flex items-center justify-center mr-4',
                                                style: { 
                                                    backgroundColor: typeConfig.color + '20',
                                                    border: `3px solid ${typeConfig.color}`
                                                }
                                            },
                                            React.createElement('i', { 
                                                className: `fa-solid ${typeConfig.icon} text-2xl`,
                                                style: { color: typeConfig.color }
                                            })
                                        ),
                                        React.createElement(
                                            'div',
                                            { className: 'flex-1' },
                                            React.createElement('h4', { className: 'font-bold text-xl text-gray-800' }, hall.name),
                                            React.createElement('span', { 
                                                className: 'inline-block px-3 py-1 text-xs font-medium rounded-full mt-1',
                                                style: { 
                                                    backgroundColor: typeConfig.color + '20',
                                                    color: typeConfig.color
                                                }
                                            }, 'Športová hala')
                                        )
                                    )
                                );
                            })
                        )
                    )
                )
            )
        )
    );
};

// Premenná na sledovanie, či bol poslucháč už nastavený
let isEmailSyncListenerSetup = false;

/**
 * Táto funkcia je poslucháčom udalosti 'globalDataUpdated'.
 * Akonáhle sa dáta používateľa načítajú, vykreslí aplikáciu AddMatchesApp.
 */
const handleDataUpdateAndRender = (event) => {
    const userProfileData = event.detail;
    const rootElement = document.getElementById('root');

    if (userProfileData) {
        // Synchronizácia e-mailu (ponechané pre funkcionalitu)
        if (window.auth && window.db && !isEmailSyncListenerSetup) {
            console.log("logged-in-matches.js: Nastavujem poslucháča na synchronizáciu e-mailu.");
            
            onAuthStateChanged(window.auth, async (user) => {
                if (user) {
                    try {
                        const userProfileRef = doc(window.db, 'users', user.uid);
                        const docSnap = await getDoc(userProfileRef);
            
                        if (docSnap.exists()) {
                            const firestoreEmail = docSnap.data().email;
                            if (user.email !== firestoreEmail) {
                                console.log(`E-mail v autentifikácii (${user.email}) sa líši od e-mailu vo Firestore (${firestoreEmail}). Aktualizujem...`);
                                
                                await updateDoc(userProfileRef, {
                                    email: user.email
                                });
            
                                const notificationsCollectionRef = collection(window.db, 'notifications');
                                await addDoc(notificationsCollectionRef, {
                                    userEmail: user.email,
                                    changes: `Zmena e-mailovej adresy z '${firestoreEmail}' na '${user.email}'.`,
                                    timestamp: new Date(),
                                });
                                
                                window.showGlobalNotification('E-mailová adresa bola automaticky aktualizovaná a synchronizovaná.', 'success');
                            }
                        }
                    } catch (error) {
                        console.error("Chyba pri porovnávaní a aktualizácii e-mailu:", error);
                        window.showGlobalNotification('Nastala chyba pri synchronizácii e-mailovej adresy.', 'error');
                    }
                }
            });
            isEmailSyncListenerSetup = true;
        }

        if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
            const root = ReactDOM.createRoot(rootElement);
            root.render(React.createElement(AddMatchesApp, { userProfileData }));
        }
    } else {
        // Loader keď nie sú dáta
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

// Registrácia poslucháča
window.addEventListener('globalDataUpdated', handleDataUpdateAndRender);

// Kontrola existujúcich dát
if (window.globalUserProfileData) {
    handleDataUpdateAndRender({ detail: window.globalUserProfileData });
} else {
    const rootElement = document.getElementById('root');
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
