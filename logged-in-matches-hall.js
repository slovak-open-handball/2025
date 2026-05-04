// logged-in-matches-hall.js
import { collection, getDocs, doc, getDoc, onSnapshot, updateDoc, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const { useState, useEffect, useRef } = React;

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

const updateTeamNamesInMatches = async (matchesList, setTeamNames, currentTeamNames) => {
    if (!window.matchTracker || typeof window.matchTracker.getTeamNameByDisplayId !== 'function') {
        console.log('⚠️ matchTracker.getTeamNameByDisplayId nie je dostupný');
        return;
    }
    
    const updatedNames = {};
    let needsUpdate = false;
    
    console.log(`🔄 Spúšťam aktualizáciu názvov tímov pre ${matchesList.length} zápasov...`);
    
    for (const match of matchesList) {
        // Získanie názvu kategórie pre tento zápas
        let categoryName = match.categoryName;
        if (!categoryName && match.categoryId && window.categoriesData && window.categoriesData[match.categoryId]) {
            categoryName = window.categoriesData[match.categoryId];
        }
        
        if (!categoryName) {
            console.log(`⚠️ Zápas ${match.id} nemá názov kategórie, preskakujem`);
            continue;
        }
        
        // Spracovanie domáceho tímu
        if (match.homeTeamIdentifier) {
            // Získame aktuálny zobrazený názov tímu
            const currentDisplayName = currentTeamNames[match.homeTeamIdentifier] || getDisplayTeamName(match.homeTeamIdentifier);
            
            // 🔥 KONTROLA: Voláme getTeamNameByDisplayId LEN ak názov tímu obsahuje názov kategórie
            if (currentDisplayName && currentDisplayName.includes(categoryName)) {
                try {
                    console.log(`🔄 Domáci tím "${currentDisplayName}" obsahuje kategóriu "${categoryName}" → volám getTeamNameByDisplayId`);
                    const newName = await window.matchTracker.getTeamNameByDisplayId(currentDisplayName);
                    if (newName && newName !== currentDisplayName && newName !== updatedNames[match.homeTeamIdentifier]) {
                        updatedNames[match.homeTeamIdentifier] = newName;
                        needsUpdate = true;
                        console.log(`✅ Domáci tím "${currentDisplayName}" → "${newName}"`);
                    } else {
                        console.log(`ℹ️ Domáci tím "${currentDisplayName}" sa nezmenil → "${newName}"`);
                    }
                } catch (err) {
                    console.error(`Chyba pri získavaní názvu pre domáci tím ${currentDisplayName}:`, err);
                }
            } else {
                console.log(`⏭️ Domáci tím "${currentDisplayName}" NEOBSAHUJE kategóriu "${categoryName}" → preskakujem`);
            }
        }
        
        // Spracovanie hosťujúceho tímu
        if (match.awayTeamIdentifier) {
            // Získame aktuálny zobrazený názov tímu
            const currentDisplayName = currentTeamNames[match.awayTeamIdentifier] || getDisplayTeamName(match.awayTeamIdentifier);
            
            // 🔥 KONTROLA: Voláme getTeamNameByDisplayId LEN ak názov tímu obsahuje názov kategórie
            if (currentDisplayName && currentDisplayName.includes(categoryName)) {
                try {
                    console.log(`🔄 Hosťujúci tím "${currentDisplayName}" obsahuje kategóriu "${categoryName}" → volám getTeamNameByDisplayId`);
                    const newName = await window.matchTracker.getTeamNameByDisplayId(currentDisplayName);
                    if (newName && newName !== currentDisplayName && newName !== updatedNames[match.awayTeamIdentifier]) {
                        updatedNames[match.awayTeamIdentifier] = newName;
                        needsUpdate = true;
                        console.log(`✅ Hosťujúci tím "${currentDisplayName}" → "${newName}"`);
                    } else {
                        console.log(`ℹ️ Hosťujúci tím "${currentDisplayName}" sa nezmenil → "${newName}"`);
                    }
                } catch (err) {
                    console.error(`Chyba pri získavaní názvu pre hosťujúci tím ${currentDisplayName}:`, err);
                }
            } else {
                console.log(`⏭️ Hosťujúci tím "${currentDisplayName}" NEOBSAHUJE kategóriu "${categoryName}" → preskakujem`);
            }
        }
    }
    
    if (needsUpdate) {
        setTeamNames(prev => ({ ...prev, ...updatedNames }));
        console.log('✅ Aktualizované názvy tímov:', updatedNames);
    } else {
        console.log('ℹ️ Žiadne zmeny v názvoch tímov');
    }
};

// Funkcia na získanie názvu kategórie podľa ID
const getCategoryNameById = (categoryId) => {
    if (!categoryId) return null;
    
    // Najprv skúsime z window.categoriesData (ID -> názov)
    if (window.categoriesData && window.categoriesData[categoryId]) {
        return window.categoriesData[categoryId];
    }
    
    // Ak máme window.categoriesList (pole objektov s id a name)
    if (window.categoriesList) {
        const found = window.categoriesList.find(cat => cat.id === categoryId);
        if (found) return found.name;
    }
    
    return null;
};

// Funkcia na načítanie členov tímu z databázy podľa názvu tímu a NÁZVU kategórie (s real-time aktualizáciou)
const loadTeamMembers = async (teamName, categoryName, onUpdate, onMappedName) => {
    if (!window.db || !teamName || !categoryName) {
        console.log("Chýba db, teamName alebo categoryName");
        if (onUpdate) onUpdate([]);
        if (onMappedName) onMappedName(teamName);
        return () => {};
    }
    
    // 🔥 PRVÝ KROK: Prevedieme teamName cez matchTracker na správny názov
    let actualTeamName = teamName;
    if (window.matchTracker && typeof window.matchTracker.getTeamNameByDisplayId === 'function') {
        try {
            console.log(`🔄 Prevod názvu tímu: "${teamName}" → cez matchTracker`);
            const convertedName = await window.matchTracker.getTeamNameByDisplayId(teamName);
            if (convertedName && convertedName !== teamName) {
                actualTeamName = convertedName;
                console.log(`✅ Prevedený názov: "${teamName}" → "${actualTeamName}"`);
                // 🔥 ODOŠLEME ZMAPOVANÝ NÁZOV HORE
                if (onMappedName) {
                    onMappedName(actualTeamName);
                }
            } else {
                console.log(`ℹ️ Názov tímu sa nezmenil: "${teamName}"`);
                if (onMappedName) {
                    onMappedName(teamName);
                }
            }
        } catch (err) {
            console.error(`Chyba pri prevode názvu tímu "${teamName}":`, err);
            if (onMappedName) {
                onMappedName(teamName);
            }
        }
    } else {
        console.log(`⚠️ window.matchTracker.getTeamNameByDisplayId nie je dostupný, používam pôvodný názov: "${teamName}"`);
        if (onMappedName) {
            onMappedName(teamName);
        }
    }
    
    console.log(`=== VYHĽADÁVANIE ČLENOV TÍMU (real-time) ===`);
    console.log(`Pôvodný názov: "${teamName}"`);
    console.log(`Skutočný názov na vyhľadávanie: "${actualTeamName}"`);
    console.log(`Kategória: "${categoryName}"`);
    
    // Prehľadávame všetkých používateľov (kluby)
    const usersRef = collection(window.db, 'users');
    
    // Vytvoríme unsubscribe funkciu pre real-time počúvanie
    const unsubscribe = onSnapshot(usersRef, (usersSnapshot) => {
        console.log(`Real-time aktualizácia: Načítavam členov pre tím ${actualTeamName}`);
        
        for (const userDoc of usersSnapshot.docs) {
            const userId = userDoc.id;
            const userData = userDoc.data();
            const teams = userData.teams || {};
            
            // Prehľadávame všetky kategórie tohto používateľa
            for (const [categoryKey, teamsArray] of Object.entries(teams)) {
                if (categoryKey !== categoryName) continue;
                
                // Hľadáme tím s daným názvom - používame actualTeamName
                const foundTeam = (teamsArray || []).find(t => t.teamName === actualTeamName);
                
                if (foundTeam) {
                    console.log(`✅ Našiel som tím: "${actualTeamName}" v kategórii ${categoryKey} (real-time)`);
                    
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
                    
                    console.log(`Celkový počet členov tímu (real-time): ${members.length}`);
                    if (onUpdate) onUpdate(members);
                    return;
                }
            }
        }
        
        console.log(`❌ Nenašiel som tím: "${actualTeamName}" v kategórii: "${categoryName}"`);
        if (onUpdate) onUpdate([]);
    }, (error) => {
        console.error('Chyba pri real-time načítaní členov tímu:', error);
        if (onUpdate) onUpdate([]);
    });
    
    // Vrátime unsubscribe funkciu pre zrušenie odberu
    return unsubscribe;
};

// UPRAVENÝ TeamMembersList KOMPONENT - PRIDANÝ CALLBACK PRE ZMAPOVANÝ NÁZOV
const TeamMembersList = ({ teamName, categoryName, onMappedNameUpdate }) => {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [mappedName, setMappedName] = useState(teamName);
    
    useEffect(() => {
        setLoading(true);
        setError(null);
        
        if (!teamName || !categoryName) {
            setLoading(false);
            return;
        }
        
        // Callback pre aktualizáciu členov
        const handleMembersUpdate = (updatedMembers) => {
            // Filtrujeme iba hráčov a členov RT (bez šoférov)
            const filteredMembers = updatedMembers.filter(m => m.type === 'Hráč' || m.type === 'Člen RT (muž)' || m.type === 'Člen RT (žena)');
            
            // Usporiadame: najprv členovia RT, potom hráči
            const rtMembers = filteredMembers.filter(m => m.type !== 'Hráč');
            const players = filteredMembers.filter(m => m.type === 'Hráč');
            const sortedMembers = [...rtMembers, ...players];
            
            setMembers(sortedMembers);
            setLoading(false);
        };
        
        // 🔥 CALLBACK PRE ZMAPOVANÝ NÁZOV
        const handleMappedName = (newMappedName) => {
            if (newMappedName !== mappedName) {
                console.log(`📝 Zmapovaný názov tímu: "${teamName}" → "${newMappedName}"`);
                setMappedName(newMappedName);
                // Odoslanie zmapovaného názvu rodičovi
                if (onMappedNameUpdate && typeof onMappedNameUpdate === 'function') {
                    onMappedNameUpdate(newMappedName);
                }
            }
        };
        
        // Spustíme real-time počúvanie
        const unsubscribe = loadTeamMembers(teamName, categoryName, handleMembersUpdate, handleMappedName);
        
        // Časový limit pre prípad, že by sa nič nenačítalo
        const timeoutId = setTimeout(() => {
            setLoading(false);
        }, 5000);
        
        // Cleanup funkcia
        return () => {
            clearTimeout(timeoutId);
            if (unsubscribe && typeof unsubscribe === 'function') {
                unsubscribe();
            }
        };
    }, [teamName, categoryName]);
    
    // Funkcia pre kliknutie na člena
    const handleMemberClick = (member, index, arrayName) => {
        console.log(`=== KLIKNUTÉ NA ČLENA ===`);
        console.log(`Meno: ${member.firstName} ${member.lastName}`);
        console.log(`Typ: ${member.type}`);
        console.log(`Poradie v poli: ${index + 1}.`);
        console.log(`Názov poľa: ${arrayName}`);
        console.log(`Celkový počet v tomto poli: ${members.length}`);
        console.log(`Tím (pôvodný): ${teamName}`);
        console.log(`Tím (zmapovaný): ${mappedName}`);
        console.log(`Kategória: ${categoryName}`);
        console.log(`========================`);
    };
    
    // Získanie ikonky podľa typu člena
    const getMemberIcon = (memberType) => {
        if (memberType === 'Hráč') {
            return React.createElement('i', { className: 'fa-solid fa-user text-gray-500 mr-2', style: { width: '16px' } });
        } else if (memberType === 'Člen RT (muž)') {
            return React.createElement('i', { className: 'fa-solid fa-user-tie text-blue-500 mr-2', style: { width: '16px' } });
        } else if (memberType === 'Člen RT (žena)') {
            return React.createElement('i', { className: 'fa-solid fa-user-tie text-red-500 mr-2', style: { width: '16px' } });
        }
        return React.createElement('i', { className: 'fa-solid fa-user text-gray-500 mr-2', style: { width: '16px' } });
    };
    
    if (loading) {
        return React.createElement(
            'div',
            { className: 'bg-white rounded-lg border border-gray-200 p-4 h-full' },
            React.createElement(
                'div',
                { className: 'text-center py-4' },
                React.createElement('div', { className: 'animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400 mx-auto' }),
                React.createElement('p', { className: 'text-xs text-gray-400 mt-2' }, 'Načítavam členov...')
            )
        );
    }
    
    if (error) {
        return React.createElement(
            'div',
            { className: 'bg-white rounded-lg border border-gray-200 p-4 h-full' },
            React.createElement(
                'div',
                { className: 'text-center py-4 text-red-500 text-sm' },
                'Nepodarilo sa načítať členov tímu'
            )
        );
    }
    
    // Rozdelenie členov pre zobrazenie v skupinách
    const rtMembers = members.filter(m => m.type !== 'Hráč');
    const players = members.filter(m => m.type === 'Hráč');
    
    // Zobrazený názov tímu - použijeme zmapovaný názov ak existuje, inak pôvodný
    const displayTeamName = mappedName !== teamName ? mappedName : teamName;
    
    return React.createElement(
        'div',
        { className: 'bg-white rounded-lg border border-gray-200 overflow-hidden h-full' },
        React.createElement(
            'div',
            { className: 'bg-gray-50 px-4 py-2 border-b border-gray-200' },
            React.createElement(
                'h3',
                { className: 'font-semibold text-gray-800' },
                displayTeamName
            ),
            React.createElement(
                'p',
                { className: 'text-xs text-gray-500 mt-0.5' },
                'Spolu: ' + members.length + ' členov'
            )
        ),
        React.createElement(
            'div',
            { className: 'p-3' },
            // Členovia RT (spoločne)
            rtMembers.length > 0 && React.createElement(
                'div',
                { className: 'mb-3' },
                React.createElement(
                    'div',
                    { className: 'text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1' },
                    'Realizačný tím (' + rtMembers.length + ')'
                ),
                React.createElement(
                    'div',
                    { className: 'space-y-1' },
                    rtMembers.map((member, idx) => {
                        const fullName = (member.firstName + ' ' + member.lastName).trim() || 'Neznámy';
                        // Zistenie názvu poľa pre konzolu
                        const arrayName = member.type === 'Člen RT (muž)' ? 'menTeamMemberDetails' : 'womenTeamMemberDetails';
                        
                        return React.createElement(
                            'div',
                            { 
                                key: 'rt-' + idx, 
                                className: 'text-sm text-gray-700 cursor-pointer hover:bg-gray-100 p-1 rounded transition-colors',
                                onClick: () => handleMemberClick(member, idx, arrayName)
                            },
                            getMemberIcon(member.type),
                            fullName
                        );
                    })
                )
            ),
            // Hráči
            players.length > 0 && React.createElement(
                'div',
                { className: 'mb-2' },
                React.createElement(
                    'div',
                    { className: 'text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1' },
                    'Hráči (' + players.length + ')'
                ),
                React.createElement(
                    'div',
                    { className: 'space-y-1' },
                    players.map((member, idx) => {
                        const fullName = (member.firstName + ' ' + member.lastName).trim() || 'Neznámy';
                        // Číslo dresu PRED menom (bez znaku #)
                        const jerseyDisplay = member.jerseyNumber ? member.jerseyNumber + ' ' : '';
                        
                        return React.createElement(
                            'div',
                            { 
                                key: 'player-' + idx, 
                                className: 'text-sm text-gray-700 cursor-pointer hover:bg-gray-100 p-1 rounded transition-colors',
                                onClick: () => handleMemberClick(member, idx, 'playerDetails')
                            },
                            getMemberIcon(member.type),
                            jerseyDisplay + fullName
                        );
                    })
                )
            ),
            members.length === 0 && React.createElement(
                'div',
                { className: 'text-center py-4 text-gray-400 text-sm' },
                'Žiadni členovia tímu'
            )
        )
    );
};

const MatchTimer = ({ match, matchId, onTimeUpdate, categorySettings }) => {
    const [isRunning, setIsRunning] = useState(false);
    const [period, setPeriod] = useState(1);
    const [totalPeriods, setTotalPeriods] = useState(1);
    const [periodDuration, setPeriodDuration] = useState(20);
    const [displaySeconds, setDisplaySeconds] = useState(0);
    const [showEndMatchModal, setShowEndMatchModal] = useState(false);
    const [showForfeitModal, setShowForfeitModal] = useState(false);
    const [forfeitTeam, setForfeitTeam] = useState(null); // 'home' alebo 'away'
    const [selectedForfeitTeam, setSelectedForfeitTeam] = useState(null);
    const [showManualResultModal, setShowManualResultModal] = useState(false);
    const [manualHomeScore, setManualHomeScore] = useState('');
    const [manualAwayScore, setManualAwayScore] = useState('');
    
    const intervalRef = useRef(null);
    const isRunningRef = useRef(false);
    const startTimeRef = useRef(null);
    const localStartOffsetRef = useRef(0);
    const periodDurationRef = useRef(periodDuration);
    const periodRef = useRef(period);
    const lastServerUpdateRef = useRef(0);
    const displaySecondsRef = useRef(0);

    useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);
    useEffect(() => { periodDurationRef.current = periodDuration; }, [periodDuration]);
    useEffect(() => { periodRef.current = period; }, [period]);
    useEffect(() => { displaySecondsRef.current = displaySeconds; }, [displaySeconds]);

    const handleManualResultSubmit = async () => {
        const homeScoreInt = parseInt(manualHomeScore);
        const awayScoreInt = parseInt(manualAwayScore);
        
        // Validácia
        if (isNaN(homeScoreInt) || isNaN(awayScoreInt)) {
            alert('Prosím zadajte platné čísla pre oba výsledky');
            return;
        }
        
        if (homeScoreInt < 0 || awayScoreInt < 0) {
            alert('Výsledky nemôžu byť záporné');
            return;
        }
        
        if (window.db && matchId) {
            try {
                // Zastavíme časovač ak beží
                if (isRunningRef.current) {
                    stopLocalInterval();
                    setIsRunning(false);
                    isRunningRef.current = false;
                }
                
                const matchRef = doc(window.db, 'matches', matchId);
                
                // 🔥 DÔLEŽITÉ: Uložíme výsledok do finalScore (pre matchTracker)
                // a tiež do homeScore/awayScore pre zobrazenie
                await updateDoc(matchRef, {
                    homeScore: homeScoreInt,
                    awayScore: awayScoreInt,
                    finalScore: {
                        home: homeScoreInt,
                        away: awayScoreInt
                    },
                    status: 'completed',
                    manualResultEntered: true,
                    manualResultEnteredAt: Timestamp.now(),
                    manualTimeOffset: displaySeconds,
                    startedAt: null,
                    pausedAt: null,
                    updatedAt: Timestamp.now()
                });
                
                console.log(`Zápas ${matchId} bol ukončený s manuálnym výsledkom ${homeScoreInt}:${awayScoreInt}`);
                setShowManualResultModal(false);
                setManualHomeScore('');
                setManualAwayScore('');
                
                if (onTimeUpdate) onTimeUpdate({ seconds: displaySeconds, period, isRunning: false });
                
                // 🔥 PO MANUÁLNOM ZADANÍ VÝSLEDKU - aktualizujeme názvy tímov v globálnom zozname
                if (window.updateTeamNamesGlobally && typeof window.updateTeamNamesGlobally === 'function') {
                    await window.updateTeamNamesGlobally();
                }
            } catch (err) {
                console.error('Chyba pri ukladaní manuálneho výsledku:', err);
                alert('Nepodarilo sa uložiť výsledok');
            }
        }
    };

    const renderManualResultModal = () => {
        if (!showManualResultModal) return null;
        
        // Získame zmapované názvy tímov
        const homeTeamName = match.homeTeamIdentifier 
            ? (window.teamManager?.getTeamNameByDisplayIdSync?.(match.homeTeamIdentifier) || match.homeTeamIdentifier)
            : 'Domáci';
        const awayTeamName = match.awayTeamIdentifier 
            ? (window.teamManager?.getTeamNameByDisplayIdSync?.(match.awayTeamIdentifier) || match.awayTeamIdentifier)
            : 'Hostia';
        
        return React.createElement(
            'div',
            { 
                className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
                onClick: () => {
                    setShowManualResultModal(false);
                    setManualHomeScore('');
                    setManualAwayScore('');
                }
            },
            React.createElement(
                'div',
                { 
                    className: 'bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 p-6',  // Zmena: max-w-md → max-w-2xl (širšie)
                    onClick: (e) => e.stopPropagation()
                },
                React.createElement(
                    'h3',
                    { className: 'text-xl font-bold text-gray-800 mb-4 text-center' },
                    'Zadať výsledok manuálne'
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-600 mb-6 text-center text-sm' },  // Zmena: mb-4 → mb-6
                    'Zadajte konečný výsledok zápasu'
                ),
                
                // Dva inputy pre výsledky vedľa seba - širšie
                React.createElement(
                    'div',
                    { className: 'flex gap-6 mb-8' },  // Zmena: gap-4 → gap-6, mb-6 → mb-8
                    React.createElement(
                        'div',
                        { className: 'flex-1 text-center' },
                        React.createElement(
                            'label',
                            { className: 'block text-base font-medium text-gray-700 mb-3' },  // Zmena: text-sm → text-base, mb-2 → mb-3
                            homeTeamName
                        ),
                        React.createElement(
                            'input',
                            {
                                type: 'number',
                                value: manualHomeScore,
                                onChange: (e) => setManualHomeScore(e.target.value),
                                className: 'w-full px-6 py-4 text-center text-3xl font-bold border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none',  // Zmena: väčšie padding a text
                                min: '0',
                                step: '1'
                            }
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'flex items-center justify-center text-3xl font-bold text-gray-400 px-2' },  // Zmena: text-2xl → text-3xl
                        ':'
                    ),
                    React.createElement(
                        'div',
                        { className: 'flex-1 text-center' },
                        React.createElement(
                            'label',
                            { className: 'block text-base font-medium text-gray-700 mb-3' },  // Zmena: text-sm → text-base, mb-2 → mb-3
                            awayTeamName
                        ),
                        React.createElement(
                            'input',
                            {
                                type: 'number',
                                value: manualAwayScore,
                                onChange: (e) => setManualAwayScore(e.target.value),
                                className: 'w-full px-6 py-4 text-center text-3xl font-bold border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none',  // Zmena: väčšie padding a text
                                min: '0',
                                step: '1'
                            }
                        )
                    )
                ),
                
                // Dve tlačidlá: Zrušiť a Potvrdiť
                React.createElement(
                    'div',
                    { className: 'flex gap-4' },  // Zmena: gap-3 → gap-4
                    React.createElement(
                        'button',
                        {
                            onClick: () => {
                                setShowManualResultModal(false);
                                setManualHomeScore('');
                                setManualAwayScore('');
                            },
                            className: 'flex-1 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium transition-colors cursor-pointer text-center'  // Zmena: py-2 → py-3, rounded-lg → rounded-xl
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            onClick: handleManualResultSubmit,
                            disabled: manualHomeScore === '' || manualAwayScore === '',
                            className: `flex-1 py-3 rounded-xl font-semibold transition-colors text-center ${
                                manualHomeScore !== '' && manualAwayScore !== ''
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                                    : 'bg-white text-blue-600 border-2 border-blue-600 cursor-not-allowed'
                            }`  // Zmena: py-2 → py-3, rounded-lg → rounded-xl
                        },
                        'Potvrdiť'
                    )
                )
            )
        );
    };

    const handleForfeit = async () => {
        if (!window.db || !matchId || !selectedForfeitTeam) return;
        
        try {
            // Zastavíme časovač ak beží
            if (isRunningRef.current) {
                stopLocalInterval();
                setIsRunning(false);
                isRunningRef.current = false;
            }
            
            // Nastavíme kontumačný výsledok 10:0
            let homeScore = 0;
            let awayScore = 0;
            
            if (selectedForfeitTeam === 'home') {
                homeScore = 10;
                awayScore = 0;
            } else if (selectedForfeitTeam === 'away') {
                homeScore = 0;
                awayScore = 10;
            }
            
            const matchRef = doc(window.db, 'matches', matchId);
            
            await updateDoc(matchRef, {
                homeScore: homeScore,
                awayScore: awayScore,
                status: 'completed',
                isForfeit: true,
                forfeitTeam: selectedForfeitTeam,
                forfeitAt: Timestamp.now(),
                forfeitResult: {
                    isForfeit: true,
                    home: homeScore,
                    away: awayScore,
                    team: selectedForfeitTeam,
                    timestamp: Timestamp.now()
                },
                manualTimeOffset: 0,
                startedAt: null,
                pausedAt: null,
                updatedAt: Timestamp.now()
            });
            
            console.log(`Zápas ${matchId} bol kontumovaný v prospech ${selectedForfeitTeam === 'home' ? 'domácich' : 'hostí'} s výsledkom ${homeScore}:${awayScore}`);
            setShowForfeitModal(false);
            setSelectedForfeitTeam(null);
            
            if (onTimeUpdate) onTimeUpdate({ seconds: 0, period, isRunning: false });
            
            // 🔥 PO KONTUMÁCII - aktualizujeme názvy tímov v globálnom zozname
            if (window.updateTeamNamesGlobally && typeof window.updateTeamNamesGlobally === 'function') {
                await window.updateTeamNamesGlobally();
            }
        } catch (err) {
            console.error('Chyba pri kontumácii zápasu:', err);
        }
    };

    const formatTime = (totalSeconds) => {
        const mins = Math.floor(Math.max(0, totalSeconds) / 60);
        const secs = Math.max(0, totalSeconds) % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const updateDisplay = () => {
        if (!isRunningRef.current) return;
        const now = Date.now();
        const elapsed = Math.floor((now - startTimeRef.current) / 1000);
        const total = localStartOffsetRef.current + elapsed;
        const maxSec = periodDurationRef.current * 60;
        const clamped = Math.min(total, maxSec);
        setDisplaySeconds(clamped);
        if (clamped >= maxSec && total >= maxSec) {
            stopTimerAndSave();
        }
    };

    const startLocalInterval = (startSeconds) => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        startTimeRef.current = Date.now();
        localStartOffsetRef.current = startSeconds;
        intervalRef.current = setInterval(updateDisplay, 200);
    };

    const stopLocalInterval = () => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        startTimeRef.current = null;
    };

    const stopTimerAndSave = async () => {
        if (!isRunningRef.current) return;
        const finalSeconds = displaySeconds;
        stopLocalInterval();
        setIsRunning(false);
        isRunningRef.current = false;
        if (window.db && matchId) {
            try {
                lastServerUpdateRef.current = Date.now();
                const matchRef = doc(window.db, 'matches', matchId);
                await updateDoc(matchRef, {
                    manualTimeOffset: finalSeconds,
                    status: 'paused',
                    startedAt: null,
                    pausedAt: Timestamp.now(),
                    updatedAt: Timestamp.now()
                });
                if (onTimeUpdate) onTimeUpdate({ seconds: finalSeconds, period, isRunning: false });
                setTimeout(() => { lastServerUpdateRef.current = 0; }, 300);
            } catch (err) { console.error(err); }
        }
    };

    const startTimer = async () => {
        // Ak je zápas ukončený, nespúšťame časovač
        if (match?.status === 'completed') return;
        if (isRunningRef.current) return;
        const currentSeconds = displaySeconds;
        const maxSec = periodDuration * 60;
        if (currentSeconds >= maxSec) return;
        startLocalInterval(currentSeconds);
        setIsRunning(true);
        isRunningRef.current = true;
        if (window.db && matchId) {
            try {
                lastServerUpdateRef.current = Date.now();
                const matchRef = doc(window.db, 'matches', matchId);
                await updateDoc(matchRef, {
                    manualTimeOffset: currentSeconds,
                    startedAt: Timestamp.now(),
                    status: 'in-progress',
                    pausedAt: null,
                    updatedAt: Timestamp.now()
                });
                if (onTimeUpdate) onTimeUpdate({ seconds: currentSeconds, period, isRunning: true });
                setTimeout(() => { lastServerUpdateRef.current = 0; }, 300);
            } catch (err) {
                console.error(err);
                stopLocalInterval();
                setIsRunning(false);
                isRunningRef.current = false;
            }
        }
    };

    const addTime = (deltaSeconds) => {
        // Ak je zápas ukončený, neupravujeme čas
        if (match?.status === 'completed') return;
        let newSeconds = displaySeconds + deltaSeconds;
        const maxSec = periodDuration * 60;
        if (newSeconds < 0) newSeconds = 0;
        if (newSeconds > maxSec) newSeconds = maxSec;
        setDisplaySeconds(newSeconds);
        if (isRunningRef.current) {
            startTimeRef.current = Date.now();
            localStartOffsetRef.current = newSeconds;
        }
        if (window.db && matchId) {
            lastServerUpdateRef.current = Date.now();
            const status = isRunningRef.current ? 'in-progress' : 'paused';
            const updateData = {
                manualTimeOffset: newSeconds,
                status: status,
                updatedAt: Timestamp.now()
            };
            if (!isRunningRef.current) updateData.pausedAt = Timestamp.now();
            if (isRunningRef.current) updateData.startedAt = Timestamp.now();
            updateDoc(doc(window.db, 'matches', matchId), updateData)
                .then(() => setTimeout(() => { lastServerUpdateRef.current = 0; }, 300))
                .catch(console.error);
        }
    };

    // Synchronizácia z DB (pre iné zariadenia)
    useEffect(() => {
        if (!window.db || !matchId) return;
        const matchRef = doc(window.db, 'matches', matchId);
        const unsubscribe = onSnapshot(matchRef, (docSnap) => {
            if (!docSnap.exists()) return;
            const now = Date.now();
            if (lastServerUpdateRef.current && (now - lastServerUpdateRef.current) < 300) return;
            const data = docSnap.data();
            const serverStatus = data.status;
            const serverPeriod = data.currentPeriod || 1;
            let serverSeconds = data.manualTimeOffset || 0;
            if (serverStatus === 'in-progress' && data.startedAt) {
                const elapsed = Math.floor((now - data.startedAt.toDate().getTime()) / 1000);
                const maxSec = periodDurationRef.current * 60;
                serverSeconds = Math.min(serverSeconds + elapsed, maxSec);
            }
            
            if (serverPeriod !== periodRef.current) {
                setPeriod(serverPeriod);
                periodRef.current = serverPeriod;
            }
            
            setDisplaySeconds(serverSeconds);
            
            if (serverStatus === 'in-progress') {
                if (!isRunningRef.current) {
                    startLocalInterval(serverSeconds);
                    setIsRunning(true);
                    isRunningRef.current = true;
                    if (onTimeUpdate) onTimeUpdate({ seconds: serverSeconds, period: serverPeriod, isRunning: true });
                } else {
                    const diff = Math.abs(serverSeconds - displaySecondsRef.current);
                    if (diff > 0.5) {
                        startLocalInterval(serverSeconds);
                        if (onTimeUpdate) onTimeUpdate({ seconds: serverSeconds, period: serverPeriod, isRunning: true });
                    }
                }
            } else if (serverStatus === 'paused' && isRunningRef.current) {
                stopLocalInterval();
                setIsRunning(false);
                isRunningRef.current = false;
                if (onTimeUpdate) onTimeUpdate({ seconds: serverSeconds, period: serverPeriod, isRunning: false });
            }
        });
        return () => unsubscribe();
    }, [matchId]);

    // Inicializácia z props
    useEffect(() => {
        if (!match) return;
        if (categorySettings) {
            if (categorySettings.periods !== undefined) setTotalPeriods(categorySettings.periods);
            if (categorySettings.periodDuration !== undefined) setPeriodDuration(categorySettings.periodDuration);
        }
        const initialPeriod = match.currentPeriod || 1;
        setPeriod(initialPeriod);
        periodRef.current = initialPeriod;
        let initialSeconds = match.manualTimeOffset || 0;
    
        // Len pre in-progress počítame elapsed čas
        if (match.status === 'in-progress' && match.startedAt) {
            const elapsed = Math.floor((Date.now() - match.startedAt.toDate().getTime()) / 1000);
            const maxSec = (categorySettings?.periodDuration || 20) * 60;
            initialSeconds = Math.min(initialSeconds + elapsed, maxSec);
        }
    
        setDisplaySeconds(initialSeconds);
        
        // Spustíme časovač len ak je status in-progress a nie je completed
        if (match.status === 'in-progress') {
            startLocalInterval(initialSeconds);
            setIsRunning(true);
            isRunningRef.current = true;
        } else {
            stopLocalInterval();
            setIsRunning(false);
            isRunningRef.current = false;
        }
    
        return () => stopLocalInterval();
    }, [match?.id]);

    // Pomocné funkcie pre tlačidlá
    const canSubtractMinute = () => displaySeconds >= 60 && match?.status !== 'completed';
    const canAddMinute = () => displaySeconds + 60 <= periodDuration * 60 && match?.status !== 'completed';
    const canSubtractSecond = () => displaySeconds >= 1 && match?.status !== 'completed';
    const canAddSecond = () => displaySeconds + 1 <= periodDuration * 60 && match?.status !== 'completed';
    // Reset je povolený vždy (aj pre ukončený zápas)
    const canReset = () => true;

    const addMinute = () => canAddMinute() && addTime(60);
    const subtractMinute = () => canSubtractMinute() && addTime(-60);
    const addSecond = () => canAddSecond() && addTime(1);
    const subtractSecond = () => canSubtractSecond() && addTime(-1);
    const toggleTimer = () => {
        // Ak je zápas ukončený, nespúšťame/nezastavujeme časovač
        if (match?.status === 'completed') return;
        isRunningRef.current ? stopTimerAndSave() : startTimer();
    };

    // V MatchTimer komponente, nájdite funkciu resetTime a nahraďte ju touto verziou:

    const resetTime = async () => {
        if (!canReset()) return;
    
        // Zastavíme časovač ak beží
        if (isRunningRef.current) {
            stopLocalInterval();
            setIsRunning(false);
            isRunningRef.current = false;
        }
    
        // Resetneme čas na 0 a vymažeme všetky výsledky
        setDisplaySeconds(0);
        
        // Aktualizujeme v databáze - vymažeme všetky výsledky a kontumácie
        if (window.db && matchId) {
            try {
                lastServerUpdateRef.current = Date.now();
                const matchRef = doc(window.db, 'matches', matchId);
                
                // Získame aktuálne dáta zápasu, aby sme zachovali dôležité informácie
                const matchSnap = await getDoc(matchRef);
                const currentMatchData = matchSnap.exists() ? matchSnap.data() : {};
                
                // Pripravíme update objekt - vymažeme výsledkové polia
                const updateData = {
                    manualTimeOffset: 0,
                    currentPeriod: 1,
                    status: 'scheduled',
                    startedAt: null,
                    pausedAt: null,
                    updatedAt: Timestamp.now(),
                    // VYMAŽEME VÝSLEDKY
                    homeScore: null,
                    awayScore: null,
                    isForfeit: null,
                    forfeitTeam: null,
                    forfeitAt: null,
                    forfeitResult: null
                };
                
                // Zachováme dôležité polia, ktoré nechceme vymazať
                const fieldsToPreserve = [
                    'hallId', 'categoryId', 'categoryName', 'groupName', 
                    'homeTeamIdentifier', 'awayTeamIdentifier', 'matchType',
                    'isPlacementMatch', 'placementRank', 'scheduledTime'
                ];
                
                fieldsToPreserve.forEach(field => {
                    if (currentMatchData[field] !== undefined) {
                        updateData[field] = currentMatchData[field];
                    }
                });
                
                await updateDoc(matchRef, updateData);
                
                setPeriod(1);
                
                // 🔥 DÔLEŽITÉ: Po resetovaní zavoláme onTimeUpdate s tým, že už nie je výsledok
                if (onTimeUpdate) onTimeUpdate({ 
                    seconds: 0, 
                    period: 1, 
                    isRunning: false,
                    // Explicitne označíme, že výsledok bol vymazaný
                    resetComplete: true
                });
                
                setTimeout(() => { lastServerUpdateRef.current = 0; }, 300);
                
                console.log(`✅ Zápas ${matchId} bol resetovaný - výsledok vymazaný, stav nastavený na 'scheduled'`);
            } catch (err) {
                console.error('Chyba pri resetovaní časovača:', err);
            }
        }
    };

    const nextPeriod = async () => {
        // Ak je zápas ukončený, neprepíname periódu
        if (match?.status === 'completed') return;
        if (period >= totalPeriods) return;
        if (isRunningRef.current) await stopTimerAndSave();
        const newPeriod = period + 1;
        lastServerUpdateRef.current = Date.now();
        const matchRef = doc(window.db, 'matches', matchId);
        await updateDoc(matchRef, {
            currentPeriod: newPeriod,
            manualTimeOffset: 0,
            startedAt: null,
            status: 'paused',
            pausedAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        });
        setPeriod(newPeriod);
        setDisplaySeconds(0);
        if (onTimeUpdate) onTimeUpdate({ seconds: 0, period: newPeriod, isRunning: false });
        setTimeout(() => { lastServerUpdateRef.current = 0; }, 300);
    };
    
    const prevPeriod = async () => {
        // Ak je zápas ukončený, neprepíname periódu
        if (match?.status === 'completed') return;
        if (period <= 1) return;
        if (isRunningRef.current) await stopTimerAndSave();
        const newPeriod = period - 1;
        lastServerUpdateRef.current = Date.now();
        const matchRef = doc(window.db, 'matches', matchId);
        await updateDoc(matchRef, {
            currentPeriod: newPeriod,
            manualTimeOffset: 0,
            startedAt: null,
            status: 'paused',
            pausedAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        });
        setPeriod(newPeriod);
        setDisplaySeconds(0);
        if (onTimeUpdate) onTimeUpdate({ seconds: 0, period: newPeriod, isRunning: false });
        setTimeout(() => { lastServerUpdateRef.current = 0; }, 300);
    };

    // Upravená funkcia endMatch v MatchTimer komponente
    const endMatch = async () => {
        if (window.db && matchId) {
            try {
                // Zastavíme časovač ak beží
                if (isRunningRef.current) {
                    stopLocalInterval();
                    setIsRunning(false);
                    isRunningRef.current = false;
                }
                
                const matchRef = doc(window.db, 'matches', matchId);
                await updateDoc(matchRef, {
                    status: 'completed',
                    updatedAt: Timestamp.now()
                });
                console.log(`Zápas ${matchId} bol ukončený`);
                setShowEndMatchModal(false);
                if (onTimeUpdate) onTimeUpdate({ seconds: displaySeconds, period, isRunning: false });
                
                // 🔥 PO UKONČENÍ ZÁPASU - aktualizujeme názvy tímov v globálnom zozname
                if (window.updateTeamNamesGlobally && typeof window.updateTeamNamesGlobally === 'function') {
                    await window.updateTeamNamesGlobally();
                }
            } catch (err) {
                console.error('Chyba pri ukončovaní zápasu:', err);
            }
        }
    };

    // V MatchTimer komponente, nájdite funkciu renderForfeitModal a nahraďte ju touto verziou:

    const renderForfeitModal = () => {
        if (!showForfeitModal) return null;
        
        // Získame zmapované názvy tímov
        const homeTeamName = match.homeTeamIdentifier 
            ? (window.teamManager?.getTeamNameByDisplayIdSync?.(match.homeTeamIdentifier) || match.homeTeamIdentifier)
            : 'Domáci';
        const awayTeamName = match.awayTeamIdentifier 
            ? (window.teamManager?.getTeamNameByDisplayIdSync?.(match.awayTeamIdentifier) || match.awayTeamIdentifier)
            : 'Hostia';
        
        return React.createElement(
            'div',
            { 
                className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
                onClick: () => {
                    setShowForfeitModal(false);
                    setSelectedForfeitTeam(null);
                }
            },
            React.createElement(
                'div',
                { 
                    className: 'bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 p-6',
                    onClick: (e) => e.stopPropagation()
                },
                React.createElement(
                    'h3',
                    { className: 'text-2xl font-bold text-gray-800 mb-4 text-center' },  // Zväčšené: text-xl → text-2xl
                    'Kontumácia zápasu'
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-600 mb-6 text-center text-base' },  // Zväčšené: text-sm → text-base
                    'Vyberte tím, v prospech ktorého sa zápas kontumuje (10:0)'
                ),
                // Dve tlačidlá pre výber tímu vedľa seba
                React.createElement(
                    'div',
                    { className: 'flex gap-6 mb-8' },
                    React.createElement(
                        'button',
                        {
                            onClick: () => setSelectedForfeitTeam('home'),
                            className: `flex-1 py-4 rounded-xl font-bold transition-colors cursor-pointer text-center ${
                                selectedForfeitTeam === 'home' 
                                    ? 'bg-yellow-400 text-yellow-900 border-2 border-yellow-600' 
                                    : 'bg-gray-300 hover:bg-gray-400 text-gray-700'
                            }`
                        },
                            React.createElement('span', { className: 'block text-lg font-bold' }, 'Domáci'),  // Zväčšené: text-base → text-lg, pridaný font-bold
                            React.createElement('span', { className: 'block text-sm opacity-90 mt-1' }, homeTeamName)  // Zväčšené: text-xs → text-sm
                    ),
                    React.createElement(
                        'button',
                        {
                            onClick: () => setSelectedForfeitTeam('away'),
                            className: `flex-1 py-4 rounded-xl font-bold transition-colors cursor-pointer text-center ${
                                selectedForfeitTeam === 'away' 
                                    ? 'bg-yellow-400 text-yellow-900 border-2 border-yellow-600' 
                                    : 'bg-gray-300 hover:bg-gray-400 text-gray-700'
                            }`
                        },
                            React.createElement('span', { className: 'block text-lg font-bold' }, 'Hostia'),  // Zväčšené: text-base → text-lg, pridaný font-bold
                            React.createElement('span', { className: 'block text-sm opacity-90 mt-1' }, awayTeamName)  // Zväčšené: text-xs → text-sm
                    )
                ),
                // Dve tlačidlá: Zrušiť a Potvrdiť
                React.createElement(
                    'div',
                    { className: 'flex gap-4' },
                    React.createElement(
                        'button',
                        {
                            onClick: () => {
                                setShowForfeitModal(false);
                                setSelectedForfeitTeam(null);
                            },
                            className: 'flex-1 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold transition-colors cursor-pointer text-center'  // pridaný font-semibold
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            onClick: () => handleForfeit(),
                            disabled: !selectedForfeitTeam,
                            className: `flex-1 py-3 rounded-xl font-bold transition-colors text-center ${  // font-semibold → font-bold
                                selectedForfeitTeam 
                                    ? 'bg-green-600 hover:bg-green-700 text-white cursor-pointer' 
                                    : 'bg-white text-green-600 border-2 border-green-600 cursor-not-allowed'
                            }`,
                            style: !selectedForfeitTeam ? { cursor: 'not-allowed' } : {}
                        },
                        'Potvrdiť'
                    )
                )
            )
        );
    };

    // Render modálneho okna
    const renderEndMatchModal = () => {
        if (!showEndMatchModal) return null;
        
        return React.createElement(
            'div',
            { 
                className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
                onClick: () => setShowEndMatchModal(false)
            },
            React.createElement(
                'div',
                { 
                    className: 'bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6',
                    onClick: (e) => e.stopPropagation()
                },
                React.createElement(
                    'h3',
                    { className: 'text-xl font-bold text-gray-800 mb-4' },
                    'Ukončiť zápas'
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-600 mb-6' },
                    'Naozaj chcete ukončiť tento zápas? Po ukončení už nebude možné meniť čas ani výsledok.'
                ),
                React.createElement(
                    'div',
                    { className: 'flex gap-3 justify-end' },
                    React.createElement(
                        'button',
                        {
                            onClick: () => setShowEndMatchModal(false),
                            className: 'px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 transition-colors cursor-pointer'
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            onClick: endMatch,
                            className: 'px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer'
                        },
                        'Ukončiť zápas'
                    )
                )
            )
        );
    };

    const isMatchCompleted = match?.status === 'completed';
    
    // Render - pre ukončený zápas zobrazíme len správu a tlačidlo Reset
    if (isMatchCompleted) {
        return React.createElement('div', { className: 'bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden' },
            React.createElement('div', { className: 'bg-gray-50 px-6 py-3 border-b border-gray-200' },
                React.createElement('h3', { className: 'font-semibold text-gray-800' }, 'Športový časovač'),
                React.createElement('p', { className: 'text-xs text-gray-500 mt-0.5' }, `Trvanie periódy: ${periodDuration} min | Počet periód: ${totalPeriods}`)
            ),
            React.createElement('div', { className: 'p-6' },
                React.createElement('div', { className: 'text-center mb-6 py-4' },
                    React.createElement('div', { className: 'inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-50 text-green-700' },
                        React.createElement('i', { className: 'fa-solid fa-flag-checkered' }),
                        React.createElement('span', { className: 'font-medium' }, 'Zápas bol ukončený')
                    )
                ),
                // Iba tlačidlo Reset
                React.createElement('div', { className: 'flex flex-wrap items-center justify-center gap-2' },
                    React.createElement('button', { 
                        onClick: resetTime, 
                        className: 'px-4 py-2 rounded-lg font-semibold transition-colors text-sm bg-yellow-500 hover:bg-yellow-600 text-white cursor-pointer'
                    }, 
                        React.createElement('i', { className: 'fa-solid fa-arrow-rotate-left mr-1' }), 'Reset'
                    )
                )
            )
        );
    }
    
    // Normálny render pre neukončený zápas
    return React.createElement('div', { className: 'bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden' },
        React.createElement('div', { className: 'bg-gray-50 px-6 py-3 border-b border-gray-200' },
            React.createElement('h3', { className: 'font-semibold text-gray-800' }, 'Športový časovač'),
            React.createElement('p', { className: 'text-xs text-gray-500 mt-0.5' }, `Trvanie periódy: ${periodDuration} min | Počet periód: ${totalPeriods}`)
        ),
        React.createElement('div', { className: 'p-6' },
            // Časovač
            React.createElement('div', { className: 'text-center mb-6' },
                React.createElement('div', { className: 'text-6xl font-mono font-bold text-gray-800' }, formatTime(displaySeconds)),
                React.createElement('div', { className: 'mt-2 text-sm text-gray-500' }, `Perióda ${period} / ${totalPeriods}`)
            ),
            
            // Ovládacie tlačidlá
            React.createElement('div', { className: 'flex flex-wrap items-center justify-center gap-2 mb-6' },
                React.createElement('button', { 
                    onClick: toggleTimer, 
                    className: `px-4 py-2 rounded-lg font-semibold transition-colors text-sm ${
                        isRunning ? 'bg-red-600 hover:bg-red-700 text-white cursor-pointer' : 'bg-green-600 hover:bg-green-700 text-white cursor-pointer'
                    }` 
                },
                    React.createElement('i', { className: isRunning ? 'fa-solid fa-stop mr-1' : 'fa-solid fa-play mr-1' }), isRunning ? 'Stop' : 'Štart'
                ),
                React.createElement('span', { className: 'text-gray-300 mx-1' }, '|'),
                React.createElement('button', { onClick: subtractMinute, disabled: !canSubtractMinute(), className: `px-3 py-2 rounded-lg font-semibold transition-colors text-sm ${!canSubtractMinute() ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300 text-gray-700 cursor-pointer'}` }, React.createElement('i', { className: 'fa-solid fa-minus' })),
                React.createElement('span', { className: 'text-sm text-gray-600 px-1 font-medium' }, 'Min'),
                React.createElement('button', { onClick: addMinute, disabled: !canAddMinute(), className: `px-3 py-2 rounded-lg font-semibold transition-colors text-sm ${!canAddMinute() ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300 text-gray-700 cursor-pointer'}` }, React.createElement('i', { className: 'fa-solid fa-plus' })),
                React.createElement('span', { className: 'text-gray-300 mx-1' }, '|'),
                React.createElement('button', { onClick: subtractSecond, disabled: !canSubtractSecond(), className: `px-3 py-2 rounded-lg font-semibold transition-colors text-sm ${!canSubtractSecond() ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300 text-gray-700 cursor-pointer'}` }, React.createElement('i', { className: 'fa-solid fa-minus' })),
                React.createElement('span', { className: 'text-sm text-gray-600 px-1 font-medium' }, 'Sec'),
                React.createElement('button', { onClick: addSecond, disabled: !canAddSecond(), className: `px-3 py-2 rounded-lg font-semibold transition-colors text-sm ${!canAddSecond() ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300 text-gray-700 cursor-pointer'}` }, React.createElement('i', { className: 'fa-solid fa-plus' })),
                React.createElement('span', { className: 'text-gray-300 mx-1' }, '|'),
                React.createElement('button', { onClick: prevPeriod, disabled: period <= 1, className: `px-3 py-2 rounded-lg font-semibold transition-colors text-sm ${period <= 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300 text-gray-700 cursor-pointer'}` }, React.createElement('i', { className: 'fa-solid fa-minus' })),
                React.createElement('span', { className: 'text-sm text-gray-800 font-semibold px-1' }, 'Perióda'),
                React.createElement('button', { onClick: nextPeriod, disabled: period >= totalPeriods, className: `px-3 py-2 rounded-lg font-semibold transition-colors text-sm ${period >= totalPeriods ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300 text-gray-700 cursor-pointer'}` }, React.createElement('i', { className: 'fa-solid fa-plus' })),
                React.createElement('span', { className: 'text-gray-300 mx-1' }, '|'),
                React.createElement('button', { onClick: resetTime, className: 'px-4 py-2 rounded-lg font-semibold transition-colors text-sm bg-yellow-500 hover:bg-yellow-600 text-white cursor-pointer' }, React.createElement('i', { className: 'fa-solid fa-arrow-rotate-left mr-1' }), 'Reset')
            ),
            // Ďalšie tlačidlá (Ukončiť zápas, Zadať výsledok, Kontumácia)
            React.createElement('div', { className: 'flex flex-wrap items-center justify-center gap-2 mb-6 pt-2 border-t border-gray-100' },
                React.createElement('button', { 
                    onClick: () => setShowEndMatchModal(true), 
                    className: 'px-4 py-2 rounded-lg font-semibold transition-colors text-sm bg-red-600 hover:bg-red-700 text-white cursor-pointer'
                },
                    React.createElement('i', { className: 'fa-solid fa-flag-checkered mr-1' }), 'Ukončiť zápas'
                ),
                React.createElement('button', { 
                    onClick: () => setShowManualResultModal(true), 
                    className: 'px-4 py-2 rounded-lg font-semibold transition-colors text-sm bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                },
                    React.createElement('i', { className: 'fa-solid fa-pen-to-square mr-1' }), 'Zadať výsledok manuálne'
                ),
                React.createElement('button', { 
                    onClick: () => setShowForfeitModal(true), 
                    className: 'px-4 py-2 rounded-lg font-semibold transition-colors text-sm bg-purple-600 hover:bg-purple-700 text-white cursor-pointer'
                },
                    React.createElement('i', { className: 'fa-solid fa-gavel mr-1' }), 'Kontumácia'
                )
            ),
            // Tlačidlá pre gól, 7m, ŽK, ČK, MK, Vylúčenie
            React.createElement('div', { className: 'flex flex-wrap items-center justify-center gap-2 pt-2 border-t border-gray-100' },
                React.createElement('button', { 
                    onClick: () => console.log('Gól'), 
                    className: 'px-5 py-2 rounded-lg font-semibold transition-colors text-sm bg-green-500 hover:bg-green-600 text-white cursor-pointer'
                }, 'Gól'),
                React.createElement('button', { 
                    onClick: () => console.log('7m'), 
                    className: 'px-5 py-2 rounded-lg font-semibold transition-colors text-sm bg-teal-500 hover:bg-teal-600 text-white cursor-pointer'
                }, '7m'),
                React.createElement('button', { 
                    onClick: () => console.log('ŽK'), 
                    className: 'px-5 py-2 rounded-lg font-semibold transition-colors text-sm bg-yellow-500 hover:bg-yellow-600 text-white cursor-pointer'
                }, 'ŽK'),
                React.createElement('button', { 
                    onClick: () => console.log('ČK'), 
                    className: 'px-5 py-2 rounded-lg font-semibold transition-colors text-sm bg-red-600 hover:bg-red-700 text-white cursor-pointer'
                }, 'ČK'),
                React.createElement('button', { 
                    onClick: () => console.log('MK'), 
                    className: 'px-5 py-2 rounded-lg font-semibold transition-colors text-sm bg-blue-400 hover:bg-blue-500 text-white cursor-pointer'
                }, 'MK'),
                React.createElement('button', { 
                    onClick: () => console.log('Vylúčenie'), 
                    className: 'px-4 py-2 rounded-lg font-semibold transition-colors text-sm bg-orange-500 hover:bg-orange-600 text-white cursor-pointer'
                }, 'Vylúčenie')
            )
        ),
        renderEndMatchModal(),
        renderForfeitModal(),
        renderManualResultModal()
    );
};

// Komponent pre detail zápasu (s navigáciou medzi zápasmi a časovačom)
const MatchDetailView = ({ match, teamNames, onBack, hallInfo, categoryDrawColors, groupsData, allMatches, currentMatchIndex, onNavigate, onMatchUpdate }) => {
    const dateTime = formatMatchDateTime(match.scheduledTime);
    const [currentHomeScore, setCurrentHomeScore] = React.useState(match.homeScore);
    const [currentAwayScore, setCurrentAwayScore] = React.useState(match.awayScore);
    const isResultAvailable = currentHomeScore !== undefined && currentHomeScore !== null && currentAwayScore !== undefined && currentAwayScore !== null;
    const homeTeamDisplay = teamNames[match.homeTeamIdentifier] || getDisplayTeamName(match.homeTeamIdentifier);
    const awayTeamDisplay = teamNames[match.awayTeamIdentifier] || getDisplayTeamName(match.awayTeamIdentifier);
    const categoryColor = getCategoryDrawColor(match.categoryId);
    const lighterCategoryColor = getLighterColor(categoryColor);
    const matchColors = getMatchColors(match, groupsData);
    
    // STATE pre nastavenia kategórie
    const [categorySettings, setCategorySettings] = React.useState(null);
    const [loadingSettings, setLoadingSettings] = React.useState(true);
    
    // STATE pre aktuálny status zápasu (pre prípad, že by sa zmenil)
    const [currentMatchStatus, setCurrentMatchStatus] = React.useState(match.status || 'scheduled');

    const [homeTeamMappedName, setHomeTeamMappedName] = React.useState(homeTeamDisplay);
    const [awayTeamMappedName, setAwayTeamMappedName] = React.useState(awayTeamDisplay);
    
    // Získanie názvu kategórie z ID (pre vyhľadávanie členov tímu)
    const getCategoryDisplayName = () => {
        if (match.categoryName) return match.categoryName;
        if (match.categoryId && window.categoriesData && window.categoriesData[match.categoryId]) {
            return window.categoriesData[match.categoryId];
        }
        return null;
    };
    
    const categoryDisplayName = getCategoryDisplayName();
    
    // Funkcia na získanie textu stavu zápasu
    const getMatchStatusText = () => {
        switch (currentMatchStatus) {
            case 'in-progress':
                return 'Práve prebieha';
            case 'paused':
                return 'Pozastavený';
            case 'completed':
                return 'Ukončený';
            case 'scheduled':
            default:
                return 'Naplánovaný';
        }
    };
    
    // Funkcia na získanie farby stavu zápasu
    const getMatchStatusColor = () => {
        switch (currentMatchStatus) {
            case 'in-progress':
                return 'text-green-600 bg-green-50';
            case 'paused':
                return 'text-yellow-600 bg-yellow-50';
            case 'completed':
                return 'text-blue-600 bg-blue-50';
            case 'scheduled':
            default:
                return 'text-gray-500 bg-gray-50';
        }
    };

    React.useEffect(() => {
        // Ak sa zmapovaný názov domáceho tímu líši od pôvodného, aktualizujeme ho
        if (homeTeamMappedName !== homeTeamDisplay && match.homeTeamIdentifier) {
            console.log(`🔄 Aktualizujem názov domáceho tímu v zozname: "${homeTeamDisplay}" → "${homeTeamMappedName}"`);
            if (onMatchUpdate) {
                onMatchUpdate(match.id, { 
                    updatedHomeTeamName: homeTeamMappedName,
                    homeTeamIdentifier: match.homeTeamIdentifier
                });
            }
            // Aktualizujeme aj v globálnom zozname
            if (window.updateTeamNamesGlobally && typeof window.updateTeamNamesGlobally === 'function') {
                window.updateTeamNamesGlobally();
            }
        }
    }, [homeTeamMappedName]);
    
    React.useEffect(() => {
        // Ak sa zmapovaný názov hosťujúceho tímu líši od pôvodného, aktualizujeme ho
        if (awayTeamMappedName !== awayTeamDisplay && match.awayTeamIdentifier) {
            console.log(`🔄 Aktualizujem názov hosťujúceho tímu v zozname: "${awayTeamDisplay}" → "${awayTeamMappedName}"`);
            if (onMatchUpdate) {
                onMatchUpdate(match.id, { 
                    updatedAwayTeamName: awayTeamMappedName,
                    awayTeamIdentifier: match.awayTeamIdentifier
                });
            }
            // Aktualizujeme aj v globálnom zozname
            if (window.updateTeamNamesGlobally && typeof window.updateTeamNamesGlobally === 'function') {
                window.updateTeamNamesGlobally();
            }
        }
    }, [awayTeamMappedName]);

    React.useEffect(() => {
        if (!window.db || !match.id) return;

        const matchRef = doc(window.db, 'matches', match.id);
        const unsubscribe = onSnapshot(matchRef, (docSnap) => {
            if (docSnap.exists()) {
                const updatedMatch = docSnap.data();
                const newHomeScore = updatedMatch.homeScore;
                const newAwayScore = updatedMatch.awayScore;
                const newStatus = updatedMatch.status || 'scheduled';
            
                // Aktualizujeme lokálne stavy
                setCurrentHomeScore(newHomeScore);
                setCurrentAwayScore(newAwayScore);
                setCurrentMatchStatus(newStatus);
            
                // Aktualizujeme stav v nadradenom komponente
                if (onMatchUpdate) {
                    onMatchUpdate(match.id, { 
                        homeScore: newHomeScore, 
                        awayScore: newAwayScore,
                        status: newStatus
                    });
                }
            }
        });
    
        return () => unsubscribe();
    }, [match.id]);
    
    // Real-time počúvanie zmien statusu zápasu
    React.useEffect(() => {
        if (!window.db || !match.id) return;
        
        console.log(`[MatchDetailView] Nastavujem real-time listener pre zápas ${match.id}`);
        
        const matchRef = doc(window.db, 'matches', match.id);
        const unsubscribe = onSnapshot(matchRef, (docSnap) => {
            if (docSnap.exists()) {
                const updatedMatch = docSnap.data();
                const newStatus = updatedMatch.status || 'scheduled';
                const oldStatus = currentMatchStatus;
                
                console.log(`[MatchDetailView] Zmena statusu: ${oldStatus} -> ${newStatus}`);
                
                // VŽDY aktualizujeme status, nie len pri zmene
                setCurrentMatchStatus(newStatus);
                
                // Aktualizujeme aj stav v hornom komponente
                if (onMatchUpdate) {
                    onMatchUpdate(match.id, { status: newStatus });
                }
            }
        }, (error) => {
            console.error(`[MatchDetailView] Chyba pri počúvaní zápasu ${match.id}:`, error);
        });
        
        return () => {
            console.log(`[MatchDetailView] Ruším real-time listener pre zápas ${match.id}`);
            unsubscribe();
        };
    }, [match.id]); // Odstránili sme currentMatchStatus z dependecií, aby sme neustále neprepájali listener
    
    // Načítanie nastavení kategórie z databázy
    React.useEffect(() => {
        const loadCategorySettings = async () => {
            if (!window.db || !match.categoryId) {
                setLoadingSettings(false);
                return;
            }
            
            try {
                const settingsRef = doc(window.db, 'settings', 'categories');
                const settingsSnap = await getDoc(settingsRef);
                
                if (settingsSnap.exists()) {
                    const data = settingsSnap.data();
                    const categoryData = data[match.categoryId];
                    if (categoryData) {
                        setCategorySettings({
                            periods: categoryData.periods ?? 2,
                            periodDuration: categoryData.periodDuration ?? 20,
                            breakDuration: categoryData.breakDuration ?? 2,
                            matchBreak: categoryData.matchBreak ?? 5,
                            timeoutCount: categoryData.timeoutCount ?? 2,
                            timeoutDuration: categoryData.timeoutDuration ?? 1,
                            exclusionTime: categoryData.exclusionTime ?? 2
                        });
                        console.log(`[MatchDetailView] Načítané nastavenia pre kategóriu ${match.categoryId}:`, {
                            periods: categoryData.periods ?? 2,
                            periodDuration: categoryData.periodDuration ?? 20
                        });
                    } else {
                        console.log(`[MatchDetailView] Kategória ${match.categoryId} nemá vlastné nastavenia, používam default`);
                        setCategorySettings({
                            periods: 2,
                            periodDuration: 20,
                            breakDuration: 2,
                            matchBreak: 5,
                            timeoutCount: 2,
                            timeoutDuration: 1,
                            exclusionTime: 2
                        });
                    }
                } else {
                    setCategorySettings({
                        periods: 2,
                        periodDuration: 20,
                        breakDuration: 2,
                        matchBreak: 5,
                        timeoutCount: 2,
                        timeoutDuration: 1,
                        exclusionTime: 2
                    });
                }
            } catch (err) {
                console.error('Chyba pri načítaní nastavení kategórie:', err);
                setCategorySettings({
                    periods: 2,
                    periodDuration: 20,
                    breakDuration: 2,
                    matchBreak: 5,
                    timeoutCount: 2,
                    timeoutDuration: 1,
                    exclusionTime: 2
                });
            } finally {
                setLoadingSettings(false);
            }
        };
        
        loadCategorySettings();
    }, [match.categoryId]);
    
    // Sledujeme zmeny match.status z props (napr. pri navigácii medzi zápasmi)
    React.useEffect(() => {
        if (match.status && match.status !== currentMatchStatus) {
            console.log(`[MatchDetailView] Aktualizujem status z props: ${match.status}`);
            setCurrentMatchStatus(match.status);
        }
    }, [match.status]);
    
    // Získanie informácií o skupine
    let groupInfo = null;
    if (match.groupName && !match.isPlacementMatch) {
        groupInfo = getGroupTypeColors(match.groupName, match.categoryId, groupsData);
    }
    
    // Formátovanie dátumu pre detail
    const formattedDate = dateTime?.dateObj ? formatDateHeader(dateTime.dateObj) : 'Dátum neznámy';
    
    // Či existuje predchádzajúci a nasledujúci zápas
    const hasPrevious = currentMatchIndex > 0;
    const hasNext = currentMatchIndex < allMatches.length - 1;
    
    // Handler pre aktualizáciu časovača
    const handleTimeUpdate = (timeData) => {
        if (onMatchUpdate) {
            onMatchUpdate(match.id, {
                timerMinutes: timeData.minutes,
                timerSeconds: timeData.seconds,
                currentPeriod: timeData.period,
                timerRunning: timeData.isRunning
            });
        }
    };
    
    return React.createElement(
        'div',
        { className: 'max-w-6xl mx-auto px-4 py-6' },
        
        // Hlavička s tlačidlami navigácie
        React.createElement(
            'div',
            { className: 'mb-6 flex flex-wrap items-center justify-between gap-3' },
            React.createElement(
                'button',
                {
                    onClick: onBack,
                    className: 'flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors cursor-pointer'
                },
                React.createElement('i', { className: 'fa-solid fa-arrow-left' }),
                React.createElement('span', {}, 'Späť na zoznam zápasov')
            ),
            // V MatchDetailView komponente - nájdite navigačné tlačidlá a upravte className:

            React.createElement(
                'div',
                { className: 'flex gap-3' },
                React.createElement(
                    'button',
                    {
                        onClick: () => hasPrevious && onNavigate('prev'),
                        disabled: !hasPrevious,
                        className: `flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                            hasPrevious 
                                ? 'bg-blue-500 hover:bg-blue-600 text-white cursor-pointer' 
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`
                    },
                    React.createElement('i', { className: 'fa-solid fa-chevron-left' }),
                    React.createElement('span', {}, 'Predchádzajúci')
                ),
                React.createElement(
                    'button',
                    {
                        onClick: () => hasNext && onNavigate('next'),
                        disabled: !hasNext,
                        className: `flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                            hasNext 
                                ? 'bg-blue-500 hover:bg-blue-600 text-white cursor-pointer' 
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`
                    },
                    React.createElement('span', {}, 'Nasledujúci'),
                    React.createElement('i', { className: 'fa-solid fa-chevron-right' })
                )
            )
        ),
        
        // Nadpis s názvom haly a poradím zápasu
        React.createElement(
            'div',
            { className: 'text-center mb-6' },
            React.createElement('h1', { className: 'text-2xl font-bold text-gray-800' }, 'Detail zápasu'),
            React.createElement(
                'div',
                { className: 'flex items-center justify-center gap-2 mt-1' },
                React.createElement('i', { className: 'fa-solid fa-location-dot text-blue-500 text-sm' }),
                React.createElement('span', { className: 'text-gray-600' }, hallInfo?.name || 'Športová hala')
            ),
            React.createElement(
                'p',
                { className: 'text-xs text-gray-400 mt-1' },
                `Zápas ${currentMatchIndex + 1} z ${allMatches.length}`
            )
        ),
        
        // Karta s detailom zápasu
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden mb-6' },
            
            // Hlavička zápasu - dátum, čas, typy
            React.createElement(
                'div',
                { className: 'bg-gray-50 px-6 py-3 border-b border-gray-200' },
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
                            React.createElement('span', { className: 'text-gray-700 text-sm' }, formattedDate)
                        ),
                        React.createElement(
                            'div',
                            { className: 'flex items-center gap-2' },
                            React.createElement('i', { className: 'fa-regular fa-clock text-gray-400' }),
                            React.createElement('span', { className: 'font-mono text-gray-700 text-sm' }, dateTime?.time || '--:--')
                        ),
                        // Zobrazenie stavu zápasu
                        React.createElement(
                            'div',
                            { className: `inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getMatchStatusColor()}` },
                            React.createElement('i', { 
                                className: currentMatchStatus === 'in-progress' ? 'fa-solid fa-play' :
                                          currentMatchStatus === 'paused' ? 'fa-solid fa-pause' :
                                          currentMatchStatus === 'completed' ? 'fa-solid fa-check' :
                                          'fa-regular fa-clock'
                            }),
                            React.createElement('span', {}, getMatchStatusText())
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'flex flex-wrap gap-2' },
                        match.matchType && !match.isPlacementMatch && React.createElement(
                            'span',
                            {
                                className: 'inline-block text-xs px-2 py-0.5 rounded-full',
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
                                className: 'inline-block text-xs px-2 py-0.5 rounded-full',
                                style: {
                                    backgroundColor: ELIMINATION_COLORS.backgroundColor,
                                    color: ELIMINATION_COLORS.textColor,
                                    fontWeight: '500'
                                }
                            },
                            'o ' + match.placementRank + '. miesto'
                        ),
                        match.groupName && !match.isPlacementMatch && React.createElement(
                            'span',
                            {
                                className: 'inline-block text-xs px-2 py-0.5 rounded-full',
                                style: {
                                    backgroundColor: groupInfo?.backgroundColor || matchColors.backgroundColor,
                                    color: groupInfo?.textColor || matchColors.textColor,
                                    fontWeight: '500'
                                }
                            },
                            match.groupName
                        ),
                        (match.categoryName || categoryDisplayName) && React.createElement(
                            'span',
                            {
                                className: 'inline-block text-xs px-2 py-0.5 rounded-full',
                                style: {
                                    backgroundColor: lighterCategoryColor,
                                    color: categoryColor,
                                    fontWeight: '500'
                                }
                            },
                            match.categoryName || categoryDisplayName
                        )
                    )
                )
            ),
            
            // Výsledok zápasu
            React.createElement(
                'div',
                { className: 'px-6 py-6 bg-gradient-to-r from-gray-50 to-white' },
                React.createElement(
                    'div',
                    { className: 'grid grid-cols-3 gap-4 items-center' },
                    React.createElement(
                        'div',
                        { className: 'text-center' },
                        React.createElement('div', { className: 'text-xs text-gray-500 mb-1' }, 'DOMÁCI'),
                        React.createElement('div', { className: 'text-lg font-bold text-gray-800' }, homeTeamDisplay)
                    ),
                    React.createElement(
                        'div',
                        { className: 'text-center' },
                        isResultAvailable ?
                            React.createElement(
                                'div',
                                { className: 'flex items-center justify-center gap-3' },
                                React.createElement('span', { className: 'text-3xl font-bold text-gray-800' }, currentHomeScore),
                                React.createElement('span', { className: 'text-xl text-gray-400' }, ':'),
                                React.createElement('span', { className: 'text-3xl font-bold text-gray-800' }, currentAwayScore)
                            ) :
                            React.createElement(
                                'div',
                                { className: 'text-center' },
                                React.createElement('span', { className: 'text-lg text-gray-400 font-medium' }, 'VS'),
                                React.createElement('div', { className: 'text-xs text-gray-400 mt-1' }, getMatchStatusText())
                            )
                    ),
                    React.createElement(
                        'div',
                        { className: 'text-center' },
                        React.createElement('div', { className: 'text-xs text-gray-500 mb-1' }, 'HOSTIA'),
                        React.createElement('div', { className: 'text-lg font-bold text-gray-800' }, awayTeamDisplay)
                    )
                )
            ),
            
            // Detailné informácie - typ zápasu a umiestnenie
            (match.matchType || (match.isPlacementMatch && match.placementRank)) && React.createElement(
                'div',
                { className: 'border-t border-gray-200 px-6 py-2' },
                React.createElement(
                    'div',
                    { className: 'flex flex-wrap gap-4 text-sm' },
                    match.matchType && React.createElement(
                        'div',
                        null,
                        React.createElement('span', { className: 'text-gray-500' }, 'Typ zápasu: '),
                        React.createElement('span', { className: 'text-gray-800' }, match.matchType)
                    ),
                    match.isPlacementMatch && match.placementRank && React.createElement(
                        'div',
                        null,
                        React.createElement('span', { className: 'text-gray-500' }, 'O umiestnenie: '),
                        React.createElement('span', { className: 'text-gray-800' }, match.placementRank + '. miesto')
                    )
                )
            )
        ),
        
        // Časovač zápasu - TERAZ S PREDANÝM categorySettings
        !loadingSettings && React.createElement(MatchTimer, {
            match: { ...match, status: currentMatchStatus, homeScore: currentHomeScore, awayScore: currentAwayScore },
            matchId: match.id,
            onTimeUpdate: handleTimeUpdate,
            categorySettings: categorySettings
        }),
        
        // Ak sa ešte načítavajú nastavenia, zobrazíme spinner
        loadingSettings && React.createElement(
            'div',
            { className: 'bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl p-4 text-white shadow-xl text-center' },
            React.createElement('div', { className: 'animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto' }),
            React.createElement('p', { className: 'text-sm mt-2' }, 'Načítavam nastavenia časovača...')
        ),
        
        // Dva boxy s členmi tímov vedľa seba (po časovači)
        React.createElement(
            'div',
            { className: 'grid grid-cols-1 md:grid-cols-2 gap-6 mt-6' },
            React.createElement(TeamMembersList, {
                teamName: homeTeamDisplay,
                categoryName: categoryDisplayName,
                onMappedNameUpdate: setHomeTeamMappedName
            }),
            React.createElement(TeamMembersList, {
                teamName: awayTeamDisplay,
                categoryName: categoryDisplayName,
                onMappedNameUpdate: setAwayTeamMappedName
            })
        )
    );
};

// Hlavný komponent MatchesHallApp - upravený s podporou URL parametrov a real-time aktualizáciou farieb tlačidiel
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
    const [categoriesList, setCategoriesList] = useState([]);
    
    // Nové stavy pre detail zápasu
    const [selectedMatch, setSelectedMatch] = useState(null);
    const [showingDetail, setShowingDetail] = useState(false);
    const [allMatchesList, setAllMatchesList] = useState([]);
    const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
    
    // Stav pre real-time aktualizáciu statusov zápasov
    const [matchStatuses, setMatchStatuses] = useState({});
    
    // Funkcia na vytvorenie hash pre zápas
    const createMatchHash = (homeTeamId, awayTeamId) => {
        // Nahradíme medzery za pomlčky a potom zakódujeme
        const encodedHome = encodeURIComponent(homeTeamId.replace(/ /g, '-'));
        const encodedAway = encodeURIComponent(awayTeamId.replace(/ /g, '-'));
        return `#match/${encodedHome}/${encodedAway}`;
    };
    
    // Funkcia na parsovanie hash z URL
    const parseMatchHash = () => {
        const hash = window.location.hash;
        const matchPattern = /^#match\/([^/]+)\/([^/]+)$/;
        const match = hash.match(matchPattern);
        if (match) {
            // Dekódujeme a nahradíme pomlčky späť na medzery
            const homeTeamIdentifier = decodeURIComponent(match[1]).replace(/-/g, ' ');
            const awayTeamIdentifier = decodeURIComponent(match[2]).replace(/-/g, ' ');
            return {
                homeTeamIdentifier: homeTeamIdentifier,
                awayTeamIdentifier: awayTeamIdentifier
            };
        }
        return null;
    };
    
    // Funkcia na vyhľadanie zápasu podľa identifikátorov
    const findMatchByIdentifiers = (homeTeamIdentifier, awayTeamIdentifier, matchesList) => {
        return matchesList.findIndex(match => 
            match.homeTeamIdentifier === homeTeamIdentifier && 
            match.awayTeamIdentifier === awayTeamIdentifier
        );
    };
    
    // Funkcia na aktualizáciu URL pri zmene zápasu
    const updateUrlForMatch = (match) => {
        if (match && match.homeTeamIdentifier && match.awayTeamIdentifier) {
            const newHash = createMatchHash(match.homeTeamIdentifier, match.awayTeamIdentifier);
            // Použijeme replaceState aby sme neukladali každý krok do histórie zbytočne
            window.history.replaceState(null, '', newHash);
        }
    };
    
    // Funkcia na zobrazenie detailu zápasu podľa URL
    const showMatchFromUrl = (matchesList) => {
        const urlMatch = parseMatchHash();
        if (urlMatch && matchesList.length > 0) {
            const matchIndex = findMatchByIdentifiers(
                urlMatch.homeTeamIdentifier, 
                urlMatch.awayTeamIdentifier, 
                matchesList
            );
            if (matchIndex !== -1) {
                setSelectedMatch(matchesList[matchIndex]);
                setCurrentMatchIndex(matchIndex);
                setShowingDetail(true);
                // Nezabudneme nastaviť loading na false, ak už bol true
                setLoading(false);
                return true;
            }
        }
        // Ak sme nenašli zápas podľa URL, uistíme sa, že nie sme v detaile
        setShowingDetail(false);
        setSelectedMatch(null);
        return false;
    };
    
    // Funkcia na nastavenie real-time listenera pre zmeny statusov a výsledkov zápasov
    const setupMatchesRealTimeListener = (hallId) => {
        if (!window.db || !hallId) return;
        
        const matchesRef = collection(window.db, 'matches');
        
        // Vytvoríme dotaz na zápasy v danej hale
        const unsubscribe = onSnapshot(matchesRef, (snapshot) => {
            const updatedStatuses = {};
            const updatedMatches = [];
            let hasStatusChange = false;
            
            snapshot.forEach((doc) => {
                const match = {
                    id: doc.id,
                    ...doc.data()
                };
                
                if (match.hallId === hallId) {
                    // Kontrola či došlo k zmene statusu
                    const oldStatus = matchStatuses[match.id];
                    const newStatus = match.status || 'scheduled';
                    
                    if (oldStatus && oldStatus !== newStatus) {
                        hasStatusChange = true;
                        console.log(`🔄 Zápas ${match.id} zmenil status z "${oldStatus}" na "${newStatus}" - spustím aktualizáciu názvov tímov`);
                    }
                    
                    updatedStatuses[match.id] = newStatus;
                    updatedMatches.push(match);
                    
                    // Aktualizujeme matches (hlavný zoznam)
                    setMatches(prevMatches => {
                        const existingIndex = prevMatches.findIndex(m => m.id === match.id);
                        if (existingIndex !== -1) {
                            const updatedPrevMatches = [...prevMatches];
                            updatedPrevMatches[existingIndex] = { ...updatedPrevMatches[existingIndex], ...match };
                            return updatedPrevMatches;
                        } else {
                            return [...prevMatches, match];
                        }
                    });
                    
                    // Aktualizujeme allMatchesList (zoznam pre detail)
                    setAllMatchesList(prevList => {
                        const existingIndex = prevList.findIndex(m => m.id === match.id);
                        if (existingIndex !== -1) {
                            const updatedList = [...prevList];
                            updatedList[existingIndex] = { ...updatedList[existingIndex], ...match };
                            return updatedList;
                        } else {
                            return [...prevList, match];
                        }
                    });
                }
            });
            
            setMatchStatuses(updatedStatuses);
            
            // 🔥 AK DOŠLO K ZMENE STATUSU AKÉHOKOĽVEK ZÁPASU, SPUSTÍME AKTUALIZÁCIU NÁZVOV TÍMOV
            if (hasStatusChange && updatedMatches.length > 0) {
                console.log(`🏁 Zistená zmena statusu zápasu - spúšťam aktualizáciu názvov tímov`);
                setTimeout(() => {
                    if (window.updateTeamNamesGlobally && typeof window.updateTeamNamesGlobally === 'function') {
                        window.updateTeamNamesGlobally();
                    }
                }, 100);
            }
            
            // Zoradíme matches podľa času
            setMatches(prevMatches => {
                return [...prevMatches].sort((a, b) => {
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
            });
            
            setAllMatchesList(prevList => {
                return [...prevList].sort((a, b) => {
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
            });
            
        }, (error) => {
            console.error('Chyba pri real-time načítaní zápasov:', error);
        });
        
        return unsubscribe;
    };

    // Načítanie farieb kategórií a názvov z databázy
    const loadCategoryColors = async () => {
        if (!window.db) return;
        
        try {
            const settingsRef = doc(window.db, 'settings', 'categories');
            const settingsSnap = await getDoc(settingsRef);
            
            if (settingsSnap.exists()) {
                const data = settingsSnap.data();
                const colors = {};
                const categories = {};
                const list = [];
                
                Object.entries(data).forEach(([catId, catData]) => {
                    if (catData.drawColor) {
                        colors[catId] = catData.drawColor;
                    }
                    if (catData.name) {
                        categories[catId] = catData.name;
                        list.push({ id: catId, name: catData.name });
                    }
                });
                
                setCategoryDrawColors(colors);
                setCategoriesData(categories);
                setCategoriesList(list);
                window.categoryDrawColors = colors;
                window.categoriesData = categories;
                window.categoriesList = list;
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

    // Spracovanie názvov tímov pre všetky zápasy - ASYNCHRÓNNA VERZIA S MAPOVANÍM
    const processTeamNames = async (matches) => {
        const names = { ...teamNames };
        let needsUpdate = false;
        
        for (const match of matches) {
            // Získanie názvu kategórie pre tento zápas
            let categoryName = match.categoryName;
            if (!categoryName && match.categoryId && window.categoriesData && window.categoriesData[match.categoryId]) {
                categoryName = window.categoriesData[match.categoryId];
            }
            
            if (!categoryName) {
                console.log(`⚠️ Zápas ${match.id} nemá názov kategórie, preskakujem mapovanie`);
                continue;
            }
            
            // Spracovanie domáceho tímu
            if (match.homeTeamIdentifier) {
                const currentDisplayName = names[match.homeTeamIdentifier] || getDisplayTeamName(match.homeTeamIdentifier);
                
                // 🔥 KONTROLA: Mapujeme LEN ak názov tímu obsahuje názov kategórie
                if (currentDisplayName && currentDisplayName.includes(categoryName)) {
                    if (window.matchTracker && typeof window.matchTracker.getTeamNameByDisplayId === 'function') {
                        try {
                            console.log(`🔄 [PROCESS] Domáci tím "${currentDisplayName}" obsahuje kategóriu "${categoryName}" → volám getTeamNameByDisplayId`);
                            const newName = await window.matchTracker.getTeamNameByDisplayId(currentDisplayName);
                            if (newName && newName !== currentDisplayName && newName !== names[match.homeTeamIdentifier]) {
                                names[match.homeTeamIdentifier] = newName;
                                needsUpdate = true;
                                console.log(`✅ [PROCESS] Domáci tím "${currentDisplayName}" → "${newName}"`);
                            }
                        } catch (err) {
                            console.error(`Chyba pri mapovaní domáceho tímu ${currentDisplayName}:`, err);
                        }
                    } else {
                        console.log(`⚠️ [PROCESS] window.matchTracker.getTeamNameByDisplayId nie je dostupný pre domáci tím`);
                    }
                } else if (!names[match.homeTeamIdentifier]) {
                    // Ak nemáme žiadny názov, použijeme základný
                    names[match.homeTeamIdentifier] = currentDisplayName;
                }
            }
            
            // Spracovanie hosťujúceho tímu
            if (match.awayTeamIdentifier) {
                const currentDisplayName = names[match.awayTeamIdentifier] || getDisplayTeamName(match.awayTeamIdentifier);
                
                // 🔥 KONTROLA: Mapujeme LEN ak názov tímu obsahuje názov kategórie
                if (currentDisplayName && currentDisplayName.includes(categoryName)) {
                    if (window.matchTracker && typeof window.matchTracker.getTeamNameByDisplayId === 'function') {
                        try {
                            console.log(`🔄 [PROCESS] Hosťujúci tím "${currentDisplayName}" obsahuje kategóriu "${categoryName}" → volám getTeamNameByDisplayId`);
                            const newName = await window.matchTracker.getTeamNameByDisplayId(currentDisplayName);
                            if (newName && newName !== currentDisplayName && newName !== names[match.awayTeamIdentifier]) {
                                names[match.awayTeamIdentifier] = newName;
                                needsUpdate = true;
                                console.log(`✅ [PROCESS] Hosťujúci tím "${currentDisplayName}" → "${newName}"`);
                            }
                        } catch (err) {
                            console.error(`Chyba pri mapovaní hosťujúceho tímu ${currentDisplayName}:`, err);
                        }
                    } else {
                        console.log(`⚠️ [PROCESS] window.matchTracker.getTeamNameByDisplayId nie je dostupný pre hosťujúci tím`);
                    }
                } else if (!names[match.awayTeamIdentifier]) {
                    // Ak nemáme žiadny názov, použijeme základný
                    names[match.awayTeamIdentifier] = currentDisplayName;
                }
            }
        }
        
        if (needsUpdate) {
            setTeamNames(prev => ({ ...prev, ...names }));
            console.log('✅ [PROCESS] Aktualizované názvy tímov pri načítaní:', names);
        } else {
            setTeamNames(names);
            console.log('ℹ️ [PROCESS] Žiadne zmeny v názvoch tímov pri načítaní');
        }
    };

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
            setAllMatchesList(hallMatches);
            
            // 🔥 POČKÁME NA DOKONČENIE PROCESS TEAM NAMES
            await processTeamNames(hallMatches);
            
            // Nastavíme počiatočné statusy
            const initialStatuses = {};
            hallMatches.forEach(match => {
                initialStatuses[match.id] = match.status || 'scheduled';
            });
            setMatchStatuses(initialStatuses);
            
            // Po načítaní zápasov skúsime zobraziť detail podľa URL
            const matchShown = showMatchFromUrl(hallMatches);
            if (!matchShown) {
                // Ak sa nezobrazil detail, ukončíme loading
                setLoading(false);
            }
            
            // Spustíme real-time listener pre aktualizáciu statusov
            const unsubscribe = setupMatchesRealTimeListener(hallId);
            
            // Uložíme unsubscribe funkciu pre cleanup
            window.__matchesRealTimeUnsubscribe = unsubscribe;
            
        } catch (err) {
            console.error('Chyba pri načítaní zápasov:', err);
            setError('Nepodarilo sa načítať zápasy: ' + err.message);
            setLoading(false);
        }
    };

    const globalUpdateTeamNames = async () => {
        if (allMatchesList.length > 0) {
            console.log('🌐 Spúšťam globálnu aktualizáciu názvov tímov pre všetky zápasy...');
            await updateTeamNamesInMatches(allMatchesList, setTeamNames, teamNames);
        }
    };

    useEffect(() => {
        window.updateTeamNamesGlobally = globalUpdateTeamNames;
        
        return () => {
            delete window.updateTeamNamesGlobally;
        };
    }, [allMatchesList, teamNames]);

    // Handler pre kliknutie na Detail
    const handleDetailClick = (match, index) => {
        setSelectedMatch(match);
        setCurrentMatchIndex(index);
        setShowingDetail(true);
        updateUrlForMatch(match);
        window.scrollTo(0, 0);
    };

    // Funkcia pre navigáciu medzi zápasmi
    const handleNavigateMatch = (direction) => {
        let newIndex;
        if (direction === 'prev') {
            newIndex = currentMatchIndex - 1;
        } else {
            newIndex = currentMatchIndex + 1;
        }
        
        if (newIndex >= 0 && newIndex < allMatchesList.length) {
            const newMatch = allMatchesList[newIndex];
            setSelectedMatch(newMatch);
            setCurrentMatchIndex(newIndex);
            updateUrlForMatch(newMatch);
            window.scrollTo(0, 0);
        }
    };

    // Upravená funkcia refreshMatchInList v hlavnom komponente MatchesHallApp
    const refreshMatchInList = (matchId, updates) => {
        // 🔥 SPRACOVANIE AKTUALIZÁCIE NÁZVOV TÍMOV Z DETAILU (LEN PRE MANUÁLNE ZMENY V DETAILI)
        let teamNamesUpdates = {};
        if (updates.updatedHomeTeamName && updates.homeTeamIdentifier) {
            teamNamesUpdates[updates.homeTeamIdentifier] = updates.updatedHomeTeamName;
            console.log(`📝 Aktualizujem názov domáceho tímu v zozname: ${updates.homeTeamIdentifier} → ${updates.updatedHomeTeamName}`);
        }
        if (updates.updatedAwayTeamName && updates.awayTeamIdentifier) {
            teamNamesUpdates[updates.awayTeamIdentifier] = updates.updatedAwayTeamName;
            console.log(`📝 Aktualizujem názov hosťujúceho tímu v zozname: ${updates.awayTeamIdentifier} → ${updates.updatedAwayTeamName}`);
        }
        
        // Ak máme aktualizácie názvov tímov, vykonáme ich
        if (Object.keys(teamNamesUpdates).length > 0) {
            setTeamNames(prev => ({ ...prev, ...teamNamesUpdates }));
        }
    
        // Aktualizujeme v matches
        setMatches(prevMatches => 
            prevMatches.map(m => m.id === matchId ? { ...m, ...updates } : m)
        );
    
        // Aktualizujeme v allMatchesList
        setAllMatchesList(prevList => 
            prevList.map(m => m.id === matchId ? { ...m, ...updates } : m)
        );
    
        // Aktualizujeme v selectedMatch ak je zobrazený
        if (selectedMatch && selectedMatch.id === matchId) {
            setSelectedMatch(prev => ({ ...prev, ...updates }));
        }
    };
    
    const handleMatchUpdate = (matchId, updates) => {
        // Ak update obsahuje resetComplete, znamená to že výsledok bol vymazaný
        if (updates.resetComplete) {
            // Špeciálne spracovanie pre reset - vymažeme výsledky
            refreshMatchInList(matchId, {
                homeScore: undefined,
                awayScore: undefined,
                status: 'scheduled'
            });
        } else {
            refreshMatchInList(matchId, updates);
        }
    };

    // Handler pre návrat z detailu
    const handleBackToList = () => {
        setSelectedMatch(null);
        setShowingDetail(false);
        setCurrentMatchIndex(0); // Reset indexu
        // Odstránime hash z URL
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
    };

    // Počúvanie na zmeny hash v URL
    useEffect(() => {
        const handleHashChange = () => {
            // Ak sme v detaile, skúsime nájsť zápas podľa URL
            if (allMatchesList.length > 0) {
                const urlMatch = parseMatchHash();
                if (urlMatch) {
                    const matchIndex = findMatchByIdentifiers(
                        urlMatch.homeTeamIdentifier,
                        urlMatch.awayTeamIdentifier,
                        allMatchesList
                    );
                    if (matchIndex !== -1 && (!showingDetail || selectedMatch?.homeTeamIdentifier !== urlMatch.homeTeamIdentifier)) {
                        setSelectedMatch(allMatchesList[matchIndex]);
                        setCurrentMatchIndex(matchIndex);
                        setShowingDetail(true);
                        window.scrollTo(0, 0);
                    }
                } else if (showingDetail) {
                    // Ak hash neexistuje a sme v detaile, vrátime sa na zoznam
                    setSelectedMatch(null);
                    setShowingDetail(false);
                }
            }
        };
        
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [allMatchesList, showingDetail, selectedMatch]);
    
    // Cleanup real-time listenera pri odmontovaní komponentu
    useEffect(() => {
        return () => {
            if (window.__matchesRealTimeUnsubscribe && typeof window.__matchesRealTimeUnsubscribe === 'function') {
                window.__matchesRealTimeUnsubscribe();
            }
        };
    }, []);

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

    const renderDetailButton = (match, dayIndex, matchIndex) => {
        const matchStatus = matchStatuses[match.id] || match.status || 'scheduled';
        // Tlačidlo bude žlté pre zápasy s statusom 'in-progress' ALEBO 'paused'
        const isActive = matchStatus === 'in-progress' || matchStatus === 'paused';
    
        // Získame aktuálne názvy tímov pre zobrazenie v konzole (nepovinné)
        const currentHomeName = teamNames[match.homeTeamIdentifier] || getDisplayTeamName(match.homeTeamIdentifier);
        const currentAwayName = teamNames[match.awayTeamIdentifier] || getDisplayTeamName(match.awayTeamIdentifier);
    
        const buttonClass = isActive 
            ? 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800 text-xs px-3 py-1 rounded-full transition-colors cursor-pointer'
            : 'bg-gray-200 hover:bg-gray-300 text-gray-900 text-xs px-3 py-1 rounded-full transition-colors cursor-pointer';
    
        return React.createElement(
            'button',
            {
                onClick: () => {
                    // Výpočet globálneho indexu zápasu
                    let globalIndex = 0;
                    for (let i = 0; i < dayIndex; i++) {
                        globalIndex += matchesByDay[i].matches.length;
                    }
                    globalIndex += matchIndex;
                    handleDetailClick(match, globalIndex);
                },
                className: buttonClass,
                style: { fontWeight: '500' }
            },
            'Detail'
        );
    };

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
            groupsData: groupsData,
            allMatches: allMatchesList,
            currentMatchIndex: currentMatchIndex,
            onNavigate: handleNavigateMatch,
            onMatchUpdate: handleMatchUpdate
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
                                const isResultAvailable = match.homeScore !== undefined && match.homeScore !== null && match.awayScore !== undefined && match.awayScore !== null;
                                
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
                                
                                // Tag pre kategóriu - použitie názvu z ID ak treba
                                let categoryDisplayTag = match.categoryName;
                                if (!categoryDisplayTag && match.categoryId && categoriesData[match.categoryId]) {
                                    categoryDisplayTag = categoriesData[match.categoryId];
                                }
                                
                                if (categoryDisplayTag) {
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
                                        categoryDisplayTag
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
                                            renderDetailButton(match, dayIndex, matchIndex)
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
