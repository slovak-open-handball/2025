// logged-in-export.js
import { doc, getDoc, onSnapshot, updateDoc, addDoc, collection, Timestamp, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const { useState, useEffect, useRef, useMemo, useCallback } = React;

window.showGlobalNotification = (message, type = 'success') => {
    let notificationElement = document.getElementById('global-notification');
    if (!notificationElement) {
        notificationElement = document.createElement('div');
        notificationElement.id = 'global-notification';
        document.body.appendChild(notificationElement);
    }
    const baseClasses = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[99999] transition-all duration-500 ease-in-out transform';
    let typeClasses = '';
    switch (type) {
        case 'success': typeClasses = 'bg-green-500 text-white'; break;
        case 'error':   typeClasses = 'bg-red-500 text-white'; break;
        case 'info':    typeClasses = 'bg-blue-500 text-white'; break;
        default:        typeClasses = 'bg-gray-700 text-white';
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

const hideHeaderAndMenuIfHash = () => {
    const hasHash = window.location.hash && window.location.hash.length > 0;

    const headerPlaceholder = document.getElementById('header-placeholder');
    const menuPlaceholder = document.getElementById('menu-placeholder');
    const rootElement = document.getElementById('root');
    const mainContentArea = document.getElementById('main-content-area');
    const spacerDiv = mainContentArea ? mainContentArea.querySelector('.flex-shrink-0.w-16') : null;

    if (hasHash) {
        if (headerPlaceholder) headerPlaceholder.style.display = 'none';
        if (menuPlaceholder) menuPlaceholder.style.display = 'none';
        document.body.style.paddingTop = '0';
        document.body.style.margin = '0';
        document.body.style.overflow = 'auto';

        if (spacerDiv) spacerDiv.style.display = 'none';

        if (mainContentArea) {
            mainContentArea.style.padding = '0';
            mainContentArea.style.margin = '0';
            mainContentArea.style.display = 'block';
        }
        if (rootElement) {
            rootElement.style.padding = '0';
            rootElement.style.margin = '0';
            rootElement.style.maxWidth = 'none';
            rootElement.style.width = '100%';
        }
    } else {
        if (headerPlaceholder) headerPlaceholder.style.display = '';
        if (menuPlaceholder) menuPlaceholder.style.display = '';
        document.body.style.paddingTop = '64px';
        document.body.style.overflow = '';

        if (spacerDiv) spacerDiv.style.display = '';
        if (mainContentArea) {
            mainContentArea.style.padding = '';
            mainContentArea.style.margin = '';
            mainContentArea.style.display = '';
        }
        if (rootElement) {
            rootElement.style.padding = '';
            rootElement.style.margin = '';
            rootElement.style.maxWidth = '';
            rootElement.style.width = '';
            rootElement.style.display = '';
        }
    }
};

hideHeaderAndMenuIfHash();
window.addEventListener('hashchange', hideHeaderAndMenuIfHash);

const spacesToDashes = (str) => (!str ? '' : str.replace(/\s+/g, '-'));
const dashesToSpaces = (str) => (!str ? '' : str.replace(/-/g, ' '));
window.spacesToDashes = spacesToDashes;
window.dashesToSpaces = dashesToSpaces;

const parseExportHash = () => {
    const hash = window.location.hash;
    if (!hash || hash === '#') return null;

    const raw = hash.substring(1);
    const parts = raw.split('/').filter(Boolean);

    if (parts.length === 0) return null;

    if (parts[0] === 'tabulky') {
        if (parts.length < 3) return null;
        const categoryName = dashesToSpaces(decodeURIComponent(parts[1]));
        const groupName = dashesToSpaces(decodeURIComponent(parts[2]));
        return { type: 'tabulky', categoryName, groupName };
    }

    if (parts[0] === 'zapasy') {
        return { type: 'zapasy' };
    }

    return null;
};

const normalizeName = (name) => {
    if (!name) return '';
    return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
};

const getDisplayTeamName = (teamIdentifier) => {
    if (!teamIdentifier) return '???';
    if (window.teamManager && typeof window.teamManager.getTeamNameByDisplayIdSync === 'function') {
        const teamName = window.teamManager.getTeamNameByDisplayIdSync(teamIdentifier);
        if (teamName && teamName !== teamIdentifier) return teamName;
    }
    return teamIdentifier;
};

const resolveTeamDisplayName = (identifier) => {
    if (!identifier) return '???';

    if (window.teamNames && window.teamNames[identifier]) {
        return window.teamNames[identifier];
    }

    if (
        window.matchTracker &&
        typeof window.matchTracker.getTeamNameByDisplayId === 'function'
    ) {
        try {
            const mapped = window.matchTracker.getTeamNameByDisplayId(identifier);
            if (mapped && mapped !== identifier) return mapped;
        } catch (e) { }
    }

    const fallback = getDisplayTeamName(identifier);
    if (fallback && fallback !== identifier) return fallback;

    return identifier;
};

const calculateHeadToHead = (teamA, teamB, groupMatches) => {
    let teamAScore = 0;
    let teamBScore = 0;
    let teamAWins = 0;
    let teamBWins = 0;

    const teamAName = (teamA.name || teamA.id || "").trim();
    const teamBName = (teamB.name || teamB.id || "").trim();
    if (!teamAName || !teamBName) {
        return { teamAScore, teamBScore, teamAWins, teamBWins };
    }

    const normalize = (name) => {
        if (!name) return '';
        return name
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim()
            .replace(/\s+/g, ' ');
    };

    const teamANormalized = normalize(teamAName);
    const teamBNormalized = normalize(teamBName);

    for (const match of groupMatches) {
        let homeName = match.homeTeamName || match.homeTeamIdentifier || '';
        let awayName = match.awayTeamName || match.awayTeamIdentifier || '';
        if (!homeName || !awayName) continue;

        const homeNormalized = normalize(homeName);
        const awayNormalized = normalize(awayName);

        const isMatchBetweenThem =
            (homeNormalized === teamANormalized && awayNormalized === teamBNormalized) ||
            (homeNormalized === teamBNormalized && awayNormalized === teamANormalized);

        if (isMatchBetweenThem && match.status === 'completed') {
            let homeScore = match.homeScore || 0;
            let awayScore = match.awayScore || 0;

            if (homeNormalized === teamANormalized) {
                teamAScore = homeScore;
                teamBScore = awayScore;
            } else {
                teamAScore = awayScore;
                teamBScore = homeScore;
            }

            if (teamAScore > teamBScore) { teamAWins = 1; teamBWins = 0; }
            else if (teamBScore > teamAScore) { teamAWins = 0; teamBWins = 1; }
            break;
        }
    }

    return { teamAScore, teamBScore, teamAWins, teamBWins };
};

const compareTeams = (teamA, teamB, groupMatches, sortingConditions) => {
    if (teamA.points !== teamB.points) {
        return teamB.points - teamA.points;
    }

    if (sortingConditions && sortingConditions.length > 0) {
        for (const condition of sortingConditions) {
            const { parameter, direction } = condition;
            let comparison = 0;

            switch (parameter) {
                case 'headToHead': {
                    const h2h = calculateHeadToHead(teamA, teamB, groupMatches);
                    if (h2h.teamAWins !== h2h.teamBWins) {
                        comparison = direction === 'desc'
                            ? h2h.teamBWins - h2h.teamAWins
                            : h2h.teamAWins - h2h.teamBWins;
                    } else if (h2h.teamAScore !== h2h.teamBScore) {
                        comparison = direction === 'desc'
                            ? h2h.teamBScore - h2h.teamAScore
                            : h2h.teamAScore - h2h.teamBScore;
                    }
                    break;
                }
                case 'scoreDifference':
                    comparison = direction === 'desc'
                        ? teamB.goalDifference - teamA.goalDifference
                        : teamA.goalDifference - teamB.goalDifference;
                    break;
                case 'goalsScored':
                    comparison = direction === 'desc'
                        ? teamB.goalsFor - teamA.goalsFor
                        : teamA.goalsFor - teamB.goalsFor;
                    break;
                case 'goalsConceded':
                    comparison = direction === 'asc'
                        ? teamA.goalsAgainst - teamB.goalsAgainst
                        : teamB.goalsAgainst - teamA.goalsAgainst;
                    break;
                case 'wins':
                    comparison = direction === 'desc'
                        ? teamB.wins - teamA.wins
                        : teamA.wins - teamB.wins;
                    break;
                case 'losses':
                    comparison = direction === 'asc'
                        ? teamA.losses - teamB.losses
                        : teamB.losses - teamA.losses;
                    break;
                case 'draw':
                default:
                    comparison = 0;
            }

            if (comparison !== 0) return comparison;
        }
    }

    return teamA.name.localeCompare(teamB.name);
};

const ExportApp = ({ userProfileData }) => {
    const exportHash = parseExportHash();

    const [isTrackerReady, setIsTrackerReady] = useState(false);

    const [selectedOption, setSelectedOption] = useState('');
    const [categories, setCategories] = useState([]);
    const [groups, setGroups] = useState({});
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [selectedGroupType, setSelectedGroupType] = useState('');
    const [selectedGroupName, setSelectedGroupName] = useState('');
    const [isLoadingCategories, setIsLoadingCategories] = useState(false);

    const [exportedTable, setExportedTable] = useState(null);
    const [loadingTable, setLoadingTable] = useState(false);
    const [errorTable, setErrorTable] = useState(null);

    const [pointsForWin, setPointsForWin] = useState(3);
    const [sortingConditions, setSortingConditions] = useState([]);

    useEffect(() => {
        if (!window.db) return;
        const tableSettingsRef = doc(window.db, 'settings', 'table');
        const unsubscribe = onSnapshot(
            tableSettingsRef,
            (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const newPoints = data.pointsForWin !== undefined ? data.pointsForWin : 3;
                    setPointsForWin(newPoints);
                    setSortingConditions(data.sortingConditions || []);
                } else {
                    setPointsForWin(3);
                    setSortingConditions([]);
                }
            },
            (error) => {
            }
        );
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (exportHash) return;
        if (selectedOption !== 'tabulky') return;

        setIsLoadingCategories(true);

        const unsubscribeCategories = onSnapshot(
            doc(window.db, 'settings', 'categories'),
            (docSnap) => {
                if (docSnap.exists()) {
                    const categoriesData = docSnap.data();
                    const loadedCategories = Object.keys(categoriesData).map(id => ({
                        id: id,
                        name: categoriesData[id].name
                    }));
                    loadedCategories.sort((a, b) => a.name.localeCompare(b.name));
                    setCategories(loadedCategories);
                } else {
                    setCategories([]);
                }
                setIsLoadingCategories(false);
            },
            (error) => {
                window.showGlobalNotification('Nastala chyba pri načítavaní kategórií.', 'error');
                setIsLoadingCategories(false);
            }
        );

        const unsubscribeGroups = onSnapshot(
            doc(window.db, 'settings', 'groups'),
            (docSnap) => {
                if (docSnap.exists()) {
                    setGroups(docSnap.data());
                } else {
                    setGroups({});
                }
            },
            (error) => {
                window.showGlobalNotification('Nastala chyba pri načítavaní skupín.', 'error');
            }
        );

        return () => {
            unsubscribeCategories();
            unsubscribeGroups();
        };
    }, [selectedOption, exportHash]);

    useEffect(() => {
        if (exportHash) return;
        setSelectedCategoryId('');
        setSelectedGroupType('');
        setSelectedGroupName('');
    }, [selectedOption, exportHash]);

    useEffect(() => {
        if (exportHash) return;
        setSelectedGroupType('');
        setSelectedGroupName('');
    }, [selectedCategoryId, exportHash]);

    useEffect(() => {
        if (exportHash) return;
        setSelectedGroupName('');
    }, [selectedGroupType, exportHash]);

    useEffect(() => {
        let resolved = false;

        const markReady = () => {
            if (resolved) return;
            resolved = true;
            setIsTrackerReady(true);
        };

        const trackerReady = () => {
            if (!window.matchTracker || typeof window.matchTracker.getTeamNameByDisplayId !== 'function') {
                return false;
            }
        
            // Skús otestovať, či matchTracker vie vyriešiť aspoň nejaký identifikátor
            // (napr. z window.teamNames alebo __teamNameMapping)
            const testIds = [
                ...Object.keys(window.__teamNameMapping || {}),
                ...Object.keys(window.teamNames || {})
            ].slice(0, 5);
        
            if (testIds.length === 0) {
                // Nemáme čo testovať – aspoň že matchTracker existuje
                return true;
            }
        
            for (const id of testIds) {
                try {
                    const mapped = window.matchTracker.getTeamNameByDisplayId(id);
                    if (mapped && mapped !== id) {
                        return true; // aspoň jeden sa vyriešil
                    }
                } catch (e) { }
            }
        
            return false;
        };

        if (trackerReady()) {
            markReady();
            return;
        }

        const handleReady = () => {
            if (trackerReady()) markReady();
        };

        window.addEventListener('teamNameMappingReady', handleReady);
        window.addEventListener('groupTablesUpdated', handleReady);

        let attempts = 0;
        const maxAttempts = 200; // 60 s
        const pollInterval = setInterval(() => {
            attempts++;

            if (trackerReady()) {
                clearInterval(pollInterval);
                markReady();
                return;
            }

            if (attempts >= maxAttempts) {
                clearInterval(pollInterval);
                markReady(); // fallback, aby sa niečo zobrazilo
            }
        }, 300);

        return () => {
            window.removeEventListener('teamNameMappingReady', handleReady);
            window.removeEventListener('groupTablesUpdated', handleReady);
            clearInterval(pollInterval);
        };
    }, []);

    useEffect(() => {
        if (!exportHash || exportHash.type !== 'tabulky') {
            setExportedTable(null);
            return;
        }

        if (!isTrackerReady) {
            setLoadingTable(true);
            return;
        }

        let isCancelled = false;
        setLoadingTable(true);
        setErrorTable(null);

        const loadData = async () => {
            try {
                // ===== NAČÍTAJ KATEGÓRIE A SKUPINY =====
                const [categoriesSnap, groupsSnap] = await Promise.all([
                    getDoc(doc(window.db, 'settings', 'categories')),
                    getDoc(doc(window.db, 'settings', 'groups'))
                ]);
        
                const categoriesData = categoriesSnap.exists() ? categoriesSnap.data() : {};
                const groupsData = groupsSnap.exists() ? groupsSnap.data() : {};
        
                let categoryId = null;
                let categoryName = exportHash.categoryName;
                const targetCategoryNorm = normalizeName(exportHash.categoryName);
        
                for (const [catId, catData] of Object.entries(categoriesData)) {
                    if (catData && catData.name && normalizeName(catData.name) === targetCategoryNorm) {
                        categoryId = catId;
                        categoryName = catData.name;
                        break;
                    }
                }
        
                if (!categoryId) {
                    if (!isCancelled) {
                        setErrorTable(`Kategória ${exportHash.categoryName} sa nenašla.`);
                        setLoadingTable(false);
                    }
                    return;
                }
        
                const groupList = groupsData[categoryId] || [];
                const targetGroupNorm = normalizeName(exportHash.groupName);
                let foundGroup = null;
                for (const g of groupList) {
                    if (g && g.name && normalizeName(g.name) === targetGroupNorm) {
                        foundGroup = g;
                        break;
                    }
                }
        
                if (!foundGroup) {
                    if (!isCancelled) {
                        setErrorTable(`Skupina ${exportHash.groupName} sa v kategórii ${categoryName} nenašla.`);
                        setLoadingTable(false);
                    }
                    return;
                }
        
                const groupName = foundGroup.name;
                const groupType = foundGroup.type;
        
                // ===== NAČÍTAJ VŠETKY ZÁPASY =====
                const matchesSnap = await getDocs(collection(window.db, 'matches'));
                const allMatches = [];
                matchesSnap.forEach(d => allMatches.push({ id: d.id, ...d.data() }));
        
                // ===== ZÍSKAJ FINÁLNE MENÁ — PRESNE AKO tables.js =====
                // (loadTeamNames + recalculateAllTeamNames)
                const teamNamesLocal = { ...(window.teamNames || {}) };
        
                // getDisplayTeamName — presne ako v tables.js
                const getDisplayTeamNameLocal = (teamIdentifier) => {
                    if (!teamIdentifier) return '???';
                    if (window.teamManager && typeof window.teamManager.getTeamNameByDisplayIdSync === 'function') {
                        const teamName = window.teamManager.getTeamNameByDisplayIdSync(teamIdentifier);
                        if (teamName && teamName !== teamIdentifier) return teamName;
                    }
                    return teamIdentifier;
                };
        
                // Naplň mená presne ako loadTeamNames v tables.js
                for (const match of allMatches) {
                    let categoryNameForMatch = match.categoryName;
                    if (!categoryNameForMatch && match.categoryId && categoriesData[match.categoryId]) {
                        categoryNameForMatch = categoriesData[match.categoryId].name;
                    }
                    if (!categoryNameForMatch) continue;
        
                    if (match.homeTeamIdentifier) {
                        const currentDisplayName = teamNamesLocal[match.homeTeamIdentifier] || getDisplayTeamNameLocal(match.homeTeamIdentifier);
                        if (currentDisplayName && currentDisplayName.includes(categoryNameForMatch)) {
                            try {
                                const newName = await window.matchTracker.getTeamNameByDisplayId(currentDisplayName);
                                if (newName && newName !== currentDisplayName) {
                                    teamNamesLocal[match.homeTeamIdentifier] = newName;
                                }
                            } catch (err) {}
                        } else if (!teamNamesLocal[match.homeTeamIdentifier]) {
                            teamNamesLocal[match.homeTeamIdentifier] = currentDisplayName;
                        }
                    }
        
                    if (match.awayTeamIdentifier) {
                        const currentDisplayName = teamNamesLocal[match.awayTeamIdentifier] || getDisplayTeamNameLocal(match.awayTeamIdentifier);
                        if (currentDisplayName && currentDisplayName.includes(categoryNameForMatch)) {
                            try {
                                const newName = await window.matchTracker.getTeamNameByDisplayId(currentDisplayName);
                                if (newName && newName !== currentDisplayName) {
                                    teamNamesLocal[match.awayTeamIdentifier] = newName;
                                }
                            } catch (err) {}
                        } else if (!teamNamesLocal[match.awayTeamIdentifier]) {
                            teamNamesLocal[match.awayTeamIdentifier] = currentDisplayName;
                        }
                    }
                }
        
                // Toto je náš finálny zdroj mien
                const getFinalTeamName = (identifier) => {
                    if (!identifier) return identifier;
                    return teamNamesLocal[identifier] || getDisplayTeamNameLocal(identifier) || identifier;
                };
        
                // ===== POMOCNÉ FUNKCIE (rovnako ako tables.js) =====
                const getCurrentScoreFromEvents = (events) => {
                    if (!events || events.length === 0) return { home: 0, away: 0 };
                    const sorted = [...events].sort((a, b) => {
                        if (a.minute !== b.minute) return (a.minute || 0) - (b.minute || 0);
                        return (a.second || 0) - (b.second || 0);
                    });
                    const last = sorted[sorted.length - 1];
                    if (last && last.scoreAfter) {
                        return { home: last.scoreAfter.home || 0, away: last.scoreAfter.away || 0 };
                    }
                    let home = 0, away = 0;
                    sorted.forEach(e => {
                        if (e.type === 'goal') {
                            if (e.team === 'home') home++;
                            else if (e.team === 'away') away++;
                        } else if (e.type === 'penalty' && e.subType === 'scored') {
                            if (e.team === 'home') home++;
                            else if (e.team === 'away') away++;
                        }
                    });
                    return { home, away };
                };
        
                // ===== VYPOČÍTAJ ZÁKLADNÉ TABUĽKY (presne ako calculateGroupTable v tables.js) =====
                const calculateGroupTable = (category, group, groupMatches) => {
                    const teamsMap = new Map();
                    groupMatches.forEach(match => {
                        if (match.homeTeamIdentifier && !teamsMap.has(match.homeTeamIdentifier)) {
                            const teamName = getFinalTeamName(match.homeTeamIdentifier);
                            teamsMap.set(match.homeTeamIdentifier, {
                                id: match.homeTeamIdentifier, name: teamName,
                                played: 0, wins: 0, draws: 0, losses: 0,
                                goalsFor: 0, goalsAgainst: 0, points: 0, goalDifference: 0
                            });
                        }
                        if (match.awayTeamIdentifier && !teamsMap.has(match.awayTeamIdentifier)) {
                            const teamName = getFinalTeamName(match.awayTeamIdentifier);
                            teamsMap.set(match.awayTeamIdentifier, {
                                id: match.awayTeamIdentifier, name: teamName,
                                played: 0, wins: 0, draws: 0, losses: 0,
                                goalsFor: 0, goalsAgainst: 0, points: 0, goalDifference: 0
                            });
                        }
                    });
        
                    const completedMatches = groupMatches.filter(m => m.status === 'completed');
                    completedMatches.forEach(match => {
                        const homeTeam = teamsMap.get(match.homeTeamIdentifier);
                        const awayTeam = teamsMap.get(match.awayTeamIdentifier);
                        if (!homeTeam || !awayTeam) return;
                        let homeScore = match.homeScore || 0;
                        let awayScore = match.awayScore || 0;
                        if (homeScore === 0 && awayScore === 0 && match.id) {
                            const events = window.matchTracker?.getEvents?.(match.id) || [];
                            const score = getCurrentScoreFromEvents(events);
                            homeScore = score.home;
                            awayScore = score.away;
                        }
                        homeTeam.played++; awayTeam.played++;
                        homeTeam.goalsFor += homeScore; homeTeam.goalsAgainst += awayScore;
                        awayTeam.goalsFor += awayScore; awayTeam.goalsAgainst += homeScore;
                        if (homeScore > awayScore) { homeTeam.wins++; homeTeam.points += pointsForWin; awayTeam.losses++; }
                        else if (awayScore > homeScore) { awayTeam.wins++; awayTeam.points += pointsForWin; homeTeam.losses++; }
                        else { homeTeam.draws++; homeTeam.points += 1; awayTeam.draws++; awayTeam.points += 1; }
                    });
        
                    const teams = Array.from(teamsMap.values());
                    teams.forEach(team => { team.goalDifference = team.goalsFor - team.goalsAgainst; });
        
                    const matchesForComparison = groupMatches.map(match => {
                        const homeTeam = teamsMap.get(match.homeTeamIdentifier);
                        const awayTeam = teamsMap.get(match.awayTeamIdentifier);
                        let homeName = homeTeam ? homeTeam.name : match.homeTeamIdentifier;
                        let awayName = awayTeam ? awayTeam.name : match.awayTeamIdentifier;
                        let homeScore = match.homeScore || 0;
                        let awayScore = match.awayScore || 0;
                        if (homeScore === 0 && awayScore === 0 && match.id) {
                            const events = window.matchTracker?.getEvents?.(match.id) || [];
                            const score = getCurrentScoreFromEvents(events);
                            homeScore = score.home; awayScore = score.away;
                        }
                        return { ...match, homeTeamName: homeName, awayTeamName: awayName, homeScore, awayScore };
                    });
        
                    const sortedTeams = [...teams].sort((a, b) => compareTeams(a, b, matchesForComparison, sortingConditions));
        
                    return {
                        category, group, groupType: 'základná',
                        teams: sortedTeams,
                        totalMatches: groupMatches.length,
                        completedCount: completedMatches.length,
                        matches: groupMatches,
                        matchesForComparison: matchesForComparison,
                        sortingConditions: sortingConditions,
                        isFullyCompleted: groupMatches.length === completedMatches.length,
                        pointsForWin: pointsForWin
                    };
                };
        
                // ===== VYPOČÍTAJ NADSTAVBOVÉ TABUĽKY (presne ako calculateAdvancedGroupTable) =====
                const calculateAdvancedGroupTable = (category, group, groupMatches, allBaseGroupTables, otherAdvancedMatches) => {
                    const groupTypeLocal = 'nadstavbová';
                    
                    // OPRAVA: nahraďte tento blok
                    let categoryIdLocal = null;
                    for (const [catId, catData] of Object.entries(categoriesData)) {
                        if (catData && catData.name === category) { categoryIdLocal = catId; break; }
                    }
                    
                    const categorySettingsLocal = categoriesData[categoryIdLocal] || {};
                    const carryOverEnabled = categorySettingsLocal.carryOverPoints === true;
        
                    const teamsMap = new Map();
                    groupMatches.forEach(match => {
                        if (match.homeTeamIdentifier && !teamsMap.has(match.homeTeamIdentifier)) {
                            const teamName = getFinalTeamName(match.homeTeamIdentifier);
                            teamsMap.set(match.homeTeamIdentifier, {
                                id: match.homeTeamIdentifier, name: teamName,
                                played: 0, wins: 0, draws: 0, losses: 0,
                                goalsFor: 0, goalsAgainst: 0, points: 0, goalDifference: 0
                            });
                        }
                        if (match.awayTeamIdentifier && !teamsMap.has(match.awayTeamIdentifier)) {
                            const teamName = getFinalTeamName(match.awayTeamIdentifier);
                            teamsMap.set(match.awayTeamIdentifier, {
                                id: match.awayTeamIdentifier, name: teamName,
                                played: 0, wins: 0, draws: 0, losses: 0,
                                goalsFor: 0, goalsAgainst: 0, points: 0, goalDifference: 0
                            });
                        }
                    });
        
                    const currentPointsForWin = pointsForWin;
                    const allMatchesForComparison = [];
                    const transferredMatches = [];
                    const processedPairs = new Set();
        
                    // Vlastné zápasy skupiny
                    groupMatches.forEach(match => {
                        const homeTeam = teamsMap.get(match.homeTeamIdentifier);
                        const awayTeam = teamsMap.get(match.awayTeamIdentifier);
                        let homeName = homeTeam ? homeTeam.name : match.homeTeamIdentifier;
                        let awayName = awayTeam ? awayTeam.name : match.awayTeamIdentifier;
                        let homeScore = match.homeScore || 0;
                        let awayScore = match.awayScore || 0;
                        if (homeScore === 0 && awayScore === 0 && match.id) {
                            const events = window.matchTracker?.getEvents?.(match.id) || [];
                            const score = getCurrentScoreFromEvents(events);
                            homeScore = score.home; awayScore = score.away;
                        }
                        allMatchesForComparison.push({
                            ...match, homeTeamName: homeName, awayTeamName: awayName,
                            homeScore, awayScore, isTransferred: false
                        });
                        if (match.status === 'completed' && homeTeam && awayTeam) {
                            const pairKey = homeName < awayName ? `${homeName}|${awayName}` : `${awayName}|${homeName}`;
                            if (!processedPairs.has(pairKey)) {
                                processedPairs.add(pairKey);
                                homeTeam.played++; awayTeam.played++;
                                homeTeam.goalsFor += homeScore; homeTeam.goalsAgainst += awayScore;
                                awayTeam.goalsFor += awayScore; awayTeam.goalsAgainst += homeScore;
                                if (homeScore > awayScore) { homeTeam.wins++; homeTeam.points += currentPointsForWin; awayTeam.losses++; }
                                else if (awayScore > homeScore) { awayTeam.wins++; awayTeam.points += currentPointsForWin; homeTeam.losses++; }
                                else { homeTeam.draws++; homeTeam.points += 1; awayTeam.draws++; awayTeam.points += 1; }
                            }
                        }
                    });
        
                    // PRENOS ZO ZÁKLADNÝCH SKUPÍN (presne ako tables.js)
                    if (carryOverEnabled && allBaseGroupTables && allBaseGroupTables.length > 0) {
                        for (const baseTable of allBaseGroupTables) {
                            const baseCompletedMatches = baseTable.matches.filter(m => m.status === 'completed');
                            for (const match of baseCompletedMatches) {
                                let homeFinalName = null;
                                let awayFinalName = null;
                                for (const team of baseTable.teams) {
                                    if (team.id === match.homeTeamIdentifier) homeFinalName = team.name;
                                    if (team.id === match.awayTeamIdentifier) awayFinalName = team.name;
                                }
                                if (!homeFinalName || !awayFinalName) continue;
        
                                const homeInAdvanced = teamsMap.has(match.homeTeamIdentifier) ||
                                    Array.from(teamsMap.values()).some(t => t.name === homeFinalName);
                                const awayInAdvanced = teamsMap.has(match.awayTeamIdentifier) ||
                                    Array.from(teamsMap.values()).some(t => t.name === awayFinalName);
        
                                if (homeInAdvanced && awayInAdvanced) {
                                    const pairKey = homeFinalName < awayFinalName ?
                                        `${homeFinalName}|${awayFinalName}` : `${awayFinalName}|${homeFinalName}`;
                                    if (!processedPairs.has(pairKey)) {
                                        let homeScore = match.homeScore || 0;
                                        let awayScore = match.awayScore || 0;
                                        if (homeScore === 0 && awayScore === 0 && match.id) {
                                            const events = window.matchTracker?.getEvents?.(match.id) || [];
                                            const score = getCurrentScoreFromEvents(events);
                                            homeScore = score.home; awayScore = score.away;
                                        }
        
                                        let homeTeam = teamsMap.get(match.homeTeamIdentifier);
                                        let awayTeam = teamsMap.get(match.awayTeamIdentifier);
                                        if (!homeTeam) homeTeam = Array.from(teamsMap.values()).find(t => t.name === homeFinalName);
                                        if (!awayTeam) awayTeam = Array.from(teamsMap.values()).find(t => t.name === awayFinalName);
        
                                        if (homeTeam && awayTeam) {
                                            homeTeam.played++; awayTeam.played++;
                                            homeTeam.goalsFor += homeScore; homeTeam.goalsAgainst += awayScore;
                                            awayTeam.goalsFor += awayScore; awayTeam.goalsAgainst += homeScore;
                                            if (homeScore > awayScore) { homeTeam.wins++; homeTeam.points += currentPointsForWin; awayTeam.losses++; }
                                            else if (awayScore > homeScore) { awayTeam.wins++; awayTeam.points += currentPointsForWin; homeTeam.losses++; }
                                            else { homeTeam.draws++; homeTeam.points += 1; awayTeam.draws++; awayTeam.points += 1; }
        
                                            processedPairs.add(pairKey);
                                            transferredMatches.push({
                                                id: `transferred_${match.id}`,
                                                homeTeamIdentifier: match.homeTeamIdentifier,
                                                awayTeamIdentifier: match.awayTeamIdentifier,
                                                homeTeamName: homeFinalName, awayTeamName: awayFinalName,
                                                homeScore, awayScore,
                                                status: 'completed', isTransferred: true,
                                                fromGroup: match.groupName,
                                                scheduledTime: match.scheduledTime || null,
                                                hallId: match.hallId || null,
                                                categoryName: match.categoryName, categoryId: match.categoryId
                                            });
                                            allMatchesForComparison.push({
                                                ...match, homeTeamName: homeFinalName, awayTeamName: awayFinalName,
                                                homeScore, awayScore, isTransferred: true, fromGroup: match.groupName
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
        
                    // PRENOS Z INÝCH NADSTAVBOVÝCH SKUPÍN (presne ako tables.js)
                    const currentMatchIds = new Set(groupMatches.map(m => m.id));
                    if (carryOverEnabled && otherAdvancedMatches && otherAdvancedMatches.length > 0) {
                        for (const match of otherAdvancedMatches) {
                            if (currentMatchIds.has(match.id)) continue;
                            const homeTeamName = getFinalTeamName(match.homeTeamIdentifier);
                            const awayTeamName = getFinalTeamName(match.awayTeamIdentifier);
        
                            let homeTeam = null, awayTeam = null;
                            for (const team of teamsMap.values()) {
                                if (team.name === homeTeamName) homeTeam = team;
                                if (team.name === awayTeamName) awayTeam = team;
                            }
                            if (!homeTeam || !awayTeam) continue;
        
                            const pairKey = homeTeam.name < awayTeam.name
                                ? `${homeTeam.name}|${awayTeam.name}` : `${awayTeam.name}|${homeTeam.name}`;
                            if (processedPairs.has(pairKey)) continue;
        
                            if (match.status === 'completed') {
                                let homeScore = match.homeScore || 0;
                                let awayScore = match.awayScore || 0;
                                if (homeScore === 0 && awayScore === 0 && match.id) {
                                    const events = window.matchTracker?.getEvents?.(match.id) || [];
                                    const score = getCurrentScoreFromEvents(events);
                                    homeScore = score.home; awayScore = score.away;
                                }
        
                                homeTeam.played++; awayTeam.played++;
                                homeTeam.goalsFor += homeScore; homeTeam.goalsAgainst += awayScore;
                                awayTeam.goalsFor += awayScore; awayTeam.goalsAgainst += homeScore;
                                if (homeScore > awayScore) { homeTeam.wins++; homeTeam.points += currentPointsForWin; awayTeam.losses++; }
                                else if (awayScore > homeScore) { awayTeam.wins++; awayTeam.points += currentPointsForWin; homeTeam.losses++; }
                                else { homeTeam.draws++; homeTeam.points += 1; awayTeam.draws++; awayTeam.points += 1; }
        
                                processedPairs.add(pairKey);
                                transferredMatches.push({
                                    id: `transferred_adv_${match.id}`,
                                    homeTeamIdentifier: match.homeTeamIdentifier,
                                    awayTeamIdentifier: match.awayTeamIdentifier,
                                    homeTeamName: homeTeam.name, awayTeamName: awayTeam.name,
                                    homeScore, awayScore,
                                    status: 'completed', isTransferred: true,
                                    fromGroup: match.groupName || 'iná nadstavbová',
                                    scheduledTime: match.scheduledTime || null,
                                    hallId: match.hallId || null,
                                    categoryName: match.categoryName, categoryId: match.categoryId
                                });
                                allMatchesForComparison.push({
                                    ...match, homeTeamName: homeTeam.name, awayTeamName: awayTeam.name,
                                    homeScore, awayScore, isTransferred: true,
                                    fromGroup: match.groupName || 'iná nadstavbová'
                                });
                            }
                        }
                    }
        
                    const teams = Array.from(teamsMap.values());
                    teams.forEach(team => { team.goalDifference = team.goalsFor - team.goalsAgainst; });
        
                    const sortedTeams = [...teams].sort((a, b) => compareTeams(a, b, allMatchesForComparison, sortingConditions));
        
                    const totalMatches = groupMatches.length;
                    const completedCount = groupMatches.filter(m => m.status === 'completed').length;
        
                    return {
                        category, categoryId: categoryIdLocal, group, groupType: groupTypeLocal,
                        teams: sortedTeams,
                        totalMatches, completedCount,
                        matches: groupMatches,
                        matchesForComparison: allMatchesForComparison,
                        transferredMatches: transferredMatches,
                        sortingConditions: sortingConditions,
                        isFullyCompleted: totalMatches === completedCount,
                        carryOverEnabled: carryOverEnabled,
                        baseGroups: allBaseGroupTables ? allBaseGroupTables.map(t => t.group) : [],
                        pointsForWin: currentPointsForWin
                    };
                };
        
                // ===== ROZDEĽ ZÁPASY NA SKUPINY (presne ako calculateAllTables) =====
                const groupsMap = new Map();
                allMatches.forEach(match => {
                    if (match.isPlacementMatch) return;
                    if (!match.categoryName || !match.groupName) return;
                    const key = `${match.categoryName}|${match.groupName}`;
                    if (!groupsMap.has(key)) {
                        groupsMap.set(key, { category: match.categoryName, group: match.groupName, matches: [] });
                    }
                    groupsMap.get(key).matches.push(match);
                });
        
                const baseGroupTables = [];
                const advancedGroupData = [];
        
                for (const [key, groupData] of groupsMap) {
                    const { category: cat, group: grp, matches: grpMatches } = groupData;
                    let isAdvanced = false;
                    let catIdLocal = null;
                    for (const [catId, catData] of Object.entries(categoriesData)) {
                        if (catData && catData.name === cat) { catIdLocal = catId; break; }
                    }
                    if (catIdLocal && groupsData[catIdLocal]) {
                        const found = groupsData[catIdLocal].find(g => g.name === grp);
                        if (found && found.type === 'nadstavbová skupina') isAdvanced = true;
                    }
                    if (!isAdvanced && grp.toLowerCase().includes('nadstavbová')) isAdvanced = true;
        
                    if (isAdvanced) {
                        advancedGroupData.push({ category: cat, categoryId: catIdLocal, group: grp, matches: grpMatches, key });
                    } else {
                        const table = calculateGroupTable(cat, grp, grpMatches);
                        if (table) baseGroupTables.push(table);
                    }
                }
        
                const baseGroupsByCategory = {};
                for (const baseTable of baseGroupTables) {
                    if (!baseGroupsByCategory[baseTable.category]) baseGroupsByCategory[baseTable.category] = [];
                    baseGroupsByCategory[baseTable.category].push(baseTable);
                }
        
                const advancedMatchesByCategory = {};
                for (const adv of advancedGroupData) {
                    if (!advancedMatchesByCategory[adv.category]) advancedMatchesByCategory[adv.category] = [];
                    advancedMatchesByCategory[adv.category].push(...adv.matches);
                }
        
                // Nájdi tabuľku pre našu skupinu
                let targetTable = null;
                for (const advData of advancedGroupData) {
                    if (normalizeName(advData.group) === normalizeName(groupName)) {
                        const baseGroups = baseGroupsByCategory[advData.category] || [];
                        const otherAdvancedMatches = (advancedMatchesByCategory[advData.category] || [])
                            .filter(m => m.groupName && m.groupName.trim() !== advData.group.trim());
                        targetTable = calculateAdvancedGroupTable(
                            advData.category, advData.group, advData.matches,
                            baseGroups, otherAdvancedMatches
                        );
                        break;
                    }
                }
        
                // Ak to nie je nadstavbová, nájdi základnú
                if (!targetTable) {
                    for (const bt of baseGroupTables) {
                        if (normalizeName(bt.group) === normalizeName(groupName) &&
                            normalizeName(bt.category) === normalizeName(categoryName)) {
                            targetTable = bt;
                            break;
                        }
                    }
                }
        
                if (!targetTable) {
                    if (!isCancelled) {
                        setErrorTable(`Tabuľku pre skupinu ${groupName} sa nepodarilo vypočítať.`);
                        setLoadingTable(false);
                    }
                    return;
                }
        
                if (isCancelled) return;
        
                setExportedTable({
                    categoryName: targetTable.category,
                    groupName: targetTable.group,
                    groupType: targetTable.groupType,
                    teams: targetTable.teams,
                    sortedTeams: targetTable.teams,
                    matrix: buildMatrixFromTable(targetTable, allMatches),
                    teamNamesFromMatches: teamNamesLocal
                });
                setLoadingTable(false);
        
            } catch (err) {
                console.error('[EXPORT] loadData error:', err);
                if (!isCancelled) {
                    setErrorTable('Nepodarilo sa načítať tabuľku.');
                    setLoadingTable(false);
                }
            }
        };
        
        // Pomocná funkcia na zostavenie matrix z targetTable
        function buildMatrixFromTable(table, allMatches) {
            const matrix = {};
            const teams = table.teams || [];
            teams.forEach(t => { matrix[t.id] = {}; });
        
            // Vlastné zápasy
            (table.matches || []).forEach(m => {
                const h = m.homeTeamIdentifier;
                const a = m.awayTeamIdentifier;
                if (!h || !a) return;
                if (!matrix[h]) matrix[h] = {};
                if (!matrix[h][a]) {
                    matrix[h][a] = {
                        homeScore: m.homeScore ?? null,
                        awayScore: m.awayScore ?? null,
                        status: m.status || 'scheduled',
                        isTransferred: false
                    };
                }
            });
        
            // Prenesené zápasy
            (table.transferredMatches || []).forEach(tm => {
                // Nájdi tímy v tabuľke podľa mena alebo ID
                let homeTeam = teams.find(t => t.id === tm.homeTeamIdentifier);
                let awayTeam = teams.find(t => t.id === tm.awayTeamIdentifier);
                if (!homeTeam) homeTeam = teams.find(t => t.name === tm.homeTeamName);
                if (!awayTeam) awayTeam = teams.find(t => t.name === tm.awayTeamName);
                if (!homeTeam || !awayTeam) return;
        
                const h = homeTeam.id;
                const a = awayTeam.id;
                if (!matrix[h]) matrix[h] = {};
                if (!matrix[h][a]) {
                    matrix[h][a] = {
                        homeScore: tm.homeScore ?? null,
                        awayScore: tm.awayScore ?? null,
                        status: 'completed',
                        isTransferred: true,
                        fromGroup: tm.fromGroup
                    };
                }
            });
        
            return matrix;
        }

        loadData();

        return () => { isCancelled = true; };
    }, [exportHash && exportHash.type, exportHash && exportHash.categoryName, exportHash && exportHash.groupName, pointsForWin, sortingConditions, isTrackerReady]);

    const availableGroupTypes = selectedCategoryId
        ? Array.from(new Set((groups[selectedCategoryId] || []).map(g => g.type))).sort((a, b) => {
            if (a === b) return 0;
            return a === 'základná skupina' ? -1 : 1;
        })
        : [];

    const availableGroups = (selectedCategoryId && selectedGroupType)
        ? (groups[selectedCategoryId] || [])
            .filter(g => g.type === selectedGroupType)
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name))
        : [];

    const formatGroupType = (type) => {
        if (!type) return '';
        return type.charAt(0).toUpperCase() + type.slice(1);
    };

    const isGenerateDisabled =
        !selectedOption ||
        (selectedOption === 'tabulky' && (!selectedCategoryId || !selectedGroupType || !selectedGroupName));

    const handleGenerate = () => {
        if (!selectedOption) {
            window.showGlobalNotification('Prosím, vyberte možnosť pred generovaním.', 'error');
            return;
        }
        if (selectedOption === 'tabulky') {
            if (!selectedCategoryId || !selectedGroupType || !selectedGroupName) {
                window.showGlobalNotification('Prosím, vyberte kategóriu, typ skupiny aj konkrétnu skupinu.', 'error');
                return;
            }
            const selectedCategory = categories.find(c => c.id === selectedCategoryId);
            const categoryName = selectedCategory ? selectedCategory.name : selectedCategoryId;
            const categoryNameSafe = spacesToDashes(categoryName);
            const groupNameSafe = spacesToDashes(selectedGroupName);
            const hash = `tabulky/${categoryNameSafe}/${groupNameSafe}`;
            window.open(`logged-in-export.html#${hash}`, '_blank');
            return;
        }
        window.open(`logged-in-export.html#${selectedOption}`, '_blank');
    };

    if (exportHash && exportHash.type === 'tabulky') {
        return React.createElement(
            'div',
            { className: 'w-full p-0 m-0' },

            loadingTable && React.createElement(
                'div',
                { className: 'flex justify-center items-center py-16' },
                React.createElement('div', { className: 'animate-spin rounded-full h-12 w-12 border-b-4 border-blue-500' })
            ),

            errorTable && React.createElement(
                'div',
                { className: 'bg-red-50 border border-red-200 rounded-lg p-6 text-center m-4' },
                React.createElement('p', { className: 'text-red-700 font-medium' }, errorTable)
            ),

            !loadingTable && !errorTable && exportedTable && React.createElement(
                CrossTable,
                {
                    teams: exportedTable.teams,
                    sortedTeams: exportedTable.sortedTeams,
                    matrix: exportedTable.matrix,
                    categoryName: exportedTable.categoryName,
                    groupName: exportedTable.groupName,
                    groupType: exportedTable.groupType,
                    pointsForWin: pointsForWin,
                    teamNamesFromMatches: exportedTable.teamNamesFromMatches
                }
            )
        );
    }

    if (exportHash && exportHash.type === 'zapasy') {
        return React.createElement(
            'div',
            { className: 'w-full p-0 m-0' },
            React.createElement(
                'div',
                { className: 'mb-6 text-center pt-6' },
                React.createElement('h1', { className: 'text-2xl font-bold text-gray-800' }, 'Zápasy v športovej hale')
            ),
            React.createElement(
                'div',
                { className: 'text-center py-12 text-gray-500 bg-gray-50 rounded-xl m-4' },
                React.createElement('p', { className: 'text-lg' }, 'Export zápasov – pripravované.')
            )
        );
    }

    return React.createElement(
        'div',
        { className: 'flex-grow flex justify-center items-center' },
        React.createElement(
            'div',
            { className: `w-full max-w-2xl bg-white rounded-xl shadow-xl p-8` },
            React.createElement(
                'div',
                { className: `flex flex-col items-center justify-center mb-6 p-4 -mx-8 -mt-8 rounded-t-xl` },
                React.createElement('h2', { className: 'text-3xl font-bold tracking-tight text-center' }, 'Export')
            ),
            React.createElement(
                'div',
                { className: 'flex flex-col gap-6' },

                React.createElement(
                    'div',
                    { className: 'flex flex-col gap-2' },
                    React.createElement('label', { htmlFor: 'export-option', className: 'text-sm font-medium text-gray-700' }, 'Vyberte typ exportu'),
                    React.createElement(
                        'select',
                        {
                            id: 'export-option',
                            value: selectedOption,
                            onChange: (e) => setSelectedOption(e.target.value),
                            className: 'w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 bg-white text-gray-700'
                        },
                        React.createElement('option', { value: '' }, '-- Vyberte možnosť --'),
                        React.createElement('option', { value: 'zapasy' }, 'Zápasy v športovej hale'),
                        React.createElement('option', { value: 'tabulky' }, 'Tabuľky')
                    )
                ),

                selectedOption === 'tabulky' && React.createElement(
                    React.Fragment,
                    null,
                    React.createElement(
                        'div',
                        { className: 'flex flex-col gap-2' },
                        React.createElement('label', { htmlFor: 'category-option', className: 'text-sm font-medium text-gray-700' }, 'Vyberte kategóriu'),
                        React.createElement(
                            'select',
                            {
                                id: 'category-option',
                                value: selectedCategoryId,
                                onChange: (e) => setSelectedCategoryId(e.target.value),
                                disabled: isLoadingCategories || categories.length === 0,
                                className: `w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 bg-white text-gray-700 ${(isLoadingCategories || categories.length === 0) ? 'cursor-not-allowed opacity-60' : ''}`
                            },
                            React.createElement('option', { value: '' },
                                isLoadingCategories ? '-- Načítavam kategórie... --'
                                    : (categories.length === 0 ? '-- Žiadne kategórie --' : '-- Vyberte kategóriu --')
                            ),
                            categories.map(cat => React.createElement('option', { key: cat.id, value: cat.id }, cat.name))
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'flex flex-col gap-2' },
                        React.createElement('label', { htmlFor: 'group-type-option', className: 'text-sm font-medium text-gray-700' }, 'Vyberte typ skupiny'),
                        React.createElement(
                            'select',
                            {
                                id: 'group-type-option',
                                value: selectedGroupType,
                                onChange: (e) => setSelectedGroupType(e.target.value),
                                disabled: !selectedCategoryId || availableGroupTypes.length === 0,
                                className: `w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 bg-white text-gray-700 ${(!selectedCategoryId || availableGroupTypes.length === 0) ? 'cursor-not-allowed opacity-60' : ''}`
                            },
                            React.createElement('option', { value: '' },
                                !selectedCategoryId ? '-- Najprv vyberte kategóriu --'
                                    : (availableGroupTypes.length === 0 ? '-- Žiadne typy skupín --' : '-- Vyberte typ skupiny --')
                            ),
                            availableGroupTypes.map((type, idx) =>
                                React.createElement('option', { key: `${type}-${idx}`, value: type }, formatGroupType(type))
                            )
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'flex flex-col gap-2' },
                        React.createElement('label', { htmlFor: 'group-option', className: 'text-sm font-medium text-gray-700' }, 'Vyberte skupinu'),
                        React.createElement(
                            'select',
                            {
                                id: 'group-option',
                                value: selectedGroupName,
                                onChange: (e) => setSelectedGroupName(e.target.value),
                                disabled: !selectedGroupType || availableGroups.length === 0,
                                className: `w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 bg-white text-gray-700 ${(!selectedGroupType || availableGroups.length === 0) ? 'cursor-not-allowed opacity-60' : ''}`
                            },
                            React.createElement('option', { value: '' },
                                !selectedGroupType ? '-- Najprv vyberte typ skupiny --'
                                    : (availableGroups.length === 0 ? '-- Žiadne skupiny --' : '-- Vyberte skupinu --')
                            ),
                            availableGroups.map((group, idx) =>
                                React.createElement('option', { key: `${group.name}-${idx}`, value: group.name }, group.name)
                            )
                        )
                    )
                ),

                React.createElement(
                    'div',
                    { className: isGenerateDisabled ? 'cursor-not-allowed' : '' },
                    React.createElement(
                        'button',
                        {
                            onClick: handleGenerate,
                            disabled: isGenerateDisabled,
                            className: `w-full px-6 py-3 rounded-lg font-semibold transition-all duration-200 shadow-md ${!isGenerateDisabled ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer' : 'bg-white border-2 border-blue-600 text-blue-600 cursor-not-allowed'}`
                        },
                        'Generovať'
                    )
                )
            )
        )
    );
};

const CrossTable = ({
    teams,
    sortedTeams,
    matrix,
    categoryName,
    groupName,
    groupType,
    pointsForWin,
    teamNamesFromMatches
}) => {
    if (!teams || teams.length === 0) {
        return React.createElement(
            'div',
            { className: 'text-center py-12 text-gray-500 bg-gray-50 rounded-xl' },
            React.createElement('p', { className: 'text-lg' }, 'Pre túto skupinu neexistujú žiadne tímy.')
        );
    }

    const orderedTeams = (sortedTeams && sortedTeams.length > 0)
        ? sortedTeams.map(s => {
            const original = teams.find(t => t.id === s.id);
            return original || { id: s.id, name: s.name };
        })
        : teams;

    const winPoints = (pointsForWin !== undefined && pointsForWin !== null) ? pointsForWin : 3;
    const drawPoints = 1;

    const CELL_WIDTH = '200px';
    const CELL_HEIGHT = '200px';
    const MIDDLE_CELL_WIDTH = '20px'; 
    const SIDE_CELL_WIDTH = '90px';

    const cellStyle = {
        width: CELL_WIDTH,
        minWidth: CELL_WIDTH,
        maxWidth: CELL_WIDTH,
        height: CELL_HEIGHT,
        minHeight: CELL_HEIGHT,
        maxHeight: CELL_HEIGHT
    };

    const subCellBaseStyle = {
        width: SIDE_CELL_WIDTH,
        minWidth: SIDE_CELL_WIDTH,
        maxWidth: SIDE_CELL_WIDTH,
        height: CELL_HEIGHT,
        minHeight: CELL_HEIGHT,
        maxHeight: CELL_HEIGHT,
        borderLeft: '1px solid #ffffff',
        borderRight: '1px solid #ffffff'
    };

    const subCellMiddleStyle = {
        width: MIDDLE_CELL_WIDTH,
        minWidth: MIDDLE_CELL_WIDTH,
        maxWidth: MIDDLE_CELL_WIDTH,
        height: CELL_HEIGHT,
        minHeight: CELL_HEIGHT,
        maxHeight: CELL_HEIGHT,
        borderLeft: '1px solid #ffffff',
        borderRight: '1px solid #ffffff'
    };

    const subCellLeftStyle = { ...subCellBaseStyle, borderLeft: '1px solid #000000' };
    const subCellRightStyle = { ...subCellBaseStyle, borderRight: '1px solid #000000' };

    const diagonalCellStyle = {
        width: CELL_WIDTH,
        minWidth: CELL_WIDTH,
        maxWidth: CELL_WIDTH,
        height: CELL_HEIGHT,
        minHeight: CELL_HEIGHT,
        maxHeight: CELL_HEIGHT,
        background: `
            linear-gradient(to bottom right,
                transparent calc(50% - 1px),
                #000000 50%,
                transparent calc(50% + 1px)),
            linear-gradient(to bottom left,
                transparent calc(50% - 1px),
                #000000 50%,
                transparent calc(50% + 1px))
        `,
        border: '1px solid #000000'
    };

    const FONT_CLASS = 'text-2xl font-bold';
    const baseCell = 'border border-black text-black align-middle text-center';
    const baseThCell = 'border border-black text-black align-middle text-center bg-white';

    const TRANSFERRED_BG = '#f3f4f6';

    const getLastChar = (team) => {
        if (!team || !team.name) return '';
        const trimmed = String(team.name).trim();
        if (trimmed.length === 0) return '';
        return trimmed.charAt(trimmed.length - 1).toUpperCase();
    };
   
     const isTransferredByLastChar = (rowTeam, colTeam) => {
         if (groupType !== 'nadstavbová skupina') return false;
     
         if (!rowTeam || !colTeam) return false;
         if (rowTeam.id === colTeam.id) return false;
     
         const rowChar = getLastChar(rowTeam);
         const colChar = getLastChar(colTeam);
     
         if (!rowChar || !colChar) return false;
         if (!/[A-Z]/.test(rowChar) || !/[A-Z]/.test(colChar)) return false;
         if (rowChar !== colChar) return false;
     
         const direct = matrix?.[rowTeam.id]?.[colTeam.id];
         const reversed = matrix?.[colTeam.id]?.[rowTeam.id];
         if (direct || reversed) return false;
     
         return true;
     };

    const getMatchResult = (rowTeamId, colTeamId) => {
        const direct = matrix?.[rowTeamId]?.[colTeamId];
        if (direct) {
            return {
                homeScore: direct.homeScore,
                awayScore: direct.awayScore,
                status: direct.status,
                isTransferred: direct.isTransferred || false
            };
        }
        const reversed = matrix?.[colTeamId]?.[rowTeamId];
        if (reversed) {
            return {
                homeScore: reversed.awayScore,
                awayScore: reversed.homeScore,
                status: reversed.status,
                isTransferred: reversed.isTransferred || false
            };
        }
        return null;
    };

    const isMatchCompleted = (matchResult) => {
        if (!matchResult) return false;
        return matchResult.status === 'completed'
            || (matchResult.homeScore !== null
                && matchResult.awayScore !== null
                && matchResult.status !== 'scheduled');
    };

    const getStats = (teamId) => {
        if (!sortedTeams) return null;
        return sortedTeams.find(t => t.id === teamId) || null;
    };

    const getPosition = (teamId) => {
        if (!sortedTeams) return '';
        const idx = sortedTeams.findIndex(t => t.id === teamId);
        return idx === -1 ? '' : idx + 1;
    };

    return React.createElement(
        'div',
        { className: 'bg-white p-0 m-0' },
        React.createElement(
            'div',
            { className: 'p-0 m-0' },
            React.createElement(
                'table',
                {
                    className: 'border-collapse',
                    style: { tableLayout: 'fixed', margin: 0, padding: 0, borderSpacing: 0 }
                },

                React.createElement(
                    'thead',
                    null,
                    React.createElement(
                        'tr',
                        null,
                        React.createElement(
                            'th',
                            {
                                className: baseThCell + ' px-3 py-2',
                                style: cellStyle,
                                rowSpan: 1
                            },
                            React.createElement(
                                'div',
                                { className: 'flex flex-col items-center justify-center leading-tight' },
                                React.createElement('span', { className: FONT_CLASS + ' text-black' }, categoryName),
                                React.createElement('span', { className: FONT_CLASS + ' text-black mt-1' }, groupName)
                            )
                        ),
                        orderedTeams.map((team) =>
                            React.createElement(
                                'th',
                                {
                                    key: team.id,
                                    colSpan: 3,
                                    className: baseThCell + ' px-3 py-2 ' + FONT_CLASS,
                                    style: cellStyle
                                },
                                team.name
                            )
                        ),
                        React.createElement('th', {
                            colSpan: 3,
                            className: baseThCell + ' px-3 py-2 ' + FONT_CLASS,
                            style: cellStyle
                        }, 'Skóre'),
                        React.createElement('th', {
                            className: baseThCell + ' px-3 py-2 ' + FONT_CLASS,
                            style: cellStyle
                        }, 'Body'),
                        React.createElement('th', {
                            className: baseThCell + ' px-3 py-2 ' + FONT_CLASS,
                            style: cellStyle
                        }, 'Miesto v\u00A0skupine')
                    )
                ),

                React.createElement(
                    'tbody',
                    null,
                    orderedTeams.map((rowTeam) => {
                        const stats = getStats(rowTeam.id);
                        const position = getPosition(rowTeam.id);

                        const rowCells = [];

                        rowCells.push(
                            React.createElement(
                                'th',
                                {
                                    key: 'row-name-' + rowTeam.id,
                                    className: baseThCell + ' px-3 py-2 ' + FONT_CLASS + ' text-left',
                                    style: cellStyle
                                },
                                rowTeam.name
                            )
                        );

                        orderedTeams.forEach((colTeam) => {
                            const keyBase = `${rowTeam.id}-${colTeam.id}`;

                            if (rowTeam.id === colTeam.id) {
                                rowCells.push(
                                    React.createElement('td', {
                                        key: `${keyBase}-diag`,
                                        colSpan: 3,
                                        className: 'text-center align-middle',
                                        style: diagonalCellStyle
                                    }, '')
                                );
                                return;
                            }

                            const matchResult = getMatchResult(rowTeam.id, colTeam.id);

                            const transferredByChar = isTransferredByLastChar(rowTeam, colTeam);

                            if (!isMatchCompleted(matchResult) && transferredByChar) {
                                const tLeftStyle = { ...subCellLeftStyle, color: '#000', backgroundColor: TRANSFERRED_BG };
                                const tMiddleStyle = { ...subCellMiddleStyle, color: '#000', backgroundColor: TRANSFERRED_BG };
                                const tRightStyle = { ...subCellRightStyle, color: '#000', backgroundColor: TRANSFERRED_BG };
                            
                                tLeftStyle.borderRight = `1px solid ${TRANSFERRED_BG}`;
                                tMiddleStyle.borderLeft = `1px solid ${TRANSFERRED_BG}`;
                                tMiddleStyle.borderRight = `1px solid ${TRANSFERRED_BG}`;
                                tRightStyle.borderLeft = `1px solid ${TRANSFERRED_BG}`;
                            
                                rowCells.push(
                                    React.createElement('td', {
                                        key: `${keyBase}-t1`,
                                        className: baseCell + ' ' + FONT_CLASS,
                                        style: tLeftStyle
                                    }, ''),
                                    React.createElement('td', {
                                        key: `${keyBase}-t2`,
                                        className: baseCell + ' ' + FONT_CLASS,
                                        style: tMiddleStyle
                                    }, ':'),
                                    React.createElement('td', {
                                        key: `${keyBase}-t3`,
                                        className: baseCell + ' ' + FONT_CLASS,
                                        style: tRightStyle
                                    }, '')
                                );
                                return;
                            }

                            if (!isMatchCompleted(matchResult)) {
                                rowCells.push(
                                    React.createElement('td', {
                                        key: `${keyBase}-s1`,
                                        className: baseCell + ' ' + FONT_CLASS,
                                        style: { ...subCellLeftStyle, color: '#000', backgroundColor: '#fff' }
                                    }, ''),
                                    React.createElement('td', {
                                        key: `${keyBase}-s2`,
                                        className: baseCell + ' ' + FONT_CLASS,
                                        style: { ...subCellMiddleStyle, color: '#000', backgroundColor: '#fff' }
                                    }, ':'),
                                    React.createElement('td', {
                                        key: `${keyBase}-s3`,
                                        className: baseCell + ' ' + FONT_CLASS,
                                        style: { ...subCellRightStyle, color: '#000', backgroundColor: '#fff' }
                                    }, '')
                                );
                                return;
                            }

                            const hs = matchResult.homeScore ?? 0;
                            const as = matchResult.awayScore ?? 0;

                            if (hs === 0 && as === 0) {
                                const zBgColor = matchResult.isTransferred ? TRANSFERRED_BG : '#fff';
                            
                                const zLeftStyle = { ...subCellLeftStyle, color: '#000', backgroundColor: zBgColor };
                                const zMiddleStyle = { ...subCellMiddleStyle, color: '#000', backgroundColor: zBgColor };
                                const zRightStyle = { ...subCellRightStyle, color: '#000', backgroundColor: zBgColor };

                                if (matchResult.isTransferred) {
                                    zLeftStyle.borderRight = `1px solid ${TRANSFERRED_BG}`;
                                    zMiddleStyle.borderLeft = `1px solid ${TRANSFERRED_BG}`;
                                    zMiddleStyle.borderRight = `1px solid ${TRANSFERRED_BG}`;
                                    zRightStyle.borderLeft = `1px solid ${TRANSFERRED_BG}`;
                                }

                                rowCells.push(
                                    React.createElement('td', {
                                        key: `${keyBase}-z1`,
                                        className: baseCell + ' ' + FONT_CLASS,
                                        style: zLeftStyle
                                    }, ''),
                                    React.createElement('td', {
                                        key: `${keyBase}-z2`,
                                        className: baseCell + ' ' + FONT_CLASS,
                                        style: zMiddleStyle
                                    }, ':'),
                                    React.createElement('td', {
                                        key: `${keyBase}-z3`,
                                        className: baseCell + ' ' + FONT_CLASS,
                                        style: zRightStyle
                                    }, '')
                                );
                                return;
                            }

                            const bgColor = matchResult.isTransferred ? TRANSFERRED_BG : '';

                            const leftStyle = { ...subCellLeftStyle };
                            const middleStyle = { ...subCellMiddleStyle  };
                            const rightStyle = { ...subCellRightStyle };

                            if (bgColor) {
                                leftStyle.backgroundColor = bgColor;
                                middleStyle.backgroundColor = bgColor;
                                rightStyle.backgroundColor = bgColor;

                                leftStyle.borderRight = `1px solid ${bgColor}`;
                                middleStyle.borderLeft = `1px solid ${bgColor}`;
                                middleStyle.borderRight = `1px solid ${bgColor}`;
                                rightStyle.borderLeft = `1px solid ${bgColor}`;
                            }

                            rowCells.push(
                                React.createElement('td', {
                                    key: `${keyBase}-l`,
                                    className: baseCell + ' ' + FONT_CLASS,
                                    style: { ...leftStyle, textAlign: 'right', paddingRight: '10px' }
                                }, hs),
                                React.createElement('td', {
                                    key: `${keyBase}-m`,
                                    className: baseCell + ' ' + FONT_CLASS,
                                    style: middleStyle
                                }, ':'),
                                React.createElement('td', {
                                    key: `${keyBase}-r`,
                                    className: baseCell + ' ' + FONT_CLASS,
                                    style: { ...rightStyle, textAlign: 'left', paddingLeft: '10px' }
                                }, as)
                            );
                        });

                        const showTotals = stats && stats.played > 0;
                        rowCells.push(
                            React.createElement('td', {
                                key: 'total-scored',
                                className: baseCell + ' ' + FONT_CLASS,
                                style: { ...subCellLeftStyle, textAlign: 'right', paddingRight: '10px' }
                            }, showTotals ? stats.goalsFor : ''),
                            React.createElement('td', {
                                key: 'total-colon',
                                className: baseCell + ' ' + FONT_CLASS,
                                style: subCellMiddleStyle
                            }, ':'), 
                            React.createElement('td', {
                                key: 'total-conceded',
                                className: baseCell + ' ' + FONT_CLASS,
                                style: { ...subCellRightStyle, textAlign: 'left', paddingLeft: '10px' }
                            }, showTotals ? stats.goalsAgainst : '')
                        );

                        rowCells.push(
                            React.createElement('td', {
                                key: 'points',
                                className: baseCell + ' ' + FONT_CLASS,
                                style: cellStyle
                            }, stats && stats.played > 0 ? stats.points : '')
                        );

                        rowCells.push(
                            React.createElement('td', {
                                key: 'position',
                                className: baseCell + ' ' + FONT_CLASS,
                                style: cellStyle
                            }, stats && stats.played > 0 ? position : '')
                        );

                        return React.createElement(
                            'tr',
                            { key: rowTeam.id },
                            rowCells
                        );
                    })
                )
            )
        )
    );
};

let isEmailSyncListenerSetup = false;

const handleDataUpdateAndRender = (event) => {
    const userProfileData = event.detail;
    const rootElement = document.getElementById('root');

    const hasHashInUrl = window.location.hash && window.location.hash.length > 1;
    const isExportPage = window.location.pathname.endsWith('logged-in-export.html');
    const shouldRenderExportWithoutUser = isExportPage && hasHashInUrl;

    if (userProfileData || shouldRenderExportWithoutUser) {
        if (userProfileData) {
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
                                    window.showGlobalNotification('E-mailová adresa bola automaticky aktualizovaná a synchronizovaná.', 'success');
                                }
                            }
                        } catch (error) {
                        }
                    }
                });
                isEmailSyncListenerSetup = true;
            }
        }

        if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
            const root = ReactDOM.createRoot(rootElement);
            root.render(React.createElement(ExportApp, { userProfileData: userProfileData || null }));
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

window.addEventListener('globalDataUpdated', handleDataUpdateAndRender);

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
