// logged-in-all-registrations.js
// Tento súbor predpokladá, že Firebase SDK je inicializovaný v <head> logged-in-all-registrations.html
// a GlobalNotificationHandler v header.js spravuje globálnu autentifikáciu a stav používateľa.

// Importy pre Firebase Firestore funkcie (Firebase v9 modulárna syntax)
// Tento súbor je načítaný ako modul, preto môže používať importy.
import { collection, doc, onSnapshot, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// NotificationModal Component for displaying temporary messages (converted to React.createElement)
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
      style: { pointerEvents: 'none', zIndex: 1000 } // ZMENA: zIndex nastavený na 1000
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
    // selectedValues je teraz pole pre viacnásobný výber
    // initialFilterValues už obsahujú hodnoty v malých písmenách, takže ich len použijeme
    const [selectedValues, setSelectedValues] = React.useState(initialFilterValues || []);

    React.useEffect(() => {
        // Inicializovať selectedValues pri otvorení modalu alebo zmene initialFilterValues
        // Zabezpečí, že pri opätovnom otvorení modalu sa nastavia správne začiarknuté polia
        setSelectedValues(initialFilterValues || []);
    }, [initialFilterValues, isOpen]);

    if (!isOpen) return null;

    const handleCheckboxChange = (value) => {
        // KĽÚČOVÁ ZMENA: Prevod hodnoty na malé písmená pre konzistentné porovnávanie
        const lowerCaseValue = String(value).toLowerCase();
        setSelectedValues(prev => {
            if (prev.includes(lowerCaseValue)) {
                return prev.filter(item => item !== lowerCaseValue); // Odstrániť, ak už je vybrané
            } else {
                return [...prev, lowerCaseValue]; // Pridať, ak nie je vybrané
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
                            checked: selectedValues.includes(String(value).toLowerCase()), // Kontrola na malé písmená
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
                        // ODSTRÁNENÉ: React.createElement('span', { className: 'text-gray-500 text-sm' }, col.id)
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
function CollapsibleSection({ title, children, defaultOpen = false }) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return React.createElement(
    'div',
    { className: 'border border-gray-200 rounded-lg mb-2' },
    React.createElement(
      'button',
      {
        className: 'flex justify-between items-center w-full px-4 py-2 text-left bg-gray-50 hover:bg-gray-100 focus:outline-none rounded-t-lg',
        onClick: () => setIsOpen(!isOpen)
      },
      // Titul sa bude rendrovať buď ako string alebo ako React element (tabuľka)
      typeof title === 'string' ? React.createElement('span', { className: 'font-semibold text-gray-700' }, title) : title,
      React.createElement('span', { className: 'text-gray-500' }, isOpen ? '▲' : '▼')
    ),
    isOpen && React.createElement(
      'div',
      { className: 'p-4 border-t border-gray-200' },
      children
    )
  );
}

// TeamDetails Component - zobrazuje detaily tímov
function TeamDetails({ user, tshirtSizeOrder }) { // Pridaný tshirtSizeOrder ako prop
    if (!user || !user.teams || Object.keys(user.teams).length === 0) {
        return React.createElement('div', { className: 'text-gray-600 p-4' }, 'Žiadne tímové registrácie.');
    }

    const formatAddress = (address) => {
        if (!address) return '-';
        return `${address.street || ''} ${address.houseNumber || ''}, ${address.postalCode || ''} ${address.city || ''}, ${address.country || ''}`;
    };

    // Funkcia na formátovanie dátumu na DD. MM. YYYY
    const formatDateToDMMYYYY = (dateString) => {
        if (!dateString) return '-';
        const [year, month, day] = dateString.split('-');
        if (year && month && day) {
            return `${day}. ${month}. ${year}`;
        }
        return dateString; // Vráti pôvodný reťazec, ak formát nie je YYYY-MM-DD
    };

    // Definovanie poradia veľkostí tričiek pre triedenie (použijeme prop, ak je k dispozícii, inak fallback)
    const currentTshirtSizeOrder = tshirtSizeOrder && tshirtSizeOrder.length > 0 ? tshirtSizeOrder : ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

    return React.createElement(
        'div',
        { className: 'p-4 bg-gray-50 rounded-lg' },
        React.createElement('h3', { className: 'text-xl font-bold mb-4 text-gray-800' }, 'Tímové detaily'),
        Object.entries(user.teams).flatMap(([category, teamList]) =>
            teamList.map((team, teamIndex) => {
                // --- Collect all members including driver for the meal plan table ---
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
                }
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

                // NOVINKA: Konvertovanie team.tshirts do mapy pre jednoduché vyhľadávanie
                // Použijeme presné názvy veľkostí, ak sú definované v team.tshirts
                const teamTshirtsMap = new Map(
                    (team.tshirts || []).map(t => [String(t.size).trim(), t.quantity || 0])
                );

                // NOVINKA: Generovanie span elementov pre každú veľkosť trička pre hlavičku
                const tshirtSpans = currentTshirtSizeOrder.map(size => {
                    const quantity = teamTshirtsMap.get(size) || 0;
                    return React.createElement('span', {
                        key: `tshirt-summary-${size}`,
                        className: `text-gray-600 mr-2 inline-block` // Vždy inline-block
                    }, `${size.toUpperCase()}: ${quantity > 0 ? quantity : '-'}`);
                });

                // --- Meal dates and types for dynamic headers/cells ---
                const mealDates = team.packageDetails && team.packageDetails.meals ? Object.keys(team.packageDetails.meals).sort() : [];
                const mealTypes = ['breakfast', 'lunch', 'dinner', 'refreshment'];
                const mealTypeLabels = {
                    breakfast: 'Raňajky',
                    lunch: 'Obed',
                    dinner: 'Večera',
                    refreshment: 'Občerstvenie'
                };

                // OPRAVA: Robustnejšia inicializácia premenných womenTeamMembersCount a menTeamMembersCount
                let menTeamMembersCount = 0;
                if (Array.isArray(team.menTeamMemberDetails)) {
                    menTeamMembersCount = team.menTeamMemberDetails.length;
                }

                let womenTeamMembersCount = 0;
                if (Array.isArray(team.womenTeamMemberDetails)) {
                    womenTeamMembersCount = team.womenTeamMemberDetails.length;
                }


                // KONŠTRUKCIA HLAVIČKY PRE CollapsibleSection
                const teamHeaderTitle = React.createElement(
                    'div',
                    { className: 'flex flex-wrap items-center justify-between w-full' },
                    React.createElement('span', { className: 'font-semibold text-gray-900 mr-2' }, category || '-'),
                    React.createElement('span', { className: 'text-gray-700 mr-4' }, ` - ${team.teamName || `Tím ${teamIndex + 1}`}`),
                    React.createElement('span', { className: 'text-gray-600 hidden sm:inline mr-2' }, `Hráči: ${team.players || 0}`),
                    React.createElement('span', { className: 'text-gray-600 hidden md:inline mr-2' }, `R. tím (ž): ${womenTeamMembersCount}`),
                    React.createElement('span', { className: 'text-gray-600 hidden lg:inline mr-2' }, `R. tím (m): ${menTeamMembersCount}`),
                    React.createElement('span', { className: 'text-gray-600 hidden xl:inline mr-2' }, `Doprava: ${team.arrival?.type || '-'}`),
                    React.createElement('span', { className: 'text-gray-600 hidden 2xl:inline mr-2' }, `Ubytovanie: ${team.accommodation?.type || '-'}`),
                    React.createElement('span', { className: 'text-gray-600 hidden 3xl:inline mr-2' }, `Balík: ${team.packageDetails?.name || '-'}`),
                    // NOVINKA: Priame vloženie vygenerovaných spanov pre tričká
                    ...tshirtSpans,
                );
                
                return React.createElement(
                    React.Fragment, // Použijeme Fragment, aby sa nepridával zbytočný div
                    { key: `${category}-${teamIndex}` },
                    React.createElement(
                        CollapsibleSection,
                        { title: teamHeaderTitle, defaultOpen: false }, // Používame div ako titul
                        allConsolidatedMembers.length > 0 &&
                        React.createElement(
                            CollapsibleSection,
                            { title: 'Detaily členov tímu (hráči, realizačný tím a šofér) a stravovanie', defaultOpen: false }, // Updated title
                            React.createElement(
                                'div',
                                { className: '' }, // ODSTRÁNENÉ: overflow-x-auto trieda
                                React.createElement(
                                    'table',
                                    { className: 'min-w-full divide-y divide-gray-200' },
                                    React.createElement(
                                        'thead',
                                        { className: 'bg-gray-50' },
                                        React.createElement(
                                            'tr',
                                            null,
                                            React.createElement('th', { className: 'px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider' }, 'Typ'),
                                            React.createElement('th', { className: 'px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider' }, 'Meno'),
                                            React.createElement('th', { className: 'px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider' }, 'Priezvisko'),
                                            React.createElement('th', { className: 'px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider' }, 'Dátum narodenia'),
                                            React.createElement('th', { className: 'px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider' }, 'Číslo dresu'),
                                            React.createElement('th', { className: 'px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider' }, 'Reg. číslo'),
                                            React.createElement('th', { className: 'px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider' }, 'Adresa'),
                                            // Dynamic meal date headers
                                            mealDates.map(date =>
                                                React.createElement('th', { key: date, colSpan: 4, className: 'px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-l border-gray-200' },
                                                    React.createElement('div', { className: 'font-bold mb-1 whitespace-nowrap' }, formatDateToDMMYYYY(date)), // Display formatted date
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
                                                React.createElement('td', { className: 'px-4 py-2 whitespace-nowrap' }, member.type || '-'),
                                                React.createElement('td', { className: 'px-4 py-2 whitespace-nowrap' }, member.firstName || '-'),
                                                React.createElement('td', { className: 'px-4 py-2 whitespace-nowrap' }, member.lastName || '-'),
                                                React.createElement('td', { className: 'px-4 py-2 whitespace-nowrap' }, formatDateToDMMYYYY(member.dateOfBirth)),
                                                React.createElement('td', { className: 'px-4 py-2' }, member.jerseyNumber || '-'),
                                                React.createElement('td', { className: 'px-4 py-2' }, member.registrationNumber || '-'),
                                                React.createElement('td', { className: 'px-4 py-2 whitespace-normal' }, formatAddress(member.address)),
                                                // Dynamic meal checkboxes
                                                mealDates.map(date =>
                                                    React.createElement('td', { key: `${member.uniqueId}-${date}-meals`, colSpan: 4, className: 'px-4 py-2 text-center border-l border-gray-200' },
                                                        React.createElement(
                                                            'div',
                                                            { className: 'flex justify-around' },
                                                            mealTypes.map(type => {
                                                                const isChecked = team.packageDetails.meals[date] && team.packageDetails.meals[date][type] === 1;
                                                                return React.createElement('input', {
                                                                    key: `${member.uniqueId}-${date}-${type}-checkbox`,
                                                                    type: 'checkbox',
                                                                    checked: isChecked,
                                                                    disabled: true, // Checkboxes are read-only
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
                            )
                        ),

                        // The original 'Stravovanie' summary section is removed as per the request.
                        // However, if there are still any other sections that should be displayed
                        // outside the 'Detaily členov tímu' collapsible, they should be here.
                        // For example, if 'tshirts' section was supposed to be at this level:
                        team.tshirts && team.tshirts.length > 0 &&
                        React.createElement(
                            CollapsibleSection,
                            { title: 'Veľkosti tričiek (podrobný zoznam)', defaultOpen: false },
                            React.createElement(
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
                                            React.createElement('th', { className: 'px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider' }, 'Veľkosť'),
                                            React.createElement('th', { className: 'px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider' }, 'Množstvo'),
                                        )
                                    ),
                                    React.createElement(
                                        'tbody',
                                        { className: 'bg-white divide-y divide-gray-200' },
                                        team.tshirts.map((tshirt, tIndex) =>
                                            React.createElement(
                                                'tr',
                                                { key: tIndex },
                                                React.createElement('td', { className: 'px-4 py-2' }, tshirt.size || '-'),
                                                React.createElement('td', { className: 'px-4 py-2' }, tshirt.quantity || 0),
                                            )
                                        )
                                    )
                                )
                            )
                        )
                    )
                );
            })
        )
    );
}


// Main React component for the logged-in-all-registrations.html page
function AllRegistrationsApp() {
  // Získame referencie na Firebase služby z globálnych premenných (autentifikácia.js)
  const auth = window.auth;
  const db = window.db;

  // Lokálny stav pre aktuálneho používateľa a jeho profilové dáta
  const [user, setUser] = React.useState(null);
  const [userProfileData, setUserProfileData] = React.useState(null);
  const [isAuthReady, setIsAuthReady] = React.useState(false);

  // Removed local loading state for users and column order
  const [error, setError] = React.useState('');
  const [userNotificationMessage, setUserNotificationMessage] = React.useState('');

  // Deklarácia stavov pre používateľov a filtrovanie
  const [allUsers, setAllUsers] = React.useState([]);
  const [filteredUsers, setFilteredUsers] = React.useState([]);
  const [currentSort, setCurrentSort] = React.useState({ column: 'registrationDate', direction: 'desc' });
  const [filterModalOpen, setFilterModalOpen] = React.useState(false);
  const [filterColumn, setFilterColumn] = React.useState('');
  const [activeFilters, setActiveFilters] = React.useState({});
  const [uniqueColumnValues, setUniqueColumnValues] = React.useState([]);

  // Stav pre poradie stĺpcov
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

  // Stav pre sledovanie rozbalených riadkov (ID používateľa -> boolean)
  const [expandedRows, setExpandedRows] = React.useState({});

  // NOVINKA: Stav pre dostupné veľkosti tričiek načítané z Firestore
  const [availableTshirtSizes, setAvailableTshirtSizes] = React.useState([]);
  // Predvolené poradie veľkostí tričiek pre prípad, že sa nepodarí načítať z Firestore
  const tshirtSizeOrderFallback = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

  // NOVINKA: Stavy pre globálne checkboxy Zobraziť používateľov a Zobraziť tímy
  const [showUsers, setShowUsers] = React.useState(true);
  const [showTeams, setShowTeams] = React.useState(true);


  // Funkcia na prepínanie rozbalenia/zbalenia riadku
  const toggleRowExpansion = (userId) => {
      setExpandedRows(prev => ({
          ...prev,
          [userId]: !prev[userId]
      }));
  };

  // NOVINKA: Funkcia na prepínanie všetkých riadkov
  const toggleAllRows = () => {
    // Filtrovať adminov pred kontrolou, či sú všetky rozbalené, alebo pred vytvorením nového stavu rozbalenia
    const nonAdminUsers = filteredUsers.filter(user => user.role !== 'admin');
    const allCurrentlyExpandedNonAdmin = nonAdminUsers.length > 0 && nonAdminUsers.every(user => expandedRows[user.id]);
    const newExpandedState = { ...expandedRows }; // Začať s aktuálnym stavom

    filteredUsers.forEach(user => {
        if (user.role !== 'admin') {
            newExpandedState[user.id] = !allCurrentlyExpandedNonAdmin;
        }
    });
    setExpandedRows(newExpandedState);
  };

  // Lokálny Auth Listener pre AllRegistrationsApp
  // Tento useEffect čaká na to, kým authentication.js nastaví globálne auth a db.
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
      }, 100); // Kontroluj každých 100 ms

      // Listener na udalosť 'globalDataUpdated' ak sa dáta zmenia dynamicky
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
            // Ak používateľ nie je prihlásený, presmerujeme ho
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
  }, []); // Prázdne závislosti, aby sa spustil len raz


  // Lokálny Effect pre načítanie používateľských dát z Firestore
  React.useEffect(() => {
    let unsubscribeUserDoc;

    if (isAuthReady && db && user) {
      console.log(`AllRegistrationsApp: Pokúšam sa načítať používateľský dokument pre UID: ${user.uid}`);
      // Zobraziť globálny loader, ak je funkcia dostupná
      if (typeof window.showGlobalLoader === 'function') {
        window.showGlobalLoader();
      }

      try {
        // Používame Firebase v9 modulárnu syntax
        const userDocRef = doc(db, 'users', user.uid);
        unsubscribeUserDoc = onSnapshot(userDocRef, (docSnapshot) => {
          if (docSnapshot.exists()) {
            const userData = docSnapshot.data();
            console.log("AllRegistrationsApp: Používateľský dokument existuje, dáta:", userData);

            setUserProfileData(userData);
            setError('');

            // NOVINKA: Aktualizácia viditeľnosti položiek menu na základe roly
            // Až tu voláme updateMenuItemsVisibility, pretože vieme, že userProfileData je k dispozícii.
            if (typeof window.updateMenuItemsVisibility === 'function') {
                window.updateMenuItemsVisibility(userData.role);
            } else {
                console.warn("AllRegistrationsApp: Funkcia updateMenuItemsVisibility nie je definovaná.");
            }

            console.log("AllRegistrationsApp: Načítanie používateľských dát dokončené.");
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
        console.log("AllRegistrationsApp: Auth je ready a používateľ je null, presmerovávam na login.html");
        if (typeof window.hideGlobalLoader === 'function') {
          window.hideGlobalLoader();
        }
        window.location.href = 'login.html';
        return;
    } else if (!isAuthReady || !db || user === undefined) {
        console.log("AllRegistrationsApp: Čakám na inicializáciu Auth/DB/User data. Current states: isAuthReady:", isAuthReady, "db:", !!db, "user:", user);
    }

    return () => {
      if (unsubscribeUserDoc) {
        console.log("AllRegistrationsApp: Ruším odber onSnapshot pre používateľský dokument.");
        unsubscribeUserDoc();
      }
    };
  }, [isAuthReady, db, user, auth]);


  // Effect for fetching all users from Firestore and column order
  React.useEffect(() => {
    let unsubscribeAllUsers;
    let unsubscribeColumnOrder;
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

    console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Triggered.");
    console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] State Snapshot - db:", !!db, "user:", user ? user.uid : "N/A", "userProfileData:", !!userProfileData, "role:", userProfileData ? userProfileData.role : "N/A", "approved:", userProfileData ? userProfileData.approved : "N/A", "isAuthReady:", isAuthReady);


    if (isAuthReady && db && user && user.uid && userProfileData && userProfileData.role === 'admin' && userProfileData.approved === true) {
        console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Conditions met: Approved Admin. Proceeding to fetch data.");
        // Zobraziť globálny loader, ak je funkcia dostupná
        if (typeof window.showGlobalLoader === 'function') {
          window.showGlobalLoader();
        }

        // --- Načítanie poradia stĺpcov pre aktuálneho admina ---
        try {
            // NOVINKA: Priame vytvorenie DocumentReference pomocou cesty
            const columnOrderDocRef = doc(db, 'users', user.uid, 'columnOrder', 'columnOrder');

            console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Attempting to set up onSnapshot for columnOrder at path:", columnOrderDocRef.path);
            unsubscribeColumnOrder = onSnapshot(columnOrderDocRef, docSnapshot => {
                console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] columnOrder onSnapshot received data. Exists:", docSnapshot.exists());
                let newOrderToSet = defaultColumnOrder; // Začneme s predvoleným poradím

                if (docSnapshot.exists()) {
                    const savedOrder = docSnapshot.data().order;
                    console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Raw savedOrder from Firestore:", savedOrder);

                    if (savedOrder && Array.isArray(savedOrder) && savedOrder.length > 0) {
                        const savedSettingsMap = new Map(savedOrder.map(col => [col.id, col]));
                        const finalOrder = [];

                        // Prejdeme cez defaultColumnOrder, aby sme zachovali jeho štruktúru a poradie
                        defaultColumnOrder.forEach(defaultCol => {
                            const savedColSettings = savedSettingsMap.get(defaultCol.id);
                            if (savedColSettings) {
                                // Ak je stĺpec v savedOrder, použijeme jeho viditeľnosť, inak predvolenú
                                finalOrder.push({
                                    ...defaultCol,
                                    visible: savedColSettings.visible !== undefined ? savedColSettings.visible : defaultCol.visible
                                });
                            } else {
                                // Ak nie je v savedOrder, použijeme predvolenú definíciu
                                finalOrder.push(defaultCol);
                            }
                        });

                        // ODSTRÁNENÉ: Logika, ktorá pridávala stĺpce, ktoré neboli v defaultColumnOrder
                        // Tým sa zabezpečí, že sa nezobrazia nežiaduce stĺpce z Firestore
                        newOrderToSet = finalOrder;
                        console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Zlúčené a preusporiadané poradie:", newOrderToSet);

                    } else {
                        console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Uložené poradie je prázdne alebo poškodené. Používam predvolené a ukladám ho.");
                        // Používame Firebase v9 modulárnu syntax
                        setDoc(columnOrderDocRef, { order: defaultColumnOrder }, { merge: true })
                            .then(() => console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Uložené predvolené poradie do Firestore (prázdne/poškodené)."))
                            .catch(e => console.error("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Chyba pri ukladaní predvoleného poradia (prázdne/poškodené):", e));
                    }
                } else {
                    console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Dokument poradia stĺpcov neexistuje. Používam predvolené a ukladám ho.");
                    // Používame Firebase v9 modulárnu syntax
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

        // --- Získanie všetkých používateľov z kolekcie 'users' ---
        try {
            // Používame Firebase v9 modulárnu syntax
            const usersCollectionRef = collection(db, 'users');
            unsubscribeAllUsers = onSnapshot(usersCollectionRef, snapshot => {
                // NEFILTROVAŤ používateľov s rolou 'admin' tu, aby sa zobrazili v tabuľke
                const usersData = snapshot.docs
                    .map(doc => ({ // doc from snapshot is a QueryDocumentSnapshot, not the doc function
                        id: doc.id,
                        ...doc.data()
                    }));

                console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Všetci používatelia načítaní:", usersData.length, "používateľov.");
                setAllUsers(usersData);
                setFilteredUsers(usersData); // filteredUsers sa bude spravovať cez activeFilters a custom logiku
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
        console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] User is null, not fetching data. Redirecting to login.html.");
        if (typeof window.hideGlobalLoader === 'function') {
          window.hideGlobalLoader();
        }
        window.location.href = 'login.html';
        return;
    } else if (isAuthReady && userProfileData && (userProfileData.role !== 'admin' || userProfileData.approved === false)) {
        console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] User is not an approved admin, not fetching data. Redirecting to my-data.html.");
        setError("Nemáte oprávnenie na zobrazenie tejto stránky. Iba schválení administrátori majú prístup.");
        if (typeof window.hideGlobalLoader === 'function') {
          window.hideGlobalLoader();
        }
        setUserNotificationMessage("Nemáte oprávnenie na zobrazenie tejto stránky.");
        window.location.href = 'logged-in-my-data.html';
        return;
    } else {
        console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Conditions not met for fetching data. Waiting for state updates.");
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

  // NOVINKA: Effect pre načítanie dostupných veľkostí tričiek zo sekcie 'settings/sizeTshirts'
  React.useEffect(() => {
      let unsubscribeSettings;
      if (db) {
          const settingsDocRef = doc(db, 'settings', 'sizeTshirts');
          unsubscribeSettings = onSnapshot(settingsDocRef, (docSnapshot) => {
              if (docSnapshot.exists()) {
                  const data = docSnapshot.data();
                  if (data && Array.isArray(data.sizes)) {
                      // OPRAVA: Mapovanie pre settings/sizeTshirts, kde sú veľkosti uložené ako reťazce priamo
                      // ODSTRÁNENÉ ZORADZOVANIE - teraz sa mapujú tak, ako sú v databáze
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
              setAvailableTshirtSizes(tshirtSizeOrderFallback); // Použijeme fallback pri chybe
          });
      }
      return () => {
          if (unsubscribeSettings) {
              unsubscribeSettings();
          }
      };
  }, [db]); // Závisí od inštancie databázy


  // Sorting logic
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

          const getNestedValue = (obj, path) => {
              return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined) ? acc[part] : undefined, obj);
          };

          if (columnId.includes('.')) {
              valA = getNestedValue(a, columnId);
              valB = getNestedValue(b, columnId);
          } else {
              valA = a[columnId];
              valB = b[columnId];
          }

          console.log(`handleSort: Porovnávam hodnoty pre ${columnId} (typ: ${type}): A=${valA}, B=${valB}`);


          if (type === 'date') {
              const dateA = valA && typeof valA.toDate === 'function' ? valA.toDate() : new Date(0);
              const dateB = valB && typeof valA.toDate === 'function' ? valB.toDate() : new Date(0);
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

  // Filtering logic
  const openFilterModal = (column) => {
      console.log("AllRegistrationsApp: openFilterModal volaná pre stĺpec:", column);
      console.log("AllRegistrationsApp: Aktuálny stav allUsers:", allUsers);

      setFilterColumn(column);
      // NOVINKA: Filtrovať adminov len z uniqueColumnValues, ak je to potrebné
      const values = [...new Set(allUsers.map(u => { // allUsers obsahuje aj adminov
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

  // Effect to re-apply filters when activeFilters, allUsers, showUsers, or showTeams change
  React.useEffect(() => {
      let currentFiltered = [...allUsers]; // allUsers teraz obsahuje aj adminov

      // 1. Filter out admin roles first from allUsers, regardless of other filters.
      currentFiltered = currentFiltered.filter(user => user.role !== 'admin');

      let usersToDisplay = [];

      // Logic for global checkboxes based on clarification
      if (showUsers) { // If "Zobraziť používateľov" is checked, always show all non-admin users
          usersToDisplay = currentFiltered;
      } else if (!showUsers && showTeams) {
          // Only "Zobraziť tímy" checked: Display only users who have teams
          usersToDisplay = currentFiltered.filter(user => user.teams && Object.keys(user.teams).length > 0);
      } else { // (!showUsers && !showTeams)
          // Neither checked: Display no users
          usersToDisplay = [];
      }

      // 3. Apply column-specific activeFilters to usersToDisplay
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
  }, [allUsers, activeFilters, showUsers, showTeams]); // Added showUsers and showTeams to dependencies


  // useEffect for updating header link visibility
  React.useEffect(() => {
    console.log(`AllRegistrationsApp: useEffect pre aktualizáciu odkazov hlavičky. User: ${user ? user.uid : 'null'}`);
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

  // Handle logout (needed for the header logout button)
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

  // Attach logout handler to the button in the header
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

  // Funkcia na presun stĺpca
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

    // Uloženie nového poradia do Firestore
    // Používame Firebase v9 modulárnu syntax
    if (db && user && user.uid) {
        // NOVINKA: Priame vytvorenie DocumentReference pomocou cesty
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

  // Funkcia na uloženie viditeľnosti stĺpcov do Firestore
  const handleSaveColumnVisibility = async (updatedColumns) => {
    setColumnOrder(updatedColumns);
    // Používame Firebase v9 modulárnu syntax
    if (db && user && user.uid) {
        // NOVINKA: Priame vytvorenie DocumentReference pomocou cesty
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

  // Display loading state - now handled by global loader
  if (!isAuthReady || user === undefined || !userProfileData) {
    // Počas načítania nevraciame nič, pretože globálny loader sa o to postará
    // Tiež zabezpečíme, aby sa React komponent nevykreslil, kým nie sú dáta pripravené
    return null;
  }

  // Ak používateľ existuje, ale nie je schválený admin, presmerujeme ho.
  if (userProfileData && (userProfileData.role !== 'admin' || userProfileData.approved === false)) {
      console.log("AllRegistrationsApp: Používateľ nie je schválený administrátor. Presmerovávam na logged-in-my-data.html.");
      // Skryť loader aj pri presmerovaní
      if (typeof window.hideGlobalLoader === 'function') {
        window.hideGlobalLoader();
      }
      window.location.href = 'logged-in-my-data.html';
      return null;
  }

  // Funkcia na formátovanie PSČ
  const formatPostalCode = (postalCode) => {
    if (!postalCode) return '-';
    const cleaned = String(postalCode).replace(/\s/g, '');
    if (cleaned.length === 5) {
      return `${cleaned.substring(0, 3)} ${cleaned.substring(3, 5)}`;
    }
    return postalCode;
  };

  // Funkcia na získanie vnorenej hodnoty
  const getNestedValue = (obj, path) => {
    return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined) ? acc[part] : undefined, obj);
  };

  // Ak je používateľ admin a schválený, zobrazíme mu tabuľku registrácií
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
            { className: 'flex justify-end items-center mb-4 flex-wrap gap-2' }, {/* Added flex-wrap and gap for responsiveness */}
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
                { className: 'w-full text-sm text-left text-gray-500' },
                React.createElement(
                    'thead',
                    { className: 'text-xs text-gray-700 uppercase bg-gray-50' },
                    React.createElement(
                        'tr',
                        null,
                        // NOVINKA: Pridanie stĺpca pre globálne rozbalenie/zbalenie
                        React.createElement('th', { scope: 'col', className: 'py-3 px-2 text-center' },
                            React.createElement('button', {
                                onClick: toggleAllRows,
                                className: 'text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-200 focus:outline-none'
                            },
                            // Zobrazíme šípku dole, ak sú všetky rozbalené (na zbalenie), inak šípku hore (na rozbalenie)
                            filteredUsers.length > 0 && filteredUsers.filter(user => user.role !== 'admin').every(user => expandedRows[user.id]) ? '▼' : '▲'
                            )
                        ),
                        // Pôvodný stĺpec pre individuálne rozbalenie/zbalenie ostáva
                        React.createElement('th', { scope: 'col', className: 'py-3 px-2' }, ''),
                        // ODSTRÁNENÉ: Dynamicky generované hlavičky pre veľkosti tričiek Z HLAVNEJ TABUĽKY
                        columnOrder.filter(col => col.visible).map((col, index) => (
                            React.createElement('th', {
                                key: col.id,
                                scope: 'col',
                                className: 'py-3 px-6 cursor-pointer relative group',
                                onMouseEnter: () => setHoveredColumn(col.id),
                                onMouseLeave: () => setHoveredColumn(null)
                            },
                                React.createElement('div', { className: 'flex flex-col items-center justify-center h-full' },
                                    React.createElement('div', { className: 'flex items-center space-x-1 mb-1' },
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
                                    React.createElement('span', { onClick: () => handleSort(col.id), className: 'flex items-center' },
                                        col.label,
                                        currentSort.column === col.id && React.createElement('span', { className: 'ml-1' }, currentSort.direction === 'asc' ? '▲' : '▼')
                                    )
                                )
                            ))
                        )
                    )
                ),
                React.createElement(
                    'tbody',
                    null,
                    filteredUsers.length === 0 ? (
                        React.createElement(
                            'tr',
                            null,
                            // Zväčšenie colspan o počet dostupných veľkostí tričiek
                            React.createElement('td', { colSpan: columnOrder.filter(c => c.visible).length + 2, className: 'py-4 px-6 text-center text-gray-500' }, 'Žiadne registrácie na zobrazenie.')
                        )
                    ) : (
                        filteredUsers.map(u => (
                            React.createElement(
                                React.Fragment,
                                { key: u.id },
                                React.createElement(
                                    'tr',
                                    {
                                        className: `bg-white border-b hover:bg-gray-50 ${u.role !== 'admin' ? 'cursor-pointer' : ''}`,
                                        onClick: u.role !== 'admin' ? () => toggleRowExpansion(u.id) : undefined
                                    },
                                    React.createElement('td', { className: 'py-3 px-2 text-center' }, ''),
                                    React.createElement('td', { className: 'py-3 px-2 text-center' },
                                        u.role !== 'admin' ? React.createElement('span', { className: 'text-gray-500' }, expandedRows[u.id] ? '▲' : '▼') : ''
                                    ),
                                    // ODSTRÁNENÉ: Dynamicky generované bunky pre veľkosti tričiek z HLAVNÉHO RIADKU
                                    columnOrder.filter(col => col.visible).map(col => (
                                        React.createElement('td', { key: col.id, className: 'py-3 px-6 text-left' },
                                            // Conditional rendering for user data based on global filters
                                            (!showUsers && showTeams) ? (
                                                // If only "Show Teams" is active, display minimal info for the user row
                                                col.id === 'billing.clubName' ? getNestedValue(u, col.id) || '-' :
                                                col.id === 'email' ? getNestedValue(u, col.id) :
                                                '-' // For other user-specific columns, just a dash
                                            ) : (
                                                // Original logic for when "Show Users" is active (alone or with teams)
                                                col.id === 'registrationDate' && getNestedValue(u, col.id) && typeof getNestedValue(u, col.id).toDate === 'function' ? getNestedValue(u, col.id).toDate().toLocaleString('sk-SK') :
                                                col.id === 'approved' ? (getNestedValue(u, col.id) ? 'Áno' : 'Nie') :
                                                col.id === 'postalCode' ? formatPostalCode(getNestedValue(u, col.id)) :
                                                getNestedValue(u, col.id) || '-'
                                            )
                                        )
                                    ))
                                ),
                                expandedRows[u.id] && u.role !== 'admin' && React.createElement(
                                    'tr',
                                    { key: `${u.id}-details`, className: 'bg-gray-100' },
                                    React.createElement('td', { colSpan: columnOrder.filter(c => c.visible).length + 2, className: 'p-0' }, // Adjusted colspan
                                        React.createElement(TeamDetails, { user: u, tshirtSizeOrder: availableTshirtSizes })
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
  );
}

// Explicitne sprístupniť komponent globálne
window.AllRegistrationsApp = AllRegistrationsApp;
