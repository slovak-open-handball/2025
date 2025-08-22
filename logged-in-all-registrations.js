// logged-in-all-registrations.js
// Tento súbor predpokladá, že Firebase SDK je inicializovaný v <head> logged-in-all-registrations.html
// a GlobalNotificationHandler v header.js spravuje globálnu autentifikáciu a stav používateľa.

// Importy pre Firebase Firestore funkcie (Firebase v9 modulárna syntax)
// Tento súbor je načítaný ako modul, preto môže používať importy.
import { collection, doc, onSnapshot, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// NotificationModal Component pre zobrazovanie dočasných správ
function NotificationModal({ message, onClose, displayNotificationsEnabled }) {
  const [show, setShow] = React.useState(false);
  const timerRef = React.useRef(null);

  React.useEffect(() => {
    // Zobrazí notifikáciu len ak je správa A notifikácie sú povolené
    if (message && displayNotificationsEnabled) {
      setShow(true);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        setShow(false);
        setTimeout(onClose, 500);
      }, 10000);
    } else {
      setShow(false);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [message, onClose, displayNotificationsEnabled]); // Závisí aj od displayNotificationsEnabled

  // Nezobrazovať notifikáciu, ak nie je správa ALEBO ak sú notifikácie zakázané
  if ((!show && !message) || !displayNotificationsEnabled) return null;

  return React.createElement(
    'div',
    {
      className: `fixed top-0 left-0 right-0 z-50 flex justify-center p-4 transition-transform duration-500 ease-out ${
        show ? 'translate-y-0' : '-translate-y-full'
      }`,
      style: { pointerEvents: 'none', zIndex: 1000 }
    },
    React.createElement(
      'div',
      {
        className: 'bg-[#3A8D41] text-white px-6 py-3 rounded-lg shadow-lg max-w-md w-full text-center',
        style: { pointerEvents: 'auto' }
      },
      React.createElement('p', { className: 'font-semibold' }, message)
    )
  );
}

// FilterModal Component - Modálne okno pre filtrovanie s viacnásobným výberom
function FilterModal({ isOpen, onClose, columnName, onApplyFilter, initialFilterValues, onClearFilter, uniqueColumnValues }) {
    const [selectedValues, setSelectedValues] = React.useState(initialFilterValues || []);

    React.useEffect(() => {
        setSelectedValues(initialFilterValues || []);
    }, [initialFilterValues, isOpen]);

    if (!isOpen) return null;

    const handleCheckboxChange = (value) => {
        const lowerCaseValue = String(value).toLowerCase();
        setSelectedValues(prev => {
            if (prev.includes(lowerCaseValue)) {
                return prev.filter(item => item !== lowerCaseValue);
            } else {
                return [...prev, lowerCaseValue];
            }
        });
    };

    const handleApply = () => {
        onApplyFilter(columnName, selectedValues);
        onClose();
    };

    const handleClear = () => {
        setSelectedValues([]);
        onClearFilter(columnName);
        onClose();
    };

    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50' },
        React.createElement(
            'div',
            { className: 'bg-white p-6 rounded-lg shadow-xl w-full max-w-sm' },
            React.createElement('h3', { className: 'text-lg font-semibold mb-4' }, `Filter pre ${columnName}`),
            React.createElement(
                'div',
                { className: 'max-h-60 overflow-y-auto mb-4 border border-gray-200 rounded-md p-2' },
                uniqueColumnValues.map((value, index) =>
                    React.createElement(
                        'div',
                        { key: index, className: 'flex items-center mb-2' },
                        React.createElement('input', {
                            type: 'checkbox',
                            id: `filter-${columnName}-${index}`,
                            value: value,
                            checked: selectedValues.includes(String(value).toLowerCase()),
                            onChange: () => handleCheckboxChange(value),
                            className: 'mr-2'
                        }),
                        React.createElement('label', { htmlFor: `filter-${columnName}-${index}` }, value || '(Prázdne)')
                    )
                )
            ),
            React.createElement(
                'div',
                { className: 'flex justify-end space-x-2' },
                React.createElement('button', {
                    className: 'px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300',
                    onClick: onClose
                }, 'Zrušiť'),
                React.createElement('button', {
                    className: 'px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600',
                    onClick: handleClear
                }, 'Vymazať filter'),
                React.createElement('button', {
                    className: 'px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600',
                    onClick: handleApply
                }, 'Použiť filter')
            )
        )
    );
}

// ColumnVisibilityModal Component
function ColumnVisibilityModal({ isOpen, onClose, columns, onSaveColumnVisibility }) {
    const [tempColumns, setTempColumns] = React.useState(columns);

    React.useEffect(() => {
        setTempColumns(columns);
    }, [columns, isOpen]);

    if (!isOpen) return null;

    const handleToggleVisibility = (columnId) => {
        setTempColumns(prev =>
            prev.map(col =>
                col.id === columnId ? { ...col, visible: !col.visible } : col
            )
        );
    };

    const handleSave = () => {
        onSaveColumnVisibility(tempColumns);
        onClose();
    };

    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50' },
        React.createElement(
            'div',
            { className: 'bg-white p-6 rounded-lg shadow-xl w-full max-w-md' },
            React.createElement('h3', { className: 'text-lg font-semibold mb-4' }, 'Viditeľnosť stĺpcov'),
            React.createElement(
                'div',
                { className: 'max-h-80 overflow-y-auto mb-4 border border-gray-200 rounded-md p-2' },
                tempColumns.map((col) =>
                    React.createElement(
                        'div',
                        { key: col.id, className: 'flex items-center justify-between py-2 border-b last:border-b-0' },
                        React.createElement('label', { className: 'flex items-center cursor-pointer' },
                            React.createElement('input', {
                                type: 'checkbox',
                                className: 'form-checkbox h-5 w-5 text-blue-600 mr-2',
                                checked: col.visible,
                                onChange: () => handleToggleVisibility(col.id),
                            }),
                            React.createElement('span', { className: 'text-gray-700' }, col.label)
                        )
                    )
                )
            ),
            React.createElement(
                'div',
                { className: 'flex justify-end space-x-2' },
                React.createElement('button', {
                    className: 'px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300',
                    onClick: onClose
                }, 'Zrušiť'),
                React.createElement('button', {
                    className: 'px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600',
                    onClick: handleSave
                }, 'Uložiť zmeny')
            )
        )
    );
}

// CollapsibleSection Component - pre rozbaľovacie sekcie
function CollapsibleSection({ title, children, isOpen: isOpenProp, onToggle, defaultOpen = false, noOuterStyles = false }) {
  const isControlled = isOpenProp !== undefined;
  const [internalIsOpen, setInternalIsOpen] = React.useState(defaultOpen);
  const currentIsOpen = isControlled ? isOpenProp : internalIsOpen;

  const handleToggle = () => {
    if (isControlled && onToggle) {
      onToggle();
    } else {
      setInternalIsOpen(prev => !prev);
    }
  };

  const outerDivClasses = noOuterStyles ? '' : 'border border-gray-200 rounded-lg mb-2';
  const buttonClasses = noOuterStyles ?
    'flex justify-between items-center w-full px-4 py-2 text-left bg-transparent hover:bg-gray-100 focus:outline-none' :
    'flex justify-between items-center w-full px-4 py-2 text-left bg-gray-50 hover:bg-gray-100 focus:outline-none rounded-t-lg';
  const contentDivClasses = noOuterStyles ? 'p-2' : 'p-4 border-t border-gray-200';

  return React.createElement(
    'div',
    { className: outerDivClasses },
    React.createElement(
      'button',
      {
        className: buttonClasses,
        onClick: handleToggle
      },
      React.createElement('span', { className: 'text-gray-500 mr-2' }, currentIsOpen ? '▲' : '▼'),
      typeof title === 'string' ? React.createElement('span', { className: 'font-semibold text-gray-700' }, title) : title
    ),
    currentIsOpen && React.createElement(
      'div',
      { className: contentDivClasses },
      children
    )
  );
}

// Helper function to get nested values from an object
const getNestedValue = (obj, path) => {
    return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined) ? acc[part] : undefined, obj);
};

// Helper function to get tshirt spans
const getTshirtSpans = (team, tshirtSizeOrder) => {
    const teamTshirtsMap = team._teamTshirtsMap || new Map();
    return (tshirtSizeOrder && tshirtSizeOrder.length > 0 ? tshirtSizeOrder : ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']).map(size => {
        const quantity = teamTshirtsMap.get(size) || 0;
        return React.createElement('span', {
            key: `tshirt-summary-${size}`,
            className: `text-gray-600 mr-2 inline-block whitespace-nowrap`
        }, `${quantity > 0 ? quantity : '-'}`);
    });
};

const generateTeamHeaderTitle = (team, availableTshirtSizes, forCollapsibleSection = false, showUsersChecked = false, showTeamsChecked = false) => {
    const menTeamMembersCount = team._menTeamMembersCount !== undefined ? team._menTeamMembersCount : 0;
    const womenTeamMembersCount = team._womenTeamMembersCount !== undefined ? team._womenTeamMembersCount : 0;
    const playersCount = team._players !== undefined ? team._players : 0;

    const titleParts = [];

    if (forCollapsibleSection || (showUsersChecked && showTeamsChecked)) {
        titleParts.push(React.createElement('span', { className: 'font-semibold text-gray-900 mr-2 whitespace-nowrap' }, `Kategória: ${team._category || '-'}`));
        titleParts.push(React.createElement('span', { className: 'text-gray-700 mr-4 whitespace-nowrap' }, `Názov tímu: ${team.teamName || `Tím`}`));
        titleParts.push(React.createElement('span', { className: 'text-gray-600 mr-2 whitespace-nowrap' }, `Hráči: ${playersCount}`));
        titleParts.push(React.createElement('span', { className: 'text-gray-600 mr-2 whitespace-nowrap' }, `R. tím (ž): ${womenTeamMembersCount}`));
        titleParts.push(React.createElement('span', { className: 'text-gray-600 mr-2 whitespace-nowrap' }, `R. tím (m): ${menTeamMembersCount}`));
        titleParts.push(React.createElement('span', { className: 'text-gray-600 mr-2 whitespace-nowrap' }, `Doprava: ${team.arrival?.type || '-'}`));
        titleParts.push(React.createElement('span', { className: 'text-gray-600 mr-2 whitespace-nowrap' }, `Ubytovanie: ${team.accommodation?.type || '-'}`));
        titleParts.push(React.createElement('span', { className: 'text-gray-600 mr-2 whitespace-nowrap' }, `Balík: ${team.packageDetails?.name || '-'}`));
        
        const teamTshirtsMap = team._teamTshirtsMap || new Map();
        const tshirtDataWithLabels = (availableTshirtSizes && availableTshirtSizes.length > 0 ? availableTshirtSizes : ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']).map(size => {
            const quantity = teamTshirtsMap.get(size) || 0;
            return React.createElement('span', {
                key: `tshirt-summary-label-${size}`,
                className: `text-gray-600 mr-2 inline-block whitespace-nowrap`
            }, `Vel. ${size.toUpperCase()}: ${quantity > 0 ? quantity : '-'}`);
        });
        titleParts.push(...tshirtDataWithLabels);

    } else {
        titleParts.push(React.createElement('span', { className: 'font-semibold text-gray-900 mr-2 whitespace-nowrap' }, team._category || '-'));
        titleParts.push(React.createElement('span', { className: 'text-gray-700 mr-4 whitespace-nowrap' }, team.teamName || `Tím`));
        titleParts.push(React.createElement('span', { className: 'text-gray-600 hidden sm:inline mr-2 whitespace-nowrap' }, playersCount));
        titleParts.push(React.createElement('span', { className: 'text-gray-600 hidden md:inline mr-2 whitespace-nowrap' }, womenTeamMembersCount));
        titleParts.push(React.createElement('span', { className: 'text-gray-600 hidden lg:inline mr-2 whitespace-nowrap' }, menTeamMembersCount));
        titleParts.push(React.createElement('span', { className: 'text-gray-600 hidden xl:inline mr-2 whitespace-nowrap' }, team.arrival?.type || '-'));
        titleParts.push(React.createElement('span', { className: 'text-gray-600 hidden 2xl:inline mr-2 whitespace-nowrap' }, team.accommodation?.type || '-'));
        titleParts.push(React.createElement('span', { className: 'text-gray-600 hidden 3xl:inline mr-2 whitespace-nowrap' }, team.packageDetails?.name || '-'));
        titleParts.push(...getTshirtSpans(team, availableTshirtSizes));
    }

    return React.createElement(
        'div',
        { className: 'flex flex-wrap items-center justify-between w-full' },
        ...titleParts
    );
};


// TeamDetailsContent Component - zobrazuje len vnútorné detaily jedného tímu (bez vonkajšieho CollapsibleSection)
function TeamDetailsContent({ team, tshirtSizeOrder, showDetailsAsCollapsible, showUsersChecked, showTeamsChecked }) {
    if (!team) {
        return React.createElement('div', { className: 'text-gray-600 p-4' }, 'Žiadne tímové registrácie.');
    }

    const formatAddress = (address) => {
        if (!address) return '-';
        return `${address.street || ''} ${address.houseNumber || ''}, ${address.postalCode || ''} ${address.city || ''}, ${address.country || ''}`;
    };

    const formatDateToDMMYYYY = (dateString) => {
        if (!dateString) return '-';
        const [year, month, day] = dateString.split('-');
        if (year && month && day) {
            return `${day}. ${month}. ${year}`;
        }
        return dateString;
    };

    const allConsolidatedMembers = [];

    if (team.playerDetails && team.playerDetails.length > 0) {
        team.playerDetails.forEach((player, index) => {
            allConsolidatedMembers.push({
                ...player,
                type: 'Hráč',
                uniqueId: `${team.teamName}-player-${player.firstName || ''}-${player.lastName || ''}-${index}`
            });
        });
    }
    if (team.menTeamMemberDetails && team.menTeamMemberDetails.length > 0) {
        team.menTeamMemberDetails.forEach((member, index) => {
            allConsolidatedMembers.push({
                ...member,
                type: 'Člen realizačného tímu (muži)',
                uniqueId: `${team.teamName}-menstaff-${member.firstName || ''}-${member.lastName || ''}-${index}`
            });
        });
    };
    if (team.womenTeamMemberDetails && team.womenTeamMemberDetails.length > 0) {
        team.womenTeamMemberDetails.forEach((member, index) => {
            allConsolidatedMembers.push({
                ...member,
                type: 'Člen realizačného tímu (ženy)',
                uniqueId: `${team.teamName}-womenstaff-${member.firstName || ''}-${member.lastName || ''}-${index}`
            });
        });
    }
    if (team.driverDetails) {
        allConsolidatedMembers.push({
            ...team.driverDetails,
            type: 'Šofér',
            uniqueId: `${team.teamName}-driver-${team.driverDetails.firstName || ''}-${team.driverDetails.lastName || ''}-0`
        });
    }

    const mealDates = team.packageDetails && team.packageDetails.meals ? Object.keys(team.packageDetails.meals).sort() : [];
    const mealTypes = ['breakfast', 'lunch', 'dinner', 'refreshment'];
    const mealTypeLabels = {
        breakfast: 'Raňajky',
        lunch: 'Obed',
        dinner: 'Večera',
        refreshment: 'Občerstvenie'
    };
                
    const teamDetailsTable = React.createElement(
        'div',
        { className: 'overflow-x-auto' },
        React.createElement(
            'table',
            { className: 'min-w-full divide-y divide-gray-200' },
            React.createElement(
                'thead',
                { className: 'bg-gray-50' },
                React.createElement(
                    'tr',
                    null,
                    React.createElement('th', { className: 'px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-max' }, 'Typ'),
                    React.createElement('th', { className: 'px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-max' }, 'Meno'),
                    React.createElement('th', { className: 'px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-max' }, 'Priezvisko'),
                    React.createElement('th', { className: 'px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-max' }, 'Dátum narodenia'),
                    React.createElement('th', { className: 'px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-max' }, 'Číslo dresu'),
                    React.createElement('th', { className: 'px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-max' }, 'Reg. číslo'),
                    React.createElement('th', { className: 'px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-max' }, 'Adresa'),
                    mealDates.map(date =>
                        React.createElement('th', { key: date, colSpan: 4, className: 'px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-l border-gray-200 whitespace-nowrap min-w-max' },
                            React.createElement('div', { className: 'font-bold mb-1 whitespace-nowrap' }, formatDateToDMMYYYY(date)),
                            React.createElement(
                                'div',
                                { className: 'flex justify-around text-[10px] font-normal' },
                                mealTypes.map(type =>
                                    React.createElement('span', { key: `${date}-${type}-sub`, className: 'w-1/4' }, mealTypeLabels[type])
                                )
                            )
                        )
                    )
                )
            ),
            React.createElement(
                'tbody',
                { className: 'bg-white divide-y divide-gray-200' },
                allConsolidatedMembers.map((member) =>
                    React.createElement(
                        'tr',
                        { key: member.uniqueId },
                        React.createElement('td', { className: 'px-4 py-2 whitespace-nowrap min-w-max' }, member.type || '-'),
                        React.createElement('td', { className: 'px-4 py-2 whitespace-nowrap min-w-max' }, member.firstName || '-'),
                        React.createElement('td', { className: 'px-4 py-2 whitespace-nowrap min-w-max' }, member.lastName || '-'),
                        React.createElement('td', { className: 'px-4 py-2 whitespace-nowrap min-w-max' }, formatDateToDMMYYYY(member.dateOfBirth)),
                        React.createElement('td', { className: 'px-4 py-2 whitespace-nowrap min-w-max' }, member.jerseyNumber || '-'),
                        React.createElement('td', { className: 'px-4 py-2 whitespace-nowrap min-w-max' }, member.registrationNumber || '-'),
                        React.createElement('td', { className: 'px-4 py-2 whitespace-nowrap min-w-max' }, formatAddress(member.address)),
                        mealDates.map(date =>
                            React.createElement('td', { key: `${member.uniqueId}-${date}-meals`, colSpan: 4, className: 'px-4 py-2 text-center border-l border-gray-200 whitespace-nowrap min-w-max' },
                                React.createElement(
                                    'div',
                                    { className: 'flex justify-around' },
                                    mealTypes.map(type => {
                                        const isChecked = team.packageDetails.meals[date] && team.packageDetails.meals[date][type] === 1;
                                        return React.createElement('input', {
                                                            key: `${member.uniqueId}-${date}-${type}-checkbox`,
                                                            type: 'checkbox',
                                                            checked: isChecked,
                                                            disabled: true,
                                                            className: 'form-checkbox h-4 w-4 text-blue-600'
                                        });
                                    })
                                )
                            )
                        )
                    )
                )
            )
        )
    );

    const collapsibleSectionTitle = generateTeamHeaderTitle(team, tshirtSizeOrder, true, showUsersChecked, showTeamsChecked);

    if (showDetailsAsCollapsible) {
        return React.createElement(
            CollapsibleSection,
            { title: collapsibleSectionTitle, defaultOpen: false },
            teamDetailsTable
        );
    } else {
        const shouldShowHeader = showUsersChecked || !showTeamsChecked;
        return React.createElement(
            'div',
            { className: 'p-4 pt-0 bg-gray-50 rounded-lg' },
            shouldShowHeader && React.createElement('h3', { className: 'font-semibold text-gray-700 mb-2' }, 'Detaily členov tímu a stravovanie'),
            teamDetailsTable
        );
    }
}

// Generic DataEditModal Component pre zobrazovanie/úpravu JSON dát
function DataEditModal({ isOpen, onClose, title, data }) {
    if (!isOpen) return null;

    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50 p-4' },
        React.createElement(
            'div',
            { className: 'bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto' },
            React.createElement('h3', { className: 'text-lg font-semibold mb-4' }, title),
            React.createElement(
                'pre',
                { className: 'bg-gray-100 p-3 rounded-md text-sm whitespace-pre-wrap break-all' },
                JSON.stringify(data, null, 2)
            ),
            React.createElement(
                'div',
                { className: 'flex justify-end space-x-2 mt-4' },
                React.createElement('button', {
                    className: 'px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600',
                    onClick: onClose
                }, 'Zavrieť')
            )
        )
    );
}

// Main React component for the logged-in-all-registrations.html page
function AllRegistrationsApp() {
  const auth = window.auth;
  const db = window.db;

  const [user, setUser] = React.useState(null);
  const [userProfileData, setUserProfileData] = React.useState(null);
  const [isAuthReady, setIsAuthReady] = React.useState(false);

  const [error, setError] = React.useState('');
  const [userNotificationMessage, setUserNotificationMessage] = React.useState('');

  const [allUsers, setAllUsers] = React.useState([]);
  const [filteredUsers, setFilteredUsers] = React.useState([]);
  const [currentSort, setCurrentSort] = React.useState({ column: 'registrationDate', direction: 'desc' });
  const [filterModalOpen, setFilterModalOpen] = React.useState(false);
  const [filterColumn, setFilterColumn] = React.useState('');
  const [activeFilters, setActiveFilters] = React.useState({});
  const [uniqueColumnValues, setUniqueColumnValues] = React.useState([]);

  const defaultColumnOrder = [
    { id: 'role', label: 'Rola', type: 'string', visible: true },
    { id: 'approved', label: 'Schválený', type: 'boolean', visible: true },
    { id: 'registrationDate', label: 'Dátum registrácie', type: 'date', visible: true },
    { id: 'firstName', label: 'Meno', type: 'string', visible: true },
    { id: 'lastName', label: 'Priezvisko', type: 'string', visible: true },
    { id: 'email', label: 'E-mailová adresa', type: 'string', visible: true },
    { id: 'contactPhoneNumber', label: 'Telefónne číslo', type: 'string', visible: true },
    { id: 'billing.clubName', label: 'Názov klubu', type: 'string', visible: true },
    { id: 'billing.ico', label: 'IČO', type: 'string', visible: true },
    { id: 'billing.dic', label: 'DIČ', type: 'string', visible: true },
    { id: 'billing.icDph', label: 'IČ DPH', type: 'string', visible: true },
    { id: 'street', label: 'Ulica', type: 'string', visible: true },
    { id: 'houseNumber', label: 'Číslo domu', type: 'string', visible: true },
    { id: 'city', label: 'Mesto/Obec', type: 'string', visible: true },
    { id: 'postalCode', label: 'PSČ', type: 'string', visible: true },
    { id: 'country', label: 'Krajina', type: true, visible: true },
  ];
  const [columnOrder, setColumnOrder] = React.useState(defaultColumnOrder);
  const [hoveredColumn, setHoveredColumn] = React.useState(null);
  const [showColumnVisibilityModal, setShowColumnVisibilityModal] = React.useState(false);

  const [expandedRows, setExpandedRows] = React.useState({});
  const [expandedTeamRows, setExpandedTeamRows] = React.useState({});

  const [availableTshirtSizes, setAvailableTshirtSizes] = React.useState([]);
  const tshirtSizeOrderFallback = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

  const [showUsers, setShowUsers] = React.useState(true);
  const [showTeams, setShowTeams] = React.useState(true);

  // Stavy pre modálne okno na úpravu
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [editingData, setEditingData] = React.useState(null);
  const [editModalTitle, setEditModalTitle] = React.useState('');

  const openEditModal = (data, title) => {
      setEditingData(data);
      setEditModalTitle(title);
      setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
      setIsEditModalOpen(false);
      setEditingData(null);
      setEditModalTitle('');
  };


  const allTeamsFlattened = React.useMemo(() => {
    if (!showUsers && showTeams) {
        let teams = [];
        filteredUsers.forEach(u => {
            if (u.teams && Object.keys(u.teams).length > 0) {
                Object.entries(u.teams).forEach(([category, teamList]) => {
                    teamList.forEach((team, teamIndex) => {
                        let menTeamMembersCount = 0;
                        if (Array.isArray(team.menTeamMemberDetails)) {
                            menTeamMembersCount = team.menTeamMemberDetails.length;
                        }

                        let womenTeamMembersCount = 0;
                        if (Array.isArray(team.womenTeamMemberDetails)) {
                            womenTeamMembersCount = team.womenTeamMemberDetails.length;
                        }

                        const teamTshirtsMap = new Map(
                          (team.tshirts || []).map(t => [String(t.size).trim(), t.quantity || 0])
                        );

                        teams.push({
                            ...team,
                            _userId: u.id,
                            _category: category,
                            _teamIndex: teamIndex,
                            _registeredBy: `${u.firstName} ${u.lastName}`,
                            _menTeamMembersCount: menTeamMembersCount,
                            _womenTeamMembersCount: womenTeamMembersCount,
                            _players: team.playerDetails ? team.playerDetails.length : 0,
                            _teamTshirtsMap: teamTshirtsMap
                        });
                    });
                });
            }
        });
        return teams;
    }
    return [];
  }, [filteredUsers, showUsers, showTeams]);


  const toggleRowExpansion = (userId) => {
      setExpandedRows(prev => ({
          ...prev,
          [userId]: !prev[userId]
      }));
  };

  const toggleTeamRowExpansion = (teamUniqueId) => {
      setExpandedTeamRows(prev => ({
          ...prev,
          [teamUniqueId]: !prev[teamUniqueId]
      }));
  };

  const toggleAllRows = () => {
    if (!showUsers && showTeams) {
        const allTeamIds = allTeamsFlattened.map(team => `${team._userId}-${team._category}-${team._teamIndex}`);

        const allCurrentlyExpanded = allTeamIds.length > 0 && allTeamIds.every(id => expandedTeamRows[id]);
        const newExpandedState = { ...expandedTeamRows };

        allTeamIds.forEach(id => {
            newExpandedState[id] = !allCurrentlyExpanded;
        });
        setExpandedTeamRows(newExpandedState);

    } else {
        const allCurrentlyExpanded = filteredUsers.length > 0 && filteredUsers.every(user => expandedRows[user.id]);
        const newExpandedState = { ...expandedRows };

        filteredUsers.forEach(user => {
            newExpandedState[user.id] = !allCurrentlyExpanded;
        });
        setExpandedRows(newExpandedState);
    }
  };

  React.useEffect(() => {
    const checkGlobalAuthReady = () => {
      if (window.isGlobalAuthReady && window.auth && window.db) {
        setIsAuthReady(true);
        setUser(window.auth.currentUser);
        setUserProfileData(window.globalUserProfileData);
        return true;
      }
      return false;
    };

    if (!checkGlobalAuthReady()) {
      const intervalId = setInterval(() => {
        if (checkGlobalAuthReady()) {
          clearInterval(intervalId);
          console.log("AllRegistrationsApp: Firebase a používateľské dáta sú pripravené (interval).");
        }
      }, 100);

      const handleGlobalDataUpdate = (event) => {
        console.log('AllRegistrationsApp: Prijatá udalosť "globalDataUpdated". Aktualizujem lokálny stav.');
        setIsAuthReady(true);
        setUser(window.auth?.currentUser || null);
        setUserProfileData(event.detail);
      };
      window.addEventListener('globalDataUpdated', handleGlobalDataUpdate);

      return () => {
        clearInterval(intervalId);
        window.removeEventListener('globalDataUpdated', handleGlobalDataUpdate);
      };
    }

    let unsubscribeGlobalAuth;
    if (window.auth) {
        unsubscribeGlobalAuth = window.auth.onAuthStateChanged(currentUser => {
            console.log("AllRegistrationsApp: Globálny onAuthStateChanged - Používateľ:", currentUser ? currentUser.uid : "null");
            setUser(currentUser);
            setUserProfileData(window.globalUserProfileData);
            if (!currentUser) {
                console.log("AllRegistrationsApp: Používateľ nie je prihlásený, presmerovávam na login.html.");
                window.location.href = 'login.html';
            }
        });
    }

    return () => {
      if (unsubscribeGlobalAuth) {
          unsubscribeGlobalAuth();
      }
    };
  }, []);


  React.useEffect(() => {
    let unsubscribeUserDoc;

    if (isAuthReady && db && user) {
      console.log(`AllRegistrationsApp: Pokúšam sa načítať používateľský dokument pre UID: ${user.uid}`);
      if (typeof window.showGlobalLoader === 'function') {
        window.showGlobalLoader();
      }

      try {
        const userDocRef = doc(db, 'users', user.uid);
        unsubscribeUserDoc = onSnapshot(userDocRef, (docSnapshot) => {
          if (docSnapshot.exists()) {
            const userData = docSnapshot.data();
            console.log("AllRegistrationsApp: Používateľský dokument existuje, dáta:", userData);

            setUserProfileData(userData);
            setError('');

            if (typeof window.updateMenuItemsVisibility === 'function') {
                window.updateMenuItemsVisibility(userData.role);
            } else {
                console.warn("AllRegistrationsApp: Funkcia updateMenuItemsVisibility nie je definovaná.");
            }
            if (typeof window.hideGlobalLoader === 'function') {
              window.hideGlobalLoader();
            }

            console.log("AllRegistrationsApp: Načítanie používateľských dát dokončené.");
          } else {
            console.warn("AllRegistrationsApp: Používateľský dokument sa nenašiel pre UID:", user.uid);
            setError("Chyba: Používateľský profil sa nenašiel alebo nemáte dostatočné oprávnenia. Skúste sa prosím znova prihlásiť.");
            if (typeof window.hideGlobalLoader === 'function') {
              window.hideGlobalLoader();
            }
            setUser(null);
            setUserProfileData(null);
          }
        }, error => {
          console.error("AllRegistrationsApp: Chyba pri načítaní používateľských dát z Firestore (onSnapshot error):", error);
          if (error.code === 'permission-denied') {
              setError(`Chyba oprávnení: Nemáte prístup k svojmu profilu. Skúste sa prosím znova prihlásiť alebo kontaktujte podporu.`);
          } else if (error.code === 'unavailable') {
              setError(`Chyba pripojenia: Služba Firestore je nedostupná. Skúste to prosím neskôr.`);
          } else {
              setError(`Chyba pri načítaní používateľských dát: ${error.message}`);
          }
          if (typeof window.hideGlobalLoader === 'function') {
            window.hideGlobalLoader();
          }
          setUser(null);
          setUserProfileData(null);
        });
      } catch (e) {
        console.error("AllRegistrationsApp: Chyba pri nastavovaní onSnapshot pre používateľské dáta (try-catch):", e);
        setError(`Chyba pri nastavovaní poslucháča pre používateľské dáta: ${e.message}`);
        if (typeof window.hideGlobalLoader === 'function') {
          window.hideGlobalLoader();
        }
        setUser(null);
        setUserProfileData(null);
      }
    } else if (isAuthReady && user === null) {
        console.log("AllRegistrationsApp: Auth je ready a používateľ je null, presmerovávam na login.html");
        if (typeof window.hideGlobalLoader === 'function') {
          window.hideGlobalLoader();
        }
        window.location.href = 'login.html';
        return;
    } else if (!isAuthReady || !db || user === undefined) {
        console.log("AllRegistrationsApp: Čakám na inicializáciu Auth/DB/User data. Aktuálne stavy: isAuthReady:", isAuthReady, "db:", !!db, "user:", user);
    }

    return () => {
      if (unsubscribeUserDoc) {
        console.log("AllRegistrationsApp: Ruším odber onSnapshot pre používateľský dokument.");
        unsubscribeUserDoc();
      }
    };
  }, [isAuthReady, db, user, auth]);


  React.useEffect(() => {
    let unsubscribeAllUsers;
    let unsubscribeColumnOrder;
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

    console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Spustené.");
    console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Stav snímky - db:", !!db, "user:", user ? user.uid : "N/A", "userProfileData:", !!userProfileData, "role:", userProfileData ? userProfileData.role : "N/A", "approved:", userProfileData ? userProfileData.approved : "N/A", "isAuthReady:", isAuthReady);


    if (isAuthReady && db && user && user.uid && userProfileData && userProfileData.role === 'admin' && userProfileData.approved === true) {
        console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Podmienky splnené: Schválený administrátor. Pokračujem v načítaní dát.");
        if (typeof window.showGlobalLoader === 'function') {
          window.showGlobalLoader();
        }

        try {
            const columnOrderDocRef = doc(db, 'users', user.uid, 'columnOrder', 'columnOrder');

            console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Pokúšam sa nastaviť onSnapshot pre columnOrder na ceste:", columnOrderDocRef.path);
            unsubscribeColumnOrder = onSnapshot(columnOrderDocRef, docSnapshot => {
                console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] columnOrder onSnapshot prijaté dáta. Existuje:", docSnapshot.exists());
                let newOrderToSet = defaultColumnOrder;

                if (docSnapshot.exists()) {
                    const savedOrder = docSnapshot.data().order;
                    console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Surové uložené poradie z Firestore:", savedOrder);

                    if (savedOrder && Array.isArray(savedOrder) && savedOrder.length > 0) {
                        const savedSettingsMap = new Map(savedOrder.map(col => [col.id, col]));
                        const finalOrder = [];

                        defaultColumnOrder.forEach(defaultCol => {
                            const savedColSettings = savedSettingsMap.get(defaultCol.id);
                            if (savedColSettings) {
                                finalOrder.push({
                                    ...defaultCol,
                                    visible: savedColSettings.visible !== undefined ? savedColSettings.visible : defaultCol.visible
                                });
                            } else {
                                finalOrder.push(defaultCol);
                            }
                        });

                        newOrderToSet = finalOrder;
                        console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Zlúčené a preusporiadané poradie:", newOrderToSet);

                    } else {
                        console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Uložené poradie je prázdne alebo poškodené. Používam predvolené a ukladám ho.");
                        setDoc(columnOrderDocRef, { order: defaultColumnOrder }, { merge: true })
                            .then(() => console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Uložené predvolené poradie do Firestore (prázdne/poškodené)."))
                            .catch(e => console.error("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Chyba pri ukladaní predvoleného poradia (prázdne/poškodené):", e));
                    }
                } else {
                    console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Dokument poradia stĺpcov neexistuje. Používam predvolené a ukladám ho.");
                    setDoc(columnOrderDocRef, { order: defaultColumnOrder }, { merge: true })
                        .then(() => console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Uložené predvolené poradie do Firestore (dokument neexistoval)."))
                        .catch(e => console.error("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Chyba pri ukladaní predvoleného poradia (dokument neexistoval):", e));
                }

                setColumnOrder(newOrderToSet);
            }, error => {
                console.error("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Chyba pri načítaní poradia stĺpcov z Firestore (onSnapshot error):", error);
                setError(`Chyba pri načítaní poradia stĺpcov: ${error.message}`);
                setColumnOrder(defaultColumnOrder);
            });
        } catch (e) {
            console.error("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Chyba pri nastavovaní onSnapshot pre poradie stĺpcov (try-catch):", e);
            setError(`Chyba pri inicializácii poradia stĺpcov: ${e.message}`);
            setColumnOrder(defaultColumnOrder);
        }

        try {
            const usersCollectionRef = collection(db, 'users');
            unsubscribeAllUsers = onSnapshot(usersCollectionRef, snapshot => {
                const usersData = snapshot.docs
                    .map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));

                console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Všetci používatelia načítaní:", usersData.length, "používateľov.");
                setAllUsers(usersData);
                setFilteredUsers(usersData);
                if (typeof window.hideGlobalLoader === 'function') {
                  window.hideGlobalLoader();
                }
            }, error => {
                console.error("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Chyba pri načítaní všetkých používateľov z Firestore:", error);
                setError(`Chyba pri načítaní používateľov: ${error.message}`);
                if (typeof window.hideGlobalLoader === 'function') {
                  window.hideGlobalLoader();
                }
                setUserNotificationMessage(`Chyba pri načítaní dát: ${e.message}`);
            });
        } catch (e) {
            console.error("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Chyba pri nastavovaní onSnapshot pre všetkých používateľov (try-catch):", e);
            setError(`Chyba pri načítaní používateľov: ${e.message}`);
            if (typeof window.hideGlobalLoader === 'function') {
              window.hideGlobalLoader();
            }
            setUserNotificationMessage(`Chyba pri načítaní dát: ${e.message}`);
        }
    } else if (isAuthReady && user === null) {
        console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Používateľ je null, nenačítavam dáta. Presmerovávam na login.html.");
        if (typeof window.hideGlobalLoader === 'function') {
          window.hideGlobalLoader();
        }
        window.location.href = 'login.html';
        return;
    } else if (isAuthReady && userProfileData && (userProfileData.role !== 'admin' || userProfileData.approved === false)) {
        console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Používateľ nie je schválený administrátor, nenačítavam dáta. Presmerovávam na my-data.html.");
        setError("Nemáte oprávnenie na zobrazenie tejto stránky. Iba schválení administrátori majú prístup.");
        if (typeof window.hideGlobalLoader === 'function') {
          window.hideGlobalLoader();
        }
        setUserNotificationMessage("Nemáte oprávnenie na zobrazenie tejto stránky.");
        window.location.href = 'logged-in-my-data.html';
        return;
    } else {
        console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Podmienky pre načítanie dát nesplnené. Čakám na aktualizácie stavu.");
    }

    return () => {
        if (unsubscribeAllUsers) {
            console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Ruším odber onSnapshot pre všetkých používateľov.");
            unsubscribeAllUsers();
        }
        if (unsubscribeColumnOrder) {
            console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Ruším odber onSnapshot pre poradie stĺpcov.");
            unsubscribeColumnOrder();
        }
    };
  }, [db, userProfileData, isAuthReady, user, collection, doc, onSnapshot, setDoc]);

  React.useEffect(() => {
      let unsubscribeSettings;
      if (db) {
          const settingsDocRef = doc(db, 'settings', 'sizeTshirts');
          unsubscribeSettings = onSnapshot(settingsDocRef, (docSnapshot) => {
              if (docSnapshot.exists()) {
                  const data = docSnapshot.data();
                  if (data && Array.isArray(data.sizes)) {
                      const availableSizesFromDb = [...data.sizes]
                          .map(s => typeof s === 'object' && s.size ? String(s.size).trim() : String(s).trim()); 

                      setAvailableTshirtSizes(availableSizesFromDb);
                  } else {
                      console.warn("Firestore settings/sizeTshirts dokument neobsahuje pole 'sizes' alebo má neočakávaný formát. Používam predvolené poradie.");
                      setAvailableTshirtSizes(tshirtSizeOrderFallback);
                  }
              } else {
                  console.warn("Firestore settings/sizeTshirts dokument neexistuje. Používam predvolené poradie.");
                  setAvailableTshirtSizes(tshirtSizeOrderFallback);
              }
          }, error => {
              console.error("Chyba pri načítaní veľkostí tričiek z Firestore:", error);
              setAvailableTshirtSizes(tshirtSizeOrderFallback);
          });
      }
      return () => {
          if (unsubscribeSettings) {
              unsubscribeSettings();
          }
      };
  }, [db]);


  const handleSort = (columnId) => {
      let direction = 'asc';
      if (currentSort.column === columnId && currentSort.direction === 'asc') {
          direction = 'desc';
      }
      setCurrentSort({ column: columnId, direction });

      const sorted = [...filteredUsers].sort((a, b) => {
          const columnDef = columnOrder.find(col => col.id === columnId);
          console.log(`handleSort: Triedenie podľa stĺpca: ${columnId}, Smer: ${direction}`);
          console.log(`handleSort: Nájdená definícia stĺpca pre ${columnId}:`, columnDef);

          const type = columnDef ? columnDef.type : 'string';

          let valA, valB;

          if (columnId.includes('.')) {
              valA = getNestedValue(a, columnId);
              valB = getNestedValue(b, columnId);
          } else {
              valA = a[columnId];
              valB = b[columnId];
          }

          if (type === 'date') {
              const dateA = valA && typeof valA.toDate === 'function' ? valA.toDate() : new Date(0);
              const dateB = valB && typeof valB.toDate === 'function' ? valB.toDate() : new Date(0);
              return direction === 'asc' ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
          } else if (type === 'boolean') {
              const boolA = Boolean(valA);
              const boolB = Boolean(valB);
              return direction === 'asc' ? (boolA === boolB ? 0 : (boolA ? 1 : -1)) : (boolA === boolB ? 0 : (boolA ? -1 : 1));
          } else if (type === 'number') {
              const numA = parseFloat(valA) || 0;
              const numB = parseFloat(valB) || 0;
              return direction === 'asc' ? numA - numB : numB - numA;
          } else {
              return direction === 'asc' ? String(valA || '').localeCompare(String(valB || '')) : String(valB || '').localeCompare(String(valA || ''));
          }
      });
      setFilteredUsers(sorted);
      console.log("handleSort: Prvých 5 zoradených používateľov:", sorted.slice(0, 5).map(u => ({ id: u.id, [columnId]: getNestedValue(u, columnId) })));
  };

  const openFilterModal = (column) => {
      console.log("AllRegistrationsApp: openFilterModal volaná pre stĺpec:", column);
      console.log("AllRegistrationsApp: Aktuálny stav allUsers:", allUsers);

      setFilterColumn(column);
      const values = [...new Set(allUsers.map(u => {
          let val;
          if (column === 'registrationDate' && u.registrationDate && typeof u.registrationDate.toDate === 'function') {
              val = u.registrationDate.toDate().toLocaleString('sk-SK');
          } else if (column.includes('.')) {
              const parts = column.split('.');
              let nestedVal = u;
              for (const part of parts) {
                  nestedVal = nestedVal ? nestedVal[part] : undefined;
              }
              val = nestedVal;
          } else {
              val = u[column];
          }
          if (typeof val === 'boolean') {
              return val ? 'áno' : 'nie';
          }
          return String(val || '').toLowerCase();
      }))].filter(v => v !== '').sort();
      setUniqueColumnValues(values);
      setFilterModalOpen(true);
  };

  const closeFilterModal = () => {
      setFilterModalOpen(false);
      setFilterColumn('');
      setUniqueColumnValues([]);
  };

  const applyFilter = (column, values) => {
      setActiveFilters(prev => ({ ...prev, [column]: values }));
  };

  const clearFilter = (column) => {
      setActiveFilters(prev => {
          const newFilters = { ...prev };
          delete newFilters[column];
          return newFilters;
      });
  };

  React.useEffect(() => {
      let currentFiltered = [...allUsers];

      let usersToDisplay = [];

      if (showUsers) {
          usersToDisplay = currentFiltered;
      } else if (!showUsers && showTeams) {
          usersToDisplay = currentFiltered.filter(user => user.teams && Object.keys(user.teams).length > 0);
      } else {
          usersToDisplay = [];
      }

      Object.keys(activeFilters).forEach(column => {
          const filterValues = activeFilters[column];
          if (filterValues.length > 0) {
              usersToDisplay = usersToDisplay.filter(user => {
                  let userValue;
                  if (column === 'registrationDate' && user.registrationDate && typeof user.registrationDate.toDate === 'function') {
                      userValue = user.registrationDate.toDate().toLocaleString('sk-SK').toLowerCase();
                  } else if (column.includes('.')) {
                      const parts = column.split('.');
                      let nestedVal = user;
                      for (const part of parts) {
                          nestedVal = nestedVal ? nestedVal[part] : undefined;
                      }
                      userValue = String(nestedVal || '').toLowerCase();
                  } else {
                      userValue = String(user[column] || '').toLowerCase();
                  }
                  if (typeof user[column] === 'boolean') {
                      userValue = user[column] ? 'áno' : 'nie';
                  }
                  return filterValues.includes(userValue);
              });
          }
      });
      setFilteredUsers(usersToDisplay);
  }, [allUsers, activeFilters, showUsers, showTeams]);


  React.useEffect(() => {
    console.log(`AllRegistrationsApp: useEffect pre aktualizáciu odkazov hlavičky. Používateľ: ${user ? user.uid : 'null'}`);
    const authLink = document.getElementById('auth-link');
    const profileLink = document.getElementById('profile-link');
    const logoutButton = document.getElementById('logout-button');
    const registerLink = document.getElementById('register-link');

    if (!authLink || !profileLink || !logoutButton || !registerLink) {
        console.warn("AllRegistrationsApp: Niektoré navigačné odkazy nie sú k dispozícii v DOM.");
        return;
    }

    if (user) {
      authLink.classList.add('hidden');
      profileLink.classList.remove('hidden');
      logoutButton.classList.remove('hidden');
      registerLink.classList.add('hidden');
      console.log("AllRegistrationsApp: Používateľ prihlásený. Skryté: Prihlásenie, Registrácia. Zobrazené: Moja zóna, Odhlásenie.");
    } else {
      authLink.classList.remove('hidden');
      profileLink.classList.add('hidden');
      logoutButton.classList.add('hidden');
      registerLink.classList.remove('hidden');
      console.log("AllRegistrationsApp: Používateľ odhlásený. Zobrazené: Prihlásenie, Registrácia. Skryté: Moja zóna, Odhlásenie.");
    }
  }, [user]);

  const handleLogout = React.useCallback(async () => {
    if (!auth) {
        console.error("AllRegistrationsApp: Chyba: Auth inštancia nie je definovaná pri pokuse o odhlásenie.");
        setUserNotificationMessage("Chyba: Systém autentifikácie nie je pripravený. Skúste to znova.", 'error');
        return;
    }
    try {
      if (typeof window.showGlobalLoader === 'function') {
        window.showGlobalLoader();
      }
      await auth.signOut();
      setUserNotificationMessage("Úspešne odhlásený.");
      window.location.href = 'login.html';
      setUser(null);
      setUserProfileData(null);
    } catch (e) {
      console.error("AllRegistrationsApp: Chyba pri odhlásení:", e);
      setError(`Chyba pri odhlásení: ${e.message}`);
    } finally {
      if (typeof window.hideGlobalLoader === 'function') {
        window.hideGlobalLoader();
      }
    }
  }, [auth]);

  React.useEffect(() => {
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
      logoutButton.addEventListener('click', handleLogout);
    }
    return () => {
      if (logoutButton) {
        logoutButton.removeEventListener('click', handleLogout);
      }
    };
  }, [handleLogout]);

  const moveColumn = async (columnId, direction) => {
    const currentIndex = columnOrder.findIndex(col => col.id === columnId);
    if (currentIndex === -1) return;

    const newColumnOrder = [...columnOrder];
    const columnToMove = newColumnOrder.splice(currentIndex, 1)[0];

    let newIndex;
    if (direction === 'left') {
      newIndex = Math.max(0, currentIndex - 1);
    } else { // 'right'
      newIndex = Math.min(newColumnOrder.length, currentIndex + 1);
    }

    newColumnOrder.splice(newIndex, 0, columnToMove);
    setColumnOrder(newColumnOrder);

    if (db && user && user.uid) {
        const columnOrderDocRef = doc(db, 'users', user.uid, 'columnOrder', 'columnOrder');
        try {
            await setDoc(columnOrderDocRef, { order: newColumnOrder }, { merge: true });
            console.log("AllRegistrationsApp: Poradie stĺpcov uložené do Firestore.");
        } catch (e) {
            console.error("AllRegistrationsApp: Chyba pri ukladaní poradia stĺpcov do Firestore:", e);
            setUserNotificationMessage(`Chyba pri ukladaní poradia stĺpcov: ${e.message}`);
        }
    }
  };

  const handleSaveColumnVisibility = async (updatedColumns) => {
    setColumnOrder(updatedColumns);
    if (db && user && user.uid) {
        const columnOrderDocRef = doc(db, 'users', user.uid, 'columnOrder', 'columnOrder');
        try {
            await setDoc(columnOrderDocRef, { order: updatedColumns }, { merge: true });
            setUserNotificationMessage("Viditeľnosť stĺpcov bola úspešne uložená.", 'success');
        } catch (e) {
            console.error("AllRegistrationsApp: Chyba pri ukladaní viditeľnosti stĺpcov do Firestore:", e);
            setUserNotificationMessage(`Chyba pri ukladaní viditeľnosti stĺpcov: ${e.message}`, 'error');
        }
    }
  };

  if (!isAuthReady || user === undefined || !userProfileData) {
    if (typeof window.hideGlobalLoader === 'function') {
      window.hideGlobalLoader();
    }
    return null;
  }

  if (userProfileData && (userProfileData.role !== 'admin' || userProfileData.approved === false)) {
      console.log("AllRegistrationsApp: Používateľ nie je schválený administrátor. Presmerovávam na logged-in-my-data.html.");
      setError("Nemáte oprávnenie na zobrazenie tejto stránky. Iba schválení administrátori majú prístup.");
      if (typeof window.hideGlobalLoader === 'function') {
        window.hideGlobalLoader();
      }
      setUserNotificationMessage("Nemáte oprávnenie na zobrazenie tejto stránky.");
      window.location.href = 'logged-in-my-data.html';
      return null;
  }

  const formatPostalCode = (postalCode) => {
    if (!postalCode) return '-';
    const cleaned = String(postalCode).replace(/\s/g, '');
    if (cleaned.length === 5) {
      return `${cleaned.substring(0, 3)} ${cleaned.substring(3, 5)}`;
    }
    return postalCode;
  };

  const shouldShowExpander = (u) => {
      return u.role !== 'admin' && showTeams && u.teams && Object.keys(u.teams).length > 0;
  };


  return React.createElement(
    'div',
    { className: 'min-h-screen flex flex-col items-center font-inter overflow-y-auto' },
    React.createElement(NotificationModal, {
        message: userNotificationMessage,
        onClose: () => setUserNotificationMessage(''),
        displayNotificationsEnabled: userProfileData?.displayNotifications
    }),
    React.createElement(FilterModal, {
        isOpen: filterModalOpen,
        onClose: closeFilterModal,
        columnName: filterColumn,
        onApplyFilter: applyFilter,
        initialFilterValues: activeFilters[filterColumn] || [],
        uniqueColumnValues: uniqueColumnValues
    }),
    React.createElement(ColumnVisibilityModal, {
        isOpen: showColumnVisibilityModal,
        onClose: () => setShowColumnVisibilityModal(false),
        columns: columnOrder,
        onSaveColumnVisibility: handleSaveColumnVisibility,
    }),
    React.createElement(DataEditModal, {
        isOpen: isEditModalOpen,
        onClose: closeEditModal,
        title: editModalTitle,
        data: editingData
    }),
    React.createElement(
      'div',
      { className: 'w-full px-4 mt-20 mb-10' },
      error && React.createElement(
        'div',
        { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap', role: 'alert' },
        error
      ),
      React.createElement(
        'div',
        { className: 'bg-white p-8 rounded-lg shadow-xl w-full' },
        React.createElement('h1', { className: 'text-3xl font-bold text-center text-gray-800 mb-6' },
          'Všetky registrácie'
        ),
        React.createElement(
            'div',
            { className: 'flex justify-end items-center mb-4 flex-wrap gap-2' },
            React.createElement('label', { className: 'flex items-center mr-4 cursor-pointer' },
                React.createElement('input', {
                    type: 'checkbox',
                    className: 'form-checkbox h-5 w-5 text-blue-600 rounded-md mr-2',
                    checked: showUsers,
                    onChange: (e) => setShowUsers(e.target.checked)
                }),
                React.createElement('span', { className: 'text-gray-700' }, 'Zobraziť používateľov')
            ),
            React.createElement('label', { className: 'flex items-center mr-4 cursor-pointer' },
                React.createElement('input', {
                    type: 'checkbox',
                    className: 'form-checkbox h-5 w-5 text-blue-600 rounded-md mr-2',
                    checked: showTeams,
                    onChange: (e) => setShowTeams(e.target.checked)
                }),
                React.createElement('span', { className: 'text-gray-700' }, 'Zobraziť tímy')
            ),
            React.createElement('button', {
                onClick: () => setShowColumnVisibilityModal(true),
                className: 'bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200'
            }, 'Upraviť stĺpce')
        ),
        React.createElement(
            'div',
            { className: 'overflow-x-auto relative shadow-md sm:rounded-lg' },
            React.createElement(
                'table',
                { className: 'text-sm text-left text-gray-500' },
                React.createElement(
                    'thead',
                    { className: 'text-xs text-gray-700 uppercase bg-gray-50' },
                    React.createElement(
                        'tr',
                        null,
                        (!showUsers && showTeams) ? (
                            React.createElement(React.Fragment, null,
                                React.createElement('th', { className: 'py-3 px-2 text-center min-w-max' },
                                    React.createElement('button', {
                                        onClick: toggleAllRows,
                                        className: 'text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-200 focus:outline-none'
                                    },
                                    allTeamsFlattened.length > 0 && allTeamsFlattened.every(team => expandedTeamRows[`${team._userId}-${team._category}-${team._teamIndex}`]) ? '▲' : '▼'
                                    )
                                ),
                                React.createElement('th', { className: 'py-2 px-2 text-center whitespace-nowrap min-w-max' }, 'Kategória'),
                                React.createElement('th', { className: 'py-2 px-2 text-left whitespace-nowrap min-w-max' }, 'Názov tímu'),
                                React.createElement('th', { className: 'py-2 px-2 text-center whitespace-nowrap min-w-max' }, 'Hráči'),
                                React.createElement('th', { className: 'py-2 px-2 text-center whitespace-nowrap min-w-max' }, 'R. tím (ž)'),
                                React.createElement('th', { className: 'py-2 px-2 text-center whitespace-nowrap min-w-max' }, 'R. tím (m)'),
                                React.createElement('th', { className: 'py-2 px-2 text-left whitespace-nowrap min-w-max' }, 'Doprava'),
                                React.createElement('th', { className: 'py-2 px-2 text-left whitespace-nowrap min-w-max' }, 'Ubytovanie'),
                                React.createElement('th', { className: 'py-2 px-2 text-left whitespace-nowrap min-w-max' }, 'Balík'),
                                (availableTshirtSizes && availableTshirtSizes.length > 0 ? availableTshirtSizes : ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']).map(size =>
                                    React.createElement('th', { key: `tshirt-header-${size}`, className: 'py-2 px-2 text-center whitespace-nowrap min-w-max' }, `Vel. ${size.toUpperCase()}`)
                                )
                            )
                        ) : (
                            React.createElement(React.Fragment, null,
                                React.createElement('th', { scope: 'col', className: 'py-3 px-2 text-center min-w-max' },
                                    showUsers && showTeams && React.createElement('button', {
                                        onClick: toggleAllRows,
                                        className: 'text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-200 focus:outline-none'
                                    },
                                    filteredUsers.length > 0 && filteredUsers.every(user => expandedRows[user.id]) ? '▲' : '▼'
                                    )
                                ),
                                columnOrder.filter(col => col.visible).map((col, index) => (
                                    React.createElement('th', {
                                        key: col.id,
                                        scope: 'col',
                                        className: `py-3 px-6 relative group ${col.id === 'toggle' || col.id === 'expander' ? '' : 'whitespace-nowrap'} min-w-max`,
                                        onMouseEnter: () => setHoveredColumn(col.id),
                                        onMouseLeave: () => setHoveredColumn(null)
                                    },
                                        React.createElement('div', { className: 'flex items-center justify-center h-full space-x-1' },
                                            index > 0 && React.createElement('button', {
                                                onClick: (e) => { e.stopPropagation(); moveColumn(col.id, 'left'); },
                                                className: `text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 ${hoveredColumn === col.id ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200`
                                            }, '←'),
                                            React.createElement('button', {
                                                onClick: (e) => { e.stopPropagation(); openFilterModal(col.id); },
                                                className: `text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 ${activeFilters[col.id] && activeFilters[col.id].length > 0 ? 'opacity-100 text-blue-500' : 'opacity-0 group-hover:opacity-100'} transition-opacity duration-200`
                                            }, '⚙️'),
                                            index < columnOrder.filter(c => c.visible).length - 1 && React.createElement('button', {
                                                onClick: (e) => { e.stopPropagation(); moveColumn(col.id, 'right'); },
                                                className: `text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 ${hoveredColumn === col.id ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200`
                                            }, '→')
                                        ),
                                        React.createElement('span', { onClick: () => handleSort(col.id), className: 'flex items-center cursor-pointer' }, // Added cursor-pointer
                                            col.label,
                                            currentSort.column === col.id && React.createElement('span', { className: 'ml-1' }, currentSort.direction === 'asc' ? '▲' : '▼')
                                        )
                                    )
                                ))
                            )
                        )
                    )
                ),
                React.createElement(
                    'tbody',
                    null,
                    ((!showUsers && showTeams) && allTeamsFlattened.length === 0) || (showUsers && filteredUsers.length === 0) ? (
                        React.createElement(
                            'tr',
                            null,
                            React.createElement('td', { colSpan: columnOrder.filter(c => c.visible).length + 2, className: 'py-4 px-6 text-center text-gray-500' }, 'Žiadne registrácie na zobrazenie.')
                        )
                    ) : (
                        (!showUsers && showTeams) ? (
                            React.createElement(React.Fragment, null,
                                allTeamsFlattened.map(team => {
                                    const teamUniqueId = `${team._userId}-${team._category}-${team._teamIndex}`;
                                    
                                    return React.createElement(
                                        React.Fragment,
                                        { key: teamUniqueId },
                                        React.createElement(
                                            'tr',
                                            {
                                                className: `bg-white border-b hover:bg-gray-50 cursor-pointer`,
                                                onClick: () => openEditModal(team, `Upraviť tím: ${team.teamName}`) // Celý riadok otvára modal na úpravu
                                            },
                                            React.createElement('td', {
                                                className: 'py-3 px-2 text-center whitespace-nowrap min-w-max',
                                                onClick: (e) => { // Kliknutie na šípku rozbalí/zbalí riadok
                                                    e.stopPropagation(); // Zastaví propagáciu udalosti na riadok
                                                    toggleTeamRowExpansion(teamUniqueId);
                                                }
                                            },
                                                React.createElement('span', { className: 'text-gray-500' }, expandedTeamRows[teamUniqueId] ? '▲' : '▼')
                                            ),
                                            React.createElement('td', { className: 'py-3 px-2 text-center whitespace-nowrap min-w-max' }, team._category || '-'),
                                            React.createElement('td', { className: 'py-3 px-2 text-left whitespace-nowrap min-w-max' }, team.teamName || `Tím`),
                                            React.createElement('td', { className: 'py-3 px-2 text-center whitespace-nowrap min-w-max' }, team._players),
                                            React.createElement('td', { className: 'py-3 px-2 text-center whitespace-nowrap min-w-max' }, team._womenTeamMembersCount),
                                            React.createElement('td', { className: 'py-3 px-2 text-center whitespace-nowrap min-w-max' }, team._menTeamMembersCount),
                                            React.createElement('td', { className: 'py-3 px-2 text-left whitespace-nowrap min-w-max' }, team.arrival?.type || '-'),
                                            React.createElement('td', { className: 'py-3 px-2 text-left whitespace-nowrap min-w-max' }, team.accommodation?.type || '-'),
                                            React.createElement('td', { className: 'py-3 px-2 text-left whitespace-nowrap min-w-max' }, team.packageDetails?.name || '-'),
                                            (availableTshirtSizes && availableTshirtSizes.length > 0 ? availableTshirtSizes : ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']).map(size =>
                                                React.createElement('td', { key: `tshirt-data-${teamUniqueId}-${size}`, className: 'py-3 px-2 text-center whitespace-nowrap min-w-max' }, team._teamTshirtsMap.get(size) || '-')
                                            )
                                        ),
                                        expandedTeamRows[teamUniqueId] && (!showUsers && showTeams) && React.createElement(
                                            'tr',
                                            { key: `${teamUniqueId}-details`, className: 'bg-gray-100' },
                                            React.createElement('td', { colSpan: columnOrder.filter(c => c.visible).length + 2, className: 'p-0' },
                                                React.createElement(TeamDetailsContent, {
                                                    team: team,
                                                    tshirtSizeOrder: availableTshirtSizes,
                                                    showDetailsAsCollapsible: false,
                                                    showUsersChecked: showUsers,
                                                    showTeamsChecked: showTeams
                                                })
                                            )
                                        )
                                    );
                                })
                            )
                        ) : (
                            filteredUsers.map(u => (
                                React.createElement(
                                    React.Fragment,
                                    { key: u.id },
                                    React.createElement(
                                        'tr',
                                        {
                                            className: `bg-white border-b hover:bg-gray-50 cursor-pointer`, // Vždy cursor-pointer pre úpravu riadku
                                            onClick: () => openEditModal(u, `Upraviť používateľa: ${u.firstName} ${u.lastName}`) // Kliknutie na riadok otvorí modal na úpravu
                                        },
                                        React.createElement('td', {
                                            className: 'py-3 px-2 text-center min-w-max',
                                            onClick: (e) => { // Kliknutie na šípku rozbalí/zbalí riadok
                                                e.stopPropagation(); // Zastaví propagáciu udalosti na riadok
                                                if (shouldShowExpander(u)) {
                                                    toggleRowExpansion(u.id);
                                                }
                                            }
                                        },
                                            React.createElement('span', { className: 'text-gray-500' },
                                                shouldShowExpander(u)
                                                    ? (expandedRows[u.id] ? '▲' : '▼')
                                                    : '-'
                                            )
                                        ),
                                        columnOrder.filter(col => col.visible).map(col => (
                                            React.createElement('td', { key: col.id, className: 'py-3 px-6 text-left whitespace-nowrap min-w-max' },
                                                col.id === 'registrationDate' && getNestedValue(u, col.id) && typeof getNestedValue(u, col.id).toDate === 'function' ? getNestedValue(u, col.id).toDate().toLocaleString('sk-SK') :
                                                col.id === 'approved' ? (getNestedValue(u, col.id) ? 'Áno' : 'Nie') :
                                                col.id === 'postalCode' ? formatPostalCode(getNestedValue(u, col.id)) :
                                                getNestedValue(u, col.id) || '-'
                                            )
                                        ))
                                    ),
                                    expandedRows[u.id] && showTeams && React.createElement(
                                        'tr',
                                        { key: `${u.id}-details`, className: 'bg-gray-100' },
                                        React.createElement('td', { colSpan: columnOrder.filter(c => c.visible).length + 1, className: 'p-0' },
                                            Object.entries(u.teams || {}).map(([category, teamList]) =>
                                                teamList.map((team, teamIndex) => {
                                                    let menTeamMembersCount = 0;
                                                    if (Array.isArray(team.menTeamMemberDetails)) {
                                                        menTeamMembersCount = team.menTeamMemberDetails.length;
                                                    }

                                                    let womenTeamMembersCount = 0;
                                                    if (Array.isArray(team.womenTeamMemberDetails)) {
                                                        womenTeamMembersCount = team.womenTeamMemberDetails.length;
                                                    }

                                                    const teamTshirtsMap = new Map(
                                                        (team.tshirts || []).map(t => [String(t.size).trim(), t.quantity || 0])
                                                    );

                                                    return React.createElement(TeamDetailsContent, {
                                                        key: `${u.id}-${category}-${teamIndex}-details-content`,
                                                        team: {
                                                            ...team,
                                                            _category: category,
                                                            _registeredBy: `${u.firstName} ${u.lastName}`,
                                                            _menTeamMembersCount: menTeamMembersCount,
                                                            _womenTeamMembersCount: womenTeamMembersCount,
                                                            _players: team.playerDetails ? team.playerDetails.length : 0,
                                                            _teamTshirtsMap: teamTshirtsMap
                                                        },
                                                        tshirtSizeOrder: availableTshirtSizes,
                                                        showDetailsAsCollapsible: true,
                                                        showUsersChecked: showUsers,
                                                        showTeamsChecked: showTeams
                                                    })
                                                })
                                            )
                                        )
                                    )
                                )
                            ))
                        )
                    )
                )
            )
        )
      )
    )
  );
}

// Explicitne sprístupniť komponent globálne
window.AllRegistrationsApp = AllRegistrationsApp;
