// logged-in-all-registrations.js
// Tento súbor predpokladá, že Firebase SDK je inicializovaný v <head> logged-in-all-registrations.html
// a GlobalNotificationHandler v header.js spravuje globálnu autentifikáciu a stav používateľa.

// Importy pre Firebase Firestore funkcie (Firebase v9 modulárna syntax)
import { collection, doc, onSnapshot, setDoc, updateDoc, getDoc, query, orderBy, getDocs, serverTimestamp, addDoc, runTransaction } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { countryDialCodes } from './countryDialCodes.js'; // Import zoznamu predvolieb

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

  // Nezobrazovať notifikáciu, ak nie je správa ALEBO ak ak sú notifikácie zakázané
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
                        onClose(); // Zatvoriť modálne okno po potvrdení
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
                    className: 'mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-white p-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500',
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
function DialCodeSelectionModal({ isOpen, onClose, onSelect, currentDialCode }) { // onSelectDialCode zmenené na onSelect
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
                            onSelect(country.dialCode); // onSelectDialCode zmenené na onSelect
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
    const pathParts = path.split('.');
    let current = obj;
    for (const part of pathParts) {
        if (current === undefined || current === null) {
            return undefined;
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
    return current;
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
    if (key === 'accommodation.type') return 'Typ ubytovania';
    if (key === 'arrival.type') return 'Typ dopravy';
    if (key === 'packageDetails.name') return 'Názov balíka';
    if (key === 'packageDetails.meals') return 'Stravovanie';
    if (key === 'teamName') return 'Názov tímu';
    if (key === 'playerDetails') return 'Detaily hráčov';
    if (key === 'menTeamMemberDetails') return 'Detaily členov R. tímu (muži)';
    if (key === 'womenTeamMemberDetails') return 'Detaily členov R. tímu (ženy)';
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
    if (key === '_category' || key === 'category') return 'Kategória tímu'; // Pre zobrazenie kategórie tímu
    if (key === 'jerseyNumber') return 'Číslo dresu';
    if (key === 'registrationNumber') return 'Číslo registrácie';
    if (key === 'gender') return 'Pohlavie';

    return label;
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
        titleParts.push(React.createElement('span', { className: 'text-gray-600 mr-2 whitespace-nowrap' }, `Doprava: ${team.arrival?.type || '-'}`));
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
        titleParts.push(React.createElement('span', { className: 'text-gray-600 hidden 3xl:inline mr-2 whitespace-nowrap' }, team.arrival?.type || '-'));
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

// TeamDetailsContent Component - zobrazuje len vnútorné detaily jedného tímu (bez vonkajšieho CollapsibleSection)
function TeamDetailsContent({ team, tshirtSizeOrder, showDetailsAsCollapsible, showUsersChecked, showTeamsChecked, openEditModal, db, setUserNotificationMessage, onAddMember }) {
    if (!team) {
        return React.createElement('div', { className: 'text-gray-600 p-4' }, 'Žiadne tímové registrácie.');
    }

    const formatAddress = (member) => { // Zmenený názov z 'address' na 'member' pre väčšiu prehľadnosť
        if (!member) return '-';

        let addressData = member;
        // Ak existuje vnorený objekt 'address', použiť ho
        if (member.address && typeof member.address === 'object') {
            addressData = member.address;
        }

        const street = addressData.street || '';
        const houseNumber = addressData.houseNumber || '';
        const postalCode = addressData.postalCode || '';
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
                type: 'Člen realizačného tímu (muži)',
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
                type: 'Člen realizačného tímu (ženy)',
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

    // Nová funkcia na spracovanie zmeny stravovania
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
                changes.push(`Zmena Stravovanie (${formatDateToDMMYYYY(date)}, ${mealTypeLabels[mealType]}): z '${originalMealValue}' na '${newMealValue}'`);
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

    if (!Array.isArray(dialCodes)) {
        console.warn("parsePhoneNumber: dialCodes nie je pole, použijem predvolenú hodnotu.");
        dialCodes = countryDialCodes; // Fallback to imported countryDialCodes
    }

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


// Helper function to get changes for notification
const getChangesForNotification = (original, updated, pathPrefix = '') => {
    const changes = [];
    const allKeys = new Set([...Object.keys(original || {}), ...Object.keys(updated || {})]);

    for (const key of allKeys) {
        // Skip internal keys, password, etc.
        if (key.startsWith('_') || ['id', 'uniqueId', 'type', 'originalArray', 'originalIndex', 'password'].includes(key)) {
            continue;
        }

        const currentFullPath = pathPrefix ? `${pathPrefix}.${key}` : key;
        const originalValue = getNestedValue(original, currentFullPath);
        const updatedValue = getNestedValue(updated, currentFullPath);

        const safeOriginalValue = originalValue === undefined ? null : originalValue;
        const safeUpdatedValue = updatedValue === undefined ? null : updatedValue;

        // Check if both are objects and not arrays or Timestamps (which are objects with toDate method)
        if (
            typeof safeOriginalValue === 'object' && safeOriginalValue !== null && !Array.isArray(safeOriginalValue) && typeof safeOriginalValue.toDate !== 'function' &&
            typeof safeUpdatedValue === 'object' && safeUpdatedValue !== null && !Array.isArray(safeUpdatedValue) && typeof safeUpdatedValue.toDate !== 'function'
        ) {
            // Recursively get changes for nested objects
            const nestedChanges = getChangesForNotification(safeOriginalValue, safeUpdatedValue, currentFullPath);
            changes.push(...nestedChanges);
        }
        // Compare values directly (primitives, arrays, Timestamps, or type changes)
        else if (JSON.stringify(safeOriginalValue) !== JSON.stringify(safeUpdatedValue)) {
            // Special handling for empty address objects - if original was null/undefined/empty and new is empty, don't report change
            // This ensures that if address was null and now is {}, it's not reported as change
            const isAddressField = currentFullPath.includes('address.') || currentFullPath === 'address'; // Also check for top-level address
            const originalIsEmpty = safeOriginalValue === null || (typeof safeOriginalValue === 'object' && Object.keys(safeOriginalValue).length === 0);
            const updatedIsEmpty = safeUpdatedValue === null || (typeof safeUpdatedValue === 'object' && Object.keys(safeUpdatedValue).length === 0);

            if (isAddressField && originalIsEmpty && updatedIsEmpty) {
                continue; // Skip if both original and updated address are effectively empty
            }

            changes.push(`Zmena ${formatLabel(currentFullPath)}: z '${formatDisplayValue(safeOriginalValue, currentFullPath)}' na '${formatDisplayValue(safeUpdatedValue, currentFullPath)}'`);
        }
    }
    return changes;
};

// Generic DataEditModal Component pre zobrazovanie/úpravu JSON dát
const setNestedValue = (obj, path, value) => {
    const pathParts = path.split('.');
    let current = obj;
    for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        if (!current[part] || typeof current[part] !== 'object' || Array.isArray(current[part])) {
            current[part] = {}; // Vytvorí objekt, ak neexistuje alebo je nesprávneho typu
        }
        current = current[part];
    }
    current[pathParts[pathParts.length - 1]] = value;
};


const DataEditModal = ({ isOpen, onClose, onSave, data, type, config, userSettings, title, onDeleteMember, targetDocRef, originalDataPath, setUserNotificationMessage, setError, isNewEntry }) => {
    // console.log("DataEditModal: Rendered with props:", { isOpen, data, type, config, title, isNewEntry });
    // console.log("DataEditModal: Received data:", data);

    const initialEditedData = React.useMemo(() => {
        if (!data) return {};

        let cleanedData = { ...data };
        // Convert Firestore Timestamp to Date objects for date inputs
        for (const key in cleanedData) {
            if (cleanedData[key] && typeof cleanedData[key].toDate === 'function') {
                cleanedData[key] = cleanedData[key].toDate();
            }
        }

        // Ensure address is an object, even if it's null or undefined
        if (cleanedData.address === null || cleanedData.address === undefined) {
            cleanedData.address = {};
        }


        // Special handling for new team members: pre-fill uniqueId if missing
        if (type === 'teamMember' && !cleanedData.uniqueId) {
            cleanedData.uniqueId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        }

        // Ensure tShirts array exists for team type
        if (type === 'team' && !cleanedData.tShirts) {
            cleanedData.tShirts = [];
        }

        // Pre-fill phone number if it's an object from combined values
        // or if it's a string, parse it.
        let parsedPhoneNumber = { code: '', number: '' };
        let fullPhoneNumberString = '';

        if (cleanedData.phoneNumber) {
            if (typeof cleanedData.phoneNumber === 'object' && cleanedData.phoneNumber.code && cleanedData.phoneNumber.number) {
                parsedPhoneNumber = cleanedData.phoneNumber;
                fullPhoneNumberString = combinePhoneNumber(parsedPhoneNumber.code, parsedPhoneNumber.number);
            } else if (typeof cleanedData.phoneNumber === 'string') {
                parsedPhoneNumber = parsePhoneNumber(cleanedData.phoneNumber, countryDialCodes);
                fullPhoneNumberString = cleanedData.phoneNumber; // Keep original string if it was string
            }
        }
        cleanedData.phoneNumber = parsedPhoneNumber;
        cleanedData.fullPhoneNumber = fullPhoneNumberString;

        return cleanedData;
    }, [data, type]);


    const [editedData, setEditedData] = React.useState(initialEditedData);
    const [isDialCodeModalOpen, setIsDialCodeModalOpen] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const [options, setOptions] = React.useState({}); // Stores dynamic options like team categories, packages, etc.
    const [localNotification, setLocalNotification] = React.useState(null); // Local notification for this modal
    const inputRefs = React.useRef({});

    // Stavy pre potvrdenie odstránenia
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = React.useState(false);
    const [deleteConfirmMessage, setDeleteConfirmMessage] = React.useState('');

    const modalRef = React.useRef(null); // For click outside logic


    // Load dynamic options from Firestore
    React.useEffect(() => {
        if (!isOpen || !window.db) return;

        const loadOptions = async () => {
            const fetchedOptions = {};
            // Example: Fetch team categories
            if (type === 'team' || type === 'user') { // User might also need team categories if creating a team
                const categoriesSnap = await getDocs(collection(window.db, "teamCategories"));
                fetchedOptions.teamCategories = categoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            }
            // Fetch packages and accommodation types
            if (type === 'team') {
                const packagesSnap = await getDocs(collection(window.db, "packages"));
                fetchedOptions.packages = packagesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                const accommodationSnap = await getDocs(collection(window.db, "accommodationTypes"));
                fetchedOptions.accommodationTypes = accommodationSnap.docs.map(doc => ({ id: doc.id, label: doc.data().type })); // Assuming 'type' field in Firestore
            }

            // Fetch tShirt sizes
            const tShirtSizesSnap = await getDocs(collection(window.db, "tshirtSizes"));
            const tShirtSizes = tShirtSizesSnap.docs.map(doc => doc.data().size);
            fetchedOptions.tShirtSizes = tShirtSizes.sort((a, b) => {
                const order = { 'XXS':-1, 'XS': 0, 'S': 1, 'M': 2, 'L': 3, 'XL': 4, 'XXL': 5, 'XXXL': 6 }; // Added XXS and corrected order
                return (order[a] !== undefined ? order[a] : 99) - (order[b] !== undefined ? order[b] : 99); // Handle missing sizes
            });
            setOptions(fetchedOptions);
        };

        loadOptions();
    }, [isOpen, type]); // Reload options if modal opens or type changes

    // Reset editedData when data prop changes (e.g., opening modal for new item)
    React.useEffect(() => {
        setEditedData(initialEditedData);
    }, [initialEditedData]);

    // Handle click outside modal to close it
    React.useEffect(() => {
        const handleClickOutside = (event) => {
            // Don't close if dial code modal or confirmation modal is open
            if (isDialCodeModalOpen || isConfirmDeleteOpen) {
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
    }, [isOpen, onClose, isDialCodeModalOpen, isConfirmDeleteOpen]);


    const handleLocalNotification = (message, isError = false) => {
        setLocalNotification({ message, isError });
        setTimeout(() => setLocalNotification(null), 3000); // Clear after 3 seconds
    };

    const handleChange = (e) => {
        const { name, value, type: inputType, checked } = e.target;
        // console.log(`DEBUG DataEditModal.handleChange - Name: ${name}, Value: ${value}, Type: ${inputType}, Checked: ${checked}`);

        setEditedData(prevData => {
            const newData = { ...prevData };
            let newValue = inputType === 'checkbox' ? checked : value;

            // Specific handling for date inputs (convert YYYY-MM-DD string to Date object)
            if (e.target.dataset.fieldtype === 'date') {
                newValue = value ? new Date(value) : null;
            }

            // Handle dot-notation for nested fields like 'address.street'
            if (name.includes('.')) {
                const tempRoot = { ...newData };
                setNestedValue(tempRoot, name, newValue);
                return tempRoot;
            }

            // Specific handling for fullPhoneNumber
            if (name === 'fullPhoneNumber') {
                const parsed = parsePhoneNumber(newValue, countryDialCodes); // Pass countryDialCodes
                return {
                    ...newData,
                    phoneNumber: parsed,
                    fullPhoneNumber: newValue // Keep raw input for display
                };
            }

            return { ...newData, [name]: newValue };
        });
    };

    const handleDialCodeSelect = (code) => {
        setEditedData(prevData => {
            const currentPhoneNumber = prevData.phoneNumber || { code: '', number: '' };
            const newPhoneNumber = { ...currentPhoneNumber, code };
            return {
                ...prevData,
                phoneNumber: newPhoneNumber,
                fullPhoneNumber: combinePhoneNumber(newPhoneNumber.code, newPhoneNumber.number)
            };
        });
        setIsDialCodeModalOpen(false);
    };

    const handleAddTShirtRow = () => {
        setEditedData(prevData => ({
            ...prevData,
            tShirts: [...(prevData.tShirts || []), { size: '', quantity: 1, _uniqueId: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}` }]
        }));
    };

    const handleRemoveTShirtRow = (uniqueIdToRemove) => {
        setEditedData(prevData => ({
            ...prevData,
            tShirts: (prevData.tShirts || []).filter(t => t._uniqueId !== uniqueIdToRemove)
        }));
    };

    const handleTShirtChange = (uniqueId, fieldName, value) => {
        setEditedData(prevData => ({
            ...prevData,
            tShirts: (prevData.tShirts || []).map(t =>
                t._uniqueId === uniqueId ? { ...t, [fieldName]: value } : t
            )
        }));
    };

    const handleSave = async () => {
        if (!window.db) {
            setUserNotificationMessage("Chyba: Firebase databáza nie je dostupná.", true);
            return;
        }

        setLoading(true);
        try {
            let dataToSave = { ...editedData };

            // Clean up temporary fields before saving
            delete dataToSave.fullPhoneNumber; // Only phoneNumber object should be saved

            // Filter out _uniqueId from tShirts before saving
            if (dataToSave.tShirts) {
                dataToSave.tShirts = dataToSave.tShirts.map(({ _uniqueId, ...rest }) => rest);
            }

            // Handle dates: ensure they are Date objects for Firestore (if they were strings from input)
            for (const key in dataToSave) {
                if (dataToSave[key] instanceof Date && isNaN(dataToSave[key].getTime())) {
                    dataToSave[key] = null; // Set invalid dates to null
                }
            }

            // Convert address to null if all its fields are empty or it's an empty object
            if (dataToSave.address && typeof dataToSave.address === 'object') {
                const isAddressEmpty = Object.values(dataToSave.address).every(val => val === null || val === undefined || val === '');
                if (isAddressEmpty) {
                    dataToSave.address = null;
                }
            } else if (dataToSave.address === undefined) {
                 dataToSave.address = null; // If address property was never touched and is undefined, make it null
            }


            // Special handling for phone number: combine code and number into a string for saving
            // This is for team members. For user, it's `contactPhoneNumber` and handled in parent
            if (type === 'teamMember' || type === 'team') { // Check type to apply only when relevant
                if (dataToSave.phoneNumber && dataToSave.phoneNumber.code && dataToSave.phoneNumber.number) {
                    dataToSave.phoneNumber = combinePhoneNumber(dataToSave.phoneNumber.code, dataToSave.phoneNumber.number);
                } else {
                    dataToSave.phoneNumber = null; // If incomplete, save as null
                }
            }

            // For User's contactPhoneNumber (if edited here)
            if (type === 'user' && dataToSave.phoneNumber) {
                 if (dataToSave.phoneNumber.code && dataToSave.phoneNumber.number) {
                    dataToSave.contactPhoneNumber = combinePhoneNumber(dataToSave.phoneNumber.code, dataToSave.phoneNumber.number);
                } else {
                    dataToSave.contactPhoneNumber = null;
                }
                delete dataToSave.phoneNumber; // Remove the temporary object
            }


            const changes = getChangesForNotification(data, dataToSave);

            if (changes.length === 0 && !isNewEntry) { // Allow saving new items even if no initial changes detected
                handleLocalNotification("Žiadne zmeny na uloženie.");
                setLoading(false);
                return;
            }

            // Delegate saving to the parent component's onSave handler
            onSave(dataToSave, targetDocRef, originalDataPath, isNewEntry, changes); // Pass changes for notification in parent
            onClose(); // Close modal after delegating save
        } catch (error) {
            console.error("Chyba v DataEditModal pri príprave dát na uloženie:", error);
            setError(`Chyba pri ukladaní dát: ${error.message || error}`);
            setUserNotificationMessage(`Chyba pri ukladaní dát: ${error.message || error}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteMemberClick = () => {
        const memberName = `${editedData.firstName || ''} ${editedData.lastName || ''}`.trim();
        setDeleteConfirmMessage(`Naozaj chcete odstrániť ${memberName || 'tohto člena tímu'}? Túto akciu nie je možné vrátiť späť.`);
        setIsConfirmDeleteOpen(true);
    };


    if (!isOpen) return null;

    const fieldsToRender = Object.keys(editedData || {}).filter(field =>
        ![
            'id', 'originalArray', 'originalIndex', 'uniqueId', 'createdAt', 'updatedAt',
            'teamId', 'members', 'fullPhoneNumber', 'phoneNumber', 'teamCategoryData',
            '_uniqueId', // Filter out temporary unique ID from rendering
            'contactPhoneNumber' // Top-level contactPhoneNumber is rendered via fullPhoneNumber for user
        ].includes(field) &&
        !field.startsWith('_') // Filter out any other internal fields starting with underscore
    );

    // Define specific order for address fields if they exist
    const addressFieldsOrder = ['street', 'houseNumber', 'city', 'zipCode', 'country']; // Corrected to 'country' for consistency

    // Determine if the current data being edited is an admin or hall user
    const isTargetUserAdmin = type === 'user' && editedData.role === 'admin';
    const isTargetUserHall = type === 'user' && editedData.role === 'hall';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div
                ref={modalRef} // Assign ref to the modal content div
                className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col"
            >
                <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                    <h2 className="text-xl font-semibold text-gray-800">
                        {title}
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl font-bold p-1">
                        &times;
                    </button>
                </div>

                <div className="p-4 overflow-y-auto flex-grow custom-scrollbar">
                    <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-4">
                        {fieldsToRender.map(field => {
                            let fieldValue = getNestedValue(editedData, field);
                            const fieldType = config?.fieldTypes?.[field] || typeof fieldValue;

                            // Skip specific fields for admin/hall users if editing a user
                            if ((isTargetUserAdmin || isTargetUserHall) && ['billing', 'street', 'houseNumber', 'city', 'postalCode', 'country', 'note'].includes(field)) {
                                return null;
                            }


                            // Handle nested objects dynamically (e.g., 'address')
                            if (typeof fieldValue === 'object' && fieldValue !== null && !Array.isArray(fieldValue) && typeof fieldValue.toDate !== 'function') {
                                // Render a section for nested object fields
                                const nestedKeys = Object.keys(fieldValue || {}).sort((a, b) => {
                                    const indexA = addressFieldsOrder.indexOf(a);
                                    const indexB = addressFieldsOrder.indexOf(b);
                                    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                                    if (indexA !== -1) return -1;
                                    if (indexB !== -1) return 1;
                                    return a.localeCompare(b);
                                });

                                if (nestedKeys.length === 0 && field === 'address') {
                                    // If address is an empty object, provide initial fields for editing
                                    // Only add if not already present, to avoid duplicates
                                    const defaultAddressFields = ['street', 'houseNumber', 'city', 'zipCode', 'country'];
                                    defaultAddressFields.forEach(defaultField => {
                                        if (!nestedKeys.includes(defaultField)) nestedKeys.push(defaultField);
                                    });
                                }

                                return (
                                    <div key={field} className="border p-3 rounded-md bg-gray-50">
                                        <h4 className="font-semibold text-gray-700 mb-2">{formatLabel(field)}</h4>
                                        <div className="space-y-3">
                                            {nestedKeys.map(nestedField => {
                                                const fullFieldName = `${field}.${nestedField}`;
                                                const nestedFieldValue = getNestedValue(editedData, fullFieldName);
                                                const nestedFieldType = config?.fieldTypes?.[fullFieldName] || typeof nestedFieldValue;

                                                let customProps = {};
                                                // Specific handlers for nested fields
                                                if (nestedField === 'zipCode') {
                                                    // These handlers are defined in AllRegistrationsApp, but are specific to its internal logic.
                                                    // For DataEditModal, we'll use a simpler, generic handleChange for now.
                                                    // The formatting for display is handled by formatDisplayValue.
                                                    // If more complex formatting/validation is needed for nested zipCode, it should be in handleChange.
                                                    customProps = {
                                                        inputMode: 'numeric',
                                                        pattern: '[0-9 ]*',
                                                        maxLength: 6
                                                    };
                                                }
                                                // Similar for ICO, DIC, ICDPH if they were nested
                                                // For now, these are top-level or in 'billing' object for 'user' type

                                                return (
                                                    <div key={fullFieldName} className="flex flex-col">
                                                        <label htmlFor={fullFieldName} className="block text-sm font-medium text-gray-700">
                                                            {formatLabel(nestedField)}:
                                                        </label>
                                                        <input
                                                            ref={el => inputRefs.current[fullFieldName] = el}
                                                            type={nestedFieldType === 'number' ? 'number' : 'text'}
                                                            id={fullFieldName}
                                                            name={fullFieldName}
                                                            value={nestedFieldValue === null || nestedFieldValue === undefined ? '' : nestedFieldValue}
                                                            onChange={handleChange}
                                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2"
                                                            disabled={config?.disabledFields?.includes(fullFieldName)}
                                                            {...customProps}
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            }

                            // Handle specific field types for main level
                            if (field === 'dateOfBirth') { // Corrected from 'birthDate' for consistency with `data.dateOfBirth`
                                return (
                                    <div key={field} className="flex flex-col">
                                        <label htmlFor={field} className="block text-sm font-medium text-gray-700">
                                            {formatLabel(field)}:
                                        </label>
                                        <input
                                            type="date"
                                            id={field}
                                            name={field}
                                            data-fieldtype="date" // Custom attribute for date handling
                                            value={fieldValue instanceof Date && !isNaN(fieldValue) ? fieldValue.toISOString().split('T')[0] : ''}
                                            onChange={handleChange}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2"
                                            disabled={config?.disabledFields?.includes(field)}
                                        />
                                    </div>
                                );
                            }

                            // For team members: Jersey Number and Registration Number
                            if (field === 'jerseyNumber') {
                                return (
                                    <div key={field} className="flex flex-col">
                                        <label htmlFor={field} className="block text-sm font-medium text-gray-700">
                                            {formatLabel(field)}:
                                        </label>
                                        <input
                                            type="number"
                                            id={field}
                                            name={field}
                                            value={fieldValue === null || fieldValue === undefined ? '' : fieldValue}
                                            onChange={handleChange}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2"
                                            disabled={config?.disabledFields?.includes(field)}
                                            inputMode='numeric'
                                            pattern='[0-9]*'
                                            maxLength={3}
                                        />
                                    </div>
                                );
                            }
                            if (field === 'registrationNumber') {
                                return (
                                    <div key={field} className="flex flex-col">
                                        <label htmlFor={field} className="block text-sm font-medium text-gray-700">
                                            {formatLabel(field)}:
                                        </label>
                                        <input
                                            type="text"
                                            id={field}
                                            name={field}
                                            value={fieldValue === null || fieldValue === undefined ? '' : fieldValue}
                                            onChange={handleChange}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2"
                                            disabled={config?.disabledFields?.includes(field)}
                                            maxLength={20}
                                        />
                                    </div>
                                );
                            }


                            // This covers both user's `contactPhoneNumber` and team/member's `phoneNumber`
                            if (field === 'fullPhoneNumber' || field === 'contactPhoneNumber') {
                                // Skip for admin/hall users if editing user data
                                if ((isTargetUserAdmin || isTargetUserHall) && type === 'user') return null;

                                return (
                                    <div key={field} className="flex flex-col">
                                        <label htmlFor={field} className="block text-sm font-medium text-gray-700">
                                            Telefónne číslo:
                                        </label>
                                        <div className="flex mt-1">
                                            <button
                                                type="button"
                                                onClick={() => setIsDialCodeModalOpen(true)}
                                                className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm hover:bg-gray-100"
                                            >
                                                {editedData.phoneNumber?.code || '+421'}
                                            </button>
                                            <input
                                                type="text"
                                                id={field}
                                                name="fullPhoneNumber" // Always use 'fullPhoneNumber' for the name in handleChange
                                                value={editedData.fullPhoneNumber || ''}
                                                onChange={handleChange}
                                                className="flex-1 block w-full rounded-none rounded-r-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2"
                                                placeholder="Zadajte číslo"
                                                disabled={config?.disabledFields?.includes(field)}
                                            />
                                        </div>
                                    </div>
                                );
                            }

                            // Handle select dropdowns for categories, packages, accommodation, gender
                            if (['teamCategory', 'selectedPackage', 'accommodationType', 'gender'].includes(field)) {
                                let selectOptions = [];
                                let placeholder = `Vyberte ${formatLabel(field)}`;

                                if (field === 'teamCategory' && options.teamCategories) {
                                    selectOptions = options.teamCategories.map(cat => ({ value: cat.id, label: cat.name }));
                                } else if (field === 'selectedPackage' && options.packages) {
                                    selectOptions = options.packages.map(pkg => ({ value: pkg.id, label: pkg.name }));
                                } else if (field === 'accommodationType' && options.accommodationTypes) {
                                    selectOptions = options.accommodationTypes.map(acc => ({ value: acc.id, label: acc.label })); // Use acc.label
                                } else if (field === 'gender') {
                                    selectOptions = [{ value: 'male', label: 'Muž' }, { value: 'female', label: 'Žena' }];
                                }


                                return (
                                    <div key={field} className="flex flex-col">
                                        <label htmlFor={field} className="block text-sm font-medium text-gray-700">
                                            {formatLabel(field)}:
                                        </label>
                                        <select
                                            id={field}
                                            name={field}
                                            value={fieldValue || ''}
                                            onChange={handleChange}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2"
                                            disabled={config?.disabledFields?.includes(field)}
                                        >
                                            <option value="">{placeholder}</option>
                                            {selectOptions.map(option => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                );
                            }


                            // Default input for other fields
                            return (
                                <div key={field} className="flex flex-col">
                                    <label htmlFor={field} className="block text-sm font-medium text-gray-700">
                                        {formatLabel(field)}:
                                    </label>
                                    <input
                                        type={fieldType === 'number' ? 'number' : 'text'}
                                        id={field}
                                        name={field}
                                        value={fieldValue === null || fieldValue === undefined ? '' : fieldValue}
                                        onChange={handleChange}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2"
                                        disabled={config?.disabledFields?.includes(field)}
                                        // Conditional styling/validation for specific fields
                                        {...(field === 'companyId' && { placeholder: 'Napr. 12345678', inputMode: 'numeric', pattern: '[0-9]*', maxLength: 10 })}
                                        {...(field === 'vatId' && { placeholder: 'Napr. SK1234567890', onChange: handleChange, maxLength: 12 })} // Generic handleChange
                                        {...(field === 'zipCode' && { placeholder: 'Napr. 841 01', inputMode: 'numeric', pattern: '[0-9 ]*', maxLength: 6 })}
                                    />
                                </div>
                            );
                        })}

                        {/* T-Shirt section for Teams */}
                        {type === 'team' && (
                            <div className="border p-3 rounded-md bg-gray-50">
                                <h4 className="font-semibold text-gray-700 mb-2">Tričká</h4>
                                {editedData.tShirts && editedData.tShirts.map((tshirt, index) => (
                                    <div key={tshirt._uniqueId || index} className="flex items-end space-x-2 mb-2">
                                        <div className="flex-1">
                                            <label htmlFor={`tshirt-size-${tshirt._uniqueId}`} className="block text-sm font-medium text-gray-700">
                                                Veľkosť:
                                            </label>
                                            <select
                                                id={`tshirt-size-${tshirt._uniqueId}`}
                                                name="size"
                                                value={tshirt.size || ''}
                                                onChange={(e) => handleTShirtChange(tshirt._uniqueId, 'size', e.target.value)}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2"
                                            >
                                                <option value="">Vyberte veľkosť</option>
                                                {options.tShirtSizes && options.tShirtSizes.map(size => (
                                                    <option key={size} value={size}>{size}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="w-20">
                                            <label htmlFor={`tshirt-qty-${tshirt._uniqueId}`} className="block text-sm font-medium text-gray-700">
                                                Množstvo:
                                            </label>
                                            <input
                                                type="number"
                                                id={`tshirt-qty-${tshirt._uniqueId}`}
                                                name="quantity"
                                                value={tshirt.quantity || 1}
                                                onChange={(e) => handleTShirtChange(tshirt._uniqueId, 'quantity', parseInt(e.target.value, 10))}
                                                min="1"
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveTShirtRow(tshirt._uniqueId)}
                                            className="p-2 bg-red-500 text-white rounded-md hover:bg-red-600 self-end"
                                            title="Odstrániť tričko"
                                        >
                                            &times;
                                        </button>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={handleAddTShirtRow}
                                    className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                >
                                    Pridať riadok trička
                                </button>
                            </div>
                        )}

                    </form>
                </div>

                <div className="p-4 border-t flex justify-between items-center bg-gray-50 rounded-b-lg">
                    {(type === 'teamMember' && !isNewEntry) && React.createElement('button', { // Only show delete for existing team members
                        className: 'px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500',
                        onClick: handleDeleteMemberClick,
                        disabled: loading
                    }, 'Odstrániť')}

                    <div className="flex space-x-3 ml-auto"> {/* Use ml-auto to push buttons to the right */}
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
                            disabled={loading}
                        >
                            Zrušiť
                        </button>
                        <button
                            onClick={handleSave}
                            className={`px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${loading ? 'bg-blue-300' : 'bg-blue-600 hover:bg-blue-700'} text-white`}
                            disabled={loading}
                        >
                            {loading ? 'Ukladám...' : 'Uložiť zmeny'}
                        </button>
                    </div>
                </div>

                {localNotification && (
                    <NotificationModal
                        message={localNotification.message}
                        isError={localNotification.isError}
                        onClose={() => setLocalNotification(null)}
                        displayNotificationsEnabled={true} // Always display local notifications
                    />
                )}

                {isConfirmDeleteOpen && (
                    <ConfirmationModal
                        isOpen={isConfirmDeleteOpen}
                        onClose={() => setIsConfirmDeleteOpen(false)}
                        onConfirm={() => {
                            if (onDeleteMember) {
                                onDeleteMember(targetDocRef, originalDataPath);
                            } else {
                                setUserNotificationMessage("Chyba: Funkcia pre odstránenie nie je k dispozícii.", 'error');
                            }
                        }}
                        title="Potvrdenie odstránenia"
                        message={deleteConfirmMessage}
                    />
                )}

                {isDialCodeModalOpen && (
                    <DialCodeSelectionModal
                        isOpen={isDialCodeModalOpen}
                        onClose={() => setIsDialCodeModalOpen(false)}
                        onSelect={handleDialCodeSelect}
                        currentDialCode={editedData.phoneNumber?.code || '+421'}
                    />
                )}
            </div>
        </div>
    );
};


// Pomocná funkcia na aktualizáciu vnoreného objektu podľa cesty a vrátenie upraveného poľa najvyššej úrovne pre aktualizáciu Firestore
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
    // No need to explicitly update `players`, `menTeamMembersCount` etc. here,
    // as they are derived properties in `allTeamsFlattened` based on the array lengths.
    return teamToUpdate;
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
    { id: 'billing.icDph', label: 'IČ DPH', type: 'string', visible: true }, // Corrected type to 'string'
    { id: 'street', label: 'Ulica', type: 'string', visible: true }, // Added explicit address fields for display
    { id: 'houseNumber', label: 'Popisné číslo', type: 'string', visible: true },
    { id: 'city', label: 'Mesto/Obec', type: 'string', visible: true },
    { id: 'postalCode', label: 'PSČ', type: 'string', visible: true },
    { id: 'country', label: 'Krajina', type: 'string', visible: true },
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

  const openEditModal = (data, title, targetDocRef = null, originalDataPath = '', newEntryFlag = false) => {
      // Odstrániť citlivé alebo irelevantné kľúče pred odovzdaním do modálneho okna
      const cleanedData = { ...data };
      delete cleanedData.password; // Príklad: odstránenie hesla
      delete cleanedData.emailVerified; // Príklad: odstránenie interných stavov
      // ID je často súčasťou cesty, ale pre účely editácie môže byť užitočné
      // Ak je ID potrebné, malo by sa odovzdať ako `data.id` a nie ako top-level field `id` do `DataEditModal`
      // Ak je `data.id` z `user.id` alebo `team.id`, tak ho tam necháme.

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
      // console.log("closeEditModal: Closing modal."); // Debug log
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
            resolvedTitle = 'Pridať nového hráča';
            break;
        case 'Člen realizačného tímu (žena)':
            memberArrayPath = 'womenTeamMemberDetails';
            resolvedTitle = 'Pridať novú členku R. tímu (žena)';
            // Pridať predvolené pohlavie
            newMemberData.gender = 'female';
            break;
        case 'Člen realizačného tímu (muž)':
            memberArrayPath = 'menTeamMemberDetails';
            resolvedTitle = 'Pridať nového člena R. tímu (muž)';
            // Pridať predvolené pohlavie
            newMemberData.gender = 'male';
            break;
        case 'Šofér (žena)':
            memberArrayPath = 'driverDetailsFemale';
            resolvedTitle = 'Pridať novú šoférku (žena)';
            // Pridať predvolené pohlavie
            newMemberData.gender = 'female';
            break;
        case 'Šofér (muž)':
            memberArrayPath = 'driverDetailsMale';
            resolvedTitle = 'Pridať nového šoféra (muž)';
            // Pridať predvolené pohlavie
            newMemberData.gender = 'male';
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
        return teams;
    }
    return [];
  }, [filteredUsers, showUsers, showTeams]);

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
        // console.log("AllRegistrationsApp: Auth je ready a používateľ je null, presmerovávam na login.html.");
        if (typeof window.hideGlobalLoader === 'function') {
          window.hideGlobalLoader();
        }
        window.location.href = 'login.html';
        return;
    } else if (!isAuthReady || !db || user === undefined) {
        // console.log("AllRegistrationsApp: Čakám na inicializáciu Auth/DB/User data. Aktuálne stavy: isAuthReady:", isAuthReady, "db:", !!db, "user:", user ? user.uid : "N/A");
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

    if (isAuthReady && db && user && user.uid && userProfileData && userProfileData.role === 'admin' && userProfileData.approved === true) {
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

                setAllUsers(usersData);
                setFilteredUsers(usersData);
                if (typeof window.hideGlobalLoader === 'function') {
                  window.hideGlobalLoader();
                }
            }, error => {
                console.error("AllRegistrationsApp: Chyba pri načítaní všetkých používateľov z Firestore:", error);
                setError(`Chyba pri načítaní používateľov: ${error.message}`);
                if (typeof window.hideGlobalLoader === 'function') {
                  window.hideGlobalLoader();
                }
                setUserNotificationMessage(`Chyba pri načítaní dát: ${error.message}`);
            });
        } catch (e) {
            console.error("AllRegistrationsApp: Chyba pri nastavovaní onSnapshot pre všetkých používateľov (try-catch):", e);
            setError(`Chyba pri načítaní používateľov: ${e.message}`);
            if (typeof window.hideGlobalLoader === 'function') {
              window.hideGlobalLoader();
            }
            setUserNotificationMessage(`Chyba pri načítaní dát: ${e.message}`);
        }
    } else if (isAuthReady && user === null) {
        if (typeof window.hideGlobalLoader === 'function') {
          window.hideGlobalLoader();
        }
        window.location.href = 'login.html';
        return;
    } else if (isAuthReady && userProfileData && (userProfileData.role !== 'admin' || userProfileData.approved === false)) {
        setError("Nemáte oprávnenie na zobrazenie tejto stránky. Iba schválení administrátori majú prístup.");
        if (typeof window.hideGlobalLoader === 'function') {
          window.hideGlobalLoader();
        }
        setUserNotificationMessage("Nemáte oprávnenie na zobrazenie tejto stránky.");
        window.location.href = 'logged-in-my-data.html';
        return;
    } else {
        // Waiting for Auth/DB/User data to be ready
    }

    return () => {
        if (unsubscribeAllUsers) {
            unsubscribeAllUsers();
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
          if (['street', 'houseNumber', 'city', 'postalCode', 'country', 'note'].includes(columnId)) {
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
                  return ''; // Return empty string for invalid date values
              }

              // Použiť rovnaký formát ako v tabuľke
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
              val = nestedVal;
          } else {
              // Access top-level address fields directly for filtering
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
                      userValue = String(nestedVal || '').toLowerCase();
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

  const handleSaveEditedData = React.useCallback(async (updatedDataFromModal, targetDocRef, originalDataPath, isNewEntryFlag, changes) => {
    if (!targetDocRef) {
        console.error("Chyba: Chýba odkaz na dokument pre uloženie.");
        setUserNotificationMessage("Chyba: Chýba odkaz na dokument pre uloženie. Zmeny neboli uložené.", 'error');
        return;
    }

    try {
        window.showGlobalLoader();

        const userEmail = window.auth.currentUser?.email;

        // --- Save Notification to Firestore ---
        if ((changes.length > 0 || isNewEntryFlag) && userEmail) {
            const notificationsCollectionRef = collection(db, 'notifications');
            const notificationChanges = isNewEntryFlag
                ? [`Nový záznam bol pridaný: ${updatedDataFromModal.firstName || ''} ${updatedDataFromModal.lastName || updatedDataFromModal.teamName || ''}`.trim()]
                : changes;

            await addDoc(notificationsCollectionRef, {
                userEmail,
                changes: notificationChanges,
                timestamp: serverTimestamp()
            });
            // console.log("Notifikácia o zmene uložená do Firestore.");
        }
        // --- End Notification ---


        if (originalDataPath === '') {
            // Logika pre aktualizáciu používateľa na najvyššej úrovni
            await updateDoc(targetDocRef, updatedDataFromModal);
            setUserNotificationMessage("Zmeny boli úspešne uložené.", 'success');
            closeEditModal();
            return;
        } else if (editModalTitle.includes('Upraviť tím') || originalDataPath.startsWith('teams.') && !originalDataPath.includes('[')) { // Also check if path points to a team
            // Logika pre aktualizáciu tímu
            if (!originalDataPath.includes('[') || !originalDataPath.includes(']')) {
                throw new Error("Neplatný formát cesty tímu pre úpravu. Očakáva sa 'teams.category[index]'.");
            }

            const pathParts = originalDataPath.split('.');
            const categoryAndIndexPart = pathParts[1];
            const categoryMatch = categoryAndIndexPart.match(/^(.*?)\[(\d+)\]$/);
            if (!categoryMatch) {
                throw new Error(`Neplatný formát kategórie a indexu tímu: ${categoryAndIndexPart}.`);
            }
            const category = categoryMatch[1];
            const teamIndex = parseInt(categoryMatch[2]);

            const updatedTeamSpecificData = updatedDataFromModal;

            const docSnapshot = await getDoc(targetDocRef);
            if (!docSnapshot.exists()) {
                throw new Error("Dokument sa nenašiel pre aktualizáciu.");
            }
            const currentDocData = docSnapshot.data();
            const currentCategoryTeams = currentDocData.teams?.[category] || [];
            const newCategoryTeams = [...currentCategoryTeams];

            if (teamIndex >= 0 && teamIndex < newCategoryTeams.length) {
                newCategoryTeams[teamIndex] = { ...newCategoryTeams[teamIndex], ...updatedTeamSpecificData };
            } else {
                throw new Error(`Index tímu ${teamIndex} je mimo rozsahu pre aktualizáciu. Dĺžka tímov kategórie ${category}: ${newCategoryTeams.length}.`);
            }

            const updates = {};
            updates[`teams.${category}`] = newCategoryTeams;
            await updateDoc(targetDocRef, updates);
            setUserNotificationMessage("Zmeny boli úspešne uložené.", 'success');
            closeEditModal();
            return;
        } else if (originalDataPath.includes('playerDetails') || originalDataPath.includes('menTeamMemberDetails') ||
                   originalDataPath.includes('womenTeamMemberDetails') || originalDataPath.includes('driverDetailsMale') || originalDataPath.includes('driverDetailsFemale')) {
            // Logika pre aktualizáciu alebo pridanie člena tímu/hráča/šoféra
            const pathParts = originalDataPath.split('.');
            if (pathParts.length < 3) { // Adjusted length check
                throw new Error(`Neplatný formát cesty člena. Očakáva sa aspoň 3 segmenty (teams.category[index].memberArray[index]), našlo sa ${pathParts.length}. Original Data Path: ${originalDataPath}`);
            }

            const categoryAndIndexPart = pathParts[1];
            const categoryMatch = categoryAndIndexPart.match(/^(.*?)\[(\d+)\]$/);
            if (!categoryMatch) {
                throw new Error(`Neplatný formát kategórie a indexu tímu: ${categoryAndIndexPart}.`);
            }

            let memberArrayPath;
            let memberArrayIndex;

            if (isNewEntryFlag) {
                // Pre nové záznamy sa cesta končí na `[-1]`. Potrebujeme len názov poľa.
                const arrayNameMatch = pathParts[2].match(/^(.*?)\[-1\]$/);
                if (!arrayNameMatch) {
                    throw new Error(`Neplatný formát poľa člena tímu pre nový záznam (očakáva sa [-1]): ${pathParts[2]}.`);
                }
                memberArrayPath = arrayNameMatch[1]; // napr. "playerDetails"
                memberArrayIndex = -1; // Indikuje, že ide o nový záznam, nie špecifický index
            } else {
                // Pre existujúce záznamy parsujeme skutočný index.
                const existingMemberMatch = pathParts[2].match(/^(.*?)\[(\d+)\]$/);
                if (!existingMemberMatch) {
                    throw new Error(`Neplatný formát poľa člena tímu a indexu: ${pathParts[2]}.`);
                }
                memberArrayPath = existingMemberMatch[1];
                memberArrayIndex = parseInt(existingMemberMatch[2]);
            }

            const category = categoryMatch[1];
            const teamIndex = parseInt(categoryMatch[2]);

            await runTransaction(db, async (transaction) => { // Use runTransaction
                const userDoc = await transaction.get(targetDocRef);
                if (!userDoc.exists()) {
                    throw new Error("Dokument používateľa sa nenašiel pre aktualizáciu člena tímu.");
                }
                const currentDocData = userDoc.data();

                const teams = currentDocData.teams?.[category] || [];
                const teamToUpdate = { ...teams[teamIndex] }; // Hlboká kópia tímu na úpravu

                let currentMemberArray = [...(teamToUpdate[memberArrayPath] || [])];

                if (isNewEntryFlag) {
                    // Pridanie nového člena
                    // Uistíme sa, že adresný objekt existuje
                    const newMember = { ...updatedDataFromModal, address: updatedDataFromModal.address || null }; // Ensure address is null if empty
                    currentMemberArray.push(newMember);
                    setUserNotificationMessage("Nový člen bol úspešne pridaný do tímu.", 'success');
                } else if (memberArrayIndex >= 0 && memberArrayIndex < currentMemberArray.length) {
                    // Aktualizácia existujúceho člena
                    // Skopírujeme pôvodné dáta člena a potom ich prepíšeme aktualizovanými dátami
                    const originalMember = currentMemberArray[memberArrayIndex];
                    const updatedMember = {
                        ...originalMember,
                        ...updatedDataFromModal,
                        address: updatedDataFromModal.address || null // Set to null if updatedDataFromModal.address is empty
                    };
                    currentMemberArray[memberArrayIndex] = updatedMember;
                    setUserNotificationMessage("Zmeny člena boli úspešne uložené.", 'success');
                } else {
                    throw new Error(`Člen tímu pre aktualizáciu/pridanie sa nenašiel na ceste: ${originalDataPath} a isNewEntryFlag: ${isNewEntryFlag}.`);
                }

                teamToUpdate[memberArrayPath] = currentMemberArray;
                const finalUpdatedTeam = recalculateTeamCounts(teamToUpdate); // Prepočítať počty

                const updatedTeamsForCategory = [...teams];
                updatedTeamsForCategory[teamIndex] = finalUpdatedTeam;

                const updates = {};
                updates[`teams.${category}`] = updatedTeamsForCategory;
                transaction.update(targetDocRef, updates);
            });
            closeEditModal();
            return;
        } else {
            // Všeobecná vnorená aktualizácia
            if (!originalDataPath) {
                throw new Error("Cesta na uloženie dát (originalDataPath) je prázdna pre všeobecnú vnorenú aktualizáciu. Zmeny neboli uložené.");
            }
            await runTransaction(db, async (transaction) => { // Use runTransaction
                const docToUpdate = await transaction.get(targetDocRef);
                if (!docToUpdate.exists()) {
                    throw new Error("Dokument sa nenašiel pre aktualizáciu.");
                }
                const currentDocData = docToUpdate.data();

                const { updatedObject, topLevelField } = updateNestedObjectByPath(currentDocData, originalDataPath, updatedDataFromModal);

                const updates = {};
                updates[topLevelField] = updatedObject[topLevelField];

                transaction.update(targetDocRef, updates);
            });
            setUserNotificationMessage("Zmeny boli úspešne uložené.", 'success');
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
  }, [db, closeEditModal, setUserNotificationMessage, setError, editModalTitle]);

  const handleDeleteMember = React.useCallback(async (targetDocRef, originalDataPath) => {
    if (!targetDocRef || !originalDataPath) {
        console.error("Chyba: Chýba odkaz na dokument alebo cesta pre odstránenie člena.");
        setUserNotificationMessage("Chyba: Chýba odkaz na dokument alebo cesta pre odstránenie. Zmeny neboli uložené.", 'error');
        return;
    }

    try {
        window.showGlobalLoader();

        const pathParts = originalDataPath.split('.');
        if (pathParts.length < 3) {
            throw new Error(`Neplatný formát cesty člena pre odstránenie. Očakáva sa aspoň 3 segmenty (teams.category[index].memberArray[index]), našlo sa ${pathParts.length}. Original Data Path: ${originalDataPath}`);
        }

        const categoryAndIndexPart = pathParts[1];
        const memberArrayAndIndexPart = pathParts[2];

        const categoryMatch = categoryAndIndexPart.match(/^(.*?)\[(\d+)\]$/);
        const memberArrayMatch = memberArrayAndIndexPart.match(/^(.*?)\[(\d+)\]$/);

        if (!categoryMatch) {
            throw new Error(`Neplatný formát kategórie a indexu tímu: ${categoryAndIndexPart}.`);
        }
        if (!memberArrayMatch) {
            throw new Error(`Neplatný formát poľa člena tímu a indexu: ${memberArrayAndIndexPart}.`);
        }

        const category = categoryMatch[1];
        const teamIndex = parseInt(categoryMatch[2]);
        const memberArrayPath = memberArrayMatch[1];
        const memberArrayIndex = parseInt(memberArrayMatch[2]);

        await runTransaction(db, async (transaction) => { // Use runTransaction
            const userDoc = await transaction.get(targetDocRef);
            if (!userDoc.exists()) {
                throw new Error("Dokument používateľa sa nenašiel pre odstránenie.");
            }
            const currentDocData = userDoc.data();

            const teams = currentDocData.teams?.[category] || [];
            const teamToUpdate = { ...teams[teamIndex] }; // Hlboká kópia tímu na úpravu

            if (teamToUpdate && teamToUpdate[memberArrayPath] && teamToUpdate[memberArrayPath][memberArrayIndex] !== undefined) {
                const memberToRemove = teamToUpdate[memberArrayPath][memberArrayIndex];
                const memberName = `${memberToRemove.firstName || ''} ${memberToRemove.lastName || ''}`.trim();

                const updatedMemberArray = [...teamToUpdate[memberArrayPath]];
                updatedMemberArray.splice(memberArrayIndex, 1); // Odstráni člena z poľa

                teamToUpdate[memberArrayPath] = updatedMemberArray; // Aktualizujeme pole
                const finalUpdatedTeam = recalculateTeamCounts(teamToUpdate); // Prepočítať počty

                const updatedTeamsForCategory = [...teams];
                updatedTeamsForCategory[teamIndex] = finalUpdatedTeam;

                const updates = {};
                updates[`teams.${category}`] = updatedTeamsForCategory;
                transaction.update(targetDocRef, updates);

                setUserNotificationMessage(`${memberName} bol úspešne odstránený z tímu.`, 'success');
            } else {
                throw new Error(`Člen tímu na odstránenie sa nenašiel na ceste: ${originalDataPath}.`);
            }
        });
        closeEditModal();
    } catch (e) {
        console.error("Chyba pri odstraňovaní člena tímu z Firestore:", e);
        setError(`Chyba pri odstraňovaní člena tímu: ${e.message}`);
        setUserNotificationMessage(`Chyba pri odstraňovaní člena tímu: ${e.message}`, 'error');
    } finally {
        window.hideGlobalLoader();
    }
  }, [db, closeEditModal, setUserNotificationMessage, setError]);


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

  // Nová pomocná funkcia na formátovanie hodnôt v bunkách tabuľky
  const formatTableCellValue = (value, columnId, userObject) => { // Added userObject
    if (value === null || value === undefined) return '-';

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
    } else if (columnId === 'approved') {
        return value ? 'Áno' : 'Nie';
    } else if (columnId === 'postalCode') {
        return formatPostalCode(value); // Znovu použije existujúcu funkciu formatPostalCode
    } else if (columnId === 'contactPhoneNumber') {
        const { dialCode, numberWithoutDialCode } = parsePhoneNumber(value, countryDialCodes); // Pass countryDialCodes
        const formattedNumber = formatNumberGroups(numberWithoutDialCode);
        return `${dialCode} ${formattedNumber}`;
    }
    // Handle top-level address fields
    else if (['street', 'houseNumber', 'city', 'country', 'note'].includes(columnId)) {
        return value;
    }

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
        uniqueColumnValues: uniqueColumnValues
    }),
    React.createElement(DataEditModal, {
        isOpen: isEditModalOpen,
        onClose: closeEditModal,
        title: editModalTitle,
        data: editingData,
        onSave: handleSaveEditedData, // Odovzdať handler na uloženie
        onDeleteMember: handleDeleteMember, // Odovzdať nový handler pre odstránenie
        targetDocRef: editingDocRef,    // Odovzdať referenciu na dokument
        originalDataPath: editingDataPath, // Odovzdať cestu v dokumente
        setUserNotificationMessage: setUserNotificationMessage, // Preposielame setter notifikácie
        setError: setError, // Preposielame setter chýb
        isNewEntry: isNewEntry // Odovzdať príznak
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
                                columnOrder.map((col) => (
                                    React.createElement('th', {
                                        key: col.id,
                                        scope: 'col',
                                        className: `py-3 px-6 relative group whitespace-nowrap min-w-max`,
                                        onMouseEnter: () => setHoveredColumn(col.id),
                                        onMouseLeave: () => setHoveredColumn(null)
                                    },
                                        React.createElement('div', { className: 'flex items-center justify-center h-full space-x-1' },
                                            React.createElement('button', {
                                                onClick: (e) => { e.stopPropagation(); openFilterModal(col.id); },
                                                className: `text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 ${activeFilters[col.id] && activeFilters[col.id].length > 0 ? 'opacity-100 text-blue-500' : 'opacity-0 group-hover:opacity-100'} transition-opacity duration-200`
                                            }, '⚙️')
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
                                // Súhrnný riadok pre režim "iba tímy"
                                (allTeamsFlattened.length > 0 && !showUsers && showTeams) && React.createElement(
                                    'tr',
                                    { className: 'bg-gray-100 font-bold text-gray-700 uppercase' },
                                    React.createElement('td', { className: 'py-3 px-2 text-right', colSpan: 3 }, 'Súhrn:'),
                                    React.createElement('td', { className: 'py-3 px-2 text-center' }, teamSummary.totalPlayers),
                                    React.createElement('td', { className: 'py-3 px-2 text-center' }, teamSummary.totalWomenTeamMembers),
                                    React.createElement('td', { className: 'py-3 px-2 text-center' }, teamSummary.totalMenTeamMembers),
                                    React.createElement('td', { className: 'py-3 px-2 text-center' }, teamSummary.totalWomenDrivers),
                                    React.createElement('td', { className: 'py-3 px-2 text-center' }, teamSummary.totalMenDrivers),
                                    React.createElement('td', { className: 'py-3 px-2 text-left', colSpan: 3 }, 'Tričká:'),
                                    (availableTshirtSizes && availableTshirtSizes.length > 0 ? availableTshirtSizes : ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']).map(size =>
                                        React.createElement('td', { key: `summary-tshirt-${size}`, className: 'py-3 px-2 text-center' }, teamSummary.totalTshirtQuantities.get(size) || 0)
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
                                            Object.entries(u.teams || {}).map(([category, teamListRaw]) => // Renamed to teamListRaw
                                                (Array.isArray(teamListRaw) ? teamListRaw : []).map((team, teamIndex) => { // Defensive check
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
