// Importy pre Firebase funkcie (Tieto sa nebudú používať na inicializáciu, ale na typy a funkcie)
import { doc, getDoc, onSnapshot, updateDoc, addDoc, deleteDoc, collection, Timestamp, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const { useState, useEffect } = React;

// Ikony pre typy miest (pre prípadné použitie)
const typeIcons = {
    sportova_hala: { icon: 'fa-futbol', color: '#dc2626' },
};

// Funkcia na formátovanie dátumu s dňom v týždni
const getDayName = (date) => {
    const days = ['Nedeľa', 'Pondelok', 'Utorok', 'Streda', 'Štvrtok', 'Piatok', 'Sobota'];
    return days[date.getDay()];
};

const formatDateWithDay = (date) => {
    const dayName = getDayName(date);
    const formattedDate = date.toLocaleDateString('sk-SK', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    return `${dayName} ${formattedDate}`;
};

const formatTime = (timestamp) => {
    if (!timestamp) return '--:--';
    try {
        const date = timestamp.toDate();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    } catch (e) {
        return '--:--';
    }
};

const getLocalDateStr = (date) => {
    if (!date) return null;
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getUrlParameter = (name) => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
};

// Funkcia na aktualizáciu URL bez reloadu
const updateUrlParameters = (homeIdentifier, awayIdentifier) => {
    const url = new URL(window.location.href);
    if (homeIdentifier && awayIdentifier) {
        url.searchParams.set('domaci', homeIdentifier);
        url.searchParams.set('hostia', awayIdentifier);
        // Odstránime starý parameter match ak existuje
        url.searchParams.delete('match');
    } else {
        url.searchParams.delete('domaci');
        url.searchParams.delete('hostia');
    }
    window.history.replaceState({}, '', url);
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

const getPlayersForTeam = (teamDetails) => {
    if (!teamDetails || !teamDetails.team || !teamDetails.team.playerDetails) return [];
    
    return teamDetails.team.playerDetails.map((player, index) => ({
        ...player,
        userId: teamDetails.userId,
        teamIdentifier: teamDetails.team.id || `${teamDetails.team.category} ${teamDetails.team.groupName?.replace('skupina ', '')}${teamDetails.team.order}`,
        playerId: player.id || `${player.firstName} ${player.lastName}`,
        displayName: `${player.firstName} ${player.lastName}${player.jerseyNumber ? ` (#${player.jerseyNumber})` : ''}`
    }));
};

const getStaffForTeam = (teamDetails) => {
    if (!teamDetails || !teamDetails.team) return [];
    
    const staff = [];
    
    if (teamDetails.team.menTeamMemberDetails) {
        teamDetails.team.menTeamMemberDetails.forEach((member, index) => {
            staff.push({
                ...member,
                userId: teamDetails.userId,
                teamIdentifier: teamDetails.team.id || `${teamDetails.team.category} ${teamDetails.team.groupName?.replace('skupina ', '')}${teamDetails.team.order}`,
                playerId: `staff-men-${index}`,
                displayName: `${member.firstName} ${member.lastName} (tréner)`,
                isStaff: true
            });
        });
    }
    
    if (teamDetails.team.womenTeamMemberDetails) {
        teamDetails.team.womenTeamMemberDetails.forEach((member, index) => {
            staff.push({
                ...member,
                userId: teamDetails.userId,
                teamIdentifier: teamDetails.team.id || `${teamDetails.team.category} ${teamDetails.team.groupName?.replace('skupina ', '')}${teamDetails.team.order}`,
                playerId: `staff-women-${index}`,
                displayName: `${member.firstName} ${member.lastName} (trénerka)`,
                isStaff: true
        });
        });
    }
    
    return staff;
};

const matchesHallApp = ({ userProfileData }) => {
    // Extrahujeme hallId z userProfileData
    const hallId = userProfileData?.hallId;
    const [hallName, setHallName] = useState(null);
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [teamData, setTeamData] = useState({ allTeams: [] });
    const [groupedMatches, setGroupedMatches] = useState({});
    const [categories, setCategories] = useState([]);
    const [groupsByCategory, setGroupsByCategory] = useState({});
    const [users, setUsers] = useState([]);
    const [superstructureTeams, setSuperstructureTeams] = useState({});
    // NOVÝ STAV PRE VYBRANÝ ZÁPAS
    const [selectedMatch, setSelectedMatch] = useState(null);    

    const [matchEvents, setMatchEvents] = useState([]);
    const [matchScore, setMatchScore] = useState({ home: 0, away: 0 });
    const [loadingEvents, setLoadingEvents] = useState(false);
    const [selectedPlayerForEvent, setSelectedPlayerForEvent] = useState(null);
    const [eventModalOpen, setEventModalOpen] = useState(false);
    const [eventType, setEventType] = useState(null);
    const [eventTeam, setEventTeam] = useState(null); // 'home' alebo 'away'
    const [eventMinute, setEventMinute] = useState('');
    const [eventSubType, setEventSubType] = useState(null); // pre 7m hody: 'scored' alebo 'missed'
    const [matchPaused, setMatchPaused] = useState(false);
    const [matchTime, setMatchTime] = useState(0); // čas v sekundách
    const [timerInterval, setTimerInterval] = useState(null);

    const formatMatchTime = (seconds) => {
        // Ochrana proti nečíselným hodnotám
        if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) {
            return '00:00';
        }
        
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Funkcie pre ovládanie času a periód
    const startMatchTimer = async (matchId) => {
        if (!window.db || !matchId) return;
        
        try {
            const matchRef = doc(window.db, 'matches', matchId);
            await updateDoc(matchRef, {
                status: 'in-progress',
                startedAt: Timestamp.now(),
                currentPeriod: 1
            });
            window.showGlobalNotification('Čas zápasu spustený', 'success');
        } catch (error) {
            console.error('Chyba pri spúšťaní časovača:', error);
            window.showGlobalNotification('Chyba pri spúšťaní časovača', 'error');
        }
    };
    
    const stopMatchTimer = async (matchId) => {
        if (!window.db || !matchId) return;
    
        try {
            const matchRef = doc(window.db, 'matches', matchId);
            await updateDoc(matchRef, {
                status: 'paused',
                pausedAt: Timestamp.now()
            });
        
            // Zastavíme interval
            if (timerInterval) {
                clearInterval(timerInterval);
                setTimerInterval(null);
            }
        
            setMatchPaused(true);
            window.showGlobalNotification('Čas zápasu pozastavený', 'success');
        } catch (error) {
            console.error('Chyba pri pozastavovaní časovača:', error);
            window.showGlobalNotification('Chyba pri pozastavovaní časovača', 'error');
        }
    };
    
    const resumeMatchTimer = async (matchId) => {
        if (!window.db || !matchId) return;
    
        try {
            const matchRef = doc(window.db, 'matches', matchId);
            
            // Pri obnovení potrebujeme upraviť startedAt, aby zohľadňoval čas strávený počas prestávky
            if (selectedMatch && selectedMatch.pausedAt && selectedMatch.startedAt) {
                const now = Timestamp.now();
                const pausedAt = selectedMatch.pausedAt;
                const startedAt = selectedMatch.startedAt;
                
                // Čas, ktorý uplynul do pozastavenia
                const elapsedBeforePause = pausedAt.seconds - startedAt.seconds;
                
                // Nový startedAt nastavíme tak, aby elapsedSeconds od nového startedAt do now
                // bol rovný elapsedBeforePause (čiže čas pokračuje od bodu pozastavenia)
                const newStartedAtSeconds = now.seconds - elapsedBeforePause;
                
                await updateDoc(matchRef, {
                    status: 'in-progress',
                    pausedAt: null,
                    startedAt: new Timestamp(newStartedAtSeconds, 0)
                });
            } else {
                await updateDoc(matchRef, {
                    status: 'in-progress',
                    pausedAt: null
                });
            }
            
            setMatchPaused(false);
            window.showGlobalNotification('Čas zápasu obnovený', 'success');
        } catch (error) {
            console.error('Chyba pri obnovovaní časovača:', error);
            window.showGlobalNotification('Chyba pri obnovovaní časovača', 'error');
        }
    };

    const endMatch = async (matchId) => {
        if (!window.db || !matchId) return;
        
        if (!window.confirm('Naozaj chcete ukončiť tento zápas?')) return;
        
        try {
            const matchRef = doc(window.db, 'matches', matchId);
            await updateDoc(matchRef, {
                status: 'completed',
                endedAt: Timestamp.now()
            });
            window.showGlobalNotification('Zápas bol ukončený', 'success');
        } catch (error) {
            console.error('Chyba pri ukončovaní zápasu:', error);
            window.showGlobalNotification('Chyba pri ukončovaní zápasu', 'error');
        }
    };
    
    const resetMatchTimer = async (matchId) => {
        if (!window.db || !matchId) return;
        
        if (!window.confirm('Naozaj chcete resetovať tento zápas? Všetky údaje o priebehu sa vymažú.')) return;
        
        try {
            const matchRef = doc(window.db, 'matches', matchId);
            await updateDoc(matchRef, {
                status: 'scheduled',
                startedAt: null,
                endedAt: null,
                pausedAt: null,
                currentPeriod: 1
            });
            
            // Vynulujeme čas
            setMatchTime(0);
            
            // Zastavíme interval
            if (timerInterval) {
                clearInterval(timerInterval);
                setTimerInterval(null);
            }
            
            // Vymažeme aj všetky udalosti zápasu (voliteľné)
            if (window.confirm('Chcete vymazať aj všetky udalosti zápasu (góly, karty, atď.)?')) {
                const eventsRef = collection(window.db, 'matchEvents');
                const q = query(eventsRef, where("matchId", "==", matchId));
                const querySnapshot = await getDocs(q);
                
                const deletePromises = [];
                querySnapshot.forEach((doc) => {
                    deletePromises.push(deleteDoc(doc.ref));
                });
                
                await Promise.all(deletePromises);
                window.showGlobalNotification('Všetky udalosti zápasu boli vymazané', 'success');
            }
            
            setMatchPaused(false);
            window.showGlobalNotification('Čas zápasu resetovaný', 'success');
        } catch (error) {
            console.error('Chyba pri resetovaní časovača:', error);
            window.showGlobalNotification('Chyba pri resetovaní časovača', 'error');
        }
    };
    
    const increasePeriod = async (matchId, maxPeriods) => {
        if (!window.db || !matchId || !selectedMatch) return;
        
        const currentPeriod = selectedMatch.currentPeriod || 1;
        if (currentPeriod >= maxPeriods) {
            window.showGlobalNotification('Posledná perióda', 'info');
            return;
        }
        
        try {
            const matchRef = doc(window.db, 'matches', matchId);
            await updateDoc(matchRef, {
                currentPeriod: currentPeriod + 1
            });
            window.showGlobalNotification(`Perióda zmenená na ${currentPeriod + 1}`, 'success');
        } catch (error) {
            console.error('Chyba pri zvyšovaní periódy:', error);
            window.showGlobalNotification('Chyba pri zmene periódy', 'error');
        }
    };
    
    const decreasePeriod = async (matchId) => {
        if (!window.db || !matchId || !selectedMatch) return;
        
        const currentPeriod = selectedMatch.currentPeriod || 1;
        if (currentPeriod <= 1) {
            window.showGlobalNotification('Prvá perióda', 'info');
            return;
        }
        
        try {
            const matchRef = doc(window.db, 'matches', matchId);
            await updateDoc(matchRef, {
                currentPeriod: currentPeriod - 1
            });
            window.showGlobalNotification(`Perióda zmenená na ${currentPeriod - 1}`, 'success');
        } catch (error) {
            console.error('Chyba pri znižovaní periódy:', error);
            window.showGlobalNotification('Chyba pri zmene periódy', 'error');
        }
    };

    // Inicializácia času pri výbere zápasu
    useEffect(() => {
        console.log('Inicializácia času pre zápas:', selectedMatch);
    
        if (selectedMatch && selectedMatch.startedAt) {
            const now = Timestamp.now();
            const startedAt = selectedMatch.startedAt;
            
            // Ak je zápas pozastavený, použijeme pausedAt na výpočet
            if (selectedMatch.status === 'paused' && selectedMatch.pausedAt) {
                const pausedAt = selectedMatch.pausedAt;
                const elapsedUntilPause = Math.floor((pausedAt.seconds - startedAt.seconds));
                console.log('elapsedUntilPause:', elapsedUntilPause);
                setMatchTime(elapsedUntilPause);
            } else {
                const elapsedSeconds = Math.floor((now.seconds - startedAt.seconds));
                console.log('elapsedSeconds:', elapsedSeconds);
                setMatchTime(elapsedSeconds);
            }
        } else {
            console.log('Žiadny startedAt, nastavujem 0');
            setMatchTime(0);
        }
    }, [selectedMatch]);

    // Timer pre priebeh zápasu
    useEffect(() => {
        console.log('Timer useEffect - stav:', selectedMatch?.status, 'matchTime:', matchTime);
        
        // Vymažeme existujúci interval
        if (timerInterval) {
            clearInterval(timerInterval);
            setTimerInterval(null);
        }
        
        // Získame kategóriu pre aktuálny zápas
        const currentCategory = selectedMatch ? categories.find(c => c.name === selectedMatch.categoryName) : null;
        
        // Spustíme nový interval len ak je zápas v priebehu
        if (selectedMatch && selectedMatch.status === 'in-progress' && selectedMatch.startedAt && currentCategory) {
            console.log('Spúšťam timer pre zápas v priebehu');
            
            // Uložíme startedAt do premennej mimo interval
            const startedAt = selectedMatch.startedAt;
            const matchId = selectedMatch.id;
            let currentPeriod = selectedMatch.currentPeriod || 1;
            
            // Dĺžka jednej periódy v sekundách
            const periodDurationSeconds = (currentCategory.periodDuration || 20) * 60;
            // Dĺžka prestávky medzi periódami v sekundách
            const breakDurationSeconds = (currentCategory.breakDuration || 2) * 60;
            
            // Vypočítame, v akej fáze sa zápas nachádza
            // Pre 1. periódu: 0 - periodDurationSeconds
            // Prestávka po 1. perióde: periodDurationSeconds - periodDurationSeconds + breakDurationSeconds
            // Pre 2. periódu: periodDurationSeconds + breakDurationSeconds - 2*periodDurationSeconds + breakDurationSeconds
            // atď.
            
            // Celkový čas do konca aktuálnej periódy (vrátane prestávok)
            // Pre aktuálnu periódu currentPeriod:
            // - Predchádzajúce periódy: (currentPeriod - 1) * periodDurationSeconds
            // - Prestávky medzi periódami: (currentPeriod - 1) * breakDurationSeconds
            // - Aktuálna perióda: periodDurationSeconds
            const totalElapsedForCurrentPeriod = (currentPeriod - 1) * (periodDurationSeconds + breakDurationSeconds) + periodDurationSeconds;
            
            console.log(`Perióda ${currentPeriod}/${currentCategory.periods}, dĺžka periódy: ${periodDurationSeconds}s, prestávka: ${breakDurationSeconds}s`);
            console.log(`Celkový čas do konca ${currentPeriod}. periódy: ${totalElapsedForCurrentPeriod}s`);
            
            const interval = setInterval(() => {
                const now = Timestamp.now();
                
                // Ak je zápas pozastavený, čas nebeží
                if (selectedMatch.status === 'paused') {
                    return;
                }
                
                const elapsedSeconds = Math.floor((now.seconds - startedAt.seconds));
                
                // OVERENIE: Priamo nastavujeme matchTime
                setMatchTime(elapsedSeconds);
                
                // Automatické zastavenie pri dosiahnutí konca aktuálnej periódy
                if (elapsedSeconds >= totalElapsedForCurrentPeriod) {
                    console.log(`Dosiahnutý koniec ${currentPeriod}. periódy, elapsedSeconds: ${elapsedSeconds} >= ${totalElapsedForCurrentPeriod}`);
                    
                    // Ak to nie je posledná perióda
                    if (currentPeriod < currentCategory.periods) {
                        console.log(`Koniec ${currentPeriod}. periódy, začína prestávka`);
                        
                        // Zastavíme časovač (prestávka)
                        stopMatchTimer(matchId);
                        window.showGlobalNotification(`Koniec ${currentPeriod}. periódy - prestávka ${currentCategory.breakDuration} min`, 'info');
                        
                        // Počkáme na manuálne spustenie ďalšej periódy
                        // increasePeriod sa zavolá manuálne cez tlačidlo "Perióda +"
                    } else {
                        // Ak je to posledná perióda, ukončíme zápas
                        console.log('Posledná perióda, ukončujem zápas');
                        stopMatchTimer(matchId);
                        window.showGlobalNotification(`Koniec zápasu`, 'info');
                    }
                }
            }, 1000);
            
            setTimerInterval(interval);
            
            return () => clearInterval(interval);
        }
        
        return () => {
            if (timerInterval) {
                clearInterval(timerInterval);
            }
        };
    }, [selectedMatch, selectedMatch?.status, selectedMatch?.startedAt, selectedMatch?.pausedAt, selectedMatch?.currentPeriod, categories]);

    // Načítanie názvu haly
    useEffect(() => {
        const fetchHallName = async () => {
            if (!hallId || !window.db) {
                setHallName('Žiadna priradená hala');
                setLoading(false);
                return;
            }
            
            try {
                const placeRef = doc(window.db, 'places', hallId);
                const placeSnap = await getDoc(placeRef);
                
                if (placeSnap.exists()) {
                    const placeData = placeSnap.data();
                    setHallName(placeData.name || 'Neznámy názov haly');
                } else {
                    setHallName(hallId);
                }
            } catch (error) {
                console.error("Chyba pri načítaní názvu haly:", error);
                setHallName(hallId || 'Chyba načítania');
            }
        };
        
        fetchHallName();
    }, [hallId]);

    // Načítanie tímov z teamManager
    useEffect(() => {
        if (window.teamManager) {
            if (window.__teamManagerData) {
                setTeamData(window.__teamManagerData);
            }
            
            const unsubscribe = window.teamManager.subscribe((data) => {
                setTeamData(data);
                // VYPÍŠEME TÍMY PRI KAŽDEJ AKTUALIZÁCII
                logAllTeams(data.allTeams);
            });
            
            return () => {
                if (unsubscribe) unsubscribe();
            };
        } else if (window.__teamManagerData) {
            setTeamData(window.__teamManagerData);
            // VYPÍŠEME TÍMY PRI NAČÍTANÍ
            logAllTeams(window.__teamManagerData.allTeams);
        }
    }, []);

    // FUNKCIA PRE VYPISOVANIE VŠETKÝCH TÍMOV
    const logAllTeams = (teams) => {
        if (!teams || teams.length === 0) {
            return;
        }
                
        // Zoskupíme tímy podľa kategórie a skupiny
        const teamsByCategory = {};
        
        teams.forEach(team => {
            const category = team.category || 'Neznáma kategória';
            if (!teamsByCategory[category]) {
                teamsByCategory[category] = {};
            }
            
            const group = team.groupName || 'Bez skupiny';
            if (!teamsByCategory[category][group]) {
                teamsByCategory[category][group] = [];
            }
            
            teamsByCategory[category][group].push(team);
        });
    };

    // FUNKCIA PRE VYPISOVANIE VŠETKÝCH TÍMOV POUŽÍVATEĽOV V JEDNEJ PREHĽADNEJ TABUĽKE
    const logAllUsers = (usersList) => {
        if (!usersList || usersList.length === 0) {
            return;
        }
                
        // Vytvoríme centrálnu štruktúru pre všetky tímy
        const allTeamsByCategory = {};
        let totalTeams = 0;
        
        // Prejdeme všetkých používateľov a ich tímy
        usersList.forEach((user) => {
            if (!user.teams || Object.keys(user.teams).length === 0) return;
            
            Object.entries(user.teams).forEach(([categoryName, teamArray]) => {
                if (!Array.isArray(teamArray) || teamArray.length === 0) return;
                
                // Inicializujeme kategóriu, ak ešte neexistuje
                if (!allTeamsByCategory[categoryName]) {
                    allTeamsByCategory[categoryName] = {};
                }
                
                teamArray.forEach(team => {
                    const groupName = team.groupName || 'Bez skupiny';
                    
                    // Inicializujeme skupinu, ak ešte neexistuje
                    if (!allTeamsByCategory[categoryName][groupName]) {
                        allTeamsByCategory[categoryName][groupName] = [];
                    }
                    
                    // Pridáme tím s informáciou o používateľovi
                    allTeamsByCategory[categoryName][groupName].push({
                        teamName: team.teamName,
                        order: team.order,
                        userEmail: user.email || 'Neznámy email',
                        userId: user.id
                    });
                    totalTeams++;
                });
            });
        });
                
        // Zoradíme kategórie podľa abecedy
        const sortedCategories = Object.keys(allTeamsByCategory).sort((a, b) => a.localeCompare(b));
        
        // Prejdeme všetky kategórie
        sortedCategories.forEach(categoryName => {
            
            const groups = allTeamsByCategory[categoryName];
            
            // Zoradíme skupiny - "Bez skupiny" dáme na koniec
            const sortedGroups = Object.keys(groups).sort((a, b) => {
                if (a === 'Bez skupiny') return 1;
                if (b === 'Bez skupiny') return -1;
                return a.localeCompare(b);
            });
            
            // Prejdeme všetky skupiny v kategórii
            sortedGroups.forEach(groupName => {
                
                const teamsInGroup = groups[groupName];
                
                // Zoradíme tímy podľa poradia
                const sortedTeams = [...teamsInGroup].sort((a, b) => {
                    const orderA = a.order !== null && a.order !== undefined ? a.order : Infinity;
                    const orderB = b.order !== null && b.order !== undefined ? b.order : Infinity;
                    return orderA - orderB;
                });
                
                // Vypíšeme každý tím
                sortedTeams.forEach(team => {
                    const orderText = team.order !== null && team.order !== undefined ? `, poradie: ${team.order}` : '';
                });
            });
        });
        
    };

    // FUNKCIA PRE VYPISOVANIE VŠETKÝCH SUPERSTRUCTURE TÍMOV
    const logSuperstructureTeams = (superstructureData) => {
        if (!superstructureData || Object.keys(superstructureData).length === 0) {
            return;
        }
                
        let totalTeams = 0;
        
        // Zoradíme kategórie podľa abecedy
        const sortedCategories = Object.keys(superstructureData).sort((a, b) => a.localeCompare(b));
        
        sortedCategories.forEach(categoryName => {
            const teams = superstructureData[categoryName] || [];
            
            if (teams.length === 0) return;
                        
            // Zoskupíme tímy podľa skupiny
            const teamsByGroup = {};
            
            teams.forEach(team => {
                const groupName = team.groupName || 'Bez skupiny';
                if (!teamsByGroup[groupName]) {
                    teamsByGroup[groupName] = [];
                }
                teamsByGroup[groupName].push(team);
            });
            
            // Zoradíme skupiny - "Bez skupiny" dáme na koniec
            const sortedGroups = Object.keys(teamsByGroup).sort((a, b) => {
                if (a === 'Bez skupiny') return 1;
                if (b === 'Bez skupiny') return -1;
                return a.localeCompare(b);
            });
            
            sortedGroups.forEach(groupName => {
                const teamsInGroup = teamsByGroup[groupName];
                
                // Zoradíme tímy podľa poradia
                const sortedTeams = [...teamsInGroup].sort((a, b) => {
                    const orderA = a.order !== null && a.order !== undefined ? a.order : Infinity;
                    const orderB = b.order !== null && b.order !== undefined ? b.order : Infinity;
                    return orderA - orderB;
                });
                
                sortedTeams.forEach(team => {
                    const orderText = team.order !== null && team.order !== undefined ? `, poradie: ${team.order}` : '';
                    totalTeams++;
                });
            });
        });
        
    };

    // 🔴 NOVÝ useEffect PRE NAČÍTANIE UDALOSTÍ ZÁPASU - PRIDAŤ SEM
    useEffect(() => {
        if (!selectedMatch || !window.db) return;
    
        const eventsRef = collection(window.db, 'matchEvents');
        const q = query(eventsRef, where("matchId", "==", selectedMatch.id));
        
        setLoadingEvents(true);
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const loadedEvents = [];
            let homeScore = 0;
            let awayScore = 0;
            
            snapshot.forEach((doc) => {
                const event = { id: doc.id, ...doc.data() };
                loadedEvents.push(event);
                
                // Výpočet skóre
                if (event.type === 'goal') {
                    if (event.team === 'home') homeScore++;
                    else if (event.team === 'away') awayScore++;
                } else if (event.type === 'penalty' && event.subType === 'scored') {
                    if (event.team === 'home') homeScore++;
                    else if (event.team === 'away') awayScore++;
                }
            });
            
            // Zoradenie od najnovšej po najstaršiu (zostupne podľa času)
            loadedEvents.sort((a, b) => {
                // Najprv podľa minúty (zostupne)
                if (a.minute !== b.minute) {
                    return (b.minute || 0) - (a.minute || 0);
                }
                // Potom podľa sekundy (zostupne)
                return (b.second || 0) - (a.second || 0);
            });
            
            setMatchEvents(loadedEvents);
            setMatchScore({ home: homeScore, away: awayScore });
            setLoadingEvents(false);
        }, (error) => {
            console.error("Chyba pri načítaní udalostí zápasu:", error);
            setLoadingEvents(false);
        });
    
        return () => unsubscribe();
    }, [selectedMatch]);
    
    // V addMatchEvent funkcii upravte ukladanie času:
    const addMatchEvent = async () => {
        if (!selectedMatch || !window.db || !eventType || !eventTeam) {
            window.showGlobalNotification('Vyberte typ udalosti a tím', 'error');
            return;
        }
    
        // Pre penalty potrebujeme aj subType
        if (eventType === 'penalty' && !eventSubType) {
            window.showGlobalNotification('Vyberte typ penalty (premenená/nepremenená)', 'error');
            return;
        }
    
        // Pre gól a vylúčenie potrebujeme vybraného hráča
        if ((eventType === 'goal' || eventType === 'exclusion') && !selectedPlayerForEvent) {
            window.showGlobalNotification('Vyberte hráča', 'error');
            return;
        }
    
        // Pre karty potrebujeme vybraného hráča (ak nie je pre trénera)
        if ((eventType === 'yellow' || eventType === 'red' || eventType === 'blue') && !selectedPlayerForEvent) {
            window.showGlobalNotification('Vyberte hráča alebo člena realizačného tímu', 'error');
            return;
        }
    
        try {
            const eventsRef = collection(window.db, 'matchEvents');
            
            // Výpočet minúty a sekundy z celkového času v sekundách
            const totalSeconds = matchTime;
            const minute = Math.floor(totalSeconds / 60); // +1 lebo minúty sa počítajú od 1
            const second = totalSeconds % 60;
            
            // Formátovaný čas pre zobrazenie MM:SS
            const formattedTime = `${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`;
            
            const eventData = {
                matchId: selectedMatch.id,
                type: eventType,
                team: eventTeam,
                minute: minute,
                second: second, // Pridáme sekundu
                formattedTime: formattedTime, // Pridáme formátovaný čas pre ľahšie zobrazenie
                timestamp: Timestamp.now(),
                createdBy: userProfileData?.email || 'unknown',
                createdByUid: userProfileData?.uid || null
            };
    
            // Pridanie referencie na hráča
            if (selectedPlayerForEvent) {
                eventData.playerRef = {
                    userId: selectedPlayerForEvent.userId,
                    teamIdentifier: selectedPlayerForEvent.teamIdentifier,
                    playerId: selectedPlayerForEvent.playerId
                };
                
                if (eventType === 'yellow' || eventType === 'red' || eventType === 'blue' || eventType === 'exclusion') {
                    eventData.cardType = eventType === 'exclusion' ? 'exclusion' : eventType;
                }
            }
    
            // Pre penalty ukladáme subType
            if (eventType === 'penalty') {
                eventData.subType = eventSubType;
            }
    
            await addDoc(eventsRef, eventData);
            
            window.showGlobalNotification(`Udalosť bola pridaná v čase ${formattedTime}`, 'success');
            
            // Reset po pridaní
            setSelectedPlayerForEvent(null);
            setEventType(null);
            setEventTeam(null);
            setEventSubType(null);
            
        } catch (error) {
            console.error('Chyba pri pridávaní udalosti:', error);
            window.showGlobalNotification('Chyba pri ukladaní udalosti', 'error');
        }
    };
    
    const deleteMatchEvent = async (eventId) => {
        if (!window.db || !eventId) return;
        
        if (!window.confirm('Naozaj chcete zmazať túto udalosť?')) return;
        
        try {
            const eventRef = doc(window.db, 'matchEvents', eventId);
            await deleteDoc(eventRef);
            window.showGlobalNotification('Udalosť bola zmazaná', 'success');
        } catch (error) {
            console.error('Chyba pri mazaní udalosti:', error);
            window.showGlobalNotification('Chyba pri mazaní udalosti', 'error');
        }
    };
    
    const getPlayerNameFromRef = (playerRef) => {
        if (!playerRef || !playerRef.userId || !playerRef.teamIdentifier) return 'Neznámy hráč';
        
        const user = users.find(u => u.id === playerRef.userId);
        if (!user) return 'Neznámy hráč';
        
        const parts = playerRef.teamIdentifier.split(' ');
        const groupAndOrder = parts.pop();
        const category = parts.join(' ');
        
        let groupLetter = '';
        let order = '';
        for (let i = 0; i < groupAndOrder.length; i++) {
            const char = groupAndOrder[i];
            if (char >= '0' && char <= '9') {
                order = groupAndOrder.substring(i);
                groupLetter = groupAndOrder.substring(0, i);
                break;
            }
        }
        
        const fullGroupName = `skupina ${groupLetter}`;
        const orderNum = parseInt(order, 10);
        
        const userTeams = user.teams?.[category];
        if (!userTeams || !Array.isArray(userTeams)) return 'Neznámy hráč';
        
        const team = userTeams.find(t => t.groupName === fullGroupName && t.order === orderNum);
        if (!team) return 'Neznámy hráč';
        
        if (playerRef.playerId && team.playerDetails) {
            const player = team.playerDetails.find(p => 
                p.id === playerRef.playerId || 
                (p.firstName + ' ' + p.lastName) === playerRef.playerId
            );
            if (player) {
                return `${player.firstName} ${player.lastName}`;
            }
        }
        
        return 'Neznámy hráč';
    };

    // Načítanie kategórií z databázy
    useEffect(() => {
        const loadCategorySettings = async () => {
            if (!window.db) return;
            
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
                            // Pridáme všetky potrebné vlastnosti z nastavení kategórie
                            maxTeams: obj.maxTeams ?? 12,
                            maxPlayers: obj.maxPlayers ?? 12,
                            maxImplementationTeam: obj.maxImplementationTeam ?? 3,
                            periods: obj.periods ?? 2,
                            periodDuration: obj.periodDuration ?? 20,
                            breakDuration: obj.breakDuration ?? 2,
                            matchBreak: obj.matchBreak ?? 5,
                            drawColor: obj.drawColor ?? '#3B82F6',
                            transportColor: obj.transportColor ?? '#10B981',
                            dateFrom: obj.dateFrom ?? '',
                            dateTo: obj.dateTo ?? '',
                            dateFromActive: obj.dateFromActive ?? false,
                            dateToActive: obj.dateToActive ?? false,
                            timeoutCount: obj.timeoutCount ?? 2,
                            timeoutDuration: obj.timeoutDuration ?? 1,
                            exclusionTime: obj.exclusionTime ?? 2
                        });
                    });
                    
                    setCategories(categoriesList);
                    
                    // Voliteľný výpis do konzoly pre ladenie
                    console.log('=== NAČÍTANÉ KATEGÓRIE S NASTAVENIAMI ===');
                    categoriesList.forEach((cat, index) => {
                        console.log(`Kategória #${index + 1}:`, {
                            id: cat.id,
                            name: cat.name,
                            maxTeams: cat.maxTeams,
                            maxPlayers: cat.maxPlayers,
                            maxImplementationTeam: cat.maxImplementationTeam,
                            periods: cat.periods,
                            periodDuration: cat.periodDuration,
                            breakDuration: cat.breakDuration,
                            matchBreak: cat.matchBreak,
                            drawColor: cat.drawColor,
                            transportColor: cat.transportColor
                        });
                    });
                    console.log('=========================================');
                    
                } else {
                    console.log("Neboli nájdené žiadne kategórie");
                    setCategories([]);
                }
            } catch (error) {
                console.error("Chyba pri načítaní kategórií:", error);
            }
        };
        
        loadCategorySettings();
    }, []); // Prázdne pole - spustí sa len raz

    // Načítanie skupín z databázy
    useEffect(() => {
        if (!window.db) return;

        const loadGroups = async () => {
            try {
                const groupsRef = doc(window.db, 'settings', 'groups');
                const groupsSnap = await getDoc(groupsRef);
                
                if (groupsSnap.exists()) {
                    const groupsData = groupsSnap.data();
                    setGroupsByCategory(groupsData);
                                        
                    // Pre každú kategóriu vypíšeme jej skupiny
                    Object.entries(groupsData).forEach(([categoryId, groups], catIndex) => {
                        // Nájdeme názov kategórie podľa ID
                        const category = categories.find(c => c.id === categoryId);
                        const categoryName = category ? category.name : `Neznáma kategória (ID: ${categoryId})`;
                                            
                        // Rozdelíme skupiny podľa typu
                        const basicGroups = groups.filter(g => g.type === 'základná skupina');
                        const superGroups = groups.filter(g => g.type === 'nadstavbová skupina');
                    });                                        
                } else {
                    setGroupsByCategory({});
                }
            } catch (error) {
                console.error('Chyba pri načítaní skupín:', error);
                setGroupsByCategory({});
            }
        };
        
        loadGroups();
        
        // Môžeme pridať aj real-time listener pre skupiny
        const unsubscribeGroups = onSnapshot(doc(window.db, 'settings', 'groups'), (docSnap) => {
            if (docSnap.exists()) {
                const groupsData = docSnap.data();
                setGroupsByCategory(groupsData);
            }
        }, (error) => {
            console.error('Chyba pri real-time sledovaní skupín:', error);
        });
        
        return () => unsubscribeGroups();
    }, [categories]);

    // NOVÝ LISTENER: Načítanie superstructure tímov z kolekcie settings/superstructureGroups
    useEffect(() => {
        if (!window.db) return;

        const superstructureDocRef = doc(window.db, 'settings', 'superstructureGroups');
        
        const unsubscribeSuperstructure = onSnapshot(superstructureDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setSuperstructureTeams(data);
                logSuperstructureTeams(data);
            } else {
                setSuperstructureTeams({});
            }
        }, (error) => {
            console.error('Chyba pri načítaní superstructure tímov:', error);
            setSuperstructureTeams({});
        });

        return () => unsubscribeSuperstructure();
    }, []);

    // NOVÝ LISTENER: Načítanie všetkých používateľov z kolekcie users
    useEffect(() => {
        if (!window.db) return;

        const unsubscribeUsers = onSnapshot(query(collection(window.db, 'users')), (querySnapshot) => {
            const usersList = [];
            
            querySnapshot.forEach((doc) => {
                const userData = doc.data();
                usersList.push({
                    id: doc.id,
                    email: userData.email,
                    displayName: userData.displayName,
                    role: userData.role,
                    approved: userData.approved,
                    createdAt: userData.createdAt,
                    teams: userData.teams || {},
                    hallId: userData.hallId,
                    // ďalšie polia podľa potreby
                });
            });
            
            setUsers(usersList);
            
            // VYPÍŠEME VŠETKÝCH POUŽÍVATEĽOV
            logAllUsers(usersList);
            
        }, (error) => {
            console.error('Chyba pri načítaní používateľov:', error);
        });

        return () => unsubscribeUsers();
    }, []); // Prázdne pole závislostí - spustí sa raz pri načítaní

    // Načítanie zápasov pre túto halu
    useEffect(() => {
        if (!window.db || !hallId) {
            setLoading(false);
            return;
        }
    
        const matchesRef = collection(window.db, 'matches');
        const q = query(matchesRef, where("hallId", "==", hallId));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const loadedMatches = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                console.log('Načítaný zápas:', data); // Pre ladenie
                
                loadedMatches.push({
                    id: doc.id,
                    ...data,
                    currentPeriod: data.currentPeriod || 1
                });
                if (selectedMatch) {
                    setMatchPaused(selectedMatch.status === 'paused');
                }
            });
            
            // Zoradíme podľa času
            loadedMatches.sort((a, b) => {
                if (!a.scheduledTime) return 1;
                if (!b.scheduledTime) return -1;
                return a.scheduledTime.toDate() - b.scheduledTime.toDate();
            });
            
            setMatches(loadedMatches);
            
            // Zoskupenie podľa dňa
            const grouped = {};
            loadedMatches.forEach(match => {
                if (match.scheduledTime) {
                    const date = match.scheduledTime.toDate();
                    const dateStr = getLocalDateStr(date);
                    
                    if (!grouped[dateStr]) {
                        grouped[dateStr] = {
                            date: date,
                            dateStr: dateStr,
                            matches: []
                        };
                    }
                    grouped[dateStr].matches.push(match);
                }
            });
            
            setGroupedMatches(grouped);
            setLoading(false);
            
            // Skontrolujeme URL parametre pre domácich a hostí
            const homeIdentifierFromUrl = getUrlParameter('domaci');
            const awayIdentifierFromUrl = getUrlParameter('hostia');
            
            if (homeIdentifierFromUrl && awayIdentifierFromUrl && !selectedMatch) {
                // Hľadáme zápas, ktorý má oba identifikátory
                const matchFromUrl = loadedMatches.find(m => 
                    m.homeTeamIdentifier === homeIdentifierFromUrl && 
                    m.awayTeamIdentifier === awayIdentifierFromUrl
                );
                
                if (matchFromUrl) {
                    setSelectedMatch(matchFromUrl);
                }
            }
            
        }, (error) => {
            console.error("Chyba pri načítaní zápasov:", error);
            setLoading(false);
        });
    
        return () => unsubscribe();
    }, [hallId]);
    
    // SAMOSTATNÝ useEffect PRE VÝPIS DO KONZOLY - závislý na matches AJ categories
    useEffect(() => {
        // Spustí sa až keď sú obe dáta načítané
        if (matches.length > 0 && categories.length > 0) {
            console.log('=== VŠETKY ZÁPASY V TEJTO HALE S NASTAVENIAMI KATEGÓRIE ===');
            matches.forEach((match, index) => {
                const homeTeamName = getTeamNameByIdentifier(match.homeTeamIdentifier);
                const awayTeamName = getTeamNameByIdentifier(match.awayTeamIdentifier);
                const matchTime = match.scheduledTime ? formatTime(match.scheduledTime) : 'neurčený';
                const matchDate = match.scheduledTime ? formatDateWithDay(match.scheduledTime.toDate()) : 'neurčený';
                const categoryName = match.categoryName || 'Neznáma kategória';
                
                // Nájdeme kategóriu podľa názvu
                const category = categories.find(c => c.name === match.categoryName);
                
//                console.log(`\n📋 ZÁPAS #${index + 1}:`);
//                console.log(`  🆔 ID: ${match.id}`);
//                console.log(`  📅 Dátum: ${matchDate}`);
//                console.log(`  ⏰ Čas: ${matchTime}`);
//                console.log(`  🏷️ Kategória: ${categoryName}`);
//                console.log(`  👥 Skupina: ${match.groupName || 'neurčená'}`);
//                console.log(`  ⚽ Domáci: ${homeTeamName}`);
//                console.log(`  ⚽ Hosť: ${awayTeamName}`);
//                console.log(`  📊 Status: ${match.status || 'neurčený'}`);
//                if (match.isPlacementMatch) {
//                    console.log(`  🏆 Typ: Zápas o ${match.placementRank}. miesto`);
//                }
                
                // VÝPIS NASTAVENÍ KATEGÓRIE
                if (category) {
//                    console.log(`\n  📌 NASTAVENIA KATEGÓRIE ${category.name}:`);
//                    console.log(`  • Maximálny počet tímov: ${category.maxTeams ?? 'neuvedené'}`);
//                    console.log(`  • Maximálny počet hráčov v tíme: ${category.maxPlayers ?? 'neuvedené'}`);
//                    console.log(`  • Maximálny počet členov RT: ${category.maxImplementationTeam ?? 'neuvedené'}`);
//                    console.log(`  • Počet periód: ${category.periods ?? 'neuvedené'}`);
//                    console.log(`  • Trvanie periódy: ${category.periodDuration ?? 'neuvedené'} min`);
//                    console.log(`  • Prestávka medzi periódami: ${category.breakDuration ?? 'neuvedené'} min`);
//                    console.log(`  • Prestávka medzi zápasmi: ${category.matchBreak ?? 'neuvedené'} min`);
//                    console.log(`  • Farba pre rozlosovanie: ${category.drawColor ?? 'neuvedené'}`);
//                    console.log(`  • Farba pre dopravu: ${category.transportColor ?? 'neuvedené'}`);
                    
                    // Výpočet celkového času zápasu
                    const periods = category.periods ?? 2;
                    const periodDuration = category.periodDuration ?? 15;
                    const breakDuration = category.breakDuration ?? 3;
                    const matchBreak = category.matchBreak ?? 5;
                    
                    // Jednotlivé časti
                    const playingTime = periods * periodDuration;
                    const breaksBetweenPeriods = (periods - 1) * breakDuration;
                    const totalMatchTime = playingTime + breaksBetweenPeriods;
                    const totalTimeWithMatchBreak = totalMatchTime + matchBreak;
                    
                    console.log(`\n  ⏱️ ROZPIS ČASU ZÁPASU:`);
                    for (let i = 1; i <= periods; i++) {
                        console.log(`  • ${i}. polčas: ${periodDuration} min`);
                        if (i < periods) {
                            console.log(`  • Prestávka: ${breakDuration} min`);
                        }
                    }
                    
                    console.log(`\n  ⏱️ SÚHRN ČASU:`);
                    console.log(`  • Čistý hrací čas: ${playingTime} min (${periods} × ${periodDuration} min)`);
                    if (periods > 1) {
                        console.log(`  • Celkový čas prestávok v zápase: ${breaksBetweenPeriods} min`);
                        console.log(`  • Celkový čas zápasu (s prestávkami): ${totalMatchTime} min`);
                    }
                    console.log(`  • Prestávka medzi zápasmi: ${matchBreak} min`);
                    console.log(`  • Celkový čas s prestávkou medzi zápasmi: ${totalTimeWithMatchBreak} min`);
                    
                    if (periods === 2) {
                        console.log(`\n  📊 ČASOVÝ ROZPIS V MINÚTACH:`);
                        console.log(`  • 0 - ${periodDuration}: 1. polčas`);
                        console.log(`  • ${periodDuration} - ${periodDuration + breakDuration}: Prestávka`);
                        console.log(`  • ${periodDuration + breakDuration} - ${totalMatchTime}: 2. polčas`);
                        console.log(`  • ${totalMatchTime} - ${totalTimeWithMatchBreak}: Prestávka medzi zápasmi`);
                    }
                } else {
                    console.log(`\n  ⚠️ Nastavenia kategórie nie sú k dispozícii`);
                }
                
                console.log('─'.repeat(50));
            });
            console.log(`\n📊 Celkový počet zápasov: ${matches.length}`);
            console.log('='.repeat(60));
        }
    }, [matches, categories]); // Tento useEffect sa spustí vždy, keď sa zmenia matches ALEBO categories

    // FUNKCIA NA ZÍSKANIE NÁZVU TÍMU PODĽA IDENTIFIKÁTORA - TERAZ POUŽÍVA DÁTA Z USERS AJ SUPERSTRUCTURE
    const getTeamNameByIdentifier = (identifier) => {
        if (!identifier) return 'Neznámy tím';
        
        // Parsujeme identifikátor v tvare "kategória skupinaorder" (napr. "U12 D F4")
        const parts = identifier.split(' ');
        
        if (parts.length < 2) {
            return identifier; // Fallback na identifikátor
        }
        
        // Posledná časť je skupina + order (napr. "F4")
        const groupAndOrder = parts.pop();
        // Zvyšok je kategória (môže byť viacslovná, napr. "U12 D")
        const category = parts.join(' ');
        
        // Rozdelíme groupAndOrder na groupName a order
        // Order je číselná časť na konci, groupName je zvyšok
        let groupLetter = '';
        let order = '';
        
        for (let i = 0; i < groupAndOrder.length; i++) {
            const char = groupAndOrder[i];
            if (char >= '0' && char <= '9') {
                order = groupAndOrder.substring(i);
                groupLetter = groupAndOrder.substring(0, i);
                break;
            }
        }
        
        if (!order) {
            order = '?';
            groupLetter = groupAndOrder;
        }
        
        // Vytvoríme názov skupiny v tvare "skupina X" (napr. "F" -> "skupina F")
        const fullGroupName = `skupina ${groupLetter}`;
        const orderNum = parseInt(order, 10);
                
        // Hľadáme v users (načítaných používateľoch)
        if (users && users.length > 0) {
            for (const user of users) {
                if (!user.teams) continue;
                
                const userTeams = user.teams[category];
                if (!userTeams || !Array.isArray(userTeams)) continue;
                
                const team = userTeams.find(t => 
                    t.groupName === fullGroupName && 
                    t.order === orderNum
                );
                
                if (team) {                                        
                    return team.teamName;
                }
            }
        }
        
        // Pre superstructure tímy - hľadáme podľa kategórie a skupiny+poradia
        if (superstructureTeams && Object.keys(superstructureTeams).length > 0) {
            const categoryTeams = superstructureTeams[category] || [];
                        
            const teamsInGroup = categoryTeams.filter(t => t.groupName === fullGroupName);
                        
            // Zoradíme ich podľa poradia
            const sortedTeams = [...teamsInGroup].sort((a, b) => {
                const orderA = a.order !== null && a.order !== undefined ? a.order : Infinity;
                const orderB = b.order !== null && b.order !== undefined ? b.order : Infinity;
                return orderA - orderB;
            });
            
            if (orderNum <= sortedTeams.length && orderNum >= 1) {
                const foundTeam = sortedTeams[orderNum - 1];
                return foundTeam.teamName;
            }
        }
        return `${category} ${groupLetter}${order}`;
    };

    // FUNKCIA NA ZÍSKANIE KOMPLETNÝCH INFORMÁCIÍ O TÍME
    const getTeamDetails = (identifier) => {
        if (!identifier) return null;
        
        // Parsujeme identifikátor v tvare "kategória skupinaorder" (napr. "U12 D F4")
        const parts = identifier.split(' ');
        
        if (parts.length < 2) {
            return null;
        }
        
        // Posledná časť je skupina + order (napr. "F4")
        const groupAndOrder = parts.pop();
        // Zvyšok je kategória (môže byť viacslovná, napr. "U12 D")
        const category = parts.join(' ');
        
        // Rozdelíme groupAndOrder na groupName a order
        let groupLetter = '';
        let order = '';
        
        for (let i = 0; i < groupAndOrder.length; i++) {
            const char = groupAndOrder[i];
            if (char >= '0' && char <= '9') {
                order = groupAndOrder.substring(i);
                groupLetter = groupAndOrder.substring(0, i);
                break;
            }
        }
        
        if (!order) {
            order = '?';
            groupLetter = groupAndOrder;
        }
        
        // Vytvoríme názov skupiny v tvare "skupina X" (napr. "F" -> "skupina F")
        const fullGroupName = `skupina ${groupLetter}`;
        const orderNum = parseInt(order, 10);
        
        // Hľadáme v users
        if (users && users.length > 0) {
            for (const user of users) {
                if (!user.teams) continue;
                
                const userTeams = user.teams[category];
                if (!userTeams || !Array.isArray(userTeams)) continue;
                
                const team = userTeams.find(t => 
                    t.groupName === fullGroupName && 
                    t.order === orderNum
                );
                
                if (team) {
                    return {
                        team,
                        userEmail: user.email,
                        userId: user.id,
                        userDisplayName: user.displayName
                    };
                }
            }
        }
        
        return null;
    };

    // FUNKCIA PRE ZOBRAZENIE VŠETKÝCH ZÁPASOV
    const showAllMatches = () => {
        setSelectedMatch(null);
        updateUrlParameters(null, null); // Odstránime parametre z URL
    };

    // FUNKCIA PRE VÝBER ZÁPASU
     const selectMatch = (match) => {
        setSelectedMatch(match);
        updateUrlParameters(match.homeTeamIdentifier, match.awayTeamIdentifier);
    };

    // Zoradenie dní podľa dátumu
    const sortedDays = Object.values(groupedMatches).sort((a, b) => 
        a.date - b.date
    );

    // Ak je vybraný zápas, zobrazíme detail
    if (selectedMatch) {
        const homeTeamName = getTeamNameByIdentifier(selectedMatch.homeTeamIdentifier);
        const awayTeamName = getTeamNameByIdentifier(selectedMatch.awayTeamIdentifier);
        const homeTeamDetails = getTeamDetails(selectedMatch.homeTeamIdentifier);
        const awayTeamDetails = getTeamDetails(selectedMatch.awayTeamIdentifier);
        const matchDate = selectedMatch.scheduledTime ? formatDateWithDay(selectedMatch.scheduledTime.toDate()) : 'neurčený';
        const matchStartTime = selectedMatch.scheduledTime ? formatTime(selectedMatch.scheduledTime) : '--:--';
        const category = categories.find(c => c.name === selectedMatch.categoryName);
        
        // Zistenie, či má zápas typ (finále, semifinále, o umiestnenie)
        const hasMatchType = selectedMatch.isPlacementMatch || selectedMatch.matchType;
        
        // Získanie zoradených zápasov podľa času pre navigáciu
        const sortedMatchesForNavigation = [...matches].sort((a, b) => {
            if (!a.scheduledTime) return 1;
            if (!b.scheduledTime) return -1;
            return a.scheduledTime.toDate() - b.scheduledTime.toDate();
        });
        
        // Nájdenie indexu aktuálneho zápasu v zoradenom zozname
        const currentIndex = sortedMatchesForNavigation.findIndex(m => m.id === selectedMatch.id);
        
        // Zistenie, či existuje predchádzajúci a nasledujúci zápas
        const hasPrevious = currentIndex > 0;
        const hasNext = currentIndex < sortedMatchesForNavigation.length - 1;
        
        // Funkcie pre navigáciu
        const goToPreviousMatch = () => {
            if (hasPrevious) {
                const previousMatch = sortedMatchesForNavigation[currentIndex - 1];
                selectMatch(previousMatch);
            }
        };
        
        const goToNextMatch = () => {
            if (hasNext) {
                const nextMatch = sortedMatchesForNavigation[currentIndex + 1];
                selectMatch(nextMatch);
            }
        };
    
        // ✅ HLAVNÝ OBSAH - vykreslenie detailu zápasu
        const mainContent = React.createElement(
            'div',
            { className: 'flex-grow flex justify-center items-start p-4' },
            React.createElement(
                'div',
                { className: 'w-full max-w-6xl bg-white rounded-xl shadow-xl p-8' },
                
                // Hlavička s názvom haly a navigačnými tlačidlami
                React.createElement(
                    'div',
                    { className: 'flex flex-col items-center justify-center mb-8 p-4 -mx-8 -mt-8 rounded-t-xl bg-gradient-to-r from-red-50 to-white border-b border-red-200 relative' },
                    
                    // Tlačidlo "Všetky zápasy" v ľavom hornom rohu
                    React.createElement(
                        'button',
                        { 
                            onClick: showAllMatches,
                            className: 'absolute left-4 top-4 flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors text-gray-700 font-medium'
                        },
                        React.createElement('i', { className: 'fa-solid fa-arrow-left' }),
                        'Všetky zápasy'
                    ),
                    
                    // Navigačné tlačidlá v pravom hornom rohu
                    React.createElement(
                        'div',
                        { className: 'absolute right-4 top-4 flex items-center gap-2' },
                        
                        // Tlačidlo Predchádzajúci zápas (zobrazí sa len ak existuje)
                        hasPrevious && React.createElement(
                            'button',
                            { 
                                onClick: goToPreviousMatch,
                                className: 'flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors text-gray-700 font-medium'
                            },
                            React.createElement('i', { className: 'fa-solid fa-chevron-left' }),
                            'Predchádzajúci'
                        ),
                        
                        // Tlačidlo Nasledujúci zápas (zobrazí sa len ak existuje)
                        hasNext && React.createElement(
                            'button',
                            { 
                                onClick: goToNextMatch,
                                className: 'flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors text-gray-700 font-medium'
                            },
                            'Nasledujúci',
                            React.createElement('i', { className: 'fa-solid fa-chevron-right' })
                        )
                    ),
                    
                    React.createElement('h2', { className: 'text-3xl font-bold tracking-tight text-center text-gray-800' }, 'Detail zápasu'),
                    hallName && hallName !== 'Žiadna priradená hala' && React.createElement(
                        'div',
                        { className: 'mt-2 text-xl text-gray-600 flex items-center gap-2' },
                        React.createElement('i', { className: 'fa-solid fa-location-dot text-red-500' }),
                        `Športová hala ${hallName}`
                    )
                ),
        
                // Detail zápasu
                React.createElement(
                    'div',
                    { className: 'mx-auto' },
                    
                    // Dátum a čas
                    React.createElement(
                        'div',
                        { className: 'text-center mb-8 p-4 bg-blue-50 rounded-lg' },
                        React.createElement('div', { className: 'text-lg font-semibold text-gray-700' }, matchDate),
                        React.createElement(
                            'div', 
                            { className: 'text-2xl font-bold text-blue-600 mt-1 flex items-center justify-center gap-1' },
                            `${matchStartTime} hod.`
                        )
                    ),
                    
                    // Tímy
                    React.createElement(
                        'div',
                        { className: 'flex items-center justify-between gap-4 mb-8' },
                        
                        // Domáci tím
                        React.createElement(
                            'div',
                            { className: 'flex-1 text-center' },
                            React.createElement('div', { className: 'text-sm text-gray-500 mb-2' }, 'DOMÁCI'),
                            React.createElement('div', { className: 'text-xl font-bold text-gray-800' }, homeTeamName)
                        ),
                        
                        // VS
                        React.createElement(
                            'div',
                            { className: 'text-center' },
                            React.createElement('div', { className: 'text-3xl font-bold text-gray-400' }, 'VS')
                        ),
                        
                        // Hosťovský tím
                        React.createElement(
                            'div',
                            { className: 'flex-1 text-center' },
                            React.createElement('div', { className: 'text-sm text-gray-500 mb-2' }, 'HOSTIA'),
                            React.createElement('div', { className: 'text-xl font-bold text-gray-800' }, awayTeamName)
                        )
                    ),
                    
                    // Kategória a typ zápasu/skupina
                    React.createElement(
                        'div',
                        { className: 'grid grid-cols-2 gap-4 mb-6' },
                        React.createElement(
                            'div',
                            { className: 'bg-gray-50 p-3 rounded-lg text-center' },
                            React.createElement('div', { className: 'text-xs text-gray-500 mb-1' }, 'Kategória'),
                            React.createElement('div', { className: 'font-medium' }, selectedMatch.categoryName || 'neurčená')
                        ),
                        
                        // Ak má zápas typ, zobrazíme TYP ZÁPASU (aj keď má skupinu, skupina sa ignoruje)
                        hasMatchType ? React.createElement(
                            'div',
                            { className: 'bg-purple-50 p-3 rounded-lg text-center' },
                            React.createElement('div', { className: 'text-xs text-purple-500 mb-1' }, 'Typ zápasu'),
                            React.createElement('div', { className: 'font-medium text-purple-700' },
                                selectedMatch.isPlacementMatch ? `Zápas o ${selectedMatch.placementRank}. miesto` : selectedMatch.matchType
                            )
                        ) : React.createElement(
                            'div',
                            { className: 'bg-gray-50 p-3 rounded-lg text-center' },
                            React.createElement('div', { className: 'text-xs text-gray-500 mb-1' }, 'Skupina'),
                            React.createElement('div', { className: 'font-medium' }, selectedMatch.groupName || 'neurčená')
                        )
                    ),
                    
                    // Status a ovládacie prvky
                    React.createElement(
                        'div',
                        { className: 'bg-gray-50 p-4 rounded-lg mb-8' },
                        
                        // Status
                        React.createElement(
                            'div',
                            { className: 'text-center mb-4' },
                            React.createElement('div', { className: 'text-xs text-gray-500 mb-1' }, 'Status'),
                            React.createElement(
                                'div', 
                                { className: `font-medium ${
                                    selectedMatch.status === 'completed' ? 'text-green-600' : 
                                    selectedMatch.status === 'in-progress' ? 'text-blue-600' :
                                    selectedMatch.status === 'paused' ? 'text-yellow-600' : 
                                    'text-gray-600'
                                }` },
                                selectedMatch.status === 'completed' ? 'Odohrané' :
                                selectedMatch.status === 'in-progress' ? 'Prebieha' :
                                selectedMatch.status === 'paused' ? 'Pozastavené' : 
                                'Naplánované'
                            )
                        ),
                        
                        // PRIEBEH ČASU (nový prvok) - S DEBUG VÝPISOM
                        (selectedMatch.status === 'in-progress' || selectedMatch.status === 'paused') && category && React.createElement(
                            'div',
                            { className: 'text-center mb-4 p-3 bg-white rounded-lg border border-gray-200' },
                            React.createElement('div', { className: 'text-xs text-gray-500 mb-1' }, 'Priebeh času'),
                            React.createElement(
                                'div',
                                { className: 'text-3xl font-mono font-bold' },
                                formatMatchTime(matchTime || 0)
                            )
                        ),
                        
                        // Ovládacie prvky pre adminov a hall users (ZOBRAZENÉ VŽDY)
                        (userProfileData?.role === 'admin' || userProfileData?.role === 'hall') && 
                        React.createElement(
                            'div',
                            { className: 'flex flex-wrap items-center justify-center gap-3 pt-2 border-t border-gray-200' },
                            
                            // Čas štart / Čas stop / Pokračovať
                            selectedMatch.status === 'in-progress' ? 
                                React.createElement(
                                    'button',
                                    {
                                        className: 'px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                                        onClick: () => stopMatchTimer(selectedMatch.id)
                                    },
                                    React.createElement('i', { className: 'fa-solid fa-pause' }),
                                    'Čas stop'
                                ) :
                                selectedMatch.status === 'paused' ?
                                React.createElement(
                                    'button',
                                    {
                                        className: 'px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                                        onClick: () => resumeMatchTimer(selectedMatch.id)
                                    },
                                    React.createElement('i', { className: 'fa-solid fa-play' }),
                                    'Pokračovať'
                                ) :
                                React.createElement(
                                    'button',
                                    {
                                        className: 'px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                                        onClick: () => startMatchTimer(selectedMatch.id)
                                    },
                                    React.createElement('i', { className: 'fa-solid fa-play' }),
                                    'Čas štart'
                                ),
                            
                            // Perióda + / Perióda - (ak má kategória viac ako 1 periódu)
                            category && category.periods > 1 && React.createElement(
                                React.Fragment,
                                null,
                                React.createElement(
                                    'button',
                                    {
                                        className: 'px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                                        onClick: () => decreasePeriod(selectedMatch.id)
                                    },
                                    React.createElement('i', { className: 'fa-solid fa-minus' }),
                                    'Perióda -'
                                ),
                                React.createElement(
                                    'div',
                                    { className: 'px-4 py-2 bg-gray-100 rounded-lg text-sm font-medium' },
                                    `Perióda: ${selectedMatch.currentPeriod || 1} / ${category.periods}`
                                ),
                                React.createElement(
                                    'button',
                                    {
                                        className: 'px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                                        onClick: () => increasePeriod(selectedMatch.id, category.periods)
                                    },
                                    React.createElement('i', { className: 'fa-solid fa-plus' }),
                                    'Perióda +'
                                )
                            ),
                            
                            // Reset čas (vždy zobrazený)
                            React.createElement(
                                'button',
                                {
                                    className: 'px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                                    onClick: () => resetMatchTimer(selectedMatch.id)
                                },
                                React.createElement('i', { className: 'fa-solid fa-rotate-right' }),
                                'Reset čas'
                            ),
                            
                            // Ukončiť zápas (zobrazí sa len pre neukončené zápasy)
                            selectedMatch.status !== 'completed' && React.createElement(
                                'button',
                                {
                                    className: 'px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                                    onClick: () => endMatch(selectedMatch.id)
                                },
                                React.createElement('i', { className: 'fa-solid fa-flag-checkered' }),
                                'Ukončiť zápas'
                            )
                        )
                    ),
                    
                    // DETAILY TÍMOV - realizačný tím, hráči a priebeh zápasu
                    React.createElement(
                        'div',
                        { className: 'grid grid-cols-4 gap-6' },
                        
                        // Domáci tím - detail (1. stĺpec)
                        // ... (zvyšný kód pre domáci tím zostáva rovnaký)
                        React.createElement(
                            'div',
                            { className: 'col-span-1 bg-gray-50 rounded-lg p-4 border border-gray-200' },
                            React.createElement(
                                'h3',
                                { className: 'font-bold text-lg text-gray-800 mb-3 text-center border-b border-gray-200 pb-2' },
                                homeTeamName
                            ),
                            
                            // Realizačný tím pre domáci tím
                            React.createElement(
                                'div',
                                { className: 'mb-4' },
                                React.createElement(
                                    'h4',
                                    { className: 'font-semibold text-sm text-gray-700 mb-2 flex items-center gap-1' },
                                    React.createElement('i', { className: 'fa-solid fa-user-tie text-xs text-gray-500' }),
                                    'Realizačný tím'
                                ),
                                
                                homeTeamDetails ? React.createElement(
                                    'div',
                                    { className: 'space-y-2' },
                                    
                                    // Muži v realizačnom tíme
                                    homeTeamDetails.team.menTeamMemberDetails && homeTeamDetails.team.menTeamMemberDetails.length > 0 && 
                                    homeTeamDetails.team.menTeamMemberDetails.map((member, idx) => {
                                        const staffIdentifier = {
                                            userId: homeTeamDetails.userId,
                                            teamIdentifier: selectedMatch.homeTeamIdentifier,
                                            playerId: `staff-men-${idx}`,
                                            displayName: `${member.firstName} ${member.lastName} (tréner)`,
                                            isStaff: true
                                        };
                                        
                                        return React.createElement(
                                            'div',
                                            { 
                                                key: `home-men-${idx}`, 
                                                className: 'bg-white p-2 rounded border border-gray-200 text-sm group relative hover:bg-blue-50 transition-colors cursor-pointer',
                                                onClick: () => {
                                                    // ✅ UPRAVENÉ: Povolené všetky typy udalostí pre trénerov
                                                    if (eventType) {
                                                        setEventTeam('home');
                                                        setSelectedPlayerForEvent(staffIdentifier);
                                                        addMatchEvent();
                                                    }
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { className: 'flex items-center gap-2' },
                                                React.createElement('i', { className: 'fa-solid fa-user text-gray-600 text-xs' }),
                                                React.createElement('span', { className: 'font-medium' }, `${member.firstName} ${member.lastName}`)
                                            )
                                        );
                                    }),
                                                                        
                                    // Ženy v realizačnom tíme
                                    homeTeamDetails.team.womenTeamMemberDetails && homeTeamDetails.team.womenTeamMemberDetails.length > 0 && 
                                    homeTeamDetails.team.womenTeamMemberDetails.map((member, idx) => {
                                        const staffIdentifier = {
                                            userId: homeTeamDetails.userId,
                                            teamIdentifier: selectedMatch.homeTeamIdentifier,
                                            playerId: `staff-women-${idx}`,
                                            displayName: `${member.firstName} ${member.lastName} (trénerka)`,
                                            isStaff: true
                                        };
                                        
                                        return React.createElement(
                                            'div',
                                            { 
                                                key: `home-women-${idx}`, 
                                                className: 'bg-white p-2 rounded border border-gray-200 text-sm group relative hover:bg-blue-50 transition-colors cursor-pointer',
                                                onClick: () => {
                                                    // ✅ UPRAVENÉ: Povolené všetky typy udalostí pre trénerky
                                                    if (eventType) {
                                                        setEventTeam('home');
                                                        setSelectedPlayerForEvent(staffIdentifier);
                                                        addMatchEvent();
                                                    }
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { className: 'flex items-center gap-2' },
                                                React.createElement('i', { className: 'fa-solid fa-user text-pink-600 text-xs' }),
                                                React.createElement('span', { className: 'font-medium' }, `${member.firstName} ${member.lastName}`)
                                            )
                                        );
                                    }),
                                    
                                    // Ak nie sú žiadni členovia realizačného tímu
                                    (!homeTeamDetails.team.menTeamMemberDetails || homeTeamDetails.team.menTeamMemberDetails.length === 0) &&
                                    (!homeTeamDetails.team.womenTeamMemberDetails || homeTeamDetails.team.womenTeamMemberDetails.length === 0) &&
                                    React.createElement(
                                        'div',
                                        { className: 'text-sm text-gray-500 italic p-2' },
                                        'Žiadni členovia realizačného tímu'
                                    )
                                ) : React.createElement(
                                    'div',
                                    { className: 'text-sm text-gray-500 italic p-2' },
                                    'Nedostupné'
                                )
                            ),
                            
                            // V časti s hráčmi pre domáci tím (1. stĺpec) - nahraďte existujúcu časť s hráčmi
                            React.createElement(
                                'div',
                                null,
                                React.createElement(
                                    'h4',
                                    { className: 'font-semibold text-sm text-gray-700 mb-2 flex items-center gap-1' },
                                    React.createElement('i', { className: 'fa-solid fa-users text-xs text-gray-500' }),
                                    `Hráči (${homeTeamDetails?.team.playerDetails?.length || 0})`
                                ),
                                
                                homeTeamDetails ? React.createElement(
                                    'div',
                                    { className: 'space-y-1' },
                                    homeTeamDetails.team.playerDetails && homeTeamDetails.team.playerDetails.length > 0 ? 
                                        [...homeTeamDetails.team.playerDetails]
                                            .sort((a, b) => {
                                                const numA = a.jerseyNumber ? parseInt(a.jerseyNumber) || 999 : 999;
                                                const numB = b.jerseyNumber ? parseInt(b.jerseyNumber) || 999 : 999;
                                                return numA - numB;
                                            })
                                            .map((player, idx) => {
                                                // Vytvoríme identifikátor hráča
                                                const playerIdentifier = {
                                                    userId: homeTeamDetails.userId,
                                                    teamIdentifier: selectedMatch.homeTeamIdentifier,
                                                    playerId: player.id || `${player.firstName} ${player.lastName}`,
                                                    displayName: `${player.firstName} ${player.lastName}${player.jerseyNumber ? ` (#${player.jerseyNumber})` : ''}`
                                                };
                                                
                                                return React.createElement(
                                                    'div',
                                                    { 
                                                        key: `home-player-${idx}`, 
                                                        className: 'bg-white p-2 rounded border border-gray-200 text-sm group relative hover:bg-blue-50 transition-colors cursor-pointer',
                                                        onClick: () => {
                                                            // ✅ UPRAVENÉ: Pridaný setEventTeam('home')
                                                            if (eventType) {
                                                                setEventTeam('home'); // Nastavíme tím podľa toho, na ktorého hráča sa kliklo
                                                                setSelectedPlayerForEvent(playerIdentifier);
                                                                addMatchEvent();
                                                            }
                                                        }
                                                    },
                                                    React.createElement(
                                                        'div',
                                                        { className: 'flex items-center gap-2 flex-wrap' },
                                                        React.createElement('i', { className: 'fa-solid fa-shirt text-gray-600 text-xs' }),
                                                        player.jerseyNumber && React.createElement(
                                                            'span',
                                                            { className: 'font-bold text-gray-700 text-xs bg-gray-100 px-1.5 py-0.5 rounded' },
                                                            `${player.jerseyNumber}`
                                                        ),
                                                        React.createElement(
                                                            'span',
                                                            { className: 'font-medium' },
                                                            `${player.firstName} ${player.lastName}`
                                                        )
                                                    )
                                                );
                                            })
                                        : React.createElement(
                                            'div',
                                            { className: 'text-sm text-gray-500 italic p-2' },
                                            'Žiadni hráči'
                                        )
                                ) : React.createElement(
                                    'div',
                                    { className: 'text-sm text-gray-500 italic p-2' },
                                    'Nedostupné'
                                )
                            )
                        ),
        
                        // Druhý box - Priebeh zápasu (NOVÝ)
                        React.createElement(
                            'div',
                            { className: 'col-span-2 bg-gray-50 rounded-lg p-4 border border-gray-200 flex flex-col' },
                            React.createElement(
                                'h3',
                                { className: 'font-bold text-lg text-gray-800 mb-3 text-center border-b border-gray-200 pb-2' },
                                'Priebeh zápasu'
                            ),
                            
                            // Skóre
                            React.createElement(
                                'div',
                                { className: 'mb-4 text-center' },
                                React.createElement(
                                    'div',
                                    { className: 'text-3xl font-bold text-gray-800 mb-1' },
                                    loadingEvents ? '...' : `${matchScore.home} : ${matchScore.away}`
                                ),
                                React.createElement(
                                    'div',
                                    { className: 'text-xs text-gray-500' },
                                    'Aktuálne skóre'
                                )
                            ),
                            
                            // Ovládacie tlačidlá pre adminov a hall users - JEDNOTNÉ pre oba tímy
                            (userProfileData?.role === 'admin' || userProfileData?.role === 'hall') && React.createElement(
                                'div',
                                { className: 'flex flex-wrap gap-2 justify-center mb-4' },
                                React.createElement(
                                    'button',
                                    {
                                        className: `px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                                            eventType === 'goal' 
                                                ? 'bg-green-700 text-white ring-2 ring-green-300' 
                                                : 'bg-green-600 hover:bg-green-700 text-white'
                                        }`,
                                        onClick: () => {
                                            // Ak je už vybratý rovnaký typ, zrušíme výber, inak nastavíme
                                            if (eventType === 'goal') {
                                                setEventType(null);
                                                setEventTeam(null);
                                            } else {
                                                setEventType('goal');
                                                // eventTeam sa nastaví až pri kliknutí na hráča
                                            }
                                        }
                                    },
                                    React.createElement('i', { className: 'fa-solid fa-futbol' }),
                                    'Gól'
                                ),
                                React.createElement(
                                    'button',
                                    {
                                        className: `px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                                            eventType === 'penalty' 
                                                ? 'bg-blue-700 text-white ring-2 ring-blue-300' 
                                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                                        }`,
                                        onClick: () => {
                                            if (eventType === 'penalty') {
                                                setEventType(null);
                                                setEventTeam(null);
                                            } else {
                                                setEventType('penalty');
                                            }
                                        }
                                    },
                                    React.createElement('i', { className: 'fa-solid fa-circle-dot' }),
                                    '7m'
                                ),
                                React.createElement(
                                    'button',
                                    {
                                        className: `px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                                            eventType === 'yellow' 
                                                ? 'bg-yellow-700 text-white ring-2 ring-yellow-300' 
                                                : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                                        }`,
                                        onClick: () => {
                                            if (eventType === 'yellow') {
                                                setEventType(null);
                                                setEventTeam(null);
                                            } else {
                                                setEventType('yellow');
                                            }
                                        }
                                    },
                                    React.createElement('i', { className: 'fa-solid fa-square' }),
                                    'ŽK'
                                ),
                                React.createElement(
                                    'button',
                                    {
                                        className: `px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                                            eventType === 'red' 
                                                ? 'bg-red-700 text-white ring-2 ring-red-300' 
                                                : 'bg-red-600 hover:bg-red-700 text-white'
                                        }`,
                                        onClick: () => {
                                            if (eventType === 'red') {
                                                setEventType(null);
                                                setEventTeam(null);
                                            } else {
                                                setEventType('red');
                                            }
                                        }
                                    },
                                    React.createElement('i', { className: 'fa-solid fa-square' }),
                                    'ČK'
                                ),
                                React.createElement(
                                    'button',
                                    {
                                        className: `px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                                            eventType === 'blue' 
                                                ? 'bg-blue-900 text-white ring-2 ring-blue-300' 
                                                : 'bg-blue-800 hover:bg-blue-900 text-white'
                                        }`,
                                        onClick: () => {
                                            if (eventType === 'blue') {
                                                setEventType(null);
                                                setEventTeam(null);
                                            } else {
                                                setEventType('blue');
                                            }
                                        }
                                    },
                                    React.createElement('i', { className: 'fa-solid fa-square' }),
                                    'MK'
                                ),
                                React.createElement(
                                    'button',
                                    {
                                        className: `px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                                            eventType === 'exclusion' 
                                                ? 'bg-orange-700 text-white ring-2 ring-orange-300' 
                                                : 'bg-orange-600 hover:bg-orange-700 text-white'
                                        }`,
                                        onClick: () => {
                                            if (eventType === 'exclusion') {
                                                setEventType(null);
                                                setEventTeam(null);
                                            } else {
                                                setEventType('exclusion');
                                            }
                                        }
                                    },
                                    React.createElement('i', { className: 'fa-solid fa-user-slash' }),
                                    'Vylúčenie'
                                )
                            ),
                            
                            // Zoznam udalostí - nahraďte existujúcu časť
                            React.createElement(
                                'div',
                                { className: 'bg-gray-50 rounded-lg p-4 border border-gray-200' },
                                React.createElement(
                                    'h4',
                                    { className: 'font-semibold text-sm text-gray-700 mb-3 flex items-center gap-1' },
                                    React.createElement('i', { className: 'fa-solid fa-clock text-xs text-gray-500' }),
                                    'Priebeh zápasu',
                                    loadingEvents && React.createElement('div', { className: 'animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 ml-2' })
                                ),
                                
                                matchEvents.length === 0 ? React.createElement(
                                    'div',
                                    { className: 'text-sm text-gray-500 italic p-4 text-center' },
                                    'Zatiaľ žiadne udalosti'
                                ) : React.createElement(
                                    'div',
                                    { className: 'space-y-2' },
                                    matchEvents.map((event) => {
                                        const playerName = event.playerRef ? getPlayerNameFromRef(event.playerRef) : '';
                                        
                                        let eventDisplay = '';
                                        
                                        switch (event.type) {
                                            case 'goal':
                                                eventDisplay = React.createElement('i', { className: 'fa-solid fa-futbol text-black text-sm' });
                                                break;
                                            case 'penalty':
                                                eventDisplay = React.createElement('i', { className: `fa-solid fa-circle-dot ${event.subType === 'scored' ? 'text-green-600' : 'text-red-600'} text-sm` });
                                                break;
                                            case 'yellow':
                                                eventDisplay = React.createElement(
                                                    'div',
                                                    { className: 'w-6 h-4 bg-yellow-400 rounded-md' }
                                                );
                                                break;
                                            case 'red':
                                                eventDisplay = React.createElement(
                                                    'div',
                                                    { className: 'w-6 h-4 bg-red-600 rounded-md' }
                                                );
                                                break;
                                            case 'blue':
                                                eventDisplay = React.createElement(
                                                    'div',
                                                    { className: 'w-6 h-4 bg-blue-600 rounded-md' }
                                                );
                                                break;
                                            case 'exclusion':
                                                eventDisplay = React.createElement(
                                                    'span',
                                                    { className: 'font-bold text-orange-600' },
                                                    '2\''
                                                );
                                                break;
                                            default:
                                                eventDisplay = React.createElement('i', { className: 'fa-solid fa-clock text-gray-600 text-sm' });
                                        }
                                        
                                        // Vytvoríme grid s 3 stĺpcami
                                        return React.createElement(
                                            'div',
                                            {
                                                key: event.id,
                                                className: 'grid grid-cols-3 gap-2 p-2 bg-white rounded-lg border border-gray-200 text-sm group items-center'
                                            },
                                            // Ľavý stĺpec - pre domácich
                                            React.createElement(
                                                'div',
                                                { className: 'flex items-center gap-2' },
                                                event.team === 'home' && React.createElement(
                                                    React.Fragment,
                                                    null,
                                                    eventDisplay,
                                                    React.createElement('span', { className: 'text-gray-700' }, playerName)
                                                )
                                            ),
                                            
                                            // Stredný stĺpec - vždy čas (čierny)
                                            React.createElement(
                                                'div',
                                                { className: 'text-center' },
                                                React.createElement('span', { className: 'font-mono text-xs text-gray-800' }, 
                                                    `${event.minute}:${event.second?.toString().padStart(2, '0') || '00'}`
                                                )
                                            ),
                                            
                                            // Pravý stĺpec - pre hostí + tlačidlo
                                            React.createElement(
                                                'div',
                                                { className: 'flex items-center justify-end gap-2' },
                                                event.team === 'away' && React.createElement(
                                                    React.Fragment,
                                                    null,
                                                    React.createElement('span', { className: 'text-gray-700' }, playerName),
                                                    eventDisplay
                                                ),
                                                (userProfileData?.role === 'admin' || userProfileData?.role === 'hall') && React.createElement(
                                                    'button',
                                                    {
                                                        className: 'opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 ml-2',
                                                        onClick: () => deleteMatchEvent(event.id)
                                                    },
                                                    React.createElement('i', { className: 'fa-solid fa-trash-can text-xs' })
                                                )
                                            )
                                        );
                                    })
                                )
                            )
                        ),
                        
                        // Hosťovský tím - detail (3. stĺpec)
                        React.createElement(
                            'div',
                            { className: 'col-span-1 bg-gray-50 rounded-lg p-4 border border-gray-200' },
                            React.createElement(
                                'h3',
                                { className: 'font-bold text-lg text-gray-800 mb-3 text-center border-b border-gray-200 pb-2' },
                                awayTeamName
                            ),
                            
                            // Realizačný tím pre hosťovský tím
                            React.createElement(
                                'div',
                                { className: 'mb-4' },
                                React.createElement(
                                    'h4',
                                    { className: 'font-semibold text-sm text-gray-700 mb-2 flex items-center gap-1' },
                                    React.createElement('i', { className: 'fa-solid fa-user-tie text-xs text-gray-500' }),
                                    'Realizačný tím'
                                ),
                                
                                awayTeamDetails ? React.createElement(
                                    'div',
                                    { className: 'space-y-2' },
                                    
                                    // Muži v realizačnom tíme
                                    awayTeamDetails.team.menTeamMemberDetails && awayTeamDetails.team.menTeamMemberDetails.length > 0 && 
                                    awayTeamDetails.team.menTeamMemberDetails.map((member, idx) => {
                                        const staffIdentifier = {
                                            userId: awayTeamDetails.userId,
                                            teamIdentifier: selectedMatch.awayTeamIdentifier,
                                            playerId: `staff-men-${idx}`,
                                            displayName: `${member.firstName} ${member.lastName} (tréner)`,
                                            isStaff: true
                                        };
                                        
                                        return React.createElement(
                                            'div',
                                            { 
                                                key: `away-men-${idx}`, 
                                                className: 'bg-white p-2 rounded border border-gray-200 text-sm group relative hover:bg-blue-50 transition-colors cursor-pointer',
                                                onClick: () => {
                                                    // ✅ UPRAVENÉ: Povolené všetky typy udalostí pre trénerov
                                                    if (eventType) {
                                                        setEventTeam('away');
                                                        setSelectedPlayerForEvent(staffIdentifier);
                                                        addMatchEvent();
                                                    }
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { className: 'flex items-center gap-2' },
                                                React.createElement('i', { className: 'fa-solid fa-user text-gray-600 text-xs' }),
                                                React.createElement('span', { className: 'font-medium' }, `${member.firstName} ${member.lastName}`)
                                            )
                                        );
                                    }),
                                                                        
                                    // Ženy v realizačnom tíme
                                    awayTeamDetails.team.womenTeamMemberDetails && awayTeamDetails.team.womenTeamMemberDetails.length > 0 && 
                                    awayTeamDetails.team.womenTeamMemberDetails.map((member, idx) => {
                                        const staffIdentifier = {
                                            userId: awayTeamDetails.userId,
                                            teamIdentifier: selectedMatch.awayTeamIdentifier,
                                            playerId: `staff-women-${idx}`,
                                            displayName: `${member.firstName} ${member.lastName} (trénerka)`,
                                            isStaff: true
                                        };
                                        
                                        return React.createElement(
                                            'div',
                                            { 
                                                key: `away-women-${idx}`, 
                                                className: 'bg-white p-2 rounded border border-gray-200 text-sm group relative hover:bg-blue-50 transition-colors cursor-pointer',
                                                onClick: () => {
                                                    // ✅ UPRAVENÉ: Povolené všetky typy udalostí pre trénerky
                                                    if (eventType) {
                                                        setEventTeam('away');
                                                        setSelectedPlayerForEvent(staffIdentifier);
                                                        addMatchEvent();
                                                    }
                                                }
                                            },
                                            React.createElement(
                                                'div',
                                                { className: 'flex items-center gap-2' },
                                                React.createElement('i', { className: 'fa-solid fa-user text-pink-600 text-xs' }),
                                                React.createElement('span', { className: 'font-medium' }, `${member.firstName} ${member.lastName}`)
                                            )
                                        );
                                    }),
                                    
                                    // Ak nie sú žiadni členovia realizačného tímu
                                    (!awayTeamDetails.team.menTeamMemberDetails || awayTeamDetails.team.menTeamMemberDetails.length === 0) &&
                                    (!awayTeamDetails.team.womenTeamMemberDetails || awayTeamDetails.team.womenTeamMemberDetails.length === 0) &&
                                    React.createElement(
                                        'div',
                                        { className: 'text-sm text-gray-500 italic p-2' },
                                        'Žiadni členovia realizačného tímu'
                                    )
                                ) : React.createElement(
                                    'div',
                                    { className: 'text-sm text-gray-500 italic p-2' },
                                    'Nedostupné'
                                )
                            ),
                            
                            // Hráči hosťovského tímu
                            React.createElement(
                                'div',
                                null,
                                React.createElement(
                                    'h4',
                                    { className: 'font-semibold text-sm text-gray-700 mb-2 flex items-center gap-1' },
                                    React.createElement('i', { className: 'fa-solid fa-users text-xs text-gray-500' }),
                                    `Hráči (${awayTeamDetails?.team.playerDetails?.length || 0})`
                                ),
                                
                                awayTeamDetails ? React.createElement(
                                    'div',
                                    { className: 'space-y-1' },
                                    // Hráči hosťovského tímu
                                    awayTeamDetails.team.playerDetails && awayTeamDetails.team.playerDetails.length > 0 ? 
                                        [...awayTeamDetails.team.playerDetails]
                                            .sort((a, b) => {
                                                const numA = a.jerseyNumber ? parseInt(a.jerseyNumber) || 999 : 999;
                                                const numB = b.jerseyNumber ? parseInt(b.jerseyNumber) || 999 : 999;
                                                return numA - numB;
                                            })
                                            .map((player, idx) => {
                                                const playerIdentifier = {
                                                    userId: awayTeamDetails.userId,
                                                    teamIdentifier: selectedMatch.awayTeamIdentifier,
                                                    playerId: player.id || `${player.firstName} ${player.lastName}`,
                                                    displayName: `${player.firstName} ${player.lastName}${player.jerseyNumber ? ` (#${player.jerseyNumber})` : ''}`
                                                };
                                                
                                                return React.createElement(
                                                    'div',
                                                    { 
                                                        key: `away-player-${idx}`, 
                                                        className: 'bg-white p-2 rounded border border-gray-200 text-sm group relative hover:bg-blue-50 transition-colors cursor-pointer',
                                                        onClick: () => {
                                                            // ✅ UPRAVENÉ: Pridaný setEventTeam('away')
                                                            if (eventType) {
                                                                setEventTeam('away');
                                                                setSelectedPlayerForEvent(playerIdentifier);
                                                                addMatchEvent();
                                                            }
                                                        }
                                                    },
                                                    React.createElement(
                                                        'div',
                                                        { className: 'flex items-center gap-2 flex-wrap' },
                                                        React.createElement('i', { className: 'fa-solid fa-shirt text-gray-600 text-xs' }),
                                                        player.jerseyNumber && React.createElement(
                                                            'span',
                                                            { className: 'font-bold text-gray-700 text-xs bg-gray-100 px-1.5 py-0.5 rounded' },
                                                            `${player.jerseyNumber}`
                                                        ),
                                                        React.createElement(
                                                            'span',
                                                            { className: 'font-medium' },
                                                            `${player.firstName} ${player.lastName}`
                                                        )
                                                    )
                                                );
                                            })
                                        : React.createElement(
                                            'div',
                                            { className: 'text-sm text-gray-500 italic p-2' },
                                            'Žiadni hráči'
                                        )
                                ) : React.createElement(
                                    'div',
                                    { className: 'text-sm text-gray-500 italic p-2' },
                                    'Nedostupné'
                                )
                            )
                        )
                    ),
                    
                    // Informácia o pozícii v zozname
                    React.createElement(
                        'div',
                        { className: 'text-center text-xs text-gray-400 mt-6' },
                        `${currentIndex + 1} / ${sortedMatchesForNavigation.length}`
                    )
                )
            )
        );
    
        // ✅ VRÁTIME HLAVNÝ OBSAH AJ MODÁLNE OKNO SPOLU
        return React.createElement(
            React.Fragment,
            null,
            mainContent,
            React.createElement(EventModal, {
                isOpen: eventModalOpen,
                onClose: () => {
                    setEventModalOpen(false);
                    setEventType(null);
                    setEventTeam(null);
                    setEventMinute('');
                    setEventSubType(null);
                    setSelectedPlayerForEvent(null);
                },
                onConfirm: (data) => {
                    setEventTeam(data.team);
                    setEventMinute(data.minute);
                    setEventSubType(data.subType);
                    setSelectedPlayerForEvent(data.player);
                    addMatchEvent();
                },
                homeTeamDetails: homeTeamDetails,
                awayTeamDetails: awayTeamDetails
            })
        );
    }
    
    // Inak zobrazíme zoznam všetkých zápasov
    return React.createElement(
        'div',
        { className: 'flex-grow flex justify-center items-start p-4' },
        React.createElement(
            'div',
            { className: 'w-full max-w-6xl bg-white rounded-xl shadow-xl p-8' },
            
            // Hlavička s názvom haly
            React.createElement(
                'div',
                { className: 'flex flex-col items-center justify-center mb-8 p-4 -mx-8 -mt-8 rounded-t-xl bg-gradient-to-r from-red-50 to-white border-b border-red-200' },
                React.createElement('h2', { className: 'text-3xl font-bold tracking-tight text-center text-gray-800' }, 'Zápasy'),
                hallName && hallName !== 'Žiadna priradená hala' && React.createElement(
                    'div',
                    { className: 'mt-2 text-xl text-gray-600 flex items-center gap-2' },
                    React.createElement('i', { className: 'fa-solid fa-location-dot text-red-500' }),
                    `Športová hala ${hallName}`
                ),
                hallName === 'Žiadna priradená hala' && React.createElement(
                    'div',
                    { className: 'mt-2 text-lg text-gray-600' },
                    hallName
                )
            ),
    
            // Indikátor načítavania
            loading && React.createElement(
                'div',
                { className: 'flex justify-center items-center py-12' },
                React.createElement('div', { className: 'animate-spin rounded-full h-12 w-12 border-b-4 border-blue-500' })
            ),
    
            // Žiadne zápasy
            !loading && matches.length === 0 && React.createElement(
                'div',
                { className: 'text-center py-12 text-gray-500' },
                React.createElement('i', { className: 'fa-solid fa-calendar-xmark text-5xl mb-4 opacity-30' }),
                React.createElement('p', { className: 'text-xl' }, 'Pre túto halu nie sú naplánované žiadne zápasy')
            ),
    
            // Zápasy zoskupené podľa dní
            !loading && matches.length > 0 && React.createElement(
                'div',
                { className: 'space-y-8' },
                sortedDays.map((dayGroup) => 
                    React.createElement(
                        'div',
                        { key: dayGroup.dateStr, className: 'border border-gray-200 rounded-xl overflow-hidden shadow-sm' },
                        
                        // Hlavička dňa
                        React.createElement(
                            'div',
                            { className: 'bg-gray-50 px-6 py-3 border-b border-gray-200' },
                            React.createElement(
                                'h3',
                                { className: 'text-lg font-semibold text-gray-700 flex items-center gap-2' },
                                React.createElement('i', { className: 'fa-regular fa-calendar text-blue-500' }),
                                formatDateWithDay(dayGroup.date),
                                React.createElement(
                                    'span',
                                    { className: 'ml-2 text-sm font-normal text-gray-500' },
                                    `(${dayGroup.matches.length} ${dayGroup.matches.length === 1 ? 'zápas' : dayGroup.matches.length < 5 ? 'zápasy' : 'zápasov'})`
                                )
                            )
                        ),
    
                        // Zoznam zápasov pre tento deň
                        React.createElement(
                            'div',
                            { className: 'divide-y divide-gray-100' },
                            dayGroup.matches.map((match) => {
                                // Použijeme funkciu getTeamNameByIdentifier na získanie názvov tímov
                                const homeTeamName = getTeamNameByIdentifier(match.homeTeamIdentifier);
                                const awayTeamName = getTeamNameByIdentifier(match.awayTeamIdentifier);
                                const category = categories.find(c => c.name === match.categoryName);
                                
                                // Zistenie, či má zápas typ (finále, semifinále, o umiestnenie)
                                const hasMatchType = match.isPlacementMatch || match.matchType;
                                
                                // Príprava textu pre skupinu alebo typ zápasu
                                let groupOrTypeText = '';
                                let groupOrTypeClass = '';
                                
                                if (hasMatchType) {
                                    // Ak má zápas typ, zobrazíme typ
                                    if (match.isPlacementMatch) {
                                        groupOrTypeText = `o ${match.placementRank}. miesto`;
                                    } else {
                                        groupOrTypeText = match.matchType;
                                    }
                                    groupOrTypeClass = 'bg-purple-100 text-purple-700';
                                } else if (match.groupName) {
                                    // Ak má skupinu, zobrazíme skupinu
                                    groupOrTypeText = match.groupName;
                                    groupOrTypeClass = 'bg-green-100 text-green-700';
                                } else {
                                    // Ak nemá nič, zobrazíme pomlčku
                                    groupOrTypeText = '—';
                                    groupOrTypeClass = 'bg-gray-100 text-gray-500';
                                }
                                
                                return React.createElement(
                                    'div',
                                    { 
                                        key: match.id, 
                                        className: 'px-6 py-4 hover:bg-blue-50 transition-colors cursor-pointer',
                                        onClick: () => selectMatch(match)
                                    },
                                    React.createElement(
                                        'div',
                                        { className: 'flex flex-wrap items-center gap-4' },
                                        
                                        // Čas
                                        React.createElement(
                                            'div',
                                            { className: 'flex items-center gap-2 text-gray-600 min-w-[100px]' },
                                            React.createElement('i', { className: 'fa-regular fa-clock text-blue-500' }),
                                            React.createElement('span', { className: 'font-mono font-medium' }, formatTime(match.scheduledTime))
                                        ),
                                        
                                        // VS - ZOBRAZUJEME NÁZVY TÍMOV
                                        React.createElement(
                                            'div',
                                            { className: 'flex items-center gap-3 flex-1' },
                                            React.createElement(
                                                'span',
                                                { className: 'font-medium text-gray-800 text-right flex-1' },
                                                homeTeamName
                                            ),
                                            React.createElement('span', { className: 'text-xs font-bold text-gray-400 px-2' }, 'VS'),
                                            React.createElement(
                                                'span',
                                                { className: 'font-medium text-gray-800 flex-1' },
                                                awayTeamName
                                            )
                                        ),
                                        
                                        // Skupina alebo typ zápasu
                                        React.createElement(
                                            'span',
                                            { 
                                                className: `px-3 py-1 text-xs font-medium rounded-full ${groupOrTypeClass}`,
                                            },
                                            groupOrTypeText
                                        ),

                                        // Kategória (ak existuje)
                                        category && React.createElement(
                                            'span',
                                            { 
                                                className: 'px-3 py-1 text-xs font-medium rounded-full mr-2',
                                                style: { 
                                                    backgroundColor: '#EFF6FF',
                                                    color: '#1E40AF'
                                                }
                                            },
                                            category.name
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

// 🔴 NOVÉ MODÁLNE OKNÁ - PRIDAŤ SEM (pred handleDataUpdateAndRender)

// Komponent pre modálne okno výberu hráča
const PlayerSelectModal = ({ isOpen, onClose, onSelect, players, staff, teamName }) => {
    const [selectedPlayerId, setSelectedPlayerId] = useState('');

    if (!isOpen) return null;

    const allPeople = [...players, ...staff];

    return React.createElement(
        'div',
        {
            className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[120]',
            onClick: (e) => {
                if (e.target === e.currentTarget) onClose();
            }
        },
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto' },
            
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mb-4' },
                React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, `Výber osoby - ${teamName}`),
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'text-gray-500 hover:text-gray-700'
                    },
                    React.createElement('i', { className: 'fa-solid fa-times text-xl' })
                )
            ),

            allPeople.length === 0 ? React.createElement(
                'div',
                { className: 'text-center py-8 text-gray-500' },
                'Žiadne osoby na výber'
            ) : React.createElement(
                'div',
                { className: 'space-y-2' },
                allPeople.map((person, idx) => 
                    React.createElement(
                        'button',
                        {
                            key: idx,
                            className: `w-full p-3 text-left rounded-lg border transition-colors ${
                                selectedPlayerId === (person.playerId || idx)
                                    ? 'bg-blue-100 border-blue-500'
                                    : 'bg-white border-gray-200 hover:bg-gray-50'
                            }`,
                            onClick: () => setSelectedPlayerId(person.playerId || idx)
                        },
                        React.createElement(
                            'div',
                            { className: 'flex items-center gap-2' },
                            React.createElement('i', { 
                                className: `fa-solid ${
                                    person.isStaff ? 'fa-user-tie' : 'fa-user'
                                } text-gray-500 text-sm` 
                            }),
                            React.createElement('span', { className: 'font-medium' }, person.displayName)
                        )
                    )
                ),
                
                React.createElement(
                    'div',
                    { className: 'flex justify-end gap-3 mt-4' },
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
                                const selected = allPeople.find(p => (p.playerId || p) === selectedPlayerId);
                                if (selected) {
                                    onSelect(selected);
                                    onClose();
                                }
                            },
                            disabled: !selectedPlayerId,
                            className: `px-4 py-2 text-white rounded-lg transition-colors ${
                                selectedPlayerId
                                    ? 'bg-blue-600 hover:bg-blue-700'
                                    : 'bg-gray-400 cursor-not-allowed'
                            }`
                        },
                        'Vybrať'
                    )
                )
            )
        )
    );
};

// Komponent pre modálne okno pridania udalosti
const EventModal = ({ isOpen, onClose, onConfirm, homeTeamDetails, awayTeamDetails }) => {
    const [localEventType, setLocalEventType] = useState(null);
    const [localEventTeam, setLocalEventTeam] = useState(null);
    const [localEventMinute, setLocalEventMinute] = useState('');
    const [localEventSubType, setLocalEventSubType] = useState(null);
    const [localSelectedPlayer, setLocalSelectedPlayer] = useState(null);
    const [playerModalOpen, setPlayerModalOpen] = useState(false);
    const [selectingForTeam, setSelectingForTeam] = useState(null);

    React.useEffect(() => {
        if (isOpen) {
            setLocalEventType(null);
            setLocalEventTeam(null);
            setLocalEventMinute('');
            setLocalEventSubType(null);
            setLocalSelectedPlayer(null);
        }
    }, [isOpen]);

    const handleSelectPlayer = (team) => {
        setSelectingForTeam(team);
        setPlayerModalOpen(true);
    };

    const handlePlayerSelected = (player) => {
        setLocalSelectedPlayer(player);
    };

    const handleConfirm = () => {
        if (!localEventType || !localEventTeam || !localEventMinute) return;
        
        if (localEventType === 'penalty' && !localEventSubType) return;
        
        if ((localEventType === 'goal' || localEventType === 'exclusion') && !localSelectedPlayer) return;
        
        if ((localEventType === 'yellow' || localEventType === 'red' || localEventType === 'blue') && !localSelectedPlayer) return;
        
        onConfirm({
            type: localEventType,
            team: localEventTeam,
            minute: localEventMinute,
            subType: localEventSubType,
            player: localSelectedPlayer
        });
    };

    const getTeamName = (team) => {
        if (team === 'home' && homeTeamDetails) {
            const teamObj = homeTeamDetails.team;
            return teamObj.teamName || `${teamObj.category} ${teamObj.groupName?.replace('skupina ', '')}${teamObj.order}`;
        }
        if (team === 'away' && awayTeamDetails) {
            const teamObj = awayTeamDetails.team;
            return teamObj.teamName || `${teamObj.category} ${teamObj.groupName?.replace('skupina ', '')}${teamObj.order}`;
        }
        return '';
    };

    if (!isOpen) return null;

    return React.createElement(
        React.Fragment,
        null,
        React.createElement(
            'div',
            {
                className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[110]',
                onClick: (e) => {
                    if (e.target === e.currentTarget) onClose();
                }
            },
            React.createElement(
                'div',
                { className: 'bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4' },
                
                React.createElement(
                    'div',
                    { className: 'flex justify-between items-center mb-4' },
                    React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, 'Pridať udalosť'),
                    React.createElement(
                        'button',
                        {
                            onClick: onClose,
                            className: 'text-gray-500 hover:text-gray-700'
                        },
                        React.createElement('i', { className: 'fa-solid fa-times text-xl' })
                    )
                ),

                // Výber typu udalosti
                React.createElement(
                    'div',
                    { className: 'mb-4' },
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-2' }, 'Typ udalosti:'),
                    React.createElement(
                        'div',
                        { className: 'grid grid-cols-2 gap-2' },
                        [
                            { type: 'goal', label: 'Gól', icon: 'fa-futbol', color: 'green' },
                            { type: 'penalty', label: '7m hod', icon: 'fa-circle-dot', color: 'blue' },
                            { type: 'yellow', label: 'Žltá', icon: 'fa-square', color: 'yellow' },
                            { type: 'red', label: 'Červená', icon: 'fa-square', color: 'red' },
                            { type: 'blue', label: 'Modrá', icon: 'fa-square', color: 'blue' },
                            { type: 'exclusion', label: 'Vylúčenie', icon: 'fa-user-slash', color: 'orange' }
                        ].map(btn => React.createElement(
                            'button',
                            {
                                key: btn.type,
                                className: `p-2 rounded-lg border transition-colors flex items-center justify-center gap-1 ${
                                    localEventType === btn.type 
                                        ? `bg-${btn.color}-100 border-${btn.color}-500 text-${btn.color}-700` 
                                        : 'bg-white border-gray-300 hover:bg-gray-50'
                                }`,
                                onClick: () => setLocalEventType(btn.type)
                            },
                            React.createElement('i', { className: `fa-solid ${btn.icon}` }),
                            btn.label
                        ))
                    )
                ),

                // Výber tímu
                localEventType && React.createElement(
                    'div',
                    { className: 'mb-4' },
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-2' }, 'Tím:'),
                    React.createElement(
                        'div',
                        { className: 'grid grid-cols-2 gap-2' },
                        React.createElement(
                            'button',
                            {
                                className: `p-2 rounded-lg border transition-colors ${
                                    localEventTeam === 'home' ? 'bg-blue-100 border-blue-500' : 'bg-white border-gray-300 hover:bg-gray-50'
                                }`,
                                onClick: () => setLocalEventTeam('home')
                            },
                            'Domáci'
                        ),
                        React.createElement(
                            'button',
                            {
                                className: `p-2 rounded-lg border transition-colors ${
                                    localEventTeam === 'away' ? 'bg-purple-100 border-purple-500' : 'bg-white border-gray-300 hover:bg-gray-50'
                                }`,
                                onClick: () => setLocalEventTeam('away')
                            },
                            'Hostia'
                        )
                    )
                ),

                // Pre penalty - výber premenená/nepremenená
                localEventType === 'penalty' && localEventTeam && React.createElement(
                    'div',
                    { className: 'mb-4' },
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-2' }, 'Typ 7m hodu:'),
                    React.createElement(
                        'div',
                        { className: 'grid grid-cols-2 gap-2' },
                        React.createElement(
                            'button',
                            {
                                className: `p-2 rounded-lg border transition-colors ${
                                    localEventSubType === 'scored' ? 'bg-green-100 border-green-500' : 'bg-white border-gray-300 hover:bg-gray-50'
                                }`,
                                onClick: () => setLocalEventSubType('scored')
                            },
                            'Premenený'
                        ),
                        React.createElement(
                            'button',
                            {
                                className: `p-2 rounded-lg border transition-colors ${
                                    localEventSubType === 'missed' ? 'bg-red-100 border-red-500' : 'bg-white border-gray-300 hover:bg-gray-50'
                                }`,
                                onClick: () => setLocalEventSubType('missed')
                            },
                            'Nepremenený'
                        )
                    )
                ),

                // Výber hráča
                (localEventType === 'goal' || localEventType === 'exclusion' || 
                 localEventType === 'yellow' || localEventType === 'red' || localEventType === 'blue') && 
                 localEventTeam && React.createElement(
                    'div',
                    { className: 'mb-4' },
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-2' }, 
                        localEventType === 'goal' ? 'Strelec:' :
                        localEventType === 'exclusion' ? 'Vylúčený hráč:' :
                        'Kartovaný hráč/tréner:'
                    ),
                    React.createElement(
                        'button',
                        {
                            className: `w-full p-2 text-left rounded-lg border transition-colors ${
                                localSelectedPlayer ? 'bg-green-100 border-green-500' : 'bg-white border-gray-300 hover:bg-gray-50'
                            }`,
                            onClick: () => handleSelectPlayer(localEventTeam)
                        },
                        localSelectedPlayer 
                            ? localSelectedPlayer.displayName
                            : `Vybrať ${localEventType === 'goal' ? 'strelea' : 'osobu'}`
                    )
                ),

                // Minúta
                localEventType && localEventTeam && React.createElement(
                    'div',
                    { className: 'mb-4' },
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Minúta:'),
                    React.createElement('input', {
                        type: 'number',
                        min: '1',
                        max: '60',
                        value: localEventMinute,
                        onChange: (e) => setLocalEventMinute(e.target.value),
                        className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                    })
                ),

                // Tlačidlá
                React.createElement(
                    'div',
                    { className: 'flex justify-end gap-3 mt-4' },
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
                            onClick: handleConfirm,
                            disabled: !localEventType || !localEventTeam || !localEventMinute || 
                                     (localEventType === 'penalty' && !localEventSubType) ||
                                     ((localEventType === 'goal' || localEventType === 'exclusion' || 
                                       localEventType === 'yellow' || localEventType === 'red' || localEventType === 'blue') && !localSelectedPlayer),
                            className: `px-4 py-2 text-white rounded-lg transition-colors ${
                                localEventType && localEventTeam && localEventMinute && 
                                (!(localEventType === 'penalty') || localEventSubType) &&
                                (!(localEventType === 'goal' || localEventType === 'exclusion' || 
                                   localEventType === 'yellow' || localEventType === 'red' || localEventType === 'blue') || localSelectedPlayer)
                                    ? 'bg-green-600 hover:bg-green-700'
                                    : 'bg-gray-400 cursor-not-allowed'
                            }`
                        },
                        'Pridať'
                    )
                )
            )
        ),
        React.createElement(PlayerSelectModal, {
            isOpen: playerModalOpen,
            onClose: () => setPlayerModalOpen(false),
            onSelect: handlePlayerSelected,
            players: selectingForTeam === 'home' ? getPlayersForTeam(homeTeamDetails) : getPlayersForTeam(awayTeamDetails),
            staff: selectingForTeam === 'home' ? getStaffForTeam(homeTeamDetails) : getStaffForTeam(awayTeamDetails),
            teamName: getTeamName(selectingForTeam)
        })
    );
};

// Premenná na sledovanie, či bol poslúcháč už nastavený
let isEmailSyncListenerSetup = false;

/**
 * Táto funkcia je poslúcháčom udalosti 'globalDataUpdated'.
 * Akonáhle sa dáta používateľa načítajú, vykreslí aplikáciu.
 */
const handleDataUpdateAndRender = (event) => {
    const userProfileData = event.detail;
    const rootElement = document.getElementById('root');

    if (userProfileData) {
        // Synchronizácia e-mailu
        if (window.auth && window.db && !isEmailSyncListenerSetup) {
            
            onAuthStateChanged(window.auth, async (user) => {
                if (user) {
                    try {
                        const userProfileRef = doc(window.db, 'users', user.uid);
                        const docSnap = await getDoc(userProfileRef);
            
                        if (docSnap.exists()) {
                            const firestoreEmail = docSnap.data().email;
                            if (user.email !== firestoreEmail) {
                                await updateDoc(userProfileRef, { email: user.email });
                                
                                const notificationsCollectionRef = collection(window.db, 'notifications');
                                await addDoc(notificationsCollectionRef, {
                                    userEmail: user.email,
                                    changes: `Zmena e-mailovej adresy z '${firestoreEmail}' na '${user.email}'.`,
                                    timestamp: new Date(),
                                });
                                
                                window.showGlobalNotification('E-mailová adresa bola automaticky aktualizovaná.', 'success');
                            }
                        }
                    } catch (error) {
                        console.error("Chyba pri synchronizácii e-mailu:", error);
                        window.showGlobalNotification('Nastala chyba pri synchronizácii e-mailovej adresy.', 'error');
                    }
                }
            });
            isEmailSyncListenerSetup = true;
        }

        if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
            const root = ReactDOM.createRoot(rootElement);
            root.render(React.createElement(matchesHallApp, { userProfileData }));
        }
    } else {
        if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
            const root = ReactDOM.createRoot(rootElement);
            root.render(
                React.createElement(
                    'div',
                    { className: 'flex justify-center items-center h-full pt-16' },
                    React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
                )
            );
        }
    }
};

// Registrácia poslúcháča
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
                { className: 'flex justify-center items-center h-full pt-16' },
                React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
            )
        );
    }
}
