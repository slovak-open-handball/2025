// logged-in-matches.js
import { doc, getDoc, getDocs, setDoc, onSnapshot, updateDoc, addDoc, deleteDoc, collection, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const { useState, useEffect, useRef } = React;

const faCSS = document.createElement('link');
faCSS.rel = 'stylesheet';
faCSS.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css';
document.head.appendChild(faCSS);

const typeLabels = {
    sportova_hala: "Športová hala",
};

const typeIcons = {
    sportova_hala: { icon: 'fa-futbol', color: '#dc2626' },
};

const getLocalDateStr = (date) => {
    if (!date) return null;
    if (typeof date === 'string') return date;
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getLocalDateFromStr = (dateStr) => {
    if (!dateStr) return null;
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
};

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
        case 'success': typeClasses = 'bg-green-500 text-white'; break;
        case 'error': typeClasses = 'bg-red-500 text-white'; break;
        case 'info': typeClasses = 'bg-blue-500 text-white'; break;
        default: typeClasses = 'bg-gray-700 text-white';
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

// ===== GENEROVANIE ZÁPASOV – zjednodušené, bez transferFromBasicGroup =====
const generateMatchesForGroup = (teams, withRepetitions, categoryName) => {
    const matches = [];
    
    const teamIdentifiers = teams.map(t => {
        const category = categoryName || t.category || 'Neznáma kategória';
        let groupName = t.groupName || 'Neznáma skupina';
        if (groupName.startsWith('skupina ')) {
            groupName = groupName.substring(8);
        }
        const order = t.order || '?';
        const teamIdentifier = `${category} ${groupName}${order}`;
        
        return {
            identifier: teamIdentifier,
            category: category,
            groupName: groupName,
            order: order,
            teamName: t.teamName
        };
    });
    
    if (withRepetitions) {
        for (let i = 0; i < teamIdentifiers.length; i++) {
            for (let j = 0; j < teamIdentifiers.length; j++) {
                if (i !== j) {
                    matches.push({
                        homeTeamIdentifier: teamIdentifiers[i].identifier,
                        awayTeamIdentifier: teamIdentifiers[j].identifier,
                    });
                }
            }
        }
    } else {
        for (let i = 0; i < teamIdentifiers.length; i++) {
            for (let j = i + 1; j < teamIdentifiers.length; j++) {
                matches.push({
                    homeTeamIdentifier: teamIdentifiers[i].identifier,
                    awayTeamIdentifier: teamIdentifiers[j].identifier,
                });
            }
        }
    }
    
    return matches;
};

// ===== MOVE MATCHES MODAL =====
const MoveMatchesModal = ({ isOpen, onClose, onConfirm, sourceHallId, sourceDate, isWholeHall, sportHalls, availableDays }) => {
    const [targetHallId, setTargetHallId] = useState('');
    const [targetDate, setTargetDate] = useState('');
    const [moveMatches, setMoveMatches] = useState(true);
    const [moveSchedules, setMoveSchedules] = useState(true);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setTargetHallId('');
            setTargetDate('');
            setMoveMatches(true);
            setMoveSchedules(true);
            setLoading(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const sortedHalls = [...sportHalls].sort((a, b) => a.name.localeCompare(b.name));
    const availableHalls = isWholeHall 
        ? sortedHalls.filter(h => h.id !== sourceHallId)
        : sortedHalls;

    const isValid = targetHallId && (!isWholeHall ? targetDate : true);

    const handleConfirm = async () => {
        setLoading(true);
        await onConfirm({
            sourceHallId,
            sourceDate,
            targetHallId,
            targetDate: isWholeHall ? null : targetDate,
            isWholeHall,
            moveMatches,
            moveSchedules
        });
        setLoading(false);
        onClose();
    };

    return React.createElement(
        'div',
        {
            className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[105]',
            onClick: (e) => { if (e.target === e.currentTarget) onClose(); }
        },
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4' },
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mb-4' },
                React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, 
                    isWholeHall ? 'Presunúť všetky zápasy z haly' : 'Presunúť zápasy z dňa'
                ),
                React.createElement(
                    'button',
                    { onClick: onClose, className: 'text-gray-500 hover:text-gray-700' },
                    React.createElement('i', { className: 'fa-solid fa-times text-xl' })
                )
            ),
            React.createElement(
                'div',
                { className: 'mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200' },
                React.createElement(
                    'div',
                    { className: 'flex items-center gap-2 text-blue-700' },
                    React.createElement('i', { className: 'fa-solid fa-arrow-right-from-bracket' }),
                    React.createElement('span', { className: 'font-medium' }, 'Zdroj:'),
                    React.createElement('span', null, 
                        isWholeHall 
                            ? sportHalls.find(h => h.id === sourceHallId)?.name || 'Neznáma hala'
                            : `${sportHalls.find(h => h.id === sourceHallId)?.name || 'Neznáma hala'} - ${sourceDate}`
                    )
                )
            ),
            React.createElement(
                'div',
                { className: 'mb-4' },
                React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Cieľová hala:'),
                React.createElement(
                    'select',
                    {
                        value: targetHallId,
                        onChange: (e) => setTargetHallId(e.target.value),
                        className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black'
                    },
                    React.createElement('option', { value: '' }, '-- Vyberte halu --'),
                    availableHalls.map(hall => 
                        React.createElement('option', { key: hall.id, value: hall.id }, hall.name)
                    )
                )
            ),
            !isWholeHall && React.createElement(
                'div',
                { className: 'mb-4' },
                React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Cieľový deň:'),
                React.createElement(
                    'select',
                    {
                        value: targetDate,
                        onChange: (e) => setTargetDate(e.target.value),
                        className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black'
                    },
                    React.createElement('option', { value: '' }, '-- Vyberte deň --'),
                    availableDays.map(day => 
                        React.createElement('option', { key: day.value, value: day.value }, day.label)
                    )
                )
            ),
            React.createElement(
                'div',
                { className: 'mb-4 space-y-2 p-3 bg-gray-50 rounded-lg border border-gray-200' },
                React.createElement(
                    'label',
                    { className: 'flex items-center gap-2 cursor-pointer' },
                    React.createElement('input', {
                        type: 'checkbox',
                        checked: moveMatches,
                        onChange: (e) => setMoveMatches(e.target.checked),
                        className: 'w-4 h-4 text-blue-600 rounded'
                    }),
                    React.createElement('span', { className: 'text-gray-700' }, 'Presunúť zápasy')
                ),
                React.createElement(
                    'label',
                    { className: 'flex items-center gap-2 cursor-pointer' },
                    React.createElement('input', {
                        type: 'checkbox',
                        checked: moveSchedules,
                        onChange: (e) => setMoveSchedules(e.target.checked),
                        className: 'w-4 h-4 text-blue-600 rounded'
                    }),
                    React.createElement('span', { className: 'text-gray-700' }, 'Presunúť nastavenia (čas začiatku)')
                )
            ),
            React.createElement(
                'div',
                { className: 'mb-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg' },
                React.createElement(
                    'p',
                    { className: 'text-sm text-yellow-700 flex items-center gap-2' },
                    React.createElement('i', { className: 'fa-solid fa-exclamation-triangle' }),
                    'Presun zápasov je nenávratný. Zápasy budú presunuté na nové miesto (pôvodné zostanú prázdne).'
                )
            ),
            React.createElement(
                'div',
                { className: 'flex justify-end gap-3' },
                React.createElement(
                    'button',
                    { onClick: onClose, className: 'px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors' },
                    'Zrušiť'
                ),
                React.createElement(
                    'button',
                    {
                        onClick: handleConfirm,
                        disabled: !isValid || loading,
                        className: `px-4 py-2 text-white rounded-lg transition-colors ${
                            isValid && !loading
                                ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer' 
                                : 'bg-gray-400 cursor-not-allowed'
                        }`
                    },
                    loading ? React.createElement('i', { className: 'fa-solid fa-spinner fa-spin mr-2' }) : null,
                    'Presunúť'
                )
            )
        )
    );
};

// ===== SWAP MATCHES MODAL =====
const SwapMatchesModal = ({ isOpen, onClose, onConfirm, sourceHallId, sourceDate, isWholeHall, sportHalls, availableDays }) => {
    const [targetHallId, setTargetHallId] = useState('');
    const [targetDate, setTargetDate] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setTargetHallId('');
            setTargetDate('');
            setLoading(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const sortedHalls = [...sportHalls].sort((a, b) => a.name.localeCompare(b.name));
    const availableHalls = isWholeHall 
        ? sortedHalls.filter(h => h.id !== sourceHallId)
        : sortedHalls;

    const formatDateForDisplay = (dateStr) => {
        if (!dateStr) return '';
        const [year, month, day] = dateStr.split('-').map(Number);
        return `${day}. ${month}. ${year}`;
    };

    const formattedSourceDate = sourceDate ? formatDateForDisplay(sourceDate) : '';

    const isValid = targetHallId && (!isWholeHall ? targetDate : true);

    const handleConfirm = async () => {
        setLoading(true);
        await onConfirm({
            sourceHallId,
            sourceDate,
            targetHallId,
            targetDate: isWholeHall ? null : targetDate,
            isWholeHall,
            swapMatches: true,
            swapSchedules: true
        });
        setLoading(false);
        onClose();
    };

    return React.createElement(
        'div',
        {
            className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[105]',
            onClick: (e) => { if (e.target === e.currentTarget) onClose(); }
        },
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4' },
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mb-4' },
                React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, 
                    isWholeHall ? 'Vymeniť zápasy medzi halami' : 'Vymeniť zápasy medzi dňami'
                ),
                React.createElement(
                    'button',
                    { onClick: onClose, className: 'text-gray-500 hover:text-gray-700' },
                    React.createElement('i', { className: 'fa-solid fa-times text-xl' })
                )
            ),
            React.createElement(
                'div',
                { className: 'mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200' },
                React.createElement(
                    'div',
                    { className: 'flex items-center gap-2 text-blue-700' },
                    React.createElement('i', { className: 'fa-solid fa-arrow-right-arrow-left' }),
                    React.createElement('span', { className: 'font-medium' }, 'Zdroj:'),
                    React.createElement('span', null, 
                        isWholeHall 
                            ? sportHalls.find(h => h.id === sourceHallId)?.name || 'Neznáma hala'
                            : `${sportHalls.find(h => h.id === sourceHallId)?.name || 'Neznáma hala'} - ${formattedSourceDate}`
                    )
                )
            ),
            React.createElement(
                'div',
                { className: 'mb-4' },
                React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Cieľová hala:'),
                React.createElement(
                    'select',
                    {
                        value: targetHallId,
                        onChange: (e) => setTargetHallId(e.target.value),
                        className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black'
                    },
                    React.createElement('option', { value: '' }, '-- Vyberte halu --'),
                    availableHalls.map(hall => 
                        React.createElement('option', { key: hall.id, value: hall.id }, hall.name)
                    )
                )
            ),
            !isWholeHall && React.createElement(
                'div',
                { className: 'mb-4' },
                React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Cieľový deň:'),
                React.createElement(
                    'select',
                    {
                        value: targetDate,
                        onChange: (e) => setTargetDate(e.target.value),
                        className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black'
                    },
                    React.createElement('option', { value: '' }, '-- Vyberte deň --'),
                    availableDays.map(day => {
                        const [year, month, dayNum] = day.value.split('-').map(Number);
                        const formattedDay = `${dayNum}. ${month}. ${year}`;
                        return React.createElement('option', { key: day.value, value: day.value }, formattedDay);
                    })
                )
            ),
            React.createElement(
                'div',
                { className: 'flex justify-end gap-3' },
                React.createElement(
                    'button',
                    { onClick: onClose, className: 'px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors' },
                    'Zrušiť'
                ),
                React.createElement(
                    'button',
                    {
                        onClick: handleConfirm,
                        disabled: !isValid || loading,
                        className: `px-4 py-2 text-white rounded-lg transition-colors border-2 ${
                            isValid && !loading
                                ? 'bg-purple-600 hover:bg-purple-700 cursor-pointer' 
                                : 'bg-white text-purple-600 border-purple-600 cursor-not-allowed'
                        }`
                    },
                    loading ? React.createElement('i', { className: 'fa-solid fa-spinner fa-spin mr-2' }) : null,
                    'Vymeniť'
                )
            )
        )
    );
};

// ===== GENERATION TYPE MODAL =====
const GenerationTypeModal = ({ isOpen, onClose, onSelectType }) => {
    if (!isOpen) return null;

    return React.createElement(
        'div',
        {
            className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[110]',
            onClick: (e) => { if (e.target === e.currentTarget) onClose(); }
        },
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4' },
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mb-4' },
                React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, 'Vyberte typ generovania'),
                React.createElement(
                    'button',
                    { onClick: onClose, className: 'text-gray-500 hover:text-gray-700' },
                    React.createElement('i', { className: 'fa-solid fa-times text-xl' })
                )
            ),
            React.createElement(
                'div',
                { className: 'space-y-3' },
                React.createElement(
                    'button',
                    {
                        className: 'w-full p-4 bg-blue-50 hover:bg-blue-100 border-2 border-blue-200 rounded-xl text-left transition-colors',
                        onClick: () => onSelectType('regular')
                    },
                    React.createElement(
                        'div',
                        { className: 'flex items-center gap-3' },
                        React.createElement(
                            'div',
                            { className: 'w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0' },
                            React.createElement('i', { className: 'fa-solid fa-table-cells-large text-white text-lg' })
                        ),
                        React.createElement(
                            'div',
                            null,
                            React.createElement('h4', { className: 'font-semibold text-gray-800 text-lg' }, 'Klasické zápasy'),
                            React.createElement('p', { className: 'text-sm text-gray-600' }, 'Generovať zápasy v skupinách (každý s každým)')
                        )
                    )
                ),
                React.createElement(
                    'button',
                    {
                        className: 'w-full p-4 bg-purple-50 hover:bg-purple-100 border-2 border-purple-200 rounded-xl text-left transition-colors',
                        onClick: () => onSelectType('placement')
                    },
                    React.createElement(
                        'div',
                        { className: 'flex items-center gap-3' },
                        React.createElement(
                            'div',
                            { className: 'w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0' },
                            React.createElement('i', { className: 'fa-solid fa-trophy text-white text-lg' })
                        ),
                        React.createElement(
                            'div',
                            null,
                            React.createElement('h4', { className: 'font-semibold text-gray-800 text-lg' }, 'Zápas o umiestnenie'),
                            React.createElement('p', { className: 'text-sm text-gray-600' }, 'Vytvoriť jeden zápas')
                        )
                    )
                )
            ),
            React.createElement(
                'div',
                { className: 'flex justify-end mt-4' },
                React.createElement(
                    'button',
                    { onClick: onClose, className: 'px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors' },
                    'Zrušiť'
                )
            )
        )
    );
};

// ===== PLACEMENT MATCH MODAL =====
const PlacementMatchModal = ({ isOpen, onClose, onConfirm, categories, groupsByCategory }) => {
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedGroupType, setSelectedGroupType] = useState('');
    const [selectedGroup1, setSelectedGroup1] = useState('');
    const [selectedGroup2, setSelectedGroup2] = useState('');
    const [selectedOrder1, setSelectedOrder1] = useState('');
    const [selectedOrder2, setSelectedOrder2] = useState('');
    const [placementRank, setPlacementRank] = useState('');
    const [matchTitle, setMatchTitle] = useState('');
    const [availableGroups, setAvailableGroups] = useState([]);
    const [filteredGroupsByType, setFilteredGroupsByType] = useState([]);
    const [orderError1, setOrderError1] = useState('');
    const [orderError2, setOrderError2] = useState('');
    const [rankError, setRankError] = useState('');
    const [maxTeamsInGroup1, setMaxTeamsInGroup1] = useState(0);
    const [maxTeamsInGroup2, setMaxTeamsInGroup2] = useState(0);

    useEffect(() => {
        if (!isOpen) {
            setSelectedCategory('');
            setSelectedGroupType('');
            setSelectedGroup1('');
            setSelectedGroup2('');
            setSelectedOrder1('');
            setSelectedOrder2('');
            setPlacementRank('');
            setMatchTitle('');
            setAvailableGroups([]);
            setFilteredGroupsByType([]);
            setOrderError1('');
            setOrderError2('');
            setRankError('');
            setMaxTeamsInGroup1(0);
            setMaxTeamsInGroup2(0);
        }
    }, [isOpen]);

    const sortedCategories = React.useMemo(() => {
        return [...categories].sort((a, b) => a.name.localeCompare(b.name));
    }, [categories]);

    const groupTypeOptions = [
        { value: 'základná skupina', label: 'Základná skupina', icon: 'fa-layer-group', color: 'green' },
        { value: 'nadstavbová skupina', label: 'Nadstavbová skupina', icon: 'fa-chart-line', color: 'purple' }
    ];

    useEffect(() => {
        if (selectedCategory) {
            if (groupsByCategory[selectedCategory]) {
                const sortedGroups = [...groupsByCategory[selectedCategory]]
                    .sort((a, b) => a.name.localeCompare(b.name));
                setAvailableGroups(sortedGroups);
            } else {
                setAvailableGroups([]);
            }
            setSelectedGroupType('');
            setSelectedGroup1('');
            setSelectedGroup2('');
            setSelectedOrder1('');
            setSelectedOrder2('');
            setPlacementRank('');
            setOrderError1('');
            setOrderError2('');
            setRankError('');
            setMaxTeamsInGroup1(0);
            setMaxTeamsInGroup2(0);
            setFilteredGroupsByType([]);
        } else {
            setAvailableGroups([]);
            setSelectedGroupType('');
            setSelectedGroup1('');
            setSelectedGroup2('');
            setSelectedOrder1('');
            setSelectedOrder2('');
            setPlacementRank('');
            setOrderError1('');
            setOrderError2('');
            setRankError('');
            setMaxTeamsInGroup1(0);
            setMaxTeamsInGroup2(0);
            setFilteredGroupsByType([]);
        }
    }, [selectedCategory, groupsByCategory]);

    useEffect(() => {
        if (selectedCategory && selectedGroupType && availableGroups.length > 0) {
            const filtered = availableGroups.filter(group => group.type === selectedGroupType);
            setFilteredGroupsByType(filtered);
            setSelectedGroup1('');
            setSelectedGroup2('');
            setSelectedOrder1('');
            setSelectedOrder2('');
            setPlacementRank('');
            setOrderError1('');
            setOrderError2('');
            setRankError('');
            setMaxTeamsInGroup1(0);
            setMaxTeamsInGroup2(0);
        } else {
            setFilteredGroupsByType([]);
            setSelectedGroup1('');
            setSelectedGroup2('');
            setSelectedOrder1('');
            setSelectedOrder2('');
            setPlacementRank('');
            setOrderError1('');
            setOrderError2('');
            setRankError('');
            setMaxTeamsInGroup1(0);
            setMaxTeamsInGroup2(0);
        }
    }, [selectedCategory, selectedGroupType, availableGroups]);

    const getTeamCountInGroup = (groupName) => {
        if (!selectedCategory || !groupName || !window.__teamManagerData?.allTeams) return 0;
        const category = categories.find(c => c.id === selectedCategory);
        if (!category) return 0;
        const teamsInGroup = window.__teamManagerData.allTeams.filter(t => 
            t.category === category.name && 
            t.groupName === groupName
        );
        return teamsInGroup.length;
    };

    useEffect(() => {
        if (selectedGroup1) {
            const teamCount = getTeamCountInGroup(selectedGroup1);
            setMaxTeamsInGroup1(teamCount);
            if (selectedOrder1) {
                const numValue = parseInt(selectedOrder1, 10);
                if (numValue > teamCount) {
                    setOrderError1(`V skupine je len ${teamCount} tímov`);
                } else {
                    setOrderError1('');
                }
            }
        } else {
            setMaxTeamsInGroup1(0);
            setOrderError1('');
        }
    }, [selectedGroup1, selectedCategory, categories]);

    useEffect(() => {
        if (selectedGroup2) {
            const teamCount = getTeamCountInGroup(selectedGroup2);
            setMaxTeamsInGroup2(teamCount);
            if (selectedOrder2) {
                const numValue = parseInt(selectedOrder2, 10);
                if (numValue > teamCount) {
                    setOrderError2(`V skupine je len ${teamCount} tímov`);
                } else {
                    setOrderError2('');
                }
            }
        } else {
            setMaxTeamsInGroup2(0);
            setOrderError2('');
        }
    }, [selectedGroup2, selectedCategory, categories]);

    const handleOrder1Change = (e) => {
        const value = e.target.value;
        if (value === '') { setSelectedOrder1(''); setOrderError1(''); return; }
        if (!/^\d+$/.test(value)) { setOrderError1('Zadajte platné číslo'); return; }
        const numValue = parseInt(value, 10);
        if (numValue <= 0) { setOrderError1('Poradie musí byť väčšie ako 0'); return; }
        if (numValue > maxTeamsInGroup1) { setOrderError1(`V skupine je len ${maxTeamsInGroup1} tímov`); return; }
        setSelectedOrder1(value);
        setOrderError1('');
    };

    const handleOrder2Change = (e) => {
        const value = e.target.value;
        if (value === '') { setSelectedOrder2(''); setOrderError2(''); return; }
        if (!/^\d+$/.test(value)) { setOrderError2('Zadajte platné číslo'); return; }
        const numValue = parseInt(value, 10);
        if (numValue <= 0) { setOrderError2('Poradie musí byť väčšie ako 0'); return; }
        if (numValue > maxTeamsInGroup2) { setOrderError2(`V skupine je len ${maxTeamsInGroup2} tímov`); return; }
        setSelectedOrder2(value);
        setOrderError2('');
    };

    const handleRankChange = (e) => {
        const value = e.target.value;
        if (value === '') { setPlacementRank(''); setRankError(''); return; }
        if (!/^\d+$/.test(value)) { setRankError('Zadajte platné číslo'); return; }
        const numValue = parseInt(value, 10);
        if (numValue <= 0) { setRankError('Umiestnenie musí byť väčšie ako 0'); return; }
        setPlacementRank(value);
        setRankError('');
    };

    useEffect(() => {
        if (selectedCategory && selectedGroup1 && selectedOrder1 && selectedGroup2 && selectedOrder2 && placementRank) {
            const category = categories.find(c => c.id === selectedCategory);
            const group1Name = selectedGroup1.replace('skupina ', '');
            const group2Name = selectedGroup2.replace('skupina ', '');
            setMatchTitle(`${category.name} ${selectedOrder1}${group1Name} - ${category.name} ${selectedOrder2}${group2Name} (o ${placementRank}. miesto)`);
        } else {
            setMatchTitle('');
        }
    }, [selectedCategory, selectedGroup1, selectedGroup2, selectedOrder1, selectedOrder2, placementRank, categories]);

    const handleConfirm = () => {
        if (selectedCategory && selectedGroup1 && selectedGroup2 && selectedOrder1 && selectedOrder2 && placementRank) {
            const category = categories.find(c => c.id === selectedCategory);
            const cleanGroup1 = selectedGroup1.replace('skupina ', '');
            const cleanGroup2 = selectedGroup2.replace('skupina ', '');
            const homeTeamIdentifier = `${category.name} ${selectedOrder1}${cleanGroup1}`;
            const awayTeamIdentifier = `${category.name} ${selectedOrder2}${cleanGroup2}`;
            onConfirm({
                homeTeamIdentifier,
                awayTeamIdentifier,
                categoryId: selectedCategory,
                categoryName: category.name,
                groupName: `${selectedGroup1} - ${selectedGroup2}`,
                placementRank: parseInt(placementRank, 10),
                matchTitle
            });
        }
    };

    if (!isOpen) return null;

    const isValid = selectedCategory && selectedGroupType && selectedGroup1 && selectedGroup2 && 
                    selectedOrder1 && selectedOrder2 && placementRank &&
                    !orderError1 && !orderError2 && !rankError &&
                    maxTeamsInGroup1 > 0 && maxTeamsInGroup2 > 0;

    return React.createElement(
        'div',
        {
            className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[115]',
            onClick: (e) => { if (e.target === e.currentTarget) onClose(); }
        },
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-2xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto' },
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mb-4' },
                React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, 'Vytvoriť zápas o umiestnenie'),
                React.createElement(
                    'button',
                    { onClick: onClose, className: 'text-gray-500 hover:text-gray-700' },
                    React.createElement('i', { className: 'fa-solid fa-times text-xl' })
                )
            ),
            React.createElement(
                'div',
                { className: 'mb-4' },
                React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Kategória:'),
                React.createElement(
                    'select',
                    {
                        value: selectedCategory,
                        onChange: (e) => setSelectedCategory(e.target.value),
                        className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black'
                    },
                    React.createElement('option', { value: '' }, '-- Vyberte kategóriu --'),
                    sortedCategories.map(cat => 
                        React.createElement('option', { key: cat.id, value: cat.id }, cat.name)
                    )
                )
            ),
            selectedCategory && React.createElement(
                'div',
                { className: 'mb-4' },
                React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Typ skupiny:'),
                React.createElement(
                    'select',
                    {
                        value: selectedGroupType,
                        onChange: (e) => setSelectedGroupType(e.target.value),
                        className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black'
                    },
                    React.createElement('option', { value: '' }, '-- Vyberte typ skupiny --'),
                    groupTypeOptions.map(option => 
                        React.createElement('option', { key: option.value, value: option.value }, option.label)
                    )
                )
            ),
            selectedCategory && selectedGroupType && React.createElement(
                'div',
                { className: 'mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200' },
                React.createElement('h4', { className: 'font-semibold text-gray-700 mb-3' }, 'Prvý tím'),
                React.createElement(
                    'div',
                    { className: 'mb-3' },
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Skupina:'),
                    React.createElement(
                        'select',
                        {
                            value: selectedGroup1,
                            onChange: (e) => { setSelectedGroup1(e.target.value); setSelectedOrder1(''); setOrderError1(''); },
                            className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black'
                        },
                        React.createElement('option', { value: '' }, '-- Vyberte skupinu --'),
                        filteredGroupsByType.map(group => 
                            React.createElement('option', { key: group.name, value: group.name }, group.name)
                        )
                    )
                ),
                selectedGroup1 && React.createElement(
                    'div',
                    { className: 'mb-3' },
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, `Poradie (1-${maxTeamsInGroup1 || '?'}):`),
                    React.createElement('input', {
                        type: 'text',
                        inputMode: 'numeric',
                        pattern: '[0-9]*',
                        value: selectedOrder1,
                        onChange: handleOrder1Change,
                        placeholder: maxTeamsInGroup1 ? `Zadajte číslo 1-${maxTeamsInGroup1}` : 'Najprv vyberte skupinu',
                        disabled: !maxTeamsInGroup1,
                        className: `w-full px-3 py-2 border ${orderError1 ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black ${!maxTeamsInGroup1 ? 'bg-gray-100' : ''}`
                    }),
                    orderError1 && React.createElement(
                        'p',
                        { className: 'text-xs text-red-500 mt-1 flex items-center gap-1' },
                        React.createElement('i', { className: 'fa-solid fa-exclamation-triangle' }),
                        orderError1
                    )
                )
            ),
            selectedCategory && selectedGroupType && React.createElement(
                'div',
                { className: 'mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200' },
                React.createElement('h4', { className: 'font-semibold text-gray-700 mb-3' }, 'Druhý tím'),
                React.createElement(
                    'div',
                    { className: 'mb-3' },
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Skupina:'),
                    React.createElement(
                        'select',
                        {
                            value: selectedGroup2,
                            onChange: (e) => { setSelectedGroup2(e.target.value); setSelectedOrder2(''); setOrderError2(''); },
                            className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black'
                        },
                        React.createElement('option', { value: '' }, '-- Vyberte skupinu --'),
                        filteredGroupsByType.map(group => 
                            React.createElement('option', { key: group.name, value: group.name }, group.name)
                        )
                    )
                ),
                selectedGroup2 && React.createElement(
                    'div',
                    { className: 'mb-3' },
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, `Poradie (1-${maxTeamsInGroup2 || '?'}):`),
                    React.createElement('input', {
                        type: 'text',
                        inputMode: 'numeric',
                        pattern: '[0-9]*',
                        value: selectedOrder2,
                        onChange: handleOrder2Change,
                        placeholder: maxTeamsInGroup2 ? `Zadajte číslo 1-${maxTeamsInGroup2}` : 'Najprv vyberte skupinu',
                        disabled: !maxTeamsInGroup2,
                        className: `w-full px-3 py-2 border ${orderError2 ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black ${!maxTeamsInGroup2 ? 'bg-gray-100' : ''}`
                    }),
                    orderError2 && React.createElement(
                        'p',
                        { className: 'text-xs text-red-500 mt-1 flex items-center gap-1' },
                        React.createElement('i', { className: 'fa-solid fa-exclamation-triangle' }),
                        orderError2
                    )
                )
            ),
            selectedCategory && selectedGroupType && React.createElement(
                'div',
                { className: 'mb-6 p-4 bg-amber-50 rounded-lg border border-amber-200' },
                React.createElement('h4', { className: 'font-semibold text-gray-700 mb-3' }, 'Umiestnenie'),
                React.createElement(
                    'div',
                    { className: 'mb-3' },
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'O aké miesto sa hrá:'),
                    React.createElement('input', {
                        type: 'text',
                        inputMode: 'numeric',
                        pattern: '[0-9]*',
                        value: placementRank,
                        onChange: handleRankChange,
                        placeholder: 'Zadajte číslo (napr. 1, 3, 5...)',
                        className: `w-full px-3 py-2 border ${rankError ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black`
                    }),
                    rankError && React.createElement(
                        'p',
                        { className: 'text-xs text-red-500 mt-1 flex items-center gap-1' },
                        React.createElement('i', { className: 'fa-solid fa-exclamation-triangle' }),
                        rankError
                    )
                )
            ),
            isValid && React.createElement(
                'div',
                { className: 'mb-6 p-4 bg-green-50 rounded-lg border border-green-200' },
                React.createElement('h4', { className: 'font-semibold text-gray-700 mb-2' }, 'Náhľad zápasu:'),
                React.createElement(
                    'div',
                    { className: 'flex items-center justify-between' },
                    React.createElement(
                        'div',
                        { className: 'text-left' },
                        React.createElement('p', { className: 'font-semibold text-gray-800' }, 
                            (() => {
                                const category = categories.find(c => c.id === selectedCategory);
                                const cleanGroup1 = selectedGroup1.replace('skupina ', '');
                                return `${category?.name || ''} ${selectedOrder1}${cleanGroup1}`;
                            })()
                        )
                    ),
                    React.createElement('i', { className: 'fa-solid fa-vs text-gray-400 mx-4' }),
                    React.createElement(
                        'div',
                        { className: 'text-right' },
                        React.createElement('p', { className: 'font-semibold text-gray-800' }, 
                            (() => {
                                const category = categories.find(c => c.id === selectedCategory);
                                const cleanGroup2 = selectedGroup2.replace('skupina ', '');
                                return `${category?.name || ''} ${selectedOrder2}${cleanGroup2}`;
                            })()
                        )
                    )
                ),
                React.createElement(
                    'p',
                    { className: 'text-sm font-medium text-amber-600 mt-2 text-center' },
                    `O ${placementRank}. miesto`
                ),
                React.createElement(
                    'p',
                    { className: 'text-xs text-gray-500 mt-2 text-center' },
                    `ID: ${matchTitle}`
                )
            ),
            React.createElement(
                'div',
                { className: 'flex justify-end gap-3' },
                React.createElement(
                    'button',
                    { onClick: onClose, className: 'px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors' },
                    'Zrušiť'
                ),
                React.createElement(
                    'button',
                    {
                        onClick: handleConfirm,
                        disabled: !isValid,
                        className: `px-4 py-2 text-white rounded-lg transition-colors ${
                            isValid
                                ? 'bg-green-600 hover:bg-green-700 text-white cursor-pointer' 
                                : 'bg-white border-2 border-green-600 text-green-600 cursor-not-allowed'
                        }`
                    },
                    'Vytvoriť zápas'
                )
            )
        )
    );
};

// ===== DELETE MATCHES MODAL =====
const DeleteMatchesModal = ({ isOpen, onClose, onConfirm, categories, groupsByCategory }) => {
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedGroup, setSelectedGroup] = useState('');
    const [availableGroups, setAvailableGroups] = useState([]);
    const [selectedGroupType, setSelectedGroupType] = useState('');

    useEffect(() => {
        if (!isOpen) {
            setSelectedCategory('');
            setSelectedGroup('');
            setAvailableGroups([]);
            setSelectedGroupType('');
        }
    }, [isOpen]);

    const sortedCategories = React.useMemo(() => {
        return [...categories].sort((a, b) => a.name.localeCompare(b.name));
    }, [categories]);

    useEffect(() => {
        if (selectedCategory && groupsByCategory[selectedCategory]) {
            const sortedGroups = [...groupsByCategory[selectedCategory]].sort((a, b) => a.name.localeCompare(b.name));
            setAvailableGroups(sortedGroups);
            setSelectedGroup('');
            setSelectedGroupType('');
        } else {
            setAvailableGroups([]);
            setSelectedGroup('');
            setSelectedGroupType('');
        }
    }, [selectedCategory, groupsByCategory]);

    useEffect(() => {
        if (selectedGroup && availableGroups.length > 0) {
            const group = availableGroups.find(g => g.name === selectedGroup);
            if (group) {
                if (group.type === 'základná skupina') setSelectedGroupType('Základná skupina');
                else if (group.type === 'nadstavbová skupina') setSelectedGroupType('Nadstavbová skupina');
                else setSelectedGroupType('');
            } else setSelectedGroupType('');
        } else setSelectedGroupType('');
    }, [selectedGroup, availableGroups]);

    if (!isOpen) return null;

    return React.createElement(
        'div',
        {
            className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
            onClick: (e) => { if (e.target === e.currentTarget) onClose(); }
        },
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4' },
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mb-4' },
                React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, 'Zmazať zápasy'),
                React.createElement(
                    'button',
                    { onClick: onClose, className: 'text-gray-500 hover:text-gray-700' },
                    React.createElement('i', { className: 'fa-solid fa-times text-xl' })
                )
            ),
            React.createElement(
                'div',
                { className: 'mb-4' },
                React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Kategória:'),
                React.createElement(
                    'select',
                    {
                        value: selectedCategory,
                        onChange: (e) => setSelectedCategory(e.target.value),
                        className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black'
                    },
                    React.createElement('option', { value: '' }, '-- Vyberte kategóriu --'),
                    sortedCategories.map(cat => 
                        React.createElement('option', { key: cat.id, value: cat.id }, cat.name)
                    )
                )
            ),
            selectedCategory && React.createElement(
                'div',
                { className: 'mb-4' },
                React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Skupina:'),
                React.createElement(
                    'select',
                    {
                        value: selectedGroup,
                        onChange: (e) => setSelectedGroup(e.target.value),
                        className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black'
                    },
                    React.createElement('option', { value: '' }, '-- Všetky skupiny --'),
                    availableGroups.map((group, index) => 
                        React.createElement('option', { key: index, value: group.name }, group.name)
                    )
                ),
                selectedGroup && selectedGroupType && React.createElement(
                    'div',
                    { className: 'mt-2 text-sm' },
                    React.createElement(
                        'span',
                        { 
                            className: `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                selectedGroupType === 'Základná skupina' 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-purple-100 text-purple-800'
                            }` 
                        },
                        selectedGroupType
                    )
                )
            ),
            React.createElement(
                'div',
                { className: 'mb-6 p-3 bg-red-50 border border-red-200 rounded-lg' },
                React.createElement(
                    'p',
                    { className: 'text-sm text-red-600 flex items-center gap-2' },
                    React.createElement('i', { className: 'fa-solid fa-exclamation-triangle' }),
                    'Táto akcia je nenávratná. Všetky vybrané zápasy budú natrvalo odstránené.'
                )
            ),
            React.createElement(
                'div',
                { className: 'flex justify-end gap-3' },
                React.createElement(
                    'button',
                    { onClick: onClose, className: 'px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors' },
                    'Zrušiť'
                ),
                React.createElement(
                    'button',
                    {
                        onClick: () => { onConfirm({ categoryId: selectedCategory, groupName: selectedGroup || null }); onClose(); },
                        disabled: !selectedCategory,
                        className: `px-4 py-2 text-white rounded-lg transition-colors ${
                            selectedCategory 
                                ? 'bg-red-600 hover:bg-red-700 text-white border border-red-600 cursor-pointer' 
                                : 'bg-white text-red-600 border border-red-600 cursor-not-allowed'
                        }`
                    },
                    'Zmazať zápasy'
                )
            )
        )
    );
};

// ===== CONFIRM MODALS =====
const ConfirmRegenerateModal = ({ isOpen, onClose, onConfirm, categoryName, groupName }) => {
    if (!isOpen) return null;
    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]', onClick: (e) => { if (e.target === e.currentTarget) onClose(); } },
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4' },
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mb-4' },
                React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, 'Potvrdenie generovania'),
                React.createElement('button', { onClick: onClose, className: 'text-gray-500 hover:text-gray-700' }, React.createElement('i', { className: 'fa-solid fa-times text-xl' }))
            ),
            React.createElement(
                'div',
                { className: 'mb-6' },
                React.createElement('p', { className: 'text-gray-700 mb-2' }, 'Pre kategóriu ', React.createElement('span', { className: 'font-semibold' }, categoryName), groupName ? React.createElement('span', null, ' a skupinu ', React.createElement('span', { className: 'font-semibold' }, groupName)) : null, ' už boli zápasy vygenerované.'),
                React.createElement('p', { className: 'text-gray-700' }, 'Chcete ich vygenerovať znovu?')
            ),
            React.createElement(
                'div',
                { className: 'flex justify-end gap-3' },
                React.createElement('button', { onClick: onClose, className: 'px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors' }, 'Nie'),
                React.createElement('button', { onClick: () => { onConfirm(); onClose(); }, className: 'px-4 py-2 text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors' }, 'Áno, generovať')
            )
        )
    );
};

const ConfirmExistingMatchModal = ({ isOpen, onClose, onConfirm, match, homeTeamDisplay, awayTeamDisplay, displayMode }) => {
    if (!isOpen || !match) return null;
    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70]', onClick: (e) => { if (e.target === e.currentTarget) onClose(); } },
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4' },
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mb-4' },
                React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, 'Existujúci zápas'),
                React.createElement('button', { onClick: onClose, className: 'text-gray-500 hover:text-gray-700' }, React.createElement('i', { className: 'fa-solid fa-times text-xl' }))
            ),
            React.createElement(
                'div',
                { className: 'mb-6' },
                React.createElement('p', { className: 'text-gray-700 mb-2' }, 'Zápas medzi tímami'),
                React.createElement(
                    'div',
                    { className: 'bg-gray-50 p-3 rounded-lg mb-2' },
                    displayMode === 'both' && typeof homeTeamDisplay === 'object'
                        ? React.createElement('div', { className: 'flex flex-col items-start' }, React.createElement('p', { className: 'font-semibold text-sm' }, homeTeamDisplay.name), React.createElement('p', { className: 'text-xs text-gray-500' }, `(${homeTeamDisplay.id})`))
                        : React.createElement('p', { className: 'font-semibold text-sm' }, homeTeamDisplay),
                    displayMode === 'both' && typeof awayTeamDisplay === 'object'
                        ? React.createElement('div', { className: 'flex flex-col items-start mt-1' }, React.createElement('p', { className: 'font-semibold text-sm' }, awayTeamDisplay.name), React.createElement('p', { className: 'text-xs text-gray-500' }, `(${awayTeamDisplay.id})`))
                        : React.createElement('p', { className: 'font-semibold text-sm mt-1' }, awayTeamDisplay)
                ),
                React.createElement('p', { className: 'text-gray-700' }, 'už existuje. Chcete ho vygenerovať znovu?')
            ),
            React.createElement(
                'div',
                { className: 'flex justify-end gap-3' },
                React.createElement('button', { onClick: onClose, className: 'px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors' }, 'Nie'),
                React.createElement('button', { onClick: () => { onConfirm(match); onClose(); }, className: 'px-4 py-2 text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors' }, 'Áno')
            )
        )
    );
};

const ConfirmSwapModal = ({ isOpen, onClose, onConfirm, homeTeamDisplay, awayTeamDisplay, displayMode }) => {
    if (!isOpen) return null;
    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[80]', onClick: (e) => { if (e.target === e.currentTarget) onClose(); } },
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4' },
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mb-4' },
                React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, 'Potvrdenie výmeny'),
                React.createElement('button', { onClick: onClose, className: 'text-gray-500 hover:text-gray-700' }, React.createElement('i', { className: 'fa-solid fa-times text-xl' }))
            ),
            React.createElement(
                'div',
                { className: 'mb-6' },
                React.createElement('p', { className: 'text-gray-700 mb-4' }, 'Naozaj chcete vymeniť domáci a hosťovský tím?'),
                React.createElement(
                    'div',
                    { className: 'flex items-center justify-between bg-gray-50 p-3 rounded-lg' },
                    displayMode === 'both' && typeof homeTeamDisplay === 'object'
                        ? React.createElement('div', { className: 'flex flex-col items-start' }, React.createElement('span', { className: 'font-semibold text-sm' }, homeTeamDisplay.name), React.createElement('span', { className: 'text-xs text-gray-500' }, `(${homeTeamDisplay.id})`))
                        : React.createElement('span', { className: 'font-semibold text-sm' }, homeTeamDisplay),
                    React.createElement('i', { className: 'fa-solid fa-arrow-right-arrow-left text-blue-500 mx-2' }),
                    displayMode === 'both' && typeof awayTeamDisplay === 'object'
                        ? React.createElement('div', { className: 'flex flex-col items-start' }, React.createElement('span', { className: 'font-semibold text-sm' }, awayTeamDisplay.name), React.createElement('span', { className: 'text-xs text-gray-500' }, `(${awayTeamDisplay.id})`))
                        : React.createElement('span', { className: 'font-semibold text-sm' }, awayTeamDisplay)
                )
            ),
            React.createElement(
                'div',
                { className: 'flex justify-end gap-3' },
                React.createElement('button', { onClick: onClose, className: 'px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors' }, 'Zrušiť'),
                React.createElement('button', { onClick: () => { onConfirm(); onClose(); }, className: 'px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors' }, 'Vymeniť')
            )
        )
    );
};

const ConfirmBulkUnassignModal = ({ isOpen, onClose, onConfirm, hallName, date, matchesCount, isWholeHall }) => {
    if (!isOpen) return null;
    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]', onClick: (e) => { if (e.target === e.currentTarget) onClose(); } },
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4' },
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mb-4' },
                React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, isWholeHall ? 'Odstrániť všetky zápasy z haly' : 'Odstrániť zápasy z dňa'),
                React.createElement('button', { onClick: onClose, className: 'text-gray-500 hover:text-gray-700' }, React.createElement('i', { className: 'fa-solid fa-times text-xl' }))
            ),
            React.createElement(
                'div',
                { className: 'mb-6' },
                React.createElement('p', { className: 'text-gray-700 mb-2' }, 'Naozaj chcete odstrániť priradenie všetkých zápasov ', isWholeHall ? React.createElement('span', null, 'z haly ', React.createElement('span', { className: 'font-semibold' }, hallName)) : React.createElement('span', null, 'dňa ', React.createElement('span', { className: 'font-semibold' }, date)), '?'),
                React.createElement('p', { className: 'text-gray-700 mb-4' }, 'Počet zápasov na odstránenie: ', React.createElement('span', { className: 'font-semibold text-orange-600' }, matchesCount)),
                React.createElement('p', { className: 'text-sm text-orange-600 flex items-center gap-2' }, React.createElement('i', { className: 'fa-solid fa-exclamation-triangle' }), 'Zápasy zostanú v systéme, ale budú presunuté do nepriradených.')
            ),
            React.createElement(
                'div',
                { className: 'flex justify-end gap-3' },
                React.createElement('button', { onClick: onClose, className: 'px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors' }, 'Zrušiť'),
                React.createElement('button', { onClick: () => { onConfirm(); onClose(); }, className: 'px-4 py-2 text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors' }, 'Odstrániť priradenie')
            )
        )
    );
};

const ConfirmBulkDeleteModal = ({ isOpen, onClose, onConfirm, categoryName, groupName, matchesCount }) => {
    if (!isOpen) return null;
    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[80]', onClick: (e) => { if (e.target === e.currentTarget) onClose(); } },
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4' },
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mb-4' },
                React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, 'Potvrdenie hromadného mazania'),
                React.createElement('button', { onClick: onClose, className: 'text-gray-500 hover:text-gray-700' }, React.createElement('i', { className: 'fa-solid fa-times text-xl' }))
            ),
            React.createElement(
                'div',
                { className: 'mb-6' },
                React.createElement('p', { className: 'text-gray-700 mb-2' }, 'Naozaj chcete zmazať všetky zápasy pre ', React.createElement('span', { className: 'font-semibold' }, categoryName), groupName ? React.createElement('span', null, ' a skupinu ', React.createElement('span', { className: 'font-semibold' }, groupName)) : null, '?'),
                React.createElement('p', { className: 'text-gray-700 mb-4' }, 'Počet zápasov na zmazanie: ', React.createElement('span', { className: 'font-semibold text-red-600' }, matchesCount)),
                React.createElement('p', { className: 'text-sm text-red-600 flex items-center gap-2' }, React.createElement('i', { className: 'fa-solid fa-exclamation-triangle' }), 'Táto akcia je nenávratná!')
            ),
            React.createElement(
                'div',
                { className: 'flex justify-end gap-3' },
                React.createElement('button', { onClick: onClose, className: 'px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors' }, 'Zrušiť'),
                React.createElement('button', { onClick: () => { onConfirm(); onClose(); }, className: 'px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors' }, 'Áno, zmazať')
            )
        )
    );
};

const ConfirmDeleteModal = ({ isOpen, onClose, onConfirm, homeTeamDisplay, awayTeamDisplay, displayMode }) => {
    if (!isOpen) return null;
    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[80]', onClick: (e) => { if (e.target === e.currentTarget) onClose(); } },
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4' },
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mb-4' },
                React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, 'Potvrdenie zmazania'),
                React.createElement('button', { onClick: onClose, className: 'text-gray-500 hover:text-gray-700' }, React.createElement('i', { className: 'fa-solid fa-times text-xl' }))
            ),
            React.createElement(
                'div',
                { className: 'mb-6' },
                React.createElement('p', { className: 'text-gray-700 mb-4' }, 'Naozaj chcete zmazať zápas medzi tímami?'),
                React.createElement(
                    'div',
                    { className: 'flex items-center justify-between bg-gray-50 p-3 rounded-lg' },
                    displayMode === 'both' && typeof homeTeamDisplay === 'object'
                        ? React.createElement('div', { className: 'flex flex-col items-start' }, React.createElement('span', { className: 'font-semibold text-sm' }, homeTeamDisplay.name), React.createElement('span', { className: 'text-xs text-gray-500' }, `(${homeTeamDisplay.id})`))
                        : React.createElement('span', { className: 'font-semibold text-sm' }, homeTeamDisplay),
                    React.createElement('i', { className: 'fa-solid fa-arrow-right-arrow-left text-blue-500 mx-2' }),
                    displayMode === 'both' && typeof awayTeamDisplay === 'object'
                        ? React.createElement('div', { className: 'flex flex-col items-start' }, React.createElement('span', { className: 'font-semibold text-sm' }, awayTeamDisplay.name), React.createElement('span', { className: 'text-xs text-gray-500' }, `(${awayTeamDisplay.id})`))
                        : React.createElement('span', { className: 'font-semibold text-sm' }, awayTeamDisplay)
                ),
                React.createElement('p', { className: 'text-sm text-red-600 mt-4' }, 'Táto akcia je nenávratná.')
            ),
            React.createElement(
                'div',
                { className: 'flex justify-end gap-3' },
                React.createElement('button', { onClick: onClose, className: 'px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors' }, 'Zrušiť'),
                React.createElement('button', { onClick: () => { onConfirm(); onClose(); }, className: 'px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors' }, 'Zmazať')
            )
        )
    );
};

// ===== ASSIGN MATCH TO BREAK MODAL – s upraveným vyhľadávaním =====
const AssignMatchToBreakModal = ({ 
    isOpen, onClose, onConfirm, availableMatches, breakStartTime, breakEndTime, 
    breakDuration, hallId, date, categories, displayMode, getTeamDisplayText, 
    allMatches, groupsByCategory, blockedBreaks, sportHalls,
    selectedCategoriesFilter = []
}) => {
    const [selectedMatchId, setSelectedMatchId] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [filteredByConditions, setFilteredByConditions] = useState([]);

    const getMatchDuration = (categoryName) => {
        const category = categories?.find(c => c.name === categoryName);
        if (!category) return 0;
        const periods = category.periods || 2;
        const periodDuration = category.periodDuration || 20;
        const breakDuration = category.breakDuration || 2;
        return (periodDuration + breakDuration) * periods - breakDuration;
    };

    const isMatchEligibleForBreak = (match, existingMatchesInHallAndDay) => {
        const matchDuration = getMatchDuration(match.categoryName);
        if (breakDuration > 0 && matchDuration > breakDuration) return false;
        const isAlreadyInHall = existingMatchesInHallAndDay.some(m => m.id === match.id);
        if (isAlreadyInHall) return false;
        const [breakHours, breakMinutes] = breakStartTime.split(':').map(Number);
        const breakStartMinutes = breakHours * 60 + breakMinutes;
        const breakEndMinutes = breakStartMinutes + matchDuration;
        for (const existingMatch of existingMatchesInHallAndDay) {
            if (!existingMatch.scheduledTime) continue;
            const existingDate = existingMatch.scheduledTime.toDate();
            const existingStartMinutes = existingDate.getHours() * 60 + existingDate.getMinutes();
            const existingCategory = categories.find(c => c.name === existingMatch.categoryName);
            let existingDuration = 0, existingMatchBreak = 5;
            if (existingCategory) {
                const periods = existingCategory.periods || 2;
                const periodDuration = existingCategory.periodDuration || 20;
                const breakDurationValue = existingCategory.breakDuration || 2;
                existingDuration = (periodDuration + breakDurationValue) * periods - breakDurationValue;
                existingMatchBreak = existingCategory.matchBreak || 5;
            }
            const existingEndWithBreak = existingStartMinutes + existingDuration + existingMatchBreak;
            if (breakStartMinutes < existingEndWithBreak && breakEndMinutes > existingStartMinutes) return false;
        }
        return true;
    };

    const filterMatchesByConditions = () => {
        if (!availableMatches || availableMatches.length === 0) {
            setFilteredByConditions([]);
            return;
        }
        const existingMatchesInHallAndDay = allMatches?.filter(m => 
            m.hallId === hallId && m.scheduledTime && m.id !== selectedMatchId
        ).filter(m => {
            if (!m.scheduledTime) return false;
            const matchDate = m.scheduledTime.toDate();
            return getLocalDateStr(matchDate) === date;
        }) || [];
        
        // ===== APLIKOVANIE FILTRA KATEGÓRIÍ =====
        let matchesToFilter = availableMatches;
        if (selectedCategoriesFilter && selectedCategoriesFilter.length > 0) {
            matchesToFilter = availableMatches.filter(match => 
                selectedCategoriesFilter.includes(match.categoryId)
            );
        }
        
        const filtered = matchesToFilter.filter(match => isMatchEligibleForBreak(match, existingMatchesInHallAndDay));
        setFilteredByConditions(filtered);
    };

    useEffect(() => {
        if (isOpen) {
            setSelectedMatchId('');
            setSearchTerm('');
            filterMatchesByConditions();
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) filterMatchesByConditions();
    }, [availableMatches, isOpen, hallId, date, breakStartTime, breakDuration, allMatches, categories, groupsByCategory, selectedCategoriesFilter]);

    if (!isOpen) return null;

    const hallName = sportHalls?.find(h => h.id === hallId)?.name || 'Neznáma hala';
    const formattedDate = date ? (() => {
        const [year, month, day] = date.split('-').map(Number);
        return formatDateWithDay(new Date(year, month - 1, day));
    })() : '';

    // ===== POMOCNÉ FUNKCIE PRE VYHĽADÁVANIE =====

    // Extrahuje "čistý identifikátor" z tímu (napr. "A2" z "Kategória A2")
    const extractPureId = (identifier) => {
        if (!identifier) return '';
        const parts = identifier.split(' ');
        return parts.length >= 2 ? parts[parts.length - 1] : identifier;
    };

    // Rozdelí vyhľadávací reťazec na dva tímy podľa "="
    const extractTeamsFromSearch = (search) => {
        const trimmedSearch = search.trim();
        const equalIndex = trimmedSearch.indexOf('=');
        
        if (equalIndex === -1) {
            return { team1: null, team2: null };
        }
        
        const team1Raw = trimmedSearch.substring(0, equalIndex).trim();
        const team2Raw = trimmedSearch.substring(equalIndex + 1).trim();
        
        if (!team1Raw || !team2Raw) {
            return { team1: null, team2: null };
        }
        
        return { team1: team1Raw, team2: team2Raw };
    };

    // ===== KĽÚČOVÁ FUNKCIA: Normalizácia druhého tímu =====
    // Ak je team2 len číslo (napr. "3"), doplní sa písmeno skupiny z team1 (napr. "A" -> "A3")
    // Ak je team2 vo formáte "A3", ponechá sa tak ako je.
    const normalizeSecondTeam = (team1, team2) => {
        if (!team1 || !team2) return team2;
        
        const team2Trimmed = team2.trim();
        
        // Ak team2 už obsahuje písmeno (napr. "A3", "B5"), ponecháme ho
        if (/[a-zA-Z]/.test(team2Trimmed)) {
            return team2Trimmed;
        }
        
        // Ak team2 je len číslo (napr. "3"), extrahujeme písmeno z team1
        const team1Match = team1.match(/([a-zA-Z]+)\s*\d+$/);
        if (team1Match) {
            const groupLetter = team1Match[1];
            return `${groupLetter}${team2Trimmed}`;
        }
        
        // Ak sa nepodarilo extrahovať písmeno, vrátime team2 ako je
        return team2Trimmed;
    };

    // Získa porovnateľné reťazce pre zápas (názvy, ID, čisté ID)
    const getComparableStrings = (match) => {
        const homeDisplay = getTeamDisplayText ? getTeamDisplayText(match.homeTeamIdentifier) : match.homeTeamIdentifier;
        const awayDisplay = getTeamDisplayText ? getTeamDisplayText(match.awayTeamIdentifier) : match.awayTeamIdentifier;
        
        const homeName = typeof homeDisplay === 'object' ? homeDisplay.name : homeDisplay;
        const awayName = typeof awayDisplay === 'object' ? awayDisplay.name : awayDisplay;
        
        const homePureId = extractPureId(match.homeTeamIdentifier);
        const awayPureId = extractPureId(match.awayTeamIdentifier);
        
        return {
            homeName: (homeName || '').toLowerCase(),
            awayName: (awayName || '').toLowerCase(),
            homeId: (match.homeTeamIdentifier || '').toLowerCase(),
            awayId: (match.awayTeamIdentifier || '').toLowerCase(),
            homePureId: homePureId.toLowerCase(),
            awayPureId: awayPureId.toLowerCase()
        };
    };

    // Skontroluje, či reťazec obsahuje hľadaný tím
    const stringContainsTeam = (str, teamQuery) => {
        if (!str || !teamQuery) return false;
        return str.includes(teamQuery.toLowerCase());
    };

    // ===== KĽÚČOVÁ FUNKCIA: Kontrola, či zápas obsahuje OBA tímy =====
    const matchContainsBothTeams = (matchStrings, team1, team2) => {
        const team1Lower = team1.toLowerCase().trim();
        const team2Lower = team2.toLowerCase().trim();
        
        // Extrahujeme čisté ID z team1 a team2 (napr. "A2")
        const team1PureId = extractPureId(team1).toLowerCase();
        const team2PureId = extractPureId(team2).toLowerCase();
        
        // Skontrolujeme, či jeden z týmov v zápase zodpovedá team1
        const homeMatchesTeam1 = 
            matchStrings.homePureId === team1PureId ||
            matchStrings.homePureId.endsWith(team1PureId) ||
            matchStrings.homeName.includes(team1Lower) ||
            matchStrings.homeId.includes(team1Lower);
        
        const awayMatchesTeam1 = 
            matchStrings.awayPureId === team1PureId ||
            matchStrings.awayPureId.endsWith(team1PureId) ||
            matchStrings.awayName.includes(team1Lower) ||
            matchStrings.awayId.includes(team1Lower);
        
        // Skontrolujeme, či jeden z týmov v zápase zodpovedá team2
        const homeMatchesTeam2 = 
            matchStrings.homePureId === team2PureId ||
            matchStrings.homePureId.endsWith(team2PureId) ||
            matchStrings.homeName.includes(team2Lower) ||
            matchStrings.homeId.includes(team2Lower);
        
        const awayMatchesTeam2 = 
            matchStrings.awayPureId === team2PureId ||
            matchStrings.awayPureId.endsWith(team2PureId) ||
            matchStrings.awayName.includes(team2Lower) ||
            matchStrings.awayId.includes(team2Lower);
        
        // Musí platiť: (home je team1 A away je team2) ALEBO (away je team1 A home je team2)
        const case1 = homeMatchesTeam1 && awayMatchesTeam2;
        const case2 = awayMatchesTeam1 && homeMatchesTeam2;
        
        return case1 || case2;
    };

    // ===== HLAVNÁ LOGIKA VYHĽADÁVANIA =====
    const matchSearch = (match, searchLower, matchStrings) => {
        const { team1, team2 } = extractTeamsFromSearch(searchLower);
        
        if (team1 && team2) {
            // Normalizujeme druhý tím (napr. "3" -> "A3" podľa team1)
            const normalizedTeam2 = normalizeSecondTeam(team1, team2);
            
            return matchContainsBothTeams(matchStrings, team1, normalizedTeam2);
        }
        
        // Hľadanie jedného tímu
        if (stringContainsTeam(matchStrings.homeName, searchLower) || stringContainsTeam(matchStrings.awayName, searchLower)) return true;
        if (stringContainsTeam(matchStrings.homeId, searchLower) || stringContainsTeam(matchStrings.awayId, searchLower)) return true;
        if (stringContainsTeam(matchStrings.homePureId, searchLower) || stringContainsTeam(matchStrings.awayPureId, searchLower)) return true;
        
        // Hľadanie podľa kategórie
        if (match.categoryName && stringContainsTeam(match.categoryName.toLowerCase(), searchLower)) return true;
        
        return false;
    };

    // ===== HLAVNÉ FILTROVANIE =====
    const searchFilteredMatches = filteredByConditions.filter(match => {
        const searchLower = searchTerm.toLowerCase().trim();
        
        if (!searchLower) return true;
        
        const matchStrings = getComparableStrings(match);
        
        return matchSearch(match, searchLower, matchStrings);
    });

    const getMatchCountText = (count) => count === 1 ? 'zápas' : (count >= 2 && count <= 4 ? 'zápasy' : 'zápasov');

    const getTeamDisplay = (identifier) => {
        if (!getTeamDisplayText) return identifier;
        const display = getTeamDisplayText(identifier);
        switch (displayMode) {
            case 'name': return typeof display === 'object' ? display.name : display;
            case 'id': return identifier;
            case 'both': return typeof display === 'object' ? display : { name: display, id: identifier };
            default: return typeof display === 'object' ? display.name : display;
        }
    };

    const extractLetterAndNumber = (identifier) => {
        if (!identifier) return { letter: '', number: '' };
        const parts = identifier.split(' ');
        const lastPart = parts[parts.length - 1];
        let letter = '', number = '';
        for (let i = 0; i < lastPart.length; i++) {
            const char = lastPart[i];
            if (char >= '0' && char <= '9') {
                letter = lastPart.substring(0, i);
                number = lastPart.substring(i);
                break;
            }
        }
        if (number === '') letter = lastPart;
        return { letter, number };
    };

    const getCategoryColor = (categoryName) => {
        if (!categoryName) return '#f3f4f6';
        const category = categories.find(c => c.name === categoryName);
        return category?.drawColor || '#f3f4f6';
    };

    const getBackToBackTeamMatchKeys = () => {
        const conflictKeys = new Set(); // "matchId|teamIdentifier"
        if (!allMatches || allMatches.length === 0) return conflictKeys;  // ← zmena
    
        const getMatchTotalDuration = (categoryName) => {
            const category = categories.find(c => c.name === categoryName);
            if (!category) return 30 + 5;
            const periods = category.periods || 2;
            const periodDuration = category.periodDuration || 20;
            const breakDuration = category.breakDuration || 2;
            const matchBreak = category.matchBreak || 5;
            const matchDuration = (periodDuration + breakDuration) * periods - breakDuration;
            return matchDuration + matchBreak;
        };
    
        const K = 1;
    
        const matchesByDate = {};
        allMatches.forEach(match => {   // ← zmena
            if (!match.scheduledTime) return;
            let dateStr;
            try { dateStr = getLocalDateStr(match.scheduledTime.toDate()); } catch (e) { return; }
            if (!matchesByDate[dateStr]) matchesByDate[dateStr] = [];
            matchesByDate[dateStr].push(match);
        });
    
        Object.keys(matchesByDate).forEach(dateStr => {
            const teamMatchTimes = {};
            matchesByDate[dateStr].forEach(m => {
                if (!m.scheduledTime) return;
                const time = m.scheduledTime.toDate().getTime();
                const duration = getMatchTotalDuration(m.categoryName) * 60000;
                [m.homeTeamIdentifier, m.awayTeamIdentifier].forEach(team => {
                    if (!teamMatchTimes[team]) teamMatchTimes[team] = [];
                    teamMatchTimes[team].push({ time, duration, match: m });
                });
            });
    
            Object.keys(teamMatchTimes).forEach(team => {
                const times = teamMatchTimes[team].sort((a, b) => a.time - b.time);
                for (let i = 0; i < times.length - 1; i++) {
                    const current = times[i];
                    const next = times[i + 1];
                    const gapMinutes = (next.time - current.time) / 60000;
                    const maxGap = (current.duration / 60000) * K;
    
                    if (gapMinutes <= maxGap) {
                        conflictKeys.add(`${current.match.id}|${team}`);
                        conflictKeys.add(`${next.match.id}|${team}`);
                    }
                }
            });
        });
    
        return conflictKeys;
    };
    
    const backToBackTeamMatchKeys = getBackToBackTeamMatchKeys();

    return React.createElement(
        'div',
        {
            className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]',
            onClick: (e) => { if (e.target === e.currentTarget) onClose(); }
        },
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-2xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto' },
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mb-4' },
                React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, 'Priradiť zápas do voľného času'),
                React.createElement('button', { onClick: onClose, className: 'text-gray-500 hover:text-gray-700' }, React.createElement('i', { className: 'fa-solid fa-times text-xl' }))
            ),
            React.createElement(
                'div',
                { className: 'mb-4 p-3 bg-green-50 rounded-lg border border-green-200' },
                React.createElement(
                    'div',
                    { className: 'flex items-center justify-between flex-wrap gap-2' },
                    React.createElement('div', { className: 'flex items-center gap-2' }, React.createElement('span', { className: 'font-medium text-gray-700' }, 'Hala:'), React.createElement('span', { className: 'text-gray-800 font-semibold' }, hallName)),
                    React.createElement('div', { className: 'flex items-center gap-2' }, React.createElement('span', { className: 'font-medium text-gray-700' }, 'Dátum:'), React.createElement('span', { className: 'text-gray-800 font-semibold' }, formattedDate || 'Nezadaný dátum'))
                )
            ),
            React.createElement(
                'div',
                { className: 'mb-4 p-3 bg-green-50 rounded-lg border border-green-200' },
                React.createElement(
                    'div',
                    { className: 'flex items-center justify-between' },
                    React.createElement('div', null, React.createElement('p', { className: 'text-sm font-medium text-gray-700' }, 'Voľný čas:'), React.createElement('p', { className: 'text-sm' }, `${breakStartTime} - ${breakEndTime}`)),
                    React.createElement('span', { className: 'text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full' }, `${searchFilteredMatches.length} ${getMatchCountText(searchFilteredMatches.length)} k dispozícii`)
                )
            ),
            React.createElement(
                'div',
                { className: 'mb-4' },
                React.createElement(
                    'div',
                    { className: 'relative' },
                    React.createElement('i', { className: 'fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm' }),
                    React.createElement('input', {
                        type: 'text',
                        placeholder: 'Vyhľadať zápas... (napr. "A2=3", "A2=A3" alebo "A2")',
                        value: searchTerm,
                        onChange: (e) => setSearchTerm(e.target.value),
                        className: 'w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black'
                    })
                ),
                React.createElement(
                    'p',
                    { className: 'text-xs text-gray-400 mt-1 flex items-center gap-1' },
                    React.createElement('i', { className: 'fa-solid fa-info-circle' }),
                    'Môžete vyhľadávať podľa názvu tímu, ID tímu (A2), alebo pomocou formátu "A2=3" alebo "A2=A3" (znakom = oddeľte tímy). Pri formáte "A2=3" sa "3" automaticky doplní na "A3".'
                )
            ),
            searchFilteredMatches.length === 0 ? React.createElement(
                'div',
                { className: 'text-center py-8 text-gray-500' },
                React.createElement('i', { className: 'fa-solid fa-calendar-xmark text-4xl mb-3 opacity-30' }),
                React.createElement('p', null, 'Žiadne zápasy nie sú k dispozícii pre tento voľný čas')
            ) : React.createElement(
                'div',
                { className: 'space-y-2 max-h-96 overflow-y-auto' },
                searchFilteredMatches.map(match => {
                    const homeDisplay = getTeamDisplay(match.homeTeamIdentifier);
                    const awayDisplay = getTeamDisplay(match.awayTeamIdentifier);
                    const homeExtracted = extractLetterAndNumber(match.homeTeamIdentifier);
                    const awayExtracted = extractLetterAndNumber(match.awayTeamIdentifier);
                    const combinedNumbers = homeExtracted.number && awayExtracted.number 
                        ? homeExtracted.number + '-' + awayExtracted.number 
                        : (homeExtracted.number || awayExtracted.number || '');
                    const lettersAreSame = homeExtracted.letter && awayExtracted.letter && homeExtracted.letter === awayExtracted.letter;
                    const letterToShow = lettersAreSame ? homeExtracted.letter : '';
                    const categoryColor = getCategoryColor(match.categoryName);
                    const isSpecialMatch = (match.matchType && !match.isPlacementMatch) || match.isPlacementMatch === true;
                    let specialMatchText = '';
                    if (match.isPlacementMatch && match.placementRank) specialMatchText = `o ${match.placementRank}. miesto`;
                    else if (match.matchType && !match.isPlacementMatch) {
                        let matchTypeText = match.matchType;
                        const lastChar = matchTypeText.charAt(matchTypeText.length - 1);
                        if (lastChar >= 'A' && lastChar <= 'Z') matchTypeText = matchTypeText.substring(0, matchTypeText.length - 1).trim();
                        specialMatchText = matchTypeText;
                    }
                    let homeName = '', awayName = '';
                    if (displayMode === 'both' && typeof homeDisplay === 'object') {
                        homeName = homeDisplay.name;
                        awayName = awayDisplay.name;
                    } else if (displayMode === 'name') {
                        homeName = homeDisplay;
                        awayName = awayDisplay;
                    }
                    const matchDurationValue = getMatchDuration(match.categoryName);
                    return React.createElement(
                        'div',
                        {
                            key: match.id,
                            className: `p-3 rounded-lg border cursor-pointer transition-all ${
                                selectedMatchId === match.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                            }`,
                            onClick: () => setSelectedMatchId(match.id)
                        },
                        React.createElement(
                            'div',
                            { className: 'grid items-start text-xs', style: { gridTemplateColumns: displayMode === 'both' ? '200px 10px 200px 10px 50px 30px 60px' : '200px 200px 10px 50px 30px 60px', width: '100%' } },
                            React.createElement(
                                'div',
                                {
                                    className: 'px-2 py-1 flex items-center justify-center border-r border-gray-300',
                                    style: {
                                        textAlign: 'center',
                                        backgroundColor: backToBackTeamMatchKeys.has(`${match.id}|${match.homeTeamIdentifier}`) ? '#dc2626' : 'transparent',
                                    }
                                },
                                React.createElement(
                                    'span',
                                    {
                                        className: 'font-medium truncate block w-full',
                                        style: {
                                            color: '#000000',
                                            fontWeight: backToBackTeamMatchKeys.has(`${match.id}|${match.homeTeamIdentifier}`) ? 'bold' : undefined,
                                        },
                                        title: displayMode === 'both' ? homeName : homeDisplay
                                    },
                                    displayMode === 'both' ? homeName : homeDisplay
                                )
                            ),
                            React.createElement('div', { className: 'px-0 py-0 flex items-center justify-center border-r border-gray-300', style: { textAlign: 'center', backgroundColor: '#f3f4f6', width: '10px', height: '100%', fontSize: '9px', fontWeight: 'bold', color: '#000000' } }, React.createElement('span', null, '0')),
                            React.createElement(
                                'div',
                                {
                                    className: 'px-2 py-1 flex items-center justify-center border-r border-gray-300',
                                    style: {
                                        textAlign: 'center',
                                        backgroundColor: backToBackTeamMatchKeys.has(`${match.id}|${match.awayTeamIdentifier}`) ? '#dc2626' : 'transparent',
                                    }
                                },
                                React.createElement(
                                    'span',
                                    {
                                        className: 'font-medium truncate block w-full',
                                        style: {
                                            color: '#000000',
                                            fontWeight: backToBackTeamMatchKeys.has(`${match.id}|${match.awayTeamIdentifier}`) ? 'bold' : undefined,
                                        },
                                        title: displayMode === 'both' ? awayName : awayDisplay
                                    },
                                    displayMode === 'both' ? awayName : awayDisplay
                                )
                            ),
                            React.createElement('div', { className: 'px-0 py-0 flex items-center justify-center border-r border-gray-300', style: { textAlign: 'center', backgroundColor: '#f3f4f6', width: '10px', height: '100%', fontSize: '9px', fontWeight: 'bold', color: '#000000' } }, React.createElement('span', null, '0')),
                            !isSpecialMatch ? React.createElement(
                                React.Fragment,
                                null,
                                React.createElement('div', { className: 'px-2 py-1 flex items-center justify-center border-r border-gray-300', style: { textAlign: 'center', backgroundColor: 'transparent' } }, React.createElement('span', { className: 'text-black font-mono text-[10px] truncate block w-full' }, combinedNumbers)),
                                React.createElement('div', { className: 'px-2 py-1 flex items-center justify-center border-r border-gray-300', style: { textAlign: 'center', backgroundColor: categoryColor, fontWeight: 'bold', borderRadius: '4px' } }, React.createElement('span', { className: 'text-black font-bold text-xs truncate block w-full', style: { color: '#000', textShadow: 'none' } }, letterToShow || ''))
                            ) : React.createElement(
                                React.Fragment,
                                null,
                                React.createElement('div', { className: 'px-3 py-1 flex items-center justify-center', style: { textAlign: 'center', backgroundColor: categoryColor, fontWeight: 'bold', borderRadius: '4px', gridColumn: 'span 2', whiteSpace: 'nowrap', wordBreak: 'keep-all' } }, React.createElement('span', { className: 'text-black font-bold text-[10px] block w-full', style: { color: '#000', textShadow: 'none', whiteSpace: 'nowrap', wordBreak: 'keep-all' } }, specialMatchText))
                            ),
                            React.createElement('div', { className: 'px-2 py-1 flex items-center justify-center', style: { textAlign: 'center', whiteSpace: 'nowrap' } }, React.createElement('span', { className: 'text-gray-400 text-[10px] font-mono' }, `${matchDurationValue} min`))
                        )
                    );
                })
            ),
            React.createElement(
                'div',
                { className: 'flex justify-end gap-3 mt-6' },
                React.createElement('button', { onClick: onClose, className: 'px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors' }, 'Zrušiť'),
                React.createElement(
                    'button',
                    {
                        onClick: () => { if (selectedMatchId) { onConfirm(selectedMatchId); onClose(); } },
                        disabled: !selectedMatchId,
                        className: `px-4 py-2 text-white rounded-lg border-2 transition-colors ${
                            selectedMatchId ? 'bg-green-600 hover:bg-green-700 text-white border-green-600 cursor-pointer' : 'bg-white text-green-600 border-green-600 cursor-not-allowed opacity-70'
                        }`
                    },
                    'Priradiť zápas'
                )
            )
        )
    );
};

// ===== ASSIGN MATCH MODAL – ZJEDNODUŠENÝ =====
const AssignMatchModal = ({ isOpen, onClose, match, sportHalls, categories, onAssign, allMatches, displayMode, getTeamDisplayText, initialFilters, blockedBreaks, groupsByCategory = {} }) => {
    const [selectedHallId, setSelectedHallId] = useState('');
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedTime, setSelectedTime] = useState('');
    const [availableDates, setAvailableDates] = useState([]);
    const [categoryDetails, setCategoryDetails] = useState(null);
    const [matchDuration, setMatchDuration] = useState(0);
    const [matchEndTime, setMatchEndTime] = useState('');
    const [hallStartTime, setHallStartTime] = useState(null);
    const [timeError, setTimeError] = useState('');
    const [existingMatches, setExistingMatches] = useState([]);
    const [overlappingMatches, setOverlappingMatches] = useState([]);
    const [initialized, setInitialized] = useState(false);
    const [suggestedTime, setSuggestedTime] = useState(null);
    const [shouldSetDateFromFilter, setShouldSetDateFromFilter] = useState(false);
    const [loadingHallStartTime, setLoadingHallStartTime] = useState(false);

    const loadAvailableDates = () => {
        if (window.tournamentStartDate && window.tournamentEndDate) {
            const dates = [];
            const startDate = new Date(window.tournamentStartDate);
            const endDate = new Date(window.tournamentEndDate);
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(0, 0, 0, 0);
            const currentDate = new Date(startDate);
            while (currentDate <= endDate) {
                dates.push(new Date(currentDate));
                currentDate.setDate(currentDate.getDate() + 1);
            }
            setAvailableDates(dates);
            return true;
        }
        return false;
    };

    const getTeamNameByIdentifier = (identifier) => {
        if (!identifier) return 'Neznámy tím';
        const parts = identifier.split(' ');
        if (parts.length < 2) return identifier;
        const groupAndOrder = parts.pop();
        const category = parts.join(' ');
        let groupName = '', order = '';
        for (let i = 0; i < groupAndOrder.length; i++) {
            const char = groupAndOrder[i];
            if (char >= '0' && char <= '9') {
                order = groupAndOrder.substring(i);
                groupName = groupAndOrder.substring(0, i);
                break;
            }
        }
        if (!order) { order = '?'; groupName = groupAndOrder; }
        if (window.__teamManagerData?.allTeams) {
            const groupNameWithPrefix = `skupina ${groupName}`;
            const team = window.__teamManagerData.allTeams.find(t => 
                t.category === category && 
                (t.groupName === groupNameWithPrefix || t.groupName === groupName) &&
                t.order?.toString() === order
            );
            if (team) return team.teamName;
        }
        return `${category} ${groupName}${order}`;
    };

    const mergeIntervals = (intervals) => {
        if (!intervals || intervals.length === 0) return [];
        const sorted = [...intervals].sort((a, b) => a.start - b.start);
        const merged = [sorted[0]];
        for (let i = 1; i < sorted.length; i++) {
            const current = sorted[i];
            const lastMerged = merged[merged.length - 1];
            if (current.start <= lastMerged.end) {
                lastMerged.end = Math.max(lastMerged.end, current.end);
            } else {
                merged.push(current);
            }
        }
        return merged;
    };

    const isTimeSlotFreeInHall = (startMinutes, hallId, date, totalDuration, existingMatches) => {
        if (!hallId || !date) return true;
        const endMinutes = startMinutes + totalDuration;
        for (const match of existingMatches) {
            if (!match.scheduledTime) continue;
            const matchDate = match.scheduledTime.toDate();
            const matchDateStr = getLocalDateStr(matchDate);
            if (matchDateStr !== date) continue;
            const matchStartMinutes = matchDate.getHours() * 60 + matchDate.getMinutes();
            const matchCategory = categories.find(c => c.name === match.categoryName);
            let matchDuration = 0, matchBreak = 5;
            if (matchCategory) {
                const periods = matchCategory.periods || 2;
                const periodDuration = matchCategory.periodDuration || 20;
                const breakDuration = matchCategory.breakDuration || 2;
                matchDuration = (periodDuration + breakDuration) * periods - breakDuration;
                matchBreak = matchCategory.matchBreak || 5;
            }
            const matchEndWithBreak = matchStartMinutes + matchDuration + matchBreak;
            if (startMinutes < matchEndWithBreak && endMinutes > matchStartMinutes) return false;
        }
        return true;
    };

    const calculateFirstAvailableTime = (hallId, date, existingMatchesList, hallStartTimeStr, matchDur, blockedBreaks, allMatches, currentMatch, categories, groupsByCategory) => {
        if (!hallId || !date || !hallStartTimeStr || matchDur === 0) return null;
        const [startHours, startMinutes] = hallStartTimeStr.split(':').map(Number);
        const hallStartMinutes = startHours * 60 + startMinutes;
        const occupiedIntervals = [];
        const allMatchesForHallAndDay = allMatches.filter(m => 
            m.hallId === hallId && m.scheduledTime && m.id !== currentMatch?.id
        ).filter(m => {
            if (!m.scheduledTime) return false;
            const matchDate = m.scheduledTime.toDate();
            return getLocalDateStr(matchDate) === date;
        });
        allMatchesForHallAndDay.forEach(matchItem => {
            if (!matchItem.scheduledTime) return;
            const matchStart = matchItem.scheduledTime.toDate();
            const matchStartMinutes = matchStart.getHours() * 60 + matchStart.getMinutes();
            const matchCategory = categories.find(c => c.name === matchItem.categoryName);
            let matchDuration = 0, matchBreak = 5;
            if (matchCategory) {
                const periods = matchCategory.periods || 2;
                const periodDuration = matchCategory.periodDuration || 20;
                const breakDuration = matchCategory.breakDuration || 2;
                matchDuration = (periodDuration + breakDuration) * periods - breakDuration;
                matchBreak = matchCategory.matchBreak || 5;
            }
            const matchEndWithBreakMinutes = matchStartMinutes + matchDuration + matchBreak;
            occupiedIntervals.push({ start: matchStartMinutes, end: matchEndWithBreakMinutes, type: 'match', id: matchItem.id });
        });
        if (blockedBreaks) {
            Object.keys(blockedBreaks).forEach(key => {
                if (key.startsWith(`${hallId}_${date}_`)) {
                    const breakData = blockedBreaks[key];
                    if (breakData && breakData.startTime) {
                        const [breakHours, breakMinutes] = breakData.startTime.split(':').map(Number);
                        const breakStartMinutes = breakHours * 60 + breakMinutes;
                        const breakDuration = breakData.duration || matchDur;
                        const breakEndMinutes = breakStartMinutes + breakDuration;
                        occupiedIntervals.push({ start: breakStartMinutes, end: breakEndMinutes, type: 'blocked' });
                    }
                }
            });
        }
        const mergedIntervals = mergeIntervals(occupiedIntervals);
        const matchBreak = categories.find(c => c.name === currentMatch?.categoryName)?.matchBreak || 5;
        const totalDuration = matchDur + matchBreak;
        let candidateTime = hallStartMinutes;
        for (const interval of mergedIntervals) {
            if (candidateTime + totalDuration <= interval.start) {
                const hours = Math.floor(candidateTime / 60).toString().padStart(2, '0');
                const minutes = (candidateTime % 60).toString().padStart(2, '0');
                return `${hours}:${minutes}`;
            }
            candidateTime = Math.max(candidateTime, interval.end);
        }
        if (candidateTime + totalDuration <= 24 * 60) {
            const hours = Math.floor(candidateTime / 60).toString().padStart(2, '0');
            const minutes = (candidateTime % 60).toString().padStart(2, '0');
            return `${hours}:${minutes}`;
        }
        return null;
    };

    // ===== ZJEDNODUŠENÝ useEffect PRE SUGGESTED TIME =====
    useEffect(() => {
        if (selectedHallId && selectedDate && match && matchDuration > 0 && hallStartTime) {
            setSuggestedTime(null);
            const firstAvailable = calculateFirstAvailableTime(
                selectedHallId, selectedDate, existingMatches, hallStartTime,
                matchDuration, blockedBreaks, allMatches, match, categories, groupsByCategory
            );
            if (firstAvailable && firstAvailable !== '24:00') {
                setSuggestedTime(firstAvailable);
                if (timeError && !timeError.includes('nie je nastavený čas začiatku')) setTimeError('');
            } else {
                setSuggestedTime(null);
                if (!timeError || timeError.includes('voľný čas')) {
                    setTimeError('V tento deň nie je žiadny voľný čas pre tento zápas. Skúste iný deň alebo halu.');
                }
            }
        } else {
            setSuggestedTime(null);
        }
    }, [selectedHallId, selectedDate, hallStartTime, match, matchDuration, allMatches, categories, groupsByCategory, blockedBreaks, existingMatches]);

    useEffect(() => {
        if (isOpen && match && !initialized) {
            loadAvailableDates();
            if (match.hallId) setSelectedHallId(match.hallId);
            else if (initialFilters?.hallId) setSelectedHallId(initialFilters.hallId);
            else if (window.__pendingAssignFilters?.hallId) {
                setSelectedHallId(window.__pendingAssignFilters.hallId);
                delete window.__pendingAssignFilters;
            }
            if (match.scheduledTime) {
                try {
                    const date = match.scheduledTime.toDate();
                    const year = date.getFullYear();
                    const month = (date.getMonth() + 1).toString().padStart(2, '0');
                    const day = date.getDate().toString().padStart(2, '0');
                    setSelectedDate(`${year}-${month}-${day}`);
                    const hours = date.getHours().toString().padStart(2, '0');
                    const minutes = date.getMinutes().toString().padStart(2, '0');
                    setSelectedTime(`${hours}:${minutes}`);
                } catch (e) { console.error('Chyba pri parsovaní dátumu zápasu:', e); }
            } else if (initialFilters?.day) {
                const dateExists = availableDates.some(date => getLocalDateStr(date) === initialFilters.day);
                if (dateExists) setSelectedDate(initialFilters.day);
                else if (availableDates.length === 0) setShouldSetDateFromFilter(true);
            } else if (window.__pendingAssignFilters?.day) {
                const dateExists = availableDates.some(date => getLocalDateStr(date) === window.__pendingAssignFilters.day);
                if (dateExists) {
                    setSelectedDate(window.__pendingAssignFilters.day);
                    if (window.__pendingAssignFilters) delete window.__pendingAssignFilters;
                } else if (availableDates.length === 0) setShouldSetDateFromFilter(true);
            }
            if (!selectedTime && window.__pendingAssignFilters?.startTime) {
                setSelectedTime(window.__pendingAssignFilters.startTime);
                delete window.__pendingAssignFilters;
            }
            setInitialized(true);
        }
        if (!isOpen) {
            setInitialized(false);
            setSelectedHallId('');
            setSelectedDate('');
            setSelectedTime('');
            setHallStartTime(null);
            setTimeError('');
            setExistingMatches([]);
            setOverlappingMatches([]);
            setSuggestedTime(null);
            setShouldSetDateFromFilter(false);
            setAvailableDates([]);
            if (window.__pendingAssignFilters) delete window.__pendingAssignFilters;
        }
    }, [isOpen, match, initialFilters]);

    useEffect(() => {
        if (shouldSetDateFromFilter && availableDates.length > 0 && initialFilters?.day && !selectedDate) {
            const dateExists = availableDates.some(date => getLocalDateStr(date) === initialFilters.day);
            if (dateExists) { setSelectedDate(initialFilters.day); setShouldSetDateFromFilter(false); }
        }
    }, [availableDates, shouldSetDateFromFilter, initialFilters, selectedDate]);

    useEffect(() => {
        if (match && categories.length > 0) {
            const category = categories.find(c => c.name === match.categoryName);
            setCategoryDetails(category);
            if (category) {
                const periods = category.periods || 2;
                const periodDuration = category.periodDuration || 20;
                const breakDuration = category.breakDuration || 2;
                setMatchDuration((periodDuration + breakDuration) * periods - breakDuration);
            }
        }
    }, [match, categories]);

    useEffect(() => {
        const loadExistingMatches = async () => {
            if (selectedHallId && selectedDate && allMatches) {
                try {
                    const matchesForHallAndDay = allMatches.filter(m => 
                        m.hallId === selectedHallId && m.scheduledTime && m.id !== match?.id
                    ).filter(m => getLocalDateStr(m.scheduledTime.toDate()) === selectedDate);
                    setExistingMatches(matchesForHallAndDay);
                } catch (error) { console.error('Chyba pri načítaní existujúcich zápasov:', error); }
            } else setExistingMatches([]);
        };
        loadExistingMatches();
    }, [selectedHallId, selectedDate, match?.id, allMatches]);

    useEffect(() => {
        const loadHallStartTime = async () => {
            if (selectedHallId && selectedDate && window.db) {
                setLoadingHallStartTime(true);
                try {
                    const scheduleId = `${selectedHallId}_${selectedDate}`;
                    const scheduleRef = doc(window.db, 'hallSchedules', scheduleId);
                    const scheduleSnap = await getDoc(scheduleRef);
                    let startTime = null;
                    if (scheduleSnap.exists()) {
                        startTime = scheduleSnap.data().startTime;
                        setHallStartTime(startTime);
                        if (selectedTime) {
                            const [hours, minutes] = selectedTime.split(':').map(Number);
                            const [startHours, startMinutes] = startTime.split(':').map(Number);
                            if (hours * 60 + minutes < startHours * 60 + startMinutes) {
                                setTimeError(`Čas začiatku zápasu nemôže byť skôr ako ${startTime} (čas začiatku prvého zápasu v tejto hale)`);
                            } else if (timeError && timeError.includes('nie je nastavený čas začiatku')) setTimeError('');
                        } else if (timeError && timeError.includes('nie je nastavený čas začiatku')) setTimeError('');
                    } else {
                        setHallStartTime(null);
                        setTimeError('Pre tento deň nie je nastavený čas začiatku. Najprv ho nastavte kliknutím na hlavičku dňa.');
                    }
                    if (!selectedTime && startTime && matchDuration > 0 && categoryDetails) {
                        const firstAvailable = calculateFirstAvailableTime(
                            selectedHallId, selectedDate, existingMatches, startTime,
                            matchDuration, blockedBreaks, allMatches, match, categories, groupsByCategory
                        );
                        if (firstAvailable && firstAvailable !== '24:00') {
                            setSuggestedTime(firstAvailable);
                            if (timeError && !timeError.includes('nie je nastavený čas začiatku')) setTimeError('');
                        } else {
                            if (!timeError || timeError.includes('voľný čas')) {
                                setTimeError('V tento deň nie je žiadny voľný čas pre tento zápas. Skúste iný deň alebo halu.');
                            }
                            setSuggestedTime(null);
                        }
                    } else setSuggestedTime(null);
                } catch (error) {
                    console.error('Chyba pri načítaní času začiatku haly:', error);
                    setHallStartTime(null);
                } finally { setLoadingHallStartTime(false); }
            } else { setHallStartTime(null); setTimeError(''); setLoadingHallStartTime(false); }
        };
        loadHallStartTime();
    }, [selectedHallId, selectedDate, matchDuration, categoryDetails, existingMatches, selectedTime, allMatches, blockedBreaks, match, categories, groupsByCategory]);

    // ===== ZJEDNODUŠENÁ KONTROLA KOLÍZIÍ – LEN ČASOVÉ PREKRYTIE V HALE =====
    useEffect(() => {
        if (selectedTime && matchDuration > 0 && match) {
            const [newHours, newMinutes] = selectedTime.split(':').map(Number);
            const newStartMinutes = newHours * 60 + newMinutes;
            const newCategory = categories.find(c => c.name === match?.categoryName);
            const newMatchBreak = newCategory?.matchBreak || 5;
            const newEndMinutes = newStartMinutes + matchDuration + newMatchBreak;
            const overlapping = existingMatches.filter(existingMatch => {
                if (!existingMatch.scheduledTime) return false;
                const existingDate = existingMatch.scheduledTime.toDate();
                const existingHours = existingDate.getHours();
                const existingMinutes = existingDate.getMinutes();
                const existingStartMinutes = existingHours * 60 + existingMinutes;
                const existingCategory = categories.find(c => c.name === existingMatch.categoryName);
                let existingDuration = 0, existingMatchBreak = 5;
                if (existingCategory) {
                    const periods = existingCategory.periods || 2;
                    const periodDuration = existingCategory.periodDuration || 20;
                    const breakDuration = existingCategory.breakDuration || 2;
                    existingDuration = (periodDuration + breakDuration) * periods - breakDuration;
                    existingMatchBreak = existingCategory.matchBreak || 5;
                }
                const existingEndMinutes = existingStartMinutes + existingDuration + existingMatchBreak;
                return (newStartMinutes < existingEndMinutes && newEndMinutes > existingStartMinutes);
            });
            setOverlappingMatches(overlapping);
            if (overlapping.length > 0) {
                setSuggestedTime(null);
                setTimeError(`Časový konflikt s ${overlapping.length} ${overlapping.length === 1 ? 'zápasom' : 'zápasmi'} v tejto hale`);
            } else {
                if (timeError && !timeError.includes('nie je nastavený čas začiatku') && !timeError.includes('žiadny voľný čas')) setTimeError('');
            }
        } else setOverlappingMatches([]);
    }, [selectedTime, matchDuration, existingMatches, categories, match?.categoryName, match]);

    const formatTimeFromMinutes = (minutes) => {
        const hours = Math.floor(minutes / 60).toString().padStart(2, '0');
        const mins = (minutes % 60).toString().padStart(2, '0');
        return `${hours}:${mins}`;
    };

    useEffect(() => {
        if (selectedDate && selectedTime && matchDuration > 0) {
            const [hours, minutes] = selectedTime.split(':').map(Number);
            const [year, month, day] = selectedDate.split('-').map(Number);
            const startDateTime = new Date(year, month - 1, day, hours, minutes, 0);
            const endDateTime = new Date(startDateTime.getTime() + matchDuration * 60000);
            setMatchEndTime(`${endDateTime.getHours().toString().padStart(2, '0')}:${endDateTime.getMinutes().toString().padStart(2, '0')}`);
        } else {
            setMatchEndTime('');
            if (!loadingHallStartTime && selectedHallId && selectedDate && hallStartTime === null) {
                setTimeError('Pre tento deň nie je nastavený čas začiatku. Najprv ho nastavte kliknutím na hlavičku dňa.');
            }
        }
    }, [selectedDate, selectedTime, matchDuration, hallStartTime, loadingHallStartTime, selectedHallId]);

    const handleApplySuggestedTime = () => { if (suggestedTime) setSelectedTime(suggestedTime); };
    const getLocalDateFromStrLocal = (dateStr) => { if (!dateStr) return null; const [year, month, day] = dateStr.split('-').map(Number); return new Date(year, month - 1, day); };

    if (!isOpen || !match) return null;

    const hasError = timeError || overlappingMatches.length > 0;
    const canSave = selectedHallId && selectedDate && selectedTime && !hasError;

    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[90]', onClick: (e) => { if (e.target === e.currentTarget) onClose(); } },
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-2xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto' },
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mb-4' },
                React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, match.hallId ? 'Upraviť priradenie zápasu' : 'Priradiť zápas do haly'),
                React.createElement('button', { onClick: onClose, className: 'text-gray-500 hover:text-gray-700' }, React.createElement('i', { className: 'fa-solid fa-times text-xl' }))
            ),
            React.createElement(
                'div',
                { className: 'mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200' },
                React.createElement('h4', { className: 'font-semibold text-gray-700 mb-2' }, 'Zápas:'),
                React.createElement(
                    'div',
                    { className: 'flex items-center justify-between' },
                    React.createElement(
                        'div',
                        { className: 'flex-1' },
                        match && match.homeTeamIdentifier && displayMode === 'both' && typeof getTeamDisplayText(match.homeTeamIdentifier) === 'object'
                            ? React.createElement('div', { className: 'flex flex-col items-start' }, React.createElement('span', { className: 'font-semibold text-sm text-gray-800' }, getTeamDisplayText(match.homeTeamIdentifier).name), React.createElement('span', { className: 'text-xs text-gray-500' }, `(${getTeamDisplayText(match.homeTeamIdentifier).id})`))
                            : React.createElement('p', { className: 'text-sm text-gray-600' }, displayMode === 'name' ? getTeamDisplayText(match.homeTeamIdentifier) : match.homeTeamIdentifier)
                    ),
                    React.createElement('i', { className: 'fa-solid fa-vs text-xs text-gray-400 mx-2' }),
                    React.createElement(
                        'div',
                        { className: 'flex-1 text-right' },
                        displayMode === 'both' && typeof getTeamDisplayText(match.awayTeamIdentifier) === 'object'
                            ? React.createElement('div', { className: 'flex flex-col items-end' }, React.createElement('span', { className: 'font-semibold text-sm text-gray-800' }, getTeamDisplayText(match.awayTeamIdentifier).name), React.createElement('span', { className: 'text-xs text-gray-500' }, `(${getTeamDisplayText(match.awayTeamIdentifier).id})`))
                            : React.createElement('p', { className: 'text-sm text-gray-600' }, displayMode === 'name' ? getTeamDisplayText(match.awayTeamIdentifier) : match.awayTeamIdentifier)
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'mt-2 text-xs text-gray-500' },
                    React.createElement('span', { className: 'font-medium' }, 'Kategória: '),
                    match.categoryName,
                    match.groupName && React.createElement('span', null, ` (${match.groupName})`)
                ),
                categoryDetails && React.createElement(
                    'div',
                    { className: 'mt-3 p-2 bg-white rounded border border-blue-100' },
                    React.createElement(
                        'div',
                        { className: 'flex items-center gap-2 text-sm' },
                        React.createElement('i', { className: 'fa-solid fa-clock text-blue-600' }),
                        React.createElement('span', { className: 'font-medium text-gray-700' }, 'Dĺžka zápasu:'),
                        React.createElement('span', { className: 'text-blue-600 font-semibold' }, `${matchDuration} minút`),
                        React.createElement('span', { className: 'text-xs text-gray-500 ml-2' }, `(+ ${categoryDetails.matchBreak || 5} min prestávka po zápase)`)
                    )
                )
            ),
            React.createElement(
                'div',
                { className: 'space-y-4' },
                React.createElement(
                    'div',
                    null,
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Športová hala:'),
                    React.createElement(
                        'select',
                        {
                            value: selectedHallId,
                            onChange: (e) => { setSelectedHallId(e.target.value); setSelectedTime(''); setSuggestedTime(null); setTimeError(''); },
                            className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black'
                        },
                        React.createElement('option', { value: '' }, '-- Vyberte športovú halu --'),
                        [...sportHalls].sort((a, b) => a.name.localeCompare(b.name)).map(hall => 
                            React.createElement('option', { key: hall.id, value: hall.id }, hall.name)
                        )
                    )
                ),
                React.createElement(
                    'div',
                    null,
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Deň konania:'),
                    React.createElement(
                        'select',
                        {
                            value: selectedDate,
                            onChange: (e) => { setSelectedDate(e.target.value); setSelectedTime(''); setSuggestedTime(null); setTimeError(''); },
                            className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black',
                            disabled: availableDates.length === 0
                        },
                        React.createElement('option', { value: '' }, '-- Vyberte deň --'),
                        availableDates.map((date, index) => {
                            const dateStr = getLocalDateStr(date);
                            return React.createElement('option', { key: index, value: dateStr }, formatDateWithDay(date));
                        })
                    ),
                    availableDates.length === 0 && React.createElement('p', { className: 'text-xs text-red-500 mt-1' }, 'Nie sú nastavené dátumy turnaja')
                ),
                selectedHallId && selectedDate && hallStartTime && React.createElement(
                    'div',
                    { className: 'text-sm bg-blue-50 p-2 rounded-lg border border-blue-200' },
                    React.createElement('i', { className: 'fa-regular fa-clock text-blue-600 mr-1' }),
                    React.createElement('span', { className: 'font-medium text-blue-700' }, 'Čas začiatku prvého zápasu v tejto hale: '),
                    React.createElement('span', { className: 'font-bold text-blue-800' }, hallStartTime)
                ),
                existingMatches.length > 0 && React.createElement(
                    'div',
                    { className: 'text-sm bg-gray-50 p-3 rounded-lg border border-gray-200' },
                    React.createElement(
                        'div',
                        { className: 'flex items-center gap-2 mb-2 text-gray-700' },
                        React.createElement('i', { className: 'fa-solid fa-calendar-check text-gray-500' }),
                        React.createElement('span', { className: 'font-medium' }, 'Existujúce zápasy v tento deň (vrátane prestávok):')
                    ),
                    React.createElement(
                        'div',
                        { className: 'space-y-1 max-h-32 overflow-y-auto text-xs' },
                        existingMatches.sort((a, b) => a.scheduledTime.toDate().getTime() - b.scheduledTime.toDate().getTime()).map((em, idx) => {
                            const startTime = em.scheduledTime.toDate();
                            const hours = startTime.getHours().toString().padStart(2, '0');
                            const minutes = startTime.getMinutes().toString().padStart(2, '0');
                            const emCategory = categories.find(c => c.name === em.categoryName);
                            let emDuration = 0, emMatchBreak = 5;
                            if (emCategory) {
                                const periods = emCategory.periods || 2;
                                const periodDuration = emCategory.periodDuration || 20;
                                const breakDuration = emCategory.breakDuration || 2;
                                emDuration = (periodDuration + breakDuration) * periods - breakDuration;
                                emMatchBreak = emCategory.matchBreak || 5;
                            }
                            const endTimeWithBreak = new Date(startTime.getTime() + (emDuration + emMatchBreak) * 60000);
                            const endHours = endTimeWithBreak.getHours().toString().padStart(2, '0');
                            const endMinutes = endTimeWithBreak.getMinutes().toString().padStart(2, '0');
                            const isOverlapping = overlappingMatches.some(om => om.id === em.id);
                            return React.createElement(
                                'div',
                                { key: idx, className: `flex items-center gap-2 p-1 rounded border ${isOverlapping ? 'bg-red-50 border-red-300' : 'bg-white border-gray-100'}` },
                                React.createElement('span', { className: 'text-gray-500 font-mono' }, `${hours}:${minutes} - ${endHours}:${endMinutes}`),
                                React.createElement('span', { className: isOverlapping ? 'text-red-700 font-medium' : 'text-gray-700' }, em.homeTeamIdentifier),
                                React.createElement('i', { className: 'fa-solid fa-vs text-xs text-gray-400' }),
                                React.createElement('span', { className: isOverlapping ? 'text-red-700 font-medium' : 'text-gray-700' }, em.awayTeamIdentifier),
                                isOverlapping && React.createElement('span', { className: 'text-xs text-red-500 ml-auto' }, React.createElement('i', { className: 'fa-solid fa-circle-exclamation mr-1' }), 'konflikt')
                            );
                        })
                    )
                ),
                React.createElement(
                    'div',
                    null,
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Čas začiatku:'),
                    React.createElement('div', { className: 'flex gap-2' },
                        React.createElement('input', {
                            type: 'time',
                            value: selectedTime,
                            onChange: (e) => {
                                const newTime = e.target.value;
                                setSelectedTime(newTime);
                                if (newTime && hallStartTime) {
                                    const [hours, minutes] = newTime.split(':').map(Number);
                                    const [startHours, startMinutes] = hallStartTime.split(':').map(Number);
                                    if (hours * 60 + minutes < startHours * 60 + startMinutes) {
                                        setTimeError(`Čas začiatku zápasu nemôže byť skôr ako ${hallStartTime} (čas začiatku prvého zápasu v tejto hale)`);
                                    } else setTimeError('');
                                } else setTimeError('');
                            },
                            className: `flex-1 px-3 py-2 border ${hasError ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black`,
                            step: '60',
                            min: hallStartTime || undefined
                        }),
                        suggestedTime && !selectedTime && !timeError && React.createElement(
                            'button',
                            { onClick: handleApplySuggestedTime, className: 'px-3 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors text-sm font-medium whitespace-nowrap flex items-center gap-1' },
                            React.createElement('i', { className: 'fa-regular fa-clock' }),
                            'Použiť ' + suggestedTime
                        )
                    ),
                    timeError && React.createElement('p', { className: 'text-xs text-red-500 mt-1 flex items-center gap-1' }, React.createElement('i', { className: 'fa-solid fa-exclamation-triangle' }), timeError),
                    overlappingMatches.length > 0 && React.createElement(
                        'div',
                        { className: 'mt-3 p-3 bg-red-50 border border-red-200 rounded-lg' },
                        React.createElement('p', { className: 'text-xs text-red-600 font-medium mb-2 flex items-center gap-1' }, React.createElement('i', { className: 'fa-solid fa-circle-exclamation' }), `Časový konflikt s ${overlappingMatches.length} ${overlappingMatches.length === 1 ? 'zápasom' : 'zápasmi'} (vrátane prestávok):`),
                        React.createElement(
                            'div',
                            { className: 'space-y-2 max-h-40 overflow-y-auto' },
                            overlappingMatches.sort((a, b) => a.scheduledTime.toDate().getTime() - b.scheduledTime.toDate().getTime()).map((om, idx) => {
                                if (!om.scheduledTime) return null;
                                const startTime = om.scheduledTime.toDate();
                                const hours = startTime.getHours().toString().padStart(2, '0');
                                const minutes = startTime.getMinutes().toString().padStart(2, '0');
                                const omCategory = categories.find(c => c.name === om.categoryName);
                                let omDuration = 0, omMatchBreak = 5;
                                if (omCategory) {
                                    const periods = omCategory.periods || 2;
                                    const periodDuration = omCategory.periodDuration || 20;
                                    const breakDuration = omCategory.breakDuration || 2;
                                    omDuration = (periodDuration + breakDuration) * periods - breakDuration;
                                    omMatchBreak = omCategory.matchBreak || 5;
                                }
                                const endTimeWithBreak = new Date(startTime.getTime() + (omDuration + omMatchBreak) * 60000);
                                const endHours = endTimeWithBreak.getHours().toString().padStart(2, '0');
                                const endMinutes = endTimeWithBreak.getMinutes().toString().padStart(2, '0');
                                return React.createElement(
                                    'div',
                                    { key: idx, className: 'flex items-center justify-between p-2 bg-white rounded border border-red-100 text-sm' },
                                    React.createElement('div', { className: 'flex items-center gap-2' }, React.createElement('i', { className: 'fa-solid fa-clock text-red-400 text-xs' }), React.createElement('span', { className: 'font-mono text-red-600 font-medium' }, `${hours}:${minutes} - ${endHours}:${endMinutes}`)),
                                    React.createElement('div', { className: 'flex items-center gap-2 flex-1 ml-3' }, React.createElement('span', { className: 'text-red-700' }, om.homeTeamIdentifier), React.createElement('i', { className: 'fa-solid fa-vs text-xs text-red-300' }), React.createElement('span', { className: 'text-red-700' }, om.awayTeamIdentifier))
                                );
                            })
                        )
                    ),
                    matchEndTime && !hasError && React.createElement('p', { className: 'text-xs text-green-600 mt-1' }, React.createElement('i', { className: 'fa-regular fa-circle-check mr-1' }), `Zápas skončí o ${matchEndTime} (následná ${categoryDetails?.matchBreak || 5} min prestávka)`)
                ),
                selectedHallId && selectedDate && selectedTime && !hasError && React.createElement(
                    'div',
                    { className: 'mt-4 p-3 bg-green-50 border border-green-200 rounded-lg' },
                    React.createElement('div', { className: 'flex items-center gap-2 text-green-700' }, React.createElement('i', { className: 'fa-solid fa-check-circle' }), React.createElement('span', { className: 'font-medium' }, 'Zápas bude priradený:')),
                    React.createElement(
                        'div',
                        { className: 'mt-2 text-sm text-gray-600' },
                        React.createElement('p', null, React.createElement('span', { className: 'font-medium' }, 'Hala: '), sportHalls.find(h => h.id === selectedHallId)?.name),
                        React.createElement('p', null, React.createElement('span', { className: 'font-medium' }, 'Dátum: '), (() => { const date = getLocalDateFromStrLocal(selectedDate); return date ? formatDateWithDay(date) : 'neplatný dátum'; })()),
                        React.createElement('p', null, React.createElement('span', { className: 'font-medium' }, 'Čas: '), `${selectedTime} - ${matchEndTime} (${matchDuration} min + ${categoryDetails?.matchBreak || 5} min prestávka)`)
                    )
                )
            ),
            React.createElement(
                'div',
                { className: 'flex justify-end gap-3 mt-6' },
                React.createElement('button', { onClick: onClose, className: 'px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors' }, 'Zrušiť'),
                React.createElement(
                    'button',
                    {
                        onClick: () => { if (canSave) { onAssign({ matchId: match.id, hallId: selectedHallId, date: selectedDate, time: selectedTime, endTime: matchEndTime, duration: matchDuration }); onClose(); } },
                        disabled: !canSave,
                        className: `px-4 py-2 text-white rounded-lg transition-colors border-2 ${
                            canSave ? 'bg-green-600 hover:bg-green-700 text-white border-green-600 cursor-pointer' : 'bg-white text-green-600 border-green-600 cursor-not-allowed opacity-70'
                        }`
                    },
                    match.hallId ? 'Upraviť priradenie' : 'Priradiť zápas'
                )
            )
        )
    );
};

// ===== HALL DAY START TIME MODAL =====
const HallDayStartTimeModal = ({ isOpen, onClose, onConfirm, hallName, date, currentStartTime }) => {
    const [startTime, setStartTime] = useState(currentStartTime || '08:00');

    useEffect(() => { if (isOpen) setStartTime(currentStartTime || '08:00'); }, [isOpen, currentStartTime]);

    if (!isOpen) return null;

    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]', onClick: (e) => { if (e.target === e.currentTarget) onClose(); } },
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4' },
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mb-4' },
                React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, currentStartTime ? 'Upraviť čas začiatku' : 'Nastavenie času začiatku'),
                React.createElement('button', { onClick: onClose, className: 'text-gray-500 hover:text-gray-700' }, React.createElement('i', { className: 'fa-solid fa-times text-xl' }))
            ),
            React.createElement(
                'div',
                { className: 'mb-6' },
                React.createElement('p', { className: 'text-gray-700 mb-4' }, React.createElement('span', { className: 'font-semibold' }, hallName), ' - ', React.createElement('span', { className: 'font-semibold' }, (() => { const [year, month, day] = date.split('-').map(Number); return formatDateWithDay(new Date(year, month - 1, day)); })())),
                React.createElement(
                    'div',
                    null,
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Čas začiatku prvého zápasu:'),
                    React.createElement('input', { type: 'time', value: startTime, onChange: (e) => setStartTime(e.target.value), className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black', step: '60' })
                )
            ),
            React.createElement(
                'div',
                { className: 'flex justify-end gap-3' },
                React.createElement('button', { onClick: onClose, className: 'px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors' }, 'Zrušiť'),
                React.createElement('button', { onClick: () => { onConfirm(startTime); onClose(); }, className: 'px-4 py-2 text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors' }, currentStartTime ? 'Upraviť' : 'Uložiť')
            )
        )
    );
};

// ===== GENERATION MODAL – zjednodušený, bez carryOver =====
const GenerationModal = ({ isOpen, onClose, onConfirm, categories, groupsByCategory }) => {
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedGroup, setSelectedGroup] = useState('');
    const [withRepetitions, setWithRepetitions] = useState(false);
    const [availableGroups, setAvailableGroups] = useState([]);
    const [selectedGroupType, setSelectedGroupType] = useState('');
    const [hasDuplicateTeamNames, setHasDuplicateTeamNames] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setSelectedCategory('');
            setSelectedGroup('');
            setWithRepetitions(false);
            setAvailableGroups([]);
            setSelectedGroupType('');
            setHasDuplicateTeamNames(false);
        }
    }, [isOpen]);

    const sortedCategories = React.useMemo(() => [...categories].sort((a, b) => a.name.localeCompare(b.name)), [categories]);

    const checkForDuplicateTeamNames = (categoryId) => {
        if (!categoryId || !window.__teamManagerData?.allTeams) return false;
        const category = categories.find(c => c.id === categoryId);
        if (!category) return false;
        const teamsInCategory = window.__teamManagerData.allTeams.filter(t => t.category === category.name);
        const normalizeTeamName = (name) => name ? name.replace(/\s+/g, '').toLowerCase() : '';
        const normalizedTeamNames = teamsInCategory.map(t => normalizeTeamName(t.teamName));
        return normalizedTeamNames.length !== new Set(normalizedTeamNames).size;
    };

    useEffect(() => {
        if (selectedCategory && groupsByCategory[selectedCategory]) {
            const sortedGroups = [...groupsByCategory[selectedCategory]].sort((a, b) => a.name.localeCompare(b.name));
            setAvailableGroups(sortedGroups);
            setSelectedGroup('');
            setSelectedGroupType('');
            setHasDuplicateTeamNames(checkForDuplicateTeamNames(selectedCategory));
        } else {
            setAvailableGroups([]);
            setSelectedGroup('');
            setSelectedGroupType('');
            setHasDuplicateTeamNames(false);
        }
    }, [selectedCategory, groupsByCategory, categories]);

    useEffect(() => {
        if (selectedGroup && availableGroups.length > 0) {
            const group = availableGroups.find(g => g.name === selectedGroup);
            if (group) {
                if (group.type === 'základná skupina') setSelectedGroupType('Základná skupina');
                else if (group.type === 'nadstavbová skupina') setSelectedGroupType('Nadstavbová skupina');
                else setSelectedGroupType('');
            } else setSelectedGroupType('');
        } else setSelectedGroupType('');
    }, [selectedGroup, availableGroups, selectedCategory, categories]);

    if (!isOpen) return null;

    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50', onClick: (e) => { if (e.target === e.currentTarget) onClose(); } },
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4' },
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mb-4' },
                React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, 'Generovať zápasy'),
                React.createElement('button', { onClick: onClose, className: 'text-gray-500 hover:text-gray-700' }, React.createElement('i', { className: 'fa-solid fa-times text-xl' }))
            ),
            React.createElement(
                'div',
                { className: 'mb-4' },
                React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Kategória:'),
                React.createElement(
                    'select',
                    { value: selectedCategory, onChange: (e) => { setSelectedCategory(e.target.value); setSelectedGroup(''); setSelectedGroupType(''); }, className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black' },
                    React.createElement('option', { value: '' }, '-- Vyberte kategóriu --'),
                    sortedCategories.map(cat => React.createElement('option', { key: cat.id, value: cat.id }, cat.name))
                )
            ),
            selectedCategory && hasDuplicateTeamNames && React.createElement(
                'div',
                { className: 'mb-6 p-4 bg-red-50 border-2 border-red-400 rounded-lg' },
                React.createElement('div', { className: 'flex items-start gap-3' }, React.createElement('i', { className: 'fa-solid fa-triangle-exclamation text-red-600 text-xl mt-0.5 flex-shrink-0' }), React.createElement('div', null, React.createElement('h4', { className: 'font-bold text-red-700 text-base' }, 'Duplicitné názvy tímov'), React.createElement('p', { className: 'text-sm text-red-600 mt-1' }, 'Vo vybranej kategórii sa nachádzajú tímy s duplicitným názvom. Zápasy nie je možné vygenerovať, kým nebudú názvy tímov unikátne.'), React.createElement('p', { className: 'text-xs text-red-500 mt-1' }, 'Prosím, opravte duplicitné názvy tímov v časti "Registrácie" a skúste znova.')))
            ),
            selectedCategory && !hasDuplicateTeamNames && React.createElement(
                'div',
                { className: 'mb-4' },
                React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Skupina:'),
                React.createElement(
                    'select',
                    { value: selectedGroup, onChange: (e) => setSelectedGroup(e.target.value), className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black' },
                    React.createElement('option', { value: '' }, '-- Všetky skupiny --'),
                    availableGroups.map((group, index) => React.createElement('option', { key: index, value: group.name }, group.name))
                ),
                selectedGroup && selectedGroupType && React.createElement(
                    'div',
                    { className: 'mt-2 text-sm' },
                    React.createElement('span', { className: `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${selectedGroupType === 'Základná skupina' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'}` }, React.createElement('i', { className: `fa-solid ${selectedGroupType === 'Základná skupina' ? 'fa-layer-group' : 'fa-chart-line'} mr-1 text-xs` }), selectedGroupType)
                )
            ),
            selectedCategory && !hasDuplicateTeamNames && !withRepetitions && React.createElement('p', { className: 'text-xs text-gray-500 mt-1 ml-6' }, 'Vygenerujú sa jedinečné dvojice, každý tím sa stretne s každým práve raz.'),
            React.createElement(
                'div',
                { className: 'flex justify-end gap-3 mt-2' },
                React.createElement('button', { onClick: onClose, className: 'px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors' }, 'Zrušiť'),
                React.createElement(
                    'button',
                    {
                        onClick: () => { onConfirm({ categoryId: selectedCategory, groupName: selectedGroup || null, withRepetitions, transferFromBasicGroup: false }); onClose(); },
                        disabled: !selectedCategory || hasDuplicateTeamNames,
                        className: `px-4 py-2 text-white rounded-lg transition-colors ${selectedCategory && !hasDuplicateTeamNames ? 'bg-green-600 hover:bg-green-700 text-white cursor-pointer' : 'bg-white border-2 border-green-600 text-green-600 cursor-not-allowed'}`
                    },
                    'Generovať'
                )
            )
        )
    );
};

// ===== ADD BREAK MODAL =====
const AddBreakModal = ({ isOpen, onClose, onConfirm, match, hallName, date, currentTime, nextMatchTime, matchBreak, matchDuration }) => {
    const [breakPosition, setBreakPosition] = useState('before');
    const [breakDuration, setBreakDuration] = useState(5);
    const [multiplier, setMultiplier] = useState(1);
    const [durationError, setDurationError] = useState('');
    const [multiplierError, setMultiplierError] = useState('');

    useEffect(() => {
        if (isOpen && matchDuration && matchDuration > 0) {
            setBreakDuration(matchDuration + (matchBreak || 5));
        }
    }, [isOpen, matchDuration, matchBreak]);

    const handleDurationChange = (e) => {
        const value = parseInt(e.target.value);
        if (e.target.value === '') { setBreakDuration(0); setDurationError('Zadajte dĺžku medzery'); return; }
        if (isNaN(value)) { setDurationError('Zadajte platné číslo'); return; }
        if (value < 1) setDurationError('Minimálna dĺžka je 1 minúta');
        else if (value > 180) setDurationError('Maximálna dĺžka je 180 minút (3 hodiny)');
        else setDurationError('');
        setBreakDuration(value);
    };

    const handleMultiplierChange = (e) => {
        const value = parseInt(e.target.value);
        if (e.target.value === '') { setMultiplier(1); setMultiplierError('Zadajte počet opakovaní'); return; }
        if (isNaN(value)) { setMultiplierError('Zadajte platné číslo'); return; }
        if (value < 1) setMultiplierError('Minimálny počet je 1');
        else if (value > 20) setMultiplierError('Maximálny počet je 20');
        else setMultiplierError('');
        setMultiplier(value);
    };

    useEffect(() => {
        if (!isOpen) { setBreakPosition('before'); setBreakDuration(5); setMultiplier(1); setDurationError(''); setMultiplierError(''); }
    }, [isOpen]);

    if (!isOpen || !match) return null;

    const totalDuration = breakDuration * multiplier;
    const isValid = breakDuration > 0 && multiplier >= 1 && !durationError && !multiplierError;
    const hasNextMatch = nextMatchTime && nextMatchTime !== '';

    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[95]', onClick: (e) => { if (e.target === e.currentTarget) onClose(); } },
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4' },
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mb-4' },
                React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, 'Pridať medzeru'),
                React.createElement('button', { onClick: onClose, className: 'text-gray-500 hover:text-gray-700' }, React.createElement('i', { className: 'fa-solid fa-times text-xl' }))
            ),
            React.createElement(
                'div',
                { className: 'mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200' },
                React.createElement('p', { className: 'text-sm font-medium text-gray-700' }, 'Zápas:'),
                React.createElement('p', { className: 'text-sm' }, `${match.homeTeamIdentifier} vs ${match.awayTeamIdentifier}`),
                React.createElement('p', { className: 'text-xs text-gray-500 mt-1' }, `Aktuálny čas: ${currentTime}`),
                hasNextMatch && React.createElement('p', { className: 'text-xs text-blue-600 mt-1' }, React.createElement('i', { className: 'fa-solid fa-arrow-right mr-1' }), `Nasledujúci zápas začína o: ${nextMatchTime}`)
            ),
            hasNextMatch && React.createElement(
                'div',
                { className: 'mb-4 p-3 bg-green-50 rounded-lg border border-green-200' },
                React.createElement('div', { className: 'flex items-start gap-2' }, React.createElement('i', { className: 'fa-solid fa-info-circle text-green-600 mt-0.5' }), React.createElement('div', { className: 'text-sm text-green-700' }, React.createElement('p', { className: 'font-medium' }, 'Voľný čas medzi zápasmi'), React.createElement('p', { className: 'text-xs mt-1' }, (() => { const [ch, cm] = currentTime.split(':').map(Number); const [nh, nm] = nextMatchTime.split(':').map(Number); return `Voľný čas: ${(nh * 60 + nm) - (ch * 60 + cm)} minút`; })())))
            ),
            React.createElement(
                'div',
                { className: 'mb-4' },
                React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-2' }, 'Pridať medzeru:'),
                React.createElement(
                    'div',
                    { className: 'flex gap-4' },
                    React.createElement('label', { className: 'flex items-center gap-2 cursor-pointer' }, React.createElement('input', { type: 'radio', name: 'breakPosition', value: 'before', checked: breakPosition === 'before', onChange: (e) => setBreakPosition(e.target.value), className: 'w-4 h-4 text-blue-600' }), React.createElement('span', { className: 'text-gray-700' }, 'Pred zápasom')),
                    React.createElement('label', { className: 'flex items-center gap-2 cursor-pointer' }, React.createElement('input', { type: 'radio', name: 'breakPosition', value: 'after', checked: breakPosition === 'after', onChange: (e) => setBreakPosition(e.target.value), className: 'w-4 h-4 text-blue-600' }), React.createElement('span', { className: 'text-gray-700' }, 'Za zápasom'))
                )
            ),
            React.createElement(
                'div',
                { className: 'mb-4' },
                React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Dĺžka medzery (minúty):'),
                React.createElement('input', { type: 'number', value: breakDuration, onChange: handleDurationChange, min: '1', max: '180', step: '1', className: `w-full px-3 py-2 border ${durationError ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black`, placeholder: 'Zadajte počet minút' }),
                durationError && React.createElement('p', { className: 'text-xs text-red-500 mt-1 flex items-center gap-1' }, React.createElement('i', { className: 'fa-solid fa-exclamation-triangle' }), durationError),
                React.createElement('p', { className: 'text-xs text-gray-500 mt-1' }, matchDuration > 0 && matchBreak > 0 ? `Predvolená hodnota: ${matchDuration} min (zápas) + ${matchBreak} min (prestávka) = ${matchDuration + matchBreak} min` : 'Rozsah: 1 - 180 minút')
            ),
            React.createElement(
                'div',
                { className: 'mb-4' },
                React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Koľkokrát sa má hodnota pridať:'),
                React.createElement('input', { type: 'number', value: multiplier, onChange: handleMultiplierChange, min: '1', max: '20', step: '1', className: `w-full px-3 py-2 border ${multiplierError ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black`, placeholder: 'Zadajte počet opakovaní' }),
                multiplierError && React.createElement('p', { className: 'text-xs text-red-500 mt-1 flex items-center gap-1' }, React.createElement('i', { className: 'fa-solid fa-exclamation-triangle' }), multiplierError),
                React.createElement('p', { className: 'text-xs text-gray-500 mt-1' }, 'Rozsah: 1 - 20 opakovaní')
            ),
            isValid && React.createElement(
                'div',
                { className: 'mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200' },
                React.createElement('div', { className: 'flex items-center gap-2 text-sm text-blue-700' }, React.createElement('i', { className: 'fa-solid fa-calculator' }), React.createElement('span', { className: 'font-medium' }, 'Výsledná medzera:'), React.createElement('span', { className: 'font-bold' }, `${totalDuration} minút`), React.createElement('span', { className: 'text-xs text-blue-600' }, `(${breakDuration} min × ${multiplier})`))
            ),
            React.createElement(
                'div',
                { className: 'flex justify-end gap-3' },
                React.createElement('button', { onClick: onClose, className: 'px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors' }, 'Zrušiť'),
                React.createElement('button', { onClick: () => { onConfirm({ matchId: match.id, position: breakPosition, duration: totalDuration }); onClose(); }, disabled: !isValid, className: `px-4 py-2 text-white rounded-lg transition-colors ${isValid ? 'bg-green-600 hover:bg-green-700 cursor-pointer' : 'bg-gray-400 cursor-not-allowed'}` }, 'Pridať medzeru')
            )
        )
    );
};

// ===== HLAVNÁ APLIKÁCIA =====
const AddMatchesApp = ({ userProfileData }) => {
    const [selectedCategoriesFilter, setSelectedCategoriesFilter] = useState([]);
    const [sportHalls, setSportHalls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [categories, setCategories] = useState([]);
    const [matches, setMatches] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [pendingGeneration, setPendingGeneration] = useState(null);
    const [groupsByCategory, setGroupsByCategory] = useState({});
    const [teamData, setTeamData] = useState({ allTeams: [] });
    const [showTeamId, setShowTeamId] = useState(false);
    const [usersWithMatches, setUsersWithMatches] = useState([]);

    const [isExistingMatchModalOpen, setIsExistingMatchModalOpen] = useState(false);
    const [currentExistingMatch, setCurrentExistingMatch] = useState(null);
    const [pendingMatches, setPendingMatches] = useState([]);
    const [generationInProgress, setGenerationInProgress] = useState(false);
    const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
    const [existingMatchesToProcess, setExistingMatchesToProcess] = useState([]);
    const [newMatches, setNewMatches] = useState([]);
    const [currentCategoryInfo, setCurrentCategoryInfo] = useState(null);

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
    const [selectedMatchForAction, setSelectedMatchForAction] = useState(null);

    const [isDeleteMatchesModalOpen, setIsDeleteMatchesModalOpen] = useState(false);
    const [isBulkDeleteConfirmModalOpen, setIsBulkDeleteConfirmModalOpen] = useState(false);
    const [pendingBulkDelete, setPendingBulkDelete] = useState(null);

    const [isHallDayModalOpen, setIsHallDayModalOpen] = useState(false);
    const [selectedHallForDay, setSelectedHallForDay] = useState(null);
    const [selectedDateForHall, setSelectedDateForHall] = useState(null);
    const [selectedDateStrForHall, setSelectedDateStrForHall] = useState('');
    const [hallSchedules, setHallSchedules] = useState({});
    const [selectedCurrentStartTime, setSelectedCurrentStartTime] = useState(null);

    const [availableGroupsForFilter, setAvailableGroupsForFilter] = useState([]);
    const [availableDays, setAvailableDays] = useState([]);

    const [isBulkUnassignModalOpen, setIsBulkUnassignModalOpen] = useState(false);
    const [pendingBulkUnassign, setPendingBulkUnassign] = useState(null);

    const [isBreakModalOpen, setIsBreakModalOpen] = useState(false);
    const [selectedMatchForBreak, setSelectedMatchForBreak] = useState(null);
    const [selectedMatchCurrentTime, setSelectedMatchCurrentTime] = useState('');
    const [selectedBreakForDelete, setSelectedBreakForDelete] = useState(null);
    const [selectedMatchNextTime, setSelectedMatchNextTime] = useState('');

    const [isAssignToBreakModalOpen, setIsAssignToBreakModalOpen] = useState(false);
    const [selectedBreakForAssign, setSelectedBreakForAssign] = useState(null);

    const [blockedBreaks, setBlockedBreaks] = useState({});

    const [selectedTeamIdFilter, setSelectedTeamIdFilter] = useState('');

    const [isGenerationTypeModalOpen, setIsGenerationTypeModalOpen] = useState(false);
    const [isPlacementMatchModalOpen, setIsPlacementMatchModalOpen] = useState(false);

    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');
    const [selectedGroupFilter, setSelectedGroupFilter] = useState('');
    const [selectedHallFilter, setSelectedHallFilter] = useState('');
    const [selectedDayFilter, setSelectedDayFilter] = useState('');

    const [accommodations, setAccommodations] = useState([]);
    const [teamAccommodations, setTeamAccommodations] = useState(new Map());

    const [isSwapMatchesModalOpen, setIsSwapMatchesModalOpen] = useState(false);
    const [pendingSwap, setPendingSwap] = useState(null);

    const [dayCardsHeights, setDayCardsHeights] = useState({});
    const [maxDayCardHeight, setMaxDayCardHeight] = useState(0);
    const [maxHeightsByDate, setMaxHeightsByDate] = useState({});
    const [heightsCalculated, setHeightsCalculated] = useState(false);
    const [hasCompletedMatch, setHasCompletedMatch] = useState(false);

    const isFilterActive = selectedCategoriesFilter.length > 0 || selectedGroupFilter || selectedHallFilter || selectedDayFilter || selectedTeamIdFilter;
    const [hasVisibleHalls, setHasVisibleHalls] = useState(false);

    const [isPinned, setIsPinned] = useState(() => localStorage.getItem('filtersPanelPinned') === 'true');

    const MultiSelectDropdown = ({ options, selectedValues, onToggle, label, getOptionLabel, getOptionCount }) => {
        const [isOpen, setIsOpen] = useState(false);
        const dropdownRef = useRef(null);

        useEffect(() => {
            const handleClickOutside = (event) => { if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false); };
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }, []);

        const selectedCount = selectedValues.length;
        const displayText = selectedCount === 0 ? label : selectedCount === 1 ? getOptionLabel(selectedValues[0]) : `${selectedCount} kategórie`;

        return React.createElement(
            'div',
            { className: 'relative', ref: dropdownRef },
            React.createElement(
                'button',
                { className: `px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-black min-w-[180px] flex items-center justify-between bg-white hover:bg-gray-50 transition-colors ${selectedCount > 0 ? 'border-blue-500 bg-blue-50' : ''}`, onClick: () => setIsOpen(!isOpen) },
                React.createElement('span', { className: 'truncate' }, displayText),
                React.createElement('i', { className: `fa-solid fa-chevron-${isOpen ? 'up' : 'down'} text-xs text-gray-400 ml-2 flex-shrink-0` })
            ),
            isOpen && React.createElement(
                'div',
                { className: 'absolute top-full left-0 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-gray-300 rounded-lg shadow-lg z-[60]' },
                options.map(option => {
                    const isSelected = selectedValues.includes(option.id);
                    const count = getOptionCount ? getOptionCount(option.id) : 0;
                    return React.createElement(
                        'div',
                        { key: option.id, className: `px-3 py-2 cursor-pointer hover:bg-blue-50 transition-colors flex items-center justify-between ${isSelected ? 'bg-blue-100' : ''}`, onClick: () => onToggle(option.id) },
                        React.createElement('span', { className: 'text-sm text-gray-700' }, option.name),
                        React.createElement('span', { className: 'flex items-center gap-2' }, count > 0 && React.createElement('span', { className: 'text-xs text-gray-400' }, `(${count})`), isSelected && React.createElement('i', { className: 'fa-solid fa-check text-blue-600 text-sm' }))
                    );
                })
            )
        );
    };

    const measureDayCardsHeights = () => {
        setTimeout(() => {
            const dayCards = document.querySelectorAll('.day-card-measure');
            const newHeights = {};
            const heightsByDate = {};
            dayCards.forEach((card) => {
                const height = card.offsetHeight;
                const cardId = card.getAttribute('data-card-id');
                const dateKey = card.getAttribute('data-date-key');
                if (cardId && dateKey) {
                    newHeights[cardId] = height;
                    if (!heightsByDate[dateKey]) heightsByDate[dateKey] = [];
                    heightsByDate[dateKey].push(height);
                }
            });
            const maxHeights = {};
            Object.keys(heightsByDate).forEach(dateKey => { maxHeights[dateKey] = Math.max(...heightsByDate[dateKey]); });
            setDayCardsHeights(newHeights);
            setMaxHeightsByDate(maxHeights);
            setHeightsCalculated(true);
        }, 150);
    };

    const handleSwapMatches = async ({ sourceHallId, sourceDate, targetHallId, targetDate, isWholeHall, swapMatches, swapSchedules }) => {
        if (!window.db) { window.showGlobalNotification('Databáza nie je inicializovaná', 'error'); return; }
        if (userProfileData?.role !== 'admin') { window.showGlobalNotification('Na výmenu zápasov potrebujete administrátorské práva', 'error'); return; }
        try {
            let swappedCount = 0;
            const sourceMatches = matches.filter(match => {
                if (!match.hallId || match.hallId !== sourceHallId) return false;
                if (!isWholeHall && match.scheduledTime) {
                    try { return getLocalDateStr(match.scheduledTime.toDate()) === sourceDate; } catch (e) { return false; }
                }
                return true;
            });
            const targetMatches = matches.filter(match => {
                if (!match.hallId || match.hallId !== targetHallId) return false;
                if (!isWholeHall && match.scheduledTime) {
                    try { return getLocalDateStr(match.scheduledTime.toDate()) === targetDate; } catch (e) { return false; }
                }
                return true;
            });
            if (swapMatches) {
                for (const match of sourceMatches) {
                    const matchRef = doc(window.db, 'matches', match.id);
                    const updateData = { hallId: targetHallId };
                    if (!isWholeHall && targetDate && match.scheduledTime) {
                        const oldDate = match.scheduledTime.toDate();
                        const [year, month, day] = targetDate.split('-').map(Number);
                        updateData.scheduledTime = Timestamp.fromDate(new Date(year, month - 1, day, oldDate.getHours(), oldDate.getMinutes(), 0));
                    }
                    await updateDoc(matchRef, updateData);
                    swappedCount++;
                }
                for (const match of targetMatches) {
                    const matchRef = doc(window.db, 'matches', match.id);
                    const updateData = { hallId: sourceHallId };
                    if (!isWholeHall && sourceDate && match.scheduledTime) {
                        const oldDate = match.scheduledTime.toDate();
                        const [year, month, day] = sourceDate.split('-').map(Number);
                        updateData.scheduledTime = Timestamp.fromDate(new Date(year, month - 1, day, oldDate.getHours(), oldDate.getMinutes(), 0));
                    }
                    await updateDoc(matchRef, updateData);
                    swappedCount++;
                }
            }
            if (swapSchedules) {
                const sourceScheduleId = `${sourceHallId}_${!isWholeHall ? sourceDate : ''}`;
                const targetScheduleId = `${targetHallId}_${!isWholeHall ? targetDate : ''}`;
                const sourceScheduleRef = doc(window.db, 'hallSchedules', sourceScheduleId);
                const targetScheduleRef = doc(window.db, 'hallSchedules', targetScheduleId);
                const [sourceScheduleSnap, targetScheduleSnap] = await Promise.all([getDoc(sourceScheduleRef), getDoc(targetScheduleRef)]);
                const sourceScheduleData = sourceScheduleSnap.exists() ? sourceScheduleSnap.data() : null;
                const targetScheduleData = targetScheduleSnap.exists() ? targetScheduleSnap.data() : null;
                if (sourceScheduleData) await setDoc(targetScheduleRef, { ...sourceScheduleData, hallId: targetHallId, date: !isWholeHall ? targetDate : '', updatedAt: Timestamp.now() }, { merge: true });
                else if (targetScheduleData && !isWholeHall) await deleteDoc(targetScheduleRef);
                if (targetScheduleData) await setDoc(sourceScheduleRef, { ...targetScheduleData, hallId: sourceHallId, date: !isWholeHall ? sourceDate : '', updatedAt: Timestamp.now() }, { merge: true });
                else if (sourceScheduleData && !isWholeHall) await deleteDoc(sourceScheduleRef);
            }
            const message = isWholeHall
                ? `Vymenilo sa ${swappedCount} zápasov medzi halou ${sportHalls.find(h => h.id === sourceHallId)?.name} a halou ${sportHalls.find(h => h.id === targetHallId)?.name}`
                : `Vymenilo sa ${swappedCount} zápasov medzi dňami ${sourceDate} a ${targetDate}`;
            window.showGlobalNotification(message, 'success');
            setTimeout(() => { window.dispatchEvent(new CustomEvent('refreshMatches')); }, 500);
        } catch (error) {
            console.error('Chyba pri výmene zápasov:', error);
            window.showGlobalNotification('Chyba pri výmene: ' + error.message, 'error');
        }
    };

    const getAllUniqueTeamIds = () => {
        const teamIds = new Set();
        matches.forEach(match => { teamIds.add(match.homeTeamIdentifier); teamIds.add(match.awayTeamIdentifier); });
        return Array.from(teamIds).sort((a, b) => a.localeCompare(b));
    };

    const savePlacementMatch = async (matchData) => {
        if (!window.db) { window.showGlobalNotification('Databáza nie je inicializovaná', 'error'); return; }
        if (userProfileData?.role !== 'admin') { window.showGlobalNotification('Na vytvorenie zápasu potrebujete administrátorské práva', 'error'); return; }
        if (!userProfileData?.approved) { window.showGlobalNotification('Váš účet ešte nebol schválený administrátorom.', 'error'); return; }
        try {
            const matchesRef = collection(window.db, 'matches');
            const matchToSave = {
                homeTeamIdentifier: matchData.homeTeamIdentifier,
                awayTeamIdentifier: matchData.awayTeamIdentifier,
                time: '--:--',
                hallId: null,
                categoryId: matchData.categoryId,
                categoryName: matchData.categoryName,
                groupName: matchData.groupName,
                status: 'pending',
                isPlacementMatch: true,
                placementRank: matchData.placementRank,
                matchTitle: matchData.matchTitle,
                createdAt: Timestamp.now(),
                createdByUid: userProfileData?.uid || null
            };
            await addDoc(matchesRef, matchToSave);
            window.showGlobalNotification(`Zápas o ${matchData.placementRank}. miesto bol úspešne vytvorený`, 'success');
        } catch (error) {
            console.error('Chyba pri ukladaní zápasu o umiestnenie:', error);
            window.showGlobalNotification('Chyba pri ukladaní zápasu: ' + error.message, 'error');
        }
    };

    const getBackToBackTeamMatchKeys = () => {
        const conflictKeys = new Set(); // "matchId|teamIdentifier"
        if (!matches || matches.length === 0) return conflictKeys;
    
        const getMatchTotalDuration = (categoryName) => {
            const category = categories.find(c => c.name === categoryName);
            if (!category) return 30 + 5;
            const periods = category.periods || 2;
            const periodDuration = category.periodDuration || 20;
            const breakDuration = category.breakDuration || 2;
            const matchBreak = category.matchBreak || 5;
            const matchDuration = (periodDuration + breakDuration) * periods - breakDuration;
            return matchDuration + matchBreak;
        };
    
        const K = 1;
    
        const matchesByDate = {};
        matches.forEach(match => {
            if (!match.scheduledTime) return;
            let dateStr;
            try { dateStr = getLocalDateStr(match.scheduledTime.toDate()); } catch (e) { return; }
            if (!matchesByDate[dateStr]) matchesByDate[dateStr] = [];
            matchesByDate[dateStr].push(match);
        });
    
        Object.keys(matchesByDate).forEach(dateStr => {
            const teamMatchTimes = {};
            matchesByDate[dateStr].forEach(m => {
                if (!m.scheduledTime) return;
                const time = m.scheduledTime.toDate().getTime();
                const duration = getMatchTotalDuration(m.categoryName) * 60000;
                [m.homeTeamIdentifier, m.awayTeamIdentifier].forEach(team => {
                    if (!teamMatchTimes[team]) teamMatchTimes[team] = [];
                    teamMatchTimes[team].push({ time, duration, match: m });
                });
            });
    
            Object.keys(teamMatchTimes).forEach(team => {
                const times = teamMatchTimes[team].sort((a, b) => a.time - b.time);
                for (let i = 0; i < times.length - 1; i++) {
                    const current = times[i];
                    const next = times[i + 1];
                    const gapMinutes = (next.time - current.time) / 60000;
                    const maxGap = (current.duration / 60000) * K;
    
                    if (gapMinutes <= maxGap) {
                        conflictKeys.add(`${current.match.id}|${team}`);
                        conflictKeys.add(`${next.match.id}|${team}`);
                    }
                }
            });
        });
    
        return conflictKeys;
    };
    
    const backToBackTeamMatchKeys = getBackToBackTeamMatchKeys();
    
    const getFilteredMatches = (matchesToFilter, ignoreHallFilter = false, ignoreDayFilter = false) => {
        return matchesToFilter.filter(match => {
            if (selectedCategoriesFilter.length > 0 && !selectedCategoriesFilter.includes(match.categoryId)) return false;
            if (selectedGroupFilter && match.groupName !== selectedGroupFilter) return false;
            if (selectedTeamIdFilter) {
                if (match.homeTeamIdentifier !== selectedTeamIdFilter && match.awayTeamIdentifier !== selectedTeamIdFilter) return false;
            }
            if (!ignoreHallFilter && selectedHallFilter && match.hallId !== selectedHallFilter) return false;
            if (!ignoreDayFilter && selectedDayFilter) {
                if (!match.scheduledTime) return false;
                try { return getLocalDateStr(match.scheduledTime.toDate()) === selectedDayFilter; } catch (e) { return false; }
            }
            return true;
        });
    };

    const toggleBlockBreak = (hallId, dateStr, breakStartTime, breakEndTime, breakDuration) => {
        const breakKey = `${hallId}_${dateStr}_${breakStartTime}`;
        setBlockedBreaks(prev => {
            const newBlockedBreaks = { ...prev };
            if (newBlockedBreaks[breakKey]) delete newBlockedBreaks[breakKey];
            else newBlockedBreaks[breakKey] = { startTime: breakStartTime, endTime: breakEndTime, duration: breakDuration };
            return newBlockedBreaks;
        });
    };

    const isBreakBlocked = (hallId, dateStr, breakStartTime) => !!blockedBreaks[`${hallId}_${dateStr}_${breakStartTime}`];

    const handleAssignMatchToBreak = async ({ matchId, breakStartTime, breakDuration, hallId, date }) => {
        if (!window.db) { window.showGlobalNotification('Databáza nie je inicializovaná', 'error'); return; }
        if (userProfileData?.role !== 'admin') { window.showGlobalNotification('Na priradenie zápasu potrebujete administrátorské práva', 'error'); return; }
        try {
            const match = matches.find(m => m.id === matchId);
            if (!match) return;
            const category = categories.find(c => c.name === match.categoryName);
            let matchDuration = 0;
            if (category) {
                const periods = category.periods || 2;
                const periodDuration = category.periodDuration || 20;
                const breakDuration = category.breakDuration || 2;
                matchDuration = (periodDuration + breakDuration) * periods - breakDuration;
            }
            const [year, month, day] = date.split('-').map(Number);
            const [breakHours, breakMinutes] = breakStartTime.split(':').map(Number);
            const matchDateTime = new Date(year, month - 1, day, breakHours, breakMinutes, 0);
            const matchRef = doc(window.db, 'matches', matchId);
            await updateDoc(matchRef, { hallId: hallId, scheduledTime: Timestamp.fromDate(matchDateTime), status: 'scheduled' });
            let message = `Zápas bol priradený do voľného času o ${breakStartTime}`;
            if (matchDuration === breakDuration) message += '. Voľný čas bol úplne vyplnený.';
            else if (matchDuration < breakDuration) message += `. Zostáva ${breakDuration - matchDuration} minút voľného času.`;
            window.showGlobalNotification(message, 'success');
        } catch (error) {
            console.error('Chyba pri priradení zápasu do voľného času:', error);
            window.showGlobalNotification('Chyba: ' + error.message, 'error');
        }
    };

    const handleDeleteBreakBefore = async ({ matchId, breakDuration }) => {
        if (!window.db) { window.showGlobalNotification('Databáza nie je inicializovaná', 'error'); return; }
        if (userProfileData?.role !== 'admin') { window.showGlobalNotification('Na úpravu rozvrhu potrebujete administrátorské práva', 'error'); return; }
        try {
            const match = matches.find(m => m.id === matchId);
            if (!match || !match.scheduledTime) return;
            let firstMatchBreak = 5;
            const firstMatchCategory = categories.find(c => c.name === match.categoryName);
            if (firstMatchCategory) firstMatchBreak = firstMatchCategory.matchBreak || 5;
            const totalShift = breakDuration + firstMatchBreak;
            const matchDate = match.scheduledTime.toDate();
            const dateStr = getLocalDateStr(matchDate);
            const hallDayMatches = matches.filter(m => m.hallId === match.hallId && m.scheduledTime).map(m => ({ ...m, scheduledTimeObj: m.scheduledTime.toDate() })).filter(m => getLocalDateStr(m.scheduledTimeObj) === dateStr).sort((a, b) => a.scheduledTimeObj.getTime() - b.scheduledTimeObj.getTime());
            const firstMatch = hallDayMatches[0];
            if (!firstMatch || firstMatch.id !== matchId) { window.showGlobalNotification('Tento zápas nie je prvým zápasom dňa', 'error'); return; }
            for (const m of hallDayMatches) {
                const mRef = doc(window.db, 'matches', m.id);
                const mDateTime = new Date(m.scheduledTimeObj);
                mDateTime.setMinutes(mDateTime.getMinutes() - totalShift);
                await updateDoc(mRef, { scheduledTime: Timestamp.fromDate(mDateTime) });
            }
            window.showGlobalNotification(`Medzera ${breakDuration} minút bola odstránená. Všetky zápasy boli posunuté o ${totalShift} minút SKÔR (vrátane prestávky).`, 'success');
        } catch (error) {
            console.error('Chyba pri odstraňovaní medzery pred prvým zápasom:', error);
            window.showGlobalNotification('Chyba: ' + error.message, 'error');
        }
    };

    const handleDeleteBreak = async ({ matchId, nextMatchId, breakDuration }) => {
        if (!window.db) { window.showGlobalNotification('Databáza nie je inicializovaná', 'error'); return; }
        if (userProfileData?.role !== 'admin') { window.showGlobalNotification('Na úpravu rozvrhu potrebujete administrátorské práva', 'error'); return; }
        try {
            const currentMatch = matches.find(m => m.id === matchId);
            const nextMatch = matches.find(m => m.id === nextMatchId);
            if (!currentMatch || !nextMatch || !currentMatch.scheduledTime || !nextMatch.scheduledTime) return;
            let currentMatchBreak = 5;
            const currentMatchCategory = categories.find(c => c.name === currentMatch.categoryName);
            if (currentMatchCategory) currentMatchBreak = currentMatchCategory.matchBreak || 5;
            const totalShift = breakDuration + currentMatchBreak;
            const matchDate = currentMatch.scheduledTime.toDate();
            const dateStr = getLocalDateStr(matchDate);
            const hallDayMatches = matches.filter(m => m.hallId === currentMatch.hallId && m.scheduledTime).map(m => ({ ...m, scheduledTimeObj: m.scheduledTime.toDate() })).filter(m => getLocalDateStr(m.scheduledTimeObj) === dateStr).sort((a, b) => a.scheduledTimeObj.getTime() - b.scheduledTimeObj.getTime());
            const currentIndex = hallDayMatches.findIndex(m => m.id === matchId);
            const afterMatches = hallDayMatches.slice(currentIndex + 1);
            for (const m of afterMatches) {
                const mRef = doc(window.db, 'matches', m.id);
                const mDateTime = new Date(m.scheduledTimeObj);
                mDateTime.setMinutes(mDateTime.getMinutes() - totalShift);
                await updateDoc(mRef, { scheduledTime: Timestamp.fromDate(mDateTime) });
            }
            window.showGlobalNotification(`Medzera ${breakDuration} minút bola odstránená. Nasledujúce zápasy boli posunuté o ${totalShift} minút skôr (vrátane prestávky).`, 'success');
        } catch (error) {
            console.error('Chyba pri odstraňovaní medzery:', error);
            window.showGlobalNotification('Chyba: ' + error.message, 'error');
        }
    };

    const handleAddBreak = async ({ matchId, position, duration, newTime }) => {
        if (!window.db) { window.showGlobalNotification('Databáza nie je inicializovaná', 'error'); return; }
        if (userProfileData?.role !== 'admin') { window.showGlobalNotification('Na úpravu rozvrhu potrebujete administrátorské práva', 'error'); return; }
        try {
            const match = matches.find(m => m.id === matchId);
            if (!match || !match.scheduledTime) return;
            const matchDate = match.scheduledTime.toDate();
            const dateStr = getLocalDateStr(matchDate);
            const hallDayMatches = matches.filter(m => m.hallId === match.hallId && m.scheduledTime).map(m => ({ ...m, scheduledTimeObj: m.scheduledTime.toDate() })).filter(m => getLocalDateStr(m.scheduledTimeObj) === dateStr).sort((a, b) => a.scheduledTimeObj.getTime() - b.scheduledTimeObj.getTime());
            const currentIndex = hallDayMatches.findIndex(m => m.id === matchId);
            const afterMatches = hallDayMatches.slice(currentIndex + 1);
            if (position === 'before') {
                const matchRef = doc(window.db, 'matches', matchId);
                const newDateTime = new Date(matchDate);
                newDateTime.setMinutes(newDateTime.getMinutes() + duration);
                await updateDoc(matchRef, { scheduledTime: Timestamp.fromDate(newDateTime) });
                for (const m of afterMatches) {
                    const mRef = doc(window.db, 'matches', m.id);
                    const mDateTime = new Date(m.scheduledTimeObj);
                    mDateTime.setMinutes(mDateTime.getMinutes() + duration);
                    await updateDoc(mRef, { scheduledTime: Timestamp.fromDate(mDateTime) });
                }
                window.showGlobalNotification(`Pridaná ${duration} minútová medzera pred zápasom. Aktuálny a ${afterMatches.length} nasledujúcich zápasov bolo posunutých dopredu.`, 'success');
            } else {
                for (const m of afterMatches) {
                    const mRef = doc(window.db, 'matches', m.id);
                    const mDateTime = new Date(m.scheduledTimeObj);
                    mDateTime.setMinutes(mDateTime.getMinutes() + duration);
                    await updateDoc(mRef, { scheduledTime: Timestamp.fromDate(mDateTime) });
                }
                window.showGlobalNotification(`Pridaná ${duration} minútová medzera za zápasom. ${afterMatches.length} nasledujúcich zápasov bolo posunutých dopredu.`, 'success');
            }
        } catch (error) {
            console.error('Chyba pri pridávaní medzery:', error);
            window.showGlobalNotification('Chyba: ' + error.message, 'error');
        }
    };

    const handleBulkUnassign = async (hallId, date, isWholeHall = false) => {
        if (!window.db) { window.showGlobalNotification('Databáza nie je inicializovaná', 'error'); return; }
        if (userProfileData?.role !== 'admin') { window.showGlobalNotification('Na odstraňovanie priradení potrebujete administrátorské práva', 'error'); return; }
        try {
            const matchesToUpdate = matches.filter(match => {
                if (!match.hallId || match.hallId !== hallId) return false;
                if (!isWholeHall && date) {
                    if (!match.scheduledTime) return false;
                    try { return getLocalDateStr(match.scheduledTime.toDate()) === date; } catch (e) { return false; }
                }
                return true;
            });
            if (matchesToUpdate.length === 0) { window.showGlobalNotification('Žiadne zápasy na odstránenie', 'info'); return; }
            const hall = sportHalls.find(h => h.id === hallId);
            setPendingBulkUnassign({
                hallId,
                hallName: hall?.name || 'Neznáma hala',
                date,
                dateStr: date ? new Date(date).toLocaleDateString('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '',
                matchesCount: matchesToUpdate.length,
                isWholeHall
            });
            setIsBulkUnassignModalOpen(true);
        } catch (error) {
            console.error('Chyba pri príprave hromadného odstránenia:', error);
            window.showGlobalNotification('Chyba: ' + error.message, 'error');
        }
    };

    const confirmBulkUnassign = async () => {
        if (!pendingBulkUnassign || !window.db) return;
        try {
            const { hallId, date, isWholeHall } = pendingBulkUnassign;
            const matchesToUpdate = matches.filter(match => {
                if (!match.hallId || match.hallId !== hallId) return false;
                if (!isWholeHall && date) {
                    if (!match.scheduledTime) return false;
                    try { return getLocalDateStr(match.scheduledTime.toDate()) === date; } catch (e) { return false; }
                }
                return true;
            });
            for (const match of matchesToUpdate) {
                const matchRef = doc(window.db, 'matches', match.id);
                await updateDoc(matchRef, { hallId: null, scheduledTime: null, scheduledEndTime: null, duration: null, status: 'pending' });
            }
            const message = isWholeHall
                ? `Odstránené priradenie všetkých ${matchesToUpdate.length} zápasov z haly ${pendingBulkUnassign.hallName}`
                : `Odstránené priradenie ${matchesToUpdate.length} zápasov z dňa ${pendingBulkUnassign.dateStr}`;
            window.showGlobalNotification(message, 'success');
        } catch (error) {
            console.error('Chyba pri hromadnom odstraňovaní priradení:', error);
            window.showGlobalNotification('Chyba: ' + error.message, 'error');
        }
    };

    const loadFiltersFromURL = () => {
        const params = new URLSearchParams(window.location.search);
        const categoryNames = params.getAll('category') || [];
        const groupName = params.get('group') || '';
        const teamId = params.get('teamId') || '';
        const hallName = params.get('hall') || '';
        const day = params.get('day') || '';
        let categoryIds = [];
        if (categoryNames.length > 0 && categories.length > 0) {
            categoryNames.forEach(catName => {
                const category = categories.find(c => c.name === catName);
                if (category) categoryIds.push(category.id);
            });
        }
        let hallId = '';
        if (hallName && sportHalls.length > 0) {
            const hall = sportHalls.find(h => h.name === hallName);
            if (hall) hallId = hall.id;
        }
        return { categories: categoryIds, group: groupName, teamId: teamId, hall: hallId, day: day };
    };

    const updateURLWithFilters = (filters) => {
        const params = new URLSearchParams();
        if (filters.categories && filters.categories.length > 0) {
            filters.categories.forEach(catId => {
                const category = categories.find(c => c.id === catId);
                if (category) params.append('category', category.name);
            });
        }
        if (filters.group) params.set('group', filters.group);
        if (filters.teamId) params.set('teamId', filters.teamId);
        if (filters.hall) {
            const hall = sportHalls.find(h => h.id === filters.hall);
            if (hall) params.set('hall', hall.name);
        }
        if (filters.day) params.set('day', filters.day);
        const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}${window.location.hash}`;
        window.history.replaceState({}, '', newUrl);
    };

    const filteredUnassignedMatches = getFilteredMatches(matches.filter(m => !m.hallId), true, true);
    const filteredSportHalls = selectedHallFilter ? sportHalls.filter(hall => hall.id === selectedHallFilter) : sportHalls;
    const filteredAllMatches = getFilteredMatches(matches, false, false);

    const sortedSportHalls = React.useMemo(() => [...sportHalls].sort((a, b) => a.name.localeCompare(b.name)), [sportHalls]);
    const sortedFilteredSportHalls = React.useMemo(() => [...filteredSportHalls].sort((a, b) => a.name.localeCompare(b.name)), [filteredSportHalls]);

    const loadHallSchedules = () => {
        if (!window.db) return;
        const schedulesRef = collection(window.db, 'hallSchedules');
        const unsubscribe = onSnapshot(schedulesRef, (snapshot) => {
            const schedules = {};
            snapshot.forEach((doc) => { schedules[doc.id] = doc.data(); });
            setHallSchedules(schedules);
        }, (error) => { console.error('Chyba pri načítaní rozvrhov hál:', error); });
        return unsubscribe;
    };

    const handleHallDayHeaderClick = (hall, date, dateStr) => {
        const localDateStr = getLocalDateStr(date);
        const scheduleId = `${hall.id}_${localDateStr}`;
        const existingSchedule = hallSchedules[scheduleId];
        setSelectedHallForDay(hall);
        setSelectedDateForHall(date);
        setSelectedDateStrForHall(dateStr);
        setSelectedCurrentStartTime(existingSchedule?.startTime);
        setIsHallDayModalOpen(true);
    };

    const handleSaveHallStartTime = async (startTime) => {
        if (!window.db || !selectedHallForDay || !selectedDateForHall) { window.showGlobalNotification('Chyba pri ukladaní času', 'error'); return; }
        if (userProfileData?.role !== 'admin') { window.showGlobalNotification('Na nastavenie času potrebujete administrátorské práva', 'error'); return; }
        try {
            const dateStr = getLocalDateStr(selectedDateForHall);
            const scheduleId = `${selectedHallForDay.id}_${dateStr}`;
            const hallDayRef = doc(window.db, 'hallSchedules', scheduleId);
            await setDoc(hallDayRef, { hallId: selectedHallForDay.id, hallName: selectedHallForDay.name, date: dateStr, startTime: startTime, updatedAt: Timestamp.now() }, { merge: true });
            setHallSchedules(prev => ({ ...prev, [scheduleId]: { ...prev[scheduleId], startTime: startTime, updatedAt: Timestamp.now() } }));
            const [year, month, day] = selectedDateStrForHall.split('-').map(Number);
            const dateObj = new Date(year, month - 1, day);
            window.showGlobalNotification(`Čas začiatku pre ${selectedHallForDay.name} dňa ${formatDateWithDay(dateObj)} bol nastavený na ${startTime}`, 'success');
        } catch (error) {
            console.error('Chyba pri ukladaní času začiatku:', error);
            window.showGlobalNotification('Chyba pri ukladaní času: ' + error.message, 'error');
        }
    };

    const getInitialDisplayMode = () => {
        if (window.location.hash) {
            const hash = window.location.hash.substring(1);
            if (hash === 'nazvy') return 'name';
            if (hash === 'id') return 'id';
            if (hash === 'oboje') return 'both';
        }
        return 'name';
    };

    const [displayMode, setDisplayMode] = useState('both');
    const [tournamentStartDate, setTournamentStartDate] = useState('');
    const [tournamentEndDate, setTournamentEndDate] = useState('');
    const [tournamentDatesLoaded, setTournamentDatesLoaded] = useState(false);

    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [selectedMatchForAssign, setSelectedMatchForAssign] = useState(null);
    const [filtersInitialized, setFiltersInitialized] = useState(false);

    useEffect(() => {
        if (!window.db) return;
        const usersRef = collection(window.db, 'users');
        const unsubscribe = onSnapshot(usersRef, (snapshot) => {
            const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            window.__allUsersCache = usersData;
        }, (error) => { console.error("Chyba pri načítaní používateľov do cache:", error); });
        return () => unsubscribe();
    }, [window.db]);

    useEffect(() => {
        const completedExists = matches.some(match => match.status === 'completed');
        setHasCompletedMatch(completedExists);
    }, [matches]);

    useEffect(() => {
        if (matches.length > 0 && sportHalls.length > 0 && !loading) {
            setHeightsCalculated(false);
            measureDayCardsHeights();
        }
    }, [matches, sportHalls, loading, selectedCategoryFilter, selectedGroupFilter, selectedHallFilter, selectedDayFilter, selectedTeamIdFilter]);

    useEffect(() => {
        if (matches.length > 0 && heightsCalculated) {
            const timeoutId = setTimeout(() => { measureDayCardsHeights(); }, 200);
            return () => clearTimeout(timeoutId);
        }
    }, [matches]);

    useEffect(() => { localStorage.setItem('filtersPanelPinned', isPinned); }, [isPinned]);

    useEffect(() => {
        const checkVisibleHalls = () => {
            if (!tournamentStartDate || !tournamentEndDate || loading) return;
            let visible = false;
            for (const hall of sportHalls) {
                if (selectedHallFilter && hall.id !== selectedHallFilter) continue;
                const startDate = new Date(tournamentStartDate);
                const endDate = new Date(tournamentEndDate);
                startDate.setHours(0, 0, 0, 0);
                endDate.setHours(0, 0, 0, 0);
                const currentDate = new Date(startDate);
                while (currentDate <= endDate) {
                    const dateStr = getLocalDateStr(currentDate);
                    if (selectedDayFilter && selectedDayFilter !== dateStr) { currentDate.setDate(currentDate.getDate() + 1); continue; }
                    const hallMatchesForDay = getMatchesForHallAndDay(hall.id, currentDate);
                    const filteredMatches = hallMatchesForDay?.filtered || [];
                    const matchesCount = hallMatchesForDay?.allMatches?.length || 0;
                    if (isFilterActive) { if (filteredMatches.length > 0) { visible = true; break; } }
                    else { visible = true; break; }
                    currentDate.setDate(currentDate.getDate() + 1);
                }
                if (visible) break;
            }
            setHasVisibleHalls(visible);
        };
        checkVisibleHalls();
    }, [selectedCategoriesFilter, selectedGroupFilter, selectedHallFilter, selectedDayFilter, selectedTeamIdFilter, tournamentStartDate, tournamentEndDate, sportHalls, matches, loading]);

    useEffect(() => {
        const savedBlockedBreaks = localStorage.getItem('blockedBreaks');
        if (savedBlockedBreaks) { try { setBlockedBreaks(JSON.parse(savedBlockedBreaks)); } catch (e) { console.error('Chyba pri načítaní z localStorage:', e); } }
    }, []);

    useEffect(() => { localStorage.setItem('blockedBreaks', JSON.stringify(blockedBreaks)); }, [blockedBreaks]);

    useEffect(() => {
        if (selectedCategoriesFilter.length === 1 && groupsByCategory[selectedCategoriesFilter[0]]) {
            const sortedGroups = [...groupsByCategory[selectedCategoriesFilter[0]]].sort((a, b) => a.name.localeCompare(b.name));
            setAvailableGroupsForFilter(sortedGroups);
        } else if (selectedCategoriesFilter.length > 1) {
            const allGroups = new Set();
            selectedCategoriesFilter.forEach(catId => { if (groupsByCategory[catId]) groupsByCategory[catId].forEach(group => allGroups.add(group.name)); });
            setAvailableGroupsForFilter(Array.from(allGroups).sort((a, b) => a.localeCompare(b)));
        } else setAvailableGroupsForFilter([]);
    }, [selectedCategoriesFilter, groupsByCategory]);

    useEffect(() => {
        if (categories.length > 0 && sportHalls.length > 0) {
            const filters = loadFiltersFromURL();
            if (filters.categories && filters.categories.length > 0) setSelectedCategoriesFilter(filters.categories);
            setSelectedGroupFilter(filters.group);
            setSelectedTeamIdFilter(filters.teamId);
            setSelectedHallFilter(filters.hall);
            setSelectedDayFilter(filters.day);
        }
    }, [categories, sportHalls]);

    useEffect(() => {
        if (tournamentStartDate && tournamentEndDate) {
            const days = [];
            const startDate = new Date(tournamentStartDate);
            const endDate = new Date(tournamentEndDate);
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(0, 0, 0, 0);
            const currentDate = new Date(startDate);
            while (currentDate <= endDate) {
                const dateStr = getLocalDateStr(currentDate);
                const displayDate = currentDate.toLocaleDateString('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric' });
                days.push({ value: dateStr, label: displayDate });
                currentDate.setDate(currentDate.getDate() + 1);
            }
            setAvailableDays(days);
        }
    }, [tournamentStartDate, tournamentEndDate]);

    useEffect(() => {
        if (categories.length > 0 && sportHalls.length > 0 && Object.keys(groupsByCategory).length > 0 && matches.length > 0 && !filtersInitialized) {
            const filters = loadFiltersFromURL();
            let shouldSetFilters = false;
            if (filters.categories && filters.categories.length > 0) { setSelectedCategoriesFilter(filters.categories); shouldSetFilters = true; }
            if (filters.group) { setSelectedGroupFilter(filters.group); shouldSetFilters = true; }
            if (filters.teamId) { setSelectedTeamIdFilter(filters.teamId); shouldSetFilters = true; }
            if (filters.hall) { setSelectedHallFilter(filters.hall); shouldSetFilters = true; }
            if (filters.day) { setSelectedDayFilter(filters.day); shouldSetFilters = true; }
            setFiltersInitialized(true);
            if (shouldSetFilters) {
                setTimeout(() => { updateURLWithFilters({ categories: filters.categories, group: filters.group, teamId: filters.teamId, hall: filters.hall, day: filters.day }); }, 100);
            }
        }
    }, [categories, sportHalls, groupsByCategory, matches, filtersInitialized]);

    useEffect(() => {
        if (!filtersInitialized) return;
        const timeoutId = setTimeout(() => {
            updateURLWithFilters({ categories: selectedCategoriesFilter, group: selectedGroupFilter, teamId: selectedTeamIdFilter, hall: selectedHallFilter, day: selectedDayFilter });
        }, 300);
        return () => clearTimeout(timeoutId);
    }, [selectedCategoriesFilter, selectedGroupFilter, selectedHallFilter, selectedDayFilter, selectedTeamIdFilter, filtersInitialized]);

    useEffect(() => {
        const handleHashChange = () => {
            if (window.location.hash) {
                const hash = window.location.hash.substring(1);
                if (hash === 'nazvy') setDisplayMode('name');
                else if (hash === 'id') setDisplayMode('id');
                else if (hash === 'oboje') setDisplayMode('both');
            }
        };
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    const handleMatchCardClick = (match) => {
        if (hasCompletedMatch) return;
        setSelectedMatchForAssign(match);
        setIsAssignModalOpen(true);
    };

    const handleUnassignMatch = async (match) => {
        if (!window.db) { window.showGlobalNotification('Databáza nie je inicializovaná', 'error'); return; }
        try {
            const matchRef = doc(window.db, 'matches', match.id);
            await updateDoc(matchRef, { hallId: null, scheduledTime: null, scheduledEndTime: null, duration: null, status: 'pending' });
            window.showGlobalNotification('Priradenie zápasu bolo odstránené', 'success');
        } catch (error) {
            console.error('Chyba pri odstraňovaní priradenia:', error);
            window.showGlobalNotification('Chyba pri odstraňovaní priradenia: ' + error.message, 'error');
        }
    };

    const handleAssignMatch = async (assignment) => {
        if (!window.db) { window.showGlobalNotification('Databáza nie je inicializovaná', 'error'); return; }
        if (hasCompletedMatch) return;
        try {
            const matchRef = doc(window.db, 'matches', assignment.matchId);
            const [year, month, day] = assignment.date.split('-').map(Number);
            const [hours, minutes] = assignment.time.split(':').map(Number);
            const matchDateTime = new Date(year, month - 1, day, hours, minutes, 0);
            await updateDoc(matchRef, {
                hallId: assignment.hallId,
                scheduledTime: Timestamp.fromDate(matchDateTime),
                scheduledEndTime: assignment.endTime,
                duration: assignment.duration,
                status: 'scheduled'
            });
            window.showGlobalNotification('Zápas bol priradený do haly', 'success');
        } catch (error) {
            console.error('Chyba pri priradení zápasu:', error);
            window.showGlobalNotification('Chyba pri priradení zápasu: ' + error.message, 'error');
        }
    };

    const formatDateForDisplay = (timestamp) => {
        if (!timestamp) return 'neurčené';
        try {
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            if (isNaN(date.getTime())) return 'neplatný dátum';
            return `${date.getDate().toString().padStart(2, '0')}. ${(date.getMonth() + 1).toString().padStart(2, '0')}. ${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        } catch (e) { return 'neplatný dátum'; }
    };

    const handleDeleteClick = (match) => { setSelectedMatchForAction(match); setIsDeleteModalOpen(true); };
    const handleSwapClick = (match) => { setSelectedMatchForAction(match); setIsSwapModalOpen(true); };

    const confirmDelete = async () => {
        if (!selectedMatchForAction) return;
        if (!window.db) { window.showGlobalNotification('Databáza nie je inicializovaná', 'error'); return; }
        if (userProfileData?.role !== 'admin') { window.showGlobalNotification('Na mazanie zápasov potrebujete administrátorské práva', 'error'); return; }
        if (!userProfileData?.approved) { window.showGlobalNotification('Váš účet ešte nebol schválený administrátorom.', 'error'); return; }
        try {
            const matchRef = doc(window.db, 'matches', selectedMatchForAction.id);
            await deleteDoc(matchRef);
            window.showGlobalNotification('Zápas bol zmazaný', 'success');
            setSelectedMatchForAction(null);
        } catch (error) {
            console.error('Chyba pri mazaní zápasu:', error);
            window.showGlobalNotification('Chyba pri mazaní zápasu: ' + error.message, 'error');
        }
    };

    const confirmSwap = async () => {
        if (!selectedMatchForAction) return;
        if (!window.db) { window.showGlobalNotification('Databáza nie je inicializovaná', 'error'); return; }
        if (userProfileData?.role !== 'admin') { window.showGlobalNotification('Na úpravu zápasov potrebujete administrátorské práva', 'error'); return; }
        if (!userProfileData?.approved) { window.showGlobalNotification('Váš účet ešte nebol schválený administrátorom.', 'error'); return; }
        try {
            const matchRef = doc(window.db, 'matches', selectedMatchForAction.id);
            await updateDoc(matchRef, { homeTeamIdentifier: selectedMatchForAction.awayTeamIdentifier, awayTeamIdentifier: selectedMatchForAction.homeTeamIdentifier });
            window.showGlobalNotification('Tímy boli vymenené', 'success');
            setSelectedMatchForAction(null);
        } catch (error) {
            console.error('Chyba pri výmene tímov:', error);
            window.showGlobalNotification('Chyba pri výmene tímov: ' + error.message, 'error');
        }
    };

    const getTeamName = (team) => team?.teamName || 'Neznámy tím';

    const getTeamNameByIdentifier = (identifier) => {
        if (!identifier) return 'Neznámy tím';
        const parts = identifier.split(' ');
        if (parts.length < 2) return identifier;
        const groupAndOrder = parts.pop();
        const category = parts.join(' ');
        let groupName = '', order = '';
        for (let i = 0; i < groupAndOrder.length; i++) {
            const char = groupAndOrder[i];
            if (char >= '0' && char <= '9') {
                order = groupAndOrder.substring(i);
                groupName = groupAndOrder.substring(0, i);
                break;
            }
        }
        if (!order) { order = '?'; groupName = groupAndOrder; }
        if (teamData.allTeams && teamData.allTeams.length > 0) {
            const groupNameWithPrefix = `skupina ${groupName}`;
            const team = teamData.allTeams.find(t => 
                t.category === category && 
                (t.groupName === groupNameWithPrefix || t.groupName === groupName) &&
                t.order?.toString() === order
            );
            if (team) return team.teamName;
        }
        if (window.__teamManagerData?.allTeams) {
            const groupNameWithPrefix = `skupina ${groupName}`;
            const team = window.__teamManagerData.allTeams.find(t => 
                t.category === category && 
                (t.groupName === groupNameWithPrefix || t.groupName === groupName) &&
                t.order?.toString() === order
            );
            if (team) { setTeamData(window.__teamManagerData); return team.teamName; }
        }
        return `${category} ${groupName}${order}`;
    };

    const toggleCategory = (categoryId) => {
        setSelectedCategoriesFilter(prev => {
            if (prev.includes(categoryId)) {
                const newSelection = prev.filter(id => id !== categoryId);
                if (newSelection.length === 0) setSelectedGroupFilter('');
                return newSelection;
            } else return [...prev, categoryId];
        });
    };

    const getTeamDisplayText = (identifier) => {
        if (!identifier) return '---';
        const teamName = getTeamNameByIdentifier(identifier);
        switch (displayMode) {
            case 'name': return teamName;
            case 'id': return identifier;
            case 'both': return { name: teamName, id: identifier };
            default: return teamName;
        }
    };

    const getMatchesForHallAndDay = (hallId, date) => {
        if (!matches || matches.length === 0) return { filtered: [], allMatches: [] };
        const dateStr = getLocalDateStr(date);
        const allHallDayMatches = matches.filter(match => {
            if (!match.hallId || !match.scheduledTime) return false;
            if (match.hallId !== hallId) return false;
            try { return getLocalDateStr(match.scheduledTime.toDate()) === dateStr; } catch (e) { return false; }
        }).sort((a, b) => {
            try { return a.scheduledTime.toDate().getTime() - b.scheduledTime.toDate().getTime(); } catch (e) { return 0; }
        });
        const filteredMatches = allHallDayMatches.filter(match => {
            if (selectedCategoriesFilter.length > 0 && !selectedCategoriesFilter.includes(match.categoryId)) return false;
            if (selectedGroupFilter && match.groupName !== selectedGroupFilter) return false;
            if (selectedTeamIdFilter) {
                if (match.homeTeamIdentifier !== selectedTeamIdFilter && match.awayTeamIdentifier !== selectedTeamIdFilter) return false;
            }
            return true;
        });
    
        // ===== ZÍSKAME TÍMY, KTORÉ HRAJÚ DVA ZÁPASY PO SEBE =====
        const backToBackTeamMatchKeys = getBackToBackTeamMatchKeys();      
    
        const filteredWithColors = filteredMatches.map(match => {
            const accommodationsMap = window.__teamAccommodationsMap || new Map();
            let homeTeamColor = '#f3f4f6', awayTeamColor = '#f3f4f6';
            const homeAccommodationName = accommodationsMap.get(match.homeTeamIdentifier);
            const awayAccommodationName = accommodationsMap.get(match.awayTeamIdentifier);
            const homeTeamName = getTeamNameByIdentifier(match.homeTeamIdentifier);
            const awayTeamName = getTeamNameByIdentifier(match.awayTeamIdentifier);
            if (homeAccommodationName && !homeTeamName.includes(match.categoryName)) {
                const accommodation = accommodations.find(a => a.name === homeAccommodationName);
                if (accommodation) homeTeamColor = accommodation.headerColor;
            } else if (!homeAccommodationName && !homeTeamName.includes(match.categoryName)) homeTeamColor = '#ffff00';
            if (awayAccommodationName && !awayTeamName.includes(match.categoryName)) {
                const accommodation = accommodations.find(a => a.name === awayAccommodationName);
                if (accommodation) awayTeamColor = accommodation.headerColor;
            } else if (!awayAccommodationName && !awayTeamName.includes(match.categoryName)) awayTeamColor = '#ffff00';
            const getTotalMembersCount = (teamIdentifier, matchCategoryName) => {
                if (!teamIdentifier) return 0;
                let teamDisplayName = null;
                if (window.teamManager && typeof window.teamManager.getTeamNameByDisplayIdSync === 'function') {
                    try { teamDisplayName = window.teamManager.getTeamNameByDisplayIdSync(teamIdentifier); } catch (e) {}
                }
                const actualTeamName = teamDisplayName || teamIdentifier;
                if (!window.__allUsersCache) return 0;
                for (const user of window.__allUsersCache) {
                    if (!user.teams) continue;
                    for (const [category, teamsArray] of Object.entries(user.teams)) {
                        if (!Array.isArray(teamsArray)) continue;
                        const team = teamsArray.find(t => t.teamName === actualTeamName && (category === matchCategoryName || t._category === matchCategoryName || t.category === matchCategoryName));
                        if (team) {
                            const playersCount = team.playerDetails?.length || 0;
                            const womenTeamMembersCount = team.womenTeamMemberDetails?.length || 0;
                            const menTeamMembersCount = team.menTeamMemberDetails?.length || 0;
                            const womenDriversCount = team.driverDetailsFemale?.length || 0;
                            const menDriversCount = team.driverDetailsMale?.length || 0;
                            return playersCount + womenTeamMembersCount + menTeamMembersCount + womenDriversCount + menDriversCount;
                        }
                    }
                }
                return 0;
            };
    
            // ===== KONTROLA BACK-TO-BACK PRE DOMÁCI A HOSŤOVSKÝ TÍM =====
            const homeBackToBack = backToBackTeamMatchKeys.has(`${match.id}|${match.homeTeamIdentifier}`);
            const awayBackToBack = backToBackTeamMatchKeys.has(`${match.id}|${match.awayTeamIdentifier}`);            
    
            return {
                ...match,
                homeTeamInConflict: homeBackToBack,
                awayTeamInConflict: awayBackToBack,
                homeTeamColor: homeTeamColor,
                awayTeamColor: awayTeamColor,
                homeBgColor: homeBackToBack ? '#dc2626' : 'transparent', 
                awayBgColor: awayBackToBack ? '#dc2626' : 'transparent',
                homeTextColor: '#000000',
                awayTextColor: '#000000',
                homeTotalMembersCount: getTotalMembersCount(match.homeTeamIdentifier, match.categoryName),
                awayTotalMembersCount: getTotalMembersCount(match.awayTeamIdentifier, match.categoryName)
            };
        });
        return { filtered: filteredWithColors, allMatches: allHallDayMatches };
    };

    const hasExistingMatches = (categoryId, groupName) => {
        return matches.some(match => match.categoryId === categoryId && (groupName ? match.groupName === groupName : true));
    };

    const checkExistingMatchesDuringGeneration = (matchesToGenerate, withRepetitions = false) => {
        const existing = [], newOnes = [];
        matchesToGenerate.forEach(match => {
            let exists = matches.some(existingMatch => 
                existingMatch.homeTeamIdentifier === match.homeTeamIdentifier && 
                existingMatch.awayTeamIdentifier === match.awayTeamIdentifier &&
                existingMatch.categoryId === match.categoryId
            );
            if (!withRepetitions && !exists) {
                exists = matches.some(existingMatch => 
                    existingMatch.homeTeamIdentifier === match.awayTeamIdentifier && 
                    existingMatch.awayTeamIdentifier === match.homeTeamIdentifier &&
                    existingMatch.categoryId === match.categoryId
                );
            }
            if (exists) existing.push(match);
            else newOnes.push(match);
        });
        return { existingMatches: existing, newMatches: newOnes };
    };

    const processNextExistingMatch = () => {
        if (currentMatchIndex < existingMatchesToProcess.length) {
            setCurrentExistingMatch(existingMatchesToProcess[currentMatchIndex]);
            setIsExistingMatchModalOpen(true);
        } else finishGeneration();
    };

    const finishGeneration = async () => {
        const allMatchesToSave = [...newMatches, ...pendingMatches];
        if (allMatchesToSave.length > 0) {
            try {
                window.showGlobalNotification(`Ukladám ${allMatchesToSave.length} zápasov...`, 'info');
                const savedMatches = await saveMatchesToFirebase(allMatchesToSave);
                window.showGlobalNotification(`Vygenerovaných a uložených ${savedMatches.length} zápasov pre ${currentCategoryInfo?.name || 'vybranú kategóriu'}${currentCategoryInfo?.groupName ? ' - ' + currentCategoryInfo.groupName : ''}`, 'success');
            } catch (error) {
                console.error('Chyba pri ukladaní zápasov:', error);
                window.showGlobalNotification('Chyba pri ukladaní zápasov: ' + error.message, 'error');
            }
        } else window.showGlobalNotification('Žiadne nové zápasy neboli vygenerované', 'info');
        setExistingMatchesToProcess([]);
        setNewMatches([]);
        setPendingMatches([]);
        setCurrentMatchIndex(0);
        setCurrentExistingMatch(null);
        setCurrentCategoryInfo(null);
        setGenerationInProgress(false);
    };

    const handleConfirmExistingMatch = (match) => {
        setPendingMatches(prev => [...prev, match]);
        setCurrentMatchIndex(currentMatchIndex + 1);
        setTimeout(() => processNextExistingMatch(), 100);
    };

    const handleRejectExistingMatch = () => {
        setCurrentMatchIndex(currentMatchIndex + 1);
        setTimeout(() => processNextExistingMatch(), 100);
    };

    const loadMatches = () => {
        if (!window.db) return;
        const matchesRef = collection(window.db, 'matches');
        const unsubscribe = onSnapshot(matchesRef, (snapshot) => {
            const loadedMatches = [];
            snapshot.forEach((doc) => { loadedMatches.push({ id: doc.id, ...doc.data() }); });
            loadedMatches.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setMatches(loadedMatches);
        }, (error) => { console.error('Chyba pri načítaní zápasov:', error); });
        return unsubscribe;
    };

    const loadAccommodationData = () => {
        if (!window.db) return;
        const unsubscribePlaces = onSnapshot(collection(window.db, 'places'), (snapshot) => {
            const loadedAccommodations = [];
            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                if (data.type === "ubytovanie") {
                    loadedAccommodations.push({ id: docSnap.id, name: data.name, headerColor: data.headerColor || '#1e40af', headerTextColor: data.headerTextColor || '#000000' });
                }
            });
            setAccommodations(loadedAccommodations);
        }, (err) => console.error("Chyba pri načítaní ubytovní:", err));
        const unsubscribeUsers = onSnapshot(collection(window.db, 'users'), (snapshot) => {
            const teamAccommodationMap = new Map();
            snapshot.forEach((userDoc) => {
                const userData = userDoc.data() || {};
                const userTeams = userData.teams;
                if (userTeams && typeof userTeams === 'object') {
                    Object.entries(userTeams).forEach(([category, teamArray]) => {
                        if (!Array.isArray(teamArray)) return;
                        teamArray.forEach((team) => {
                            if (!team?.teamName) return;
                            let teamIdentifier = null;
                            if (team.groupName && team.order) {
                                const groupLetter = team.groupName.replace('skupina ', '');
                                teamIdentifier = `${category} ${groupLetter}${team.order}`;
                            } else teamIdentifier = team.teamName;
                            const accommodationName = team.accommodation?.name;
                            if (accommodationName) teamAccommodationMap.set(teamIdentifier, accommodationName);
                        });
                    });
                }
            });
            setTeamAccommodations(teamAccommodationMap);
            window.__teamAccommodationsMap = teamAccommodationMap;
        }, (err) => console.error("Chyba pri načítaní priradení ubytovní:", err));
        return () => { unsubscribePlaces(); unsubscribeUsers(); };
    };

    useEffect(() => {
        let unsubscribe = null;
        if (window.teamManager) {
            if (window.__teamManagerData) setTeamData(window.__teamManagerData);
            unsubscribe = window.teamManager.subscribe((data) => { setTeamData(data); });
        } else if (window.__teamManagerData) setTeamData(window.__teamManagerData);
        return () => { if (unsubscribe && typeof unsubscribe === 'function') unsubscribe(); };
    }, []);

    useEffect(() => {
        if (existingMatchesToProcess.length > 0 && !isExistingMatchModalOpen && currentMatchIndex === 0) {
            setTimeout(() => processNextExistingMatch(), 100);
        }
    }, [existingMatchesToProcess, isExistingMatchModalOpen, currentMatchIndex]);

    useEffect(() => {
        if (tournamentStartDate && tournamentEndDate) {
            window.tournamentStartDate = tournamentStartDate;
            window.tournamentEndDate = tournamentEndDate;
        }
    }, [tournamentStartDate, tournamentEndDate]);

    const calculateTotalMatchTime = (category) => {
        if (!category) return { playingTime: 0, breaksBetweenPeriods: 0, totalTimeWithMatchBreak: 0 };
        const periods = category.periods ?? 2;
        const periodDuration = category.periodDuration ?? 20;
        const breakDuration = category.breakDuration ?? 2;
        const matchBreak = category.matchBreak ?? 5;
        const playingTime = periods * periodDuration;
        const breaksBetweenPeriods = (periods - 1) * breakDuration;
        const totalTimeWithMatchBreak = playingTime + breaksBetweenPeriods + matchBreak;
        return { playingTime, breaksBetweenPeriods, totalTimeWithMatchBreak };
    };

    const getAllGroupsInCategory = (categoryName) => {
        const groups = [];
        const teamsToUse = teamData.allTeams || window.__teamManagerData?.allTeams || [];
        if (teamsToUse.length > 0) {
            const teamsInCategory = teamsToUse.filter(t => t.category === categoryName);
            const groupNames = [...new Set(teamsInCategory.map(t => t.groupName).filter(g => g))];
            const sortedGroupNames = groupNames.sort((a, b) => a.localeCompare(b));
            sortedGroupNames.forEach(groupName => {
                const teamsInGroup = teamsInCategory.filter(t => t.groupName === groupName);
                if (teamsInGroup.length >= 2) groups.push({ name: groupName, teams: teamsInGroup });
            });
        }
        return groups;
    };

    const saveMatchesToFirebase = async (matchesToSave) => {
        if (!window.db) throw new Error('Databáza nie je inicializovaná');
        if (userProfileData?.role !== 'admin') throw new Error('Na ukladanie zápasov potrebujete administrátorské práva. Vaša rola: ' + (userProfileData?.role || 'žiadna'));
        if (!userProfileData?.approved) throw new Error('Váš účet ešte nebol schválený administrátorom.');
        const matchesRef = collection(window.db, 'matches');
        const savedMatches = [];
        for (let i = 0; i < matchesToSave.length; i++) {
            const match = matchesToSave[i];
            try {
                const matchData = {
                    homeTeamIdentifier: match.homeTeamIdentifier,
                    awayTeamIdentifier: match.awayTeamIdentifier,
                    time: match.time,
                    hallId: match.hallId,
                    categoryId: match.categoryId,
                    categoryName: match.categoryName,
                    groupName: match.groupName,
                    status: match.status,
                    createdAt: Timestamp.now(),
                    createdByUid: userProfileData?.uid || null
                };
                const docRef = await addDoc(matchesRef, matchData);
                savedMatches.push({ id: docRef.id, ...matchData });
            } catch (error) {
                console.error('Chyba pri ukladaní zápasu:', error);
                if (error.code === 'permission-denied') throw new Error('Nemáte oprávnenie na ukladanie zápasov. Ste prihlásený ako admin? (kód: permission-denied)');
                throw error;
            }
        }
        return savedMatches;
    };

    const generateMatches = async ({ categoryId, groupName, withRepetitions }) => {
        try {
            if (userProfileData?.role !== 'admin') { window.showGlobalNotification('Na generovanie zápasov potrebujete administrátorské práva', 'error'); return; }
            const category = categories.find(c => c.id === categoryId);
            if (!category) { window.showGlobalNotification('Kategória nebola nájdená', 'error'); return; }
            if (!window.teamManager) { window.showGlobalNotification('TeamManager nie je inicializovaný', 'error'); return; }
            setGenerationInProgress(true);
            let allGeneratedMatches = [];
            if (groupName) {
                const teamsInGroup = await window.teamManager.getTeamsByGroup(category.name, groupName);
                if (teamsInGroup.length < 2) { window.showGlobalNotification(`V skupine ${groupName} sú menej ako 2 tímy`, 'error'); setGenerationInProgress(false); return; }
                const groupMatches = generateMatchesForGroup(teamsInGroup, withRepetitions, category.name);
                const matchesWithInfo = groupMatches.map((match, index) => ({
                    homeTeamIdentifier: match.homeTeamIdentifier,
                    awayTeamIdentifier: match.awayTeamIdentifier,
                    time: '--:--',
                    hallId: null,
                    categoryId: category.id,
                    categoryName: category.name,
                    groupName: groupName,
                    status: 'pending'
                }));
                allGeneratedMatches = [...allGeneratedMatches, ...matchesWithInfo];
            } else {
                const groups = getAllGroupsInCategory(category.name);
                if (groups.length === 0) { window.showGlobalNotification('V tejto kategórii nie sú žiadne skupiny s aspoň 2 tímami', 'error'); setGenerationInProgress(false); return; }
                for (const group of groups) {
                    const teamsInGroup = await window.teamManager.getTeamsByGroup(category.name, group.name);
                    if (teamsInGroup.length >= 2) {
                        const groupMatches = generateMatchesForGroup(teamsInGroup, withRepetitions, category.name);
                        const matchesWithInfo = groupMatches.map((match, index) => ({
                            homeTeamIdentifier: match.homeTeamIdentifier,
                            awayTeamIdentifier: match.awayTeamIdentifier,
                            time: '--:--',
                            hallId: null,
                            categoryId: category.id,
                            categoryName: category.name,
                            groupName: group.name,
                            status: 'pending'
                        }));
                        allGeneratedMatches = [...allGeneratedMatches, ...matchesWithInfo];
                    }
                }
            }
            const { existingMatches, newMatches: newOnes } = checkExistingMatchesDuringGeneration(allGeneratedMatches, withRepetitions);
            if (existingMatches.length > 0) {
                setCurrentCategoryInfo({ name: category.name, groupName: groupName });
                setNewMatches(newOnes);
                setExistingMatchesToProcess(existingMatches);
                setCurrentMatchIndex(0);
                setPendingMatches([]);
            } else {
                if (allGeneratedMatches.length > 0) {
                    window.showGlobalNotification(`Ukladám ${allGeneratedMatches.length} zápasov...`, 'info');
                    const savedMatches = await saveMatchesToFirebase(allGeneratedMatches);
                    window.showGlobalNotification(`Vygenerovaných a uložených ${savedMatches.length} zápasov pre ${category.name}${groupName ? ' - ' + groupName : ''}`, 'success');
                }
                setGenerationInProgress(false);
            }
        } catch (error) {
            console.error('Chyba pri generovaní zápasov:', error);
            window.showGlobalNotification('Chyba pri generovaní zápasov: ' + error.message, 'error');
            setGenerationInProgress(false);
        }
    };

    const handleGenerateClick = (params) => {
        const category = categories.find(c => c.id === params.categoryId);
        if (!category) return;
        if (hasExistingMatches(params.categoryId, params.groupName)) {
            setPendingGeneration(params);
            setIsConfirmModalOpen(true);
        } else generateMatches(params);
    };

    const handleConfirmRegenerate = () => {
        if (pendingGeneration) { generateMatches(pendingGeneration); setPendingGeneration(null); }
    };

    const handleBulkDeleteClick = (params) => {
        const category = categories.find(c => c.id === params.categoryId);
        if (!category) return;
        const matchesToDelete = matches.filter(match => match.categoryId === params.categoryId && (params.groupName ? match.groupName === params.groupName : true));
        if (matchesToDelete.length === 0) { window.showGlobalNotification('Žiadne zápasy na zmazanie', 'info'); return; }
        setPendingBulkDelete({ ...params, categoryName: category.name, matchesCount: matchesToDelete.length });
        setIsBulkDeleteConfirmModalOpen(true);
    };

    const confirmBulkDelete = async () => {
        if (!pendingBulkDelete) return;
        if (!window.db) { window.showGlobalNotification('Databáza nie je inicializovaná', 'error'); return; }
        if (userProfileData?.role !== 'admin') { window.showGlobalNotification('Na mazanie zápasov potrebujete administrátorské práva', 'error'); return; }
        if (!userProfileData?.approved) { window.showGlobalNotification('Váš účet ešte nebol schválený administrátorom.', 'error'); return; }
        try {
            const matchesToDelete = matches.filter(match => match.categoryId === pendingBulkDelete.categoryId && (pendingBulkDelete.groupName ? match.groupName === pendingBulkDelete.groupName : true));
            for (const match of matchesToDelete) {
                const matchRef = doc(window.db, 'matches', match.id);
                await deleteDoc(matchRef);
            }
            window.showGlobalNotification(`Zmazaných ${matchesToDelete.length} zápasov pre ${pendingBulkDelete.categoryName}${pendingBulkDelete.groupName ? ' - ' + pendingBulkDelete.groupName : ''}`, 'success');
            setPendingBulkDelete(null);
        } catch (error) {
            console.error('Chyba pri hromadnom mazaní zápasov:', error);
            window.showGlobalNotification('Chyba pri mazaní zápasov: ' + error.message, 'error');
        }
    };

    useEffect(() => {
        if (!window.db) { console.error("Firestore databáza nie je inicializovaná"); setLoading(false); return; }
        const unsubscribeMatches = loadMatches();
        const unsubscribeSchedules = loadHallSchedules();
        const unsubscribeAccommodations = loadAccommodationData();
        const loadTournamentDates = async () => {
            try {
                const settingsDocRef = doc(window.db, 'settings', 'registration');
                const settingsSnap = await getDoc(settingsDocRef);
                if (settingsSnap.exists()) {
                    const data = settingsSnap.data();
                    if (data.tournamentStart) {
                        const startDate = data.tournamentStart.toDate();
                        setTournamentStartDate(`${startDate.getFullYear()}-${(startDate.getMonth() + 1).toString().padStart(2, '0')}-${startDate.getDate().toString().padStart(2, '0')}T${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`);
                    }
                    if (data.tournamentEnd) {
                        const endDate = data.tournamentEnd.toDate();
                        setTournamentEndDate(`${endDate.getFullYear()}-${(endDate.getMonth() + 1).toString().padStart(2, '0')}-${endDate.getDate().toString().padStart(2, '0')}T${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`);
                    }
                }
                setTournamentDatesLoaded(true);
            } catch (error) { console.error("Chyba pri načítaní dátumov turnaja:", error); }
        };
        const loadCategorySettings = async () => {
            try {
                const catRef = doc(window.db, 'settings', 'categories');
                const catSnap = await getDoc(catRef);
                if (catSnap.exists()) {
                    const data = catSnap.data() || {};
                    const categoriesList = [];
                    Object.entries(data).forEach(([id, obj]) => {
                        const category = {
                            id: id,
                            name: obj.name || `Kategória ${id}`,
                            maxTeams: obj.maxTeams ?? 12,
                            periods: obj.periods ?? 2,
                            periodDuration: obj.periodDuration ?? 20,
                            breakDuration: obj.breakDuration ?? 2,
                            matchBreak: obj.matchBreak ?? 5,
                            drawColor: obj.drawColor ?? '#3B82F6',
                            transportColor: obj.transportColor ?? '#10B981',
                            timeoutCount: obj.timeoutCount ?? 2,
                            timeoutDuration: obj.timeoutDuration ?? 1,
                            exclusionTime: obj.exclusionTime ?? 2,
                            carryOverPoints: obj.carryOverPoints ?? false
                        };
                        categoriesList.push(category);
                    });
                    setCategories(categoriesList);
                }
            } catch (error) { console.error("AddMatchesApp: Chyba pri načítaní nastavení kategórií:", error); }
        };
        loadTournamentDates();
        loadCategorySettings();
        const loadGroups = async () => {
            try {
                const groupsRef = doc(window.db, 'settings', 'groups');
                const groupsSnap = await getDoc(groupsRef);
                if (groupsSnap.exists()) setGroupsByCategory(groupsSnap.data());
            } catch (error) { console.error("AddMatchesApp: Chyba pri načítaní skupín:", error); }
        };
        loadGroups();
        const unsubscribePlaces = onSnapshot(collection(window.db, 'places'), (snapshot) => {
            const loadedPlaces = [];
            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                const loc = data.location;
                loadedPlaces.push({ id: docSnap.id, name: data.name, type: data.type, lat: loc?.latitude ?? data.lat, lng: loc?.longitude ?? data.lng });
            });
            setSportHalls(loadedPlaces.filter(place => place.type === 'sportova_hala'));
            setLoading(false);
        }, (error) => {
            console.error("AddMatchesApp: Chyba pri načítaní miest:", error);
            window.showGlobalNotification('Nepodarilo sa načítať športové haly', 'error');
            setLoading(false);
        });
        return () => {
            if (unsubscribeMatches) unsubscribeMatches();
            if (unsubscribeSchedules) unsubscribeSchedules();
            if (unsubscribeAccommodations) unsubscribeAccommodations();
            unsubscribePlaces();
        };
    }, []);

    const alignmentClasses = {
        left: 'text-left', 'center-left': 'text-center', center: 'text-center', 'center-right': 'text-center', right: 'text-right'
    };
    const alignmentStyles = {
        left: { textAlign: 'left' }, 'center-left': { textAlign: 'center', paddingRight: '10%' }, center: { textAlign: 'center' }, 'center-right': { textAlign: 'center', paddingLeft: '10%' }, right: { textAlign: 'right' }
    };

    return React.createElement(
        React.Fragment,
        null,
        React.createElement(GenerationModal, {
            key: `generation-modal-${isModalOpen}`,
            isOpen: isModalOpen,
            onClose: () => setIsModalOpen(false),
            onConfirm: handleGenerateClick,
            categories: categories,
            groupsByCategory: groupsByCategory
        }),
        React.createElement(ConfirmRegenerateModal, {
            isOpen: isConfirmModalOpen,
            onClose: () => { setIsConfirmModalOpen(false); setPendingGeneration(null); },
            onConfirm: handleConfirmRegenerate,
            categoryName: pendingGeneration ? categories.find(c => c.id === pendingGeneration.categoryId)?.name : '',
            groupName: pendingGeneration?.groupName
        }),
        React.createElement(HallDayStartTimeModal, {
            isOpen: isHallDayModalOpen,
            onClose: () => { setIsHallDayModalOpen(false); setSelectedHallForDay(null); setSelectedDateForHall(null); setSelectedDateStrForHall(''); setSelectedCurrentStartTime(null); },
            onConfirm: handleSaveHallStartTime,
            hallName: selectedHallForDay?.name,
            date: selectedDateStrForHall,
            currentStartTime: selectedCurrentStartTime
        }),
        React.createElement(ConfirmExistingMatchModal, {
            isOpen: isExistingMatchModalOpen,
            onClose: () => { setIsExistingMatchModalOpen(false); setCurrentExistingMatch(null); handleRejectExistingMatch(); },
            onConfirm: handleConfirmExistingMatch,
            match: currentExistingMatch,
            homeTeamDisplay: currentExistingMatch ? getTeamDisplayText(currentExistingMatch.homeTeamIdentifier) : '',
            awayTeamDisplay: currentExistingMatch ? getTeamDisplayText(currentExistingMatch.awayTeamIdentifier) : '',
            displayMode: displayMode
        }),
        React.createElement(ConfirmDeleteModal, {
            isOpen: isDeleteModalOpen,
            onClose: () => { setIsDeleteModalOpen(false); setSelectedMatchForAction(null); },
            onConfirm: confirmDelete,
            homeTeamDisplay: selectedMatchForAction ? getTeamDisplayText(selectedMatchForAction.homeTeamIdentifier) : '',
            awayTeamDisplay: selectedMatchForAction ? getTeamDisplayText(selectedMatchForAction.awayTeamIdentifier) : '',
            displayMode: displayMode
        }),
        React.createElement(ConfirmSwapModal, {
            isOpen: isSwapModalOpen,
            onClose: () => { setIsSwapModalOpen(false); setSelectedMatchForAction(null); },
            onConfirm: confirmSwap,
            homeTeamDisplay: selectedMatchForAction ? getTeamDisplayText(selectedMatchForAction.homeTeamIdentifier) : '',
            awayTeamDisplay: selectedMatchForAction ? getTeamDisplayText(selectedMatchForAction.awayTeamIdentifier) : '',
            displayMode: displayMode
        }),
        React.createElement(DeleteMatchesModal, {
            key: `delete-matches-modal-${isDeleteMatchesModalOpen}`,
            isOpen: isDeleteMatchesModalOpen,
            onClose: () => setIsDeleteMatchesModalOpen(false),
            onConfirm: handleBulkDeleteClick,
            categories: categories,
            groupsByCategory: groupsByCategory
        }),
        React.createElement(ConfirmBulkDeleteModal, {
            isOpen: isBulkDeleteConfirmModalOpen,
            onClose: () => { setIsBulkDeleteConfirmModalOpen(false); setPendingBulkDelete(null); },
            onConfirm: confirmBulkDelete,
            categoryName: pendingBulkDelete?.categoryName,
            groupName: pendingBulkDelete?.groupName,
            matchesCount: pendingBulkDelete?.matchesCount || 0
        }),
        React.createElement(ConfirmBulkUnassignModal, {
            isOpen: isBulkUnassignModalOpen,
            onClose: () => { setIsBulkUnassignModalOpen(false); setPendingBulkUnassign(null); },
            onConfirm: confirmBulkUnassign,
            hallName: pendingBulkUnassign?.hallName,
            date: pendingBulkUnassign?.dateStr,
            matchesCount: pendingBulkUnassign?.matchesCount || 0,
            isWholeHall: pendingBulkUnassign?.isWholeHall || false
        }),
        React.createElement(AssignMatchToBreakModal, {
            isOpen: isAssignToBreakModalOpen,
            onClose: () => { setIsAssignToBreakModalOpen(false); setSelectedBreakForAssign(null); },
            onConfirm: (matchId) => handleAssignMatchToBreak({
                matchId,
                breakStartTime: selectedBreakForAssign?.breakStartTime,
                breakDuration: selectedBreakForAssign?.breakDuration,
                hallId: selectedBreakForAssign?.hallId,
                date: selectedBreakForAssign?.date
            }),
            availableMatches: selectedBreakForAssign?.availableMatches || [],
            breakStartTime: selectedBreakForAssign?.breakStartTime,
            breakEndTime: selectedBreakForAssign?.breakEndTime,
            breakDuration: selectedBreakForAssign?.breakDuration,
            hallId: selectedBreakForAssign?.hallId,
            date: selectedBreakForAssign?.date,
            categories: categories,
            displayMode: displayMode,
            getTeamDisplayText: getTeamDisplayText,
            accommodations: accommodations,
            teamAccommodations: teamAccommodations,
            allMatches: matches,
            groupsByCategory: groupsByCategory,
            blockedBreaks: blockedBreaks,
            sportHalls: sportHalls,
            selectedCategoriesFilter: selectedCategoriesFilter
        }),
        React.createElement(AssignMatchModal, {
            isOpen: isAssignModalOpen,
            onClose: () => { setIsAssignModalOpen(false); setSelectedMatchForAssign(null); },
            match: selectedMatchForAssign,
            sportHalls: sportHalls,
            categories: categories,
            onAssign: handleAssignMatch,
            allMatches: matches,
            displayMode: displayMode,
            getTeamDisplayText: getTeamDisplayText,
            initialFilters: { hallId: selectedHallFilter || null, day: selectedDayFilter || null },
            blockedBreaks: blockedBreaks,
            groupsByCategory: groupsByCategory
        }),
        React.createElement(AddBreakModal, {
            isOpen: isBreakModalOpen,
            onClose: () => { setIsBreakModalOpen(false); setSelectedMatchForBreak(null); setSelectedMatchCurrentTime(''); setSelectedMatchNextTime(''); },
            onConfirm: handleAddBreak,
            match: selectedMatchForBreak,
            hallName: selectedMatchForBreak ? sportHalls.find(h => h.id === selectedMatchForBreak.hallId)?.name : '',
            date: selectedMatchForBreak?.scheduledTime ? formatDateForDisplay(selectedMatchForBreak.scheduledTime) : '',
            currentTime: selectedMatchCurrentTime,
            nextMatchTime: selectedMatchNextTime,
            matchBreak: selectedMatchForBreak ? (categories.find(c => c.name === selectedMatchForBreak.categoryName)?.matchBreak || 5) : 5,
            matchDuration: selectedMatchForBreak ? (() => {
                const category = categories.find(c => c.name === selectedMatchForBreak.categoryName);
                if (!category) return 45;
                const periods = category.periods || 2;
                const periodDuration = category.periodDuration || 20;
                const breakDuration = category.breakDuration || 2;
                return (periodDuration + breakDuration) * periods - breakDuration;
            })() : 45
        }),
        React.createElement(GenerationTypeModal, {
            isOpen: isGenerationTypeModalOpen,
            onClose: () => setIsGenerationTypeModalOpen(false),
            onSelectType: (type) => {
                setIsGenerationTypeModalOpen(false);
                if (type === 'regular') setIsModalOpen(true);
                else if (type === 'placement') setIsPlacementMatchModalOpen(true);
            }
        }),
        React.createElement(PlacementMatchModal, {
            isOpen: isPlacementMatchModalOpen,
            onClose: () => setIsPlacementMatchModalOpen(false),
            onConfirm: (matchData) => { savePlacementMatch(matchData); setIsPlacementMatchModalOpen(false); },
            categories: categories,
            groupsByCategory: groupsByCategory,
            teams: teamData
        }),
        React.createElement(SwapMatchesModal, {
            isOpen: isSwapMatchesModalOpen,
            onClose: () => { setIsSwapMatchesModalOpen(false); setPendingSwap(null); },
            onConfirm: (swapData) => handleSwapMatches(swapData),
            sourceHallId: pendingSwap?.sourceHallId,
            sourceDate: pendingSwap?.sourceDate,
            isWholeHall: pendingSwap?.isWholeHall || false,
            sportHalls: sportHalls,
            availableDays: availableDays
        }),

        // ===== FILTER PANEL =====
        React.createElement(
            'div',
            { className: 'fixed top-12 left-0 right-0 z-50 flex justify-center pt-2', style: { pointerEvents: 'none' } },
            React.createElement(
                'div',
                { className: `group ${(isPinned || (isFilterActive && !hasVisibleHalls)) ? 'always-visible' : ''}`, style: { pointerEvents: 'auto' } },
                React.createElement('div', { className: 'w-full h-2 bg-transparent' }),
                React.createElement(
                    'div',
                    { className: `flex flex-col gap-2 transition-opacity duration-300 ease-in-out ${isPinned ? 'opacity-100' : (isFilterActive && !hasVisibleHalls) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-[.dropdown-open]:opacity-100'}`, style: { transform: 'translateY(0)', pointerEvents: 'auto' } },
                    React.createElement(
                        'div',
                        { className: 'flex flex-wrap items-center justify-center gap-2 bg-white/95 backdrop-blur-sm p-3 rounded-xl shadow-lg border border-gray-200' },
                        React.createElement(
                            'button',
                            { onClick: () => setIsPinned(!isPinned), className: `px-2 py-1.5 rounded-lg transition-colors ${isPinned ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`, title: isPinned ? 'Pripnuté' : 'Odopnuté' },
                            React.createElement('i', { className: `fa-solid ${isPinned ? 'fa-thumbtack' : 'fa-thumbtack'} transition-transform`, style: { transform: isPinned ? 'rotate(-90deg)' : 'none' } })
                        ),
                        React.createElement(
                            'div',
                            { className: 'flex items-center gap-1' },
                            React.createElement('label', { className: 'text-sm font-medium text-gray-700 whitespace-nowrap' }, 'Kategória:'),
                            React.createElement(MultiSelectDropdown, {
                                options: [...categories].sort((a, b) => a.name.localeCompare(b.name)),
                                selectedValues: selectedCategoriesFilter,
                                onToggle: toggleCategory,
                                label: 'Všetky kategórie',
                                getOptionLabel: (id) => categories.find(c => c.id === id)?.name || id,
                                getOptionCount: (id) => matches.filter(m => m.categoryId === id).length
                            })
                        ),
                        React.createElement(
                            'div',
                            { className: 'flex items-center gap-1' },
                            React.createElement('label', { className: 'text-sm font-medium text-gray-700 whitespace-nowrap' }, 'Skupina:'),
                            React.createElement(
                                'select',
                                { value: selectedGroupFilter, onChange: (e) => { setSelectedGroupFilter(e.target.value); e.target.blur(); }, disabled: selectedCategoriesFilter.length !== 1, className: `px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-black min-w-[140px] ${selectedCategoriesFilter.length !== 1 ? 'bg-gray-100 cursor-not-allowed' : ''}` },
                                React.createElement('option', { value: '' }, 'Všetky skupiny'),
                                availableGroupsForFilter.map(group => React.createElement('option', { key: group.name, value: group.name }, group.name))
                            )
                        ),
                        React.createElement(
                            'div',
                            { className: 'flex items-center gap-1' },
                            React.createElement('label', { className: 'text-sm font-medium text-gray-700 whitespace-nowrap' }, 'ID tímu:'),
                            React.createElement(
                                'select',
                                { value: selectedTeamIdFilter, onChange: (e) => { setSelectedTeamIdFilter(e.target.value); e.target.blur(); }, className: 'px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-black min-w-[200px]' },
                                React.createElement('option', { value: '' }, 'Všetky tímy'),
                                getAllUniqueTeamIds().map(teamId => {
                                    const teamName = getTeamNameByIdentifier(teamId);
                                    const displayText = teamName !== teamId ? `${teamId} - ${teamName}` : teamId;
                                    return React.createElement('option', { key: teamId, value: teamId }, displayText);
                                })
                            )
                        ),
                        React.createElement(
                            'div',
                            { className: 'flex items-center gap-1' },
                            React.createElement('label', { className: 'text-sm font-medium text-gray-700 whitespace-nowrap' }, 'Hala:'),
                            React.createElement(
                                'select',
                                { value: selectedHallFilter, onChange: (e) => { setSelectedHallFilter(e.target.value); e.target.blur(); }, className: 'px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-black min-w-[140px]' },
                                React.createElement('option', { value: '' }, 'Všetky haly'),
                                sortedSportHalls.map(hall => React.createElement('option', { key: hall.id, value: hall.id }, hall.name))
                            )
                        ),
                        React.createElement(
                            'div',
                            { className: 'flex items-center gap-1' },
                            React.createElement('label', { className: 'text-sm font-medium text-gray-700 whitespace-nowrap' }, 'Deň:'),
                            React.createElement(
                                'select',
                                { value: selectedDayFilter, onChange: (e) => { setSelectedDayFilter(e.target.value); e.target.blur(); }, className: 'px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-black min-w-[140px]' },
                                React.createElement('option', { value: '' }, 'Všetky dni'),
                                availableDays.map(day => {
                                    const [year, month, dayNum] = day.value.split('-').map(Number);
                                    const dateObj = new Date(year, month - 1, dayNum);
                                    const dayName = getDayName(dateObj);
                                    return React.createElement('option', { key: day.value, value: day.value }, `${dayName} ${day.label}`);
                                })
                            )
                        ),
                        React.createElement(
                            'button',
                            { onClick: () => { setSelectedCategoriesFilter([]); setSelectedGroupFilter(''); setSelectedHallFilter(''); setSelectedDayFilter(''); setSelectedTeamIdFilter(''); }, className: 'px-3 py-1.5 text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors whitespace-nowrap' },
                            React.createElement('i', { className: 'fa-solid fa-rotate-left mr-1' }),
                            'Reset'
                        ),
                        React.createElement(
                            'button',
                            { onClick: () => { const url = new URL(window.location.href); url.searchParams.set('view', 'spider'); window.location.href = url.toString(); }, className: 'px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors whitespace-nowrap ml-2', title: 'Prejsť do zobrazenia pavúka (semifinále, finále, o 3. miesto)' },
                            'Pavúk'
                        )
                    ),
                    generationInProgress && React.createElement(
                        'div',
                        { className: 'flex items-center gap-2 text-blue-600 bg-blue-50/90 backdrop-blur-sm px-4 py-2 rounded-lg shadow-md border border-blue-200' },
                        React.createElement('div', { className: 'animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600' }),
                        React.createElement('span', { className: 'text-sm font-medium' }, 'Generujem zápasy...')
                    )
                )
            )
        ),

        // ===== FLOATING ACTION BUTTONS =====
        React.createElement(
            'div',
            { className: 'fixed bottom-8 right-8 z-50', style: { filter: 'drop-shadow(0 10px 15px rgba(0,0,0,0.2))', width: '64px', height: '64px' } },
            React.createElement(
                'div',
                { className: 'absolute rounded-full overflow-hidden', style: { width: '64px', height: '64px', clipPath: 'polygon(0 0, 100% 0, 0 100%)', border: hasCompletedMatch ? '4px solid #16a34a' : 'none', boxSizing: 'border-box', top: 0, left: 0 } },
                React.createElement(
                    'button',
                    { className: `w-full h-full ${hasCompletedMatch ? 'bg-white cursor-not-allowed' : (generationInProgress ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700')} transition-all duration-200 outline-none ring-0 focus:outline-none focus:ring-0`, onClick: hasCompletedMatch ? undefined : () => setIsGenerationTypeModalOpen(true), disabled: generationInProgress || hasCompletedMatch },
                    React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', position: 'relative' } },
                        React.createElement('i', { className: `fa-solid fa-plus text-2xl ${hasCompletedMatch ? 'text-green-600' : 'text-white'}`, style: { position: 'absolute', top: '30%', left: '30%', transform: 'translate(-50%, -50%)' } })
                    )
                )
            ),
            React.createElement(
                'div',
                { className: 'absolute rounded-full overflow-hidden', style: { width: '64px', height: '64px', clipPath: 'polygon(100% 0, 100% 100%, 0 100%)', border: hasCompletedMatch ? '4px solid #ef4444' : 'none', boxSizing: 'border-box', top: 0, left: 0 } },
                React.createElement(
                    'button',
                    { className: `w-full h-full ${hasCompletedMatch ? 'bg-white cursor-not-allowed' : (generationInProgress ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700')} transition-all duration-200 outline-none ring-0 focus:outline-none focus:ring-0`, onClick: hasCompletedMatch ? undefined : () => setIsDeleteMatchesModalOpen(true), disabled: generationInProgress || hasCompletedMatch },
                    React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', position: 'relative' } },
                        React.createElement('i', { className: `fa-solid fa-minus text-2xl ${hasCompletedMatch ? 'text-red-600' : 'text-white'}`, style: { position: 'absolute', bottom: '30%', right: '30%', transform: 'translate(50%, 50%)' } })
                    )
                )
            ),
            hasCompletedMatch && React.createElement(
                'div',
                { style: { position: 'absolute', top: '10px', left: '54px', width: '54px', height: '54px', pointerEvents: 'none', zIndex: 80 } },
                React.createElement('div', { style: { position: 'absolute', top: 0, left: 0, width: 'calc(100% + 8px)', height: '4px', backgroundColor: '#16a34a', transform: 'rotate(135deg)', transformOrigin: 'top left', borderRadius: '4px' } }),
                React.createElement('div', { style: { position: 'absolute', top: '3px', left: '3px', width: 'calc(100% + 8px)', height: '4px', backgroundColor: '#ef4444', transform: 'rotate(135deg)', transformOrigin: 'top left', borderRadius: '4px' } })
            )
        ),

        // ===== MAIN CONTENT =====
        React.createElement(
            'div',
            { className: 'flex-grow flex justify-center items-start w-full' },
            React.createElement(
                'div',
                { className: 'bg-white p-8', style: { width: '100%', maxWidth: '100%' } },
                React.createElement(
                    'div',
                    { className: 'flex flex-col lg:flex-row gap-6 mt-4 min-h-[700px]' },
                    // Unassigned matches panel
                    filteredUnassignedMatches.length > 0 && React.createElement(
                        'div',
                        { className: 'w-[550px] bg-gray-50 rounded-xl p-4 border border-gray-200 flex flex-col h-full flex-shrink-0' },
                        React.createElement(
                            'div',
                            { className: 'flex-shrink-0' },
                            React.createElement(
                                'div',
                                { className: 'flex items-center justify-between border-b pb-2' },
                                React.createElement('h3', { className: 'text-xl font-semibold text-gray-700' }, 'Nepriradené zápasy'),
                                React.createElement('span', { className: 'text-sm font-normal text-gray-500' }, `(${filteredUnassignedMatches.length})`)
                            )
                        ),
                        React.createElement(
                            'div',
                            { className: 'flex-1 overflow-y-auto pr-2 space-y-3 mt-4' },
                            filteredUnassignedMatches.map(match => {
                                const homeTeamDisplay = getTeamDisplayText(match.homeTeamIdentifier);
                                const awayTeamDisplay = getTeamDisplayText(match.awayTeamIdentifier);
                                const accommodationsMap = window.__teamAccommodationsMap || new Map();
                                let homeTeamColor = '#f3f4f6', awayTeamColor = '#f3f4f6';
                                const homeAccommodationName = accommodationsMap.get(match.homeTeamIdentifier);
                                const awayAccommodationName = accommodationsMap.get(match.awayTeamIdentifier);
                                const homeTeamNameForColor = getTeamNameByIdentifier(match.homeTeamIdentifier);
                                const awayTeamNameForColor = getTeamNameByIdentifier(match.awayTeamIdentifier);
                                if (homeAccommodationName && !homeTeamNameForColor.includes(match.categoryName)) {
                                    const accommodation = accommodations.find(a => a.name === homeAccommodationName);
                                    if (accommodation) homeTeamColor = accommodation.headerColor;
                                } else if (!homeAccommodationName && !homeTeamNameForColor.includes(match.categoryName)) homeTeamColor = '#ffff00';
                                if (awayAccommodationName && !awayTeamNameForColor.includes(match.categoryName)) {
                                    const accommodation = accommodations.find(a => a.name === awayAccommodationName);
                                    if (accommodation) awayTeamColor = accommodation.headerColor;
                                } else if (!awayAccommodationName && !awayTeamNameForColor.includes(match.categoryName)) awayTeamColor = '#ffff00';
                                let categoryColor = '#f3f4f6';
                                if (match.categoryName) {
                                    const foundCategory = categories.find(c => c.name === match.categoryName);
                                    if (foundCategory && foundCategory.drawColor) categoryColor = foundCategory.drawColor;
                                }
                                const isSpecialMatch = (match.matchType && !match.isPlacementMatch) || match.isPlacementMatch === true;
                                let specialMatchText = '';
                                if (match.isPlacementMatch && match.placementRank) specialMatchText = `o ${match.placementRank}. miesto`;
                                else if (match.matchType && !match.isPlacementMatch) {
                                    let matchTypeText = match.matchType;
                                    const lastChar = matchTypeText.charAt(matchTypeText.length - 1);
                                    if (lastChar >= 'A' && lastChar <= 'Z') matchTypeText = matchTypeText.substring(0, matchTypeText.length - 1).trim();
                                    specialMatchText = matchTypeText;
                                }
                                const extractLetterAndNumber = (identifier) => {
                                    if (!identifier) return { letter: '', number: '' };
                                    const parts = identifier.split(' ');
                                    const lastPart = parts[parts.length - 1];
                                    let letter = '', number = '';
                                    for (let i = 0; i < lastPart.length; i++) {
                                        const char = lastPart[i];
                                        if (char >= '0' && char <= '9') { letter = lastPart.substring(0, i); number = lastPart.substring(i); break; }
                                    }
                                    if (number === '') letter = lastPart;
                                    return { letter, number };
                                };
                                const homeExtracted = extractLetterAndNumber(match.homeTeamIdentifier);
                                const awayExtracted = extractLetterAndNumber(match.awayTeamIdentifier);
                                const combinedNumbers = homeExtracted.number && awayExtracted.number ? homeExtracted.number + '-' + awayExtracted.number : (homeExtracted.number || awayExtracted.number || '');
                                const lettersAreSame = homeExtracted.letter && awayExtracted.letter && homeExtracted.letter === awayExtracted.letter;
                                const letterToShow = lettersAreSame ? homeExtracted.letter : '';
                                const getTotalMembersCountForMatch = (teamIdentifier, matchCategoryName) => {
                                    if (!teamIdentifier) return 0;
                                    let teamDisplayName = null;
                                    if (window.teamManager && typeof window.teamManager.getTeamNameByDisplayIdSync === 'function') {
                                        try { teamDisplayName = window.teamManager.getTeamNameByDisplayIdSync(teamIdentifier); } catch (e) {}
                                    }
                                    const actualTeamName = teamDisplayName || teamIdentifier;
                                    if (!window.__allUsersCache) return 0;
                                    for (const user of window.__allUsersCache) {
                                        if (!user.teams) continue;
                                        for (const [category, teamsArray] of Object.entries(user.teams)) {
                                            if (!Array.isArray(teamsArray)) continue;
                                            const team = teamsArray.find(t => t.teamName === actualTeamName && (category === matchCategoryName || t._category === matchCategoryName || t.category === matchCategoryName));
                                            if (team) {
                                                const playersCount = team.playerDetails?.length || 0;
                                                const womenTeamMembersCount = team.womenTeamMemberDetails?.length || 0;
                                                const menTeamMembersCount = team.menTeamMemberDetails?.length || 0;
                                                const womenDriversCount = team.driverDetailsFemale?.length || 0;
                                                const menDriversCount = team.driverDetailsMale?.length || 0;
                                                return playersCount + womenTeamMembersCount + menTeamMembersCount + womenDriversCount + menDriversCount;
                                            }
                                        }
                                    }
                                    return 0;
                                };
                                const homeMemberCount = getTotalMembersCountForMatch(match.homeTeamIdentifier, match.categoryName);
                                const awayMemberCount = getTotalMembersCountForMatch(match.awayTeamIdentifier, match.categoryName);
                                return React.createElement(
                                    'div',
                                    {
                                        key: match.id,
                                        className: 'bg-white p-0 rounded border border-gray-200 hover:border-blue-400 hover:shadow-sm transition-all relative group/match cursor-pointer',
                                        style: { width: '100%' },
                                        onClick: () => handleMatchCardClick(match),
                                        title: hasCompletedMatch ? '' : 'Kliknite pre úpravu zápasu'
                                    },
                                    React.createElement(
                                        'div',
                                        { className: 'grid items-start text-xs', style: { gridTemplateColumns: '200px 10px 200px 10px 50px 30px', width: '100%' } },
                                        React.createElement(
                                            'div',
                                            {
                                                className: 'px-0 py-0 flex items-center justify-center border-r border-gray-300',
                                                style: {
                                                    textAlign: 'center',
                                                    backgroundColor: match.homeBgColor || 'transparent'
                                                }
                                            },
                                            React.createElement(
                                                'span',
                                                {
                                                    className: (selectedTeamIdFilter && match.homeTeamIdentifier === selectedTeamIdFilter ? 'font-bold' : 'font-medium') + ' truncate block w-full',
                                                    style: {
                                                        color: '#000000',
                                                        fontWeight: match.homeTeamInConflict ? 'bold' : undefined
                                                    },
                                                    title: homeTeamDisplay.name
                                                },
                                                homeTeamDisplay.name
                                            )
                                        ),
                                        React.createElement('div', { className: 'px-0 py-0 flex items-center justify-center border-r border-gray-300', style: { textAlign: 'center', backgroundColor: homeTeamColor, width: '10px', height: '100%', fontSize: '9px', fontWeight: 'bold', color: '#000000' }, title: `Počet členov tímu: ${homeMemberCount || 0}` }, React.createElement('span', null, homeMemberCount || 0)),
                                        React.createElement(
                                            'div',
                                            {
                                                className: 'px-2 py-0 flex items-center justify-center border-r border-gray-300',
                                                style: {
                                                    textAlign: 'center',
                                                    backgroundColor: match.awayBgColor || 'transparent'
                                                }
                                            },
                                            React.createElement(
                                                'span',
                                                {
                                                    className: (selectedTeamIdFilter && match.awayTeamIdentifier === selectedTeamIdFilter ? 'font-bold' : 'font-medium') + ' truncate block w-full',
                                                    style: {
                                                        color: '#000000',
                                                        fontWeight: match.awayTeamInConflict ? 'bold' : undefined
                                                    },
                                                    title: awayTeamDisplay.name
                                                },
                                                awayTeamDisplay.name
                                            )
                                        ),
                                        React.createElement('div', { className: 'px-0 py-0 flex items-center justify-center border-r border-gray-300', style: { textAlign: 'center', backgroundColor: awayTeamColor, width: '10px', height: '100%', fontSize: '9px', fontWeight: 'bold', color: '#000000' }, title: `Počet členov tímu: ${awayMemberCount || 0}` }, React.createElement('span', null, awayMemberCount || 0)),
                                        !isSpecialMatch && React.createElement(
                                            React.Fragment,
                                            null,
                                            React.createElement('div', { className: 'px-2 py-1 flex items-center justify-center border-r border-gray-300', style: { textAlign: 'center', backgroundColor: 'transparent' } }, React.createElement('span', { className: (selectedTeamIdFilter && (match.homeTeamIdentifier === selectedTeamIdFilter || match.awayTeamIdentifier === selectedTeamIdFilter) ? 'font-bold' : 'font-medium') + ' text-black font-mono text-[10px] truncate block w-full' }, combinedNumbers)),
                                            React.createElement('div', { className: 'px-2 py-1 flex items-center justify-center', style: { textAlign: 'center', backgroundColor: categoryColor, fontWeight: 'bold', borderRadius: '4px' } }, React.createElement('span', { className: 'text-black font-bold text-xs truncate block w-full', style: { color: '#000', textShadow: 'none' } }, letterToShow || ''))
                                        ),
                                        isSpecialMatch && React.createElement('div', { className: 'px-1 py-1 flex items-center justify-center', style: { textAlign: 'center', backgroundColor: categoryColor, fontWeight: 'bold', borderRadius: '4px', gridColumn: 'span 2', whiteSpace: 'nowrap', wordBreak: 'keep-all', width: '90%', marginLeft: 'auto', marginRight: '0' } }, React.createElement('span', { className: 'text-black font-bold text-[10px] block w-full', style: { color: '#000', textShadow: 'none', whiteSpace: 'nowrap', wordBreak: 'keep-all' } }, specialMatchText))
                                    ),
                                    !hasCompletedMatch && userProfileData?.role === 'admin' && React.createElement(
                                        'div',
                                        { className: 'absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover/match:opacity-100 transition-opacity' },
                                        React.createElement('button', { className: 'w-6 h-6 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center justify-center shadow-md flex-shrink-0', onClick: (e) => { e.stopPropagation(); handleSwapClick(match); }, title: 'Vymeniť domáci a hosťovský tím' }, React.createElement('i', { className: 'fa-solid fa-arrow-right-arrow-left text-xs' })),
                                        !match.matchType && React.createElement('button', { className: 'w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-md flex-shrink-0', onClick: (e) => { e.stopPropagation(); handleDeleteClick(match); }, title: 'Zmazať zápas' }, React.createElement('i', { className: 'fa-solid fa-trash-can text-xs' }))
                                    )
                                );
                            })
                        )
                    ),
                    // Halls panel
                    React.createElement(
                        'div',
                        { className: 'flex-1 flex flex-col' },
                        React.createElement('h3', { className: 'text-xl font-semibold mb-4 text-gray-700 pb-2 flex-shrink-0' },
                            React.createElement('i', { className: 'fa-solid fa-futbol mr-2 text-red-500' }),
                            'Športové haly',
                            React.createElement('span', { className: 'ml-2 text-sm font-normal text-gray-500' }, `(${filteredSportHalls.length} ${filteredSportHalls.length === 1 ? 'hala' : filteredSportHalls.length < 5 ? 'haly' : 'hál'})`)
                        ),
                        loading && React.createElement(
                            'div',
                            { className: 'flex-1 flex justify-center items-center py-12' },
                            React.createElement('div', { className: 'animate-spin rounded-full h-12 w-12 border-b-4 border-blue-500' })
                        ),
                        !loading && sportHalls.length === 0 && React.createElement(
                            'div',
                            { className: 'flex-1 flex items-center justify-center text-center py-12 text-gray-500 bg-gray-50 rounded-lg' },
                            React.createElement('div', null, React.createElement('i', { className: 'fa-solid fa-map-pin text-5xl mb-4 opacity-30' }), React.createElement('p', { className: 'text-lg' }, 'Žiadne športové haly nie sú k dispozícii'), React.createElement('p', { className: 'text-sm mt-2' }, 'Pridajte prvú športovú halu v mape.'))
                        ),
                        !loading && sportHalls.length > 0 && (() => {
                            const visibleHalls = [];
                            for (const hall of sortedFilteredSportHalls) {
                                const hasAnyMatch = matches.some(match => match.hallId === hall.id);
                                const isFilterActiveLocal = selectedCategoriesFilter.length > 0 || selectedGroupFilter || selectedTeamIdFilter;
                                let hasVisibleDays = false;
                                if (tournamentStartDate && tournamentEndDate) {
                                    const startDate = new Date(tournamentStartDate);
                                    const endDate = new Date(tournamentEndDate);
                                    startDate.setHours(0, 0, 0, 0);
                                    endDate.setHours(0, 0, 0, 0);
                                    const currentDate = new Date(startDate);
                                    while (currentDate <= endDate) {
                                        const dateStr = getLocalDateStr(currentDate);
                                        const matchesDayFilter = !selectedDayFilter || selectedDayFilter === dateStr;
                                        if (matchesDayFilter) {
                                            const hallMatchesForDay = getMatchesForHallAndDay(hall.id, currentDate);
                                            const filteredMatches = hallMatchesForDay.filtered || [];
                                            const matchesCount = hallMatchesForDay.allMatches?.length || 0;
                                            if (isFilterActiveLocal) { if (matchesCount > 0) { hasVisibleDays = true; break; } }
                                            else { hasVisibleDays = true; break; }
                                        }
                                        currentDate.setDate(currentDate.getDate() + 1);
                                    }
                                }
                                if (hasVisibleDays || (!isFilterActiveLocal && !tournamentStartDate)) visibleHalls.push(hall);
                            }
                            const visibleHallsCount = visibleHalls.length;
                            const containerWidth = visibleHallsCount * (695 + 24);
                            return React.createElement(
                                'div',
                                { className: 'flex flex-row gap-6', style: { width: `${containerWidth}px`, minWidth: '100%' } },
                                sortedFilteredSportHalls.map((hall) => {
                                    const typeConfig = typeIcons[hall.type] || { icon: 'fa-futbol', color: '#dc2626' };
                                    const hasAnyMatch = matches.some(match => match.hallId === hall.id);
                                    const isFilterActiveLocal = selectedCategoriesFilter.length > 0 || selectedGroupFilter || selectedTeamIdFilter;
                                    const dayCards = [];
                                    if (tournamentStartDate && tournamentEndDate) {
                                        const startDate = new Date(tournamentStartDate);
                                        const endDate = new Date(tournamentEndDate);
                                        startDate.setHours(0, 0, 0, 0);
                                        endDate.setHours(0, 0, 0, 0);
                                        const currentDate = new Date(startDate);
                                        while (currentDate <= endDate) {
                                            const dateStr = getLocalDateStr(currentDate);
                                            const matchesDayFilter = !selectedDayFilter || selectedDayFilter === dateStr;
                                            if (matchesDayFilter) {
                                                const hallMatchesForDay = getMatchesForHallAndDay(hall.id, currentDate);
                                                const filteredMatches = hallMatchesForDay.filtered || [];
                                                const matchesCount = filteredMatches.length;
                                                dayCards.push({
                                                    date: new Date(currentDate),
                                                    dateStr: dateStr,
                                                    matches: filteredMatches,
                                                    matchesCount: matchesCount,
                                                    isEmpty: matchesCount === 0
                                                });
                                            }
                                            currentDate.setDate(currentDate.getDate() + 1);
                                        }
                                    }
                                    if (isFilterActiveLocal && dayCards.every(card => card.isEmpty)) return null;
                                    return React.createElement(
                                        'div',
                                        {
                                            key: hall.id,
                                            className: `bg-white rounded-xl border-2 border-gray-200 ${hasCompletedMatch ? '' : 'shadow-sm hover:shadow-md'} transition-shadow group flex-shrink-0`,
                                            style: { width: '695px', minWidth: '695px' }
                                        },
                                        React.createElement(
                                            'div',
                                            { className: 'p-5 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200' },
                                            React.createElement(
                                                'div',
                                                { className: 'flex items-center' },
                                                React.createElement(
                                                    'div',
                                                    { className: 'w-14 h-14 rounded-full flex items-center justify-center mr-4 flex-shrink-0', style: { backgroundColor: typeConfig.color + '20', border: `3px solid ${typeConfig.color}` } },
                                                    React.createElement('i', { className: `fa-solid ${typeConfig.icon} text-2xl`, style: { color: typeConfig.color } })
                                                ),
                                                React.createElement(
                                                    'div',
                                                    { className: 'flex-1' },
                                                    React.createElement(
                                                        'div',
                                                        { className: 'flex items-center justify-between' },
                                                        React.createElement('h4', { className: 'font-bold text-xl text-gray-800' }, hall.name)
                                                    ),
                                                    React.createElement(
                                                        'div',
                                                        { className: 'flex items-center gap-2 mt-1' },
                                                        React.createElement('span', { className: 'inline-block px-3 py-1 text-xs font-medium rounded-full', style: { backgroundColor: typeConfig.color + '20', color: typeConfig.color } }, 'Športová hala'),
                                                        userProfileData?.role === 'admin' && hasAnyMatch && !hasCompletedMatch && React.createElement(
                                                            'div',
                                                            { className: 'flex gap-1 ml-2' },
                                                            React.createElement('button', { className: 'opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8 bg-purple-500 hover:bg-purple-600 text-white rounded-full flex items-center justify-center shadow-md flex-shrink-0', onClick: (e) => { e.stopPropagation(); setPendingSwap({ sourceHallId: hall.id, sourceDate: null, isWholeHall: true }); setIsSwapMatchesModalOpen(true); }, title: 'Vymeniť zápasy s inou halou (vzájomná výmena)' }, React.createElement('i', { className: 'fa-solid fa-arrows-spin text-sm' })),
                                                            React.createElement('button', { className: 'opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-md flex-shrink-0', onClick: (e) => { e.stopPropagation(); handleBulkUnassign(hall.id, null, true); }, title: 'Odstrániť priradenie všetkých zápasov z tejto haly' }, React.createElement('i', { className: 'fa-solid fa-trash-can text-sm' }))
                                                        )
                                                    )
                                                )
                                            )
                                        ),
                                        dayCards.length > 0 && React.createElement(
                                            'div',
                                            { className: 'p-4 bg-gray-50 flex flex-col gap-2', style: { width: '100%' } },
                                            dayCards.map((dayCard, index) => {
                                                const date = dayCard.date;
                                                const dateStr = dayCard.dateStr;
                                                const hallDayData = getMatchesForHallAndDay(hall.id, date);
                                                const hallMatches = hallDayData?.filtered || [];
                                                const allMatchesForDay = hallDayData?.allMatches || [];
                                                const matchesCount = hallMatches.length;
                                                const isEmpty = matchesCount === 0;
                                                const hasUnassignedMatches = filteredUnassignedMatches.length > 0;
                                                const showEmptyMessage = isEmpty && isFilterActiveLocal;
                                                const isFilterActiveForDay = selectedCategoriesFilter.length > 0 || selectedGroupFilter || selectedTeamIdFilter;
                                                const uniqueGroups = [...new Set(hallMatches.map(m => m.groupName).filter(Boolean))];
                                                const groupsCount = uniqueGroups.length;
                                                const groupAlignmentMap = {};
                                                if (groupsCount === 1) groupAlignmentMap[uniqueGroups[0]] = 'center';
                                                else if (groupsCount === 2) { groupAlignmentMap[uniqueGroups[0]] = 'left'; groupAlignmentMap[uniqueGroups[1]] = 'right'; }
                                                else if (groupsCount === 3) { groupAlignmentMap[uniqueGroups[0]] = 'left'; groupAlignmentMap[uniqueGroups[1]] = 'center'; groupAlignmentMap[uniqueGroups[2]] = 'right'; }
                                                else if (groupsCount === 4) { groupAlignmentMap[uniqueGroups[0]] = 'left'; groupAlignmentMap[uniqueGroups[1]] = 'center-left'; groupAlignmentMap[uniqueGroups[2]] = 'center-right'; groupAlignmentMap[uniqueGroups[3]] = 'right'; }
                                                else if (groupsCount >= 5) { uniqueGroups.forEach((group, index) => { if (index === 0) groupAlignmentMap[group] = 'left'; else if (index === groupsCount - 1) groupAlignmentMap[group] = 'right'; else groupAlignmentMap[group] = 'center'; }); }
                                                const cardId = `${hall.id}_${dateStr}`;
                                                const dateKey = dateStr;
                                                const maxHeightForDate = maxHeightsByDate[dateKey] || 0;
                                                return React.createElement(
                                                    'div',
                                                    {
                                                        key: index,
                                                        className: `day-card-measure flex flex-col p-3 bg-white rounded-lg border border-gray-200 ${hasCompletedMatch ? '' : 'hover:border-blue-400 hover:shadow-sm'} transition-all group/day ${hasCompletedMatch ? 'cursor-default' : 'cursor-pointer'}`,
                                                        style: { width: '100%', minHeight: heightsCalculated && maxHeightForDate > 0 ? `${maxHeightForDate}px` : 'auto', cursor: 'default' },
                                                        'data-card-id': cardId,
                                                        'data-date-key': dateKey
                                                    },
                                                    React.createElement(
                                                        'div',
                                                        { className: `flex items-center justify-between mb-2 pb-1 border-b border-gray-100 ${hasCompletedMatch ? 'cursor-default' : 'cursor-pointer hover:bg-blue-50'} p-2 -m-2 rounded transition-colors`, onClick: hasCompletedMatch ? undefined : (e) => { e.stopPropagation(); handleHallDayHeaderClick(hall, date, dateStr); }, title: hasCompletedMatch ? 'Nie je možné nastaviť čas, pretože už existuje ukončený zápas v systéme.' : 'Kliknite pre nastavenie času začiatku prvého zápasu', style: { width: '100%' } },
                                                        React.createElement(
                                                            'div',
                                                            { className: 'flex items-center gap-2 whitespace-nowrap' },
                                                            React.createElement('i', { className: 'fa-solid fa-calendar-day text-gray-400 text-sm flex-shrink-0' }),
                                                            React.createElement('span', { className: 'text-sm font-semibold text-gray-800' }, formatDateWithDay(date)),
                                                            (() => {
                                                                const scheduleId = `${hall.id}_${getLocalDateStr(date)}`;
                                                                const savedSchedule = hallSchedules[scheduleId];
                                                                if (savedSchedule?.startTime) return React.createElement('span', { className: 'text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full ml-2 whitespace-nowrap' }, React.createElement('i', { className: 'fa-regular fa-clock mr-1 text-xs flex-shrink-0' }), savedSchedule.startTime);
                                                                return React.createElement('i', { className: 'fa-regular fa-clock text-xs text-blue-400 ml-1 opacity-0 group-hover/day:opacity-100 transition-opacity flex-shrink-0' });
                                                            })()
                                                        ),
                                                        !isEmpty && userProfileData?.role === 'admin' && !hasCompletedMatch && React.createElement(
                                                            'div',
                                                            { className: 'flex gap-1 ml-2' },
                                                            React.createElement('button', { className: 'opacity-0 group-hover/day:opacity-100 transition-opacity w-6 h-6 bg-purple-500 hover:bg-purple-600 text-white rounded-full flex items-center justify-center shadow-md flex-shrink-0', onClick: (e) => { e.stopPropagation(); setPendingSwap({ sourceHallId: hall.id, sourceDate: dateStr, isWholeHall: false }); setIsSwapMatchesModalOpen(true); }, title: 'Vymeniť zápasy s iným dňom/halou (vzájomná výmena)' }, React.createElement('i', { className: 'fa-solid fa-arrows-spin text-xs' })),
                                                            React.createElement('button', { className: 'opacity-0 group-hover/day:opacity-100 transition-opacity w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-md flex-shrink-0', onClick: (e) => { e.stopPropagation(); handleBulkUnassign(hall.id, dateStr, false); }, title: 'Odstrániť priradenie všetkých zápasov z tohto dňa' }, React.createElement('i', { className: 'fa-solid fa-trash-can text-xs' }))
                                                        ),
                                                        React.createElement(
                                                            'div',
                                                            { className: 'flex items-center gap-2 flex-shrink-0' },
                                                            isEmpty ? React.createElement('span', { className: 'text-xs text-gray-400 whitespace-nowrap' }, showEmptyMessage ? 'Filtrované' : 'Žiadne zápasy') : React.createElement(
                                                                React.Fragment,
                                                                null,
                                                                React.createElement('span', { className: 'text-xs text-gray-500 whitespace-nowrap' }, (() => { if (matchesCount === 1) return `${matchesCount} zápas`; if (matchesCount >= 2 && matchesCount <= 4) return `${matchesCount} zápasy`; return `${matchesCount} zápasov`; })()),
                                                                React.createElement('span', { className: 'w-2 h-2 bg-green-500 rounded-full flex-shrink-0' })
                                                            )
                                                        )
                                                    ),
                                                    !isEmpty ? (
                                                        React.createElement(
                                                            'div',
                                                            { className: 'space-y-0', style: { width: '100%' } },
                                                            (function() {
                                                                const sortedMatches = hallMatches.sort((a, b) => {
                                                                    if (!a.scheduledTime) return 1;
                                                                    if (!b.scheduledTime) return -1;
                                                                    try { return a.scheduledTime.toDate().getTime() - b.scheduledTime.toDate().getTime(); } catch (e) { return 0; }
                                                                });
                                                                const allSortedMatches = allMatchesForDay.sort((a, b) => {
                                                                    if (!a.scheduledTime) return 1;
                                                                    if (!b.scheduledTime) return -1;
                                                                    try { return a.scheduledTime.toDate().getTime() - b.scheduledTime.toDate().getTime(); } catch (e) { return 0; }
                                                                });
                                                                const allElements = [];
                                                                const formatTimeFromMinutes = (minutes) => {
                                                                    const hours = Math.floor(minutes / 60).toString().padStart(2, '0');
                                                                    const mins = (minutes % 60).toString().padStart(2, '0');
                                                                    return `${hours}:${mins}`;
                                                                };
                                                                const getMaxMatchDurationInDay = (matchesList) => {
                                                                    let maxDuration = 0;
                                                                    for (const match of matchesList) {
                                                                        if (match.scheduledTime) {
                                                                            const category = categories.find(c => c.name === match.categoryName);
                                                                            let matchDuration = 0;
                                                                            if (category) {
                                                                                const periods = category.periods || 2;
                                                                                const periodDuration = category.periodDuration || 20;
                                                                                const breakDuration = category.breakDuration || 2;
                                                                                matchDuration = (periodDuration + breakDuration) * periods - breakDuration;
                                                                            }
                                                                            if (matchDuration > maxDuration) maxDuration = matchDuration;
                                                                        }
                                                                    }
                                                                    return maxDuration > 0 ? maxDuration : 45;
                                                                };
                                                                const splitGapIntoBlocks = (gapMinutes, maxBlockDuration, hallId, dateStr, gapStartTimeFormatted, gapEndTimeFormatted, isGapBlocked, onToggleBlock, onAssignMatch, onDeleteGap, hasCompletedMatch, userRole, filteredUnassignedMatches, setSelectedBreakForAssign, setIsAssignToBreakModalOpen, handleDeleteBreak, nextMatchStartTime = null, matchBreak = 5, blockedBreaksParam = {}) => {
                                                                    const blocks = [];
                                                                    let remainingMinutes = gapMinutes;
                                                                    let currentStartMinutes = gapStartTimeFormatted ? (() => {
                                                                        const [hours, minutes] = gapStartTimeFormatted.split(':').map(Number);
                                                                        return hours * 60 + minutes;
                                                                    })() : 0;
                                                                    const formatTimeFromMinutes = (minutes) => {
                                                                        const hours = Math.floor(minutes / 60).toString().padStart(2, '0');
                                                                        const mins = (minutes % 60).toString().padStart(2, '0');
                                                                        return `${hours}:${mins}`;
                                                                    };
                                                                    const MIN_BLOCK_DURATION = 5;
                                                                    if (gapMinutes <= 0) return [];
                                                                    let blockIndex = 0;
                                                                    let totalBlocksDuration = 0;
                                                                    while (remainingMinutes > 0) {
                                                                        let blockDuration = Math.min(maxBlockDuration, remainingMinutes);
                                                                        const isBlockLongEnough = blockDuration >= MIN_BLOCK_DURATION;
                                                                        const blockStartTime = formatTimeFromMinutes(currentStartMinutes);
                                                                        const blockEndTime = formatTimeFromMinutes(currentStartMinutes + blockDuration);
                                                                        const uniqueBreakKey = `${hallId}_${dateStr}_${blockStartTime}`;
                                                                        const isThisBlockBlocked = blockedBreaks ? !!blockedBreaks[uniqueBreakKey] : false;
                                                                        if (isBlockLongEnough) {
                                                                            blocks.push({
                                                                                id: `block-${blockIndex}`,
                                                                                startTime: blockStartTime,
                                                                                endTime: blockEndTime,
                                                                                duration: blockDuration,
                                                                                isFirst: blockIndex === 0,
                                                                                isLast: (blockDuration === remainingMinutes),
                                                                                isBlocked: isThisBlockBlocked,
                                                                                uniqueKey: uniqueBreakKey,
                                                                                isBreak: false
                                                                            });
                                                                            totalBlocksDuration += blockDuration;
                                                                        }
                                                                        currentStartMinutes += blockDuration;
                                                                        remainingMinutes -= blockDuration;
                                                                        if (remainingMinutes > 0) {
                                                                            const breakToSubtract = Math.min(matchBreak, remainingMinutes);
                                                                            remainingMinutes -= breakToSubtract;
                                                                            currentStartMinutes += breakToSubtract;
                                                                        }
                                                                        blockIndex++;
                                                                    }
                                                                    return blocks;
                                                                };
                                                                const hasUnassignedMatches = filteredUnassignedMatches.length > 0;
                                                                if (allSortedMatches.length > 0) {
                                                                    const firstMatch = allSortedMatches[0];
                                                                    if (firstMatch.scheduledTime) {
                                                                        try {
                                                                            const firstMatchDate = firstMatch.scheduledTime.toDate();
                                                                            const firstMatchStartMinutes = firstMatchDate.getHours() * 60 + firstMatchDate.getMinutes();
                                                                            const scheduleId = `${hall.id}_${getLocalDateStr(firstMatchDate)}`;
                                                                            const savedSchedule = hallSchedules[scheduleId];
                                                                            const hallStartTimeStr = savedSchedule?.startTime;
                                                                            if (hallStartTimeStr) {
                                                                                const [hallStartHours, hallStartMinutes] = hallStartTimeStr.split(':').map(Number);
                                                                                const hallStartMinutesTotal = hallStartHours * 60 + hallStartMinutes;
                                                                                let firstMatchBreak = 5;
                                                                                const firstMatchCategory = categories.find(c => c.name === firstMatch.categoryName);
                                                                                if (firstMatchCategory) firstMatchBreak = firstMatchCategory.matchBreak || 5;
                                                                                const freeTimeStartMinutes = hallStartMinutesTotal;
                                                                                const freeTimeEndMinutes = firstMatchStartMinutes - firstMatchBreak;
                                                                                let displayGapMinutes = freeTimeEndMinutes - freeTimeStartMinutes;
                                                                                const isFilterActiveForGaps = selectedCategoriesFilter || selectedGroupFilter || selectedTeamIdFilter;
                                                                                if (displayGapMinutes > 0) {
                                                                                    const gapStartTime = hallStartTimeStr;
                                                                                    const gapEndTime = formatTimeFromMinutes(freeTimeEndMinutes);
                                                                                    const maxBlockDuration = getMaxMatchDurationInDay(sortedMatches);
                                                                                    const blocks = splitGapIntoBlocks(displayGapMinutes, maxBlockDuration, hall.id, dateStr, gapStartTime, gapEndTime, false, toggleBlockBreak, null, null, hasCompletedMatch, userProfileData?.role, filteredUnassignedMatches, setSelectedBreakForAssign, setIsAssignToBreakModalOpen, handleDeleteBreakBefore, null, firstMatchBreak, blockedBreaks);
                                                                                    blocks.forEach(block => {
                                                                                        allElements.push(
                                                                                            React.createElement(
                                                                                                'div',
                                                                                                { key: `gap-before-first-${firstMatch.id}-block-${block.id}`, className: `p-0 rounded border border-dashed border-amber-400 ${hasCompletedMatch ? '' : 'hover:border-amber-500'} transition-all relative group/gap`, style: { width: '100%', backgroundColor: block.isBlocked ? '#fed7aa' : '#fffbeb', minHeight: '18px' } },
                                                                                                React.createElement(
                                                                                                    'div',
                                                                                                    { className: 'grid items-center text-xs', style: { gridTemplateColumns: '130px 1fr', width: '100%' } },
                                                                                                    React.createElement('div', { className: 'flex flex-col items-center justify-center px-2 py-0 border-r border-gray-300', style: { minWidth: '130px', textAlign: 'center' } }, React.createElement('div', { className: 'flex items-center justify-center gap-1 w-full' }, React.createElement('i', { className: `fa-solid ${block.isBlocked ? 'fa-lock' : 'fa-hourglass-half'} text-amber-600 text-xs flex-shrink-0` }), React.createElement('span', { className: 'font-medium text-amber-700 truncate' }, `${block.startTime} - ${block.endTime}`))),
                                                                                                    React.createElement('div', { className: 'px-0 py-0 flex items-center justify-center', style: { textAlign: 'center', fontWeight: '500', color: '#d97706' } }, React.createElement('span', { className: 'text-sm font-medium' }, block.isBlocked ? 'ZABLOKOVANÝ ČAS ' : 'VOĽNÝ ČAS '), React.createElement('div', { className: 'text-[10px] text-amber-600 ml-1' }, `(${block.duration} min)`))
                                                                                                ),
                                                                                                !hasCompletedMatch && userProfileData?.role === 'admin' ? React.createElement(
                                                                                                    'div',
                                                                                                    { className: 'absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover/gap:opacity-100 transition-opacity' },
                                                                                                    React.createElement('button', { className: `w-6 h-6 ${block.isBlocked ? 'bg-orange-500 hover:bg-orange-600' : 'bg-gray-500 hover:bg-gray-600'} text-white rounded-full flex items-center justify-center shadow-md flex-shrink-0`, onClick: (e) => { e.stopPropagation(); toggleBlockBreak(hall.id, dateStr, block.startTime, block.endTime, block.duration); }, title: block.isBlocked ? 'Odblokovať voľný čas' : 'Zablokovať voľný čas' }, React.createElement('i', { className: `fa-solid ${block.isBlocked ? 'fa-unlock' : 'fa-lock'} text-xs` })),
                                                                                                    !block.isBlocked && React.createElement('button', { className: 'w-6 h-6 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center shadow-md flex-shrink-0', onClick: (e) => { e.stopPropagation(); setSelectedBreakForAssign({ hallId: hall.id, date: dateStr, breakStartTime: block.startTime, breakEndTime: block.endTime, breakDuration: block.duration, availableMatches: matches.filter(m => !m.hallId) }); setIsAssignToBreakModalOpen(true); }, title: 'Priradiť zápas do voľného času' }, React.createElement('i', { className: 'fa-solid fa-plus text-xs' })),
                                                                                                    React.createElement('button', { className: 'w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-md flex-shrink-0', onClick: (e) => { e.stopPropagation(); handleDeleteBreakBefore({ matchId: firstMatch.id, breakDuration: block.duration }); }, title: 'Odstrániť túto medzeru (posunúť prvý zápas skôr)' }, React.createElement('i', { className: 'fa-solid fa-trash-can text-xs' }))
                                                                                                ) : null
                                                                                            )
                                                                                        );
                                                                                    });
                                                                                }
                                                                            }
                                                                        } catch (e) { console.error('Chyba pri výpočte medzery pred prvým zápasom:', e); }
                                                                    }
                                                                }
                                                                sortedMatches.forEach(function(match, idx, sortedArray) {
                                                                    let matchTime = '--:--';
                                                                    let endTime = '--:--';
                                                                    if (match.scheduledTime) {
                                                                        try {
                                                                            var date = match.scheduledTime.toDate();
                                                                            matchTime = date.getHours().toString().padStart(2, '0') + ':' + date.getMinutes().toString().padStart(2, '0');
                                                                            var matchCategory = categories.find(function(c) { return c.name === match.categoryName; });
                                                                            var matchDuration = 0;
                                                                            if (matchCategory) {
                                                                                var periods = matchCategory.periods || 2;
                                                                                var periodDuration = matchCategory.periodDuration || 20;
                                                                                var breakDuration = matchCategory.breakDuration || 2;
                                                                                matchDuration = (periodDuration + breakDuration) * periods - breakDuration;
                                                                            }
                                                                            var endDateTime = new Date(date.getTime() + matchDuration * 60000);
                                                                            endTime = endDateTime.getHours().toString().padStart(2, '0') + ':' + endDateTime.getMinutes().toString().padStart(2, '0');
                                                                        } catch (e) { console.error('Chyba pri formátovaní času:', e); }
                                                                    }
                                                                    var homeDisplay = getTeamDisplayText(match.homeTeamIdentifier);
                                                                    var awayDisplay = getTeamDisplayText(match.awayTeamIdentifier);
                                                                    var categoryColor = '#f3f4f6';
                                                                    if (match.categoryName) {
                                                                        var foundCategory = categories.find(function(c) { return c.name === match.categoryName; });
                                                                        if (foundCategory && foundCategory.drawColor) categoryColor = foundCategory.drawColor;
                                                                    }
                                                                    var isSpecialMatch = (match.matchType && !match.isPlacementMatch) || match.isPlacementMatch === true;
                                                                    var specialMatchText = '';
                                                                    if (match.isPlacementMatch && match.placementRank) specialMatchText = `o ${match.placementRank}. miesto`;
                                                                    else if (match.matchType && !match.isPlacementMatch) {
                                                                        var matchTypeText = match.matchType;
                                                                        var lastChar = matchTypeText.charAt(matchTypeText.length - 1);
                                                                        if (lastChar >= 'A' && lastChar <= 'Z') matchTypeText = matchTypeText.substring(0, matchTypeText.length - 1).trim();
                                                                        specialMatchText = matchTypeText;
                                                                    }
                                                                    var extractLetterAndNumber = function(identifier) {
                                                                        if (!identifier) return { letter: '', number: '' };
                                                                        var parts = identifier.split(' ');
                                                                        var lastPart = parts[parts.length - 1];
                                                                        var letter = '', number = '';
                                                                        for (var i = 0; i < lastPart.length; i++) {
                                                                            var char = lastPart[i];
                                                                            if (char >= '0' && char <= '9') { letter = lastPart.substring(0, i); number = lastPart.substring(i); break; }
                                                                        }
                                                                        if (number === '') letter = lastPart;
                                                                        return { letter: letter, number: number };
                                                                    };
                                                                    var homeExtracted = extractLetterAndNumber(match.homeTeamIdentifier);
                                                                    var awayExtracted = extractLetterAndNumber(match.awayTeamIdentifier);
                                                                    var combinedNumbers = homeExtracted.number && awayExtracted.number ? homeExtracted.number + '-' + awayExtracted.number : (homeExtracted.number || awayExtracted.number || '');
                                                                    var lettersAreSame = homeExtracted.letter && awayExtracted.letter && homeExtracted.letter === awayExtracted.letter;
                                                                    var letterToShow = lettersAreSame ? homeExtracted.letter : '';
                                                                    const homeTeamColor = match.homeTeamColor || '#f3f4f6';
                                                                    const awayTeamColor = match.awayTeamColor || '#f3f4f6';
                                                                    allElements.push(
                                                                        React.createElement(
                                                                            'div',
                                                                            { key: 'match-' + match.id, className: `p-0 rounded border border-gray-200 ${hasCompletedMatch ? '' : 'hover:border-blue-400 hover:shadow-sm'} transition-all relative group/match bg-white ${hasCompletedMatch ? 'cursor-default' : 'cursor-pointer'}`, style: { width: '100%', backgroundColor: 'white', minHeight: '22px' } },
                                                                            React.createElement(
                                                                                'div',
                                                                                { className: 'grid items-center text-xs', style: { gridTemplateColumns: '130px 200px 10px 200px 10px 50px 30px', width: '100%' }, onClick: function(e) { e.stopPropagation(); handleMatchCardClick(match); }, title: hasCompletedMatch ? '' : 'Kliknite pre úpravu zápasu' },
                                                                                React.createElement('div', { className: 'flex flex-col items-center justify-center px-2 py-0 border-r border-gray-300', style: { minWidth: '130px', textAlign: 'center' } }, React.createElement('div', { className: 'flex items-center justify-center gap-1 w-full' }, React.createElement('i', { className: 'fa-solid fa-clock text-blue-600 text-xs flex-shrink-0' }), React.createElement('span', { className: 'font-medium text-blue-700 truncate' }, matchTime + ' - ' + endTime))),
                                                                                React.createElement(
                                                                                    'div',
                                                                                    {
                                                                                        className: 'px-0 py-0 flex items-center justify-center border-r border-gray-300',
                                                                                        style: {
                                                                                            textAlign: 'center',
                                                                                            backgroundColor: match.homeBgColor || 'transparent'
                                                                                        }
                                                                                    },
                                                                                    React.createElement(
                                                                                        'span',
                                                                                        {
                                                                                            className: (selectedTeamIdFilter && match.homeTeamIdentifier === selectedTeamIdFilter ? 'font-bold' : 'font-medium') + ' truncate block w-full',
                                                                                            style: {
                                                                                                color: '#000000',
                                                                                                fontWeight: match.homeTeamInConflict ? 'bold' : undefined
                                                                                            },
                                                                                            title: homeDisplay.name
                                                                                        },
                                                                                        homeDisplay.name
                                                                                    )
                                                                                ),
                                                                                React.createElement('div', { className: 'px-0 py-0 flex items-center justify-center border-r border-gray-300', style: { textAlign: 'center', backgroundColor: homeTeamColor, width: '20px', height: '100%', fontSize: '9px', fontWeight: 'bold', color: '#000000' }, title: `Počet členov tímu: ${match.homeTotalMembersCount || 0}` }, React.createElement('span', null, match.homeTotalMembersCount || 0)),
                                                                                React.createElement(
                                                                                    'div',
                                                                                    {
                                                                                        className: 'px-2 py-0 flex items-center justify-center border-r border-gray-300',
                                                                                        style: {
                                                                                            textAlign: 'center',
                                                                                            backgroundColor: match.awayBgColor || 'transparent'
                                                                                        }
                                                                                    },
                                                                                    React.createElement(
                                                                                        'span',
                                                                                        {
                                                                                            className: (selectedTeamIdFilter && match.awayTeamIdentifier === selectedTeamIdFilter ? 'font-bold' : 'font-medium') + ' truncate block w-full',
                                                                                            style: {
                                                                                                color: '#000000',
                                                                                                fontWeight: match.awayTeamInConflict ? 'bold' : undefined
                                                                                            },
                                                                                            title: awayDisplay.name
                                                                                        },
                                                                                        awayDisplay.name
                                                                                    )
                                                                                ),
                                                                                React.createElement('div', { className: 'px-0 py-0 flex items-center justify-center border-r border-gray-300', style: { textAlign: 'center', backgroundColor: awayTeamColor, width: '20px', height: '100%', fontSize: '9px', fontWeight: 'bold', color: '#000000' }, title: `Počet členov tímu: ${match.awayTotalMembersCount || 0}` }, React.createElement('span', null, match.awayTotalMembersCount || 0)),
                                                                                !isSpecialMatch && React.createElement(
                                                                                    React.Fragment,
                                                                                    null,
                                                                                    React.createElement('div', { className: 'px-2 py-0 flex items-center justify-center border-r border-gray-300', style: { textAlign: 'center', backgroundColor: 'transparent' } }, React.createElement('span', { className: (selectedTeamIdFilter && (match.homeTeamIdentifier === selectedTeamIdFilter || match.awayTeamIdentifier === selectedTeamIdFilter) ? 'font-bold' : 'font-medium') + ' text-black font-mono text-[10px] truncate block w-full' }, combinedNumbers)),
                                                                                    React.createElement('div', { className: 'px-2 py-0 flex items-center justify-center', style: { textAlign: 'center', backgroundColor: categoryColor, fontWeight: 'bold', borderRadius: '4px' } }, React.createElement('span', { className: 'text-black font-bold text-xs truncate block w-full', style: { color: '#000', textShadow: 'none' } }, letterToShow || ''))
                                                                                ),
                                                                                isSpecialMatch && React.createElement('div', { className: 'px-1 py-0 flex items-center justify-center', colSpan: 2, style: { textAlign: 'center', backgroundColor: categoryColor, fontWeight: 'bold', borderRadius: '4px', gridColumn: 'span 2', whiteSpace: 'nowrap', wordBreak: 'keep-all', width: '90%', marginLeft: 'auto', marginRight: '0' } }, React.createElement('span', { className: 'text-black font-bold text-[10px] block w-full', style: { color: '#000', textShadow: 'none', whiteSpace: 'nowrap', wordBreak: 'keep-all' } }, specialMatchText))
                                                                            ),
                                                                            !hasCompletedMatch && userProfileData?.role === 'admin' ? React.createElement(
                                                                                'div',
                                                                                { className: 'absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover/match:opacity-100 transition-opacity' },
                                                                                React.createElement('button', { className: 'w-6 h-6 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center shadow-md flex-shrink-0', onClick: function(e) { e.stopPropagation(); setSelectedMatchForBreak(match); setSelectedMatchCurrentTime(matchTime); const matchDate = match.scheduledTime ? match.scheduledTime.toDate() : null; if (matchDate) { const dateStr = getLocalDateStr(matchDate); const allMatchesInHallAndDay = matches.filter(m => m.hallId === match.hallId && m.scheduledTime && m.id !== match.id).map(m => ({ ...m, scheduledTimeObj: m.scheduledTime.toDate() })).filter(m => getLocalDateStr(m.scheduledTimeObj) === dateStr).sort((a, b) => a.scheduledTimeObj.getTime() - b.scheduledTimeObj.getTime()); const currentMatchTime = matchDate.getHours() * 60 + matchDate.getMinutes(); const nextMatch = allMatchesInHallAndDay.find(m => { const mTime = m.scheduledTimeObj.getHours() * 60 + m.scheduledTimeObj.getMinutes(); return mTime > currentMatchTime; }); if (nextMatch) { const nextHours = nextMatch.scheduledTimeObj.getHours().toString().padStart(2, '0'); const nextMinutes = nextMatch.scheduledTimeObj.getMinutes().toString().padStart(2, '0'); setSelectedMatchNextTime(`${nextHours}:${nextMinutes}`); } else setSelectedMatchNextTime(''); } else setSelectedMatchNextTime(''); setIsBreakModalOpen(true); }, title: 'Pridať medzeru pred/za zápas' }, React.createElement('i', { className: 'fa-solid fa-plus text-xs' })),
                                                                                React.createElement('button', { className: 'w-6 h-6 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center justify-center shadow-md flex-shrink-0', onClick: function(e) { e.stopPropagation(); handleSwapClick(match); }, title: 'Vymeniť domáci a hosťovský tím' }, React.createElement('i', { className: 'fa-solid fa-arrow-right-arrow-left text-xs' })),
                                                                                React.createElement('button', { className: 'w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-md flex-shrink-0', onClick: function(e) { e.stopPropagation(); handleUnassignMatch(match); }, title: 'Odstrániť priradenie (miesto a čas)' }, React.createElement('i', { className: 'fa-solid fa-trash-can text-xs' }))
                                                                            ) : null
                                                                        )
                                                                    );
                                                                    const currentMatchAll = allSortedMatches.find(function(m) { return m.id === match.id; });
                                                                    const currentIdxAll = allSortedMatches.indexOf(currentMatchAll);
                                                                    const nextMatchAll = (currentIdxAll !== -1 && currentIdxAll < allSortedMatches.length - 1) ? allSortedMatches[currentIdxAll + 1] : null;
                                                                    if (nextMatchAll && currentMatchAll.scheduledTime && nextMatchAll.scheduledTime) {
                                                                        try {
                                                                            const currentMatchDate = currentMatchAll.scheduledTime.toDate();
                                                                            const currentMatchCategory = categories.find(function(c) { return c.name === currentMatchAll.categoryName; });
                                                                            let currentMatchDuration = 0;
                                                                            let currentMatchBreak = 5;
                                                                            if (currentMatchCategory) {
                                                                                const periods = currentMatchCategory.periods || 2;
                                                                                const periodDuration = currentMatchCategory.periodDuration || 20;
                                                                                const breakDuration = currentMatchCategory.breakDuration || 2;
                                                                                currentMatchDuration = (periodDuration + breakDuration) * periods - breakDuration;
                                                                                currentMatchBreak = currentMatchCategory.matchBreak || 5;
                                                                            }
                                                                            const currentMatchEndTime = new Date(currentMatchDate.getTime() + currentMatchDuration * 60000);
                                                                            const currentEndMinutes = currentMatchEndTime.getHours() * 60 + currentMatchEndTime.getMinutes();
                                                                            const freeTimeStartMinutes = currentEndMinutes + currentMatchBreak;
                                                                            const nextMatchDate = nextMatchAll.scheduledTime.toDate();
                                                                            const nextStartMinutes = nextMatchDate.getHours() * 60 + nextMatchDate.getMinutes();
                                                                            let nextMatchBreak = 5;
                                                                            const nextMatchCategory = categories.find(function(c) { return c.name === nextMatchAll.categoryName; });
                                                                            if (nextMatchCategory) nextMatchBreak = nextMatchCategory.matchBreak || 5;
                                                                            const freeTimeEndMinutes = nextStartMinutes - nextMatchBreak;
                                                                            let displayGapMinutes = freeTimeEndMinutes - freeTimeStartMinutes;
                                                                            const dateStr = getLocalDateStr(currentMatchDate);
                                                                            const hallId = currentMatchAll.hallId;
                                                                            const gapStartTime = formatTimeFromMinutes(freeTimeStartMinutes);
                                                                            const gapEndTime = formatTimeFromMinutes(freeTimeEndMinutes);
                                                                            if (displayGapMinutes > 0) {
                                                                                const maxBlockDuration = getMaxMatchDurationInDay(allSortedMatches);
                                                                                const blocks = splitGapIntoBlocks(displayGapMinutes, maxBlockDuration, hallId, dateStr, gapStartTime, gapEndTime, false, toggleBlockBreak, null, null, hasCompletedMatch, userProfileData?.role, filteredUnassignedMatches, setSelectedBreakForAssign, setIsAssignToBreakModalOpen, handleDeleteBreak, null, currentMatchBreak, blockedBreaks);
                                                                                blocks.forEach(function(block) {
                                                                                    allElements.push(
                                                                                        React.createElement(
                                                                                            'div',
                                                                                            { key: 'gap-' + currentMatchAll.id + '-' + nextMatchAll.id + '-block-' + block.id, className: 'p-0 rounded border border-dashed border-amber-400 ' + (hasCompletedMatch ? '' : 'hover:border-amber-500') + ' transition-all relative group/gap', style: { width: '100%', backgroundColor: block.isBlocked ? '#fed7aa' : '#fffbeb', minHeight: '18px' } },
                                                                                            React.createElement(
                                                                                                'div',
                                                                                                { className: 'grid items-center text-xs', style: { gridTemplateColumns: '130px 1fr', width: '100%' } },
                                                                                                React.createElement('div', { className: 'flex flex-col items-center justify-center px-2 py-0 border-r border-gray-300', style: { minWidth: '130px', textAlign: 'center' } }, React.createElement('div', { className: 'flex items-center justify-center gap-1 w-full' }, React.createElement('i', { className: 'fa-solid ' + (block.isBlocked ? 'fa-lock' : 'fa-hourglass-half') + ' text-amber-600 text-xs flex-shrink-0' }), React.createElement('span', { className: 'font-medium text-amber-700 truncate' }, block.startTime + ' - ' + block.endTime))),
                                                                                                React.createElement('div', { className: 'px-0 py-0 flex items-center justify-center', style: { textAlign: 'center', fontWeight: '500', color: '#d97706' } }, React.createElement('span', { className: 'text-sm font-medium' }, block.isBlocked ? 'ZABLOKOVANÝ ČAS ' : 'VOĽNÝ ČAS '), React.createElement('div', { className: 'text-[10px] text-amber-600 ml-1' }, '(' + block.duration + ' min)'))
                                                                                            ),
                                                                                            !hasCompletedMatch && userProfileData?.role === 'admin' ? React.createElement(
                                                                                                'div',
                                                                                                { className: 'absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover/gap:opacity-100 transition-opacity' },
                                                                                                React.createElement('button', { className: 'w-6 h-6 ' + (block.isBlocked ? 'bg-orange-500 hover:bg-orange-600' : 'bg-gray-500 hover:bg-gray-600') + ' text-white rounded-full flex items-center justify-center shadow-md flex-shrink-0', onClick: function(e) { e.stopPropagation(); toggleBlockBreak(hallId, dateStr, block.startTime, block.endTime, block.duration); }, title: block.isBlocked ? 'Odblokovať voľný čas' : 'Zablokovať voľný čas' }, React.createElement('i', { className: 'fa-solid ' + (block.isBlocked ? 'fa-unlock' : 'fa-lock') + ' text-xs' })),
                                                                                                !block.isBlocked && React.createElement('button', { className: 'w-6 h-6 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center shadow-md flex-shrink-0', onClick: function(e) { e.stopPropagation(); setSelectedBreakForAssign({ hallId: hall.id, date: dateStr, breakStartTime: block.startTime, breakEndTime: block.endTime, breakDuration: block.duration, availableMatches: matches.filter(m => !m.hallId) }); setIsAssignToBreakModalOpen(true); }, title: 'Priradiť zápas do voľného času' }, React.createElement('i', { className: 'fa-solid fa-plus text-xs' })),
                                                                                                !block.isBlocked && React.createElement('button', { className: 'w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-md flex-shrink-0', onClick: function(e) { e.stopPropagation(); handleDeleteBreak({ matchId: currentMatchAll.id, nextMatchId: nextMatchAll.id, breakDuration: block.duration }); }, title: 'Odstrániť medzeru (posunúť nasledujúce zápasy skôr)' }, React.createElement('i', { className: 'fa-solid fa-trash-can text-xs' }))
                                                                                            ) : null
                                                                                        )
                                                                                    );
                                                                                });
                                                                            }
                                                                        } catch (e) { console.error('Chyba pri výpočte medzery:', e); }
                                                                    }
                                                                });
                                                                if (hasUnassignedMatches && userProfileData?.role === 'admin' && !hasCompletedMatch) {
                                                                    const allMatchesForHallAndDay = matches.filter(m => m.hallId === hall.id && m.scheduledTime).filter(m => { const matchDate = m.scheduledTime.toDate(); return getLocalDateStr(matchDate) === dateStr; }).sort((a, b) => { const timeA = a.scheduledTime.toDate().getTime(); const timeB = b.scheduledTime.toDate().getTime(); return timeA - timeB; });
                                                                    if (allMatchesForHallAndDay.length > 0) {
                                                                        const lastMatch = allMatchesForHallAndDay[allMatchesForHallAndDay.length - 1];
                                                                        if (lastMatch && lastMatch.scheduledTime) {
                                                                            try {
                                                                                const lastMatchDate = lastMatch.scheduledTime.toDate();
                                                                                const lastMatchCategory = categories.find(c => c.name === lastMatch.categoryName);
                                                                                let lastMatchDuration = 0, lastMatchBreak = 5;
                                                                                if (lastMatchCategory) {
                                                                                    const periods = lastMatchCategory.periods || 2;
                                                                                    const periodDuration = lastMatchCategory.periodDuration || 20;
                                                                                    const breakDuration = lastMatchCategory.breakDuration || 2;
                                                                                    lastMatchDuration = (periodDuration + breakDuration) * periods - breakDuration;
                                                                                    lastMatchBreak = lastMatchCategory.matchBreak || 5;
                                                                                }
                                                                                const lastMatchEndTime = new Date(lastMatchDate.getTime() + (lastMatchDuration + lastMatchBreak) * 60000);
                                                                                const lastMatchEndMinutes = lastMatchEndTime.getHours() * 60 + lastMatchEndTime.getMinutes();
                                                                                const endTimeStr = formatTimeFromMinutes(lastMatchEndMinutes);
                                                                                const breakEndTimeStr = '23:59';
                                                                                allElements.push(
                                                                                    React.createElement(
                                                                                        'div',
                                                                                        { key: 'add-match-button', className: 'p-0 rounded border border-dashed border-green-400 hover:border-green-500 transition-all relative group/add cursor-pointer', style: { width: '100%', backgroundColor: '#f0fdf4' } },
                                                                                        React.createElement(
                                                                                            'div',
                                                                                            { className: 'grid items-center text-xs', style: { gridTemplateColumns: '130px 1fr', width: '100%' }, onClick: function(e) { e.stopPropagation(); setSelectedBreakForAssign({ hallId: hall.id, date: dateStr, breakStartTime: endTimeStr, breakEndTime: breakEndTimeStr, breakDuration: 0, availableMatches: matches.filter(m => !m.hallId) }); setIsAssignToBreakModalOpen(true); } },
                                                                                            React.createElement('div', { className: 'flex flex-col items-center justify-center px-2 py-0 border-r border-gray-300', style: { minWidth: '130px', textAlign: 'center' } }, React.createElement('div', { className: 'flex items-center justify-center gap-1 w-full' }, React.createElement('i', { className: 'fa-solid fa-plus-circle text-green-600 text-xs flex-shrink-0' }), React.createElement('span', { className: 'font-medium text-green-700 truncate' }, `po ${endTimeStr}`))),
                                                                                            React.createElement('div', { className: 'px-0 py-0 flex items-center justify-center', style: { textAlign: 'center', fontWeight: '500', color: '#16a34a' } }, React.createElement('span', { className: 'text-sm font-medium' }, 'PRIDAŤ ZÁPAS'))
                                                                                        ),
                                                                                        React.createElement(
                                                                                            'div',
                                                                                            { className: 'absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover/add:opacity-100 transition-opacity' },
                                                                                            React.createElement('button', { className: 'w-6 h-6 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center shadow-md flex-shrink-0', onClick: function(e) { e.stopPropagation(); setSelectedBreakForAssign({ hallId: hall.id, date: dateStr, breakStartTime: endTimeStr, breakEndTime: breakEndTimeStr, breakDuration: 0, availableMatches: matches.filter(m => !m.hallId) }); setIsAssignToBreakModalOpen(true); }, title: 'Priradiť zápas' }, React.createElement('i', { className: 'fa-solid fa-plus text-xs' }))
                                                                                        )
                                                                                    )
                                                                                );
                                                                            } catch (e) { console.error('Chyba pri vytváraní tlačidla pre pridanie zápasu:', e); }
                                                                        }
                                                                    }
                                                                }
                                                                return allElements;
                                                            })()
                                                        )
                                                    ) : (
                                                        (() => {
                                                            const scheduleId = `${hall.id}_${dateStr}`;
                                                            const savedSchedule = hallSchedules[scheduleId];
                                                            const hallStartTime = savedSchedule?.startTime || '08:00';
                                                            const allMatchesForHallAndDay = matches.filter(m => m.hallId === hall.id && m.scheduledTime).filter(m => { const matchDate = m.scheduledTime.toDate(); return getLocalDateStr(matchDate) === dateStr; }).sort((a, b) => { const timeA = a.scheduledTime.toDate().getTime(); const timeB = b.scheduledTime.toDate().getTime(); return timeA - timeB; });
                                                            let displayStartTime = hallStartTime;
                                                            if (allMatchesForHallAndDay.length > 0) {
                                                                const lastMatch = allMatchesForHallAndDay[allMatchesForHallAndDay.length - 1];
                                                                if (lastMatch && lastMatch.scheduledTime) {
                                                                    try {
                                                                        const lastMatchDate = lastMatch.scheduledTime.toDate();
                                                                        const lastMatchCategory = categories.find(c => c.name === lastMatch.categoryName);
                                                                        let lastMatchDuration = 0, lastMatchBreak = 5;
                                                                        if (lastMatchCategory) {
                                                                            const periods = lastMatchCategory.periods || 2;
                                                                            const periodDuration = lastMatchCategory.periodDuration || 20;
                                                                            const breakDuration = lastMatchCategory.breakDuration || 2;
                                                                            lastMatchDuration = (periodDuration + breakDuration) * periods - breakDuration;
                                                                            lastMatchBreak = lastMatchCategory.matchBreak || 5;
                                                                        }
                                                                        const lastMatchEndTime = new Date(lastMatchDate.getTime() + (lastMatchDuration + lastMatchBreak) * 60000);
                                                                        const lastMatchEndMinutes = lastMatchEndTime.getHours() * 60 + lastMatchEndTime.getMinutes();
                                                                        const formatTimeFromMinutes = (minutes) => {
                                                                            const hours = Math.floor(minutes / 60).toString().padStart(2, '0');
                                                                            const mins = (minutes % 60).toString().padStart(2, '0');
                                                                            return `${hours}:${mins}`;
                                                                        };
                                                                        displayStartTime = formatTimeFromMinutes(lastMatchEndMinutes);
                                                                    } catch (e) { console.error('Chyba pri výpočte času po poslednom zápase:', e); }
                                                                }
                                                            }
                                                            if (hasUnassignedMatches && userProfileData?.role === 'admin' && !hasCompletedMatch) {
                                                                return React.createElement(
                                                                    'div',
                                                                    { key: 'empty-day-add-button', className: 'p-0 rounded border border-dashed border-green-400 hover:border-green-500 transition-all relative group/add cursor-pointer', style: { width: '100%', backgroundColor: '#f0fdf4' } },
                                                                    React.createElement(
                                                                        'div',
                                                                        { className: 'grid items-center text-xs', style: { gridTemplateColumns: '130px 1fr', width: '100%' }, onClick: function(e) { e.stopPropagation(); window.__pendingAssignFilters = { hallId: hall.id, day: dateStr, startTime: displayStartTime }; setSelectedBreakForAssign({ hallId: hall.id, date: dateStr, breakStartTime: displayStartTime, breakEndTime: '23:59', breakDuration: 0, availableMatches: matches.filter(m => !m.hallId) }); setIsAssignToBreakModalOpen(true); } },
                                                                        React.createElement('div', { className: 'flex flex-col items-center justify-center px-2 py-0 border-r border-gray-300', style: { minWidth: '130px', textAlign: 'center' } }, React.createElement('div', { className: 'flex items-center justify-center gap-1 w-full' }, React.createElement('i', { className: 'fa-solid fa-plus-circle text-green-600 text-xs flex-shrink-0' }), React.createElement('span', { className: 'font-medium text-green-700 truncate' }, `od ${displayStartTime}`))),
                                                                        React.createElement('div', { className: 'px-0 py-0 flex items-center justify-center', style: { textAlign: 'center', fontWeight: '500', color: '#16a34a' } }, React.createElement('span', { className: 'text-sm font-medium' }, 'PRIDAŤ ZÁPAS'))
                                                                    ),
                                                                    React.createElement(
                                                                        'div',
                                                                        { className: 'absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover/add:opacity-100 transition-opacity' },
                                                                        React.createElement('button', { className: 'w-6 h-6 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center shadow-md flex-shrink-0', onClick: function(e) { e.stopPropagation(); window.__pendingAssignFilters = { hallId: hall.id, day: dateStr, startTime: displayStartTime }; setSelectedBreakForAssign({ hallId: hall.id, date: dateStr, breakStartTime: displayStartTime, breakEndTime: '23:59', breakDuration: 0, availableMatches: matches.filter(m => !m.hallId) }); setIsAssignToBreakModalOpen(true); }, title: 'Priradiť zápas' }, React.createElement('i', { className: 'fa-solid fa-plus text-xs' }))
                                                                    )
                                                                );
                                                            }
                                                            return React.createElement(
                                                                'div',
                                                                { className: 'w-full py-6 text-xs text-gray-400 bg-gray-50 rounded border border-dashed border-gray-300 flex items-center justify-center gap-2', style: { minWidth: '500px' } },
                                                                React.createElement('i', { className: 'fa-solid fa-calendar-xmark text-sm flex-shrink-0' }),
                                                                React.createElement('span', { className: 'text-center' }, showEmptyMessage ? 'Pre zvolené filtre neexistujú žiadne zápasy v tomto dni.' : 'Žiadne zápasy')
                                                            );
                                                        })()
                                                    )
                                                );
                                            })
                                        ),
                                        !tournamentDatesLoaded || (!tournamentStartDate && !tournamentEndDate) ? React.createElement(
                                            'div',
                                            { className: 'p-4 bg-yellow-50 border-t border-yellow-200' },
                                            React.createElement('div', { className: 'flex items-center gap-2 text-yellow-700' }, React.createElement('i', { className: 'fa-solid fa-exclamation-triangle text-sm' }), React.createElement('span', { className: 'text-sm' }, 'Nie sú nastavené dátumy turnaja'))
                                        ) : null
                                    );
                                })
                            );
                        })()
                    )
                )
            )
        )
    );
};

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
                        console.error("Chyba pri porovnávaní a aktualizácii e-mailu:", error);
                        window.showGlobalNotification('Nastala chyba pri synchronizácii e-mailovej adresy.', 'error');
                    }
                }
            });
            isEmailSyncListenerSetup = true;
        }

        if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
            const root = ReactDOM.createRoot(rootElement);
            root.render(React.createElement(AddMatchesApp, { userProfileData }));
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
} else {
    const rootElement = document.getElementById('root');
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
