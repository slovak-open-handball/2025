// Importy pre Firebase funkcie (Tieto sa nebudú používať na inicializáciu, ale na typy a funkcie)
import { doc, getDoc, onSnapshot, updateDoc, addDoc, deleteDoc, collection, Timestamp, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// Pridanie štýlov pre zvýraznenie riadkov
const style = document.createElement('style');
style.textContent = `
    /* Zrušíme pôvodné štýly */
    .row-highlighted > div {
        position: static;
    }
    
    .row-highlighted > div::before {
        display: none;
    }
    
    /* Nové orámovanie pre celý riadok */
    .row-highlighted {
        position: relative;
        outline: none !important;
    }
    
    .row-highlighted::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        border: 2px solid #3B82F6;
        border-radius: 8px;
        pointer-events: none;
        z-index: 10;
        margin: -2px;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
    }
    
    /* Zabezpečíme, že riadok má relatívnu pozíciu pre orámovanie */
    .grid {
        position: relative;
    }
    
    /* Upravíme pozíciu pre kontajner riadkov */
    .grid > .contents {
        display: contents;
        position: relative;
    }
`;
document.head.appendChild(style);

// Nahraďte existujúci floatingBoxStyle týmto:
const floatingBoxStyle = document.createElement('style');
floatingBoxStyle.textContent = `
    .floating-score-box {
        position: fixed;
        top: 55px;
        left: 50%;
        transform: translateX(-50%) translateY(-150px);
        background: white;
        border-radius: 50px;
        padding: 8px 24px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
        z-index: 9999;
        display: flex;
        align-items: center;
        gap: 20px;
        opacity: 0;
        transition: transform 0.3s ease, opacity 0.3s ease;
        border: 1px solid #e5e7eb;
        pointer-events: none;
        backdrop-filter: blur(4px);
        background-color: rgba(255, 255, 255, 0.95);
    }
    
    .floating-score-box.visible {
        transform: translateX(-50%) translateY(0);
        opacity: 1;
    }
    
    .floating-score-box .team-name {
        font-weight: 600;
        font-size: 14px;
        color: #374151;
        max-width: 180px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    
    .floating-score-box .score {
        font-weight: 700;
        font-size: 24px;
        color: #1f2937;
        min-width: 30px;
        text-align: center;
    }
    
    .floating-score-box .vs {
        font-weight: 600;
        font-size: 14px;
        color: #9ca3af;
    }
    
    .floating-score-box .match-time {
        font-family: monospace;
        font-weight: 700;
        font-size: 18px;
        color: #3b82f6;
        background: #eff6ff;
        padding: 4px 12px;
        border-radius: 30px;
        margin-left: 10px;
    }
    
    .floating-score-box .separator {
        width: 1px;
        height: 30px;
        background: #e5e7eb;
        margin: 0 10px;
    }
    
    @media (max-width: 768px) {
        .floating-score-box {
            padding: 6px 16px;
            gap: 10px;
        }
        .floating-score-box .team-name {
            max-width: 100px;
            font-size: 12px;
        }
        .floating-score-box .score {
            font-size: 18px;
            min-width: 45px;
        }
        .floating-score-box .match-time {
            font-size: 14px;
            padding: 2px 8px;
        }
        .floating-score-box .separator {
            height: 25px;
            margin: 0 5px;
        }
    }
`;
document.head.appendChild(floatingBoxStyle);

const { useState, useEffect } = React;

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
    if (!timestamp) return '-- : --';
    try {
        const date = timestamp.toDate();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    } catch (e) {
        return '-- : --';
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

// 🔴 NOVÁ FUNKCIA: createPlayerReference - vytvorenie referencie bez mien
const createPlayerReference = (teamDetails, teamIdentifier, player, isStaff = false, staffType = null, staffIndex = null) => {
    if (!teamDetails || !teamIdentifier || !player) return null;
    
    if (isStaff) {
        // Pre člena realizačného tímu ukladáme:
        // - userId: ID používateľa
        // - teamIdentifier: identifikátor tímu
        // - staffType: 'men' alebo 'women'
        // - staffIndex: index v poli
        return {
            userId: teamDetails.userId,
            teamIdentifier: teamIdentifier,
            staffType: staffType,
            staffIndex: staffIndex !== null ? staffIndex : player.staffIndex
        };
    } else {
        // Pre hráča ukladáme:
        // - userId: ID používateľa
        // - teamIdentifier: identifikátor tímu
        // - playerIndex: index v poli playerDetails
        return {
            userId: teamDetails.userId,
            teamIdentifier: teamIdentifier,
            playerIndex: player.index
        };
    }
};

const matchesHallApp = ({ userProfileData }) => {
    // Extrahujeme hallId z userProfileData
    const hallId = userProfileData?.hallId;
    const [hallName, setHallName] = useState(null);
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [groupedMatches, setGroupedMatches] = useState({});
    const [categories, setCategories] = useState([]);
    const [users, setUsers] = useState([]);
    // NOVÝ STAV PRE VYBRANÝ ZÁPAS
    const [selectedMatch, setSelectedMatch] = useState(null);    

    const [matchEvents, setMatchEvents] = useState([]);
    const [matchScore, setMatchScore] = useState({ home: 0, away: 0 });
    const [loadingEvents, setLoadingEvents] = useState(false);
    const [selectedPlayerForEvent, setSelectedPlayerForEvent] = useState(null);
    const [eventType, setEventType] = useState(null);
    const [eventTeam, setEventTeam] = useState(null); // 'home' alebo 'away'
    const [eventSubType, setEventSubType] = useState(null); // pre 7m hody: 'scored' alebo 'missed'
    const [matchPaused, setMatchPaused] = useState(false);
    const [matchTime, setMatchTime] = useState(0); // čas v sekundách
    const [timerInterval, setTimerInterval] = useState(null);
    const [manualTimeOffset, setManualTimeOffset] = useState(0); 
    const [cleanPlayingTime, setCleanPlayingTime] = useState(0);

    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [eventToDelete, setEventToDelete] = useState(null);
    
    const [resetModalOpen, setResetModalOpen] = useState(false);
    const [resetMatchId, setResetMatchId] = useState(null);    

    const [endMatchModalOpen, setEndMatchModalOpen] = useState(false);
    const [endMatchId, setEndMatchId] = useState(null);

    const [liveMatchData, setLiveMatchData] = useState({});
    const [completedMatchData, setCompletedMatchData] = useState({});
    const [highlightedEventId, setHighlightedEventId] = useState(null);
    const [showPlayerStats, setShowPlayerStats] = useState(false);
    const [playerStats, setPlayerStats] = useState({});

    const [editPlayerModalOpen, setEditPlayerModalOpen] = useState(false);
    const [playerToEdit, setPlayerToEdit] = useState(null);
    const [playerTeam, setPlayerTeam] = useState(null); // 'home' alebo 'away'
    const [playerTeamDetails, setPlayerTeamDetails] = useState(null);
    const [editPlayerFirstName, setEditPlayerFirstName] = useState('');
    const [editPlayerLastName, setEditPlayerLastName] = useState('');
    const [editPlayerJerseyNumber, setEditPlayerJerseyNumber] = useState('');
    const [playerTeamObject, setPlayerTeamObject] = useState(null);

    const [editStaffModalOpen, setEditStaffModalOpen] = useState(false);
    const [staffToEdit, setStaffToEdit] = useState(null);
    const [staffTeam, setStaffTeam] = useState(null); // 'home' alebo 'away'
    const [staffTeamDetails, setStaffTeamDetails] = useState(null);
    const [editStaffFirstName, setEditStaffFirstName] = useState('');
    const [editStaffLastName, setEditStaffLastName] = useState('');
    const [editStaffIsMen, setEditStaffIsMen] = useState(true); // true = men, false = women

    const [showFloatingScore, setShowFloatingScore] = useState(false);
    const [teamManagerReady, setTeamManagerReady] = useState(false);
    const [superstructureTeams, setSuperstructureTeams] = useState({});
    
    // Pridajte k ostatným useState deklaráciám
    const [isMappingReady, setIsMappingReady] = useState(false);
    const [teamMappings, setTeamMappings] = useState({});

    // Pridajte k ostatným useState deklaráciám
    const [homeTeamDetailsState, setHomeTeamDetailsState] = useState(null);
    const [awayTeamDetailsState, setAwayTeamDetailsState] = useState(null);

    // Funkcia na otvorenie modálneho okna pre úpravu člena realizačného tímu
    const openEditStaffModal = (member, team, teamDetails, staffType, staffIndex) => {
        if (selectedMatch?.status !== 'scheduled') {
            window.showGlobalNotification('Úprava členov RT je možná len pri naplánovaných zápasoch', 'error');
            return;
        }
        
        setStaffToEdit(member);
        setStaffTeam(team);
        setStaffTeamDetails(teamDetails);
        setEditStaffFirstName(member.firstName || '');
        setEditStaffLastName(member.lastName || '');
        setEditStaffIsMen(staffType === 'men');
        setEditStaffModalOpen(true);
    };

    // Funkcia na uloženie úprav člena realizačného tímu
    const saveStaffEdit = async () => {
        if (!staffToEdit || !staffTeamDetails || !staffTeam) return;
        
        try {
            const userRef = doc(window.db, 'users', staffTeamDetails.userId);
            const userSnap = await getDoc(userRef);
            
            if (!userSnap.exists()) {
                window.showGlobalNotification('Používateľ neexistuje', 'error');
                return;
            }
            
            const userData = userSnap.data();
            const teams = userData.teams || {};
            const category = selectedMatch.categoryName;
            
            // Nájdeme správny tím podľa identifikátora
            const teamIdentifier = staffTeam === 'home' ? selectedMatch.homeTeamIdentifier : selectedMatch.awayTeamIdentifier;
            const parts = teamIdentifier.split(' ');
            const groupAndOrder = parts.pop();
            const categoryName = parts.join(' ');
            
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
            
            const userTeams = teams[categoryName] || [];
            const teamIndex = userTeams.findIndex(t => t.groupName === fullGroupName && t.order === orderNum);
            
            if (teamIndex === -1) {
                window.showGlobalNotification('Tím nebol nájdený', 'error');
                return;
            }
            
            const updatedTeams = [...userTeams];
            const team = updatedTeams[teamIndex];
            
            // Nájdeme index člena v príslušnom poli podľa vlastností (nie podľa referencie)
            let staffArray = editStaffIsMen ? team.menTeamMemberDetails : team.womenTeamMemberDetails;
            const staffIndex = staffArray.findIndex(m => 
                m.firstName === staffToEdit.firstName && 
                m.lastName === staffToEdit.lastName
            );
            
            if (staffIndex === -1) {
                window.showGlobalNotification('Člen RT nebol nájdený v súpiske', 'error');
                return;
            }
            
            // Aktualizujeme údaje člena
            const updatedStaff = {
                ...staffArray[staffIndex],
                firstName: editStaffFirstName,
                lastName: editStaffLastName
            };
            
            if (editStaffIsMen) {
                team.menTeamMemberDetails[staffIndex] = updatedStaff;
            } else {
                team.womenTeamMemberDetails[staffIndex] = updatedStaff;
            }
            
            updatedTeams[teamIndex] = team;
            teams[categoryName] = updatedTeams;
            
            await updateDoc(userRef, { teams });
            
            // AKTUALIZUJEME LOKÁLNY STAV users
            setUsers(prevUsers => {
                return prevUsers.map(user => {
                    if (user.id === staffTeamDetails.userId) {
                        return {
                            ...user,
                            teams: teams
                        };
                    }
                    return user;
                });
            });
            
            window.showGlobalNotification('Údaje člena RT boli uložené', 'success');
            
            setEditStaffModalOpen(false);
            setStaffToEdit(null);
            
        } catch (error) {
            console.error('Chyba pri ukladaní údajov člena RT:', error);
            window.showGlobalNotification('Chyba pri ukladaní údajov člena RT', 'error');
        }
    };

    // Pri otváraní modálneho okna si uložte aj referenciu na tím
    const openEditPlayerModal = (player, team, teamDetails, isStaff = false) => {
        if (selectedMatch?.status !== 'scheduled') {
            window.showGlobalNotification('Úprava hráčov je možná len pri naplánovaných zápasoch', 'error');
            return;
        }
        
        setPlayerToEdit(player);
        setPlayerTeam(team);
        setPlayerTeamDetails(teamDetails);
        // Uložíme si aj priamo tím pre jednoduchší prístup
        setPlayerTeamObject(teamDetails.team);  // <-- toto je správne
        setEditPlayerFirstName(player.firstName || '');
        setEditPlayerLastName(player.lastName || '');
        setEditPlayerJerseyNumber(player.jerseyNumber || '');
        setEditPlayerModalOpen(true);
    };
    
    // Funkcia na uloženie úprav hráča
    const savePlayerEdit = async () => {
        if (!playerToEdit || !playerTeamDetails || !playerTeam) return;
        
        try {
            const userRef = doc(window.db, 'users', playerTeamDetails.userId);
            const userSnap = await getDoc(userRef);
            
            if (!userSnap.exists()) {
                window.showGlobalNotification('Používateľ neexistuje', 'error');
                return;
            }
            
            const userData = userSnap.data();
            const teams = userData.teams || {};
            const category = selectedMatch.categoryName;
            
            // Nájdeme správny tím podľa identifikátora
            const teamIdentifier = playerTeam === 'home' ? selectedMatch.homeTeamIdentifier : selectedMatch.awayTeamIdentifier;
            const parts = teamIdentifier.split(' ');
            const groupAndOrder = parts.pop();
            const categoryName = parts.join(' ');
            
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
            
            const userTeams = teams[categoryName] || [];
            const teamIndex = userTeams.findIndex(t => t.groupName === fullGroupName && t.order === orderNum);
            
            if (teamIndex === -1) {
                window.showGlobalNotification('Tím nebol nájdený', 'error');
                return;
            }
            
            const updatedTeams = [...userTeams];
            const team = updatedTeams[teamIndex];
            
            // Nájdeme index hráča v poli playerDetails podľa jeho vlastností (nie podľa referencie)
            const playerIndex = team.playerDetails.findIndex(p => 
                p.firstName === playerToEdit.firstName && 
                p.lastName === playerToEdit.lastName && 
                p.jerseyNumber === playerToEdit.jerseyNumber
            );
            
            if (playerIndex === -1) {
                window.showGlobalNotification('Hráč nebol nájdený v súpiske', 'error');
                return;
            }
            
            // Aktualizujeme údaje hráča
            team.playerDetails[playerIndex] = {
                ...team.playerDetails[playerIndex],
                firstName: editPlayerFirstName,
                lastName: editPlayerLastName,
                jerseyNumber: editPlayerJerseyNumber
            };
            
            updatedTeams[teamIndex] = team;
            teams[categoryName] = updatedTeams;
            
            await updateDoc(userRef, { teams });
            
            // AKTUALIZUJEME LOKÁLNY STAV users
            setUsers(prevUsers => {
                return prevUsers.map(user => {
                    if (user.id === playerTeamDetails.userId) {
                        return {
                            ...user,
                            teams: teams
                        };
                    }
                    return user;
                });
            });
            
            window.showGlobalNotification('Údaje hráča boli uložené', 'success');
            
            setEditPlayerModalOpen(false);
            setPlayerToEdit(null);
            
        } catch (error) {
            console.error('Chyba pri ukladaní údajov hráča:', error);
            window.showGlobalNotification('Chyba pri ukladaní údajov hráča: ' + error.message, 'error');
        }
    };
    
    // Funkcia na odstránenie hráča zo súpisky (UPRAVENÁ)
    const removePlayerFromRoster = async () => {
        if (!playerToEdit || !playerTeamDetails || !playerTeam) {
            return;
        }
                
        try {
            const userRef = doc(window.db, 'users', playerTeamDetails.userId);
            const userSnap = await getDoc(userRef);
            
            if (!userSnap.exists()) {
                window.showGlobalNotification('Používateľ neexistuje', 'error');
                return;
            }
            
            const userData = userSnap.data();
            const teams = userData.teams || {};
            const category = selectedMatch.categoryName;
            
            const teamIdentifier = playerTeam === 'home' ? selectedMatch.homeTeamIdentifier : selectedMatch.awayTeamIdentifier;
            const parts = teamIdentifier.split(' ');
            const groupAndOrder = parts.pop();
            const categoryName = parts.join(' ');
            
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
            
            const userTeams = teams[categoryName] || [];
            const teamIndex = userTeams.findIndex(t => t.groupName === fullGroupName && t.order === orderNum);
            
            if (teamIndex === -1) {
                window.showGlobalNotification('Tím nebol nájdený', 'error');
                return;
            }
            
            const updatedTeams = [...userTeams];
            const team = updatedTeams[teamIndex];
            
            // Nájdeme index hráča v poli playerDetails podľa jeho vlastností (nie podľa referencie)
            const playerIndex = team.playerDetails.findIndex(p => 
                p.firstName === playerToEdit.firstName && 
                p.lastName === playerToEdit.lastName && 
                p.jerseyNumber === playerToEdit.jerseyNumber
            );
            
            if (playerIndex === -1) {
                window.showGlobalNotification('Hráč nebol nájdený v súpiske', 'error');
                return;
            }
            
            const removedPlayer = { ...team.playerDetails[playerIndex] };
            
            // PRIDANÉ: Uložíme informáciu o odstránení pre konkrétny zápas
            if (!team.matchSpecificRemovals) {
                team.matchSpecificRemovals = {};
            }
            
            if (!team.matchSpecificRemovals[selectedMatch.id]) {
                team.matchSpecificRemovals[selectedMatch.id] = {
                    removedPlayersForMatch: [],
                    removedStaff: []
                };
            }
            
            // Uložíme hráča s informáciou o zápase
            team.matchSpecificRemovals[selectedMatch.id].removedPlayersForMatch.push({
                ...removedPlayer,
                removedAt: Timestamp.now(),
                matchId: selectedMatch.id,
                team: playerTeam
            });
        
            // Odstránime hráča z aktívneho zoznamu pre tento zápas
            team.playerDetails[playerIndex].removedForMatch = selectedMatch.id;
            
            updatedTeams[teamIndex] = team;
            teams[categoryName] = updatedTeams;
            
            await updateDoc(userRef, { teams });
            
            // AKTUALIZUJEME LOKÁLNY STAV users
            setUsers(prevUsers => {
                return prevUsers.map(user => {
                    if (user.id === playerTeamDetails.userId) {
                        return {
                            ...user,
                            teams: teams
                        };
                    }
                    return user;
                });
            });
            
            window.showGlobalNotification('Hráč bol odstránený zo súpisky pre tento zápas', 'success');
            
            setEditPlayerModalOpen(false);
            setPlayerToEdit(null);
            
        } catch (error) {
            console.error('Chyba pri odstraňovaní hráča:', error);
            window.showGlobalNotification('Chyba pri odstraňovaní hráča: ' + error.message, 'error');
        }
    };

    // Funkcia na obnovenie člena RT do súpisky
    const restoreStaffToRoster = async (member, team, teamDetails, staffType) => {
        if (!member || !teamDetails || !team || selectedMatch?.status !== 'scheduled') return;
        
        try {
            const userRef = doc(window.db, 'users', teamDetails.userId);
            const userSnap = await getDoc(userRef);
            
            if (!userSnap.exists()) {
                window.showGlobalNotification('Používateľ neexistuje', 'error');
                return;
            }
            
            const userData = userSnap.data();
            const teams = userData.teams || {};
            const category = selectedMatch.categoryName;
            
            const teamIdentifier = team === 'home' ? selectedMatch.homeTeamIdentifier : selectedMatch.awayTeamIdentifier;
            const parts = teamIdentifier.split(' ');
            const groupAndOrder = parts.pop();
            const categoryName = parts.join(' ');
            
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
            
            const userTeams = teams[categoryName] || [];
            const teamIndex = userTeams.findIndex(t => t.groupName === fullGroupName && t.order === orderNum);
            
            if (teamIndex === -1) {
                window.showGlobalNotification('Tím nebol nájdený', 'error');
                return;
            }
            
            const updatedTeams = [...userTeams];
            const teamData = updatedTeams[teamIndex];
            
            // Nájdeme člena RT v príslušnom poli podľa údajov
            const staffArray = staffType === 'men' ? teamData.menTeamMemberDetails : teamData.womenTeamMemberDetails;
            const staffIndex = staffArray.findIndex(m => 
                m.firstName === member.firstName && 
                m.lastName === member.lastName
            );
            
            if (staffIndex !== -1) {
                // Odstránime označenie pre tento zápas
                delete staffArray[staffIndex].removedForMatch?.[selectedMatch.id];
                if (staffArray[staffIndex].removedForMatch && Object.keys(staffArray[staffIndex].removedForMatch).length === 0) {
                    delete staffArray[staffIndex].removedForMatch;
                }
                
                // Odstránime zo zoznamu odstránených pre tento zápas
                if (teamData.matchSpecificRemovals && teamData.matchSpecificRemovals[selectedMatch.id]) {
                    teamData.matchSpecificRemovals[selectedMatch.id].removedStaff = 
                        teamData.matchSpecificRemovals[selectedMatch.id].removedStaff.filter(
                            removed => !(removed.firstName === member.firstName && 
                                       removed.lastName === member.lastName)
                        );
                    
                    // Ak je pole prázdne, odstránime celý záznam pre tento zápas
                    if (teamData.matchSpecificRemovals[selectedMatch.id].removedPlayersForMatch.length === 0 &&
                        teamData.matchSpecificRemovals[selectedMatch.id].removedStaff.length === 0) {
                        delete teamData.matchSpecificRemovals[selectedMatch.id];
                    }
                    
                    // Ak je objekt matchSpecificRemovals prázdny, odstránime ho
                    if (Object.keys(teamData.matchSpecificRemovals).length === 0) {
                        delete teamData.matchSpecificRemovals;
                    }
                }
                
                updatedTeams[teamIndex] = teamData;
                teams[categoryName] = updatedTeams;
                
                await updateDoc(userRef, { teams });
                
                // AKTUALIZUJEME LOKÁLNY STAV users
                setUsers(prevUsers => {
                    return prevUsers.map(user => {
                        if (user.id === teamDetails.userId) {
                            return {
                                ...user,
                                teams: teams
                            };
                        }
                        return user;
                    });
                });
                
                window.showGlobalNotification('Člen RT bol obnovený do súpisky', 'success');
            }
            
        } catch (error) {
            console.error('Chyba pri obnovovaní člena RT:', error);
            window.showGlobalNotification('Chyba pri obnovovaní člena RT', 'error');
        }
    };
    
    // Funkcia na odstránenie člena RT zo súpisky (NOVÁ)
    const removeStaffFromRoster = async () => {
        if (!staffToEdit || !staffTeamDetails || !staffTeam) {
            return;
        }
                
        try {
            const userRef = doc(window.db, 'users', staffTeamDetails.userId);
            const userSnap = await getDoc(userRef);
            
            if (!userSnap.exists()) {
                window.showGlobalNotification('Používateľ neexistuje', 'error');
                return;
            }
            
            const userData = userSnap.data();
            const teams = userData.teams || {};
            const category = selectedMatch.categoryName;
            
            const teamIdentifier = staffTeam === 'home' ? selectedMatch.homeTeamIdentifier : selectedMatch.awayTeamIdentifier;
            const parts = teamIdentifier.split(' ');
            const groupAndOrder = parts.pop();
            const categoryName = parts.join(' ');
            
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
            
            const userTeams = teams[categoryName] || [];
            const teamIndex = userTeams.findIndex(t => t.groupName === fullGroupName && t.order === orderNum);
            
            if (teamIndex === -1) {
                window.showGlobalNotification('Tím nebol nájdený', 'error');
                return;
            }
            
            const updatedTeams = [...userTeams];
            const team = updatedTeams[teamIndex];
            
            // Nájdeme index člena RT v príslušnom poli podľa vlastností (nie podľa referencie)
            const staffArray = editStaffIsMen ? team.menTeamMemberDetails : team.womenTeamMemberDetails;
            const staffIndex = staffArray.findIndex(m => 
                m.firstName === staffToEdit.firstName && 
                m.lastName === staffToEdit.lastName
            );
            
            if (staffIndex === -1) {
                window.showGlobalNotification('Člen RT nebol nájdený v súpiske', 'error');
                return;
            }
            
            const removedStaff = { ...staffArray[staffIndex] };
            
            // PRIDANÉ: Uložíme informáciu o odstránení pre konkrétny zápas
            if (!team.matchSpecificRemovals) {
                team.matchSpecificRemovals = {};
            }
            
            if (!team.matchSpecificRemovals[selectedMatch.id]) {
                team.matchSpecificRemovals[selectedMatch.id] = {
                    removedPlayersForMatch: [],
                    removedStaff: []
                };
            }
            
            // Uložíme člena RT s informáciou o zápase
            team.matchSpecificRemovals[selectedMatch.id].removedStaff.push({
                ...removedStaff,
                removedAt: Timestamp.now(),
                matchId: selectedMatch.id,
                team: staffTeam,
                staffType: editStaffIsMen ? 'men' : 'women'
            });
            
            // Označíme člena RT ako odstráneného pre tento zápas
            if (editStaffIsMen) {
                if (!team.menTeamMemberDetails[staffIndex].removedForMatch) {
                    team.menTeamMemberDetails[staffIndex].removedForMatch = {};
                }
                team.menTeamMemberDetails[staffIndex].removedForMatch[selectedMatch.id] = true;
            } else {
                if (!team.womenTeamMemberDetails[staffIndex].removedForMatch) {
                    team.womenTeamMemberDetails[staffIndex].removedForMatch = {};
                }
                team.womenTeamMemberDetails[staffIndex].removedForMatch[selectedMatch.id] = true;
            }
            
            updatedTeams[teamIndex] = team;
            teams[categoryName] = updatedTeams;
            
            await updateDoc(userRef, { teams });
            
            // AKTUALIZUJEME LOKÁLNY STAV users
            setUsers(prevUsers => {
                return prevUsers.map(user => {
                    if (user.id === staffTeamDetails.userId) {
                        return {
                            ...user,
                            teams: teams
                        };
                    }
                    return user;
                });
            });
            
            window.showGlobalNotification('Člen RT bol odstránený zo súpisky pre tento zápas', 'success');
            
            setEditStaffModalOpen(false);
            setStaffToEdit(null);
            
        } catch (error) {
            console.error('Chyba pri odstraňovaní člena RT:', error);
            window.showGlobalNotification('Chyba pri odstraňovaní člena RT: ' + error.message, 'error');
        }
    };
    
    // Funkcia na obnovenie hráča do súpisky (NOVÁ)
    const restorePlayerToRoster = async (player, team, teamDetails) => {
        if (!player || !teamDetails || !team || selectedMatch?.status !== 'scheduled') return;
        
        try {
            const userRef = doc(window.db, 'users', teamDetails.userId);
            const userSnap = await getDoc(userRef);
            
            if (!userSnap.exists()) {
                window.showGlobalNotification('Používateľ neexistuje', 'error');
                return;
            }
            
            const userData = userSnap.data();
            const teams = userData.teams || {};
            const category = selectedMatch.categoryName;
            
            const teamIdentifier = team === 'home' ? selectedMatch.homeTeamIdentifier : selectedMatch.awayTeamIdentifier;
            const parts = teamIdentifier.split(' ');
            const groupAndOrder = parts.pop();
            const categoryName = parts.join(' ');
            
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
            
            const userTeams = teams[categoryName] || [];
            const teamIndex = userTeams.findIndex(t => t.groupName === fullGroupName && t.order === orderNum);
            
            if (teamIndex === -1) {
                window.showGlobalNotification('Tím nebol nájdený', 'error');
                return;
            }
            
            const updatedTeams = [...userTeams];
            const teamData = updatedTeams[teamIndex];
            
            // Nájdeme hráča v poli playerDetails podľa jeho ID
            const playerIndex = teamData.playerDetails.findIndex(p => 
                p.firstName === player.firstName && 
                p.lastName === player.lastName && 
                p.jerseyNumber === player.jerseyNumber
            );
            
            if (playerIndex !== -1) {
                // Odstránime označenie pre tento zápas
                delete teamData.playerDetails[playerIndex].removedForMatch;
                
                // Odstránime zo zoznamu odstránených pre tento zápas
                if (teamData.matchSpecificRemovals && teamData.matchSpecificRemovals[selectedMatch.id]) {
                    teamData.matchSpecificRemovals[selectedMatch.id].removedPlayersForMatch = 
                        teamData.matchSpecificRemovals[selectedMatch.id].removedPlayersForMatch.filter(
                            removed => !(removed.firstName === player.firstName && 
                                       removed.lastName === player.lastName && 
                                       removed.jerseyNumber === player.jerseyNumber)
                        );
                    
                    // Ak je pole prázdne, odstránime celý záznam pre tento zápas
                    if (teamData.matchSpecificRemovals[selectedMatch.id].removedPlayersForMatch.length === 0 &&
                        teamData.matchSpecificRemovals[selectedMatch.id].removedStaff.length === 0) {
                        delete teamData.matchSpecificRemovals[selectedMatch.id];
                    }
                    
                    // Ak je objekt matchSpecificRemovals prázdny, odstránime ho
                    if (Object.keys(teamData.matchSpecificRemovals).length === 0) {
                        delete teamData.matchSpecificRemovals;
                    }
                }
                
                updatedTeams[teamIndex] = teamData;
                teams[categoryName] = updatedTeams;
                
                await updateDoc(userRef, { teams });
                
                // AKTUALIZUJEME LOKÁLNY STAV users
                setUsers(prevUsers => {
                    return prevUsers.map(user => {
                        if (user.id === teamDetails.userId) {
                            return {
                                ...user,
                                teams: teams
                            };
                        }
                        return user;
                    });
                });
                
                window.showGlobalNotification('Hráč bol obnovený do súpisky', 'success');
            }
            
        } catch (error) {
            console.error('Chyba pri obnovovaní hráča:', error);
            window.showGlobalNotification('Chyba pri obnovovaní hráča', 'error');
        }
    };

    // Funkcia na prepínanie zobrazenia štatistík hráčov
    const togglePlayerStats = () => {
        setShowPlayerStats(!showPlayerStats);
    };

    // Funkcia na výpočet štatistík hráčov z udalostí zápasu
    const calculatePlayerStats = (events) => {
        const stats = {};
        
        events.forEach(event => {
            if (!event.playerRef) return;
            
            // Vytvoríme unikátny kľúč pre hráča (userId + teamIdentifier + playerIndex/staffIndex)
            let playerKey;
            if (event.playerRef.staffType) {
                playerKey = `${event.playerRef.userId}_${event.playerRef.teamIdentifier}_staff_${event.playerRef.staffType}_${event.playerRef.staffIndex}`;
            } else {
                playerKey = `${event.playerRef.userId}_${event.playerRef.teamIdentifier}_player_${event.playerRef.playerIndex}`;
            }
            
            if (!stats[playerKey]) {
                // Získame meno hráča
                const playerName = getPlayerNameFromRef(event.playerRef);
                
                // Získame číslo dresu
                let jerseyNumber = '';
                if (!event.playerRef.staffType) {
                    const user = users.find(u => u.id === event.playerRef.userId);
                    if (user) {
                        const parts = event.playerRef.teamIdentifier.split(' ');
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
                        if (userTeams && Array.isArray(userTeams)) {
                            const team = userTeams.find(t => t.groupName === fullGroupName && t.order === orderNum);
                            if (team && team.playerDetails && event.playerRef.playerIndex !== undefined) {
                                const player = team.playerDetails[event.playerRef.playerIndex];
                                if (player && player.jerseyNumber) {
                                    jerseyNumber = player.jerseyNumber;
                                }
                            }
                        }
                    }
                }
                
                stats[playerKey] = {
                    playerRef: event.playerRef,
                    playerName: playerName,
                    jerseyNumber: jerseyNumber,
                    team: event.team, // 'home' alebo 'away'
                    isStaff: !!event.playerRef.staffType,
                    goals: 0,
                    penaltiesScored: 0,
                    penaltiesMissed: 0,
                    yellowCards: 0,
                    redCards: 0,
                    blueCards: 0,
                    exclusions: 0
                };
            }
            
            // Počítame štatistiky podľa typu udalosti
            if (event.type === 'goal') {
                stats[playerKey].goals++;
            } else if (event.type === 'penalty') {
                if (event.subType === 'scored') {
                    stats[playerKey].penaltiesScored++;
                } else if (event.subType === 'missed') {
                    stats[playerKey].penaltiesMissed++;
                }
            } else if (event.type === 'yellow') {
                stats[playerKey].yellowCards++;
            } else if (event.type === 'red') {
                stats[playerKey].redCards++;
            } else if (event.type === 'blue') {
                stats[playerKey].blueCards++;
            } else if (event.type === 'exclusion') {
                stats[playerKey].exclusions++;
            }
        });
        
        return stats;
    };

    // Funkcia na získanie štatistík pre konkrétneho hráča
    const getPlayerStats = (playerIdentifier) => {
        if (!playerIdentifier || !playerStats) return null;
        
        // Vytvoríme kľúč pre hráča
        let playerKey;
        if (playerIdentifier.isStaff) {
            playerKey = `${playerIdentifier.userId}_${playerIdentifier.teamIdentifier}_staff_${playerIdentifier.staffType}_${playerIdentifier.staffIndex}`;
        } else {
            playerKey = `${playerIdentifier.userId}_${playerIdentifier.teamIdentifier}_player_${playerIdentifier.index}`;
        }
        
        return playerStats[playerKey] || null;
    };

    // Komponent pre hlavičku tabuľky štatistík
    const StatsTableHeader = ({ showForPlayers = true, showForStaff = false }) => {
        if (!showPlayerStats) return null;
    
        return React.createElement(
            'div',
            { className: 'grid grid-cols-12 gap-1 mb-2 px-2 text-xs font-semibold text-gray-600 bg-gray-100 py-2 rounded' },
            
            // Pre hráčov - 5 stĺpcov
            showForPlayers && React.createElement(
                React.Fragment,
                null,
                React.createElement('div', { className: 'col-span-5 text-left' }, 'Meno'),
                React.createElement('div', { className: 'col-span-1 text-center' }, 'G'),
                React.createElement('div', { className: 'col-span-2 text-center' }, '7m'),
                React.createElement('div', { className: 'col-span-1 text-center' }, 'ŽK'),
                React.createElement('div', { className: 'col-span-1 text-center' }, 'ČK'),
                React.createElement('div', { className: 'col-span-1 text-center' }, 'MK'),
                React.createElement('div', { className: 'col-span-1 text-center' }, '2\'')
            ),
            
            // Pre realizačný tím - 5 stĺpcov (vrátane MK)
            showForStaff && React.createElement(
                React.Fragment,
                null,
                React.createElement('div', { className: 'col-span-8 text-left' }, 'Meno'),
                React.createElement('div', { className: 'col-span-1 text-center' }, 'ŽK'),
                React.createElement('div', { className: 'col-span-1 text-center' }, 'ČK'),
                React.createElement('div', { className: 'col-span-1 text-center' }, 'MK'),
                React.createElement('div', { className: 'col-span-1 text-center' }, '2\'')
            )
        );
    };

    const highlightEventRow = (eventId) => {
        // Ak je už rovnaký riadok zvýraznený, zrušíme zvýraznenie
        if (highlightedEventId === eventId) {
            setHighlightedEventId(null);
        } else {
            // Inak nastavíme nový zvýraznený riadok
            setHighlightedEventId(eventId);
        }
    };

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
//            console.error('Chyba pri spúšťaní časovača:', error);
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
//            console.error('Chyba pri pozastavovaní časovača:', error);
            window.showGlobalNotification('Chyba pri pozastavovaní časovača', 'error');
        }
    };
    
    const resumeMatchTimer = async (matchId) => {
        if (!window.db || !matchId) return;
    
        try {
            const matchRef = doc(window.db, 'matches', matchId);
            
            if (selectedMatch && selectedMatch.pausedAt && selectedMatch.startedAt) {
                const now = Timestamp.now();
                const pausedAt = selectedMatch.pausedAt;
                const startedAt = selectedMatch.startedAt;
                
                // Čas, ktorý uplynul do pozastavenia
                const elapsedBeforePause = pausedAt.seconds - startedAt.seconds;
                
                // Nový startedAt nastavíme tak, aby elapsedSeconds od nového startedAt do now
                // bol rovný elapsedBeforePause
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
//            console.error('Chyba pri obnovovaní časovača:', error);
            window.showGlobalNotification('Chyba pri obnovovaní časovača', 'error');
        }
    };

    const endMatch = async (matchId) => {
        setEndMatchId(matchId);
        setEndMatchModalOpen(true);
    };

    const confirmEndMatch = async () => {
        if (!window.db || !endMatchId) return;
        
        try {
            const matchRef = doc(window.db, 'matches', endMatchId);
            await updateDoc(matchRef, {
                status: 'completed',
                endedAt: Timestamp.now()
            });
            window.showGlobalNotification('Zápas bol ukončený', 'success');
        } catch (error) {
//            console.error('Chyba pri ukončovaní zápasu:', error);
            window.showGlobalNotification('Chyba pri ukončovaní zápasu', 'error');
        }
    };
    
    const resetMatchTimer = async (matchId, deleteEvents = false) => {
        if (!window.db || !matchId) return;
        
        try {
            const matchRef = doc(window.db, 'matches', matchId);
            await updateDoc(matchRef, {
                status: 'scheduled',
                startedAt: null,
                endedAt: null,
                pausedAt: null,
                currentPeriod: 1,
                manualTimeOffset: 0
            });
            
            // Vynulujeme čas
            setMatchTime(0);
            setManualTimeOffset(0); // PRIDAŤ TENTO RIADOK
            
            // Zastavíme interval
            if (timerInterval) {
                clearInterval(timerInterval);
                setTimerInterval(null);
            }
            
            // Vymažeme aj všetky udalosti zápasu (voliteľné)
            if (deleteEvents) {
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
//            console.error('Chyba pri resetovaní časovača:', error);
            window.showGlobalNotification('Chyba pri resetovaní časovača', 'error');
        }
    };
    
    // Pridajte funkciu pre otvorenie reset modálneho okna
    const openResetModal = (matchId) => {
        setResetMatchId(matchId);
        setResetModalOpen(true);
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
//            console.error('Chyba pri zvyšovaní periódy:', error);
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
//            console.error('Chyba pri znižovaní periódy:', error);
            window.showGlobalNotification('Chyba pri zmene periódy', 'error');
        }
    };
    
    // ZJEDNODUŠENÁ FUNKCIA: Konverzia (už nie je potrebná, ale ponecháme pre kompatibilitu)
    const convertTotalToCleanTime = (totalSeconds, category) => {
        return totalSeconds; // Čistý čas = celkový čas
    };

    // ZJEDNODUŠENÁ FUNKCIA: addMinute
    const addMinute = () => {
        // Získame kategóriu pre aktuálny zápas
        const currentCategory = selectedMatch ? categories.find(c => c.name === selectedMatch.categoryName) : null;
        
        if (!currentCategory) {
            window.showGlobalNotification('Nie je možné určiť kategóriu zápasu', 'error');
            return;
        }
        
        const periodDuration = (currentCategory.periodDuration || 20) * 60;
        const currentPeriod = selectedMatch?.currentPeriod || 1;
        
        // Vypočítame, koľko sekúnd uplynulo od začiatku aktuálnej periódy
        const periodStartTime = (currentPeriod - 1) * periodDuration;
        const elapsedInPeriod = matchTime - periodStartTime;
        
        // Skontrolujeme, či po pridaní minúty nepresiahneme koniec periódy
        if (elapsedInPeriod + 60 > periodDuration) {
            const remainingSeconds = periodDuration - elapsedInPeriod;
            const remainingMinutes = Math.floor(remainingSeconds / 60);
            const remainingSecs = remainingSeconds % 60;
            
            let message = `Nie je možné pridať celú minútu - do konca ${currentPeriod}. periódy zostáva len ${remainingMinutes}:${remainingSecs.toString().padStart(2, '0')}`;
            window.showGlobalNotification(message, 'error');
            return;
        }
        
        // Vypočítame nový čas
        const newTotalTime = matchTime + 60;
        
        // Vypočítame nový offset
        let newOffset;
        if (selectedMatch) {
            if (selectedMatch.status === 'paused' && selectedMatch.pausedAt && selectedMatch.startedAt) {
                const pausedAt = selectedMatch.pausedAt;
                const startedAt = selectedMatch.startedAt;
                const baseSeconds = Math.floor((pausedAt.seconds - startedAt.seconds));
                newOffset = newTotalTime - baseSeconds;
            } else if (selectedMatch.startedAt) {
                const now = Timestamp.now();
                const startedAt = selectedMatch.startedAt;
                const baseSeconds = Math.floor((now.seconds - startedAt.seconds));
                newOffset = newTotalTime - baseSeconds;
            }
        }
        
        // Uložíme do databázy
        if (selectedMatch && window.db && newOffset !== undefined) {
            const matchRef = doc(window.db, 'matches', selectedMatch.id);
            updateDoc(matchRef, {
                manualTimeOffset: newOffset
            }).catch(error => {
//                console.error('Chyba pri ukladaní offsetu:', error)
            });
        }
        
        // Aktualizujeme stavy
        setMatchTime(newTotalTime);
        setCleanPlayingTime(newTotalTime);
        if (newOffset !== undefined) {
            setManualTimeOffset(newOffset);
        }
    };
    
    // UPRAVENÁ FUNKCIA: subtractMinute
    const subtractMinute = () => {
        // Získame kategóriu pre aktuálny zápas
        const currentCategory = selectedMatch ? categories.find(c => c.name === selectedMatch.categoryName) : null;
        
        if (!currentCategory) {
            window.showGlobalNotification('Nie je možné určiť kategóriu zápasu', 'error');
            return;
        }
        
        const periodDuration = (currentCategory.periodDuration || 20) * 60;
        const currentPeriod = selectedMatch?.currentPeriod || 1;
        
        // Vypočítame, koľko sekúnd uplynulo od začiatku aktuálnej periódy
        const periodStartTime = (currentPeriod - 1) * periodDuration;
        const elapsedInPeriod = matchTime - periodStartTime;
        
        // Skontrolujeme, či po odčítaní minúty neklesneme pod začiatok aktuálnej periódy
        if (elapsedInPeriod < 60) {
            if (elapsedInPeriod === 0) {
                window.showGlobalNotification(`Nie je možné odčítať minútu - sme na začiatku ${currentPeriod}. periódy`, 'error');
            } else {
                window.showGlobalNotification(`Nie je možné odčítať celú minútu - od začiatku ${currentPeriod}. periódy uplynulo len ${formatMatchTime(elapsedInPeriod)}`, 'error');
            }
            return;
        }
        
        // Vypočítame nový čas
        const newTotalTime = matchTime - 60;
        
        // Vypočítame nový offset
        let newOffset;
        if (selectedMatch) {
            if (selectedMatch.status === 'paused' && selectedMatch.pausedAt && selectedMatch.startedAt) {
                const pausedAt = selectedMatch.pausedAt;
                const startedAt = selectedMatch.startedAt;
                const baseSeconds = Math.floor((pausedAt.seconds - startedAt.seconds));
                newOffset = newTotalTime - baseSeconds;
            } else if (selectedMatch.startedAt) {
                const now = Timestamp.now();
                const startedAt = selectedMatch.startedAt;
                const baseSeconds = Math.floor((now.seconds - startedAt.seconds));
                newOffset = newTotalTime - baseSeconds;
            }
        }
        
        // Uložíme do databázy
        if (selectedMatch && window.db && newOffset !== undefined) {
            const matchRef = doc(window.db, 'matches', selectedMatch.id);
            updateDoc(matchRef, {
                manualTimeOffset: newOffset
            }).catch(error => {
//                 console.error('Chyba pri ukladaní offsetu:', error)
            });
        }
        
        // Aktualizujeme stavy
        setMatchTime(newTotalTime);
        setCleanPlayingTime(newTotalTime);
        if (newOffset !== undefined) {
            setManualTimeOffset(newOffset);
        }
    };
    
    // UPRAVENÁ FUNKCIA: addSecond
    const addSecond = () => {
        // Získame kategóriu pre aktuálny zápas
        const currentCategory = selectedMatch ? categories.find(c => c.name === selectedMatch.categoryName) : null;
        
        if (!currentCategory) {
            window.showGlobalNotification('Nie je možné určiť kategóriu zápasu', 'error');
            return;
        }
        
        const periodDuration = (currentCategory.periodDuration || 20) * 60;
        const currentPeriod = selectedMatch?.currentPeriod || 1;
        
        // Vypočítame, koľko sekúnd uplynulo od začiatku aktuálnej periódy
        const periodStartTime = (currentPeriod - 1) * periodDuration;
        const elapsedInPeriod = matchTime - periodStartTime;
        
        // Skontrolujeme, či po pridaní sekundy nepresiahneme koniec periódy
        if (elapsedInPeriod + 1 > periodDuration) {
            const remainingSeconds = periodDuration - elapsedInPeriod;
            window.showGlobalNotification(`Nie je možné pridať sekundu - do konca ${currentPeriod}. periódy zostáva už len ${remainingSeconds} sekúnd`, 'error');
            return;
        }
        
        // Vypočítame nový čas
        const newTotalTime = matchTime + 1;
        
        // Vypočítame nový offset
        let newOffset;
        if (selectedMatch) {
            if (selectedMatch.status === 'paused' && selectedMatch.pausedAt && selectedMatch.startedAt) {
                const pausedAt = selectedMatch.pausedAt;
                const startedAt = selectedMatch.startedAt;
                const baseSeconds = Math.floor((pausedAt.seconds - startedAt.seconds));
                newOffset = newTotalTime - baseSeconds;
            } else if (selectedMatch.startedAt) {
                const now = Timestamp.now();
                const startedAt = selectedMatch.startedAt;
                const baseSeconds = Math.floor((now.seconds - startedAt.seconds));
                newOffset = newTotalTime - baseSeconds;
            }
        }
        
        // Uložíme do databázy
        if (selectedMatch && window.db && newOffset !== undefined) {
            const matchRef = doc(window.db, 'matches', selectedMatch.id);
            updateDoc(matchRef, {
                manualTimeOffset: newOffset
            }).catch(error => {
//                console.error('Chyba pri ukladaní offsetu:', error)
            });
        }
        
        // Aktualizujeme stavy
        setMatchTime(newTotalTime);
        setCleanPlayingTime(newTotalTime);
        if (newOffset !== undefined) {
            setManualTimeOffset(newOffset);
        }
    };
    
    // UPRAVENÁ FUNKCIA: subtractSecond
    const subtractSecond = () => {
        // Získame kategóriu pre aktuálny zápas
        const currentCategory = selectedMatch ? categories.find(c => c.name === selectedMatch.categoryName) : null;
        
        if (!currentCategory) {
            window.showGlobalNotification('Nie je možné určiť kategóriu zápasu', 'error');
            return;
        }
        
        const periodDuration = (currentCategory.periodDuration || 20) * 60;
        const currentPeriod = selectedMatch?.currentPeriod || 1;
        
        // Vypočítame, koľko sekúnd uplynulo od začiatku aktuálnej periódy
        const periodStartTime = (currentPeriod - 1) * periodDuration;
        const elapsedInPeriod = matchTime - periodStartTime;
        
        // Skontrolujeme, či po odčítaní sekundy neklesneme pod začiatok aktuálnej periódy
        if (elapsedInPeriod < 1) {
            window.showGlobalNotification(`Nie je možné odčítať sekundu - sme na začiatku ${currentPeriod}. periódy`, 'error');
            return;
        }
        
        // Vypočítame nový čas
        const newTotalTime = matchTime - 1;
        
        // Vypočítame nový offset
        let newOffset;
        if (selectedMatch) {
            if (selectedMatch.status === 'paused' && selectedMatch.pausedAt && selectedMatch.startedAt) {
                const pausedAt = selectedMatch.pausedAt;
                const startedAt = selectedMatch.startedAt;
                const baseSeconds = Math.floor((pausedAt.seconds - startedAt.seconds));
                newOffset = newTotalTime - baseSeconds;
            } else if (selectedMatch.startedAt) {
                const now = Timestamp.now();
                const startedAt = selectedMatch.startedAt;
                const baseSeconds = Math.floor((now.seconds - startedAt.seconds));
                newOffset = newTotalTime - baseSeconds;
            }
        }
        
        // Uložíme do databázy
        if (selectedMatch && window.db && newOffset !== undefined) {
            const matchRef = doc(window.db, 'matches', selectedMatch.id);
            updateDoc(matchRef, {
                manualTimeOffset: newOffset
            }).catch(error => {
//                console.error('Chyba pri ukladaní offsetu:', error)
            });
        }
        
        // Aktualizujeme stavy
        setMatchTime(newTotalTime);
        setCleanPlayingTime(newTotalTime);
        if (newOffset !== undefined) {
            setManualTimeOffset(newOffset);
        }
    };

    // NOVÁ FUNKCIA PRE KONTROLU, ČI JE ZÁPAS V STAVE POVOĽUJÚCOM AKCIE
    const isMatchActionAllowed = () => {
        if (!selectedMatch) return false;
        // Akcie sú povolené len keď je zápas v priebehu (in-progress) alebo pozastavený (paused)
        return selectedMatch.status === 'in-progress' || selectedMatch.status === 'paused';
    };

    // UPRAVENÁ FUNKCIA PRE KONTROLU POVOLENIA TLAČIDLA POKRAČOVAŤ
    const isResumeAllowed = () => {
        if (!selectedMatch) return false;
    
        // Ak je zápas ukončený, tlačidlo nie je povolené
        if (selectedMatch.status === 'completed') return false;
    
        // Kontrola, či je zápas v stave 'paused'
        if (selectedMatch.status !== 'paused') return false;
    
        const currentCategory = categories.find(c => c.name === selectedMatch.categoryName);
        if (!currentCategory) return false;
    
        const periodDuration = (currentCategory.periodDuration || 20) * 60;
        const currentPeriod = selectedMatch?.currentPeriod || 1;
    
        const periodStartTime = (currentPeriod - 1) * periodDuration;
        const elapsedInPeriod = matchTime - periodStartTime;
    
        // Povolené, ak nie sme na konci periódy (ak by po pridaní 1 sekundy nepresiahli koniec)
        return elapsedInPeriod < periodDuration;
    };

    // UPRAVENÉ FUNKCIE PRE KONTROLU POVOLENIA TLAČIDIEL PRE PERIÓDU
    const isDecreasePeriodAllowed = () => {
        if (!selectedMatch) return false;
        
        const currentPeriod = selectedMatch.currentPeriod || 1;
        if (currentPeriod <= 1) return false; // Už sme v prvej perióde
        
        const currentCategory = categories.find(c => c.name === selectedMatch.categoryName);
        if (!currentCategory) return false;
        
        const periodDuration = (currentCategory.periodDuration || 20) * 60;
        const periodStartTime = (currentPeriod - 1) * periodDuration;
        const elapsedInPeriod = matchTime - periodStartTime;
        
        // Povolené len ak sme na začiatku aktuálnej periódy (elapsedInPeriod === 0)
        // ALEBO na konci predchádzajúcej periódy (čo je vlastne začiatok aktuálnej)
        return elapsedInPeriod === 0;
    };
    
    const isIncreasePeriodAllowed = () => {
        if (!selectedMatch) return false;
        
        const currentCategory = categories.find(c => c.name === selectedMatch.categoryName);
        if (!currentCategory) return false;
        
        const currentPeriod = selectedMatch.currentPeriod || 1;
        const maxPeriods = currentCategory.periods || 2;
        
        if (currentPeriod >= maxPeriods) return false; // Už sme v poslednej perióde
        
        const periodDuration = (currentCategory.periodDuration || 20) * 60;
        const periodStartTime = (currentPeriod - 1) * periodDuration;
        const elapsedInPeriod = matchTime - periodStartTime;
        
        // Povolené len ak sme na konci aktuálnej periódy (elapsedInPeriod === periodDuration)
        return elapsedInPeriod === periodDuration;
    };

    const isAddMinuteAllowed = () => {
        if (!selectedMatch) return false;
        
        // Ak je zápas ukončený, tlačidlo nie je povolené
        if (selectedMatch.status === 'completed') return false;
        
        const currentCategory = categories.find(c => c.name === selectedMatch.categoryName);
        if (!currentCategory) return false;
        
        const periodDuration = (currentCategory.periodDuration || 20) * 60;
        const currentPeriod = selectedMatch?.currentPeriod || 1;
    
        const periodStartTime = (currentPeriod - 1) * periodDuration;
        const elapsedInPeriod = matchTime - periodStartTime;
        
        // Povolené, ak po pridaní minúty nepresiahneme koniec periódy
        return elapsedInPeriod + 60 <= periodDuration;
    };
    
    const isSubtractMinuteAllowed = () => {
        if (!selectedMatch) return false;
    
        // Ak je zápas ukončený, tlačidlo nie je povolené
        if (selectedMatch.status === 'completed') return false;
    
        const currentCategory = categories.find(c => c.name === selectedMatch.categoryName);
        if (!currentCategory) return false;
    
        const periodDuration = (currentCategory.periodDuration || 20) * 60;
        const currentPeriod = selectedMatch?.currentPeriod || 1;
        
        const periodStartTime = (currentPeriod - 1) * periodDuration;
        const elapsedInPeriod = matchTime - periodStartTime;
        
        // Povolené, ak po odčítaní minúty neklesneme pod začiatok periódy
        return elapsedInPeriod >= 60;
    };
    
    const isAddSecondAllowed = () => {
        if (!selectedMatch) return false;
    
        // Ak je zápas ukončený, tlačidlo nie je povolené
        if (selectedMatch.status === 'completed') return false;
        
        const currentCategory = categories.find(c => c.name === selectedMatch.categoryName);
        if (!currentCategory) return false;
        
        const periodDuration = (currentCategory.periodDuration || 20) * 60;
        const currentPeriod = selectedMatch?.currentPeriod || 1;
    
        const periodStartTime = (currentPeriod - 1) * periodDuration;
        const elapsedInPeriod = matchTime - periodStartTime;
        
        // Povolené, ak po pridaní sekundy nepresiahneme koniec periódy
        return elapsedInPeriod + 1 <= periodDuration;
    };
    
    const isSubtractSecondAllowed = () => {
        if (!selectedMatch) return false;
    
        // Ak je zápas ukončený, tlačidlo nie je povolené
        if (selectedMatch.status === 'completed') return false;
        
        const currentCategory = categories.find(c => c.name === selectedMatch.categoryName);
        if (!currentCategory) return false;
        
        const periodDuration = (currentCategory.periodDuration || 20) * 60;
        const currentPeriod = selectedMatch?.currentPeriod || 1;
        
        const periodStartTime = (currentPeriod - 1) * periodDuration;
        const elapsedInPeriod = matchTime - periodStartTime;
        
        // Povolené, ak po odčítaní sekundy neklesneme pod začiatok periódy
        return elapsedInPeriod >= 1;
    };

    const isStartTimerAllowed = () => {
        if (!selectedMatch) return false;
    
        // Povolené len pre zápasy v stave 'scheduled' (Naplánované)
        return selectedMatch.status === 'scheduled';
    };

    // ============================================================
    // ČAKANIE NA MAPOVANIE TÍMOV Z DRUHÉHO KÓDU
    // ============================================================
    useEffect(() => {
        // 1. Rýchla kontrola - už je pripravené?
        if (window.teamNameReplacer?.isMappingReady?.()) {
            setIsMappingReady(true);
            setTeamMappings(window.__teamNameMapping || {});
            return;
        }
        
        // 2. Už existujú mapovania?
        if (window.__teamNameMapping && Object.keys(window.__teamNameMapping).length > 0) {
            setIsMappingReady(true);
            setTeamMappings(window.__teamNameMapping);
            return;
        }
        
        // 3. Nastavenie poslúchača na udalosť
        const handleMappingReady = (event) => {
            setIsMappingReady(true);
            setTeamMappings(event.detail.mappings);
        };
        window.addEventListener('teamNameMappingReady', handleMappingReady);
        
        // 4. 🔴 ŽIADOSŤ O OHLÁSENIE (tu je váš kód)
        if (window.teamNameReplacer?.announceReady) {
            window.teamNameReplacer.announceReady();
        } else if (window.teamNameReplacer?.forceNotify) {
            window.teamNameReplacer.forceNotify();
        } else {
            setTimeout(() => {
                if (window.__teamNameMapping && Object.keys(window.__teamNameMapping).length > 0) {
                    setIsMappingReady(true);
                    setTeamMappings(window.__teamNameMapping);
                }
            }, 2000);
        }
        
        // 5. Timeout poistka
        const timeout = setTimeout(() => {
            if (!isMappingReady) {
                setIsMappingReady(true);
            }
        }, 10000);
        
        return () => {
            window.removeEventListener('teamNameMappingReady', handleMappingReady);
            clearTimeout(timeout);
        };
    }, [selectedMatch]);

    // ============================================================
    // AUTOMATICKÉ NASTAVENIE TÍMOV PRI VÝBERE ZÁPASU Z URL
    // ============================================================
    useEffect(() => {
        // 1. Musí byť vybraný zápas
        if (!selectedMatch) return;
        
        // 2. Musia byť načítaní používatelia
        if (users.length === 0) {
            console.log("⏳ Čakám na načítanie používateľov do React stavu...");
            return;
        }
        
        // 3. Musia byť načítané kategórie
        if (categories.length === 0) {
            console.log("⏳ Čakám na načítanie kategórií...");
            return;
        }
        
        // 4. 🔴 MUSÍ BYŤ PRIPRAVENÉ MAPOVANIE
        if (!isMappingReady) {
            console.log("⏳ Čakám na dokončenie mapovania tímov (teamNameReplacer)...");
            return;
        }
        
        // ✅ VŠETKY PODMIENKY SPLNENÉ – môžeme nastaviť tímy
        
        // Vymažeme staré súpisky
        console.log('🗑️ Vymazávam staré súpisky tímov...');
        window._homeTeamDetails = null;
        window._awayTeamDetails = null;
        window._teamsSetForMatch = null;
        setHomeTeamDetailsState(null);
        setAwayTeamDetailsState(null);
        renderFullTeamToUI(null, 'home');
        renderFullTeamToUI(null, 'away');
        
        // Synchronizujeme window.users
        if (!window.users || window.users.length === 0) {
            window.users = users;
            console.log(`✅ Synchronizovaných ${users.length} používateľov do window.users`);
        }
        
        console.log('🔄 Automatické nastavenie tímov pre zápas...');
        console.log(`🏠 Domáci identifikátor: ${selectedMatch.homeTeamIdentifier}`);
        console.log(`✈️ Hosťovský identifikátor: ${selectedMatch.awayTeamIdentifier}`);
        console.log(`📂 Kategória: ${selectedMatch.categoryName}`);
        
        // Získame názvy tímov (už z mapovania!)
        let homeTeamName = getTeamNameByIdentifier(selectedMatch.homeTeamIdentifier);
        let awayTeamName = getTeamNameByIdentifier(selectedMatch.awayTeamIdentifier);
        const categoryName = selectedMatch.categoryName;
        
        // Aplikujeme mapping na názvy z databázy
        if (window.teamNameReplacer && typeof window.teamNameReplacer.getTeamNameFromMapping === 'function') {
            if (homeTeamName && homeTeamName !== selectedMatch.homeTeamIdentifier) {
                const mappedHome = window.teamNameReplacer.getTeamNameFromMapping(homeTeamName);
                if (mappedHome) {
                    console.log(`🔄 Mapovanie domáceho tímu: "${homeTeamName}" → "${mappedHome}"`);
                    homeTeamName = mappedHome;
                }
            }
            if (awayTeamName && awayTeamName !== selectedMatch.awayTeamIdentifier) {
                const mappedAway = window.teamNameReplacer.getTeamNameFromMapping(awayTeamName);
                if (mappedAway) {
                    console.log(`🔄 Mapovanie hosťovského tímu: "${awayTeamName}" → "${mappedAway}"`);
                    awayTeamName = mappedAway;
                }
            }
        }
        
        // Nastavíme tímy
        const setupTeams = async () => {
            // Najprv skúsime nájsť domáci tím podľa názvu
            if (homeTeamName && homeTeamName !== selectedMatch.homeTeamIdentifier && categoryName) {
                console.log(`🏠 Nastavujem domáci tím: "${homeTeamName}"`);
                await window.setHomeTeamDetails(homeTeamName, categoryName);
            } 
            // Ak sa nepodarilo získať názov, skúsime priamo vyhľadať podľa identifikátora
            else {
                console.log(`⚠️ Nepodarilo sa získať názov domáceho tímu, skúšam priamo identifikátor...`);
                const homeResult = await findTeamByIdentifierFromDOM(selectedMatch.homeTeamIdentifier, false);
                if (homeResult && !Array.isArray(homeResult)) {
                    console.log(`✅ Nájdený domáci tím podľa identifikátora: ${homeResult.team.teamName}`);
                    await window.setHomeTeamDetails(homeResult.team.teamName, categoryName);
                } else {
                    console.log(`❌ Domáci tím "${selectedMatch.homeTeamIdentifier}" nebol nájdený`);
                    // Uistíme sa, že v UI je "Nedostupné"
                    renderFullTeamToUI(null, 'home');
                }
            }
            
            // Najprv skúsime nájsť hosťovský tím podľa názvu
            if (awayTeamName && awayTeamName !== selectedMatch.awayTeamIdentifier && categoryName) {
                console.log(`✈️ Nastavujem hosťovský tím: "${awayTeamName}"`);
                await window.setAwayTeamDetails(awayTeamName, categoryName);
            } 
            // Ak sa nepodarilo získať názov, skúsime priamo vyhľadať podľa identifikátora
            else {
                console.log(`⚠️ Nepodarilo sa získať názov hosťovského tímu, skúšam priamo identifikátor...`);
                const awayResult = await findTeamByIdentifierFromDOM(selectedMatch.awayTeamIdentifier, false);
                if (awayResult && !Array.isArray(awayResult)) {
                    console.log(`✅ Nájdený hosťovský tím podľa identifikátora: ${awayResult.team.teamName}`);
                    await window.setAwayTeamDetails(awayResult.team.teamName, categoryName);
                } else {
                    console.log(`❌ Hosťovský tím "${selectedMatch.awayTeamIdentifier}" nebol nájdený`);
                    // Uistíme sa, že v UI je "Nedostupné"
                    renderFullTeamToUI(null, 'away');
                }
            }
            
            // Označíme, že tímy boli nastavené pre tento zápas
            window._teamsSetForMatch = selectedMatch.id;
            
            // Po nastavení tímov vykreslíme UI
            console.log('🔄 Vykreslenie tímov do UI...');
            if (window._homeTeamDetails) {
                renderFullTeamToUI(window._homeTeamDetails, 'home');
            }
            if (window._awayTeamDetails) {
                renderFullTeamToUI(window._awayTeamDetails, 'away');
            }
        };
        
        setupTeams();
        
    }, [selectedMatch, users, categories, isMappingReady]);

    useEffect(() => {
        // Poslúchač pre nastavenie domáceho tímu
        const handleSetHomeTeam = (event) => {
            if (event.detail.matchId !== selectedMatch?.id) {
                console.log('⚠️ Zápas sa nezhoduje, preskakujem');
                return;
            }
            
            const teamDetails = event.detail.teamDetails;
            
            // Aktualizujeme stav homeTeamDetails
            setHomeTeamDetailsState({
                team: teamDetails.team,
                userEmail: teamDetails.user.email,
                userId: teamDetails.user.id,
                userDisplayName: teamDetails.user.displayName
            });
            
            console.log(`✅ Domáci tím aktualizovaný: ${teamDetails.team.teamName}`);
        };
        
        // Poslúchač pre nastavenie hosťovského tímu
        const handleSetAwayTeam = (event) => {
            if (event.detail.matchId !== selectedMatch?.id) {
                console.log('⚠️ Zápas sa nezhoduje, preskakujem');
                return;
            }
            
            const teamDetails = event.detail.teamDetails;
            
            // Aktualizujeme stav awayTeamDetails
            setAwayTeamDetailsState({
                team: teamDetails.team,
                userEmail: teamDetails.user.email,
                userId: teamDetails.user.id,
                userDisplayName: teamDetails.user.displayName
            });
            
            console.log(`✅ Hosťovský tím aktualizovaný: ${teamDetails.team.teamName}`);
        };
        
        window.addEventListener('setHomeTeamDetails', handleSetHomeTeam);
        window.addEventListener('setAwayTeamDetails', handleSetAwayTeam);
        
        return () => {
            window.removeEventListener('setHomeTeamDetails', handleSetHomeTeam);
            window.removeEventListener('setAwayTeamDetails', handleSetAwayTeam);
        };
    }, [selectedMatch?.id]);

    useEffect(() => {
        if (!window.db) return;
    
        const superstructureDocRef = doc(window.db, 'settings', 'superstructureGroups');
        const unsubscribe = onSnapshot(superstructureDocRef, (docSnap) => {
            if (docSnap.exists()) {
                setSuperstructureTeams(docSnap.data());
            }
        });
        
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        // Skontrolujeme, či už je teamManager dostupný
        if (window.teamManager && typeof window.teamManager.getTeamNameByDisplayIdSync === 'function') {
            setTeamManagerReady(true);
            return;
        }
        
        // Počkáme na udalosť teamManagerUpdate
        const handleTeamManagerUpdate = () => {
            if (window.teamManager && typeof window.teamManager.getTeamNameByDisplayIdSync === 'function') {
                setTeamManagerReady(true);
            }
        };
        
        window.addEventListener('teamManagerUpdate', handleTeamManagerUpdate);
        
        // Timeout pre prípad, že sa teamManager nenačíta
        const timeout = setTimeout(() => {
            setTeamManagerReady(true);
        }, 5000);
        
        return () => {
            window.removeEventListener('teamManagerUpdate', handleTeamManagerUpdate);
            clearTimeout(timeout);
        };
    }, []);

    useEffect(() => {
        // Skontrolujeme, či už je teamManager dostupný
        if (window.teamManager && typeof window.teamManager.getTeamNameByDisplayIdSync === 'function') {
            setTeamManagerReady(true);
            return;
        }
        
        // Počkáme na udalosť teamManagerUpdate
        const handleTeamManagerUpdate = () => {
            if (window.teamManager && typeof window.teamManager.getTeamNameByDisplayIdSync === 'function') {
                setTeamManagerReady(true);
            }
        };
        
        window.addEventListener('teamManagerUpdate', handleTeamManagerUpdate);
        
        // Timeout pre prípad, že sa teamManager nenačíta
        const timeout = setTimeout(() => {
            setTeamManagerReady(true); // aj tak pokračujeme
        }, 5000);
        
        return () => {
            window.removeEventListener('teamManagerUpdate', handleTeamManagerUpdate);
            clearTimeout(timeout);
        };
    }, []);

    useEffect(() => {
        const handleScroll = () => {
            // Sledujeme tlačidlo "Všetky zápasy" (je v hornej časti)
            const backButton = document.querySelector('.absolute.left-4.top-4');
            
            if (backButton) {
                const rect = backButton.getBoundingClientRect();
                // Keď je tlačidlo mimo viewport (hore), zobrazíme plávajúci box
                if (rect.bottom < 0) {
                    setShowFloatingScore(true);
                } else {
                    setShowFloatingScore(false);
                }
            } else {
                // Fallback - sledujeme box s priebehom zápasu
                const matchSection = document.querySelector('.match-progress-section');
                if (matchSection) {
                    const rect = matchSection.getBoundingClientRect();
                    if (rect.top < 100) {
                        setShowFloatingScore(true);
                    } else {
                        setShowFloatingScore(false);
                    }
                }
            }
        };
        
        setTimeout(handleScroll, 100);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [selectedMatch]);

    // Prepočítanie štatistík hráčov pri zmene udalostí
    useEffect(() => {
        if (matchEvents.length > 0) {
            const stats = calculatePlayerStats(matchEvents);
            setPlayerStats(stats);
        } else {
            setPlayerStats({});
        }
    }, [matchEvents]);

    // NOVÝ useEffect PRE SLEDOVANIE UKONČENÝCH ZÁPASOV
    useEffect(() => {
        if (!window.db || matches.length === 0) return;
    
        // Filtrujeme ukončené zápasy
        const completedMatches = matches.filter(m => m.status === 'completed');
        
        if (completedMatches.length === 0) {
            setCompletedMatchData({});
            return;
        }
    
        // Pre každý ukončený zápas načítame udalosti (stačí raz, nie onSnapshot)
        const fetchCompletedMatches = async () => {
            const newData = {};
            
            for (const match of completedMatches) {
                try {
                    const eventsRef = collection(window.db, 'matchEvents');
                    const q = query(eventsRef, where("matchId", "==", match.id));
                    const querySnapshot = await getDocs(q);
                    
                    let homeScore = 0;
                    let awayScore = 0;
                    let matchTime = 0;
                    
                    querySnapshot.forEach((doc) => {
                        const event = doc.data();
                        
                        // Výpočet skóre
                        if (event.type === 'goal' || (event.type === 'penalty' && event.subType === 'scored')) {
                            if (event.team === 'home') homeScore++;
                            else if (event.team === 'away') awayScore++;
                        }
                        
                        // Získame najvyšší čas udalosti (koniec zápasu)
                        if (event.minute !== undefined && event.second !== undefined) {
                            const eventTimeInSeconds = event.minute * 60 + (event.second || 0);
                            if (eventTimeInSeconds > matchTime) {
                                matchTime = eventTimeInSeconds;
                            }
                        }
                    });
                    
                    newData[match.id] = {
                        time: matchTime,
                        homeScore,
                        awayScore,
                        status: 'completed'
                    };
                } catch (error) {
                    // Ticho ignorujeme chyby
                }
            }
            
            setCompletedMatchData(newData);
        };
        
        fetchCompletedMatches();
    }, [matches]); // Spustí sa pri zmene matches

    // NOVÝ useEffect PRE SLEDOVANIE ŽIVÝCH ZÁPASOV
    useEffect(() => {
        if (!window.db || matches.length === 0) return;
    
        // Filtrujeme prebiehajúce zápasy
        const liveMatches = matches.filter(m => m.status === 'in-progress' || m.status === 'paused');
        
        if (liveMatches.length === 0) {
            setLiveMatchData({});
            return;
        }
    
        // Pre každý živý zápas načítame udalosti
        const unsubscribes = liveMatches.map(match => {
            const eventsRef = collection(window.db, 'matchEvents');
            const q = query(eventsRef, where("matchId", "==", match.id));
            
            return onSnapshot(q, (snapshot) => {
                let homeScore = 0;
                let awayScore = 0;
                let matchTime = 0;
                
                // Získame všetky udalosti a vypočítame skóre
                const events = [];
                snapshot.forEach((doc) => {
                    const event = { id: doc.id, ...doc.data() };
                    events.push(event);
                    
                    // Výpočet skóre
                    if (event.type === 'goal' || (event.type === 'penalty' && event.subType === 'scored')) {
                        if (event.team === 'home') homeScore++;
                        else if (event.team === 'away') awayScore++;
                    }
                    
                    // Získame najnovší čas udalosti
                    if (event.minute !== undefined && event.second !== undefined) {
                        const eventTimeInSeconds = event.minute * 60 + (event.second || 0);
                        if (eventTimeInSeconds > matchTime) {
                            matchTime = eventTimeInSeconds;
                        }
                    }
                });
                
                // Ak máme startedAt, použijeme ho na výpočet aktuálneho času
                if (match.startedAt) {
                    const now = Timestamp.now();
                    const startedAt = match.startedAt;
                    
                    if (match.status === 'paused' && match.pausedAt) {
                        // Ak je pozastavené, čas je rozdiel medzi štartom a pozastavením + offset
                        matchTime = Math.floor((match.pausedAt.seconds - startedAt.seconds)) + (match.manualTimeOffset || 0);
                    } else {
                        // Ak beží, čas je aktuálny rozdiel + offset
                        matchTime = Math.floor((now.seconds - startedAt.seconds)) + (match.manualTimeOffset || 0);
                    }
                }
                
                setLiveMatchData(prev => ({
                    ...prev,
                    [match.id]: {
                        time: matchTime,
                        homeScore,
                        awayScore,
                        status: match.status
                    }
                }));
            }, (error) => {
                // Ticho ignorujeme chyby
            });
        });
    
        return () => {
            unsubscribes.forEach(unsubscribe => unsubscribe());
        };
    }, [matches]);
            
    // UPRAVENÝ useEffect pre timer - automatické zastavenie na konci periódy
    useEffect(() => {
        
        // Vymažeme existujúci interval
        if (timerInterval) {
            clearInterval(timerInterval);
            setTimerInterval(null);
        }
        
        // Získame kategóriu pre aktuálny zápas
        const currentCategory = selectedMatch ? categories.find(c => c.name === selectedMatch.categoryName) : null;
        
        // Spustíme nový interval len ak je zápas v priebehu
        if (selectedMatch && selectedMatch.status === 'in-progress' && selectedMatch.startedAt && currentCategory) {
            
            const startedAt = selectedMatch.startedAt;
            const matchId = selectedMatch.id;
            let currentPeriod = selectedMatch.currentPeriod || 1;
            
            // Dĺžka jednej periódy v sekundách
            const periodDurationSeconds = (currentCategory.periodDuration || 20) * 60;
            const periods = currentCategory.periods || 2;
            
            // Vypočítame koniec aktuálnej periódy (v sekundách)
            const endOfCurrentPeriod = currentPeriod * periodDurationSeconds;
                        
            const interval = setInterval(() => {
                const now = Timestamp.now();
                
                // Ak je zápas pozastavený, čas nebeží
                if (selectedMatch.status === 'paused') {
                    return;
                }
                
                const baseSeconds = Math.floor((now.seconds - startedAt.seconds));
                const elapsedSeconds = baseSeconds + manualTimeOffset;
                
                // Aktualizujeme čas
                setMatchTime(elapsedSeconds);
                setCleanPlayingTime(elapsedSeconds);
                
                // Kontrola konca aktuálnej periódy
                if (elapsedSeconds >= endOfCurrentPeriod) {
                    
                    // Ak to nie je posledná perióda
                    if (currentPeriod < periods) {
                        // Zastavíme časovač (koniec periódy)
                        stopMatchTimer(matchId);
                        window.showGlobalNotification(`Koniec ${currentPeriod}. periódy`, 'info');
                    } else {
                        // Ak je to posledná perióda, ukončíme zápas
                        stopMatchTimer(matchId);
                        window.showGlobalNotification('Koniec zápasu', 'info');
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
    }, [selectedMatch, selectedMatch?.status, selectedMatch?.startedAt, selectedMatch?.pausedAt, selectedMatch?.currentPeriod, categories, manualTimeOffset]);
    
    // UPRAVENÝ useEffect pre zobrazenie času - zobrazujeme čistý hrací čas
    // Tento useEffect môžete pridať na zobrazenie čistého hracieho času v UI
    useEffect(() => {
        if (selectedMatch && categories.length > 0) {
            const currentCategory = categories.find(c => c.name === selectedMatch.categoryName);
            if (currentCategory) {
                const cleanTime = convertTotalToCleanTime(matchTime, currentCategory);
                setCleanPlayingTime(cleanTime);
            }
        }
    }, [matchTime, selectedMatch, categories]);

    // UPRAVENÝ useEffect pre inicializáciu času
    useEffect(() => {

        if (selectedMatch && selectedMatch.startedAt) {
            const now = Timestamp.now();
            const startedAt = selectedMatch.startedAt;
            
            let baseTime = 0;
            
            if (selectedMatch.status === 'paused' && selectedMatch.pausedAt) {
                const pausedAt = selectedMatch.pausedAt;
                baseTime = Math.floor((pausedAt.seconds - startedAt.seconds));
            } else {
                baseTime = Math.floor((now.seconds - startedAt.seconds));
            }
            
            const totalTime = baseTime + (selectedMatch.manualTimeOffset || 0);
            
            setMatchTime(totalTime);
            setCleanPlayingTime(totalTime);
            
        } else {
//            console.log('Žiadny startedAt, nastavujem 0');
            setMatchTime(0);
            setCleanPlayingTime(0);
        }
    }, [selectedMatch, categories]);

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
//                console.error("Chyba pri načítaní názvu haly:", error);
                setHallName(hallId || 'Chyba načítania');
            }
        };
        
        fetchHallName();
    }, [hallId]);

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
                
                // Výpočet skóre podľa udalostí v chronologickom poradí
                // (ale zachováme pôvodné poradie pre zobrazenie)
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
            
            // Pre výpočet aktuálneho skóre ideme od najstaršej po najnovšiu
            const sortedAsc = [...loadedEvents].sort((a, b) => {
                if (a.minute !== b.minute) {
                    return (a.minute || 0) - (b.minute || 0);
                }
                return (a.second || 0) - (b.second || 0);
            });
            
            sortedAsc.forEach(event => {
                if (event.type === 'goal') {
                    if (event.team === 'home') homeScore++;
                    else if (event.team === 'away') awayScore++;
                } else if (event.type === 'penalty' && event.subType === 'scored') {
                    if (event.team === 'home') homeScore++;
                    else if (event.team === 'away') awayScore++;
                }
            });
            
            setMatchEvents(loadedEvents);
            setMatchScore({ home: homeScore, away: awayScore });
            setLoadingEvents(false);
        }, (error) => {
//            console.error("Chyba pri načítaní udalostí zápasu:", error);
            setLoadingEvents(false);
        });
    
        return () => unsubscribe();
    }, [selectedMatch]);
    
    const deleteMatchEvent = async (eventId) => {
        if (!window.db || !eventId) return;
    
        // Namiesto window.confirm otvoríme modálne okno
        setEventToDelete(eventId);
        setConfirmModalOpen(true);
    };

    const confirmDeleteEvent = async () => {
        if (!eventToDelete) return;
    
        try {
            // Najprv získame zmazanú udalosť, aby sme zistili, o aký typ išlo a ktorý tím
            const deletedEventRef = doc(window.db, 'matchEvents', eventToDelete);
            const deletedEventSnap = await getDoc(deletedEventRef);
            
            if (!deletedEventSnap.exists()) {
                window.showGlobalNotification('Udalosť neexistuje', 'error');
                return;
            }
            
            const deletedEvent = deletedEventSnap.data();
            
            // Zmažeme udalosť
            await deleteDoc(deletedEventRef);
            
            // Ak ide o gól alebo premenenú penaltu, musíme prepočítať skóre pre nasledujúce udalosti
            if (deletedEvent.type === 'goal' || (deletedEvent.type === 'penalty' && deletedEvent.subType === 'scored')) {
                
                // Získame všetky udalosti pre tento zápas, ktoré nasledujú po zmazanej udalosti
                const eventsRef = collection(window.db, 'matchEvents');
                const q = query(
                    eventsRef, 
                    where("matchId", "==", selectedMatch.id),
                    orderBy("minute", "asc"),
                    orderBy("second", "asc")
                );
                
                const querySnapshot = await getDocs(q);
                const events = [];
                querySnapshot.forEach((doc) => {
                    events.push({ id: doc.id, ...doc.data() });
                });
                
                // Nájdeme index zmazanej udalosti v zoradenom zozname
                // (potrebujeme vedieť, kde presne bola)
                // Použijeme čas na porovnanie, ale pozor - môže byť viac udalostí v rovnakom čase
                const deletedEventTime = (deletedEvent.minute || 0) * 60 + (deletedEvent.second || 0);
                
                // Prepočítame skóre od začiatku
                let homeScore = 0;
                let awayScore = 0;
                const updatePromises = [];
                
                // Prejdeme všetky udalosti v chronologickom poradí
                for (const event of events) {
                    // Uložíme skóre pred udalosťou
                    const scoreBefore = { home: homeScore, away: awayScore };
                    
                    // Aktualizujeme skóre podľa typu udalosti (ak to nie je zmazaná udalosť)
                    if (event.id !== eventToDelete) {
                        if (event.type === 'goal' || (event.type === 'penalty' && event.subType === 'scored')) {
                            if (event.team === 'home') {
                                homeScore++;
                            } else if (event.team === 'away') {
                                awayScore++;
                            }
                        }
                    }
                    
                    const scoreAfter = { home: homeScore, away: awayScore };
                    
                    // Ak sa skóre pred/po zmenilo, aktualizujeme udalosť
                    if (JSON.stringify(event.scoreBefore) !== JSON.stringify(scoreBefore) || 
                        JSON.stringify(event.scoreAfter) !== JSON.stringify(scoreAfter)) {
                        
                        const eventRef = doc(window.db, 'matchEvents', event.id);
                        updatePromises.push(
                            updateDoc(eventRef, {
                                scoreBefore: scoreBefore,
                                scoreAfter: scoreAfter
                            })
                        );
                    }
                }
                
                // Vykonáme všetky aktualizácie
                if (updatePromises.length > 0) {
                    await Promise.all(updatePromises);
                }
            }
            
            window.showGlobalNotification('Udalosť bola zmazaná', 'success');
            setEventToDelete(null);
        } catch (error) {
            console.error('Chyba pri mazaní udalosti:', error);
            window.showGlobalNotification('Chyba pri mazaní udalosti', 'error');
        }
    };
    
    // 🔴 UPRAVENÁ FUNKCIA: getPlayerNameFromRef - používa referencie bez mien
    const getPlayerNameFromRef = (playerRef) => {
        if (!playerRef || !playerRef.userId) return 'Neznámy hráč';
        
        const user = users.find(u => u.id === playerRef.userId);
        if (!user) return 'Neznámy hráč';
        
        // Kontrola, či ide o člena realizačného tímu (staff)
        if (playerRef.staffType && playerRef.staffIndex !== undefined) {
            // Získame detail tímu podľa identifikátora
            const teamDetails = getTeamDetails(playerRef.teamIdentifier);
            if (!teamDetails) return 'Neznámy člen RT';
            
            if (playerRef.staffType === 'men' && teamDetails.team.menTeamMemberDetails && 
                teamDetails.team.menTeamMemberDetails[playerRef.staffIndex]) {
                const member = teamDetails.team.menTeamMemberDetails[playerRef.staffIndex];
                return `${member.lastName} ${member.firstName}`;
            } else if (playerRef.staffType === 'women' && teamDetails.team.womenTeamMemberDetails && 
                       teamDetails.team.womenTeamMemberDetails[playerRef.staffIndex]) {
                const member = teamDetails.team.womenTeamMemberDetails[playerRef.staffIndex];
                return `${member.lastName} ${member.firstName}`;
            }
            return 'Neznámy člen RT';
        }
        
        // Pre hráča
        if (playerRef.playerIndex !== undefined) {
            // Získame detail tímu podľa identifikátora
            const teamDetails = getTeamDetails(playerRef.teamIdentifier);
            if (!teamDetails || !teamDetails.team.playerDetails) return 'Neznámy hráč';
            
            const player = teamDetails.team.playerDetails[playerRef.playerIndex];
            if (player) {
                return `${player.lastName} ${player.firstName} `;
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
//                    console.log('=== NAČÍTANÉ KATEGÓRIE S NASTAVENIAMI ===');
//                    categoriesList.forEach((cat, index) => {
//                        console.log(`Kategória #${index + 1}:`, {
//                            id: cat.id,
//                            name: cat.name,
//                            maxTeams: cat.maxTeams,
//                            maxPlayers: cat.maxPlayers,
//                            maxImplementationTeam: cat.maxImplementationTeam,
//                            periods: cat.periods,
//                            periodDuration: cat.periodDuration,
//                            breakDuration: cat.breakDuration,
//                            matchBreak: cat.matchBreak,
//                            drawColor: cat.drawColor,
//                            transportColor: cat.transportColor
//                        });
//                    });
//                    console.log('=========================================');
                    
                } else {
//                    console.log("Neboli nájdené žiadne kategórie");
                    setCategories([]);
                }
            } catch (error) {
//                console.error("Chyba pri načítaní kategórií:", error);
            }
        };
        
        loadCategorySettings();
    }, []); // Prázdne pole - spustí sa len raz

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
        }, (error) => {
//            console.error('Chyba pri načítaní používateľov:', error);
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
//                console.log('Načítaný zápas:', data); // Pre ladenie
                
                loadedMatches.push({
                    id: doc.id,
                    ...data,
                    currentPeriod: data.currentPeriod || 1,
                    manualTimeOffset: data.manualTimeOffset || 0
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
                    setManualTimeOffset(matchFromUrl.manualTimeOffset || 0);
                }
            }
            
        }, (error) => {
//            console.error("Chyba pri načítaní zápasov:", error);
            setLoading(false);
        });
    
        return () => unsubscribe();
    }, [hallId]);
    
    // SAMOSTATNÝ useEffect PRE VÝPIS DO KONZOLY - závislý na matches AJ categories
    useEffect(() => {
        // Spustí sa až keď sú obe dáta načítané
        if (matches.length > 0 && categories.length > 0) {
//            console.log('=== VŠETKY ZÁPASY V TEJTO HALE S NASTAVENIAMI KATEGÓRIE ===');
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
                    
//                    console.log(`\n  ⏱️ ROZPIS ČASU ZÁPASU:`);
                    for (let i = 1; i <= periods; i++) {
//                        console.log(`  • ${i}. polčas: ${periodDuration} min`);
                        if (i < periods) {
//                            console.log(`  • Prestávka: ${breakDuration} min`);
                        }
                    }
                    
//                    console.log(`\n  ⏱️ SÚHRN ČASU:`);
//                    console.log(`  • Čistý hrací čas: ${playingTime} min (${periods} × ${periodDuration} min)`);
                    if (periods > 1) {
//                        console.log(`  • Celkový čas prestávok v zápase: ${breaksBetweenPeriods} min`);
//                        console.log(`  • Celkový čas zápasu (s prestávkami): ${totalMatchTime} min`);
                    }
//                    console.log(`  • Prestávka medzi zápasmi: ${matchBreak} min`);
//                    console.log(`  • Celkový čas s prestávkou medzi zápasmi: ${totalTimeWithMatchBreak} min`);
                    
                    if (periods === 2) {
//                        console.log(`\n  📊 ČASOVÝ ROZPIS V MINÚTACH:`);
//                        console.log(`  • 0 - ${periodDuration}: 1. polčas`);
//                        console.log(`  • ${periodDuration} - ${periodDuration + breakDuration}: Prestávka`);
//                        console.log(`  • ${periodDuration + breakDuration} - ${totalMatchTime}: 2. polčas`);
//                        console.log(`  • ${totalMatchTime} - ${totalTimeWithMatchBreak}: Prestávka medzi zápasmi`);
                    }
                } else {
//                    console.log(`\n  ⚠️ Nastavenia kategórie nie sú k dispozícii`);
                }
                
//                console.log('─'.repeat(50));
            });
//            console.log(`\n📊 Celkový počet zápasov: ${matches.length}`);
//            console.log('='.repeat(60));
        }
    }, [matches, categories]); // Tento useEffect sa spustí vždy, keď sa zmenia matches ALEBO categories

    // Pomocná funkcia na získanie názvu tímu s čakaním na teamManager
    const getTeamNameSafe = (identifier) => {
        if (!identifier) return 'Neznámy tím';
        
        // Ak je teamManager dostupný, použijeme ho
        if (window.teamManager && typeof window.teamManager.getTeamNameByDisplayIdSync === 'function') {
            const teamName = window.teamManager.getTeamNameByDisplayIdSync(identifier);
            if (teamName) return teamName;
        }
        
        // Fallback - manuálne vyhľadávanie v users (pre user teams)
        if (users && users.length > 0) {
            const parts = identifier.split(' ');
            if (parts.length >= 2) {
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
                
                for (const user of users) {
                    if (!user.teams) continue;
                    const userTeams = user.teams[category];
                    if (!userTeams || !Array.isArray(userTeams)) continue;
                    
                    const team = userTeams.find(t => 
                        t.groupName === fullGroupName && 
                        t.order === orderNum
                    );
                    
                    if (team && team.teamName) {
                        return team.teamName;
                    }
                }
            }
        }
        
        // Ak nič nenašlo, vrátime pôvodný identifikátor
        return identifier;
    };

    // FUNKCIA NA ZÍSKANIE NÁZVU TÍMU PODĽA IDENTIFIKÁTORA (KOMPLETNE OPRAVENÁ)
    const getTeamNameByIdentifier = (identifier) => {
        if (!identifier) return 'Neznámy tím';
    
        // 🔴 1. NAJPRV SKÚSIME ZÍSKAŤ NÁZOV Z MAPOVANIA (z druhého kódu)
        let mappedTeamName = null;
        
        if (window.teamNameReplacer && typeof window.teamNameReplacer.getTeamNameFromMapping === 'function') {
            mappedTeamName = window.teamNameReplacer.getTeamNameFromMapping(identifier);
            if (mappedTeamName && mappedTeamName !== identifier) {
                console.log(`🔄 Mapovanie z druhého kódu: "${identifier}" → "${mappedTeamName}"`);
                return mappedTeamName;
            }
        }
        
        // 🔴 2. SKÚSIME PRIAMO Z GLOBÁLNEHO OBJEKTU __teamNameMapping
        if (window.__teamNameMapping && window.__teamNameMapping[identifier]) {
            mappedTeamName = window.__teamNameMapping[identifier].teamName;
            if (mappedTeamName && mappedTeamName !== identifier) {
                console.log(`🔄 Mapovanie z __teamNameMapping: "${identifier}" → "${mappedTeamName}"`);
                return mappedTeamName;
            }
        }
        
        // 3. Pôvodné vyhľadávanie v superstructureTeams (ak nie je mapovanie)
        let foundName = null;
        
        // Skúsime superstructureTeams zo stavu
        if (superstructureTeams && Object.keys(superstructureTeams).length > 0) {
            const parts = identifier.split(' ');
            if (parts.length >= 2) {
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
                
                if (order) {
                    const fullGroupName = `skupina ${groupLetter}`;
                    const orderNum = parseInt(order, 10);
                    
                    const categoryTeams = superstructureTeams[category];
                    if (categoryTeams && Array.isArray(categoryTeams)) {
                        const team = categoryTeams.find(t => 
                            t.groupName === fullGroupName && 
                            t.order === orderNum
                        );
                        if (team && team.teamName) {
                            foundName = team.teamName;
                        }
                    }
                }
            }
        }
        
        // 4. Vyhľadávanie v používateľoch (user teams)
        if (!foundName && users && users.length > 0) {
            const parts = identifier.split(' ');
            if (parts.length >= 2) {
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
                
                if (order) {
                    const fullGroupName = `skupina ${groupLetter}`;
                    const orderNum = parseInt(order, 10);
                    
                    for (const user of users) {
                        if (!user.teams) continue;
                        const userTeams = user.teams[category];
                        if (!userTeams || !Array.isArray(userTeams)) continue;
                        
                        const team = userTeams.find(t => 
                            t.groupName === fullGroupName && 
                            t.order === orderNum
                        );
                        
                        if (team && team.teamName) {
                            foundName = team.teamName;
                            break;
                        }
                    }
                }
            }
        }
        
        // 5. Ak sme našli názov v databáze, aplikujeme ešte raz mapping (pre prípad, že by bol potrebný)
        if (foundName && window.teamNameReplacer && typeof window.teamNameReplacer.getTeamNameFromMapping === 'function') {
            const remappedName = window.teamNameReplacer.getTeamNameFromMapping(foundName);
            if (remappedName && remappedName !== foundName) {
                console.log(`🔄 Re-mapovanie názvu: "${foundName}" → "${remappedName}"`);
                return remappedName;
            }
        }
        
        // 6. Ak nič nenašlo, vrátime pôvodný identifikátor
        return foundName || identifier;
    };

    // Funkcia na získanie detailov tímu priamo z mapovania
    const getTeamDetailsFromMapping = (identifier) => {
        if (!identifier) return null;
        
        // Získame mapovanie pre tento identifikátor
        const mapping = window.__teamNameMapping?.[identifier];
        if (!mapping) return null;
        
        // Teraz vieme, že identifikátor U12 D 1A zodpovedá tímu s názvom mapping.teamName
        // Potrebujeme nájsť používateľa, ktorý má tento tím
        
        for (const user of users) {
            if (!user.teams) continue;
            
            for (const [category, teams] of Object.entries(user.teams)) {
                if (!Array.isArray(teams)) continue;
                
                const team = teams.find(t => t.teamName === mapping.teamName);
                if (team) {
                    console.log(`✅ Nájdený používateľský tím cez mapovanie: ${team.teamName} (${user.email})`);
                    return {
                        team: team,
                        userEmail: user.email,
                        userId: user.id,
                        userDisplayName: user.displayName
                    };
                }
            }
        }
        
        return null;
    };

    // FUNKCIA NA ZÍSKANIE KOMPLETNÝCH INFORMÁCIÍ O TÍME (upravená - hľadá podľa názvu aj identifikátora)
    const getTeamDetails = (identifier) => {
        if (!identifier) return null;
        
        let searchIdentifier = identifier;
        
        // Kontrola, či ide o názov tímu (nie identifikátor)
        // Identifikátor má typicky tvar "U12 D 2B" - obsahuje medzeru a číslo+písmeno
        const identifierPattern = /\s+\d+[A-Za-z]/;
        const isDisplayId = identifierPattern.test(identifier);
        
        // Ak to nie je displayId (identifikátor), skúsime nájsť pôvodný identifikátor v DOM
        if (!isDisplayId) {
            // Hľadáme element, ktorý obsahuje tento názov tímu a má uložený pôvodný identifikátor
            const elements = document.querySelectorAll(`[data-team-name="${identifier}"]`);
            if (elements.length > 0 && elements[0].getAttribute('data-original-identifier')) {
                searchIdentifier = elements[0].getAttribute('data-original-identifier');
                console.log(`🔍 Pre názov "${identifier}" nájdený pôvodný identifikátor: ${searchIdentifier}`);
            } else {
                // Skúsime nájsť podľa čiastočnej zhody v data-original-identifier
                const allElementsWithId = document.querySelectorAll('[data-original-identifier]');
                for (const el of allElementsWithId) {
                    const originalId = el.getAttribute('data-original-identifier');
                    const teamName = window.matchTracker?.getTeamNameByDisplayId?.(originalId);
                    if (teamName === identifier && originalId) {
                        searchIdentifier = originalId;
                        console.log(`🔍 Pre názov "${identifier}" nájdený pôvodný identifikátor (fallback): ${searchIdentifier}`);
                        break;
                    }
                }
            }
        }
        
        // Parsujeme identifikátor v tvare "kategória skupinaorder" (napr. "U12 D F4")
        const parts = searchIdentifier.split(' ');
        
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
        
        // Hľadáme v users (používateľských tímoch)
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
                    console.log(`✅ Nájdený používateľský tím: ${team.teamName} (${user.email})`);
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
    const selectMatch = async (match) => {
        setSelectedMatch(match);
        setManualTimeOffset(match.manualTimeOffset || 0);
        updateUrlParameters(match.homeTeamIdentifier, match.awayTeamIdentifier);
        window.currentMatchId = match.id;
        
        // ✅ PODROBNÝ VÝPIS INFORMÁCIÍ O ZÁPASE DO KONZOLY
        console.log('');
        console.log('='.repeat(80));
        console.log('📋 VYBRANÝ ZÁPAS - DETAILNÉ INFORMÁCIE:');
        console.log('='.repeat(80));
        
        // Najprv skúsime získať názvy tímov priamo z DOM elementu
        let homeTeamNameFromDOM = '';
        let awayTeamNameFromDOM = '';
        let matchTimeFromDOM = '';
        let matchDateFromDOM = '';
        let groupNameFromDOM = '';
        let categoryNameFromDOM = '';
        
        // Počkáme krátko, aby sa DOM stihol aktualizovať
        setTimeout(() => {
            // Nájdeme všetky riadky zápasov v DOM
            const matchRows = document.querySelectorAll('.divide-y.divide-gray-100 > div, .px-6.py-4');
            
            let clickedRow = null;
            
            // Nájdeme riadok, ktorý obsahuje tento zápas (podľa identifikátorov)
            for (const row of matchRows) {
                const rowText = row.textContent || '';
                if (rowText.includes(match.homeTeamIdentifier) || rowText.includes(match.awayTeamIdentifier)) {
                    clickedRow = row;
                    break;
                }
            }
            
            // Ak sme nenašli podľa identifikátorov, skúsime podľa dátumu a času
            if (!clickedRow && match.scheduledTime) {
                const matchTimeStr = formatTime(match.scheduledTime);
                for (const row of matchRows) {
                    if (row.textContent?.includes(matchTimeStr)) {
                        clickedRow = row;
                        break;
                    }
                }
            }
            
            if (clickedRow) {
                // Získame čas z DOM
                const timeElement = clickedRow.querySelector('.font-mono.font-medium');
                if (timeElement) {
                    matchTimeFromDOM = timeElement.textContent?.trim() || '';
                }
                
                // Získame skupinu/typ zápasu
                const groupSpan = clickedRow.querySelector('.px-3.py-1.text-xs.font-medium.rounded-full');
                if (groupSpan) {
                    groupNameFromDOM = groupSpan.textContent?.trim() || '';
                }
                
                // Získame kategóriu
                const categorySpan = clickedRow.querySelector('.px-3.py-1.text-xs.font-medium.rounded-full.mr-2');
                if (categorySpan) {
                    categoryNameFromDOM = categorySpan.textContent?.trim() || '';
                }
                
                // Nájdeme všetky elementy s názvami tímov v tomto riadku
                const teamSpans = clickedRow.querySelectorAll('.font-medium.text-gray-800');
                
                if (teamSpans.length >= 2) {
                    // Prvý span je domáci, druhý je hosťovský
                    homeTeamNameFromDOM = teamSpans[0]?.textContent?.trim() || '';
                    awayTeamNameFromDOM = teamSpans[1]?.textContent?.trim() || '';
                } else {
                    // Alternatívny spôsob - nájdeme podľa pozície v texte
                    const allText = clickedRow.textContent || '';
                    const parts = allText.split('VS');
                    if (parts.length >= 2) {
                        const homePart = parts[0].trim();
                        const awayPart = parts[1].trim();
                        
                        const homeWords = homePart.split(' ');
                        const awayWords = awayPart.split(' ');
                        
                        homeTeamNameFromDOM = homeWords.filter(w => !w.includes(':') && !w.match(/^\d{2}:\d{2}$/)).join(' ') || '';
                        awayTeamNameFromDOM = awayWords.filter(w => !w.includes(':') && !w.match(/^\d{2}:\d{2}$/)).join(' ') || '';
                    }
                }
                
                // Vyčistíme názvy
                homeTeamNameFromDOM = homeTeamNameFromDOM.replace(/\s+/g, ' ').trim();
                awayTeamNameFromDOM = awayTeamNameFromDOM.replace(/\s+/g, ' ').trim();
                
                // Získame dátum z DOM (z hlavičky dňa)
                const dayHeader = clickedRow.closest('.border.border-gray-200')?.querySelector('.bg-gray-50.px-6.py-3 h3');
                if (dayHeader) {
                    matchDateFromDOM = dayHeader.textContent?.trim() || '';
                }
                
                // VÝPIS Z DOM ELEMENTU
                console.log('');
                console.log('📍 INFORMÁCIE Z DOM ELEMENTU:');
                console.log('─'.repeat(60));
                console.log(`🏠 DOMÁCI TÍM (z DOM): "${homeTeamNameFromDOM}"`);
                console.log(`✈️ HOSŤOVSKÝ TÍM (z DOM): "${awayTeamNameFromDOM}"`);
                console.log(`📅 DÁTUM (z DOM): ${matchDateFromDOM || 'nezistený'}`);
                console.log(`⏰ ČAS (z DOM): ${matchTimeFromDOM || 'nezistený'}`);
                console.log(`📂 KATEGÓRIA (z DOM): ${categoryNameFromDOM || match.categoryName || 'neurčená'}`);
                console.log(`👥 SKUPINA/TYP (z DOM): ${groupNameFromDOM || match.groupName || '—'}`);
                console.log('─'.repeat(60));
            } else {
                console.log('⚠️ Nenašiel sa DOM element pre tento zápas');
            }
            
            // VÝPIS Z DATABÁZY (pre porovnanie)
            console.log('');
            console.log('💾 INFORMÁCIE Z DATABÁZY:');
            console.log('─'.repeat(60));
            console.log(`🏠 DOMÁCI TÍM (databáza): ${match.homeTeamIdentifier}`);
            console.log(`✈️ HOSŤOVSKÝ TÍM (databáza): ${match.awayTeamIdentifier}`);
            console.log(`📂 KATEGÓRIA (databáza): ${match.categoryName || 'neurčená'}`);
            console.log(`👥 SKUPINA (databáza): ${match.groupName || 'neurčená'}`);
            console.log(`🏆 TYP ZÁPASU (databáza): ${match.isPlacementMatch ? `Zápas o ${match.placementRank}. miesto` : (match.matchType || '—')}`);
            console.log(`🆔 ID zápasu: ${match.id}`);
            console.log(`📅 Dátum (databáza): ${match.scheduledTime ? formatDateWithDay(match.scheduledTime.toDate()) : 'neurčený'}`);
            console.log(`⏰ Čas (databáza): ${match.scheduledTime ? formatTime(match.scheduledTime) : '-- : --'}`);
            console.log(`📊 Status: ${match.status === 'completed' ? 'Odohrané' : (match.status === 'in-progress' ? 'Prebieha' : (match.status === 'paused' ? 'Pozastavené' : 'Naplánované'))}`);
            console.log('─'.repeat(60));
            
            // ZHRNUTIE
            console.log('');
            console.log('📊 ZHRNUTIE:');
            console.log('─'.repeat(60));
            console.log(`✅ Domáci tím: ${homeTeamNameFromDOM || match.homeTeamIdentifier}`);
            console.log(`✅ Hosťovský tím: ${awayTeamNameFromDOM || match.awayTeamIdentifier}`);
            console.log(`✅ Kategória: ${categoryNameFromDOM || match.categoryName || 'neurčená'}`);
            console.log(`✅ Skupina: ${groupNameFromDOM || match.groupName || '—'}`);
            console.log(`✅ Dátum a čas: ${matchDateFromDOM || formatDateWithDay(match.scheduledTime?.toDate()) || 'neurčený'} ${matchTimeFromDOM || (match.scheduledTime ? formatTime(match.scheduledTime) : '')}`);
            console.log('─'.repeat(60));
            console.log('');
            
            // Ak sme získali názvy z DOM, použijeme ich na nastavenie
            if (homeTeamNameFromDOM && awayTeamNameFromDOM && categoryNameFromDOM) {
                console.log('🚀 Používam názvy z DOM na nastavenie tímov...');
            }
        }, 50);
        
        // AUTOMATICKÉ NASTAVENIE TÍMOV PO KLIKNUTÍ NA ZÁPAS - PRIAMO Z DOM ELEMENTU
        console.log('🔄 Automatické nastavenie tímov pre vybraný zápas...');
        
        // Počkáme krátko, aby sa DOM stihol aktualizovať (pre prípad, že by sme potrebovali nájsť elementy)
        setTimeout(async () => {
            // Nájdeme všetky riadky zápasov v DOM
            const matchRows = document.querySelectorAll('.divide-y.divide-gray-100 > div, .px-6.py-4');
            
            let clickedRow = null;
            
            // Nájdeme riadok, ktorý obsahuje tento zápas (podľa identifikátorov)
            for (const row of matchRows) {
                const rowText = row.textContent || '';
                // Skúsime nájsť podľa identifikátorov v atribútoch alebo v texte
                if (rowText.includes(match.homeTeamIdentifier) || rowText.includes(match.awayTeamIdentifier)) {
                    clickedRow = row;
                    break;
                }
            }
            
            // Ak sme nenašli podľa identifikátorov, skúsime podľa dátumu a času
            if (!clickedRow && match.scheduledTime) {
                const matchTime = formatTime(match.scheduledTime);
                for (const row of matchRows) {
                    if (row.textContent?.includes(matchTime)) {
                        clickedRow = row;
                        break;
                    }
                }
            }
            
            if (clickedRow) {
                // Nájdeme všetky elementy s názvami tímov v tomto riadku
                // V riadku sú dva tímy - domáci a hosťovský
                const teamSpans = clickedRow.querySelectorAll('.font-medium.text-gray-800');
                
                let homeTeamName = '';
                let awayTeamName = '';
                
                if (teamSpans.length >= 2) {
                    // Prvý span je domáci, druhý je hosťovský
                    homeTeamName = teamSpans[0]?.textContent?.trim() || '';
                    awayTeamName = teamSpans[1]?.textContent?.trim() || '';
                } else {
                    // Alternatívny spôsob - nájdeme podľa pozície v texte
                    const allText = clickedRow.textContent || '';
                    const parts = allText.split('VS');
                    if (parts.length >= 2) {
                        // Časť pred VS je domáci a časť za VS je hosťovský (ale obsahuje aj čas a ďalšie údaje)
                        const homePart = parts[0].trim();
                        const awayPart = parts[1].trim();
                        
                        // Extrahujeme názov tímu (prvé slová, ktoré nie sú čas)
                        const homeWords = homePart.split(' ');
                        const awayWords = awayPart.split(' ');
                        
                        // Názov tímu je zvyčajne pred dvojbodkou alebo pred VS
                        homeTeamName = homeWords.filter(w => !w.includes(':') && !w.match(/^\d{2}:\d{2}$/)).join(' ') || '';
                        awayTeamName = awayWords.filter(w => !w.includes(':') && !w.match(/^\d{2}:\d{2}$/)).join(' ') || '';
                    }
                }
                
                // Vyčistíme názvy (odstránime nadbytočné medzery)
                homeTeamName = homeTeamName.replace(/\s+/g, ' ').trim();
                awayTeamName = awayTeamName.replace(/\s+/g, ' ').trim();
                
                const categoryName = match.categoryName;
                
                console.log(`🏠 Domáci tím (z DOM): "${homeTeamName}"`);
                console.log(`✈️ Hosťovský tím (z DOM): "${awayTeamName}"`);
                console.log(`📂 Kategória: ${categoryName}`);
                
                // 🔄 NAJPRV POUŽIJEME MAPPING NA NÁZVY TÍMOV Z DOM
                let mappedHomeTeamName = homeTeamName;
                let mappedAwayTeamName = awayTeamName;
                
                if (window.teamNameReplacer && typeof window.teamNameReplacer.getTeamNameFromMapping === 'function') {
                    if (homeTeamName) {
                        const mappedHome = window.teamNameReplacer.getTeamNameFromMapping(homeTeamName);
                        if (mappedHome && mappedHome !== homeTeamName) {
                            console.log(`🔄 Mapovanie domáceho tímu (z DOM): "${homeTeamName}" → "${mappedHome}"`);
                            mappedHomeTeamName = mappedHome;
                        } else if (mappedHome) {
                            mappedHomeTeamName = mappedHome;
                        }
                    }
                    
                    if (awayTeamName) {
                        const mappedAway = window.teamNameReplacer.getTeamNameFromMapping(awayTeamName);
                        if (mappedAway && mappedAway !== awayTeamName) {
                            console.log(`🔄 Mapovanie hosťovského tímu (z DOM): "${awayTeamName}" → "${mappedAway}"`);
                            mappedAwayTeamName = mappedAway;
                        } else if (mappedAway) {
                            mappedAwayTeamName = mappedAway;
                        }
                    }
                }
                
                // Spustíme nastavenie tímov so zmapovanými názvami z DOM
                if (mappedHomeTeamName && mappedAwayTeamName && categoryName) {
                    await window.setBothTeamsDetails(mappedHomeTeamName, categoryName, mappedAwayTeamName, categoryName);
                    console.log('✅ Tímy boli automaticky nastavené z DOM elementu so zmapovanými názvami');
                } else {
                    console.log('⚠️ Nepodarilo sa získať názvy tímov z DOM, skúšam alternatívny spôsob...');
                    // Fallback - použijeme pôvodnú metódu s mapovaním
                    let homeTeamNameFromDb = getTeamNameByIdentifier(match.homeTeamIdentifier);
                    let awayTeamNameFromDb = getTeamNameByIdentifier(match.awayTeamIdentifier);
                    
                    // Aplikujeme mapping na názvy z databázy
                    if (window.teamNameReplacer && typeof window.teamNameReplacer.getTeamNameFromMapping === 'function') {
                        if (homeTeamNameFromDb && homeTeamNameFromDb !== match.homeTeamIdentifier) {
                            const mappedHome = window.teamNameReplacer.getTeamNameFromMapping(homeTeamNameFromDb);
                            if (mappedHome) {
                                homeTeamNameFromDb = mappedHome;
                            }
                        }
                        if (awayTeamNameFromDb && awayTeamNameFromDb !== match.awayTeamIdentifier) {
                            const mappedAway = window.teamNameReplacer.getTeamNameFromMapping(awayTeamNameFromDb);
                            if (mappedAway) {
                                awayTeamNameFromDb = mappedAway;
                            }
                        }
                    }
                    
                    if (homeTeamNameFromDb && awayTeamNameFromDb && homeTeamNameFromDb !== match.homeTeamIdentifier) {
                        await window.setBothTeamsDetails(homeTeamNameFromDb, categoryName, awayTeamNameFromDb, categoryName);
                        console.log('✅ Tímy boli nastavené z databázy (fallback) so zmapovanými názvami');
                    }
                }
            } else {
                console.log('⚠️ Nenašiel sa DOM element pre vybraný zápas, skúšam použiť databázu...');
                // Fallback - použijeme pôvodnú metódu s mapovaním
                let homeTeamName = getTeamNameByIdentifier(match.homeTeamIdentifier);
                let awayTeamName = getTeamNameByIdentifier(match.awayTeamIdentifier);
                const categoryName = match.categoryName;
                
                // Aplikujeme mapping na názvy z databázy
                if (window.teamNameReplacer && typeof window.teamNameReplacer.getTeamNameFromMapping === 'function') {
                    if (homeTeamName && homeTeamName !== match.homeTeamIdentifier) {
                        const mappedHome = window.teamNameReplacer.getTeamNameFromMapping(homeTeamName);
                        if (mappedHome) {
                            homeTeamName = mappedHome;
                        }
                    }
                    if (awayTeamName && awayTeamName !== match.awayTeamIdentifier) {
                        const mappedAway = window.teamNameReplacer.getTeamNameFromMapping(awayTeamName);
                        if (mappedAway) {
                            awayTeamName = mappedAway;
                        }
                    }
                }
                
                if (homeTeamName && homeTeamName !== match.homeTeamIdentifier && 
                    awayTeamName && awayTeamName !== match.awayTeamIdentifier && 
                    categoryName) {
                    await window.setBothTeamsDetails(homeTeamName, categoryName, awayTeamName, categoryName);
                    console.log('✅ Tímy boli nastavené z databázy so zmapovanými názvami');
                } else {
                    console.log('❌ Nepodarilo sa nastaviť tímy ani z DOM ani z databázy');
                }
            }
        }, 100);
    };

    // Zoradenie dní podľa dátumu
    const sortedDays = Object.values(groupedMatches).sort((a, b) => 
        a.date - b.date
    );

    // Ak je vybraný zápas, zobrazíme detail
    if (selectedMatch) {
        const homeTeamName = getTeamNameByIdentifier(selectedMatch.homeTeamIdentifier);
        const awayTeamName = getTeamNameByIdentifier(selectedMatch.awayTeamIdentifier);
        const homeTeamDetails = homeTeamDetailsState || getTeamDetails(selectedMatch.homeTeamIdentifier);
        const awayTeamDetails = awayTeamDetailsState || getTeamDetails(selectedMatch.awayTeamIdentifier);
        const matchDate = selectedMatch.scheduledTime ? formatDateWithDay(selectedMatch.scheduledTime.toDate()) : 'neurčený';
        const matchStartTime = selectedMatch.scheduledTime ? formatTime(selectedMatch.scheduledTime) : '-- : --';
        const category = categories.find(c => c.name === selectedMatch.categoryName);

        const activeMenStaffHome = homeTeamDetails?.team.menTeamMemberDetails?.filter(m => !m.removedForMatch?.[selectedMatch.id]) || [];
        const activeWomenStaffHome = homeTeamDetails?.team.womenTeamMemberDetails?.filter(m => !m.removedForMatch?.[selectedMatch.id]) || [];

        const activeMenStaffAway = awayTeamDetails?.team.menTeamMemberDetails?.filter(m => !m.removedForMatch?.[selectedMatch.id]) || [];
        const activeWomenStaffAway = awayTeamDetails?.team.womenTeamMemberDetails?.filter(m => !m.removedForMatch?.[selectedMatch.id]) || [];

        // Pridajte túto funkciu do časti if (selectedMatch) { ... }
        const recalculateScores = async () => {
            if (!selectedMatch || !window.db) return;
            
            try {
                // Získame všetky udalosti pre tento zápas zoradené chronologicky
                const eventsRef = collection(window.db, 'matchEvents');
                const q = query(
                    eventsRef, 
                    where("matchId", "==", selectedMatch.id),
                    orderBy("minute", "asc"),
                    orderBy("second", "asc")
                );
                
                const querySnapshot = await getDocs(q);
                const events = [];
                querySnapshot.forEach((doc) => {
                    events.push({ id: doc.id, ...doc.data() });
                });
                
                // Prepočítame skóre pre každú udalosť
                let homeScore = 0;
                let awayScore = 0;
                const updatePromises = [];
                
                for (const event of events) {
                    const scoreBefore = { home: homeScore, away: awayScore };
                    
                    // Aktualizujeme skóre podľa typu udalosti
                    if (event.type === 'goal' || (event.type === 'penalty' && event.subType === 'scored')) {
                        if (event.team === 'home') {
                            homeScore++;
                        } else if (event.team === 'away') {
                            awayScore++;
                        }
                    }
                    
                    const scoreAfter = { home: homeScore, away: awayScore };
                    
                    // Ak sa skóre zmenilo, aktualizujeme udalosť
                    if (JSON.stringify(event.scoreBefore) !== JSON.stringify(scoreBefore) || 
                        JSON.stringify(event.scoreAfter) !== JSON.stringify(scoreAfter)) {
                        
                        const eventRef = doc(window.db, 'matchEvents', event.id);
                        updatePromises.push(
                            updateDoc(eventRef, {
                                scoreBefore: scoreBefore,
                                scoreAfter: scoreAfter
                            })
                        );
                    }
                }
                
                // Vykonáme všetky aktualizácie
                if (updatePromises.length > 0) {
                    await Promise.all(updatePromises);
                }
                
            } catch (error) {
                console.error('Chyba pri prepočítavaní skóre:', error);
            }
        };

        // Pridajte novú funkciu pre aktualizáciu zvýraznenej udalosti
        const updateHighlightedEvent = async (newType, newTeam, newSubType, newPlayer) => {
            if (!highlightedEventId || !window.db) {
                // Ak nie je zvýraznený žiadny riadok, správame sa štandardne - pridáme novú udalosť
                addMatchEvent(newType, newTeam, newSubType, newPlayer);
                return;
            }
            
            try {
                const eventRef = doc(window.db, 'matchEvents', highlightedEventId);
                
                // Získame aktuálnu udalosť
                const eventSnap = await getDoc(eventRef);
                if (!eventSnap.exists()) {
                    window.showGlobalNotification('Zvýraznená udalosť už neexistuje', 'error');
                    setHighlightedEventId(null);
                    // Skúsime pridať novú udalosť
                    addMatchEvent(newType, newTeam, newSubType, newPlayer);
                    return;
                }
                
                const currentEvent = eventSnap.data();
                
                // Výpočet nového stavu skóre
                let homeScoreAfter = matchScore.home;
                let awayScoreAfter = matchScore.away;
                
                // Odstránime starý vplyv na skóre (ak to bola gólová udalosť)
                if (currentEvent.type === 'goal' || (currentEvent.type === 'penalty' && currentEvent.subType === 'scored')) {
                    if (currentEvent.team === 'home') {
                        homeScoreAfter--;
                    } else if (currentEvent.team === 'away') {
                        awayScoreAfter--;
                    }
                }
                
                // Pridáme nový vplyv na skóre (ak je to gólová udalosť)
                if (newType === 'goal' || (newType === 'penalty' && newSubType === 'scored')) {
                    if (newTeam === 'home') {
                        homeScoreAfter++;
                    } else if (newTeam === 'away') {
                        awayScoreAfter++;
                    }
                }
                
                // Aktuálny čas v sekundách
                const totalSeconds = matchTime;
                const minute = Math.floor(totalSeconds / 60);
                const second = totalSeconds % 60;
                
                const eventData = {
                    type: newType,
                    team: newTeam,
                    minute: minute,
                    second: second,
                    formattedTime: `${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`,
                    editedAt: Timestamp.now(),
                    editedBy: userProfileData?.email || 'unknown',
                    // Uložíme nový stav
                    scoreBefore: {
                        home: matchScore.home,
                        away: matchScore.away
                    },
                    scoreAfter: {
                        home: homeScoreAfter,
                        away: awayScoreAfter
                    }
                };
                
                if (newType === 'penalty') {
                    eventData.subType = newSubType;
                } else {
                    eventData.subType = null;
                }
                
                if (newPlayer) {
                    const teamDetails = newTeam === 'home' ? homeTeamDetails : awayTeamDetails;
                    const teamIdentifier = newTeam === 'home' ? selectedMatch.homeTeamIdentifier : selectedMatch.awayTeamIdentifier;
                    
                    let playerRef = null;
                    
                    if (newPlayer.isStaff) {
                        playerRef = createPlayerReference(
                            teamDetails,
                            teamIdentifier,
                            newPlayer,
                            true,
                            newPlayer.staffType,
                            newPlayer.staffIndex
                        );
                    } else {
                        playerRef = createPlayerReference(
                            teamDetails,
                            teamIdentifier,
                            newPlayer,
                            false
                        );
                    }
                    
                    if (playerRef) {
                        eventData.playerRef = playerRef;
                    }
                    
                    if (newType === 'yellow' || newType === 'red' || newType === 'blue' || newType === 'exclusion') {
                        eventData.cardType = newType === 'exclusion' ? 'exclusion' : newType;
                    }
                } else {
                    eventData.playerRef = null;
                }
                
                await updateDoc(eventRef, eventData);
                await recalculateScores();
                
                window.showGlobalNotification('Udalosť bola aktualizovaná', 'success');
                
                // Zrušíme zvýraznenie po úspešnej aktualizácii
                setHighlightedEventId(null);
        
                // Resetujeme stavy tlačidiel
                setSelectedPlayerForEvent(null);
                setEventType(null);
                setEventTeam(null);
                setEventSubType(null);
                
            } catch (error) {
                console.error('Chyba pri aktualizácii udalosti:', error);
                window.showGlobalNotification('Chyba pri aktualizácii udalosti', 'error');
            }
        };

        // Upravte funkciu addMatchEvent, aby používala updateHighlightedEvent ak je zvýraznený riadok
        const addMatchEvent = async (localEventType, localEventTeam, localEventSubType, localPlayer) => {
            if (!selectedMatch || !window.db) return;
            
            // Použijeme lokálne parametre alebo stavové premenné
            const type = localEventType;
            const team = localEventTeam;
            const subType = localEventSubType;
            const player = localPlayer;
            
            if (!type || !team) {
                window.showGlobalNotification('Vyberte typ udalosti a tím', 'error');
                return;
            }
        
            // Pre penalty potrebujeme aj subType
            if (type === 'penalty' && !subType) {
                window.showGlobalNotification('Vyberte typ penalty (premenená/nepremenená)', 'error');
                return;
            }
        
            // Pre gól a vylúčenie potrebujeme vybraného hráča
            if ((type === 'goal' || type === 'exclusion') && !player) {
                window.showGlobalNotification('Vyberte hráča', 'error');
                return;
            }
            
            // Pre penalty potrebujeme vybraného hráča
            if (type === 'penalty' && !player) {
                window.showGlobalNotification('Vyberte hráča pre 7m hod', 'error');
                return;
            }
            
            // AK JE ZVÝRAZNENÝ RIADOK - aktualizujeme existujúcu udalosť
            if (highlightedEventId) {
                await updateHighlightedEvent(type, team, subType, player);
                return;
            }
            
            // Inak pokračujeme s pôvodnou logikou pre pridanie novej udalosti
            try {
                const eventsRef = collection(window.db, 'matchEvents');
                
                // Výpočet minúty a sekundy z celkového času v sekundách
                const totalSeconds = matchTime;
                const minute = Math.floor(totalSeconds / 60);
                const second = totalSeconds % 60;
                
                // Formátovaný čas pre zobrazenie MM:SS
                const formattedTime = `${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`;
                
                // Výpočet stavu pred gólom
                let homeScoreBefore = matchScore.home;
                let awayScoreBefore = matchScore.away;
                let homeScoreAfter = matchScore.home;
                let awayScoreAfter = matchScore.away;
                
                // Ak ide o gól alebo premenenú penaltu, aktualizujeme skóre
                if (type === 'goal') {
                    // Normálny gól
                    if (team === 'home') {
                        homeScoreAfter = homeScoreBefore + 1;
                    } else if (team === 'away') {
                        awayScoreAfter = awayScoreBefore + 1;
                    }
                } else if (type === 'penalty' && subType === 'scored') {
                    // Premenený 7m
                    if (team === 'home') {
                        homeScoreAfter = homeScoreBefore + 1;
                    } else if (team === 'away') {
                        awayScoreAfter = awayScoreBefore + 1;
                    }
                }
                
                const eventData = {
                    matchId: selectedMatch.id,
                    type: type,
                    team: team,
                    minute: minute,
                    second: second,
                    formattedTime: formattedTime,
                    timestamp: Timestamp.now(),
                    createdBy: userProfileData?.email || 'unknown',
                    createdByUid: userProfileData?.uid || null,
                    // Uloženie stavu
                    scoreBefore: {
                        home: homeScoreBefore,
                        away: awayScoreBefore
                    },
                    scoreAfter: {
                        home: homeScoreAfter,
                        away: awayScoreAfter
                    }
                };
        
                if (player) {
                    // Získame detail tímu podľa identifikátora
                    const teamDetails = team === 'home' ? homeTeamDetails : awayTeamDetails;
                    const teamIdentifier = team === 'home' ? selectedMatch.homeTeamIdentifier : selectedMatch.awayTeamIdentifier;
                    
                    let playerRef = null;
                    
                    if (player.isStaff) {
                        // Pre člena realizačného tímu
                        playerRef = createPlayerReference(
                            teamDetails, 
                            teamIdentifier, 
                            player, 
                            true, 
                            player.staffType, 
                            player.staffIndex
                        );
                    } else {
                        // Pre hráča
                        playerRef = createPlayerReference(
                            teamDetails, 
                            teamIdentifier, 
                            player, 
                            false
                        );
                    }
                    
                    if (playerRef) {
                        eventData.playerRef = playerRef;
                    }
                    
                    if (type === 'yellow' || type === 'red' || type === 'blue' || type === 'exclusion') {
                        eventData.cardType = type === 'exclusion' ? 'exclusion' : type;
                    }
                }
        
                // Pre penalty ukladáme subType
                if (type === 'penalty') {
                    eventData.subType = subType;
                }
        
                await addDoc(eventsRef, eventData);
                await recalculateScores();
                
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

        // Funkcia pre zobrazenie hráčov (UPRAVENÁ - sekcia Ostatní sa zobrazuje vždy, ale bez klikania v režimoch in-progress/completed)
        const renderPlayersSection = (teamDetails, teamType, teamName) => {
            // Ak nie sú detaily tímu, zobrazíme "Nedostupné" a ukončíme
            if (!teamDetails) {
                return React.createElement(
                    'div',
                    null,
                    React.createElement(
                        'h4',
                        { className: 'font-semibold text-sm text-gray-700 mb-2 flex items-center gap-1' },
                        React.createElement('i', { className: 'fa-solid fa-users text-xs text-gray-500' }),
                        `Hráči (0)`
                    ),
                    React.createElement(
                        'div',
                        { className: 'text-sm text-gray-500 italic p-2' },
                        'Nedostupné'
                    )
                );
            }
            
            // Získame aktívnych hráčov (ktorí nie sú odstránení pre tento zápas)
            const activePlayers = teamDetails?.team.playerDetails?.filter(p => p && !p.removedForMatch) || [];
            
            // Získame odstránených hráčov pre tento zápas
            const removedPlayers = teamDetails?.team.matchSpecificRemovals?.[selectedMatch.id]?.removedPlayersForMatch || [];
            
            // Získame odstránených členov RT pre tento zápas
            const removedStaff = teamDetails?.team.matchSpecificRemovals?.[selectedMatch.id]?.removedStaff || [];
            
            // Získame AKTÍVNYCH členov RT (ktorí NIE sú odstránení pre tento zápas)
            const activeMenStaff = teamDetails?.team.menTeamMemberDetails?.filter(m => !m.removedForMatch?.[selectedMatch.id]) || [];
            const activeWomenStaff = teamDetails?.team.womenTeamMemberDetails?.filter(m => !m.removedForMatch?.[selectedMatch.id]) || [];
            
            // Získame odstránených členov RT podľa typu
            const removedMenStaff = removedStaff.filter(s => s.staffType === 'men');
            const removedWomenStaff = removedStaff.filter(s => s.staffType === 'women');
            
            // Celkový počet odstránených
            const totalRemoved = removedPlayers.length + removedMenStaff.length + removedWomenStaff.length;
            
            // Zistíme, či je zápas ukončený alebo prebieha
            const isMatchCompleted = selectedMatch?.status === 'completed';
            const isMatchInProgress = selectedMatch?.status === 'in-progress' || selectedMatch?.status === 'paused';
            const isMatchScheduled = selectedMatch?.status === 'scheduled';
            
            // Zistíme, či sa má sekcia "Ostatní" zobraziť (vždy, ak je aspoň jeden odstránený člen)
            const showRemovedSection = totalRemoved > 0;
            
            return React.createElement(
                'div',
                null,
                // Nadpis sekcie Hráči
                React.createElement(
                    'h4',
                    { className: 'font-semibold text-sm text-gray-700 mb-2 flex items-center gap-1' },
                    React.createElement('i', { className: 'fa-solid fa-users text-xs text-gray-500' }),
                    `Hráči (${activePlayers.length})`
                ),

                showPlayerStats && React.createElement(
                    'div',
                    { className: 'grid grid-cols-12 gap-1 mb-2 px-2 text-xs font-semibold text-gray-600 bg-gray-100 py-2 rounded' },
                    React.createElement('div', { className: 'col-span-5 text-left' }, 'Meno'),
                    React.createElement('div', { className: 'col-span-1 text-center' }, 'G'),
                    React.createElement('div', { className: 'col-span-2 text-center' }, '7m'),
                    React.createElement('div', { className: 'col-span-1 text-center' }, 'ŽK'),
                    React.createElement('div', { className: 'col-span-1 text-center' }, 'ČK'),
                    React.createElement('div', { className: 'col-span-1 text-center' }, 'MK'),
                    React.createElement('div', { className: 'col-span-1 text-center' }, '2\'')
                ),
                
                // Zoznam aktívnych hráčov
                teamDetails ? React.createElement(
                    'div',
                    { className: showPlayerStats ? 'space-y-1' : 'space-y-1' },
                    activePlayers.length > 0 ? 
                        [...activePlayers]
                            .sort((a, b) => {
                                const numA = a.jerseyNumber ? parseInt(a.jerseyNumber) || 999 : 999;
                                const numB = b.jerseyNumber ? parseInt(b.jerseyNumber) || 999 : 999;
                                return numA - numB;
                            })
                            .map((player, idx) => {
                                const playerIdentifier = {
                                    userId: teamDetails.userId,
                                    teamIdentifier: teamType === 'home' ? selectedMatch.homeTeamIdentifier : selectedMatch.awayTeamIdentifier,
                                    displayName: `${player.lastName} ${player.firstName}${player.jerseyNumber ? ` (#${player.jerseyNumber})` : ''}`,
                                    index: activePlayers.indexOf(player),
                                    isStaff: false
                                };
                                
                                // Štatistiky pre režim zobrazenia štatistík
                                const stats = showPlayerStats ? getPlayerStats(playerIdentifier) : null;
                                
                                // Určenie onClick správania podľa stavu zápasu
                                let onClickHandler = undefined;
                                let cursorClass = '';
                                
                                if (isMatchCompleted) {
                                    // Ukončený zápas - žiadne kliknutie, vyblednutý vzhľad
                                    cursorClass = 'opacity-50 cursor-not-allowed';
                                } else if (isMatchScheduled) {
                                    // Naplánovaný zápas - úprava hráča
                                    onClickHandler = () => openEditPlayerModal(player, teamType, teamDetails, false);
                                    cursorClass = 'hover:bg-blue-50 cursor-pointer';
                                } else if (isMatchActionAllowed()) {
                                    // Prebiehajúci zápas - pridanie udalosti
                                    onClickHandler = () => {
                                        if (eventType) {
                                            // ULOŽÍME SI AKTUALNE HODNOTY DO LOKÁLNYCH PREMENNÝCH
                                            const currentEventType = eventType;
                                            const currentEventSubType = eventSubType;
                                            const currentEventTeam = teamType;
                                            
                                            // OKAMŽITE VYMAŽEME VYBRANÚ AKCIU (ešte pred zápisom do DB)
                                            setEventType(null);
                                            setEventTeam(null);
                                            setEventSubType(null);
                                            setSelectedPlayerForEvent(null);
        
                                            // TERAZ VYVOLÁME PRIDANIE UDALOSTI S ULOŽENÝMI HODNOTAMI
                                            if (currentEventType === 'goal' && currentEventSubType === null) {
                                                addMatchEvent('goal', currentEventTeam, null, playerIdentifier);
                                            } else if (currentEventType === 'penalty' && currentEventSubType === 'scored') {
                                                addMatchEvent('penalty', currentEventTeam, 'scored', playerIdentifier);
                                            } else if (currentEventType === 'penalty' && currentEventSubType === 'missed') {
                                                addMatchEvent('penalty', currentEventTeam, 'missed', playerIdentifier);
                                            } else {
                                                addMatchEvent(currentEventType, currentEventTeam, null, playerIdentifier);
                                            }
                                        }
                                    };
                                    cursorClass = 'hover:bg-blue-50 cursor-pointer';
                                } else {
                                    cursorClass = 'cursor-not-allowed opacity-60';
                                }
                                
                                // Režim štatistík vs normálny režim
                                if (showPlayerStats) {
                                    return React.createElement(
                                        'div',
                                        { 
                                            key: `${teamType}-player-${idx}`, 
                                            className: `grid grid-cols-12 gap-1 p-2 rounded border border-gray-200 text-sm group relative transition-colors ${cursorClass}`,
                                            onClick: onClickHandler,
                                            title: isMatchCompleted ? 'Zápas je ukončený' : (isMatchScheduled ? 'Kliknite pre úpravu hráča' : '')
                                        },
                                        React.createElement(
                                            'div',
                                            { className: 'col-span-5 flex items-center gap-2 truncate' },
                                            React.createElement('i', { className: 'fa-solid fa-shirt text-gray-600 text-xs flex-shrink-0' }),
                                            player.jerseyNumber && React.createElement(
                                                'span',
                                                { className: 'font-bold text-gray-700 text-xs bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0' },
                                                `${player.jerseyNumber}`
                                            ),
                                            React.createElement(
                                                'span',
                                                { className: 'font-medium truncate' },
                                                `${player.lastName} ${player.firstName}`
                                            )
                                        ),
                                        React.createElement('div', { className: 'col-span-1 text-center font-bold text-green-600' }, (stats?.goals || 0) + (stats?.penaltiesScored || 0)),
                                        React.createElement('div', { className: 'col-span-2 text-center font-bold text-blue-600' }, `${stats?.penaltiesScored || 0}/${(stats?.penaltiesScored || 0) + (stats?.penaltiesMissed || 0)}`),
                                        React.createElement('div', { className: 'col-span-1 text-center font-bold text-yellow-600' }, stats?.yellowCards || 0),
                                        React.createElement('div', { className: 'col-span-1 text-center font-bold text-red-600' }, stats?.redCards || 0),
                                        React.createElement('div', { className: 'col-span-1 text-center font-bold text-blue-800' }, stats?.blueCards || 0),
                                        React.createElement('div', { className: 'col-span-1 text-center font-bold text-orange-600' }, stats?.exclusions || 0)
                                    );
                                } else {
                                    return React.createElement(
                                        'div',
                                        { 
                                            key: `${teamType}-player-${idx}`, 
                                            className: `flex items-center justify-between gap-2 p-2 rounded border border-gray-200 text-sm group relative transition-colors ${cursorClass}`,
                                            onClick: onClickHandler,
                                            title: isMatchCompleted ? 'Zápas je ukončený' : (!isMatchActionAllowed() && !isMatchScheduled ? 'Zápas je ukončený' : '')
                                        },
                                        React.createElement(
                                            'div',
                                            { className: 'flex items-center gap-2' },
                                            React.createElement('i', { className: 'fa-solid fa-shirt text-gray-600 text-xs flex-shrink-0' }),
                                            player.jerseyNumber && React.createElement(
                                                'span',
                                                { className: 'font-bold text-gray-700 text-xs bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0' },
                                                `${player.jerseyNumber}`
                                            ),
                                            React.createElement(
                                                'span',
                                                { className: 'font-medium truncate' },
                                                `${player.lastName} ${player.firstName}`
                                            )
                                        ),
                                        isMatchScheduled && React.createElement(
                                            'i',
                                            { className: 'fa-solid fa-pencil text-xs text-gray-400' }
                                        )
                                    );
                                }
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
                ),
                
                // SEKcia Ostatní - zobrazí sa vždy, keď je aspoň jeden odstránený člen
                // (pre všetky stavy zápasu: scheduled, in-progress, paused, completed)
                showRemovedSection && React.createElement(
                    'div',
                    { className: 'mt-4 pt-3 border-t border-gray-200' },
                    React.createElement(
                        'h4',
                        { className: 'font-semibold text-sm text-gray-700 mb-2 flex items-center gap-1' },
                        React.createElement('i', { className: 'fa-solid fa-user-slash text-xs text-gray-500' }),
                        `Ostatní (${totalRemoved})`
                    ),
                    React.createElement(
                        'div',
                        { className: 'space-y-1' },
                        // Odstránení hráči - bez klikania v režimoch in-progress a completed
                        [...removedPlayers]
                            .sort((a, b) => {
                                const numA = a.jerseyNumber ? parseInt(a.jerseyNumber) || 999 : 999;
                                const numB = b.jerseyNumber ? parseInt(b.jerseyNumber) || 999 : 999;
                                return numA - numB;
                            })
                            .map((player, idx) => {
                                // Určenie správania pre položky v sekcii "Ostatní"
                                let onClickHandler = undefined;
                                let cursorClass = 'cursor-not-allowed opacity-60';
                                let hoverClass = '';
                                let titleText = '';
                                
                                if (isMatchScheduled) {
                                    // Len pri naplánovanom zápase je možné obnoviť hráča
                                    onClickHandler = () => restorePlayerToRoster(player, teamType, teamDetails);
                                    cursorClass = 'cursor-pointer';
                                    hoverClass = 'hover:bg-blue-50';
                                    titleText = '';
                                } else if (isMatchInProgress || isMatchCompleted) {
                                    // Pri prebiehajúcom alebo ukončenom zápase - žiadne kliknutie, iba zobrazenie
                                    onClickHandler = undefined;
                                    cursorClass = 'cursor-not-allowed';
                                    hoverClass = '';
                                    titleText = '';
                                }
                                
                                return React.createElement(
                                    'div',
                                    { 
                                        key: `${teamType}-removed-player-${idx}`, 
                                        className: `flex items-center justify-between gap-2 p-2 rounded border border-gray-200 bg-gray-50 text-sm group relative transition-colors ${cursorClass} ${hoverClass}`,
                                        onClick: onClickHandler,
                                        title: titleText
                                    },
                                    React.createElement(
                                        'div',
                                        { className: 'flex items-center gap-2' },
                                        React.createElement('i', { className: 'fa-solid fa-shirt text-gray-400 text-xs flex-shrink-0' }),
                                        player.jerseyNumber && React.createElement(
                                            'span',
                                            { className: 'font-bold text-gray-500 text-xs bg-gray-200 px-1.5 py-0.5 rounded flex-shrink-0' },
                                            `${player.jerseyNumber}`
                                        ),
                                        React.createElement(
                                            'span',
                                            { className: `font-medium ${isMatchScheduled ? 'text-gray-700' : 'text-gray-400'}` },
                                            `${player.lastName} ${player.firstName}`
                                        )
                                    ),
                                    // Ikona obnovenia sa zobrazí len pri naplánovanom zápase
                                    isMatchScheduled && React.createElement(
                                        'i',
                                        { className: 'fa-solid fa-undo text-xs text-green-500' }
                                    )
                                );
                            }),
                        // Odstránení členovia RT (muži) - bez klikania v režimoch in-progress a completed
                        removedMenStaff.map((member, idx) => {
                            let onClickHandler = undefined;
                            let cursorClass = 'cursor-not-allowed opacity-60';
                            let hoverClass = '';
                            let titleText = '';
                            
                            if (isMatchScheduled) {
                                onClickHandler = () => restoreStaffToRoster(member, teamType, teamDetails, 'men');
                                cursorClass = 'cursor-pointer';
                                hoverClass = 'hover:bg-blue-50';
                                titleText = '';
                            } else if (isMatchInProgress || isMatchCompleted) {
                                onClickHandler = undefined;
                                cursorClass = 'cursor-not-allowed';
                                hoverClass = '';
                                titleText = '';
                            }
                            
                            return React.createElement(
                                'div',
                                { 
                                    key: `${teamType}-removed-men-${idx}`, 
                                    className: `flex items-center justify-between gap-2 p-2 rounded border border-gray-200 bg-gray-50 text-sm group relative transition-colors ${cursorClass} ${hoverClass}`,
                                    onClick: onClickHandler,
                                    title: titleText
                                },
                                React.createElement(
                                    'div',
                                    { className: 'flex items-center gap-2' },
                                    React.createElement('i', { className: 'fa-solid fa-user text-gray-400 text-xs flex-shrink-0' }),
                                    React.createElement(
                                        'span',
                                        { className: `font-medium ${isMatchScheduled ? 'text-gray-700' : 'text-gray-400'}` },
                                        `${member.lastName} ${member.firstName}`
                                    )
                                ),
                                isMatchScheduled && React.createElement(
                                    'i',
                                    { className: 'fa-solid fa-undo text-xs text-green-500' }
                                )
                            );
                        }),
                        // Odstránení členovia RT (ženy) - bez klikania v režimoch in-progress a completed
                        removedWomenStaff.map((member, idx) => {
                            let onClickHandler = undefined;
                            let cursorClass = 'cursor-not-allowed opacity-60';
                            let hoverClass = '';
                            let titleText = '';
                            
                            if (isMatchScheduled) {
                                onClickHandler = () => restoreStaffToRoster(member, teamType, teamDetails, 'women');
                                cursorClass = 'cursor-pointer';
                                hoverClass = 'hover:bg-blue-50';
                                titleText = '';
                            } else if (isMatchInProgress || isMatchCompleted) {
                                onClickHandler = undefined;
                                cursorClass = 'cursor-not-allowed';
                                hoverClass = '';
                                titleText = '';
                            }
                            
                            return React.createElement(
                                'div',
                                { 
                                    key: `${teamType}-removed-women-${idx}`, 
                                    className: `flex items-center justify-between gap-2 p-2 rounded border border-gray-200 bg-gray-50 text-sm group relative transition-colors ${cursorClass} ${hoverClass}`,
                                    onClick: onClickHandler,
                                    title: titleText
                                },
                                React.createElement(
                                    'div',
                                    { className: 'flex items-center gap-2' },
                                    React.createElement('i', { className: 'fa-solid fa-user text-pink-400 text-xs flex-shrink-0' }),
                                    React.createElement(
                                        'span',
                                        { className: `font-medium ${isMatchScheduled ? 'text-gray-700' : 'text-gray-400'}` },
                                        `${member.lastName} ${member.firstName}`
                                    )
                                ),
                                isMatchScheduled && React.createElement(
                                    'i',
                                    { className: 'fa-solid fa-undo text-xs text-green-500' }
                                )
                            );
                        })
                    )
                )
            );
        };
        
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

        const floatingScoreBox = (selectedMatch.status === 'in-progress' || selectedMatch.status === 'paused') && showFloatingScore && React.createElement(
            'div',
            { className: `floating-score-box ${showFloatingScore ? 'visible' : ''}` },
            React.createElement('span', { className: 'team-name', title: homeTeamName }, homeTeamName),
            React.createElement('span', { className: 'score' }, loadingEvents ? '...' : `${matchScore.home}`),
            React.createElement('span', { className: 'vs' }, ':'),
            React.createElement('span', { className: 'score' }, loadingEvents ? '...' : `${matchScore.away}`),
            React.createElement('span', { className: 'team-name', title: awayTeamName }, awayTeamName),
            React.createElement('div', { className: 'separator' }),
            React.createElement('span', { className: 'match-time' }, formatMatchTime(cleanPlayingTime || 0))
        );
    
        // ✅ HLAVNÝ OBSAH - vykreslenie detailu zápasu
        const mainContent = React.createElement(
            React.Fragment,
            null,
            floatingScoreBox,
            React.createElement(
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
                                ),
                                // NOVÁ ČASŤ: Informácia o perióde
                                category && React.createElement(
                                    'div',
                                    { className: 'mt-2 text-sm text-gray-600 flex items-center justify-center gap-2' },
                                    React.createElement('span', null, `${category.periods || 2} x ${category.periodDuration || 20} min`),
                                    // Zobrazenie prestávky len ak je definovaná a väčšia ako 0
                                    (() => {
                                        const breakDur = category.breakDuration;
                                        const breakNum = typeof breakDur === 'number' ? breakDur : parseInt(breakDur, 10);
                                        if (breakDur && !isNaN(breakNum) && breakNum > 0) {
                                            return React.createElement(
                                                React.Fragment,
                                                null,
                                                React.createElement('span', { className: 'text-gray-400' }, '•'),
                                                React.createElement('span', null, `Prestávka: ${breakDur} min`)
                                            );
                                        }
                                        return null;
                                    })()
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
        //                            React.createElement('div', { className: 'text-sm text-gray-500 mb-2' }, 'DOMÁCI'),
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
        //                            React.createElement('div', { className: 'text-sm text-gray-500 mb-2' }, 'HOSTIA'),
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
                                
                                // PRIEBEH ČASU (nový prvok)
                                (selectedMatch.status === 'in-progress' || selectedMatch.status === 'paused') && category && React.createElement(
                                    'div',
                                    { className: 'text-center mb-4 p-3 bg-white rounded-lg border border-gray-200' },
                                    React.createElement('div', { className: 'text-xs text-gray-500 mb-1' }, 'Priebeh času'),
                                    React.createElement(
                                        'div',
                                        { className: 'text-3xl font-mono font-bold' },
                                        formatMatchTime(cleanPlayingTime || 0)
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
                                                className: `px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                                                    isResumeAllowed()
                                                        ? 'bg-green-600 hover:bg-green-700 text-white' 
                                                        : 'bg-white text-green-600 border-2 border-green-600 cursor-not-allowed'
                                                }`,
                                                onClick: isResumeAllowed() ? () => resumeMatchTimer(selectedMatch.id) : undefined,
                                                disabled: !isResumeAllowed(),
                                                title: isResumeAllowed() ? 'Pokračovať v zápase' : selectedMatch.status === 'completed' ? 'Zápas je ukončený' : 'Nie je možné pokračovať - koniec periódy'
                                            },
                                            React.createElement('i', { className: 'fa-solid fa-play' }),
                                            'Pokračovať'
                                        ) :
                                        React.createElement(
                                            'button',
                                            {
                                                className: `px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                                                    isStartTimerAllowed()
                                                        ? 'bg-green-600 hover:bg-green-700 text-white' 
                                                        : 'bg-white text-green-600 border-2 border-green-600 cursor-not-allowed'
                                                }`,
                                                onClick: isStartTimerAllowed() ? () => startMatchTimer(selectedMatch.id) : undefined,
                                                disabled: !isStartTimerAllowed(),
                                                title: isStartTimerAllowed() ? 'Spustiť čas zápasu' : 'Zápas už prebieha alebo je ukončený'
                                            },
                                            React.createElement('i', { className: 'fa-solid fa-play' }),
                                            'Čas štart'
                                        ),
                                    
                                    // Manuálne ovládanie času
                                    React.createElement(
                                        'div',
                                        { className: 'flex items-center gap-1 bg-gray-100 rounded-lg p-1' },
                                        React.createElement(
                                            'button',
                                            {
                                                className: `w-8 h-8 rounded flex items-center justify-center text-sm font-bold transition-colors ${
                                                    isSubtractMinuteAllowed()
                                                        ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                                                        : 'bg-white text-blue-500 border-2 border-blue-500 cursor-not-allowed'
                                                }`,
                                                onClick: isSubtractMinuteAllowed() ? subtractMinute : undefined,
                                                disabled: !isSubtractMinuteAllowed(),
                                                title: isSubtractMinuteAllowed() ? 'Odčítať minútu' : 'Nie je možné odčítať minútu - sme na začiatku periódy'
                                            },
                                            React.createElement('i', { className: 'fa-solid fa-minus' })
                                        ),
                                        React.createElement(
                                            'span',
                                            { className: 'px-2 text-sm font-medium text-gray-700' },
                                            'min'
                                        ),
                                        React.createElement(
                                            'button',
                                            {
                                                className: `w-8 h-8 rounded flex items-center justify-center text-sm font-bold transition-colors ${
                                                    isAddMinuteAllowed()
                                                        ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                                                        : 'bg-white text-blue-500 border-2 border-blue-500 cursor-not-allowed'
                                                }`,
                                                onClick: isAddMinuteAllowed() ? addMinute : undefined,
                                                disabled: !isAddMinuteAllowed(),
                                                title: isAddMinuteAllowed() ? 'Pridať minútu' : 'Nie je možné pridať minútu - koniec periódy'
                                            },
                                            React.createElement('i', { className: 'fa-solid fa-plus' })
                                        )
                                    ),
                                    
                                    React.createElement(
                                        'div',
                                        { className: 'flex items-center gap-1 bg-gray-100 rounded-lg p-1' },
                                        React.createElement(
                                            'button',
                                            {
                                                className: `w-8 h-8 rounded flex items-center justify-center text-sm font-bold transition-colors ${
                                                    isSubtractSecondAllowed()
                                                        ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                                                        : 'bg-white text-blue-500 border-2 border-blue-500 cursor-not-allowed'
                                                }`,
                                                onClick: isSubtractSecondAllowed() ? subtractSecond : undefined,
                                                disabled: !isSubtractSecondAllowed(),
                                                title: isSubtractSecondAllowed() ? 'Odčítať sekundu' : 'Nie je možné odčítať sekundu - sme na začiatku periódy'
                                            },
                                            React.createElement('i', { className: 'fa-solid fa-minus' })
                                        ),
                                        React.createElement(
                                            'span',
                                            { className: 'px-2 text-sm font-medium text-gray-700' },
                                            'sec'
                                        ),
                                        React.createElement(
                                            'button',
                                            {
                                                className: `w-8 h-8 rounded flex items-center justify-center text-sm font-bold transition-colors ${
                                                    isAddSecondAllowed()
                                                        ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                                                        : 'bg-white text-blue-500 border-2 border-blue-500 cursor-not-allowed'
                                                }`,
                                                onClick: isAddSecondAllowed() ? addSecond : undefined,
                                                disabled: !isAddSecondAllowed(),
                                                title: isAddSecondAllowed() ? 'Pridať sekundu' : 'Nie je možné pridať sekundu - koniec periódy'
                                            },
                                            React.createElement('i', { className: 'fa-solid fa-plus' })
                                        )
                                    ),
                                    
                                    // Perióda +/- (ak má kategória viac ako 1 periódu)
                                    category && category.periods > 1 && React.createElement(
                                        'div',
                                        { className: 'flex items-center gap-1 bg-gray-100 rounded-lg p-1' },
                                        React.createElement(
                                            'button',
                                            {
                                                className: `w-8 h-8 rounded flex items-center justify-center text-sm font-bold transition-colors ${
                                                    isDecreasePeriodAllowed()
                                                        ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                                                        : 'bg-white text-blue-500 border-2 border-blue-500 cursor-not-allowed'
                                                }`,
                                                onClick: isDecreasePeriodAllowed() ? () => decreasePeriod(selectedMatch.id) : undefined,
                                                disabled: !isDecreasePeriodAllowed(),
                                                title: isDecreasePeriodAllowed() ? 'Znížiť periódu' : 'Prvá perióda'
                                            },
                                            React.createElement('i', { className: 'fa-solid fa-minus' })
                                        ),
                                        React.createElement(
                                            'span',
                                            { className: 'px-2 text-sm font-medium text-gray-700' },
                                            `${selectedMatch.currentPeriod || 1} / ${category.periods}`
                                        ),
                                        React.createElement(
                                            'button',
                                            {
                                                className: `w-8 h-8 rounded flex items-center justify-center text-sm font-bold transition-colors ${
                                                    isIncreasePeriodAllowed()
                                                        ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                                                        : 'bg-white text-blue-500 border-2 border-blue-500 cursor-not-allowed'
                                                }`,
                                                onClick: isIncreasePeriodAllowed() ? () => increasePeriod(selectedMatch.id, category.periods) : undefined,
                                                disabled: !isIncreasePeriodAllowed(),
                                                title: isIncreasePeriodAllowed() ? 'Zvýšiť periódu' : 'Posledná perióda'
                                            },
                                            React.createElement('i', { className: 'fa-solid fa-plus' })
                                        )
                                    ),
                                    
                                    // Reset zápasu (vždy zobrazený)
                                    React.createElement(
                                        'button',
                                        {
                                            className: 'px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                                            onClick: () => openResetModal(selectedMatch.id)
                                        },
                                        React.createElement('i', { className: 'fa-solid fa-rotate-right' }),
                                        'Reset'
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
                                    ),
                
                                    React.createElement(
                                        'button',
                                        {
                                            className: `px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                                                showPlayerStats 
                                                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                                                    : 'bg-white text-blue-600 border-2 border-blue-600 hover:bg-blue-50'
                                            }`,
                                            onClick: togglePlayerStats,
                                            title: showPlayerStats ? 'Skryť štatistiky' : 'Zobraziť štatistiky'
                                        },
                                        React.createElement('i', { className: 'fa-solid fa-chart-simple' }),
                                        'Štatistiky'
                                    )
                                )
                            ),
                            
                            // DETAILY TÍMOV - realizačný tím, hráči a priebeh zápasu
                            React.createElement(
                                'div',
                                { className: `transition-all duration-300` },
                                
                                // Keď nie sú štatistiky - grid so 4 stĺpcami (domáci, priebeh, hosťovský, prázdny)
                                !showPlayerStats ? React.createElement(
                                    'div',
                                    { className: 'grid grid-cols-4 gap-6' },
                                    
                                    // Domáci tím - detail
                                    React.createElement(
                                        'div',
                                        { className: 'bg-gray-50 rounded-lg p-4 border border-gray-200' },
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
        
                                                // Muži v realizačnom tíme pre domáci tím (normálny režim)
                                                activeMenStaffHome.length > 0 && 
                                                React.createElement(
                                                    React.Fragment,
                                                    null,
                                                    activeMenStaffHome.map((member, idx) => {
                                                        const staffIdentifier = {
                                                            userId: homeTeamDetails.userId,
                                                            teamIdentifier: selectedMatch.homeTeamIdentifier,
                                                            displayName: `${member.lastName} ${member.firstName} (tréner)`,
                                                            isStaff: true,
                                                            staffType: 'men',
                                                            staffIndex: idx
                                                        };
                                                        
                                                        let onClickHandler = undefined;
                                                        let cursorClass = '';
                                                        
                                                        if (selectedMatch?.status === 'scheduled') {
                                                            onClickHandler = () => openEditStaffModal(member, 'home', homeTeamDetails, 'men', idx);
                                                            cursorClass = 'hover:bg-blue-50 cursor-pointer';
                                                        } else if (isMatchActionAllowed()) {
                                                            onClickHandler = () => {
                                                                if (eventType) {
                                                                    if (eventType === 'goal' || eventType === 'penalty') {
                                                                        window.showGlobalNotification('Gól a 7m hod môžu byť priradené len hráčom', 'error');
                                                                        return;
                                                                    }
                                                                    addMatchEvent(eventType, 'home', null, staffIdentifier);
                                                                }
                                                            };
                                                            cursorClass = 'hover:bg-blue-50 cursor-pointer';
                                                        } else {
                                                            cursorClass = 'cursor-not-allowed opacity-60';
                                                        }
                                                        
                                                        return React.createElement(
                                                            'div',
                                                            { 
                                                                key: `home-men-${idx}`, 
                                                                className: `flex items-center justify-between gap-2 p-2 rounded border border-gray-200 text-sm group relative transition-colors ${cursorClass}`,
                                                                onClick: onClickHandler,
                                                                title: selectedMatch?.status === 'scheduled' ? 'Kliknite pre úpravu' : ''
                                                            },
                                                            React.createElement(
                                                                'div',
                                                                { className: 'flex items-center gap-2' },
                                                                React.createElement('i', { className: 'fa-solid fa-user text-gray-600 text-xs flex-shrink-0' }),
                                                                React.createElement('span', { className: 'font-medium truncate' }, `${member.lastName} ${member.firstName}`)
                                                            ),
                                                            selectedMatch?.status === 'scheduled' && React.createElement(
                                                                'i',
                                                                { className: 'fa-solid fa-pencil text-xs text-gray-400' }
                                                            )
                                                        );
                                                    })
                                                ),
                                                
                                                // Ženy v realizačnom tíme pre domáci tím (normálny režim)
                                                activeWomenStaffHome.length > 0 && 
                                                React.createElement(
                                                    React.Fragment,
                                                    null,
                                                    activeWomenStaffHome.map((member, idx) => {
                                                        const staffIdentifier = {
                                                            userId: homeTeamDetails.userId,
                                                            teamIdentifier: selectedMatch.homeTeamIdentifier,
                                                            displayName: `${member.lastName} ${member.firstName} (trénerka)`,
                                                            isStaff: true,
                                                            staffType: 'women',
                                                            staffIndex: idx
                                                        };
                                                        
                                                        let onClickHandler = undefined;
                                                        let cursorClass = '';
                                                        
                                                        if (selectedMatch?.status === 'scheduled') {
                                                            onClickHandler = () => openEditStaffModal(member, 'home', homeTeamDetails, 'women', idx);
                                                            cursorClass = 'hover:bg-blue-50 cursor-pointer';
                                                        } else if (isMatchActionAllowed()) {
                                                            onClickHandler = () => {
                                                                if (eventType) {
                                                                    if (eventType === 'goal' || eventType === 'penalty') {
                                                                        window.showGlobalNotification('Gól a 7m hod môžu byť priradené len hráčom', 'error');
                                                                        return;
                                                                    }
                                                                    addMatchEvent(eventType, 'home', null, staffIdentifier);
                                                                }
                                                            };
                                                            cursorClass = 'hover:bg-blue-50 cursor-pointer';
                                                        } else {
                                                            cursorClass = 'cursor-not-allowed opacity-60';
                                                        }
                                                        
                                                        return React.createElement(
                                                            'div',
                                                            { 
                                                                key: `home-women-${idx}`, 
                                                                className: `flex items-center justify-between gap-2 p-2 rounded border border-gray-200 text-sm group relative transition-colors ${cursorClass}`,
                                                                onClick: onClickHandler,
                                                                title: selectedMatch?.status === 'scheduled' ? 'Kliknite pre úpravu' : ''
                                                            },
                                                            React.createElement(
                                                                'div',
                                                                { className: 'flex items-center gap-2' },
                                                                React.createElement('i', { className: 'fa-solid fa-user text-pink-600 text-xs flex-shrink-0' }),
                                                                React.createElement('span', { className: 'font-medium truncate' }, `${member.lastName} ${member.firstName}`)
                                                            ),
                                                            selectedMatch?.status === 'scheduled' && React.createElement(
                                                                'i',
                                                                { className: 'fa-solid fa-pencil text-xs text-gray-400' }
                                                            )
                                                        );
                                                    })
                                                ),
                                                
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
                                        
                                        // Hráči pre domáci tím - POUŽITE FUNKCIU renderPlayersSection
                                        renderPlayersSection(homeTeamDetails, 'home', homeTeamName)
                                    ),
                                    
                                    // Box s priebehom zápasu (medzi tímami)
                                    React.createElement(
                                        'div',
                                        { className: 'col-span-2 bg-gray-50 rounded-lg p-4 border border-gray-200 flex flex-col match-progress-section' },
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
                                                selectedMatch?.status === 'completed' ? 'Konečný výsledok' : 'Aktuálne skóre'
                                            )
                                        ),
                                        
                                        // Ovládacie tlačidlá pre adminov a hall users
                                        (userProfileData?.role === 'admin' || userProfileData?.role === 'hall') && React.createElement(
                                            'div',
                                            { className: 'flex flex-wrap gap-2 justify-center mb-4' },
                                            
                                            React.createElement(
                                                'button',
                                                {
                                                    className: `px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 border-2 ${
                                                        !isMatchActionAllowed()
                                                            ? 'bg-white text-green-600 border-green-600 cursor-not-allowed opacity-50'
                                                            : eventType === 'goal' && eventSubType === null
                                                                ? 'bg-green-600 text-white border-green-600'
                                                                : eventType === 'penalty' && eventSubType === 'scored'
                                                                ? 'bg-green-600 text-white border-green-600'
                                                                : 'bg-white text-green-600 border-green-600 hover:bg-green-50'
                                                    }`,
                                                    onClick: isMatchActionAllowed() 
                                                        ? () => {
                                                            if (eventType === 'penalty' && eventSubType === 'missed') {
                                                                setEventType('penalty');
                                                                setEventSubType('scored');
                                                                setEventTeam(null);
                                                                setSelectedPlayerForEvent(null);
                                                            } 
                                                            else if (eventType === 'penalty' && eventSubType === 'scored') {
                                                                setEventType(null);
                                                                setEventTeam(null);
                                                                setEventSubType(null);
                                                                setSelectedPlayerForEvent(null);
                                                            }
                                                            else if (eventType === 'goal' && eventSubType === null) {
                                                                setEventType(null);
                                                                setEventTeam(null);
                                                                setEventSubType(null);
                                                                setSelectedPlayerForEvent(null);
                                                            } 
                                                            else {
                                                                setEventType('goal');
                                                                setEventSubType(null);
                                                                setEventTeam(null);
                                                                setSelectedPlayerForEvent(null);
                                                            }
                                                        }
                                                        : undefined,
                                                    disabled: !isMatchActionAllowed()
                                                },
                                                React.createElement('i', { className: `fa-solid fa-futbol ${
                                                    !isMatchActionAllowed()
                                                        ? 'text-green-600'
                                                        : (eventType === 'goal' && eventSubType === null) || (eventType === 'penalty' && eventSubType === 'scored')
                                                            ? 'text-white' 
                                                            : 'text-green-600'
                                                }` }),
                                                'Gól'
                                            ),
                                            
                                            React.createElement(
                                                'button',
                                                {
                                                    className: `px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 border-2 ${
                                                        !isMatchActionAllowed()
                                                            ? 'bg-white text-blue-600 border-blue-600 cursor-not-allowed opacity-50'
                                                            : eventType === 'penalty' && (eventSubType === 'missed' || eventSubType === 'scored')
                                                                ? 'bg-blue-600 text-white border-blue-600' 
                                                                : 'bg-white text-blue-600 border-blue-600 hover:bg-blue-50'
                                                    }`,
                                                    onClick: isMatchActionAllowed()
                                                        ? () => {
                                                            if (eventType === 'penalty') {
                                                                setEventType(null);
                                                                setEventTeam(null);
                                                                setEventSubType(null);
                                                                setSelectedPlayerForEvent(null);
                                                            } else {
                                                                setEventType('penalty');
                                                                setEventSubType('missed');
                                                                setEventTeam(null);
                                                                setSelectedPlayerForEvent(null);
                                                            }
                                                        }
                                                        : undefined,
                                                    disabled: !isMatchActionAllowed()
                                                },
                                                React.createElement('i', { className: `fa-solid fa-circle-dot ${
                                                    !isMatchActionAllowed()
                                                        ? 'text-blue-600'
                                                        : eventType === 'penalty' ? 'text-white' : 'text-blue-600'
                                                }` }),
                                                '7m'
                                            ),
                                            
                                            React.createElement(
                                                'button',
                                                {
                                                    className: `px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 border-2 ${
                                                        !isMatchActionAllowed()
                                                            ? 'bg-white text-yellow-600 border-yellow-500 cursor-not-allowed opacity-50'
                                                            : eventType === 'yellow' 
                                                                ? 'bg-yellow-500 text-white border-yellow-500' 
                                                                : 'bg-white text-yellow-600 border-yellow-500 hover:bg-yellow-50'
                                                    }`,
                                                    onClick: isMatchActionAllowed()
                                                        ? () => {
                                                            if (eventType === 'yellow') {
                                                                setEventType(null);
                                                                setEventTeam(null);
                                                                setEventSubType(null);
                                                                setSelectedPlayerForEvent(null);
                                                            } else {
                                                                setEventType('yellow');
                                                                setEventSubType(null);
                                                                setEventTeam(null);
                                                                setSelectedPlayerForEvent(null);
                                                            }
                                                        }
                                                        : undefined,
                                                    disabled: !isMatchActionAllowed()
                                                },
                                                React.createElement('i', { className: `fa-solid fa-square ${
                                                    !isMatchActionAllowed()
                                                        ? 'text-yellow-600'
                                                        : eventType === 'yellow' ? 'text-white' : 'text-yellow-600'
                                                }` }),
                                                'ŽK'
                                            ),
                                            
                                            React.createElement(
                                                'button',
                                                {
                                                    className: `px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 border-2 ${
                                                        !isMatchActionAllowed()
                                                            ? 'bg-white text-red-600 border-red-600 cursor-not-allowed opacity-50'
                                                            : eventType === 'red' 
                                                                ? 'bg-red-600 text-white border-red-600' 
                                                                : 'bg-white text-red-600 border-red-600 hover:bg-red-50'
                                                    }`,
                                                    onClick: isMatchActionAllowed()
                                                        ? () => {
                                                            if (eventType === 'red') {
                                                                setEventType(null);
                                                                setEventTeam(null);
                                                                setEventSubType(null);
                                                                setSelectedPlayerForEvent(null);
                                                            } else {
                                                                setEventType('red');
                                                                setEventSubType(null);
                                                                setEventTeam(null);
                                                                setSelectedPlayerForEvent(null);
                                                            }
                                                        }
                                                        : undefined,
                                                    disabled: !isMatchActionAllowed()
                                                },
                                                React.createElement('i', { className: `fa-solid fa-square ${
                                                    !isMatchActionAllowed()
                                                        ? 'text-red-600'
                                                        : eventType === 'red' ? 'text-white' : 'text-red-600'
                                                }` }),
                                                'ČK'
                                            ),
                                            
                                            React.createElement(
                                                'button',
                                                {
                                                    className: `px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 border-2 ${
                                                        !isMatchActionAllowed()
                                                            ? 'bg-white text-blue-800 border-blue-800 cursor-not-allowed opacity-50'
                                                            : eventType === 'blue' 
                                                                ? 'bg-blue-800 text-white border-blue-800' 
                                                                : 'bg-white text-blue-800 border-blue-800 hover:bg-blue-100'
                                                    }`,
                                                    onClick: isMatchActionAllowed()
                                                        ? () => {
                                                            if (eventType === 'blue') {
                                                                setEventType(null);
                                                                setEventTeam(null);
                                                                setEventSubType(null);
                                                                setSelectedPlayerForEvent(null);
                                                            } else {
                                                                setEventType('blue');
                                                                setEventSubType(null);
                                                                setEventTeam(null);
                                                                setSelectedPlayerForEvent(null);
                                                            }
                                                        }
                                                        : undefined,
                                                    disabled: !isMatchActionAllowed()
                                                },
                                                React.createElement('i', { className: `fa-solid fa-square ${
                                                    !isMatchActionAllowed()
                                                        ? 'text-blue-800'
                                                        : eventType === 'blue' ? 'text-white' : 'text-blue-800'
                                                }` }),
                                                'MK'
                                            ),
                                            
                                            React.createElement(
                                                'button',
                                                {
                                                    className: `px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 border-2 ${
                                                        !isMatchActionAllowed()
                                                            ? 'bg-white text-orange-600 border-orange-600 cursor-not-allowed opacity-50'
                                                            : eventType === 'exclusion' 
                                                                ? 'bg-orange-600 text-white border-orange-600' 
                                                                : 'bg-white text-orange-600 border-orange-600 hover:bg-orange-50'
                                                    }`,
                                                    onClick: isMatchActionAllowed()
                                                        ? () => {
                                                            if (eventType === 'exclusion') {
                                                                setEventType(null);
                                                                setEventTeam(null);
                                                                setEventSubType(null);
                                                                setSelectedPlayerForEvent(null);
                                                            } else {
                                                                setEventType('exclusion');
                                                                setEventSubType(null);
                                                                setEventTeam(null);
                                                                setSelectedPlayerForEvent(null);
                                                            }
                                                        }
                                                        : undefined,
                                                    disabled: !isMatchActionAllowed()
                                                },
                                                React.createElement('i', { className: `fa-solid fa-user-slash ${
                                                    !isMatchActionAllowed()
                                                        ? 'text-orange-600'
                                                        : eventType === 'exclusion' ? 'text-white' : 'text-orange-600'
                                                }` }),
                                                'Vylúčenie'
                                            )
                                        ),
                                        
                                        // Zoznam udalostí
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
                                                { className: 'space-y-1' },
                                                
                                                matchEvents.map((event) => {
                                                    const isHighlighted = highlightedEventId === event.id;
                                                    const playerName = event.playerRef ? getPlayerNameFromRef(event.playerRef) : '';
                                                    
                                                    let jerseyNumber = '';
                                                    if (event.playerRef && !event.playerRef.staffType) {
                                                        const user = users.find(u => u.id === event.playerRef.userId);
                                                        if (user) {
                                                            const parts = event.playerRef.teamIdentifier.split(' ');
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
                                                            if (userTeams && Array.isArray(userTeams)) {
                                                                const team = userTeams.find(t => t.groupName === fullGroupName && t.order === orderNum);
                                                                if (team && team.playerDetails && event.playerRef.playerIndex !== undefined) {
                                                                    const player = team.playerDetails[event.playerRef.playerIndex];
                                                                    if (player && player.jerseyNumber) {
                                                                        jerseyNumber = player.jerseyNumber;
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                    
                                                    let eventIcon = '';
                                                    switch (event.type) {
                                                        case 'goal':
                                                            eventIcon = React.createElement('i', { className: 'fa-solid fa-futbol text-black text-sm' });
                                                            break;
                                                        case 'penalty':
                                                            eventIcon = React.createElement('div', { className: 'relative inline-flex items-center justify-center' },
                                                                React.createElement('i', { className: `fa-solid fa-futbol ${event.subType === 'scored' ? 'text-green-600' : 'text-red-600'} text-sm` }),
                                                                React.createElement('span', { className: `absolute -bottom-1 -right-2 text-[8px] font-bold ${event.subType === 'scored' ? 'text-green-600' : 'text-red-600'}` }, '7m')
                                                            );
                                                            break;
                                                        case 'yellow':
                                                            eventIcon = React.createElement('div', { className: 'w-4 h-5 bg-yellow-400 rounded-sm' });
                                                            break;
                                                        case 'red':
                                                            eventIcon = React.createElement('div', { className: 'w-4 h-5 bg-red-600 rounded-sm' });
                                                            break;
                                                        case 'blue':
                                                            eventIcon = React.createElement('div', { className: 'w-4 h-5 bg-blue-600 rounded-sm' });
                                                            break;
                                                        case 'exclusion':
                                                            eventIcon = React.createElement('span', { className: 'font-bold text-orange-600' }, '2\'');
                                                            break;
                                                        default:
                                                            eventIcon = React.createElement('i', { className: 'fa-solid fa-clock text-gray-600 text-sm' });
                                                    }
                                                    
                                                    const nameParts = playerName.split(' ');
                                                    const firstName = nameParts[0] || '';
                                                    const lastName = nameParts.slice(1).join(' ') || '';
                                                    const isStaff = event.playerRef?.staffType ? true : false;
                                                    const scoreBefore = event.scoreBefore || { home: 0, away: 0 };
                                                    const scoreAfter = event.scoreAfter || { home: 0, away: 0 };
                                                    
                                                    return React.createElement(
                                                        'div',
                                                        { 
                                                            key: event.id,
                                                            className: `grid grid-cols-[1fr_20px_50px_30px_60px_30px_50px_20px_1fr] gap-1 hover:bg-blue-50 transition-colors relative ${isHighlighted ? 'row-highlighted' : ''}`,
                                                        },
                                                        React.createElement('div', { className: `flex flex-col leading-tight text-right p-2` },
                                                            event.team === 'home' && React.createElement(
                                                                React.Fragment,
                                                                null,
                                                                React.createElement('span', { className: 'text-gray-700 text-xs font-medium' }, firstName),
                                                                lastName && React.createElement('span', { className: 'text-gray-700 text-xs' }, lastName)
                                                            )
                                                        ),
                                                        React.createElement('div', { className: `flex justify-end items-center p-2` },
                                                            event.team === 'home' && !isStaff && jerseyNumber && React.createElement(
                                                                'span',
                                                                { className: 'inline-block w-6 h-6 bg-gray-100 rounded-full text-xs font-bold text-gray-700 flex items-center justify-center' },
                                                                jerseyNumber
                                                            )
                                                        ),
                                                        React.createElement('div', { className: `text-center p-2` },
                                                            (event.type === 'goal' || (event.type === 'penalty' && event.subType === 'scored')) && event.team === 'home' && React.createElement(
                                                                'span',
                                                                { className: 'inline-block px-2 py-1 rounded-full text-xs font-bold text-gray-700' },
                                                                `${scoreAfter.home}:${scoreAfter.away}`
                                                            )
                                                        ),
                                                        React.createElement('div', { className: `flex justify-center items-center p-2` },
                                                            event.team === 'home' && eventIcon
                                                        ),
                                                        React.createElement('div', { className: `text-center relative p-2 group` },
                                                            React.createElement('span', { className: `font-mono text-xs text-gray-800 ${(userProfileData?.role === 'admin' || userProfileData?.role === 'hall') && selectedMatch?.status !== 'completed' ? 'group-hover:hidden' : ''}` },
                                                                `${event.minute}:${event.second?.toString().padStart(2, '0') || '00'}`
                                                            ),
                                                            (userProfileData?.role === 'admin' || userProfileData?.role === 'hall') && 
                                                            selectedMatch?.status !== 'completed' && React.createElement(
                                                                'div',
                                                                { className: 'hidden group-hover:flex items-center justify-center gap-2' },
                                                                React.createElement('button', { className: `text-blue-500 hover:text-blue-700 ${isHighlighted ? 'opacity-100' : ''}`, onClick: (e) => { e.stopPropagation(); highlightEventRow(event.id); }, title: isHighlighted ? 'Zrušiť zvýraznenie' : 'Zvýrazniť riadok' },
                                                                    React.createElement('i', { className: 'fa-solid fa-pencil text-xs' })
                                                                ),
                                                                React.createElement('button', { className: 'text-red-500 hover:text-red-700', onClick: (e) => { e.stopPropagation(); deleteMatchEvent(event.id); }, title: 'Zmazať udalosť' },
                                                                    React.createElement('i', { className: 'fa-solid fa-trash-can text-xs' })
                                                                )
                                                            )
                                                        ),
                                                        React.createElement('div', { className: `flex justify-center items-center p-2` },
                                                            event.team === 'away' && eventIcon
                                                        ),
                                                        React.createElement('div', { className: `text-center p-2` },
                                                            (event.type === 'goal' || (event.type === 'penalty' && event.subType === 'scored')) && event.team === 'away' && React.createElement(
                                                                'span',
                                                                { className: 'inline-block px-2 py-1 rounded-full text-xs font-bold text-gray-700' }, 
                                                                `${scoreAfter.home}:${scoreAfter.away}`
                                                            )
                                                        ),
                                                        React.createElement('div', { className: `flex justify-start items-center p-2` },
                                                            event.team === 'away' && !isStaff && jerseyNumber && React.createElement(
                                                                'span',
                                                                { className: 'inline-block w-6 h-6 bg-gray-100 rounded-full text-xs font-bold text-gray-700 flex items-center justify-center' },
                                                                jerseyNumber
                                                            )
                                                        ),
                                                        React.createElement('div', { className: `flex flex-col leading-tight text-left p-2` },
                                                            event.team === 'away' && React.createElement(
                                                                React.Fragment,
                                                                null,
                                                                React.createElement('span', { className: 'text-gray-700 text-xs font-medium' }, firstName),
                                                                lastName && React.createElement('span', { className: 'text-gray-700 text-xs' }, lastName)
                                                            )
                                                        )
                                                    );
                                                })
                                            )
                                        )
                                    ),
                                    
                                    // Hosťovský tím - detail
                                    React.createElement(
                                        'div',
                                        { className: 'bg-gray-50 rounded-lg p-4 border border-gray-200' },
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
                                                
                                                // Muži v realizačnom tíme pre hosťovský tím (normálny režim)
                                                activeMenStaffAway.length > 0 && 
                                                React.createElement(
                                                    React.Fragment,
                                                    null,
                                                    activeMenStaffAway.map((member, idx) => {
                                                        const staffIdentifier = {
                                                            userId: awayTeamDetails.userId,
                                                            teamIdentifier: selectedMatch.awayTeamIdentifier,
                                                            displayName: `${member.lastName} ${member.firstName} (tréner)`,
                                                            isStaff: true,
                                                            staffType: 'men',
                                                            staffIndex: idx
                                                        };
                                                        
                                                        let onClickHandler = undefined;
                                                        let cursorClass = '';
                                                        
                                                        if (selectedMatch?.status === 'scheduled') {
                                                            onClickHandler = () => openEditStaffModal(member, 'away', awayTeamDetails, 'men', idx);
                                                            cursorClass = 'hover:bg-blue-50 cursor-pointer';
                                                        } else if (isMatchActionAllowed()) {
                                                            onClickHandler = () => {
                                                                if (eventType) {
                                                                    if (eventType === 'goal' || eventType === 'penalty') {
                                                                        window.showGlobalNotification('Gól a 7m hod môžu byť priradené len hráčom', 'error');
                                                                        return;
                                                                    }
                                                                    addMatchEvent(eventType, 'away', null, staffIdentifier);
                                                                }
                                                            };
                                                            cursorClass = 'hover:bg-blue-50 cursor-pointer';
                                                        } else {
                                                            cursorClass = 'cursor-not-allowed opacity-60';
                                                        }
                                                        
                                                        return React.createElement(
                                                            'div',
                                                            { 
                                                                key: `away-men-${idx}`, 
                                                                className: `flex items-center justify-between gap-2 p-2 rounded border border-gray-200 text-sm group relative transition-colors ${cursorClass}`,
                                                                onClick: onClickHandler,
                                                                title: selectedMatch?.status === 'scheduled' ? 'Kliknite pre úpravu' : ''
                                                            },
                                                            React.createElement(
                                                                'div',
                                                                { className: 'flex items-center gap-2' },
                                                                React.createElement('i', { className: 'fa-solid fa-user text-gray-600 text-xs flex-shrink-0' }),
                                                                React.createElement('span', { className: 'font-medium truncate' }, `${member.lastName} ${member.firstName}`)
                                                            ),
                                                            selectedMatch?.status === 'scheduled' && React.createElement(
                                                                'i',
                                                                { className: 'fa-solid fa-pencil text-xs text-gray-400' }
                                                            )
                                                        );
                                                    })
                                                ),
                                                
                                                // Ženy v realizačnom tíme pre hosťovský tím (normálny režim)
                                                activeWomenStaffAway.length > 0 && 
                                                React.createElement(
                                                    React.Fragment,
                                                    null,
                                                    activeWomenStaffAway.map((member, idx) => {
                                                        const staffIdentifier = {
                                                            userId: awayTeamDetails.userId,
                                                            teamIdentifier: selectedMatch.awayTeamIdentifier,
                                                            displayName: `${member.lastName} ${member.firstName} (trénerka)`,
                                                            isStaff: true,
                                                            staffType: 'women',
                                                            staffIndex: idx
                                                        };
                                                        
                                                        let onClickHandler = undefined;
                                                        let cursorClass = '';
                                                        
                                                        if (selectedMatch?.status === 'scheduled') {
                                                            onClickHandler = () => openEditStaffModal(member, 'away', awayTeamDetails, 'women', idx);
                                                            cursorClass = 'hover:bg-blue-50 cursor-pointer';
                                                        } else if (isMatchActionAllowed()) {
                                                            onClickHandler = () => {
                                                                if (eventType) {
                                                                    if (eventType === 'goal' || eventType === 'penalty') {
                                                                        window.showGlobalNotification('Gól a 7m hod môžu byť priradené len hráčom', 'error');
                                                                        return;
                                                                    }
                                                                    addMatchEvent(eventType, 'away', null, staffIdentifier);
                                                                }
                                                            };
                                                            cursorClass = 'hover:bg-blue-50 cursor-pointer';
                                                        } else {
                                                            cursorClass = 'cursor-not-allowed opacity-60';
                                                        }
                                                        
                                                        return React.createElement(
                                                            'div',
                                                            { 
                                                                key: `away-women-${idx}`, 
                                                                className: `flex items-center justify-between gap-2 p-2 rounded border border-gray-200 text-sm group relative transition-colors ${cursorClass}`,
                                                                onClick: onClickHandler,
                                                                title: selectedMatch?.status === 'scheduled' ? 'Kliknite pre úpravu' : ''
                                                            },
                                                            React.createElement(
                                                                'div',
                                                                { className: 'flex items-center gap-2' },
                                                                React.createElement('i', { className: 'fa-solid fa-user text-pink-600 text-xs flex-shrink-0' }),
                                                                React.createElement('span', { className: 'font-medium truncate' }, `${member.lastName} ${member.firstName}`)
                                                            ),
                                                            selectedMatch?.status === 'scheduled' && React.createElement(
                                                                'i',
                                                                { className: 'fa-solid fa-pencil text-xs text-gray-400' }
                                                            )
                                                        );
                                                    })
                                                ),
                                                
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
                                        
                                        // Hráči hosťovského tímu - POUŽITE FUNKCIU renderPlayersSection
                                        renderPlayersSection(awayTeamDetails, 'away', awayTeamName)
                                    ),
                                    
                                    // Prázdny stĺpec pre zarovnanie
                                    React.createElement('div', { className: '' })
                                ) : 
                                // Keď sú štatistiky - grid s 2 stĺpcami (domáci a hosťovský)
                                React.createElement(
                                    React.Fragment,
                                    null,
                                    React.createElement(
                                        'div',
                                        { className: 'grid grid-cols-2 gap-6' },
                                        
                                        // Domáci tím - detail so štatistikami
                                        React.createElement(
                                            'div',
                                            { className: 'bg-gray-50 rounded-lg p-4 border border-gray-200' },
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
                                                    
                                                    // Hlavička pre realizačný tím
                                                    React.createElement(
                                                        'div',
                                                        { className: 'grid grid-cols-12 gap-1 mb-2 px-2 text-xs font-semibold text-gray-600 bg-gray-100 py-2 rounded' },
                                                        React.createElement('div', { className: 'col-span-8 text-left' }, 'Meno'),
                                                        React.createElement('div', { className: 'col-span-1 text-center' }, 'ŽK'),
                                                        React.createElement('div', { className: 'col-span-1 text-center' }, 'ČK'),
                                                        React.createElement('div', { className: 'col-span-1 text-center' }, 'MK'),
                                                        React.createElement('div', { className: 'col-span-1 text-center' }, '2\'')
                                                    ),
                                                    
                                                    // Muži v realizačnom tíme pre domáci tím (režim štatistík)
                                                    activeMenStaffHome.length > 0 && 
                                                    React.createElement(
                                                        React.Fragment,
                                                        null,
                                                        activeMenStaffHome.map((member, idx) => {
                                                            const staffIdentifier = {
                                                                userId: homeTeamDetails.userId,
                                                                teamIdentifier: selectedMatch.homeTeamIdentifier,
                                                                displayName: `${member.lastName} ${member.firstName} (tréner)`,
                                                                isStaff: true,
                                                                staffType: 'men',
                                                                staffIndex: idx
                                                            };
                                                            
                                                            const stats = getPlayerStats(staffIdentifier);
                                                            
                                                            let onClickHandler = undefined;
                                                            let cursorClass = '';
                                                            
                                                            if (selectedMatch?.status === 'scheduled') {
                                                                onClickHandler = () => openEditStaffModal(member, 'home', homeTeamDetails, 'men', idx);
                                                                cursorClass = 'hover:bg-blue-50 cursor-pointer';
                                                            } else if (isMatchActionAllowed()) {
                                                                onClickHandler = () => {
                                                                    if (eventType) {
                                                                        if (eventType === 'goal' || eventType === 'penalty') {
                                                                            window.showGlobalNotification('Gól a 7m hod môžu byť priradené len hráčom', 'error');
                                                                            return;
                                                                        }
                                                                        addMatchEvent(eventType, 'home', null, staffIdentifier);
                                                                    }
                                                                };
                                                                cursorClass = 'hover:bg-blue-50 cursor-pointer';
                                                            } else {
                                                                cursorClass = 'cursor-not-allowed opacity-60';
                                                            }
                                                            
                                                            return React.createElement(
                                                                'div',
                                                                { 
                                                                    key: `home-men-${idx}`, 
                                                                    className: `grid grid-cols-12 gap-1 p-2 rounded border border-gray-200 text-sm group relative transition-colors ${cursorClass}`,
                                                                    onClick: onClickHandler,
                                                                    title: selectedMatch?.status === 'scheduled' ? 'Kliknite pre úpravu' : ''
                                                                },
                                                                React.createElement(
                                                                    'div',
                                                                    { className: 'col-span-8 flex items-center gap-2 truncate' },
                                                                    React.createElement('i', { className: 'fa-solid fa-user text-gray-600 text-xs flex-shrink-0' }),
                                                                    React.createElement('span', { className: 'font-medium truncate' }, `${member.lastName} ${member.firstName}`)
                                                                ),
                                                                React.createElement('div', { className: 'col-span-1 text-center font-bold text-yellow-600' }, stats?.yellowCards || 0),
                                                                React.createElement('div', { className: 'col-span-1 text-center font-bold text-red-600' }, stats?.redCards || 0),
                                                                React.createElement('div', { className: 'col-span-1 text-center font-bold text-blue-800' }, stats?.blueCards || 0),
                                                                React.createElement('div', { className: 'col-span-1 text-center font-bold text-orange-600' }, stats?.exclusions || 0),
                                                                !showPlayerStats && selectedMatch?.status === 'scheduled' && React.createElement(
                                                                    'div',
                                                                    { className: 'col-span-1 text-right' },
                                                                    React.createElement('i', { className: 'fa-solid fa-pencil text-xs text-gray-400' })
                                                                )
                                                            );
                                                        })
                                                    ),
                                                    
                                                    // Ženy v realizačnom tíme pre domáci tím (režim štatistík)
                                                    activeWomenStaffHome.length > 0 && 
                                                    React.createElement(
                                                        React.Fragment,
                                                        null,
                                                        activeWomenStaffHome.map((member, idx) => {
                                                            const staffIdentifier = {
                                                                userId: homeTeamDetails.userId,
                                                                teamIdentifier: selectedMatch.homeTeamIdentifier,
                                                                displayName: `${member.lastName} ${member.firstName} (trénerka)`,
                                                                isStaff: true,
                                                                staffType: 'women',
                                                                staffIndex: idx
                                                            };
                                                            
                                                            const stats = getPlayerStats(staffIdentifier);
                                                            
                                                            let onClickHandler = undefined;
                                                            let cursorClass = '';
                                                            
                                                            if (selectedMatch?.status === 'scheduled') {
                                                                onClickHandler = () => openEditStaffModal(member, 'home', homeTeamDetails, 'women', idx);
                                                                cursorClass = 'hover:bg-blue-50 cursor-pointer';
                                                            } else if (isMatchActionAllowed()) {
                                                                onClickHandler = () => {
                                                                    if (eventType) {
                                                                        if (eventType === 'goal' || eventType === 'penalty') {
                                                                            window.showGlobalNotification('Gól a 7m hod môžu byť priradené len hráčom', 'error');
                                                                            return;
                                                                        }
                                                                        addMatchEvent(eventType, 'home', null, staffIdentifier);
                                                                    }
                                                                };
                                                                cursorClass = 'hover:bg-blue-50 cursor-pointer';
                                                            } else {
                                                                cursorClass = 'cursor-not-allowed opacity-60';
                                                            }
                                                            
                                                            return React.createElement(
                                                                'div',
                                                                { 
                                                                    key: `home-women-${idx}`, 
                                                                    className: `grid grid-cols-12 gap-1 p-2 rounded border border-gray-200 text-sm group relative transition-colors ${cursorClass}`,
                                                                    onClick: onClickHandler,
                                                                    title: selectedMatch?.status === 'scheduled' ? 'Kliknite pre úpravu' : ''
                                                                },
                                                                React.createElement(
                                                                    'div',
                                                                    { className: 'col-span-8 flex items-center gap-2 truncate' },
                                                                    React.createElement('i', { className: 'fa-solid fa-user text-pink-600 text-xs flex-shrink-0' }),
                                                                    React.createElement('span', { className: 'font-medium truncate' }, `${member.lastName} ${member.firstName}`)
                                                                ),
                                                                React.createElement('div', { className: 'col-span-1 text-center font-bold text-yellow-600' }, stats?.yellowCards || 0),
                                                                React.createElement('div', { className: 'col-span-1 text-center font-bold text-red-600' }, stats?.redCards || 0),
                                                                React.createElement('div', { className: 'col-span-1 text-center font-bold text-blue-800' }, stats?.blueCards || 0),
                                                                React.createElement('div', { className: 'col-span-1 text-center font-bold text-orange-600' }, stats?.exclusions || 0),
                                                                !showPlayerStats && selectedMatch?.status === 'scheduled' && React.createElement(
                                                                    'div',
                                                                    { className: 'col-span-1 text-right' },
                                                                    React.createElement('i', { className: 'fa-solid fa-pencil text-xs text-gray-400' })
                                                                )
                                                            );
                                                        })
                                                    ),
                                                    
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
                                            
                                            // Hráči pre domáci tím so štatistikami
                                            renderPlayersSection(homeTeamDetails, 'home', homeTeamName)
                                        ),
                                        
                                        // Hosťovský tím - detail so štatistikami (LEN JEDEN!)
                                        React.createElement(
                                            'div',
                                            { className: 'bg-gray-50 rounded-lg p-4 border border-gray-200' },
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
                                                    
                                                    // Hlavička pre realizačný tím
                                                    React.createElement(
                                                        'div',
                                                        { className: 'grid grid-cols-12 gap-1 mb-2 px-2 text-xs font-semibold text-gray-600 bg-gray-100 py-2 rounded' },
                                                        React.createElement('div', { className: 'col-span-8 text-left' }, 'Meno'),
                                                        React.createElement('div', { className: 'col-span-1 text-center' }, 'ŽK'),
                                                        React.createElement('div', { className: 'col-span-1 text-center' }, 'ČK'),
                                                        React.createElement('div', { className: 'col-span-1 text-center' }, 'MK'),
                                                        React.createElement('div', { className: 'col-span-1 text-center' }, '2\'')
                                                    ),
                                                    
                                                    // Muži v realizačnom tíme pre hosťovský tím (režim štatistík)
                                                    activeMenStaffAway.length > 0 && 
                                                    React.createElement(
                                                        React.Fragment,
                                                        null,
                                                        activeMenStaffAway.map((member, idx) => {
                                                            const staffIdentifier = {
                                                                userId: awayTeamDetails.userId,
                                                                teamIdentifier: selectedMatch.awayTeamIdentifier,
                                                                displayName: `${member.lastName} ${member.firstName} (tréner)`,
                                                                isStaff: true,
                                                                staffType: 'men',
                                                                staffIndex: idx
                                                            };
                                                            
                                                            const stats = getPlayerStats(staffIdentifier);
                                                            
                                                            let onClickHandler = undefined;
                                                            let cursorClass = '';
                                                            
                                                            if (selectedMatch?.status === 'scheduled') {
                                                                onClickHandler = () => openEditStaffModal(member, 'away', awayTeamDetails, 'men', idx);
                                                                cursorClass = 'hover:bg-blue-50 cursor-pointer';
                                                            } else if (isMatchActionAllowed()) {
                                                                onClickHandler = () => {
                                                                    if (eventType) {
                                                                        if (eventType === 'goal' || eventType === 'penalty') {
                                                                            window.showGlobalNotification('Gól a 7m hod môžu byť priradené len hráčom', 'error');
                                                                            return;
                                                                        }
                                                                        addMatchEvent(eventType, 'away', null, staffIdentifier);
                                                                    }
                                                                };
                                                                cursorClass = 'hover:bg-blue-50 cursor-pointer';
                                                            } else {
                                                                cursorClass = 'cursor-not-allowed opacity-60';
                                                            }
                                                            
                                                            return React.createElement(
                                                                'div',
                                                                { 
                                                                    key: `away-men-${idx}`, 
                                                                    className: `grid grid-cols-12 gap-1 p-2 rounded border border-gray-200 text-sm group relative transition-colors ${cursorClass}`,
                                                                    onClick: onClickHandler,
                                                                    title: selectedMatch?.status === 'scheduled' ? 'Kliknite pre úpravu' : ''
                                                                },
                                                                React.createElement(
                                                                    'div',
                                                                    { className: 'col-span-8 flex items-center gap-2 truncate' },
                                                                    React.createElement('i', { className: 'fa-solid fa-user text-gray-600 text-xs flex-shrink-0' }),
                                                                    React.createElement('span', { className: 'font-medium truncate' }, `${member.lastName} ${member.firstName}`)
                                                                ),
                                                                React.createElement('div', { className: 'col-span-1 text-center font-bold text-yellow-600' }, stats?.yellowCards || 0),
                                                                React.createElement('div', { className: 'col-span-1 text-center font-bold text-red-600' }, stats?.redCards || 0),
                                                                React.createElement('div', { className: 'col-span-1 text-center font-bold text-blue-800' }, stats?.blueCards || 0),
                                                                React.createElement('div', { className: 'col-span-1 text-center font-bold text-orange-600' }, stats?.exclusions || 0),
                                                                !showPlayerStats && selectedMatch?.status === 'scheduled' && React.createElement(
                                                                    'div',
                                                                    { className: 'col-span-1 text-right' },
                                                                    React.createElement('i', { className: 'fa-solid fa-pencil text-xs text-gray-400' })
                                                                )
                                                            );
                                                        })
                                                    ),
                                                                                                                    
                                                    // Ženy v realizačnom tíme pre hosťovský tím (režim štatistík)
                                                    activeWomenStaffAway.length > 0 && 
                                                    React.createElement(
                                                        React.Fragment,
                                                        null,
                                                        activeWomenStaffAway.map((member, idx) => {
                                                            const staffIdentifier = {
                                                                userId: awayTeamDetails.userId,
                                                                teamIdentifier: selectedMatch.awayTeamIdentifier,
                                                                displayName: `${member.lastName} ${member.firstName} (trénerka)`,
                                                                isStaff: true,
                                                                staffType: 'women',
                                                                staffIndex: idx
                                                            };
                                                            
                                                            const stats = getPlayerStats(staffIdentifier);
                                                            
                                                            let onClickHandler = undefined;
                                                            let cursorClass = '';
                                                            
                                                            if (selectedMatch?.status === 'scheduled') {
                                                                onClickHandler = () => openEditStaffModal(member, 'away', awayTeamDetails, 'women', idx);
                                                                cursorClass = 'hover:bg-blue-50 cursor-pointer';
                                                            } else if (isMatchActionAllowed()) {
                                                                onClickHandler = () => {
                                                                    if (eventType) {
                                                                        if (eventType === 'goal' || eventType === 'penalty') {
                                                                            window.showGlobalNotification('Gól a 7m hod môžu byť priradené len hráčom', 'error');
                                                                            return;
                                                                        }
                                                                        addMatchEvent(eventType, 'away', null, staffIdentifier);
                                                                    }
                                                                };
                                                                cursorClass = 'hover:bg-blue-50 cursor-pointer';
                                                            } else {
                                                                cursorClass = 'cursor-not-allowed opacity-60';
                                                            }
                                                            
                                                            return React.createElement(
                                                                'div',
                                                                { 
                                                                    key: `away-women-${idx}`, 
                                                                    className: `grid grid-cols-12 gap-1 p-2 rounded border border-gray-200 text-sm group relative transition-colors ${cursorClass}`,
                                                                    onClick: onClickHandler,
                                                                    title: selectedMatch?.status === 'scheduled' ? 'Kliknite pre úpravu' : ''
                                                                },
                                                                React.createElement(
                                                                    'div',
                                                                    { className: 'col-span-8 flex items-center gap-2 truncate' },
                                                                    React.createElement('i', { className: 'fa-solid fa-user text-pink-600 text-xs flex-shrink-0' }),
                                                                    React.createElement('span', { className: 'font-medium truncate' }, `${member.lastName} ${member.firstName}`)
                                                                ),
                                                                React.createElement('div', { className: 'col-span-1 text-center font-bold text-yellow-600' }, stats?.yellowCards || 0),
                                                                React.createElement('div', { className: 'col-span-1 text-center font-bold text-red-600' }, stats?.redCards || 0),
                                                                React.createElement('div', { className: 'col-span-1 text-center font-bold text-blue-800' }, stats?.blueCards || 0),
                                                                React.createElement('div', { className: 'col-span-1 text-center font-bold text-orange-600' }, stats?.exclusions || 0),
                                                                !showPlayerStats && selectedMatch?.status === 'scheduled' && React.createElement(
                                                                    'div',
                                                                    { className: 'col-span-1 text-right' },
                                                                    React.createElement('i', { className: 'fa-solid fa-pencil text-xs text-gray-400' })
                                                                )
                                                            );
                                                        })
                                                    ),
                                                    
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
                                            
                                            // Hráči hosťovského tímu so štatistikami
                                            renderPlayersSection(awayTeamDetails, 'away', awayTeamName)
                                        )
                                    ),
                                    
                                    // Box s priebehom zápasu - pod tímami (s horným okrajom)
                                    React.createElement(
                                        'div',
                                        { className: 'mt-6 bg-gray-50 rounded-lg p-4 border border-gray-200 flex flex-col match-progress-section' },
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
                                                selectedMatch?.status === 'completed' ? 'Konečný výsledok' : 'Aktuálne skóre'
                                            )
                                        ),
                                        
                                        // Ovládacie tlačidlá pre adminov a hall users
                                        (userProfileData?.role === 'admin' || userProfileData?.role === 'hall') && React.createElement(
                                            'div',
                                            { className: 'flex flex-wrap gap-2 justify-center mb-4' },
                                            
                                            React.createElement(
                                                'button',
                                                {
                                                    className: `px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 border-2 ${
                                                        !isMatchActionAllowed()
                                                            ? 'bg-white text-green-600 border-green-600 cursor-not-allowed opacity-50'
                                                            : eventType === 'goal' && eventSubType === null
                                                                ? 'bg-green-600 text-white border-green-600'
                                                                : eventType === 'penalty' && eventSubType === 'scored'
                                                                ? 'bg-green-600 text-white border-green-600'
                                                                : 'bg-white text-green-600 border-green-600 hover:bg-green-50'
                                                    }`,
                                                    onClick: isMatchActionAllowed() 
                                                        ? () => {
                                                            if (eventType === 'penalty' && eventSubType === 'missed') {
                                                                setEventType('penalty');
                                                                setEventSubType('scored');
                                                                setEventTeam(null);
                                                                setSelectedPlayerForEvent(null);
                                                            } 
                                                            else if (eventType === 'penalty' && eventSubType === 'scored') {
                                                                setEventType(null);
                                                                setEventTeam(null);
                                                                setEventSubType(null);
                                                                setSelectedPlayerForEvent(null);
                                                            }
                                                            else if (eventType === 'goal' && eventSubType === null) {
                                                                setEventType(null);
                                                                setEventTeam(null);
                                                                setEventSubType(null);
                                                                setSelectedPlayerForEvent(null);
                                                            } 
                                                            else {
                                                                setEventType('goal');
                                                                setEventSubType(null);
                                                                setEventTeam(null);
                                                                setSelectedPlayerForEvent(null);
                                                            }
                                                        }
                                                        : undefined,
                                                    disabled: !isMatchActionAllowed()
                                                },
                                                React.createElement('i', { className: `fa-solid fa-futbol ${
                                                    !isMatchActionAllowed()
                                                        ? 'text-green-600'
                                                        : (eventType === 'goal' && eventSubType === null) || (eventType === 'penalty' && eventSubType === 'scored')
                                                            ? 'text-white' 
                                                            : 'text-green-600'
                                                }` }),
                                                'Gól'
                                            ),
                                            
                                            React.createElement(
                                                'button',
                                                {
                                                    className: `px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 border-2 ${
                                                        !isMatchActionAllowed()
                                                            ? 'bg-white text-blue-600 border-blue-600 cursor-not-allowed opacity-50'
                                                            : eventType === 'penalty' && (eventSubType === 'missed' || eventSubType === 'scored')
                                                                ? 'bg-blue-600 text-white border-blue-600' 
                                                                : 'bg-white text-blue-600 border-blue-600 hover:bg-blue-50'
                                                    }`,
                                                    onClick: isMatchActionAllowed()
                                                        ? () => {
                                                            if (eventType === 'penalty') {
                                                                setEventType(null);
                                                                setEventTeam(null);
                                                                setEventSubType(null);
                                                                setSelectedPlayerForEvent(null);
                                                            } else {
                                                                setEventType('penalty');
                                                                setEventSubType('missed');
                                                                setEventTeam(null);
                                                                setSelectedPlayerForEvent(null);
                                                            }
                                                        }
                                                        : undefined,
                                                    disabled: !isMatchActionAllowed()
                                                },
                                                React.createElement('i', { className: `fa-solid fa-circle-dot ${
                                                    !isMatchActionAllowed()
                                                        ? 'text-blue-600'
                                                        : eventType === 'penalty' ? 'text-white' : 'text-blue-600'
                                                }` }),
                                                '7m'
                                            ),
                                            
                                            React.createElement(
                                                'button',
                                                {
                                                    className: `px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 border-2 ${
                                                        !isMatchActionAllowed()
                                                            ? 'bg-white text-yellow-600 border-yellow-500 cursor-not-allowed opacity-50'
                                                            : eventType === 'yellow' 
                                                                ? 'bg-yellow-500 text-white border-yellow-500' 
                                                                : 'bg-white text-yellow-600 border-yellow-500 hover:bg-yellow-50'
                                                    }`,
                                                    onClick: isMatchActionAllowed()
                                                        ? () => {
                                                            if (eventType === 'yellow') {
                                                                setEventType(null);
                                                                setEventTeam(null);
                                                                setEventSubType(null);
                                                                setSelectedPlayerForEvent(null);
                                                            } else {
                                                                setEventType('yellow');
                                                                setEventSubType(null);
                                                                setEventTeam(null);
                                                                setSelectedPlayerForEvent(null);
                                                            }
                                                        }
                                                        : undefined,
                                                    disabled: !isMatchActionAllowed()
                                                },
                                                React.createElement('i', { className: `fa-solid fa-square ${
                                                    !isMatchActionAllowed()
                                                        ? 'text-yellow-600'
                                                        : eventType === 'yellow' ? 'text-white' : 'text-yellow-600'
                                                }` }),
                                                'ŽK'
                                            ),
                                            
                                            React.createElement(
                                                'button',
                                                {
                                                    className: `px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 border-2 ${
                                                        !isMatchActionAllowed()
                                                            ? 'bg-white text-red-600 border-red-600 cursor-not-allowed opacity-50'
                                                            : eventType === 'red' 
                                                                ? 'bg-red-600 text-white border-red-600' 
                                                                : 'bg-white text-red-600 border-red-600 hover:bg-red-50'
                                                    }`,
                                                    onClick: isMatchActionAllowed()
                                                        ? () => {
                                                            if (eventType === 'red') {
                                                                setEventType(null);
                                                                setEventTeam(null);
                                                                setEventSubType(null);
                                                                setSelectedPlayerForEvent(null);
                                                            } else {
                                                                setEventType('red');
                                                                setEventSubType(null);
                                                                setEventTeam(null);
                                                                setSelectedPlayerForEvent(null);
                                                            }
                                                        }
                                                        : undefined,
                                                    disabled: !isMatchActionAllowed()
                                                },
                                                React.createElement('i', { className: `fa-solid fa-square ${
                                                    !isMatchActionAllowed()
                                                        ? 'text-red-600'
                                                        : eventType === 'red' ? 'text-white' : 'text-red-600'
                                                }` }),
                                                'ČK'
                                            ),
                                            
                                            React.createElement(
                                                'button',
                                                {
                                                    className: `px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 border-2 ${
                                                        !isMatchActionAllowed()
                                                            ? 'bg-white text-blue-800 border-blue-800 cursor-not-allowed opacity-50'
                                                            : eventType === 'blue' 
                                                                ? 'bg-blue-800 text-white border-blue-800' 
                                                                : 'bg-white text-blue-800 border-blue-800 hover:bg-blue-100'
                                                    }`,
                                                    onClick: isMatchActionAllowed()
                                                        ? () => {
                                                            if (eventType === 'blue') {
                                                                setEventType(null);
                                                                setEventTeam(null);
                                                                setEventSubType(null);
                                                                setSelectedPlayerForEvent(null);
                                                            } else {
                                                                setEventType('blue');
                                                                setEventSubType(null);
                                                                setEventTeam(null);
                                                                setSelectedPlayerForEvent(null);
                                                            }
                                                        }
                                                        : undefined,
                                                    disabled: !isMatchActionAllowed()
                                                },
                                                React.createElement('i', { className: `fa-solid fa-square ${
                                                    !isMatchActionAllowed()
                                                        ? 'text-blue-800'
                                                        : eventType === 'blue' ? 'text-white' : 'text-blue-800'
                                                }` }),
                                                'MK'
                                            ),
                                            
                                            React.createElement(
                                                'button',
                                                {
                                                    className: `px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 border-2 ${
                                                        !isMatchActionAllowed()
                                                            ? 'bg-white text-orange-600 border-orange-600 cursor-not-allowed opacity-50'
                                                            : eventType === 'exclusion' 
                                                                ? 'bg-orange-600 text-white border-orange-600' 
                                                                : 'bg-white text-orange-600 border-orange-600 hover:bg-orange-50'
                                                    }`,
                                                    onClick: isMatchActionAllowed()
                                                        ? () => {
                                                            if (eventType === 'exclusion') {
                                                                setEventType(null);
                                                                setEventTeam(null);
                                                                setEventSubType(null);
                                                                setSelectedPlayerForEvent(null);
                                                            } else {
                                                                setEventType('exclusion');
                                                                setEventSubType(null);
                                                                setEventTeam(null);
                                                                setSelectedPlayerForEvent(null);
                                                            }
                                                        }
                                                        : undefined,
                                                    disabled: !isMatchActionAllowed()
                                                },
                                                React.createElement('i', { className: `fa-solid fa-user-slash ${
                                                    !isMatchActionAllowed()
                                                        ? 'text-orange-600'
                                                        : eventType === 'exclusion' ? 'text-white' : 'text-orange-600'
                                                }` }),
                                                'Vylúčenie'
                                            )
                                        ),
                                        
                                        // Zoznam udalostí
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
                                                { className: 'space-y-1' },
                                                
                                                matchEvents.map((event) => {
                                                    const isHighlighted = highlightedEventId === event.id;
                                                    const playerName = event.playerRef ? getPlayerNameFromRef(event.playerRef) : '';
                                                    
                                                    let jerseyNumber = '';
                                                    if (event.playerRef && !event.playerRef.staffType) {
                                                        const user = users.find(u => u.id === event.playerRef.userId);
                                                        if (user) {
                                                            const parts = event.playerRef.teamIdentifier.split(' ');
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
                                                            if (userTeams && Array.isArray(userTeams)) {
                                                                const team = userTeams.find(t => t.groupName === fullGroupName && t.order === orderNum);
                                                                if (team && team.playerDetails && event.playerRef.playerIndex !== undefined) {
                                                                    const player = team.playerDetails[event.playerRef.playerIndex];
                                                                    if (player && player.jerseyNumber) {
                                                                        jerseyNumber = player.jerseyNumber;
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                    
                                                    let eventIcon = '';
                                                    switch (event.type) {
                                                        case 'goal':
                                                            eventIcon = React.createElement('i', { className: 'fa-solid fa-futbol text-black text-sm' });
                                                            break;
                                                        case 'penalty':
                                                            eventIcon = React.createElement('div', { className: 'relative inline-flex items-center justify-center' },
                                                                React.createElement('i', { className: `fa-solid fa-futbol ${event.subType === 'scored' ? 'text-green-600' : 'text-red-600'} text-sm` }),
                                                                React.createElement('span', { className: `absolute -bottom-1 -right-2 text-[8px] font-bold ${event.subType === 'scored' ? 'text-green-600' : 'text-red-600'}` }, '7m')
                                                            );
                                                            break;
                                                        case 'yellow':
                                                            eventIcon = React.createElement('div', { className: 'w-4 h-5 bg-yellow-400 rounded-sm' });
                                                            break;
                                                        case 'red':
                                                            eventIcon = React.createElement('div', { className: 'w-4 h-5 bg-red-600 rounded-sm' });
                                                            break;
                                                        case 'blue':
                                                            eventIcon = React.createElement('div', { className: 'w-4 h-5 bg-blue-600 rounded-sm' });
                                                            break;
                                                        case 'exclusion':
                                                            eventIcon = React.createElement('span', { className: 'font-bold text-orange-600' }, '2\'');
                                                            break;
                                                        default:
                                                            eventIcon = React.createElement('i', { className: 'fa-solid fa-clock text-gray-600 text-sm' });
                                                    }
                                                    
                                                    const nameParts = playerName.split(' ');
                                                    const firstName = nameParts[0] || '';
                                                    const lastName = nameParts.slice(1).join(' ') || '';
                                                    const isStaff = event.playerRef?.staffType ? true : false;
                                                    const scoreBefore = event.scoreBefore || { home: 0, away: 0 };
                                                    const scoreAfter = event.scoreAfter || { home: 0, away: 0 };
                                                    
                                                    return React.createElement(
                                                        'div',
                                                        { 
                                                            key: event.id,
                                                            className: `grid grid-cols-[1fr_20px_50px_30px_60px_30px_50px_20px_1fr] gap-1 hover:bg-blue-50 transition-colors relative ${isHighlighted ? 'row-highlighted' : ''}`,
                                                        },
                                                        React.createElement('div', { className: `flex flex-col leading-tight text-right p-2` },
                                                            event.team === 'home' && React.createElement(
                                                                React.Fragment,
                                                                null,
                                                                React.createElement('span', { className: 'text-gray-700 text-xs font-medium' }, firstName),
                                                                lastName && React.createElement('span', { className: 'text-gray-700 text-xs' }, lastName)
                                                            )
                                                        ),
                                                        React.createElement('div', { className: `flex justify-end items-center p-2` },
                                                            event.team === 'home' && !isStaff && jerseyNumber && React.createElement(
                                                                'span',
                                                                { className: 'inline-block w-6 h-6 bg-gray-100 rounded-full text-xs font-bold text-gray-700 flex items-center justify-center' },
                                                                jerseyNumber
                                                            )
                                                        ),
                                                        React.createElement('div', { className: `text-center p-2` },
                                                            (event.type === 'goal' || (event.type === 'penalty' && event.subType === 'scored')) && event.team === 'home' && React.createElement(
                                                                'span',
                                                                { className: 'inline-block px-2 py-1 rounded-full text-xs font-bold text-gray-700' },
                                                                `${scoreAfter.home}:${scoreAfter.away}`
                                                            )
                                                        ),
                                                        React.createElement('div', { className: `flex justify-center items-center p-2` },
                                                            event.team === 'home' && eventIcon
                                                        ),
                                                        React.createElement('div', { className: `text-center relative p-2 group` },
                                                            React.createElement('span', { className: `font-mono text-xs text-gray-800 ${(userProfileData?.role === 'admin' || userProfileData?.role === 'hall') && selectedMatch?.status !== 'completed' ? 'group-hover:hidden' : ''}` },
                                                                `${event.minute}:${event.second?.toString().padStart(2, '0') || '00'}`
                                                            ),
                                                            (userProfileData?.role === 'admin' || userProfileData?.role === 'hall') && 
                                                            selectedMatch?.status !== 'completed' && React.createElement(
                                                                'div',
                                                                { className: 'hidden group-hover:flex items-center justify-center gap-2' },
                                                                React.createElement('button', { className: `text-blue-500 hover:text-blue-700 ${isHighlighted ? 'opacity-100' : ''}`, onClick: (e) => { e.stopPropagation(); highlightEventRow(event.id); }, title: isHighlighted ? 'Zrušiť zvýraznenie' : 'Zvýrazniť riadok' },
                                                                    React.createElement('i', { className: 'fa-solid fa-pencil text-xs' })
                                                                ),
                                                                React.createElement('button', { className: 'text-red-500 hover:text-red-700', onClick: (e) => { e.stopPropagation(); deleteMatchEvent(event.id); }, title: 'Zmazať udalosť' },
                                                                    React.createElement('i', { className: 'fa-solid fa-trash-can text-xs' })
                                                                )
                                                            )
                                                        ),
                                                        React.createElement('div', { className: `flex justify-center items-center p-2` },
                                                            event.team === 'away' && eventIcon
                                                        ),
                                                        React.createElement('div', { className: `text-center p-2` },
                                                            (event.type === 'goal' || (event.type === 'penalty' && event.subType === 'scored')) && event.team === 'away' && React.createElement(
                                                                'span',
                                                                { className: 'inline-block px-2 py-1 rounded-full text-xs font-bold text-gray-700' }, 
                                                                `${scoreAfter.home}:${scoreAfter.away}`
                                                            )
                                                        ),
                                                        React.createElement('div', { className: `flex justify-start items-center p-2` },
                                                            event.team === 'away' && !isStaff && jerseyNumber && React.createElement(
                                                                'span',
                                                                { className: 'inline-block w-6 h-6 bg-gray-100 rounded-full text-xs font-bold text-gray-700 flex items-center justify-center' },
                                                                jerseyNumber
                                                            )
                                                        ),
                                                        React.createElement('div', { className: `flex flex-col leading-tight text-left p-2` },
                                                            event.team === 'away' && React.createElement(
                                                                React.Fragment,
                                                                null,
                                                                React.createElement('span', { className: 'text-gray-700 text-xs font-medium' }, firstName),
                                                                lastName && React.createElement('span', { className: 'text-gray-700 text-xs' }, lastName)
                                                            )
                                                        )
                                                    );
                                                })
                                            )
                                        )
                                    )
                                )
                            )
                        )
                    )
                )
        );
    
        return React.createElement(
            React.Fragment,
            null,
            mainContent,
            React.createElement(ConfirmModal, {
                isOpen: confirmModalOpen,
                onClose: () => {
                    setConfirmModalOpen(false);
                    setEventToDelete(null);
                },
                onConfirm: confirmDeleteEvent,
                title: 'Zmazanie udalosti',
                message: 'Naozaj chcete zmazať túto udalosť? Táto akcia je nenávratná.'
            }),
            React.createElement(ResetMatchModal, {
                isOpen: resetModalOpen,
                onClose: () => {
                    setResetModalOpen(false);
                    setResetMatchId(null);
                },
                onConfirm: () => resetMatchTimer(resetMatchId, false),
                onConfirmWithDelete: () => resetMatchTimer(resetMatchId, true),
                title: 'Reset zápasu',
                message: 'Naozaj chcete resetovať tento zápas? Čas sa vynuluje a zápas sa vráti do stavu "Naplánované".'
            }),
            React.createElement(EndMatchModal, {
                isOpen: endMatchModalOpen,
                onClose: () => {
                    setEndMatchModalOpen(false);
                    setEndMatchId(null);
                },
                onConfirm: () => {
                    confirmEndMatch();
                    setEndMatchModalOpen(false);
                    setEndMatchId(null);
                },
                title: 'Ukončenie zápasu',
                message: 'Naozaj chcete ukončiť tento zápas? Po ukončení zápasu už nebude možné pridávať ďalšie udalosti.'
            }),
            React.createElement(EditStaffModal, {
                isOpen: editStaffModalOpen,
                onClose: () => {
                    setEditStaffModalOpen(false);
                    setStaffToEdit(null);
                },
                onSave: saveStaffEdit,
                onRemove: removeStaffFromRoster,  // PRIDANÉ
                member: staffToEdit,
                firstName: editStaffFirstName,
                lastName: editStaffLastName,
                onFirstNameChange: setEditStaffFirstName,
                onLastNameChange: setEditStaffLastName
            }),
            React.createElement(EditPlayerModal, {
                isOpen: editPlayerModalOpen,
                onClose: () => {
                    setEditPlayerModalOpen(false);
                    setPlayerToEdit(null);
                },
                onSave: savePlayerEdit,
                onRemove: removePlayerFromRoster,
                player: playerToEdit,
                firstName: editPlayerFirstName,
                lastName: editPlayerLastName,
                jerseyNumber: editPlayerJerseyNumber,
                onFirstNameChange: setEditPlayerFirstName,
                onLastNameChange: setEditPlayerLastName,
                onJerseyNumberChange: setEditPlayerJerseyNumber
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
            
                                // Zistenie, či je zápas v stave, ktorý nie je "Naplánované" ani "Odohrané"
                                const isMatchInProgress = match.status === 'in-progress' || match.status === 'paused';
                                
                                // V časti s mapovaním zápasov (dayGroup.matches.map)
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
                                        
                                        // VS alebo aktuálny čas/skóre
                                        React.createElement(
                                            'div',
                                            { className: 'flex items-center gap-3 flex-1' },
                                            React.createElement(
                                                'span',
                                                { className: 'font-medium text-gray-800 text-right flex-1' },
                                                homeTeamName
                                            ),
                                            
                                            // Zobrazenie stavu zápasu
                                            liveMatchData[match.id] ? 
                                                React.createElement(
                                                    'div',
                                                    { 
                                                        className: 'flex items-center justify-center gap-2 px-3 py-1 min-w-[100px]',
                                                    },
                                                    React.createElement(
                                                        'span',
                                                        { className: 'font-mono font-bold text-blue-600 text-sm' },
                                                        `${liveMatchData[match.id].homeScore} : ${liveMatchData[match.id].awayScore}`
                                                    )
                                                ) :
                                                match.status === 'completed' && completedMatchData[match.id] ?
                                                    React.createElement(
                                                        'div',
                                                        { 
                                                            className: 'flex items-center justify-center gap-2 px-3 py-1 min-w-[100px]',
                                                            title: 'Konečný výsledok'
                                                        },
                                                        React.createElement(
                                                            'span',
                                                            { className: 'font-mono font-bold text-green-600 text-sm' },
                                                            `${completedMatchData[match.id].homeScore} : ${completedMatchData[match.id].awayScore}`
                                                        )
                                                    ) :
                                                    React.createElement(
                                                        'span',
                                                        { className: 'text-xs font-bold text-gray-400 px-2' },
                                                        '-- : --'
                                                    ),
                                            
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
                                        ),
                                        
                                        // Žltá šípka pre prebiehajúce zápasy (voliteľné - môžete ponechať alebo odstrániť)
                                        React.createElement(
                                            'span',
                                            { 
                                                className: `inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full min-w-[70px] ${
                                                    isMatchInProgress 
                                                        ? 'bg-yellow-100 text-yellow-700' 
                                                        : 'bg-white text-gray-400 border border-gray-200'
                                                }`,
                                                title: isMatchInProgress ? 'Zápas práve prebieha' : ''
                                            },
                                            React.createElement('i', { 
                                                className: `fa-solid fa-play text-xs ${
                                                    isMatchInProgress ? 'text-yellow-600' : 'text-gray-300'
                                                }` 
                                            }),
                                            'Detail'
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

const EditStaffModal = ({ isOpen, onClose, onSave, onRemove, member, firstName, lastName, onFirstNameChange, onLastNameChange }) => {
    if (!isOpen) return null;

    return React.createElement(
        'div',
        {
            className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[170]',
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
                React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, 'Úprava člena realizačného tímu'),
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'text-gray-500 hover:text-gray-700'
                    },
                    React.createElement('i', { className: 'fa-solid fa-times text-xl' })
                )
            ),

            React.createElement(
                'div',
                { className: 'space-y-4 mb-6' },
                React.createElement(
                    'div',
                    null,
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Meno'),
                    React.createElement(
                        'input',
                        {
                            type: 'text',
                            value: firstName,
                            onChange: (e) => onFirstNameChange(e.target.value),
                            className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                        }
                    )
                ),
                React.createElement(
                    'div',
                    null,
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Priezvisko'),
                    React.createElement(
                        'input',
                        {
                            type: 'text',
                            value: lastName,
                            onChange: (e) => onLastNameChange(e.target.value),
                            className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                        }
                    )
                )
            ),

            React.createElement(
                'div',
                { className: 'flex justify-end gap-3' },
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors'
                    },
                    'Zrušiť'
                ),
                // PRIDANÉ tlačidlo na odstránenie člena RT
                onRemove && React.createElement(
                    'button',
                    {
                        onClick: onRemove,
                        className: 'px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors'
                    },
                    'Odstrániť zo súpisky'
                ),
                React.createElement(
                    'button',
                    {
                        onClick: onSave,
                        className: 'px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors'
                    },
                    'Uložiť'
                )
            )
        )
    );
};

const EditPlayerModal = ({ isOpen, onClose, onSave, onRemove, player, firstName, lastName, jerseyNumber, onFirstNameChange, onLastNameChange, onJerseyNumberChange }) => {
    if (!isOpen) return null;

    return React.createElement(
        'div',
        {
            className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[160]',
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
                React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, 'Úprava hráča'),
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'text-gray-500 hover:text-gray-700'
                    },
                    React.createElement('i', { className: 'fa-solid fa-times text-xl' })
                )
            ),

            React.createElement(
                'div',
                { className: 'space-y-4 mb-6' },
                React.createElement(
                    'div',
                    null,
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Meno'),
                    React.createElement(
                        'input',
                        {
                            type: 'text',
                            value: firstName,
                            onChange: (e) => onFirstNameChange(e.target.value),
                            className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                        }
                    )
                ),
                React.createElement(
                    'div',
                    null,
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Priezvisko'),
                    React.createElement(
                        'input',
                        {
                            type: 'text',
                            value: lastName,
                            onChange: (e) => onLastNameChange(e.target.value),
                            className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                        }
                    )
                ),
                React.createElement(
                    'div',
                    null,
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Číslo dresu'),
                    React.createElement(
                        'input',
                        {
                            type: 'text',
                            value: jerseyNumber,
                            onChange: (e) => onJerseyNumberChange(e.target.value),
                            className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                        }
                    )
                )
            ),

            React.createElement(
                'div',
                { className: 'flex justify-end gap-3' },
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
                        onClick: onRemove,
                        className: 'px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors'
                    },
                    'Odstrániť zo súpisky'
                ),
                React.createElement(
                    'button',
                    {
                        onClick: onSave,
                        className: 'px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors'
                    },
                    'Uložiť'
                )
            )
        )
    );
};

const EndMatchModal = ({ isOpen, onClose, onConfirm, title, message }) => {
    if (!isOpen) return null;

    return React.createElement(
        'div',
        {
            className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[150]',
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
                React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, title || 'Ukončenie zápasu'),
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'text-gray-500 hover:text-gray-700'
                    },
                    React.createElement('i', { className: 'fa-solid fa-times text-xl' })
                )
            ),

            React.createElement(
                'p',
                { className: 'text-gray-600 mb-6' },
                message || 'Naozaj chcete ukončiť tento zápas?'
            ),

            React.createElement(
                'div',
                { className: 'flex justify-end gap-3' },
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
                            onConfirm();
                            onClose();
                        },
                        className: 'px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors'
                    },
                    'Ukončiť zápas'
                )
            )
        )
    );
};

// Komponent pre modálne okno resetu zápasu
const ResetMatchModal = ({ isOpen, onClose, onConfirm, onConfirmWithDelete, title, message }) => {
    if (!isOpen) return null;

    return React.createElement(
        'div',
        {
            className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[140]',
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
                React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, title || 'Reset zápasu'),
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'text-gray-500 hover:text-gray-700'
                    },
                    React.createElement('i', { className: 'fa-solid fa-times text-xl' })
                )
            ),

            React.createElement(
                'p',
                { className: 'text-gray-600 mb-6' },
                message || 'Naozaj chcete resetovať tento zápas?'
            ),

            React.createElement(
                'div',
                { className: 'flex justify-end gap-3' },
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
                            onConfirmWithDelete();
                            onClose();
                        },
                        className: 'px-4 py-2 text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors'
                    },
                    'Reset zápasu a\u00A0vymazať udalosti'
                )
            )
        )
    );
};

// Komponent pre potvrdzovacie modálne okno
const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message }) => {
    if (!isOpen) return null;

    return React.createElement(
        'div',
        {
            className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[130]',
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
                React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, title || 'Potvrdenie akcie'),
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'text-gray-500 hover:text-gray-700'
                    },
                    React.createElement('i', { className: 'fa-solid fa-times text-xl' })
                )
            ),

            React.createElement(
                'p',
                { className: 'text-gray-600 mb-6' },
                message || 'Naozaj chcete vykonať túto akciu?'
            ),

            React.createElement(
                'div',
                { className: 'flex justify-end gap-3' },
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
                            onConfirm();
                            onClose();
                        },
                        className: 'px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors'
                    },
                    'Zmazať'
                )
            )
        )
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
//                        console.error("Chyba pri synchronizácii e-mailu:", error);
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

// Funkcia pre výpis ID aktuálneho zápasu do konzoly
window.getCurrentMatchId = async () => {
    // Získame z URL parametrov
    const urlParams = new URLSearchParams(window.location.search);
    const homeIdentifier = urlParams.get('domaci');
    const awayIdentifier = urlParams.get('hostia');
    
    if (homeIdentifier && awayIdentifier) {
        console.log(`Aktuálny zápas - domáci: ${homeIdentifier}, hostia: ${awayIdentifier}`);
        
        // Najprv skúsime použiť uložené ID z React stavu
        if (window.currentMatchId) {
            console.log(`ID zápasu: ${window.currentMatchId}`);
            return window.currentMatchId;
        }
        
        // Ak nemáme uložené ID, vyhľadáme ho v databáze
        if (!window.db) {
            console.log('Firebase databáza nie je inicializovaná');
            return null;
        }
        
        try {
            const matchesRef = collection(window.db, 'matches');
            const q = query(
                matchesRef, 
                where("homeTeamIdentifier", "==", homeIdentifier),
                where("awayTeamIdentifier", "==", awayIdentifier)
            );
            
            const querySnapshot = await getDocs(q);
            
            if (querySnapshot.empty) {
                console.log('Zápas nebol nájdený v databáze');
                return null;
            }
            
            const matches = [];
            querySnapshot.forEach((doc) => {
                matches.push({ id: doc.id, ...doc.data() });
            });
            
            if (matches.length === 1) {
                const matchId = matches[0].id;
                console.log(`ID zápasu: ${matchId}`);
                // Uložíme si ID pre budúce použitie
                window.currentMatchId = matchId;
                return matchId;
            } else {
                console.log(`Nájdených viacero zápasov (${matches.length}):`);
                matches.forEach(match => {
                    console.log(`  - ID: ${match.id}`);
                });
                return matches[0]?.id || null;
            }
        } catch (error) {
            console.error('Chyba pri vyhľadávaní zápasu:', error);
            return null;
        }
    } else {
        console.log('Žiadny zápas nie je aktuálne zobrazený');
        return null;
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




// -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

// Funkcia na získanie názvu tímu podľa displayId z tabuľky skupiny (LEN PRI 100% ODOHRANÝCH ZÁPASOCH)
function getTeamNameByDisplayId(displayId) {
    if (!displayId) {
        console.log('❌ Nebol zadaný identifikátor tímu');
        return null;
    }
    
    // Parsovanie identifikátora: "U12 D 1A" -> kategória: "U12 D", pozícia: "1", skupina: "A"
    const parts = displayId.trim().split(' ');
    
    if (parts.length < 2) {
        console.log(`❌ Neplatný formát identifikátora: ${displayId}`);
        return null;
    }
    
    // Posledná časť je pozícia + skupina (napr. "1A")
    const positionAndGroup = parts.pop();
    // Zvyšok je názov kategórie (napr. "U12 D")
    const category = parts.join(' ');
    
    // Extrahujeme pozíciu a písmeno skupiny
    let position = '';
    let groupLetter = '';
    
    for (let i = 0; i < positionAndGroup.length; i++) {
        const char = positionAndGroup[i];
        if (char >= '0' && char <= '9') {
            position += char;
        } else if (/[A-Za-z]/.test(char)) {
            groupLetter += char;
        }
    }
    
    if (!position || !groupLetter) {
        console.log(`❌ Neplatný formát pozície/skupiny: ${positionAndGroup} (očakáva sa napr. "1A")`);
        return null;
    }
    
    const positionNum = parseInt(position, 10);
    const fullGroupName = `skupina ${groupLetter.toUpperCase()}`;
    
    console.log(`🔍 Hľadám tím: kategória="${category}", skupina="${fullGroupName}", pozícia=${positionNum}`);
    
    // 1. NAJPRV SKÚSIME VYHĽADAŤ V POUŽÍVATEĽSKÝCH TÍMOCH (user teams)
    // Získame všetky tímy z používateľov (cez window.users alebo window.__teamManagerData)
    let userTeamsList = [];
    
    // Skúsime získať z window.__teamManagerData (najspoľahlivejšie)
    if (window.__teamManagerData?.allTeams) {
        userTeamsList = window.__teamManagerData.allTeams.filter(t => !t.isSuperstructureTeam);
    } 
    // Alebo z globálnej premennej ak je dostupná
    else if (window.allUsersTeams) {
        userTeamsList = window.allUsersTeams;
    }
    
    if (userTeamsList.length > 0) {
        // Hľadáme tím podľa kategórie, skupiny a poradia
        const userTeam = userTeamsList.find(t => 
            t.category === category && 
            t.groupName === fullGroupName && 
            t.order === positionNum
        );
        
        if (userTeam && userTeam.teamName) {
            console.log(`✅ Nájdený používateľský tím: ${userTeam.teamName}`);
            return userTeam.teamName;
        }
    }
    
    // 2. AK NENÁJDENÝ, SKÚSIME SUPERSTRUCTURE TÍMY
    const groupTable = window.matchTracker?.createGroupTable(category, fullGroupName);
    
    if (groupTable && groupTable.teams && groupTable.teams.length > 0) {
        const totalMatches = groupTable.totalMatches || 0;
        const completedMatches = groupTable.completedCount || 0;
        const completionPercentage = totalMatches > 0 ? (completedMatches / totalMatches * 100) : 0;
        
        console.log(`📊 Stav skupiny: ${completedMatches}/${totalMatches} odohraných (${completionPercentage}%)`);
        
        if (completionPercentage < 100) {
            console.log(`❌ Zápasy v skupine nie sú kompletne odohrané! (${completionPercentage}% dokončených)`);
            console.log(`   Pre zobrazenie konečného poradia je potrebné odohrať všetkých ${totalMatches} zápasov.`);
            return null;
        }
        
        const teamIndex = positionNum - 1;
        if (teamIndex >= 0 && teamIndex < groupTable.teams.length) {
            const superstructureTeam = groupTable.teams[teamIndex];
            
            // Ak je to superstructure tím, skúsime ešte raz vyhľadať používateľský tím podľa názvu
            if (superstructureTeam.name && superstructureTeam.name !== displayId) {
                // Skúsime nájsť používateľský tím s rovnakým názvom
                const matchingUserTeam = userTeamsList.find(t => 
                    t.teamName === superstructureTeam.name
                );
                
                if (matchingUserTeam) {
                    console.log(`✅ Nájdený používateľský tím (podľa názvu): ${matchingUserTeam.teamName}`);
                    return matchingUserTeam.teamName;
                }
                
                console.log(`✅ Nájdený superstructure tím: ${superstructureTeam.name} (pozícia ${positionNum} v skupine ${fullGroupName})`);
                return superstructureTeam.name;
            }
        }
    }
    
    console.log(`❌ Tím nebol nájdený: ${displayId}`);
    return null;
}

// Pridáme aj funkciu na vyhľadávanie podľa samostatných parametrov
function getTeamNameByParams(category, groupLetter, position) {
    const displayId = `${category} ${position}${groupLetter.toUpperCase()}`;
    return getTeamNameByDisplayId(displayId);
}

// Pridáme funkciu na získanie kompletných informácií o tíme (vrátane štatistík)
function getTeamInfoByDisplayId(displayId) {
    if (!displayId) {
        console.log('❌ Nebol zadaný identifikátor tímu');
        return null;
    }
    
    const parts = displayId.trim().split(' ');
    if (parts.length < 2) {
        console.log(`❌ Neplatný formát identifikátora: ${displayId}`);
        return null;
    }
    
    const positionAndGroup = parts.pop();
    const category = parts.join(' ');
    
    let position = '';
    let groupLetter = '';
    
    for (let i = 0; i < positionAndGroup.length; i++) {
        const char = positionAndGroup[i];
        if (char >= '0' && char <= '9') {
            position += char;
        } else if (/[A-Za-z]/.test(char)) {
            groupLetter += char;
        }
    }
    
    if (!position || !groupLetter) {
        console.log(`❌ Neplatný formát pozície/skupiny: ${positionAndGroup}`);
        return null;
    }
    
    const positionNum = parseInt(position, 10);
    const fullGroupName = `skupina ${groupLetter.toUpperCase()}`;
    
    const groupTable = window.matchTracker?.createGroupTable(category, fullGroupName);
    
    if (groupTable && groupTable.teams && groupTable.teams.length > 0) {
        const totalMatches = groupTable.totalMatches || 0;
        const completedMatches = groupTable.completedCount || 0;
        const completionPercentage = totalMatches > 0 ? (completedMatches / totalMatches * 100) : 0;
        
        if (completionPercentage < 100) {
            console.log(`❌ Zápasy v skupine nie sú kompletne odohrané! (${completionPercentage}% dokončených)`);
            console.log(`   Pre zobrazenie konečného poradia je potrebné odohrať všetkých ${totalMatches} zápasov.`);
            return null;
        }
        
        const teamIndex = positionNum - 1;
        if (teamIndex >= 0 && teamIndex < groupTable.teams.length) {
            const team = groupTable.teams[teamIndex];
            console.log(`✅ Nájdený tím: ${team.name}`);
            console.log(`   📊 Štatistiky: Zápasy: ${team.played}, Výhry: ${team.wins}, Remízy: ${team.draws}, Prehry: ${team.losses}`);
            console.log(`   🥅 Skóre: ${team.goalsFor}:${team.goalsAgainst} (${team.goalDifference > 0 ? '+' : ''}${team.goalDifference})`);
            console.log(`   📈 Body: ${team.points}`);
            return team;
        }
    }
    
    console.log(`❌ Tím nebol nájdený: ${displayId}`);
    return null;
}

// Export funkcií do window.matchTracker
if (window.matchTracker) {
    window.matchTracker.getTeamNameByDisplayId = getTeamNameByDisplayId;
    window.matchTracker.getTeamNameByParams = getTeamNameByParams;
    window.matchTracker.getTeamInfoByDisplayId = getTeamInfoByDisplayId;
} else {
    window.getTeamNameByDisplayId = getTeamNameByDisplayId;
    window.getTeamNameByParams = getTeamNameByParams;
    window.getTeamInfoByDisplayId = getTeamInfoByDisplayId;
}

console.log('📋 Pridané funkcie (vyhľadávanie LEN pri 100% odohraných zápasoch):');
console.log('   • window.matchTracker.getTeamNameByDisplayId("U12 D 2B") - vráti názov tímu (len ak je skupina dokončená)');
console.log('   • window.matchTracker.getTeamNameByParams("U12 D", "B", 2) - rovnaký výsledok');
console.log('   • window.matchTracker.getTeamInfoByDisplayId("U12 D 2B") - vráti kompletné štatistiky tímu');




























const getCurrentMatchIdFromURLSync = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const homeIdentifier = urlParams.get('domaci');
    const awayIdentifier = urlParams.get('hostia');
    
    if (homeIdentifier && awayIdentifier) {
        return `${homeIdentifier}_${awayIdentifier}`;
    }
    return null;
};

// Funkcia na vyhľadanie všetkých tímov v aktuálnom DOM
function findAllTeamsInDOM() {
    console.log('🔍 Vyhľadávam všetky tímy v aktuálnom DOM...');
    
    const allTeamElements = document.querySelectorAll('[data-original-identifier]');
    
    if (allTeamElements.length === 0) {
        console.log('❌ V DOM sa nenašli žiadne elementy s atribútom data-original-identifier');
        return [];
    }
    
    const teamsMap = new Map();
    
    allTeamElements.forEach(el => {
        const identifier = el.getAttribute('data-original-identifier');
        const teamName = el.getAttribute('data-team-name');
        const category = el.getAttribute('data-team-category');
        
        if (identifier && teamName && teamName !== identifier) {
            if (!teamsMap.has(identifier)) {
                teamsMap.set(identifier, {
                    identifier: identifier,
                    teamName: teamName,
                    category: category
                });
            }
        }
    });
    
    const teams = Array.from(teamsMap.values());
    
    console.log(`📋 Nájdených ${teams.length} unikátnych tímov v DOM:`);
    teams.forEach((team, idx) => {
        console.log(`   ${idx + 1}. ${team.identifier} → "${team.teamName}" (${team.category || 'neznáma kategória'})`);
    });
    
    return teams;
}

// Funkcia na získanie názvu tímu z DOM elementu podľa identifikátora
function getTeamNameFromDOM(identifier) {
    if (!identifier) return null;
    
    // Skúsime nájsť element s atribútom data-original-identifier
    const elements = document.querySelectorAll(`[data-original-identifier="${identifier}"]`);
    if (elements.length > 0) {
        const teamName = elements[0].getAttribute('data-team-name');
        if (teamName && teamName !== identifier) {
            return teamName;
        }
    }
    
    // Skúsime nájsť element, ktorý obsahuje tento identifikátor v texte
    const allElements = document.querySelectorAll('*');
    for (const element of allElements) {
        if (element.children.length > 0) continue;
        const text = element.textContent;
        if (text && text.includes(identifier) && element.getAttribute('data-team-name')) {
            return element.getAttribute('data-team-name');
        }
    }
    
    return null;
}

// Funkcia na vykreslenie informácií o tíme do DOM
function renderTeamInfoToDOM(teamInfo, teamName, categoryName) {
    if (!teamInfo) return;
    
    // Vytvoríme alebo nájdeme kontajner pre výsledky
    let resultsContainer = document.getElementById('team-search-results');
    if (!resultsContainer) {
        resultsContainer = document.createElement('div');
        resultsContainer.id = 'team-search-results';
        resultsContainer.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            width: 400px;
            max-height: 80vh;
            overflow-y: auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            z-index: 10000;
            font-family: system-ui, -apple-system, sans-serif;
            font-size: 14px;
            border: 1px solid #e5e7eb;
        `;
        document.body.appendChild(resultsContainer);
        
        // Pridáme tlačidlo na zatvorenie
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '✕';
        closeBtn.style.cssText = `
            position: sticky;
            top: 10px;
            right: 10px;
            float: right;
            background: #f3f4f6;
            border: none;
            border-radius: 20px;
            width: 28px;
            height: 28px;
            cursor: pointer;
            font-size: 14px;
            z-index: 10001;
        `;
        closeBtn.onclick = () => {
            resultsContainer.remove();
        };
        resultsContainer.appendChild(closeBtn);
    }
    
    // Vyčistíme kontajner (okrem tlačidla zatvorenia)
    const closeButton = resultsContainer.querySelector('button');
    resultsContainer.innerHTML = '';
    if (closeButton) resultsContainer.appendChild(closeButton);
    
    // Vytvoríme HTML obsah
    const html = `
        <div style="padding: 16px;">
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                <div style="font-size: 18px; font-weight: bold;">✅ ${escapeHtml(teamInfo.team.teamName)}</div>
                <div style="font-size: 12px; opacity: 0.9;">${escapeHtml(categoryName)}</div>
            </div>
            
            <div style="margin-bottom: 16px;">
                <div style="font-weight: bold; color: #374151; margin-bottom: 8px; border-bottom: 2px solid #e5e7eb; padding-bottom: 4px;">
                    📋 INFORMÁCIE O TÍME
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px;">
                    <div><span style="color: #6b7280;">Skupina:</span> <strong>${escapeHtml(teamInfo.team.groupName || '—')}</strong></div>
                    <div><span style="color: #6b7280;">Poradie:</span> <strong>${escapeHtml(teamInfo.team.order?.toString() || '—')}</strong></div>
                    <div><span style="color: #6b7280;">Počet hráčov:</span> <strong>${teamInfo.team.playerDetails?.length || 0}</strong></div>
                    <div><span style="color: #6b7280;">Muži v RT:</span> <strong>${teamInfo.team.menTeamMemberDetails?.length || 0}</strong></div>
                    <div><span style="color: #6b7280;">Ženy v RT:</span> <strong>${teamInfo.team.womenTeamMemberDetails?.length || 0}</strong></div>
                </div>
            </div>
            
            ${teamInfo.team.playerDetails && teamInfo.team.playerDetails.length > 0 ? `
            <div style="margin-bottom: 16px;">
                <div style="font-weight: bold; color: #374151; margin-bottom: 8px; border-bottom: 2px solid #e5e7eb; padding-bottom: 4px;">
                    👥 HRÁČI (${teamInfo.team.playerDetails.length})
                </div>
                <div style="max-height: 200px; overflow-y: auto;">
                    <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f3f4f6;">
                                <th style="padding: 6px; text-align: left;">Č.</th>
                                <th style="padding: 6px; text-align: left;">Meno a priezvisko</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${teamInfo.team.playerDetails.map((player, idx) => `
                                <tr style="border-bottom: 1px solid #f3f4f6;">
                                    <td style="padding: 6px; font-weight: bold; color: #6b7280;">${escapeHtml(player.jerseyNumber || '?')}</td>
                                    <td style="padding: 6px;">${escapeHtml(player.lastName || '')} ${escapeHtml(player.firstName || '')}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            ` : ''}
            
            ${teamInfo.team.menTeamMemberDetails && teamInfo.team.menTeamMemberDetails.length > 0 ? `
            <div style="margin-bottom: 16px;">
                <div style="font-weight: bold; color: #374151; margin-bottom: 8px; border-bottom: 2px solid #e5e7eb; padding-bottom: 4px;">
                    👨‍🏫 REALIZAČNÝ TÍM - MUŽI (${teamInfo.team.menTeamMemberDetails.length})
                </div>
                <div>
                    ${teamInfo.team.menTeamMemberDetails.map(member => `
                        <div style="padding: 6px 0; border-bottom: 1px solid #f3f4f6;">${escapeHtml(member.lastName || '')} ${escapeHtml(member.firstName || '')}</div>
                    `).join('')}
                </div>
            </div>
            ` : ''}
            
            ${teamInfo.team.womenTeamMemberDetails && teamInfo.team.womenTeamMemberDetails.length > 0 ? `
            <div style="margin-bottom: 16px;">
                <div style="font-weight: bold; color: #374151; margin-bottom: 8px; border-bottom: 2px solid #e5e7eb; padding-bottom: 4px;">
                    👩‍🏫 REALIZAČNÝ TÍM - ŽENY (${teamInfo.team.womenTeamMemberDetails.length})
                </div>
                <div>
                    ${teamInfo.team.womenTeamMemberDetails.map(member => `
                        <div style="padding: 6px 0; border-bottom: 1px solid #f3f4f6;">${escapeHtml(member.lastName || '')} ${escapeHtml(member.firstName || '')}</div>
                    `).join('')}
                </div>
            </div>
            ` : ''}
            
            <div style="background: #f9fafb; padding: 12px; border-radius: 8px; margin-top: 8px;">
                <div style="font-weight: bold; color: #374151; margin-bottom: 8px;">
                    👤 POUŽÍVATEĽ
                </div>
                <div style="font-size: 13px;">
                    <div><span style="color: #6b7280;">Email:</span> ${escapeHtml(teamInfo.user.email || '—')}</div>
                    <div><span style="color: #6b7280;">Meno:</span> ${escapeHtml(teamInfo.user.displayName || '—')}</div>
                    <div><span style="color: #6b7280;">Rola:</span> <span style="color: ${teamInfo.user.role === 'admin' ? '#dc2626' : '#6b7280'}">${escapeHtml(teamInfo.user.role || 'user')}</span></div>
                    <div><span style="color: #6b7280;">Schválený:</span> ${teamInfo.user.approved ? '✅ Áno' : '❌ Nie'}</div>
                    ${teamInfo.user.hallId ? `<div><span style="color: #6b7280;">ID haly:</span> ${escapeHtml(teamInfo.user.hallId)}</div>` : ''}
                </div>
            </div>
        </div>
    `;
    
    resultsContainer.insertAdjacentHTML('beforeend', html);
}

// Pomocná funkcia na escapovanie HTML
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ============================================================
// KOMPLETNE OPRAVENÁ FUNKCIA: findTeamByNameAndCategory (ASYNC)
// ============================================================

async function findTeamByNameAndCategory(teamName, categoryName, renderToDOM = true) {
    if (!teamName || !categoryName) {
        console.log('❌ Je potrebné zadať názov tímu a kategóriu');
        console.log('Použitie: findTeamByNameAndCategory("Názov tímu", "Kategória")');
        return null;
    }
    
    // 🔄 NAJPRV POUŽIJEME MAPPING NA PREVOD NÁZVU TÍMU
    let actualTeamName = teamName;
    if (window.teamNameReplacer && typeof window.teamNameReplacer.getTeamNameFromMapping === 'function') {
        const mappedName = window.teamNameReplacer.getTeamNameFromMapping(teamName);
        if (mappedName && mappedName !== teamName) {
            console.log(`🔄 Názov tímu bol zmapovaný: "${teamName}" → "${mappedName}"`);
            actualTeamName = mappedName;
        } else if (mappedName) {
            console.log(`✅ Názov tímu už je správny: "${teamName}"`);
            actualTeamName = mappedName;
        } else {
            console.log(`⚠️ Žiadne mapovanie pre názov: "${teamName}", používam pôvodný`);
        }
    } else {
        console.log(`⚠️ window.teamNameReplacer.getTeamNameFromMapping nie je dostupný, používam pôvodný názov: "${teamName}"`);
    }
    
    console.log(`🔍 Hľadám tím: "${actualTeamName}" v kategórii: "${categoryName}"`);
    
    // Získame všetkých používateľov z window.users (ak existuje)
    let allUsers = [];
    
    if (window.users && Array.isArray(window.users) && window.users.length > 0) {
        allUsers = window.users;
    } else if (window.__users && Array.isArray(window.__users) && window.__users.length > 0) {
        allUsers = window.__users;
    } else {
        console.log('⚠️ window.users nie je dostupný, skúšam načítať z Firebase...');
        if (window.db) {
            try {
                const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");
                const usersRef = collection(window.db, 'users');
                const querySnapshot = await getDocs(usersRef);
                const usersList = [];
                querySnapshot.forEach((doc) => {
                    usersList.push({ id: doc.id, ...doc.data() });
                });
                window.users = usersList;
                console.log(`📦 Načítaných ${usersList.length} používateľov z Firebase`);
                allUsers = usersList;
            } catch (error) {
                console.error('❌ Chyba pri načítaní používateľov:', error);
                return null;
            }
        } else {
            console.log('❌ window.db nie je k dispozícii');
            return null;
        }
    }
    
    console.log(`📋 Celkový počet používateľov: ${allUsers.length}`);
    
    const foundTeams = [];
    
    for (const user of allUsers) {
        if (!user.teams) continue;
        
        for (const [category, teams] of Object.entries(user.teams)) {
            if (category.toLowerCase() !== categoryName.toLowerCase()) continue;
            
            if (!Array.isArray(teams)) continue;
            
            const team = teams.find(t => t.teamName && t.teamName.toLowerCase() === actualTeamName.toLowerCase());
            
            if (team) {
                foundTeams.push({
                    user: {
                        id: user.id,
                        email: user.email,
                        displayName: user.displayName,
                        role: user.role,
                        approved: user.approved,
                        hallId: user.hallId,
                        createdAt: user.createdAt
                    },
                    team: team,
                    category: category
                });
            }
        }
    }
    
    if (foundTeams.length === 0) {
        console.log(`❌ Tím "${actualTeamName}" v kategórii "${categoryName}" nebol nájdený`);
        return null;
    }
    
    if (foundTeams.length > 1) {
        console.log(`⚠️ Nájdených ${foundTeams.length} tímov s rovnakým názvom:`);
        foundTeams.forEach((item, index) => {
            console.log(`\n${index + 1}. Používateľ: ${item.user.email} (${item.user.displayName || 'bez mena'})`);
            console.log(`   Tím: ${item.team.teamName}`);
            console.log(`   Kategória: ${item.category}`);
            console.log(`   Skupina: ${item.team.groupName}`);
            console.log(`   Poradie: ${item.team.order}`);
        });
        
        // Ak je viac výsledkov, vykreslíme zoznam do DOM
        if (renderToDOM) {
            renderMultipleTeamsToDOM(foundTeams, actualTeamName, categoryName);
        }
        
        return foundTeams;
    }
    
    const result = foundTeams[0];
    
    // Výpis do konzoly
    console.log('\n' + '='.repeat(70));
    console.log(`✅ NÁJDENÝ TÍM: "${result.team.teamName}"`);
    console.log('='.repeat(70));
    
    console.log('\n📋 INFORMÁCIE O TÍME:');
    console.log(`   • Názov tímu: ${result.team.teamName}`);
    console.log(`   • Kategória: ${result.category}`);
    console.log(`   • Skupina: ${result.team.groupName}`);
    console.log(`   • Poradie v skupine: ${result.team.order}`);
    console.log(`   • Počet hráčov: ${result.team.playerDetails?.length || 0}`);
    console.log(`   • Muži v RT: ${result.team.menTeamMemberDetails?.length || 0}`);
    console.log(`   • Ženy v RT: ${result.team.womenTeamMemberDetails?.length || 0}`);
    
    if (result.team.playerDetails && result.team.playerDetails.length > 0) {
        console.log('\n👥 HRÁČI:');
        result.team.playerDetails.forEach((player, idx) => {
            console.log(`   ${idx + 1}. ${player.lastName} ${player.firstName} (č. dresu: ${player.jerseyNumber || '?'})`);
        });
    }
    
    if (result.team.menTeamMemberDetails && result.team.menTeamMemberDetails.length > 0) {
        console.log('\n👨‍🏫 REALIZAČNÝ TÍM - MUŽI:');
        result.team.menTeamMemberDetails.forEach((member, idx) => {
            console.log(`   ${idx + 1}. ${member.lastName} ${member.firstName}`);
        });
    }
    
    if (result.team.womenTeamMemberDetails && result.team.womenTeamMemberDetails.length > 0) {
        console.log('\n👩‍🏫 REALIZAČNÝ TÍM - ŽENY:');
        result.team.womenTeamMemberDetails.forEach((member, idx) => {
            console.log(`   ${idx + 1}. ${member.lastName} ${member.firstName}`);
        });
    }
    
    console.log('\n👤 INFORMÁCIE O POUŽÍVATEĽOVI:');
    console.log(`   • ID: ${result.user.id}`);
    console.log(`   • Email: ${result.user.email}`);
    console.log(`   • Meno: ${result.user.displayName || 'nezadané'}`);
    console.log(`   • Rola: ${result.user.role || 'user'}`);
    console.log(`   • Schválený: ${result.user.approved ? 'Áno' : 'Nie'}`);
    if (result.user.hallId) {
        console.log(`   • ID haly: ${result.user.hallId}`);
    }
    if (result.user.createdAt) {
        const createdDate = result.user.createdAt.toDate ? result.user.createdAt.toDate() : new Date(result.user.createdAt);
        console.log(`   • Dátum registrácie: ${createdDate.toLocaleDateString('sk-SK')}`);
    }
    
    console.log('\n' + '='.repeat(70));
    
    // VYKRESLENIE DO DOM
    if (renderToDOM) {
        renderTeamInfoToDOM(result, actualTeamName, categoryName);
    }
    
    return result;
}

// Funkcia na vykreslenie viacerých tímov do DOM
function renderMultipleTeamsToDOM(teamsList, searchTeamName, searchCategory) {
    let resultsContainer = document.getElementById('team-search-results');
    if (!resultsContainer) {
        resultsContainer = document.createElement('div');
        resultsContainer.id = 'team-search-results';
        resultsContainer.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            width: 450px;
            max-height: 80vh;
            overflow-y: auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            z-index: 10000;
            font-family: system-ui, -apple-system, sans-serif;
            font-size: 14px;
            border: 1px solid #e5e7eb;
        `;
        document.body.appendChild(resultsContainer);
        
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '✕';
        closeBtn.style.cssText = `
            position: sticky;
            top: 10px;
            right: 10px;
            float: right;
            background: #f3f4f6;
            border: none;
            border-radius: 20px;
            width: 28px;
            height: 28px;
            cursor: pointer;
            font-size: 14px;
            z-index: 10001;
        `;
        closeBtn.onclick = () => {
            resultsContainer.remove();
        };
        resultsContainer.appendChild(closeBtn);
    }
    
    const closeButton = resultsContainer.querySelector('button');
    resultsContainer.innerHTML = '';
    if (closeButton) resultsContainer.appendChild(closeButton);
    
    let html = `
        <div style="padding: 16px;">
            <div style="background: #fef3c7; color: #92400e; padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                <div style="font-size: 16px; font-weight: bold;">⚠️ Nájdených ${teamsList.length} tímov</div>
                <div style="font-size: 12px;">Hľadaný názov: "${escapeHtml(searchTeamName)}" v kategórii "${escapeHtml(searchCategory)}"</div>
            </div>
    `;
    
    teamsList.forEach((item, index) => {
        html += `
            <div style="margin-bottom: 16px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                <div style="background: #f3f4f6; padding: 10px; font-weight: bold; cursor: pointer; display: flex; justify-content: space-between; align-items: center;" 
                     onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
                    <span>${index + 1}. ${escapeHtml(item.team.teamName)}</span>
                    <span style="font-size: 12px; color: #6b7280;">▼</span>
                </div>
                <div style="display: none; padding: 12px;">
                    <div style="margin-bottom: 12px;">
                        <div><span style="color: #6b7280;">Kategória:</span> <strong>${escapeHtml(item.category)}</strong></div>
                        <div><span style="color: #6b7280;">Skupina:</span> <strong>${escapeHtml(item.team.groupName || '—')}</strong></div>
                        <div><span style="color: #6b7280;">Poradie:</span> <strong>${escapeHtml(item.team.order?.toString() || '—')}</strong></div>
                    </div>
                    <div style="background: #f9fafb; padding: 8px; border-radius: 6px;">
                        <div style="font-weight: bold; margin-bottom: 4px;">👤 Používateľ:</div>
                        <div style="font-size: 12px;">${escapeHtml(item.user.email || '—')} (${escapeHtml(item.user.displayName || '—')})</div>
                        <div style="font-size: 12px;">Rola: ${escapeHtml(item.user.role || 'user')}</div>
                    </div>
                    <button onclick="findTeamByNameAndCategory('${escapeHtml(item.team.teamName)}', '${escapeHtml(item.category)}', true)" 
                            style="margin-top: 10px; width: 100%; padding: 6px; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer;">
                        Zobraziť detail
                    </button>
                </div>
            </div>
        `;
    });
    
    html += `</div>`;
    resultsContainer.insertAdjacentHTML('beforeend', html);
}

// UPRAVENÁ FUNKCIA: findTeamByIdentifierFromDOM - teraz aj vykresľuje do DOM
function findTeamByIdentifierFromDOM(identifier, renderToDOM = true) {
    if (!identifier) return null;
    
    console.log(`🔍 Vyhľadávam tím podľa identifikátora: "${identifier}"`);
    
    // Najprv skúsime nájsť v DOM
    const elements = document.querySelectorAll(`[data-original-identifier="${identifier}"]`);
    if (elements.length > 0) {
        const teamName = elements[0].getAttribute('data-team-name');
        const category = elements[0].getAttribute('data-team-category');
        
        if (teamName && teamName !== identifier && category) {
            console.log(`   → Nájdený v DOM: "${teamName}" (kategória: ${category})`);
            return findTeamByNameAndCategory(teamName, category, renderToDOM);
        }
    }
    
    // Ak nie je v DOM, parsujeme identifikátor
    const parts = identifier.trim().split(' ');
    if (parts.length < 2) {
        console.log(`❌ Neplatný formát identifikátora: ${identifier}`);
        return null;
    }
    
    const positionAndGroup = parts.pop();
    const category = parts.join(' ');
    
    let position = '';
    let groupLetter = '';
    for (let i = 0; i < positionAndGroup.length; i++) {
        const char = positionAndGroup[i];
        if (char >= '0' && char <= '9') {
            position += char;
        } else if (/[A-Za-z]/.test(char)) {
            groupLetter += char;
        }
    }
    
    if (!position || !groupLetter) return null;
    
    const positionNum = parseInt(position, 10);
    const fullGroupName = `skupina ${groupLetter.toUpperCase()}`;
    
    console.log(`   → Parsovaný identifikátor: kategória="${category}", skupina="${fullGroupName}", poradie=${positionNum}`);
    
    let allUsers = window.users || window.__users || [];
    
    for (const user of allUsers) {
        if (!user.teams) continue;
        
        for (const [userCategory, teams] of Object.entries(user.teams)) {
            if (userCategory.toLowerCase() !== category.toLowerCase()) continue;
            
            if (!Array.isArray(teams)) continue;
            
            const team = teams.find(t => 
                t.groupName === fullGroupName && 
                t.order === positionNum
            );
            
            if (team) {
                console.log(`   ✅ Nájdený tím: ${team.teamName} (používateľ: ${user.email})`);
                const result = {
                    user: user,
                    team: team,
                    category: userCategory
                };
                
                if (renderToDOM) {
                    renderTeamInfoToDOM(result, team.teamName, userCategory);
                }
                
                return result;
            }
        }
    }
    
    console.log(`   ❌ Tím nebol nájdený: ${identifier}`);
    return null;
}

// UPRAVENÁ FUNKCIA: findCurrentMatchTeamsFromDOM - teraz aj vykresľuje do DOM
function findCurrentMatchTeamsFromDOM(renderToDOM = true) {
    console.log('🔍 Získavam aktuálny zápas z DOM (nie z URL)...');
    
    const allTeamElements = document.querySelectorAll('[data-original-identifier]');
    
    if (allTeamElements.length === 0) {
        console.log('❌ V DOM sa nenašli žiadne elementy s atribútom data-original-identifier');
        return null;
    }
    
    const identifiers = new Set();
    allTeamElements.forEach(el => {
        const identifier = el.getAttribute('data-original-identifier');
        if (identifier) identifiers.add(identifier);
    });
    
    console.log(`📋 Nájdených identifikátorov v DOM: ${identifiers.size}`);
    
    const teamsInfo = [];
    
    for (const identifier of identifiers) {
        const elements = document.querySelectorAll(`[data-original-identifier="${identifier}"]`);
        if (elements.length > 0) {
            const teamName = elements[0].getAttribute('data-team-name');
            const category = elements[0].getAttribute('data-team-category');
            
            if (teamName && teamName !== identifier) {
                teamsInfo.push({
                    identifier: identifier,
                    teamName: teamName,
                    category: category
                });
                console.log(`   • ${identifier} → "${teamName}" (kategória: ${category})`);
            }
        }
    }
    
    if (teamsInfo.length === 0) {
        console.log('❌ Nepodarilo sa získať názvy tímov z DOM');
        return null;
    }
    
    const results = {};
    
    for (const teamInfo of teamsInfo) {
        console.log(`\n🔍 Vyhľadávam tím "${teamInfo.teamName}" v kategórii "${teamInfo.category}"...`);
        const result = findTeamByNameAndCategory(teamInfo.teamName, teamInfo.category, false);
        
        if (result && !Array.isArray(result)) {
            if (Object.keys(results).length === 0) {
                results.home = result;
            } else if (Object.keys(results).length === 1) {
                results.away = result;
            } else {
                results[`team_${Object.keys(results).length + 1}`] = result;
            }
        }
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('📊 VÝSLEDOK VYHĽADÁVANIA:');
    console.log('='.repeat(70));
    
    if (results.home) {
        console.log(`\n🏠 DOMÁCI TÍM: ${results.home.team.teamName}`);
        console.log(`   • Používateľ: ${results.home.user.email}`);
    }
    
    if (results.away) {
        console.log(`\n✈️ HOSŤOVSKÝ TÍM: ${results.away.team.teamName}`);
        console.log(`   • Používateľ: ${results.away.user.email}`);
    }
    
    console.log('\n' + '='.repeat(70));
    
    return results;
}

const findCurrentMatchFromDOM = async (renderToDOM = true, autoSetTeams = true) => {
    console.log('🔍 Získavam aktuálny zápas z DOM (nie z URL)...');
    
    const allTeamElements = document.querySelectorAll('[data-original-identifier]');
    
    if (allTeamElements.length === 0) {
        console.log('❌ V DOM sa nenašli žiadne elementy s atribútom data-original-identifier');
        return null;
    }
    
    const identifiers = new Set();
    allTeamElements.forEach(el => {
        const identifier = el.getAttribute('data-original-identifier');
        if (identifier) identifiers.add(identifier);
    });
    
    console.log(`📋 Nájdených identifikátorov v DOM: ${identifiers.size}`);
    
    const teamsInfo = [];
    
    for (const identifier of identifiers) {
        const elements = document.querySelectorAll(`[data-original-identifier="${identifier}"]`);
        if (elements.length > 0) {
            const teamName = elements[0].getAttribute('data-team-name');
            const category = elements[0].getAttribute('data-team-category');
            
            if (teamName && teamName !== identifier) {
                teamsInfo.push({
                    identifier: identifier,
                    teamName: teamName,
                    category: category
                });
                console.log(`   • ${identifier} → "${teamName}" (kategória: ${category})`);
            }
        }
    }
    
    if (teamsInfo.length === 0) {
        console.log('❌ Nepodarilo sa získať názvy tímov z DOM');
        return null;
    }
    
    const results = {};
    
    for (const teamInfo of teamsInfo) {
        console.log(`\n🔍 Vyhľadávam tím "${teamInfo.teamName}" v kategórii "${teamInfo.category}"...`);
        const result = findTeamByNameAndCategory(teamInfo.teamName, teamInfo.category, false);
        
        if (result && !Array.isArray(result)) {
            if (Object.keys(results).length === 0) {
                results.home = result;
            } else if (Object.keys(results).length === 1) {
                results.away = result;
            } else {
                results[`team_${Object.keys(results).length + 1}`] = result;
            }
        }
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('📊 VÝSLEDOK VYHĽADÁVANIA:');
    console.log('='.repeat(70));
    
    if (results.home) {
        console.log(`\n🏠 DOMÁCI TÍM: ${results.home.team.teamName}`);
        console.log(`   • Kategória: ${results.home.category}`);
        console.log(`   • Používateľ: ${results.home.user.email}`);
    }
    
    if (results.away) {
        console.log(`\n✈️ HOSŤOVSKÝ TÍM: ${results.away.team.teamName}`);
        console.log(`   • Kategória: ${results.away.category}`);
        console.log(`   • Používateľ: ${results.away.user.email}`);
    }
    
    console.log('\n' + '='.repeat(70));
    
    // AUTOMATICKÉ NASTAVENIE TÍMOV
    if (autoSetTeams && results.home && results.away) {
        console.log('\n🚀 AUTOMATICKÉ NASTAVENIE TÍMOV:');
        console.log(`   setBothTeamsDetails("${results.home.team.teamName}", "${results.home.category}", "${results.away.team.teamName}", "${results.away.category}")`);
        
        await window.setBothTeamsDetails(
            results.home.team.teamName, 
            results.home.category, 
            results.away.team.teamName, 
            results.away.category
        );
        
        console.log('✅ Tímy boli automaticky nastavené!');
    } else if (autoSetTeams && (!results.home || !results.away)) {
        console.log('⚠️ Neboli nájdené oba tímy, automatické nastavenie preskočené.');
    }
    
    return results;
};

// Prepíšeme pôvodnú funkciu
window.findCurrentMatchFromDOM = findCurrentMatchFromDOM;

const setupPermanentTeamListeners = () => {
    // Poslúchač pre domáci tím
    const handleSetHomeTeamPermanent = (event) => {
        const teamDetails = event.detail.teamDetails;
        const matchId = event.detail.matchId;
        
        console.log(`🏠 PERMANENTNÝ POSLÚCHAČ: Domáci tím nastavený: ${teamDetails.team.teamName}`);
        console.log(`   📧 Používateľ: ${teamDetails.user.email}`);
        console.log(`   👥 Počet hráčov: ${teamDetails.team.playerDetails?.length || 0}`);
        
        // Manuálne aktualizujeme DOM - vykreslíme hráčov a RT
        renderTeamToDOM(teamDetails, 'home');
        
        // Uložíme do globálnej premennej
        window._homeTeamDetails = teamDetails;
    };
    
    // Poslúchač pre hosťovský tím
    const handleSetAwayTeamPermanent = (event) => {
        const teamDetails = event.detail.teamDetails;
        const matchId = event.detail.matchId;
        
        console.log(`✈️ PERMANENTNÝ POSLÚCHAČ: Hosťovský tím nastavený: ${teamDetails.team.teamName}`);
        console.log(`   📧 Používateľ: ${teamDetails.user.email}`);
        console.log(`   👥 Počet hráčov: ${teamDetails.team.playerDetails?.length || 0}`);
        
        // Manuálne aktualizujeme DOM - vykreslíme hráčov a RT
        renderTeamToDOM(teamDetails, 'away');
        
        // Uložíme do globálnej premennej
        window._awayTeamDetails = teamDetails;
    };
    
    window.addEventListener('setHomeTeamDetails', handleSetHomeTeamPermanent);
    window.addEventListener('setAwayTeamDetails', handleSetAwayTeamPermanent);
    
    console.log('✅ Permanentné poslúchače boli nastavené');
};

// Funkcia na manuálne vykreslenie tímu do DOM
const renderTeamToDOM = (teamDetails, teamType) => {
    // Nájdeme kontajnery pre tím
    const teamContainer = document.querySelector(`.${teamType === 'home' ? 'bg-gray-50 rounded-lg p-4 border border-gray-200' : 'bg-gray-50 rounded-lg p-4 border border-gray-200'}`);
    
    // Nájdeme všetky kontajnery (prvý je domáci, tretí je hosťovský v 4-stĺpcovom gride)
    const containers = document.querySelectorAll('.grid-cols-4 > div');
    
    if (containers.length >= 3) {
        const homeContainer = containers[0];  // Domáci tím
        const awayContainer = containers[2];  // Hosťovský tím
        
        const targetContainer = teamType === 'home' ? homeContainer : awayContainer;
        
        if (targetContainer) {
            // Nájdeme sekciu Hráči v tomto kontajneri
            const playersSection = targetContainer.querySelector('.mb-4:last-child, .mb-4:nth-child(2)');
            if (playersSection) {
                // Vymažeme existujúci zoznam hráčov (okrem nadpisu)
                const existingPlayers = playersSection.querySelectorAll('.space-y-1 > div, .flex.items-center');
                existingPlayers.forEach(el => {
                    if (!el.closest('h4')) {
                        el.remove();
                    }
                });
                
                // Vykreslíme hráčov
                const activePlayers = teamDetails.team.playerDetails?.filter(p => p && !p.removedForMatch) || [];
                
                activePlayers.sort((a, b) => {
                    const numA = a.jerseyNumber ? parseInt(a.jerseyNumber) || 999 : 999;
                    const numB = b.jerseyNumber ? parseInt(b.jerseyNumber) || 999 : 999;
                    return numA - numB;
                });
                
                const playersListDiv = playersSection.querySelector('.space-y-1') || playersSection;
                
                activePlayers.forEach(player => {
                    const playerDiv = document.createElement('div');
                    playerDiv.className = 'flex items-center justify-between gap-2 p-2 rounded border border-gray-200 text-sm group relative transition-colors';
                    playerDiv.innerHTML = `
                        <div class="flex items-center gap-2">
                            <i class="fa-solid fa-shirt text-gray-600 text-xs flex-shrink-0"></i>
                            ${player.jerseyNumber ? `<span class="font-bold text-gray-700 text-xs bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0">${player.jerseyNumber}</span>` : ''}
                            <span class="font-medium truncate">${player.lastName} ${player.firstName}</span>
                        </div>
                    `;
                    playersListDiv.appendChild(playerDiv);
                });
                
                console.log(`✅ Vykreslených ${activePlayers.length} hráčov pre ${teamType === 'home' ? 'domáci' : 'hosťovský'} tím`);
            }
            
            // Vykreslíme realizačný tím
            const staffSection = targetContainer.querySelector('.mb-4:first-child');
            if (staffSection) {
                const existingStaff = staffSection.querySelectorAll('.space-y-2 > div, .flex.items-center');
                existingStaff.forEach(el => {
                    if (!el.closest('h4')) {
                        el.remove();
                    }
                });
                
                const activeMenStaff = teamDetails.team.menTeamMemberDetails?.filter(m => !m.removedForMatch) || [];
                const activeWomenStaff = teamDetails.team.womenTeamMemberDetails?.filter(m => !m.removedForMatch) || [];
                
                const staffListDiv = staffSection.querySelector('.space-y-2') || staffSection;
                
                [...activeMenStaff, ...activeWomenStaff].forEach(member => {
                    const staffDiv = document.createElement('div');
                    staffDiv.className = 'flex items-center justify-between gap-2 p-2 rounded border border-gray-200 text-sm group relative transition-colors';
                    staffDiv.innerHTML = `
                        <div class="flex items-center gap-2">
                            <i class="fa-solid fa-user text-gray-600 text-xs flex-shrink-0"></i>
                            <span class="font-medium truncate">${member.lastName} ${member.firstName}</span>
                        </div>
                    `;
                    staffListDiv.appendChild(staffDiv);
                });
                
                console.log(`✅ Vykreslených ${activeMenStaff.length + activeWomenStaff.length} členov RT pre ${teamType === 'home' ? 'domáci' : 'hosťovský'} tím`);
            }
        }
    }
};

// ============================================================
// AKTUALIZOVANÁ FUNKCIA quickSetup() S VYKRESLENÍM DO UI
// ============================================================

// UPRAVENÁ FUNKCIA renderPlayersToUI - vymaže staré údaje a zobrazí správne
const renderPlayersToUI = (teamDetails, teamType, container) => {
    if (!container) return;
    
    // Nájdeme sekciu Hráči (podľa nadpisu)
    const playersSection = Array.from(container.querySelectorAll('.mb-4')).find(section => 
        section.querySelector('h4')?.textContent?.includes('Hráči')
    );
    
    if (!playersSection) return;
    
    // Odstránime existujúci zoznam hráčov (okrem nadpisu)
    const existingPlayersList = playersSection.querySelector('.space-y-1, .space-y-2');
    if (existingPlayersList) {
        existingPlayersList.innerHTML = '';
    } else {
        // Ak neexistuje kontajner, vytvoríme ho
        const newListDiv = document.createElement('div');
        newListDiv.className = 'space-y-1';
        playersSection.appendChild(newListDiv);
    }
    
    const playersListDiv = playersSection.querySelector('.space-y-1') || playersSection.querySelector('.space-y-2');
    if (!playersListDiv) return;
    
    // Ak nie sú detaily tímu, zobrazíme "Nedostupné"
    if (!teamDetails) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'text-sm text-gray-500 italic p-2';
        emptyDiv.textContent = 'Nedostupné';
        playersListDiv.appendChild(emptyDiv);
        
        const playersHeader = playersSection.querySelector('h4');
        if (playersHeader) {
            playersHeader.innerHTML = `<i class="fa-solid fa-users text-xs text-gray-500"></i> Hráči (0)`;
        }
        return;
    }
    
    // Získame aktívnych hráčov
    const activePlayers = teamDetails?.team.playerDetails?.filter(p => p && !p.removedForMatch?.[window.currentMatchId]) || [];
    
    // Zoradenie podľa čísla dresu
    activePlayers.sort((a, b) => {
        const numA = a.jerseyNumber ? parseInt(a.jerseyNumber) || 999 : 999;
        const numB = b.jerseyNumber ? parseInt(b.jerseyNumber) || 999 : 999;
        return numA - numB;
    });
    
    if (activePlayers.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'text-sm text-gray-500 italic p-2';
        emptyDiv.textContent = 'Žiadni hráči';
        playersListDiv.appendChild(emptyDiv);
    } else {
        // Vykreslíme hráčov
        activePlayers.forEach(player => {
            const playerDiv = document.createElement('div');
            playerDiv.className = 'flex items-center justify-between gap-2 p-2 rounded border border-gray-200 text-sm group relative transition-colors hover:bg-blue-50 cursor-pointer';
            playerDiv.setAttribute('data-player-id', `${teamDetails.userId}_${player.jerseyNumber || ''}_${player.lastName}`);
            playerDiv.innerHTML = `
                <div class="flex items-center gap-2">
                    <i class="fa-solid fa-shirt text-gray-600 text-xs flex-shrink-0"></i>
                    ${player.jerseyNumber ? `<span class="font-bold text-gray-700 text-xs bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0">${player.jerseyNumber}</span>` : ''}
                    <span class="font-medium truncate">${player.lastName || ''} ${player.firstName || ''}</span>
                </div>
            `;
            playersListDiv.appendChild(playerDiv);
        });
    }
    
    console.log(`   ✅ Vykreslených ${activePlayers.length} hráčov pre ${teamType === 'home' ? 'domáci' : 'hosťovský'} tím`);
    
    // Aktualizujeme aj počty v nadpise
    const playersHeader = playersSection.querySelector('h4');
    if (playersHeader) {
        playersHeader.innerHTML = `<i class="fa-solid fa-users text-xs text-gray-500"></i> Hráči (${activePlayers.length})`;
    }
};

// UPRAVENÁ FUNKCIA renderStaffToUI - vymaže staré údaje a zobrazí správne
const renderStaffToUI = (teamDetails, teamType, container) => {
    if (!container) return;
    
    // Nájdeme sekciu Realizačný tím (prvá sekcia)
    const staffSection = Array.from(container.querySelectorAll('.mb-4')).find(section => 
        section.querySelector('h4')?.textContent?.includes('Realizačný tím')
    );
    
    if (!staffSection) return;
    
    // Odstránime existujúci zoznam
    const existingStaffList = staffSection.querySelector('.space-y-2');
    if (existingStaffList) {
        existingStaffList.innerHTML = '';
    } else {
        const newListDiv = document.createElement('div');
        newListDiv.className = 'space-y-2';
        staffSection.appendChild(newListDiv);
    }
    
    const staffListDiv = staffSection.querySelector('.space-y-2');
    if (!staffListDiv) return;
    
    // Ak nie sú detaily tímu, zobrazíme "Nedostupné"
    if (!teamDetails) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'text-sm text-gray-500 italic p-2';
        emptyDiv.textContent = 'Nedostupné';
        staffListDiv.appendChild(emptyDiv);
        
        const staffHeader = staffSection.querySelector('h4');
        if (staffHeader) {
            staffHeader.innerHTML = `<i class="fa-solid fa-user-tie text-xs text-gray-500"></i> Realizačný tím (0)`;
        }
        return;
    }
    
    // Získame aktívnych členov RT (muži aj ženy)
    const activeMenStaff = teamDetails?.team.menTeamMemberDetails?.filter(m => !m.removedForMatch?.[window.currentMatchId]) || [];
    const activeWomenStaff = teamDetails?.team.womenTeamMemberDetails?.filter(m => !m.removedForMatch?.[window.currentMatchId]) || [];
    
    if (activeMenStaff.length === 0 && activeWomenStaff.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'text-sm text-gray-500 italic p-2';
        emptyDiv.textContent = 'Žiadni členovia realizačného tímu';
        staffListDiv.appendChild(emptyDiv);
    } else {
        // Vykreslíme mužov
        activeMenStaff.forEach((member, idx) => {
            const staffDiv = document.createElement('div');
            staffDiv.className = 'flex items-center justify-between gap-2 p-2 rounded border border-gray-200 text-sm group relative transition-colors hover:bg-blue-50 cursor-pointer';
            staffDiv.setAttribute('data-staff-id', `${teamDetails.userId}_men_${idx}`);
            staffDiv.innerHTML = `
                <div class="flex items-center gap-2">
                    <i class="fa-solid fa-user text-gray-600 text-xs flex-shrink-0"></i>
                    <span class="font-medium truncate">${member.lastName || ''} ${member.firstName || ''}</span>
                </div>
            `;
            staffListDiv.appendChild(staffDiv);
        });
        
        // Vykreslíme ženy
        activeWomenStaff.forEach((member, idx) => {
            const staffDiv = document.createElement('div');
            staffDiv.className = 'flex items-center justify-between gap-2 p-2 rounded border border-gray-200 text-sm group relative transition-colors hover:bg-blue-50 cursor-pointer';
            staffDiv.setAttribute('data-staff-id', `${teamDetails.userId}_women_${idx}`);
            staffDiv.innerHTML = `
                <div class="flex items-center gap-2">
                    <i class="fa-solid fa-user text-pink-600 text-xs flex-shrink-0"></i>
                    <span class="font-medium truncate">${member.lastName || ''} ${member.firstName || ''}</span>
                </div>
            `;
            staffListDiv.appendChild(staffDiv);
        });
    }
    
    console.log(`   ✅ Vykreslených ${activeMenStaff.length + activeWomenStaff.length} členov RT pre ${teamType === 'home' ? 'domáci' : 'hosťovský'} tím`);
    
    // Aktualizujeme nadpis
    const staffHeader = staffSection.querySelector('h4');
    if (staffHeader) {
        staffHeader.innerHTML = `<i class="fa-solid fa-user-tie text-xs text-gray-500"></i> Realizačný tím (${activeMenStaff.length + activeWomenStaff.length})`;
    }
};

// KOMPLETNE OPRAVENÁ FUNKCIA renderFullTeamToUI
const renderFullTeamToUI = (teamDetails, teamType) => {
    console.log(`🎨 Vykresľujem ${teamType === 'home' ? 'domáci' : 'hosťovský'} tím do UI...`);
    
    // DÔLEŽITÉ: Najprv zistíme, či sme v režime štatistík (2 stĺpce) alebo normálnom režime (4 stĺpce)
    const isStatsMode = document.querySelector('.grid-cols-2') !== null;
    const isNormalMode = document.querySelector('.grid-cols-4') !== null;
    
    let targetContainer = null;
    
    if (isNormalMode) {
        // Normálny režim - 4 stĺpce
        const containers = document.querySelectorAll('.grid-cols-4 > div');
        if (containers.length >= 3) {
            if (teamType === 'home') {
                targetContainer = containers[0]; // Domáci tím (prvý stĺpec)
            } else {
                targetContainer = containers[2]; // Hosťovský tím (tretí stĺpec)
            }
        }
    } else if (isStatsMode) {
        // Režim štatistík - 2 stĺpce
        const containers = document.querySelectorAll('.grid-cols-2 > div');
        if (containers.length >= 2) {
            if (teamType === 'home') {
                targetContainer = containers[0]; // Domáci tím (prvý stĺpec)
            } else {
                targetContainer = containers[1]; // Hosťovský tím (druhý stĺpec)
            }
        }
    }
    
    // Ak sme nenašli kontajnery, skúsime alternatívny spôsob - hľadáme podľa nadpisu
    if (!targetContainer) {
        console.log(`   ⚠️ Nenašiel sa kontajner podľa štandardných selektorov, skúšam alternatívny spôsob...`);
        
        // Nájdeme všetky divy s bg-gray-50 rounded-lg p-4 border border-gray-200
        const allTeamContainers = document.querySelectorAll('.bg-gray-50.rounded-lg.p-4.border.border-gray-200');
        
        if (allTeamContainers.length >= 2) {
            // Prvý je domáci, druhý je hosťovský (v normálnom režime)
            // Ale v režime štatistík sú tiež dva
            if (teamType === 'home') {
                targetContainer = allTeamContainers[0];
            } else {
                targetContainer = allTeamContainers[1];
            }
        }
    }
    
    if (!targetContainer) {
        console.log(`   ❌ Nenašiel sa kontajner pre ${teamType === 'home' ? 'domáci' : 'hosťovský'} tím`);
        return false;
    }
    
    // AKTUÁLNE VYMAŽEME VŠETKY EXISTUJÚCE ÚDAJE V KONTAJNERI (okrem hlavičky)
    // Zachováme iba hlavičku h3
    const header = targetContainer.querySelector('h3');
    const originalHeaderText = header ? header.textContent : (teamType === 'home' ? 'Domáci tím' : 'Hosťovský tím');
    
    // Vymažeme všetky deti okrem hlavičky
    while (targetContainer.children.length > 0) {
        const child = targetContainer.firstChild;
        if (child === header) {
            // Preskočíme hlavičku
            targetContainer.appendChild(child.cloneNode(true));
            targetContainer.removeChild(child);
        } else {
            targetContainer.removeChild(child);
        }
    }
    
    // Pridáme späť hlavičku
    if (header) {
        targetContainer.appendChild(header);
    } else {
        const newHeader = document.createElement('h3');
        newHeader.className = 'font-bold text-lg text-gray-800 mb-3 text-center border-b border-gray-200 pb-2';
        newHeader.textContent = originalHeaderText;
        targetContainer.appendChild(newHeader);
    }
    
    // Ak nie sú detaily tímu, zobrazíme "Nedostupné"
    if (!teamDetails) {
        console.log(`   ⚠️ Žiadne detaily pre ${teamType === 'home' ? 'domáci' : 'hosťovský'} tím, zobrazujem "Nedostupné"`);
        
        // Vytvoríme sekciu Realizačný tím
        const staffSection = document.createElement('div');
        staffSection.className = 'mb-4';
        staffSection.innerHTML = `
            <h4 class="font-semibold text-sm text-gray-700 mb-2 flex items-center gap-1">
                <i class="fa-solid fa-user-tie text-xs text-gray-500"></i> Realizačný tím (0)
            </h4>
            <div class="space-y-2">
                <div class="text-sm text-gray-500 italic p-2">Nedostupné</div>
            </div>
        `;
        targetContainer.appendChild(staffSection);
        
        // Vytvoríme sekciu Hráči
        const playersSection = document.createElement('div');
        playersSection.className = 'mb-4';
        playersSection.innerHTML = `
            <h4 class="font-semibold text-sm text-gray-700 mb-2 flex items-center gap-1">
                <i class="fa-solid fa-users text-xs text-gray-500"></i> Hráči (0)
            </h4>
            <div class="space-y-1">
                <div class="text-sm text-gray-500 italic p-2">Nedostupné</div>
            </div>
        `;
        targetContainer.appendChild(playersSection);
        
        console.log(`   ✅ ${teamType === 'home' ? 'Domáci' : 'Hosťovský'} tím bol nastavený na "Nedostupné"`);
        return true;
    }
    
    // Aktualizujeme názov tímu v hlavičke
    const teamHeader = targetContainer.querySelector('h3');
    if (teamHeader && teamDetails?.team?.teamName) {
        teamHeader.textContent = teamDetails.team.teamName;
    }
    
    // ======================== REALIZAČNÝ TÍM ========================
    const activeMenStaff = teamDetails?.team.menTeamMemberDetails?.filter(m => !m.removedForMatch?.[window.currentMatchId]) || [];
    const activeWomenStaff = teamDetails?.team.womenTeamMemberDetails?.filter(m => !m.removedForMatch?.[window.currentMatchId]) || [];
    const totalStaff = activeMenStaff.length + activeWomenStaff.length;
    
    // Vytvoríme sekciu Realizačný tím
    const staffSection = document.createElement('div');
    staffSection.className = 'mb-4';
    
    let staffHtml = `
        <h4 class="font-semibold text-sm text-gray-700 mb-2 flex items-center gap-1">
            <i class="fa-solid fa-user-tie text-xs text-gray-500"></i> Realizačný tím (${totalStaff})
        </h4>
        <div class="space-y-2">
    `;
    
    if (totalStaff === 0) {
        staffHtml += `<div class="text-sm text-gray-500 italic p-2">Žiadni členovia realizačného tímu</div>`;
    } else {
        // Muži
        activeMenStaff.forEach((member) => {
            staffHtml += `
                <div class="flex items-center justify-between gap-2 p-2 rounded border border-gray-200 text-sm group relative transition-colors">
                    <div class="flex items-center gap-2">
                        <i class="fa-solid fa-user text-gray-600 text-xs flex-shrink-0"></i>
                        <span class="font-medium truncate">${member.lastName || ''} ${member.firstName || ''}</span>
                    </div>
                </div>
            `;
        });
        
        // Ženy
        activeWomenStaff.forEach((member) => {
            staffHtml += `
                <div class="flex items-center justify-between gap-2 p-2 rounded border border-gray-200 text-sm group relative transition-colors">
                    <div class="flex items-center gap-2">
                        <i class="fa-solid fa-user text-pink-600 text-xs flex-shrink-0"></i>
                        <span class="font-medium truncate">${member.lastName || ''} ${member.firstName || ''}</span>
                    </div>
                </div>
            `;
        });
    }
    
    staffHtml += `</div>`;
    staffSection.innerHTML = staffHtml;
    targetContainer.appendChild(staffSection);
    
    // ======================== HRÁČI ========================
    const activePlayers = teamDetails?.team.playerDetails?.filter(p => p && !p.removedForMatch?.[window.currentMatchId]) || [];
    
    // Zoradenie podľa čísla dresu
    activePlayers.sort((a, b) => {
        const numA = a.jerseyNumber ? parseInt(a.jerseyNumber) || 999 : 999;
        const numB = b.jerseyNumber ? parseInt(b.jerseyNumber) || 999 : 999;
        return numA - numB;
    });
    
    // Vytvoríme sekciu Hráči
    const playersSection = document.createElement('div');
    playersSection.className = 'mb-4';
    
    let playersHtml = `
        <h4 class="font-semibold text-sm text-gray-700 mb-2 flex items-center gap-1">
            <i class="fa-solid fa-users text-xs text-gray-500"></i> Hráči (${activePlayers.length})
        </h4>
        <div class="space-y-1">
    `;
    
    if (activePlayers.length === 0) {
        playersHtml += `<div class="text-sm text-gray-500 italic p-2">Žiadni hráči</div>`;
    } else {
        activePlayers.forEach((player) => {
            playersHtml += `
                <div class="flex items-center justify-between gap-2 p-2 rounded border border-gray-200 text-sm group relative transition-colors">
                    <div class="flex items-center gap-2">
                        <i class="fa-solid fa-shirt text-gray-600 text-xs flex-shrink-0"></i>
                        ${player.jerseyNumber ? `<span class="font-bold text-gray-700 text-xs bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0">${player.jerseyNumber}</span>` : ''}
                        <span class="font-medium truncate">${player.lastName || ''} ${player.firstName || ''}</span>
                    </div>
                </div>
            `;
        });
    }
    
    playersHtml += `</div>`;
    playersSection.innerHTML = playersHtml;
    targetContainer.appendChild(playersSection);
    
    console.log(`   ✅ ${teamType === 'home' ? 'Domáci' : 'Hosťovský'} tím bol úspešne vykreslený (hráčov: ${activePlayers.length}, RT: ${totalStaff})`);
    return true;
};

// UPRAVENÁ FUNKCIA quickSetup - vymaže staré údaje pri nenájdení tímu
window.quickSetup = async () => {
    console.log('🚀 RÝCHLE NASTAVENIE TÍMOV Z DOM...');
    console.log('');

    // Najprv vymažeme staré údaje z UI
    const containers = document.querySelectorAll('.grid-cols-4 > div, .grid-cols-2 > div');
    if (containers.length >= 3) {
        // Vymažeme domáci tím (prvý stĺpec)
        const homeContainer = containers[0];
        if (homeContainer) {
            const homePlayersSection = homeContainer.querySelector('.mb-4:last-child, .mb-4:nth-child(2)');
            if (homePlayersSection) {
                const playersList = homePlayersSection.querySelector('.space-y-1, .space-y-2');
                if (playersList) playersList.innerHTML = '';
            }
            const homeStaffSection = homeContainer.querySelector('.mb-4:first-child');
            if (homeStaffSection) {
                const staffList = homeStaffSection.querySelector('.space-y-2');
                if (staffList) staffList.innerHTML = '';
            }
        }
        
        // Vymažeme hosťovský tím (tretí stĺpec)
        const awayContainer = containers[2];
        if (awayContainer) {
            const awayPlayersSection = awayContainer.querySelector('.mb-4:last-child, .mb-4:nth-child(2)');
            if (awayPlayersSection) {
                const playersList = awayPlayersSection.querySelector('.space-y-1, .space-y-2');
                if (playersList) playersList.innerHTML = '';
            }
            const awayStaffSection = awayContainer.querySelector('.mb-4:first-child');
            if (awayStaffSection) {
                const staffList = awayStaffSection.querySelector('.space-y-2');
                if (staffList) staffList.innerHTML = '';
            }
        }
    }

    // Najprv nájdeme tímy v DOM
    const allTeamElements = document.querySelectorAll('[data-original-identifier]');
    
    if (allTeamElements.length === 0) {
        console.log('❌ V DOM sa nenašli žiadne elementy s atribútom data-original-identifier');
        console.log('💡 Uistite sa, že ste na stránke s detailom zápasu');
        
        // Nastavíme "Nedostupné" pre oba tímy
        renderFullTeamToUI(null, 'home');
        renderFullTeamToUI(null, 'away');
        return;
    }
    
    const teamsData = [];
    
    for (const el of allTeamElements) {
        const identifier = el.getAttribute('data-original-identifier');
        const teamName = el.getAttribute('data-team-name');
        const category = el.getAttribute('data-team-category');
        
        if (identifier && teamName && teamName !== identifier && category) {
            // Kontrola duplicit
            if (!teamsData.some(t => t.identifier === identifier)) {
                teamsData.push({
                    identifier: identifier,
                    teamName: teamName,
                    category: category
                });
            }
        }
    }
    
    if (teamsData.length === 0) {
        console.log('❌ Nepodarilo sa získať údaje o tímoch z DOM');
        renderFullTeamToUI(null, 'home');
        renderFullTeamToUI(null, 'away');
        return;
    }
    
    console.log(`📋 Nájdených ${teamsData.length} tímov v DOM:`);
    teamsData.forEach((team, idx) => {
        console.log(`   ${idx + 1}. ${team.identifier} → "${team.teamName}" (${team.category})`);
    });
    
    // Získanie ID aktuálneho zápasu
    let matchId = window.currentMatchId;
    if (!matchId) {
        const urlParams = new URLSearchParams(window.location.search);
        const homeIdentifier = urlParams.get('domaci');
        const awayIdentifier = urlParams.get('hostia');
        if (homeIdentifier && awayIdentifier) {
            matchId = `${homeIdentifier}_${awayIdentifier}`;
        }
    }
    
    if (!matchId) {
        console.log('⚠️ Nepodarilo sa získať ID zápasu, tímy budú nastavené bez neho');
    } else {
        console.log(`🆔 ID zápasu: ${matchId}`);
        window.currentMatchId = matchId;
    }
    
    // Spracovanie tímov
    const homeTeamData = teamsData[0];
    const awayTeamData = teamsData[1];
    
    let homeFound = false;
    let awayFound = false;
    
    if (homeTeamData) {
        console.log('\n🏠 Domáci tím:', homeTeamData.teamName, `(${homeTeamData.category})`);
        console.log('🔧 Vyhľadávam podrobnosti domáceho tímu...');
        
        // Vyhľadanie detailov domáceho tímu
        const homeResult = findTeamByNameAndCategory(homeTeamData.teamName, homeTeamData.category, false);
        
        if (homeResult && !Array.isArray(homeResult)) {
            console.log(`✅ Nájdený domáci tím: ${homeResult.team.teamName}`);
            console.log(`   📧 Používateľ: ${homeResult.user.email}`);
            console.log(`   👥 Počet hráčov: ${homeResult.team.playerDetails?.length || 0}`);
            
            // Odoslanie udalosti pre domáci tím
            const homeEvent = new CustomEvent('setHomeTeamDetails', {
                detail: {
                    teamDetails: homeResult,
                    matchId: matchId
                }
            });
            window.dispatchEvent(homeEvent);
            
            // VYKRESLENIE DOMÁCEHO TÍMU DO UI
            renderFullTeamToUI(homeResult, 'home');
            
            // Uloženie do globálnej premennej
            window._homeTeamDetails = homeResult;
            homeFound = true;
        } else {
            console.log(`❌ Domáci tím "${homeTeamData.teamName}" nebol nájdený v databáze`);
            renderFullTeamToUI(null, 'home');
            window._homeTeamDetails = null;
        }
    } else {
        renderFullTeamToUI(null, 'home');
    }
    
    if (awayTeamData) {
        console.log('\n✈️ Hosťovský tím:', awayTeamData.teamName, `(${awayTeamData.category})`);
        console.log('🔧 Vyhľadávam podrobnosti hosťovského tímu...');
        
        // Vyhľadanie detailov hosťovského tímu
        const awayResult = findTeamByNameAndCategory(awayTeamData.teamName, awayTeamData.category, false);
        
        if (awayResult && !Array.isArray(awayResult)) {
            console.log(`✅ Nájdený hosťovský tím: ${awayResult.team.teamName}`);
            console.log(`   📧 Používateľ: ${awayResult.user.email}`);
            console.log(`   👥 Počet hráčov: ${awayResult.team.playerDetails?.length || 0}`);
            
            // Odoslanie udalosti pre hosťovský tím
            const awayEvent = new CustomEvent('setAwayTeamDetails', {
                detail: {
                    teamDetails: awayResult,
                    matchId: matchId
                }
            });
            window.dispatchEvent(awayEvent);
            
            // VYKRESLENIE HOSŤOVSKÉHO TÍMU DO UI
            renderFullTeamToUI(awayResult, 'away');
            
            // Uloženie do globálnej premennej
            window._awayTeamDetails = awayResult;
            awayFound = true;
        } else {
            console.log(`❌ Hosťovský tím "${awayTeamData.teamName}" nebol nájdený v databáze`);
            renderFullTeamToUI(null, 'away');
            window._awayTeamDetails = null;
        }
    } else {
        renderFullTeamToUI(null, 'away');
    }
    
    if (homeFound && awayFound) {
        console.log('\n✅ HOTOVO! Oba tímy boli nastavené a vykreslené v UI.');
    } else if (homeFound) {
        console.log('\n⚠️ HOTOVO! Iba domáci tím bol nastavený, hosťovský tím nebol nájdený.');
    } else if (awayFound) {
        console.log('\n⚠️ HOTOVO! Iba hosťovský tím bol nastavený, domáci tím nebol nájdený.');
    } else {
        console.log('\n❌ HOTOVO! Žiadny z tímov nebol nájdený. V UI je zobrazené "Nedostupné".');
    }
};

// Pomocná funkcia na manuálne vykreslenie tímu podľa názvu
window.renderTeamToUIByName = async (teamName, categoryName, teamType) => {
    console.log(`🎨 Vykresľujem tím "${teamName}" (${categoryName}) ako ${teamType === 'home' ? 'domáci' : 'hosťovský'}...`);
    
    const result = findTeamByNameAndCategory(teamName, categoryName, false);
    
    if (!result || Array.isArray(result)) {
        console.log(`❌ Tím "${teamName}" nebol nájdený`);
        return false;
    }
    
    return renderFullTeamToUI(result, teamType);
};

// Pomocná funkcia na obnovenie UI po zmene (napr. po úprave hráča)
window.refreshTeamUI = () => {
    console.log('🔄 Obnovujem UI tímov...');
    
    if (window._homeTeamDetails) {
        renderFullTeamToUI(window._homeTeamDetails, 'home');
    }
    
    if (window._awayTeamDetails) {
        renderFullTeamToUI(window._awayTeamDetails, 'away');
    }
    
    console.log('✅ UI bolo obnovené');
};

console.log('');
console.log('✅ FUNKCIE BOLI AKTUALIZOVANÉ!');
console.log('');
console.log('📌 NOVÉ FUNKCIE:');
console.log('   • quickSetup() - rýchle nastavenie a VYKRESLENIE tímov do UI');
console.log('   • renderTeamToUIByName("Názov", "Kategória", "home/away") - vykreslí tím do UI');
console.log('   • refreshTeamUI() - obnoví UI podľa uložených tímov');
console.log('');
console.log('🚀 RÝCHLE POUŽITIE:');
console.log('   quickSetup()');

window.removeAllListeners = () => {
    const oldHandlers = {
        setHomeTeamDetails: null,
        setAwayTeamDetails: null
    };
    
    // Získame staré event listenery (toto je tricky, ale funguje to)
    const events = ['setHomeTeamDetails', 'setAwayTeamDetails'];
    events.forEach(eventName => {
        const listeners = window._getEventListeners?.(window, eventName);
        if (listeners) {
            listeners.forEach(listener => {
                window.removeEventListener(eventName, listener.listener);
            });
        }
    });
};

// Aktualizujeme existujúce funkcie
window.findTeam = findTeamByNameAndCategory;
window.findCurrentMatchFromDOM = findCurrentMatchTeamsFromDOM;
window.findAllTeamsInDOM = findAllTeamsInDOM;
window.findTeamByIdentifierFromDOM = findTeamByIdentifierFromDOM;
window.getTeamNameFromDOM = getTeamNameFromDOM;
window.renderTeamInfoToDOM = renderTeamInfoToDOM;
window.closeTeamSearchResults = () => {
    const container = document.getElementById('team-search-results');
    if (container) container.remove();
};

console.log('✅ Funkcie boli aktualizované!');
console.log('');
console.log('📌 ZOZNAM FUNKCIÍ:');
console.log('   • findTeamByNameAndCategory("Názov tímu", "Kategória") - vyhľadá tím a vykreslí do DOM');
console.log('   • findCurrentMatchFromDOM() - vyhľadá tímy z aktuálneho zápasu a vykreslí do DOM');
console.log('   • findAllTeamsInDOM() - vypíše všetky tímy v DOM');
console.log('   • findTeamByIdentifierFromDOM("U12 D 1A") - vyhľadá tím podľa identifikátora a vykreslí do DOM');
console.log('   • getTeamNameFromDOM("U12 D 1A") - získa názov tímu z DOM');
console.log('   • closeTeamSearchResults() - zatvorí okno s výsledkami');
console.log('');
console.log('📌 PRÍKLADY POUŽITIA:');
console.log('   findCurrentMatchFromDOM()');
console.log('   findTeamByIdentifierFromDOM("U12 D 1A")');
console.log('   findTeamByNameAndCategory("ŠK Slovan", "U12 D")');


// ============================================================
// KOMPLETNÉ FUNKCIE PRE MANUÁLNE NASTAVENIE TÍMOV
// ============================================================

const getCurrentMatchIdFromURL = async () => {
    // Získame z URL parametrov
    const urlParams = new URLSearchParams(window.location.search);
    const homeIdentifier = urlParams.get('domaci');
    const awayIdentifier = urlParams.get('hostia');
    
    if (homeIdentifier && awayIdentifier) {
        console.log(`🔍 Vyhľadávam zápas - domáci: ${homeIdentifier}, hostia: ${awayIdentifier}`);
        
        // Skúsime použiť uložené ID z React stavu
        if (window.currentMatchId) {
            console.log(`✅ Používam uložené ID: ${window.currentMatchId}`);
            return window.currentMatchId;
        }
        
        // Ak nemáme uložené ID, vyhľadáme ho v databáze
        if (!window.db) {
            console.log('❌ Firebase databáza nie je inicializovaná');
            return null;
        }
        
        try {
            const matchesRef = collection(window.db, 'matches');
            const q = query(
                matchesRef, 
                where("homeTeamIdentifier", "==", homeIdentifier),
                where("awayTeamIdentifier", "==", awayIdentifier)
            );
            
            const querySnapshot = await getDocs(q);
            
            if (querySnapshot.empty) {
                console.log('❌ Zápas nebol nájdený v databáze');
                return null;
            }
            
            const matches = [];
            querySnapshot.forEach((doc) => {
                matches.push({ id: doc.id, ...doc.data() });
            });
            
            if (matches.length === 1) {
                const matchId = matches[0].id;
                console.log(`✅ Nájdené ID zápasu: ${matchId}`);
                window.currentMatchId = matchId;
                return matchId;
            } else {
                console.log(`⚠️ Nájdených viacero zápasov (${matches.length}), používam prvý:`);
                matches.forEach(match => {
                    console.log(`   - ID: ${match.id}`);
                });
                return matches[0]?.id || null;
            }
        } catch (error) {
            console.error('❌ Chyba pri vyhľadávaní zápasu:', error);
            return null;
        }
    } else {
        console.log('❌ Žiadny zápas nie je aktuálne zobrazený (chýbajú parametre domaci/hostia)');
        return null;
    }
};

// UPRAVENÁ FUNKCIA: setTeamsFromCurrentMatch
window.setTeamsFromCurrentMatch = async () => {
    console.log('🔍 Automatické nastavenie tímov z aktuálneho zápasu v DOM...');
    
    const result = findCurrentMatchTeamsFromDOM(false);
    
    if (result && result.home) {
        await window.setHomeTeamDetails(result.home.team.teamName, result.home.category);
    } else {
        console.log('❌ Nepodarilo sa nájsť domáci tím v DOM');
    }
    
    if (result && result.away) {
        await window.setAwayTeamDetails(result.away.team.teamName, result.away.category);
    } else {
        console.log('❌ Nepodarilo sa nájsť hosťovský tím v DOM');
    }
};

// Pomocná funkcia na zobrazenie aktuálneho stavu
window.showCurrentMatchStatus = () => {
    if (!window.currentMatchId) {
        console.log('❌ Žiadny aktuálny zápas nie je vybraný');
        console.log('💡 Kliknite na nejaký zápas v zozname a skúste znova');
        return;
    }
    
    console.log('📊 AKTUÁLNY STAV:');
    console.log(`   • ID zápasu: ${window.currentMatchId}`);
    
    // Získame aktuálny zápas z matches
    if (window.matchTracker && window.matchTracker.getMatches) {
        const matches = window.matchTracker.getMatches();
        const currentMatch = matches[window.currentMatchId];
        if (currentMatch) {
            console.log(`   • Domáci identifikátor: ${currentMatch.homeTeamIdentifier}`);
            console.log(`   • Hosťovský identifikátor: ${currentMatch.awayTeamIdentifier}`);
            console.log(`   • Kategória: ${currentMatch.categoryName}`);
            console.log(`   • Status: ${currentMatch.status}`);
        }
    }
};

// Zobrazenie nápovedy
window.showTeamHelp = () => {
    console.log('');
    console.log('📖 NÁPOVEDA PRE FUNKCIE TÍMOV:');
    console.log('='.repeat(50));
    console.log('');
    console.log('1️⃣ NASTAVENIE DOMÁCEHO TÍMU:');
    console.log('   setHomeTeamDetails("Názov tímu", "Kategória")');
    console.log('   Príklad: setHomeTeamDetails("ŠK Slovan", "U12 D")');
    console.log('');
    console.log('2️⃣ NASTAVENIE HOSŤOVSKÉHO TÍMU:');
    console.log('   setAwayTeamDetails("Názov tímu", "Kategória")');
    console.log('   Príklad: setAwayTeamDetails("TJ Družstevník", "U12 D")');
    console.log('');
    console.log('3️⃣ NASTAVENIE OBoch TÍMOV NARAZ:');
    console.log('   setBothTeamsDetails("Domáci názov", "Kategória", "Hosťovský názov", "Kategória")');
    console.log('   Príklad: setBothTeamsDetails("ŠK Slovan", "U12 D", "TJ Družstevník", "U12 D")');
    console.log('');
    console.log('4️⃣ AUTOMATICKÉ NASTAVENIE Z DOM:');
    console.log('   setTeamsFromCurrentMatch()');
    console.log('   (Zistí tímy priamo zo stránky)');
    console.log('');
    console.log('5️⃣ ZOBRAZENIE AKTUÁLNEHO STAVU:');
    console.log('   showCurrentMatchStatus()');
    console.log('');
    console.log('6️⃣ VYHĽADANIE TÍMU:');
    console.log('   findTeamByNameAndCategory("Názov tímu", "Kategória")');
    console.log('   findTeamByIdentifierFromDOM("U12 D 1A")');
    console.log('   findCurrentMatchFromDOM()');
    console.log('');
    console.log('='.repeat(50));
};

console.log('✅ Všetky funkcie boli načítané!');
console.log('📌 Pre zobrazenie nápovedy napíšte: showTeamHelp()');
console.log('');
console.log('🚀 RÝCHLE POUŽITIE:');
console.log('   setTeamsFromCurrentMatch()  - automaticky nastaví tímy z DOM');
console.log('   showCurrentMatchStatus()    - zobrazí aktuálny stav');


// ============================================================
// FUNKCIA NA AUTOMATICKÉ VYKRESLENIE TÍMOV PO NASTAVENÍ
// ============================================================

// Táto funkcia sa spustí po každom nastavení tímu a vykreslí ho do UI
const setupTeamRenderingListener = () => {
    // Poslúchač pre domáci tím
    const handleHomeTeamRendered = (event) => {
        const teamDetails = event.detail.teamDetails;
        const matchId = event.detail.matchId;
        
        // Skontrolujeme, či je to aktuálny zápas
        if (matchId === window.currentMatchId || !window.currentMatchId) {
            console.log(`🎨 Automatické vykreslenie domáceho tímu: ${teamDetails.team.teamName}`);
            renderFullTeamToUI(teamDetails, 'home');
            window._homeTeamDetails = teamDetails;
        }
    };
    
    // Poslúchač pre hosťovský tím
    const handleAwayTeamRendered = (event) => {
        const teamDetails = event.detail.teamDetails;
        const matchId = event.detail.matchId;
        
        // Skontrolujeme, či je to aktuálny zápas
        if (matchId === window.currentMatchId || !window.currentMatchId) {
            console.log(`🎨 Automatické vykreslenie hosťovského tímu: ${teamDetails.team.teamName}`);
            renderFullTeamToUI(teamDetails, 'away');
            window._awayTeamDetails = teamDetails;
        }
    };
    
    // Odstránime staré poslúchače (aby sa neduplikovali)
    window.removeEventListener('setHomeTeamDetails', handleHomeTeamRendered);
    window.removeEventListener('setAwayTeamDetails', handleAwayTeamRendered);
    
    // Pridáme nové poslúchače
    window.addEventListener('setHomeTeamDetails', handleHomeTeamRendered);
    window.addEventListener('setAwayTeamDetails', handleAwayTeamRendered);
    
    console.log('✅ Nastavené automatické vykreslenie tímov do UI');
};

// Spustíme listener
setupTeamRenderingListener();


// ============================================================
// OPRAVA: Funkcia na manuálne vykreslenie tímov do UI s oneskorením
// ============================================================

// Táto funkcia počka na to, kým sa UI načíta a potom vykreslí tímy
const forceRenderTeamsToUI = () => {
    console.log('🔄 FORCE RENDER: Spúšťam vynútené vykreslenie tímov...');
    
    // Počkáme 500ms, aby sa UI stihlo načítať
    setTimeout(() => {
        // Skúsime vykresliť domáci tím
        if (window._homeTeamDetails) {
            console.log(`🏠 Vynútené vykreslenie domáceho tímu: ${window._homeTeamDetails.team.teamName}`);
            renderFullTeamToUI(window._homeTeamDetails, 'home');
        } else {
            console.log('⚠️ Žiadny domáci tím na vykreslenie');
        }
        
        // Skúsime vykresliť hosťovský tím
        if (window._awayTeamDetails) {
            console.log(`✈️ Vynútené vykreslenie hosťovského tímu: ${window._awayTeamDetails.team.teamName}`);
            renderFullTeamToUI(window._awayTeamDetails, 'away');
        } else {
            console.log('⚠️ Žiadny hosťovský tím na vykreslenie');
        }
    }, 500);
};

// Prepíšeme pôvodnú funkciu setBothTeamsDetails, aby po nastavení tímov zavolala force render
const originalSetBothTeamsDetails = window.setBothTeamsDetails;
window.setBothTeamsDetails = async (homeTeamName, homeCategory, awayTeamName, awayCategory) => {
    console.log('🔧 Nastavujem oba tímy...');
    
    // 🔄 NAJPRV POUŽIJEME MAPPING NA NÁZVY TÍMOV
    let actualHomeTeamName = homeTeamName;
    let actualAwayTeamName = awayTeamName;
    
    if (window.teamNameReplacer && typeof window.teamNameReplacer.getTeamNameFromMapping === 'function') {
        if (homeTeamName) {
            const mappedHome = window.teamNameReplacer.getTeamNameFromMapping(homeTeamName);
            if (mappedHome && mappedHome !== homeTeamName) {
                console.log(`🔄 Mapovanie domáceho tímu: "${homeTeamName}" → "${mappedHome}"`);
                actualHomeTeamName = mappedHome;
            } else if (mappedHome) {
                actualHomeTeamName = mappedHome;
            }
        }
        
        if (awayTeamName) {
            const mappedAway = window.teamNameReplacer.getTeamNameFromMapping(awayTeamName);
            if (mappedAway && mappedAway !== awayTeamName) {
                console.log(`🔄 Mapovanie hosťovského tímu: "${awayTeamName}" → "${mappedAway}"`);
                actualAwayTeamName = mappedAway;
            } else if (mappedAway) {
                actualAwayTeamName = mappedAway;
            }
        }
    }
    
    if (actualHomeTeamName && homeCategory) {
        await window.setHomeTeamDetails(actualHomeTeamName, homeCategory);
    }
    if (actualAwayTeamName && awayCategory) {
        await window.setAwayTeamDetails(actualAwayTeamName, awayCategory);
    }
    
    // Po nastavení tímov spustíme vynútené vykreslenie
    forceRenderTeamsToUI();
};

// Prepíšeme aj pôvodné setHomeTeamDetails a setAwayTeamDetails
const originalSetHomeTeamDetails = window.setHomeTeamDetails;
// Prepíšeme setHomeTeamDetails - najprv skúsime mapovanie
window.setHomeTeamDetails = async (teamName, categoryName) => {
    // 🔄 NAJPRV POUŽIJEME MAPPING NA PREVOD NÁZVU TÍMU
    let actualTeamName = teamName;
    if (window.teamNameReplacer && typeof window.teamNameReplacer.getTeamNameFromMapping === 'function') {
        const mappedName = window.teamNameReplacer.getTeamNameFromMapping(teamName);
        if (mappedName && mappedName !== teamName) {
            console.log(`🔄 Mapovanie domáceho tímu: "${teamName}" → "${mappedName}"`);
            actualTeamName = mappedName;
        } else if (mappedName) {
            console.log(`✅ Domáci tím už je správne zmapovaný: "${teamName}"`);
            actualTeamName = mappedName;
        } else {
            console.log(`⚠️ Žiadne mapovanie pre domáci tím: "${teamName}", používam pôvodný`);
        }
    }
    
    console.log(`🔍 Vyhľadávam domáci tím: "${actualTeamName}" v kategórii: "${categoryName}"`);
    
    // 🔴 1. NAJPRV SKÚSIME ZÍSKAŤ DETAILY TÍMU PRIAMO Z MAPOVANIA
    // Vyhľadáme používateľa, ktorý má tím s názvom actualTeamName
    let result = null;
    
    if (window.__teamNameMapping) {
        // Prejdeme všetky mapovania a nájdeme také, ktoré vedie na actualTeamName
        for (const [identifier, mapping] of Object.entries(window.__teamNameMapping)) {
            if (mapping.teamName === actualTeamName) {
                // Našli sme identifikátor, ktorý sa mapuje na tento názov
                // Teraz vyhľadáme používateľa podľa tohto identifikátora
                const teamDetails = getTeamDetails(identifier);
                if (teamDetails) {
                    result = teamDetails;
                    console.log(`✅ Nájdený domáci tím cez mapovanie: ${teamDetails.team.teamName} (${teamDetails.userEmail})`);
                    break;
                }
            }
        }
    }
    
    // 2. Ak nie je v mapovaní, skúsime štandardné vyhľadávanie
    if (!result) {
        result = await findTeamByNameAndCategory(actualTeamName, categoryName, false);
    }
    
    if (!result || Array.isArray(result)) {
        console.log(`❌ Tím "${actualTeamName}" v kategórii "${categoryName}" nebol nájdený`);
        return;
    }
    
    // Získanie ID zápasu
    let matchId = window.currentMatchId;
    if (!matchId) {
        matchId = await getCurrentMatchIdFromURL();
    }
    
    if (!matchId) {
        console.log('⚠️ Nepodarilo sa získať ID zápasu, ale tím bol nájdený.');
        window._lastFoundTeam = {
            type: 'home',
            teamDetails: result,
            timestamp: Date.now()
        };
        renderFullTeamToUI(result, 'home');
        window._homeTeamDetails = result;
        return;
    }
    
    // Odoslanie udalosti
    const event = new CustomEvent('setHomeTeamDetails', {
        detail: {
            teamDetails: result,
            matchId: matchId
        }
    });
    window.dispatchEvent(event);
    
    renderFullTeamToUI(result, 'home');
    window._homeTeamDetails = result;
    
    console.log(`✅ Domáci tím nastavený a vykreslený: ${actualTeamName}`);
    console.log(`   📧 Používateľ: ${result.user.email}`);
    console.log(`   👥 Počet hráčov: ${result.team.playerDetails?.length || 0}`);
};

const originalSetAwayTeamDetails = window.setAwayTeamDetails;
window.setAwayTeamDetails = async (teamName, categoryName) => {
    let actualTeamName = teamName;
    if (window.teamNameReplacer && typeof window.teamNameReplacer.getTeamNameFromMapping === 'function') {
        const mappedName = window.teamNameReplacer.getTeamNameFromMapping(teamName);
        if (mappedName && mappedName !== teamName) {
            console.log(`🔄 Mapovanie hosťovského tímu: "${teamName}" → "${mappedName}"`);
            actualTeamName = mappedName;
        } else if (mappedName) {
            console.log(`✅ Hosťovský tím už je správne zmapovaný: "${teamName}"`);
            actualTeamName = mappedName;
        } else {
            console.log(`⚠️ Žiadne mapovanie pre hosťovský tím: "${teamName}", používam pôvodný`);
        }
    }
    
    console.log(`🔍 Vyhľadávam hosťovský tím: "${actualTeamName}" v kategórii: "${categoryName}"`);
    
    let result = null;
    
    // 🔴 1. NAJPRV SKÚSIME ZÍSKAŤ DETAILY TÍMU PRIAMO Z MAPOVANIA
    if (window.__teamNameMapping) {
        for (const [identifier, mapping] of Object.entries(window.__teamNameMapping)) {
            if (mapping.teamName === actualTeamName) {
                const teamDetails = getTeamDetails(identifier);
                if (teamDetails) {
                    result = teamDetails;
                    console.log(`✅ Nájdený hosťovský tím cez mapovanie: ${teamDetails.team.teamName} (${teamDetails.userEmail})`);
                    break;
                }
            }
        }
    }
    
    // 2. Ak nie je v mapovaní, skúsime štandardné vyhľadávanie
    if (!result) {
        result = await findTeamByNameAndCategory(actualTeamName, categoryName, false);
    }
    
    if (!result || Array.isArray(result)) {
        console.log(`❌ Tím "${actualTeamName}" v kategórii "${categoryName}" nebol nájdený`);
        return;
    }
    
    let matchId = window.currentMatchId;
    if (!matchId) {
        matchId = await getCurrentMatchIdFromURL();
    }
    
    if (!matchId) {
        console.log('⚠️ Nepodarilo sa získať ID zápasu, ale tím bol nájdený.');
        window._lastFoundTeam = {
            type: 'away',
            teamDetails: result,
            timestamp: Date.now()
        };
        renderFullTeamToUI(result, 'away');
        window._awayTeamDetails = result;
        return;
    }
    
    const event = new CustomEvent('setAwayTeamDetails', {
        detail: {
            teamDetails: result,
            matchId: matchId
        }
    });
    window.dispatchEvent(event);
    
    renderFullTeamToUI(result, 'away');
    window._awayTeamDetails = result;
    
    console.log(`✅ Hosťovský tím nastavený a vykreslený: ${actualTeamName}`);
    console.log(`   📧 Používateľ: ${result.user.email}`);
    console.log(`   👥 Počet hráčov: ${result.team.playerDetails?.length || 0}`);
};

// PRIDÁME AJ MUTATION OBSERVER PRE PRÍPAD, ŽE SA UI ZMENÍ AŽ PO NASTAVENÍ
const setupMutationObserverForTeams = () => {
    // Sledujeme zmeny v DOM, aby sme zachytili, keď sa objavia kontajnery pre tímy
    const observer = new MutationObserver((mutations) => {
        // Skontrolujeme, či sa objavil kontajner s triedou .grid-cols-4 alebo .grid-cols-2
        const containers = document.querySelectorAll('.grid-cols-4, .grid-cols-2');
        if (containers.length > 0) {
            console.log('🔍 MutationObserver: Našiel som kontajnery pre tímy, spúšťam vykreslenie...');
            
            // Ak máme uložené tímy, vykreslíme ich
            if (window._homeTeamDetails) {
                renderFullTeamToUI(window._homeTeamDetails, 'home');
            }
            if (window._awayTeamDetails) {
                renderFullTeamToUI(window._awayTeamDetails, 'away');
            }
            
            // Po úspešnom vykreslení môžeme observer zastaviť
            observer.disconnect();
            console.log('✅ MutationObserver: Vykreslenie dokončené, observer zastavený');
        }
    });
    
    // Sledujeme celý dokument
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    console.log('👀 MutationObserver nastavený pre sledovanie kontajnerov tímov');
};

// Spustíme observer
setupMutationObserverForTeams();

// Exportujeme pomocné funkcie
window.forceRenderTeamsToUI = forceRenderTeamsToUI;

console.log('✅ PRIDANÉ VYNÚTENÉ VYKRESLENIE TÍMOV!');
console.log('📌 Ak sa tímy nevykreslia automaticky, spustite manuálne: forceRenderTeamsToUI()');
