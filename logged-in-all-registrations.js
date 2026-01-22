import { collection, doc, onSnapshot, setDoc, updateDoc, getDoc, query, orderBy, getDocs, serverTimestamp, addDoc, deleteField } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { countryDialCodes } from './countryDialCodes.js'; 

function getSmartCursorPosition(oldDisplay, newDisplay, oldPos) {
    // 1. Práve sme napísali 3. číslicu → posun za medzeru
    if (oldPos === 3 && newDisplay.length === 4 && newDisplay[3] === ' ') {
        return 4;
    }

    // 2. Mazanie späť cez medzeru
    if (oldDisplay.length > newDisplay.length && oldPos === 4 && oldDisplay[3] === ' ') {
        return 3;
    }

    // 3. Všeobecný prípad – počítame podľa počtu číslic
    let digitCount = 0;
    for (let i = 0; i < newDisplay.length && digitCount < oldPos; i++) {
        if (/\d/.test(newDisplay[i])) digitCount++;
    }

    // Ak sme už za 3. číslicou, pridáme +1 za medzeru
    if (digitCount >= 3 && newDisplay.length > 3) {
        return digitCount + 1;
    }

    return digitCount;
}

const getFormattedPostalCodeForInput = (rawValue) => {
    if (!rawValue) return '';
    const digits = String(rawValue).replace(/\D/g, '').slice(0, 5);
    if (digits.length > 3) {
        return digits.slice(0, 3) + ' ' + digits.slice(3);
    }
    return digits;
};

// 2. Pre zobrazenie v tabuľke – s pomlčkou ak je prázdne
const formatPostalCodeForDisplay = (postalCode) => {
    if (!postalCode) return '-';
    const cleaned = String(postalCode).replace(/\D/g, '');
    if (cleaned.length === 5) {
        return `${cleaned.slice(0,3)} ${cleaned.slice(3)}`;
    }
    return cleaned || '-';
};

function NotificationModal({ message, onClose, displayNotificationsEnabled }) {
  const [show, setShow] = React.useState(false);
  const timerRef = React.useRef(null);

  React.useEffect(() => {
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
  }, [message, onClose, displayNotificationsEnabled]);

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

// ConfirmationModal Component - Nové modálne okno pre potvrdenie
function ConfirmationModal({ isOpen, onClose, onConfirm, title, message }) {
    if (!isOpen) return null;

    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-[1001] p-4' }, // Z-index vyšší ako DataEditModal
        React.createElement(
            'div',
            { className: 'bg-white p-6 rounded-lg shadow-xl w-full max-w-sm' },
            React.createElement('h3', { className: 'text-lg font-semibold mb-4 text-gray-800' }, title),
            React.createElement('p', { className: 'text-gray-700 mb-6' }, message),
            React.createElement(
                'div',
                { className: 'flex justify-end space-x-2' },
                React.createElement('button', {
                    className: 'px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300',
                    onClick: onClose
                }, 'Zrušiť'),
                React.createElement('button', {
                    className: 'px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700',
                    onClick: () => {
                        onConfirm();
                        // Po potvrdení sa modal zatvorí v callbacku onConfirm, ak je to potrebné,
                        // alebo tu po dokončení operácie. Pre jednoduchosť to môže zatvoriť DataEditModal.
                    }
                }, 'Potvrdiť')
            )
        )
    );
}

// AddMemberTypeSelectionModal Component - Nové modálne okno pre výber typu člena tímu
function AddMemberTypeSelectionModal({ isOpen, onClose, onSelectType }) {
    const [selectedType, setSelectedType] = React.useState('');

    if (!isOpen) return null;

    const handleAdd = () => {
        if (selectedType) {
            onSelectType(selectedType);
            onClose();
            setSelectedType(''); // Resetovať pre ďalšie použitie
        }
    };

    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-[1002] p-4' }, // Vyšší z-index
        React.createElement(
            'div',
            { className: 'bg-white p-6 rounded-lg shadow-xl w-full max-w-sm' },
            React.createElement('h3', { className: 'text-lg font-semibold mb-4 text-gray-800' }, 'Vybrať typ člena tímu'),
            React.createElement(
                'select',
                {
                    className: 'mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-white p-2 mb-4 focus:outline-none focus:ring-2 focus:focus:ring-blue-500',
                    value: selectedType,
                    onChange: (e) => setSelectedType(e.target.value)
                },
                React.createElement('option', { value: '', disabled: true }, 'Vyberte typ'),
                React.createElement('option', { value: 'Hráč' }, 'Hráč'),
                React.createElement('option', { value: 'Člen realizačného tímu (žena)' }, 'Člen realizačného tímu (žena)'),
                React.createElement('option', { value: 'Člen realizačného tímu (muž)' }, 'Člen realizačného tímu (muž)'),
                React.createElement('option', { value: 'Šofér (žena)' }, 'Šofér (žena)'),
                React.createElement('option', { value: 'Šofér (muž)' }, 'Šofér (muž)')
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
                    onClick: handleAdd,
                    disabled: !selectedType
                }, 'Pridať')
            )
        )
    );
}


// DialCodeSelectionModal Component - Nové modálne okno pre výber predvoľby
function DialCodeSelectionModal({ isOpen, onClose, onSelectDialCode, currentDialCode }) {
    const [searchTerm, setSearchTerm] = React.useState('');
    const modalRef = React.useRef(null);

    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (modalRef.current && !modalRef.current.contains(event.target)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const filteredCodes = countryDialCodes.filter(country =>
        country.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        country.dialCode.includes(searchTerm)
    );

    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50 p-4' },
        React.createElement(
            'div',
            {
                ref: modalRef,
                className: 'bg-white p-6 rounded-lg shadow-xl w-full max-w-sm max-h-[90vh] overflow-y-auto',
                onClick: (e) => e.stopPropagation() // Zastaví bublanie udalosti
            },
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mb-4' },
                React.createElement('h3', { className: 'text-lg font-semibold' }, 'Vybrať predvoľbu'),
                React.createElement('button', {
                    className: 'text-gray-500 hover:text-gray-700',
                    onClick: onClose
                }, '✕')
            ),
            React.createElement('input', {
                type: 'text',
                placeholder: 'Hľadať krajinu alebo kód...',
                className: 'w-full px-3 py-2 border border-gray-300 rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500',
                value: searchTerm,
                onChange: (e) => setSearchTerm(e.target.value)
            }),
            React.createElement(
                'div',
                { className: 'space-y-2' },
                filteredCodes.map(country =>
                    React.createElement('button', {
                        key: country.code,
                        className: `w-full text-left p-2 rounded-md hover:bg-blue-100 ${currentDialCode === country.dialCode ? 'bg-blue-200 font-medium' : ''}`,
                        onClick: () => {
                            onSelectDialCode(country.dialCode);
                            onClose();
                        }
                    }, `${country.name} (${country.dialCode})`)
                )
            )
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
        setSelectedValues(prev => {
            if (prev.includes(value)) {
                return prev.filter(item => item !== value);
            } else {
                return [...prev, value];
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
                uniqueColumnValues.map((item, index) =>
                    React.createElement(
                        'div',
                        { key: index, className: 'flex items-center mb-2' },
                        React.createElement('input', {
                            type: 'checkbox',
                            id: `filter-${columnName}-${index}`,
                            value: item.value || item,
                            checked: selectedValues.includes(item.value || item),
                            onChange: () => handleCheckboxChange(item.value || item),
                            className: 'mr-2'
                        }),
                        React.createElement('label', { htmlFor: `filter-${columnName}-${index}` }, item.label || item)
                    )
                )
            ),
            React.createElement(
                'div',
                { className: 'flex justify-end space-x-2 mt-4' },
                React.createElement('button', {
                    className: 'px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300',
                    onClick: onClose
                }, 'Zrušiť'),
                React.createElement('button', {
                    className: 'px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600',
                    onClick: handleApply
                }, 'Použiť filter'),
                React.createElement('button', {
                    className: 'px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600',
                    onClick: handleClear
                }, 'Vymazať filter')
            )
        )
    );
}

// CollapsibleSection Component - pre rozbaľovacie sekcie
function CollapsibleSection({ title, children, isOpen: isOpenProp, onToggle, defaultOpen = false, noOuterStyles = false, actionElement = null }) {
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
  // ZMENA: Triedy pre hlavičku už nie sú pre tlačidlo
  const headerClasses = noOuterStyles ?
    'flex justify-between items-center w-full px-4 py-2 text-left bg-transparent' :
    'flex justify-between items-center w-full px-4 py-2 text-left bg-gray-50 rounded-t-lg';
  const contentDivClasses = noOuterStyles ? 'p-2' : 'p-4 border-t border-gray-200';

  return React.createElement(
    'div',
    { className: outerDivClasses },
    React.createElement(
      'div', // ZMENA: Zmenené z 'button' na 'div'
      {
        className: headerClasses, // Použitie nových tried hlavičky
      },
      // ZMENA: Šípka je teraz jediný klikateľný element na prepínanie
      React.createElement('span', {
        className: 'text-gray-500 mr-2 cursor-pointer p-1 rounded-full hover:bg-gray-200 focus:outline-none', // Pridaný cursor-pointer a štýly pre interaktivitu
        onClick: handleToggle // Iba tento element spracúva prepínanie
      }, currentIsOpen ? '▲' : '▼'),
      actionElement && React.createElement('div', { className: 'flex-shrink-0 mr-2' }, actionElement), // Editovacie tlačidlo tímu, už má stopPropagation
      typeof title === 'string' ? React.createElement('span', { className: 'font-semibold text-gray-700 flex-grow' }, title) : React.createElement('div', { className: 'flex-grow' }, title) // Názov je len na zobrazenie
    )
    ,
    currentIsOpen && React.createElement(
      'div',
      { className: contentDivClasses },
      children
    )
  );
}

// Helper function to get nested values from an object
const getNestedValue = (obj, path) => {
    const pathParts = path.split('.');
    let current = obj;
    for (const part of pathParts) {
        if (current === undefined || current === null) {
            return undefined; // Just return undefined if any part is null/undefined
        }
        const arrayMatch = part.match(/^(.*?)\[(\d+)\]$/);
        if (arrayMatch) {
            const arrayKey = arrayMatch[1];
            const arrayIndex = parseInt(arrayMatch[2]);
            current = (current && Array.isArray(current[arrayKey]) && current[arrayKey][arrayIndex] !== undefined)
                ? current[arrayKey][arrayIndex] : undefined;
        } else {
            current = (current && current[part] !== undefined) ? current[part] : undefined;
        }
        if (current === undefined) break;
    }
    return current; // Return the raw value, let caller normalize
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

const formatArrivalTime = (type, time) => {
    if (type) {
        return time ? `${type} (${time} hod.)` : type;
    }
    return '-';
};


const generateTeamHeaderTitle = (team, availableTshirtSizes, forCollapsibleSection = false, showUsersChecked = false, showTeamsChecked = false) => {
    const menTeamMembersCount = team._menTeamMembersCount !== undefined ? team._menTeamMembersCount : 0;
    const womenTeamMembersCount = team._womenTeamMembersCount !== undefined ? team._womenTeamMembersCount : 0;
    const menDriversCount = team._menDriversCount !== undefined ? team._menDriversCount : 0; 
    const womenDriversCount = team._womenDriversCount !== undefined ? team._womenDriversCount : 0; 
    const playersCount = team._players !== undefined ? team._players : 0;

    const titleParts = [];

    if (forCollapsibleSection || (showUsersChecked && showTeamsChecked)) {
        titleParts.push(React.createElement('span', { className: 'font-semibold text-gray-900 mr-2 whitespace-nowrap' }, `Kategória: ${team._category || '-'}`));
        titleParts.push(React.createElement('span', { className: 'text-gray-700 mr-4 whitespace-nowrap' }, `Názov tímu: ${team.teamName || `Tím`}`));
        titleParts.push(React.createElement('span', { className: 'text-gray-600 mr-2 whitespace-nowrap' }, `Hráči: ${playersCount}`));
        titleParts.push(React.createElement('span', { className: 'text-gray-600 mr-2 whitespace-nowrap' }, `R. tím (ž): ${womenTeamMembersCount}`));
        titleParts.push(React.createElement('span', { className: 'text-gray-600 mr-2 whitespace-nowrap' }, `R. tím (m): ${menTeamMembersCount}`));
        titleParts.push(React.createElement('span', { className: 'text-gray-600 mr-2 whitespace-nowrap' }, `Šofér (ž): ${womenDriversCount}`)); 
        titleParts.push(React.createElement('span', { className: 'text-gray-600 mr-2 whitespace-nowrap' }, `Šofér (m): ${menDriversCount}`));
        titleParts.push(React.createElement('span', { className: 'text-gray-600 mr-2 whitespace-nowrap' }, `Spolu: ${playersCount + womenTeamMembersCount + menTeamMembersCount + womenDriversCount + menDriversCount}`));
        titleParts.push(React.createElement('span', { className: 'text-gray-600 mr-2 whitespace-nowrap' }, `Doprava: ${formatArrivalTime(team.arrival?.type, team.arrival?.time)}`));
        titleParts.push(React.createElement('span', { className: 'text-gray-600 mr-2 whitespace-nowrap' }, `Ubytovanie: ${team.accommodation?.type || '-'}`));
        titleParts.push(React.createElement('span', { className: 'text-gray-600 mr-2 whitespace-nowrap' }, `Balík: ${team.packageDetails?.name || '-'}`));
        
        const teamTshirtsMap = team._teamTshirtsMap || new Map();
        const tshirtDataWithLabels = (availableTshirtSizes && availableTshirtSizes.length > 0 ? availableTshirtSizes : ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']).map(size => {
            const quantity = teamTshirtsMap.get(size) || 0;
            return React.createElement('span', {
                key: `tshirt-summary-label-${size}`,
                className: `text-gray-600 mr-2 inline-block whitespace-nowrap`
            }, `${size.toUpperCase()}: ${quantity > 0 ? quantity : '-'}`);
        });
        titleParts.push(...tshirtDataWithLabels);

    } else {
        titleParts.push(React.createElement('span', { className: 'font-semibold text-gray-900 mr-2 whitespace-nowrap' }, team._category || '-'));
        titleParts.push(React.createElement('span', { className: 'text-gray-700 mr-4 whitespace-nowrap' }, team.teamName || `Tím`));
        titleParts.push(React.createElement('span', { className: 'text-gray-600 hidden sm:inline mr-2 whitespace-nowrap' }, playersCount));
        titleParts.push(React.createElement('span', { className: 'text-gray-600 hidden md:inline mr-2 whitespace-nowrap' }, womenTeamMembersCount));
        titleParts.push(React.createElement('span', { className: 'text-gray-600 hidden lg:inline mr-2 whitespace-nowrap' }, menTeamMembersCount));
        titleParts.push(React.createElement('span', { className: 'text-gray-600 hidden xl:inline mr-2 whitespace-nowrap' }, womenDriversCount)); 
        titleParts.push(React.createElement('span', { className: 'text-gray-600 hidden 2xl:inline mr-2 whitespace-nowrap' }, menDriversCount)); 
        titleParts.push(React.createElement('span', { className: 'text-gray-600 hidden 2xl:inline mr-2 whitespace-nowrap' }, playersCount + womenTeamMembersCount + menTeamMembersCount + womenDriversCount + menDriversCount)); 
        titleParts.push(React.createElement('span', { className: 'text-gray-600 hidden 3xl:inline mr-2 whitespace-nowrap' }, formatArrivalTime(team.arrival?.type, team.arrival?.time)));
        titleParts.push(React.createElement('span', { className: 'text-gray-600 hidden 4xl:inline mr-2 whitespace-nowrap' }, team.accommodation?.type || '-'));
        titleParts.push(React.createElement('span', { className: 'text-gray-600 hidden 5xl:inline mr-2 whitespace-nowrap' }, team.packageDetails?.name || '-')); 
        titleParts.push(...getTshirtSpans(team, availableTshirtSizes));
    }

    return React.createElement(
        'div',
        { className: 'flex flex-wrap items-center justify-between w-full' },
        ...titleParts
    );
};


// Pomocná funkcia na overenie, či je kľúč vo formáte dátumu YYYY-MM-DD
const isDateKey = (key) => {
    return /^\d{4}-\d{2}-\d{2}$/.test(key);
};

// Formátovanie dátumu na DD. MM. RRRR
const formatDateToDMMYYYY = (dateString) => {
    if (!dateString) return '-';
    // Handle Firebase Timestamp objects
    if (dateString && typeof dateString.toDate === 'function') {
        const date = dateString.toDate();
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${day}. ${month}. ${year}`;
    }
    // Handle plain date strings (e.g., YYYY-MM-DD)
    const [year, month, day] = dateString.split('-');
    if (year && month && day) {
        return `${day}. ${month}. ${year}`;
    }
    return dateString;
};


// TeamDetailsContent Component - zobrazuje len vnútorné detaily jedného tímu (bez vonkajšieho CollapsibleSection)
function TeamDetailsContent({ team, tshirtSizeOrder, showDetailsAsCollapsible, showUsersChecked, showTeamsChecked, openEditModal, db, setUserNotificationMessage, onAddMember }) {
    if (!team) {
        return React.createElement('div', { className: 'text-gray-600 p-4' }, 'Žiadne tímové registrácie.');
    }

    // Moved definitions to the top of the component
    const allConsolidatedMembers = [];

    if (team.playerDetails && team.playerDetails.length > 0) {
        team.playerDetails.forEach((player, index) => {
            allConsolidatedMembers.push({
                ...player,
                type: 'Hráč',
                originalArray: 'playerDetails',
                originalIndex: index,
                uniqueId: `${team.teamName}-player-${player.firstName || ''}-${player.lastName || ''}-${index}`
            });
        });
    }
    if (team.menTeamMemberDetails && team.menTeamMemberDetails.length > 0) {
        team.menTeamMemberDetails.forEach((member, index) => {
            allConsolidatedMembers.push({
                ...member,
                type: 'Člen realizačného tímu (muž)',
                originalArray: 'menTeamMemberDetails',
                originalIndex: index,
                uniqueId: `${team.teamName}-menstaff-${member.firstName || ''}-${member.lastName || ''}-${index}`
            });
        });
    };
    if (team.womenTeamMemberDetails && team.womenTeamMemberDetails.length > 0) {
        team.womenTeamMemberDetails.forEach((member, index) => {
            allConsolidatedMembers.push({
                ...member,
                type: 'Člen realizačného tímu (žena)',
                originalArray: 'womenTeamMemberDetails',
                originalIndex: index,
                uniqueId: `${team.teamName}-womenstaff-${member.firstName || ''}-${member.lastName || ''}-${index}`
            });
        });
    }
    // Pridanie šoféra muža, ak existuje a je to pole
    if (Array.isArray(team.driverDetailsMale) && team.driverDetailsMale.length > 0) {
        team.driverDetailsMale.forEach((driver, index) => {
            allConsolidatedMembers.push({
                ...driver,
                type: 'Šofér (muž)',
                originalArray: 'driverDetailsMale',
                originalIndex: index, // Použiť index, lebo je to pole
                uniqueId: `${team.teamName}-driver-male-${driver.firstName || ''}-${driver.lastName || ''}-${index}`
            });
        });
    }
    // Pridanie šoféra ženy, ak existuje a je to pole
    if (Array.isArray(team.driverDetailsFemale) && team.driverDetailsFemale.length > 0) {
        team.driverDetailsFemale.forEach((driver, index) => {
            allConsolidatedMembers.push({
                ...driver,
                type: 'Šofér (žena)',
                originalArray: 'driverDetailsFemale',
                originalIndex: index, // Použiť index, lebo je to pole
                uniqueId: `${team.teamName}-driver-female-${driver.firstName || ''}-${driver.lastName || ''}-${index}`
            });
        });
    }

    // Filtrujeme kľúče, aby sme sa uistili, že sú to platné dátumy jedál
    const mealDates = (team.packageDetails && team.packageDetails.meals ? Object.keys(team.packageDetails.meals).sort() : [])
        .filter(key => isDateKey(key)); // Používame novú pomocnú funkciu
    
    const mealTypes = ['breakfast', 'lunch', 'dinner', 'refreshment'];
    const mealTypeLabels = {
        breakfast: 'Raňajky',
        lunch: 'Obed',
        dinner: 'Večera',
        refreshment: 'Občerstvenie'
    };


    const formatAddress = (member) => { // Zmenený názov z 'address' na 'member' pre väčšiu prehľadnosť
        if (!member) return '-';

        let addressData = member;
        // Ak existuje vnorený objekt 'address', použiť ho
        if (member.address && typeof member.address === 'object') {
            addressData = member.address;
        }

        const street = addressData.street || '';
        const houseNumber = addressData.houseNumber || '';
        const postalCode = formatPostalCodeForDisplay(addressData.postalCode);
        const city = addressData.city || '';
        const country = addressData.country || '';

        // Odstrániť prebytočné čiarky a medzery
        const parts = [
            `${street} ${houseNumber}`.trim(),
            `${postalCode} ${city}`.trim(),
            country.trim()
        ].filter(p => p !== ''); // Odstrániť prázdne časti

        return parts.join(', ');
    };
                
    const handleMealChange = async (member, date, mealType, isChecked) => {
        if (!db || !team._userId) {
            setUserNotificationMessage("Chyba: Databáza nie je pripojená alebo chýba ID používateľa tímu.", 'error');
            return;
        }

        window.showGlobalLoader();

        try {
            const userDocRef = doc(db, 'users', team._userId);
            const docSnapshot = await getDoc(userDocRef); // Fetch the entire user document

            if (!docSnapshot.exists()) {
                throw new Error("Používateľský dokument sa nenašiel.");
            }

            const userData = docSnapshot.data();
            const teamsData = { ...userData.teams }; // Create a mutable copy of the teams object

            const teamCategory = team._category;
            const teamIndex = team._teamIndex;
            const memberArrayType = member.originalArray;
            const memberIndex = member.originalIndex;

            // Deep clone the relevant parts to ensure immutability until update
            const updatedCategoryTeams = JSON.parse(JSON.stringify(teamsData[teamCategory] || []));
            const teamToUpdate = updatedCategoryTeams[teamIndex];

            if (!teamToUpdate) {
                throw new Error("Tím sa nenašiel pre aktualizáciu stravovania.");
            }

            const memberArrayToUpdate = teamToUpdate[memberArrayType];

            if (!memberArrayToUpdate || memberArrayToUpdate[memberIndex] === undefined) {
                throw new Error("Člen tímu sa nenašiel pre aktualizáciu stravovania.");
            }

            const memberToUpdate = memberArrayToUpdate[memberIndex];

            // --- Notification Logic - Capture original value before modification ---
            const userEmail = window.auth.currentUser?.email;
            const changes = [];
            const originalMealValue = memberToUpdate.packageDetails?.meals?.[date]?.[mealType] === 1 ? 'Áno' : 'Nie';
            const newMealValue = isChecked ? 'Áno' : 'Nie';

            if (originalMealValue !== newMealValue) {
                const memberName = `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Bez mena';
                const teamName = team.teamName || 'Bez názvu';
                changes.push(`Zmena stravovania pre ${memberName} (Tím: ${teamName}, ${teamCategory})`);
                changes.push(`  • ${formatDateToDMMYYYY(date)}, ${mealTypeLabels[mealType]}: z '${originalMealValue}' na '${newMealValue}'`);
            }
            // --- End Notification Logic ---

            // Ensure packageDetails.meals and packageDetails.meals[date] exist
            if (!memberToUpdate.packageDetails) memberToUpdate.packageDetails = {};
            if (!memberToUpdate.packageDetails.meals) memberToUpdate.packageDetails.meals = {};
            if (!memberToUpdate.packageDetails.meals[date]) memberToUpdate.packageDetails.meals[date] = {};

            // Update the specific meal type for the member
            memberToUpdate.packageDetails.meals[date][mealType] = isChecked ? 1 : 0;

            // Reconstruct the full path and update only the top-level array
            // The path for updateDoc should be a valid top-level field or a nested map field, not an array element with index.
            // We are updating the entire array for the specific category.
            const updatePayload = {
                [`teams.${teamCategory}`]: updatedCategoryTeams
            };

            await updateDoc(userDocRef, updatePayload);
            setUserNotificationMessage(`Stravovanie pre ${member.firstName} ${member.lastName} bolo aktualizované.`, 'success');

            // --- Save Notification to Firestore ---
            if (changes.length > 0 && userEmail) {
                const notificationsCollectionRef = collection(db, 'notifications');
                await addDoc(notificationsCollectionRef, {
                    userEmail,
                    changes,
                    timestamp: serverTimestamp()
                });
                console.log("Notifikácia o zmene stravovania uložená do Firestore.");
            }
            // --- End Save Notification ---

        } catch (error) {
            console.error("Chyba pri aktualizácii stravovania v Firestore:", error);
            setUserNotificationMessage(`Chyba pri aktualizácii stravovania: ${error.message}`, 'error');
        } finally {
            window.hideGlobalLoader();
        }
    };

    const teamDetailsTable = React.createElement(
        'div',
        { className: 'overflow-x-hidden' },
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
                    // Hlavičky stĺpcov pre jedlo sa generujú len pre platné dátumy
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
                        {
                            key: member.uniqueId,
                            className: 'hover:bg-gray-50',
                        },
                        React.createElement('td', { className: 'px-4 py-2 whitespace-nowrap min-w-max' },
                            React.createElement('button', {
                                onClick: (e) => {
                                    e.stopPropagation();
                                    const targetDocRefForMember = doc(db, 'users', team._userId);
                                    let memberPathForSaving = '';
                                    if (member.originalArray && member.originalIndex !== undefined && member.originalIndex !== -1) {
                                        // Ak je to pole, pridáme aj index
                                        memberPathForSaving = `teams.${team._category}[${team._teamIndex}].${member.originalArray}[${member.originalIndex}]`;
                                    } else if (member.originalArray) {
                                        // Ak je to objekt a nie pole (čo by nemalo nastať pri šoféroch, ale pre istotu)
                                        memberPathForSaving = `teams.${team._category}[${team._teamIndex}].${member.originalArray}`;
                                    }
                                    const resolvedTitle = `Upraviť ${member.type}: ${member.firstName || ''} ${member.lastName || ''}`;
                                    
                                    openEditModal(
                                        member,
                                        resolvedTitle,
                                        targetDocRefForMember,
                                        memberPathForSaving
                                    );
                                },
                                className: 'text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-200 focus:outline-none mr-2'
                            }, '⚙️'),
                            member.type || '-'
                        ),
                        React.createElement('td', { className: 'px-4 py-2 whitespace-nowrap min-w-max' }, member.firstName || '-'),
                        React.createElement('td', { className: 'px-4 py-2 whitespace-nowrap min-w-max' }, member.lastName || '-'),
                        React.createElement('td', { className: 'px-4 py-2 whitespace-nowrap min-w-max' }, formatDateToDMMYYYY(member.dateOfBirth)),
                        React.createElement('td', { className: 'px-4 py-2 whitespace-nowrap min-w-max' }, member.jerseyNumber || '-'),
                        React.createElement('td', { className: 'px-4 py-2 whitespace-nowrap min-w-max' }, member.registrationNumber || '-'),
                        React.createElement('td', { className: 'px-4 py-2 whitespace-nowrap min-w-max' }, formatAddress(member)),
                        // Bunky s jedlom sa generujú len pre platné dátumy
                        mealDates.map(date =>
                            React.createElement('td', { key: `${member.uniqueId}-${date}-meals`, colSpan: 4, className: 'px-4 py-2 text-center border-l border-gray-200 whitespace-nowrap min-w-max' },
                                React.createElement(
                                    'div',
                                    { className: 'flex justify-around' },
                                    mealTypes.map(type => {
                                        // Získať stav z individuálneho nastavenia člena (ak existuje)
                                        const memberMealSetting = member.packageDetails?.meals?.[date]?.[type];
                                        // Získať stav z balíka tímu (ak existuje)
                                        const teamPackageMealSetting = team.packageDetails?.meals?.[date]?.[type];

                                        // Predvolený stav:
                                        // 1. Ak existuje individuálne nastavenie člena (nie je undefined), použiť to.
                                        // 2. Inak, ak existuje nastavenie z balíka, použiť to.
                                        // 3. Inak, predvolene false (0).
                                        const isChecked = (memberMealSetting !== undefined)
                                            ? (memberMealSetting === 1)
                                            : (teamPackageMealSetting === 1);

                                        return React.createElement('input', {
                                                            key: `${member.uniqueId}-${date}-${type}-checkbox`,
                                                            type: 'checkbox',
                                                            checked: isChecked,
                                                            onChange: (e) => handleMealChange(member, date, type, e.target.checked),
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

    // Create the edit button for the team itself
    const teamEditButtonElement = React.createElement('button', {
        onClick: (e) => {
            e.stopPropagation(); // Prevent the collapsible section from toggling
            const targetDocRefForTeam = doc(db, 'users', team._userId);
            const teamPathForSaving = `teams.${team._category}[${team._teamIndex}]`;
            const resolvedTitle = `Upraviť tím: ${team.teamName}`;

            openEditModal(
                team,
                resolvedTitle,
                targetDocRefForTeam,
                teamPathForSaving
            );
        },
        className: 'text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-200 focus:outline-none'
    }, '⚙️');


    if (showDetailsAsCollapsible) {
        return React.createElement(
            CollapsibleSection,
            {
                title: collapsibleSectionTitle,
                defaultOpen: false,
                actionElement: teamEditButtonElement
            },
            teamDetailsTable,
            React.createElement('div', { className: 'flex justify-center mt-4' },
                React.createElement('button', {
                    className: 'w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center text-2xl font-bold hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50',
                    onClick: (e) => {
                        e.stopPropagation(); // Zabrániť prepínaniu sekcie
                        onAddMember(team); // Zavolať funkciu na pridanie člena pre konkrétny tím
                    }
                }, '+')
            )
        );
    } else {
        const shouldShowHeader = showUsersChecked || !showTeamsChecked;
        return React.createElement(
            'div',
            { className: 'p-4 pt-0 bg-gray-50 rounded-lg' },
            shouldShowHeader && React.createElement('h3', { className: 'font-semibold text-gray-700 mb-2' }, 'Detaily členov tímu a stravovanie'),
            teamDetailsTable,
            React.createElement('div', { className: 'flex justify-center mt-4' },
                React.createElement('button', {
                    className: 'w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center text-2xl font-bold hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50',
                    onClick: (e) => {
                        e.stopPropagation(); // Zabrániť prepínaniu sekcie
                        onAddMember(team); // Zavolať funkciu na pridanie člena pre konkrétny tím
                    }
                }, '+')
            )
        );
    }
}

// Pomocné funkcie pre spracovanie telefónneho čísla
const parsePhoneNumber = (fullPhoneNumber, dialCodes) => {
    let bestMatchDialCode = '';
    let numberWithoutDialCode = String(fullPhoneNumber || '').replace(/\D/g, ''); // Odstrániť nečíselné znaky

    // Zoradiť predvoľby zostupne podľa dĺžky pre správne priradenie najdlhšej zhody
    const sortedDialCodes = [...dialCodes].sort((a, b) => b.dialCode.length - a.dialCode.length);

    for (const country of sortedDialCodes) {
        const cleanDialCode = country.dialCode.replace('+', '');
        if (numberWithoutDialCode.startsWith(cleanDialCode)) {
            bestMatchDialCode = country.dialCode;
            numberWithoutDialCode = numberWithoutDialCode.substring(cleanDialCode.length);
            break;
        }
    }

    const defaultDialCode = dialCodes.find(c => c.code === 'SK')?.dialCode || (dialCodes.length > 0 ? dialCodes[0].dialCode : '');

    return {
        dialCode: bestMatchDialCode || defaultDialCode,
        numberWithoutDialCode: numberWithoutDialCode
    };
};

const formatNumberGroups = (numberString) => {
    if (!numberString) return '';
    return numberString.replace(/\D/g, '').replace(/(\d{3})(?=\d)/g, '$1 '); // Odstrániť nečíselné a rozdeliť
};

const combinePhoneNumber = (dialCode, numberWithoutDialCode) => {
    const cleanDialCode = String(dialCode || '').replace(/\D/g, '');
    const cleanNumber = String(numberWithoutDialCode || '').replace(/\D/g, '');
    if (cleanDialCode && cleanNumber) {
        return `+${cleanDialCode}${cleanNumber}`;
    } else if (cleanNumber) {
        return cleanNumber;
    }
    return '';
};

// Helper to format keys for labels
const formatLabel = (key) => {
    let label = key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .replace(/\./g, ' ')
        .trim()
        .replace(' (Fakturácia)', ''); 

    if (key === 'billing.clubName') return 'Názov klubu';
    if (key === 'billing.ico') return 'IČO';
    if (key === 'billing.dic') return 'DIČ';
    if (key === 'billing.icDph') return 'IČ DPH';
    if (key === 'accommodation.type'  || key === 'accommodation') return 'Typ ubytovania';
    if (key === 'arrival.type' || key === 'arrival') return 'Typ dopravy';
    if (key === 'packageDetails.name' || key === 'packageDetails') return 'Názov balíka';
    if (key === 'packageDetails.meals') return 'Stravovanie';
    if (key === 'teamName') return 'Názov tímu';
    if (key === 'playerDetails') return 'Detaily hráčov';
    if (key === 'menTeamMemberDetails') return 'Detail člen realizačného tímu (muž)';
    if (key === 'womenTeamMemberDetails') return 'Detail člen realizačného tímu (žena)';
    if (key === 'driverDetailsMale') return 'Detaily šoféra (muž)'; 
    if (key === 'driverDetailsFemale') return 'Detaily šoféra (žena)'; 
    if (key === 'tshirts') return 'Tričká';
    if (key === 'registrationDate') return 'Dátum registrácie';
    if (key === 'dateOfBirth') return 'Dátum narodenia';
    if (key === 'address.street') return 'Ulica';
    if (key === 'address.houseNumber') return 'Popisné číslo';
    if (key === 'address.postalCode') return 'PSČ';
    if (key === 'address.city') return 'Mesto/Obec';
    if (key === 'address.country') return 'Krajina';
    if (key === 'street') return 'Ulica';
    if (key === 'houseNumber') return 'Popisné číslo';
    if (key === 'city') return 'Mesto/Obec';
    if (key === 'postalCode') return 'PSČ';
    if (key === 'country') return 'Krajina';
    if (key === 'approved') return 'Schválený';
    if (key === 'email') return 'E-mail';
    if (key === 'contactPhoneNumber') return 'Telefónne číslo';
    if (key === 'passwordLastChanged') return 'Dátum poslednej zmeny hesla';
    if (key === 'password') return 'Heslo';
    if (key === 'role') return 'Rola';
    if (key === 'firstName') return 'Meno';
    if (key === 'lastName') return 'Priezvisko';
    if (key === 'displayNotifications') return 'Zobrazovať notifikácie';
    if (key === 'isMenuToggled') return 'Prepínač menu';
    if (key === 'note') return 'Poznámka';
    if (key === '_category' || key === 'category') return 'Kategória tímu'; 
    if (key === 'jerseyNumber') return 'Číslo dresu';
    if (key === 'registrationNumber') return 'Číslo registrácie';
    if (key === 'time') return 'Čas príchodu'; 
  
    return label;
};

// Pomocná funkcia na porovnávanie zmien pre notifikácie
// Pomocná funkcia na porovnávanie zmien pre notifikácie
const getChangesForNotification = (original, updated, formatDateFn) => {
    const changes = [];
    
    // Keys that should NEVER trigger a notification
    const universallyIgnoredKeys = new Set([
        '_userId', '_teamIndex', '_registeredBy', '_menTeamMembersCount',
        '_womenTeamMembersCount', '_menDriversCount', '_womenDriversCount', '_players',
        '_teamTshirtsMap', 'id', 'uniqueId', 'type', 'originalArray', 'originalIndex',
        'password', 'emailVerified', 'isMenuToggled', 'role', 'approved',
        'registrationDate', 'passwordLastChanged', 'teams', 'categories', 'timestamp',
        'note'
    ]);

    const normalizeValueForComparison = (value, path) => {
        if (value === null || value === undefined) return '';

        // ─── ŠPECIÁLNE SPRACOVANIE DÁTUMOV ───────────────────────────────
        // Ak obsahuje "dateofbirth" alebo "registrationdate" v ceste → formátujeme
        const lowerPath = path.toLowerCase();
        const isDateField = 
            lowerPath.includes('dateofbirth') || 
            lowerPath.includes('registrationdate') ||
            lowerPath.includes('date'); // prípadne iné dátumové polia

        if (isDateField) {
            // Firebase Timestamp
            if (value && typeof value.toDate === 'function') {
                return formatDateFn(value.toDate());           // ← tu používame DD.MM.RRRR
            }
            // Plain string YYYY-MM-DD
            if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
                return formatDateFn(value);                    // ← tu používame DD.MM.RRRR
            }
            // Iný formát → ponecháme ako string
            return String(value);
        }

        // ─── Zvyšok pôvodnej logiky ──────────────────────────────────────
        if (value && typeof value.toDate === 'function') {
            return value.toDate().toISOString();
        }
        if (typeof value === 'object' && !Array.isArray(value)) {
            if (path === 'arrival' && value.type) {
                return formatArrivalTime(value.type, value.time);
            }
            if (value.type) return value.type;
            if (value.name) return value.name;
            try {
                return JSON.stringify(value);
            } catch (e) {
                return '[OBJECT_ERROR]';
            }
        }
        return String(value);
    };

    const compareObjects = (origObj, updObj, pathPrefix = '') => {
        const nestedKeys = new Set([...Object.keys(origObj || {}), ...Object.keys(updObj || {})]);
        for (const key of nestedKeys) {
            const currentPath = pathPrefix ? `${pathPrefix}.${key}` : key;
            if (universallyIgnoredKeys.has(key)) continue;

            const origValue = origObj ? origObj[key] : undefined;
            const updValue = updObj ? updObj[key] : undefined;

            const isOrigObject = typeof origValue === 'object' && origValue !== null && !Array.isArray(origValue) && !(origValue.toDate && typeof origValue.toDate === 'function');
            const isUpdObject = typeof updValue === 'object' && updValue !== null && !Array.isArray(updValue) && !(updValue.toDate && typeof updValue.toDate === 'function');

            if (isOrigObject && isUpdObject) {
                compareObjects(origValue, updValue, currentPath);
                continue;
            }

            // špeciálne spracovanie tričiek
            if (currentPath === 'tshirts') {
                const originalTshirtsMap = new Map((origValue || []).map(t => [String(t.size).trim(), t.quantity || 0]));
                const updatedTshirtsMap = new Map((updValue || []).map(t => [String(t.size).trim(), t.quantity || 0]));
                const allSizes = new Set([...Array.from(originalTshirtsMap.keys()), ...Array.from(updatedTshirtsMap.keys())]);
                for (const size of allSizes) {
                    const oldQ = originalTshirtsMap.get(size) || 0;
                    const newQ = updatedTshirtsMap.get(size) || 0;
                    if (oldQ !== newQ) {
                        if (oldQ === 0) {
                            changes.push(`Pridané tričko (${size}): ${newQ}`);
                        } else if (newQ === 0) {
                            changes.push(`Odstránené tričko (${size}): ${oldQ}`);
                        } else {
                            changes.push(`Zmena tričiek: ${size} z '${oldQ}' na '${newQ}'`);
                        }
                    }
                }
                continue;
            }

            const valueA = normalizeValueForComparison(origValue, currentPath);
            const valueB = normalizeValueForComparison(updValue, currentPath);

            if (valueA !== valueB) {
                const label = formatLabel(currentPath);
                let changeDescription = `Zmena ${label}: z '${valueA || '-'}' na '${valueB || '-'}'`;
                if (!changes.includes(changeDescription)) {
                    changes.push(changeDescription);
                }
            }
        }
    };

    compareObjects(original, updated);

    // arrival špeciálne (pôvodná logika)
    const originalArrival = formatArrivalTime(original?.arrival?.type, original?.arrival?.time);
    const updatedArrival = formatArrivalTime(updated?.arrival?.type, updated?.arrival?.time);

    if (originalArrival !== updatedArrival) {
      changes.push(`Zmena dopravy: z '${originalArrival}' na '${updatedArrival}'`);
    }

    return changes;
};

// Helper to format values for display in input fields
const formatDisplayValue = (value, path) => { 
    if (value === null || value === undefined) return '';
    if (typeof value === 'boolean') return value ? 'Áno' : 'Nie';
    
    let date;
    // Ak je to dátum narodenia (firstName, lastName, dateOfBirth atď. sú v core data), vráti YYYY-MM-DD formát
    if (path.toLowerCase().includes('dateofbirth') && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value; 
    }
    if (value && typeof value === 'object' && value.seconds !== undefined && value.nanoseconds !== undefined) {
         if (typeof value.toDate === 'function') { 
            date = value.toDate();
        } else { 
            date = new Date(value.seconds * 1000 + value.nanoseconds / 1000000);
        }
        try {
            const options = {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            };
            return date.toLocaleString('sk-SK', options);
        } catch (e) {
            console.error("Chyba pri formátovaní Timestamp:", value, e);
            return `[Chyba Timestamp: ${e.message}]`; 
        }
    }
    
    if (Array.isArray(value)) {
        return value.map(item => {
            if (typeof item === 'object' && item !== null) {
                try {
                    // Special handling for t-shirt objects
                    if (item.size && item.quantity !== undefined) {
                        return `${item.size}: ${item.quantity}`;
                    }
                    // For other complex objects in arrays, provide a simplified representation
                    if (item.firstName && item.lastName) return `${item.firstName} ${item.lastName}`;
                    return JSON.stringify(item);
                } catch (e) {
                    console.error("Chyba pri prevode objektu poľa na reťazec:", item, e);
                    return '[Chyba objektu]';
                }
            }
            return String(item);
        }).join(', ');
    }
    
    if (typeof value === 'object') {
        if (value.name || value.type) { 
            return value.name || value.type;
        }
        try {
            return JSON.stringify(value);
        } catch (e) {
            console.error("Chyba pri prevode objektu na reťazec:", value, e);
            return '[Chyba objektu]'; 
        }
    }
    
    return String(value); 
};


// Generic DataEditModal Component pre zobrazovanie/úpravu JSON dát
function DataEditModal({ isOpen, onClose, title, data, onSave, onDeleteMember, onDeleteTeam, targetDocRef, originalDataPath, setUserNotificationMessage, setError, isNewEntry, getChangesForNotification: getChangesForNotification, formatDateToDMMYYYY: formatDateToDMMYYYY, currentUserId, editModalTitle }) { // Pridané editModalTitle
    const modalRef = React.useRef(null);
    const db = window.db; // Prístup k db z window objektu
    const [localEditedData, setLocalEditedData] = React.useState(data);
    const [userRole, setUserRole] = React.useState('');
    const [isTargetUserAdmin, setIsTargetUserAdmin] = React.useState(false); 
    const [isTargetUserHall, setIsTargetUserHall] = React.useState(false); // Opravený preklep z setIsTargetMuserHall na setIsTargetUserHall
    const inputRefs = React.useRef({}); 

    // Stavy pre Phone Input
    const [displayDialCode, setDisplayDialCode] = React.useState('');
    const [displayPhoneNumber, setDisplayPhoneNumber] = React.useState('');
    const [isDialCodeModalOpen, setIsDialCodeModalOpen] = React.useState(false);

    // Stavy pre kategórie tímov
    const [categories, setCategories] = React.useState([]);
    const [selectedCategory, setSelectedCategory] = React.useState('');

    // Stavy pre typ dopravy
    const [selectedArrivalType, setSelectedArrivalType] = React.useState('');
    const [arrivalTime, setArrivalTime] = React.useState(''); // Nový stav pre čas príchodu
    const arrivalOptions = [
        'verejná doprava - vlak',
        'verejná doprava - autobus',
        'vlastná doprava',
        'bez dopravy'
    ];

    // Stavy pre typ ubytovania
    const [accommodationTypes, setAccommodationTypes] = React.useState([]);
    const [selectedAccommodationType, setSelectedAccommodationType] = React.useState('');
    // Pridanie predvolenej možnosti "bez ubytovania" do lokálnych možností
    const accommodationOptionsWithNone = React.useMemo(() => {
        return ['bez ubytovania', ...accommodationTypes];
    }, [accommodationTypes]);


    // Stavy pre balíky
    const [packages, setPackages] = React.useState([]);
    const [selectedPackageName, setSelectedPackageName] = React.useState('');

    // Stavy pre tričká
    const [availableTshirtSizes, setAvailableTshirtSizes] = React.useState([]);
    // Zmenené teamTshirts na pole objektov, každý s tempId pre React kľúče
    const [teamTshirts, setTeamTshirts] = React.useState([]); // [{ tempId: 'uuid', size: 'S', quantity: 5 }]

    // Stavy pre potvrdenie odstránenia člena
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = React.useState(false);
    const [deleteConfirmMessage, setDeleteConfirmMessage] = React.useState('');

    // Nové stavy pre potvrdenie odstránenia tímu
    const [isConfirmDeleteTeamOpen, setIsConfirmDeleteTeamOpen] = React.useState(false);
    const [deleteTeamConfirmMessage, setDeleteTeamConfirmMessage] = React.useState('');


    // Utility to generate a unique ID for new t-shirt entries
    const generateUniqueId = () => Math.random().toString(36).substring(2, 9);

    React.useEffect(() => {
        if (!isOpen) {
            // Modal sa práve zatvoril → vyčistíme aj potvrdenia vymazania
            setIsConfirmDeleteOpen(false);
            setDeleteConfirmMessage('');
            setIsConfirmDeleteTeamOpen(false);
            setDeleteTeamConfirmMessage('');
        }
    }, [isOpen]);    

    React.useEffect(() => {
        if (isOpen) {
            // Keď sa otvorí nové edit modal → istota, že potvrdenia sú zatvorené
            setIsConfirmDeleteOpen(false);
            setIsConfirmDeleteTeamOpen(false);
        }
    }, [isOpen]);
    
    React.useEffect(() => {
        const fetchTeamDataForSelects = async () => {
            if (db && (title.includes('Upraviť tím') || title.includes('Pridať nový tím'))) { // Changed for Add team modal
                // Načítanie kategórií
                try {
                    const categoriesDocRef = doc(db, 'settings', 'categories');
                    const docSnapshot = await getDoc(categoriesDocRef);

                    if (docSnapshot.exists()) {
                        const categoriesData = docSnapshot.data();
                        const fetchedCategories = Object.values(categoriesData)
                            .filter(item => item && item.name)
                            .map(item => String(item.name).trim())
                            .sort();
                        setCategories(fetchedCategories);
                    } else {
                        console.warn("Firestore dokument 'settings/categories' neexistuje. Žiadne kategórie neboli načítané.");
                        setCategories([]);
                    }
                } catch (error) {
                    console.error("Chyba pri načítaní kategórií z Firestore:", error);
                }

                // Načítanie typov ubytovania
                try {
                    const accommodationDocRef = doc(db, 'settings', 'accommodation');
                    const docSnapshot = await getDoc(accommodationDocRef);

                    if (docSnapshot.exists()) {
                        const accommodationData = docSnapshot.data();
                        if (accommodationData && Array.isArray(accommodationData.types)) {
                            const fetchedAccommodationTypes = accommodationData.types
                                .map(item => String(item.type).trim())
                                .sort();
                            setAccommodationTypes(fetchedAccommodationTypes);
                        } else {
                            console.warn("Firestore dokument 'settings/accommodation' neobsahuje pole 'types' alebo má neočakávaný formát.");
                            setAccommodationTypes([]);
                        }
                    } else {
                        console.warn("Firestore dokument 'settings/accommodation' neexistuje. Žiadne typy ubytovania neboli načítané.");
                            setAccommodationTypes([]);
                    }
                } catch (error) {
                    console.error("Chyba pri načítaní typov ubytovania z Firestore:", error);
                }

                // Načítanie balíkov
                try {
                    const packagesCollectionRef = collection(db, 'settings', 'packages', 'list');
                    const querySnapshot = await getDocs(packagesCollectionRef);
                    const fetchedPackages = querySnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    setPackages(fetchedPackages);
                } catch (error) {
                    console.error("Chyba pri načítaní balíkov z Firestore:", error);
                    setPackages([]);
                }

                // Načítanie veľkostí tričiek
                try {
                    const sizeTshirtsDocRef = doc(db, 'settings', 'sizeTshirts');
                    const docSnapshot = await getDoc(sizeTshirtsDocRef);
                    if (docSnapshot.exists()) {
                        const data = docSnapshot.data();
                        if (data && Array.isArray(data.sizes)) {
                            setAvailableTshirtSizes(data.sizes.map(s => String(s).trim()));
                        } else {
                            console.warn("Firestore settings/sizeTshirts dokument neobsahuje pole 'sizes'.");
                        }
                    } else {
                        console.warn("Firestore settings/sizeTshirts dokument neexistuje.");
                    }
                } catch (error) {
                    console.error("Chyba pri načítaní veľkostí tričiek z Firestore:", error);
                }
            }
        };

        if (title.includes('Upraviť tím') || title.includes('Pridať nový tím')) { // Changed for Add team modal
            fetchTeamDataForSelects();
        }
    }, [db, title]);


    React.useEffect(() => {
        // Fetch user's role from window.globalUserProfileData safely
        let currentUserRole = '';
        if (window.globalUserProfileData && window.globalUserProfileData.role) {
            currentUserRole = window.globalUserProfileData.role;
        }
        setUserRole(currentUserRole);

        const safeData = data || {}; 
        const initialData = JSON.parse(JSON.stringify(safeData));

        const isUserBeingEditedAdmin = initialData.role === 'admin';
        const isUserBeingEditedHall = initialData.role === 'hall';
        
        setIsTargetUserAdmin(isUserBeingEditedAdmin);
        setIsTargetUserHall(isUserBeingEditedHall);

        // Ak sa upravuje admin alebo hall používateľ, odstráňte tieto polia, aby sa nezobrazovali a neukladali
        if (isUserBeingEditedAdmin || isUserBeingEditedHall) {
            delete initialData.billing;
            delete initialData.street;
            delete initialData.houseNumber;
            delete initialData.city;
            delete initialData.postalCode;
            delete initialData.country;
            delete initialData.note;
            delete initialData.contactPhoneNumber; // Tiež odstránime tel. číslo
            setDisplayDialCode(''); // Vyčistiť stavy tel. čísla
            setDisplayPhoneNumber('');
        }


        const isEditingMember = title.toLowerCase().includes('upraviť hráč') || 
                                title.toLowerCase().includes('upraviť člen realizačného tímu') || 
                                title.toLowerCase().includes('upraviť šofér');

        if (title.includes('Upraviť používateľa') && !(isUserBeingEditedAdmin || isUserBeingEditedHall)) { // Len pre bežných používateľov
            if (initialData.firstName === undefined) initialData.firstName = '';
            if (initialData.lastName === undefined) initialData.lastName = '';
            if (initialData.contactPhoneNumber === undefined) initialData.contactPhoneNumber = '';
            if (!initialData.billing) initialData.billing = {};
            if (initialData.billing.clubName === undefined) initialData.billing.clubName = '';
            if (initialData.billing.ico === undefined) initialData.billing.ico = '';
            if (initialData.billing.dic === undefined) initialData.billing.dic = '';
            if (initialData.billing.icDph === undefined) initialData.billing.icDph = '';
            if (initialData.street === undefined) initialData.street = '';
            if (initialData.houseNumber === undefined) initialData.houseNumber = '';
            if (initialData.city === undefined) initialData.city = '';
            if (initialData.postalCode === undefined) initialData.postalCode = '';
            if (initialData.country === undefined) initialData.country = '';
            if (initialData.note === undefined) initialData.note = '';

            const { dialCode, numberWithoutDialCode } = parsePhoneNumber(initialData.contactPhoneNumber, countryDialCodes);
            setDisplayDialCode(dialCode);
            setDisplayPhoneNumber(formatNumberGroups(numberWithoutDialCode));
        } else if (isEditingMember || isNewEntry) { // Používame robustnejšiu detekciu
            // Inicializovať adresné polia, ak neexistujú, a nastaviť ich na prázdny reťazec
            // Toto je kľúčové pre správne zobrazenie input boxov pre členov realizačného tímu, hráčov a šoférov
            if (!initialData.address) initialData.address = {};
            if (initialData.address.street === undefined) initialData.address.street = '';
            if (initialData.address.houseNumber === undefined) initialData.address.houseNumber = '';
            if (initialData.address.postalCode === undefined) initialData.address.postalCode = '';
            if (initialData.address.city === undefined) initialData.address.city = '';
            if (initialData.address.country === undefined) initialData.address.country = '';
            // Ďalšie polia pre členov tímu, ktoré by mohli chýbať
            if (initialData.firstName === undefined) initialData.firstName = '';
            if (initialData.lastName === undefined) initialData.lastName = '';
            if (initialData.dateOfBirth === undefined) initialData.dateOfBirth = '';
            if (initialData.jerseyNumber === undefined) initialData.jerseyNumber = '';
            if (initialData.registrationNumber === undefined) initialData.registrationNumber = '';
        } else if (title.includes('Upraviť tím') || title.includes('Pridať nový tím')) { // Changed for Add team modal
            // Inicializovať selectedCategory s existujúcou kategóriou tímu
            setSelectedCategory(initialData._category || initialData.category || ''); // Použiť _category pre flattened tímy
            if (initialData.teamName === undefined) initialData.teamName = '';
            
            // Inicializovať vybraný typ dopravy a čas príchodu
            setSelectedArrivalType(initialData.arrival?.type || '');
            setArrivalTime(initialData.arrival?.time || '');
            
            // Inicializovať vybraný typ ubytovania
            setSelectedAccommodationType(initialData.accommodation?.type || '');

            // Inicializovať selectedPackageName s existujúcim názvom balíka tímu
            setSelectedPackageName(initialData.packageDetails?.name || '');

            // Inicializovať teamTshirts ako pole objektov { tempId, size, quantity }
            const initialTshirts = (initialData.tshirts || [])
                .filter(tshirt => tshirt.size && (tshirt.quantity || 0) > 0) // Only include with quantity > 0
                .map(tshirt => ({
                    tempId: generateUniqueId(), // Assign a temporary unique ID
                    size: String(tshirt.size).trim(),
                    quantity: tshirt.quantity || 0
                }));
            setTeamTshirts(initialTshirts);
        }
        
        setLocalEditedData(initialData); 
        console.log("DataEditModal useEffect: localEditedData initialized to:", initialData); // Debug log
    }, [data, title, window.globalUserProfileData, db, availableTshirtSizes, isNewEntry, accommodationTypes]); // Pridané availableTshirtSizes, isNewEntry a accommodationTypes ako závislosť


    React.useEffect(() => {
        const handleClickOutside = (event) => {
            // Check if dial code modal is open, if so, don't close this modal
            if (isDialCodeModalOpen) {
                return;
            }
            // Check if confirmation modal is open, if so, don't close this modal
            if (isConfirmDeleteOpen || isConfirmDeleteTeamOpen) { // Zahrnúť aj potvrdenie pre tím
                return;
            }

            if (modalRef.current && !modalRef.current.contains(event.target)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose, isDialCodeModalOpen, isConfirmDeleteOpen, isConfirmDeleteTeamOpen]); // Pridané isConfirmDeleteTeamOpen do závislostí

    if (!isOpen) return null;

    // Handler pre zmenu veľkosti alebo počtu tričiek
    const handleTshirtEntryChange = (tempId, field, value) => {
        setTeamTshirts(prev =>
            prev.map(entry =>
                entry.tempId === tempId
                    ? { ...entry, [field]: field === 'quantity' ? Math.max(0, parseInt(value, 10) || 0) : value }
                    : entry
            )
        );
    };

    // Handler pre odstránenie riadku s tričkom
    const removeTshirtEntry = (tempId) => {
        setTeamTshirts(prev => prev.filter(entry => entry.tempId !== tempId));
    };

    // Handler pre pridanie nového riadku s tričkom
    const addTshirtEntry = () => {
        const currentlyUsedSizes = teamTshirts.map(entry => entry.size);
        const availableSizesForNewEntry = availableTshirtSizes.filter(size => !currentlyUsedSizes.includes(size));

        if (availableSizesForNewEntry.length > 0) {
            setTeamTshirts(prev => [
                ...prev,
                { tempId: generateUniqueId(), size: availableSizesForNewEntry[0], quantity: 0 } // Default to first available size
            ]);
        } else {
            setUserNotificationMessage("Všetky dostupné veľkosti tričiek sú už pridané.", 'info');
        }
    };

    // Helper to handle input changes for nested data
    const handleChange = (path, newValue) => {
        setLocalEditedData(prevData => {
            const newData = JSON.parse(JSON.stringify(prevData)); 
            let current = newData;
            const pathParts = path.split('.');

            for (let i = 0; i < pathParts.length - 1; i++) {
                const part = pathParts[i];
                const arrayMatch = part.match(/^(.*?)\[(\d+)\]$/); 
                
                if (arrayMatch) {
                    const arrayKey = arrayMatch[1];
                    const arrayIndex = parseInt(arrayMatch[2]);
                    if (!current[arrayKey]) current[arrayKey] = [];
                    if (!current[arrayKey][arrayIndex]) current[arrayKey][arrayIndex] = {};
                    current = current[arrayKey][arrayIndex];
                } else {
                    if (!current[part]) current[part] = {};
                    current = current[part];
                }
            }

            const lastPart = pathParts[pathParts.length - 1];
            const lastArrayMatch = lastPart.match(/^(.*?)\[(\d+)\]$/);
            if (lastArrayMatch) {
                const arrayKey = lastArrayMatch[1];
                const arrayIndex = parseInt(lastArrayMatch[2]);
                if (!current[arrayKey]) current[arrayKey] = [];
                current[arrayKey][arrayIndex] = newValue;
            } else {
                if (typeof getNestedValue(data, path) === 'boolean') {
                    current[lastPart] = (newValue.toLowerCase() === 'áno' || newValue.toLowerCase() === 'true');
                } else if (typeof getNestedValue(data, path) === 'number') {
                    current[lastPart] = parseFloat(newValue) || 0; 
                } else {
                    current[lastPart] = newValue;
                }
            }
            return newData;
        });
    };

    // Handler pre IČO a DIČ (iba čísla)
    const handleNumericInput = (e, path) => {
        const value = e.target.value.replace(/\D/g, ''); // Odstráni všetky nečíselné znaky
        handleChange(path, value);
    };

    // Handler pre IČ DPH (prvé 2 veľké písmená, potom čísla)
    const handleIcDphChange = (e, path) => {
        let value = e.target.value;
        let formattedValue = '';
        let cursorPosition = e.target.selectionStart;

        // Spracovanie prvých dvoch znakov (iba písmená, veľké)
        if (value.length > 0) {
            if (/[a-zA-Z]/.test(value[0])) {
                formattedValue += value[0].toUpperCase();
            } else {
                // Ak prvý znak nie je písmeno, ignorujeme ho a posunieme kurzor
                value = value.substring(1);
                cursorPosition = Math.max(0, cursorPosition - 1);
            }
        }
        if (value.length > 1) {
            if (/[a-zA-Z]/.test(value[1])) {
                formattedValue += value[1].toUpperCase();
            } else {
                // Ak druhý znak nie je písmeno, ignorujeme ho a posunieme kurzor
                value = formattedValue + value.substring(2); // Len zvyšok bez druhého znaku
                cursorPosition = Math.max(formattedValue.length, cursorPosition - 1);
            }
        }

        // Spracovanie zvyšných znakov (iba čísla)
        if (value.length > 2) {
            formattedValue += value.substring(2).replace(/\D/g, '');
        }
        
        // Obmedziť celkovú dĺžku (2 písmená + 10 číslic = 12 znakov)
        formattedValue = formattedValue.substring(0, 12);

        handleChange(path, formattedValue);

        // Obnoviť pozíciu kurzora po formátovaní
        setTimeout(() => {
            if (inputRefs.current[path]) { // Používame plnú cestu pre ref
                inputRefs.current[path].selectionStart = cursorPosition;
                inputRefs.current[path].selectionEnd = cursorPosition;
            }
        }, 0);
    };

    // Handler pre PSČ (číslice, medzera po 3. číslici)
    const handlePostalCodeChange = (e, path) => {
        const input = e.target;
        const oldDisplay = input.value;           // čo videl používateľ
        const cursorPos = input.selectionStart;
    
        // 1. extrahujeme iba číslice (max 5)
        let digits = oldDisplay.replace(/\D/g, '').slice(0, 5);
    
        // 2. vytvoríme novú zobrazenú hodnotu (s medzerou)
        let newDisplay = digits;
        if (digits.length > 3) {
            newDisplay = digits.slice(0, 3) + ' ' + digits.slice(3);
        }
    
        // 3. uložíme do stavu ČISTÉ ČÍSLICE
        handleChange(path, digits);
    
        // 4. inteligentne posunieme kurzor
        requestAnimationFrame(() => {
            if (inputRefs.current[path]) {
                const newCursor = getSmartCursorPosition(oldDisplay, newDisplay, cursorPos);
                inputRefs.current[path].selectionStart = newCursor;
                inputRefs.current[path].selectionEnd = newCursor;
            }
        });
    };

    const handlePostalCodeKeyDown = (e, path) => {
        if (e.key === 'Backspace') {
            const input = e.target;
            const pos = input.selectionStart;
    
            if (pos === 4 && input.value[3] === ' ') {
                e.preventDefault();
                const newDisplay = input.value.slice(0, 3) + input.value.slice(4);
                const newDigits = newDisplay.replace(/\D/g, '');
                handleChange(path, newDigits);
    
                requestAnimationFrame(() => {
                    if (inputRefs.current[path]) {
                        inputRefs.current[path].selectionStart = 3;
                        inputRefs.current[path].selectionEnd = 3;
                    }
                });
            }
        }
    };

    // Handler pre ContactPhoneNumber
    const handleContactPhoneNumberChange = (e) => {
        const value = e.target.value;
        const cleanedValue = value.replace(/\D/g, ''); // Iba číslice
        setDisplayPhoneNumber(formatNumberGroups(cleanedValue)); // Formátovať pre zobrazenie
        // Skutočná hodnota sa uloží pri volaní onSave
    };

    const handleSelectDialCode = (newDialCode) => {
        setDisplayDialCode(newDialCode);
        // Ak je potrebné okamžite aktualizovať localEditedData, môžete to urobiť tu
        // Ale pre "contactPhoneNumber" to necháme na onSave, aby sme sa vyhli zbytočným re-renderom
    };

    const isSavable = targetDocRef !== null; // Savable len ak je targetDocRef (užívateľský dokument) definovaný

    // Pomocná funkcia na získanie správnych dát pre input, aby sa predišlo opakovanému formátovaniu
    const getNestedDataForInput = (obj, path) => {
        const value = getNestedValue(obj, path); // Používame neznormalizovaný getNestedValue (bez true)
        if (value === null) return ''; // Pre zobrazenie v inpute null vždy ako ''
        if (value === undefined) return ''; // Undefined taktiež ako ''
        if (path.includes('postalCode')) {
            return String(value || '').replace(/\s/g, '');
        }
        return value;
    };

    // Určiť, či sa upravuje člen tímu (hráč, RT člen, šofér)
    const isEditingMember = title.toLowerCase().includes('upraviť hráč') || 
                            title.toLowerCase().includes('upraviť člen realizačného tímu') || 
                            title.toLowerCase().includes('upraviť šofér');

    const handleDeleteMemberClick = () => {
        const memberName = `${localEditedData.firstName || ''} ${localEditedData.lastName || ''}`.trim();
        setDeleteConfirmMessage(`Naozaj chcete odstrániť ${memberName || 'tohto člena tímu'}? Túto akciu nie je možné vrátiť späť.`);
        setIsConfirmDeleteOpen(true);
    };

    // Nová funkcia pre vykresľovanie polí člena tímu/hráča/šoféra
    const renderMemberFields = () => {
        // console.log('DataEditModal: renderMemberFields called. localEditedData:', localEditedData); // Debug log
        const memberElements = [];
        
        // Určiť, či ide o hráča (zobrazujeme jerseyNumber a registrationNumber) alebo iného člena tímu
        const isPlayer = title.toLowerCase().includes('upraviť hráč') || title.toLowerCase().includes('pridať nový hráč');
        
        // Základné polia pre všetkých členov
        let memberFieldsOrder = [
            'firstName', 'lastName', 'dateOfBirth',
            'address.street', 'address.houseNumber', 'address.postalCode', 'address.city', 'address.country'
        ];
        
        // Ak je to hráč, pridáme jerseyNumber a registrationNumber po dateOfBirth
        if (isPlayer) {
            memberFieldsOrder = [
                'firstName', 'lastName', 'dateOfBirth', 'jerseyNumber', 'registrationNumber',
                'address.street', 'address.houseNumber', 'address.postalCode', 'address.city', 'address.country'
            ];
        }
        
        memberFieldsOrder.forEach(path => {
            // Používame getNestedValue s localEditedData pre aktuálny stav
            const value = getNestedValue(localEditedData, path);
            const inputValue = value === undefined || value === null ? '' : value; // Pre input hodnoty
            // console.log(`DataEditModal:   renderMemberFields: For path: ${path}, raw value:`, value, `(type: ${typeof value})`); // Debug log)

            const labelText = formatLabel(path);
            let inputType = 'text';
            let isCheckbox = false;
            let customProps = {}; 

            if (typeof inputValue === 'boolean') {
                isCheckbox = true;
            } else if (path.includes('dateOfBirth')) {
                inputType = 'date';
            } else if (path.includes('jerseyNumber')) { // Iba pre JerseyNumber
                 customProps = {
                    onChange: (e) => handleNumericInput(e, path),
                    inputMode: 'numeric',
                    pattern: '[0-9]*',
                    maxLength: 3
                };
            } else if (path.includes('registrationNumber')) { // Teraz umožňuje všetky znaky pre RegistrationNumber
                customProps = {
                    onChange: (e) => handleChange(path, e.target.value), // Už nepoužíva handleNumericInput
                    maxLength: 20
                };
            }
             else if (path.includes('postalCode')) {
                customProps = {
                    onChange: (e) => handlePostalCodeChange(e, path),
                    onKeyDown: (e) => handlePostalCodeKeyDown(e, path),
                    inputMode: 'numeric',
                    pattern: '[0-9 ]*',
                    maxLength: 6,
                    value: getFormattedPostalCodeForInput(getNestedValue(localEditedData, path)),
                    onChange: (e) => handlePostalCodeChange(e, path),
                    onKeyDown: (e) => handlePostalCodeKeyDown(e, path),
                    readOnly: !isSavable
                };
            }
            
            // console.log(`DataEditModal:     renderMemberFields: Input value for path ${path}: "${inputValue}"`);

            memberElements.push(React.createElement(
                'div',
                { key: path, className: 'mb-4' }, // Odstránené červené štýly
                React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, labelText),
                // Odstránený riadok s aktuálnou hodnotou
                isCheckbox ? (
                    React.createElement('input', {
                        type: 'checkbox',
                        className: `form-checkbox h-5 w-5 text-blue-600`,
                        checked: getNestedValue(localEditedData, path) === true,
                        onChange: (e) => handleChange(path, e.target.checked),
                        disabled: !isSavable
                    })
                ) : (
                    React.createElement('input', {
                        ref: el => inputRefs.current[path] = el,
                        type: inputType,
                        className: `mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-white p-2`,
                        value: formatDisplayValue(inputValue, path), // Používa formatDisplayValue
                        onChange: (e) => (customProps.onChange ? customProps.onChange(e, path) : handleChange(path, e.target.value)),
                        readOnly: !isSavable,
                        ...customProps 
                    })
                )
            ));
        });

        return memberElements.filter(Boolean);
    };

    const renderDataFields = (obj, currentPath = '') => {
        // Zmenená podmienka pre robustnejšie porovnanie
        const isEditingMemberOrNewEntry = title.toLowerCase().includes('upraviť hráč') || 
                                title.toLowerCase().includes('upraviť člen realizačného tímu') || 
                                title.toLowerCase().includes('upraviť šofér') || isNewEntry;

        // console.log(`DataEditModal: renderDataFields: called with currentPath: ${currentPath}, isEditingMember: ${isEditingMember}, obj:`, obj); // Debug log

        // Skryť isMenuToggled pre úpravu používateľa
        if (title.includes('Upraviť používateľa') && currentPath === 'isMenuToggled') {
            return null;
        }

        if (currentPath === '') { // Ak sme na najvyššej úrovni dátového objektu
            if (isEditingMemberOrNewEntry && !title.includes('Pridať nový tím')) { // Použiť novú premennú, ale NIE pre "Pridať nový tím"
                // console.log('DataEditModal: renderDataFields: isEditingMember is true and currentPath is empty, calling renderMemberFields.');
                return renderMemberFields(); // Voláme novú dedikovanú funkciu
            } else if (title.includes('Upraviť používateľa')) { 
                const elements = [];
                
                const allUserFields = [
                    'firstName', 'lastName', 'contactPhoneNumber',
                    'billing.clubName', 'billing.ico', 'billing.dic', 'billing.icDph',
                    'street', 'houseNumber', 'city', 'postalCode', 'country', 'note' 
                ];
                let fieldsToRenderForUser = allUserFields;
                const isCurrentUserAdmin = userRole === 'admin';
                const isUserBeingEditedAdminOrHall = isTargetUserAdmin || isTargetUserHall;

                // Ak aktuálny používateľ je admin A používateľ, ktorého upravujeme, je admin ALEBO hall,
                // zobrazíme len meno a priezvisko. Telefónne číslo, fakturačné údaje, adresa a poznámka sa skryjú.
                if (isCurrentUserAdmin && isUserBeingEditedAdminOrHall) {
                    fieldsToRenderForUser = ['firstName', 'lastName']; // Len meno a priezvisko
                }

                const renderedFields = new Set(); // Track rendered fields for the user form


                const renderUserField = (path, value) => {
                    if (renderedFields.has(path)) return null;
                    renderedFields.add(path);

                    const key = path.split('.').pop();
                    if (['passwordLastChanged', 'registrationDate', 'email', 'approved', 'role'].includes(key)) {
                        return null;
                    }
                    
                    const labelText = formatLabel(path);
                    let inputType = 'text';
                    let isCheckbox = false;
                    let customProps = {}; 

                    if (typeof value === 'boolean') {
                        isCheckbox = true;
                    } else if (path.toLowerCase().includes('password')) {
                        inputType = 'password';
                    } else if (path === 'billing.ico' || path === 'billing.dic') {
                        customProps = {
                            onChange: (e) => handleNumericInput(e, path),
                            inputMode: 'numeric',
                            pattern: '[0-9]*',
                            maxLength: 10 
                        };
                    } else if (path === 'billing.icDph') {
                        customProps = {
                            onChange: (e) => handleIcDphChange(e, path),
                            maxLength: 12 
                        };
                    } else if (path.includes('postalCode')) {
                        customProps = {
                            onChange: (e) => handlePostalCodeChange(e, path),
                            onKeyDown: (e) => handlePostalCodeKeyDown(e, path),
                            inputMode: 'numeric',
                            pattern: '[0-9 ]*',
                            maxLength: 6,
                            value: getFormattedPostalCodeForInput(getNestedValue(localEditedData, path)),
                            onChange: (e) => handlePostalCodeChange(e, path),
                            onKeyDown: (e) => handlePostalCodeKeyDown(e, path),
                            readOnly: !isSavable
                        };
                    } else if (path === 'contactPhoneNumber') {
                        // Nezobrazovať tlačidlo a input pre admin/hall používateľov
                        if (isUserBeingEditedAdminOrHall) return null;
                        return React.createElement(
                            'div',
                            { key: path, className: 'mb-4' },
                            React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, labelText),
                            React.createElement(
                                'div',
                                { className: 'flex' },
                                React.createElement('button', {
                                    type: 'button',
                                    className: 'flex-shrink-0 inline-flex items-center justify-center px-4 py-2 border border-r-0 border-gray-300 rounded-l-md bg-gray-50 text-gray-700 text-sm hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500',
                                    onClick: () => setIsDialCodeModalOpen(true),
                                    disabled: !isSavable
                                }, displayDialCode || 'Vybrať predvoľbu'),
                                React.createElement('input', {
                                    ref: el => inputRefs.current[path] = el,
                                    type: 'tel',
                                    className: `mt-1 block w-full rounded-r-md border-gray-300 shadow-sm bg-white p-2 focus:outline-none focus:ring-2 focus:ring-blue-500`,
                                    value: displayPhoneNumber,
                                    onChange: handleContactPhoneNumberChange,
                                    readOnly: !isSavable,
                                    inputMode: 'tel',
                                    placeholder: 'Zadajte telefónne číslo',
                                    maxLength: 15 
                                })
                            )
                        );
                    }

                    return React.createElement(
                        'div',
                        { key: path, className: 'mb-4' },
                        React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, labelText),
                        isCheckbox ? (
                            React.createElement('input', {
                                type: 'checkbox',
                                className: `form-checkbox h-5 w-5 text-blue-600`,
                                checked: getNestedValue(localEditedData, path) === true,
                                onChange: (e) => handleChange(path, e.target.checked),
                                disabled: !isSavable
                            })
                        ) : (
                            React.createElement('input', {
                                ref: el => inputRefs.current[path] = el,
                                type: inputType,
                                className: `mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-white p-2`,
                                value: formatDisplayValue(getNestedDataForInput(localEditedData, path), path),
                                onChange: (e) => (customProps.onChange ? customProps.onChange(e, path) : handleChange(path, e.target.value)),
                                readOnly: !isSavable,
                                ...customProps
                            })
                        )
                    );
                };

                // Vykresliť len povolené polia pre používateľa
                fieldsToRenderForUser.forEach(path => {
                    elements.push(renderUserField(path, getNestedDataForInput(localEditedData, path)));
                });

                // Zabezpečiť, aby sa prázdne billing, adresa a poznámka NEVYKRESLOVALI
                // ak je používateľ admin/hall
                if (!isUserBeingEditedAdminOrHall) {
                    const billingFieldsInScope = allUserFields.filter(p => p.startsWith('billing.') && fieldsToRenderForUser.includes(p));
                    if (billingFieldsInScope.length > 0) {
                        elements.push(
                            React.createElement(
                                'div',
                                { key: 'billing-section', className: 'pl-4 border-l border-gray-200 mb-4' },
                                billingFieldsInScope.map(billingPath => {
                                    const billingValue = getNestedDataForInput(localEditedData, billingPath);
                                    return renderUserField(billingPath, billingValue);
                                })
                            )
                        );
                    }

                    const addressFieldsInScope = allUserFields.filter(p => 
                        ['street', 'houseNumber', 'city', 'postalCode', 'country'].includes(p) && fieldsToRenderForUser.includes(p)
                    );
                    
                    if (addressFieldsInScope.length > 0) {
                        elements.push(
                            React.createElement(
                                'div',
                                { key: 'address-section', className: 'pl-4 border-l border-gray-200 mb-4' },
                                addressFieldsInScope.map(addressPath => {
                                    const addressValue = getNestedDataForInput(localEditedData, addressPath);
                                    return renderUserField(addressPath, addressValue);
                                })
                            )
                        );
                    }

                    if (fieldsToRenderForUser.includes('note')) {
                        elements.push(renderUserField('note', getNestedDataForInput(localEditedData, 'note')));
                    }
                }

                return elements.filter(Boolean); 
            } else if (title.includes('Upraviť tím') || title.includes('Pridať nový tím')) { // Ak upravujeme Tím alebo pridávame nový tím
                const teamElements = [];

                // 1. Kategória tímu (Selectbox)
                teamElements.push(
                    React.createElement(
                        'div',
                        { key: '_category', className: 'mb-4' },
                        React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Kategória tímu'),
                        React.createElement(
                            'select',
                            {
                                className: `mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-white p-2 focus:outline-none focus:ring-2 focus:ring-blue-500`,
                                value: selectedCategory,
                                onChange: (e) => {
                                    setSelectedCategory(e.target.value);
                                    // Pre nový tím alebo úpravu existujúceho tímu, aktualizujeme _category aj category
                                    handleChange('_category', e.target.value);
                                    handleChange('category', e.target.value);
                                },
                                disabled: !isSavable
                            },
                            React.createElement('option', { value: '', disabled: true }, 'Vyberte kategóriu'),
                            selectedCategory && !categories.includes(selectedCategory) &&
                                React.createElement('option', { key: selectedCategory, value: selectedCategory, disabled: true, hidden: true }, selectedCategory),
                            categories.map(cat => React.createElement('option', { key: cat, value: cat }, cat))
                        )
                    )
                );

                // 2. Názov tímu (Inputbox)
                teamElements.push(
                    React.createElement(
                        'div',
                        { key: 'teamName', className: 'mb-4' },
                        React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Názov tímu'),
                        React.createElement('input', {
                            type: 'text',
                            className: `mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-white p-2 focus:outline-none focus:ring-2 focus:ring-blue-500`,
                            value: localEditedData.teamName || '',
                            onChange: (e) => handleChange('teamName', e.target.value),
                            readOnly: !isSavable
                        })
                    )
                );

                // 3. Typ dopravy (Selectbox a Čas)
                teamElements.push(
                    React.createElement(
                        'div',
                        { key: 'arrival', className: 'mb-4' },
                        React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Typ dopravy'),
                        React.createElement(
                            'select',
                            {
                                className: `mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-white p-2 focus:outline-none focus:ring-2 focus:ring-blue-500`,
                                value: selectedArrivalType,
                                onChange: (e) => {
                                    setSelectedArrivalType(e.target.value);
                                    handleChange('arrival.type', e.target.value); // Aktualizovať vnorené pole
                                },
                                disabled: !isSavable
                            },
                            React.createElement('option', { value: '', disabled: true }, 'Vyberte typ dopravy'),
                            // Zabezpečiť, že ak aktuálna hodnota nie je v možnostiach, stále sa zobrazí
                            selectedArrivalType && !arrivalOptions.includes(selectedArrivalType) &&
                                React.createElement('option', { key: selectedArrivalType, value: selectedArrivalType, disabled: true, hidden: true }, selectedArrivalType),
                            arrivalOptions.map(option => React.createElement('option', { key: option, value: option }, option))
                        ),
                        // Input pre čas, ak je selectedArrivalType "verejná doprava - vlak" alebo "verejná doprava - autobus"
                        (selectedArrivalType === 'verejná doprava - vlak' || selectedArrivalType === 'verejná doprava - autobus') &&
                        React.createElement(
                            'div',
                            { key: 'arrival.time-container', className: 'mt-2' },
                            React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Čas príchodu'),
                            React.createElement('input', {
                                type: 'time',
                                className: `mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-white p-2 focus:outline-none focus:ring-2 focus:ring-blue-500`,
                                value: arrivalTime,
                                onChange: (e) => {
                                    setArrivalTime(e.target.value);
                                    handleChange('arrival.time', e.target.value);
                                },
                                readOnly: !isSavable
                            })
                        )
                    )
                );

                // 4. Typ ubytovania (Selectbox)
                teamElements.push(
                    React.createElement(
                        'div',
                        { key: 'accommodation.type', className: 'mb-4' },
                        React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Typ ubytovania'),
                        React.createElement(
                            'select',
                            {
                                className: `mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-white p-2 focus:outline-none focus:ring-2 focus:ring-blue-500`,
                                value: selectedAccommodationType,
                                onChange: (e) => {
                                    setSelectedAccommodationType(e.target.value);
                                    handleChange('accommodation.type', e.target.value); // Aktualizovať vnorené pole
                                },
                                disabled: !isSavable
                            },
                            React.createElement('option', { value: '', disabled: true }, 'Vyberte typ ubytovania'),
                            // Zabezpečiť, že ak aktuálna hodnota nie je v možnostiach, stále sa zobrazí
                            selectedAccommodationType && !accommodationOptionsWithNone.includes(selectedAccommodationType) && // Používame accommodationOptionsWithNone
                                React.createElement('option', { key: selectedAccommodationType, value: selectedAccommodationType, disabled: true, hidden: true }, selectedAccommodationType),
                            accommodationOptionsWithNone.map(option => React.createElement('option', { key: option, value: option }, option)) // Používame accommodationOptionsWithNone
                        )
                    )
                );

                // 5. Názov balíka (Selectbox)
                teamElements.push(
                    React.createElement(
                        'div',
                        { key: 'packageDetails.name', className: 'mb-4' },
                        React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Balík'),
                        React.createElement(
                            'select',
                            {
                                className: `mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-white p-2 focus:outline-none focus:ring-2 focus:ring-blue-500`,
                                value: selectedPackageName,
                                onChange: (e) => {
                                    setSelectedPackageName(e.target.value);
                                    // Nájdite celý objekt balíka na základe vybranej hodnoty
                                    const selectedPackage = packages.find(pkg => pkg.name === e.target.value);
                                    if (selectedPackage) {
                                        // Uložiť celý objekt do packageDetails, ale bez 'id' a iných interných kľúčov
                                        const { id, ...packageDataToSave } = selectedPackage;
                                        handleChange('packageDetails', packageDataToSave);
                                    } else {
                                        handleChange('packageDetails', null); // Ak balík nebol nájdený
                                    }
                                },
                                disabled: !isSavable
                            },
                            React.createElement('option', { value: '', disabled: true }, 'Vyberte balík'),
                            selectedPackageName && !packages.some(pkg => pkg.name === selectedPackageName) &&
                                React.createElement('option', { key: selectedPackageName, value: selectedPackageName, disabled: true, hidden: true }, selectedPackageName),
                            packages.map(pkg => React.createElement('option', { key: pkg.id, value: pkg.name }, pkg.name))
                        )
                    )
                );

                // 6. Tričká
                if (availableTshirtSizes.length > 0) {
                    const usedSizes = teamTshirts.map(entry => entry.size); // Get all sizes currently selected across all rows
                    teamElements.push(
                        React.createElement(
                            'div',
                            { key: 'tshirts-section', className: 'mb-4' },
                            React.createElement('h4', { className: 'text-md font-semibold text-gray-800 mb-2' }, 'Tričká'),
                            // Render existing t-shirt entries
                            teamTshirts.map(tshirtEntry =>
                                React.createElement(
                                    'div',
                                    { key: tshirtEntry.tempId, className: 'flex items-center mb-2' },
                                    React.createElement(
                                        'select',
                                        {
                                            className: `mt-1 block w-32 rounded-md border-gray-300 shadow-sm bg-white p-2 mr-2 focus:outline-none focus:ring-2 focus:ring-blue-500`,
                                            value: tshirtEntry.size,
                                            onChange: (e) => handleTshirtEntryChange(tshirtEntry.tempId, 'size', e.target.value),
                                            disabled: !isSavable
                                        },
                                        // Option for the currently selected size, always show it
                                        // Even if it might be considered 'used' by another entry in some edge case or if no longer available globally
                                        availableTshirtSizes.includes(tshirtEntry.size) ? 
                                            React.createElement('option', { key: tshirtEntry.size, value: tshirtEntry.size }, tshirtEntry.size)
                                        : (tshirtEntry.size && React.createElement('option', { key: tshirtEntry.size, value: tshirtEntry.size, disabled: true, hidden: true }, `${tshirtEntry.size} (Neplatná)`)),

                                        // Only show other available sizes that are not currently used by other entries
                                        availableTshirtSizes
                                            .filter(size => !usedSizes.includes(size) || size === tshirtEntry.size) // Filter out already used sizes, but keep the current entry's size
                                            .map(size => (
                                                size !== tshirtEntry.size ? // Avoid duplicating the already rendered current size option
                                                React.createElement('option', {
                                                    key: size,
                                                    value: size,
                                                }, size) : null
                                            ))
                                    ),
                                    React.createElement('input', {
                                        type: 'number',
                                        min: '0',
                                        className: `mt-1 block flex-grow rounded-md border-gray-300 shadow-sm bg-white p-2 mr-2 focus:outline-none focus:ring-2 focus:ring-blue-500`,
                                        value: tshirtEntry.quantity,
                                        onChange: (e) => handleTshirtEntryChange(tshirtEntry.tempId, 'quantity', e.target.value),
                                        readOnly: !isSavable
                                    }),
                                    React.createElement('button', {
                                        type: 'button',
                                        onClick: () => removeTshirtEntry(tshirtEntry.tempId),
                                        className: 'flex-shrink-0 flex items-center justify-center w-8 h-8 bg-red-500 text-white rounded-full hover:bg-red-600 focus:outline-none text-xl leading-none', // Circular delete button
                                        style: { lineHeight: '10px' }, // Adjust line height to center the '-'
                                    }, '-')
                                )
                            ),
                            // Wrap the add button in a div for centering
                            React.createElement('div', { className: 'flex justify-center mt-2' },
                                React.createElement('button', {
                                    type: 'button',
                                    onClick: addTshirtEntry,
                                    className: 'flex-shrink-0 flex items-center justify-center w-8 h-8 bg-blue-500 text-white rounded-full hover:bg-blue-600 focus:outline-none text-xl leading-none', // Changed color to blue, made round, text-xl for larger +, line-height for centering
                                    style: { lineHeight: '10px' }, // Adjust line height to center the '+'
                                    disabled: !isSavable || teamTshirts.length >= availableTshirtSizes.length // Disable if all sizes are used
                                }, '+')
                            )
                        )
                    );
                }

                return teamElements;
            }
        } else { // Pre všetky ostatné prípady (vnorené objekty alebo iné, ako vyššie špecifikované typy úprav)
            // Táto časť sa už nemala volať pre členov (hráčov/RT/šoférov)
            return Object.entries(obj).map(([key, value]) => {
                if (key.startsWith('_') || ['teams', 'columnOrder', 'displayNotifications', 'emailVerified', 'password', 'packageDetails', 'accommodation', 'arrival', 'tshirts'].includes(key)) {
                    return null;
                }
                
                const fullKeyPath = currentPath ? `${currentPath}.${key}` : key;

                if (typeof value === 'object' && value !== null && !Array.isArray(value) && !(value.toDate && typeof value.toDate === 'function')) {
                    return React.createElement(
                        CollapsibleSection,
                        {
                            key: fullKeyPath,
                            title: formatLabel(fullKeyPath),
                            defaultOpen: false,
                            noOuterStyles: true
                        },
                        renderDataFields(value, fullKeyPath)
                    );
                } else if (Array.isArray(value)) {
                    if (value.length === 0) {
                        return React.createElement(
                            'div',
                            { key: fullKeyPath, className: 'mb-4' },
                            React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, formatLabel(fullKeyPath)),
                            React.createElement('input', {
                                type: 'text',
                                readOnly: true,
                                className: 'mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-gray-50 text-gray-700 p-2',
                                value: '(Prázdne)'
                            })
                        );
                    }
                    return React.createElement(
                        'div',
                        { key: fullKeyPath, className: 'border border-gray-200 rounded-lg mb-2' },
                        value.map((item, index) => React.createElement(
                            CollapsibleSection,
                            { key: `${fullKeyPath}[${index}]`, title: `${item.firstName || ''} ${item.lastName || item.size || 'Položka'}`, defaultOpen: false, noOuterStyles: false },
                            renderDataFields(item, `${fullKeyPath}[${index}]`)
                        ))
                    );
                } else {
                    // Pre tento generický renderField potrebujeme, aby fungoval ako renderUserField,
                    // len s cestou a hodnotou (bez špeciálnych podmienok pre telefónne číslo atď.)
                    const labelText = formatLabel(fullKeyPath);
                    let inputType = 'text';
                    let isCheckbox = false;
                    let customProps = {}; 

                    if (typeof value === 'boolean') {
                        isCheckbox = true;
                    } else if (fullKeyPath.toLowerCase().includes('password')) {
                        inputType = 'password';
                    } else if (fullKeyPath.includes('dateOfBirth')) {
                         inputType = 'date';
                    } else if (fullKeyPath.includes('jerseyNumber')) { // Iba pre JerseyNumber
                         customProps = {
                            onChange: (e) => handleNumericInput(e, fullKeyPath),
                            inputMode: 'numeric',
                            pattern: '[0-9]*',
                            maxLength: 3
                        };
                    } else if (fullKeyPath.includes('registrationNumber')) { // Teraz umožňuje všetky znaky pre RegistrationNumber
                         customProps = {
                            onChange: (e) => handleChange(fullKeyPath, e.target.value), // Už nepoužíva handleNumericInput
                            maxLength: 20
                        };
                    } else if (fullKeyPath.includes('postalCode')) {
                        customProps = {
                            onChange: (e) => handlePostalCodeChange(e, fullKeyPath),
                            onKeyDown: (e) => handlePostalCodeKeyDown(e, fullKeyPath),
                            inputMode: 'numeric',
                            pattern: '[0-9 ]*',
                            maxLength: 6 
                        };
                    }
                    
                    return React.createElement(
                        'div',
                        { key: fullKeyPath, className: 'mb-4' },
                        React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, labelText),
                        isCheckbox ? (
                            React.createElement('input', {
                                type: 'checkbox',
                                className: `form-checkbox h-5 w-5 text-blue-600`,
                                checked: getNestedValue(localEditedData, fullKeyPath) === true,
                                onChange: (e) => handleChange(fullKeyPath, e.target.checked),
                                disabled: !isSavable
                            })
                        ) : (
                            React.createElement('input', {
                                ref: el => inputRefs.current[fullKeyPath] = el,
                                type: inputType,
                                className: `mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-white p-2`,
                                value: formatDisplayValue(getNestedDataForInput(localEditedData, fullKeyPath), fullKeyPath),
                                onChange: (e) => (customProps.onChange ? customProps.onChange(e, fullKeyPath) : handleChange(fullKeyPath, e.target.value)),
                                readOnly: !isSavable,
                                ...customProps
                            })
                        )
                    );
                }
            }).filter(Boolean);
        }
    };

    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50 p-4' },
        React.createElement(
            'div',
            {
                ref: modalRef,
                className: 'bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto'
            },
            React.createElement('h3', { className: 'text-lg font-semibold mb-4' }, title),
            React.createElement(
                'div',
                { className: 'space-y-4' },
                renderDataFields(localEditedData) // Tu odovzdávame localEditedData
            ),
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mt-4' },
                // Tlačidlo "Odstrániť" pre členov
                (!isNewEntry && isEditingMember) && React.createElement('button', { 
                    className: 'px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600',
                    onClick: handleDeleteMemberClick,
                    disabled: !isSavable
                }, 'Odstrániť člena'),

                // Tlačidlo "Odstrániť" pre tím (zobrazí sa, ak sa upravuje tím a nie je to nový záznam)
                (!isNewEntry && (title.includes('Upraviť tím'))) && React.createElement('button', {
                    className: 'px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600',
                    onClick: () => {
                        setDeleteTeamConfirmMessage(`Naozaj chcete odstrániť tím "${localEditedData.teamName || 'Bez názvu'}" z kategórie "${localEditedData._category || 'Neznámá'}"? Túto akciu nie je možné vrátiť späť.`);
                        setIsConfirmDeleteTeamOpen(true);
                    },
                    disabled: !isSavable
                }, 'Odstrániť tím'),

                React.createElement(
                    'div',
                    { className: 'flex space-x-2' },
                    React.createElement('button', {
                        className: 'px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300',
                        onClick: onClose
                    }, 'Zavrieť'),
                    isSavable && React.createElement('button', {
                        className: 'px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600',
                        onClick: async () => {
                            try {
                                window.showGlobalLoader();
                    
                                const dataToPrepareForSave = JSON.parse(JSON.stringify(localEditedData));
                    
                                // 1. Telefónne číslo (len ak nie admin/hall)
                                if (dataToPrepareForSave.contactPhoneNumber !== undefined && !(isTargetUserAdmin || isTargetUserHall)) {
                                    dataToPrepareForSave.contactPhoneNumber = combinePhoneNumber(displayDialCode, displayPhoneNumber);
                                } else if (isTargetUserAdmin || isTargetUserHall) {
                                    delete dataToPrepareForSave.contactPhoneNumber;
                                }
                    
                                // 2. Špeciálne polia pre tím
                                if (title.includes('Upraviť tím') || title.includes('Pridať nový tím')) {
                                    dataToPrepareForSave.category = selectedCategory;
                                    dataToPrepareForSave._category = selectedCategory;
                                    dataToPrepareForSave.arrival = { type: selectedArrivalType };
                                    if (selectedArrivalType === 'verejná doprava - vlak' || selectedArrivalType === 'verejná doprava - autobus') {
                                        dataToPrepareForSave.arrival.time = arrivalTime;
                                    } else {
                                        delete dataToPrepareForSave.arrival.time;
                                    }
                                    dataToPrepareForSave.accommodation = { type: selectedAccommodationType };
                                    dataToPrepareForSave.tshirts = teamTshirts
                                        .filter(t => t.size && t.quantity > 0)
                                        .map(({ size, quantity }) => ({ size, quantity }));
                                }
                    
                                // 3. Filtrovanie interných/nepotrebných kľúčov
                                const finalDataToSave = {};
                                Object.keys(dataToPrepareForSave).forEach(key => {
                                    if (!['id', 'uniqueId', 'type', 'originalArray', 'originalIndex', 'password'].includes(key)) {
                                        const value = dataToPrepareForSave[key];
                                        if (key === 'billing' && (isTargetUserAdmin || isTargetUserHall)) {
                                            // preskočiť billing pre admin/hall
                                        } else {
                                            finalDataToSave[key] = value;
                                        }
                                    }
                                });
                    
                                console.log("DEBUG: DataEditModal → finalDataToSave:", finalDataToSave);
                    
                                // ────────────────────────────────────────────────────────────────
                                // ROZHODNUTIE: či vôbec robiť diff v modálnom okne
                                // ────────────────────────────────────────────────────────────────
                    
                                const isAddingNewMember = isNewEntry && (
                                    editModalTitle.toLowerCase().includes('pridať nový hráč') ||
                                    editModalTitle.toLowerCase().includes('pridať nový člen realizačného tímu (žena)') ||
                                    editModalTitle.toLowerCase().includes('pridať nový člen realizačného tímu (muž)') ||
                                    editModalTitle.toLowerCase().includes('pridať nový šofér (žena)') ||
                                    editModalTitle.toLowerCase().includes('pridať nový šofér (muž)')
                                );
                    
                                const isAddingNewTeam = isNewEntry && editModalTitle.includes('Pridať nový tím');
                    
                                let generatedChanges = [];
                    
                                if (isAddingNewMember) {
                                    // NOVÝ ČLEN → v modálnom okne NEgenerujeme diff
                                    console.log("DEBUG: Nový člen → preskakujem getChangesForNotification v DataEditModal");
                                }
                                else if (isAddingNewTeam) {
                                    // NOVÝ TÍM → špeciálna jednoduchá notifikácia (bez diffu)
                                    generatedChanges = [`Nový tím bol pridaný: ${finalDataToSave.teamName || 'Bez názvu'}`];
                                    console.log("DEBUG: Nový tím → používam špeciálnu notifikáciu bez diffu");
                                }
                                else {
                                    // ÚPRAVA (člena alebo tímu) → normálny diff
                                    const originalDataForCompare = JSON.parse(JSON.stringify(data || {}));
                                    const modifiedDataForCompare = JSON.parse(JSON.stringify(finalDataToSave));
                                
                                    // Skryť billing/adresu pre admin/hall pri porovnaní
                                    if (isTargetUserAdmin || isTargetUserHall) {
                                        delete originalDataForCompare.address;
                                        delete originalDataForCompare.billing;
                                        delete modifiedDataForCompare.address;
                                        delete modifiedDataForCompare.billing;
                                    }
                                
                                    generatedChanges = getChangesForNotification(
                                        originalDataForCompare,
                                        modifiedDataForCompare,
                                        formatDateToDMMYYYY
                                    );
                                
                                    // Explicitná kontrola zmeny kategórie (len pre tímy)
                                    const originalCategory = originalDataForCompare?._category || originalDataForCompare?.category || '-';
                                    const updatedCategory = modifiedDataForCompare?._category || modifiedDataForCompare?.category || '-';
                                    if (originalCategory !== updatedCategory && !generatedChanges.some(c => c.includes('Zmena Kategórie:'))) {
                                        generatedChanges.push(`Zmena Kategórie: z '${originalCategory}' na '${updatedCategory}'`);
                                    }
                                
                                    // Prefix iba pre tímy (ak ide o tím)
                                    if (finalDataToSave.teamName || finalDataToSave._category) {
                                        const teamName = finalDataToSave.teamName || 'Bez názvu';
                                        const teamCategory = finalDataToSave._category || finalDataToSave.category || 'Neznáma kategória';
                                        generatedChanges = generatedChanges.map(change => 
                                            `Tím '${teamName}' (${teamCategory}): ${change}`
                                        );
                                    }
                                    else if (editModalTitle.toLowerCase().includes('upraviť hráč') ||
                                             editModalTitle.toLowerCase().includes('upraviť člen') ||
                                             editModalTitle.toLowerCase().includes('upraviť šofér')) {
                                        // ŽIADNY prefix tu – necháme to na handleSaveEditedData
                                        console.log("DEBUG: Úprava člena → prefix sa pridá v handleSaveEditedData");
                                    }
                                }
                    
                                console.log("DEBUG: DataEditModal → generatedChanges:", generatedChanges);
                                console.log("DEBUG: DataEditModal → generatedChanges.length:", generatedChanges.length);
                    
                                // Ak nič nezmenené a nie je to nový člen/tím → zavrieť
                                if (generatedChanges.length === 0 && !isAddingNewMember && !isAddingNewTeam) {
                                    setUserNotificationMessage("Žiadne zmeny na uloženie.", 'info');
                                    onClose();
                                    return;
                                }
                    
                                // ────────────────────────────────────────────────────────────────
                                // Uloženie notifikácie do Firestore (ak niečo máme)
                                // ────────────────────────────────────────────────────────────────
                                const userEmail = window.auth.currentUser?.email;
                                if (generatedChanges.length > 0 && userEmail) {
                                    const notificationsCollectionRef = collection(db, 'notifications');
                                    await addDoc(notificationsCollectionRef, {
                                        userEmail,
                                        changes: generatedChanges,
                                        timestamp: serverTimestamp()
                                    });
                                    console.log("Notifikácia uložená z DataEditModal (diff alebo nový tím)");
                                }
                    
                                // ────────────────────────────────────────────────────────────────
                                // Volanie hlavnej logiky uloženia (handleSaveEditedData)
                                // ────────────────────────────────────────────────────────────────
                                onSave(
                                    finalDataToSave,
                                    targetDocRef,
                                    originalDataPath,
                                    isNewEntry,
                                    isTargetUserAdmin,
                                    isTargetUserHall
                                );
                    
                            } catch (e) {
                                console.error("Chyba v DataEditModal pri ukladaní:", e);
                                setError(`Chyba pri ukladaní: ${e.message}`);
                                setUserNotificationMessage(`Chyba: ${e.message}`, 'error');
                            } finally {
                                window.hideGlobalLoader();
                            }
                        }
                    }, 'Uložiť zmeny')
                )
            )
        ),
        // DialCodeSelectionModal sa zobrazí iba vtedy, ak sa upravuje používateľ a NIE JE to admin/hall
        !(isTargetUserAdmin || isTargetUserHall) && React.createElement(DialCodeSelectionModal, {
            isOpen: isDialCodeModalOpen,
            onClose: () => setIsDialCodeModalOpen(false),
            onSelectDialCode: handleSelectDialCode,
            currentDialCode: displayDialCode
        }),
        React.createElement(ConfirmationModal, {
            isOpen: isConfirmDeleteOpen,
            onClose: () => setIsConfirmDeleteOpen(false),
            onConfirm: () => onDeleteMember(targetDocRef, originalDataPath), // Zavolať prop onDeleteMember
            title: "Potvrdenie odstránenia člena",
            message: deleteConfirmMessage
        }),
        // Nový ConfirmationModal pre tím
        React.createElement(ConfirmationModal, {
            isOpen: isConfirmDeleteTeamOpen,
            onClose: () => setIsConfirmDeleteTeamOpen(false),
            onConfirm: () => {
                onDeleteTeam(targetDocRef, originalDataPath); // Zavolať prop onDeleteTeam
                setIsConfirmDeleteTeamOpen(false); // Zatvoriť aj potvrdzovací modal
                onClose(); // Zatvoriť hlavný DataEditModal
            },
            title: "Potvrdenie odstránenia tímu",
            message: deleteTeamConfirmMessage
        })
    );
}

// Pomocná funkcia na aktualizáciu vnoreného objektu podľa cesty a vrátenia upraveného poľa najvyššej úrovne pre aktualizáciu Firestore
const updateNestedObjectByPath = (obj, path, value) => {
    // console.log("DEBUG updateNestedObjectByPath: Path:", path); // LOGGING
    if (!path) {
        throw new Error(`Vygenerovaná cesta najvyššej úrovne pre aktualizáciu je prázdna. Pôvodná cesta: ${path}`);
    }

    // Hlboká kópia objektu na zabezpečenie nemennosti počas modifikácie
    const newObj = JSON.parse(JSON.stringify(obj));
    const pathParts = path.split('.');
    let current = newObj;

    for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        const arrayMatch = part.match(/^(.*?)\[(\d+)\]$/);

        if (arrayMatch) {
            const arrayKey = arrayMatch[1];
            const arrayIndex = parseInt(arrayMatch[2]);
            if (!current[arrayKey]) current[arrayKey] = [];
            // Rozšíriť pole, ak je index mimo rozsahu
            while (current[arrayKey].length <= arrayIndex) {
                current[arrayKey].push({});
            }
            current = current[arrayKey][arrayIndex];
        } else {
            if (!current[part]) current[part] = {};
            current = current[part];
        }
    }

    const lastPart = pathParts[pathParts.length - 1];
    const lastArrayMatch = lastPart.match(/^(.*?)\[(\d+)\]$/);

    if (lastArrayMatch) {
        const arrayKey = lastArrayMatch[1];
        const arrayIndex = parseInt(lastArrayMatch[2]);
        if (!current[arrayKey]) current[arrayKey] = [];
        // Rozšíriť pole, ak je index mimo rozsahu
        while (current[arrayKey].length <= arrayIndex) {
            current[arrayKey].push({});
        }
        current[arrayKey][arrayIndex] = value;
    } else {
        current[lastPart] = value;
    }

    // Určiť pole najvyššej úrovne, ktoré bolo upravené pre aktualizáciu Firestore
    // To musí spracovať prípady ako 'teams.Juniors[0]', kde 'teams' je časť najvyššej úrovne.
    const firstPathPart = pathParts[0];
    const topLevelField = firstPathPart.includes('[') ? firstPathPart.substring(0, firstPathPart.indexOf('[')) : firstPathPart;

    // console.log("DEBUG updateNestedObjectByPath: First Path Part:", firstPathPart, "Top Level Field:", topLevelField); // LOGGING

    if (!topLevelField) {
        throw new Error(`Vygenerovaná cesta najvyššej úrovne pre aktualizáciu je prázdna. Pôvodná cesta: ${path}`);
    }

    return {
        updatedObject: newObj,
        topLevelField: topLevelField
    };
};

// Simplified recalculateTeamCounts function
const recalculateTeamCounts = (teamToUpdate) => {
    // Ensure all member arrays are defined, even if empty
    teamToUpdate.playerDetails = teamToUpdate.playerDetails || [];
    teamToUpdate.menTeamMemberDetails = teamToUpdate.menTeamMemberDetails || [];
    teamToUpdate.womenTeamMemberDetails = teamToUpdate.womenTeamMemberDetails || [];
    teamToUpdate.driverDetailsMale = teamToUpdate.driverDetailsMale || [];
    teamToUpdate.driverDetailsFemale = teamToUpdate.driverDetailsFemale || [];

    // Calculate and set the counts directly on the teamToUpdate object
    teamToUpdate.players = teamToUpdate.playerDetails.length;
    teamToUpdate.menTeamMembersCount = teamToUpdate.menTeamMemberDetails.length;
    teamToUpdate.womenTeamMembersCount = teamToUpdate.womenTeamMemberDetails.length;
    teamToUpdate.drivers = { // Používame vnorený objekt pre šoférov, ako ste uviedli v popise
        female: teamToUpdate.driverDetailsFemale.length,
        male: teamToUpdate.driverDetailsMale.length
    };
    // No need to explicitly update `players`, `menTeamMembersCount` etc. here,
    // as they are derived properties in `allTeamsFlattened` based on the array lengths.
    return teamToUpdate;
};

const translateRole = (role) => {
  switch (role) {
    case 'club':
      return 'Klub';
    case 'admin':
      return 'Administrátor';
    case 'volunteer':
      return 'Dobrovoľník';
    case 'referee':
      return 'Rozhodca';
    default:
      return role;
  }
};


// Hlavný React komponent pre stránku logged-in-all-registrations.html
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
    { id: 'billing.icDph', label: 'IČ DPH', type: true },
    { id: 'street', label: 'Ulica', type: 'string', visible: true },
    { id: 'houseNumber', label: 'Popisné číslo', type: 'string', visible: true },
    { id: 'city', label: 'Mesto/Obec', type: true },
    { id: 'postalCode', label: 'PSČ', type: 'string', visible: true },
    { id: 'country', label: 'Krajina', type: 'string', visible: true },

    { id: 'tshirtSize', label: 'Veľkosť trička', type: 'string', visible: true },
    { id: 'selectedDates', label: 'Dni k dispozícii', type: 'string', visible: true },
    { id: 'volunteerRoles', label: 'Môžem byť nápomocný', type: 'string', visible: true },
    
    { id: 'note', label: 'Poznámka', type: 'string', visible: true }, // Pridaný stĺpec "Poznámka"
  ];
  const [columnOrder, setColumnOrder] = React.useState(defaultColumnOrder); // Keep columnOrder for definitions

  const [hoveredColumn, setHoveredColumn] = React.useState(null); // Keep for sorting feedback

  const [expandedRows, setExpandedRows] = React.useState({});
  const [expandedTeamRows, setExpandedTeamRows] = React.useState({});

  const [availableTshirtSizes, setAvailableTshirtSizes] = React.useState([]);
  const tshirtSizeOrderFallback = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

  const [showUsers, setShowUsers] = React.useState(true);
  const [showTeams, setShowTeams] = React.useState(true);

  // Stavy pre modálne okno na úpravu
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [editingData, setEditingData] = React.useState(null); // Initialized to null
  const [editModalTitle, setEditModalTitle] = React.useState('');
  const [editingDocRef, setEditingDocRef] = React.useState(null); // Initialized to null
  const [editingDataPath, setEditingDataPath] = React.useState(''); // Cesta v dokumente pre uloženie
  const [isNewEntry, setIsNewEntry] = React.useState(false); // Nový stav pre indikáciu, či ide o nový záznam

  // Nové stavy pre modálne okno na výber typu člena tímu
  const [isAddMemberTypeSelectionModalOpen, setIsAddMemberTypeSelectionModalOpen] = React.useState(false);
  const [currentTeamForNewMember, setCurrentTeamForNewMember] = React.useState(null); // Tím, do ktorého sa pridáva nový člen

  // Nové stavy pre modálne okno na pridanie tímu
  // const [isAddTeamModalOpen, setIsAddTeamModalOpen] = React.useState(false); // Už nepotrebujeme samostatný stav, použijeme isEditModalOpen


  const openEditModal = (data, title, targetDocRef = null, originalDataPath = '', newEntryFlag = false) => {
      // Odstrániť citlivé alebo irelevantné kľúče pred odovzdaním do modálneho okna
      const cleanedData = { ...data };
      delete cleanedData.password; // Príklad: odstránenie hesla
      delete cleanedData.emailVerified; // Príklad: odstránenie interných stavov
      delete cleanedData.id; // ID je často súčasťou cesty a nemalo by sa upravovať

      setEditingData(cleanedData);
      setEditModalTitle(title);
      setEditingDocRef(targetDocRef);
      setEditingDataPath(originalDataPath);
      setIsNewEntry(newEntryFlag); // Nastaviť príznak
      setIsEditModalOpen(true);
      // console.log("openEditModal: Opening modal with title:", title, "data:", cleanedData, "path:", originalDataPath, "isNewEntry:", newEntryFlag); // Debug log
  };

  const closeEditModal = () => {
      setIsEditModalOpen(false);
      setEditingData(null);
      setEditModalTitle('');
      setEditingDocRef(null);
      setEditingDataPath('');
      setIsNewEntry(false); // Resetovať príznak
  };

  // Handler pre otvorenie modálneho okna na výber typu člena
  const handleOpenAddMemberTypeModal = (team) => {
      setCurrentTeamForNewMember(team);
      setIsAddMemberTypeSelectionModalOpen(true);
  };

  // Handler po výbere typu člena a kliknutí na "Pridať"
  const handleSelectedMemberTypeAndOpenEdit = React.useCallback((memberType) => {
    if (!currentTeamForNewMember) {
        setUserNotificationMessage("Chyba: Nebol vybraný žiadny tím pre pridanie člena.", 'error');
        return;
    }

    const newMemberData = {}; // Prázdny objekt pre nového člena
    let memberArrayPath = '';
    let resolvedTitle = '';

    switch (memberType) {
        case 'Hráč':
            memberArrayPath = 'playerDetails';
            resolvedTitle = 'Pridať nový hráč';
            break;
        case 'Člen realizačného tímu (žena)':
            memberArrayPath = 'womenTeamMemberDetails';
            resolvedTitle = 'Pridať nový člen realizačného tímu (žena)';
            break;
        case 'Člen realizačného tímu (muž)':
            memberArrayPath = 'menTeamMemberDetails';
            resolvedTitle = 'Pridať nový člen realizačného tímu (muž)';
            break;
        case 'Šofér (žena)':
            memberArrayPath = 'driverDetailsFemale';
            resolvedTitle = 'Pridať nový šofér (žena)';
            break;
        case 'Šofér (muž)':
            memberArrayPath = 'driverDetailsMale';
            resolvedTitle = 'Pridať nový šofér (muž)';
            break;
        default:
            setUserNotificationMessage("Neplatný typ člena tímu.", 'error');
            return;
    }

    // Cesta pre uloženie nového člena: použijeme fiktívny index -1 na signalizáciu nového záznamu
    const newMemberPath = `teams.${currentTeamForNewMember._category}[${currentTeamForNewMember._teamIndex}].${memberArrayPath}[-1]`;
    const targetDocRefForNewMember = doc(db, 'users', currentTeamForNewMember._userId);

    openEditModal(newMemberData, resolvedTitle, targetDocRefForNewMember, newMemberPath, true); // Nastaviť isNewEntry na true
    setIsAddMemberTypeSelectionModalOpen(false); // Zatvoriť modal výberu typu
    setCurrentTeamForNewMember(null); // Resetovať tím
  }, [currentTeamForNewMember, db, openEditModal, setUserNotificationMessage]);


  const allTeamsFlattened = React.useMemo(() => {
    if (!showUsers && showTeams) {
        let teams = [];
        filteredUsers.forEach(u => {
            if (u.teams && Object.keys(u.teams).length > 0) {
                Object.entries(u.teams).forEach(([category, teamListRaw]) => { // Renamed teamList to teamListRaw
                    const teamList = Array.isArray(teamListRaw) ? teamListRaw : []; // Defensive check
                    teamList.forEach((team, teamIndex) => {
                        let menTeamMembersCount = team.menTeamMemberDetails?.length || 0;
                        let womenTeamMembersCount = team.womenTeamMemberDetails?.length || 0;
                        let menDriversCount = team.driverDetailsMale?.length || 0; 
                        let womenDriversCount = team.driverDetailsFemale?.length || 0; 
                        let playersCount = team.playerDetails?.length || 0;

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
                            _menDriversCount: menDriversCount, 
                            _womenDriversCount: womenDriversCount, 
                            _players: playersCount,
                            _teamTshirtsMap: teamTshirtsMap
                        });
                    });
                });
            }
        });
        return teams.sort((a, b) => {
            // Najprv podľa kategórie (alfabeticky)
            if (a._category !== b._category) {
                return a._category.localeCompare(b._category);
            }
            const nameA = (a.teamName || '').toLowerCase();
            const nameB = (b.teamName || '').toLowerCase();
            return nameA.localeCompare(nameB);
        });
    }
    return [];
  }, [filteredUsers, showUsers, showTeams]);

const calculateVolunteerTshirtSummary = () => {
    const tshirtSizeCounts = new Map();
    // Predvolené veľkosti tričiek
    const defaultSizes = availableTshirtSizes.length > 0 ? availableTshirtSizes : ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
    // Inicializácia mapy pre všetky veľkosti
    defaultSizes.forEach(size => tshirtSizeCounts.set(size, 0));
    // Prechádzať len dobrovoľníkov
    filteredUsers
        .filter(user => user.role === 'volunteer')
        .forEach(user => {
            const tshirtSize = user.tshirtSize;
            if (tshirtSize && tshirtSizeCounts.has(tshirtSize)) {
                tshirtSizeCounts.set(tshirtSize, tshirtSizeCounts.get(tshirtSize) + 1);
            }
        });
    return tshirtSizeCounts;
};
  
  // Nové useMemo pre výpočty súhrnu, ktoré závisia od allTeamsFlattened
  const teamSummary = React.useMemo(() => {
      let totalPlayers = 0;
      let totalMenTeamMembers = 0;
      let totalWomenTeamMembers = 0;
      let totalMenDrivers = 0; 
      let totalWomenDrivers = 0; 
      const totalTshirtQuantities = new Map(availableTshirtSizes.map(size => [size, 0])); // Inicializácia mapy pre tričká

      allTeamsFlattened.forEach(team => {
          totalPlayers += team._players;
          totalMenTeamMembers += team._menTeamMembersCount;
          totalWomenTeamMembers += team._womenTeamMembersCount;
          totalMenDrivers += team._menDriversCount; 
          totalWomenDrivers += team._womenDriversCount; 

          if (team._teamTshirtsMap) {
              team._teamTshirtsMap.forEach((quantity, size) => {
                  totalTshirtQuantities.set(size, (totalTshirtQuantities.get(size) || 0) + quantity);
              });
          }
      });

      return {
          totalPlayers,
          totalMenTeamMembers,
          totalWomenTeamMembers,
          totalMenDrivers, 
          totalWomenDrivers,
          totalTshirtQuantities
      };
  }, [allTeamsFlattened, availableTshirtSizes]);


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
        // Zabezpečiť, aby sa userProfileData nastavili z globálnych dát, ak sú k dispozícii
        if (window.globalUserProfileData) {
            setUserProfileData(window.globalUserProfileData);
        }
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
        // console.log('AllRegistrationsApp: Prijatá udalosť "globalDataUpdated". Aktualizujem lokálny stav.');
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
            // console.log("AllRegistrationsApp: Globálny onAuthStateChanged - Používateľ:", currentUser ? currentUser.uid : "N/A");
            setUser(currentUser);
            setUserProfileData(window.globalUserProfileData);
            if (!currentUser) {
                // console.log("AllRegistrationsApp: Používateľ nie je prihlásený, presmerovávam na login.html.");
                window.location.href = 'login.html';
            }
        });
    }

    return () => {
      if (unsubscribeGlobalAuth) {
          unsubscribeGlobalAuth();
      }
    };
  }, [isAuthReady, db, user, auth]);


  React.useEffect(() => {
    let unsubscribeUserDoc;

    if (isAuthReady && db && user) {
      // console.log(`AllRegistrationsApp: Pokúšam sa načítať používateľský dokument pre UID: ${user.uid}`);
      if (typeof window.showGlobalLoader === 'function') {
        window.showGlobalLoader();
      }

      try {
        const userDocRef = doc(db, 'users', user.uid);
        unsubscribeUserDoc = onSnapshot(userDocRef, (docSnapshot) => {
          if (docSnapshot.exists()) {
            const userData = docSnapshot.data();
            // console.log("AllRegistrationsApp: Používateľský dokument existuje, dáta:", userData);

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

            // console.log("AllRegistrationsApp: Načítanie používateľských dát dokončené.");
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
        // console.log("AllRegistrationsApp: Auth je ready a používateľ je null, presmerovávam na login.html");
        if (typeof window.hideGlobalLoader === 'function') {
          window.hideGlobalLoader();
        }
        window.location.href = 'login.html';
        return;
    } else if (!isAuthReady || !db || user === undefined) {
        // console.log("AllRegistrationsApp: Čakám na inicializáciu Auth/DB/User data. Aktuálne stavy: isAuthReady:", isAuthReady, "db:", !!db, "user:", user ? user.uid : "N/A", "userProfileData:", userProfileData ? userProfileData.role : "N/A", "isAuthReady:", isAuthReady);
    }

    return () => {
      if (unsubscribeUserDoc) {
          unsubscribeUserDoc();
      }
    };
  }, [isAuthReady, db, user, auth]);


  React.useEffect(() => {
    let unsubscribeAllUsers;
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

    // console.log("AllRegistrationsApp: [Effect: AllUsers] Spustené.");
    // console.log("AllRegistrationsApp: [Effect: AllUsers] Stav snímky - db:", !!db, "user:", user ? user.uid : "N/A", "userProfileData:", !!userProfileData, "role:", userProfileData ? userProfileData.role : "N/A", "approved:", userProfileData ? userProfileData.approved : "N/A", "isAuthReady:", isAuthReady);


    if (isAuthReady && db && user && user.uid && userProfileData && userProfileData.role === 'admin' && userProfileData.approved === true) {
        // console.log("AllRegistrationsApp: [Effect: AllUsers] Podmienky splnené: Schválený administrátor. Pokračujem v načítaní dát.");
        if (typeof window.showGlobalLoader === 'function') {
          window.showGlobalLoader();
        }

        try {
            const usersCollectionRef = collection(db, 'users');
            unsubscribeAllUsers = onSnapshot(usersCollectionRef, snapshot => {
                const usersData = snapshot.docs
                    .map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));

                // console.log("AllRegistrationsApp: [Effect: AllUsers] Všetci používatelia načítaní:", usersData.length, "používateľov.");
                setAllUsers(usersData);
                setFilteredUsers(usersData);
                if (typeof window.hideGlobalLoader === 'function') {
                  window.hideGlobalLoader();
                }
            }, error => {
                console.error("AllRegistrationsApp: [Effect: AllUsers] Chyba pri načítaní všetkých používateľov z Firestore:", error);
                setError(`Chyba pri načítaní používateľov: ${error.message}`);
                if (typeof window.hideGlobalLoader === 'function') {
                  window.hideGlobalLoader();
                }
                setUserNotificationMessage(`Chyba pri načítaní dát: ${error.message}`); // Použite error.message
            });
        } catch (e) {
            console.error("AllRegistrationsApp: [Effect: AllUsers] Chyba pri nastavovaní onSnapshot pre všetkých používateľov (try-catch):", e);
            setError(`Chyba pri načítaní používateľov: ${e.message}`);
            if (typeof window.hideGlobalLoader === 'function') {
              window.hideGlobalLoader();
            }
            setUserNotificationMessage(`Chyba pri načítaní dát: ${e.message}`);
        }
    } else if (isAuthReady && user === null) {
        // console.log("AllRegistrationsApp: [Effect: AllUsers] Používateľ je null, nenačítavam dáta. Presmerovávam na login.html.");
        if (typeof window.hideGlobalLoader === 'function') {
          window.hideGlobalLoader();
        }
        window.location.href = 'login.html';
        return;
    } else if (isAuthReady && userProfileData && (userProfileData.role !== 'admin' || userProfileData.approved === false)) {
        // console.log("AllRegistrationsApp: [Effect: AllUsers] Používateľ nie je schválený administrátor, nenačítavam dáta. Presmerovávam na my-data.html.");
        setError("Nemáte oprávnenie na zobrazenie tejto stránky. Iba schválení administrátori majú prístup.");
        if (typeof window.showGlobalLoader === 'function') {
          window.showGlobalLoader();
        }
        setUserNotificationMessage("Nemáte oprávnenie na zobrazenie tejto stránky.");
        window.location.href = 'logged-in-my-data.html';
        return;
    } else {
        // console.log("AllRegistrationsApp: [Effect: AllUsers] Podmienky pre načítanie dát nesplnené. Čakám na aktualizácie stavu.");
    }

    return () => {
        if (unsubscribeAllUsers) {
            // console.log("AllRegistrationsApp: [Effect: AllUsers] Ruším odber onSnapshot pre všetkých používateľov.");
            unsubscribeAllUsers();
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
          const columnDef = defaultColumnOrder.find(col => col.id === columnId); // Use defaultColumnOrder
          // console.log(`handleSort: Triedenie podľa stĺpca: ${columnId}, Smer: ${direction}`);
          // console.log(`handleSort: Nájdená definícia stĺpca pre ${columnId}:`, columnDef);

          const type = columnDef ? columnDef.type : 'string';

          let valA, valB;

          // Access top-level address fields directly
          if (['street', 'houseNumber', 'city', 'postalCode', 'country', 'note'].includes(columnId)) { // Added 'note'
            valA = a[columnId];
            valB = b[columnId];
          }
          else if (columnId.includes('.')) {
              valA = getNestedValue(a, columnId);
              valB = getNestedValue(b, columnId);
          } else {
              valA = a[columnId];
              valB = b[columnId];
          }

          if (type === 'date') {
              // Ensure we're comparing actual Date objects, handling the {seconds, nanoseconds} map format
              let dateA, dateB;
              if (valA && typeof valA.toDate === 'function') {
                  dateA = valA.toDate();
              } else if (valA && typeof valA === 'object' && valA.seconds !== undefined && valA.nanoseconds !== undefined) {
                  dateA = new Date(valA.seconds * 1000 + valA.nanoseconds / 1000000);
              } else {
                  dateA = new Date(0); // Fallback to epoch if not a valid date format
              }

              if (valB && typeof valB.toDate === 'function') {
                  dateB = valB.toDate();
              } else if (valB && typeof valB === 'object' && valB.seconds !== undefined && valB.nanoseconds !== undefined) {
                  dateB = new Date(valB.seconds * 1000 + valB.nanoseconds / 1000000);
              } else {
                  dateB = new Date(0); // Fallback to epoch if not a valid date format
              }
              
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
      // console.log("handleSort: Prvých 5 zoradených používateľov:", sorted.slice(0, 5).map(u => ({ id: u.id, [columnId]: getNestedValue(u, columnId) })));
  };

const openFilterModal = (column) => {
    setFilterColumn(column);
    // Pre stĺpec "role" generujeme zoznam preložených hodnôt, ale filtrovanie bude prebiehať na pôvodných
    if (column === 'role') {
      const roleValues = [
        { value: 'club', label: 'Klub' },
        { value: 'admin', label: 'Administrátor' },
        { value: 'volunteer', label: 'Dobrovoľník' },
        { value: 'referee', label: 'Rozhodca' }
      ];
      setUniqueColumnValues(roleValues);
    } else {
        // Pre ostatné stĺpce ostáva pôvodná logika
        const values = [...new Set(allUsers.map(u => {
            let val;
            if (column === 'registrationDate') {
                let date;
                const registrationDateValue = u.registrationDate;
                if (registrationDateValue && typeof registrationDateValue.toDate === 'function') {
                    date = registrationDateValue.toDate();
                } else if (registrationDateValue && typeof registrationDateValue === 'object' && registrationDateValue.seconds !== undefined && registrationDateValue.nanoseconds !== undefined) {
                    date = new Date(registrationDateValue.seconds * 1000 + registrationDateValue.nanoseconds / 1000000);
                } else {
                    return '';
                }
                const options = {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                };
                val = date.toLocaleString('sk-SK', options);
            } else if (column.includes('.')) {
                const parts = column.split('.');
                let nestedVal = u;
                for (const part of parts) {
                    nestedVal = nestedVal ? nestedVal[part] : undefined;
                }
                if (column === 'arrival.type') {
                    val = formatArrivalTime(nestedVal, getNestedValue(u, 'arrival.time'));
                } else {
                    val = nestedVal;
                }
            } else {
                val = u[column];
            }
            if (typeof val === 'boolean') {
                return val ? 'áno' : 'nie';
            }
            return String(val || '').toLowerCase();
        }))].filter(v => v !== '').sort();
        setUniqueColumnValues(values);
    }
    setFilterModalOpen(true);
};

  const closeFilterModal = () => {
      setFilterModalOpen(false);
      setFilterColumn('');
      setUniqueColumnValues([]);
  };

const applyFilter = (column, values) => {
    setActiveFilters(prev => ({ ...prev, [column]: values })); // Ukladáme pôvodné hodnoty
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
                  if (column === 'registrationDate') {
                      let date;
                      const registrationDateValue = user.registrationDate;
                      if (registrationDateValue && typeof registrationDateValue.toDate === 'function') {
                          date = registrationDateValue.toDate();
                      } else if (registrationDateValue && typeof registrationDateValue === 'object' && registrationDateValue.seconds !== undefined && registrationDateValue.nanoseconds !== undefined) {
                          date = new Date(registrationDateValue.seconds * 1000 + registrationDateValue.nanoseconds / 1000000);
                      } else {
                          return false; // Filter out if date is not valid
                      }

                      // Použiť rovnaký formát ako pri získavaní jedinečných hodnôt
                      const options = {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false
                      };
                      userValue = date.toLocaleString('sk-SK', options).toLowerCase();
                  } else if (column.includes('.')) {
                      const parts = column.split('.');
                      let nestedVal = user;
                      for (const part of parts) {
                          nestedVal = nestedVal ? nestedVal[part] : undefined;
                      }
                      // Špeciálne spracovanie pre arrival.type a arrival.time
                      if (column === 'arrival.type') {
                          userValue = formatArrivalTime(nestedVal, getNestedValue(user, 'arrival.time')).toLowerCase();
                      } else {
                          userValue = String(nestedVal || '').toLowerCase();
                      }
                  } else {
                      // Access top-level address fields directly for filtering
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
    // console.log(`AllRegistrationsApp: useEffect pre aktualizáciu odkazov hlavičky. Používateľ: ${user ? user.uid : 'null'}`);
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
      // console.log("AllRegistrationsApp: Používateľ prihlásený. Skryté: Prihlásenie, Registrácia. Zobrazené: Moja zóna, Odhlásenie.");
    } else {
      authLink.classList.remove('hidden');
      profileLink.classList.add('hidden');
      logoutButton.classList.add('hidden');
      registerLink.classList.remove('hidden');
      // console.log("AllRegistrationsApp: Používateľ odhlásený. Zobrazené: Prihlásenie, Registrácia. Skryté: Moja zóna, Odhlásenie.");
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
      setUserNotificationMessage("Odhlásený.");
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

  // Removed moveColumn function and related logic as column reordering is no longer supported.

  const handleSaveEditedData = React.useCallback(async (updatedDataFromModal, targetDocRef, originalDataPath, isNewEntryFlag, isTargetUserAdminFromModal, isTargetUserHallFromModal) => { // <--- ZMENENÝ PODPIS FUNKCIE
    if (!targetDocRef) {
        console.error("Chyba: Chýba odkaz na dokument pre uloženie.");
        setUserNotificationMessage("Chyba: Chýba odkaz na dokument pre uloženie. Zmeny neboli uložené.", 'error');
        return;
    }

    try {
        window.showGlobalLoader();
        
        // Tieto premenné sú teraz odovzdávané ako argumenty, takže ich už netreba tu lokálne derivovať.
        // const isEditingUser = editModalTitle.includes('Upraviť používateľa');
        // const currentEditingDataRole = editingData?.role;
        // const localIsTargetUserAdmin = isEditingUser && currentEditingDataRole === 'admin';
        // const localIsTargetUserHall = isEditingUser && currentEditingDataRole === 'hall';

        if (originalDataPath === '') {
            // Logika pre aktualizáciu používateľa na najvyššej úrovni
            // console.log("DEBUG: Aktualizácia top-level používateľa.");

            // Deep merge pre aktualizáciu používateľa
            const docSnapshot = await getDoc(targetDocRef);
            if (!docSnapshot.exists()) {
                throw new Error("Dokument používateľa sa nenašiel pre aktualizáciu.");
            }
            const currentDocData = docSnapshot.data();
            
            // Pripravíme finálne dáta na uloženie
            let finalDataToSave = { ...currentDocData };

            // Prejdeme všetky kľúče z updatedDataFromModal
            for (const key in updatedDataFromModal) {
                if (key === 'address' || key === 'billing') { // This should be 'billing' (not 'billingAddress')
                    finalDataToSave[key] = {
                        ...(currentDocData[key] || {}), // Pôvodná adresa
                        ...(updatedDataFromModal[key] || {}) // Aktualizovaná adresa
                    };

                    // Ak sa v updatedDataFromModal[key] vymaže pole (nastaví na ''), zabezpečíme, že sa to prejaví
                    if (updatedDataFromModal[key]) {
                        for (const subKey in currentDocData[key]) {
                            if (updatedDataFromModal[key][subKey] === undefined && typeof currentDocData[key][subKey] === 'string') {
                                finalDataToSave[key][subKey] = '';
                            }
                        }
                    } else if (currentDocData[key]) { // If updatedDataFromModal[key] is null/undefined but currentDocData[key] exists
                         // This means the entire nested object was conceptually cleared. Set all its sub-fields to empty string.
                        for (const subKey in currentDocData[key]) {
                            finalDataToSave[key][subKey] = '';
                        }
                    }
                } else if (typeof updatedDataFromModal[key] === 'object' && updatedDataFromModal[key] !== null && !Array.isArray(updatedDataFromModal[key])) {
                    // Pre iné vnorené objekty vykonajte hlbšie zlúčenie, aby sa zachovali existujúce vlastnosti
                    // a aktualizovali sa alebo pridali nové z updatedDataFromModal.
                    finalDataToSave[key] = {
                        ...(currentDocData[key] || {}), // Existujúce dáta
                        ...updatedDataFromModal[key] // Nové/aktualizované dáta
                    };
                    // Ak má `updatedDataFromModal[key]` prázdne polia, zabezpečte, aby sa aj pôvodné polia vymazali
                    if (updatedDataFromModal[key]) {
                        for (const subKey in currentDocData[key]) {
                            if (updatedDataFromModal[key][subKey] === undefined && typeof currentDocData[key][subKey] === 'string') {
                                finalDataToSave[key][subKey] = '';
                            }
                        }
                    }
                } else {
                    // Pre ostatné polia priama aktualizácia
                    finalDataToSave[key] = updatedDataFromModal[key];
                }
            }
            
            // Špeciálne ošetrenie pre vymazanie top-level adresných polí, ak boli predtým explicitne prítomné a teraz sú prázdne
            const addressFields = ['street', 'houseNumber', 'city', 'postalCode', 'country', 'note'];
            addressFields.forEach(field => {
                if (updatedDataFromModal[field] === '' && (currentDocData[field] !== undefined && currentDocData[field] !== '')) {
                    finalDataToSave[field] = '';
                }
            });

            const originalDataForCompare = { ...currentDocData };
            const modifiedDataForCompare = { ...finalDataToSave };

            // Použiť premenné odovzdané ako argumenty
            if (isTargetUserAdminFromModal || isTargetUserHallFromModal) { // <--- ZMENA TU
                delete originalDataForCompare.address;
                delete originalDataForCompare.billing; // Opravené na 'billing' namiesto 'billingAddress'
                delete modifiedDataForCompare.address;
                delete modifiedDataForCompare.billing; // Opravené na 'billing' namiesto 'billingAddress'
            }

            const generatedChanges = getChangesForNotification(originalDataForCompare, modifiedDataForCompare, formatDateToDMMYYYY); // Pass formatDateToDMMYYYY
            
            if (generatedChanges.length === 0) {
                setUserNotificationMessage("Žiadne zmeny na uloženie.", 'info');
                closeEditModal(); 
                return;
            }

            await updateDoc(targetDocRef, finalDataToSave);
            setUserNotificationMessage("Zmeny boli uložené.", 'success');
            closeEditModal(); 
            return;
        } else if (editModalTitle.includes('Upraviť tím') || editModalTitle.includes('Pridať nový tím')) {
            // ────────────────────────────────────────────────────────────────
            // Logika pre tím (nový alebo existujúci) – bez chybnej isReallyNew
            // ────────────────────────────────────────────────────────────────
        
            const docSnapshot = await getDoc(targetDocRef);
            if (!docSnapshot.exists()) {
                throw new Error("Dokument používateľa sa nenašiel pre aktualizáciu tímu.");
            }
            const currentDocData = docSnapshot.data();
        
            let actualCategory = updatedDataFromModal._category || updatedDataFromModal.category;
            if (!actualCategory) {
                throw new Error("Pre pridanie/úpravu tímu nebola zadaná kategória.");
            }
            const currentCategoryTeams = currentDocData.teams?.[actualCategory] || [];
        
            let originalTeam = {};
            let updatedTeam = {};
            let generatedChanges = [];
        
            // Spracovanie pôvodnej cesty pre existujúce tímy (na zistenie starej kategórie/indexu)
            let oldCategory = null;
            let oldTeamIndex = -1;
            const pathPartsFromOriginal = originalDataPath.split('.');
            if (pathPartsFromOriginal.length > 1) {
                const categoryAndIndexPartFromOriginal = pathPartsFromOriginal[1];
                const categoryMatchFromOriginal = categoryAndIndexPartFromOriginal.match(/^(.*?)\[(\d+)\]$/);
                if (categoryMatchFromOriginal) {
                    oldCategory = categoryMatchFromOriginal[1];
                    oldTeamIndex = parseInt(categoryMatchFromOriginal[2]);
                }
            }
        
            const isNewTeam = isNewEntryFlag && editModalTitle.includes('Pridať nový tím');
        
            if (isNewTeam) {
                // ─── NOVÝ TÍM ─────────────────────────────────────────────────────
                updatedTeam = { 
                    ...updatedDataFromModal, 
                    registeredBy: `${currentDocData.firstName || ''} ${currentDocData.lastName || ''}`.trim() 
                };
                const newTeamName = updatedTeam.teamName || 'Bez názvu';
                generatedChanges.push(`Nový tím bol pridaný: '${newTeamName} (Kategória: ${actualCategory})'`);
        
                // Uistiť sa, že kategória sedí
                updatedTeam.category = actualCategory;
                updatedTeam._category = actualCategory;
        
                const newCategoryTeams = [...currentCategoryTeams];
                newCategoryTeams.push(updatedTeam);
        
                const updates = {};
                updates[`teams.${actualCategory}`] = newCategoryTeams;
                await updateDoc(targetDocRef, updates);
        
                console.log("DEBUG: Nový tím pridaný do kategórie", actualCategory);
            } 
            else {
                // ─── ÚPRAVA EXISTUJÚCEHO TÍMU ─────────────────────────────────────
                if (!oldCategory || oldTeamIndex < 0) {
                    throw new Error("Neplatná pôvodná cesta pre úpravu existujúceho tímu.");
                }
        
                // Ak sa zmenila kategória
                if (oldCategory !== actualCategory) {
                    // 1. Odstrániť z pôvodnej kategórie
                    const oldCategoryTeams = currentDocData.teams?.[oldCategory] || [];
                    const updatedOldCategoryTeams = oldCategoryTeams.filter((_, idx) => idx !== oldTeamIndex);
        
                    // 2. Pridať do novej kategórie
                    const newCategoryTeams = currentDocData.teams?.[actualCategory] || [];
                    updatedTeam = { ...updatedDataFromModal };
                    updatedTeam.category = actualCategory;
                    updatedTeam._category = actualCategory;
        
                    const updatedNewCategoryTeams = [...newCategoryTeams, updatedTeam];
        
                    const updates = {};
                    updates[`teams.${oldCategory}`] = updatedOldCategoryTeams;
                    updates[`teams.${actualCategory}`] = updatedNewCategoryTeams;
        
                    const teamName = updatedTeam.teamName || 'Bez názvu';
                    generatedChanges.push(`Tím ${teamName}: Zmena Kategórie: z '${oldCategory}' na '${actualCategory}'`);
        
                    // Ostatné zmeny
                    originalTeam = JSON.parse(JSON.stringify(currentDocData.teams?.[oldCategory]?.[oldTeamIndex] || {}));
                    const otherChanges = getChangesForNotification(originalTeam, updatedTeam, formatDateToDMMYYYY);
                    generatedChanges.push(...otherChanges.map(ch => `Tím ${teamName} (${actualCategory}): ${ch}`));
        
                    await updateDoc(targetDocRef, updates);
                } 
                else {
                    // Rovnaká kategória → normálna úprava
                    originalTeam = JSON.parse(JSON.stringify(currentCategoryTeams[oldTeamIndex] || {}));
                    updatedTeam = { ...originalTeam };
        
                    for (const key in updatedDataFromModal) {
                        if (key === 'address' || key === 'billing') {
                            updatedTeam[key] = {
                                ...(originalTeam[key] || {}),
                                ...(updatedDataFromModal[key] || {})
                            };
                            if (updatedDataFromModal[key]) {
                                for (const subKey in originalTeam[key]) {
                                    if (updatedDataFromModal[key][subKey] === undefined && typeof originalTeam[key][subKey] === 'string') {
                                        updatedTeam[key][subKey] = '';
                                    }
                                }
                            } else if (originalTeam[key]) {
                                for (const subKey in originalTeam[key]) {
                                    updatedTeam[key][subKey] = "";
                                }
                            }
                        } else if (typeof updatedDataFromModal[key] === 'object' && updatedDataFromModal[key] !== null && !Array.isArray(updatedDataFromModal[key])) {
                            updatedTeam[key] = {
                                ...(originalTeam[key] || {}),
                                ...updatedDataFromModal[key]
                            };
                            if (updatedDataFromModal[key]) {
                                for (const subKey in originalTeam[key]) {
                                    if (updatedDataFromModal[key][subKey] === undefined && typeof originalTeam[key][subKey] === 'string') {
                                        updatedTeam[key][subKey] = '';
                                    }
                                }
                            }
                        } else {
                            updatedTeam[key] = updatedDataFromModal[key];
                        }
                    }
        
                    generatedChanges = getChangesForNotification(originalTeam, updatedTeam, formatDateToDMMYYYY);
        
                    if (generatedChanges.length === 0) {
                        setUserNotificationMessage("Žiadne zmeny na uloženie.", 'info');
                        closeEditModal();
                        return;
                    }
        
                    const teamName = updatedTeam.teamName || 'Bez názvu';
                    generatedChanges = generatedChanges.map(ch => `Tím ${teamName} (${actualCategory}): ${ch}`);
        
                    const newCategoryTeams = [...currentCategoryTeams];
                    newCategoryTeams[oldTeamIndex] = updatedTeam;
        
                    const updates = {};
                    updates[`teams.${actualCategory}`] = newCategoryTeams;
                    await updateDoc(targetDocRef, updates);
                }
            }
        
            setUserNotificationMessage("Zmeny tímu boli uložené.", 'success');
            closeEditModal();
            return;
        } else if (originalDataPath.includes('playerDetails') ||
           originalDataPath.includes('menTeamMemberDetails') ||
           originalDataPath.includes('womenTeamMemberDetails') ||
           originalDataPath.includes('driverDetailsMale') ||
           originalDataPath.includes('driverDetailsFemale')) {

    const pathParts = originalDataPath.split('.');
    if (pathParts.length !== 3) {
        throw new Error(`Neplatný formát cesty člena. Očakáva sa 3 segmenty.`);
    }

    const categoryAndIndexPart = pathParts[1];
    const memberArrayAndIndexPart = pathParts[2];

    const categoryMatch = categoryAndIndexPart.match(/^(.*?)\[(\d+)\]$/);
    if (!categoryMatch) throw new Error("Neplatný formát kategórie a indexu tímu");

    const category = categoryMatch[1];
    const teamIndex = parseInt(categoryMatch[2]);

    // ─── Kľúčová zmena ───────────────────────────────────────
    // Rozhodujeme podľa prítomnosti [-1] v ceste, nie podľa flagu
    const isReallyNew = memberArrayAndIndexPart.includes('[-1]');

    let memberArrayPath;
    let memberArrayIndex;

    if (isReallyNew) {
        const arrayNameMatch = memberArrayAndIndexPart.match(/^(.*?)\[-1\]$/);
        if (!arrayNameMatch) throw new Error("Neplatný formát [-1]");
        memberArrayPath = arrayNameMatch[1];
        memberArrayIndex = -1;
    } else {
        const existingMatch = memberArrayAndIndexPart.match(/^(.*?)\[(\d+)\]$/);
        if (!existingMatch) throw new Error("Neplatný formát indexu člena");
        memberArrayPath = existingMatch[1];
        memberArrayIndex = parseInt(existingMatch[2]);
    }

    // ────────────────────────────────────────────────────────────────
    // Načítanie aktuálneho dokumentu
    // ────────────────────────────────────────────────────────────────
    const docSnapshot = await getDoc(targetDocRef);
    if (!docSnapshot.exists()) {
        throw new Error("Dokument používateľa sa nenašiel.");
    }

    const currentDocData = docSnapshot.data();
    const teamsInCategory = currentDocData.teams?.[category] || [];
    if (teamIndex < 0 || teamIndex >= teamsInCategory.length) {
        throw new Error(`Tím s indexom ${teamIndex} v kategórii ${category} neexistuje.`);
    }

    // Hlboká kópia tímu, aby sme nič nezničili
    const teamToUpdate = JSON.parse(JSON.stringify(teamsInCategory[teamIndex]));

    let currentMemberArray = [...(teamToUpdate[memberArrayPath] || [])];

    // ────────────────────────────────────────────────────────────────
    // PRÍPAD 1: Pridávanie NOVÉHO člena
    // ────────────────────────────────────────────────────────────────
    if (isReallyNew) {

        const newMember = {
            ...updatedDataFromModal,
            address: updatedDataFromModal.address || {}
        };

        currentMemberArray.push(newMember);

        // ────────────────────────────────────────────────────────────────
        // Vlastná notifikácia – ŽIADNY diff, iba informácia o pridaní
        // ────────────────────────────────────────────────────────────────
        const memberName = `${newMember.firstName || ''} ${newMember.lastName || ''}`.trim() || 'bez mena';

        const memberType =
            editModalTitle.includes('hráč') ? 'Hráč' :
            editModalTitle.includes('člen realizačného tímu (žena)') ? 'Člen RT – žena' :
            editModalTitle.includes('člen realizačného tímu (muž)') ? 'Člen RT – muž' :
            editModalTitle.includes('šofér (žena)') ? 'Šofér – žena' :
            editModalTitle.includes('šofér (muž)') ? 'Šofér – muž' :
            'Člen tímu';

        const teamName = teamToUpdate.teamName || 'Bez názvu';
        const teamCategory = category;

        const addressStr = newMember.address
            ? [
                `${newMember.address.street || ''} ${newMember.address.houseNumber || ''}`.trim(),
                `${newMember.address.postalCode || ''} ${newMember.address.city || ''}`.trim(),
                newMember.address.country || ''
              ].filter(Boolean).join(', ') || '—'
            : '—';

        const additionMessage = [
            `Nový ${memberType} pridaný: ${memberName}`,
        ];

        if (newMember.dateOfBirth) {
            additionMessage.push(`Dátum narodenia: ${formatDateToDMMYYYY(newMember.dateOfBirth)}`);
        }
        if (newMember.jerseyNumber) {
            additionMessage.push(`Číslo dresu: ${newMember.jerseyNumber}`);
        }
        if (newMember.registrationNumber) {
            additionMessage.push(`Registračné číslo: ${newMember.registrationNumber}`);
        }
        if (addressStr !== '—') {
            additionMessage.push(`Adresa: ${addressStr}`);
        }
        additionMessage.push(`Tím: ${teamName} (${teamCategory})`);

        // Uloženie notifikácie do Firestore
        const userEmail = window.auth.currentUser?.email;
        if (userEmail) {
            const notificationsCollectionRef = collection(db, 'notifications');
            await addDoc(notificationsCollectionRef, {
                userEmail,
                changes: additionMessage,
                timestamp: serverTimestamp()
            });
            console.log("Notifikácia o pridaní nového člena uložená (bez diffu).");
        }

        teamToUpdate[memberArrayPath] = currentMemberArray;

        // VŽDY prepočítať počty
        const finalUpdatedTeam = recalculateTeamCounts(teamToUpdate);
    
        // Aktualizovať pole tímov v kategórii
        const updatedTeamsForCategory = [...teamsInCategory];
        updatedTeamsForCategory[teamIndex] = finalUpdatedTeam;
    
        // Uložiť celé pole naspäť
        const updates = {};
        updates[`teams.${category}`] = updatedTeamsForCategory;
    
        await updateDoc(targetDocRef, updates);
        // console.log(`→ Uložené: teams.${category}[${teamIndex}] s prepočítanými počtami`);

        // Zobrazenie používateľovi
        setUserNotificationMessage(
            `Pridaný ${memberType} ${memberName} do tímu ${teamName} (${teamCategory})`,
            'success'
        );

        // DÔLEŽITÉ: tu sa NEvolá getChangesForNotification → žiadne diff riadky
    }

    // ────────────────────────────────────────────────────────────────
    // PRÍPAD 2: Úprava EXISTUJÚCEHO člena
    // ────────────────────────────────────────────────────────────────
    else {
        if (memberArrayIndex < 0 || memberArrayIndex >= currentMemberArray.length) {
            throw new Error(`Člen na indexe ${memberArrayIndex} neexistuje v poli ${memberArrayPath}`);
        }
    
        const originalMember = JSON.parse(JSON.stringify(currentMemberArray[memberArrayIndex]));
        let updatedMember = { ...originalMember };
    
        // Aplikácia zmien z modálu
        for (const key in updatedDataFromModal) {
            if (key !== 'address') {
                updatedMember[key] = updatedDataFromModal[key];
            }
        }
    
        // Špeciálne spracovanie adresy
        updatedMember.address = { ...(originalMember.address || {}) };
        if (updatedDataFromModal.address) {
            for (const key in updatedDataFromModal.address) {
                updatedMember.address[key] = updatedDataFromModal.address[key];
            }
            // Vymazané polia → prázdny reťazec
            for (const key in originalMember.address) {
                if (updatedDataFromModal.address[key] === undefined && typeof originalMember.address[key] === 'string') {
                    updatedMember.address[key] = "";
                }
            }
        } else if (originalMember.address) {
            for (const key in originalMember.address) {
                updatedMember.address[key] = "";
            }
        }
    
        // Vypočítať zmeny
        const changes = getChangesForNotification(
            originalMember,
            updatedMember,
            formatDateToDMMYYYY
        );
    
        if (changes.length === 0) {
            setUserNotificationMessage("Žiadne zmeny na uloženie.", 'info');
            closeEditModal();
            return;
        }
    
        // ────────────────────────────────
        // Vytvorenie pekného prefixu
        // ────────────────────────────────
        const firstName  = updatedMember.firstName  || originalMember.firstName  || '';
        const lastName   = updatedMember.lastName   || originalMember.lastName   || '';
        const memberName = `${firstName} ${lastName}`.trim() || 'bez mena';
    
        const teamName    = teamToUpdate.teamName   || 'bez názvu';
        const teamCategory = category;  // hodnota získaná z cesty (Juniors, Kadeti, ...)
    
        // Typ člena – pekný text pre notifikáciu
        let memberTypeLabel = 'člen tímu';
        if (memberArrayPath === 'playerDetails')              memberTypeLabel = 'hráč';
        if (memberArrayPath === 'menTeamMemberDetails')       memberTypeLabel = 'člen RT (muž)';
        if (memberArrayPath === 'womenTeamMemberDetails')     memberTypeLabel = 'členka RT (žena)';
        if (memberArrayPath === 'driverDetailsMale')          memberTypeLabel = 'šofér (muž)';
        if (memberArrayPath === 'driverDetailsFemale')        memberTypeLabel = 'šoférka (žena)';
    
        // Finálny prefix pre KAŽDÝ riadok zmeny
        const prefix = `${memberName} – ${memberTypeLabel} – tím ${teamName} (${teamCategory}): `;
    
        // Pridáme prefix ku každému riadku zmeny
        const prefixedChanges = changes.map(change => prefix + change);
    
        // Uloženie notifikácie
        const userEmail = window.auth.currentUser?.email;
        if (userEmail && prefixedChanges.length > 0) {
            const notificationsCollectionRef = collection(db, 'notifications');
            await addDoc(notificationsCollectionRef, {
                userEmail,
                changes: prefixedChanges,
                timestamp: serverTimestamp()
            });
            console.log("Notifikácia o úprave člena uložená s prefixom");
        }
    
        // Zobrazenie používateľovi (môže byť aj kratšie)
        setUserNotificationMessage(`Zmeny uložené (${memberName}, ${teamName}).`, 'success');
    
        currentMemberArray[memberArrayIndex] = updatedMember;

        teamToUpdate[memberArrayPath] = currentMemberArray;
    
        // VŽDY prepočítať počty
        const finalUpdatedTeam = recalculateTeamCounts(teamToUpdate);
    
        // Aktualizovať pole tímov v kategórii
        const updatedTeamsForCategory = [...teamsInCategory];
        updatedTeamsForCategory[teamIndex] = finalUpdatedTeam;
    
        // Uložiť celé pole naspäť
        const updates = {};
        updates[`teams.${category}`] = updatedTeamsForCategory;
    
        await updateDoc(targetDocRef, updates);
        // console.log(`→ Uložené: teams.${category}[${teamIndex}] s prepočítanými počtami`);
        
    }
    
    // ────────────────────────────────────────────────────────────────
    // Spoločný kód – uloženie zmien do Firestore
    // ────────────────────────────────────────────────────────────────
    teamToUpdate[memberArrayPath] = currentMemberArray;
    const finalUpdatedTeam = recalculateTeamCounts(teamToUpdate);

    const updatedTeamsForCategory = [...teamsInCategory];
    updatedTeamsForCategory[teamIndex] = finalUpdatedTeam;

    const updates = {};
    updates[`teams.${category}`] = updatedTeamsForCategory;

    await updateDoc(targetDocRef, updates);

    closeEditModal();
  }else {
            // Všeobecná vnorená aktualizácia
            if (!originalDataPath) {
                throw new Error("Cesta na uloženie dát (originalDataPath) je prázdna pre všeobecnú vnorenú aktualizáciu. Zmeny neboli uložené.");
            }
            const docSnapshot = await getDoc(targetDocRef);
            if (!docSnapshot.exists()) {
                throw new Error("Dokument sa nenašiel pre aktualizáciu.");
            }
            const currentDocData = docSnapshot.data();

            const { updatedObject, topLevelField } = updateNestedObjectByPath(currentDocData, originalDataPath, updatedDataFromModal);

            const updates = {};
            updates[topLevelField] = updatedObject[topLevelField];
            
            await updateDoc(targetDocRef, updates);
            setUserNotificationMessage("Zmeny boli uložené.", 'success');
            closeEditModal(); 
            return;
        }
    } catch (e) {
        console.error("Chyba pri ukladaní dát do Firestore (AllRegistrationsApp handleSaveEditedData):", e);
        setError(`Chyba pri ukladaní dát: ${e.message}`);
        setUserNotificationMessage(`Chyba pri ukladaní dát: ${e.message}`, 'error');
    } finally {
        window.hideGlobalLoader();
    }
  }, [db, closeEditModal, setUserNotificationMessage, setError, editModalTitle, editingData, getChangesForNotification]); // REMOVED MODAL-SPECIFIC STATES FROM DEPENDENCY ARRAY


const handleDeleteMember = React.useCallback(async (targetDocRef, originalDataPath) => {
    if (!targetDocRef || !originalDataPath) {
        console.error("Chyba: Chýba odkaz na dokument alebo cesta pre odstránenie člena.");
        setUserNotificationMessage("Chyba: Chýba odkaz na dokument alebo cesta pre odstránenie.", 'error');
        return;
    }

    try {
        window.showGlobalLoader();

        const pathParts = originalDataPath.split('.');
        if (pathParts.length !== 3) {
            throw new Error(`Neplatný formát cesty člena. Očakáva sa 3 segmenty, našlo sa ${pathParts.length}.`);
        }

        const categoryAndIndexPart = pathParts[1];
        const memberArrayAndIndexPart = pathParts[2];

        const categoryMatch = categoryAndIndexPart.match(/^(.*?)\[(\d+)\]$/);
        if (!categoryMatch) throw new Error("Neplatný formát kategórie a indexu tímu");

        const category = categoryMatch[1];
        const teamIndex = parseInt(categoryMatch[2]);

        const memberArrayMatch = memberArrayAndIndexPart.match(/^(.*?)\[(\d+)\]$/);
        if (!memberArrayMatch) throw new Error("Neplatný formát poľa člena a indexu");

        const memberArrayPath = memberArrayMatch[1];
        const memberArrayIndex = parseInt(memberArrayMatch[2]);

        // Načítame aktuálny dokument
        const docSnapshot = await getDoc(targetDocRef);
        if (!docSnapshot.exists()) {
            throw new Error("Dokument používateľa sa nenašiel.");
        }

        const currentDocData = docSnapshot.data();
        const teamsInCategory = currentDocData.teams?.[category] || [];

        if (teamIndex < 0 || teamIndex >= teamsInCategory.length) {
            throw new Error(`Tím s indexom ${teamIndex} v kategórii ${category} neexistuje.`);
        }

        // Hlboká kópia tímu, ktorý ideme upravovať
        const teamToUpdate = JSON.parse(JSON.stringify(teamsInCategory[teamIndex]));

        let currentMemberArray = [...(teamToUpdate[memberArrayPath] || [])];

        if (memberArrayIndex < 0 || memberArrayIndex >= currentMemberArray.length) {
            throw new Error(`Člen na indexe ${memberArrayIndex} neexistuje v poli ${memberArrayPath}`);
        }

        const memberToRemove = currentMemberArray[memberArrayIndex];
        const memberName = `${memberToRemove.firstName || ''} ${memberToRemove.lastName || ''}`.trim() || 'bez mena';

        // Odstránime člena
        currentMemberArray.splice(memberArrayIndex, 1);
        teamToUpdate[memberArrayPath] = currentMemberArray;

        // === Kľúčová časť – prepočítame a uložíme počty ===
        const finalUpdatedTeam = recalculateTeamCounts(teamToUpdate);

        // Pripravíme aktualizované pole tímov v danej kategórii
        const updatedTeamsForCategory = [...teamsInCategory];
        updatedTeamsForCategory[teamIndex] = finalUpdatedTeam;

        // Uložíme celé pole naspäť
        const updates = {};
        updates[`teams.${category}`] = updatedTeamsForCategory;

        await updateDoc(targetDocRef, updates);

        // Notifikácia používateľovi
        setUserNotificationMessage(`${memberName} bol odstránený z tímu.`, 'success');
        closeEditModal();

    } catch (e) {
        console.error("Chyba pri odstraňovaní člena tímu:", e);
        setError(`Chyba pri odstraňovaní člena: ${e.message}`);
        setUserNotificationMessage(`Chyba: ${e.message}`, 'error');
    } finally {
        window.hideGlobalLoader();
    }
}, [db, closeEditModal, setUserNotificationMessage, setError]);

  // Nová funkcia na odstránenie tímu
  const handleDeleteTeam = React.useCallback(async (targetDocRef, originalDataPath) => {
    if (!targetDocRef || !originalDataPath) {
        console.error("Chyba: Chýba odkaz na dokument alebo cesta pre odstránenie tímu.");
        setUserNotificationMessage("Chyba: Chýba odkaz na dokument alebo cesta pre odstránenie tímu. Zmeny neboli uložené.", 'error');
        return;
    }

    try {
        window.showGlobalLoader();

        const pathParts = originalDataPath.split('.');
        if (pathParts.length !== 2) { // Očakávame formát 'teams.Category[index]'
            throw new Error(`Neplatný formát cesty tímu pre odstránenie. Očakáva sa 2 segmenty (teams.category[index]), našlo sa ${pathParts.length}. Original Data Path: ${originalDataPath}`);
        }

        const categoryAndIndexPart = pathParts[1];
        const categoryMatch = categoryAndIndexPart.match(/^(.*?)\[(\d+)\]$/);

        if (!categoryMatch) {
            throw new Error(`Neplatný formát kategórie a indexu tímu: ${categoryAndIndexPart}.`);
        }

        const category = categoryMatch[1];
        const teamIndex = parseInt(categoryMatch[2]);

        const docSnapshot = await getDoc(targetDocRef);
        if (!docSnapshot.exists()) {
            throw new Error("Dokument používateľa sa nenašiel pre odstránenie tímu.");
        }
        const currentDocData = docSnapshot.data();

        const teamsInCategory = currentDocData.teams?.[category] || [];
        
        if (teamIndex >= 0 && teamIndex < teamsInCategory.length) {
            const teamToRemove = teamsInCategory[teamIndex];
            const teamName = teamToRemove.teamName || 'Bez názvu';

            const updatedTeamsInCategory = [...teamsInCategory];
            updatedTeamsInCategory.splice(teamIndex, 1); // Odstráni tím z poľa

            const updates = {};
            // Ak je kategória po odstránení tímu prázdna, môžeme ju odstrániť úplne.
            if (updatedTeamsInCategory.length === 0) {
                updates[`teams.${category}`] = deleteField(); // Použiť deleteField pre odstránenie poľa
            } else {
                updates[`teams.${category}`] = updatedTeamsInCategory;
            }
            
            await updateDoc(targetDocRef, updates);

            // Zaznamenať notifikáciu
            const userEmail = window.auth.currentUser?.email;
            if (userEmail) {
                const notificationsCollectionRef = collection(db, 'notifications');
                await addDoc(notificationsCollectionRef, {
                    userEmail,
                    changes: [`Tím '${teamName}' bol odstránený z kategórie '${category}'.`],
                    timestamp: serverTimestamp()
                });
                console.log("Notifikácia o odstránení tímu uložená do Firestore.");
            }

            setUserNotificationMessage(`Tím '${teamName}' bol odstránený.`, 'success');
            closeEditModal();
        } else {
            throw new Error(`Tím na odstránenie sa nenašiel na ceste: ${originalDataPath}.`);
        }
    } catch (e) {
        console.error("Chyba pri odstraňovaní tímu z Firestore:", e);
        setError(`Chyba pri odstraňovaní tímu: ${e.message}`);
        setUserNotificationMessage(`Chyba pri odstraňovaní tímu: ${e.message}`, 'error');
    } finally {
        window.hideGlobalLoader();
    }
  }, [db, closeEditModal, setUserNotificationMessage, setError]);


    // Handler pre otvorenie modálneho okna na pridanie tímu
    const handleOpenAddTeamModal = (userIdForNewTeam) => { // Prijíma userId pre nový tím
        if (!user || !db || !userProfileData || !userProfileData.role) {
            setUserNotificationMessage("Chyba: Nie ste prihlásený alebo nemáte dostatočné oprávnenia na pridanie tímu.", 'error');
            return;
        }

        // Predvolené dáta pre nový tím (môžu byť prázdne alebo s predvolenými hodnotami)
        const newTeamData = {
            teamName: '',
            category: '', // Kategória by mala byť vybraná v modálnom okne
            _category: '', // Taktiež pre konzistentnosť
            arrival: { type: '', time: '' }, // Inicializovať aj čas príchodu
            accommodation: { type: '' },
            packageDetails: { name: '' },
            tshirts: [],
            playerDetails: [],
            menTeamMemberDetails: [],
            womenTeamMemberDetails: [],
            driverDetailsMale: [],
            driverDetailsFemale: [],
        };
        
        // Cesta pre uloženie nového tímu: použijeme fiktívny index -1 na signalizáciu nového záznamu
        // Predpokladajme, že sa pridáva do nejakej default kategórie (napr. 'NewCategory'),
        // ale skutočná kategória sa vyberie v modálnom okne a prepíše sa.
        const newTeamPath = `teams.NewCategory[-1]`; 
        // Použijeme userIdForNewTeam, ak je odovzdané, inak userId aktuálneho prihláseného admina
        const targetDocRefForNewTeam = doc(db, 'users', userIdForNewTeam || user.uid);

        openEditModal(newTeamData, 'Pridať nový tím', targetDocRefForNewTeam, newTeamPath, true); // Nastaviť isNewEntry na true
    };


  if (!isAuthReady || user === undefined || !userProfileData) {
    if (typeof window.showGlobalLoader === 'function') {
      window.showGlobalLoader();
    }
    return null;
  }

  if (userProfileData && (userProfileData.role !== 'admin' || userProfileData.approved === false)) {
      // console.log("AllRegistrationsApp: Používateľ nie je schválený administrátor. Presmerovávam na logged-in-my-data.html.");
      setError("Nemáte oprávnenie na zobrazenie tejto stránky. Iba schválení administrátori majú prístup.");
      if (typeof window.showGlobalLoader === 'function') {
        window.showGlobalLoader();
      }
      setUserNotificationMessage("Nemáte oprávnenie na zobrazenie tejto stránky.");
      window.location.href = 'logged-in-my-data.html';
      return null;
  }

  const shouldShowExpander = (u) => {
      return u.role !== 'admin' && showTeams && u.teams && Object.keys(u.teams).length > 0;
  };

  // Nová pomocná funkcia na formátovanie hodnôt v bunkách tabuľky
const formatTableCellValue = (value, columnId, userObject) => {
  if (value === null || value === undefined || value === "") return '-';

    if (columnId === 'role') {
    switch (value) {
      case 'club':
        return 'Klub';
      case 'admin':
        return 'Administrátor';
      case 'volunteer':
        return 'Dobrovoľník';
      case 'referee':
        return 'Rozhodca';
      default:
        return value;
    }
  }

  // Špecifické formátovanie na základe ID stĺpca
  if (columnId === 'registrationDate') {
    let date;
    // Ak je to Firebase Timestamp objekt s .toDate() metódou
    if (value && typeof value.toDate === 'function') {
      date = value.toDate();
    }
    // Ak je to mapa {seconds, nanoseconds} a nemá .toDate() metódu
    else if (value && typeof value === 'object' && value.seconds !== undefined && value.nanoseconds !== undefined) {
      // Vytvorenie Date objektu zo sekúnd a nanosekúnd
      date = new Date(value.seconds * 1000 + value.nanoseconds / 1000000);
    } else {
      return '-'; // Vrátiť pomlčku, ak hodnota nie je platný dátumový formát
    }
    try {
      // Formát DD. MM. YYYY hh:mm
      const options = {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false // Použiť 24-hodinový formát
      };
      return date.toLocaleString('sk-SK', options);
    } catch (e) {
      console.error("Chyba pri formátovaní dátumu v tabuľke:", value, e);
      return '[Chyba Dátumu]'; // Záložná reťazcová reprezentácia pri chybe
    }
  }
  else if (columnId === 'approved') {
    return value ? 'Áno' : 'Nie';
  }
  else if (columnId === 'postalCode') {
        return formatPostalCodeForDisplay(value);
  }
  else if (columnId === 'contactPhoneNumber') {
    const { dialCode, numberWithoutDialCode } = parsePhoneNumber(value, countryDialCodes);
    const formattedNumber = formatNumberGroups(numberWithoutDialCode);
    return `${dialCode} ${formattedNumber}`;
  }
  // Handle top-level address fields
  else if (['street', 'houseNumber', 'city', 'country', 'note'].includes(columnId)) {
    return value;
  }
  else if (columnId === 'arrival.type') {
    const arrivalType = getNestedValue(userObject, 'arrival.type');
    const arrivalTime = getNestedValue(userObject, 'arrival.time');
    return formatArrivalTime(arrivalType, arrivalTime);
  }
  // --- NOVÉ STĽPCE ---
  else if (columnId === 'tshirtSize') {
    return value || '-'; // Zobraziť veľkosť trička alebo pomlčku
  }
  else if (columnId === 'selectedDates') {
    if (!value || !Array.isArray(value)) return '-';
    // Prevedenie dátumov z "yyyy-mm-dd" na "dd. mm. yyyy"
    return value
      .map(dateStr => {
        const [year, month, day] = dateStr.split('-');
        return `${day}. ${month}. ${year}`;
      })
      .join(', ');
  }
  else if (columnId === 'volunteerRoles') {
    if (!value || !Array.isArray(value)) return '-';
    // Ak je to pole, zobrazíme jeho prvky oddelené čiarkou
    return value.join(', ');
  }
  // --- KONIEC NOVÝCH STāPCOV ---

  // Všeobecné formátovanie pre iné prípady, podobné formatDisplayValue
  if (typeof value === 'boolean') return value ? 'Áno' : 'Nie';
  if (Array.isArray(value)) {
    return value.map(item => {
      if (typeof item === 'object' && item !== null) {
        // Pre vnorené objekty v poliach poskytnúť súhrn alebo zjednodušený reťazec
        if (item.firstName && item.lastName) return `${item.firstName} ${item.lastName}`;
        if (item.size) return item.size; // Pre veľkosti tričiek
        return '[Objekt]'; // Všeobecné pre iné objekty
      }
      return String(item);
    }).join(', ');
  }
  if (typeof value === 'object') {
    // Heuristika pre bežné komplexné objekty
    // Adresný objekt (len pre vnorené, ak by sa taký našiel)
    if (value.street || value.city) {
      return `${value.street || ''} ${value.houseNumber || ''}, ${value.postalCode || ''} ${value.city || ''}, ${value.country || ''}`;
    }
    if (value.name || value.type) { // Objekt balíka, ubytovania, príchodu
      return value.name || value.type;
    }
    // Záložná možnosť pre akýkoľvek iný objekt
    try {
      return JSON.stringify(value);
    } catch (e) {
      console.error("Chyba pri prevode objektu na reťazec pre bunku tabuľky:", value, e);
      return '[Objekt]';
    }
  }
  return String(value);
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
        onClearFilter: clearFilter,
        uniqueColumnValues: uniqueColumnValues
    }),
    // Removed ColumnVisibilityModal component rendering
    React.createElement(DataEditModal, {
        isOpen: isEditModalOpen,
        onClose: closeEditModal,
        title: editModalTitle,
        data: editingData,
        onSave: handleSaveEditedData, // Odovzdať handler na uloženie
        onDeleteMember: handleDeleteMember, // Odovzdať handler pre odstránenie člena
        onDeleteTeam: handleDeleteTeam, // Odovzdať handler pre odstránenie tímu
        targetDocRef: editingDocRef,    // Odovzdať referenciu na dokument
        originalDataPath: editingDataPath, // Odovzdať cestu v dokumente
        setUserNotificationMessage: setUserNotificationMessage, // Preposielame setter notifikácie
        setError: setError, // Preposielame setter chýb
        isNewEntry: isNewEntry, // Odovzdať príznak
        getChangesForNotification: getChangesForNotification, // Pass the helper function as a prop
        formatDateToDMMYYYY: formatDateToDMMYYYY, // Pass formatDateToDMMYYYY as a prop
        currentUserId: user?.uid, // Pass the current user ID to the modal
        editModalTitle: editModalTitle // Pass editModalTitle as a prop
    }),
    // Modálne okno na výber typu člena
    React.createElement(AddMemberTypeSelectionModal, {
        isOpen: isAddMemberTypeSelectionModalOpen,
        onClose: () => setIsAddMemberTypeSelectionModalOpen(false),
        onSelectType: handleSelectedMemberTypeAndOpenEdit
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
            // Removed "Upraviť stĺpce" button
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
                                React.createElement('th', { className: 'py-2 px-2 text-center whitespace-nowrap min-w-max' }, 'Šofér (ž)'), 
                                React.createElement('th', { className: 'py-2 px-2 text-center whitespace-nowrap min-w-max' }, 'Šofér (m)'), 
                                React.createElement('th', { className: 'py-2 px-2 text-center whitespace-nowrap min-w-max' }, 'Spolu'), 
                                React.createElement('th', { className: 'py-2 px-2 text-left whitespace-nowrap min-w-max' }, 'Doprava'),
                                React.createElement('th', { className: 'py-2 px-2 text-left whitespace-nowrap min-w-max' }, 'Ubytovanie'),
                                React.createElement('th', { className: 'py-2 px-2 text-left whitespace-nowrap min-w-max' }, 'Balík'),
                                (availableTshirtSizes && availableTshirtSizes.length > 0 ? availableTshirtSizes : ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']).map(size =>
                                    React.createElement('th', { key: `tshirt-header-${size}`, className: 'py-2 px-2 text-center whitespace-nowrap min-w-max' }, `${size.toUpperCase()}`)
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
                                columnOrder.map((col) => ( // Iterate directly over columnOrder
                                    React.createElement('th', {
                                        key: col.id,
                                        scope: 'col',
                                        className: `py-3 px-6 relative group whitespace-nowrap min-w-max`,
                                        onMouseEnter: () => setHoveredColumn(col.id),
                                        onMouseLeave: () => setHoveredColumn(null)
                                    },
                                        React.createElement('div', { className: 'flex items-center justify-center h-full space-x-1' },
                                            // Removed left/right move buttons
                                            React.createElement('button', {
                                                onClick: (e) => { e.stopPropagation(); openFilterModal(col.id); },
                                                className: `text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 ${activeFilters[col.id] && activeFilters[col.id].length > 0 ? 'opacity-100 text-blue-500' : 'opacity-0 group-hover:opacity-100'} transition-opacity duration-200`
                                            }, '⚙️')
                                            // Removed right move button
                                        )
                                        ,
                                        React.createElement('span', { onClick: () => handleSort(col.id), className: 'flex items-center cursor-pointer' },
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
                            React.createElement('td', { colSpan: columnOrder.length + 1, className: 'py-4 px-6 text-center text-gray-500' }, 'Žiadne registrácie na zobrazenie.')
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
                                                className: `bg-white border-b hover:bg-gray-50`,
                                            },
                                            React.createElement('td', {
                                                className: 'py-3 px-2 text-center whitespace-nowrap min-w-max flex items-center justify-center',
                                            },
                                                React.createElement('span', {
                                                    onClick: (e) => {
                                                        e.stopPropagation();
                                                        toggleTeamRowExpansion(teamUniqueId);
                                                    },
                                                    className: 'text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-200 focus:outline-none mr-1 cursor-pointer'
                                                }, expandedTeamRows[teamUniqueId] ? '▲' : '▼'),
                                                React.createElement('button', {
                                                    onClick: (e) => {
                                                        e.stopPropagation();
                                                        const targetDocRefForTeam = doc(db, 'users', team._userId);
                                                        const teamPathForSaving = `teams.${team._category}[${team._teamIndex}]`;
                                                        const resolvedTitle = `Upraviť tím: ${team.teamName}`;
                                                        openEditModal(
                                                            team,
                                                            resolvedTitle,
                                                            targetDocRefForTeam,
                                                            teamPathForSaving
                                                        );
                                                    },
                                                    className: 'text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-200 focus:outline-none'
                                                }, '⚙️')
                                            ),
                                            React.createElement('td', { className: 'py-3 px-2 text-center whitespace-nowrap min-w-max' }, team._category || '-'),
                                            React.createElement('td', { className: 'py-3 px-2 text-left whitespace-nowrap min-w-max' }, team.teamName || `Tím`),
                                            React.createElement('td', { className: 'py-3 px-2 text-center whitespace-nowrap min-w-max' }, team._players),
                                            React.createElement('td', { className: 'py-3 px-2 text-center whitespace-nowrap min-w-max' }, team._womenTeamMembersCount),
                                            React.createElement('td', { className: 'py-3 px-2 text-center whitespace-nowrap min-w-max' }, team._menTeamMembersCount),
                                            React.createElement('td', { className: 'py-3 px-2 text-center whitespace-nowrap min-w-max' }, team._womenDriversCount),
                                            React.createElement('td', { className: 'py-3 px-2 text-center whitespace-nowrap min-w-max' }, team._menDriversCount),
                                            React.createElement('td', { className: 'py-3 px-2 text-center whitespace-nowrap min-w-max' }, team._players + team._womenTeamMembersCount + team._menTeamMembersCount + team._womenDriversCount + team._menDriversCount || '-'),
                                            React.createElement('td', { className: 'py-3 px-2 text-left whitespace-nowrap min-w-max' }, formatArrivalTime(team.arrival?.type, team.arrival?.time)),
                                            React.createElement('td', { className: 'py-3 px-2 text-left whitespace-nowrap min-w-max' }, team.accommodation?.type || '-'),
                                            React.createElement('td', { className: 'py-3 px-2 text-left whitespace-nowrap min-w-max' }, team.packageDetails?.name || '-'),
                                            (availableTshirtSizes && availableTshirtSizes.length > 0 ? availableTshirtSizes : ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']).map(size =>
                                                React.createElement('td', { key: `tshirt-data-${teamUniqueId}-${size}`, className: 'py-3 px-2 text-center whitespace-nowrap min-w-max' }, team._teamTshirtsMap.get(size) || '-')
                                            )
                                        ),
                                        expandedTeamRows[teamUniqueId] && (!showUsers && showTeams) && React.createElement(
                                            'tr',
                                            { key: `${teamUniqueId}-details`, className: 'bg-gray-100' },
                                            React.createElement('td', { colSpan: defaultColumnOrder.length + 2, className: 'p-0' },
                                                React.createElement(TeamDetailsContent, {
                                                    team: team,
                                                    tshirtSizeOrder: availableTshirtSizes,
                                                    showDetailsAsCollapsible: false,
                                                    showUsersChecked: showUsers,
                                                    showTeamsChecked: showTeams,
                                                    openEditModal: openEditModal,
                                                    db: db,
                                                    setUserNotificationMessage: setUserNotificationMessage,
                                                    onAddMember: handleOpenAddMemberTypeModal
                                                })
                                            )
                                        )
                                    );
                                }),
                                (allTeamsFlattened.length > 0 && !showUsers && showTeams) && React.createElement(
                                    'tr',
                                    { className: 'bg-gray-100 font-bold text-gray-700 uppercase' },
                                    React.createElement('td', { className: 'py-3 px-2 text-right', colSpan: 3 }, 'Súhrn:'),
                                
                                    // Hráči
                                    React.createElement('td', {
                                        className: 'py-3 px-2 text-center cursor-default',
                                        title: 'Celkový počet hráčov'
                                    }, teamSummary.totalPlayers),
                                
                                    // R. tím (ž)
                                    React.createElement('td', {
                                        className: 'py-3 px-2 text-center cursor-default',
                                        title: 'Celkový počet členov realizačného tímu – ženy'
                                    }, teamSummary.totalWomenTeamMembers),
                                
                                    // R. tím (m)
                                    React.createElement('td', {
                                        className: 'py-3 px-2 text-center cursor-default',
                                        title: 'Celkový počet členov realizačného tímu – muži'
                                    }, teamSummary.totalMenTeamMembers),
                                
                                    // Šofér (ž)
                                    React.createElement('td', {
                                        className: 'py-3 px-2 text-center cursor-default',
                                        title: 'Celkový počet šoférov – ženy'
                                    }, teamSummary.totalWomenDrivers),
                                
                                    // Šofér (m)
                                    React.createElement('td', {
                                        className: 'py-3 px-2 text-center cursor-default',
                                        title: 'Celkový počet šoférov – muži'
                                    }, teamSummary.totalMenDrivers),
                                
                                    // Spolu
                                    React.createElement('td', {
                                        className: 'py-3 px-2 text-center cursor-default',
                                        title: 'Celkový počet osôb (hráči + realizačný tím + šoféri)'
                                    },
                                        teamSummary.totalPlayers +
                                        teamSummary.totalWomenTeamMembers +
                                        teamSummary.totalMenTeamMembers +
                                        teamSummary.totalWomenDrivers +
                                        teamSummary.totalMenDrivers
                                    ),
                                
                                    // Tričká: (textový stĺpec)
                                    React.createElement('td', {
                                        className: 'py-3 px-2 text-right',
                                        colSpan: 3
                                    }, 'Tričká:'),
                                
                                    // Veľkosti tričiek
                                    (availableTshirtSizes && availableTshirtSizes.length > 0 ? availableTshirtSizes : ['XXS','XS','S','M','L','XL','XXL','XXXL']).map(size =>
                                        React.createElement('td', {
                                            key: `summary-tshirt-${size}`,
                                            className: 'py-3 px-2 text-center cursor-default',
                                            title: `Celkový počet tričiek veľkosti ${size}`
                                        }, teamSummary.totalTshirtQuantities.get(size) || 0)
                                    )
                                )
                            )
                        ) : (
                            filteredUsers.map(u => (
                                React.createElement(
                                    React.Fragment,
                                    { key: u.id },
                                    React.createElement(
                                        'tr',
                                        {
                                            className: `bg-white border-b hover:bg-gray-50`,
                                        },
                                        React.createElement('td', {
                                            className: 'py-3 px-2 text-center min-w-max flex items-center justify-center',
                                        },
                                            shouldShowExpander(u)
                                                ? React.createElement('button', {
                                                    onClick: (e) => {
                                                        e.stopPropagation();
                                                        toggleRowExpansion(u.id);
                                                    },
                                                    className: 'text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-200 focus:outline-none mr-1'
                                                }, expandedRows[u.id] ? '▲' : '▼')
                                                : React.createElement('span', { className: 'mr-1' }, '-'),
                                            React.createElement('button', {
                                                onClick: (e) => {
                                                    e.stopPropagation();
                                                    openEditModal(
                                                        u,
                                                        `Upraviť používateľa: ${u.firstName} ${u.lastName}`,
                                                        doc(db, 'users', u.id),
                                                        '',
                                                        false
                                                    );
                                                },
                                                className: 'text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-200 focus:outline-none'
                                            }, '⚙️')
                                        ),
                                        columnOrder.map(col => (
                                            React.createElement('td', { key: col.id, className: 'py-3 px-6 text-left whitespace-nowrap min-w-max' },
                                                formatTableCellValue(getNestedValue(u, col.id), col.id, u)
                                            )
                                        ))
                                    ),
                                    expandedRows[u.id] && showTeams && React.createElement(
                                        'tr',
                                        { key: `${u.id}-details`, className: 'bg-gray-100' },
                                        React.createElement('td', { colSpan: columnOrder.length + 1, className: 'p-0' },
                                            showUsers && showTeams && React.createElement('div', { className: 'flex justify-center mt-4 mb-2' },
                                                React.createElement('button', {
                                                    className: 'w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center text-2xl font-bold hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50',
                                                    onClick: (e) => {
                                                        e.stopPropagation();
                                                        handleOpenAddTeamModal(u.id);
                                                    }
                                                }, '+')
                                            ),
                                            Object.entries(u.teams || {}).map(([category, teamListRaw]) =>
                                                (Array.isArray(teamListRaw) ? teamListRaw : []).map((team, teamIndex) => {
                                                    let menTeamMembersCount = team.menTeamMemberDetails?.length || 0;
                                                    let womenTeamMembersCount = team.womenTeamMemberDetails?.length || 0;
                                                    let menDriversCount = team.driverDetailsMale?.length || 0;
                                                    let womenDriversCount = team.driverDetailsFemale?.length || 0;
                                                    let playersCount = team.playerDetails?.length || 0;
                                                    const teamTshirtsMap = new Map(
                                                        (team.tshirts || []).map(t => [String(t.size).trim(), t.quantity || 0])
                                                    );
                                                    return React.createElement(TeamDetailsContent, {
                                                        key: `${u.id}-${category}-${teamIndex}-details-content`,
                                                        team: {
                                                            ...team,
                                                            _category: category,
                                                            _registeredBy: `${u.firstName} ${u.lastName}`,
                                                            _userId: u.id,
                                                            _teamIndex: teamIndex,
                                                            _menTeamMembersCount: menTeamMembersCount,
                                                            _womenTeamMembersCount: womenTeamMembersCount,
                                                            _menDriversCount: menDriversCount,
                                                            _womenDriversCount: womenDriversCount,
                                                            _players: playersCount,
                                                            _teamTshirtsMap: teamTshirtsMap
                                                        },
                                                        tshirtSizeOrder: availableTshirtSizes,
                                                        showDetailsAsCollapsible: true,
                                                        showUsersChecked: showUsers,
                                                        showTeamsChecked: showTeams,
                                                        openEditModal: openEditModal,
                                                        db: db,
                                                        setUserNotificationMessage: setUserNotificationMessage,
                                                        onAddMember: handleOpenAddMemberTypeModal
                                                    })
                                                })
                                            )
                                        )
                                    )
                                )
                            ))
                        )
                    ),
                    showUsers && activeFilters.role && activeFilters.role.includes('volunteer') && (
                        [
                            // Nadpisový riadok
                            React.createElement(
                                'tr',
                                { key: 'volunteer-tshirt-summary-header', className: 'bg-gray-200 font-bold text-gray-800 uppercase' },
                                React.createElement(
                                    'td',
                                    {
                                        className: 'py-3 px-4 text-left',
                                        colSpan: columnOrder.length + 1
                                    },
                                    'Súhrn veľkostí tričiek pre dobrovoľníkov:'
                                )
                            ),
                            // Riadky s veľkosťami
                            ...(availableTshirtSizes && availableTshirtSizes.length > 0 ? availableTshirtSizes : ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']).map(size => {
                                const volunteerTshirtSummary = calculateVolunteerTshirtSummary();
                                const count = volunteerTshirtSummary.get(size) || 0;
                                return React.createElement(
                                    'tr',
                                    { key: `volunteer-tshirt-summary-${size}`, className: 'bg-gray-100 text-gray-700' },
                                    React.createElement(
                                        'td',
                                        {
                                            className: 'py-2 px-4 text-left',
                                            colSpan: columnOrder.length + 1
                                        },
                                        `${size}: ${count}×`
                                    )
                                );
                            })
                        ]
                    )
                )
            )
        ),
      )
    )
  );
}

// Explicitne sprístupniť komponent globálne
window.AllRegistrationsApp = AllRegistrationsApp;
