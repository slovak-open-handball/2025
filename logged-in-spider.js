// logged-in-spider.js (upravený - symetrické rozloženie)
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

// Komponent pre modálne okno
const CategoryModal = ({ isOpen, onClose, onGenerate, categories }) => {
    const [selectedCategory, setSelectedCategory] = useState('');

    if (!isOpen) return null;

    const sortedCategories = [...categories].sort((a, b) => a.name.localeCompare(b.name));

    const handleGenerate = () => {
        if (!selectedCategory) {
            window.showGlobalNotification('Vyberte kategóriu', 'error');
            return;
        }
        onGenerate(selectedCategory);
        onClose();
        setSelectedCategory('');
    };

    // Zabránenie zatvoreniu pri kliknutí dovnútra modalu
    const handleModalClick = (e) => {
        e.stopPropagation();
    };

    return React.createElement(
        'div',
        {
            className: 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center',
            onClick: onClose,
            style: { backdropFilter: 'blur(4px)' }
        },
        React.createElement(
            'div',
            {
                className: 'bg-white rounded-xl p-6 w-full max-w-md shadow-2xl',
                onClick: handleModalClick
            },
            // Hlavička
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mb-4' },
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'text-gray-400 hover:text-gray-600 transition-colors'
                    },
                    React.createElement('i', { className: 'fa-solid fa-times text-2xl' })
                )
            ),
            
            // Výber kategórie
            React.createElement(
                'div',
                { className: 'mb-6' },
                React.createElement(
                    'label',
                    { className: 'block text-sm font-medium text-gray-700 mb-2' },
                    'Kategória:'
                ),
                React.createElement(
                    'select',
                    {
                        value: selectedCategory,
                        onChange: (e) => {
                            setSelectedCategory(e.target.value);
                            e.target.blur();
                        },
                        className: 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-black'
                    },
                    React.createElement('option', { value: '' }, '-- Vyberte kategóriu --'),
                    sortedCategories.map(cat => 
                        React.createElement('option', { key: cat.id, value: cat.id }, cat.name)
                    )
                )
            ),
            
            // Tlačidlá
            React.createElement(
                'div',
                { className: 'flex justify-end gap-2' },
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors'
                    },
                    'Zrušiť'
                ),
                React.createElement(
                    'button',
                    {
                        onClick: handleGenerate,
                        disabled: !selectedCategory,
                        className: `px-4 py-2 text-sm rounded-lg transition-colors ${
                            !selectedCategory
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'bg-green-600 hover:bg-green-700 text-white'
                        }`
                    },
                    'Generovať'
                )
            )
        )
    );
};

// Komponent pre pavúkovú tabuľku
const SpiderApp = ({ userProfileData }) => {
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [loading, setLoading] = useState(true);
    const [spiderData, setSpiderData] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Definícia isFilterActive - filter je aktívny, ak je vybratá nejaká kategória
    const isFilterActive = selectedCategory !== '';

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

    // Funkcia na vytvorenie štruktúry pavúka
    const generateSpider = (categoryId) => {
        if (!categoryId) {
            window.showGlobalNotification('Vyberte kategóriu', 'error');
            return;
        }

        // Vytvoríme len prázdnu štruktúru pavúka - ŽIADNE priraďovanie tímov
        const spiderStructure = {
            // Finále (teraz je prvé - hore)
            final: { id: 'final', homeTeam: '---', awayTeam: '---', homeScore: '', awayScore: '', date: null },
            // Semifinále
            semiFinals: [
                { id: 'sf1', homeTeam: '---', awayTeam: '---', homeScore: '', awayScore: '', date: null },
                { id: 'sf2', homeTeam: '---', awayTeam: '---', homeScore: '', awayScore: '', date: null }
            ],
            // Zápas o 3. miesto
            thirdPlace: { id: 'third', homeTeam: '---', awayTeam: '---', homeScore: '', awayScore: '', date: null }
        };

        setSelectedCategory(categoryId);
        setSpiderData(spiderStructure);
    };

    // Komponent pre zobrazenie jedného zápasu v pavúkovom zobrazení
    const MatchCell = ({ match, title = '' }) => {
        const matchDate = match.date ? new Date(match.date) : null;
        const formattedDate = matchDate ? formatDateWithDay(matchDate) : '';
        
        return React.createElement(
            'div',
            { 
                className: 'border-2 border-gray-300 rounded-lg p-3 min-w-[220px] bg-white shadow-sm',
                'data-match-id': match.id,
                style: { zIndex: 10, position: 'relative' }
            },
            // Nadpis (ak existuje)
            title && React.createElement(
                'div',
                { className: 'text-sm font-semibold text-center mb-2 pb-1 border-b border-gray-200' },
                title
            ),
            // Domáci tím
            React.createElement(
                'div',
                { className: 'flex justify-between items-center py-2 border-b border-gray-100' },
                React.createElement('span', { className: 'text-sm font-medium' }, match.homeTeam),
                match.homeScore !== '' && React.createElement('span', { className: 'font-mono font-bold text-lg' }, match.homeScore)
            ),
            // Hosťovský tím
            React.createElement(
                'div',
                { className: 'flex justify-between items-center py-2' },
                React.createElement('span', { className: 'text-sm font-medium' }, match.awayTeam),
                match.awayScore !== '' && React.createElement('span', { className: 'font-mono font-bold text-lg' }, match.awayScore)
            ),
            // Dátum (ak existuje)
            formattedDate && React.createElement(
                'div',
                { className: 'text-xs text-gray-500 mt-2 text-center border-t border-gray-100 pt-2' },
                React.createElement('i', { className: 'fa-regular fa-calendar mr-1' }),
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
        // Modálne okno pre výber kategórie
        React.createElement(CategoryModal, {
            isOpen: isModalOpen,
            onClose: () => setIsModalOpen(false),
            onGenerate: generateSpider,
            categories: categories
        }),

        // Hlavička s ovládacími prvkami - opravená pre hover
        React.createElement(
            'div',
            { 
                className: 'fixed top-12 left-0 right-0 z-40 flex flex-col items-center pt-4',
                style: { pointerEvents: 'none' }
            },
            React.createElement(
                'div',
                { 
                    className: 'group relative',
                    style: { pointerEvents: 'auto' }
                },
                // Hlavný panel s ovládacími prvkami
                React.createElement(
                    'div',
                    { 
                        className: `transition-opacity duration-300 ease-in-out opacity-0 group-hover:opacity-100 group-focus-within:opacity-100`,
                        style: { 
                            pointerEvents: 'auto',
                            transition: 'opacity 300ms ease-in-out'
                        },
                        onMouseLeave: (e) => {
                            // Nastavíme timeout na skrytie po 750ms
                            const timeoutId = setTimeout(() => {
                                // Skontrolujeme, či myš nie je stále nad elementom
                                const panel = e.currentTarget;
                                const hoveredElement = document.querySelector(':hover');
                                
                                // Ak nie je žiadny hoverovaný element ALEBO panel neobsahuje hoverovaný element
                                if (!hoveredElement || !panel.contains(hoveredElement)) {
                                    panel.style.opacity = '0';
                                }
                            }, 750);
                            
                            // Uložíme timeout ID do dataset pre prípadné zrušenie
                            e.currentTarget.dataset.hideTimeout = timeoutId;
                        },
                        onMouseEnter: (e) => {
                            // Zrušíme timeout ak existuje
                            const timeoutId = e.currentTarget.dataset.hideTimeout;
                            if (timeoutId) {
                                clearTimeout(parseInt(timeoutId));
                                delete e.currentTarget.dataset.hideTimeout;
                            }
                            // Nastavíme opacity na 1 (zabezpečíme viditeľnosť)
                            e.currentTarget.style.opacity = '1';
                        }
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
                                    onChange: (e) => {
                                        setSelectedCategory(e.target.value);
                                        // Odstránime focus z selectboxu po výbere
                                        e.target.blur();
                                        
                                        // Spustíme timeout na skrytie panelu po 750ms
                                        const panel = e.currentTarget.closest('[style*="pointer-events: auto"]');
                                        if (panel) {
                                            const timeoutId = setTimeout(() => {
                                                const hoveredElement = document.querySelector(':hover');
                                                if (!hoveredElement || !panel.contains(hoveredElement)) {
                                                    panel.style.opacity = '0';
                                                }
                                            }, 750);
                                            
                                            // Uložíme timeout ID pre prípadné zrušenie pri mouseEnter
                                            panel.dataset.hideTimeout = timeoutId;
                                        }
                                    },
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
            )
        ),
                
        // Zelené kruhové tlačidlo "+" v pravom dolnom rohu
        React.createElement(
            'button',
            {
                onClick: () => setIsModalOpen(true),
                className: 'fixed bottom-6 right-6 w-14 h-14 bg-green-500 hover:bg-green-600 text-white rounded-full shadow-lg flex items-center justify-center text-3xl font-bold transition-all hover:scale-110 z-50',
                title: 'Generovať pavúka'
            },
            '+'
        ),

        // Obsah - pavúková tabuľka
        React.createElement(
            'div',
            { className: 'flex-grow flex justify-center items-start w-full pt-24 pb-20' },
            React.createElement(
                'div',
                { className: 'bg-white p-8', style: { width: '100%', maxWidth: '1200px' } },
                
                !spiderData ? (
                    React.createElement(
                        'div',
                        { className: 'text-center py-16 text-gray-500' },
                        React.createElement('i', { className: 'fa-solid fa-sitemap text-6xl mb-4 opacity-30' }),
                        React.createElement('h2', { className: 'text-2xl font-semibold mb-2' }, 'Pavúk play-off'),
                        React.createElement('p', { className: 'text-lg' }, 'Kliknite na zelené tlačidlo "+" pre generovanie pavúka')
                    )
                ) : (
                    React.createElement(
                        'div',
                        { className: 'flex flex-col items-center relative' },
                        
                        // Nadpis
                        React.createElement(
                            'h2',
                            { className: 'text-2xl font-bold mb-12 text-gray-800' },
                            `Play-off - ${categories.find(c => c.id === selectedCategory)?.name || selectedCategory}`
                        ),
                        
                        // Pavúková štruktúra
                        React.createElement(
                            'div',
                            { 
                                className: 'flex flex-col items-center w-full relative py-8'
                            },
                            
                            // ZVISLÁ ČIARA - upravená, aby začínala pod finále a končila nad 3. miestom
                            React.createElement(
                                'div',
                                { 
                                    className: 'absolute w-0.5 bg-gray-400',
                                    style: { 
                                        left: '50%',
                                        top: '100px', // Začína pod finálovým boxom
                                        bottom: '100px', // Končí nad boxom o 3. miesto
                                        transform: 'translateX(-50%)',
                                        zIndex: 1
                                    }
                                }
                            ),
                            
                            // FINÁLE - hore
                            React.createElement(
                                'div',
                                { className: 'relative z-10 mt-8' },
                                React.createElement(MatchCell, { 
                                    match: spiderData.final, 
                                    title: 'Finále'
                                })
                            ),
                            
                            // Semifinále - vedľa seba (v strede)
                            React.createElement(
                                'div',
                                { 
                                    className: 'flex justify-center items-center gap-16 w-full relative z-10 mt-8'
                                },
                                
                                // Semifinále 1
                                React.createElement(MatchCell, { 
                                    match: spiderData.semiFinals[0], 
                                    title: 'Semifinále 1'
                                }),
                                                                
                                 // VODOROVNÁ ČIARA - upravená na presné rozmery boxov
                                    React.createElement(
                                        React.Fragment,
                                        null,
                                        // Čiara z pravej strany SF1 do stredu
                                        React.createElement(
                                            'div',
                                            { 
                                                className: 'absolute h-0.5 bg-gray-400',
                                                style: { 
                                                    left: 'calc(50% - 110px)', // Začína na úrovni pravej strany ľavého boxu (220px/2 = 110px od stredu)
                                                    width: '110px', // Dĺžka od pravej strany boxu do stredu
                                                    top: '50%',
                                                    marginTop: '-1px',
                                                    zIndex: 5
                                                }
                                            }
                                        ),
                                        // Čiara zo stredu k ľavej strane SF2
                                        React.createElement(
                                            'div',
                                            { 
                                                className: 'absolute h-0.5 bg-gray-400',
                                                style: { 
                                                    left: '50%', // Začína v strede
                                                    width: '110px', // Dĺžka od stredu k ľavej strane pravého boxu
                                                    top: '50%',
                                                    marginTop: '-1px',
                                                    zIndex: 5
                                                }
                                            }
                                        )
                                    ),
                                                                
                                // Semifinále 2
                                React.createElement(MatchCell, { 
                                    match: spiderData.semiFinals[1], 
                                    title: 'Semifinále 2'
                                })
                            ),
                            
                            // Zápas o 3. miesto - dole
                            React.createElement(
                                'div',
                                { className: 'relative z-10 mt-8 mb-8' },
                                React.createElement(MatchCell, { 
                                    match: spiderData.thirdPlace, 
                                    title: 'O 3. miesto'
                                })
                            )
                        ),
                        
                        // Legenda
                        React.createElement(
                            'div',
                            { className: 'mt-12 text-sm text-gray-500 border-t pt-4 w-full text-center' },
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
