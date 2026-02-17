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

// Komponent pre pavúkovú tabuľku
const SpiderApp = ({ userProfileData }) => {
    const [categories, setCategories] = useState([]);
    const [matches, setMatches] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [loading, setLoading] = useState(true);
    const [spiderData, setSpiderData] = useState(null);

    // Načítanie kategórií
    useEffect(() => {
        if (!window.db) {
            console.error("Firestore databáza nie je inicializovaná");
            setLoading(false);
            return;
        }

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
                setLoading(false);
            } catch (error) {
                console.error("Chyba pri načítaní kategórií:", error);
                setLoading(false);
            }
        };

        loadCategorySettings();
    }, []);

    // Funkcia na vytvorenie prázdnej štruktúry pavúka
    const generateSpider = () => {
        if (!selectedCategory) {
            window.showGlobalNotification('Vyberte kategóriu', 'error');
            return;
        }

        // Vytvoríme pevnú štruktúru pavúka podľa obrázka
        const spiderStructure = {
            // Štvrťfinále (ak existujú)
            quarterFinals: [
                { id: 'qf1', homeTeam: '---', awayTeam: '---', homeScore: '', awayScore: '', date: null },
                { id: 'qf2', homeTeam: '---', awayTeam: '---', homeScore: '', awayScore: '', date: null },
                { id: 'qf3', homeTeam: '---', awayTeam: '---', homeScore: '', awayScore: '', date: null },
                { id: 'qf4', homeTeam: '---', awayTeam: '---', homeScore: '', awayScore: '', date: null }
            ],
            // Semifinále
            semiFinals: [
                { id: 'sf1', homeTeam: '---', awayTeam: '---', homeScore: '', awayScore: '', date: null },
                { id: 'sf2', homeTeam: '---', awayTeam: '---', homeScore: '', awayScore: '', date: null }
            ],
            // Finále
            final: { id: 'final', homeTeam: '---', awayTeam: '---', homeScore: '', awayScore: '', date: null }
        };

        // Ak máme zápasy pre vybranú kategóriu, použijeme ich
        const categoryMatches = matches.filter(m => m.categoryId === selectedCategory);
        
        if (categoryMatches.length > 0) {
            // Zoradíme zápasy podľa dátumu (ak existuje)
            const sortedMatches = [...categoryMatches].sort((a, b) => {
                const dateA = a.date ? new Date(a.date) : new Date(0);
                const dateB = b.date ? new Date(b.date) : new Date(0);
                return dateA - dateB;
            });

            // Priradíme zápasy do pavúka podľa dostupnosti
            // Toto je len jednoduché mapovanie - v reálnom scenári by ste chceli
            // inteligentnejšie priradenie podľa typu zápasu
            sortedMatches.forEach((match, index) => {
                if (index < 4) {
                    // Prvé 4 zápasy idú do štvrťfinále
                    spiderStructure.quarterFinals[index] = {
                        ...match,
                        homeTeam: match.homeTeamIdentifier || '---',
                        awayTeam: match.awayTeamIdentifier || '---'
                    };
                } else if (index < 6) {
                    // Ďalšie 2 zápasy idú do semifinále
                    spiderStructure.semiFinals[index - 4] = {
                        ...match,
                        homeTeam: match.homeTeamIdentifier || '---',
                        awayTeam: match.awayTeamIdentifier || '---'
                    };
                } else if (index === 6) {
                    // Posledný zápas ide do finále
                    spiderStructure.final = {
                        ...match,
                        homeTeam: match.homeTeamIdentifier || '---',
                        awayTeam: match.awayTeamIdentifier || '---'
                    };
                }
            });
        }

        setSpiderData(spiderStructure);
    };

    // Komponent pre zobrazenie jedného zápasu v pavúkovom zobrazení
    const MatchCell = ({ match, isBold = false }) => {
        const matchDate = match.date ? new Date(match.date) : null;
        const formattedDate = matchDate ? formatDateWithDay(matchDate) : '';
        
        return React.createElement(
            'div',
            { className: 'border border-gray-300 p-2 min-w-[150px] bg-white' },
            // Domáci tím
            React.createElement(
                'div',
                { className: 'flex justify-between items-center border-b border-gray-200 py-1' },
                React.createElement('span', { className: 'text-sm' }, match.homeTeam),
                match.homeScore !== '' && React.createElement('span', { className: 'font-mono font-bold text-sm' }, match.homeScore)
            ),
            // Hosťovský tím
            React.createElement(
                'div',
                { className: 'flex justify-between items-center py-1' },
                React.createElement('span', { className: 'text-sm' }, match.awayTeam),
                match.awayScore !== '' && React.createElement('span', { className: 'font-mono font-bold text-sm' }, match.awayScore)
            ),
            // Dátum (ak existuje)
            formattedDate && React.createElement(
                'div',
                { className: 'text-xs text-gray-500 mt-1 text-center border-t border-gray-100 pt-1' },
                formattedDate
            )
        );
    };

    const sortedCategories = React.useMemo(() => {
        return [...categories].sort((a, b) => a.name.localeCompare(b.name));
    }, [categories]);

    return React.createElement(
        React.Fragment,
        null,
        // Hlavička s ovládacími prvkami
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
                        'Generovať pavúka'
                    ),
                    
                    React.createElement(
                        'button',
                        {
                            onClick: () => {
                                const url = new URL(window.location.href);
                                url.searchParams.set('view', 'matches');
                                window.location.href = url.toString();
                            },
                            className: 'px-4 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors whitespace-nowrap',
                            title: 'Prejsť do zobrazenia zápasov'
                        },
                        'Zápasy'
                    )
                )
            )
        ),

        // Obsah - pavúková tabuľka
        React.createElement(
            'div',
            { className: 'flex-grow flex justify-center items-start w-full pt-24' },
            React.createElement(
                'div',
                { className: 'bg-white p-8 overflow-x-auto', style: { width: '100%', maxWidth: '1200px' } },
                
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
                        { className: 'flex flex-col items-center' },
                        
                        // Hlavná pavúková štruktúra podľa obrázka
                        React.createElement(
                            'div',
                            { className: 'grid grid-cols-4 gap-4 items-center' },
                            
                            // Ľavý stĺpec - Štvrťfinále 1 a 2
                            React.createElement(
                                'div',
                                { className: 'col-span-1 space-y-4' },
                                React.createElement(MatchCell, { match: spiderData.quarterFinals[0] }),
                                React.createElement(MatchCell, { match: spiderData.quarterFinals[1] })
                            ),
                            
                            // Druhý stĺpec - Semifinále 1
                            React.createElement(
                                'div',
                                { className: 'col-span-1 flex items-center justify-center' },
                                React.createElement(MatchCell, { match: spiderData.semiFinals[0], isBold: true })
                            ),
                            
                            // Tretí stĺpec - Finále
                            React.createElement(
                                'div',
                                { className: 'col-span-1 flex items-center justify-center' },
                                React.createElement(MatchCell, { match: spiderData.final, isBold: true })
                            ),
                            
                            // Štvrtý stĺpec - Semifinále 2
                            React.createElement(
                                'div',
                                { className: 'col-span-1 flex items-center justify-center' },
                                React.createElement(MatchCell, { match: spiderData.semiFinals[1], isBold: true })
                            ),
                            
                            // Druhý riadok - Štvrťfinále 3 a 4 (posunuté nižšie)
                            React.createElement(
                                'div',
                                { className: 'col-span-1 space-y-4 row-start-2' },
                                React.createElement(MatchCell, { match: spiderData.quarterFinals[2] }),
                                React.createElement(MatchCell, { match: spiderData.quarterFinals[3] })
                            ),
                            
                            // Prázdne bunky pre zachovanie štruktúry
                            React.createElement('div', { className: 'col-span-1 row-start-2' }),
                            React.createElement('div', { className: 'col-span-1 row-start-2' }),
                            React.createElement('div', { className: 'col-span-1 row-start-2' })
                        ),
                        
                        // Legenda
                        React.createElement(
                            'div',
                            { className: 'mt-8 text-sm text-gray-500 border-t pt-4 w-full text-center' },
                            React.createElement('p', null, '--- označuje nezapojený tím alebo voľný žreb')
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
