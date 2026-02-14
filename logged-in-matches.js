// Importy pre Firebase funkcie
import { doc, getDoc, getDocs, setDoc, onSnapshot, updateDoc, addDoc, deleteDoc, collection, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const { useState, useEffect } = React;

const faCSS = document.createElement('link');
faCSS.rel = 'stylesheet';
faCSS.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css';document.head.appendChild(faCSS);

// Definície typov pre športové haly
const typeLabels = {
    sportova_hala: "Športová hala",
};

// Ikony pre typy miest
const typeIcons = {
    sportova_hala: { icon: 'fa-futbol', color: '#dc2626' },
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

// Modálne okno pre výber typu generovania
const GenerationModal = ({ isOpen, onClose, onConfirm, categories, groupsByCategory }) => {
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedGroup, setSelectedGroup] = useState('');
    const [withRepetitions, setWithRepetitions] = useState(false);
    const [availableGroups, setAvailableGroups] = useState([]);
    const [selectedGroupType, setSelectedGroupType] = useState('');

    useEffect(() => {
        if (!isOpen) {
            setSelectedCategory('');
            setSelectedGroup('');
            setWithRepetitions(false);
            setAvailableGroups([]);
            setSelectedGroupType('');
        }
    }, [isOpen]);

    // Zoradenie kategórií podľa abecedy
    const sortedCategories = React.useMemo(() => {
        return [...categories].sort((a, b) => a.name.localeCompare(b.name));
    }, [categories]);

    // Aktualizácia dostupných skupín pri zmene kategórie
    useEffect(() => {
        if (selectedCategory && groupsByCategory[selectedCategory]) {
            // Zoradenie skupín podľa abecedy
            const sortedGroups = [...groupsByCategory[selectedCategory]].sort((a, b) => 
                a.name.localeCompare(b.name)
            );
            setAvailableGroups(sortedGroups);
            setSelectedGroup('');
            setSelectedGroupType('');
        } else {
            setAvailableGroups([]);
            setSelectedGroup('');
            setSelectedGroupType('');
        }
    }, [selectedCategory, groupsByCategory]);

    // Zistenie typu vybranej skupiny
    useEffect(() => {
        if (selectedGroup && availableGroups.length > 0) {
            const group = availableGroups.find(g => g.name === selectedGroup);
            if (group) {
                // Skupiny môžu mať typ 'základná skupina', 'nadstavbová skupina', 'basic', 'advanced'
                if (group.type === 'základná skupina') {
                    setSelectedGroupType('Základná skupina');
                } else if (group.type === 'nadstavbová skupina') {
                    setSelectedGroupType('Nadstavbová skupina');
                } else {
                    setSelectedGroupType('');
                }
            } else {
                setSelectedGroupType('');
            }
        } else {
            setSelectedGroupType('');
        }
    }, [selectedGroup, availableGroups]);

    if (!isOpen) return null;

    return React.createElement(
        'div',
        {
            className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
            onClick: (e) => {
                if (e.target === e.currentTarget) onClose();
            }
        },
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4' },
            
            // Hlavička
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mb-4' },
                React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, 'Generovať zápasy'),
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'text-gray-500 hover:text-gray-700'
                    },
                    React.createElement('i', { className: 'fa-solid fa-times text-xl' })
                )
            ),

            // Výber kategórie - zoradené podľa abecedy
            React.createElement(
                'div',
                { className: 'mb-4' },
                React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' },
                    'Kategória:'
                ),
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

            // Výber skupiny (ak je kategória vybraná) - skupiny sú už zoradené v availableGroups
            selectedCategory && React.createElement(
                'div',
                { className: 'mb-4' },
                React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' },
                    'Skupina:'
                ),
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
                
                // Zobrazenie typu skupiny pod selectboxom
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
                        React.createElement('i', { 
                            className: `fa-solid ${
                                selectedGroupType === 'Základná skupina' 
                                    ? 'fa-layer-group' 
                                    : 'fa-chart-line'
                            } mr-1 text-xs` 
                        }),
                        selectedGroupType
                    )
                )
            ),

            // Checkbox pre kombinácie s opakovaním
            React.createElement(
                'div',
                { className: 'mb-6' },
                React.createElement(
                    'label',
                    { className: 'flex items-center gap-2 cursor-pointer' },
                    React.createElement('input', {
                        type: 'checkbox',
                        checked: withRepetitions,
                        onChange: (e) => setWithRepetitions(e.target.checked),
                        className: 'w-4 h-4 text-blue-600 rounded'
                    }),
                    React.createElement('span', { className: 'text-gray-700' }, 'Kombinácie s opakovaním (každý s každým doma/vonku)')
                ),
                !withRepetitions && React.createElement(
                    'p',
                    { className: 'text-xs text-gray-500 mt-1 ml-6' },
                    'Vygenerujú sa jedinečné dvojice, každý tím sa stretne s každým práve raz'
                )
            ),

            // Tlačidlá
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
                            onConfirm({
                                categoryId: selectedCategory,
                                groupName: selectedGroup || null,
                                withRepetitions
                            });
                            onClose();
                        },
                        disabled: !selectedCategory,
                        className: `px-4 py-2 text-white rounded-lg transition-colors ${
                            selectedCategory 
                                ? 'bg-green-600 hover:bg-green-700 cursor-pointer' 
                                : 'bg-gray-400 cursor-not-allowed'
                        }`
                    },
                    'Generovať'
                )
            )
        )
    );
};

// Modálne okno pre výber mazania zápasov
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

    // Zoradenie kategórií podľa abecedy
    const sortedCategories = React.useMemo(() => {
        return [...categories].sort((a, b) => a.name.localeCompare(b.name));
    }, [categories]);

    // Aktualizácia dostupných skupín pri zmene kategórie
    useEffect(() => {
        if (selectedCategory && groupsByCategory[selectedCategory]) {
            // Zoradenie skupín podľa abecedy
            const sortedGroups = [...groupsByCategory[selectedCategory]].sort((a, b) => 
                a.name.localeCompare(b.name)
            );
            setAvailableGroups(sortedGroups);
            setSelectedGroup('');
            setSelectedGroupType('');
        } else {
            setAvailableGroups([]);
            setSelectedGroup('');
            setSelectedGroupType('');
        }
    }, [selectedCategory, groupsByCategory]);

    // Zistenie typu vybranej skupiny
    useEffect(() => {
        if (selectedGroup && availableGroups.length > 0) {
            const group = availableGroups.find(g => g.name === selectedGroup);
            if (group) {
                if (group.type === 'základná skupina') {
                    setSelectedGroupType('Základná skupina');
                } else if (group.type === 'nadstavbová skupina') {
                    setSelectedGroupType('Nadstavbová skupina');
                } else {
                    setSelectedGroupType('');
                }
            } else {
                setSelectedGroupType('');
            }
        } else {
            setSelectedGroupType('');
        }
    }, [selectedGroup, availableGroups]);

    if (!isOpen) return null;

    return React.createElement(
        'div',
        {
            className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
            onClick: (e) => {
                if (e.target === e.currentTarget) onClose();
            }
        },
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4' },
            
            // Hlavička
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mb-4' },
                React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, 'Zmazať zápasy'),
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'text-gray-500 hover:text-gray-700'
                    },
                    React.createElement('i', { className: 'fa-solid fa-times text-xl' })
                )
            ),

            // Výber kategórie - zoradené podľa abecedy
            React.createElement(
                'div',
                { className: 'mb-4' },
                React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' },
                    'Kategória:'
                ),
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

            // Výber skupiny (ak je kategória vybraná)
            selectedCategory && React.createElement(
                'div',
                { className: 'mb-4' },
                React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' },
                    'Skupina:'
                ),
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
                
                // Zobrazenie typu skupiny pod selectboxom
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
                        React.createElement('i', { 
                            className: `fa-solid ${
                                selectedGroupType === 'Základná skupina' 
                                    ? 'fa-layer-group' 
                                    : 'fa-chart-line'
                            } mr-1 text-xs` 
                        }),
                        selectedGroupType
                    )
                )
            ),

            // Varovanie
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

            // Tlačidlá
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
                            onConfirm({
                                categoryId: selectedCategory,
                                groupName: selectedGroup || null
                            });
                            onClose();
                        },
                        disabled: !selectedCategory,
                        className: `px-4 py-2 text-white rounded-lg transition-colors ${
                            selectedCategory 
                                ? 'bg-red-600 hover:bg-red-700 cursor-pointer' 
                                : 'bg-gray-400 cursor-not-allowed'
                        }`
                    },
                    'Zmazať zápasy'
                )
            )
        )
    );
};

// Modálne okno pre potvrdenie opätovného generovania
const ConfirmRegenerateModal = ({ isOpen, onClose, onConfirm, categoryName, groupName }) => {
    if (!isOpen) return null;

    return React.createElement(
        'div',
        {
            className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]',
            onClick: (e) => {
                if (e.target === e.currentTarget) onClose();
            }
        },
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4' },
            
            // Hlavička
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mb-4' },
                React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, 'Potvrdenie generovania'),
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'text-gray-500 hover:text-gray-700'
                    },
                    React.createElement('i', { className: 'fa-solid fa-times text-xl' })
                )
            ),

            // Obsah
            React.createElement(
                'div',
                { className: 'mb-6' },
                React.createElement(
                    'p',
                    { className: 'text-gray-700 mb-2' },
                    'Pre kategóriu ',
                    React.createElement('span', { className: 'font-semibold' }, categoryName),
                    groupName ? React.createElement('span', null, ' a skupinu ', React.createElement('span', { className: 'font-semibold' }, groupName)) : null,
                    ' už boli zápasy vygenerované.'
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-700' },
                    'Chcete ich vygenerovať znovu?'
                )
            ),

            // Tlačidlá
            React.createElement(
                'div',
                { className: 'flex justify-end gap-3' },
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors'
                    },
                    'Nie'
                ),
                React.createElement(
                    'button',
                    {
                        onClick: () => {
                            onConfirm();
                            onClose();
                        },
                        className: 'px-4 py-2 text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors'
                    },
                    'Áno, generovať'
                )
            )
        )
    );
};

const ConfirmExistingMatchModal = ({ isOpen, onClose, onConfirm, match, homeTeamDisplay, awayTeamDisplay }) => {
    if (!isOpen || !match) return null;

    return React.createElement(
        'div',
        {
            className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70]',
            onClick: (e) => {
                if (e.target === e.currentTarget) onClose();
            }
        },
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4' },
            
            // Hlavička
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mb-4' },
                React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, 'Existujúci zápas'),
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'text-gray-500 hover:text-gray-700'
                    },
                    React.createElement('i', { className: 'fa-solid fa-times text-xl' })
                )
            ),

            // Obsah
            React.createElement(
                'div',
                { className: 'mb-6' },
                React.createElement(
                    'p',
                    { className: 'text-gray-700 mb-2' },
                    'Zápas medzi tímami'
                ),
                React.createElement(
                    'div',
                    { className: 'bg-gray-50 p-3 rounded-lg mb-2' },
                    React.createElement('p', { className: 'font-semibold text-sm' }, homeTeamDisplay),
                    React.createElement('p', { className: 'font-semibold text-sm mt-1' }, awayTeamDisplay)
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-700' },
                    'už existuje. Chcete ho vygenerovať znovu?'
                )
            ),

            // Tlačidlá
            React.createElement(
                'div',
                { className: 'flex justify-end gap-3' },
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors'
                    },
                    'Nie'
                ),
                React.createElement(
                    'button',
                    {
                        onClick: () => {
                            onConfirm(match);
                            onClose();
                        },
                        className: 'px-4 py-2 text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors'
                    },
                    'Áno'
                )
            )
        )
    );
};

const ConfirmSwapModal = ({ isOpen, onClose, onConfirm, homeTeamDisplay, awayTeamDisplay, displayMode }) => {
    if (!isOpen) return null;

    return React.createElement(
        'div',
        {
            className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[80]',
            onClick: (e) => {
                if (e.target === e.currentTarget) onClose();
            }
        },
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4' },
            
            // Hlavička
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mb-4' },
                React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, 'Potvrdenie výmeny'),
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'text-gray-500 hover:text-gray-700'
                    },
                    React.createElement('i', { className: 'fa-solid fa-times text-xl' })
                )
            ),

            // Obsah
            React.createElement(
                'div',
                { className: 'mb-6' },
                React.createElement(
                    'p',
                    { className: 'text-gray-700 mb-4' },
                    'Naozaj chcete vymeniť domáci a hosťovský tím?'
                ),
                React.createElement(
                    'div',
                    { className: 'flex items-center justify-between bg-gray-50 p-3 rounded-lg' },
                    displayMode === 'both' && typeof homeTeamDisplay === 'object'
                        ? React.createElement(
                            'div',
                            { className: 'flex flex-col items-start' },
                            React.createElement('span', { className: 'font-semibold text-sm' }, homeTeamDisplay.name),
                            React.createElement('span', { className: 'text-xs text-gray-500' }, `(${homeTeamDisplay.id})`)
                        )
                        : React.createElement('span', { className: 'font-semibold text-sm' }, homeTeamDisplay),
                    
                    React.createElement('i', { className: 'fa-solid fa-arrow-right-arrow-left text-blue-500 mx-2' }),
                    
                    displayMode === 'both' && typeof awayTeamDisplay === 'object'
                        ? React.createElement(
                            'div',
                            { className: 'flex flex-col items-start' },
                            React.createElement('span', { className: 'font-semibold text-sm' }, awayTeamDisplay.name),
                            React.createElement('span', { className: 'text-xs text-gray-500' }, `(${awayTeamDisplay.id})`)
                        )
                        : React.createElement('span', { className: 'font-semibold text-sm' }, awayTeamDisplay)
                ),
                React.createElement(
                    'div',
                    { className: 'flex items-center justify-between mt-2 text-xs text-gray-500' },
                    React.createElement('span', null, 'Domáci'),
                    React.createElement('span', null, 'Hosť')
                )
            ),

            // Tlačidlá
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
                        className: 'px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors'
                    },
                    'Vymeniť'
                )
            )
        )
    );
};

// Modálne okno pre potvrdenie hromadného mazania
const ConfirmBulkDeleteModal = ({ isOpen, onClose, onConfirm, categoryName, groupName, matchesCount }) => {
    if (!isOpen) return null;

    return React.createElement(
        'div',
        {
            className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[80]',
            onClick: (e) => {
                if (e.target === e.currentTarget) onClose();
            }
        },
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4' },
            
            // Hlavička
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mb-4' },
                React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, 'Potvrdenie hromadného mazania'),
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'text-gray-500 hover:text-gray-700'
                    },
                    React.createElement('i', { className: 'fa-solid fa-times text-xl' })
                )
            ),

            // Obsah
            React.createElement(
                'div',
                { className: 'mb-6' },
                React.createElement(
                    'p',
                    { className: 'text-gray-700 mb-2' },
                    'Naozaj chcete zmazať všetky zápasy pre ',
                    React.createElement('span', { className: 'font-semibold' }, categoryName),
                    groupName ? React.createElement('span', null, ' a skupinu ', React.createElement('span', { className: 'font-semibold' }, groupName)) : null,
                    '?'
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-700 mb-4' },
                    'Počet zápasov na zmazanie: ',
                    React.createElement('span', { className: 'font-semibold text-red-600' }, matchesCount)
                ),
                React.createElement(
                    'p',
                    { className: 'text-sm text-red-600 flex items-center gap-2' },
                    React.createElement('i', { className: 'fa-solid fa-exclamation-triangle' }),
                    'Táto akcia je nenávratná!'
                )
            ),

            // Tlačidlá
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
                    'Áno, zmazať'
                )
            )
        )
    );
};

const ConfirmDeleteModal = ({ isOpen, onClose, onConfirm, homeTeamDisplay, awayTeamDisplay, displayMode }) => {
    if (!isOpen) return null;

    return React.createElement(
        'div',
        {
            className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[80]',
            onClick: (e) => {
                if (e.target === e.currentTarget) onClose();
            }
        },
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4' },
            
            // Hlavička
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mb-4' },
                React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, 'Potvrdenie zmazania'),
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'text-gray-500 hover:text-gray-700'
                    },
                    React.createElement('i', { className: 'fa-solid fa-times text-xl' })
                )
            ),

            // Obsah
            React.createElement(
                'div',
                { className: 'mb-6' },
                React.createElement(
                    'p',
                    { className: 'text-gray-700 mb-4' },
                    'Naozaj chcete zmazať zápas medzi tímami?'
                ),
                React.createElement(
                    'div',
                    { className: 'flex items-center justify-between bg-gray-50 p-3 rounded-lg' },
                    displayMode === 'both' && typeof homeTeamDisplay === 'object'
                        ? React.createElement(
                            'div',
                            { className: 'flex flex-col items-start' },
                            React.createElement('span', { className: 'font-semibold text-sm' }, homeTeamDisplay.name),
                            React.createElement('span', { className: 'text-xs text-gray-500' }, `(${homeTeamDisplay.id})`)
                        )
                        : React.createElement('span', { className: 'font-semibold text-sm' }, homeTeamDisplay),
                    
                    React.createElement('i', { className: 'fa-solid fa-arrow-right-arrow-left text-blue-500 mx-2' }),
                    
                    displayMode === 'both' && typeof awayTeamDisplay === 'object'
                        ? React.createElement(
                            'div',
                            { className: 'flex flex-col items-start' },
                            React.createElement('span', { className: 'font-semibold text-sm' }, awayTeamDisplay.name),
                            React.createElement('span', { className: 'text-xs text-gray-500' }, `(${awayTeamDisplay.id})`)
                        )
                        : React.createElement('span', { className: 'font-semibold text-sm' }, awayTeamDisplay)
                ),
                React.createElement(
                    'p',
                    { className: 'text-sm text-red-600 mt-4' },
                    'Táto akcia je nenávratná.'
                )
            ),

            // Tlačidlá
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

// Modálne okno pre priradenie/úpravu zápasu do haly
const AssignMatchModal = ({ isOpen, onClose, match, sportHalls, categories, onAssign, allMatches }) => {
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

    // Načítanie všetkých zápasov pre vybranú halu a deň
    useEffect(() => {
        const loadExistingMatches = async () => {
            if (selectedHallId && selectedDate && allMatches) {
                try {
                    // Filtrujeme zápasy pre túto halu a deň
                    const matchesForHallAndDay = allMatches.filter(m => 
                        m.hallId === selectedHallId && 
                        m.scheduledTime && 
                        m.id !== match?.id // Vylúčime aktuálne upravovaný zápas
                    ).filter(m => {
                        const matchDate = m.scheduledTime.toDate();
                        const matchDateStr = matchDate.toISOString().split('T')[0];
                        return matchDateStr === selectedDate;
                    });
                    
                    setExistingMatches(matchesForHallAndDay);
                    console.log('Načítané existujúce zápasy:', matchesForHallAndDay);
                } catch (error) {
                    console.error('Chyba pri načítaní existujúcich zápasov:', error);
                }
            } else {
                setExistingMatches([]);
            }
        };

        loadExistingMatches();
    }, [selectedHallId, selectedDate, match?.id, allMatches]);

    // Kontrola prekrývania časov VRÁTANE PRESTÁVKY PO ZÁPASE
    useEffect(() => {
        if (selectedTime && matchDuration > 0 && existingMatches.length > 0) {
            const [newHours, newMinutes] = selectedTime.split(':').map(Number);
            const newStartMinutes = newHours * 60 + newMinutes;
            
            // Získame dĺžku prestávky pre nový zápas
            const newCategory = categories.find(c => c.name === match?.categoryName);
            const newMatchBreak = newCategory?.matchBreak || 5; // Predvolená prestávka 5 minút
            const newEndMinutes = newStartMinutes + matchDuration + newMatchBreak; // Zápas + prestávka

            console.log('Kontrolujem prekrývanie pre nový zápas (vrátane prestávky):', {
                start: newStartMinutes,
                end: newEndMinutes,
                duration: matchDuration,
                breakAfter: newMatchBreak
            });

            // Nájdeme všetky prekrývajúce sa zápasy
            const overlapping = existingMatches.filter(existingMatch => {
                if (!existingMatch.scheduledTime) return false;
                
                const existingDate = existingMatch.scheduledTime.toDate();
                const existingHours = existingDate.getHours();
                const existingMinutes = existingDate.getMinutes();
                const existingStartMinutes = existingHours * 60 + existingMinutes;
                
                // Získame trvanie a prestávku existujúceho zápasu
                const existingCategory = categories.find(c => c.name === existingMatch.categoryName);
                let existingDuration = 0;
                let existingMatchBreak = 5; // Predvolená prestávka
                
                if (existingCategory) {
                    const periods = existingCategory.periods || 2;
                    const periodDuration = existingCategory.periodDuration || 20;
                    const breakDuration = existingCategory.breakDuration || 2;
                    existingDuration = (periodDuration + breakDuration) * periods - breakDuration;
                    existingMatchBreak = existingCategory.matchBreak || 5;
                }
                
                // Koniec existujúceho zápasu VRÁTANE PRESTÁVKY PO ŇOM
                const existingEndMinutes = existingStartMinutes + existingDuration + existingMatchBreak;

                console.log('Porovnávam s existujúcim zápasom (vrátane prestávky):', {
                    id: existingMatch.id,
                    start: existingStartMinutes,
                    end: existingEndMinutes,
                    duration: existingDuration,
                    breakAfter: existingMatchBreak
                });

                // Kontrola prekrývania VRÁTANE PRESTÁVKY:
                // Nový zápas (vrátane jeho prestávky) začína pred koncom existujúceho (vrátane jeho prestávky) 
                // A končí po začiatku existujúceho
                return (newStartMinutes < existingEndMinutes && newEndMinutes > existingStartMinutes);
            });

            setOverlappingMatches(overlapping);
        } else {
            setOverlappingMatches([]);
        }
    }, [selectedTime, matchDuration, existingMatches, categories, match?.categoryName]);

    // Načítanie času začiatku pre vybranú halu a deň
    useEffect(() => {
        const loadHallStartTime = async () => {
            if (selectedHallId && selectedDate && window.db) {
                try {
                    const scheduleId = `${selectedHallId}_${selectedDate}`;
                    const scheduleRef = doc(window.db, 'hallSchedules', scheduleId);
                    const scheduleSnap = await getDoc(scheduleRef);
                    
                    if (scheduleSnap.exists()) {
                        const data = scheduleSnap.data();
                        setHallStartTime(data.startTime);
                        setTimeError(''); // Resetujeme chybu pri zmene
                    } else {
                        setHallStartTime(null);
                        setTimeError('Pre tento deň nie je nastavený čas začiatku. Najprv ho nastavte kliknutím na hlavičku dňa.');
                    }
                } catch (error) {
                    console.error('Chyba pri načítaní času začiatku haly:', error);
                    setHallStartTime(null);
                }
            } else {
                setHallStartTime(null);
                setTimeError('');
            }
        };

        loadHallStartTime();
    }, [selectedHallId, selectedDate]);

    // Načítanie existujúcich údajov zápasu pri otvorení modálneho okna
    useEffect(() => {
        if (match && isOpen) {
            // Predvyplnenie haly
            if (match.hallId) {
                setSelectedHallId(match.hallId);
            } else {
                setSelectedHallId('');
            }
            
            // Predvyplnenie dátumu a času
            if (match.scheduledTime) {
                try {
                    const date = match.scheduledTime.toDate();
                    
                    // Formát pre datetime-local input (YYYY-MM-DD)
                    const year = date.getFullYear();
                    const month = (date.getMonth() + 1).toString().padStart(2, '0');
                    const day = date.getDate().toString().padStart(2, '0');
                    const dateStr = `${year}-${month}-${day}`;
                    
                    // Formát pre time input (HH:MM)
                    const hours = date.getHours().toString().padStart(2, '0');
                    const minutes = date.getMinutes().toString().padStart(2, '0');
                    const timeStr = `${hours}:${minutes}`;
                    
                    setSelectedDate(dateStr);
                    setSelectedTime(timeStr);
                } catch (e) {
                    console.error('Chyba pri parsovaní dátumu zápasu:', e);
                    setSelectedDate('');
                    setSelectedTime('');
                }
            } else {
                setSelectedDate('');
                setSelectedTime('');
            }
        }
    }, [match, isOpen]);

    useEffect(() => {
        if (match && categories.length > 0) {
            // Nájdeme detaily kategórie pre tento zápas
            const category = categories.find(c => c.name === match.categoryName);
            setCategoryDetails(category);
        
            if (category) {
                // Výpočet čistého času zápasu (bez prestávky po zápase)
                const periods = category.periods || 2;
                const periodDuration = category.periodDuration || 20;
                const breakDuration = category.breakDuration || 2;
            
                // Čistý čas zápasu = (periodDuration + breakDuration) * periods - breakDuration
                const calculatedDuration = (periodDuration + breakDuration) * periods - breakDuration;
                setMatchDuration(calculatedDuration);
            }
        }
    }, [match, categories]);

    // Generovanie dostupných dátumov z tournamentStartDate a tournamentEndDate
    useEffect(() => {
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
        }
    }, []);

    // Výpočet času ukončenia zápasu a kontrola času začiatku
    useEffect(() => {
        if (selectedDate && selectedTime && matchDuration > 0) {
            const [hours, minutes] = selectedTime.split(':').map(Number);
            
            // Kontrola času začiatku (ak je nastavený)
            if (hallStartTime) {
                const [startHours, startMinutes] = hallStartTime.split(':').map(Number);
                const selectedMinutes = hours * 60 + minutes;
                const hallStartMinutes = startHours * 60 + startMinutes;
                
                if (selectedMinutes < hallStartMinutes) {
                    setTimeError(`Čas začiatku zápasu nemôže byť skôr ako ${hallStartTime} (čas začiatku prvého zápasu v tejto hale)`);
                } else {
                    setTimeError('');
                }
            } else {
                setTimeError('');
            }
            
            // SPRÁVNE vytvorenie dátumu - rozdelíme YYYY-MM-DD na časti
            const [year, month, day] = selectedDate.split('-').map(Number);
            // Vytvoríme Date objekt v lokálnom časovom pásme (month je 0-indexed, preto -1)
            const startDateTime = new Date(year, month - 1, day, hours, minutes, 0);
            
            // Koniec zápasu je start + matchDuration (čistý čas bez prestávky po zápase)
            const endDateTime = new Date(startDateTime.getTime() + matchDuration * 60000);
            
            const endHours = endDateTime.getHours().toString().padStart(2, '0');
            const endMinutes = endDateTime.getMinutes().toString().padStart(2, '0');
            
            setMatchEndTime(`${endHours}:${endMinutes}`);
        } else {
            setMatchEndTime('');
            if (!hallStartTime && selectedHallId && selectedDate) {
                setTimeError('Pre tento deň nie je nastavený čas začiatku. Najprv ho nastavte kliknutím na hlavičku dňa.');
            } else {
                setTimeError('');
            }
        }
    }, [selectedDate, selectedTime, matchDuration, hallStartTime]);

    if (!isOpen || !match) return null;

    const hasError = timeError || overlappingMatches.length > 0;
    const canSave = selectedHallId && selectedDate && selectedTime && !hasError;

    return React.createElement(
        'div',
        {
            className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[90]',
            onClick: (e) => {
                if (e.target === e.currentTarget) onClose();
            }
        },
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-2xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto' },
            
            // Hlavička
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mb-4' },
                React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, 
                    match.hallId ? 'Upraviť priradenie zápasu' : 'Priradiť zápas do haly'
                ),
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'text-gray-500 hover:text-gray-700'
                    },
                    React.createElement('i', { className: 'fa-solid fa-times text-xl' })
                )
            ),

            // Informácie o zápase
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
                        React.createElement('p', { className: 'text-sm text-gray-600' }, match.homeTeamIdentifier)
                    ),
                    React.createElement('i', { className: 'fa-solid fa-vs text-xs text-gray-400 mx-2' }),
                    React.createElement(
                        'div',
                        { className: 'flex-1 text-right' },
                        React.createElement('p', { className: 'text-sm text-gray-600' }, match.awayTeamIdentifier)
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'mt-2 text-xs text-gray-500' },
                    React.createElement('span', { className: 'font-medium' }, 'Kategória: '),
                    match.categoryName,
                    match.groupName && React.createElement('span', null, ` (${match.groupName})`)
                ),
                
                // Informácia o dĺžke zápasu a prestávke
                categoryDetails && React.createElement(
                    'div',
                    { className: 'mt-3 p-2 bg-white rounded border border-blue-100' },
                    React.createElement(
                        'div',
                        { className: 'flex items-center gap-2 text-sm' },
                        React.createElement('i', { className: 'fa-solid fa-clock text-blue-600' }),
                        React.createElement('span', { className: 'font-medium text-gray-700' }, 'Dĺžka zápasu:'),
                        React.createElement('span', { className: 'text-blue-600 font-semibold' }, `${matchDuration} minút`),
                        React.createElement('span', { className: 'text-xs text-gray-500 ml-2' },
                            `(+ ${categoryDetails.matchBreak || 5} min prestávka po zápase)`
                        )
                    )
                )
            ),

            // Formulár pre priradenie
            React.createElement(
                'div',
                { className: 'space-y-4' },
                
                // Výber haly
                React.createElement(
                    'div',
                    null,
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' },
                        'Športová hala:'
                    ),
                    React.createElement(
                        'select',
                        {
                            value: selectedHallId,
                            onChange: (e) => {
                                setSelectedHallId(e.target.value);
                                setSelectedTime(''); // Resetujeme čas pri zmene haly
                            },
                            className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black'
                        },
                        React.createElement('option', { value: '' }, '-- Vyberte športovú halu --'),
                        sportHalls.map(hall => 
                            React.createElement('option', { key: hall.id, value: hall.id }, hall.name)
                        )
                    )
                ),

                // Výber dňa
                React.createElement(
                    'div',
                    null,
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' },
                        'Deň konania:'
                    ),
                    React.createElement(
                        'select',
                        {
                            value: selectedDate,
                            onChange: (e) => {
                                setSelectedDate(e.target.value);
                                setSelectedTime(''); // Resetujeme čas pri zmene dňa
                            },
                            className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black',
                            disabled: availableDates.length === 0
                        },
                        React.createElement('option', { value: '' }, '-- Vyberte deň --'),
                        availableDates.map((date, index) => {
                            const dateStr = date.toISOString().split('T')[0];
                            const displayDate = date.toLocaleDateString('sk-SK', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric'
                            });
                            return React.createElement('option', { key: index, value: dateStr }, displayDate);
                        })
                    ),
                    availableDates.length === 0 && React.createElement(
                        'p',
                        { className: 'text-xs text-red-500 mt-1' },
                        'Nie sú nastavené dátumy turnaja'
                    )
                ),

                // Zobrazenie času začiatku pre halu (ak existuje)
                selectedHallId && selectedDate && hallStartTime && React.createElement(
                    'div',
                    { className: 'text-sm bg-blue-50 p-2 rounded-lg border border-blue-200' },
                    React.createElement('i', { className: 'fa-regular fa-clock text-blue-600 mr-1' }),
                    React.createElement('span', { className: 'font-medium text-blue-700' }, 'Čas začiatku prvého zápasu v tejto hale: '),
                    React.createElement('span', { className: 'font-bold text-blue-800' }, hallStartTime)
                ),

                // Zobrazenie existujúcich zápasov pre prehľad
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
                        existingMatches
                            .sort((a, b) => {
                                const timeA = a.scheduledTime.toDate().getTime();
                                const timeB = b.scheduledTime.toDate().getTime();
                                return timeA - timeB;
                            })
                            .map((em, idx) => {
                                const startTime = em.scheduledTime.toDate();
                                const hours = startTime.getHours().toString().padStart(2, '0');
                                const minutes = startTime.getMinutes().toString().padStart(2, '0');
                                
                                // Výpočet konca existujúceho zápasu VRÁTANE PRESTÁVKY
                                const emCategory = categories.find(c => c.name === em.categoryName);
                                let emDuration = 0;
                                let emMatchBreak = 5;
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
                                
                                // Zvýrazníme konfliktné zápasy
                                const isOverlapping = overlappingMatches.some(om => om.id === em.id);
                                
                                return React.createElement(
                                    'div',
                                    { 
                                        key: idx,
                                        className: `flex items-center gap-2 p-1 rounded border ${isOverlapping ? 'bg-red-50 border-red-300' : 'bg-white border-gray-100'}`
                                    },
                                    React.createElement('span', { className: 'text-gray-500 font-mono' }, `${hours}:${minutes} - ${endHours}:${endMinutes}`),
                                    React.createElement('span', { className: isOverlapping ? 'text-red-700 font-medium' : 'text-gray-700' }, em.homeTeamIdentifier),
                                    React.createElement('i', { className: 'fa-solid fa-vs text-xs text-gray-400' }),
                                    React.createElement('span', { className: isOverlapping ? 'text-red-700 font-medium' : 'text-gray-700' }, em.awayTeamIdentifier),
                                    isOverlapping && React.createElement(
                                        'span',
                                        { className: 'text-xs text-red-500 ml-auto' },
                                        React.createElement('i', { className: 'fa-solid fa-circle-exclamation mr-1' }),
                                        'konflikt'
                                    )
                                );
                            })
                    )
                ),

                // Výber času
                React.createElement(
                    'div',
                    null,
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' },
                        'Čas začiatku:'
                    ),
                    React.createElement('input', {
                        type: 'time',
                        value: selectedTime,
                        onChange: (e) => setSelectedTime(e.target.value),
                        className: `w-full px-3 py-2 border ${hasError ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black`,
                        step: '60',
                        min: hallStartTime || undefined // Nastavíme minimálny čas ak existuje
                    }),
                    
                    // Zobrazenie chybovej hlášky (čas začiatku)
                    timeError && React.createElement(
                        'p',
                        { className: 'text-xs text-red-500 mt-1 flex items-center gap-1' },
                        React.createElement('i', { className: 'fa-solid fa-exclamation-triangle' }),
                        timeError
                    ),
                    
                    // Zobrazenie konfliktných zápasov pod sebou
                    overlappingMatches.length > 0 && React.createElement(
                        'div',
                        { className: 'mt-3 p-3 bg-red-50 border border-red-200 rounded-lg' },
                        React.createElement(
                            'p',
                            { className: 'text-xs text-red-600 font-medium mb-2 flex items-center gap-1' },
                            React.createElement('i', { className: 'fa-solid fa-circle-exclamation' }),
                            `Časový konflikt s ${overlappingMatches.length} ${overlappingMatches.length === 1 ? 'zápasom' : 'zápasmi'} (vrátane prestávok):`
                        ),
                        React.createElement(
                            'div',
                            { className: 'space-y-2 max-h-40 overflow-y-auto' },
                            overlappingMatches
                                .sort((a, b) => {
                                    const timeA = a.scheduledTime.toDate().getTime();
                                    const timeB = b.scheduledTime.toDate().getTime();
                                    return timeA - timeB;
                                })
                                .map((om, idx) => {
                                    const startTime = om.scheduledTime.toDate();
                                    const hours = startTime.getHours().toString().padStart(2, '0');
                                    const minutes = startTime.getMinutes().toString().padStart(2, '0');
                                    
                                    // Výpočet konca konfliktného zápasu VRÁTANE PRESTÁVKY
                                    const omCategory = categories.find(c => c.name === om.categoryName);
                                    let omDuration = 0;
                                    let omMatchBreak = 5;
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
                                        {
                                            key: idx,
                                            className: 'flex items-center justify-between p-2 bg-white rounded border border-red-100 text-sm'
                                        },
                                        React.createElement(
                                            'div',
                                            { className: 'flex items-center gap-2' },
                                            React.createElement('i', { className: 'fa-solid fa-clock text-red-400 text-xs' }),
                                            React.createElement('span', { className: 'font-mono text-red-600 font-medium' }, `${hours}:${minutes} - ${endHours}:${endMinutes}`)
                                        ),
                                        React.createElement(
                                            'div',
                                            { className: 'flex items-center gap-2 flex-1 ml-3' },
                                            React.createElement('span', { className: 'text-red-700' }, om.homeTeamIdentifier),
                                            React.createElement('i', { className: 'fa-solid fa-vs text-xs text-red-300' }),
                                            React.createElement('span', { className: 'text-red-700' }, om.awayTeamIdentifier)
                                        )
                                    );
                                })
                        )
                    ),
                    
                    // Zobrazenie času ukončenia
                    matchEndTime && !hasError && React.createElement(
                        'p',
                        { className: 'text-xs text-green-600 mt-1' },
                        React.createElement('i', { className: 'fa-regular fa-circle-check mr-1' }),
                        `Zápas skončí o ${matchEndTime} (následná ${categoryDetails?.matchBreak || 5} min prestávka)`
                    )
                ),

                // Zhrnutie
                selectedHallId && selectedDate && selectedTime && !hasError && React.createElement(
                    'div',
                    { className: 'mt-4 p-3 bg-green-50 border border-green-200 rounded-lg' },
                    React.createElement(
                        'div',
                        { className: 'flex items-center gap-2 text-green-700' },
                        React.createElement('i', { className: 'fa-solid fa-check-circle' }),
                        React.createElement('span', { className: 'font-medium' }, 'Zápas bude priradený:')
                    ),
                    React.createElement(
                        'div',
                        { className: 'mt-2 text-sm text-gray-600' },
                        React.createElement('p', null, 
                            React.createElement('span', { className: 'font-medium' }, 'Hala: '),
                            sportHalls.find(h => h.id === selectedHallId)?.name
                        ),
                        React.createElement('p', null, 
                            React.createElement('span', { className: 'font-medium' }, 'Dátum: '),
                            (() => {
                                const [year, month, day] = selectedDate.split('-').map(Number);
                                // Vytvoríme Date objekt a potom ho naformátujeme
                                const date = new Date(year, month - 1, day);
                                return date.toLocaleDateString('sk-SK', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric'
                                });
                            })()
                        ),
                        React.createElement('p', null, 
                            React.createElement('span', { className: 'font-medium' }, 'Čas: '),
                            `${selectedTime} - ${matchEndTime} (${matchDuration} min + ${categoryDetails?.matchBreak || 5} min prestávka)`
                        ),
                        hallStartTime && React.createElement(
                            'p',
                            { className: 'text-xs text-green-600 mt-1' },
                            React.createElement('i', { className: 'fa-regular fa-clock mr-1' }),
                            `Čas zápasu je v poriadku (začína o ${selectedTime}, čo je po čase začiatku ${hallStartTime})`
                        )
                    )
                )
            ),

            // Tlačidlá
            React.createElement(
                'div',
                { className: 'flex justify-end gap-3 mt-6' },
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
                            if (canSave) {
                                onAssign({
                                    matchId: match.id,
                                    hallId: selectedHallId,
                                    date: selectedDate,
                                    time: selectedTime,
                                    endTime: matchEndTime,
                                    duration: matchDuration
                                });
                                onClose();
                            }
                        },
                        disabled: !canSave,
                        className: `px-4 py-2 text-white rounded-lg transition-colors ${
                            canSave
                                ? 'bg-green-600 hover:bg-green-700 cursor-pointer' 
                                : 'bg-gray-400 cursor-not-allowed'
                        }`
                    },
                    match.hallId ? 'Upraviť priradenie' : 'Priradiť zápas'
                )
            )
        )
    );
};

const HallDayStartTimeModal = ({ isOpen, onClose, onConfirm, hallName, date, currentStartTime }) => {
    const [startTime, setStartTime] = useState(currentStartTime || '08:00');

    useEffect(() => {
        if (isOpen) {
            setStartTime(currentStartTime || '08:00');
        }
    }, [isOpen, currentStartTime]);

    if (!isOpen) return null;

    return React.createElement(
        'div',
        {
            className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]',
            onClick: (e) => {
                if (e.target === e.currentTarget) onClose();
            }
        },
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4' },
            
            // Hlavička
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mb-4' },
                React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, 
                    currentStartTime ? 'Upraviť čas začiatku' : 'Nastavenie času začiatku'
                ),
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'text-gray-500 hover:text-gray-700'
                    },
                    React.createElement('i', { className: 'fa-solid fa-times text-xl' })
                )
            ),

            // Obsah
            React.createElement(
                'div',
                { className: 'mb-6' },
                React.createElement(
                    'p',
                    { className: 'text-gray-700 mb-4' },
                    React.createElement('span', { className: 'font-semibold' }, hallName),
                    ' - ',
                    React.createElement('span', { className: 'font-semibold' }, date)
                ),
                React.createElement(
                    'div',
                    null,
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' },
                        'Čas začiatku prvého zápasu:'
                    ),
                    React.createElement('input', {
                        type: 'time',
                        value: startTime,
                        onChange: (e) => setStartTime(e.target.value),
                        className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black',
                        step: '60'
                    })
                )
            ),

            // Tlačidlá
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
                            onConfirm(startTime);
                            onClose();
                        },
                        className: 'px-4 py-2 text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors'
                    },
                    currentStartTime ? 'Upraviť' : 'Uložiť'
                )
            )
        )
    );
};

const AddMatchesApp = ({ userProfileData }) => {
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
    
    // Nové stavy pre postupné potvrdzovanie existujúcich zápasov
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

    const loadHallSchedules = () => {
        if (!window.db) return;

        const schedulesRef = collection(window.db, 'hallSchedules');
    
        const unsubscribe = onSnapshot(schedulesRef, (snapshot) => {
            const schedules = {};
            snapshot.forEach((doc) => {
                schedules[doc.id] = doc.data();
            });
            setHallSchedules(schedules);
            console.log('Načítané rozvrhy hál:', schedules);
        }, (error) => {
            console.error('Chyba pri načítaní rozvrhov hál:', error);
        });
    
        return unsubscribe;
    };


    const handleHallDayHeaderClick = (hall, date, dateStr) => {
        // Získame existujúci čas pre túto halu a deň
        const scheduleId = `${hall.id}_${date.toISOString().split('T')[0]}`;
        const existingSchedule = hallSchedules[scheduleId];
        const currentStartTime = existingSchedule?.startTime;
    
        setSelectedHallForDay(hall);
        setSelectedDateForHall(date);
        setSelectedDateStrForHall(dateStr);
        setSelectedCurrentStartTime(currentStartTime); // Uložíme existujúci čas
        setIsHallDayModalOpen(true);
    };

    const handleSaveHallStartTime = async (startTime) => {
        if (!window.db || !selectedHallForDay || !selectedDateForHall) {
            window.showGlobalNotification('Chyba pri ukladaní času', 'error');
            return;
        }

        if (userProfileData?.role !== 'admin') {
            window.showGlobalNotification('Na nastavenie času potrebujete administrátorské práva', 'error');
            return;
        }

        try {
            const dateStr = selectedDateForHall.toISOString().split('T')[0];
            const scheduleId = `${selectedHallForDay.id}_${dateStr}`;
            const hallDayRef = doc(window.db, 'hallSchedules', scheduleId);
            
            await setDoc(hallDayRef, {
                hallId: selectedHallForDay.id,
                hallName: selectedHallForDay.name,
                date: dateStr,
                startTime: startTime,
                updatedAt: Timestamp.now(),
                updatedBy: userProfileData?.email || 'unknown'
            }, { merge: true });

            // Manuálne aktualizujeme lokálny state pre okamžité zobrazenie
            setHallSchedules(prev => ({
                ...prev,
                [scheduleId]: {
                    ...prev[scheduleId],
                    startTime: startTime,
                    updatedAt: Timestamp.now(),
                    updatedBy: userProfileData?.email || 'unknown'
                }
            }));
    
            window.showGlobalNotification(
                `Čas začiatku pre ${selectedHallForDay.name} dňa ${selectedDateStrForHall} bol nastavený na ${startTime}`,
                'success'
            );
        } catch (error) {
            console.error('Chyba pri ukladaní času začiatku:', error);
            window.showGlobalNotification('Chyba pri ukladaní času: ' + error.message, 'error');
        }
    };

    // Načítanie režimu zobrazenia z URL pri inicializácii
    const getInitialDisplayMode = () => {
        if (window.location.hash) {
            const hash = window.location.hash.substring(1); // odstránime #
            if (hash === 'nazvy') {
                return 'name';
            } else if (hash === 'id') {
                return 'id';
            } else if (hash === 'oboje') {
                return 'both';
            }
        }
        return 'name'; // predvolená hodnota
    };

    const [displayMode, setDisplayMode] = useState(getInitialDisplayMode);
    const [tournamentStartDate, setTournamentStartDate] = useState('');
    const [tournamentEndDate, setTournamentEndDate] = useState('');
    const [tournamentDatesLoaded, setTournamentDatesLoaded] = useState(false);

    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [selectedMatchForAssign, setSelectedMatchForAssign] = useState(null);

    // Funkcia na zmenu režimu zobrazenia a aktualizáciu URL
    const handleDisplayModeChange = (mode) => {
        setDisplayMode(mode);
    
        // Aktualizujeme URL hash
        let hash = '';
        switch (mode) {
            case 'name':
                hash = 'nazvy';
                break;
            case 'id':
                hash = 'id';
                break;
            case 'both':
                hash = 'oboje';
                break;
            default:
                hash = 'nazvy';
        }
        window.location.hash = hash;
    };

    // Načítanie režimu zobrazenia pri zmene URL (ak používateľ zmení URL manuálne)
    useEffect(() => {
        const handleHashChange = () => {
            if (window.location.hash) {
                const hash = window.location.hash.substring(1);
                if (hash === 'nazvy') {
                    setDisplayMode('name');
                } else if (hash === 'id') {
                    setDisplayMode('id');
                } else if (hash === 'oboje') {
                    setDisplayMode('both');
                }
            }
        };
    
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    const handleMatchCardClick = (match) => {
        setSelectedMatchForAssign(match);
        setIsAssignModalOpen(true);
    };

    const handleUnassignMatch = async (match) => {
        if (!window.db) {
            window.showGlobalNotification('Databáza nie je inicializovaná', 'error');
            return;
        }

        try {
            const matchRef = doc(window.db, 'matches', match.id);
            
            // Odstránime len údaje o priradení, zápas zostáva
            await updateDoc(matchRef, {
                hallId: null,
                scheduledTime: null,
                scheduledEndTime: null,
                duration: null,
                status: 'pending'
            });
    
            window.showGlobalNotification('Priradenie zápasu bolo úspešne odstránené', 'success');
        } catch (error) {
            console.error('Chyba pri odstraňovaní priradenia:', error);
            window.showGlobalNotification('Chyba pri odstraňovaní priradenia: ' + error.message, 'error');
        }
    };
    
    const handleAssignMatch = async (assignment) => {
        if (!window.db) {
            window.showGlobalNotification('Databáza nie je inicializovaná', 'error');
            return;
        }
    
        try {
            const matchRef = doc(window.db, 'matches', assignment.matchId);
            
            // SPRÁVNE vytvorenie dátumu - rozdelíme YYYY-MM-DD na časti
            const [year, month, day] = assignment.date.split('-').map(Number);
            const [hours, minutes] = assignment.time.split(':').map(Number);
            
            // Vytvoríme Date objekt v lokálnom časovom pásme
            const matchDateTime = new Date(year, month - 1, day, hours, minutes, 0);
            
            await updateDoc(matchRef, {
                hallId: assignment.hallId,
                scheduledTime: Timestamp.fromDate(matchDateTime),
                scheduledEndTime: assignment.endTime,
                duration: assignment.duration,
                status: 'scheduled'
            });
    
            window.showGlobalNotification('Zápas bol úspešne priradený do haly', 'success');
        } catch (error) {
            console.error('Chyba pri priradení zápasu:', error);
            window.showGlobalNotification('Chyba pri priradení zápasu: ' + error.message, 'error');
        }
    };

    const formatDateForDisplay = (timestamp) => {
        if (!timestamp) return 'neurčené';
    
        try {
            // Ak je to Firebase Timestamp, konvertujeme na Date
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        
            // Skontrolujeme, či je dátum platný
            if (isNaN(date.getTime())) {
                return 'neplatný dátum';
            }
        
            // Formátujeme v lokálnom časovom pásme (Slovensko)
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const year = date.getFullYear();
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
        
            return `${day}. ${month}. ${year} ${hours}:${minutes}`;
            
        } catch (e) {
            console.error('Chyba pri formátovaní dátumu:', e);
            return 'neplatný dátum';
        }
    };

    const handleDeleteClick = (match) => {
        setSelectedMatchForAction(match);
        setIsDeleteModalOpen(true);
    };

    const handleSwapClick = (match) => {
        setSelectedMatchForAction(match);
        setIsSwapModalOpen(true);
    };

    // Samotné vykonanie zmazania
    const confirmDelete = async () => {
        if (!selectedMatchForAction) return;
        
        if (!window.db) {
            window.showGlobalNotification('Databáza nie je inicializovaná', 'error');
            return;
        }
    
        if (userProfileData?.role !== 'admin') {
            window.showGlobalNotification('Na mazanie zápasov potrebujete administrátorské práva', 'error');
            return;
        }
    
        if (!userProfileData?.approved) {
            window.showGlobalNotification('Váš účet ešte nebol schválený administrátorom.', 'error');
            return;
        }
    
        try {
            const matchRef = doc(window.db, 'matches', selectedMatchForAction.id);
            await deleteDoc(matchRef);
            
            console.log(`Zápas s ID ${selectedMatchForAction.id} bol úspešne zmazaný`);
            window.showGlobalNotification('Zápas bol úspešne zmazaný', 'success');
            setSelectedMatchForAction(null);
        } catch (error) {
            console.error('Chyba pri mazaní zápasu:', error);
            window.showGlobalNotification('Chyba pri mazaní zápasu: ' + error.message, 'error');
        }
    };
    
    // Samotné vykonanie výmeny
    const confirmSwap = async () => {
        if (!selectedMatchForAction) return;
        
        if (!window.db) {
            window.showGlobalNotification('Databáza nie je inicializovaná', 'error');
            return;
        }
    
        if (userProfileData?.role !== 'admin') {
            window.showGlobalNotification('Na úpravu zápasov potrebujete administrátorské práva', 'error');
            return;
        }
    
        if (!userProfileData?.approved) {
            window.showGlobalNotification('Váš účet ešte nebol schválený administrátorom.', 'error');
            return;
        }
    
        try {
            const matchRef = doc(window.db, 'matches', selectedMatchForAction.id);
            
            // Vymeníme homeTeamIdentifier a awayTeamIdentifier
            await updateDoc(matchRef, {
                homeTeamIdentifier: selectedMatchForAction.awayTeamIdentifier,
                awayTeamIdentifier: selectedMatchForAction.homeTeamIdentifier
            });
            
            console.log(`Zápas s ID ${selectedMatchForAction.id} bol úspešne upravený - tímy vymenené`);
            window.showGlobalNotification('Tímy boli úspešne vymenené', 'success');
            setSelectedMatchForAction(null);
        } catch (error) {
            console.error('Chyba pri výmene tímov:', error);
            window.showGlobalNotification('Chyba pri výmene tímov: ' + error.message, 'error');
        }
    };

    // Funkcia na získanie názvu tímu podľa ID alebo priamo z objektu
    const getTeamName = (team) => {
        if (!team) return 'Neznámy tím';
        return team.teamName || 'Neznámy tím';
    };

    // Funkcia na získanie ID tímu (ak existuje)
    const getTeamId = (team) => {
        if (!team) return null;
    
        // Ak má tím priamo id, vrátime ho
        if (team.id) return team.id;
    
        // Ak nemá id, skúsime vytvoriť z userId a teamName
        if (team.userId && team.teamName) {
            return `${team.userId}-${team.teamName}`;
        }
        
        // Fallback
        return null;
    };

    // Funkcia na získanie názvu tímu podľa ID (pre existujúce zápasy)
    const getTeamNameById = (teamId) => {
        if (!teamId) {
            return 'Neznámy tím';
        }
        
        // Najprv zistíme, z ktorej kategórie je tím (podľa zápasu)
        const currentMatch = matches.find(m => m.homeTeamId === teamId || m.awayTeamId === teamId);
        const categoryName = currentMatch?.categoryName;
        
        // Zistenie, či je prvá pomlčka oddeľovačom
        // Oddeľovač je, ak nemá okolo seba medzery (formát "userId-názov")
        const firstDashIndex = teamId.indexOf('-');
        let extractedName = teamId;
        let isFirstDashSeparator = false;
        
        if (firstDashIndex !== -1) {
            // Skontrolujeme, či je okolo pomlčky medzera
            const beforeDash = teamId[firstDashIndex - 1];
            const afterDash = teamId[firstDashIndex + 1];
            
            // Ak pred ani za nie je medzera, je to oddeľovač
            if (beforeDash && beforeDash !== ' ' && afterDash && afterDash !== ' ') {
                isFirstDashSeparator = true;
                extractedName = teamId.substring(firstDashIndex + 1);
            }
            // Inak to nie je oddeľovač, berieme celý reťazec ako názov
        }
        
        // Funkcia na postupné skracovanie názvu pri pomlčkách s medzerami
        const tryFindTeam = (nameToTry) => {
            if (!categoryName) return null;
            
            // Najprv skúsime presný názov
            if (teamData.allTeams && teamData.allTeams.length > 0) {
                const team = teamData.allTeams.find(t => 
                    t.category === categoryName && 
                    t.teamName === nameToTry
                );
                if (team) return team;
            }
            
            if (window.__teamManagerData?.allTeams) {
                const team = window.__teamManagerData.allTeams.find(t => 
                    t.category === categoryName && 
                    t.teamName === nameToTry
                );
                if (team) return team;
            }
            
            return null;
        };
        
        // Najprv skúsime presný extrahovaný názov
        let foundTeam = null;
        if (categoryName) {
            foundTeam = tryFindTeam(extractedName);
        }
        
        // Ak sa nenašiel, skúsime postupne odstraňovať časti za pomlčkami s medzerami
        if (!foundTeam && categoryName) {
            let workingName = extractedName;
            
            // Hľadáme pomlčky s medzerami (formát " - ")
            const dashWithSpacesRegex = /\s+-\s+/g;
            let match;
            let lastIndex = workingName.length;
            
            // Zbierame všetky pozície pomlčiek s medzerami
            const dashPositions = [];
            while ((match = dashWithSpacesRegex.exec(workingName)) !== null) {
                dashPositions.push(match.index);
            }
            
            // Skúšame postupne odstraňovať časti od konca
            for (let i = dashPositions.length - 1; i >= 0; i--) {
                const pos = dashPositions[i];
                const shorterName = workingName.substring(0, pos).trim();
                
                foundTeam = tryFindTeam(shorterName);
                if (foundTeam) break;
            }
        }
        
        // Ak sme našli tím, vrátime jeho názov
        if (foundTeam) {
            return foundTeam.teamName;
        }
        
        // Fallback - ak nemáme kategóriu, skúsime hľadať len podľa názvu v teamData
        if (teamData.allTeams && teamData.allTeams.length > 0) {
            const team = teamData.allTeams.find(t => t.teamName === extractedName);
            if (team) return team.teamName;
        }
        
        if (window.__teamManagerData?.allTeams) {
            const team = window.__teamManagerData.allTeams.find(t => t.teamName === extractedName);
            if (team) {
                setTeamData(window.__teamManagerData);
                return team.teamName;
            }
        }
        
        // Ak nič nenašlo, vrátime extrahovaný názov
        console.warn(`Nenašiel sa tím s kategóriou "${categoryName}" a názvom "${extractedName}"`);
        return extractedName;
    };
    
    // Funkcia na získanie zobrazovaného textu pre tím
    const getTeamDisplayText = (identifier) => {
        if (!identifier) return '---';
        
        const teamName = getTeamNameByIdentifier(identifier);
        
        switch (displayMode) {
            case 'name':
                return teamName;
            case 'id':
                return identifier;
            case 'both':
                // Pre režim "Oboje" vrátime objekt, nie string
                return { name: teamName, id: identifier };
            default:
                return teamName;
        }
    };

    // Pridajte túto funkciu do komponentu AddMatchesApp (napr. za getTeamDisplayText)
    const getMatchesForHallAndDay = (hallId, date) => {
        if (!matches || matches.length === 0) return [];
    
        // Formátujeme dátum pre porovnanie (rovnaký formát ako v selectedDate)
        const dateStr = date.toISOString().split('T')[0];
    
        return matches.filter(match => {
            // Zápas musí mať priradenú halu a naplánovaný čas
            if (!match.hallId || !match.scheduledTime) return false;
        
            // Skontrolujeme, či je zápas pre túto halu
            if (match.hallId !== hallId) return false;
        
            // Skonvertujeme scheduledTime na Date a porovnáme dátum
            try {
                const matchDate = match.scheduledTime.toDate();
                const matchDateStr = matchDate.toISOString().split('T')[0];
                return matchDateStr === dateStr;
            } catch (e) {
                console.error('Chyba pri spracovaní dátumu zápasu:', e);
                return false;
            }
        });
    };

    // Funkcia na kontrolu, či už boli zápasy pre danú kategóriu/skupinu vygenerované
    const hasExistingMatches = (categoryId, groupName) => {
        return matches.some(match => 
            match.categoryId === categoryId && 
            (groupName ? match.groupName === groupName : true)
        );
    };

    // Funkcia na kontrolu existujúcich zápasov počas generovania
    const checkExistingMatchesDuringGeneration = (matchesToGenerate) => {
        const existing = [];
        const newOnes = [];
    
        matchesToGenerate.forEach(match => {
            const exists = matches.some(existingMatch => 
                existingMatch.homeTeamIdentifier === match.homeTeamIdentifier && 
                existingMatch.awayTeamIdentifier === match.awayTeamIdentifier &&
                existingMatch.categoryId === match.categoryId
            );
            
            if (exists) {
                existing.push(match);
            } else {
                newOnes.push(match);
            }
        });
        
        return { existingMatches: existing, newMatches: newOnes };
    };

    // Funkcia na spracovanie ďalšieho existujúceho zápasu
    const processNextExistingMatch = () => {
        console.log('processNextExistingMatch - aktuálny stav:', {
            currentMatchIndex,
            totalExisting: existingMatchesToProcess.length,
            existingMatchesToProcess: existingMatchesToProcess.map(m => ({ 
                home: m.homeTeamIdentifier, 
                away: m.awayTeamIdentifier 
            }))
        });
    
        if (currentMatchIndex < existingMatchesToProcess.length) {
            const match = existingMatchesToProcess[currentMatchIndex];
            console.log('Zobrazujem modálne okno pre zápas č.', currentMatchIndex + 1, 'z', existingMatchesToProcess.length, ':', match);
            setCurrentExistingMatch(match);
            setIsExistingMatchModalOpen(true);
        } else {
            console.log('Všetky existujúce zápasy spracované, ukončujem generovanie');
            finishGeneration();
        }
    };

    // Funkcia na dokončenie generovania
    const finishGeneration = async () => {
        const allMatchesToSave = [...newMatches, ...pendingMatches];
        
        if (allMatchesToSave.length > 0) {
            try {
                window.showGlobalNotification(`Ukladám ${allMatchesToSave.length} zápasov...`, 'info');
                const savedMatches = await saveMatchesToFirebase(allMatchesToSave);
                
                window.showGlobalNotification(
                    `Vygenerovaných a uložených ${savedMatches.length} zápasov pre ${currentCategoryInfo?.name || 'vybranú kategóriu'}${currentCategoryInfo?.groupName ? ' - ' + currentCategoryInfo.groupName : ''}`,
                    'success'
                );
            } catch (error) {
                console.error('Chyba pri ukladaní zápasov:', error);
                window.showGlobalNotification('Chyba pri ukladaní zápasov: ' + error.message, 'error');
            }
        } else {
            window.showGlobalNotification('Žiadne nové zápasy neboli vygenerované', 'info');
        }
        
        // Resetovanie stavov
        setExistingMatchesToProcess([]);
        setNewMatches([]);
        setPendingMatches([]);
        setCurrentMatchIndex(0);
        setCurrentExistingMatch(null);
        setCurrentCategoryInfo(null);
        setGenerationInProgress(false);
    };

    // Handler pre potvrdenie existujúceho zápasu
    const handleConfirmExistingMatch = (match) => {
        // Pridáme zápas do zoznamu na uloženie
        setPendingMatches(prev => [...prev, match]);
        
        // Posunieme sa na ďalší zápas
        const nextIndex = currentMatchIndex + 1;
        setCurrentMatchIndex(nextIndex);
        
        // Spracujeme ďalší existujúci zápas
        setTimeout(() => {
            processNextExistingMatch();
        }, 100);
    };

    // Handler pre zamietnutie existujúceho zápasu
    const handleRejectExistingMatch = () => {
        // Len sa posunieme na ďalší zápas bez pridania
        const nextIndex = currentMatchIndex + 1;
        setCurrentMatchIndex(nextIndex);
        
        // Spracujeme ďalší existujúci zápas
        setTimeout(() => {
            processNextExistingMatch();
        }, 100);
    }; 

/*
    // Funkcia na načítanie používateľov, ktorí vytvorili zápasy
    const loadUsersWithMatches = async () => {
        if (!window.db) return;
        
        try {
            const usersRef = collection(window.db, 'users');
            const usersSnapshot = await getDocs(usersRef);
            
            const users = [];
            usersSnapshot.forEach((doc) => {
                users.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            console.log('=== VŠETCI POUŽÍVATELIA, KTORÍ VYTVORILI ZÁPASY ===');
            
            // Pre každého používateľa zistíme, koľko zápasov vytvoril
            users.forEach(user => {
                const userMatches = matches.filter(match => 
                    match.createdBy === user.email || match.createdByUid === user.id
                );
                
                if (userMatches.length > 0) {
                    console.log(`Používateľ: ${user.email || user.id}`);
                    console.log(`  - ID: ${user.id}`);
                    console.log(`  - Meno: ${user.displayName || 'Nezadané'}`);
                    console.log(`  - Rola: ${user.role || 'Nezadaná'}`);
                    console.log(`  - Schválený: ${user.approved ? 'Áno' : 'Nie'}`);
                    console.log(`  - Počet vytvorených zápasov: ${userMatches.length}`);
                    console.log(`  - Dátum registrácie: ${user.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleString('sk-SK') : 'Neznámy'}`);
                    console.log('  - Vytvorené zápasy:');
                    userMatches.forEach((match, index) => {
                        console.log(`    ${index + 1}. ${match.homeTeamId} vs ${match.awayTeamId} (${match.categoryName || 'Neznáma kategória'}) - ${match.time}`);
                    });
                    console.log('---');
                }
            });
            
            console.log(`Celkový počet používateľov, ktorí vytvorili zápasy: ${users.length}`);
            console.log('===========================================');
            
            setUsersWithMatches(users);
            
        } catch (error) {
            console.error('Chyba pri načítaní používateľov:', error);
        }
    };
*/    

    // Funkcia na načítanie zápasov z Firebase
    const loadMatches = () => {
        if (!window.db) return;

        const matchesRef = collection(window.db, 'matches');
        
        const unsubscribe = onSnapshot(matchesRef, (snapshot) => {
            const loadedMatches = [];
            snapshot.forEach((doc) => {
                loadedMatches.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            // Zoradenie podľa času vytvorenia (najnovšie prvé)
            loadedMatches.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setMatches(loadedMatches);
            
            // Po načítaní zápasov načítame používateľov
//            loadUsersWithMatches();
            
        }, (error) => {
            console.error('Chyba pri načítaní zápasov:', error);
        });

        return unsubscribe;
    };

    // Prihlásenie na odber zmien v teamManager
    useEffect(() => {
        if (window.teamManager) {
            console.log('Prihlasujem sa na odber teamManager');
            
            // Okamžite skúsime načítať existujúce dáta
            if (window.__teamManagerData) {
                console.log('Našiel som existujúce teamManager data, počet tímov:', window.__teamManagerData.allTeams?.length);
                setTeamData(window.__teamManagerData);
                
                // Vypíšeme vlastníkov tímov po krátkom oneskorení (aby sa stihli načítať všetky dáta)
//                setTimeout(() => {
//                    logTeamOwners();
//                }, 1000);
            }
            
            const unsubscribe = window.teamManager.subscribe((data) => {
                console.log('TeamManager data aktualizované, počet tímov:', data.allTeams?.length);
                setTeamData(data);
                
                // Vypíšeme vlastníkov tímov po aktualizácii
//                setTimeout(() => {
//                    logTeamOwners();
//                }, 1000);
            });
            
            return () => {
                console.log('Odhlasujem sa z odberu teamManager');
                if (unsubscribe) unsubscribe();
            };
        } else {
            console.log('teamManager nie je k dispozícii');
            
            // Skúsime načítať dáta priamo z window.__teamManagerData
            if (window.__teamManagerData) {
                console.log('Našiel som window.__teamManagerData, počet tímov:', window.__teamManagerData.allTeams?.length);
                setTeamData(window.__teamManagerData);
                
//                setTimeout(() => {
//                    logTeamOwners();
//                }, 1000);
            }
        }
    }, []);

    useEffect(() => {
        if (existingMatchesToProcess.length > 0 && !isExistingMatchModalOpen && currentMatchIndex === 0) {
            console.log('useEffect: spúšťam spracovanie existujúcich zápasov', {
                count: existingMatchesToProcess.length,
                firstMatch: existingMatchesToProcess[0]
            });
            
            setTimeout(() => {
                processNextExistingMatch();
            }, 100);
        }
    }, [existingMatchesToProcess, isExistingMatchModalOpen, currentMatchIndex]);

    useEffect(() => {
        if (tournamentDatesLoaded) {
            console.log("tournamentStartDate (v stave):", tournamentStartDate);
            console.log("tournamentEndDate (v stave):", tournamentEndDate);
        
            // Ukážka formátovania pre zobrazenie
            if (tournamentStartDate) {
                console.log("Formátovaný začiatok:", formatDateForDisplay(tournamentStartDate));
            }
            if (tournamentEndDate) {
                console.log("Formátovaný koniec:", formatDateForDisplay(tournamentEndDate));
            }
        }
    }, [tournamentStartDate, tournamentEndDate, tournamentDatesLoaded]);

    useEffect(() => {
        if (tournamentStartDate && tournamentEndDate) {
            window.tournamentStartDate = tournamentStartDate;
            window.tournamentEndDate = tournamentEndDate;
        }
    }, [tournamentStartDate, tournamentEndDate]);

    // Funkcia na výpočet celkového času zápasu pre kategóriu
    const calculateTotalMatchTime = (category) => {
        if (!category) return { playingTime: 0, breaksBetweenPeriods: 0, totalTimeWithMatchBreak: 0 };
        
        const periods = category.periods ?? 2;
        const periodDuration = category.periodDuration ?? 20;
        const breakDuration = category.breakDuration ?? 2;
        const matchBreak = category.matchBreak ?? 5;
        
        const playingTime = periods * periodDuration;
        const breaksBetweenPeriods = (periods - 1) * breakDuration;
        const totalTimeWithMatchBreak = playingTime + breaksBetweenPeriods + matchBreak;
        
        return {
            playingTime,
            breaksBetweenPeriods,
            totalTimeWithMatchBreak
        };
    };

    // Funkcia na generovanie zápasov pre skupinu
    const generateMatchesForGroup = (teams, withRepetitions, categoryName) => {
        const matches = [];
        
        // Pre každý tím vytvoríme identifikátor v tvare "kategória skupinaorder"
        const teamIdentifiers = teams.map(t => {
            // Získame názov kategórie
            const category = categoryName || t.category || 'Neznáma kategória';
            
            // Spracujeme názov skupiny - odstránime "skupina " ak existuje
            let groupName = t.groupName || 'Neznáma skupina';
            if (groupName.startsWith('skupina ')) {
                groupName = groupName.substring(8);
            }
            
            // Pridáme order/číslo tímu
            const order = t.order || '?';
            
            // Vytvoríme identifikátor v požadovanom formáte: "kategória skupinaorder" (napr. "U10 A1")
            // Medzera len medzi kategóriou a skupinou, žiadna medzera medzi skupinou a orderom
            const teamIdentifier = `${category} ${groupName}${order}`;
            
            return {
                identifier: teamIdentifier,  // Toto použijeme na identifikáciu
                category: category,
                groupName: groupName,
                order: order
            };
        });
        
        console.log('Generujem zápasy pre tímy:', teamIdentifiers);
        
        if (withRepetitions) {
            // Každý s každým doma/vonku v rámci skupiny
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
            // Jedinečné dvojice (každý s každým raz) v rámci skupiny
            for (let i = 0; i < teamIdentifiers.length; i++) {
                for (let j = i + 1; j < teamIdentifiers.length; j++) {
                    matches.push({
                        homeTeamIdentifier: teamIdentifiers[i].identifier,
                        awayTeamIdentifier: teamIdentifiers[j].identifier,
                    });
                }
            }
        }
        
        console.log(`Vygenerovaných ${matches.length} zápasov`);
        return matches;
    };
    
    // Funkcia na získanie názvu tímu podľa identifikátora
    const getTeamNameByIdentifier = (identifier) => {
        if (!identifier) return 'Neznámy tím';
        
        // Parsujeme identifikátor v tvare "kategória skupinaorder" (napr. "U10 A1")
        // Rozdelíme podľa medzier - bude to mať 2 časti: [kategória, skupinaorder]
        const parts = identifier.split(' ');
        
        if (parts.length < 2) {
            return identifier; // Fallback na identifikátor
        }
        
        // Posledná časť je skupina + order (napr. "A1")
        const groupAndOrder = parts.pop();
        // Zvyšok je kategória (môže byť viacslovná)
        const category = parts.join(' ');
        
        // Rozdelíme groupAndOrder na groupName a order
        // Order je číselná časť na konci, groupName je zvyšok
        let groupName = '';
        let order = '';
        
        for (let i = 0; i < groupAndOrder.length; i++) {
            const char = groupAndOrder[i];
            if (char >= '0' && char <= '9') {
                order = groupAndOrder.substring(i);
                groupName = groupAndOrder.substring(0, i);
                break;
            }
        }
        
        if (!order) {
            order = '?';
            groupName = groupAndOrder;
        }
        
        // Hľadáme v teamData
        if (teamData.allTeams && teamData.allTeams.length > 0) {
            // Pripravíme si groupName s "skupina " pre vyhľadávanie
            const groupNameWithPrefix = `skupina ${groupName}`;
            
            const team = teamData.allTeams.find(t => 
                t.category === category && 
                (t.groupName === groupNameWithPrefix || t.groupName === groupName) &&
                t.order?.toString() === order
            );
            
            if (team) {
                return team.teamName;
            }
        }
        
        // Skúsime v __teamManagerData
        if (window.__teamManagerData?.allTeams) {
            const groupNameWithPrefix = `skupina ${groupName}`;
            
            const team = window.__teamManagerData.allTeams.find(t => 
                t.category === category && 
                (t.groupName === groupNameWithPrefix || t.groupName === groupName) &&
                t.order?.toString() === order
            );
            
            if (team) {
                setTeamData(window.__teamManagerData); // Aktualizujeme teamData
                return team.teamName;
            }
        }
        
        // Fallback - vrátime identifikátor v čitateľnej forme
        return `${category} ${groupName}${order}`;
    };

    // Funkcia na získanie všetkých skupín v kategórii
    const getAllGroupsInCategory = (categoryName) => {
        const groups = [];
        
        // Prejdeme všetky tímy a extrahujeme unikátne skupiny
        const teamsToUse = teamData.allTeams || window.__teamManagerData?.allTeams || [];
        
        if (teamsToUse.length > 0) {
            const teamsInCategory = teamsToUse.filter(t => t.category === categoryName);
            const groupNames = [...new Set(teamsInCategory.map(t => t.groupName).filter(g => g))];
            
            // Zoradenie názvov skupín podľa abecedy
            const sortedGroupNames = groupNames.sort((a, b) => a.localeCompare(b));
            
            sortedGroupNames.forEach(groupName => {
                const teamsInGroup = teamsInCategory.filter(t => t.groupName === groupName);
                if (teamsInGroup.length >= 2) {
                    groups.push({
                        name: groupName,
                        teams: teamsInGroup
                    });
                }
            });
        }
        
        return groups;
    };

    // Funkcia na uloženie zápasov do Firebase
    const saveMatchesToFirebase = async (matchesToSave) => {
        if (!window.db) {
            throw new Error('Databáza nie je inicializovaná');
        }
    
        // DEBUG: Vypíšeme informácie o používateľovi
        console.log('Kontrola admin práv pre ukladanie:');
        console.log('userProfileData:', userProfileData);
        console.log('role:', userProfileData?.role);
        console.log('approved:', userProfileData?.approved);
        console.log('email:', userProfileData?.email);
    
        // Skontrolujeme, či je používateľ admin
        if (userProfileData?.role !== 'admin') {
            console.error('Používateľ nie je admin. Role:', userProfileData?.role);
            throw new Error('Na ukladanie zápasov potrebujete administrátorské práva. Vaša rola: ' + (userProfileData?.role || 'žiadna'));
        }
    
        if (!userProfileData?.approved) {
            console.error('Používateľ nie je schválený. Approved:', userProfileData?.approved);
            throw new Error('Váš účet ešte nebol schválený administrátorom.');
        }
    
        const matchesRef = collection(window.db, 'matches');
        const savedMatches = [];
    
        // Pridáme index do cyklu
        for (let i = 0; i < matchesToSave.length; i++) {
            const match = matchesToSave[i];
            try {
                // Pripravíme dáta pre uloženie
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
                    createdBy: userProfileData?.email || 'unknown',
                    createdByUid: userProfileData?.uid || null
                };
    
                // Uložíme do Firebase a získame ID
                const docRef = await addDoc(matchesRef, matchData);
                savedMatches.push({
                    id: docRef.id,
                    ...matchData
                });
                
                console.log(`Zápas ${i + 1}/${matchesToSave.length} uložený s ID: ${docRef.id}`);
            } catch (error) {
                console.error('Chyba pri ukladaní zápasu:', error);
                
                if (error.code === 'permission-denied') {
                    throw new Error('Nemáte oprávnenie na ukladanie zápasov. Ste prihlásený ako admin? (kód: permission-denied)');
                }
                
                throw error;
            }
        }
    
        return savedMatches;
    };

    // Funkcia na generovanie zápasov
    const generateMatches = async ({ categoryId, groupName, withRepetitions }) => {
        try {
            console.log('Generujem zápasy:', { categoryId, groupName, withRepetitions });
    
            // DEBUG: Skontrolujeme admin práva
            console.log('Kontrola admin práv v generateMatches:');
            console.log('userProfileData:', userProfileData);
            console.log('Je admin?', userProfileData?.role === 'admin');
            
            if (userProfileData?.role !== 'admin') {
                window.showGlobalNotification('Na generovanie zápasov potrebujete administrátorské práva', 'error');
                return;
            }       
            
            // Získanie kategórie
            const category = categories.find(c => c.id === categoryId);
            if (!category) {
                window.showGlobalNotification('Kategória nebola nájdená', 'error');
                return;
            }
    
            // Skontrolujeme, či máme teamManager dáta
            if (!window.teamManager) {
                window.showGlobalNotification('TeamManager nie je inicializovaný', 'error');
                return;
            }
    
            setGenerationInProgress(true);
            let allGeneratedMatches = [];
    
            if (groupName) {
                // Konkrétna skupina
                const teamsInGroup = await window.teamManager.getTeamsByGroup(category.name, groupName);
                
                console.log(`Našiel som ${teamsInGroup.length} tímov v skupine ${groupName}:`, 
                    teamsInGroup.map(t => ({ 
                        id: t.id, 
                        name: t.teamName || t.name,
                        hasId: !!t.id 
                    })));
                
                if (teamsInGroup.length < 2) {
                    window.showGlobalNotification(`V skupine ${groupName} sú menej ako 2 tímy`, 'error');
                    setGenerationInProgress(false);
                    return;
                }
    
                // Generovanie zápasov pre túto skupinu
                const groupMatches = generateMatchesForGroup(teamsInGroup, withRepetitions, category.name);
                
                // Pridanie informácií o skupine ku každému zápasu
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
                // Všetky skupiny v kategórii
                const groups = getAllGroupsInCategory(category.name);
                
                if (groups.length === 0) {
                    window.showGlobalNotification('V tejto kategórii nie sú žiadne skupiny s aspoň 2 tímami', 'error');
                    setGenerationInProgress(false);
                    return;
                }
    
                console.log(`Našiel som ${groups.length} skupín v kategórii ${category.name}:`, 
                    groups.map(g => g.name));
    
                // Pre každú skupinu vygenerujeme zápasy (skupiny sú už zoradené z getAllGroupsInCategory)
                for (const group of groups) {
                    const teamsInGroup = await window.teamManager.getTeamsByGroup(category.name, group.name);
                    
                    if (teamsInGroup.length >= 2) {
                        console.log(`Generujem zápasy pre skupinu ${group.name} s ${teamsInGroup.length} tímami`);
                        
                        const groupMatches = generateMatchesForGroup(teamsInGroup, withRepetitions);
                        
                        const matchesWithInfo = groupMatches.map((match, index) => ({
                            homeTeamId: match.homeTeamId,
                            awayTeamId: match.awayTeamId,
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
    
            // Skontrolujeme existujúce zápasy
            const { existingMatches, newMatches: newOnes } = checkExistingMatchesDuringGeneration(allGeneratedMatches);
    
            console.log('Rozdelenie zápasov:', {
                celkovyPocet: allGeneratedMatches.length,
                existujuce: existingMatches.length,
                nove: newOnes.length
            });
            
            if (existingMatches.length > 0) {
                // Uložíme informácie o generovaní
                setCurrentCategoryInfo({
                    name: category.name,
                    groupName: groupName
                });
                
                // NASTAVÍME STAVY - dôležité: najprv nastavíme newMatches a existingMatchesToProcess
                setNewMatches(newOnes);
                setExistingMatchesToProcess(existingMatches);
                setCurrentMatchIndex(0);
                setPendingMatches([]);
                
                // Vypíšeme pre kontrolu
                console.log('Nastavujem existingMatchesToProcess:', existingMatches);
                console.log('Nastavujem newMatches:', newOnes);
                
            } else {
                // Žiadne existujúce zápasy, rovno uložíme všetky
                if (allGeneratedMatches.length > 0) {
                    console.log('Ukladám zápasy do Firebase...');
                    
                    // Zobrazíme loading notifikáciu
                    window.showGlobalNotification(`Ukladám ${allGeneratedMatches.length} zápasov...`, 'info');
                    
                    // Uložíme do Firebase
                    const savedMatches = await saveMatchesToFirebase(allGeneratedMatches);
                    
                    console.log(`Úspešne uložených ${savedMatches.length} zápasov`);
                    
                    window.showGlobalNotification(
                        `Vygenerovaných a uložených ${savedMatches.length} zápasov pre ${category.name}${groupName ? ' - ' + groupName : ''}`,
                        'success'
                    );
                }
                setGenerationInProgress(false);
            }
    
        } catch (error) {
            console.error('Chyba pri generovaní zápasov:', error);
            window.showGlobalNotification('Chyba pri generovaní zápasov: ' + error.message, 'error');
            setGenerationInProgress(false);
        }
    };

    // Handler pre kliknutie na Generovať
    const handleGenerateClick = (params) => {
        const category = categories.find(c => c.id === params.categoryId);
        if (!category) return;

        // Skontrolujeme, či už existujú zápasy pre túto kategóriu/skupinu
        if (hasExistingMatches(params.categoryId, params.groupName)) {
            setPendingGeneration(params);
            setIsConfirmModalOpen(true);
        } else {
            // Ak neexistujú, rovno generujeme
            generateMatches(params);
        }
    };

    // Handler pre potvrdenie opätovného generovania
    const handleConfirmRegenerate = () => {
        if (pendingGeneration) {
            generateMatches(pendingGeneration);
            setPendingGeneration(null);
        }
    };

    const handleBulkDeleteClick = (params) => {
        const category = categories.find(c => c.id === params.categoryId);
        if (!category) return;
    
        // Spočítame zápasy na zmazanie
        const matchesToDelete = matches.filter(match => 
            match.categoryId === params.categoryId && 
            (params.groupName ? match.groupName === params.groupName : true)
        );
    
        if (matchesToDelete.length === 0) {
            window.showGlobalNotification('Žiadne zápasy na zmazanie', 'info');
            return;
        }
    
        setPendingBulkDelete({
            ...params,
            categoryName: category.name,
            matchesCount: matchesToDelete.length
        });
        setIsBulkDeleteConfirmModalOpen(true);
    };
    
    // Samotné vykonanie hromadného mazania
    const confirmBulkDelete = async () => {
        if (!pendingBulkDelete) return;
    
        if (!window.db) {
            window.showGlobalNotification('Databáza nie je inicializovaná', 'error');
            return;
        }
    
        if (userProfileData?.role !== 'admin') {
            window.showGlobalNotification('Na mazanie zápasov potrebujete administrátorské práva', 'error');
            return;
        }
    
        if (!userProfileData?.approved) {
            window.showGlobalNotification('Váš účet ešte nebol schválený administrátorom.', 'error');
            return;
        }
    
        try {
            // Nájdeme všetky zápasy na zmazanie
            const matchesToDelete = matches.filter(match => 
                match.categoryId === pendingBulkDelete.categoryId && 
                (pendingBulkDelete.groupName ? match.groupName === pendingBulkDelete.groupName : true)
            );
    
            // Postupne mažeme všetky zápasy
            for (const match of matchesToDelete) {
                const matchRef = doc(window.db, 'matches', match.id);
                await deleteDoc(matchRef);
            }
    
            console.log(`Úspešne zmazaných ${matchesToDelete.length} zápasov`);
            window.showGlobalNotification(
                `Zmazaných ${matchesToDelete.length} zápasov pre ${pendingBulkDelete.categoryName}${pendingBulkDelete.groupName ? ' - ' + pendingBulkDelete.groupName : ''}`,
                'success'
            );
            
            setPendingBulkDelete(null);
        } catch (error) {
            console.error('Chyba pri hromadnom mazaní zápasov:', error);
            window.showGlobalNotification('Chyba pri mazaní zápasov: ' + error.message, 'error');
        }
    };

    // Načítanie športových hál a kategórií z Firebase
    useEffect(() => {
        if (!window.db) {
            console.error("Firestore databáza nie je inicializovaná");
            setLoading(false);
            return;
        }

        console.log("AddMatchesApp: Načítavam športové haly a kategórie z databázy...");
        
        // Načítame zápasy
        const unsubscribeMatches = loadMatches();
        const unsubscribeSchedules = loadHallSchedules();

        const loadTournamentDates = async () => {
            try {
                const settingsDocRef = doc(window.db, 'settings', 'registration');
                const settingsSnap = await getDoc(settingsDocRef);
        
                console.log("Načítavam dátumy turnaja...");
                
                if (settingsSnap.exists()) {
                    const data = settingsSnap.data();
                    console.log("Dáta z databázy:", data);
            
                    if (data.tournamentStart) {
                        // Firebase Timestamp
                        const startTimestamp = data.tournamentStart;
                        console.log("Tournament start (Firestore Timestamp):", startTimestamp);
                        
                        // Konvertujeme na Date (automaticky zohľadní UTC)
                        const startDate = startTimestamp.toDate();
                        console.log("Tournament start (Date objekt):", startDate);
                        console.log("Tournament start (UTC string):", startDate.toUTCString());
                        console.log("Tournament start (ISO string):", startDate.toISOString());
                        console.log("Tournament start (lokálny čas):", startDate.toString());
                        
                        // Uložíme pre input type="datetime-local" (formát YYYY-MM-DDTHH:MM)
                        // Toto je v lokálnom časovom pásme
                        const year = startDate.getFullYear();
                        const month = (startDate.getMonth() + 1).toString().padStart(2, '0');
                        const day = startDate.getDate().toString().padStart(2, '0');
                        const hours = startDate.getHours().toString().padStart(2, '0');
                        const minutes = startDate.getMinutes().toString().padStart(2, '0');
                        
                        const formattedForInput = `${year}-${month}-${day}T${hours}:${minutes}`;
                        console.log("Tournament start (pre input):", formattedForInput);
                        
                        setTournamentStartDate(formattedForInput);
                    } else {
                        console.log("Tournament start nie je nastavený");
                    }
                    
                    if (data.tournamentEnd) {
                        // Firebase Timestamp
                        const endTimestamp = data.tournamentEnd;
                        console.log("Tournament end (Firestore Timestamp):", endTimestamp);
                        
                        // Konvertujeme na Date (automaticky zohľadní UTC)
                        const endDate = endTimestamp.toDate();
                        console.log("Tournament end (Date objekt):", endDate);
                        console.log("Tournament end (UTC string):", endDate.toUTCString());
                        console.log("Tournament end (ISO string):", endDate.toISOString());
                        console.log("Tournament end (lokálny čas):", endDate.toString());
                        
                        // Uložíme pre input type="datetime-local" (formát YYYY-MM-DDTHH:MM)
                        const year = endDate.getFullYear();
                        const month = (endDate.getMonth() + 1).toString().padStart(2, '0');
                        const day = endDate.getDate().toString().padStart(2, '0');
                        const hours = endDate.getHours().toString().padStart(2, '0');
                        const minutes = endDate.getMinutes().toString().padStart(2, '0');
                        
                        const formattedForInput = `${year}-${month}-${day}T${hours}:${minutes}`;
                        console.log("Tournament end (pre input):", formattedForInput);
                        
                        setTournamentEndDate(formattedForInput);
                    } else {
                        console.log("Tournament end nie je nastavený");
                    }
                } else {
                    console.log("Dokument 'settings/registration' neexistuje");
                }
                
                setTournamentDatesLoaded(true);
                console.log("Tournament dates loaded:", tournamentDatesLoaded);
                
            } catch (error) {
                console.error("Chyba pri načítaní dátumov turnaja:", error);
            }
        };
        
        // Načítame nastavenia kategórií
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
                            exclusionTime: obj.exclusionTime ?? 2
                        };
                        
                        categoriesList.push(category);
                        
                        // Výpočet času pre túto kategóriu
                        const matchTime = calculateTotalMatchTime(category);
                        
                        // Výpis do konzoly pre každú kategóriu
                        console.log(`Kategória: ${category.name} (ID: ${category.id})`);
                        console.log(`  - Farba pre rozlosovanie: ${category.drawColor}`);
                        console.log(`  - Celkový čas zápasu: ${matchTime.totalTimeWithMatchBreak} min`);
                        console.log(`    (Čistý hrací čas: ${matchTime.playingTime} min, Prestávky: ${matchTime.breaksBetweenPeriods} min)`);
                        console.log(`  - Nastavenia:`);
                        console.log(`    • Počet periód: ${category.periods}`);
                        console.log(`    • Trvanie periódy: ${category.periodDuration} min`);
                        console.log(`    • Prestávka medzi periódami: ${category.breakDuration} min`);
                        console.log(`    • Prestávka medzi zápasmi: ${category.matchBreak} min`);
                        console.log(`    • Počet timeoutov: ${category.timeoutCount}`);
                        console.log(`    • Trvanie timeoutu: ${category.timeoutDuration} min`);
                        console.log(`    • Čas vylúčenia: ${category.exclusionTime} min`);
                        console.log(`    • Farba pre dopravu: ${category.transportColor}`);
                        console.log('---');
                    });
                    
                    setCategories(categoriesList);
                    console.log(`AddMatchesApp: Načítaných ${categoriesList.length} kategórií`);
                } else {
                    console.log("AddMatchesApp: Žiadne kategórie neboli nájdené");
                }
            } catch (error) {
                console.error("AddMatchesApp: Chyba pri načítaní nastavení kategórií:", error);
            }
        };

        loadTournamentDates();
        loadCategorySettings();

        // Načítanie skupín
        const loadGroups = async () => {
            try {
                const groupsRef = doc(window.db, 'settings', 'groups');
                const groupsSnap = await getDoc(groupsRef);
                
                if (groupsSnap.exists()) {
                    setGroupsByCategory(groupsSnap.data());
                }
            } catch (error) {
                console.error("AddMatchesApp: Chyba pri načítaní skupín:", error);
            }
        };

        loadGroups();
        
        const unsubscribePlaces = onSnapshot(
            collection(window.db, 'places'),
            (snapshot) => {
                const loadedPlaces = [];
                snapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    const loc = data.location;
                    
                    loadedPlaces.push({
                        id: docSnap.id,
                        name: data.name,
                        type: data.type,
                        lat: loc?.latitude ?? data.lat,
                        lng: loc?.longitude ?? data.lng,
                    });
                });
                
                // Filtrujeme len športové haly
                const filteredHalls = loadedPlaces.filter(place => place.type === 'sportova_hala');
                setSportHalls(filteredHalls);
                setLoading(false);
                
                console.log(`AddMatchesApp: Načítaných ${filteredHalls.length} športových hál`);
            },
            (error) => {
                console.error("AddMatchesApp: Chyba pri načítaní miest:", error);
                window.showGlobalNotification('Nepodarilo sa načítať športové haly', 'error');
                setLoading(false);
            }
        );

        return () => {
            if (unsubscribeMatches) unsubscribeMatches();
            if (unsubscribeSchedules) unsubscribeSchedules();
            unsubscribePlaces();
        };
    }, []);

    // ZJEDNODUŠENÝ RENDER - dva stĺpce (ľavý - zápasy, pravý - haly)
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
            onClose: () => {
                setIsConfirmModalOpen(false);
                setPendingGeneration(null);
            },
            onConfirm: handleConfirmRegenerate,
            categoryName: pendingGeneration ? categories.find(c => c.id === pendingGeneration.categoryId)?.name : '',
            groupName: pendingGeneration?.groupName
        }),
        React.createElement(HallDayStartTimeModal, {
            isOpen: isHallDayModalOpen,
            onClose: () => {
                setIsHallDayModalOpen(false);
                setSelectedHallForDay(null);
                setSelectedDateForHall(null);
                setSelectedDateStrForHall('');
                setSelectedCurrentStartTime(null);
            },
            onConfirm: handleSaveHallStartTime,
            hallName: selectedHallForDay?.name,
            date: selectedDateStrForHall,
            currentStartTime: selectedCurrentStartTime
        }),
        React.createElement(ConfirmExistingMatchModal, {
            isOpen: isExistingMatchModalOpen,
            onClose: () => {
                setIsExistingMatchModalOpen(false);
                setCurrentExistingMatch(null);
                handleRejectExistingMatch();
            },
            onConfirm: handleConfirmExistingMatch,
            match: currentExistingMatch,
            homeTeamDisplay: currentExistingMatch ? getTeamDisplayText(currentExistingMatch.homeTeamIdentifier) : '',
            awayTeamDisplay: currentExistingMatch ? getTeamDisplayText(currentExistingMatch.awayTeamIdentifier) : ''
        }),
        React.createElement(ConfirmDeleteModal, {
            isOpen: isDeleteModalOpen,
            onClose: () => {
                setIsDeleteModalOpen(false);
                setSelectedMatchForAction(null);
            },
            onConfirm: confirmDelete,
            homeTeamDisplay: selectedMatchForAction ? getTeamDisplayText(selectedMatchForAction.homeTeamIdentifier) : '',
            awayTeamDisplay: selectedMatchForAction ? getTeamDisplayText(selectedMatchForAction.awayTeamIdentifier) : '',
            displayMode: displayMode
        }),
        React.createElement(ConfirmSwapModal, {
            isOpen: isSwapModalOpen,
            onClose: () => {
                setIsSwapModalOpen(false);
                setSelectedMatchForAction(null);
            },
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
            onClose: () => {
                setIsBulkDeleteConfirmModalOpen(false);
                setPendingBulkDelete(null);
            },
            onConfirm: confirmBulkDelete,
            categoryName: pendingBulkDelete?.categoryName,
            groupName: pendingBulkDelete?.groupName,
            matchesCount: pendingBulkDelete?.matchesCount || 0
        }),
        React.createElement(AssignMatchModal, {
            isOpen: isAssignModalOpen,
            onClose: () => {
                setIsAssignModalOpen(false);
                setSelectedMatchForAssign(null);
            },
            match: selectedMatchForAssign,
            sportHalls: sportHalls,
            categories: categories,
            onAssign: handleAssignMatch,
            allMatches: matches
        }),
        React.createElement(
            'div',
            { className: 'flex-grow flex justify-center items-start w-full' },
            React.createElement(
                'div',
                { className: 'w-full bg-white rounded-xl shadow-xl p-8 mx-4' },
                
                // Ovládacie prvky - už bez prepínača
                React.createElement(
                    'div',
                    { className: 'flex items-center gap-3 flex-wrap justify-center' },
                    // Nový prepínač s tromi možnosťami
                    React.createElement(
                        'div',
                        { className: 'flex items-center gap-2 bg-gray-100 p-1 rounded-lg' },
                        React.createElement(
                            'button',
                            { 
                                className: `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                                    displayMode === 'name' 
                                        ? 'bg-blue-600 text-white shadow-sm' 
                                        : 'text-gray-600 hover:bg-gray-200'
                                }`,
                                onClick: () => handleDisplayModeChange('name')
                            },
                            'Názvy'
                        ),
                        React.createElement(
                            'button',
                            { 
                                className: `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                                    displayMode === 'id' 
                                        ? 'bg-blue-600 text-white shadow-sm' 
                                        : 'text-gray-600 hover:bg-gray-200'
                                }`,
                                onClick: () => handleDisplayModeChange('id')
                            },
                            'ID'
                        ),
                        React.createElement(
                            'button',
                            { 
                                className: `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                                    displayMode === 'both' 
                                        ? 'bg-blue-600 text-white shadow-sm' 
                                        : 'text-gray-600 hover:bg-gray-200'
                                }`,
                                onClick: () => handleDisplayModeChange('both')
                            },
                            'Oboje'
                        )
                    ),
                    
                    generationInProgress && React.createElement(
                        'div',
                        { className: 'flex items-center gap-2 text-blue-600 bg-blue-50 px-4 py-2 rounded-lg' },
                        React.createElement('div', { className: 'animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600' }),
                        React.createElement('span', { className: 'text-sm font-medium' }, 'Generujem zápasy...')
                    )
                ),
                
                // Dva stĺpce - ľavý pre zápasy, pravý pre haly
                React.createElement(
                    'div',
                    { className: 'flex flex-col lg:flex-row gap-6 mt-4 min-h-[700px]' },
                    
                    // ĽAVÝ STĹPEC - Zoznam nepriradených zápasov
                    React.createElement(
                        'div',
                        { className: 'lg:w-1/3 bg-gray-50 rounded-xl p-4 border border-gray-200 flex flex-col h-full' },
                        
                        // Hlavička s nadpisom a tlačidlami
                        React.createElement(
                            'div',
                            { className: 'flex-shrink-0' },
                            React.createElement(
                                'div',
                                { className: 'flex items-center justify-between border-b pb-2' },
                                React.createElement(
                                    'h3',
                                    { className: 'text-xl font-semibold text-gray-700' },
                                    'Nepriradené zápasy'
                                ),
                                React.createElement(
                                    'span',
                                    { className: 'text-sm font-normal text-gray-500' },
                                    `(${matches.filter(m => !m.hallId).length})`
                                )
                            ),
                            
                            // Tlačidlá pre generovanie a mazanie - umiestnené pod nadpisom
                            React.createElement(
                                'div',
                                { className: 'flex items-center gap-2 mt-3' },
                                // Tlačidlo pre generovanie zápasov
                                React.createElement(
                                    'button',
                                    { 
                                        className: `w-10 h-10 ${generationInProgress ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'} text-white rounded-full flex items-center justify-center transition-colors shadow-md`,
                                        onClick: () => setIsModalOpen(true),
                                        disabled: generationInProgress,
                                        title: 'Generovať zápasy'
                                    },
                                    React.createElement('i', { className: 'fa-solid fa-plus text-lg' })
                                ),
                                // Tlačidlo pre mazanie zápasov
                                React.createElement(
                                    'button',
                                    { 
                                        className: `w-10 h-10 ${generationInProgress ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'} text-white rounded-full flex items-center justify-center transition-colors shadow-md`,
                                        onClick: () => setIsDeleteMatchesModalOpen(true),
                                        disabled: generationInProgress,
                                        title: 'Zmazať zápasy podľa kategórie/skupiny'
                                    },
                                    React.createElement('i', { className: 'fa-solid fa-minus text-lg' })
                                )
                            )
                        ),
                        
                        // Zoznam nepriradených zápasov - filtrujeme len zápasy bez hallId
                        matches.filter(m => !m.hallId).length === 0 ? 
                            React.createElement(
                                'div',
                                { className: 'flex-1 flex items-center justify-center text-center py-8 text-gray-500' },
                                React.createElement(
                                    'div',
                                    null,
                                    React.createElement('i', { className: 'fa-solid fa-calendar-xmark text-4xl mb-3 opacity-30' }),
                                    React.createElement('p', { className: 'text-sm' }, 'Žiadne nepriradené zápasy')
                                )
                            ) :
                            React.createElement(
                                'div',
                                { className: 'flex-1 overflow-y-auto pr-2 space-y-3 mt-4' },
                                matches.filter(m => !m.hallId).map(match => {
                                    // Použijeme prepínač pre zobrazenie
                                    const homeTeamDisplay = getTeamDisplayText(match.homeTeamIdentifier);
                                    const awayTeamDisplay = getTeamDisplayText(match.awayTeamIdentifier);
                                    
                                    return React.createElement(
                                        'div',
                                        { 
                                            key: match.id,
                                            className: 'bg-white p-4 rounded-lg border border-gray-200 hover:shadow-md transition-shadow relative group cursor-pointer',
                                            onClick: () => handleMatchCardClick(match)
                                        },
                                        // Tlačidlo pre zmazanie (zobrazí sa pri hoveri)
                                        userProfileData?.role === 'admin' && React.createElement(
                                            'div',
                                            { className: 'absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity' },
                                            // Ikona pre výmenu tímov
                                            React.createElement(
                                                'button',
                                                {
                                                    onClick: (e) => {
                                                        e.stopPropagation();
                                                        handleSwapClick(match);
                                                    },
                                                    className: 'w-8 h-8 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center justify-center shadow-md',
                                                    title: 'Vymeniť domáci a hosťovský tím'
                                                },
                                                React.createElement('i', { className: 'fa-solid fa-arrow-right-arrow-left text-sm' })
                                            ),
                                            // Ikona pre zmazanie
                                            React.createElement(
                                                'button',
                                                {
                                                    onClick: (e) => {
                                                        e.stopPropagation();
                                                        handleDeleteClick(match);
                                                    },
                                                    className: 'w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-md',
                                                    title: 'Zmazať zápas'
                                                },
                                                React.createElement('i', { className: 'fa-solid fa-trash-can text-sm' })
                                            )
                                        ),
                                        React.createElement(
                                            'div',
                                            { className: 'flex justify-between items-start mb-2' },
                                            React.createElement(
                                                'span',
                                                { className: 'text-xs font-medium px-2 py-1 bg-blue-100 text-blue-700 rounded-full' },
                                                '--:--'
                                            ),
                                            React.createElement(
                                                'span',
                                                { className: 'text-xs text-gray-500' },
                                                match.categoryName || 'Neznáma kategória'
                                            )
                                        ),
                                        React.createElement(
                                            'div',
                                            { className: 'flex items-center justify-between' },
                                            displayMode === 'both' 
                                                ? React.createElement(
                                                    'div',
                                                    { className: 'flex flex-col items-start' },
                                                    React.createElement(
                                                        'span',
                                                        { 
                                                            className: 'font-semibold text-sm text-gray-800',
                                                            title: match.homeTeamIdentifier
                                                        },
                                                        homeTeamDisplay.name
                                                    ),
                                                    React.createElement(
                                                        'span',
                                                        { 
                                                            className: 'text-xs text-gray-500 mt-0.5',
                                                            title: match.homeTeamIdentifier
                                                        },
                                                        `(${homeTeamDisplay.id})`
                                                    )
                                                )
                                                : React.createElement(
                                                    'span',
                                                    { 
                                                        className: 'font-semibold text-sm text-gray-800',
                                                        title: match.homeTeamIdentifier
                                                    },
                                                    homeTeamDisplay
                                                ),
                                            
                                            React.createElement('i', { className: 'fa-solid fa-vs text-xs text-gray-400 mx-2' }),
                                            
                                            displayMode === 'both' 
                                                ? React.createElement(
                                                    'div',
                                                    { className: 'flex flex-col items-start' },
                                                    React.createElement(
                                                        'span',
                                                        { 
                                                            className: 'font-semibold text-sm text-gray-800',
                                                            title: match.awayTeamIdentifier
                                                        },
                                                        awayTeamDisplay.name
                                                    ),
                                                    React.createElement(
                                                        'span',
                                                        { 
                                                            className: 'text-xs text-gray-500 mt-0.5',
                                                            title: match.awayTeamIdentifier
                                                        },
                                                        `(${awayTeamDisplay.id})`
                                                    )
                                                )
                                                : React.createElement(
                                                    'span',
                                                    { 
                                                        className: 'font-semibold text-sm text-gray-800',
                                                        title: match.awayTeamIdentifier
                                                    },
                                                    awayTeamDisplay
                                                )
                                        ),
                                        React.createElement(
                                            'div',
                                            { className: 'mt-2 text-xs text-gray-500 flex items-center' },
                                            React.createElement('i', { className: 'fa-solid fa-location-dot mr-1 text-gray-400' }),
                                            'Nepriradené',
                                            match.groupName && React.createElement(
                                                'span',
                                                { className: 'ml-2 px-2 py-0.5 bg-gray-100 rounded-full' },
                                                match.groupName
                                            )
                                        )
                                    );
                                })
                            )
                    ),
                    
                    // PRAVÝ STĹPEC - Športové haly
                    React.createElement(
                        'div',
                        { className: 'lg:w-2/3 flex flex-col' },
                        React.createElement(
                            'h3',
                            { className: 'text-xl font-semibold mb-4 text-gray-700 border-b pb-2 flex-shrink-0' },
                            React.createElement('i', { className: 'fa-solid fa-futbol mr-2 text-red-500' }),
                            'Športové haly',
                            React.createElement('span', { className: 'ml-2 text-sm font-normal text-gray-500' },
                                `(${sportHalls.length} ${sportHalls.length === 1 ? 'hala' : sportHalls.length < 5 ? 'haly' : 'hál'})`
                            )
                        ),
                        
                        // Indikátor načítavania
                        loading && React.createElement(
                            'div',
                            { className: 'flex-1 flex justify-center items-center py-12' },
                            React.createElement('div', { className: 'animate-spin rounded-full h-12 w-12 border-b-4 border-blue-500' })
                        ),
                        
                        // Žiadne haly
                        !loading && sportHalls.length === 0 && React.createElement(
                            'div',
                            { className: 'flex-1 flex items-center justify-center text-center py-12 text-gray-500 bg-gray-50 rounded-lg' },
                            React.createElement(
                                'div',
                                null,
                                React.createElement('i', { className: 'fa-solid fa-map-pin text-5xl mb-4 opacity-30' }),
                                React.createElement('p', { className: 'text-lg' }, 'Žiadne športové haly nie sú k dispozícii'),
                                React.createElement('p', { className: 'text-sm mt-2' }, 'Pridajte prvú športovú halu v mape.')
                            )
                        ),
                        
                        // Grid zoznam športových hál s kartami pre jednotlivé dni
                        !loading && sportHalls.length > 0 && React.createElement(
                            'div',
                            { className: 'space-y-4 overflow-y-auto pr-2 flex-1' },
                            sportHalls.map((hall) => {
                                const typeConfig = typeIcons[hall.type] || { icon: 'fa-futbol', color: '#dc2626' };
                                
                                // Generovanie zoznamu dní medzi začiatkom a koncom turnaja
                                const tournamentDays = [];
                                if (tournamentStartDate && tournamentEndDate) {
                                    const startDate = new Date(tournamentStartDate);
                                    const endDate = new Date(tournamentEndDate);
                                    
                                    // Nastavíme na začiatok dňa pre správne porovnávanie
                                    startDate.setHours(0, 0, 0, 0);
                                    endDate.setHours(0, 0, 0, 0);
                                    
                                    const currentDate = new Date(startDate);
                                    
                                    while (currentDate <= endDate) {
                                        tournamentDays.push(new Date(currentDate));
                                        currentDate.setDate(currentDate.getDate() + 1);
                                    }
                                }
                                
                                return React.createElement(
                                    'div',
                                    { 
                                        key: hall.id,
                                        className: 'bg-white rounded-xl border-2 border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden'
                                    },
                                    // Hlavička haly
                                    React.createElement(
                                        'div',
                                        { className: 'p-5 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200' },
                                        React.createElement(
                                            'div',
                                            { className: 'flex items-center' },
                                            React.createElement(
                                                'div',
                                                { 
                                                    className: 'w-14 h-14 rounded-full flex items-center justify-center mr-4 flex-shrink-0',
                                                    style: { 
                                                        backgroundColor: typeConfig.color + '20',
                                                        border: `3px solid ${typeConfig.color}`
                                                    }
                                                },
                                                React.createElement('i', { 
                                                    className: `fa-solid ${typeConfig.icon} text-2xl`,
                                                    style: { color: typeConfig.color }
                                                })
                                            ),
                                            React.createElement(
                                                'div',
                                                { className: 'flex-1' },
                                                React.createElement('h4', { className: 'font-bold text-xl text-gray-800' }, hall.name),
                                                React.createElement('span', { 
                                                    className: 'inline-block px-3 py-1 text-xs font-medium rounded-full mt-1',
                                                    style: { 
                                                        backgroundColor: typeConfig.color + '20',
                                                        color: typeConfig.color
                                                    }
                                                }, 'Športová hala')
                                            )
                                        )
                                    ),
                                    
                                    tournamentDays.length > 0 && React.createElement(
                                        'div',
                                        { className: 'p-4 bg-gray-50' },
                                        React.createElement(
                                            'div',
                                            { 
                                                className: 'flex flex-wrap gap-2' // Zmena na flex-wrap a gap namiesto space-y
                                            },
                                            tournamentDays.map((date, index) => {
                                                const dateStr = date.toLocaleDateString('sk-SK', {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    year: 'numeric'
                                                });
                                                
                                                // Získame zápasy pre túto halu a tento deň
                                                const hallMatches = getMatchesForHallAndDay(hall.id, date);
                                                const matchesCount = hallMatches.length;
                                                
                                                return React.createElement(
                                                    'div',
                                                    {
                                                        key: index,
                                                        className: 'flex flex-col p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-sm transition-all group min-w-[280px] flex-1' // Pridaná min-width a flex-1 pre rovnomerne široké boxy
                                                    },
                                                    // Hlavička dňa s dátumom a počtom zápasov - klikateľná
                                                    React.createElement(
                                                        'div',
                                                        { 
                                                            className: 'flex items-center justify-between mb-2 pb-1 border-b border-gray-100 cursor-pointer hover:bg-blue-50 p-2 -m-2 rounded transition-colors',
                                                            onClick: (e) => {
                                                                e.stopPropagation();
                                                                handleHallDayHeaderClick(hall, date, dateStr);
                                                            },
                                                            title: 'Kliknite pre nastavenie času začiatku prvého zápasu'
                                                        },
                                                        React.createElement(
                                                            'div',
                                                            { className: 'flex items-center gap-2 whitespace-nowrap' }, // Pridaný whitespace-nowrap
                                                            React.createElement('i', { className: 'fa-solid fa-calendar-day text-gray-400 text-sm flex-shrink-0' }), // Pridaný flex-shrink-0
                                                            React.createElement(
                                                                'span',
                                                                { className: 'text-sm font-semibold text-gray-800' },
                                                                dateStr
                                                            ),
                                                            // Zobrazenie uloženého času ak existuje
                                                            (() => {
                                                                const scheduleId = `${hall.id}_${date.toISOString().split('T')[0]}`;
                                                                const savedSchedule = hallSchedules[scheduleId];
                                                                if (savedSchedule?.startTime) {
                                                                    return React.createElement(
                                                                        'span',
                                                                        { className: 'text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full ml-2 whitespace-nowrap' }, // Pridaný whitespace-nowrap
                                                                        React.createElement('i', { className: 'fa-regular fa-clock mr-1 text-xs flex-shrink-0' }), // Pridaný flex-shrink-0
                                                                        savedSchedule.startTime
                                                                    );
                                                                }
                                                                return React.createElement('i', { className: 'fa-regular fa-clock text-xs text-blue-400 ml-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0' }); // Pridaný flex-shrink-0
                                                            })()
                                                        ),
                                                        React.createElement(
                                                            'div',
                                                            { className: 'flex items-center gap-2 flex-shrink-0' }, // Pridaný flex-shrink-0
                                                            matchesCount > 0 && React.createElement(
                                                                'span',
                                                                { className: 'text-xs text-gray-500 whitespace-nowrap' }, // Pridaný whitespace-nowrap
                                                                (() => {
                                                                    // Funkcia pre správne skloňovanie slova "zápas"
                                                                    if (matchesCount === 1) return `${matchesCount} zápas`;
                                                                    if (matchesCount >= 2 && matchesCount <= 4) return `${matchesCount} zápasy`;
                                                                    return `${matchesCount} zápasov`;
                                                                })()
                                                            ),
                                                            matchesCount > 0 && React.createElement(
                                                                'span',
                                                                { className: 'w-2 h-2 bg-green-500 rounded-full flex-shrink-0' } // Pridaný flex-shrink-0
                                                            )
                                                        )
                                                    ),
                                                    
                                                    // Zoznam zápasov pre tento deň - bez scrollovania, výška sa prispôsobí obsahu
                                                    matchesCount > 0 ? 
                                                        React.createElement(
                                                            'div',
                                                            { className: 'space-y-1 text-xs' },
                                                            hallMatches
                                                                .sort((a, b) => {
                                                                    if (!a.scheduledTime) return 1;
                                                                    if (!b.scheduledTime) return -1;
                                                                    try {
                                                                        const timeA = a.scheduledTime.toDate().getTime();
                                                                        const timeB = b.scheduledTime.toDate().getTime();
                                                                        return timeA - timeB;
                                                                    } catch (e) {
                                                                        return 0;
                                                                    }
                                                                })
                                                                .map((match, idx) => {
                                                                    let matchTime = '--:--';
                                                                    let endTime = '--:--';
                                                                    if (match.scheduledTime) {
                                                                        try {
                                                                            const date = match.scheduledTime.toDate();
                                                                            matchTime = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
                                                                            endTime = match.scheduledEndTime || '--:--';
                                                                        } catch (e) {
                                                                            console.error('Chyba pri formátovaní času:', e);
                                                                        }
                                                                    }
                                                                    
                                                                    const homeDisplay = getTeamDisplayText(match.homeTeamIdentifier);
                                                                    const awayDisplay = getTeamDisplayText(match.awayTeamIdentifier);
                                                                    
                                                                    return React.createElement(
                                                                        'div',
                                                                        {
                                                                            key: idx,
                                                                            className: 'p-2 bg-white rounded border border-gray-200 hover:border-blue-400 hover:shadow-sm transition-all relative group'
                                                                        },
                                                                        React.createElement(
                                                                            'div',
                                                                            { 
                                                                                className: 'grid grid-cols-12 gap-1 text-xs cursor-pointer',
                                                                                onClick: (e) => {
                                                                                    e.stopPropagation();
                                                                                    handleMatchCardClick(match);
                                                                                },
                                                                                title: `Kliknite pre úpravu zápasu`
                                                                            },
                                                                            React.createElement(
                                                                                'div',
                                                                                { className: 'col-span-2 flex items-center gap-1 whitespace-nowrap' }, // Pridaný whitespace-nowrap
                                                                                React.createElement('i', { className: 'fa-solid fa-clock text-blue-600 text-xs flex-shrink-0' }), // Pridaný flex-shrink-0
                                                                                React.createElement('span', { className: 'font-medium text-blue-700' }, `${matchTime} - ${endTime}`)
                                                                            ),
                                                                            React.createElement(
                                                                                'div',
                                                                                { className: 'col-span-3 truncate font-medium text-gray-800' }, // Ponechaný truncate pre dlhé názvy
                                                                                displayMode === 'both' ? homeDisplay.name : homeDisplay
                                                                            ),
                                                                            React.createElement(
                                                                                'div',
                                                                                { className: 'col-span-3 truncate font-medium text-gray-800' }, // Ponechaný truncate pre dlhé názvy
                                                                                displayMode === 'both' ? awayDisplay.name : awayDisplay
                                                                            ),
                                                                            React.createElement(
                                                                                'div',
                                                                                { className: 'col-span-1 text-center text-gray-400' },
                                                                                ''
                                                                            ),
                                                                            React.createElement(
                                                                                'div',
                                                                                { className: 'col-span-1 truncate text-gray-500 font-mono text-[10px]' }, // Ponechaný truncate pre ID
                                                                                displayMode === 'both' ? `(${homeDisplay.id})` : ''
                                                                            ),
                                                                            React.createElement(
                                                                                'div',
                                                                                { className: 'col-span-1 truncate text-gray-500 font-mono text-[10px]' }, // Ponechaný truncate pre ID
                                                                                displayMode === 'both' ? `(${awayDisplay.id})` : ''
                                                                            ),
                                                                            displayMode !== 'both' && React.createElement('div', { className: 'col-span-2' })
                                                                        ),
                                                                        
                                                                        userProfileData?.role === 'admin' && React.createElement(
                                                                            'div',
                                                                            { className: 'absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity' },
                                                                            React.createElement(
                                                                                'button',
                                                                                {
                                                                                    className: 'w-6 h-6 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center justify-center shadow-md flex-shrink-0', // Pridaný flex-shrink-0
                                                                                    onClick: (e) => {
                                                                                        e.stopPropagation();
                                                                                        handleSwapClick(match);
                                                                                    },
                                                                                    title: 'Vymeniť domáci a hosťovský tím'
                                                                                },
                                                                                React.createElement('i', { className: 'fa-solid fa-arrow-right-arrow-left text-xs' })
                                                                            ),
                                                                            React.createElement(
                                                                                'button',
                                                                                {
                                                                                    className: 'w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-md flex-shrink-0', // Pridaný flex-shrink-0
                                                                                    onClick: (e) => {
                                                                                        e.stopPropagation();
                                                                                        handleUnassignMatch(match);
                                                                                    },
                                                                                    title: 'Odstrániť priradenie (miesto a čas)'
                                                                                },
                                                                                React.createElement('i', { className: 'fa-solid fa-trash-can text-xs' })
                                                                            )
                                                                        )
                                                                    );
                                                                })
                                                        ) :
                                                        React.createElement(
                                                            'div',
                                                            {
                                                                className: 'w-full py-2 text-xs text-gray-400 bg-gray-50 rounded border border-dashed border-gray-300 flex items-center justify-center gap-1 whitespace-nowrap' // Pridaný whitespace-nowrap
                                                            },
                                                            React.createElement('i', { className: 'fa-solid fa-calendar-xmark text-xs flex-shrink-0' }), // Pridaný flex-shrink-0
                                                            React.createElement('span', null, 'Žiadne zápasy')
                                                        )
                                                );
                                            })
                                        )
                                    ),
                                    
                                    // Ak nie sú nastavené dátumy turnaja
                                    !tournamentDatesLoaded || (!tournamentStartDate && !tournamentEndDate) ? React.createElement(
                                        'div',
                                        { className: 'p-4 bg-yellow-50 border-t border-yellow-200' },
                                        React.createElement(
                                            'div',
                                            { className: 'flex items-center gap-2 text-yellow-700' },
                                            React.createElement('i', { className: 'fa-solid fa-exclamation-triangle text-sm' }),
                                            React.createElement('span', { className: 'text-sm' }, 'Nie sú nastavené dátumy turnaja')
                                        )
                                    ) : null
                                );
                            })
                        )
                    )
                )
            )
        )
    );
};

// Premenná na sledovanie, či bol poslucháč už nastavený
let isEmailSyncListenerSetup = false;

/**
 * Táto funkcia je poslucháčom udalosti 'globalDataUpdated'.
 * Akonáhle sa dáta používateľa načítajú, vykreslí aplikáciu AddMatchesApp.
 */
const handleDataUpdateAndRender = (event) => {
    const userProfileData = event.detail;
    const rootElement = document.getElementById('root');

    if (userProfileData) {
        // Synchronizácia e-mailu (ponechané pre funkcionalitu)
        if (window.auth && window.db && !isEmailSyncListenerSetup) {
            console.log("logged-in-matches.js: Nastavujem poslucháča na synchronizáciu e-mailu.");
            
            onAuthStateChanged(window.auth, async (user) => {
                if (user) {
                    try {
                        const userProfileRef = doc(window.db, 'users', user.uid);
                        const docSnap = await getDoc(userProfileRef);
            
                        if (docSnap.exists()) {
                            const firestoreEmail = docSnap.data().email;
                            if (user.email !== firestoreEmail) {
                                console.log(`E-mail v autentifikácii (${user.email}) sa líši od e-mailu vo Firestore (${firestoreEmail}). Aktualizujem...`);
                                
                                await updateDoc(userProfileRef, {
                                    email: user.email
                                });
            
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
        // Loader keď nie sú dáta
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

// Registrácia poslucháča
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
                { className: 'flex justify-center items-center h-full pt-16 w-full' },
                React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
            )
        );
    }
}
