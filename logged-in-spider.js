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

// Komponent pre pavúkovú tabuľku
const SpiderApp = ({ userProfileData }) => {
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [loading, setLoading] = useState(true);
    const [spiderData, setSpiderData] = useState(null);
    const [allMatches, setAllMatches] = useState([]); // Všetky zápasy z databázy (aj bežné, aj pavúkové)
    const [isSelectOpen, setIsSelectOpen] = useState(false);
    const [generationInProgress, setGenerationInProgress] = useState(false);
    const [isDeleteMatchesModalOpen, setIsDeleteMatchesModalOpen] = useState(false);

    // Definícia isFilterActive - filter je aktívny, ak je vybratá nejaká kategória
    const isFilterActive = selectedCategory !== '';

    // Načítanie kategórií a všetkých zápasov
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

        // Načítanie VŠETKÝCH zápasov z Firebase (kolekcia 'matches')
        const loadAllMatches = () => {
            const matchesRef = collection(window.db, 'matches');
            
            const unsubscribe = onSnapshot(matchesRef, (snapshot) => {
                const loadedMatches = [];
                snapshot.forEach((doc) => {
                    loadedMatches.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
                setAllMatches(loadedMatches);
                console.log('Načítané všetky zápasy:', loadedMatches.length);
            }, (error) => {
                console.error('Chyba pri načítaní zápasov:', error);
            });

            return unsubscribe;
        };

        loadCategorySettings();
        const unsubscribe = loadAllMatches();

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, []);

    // Načítanie pavúka pre vybranú kategóriu
    useEffect(() => {
        if (selectedCategory && allMatches.length > 0) {
            // Filtrujeme LEN pavúkové zápasy pre vybranú kategóriu (podľa matchType)
            const spiderMatches = allMatches.filter(m => 
                m.categoryId === selectedCategory && 
                m.matchType && // Iba zápasy, ktoré majú matchType
                ['finále', 'semifinále 1', 'semifinále 2', 'o 3. miesto'].includes(m.matchType)
            );
            
            console.log('Nájdené pavúkové zápasy pre kategóriu:', spiderMatches);
            
            if (spiderMatches.length >= 4) { // Očakávame 4 zápasy
                // Vytvoríme štruktúru z existujúcich zápasov
                const spiderStructure = {
                    final: spiderMatches.find(m => m.matchType === 'finále') || { 
                        id: 'final', 
                        homeTeam: '---', 
                        awayTeam: '---', 
                        homeScore: '', 
                        awayScore: '', 
                        date: null 
                    },
                    semiFinals: [
                        spiderMatches.find(m => m.matchType === 'semifinále 1') || { 
                            id: 'sf1', 
                            homeTeam: '---', 
                            awayTeam: '---', 
                            homeScore: '', 
                            awayScore: '', 
                            date: null 
                        },
                        spiderMatches.find(m => m.matchType === 'semifinále 2') || { 
                            id: 'sf2', 
                            homeTeam: '---', 
                            awayTeam: '---', 
                            homeScore: '', 
                            awayScore: '', 
                            date: null 
                        }
                    ],
                    thirdPlace: spiderMatches.find(m => m.matchType === 'o 3. miesto') || { 
                        id: 'third', 
                        homeTeam: '---', 
                        awayTeam: '---', 
                        homeScore: '', 
                        awayScore: '', 
                        date: null 
                    }
                };
                
                setSpiderData(spiderStructure);
            } else {
                // Žiadne pavúkové zápasy pre túto kategóriu
                setSpiderData(null);
            }
        } else if (selectedCategory) {
            // Žiadne zápasy vôbec
            setSpiderData(null);
        }
    }, [selectedCategory, allMatches]);

    // Funkcia na vytvorenie štruktúry pavúka a uloženie do databázy (do kolekcie 'matches')
    const generateSpider = async () => {
        const categoryId = selectedCategory;
        
        if (!categoryId) {
            window.showGlobalNotification('Vyberte kategóriu', 'error');
            return;
        }
    
        if (!window.db) {
            window.showGlobalNotification('Databáza nie je inicializovaná', 'error');
            return;
        }
    
        if (userProfileData?.role !== 'admin') {
            window.showGlobalNotification('Na generovanie pavúka potrebujete administrátorské práva', 'error');
            return;
        }
    
        setGenerationInProgress(true);
        
        try {
            // Najprv vymažeme existujúce pavúkové zápasy pre túto kategóriu (ak existujú)
            const existingSpiderMatches = allMatches.filter(m => 
                m.categoryId === categoryId && 
                m.matchType && // Iba zápasy, ktoré majú matchType
                ['finále', 'semifinále 1', 'semifinále 2', 'o 3. miesto'].includes(m.matchType)
            );
            
            for (const match of existingSpiderMatches) {
                await deleteDoc(doc(window.db, 'matches', match.id));
            }
    
            // Získanie názvu kategórie
            const category = categories.find(c => c.id === categoryId);
            const categoryName = category ? category.name : `Kategória ${categoryId}`;
            
            // Odstránenie diakritiky z názvu kategórie pre identifikátory
            const categoryWithoutDiacritics = categoryName
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, ''); // odstráni diakritiku, ale zachová medzery
            
            // Vytvoríme zápasy pre databázu (do kolekcie 'matches')
            const matchesToSave = [
                // Semifinále 1
                {
                    homeTeamIdentifier: '---',
                    awayTeamIdentifier: '---',
                    time: '--:--',
                    hallId: null,
                    categoryId: categoryId,
                    categoryName: categoryName,
                    groupName: null,
                    matchType: 'semifinále 1',
                    status: 'pending',
                    createdAt: Timestamp.now(),
                    createdBy: userProfileData?.email || 'unknown',
                    createdByUid: userProfileData?.uid || null
                },
                // Semifinále 2
                {
                    homeTeamIdentifier: '---',
                    awayTeamIdentifier: '---',
                    time: '--:--',
                    hallId: null,
                    categoryId: categoryId,
                    categoryName: categoryName,
                    groupName: null,
                    matchType: 'semifinále 2',
                    status: 'pending',
                    createdAt: Timestamp.now(),
                    createdBy: userProfileData?.email || 'unknown',
                    createdByUid: userProfileData?.uid || null
                },
                // Finále
                {
                    homeTeamIdentifier: `${categoryWithoutDiacritics} WSF01`,
                    awayTeamIdentifier: `${categoryWithoutDiacritics} WSF02`,
                    time: '--:--',
                    hallId: null,
                    categoryId: categoryId,
                    categoryName: categoryName,
                    groupName: null,
                    matchType: 'finále',
                    status: 'pending',
                    createdAt: Timestamp.now(),
                    createdBy: userProfileData?.email || 'unknown',
                    createdByUid: userProfileData?.uid || null
                },
                // o 3. miesto
                {
                    homeTeamIdentifier: `${categoryWithoutDiacritics} LSF01`,
                    awayTeamIdentifier: `${categoryWithoutDiacritics} LSF02`,
                    time: '--:--',
                    hallId: null,
                    categoryId: categoryId,
                    categoryName: categoryName,
                    groupName: null,
                    matchType: 'o 3. miesto',
                    status: 'pending',
                    createdAt: Timestamp.now(),
                    createdBy: userProfileData?.email || 'unknown',
                    createdByUid: userProfileData?.uid || null
                }
            ];
    
            // Uložíme zápasy do Firebase
            const matchesRef = collection(window.db, 'matches');
            
            const savedMatches = [];
            for (const match of matchesToSave) {
                const docRef = await addDoc(matchesRef, match);
                savedMatches.push({
                    id: docRef.id,
                    ...match
                });
            }
    
            // Vytvoríme lokálnu štruktúru pre zobrazenie
            const spiderStructure = {
                final: { 
                    id: savedMatches.find(m => m.matchType === 'finále')?.id || 'final',
                    homeTeam: `${categoryWithoutDiacritics} WSF01`,
                    awayTeam: `${categoryWithoutDiacritics} WSF02`,
                    homeScore: '', 
                    awayScore: '', 
                    date: null 
                },
                semiFinals: [
                    { 
                        id: savedMatches.find(m => m.matchType === 'semifinále 1')?.id || 'sf1',
                        homeTeam: '---', 
                        awayTeam: '---', 
                        homeScore: '', 
                        awayScore: '', 
                        date: null 
                    },
                    { 
                        id: savedMatches.find(m => m.matchType === 'semifinále 2')?.id || 'sf2',
                        homeTeam: '---', 
                        awayTeam: '---', 
                        homeScore: '', 
                        awayScore: '', 
                        date: null 
                    }
                ],
                thirdPlace: { 
                    id: savedMatches.find(m => m.matchType === 'o 3. miesto')?.id || 'third',
                    homeTeam: `${categoryWithoutDiacritics} LSF01`,
                    awayTeam: `${categoryWithoutDiacritics} LSF02`,
                    homeScore: '', 
                    awayScore: '', 
                    date: null 
                }
            };
    
            setSpiderData(spiderStructure);
            
            window.showGlobalNotification(`Pavúk bol úspešne vygenerovaný a uložených ${savedMatches.length} zápasov do databázy`, 'success');
    
        } catch (error) {
            console.error('Chyba pri generovaní pavúka:', error);
            window.showGlobalNotification('Chyba pri generovaní pavúka: ' + error.message, 'error');
        } finally {
            setGenerationInProgress(false);
        }
    };

    // Funkcia na vymazanie pavúkových zápasov pre vybranú kategóriu
    const deleteSpiderMatches = async () => {
        const categoryId = selectedCategory;
        
        if (!categoryId) {
            window.showGlobalNotification('Vyberte kategóriu', 'error');
            return;
        }
    
        if (!window.db) {
            window.showGlobalNotification('Databáza nie je inicializovaná', 'error');
            return;
        }
    
        if (userProfileData?.role !== 'admin') {
            window.showGlobalNotification('Na mazanie pavúka potrebujete administrátorské práva', 'error');
            return;
        }
    
        setGenerationInProgress(true);
        
        try {
            // Nájdeme existujúce pavúkové zápasy pre túto kategóriu
            const existingSpiderMatches = allMatches.filter(m => 
                m.categoryId === categoryId && 
                m.matchType && 
                ['finále', 'semifinále 1', 'semifinále 2', 'o 3. miesto'].includes(m.matchType)
            );
            
            if (existingSpiderMatches.length === 0) {
                window.showGlobalNotification('Pre túto kategóriu neexistujú žiadne pavúkové zápasy', 'info');
                return;
            }
            
            // Vymažeme všetky nájdené zápasy
            for (const match of existingSpiderMatches) {
                await deleteDoc(doc(window.db, 'matches', match.id));
            }
    
            setSpiderData(null);
            
            window.showGlobalNotification(`Úspešne zmazaných ${existingSpiderMatches.length} pavúkových zápasov`, 'success');
    
        } catch (error) {
            console.error('Chyba pri mazaní pavúka:', error);
            window.showGlobalNotification('Chyba pri mazaní pavúka: ' + error.message, 'error');
        } finally {
            setGenerationInProgress(false);
            setIsDeleteMatchesModalOpen(false);
        }
    };

    // Funkcia na kontrolu, či máme skryť panel
    const shouldHidePanel = () => {
        // Ak je selectbox rozbalený, panel neskrývame
        if (isSelectOpen) {
            return false;
        }
        
        // Ináč použijeme štandardnú kontrolu hoveru
        const hoveredElement = document.querySelector(':hover');
        const panel = document.querySelector('[style*="pointer-events: auto"]');
        
        return !(hoveredElement !== null && panel && (hoveredElement === panel || panel.contains(hoveredElement)));
    };

    // Komponent pre zobrazenie jedného zápasu v pavúkovom zobrazení
    const MatchCell = ({ match, title = '' }) => {
        const matchDate = match.date ? new Date(match.date) : null;
        const formattedDate = matchDate ? formatDateWithDay(matchDate) : '';
        
        // Použijeme homeTeamIdentifier a awayTeamIdentifier ak existujú, inak homeTeam/awayTeam
        const homeTeam = match.homeTeamIdentifier || match.homeTeam || '---';
        const awayTeam = match.awayTeamIdentifier || match.awayTeam || '---';
        const homeScore = match.homeScore !== undefined ? match.homeScore : '';
        const awayScore = match.awayScore !== undefined ? match.awayScore : '';
        
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
                React.createElement('span', { className: 'text-sm font-medium' }, homeTeam),
                homeScore !== '' && React.createElement('span', { className: 'font-mono font-bold text-lg' }, homeScore)
            ),
            // Hosťovský tím
            React.createElement(
                'div',
                { className: 'flex justify-between items-center py-2' },
                React.createElement('span', { className: 'text-sm font-medium' }, awayTeam),
                awayScore !== '' && React.createElement('span', { className: 'font-mono font-bold text-lg' }, awayScore)
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
                            const panel = e.currentTarget.closest('[style*="pointer-events: auto"]');
                            if (panel) {
                                if (window.spiderPanelTimeout) {
                                    clearTimeout(window.spiderPanelTimeout);
                                }
                                
                                window.spiderPanelTimeout = setTimeout(() => {
                                    if (shouldHidePanel()) {
                                        panel.style.opacity = '0';
                                    }
                                    window.spiderPanelTimeout = null;
                                }, 750);
                            }
                        },
                        onMouseEnter: (e) => {
                            if (window.spiderPanelTimeout) {
                                clearTimeout(window.spiderPanelTimeout);
                                window.spiderPanelTimeout = null;
                            }
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
                                        e.target.blur();
                                        
                                        const panel = e.currentTarget.closest('[style*="pointer-events: auto"]');
                                        if (panel) {
                                            if (window.spiderPanelTimeout) {
                                                clearTimeout(window.spiderPanelTimeout);
                                            }
        
                                            window.spiderPanelTimeout = setTimeout(() => {
                                                if (shouldHidePanel()) {
                                                    panel.style.opacity = '0';
                                                }
                                                window.spiderPanelTimeout = null;
                                            }, 750);
                                        }
                                    },
                                    onMouseEnter: (e) => {
                                        if (window.spiderPanelTimeout) {
                                            clearTimeout(window.spiderPanelTimeout);
                                            window.spiderPanelTimeout = null;
                                        }
                                        
                                        const panel = e.currentTarget.closest('[style*="pointer-events: auto"]');
                                        if (panel) {
                                            panel.style.opacity = '1';
                                        }
                                    },
                                    onMouseLeave: (e) => {
                                        const panel = e.currentTarget.closest('[style*="pointer-events: auto"]');
                                        if (panel) {
                                            if (window.spiderPanelTimeout) {
                                                clearTimeout(window.spiderPanelTimeout);
                                            }
                                            
                                            window.spiderPanelTimeout = setTimeout(() => {
                                                if (shouldHidePanel()) {
                                                    panel.style.opacity = '0';
                                                }
                                                window.spiderPanelTimeout = null;
                                            }, 750);
                                        }
                                    },
                                    onFocus: () => setIsSelectOpen(true),
                                    onBlur: () => setIsSelectOpen(false),
                                    onMouseDown: () => setIsSelectOpen(true),
                                    className: 'px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-black min-w-[180px]'
                                },
                                React.createElement('option', { value: '' }, '-- Vyberte kategóriu --'),
                                sortedCategories.map(cat => {
                                    const spiderMatches = allMatches.filter(m => 
                                        m.categoryId === cat.id && 
                                        m.matchType && 
                                        ['finále', 'semifinále 1', 'semifinále 2', 'o 3. miesto'].includes(m.matchType)
                                    ).length;
                                    
                                    return React.createElement('option', { 
                                        key: cat.id, 
                                        value: cat.id 
                                    }, `${cat.name} (${spiderMatches > 0 ? spiderMatches/4 : 0} pavúkov)`);
                                })
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
                                onMouseEnter: (e) => {
                                    if (window.spiderPanelTimeout) {
                                        clearTimeout(window.spiderPanelTimeout);
                                        window.spiderPanelTimeout = null;
                                    }
                                    
                                    const panel = e.currentTarget.closest('[style*="pointer-events: auto"]');
                                    if (panel) {
                                        panel.style.opacity = '1';
                                    }
                                },
                                onMouseLeave: (e) => {
                                    const panel = e.currentTarget.closest('[style*="pointer-events: auto"]');
                                    if (panel) {
                                        if (window.spiderPanelTimeout) {
                                            clearTimeout(window.spiderPanelTimeout);
                                        }
        
                                        window.spiderPanelTimeout = setTimeout(() => {
                                            if (shouldHidePanel()) {
                                                panel.style.opacity = '0';
                                            }
                                            window.spiderPanelTimeout = null;
                                        }, 750);
                                    }
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
                
        // NOVÉ: Rozdelené kruhové tlačidlo v pravom dolnom rohu - TEXT V POLOVICIACH
        React.createElement(
            'div',
            { 
                className: 'fixed bottom-8 right-8 z-50',
                style: { 
                    filter: 'drop-shadow(0 10px 15px rgba(0,0,0,0.2))',
                    width: '64px',
                    height: '64px'
                }
            },
            // Hlavný kruhový kontajner
            React.createElement(
                'div',
                {
                    className: 'relative w-full h-full rounded-full overflow-hidden',
                },
                // Prvá polovica - Zelená (Generovať) - s textom "+" v ľavom hornom rohu
                React.createElement(
                    'button',
                    { 
                        className: `absolute inset-0 transition-all duration-200 outline-none ring-0 focus:outline-none focus:ring-0 ${
                            generationInProgress || !selectedCategory 
                                ? 'bg-white cursor-not-allowed' 
                                : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700'
                        }`,
                        style: { 
                            clipPath: 'polygon(0 0, 100% 0, 0 100%)',
                        },
                        onClick: generateSpider,
                        disabled: generationInProgress || !selectedCategory,
                        title: !selectedCategory ? 'Najprv vyberte kategóriu' : 'Generovať pavúka'
                    },
                    React.createElement(
                        'div',
                        {
                            style: {
                                position: 'absolute',
                                inset: 0,
                                boxShadow: !selectedCategory && !generationInProgress ? 'inset 0 0 0 2px rgb(34 197 94)' : 'none',
                                borderRadius: '50%',
                                pointerEvents: 'none'
                            }
                        }
                    ),
                    // Pridanie dvoch šikmých čiar pre zablokovaný stav
                    !selectedCategory && !generationInProgress && React.createElement(
                        React.Fragment,
                        null,
                        // Zelená čiara
                        React.createElement('div', {
                            style: {
                                position: 'absolute',
                                top: '-2px',
                                right: '-2px',
                                width: '100%',
                                height: '100%',
                                background: 'linear-gradient(135deg, transparent calc(50% - 1px), rgb(34 197 94) calc(50% - 1px), rgb(34 197 94) calc(50% + 1px), transparent calc(50% + 1px))',
                                pointerEvents: 'none',
                                transform: 'rotate(45deg)',
                                transformOrigin: 'center',
                                zIndex: 20
                            }
                        }),
                        // Červená čiara
                        React.createElement('div', {
                            style: {
                                position: 'absolute',
                                top: '-2px',
                                right: '-2px',
                                width: '100%',
                                height: '100%',
                                background: 'linear-gradient(135deg, transparent calc(50% - 1px), rgb(239 68 68) calc(50% - 1px), rgb(239 68 68) calc(50% + 1px), transparent calc(50% + 1px))',
                                pointerEvents: 'none',
                                transform: 'rotate(45deg) translateX(2px)',
                                transformOrigin: 'center',
                                zIndex: 21
                            }
                        })
                    ),
                    React.createElement(
                        'span',
                        {
                            style: {
                                position: 'absolute',
                                top: '8px',
                                left: '10px',
                                fontSize: '28px',
                                fontWeight: 'bold',
                                lineHeight: 1,
                                color: !selectedCategory || generationInProgress ? 'rgb(34 197 94)' : 'white',
                                zIndex: !selectedCategory && !generationInProgress ? 22 : 'auto'
                            }
                        },
                        '+'
                    )
                ),
                // Druhá polovica - Červená (Zmazať) - s textom "-" v pravom dolnom rohu
                React.createElement(
                    'button',
                    { 
                        className: `absolute inset-0 transition-all duration-200 outline-none ring-0 focus:outline-none focus:ring-0 ${
                            generationInProgress || !selectedCategory 
                                ? 'bg-white cursor-not-allowed' 
                                : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
                        }`,
                        style: { 
                            clipPath: 'polygon(100% 0, 100% 100%, 0 100%)',
                        },
                        onClick: () => {
                            if (selectedCategory && !generationInProgress) {
                                setIsDeleteMatchesModalOpen(true);
                            }
                        },
                        disabled: generationInProgress || !selectedCategory,
                        title: !selectedCategory ? 'Najprv vyberte kategóriu' : 'Zmazať pavúka'
                    },
                    React.createElement(
                        'div',
                        {
                            style: {
                                position: 'absolute',
                                inset: 0,
                                boxShadow: !selectedCategory && !generationInProgress ? 'inset 0 0 0 2px rgb(239 68 68)' : 'none',
                                borderRadius: '50%',
                                pointerEvents: 'none'
                            }
                        }
                    ),
                    React.createElement(
                        'span',
                        {
                            style: {
                                position: 'absolute',
                                bottom: '10px',
                                right: '12px',
                                fontSize: '28px',
                                fontWeight: 'bold',
                                lineHeight: 1,
                                color: !selectedCategory || generationInProgress ? 'rgb(239 68 68)' : 'white'
                            }
                        },
                        '-'
                    )
                )
            )
        ),

        // Modálne okno pre potvrdenie mazania
        isDeleteMatchesModalOpen && React.createElement(
            'div',
            {
                className: 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center',
                onClick: () => setIsDeleteMatchesModalOpen(false),
                style: { backdropFilter: 'blur(4px)' }
            },
            React.createElement(
                'div',
                {
                    className: 'bg-white rounded-xl p-6 w-full max-w-md shadow-2xl',
                    onClick: (e) => e.stopPropagation()
                },
                React.createElement(
                    'div',
                    { className: 'flex justify-between items-center mb-4' },
                    React.createElement(
                        'h3',
                        { className: 'text-xl font-semibold text-gray-800' },
                        'Potvrdenie zmazania'
                    ),
                    React.createElement(
                        'button',
                        {
                            onClick: () => setIsDeleteMatchesModalOpen(false),
                            className: 'text-gray-400 hover:text-gray-600 transition-colors'
                        },
                        React.createElement('i', { className: 'fa-solid fa-times text-2xl' })
                    )
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-600 mb-6' },
                    `Naozaj chcete zmazať všetky pavúkové zápasy pre kategóriu "${categories.find(c => c.id === selectedCategory)?.name || selectedCategory}"?`
                ),
                React.createElement(
                    'div',
                    { className: 'flex justify-end gap-2' },
                    React.createElement(
                        'button',
                        {
                            onClick: () => setIsDeleteMatchesModalOpen(false),
                            className: 'px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors'
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            onClick: deleteSpiderMatches,
                            disabled: generationInProgress,
                            className: `px-4 py-2 text-sm rounded-lg transition-colors ${
                                generationInProgress
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    : 'bg-red-600 hover:bg-red-700 text-white'
                            }`
                        },
                        generationInProgress ? 'Mažem...' : 'Zmazať'
                    )
                )
            )
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
                        React.createElement('p', { className: 'text-lg' }, 'Vyberte kategóriu a kliknite na zelenú polovicu tlačidla "+" pre generovanie pavúka')
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
                            
                            // ZVISLÁ ČIARA
                            React.createElement(
                                'div',
                                { 
                                    className: 'absolute w-0.5 bg-gray-400',
                                    style: { 
                                        left: '50%',
                                        top: '100px',
                                        bottom: '100px',
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
                                                                
                                // VODOROVNÁ ČIARA
                                React.createElement(
                                    React.Fragment,
                                    null,
                                    // Čiara z pravej strany SF1 do stredu
                                    React.createElement(
                                        'div',
                                        { 
                                            className: 'absolute h-0.5 bg-gray-400',
                                            style: { 
                                                left: 'calc(50% - 110px)',
                                                width: '110px',
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
                                                left: '50%',
                                                width: '110px',
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
