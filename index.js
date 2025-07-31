// index.js
// Tento súbor predpokladá, že Firebase SDK je inicializovaný v <head> index.html
// a authentication.js spravuje globálnu autentifikáciu a stav používateľa.

// Helper function to format a Date object into 'YYYY-MM-DDTHH:mm' local string
const formatToDatetimeLocal = (date) => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// Main React component for the index.html page
function App() {
  // Získame referencie na Firebase služby a globálne dáta z authentication.js
  const auth = window.auth;
  const db = window.db;
  const user = window.globalUserProfileData; // Používame globálny profil používateľa
  const isAuthReady = window.isGlobalAuthReady; // Používame globálny stav pripravenosti autentifikácie

  const [loading, setLoading] = React.useState(true); // Loading pre dáta v App
  const [error, setError] = React.useState('');
  const [userNotificationMessage, setUserNotificationMessage] = React.useState('');

  // States for date and time settings
  const [registrationStartDate, setRegistrationStartDate] = React.useState('');
  const [registrationEndDate, setRegistrationEndDate] = React.useState('');
  const [settingsLoaded, setSettingsLoaded] = React.useState(false);
  // NOVINKA: Stav pre existenciu kategórií
  const [categoriesExist, setCategoriesExist] = React.useState(false); // Predvolene na false

  // New state for countdown
  const [countdown, setCountdown] = React.useState(null);
  // New state variable to force recalculation of isRegistrationOpen
  const [forceRegistrationCheck, setForceRegistrationCheck] = React.useState(0);
  // New state variable for periodic update of isRegistrationOpen
  const [periodicRefreshKey, setPeriodicRefreshKey] = React.useState(0);

  // Calculate registration status as a memoized value
  const isRegistrationOpen = React.useMemo(() => {
    if (!settingsLoaded) return false; // Wait until settings are loaded
    const now = new Date();
    const regStart = registrationStartDate ? new Date(registrationStartDate) : null;
    const regEnd = registrationEndDate ? new Date(registrationEndDate) : null;

    // Check if dates are valid before comparison
    const isRegStartValid = regStart instanceof Date && !isNaN(regStart);
    const isRegEndValid = regEnd instanceof Date && !isNaN(regEnd);

    return (
      (isRegStartValid ? now >= regStart : true) && // If regStart is not valid, assume registration has started
      (isRegEndValid ? now <= regEnd : true)        // If regEnd is not valid, assume registration has not ended
    );
  }, [settingsLoaded, registrationStartDate, registrationEndDate, forceRegistrationCheck, periodicRefreshKey]);

  // Function to calculate remaining time for countdown
  const calculateTimeLeft = React.useCallback(() => {
    const now = new Date();
    const startDate = registrationStartDate ? new Date(registrationStartDate) : null;

    // If startDate is not a valid date, or is already in the past, no countdown is needed
    if (!startDate || isNaN(startDate) || now >= startDate) {
        return null; 
    }

    const difference = startDate.getTime() - now.getTime(); // Difference in milliseconds

    if (difference <= 0) {
        return null; // Time has passed
    }

    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((difference % (1000 * 60)) / 1000);

    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  }, [registrationStartDate]);

  // Effect for loading settings (runs after DB is initialized)
  React.useEffect(() => {
    const fetchSettings = async () => {
      // Čakáme, kým bude db inštancia dostupná z authentication.js
      if (!db) {
        console.log("IndexApp: Čakám na inicializáciu DB v authentication.js.");
        return;
      }
      try {
          // Načítanie dátumov registrácie
          const settingsDocRef = db.collection('settings').doc('registration');
          const unsubscribeSettings = settingsDocRef.onSnapshot(docSnapshot => {
            if (docSnapshot.exists) {
                const data = docSnapshot.data();
                setRegistrationStartDate(data.registrationStartDate ? formatToDatetimeLocal(data.registrationStartDate.toDate()) : '');
                setRegistrationEndDate(data.registrationEndDate ? formatToDatetimeLocal(data.registrationEndDate.toDate()) : '');
            } else {
                console.log("IndexApp: Nastavenia registrácie sa nenašli v Firestore. Používajú sa predvolené prázdne hodnoty.");
                setRegistrationStartDate('');
                setRegistrationEndDate('');
            }
          }, error => {
            console.error("IndexApp: Chyba pri načítaní nastavení registrácie (onSnapshot):", error);
            setError(`Chyba pri načítaní nastavení: ${error.message}`);
          });

          // Načítanie kategórií
          const categoriesDocRef = db.collection('settings').doc('categories');
          const unsubscribeCategories = categoriesDocRef.onSnapshot(docSnapshot => {
            if (docSnapshot.exists && Object.keys(docSnapshot.data()).length > 0) {
              setCategoriesExist(true);
              console.log("IndexApp: Kategórie existujú.");
            } else {
              setCategoriesExist(false);
              console.log("IndexApp: Žiadne kategórie neexistujú.");
            }
            setSettingsLoaded(true); // Nastav settingsLoaded na true až po načítaní kategórií
            setLoading(false); // Nastav loading na false, keď sú nastavenia a kategórie načítané
          }, error => {
            console.error("IndexApp: Chyba pri načítaní kategórií:", error);
            setCategoriesExist(false); // V prípade chyby predpokladáme, že neexistujú
            setSettingsLoaded(true); // Nastav settingsLoaded na true aj pri chybe
            setLoading(false); // Nastav loading na false aj pri chybe
          });

          return () => {
              unsubscribeSettings();
              unsubscribeCategories();
          };
      } catch (e) {
          console.error("IndexApp: Chyba pri nastavovaní onSnapshot pre nastavenia registrácie alebo kategórie:", e);
          setError(`Chyba pri nastavovaní poslucháča pre nastavenia: ${e.message}`);
          setSettingsLoaded(true);
          setLoading(false);
      }
    };

    fetchSettings();
  }, [db]); // Závisí od db (globálnej inštancie)

  // Effect for countdown (runs when registrationStartDate changes)
  React.useEffect(() => {
    let timer;
    const updateCountdown = () => {
        const timeLeft = calculateTimeLeft();
        setCountdown(timeLeft);
        if (timeLeft === null) {
            clearInterval(timer);
            setForceRegistrationCheck(prev => prev + 1);
        }
    };

    if (registrationStartDate && new Date(registrationStartDate) > new Date()) {
        updateCountdown();
        timer = setInterval(updateCountdown, 1000);
    } else {
        setCountdown(null);
    }

    return () => clearInterval(timer);
  }, [registrationStartDate, calculateTimeLeft]);

  // New useEffect for periodic update of isRegistrationOpen
  React.useEffect(() => {
    const interval = setInterval(() => {
      setPeriodicRefreshKey(prev => prev + 1);
    }, 60 * 1000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Display loading state
  if (!isAuthReady || loading) { // ZMENA: Používame globálne isAuthReady a lokálne loading
    return React.createElement(
      'div',
      { className: 'flex items-center justify-center min-h-screen bg-gray-100' },
      React.createElement('div', { className: 'text-xl font-semibold text-gray-700' }, 'Načítavam...')
    );
  }

  const now = new Date();
  const regStart = registrationStartDate ? new Date(registrationStartDate) : null;
  const regEnd = registrationEndDate ? new Date(registrationEndDate) : null;

  // NOVINKA: Zavedenie premennej pre podmienené vykresľovanie tlačidla "Registrácia na turnaj"
  const shouldShowRegisterButton = categoriesExist && isRegistrationOpen;

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col items-center justify-center font-inter overflow-y-auto' },
    // Notification Modal - teraz spravuje header.js
    // Error display
    error && React.createElement(
      'div',
      { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap', role: 'alert' },
      error
    ),

    React.createElement(
      'div',
      { className: 'w-full max-w-md mt-20 mb-10 p-4' },
      React.createElement(
        'div',
        { className: 'bg-white p-8 rounded-lg shadow-xl w-full text-center' },
        React.createElement('h1', { className: 'text-3xl font-bold text-gray-800 mb-4' }, 'Vitajte na stránke turnaja Slovak Open Handball'),
        user ? ( // Používame globálny user objekt
          React.createElement(
            React.Fragment,
            null,
            React.createElement('p', { className: 'text-lg text-gray-600' }, 'Ste prihlásený. V sekcii "Moja zóna" máte možnosť upraviť údaje zadané pri registrácii vrátane informácií o súpiske hráčov v jednotlivých družstvách.'),
            React.createElement(
              'div',
              { className: 'mt-6 flex justify-center' },
              React.createElement(
                'a',
                {
                  href: 'logged-in-my-data.html', // Odkaz na logged-in-my-data.html
                  className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200'
                },
                'Moja zóna'
              )
            )
          )
        ) : (
          React.createElement(
            React.Fragment,
            null,
            // ZMENA: Podmienené zobrazenie celého bloku pre registráciu
            shouldShowRegisterButton ? (
              React.createElement(
                React.Fragment,
                null,
                React.createElement('p', { className: 'text-lg text-gray-600' }, 'Pre pokračovanie sa prihláste alebo zaregistrujte.'),
                React.createElement(
                  'div',
                  { className: 'mt-6 flex justify-center space-x-4' },
                  React.createElement(
                    'a',
                    {
                      href: 'login.html',
                      className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200'
                    },
                    'Prihlásenie'
                  ),
                  React.createElement(
                    'a',
                    {
                      href: 'register.html',
                      className: 'bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200'
                    },
                    'Registrácia na turnaj'
                  )
                )
              )
            ) : (
              // ZMENA: Ak registrácia nie je otvorená alebo neexistujú kategórie
              React.createElement(
                React.Fragment,
                null,
                React.createElement(
                  'p',
                  { className: 'text-lg text-gray-600' },
                  categoriesExist ? 'Registračný formulár nie je prístupný.' : 'Nie je možné sa zaregistrovať na turnaj Slovak Open Handball, pretože v systéme nie sú definované žiadne kategórie.'
                ),
                // Zobraz dátumy len ak kategórie existujú
                categoriesExist && regStart && !isNaN(regStart) && now < regStart && (
                  React.createElement(
                    React.Fragment,
                    null,
                    React.createElement(
                      'p',
                      { className: 'text-md text-gray-500 mt-2' },
                      'Registrácia bude možná od:',
                      ' ',
                      React.createElement('span', { style: { whiteSpace: 'nowrap' } }, new Date(registrationStartDate).toLocaleDateString('sk-SK')),
                      ' ',
                      React.createElement('span', { style: { whiteSpace: 'nowrap' } }, new Date(registrationStartDate).toLocaleTimeString('sk-SK'))
                    ),
                    countdown && (
                        React.createElement('p', { className: 'text-md text-gray-500 mt-2' }, `Registrácia začne o: ${countdown}`)
                    )
                  )
                ),
                categoriesExist && regEnd && !isNaN(regEnd) && now > regEnd && (
                  React.createElement(
                    'p',
                    { className: 'text-md text-gray-500 mt-2' },
                    'Registrácia skončila:',
                    ' ',
                    React.createElement('span', { style: { whiteSpace: 'nowrap' } }, new Date(registrationEndDate).toLocaleDateString('sk-SK')),
                    ' ',
                    React.createElement('span', { style: { whiteSpace: 'nowrap' } }, new Date(registrationEndDate).toLocaleTimeString('sk-SK'))
                  )
                ),
                React.createElement(
                  'div',
                  { className: 'mt-6 flex justify-center' },
                  React.createElement(
                    'a',
                    {
                      href: 'login.html',
                      className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200'
                    },
                    'Prihlásenie'
                  )
                )
              )
            )
          )
        )
      )
    )
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App, null));
