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

/**
 * Parsovanie hashu:
 *   #tabulky/<categoryName>/<groupName>
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

    /* --------- Načítanie pointsForWin zo settings/table (real-time) --------- */
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
                } else {
                    setPointsForWin(3);
                }
            },
            (error) => {
                console.error("Chyba pri načítavaní pointsForWin:", error);
            }
        );
        return () => unsubscribe();
    }, []);

    /* --------- Načítanie kategórií a skupín (len keď NIE je hash) --------- */
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
                        setErrorTable(`Kategória "${exportHash.categoryName}" sa nenašla.`);
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
                        setErrorTable(`Skupina "${exportHash.groupName}" sa v kategórii "${categoryName}" nenašla.`);
                        setLoadingTable(false);
                    }
                    return;
                }

                const groupName = foundGroup.name;
                const groupType = foundGroup.type;

                const matchesSnap = await getDocs(collection(window.db, 'matches'));
                const allMatches = [];
                matchesSnap.forEach((d) => allMatches.push({ id: d.id, ...d.data() }));

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
       VYKRESLENIE – AK JE HASH
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
                    matrix: exportedTable.matrix,
                    categoryName: exportedTable.categoryName,
                    groupName: exportedTable.groupName,
                    groupType: exportedTable.groupType,
                    pointsForWin: pointsForWin
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
   KRÍŽOVÁ TABUĽKA
   ============================================================ */
const CrossTable = ({ teams, matrix, categoryName, groupName, groupType, pointsForWin }) => {
    if (!teams || teams.length === 0) {
        return React.createElement(
            'div',
            { className: 'text-center py-12 text-gray-500 bg-gray-50 rounded-xl' },
            React.createElement('p', { className: 'text-lg' }, 'Pre túto skupinu neexistujú žiadne tímy.')
        );
    }

    const groupTypeLabel = groupType === 'nadstavbová skupina' ? 'NADSTAVBOVÁ' : 'ZÁKLADNÁ';
    const winPoints = (pointsForWin !== undefined && pointsForWin !== null) ? pointsForWin : 3;
    const drawPoints = 1;

    // FIXNÁ ŠÍRKA A VÝŠKA BUNKY = 250px
    const CELL_WIDTH = '250px';
    const CELL_HEIGHT = '250px';

    const cellStyle = {
        width: CELL_WIDTH,
        minWidth: CELL_WIDTH,
        maxWidth: CELL_WIDTH,
        height: CELL_HEIGHT,
        minHeight: CELL_HEIGHT,
        maxHeight: CELL_HEIGHT
    };

    /**
     * Získa výsledok zápasu medzi dvoma tímami z pohľadu riadkového tímu.
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
     * Spočíta štatistiky pre každý tím.
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
                row.points += winPoints;
                col.losses += 1;
            } else if (hs < as) {
                col.wins += 1;
                col.points += winPoints;
                row.losses += 1;
            } else {
                row.draws += 1;
                col.draws += 1;
                row.points += drawPoints;
                col.points += drawPoints;
            }
        });
    });

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

    // Pomocná funkcia: vypočíta šírku pre tretinovú pod-bunku (250px / 3 = 83.33px)
    const SUB_CELL_WIDTH = '83.33px';

    const subCellBaseStyle = {
        width: SUB_CELL_WIDTH,
        minWidth: SUB_CELL_WIDTH,
        maxWidth: SUB_CELL_WIDTH,
        height: CELL_HEIGHT,
        minHeight: CELL_HEIGHT,
        maxHeight: CELL_HEIGHT
    };

    return React.createElement(
        'div',
        { className: 'bg-white rounded-none shadow-none border-0 p-0 m-0' },

        React.createElement(
            'div',
            { className: 'p-0 m-0' },
            React.createElement(
                'table',
                {
                    className: 'border-collapse',
                    style: {
                        tableLayout: 'fixed',
                        margin: 0,
                        padding: 0,
                        borderSpacing: 0
                    }
                },

                // THEAD
                React.createElement(
                    'thead',
                    null,
                    React.createElement(
                        'tr',
                        { className: 'bg-gray-100' },
                        // Prvý stĺpec – roh (kategória + skupina)
                        React.createElement(
                            'th',
                            {
                                className: 'bg-gray-100 border border-gray-300 px-3 py-2 text-center align-middle',
                                style: cellStyle,
                                colSpan: 1,
                                rowSpan: 2
                            },
                            React.createElement(
                                'div',
                                { className: 'flex flex-col items-center justify-center leading-tight' },
                                React.createElement('span', { className: 'text-sm font-bold text-gray-800' }, categoryName),
                                React.createElement('span', { className: 'text-xs font-medium text-gray-500 mt-0.5' }, groupName)
                            )
                        ),
                        // Názvy tímov v stĺpcoch – každý zaberá 3 podstĺpce (rowSpan=2, aby hlavička nebola zdvojená)
                        teams.map((team) =>
                            React.createElement(
                                'th',
                                {
                                    key: team.id,
                                    colSpan: 3,
                                    rowSpan: 2,
                                    className: 'border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 text-center align-middle',
                                    style: cellStyle
                                },
                                team.name
                            )
                        ),
                        // Skóre – hlavička s 3 podstĺpcami (tiež rowSpan=2)
                        React.createElement(
                            'th',
                            {
                                colSpan: 3,
                                rowSpan: 2,
                                className: 'border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 uppercase tracking-wider text-center align-middle bg-blue-50',
                                style: cellStyle
                            },
                            'Skóre'
                        ),
                        // Body (jeden stĺpec)
                        React.createElement(
                            'th',
                            {
                                rowSpan: 2,
                                className: 'border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 uppercase tracking-wider text-center align-middle bg-blue-50',
                                style: cellStyle
                            },
                            'Body'
                        ),
                        // Miesto (jeden stĺpec)
                        React.createElement(
                            'th',
                            {
                                rowSpan: 2,
                                className: 'border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 uppercase tracking-wider text-center align-middle bg-blue-50',
                                style: cellStyle
                            },
                            'Miesto'
                        )
                    )
                ),

                // TBODY
                React.createElement(
                    'tbody',
                    null,
                    teams.map((rowTeam, rowIdx) => {
                        const stats = teamStats[rowTeam.id];
                        const position = positionMap[rowTeam.id];

                        const rowCells = [];

                        // Hlavička riadku – názov tímu
                        rowCells.push(
                            React.createElement(
                                'th',
                                {
                                    key: 'row-name',
                                    className: 'border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-800 text-left align-middle bg-gray-100',
                                    style: cellStyle
                                },
                                rowTeam.name
                            )
                        );

                        // Bunky pre každého súpera – teraz 3 pod-bunky (domáci skóre | ":" alebo vs | hostia skóre)
                        teams.forEach((colTeam) => {
                            const keyBase = `${rowTeam.id}-${colTeam.id}`;

                            // Diagonála
                            if (rowTeam.id === colTeam.id) {
                                rowCells.push(
                                    React.createElement(
                                        'td',
                                        {
                                            key: `${keyBase}-d1`,
                                            className: 'border border-gray-300 text-center align-middle bg-gray-200 text-gray-400 text-xs font-medium',
                                            style: subCellBaseStyle
                                        },
                                        '—'
                                    ),
                                    React.createElement(
                                        'td',
                                        {
                                            key: `${keyBase}-d2`,
                                            className: 'border border-gray-300 text-center align-middle bg-gray-200 text-gray-400 text-xs font-medium',
                                            style: subCellBaseStyle
                                        },
                                        ''
                                    ),
                                    React.createElement(
                                        'td',
                                        {
                                            key: `${keyBase}-d3`,
                                            className: 'border border-gray-300 text-center align-middle bg-gray-200 text-gray-400 text-xs font-medium',
                                            style: subCellBaseStyle
                                        },
                                        ''
                                    )
                                );
                                return;
                            }

                            const matchResult = getMatchResult(rowTeam.id, colTeam.id);

                            // Žiadny záznam
                            if (!matchResult) {
                                rowCells.push(
                                    React.createElement('td', {
                                        key: `${keyBase}-e1`,
                                        className: 'border border-gray-300 text-center align-middle text-gray-300 text-xs',
                                        style: subCellBaseStyle
                                    }, ''),
                                    React.createElement('td', {
                                        key: `${keyBase}-e2`,
                                        className: 'border border-gray-300 text-center align-middle text-gray-300 text-xs',
                                        style: subCellBaseStyle
                                    }, ''),
                                    React.createElement('td', {
                                        key: `${keyBase}-e3`,
                                        className: 'border border-gray-300 text-center align-middle text-gray-300 text-xs',
                                        style: subCellBaseStyle
                                    }, '')
                                );
                                return;
                            }

                            // Neodohrané – v prostrednej bunke ":"
                            if (!isMatchCompleted(matchResult)) {
                                rowCells.push(
                                    React.createElement('td', {
                                        key: `${keyBase}-s1`,
                                        className: 'border border-gray-300 text-center align-middle text-gray-400 text-xs',
                                        style: subCellBaseStyle
                                    }, ''),
                                    React.createElement('td', {
                                        key: `${keyBase}-s2`,
                                        className: 'border border-gray-300 text-center align-middle text-gray-500 text-lg font-bold',
                                        style: subCellBaseStyle
                                    }, ':'),
                                    React.createElement('td', {
                                        key: `${keyBase}-s3`,
                                        className: 'border border-gray-300 text-center align-middle text-gray-400 text-xs',
                                        style: subCellBaseStyle
                                    }, '')
                                );
                                return;
                            }

                            const hs = matchResult.homeScore ?? 0;
                            const as = matchResult.awayScore ?? 0;
                            const rowWin = hs > as;
                            const rowLoss = hs < as;

                            const scoreColor = rowWin
                                ? 'bg-green-50 text-green-700'
                                : rowLoss
                                    ? 'bg-red-50 text-red-700'
                                    : 'bg-yellow-50 text-yellow-700';

                            rowCells.push(
                                React.createElement('td', {
                                    key: `${keyBase}-l`,
                                    className: `border border-gray-300 text-center align-middle text-2xl font-bold ${scoreColor}`,
                                    style: subCellBaseStyle,
                                    title: `${rowTeam.name} (domáci) vs ${colTeam.name} (hostia)`
                                }, hs),
                                React.createElement('td', {
                                    key: `${keyBase}-m`,
                                    className: `border border-gray-300 text-center align-middle text-2xl font-bold ${scoreColor}`,
                                    style: subCellBaseStyle
                                }, ':'),
                                React.createElement('td', {
                                    key: `${keyBase}-r`,
                                    className: `border border-gray-300 text-center align-middle text-2xl font-bold ${scoreColor}`,
                                    style: subCellBaseStyle
                                }, as)
                            );
                        });

                        // Skóre (3 podstĺpce: strelené | ":" | inkasované)
                        rowCells.push(
                            React.createElement('td', {
                                key: 'total-scored',
                                className: 'border border-gray-300 text-center align-middle text-2xl font-mono font-bold bg-blue-50 text-gray-800',
                                style: subCellBaseStyle
                            }, stats.scored),
                            React.createElement('td', {
                                key: 'total-colon',
                                className: 'border border-gray-300 text-center align-middle text-2xl font-bold bg-blue-50 text-gray-800',
                                style: subCellBaseStyle
                            }, ':'),
                            React.createElement('td', {
                                key: 'total-conceded',
                                className: 'border border-gray-300 text-center align-middle text-2xl font-mono font-bold bg-blue-50 text-gray-800',
                                style: subCellBaseStyle
                            }, stats.conceded)
                        );

                        // Body
                        rowCells.push(
                            React.createElement('td', {
                                key: 'points',
                                className: 'border border-gray-300 text-center align-middle text-2xl font-bold bg-blue-50 text-blue-700',
                                style: cellStyle
                            }, stats.points)
                        );

                        // Miesto
                        rowCells.push(
                            React.createElement('td', {
                                key: 'position',
                                className: 'border border-gray-300 text-center align-middle text-2xl font-bold bg-blue-50 text-gray-800',
                                style: cellStyle
                            }, position)
                        );

                        return React.createElement(
                            'tr',
                            { key: rowTeam.id, className: rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50' },
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
