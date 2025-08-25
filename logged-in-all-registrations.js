// logged-in-all-registrations.js
// Tento súbor predpokladá, že Firebase SDK je inicializovaný v <head> logged-in-all-registrations.html
// a GlobalNotificationHandler v header.js spravuje globálnu autentifikáciu a stav používateľa.

// Importy pre Firebase Firestore funkcie (Firebase v9 modulárna syntax)
// Tento súbor je načítaný ako modul, preto môže používať importy.
import { collection, doc, onSnapshot, setDoc, updateDoc, getDoc, query, orderBy, getDocs, serverTimestamp, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
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


    return label;
};

// Pomocná funkcia na porovnávanie zmien pre notifikácie
const getChangesForNotification = (original, updated) => {
    const changes = [];
    const keys = new Set([...Object.keys(original), ...Object.keys(updated)]);

    for (const key of keys) {
        const originalValue = original[key];
        const updatedValue = updated[key];

        // Špeciálne pre "address" a "billing" (ak existujú ako objekty)
        if ((key === 'address' || key === 'billing') && typeof originalValue === 'object' && typeof updatedValue === 'object' && originalValue !== null && updatedValue !== null) {
            const nestedChanges = getChangesForNotification(originalValue, updatedValue);
            if (nestedChanges.length > 0) {
                changes.push(`${formatLabel(key)}: ${nestedChanges.join(', ')}`);
            }
            continue; // Skip further processing for this key
        }

        // Porovnanie hodnôt (s ohľadom na null/undefined a typy)
        if (originalValue !== updatedValue) {
            // Predpokladáme, že pre jednoduché typy je to priama zmena
            // Pre dátum narodenia formátujeme
            if (key === 'dateOfBirth') {
                const formattedOriginal = formatDateToDMMYYYY(originalValue);
                const formattedUpdated = formatDateToDMMYYYY(updatedValue);
                if (formattedOriginal !== formattedUpdated) {
                    changes.push(`Zmena ${formatLabel(key)}: z '${formattedOriginal || '-'}' na '${formattedUpdated || '-'}'`);
                }
            } else if (typeof originalValue === 'boolean' || typeof updatedValue === 'boolean') {
                 const originalBool = originalValue === true ? 'Áno' : 'Nie';
                 const updatedBool = updatedValue === true ? 'Áno' : 'Nie';
                 if (originalBool !== updatedBool) {
                     changes.push(`Zmena ${formatLabel(key)}: z '${originalBool}' na '${updatedBool}'`);
                 }
            } else {
                 changes.push(`Zmena ${formatLabel(key)}: z '${originalValue || '-'}' na '${updatedValue || '-'}'`);
            }
        }
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
function DataEditModal({ isOpen, onClose, title, data, onSave, onDeleteMember, targetDocRef, originalDataPath, setUserNotificationMessage, setError, isNewEntry, getChangesForNotification: getChangesForNotificationProp }) { // Pridané onDeleteMember a getChangesForNotificationProp
    const modalRef = React.useRef(null);
    const db = window.db; // Prístup k db z window objektu
    const [localEditedData, setLocalEditedData] = React.useState(data); 
    const [userRole, setUserRole] = React.useState('');
    const [isTargetUserAdmin, setIsTargetUserAdmin] = React.useState(false); 
    const [isTargetUserHall, setIsTargetUserHall] = React.useState(false); 
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
    const arrivalOptions = [
        'verejná doprava - vlak',
        'verejná doprava - autobus',
        'vlastná doprava',
        'bez dopravy'
    ];

    // Stavy pre typ ubytovania
    const [accommodationTypes, setAccommodationTypes] = React.useState([]);
    const [selectedAccommodationType, setSelectedAccommodationType] = React.useState('');

    // Stavy pre balíky
    const [packages, setPackages] = React.useState([]);
    const [selectedPackageName, setSelectedPackageName] = React.useState('');

    // Stavy pre tričká
    const [availableTshirtSizes, setAvailableTshirtSizes] = React.useState([]);
    // Zmenené teamTshirts na pole objektov, každý s tempId pre React kľúče
    const [teamTshirts, setTeamTshirts] = React.useState([]); // [{ tempId: 'uuid', size: 'S', quantity: 5 }]

    // Stavy pre potvrdenie odstránenia
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = React.useState(false);
    const [deleteConfirmMessage, setDeleteConfirmMessage] = React.useState('');

    // Utility to generate a unique ID for new t-shirt entries
    const generateUniqueId = () => Math.random().toString(36).substring(2, 9);


    React.useEffect(() => {
        const fetchTeamDataForSelects = async () => {
            if (db && title.includes('Upraviť tím')) {
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

        if (title.includes('Upraviť tím')) {
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
        } else if (title.includes('Upraviť tím')) {
            // Inicializovať selectedCategory s existujúcou kategóriou tímu
            setSelectedCategory(initialData._category || initialData.category || ''); // Použiť _category pre flattened tímy
            if (initialData.teamName === undefined) initialData.teamName = '';
            
            // Inicializovať vybraný typ dopravy
            setSelectedArrivalType(initialData.arrival?.type || '');
            
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
    }, [data, title, window.globalUserProfileData, db, availableTshirtSizes, isNewEntry]); // Pridané availableTshirtSizes a isNewEntry ako závislosť


    React.useEffect(() => {
        const handleClickOutside = (event) => {
            // Check if dial code modal is open, if so, don't close this modal
            if (isDialCodeModalOpen) {
                return;
            }
            // Check if confirmation modal is open, if so, don't close this modal
            if (isConfirmDeleteOpen) {
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
    }, [isOpen, onClose, isDialCodeModalOpen, isConfirmDeleteOpen]); // Add isConfirmDeleteOpen to dependencies

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
                { tempId: generateUniqueId(), size: availableSizesForNewEntry[0], quantity: 0 }
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
    const handlePostalCodeChange = (e, path) => { // path pridaná
        const input = e.target;
        const originalInput = input.value;
        let cursorPosition = input.selectionStart;

        // Odstráni všetky nečíselné znaky
        let cleanedValue = originalInput.replace(/\D/g, '');
        cleanedValue = cleanedValue.substring(0, 5); // Maximálne 5 číslic

        let formattedValue = cleanedValue;
        if (cleanedValue.length > 3) {
            formattedValue = cleanedValue.substring(0, 3) + ' ' + cleanedValue.substring(3);
            if (cursorPosition === 4 && originalInput.charAt(3) !== ' ' && cleanedValue.length === 4) {
                // Ak bola medzera práve vložená a kurzor je za ňou
                cursorPosition++;
            }
        } else if (cursorPosition === 4 && originalInput.length === 5 && originalInput.charAt(3) === ' ' && e.nativeEvent.inputType === 'deleteContentBackward') {
            // Edge case: "123| 4" -> backspace by user, remove "3 "
            cursorPosition -= 2; // Move cursor back past the '3' and space
        } else if (originalInput.length === 3 && formattedValue.length === 4 && e.nativeEvent.inputType === 'insertText') {
            // Edge case: User typed 3 chars, then 4th char. Space was inserted. Cursor moves.
            cursorPosition++;
        }

        handleChange(path, formattedValue); // Použijeme path

        // React controlled components make setting cursor position directly problematic.
        // Use setTimeout to allow state update to render, then set cursor.
        // This is a common workaround for this scenario.
        setTimeout(() => {
            if (inputRefs.current[path]) { // Použijeme path
                inputRefs.current[path].selectionStart = cursorPosition;
                inputRefs.current[path].selectionEnd = cursorPosition;
            }
        }, 0);
    };

    const handlePostalCodeKeyDown = (e, path) => { // path pridaná
        const input = e.target;
        const value = input.value;
        const selectionStart = input.selectionStart;

        if (e.key === 'Backspace' && selectionStart === 4 && value.charAt(selectionStart - 1) === ' ') {
            e.preventDefault(); // Zabrániť predvolenému Backspace
            const newValue = value.substring(0, selectionStart - 2) + value.substring(selectionStart);
            handleChange(path, newValue); // Použijeme path
            setTimeout(() => {
                if (inputRefs.current[path]) { // Použijeme path
                    inputRefs.current[path].selectionStart = selectionStart - 2;
                    if (inputRefs.current[path]) inputRefs.current[path].selectionEnd = selectionStart - 2;
                }
            }, 0);
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

    const isSavable = targetDocRef !== null;

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
        const memberFieldsOrder = [
            'firstName', 'lastName', 'dateOfBirth', 'jerseyNumber', 'registrationNumber',
            'address.street', 'address.houseNumber', 'address.postalCode', 'address.city', 'address.country'
        ];
        
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
                    maxLength: 6 
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
            if (isEditingMemberOrNewEntry) { // Použiť novú premennú
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
                            maxLength: 6 
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
            } else if (title.includes('Upraviť tím')) { // Ak upravujeme Tím
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
                                    handleChange('_category', e.target.value);
                                },
                                disabled: !isSavable
                            },
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

                // 3. Typ dopravy (Selectbox)
                teamElements.push(
                    React.createElement(
                        'div',
                        { key: 'arrival.type', className: 'mb-4' },
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
                            selectedAccommodationType && !accommodationTypes.includes(selectedAccommodationType) &&
                                React.createElement('option', { key: selectedAccommodationType, value: selectedAccommodationType, disabled: true, hidden: true }, selectedAccommodationType),
                            accommodationTypes.map(option => React.createElement('option', { key: option, value: option }, option))
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
                                    // Nájdite celý objekt balíka na základe vybraného názvu
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
                // Tlačidlo "Odstrániť" sa zobrazí len ak sa nepridáva nový záznam
                !isNewEntry && isEditingMember && React.createElement('button', { // Podmienene renderovať tlačidlo "Odstrániť"
                    className: 'px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600',
                    onClick: handleDeleteMemberClick,
                    disabled: !isSavable
                }, 'Odstrániť'),
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

                                // console.log("DEBUG DataEditModal Save Button Click: originalDataPath:", originalDataPath); // Debug log

                                const dataToPrepareForSave = JSON.parse(JSON.stringify(localEditedData));
                                
                                // 1. Zostaviť plné telefónne číslo (len ak sa neupravuje admin/hall používateľ)
                                if (dataToPrepareForSave.contactPhoneNumber !== undefined && !(isTargetUserAdmin || isTargetUserHall)) { 
                                    dataToPrepareForSave.contactPhoneNumber = combinePhoneNumber(displayDialCode, displayPhoneNumber);
                                } else if (isTargetUserAdmin || isTargetUserHall) { 
                                    // Ak sa upravuje admin/hall používateľ, zabezpečiť, že sa contactPhoneNumber vôbec neuloží
                                    delete dataToPrepareForSave.contactPhoneNumber;
                                }


                                // 2. Spracovať špecifické polia tímu, ak upravujeme tím
                                if (title.includes('Upraviť tím')) {
                                    dataToPrepareForSave.category = selectedCategory;
                                    dataToPrepareForSave._category = selectedCategory; 
                                    dataToPrepareForSave.arrival = { type: selectedArrivalType };
                                    dataToPrepareForSave.accommodation = { type: selectedAccommodationType };
                                    // Removed the problematic line: dataToPrepareForSave.packageDetails = packages.find(pkg => pkg.name === selectedPackageName) || null;
                                    dataToPrepareForSave.tshirts = teamTshirts.filter(t => t.size && t.quantity > 0).map(({ size, quantity }) => ({ size, quantity }));
                                }

                                // 3. Filtrovanie interných kľúčov a prázdnych polí pre finálny objekt na uloženie
                                const finalDataToSave = {};
                                Object.keys(dataToPrepareForSave).forEach(key => {
                                    // Exclude internal keys, id, uniqueId, type, originalArray, originalIndex, password
                                    if (!key.startsWith('_') && key !== 'id' && key !== 'uniqueId' && key !== 'type' && key !== 'originalArray' && key !== 'originalIndex' && key !== 'password') {
                                        const value = dataToPrepareForSave[key];
                                        // Zahŕňa prázdne reťazce a prázdne objekty (okrem 'billing' pre admin/hall),
                                        // aby sa zmeny na "" správne uložili.
                                        if (key === 'billing' && (isTargetUserAdmin || isTargetUserHall)) { 
                                            // Úplne preskočiť pole "billing", ak je to admin/hall používateľ
                                            // console.log(`DEBUG: Skipping 'billing' field for admin/hall user in DataEditModal.`);
                                        } else {
                                            finalDataToSave[key] = value;
                                        }
                                    }
                                });
                                
                                console.log("DEBUG: DataEditModal - onSave click. Final data prepared for saving:", finalDataToSave); // Debug log

                                // 4. Porovnať s pôvodnými dátami pre notifikáciu
                                const originalDataForCompare = JSON.parse(JSON.stringify(data)); // Original data passed as prop (empty for new)
                                const modifiedDataForCompare = JSON.parse(JSON.stringify(finalDataToSave)); // The data that will be saved

                                // Ak sa upravuje admin/hall používateľ, odstráňte z porovnania fakturačné a adresné údaje
                                if (isTargetUserAdmin || isTargetUserHall) { 
                                    delete originalDataForCompare.address;
                                    delete originalDataForCompare.billingAddress;
                                    delete modifiedDataForCompare.address;
                                    delete modifiedDataForCompare.billingAddress;
                                }

                                console.log("DEBUG: DataEditModal - onSave click. originalDataForCompare for diff:", originalDataForCompare);
                                console.log("DEBUG: DataEditModal - onSave click. modifiedDataForCompare for diff:", modifiedDataForCompare);

                                const generatedChanges = getChangesForNotificationProp(originalDataForCompare, modifiedDataForCompare); // Použiť prop
                                
                                console.log("DEBUG: DataEditModal - onSave click. generatedChanges.length (before conditional):", generatedChanges.length);
                                console.log("DEBUG: DataEditModal - onSave click. isNewEntry (modal state):", isNewEntry);

                                // Zjednodušená podmienka: Ak nie sú žiadne detegované zmeny, notifikovať a vrátiť sa.
                                // Pre nové záznamy sa očakáva,že generatedChanges.length > 0, ak sa zadali údaje.
                                if (generatedChanges.length === 0 && !isNewEntry) { // Pridaná podmienka !isNewEntry
                                    setUserNotificationMessage("Žiadne zmeny na uloženie.", 'info');
                                    onClose();
                                    return;
                                }

                                // --- Save Notification to Firestore ---
                                const userEmail = window.auth.currentUser?.email;
                                if ((generatedChanges.length > 0 || isNewEntry) && userEmail) { // Notify also for new entries (if changes or it's a new entry)
                                    const notificationsCollectionRef = collection(db, 'notifications');
                                    await addDoc(notificationsCollectionRef, {
                                        userEmail,
                                        changes: isNewEntry ? [`Nový člen bol pridaný: ${finalDataToSave.firstName || ''} ${finalDataToSave.lastName || ''}`.trim()] : generatedChanges,
                                        timestamp: serverTimestamp()
                                    });
                                    console.log("Notifikácia o zmene uložená do Firestore.");
                                }
                                // --- End Notification ---

                                // Teraz zavolať prop onSave z AllRegistrationsApp s kompletne pripravenými dátami
                                onSave(finalDataToSave, targetDocRef, originalDataPath, isNewEntry); // Pass only what AllRegistrationsApp needs to perform the Firestore update

                            } catch (e) {
                                console.error("Chyba v DataEditModal pri príprave dát na uloženie:", e);
                                setError(`Chyba pri ukladaní dát: ${e.message}`);
                                setUserNotificationMessage(`Chyba pri ukladaní dát: ${e.message}`, 'error');
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
            title: "Potvrdenie odstránenia",
            message: deleteConfirmMessage
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
    { id: 'billing.icDph', label: 'IČ DPH', type: true },
    { id: 'street', label: 'Ulica', type: 'string', visible: true },
    { id: 'houseNumber', label: 'Popisné číslo', type: 'string', visible: true },
    { id: 'city', label: 'Mesto/Obec', type: true },
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
            break;
        case 'Člen realizačného tímu (muž)':
            memberArrayPath = 'menTeamMemberDetails';
            resolvedTitle = 'Pridať nového člena R. tímu (muž)';
            break;
        case 'Šofér (žena)':
            memberArrayPath = 'driverDetailsFemale';
            resolvedTitle = 'Pridať novú šoférku (žena)';
            break;
        case 'Šofér (muž)':
            memberArrayPath = 'driverDetailsMale';
            resolvedTitle = 'Pridať nového šoféra (muž)';
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
        // console.log("AllRegistrationsApp: Auth je ready a používateľ je null, presmerovávam na login.html");
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
      // console.log("AllRegistrationsApp: openFilterModal volaná pre stĺpec:", column);
      // console.log("AllRegistrationsApp: Aktuálny stav allUsers:", allUsers);

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

  // Removed moveColumn function and related logic as column reordering is no longer supported.

  // Removed handleSaveColumnVisibility function as column visibility is no longer user-configurable.

  const handleSaveEditedData = React.useCallback(async (updatedDataFromModal, targetDocRef, originalDataPath, isNewEntryFlag) => {
    if (!targetDocRef) {
        console.error("Chyba: Chýba odkaz na dokument pre uloženie.");
        setUserNotificationMessage("Chyba: Chýba odkaz na dokument pre uloženie. Zmeny neboli uložené.", 'error');
        return;
    }

    try {
        window.showGlobalLoader();
        
        const isEditingUser = editModalTitle.includes('Upraviť používateľa');
        const currentEditingDataRole = editingData?.role;
        // Corrected: Derive these variables locally instead of relying on non-existent state from AllRegistrationsApp's scope
        const localIsTargetUserAdmin = isEditingUser && currentEditingDataRole === 'admin';
        const localIsTargetUserHall = isEditingUser && currentEditingDataRole === 'hall';

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
                if (key === 'address' || key === 'billingAddress') {
                    // Ak ide o adresný objekt, vykonáme hlboké zlúčenie
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
                    }
                } else if (typeof updatedDataFromModal[key] === 'object' && updatedDataFromModal[key] !== null && !Array.isArray(updatedDataFromModal[key])) {
                    // Ak je to iný objekt (napr. packageDetails), urobíme deep merge
                    finalDataToSave[key] = {
                        ...(currentDocData[key] || {}),
                        ...updatedDataFromModal[key]
                    };
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

            // Pre admin/hall používateľov odstránime adresné a fakturačné polia z porovnávania zmien, aby sa predišlo falošným detekciám
            if (localIsTargetUserAdmin || localIsTargetUserHall) {
                delete originalDataForCompare.address;
                delete originalDataForCompare.billingAddress;
                delete modifiedDataForCompare.address;
                delete modifiedDataForCompare.billingAddress;
            }

            const generatedChanges = getChangesForNotification(originalDataForCompare, modifiedDataForCompare);

            if (generatedChanges.length === 0) {
                setUserNotificationMessage("Žiadne zmeny na uloženie.", 'info');
                closeEditModal();
                return;
            }

            await updateDoc(targetDocRef, finalDataToSave);
            setUserNotificationMessage("Zmeny boli úspešne uložené.", 'success');
            closeEditModal(); 
            return;
        } else if (editModalTitle.includes('Upraviť tím')) { 
            // Logika pre aktualizáciu tímu
            if (!originalDataPath.includes('[') || !originalDataPath.includes(']')) {
                throw new Error("Neplatný formát cesty tímu pre úpravu. Očakáva sa 'category[index]'.");
            }

            const pathParts = originalDataPath.split('.');
            const categoryAndIndexPart = pathParts[1];
            const categoryMatch = categoryAndIndexPart.match(/^(.*?)\[(\d+)\]$/);
            if (!categoryMatch) {
                throw new Error(`Neplatný formát kategórie a indexu tímu: ${categoryAndIndexPart}.`);
            }
            const category = categoryMatch[1];
            const teamIndex = parseInt(categoryMatch[2]);
            
            const docSnapshot = await getDoc(targetDocRef);
            if (!docSnapshot.exists()) {
                throw new Error("Dokument sa nenašiel pre aktualizáciu.");
            }
            const currentDocData = docSnapshot.data();
            const currentCategoryTeams = currentDocData.teams?.[category] || [];
            
            // Hlboká kópia aktuálneho tímu
            const originalTeam = JSON.parse(JSON.stringify(currentCategoryTeams[teamIndex] || {}));
            
            // Vytvorenie aktualizovaného tímu s hlbokým zlúčením
            let updatedTeam = { ...originalTeam };
            for (const key in updatedDataFromModal) {
                if (key === 'address' || key === 'billingAddress') {
                    updatedTeam[key] = {
                        ...(originalTeam[key] || {}),
                        ...(updatedDataFromModal[key] || {})
                    };
                    // Ak sa v updatedDataFromModal[key] vymaže pole (nastaví na ''), zabezpečíme, že sa to prejaví
                    if (updatedDataFromModal[key]) {
                        for (const subKey in originalTeam[key]) {
                            if (updatedDataFromModal[key][subKey] === undefined && typeof originalTeam[key][subKey] === 'string') {
                                updatedTeam[key][subKey] = '';
                            }
                        }
                    }
                } else if (typeof updatedDataFromModal[key] === 'object' && updatedDataFromModal[key] !== null && !Array.isArray(updatedDataFromModal[key])) {
                    updatedTeam[key] = {
                        ...(originalTeam[key] || {}),
                        ...updatedDataFromModal[key]
                    };
                } else {
                    updatedTeam[key] = updatedDataFromModal[key];
                }
            }

            const generatedChanges = getChangesForNotification(originalTeam, updatedTeam);

            if (generatedChanges.length === 0) {
                setUserNotificationMessage("Žiadne zmeny na uloženie.", 'info');
                closeEditModal();
                return;
            }

            const newCategoryTeams = [...currentCategoryTeams];
            if (teamIndex >= 0 && teamIndex < newCategoryTeams.length) {
                newCategoryTeams[teamIndex] = updatedTeam;
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
            // console.log("DEBUG: Aktualizácia člena tímu.");
            const pathParts = originalDataPath.split('.');
            if (pathParts.length !== 3) {
                throw new Error(`Neplatný formát cesty člena. Očakáva sa 3 segmenty (teams.category[index].memberArray[index]), našlo sa ${pathParts.length}. Original Data Path: ${originalDataPath}`);
            }

            const categoryAndIndexPart = pathParts[1]; 
            const categoryMatch = categoryAndIndexPart.match(/^(.*?)\[(\d+)\]$/);
            if (!categoryMatch) {
                throw new Error(`Neplatný formát kategórie a indexu tímu: ${categoryAndIndexPart}.`);
            }
            
            let memberArrayPath;
            let memberArrayIndex;

            if (isNewEntryFlag) {
                const arrayNameMatch = pathParts[2].match(/^(.*?)\[-1\]$/);
                if (!arrayNameMatch) {
                    throw new Error(`Neplatný formát poľa člena tímu pre nový záznam (očakáva sa [-1]): ${pathParts[2]}.`);
                }
                memberArrayPath = arrayNameMatch[1]; 
                memberArrayIndex = -1; 
            } else {
                const existingMemberMatch = pathParts[2].match(/^(.*?)\[(\d+)\]$/);
                if (!existingMemberMatch) {
                    throw new Error(`Neplatný formát poľa člena tímu a indexu: ${pathParts[2]}.`);
                }
                memberArrayPath = existingMemberMatch[1];
                memberArrayIndex = parseInt(existingMemberMatch[2]);
            }

            const category = categoryMatch[1];
            const teamIndex = parseInt(categoryMatch[2]);

            const docSnapshot = await getDoc(targetDocRef);
            if (!docSnapshot.exists()) {
                throw new Error("Dokument sa nenašiel pre aktualizáciu.");
            }
            const currentDocData = docSnapshot.data();

            const teams = currentDocData.teams?.[category] || [];
            // Hlboká kópia tímu na úpravu (aby sme nemodifikovali pôvodné dáta priamo)
            const teamToUpdate = JSON.parse(JSON.stringify(teams[teamIndex] || {})); 

            let currentMemberArray = [...(teamToUpdate[memberArrayPath] || [])];
            
            if (isNewEntryFlag) {
                const newMember = { ...updatedDataFromModal, address: updatedDataFromModal.address || {} };
                currentMemberArray.push(newMember);
                setUserNotificationMessage("Nový člen bol úspešne pridaný do tímu.", 'success');
            } else if (memberArrayIndex >= 0 && memberArrayIndex < currentMemberArray.length) {
                const originalMember = JSON.parse(JSON.stringify(currentMemberArray[memberArrayIndex]));
                let updatedMember = { ...originalMember }; 

                // Aplikovať zmeny z updatedDataFromModal
                for (const key in updatedDataFromModal) {
                    if (key !== 'address') {
                        updatedMember[key] = updatedDataFromModal[key];
                    }
                }
                
                // Špeciálne spracovanie pre vnorený objekt adresy
                updatedMember.address = { ...(originalMember.address || {}) }; 

                if (updatedDataFromModal.address) {
                    for (const key in updatedDataFromModal.address) {
                        updatedMember.address[key] = updatedDataFromModal.address[key];
                    }
                    // Explicitne nastaviť vymazané adresné polia na prázdny reťazec
                    for (const key in originalMember.address) {
                        if (updatedDataFromModal.address[key] === undefined && typeof originalMember.address[key] === 'string') {
                            updatedMember.address[key] = "";
                        }
                    }
                } else if (originalMember.address) {
                    // Ak originalMember mal adresu, ale updatedDataFromModal ju už nemá,
                    // znamená to, že celá adresa bola vymazaná, takže ju vynulujeme
                    for (const key in originalMember.address) {
                        updatedMember.address[key] = "";
                    }
                }


                const generatedChanges = getChangesForNotification(originalMember, updatedMember);
                // console.log("DEBUG: Člen tímu - Generované zmeny:", generatedChanges);

                if (generatedChanges.length === 0) {
                    setUserNotificationMessage("Žiadne zmeny na uloženie.", 'info');
                    closeEditModal();
                    return;
                }

                currentMemberArray[memberArrayIndex] = updatedMember;
                setUserNotificationMessage("Zmeny člena boli úspešne uložené.", 'success');
            } else {
                throw new Error(`Člen tímu pre aktualizáciu/pridanie sa nenašiel na ceste: ${originalDataPath} a isNewEntryFlag: ${isNewEntryFlag}.`);
            }
            
            teamToUpdate[memberArrayPath] = currentMemberArray;
            const finalUpdatedTeam = recalculateTeamCounts(teamToUpdate); 

            const updatedTeamsForCategory = [...teams];
            updatedTeamsForCategory[teamIndex] = finalUpdatedTeam;

            const updates = {};
            updates[`teams.${category}`] = updatedTeamsForCategory;
            await updateDoc(targetDocRef, updates);
            setUserNotificationMessage("Zmeny boli úspešne uložené.", 'success');
            closeEditModal(); 
            return;
        } else {
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
  }, [db, closeEditModal, setUserNotificationMessage, setError, editModalTitle, editingData, getChangesForNotification]); // REMOVED MODAL-SPECIFIC STATES FROM DEPENDENCY ARRAY

  const handleDeleteMember = React.useCallback(async (targetDocRef, originalDataPath) => {
    if (!targetDocRef || !originalDataPath) {
        console.error("Chyba: Chýba odkaz na dokument alebo cesta pre odstránenie člena.");
        setUserNotificationMessage("Chyba: Chýba odkaz na dokument alebo cesta pre odstránenie. Zmeny neboli uložené.", 'error');
        return;
    }

    try {
        window.showGlobalLoader();

        const pathParts = originalDataPath.split('.');
        if (pathParts.length !== 3) {
            throw new Error(`Neplatný formát cesty člena pre odstránenie. Očakáva sa 3 segmenty (teams.category[index].memberArray[index]), našlo sa ${pathParts.length}. Original Data Path: ${originalDataPath}`);
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

        const docSnapshot = await getDoc(targetDocRef);
        if (!docSnapshot.exists()) {
            throw new Error("Dokument používateľa sa nenašiel pre odstránenie.");
        }
        const currentDocData = docSnapshot.data();

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
            await updateDoc(targetDocRef, updates);

            setUserNotificationMessage(`${memberName} bol úspešne odstránený z tímu.`, 'success');
            closeEditModal();
        } else {
            throw new Error(`Člen tímu na odstránenie sa nenašiel na ceste: ${originalDataPath}.`);
        }
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
      // console.log("AllRegistrationsApp: Používateľ nie je schválený administrátor. Presmerovávam na logged-in-my-data.html.");
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
        const { dialCode, numberWithoutDialCode } = parsePhoneNumber(value, countryDialCodes);
        const formattedNumber = formatNumberGroups(numberWithoutDialCode);
        return `${dialCode} ${formattedNumber}`;
    }
    // Handle top-level address fields
    else if (['street', 'houseNumber', 'city', 'country', 'note'].includes(columnId)) { // Added 'note'
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
    // Removed ColumnVisibilityModal component rendering
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
        isNewEntry: isNewEntry, // Odovzdať príznak
        getChangesForNotification: getChangesForNotification // Pass the helper function as a prop
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
                                                // Removed onClick handler from here to prevent row click expansion
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
                                                    onAddMember: handleOpenAddMemberTypeModal // Odovzdať handler
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
                                    React.createElement('td', { className: 'py-3 px-2 text-center' }, teamSummary.totalMenTeamMembers),
                                    React.createElement('td', { className: 'py-3 px-2 text-center' }, teamSummary.totalWomenTeamMembers),
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
                                                        ''
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
                                                        onAddMember: handleOpenAddMemberTypeModal // Odovzdať handler
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
