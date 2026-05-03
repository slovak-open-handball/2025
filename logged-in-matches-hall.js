// logged-in-matches-hall.js
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const { useState, useEffect } = React;

// Funkcia na formátovanie dátumu
const formatMatchTime = (timestamp) => {
    if (!timestamp) return 'Čas nebol nastavený';
    try {
        const date = timestamp.toDate();
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${day}.${month}. ${hours}:${minutes}`;
    } catch (e) {
        return 'Neplatný dátum';
    }
};

// Hlavný komponent
const MatchesHallApp = () => {
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [hallInfo, setHallInfo] = useState(null);

    // Získanie ID haly z URL parametra
    const getHallIdFromURL = () => {
        const params = new URLSearchParams(window.location.search);
        return params.get('hallId');
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

    // Načítanie zápasov pre konkrétnu halu
    const loadMatches = async (hallId) => {
        if (!window.db) {
            setError('Databáza nie je inicializovaná');
            setLoading(false);
            return;
        }

        if (!hallId) {
            setError('Nie je zadané ID haly (parameter hallId v URL)');
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
            
            // Zoradenie podľa času
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
            
            if (hallMatches.length === 0) {
                setError('Pre túto halu nie sú žiadne zápasy');
            }
            
        } catch (err) {
            console.error('Chyba pri načítaní zápasov:', err);
            setError('Nepodarilo sa načítať zápasy: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // Inicializácia
    useEffect(() => {
        const hallId = getHallIdFromURL();
        
        if (hallId) {
            loadHallInfo(hallId);
            loadMatches(hallId);
        } else {
            setError('Parameter hallId nebol nájdený v URL (napr. ?hallId=xyz123)');
            setLoading(false);
        }
    }, []);

    // Zobrazenie načítavania
    if (loading) {
        return React.createElement(
            'div',
            { className: 'flex justify-center items-center py-16' },
            React.createElement('div', { className: 'animate-spin rounded-full h-12 w-12 border-b-4 border-blue-500' })
        );
    }

    // Zobrazenie chyby
    if (error) {
        return React.createElement(
            'div',
            { className: 'bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center' },
            React.createElement('i', { className: 'fa-solid fa-exclamation-triangle text-yellow-500 text-3xl mb-3' }),
            React.createElement('p', { className: 'text-yellow-700' }, error)
        );
    }

    // Zobrazenie zápasov
    return React.createElement(
        'div',
        { className: 'max-w-4xl mx-auto' },
        
        // Hlavička s informáciami o hale
        React.createElement(
            'div',
            { className: 'bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-6 mb-6 text-white' },
            React.createElement('i', { className: 'fa-solid fa-futbol text-3xl mb-2' }),
            React.createElement('h1', { className: 'text-2xl font-bold' }, hallInfo?.name || 'Športová hala'),
            React.createElement('p', { className: 'text-blue-100 mt-1' }, 
                `Počet zápasov: ${matches.length}`
            )
        ),
        
        // Zoznam zápasov
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-md overflow-hidden' },
            React.createElement(
                'div',
                { className: 'bg-gray-50 px-6 py-3 border-b border-gray-200' },
                React.createElement('h2', { className: 'font-semibold text-gray-700' }, 'Rozpis zápasov')
            ),
            
            matches.length === 0 ? 
                React.createElement(
                    'div',
                    { className: 'p-8 text-center text-gray-500' },
                    React.createElement('i', { className: 'fa-solid fa-calendar-xmark text-4xl mb-2 opacity-50' }),
                    React.createElement('p', null, 'Žiadne zápasy')
                ) :
                React.createElement(
                    'div',
                    { className: 'divide-y divide-gray-100' },
                    matches.map((match, index) => React.createElement(
                        'div',
                        { key: match.id, className: 'p-4 hover:bg-gray-50 transition-colors' },
                        React.createElement(
                            'div',
                            { className: 'flex items-center justify-between flex-wrap gap-3' },
                            
                            // Poradové číslo
                            React.createElement(
                                'span',
                                { className: 'text-gray-400 text-sm font-mono w-8' },
                                `${index + 1}.`
                            ),
                            
                            // Čas zápasu
                            React.createElement(
                                'div',
                                { className: 'w-32 text-sm' },
                                React.createElement('i', { className: 'fa-regular fa-clock text-gray-400 mr-1' }),
                                React.createElement('span', { className: match.scheduledTime ? 'text-gray-700' : 'text-gray-400' }, 
                                    formatMatchTime(match.scheduledTime)
                                )
                            ),
                            
                            // Zápas - tímy
                            React.createElement(
                                'div',
                                { className: 'flex-1 flex items-center justify-center gap-3' },
                                React.createElement('span', { className: 'font-semibold text-gray-800 text-right min-w-[150px]' }, 
                                    match.homeTeamIdentifier || '???'
                                ),
                                React.createElement('span', { className: 'text-gray-400 font-bold' }, 'VS'),
                                React.createElement('span', { className: 'font-semibold text-gray-800 text-left min-w-[150px]' }, 
                                    match.awayTeamIdentifier || '???'
                                )
                            ),
                            
                            // Stav
                            React.createElement(
                                'span',
                                { 
                                    className: `text-xs px-2 py-1 rounded-full ${
                                        match.status === 'completed' ? 'bg-green-100 text-green-700' :
                                        match.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                                        'bg-gray-100 text-gray-500'
                                    }` 
                                },
                                match.status === 'completed' ? 'Odohraný' :
                                match.status === 'scheduled' ? 'Naplánovaný' :
                                'Čaká na zaradenie'
                            )
                        ),
                        
                        // Kategória a skupina
                        (match.categoryName || match.groupName) && React.createElement(
                            'div',
                            { className: 'mt-2 flex gap-2 ml-8' },
                            match.categoryName && React.createElement(
                                'span',
                                { className: 'text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full' },
                                match.categoryName
                            ),
                            match.groupName && React.createElement(
                                'span',
                                { className: 'text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full' },
                                match.groupName
                            )
                        )
                    ))
                )
        )
    );
};

// Renderovanie aplikácie
const renderApp = () => {
    const rootElement = document.getElementById('root');
    if (rootElement && ReactDOM) {
        const root = ReactDOM.createRoot(rootElement);
        root.render(React.createElement(MatchesHallApp));
    } else {
        console.error('Root element alebo ReactDOM nebol nájdený');
    }
};

// Počkáme na inicializáciu databázy
if (window.db) {
    renderApp();
} else {
    window.addEventListener('globalDataUpdated', () => {
        if (window.db) {
            renderApp();
        }
    });
    
    // Timeout pre prípad, že by sa udalosť nespustila
    setTimeout(() => {
        if (window.db) {
            renderApp();
        }
    }, 3000);
}
