import { collection, doc, onSnapshot, setDoc, updateDoc, getDoc, query, orderBy, getDocs, serverTimestamp, addDoc, deleteField } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { countryDialCodes } from './countryDialCodes.js'; 

// ============================================================
// FUNKCIA NA ODSTRÁNENIE CITLIVÝCH POLÍ Z TÍMOV
// ============================================================
const removeSensitiveFieldsFromTeams = (teamsObj) => {
    if (!teamsObj) return teamsObj;
    const clean = JSON.parse(JSON.stringify(teamsObj));
    const forbiddenKeys = new Set([
        'dateOfBirth', 'address', '_dateOfBirth', '_address',
        '_privateData', 'birthDate', 'gender',
        'street', 'houseNumber', 'city', 'postalCode', 'country',
        'date_of_birth', 'dob'
    ]);

    const traverse = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        // Odstráni zakázané kľúče na tejto úrovni
        for (const key of Object.keys(obj)) {
            if (forbiddenKeys.has(key)) {
                delete obj[key];
            } else {
                const val = obj[key];
                if (Array.isArray(val)) {
                    val.forEach(item => traverse(item));
                } else if (val && typeof val === 'object') {
                    traverse(val);
                }
            }
        }
    };

    // Pre každú kategóriu a tím
    if (Array.isArray(clean)) {
        clean.forEach(team => traverse(team));
    } else {
        Object.values(clean).forEach(teams => {
            if (Array.isArray(teams)) {
                teams.forEach(team => traverse(team));
            }
        });
    }
    return clean;
};

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
function FilterModal({ isOpen, onClose, columnName, onApplyFilter, initialFilterValues, onClearFilter, uniqueColumnValues, allUsers }) {
    const [selectedValues, setSelectedValues] = React.useState(initialFilterValues || []);
    
    // Vypočítať počet výskytov pre každú hodnotu
    const getValueCounts = React.useMemo(() => {
        if (!allUsers || !columnName) return new Map();
        
        const counts = new Map();
        
        allUsers.forEach(user => {
            let userValue;
            if (columnName === 'role') {
                userValue = user.role;
            } else if (columnName.includes('.')) {
                const parts = columnName.split('.');
                let nestedVal = user;
                for (const part of parts) {
                    nestedVal = nestedVal ? nestedVal[part] : undefined;
                }
                userValue = nestedVal;
            } else {
                userValue = user[columnName];
            }
            
            if (userValue !== undefined && userValue !== null && userValue !== '') {
                let valueKey;
                if (columnName === 'role') {
                    valueKey = userValue;
                } else if (typeof userValue === 'boolean') {
                    valueKey = userValue ? 'áno' : 'nie';
                } else if (columnName === 'registrationDate') {
                    let date;
                    if (userValue && typeof userValue.toDate === 'function') {
                        date = userValue.toDate();
                    } else if (userValue && typeof userValue === 'object' && userValue.seconds !== undefined) {
                        date = new Date(userValue.seconds * 1000 + (userValue.nanoseconds || 0) / 1000000);
                    } else {
                        return;
                    }
                    const options = {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                    };
                    valueKey = date.toLocaleString('sk-SK', options).toLowerCase();
                } else {
                    valueKey = String(userValue).toLowerCase();
                }
                
                counts.set(valueKey, (counts.get(valueKey) || 0) + 1);
            }
        });
        
        return counts;
    }, [allUsers, columnName]);

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
            React.createElement('h3', { className: 'text-lg font-semibold mb-4' }, `Filter pre ${columnName === 'role' ? 'rolu' : columnName}`),
            React.createElement(
                'div',
                { className: 'max-h-60 overflow-y-auto mb-4 border border-gray-200 rounded-md p-2' },
                uniqueColumnValues.map((item, index) => {
                    // Získanie hodnoty a zobrazenia
                    let valueToUse, displayText;
                    let count = 0;
                    
                    if (columnName === 'role' && typeof item === 'object' && item.value) {
                        valueToUse = item.value;
                        displayText = item.label;
                        count = getValueCounts.get(item.value) || 0;
                    } else if (typeof item === 'object' && item.value) {
                        valueToUse = item.value;
                        displayText = item.label;
                        count = getValueCounts.get(item.value) || 0;
                    } else {
                        valueToUse = item;
                        displayText = item;
                        count = getValueCounts.get(item) || 0;
                    }
                    
                    return React.createElement(
                        'div',
                        { key: index, className: 'flex items-center mb-2 justify-between' },
                        React.createElement(
                            'div',
                            { className: 'flex items-center' },
                            React.createElement('input', {
                                type: 'checkbox',
                                id: `filter-${columnName}-${index}`,
                                value: valueToUse,
                                checked: selectedValues.includes(valueToUse),
                                onChange: () => handleCheckboxChange(valueToUse),
                                className: 'mr-2'
                            }),
                            React.createElement('label', { htmlFor: `filter-${columnName}-${index}` }, displayText)
                        ),
                        React.createElement(
                            'span',
                            { className: 'text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full' },
                            count
                        )
                    );
                })
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
        titleParts.push(React.createElement('span', { className: 'text-gray-600 mr-3 whitespace-nowrap' }, 'Farby dresov: ' + (team.jerseyHomeColor || '-') + ' / ' + (team.jerseyAwayColor || '-')));        
        titleParts.push(React.createElement('span', { className: 'text-gray-600 mr-2 whitespace-nowrap' }, `Doprava: ${formatArrivalTime(team.arrival?.type, team.arrival?.time)}`));
        titleParts.push(React.createElement('span', { className: 'text-gray-600 mr-2 whitespace-nowrap' }, `Ubytovanie: ${team.accommodation?.type || '-'}`));
        titleParts.push(React.createElement('span', { className: 'text-gray-600 mr-2 whitespace-nowrap' }, `Ubytovňa: ${team.accommodation?.name || '-'}`));
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
        titleParts.push(React.createElement('span', { className: 'text-gray-600 hidden 4xl:inline mr-2 whitespace-nowrap' }, team.accommodation?.name || '-'));
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
function TeamDetailsContent({ team, tshirtSizeOrder, showDetailsAsCollapsible, showUsersChecked, showTeamsChecked, openEditModal, db, setUserNotificationMessage, onAddMember, allTeamsData }) {
    if (!team) {
        return React.createElement('div', { className: 'text-gray-600 p-4' }, 'Žiadne tímové registrácie.');
    }

    // Získanie všetkých registračných čísel zo všetkých tímov
    const getAllRegistrationNumbers = React.useMemo(() => {
        const registrationNumbers = new Map(); // Mapa: registračné číslo -> { count, firstOccurrence }
        
        if (allTeamsData) {
            allTeamsData.forEach(t => {
                // Prehľadávanie hráčov
                if (t.playerDetails) {
                    t.playerDetails.forEach(player => {
                        if (player.registrationNumber) {
                            const regNum = String(player.registrationNumber).trim();
                            if (!registrationNumbers.has(regNum)) {
                                registrationNumbers.set(regNum, { 
                                    count: 1, 
                                    firstTeam: t.teamName || 'Bez názvu',
                                    firstCategory: t._category || '-'
                                });
                            } else {
                                const existing = registrationNumbers.get(regNum);
                                existing.count += 1;
                                registrationNumbers.set(regNum, existing);
                            }
                        }
                    });
                }
                
                // Prehľadávanie ostatných členov (pre prípad, že by mali registračné čísla)
                ['menTeamMemberDetails', 'womenTeamMemberDetails', 'driverDetailsMale', 'driverDetailsFemale'].forEach(arrName => {
                    if (t[arrName]) {
                        t[arrName].forEach(member => {
                            if (member.registrationNumber) {
                                const regNum = String(member.registrationNumber).trim();
                                if (!registrationNumbers.has(regNum)) {
                                    registrationNumbers.set(regNum, { 
                                        count: 1, 
                                        firstTeam: t.teamName || 'Bez názvu',
                                        firstCategory: t._category || '-'
                                    });
                                } else {
                                    const existing = registrationNumbers.get(regNum);
                                    existing.count += 1;
                                    registrationNumbers.set(regNum, existing);
                                }
                            }
                        });
                    }
                });
            });
        }
        
        return registrationNumbers;
    }, [allTeamsData]);

    const isRegistrationNumberDuplicate = (regNumber) => {
        if (!regNumber) return false;
        const regNumStr = String(regNumber).trim();
        const entry = getAllRegistrationNumbers.get(regNumStr);
        return entry && entry.count > 1;
    };

    const jerseyNumberCounts = React.useMemo(() => {
        const counts = new Map();
        if (team && team.playerDetails) {
            team.playerDetails.forEach(player => {
                const jerseyNum = player.jerseyNumber;
                if (jerseyNum && jerseyNum.toString().trim() !== '') {
                    const key = jerseyNum.toString().trim();
                    counts.set(key, (counts.get(key) || 0) + 1);
                }
            });
        }
        return counts;
    }, [team]);

    const isJerseyNumberDuplicate = (jerseyNumber) => {
        if (!jerseyNumber) return false;
        const key = jerseyNumber.toString().trim();
        return jerseyNumberCounts.get(key) > 1;
    };

    const allConsolidatedMembers = [];

    const createMember = (member, type, originalArray, originalIndex) => {
        // Vylúčime pôvodné dateOfBirth a address
        const { dateOfBirth, address, ...rest } = member;
        return {
            ...rest,
            type: type,
            originalArray: originalArray,
            originalIndex: originalIndex,
            uniqueId: `${team.teamName}-${originalArray}-${member.firstName || ''}-${member.lastName || ''}-${originalIndex}`,
            // Použijeme _dateOfBirth a _address (z privateData)
            _dateOfBirth: member._dateOfBirth || '',
            _address: member._address || {}
        };
    };
    
    if (team.playerDetails && team.playerDetails.length > 0) {
        team.playerDetails.forEach((player, index) => {
            allConsolidatedMembers.push(createMember(player, 'Hráč', 'playerDetails', index));
        });
    }
    if (team.menTeamMemberDetails && team.menTeamMemberDetails.length > 0) {
        team.menTeamMemberDetails.forEach((member, index) => {
            allConsolidatedMembers.push(createMember(member, 'Člen realizačného tímu (muž)', 'menTeamMemberDetails', index));
        });
    }
    if (team.womenTeamMemberDetails && team.womenTeamMemberDetails.length > 0) {
        team.womenTeamMemberDetails.forEach((member, index) => {
            allConsolidatedMembers.push(createMember(member, 'Člen realizačného tímu (žena)', 'womenTeamMemberDetails', index));
        });
    }
    if (Array.isArray(team.driverDetailsMale) && team.driverDetailsMale.length > 0) {
        team.driverDetailsMale.forEach((driver, index) => {
            allConsolidatedMembers.push(createMember(driver, 'Šofér (muž)', 'driverDetailsMale', index));
        });
    }
    if (Array.isArray(team.driverDetailsFemale) && team.driverDetailsFemale.length > 0) {
        team.driverDetailsFemale.forEach((driver, index) => {
            allConsolidatedMembers.push(createMember(driver, 'Šofér (žena)', 'driverDetailsFemale', index));
        });
    }

    // Filtrujeme kľúče, aby sme sa uistili, že sú to platné dátumy jedál
    const mealDates = (team.packageDetails && team.packageDetails.meals && typeof team.packageDetails.meals === 'object' 
        ? Object.keys(team.packageDetails.meals).sort() 
        : [])
        .filter(key => isDateKey(key));
    
    const mealTypes = ['breakfast', 'lunch', 'dinner', 'refreshment'];
    const mealTypeLabels = {
        breakfast: 'Raňajky',
        lunch: 'Obed',
        dinner: 'Večera',
        refreshment: 'Občerstvenie'
    };

    const formatAddress = (member) => {
        if (!member) return '-';
        const address = member._address;
        if (!address) return '-';
        const street = address.street || '';
        const houseNumber = address.houseNumber || '';
        const postalCode = formatPostalCodeForDisplay(address.postalCode);
        const city = address.city || '';
        const country = address.country || '';
        const parts = [
            `${street} ${houseNumber}`.trim(),
            `${postalCode} ${city}`.trim(),
            country.trim()
        ].filter(p => p !== '');
        return parts.join(', ') || '-';
    };

    const handleAccommodationToggle = async (member, isChecked) => {
        if (!db || !team._userId) {
            setUserNotificationMessage("Chyba: Databáza nie je pripojená alebo chýba ID používateľa tímu.", 'error');
            return;
        }

        window.showGlobalLoader();

        try {
            const userDocRef = doc(db, 'users', team._userId);
            const docSnapshot = await getDoc(userDocRef);

            if (!docSnapshot.exists()) {
                throw new Error("Používateľský dokument sa nenašiel.");
            }

            const userData = docSnapshot.data();
            const teamsData = { ...userData.teams };

            const teamCategory = team._category;
            const teamIndex = team._teamIndex;
            const memberArrayType = member.originalArray;
            const memberIndex = member.originalIndex;

            // Deep clone relevant parts
            const updatedCategoryTeams = JSON.parse(JSON.stringify(teamsData[teamCategory] || []));
            const teamToUpdate = updatedCategoryTeams[teamIndex];

            if (!teamToUpdate) {
                throw new Error("Tím sa nenašiel pre úpravu ubytovania.");
            }

            const memberArrayToUpdate = teamToUpdate[memberArrayType];

            if (!memberArrayToUpdate || memberArrayToUpdate[memberIndex] === undefined) {
                throw new Error("Člen tímu sa nenašiel pre úpravu ubytovania.");
            }

            const memberToUpdate = memberArrayToUpdate[memberIndex];

            // --- Notification Logic ---
            const userEmail = window.auth.currentUser?.email;
            const changes = [];
            
            const currentMemberAccommodation = memberToUpdate.accommodation?.type || teamToUpdate.accommodation?.type;
            const memberName = `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Bez mena';
            const teamName = team.teamName || 'Bez názvu';

            if (isChecked) {
                if (teamToUpdate.accommodation?.type && teamToUpdate.accommodation.type !== 'bez ubytovania') {
                    changes.push(`Priradenie ubytovania pre ${memberName} (Tím: ${teamName}, ${teamCategory})`);
                    changes.push(`Typ ubytovania nastavený na '''${teamToUpdate.accommodation.type}'`);
                } else {
                    setUserNotificationMessage("Tím nemá nastavené ubytovanie na priradenie.", 'info');
                    window.hideGlobalLoader();
                    return;
                }
            } else {
                if (currentMemberAccommodation && currentMemberAccommodation !== 'bez ubytovania') {
                    changes.push(`Odstránenie ubytovania pre ${memberName} (Tím: ${teamName}, ${teamCategory})`);
                    changes.push(`Typ ubytovania zmenený z '${currentMemberAccommodation}' na 'bez ubytovania'`);
                } else {
                    setUserNotificationMessage("Tento člen už nemá ubytovanie alebo má nastavené 'bez ubytovania'.", 'info');
                    window.hideGlobalLoader();
                    return;
                }
            }

            if (!memberToUpdate.accommodation) {
                memberToUpdate.accommodation = {};
            }

            if (isChecked) {
                memberToUpdate.accommodation.type = teamToUpdate.accommodation.type;
                if (teamToUpdate.accommodation.name) {
                    memberToUpdate.accommodation.name = teamToUpdate.accommodation.name;
                }
            } else {
                memberToUpdate.accommodation.type = 'bez ubytovania';
                delete memberToUpdate.accommodation.name;
            }

            const updatePayload = {
                [`teams.${teamCategory}`]: updatedCategoryTeams
            };

            await updateDoc(userDocRef, updatePayload);
            setUserNotificationMessage(
                isChecked 
                    ? `Ubytovanie pre ${member.firstName} ${member.lastName} bolo priradené.`
                    : `Ubytovanie pre ${member.firstName} ${member.lastName} bolo odstránené.`,
                'success'
            );

            if (changes.length > 0 && userEmail) {
                const notificationsCollectionRef = collection(db, 'notifications');
                await addDoc(notificationsCollectionRef, {
                    userEmail,
                    changes,
                    timestamp: serverTimestamp()
                });
            }

        } catch (error) {
            console.error("Chyba pri zmene ubytovania v Firestore:", error);
            setUserNotificationMessage(`Chyba pri zmene ubytovania: ${error.message}`, 'error');
        } finally {
            window.hideGlobalLoader();
        }
    };

    const handleAccommodationRemoval = async (member) => {
        if (!db || !team._userId) {
            setUserNotificationMessage("Chyba: Databáza nie je pripojená alebo chýba ID používateľa tímu.", 'error');
            return;
        }
    
        window.showGlobalLoader();
    
        try {
            const userDocRef = doc(db, 'users', team._userId);
            const docSnapshot = await getDoc(userDocRef);
    
            if (!docSnapshot.exists()) {
                throw new Error("Používateľský dokument sa nenašiel.");
            }
    
            const userData = docSnapshot.data();
            const teamsData = { ...userData.teams };
    
            const teamCategory = team._category;
            const teamIndex = team._teamIndex;
            const memberArrayType = member.originalArray;
            const memberIndex = member.originalIndex;
    
            const updatedCategoryTeams = JSON.parse(JSON.stringify(teamsData[teamCategory] || []));
            const teamToUpdate = updatedCategoryTeams[teamIndex];
    
            if (!teamToUpdate) {
                throw new Error("Tím sa nenašiel pre odstránenie ubytovania.");
            }
    
            const memberArrayToUpdate = teamToUpdate[memberArrayType];
    
            if (!memberArrayToUpdate || memberArrayToUpdate[memberIndex] === undefined) {
                throw new Error("Člen tímu sa nenašiel pre odstránenie ubytovania.");
            }
    
            const memberToUpdate = memberArrayToUpdate[memberIndex];
    
            const teamAccommodation = team.accommodation?.type;
            const currentMemberAccommodation = memberToUpdate.accommodation?.type || teamAccommodation;
            
            const userEmail = window.auth.currentUser?.email;
            const changes = [];
            
            if (currentMemberAccommodation && currentMemberAccommodation !== 'bez ubytovania') {
                const memberName = `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Bez mena';
                const teamName = team.teamName || 'Bez názvu';
                changes.push(`Odstránenie ubytovania pre ${memberName} (Tím: ${teamName}, ${teamCategory})`);
                changes.push(`Typ ubytovania zmenený z '${currentMemberAccommodation}' na 'bez ubytovania'`);
            } else {
                setUserNotificationMessage("Tento člen už nemá ubytovanie alebo má nastavené 'bez ubytovania'.", 'info');
                window.hideGlobalLoader();
                return;
            }
    
            if (!memberToUpdate.accommodation) {
                memberToUpdate.accommodation = {};
            }
            memberToUpdate.accommodation.type = 'bez ubytovania';
            delete memberToUpdate.accommodation.name;
    
            const updatePayload = {
                [`teams.${teamCategory}`]: updatedCategoryTeams
            };
    
            await updateDoc(userDocRef, updatePayload);
            setUserNotificationMessage(`Ubytovanie pre ${member.firstName} ${member.lastName} bolo odstránené.`, 'success');
    
            if (changes.length > 0 && userEmail) {
                const notificationsCollectionRef = collection(db, 'notifications');
                await addDoc(notificationsCollectionRef, {
                    userEmail,
                    changes,
                    timestamp: serverTimestamp()
                });
            }
    
        } catch (error) {
            console.error("Chyba pri odstraňovaní ubytovania v Firestore:", error);
            setUserNotificationMessage(`Chyba pri odstraňovaní ubytovania: ${error.message}`, 'error');
        } finally {
            window.hideGlobalLoader();
        }
    };

    const getAccommodationStatus = (member) => {
        if (member.accommodation?.type) {
            return member.accommodation.type;
        }
        return team.accommodation?.type || '-';
    };

    const hasTeamAccommodation = team.accommodation?.type && team.accommodation.type !== 'bez ubytovania';
                
    const handleMealChange = async (member, date, mealType, isChecked) => {
        if (!db || !team._userId) {
            setUserNotificationMessage("Chyba: Databáza nie je pripojená alebo chýba ID používateľa tímu.", 'error');
            return;
        }

        window.showGlobalLoader();

        try {
            const userDocRef = doc(db, 'users', team._userId);
            const docSnapshot = await getDoc(userDocRef);

            if (!docSnapshot.exists()) {
                throw new Error("Používateľský dokument sa nenašiel.");
            }

            const userData = docSnapshot.data();
            const teamsData = { ...userData.teams };

            const teamCategory = team._category;
            const teamIndex = team._teamIndex;
            const memberArrayType = member.originalArray;
            const memberIndex = member.originalIndex;

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

            const userEmail = window.auth.currentUser?.email;
            const changes = [];
            const originalMealValue = memberToUpdate.packageDetails?.meals?.[date]?.[mealType] === 1 ? 'Áno' : 'Nie';
            const newMealValue = isChecked ? 'Áno' : 'Nie';

            if (originalMealValue !== newMealValue) {
                const memberName = `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Bez mena';
                const teamName = team.teamName || 'Bez názvu';
                changes.push(`Zmena stravovania pre ${memberName} (Tím: ${teamName}, ${teamCategory})`);
                changes.push(`${formatDateToDMMYYYY(date)}, ${mealTypeLabels[mealType]}: z '${originalMealValue}' na '${newMealValue}'`);
            }

            if (!memberToUpdate.packageDetails) memberToUpdate.packageDetails = {};
            if (!memberToUpdate.packageDetails.meals) memberToUpdate.packageDetails.meals = {};
            if (!memberToUpdate.packageDetails.meals[date]) memberToUpdate.packageDetails.meals[date] = {};

            memberToUpdate.packageDetails.meals[date][mealType] = isChecked ? 1 : 0;

            const updatePayload = {
                [`teams.${teamCategory}`]: updatedCategoryTeams
            };

            await updateDoc(userDocRef, updatePayload);
            setUserNotificationMessage(`Stravovanie pre ${member.firstName} ${member.lastName} bolo aktualizované.`, 'success');

            if (changes.length > 0 && userEmail) {
                const notificationsCollectionRef = collection(db, 'notifications');
                await addDoc(notificationsCollectionRef, {
                    userEmail,
                    changes,
                    timestamp: serverTimestamp()
                });
            }

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
                    React.createElement('th', { className: 'px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-max' }, 'Ubytovanie'),
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
                allConsolidatedMembers.map((member) => {
                    const isRegNumberDuplicate = isRegistrationNumberDuplicate(member.registrationNumber);
                    const regNumberCellClass = isRegNumberDuplicate 
                        ? 'px-4 py-2 whitespace-nowrap min-w-max font-bold text-red-600' 
                        : 'px-4 py-2 whitespace-nowrap min-w-max';
                    
                    // 🆕 3. Kontrola duplicity čísla dresu (platí len pre hráčov)
                    const isJerseyDuplicate = member.type === 'Hráč' && isJerseyNumberDuplicate(member.jerseyNumber);
                    const jerseyNumberCellClass = isJerseyDuplicate 
                        ? 'px-4 py-2 whitespace-nowrap min-w-max font-bold text-red-600' 
                        : 'px-4 py-2 whitespace-nowrap min-w-max';

                    return React.createElement(
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
                                        memberPathForSaving = `teams.${team._category}[${team._teamIndex}].${member.originalArray}[${member.originalIndex}]`;
                                    } else if (member.originalArray) {
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
                            }, '✏️'),
                            member.type || '-'
                        ),
                        React.createElement('td', { className: 'px-4 py-2 whitespace-nowrap min-w-max' }, member.firstName || '-'),
                        React.createElement('td', { className: 'px-4 py-2 whitespace-nowrap min-w-max' }, member.lastName || '-'),
                        React.createElement('td', { className: 'px-4 py-2 whitespace-nowrap min-w-max' }, 
                            member._dateOfBirth ? formatDateToDMMYYYY(member._dateOfBirth) : '-'
                        ),

                        React.createElement('td', { className: jerseyNumberCellClass }, member.jerseyNumber || '-'),
                        React.createElement('td', { className: regNumberCellClass }, 
                            member.registrationNumber || '-'
                        ),
                        React.createElement('td', { className: 'px-4 py-2 whitespace-nowrap min-w-max' }, formatAddress(member)),
                        React.createElement('td', { className: 'px-4 py-2 whitespace-nowrap min-w-max' },
                            (() => {
                                const hasAccommodation = getAccommodationStatus(member) !== 'bez ubytovania' && getAccommodationStatus(member) !== '-';
                                const accommodationStatus = getAccommodationStatus(member);
                                const canHaveAccommodation = team.accommodation?.type && team.accommodation.type !== 'bez ubytovania';
                                
                                return canHaveAccommodation ? (
                                    React.createElement('input', {
                                        type: 'checkbox',
                                        checked: hasAccommodation,
                                        onChange: (e) => handleAccommodationToggle(member, e.target.checked),
                                        className: 'form-checkbox h-4 w-4 text-blue-600',
                                        title: hasAccommodation 
                                            ? `Odstrániť ubytovanie (aktuálne: ${accommodationStatus})`
                                            : `Priradiť tímové ubytovanie (${team.accommodation.type})`
                                    })
                                ) : (
                                    React.createElement('span', { 
                                        className: accommodationStatus === 'bez ubytovania' ? 'text-gray-400' : 'text-gray-800'
                                    }, accommodationStatus)
                                );
                            })()
                        ),
                        mealDates.map(date =>
                            React.createElement('td', { key: `${member.uniqueId}-${date}-meals`, colSpan: 4, className: 'px-4 py-2 text-center border-l border-gray-200 whitespace-nowrap min-w-max' },
                                React.createElement(
                                    'div',
                                    { className: 'flex justify-around' },
                                    mealTypes.map(type => {
                                        const memberMealSetting = member.packageDetails?.meals?.[date]?.[type];
                                        const teamPackageMealSetting = team.packageDetails?.meals?.[date]?.[type];
                                        
                                        const isChecked = (memberMealSetting !== undefined)
                                            ? (memberMealSetting === 1)
                                            : (teamPackageMealSetting === 1);
    
                                        return React.createElement('input', {
                                            key: `${member.uniqueId}-${date}-${type}-checkbox`,
                                            type: 'checkbox',
                                            checked: isChecked || false, // Zabezpečiť, že checked je vždy boolean
                                            onChange: (e) => handleMealChange(member, date, type, e.target.checked),
                                            className: 'form-checkbox h-4 w-4 text-blue-600'
                                        });
                                    })
                                )
                            )
                        )
                    );
                })
            )
        )
    );

    const collapsibleSectionTitle = generateTeamHeaderTitle(team, tshirtSizeOrder, true, showUsersChecked, showTeamsChecked);

    const teamEditButtonElement = React.createElement('button', {
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
    }, '✏️');

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
                        e.stopPropagation();
                        onAddMember(team);
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
                        e.stopPropagation();
                        onAddMember(team);
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
    if (key === 'address.city') return 'Mesto/obec';
    if (key === 'address.country') return 'Krajina';
    if (key === 'street') return 'Ulica';
    if (key === 'houseNumber') return 'Popisné číslo';
    if (key === 'city') return 'Mesto/obec';
    if (key === 'postalCode') return 'PSČ';
    if (key === 'country') return 'Krajina';
    if (key === 'approved') return 'Schválený';
    if (key === 'email') return 'E-mail';
    if (key === 'gender') return 'Pohlavie';
    if (key === 'birthDate') return 'Dátum narodenia';
    if (key === 'selectedDates') return 'Dni k dispozícii';
    if (key === 'volunteerRoles') return 'Môžem byť nápomocný/-á';
    if (key === 'tshirtSize') return 'Veľkosť trička';
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
    if (key === 'jerseyHomeColor') return 'Farba dresov 1';
    if (key === 'jerseyAwayColor') return 'Farba dresov 2';
  
    return label;
};

const getChangesForNotification = (original, updated, formatDateFn) => {
    const changes = [];

    // Polia, ktoré sa majú porovnávať pre člena tímu
    const memberFields = ['firstName', 'lastName', 'jerseyNumber', 'registrationNumber'];
    
    // Porovnanie základných polí
    memberFields.forEach(field => {
        const originalValue = original[field] !== undefined && original[field] !== null ? String(original[field]) : '';
        const updatedValue = updated[field] !== undefined && updated[field] !== null ? String(updated[field]) : '';
        if (originalValue !== updatedValue) {
            const label = formatLabel(field);
            changes.push(`Zmena ${label}: z '${originalValue || '-'}' na '${updatedValue || '-'}'`);
        }
    });
    
    // Porovnanie dátumu narodenia - LEN AK SA ZMENIL
    const originalDate = original.dateOfBirth ? formatDateFn(original.dateOfBirth) : '-';
    const updatedDate = updated.dateOfBirth ? formatDateFn(updated.dateOfBirth) : '-';
    if (originalDate !== updatedDate) {
        changes.push(`Zmena Dátumu narodenia: z '${originalDate}' na '${updatedDate}'`);
    }
    
    // Porovnanie adresy - LEN POLIA, KTORÉ SA ZMENILI
    const addrFields = ['street', 'houseNumber', 'postalCode', 'city', 'country'];
    addrFields.forEach(field => {
        const origVal = original.address?.[field] || '';
        const updVal = updated.address?.[field] || '';
        if (origVal !== updVal) {
            const label = formatLabel(`address.${field}`);
            const displayOrig = origVal || '-';
            const displayUpd = updVal || '-';
            let finalUpd = displayUpd;
            let finalOrig = displayOrig;
            if (field === 'postalCode') {
                finalOrig = formatPostalCodeForDisplay(origVal);
                finalUpd = formatPostalCodeForDisplay(updVal);
            }
            changes.push(`Zmena ${label}: z '${finalOrig}' na '${finalUpd}'`);
        }
    });
    
    return changes;
};

// ============================================================
// UPRAVENÁ FUNKCIA PRE NOTIFIKÁCIE PRE ČLENA TÍMU
// ============================================================
const getMemberChangesForNotification = (original, updated, memberName, teamName, category) => {
    const changes = [];
    
    // Sledované polia pre člena
    const memberFields = ['firstName', 'lastName', 'jerseyNumber', 'registrationNumber'];
    
    memberFields.forEach(field => {
        const originalValue = original[field] !== undefined && original[field] !== null ? String(original[field]) : '';
        const updatedValue = updated[field] !== undefined && updated[field] !== null ? String(updated[field]) : '';
        if (originalValue !== updatedValue) {
            const label = formatLabel(field);
            changes.push(`${memberName} (${category}, tím: ${teamName}) – zmena ${label}: z '${originalValue || '-'}' na '${updatedValue || '-'}'`);
        }
    });
    
    // Dátum narodenia - POROVNÁVAME IBA AK SA ZMENIL
    const originalDate = original.dateOfBirth ? formatDateToDMMYYYY(original.dateOfBirth) : '-';
    const updatedDate = updated.dateOfBirth ? formatDateToDMMYYYY(updated.dateOfBirth) : '-';
    if (originalDate !== updatedDate) {
        changes.push(`${memberName} (${category}, tím: ${teamName}) – zmena Dátumu narodenia: z '${originalDate}' na '${updatedDate}'`);
    }
    
    // Adresa - POROVNÁVAME IBA POLIA, KTORÉ SA ZMENILI
    const addrFields = ['street', 'houseNumber', 'postalCode', 'city', 'country'];
    addrFields.forEach(field => {
        const origVal = original.address?.[field] || '';
        const updVal = updated.address?.[field] || '';
        if (origVal !== updVal) {
            const label = formatLabel(`address.${field}`);
            const displayOrig = origVal || '-';
            const displayUpd = updVal || '-';
            let finalUpd = displayUpd;
            let finalOrig = displayOrig;
            if (field === 'postalCode') {
                finalOrig = formatPostalCodeForDisplay(origVal);
                finalUpd = formatPostalCodeForDisplay(updVal);
            }
            changes.push(`${memberName} (${category}, tím: ${teamName}) – zmena ${label}: z '${finalOrig}' na '${finalUpd}'`);
        }
    });
    
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
function DataEditModal({ isOpen, onClose, title, data, onSave, onDeleteMember, onDeleteTeam, targetDocRef, originalDataPath, setUserNotificationMessage, setError, isNewEntry, getChangesForNotification: getChangesForNotification, formatDateToDMMYYYY: formatDateToDMMYYYY, currentUserId, editModalTitle }) {
    const modalRef = React.useRef(null);
    const db = window.db;
    const [localEditedData, setLocalEditedData] = React.useState(data);
    const [userRole, setUserRole] = React.useState('');
    const [isTargetUserAdmin, setIsTargetUserAdmin] = React.useState(false);
    const [isTargetUserHall, setIsTargetUserHall] = React.useState(false);
    const [privateData, setPrivateData] = React.useState(null);
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
    const [arrivalTime, setArrivalTime] = React.useState('');
    const arrivalOptions = [
        'verejná doprava - vlak',
        'verejná doprava - autobus',
        'vlastná doprava',
        'bez dopravy'
    ];

    // Stavy pre typ ubytovania
    const [accommodationTypes, setAccommodationTypes] = React.useState([]);
    const [selectedAccommodationType, setSelectedAccommodationType] = React.useState('');
    const accommodationOptionsWithNone = React.useMemo(() => {
        return ['bez ubytovania', ...accommodationTypes];
    }, [accommodationTypes]);

    // Stavy pre balíky
    const [packages, setPackages] = React.useState([]);
    const [selectedPackageName, setSelectedPackageName] = React.useState('');

    // Stavy pre tričká
    const [availableTshirtSizes, setAvailableTshirtSizes] = React.useState([]);
    const [teamTshirts, setTeamTshirts] = React.useState([]);

    // Stavy pre potvrdenie odstránenia
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = React.useState(false);
    const [deleteConfirmMessage, setDeleteConfirmMessage] = React.useState('');
    const [isConfirmDeleteTeamOpen, setIsConfirmDeleteTeamOpen] = React.useState(false);
    const [deleteTeamConfirmMessage, setDeleteTeamConfirmMessage] = React.useState('');

    const generateUniqueId = () => Math.random().toString(36).substring(2, 9);

    // Načítanie usersprivate dát pri otvorení modálu
    React.useEffect(() => {
        const loadPrivateData = async () => {
            if (isOpen && targetDocRef) {
                try {
                    const userPrivateDocRef = doc(db, 'usersprivate', targetDocRef.id);
                    const privateDocSnapshot = await getDoc(userPrivateDocRef);
                    if (privateDocSnapshot.exists()) {
                        setPrivateData(privateDocSnapshot.data());
                    } else {
                        setPrivateData(null);
                    }
                } catch (error) {
                    console.error("Chyba pri načítaní usersprivate dát:", error);
                    setPrivateData(null);
                }
            }
        };
        loadPrivateData();
    }, [isOpen, targetDocRef, db]);

    React.useEffect(() => {
        if (!isOpen) {
            setIsConfirmDeleteOpen(false);
            setDeleteConfirmMessage('');
            setIsConfirmDeleteTeamOpen(false);
            setDeleteTeamConfirmMessage('');
        }
    }, [isOpen]);

    React.useEffect(() => {
        if (isOpen) {
            setIsConfirmDeleteOpen(false);
            setIsConfirmDeleteTeamOpen(false);
        }
    }, [isOpen]);

    React.useEffect(() => {
        const fetchTeamDataForSelects = async () => {
            if (db && (title.includes('Upraviť tím') || title.includes('Pridať nový tím'))) {
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
                        setCategories([]);
                    }
                } catch (error) {
                    console.error("Chyba pri načítaní kategórií:", error);
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
                            setAccommodationTypes([]);
                        }
                    } else {
                        setAccommodationTypes([]);
                    }
                } catch (error) {
                    console.error("Chyba pri načítaní typov ubytovania:", error);
                }

                // Načítanie balíkov
                try {
                    const packagesCollectionRef = collection(db, 'settings', 'packages', 'list');
                    const querySnapshot = await getDocs(packagesCollectionRef);
                    const fetchedPackages = querySnapshot.docs.map(doc => ({
                        id: doc.id,
                        name: doc.data().name,
                        accommodationTypes: doc.data().accommodationTypes || [],
                        price: doc.data().price || 0,
                        meals: doc.data().meals || {}
                    }));
                    setPackages(fetchedPackages);
                } catch (error) {
                    console.error("Chyba pri načítaní balíkov:", error);
                    setPackages([]);
                }

                // Načítanie veľkostí tričiek
                try {
                    const sizeTshirtsDocRef = doc(db, 'settings', 'sizeTshirts');
                    const docSnapshot = await getDoc(sizeTshirtsDocRef);
                    if (docSnapshot.exists()) {
                        const data = docSnapshot.data();
                        if (data && Array.isArray(data.sizes)) {
                            const sizes = data.sizes.map(s =>
                                typeof s === 'object' && s.size ? String(s.size).trim() : String(s).trim()
                            );
                            setAvailableTshirtSizes(sizes);
                        }
                    }
                } catch (error) {
                    console.error("Chyba pri načítaní veľkostí tričiek:", error);
                }
            }
        };
        fetchTeamDataForSelects();
    }, [db, title]);

    React.useEffect(() => {
        if ((title.includes('Upraviť tím') || title.includes('Pridať nový tím')) && packages.length > 0 && selectedAccommodationType) {
            const allPackages = packages || [];
            const availablePackagesForCurrentType = allPackages.filter(pkg => {
                if (!pkg.accommodationTypes || pkg.accommodationTypes.length === 0) return true;
                if (selectedAccommodationType === 'bez ubytovania') {
                    return pkg.accommodationTypes.includes('bez ubytovania');
                }
                return pkg.accommodationTypes.includes(selectedAccommodationType);
            });

            const isCurrentPackageAvailable = selectedPackageName && availablePackagesForCurrentType.some(pkg => pkg.name === selectedPackageName);

            if (!isCurrentPackageAvailable && availablePackagesForCurrentType.length > 0) {
                const firstAvailablePackage = availablePackagesForCurrentType[0];
                setSelectedPackageName(firstAvailablePackage.name);
                const { id, ...packageDataToSave } = firstAvailablePackage;
                handleChange('packageDetails', packageDataToSave);
            } else if (!isCurrentPackageAvailable && availablePackagesForCurrentType.length === 0) {
                setSelectedPackageName('');
                handleChange('packageDetails', null);
            }
        }
    }, [packages, selectedAccommodationType, title]);

    // Funkcia na zlúčenie údajov z usersprivate
    const mergePrivateData = React.useCallback((userData) => {
        if (!privateData) return userData;
        
        const merged = JSON.parse(JSON.stringify(userData || {}));
        
        // Zlúčenie adries z hlavného formulára
        if (privateData.address) {
            const hasPrivateAddress = privateData.address.street || privateData.address.city || privateData.address.postalCode;
            if (hasPrivateAddress) {
                merged.street = privateData.address.street || '';
                merged.houseNumber = privateData.address.houseNumber || '';
                merged.city = privateData.address.city || '';
                merged.postalCode = privateData.address.postalCode || '';
                merged.country = privateData.address.country || '';
            } else {
                // Ak v privateData nie je adresa, nastavíme prázdne (žiaden fallback)
                merged.street = '';
                merged.houseNumber = '';
                merged.city = '';
                merged.postalCode = '';
                merged.country = '';
            }
        }
        
        // Zlúčenie fakturačnej adresy
        if (privateData.billingAddress) {
            const hasBillingAddress = privateData.billingAddress.street || privateData.billingAddress.city;
            if (hasBillingAddress) {
                if (!merged.billing) merged.billing = {};
                if (!merged.billing.address) merged.billing.address = {};
                merged.billing.address = {
                    street: privateData.billingAddress.street || '',
                    houseNumber: privateData.billingAddress.houseNumber || '',
                    city: privateData.billingAddress.city || '',
                    postalCode: privateData.billingAddress.postalCode || '',
                    country: privateData.billingAddress.country || ''
                };
            } else {
                // Ak nie je fakturačná adresa, odstráňte ju (alebo nechajte prázdnu)
                if (merged.billing) {
                    merged.billing.address = {
                        street: '',
                        houseNumber: '',
                        city: '',
                        postalCode: '',
                        country: ''
                    };
                }
            }
        }
        
        // Zlúčenie tímových údajov - dátumy narodenia a adresy
        if (merged.teams && privateData.persons) {
            Object.keys(merged.teams).forEach(category => {
                const teams = merged.teams[category];
                if (Array.isArray(teams)) {
                    teams.forEach((team, teamIndex) => {
                        const teamKey = `${category}_team${teamIndex + 1}`;
                        const privateTeamData = privateData.persons?.[teamKey] || {};
                        
                        // Zlúčenie hráčov
                        if (team.playerDetails && privateTeamData.players) {
                            team.playerDetails = team.playerDetails.map((player, index) => {
                                const privatePlayer = privateTeamData.players[index] || {};
                                const hasPrivateData = privatePlayer.dateOfBirth || 
                                    (privatePlayer.address && (privatePlayer.address.street || privatePlayer.address.city));
                                
                                return {
                                    ...player,
                                    dateOfBirth: hasPrivateData && privatePlayer.dateOfBirth 
                                        ? privatePlayer.dateOfBirth 
                                        : player.dateOfBirth || '',
                                    address: hasPrivateData && privatePlayer.address 
                                        ? privatePlayer.address 
                                        : player.address || {
                                            street: '',
                                            houseNumber: '',
                                            city: '',
                                            postalCode: '',
                                            country: ''
                                        }
                                };
                            });
                        }
                        
                        // Zlúčenie žien - členiek tímu
                        if (team.womenTeamMemberDetails && privateTeamData.womenTeamMembers) {
                            team.womenTeamMemberDetails = team.womenTeamMemberDetails.map((member, index) => {
                                const privateMember = privateTeamData.womenTeamMembers[index] || {};
                                const hasPrivateData = privateMember.dateOfBirth || 
                                    (privateMember.address && (privateMember.address.street || privateMember.address.city));
                                
                                return {
                                    ...member,
                                    dateOfBirth: hasPrivateData && privateMember.dateOfBirth 
                                        ? privateMember.dateOfBirth 
                                        : member.dateOfBirth || '',
                                    address: hasPrivateData && privateMember.address 
                                        ? privateMember.address 
                                        : member.address || {
                                            street: '',
                                            houseNumber: '',
                                            city: '',
                                            postalCode: '',
                                            country: ''
                                        }
                                };
                            });
                        }
                        
                        // Zlúčenie mužov - členov tímu
                        if (team.menTeamMemberDetails && privateTeamData.menTeamMembers) {
                            team.menTeamMemberDetails = team.menTeamMemberDetails.map((member, index) => {
                                const privateMember = privateTeamData.menTeamMembers[index] || {};
                                const hasPrivateData = privateMember.dateOfBirth || 
                                    (privateMember.address && (privateMember.address.street || privateMember.address.city));
                                
                                return {
                                    ...member,
                                    dateOfBirth: hasPrivateData && privateMember.dateOfBirth 
                                        ? privateMember.dateOfBirth 
                                        : member.dateOfBirth || '',
                                    address: hasPrivateData && privateMember.address 
                                        ? privateMember.address 
                                        : member.address || {
                                            street: '',
                                            houseNumber: '',
                                            city: '',
                                            postalCode: '',
                                            country: ''
                                        }
                                };
                            });
                        }
                        
                        // Zlúčenie šoférov - mužov
                        if (team.driverDetailsMale && privateTeamData.driversMale) {
                            team.driverDetailsMale = team.driverDetailsMale.map((driver, index) => {
                                const privateDriver = privateTeamData.driversMale[index] || {};
                                const hasPrivateData = privateDriver.dateOfBirth || 
                                    (privateDriver.address && (privateDriver.address.street || privateDriver.address.city));
                                
                                return {
                                    ...driver,
                                    dateOfBirth: hasPrivateData && privateDriver.dateOfBirth 
                                        ? privateDriver.dateOfBirth 
                                        : driver.dateOfBirth || '',
                                    address: hasPrivateData && privateDriver.address 
                                        ? privateDriver.address 
                                        : driver.address || {
                                            street: '',
                                            houseNumber: '',
                                            city: '',
                                            postalCode: '',
                                            country: ''
                                        }
                                };
                            });
                        }
                        
                        // Zlúčenie šoférov - žien
                        if (team.driverDetailsFemale && privateTeamData.driversFemale) {
                            team.driverDetailsFemale = team.driverDetailsFemale.map((driver, index) => {
                                const privateDriver = privateTeamData.driversFemale[index] || {};
                                const hasPrivateData = privateDriver.dateOfBirth || 
                                    (privateDriver.address && (privateDriver.address.street || privateDriver.address.city));
                                
                                return {
                                    ...driver,
                                    dateOfBirth: hasPrivateData && privateDriver.dateOfBirth 
                                        ? privateDriver.dateOfBirth 
                                        : driver.dateOfBirth || '',
                                    address: hasPrivateData && privateDriver.address 
                                        ? privateDriver.address 
                                        : driver.address || {
                                            street: '',
                                            houseNumber: '',
                                            city: '',
                                            postalCode: '',
                                            country: ''
                                        }
                                };
                            });
                        }
                    });
                }
            });
        }
        
        return merged;
    }, [privateData]);

    React.useEffect(() => {
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

        // Ak sa upravuje admin alebo hall používateľ, odstráňte tieto polia
        if (isUserBeingEditedAdmin || isUserBeingEditedHall) {
            delete initialData.billing;
            delete initialData.street;
            delete initialData.houseNumber;
            delete initialData.city;
            delete initialData.postalCode;
            delete initialData.country;
            delete initialData.note;
            delete initialData.contactPhoneNumber;
            setDisplayDialCode('');
            setDisplayPhoneNumber('');
        }

        const isEditingMember = title.toLowerCase().includes('upraviť hráča') ||
            title.toLowerCase().includes('upraviť člena realizačného tímu') ||
            title.toLowerCase().includes('upraviť šoféra');

        const isEditingVolunteer = title.toLowerCase().includes('upraviť používateľa') && data?.role === 'volunteer';

        // Inicializácia polí pre dobrovoľníka
        if (title.includes('Upraviť používateľa') && data?.role === 'volunteer') {
            if (initialData.volunteerRoles === undefined) initialData.volunteerRoles = [];
            if (initialData.selectedDates === undefined) initialData.selectedDates = [];
            if (initialData.tshirtSize === undefined) initialData.tshirtSize = '';
            if (initialData.gender === undefined) initialData.gender = '';
            if (initialData.birthDate === undefined) initialData.birthDate = '';
            if (initialData.note === undefined) initialData.note = '';
            if (initialData.street === undefined) initialData.street = '';
            if (initialData.houseNumber === undefined) initialData.houseNumber = '';
            if (initialData.city === undefined) initialData.city = '';
            if (initialData.postalCode === undefined) initialData.postalCode = '';
            if (initialData.country === undefined) initialData.country = '';
        }

        if (title.includes('Upraviť používateľa') && !(isUserBeingEditedAdmin || isUserBeingEditedHall)) {
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
        } else if (isEditingMember || isNewEntry) {
            if (!initialData.address) initialData.address = {};
            if (initialData.address.street === undefined) initialData.address.street = '';
            if (initialData.address.houseNumber === undefined) initialData.address.houseNumber = '';
            if (initialData.address.postalCode === undefined) initialData.address.postalCode = '';
            if (initialData.address.city === undefined) initialData.address.city = '';
            if (initialData.address.country === undefined) initialData.address.country = '';
            if (initialData.firstName === undefined) initialData.firstName = '';
            if (initialData.lastName === undefined) initialData.lastName = '';
            if (initialData.dateOfBirth === undefined) initialData.dateOfBirth = '';
            if (initialData.jerseyNumber === undefined) initialData.jerseyNumber = '';
            if (initialData.registrationNumber === undefined) initialData.registrationNumber = '';
        } else if (title.includes('Upraviť tím') || title.includes('Pridať nový tím')) {
            if (!initialData) {
                initialData = {};
            }
            setSelectedCategory(initialData._category || initialData.category || '');
            if (initialData.teamName === undefined) initialData.teamName = '';
            setSelectedArrivalType(initialData.arrival?.type || '');
            setArrivalTime(initialData.arrival?.time || '');
            setSelectedAccommodationType(initialData.accommodation?.type || '');
            if (!initialData.packageDetails) {
                initialData.packageDetails = {};
            }
            setSelectedPackageName(initialData.packageDetails?.name || '');
            const initialTshirts = (initialData.tshirts || [])
                .filter(tshirt => tshirt.size && (tshirt.quantity || 0) > 0)
                .map(tshirt => ({
                    tempId: generateUniqueId(),
                    size: String(tshirt.size).trim(),
                    quantity: tshirt.quantity || 0
                }));
            setTeamTshirts(initialTshirts);
        }

        // Aplikácia zlúčenia s usersprivate
        const mergedData = mergePrivateData(initialData);
        setLocalEditedData(mergedData);
    }, [data, title, window.globalUserProfileData, db, availableTshirtSizes, isNewEntry, accommodationTypes, privateData, mergePrivateData]);

    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (isDialCodeModalOpen) return;
            if (isConfirmDeleteOpen || isConfirmDeleteTeamOpen) return;
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
    }, [isOpen, onClose, isDialCodeModalOpen, isConfirmDeleteOpen, isConfirmDeleteTeamOpen]);

    React.useEffect(() => {
        if ((title.includes('Upraviť tím') || title.includes('Pridať nový tím')) && packages.length > 0 && localEditedData) {
            const currentPackageName = localEditedData.packageDetails?.name;
            if (currentPackageName && currentPackageName !== selectedPackageName) {
                setSelectedPackageName(currentPackageName);
            } else if (!currentPackageName && selectedPackageName) {
                setSelectedPackageName('');
            }
        }
    }, [localEditedData?.packageDetails?.name, packages, title, selectedPackageName, localEditedData]);

    if (!isOpen) return null;

    const handleTshirtEntryChange = (tempId, field, value) => {
        setTeamTshirts(prev =>
            prev.map(entry =>
                entry.tempId === tempId
                    ? { ...entry, [field]: field === 'quantity' ? Math.max(0, parseInt(value, 10) || 0) : value }
                    : entry
            )
        );
    };

    const removeTshirtEntry = (tempId) => {
        setTeamTshirts(prev => prev.filter(entry => entry.tempId !== tempId));
    };

    const addTshirtEntry = () => {
        const currentlyUsedSizes = teamTshirts.map(entry => entry.size);
        const availableSizesForNewEntry = availableTshirtSizes.filter(size => !currentlyUsedSizes.includes(size));
        if (availableSizesForNewEntry.length > 0) {
            setTeamTshirts(prev => [
                ...prev,
                { tempId: generateUniqueId(), size: availableSizesForNewEntry[0], quantity: 0 }
            ]);
        } else {
            setUserNotificationMessage("Všetky dostupné veľkosti tričiek sú už pridané.", 'info');
        }
    };

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

    const handleNumericInput = (e, path) => {
        const value = e.target.value.replace(/\D/g, '');
        handleChange(path, value);
    };

    const handleIcDphChange = (e, path) => {
        let value = e.target.value;
        let formattedValue = '';
        let cursorPosition = e.target.selectionStart;

        if (value.length > 0) {
            if (/[a-zA-Z]/.test(value[0])) {
                formattedValue += value[0].toUpperCase();
            } else {
                value = value.substring(1);
                cursorPosition = Math.max(0, cursorPosition - 1);
            }
        }
        if (value.length > 1) {
            if (/[a-zA-Z]/.test(value[1])) {
                formattedValue += value[1].toUpperCase();
            } else {
                value = formattedValue + value.substring(2);
                cursorPosition = Math.max(formattedValue.length, cursorPosition - 1);
            }
        }
        if (value.length > 2) {
            formattedValue += value.substring(2).replace(/\D/g, '');
        }
        formattedValue = formattedValue.substring(0, 12);
        handleChange(path, formattedValue);
        setTimeout(() => {
            if (inputRefs.current[path]) {
                inputRefs.current[path].selectionStart = cursorPosition;
                inputRefs.current[path].selectionEnd = cursorPosition;
            }
        }, 0);
    };

    const handlePostalCodeChange = (e, path) => {
        const input = e.target;
        const oldDisplay = input.value;
        const cursorPos = input.selectionStart;
        let digits = oldDisplay.replace(/\D/g, '').slice(0, 5);
        let newDisplay = digits;
        if (digits.length > 3) {
            newDisplay = digits.slice(0, 3) + ' ' + digits.slice(3);
        }
        handleChange(path, digits);
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

    const handleContactPhoneNumberChange = (e) => {
        const value = e.target.value;
        const cleanedValue = value.replace(/\D/g, '');
        setDisplayPhoneNumber(formatNumberGroups(cleanedValue));
    };

    const handleSelectDialCode = (newDialCode) => {
        setDisplayDialCode(newDialCode);
    };

    const isSavable = targetDocRef !== null;

    const getNestedDataForInput = (obj, path) => {
        const value = getNestedValue(obj, path);
        if (value === null) return '';
        if (value === undefined) return '';
        if (path.includes('postalCode')) {
            return String(value || '').replace(/\s/g, '');
        }
        return value;
    };

    const isEditingMember = title.toLowerCase().includes('upraviť hráč') ||
        title.toLowerCase().includes('upraviť člen realizačného tímu') ||
        title.toLowerCase().includes('upraviť šofér');

    const handleDeleteMemberClick = () => {
        const memberName = `${localEditedData.firstName || ''} ${localEditedData.lastName || ''}`.trim();
        setDeleteConfirmMessage(`Naozaj chcete odstrániť ${memberName || 'tohto člena tímu'}? Túto akciu nie je možné vrátiť späť.`);
        setIsConfirmDeleteOpen(true);
    };

    const renderMemberFields = () => {
        const memberElements = [];
        const isPlayer = title.toLowerCase().includes('upraviť hráč') || title.toLowerCase().includes('pridať nový hráč');
        let memberFieldsOrder = [
            'firstName', 'lastName', 'dateOfBirth',
            'address.street', 'address.houseNumber', 'address.postalCode', 'address.city', 'address.country'
        ];
        if (isPlayer) {
            memberFieldsOrder = [
                'firstName', 'lastName', 'dateOfBirth', 'jerseyNumber', 'registrationNumber',
                'address.street', 'address.houseNumber', 'address.postalCode', 'address.city', 'address.country'
            ];
        }
    
        memberFieldsOrder.forEach(path => {
            const value = getNestedValue(localEditedData, path);
            const inputValue = value === undefined || value === null ? '' : value;
            const labelText = formatLabel(path);
            let inputType = 'text';
            let isCheckbox = false;
            let customProps = {};
    
            if (typeof inputValue === 'boolean') {
                isCheckbox = true;
            } else if (path.includes('dateOfBirth')) {
                inputType = 'date';
            } else if (path.includes('jerseyNumber')) {
                customProps = {
                    onChange: (e) => handleNumericInput(e, path),
                    inputMode: 'numeric',
                    pattern: '[0-9]*',
                    maxLength: 3
                };
            } else if (path.includes('registrationNumber')) {
                customProps = {
                    onChange: (e) => handleChange(path, e.target.value),
                    maxLength: 20
                };
            } else if (path.includes('postalCode')) {
                customProps = {
                    onChange: (e) => handlePostalCodeChange(e, path),
                    onKeyDown: (e) => handlePostalCodeKeyDown(e, path),
                    inputMode: 'numeric',
                    pattern: '[0-9 ]*',
                    maxLength: 6,
                    value: getFormattedPostalCodeForInput(getNestedValue(localEditedData, path)),
                    readOnly: !isSavable
                };
            }
    
            memberElements.push(React.createElement(
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
                        value: formatDisplayValue(inputValue, path),
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
        const isEditingMemberOrNewEntry = title.toLowerCase().includes('upraviť hráč') ||
            title.toLowerCase().includes('upraviť člen realizačného tímu') ||
            title.toLowerCase().includes('upraviť šofér') || isNewEntry;

        const isEditingVolunteer = title.toLowerCase().includes('upraviť používateľa') && localEditedData?.role === 'volunteer';

        if (title.includes('upraviť používateľa') && currentPath === 'isMenuToggled') {
            return null;
        }

        if (currentPath === '') {
            // Úprava dobrovoľníka
            if (isEditingVolunteer) {
                const volunteerElements = [];
                const volunteerFieldsOrder = [
                    'firstName', 'lastName', 'contactPhoneNumber',
                    'gender', 'birthDate', 'street', 'houseNumber', 'city',
                    'postalCode', 'country', 'tshirtSize', 'volunteerRoles',
                    'selectedDates', 'note'
                ];
                const volunteerOptions = [
                    'Registrácia',
                    'Organizácia v hale',
                    'VIP občerstvenie',
                    'Fan shop',
                    'Stolík/zápisy stretnutí',
                    'Občerstvenie pre deti'
                ];

                const formatDateForDisplay = (dateString) => {
                    if (!dateString) return '';
                    const [year, month, day] = dateString.split('-');
                    return `${day}. ${month}. ${year}`;
                };

                volunteerFieldsOrder.forEach(path => {
                    const value = getNestedValue(localEditedData, path);
                    const labelText = formatLabel(path);

                    // Vybrané dátumy
                    if (path === 'selectedDates') {
                        const availableDates = window.availableTournamentDates || [];
                        if (availableDates.length === 0) {
                            const selectedDatesFormatted = (value || []).map(date => formatDateForDisplay(date)).join(', ');
                            volunteerElements.push(
                                React.createElement('div', { key: path, className: 'mb-4' },
                                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, labelText),
                                    React.createElement('input', {
                                        type: 'text',
                                        className: 'mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-gray-50 p-2',
                                        value: selectedDatesFormatted || '-',
                                        readOnly: true,
                                        disabled: true
                                    })
                                )
                            );
                        } else {
                            const selectedDatesArray = Array.isArray(value) ? value : [];
                            volunteerElements.push(
                                React.createElement('div', { key: path, className: 'mb-4' },
                                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-2' }, labelText),
                                    React.createElement('div', { className: 'grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md p-2' },
                                        availableDates.map((date, idx) => {
                                            const dateString = typeof date === 'string' ? date : date.toISOString?.()?.split('T')[0] || date;
                                            const isSelected = selectedDatesArray.includes(dateString);
                                            const displayDate = formatDateForDisplay(dateString);
                                            return React.createElement('label', {
                                                key: idx,
                                                className: `flex items-center p-2 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors duration-200 ${isSelected ? 'bg-blue-100' : 'bg-gray-50'}`
                                            },
                                                React.createElement('input', {
                                                    type: 'checkbox',
                                                    checked: isSelected,
                                                    onChange: (e) => {
                                                        const newDates = e.target.checked
                                                            ? [...selectedDatesArray, dateString]
                                                            : selectedDatesArray.filter(d => d !== dateString);
                                                        handleChange(path, newDates);
                                                    },
                                                    className: 'form-checkbox h-4 w-4 text-blue-600 rounded',
                                                    disabled: !isSavable                                                }),
                                                React.createElement('span', { className: 'ml-2 text-gray-700 text-sm' }, displayDate)
                                            );
                                        })
                                    )
                                )
                            );
                        }
                        return;
                    }

                    // Dobrovoľnícke roly
                    if (path === 'volunteerRoles') {
                        const selectedRoles = Array.isArray(value) ? value : [];
                        volunteerElements.push(
                            React.createElement('div', { key: path, className: 'mb-4' },
                                React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-2' }, labelText),
                                React.createElement('div', { className: 'grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md p-2' },
                                    volunteerOptions.map(option => {
                                        const isSelected = selectedRoles.includes(option);
                                        return React.createElement('label', {
                                            key: option,
                                            className: `flex items-center p-2 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors duration-200 ${isSelected ? 'bg-blue-100' : 'bg-gray-50'}`
                                        },
                                            React.createElement('input', {
                                                type: 'checkbox',
                                                checked: isSelected,
                                                onChange: (e) => {
                                                    const newRoles = e.target.checked
                                                        ? [...selectedRoles, option]
                                                        : selectedRoles.filter(r => r !== option);
                                                    handleChange(path, newRoles);
                                                },
                                                className: 'form-checkbox h-4 w-4 text-blue-600 rounded',
                                                disabled: !isSavable
                                            }),
                                            React.createElement('span', { className: 'ml-2 text-gray-700 text-sm' }, option)
                                        );
                                    })
                                )
                            )
                        );
                        return;
                    }

                    // Pohlavie
                    if (path === 'gender') {
                        volunteerElements.push(
                            React.createElement('div', { key: path, className: 'mb-4' },
                                React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, labelText),
                                React.createElement('select', {
                                    className: `mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-white p-2 focus:outline-none focus:ring-2 focus:ring-blue-500`,
                                    value: value || '',
                                    onChange: (e) => handleChange(path, e.target.value),
                                    disabled: !isSavable
                                },
                                    React.createElement('option', { value: '', disabled: true }, 'Vyberte...'),
                                    React.createElement('option', { value: 'male' }, 'Muž'),
                                    React.createElement('option', { value: 'female' }, 'Žena')
                                )
                            )
                        );
                        return;
                    }

                    // Veľkosť trička
                    if (path === 'tshirtSize') {
                        const tshirtSizes = window.availableTshirtSizes || ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
                        volunteerElements.push(
                            React.createElement('div', { key: path, className: 'mb-4' },
                                React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, labelText),
                                React.createElement('select', {
                                    className: `mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-white p-2 focus:outline-none focus:ring-2 focus:ring-blue-500`,
                                    value: value || '',
                                    onChange: (e) => handleChange(path, e.target.value),
                                    disabled: !isSavable
                                },
                                    React.createElement('option', { value: '', disabled: true }, 'Vyberte veľkosť...'),
                                    tshirtSizes.map(size => React.createElement('option', { key: size, value: size }, size))
                                )
                            )
                        );
                        return;
                    }

                    // Dátum narodenia
                    if (path === 'birthDate') {
                        volunteerElements.push(
                            React.createElement('div', { key: path, className: 'mb-4' },
                                React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, labelText),
                                React.createElement('input', {
                                    type: 'date',
                                    className: `mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-white p-2 focus:outline-none focus:ring-2 focus:ring-blue-500`,
                                    value: value || '',
                                    onChange: (e) => handleChange(path, e.target.value),
                                    disabled: !isSavable
                                })
                            )
                        );
                        return;
                    }

                    // PSČ
                    if (path === 'postalCode') {
                        volunteerElements.push(
                            React.createElement('div', { key: path, className: 'mb-4' },
                                React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, labelText),
                                React.createElement('input', {
                                    type: 'text',
                                    className: `mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-white p-2 focus:outline-none focus:ring-2 focus:ring-blue-500`,
                                    value: getFormattedPostalCodeForInput(value || ''),
                                    onChange: (e) => handlePostalCodeChange(e, path),
                                    onKeyDown: (e) => handlePostalCodeKeyDown(e, path),
                                    placeholder: 'xxx xx',
                                    maxLength: 6,
                                    disabled: !isSavable
                                })
                            )
                        );
                        return;
                    }

                    // Telefónne číslo
                    if (path === 'contactPhoneNumber') {
                        volunteerElements.push(
                            React.createElement('div', { key: path, className: 'mb-4' },
                                React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, labelText),
                                React.createElement('div', { className: 'flex' },
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
                            )
                        );
                        return;
                    }

                    // Poznámka
                    if (path === 'note') {
                        volunteerElements.push(
                            React.createElement('div', { key: path, className: 'mb-4' },
                                React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, labelText),
                                React.createElement('textarea', {
                                    className: `mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-white p-2 focus:outline-none focus:ring-2 focus:ring-blue-500`,
                                    value: value || '',
                                    onChange: (e) => handleChange(path, e.target.value),
                                    rows: 3,
                                    disabled: !isSavable,
                                    placeholder: 'Sem môžete napísať dodatočné informácie...'
                                })
                            )
                        );
                        return;
                    }

                    // Bežné textové polia
                    volunteerElements.push(
                        React.createElement('div', { key: path, className: 'mb-4' },
                            React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, labelText),
                            React.createElement('input', {
                                type: 'text',
                                className: `mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-white p-2 focus:outline-none focus:ring-2 focus:ring-blue-500`,
                                value: value || '',
                                onChange: (e) => handleChange(path, e.target.value),
                                disabled: !isSavable
                            })
                        )
                    );
                });
                return volunteerElements;
            }

            // Úprava člena tímu
            if (isEditingMemberOrNewEntry && !title.includes('Pridať nový tím')) {
                return renderMemberFields();
            }

            // Úprava používateľa (klub, admin, hall)
            else if (title.includes('Upraviť používateľa')) {
                const elements = [];
                const allUserFields = [
                    'firstName', 'lastName', 'contactPhoneNumber',
                    'billing.clubName', 'billing.ico', 'billing.dic', 'billing.icDph',
                    'street', 'houseNumber', 'city', 'postalCode', 'country', 'note'
                ];
                let fieldsToRenderForUser = allUserFields;
                const isCurrentUserAdmin = userRole === 'admin';
                const isUserBeingEditedAdminOrHall = isTargetUserAdmin || isTargetUserHall;

                if (isCurrentUserAdmin && isUserBeingEditedAdminOrHall) {
                    fieldsToRenderForUser = ['firstName', 'lastName'];
                }

                const renderedFields = new Set();

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
                            readOnly: !isSavable
                        };
                    } else if (path === 'contactPhoneNumber') {
                        if (isUserBeingEditedAdminOrHall) return null;
                        return React.createElement('div', { key: path, className: 'mb-4' },
                            React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, labelText),
                            React.createElement('div', { className: 'flex' },
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

                    return React.createElement('div', { key: path, className: 'mb-4' },
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

                fieldsToRenderForUser.forEach(path => {
                    elements.push(renderUserField(path, getNestedDataForInput(localEditedData, path)));
                });

                if (!isUserBeingEditedAdminOrHall) {
                    const billingFieldsInScope = allUserFields.filter(p => p.startsWith('billing.') && fieldsToRenderForUser.includes(p));
                    if (billingFieldsInScope.length > 0) {
                        elements.push(
                            React.createElement('div', { key: 'billing-section', className: 'pl-4 border-l border-gray-200 mb-4' },
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
                            React.createElement('div', { key: 'address-section', className: 'pl-4 border-l border-gray-200 mb-4' },
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
            }

            // Úprava tímu
            else if (title.includes('Upraviť tím') || title.includes('Pridať nový tím')) {
                const teamElements = [];

                teamElements.push(
                    React.createElement('div', { key: '_category', className: 'mb-4' },
                        React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Kategória tímu'),
                        React.createElement('select', {
                            className: `mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-white p-2 focus:outline-none focus:ring-2 focus:ring-blue-500`,
                            value: selectedCategory,
                            onChange: (e) => {
                                setSelectedCategory(e.target.value);
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

                teamElements.push(
                    React.createElement('div', { key: 'teamName', className: 'mb-4' },
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

                teamElements.push(
                    React.createElement('div', { key: 'arrival', className: 'mb-4' },
                        React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Typ dopravy'),
                        React.createElement('select', {
                            className: `mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-white p-2 focus:outline-none focus:ring-2 focus:ring-blue-500`,
                            value: selectedArrivalType,
                            onChange: (e) => {
                                setSelectedArrivalType(e.target.value);
                                handleChange('arrival.type', e.target.value);
                            },
                            disabled: !isSavable
                        },
                            React.createElement('option', { value: '', disabled: true }, 'Vyberte typ dopravy'),
                            selectedArrivalType && !arrivalOptions.includes(selectedArrivalType) &&
                                React.createElement('option', { key: selectedArrivalType, value: selectedArrivalType, disabled: true, hidden: true }, selectedArrivalType),
                            arrivalOptions.map(option => React.createElement('option', { key: option, value: option }, option))
                        ),
                        (selectedArrivalType === 'verejná doprava - vlak' || selectedArrivalType === 'verejná doprava - autobus') &&
                            React.createElement('div', { key: 'arrival.time-container', className: 'mt-2' },
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

                teamElements.push(
                    React.createElement('div', { key: 'accommodation.type', className: 'mb-4' },
                        React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Typ ubytovania'),
                        React.createElement('select', {
                            className: `mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-white p-2 focus:outline-none focus:ring-2 focus:ring-blue-500`,
                            value: selectedAccommodationType,
                            onChange: (e) => {
                                const newValue = e.target.value;
                                setSelectedAccommodationType(newValue);
                                handleChange('accommodation', { type: newValue });
                                handleChange('accommodation.type', newValue);

                                const allPackages = packages || [];
                                const availablePackagesForNewType = allPackages.filter(pkg => {
                                    if (!pkg.accommodationTypes || pkg.accommodationTypes.length === 0) return true;
                                    if (newValue === 'bez ubytovania') {
                                        return pkg.accommodationTypes.includes('bez ubytovania');
                                    }
                                    return pkg.accommodationTypes.includes(newValue);
                                });

                                const currentPackageStillAvailable = selectedPackageName && availablePackagesForNewType.some(pkg => pkg.name === selectedPackageName);

                                if (!currentPackageStillAvailable && availablePackagesForNewType.length > 0) {
                                    const firstAvailablePackage = availablePackagesForNewType[0];
                                    setSelectedPackageName(firstAvailablePackage.name);
                                    const { id, ...packageDataToSave } = firstAvailablePackage;
                                    handleChange('packageDetails', packageDataToSave);
                                } else if (!currentPackageStillAvailable && availablePackagesForNewType.length === 0) {
                                    setSelectedPackageName('');
                                    handleChange('packageDetails', null);
                                }
                            },
                            disabled: !isSavable
                        },
                            React.createElement('option', { value: '', disabled: true }, 'Vyberte typ ubytovania'),
                            selectedAccommodationType && !accommodationOptionsWithNone.includes(selectedAccommodationType) &&
                                React.createElement('option', { key: selectedAccommodationType, value: selectedAccommodationType, disabled: true, hidden: true }, selectedAccommodationType),
                            accommodationOptionsWithNone.map(option => React.createElement('option', { key: option, value: option }, option))
                        )
                    )
                );

                teamElements.push(
                    React.createElement('div', { key: 'packageDetails.name', className: 'mb-4' },
                        React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Balík'),
                        React.createElement('select', {
                            className: `mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-white p-2 focus:outline-none focus:ring-2 focus:ring-blue-500`,
                            value: selectedPackageName || '',
                            onChange: (e) => {
                                const newPackageName = e.target.value;
                                setSelectedPackageName(newPackageName);
                                const selectedPackage = packages.find(pkg => pkg.name === newPackageName);
                                if (selectedPackage) {
                                    const { id, ...packageDataToSave } = selectedPackage;
                                    handleChange('packageDetails', packageDataToSave);
                                } else {
                                    handleChange('packageDetails', null);
                                }
                            },
                            disabled: !isSavable
                        },
                            React.createElement('option', { value: '', disabled: true }, 'Vyberte balík'),
                            (() => {
                                const allPackages = packages || [];
                                const filteredPackages = allPackages.filter(pkg => {
                                    if (!pkg.accommodationTypes || pkg.accommodationTypes.length === 0) return true;
                                    if (selectedAccommodationType === 'bez ubytovania') {
                                        return pkg.accommodationTypes.includes('bez ubytovania');
                                    }
                                    return pkg.accommodationTypes.includes(selectedAccommodationType);
                                });
                                return filteredPackages
                                    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                                    .map(pkg => React.createElement('option', { key: pkg.id || pkg.name, value: pkg.name }, pkg.name));
                            })()
                        )
                    )
                );

                teamElements.push(
                    React.createElement('div', { key: 'jerseyColors', className: 'mb-6 border-t border-gray-200 pt-4' },
                        React.createElement('label', { className: 'block text-base font-semibold text-gray-800 mb-3' }, 'Farby dresov'),
                        React.createElement('div', { className: 'grid grid-cols-1 sm:grid-cols-2 gap-6' },
                            React.createElement('div', null,
                                React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Farba dresov 1'),
                                React.createElement('input', {
                                    type: 'text',
                                    className: 'mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-white p-2 focus:outline-none focus:ring-2 focus:ring-blue-500',
                                    value: localEditedData.jerseyHomeColor || '',
                                    onChange: (e) => handleChange('jerseyHomeColor', e.target.value),
                                    placeholder: 'Zadajte farbu',
                                    disabled: !isSavable
                                })
                            ),
                            React.createElement('div', null,
                                React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Farba dresov 2'),
                                React.createElement('input', {
                                    type: 'text',
                                    className: 'mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-white p-2 focus:outline-none focus:ring-2 focus:ring-blue-500',
                                    value: localEditedData.jerseyAwayColor || '',
                                    onChange: (e) => handleChange('jerseyAwayColor', e.target.value),
                                    placeholder: 'Zadajte farbu',
                                    disabled: !isSavable
                                })
                            )
                        )
                    )
                );

                if (availableTshirtSizes.length > 0) {
                    const usedSizes = teamTshirts.map(entry => entry.size);
                    teamElements.push(
                        React.createElement('div', { key: 'tshirts-section', className: 'mb-4' },
                            React.createElement('h4', { className: 'text-md font-semibold text-gray-800 mb-2' }, 'Tričká'),
                            teamTshirts.map(tshirtEntry =>
                                React.createElement('div', { key: tshirtEntry.tempId, className: 'flex items-center mb-2' },
                                    React.createElement('select', {
                                        className: `mt-1 block w-32 rounded-md border-gray-300 shadow-sm bg-white p-2 mr-2 focus:outline-none focus:ring-2 focus:ring-blue-500`,
                                        value: tshirtEntry.size,
                                        onChange: (e) => handleTshirtEntryChange(tshirtEntry.tempId, 'size', e.target.value),
                                        disabled: !isSavable
                                    },
                                        availableTshirtSizes.includes(tshirtEntry.size) ?
                                            React.createElement('option', { key: tshirtEntry.size, value: tshirtEntry.size }, tshirtEntry.size)
                                            : (tshirtEntry.size && React.createElement('option', { key: tshirtEntry.size, value: tshirtEntry.size, disabled: true, hidden: true }, `${tshirtEntry.size} (Neplatná)`)),
                                        availableTshirtSizes
                                            .filter(size => !usedSizes.includes(size) || size === tshirtEntry.size)
                                            .map(size => (
                                                size !== tshirtEntry.size ?
                                                    React.createElement('option', { key: size, value: size }, size) : null
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
                                        className: 'flex-shrink-0 flex items-center justify-center w-8 h-8 bg-red-500 text-white rounded-full hover:bg-red-600 focus:outline-none text-xl leading-none',
                                        style: { lineHeight: '10px' },
                                    }, '-')
                                )
                            ),
                            React.createElement('div', { className: 'flex justify-center mt-2' },
                                React.createElement('button', {
                                    type: 'button',
                                    onClick: addTshirtEntry,
                                    className: 'flex-shrink-0 flex items-center justify-center w-8 h-8 bg-blue-500 text-white rounded-full hover:bg-blue-600 focus:outline-none text-xl leading-none',
                                    style: { lineHeight: '10px' },
                                    disabled: !isSavable || teamTshirts.length >= availableTshirtSizes.length
                                }, '+')
                            )
                        )
                    );
                }
                return teamElements;
            }
        } else {
            // Vnorené polia
            return Object.entries(obj).map(([key, value]) => {
                if (key.startsWith('_') || ['teams', 'columnOrder', 'displayNotifications', 'emailVerified', 'password', 'packageDetails', 'accommodation', 'arrival', 'tshirts'].includes(key)) {
                    return null;
                }

                const fullKeyPath = currentPath ? `${currentPath}.${key}` : key;

                if (typeof value === 'object' && value !== null && !Array.isArray(value) && !(value.toDate && typeof value.toDate === 'function')) {
                    return React.createElement(CollapsibleSection, {
                        key: fullKeyPath,
                        title: formatLabel(fullKeyPath),
                        defaultOpen: false,
                        noOuterStyles: true
                    }, renderDataFields(value, fullKeyPath));
                } else if (Array.isArray(value)) {
                    if (value.length === 0) {
                        return React.createElement('div', { key: fullKeyPath, className: 'mb-4' },
                            React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, formatLabel(fullKeyPath)),
                            React.createElement('input', {
                                type: 'text',
                                readOnly: true,
                                className: 'mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-gray-50 text-gray-700 p-2',
                                value: '(Prázdne)'
                            })
                        );
                    }
                    return React.createElement('div', { key: fullKeyPath, className: 'border border-gray-200 rounded-lg mb-2' },
                        value.map((item, index) => React.createElement(CollapsibleSection, {
                            key: `${fullKeyPath}[${index}]`,
                            title: `${item.firstName || ''} ${item.lastName || item.size || 'Položka'}`,
                            defaultOpen: false,
                            noOuterStyles: false
                        }, renderDataFields(item, `${fullKeyPath}[${index}]`)))
                    );
                } else {
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
                    } else if (fullKeyPath.includes('jerseyNumber')) {
                        customProps = {
                            onChange: (e) => handleNumericInput(e, fullKeyPath),
                            inputMode: 'numeric',
                            pattern: '[0-9]*',
                            maxLength: 3
                        };
                    } else if (fullKeyPath.includes('registrationNumber')) {
                        customProps = {
                            onChange: (e) => handleChange(fullKeyPath, e.target.value),
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

                    return React.createElement('div', { key: fullKeyPath, className: 'mb-4' },
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
                renderDataFields(localEditedData)
            ),
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mt-4' },
                (!isNewEntry && isEditingMember) && React.createElement('button', {
                    className: 'px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600',
                    onClick: handleDeleteMemberClick,
                    disabled: !isSavable
                }, 'Odstrániť člena'),
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
                        
                                if (dataToPrepareForSave.contactPhoneNumber !== undefined && !(isTargetUserAdmin || isTargetUserHall)) {
                                    dataToPrepareForSave.contactPhoneNumber = combinePhoneNumber(displayDialCode, displayPhoneNumber);
                                } else if (isTargetUserAdmin || isTargetUserHall) {
                                    delete dataToPrepareForSave.contactPhoneNumber;
                                }
                        
                                if (title.includes('Upraviť tím') || title.includes('Pridať nový tím')) {
                                    dataToPrepareForSave.category = selectedCategory;
                                    dataToPrepareForSave._category = selectedCategory;
                        
                                    if (selectedArrivalType) {
                                        dataToPrepareForSave.arrival = { type: selectedArrivalType };
                                        if (selectedArrivalType === 'verejná doprava - vlak' || selectedArrivalType === 'verejná doprava - autobus') {
                                            dataToPrepareForSave.arrival.time = arrivalTime;
                                        } else {
                                            dataToPrepareForSave.arrival.time = '';
                                        }
                                    } else {
                                        dataToPrepareForSave.arrival = { type: '' };
                                    }
                        
                                    if (!dataToPrepareForSave.accommodation) {
                                        dataToPrepareForSave.accommodation = {};
                                    }
                                    dataToPrepareForSave.accommodation.type = selectedAccommodationType;
                        
                                    if (selectedPackageName) {
                                        const selectedPackage = packages.find(pkg => pkg.name === selectedPackageName);
                                        if (selectedPackage) {
                                            const { id, ...packageDataToSave } = selectedPackage;
                                            dataToPrepareForSave.packageDetails = packageDataToSave;
                                        }
                                    } else {
                                        delete dataToPrepareForSave.packageDetails;
                                    }
                        
                                    dataToPrepareForSave.tshirts = teamTshirts
                                        .filter(t => t.size && t.quantity > 0)
                                        .map(({ size, quantity }) => ({ size, quantity }));
                                }
                        
                                const finalDataToSave = {};
                                Object.keys(dataToPrepareForSave).forEach(key => {
                                    if (!['id', 'uniqueId', 'type', 'originalArray', 'originalIndex', 'password'].includes(key)) {
                                        const value = dataToPrepareForSave[key];
                                        if (key === 'billing' && (isTargetUserAdmin || isTargetUserHall)) {
                                            // Preskočíme billing pre admin/hall
                                        } else {
                                            finalDataToSave[key] = value;
                                        }
                                    }
                                });
                        
                                const isAddingNewMember = isNewEntry && (
                                    editModalTitle.toLowerCase().includes('pridať nový hráč') ||
                                    editModalTitle.toLowerCase().includes('pridať nový člen realizačného tímu (žena)') ||
                                    editModalTitle.toLowerCase().includes('pridať nový člen realizačného tímu (muž)') ||
                                    editModalTitle.toLowerCase().includes('pridať nový šofér (žena)') ||
                                    editModalTitle.toLowerCase().includes('pridať nový šofér (muž)')
                                );
                        
                                const isAddingNewTeam = isNewEntry && editModalTitle.includes('Pridať nový tím');
                        
                                // 🔧 Zistíme, či ide o úpravu existujúceho člena tímu
                                const isEditingTeamMember = 
                                    (editModalTitle.toLowerCase().includes('upraviť hráč') ||
                                     editModalTitle.toLowerCase().includes('upraviť člen realizačného tímu') ||
                                     editModalTitle.toLowerCase().includes('upraviť šofér')) &&
                                    originalDataPath && 
                                    (originalDataPath.includes('playerDetails') ||
                                     originalDataPath.includes('menTeamMemberDetails') ||
                                     originalDataPath.includes('womenTeamMemberDetails') ||
                                     originalDataPath.includes('driverDetailsMale') ||
                                     originalDataPath.includes('driverDetailsFemale'));
                        
                                let generatedChanges = [];
                        
                                // ============================================================
                                // GENEROVANIE NOTIFIKÁCIÍ – PRESKOČÍME PRE ÚPRAVU ČLENA TÍMU
                                // ============================================================
                                if (isAddingNewMember) {
                                } else if (isAddingNewTeam) {
                                    generatedChanges = [`Nový tím bol pridaný: ${finalDataToSave.teamName || 'Bez názvu'}`];
                                } else if (!isEditingTeamMember) {
                                    const originalDataForCompare = JSON.parse(JSON.stringify(data || {}));
                                    const modifiedDataForCompare = JSON.parse(JSON.stringify(dataToPrepareForSave));
                        
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
                        
                                    const originalCategory = originalDataForCompare?._category || originalDataForCompare?.category || '-';
                                    const updatedCategory = modifiedDataForCompare?._category || modifiedDataForCompare?.category || '-';
                                    if (originalCategory !== updatedCategory && !generatedChanges.some(c => c.includes('Zmena Kategórie:'))) {
                                        generatedChanges.push(`Zmena Kategórie: z '${originalCategory}' na '${updatedCategory}'`);
                                    }
                        
                                    if (finalDataToSave.teamName || finalDataToSave._category) {
                                        const teamName = finalDataToSave.teamName || 'Bez názvu';
                                        const teamCategory = finalDataToSave._category || finalDataToSave.category || 'Neznáma kategória';
                                        generatedChanges = generatedChanges.map(change =>
                                            `Tím ${teamName} (${teamCategory}): ${change}`
                                        );
                                    }
                                }
                        
                                // ============================================================
                                // ULOŽENIE NOTIFIKÁCIÍ (LEN AK NIE SÚ PRÁZDNÉ A NIE JE TO ÚPRAVA ČLENA)
                                // ============================================================
                                if (generatedChanges.length > 0 && !isAddingNewMember && !isEditingTeamMember) {
                                    const userEmail = window.auth.currentUser?.email;
                                    if (userEmail) {
                                        const notificationsCollectionRef = collection(db, 'notifications');
                                        await addDoc(notificationsCollectionRef, {
                                            userEmail,
                                            changes: generatedChanges,
                                            timestamp: serverTimestamp()
                                        });
                                    }
                                }
                        
                                // ============================================================
                                // SPRÁVA O "ŽIADNE ZMENY" – PRESKOČÍME PRE ÚPRAVU ČLENA
                                // ============================================================
                                if (generatedChanges.length === 0 && !isAddingNewMember && !isAddingNewTeam && !isEditingTeamMember) {
                                    setUserNotificationMessage("Žiadne zmeny na uloženie.", 'info');
                                    onClose();
                                    return;
                                }
                        
                                // ============================================================
                                // ZAVOLÁME ONSAVE (TAM SA GENERUJÚ NOTIFIKÁCIE S KONTEXTOM PRE ČLENA)
                                // ============================================================
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
        !(isTargetUserAdmin || isTargetUserHall) && React.createElement(DialCodeSelectionModal, {
            isOpen: isDialCodeModalOpen,
            onClose: () => setIsDialCodeModalOpen(false),
            onSelectDialCode: handleSelectDialCode,
            currentDialCode: displayDialCode
        }),
        React.createElement(ConfirmationModal, {
            isOpen: isConfirmDeleteOpen,
            onClose: () => setIsConfirmDeleteOpen(false),
            onConfirm: () => onDeleteMember(targetDocRef, originalDataPath),
            title: "Potvrdenie odstránenia člena",
            message: deleteConfirmMessage
        }),
        React.createElement(ConfirmationModal, {
            isOpen: isConfirmDeleteTeamOpen,
            onClose: () => setIsConfirmDeleteTeamOpen(false),
            onConfirm: () => {
                onDeleteTeam(targetDocRef, originalDataPath);
                setIsConfirmDeleteTeamOpen(false);
                onClose();
            },
            title: "Potvrdenie odstránenia tímu",
            message: deleteTeamConfirmMessage
        })
    );
}

// Pomocná funkcia na aktualizáciu vnoreného objektu podľa cesty a vrátenia upraveného poľa najvyššej úrovne pre aktualizáciu Firestore
const updateNestedObjectByPath = (obj, path, value) => {
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

const cleanTeamForUsers = (team) => {
    if (!team) return team;

    const cleanMemberArray = (arr) => {
        if (!Array.isArray(arr)) return arr;
        return arr.map(member => {
            if (!member) return member;
            const cleaned = { ...member };
            // Odstránime osobné polia
            const privateKeys = [
                'address', 'dateOfBirth', '_address', '_dateOfBirth',
                '_privateData', 'birthDate', 'gender',
                'street', 'houseNumber', 'city', 'postalCode', 'country'
            ];
            privateKeys.forEach(key => delete cleaned[key]);
            return cleaned;
        });
    };

    const cleanedTeam = { ...team };
    const memberArrays = [
        'playerDetails',
        'menTeamMemberDetails',
        'womenTeamMemberDetails',
        'driverDetailsMale',
        'driverDetailsFemale'
    ];
    memberArrays.forEach(key => {
        if (cleanedTeam[key]) {
            cleanedTeam[key] = cleanMemberArray(cleanedTeam[key]);
        }
    });

    // Odstránime aj osobné polia na úrovni tímu
    const privateKeys = [
        'address', 'dateOfBirth', '_address', '_dateOfBirth',
        '_privateData', 'birthDate', 'gender',
        'street', 'houseNumber', 'city', 'postalCode', 'country'
    ];
    privateKeys.forEach(key => delete cleanedTeam[key]);

    return cleanedTeam;
};

const translateRole = (role) => {
  switch (role) {
    case 'club':
      return 'Klub';
    case 'admin':
      return 'Administrátor';
    case 'volunteer':
      return 'Dobrovoľník';
    case 'hall':
      return 'Hala';
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
    { id: 'city', label: 'Mesto/obec', type: true },
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

  const getHashFromState = () => {
    if (showUsers && showTeams) return '#both';
    if (showUsers && !showTeams) return '#users';
    if (!showUsers && showTeams) return '#teams';
    return '#none';
  };

  const setStateFromHash = () => {
      const hash = window.location.hash || '';
      if (hash === '#users') {
        setShowUsers(true);
        setShowTeams(false);
      } else if (hash === '#teams') {
        setShowUsers(false);
        setShowTeams(true);
      } else if (hash === '#both') {
        setShowUsers(true);
        setShowTeams(true);
      } else if (hash === '#none') {
        setShowUsers(false);
        setShowTeams(false);
      } else {
        setShowUsers(true);
        setShowTeams(true);
      }
  };

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
    // Odstrániť citlivé alebo irelevantné kľúče
    const cleanedData = { ...data };
    delete cleanedData.password;
    delete cleanedData.emailVerified;
    delete cleanedData.id;

    // 🔧 Prenesieme _dateOfBirth a _address do štandardných kľúčov LEN PRE ČLENOV TÍMU
    const isMemberEdit = originalDataPath && (
        originalDataPath.includes('playerDetails') ||
        originalDataPath.includes('menTeamMemberDetails') ||
        originalDataPath.includes('womenTeamMemberDetails') ||
        originalDataPath.includes('driverDetailsMale') ||
        originalDataPath.includes('driverDetailsFemale')
    );

    if (isMemberEdit) {
        if (cleanedData._dateOfBirth) {
            cleanedData.dateOfBirth = cleanedData._dateOfBirth;
        }
        if (cleanedData._address) {
            cleanedData.address = { ...(cleanedData.address || {}), ...cleanedData._address };
        }
    }

    // Odstránime _dateOfBirth a _address vždy (aby neovplyvňovali notifikácie)
    delete cleanedData._dateOfBirth;
    delete cleanedData._address;

    setEditingData(cleanedData);
    setEditModalTitle(title);
    setEditingDocRef(targetDocRef);
    setEditingDataPath(originalDataPath);
    setIsNewEntry(newEntryFlag);
    setIsEditModalOpen(true);
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
                  Object.entries(u.teams).forEach(([category, teamListRaw]) => {
                      const teamList = Array.isArray(teamListRaw) ? teamListRaw : [];
                      teamList.forEach((team, teamIndex) => {
                          // Počítame priamo z dát, ktoré už máme zlúčené
                          let menTeamMembersCount = team.menTeamMemberDetails?.length || 0;
                          let womenTeamMembersCount = team.womenTeamMemberDetails?.length || 0;
                          let menDriversCount = team.driverDetailsMale?.length || 0; 
                          let womenDriversCount = team.driverDetailsFemale?.length || 0; 
                          let playersCount = team.playerDetails?.length || 0;
    
                          const teamTshirtsMap = new Map(
                            (team.tshirts || []).map(t => [String(t.size).trim(), t.quantity || 0])
                          );
    
                          // IMPORTANT: Použijeme priamo team objekt, ktorý už má zlúčené dáta z usersprivate
                          // NIE je potrebné znova zlučovať s _privateData
                          teams.push({
                              ...team,  // Použijeme priamo team, nie teamWithPrivateData
                              _userId: u.id,
                              _category: category,
                              _teamIndex: teamIndex,
                              _registeredBy: `${u.firstName} ${u.lastName}`,
                              _menTeamMembersCount: menTeamMembersCount,
                              _womenTeamMembersCount: womenTeamMembersCount,
                              _menDriversCount: menDriversCount, 
                              _womenDriversCount: womenDriversCount, 
                              _players: playersCount,
                              _teamTshirtsMap: teamTshirtsMap,
                              _privateData: u._privateData
                          });
                      });
                  });
              }
          });
          return teams.sort((a, b) => {
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
      if (!db) return;
      
      const fetchTournamentDates = async () => {
          try {
              const docRef = doc(db, 'settings/registration');
              const unsubscribe = onSnapshot(docRef, (docSnap) => {
                  if (docSnap.exists()) {
                      const data = docSnap.data();
                      if (data.tournamentStart && data.tournamentEnd) {
                          const startDate = data.tournamentStart.toDate();
                          const endDate = data.tournamentEnd.toDate();
                          const dates = [];
                          const currentDate = new Date(startDate);
                          while (currentDate <= endDate) {
                              dates.push(new Date(currentDate));
                              currentDate.setDate(currentDate.getDate() + 1);
                          }
                          window.availableTournamentDates = dates;
                      }
                  }
              }, (error) => {
                  console.error("Chyba pri načítavaní dátumov turnaja:", error);
              });
              return () => unsubscribe();
          } catch (error) {
              console.error("Chyba:", error);
          }
      };
      
      fetchTournamentDates();
  }, [db]);
  
  // Načítanie veľkostí tričiek (pre dobrovoľníkov)
  React.useEffect(() => {
      if (!db) return;
      
      const fetchTshirtSizes = () => {
          const docRef = doc(db, 'settings/sizeTshirts');
          const unsubscribe = onSnapshot(docRef, (docSnap) => {
              if (docSnap.exists()) {
                  const data = docSnap.data();
                  if (data && data.sizes && Array.isArray(data.sizes)) {
                      window.availableTshirtSizes = data.sizes;
                  }
              }
          }, (error) => {
              console.error("Chyba pri načítavaní veľkostí tričiek:", error);
          });
          return () => unsubscribe();
      };
      
      fetchTshirtSizes();
  }, [db]);

  React.useEffect(() => {
      setStateFromHash();

      const handleHashChange = () => {
        setStateFromHash();
      };

      window.addEventListener('hashchange', handleHashChange);

      return () => {
        window.removeEventListener('hashchange', handleHashChange);
      };
  }, []);

  React.useEffect(() => {
      // Ak sa zmení niektorý z checkboxov → aktualizuj hash
      const newHash = getHashFromState();

      // Len ak sa hash naozaj zmenil → zabránime zbytočným zápisom
      if (window.location.hash !== newHash) {
        // Použijeme replace, aby sme nezapisovali do histórie (lepšie UX)
        window.history.replaceState(null, '', newHash);
      }
  }, [showUsers, showTeams]);

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
        }
      }, 100);

      const handleGlobalDataUpdate = (event) => {
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
            setUser(currentUser);
            setUserProfileData(window.globalUserProfileData);
            if (!currentUser) {
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
      if (typeof window.showGlobalLoader === 'function') {
        window.showGlobalLoader();
      }

      try {
        const userDocRef = doc(db, 'users', user.uid);
        unsubscribeUserDoc = onSnapshot(userDocRef, (docSnapshot) => {
          if (docSnapshot.exists()) {
            const userData = docSnapshot.data();

            setUserProfileData(userData);
            setError('');
              
            if (typeof window.hideGlobalLoader === 'function') {
              window.hideGlobalLoader();
            }

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
        if (typeof window.hideGlobalLoader === 'function') {
          window.hideGlobalLoader();
        }
        window.location.href = 'login.html';
        return;
    }

    return () => {
      if (unsubscribeUserDoc) {
          unsubscribeUserDoc();
      }
    };
  }, [isAuthReady, db, user, auth]);

  // Upravená funkcia pre načítanie používateľov - s debug logmi
  React.useEffect(() => {
    let unsubscribeAllUsers;
    let unsubscribeAllPrivateUsers;
  
    if (isAuthReady && db && user && user.uid && userProfileData && userProfileData.role === 'admin' && userProfileData.approved === true) {
      if (typeof window.showGlobalLoader === 'function') {
        window.showGlobalLoader();
      }
  
      try {
        const usersCollectionRef = collection(db, 'users');
        const privateUsersCollectionRef = collection(db, 'usersprivate');
  
        // Načítanie users
        unsubscribeAllUsers = onSnapshot(usersCollectionRef, usersSnapshot => {
          const usersData = usersSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
  
          // Načítanie usersprivate
          unsubscribeAllPrivateUsers = onSnapshot(privateUsersCollectionRef, privateSnapshot => {
            const privateDataMap = {};
            privateSnapshot.docs.forEach(doc => {
              privateDataMap[doc.id] = doc.data();
            });  
  
            // Zlúčenie údajov - z usersprivate preberieme adresy a dátumy narodenia
            const mergedUsersData = usersData.map(user => {
              const privateData = privateDataMap[user.id] || {};
  
              const mergedUser = {
                  ...user,
                  // Adresy načítame výhradne z privateData (žiaden fallback na user)
                  street: privateData.address?.street || '',
                  houseNumber: privateData.address?.houseNumber || '',
                  city: privateData.address?.city || '',
                  postalCode: privateData.address?.postalCode || '',
                  country: privateData.address?.country || '',
                  billing: {
                      ...user.billing,
                      address: privateData.billingAddress || user.billing?.address || {
                          street: '',
                          houseNumber: '',
                          city: '',
                          postalCode: '',
                          country: ''
                      }
                  },
                  _privateData: privateData
              };
  
              // Zlúčenie tímových údajov - pridanie dátumov narodenia a adries z usersprivate
              if (mergedUser.teams && privateData.persons) {
                  Object.keys(mergedUser.teams).forEach(category => {
                      const teams = mergedUser.teams[category];
                      if (Array.isArray(teams)) {
                          teams.forEach((team, teamIndex) => {
                              const teamKey = `${category}_team${teamIndex + 1}`;
                              const privateTeamData = privateData.persons?.[teamKey] || {};
              
                              // Zlúčenie hráčov
                              if (team.playerDetails && privateTeamData.players) {
                                  team.playerDetails = team.playerDetails.map((player, index) => {
                                      const privatePlayer = privateTeamData.players[index] || {};
                                      // Vytvoríme nový objekt bez pôvodných dateOfBirth a address
                                      const { dateOfBirth, address, ...rest } = player;
                                      return {
                                          ...rest,
                                          // Výhradne z privateData (žiaden fallback)
                                          _dateOfBirth: privatePlayer.dateOfBirth || '',
                                          _address: privatePlayer.address || {
                                              street: '',
                                              houseNumber: '',
                                              city: '',
                                              postalCode: '',
                                              country: ''
                                          }
                                      };
                                  });
                              }
              
                              // Zlúčenie žien - členiek tímu
                              if (team.womenTeamMemberDetails && privateTeamData.womenTeamMembers) {
                                  team.womenTeamMemberDetails = team.womenTeamMemberDetails.map((member, index) => {
                                      const privateMember = privateTeamData.womenTeamMembers[index] || {};
                                      const { dateOfBirth, address, ...rest } = member;
                                      return {
                                          ...rest,
                                          _dateOfBirth: privateMember.dateOfBirth || '',
                                          _address: privateMember.address || {
                                              street: '',
                                              houseNumber: '',
                                              city: '',
                                              postalCode: '',
                                              country: ''
                                          }
                                      };
                                  });
                              }
              
                              // Zlúčenie mužov - členov tímu
                              if (team.menTeamMemberDetails && privateTeamData.menTeamMembers) {
                                  team.menTeamMemberDetails = team.menTeamMemberDetails.map((member, index) => {
                                      const privateMember = privateTeamData.menTeamMembers[index] || {};
                                      const { dateOfBirth, address, ...rest } = member;
                                      return {
                                          ...rest,
                                          _dateOfBirth: privateMember.dateOfBirth || '',
                                          _address: privateMember.address || {
                                              street: '',
                                              houseNumber: '',
                                              city: '',
                                              postalCode: '',
                                              country: ''
                                          }
                                      };
                                  });
                              }
              
                              // Zlúčenie šoférov - mužov
                              if (team.driverDetailsMale && privateTeamData.driversMale) {
                                  team.driverDetailsMale = team.driverDetailsMale.map((driver, index) => {
                                      const privateDriver = privateTeamData.driversMale[index] || {};
                                      const { dateOfBirth, address, ...rest } = driver;
                                      return {
                                          ...rest,
                                          _dateOfBirth: privateDriver.dateOfBirth || '',
                                          _address: privateDriver.address || {
                                              street: '',
                                              houseNumber: '',
                                              city: '',
                                              postalCode: '',
                                              country: ''
                                          }
                                      };
                                  });
                              }
              
                              // Zlúčenie šoférov - žien
                              if (team.driverDetailsFemale && privateTeamData.driversFemale) {
                                  team.driverDetailsFemale = team.driverDetailsFemale.map((driver, index) => {
                                      const privateDriver = privateTeamData.driversFemale[index] || {};
                                      const { dateOfBirth, address, ...rest } = driver;
                                      return {
                                          ...rest,
                                          _dateOfBirth: privateDriver.dateOfBirth || '',
                                          _address: privateDriver.address || {
                                              street: '',
                                              houseNumber: '',
                                              city: '',
                                              postalCode: '',
                                              country: ''
                                          }
                                      };
                                  });
                              }
                          });
                      }
                  });
              }
  
              return mergedUser;
            });  
  
            setAllUsers(mergedUsersData);
            setFilteredUsers(mergedUsersData);
            if (typeof window.hideGlobalLoader === 'function') {
              window.hideGlobalLoader();
            }
          }, error => {
            console.error("Chyba pri načítaní usersprivate:", error);
            setAllUsers(usersData);
            setFilteredUsers(usersData);
            if (typeof window.hideGlobalLoader === 'function') {
              window.hideGlobalLoader();
            }
          });
        }, error => {
          console.error("Chyba pri načítaní používateľov:", error);
          setError(`Chyba pri načítaní používateľov: ${error.message}`);
          if (typeof window.hideGlobalLoader === 'function') {
            window.hideGlobalLoader();
          }
        });
      } catch (e) {
        console.error("Chyba pri nastavovaní onSnapshot:", e);
        setError(`Chyba pri načítaní používateľov: ${e.message}`);
        if (typeof window.hideGlobalLoader === 'function') {
          window.hideGlobalLoader();
        }
      }
    } else if (isAuthReady && user === null) {
      if (typeof window.hideGlobalLoader === 'function') {
        window.hideGlobalLoader();
      }
      window.location.href = 'login.html';
      return;
    } else if (isAuthReady && userProfileData && (userProfileData.role !== 'admin' || userProfileData.approved === false)) {
      setError("Nemáte oprávnenie na zobrazenie tejto stránky. Iba schválení administrátori majú prístup.");
      if (typeof window.showGlobalLoader === 'function') {
        window.showGlobalLoader();
      }
      window.location.href = 'logged-in-my-data.html';
      return;
    }
  
    return () => {
      if (unsubscribeAllUsers) {
        unsubscribeAllUsers();
      }
      if (unsubscribeAllPrivateUsers) {
        unsubscribeAllPrivateUsers();
      }
    };
  }, [db, userProfileData, isAuthReady, user]);

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
  };

const openFilterModal = (column) => {
    setFilterColumn(column);
    // Pre stĺpec "role" generujeme zoznam preložených hodnôt, ale filtrovanie bude prebiehať na pôvodných
    if (column === 'role') {
      const roleValues = [
        { value: 'club', label: 'Klub' },
        { value: 'admin', label: 'Administrátor' },
        { value: 'volunteer', label: 'Dobrovoľník' },
        { value: 'hall', label: 'Hala' },
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
    } else {
      authLink.classList.remove('hidden');
      profileLink.classList.add('hidden');
      logoutButton.classList.add('hidden');
      registerLink.classList.remove('hidden');
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

    const handleSaveEditedData = React.useCallback(async (updatedDataFromModal, targetDocRef, originalDataPath, isNewEntryFlag, isTargetUserAdminFromModal, isTargetUserHallFromModal) => {
        if (!targetDocRef) {
            console.error("Chyba: Chýba odkaz na dokument pre uloženie.");
            setUserNotificationMessage("Chyba: Chýba odkaz na dokument pre uloženie. Zmeny neboli uložené.", 'error');
            return;
        }
    
        try {
            window.showGlobalLoader();
    
            // ------------------------------------------------------------------
            // 1. PRÍPAD: ÚPRAVA POUŽÍVATEĽA (hlavný profil) - KLUB
            // ------------------------------------------------------------------
            if (originalDataPath === '') {
                const docSnapshot = await getDoc(targetDocRef);
                if (!docSnapshot.exists()) {
                    throw new Error("Dokument používateľa sa nenašiel pre aktualizáciu.");
                }
                const currentDocData = docSnapshot.data();
            
                const userPrivateDocRef = doc(db, 'usersprivate', targetDocRef.id);
            
                // Polia, ktoré patria výhradne do usersprivate
                const privateFields = ['street', 'houseNumber', 'city', 'postalCode', 'country', 'birthDate', 'dateOfBirth'];
            
                // 1a) Pripravíme dáta pre users (odstránime súkromné polia)
                let finalDataToSave = { ...currentDocData };
                delete finalDataToSave._privateData;
                privateFields.forEach(field => delete finalDataToSave[field]);
                if (finalDataToSave.billing) {
                    delete finalDataToSave.billing.address;
                }
            
                // Vyčistíme existujúce tímy (ak nejaké sú)
                if (finalDataToSave.teams) {
                    finalDataToSave.teams = removeSensitiveFieldsFromTeams(finalDataToSave.teams);
                }
            
                // Prepíšeme ostatné polia z formulára (okrem súkromných a _privateData)
                for (const key in updatedDataFromModal) {
                    if (privateFields.includes(key) || key === '_privateData') continue;
                    const value = updatedDataFromModal[key];
                    if (value === undefined) continue;
            
                    if (key === 'billing') {
                        finalDataToSave[key] = {
                            clubName: value.clubName || currentDocData.billing?.clubName || '',
                            ico: value.ico || currentDocData.billing?.ico || '',
                            dic: value.dic || currentDocData.billing?.dic || '',
                            icDph: value.icDph || currentDocData.billing?.icDph || ''
                        };
                    } else if (key === 'volunteerRoles' || key === 'selectedDates' || key === 'tshirtSize' || key === 'gender' || key === 'note') {
                        finalDataToSave[key] = value;
                    } else if (key === 'teams') {
                        if (value) {
                            finalDataToSave[key] = removeSensitiveFieldsFromTeams(value);
                        }
                    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                        if (key !== 'address' && key !== 'billing') {
                            finalDataToSave[key] = { ...(currentDocData[key] || {}), ...value };
                        }
                    } else {
                        finalDataToSave[key] = value;
                    }
                }
            
                // Znova vyčistíme tímy pre istotu
                if (finalDataToSave.teams) {
                    finalDataToSave.teams = removeSensitiveFieldsFromTeams(finalDataToSave.teams);
                }
            
                // 1b) Pripravíme dáta pre usersprivate
                let privateData = {};
                try {
                    const privateDocSnapshot = await getDoc(userPrivateDocRef);
                    if (privateDocSnapshot.exists()) {
                        privateData = privateDocSnapshot.data();
                    }
                } catch (e) { /* dokument zatiaľ neexistuje */ }
            
                if (!privateData || typeof privateData !== 'object') privateData = {};
            
                // Adresa klubu
                privateData.address = {
                    street: updatedDataFromModal.street || currentDocData.street || '',
                    houseNumber: updatedDataFromModal.houseNumber || currentDocData.houseNumber || '',
                    city: updatedDataFromModal.city || currentDocData.city || '',
                    postalCode: updatedDataFromModal.postalCode || currentDocData.postalCode || '',
                    country: updatedDataFromModal.country || currentDocData.country || ''
                };
            
                if (updatedDataFromModal.birthDate) {
                    privateData.birthDate = updatedDataFromModal.birthDate;
                }
            
                // Fakturačná adresa
                privateData.billingAddress = {
                    street: updatedDataFromModal.street || currentDocData.street || '',
                    houseNumber: updatedDataFromModal.houseNumber || currentDocData.houseNumber || '',
                    city: updatedDataFromModal.city || currentDocData.city || '',
                    postalCode: updatedDataFromModal.postalCode || currentDocData.postalCode || '',
                    country: updatedDataFromModal.country || currentDocData.country || ''
                };
            
                // Uložíme do usersprivate (merge)
                await setDoc(userPrivateDocRef, privateData, { merge: true });
            
                // ============================================================
                // NOTIFIKÁCIE S NÁZVOM KLUBU - OPRAVENÉ
                // ============================================================
                // Získame názov klubu z pôvodných aj nových dát
                const originalClubName = currentDocData.billing?.clubName || 'Neznámy klub';
                const updatedClubName = finalDataToSave.billing?.clubName || 'Neznámy klub';
                
                // Vygenerujeme zmeny
                const baseChanges = getChangesForNotification(
                    currentDocData,
                    finalDataToSave,
                    formatDateToDMMYYYY
                );
                
                // Pridáme názov klubu ku každej zmene
                const changesWithClubName = baseChanges.map(change => {
                    // Ak ide o zmenu názvu klubu, špeciálne spracovanie
                    if (change.includes('Zmena Názov klubu')) {
                        return `Zmena názvu klubu: z '${originalClubName}' na '${updatedClubName}'`;
                    }
                    return `Klub ${updatedClubName}: ${change}`;
                });
                
                // Ak neexistujú žiadne zmeny okrem názvu klubu, ale názov klubu sa zmenil
                if (baseChanges.length === 0 && originalClubName !== updatedClubName) {
                    changesWithClubName.push(`Zmena názvu klubu: z '${originalClubName}' na '${updatedClubName}'`);
                }
                
                if (changesWithClubName.length > 0) {
                    const userEmail = window.auth.currentUser?.email;
                    if (userEmail) {
                        const notificationsCollectionRef = collection(db, 'notifications');
                        await addDoc(notificationsCollectionRef, {
                            userEmail,
                            changes: changesWithClubName,
                            timestamp: serverTimestamp()
                        });
                    }
                }
            
                // Uložíme do users
                await updateDoc(targetDocRef, finalDataToSave);
            
                setUserNotificationMessage("Zmeny boli uložené.", 'success');
                closeEditModal();
                return;
            }
    
            // ------------------------------------------------------------------
            // 2. PRÍPAD: ÚPRAVA / PRIDANIE TÍMU
            // ------------------------------------------------------------------
            if (editModalTitle.includes('Upraviť tím') || editModalTitle.includes('Pridať nový tím')) {
                const docSnapshot = await getDoc(targetDocRef);
                if (!docSnapshot.exists()) {
                    throw new Error("Dokument používateľa sa nenašiel pre aktualizáciu tímu.");
                }
                const currentDocData = docSnapshot.data();
    
                delete updatedDataFromModal._privateData;
    
                let actualCategory = updatedDataFromModal._category || updatedDataFromModal.category;
                if (!actualCategory) {
                    throw new Error("Pre pridanie/úpravu tímu nebola zadaná kategória.");
                }
                const currentCategoryTeams = Array.isArray(currentDocData.teams?.[actualCategory]) ? currentDocData.teams[actualCategory] : [];
    
                let oldCategory = null;
                let oldTeamIndex = -1;
                const pathPartsFromOriginal = originalDataPath.split('.');
                if (pathPartsFromOriginal.length > 1) {
                    const categoryAndIndexPart = pathPartsFromOriginal[1];
                    const categoryMatch = categoryAndIndexPart.match(/^(.*?)\[(\d+)\]$/);
                    if (categoryMatch) {
                        oldCategory = categoryMatch[1];
                        oldTeamIndex = parseInt(categoryMatch[2]);
                    }
                }
    
                delete updatedDataFromModal.dateOfBirth;
                delete updatedDataFromModal.address;
                delete updatedDataFromModal._dateOfBirth;
                delete updatedDataFromModal._address;
    
                ['playerDetails', 'menTeamMemberDetails', 'womenTeamMemberDetails', 'driverDetailsMale', 'driverDetailsFemale'].forEach(arrName => {
                    if (Array.isArray(updatedDataFromModal[arrName])) {
                        updatedDataFromModal[arrName] = updatedDataFromModal[arrName].map(member => {
                            const { dateOfBirth, address, _dateOfBirth, _address, ...rest } = member;
                            return rest;
                        });
                    }
                });
    
                const isNewTeam = isNewEntryFlag && editModalTitle.includes('Pridať nový tím');
    
                const createCleanTeam = (data) => {
                    const cleanTeam = {};
                    const allowedTeamFields = [
                        'teamName', 'category', '_category', 'arrival', 'accommodation',
                        'packageDetails', 'packageId', 'tshirts', 'jerseyHomeColor', 'jerseyAwayColor',
                        'players', 'menTeamMembers', 'womenTeamMembers', 'menTeamMembersCount',
                        'womenTeamMembersCount', 'playersCount', 'registeredBy', 'clubName'
                    ];
                    allowedTeamFields.forEach(field => {
                        if (data[field] !== undefined) cleanTeam[field] = data[field];
                    });
    
                    const memberArrays = [
                        'playerDetails', 'menTeamMemberDetails', 'womenTeamMemberDetails',
                        'driverDetailsMale', 'driverDetailsFemale'
                    ];
                    memberArrays.forEach(arrName => {
                        if (data[arrName] && Array.isArray(data[arrName])) {
                            cleanTeam[arrName] = data[arrName].map(member => {
                                const cleanMember = {};
                                const allowedMemberFields = [
                                    'firstName', 'lastName', 'jerseyNumber', 'registrationNumber',
                                    'isRegistered', 'type', 'originalArray', 'originalIndex'
                                ];
                                allowedMemberFields.forEach(field => {
                                    if (member[field] !== undefined) cleanMember[field] = member[field];
                                });
                                return cleanMember;
                            });
                        } else {
                            cleanTeam[arrName] = [];
                        }
                    });
                    return cleanTeam;
                };
    
                // 2a) Pridanie nového tímu
                if (isNewTeam) {
                    const cleanTeam = createCleanTeam(updatedDataFromModal);
                    cleanTeam.registeredBy = `${currentDocData.firstName || ''} ${currentDocData.lastName || ''}`.trim();
                    cleanTeam.accommodation = updatedDataFromModal.accommodation || { type: '' };
    
                    const newCategoryTeams = [...currentCategoryTeams];
                    newCategoryTeams.push(cleanTeam);
    
                    const cleanedCategoryTeams = removeSensitiveFieldsFromTeams(newCategoryTeams);
    
                    const updates = {};
                    updates[`teams.${actualCategory}`] = cleanedCategoryTeams;
                    updates['_privateData'] = deleteField();
                    await updateDoc(targetDocRef, updates);
    
                    setUserNotificationMessage("Nový tím bol pridaný.", 'success');
                    closeEditModal();
                    return;
                }
    
                // 2b) Úprava existujúceho tímu
                if (!oldCategory || oldTeamIndex < 0) {
                    throw new Error("Neplatná pôvodná cesta pre úpravu existujúceho tímu.");
                }
    
                const existingTeam = currentCategoryTeams[oldTeamIndex] || {};
                const cleanTeam = createCleanTeam(updatedDataFromModal);
    
                const preservedFields = ['packageId', 'players', 'menTeamMembers', 'womenTeamMembers'];
                preservedFields.forEach(field => {
                    if (existingTeam[field] !== undefined && cleanTeam[field] === undefined) {
                        cleanTeam[field] = existingTeam[field];
                    }
                });
    
                if (!cleanTeam.accommodation) {
                    cleanTeam.accommodation = { type: '' };
                }
    
                const newCategoryTeams = [...currentCategoryTeams];
                newCategoryTeams[oldTeamIndex] = cleanTeam;
    
                const cleanedCategoryTeams = removeSensitiveFieldsFromTeams(newCategoryTeams);
    
                const updates = {};
                updates[`teams.${oldCategory}`] = cleanedCategoryTeams;
                updates['_privateData'] = deleteField();
                await updateDoc(targetDocRef, updates);
    
                setUserNotificationMessage("Zmeny tímu boli uložené.", 'success');
                closeEditModal();
                return;
            }
    
            // ------------------------------------------------------------------
            // 3. PRÍPAD: ÚPRAVA / PRIDANIE ČLENA TÍMU
            // ------------------------------------------------------------------
            if (originalDataPath.includes('playerDetails') ||
                originalDataPath.includes('menTeamMemberDetails') ||
                originalDataPath.includes('womenTeamMemberDetails') ||
                originalDataPath.includes('driverDetailsMale') ||
                originalDataPath.includes('driverDetailsFemale')) {
    
                delete updatedDataFromModal._privateData;
    
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
    
                const docSnapshot = await getDoc(targetDocRef);
                if (!docSnapshot.exists()) {
                    throw new Error("Dokument používateľa sa nenašiel.");
                }
                const currentDocData = docSnapshot.data();
                const teamsInCategory = currentDocData.teams?.[category] || [];
                if (teamIndex < 0 || teamIndex >= teamsInCategory.length) {
                    throw new Error(`Tím s indexom ${teamIndex} v kategórii ${category} neexistuje.`);
                }
    
                const existingTeam = JSON.parse(JSON.stringify(teamsInCategory[teamIndex] || {}));
                const teamToUpdate = cleanTeamForUsers(existingTeam);
    
                let currentMemberArray = [...(teamToUpdate[memberArrayPath] || [])];
    
                const userPrivateDocRef = doc(db, 'usersprivate', targetDocRef.id);
                let privateData = {};
                try {
                    const privateDocSnapshot = await getDoc(userPrivateDocRef);
                    if (privateDocSnapshot.exists()) {
                        privateData = privateDocSnapshot.data();
                    }
                } catch (e) { /* dokument neexistuje */ }
    
                if (!privateData || typeof privateData !== 'object') privateData = {};
                if (!privateData.persons) privateData.persons = {};
    
                const teamKey = `${category}_team${teamIndex + 1}`;
                if (!privateData.persons[teamKey]) privateData.persons[teamKey] = {};
    
                // ----- 3a) Pridanie nového člena -----
                if (isReallyNew) {
                    const cleanNewMember = {
                        firstName: updatedDataFromModal.firstName || '',
                        lastName: updatedDataFromModal.lastName || '',
                        jerseyNumber: updatedDataFromModal.jerseyNumber || '',
                        registrationNumber: updatedDataFromModal.registrationNumber || '',
                        isRegistered: updatedDataFromModal.isRegistered || false
                    };
                    if (memberArrayPath === 'playerDetails') {
                        cleanNewMember.jerseyNumber = updatedDataFromModal.jerseyNumber || '';
                        cleanNewMember.registrationNumber = updatedDataFromModal.registrationNumber || '';
                    }
    
                    currentMemberArray.push(cleanNewMember);
    
                    const memberIndexInPrivate = currentMemberArray.length - 1;
    
                    let privateArrayName = memberArrayPath;
                    if (memberArrayPath === 'playerDetails') privateArrayName = 'players';
                    else if (memberArrayPath === 'womenTeamMemberDetails') privateArrayName = 'womenTeamMembers';
                    else if (memberArrayPath === 'menTeamMemberDetails') privateArrayName = 'menTeamMembers';
                    else if (memberArrayPath === 'driverDetailsMale') privateArrayName = 'driversMale';
                    else if (memberArrayPath === 'driverDetailsFemale') privateArrayName = 'driversFemale';
    
                    if (!privateData.persons[teamKey][privateArrayName]) {
                        privateData.persons[teamKey][privateArrayName] = [];
                    }
    
                    privateData.persons[teamKey][privateArrayName][memberIndexInPrivate] = {
                        dateOfBirth: updatedDataFromModal.dateOfBirth || '',
                        address: updatedDataFromModal.address || {
                            street: '',
                            houseNumber: '',
                            city: '',
                            postalCode: '',
                            country: ''
                        }
                    };
    
                    // ============================================================
                    // NOTIFIKÁCIE PRE NOVÉHO ČLENA TÍMU
                    // ============================================================
                    const teamName = teamToUpdate.teamName || 'Bez názvu';
                    const memberName = `${cleanNewMember.firstName || ''} ${cleanNewMember.lastName || ''}`.trim() || 'bez mena';
    
                    let memberType = 'Člen tímu';
                    if (memberArrayPath === 'playerDetails') memberType = 'Hráč';
                    else if (memberArrayPath === 'womenTeamMemberDetails') memberType = 'Člen RT – žena';
                    else if (memberArrayPath === 'menTeamMemberDetails') memberType = 'Člen RT – muž';
                    else if (memberArrayPath === 'driverDetailsFemale') memberType = 'Šofér – žena';
                    else if (memberArrayPath === 'driverDetailsMale') memberType = 'Šofér – muž';
    
                    const notificationMessage = `Nový ${memberType} pridaný: ${memberName} (${category}, tím: ${teamName})`;
    
                    const userEmail = window.auth.currentUser?.email;
                    if (userEmail) {
                        const notificationsCollectionRef = collection(db, 'notifications');
                        await addDoc(notificationsCollectionRef, {
                            userEmail,
                            changes: [notificationMessage],
                            timestamp: serverTimestamp()
                        });
                    }
    
                } else {
                    // ----- 3b) Úprava existujúceho člena -----
                    if (memberArrayIndex < 0 || memberArrayIndex >= currentMemberArray.length) {
                        throw new Error(`Člen na indexe ${memberArrayIndex} neexistuje v poli ${memberArrayPath}`);
                    }
                    
                    const existingMember = currentMemberArray[memberArrayIndex];
                    // Uložíme si pôvodné dáta pre porovnanie
                    const originalMemberFromDoc = JSON.parse(JSON.stringify(teamsInCategory[teamIndex][memberArrayPath]?.[memberArrayIndex] || {}));
                    
                    // Aktualizujeme polia v existingMember
                    if (updatedDataFromModal.firstName !== undefined) {
                        existingMember.firstName = updatedDataFromModal.firstName;
                    }
                    if (updatedDataFromModal.lastName !== undefined) {
                        existingMember.lastName = updatedDataFromModal.lastName;
                    }
                    if (updatedDataFromModal.jerseyNumber !== undefined) {
                        existingMember.jerseyNumber = updatedDataFromModal.jerseyNumber;
                    }
                    if (updatedDataFromModal.registrationNumber !== undefined) {
                        existingMember.registrationNumber = updatedDataFromModal.registrationNumber;
                    }
                    if (updatedDataFromModal.isRegistered !== undefined) {
                        existingMember.isRegistered = updatedDataFromModal.isRegistered;
                    }
                    
                    // Aktualizujeme private dáta
                    let privateArrayName = memberArrayPath;
                    if (memberArrayPath === 'playerDetails') privateArrayName = 'players';
                    else if (memberArrayPath === 'womenTeamMemberDetails') privateArrayName = 'womenTeamMembers';
                    else if (memberArrayPath === 'menTeamMemberDetails') privateArrayName = 'menTeamMembers';
                    else if (memberArrayPath === 'driverDetailsMale') privateArrayName = 'driversMale';
                    else if (memberArrayPath === 'driverDetailsFemale') privateArrayName = 'driversFemale';
                    
                    if (!privateData.persons[teamKey][privateArrayName]) {
                        privateData.persons[teamKey][privateArrayName] = [];
                    }
                    
                    const existingPrivateMember = privateData.persons[teamKey][privateArrayName][memberArrayIndex] || {};
                    
                    if (updatedDataFromModal.dateOfBirth !== undefined) {
                        privateData.persons[teamKey][privateArrayName][memberArrayIndex] = {
                            ...existingPrivateMember,
                            dateOfBirth: updatedDataFromModal.dateOfBirth
                        };
                    }
                    if (updatedDataFromModal.address !== undefined) {
                        privateData.persons[teamKey][privateArrayName][memberArrayIndex] = {
                            ...existingPrivateMember,
                            address: updatedDataFromModal.address
                        };
                    }
                    
                    // ============================================================
                    // NOTIFIKÁCIE PRE ÚPRAVU ČLENA TÍMU - OPRAVENÉ
                    // ============================================================
                    const teamName = teamToUpdate.teamName || 'Bez názvu';
                    const memberName = `${existingMember.firstName || ''} ${existingMember.lastName || ''}`.trim() || 'bez mena';
                    
                    // Použijeme pôvodné dáta z dokumentu a nové dáta z formulára
                    const memberChanges = getMemberChangesForNotification(
                        originalMemberFromDoc,  // Pôvodné dáta z dokumentu
                        updatedDataFromModal,   // Nové dáta z formulára
                        memberName,
                        teamName,
                        category
                    );
                    
                    if (memberChanges.length > 0) {
                        const userEmail = window.auth.currentUser?.email;
                        if (userEmail) {
                            const notificationsCollectionRef = collection(db, 'notifications');
                            await addDoc(notificationsCollectionRef, {
                                userEmail,
                                changes: memberChanges,
                                timestamp: serverTimestamp()
                            });
                        }
                    }
                }
    
                // ----- Uloženie do users a usersprivate -----
                teamToUpdate[memberArrayPath] = currentMemberArray;
                const finalUpdatedTeam = recalculateTeamCounts(teamToUpdate);
    
                const updatedTeamsForCategory = [...teamsInCategory];
                updatedTeamsForCategory[teamIndex] = finalUpdatedTeam;
    
                const cleanedTeamsForCategory = removeSensitiveFieldsFromTeams(updatedTeamsForCategory);
    
                const updates = {};
                updates[`teams.${category}`] = cleanedTeamsForCategory;
                updates['_privateData'] = deleteField();
                await updateDoc(targetDocRef, updates);
    
                await setDoc(userPrivateDocRef, privateData, { merge: true });
    
                setUserNotificationMessage("Zmeny boli uložené.", 'success');
                closeEditModal();
                return;
            }
    
            // ------------------------------------------------------------------
            // 4. PRÍPAD: VŠEOBECNÁ VNORENÁ AKTUALIZÁCIA
            // ------------------------------------------------------------------
            if (!originalDataPath) {
                throw new Error("Cesta na uloženie dát (originalDataPath) je prázdna pre všeobecnú vnorenú aktualizáciu.");
            }
            const docSnapshotForUpdate = await getDoc(targetDocRef);
            if (!docSnapshotForUpdate.exists()) {
                throw new Error("Dokument sa nenašiel pre aktualizáciu.");
            }
            const docDataForUpdate = docSnapshotForUpdate.data();
    
            const { updatedObject, topLevelField } = updateNestedObjectByPath(docDataForUpdate, originalDataPath, updatedDataFromModal);
    
            const updates = {};
            updates[topLevelField] = updatedObject[topLevelField];
            updates['_privateData'] = deleteField();
            await updateDoc(targetDocRef, updates);
    
            setUserNotificationMessage("Zmeny boli uložené.", 'success');
            closeEditModal();
    
        } catch (e) {
            console.error("Chyba pri ukladaní dát do Firestore:", e);
            setError(`Chyba pri ukladaní dát: ${e.message}`);
            setUserNotificationMessage(`Chyba pri ukladaní dát: ${e.message}`, 'error');
        } finally {
            window.hideGlobalLoader();
        }
    }, [db, closeEditModal, setUserNotificationMessage, setError, editModalTitle]);

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
    
            const docSnapshot = await getDoc(targetDocRef);
            if (!docSnapshot.exists()) {
                throw new Error("Dokument používateľa sa nenašiel.");
            }
            const currentDocData = docSnapshot.data();
            const teamsInCategory = currentDocData.teams?.[category] || [];
    
            if (teamIndex < 0 || teamIndex >= teamsInCategory.length) {
                throw new Error(`Tím s indexom ${teamIndex} v kategórii ${category} neexistuje.`);
            }
    
            const teamToUpdate = JSON.parse(JSON.stringify(teamsInCategory[teamIndex]));
            let currentMemberArray = [...(teamToUpdate[memberArrayPath] || [])];
    
            if (memberArrayIndex < 0 || memberArrayIndex >= currentMemberArray.length) {
                throw new Error(`Člen na indexe ${memberArrayIndex} neexistuje v poli ${memberArrayPath}`);
            }
    
            const memberToRemove = currentMemberArray[memberArrayIndex];
            const memberName = `${memberToRemove.firstName || ''} ${memberToRemove.lastName || ''}`.trim() || 'bez mena';
    
            // Odstránime z poľa
            currentMemberArray.splice(memberArrayIndex, 1);
            teamToUpdate[memberArrayPath] = currentMemberArray;
    
            const finalUpdatedTeam = recalculateTeamCounts(teamToUpdate);
            const cleanedTeam = cleanTeamForUsers(finalUpdatedTeam);
    
            const updatedTeamsForCategory = [...teamsInCategory];
            updatedTeamsForCategory[teamIndex] = cleanedTeam;
    
            const updates = {};
            updates[`teams.${category}`] = updatedTeamsForCategory;

            updates['_privateData'] = deleteField();
    
            // Uložíme do users (vyčistené)
            await updateDoc(targetDocRef, updates);
    
            // Odstránime aj z usersprivate
            const userPrivateDocRef = doc(db, 'usersprivate', targetDocRef.id);
            let privateData = {};
            try {
                const privateDocSnapshot = await getDoc(userPrivateDocRef);
                if (privateDocSnapshot.exists()) {
                    privateData = privateDocSnapshot.data();
                }
            } catch (e) { /* dokument neexistuje */ }
    
            if (privateData.persons) {
                const teamKey = `${category}_team${teamIndex + 1}`;
                if (privateData.persons[teamKey]) {
                    // Zistíme názov poľa v private
                    let privateArrayName;
                    if (memberArrayPath === 'playerDetails') privateArrayName = 'players';
                    else if (memberArrayPath === 'womenTeamMemberDetails') privateArrayName = 'womenTeamMembers';
                    else if (memberArrayPath === 'menTeamMemberDetails') privateArrayName = 'menTeamMembers';
                    else if (memberArrayPath === 'driverDetailsMale') privateArrayName = 'driversMale';
                    else if (memberArrayPath === 'driverDetailsFemale') privateArrayName = 'driversFemale';
                    else privateArrayName = null;
    
                    if (privateArrayName && privateData.persons[teamKey][privateArrayName]) {
                        privateData.persons[teamKey][privateArrayName].splice(memberArrayIndex, 1);
                        if (privateData.persons[teamKey][privateArrayName].length === 0) {
                            delete privateData.persons[teamKey][privateArrayName];
                        }
                    }
                    if (Object.keys(privateData.persons[teamKey]).length === 0) {
                        delete privateData.persons[teamKey];
                    }
                    if (Object.keys(privateData.persons).length === 0) {
                        delete privateData.persons;
                    }
                    await setDoc(userPrivateDocRef, privateData, { merge: true });
                }
            }
    
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
    
    const handleDeleteTeam = React.useCallback(async (targetDocRef, originalDataPath) => {
        if (!targetDocRef || !originalDataPath) {
            console.error("Chyba: Chýba odkaz na dokument alebo cesta pre odstránenie tímu.");
            setUserNotificationMessage("Chyba: Chýba odkaz na dokument alebo cesta pre odstránenie tímu.", 'error');
            return;
        }
    
        try {
            window.showGlobalLoader();
    
            const pathParts = originalDataPath.split('.');
            if (pathParts.length !== 2) {
                throw new Error(`Neplatný formát cesty tímu pre odstránenie. Očakáva sa 2 segmenty (teams.category[index]), našlo sa ${pathParts.length}.`);
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
            if (teamIndex < 0 || teamIndex >= teamsInCategory.length) {
                throw new Error(`Tím na odstránenie sa nenašiel na ceste: ${originalDataPath}.`);
            }
    
            const teamToRemove = teamsInCategory[teamIndex];
            const teamName = teamToRemove.teamName || 'Bez názvu';
    
            // Odstránime tím z users
            const updatedTeamsInCategory = [...teamsInCategory];
            updatedTeamsInCategory.splice(teamIndex, 1);
    
            const updates = {};
            if (updatedTeamsInCategory.length === 0) {
                updates[`teams.${category}`] = deleteField();
            } else {
                updates[`teams.${category}`] = updatedTeamsInCategory;
            }

            updates['_privateData'] = deleteField();

            await updateDoc(targetDocRef, updates);
    
            // Odstránime aj príslušné osobné údaje z usersprivate
            const userPrivateDocRef = doc(db, 'usersprivate', targetDocRef.id);
            let privateData = {};
            try {
                const privateDocSnapshot = await getDoc(userPrivateDocRef);
                if (privateDocSnapshot.exists()) {
                    privateData = privateDocSnapshot.data();
                }
            } catch (e) { /* dokument neexistuje */ }
    
            if (privateData.persons) {
                const teamKey = `${category}_team${teamIndex + 1}`;
                delete privateData.persons[teamKey];
                if (Object.keys(privateData.persons).length === 0) {
                    delete privateData.persons;
                }
                await setDoc(userPrivateDocRef, privateData, { merge: true });
            }
    
            // Notifikácia
            const userEmail = window.auth.currentUser?.email;
            if (userEmail) {
                const notificationsCollectionRef = collection(db, 'notifications');
                await addDoc(notificationsCollectionRef, {
                    userEmail,
                    changes: [`Tím ${teamName} bol odstránený z kategórie '${category}'.`],
                    timestamp: serverTimestamp()
                });
            }
    
            setUserNotificationMessage(`Tím ${teamName} bol odstránený.`, 'success');
            closeEditModal();
    
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
        case 'club': return 'Klub';
        case 'hall': return 'Hala';
        case 'admin': return 'Administrátor';
        case 'volunteer': return 'Dobrovoľník';
        case 'referee': return 'Rozhodca';
        default: return value;
      }
    }
  
    // Dátum registrácie
    if (columnId === 'registrationDate') {
      let date;
      if (value && typeof value.toDate === 'function') {
        date = value.toDate();
      } else if (value && typeof value === 'object' && value.seconds !== undefined && value.nanoseconds !== undefined) {
        date = new Date(value.seconds * 1000 + value.nanoseconds / 1000000);
      } else {
        return '-';
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
        return '[Chyba Dátumu]';
      }
    }
  
    // Schválený
    if (columnId === 'approved') {
      return value ? 'Áno' : 'Nie';
    }
  
    // PSČ - formátovanie s medzerou
    if (columnId === 'postalCode') {
      return formatPostalCodeForDisplay(value);
    }
  
    // Telefónne číslo
    if (columnId === 'contactPhoneNumber') {
      const { dialCode, numberWithoutDialCode } = parsePhoneNumber(value, countryDialCodes);
      const formattedNumber = formatNumberGroups(numberWithoutDialCode);
      return `${dialCode} ${formattedNumber}`;
    }
  
    // Adresové polia - načítame výhradne z _privateData
    if (['street', 'houseNumber', 'city', 'country'].includes(columnId)) {
        const privateAddress = userObject._privateData?.address;
        if (privateAddress) {
            const mapping = {
                'street': 'street',
                'houseNumber': 'houseNumber',
                'city': 'city',
                'country': 'country'
            };
            const privateValue = privateAddress[mapping[columnId]];
            if (privateValue) return privateValue;
        }
        // Ak v _privateData chýba, vrátime pomlčku (žiaden fallback na user[columnId])
        return '-';
    }
  
    // Poznámka
    if (columnId === 'note') {
      return value || '-';
    }
  
    // Typ dopravy
    if (columnId === 'arrival.type') {
      const arrivalType = getNestedValue(userObject, 'arrival.type');
      const arrivalTime = getNestedValue(userObject, 'arrival.time');
      return formatArrivalTime(arrivalType, arrivalTime);
    }
  
    // Dobrovoľnícke polia
    if (columnId === 'tshirtSize') {
      return value || '-';
    }
    if (columnId === 'selectedDates') {
      if (!value || !Array.isArray(value)) return '-';
      return value
        .map(dateStr => {
          const [year, month, day] = dateStr.split('-');
          return `${day}. ${month}. ${year}`;
        })
        .join(', ');
    }
    if (columnId === 'volunteerRoles') {
      if (!value || !Array.isArray(value)) return '-';
      return value.join(', ');
    }
  
    // Všeobecné formátovanie
    if (typeof value === 'boolean') return value ? 'Áno' : 'Nie';
    if (Array.isArray(value)) {
      return value.map(item => {
        if (typeof item === 'object' && item !== null) {
          if (item.firstName && item.lastName) return `${item.firstName} ${item.lastName}`;
          if (item.size) return item.size;
          return '[Objekt]';
        }
        return String(item);
      }).join(', ');
    }
    if (typeof value === 'object') {
      if (value.street || value.city) {
        return `${value.street || ''} ${value.houseNumber || ''}, ${value.postalCode || ''} ${value.city || ''}, ${value.country || ''}`;
      }
      if (value.name || value.type) {
        return value.name || value.type;
      }
      try {
        return JSON.stringify(value);
      } catch (e) {
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
        uniqueColumnValues: uniqueColumnValues,
        allUsers: allUsers
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
                                React.createElement('th', { className: 'py-2 px-3 text-center whitespace-nowrap min-w-max' }, 'Farba dresov 1'),
                                React.createElement('th', { className: 'py-2 px-3 text-center whitespace-nowrap min-w-max' }, 'Farba dresov 2'),
                                React.createElement('th', { className: 'py-2 px-2 text-left whitespace-nowrap min-w-max' }, 'Doprava'),
                                React.createElement('th', { className: 'py-2 px-2 text-left whitespace-nowrap min-w-max' }, 'Ubytovanie'),
                                React.createElement('th', { className: 'py-2 px-2 text-left whitespace-nowrap min-w-max' }, 'Ubytovňa'),
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
                                                }, '✏️')
                                            ),
                                            React.createElement('td', { className: 'py-3 px-2 text-center whitespace-nowrap min-w-max' }, team._category || '-'),
                                            React.createElement('td', { className: 'py-3 px-2 text-left whitespace-nowrap min-w-max' }, team.teamName || `Tím`),
                                            React.createElement('td', { className: 'py-3 px-2 text-center whitespace-nowrap min-w-max' }, team._players),
                                            React.createElement('td', { className: 'py-3 px-2 text-center whitespace-nowrap min-w-max' }, team._womenTeamMembersCount),
                                            React.createElement('td', { className: 'py-3 px-2 text-center whitespace-nowrap min-w-max' }, team._menTeamMembersCount),
                                            React.createElement('td', { className: 'py-3 px-2 text-center whitespace-nowrap min-w-max' }, team._womenDriversCount),
                                            React.createElement('td', { className: 'py-3 px-2 text-center whitespace-nowrap min-w-max' }, team._menDriversCount),
                                            React.createElement('td', { className: 'py-3 px-2 text-center whitespace-nowrap min-w-max' }, team._players + team._womenTeamMembersCount + team._menTeamMembersCount + team._womenDriversCount + team._menDriversCount || '-'),
                                            React.createElement('td', { className: 'py-3 px-3 text-center whitespace-nowrap min-w-max text-sm' }, team.jerseyHomeColor || '-'),
                                            React.createElement('td', { className: 'py-3 px-3 text-center whitespace-nowrap min-w-max text-sm' }, team.jerseyAwayColor || '-'),
                                            React.createElement('td', { className: 'py-3 px-2 text-left whitespace-nowrap min-w-max' }, formatArrivalTime(team.arrival?.type, team.arrival?.time)),
                                            React.createElement('td', { className: 'py-3 px-2 text-left whitespace-nowrap min-w-max' }, team.accommodation?.type || '-'),
                                            React.createElement('td', { className: 'py-3 px-2 text-left whitespace-nowrap min-w-max' }, team.accommodation?.name || '-'),
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
                                                    onAddMember: handleOpenAddMemberTypeModal,
                                                    allTeamsData: allTeamsFlattened
                                                })
                                            )
                                        )
                                    );
                                }),
                                (allTeamsFlattened.length > 0 && !showUsers && showTeams) && (() => {
                                    // Vypočítať počet tímov na kategóriu
                                    const categoryCounts = new Map();
                                    allTeamsFlattened.forEach(team => {
                                        const category = team._category || 'Bez kategórie';
                                        categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
                                    });
                                    
                                    // Zoradiť kategórie abecedne
                                    const sortedCategories = Array.from(categoryCounts.keys()).sort();
                                    
                                    // Hlavný riadok súhrnu
                                    const summaryRows = [];
                                    
                                    // Pridať hlavný riadok s nadpisom Súhrn
                                    summaryRows.push(
                                        React.createElement(
                                            'tr',
                                            { key: 'summary-header', className: 'bg-gray-100 font-bold text-gray-700 uppercase' },
                                            React.createElement('td', { className: 'py-3 px-2 text-left', colSpan: 3 }, 'Súhrn:'),
                                            React.createElement('td', { className: 'py-3 px-2 text-center cursor-default', title: 'Celkový počet hráčov' }, teamSummary.totalPlayers),
                                            React.createElement('td', { className: 'py-3 px-2 text-center cursor-default', title: 'Celkový počet členov realizačného tímu – ženy' }, teamSummary.totalWomenTeamMembers),
                                            React.createElement('td', { className: 'py-3 px-2 text-center cursor-default', title: 'Celkový počet členov realizačného tímu – muži' }, teamSummary.totalMenTeamMembers),
                                            React.createElement('td', { className: 'py-3 px-2 text-center cursor-default', title: 'Celkový počet šoférov – ženy' }, teamSummary.totalWomenDrivers),
                                            React.createElement('td', { className: 'py-3 px-2 text-center cursor-default', title: 'Celkový počet šoférov – muži' }, teamSummary.totalMenDrivers),
                                            React.createElement('td', { className: 'py-3 px-2 text-center cursor-default', title: 'Celkový počet osôb (hráči + realizačný tím + šoféri)' },
                                                teamSummary.totalPlayers +
                                                teamSummary.totalWomenTeamMembers +
                                                teamSummary.totalMenTeamMembers +
                                                teamSummary.totalWomenDrivers +
                                                teamSummary.totalMenDrivers
                                            ),
                                            React.createElement('td', { className: 'py-3 px-2 text-right', colSpan: 6 }, 'Tričká:'),
                                            (availableTshirtSizes && availableTshirtSizes.length > 0 ? availableTshirtSizes : ['XXS','XS','S','M','L','XL','XXL','XXXL']).map(size =>
                                                React.createElement('td', {
                                                    key: `summary-tshirt-${size}`,
                                                    className: 'py-3 px-2 text-center cursor-default',
                                                    title: `Celkový počet tričiek veľkosti ${size}`
                                                }, teamSummary.totalTshirtQuantities.get(size) || 0)
                                            )
                                        )
                                    );
                                    
                                    // Pridať riadky pre každú kategóriu
                                    sortedCategories.forEach(category => {
                                        const teamCount = categoryCounts.get(category);
                                        summaryRows.push(
                                            React.createElement(
                                                'tr',
                                                { key: `summary-category-${category}`, className: 'bg-gray-50 text-gray-700' },
                                                React.createElement('td', { className: 'py-2 px-2 text-left', colSpan: 3 }, 
                                                    React.createElement('span', { className: 'font-medium' }, category)
                                                ),
                                                React.createElement('td', { className: 'py-2 px-2 text-center', colSpan: 1 }, `${teamCount} tímov`),
                                                React.createElement('td', { className: 'py-2 px-2 text-center', colSpan: 12 }, '')
                                            )
                                        );
                                    });
                                    
                                    return summaryRows;
                                })()
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
                                            }, '✏️')
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
                                                        onAddMember: handleOpenAddMemberTypeModal,
                                                        allTeamsData: allTeamsFlattened
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
