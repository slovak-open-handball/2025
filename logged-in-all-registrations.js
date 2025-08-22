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
            { className: 'bg-white p-6 rounded-lg shadow-xl w-full max-w-sm' },
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

// Pomocné funkcie pre formátovanie a získavanie hodnôt
const formatPostalCode = (postalCode) => {
  if (!postalCode) return '-';
  const cleaned = String(postalCode).replace(/\s/g, '');
  if (cleaned.length === 5) {
    return `${cleaned.substring(0, 3)} ${cleaned.substring(3, 5)}`;
  }
  return postalCode;
};

const getNestedValue = (obj, path) => {
  return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined) ? acc[part] : undefined, obj);
};

// NOVINKA: Komponent pre zobrazenie detailov o tíme
function TeamDetailsRow({ team, colSpan, teamCategory }) {
  const getAddressString = (address) => {
    if (!address) return '-';
    const parts = [address.street, address.houseNumber, address.city, formatPostalCode(address.postalCode), address.country].filter(Boolean);
    return parts.join(', ');
  };

  const getMealsSummary = (meals) => {
    if (!meals) return 'N/A';
    const mealDates = Object.keys(meals).sort();
    if (mealDates.length === 0) return 'Žiadne jedlá';

    return mealDates.map(date => {
      const dayMeals = meals[date];
      const mealParts = [];
      if (dayMeals.breakfast) mealParts.push(`Raňajky (${dayMeals.breakfast})`);
      if (dayMeals.lunch) mealParts.push(`Obed (${dayMeals.lunch})`);
      if (dayMeals.dinner) mealParts.push(`Večera (${dayMeals.dinner})`);
      if (dayMeals.refreshment) mealParts.push(`Občerstvenie (${dayMeals.refreshment})`);
      return `${date}: ${mealParts.join(', ')}`;
    }).join('; ');
  };

  return React.createElement(
    'tr',
    { className: 'bg-gray-100' },
    React.createElement(
      'td',
      { colSpan: colSpan, className: 'p-4 border-t-2 border-gray-300' },
      React.createElement(
        'div',
        { className: 'bg-white p-4 rounded-lg shadow-sm' },
        React.createElement('h4', { className: 'text-lg font-semibold mb-2' }, `Detaily tímu: ${teamCategory}`),
        React.createElement('p', { className: 'text-gray-700 mb-2' }, React.createElement('strong', null, 'Názov tímu: '), team.teamName || '-'),

        // Hráči
        team.playerDetails && team.playerDetails.length > 0 && React.createElement(
          'div',
          { className: 'mt-4' },
          React.createElement('h5', { className: 'font-semibold text-md mb-2' }, 'Hráči:'),
          React.createElement(
            'div',
            { className: 'overflow-x-auto' },
            React.createElement(
              'table',
              { className: 'min-w-full text-sm text-gray-600' },
              React.createElement(
                'thead',
                { className: 'bg-gray-50' },
                React.createElement(
                  'tr',
                  null,
                  React.createElement('th', { className: 'py-2 px-3 text-left' }, 'Meno'),
                  React.createElement('th', { className: 'py-2 px-3 text-left' }, 'Priezvisko'),
                  React.createElement('th', { className: 'py-2 px-3 text-left' }, 'Číslo dresu'),
                  React.createElement('th', { className: 'py-2 px-3 text-left' }, 'Dátum narodenia'),
                  React.createElement('th', { className: 'py-2 px-3 text-left' }, 'Registračné číslo'),
                  React.createElement('th', { className: 'py-2 px-3 text-left' }, 'Adresa')
                )
              ),
              React.createElement(
                'tbody',
                { className: 'bg-white divide-y divide-gray-200' },
                team.playerDetails.map((player, pIdx) =>
                  React.createElement(
                    'tr',
                    { key: pIdx },
                    React.createElement('td', { className: 'py-2 px-3' }, player.firstName || '-'),
                    React.createElement('td', { className: 'py-2 px-3' }, player.lastName || '-'),
                    React.createElement('td', { className: 'py-2 px-3' }, player.jerseyNumber || '-'),
                    React.createElement('td', { className: 'py-2 px-3' }, player.dateOfBirth || '-'),
                    React.createElement('td', { className: 'py-2 px-3' }, getAddressString(player.address))
                  )
                )
              )
            )
          )
        ),

        // Členovia realizačného tímu (Ženy)
        team.womenTeamMemberDetails && team.womenTeamMemberDetails.length > 0 && React.createElement(
          'div',
          { className: 'mt-4' },
          React.createElement('h5', { className: 'font-semibold text-md mb-2' }, 'Členovia realizačného tímu (Ženy):'),
          React.createElement(
            'div',
            { className: 'overflow-x-auto' },
            React.createElement(
              'table',
              { className: 'min-w-full text-sm text-gray-600' },
              React.createElement(
                'thead',
                { className: 'bg-gray-50' },
                React.createElement(
                  'tr',
                  null,
                  React.createElement('th', { className: 'py-2 px-3 text-left' }, 'Meno'),
                  React.createElement('th', { className: 'py-2 px-3 text-left' }, 'Priezvisko'),
                  React.createElement('th', { className: 'py-2 px-3 text-left' }, 'Dátum narodenia'),
                  React.createElement('th', { className: 'py-2 px-3 text-left' }, 'Adresa')
                )
              ),
              React.createElement(
                'tbody',
                { className: 'bg-white divide-y divide-gray-200' },
                team.womenTeamMemberDetails.map((member, mIdx) =>
                  React.createElement(
                    'tr',
                    { key: mIdx },
                    React.createElement('td', { className: 'py-2 px-3' }, member.firstName || '-'),
                    React.createElement('td', { className: 'py-2 px-3' }, member.lastName || '-'),
                    React.createElement('td', { className: 'py-2 px-3' }, member.dateOfBirth || '-'),
                    React.createElement('td', { className: 'py-2 px-3' }, getAddressString(member.address))
                  )
                )
              )
            )
          )
        ),

        // Členovia realizačného tímu (Muži)
        team.menTeamMemberDetails && team.menTeamMemberDetails.length > 0 && React.createElement(
          'div',
          { className: 'mt-4' },
          React.createElement('h5', { className: 'font-semibold text-md mb-2' }, 'Členovia realizačného tímu (Muži):'),
          React.createElement(
            'div',
            { className: 'overflow-x-auto' },
            React.createElement(
              'table',
              { className: 'min-w-full text-sm text-gray-600' },
              React.createElement(
                'thead',
                { className: 'bg-gray-50' },
                React.createElement(
                  'tr',
                  null,
                  React.createElement('th', { className: 'py-2 px-3 text-left' }, 'Meno'),
                  React.createElement('th', { className: 'py-2 px-3 text-left' }, 'Priezvisko'),
                  React.createElement('th', { className: 'py-2 px-3 text-left' }, 'Dátum narodenia'),
                  React.createElement('th', { className: 'py-2 px-3 text-left' }, 'Adresa')
                )
              ),
              React.createElement(
                'tbody',
                { className: 'bg-white divide-y divide-gray-200' },
                team.menTeamMemberDetails.map((member, mIdx) =>
                  React.createElement(
                    'tr',
                    { key: mIdx },
                    React.createElement('td', { className: 'py-2 px-3' }, member.firstName || '-'),
                    React.createElement('td', { className: 'py-2 px-3' }, member.lastName || '-'),
                    React.createElement('td', { className: 'py-2 px-3' }, member.dateOfBirth || '-'),
                    React.createElement('td', { className: 'py-2 px-3' }, getAddressString(member.address))
                  )
                )
              )
            )
          )
        ),

        // Detaily balíka
        team.packageDetails && React.createElement(
            'div',
            { className: 'mt-4' },
            React.createElement('h5', { className: 'font-semibold text-md mb-2' }, 'Detaily balíka:'),
            React.createElement('p', null, React.createElement('strong', null, 'Názov: '), team.packageDetails.name || '-'),
            React.createElement('p', null, React.createElement('strong', null, 'Cena: '), `${team.packageDetails.price || 0} €`),
            React.createElement('p', null, React.createElement('strong', null, 'Účastnícka karta: '), `${team.packageDetails.participantCard || 0} ks`),
            team.packageDetails.meals && React.createElement('div', { className: 'mt-2' }, React.createElement('strong', null, 'Stravovanie: '), getMealsSummary(team.packageDetails.meals)),
        ),

        // Detaily ubytovania
        team.accommodation && React.createElement(
            'div',
            { className: 'mt-4' },
            React.createElement('h5', { className: 'font-semibold text-md mb-2' }, 'Detaily ubytovania:'),
            React.createElement('p', null, React.createElement('strong', null, 'Typ ubytovania: '), team.accommodation.type || '-'),
        ),
        // Detaily dopravy
        team.arrival && React.createElement(
          'div',
          { className: 'mt-4' },
          React.createElement('h5', { className: 'font-semibold text-md mb-2' }, 'Detaily dopravy:'),
          React.createElement('p', null, React.createElement('strong', null, 'Typ dopravy: '), team.arrival.type || '-'),
          team.arrival.time && React.createElement('p', null, React.createElement('strong', null, 'Čas príchodu: '), team.arrival.time),
          team.arrival.drivers && team.arrival.drivers.length > 0 && React.createElement('p', null, React.createElement('strong', null, 'Vodiči: '), team.arrival.drivers.join(', ')),
        ),

        // Tielka
        team.tshirts && team.tshirts.length > 0 && React.createElement(
            'div',
            { className: 'mt-4' },
            React.createElement('h5', { className: 'font-semibold text-md mb-2' }, 'Tričká:'),
            React.createElement(
                'ul',
                { className: 'list-disc list-inside' },
                team.tshirts.map((tshirt, idx) => React.createElement('li', { key: idx }, `${tshirt.size}: ${tshirt.quantity} ks`))
            )
        )
      )
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

  // NOVINKA: Stav pre šírku menu a šírku okna
  const [menuSpacerWidth, setMenuSpacerWidth] = React.useState(0);
  const [windowWidth, setWindowWidth] = React.useState(window.innerWidth);
  // NOVINKA: Stav pre padding content-wrapperu
  const [contentPaddingX, setContentPaddingX] = React.useState(0);

  // NOVINKA: Stav pre rozbalené riadky tímov
  const [expandedRows, setExpandedRows] = React.useState({}); // { userId: true/false }

  // Stav pre poradie stĺpcov
  const defaultColumnOrder = [
    { id: 'role', label: 'Rola', type: 'string', visible: true },
    { id: 'approved', label: 'Schválený', type: 'boolean', visible: true },
    { id: 'registrationDate', label: 'Dátum registrácie', type: 'date', visible: true },
    { id: 'firstName', label: 'Meno', type: 'string', visible: true },
    { id: 'lastName', label: 'Priezvisko', type: 'string', visible: true },
    { id: 'email', label: 'E-mailová adresa', type: 'string', visible: true },
    { id: 'contactPhoneNumber', label: 'Telefónne číslo', type: true, visible: true }, 
    { id: 'billing.clubName', label: 'Názov klubu', type: 'string', visible: true },
    { id: 'billing.ico', label: 'IČO', type: 'string', visible: true },
    { id: 'billing.dic', label: 'DIČ', type: 'string', visible: true },
    { id: 'billing.icDph', label: 'IČ DPH', type: 'string', visible: true },
    { id: 'street', label: 'Ulica', type: 'string', visible: true },
    { id: 'houseNumber', label: 'Číslo domu', type: 'string', visible: true },
    { id: 'city', label: 'Mesto/Obec', type: 'string', visible: true },
    { id: 'postalCode', label: 'PSČ', type: 'string', visible: true },
    { id: 'country', label: 'Krajina', type: 'string', visible: true },
    { id: 'teams', label: 'Tímy', type: 'nested', visible: true }, // NOVINKA: Stĺpec pre tímy
  ];
  const [columnOrder, setColumnOrder] = React.useState(defaultColumnOrder);
  const [hoveredColumn, setHoveredColumn] = React.useState(null);
  const [showColumnVisibilityModal, setShowColumnVisibilityModal] = React.useState(false);


  // Lokálny Auth Listener pre AllRegistrationsApp
  // Tento useEffect čaká na to, kým authentication.js nastaví globálne auth a db.
  React.useEffect(() => {
    const checkGlobalAuthReady = () => {
      if (window.isGlobalAuthReady && window.auth && window.db) {
        setIsAuthReady(true);
        setUser(window.auth.currentUser);
        // Deep compare userProfileData here as well to prevent unnecessary re-renders
        if (JSON.stringify(userProfileData) !== JSON.stringify(window.globalUserProfileData)) {
            setUserProfileData(window.globalUserProfileData); // Nastavíme dáta z globálneho zdroja
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
      }, 100); // Kontroluj každých 100 ms

      // Listener na udalosť 'globalDataUpdated' ak sa dáta zmenia dynamicky
      const handleGlobalDataUpdate = (event) => {
        console.log('AllRegistrationsApp: Prijatá udalosť "globalDataUpdated". Aktualizujem lokálny stav.');
        setIsAuthReady(true);
        setUser(window.auth?.currentUser || null);
        // Deep compare userProfileData to prevent unnecessary re-renders
        if (JSON.stringify(userProfileData) !== JSON.stringify(event.detail)) {
            setUserProfileData(event.detail); // Toto je primárny zdroj aktualizácie userProfileData
        }
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
            // userProfileData sa už nastavuje cez globalDataUpdated, netreba tu znova
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
  }, [userProfileData]); // Pridal som userProfileData ako závislosť pre deep compare


  // Effect for fetching all users from Firestore and column order
  // Pre stabilitu závislostí sme premenné pre role a approved vytiahli mimo objekt userProfileData
  const userRole = userProfileData?.role;
  const userApproved = userProfileData?.approved;

  React.useEffect(() => {
    let unsubscribeAllUsers;
    let unsubscribeColumnOrder;
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'; 

    console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Triggered.");
    console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] State Snapshot - db:", !!db, "user:", user ? user.uid : "N/A", "userProfileData:", !!userProfileData, "role:", userRole, "approved:", userApproved, "isAuthReady:", isAuthReady);


    if (isAuthReady && db && user && user.uid && userProfileData && userRole === 'admin' && userApproved === true) {
        console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Conditions met: Approved Admin. Proceeding to fetch data.");
        // Zobraziť globálny loader, ak je funkcia dostupná
        if (typeof window.showGlobalLoader === 'function') {
          window.showGlobalLoader();
        }

        // --- Načítanie poradia stĺpcov pre aktuálneho admina ---
        try {
            // Používame Firebase v9 modulárnu syntax
            const columnOrderDocRef = doc(collection(db, 'users', user.uid, 'columnOrder'), 'columnOrder');

            console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Attempting to set up onSnapshot for columnOrder at path:", columnOrderDocRef.path);
            unsubscribeColumnOrder = onSnapshot(columnOrderDocRef, docSnapshot => {
                console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] columnOrder onSnapshot received data. Exists:", docSnapshot.exists());
                let newOrderToSet = defaultColumnOrder;

                if (docSnapshot.exists()) {
                    const savedOrder = docSnapshot.data().order;
                    console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Raw savedOrder from Firestore:", savedOrder);

                    if (savedOrder && Array.isArray(savedOrder) && savedOrder.length > 0) {
                        // Vytvoríme mapu pre rýchle vyhľadávanie uložených nastavení (hlavne pre viditeľnosť)
                        const savedSettingsMap = new Map(savedOrder.map(col => [col.id, col]));
                        
                        // Zlúčime predvolené definície stĺpcov s uloženými nastaveniami viditeľnosti
                        let mergedOrder = defaultColumnOrder.map(defaultCol => {
                            const savedColSettings = savedSettingsMap.get(defaultCol.id);
                            if (savedColSettings) {
                                // Ak existujú uložené nastavenia, použijeme ich pre 'visible',
                                // ale 'label' VŽDY prevezmeme z 'defaultCol' (predvolenej definície)
                                return {
                                    ...defaultCol,
                                    visible: savedColSettings.visible !== undefined ? savedColSettings.visible : true
                                };
                            }
                            // Ak nie sú uložené nastavenia, použijeme len predvolenú definíciu
                            return defaultCol;
                        });

                        // Vytvoríme finálne poradie stĺpcov na základe 'savedOrder'
                        // Ak sa stĺpec nachádza v savedOrder, použijeme jeho pozíciu.
                        // Ak nie, pridáme ho na koniec, ak nie je už v mergedOrder.
                        const finalOrder = [];
                        savedOrder.forEach(savedCol => {
                            const foundMergedCol = mergedOrder.find(mCol => mCol.id === savedCol.id);
                            if (foundMergedCol) {
                                finalOrder.push(foundMergedCol);
                            }
                        });

                        // Pridáme všetky stĺpce z defaultColumnOrder, ktoré neboli v savedOrder, na koniec
                        defaultColumnOrder.forEach(defaultCol => {
                            if (!finalOrder.some(fCol => fCol.id === defaultCol.id)) { 
                                finalOrder.push(defaultCol);
                            }
                        });

                        newOrderToSet = finalOrder;
                        console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Zlúčené a preusporiadané uložené poradie:", newOrderToSet);
                    } else {
                        console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Uložené poradie je prázdne alebo poškodené. Používam predvolené a ukladám ho.");
                        // Používame Firebase v9 modulárnu syntax
                        setDoc(doc(collection(db, 'users', user.uid, 'columnOrder'), 'columnOrder'), { order: defaultColumnOrder }, { merge: true })
                            .then(() => console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Uložené predvolené poradie do Firestore (prázdne/poškodené)."))
                            .catch(e => console.error("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Chyba pri ukladaní predvoleného poradia (prázdne/poškodené):", e));
                    }
                } else {
                    console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Dokument poradia stĺpcov neexistuje. Používam predvolené a ukladám ho.");
                    // Používame Firebase v9 modulárnu syntax
                    setDoc(doc(collection(db, 'users', user.uid, 'columnOrder'), 'columnOrder'), { order: defaultColumnOrder }, { merge: true })
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
                const usersData = snapshot.docs.map(doc => ({ // doc from snapshot is a QueryDocumentSnapshot, not the doc function
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
        console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] User is null, not fetching data. Redirecting to login.html.");
        if (typeof window.hideGlobalLoader === 'function') {
          window.hideGlobalLoader();
        }
        window.location.href = 'login.html';
        return;
    } else {
        // Skryť loader aj ak používateľ nie je admin alebo nie je schválený, ale už máme info
        if (typeof window.hideGlobalLoader === 'function') {
            window.hideGlobalLoader();
        }
        console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Conditions not met for fetching data. Waiting for state updates or no action taken.");
    }

    // Dependencies now reflect the derived stable values or primitives
  }, [db, user, isAuthReady, userRole, userApproved, JSON.stringify(defaultColumnOrder)]); // defaultColumnOrder ako závislosť (stringifikované pre stabilitu)


  // NOVINKA: useEffect pre sledovanie šírky menu-spacer a okna
  React.useEffect(() => {
    const updateWidths = () => {
      const menuSpacerElement = document.getElementById('menu-spacer');
      if (menuSpacerElement) {
        setMenuSpacerWidth(menuSpacerElement.offsetWidth);
      }
      setWindowWidth(window.innerWidth);
    };

    updateWidths(); // Nastav počiatočné šírky

    window.addEventListener('resize', updateWidths);
    // NOVINKA: Použijeme MutationObserver na sledovanie zmien atribútov (class) na menu-spacer
    const menuSpacerElement = document.getElementById('menu-spacer');
    let observer;
    if (menuSpacerElement) {
        observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    console.log("AllRegistrationsApp: MutationObserver - Zmena triedy menu-spacer. Aktualizujem šírky.");
                    updateWidths(); // Ak sa zmenia triedy (w-16, w-64), aktualizuj šírky
                }
            });
        });
        observer.observe(menuSpacerElement, { attributes: true });
    }

    return () => {
      window.removeEventListener('resize', updateWidths);
      if (observer) {
          observer.disconnect();
      }
    };
  }, []);

  // NOVINKA: useEffect pre výpočet paddingu content-wrapperu
  React.useEffect(() => {
    const updateContentPadding = () => {
        const contentWrapper = document.querySelector('.content-wrapper');
        if (contentWrapper) {
            const style = window.getComputedStyle(contentWrapper);
            const newPadding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
            if (newPadding !== contentPaddingX) { // Aktualizujeme len ak sa hodnota zmenila
                console.log("AllRegistrationsApp: Aktualizujem contentPaddingX:", newPadding);
                setContentPaddingX(newPadding);
            }
        } else {
            if (contentPaddingX !== 0) { // Reset, ak wrapper zmizne
                console.log("AllRegistrationsApp: content-wrapper chýba, resetujem contentPaddingX na 0.");
                setContentPaddingX(0);
            }
        }
    };

    updateContentPadding(); // Počiatočný výpočet
    window.addEventListener('resize', updateContentPadding); // Aktualizácia pri zmene veľkosti okna

    // Sledujeme aj zmeny atribútov (tried) na content-wrapper, ak by sa padding menil cez Tailwind triedy
    const contentWrapperElement = document.querySelector('.content-wrapper');
    let observer;
    if (contentWrapperElement) {
        observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    console.log("AllRegistrationsApp: MutationObserver - Zmena triedy content-wrapper. Aktualizujem padding.");
                    updateContentPadding(); 
                }
            });
        });
        observer.observe(contentWrapperElement, { attributes: true });
    }

    return () => {
        window.removeEventListener('resize', updateContentPadding);
        if (observer) {
            observer.disconnect();
        }
    };
  }, [contentPaddingX]); // Pridal som contentPaddingX ako závislosť pre re-run, ak sa sám zmení (pre konzistenciu)


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

          // NOVINKA: getNestedValue už je definované globálne, netreba tu znova
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

  // Filtering logic
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

  // Effect to re-apply filters when activeFilters or allUsers change
  React.useEffect(() => {
      let currentFiltered = [...allUsers];

      Object.keys(activeFilters).forEach(column => {
          const filterValues = activeFilters[column];
          if (filterValues.length > 0) {
              currentFiltered = currentFiltered.filter(user => {
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
      setFilteredUsers(currentFiltered);
  }, [allUsers, activeFilters]);


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
        const columnOrderDocRef = doc(collection(db, 'users', user.uid, 'columnOrder'), 'columnOrder');
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
        const columnOrderDocRef = doc(collection(db, 'users', user.uid, 'columnOrder'), 'columnOrder');
        try {
            await setDoc(columnOrderDocRef, { order: updatedColumns }, { merge: true });
            setUserNotificationMessage("Viditeľnosť stĺpcov bola úspešne uložená.", 'success');
        } catch (e) {
            console.error("AllRegistrationsApp: Chyba pri ukladaní viditeľnosti stĺpcov do Firestore:", e);
            setUserNotificationMessage(`Chyba pri ukladaní viditeľnosti stĺpcov: ${e.message}`, 'error');
        }
    }
  };

  // Dynamický výpočet šírky pre biely obdĺžnik
  const calculateContentWidth = React.useCallback(() => {
    // Používame stav pre padding
    let availableWidth = windowWidth;

    // Odpočítanie šírky menu-spacer, ak nie sme na mobilnom zobrazení
    // (Predpokladáme, že breakpoint pre mobil je 768px, ako v CSS media queries)
    if (windowWidth > 768) { 
        availableWidth -= menuSpacerWidth;
    }

    // Odpočítanie horizontálneho paddingu z .content-wrapper
    // Tento padding je na oboch stranách content-wrapper, takže ho odčítame.
    availableWidth -= contentPaddingX;
    
    const maxWidthLimit = 1200; // Maximálna šírka bieleho obdĺžnika
    const minWidthLimit = 300; // Minimálna šírka bieleho obdĺžnika, aby sa nerozpadol

    let finalWidth = Math.min(availableWidth, maxWidthLimit);
    finalWidth = Math.max(finalWidth, minWidthLimit);

    return `${finalWidth}px`;
  }, [windowWidth, menuSpacerWidth, contentPaddingX]); // Závisí od týchto stavov

  const dynamicWidth = React.useMemo(() => calculateContentWidth(), [calculateContentWidth]);

  // NOVINKA: Funkcia na prepínanie rozbalených riadkov
  const toggleRowExpansion = (userId) => {
    setExpandedRows(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  // Ak sa isAuthReady ešte nenastavilo na true, alebo user je null/undefined, nič nevykresľujeme.
  if (!isAuthReady || user === undefined || user === null || userProfileData === null) { // Pridal som userProfileData === null
      console.log("AllRegistrationsApp: Čakám na inicializáciu Auth/User/ProfileData. isAuthReady:", isAuthReady, "user:", user, "userProfileData:", userProfileData);
      if (typeof window.showGlobalLoader === 'function') {
        window.showGlobalLoader();
      }
      return null;
  }
  
  // Až po tom, čo je user plne inicializovaný a máme userProfileData, môžeme kontrolovať rolu.
  // Ak userProfileData nie je k dispozícii, alebo nie je admin/schválený, presmerujeme/zobrazíme chybu.
  if (!userProfileData || userRole !== 'admin' || userApproved === false) {
      console.log("AllRegistrationsApp: Používateľ nie je schválený administrátor alebo dáta profilu chýbajú. Presmerovávam na logged-in-my-data.html.");
      // Skryť loader aj pri presmerovaní
      if (typeof window.hideGlobalLoader === 'function') {
        window.hideGlobalLoader();
      }
      window.location.href = 'logged-in-my-data.html';
      return null; // Zabezpečí, že sa nič nevykreslí pred presmerovaním
  }


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
        onClearFilter: clearFilter,
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
      { 
        // Triedy pre biely obdĺžnik definované tu
        className: 'bg-white p-8 rounded-lg shadow-xl', 
        style: { width: dynamicWidth } // Dynamicky nastavená šírka
      },
      error && React.createElement(
        'div',
        { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap', role: 'alert' },
        error
      ),
      React.createElement('h1', { className: 'text-3xl font-bold text-center text-gray-800 mb-6' },
        'Všetky registrácie'
      ),
      React.createElement(
          'div',
          { className: 'flex justify-end mb-4' },
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
                      columnOrder.filter(col => col.visible).map((col, index) => (
                          React.createElement('th', { 
                              key: col.id, 
                              scope: 'col', 
                              className: 'py-3 px-6 cursor-pointer relative group',
                              onClick: col.id !== 'teams' ? () => handleSort(col.id) : undefined, // Len ak stĺpec nie je 'teams'
                              onMouseEnter: () => setHoveredColumn(col.id),
                              onMouseLeave: () => setHoveredColumn(null)
                          },
                              React.createElement('div', { className: 'flex flex-col items-center justify-center h-full' },
                                  React.createElement('div', { className: 'flex items-center space-x-1 mb-1' },
                                      index > 0 && React.createElement('button', {
                                          onClick: (e) => { e.stopPropagation(); moveColumn(col.id, 'left'); },
                                          className: `text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 ${hoveredColumn === col.id ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200`
                                      }, '←'),
                                      col.id !== 'teams' && React.createElement('button', { // Filter tlačidlo len pre bežné stĺpce
                                          onClick: (e) => { e.stopPropagation(); openFilterModal(col.id); }, 
                                          className: `text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 ${activeFilters[col.id] && activeFilters[col.id].length > 0 ? 'opacity-100 text-blue-500' : 'opacity-0 group-hover:opacity-100'} transition-opacity duration-200`
                                      }, '⚙️'),
                                      index < columnOrder.filter(c => c.visible).length - 1 && React.createElement('button', {
                                          onClick: (e) => { e.stopPropagation(); moveColumn(col.id, 'right'); },
                                          className: `text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 ${hoveredColumn === col.id ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200`
                                      }, '→')
                                  ),
                                  React.createElement('span', { className: 'flex items-center' },
                                      col.label,
                                      currentSort.column === col.id && col.id !== 'teams' && React.createElement('span', { className: 'ml-1' }, currentSort.direction === 'asc' ? '▲' : '▼')
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
                          React.createElement('td', { colSpan: columnOrder.filter(c => c.visible).length, className: 'py-4 px-6 text-center text-gray-500' }, 'Žiadne registrácie na zobrazenie.')
                      )
                  ) : (
                      filteredUsers.map(u => (
                          React.createElement(React.Fragment, { key: u.id },
                              React.createElement(
                                  'tr',
                                  { className: 'bg-white border-b hover:bg-gray-50' },
                                  columnOrder.filter(col => col.visible).map(col => (
                                      React.createElement('td', { key: col.id, className: 'py-3 px-6 text-left' }, 
                                          col.id === 'registrationDate' && getNestedValue(u, col.id) && typeof getNestedValue(u, col.id).toDate === 'function' ? getNestedValue(u, col.id).toDate().toLocaleString('sk-SK') :
                                          col.id === 'approved' ? (getNestedValue(u, col.id) ? 'Áno' : 'Nie') :
                                          col.id === 'postalCode' ? formatPostalCode(getNestedValue(u, col.id)) :
                                          col.id === 'teams' ? ( // NOVINKA: Tlačidlo pre rozbalenie tímov
                                              Object.keys(u.teams || {}).length > 0 ? 
                                              React.createElement('button', {
                                                  onClick: () => toggleRowExpansion(u.id),
                                                  className: 'text-blue-600 hover:text-blue-800 font-semibold'
                                              }, expandedRows[u.id] ? 'Skryť tímy ▲' : 'Zobraziť tímy ▼')
                                              : 'Žiadne tímy'
                                          ) :
                                          // NOVINKA: Robustnejšie spracovanie dát - konvertuje objekty na JSON reťazce
                                          (typeof getNestedValue(u, col.id) === 'object' && getNestedValue(u, col.id) !== null 
                                            ? JSON.stringify(getNestedValue(u, col.id), null, 2) 
                                            : getNestedValue(u, col.id) || '-')
                                      )
                                  ))
                              ),
                              // NOVINKA: Podtabuľka s detailmi tímov
                              expandedRows[u.id] && u.teams && Object.keys(u.teams).length > 0 &&
                                Object.keys(u.teams).map(teamCategory => 
                                    (u.teams[teamCategory] && Array.isArray(u.teams[teamCategory])) && 
                                    u.teams[teamCategory].map((team, teamIdx) => 
                                        React.createElement(TeamDetailsRow, {
                                            key: `${u.id}-${teamCategory}-${teamIdx}`,
                                            team: team,
                                            colSpan: columnOrder.filter(c => c.visible).length,
                                            teamCategory: teamCategory
                                        })
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
