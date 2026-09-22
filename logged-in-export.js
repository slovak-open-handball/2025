// logged-in-export.js
import { doc, getDoc, onSnapshot, updateDoc, addDoc, collection, Timestamp, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const { useState, useEffect, useRef, useMemo, useCallback } = React;

/* ============================================================
   GLOBÁLNA NOTIFIKÁCIA
   ============================================================ */
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

/* ============================================================
   SKRYTIE HLAVIČKY / MENU PRI HASHI
   ============================================================ */
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

/* ============================================================
   POMOCNÉ FUNKCIE PRE URL
   ============================================================ */
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

/* ============================================================
   POMOCNÉ FUNKCIE PRE TABUĽKU
   ============================================================ */
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

/**
 * Vyrieši display názov tímu z identifikátora (napr. "U12 D 1A" → "HK Slovan Duslo Šaľa A").
 */
const resolveTeamDisplayName = (identifier) => {
    if (!identifier) return '???';

    // 1) window.teamNames (najrýchlejšie)
    if (window.teamNames && window.teamNames[identifier]) {
        return window.teamNames[identifier];
    }

    // 2) matchTracker.getTeamNameByDisplayId
    if (
        window.matchTracker &&
        typeof window.matchTracker.getTeamNameByDisplayId === 'function'
    ) {
        try {
            const mapped = window.matchTracker.getTeamNameByDisplayId(identifier);
            if (mapped && mapped !== identifier) return mapped;
        } catch (e) { /* ignore */ }
    }

    // 3) fallback
    const fallback = getDisplayTeamName(identifier);
    if (fallback && fallback !== identifier) return fallback;

    return identifier;
};

/**
 * Rovnaká logika ako v tables.js – compareTeams
 */
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

/* ============================================================
   HLAVNÝ KOMPONENT
   ============================================================ */
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

    /* --------- Načítanie pointsForWin + sortingConditions zo settings/table --------- */
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
                console.error("Chyba pri načítavaní nastavení tabuľky:", error);
            }
        );
        return () => unsubscribe();
    }, []);

    /* --------- Načítanie kategórií a skupín --------- */
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
                console.error("Chyba pri načítavaní kategórií:", error);
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
                console.error("Chyba pri načítavaní skupín:", error);
                window.showGlobalNotification('Nastala chyba pri načítavaní skupín.', 'error');
            }
        );

        return () => {
            unsubscribeCategories();
            unsubscribeGroups();
        };
    }, [selectedOption, exportHash]);

    /* --------- Reset select boxov --------- */
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

   /* --------- Čakanie na pripravenosť matchTracker / teamNameMapping --------- */
    useEffect(() => {
        // Ak už je matchTracker pripravený, nastavíme hneď
        if (window.matchTracker && window.matchTracker.isDataReady && window.matchTracker.isDataReady()) {
            console.log('[EXPORT] matchTracker je už pripravený (isDataReady = true)');
            setIsTrackerReady(true);
            return;
        }

        // Ak už existuje mapovanie tímov, nastavíme hneď
        if (window.__teamNameMapping && Object.keys(window.__teamNameMapping).length > 0) {
            console.log('[EXPORT] teamNameMapping už existuje, nastavujem isTrackerReady = true');
            setIsTrackerReady(true);
            return;
        }

        // Inak čakáme na udalosti
        const handleTrackerReady = (event) => {
            console.log('[EXPORT] ✅ Prijatá udalosť matchTrackerReady', event?.detail);
            setIsTrackerReady(true);
        };

        const handleMappingReady = (event) => {
            console.log('[EXPORT] ✅ Prijatá udalosť teamNameMappingReady', event?.detail);
            setIsTrackerReady(true);
        };

        window.addEventListener('matchTrackerReady', handleTrackerReady);
        window.addEventListener('teamNameMappingReady', handleMappingReady);

        // Fallback: polling každých 500 ms, max 60 sekúnd
        let attempts = 0;
        const maxAttempts = 120;
        const pollInterval = setInterval(() => {
            attempts++;

            const dataReady = window.matchTracker?.isDataReady?.();
            const mappingReady = window.__teamNameMapping && Object.keys(window.__teamNameMapping).length > 0;

            if (dataReady || mappingReady) {
                console.log(`[EXPORT] ✅ Fallback polling: pripravené po ${attempts} pokusoch`);
                clearInterval(pollInterval);
                setIsTrackerReady(true);
                return;
            }

            if (attempts >= maxAttempts) {
                console.warn('[EXPORT] ⚠️ Fallback polling: timeout po 60s, pokračujem aj tak');
                clearInterval(pollInterval);
                setIsTrackerReady(true);
            }
        }, 500);

        return () => {
            window.removeEventListener('matchTrackerReady', handleTrackerReady);
            window.removeEventListener('teamNameMappingReady', handleMappingReady);
            clearInterval(pollInterval);
        };
    }, []);

    /* ============================================================
       NAČÍTANIE TABUĽKY PRE HASH
       (rovnaká logika ako tables.js – calculateGroupTable / calculateAdvancedGroupTable)
       ============================================================ */
    useEffect(() => {
        if (!exportHash || exportHash.type !== 'tabulky') {
            setExportedTable(null);
            return;
        }

        // 🔥 KĽÚČOVÉ: Počkáme, kým matchTracker / teamNameMapping nie je pripravený
        if (!isTrackerReady) {
            console.log('[EXPORT] ⏳ Čakám na pripravenosť matchTracker / teamNameMapping...');
            setLoadingTable(true);
            return;
        }

        console.log('[EXPORT] 🚀 matchTracker je pripravený, spúšťam loadData()');

        let isCancelled = false;
        setLoadingTable(true);
        setErrorTable(null);

        const loadData = async () => {
            try {
                // 1) Načítame settings/categories a settings/groups
                const [categoriesSnap, groupsSnap] = await Promise.all([
                    getDoc(doc(window.db, 'settings', 'categories')),
                    getDoc(doc(window.db, 'settings', 'groups'))
                ]);

                const categoriesData = categoriesSnap.exists() ? categoriesSnap.data() : {};
                const groupsData = groupsSnap.exists() ? groupsSnap.data() : {};

                // 2) Nájdeme categoryId podľa názvu kategórie z URL
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
                        setErrorTable(`Kategória "${exportHash.categoryName}" sa nenašla.`);
                        setLoadingTable(false);
                    }
                    return;
                }

                // 3) Nájdeme skupinu v rámci kategórie
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
                        setErrorTable(`Skupina "${exportHash.groupName}" sa v kategórii "${categoryName}" nenašla.`);
                        setLoadingTable(false);
                    }
                    return;
                }

                const groupName = foundGroup.name;
                const groupType = foundGroup.type;

                // 4) Načítame všetky zápasy
                const matchesSnap = await getDocs(collection(window.db, 'matches'));
                const allMatches = [];
                matchesSnap.forEach(d => allMatches.push({ id: d.id, ...d.data() }));

                // 5) Vytvoríme "teamNames" mapovanie (identifier → displayName)
                //    🔥 POUŽIJEME matchTracker.getTeamNameByDisplayId SYNCHRÓNNE pre každý identifier
                const teamNamesFromMatches = { ...(window.teamNames || {}) };

                // 5a) Použijeme window.__teamNameMapping (z func-tables.js), ak existuje
                if (window.__teamNameMapping && typeof window.__teamNameMapping === 'object') {
                    for (const [identifier, data] of Object.entries(window.__teamNameMapping)) {
                        if (data && data.teamName && !teamNamesFromMatches[identifier]) {
                            teamNamesFromMatches[identifier] = data.teamName;
                        }
                    }
                    console.log('[EXPORT] Použité mapovanie z window.__teamNameMapping:',
                        Object.keys(window.__teamNameMapping).length, 'položiek');
                }

                // 5b) Použijeme cache z localStorage, ak existuje
                if (window.__internalReplacementCache) {
                    try {
                        const cache = window.__internalReplacementCache.get?.();
                        if (cache && typeof cache.forEach === 'function') {
                            cache.forEach((value, key) => {
                                if (value && value.displayId && value.teamName) {
                                    if (!teamNamesFromMatches[value.displayId]) {
                                        teamNamesFromMatches[value.displayId] = value.teamName;
                                    }
                                }
                            });
                            console.log('[EXPORT] Použitá cache z window.__internalReplacementCache');
                        }
                    } catch (e) {
                        console.warn('[EXPORT] Chyba pri čítaní __internalReplacementCache:', e);
                    }
                }

                // 5c) 🔥 KĽÚČOVÉ: Pre KAŽDÝ identifier v zápasoch zavoláme SYNCHRÓNNE
                //     matchTracker.getTeamNameByDisplayId(identifier)
                if (window.matchTracker && typeof window.matchTracker.getTeamNameByDisplayId === 'function') {
                    let resolvedCount = 0;

                    for (const match of allMatches) {
                        // HOME
                        if (match.homeTeamIdentifier && !teamNamesFromMatches[match.homeTeamIdentifier]) {
                            try {
                                const mapped = window.matchTracker.getTeamNameByDisplayId(match.homeTeamIdentifier);
                                if (mapped && mapped !== match.homeTeamIdentifier) {
                                    teamNamesFromMatches[match.homeTeamIdentifier] = mapped;
                                    resolvedCount++;
                                }
                            } catch (e) { /* ignore */ }
                        }

                        // AWAY
                        if (match.awayTeamIdentifier && !teamNamesFromMatches[match.awayTeamIdentifier]) {
                            try {
                                const mapped = window.matchTracker.getTeamNameByDisplayId(match.awayTeamIdentifier);
                                if (mapped && mapped !== match.awayTeamIdentifier) {
                                    teamNamesFromMatches[match.awayTeamIdentifier] = mapped;
                                    resolvedCount++;
                                }
                            } catch (e) { /* ignore */ }
                        }
                    }

                    console.log('[EXPORT] Cez matchTracker.getTeamNameByDisplayId (sync) vyriešených:', resolvedCount);
                } else {
                    console.warn('[EXPORT] ⚠️ matchTracker.getTeamNameByDisplayId NIE JE dostupný!');
                }

                console.log('[EXPORT] teamNamesFromMatches (po načítaní):', teamNamesFromMatches);

                // 6) Vytvoríme maticu vzájomných zápasov (matica pre konkrétnu skupinu)
                const groupMatches = allMatches.filter(m => {
                    if (m.isPlacementMatch) return false;
                    let mCatName = m.categoryName;
                    if (!mCatName && m.categoryId && categoriesData[m.categoryId]) {
                        mCatName = categoriesData[m.categoryId].name;
                    }
                    if (!mCatName || !m.groupName) return false;
                    return normalizeName(mCatName) === normalizeName(categoryName)
                        && normalizeName(m.groupName) === normalizeName(groupName);
                });

                // 7) Zoznam tímov (v skupine) – použijeme ID z groupMatches
                const teamsMap = new Map();
                groupMatches.forEach(m => {
                    if (m.homeTeamIdentifier && !teamsMap.has(m.homeTeamIdentifier)) {
                        teamsMap.set(m.homeTeamIdentifier, {
                            id: m.homeTeamIdentifier,
                            name: teamNamesFromMatches[m.homeTeamIdentifier] || m.homeTeamIdentifier
                        });
                    }
                    if (m.awayTeamIdentifier && !teamsMap.has(m.awayTeamIdentifier)) {
                        teamsMap.set(m.awayTeamIdentifier, {
                            id: m.awayTeamIdentifier,
                            name: teamNamesFromMatches[m.awayTeamIdentifier] || m.awayTeamIdentifier
                        });
                    }
                });

                const teams = Array.from(teamsMap.values());

                // 8) Matica – vlastné zápasy skupiny
                const matrix = {};
                teams.forEach(t => { matrix[t.id] = {}; });

                groupMatches.forEach(m => {
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

                // 9) Prenos zápasov – základné skupiny + iné nadstavbové skupiny
                //    🔥 PRESNE AKO V tables.js: párovanie podľa teamNames[match.homeTeamIdentifier]
                const categorySettings = categoriesData[categoryId] || {};
                const carryOverEnabled = categorySettings.carryOverPoints === true;

                console.log('%c=== [EXPORT] KROK 9: PRENOS ZÁPASOV ===', 'color: blue; font-weight: bold;');
                console.log('[EXPORT] categoryName:', categoryName);
                console.log('[EXPORT] groupName:', groupName);
                console.log('[EXPORT] groupType:', groupType);
                console.log('[EXPORT] carryOverEnabled:', carryOverEnabled);
                console.log('[EXPORT] teams (aktuálna skupina):', teams.map(t => ({ id: t.id, name: t.name })));

                const processedPairs = new Set();

                // Vlastné zápasy skupiny – označíme, že sú spracované
                groupMatches.forEach(m => {
                    if (m.status !== 'completed') return;
                    const h = m.homeTeamIdentifier;
                    const a = m.awayTeamIdentifier;
                    if (!h || !a) return;
                    const pairKey = h < a ? `${h}|${a}` : `${a}|${h}`;
                    processedPairs.add(pairKey);
                });

                if (groupType === 'nadstavbová skupina' && carryOverEnabled) {
                    const allBaseGroups = groupList
                        .filter(g => g.type === 'základná skupina')
                        .map(g => g.name);
                    const allAdvancedGroups = groupList
                        .filter(g => g.type === 'nadstavbová skupina')
                        .map(g => g.name);

                    console.log('[EXPORT] allBaseGroups:', allBaseGroups);
                    console.log('[EXPORT] allAdvancedGroups:', allAdvancedGroups);

                    let candidateCount = 0;
                    let transferredCount = 0;
                    let skippedByTeamMatch = 0;

                    // 🔥 ROVNAKÝ PRÍSTUP AKO V tables.js:
                    //    - používame teamNamesFromMatches[identifier] na získanie display názvu
                    //    - hľadáme tím v teams podľa zhody display názvu
                    allMatches.forEach(m => {
                        if (m.isPlacementMatch) return;
                        if (m.status !== 'completed') return;

                        let mCatName = m.categoryName;
                        if (!mCatName && m.categoryId && categoriesData[m.categoryId]) {
                            mCatName = categoriesData[m.categoryId].name;
                        }
                        if (!mCatName) return;
                        if (normalizeName(mCatName) !== normalizeName(categoryName)) return;
                        if (!m.groupName) return;

                        const isBase = allBaseGroups.some(bg => normalizeName(bg) === normalizeName(m.groupName));
                        const isOtherAdvanced = allAdvancedGroups.some(ag =>
                            normalizeName(ag) === normalizeName(m.groupName) &&
                            normalizeName(ag) !== normalizeName(groupName)
                        );
                        if (!isBase && !isOtherAdvanced) return;

                        // 🔥 KĽÚČOVÉ – presne ako v tables.js:
                        const homeTeamName = teamNamesFromMatches[m.homeTeamIdentifier] || m.homeTeamIdentifier;
                        const awayTeamName = teamNamesFromMatches[m.awayTeamIdentifier] || m.awayTeamIdentifier;

                        candidateCount++;

                        console.log(`%c[EXPORT] Kandidát #${candidateCount}`, 'color: green;', {
                            matchId: m.id,
                            fromGroup: m.groupName,
                            homeTeamIdentifier: m.homeTeamIdentifier,
                            awayTeamIdentifier: m.awayTeamIdentifier,
                            homeTeamName,
                            awayTeamName,
                            homeScore: m.homeScore,
                            awayScore: m.awayScore
                        });

                        // Nájdeme tímy v aktuálnej skupine podľa display názvu
                        let homeTeam = null, awayTeam = null;
                        for (const team of teams) {
                            if (team.name === homeTeamName) homeTeam = team;
                            if (team.name === awayTeamName) awayTeam = team;
                        }

                        console.log('[EXPORT] Nájdené tímy:', {
                            homeTeam: homeTeam ? homeTeam.name : null,
                            awayTeam: awayTeam ? awayTeam.name : null,
                            hľadané: [homeTeamName, awayTeamName],
                            dostupné: teams.map(t => t.name)
                        });

                        if (!homeTeam || !awayTeam) {
                            skippedByTeamMatch++;
                            return;
                        }

                        // Použijeme ID z aktuálnej skupiny
                        const h = homeTeam.id;
                        const a = awayTeam.id;

                        const pairKey = h < a ? `${h}|${a}` : `${a}|${h}`;
                        if (processedPairs.has(pairKey)) return;
                        processedPairs.add(pairKey);

                        let hs = m.homeScore || 0;
                        let as = m.awayScore || 0;

                        // Ak je 0:0 a máme match.id, skús z eventov
                        if (hs === 0 && as === 0 && m.id) {
                            const events = window.matchTracker?.getEvents?.(m.id) || [];
                            // getCurrentScoreFromEvents nie je definovaná v logged-in-export.js
                            // použijeme priamo m.homeScore/m.awayScore
                        }

                        if (!matrix[h]) matrix[h] = {};
                        if (!matrix[h][a]) {
                            matrix[h][a] = {
                                homeScore: hs,
                                awayScore: as,
                                status: 'completed',
                                isTransferred: true,
                                fromGroup: m.groupName
                            };
                            transferredCount++;
                            console.log('%c[EXPORT] ✅ PRENESENÝ:', 'color: green; font-weight: bold;', {
                                fromGroup: m.groupName,
                                home: homeTeam.name,
                                away: awayTeam.name,
                                score: `${hs}:${as}`
                            });
                        }
                    });

                    console.log('%c[EXPORT] === SÚHRN PRENOSU ===', 'color: blue; font-weight: bold;');
                    console.log('[EXPORT] Kandidátov:', candidateCount);
                    console.log('[EXPORT] Preskočených (tím sa nenašiel):', skippedByTeamMatch);
                    console.log('%c[EXPORT] PRENESENÝCH ZÁPASOV: ' + transferredCount, 'color: green; font-weight: bold; font-size: 14px;');
                } else {
                    console.log('[EXPORT] ⚠️ Prenos sa NESPUSTIL (groupType/carryOver)');
                }

                // 10) Výpočet štatistík pre poradie
                console.log('%c=== [EXPORT] KROK 10: VÝPOČET ŠTATISTÍK ===', 'color: blue; font-weight: bold;');

                const teamStatsMap = new Map();
                teams.forEach(t => {
                    teamStatsMap.set(t.id, {
                        id: t.id,
                        name: t.name,
                        played: 0,
                        wins: 0,
                        draws: 0,
                        losses: 0,
                        goalsFor: 0,
                        goalsAgainst: 0,
                        points: 0,
                        goalDifference: 0
                    });
                });

                const statsProcessedPairs = new Set();

                // Vlastné zápasy
                let ownMatchesCounted = 0;
                groupMatches.forEach(m => {
                    if (m.status !== 'completed') return;
                    const h = m.homeTeamIdentifier;
                    const a = m.awayTeamIdentifier;
                    if (!h || !a) return;
                    if (!teamStatsMap.has(h) || !teamStatsMap.has(a)) {
                        console.warn('[EXPORT][STATS] ⚠️ Vlastný zápas – tím nie je v teamStatsMap:', { h, a });
                        return;
                    }

                    const pairKey = h < a ? `${h}|${a}` : `${a}|${h}`;
                    if (statsProcessedPairs.has(pairKey)) return;
                    statsProcessedPairs.add(pairKey);

                    const hs = m.homeScore ?? 0;
                    const as = m.awayScore ?? 0;

                    const ht = teamStatsMap.get(h);
                    const at = teamStatsMap.get(a);

                    ht.played++; at.played++;
                    ht.goalsFor += hs; ht.goalsAgainst += as;
                    at.goalsFor += as; at.goalsAgainst += hs;

                    if (hs > as) { ht.wins++; ht.points += pointsForWin; at.losses++; }
                    else if (as > hs) { at.wins++; at.points += pointsForWin; ht.losses++; }
                    else { ht.draws++; at.draws++; ht.points += 1; at.points += 1; }

                    ownMatchesCounted++;
                });
                console.log('[EXPORT][STATS] Vlastné zápasy započítané:', ownMatchesCounted);

                // Prenesené zápasy
                if (groupType === 'nadstavbová skupina' && carryOverEnabled) {
                    let transferredCounted = 0;
                    let transferredSkipped = 0;

                    Object.keys(matrix).forEach(h => {
                        Object.keys(matrix[h] || {}).forEach(a => {
                            const cell = matrix[h][a];
                            if (!cell || !cell.isTransferred) return;

                            const pairKey = h < a ? `${h}|${a}` : `${a}|${h}`;
                            if (statsProcessedPairs.has(pairKey)) {
                                transferredSkipped++;
                                console.log('[EXPORT][STATS] ⏭️ Prenesený pár už započítaný:', pairKey);
                                return;
                            }
                            statsProcessedPairs.add(pairKey);

                            const ht = teamStatsMap.get(h);
                            const at = teamStatsMap.get(a);
                            if (!ht || !at) {
                                console.warn('[EXPORT][STATS] ⚠️ Prenesený zápas – tím nie je v teamStatsMap:', { h, a });
                                return;
                            }

                            const hs = cell.homeScore ?? 0;
                            const as = cell.awayScore ?? 0;

                            ht.played++; at.played++;
                            ht.goalsFor += hs; ht.goalsAgainst += as;
                            at.goalsFor += as; at.goalsAgainst += hs;

                            if (hs > as) { ht.wins++; ht.points += pointsForWin; at.losses++; }
                            else if (as > hs) { at.wins++; at.points += pointsForWin; ht.losses++; }
                            else { ht.draws++; at.draws++; ht.points += 1; at.points += 1; }

                            transferredCounted++;
                            console.log('%c[EXPORT][STATS] ✅ Prenesený zápas započítaný:', 'color: green;', {
                                home: ht.name,
                                away: at.name,
                                score: `${hs}:${as}`
                            });
                        });
                    });

                    console.log('%c[EXPORT][STATS] Prenesené zápasy započítané: ' + transferredCounted, 'color: green; font-weight: bold;');
                    console.log('[EXPORT][STATS] Prenesené zápasy preskočené (už boli):', transferredSkipped);
                } else {
                    console.log('[EXPORT][STATS] ⚠️ Prenesené zápasy sa NEZAPOČÍTALI (groupType/carryOver)');
                }

                // Výpočet rozdielu skóre
                teamStatsMap.forEach(t => {
                    t.goalDifference = t.goalsFor - t.goalsAgainst;
                });

                console.log('%c[EXPORT][STATS] Výsledné štatistiky tímov:', 'color: blue; font-weight: bold;');
                Array.from(teamStatsMap.values()).forEach(t => {
                    console.log(`  ${t.name}: Z=${t.played} V=${t.wins} R=${t.draws} P=${t.losses} Skóre=${t.goalsFor}:${t.goalsAgainst} +/-=${t.goalDifference} Body=${t.points}`);
                });

                // 11) Zoradenie tímov
                //     Pre head-to-head porovnanie použijeme všetky zápasy,
                //     ktoré sa týkajú tímov v tejto skupine (vlastné + prenesené).
                const matchesForComparison = [];

                // Vlastné zápasy
                groupMatches.forEach(m => {
                    matchesForComparison.push({
                        ...m,
                        homeTeamName: teamNamesFromMatches[m.homeTeamIdentifier] || m.homeTeamIdentifier,
                        awayTeamName: teamNamesFromMatches[m.awayTeamIdentifier] || m.awayTeamIdentifier,
                    });
                });

                // Prenesené zápasy (aby head-to-head fungoval aj pre prenesené vzájomné zápasy)
                if (groupType === 'nadstavbová skupina' && carryOverEnabled) {
                    Object.keys(matrix).forEach(h => {
                        Object.keys(matrix[h] || {}).forEach(a => {
                            const cell = matrix[h][a];
                            if (!cell || !cell.isTransferred) return;
                            // overíme, či už nie je vo vlastných zápasoch
                            const alreadyIncluded = matchesForComparison.some(m =>
                                (m.homeTeamIdentifier === h && m.awayTeamIdentifier === a) ||
                                (m.homeTeamIdentifier === a && m.awayTeamIdentifier === h)
                            );
                            if (alreadyIncluded) return;

                            const homeTeamName = teams.find(t => t.id === h)?.name || h;
                            const awayTeamName = teams.find(t => t.id === a)?.name || a;

                            matchesForComparison.push({
                                id: `transferred_${h}_${a}`,
                                homeTeamIdentifier: h,
                                awayTeamIdentifier: a,
                                homeTeamName: homeTeamName,
                                awayTeamName: awayTeamName,
                                homeScore: cell.homeScore ?? 0,
                                awayScore: cell.awayScore ?? 0,
                                status: 'completed',
                                isTransferred: true
                            });
                        });
                    });
                }

                const sortedStats = Array.from(teamStatsMap.values()).sort((a, b) =>
                    compareTeams(a, b, matchesForComparison, sortingConditions)
                );

                if (isCancelled) return;

                setExportedTable({
                    categoryName,
                    groupName,
                    groupType,
                    teams,
                    sortedTeams: sortedStats,
                    matrix,
                    teamNamesFromMatches
                });
                setLoadingTable(false);
            } catch (err) {
                console.error("Chyba pri načítavaní tabuľky:", err);
                if (!isCancelled) {
                    setErrorTable('Nepodarilo sa načítať tabuľku.');
                    setLoadingTable(false);
                }
            }
        };

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

    /* ============================================================
       VYKRESLENIE
       ============================================================ */
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

    /* ============================================================
       KLASICKÝ EXPORT BOX (bez hashu)
       ============================================================ */
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

/* ============================================================
   KRÍŽOVÁ TABUĽKA (maticová)
   – riadky aj stĺpce v rovnakom poradí podľa sortedTeams
   ============================================================ */
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

    // 🔥 KĽÚČOVÉ: použitie sortedTeams pre obe (riadky aj stĺpce)
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
    const SUB_CELL_WIDTH = '66.66px';

    const cellStyle = {
        width: CELL_WIDTH,
        minWidth: CELL_WIDTH,
        maxWidth: CELL_WIDTH,
        height: CELL_HEIGHT,
        minHeight: CELL_HEIGHT,
        maxHeight: CELL_HEIGHT
    };

    const subCellBaseStyle = {
        width: SUB_CELL_WIDTH,
        minWidth: SUB_CELL_WIDTH,
        maxWidth: SUB_CELL_WIDTH,
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

                // THEAD – stĺpce v poradí podľa sortedTeams
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
                        }, 'Miesto v skupine')
                    )
                ),

                // TBODY – riadky v poradí podľa sortedTeams
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

                            if (!isMatchCompleted(matchResult)) {
                                rowCells.push(
                                    React.createElement('td', {
                                        key: `${keyBase}-s1`,
                                        className: baseCell + ' ' + FONT_CLASS,
                                        style: subCellLeftStyle
                                    }, ''),
                                    React.createElement('td', {
                                        key: `${keyBase}-s2`,
                                        className: baseCell + ' ' + FONT_CLASS,
                                        style: subCellBaseStyle
                                    }, ':'),
                                    React.createElement('td', {
                                        key: `${keyBase}-s3`,
                                        className: baseCell + ' ' + FONT_CLASS,
                                        style: subCellRightStyle
                                    }, '')
                                );
                                return;
                            }

                            const hs = matchResult.homeScore ?? 0;
                            const as = matchResult.awayScore ?? 0;

                            if (hs === 0 && as === 0) {
                                rowCells.push(
                                    React.createElement('td', {
                                        key: `${keyBase}-z1`,
                                        className: baseCell + ' ' + FONT_CLASS,
                                        style: subCellLeftStyle
                                    }, ''),
                                    React.createElement('td', {
                                        key: `${keyBase}-z2`,
                                        className: baseCell + ' ' + FONT_CLASS,
                                        style: subCellBaseStyle
                                    }, ''),
                                    React.createElement('td', {
                                        key: `${keyBase}-z3`,
                                        className: baseCell + ' ' + FONT_CLASS,
                                        style: subCellRightStyle
                                    }, '')
                                );
                                return;
                            }

                            const bgColor = matchResult.isTransferred ? TRANSFERRED_BG : '';

                            const leftStyle = { ...subCellLeftStyle };
                            const middleStyle = { ...subCellBaseStyle };
                            const rightStyle = { ...subCellRightStyle };
                            if (bgColor) {
                                leftStyle.backgroundColor = bgColor;
                                middleStyle.backgroundColor = bgColor;
                                rightStyle.backgroundColor = bgColor;
                            }

                            rowCells.push(
                                React.createElement('td', {
                                    key: `${keyBase}-l`,
                                    className: baseCell + ' ' + FONT_CLASS,
                                    style: leftStyle
                                }, hs),
                                React.createElement('td', {
                                    key: `${keyBase}-m`,
                                    className: baseCell + ' ' + FONT_CLASS,
                                    style: middleStyle
                                }, ':'),
                                React.createElement('td', {
                                    key: `${keyBase}-r`,
                                    className: baseCell + ' ' + FONT_CLASS,
                                    style: rightStyle
                                }, as)
                            );
                        });

                        const showTotals = stats && !(stats.goalsFor === 0 && stats.goalsAgainst === 0);
                        rowCells.push(
                            React.createElement('td', {
                                key: 'total-scored',
                                className: baseCell + ' ' + FONT_CLASS + ' font-mono',
                                style: subCellLeftStyle
                            }, stats && showTotals ? stats.goalsFor : ''),
                            React.createElement('td', {
                                key: 'total-colon',
                                className: baseCell + ' ' + FONT_CLASS,
                                style: subCellBaseStyle
                            }, stats && showTotals ? ':' : ''),
                            React.createElement('td', {
                                key: 'total-conceded',
                                className: baseCell + ' ' + FONT_CLASS + ' font-mono',
                                style: subCellRightStyle
                            }, stats && showTotals ? stats.goalsAgainst : '')
                        );

                        rowCells.push(
                            React.createElement('td', {
                                key: 'points',
                                className: baseCell + ' ' + FONT_CLASS,
                                style: cellStyle
                            }, stats && stats.points > 0 ? stats.points : '')
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

/* ============================================================
   SYNCHRONIZÁCIA E-MAILU + RENDER
   ============================================================ */
let isEmailSyncListenerSetup = false;

const handleDataUpdateAndRender = (event) => {
    const userProfileData = event.detail;
    const rootElement = document.getElementById('root');

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
                        console.error("Chyba pri synchronizácii e-mailu:", error);
                    }
                }
            });
            isEmailSyncListenerSetup = true;
        }

        if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
            const root = ReactDOM.createRoot(rootElement);
            root.render(React.createElement(ExportApp, { userProfileData }));
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
