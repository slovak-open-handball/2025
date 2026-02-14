// Importy pre Firebase funkcie
import { doc, getDoc, getDocs, onSnapshot, updateDoc, addDoc, deleteDoc, collection, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
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

// Modálne okno pre potvrdenie pri existujúcom zápase
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
                    { className: 'text-gray-700 mb-4' },
                    'Zápas medzi tímami ',
                    React.createElement('span', { className: 'font-semibold' }, homeTeamDisplay),
                    ' a ',
                    React.createElement('span', { className: 'font-semibold' }, awayTeamDisplay),
                    ' už existuje.'
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-700' },
                    'Chcete ho vygenerovať znovu?'
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

const ConfirmDeleteModal = ({ isOpen, onClose, onConfirm, homeTeamDisplay, awayTeamDisplay }) => {
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
                    'Naozaj chcete zmazať zápas medzi tímami ',
                    React.createElement('span', { className: 'font-semibold' }, homeTeamDisplay),
                    ' a ',
                    React.createElement('span', { className: 'font-semibold' }, awayTeamDisplay),
                    '?'
                ),
                React.createElement(
                    'p',
                    { className: 'text-sm text-red-600' },
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

const ConfirmSwapModal = ({ isOpen, onClose, onConfirm, homeTeamDisplay, awayTeamDisplay }) => {
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
                    React.createElement('span', { className: 'font-semibold' }, homeTeamDisplay),
                    React.createElement('i', { className: 'fa-solid fa-arrow-right-arrow-left text-blue-500 mx-2' }),
                    React.createElement('span', { className: 'font-semibold' }, awayTeamDisplay)
                ),
                React.createElement(
                    'div',
                    { className: 'flex items-center justify-between mt-2 text-sm text-gray-500' },
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
            
            await updateDoc(matchRef, {
                homeTeamId: selectedMatchForAction.awayTeamId,
                awayTeamId: selectedMatchForAction.homeTeamId
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
        return team.id || null;
    };

    // Funkcia na získanie názvu tímu podľa ID (pre existujúce zápasy)
    const getTeamNameById = (teamId) => {
        if (!teamId) {
            return 'Neznámy tím';
        }
        
        // Najprv zistíme, z ktorej kategórie je tím (podľa zápasu) - TOTO JE POVINNÉ
        const currentMatch = matches.find(m => m.homeTeamId === teamId || m.awayTeamId === teamId);
        const categoryName = currentMatch?.categoryName;
        
        // Ak nemáme kategóriu, nemôžeme správne identifikovať tím
        if (!categoryName) {
            console.warn('Chýba kategória pre tím s ID:', teamId);
            // Pokúsime sa extrahovať názov ako fallback
            const parts = teamId.split('-');
            if (parts.length > 1) {
                return parts.slice(1).join('-');
            }
            return teamId;
        }
        
        // Extrahujeme názov z teamId (všetko za prvým pomlčkou)
        const parts = teamId.split('-');
        if (parts.length < 2) {
            return teamId; // Nie je v očakávanom formáte
        }
        const extractedName = parts.slice(1).join('-');
        
        // Hľadáme tím PRESNE podľa kategórie A názvu
        if (teamData.allTeams && teamData.allTeams.length > 0) {
            // Hľadáme podľa kombinácie category + teamName
            const team = teamData.allTeams.find(t => 
                t.category === categoryName && 
                t.teamName === extractedName
            );
            
            if (team) {
                return team.teamName;
            }
            
            // Skúsime ešte podľa ID (pre staršie dáta)
            const teamById = teamData.allTeams.find(t => t.id === teamId);
            if (teamById) {
                return teamById.teamName;
            }
        }
        
        // Ak nie je v teamData, skúsime priamo z window.__teamManagerData
        if (window.__teamManagerData?.allTeams) {
            // Hľadáme podľa kombinácie category + teamName
            const team = window.__teamManagerData.allTeams.find(t => 
                t.category === categoryName && 
                t.teamName === extractedName
            );
            
            if (team) {
                setTeamData(window.__teamManagerData);
                return team.teamName;
            }
            
            // Skúsime ešte podľa ID
            const teamById = window.__teamManagerData.allTeams.find(t => t.id === teamId);
            if (teamById) {
                setTeamData(window.__teamManagerData);
                return teamById.teamName;
            }
        }
        
        // Fallback - vrátime extrahovaný názov
        console.warn(`Nenašiel sa tím s kategóriou "${categoryName}" a názvom "${extractedName}"`);
        return extractedName;
    };
    
    // Funkcia na získanie zobrazovaného textu pre tím
    const getTeamDisplayText = (teamId) => {
        if (showTeamId) {
            // Zobraziť ID v požadovanom formáte: 'kategória skupina číslo' (bez medzier medzi skupinou a číslom)
            if (!teamId) return '---';
            
            // Najprv zistíme, z ktorej kategórie je tím (podľa zápasu) - TOTO JE POVINNÉ
            const currentMatch = matches.find(m => m.homeTeamId === teamId || m.awayTeamId === teamId);
            const categoryName = currentMatch?.categoryName;
            
            // Extrahujeme názov z teamId
            const parts = teamId.split('-');
            const extractedName = parts.length > 1 ? parts.slice(1).join('-') : teamId;
            
            // Hľadáme tím PRESNE podľa kategórie A názvu
            let team = null;
            
            if (categoryName) {
                if (teamData.allTeams && teamData.allTeams.length > 0) {
                    team = teamData.allTeams.find(t => 
                        t.category === categoryName && 
                        t.teamName === extractedName
                    );
                }
                
                if (!team && window.__teamManagerData?.allTeams) {
                    team = window.__teamManagerData.allTeams.find(t => 
                        t.category === categoryName && 
                        t.teamName === extractedName
                    );
                }
            }
            
            // Ak sme nenašli podľa kategórie + názvu, skúsime podľa ID
            if (!team) {
                if (teamData.allTeams && teamData.allTeams.length > 0) {
                    team = teamData.allTeams.find(t => t.id === teamId);
                }
                if (!team && window.__teamManagerData?.allTeams) {
                    team = window.__teamManagerData.allTeams.find(t => t.id === teamId);
                }
            }
            
            if (team) {
                // Máme tím, zobrazíme kategória skupina číslo (bez medzery medzi skupinou a číslom)
                const category = team.category || 'Neznáma kategória';
                
                // Odstránime text "skupina " z názvu skupiny, ak existuje
                let groupName = team.groupName || 'Neznáma skupina';
                if (groupName.startsWith('skupina ')) {
                    groupName = groupName.substring(8); // Odstráni prvých 8 znakov ("skupina ")
                }
                
                const order = team.order || '?';
                
                // Spojíme bez medzery medzi groupName a order
                return `${category} ${groupName}${order}`;
            }
            
            // Fallback - použijeme údaje zo zápasu
            if (currentMatch && currentMatch.categoryName && currentMatch.groupName) {
                let groupName = currentMatch.groupName;
                if (groupName.startsWith('skupina ')) {
                    groupName = groupName.substring(8);
                }
                return `${currentMatch.categoryName} ${groupName}?`;
            }
            
            // Ak nemáme žiadne informácie, vrátime extrahovaný názov
            return extractedName;
        } else {
            // Zobraziť názov tímu
            return getTeamNameById(teamId);
        }
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
                existingMatch.homeTeamId === match.homeTeamId && 
                existingMatch.awayTeamId === match.awayTeamId &&
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
                home: m.homeTeamId, 
                away: m.awayTeamId 
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

    // Funkcia na výpis používateľov pre každý tím
    const logTeamOwners = async () => {
        if (!window.db || !teamData.allTeams) return;
        
        console.log('=== VLASTNÍCI TÍMOV ===');
        console.log('Celkový počet tímov:', teamData.allTeams.length);
        
        // Pre každý tím v teamData
        for (const team of teamData.allTeams) {
            try {
                console.log(`\nSpracovávam tím: ${team.teamName || team.name || 'Neznámy názov'}`);
                console.log('  - Celý objekt tímu:', team);
                
                // Ak tím má ID používateľa
                if (team.userId) {
                    console.log('  - Hľadám podľa userId:', team.userId);
                    
                    // Načítame dokument používateľa podľa ID
                    const userRef = doc(window.db, 'users', team.userId);
                    const userSnap = await getDoc(userRef);
                    
                    if (userSnap.exists()) {
                        const userData = userSnap.data();
                        console.log(`  ✓ Nájdený používateľ pre tím: ${team.teamName || team.name} (Kategória: ${team.category})`);
                        console.log('    - ID tímu:', team.id);
                        console.log('    - ID používateľa:', team.userId);
                        console.log('    - Dokument používateľa:', {
                            id: userSnap.id,
                            ...userData
                        });
                    } else {
                        console.log(`  ✗ Používateľ s ID ${team.userId} pre tím ${team.teamName || team.name} neexistuje`);
                    }
                } 
                // Ak tím má email používateľa
                else if (team.userEmail) {
                    console.log('  - Hľadám podľa userEmail:', team.userEmail);
                    
                    // Načítame všetkých používateľov a hľadáme podľa emailu
                    const usersRef = collection(window.db, 'users');
                    const usersSnapshot = await getDocs(usersRef);
                    
                    let foundUser = null;
                    usersSnapshot.forEach((doc) => {
                        const userData = doc.data();
                        if (userData.email === team.userEmail) {
                            foundUser = {
                                id: doc.id,
                                ...userData
                            };
                        }
                    });
                    
                    if (foundUser) {
                        console.log(`  ✓ Nájdený používateľ pre tím: ${team.teamName || team.name} (Kategória: ${team.category})`);
                        console.log('    - ID tímu:', team.id);
                        console.log('    - Email používateľa:', team.userEmail);
                        console.log('    - Dokument používateľa:', foundUser);
                    } else {
                        console.log(`  ✗ Používateľ s emailom ${team.userEmail} pre tím ${team.teamName || team.name} neexistuje`);
                    }
                }
                // Ak tím má createdBy (meno používateľa)
                else if (team.createdBy) {
                    console.log('  - Hľadám podľa createdBy:', team.createdBy);
                    
                    // Načítame všetkých používateľov a hľadáme podľa mena alebo emailu
                    const usersRef = collection(window.db, 'users');
                    const usersSnapshot = await getDocs(usersRef);
                    
                    let foundUser = null;
                    usersSnapshot.forEach((doc) => {
                        const userData = doc.data();
                        if (userData.displayName === team.createdBy || userData.email === team.createdBy) {
                            foundUser = {
                                id: doc.id,
                                ...userData
                            };
                        }
                    });
                    
                    if (foundUser) {
                        console.log(`  ✓ Nájdený používateľ pre tím: ${team.teamName || team.name} (Kategória: ${team.category})`);
                        console.log('    - ID tímu:', team.id);
                        console.log('    - createdBy:', team.createdBy);
                        console.log('    - Dokument používateľa:', foundUser);
                    } else {
                        console.log(`  ✗ Používateľ s menom/emailom ${team.createdBy} pre tím ${team.teamName || team.name} neexistuje`);
                    }
                }
                // Ak tím nemá priradeného používateľa
                else {
                    console.log(`  ⚠ Tím: ${team.teamName || team.name} (Kategória: ${team.category}) - Nemá priradeného používateľa`);
                    console.log('    - ID tímu:', team.id);
                    console.log('    - Dostupné polia:', Object.keys(team));
                }
                
                console.log('---');
            } catch (error) {
                console.error(`Chyba pri načítaní používateľa pre tím ${team.teamName || team.name}:`, error);
            }
        }
        
        console.log('=== KONIEC VLASTNÍKOV TÍMOV ===');
        console.log('Celkový počet spracovaných tímov:', teamData.allTeams.length);
    };

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
            loadUsersWithMatches();
            
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
                setTimeout(() => {
                    logTeamOwners();
                }, 1000);
            }
            
            const unsubscribe = window.teamManager.subscribe((data) => {
                console.log('TeamManager data aktualizované, počet tímov:', data.allTeams?.length);
                setTeamData(data);
                
                // Vypíšeme vlastníkov tímov po aktualizácii
                setTimeout(() => {
                    logTeamOwners();
                }, 1000);
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
                
                setTimeout(() => {
                    logTeamOwners();
                }, 1000);
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
    const generateMatchesForGroup = (teams, withRepetitions) => {
        const matches = [];
        
        // Pre každý tím vytvoríme identifikátor (ID alebo názov)
        const teamIdentifiers = teams.map(t => ({
            id: getTeamId(t),
            name: getTeamName(t)
        }));
        
        console.log('Generujem zápasy pre tímy:', teamIdentifiers);
        
        if (withRepetitions) {
            // Každý s každým doma/vonku v rámci skupiny
            for (let i = 0; i < teamIdentifiers.length; i++) {
                for (let j = 0; j < teamIdentifiers.length; j++) {
                    if (i !== j) {
                        matches.push({
                            homeTeamId: teamIdentifiers[i].id || teamIdentifiers[i].name,
                            awayTeamId: teamIdentifiers[j].id || teamIdentifiers[j].name,
                        });
                    }
                }
            }
        } else {
            // Jedinečné dvojice (každý s každým raz) v rámci skupiny
            for (let i = 0; i < teamIdentifiers.length; i++) {
                for (let j = i + 1; j < teamIdentifiers.length; j++) {
                    matches.push({
                        homeTeamId: teamIdentifiers[i].id || teamIdentifiers[i].name,
                        awayTeamId: teamIdentifiers[j].id || teamIdentifiers[j].name,
                    });
                }
            }
        }
        
        console.log(`Vygenerovaných ${matches.length} zápasov`);
        return matches;
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
                    homeTeamId: match.homeTeamId,
                    awayTeamId: match.awayTeamId,
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
                const groupMatches = generateMatchesForGroup(teamsInGroup, withRepetitions);
                
                // Pridanie informácií o skupine ku každému zápasu
                const matchesWithInfo = groupMatches.map((match, index) => ({
                    homeTeamId: match.homeTeamId,
                    awayTeamId: match.awayTeamId,
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
            unsubscribePlaces();
        };
    }, []);

    // ZJEDNODUŠENÝ RENDER - dva stĺpce (ľavý - zápasy, pravý - haly)
    return React.createElement(
        React.Fragment,
        null,
        React.createElement(GenerationModal, {
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
        React.createElement(ConfirmExistingMatchModal, {
            isOpen: isExistingMatchModalOpen,
            onClose: () => {
                setIsExistingMatchModalOpen(false);
                setCurrentExistingMatch(null);
                handleRejectExistingMatch();
            },
            onConfirm: handleConfirmExistingMatch,
            match: currentExistingMatch,
            homeTeamDisplay: currentExistingMatch ? getTeamDisplayText(currentExistingMatch.homeTeamId) : '',
            awayTeamDisplay: currentExistingMatch ? getTeamDisplayText(currentExistingMatch.awayTeamId) : ''
        }),
        React.createElement(ConfirmDeleteModal, {
            isOpen: isDeleteModalOpen,
            onClose: () => {
                setIsDeleteModalOpen(false);
                setSelectedMatchForAction(null);
            },
            onConfirm: confirmDelete,
            homeTeamDisplay: selectedMatchForAction ? getTeamDisplayText(selectedMatchForAction.homeTeamId) : '',
            awayTeamDisplay: selectedMatchForAction ? getTeamDisplayText(selectedMatchForAction.awayTeamId) : ''
        }),
        React.createElement(ConfirmSwapModal, {
            isOpen: isSwapModalOpen,
            onClose: () => {
                setIsSwapModalOpen(false);
                setSelectedMatchForAction(null);
            },
            onConfirm: confirmSwap,
            homeTeamDisplay: selectedMatchForAction ? getTeamDisplayText(selectedMatchForAction.homeTeamId) : '',
            awayTeamDisplay: selectedMatchForAction ? getTeamDisplayText(selectedMatchForAction.awayTeamId) : ''
        }),
        React.createElement(DeleteMatchesModal, {
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
        React.createElement(
            'div',
            { className: 'flex-grow flex justify-center items-start w-full' },
            React.createElement(
                'div',
                { className: 'w-full bg-white rounded-xl shadow-xl p-8 mx-4' },
                
                // Hlavička s prepínačom
                React.createElement(
                    'div',
                    { className: 'flex flex-col items-center justify-center mb-6 p-4 -mx-8 -mt-8 rounded-t-xl' },
                    React.createElement('h2', { className: 'text-3xl font-bold tracking-tight text-center text-gray-800 mb-4' }, 'Zápasy'),
                    
                    // Ovládacie prvky
                    React.createElement(
                        'div',
                        { className: 'flex items-center gap-3 flex-wrap justify-center' },
                        // Prepínač pre zobrazenie ID tímov
                        React.createElement(
                            'div',
                            { className: 'flex items-center gap-3 bg-gray-100 p-2 rounded-lg' },
                            React.createElement(
                                'span',
                                { 
                                    className: `px-3 py-1 rounded-md text-sm font-medium cursor-pointer transition-colors ${
                                        !showTeamId 
                                            ? 'bg-blue-600 text-white shadow-sm' 
                                            : 'text-gray-600 hover:bg-gray-200'
                                    }`,
                                    onClick: () => setShowTeamId(false)
                                },
                                'Názvy tímov'
                            ),
                            React.createElement(
                                'span',
                                { 
                                    className: `px-3 py-1 rounded-md text-sm font-medium cursor-pointer transition-colors ${
                                        showTeamId 
                                            ? 'bg-blue-600 text-white shadow-sm' 
                                            : 'text-gray-600 hover:bg-gray-200'
                                    }`,
                                    onClick: () => setShowTeamId(true)
                                },
                                'ID tímov'
                            )
                        ),
                        
                        // Indikátor generovania
                        generationInProgress && React.createElement(
                            'div',
                            { className: 'flex items-center gap-2 text-blue-600 bg-blue-50 px-4 py-2 rounded-lg' },
                            React.createElement('div', { className: 'animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600' }),
                            React.createElement('span', { className: 'text-sm font-medium' }, 'Generujem zápasy...')
                        )
                    )
                ),
                
                // Dva stĺpce - ľavý pre zápasy, pravý pre haly
                React.createElement(
                    'div',
                    { className: 'flex flex-col lg:flex-row gap-6 mt-4' },
                    
                    // ĽAVÝ STĹPEC - Zoznam zápasov
                    React.createElement(
                        'div',
                        { className: 'lg:w-1/3 bg-gray-50 rounded-xl p-4 border border-gray-200' },
                        React.createElement(
                            'h3',
                            { className: 'text-xl font-semibold mb-4 text-gray-700 border-b pb-2 flex items-center' },
                            'Zoznam zápasov',
                            React.createElement('span', { className: 'ml-2 text-sm font-normal text-gray-500' },
                                `(${matches.length})`
                            )
                        ),
                        
                        // Zoznam zápasov
                        matches.length === 0 ? 
                            React.createElement(
                                'div',
                                { className: 'text-center py-8 text-gray-500' },
                                React.createElement('i', { className: 'fa-solid fa-calendar-xmark text-4xl mb-3 opacity-30' }),
                                React.createElement('p', { className: 'text-sm' }, 'Žiadne zápasy')
                            ) :
                            React.createElement(
                                'div',
                                { className: 'space-y-3 max-h-[600px] overflow-y-auto pr-2' },
                                matches.map(match => {
                                    // Použijeme prepínač pre zobrazenie
                                    const homeTeamDisplay = getTeamDisplayText(match.homeTeamId);
                                    const awayTeamDisplay = getTeamDisplayText(match.awayTeamId);
                                    
                                    return React.createElement(
                                        'div',
                                        { 
                                            key: match.id,
                                            className: 'bg-white p-4 rounded-lg border border-gray-200 hover:shadow-md transition-shadow relative group'
                                        },
                                        // Tlačidlo pre zmazanie (zobrazí sa pri hoveri)
                                        userProfileData?.role === 'admin' && React.createElement(
                                            'div',
                                            { className: 'absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity' },
                                            // Ikona pre výmenu tímov
                                            React.createElement(
                                                'button',
                                                {
                                                    onClick: () => handleSwapClick(match),
                                                    className: 'w-8 h-8 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center justify-center shadow-md',
                                                    title: 'Vymeniť domáci a hosťovský tím'
                                                },
                                                React.createElement('i', { className: 'fa-solid fa-arrow-right-arrow-left text-sm' })
                                            ),
                                            // Ikona pre zmazanie
                                            React.createElement(
                                                'button',
                                                {
                                                    onClick: () => handleDeleteClick(match),
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
                                                match.time
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
                                            React.createElement(
                                                'span',
                                                { 
                                                    className: `font-semibold ${showTeamId ? 'font-mono' : ''} text-gray-800`,
                                                    title: showTeamId ? match.homeTeamId : homeTeamDisplay
                                                },
                                                homeTeamDisplay
                                            ),
                                            React.createElement('i', { className: 'fa-solid fa-vs text-xs text-gray-400 mx-2' }),
                                            React.createElement(
                                                'span',
                                                { 
                                                    className: `font-semibold ${showTeamId ? 'font-mono' : ''} text-gray-800`,
                                                    title: showTeamId ? match.awayTeamId : awayTeamDisplay
                                                },
                                                awayTeamDisplay
                                            )
                                        ),
                                        React.createElement(
                                            'div',
                                            { className: 'mt-2 text-xs text-gray-500 flex items-center' },
                                            React.createElement('i', { className: 'fa-solid fa-location-dot mr-1 text-gray-400' }),
                                            match.hallId ? 'Hala' : 'Nepriradené',
                                            match.groupName && React.createElement(
                                                'span',
                                                { className: 'ml-2 px-2 py-0.5 bg-gray-100 rounded-full' },
                                                match.groupName
                                            )
                                        )
                                    );
                                })
                            ),
                        
                        // Tlačidlá pre generovanie a mazanie (pridané SEM, za zoznam zápasov)
                        React.createElement(
                            'div',
                            { className: 'flex items-center gap-2 mt-4' },
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
                    
                    // PRAVÝ STĹPEC - Športové haly
                    React.createElement(
                        'div',
                        { className: 'lg:w-2/3' },
                        React.createElement(
                            'h3',
                            { className: 'text-xl font-semibold mb-4 text-gray-700 border-b pb-2' },
                            React.createElement('i', { className: 'fa-solid fa-futbol mr-2 text-red-500' }),
                            'Športové haly',
                            React.createElement('span', { className: 'ml-2 text-sm font-normal text-gray-500' },
                                `(${sportHalls.length} ${sportHalls.length === 1 ? 'hala' : sportHalls.length < 5 ? 'haly' : 'hál'})`
                            )
                        ),
                        
                        // Indikátor načítavania
                        loading && React.createElement(
                            'div',
                            { className: 'flex justify-center items-center py-12' },
                            React.createElement('div', { className: 'animate-spin rounded-full h-12 w-12 border-b-4 border-blue-500' })
                        ),
                        
                        // Žiadne haly
                        !loading && sportHalls.length === 0 && React.createElement(
                            'div',
                            { className: 'text-center py-12 text-gray-500 bg-gray-50 rounded-lg' },
                            React.createElement('i', { className: 'fa-solid fa-map-pin text-5xl mb-4 opacity-30' }),
                            React.createElement('p', { className: 'text-lg' }, 'Žiadne športové haly nie sú k dispozícii'),
                            React.createElement('p', { className: 'text-sm mt-2' }, 'Pridajte prvú športovú halu v mape.')
                        ),
                        
                        // Grid zoznam športových hál
                        !loading && sportHalls.length > 0 && React.createElement(
                            'div',
                            { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                            sportHalls.map((hall) => {
                                const typeConfig = typeIcons[hall.type] || { icon: 'fa-futbol', color: '#dc2626' };
                                
                                return React.createElement(
                                    'div',
                                    { 
                                        key: hall.id,
                                        className: `p-5 bg-white rounded-xl border-2 border-gray-200 shadow-sm hover:shadow-md transition-shadow`
                                    },
                                    React.createElement(
                                        'div',
                                        { className: 'flex items-center' },
                                        React.createElement(
                                            'div',
                                            { 
                                                className: 'w-14 h-14 rounded-full flex items-center justify-center mr-4',
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
