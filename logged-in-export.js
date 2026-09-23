// logged-in-export.js
import { doc, getDoc, onSnapshot, updateDoc, addDoc, collection, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
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

                if (isCancelled) return;

                setExportedTable({
                    categoryName,
                    groupName,
                    groupType,
                    teams: [],
                    sortedTeams: [],
                    matrix: {},
                    teamNamesFromMatches: {}
                });
                setLoadingTable(false);
            } catch (err) {
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
