// logged-in-matches-hall.js
import { collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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

// Funkcia na získanie zobrazeného názvu tímu - IBA cez teamManager
const getDisplayTeamName = (teamIdentifier) => {
    if (!teamIdentifier) return '???';
    
    // Kontrola formátu: "kategoria pismeno cislo" (s medzerou)
    const spacePattern = /^(\w+)\s+([A-Za-z])\s+(\d+)$/;
    const spaceMatch = teamIdentifier.match(spacePattern);
    
    if (spaceMatch) {
        const category = spaceMatch[1];
        const letter = spaceMatch[2];
        const number = spaceMatch[3];
        const displayId = `${category} ${number} ${letter}`;
        
        // Použiť LEN teamManager
        if (window.teamManager && typeof window.teamManager.getTeamNameByDisplayIdSync === 'function') {
            const teamName = window.teamManager.getTeamNameByDisplayIdSync(displayId);
            if (teamName && teamName !== displayId) return teamName;
        }
        
        // Ak teamManager vráti rovnakú hodnotu alebo neexistuje, vrátiť pôvodný identifikátor v upravenom formáte
        return `${category} ${number} ${letter}`;
    }
    
    // Kontrola formátu: "kategoria cislo pismeno" (s medzerou)
    const numberLetterPattern = /^(\w+)\s+(\d+)\s+([A-Za-z])$/;
    const numberLetterMatch = teamIdentifier.match(numberLetterPattern);
    
    if (numberLetterMatch) {
        const category = numberLetterMatch[1];
        const number = numberLetterMatch[2];
        const letter = numberLetterMatch[3];
        const displayId = `${category} ${number} ${letter}`;
        
        // Použiť LEN teamManager
        if (window.teamManager && typeof window.teamManager.getTeamNameByDisplayIdSync === 'function') {
            const teamName = window.teamManager.getTeamNameByDisplayIdSync(displayId);
            if (teamName && teamName !== displayId) return teamName;
        }
        
        // Ak teamManager vráti rovnakú hodnotu alebo neexistuje, vrátiť pôvodný identifikátor
        return teamIdentifier;
    }
    
    // Ak formát nesedí, skúsiť poslať priamo do teamManager
    if (window.teamManager && typeof window.teamManager.getTeamNameByDisplayIdSync === 'function') {
        const teamName = window.teamManager.getTeamNameByDisplayIdSync(teamIdentifier);
        if (teamName && teamName !== teamIdentifier) return teamName;
    }
    
    // Ak formát nesedí, vrátiť pôvodný identifikátor
    return teamIdentifier;
};

// Hlavný komponent
const MatchesHallApp = () => {
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [hallInfo, setHallInfo] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [teamNames, setTeamNames] = useState({}); // Cache pre názvy tímov

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
            
            // Zoradenie podľa dátumu a času
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

    // Inicializácia
    useEffect(() => {
        const init = () => {
            if (window.globalUserProfileData) {
                setUserProfile(window.globalUserProfileData);
                const hallId = window.globalUserProfileData.hallId;
                if (hallId) {
                    loadHallInfo(hallId);
                    loadMatches(hallId);
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
        
        // Zoradenie dní
        return Object.values(groups).sort((a, b) => a.date - b.date);
    };

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
        
        // Hlavička
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
        
        // Zoznam dní
        matchesByDay.length === 0 ? 
            React.createElement(
                'div',
                { className: 'text-center py-12 text-gray-500 bg-gray-50 rounded-xl' },
                React.createElement('i', { className: 'fa-solid fa-calendar-xmark text-5xl mb-3 opacity-50' }),
                React.createElement('p', { className: 'text-lg' }, 'Žiadne zápasy pre túto halu')
            ) :
            matchesByDay.map((dayGroup, dayIndex) => {
                const dayMatches = dayGroup.matches;
                const dayDate = dayGroup.date;
                
                return React.createElement(
                    'div',
                    { key: dayIndex, className: 'mb-8' },
                    
                    // Hlavička dňa
                    React.createElement(
                        'div',
                        { className: 'flex items-center gap-2 mb-4 pb-2 border-b border-gray-200' },
                        React.createElement('i', { className: 'fa-regular fa-calendar text-blue-500' }),
                        React.createElement('h2', { className: 'text-lg font-semibold text-gray-700' }, formatDateHeader(dayDate)),
                        React.createElement('span', { className: 'text-sm text-gray-400 ml-auto' }, `(${dayMatches.length} zápasov)`)
                    ),
                    
                    // Tabuľka zápasov
                    React.createElement(
                        'div',
                        { className: 'overflow-x-auto border border-gray-200 rounded-lg bg-white' },
                        React.createElement(
                            'table',
                            { className: 'min-w-full divide-y divide-gray-200' },
                            
                            // Hlavička tabuľky
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
                                    React.createElement('th', { className: 'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48' }, 'Info')
                                )
                            ),
                            
                            // Telo tabuľky
                            React.createElement(
                                'tbody',
                                { className: 'divide-y divide-gray-100' },
                                dayMatches.map((match) => {
                                    const dateTime = formatMatchDateTime(match.scheduledTime);
                                    const isResultAvailable = match.homeScore !== undefined && match.awayScore !== undefined;
                                    
                                    // Získanie zobrazených názvov tímov - vždy cez teamManager
                                    const homeTeamDisplay = teamNames[match.homeTeamIdentifier] || getDisplayTeamName(match.homeTeamIdentifier);
                                    const awayTeamDisplay = teamNames[match.awayTeamIdentifier] || getDisplayTeamName(match.awayTeamIdentifier);
                                    
                                    // Získanie info tagov
                                    const infoTags = [];
                                    if (match.matchType || match.isPlacementMatch) {
                                        infoTags.push(
                                            React.createElement('span', { 
                                                key: 'type',
                                                className: `inline-block text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                                                    match.isPlacementMatch ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                                                }` 
                                            },
                                            match.isPlacementMatch ? `o ${match.placementRank}. miesto` : match.matchType
                                        ));
                                    }
                                    if (match.groupName) {
                                        infoTags.push(
                                            React.createElement('span', { 
                                                key: 'group',
                                                className: 'inline-block text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full whitespace-nowrap' 
                                            },
                                            match.groupName
                                        ));
                                    }
                                    if (match.categoryName) {
                                        infoTags.push(
                                            React.createElement('span', { 
                                                key: 'category',
                                                className: 'inline-block text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full whitespace-nowrap' 
                                            },
                                            match.categoryName
                                        ));
                                    }
                                    
                                    return React.createElement(
                                        'tr',
                                        { key: match.id, className: 'hover:bg-gray-50 transition-colors' },
                                        
                                        // Čas
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
                                        
                                        // Domáci tím
                                        React.createElement(
                                            'td',
                                            { className: 'px-4 py-3 whitespace-nowrap text-right' },
                                            React.createElement('span', { className: 'font-medium text-gray-800 text-sm' }, homeTeamDisplay)
                                        ),
                                        
                                        // VS / výsledok
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
                                        
                                        // Hosťovský tím
                                        React.createElement(
                                            'td',
                                            { className: 'px-4 py-3 whitespace-nowrap text-left' },
                                            React.createElement('span', { className: 'font-medium text-gray-800 text-sm' }, awayTeamDisplay)
                                        ),
                                        
                                        // Info tagy
                                        React.createElement(
                                            'td',
                                            { className: 'px-4 py-3' },
                                            React.createElement(
                                                'div',
                                                { className: 'flex flex-col gap-1' },
                                                infoTags
                                            )
                                        )
                                    );
                                })
                            )
                        )
                    )
                );
            })
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
