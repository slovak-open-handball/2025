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

// Hlavný komponent
const MatchesHallApp = () => {
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [hallInfo, setHallInfo] = useState(null);
    const [userProfile, setUserProfile] = useState(null);

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
            { className: 'mb-6' },
            React.createElement('h1', { className: 'text-2xl font-bold text-gray-800' }, 'Zápasy'),
            React.createElement(
                'div',
                { className: 'flex items-center gap-2 mt-1' },
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
                    
                    // Zápasy pre daný deň - JEDEN RIADOK
                    React.createElement(
                        'div',
                        { className: 'divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden bg-white' },
                        dayMatches.map((match) => {
                            const dateTime = formatMatchDateTime(match.scheduledTime);
                            const isResultAvailable = match.homeScore !== undefined && match.awayScore !== undefined;
                            
                            return React.createElement(
                                'div',
                                { 
                                    key: match.id,
                                    className: 'hover:bg-gray-50 transition-colors'
                                },
                                React.createElement(
                                    'div',
                                    { className: 'p-3 flex flex-wrap items-center gap-3' },
                                    
                                    // Čas
                                    React.createElement(
                                        'div',
                                        { className: 'min-w-[70px] flex items-center gap-1' },
                                        React.createElement('i', { className: 'fa-regular fa-clock text-gray-400 text-xs' }),
                                        React.createElement('span', { className: 'font-mono font-medium text-gray-700 text-sm' }, dateTime?.time || '--:--')
                                    ),
                                    
                                    // Domáci tím
                                    React.createElement(
                                        'div',
                                        { className: 'flex-1 text-right min-w-[120px]' },
                                        React.createElement('span', { className: 'font-medium text-gray-800 text-sm' }, 
                                            match.homeTeamIdentifier || '???'
                                        )
                                    ),
                                    
                                    // VS / výsledok
                                    React.createElement(
                                        'div',
                                        { className: 'flex-shrink-0 min-w-[50px] text-center' },
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
                                        'div',
                                        { className: 'flex-1 text-left min-w-[120px]' },
                                        React.createElement('span', { className: 'font-medium text-gray-800 text-sm' }, 
                                            match.awayTeamIdentifier || '???'
                                        )
                                    ),
                                    
                                    // Typ zápasu (ak existuje) - TERAZ PRVÝ
                                    (match.matchType || match.isPlacementMatch) && React.createElement(
                                        'span',
                                        { className: `text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                                            match.isPlacementMatch ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                                        }` },
                                        match.isPlacementMatch ? `o ${match.placementRank}. miesto` : match.matchType
                                    ),
                                    
                                    // Skupina (ak existuje)
                                    match.groupName && React.createElement(
                                        'span',
                                        { className: 'text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full whitespace-nowrap' },
                                        match.groupName
                                    ),
                                    
                                    // Kategória (ak existuje)
                                    match.categoryName && React.createElement(
                                        'span',
                                        { className: 'text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full whitespace-nowrap' },
                                        match.categoryName
                                    ),
                                    
                                    // Detail tlačidlo
                                    React.createElement(
                                        'button',
                                        {
                                            className: 'text-xs text-blue-500 hover:text-blue-700 whitespace-nowrap',
                                            onClick: () => console.log('Detail zápasu:', match.id)
                                        },
                                        'Detail'
                                    )
                                )
                            );
                        })
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
