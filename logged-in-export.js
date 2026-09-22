// logged-in-export.js
import { doc, getDoc, onSnapshot, updateDoc, addDoc, collection, Timestamp, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const { useState, useEffect, useRef } = React;

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
        if (spacerDiv) spacerDiv.style.display = 'none';
        // POZOR: root už NEskrývame – chceme, aby sa vykreslil export tabuľky
    } else {
        if (headerPlaceholder) headerPlaceholder.style.display = '';
        if (menuPlaceholder) menuPlaceholder.style.display = '';
        document.body.style.paddingTop = '64px';
        if (spacerDiv) spacerDiv.style.display = '';
        if (rootElement) rootElement.style.display = '';
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

/**
 * Parsovanie hashu:
 *   #tabulky/<categoryName>/<groupName>
 * vracia { type: 'tabulky', categoryName, groupName } alebo null
 */
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

/* ============================================================
   HLAVNÝ KOMPONENT
   ============================================================ */
const ExportApp = ({ userProfileData }) => {
    const exportHash = parseExportHash();

    // Ak nie je platný hash, zobrazíme klasický export box
    const [selectedOption, setSelectedOption] = useState('');
    const [categories, setCategories] = useState([]);
    const [groups, setGroups] = useState({});
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [selectedGroupType, setSelectedGroupType] = useState('');
    const [selectedGroupName, setSelectedGroupName] = useState('');
    const [isLoadingCategories, setIsLoadingCategories] = useState(false);

    // Stav pre exportovanú tabuľku
    const [exportedTable, setExportedTable] = useState(null);
    const [loadingTable, setLoadingTable] = useState(false);
    const [errorTable, setErrorTable] = useState(null);

    /* --------- Načítanie kategórií a skupín (len keď NIE je hash) --------- */
    useEffect(() => {
        if (exportHash) return; // pri hash-i nepotrebujeme select boxy

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

    /* --------- Načítanie tabuľky pre hash --------- */
    useEffect(() => {
        if (!exportHash || exportHash.type !== 'tabulky') {
            setExportedTable(null);
            return;
        }

        let isCancelled = false;
        setLoadingTable(true);
        setErrorTable(null);

        const loadData = async () => {
            try {
                // 1) Načítame kategórie a skupiny
                const [categoriesSnap, groupsSnap] = await Promise.all([
                    getDoc(doc(window.db, 'settings', 'categories')),
                    getDoc(doc(window.db, 'settings', 'groups'))
                ]);

                const categoriesData = categoriesSnap.exists() ? categoriesSnap.data() : {};
                const groupsData = groupsSnap.exists() ? groupsSnap.data() : {};

                // 2) Nájdeme categoryId podľa názvu (bez diakritiky)
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

                // 3) Nájdeme skupinu (podľa názvu, bez diakritiky) v rámci kategórie
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
                matchesSnap.forEach((d) => allMatches.push({ id: d.id, ...d.data() }));

                // 5) Filtrujeme zápasy pre danú kategóriu + skupinu
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

                // 6) Pripravíme mená tímov
                const teamNamesMap = {};
                groupMatches.forEach(m => {
                    if (m.homeTeamIdentifier && !teamNamesMap[m.homeTeamIdentifier]) {
                        teamNamesMap[m.homeTeamIdentifier] =
                            (window.teamNames && window.teamNames[m.homeTeamIdentifier]) ||
                            getDisplayTeamName(m.homeTeamIdentifier) ||
                            m.homeTeamName ||
                            m.homeTeamIdentifier;
                    }
                    if (m.awayTeamIdentifier && !teamNamesMap[m.awayTeamIdentifier]) {
                        teamNamesMap[m.awayTeamIdentifier] =
                            (window.teamNames && window.teamNames[m.awayTeamIdentifier]) ||
                            getDisplayTeamName(m.awayTeamIdentifier) ||
                            m.awayTeamName ||
                            m.awayTeamIdentifier;
                    }
                });

                // 7) Zostavíme zoznam tímov
                const teamsMap = new Map();
                groupMatches.forEach(m => {
                    if (m.homeTeamIdentifier && !teamsMap.has(m.homeTeamIdentifier)) {
                        teamsMap.set(m.homeTeamIdentifier, {
                            id: m.homeTeamIdentifier,
                            name: teamNamesMap[m.homeTeamIdentifier] || m.homeTeamIdentifier
                        });
                    }
                    if (m.awayTeamIdentifier && !teamsMap.has(m.awayTeamIdentifier)) {
                        teamsMap.set(m.awayTeamIdentifier, {
                            id: m.awayTeamIdentifier,
                            name: teamNamesMap[m.awayTeamIdentifier] || m.awayTeamIdentifier
                        });
                    }
                });

                const teams = Array.from(teamsMap.values())
                    .sort((a, b) => a.name.localeCompare(b.name, 'sk'));

                // 8) Vytvoríme maticu vzájomných zápasov
                // matrix[homeId][awayId] = { homeScore, awayScore, status }
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
                            status: m.status || 'scheduled'
                        };
                    }
                });

                if (isCancelled) return;

                setExportedTable({
                    categoryName,
                    groupName,
                    groupType,
                    teams,
                    matrix,
                    totalMatches: groupMatches.length
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
    }, [exportHash && exportHash.type, exportHash && exportHash.categoryName, exportHash && exportHash.groupName]);

    /* --------- Dostupné typy skupín (pre select box) --------- */
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
       VYKRESLENIE – AK JE HASH, ZOBRAZÍME EXPORT TABUĽKU
       ============================================================ */
    if (exportHash && exportHash.type === 'tabulky') {
        return React.createElement(
            'div',
            { className: 'w-full max-w-7xl mx-auto px-4 py-6' },

            // Nadpis
            React.createElement(
                'div',
                { className: 'mb-6 text-center' },
                React.createElement('h1', { className: 'text-2xl font-bold text-gray-800' },
                    exportedTable
                        ? `${exportedTable.categoryName} - ${exportedTable.groupName}`
                        : 'Načítavam tabuľku...'
                )
            ),

            // Loading
            loadingTable && React.createElement(
                'div',
                { className: 'flex justify-center items-center py-16' },
                React.createElement('div', { className: 'animate-spin rounded-full h-12 w-12 border-b-4 border-blue-500' })
            ),

            // Error
            errorTable && React.createElement(
                'div',
                { className: 'bg-red-50 border border-red-200 rounded-lg p-6 text-center' },
                React.createElement('p', { className: 'text-red-700 font-medium' }, errorTable)
            ),

            // Tabuľka
            !loadingTable && !errorTable && exportedTable && React.createElement(
                CrossTable,
                {
                    teams: exportedTable.teams,
                    matrix: exportedTable.matrix,
                    categoryName: exportedTable.categoryName,
                    groupName: exportedTable.groupName,
                    groupType: exportedTable.groupType
                }
            )
        );
    }

    if (exportHash && exportHash.type === 'zapasy') {
        return React.createElement(
            'div',
            { className: 'w-full max-w-7xl mx-auto px-4 py-6' },
            React.createElement(
                'div',
                { className: 'mb-6 text-center' },
                React.createElement('h1', { className: 'text-2xl font-bold text-gray-800' }, 'Zápasy v športovej hale')
            ),
            React.createElement(
                'div',
                { className: 'text-center py-12 text-gray-500 bg-gray-50 rounded-xl' },
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

                // Typ exportu
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

                // Kategória / typ / skupina (len pri tabuľkách)
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

                // Tlačidlo Generovať
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
   KRÍŽOVÁ TABUĽKA
   ============================================================ */
const CrossTable = ({ teams, matrix, categoryName, groupName, groupType }) => {
    if (!teams || teams.length === 0) {
        return React.createElement(
            'div',
            { className: 'text-center py-12 text-gray-500 bg-gray-50 rounded-xl' },
            React.createElement('p', { className: 'text-lg' }, 'Pre túto skupinu neexistujú žiadne tímy.')
        );
    }

    const groupTypeLabel = groupType === 'nadstavbová skupina' ? 'NADSTAVBOVÁ' : 'ZÁKLADNÁ';

    /**
     * Získa výsledok zápasu medzi dvoma tímami z pohľadu riadkového tímu.
     * Vráti { homeScore, awayScore, status, isSwapped } alebo null.
     */
    const getMatchResult = (rowTeamId, colTeamId) => {
        const direct = matrix?.[rowTeamId]?.[colTeamId];
        if (direct) {
            return {
                homeScore: direct.homeScore,
                awayScore: direct.awayScore,
                status: direct.status,
                isSwapped: false
            };
        }

        const reversed = matrix?.[colTeamId]?.[rowTeamId];
        if (reversed) {
            return {
                homeScore: reversed.awayScore,
                awayScore: reversed.homeScore,
                status: reversed.status,
                isSwapped: true
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

    /**
     * Spočíta štatistiky pre každý tím (len z jeho pohľadu, teda každý zápas raz).
     * Vracia mapu: teamId -> { scored, conceded, wins, draws, losses, points, played }
     */
    const teamStats = {};
    teams.forEach(t => {
        teamStats[t.id] = {
            scored: 0,
            conceded: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            points: 0,
            played: 0
        };
    });

    // Prejdeme všetky zápasy v matici, aby sme započítali iba raz každý zápas
    const processedPairs = new Set();

    teams.forEach(rowTeam => {
        teams.forEach(colTeam => {
            if (rowTeam.id === colTeam.id) return;

            const pairKey = rowTeam.id < colTeam.id
                ? `${rowTeam.id}|${colTeam.id}`
                : `${colTeam.id}|${rowTeam.id}`;

            if (processedPairs.has(pairKey)) return;
            processedPairs.add(pairKey);

            const result = getMatchResult(rowTeam.id, colTeam.id);
            if (!isMatchCompleted(result)) return;

            const hs = result.homeScore ?? 0;
            const as = result.awayScore ?? 0;

            // rowTeam = domáci v tomto zobrazení, colTeam = hostia
            const row = teamStats[rowTeam.id];
            const col = teamStats[colTeam.id];

            row.played += 1;
            col.played += 1;

            row.scored += hs;
            row.conceded += as;
            col.scored += as;
            col.conceded += hs;

            if (hs > as) {
                row.wins += 1;
                row.points += 3;
                col.losses += 1;
            } else if (hs < as) {
                col.wins += 1;
                col.points += 3;
                row.losses += 1;
            } else {
                row.draws += 1;
                col.draws += 1;
                row.points += 1;
                col.points += 1;
            }
        });
    });

    // Vypočítame poradie
    const rankedTeams = [...teams].sort((a, b) => {
        const sa = teamStats[a.id];
        const sb = teamStats[b.id];
        if (sa.points !== sb.points) return sb.points - sa.points;
        const diffA = sa.scored - sa.conceded;
        const diffB = sb.scored - sb.conceded;
        if (diffA !== diffB) return diffB - diffA;
        if (sa.scored !== sb.scored) return sb.scored - sa.scored;
        return a.name.localeCompare(b.name, 'sk');
    });

    const positionMap = {};
    rankedTeams.forEach((t, idx) => { positionMap[t.id] = idx + 1; });

    return React.createElement(
        'div',
        { className: 'bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden' },

        // Hlavička
        React.createElement(
            'div',
            { className: 'bg-gray-50 px-6 py-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3' },
            React.createElement(
                'div',
                { className: 'flex items-center gap-3' },
                React.createElement('h2', { className: 'text-lg font-bold text-gray-800' }, `${categoryName} - ${groupName}`),
                React.createElement(
                    'span',
                    { className: 'text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700' },
                    groupTypeLabel
                )
            )
        ),

        // Tabuľka
        React.createElement(
            'div',
            { className: 'overflow-x-auto' },
            React.createElement(
                'table',
                { className: 'min-w-full border-collapse' },

                // THEAD
                React.createElement(
                    'thead',
                    null,
                    // Prvý riadok hlavičky – zlúčené bunky "Súperi" + nové stĺpce
                    React.createElement(
                        'tr',
                        { className: 'bg-gray-200' },
                        React.createElement(
                            'th',
                            {
                                className: 'sticky left-0 z-10 bg-gray-200 border border-gray-300 px-3 py-2 text-xs font-bold text-gray-600 uppercase tracking-wider text-center',
                                style: { minWidth: '160px' }
                            },
                            'Tím / Súper'
                        ),
                        React.createElement(
                            'th',
                            {
                                colSpan: teams.length,
                                className: 'border border-gray-300 px-3 py-2 text-xs font-bold text-gray-600 uppercase tracking-wider text-center'
                            },
                            'Súperi'
                        ),
                        React.createElement(
                            'th',
                            {
                                className: 'border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 uppercase tracking-wider text-center bg-blue-50',
                                style: { minWidth: '80px' }
                            },
                            'Skóre'
                        ),
                        React.createElement(
                            'th',
                            {
                                className: 'border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 uppercase tracking-wider text-center bg-blue-50',
                                style: { minWidth: '60px' }
                            },
                            'Body'
                        ),
                        React.createElement(
                            'th',
                            {
                                className: 'border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 uppercase tracking-wider text-center bg-blue-50',
                                style: { minWidth: '70px' }
                            },
                            'Miesto'
                        )
                    ),
                    // Druhý riadok hlavičky – názvy tímov v stĺpcoch
                    React.createElement(
                        'tr',
                        { className: 'bg-gray-100' },
                        // Prázdny roh (pokračovanie)
                        React.createElement(
                            'th',
                            {
                                className: 'sticky left-0 z-10 bg-gray-100 border border-gray-300 px-3 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider text-center'
                            },
                            ''
                        ),
                        // Názvy tímov v stĺpcoch
                        teams.map((team) =>
                            React.createElement(
                                'th',
                                {
                                    key: team.id,
                                    className: 'border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 text-center',
                                    style: { minWidth: '90px' }
                                },
                                team.name
                            )
                        ),
                        // Prázdne bunky pre Skóre / Body / Miesto (aby hlavička sedela)
                        React.createElement('th', { className: 'border border-gray-300 bg-blue-50' }, ''),
                        React.createElement('th', { className: 'border border-gray-300 bg-blue-50' }, ''),
                        React.createElement('th', { className: 'border border-gray-300 bg-blue-50' }, '')
                    )
                ),

                // TBODY
                React.createElement(
                    'tbody',
                    null,
                    teams.map((rowTeam, rowIdx) => {
                        const stats = teamStats[rowTeam.id];
                        const position = positionMap[rowTeam.id];

                        return React.createElement(
                            'tr',
                            { key: rowTeam.id, className: rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50' },
                            // Hlavička riadku
                            React.createElement(
                                'th',
                                {
                                    className: 'sticky left-0 z-10 border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-800 text-left bg-gray-100',
                                    style: { minWidth: '160px' }
                                },
                                rowTeam.name
                            ),
                            // Bunky so súpermi
                            teams.map((colTeam) => {
                                if (rowTeam.id === colTeam.id) {
                                    return React.createElement(
                                        'td',
                                        {
                                            key: colTeam.id,
                                            className: 'border border-gray-300 px-3 py-2 text-center bg-gray-200 text-gray-400 text-xs font-medium'
                                        },
                                        '—'
                                    );
                                }

                                const matchResult = getMatchResult(rowTeam.id, colTeam.id);

                                if (!matchResult) {
                                    return React.createElement(
                                        'td',
                                        {
                                            key: colTeam.id,
                                            className: 'border border-gray-300 px-3 py-2 text-center text-gray-300 text-xs'
                                        },
                                        ''
                                    );
                                }

                                if (!isMatchCompleted(matchResult)) {
                                    return React.createElement(
                                        'td',
                                        {
                                            key: colTeam.id,
                                            className: 'border border-gray-300 px-3 py-2 text-center text-gray-400 text-xs'
                                        },
                                        'vs'
                                    );
                                }

                                const hs = matchResult.homeScore ?? 0;
                                const as = matchResult.awayScore ?? 0;
                                const rowWin = hs > as;
                                const rowLoss = hs < as;

                                return React.createElement(
                                    'td',
                                    {
                                        key: colTeam.id,
                                        className: `border border-gray-300 px-3 py-2 text-center text-sm font-bold ${
                                            rowWin ? 'bg-green-50 text-green-700'
                                                : rowLoss ? 'bg-red-50 text-red-700'
                                                : 'bg-yellow-50 text-yellow-700'
                                        }`,
                                        title: `${rowTeam.name} (domáci) vs ${colTeam.name} (hostia)`
                                    },
                                    `${hs}:${as}`
                                );
                            }),
                            // Skóre
                            React.createElement(
                                'td',
                                {
                                    className: 'border border-gray-300 px-3 py-2 text-center text-sm font-mono bg-blue-50 text-gray-800'
                                },
                                `${stats.scored}:${stats.conceded}`
                            ),
                            // Body
                            React.createElement(
                                'td',
                                {
                                    className: 'border border-gray-300 px-3 py-2 text-center text-sm font-bold bg-blue-50 text-blue-700'
                                },
                                stats.points
                            ),
                            // Miesto
                            React.createElement(
                                'td',
                                {
                                    className: 'border border-gray-300 px-3 py-2 text-center text-sm font-bold bg-blue-50 text-gray-800'
                                },
                                position
                            )
                        );
                    })
                )
            )
        ),

        // Legenda
        React.createElement(
            'div',
            { className: 'px-6 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500 flex flex-wrap items-center gap-4' },
            React.createElement('span', null, 'Legenda:'),
            React.createElement('span', { className: 'inline-flex items-center gap-1' },
                React.createElement('span', { className: 'inline-block w-3 h-3 rounded-sm bg-green-100 border border-green-300' }),
                'výhra riadkového tímu'
            ),
            React.createElement('span', { className: 'inline-flex items-center gap-1' },
                React.createElement('span', { className: 'inline-block w-3 h-3 rounded-sm bg-yellow-100 border border-yellow-300' }),
                'remíza'
            ),
            React.createElement('span', { className: 'inline-flex items-center gap-1' },
                React.createElement('span', { className: 'inline-block w-3 h-3 rounded-sm bg-red-100 border border-red-300' }),
                'prehra riadkového tímu'
            ),
            React.createElement('span', { className: 'inline-flex items-center gap-1' },
                React.createElement('span', { className: 'inline-block w-3 h-3 rounded-sm bg-gray-200 border border-gray-300' }),
                'neodohrané / neexistuje'
            ),
            React.createElement('span', { className: 'ml-auto text-gray-400' },
                'Body: 3 za výhru, 1 za remízu'
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
