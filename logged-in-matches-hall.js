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
const loadTeamMembers = async (teamName, categoryName, onUpdate) => {
    if (!window.db || !teamName || !categoryName) {
        console.log("Chýba db, teamName alebo categoryName");
        if (onUpdate) onUpdate([]);
        return () => {};
    }
    
    console.log(`=== VYHĽADÁVANIE ČLENOV TÍMU (real-time) ===`);
    console.log(`Hľadám tím: "${teamName}" v kategórii (NÁZOV): "${categoryName}"`);
    
    // Prehľadávame všetkých používateľov (kluby)
    const usersRef = collection(window.db, 'users');
    
    // Vytvoríme unsubscribe funkciu pre real-time počúvanie
    const unsubscribe = onSnapshot(usersRef, (usersSnapshot) => {
        console.log(`Real-time aktualizácia: Načítavam členov pre tím ${teamName}`);
        
        for (const userDoc of usersSnapshot.docs) {
            const userId = userDoc.id;
            const userData = userDoc.data();
            const teams = userData.teams || {};
            
            // Prehľadávame všetky kategórie tohto používateľa
            for (const [categoryKey, teamsArray] of Object.entries(teams)) {
                if (categoryKey !== categoryName) continue;
                
                // Hľadáme tím s daným názvom
                const foundTeam = (teamsArray || []).find(t => t.teamName === teamName);
                
                if (foundTeam) {
                    console.log(`✅ Našiel som tím: "${teamName}" v kategórii ${categoryKey} (real-time)`);
                    
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
        
        console.log(`❌ Nenašiel som tím: "${teamName}" v kategórii: "${categoryName}"`);
        if (onUpdate) onUpdate([]);
    }, (error) => {
        console.error('Chyba pri real-time načítaní členov tímu:', error);
        if (onUpdate) onUpdate([]);
    });
    
    // Vrátime unsubscribe funkciu pre zrušenie odberu
    return unsubscribe;
};

// Komponent pre zoznam členov tímu (s real-time aktualizáciou)
const TeamMembersList = ({ teamName, categoryName }) => {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
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
        
        // Spustíme real-time počúvanie
        const unsubscribe = loadTeamMembers(teamName, categoryName, handleMembersUpdate);
        
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
        console.log(`Tím: ${teamName}`);
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
    
    return React.createElement(
        'div',
        { className: 'bg-white rounded-lg border border-gray-200 overflow-hidden h-full' },
        React.createElement(
            'div',
            { className: 'bg-gray-50 px-4 py-2 border-b border-gray-200' },
            React.createElement(
                'h3',
                { className: 'font-semibold text-gray-800' },
                teamName
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
    
    const intervalRef = useRef(null);
    const isRunningRef = useRef(false);
    const startTimeRef = useRef(null);
    const localStartOffsetRef = useRef(0);
    const periodDurationRef = useRef(periodDuration);
    const periodRef = useRef(period);
    const lastServerUpdateRef = useRef(0);
    const lastServerOffsetRef = useRef(0);

    useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);
    useEffect(() => { periodDurationRef.current = periodDuration; }, [periodDuration]);
    useEffect(() => { periodRef.current = period; }, [period]);

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
        if (isRunningRef.current) return;
        const currentSeconds = displaySeconds;
        const maxSec = periodDuration * 60;
        if (currentSeconds >= maxSec) return;
        // lokálne spustenie
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
        let newSeconds = displaySeconds + deltaSeconds;
        const maxSec = periodDuration * 60;
        if (newSeconds < 0) newSeconds = 0;
        if (newSeconds > maxSec) newSeconds = maxSec;
        setDisplaySeconds(newSeconds);
        if (isRunningRef.current) {
            // reset lokálneho odpočtu
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

    useEffect(() => {
        if (!window.db || !matchId) return;
        const matchRef = doc(window.db, 'matches', matchId);
        const unsubscribe = onSnapshot(matchRef, (docSnap) => {
            if (!docSnap.exists()) return;
            const now = Date.now();
            // Ignorujeme vlastné zmeny (do 300 ms)
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
            // Aktualizácia periódy
            if (serverPeriod !== period) {
                setPeriod(serverPeriod);
                periodRef.current = serverPeriod;
            }
            // Aktualizácia času na UI
            setDisplaySeconds(serverSeconds);
            // Spracovanie stavu behu a synchronizácia času počas behu
            if (serverStatus === 'in-progress') {
                if (!isRunningRef.current) {
                    // Iné zariadenie spustilo časovač
                    startLocalInterval(serverSeconds);
                    setIsRunning(true);
                    isRunningRef.current = true;
                    if (onTimeUpdate) onTimeUpdate({ seconds: serverSeconds, period: serverPeriod, isRunning: true });
                } else {
                    // Už beží – skontrolujeme, či sa čas výrazne líši (manuálna zmena na inom PC)
                    const diff = Math.abs(serverSeconds - displaySeconds);
                    if (diff > 0.5) {
                        // Pretaktovanie lokálneho intervalu na novú hodnotu
                        startLocalInterval(serverSeconds);
                        if (onTimeUpdate) onTimeUpdate({ seconds: serverSeconds, period: serverPeriod, isRunning: true });
                    }
                }
            } else if (serverStatus === 'paused' && isRunningRef.current) {
                // Iné zariadenie zastavilo
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
        if (match.status === 'in-progress' && match.startedAt) {
            const elapsed = Math.floor((Date.now() - match.startedAt.toDate().getTime()) / 1000);
            const maxSec = (categorySettings?.periodDuration || 20) * 60;
            initialSeconds = Math.min(initialSeconds + elapsed, maxSec);
        }
        setDisplaySeconds(initialSeconds);
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
    const canSubtractMinute = () => displaySeconds >= 60;
    const canAddMinute = () => displaySeconds + 60 <= periodDuration * 60;
    const canSubtractSecond = () => displaySeconds >= 1;
    const canAddSecond = () => displaySeconds + 1 <= periodDuration * 60;
    const canReset = () => displaySeconds > 0;
    const addMinute = () => canAddMinute() && addTime(60);
    const subtractMinute = () => canSubtractMinute() && addTime(-60);
    const addSecond = () => canAddSecond() && addTime(1);
    const subtractSecond = () => canSubtractSecond() && addTime(-1);
    const resetTime = () => canReset() && addTime(-displaySeconds);
    const toggleTimer = () => isRunningRef.current ? stopTimerAndSave() : startTimer();

    const nextPeriod = async () => {
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

    // Render (rovnaký)
    return React.createElement('div', { className: 'bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden' },
        React.createElement('div', { className: 'bg-gray-50 px-6 py-3 border-b border-gray-200' },
            React.createElement('h3', { className: 'font-semibold text-gray-800' }, 'Športový časovač'),
            React.createElement('p', { className: 'text-xs text-gray-500 mt-0.5' }, `Trvanie periódy: ${periodDuration} min | Počet periód: ${totalPeriods}`)
        ),
        React.createElement('div', { className: 'p-6' },
            React.createElement('div', { className: 'text-center mb-6' },
                React.createElement('div', { className: 'text-6xl font-mono font-bold text-gray-800' }, formatTime(displaySeconds)),
                React.createElement('div', { className: 'mt-2 text-sm text-gray-500' }, `Perióda ${period} / ${totalPeriods}`)
            ),
            React.createElement('div', { className: 'flex flex-wrap items-center justify-center gap-2 mb-6' },
                React.createElement('button', { onClick: toggleTimer, className: `px-4 py-2 rounded-lg font-semibold transition-colors cursor-pointer text-sm ${isRunning ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}` },
                    React.createElement('i', { className: isRunning ? 'fa-solid fa-stop mr-1' : 'fa-solid fa-play mr-1' }), isRunning ? 'Stop' : 'Štart'
                ),
                React.createElement('span', { className: 'text-gray-300 mx-1' }, '|'),
                React.createElement('button', { onClick: subtractMinute, disabled: !canSubtractMinute(), className: `px-3 py-2 rounded-lg font-semibold transition-colors cursor-pointer text-sm ${canSubtractMinute() ? 'bg-gray-200 hover:bg-gray-300 text-gray-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}` }, React.createElement('i', { className: 'fa-solid fa-minus' })),
                React.createElement('span', { className: 'text-sm text-gray-600 px-1 font-medium' }, 'Min'),
                React.createElement('button', { onClick: addMinute, disabled: !canAddMinute(), className: `px-3 py-2 rounded-lg font-semibold transition-colors cursor-pointer text-sm ${canAddMinute() ? 'bg-gray-200 hover:bg-gray-300 text-gray-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}` }, React.createElement('i', { className: 'fa-solid fa-plus' })),
                React.createElement('span', { className: 'text-gray-300 mx-1' }, '|'),
                React.createElement('button', { onClick: subtractSecond, disabled: !canSubtractSecond(), className: `px-3 py-2 rounded-lg font-semibold transition-colors cursor-pointer text-sm ${canSubtractSecond() ? 'bg-gray-200 hover:bg-gray-300 text-gray-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}` }, React.createElement('i', { className: 'fa-solid fa-minus' })),
                React.createElement('span', { className: 'text-sm text-gray-600 px-1 font-medium' }, 'Sec'),
                React.createElement('button', { onClick: addSecond, disabled: !canAddSecond(), className: `px-3 py-2 rounded-lg font-semibold transition-colors cursor-pointer text-sm ${canAddSecond() ? 'bg-gray-200 hover:bg-gray-300 text-gray-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}` }, React.createElement('i', { className: 'fa-solid fa-plus' })),
                React.createElement('span', { className: 'text-gray-300 mx-1' }, '|'),
                React.createElement('button', { onClick: prevPeriod, disabled: period <= 1, className: `px-3 py-2 rounded-lg font-semibold transition-colors cursor-pointer text-sm ${period <= 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}` }, React.createElement('i', { className: 'fa-solid fa-minus' })),
                React.createElement('span', { className: 'text-sm text-gray-800 font-semibold px-1' }, 'Perióda'),
                React.createElement('button', { onClick: nextPeriod, disabled: period >= totalPeriods, className: `px-3 py-2 rounded-lg font-semibold transition-colors cursor-pointer text-sm ${period >= totalPeriods ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}` }, React.createElement('i', { className: 'fa-solid fa-plus' })),
                React.createElement('span', { className: 'text-gray-300 mx-1' }, '|'),
                React.createElement('button', { onClick: resetTime, disabled: !canReset(), className: `px-4 py-2 rounded-lg font-semibold transition-colors cursor-pointer text-sm ${canReset() ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : 'bg-gray-300 text-gray-400 cursor-not-allowed'}` }, React.createElement('i', { className: 'fa-solid fa-arrow-rotate-left mr-1' }), 'Reset')
            ),
            React.createElement('div', { className: 'flex flex-wrap items-center justify-center gap-2 pt-2 border-t border-gray-100' },
                React.createElement('button', { onClick: () => console.log('Gól'), className: 'bg-green-500 hover:bg-green-600 text-white px-5 py-2 rounded-lg font-semibold transition-colors cursor-pointer text-sm' }, 'Gól'),
                React.createElement('button', { onClick: () => console.log('7m'), className: 'bg-teal-500 hover:bg-teal-600 text-white px-5 py-2 rounded-lg font-semibold transition-colors cursor-pointer text-sm' }, '7m'),
                React.createElement('button', { onClick: () => console.log('ŽK'), className: 'bg-yellow-500 hover:bg-yellow-600 text-white px-5 py-2 rounded-lg font-semibold transition-colors cursor-pointer text-sm' }, 'ŽK'),
                React.createElement('button', { onClick: () => console.log('ČK'), className: 'bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg font-semibold transition-colors cursor-pointer text-sm' }, 'ČK'),
                React.createElement('button', { onClick: () => console.log('MK'), className: 'bg-blue-400 hover:bg-blue-500 text-white px-5 py-2 rounded-lg font-semibold transition-colors cursor-pointer text-sm' }, 'MK'),
                React.createElement('button', { onClick: () => console.log('Vylúčenie'), className: 'bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-semibold transition-colors cursor-pointer text-sm' }, 'Vylúčenie')
            )
        )
    );
};

// Komponent pre detail zápasu (s navigáciou medzi zápasmi a časovačom)
const MatchDetailView = ({ match, teamNames, onBack, hallInfo, categoryDrawColors, groupsData, allMatches, currentMatchIndex, onNavigate, onMatchUpdate }) => {
    const dateTime = formatMatchDateTime(match.scheduledTime);
    const isResultAvailable = match.homeScore !== undefined && match.awayScore !== undefined;
    const homeTeamDisplay = teamNames[match.homeTeamIdentifier] || getDisplayTeamName(match.homeTeamIdentifier);
    const awayTeamDisplay = teamNames[match.awayTeamIdentifier] || getDisplayTeamName(match.awayTeamIdentifier);
    const categoryColor = getCategoryDrawColor(match.categoryId);
    const lighterCategoryColor = getLighterColor(categoryColor);
    const matchColors = getMatchColors(match, groupsData);
    
    // STATE pre nastavenia kategórie
    const [categorySettings, setCategorySettings] = React.useState(null);
    const [loadingSettings, setLoadingSettings] = React.useState(true);
    
    // Získanie názvu kategórie z ID (pre vyhľadávanie členov tímu)
    const getCategoryDisplayName = () => {
        if (match.categoryName) return match.categoryName;
        if (match.categoryId && window.categoriesData && window.categoriesData[match.categoryId]) {
            return window.categoriesData[match.categoryId];
        }
        return null;
    };
    
    const categoryDisplayName = getCategoryDisplayName();
    
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
            React.createElement(
                'div',
                { className: 'flex gap-3' },
                React.createElement(
                    'button',
                    {
                        onClick: () => hasPrevious && onNavigate('prev'),
                        disabled: !hasPrevious,
                        className: `flex items-center gap-2 px-4 py-2 rounded-lg transition-colors cursor-pointer ${
                            hasPrevious 
                                ? 'bg-blue-500 text-white hover:bg-blue-600' 
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
                        className: `flex items-center gap-2 px-4 py-2 rounded-lg transition-colors cursor-pointer ${
                            hasNext 
                                ? 'bg-blue-500 text-white hover:bg-blue-600' 
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
                                React.createElement('span', { className: 'text-3xl font-bold text-gray-800' }, match.homeScore),
                                React.createElement('span', { className: 'text-xl text-gray-400' }, ':'),
                                React.createElement('span', { className: 'text-3xl font-bold text-gray-800' }, match.awayScore)
                            ) :
                            React.createElement(
                                'div',
                                { className: 'text-center' },
                                React.createElement('span', { className: 'text-lg text-gray-400 font-medium' }, 'VS'),
                                React.createElement('div', { className: 'text-xs text-gray-400 mt-1' }, 'Zápas ešte nebol odohraný')
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
            match: match,
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
                categoryName: categoryDisplayName
            }),
            React.createElement(TeamMembersList, {
                teamName: awayTeamDisplay,
                categoryName: categoryDisplayName
            })
        )
    );
};

// Hlavný komponent MatchesHallApp - upravený s podporou URL parametrov
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
            processTeamNames(hallMatches);
            
            // Po načítaní zápasov skúsime zobraziť detail podľa URL
            const matchShown = showMatchFromUrl(hallMatches);
            if (!matchShown) {
                // Ak sa nezobrazil detail, ukončíme loading
                setLoading(false);
            }
            
        } catch (err) {
            console.error('Chyba pri načítaní zápasov:', err);
            setError('Nepodarilo sa načítať zápasy: ' + err.message);
            setLoading(false);
        }
    };

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
    
    // Handler pre aktualizáciu zápasu (napr. po zmene časovača)
    const handleMatchUpdate = (matchId, updates) => {
        setSelectedMatch(prev => {
            if (prev && prev.id === matchId) {
                return { ...prev, ...updates };
            }
            return prev;
        });
        
        setAllMatchesList(prev => 
            prev.map(m => m.id === matchId ? { ...m, ...updates } : m)
        );
        
        setMatches(prev => 
            prev.map(m => m.id === matchId ? { ...m, ...updates } : m)
        );
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
                                            React.createElement(
                                                'button',
                                                {
                                                    onClick: () => {
                                                        // Vypočítame globálny index zápasu
                                                        let globalIndex = 0;
                                                        for (let i = 0; i < dayIndex; i++) {
                                                            globalIndex += matchesByDay[i].matches.length;
                                                        }
                                                        globalIndex += matchIndex;
                                                        handleDetailClick(match, globalIndex);
                                                    },
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
