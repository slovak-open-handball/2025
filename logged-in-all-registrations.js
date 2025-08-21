// logged-in-all-registrations.js
// Tento súbor predpokladá, že Firebase SDK je inicializovaný v <head> logged-in-all-registrations.html
// a GlobalNotificationHandler v header.js spravuje globálnu autentifikáciu a stav používateľa.

// Importy pre potrebné Firebase funkcie v modularizovanom štýle (Firebase v9+)
import { getFirestore, doc, collection, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";


// NotificationModal Component for displaying temporary messages (converted to React.createElement)
// Ponechané pre zobrazovanie správ o spätnej väzbe pre používateľa v tomto module.
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

// Helper function for formatting postal code
const formatPostalCode = (postalCode) => {
    if (!postalCode) return '-';
    const cleaned = String(postalCode).replace(/\s/g, ''); // Odstráni existujúce medzery
    if (cleaned.length === 5) {
      return `${cleaned.substring(0, 3)} ${cleaned.substring(3, 5)}`;
    }
    return postalCode; // Vráti pôvodné, ak nemá 5 číslic
};

// Helper function to get nested value from an object
const getNestedValue = (obj, path) => {
    return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined) ? acc[part] : undefined, obj);
};

// Helper for formatting a generic address object
const formatAddress = (address) => {
    if (!address) return '-';
    const parts = [];
    if (address.street) parts.push(address.street);
    if (address.houseNumber) parts.push(address.houseNumber);
    if (address.postalCode) parts.push(formatPostalCode(address.postalCode));
    if (address.city) parts.push(address.city);
    if (address.country) parts.push(address.country);
    return parts.filter(Boolean).join(', '); // Filter Boolean to remove empty strings
};

// Helper for formatting meal details
const formatMeals = (mealsMap) => {
    if (!mealsMap || Object.keys(mealsMap).length === 0) return 'Žiadne jedlá';
    const mealSummaries = [];
    for (const date in mealsMap) {
        const dayMeals = mealsMap[date];
        const daySummary = Object.keys(dayMeals).map(mealType => `${dayMeals[mealType]}x ${mealType}`).join(', ');
        if (daySummary) mealSummaries.push(`${new Date(date).toLocaleDateString('sk-SK')}: (${daySummary})`);
    }
    return mealSummaries.join('; ');
};

// Helper for formatting t-shirt details
const formatTshirts = (tshirtsArray) => {
    if (!tshirtsArray || tshirtsArray.length === 0) return 'Žiadne tričká';
    return tshirtsArray.map(t => `${t.quantity}x ${t.size}`).join(', ');
};

// New Component for rendering user's detailed data (nested table)
function UserDetailsTable({ user }) {
    return React.createElement(
        'div',
        { className: 'bg-white p-4 rounded-lg shadow-inner border border-gray-200' },
        // Kategórie Section
        user.categories && Object.keys(user.categories).length > 0 &&
        React.createElement(
            'div',
            { className: 'mb-6' },
            React.createElement('h4', { className: 'text-xl font-bold text-gray-800 mb-3 border-b pb-2' }, 'Kategórie'),
            React.createElement(
                'div',
                { className: 'overflow-x-auto' },
                React.createElement(
                    'table',
                    { className: 'min-w-full bg-white border border-gray-200 rounded-md' },
                    React.createElement(
                        'thead',
                        null,
                        React.createElement(
                            'tr',
                            { className: 'bg-gray-100 text-gray-600 text-xs uppercase' },
                            React.createElement('th', { className: 'py-2 px-4 border-b text-left' }, 'Názov kategórie'),
                            React.createElement('th', { className: 'py-2 px-4 border-b text-left' }, 'Počet tímov')
                        )
                    ),
                    React.createElement(
                        'tbody',
                        null,
                        Object.entries(user.categories).map(([categoryId, categoryData]) => (
                            React.createElement(
                                'tr',
                                { key: categoryId, className: 'border-b last:border-b-0 hover:bg-gray-50' },
                                React.createElement('td', { className: 'py-2 px-4' }, categoryId),
                                React.createElement('td', { className: 'py-2 px-4' }, categoryData.numberOfTeams || '-')
                            )
                        ))
                    )
                )
            )
        ),

        // Tímy Section
        user.teams && Object.keys(user.teams).length > 0 &&
        React.createElement(
            'div',
            null,
            React.createElement('h4', { className: 'text-xl font-bold text-gray-800 mb-3 border-b pb-2' }, 'Tímy'),
            Object.entries(user.teams).map(([categoryName, teamsArray]) => (
                React.createElement(
                    'div',
                    { key: categoryName, className: 'mb-6 border border-blue-200 rounded-md p-4 bg-blue-50' },
                    React.createElement('h5', { className: 'text-lg font-semibold mb-3 text-blue-800' }, `Kategória tímu: ${categoryName}`),
                    teamsArray.map((team, teamIndex) => (
                        React.createElement(
                            'div',
                            { key={`${categoryName}-${teamIndex}`, className: 'mb-4 p-4 bg-white rounded-md shadow-sm border border-gray-100 last:mb-0' },
                            React.createElement('p', { className: 'font-bold text-gray-700 text-base mb-2' }, `Názov tímu: ${team.teamName || '-'}`),
                            React.createElement('ul', { className: 'list-disc list-inside space-y-1 text-gray-700 text-sm mb-4' },
                                React.createElement('li', null, `Počet hráčov: ${team.players || '-'}`),
                                React.createElement('li', null, `Tričká: ${formatTshirts(team.tshirts)}`),
                                React.createElement('li', null, `Ubytovanie: ${team.accommodation?.type || '-'}`),
                                React.createElement('li', null, `Príchod: ${team.arrival?.type || '-'}`),
                            ),
                            
                            // Detaily Balíčka
                            team.packageDetails && React.createElement(
                                'div',
                                { className: 'ml-4 mt-2 p-3 bg-gray-50 rounded-md border border-gray-200' },
                                React.createElement('h6', { className: 'font-semibold text-gray-700 mb-2 text-md' }, 'Detaily balíčka:'),
                                React.createElement('ul', { className: 'list-disc list-inside space-y-1 text-gray-600 text-sm' },
                                    React.createElement('li', null, `Názov: ${team.packageDetails.name || '-'}`),
                                    React.createElement('li', null, `Cena: ${team.packageDetails.price ? `${team.packageDetails.price} €` : '-'}`),
                                    React.createElement('li', null, `Účastnícka karta: ${team.packageDetails.participantCard ? 'Áno' : 'Nie'}`),
                                    React.createElement('li', null, `Stravovanie: ${formatMeals(team.packageDetails.meals)}`)
                                )
                            ),

                            // Detaily Hráčov
                            team.playerDetails && team.playerDetails.length > 0 && React.createElement(
                                'div',
                                { className: 'ml-4 mt-4 p-3 bg-gray-50 rounded-md border border-gray-200' },
                                React.createElement('h6', { className: 'font-semibold text-gray-700 mb-2 text-md' }, 'Detaily hráčov:'),
                                React.createElement(
                                    'div',
                                    { className: 'overflow-x-auto' },
                                    React.createElement(
                                        'table',
                                        { className: 'min-w-full bg-white border border-gray-200 text-xs rounded-md' },
                                        React.createElement(
                                            'thead',
                                            null,
                                            React.createElement(
                                                'tr',
                                                { className: 'bg-gray-100 text-gray-600 uppercase' },
                                                React.createElement('th', { className: 'py-1 px-2 border-b text-left' }, 'Meno'),
                                                React.createElement('th', { className: 'py-1 px-2 border-b text-left' }, 'Priezvisko'),
                                                React.createElement('th', { className: 'py-1 px-2 border-b text-left' }, 'Dátum nar.'),
                                                React.createElement('th', { className: 'py-1 px-2 border-b text-left' }, 'Dres'),
                                                React.createElement('th', { className: 'py-1 px-2 border-b text-left' }, 'Reg.č.'),
                                                React.createElement('th', { className: 'py-1 px-2 border-b text-left' }, 'Adresa')
                                            )
                                        ),
                                        React.createElement(
                                            'tbody',
                                            null,
                                            team.playerDetails.map((player, pIndex) => (
                                                React.createElement(
                                                    'tr',
                                                    { key:`player-${pIndex}`, className: 'border-b last:border-b-0 hover:bg-gray-50' },
                                                    React.createElement('td', { className: 'py-1 px-2' }, player.firstName || '-'),
                                                    React.createElement('td', { className: 'py-1 px-2' }, player.lastName || '-'),
                                                    React.createElement('td', { className: 'py-1 px-2' }, player.dateOfBirth || '-'),
                                                    React.createElement('td', { className: 'py-1 px-2' }, player.jerseyNumber || '-'),
                                                    React.createElement('td', { className: 'py-1 px-2' }, player.registrationNumber || '-'),
                                                    React.createElement('td', { className: 'py-1 px-2' }, formatAddress(player.address))
                                                )
                                            ))
                                        )
                                    )
                                )
                            ),
                            
                            // Detaily Členiek tímu (ženy)
                            team.womenTeamMemberDetails && team.womenTeamMemberDetails.length > 0 && React.createElement(
                                'div',
                                { className: 'ml-4 mt-4 p-3 bg-gray-50 rounded-md border border-gray-200' },
                                React.createElement('h6', { className: 'font-semibold text-gray-700 mb-2 text-md' }, 'Detaily členiek tímu (ženy):'),
                                React.createElement(
                                    'div',
                                    { className: 'overflow-x-auto' },
                                    React.createElement(
                                        'table',
                                        { className: 'min-w-full bg-white border border-gray-200 text-xs rounded-md' },
                                        React.createElement(
                                            'thead',
                                            null,
                                            React.createElement(
                                                'tr',
                                                { className: 'bg-gray-100 text-gray-600 uppercase' },
                                                React.createElement('th', { className: 'py-1 px-2 border-b text-left' }, 'Meno'),
                                                React.createElement('th', { className: 'py-1 px-2 border-b text-left' }, 'Priezvisko'),
                                                React.createElement('th', { className: 'py-1 px-2 border-b text-left' }, 'Dátum nar.'),
                                                React.createElement('th', { className: 'py-1 px-2 border-b text-left' }, 'Adresa')
                                            )
                                        ),
                                        React.createElement(
                                            'tbody',
                                            null,
                                            team.womenTeamMemberDetails.map((member, mIndex) => (
                                                React.createElement(
                                                    'tr',
                                                    { key:`w-member-${mIndex}`, className: 'border-b last:border-b-0 hover:bg-gray-50' },
                                                    React.createElement('td', { className: 'py-1 px-2' }, member.firstName || '-'),
                                                    React.createElement('td', { className: 'py-1 px-2' }, member.lastName || '-'),
                                                    React.createElement('td', { className: 'py-1 px-2' }, member.dateOfBirth || '-'),
                                                    React.createElement('td', { className: 'py-1 px-2' }, formatAddress(member.address))
                                                )
                                            ))
                                        )
                                    )
                                )
                            ),

                            // Detaily Členov tímu (muži)
                            team.menTeamMemberDetails && team.menTeamMemberDetails.length > 0 && React.createElement(
                                'div',
                                { className: 'ml-4 mt-4 p-3 bg-gray-50 rounded-md border border-gray-200' },
                                React.createElement('h6', { className: 'font-semibold text-gray-700 mb-2 text-md' }, 'Detaily členov tímu (muži):'),
                                React.createElement(
                                    'div',
                                    { className: 'overflow-x-auto' },
                                    React.createElement(
                                        'table',
                                        { className: 'min-w-full bg-white border border-gray-200 text-xs rounded-md' },
                                        React.createElement(
                                            'thead',
                                            null,
                                            React.createElement(
                                                'tr',
                                                { className: 'bg-gray-100 text-gray-600 uppercase' },
                                                React.createElement('th', { className: 'py-1 px-2 border-b text-left' }, 'Meno'),
                                                React.createElement('th', { className: 'py-1 px-2 border-b text-left' }, 'Priezvisko'),
                                                React.createElement('th', { className: 'py-1 px-2 border-b text-left' }, 'Dátum nar.'),
                                                React.createElement('th', { className: 'py-1 px-2 border-b text-left' }, 'Adresa')
                                            )
                                        ),
                                        React.createElement(
                                            'tbody',
                                            null,
                                            team.menTeamMemberDetails.map((member, mIndex) => (
                                                React.createElement(
                                                    'tr',
                                                    { key:`m-member-${mIndex}`, className: 'border-b last:border-b-0 hover:bg-gray-50' },
                                                    React.createElement('td', { className: 'py-1 px-2' }, member.firstName || '-'),
                                                    React.createElement('td', { className: 'py-1 px-2' }, member.lastName || '-'),
                                                    React.createElement('td', { className: 'py-1 px-2' }, member.dateOfBirth || '-'),
                                                    React.createElement('td', { className: 'py-1 px-2' }, formatAddress(member.address))
                                                )
                                            ))
                                        )
                                    )
                                )
                            ),

                            // Detaily vodičov (ženy)
                            team.driverDetailsFemale && team.driverDetailsFemale.length > 0 && React.createElement(
                                'div',
                                { className: 'ml-4 mt-4 p-3 bg-gray-50 rounded-md border border-gray-200' },
                                React.createElement('h6', { className: 'font-semibold text-gray-700 mb-2 text-md' }, 'Detaily vodičiek (ženy):'),
                                React.createElement(
                                    'div',
                                    { className: 'overflow-x-auto' },
                                    React.createElement(
                                        'table',
                                        { className: 'min-w-full bg-white border border-gray-200 text-xs rounded-md' },
                                        React.createElement(
                                            'thead',
                                            null,
                                            React.createElement(
                                                'tr',
                                                { className: 'bg-gray-100 text-gray-600 uppercase' },
                                                React.createElement('th', { className: 'py-1 px-2 border-b text-left' }, 'Meno'),
                                                React.createElement('th', { className: 'py-1 px-2 border-b text-left' }, 'Priezvisko'),
                                                React.createElement('th', { className: 'py-1 px-2 border-b text-left' }, 'Adresa')
                                            )
                                        ),
                                        React.createElement(
                                            'tbody',
                                            null,
                                            team.driverDetailsFemale.map((driver, dIndex) => (
                                                React.createElement(
                                                    'tr',
                                                    { key:`f-driver-${dIndex}`, className: 'border-b last:border-b-0 hover:bg-gray-50' },
                                                    React.createElement('td', { className: 'py-1 px-2' }, driver.firstName || '-'),
                                                    React.createElement('td', { className: 'py-1 px-2' }, driver.lastName || '-'),
                                                    React.createElement('td', { className: 'py-1 px-2' }, formatAddress(driver.address))
                                                )
                                            ))
                                        )
                                    )
                                )
                            ),

                            // Detaily vodičov (muži)
                            team.driverDetailsMale && team.driverDetailsMale.length > 0 && React.createElement(
                                'div',
                                { className: 'ml-4 mt-4 p-3 bg-gray-50 rounded-md border border-gray-200' },
                                React.createElement('h6', { className: 'font-semibold text-gray-700 mb-2 text-md' }, 'Detaily vodičov (muži):'),
                                React.createElement(
                                    'div',
                                    { className: 'overflow-x-auto' },
                                    React.createElement(
                                        'table',
                                        { className: 'min-w-full bg-white border border-gray-200 text-xs rounded-md' },
                                        React.createElement(
                                            'thead',
                                            null,
                                            React.createElement(
                                                'tr',
                                                { className: 'bg-gray-100 text-gray-600 uppercase' },
                                                React.createElement('th', { className: 'py-1 px-2 border-b text-left' }, 'Meno'),
                                                React.createElement('th', { className: 'py-1 px-2 border-b text-left' }, 'Priezvisko'),
                                                React.createElement('th', { className: 'py-1 px-2 border-b text-left' }, 'Adresa')
                                            )
                                        ),
                                        React.createElement(
                                            'tbody',
                                            null,
                                            team.driverDetailsMale.map((driver, dIndex) => (
                                                React.createElement(
                                                    'tr',
                                                    { key:`m-driver-${dIndex}`, className: 'border-b last:border-b-0 hover:bg-gray-50' },
                                                    React.createElement('td', { className: 'py-1 px-2' }, driver.firstName || '-'),
                                                    React.createElement('td', { className: 'py-1 px-2' }, driver.lastName || '-'),
                                                    React.createElement('td', { className: 'py-1 px-2' }, formatAddress(driver.address))
                                                )
                                            ))
                                        )
                                    )
                                )
                            )
                        )
                    ))
                )
            )
        )
    );
}


// Main React component for the logged-in-all-registrations.html page
function AllRegistrationsApp() { // UZ NEPrijímame userProfileData ako prop
  // Získame referencie na Firebase služby pomocou getAuth() a getFirestore()
  const auth = getAuth();
  const db = getFirestore();

  // Lokálny stav pre aktuálneho používateľa a jeho profilové dáta
  const [user, setUser] = React.useState(null); 
  const [userProfileData, setUserProfileData] = React.useState(null); 
  const [isAuthReady, setIsAuthReady] = React.useState(false); 

  const [loadingUsers, setLoadingUsers] = React.useState(true); 
  const [loadingColumnOrder, setLoadingColumnOrder] = React.useState(true); 
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
  const [expandedRows, setExpandedRows] = React.useState({}); // Stav pre rozšírené riadky

  const defaultColumnOrder = [
    { id: 'role', label: 'Rola', type: 'string', visible: true },
    { id: 'approved', label: 'Schválený', type: 'boolean', visible: true },
    { id: 'registrationDate', label: 'Dátum registrácie', type: 'date', visible: true },
    { id: 'firstName', label: 'Meno', type: 'string', visible: true },
    { id: 'lastName', label: 'Priezvisko', type: 'string', visible: true },
    { id: 'email', label: 'Email', type: 'string', visible: true },
    { id: 'contactPhoneNumber', label: 'Tel. číslo', type: 'string', visible: true },
    { id: 'billing.clubName', label: 'Názov klubu', type: 'string', visible: true },
    { id: 'billing.ico', label: 'IČO', type: 'string', visible: true },
    { id: 'billing.dic', label: 'DIČ', type: 'string', visible: true },
    { id: 'billing.icDph', label: 'IČ DPH', type: 'string', visible: true },
    { id: 'street', label: 'Ulica', type: 'string', visible: true },
    { id: 'houseNumber', label: 'Číslo domu', type: 'string', visible: true },
    { id: 'city', label: 'Mesto', type: 'string', visible: true },
    { id: 'postalCode', label: 'PSČ', type: 'string', visible: true },
    { id: 'country', label: 'Krajina', type: 'string', visible: true },
  ];
  const [columnOrder, setColumnOrder] = React.useState(defaultColumnOrder);
  const [hoveredColumn, setHoveredColumn] = React.useState(null);
  const [showColumnVisibilityModal, setShowColumnVisibilityModal] = React.useState(false);

  // Funkcia na prepínanie rozšírenia riadku
  const toggleRow = (userId) => {
    setExpandedRows(prev => ({
        ...prev,
        [userId]: !prev[userId]
    }));
  };

  // Reakcia na globálne zmeny stavu autentifikácie a profilu
  React.useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(currentUser => {
      setUser(currentUser);
      setIsAuthReady(true); 
      if (!currentUser) {
        console.log("AllRegistrationsApp: Používateľ nie je prihlásený, presmerovávam na login.html.");
        window.location.href = 'login.html';
      }
    });

    const handleGlobalDataUpdated = (event) => {
      setUserProfileData(event.detail);
      // Skryjeme globálny loader, ak existuje a je zobrazený
      if (typeof window.hideGlobalLoader === 'function') {
        window.hideGlobalLoader();
      }
    };
    window.addEventListener('globalDataUpdated', handleGlobalDataUpdated);

    // Počiatočná kontrola, ak už sú dáta dostupné pri načítaní komponentu
    if (window.isGlobalAuthReady) {
        setIsAuthReady(true);
        setUser(auth.currentUser);
        if (window.globalUserProfileData) {
            setUserProfileData(window.globalUserProfileData);
            if (typeof window.hideGlobalLoader === 'function') {
                window.hideGlobalLoader();
            }
        }
    }

    return () => {
      unsubscribeAuth();
      window.removeEventListener('globalDataUpdated', handleGlobalDataUpdated);
    };
  }, []); 

  // Effect pre načítanie profilu používateľa a kontrolu oprávnení
  React.useEffect(() => {
    let unsubscribeUserDoc;

    if (user && db && isAuthReady) {
      console.log(`AllRegistrationsApp: Pokúšam sa načítať používateľský dokument pre UID: ${user.uid}`);
      setLoadingUsers(true); 

      try {
        const userDocRef = doc(db, 'users', user.uid);
        unsubscribeUserDoc = onSnapshot(userDocRef, docSnapshot => { 
          console.log("AllRegistrationsApp: Používateľský dokument existuje, dáta:", docSnapshot.data());

          if (docSnapshot.exists()) { 
            const userData = docSnapshot.data();
            setUserProfileData(userData);
            setLoadingUsers(false);

            if (userData.role !== 'admin' || userData.approved === false) {
                console.log("AllRegistrationsApp: Používateľ nie je schválený admin, presmerovávam na logged-in-my-data.html.");
                window.location.href = 'logged-in-my-data.html';
            }

          } else {
            console.warn("AllRegistrationsApp: Používateľský dokument sa nenašiel pre UID:", user.uid);
            // Ak sa dokument nenájde, odhlásime používateľa
            if (typeof window.showGlobalNotification === 'function') { 
                window.showGlobalNotification("Chyba: Používateľský profil sa nenašiel. Skúste sa prosím znova prihlásiť.", 'error');
            }
            setLoadingUsers(false);
            auth.signOut(); 
            setUser(null);
            setUserProfileData(null);
          }
        }, error => {
          console.error("AllRegistrationsApp: Chyba pri načítaní používateľských dát z Firestore (onSnapshot error):", error);
          if (typeof window.showGlobalNotification === 'function') { 
            window.showGlobalNotification(`Chyba pri načítaní používateľských dát: ${error.message}`, 'error');
          }
          setLoadingUsers(false);
          auth.signOut();
          setUser(null);
          setUserProfileData(null);
        });
      } catch (e) {
        console.error("AllRegistrationsApp: Chyba pri nastavovaní onSnapshot pre používateľské dáta (try-catch):", e);
        if (typeof window.showGlobalNotification === 'function') { 
            window.showGlobalNotification(`Chyba pri nastavovaní poslucháča pre používateľské dáta: ${e.message}`, 'error');
        }
        setLoadingUsers(false);
        auth.signOut();
        setUser(null);
        setUserProfileData(null);
      }
    } else if (isAuthReady && user === null) {
        setLoadingUsers(false);
        setUserProfileData(null);
    }

    return () => {
      if (unsubscribeUserDoc) {
        console.log("AllRegistrationsApp: Ruším odber onSnapshot pre používateľský dokument.");
        unsubscribeUserDoc();
      }
    };
  }, [user, db, isAuthReady, auth]);

  // Effect for fetching all users from Firestore and column order
  React.useEffect(() => {
    let unsubscribeAllUsers;
    let unsubscribeColumnOrder;
    // appId by mal byť globálne dostupný z HTML (ak je, inak použijeme default)
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'; 

    console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Triggered.");
    console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] State Snapshot - db:", !!db, "user:", !!user, "user.uid:", user ? user.uid : "N/A", "userProfileData:", !!userProfileData, "role:", userProfileData ? userProfileData.role : "N/A", "approved:", userProfileData ? userProfileData.approved : "N/A", "isAuthReady:", isAuthReady);

    // Kľúčová podmienka pre načítanie dát
    if (isAuthReady && db && user && user.uid && userProfileData && userProfileData.role === 'admin' && userProfileData.approved === true) {
        console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Conditions met: Approved Admin. Proceeding to fetch data.");
        setLoadingUsers(true); // Indicate loading for users
        setLoadingColumnOrder(true); // Indicate loading for column order

        // --- Načítanie poradia stĺpcov pre aktuálneho admina ---
        try {
            const columnOrderDocRef = doc(db, 'users', user.uid, 'columnOrder', 'columnOrder');
            console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Attempting to set up onSnapshot for columnOrder at path:", columnOrderDocRef.path);
            unsubscribeColumnOrder = onSnapshot(columnOrderDocRef, docSnapshot => {
                console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] columnOrder onSnapshot received data. Exists:", docSnapshot.exists);
                let newOrderToSet = defaultColumnOrder; // Predvolené poradie

                if (docSnapshot.exists()) {
                    const savedOrder = docSnapshot.data().order;
                    console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Raw savedOrder from Firestore:", savedOrder);

                    if (savedOrder && Array.isArray(savedOrder) && savedOrder.length > 0) {
                        let mergedOrder = [];
                        // 1. Pridajte stĺpce z savedOrder, zachovajte ich poradie a viditeľnosť
                        savedOrder.forEach(savedCol => {
                            const defaultColDef = defaultColumnOrder.find(dCol => dCol.id === savedCol.id);
                            if (defaultColDef) {
                                // Zlúčte uložené vlastnosti s predvolenými, prioritizujte uloženú viditeľnosť
                                mergedOrder.push({
                                    ...defaultColDef, // Získajte predvolený label, type atď.
                                    ...savedCol,      // Prepíšte uloženým ID, visible
                                    visible: savedCol.visible !== undefined ? savedCol.visible : true // Zabezpečte, že visible je boolean
                                });
                            } else {
                                // Ak ID uloženého stĺpca nie je v defaultColumnOrder, stále ho zahrňte
                                mergedOrder.push({ ...savedCol, visible: savedCol.visible !== undefined ? savedCol.visible : true });
                            }
                        });

                        // 2. Pridajte všetky predvolené stĺpce, ktoré NEBOLI v savedOrder
                        defaultColumnOrder.forEach(defaultCol => {
                            if (!mergedOrder.some(mCol => mCol.id === defaultCol.id)) {
                                mergedOrder.push(defaultCol); // Pridajte s jeho predvolenými vlastnosťami (vrátane visible: true)
                            }
                        });

                        newOrderToSet = mergedOrder;
                        console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Zlúčené a preusporiadané uložené poradie:", newOrderToSet);
                    } else {
                        // Dokument existuje, ale savedOrder je prázdny alebo poškodený.
                        // To znamená, že by sa mal resetovať na predvolené a uložiť.
                        console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Uložené poradie je prázdne alebo poškodené. Používam predvolené a ukladám ho.");
                        setDoc(columnOrderDocRef, { order: defaultColumnOrder }, { merge: true })
                            .then(() => console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Uložené predvolené poradie do Firestore (prázdne/poškodené)."))
                            .catch(e => console.error("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Chyba pri ukladaní predvoleného poradia (prázdne/poškodené):", e));
                    }
                } else {
                    // Dokument neexistuje. Nastavte predvolené a uložte ho.
                    console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Dokument poradia stĺpcov neexistuje. Používam predvolené a ukladám ho.");
                    setDoc(columnOrderDocRef, { order: defaultColumnOrder }, { merge: true })
                        .then(() => console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Uložené predvolené poradie do Firestore (dokument neexistoval)."))
                        .catch(e => console.error("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Chyba pri ukladaní predvoleného poradia (dokument neexistoval):", e));
                }
                
                setColumnOrder(newOrderToSet); // Vždy nastavte stav na základe určeného poradia
                setLoadingColumnOrder(false); // Poradie stĺpcov je načítané
            }, error => {
                console.error("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Chyba pri načítaní poradia stĺpcov z Firestore (onSnapshot error):", error);
                setError(`Chyba pri načítaní poradia stĺpcov: ${error.message}`);
                setColumnOrder(defaultColumnOrder); // Návrat na predvolené pri chybe
                setLoadingColumnOrder(false); // Načítanie poradia stĺpcov zlyhalo
            });
        } catch (e) {
            console.error("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Chyba pri nastavovaní onSnapshot pre poradie stĺpcov (try-catch):", e);
            setError(`Chyba pri inicializácii poradia stĺpcov: ${e.message}`);
            setColumnOrder(defaultColumnOrder);
            setLoadingColumnOrder(false); // Načítanie poradia stĺpcov zlyhalo
        }

        // --- Získanie všetkých používateľov z kolekcie 'users' ---
        try {
            unsubscribeAllUsers = onSnapshot(collection(db, 'users'), snapshot => {
                const usersData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Všetci používatelia načítaní:", usersData.length, "používateľov.");
                setAllUsers(usersData);
                setFilteredUsers(usersData);
                setLoadingUsers(false); // Users are loaded
            }, error => {
                console.error("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Chyba pri načítaní všetkých používateľov z Firestore:", error);
                setError(`Chyba pri načítaní používateľov: ${error.message}`);
                setLoadingUsers(false); // Users loading failed
                window.showGlobalNotification(`Chyba pri načítaní dát: ${error.message}`, 'error');
            });
        } catch (e) {
            console.error("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Chyba pri nastavovaní onSnapshot pre všetkých používateľov (try-catch):", e);
            setError(`Chyba pri načítaní používateľov: ${e.message}`);
            setLoadingUsers(false); // Users loading failed
            window.showGlobalNotification(`Chyba pri načítaní dát: ${e.message}`, 'error');
        }
    } else if (isAuthReady && user === null) {
        console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] User is null, not fetching data. Redirecting to login.html.");
        window.location.href = 'login.html';
    } else if (isAuthReady && userProfileData && (userProfileData.role !== 'admin' || userProfileData.approved === false)) {
        console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] User is not an approved admin, not fetching data. Redirecting to my-data.html.");
        setError("Nemáte oprávnenie na zobrazenie tejto stránky. Iba schválení administrátori majú prístup.");
        setLoadingUsers(false); // Ensure loading is false if not authorized
        setLoadingColumnOrder(false); // Ensure loading is false if not authorized
        window.showGlobalNotification("Nemáte oprávnenie na zobrazenie tejto stránky.", 'error');
        window.location.href = 'logged-in-my-data.html';
    } else {
        console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Conditions not met for fetching data. Waiting for state updates.");
        // If conditions are not met, ensure loading is false if it's stuck
        if (loadingUsers) setLoadingUsers(false);
        if (loadingColumnOrder) setLoadingColumnOrder(false);
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
  }, [db, userProfileData, isAuthReady, user]); // Dependencies: db, userProfileData, isAuthReady, user


  // Sorting logic
  const handleSort = (columnId) => {
      let direction = 'asc';
      if (currentSort.column === columnId && currentSort.direction === 'asc') {
          direction = 'desc';
      }
      setCurrentSort({ column: columnId, direction });

      const sorted = [...filteredUsers].sort((a, b) => {
          // Find the column definition to get its type
          const columnDef = columnOrder.find(col => col.id === columnId);
          // Log pre diagnostiku:
          console.log(`handleSort: Sorting by columnId: ${columnId}, Direction: ${direction}`);
          console.log(`handleSort: Found columnDef for ${columnId}:`, columnDef);

          const type = columnDef ? columnDef.type : 'string'; // Default to string if type not found

          let valA, valB;

          if (columnId.includes('.')) {
              valA = getNestedValue(a, columnId);
              valB = getNestedValue(b, columnId);
          } else {
              valA = a[columnId];
              valB = b[columnId];
          }

          // Log hodnoty pred porovnaním
          console.log(`handleSort: Comparing values for ${columnId} (type: ${type}): A=${valA}, B=${valB}`);


          // Convert to comparable types based on column type
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
          } else { // Default to string comparison
              return direction === 'asc' ? String(valA || '').localeCompare(String(valB || '')) : String(valB || '').localeCompare(String(valA || ''));
          }
      });
      setFilteredUsers(sorted);
      // Log prvých pár zoradených používateľov
      console.log("handleSort: First 5 sorted users:", sorted.slice(0, 5).map(u => ({ id: u.id, [columnId]: getNestedValue(u, columnId) })));
  };

  // Filtering logic
  const openFilterModal = (column) => {
      console.log("AllRegistrationsApp: openFilterModal volaná pre stĺpec:", column); // NOVÝ LOG
      console.log("AllRegistrationsApp: Aktuálny stav allUsers:", allUsers); // NOVÝ DIAGNOSTICKÝ LOG

      setFilterColumn(column);
      // Získanie unikátnych hodnôt pre daný stĺpec, prevedené na string a malé písmená pre konzistentnosť
      const values = [...new Set(allUsers.map(u => {
          let val;
          if (column === 'registrationDate' && u.registrationDate && typeof u.registrationDate.toDate === 'function') {
              // Používame toLocaleString pre zobrazenie dátumu a času vo filtri
              val = u.registrationDate.toDate().toLocaleString('sk-SK');
          } else if (column.includes('.')) { // Pre vnorené polia ako billing.clubName
              const parts = column.split('.');
              let nestedVal = u;
              for (const part of parts) {
                  nestedVal = nestedVal ? nestedVal[part] : undefined;
              }
              val = nestedVal;
          } else {
              val = u[column];
          }
          // Špecifické pre boolean stĺpce (napr. 'approved')
          if (typeof val === 'boolean') {
              return val ? 'áno' : 'nie';
          }
          return String(val || '').toLowerCase(); // Všetko na malé písmená
      }))].filter(v => v !== '').sort(); // Odstrániť prázdne a zoradiť
      setUniqueColumnValues(values);
      setFilterModalOpen(true);
  };

  const closeFilterModal = () => {
      setFilterModalOpen(false);
      setFilterColumn('');
      setUniqueColumnValues([]);
  };

  const applyFilter = (column, values) => {
      // Uloženie vybraných hodnôt filtra (už sú v malých písmenách)
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
                      // Používame toLocaleString aj pre porovnanie vo filtri
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
                  // Špecifické pre boolean stĺpce (napr. 'approved')
                  if (typeof user[column] === 'boolean') {
                      userValue = user[column] ? 'áno' : 'nie';
                  }
                  return filterValues.includes(userValue);
              });
          }
      });
      setFilteredUsers(currentFiltered);
  }, [allUsers, activeFilters]);


  // Handle logout (needed for the header logout button)
  const handleLogout = React.useCallback(async () => {
    if (!auth) return;
    try {
      setLoadingUsers(true); 
      setLoadingColumnOrder(true); 
      await auth.signOut();
      window.showGlobalNotification("Úspešne odhlásený.", 'success');
      // Použijeme globálne definovanú base path
      const appBasePath = typeof window.getAppBasePath === 'function' ? window.getAppBasePath() : '';
      window.location.href = `${appBasePath}/login.html`;
      setUser(null); 
      setUserProfileData(null); 
    } catch (e) {
      console.error("AllRegistrationsApp: Chyba pri odhlásení:", e); 
      window.showGlobalNotification(`Chyba pri odhlásení: ${e.message}`, 'error');
    } finally {
      setLoadingUsers(false); 
      setLoadingColumnOrder(false); 
    }
  }, [auth]);

  // Attach logout handler to the button in the header
  React.useEffect(() => {
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
      // Odstránime starý listener, ak existuje, pre opätovné pripojenie
      // Predpokladáme, že header.js už nepripojuje listener priamo, ale len definuje funkciu.
      // Ak by aj pripojoval, tento removeEventListener je na mieste.
      logoutButton.removeEventListener('click', window.handleLogout); // Odstránime pôvodný z header.js (ak existuje)
      logoutButton.addEventListener('click', handleLogout); // Pripojíme lokálny
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
    setColumnOrder(newColumnOrder); // Okamžitá aktualizácia lokálneho stavu

    // Uloženie nového poradia do Firestore
    if (db && user && user.uid) {
        const columnOrderDocRef = doc(db, 'users', user.uid, 'columnOrder', 'columnOrder');
        try {
            await setDoc(columnOrderDocRef, { order: newColumnOrder }, { merge: true });
            console.log("AllRegistrationsApp: Poradie stĺpcov uložené do Firestore.");
        } catch (e) {
            console.error("AllRegistrationsApp: Chyba pri ukladaní poradia stĺpcov do Firestore:", e);
            window.showGlobalNotification(`Chyba pri ukladaní poradia stĺpcov: ${e.message}`, 'error');
        }
    }
  };

  // Funkcia na uloženie viditeľnosti stĺpcov do Firestore
  const handleSaveColumnVisibility = async (updatedColumns) => {
    setColumnOrder(updatedColumns); // Okamžitá aktualizácia lokálneho stavu
    if (db && user && user.uid) {
        const columnOrderDocRef = doc(db, 'users', user.uid, 'columnOrder', 'columnOrder');
        try {
            await setDoc(columnOrderDocRef, { order: updatedColumns }, { merge: true });
            window.showGlobalNotification("Viditeľnosť stĺpcov bola úspešne uložená.", 'success');
        } catch (e) {
            console.error("AllRegistrationsApp: Chyba pri ukladaní viditeľnosti stĺpcov do Firestore:", e);
            window.showGlobalNotification(`Chyba pri ukladaní viditeľnosti stĺpcov: ${e.message}`, 'error');
        }
    }
  };

  // Display loading state
  // Ak sa má zobraziť globálny loader, jednoducho sa nebude renderovať nič v tejto sekcii.
  // Globálny loader sa schová v `handleGlobalDataUpdated` alebo po úspešnom načítaní používateľského profilu.
  if (!isAuthReady || user === undefined || (user && !userProfileData) || loadingUsers || loadingColumnOrder) { 
    if (isAuthReady && user === null) {
        console.log("AllRegistrationsApp: Auth je ready a používateľ je null, presmerovávam na login.html"); 
        const appBasePath = typeof window.getAppBasePath === 'function' ? window.getAppBasePath() : '';
        window.location.href = `${appBasePath}/login.html`;
        return null; 
    }
    // Lokálny loader bol odstránený. Predpokladá sa, že globálny loader sa zobrazuje.
    return null; 
  }

  // Ak používateľ nie je admin alebo nie je schválený, presmerujeme ho
  if (userProfileData.role !== 'admin' || userProfileData.approved === false) {
      console.log("AllRegistrationsApp: Používateľ nie je schválený administrátor. Presmerovávam na logged-in-my-data.html.");
      const appBasePath = typeof window.getAppBasePath === 'function' ? window.getAppBasePath() : '';
      window.location.href = `${appBasePath}/logged-in-my-data.html`;
      return null; // Zastaviť vykresľovanie
  }

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
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
                        ),
                        // Nová hlavička pre tlačidlo rozbalenia
                        React.createElement('th', { scope: 'col', className: 'py-3 px-6 text-center' }, 'Detaily')
                    )
                ),
                React.createElement(
                    'tbody',
                    null,
                    filteredUsers.length === 0 ? (
                        React.createElement(
                            'tr',
                            null,
                            React.createElement('td', { colSpan: columnOrder.filter(c => c.visible).length + 1, className: 'py-4 px-6 text-center text-gray-500' }, 'Žiadne registrácie na zobrazenie.')
                        )
                    ) : (
                        filteredUsers.map(u => (
                            React.createElement(
                                React.Fragment,
                                { key: u.id },
                                React.createElement(
                                    'tr',
                                    { className: 'bg-white border-b hover:bg-gray-50' },
                                    columnOrder.filter(col => col.visible).map(col => ( 
                                        React.createElement('td', { key: col.id, className: 'py-3 px-6 text-left whitespace-nowrap' },
                                            col.id === 'registrationDate' && getNestedValue(u, col.id) && typeof getNestedValue(u, col.id).toDate === 'function' ? getNestedValue(u, col.id).toDate().toLocaleString('sk-SK') :
                                            col.id === 'approved' ? (getNestedValue(u, col.id) ? 'Áno' : 'Nie') :
                                            col.id === 'postalCode' ? formatPostalCode(getNestedValue(u, col.id)) :
                                            getNestedValue(u, col.id) || '-'
                                        )
                                    )),
                                    React.createElement(
                                        'td',
                                        { className: 'py-3 px-6 text-center' },
                                        React.createElement(
                                            'button',
                                            {
                                                onClick: () => toggleRow(u.id),
                                                className: 'p-1 rounded-full hover:bg-gray-200'
                                            },
                                            expandedRows[u.id] ? '▲' : '▼'
                                        )
                                    )
                                ),
                                expandedRows[u.id] && React.createElement(
                                    'tr',
                                    { className: 'bg-gray-50' },
                                    React.createElement(
                                        'td',
                                        { colSpan: columnOrder.filter(col => col.visible).length + 1, className: 'p-4' },
                                        React.createElement(UserDetailsTable, { user: u })
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
