// border: '1px solid #d1d5db' - orámovanie - border: '0px solid #d1d5db'
// logged-in-spider.js (upravený - symetrické rozloženie s osemfinále)
import { doc, getDoc, getDocs, setDoc, onSnapshot, updateDoc, addDoc, deleteDoc, collection, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const { useState, useEffect } = React;

// GLOBÁLNY SYSTÉM NOTIFIKÁCIÍ
if (!window.notificationContainer) {
    // Vytvorenie kontajnera pre notifikácie
    const container = document.createElement('div');
    container.id = 'global-notification-container';
    container.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 9999;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        pointer-events: none;
    `;
    document.body.appendChild(container);
    window.notificationContainer = container;
}

// Pridanie CSS pre čiary v pavúkovom zobrazení
if (!document.getElementById('spider-line-styles')) {
    const style = document.createElement('style');
    style.id = 'spider-line-styles';
    style.textContent = `
        .spider-cell {
            position: relative;
        }
        
        .spider-line-horizontal {
            position: absolute;
            height: 2px;
            background-color: #9ca3af;
            top: 50%;
            transform: translateY(-50%);
            z-index: 5;
            pointer-events: none;
        }
        
        .spider-line-vertical {
            position: absolute;
            width: 2px;
            background-color: #9ca3af;
            left: 50%;
            transform: translateX(-50%);
            z-index: 5;
            pointer-events: none;
        }
        
        .spider-line-vertical-top {
            top: 0;
            height: 50%;
        }
        
        .spider-line-vertical-bottom {
            bottom: 0;
            height: 50%;
        }
        
        .spider-line-right {
            right: 0;
            width: 50%;
        }
        
        .spider-line-left {
            left: 0;
            width: 50%;
        }
    `;
    document.head.appendChild(style);
}

// Funkcia na zobrazenie globálnej notifikácie
window.showGlobalNotification = function(message, type = 'info', duration = 3000) {
    const container = window.notificationContainer;
    if (!container) return;
    
    // Vytvorenie notifikácie
    const notification = document.createElement('div');
    notification.style.cssText = `
        background-color: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : type === 'warning' ? '#ff9800' : '#2196F3'};
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        font-size: 14px;
        font-weight: 500;
        min-width: 300px;
        text-align: center;
        pointer-events: auto;
        animation: slideIn 0.3s ease;
        margin-bottom: 10px;
        backdrop-filter: blur(5px);
        border: 1px solid rgba(255,255,255,0.2);
        text-shadow: 0 1px 2px rgba(0,0,0,0.2);
    `;
    
    notification.textContent = message;
    container.appendChild(notification);
    
    // Automatické odstránenie po čase
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }, duration);
    
    return notification;
};

// Pridanie CSS animácií
if (!document.getElementById('notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateY(-100%);
                opacity: 0;
            }
            to {
                transform: translateY(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOut {
            from {
                transform: translateY(0);
                opacity: 1;
            }
            to {
                transform: translateY(-100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

// Pomocná funkcia pre skloňovanie pri mazaní
const getDeletionMessage = (count) => {
    if (count === 1) {
        return `Zmazaný ${count} pavúkový zápas`;
    } else if (count >= 2 && count <= 4) {
        return `Zmazané ${count} pavúkové zápasy`;
    } else {
        return `Zmazaných ${count} pavúkových zápasov`;
    }
};

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

// Pomocná funkcia na aktualizáciu URL s hash parametrom (názov kategórie)
const updateUrlWithCategoryName = (categoryName) => {
    if (categoryName) {
        // Odstránime diakritiku a nahradíme medzery pomlčkami pre URL
        const urlFriendlyName = categoryName
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // odstráni diakritiku
            .replace(/\s+/g, '-') // nahradí medzery pomlčkami
            .toLowerCase();
        
        window.location.hash = urlFriendlyName;
    } else {
        window.location.hash = '';
    }
};

// Pomocná funkcia na získanie názvu kategórie z URL hash
const getCategoryNameFromUrl = () => {
    const hash = window.location.hash.substring(1); // odstráni #
    if (!hash) return '';
    
    // Konvertujeme späť z URL-friendly formátu (pomlčky na medzery)
    return hash.replace(/-/g, ' ');
};

// Funkcia na nájdenie ID kategórie podľa názvu
const findCategoryIdByName = (categories, categoryName) => {
    if (!categoryName || !categories.length) return '';
    
    const category = categories.find(c => 
        c.name.toLowerCase() === categoryName.toLowerCase()
    );
    
    return category ? category.id : '';
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
    const [hasSpiderMatches, setHasSpiderMatches] = useState(false);
    const [hoveredMissingMatch, setHoveredMissingMatch] = useState(null);
    const [spiderLevel, setSpiderLevel] = useState(1); // 1 = semifinále+, 2 = štvrťfinále+, 3 = osemfinále+

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

    // Načítanie kategórie z URL hash po načítaní kategórií
    useEffect(() => {
        if (categories.length > 0) {
            const categoryNameFromUrl = getCategoryNameFromUrl();
            if (categoryNameFromUrl) {
                const categoryId = findCategoryIdByName(categories, categoryNameFromUrl);
                if (categoryId) {
                    setSelectedCategory(categoryId);
                }
            }
        }
    }, [categories]);

    // Načítanie pavúka pre vybranú kategóriu
    useEffect(() => {
        if (selectedCategory) {
            // Filtrujeme LEN pavúkové zápasy pre vybranú kategóriu (podľa matchType)
            const spiderMatches = allMatches.filter(m => 
                m.categoryId === selectedCategory && 
                m.matchType && // Iba zápasy, ktoré majú matchType
                ['finále', 'semifinále 1', 'semifinále 2', 'o 3. miesto', 
                 'štvrťfinále 1', 'štvrťfinále 2', 'štvrťfinále 3', 'štvrťfinále 4',
                 'osemfinále 1', 'osemfinále 2', 'osemfinále 3', 'osemfinále 4',
                 'osemfinále 5', 'osemfinále 6', 'osemfinále 7', 'osemfinále 8'].includes(m.matchType)
            );
            
            console.log('Nájdené pavúkové zápasy pre kategóriu:', spiderMatches);
            
            // Zistíme, či existujú nejaké pavúkové zápasy a aká je úroveň
            const hasSemifinalMatches = spiderMatches.some(m => ['semifinále 1', 'semifinále 2'].includes(m.matchType));
            const hasQuarterfinalMatches = spiderMatches.some(m => ['štvrťfinále 1', 'štvrťfinále 2', 'štvrťfinále 3', 'štvrťfinále 4'].includes(m.matchType));
            const hasEightfinalMatches = spiderMatches.some(m => ['osemfinále 1', 'osemfinále 2', 'osemfinále 3', 'osemfinále 4',
                                                                  'osemfinále 5', 'osemfinále 6', 'osemfinále 7', 'osemfinále 8'].includes(m.matchType));
            
            setHasSpiderMatches(spiderMatches.length > 0);
            
            if (hasEightfinalMatches) {
                setSpiderLevel(3);
            } else if (hasQuarterfinalMatches) {
                setSpiderLevel(2);
            } else if (hasSemifinalMatches) {
                setSpiderLevel(1);
            }
            
            if (spiderMatches.length > 0) {
                // Vytvoríme štruktúru z existujúcich zápasov
                const spiderStructure = {
                    final: spiderMatches.find(m => m.matchType === 'finále') || { 
                        id: 'final', 
                        homeTeam: '---', 
                        awayTeam: '---', 
                        homeScore: '', 
                        awayScore: '', 
                        date: null,
                        exists: false
                    },
                    semiFinals: [
                        spiderMatches.find(m => m.matchType === 'semifinále 1') || { 
                            id: 'sf1', 
                            homeTeam: '---', 
                            awayTeam: '---', 
                            homeScore: '', 
                            awayScore: '', 
                            date: null,
                            exists: false
                        },
                        spiderMatches.find(m => m.matchType === 'semifinále 2') || { 
                            id: 'sf2', 
                            homeTeam: '---', 
                            awayTeam: '---', 
                            homeScore: '', 
                            awayScore: '', 
                            date: null,
                            exists: false
                        }
                    ],
                    quarterFinals: [
                        spiderMatches.find(m => m.matchType === 'štvrťfinále 1') || { 
                            id: 'qf1', 
                            homeTeam: '---', 
                            awayTeam: '---', 
                            homeScore: '', 
                            awayScore: '', 
                            date: null,
                            exists: false
                        },
                        spiderMatches.find(m => m.matchType === 'štvrťfinále 2') || { 
                            id: 'qf2', 
                            homeTeam: '---', 
                            awayTeam: '---', 
                            homeScore: '', 
                            awayScore: '', 
                            date: null,
                            exists: false
                        },
                        spiderMatches.find(m => m.matchType === 'štvrťfinále 3') || { 
                            id: 'qf3', 
                            homeTeam: '---', 
                            awayTeam: '---', 
                            homeScore: '', 
                            awayScore: '', 
                            date: null,
                            exists: false
                        },
                        spiderMatches.find(m => m.matchType === 'štvrťfinále 4') || { 
                            id: 'qf4', 
                            homeTeam: '---', 
                            awayTeam: '---', 
                            homeScore: '', 
                            awayScore: '', 
                            date: null,
                            exists: false
                        }
                    ],
                    eightFinals: [
                        spiderMatches.find(m => m.matchType === 'osemfinále 1') || { 
                            id: 'ef1', 
                            homeTeam: '---', 
                            awayTeam: '---', 
                            homeScore: '', 
                            awayScore: '', 
                            date: null,
                            exists: false
                        },
                        spiderMatches.find(m => m.matchType === 'osemfinále 2') || { 
                            id: 'ef2', 
                            homeTeam: '---', 
                            awayTeam: '---', 
                            homeScore: '', 
                            awayScore: '', 
                            date: null,
                            exists: false
                        },
                        spiderMatches.find(m => m.matchType === 'osemfinále 3') || { 
                            id: 'ef3', 
                            homeTeam: '---', 
                            awayTeam: '---', 
                            homeScore: '', 
                            awayScore: '', 
                            date: null,
                            exists: false
                        },
                        spiderMatches.find(m => m.matchType === 'osemfinále 4') || { 
                            id: 'ef4', 
                            homeTeam: '---', 
                            awayTeam: '---', 
                            homeScore: '', 
                            awayScore: '', 
                            date: null,
                            exists: false
                        },
                        spiderMatches.find(m => m.matchType === 'osemfinále 5') || { 
                            id: 'ef5', 
                            homeTeam: '---', 
                            awayTeam: '---', 
                            homeScore: '', 
                            awayScore: '', 
                            date: null,
                            exists: false
                        },
                        spiderMatches.find(m => m.matchType === 'osemfinále 6') || { 
                            id: 'ef6', 
                            homeTeam: '---', 
                            awayTeam: '---', 
                            homeScore: '', 
                            awayScore: '', 
                            date: null,
                            exists: false
                        },
                        spiderMatches.find(m => m.matchType === 'osemfinále 7') || { 
                            id: 'ef7', 
                            homeTeam: '---', 
                            awayTeam: '---', 
                            homeScore: '', 
                            awayScore: '', 
                            date: null,
                            exists: false
                        },
                        spiderMatches.find(m => m.matchType === 'osemfinále 8') || { 
                            id: 'ef8', 
                            homeTeam: '---', 
                            awayTeam: '---', 
                            homeScore: '', 
                            awayScore: '', 
                            date: null,
                            exists: false
                        }
                    ],
                    thirdPlace: spiderMatches.find(m => m.matchType === 'o 3. miesto') || { 
                        id: 'third', 
                        homeTeam: '---', 
                        awayTeam: '---', 
                        homeScore: '', 
                        awayScore: '', 
                        date: null,
                        exists: false
                    }
                };
                
                // Označíme existujúce zápasy a naplníme ich dátami
                spiderMatches.forEach(match => {
                    if (match.matchType === 'finále') {
                        spiderStructure.final.exists = true;
                        spiderStructure.final.id = match.id;
                        spiderStructure.final.homeTeam = match.homeTeamIdentifier || match.homeTeam || '---';
                        spiderStructure.final.awayTeam = match.awayTeamIdentifier || match.awayTeam || '---';
                        spiderStructure.final.homeScore = match.homeScore;
                        spiderStructure.final.awayScore = match.awayScore;
                        spiderStructure.final.date = match.date;
                    } else if (match.matchType === 'semifinále 1') {
                        spiderStructure.semiFinals[0].exists = true;
                        spiderStructure.semiFinals[0].id = match.id;
                        spiderStructure.semiFinals[0].homeTeam = match.homeTeamIdentifier || match.homeTeam || '---';
                        spiderStructure.semiFinals[0].awayTeam = match.awayTeamIdentifier || match.awayTeam || '---';
                        spiderStructure.semiFinals[0].homeScore = match.homeScore;
                        spiderStructure.semiFinals[0].awayScore = match.awayScore;
                        spiderStructure.semiFinals[0].date = match.date;
                    } else if (match.matchType === 'semifinále 2') {
                        spiderStructure.semiFinals[1].exists = true;
                        spiderStructure.semiFinals[1].id = match.id;
                        spiderStructure.semiFinals[1].homeTeam = match.homeTeamIdentifier || match.homeTeam || '---';
                        spiderStructure.semiFinals[1].awayTeam = match.awayTeamIdentifier || match.awayTeam || '---';
                        spiderStructure.semiFinals[1].homeScore = match.homeScore;
                        spiderStructure.semiFinals[1].awayScore = match.awayScore;
                        spiderStructure.semiFinals[1].date = match.date;
                    } else if (match.matchType === 'o 3. miesto') {
                        spiderStructure.thirdPlace.exists = true;
                        spiderStructure.thirdPlace.id = match.id;
                        spiderStructure.thirdPlace.homeTeam = match.homeTeamIdentifier || match.homeTeam || '---';
                        spiderStructure.thirdPlace.awayTeam = match.awayTeamIdentifier || match.awayTeam || '---';
                        spiderStructure.thirdPlace.homeScore = match.homeScore;
                        spiderStructure.thirdPlace.awayScore = match.awayScore;
                        spiderStructure.thirdPlace.date = match.date;
                    } else if (match.matchType === 'štvrťfinále 1') {
                        spiderStructure.quarterFinals[0].exists = true;
                        spiderStructure.quarterFinals[0].id = match.id;
                        spiderStructure.quarterFinals[0].homeTeam = match.homeTeamIdentifier || match.homeTeam || '---';
                        spiderStructure.quarterFinals[0].awayTeam = match.awayTeamIdentifier || match.awayTeam || '---';
                        spiderStructure.quarterFinals[0].homeScore = match.homeScore;
                        spiderStructure.quarterFinals[0].awayScore = match.awayScore;
                        spiderStructure.quarterFinals[0].date = match.date;
                    } else if (match.matchType === 'štvrťfinále 2') {
                        spiderStructure.quarterFinals[1].exists = true;
                        spiderStructure.quarterFinals[1].id = match.id;
                        spiderStructure.quarterFinals[1].homeTeam = match.homeTeamIdentifier || match.homeTeam || '---';
                        spiderStructure.quarterFinals[1].awayTeam = match.awayTeamIdentifier || match.awayTeam || '---';
                        spiderStructure.quarterFinals[1].homeScore = match.homeScore;
                        spiderStructure.quarterFinals[1].awayScore = match.awayScore;
                        spiderStructure.quarterFinals[1].date = match.date;
                    } else if (match.matchType === 'štvrťfinále 3') {
                        spiderStructure.quarterFinals[2].exists = true;
                        spiderStructure.quarterFinals[2].id = match.id;
                        spiderStructure.quarterFinals[2].homeTeam = match.homeTeamIdentifier || match.homeTeam || '---';
                        spiderStructure.quarterFinals[2].awayTeam = match.awayTeamIdentifier || match.awayTeam || '---';
                        spiderStructure.quarterFinals[2].homeScore = match.homeScore;
                        spiderStructure.quarterFinals[2].awayScore = match.awayScore;
                        spiderStructure.quarterFinals[2].date = match.date;
                    } else if (match.matchType === 'štvrťfinále 4') {
                        spiderStructure.quarterFinals[3].exists = true;
                        spiderStructure.quarterFinals[3].id = match.id;
                        spiderStructure.quarterFinals[3].homeTeam = match.homeTeamIdentifier || match.homeTeam || '---';
                        spiderStructure.quarterFinals[3].awayTeam = match.awayTeamIdentifier || match.awayTeam || '---';
                        spiderStructure.quarterFinals[3].homeScore = match.homeScore;
                        spiderStructure.quarterFinals[3].awayScore = match.awayScore;
                        spiderStructure.quarterFinals[3].date = match.date;
                    } else if (match.matchType.startsWith('osemfinále')) {
                        const index = parseInt(match.matchType.split(' ')[1]) - 1;
                        if (index >= 0 && index < 8) {
                            spiderStructure.eightFinals[index].exists = true;
                            spiderStructure.eightFinals[index].id = match.id;
                            spiderStructure.eightFinals[index].homeTeam = match.homeTeamIdentifier || match.homeTeam || '---';
                            spiderStructure.eightFinals[index].awayTeam = match.awayTeamIdentifier || match.awayTeam || '---';
                            spiderStructure.eightFinals[index].homeScore = match.homeScore;
                            spiderStructure.eightFinals[index].awayScore = match.awayScore;
                            spiderStructure.eightFinals[index].date = match.date;
                        }
                    }
                });
                
                setSpiderData(spiderStructure);
            } else {
                // Žiadne pavúkové zápasy - nezobrazujeme boxy
                setSpiderData(null);
            }
        } else {
            // Žiadna vybratá kategória
            setSpiderData(null);
            setHasSpiderMatches(false);
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
            // Zistíme, či už existujú pavúkové zápasy pre túto kategóriu
            const existingSpiderMatches = allMatches.filter(m => 
                m.categoryId === categoryId && 
                m.matchType && 
                ['finále', 'semifinále 1', 'semifinále 2', 'o 3. miesto', 
                 'štvrťfinále 1', 'štvrťfinále 2', 'štvrťfinále 3', 'štvrťfinále 4',
                 'osemfinále 1', 'osemfinále 2', 'osemfinále 3', 'osemfinále 4',
                 'osemfinále 5', 'osemfinále 6', 'osemfinále 7', 'osemfinále 8'].includes(m.matchType)
            );
            
            const hasSemifinals = existingSpiderMatches.some(m => ['semifinále 1', 'semifinále 2'].includes(m.matchType));
            const hasQuarterfinals = existingSpiderMatches.some(m => ['štvrťfinále 1', 'štvrťfinále 2', 'štvrťfinále 3', 'štvrťfinále 4'].includes(m.matchType));
            const hasEightfinals = existingSpiderMatches.some(m => ['osemfinále 1', 'osemfinále 2', 'osemfinále 3', 'osemfinále 4',
                                                                     'osemfinále 5', 'osemfinále 6', 'osemfinále 7', 'osemfinále 8'].includes(m.matchType));
            
            // Ak už existujú osemfinále, nebudeme generovať nič
            if (hasEightfinals) {
                window.showGlobalNotification('Pavúk už má osemfinále. Ďalšia úroveň zatiaľ nie je implementovaná.', 'warning');
                setGenerationInProgress(false);
                return;
            }
            
            // Získanie názvu kategórie
            const category = categories.find(c => c.id === categoryId);
            const categoryName = category ? category.name : `Kategória ${categoryId}`;
            
            // Odstránenie diakritiky z názvu kategórie pre identifikátory
            const categoryWithoutDiacritics = categoryName
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, ''); // odstráni diakritiku, ale zachová medzery
            
            let matchesToSave = [];
            
            if (!hasSemifinals) {
                // Prvé generovanie - semifinále, finále, o 3. miesto
                matchesToSave = [
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
                
                setSpiderLevel(1);
            } else if (!hasQuarterfinals) {
                // Druhé generovanie - štvrťfinále (4 zápasy)
                matchesToSave = [
                    // Štvrťfinále 1
                    {
                        homeTeamIdentifier: '---',
                        awayTeamIdentifier: '---',
                        time: '--:--',
                        hallId: null,
                        categoryId: categoryId,
                        categoryName: categoryName,
                        groupName: null,
                        matchType: 'štvrťfinále 1',
                        status: 'pending',
                        createdAt: Timestamp.now(),
                        createdBy: userProfileData?.email || 'unknown',
                        createdByUid: userProfileData?.uid || null
                    },
                    // Štvrťfinále 2
                    {
                        homeTeamIdentifier: '---',
                        awayTeamIdentifier: '---',
                        time: '--:--',
                        hallId: null,
                        categoryId: categoryId,
                        categoryName: categoryName,
                        groupName: null,
                        matchType: 'štvrťfinále 2',
                        status: 'pending',
                        createdAt: Timestamp.now(),
                        createdBy: userProfileData?.email || 'unknown',
                        createdByUid: userProfileData?.uid || null
                    },
                    // Štvrťfinále 3
                    {
                        homeTeamIdentifier: '---',
                        awayTeamIdentifier: '---',
                        time: '--:--',
                        hallId: null,
                        categoryId: categoryId,
                        categoryName: categoryName,
                        groupName: null,
                        matchType: 'štvrťfinále 3',
                        status: 'pending',
                        createdAt: Timestamp.now(),
                        createdBy: userProfileData?.email || 'unknown',
                        createdByUid: userProfileData?.uid || null
                    },
                    // Štvrťfinále 4
                    {
                        homeTeamIdentifier: '---',
                        awayTeamIdentifier: '---',
                        time: '--:--',
                        hallId: null,
                        categoryId: categoryId,
                        categoryName: categoryName,
                        groupName: null,
                        matchType: 'štvrťfinále 4',
                        status: 'pending',
                        createdAt: Timestamp.now(),
                        createdBy: userProfileData?.email || 'unknown',
                        createdByUid: userProfileData?.uid || null
                    }
                ];

                // Nájdeme existujúce semifinálové zápasy a aktualizujeme ich identifikátory
                const semifinal1 = existingSpiderMatches.find(m => m.matchType === 'semifinále 1');
                const semifinal2 = existingSpiderMatches.find(m => m.matchType === 'semifinále 2');

                if (semifinal1) {
                    await updateDoc(doc(window.db, 'matches', semifinal1.id), {
                        homeTeamIdentifier: `${categoryWithoutDiacritics} WQF01`,
                        awayTeamIdentifier: `${categoryWithoutDiacritics} WQF02`
                    });
                }

                if (semifinal2) {
                    await updateDoc(doc(window.db, 'matches', semifinal2.id), {
                        homeTeamIdentifier: `${categoryWithoutDiacritics} WQF03`,
                        awayTeamIdentifier: `${categoryWithoutDiacritics} WQF04`
                    });
                }
                
                setSpiderLevel(2);
            } else {
                // Tretie generovanie - osemfinále (8 zápasov)
                matchesToSave = [
                    // Osemfinále 1
                    {
                        homeTeamIdentifier: '---',
                        awayTeamIdentifier: '---',
                        time: '--:--',
                        hallId: null,
                        categoryId: categoryId,
                        categoryName: categoryName,
                        groupName: null,
                        matchType: 'osemfinále 1',
                        status: 'pending',
                        createdAt: Timestamp.now(),
                        createdBy: userProfileData?.email || 'unknown',
                        createdByUid: userProfileData?.uid || null
                    },
                    // Osemfinále 2
                    {
                        homeTeamIdentifier: '---',
                        awayTeamIdentifier: '---',
                        time: '--:--',
                        hallId: null,
                        categoryId: categoryId,
                        categoryName: categoryName,
                        groupName: null,
                        matchType: 'osemfinále 2',
                        status: 'pending',
                        createdAt: Timestamp.now(),
                        createdBy: userProfileData?.email || 'unknown',
                        createdByUid: userProfileData?.uid || null
                    },
                    // Osemfinále 3
                    {
                        homeTeamIdentifier: '---',
                        awayTeamIdentifier: '---',
                        time: '--:--',
                        hallId: null,
                        categoryId: categoryId,
                        categoryName: categoryName,
                        groupName: null,
                        matchType: 'osemfinále 3',
                        status: 'pending',
                        createdAt: Timestamp.now(),
                        createdBy: userProfileData?.email || 'unknown',
                        createdByUid: userProfileData?.uid || null
                    },
                    // Osemfinále 4
                    {
                        homeTeamIdentifier: '---',
                        awayTeamIdentifier: '---',
                        time: '--:--',
                        hallId: null,
                        categoryId: categoryId,
                        categoryName: categoryName,
                        groupName: null,
                        matchType: 'osemfinále 4',
                        status: 'pending',
                        createdAt: Timestamp.now(),
                        createdBy: userProfileData?.email || 'unknown',
                        createdByUid: userProfileData?.uid || null
                    },
                    // Osemfinále 5
                    {
                        homeTeamIdentifier: '---',
                        awayTeamIdentifier: '---',
                        time: '--:--',
                        hallId: null,
                        categoryId: categoryId,
                        categoryName: categoryName,
                        groupName: null,
                        matchType: 'osemfinále 5',
                        status: 'pending',
                        createdAt: Timestamp.now(),
                        createdBy: userProfileData?.email || 'unknown',
                        createdByUid: userProfileData?.uid || null
                    },
                    // Osemfinále 6
                    {
                        homeTeamIdentifier: '---',
                        awayTeamIdentifier: '---',
                        time: '--:--',
                        hallId: null,
                        categoryId: categoryId,
                        categoryName: categoryName,
                        groupName: null,
                        matchType: 'osemfinále 6',
                        status: 'pending',
                        createdAt: Timestamp.now(),
                        createdBy: userProfileData?.email || 'unknown',
                        createdByUid: userProfileData?.uid || null
                    },
                    // Osemfinále 7
                    {
                        homeTeamIdentifier: '---',
                        awayTeamIdentifier: '---',
                        time: '--:--',
                        hallId: null,
                        categoryId: categoryId,
                        categoryName: categoryName,
                        groupName: null,
                        matchType: 'osemfinále 7',
                        status: 'pending',
                        createdAt: Timestamp.now(),
                        createdBy: userProfileData?.email || 'unknown',
                        createdByUid: userProfileData?.uid || null
                    },
                    // Osemfinále 8
                    {
                        homeTeamIdentifier: '---',
                        awayTeamIdentifier: '---',
                        time: '--:--',
                        hallId: null,
                        categoryId: categoryId,
                        categoryName: categoryName,
                        groupName: null,
                        matchType: 'osemfinále 8',
                        status: 'pending',
                        createdAt: Timestamp.now(),
                        createdBy: userProfileData?.email || 'unknown',
                        createdByUid: userProfileData?.uid || null
                    }
                ];

                // Nájdeme existujúce štvrťfinálové zápasy a aktualizujeme ich identifikátory
                const quarterfinal1 = existingSpiderMatches.find(m => m.matchType === 'štvrťfinále 1');
                const quarterfinal2 = existingSpiderMatches.find(m => m.matchType === 'štvrťfinále 2');
                const quarterfinal3 = existingSpiderMatches.find(m => m.matchType === 'štvrťfinále 3');
                const quarterfinal4 = existingSpiderMatches.find(m => m.matchType === 'štvrťfinále 4');

                if (quarterfinal1) {
                    await updateDoc(doc(window.db, 'matches', quarterfinal1.id), {
                        homeTeamIdentifier: `${categoryWithoutDiacritics} W8F01`,
                        awayTeamIdentifier: `${categoryWithoutDiacritics} W8F02`
                    });
                }

                if (quarterfinal2) {
                    await updateDoc(doc(window.db, 'matches', quarterfinal2.id), {
                        homeTeamIdentifier: `${categoryWithoutDiacritics} W8F03`,
                        awayTeamIdentifier: `${categoryWithoutDiacritics} W8F04`
                    });
                }

                if (quarterfinal3) {
                    await updateDoc(doc(window.db, 'matches', quarterfinal3.id), {
                        homeTeamIdentifier: `${categoryWithoutDiacritics} W8F05`,
                        awayTeamIdentifier: `${categoryWithoutDiacritics} W8F06`
                    });
                }

                if (quarterfinal4) {
                    await updateDoc(doc(window.db, 'matches', quarterfinal4.id), {
                        homeTeamIdentifier: `${categoryWithoutDiacritics} W8F07`,
                        awayTeamIdentifier: `${categoryWithoutDiacritics} W8F08`
                    });
                }
                
                setSpiderLevel(3);
            }
    
            // Uložíme zápasy do Firebase
            const matchesRef = collection(window.db, 'matches');
            
            const savedMatches = [];
            for (const match of matchesToSave) {
                const docRef = await addDoc(matchesRef, match);
                savedMatches.push({
                    id: docRef.id,
                    ...match,
                    exists: true
                });
            }
    
            // Počkáme chvíľu, aby sa dáta stihli načítať
            setTimeout(() => {
                setGenerationInProgress(false);
            }, 1000);
            
            let message;
            if (!hasSemifinals) {
                message = `Pavúk bol vygenerovaný a uložených ${savedMatches.length} zápasov do databázy`;
            } else if (!hasQuarterfinals) {
                message = `Štvrťfinále bolo vygenerované (${savedMatches.length} zápasov)`;
            } else {
                message = `Osemfinále bolo vygenerované (${savedMatches.length} zápasov)`;
            }
            
            window.showGlobalNotification(message, 'success');
    
        } catch (error) {
            console.error('Chyba pri generovaní pavúka:', error);
            window.showGlobalNotification('Chyba pri generovaní pavúka: ' + error.message, 'error');
            setGenerationInProgress(false);
        }
    };

    // Funkcia na vytvorenie jednotlivého chýbajúceho zápasu
    const generateSingleMatch = async (matchType) => {
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
            window.showGlobalNotification('Na generovanie zápasu potrebujete administrátorské práva', 'error');
            return;
        }
    
        setGenerationInProgress(true);
        
        try {
            // Skontrolujeme, či už zápas neexistuje
            const existingMatch = allMatches.find(m => 
                m.categoryId === categoryId && 
                m.matchType === matchType
            );
            
            if (existingMatch) {
                window.showGlobalNotification('Tento zápas už existuje', 'warning');
                return;
            }
    
            // Získanie názvu kategórie
            const category = categories.find(c => c.id === categoryId);
            const categoryName = category ? category.name : `Kategória ${categoryId}`;
            
            // Odstránenie diakritiky z názvu kategórie pre identifikátory
            const categoryWithoutDiacritics = categoryName
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '');
            
            // Príprava dát pre zápas podľa typu
            let matchData = {
                homeTeamIdentifier: '---',
                awayTeamIdentifier: '---',
                time: '--:--',
                hallId: null,
                categoryId: categoryId,
                categoryName: categoryName,
                groupName: null,
                matchType: matchType,
                status: 'pending',
                createdAt: Timestamp.now(),
                createdBy: userProfileData?.email || 'unknown',
                createdByUid: userProfileData?.uid || null
            };
            
            // Pre finále a o 3. miesto nastavíme identifikátory
            if (matchType === 'finále') {
                matchData.homeTeamIdentifier = `${categoryWithoutDiacritics} WSF01`;
                matchData.awayTeamIdentifier = `${categoryWithoutDiacritics} WSF02`;
            } else if (matchType === 'o 3. miesto') {
                matchData.homeTeamIdentifier = `${categoryWithoutDiacritics} LSF01`;
                matchData.awayTeamIdentifier = `${categoryWithoutDiacritics} LSF02`;
            }
            
            // Uložíme zápas do Firebase
            const matchesRef = collection(window.db, 'matches');
            const docRef = await addDoc(matchesRef, matchData);
            
            window.showGlobalNotification(`Zápas ${matchType} bol vygenerovaný`, 'success');
    
        } catch (error) {
            console.error('Chyba pri generovaní zápasu:', error);
            window.showGlobalNotification('Chyba pri generovaní zápasu: ' + error.message, 'error');
        } finally {
            setGenerationInProgress(false);
        }
    };

    // Funkcia na vymazanie pavúkových zápasov pre vybranú kategóriu (po úrovniach)
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
                ['finále', 'semifinále 1', 'semifinále 2', 'o 3. miesto', 
                 'štvrťfinále 1', 'štvrťfinále 2', 'štvrťfinále 3', 'štvrťfinále 4',
                 'osemfinále 1', 'osemfinále 2', 'osemfinále 3', 'osemfinále 4',
                 'osemfinále 5', 'osemfinále 6', 'osemfinále 7', 'osemfinále 8'].includes(m.matchType)
            );
            
            if (existingSpiderMatches.length === 0) {
                window.showGlobalNotification('Pre túto kategóriu neexistujú žiadne pavúkové zápasy', 'info');
                return;
            }
    
            // Zistíme, aká je najvyššia úroveň
            const hasEightfinals = existingSpiderMatches.some(m => ['osemfinále 1', 'osemfinále 2', 'osemfinále 3', 'osemfinále 4',
                                                                     'osemfinále 5', 'osemfinále 6', 'osemfinále 7', 'osemfinále 8'].includes(m.matchType));
            const hasQuarterfinals = existingSpiderMatches.some(m => ['štvrťfinále 1', 'štvrťfinále 2', 'štvrťfinále 3', 'štvrťfinále 4'].includes(m.matchType));
            
            let matchesToDelete = [];
            let message = '';
            
            if (hasEightfinals) {
                // Ak existujú osemfinále, zmažeme len ich
                matchesToDelete = existingSpiderMatches.filter(m => 
                    ['osemfinále 1', 'osemfinále 2', 'osemfinále 3', 'osemfinále 4',
                     'osemfinále 5', 'osemfinále 6', 'osemfinále 7', 'osemfinále 8'].includes(m.matchType)
                );
                
                // Aktualizujeme identifikátory štvrťfinálových zápasov späť na '---'
                const quarterfinal1 = existingSpiderMatches.find(m => m.matchType === 'štvrťfinále 1');
                const quarterfinal2 = existingSpiderMatches.find(m => m.matchType === 'štvrťfinále 2');
                const quarterfinal3 = existingSpiderMatches.find(m => m.matchType === 'štvrťfinále 3');
                const quarterfinal4 = existingSpiderMatches.find(m => m.matchType === 'štvrťfinále 4');
    
                if (quarterfinal1) {
                    await updateDoc(doc(window.db, 'matches', quarterfinal1.id), {
                        homeTeamIdentifier: '---',
                        awayTeamIdentifier: '---'
                    });
                }
    
                if (quarterfinal2) {
                    await updateDoc(doc(window.db, 'matches', quarterfinal2.id), {
                        homeTeamIdentifier: '---',
                        awayTeamIdentifier: '---'
                    });
                }
    
                if (quarterfinal3) {
                    await updateDoc(doc(window.db, 'matches', quarterfinal3.id), {
                        homeTeamIdentifier: '---',
                        awayTeamIdentifier: '---'
                    });
                }
    
                if (quarterfinal4) {
                    await updateDoc(doc(window.db, 'matches', quarterfinal4.id), {
                        homeTeamIdentifier: '---',
                        awayTeamIdentifier: '---'
                    });
                }
                
                setSpiderLevel(2);
                message = `Zmazané osemfinále (${matchesToDelete.length} zápasov)`;
                
            } else if (hasQuarterfinals) {
                // Ak existujú štvrťfinále (ale nie osemfinále), zmažeme ich
                matchesToDelete = existingSpiderMatches.filter(m => 
                    ['štvrťfinále 1', 'štvrťfinále 2', 'štvrťfinále 3', 'štvrťfinále 4'].includes(m.matchType)
                );
                
                // Aktualizujeme identifikátory semifinálových zápasov späť na '---'
                const semifinal1 = existingSpiderMatches.find(m => m.matchType === 'semifinále 1');
                const semifinal2 = existingSpiderMatches.find(m => m.matchType === 'semifinále 2');
    
                if (semifinal1) {
                    await updateDoc(doc(window.db, 'matches', semifinal1.id), {
                        homeTeamIdentifier: '---',
                        awayTeamIdentifier: '---'
                    });
                }
    
                if (semifinal2) {
                    await updateDoc(doc(window.db, 'matches', semifinal2.id), {
                        homeTeamIdentifier: '---',
                        awayTeamIdentifier: '---'
                    });
                }
                
                setSpiderLevel(1);
                message = `Zmazané štvrťfinále (${matchesToDelete.length} zápasov)`;
                
            } else {
                // Inak zmažeme všetky pavúkové zápasy (semifinále, finále, o 3. miesto)
                matchesToDelete = existingSpiderMatches.filter(m => 
                    ['finále', 'semifinále 1', 'semifinále 2', 'o 3. miesto'].includes(m.matchType)
                );
                
                setSpiderLevel(0);
                setHasSpiderMatches(false);
                message = `Zmazaný celý pavúk (${matchesToDelete.length} zápasov)`;
            }
            
            // Vymažeme vybrané zápasy
            for (const match of matchesToDelete) {
                await deleteDoc(doc(window.db, 'matches', match.id));
            }
    
            window.showGlobalNotification(message, 'success');
    
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

    // Handler pre zmenu kategórie - aktualizuje URL hash a stav
    const handleCategoryChange = (e) => {
        const newCategoryId = e.target.value;
        setSelectedCategory(newCategoryId);
        
        // Aktualizujeme URL hash podľa názvu kategórie
        if (newCategoryId) {
            const category = categories.find(c => c.id === newCategoryId);
            if (category) {
                updateUrlWithCategoryName(category.name);
            }
        } else {
            updateUrlWithCategoryName('');
        }
        
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
    };

    // Komponent pre zobrazenie jedného zápasu v pavúkovom zobrazení
    const MatchCell = ({ match, title = '', matchType, userProfileData, generationInProgress, onGenerate }) => {
        const [isHovered, setIsHovered] = useState(false);
    
        // Kontrola, či zápas existuje v databáze
        if (!match.exists) {
            // Chýbajúci zápas - sivý čiarkovaný box s možnosťou generovania
            return React.createElement(
                'div',
                { 
                    className: `border-2 border-dashed border-gray-400 rounded-lg p-3 min-w-[220px] transition-all duration-200 ${
                        isHovered && userProfileData?.role === 'admin' && !generationInProgress 
                            ? 'bg-green-50 border-green-500' 
                            : 'bg-gray-100'
                    }`,
                    style: { 
                        zIndex: 10, 
                        position: 'relative',
                        minHeight: '140px',
                        display: 'flex',
                        flexDirection: 'column',
                        cursor: userProfileData?.role === 'admin' ? 'pointer' : 'default'
                    },
                    onMouseEnter: () => {
                        if (userProfileData?.role === 'admin' && !generationInProgress) {
                            setIsHovered(true);
                        }
                    },
                    onMouseLeave: () => {
                        setIsHovered(false);
                    },
                    onClick: () => {
                        if (userProfileData?.role === 'admin' && !generationInProgress) {
                            onGenerate(matchType);
                        }
                    }
                },
                // Nadpis (ak existuje)
                title && React.createElement(
                    'div',
                    { className: `text-sm font-semibold mb-2 pb-1 border-b border-dashed text-center ${
                        isHovered && userProfileData?.role === 'admin' && !generationInProgress 
                            ? 'text-green-700 border-green-300' 
                            : 'text-gray-500 border-gray-300'
                    }` },
                    title
                ),
                // Obsah - buď otáznik alebo tlačidlo +
                React.createElement(
                    'div',
                    { 
                        className: 'flex-grow flex items-center justify-center',
                        style: { minHeight: title ? '80px' : '120px' }
                    },
                    isHovered && userProfileData?.role === 'admin' && !generationInProgress ? (
                        React.createElement(
                            'div',
                            { 
                                className: 'w-12 h-12 rounded-full bg-green-500 flex items-center justify-center shadow-lg transform transition-transform hover:scale-110',
                                style: { animation: 'pulse 2s infinite' }
                            },
                            React.createElement(
                                'span',
                                { 
                                    className: 'text-white text-3xl font-bold',
                                    style: { marginTop: '-4px' } 
                                },
                                '+'
                            )
                        )
                    ) : (
                        React.createElement(
                            'span',
                            { 
                                className: 'text-gray-400',
                                style: { fontSize: '72px', fontWeight: '300', lineHeight: 1 }
                            },
                            '?'
                        )
                    )
                )
            );
        }

        // Existujúci zápas - normálne zobrazenie
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
                                    onChange: handleCategoryChange,
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
                                        ['finále', 'semifinále 1', 'semifinále 2', 'o 3. miesto', 
                                         'štvrťfinále 1', 'štvrťfinále 2', 'štvrťfinále 3', 'štvrťfinále 4',
                                         'osemfinále 1', 'osemfinále 2', 'osemfinále 3', 'osemfinále 4',
                                         'osemfinále 5', 'osemfinále 6', 'osemfinále 7', 'osemfinále 8'].includes(m.matchType)
                                    ).length;
                                    
                                    const level = spiderMatches >= 12 ? 3 : (spiderMatches >= 8 ? 2 : (spiderMatches >= 4 ? 1 : 0));
                                    
                                    return React.createElement('option', { 
                                        key: cat.id, 
                                        value: cat.id 
                                    }, `${cat.name} (úroveň ${level})`);
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
                        title: !selectedCategory ? 'Najprv vyberte kategóriu' : 
                               (spiderLevel === 1 ? 'Generovať štvrťfinále' : 
                                spiderLevel === 2 ? 'Generovať osemfinále' : 
                                'Generovať pavúka')
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
                    React.createElement(
                        'span',
                        {
                            style: {
                                position: 'absolute',
                                top: '6px',
                                left: '12px',
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
                    ),
                    // Pridanie dvoch šikmých čiar pre zablokovaný stav
                    !selectedCategory && !generationInProgress && React.createElement(
                        React.Fragment,
                        null,
                        // Zelená čiara
                        React.createElement('div', {
                            style: {
                                position: 'absolute',
                                top: '0px',
                                right: '0px',
                                width: '100%',
                                height: '100%',
                                background: 'linear-gradient(135deg, transparent calc(50% - 3px), rgb(34 197 94) calc(50% - 2px), rgb(34 197 94) calc(50% + 2px), transparent calc(50% + 2px))',
                                pointerEvents: 'none',
                                transform: 'rotate(180deg)',
                                transformOrigin: 'center',
                                zIndex: 50
                            }
                        }),
                        // Červená čiara
                        React.createElement('div', {
                            style: {
                                position: 'absolute',
                                top: '2px',
                                right: '-2px',
                                width: '100%',
                                height: '100%',
                                background: 'linear-gradient(135deg, transparent calc(50% - 2px), rgb(239 68 68) calc(50% - 2px), rgb(239 68 68) calc(50% + 2px), transparent calc(50% + 2px))',
                                pointerEvents: 'none',
                                transform: 'rotate(180deg)',
                                transformOrigin: 'center',
                                zIndex: 49
                            }
                        })
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
                
                // Zistenie aktuálnej úrovne pre zobrazenie konkrétnej správy
                (() => {
                    const existingSpiderMatches = allMatches.filter(m => 
                        m.categoryId === selectedCategory && 
                        m.matchType && 
                        ['finále', 'semifinále 1', 'semifinále 2', 'o 3. miesto', 
                         'štvrťfinále 1', 'štvrťfinále 2', 'štvrťfinále 3', 'štvrťfinále 4',
                         'osemfinále 1', 'osemfinále 2', 'osemfinále 3', 'osemfinále 4',
                         'osemfinále 5', 'osemfinále 6', 'osemfinále 7', 'osemfinále 8'].includes(m.matchType)
                    );
                    
                    const hasEightfinals = existingSpiderMatches.some(m => 
                        ['osemfinále 1', 'osemfinále 2', 'osemfinále 3', 'osemfinále 4',
                         'osemfinále 5', 'osemfinále 6', 'osemfinále 7', 'osemfinále 8'].includes(m.matchType)
                    );
                    const hasQuarterfinals = existingSpiderMatches.some(m => 
                        ['štvrťfinále 1', 'štvrťfinále 2', 'štvrťfinále 3', 'štvrťfinále 4'].includes(m.matchType)
                    );
                    
                    let deleteMessage = '';
                    let deleteCount = 0;
                    
                    if (hasEightfinals) {
                        deleteCount = existingSpiderMatches.filter(m => 
                            ['osemfinále 1', 'osemfinále 2', 'osemfinále 3', 'osemfinále 4',
                             'osemfinále 5', 'osemfinále 6', 'osemfinále 7', 'osemfinále 8'].includes(m.matchType)
                        ).length;
                        deleteMessage = `Naozaj chcete zmazať všetky osemfinálové zápasy (${deleteCount}) pre kategóriu "${categories.find(c => c.id === selectedCategory)?.name || selectedCategory}"?`;
                    } else if (hasQuarterfinals) {
                        deleteCount = existingSpiderMatches.filter(m => 
                            ['štvrťfinále 1', 'štvrťfinále 2', 'štvrťfinále 3', 'štvrťfinále 4'].includes(m.matchType)
                        ).length;
                        deleteMessage = `Naozaj chcete zmazať všetky štvrťfinálové zápasy (${deleteCount}) pre kategóriu "${categories.find(c => c.id === selectedCategory)?.name || selectedCategory}"?`;
                    } else {
                        deleteCount = existingSpiderMatches.filter(m => 
                            ['finále', 'semifinále 1', 'semifinále 2', 'o 3. miesto'].includes(m.matchType)
                        ).length;
                        deleteMessage = `Naozaj chcete zmazať celý pavúk (${deleteCount} zápasov: finále, semifinále a o 3. miesto) pre kategóriu "${categories.find(c => c.id === selectedCategory)?.name || selectedCategory}"?`;
                    }
                    
                    return React.createElement(
                        'p',
                        { className: 'text-gray-600 mb-6' },
                        deleteMessage
                    );
                })(),
                
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

        // Obsah - pavúková tabuľka (s tabuľkou)
        React.createElement(
            'div',
            { className: 'flex-grow flex justify-center items-start w-full pt-24 pb-20' },
            React.createElement(
                'div',
                { 
                    className: 'bg-white p-8 rounded-xl shadow-lg',
                    style: { 
                        width: '100%', 
                        maxWidth: spiderLevel === 3 ? '2000px' : (spiderLevel === 2 ? '1600px' : '1200px'),
                    }
                },
                
                !selectedCategory ? (
                    React.createElement(
                        'div',
                        { className: 'text-center py-16 text-gray-500' },
                        React.createElement('i', { className: 'fa-solid fa-sitemap text-6xl mb-4 opacity-30' }),
                        React.createElement('h2', { className: 'text-2xl font-semibold mb-2' }, 'Pavúk play-off'),
                        React.createElement('p', { className: 'text-lg' }, 'Vyberte kategóriu pre zobrazenie pavúka')
                    )
                ) : !hasSpiderMatches ? (
                    React.createElement(
                        'div',
                        { className: 'text-center py-16 text-gray-500' },
                        React.createElement('i', { className: 'fa-solid fa-sitemap text-6xl mb-4 opacity-30' }),
                        React.createElement('h2', { className: 'text-2xl font-semibold mb-2' }, 'Pavúk play-off'),
                        React.createElement('p', { className: 'text-lg' }, 'Pre túto kategóriu neexistujú žiadne pavúkové zápasy. Kliknite na zelenú polovicu tlačidla "+" pre vygenerovanie pavúka.')
                    )
                ) : !spiderData ? (
                    React.createElement(
                        'div',
                        { className: 'text-center py-16 text-gray-500' },
                        React.createElement('i', { className: 'fa-solid fa-sitemap text-6xl mb-4 opacity-30' }),
                        React.createElement('h2', { className: 'text-2xl font-semibold mb-2' }, 'Pavúk play-off'),
                        React.createElement('p', { className: 'text-lg' }, 'Načítavam dáta...')
                    )
                ) : (
                    React.createElement(
                        'div',
                        { 
                            className: 'flex flex-col items-center',
                            style: { 
                                minHeight: '700px',
                                padding: '20px'
                            }
                        },
                        
                        // Nadpis
                        React.createElement(
                            'h2',
                            { 
                                className: 'text-2xl font-bold mb-12 text-gray-800',
                            },
                            `Play-off ${spiderLevel === 3 ? '(s osemfinále)' : (spiderLevel === 2 ? '(so štvrťfinále)' : '')} - ${categories.find(c => c.id === selectedCategory)?.name || selectedCategory}`
                        ),
                        
                        // Tabuľka pre pavúka - s orámovaním každej bunky
                        React.createElement(
                            'table',
                            {
                                style: {
                                    borderCollapse: 'collapse',
                                    width: '100%',
                                    tableLayout: 'fixed',
                                    border: '0px solid #d1d5db'
                                }
                            },
                            
                            // Vytvorenie tela tabuľky
                            React.createElement(
                                'tbody',
                                null,
                                
                                // ===== ÚROVEŇ 1 (len semifinále a finále) =====
                                spiderLevel === 1 && React.createElement(
                                    React.Fragment,
                                    null,
                                    
                                    // PRVÝ RIADOK - Finále (zabezpečený horizontálne) - so zvislou čiarou nadol
                                    React.createElement(
                                        'tr',
                                        { style: { height: '200px' } },
                                        React.createElement(
                                            'td',
                                            { 
                                                colSpan: 2,
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.final, 
                                                    title: 'Finále',
                                                    matchType: 'finále',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch
                                                })
                                            ),
                                            // Zvislá čiara od stredu bunky do spodného okraja
                                            React.createElement('div', { className: 'spider-line-vertical spider-line-vertical-bottom' })
                                        )
                                    ),
                                                                        
                                    React.createElement(
                                        'tr',
                                        { style: { height: '200px' } },
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '50%',
                                                    border: '0px solid #d1d5db',
                                                    borderRight: '2px solid #9ca3af', // Zvislé orámovanie medzi bunkami
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.semiFinals[0], 
                                                    title: 'Semifinále 1',
                                                    matchType: 'semifinále 1',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch
                                                })
                                            ),
                                            // Vodorovná čiara z ľavej bunky doprava (od stredu)
                                            React.createElement('div', { className: 'spider-line-horizontal spider-line-right' })
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '50%',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.semiFinals[1], 
                                                    title: 'Semifinále 2',
                                                    matchType: 'semifinále 2',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch
                                                })
                                            ),
                                            // Vodorovná čiara z pravej bunky doľava (od stredu)
                                            React.createElement('div', { className: 'spider-line-horizontal spider-line-left' })
                                        )
                                    ),
                                    
                                    // TRETÍ RIADOK - O 3. miesto (zabezpečený horizontálne) - so zvislou čiarou nahor
                                    React.createElement(
                                        'tr',
                                        { style: { height: '200px' } },
                                        React.createElement(
                                            'td',
                                            { 
                                                colSpan: 2,
                                                className: 'spider-cell',
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    border: '0px solid #d1d5db',
                                                    position: 'relative'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block', position: 'relative', zIndex: 10 } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.thirdPlace, 
                                                    title: 'O 3. miesto',
                                                    matchType: 'o 3. miesto',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch
                                                })
                                            ),
                                            // Zvislá čiara od stredu bunky do horného okraja
                                            React.createElement('div', { className: 'spider-line-vertical spider-line-vertical-top' })
                                        )
                                    )
                                ),
                                
                                // ===== ÚROVEŇ 2 (so štvrťfinále) =====
                                spiderLevel === 2 && React.createElement(
                                    React.Fragment,
                                    null,
                                    
                                    // PRVÝ RIADOK - QF1, Finále, QF3
                                    React.createElement(
                                        'tr',
                                        { style: { height: '200px' } },
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '33.33%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block' } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.quarterFinals[0], 
                                                    title: 'Štvrťfinále 1',
                                                    matchType: 'štvrťfinále 1',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch
                                                })
                                            )
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '33.33%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block' } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.final, 
                                                    title: 'Finále',
                                                    matchType: 'finále',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch
                                                })
                                            )
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '33.33%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block' } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.quarterFinals[2], 
                                                    title: 'Štvrťfinále 3',
                                                    matchType: 'štvrťfinále 3',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch
                                                })
                                            )
                                        )
                                    ),
                                    
                                    // DRUHÝ RIADOK - VŠETKY TRI STĹPCE ZLÚČENÉ a rozdelené na dva rovnaké
                                    React.createElement(
                                        'tr',
                                        { style: { height: '200px' } },
                                        React.createElement(
                                            'td',
                                            { 
                                                colSpan: 3,
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    border: '0px solid #d1d5db'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { 
                                                    style: { 
                                                        display: 'flex',
                                                        justifyContent: 'center',
                                                        alignItems: 'center',
                                                        width: '100%',
                                                        gap: '20%'
                                                    }
                                                },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.semiFinals[0], 
                                                    title: 'Semifinále 1',
                                                    matchType: 'semifinále 1',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch
                                                }),
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.semiFinals[1], 
                                                    title: 'Semifinále 2',
                                                    matchType: 'semifinále 2',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch
                                                })
                                            )
                                        )
                                    ),
                                    
                                    // TRETÍ RIADOK - QF2, O 3. miesto, QF4
                                    React.createElement(
                                        'tr',
                                        { style: { height: '200px' } },
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '33.33%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block' } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.quarterFinals[1], 
                                                    title: 'Štvrťfinále 2',
                                                    matchType: 'štvrťfinále 2',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch
                                                })
                                            )
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '33.33%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block' } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.thirdPlace, 
                                                    title: 'O 3. miesto',
                                                    matchType: 'o 3. miesto',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch
                                                })
                                            )
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '33.33%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block' } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.quarterFinals[3], 
                                                    title: 'Štvrťfinále 4',
                                                    matchType: 'štvrťfinále 4',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch
                                                })
                                            )
                                        )
                                    )
                                ),
                                
                                // ===== ÚROVEŇ 3 (s osemfinále) =====
                                spiderLevel === 3 && React.createElement(
                                    React.Fragment,
                                    null,
                                    
                                    // RIADOK 1 - Osemfinále 1, prázdno, prázdno, prázdno, Osemfinále 5
                                    React.createElement(
                                        'tr',
                                        { style: { height: '200px' } },
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block' } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.eightFinals[0], 
                                                    title: 'Osemfinále 1',
                                                    matchType: 'osemfinále 1',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch
                                                })
                                            )
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            }
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            }
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            }
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block' } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.eightFinals[4], 
                                                    title: 'Osemfinále 5',
                                                    matchType: 'osemfinále 5',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch
                                                })
                                            )
                                        )
                                    ),
                                    
                                    // RIADOK 2 - Štvrťfinále 1 (colspan=2), prázdno, Štvrťfinále 3 (colspan=2)
                                    React.createElement(
                                        'tr',
                                        { style: { height: '200px' } },
                                        React.createElement(
                                            'td',
                                            { 
                                                colSpan: 2,
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '40%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block' } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.quarterFinals[0], 
                                                    title: 'Štvrťfinále 1',
                                                    matchType: 'štvrťfinále 1',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch
                                                })
                                            )
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            }
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                colSpan: 2,
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '40%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block' } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.quarterFinals[2], 
                                                    title: 'Štvrťfinále 3',
                                                    matchType: 'štvrťfinále 3',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch
                                                })
                                            )
                                        )
                                    ),
                                    
                                    // RIADOK 3 - Osemfinále 2, prázdno, Finále, prázdno, Osemfinále 6
                                    React.createElement(
                                        'tr',
                                        { style: { height: '200px' } },
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block' } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.eightFinals[1], 
                                                    title: 'Osemfinále 2',
                                                    matchType: 'osemfinále 2',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch
                                                })
                                            )
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            }
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block' } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.final, 
                                                    title: 'Finále',
                                                    matchType: 'finále',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch
                                                })
                                            )
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            }
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block' } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.eightFinals[5], 
                                                    title: 'Osemfinále 6',
                                                    matchType: 'osemfinále 6',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch
                                                })
                                            )
                                        )
                                    ),
                                    
                                    // RIADOK 4 - prázdno, Semifinále 1, prázdno, Semifinále 2, prázdno
                                    React.createElement(
                                        'tr',
                                        { style: { height: '200px' } },
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            }
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block' } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.semiFinals[0], 
                                                    title: 'Semifinále 1',
                                                    matchType: 'semifinále 1',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch
                                                })
                                            )
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            }
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block' } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.semiFinals[1], 
                                                    title: 'Semifinále 2',
                                                    matchType: 'semifinále 2',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch
                                                })
                                            )
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            }
                                        )
                                    ),
                                    
                                    // RIADOK 5 - Osemfinále 3, prázdno, O 3. miesto, prázdno, Osemfinále 7
                                    React.createElement(
                                        'tr',
                                        { style: { height: '200px' } },
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block' } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.eightFinals[2], 
                                                    title: 'Osemfinále 3',
                                                    matchType: 'osemfinále 3',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch
                                                })
                                            )
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            }
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block' } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.thirdPlace, 
                                                    title: 'O 3. miesto',
                                                    matchType: 'o 3. miesto',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch
                                                })
                                            )
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            }
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block' } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.eightFinals[6], 
                                                    title: 'Osemfinále 7',
                                                    matchType: 'osemfinále 7',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch
                                                })
                                            )
                                        )
                                    ),
                                    
                                    // RIADOK 6 - Štvrťfinále 2 (colspan=2), prázdno, Štvrťfinále 4 (colspan=2)
                                    React.createElement(
                                        'tr',
                                        { style: { height: '200px' } },
                                        React.createElement(
                                            'td',
                                            { 
                                                colSpan: 2,
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '40%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block' } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.quarterFinals[1], 
                                                    title: 'Štvrťfinále 2',
                                                    matchType: 'štvrťfinále 2',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch
                                                })
                                            )
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            }
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                colSpan: 2,
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '40%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block' } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.quarterFinals[3], 
                                                    title: 'Štvrťfinále 4',
                                                    matchType: 'štvrťfinále 4',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch
                                                })
                                            )
                                        )
                                    ),
                                    
                                    // RIADOK 7 - Osemfinále 4, prázdno, prázdno, prázdno, Osemfinále 8
                                    React.createElement(
                                        'tr',
                                        { style: { height: '200px' } },
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block' } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.eightFinals[3], 
                                                    title: 'Osemfinále 4',
                                                    matchType: 'osemfinále 4',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch
                                                })
                                            )
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            }
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            }
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            }
                                        ),
                                        React.createElement(
                                            'td',
                                            { 
                                                style: {
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '10px',
                                                    width: '20%',
                                                    border: '0px solid #d1d5db'
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { style: { display: 'inline-block' } },
                                                React.createElement(MatchCell, { 
                                                    match: spiderData.eightFinals[7], 
                                                    title: 'Osemfinále 8',
                                                    matchType: 'osemfinále 8',
                                                    userProfileData: userProfileData,
                                                    generationInProgress: generationInProgress,
                                                    onGenerate: generateSingleMatch
                                                })
                                            )
                                        )
                                    )
                                )
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
