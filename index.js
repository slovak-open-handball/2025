// Global application ID and Firebase configuration (should be consistent across all React apps)
const appId = '1:26454452024:web:6954b4f90f87a3a1eb43cd';
const firebaseConfig = {
  apiKey: "AIzaSyDj_bSTkjrquu1nyIVYW7YLbyBl1pD6YYo",
  authDomain: "prihlasovanie-4f3f3.firebaseapp.com",
  projectId: "prihlasovanie-4f3f3",
  storageBucket: "prihlasovanie-4f3f3.firebasestorage.app",
  messagingSenderId: "26454452024",
  appId: "1:26454452024:web:6954b4f90f87a3a1eb43cd"
};
const initialAuthToken = null; // Global authentication token

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

// NotificationModal Component for displaying temporary messages (converted to React.createElement)
function NotificationModal({ message, onClose }) {
  const [show, setShow] = React.useState(false);
  const timerRef = React.useRef(null);

  React.useEffect(() => {
    if (message) {
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
        timerRef.current = null;
      }
    };
  }, [message, onClose]);

  if (!show && !message) return null;

  return React.createElement(
    'div',
    {
      className: `fixed top-0 left-0 right-0 z-50 flex justify-center p-4 transition-transform duration-500 ease-out ${
        show ? 'translate-y-0' : '-translate-y-full'
      }`,
      style: { pointerEvents: 'none' }
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

// Main React component for the index.html page (converted to React.createElement)
function App() {
  const [app, setApp] = React.useState(null);
  const [auth, setAuth] = React.useState(null);
  const [db, setDb] = React.useState(null);
  const [user, setUser] = React.useState(null);
  const [isAuthReady, setIsAuthReady] = React.useState(false);
  const [pageLoading, setPageLoading] = React.useState(true); // New state for initial page loading
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');

  // States for date and time settings
  const [registrationStartDate, setRegistrationStartDate] = React.useState('');
  const [registrationEndDate, setRegistrationEndDate] = React.useState('');
  const [settingsLoaded, setSettingsLoaded] = React.useState(false);

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

  // Effect for Firebase initialization and Auth Listener setup (runs only once)
  React.useEffect(() => {
    let unsubscribeAuth;
    let firestoreInstance;

    try {
      if (typeof firebase === 'undefined') {
        setError("Firebase SDK nie je načítané. Skontrolujte index.html.");
        setPageLoading(false);
        return;
      }

      // Initialize Firebase app only once
      let firebaseAppInstance;
      try {
        firebaseAppInstance = firebase.app(); // Try to get default app
      } catch (e) {
        firebaseAppInstance = firebase.initializeApp(firebaseConfig); // Initialize if not already
      }
      setApp(firebaseAppInstance);

      const authInstance = firebase.auth(firebaseAppInstance);
      setAuth(authInstance);
      firestoreInstance = firebase.firestore(firebaseAppInstance);
      setDb(firestoreInstance);

      // Listen for auth state changes
      unsubscribeAuth = authInstance.onAuthStateChanged(async (currentUser) => {
        setUser(currentUser); // Set user state
        setIsAuthReady(true); // Auth state has been determined

        // NO AUTOMATIC REDIRECTION FROM INDEX.HTML BASED ON LOGIN STATUS.
        // The display will be handled by conditional rendering below.
        setPageLoading(false); // Auth state checked, stop page loading
      });

      // No explicit signIn() call here, as onAuthStateChanged handles existing sessions.
      // Removed signInAnonymously() to prevent unwanted user creation.

      return () => {
        if (unsubscribeAuth) {
          unsubscribeAuth();
        }
      };
    } catch (e) {
      console.error("Nepodarilo sa inicializovať Firebase:", e);
      setError(`Chyba pri inicializácii Firebase: ${e.message}`);
      setPageLoading(false);
    }
  }, []); // Empty dependency array - runs only once on component mount

  // Effect for loading settings (runs after DB and Auth are initialized)
  React.useEffect(() => {
    const fetchSettings = async () => {
      if (!db || !isAuthReady) {
        return; // Wait for DB and Auth to be initialized
      }
      try {
          // Používame onSnapshot pre real-time aktualizácie nastavení
          const settingsDocRef = db.collection('settings').doc('registration');
          const unsubscribeSettings = settingsDocRef.onSnapshot(docSnapshot => {
            if (docSnapshot.exists) {
                const data = docSnapshot.data();
                setRegistrationStartDate(data.registrationStartDate ? formatToDatetimeLocal(data.registrationStartDate.toDate()) : '');
                setRegistrationEndDate(data.registrationEndDate ? formatToDatetimeLocal(data.registrationEndDate.toDate()) : '');
            } else {
                console.log("Nastavenia registrácie sa nenašli v Firestore. Používajú sa predvolené prázdne hodnoty.");
                setRegistrationStartDate('');
                setRegistrationEndDate('');
            }
            setSettingsLoaded(true); // Nastavenia sú načítané, aj keď prázdne alebo s chybou
          }, error => {
            console.error("Chyba pri načítaní nastavení registrácie (onSnapshot):", error);
            setError(`Chyba pri načítaní nastavení: ${error.message}`);
            setSettingsLoaded(true);
          });

          return () => unsubscribeSettings(); // Vyčistenie onSnapshot listenera pri unmount
      } catch (e) {
          console.error("Chyba pri nastavení onSnapshot pre nastavenia registrácie:", e);
          setError(`Chyba pri nastavení listenera pre nastavenia: ${e.message}`);
          setSettingsLoaded(true);
      }
    };

    fetchSettings();
  }, [db, isAuthReady]); // Načíta nastavenia, keď je DB a Auth pripravené


  // Efekt pre odpočítavanie času (spustí sa pri zmene registrationStartDate)
  React.useEffect(() => {
    let timer;
    const updateCountdown = () => {
        const timeLeft = calculateTimeLeft();
        setCountdown(timeLeft);
        // Ak čas vypršal, vynútime prepočítanie isRegistrationOpen
        if (timeLeft === null) {
            clearInterval(timer);
            setForceRegistrationCheck(prev => prev + 1); // Zmeníme stav, aby sa isRegistrationOpen prepočítalo
        }
    };

    // Spustite odpočítavanie len ak je nastavený dátum začiatku a je v budúcnosti
    if (registrationStartDate && new Date(registrationStartDate) > new Date()) {
        updateCountdown(); // Počiatočné volanie pre okamžité zobrazenie
        timer = setInterval(updateCountdown, 1000);
    } else {
        setCountdown(null); // Vymažte odpočítavanie, ak nie je relevantné
    }

    return () => clearInterval(timer); // Vyčistenie intervalu pri unmount alebo zmene registrationStartDate
  }, [registrationStartDate, calculateTimeLeft]); // Závisí od registrationStartDate a calculateTimeLeft

  // NOVÝ useEffect pre periodickú aktualizáciu isRegistrationOpen
  React.useEffect(() => {
    const interval = setInterval(() => {
      setPeriodicRefreshKey(prev => prev + 1);
    }, 60 * 1000); // Aktualizovať každú minútu

    return () => clearInterval(interval);
  }, []); // Spustí sa len raz pri mountovaní komponentu


  // Display loading state
  if (pageLoading || !isAuthReady || !settingsLoaded) {
    return React.createElement(
      'div',
      { className: 'flex items-center justify-center min-h-screen bg-gray-100' },
      React.createElement('div', { className: 'text-xl font-semibold text-gray-700' }, 'Načítavam...')
    );
  }

  const now = new Date();
  const regStart = registrationStartDate ? new Date(registrationStartDate) : null;
  const regEnd = registrationEndDate ? new Date(registrationEndDate) : null;

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col items-center justify-center font-inter overflow-y-auto' },
    // Notification Modal
    React.createElement(NotificationModal, {
        message: message,
        onClose: () => setMessage('')
    }),
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
        user ? ( // Ak je používateľ prihlásený (a nie je anonymný, keďže anonymné prihlásenie je odstránené)
          React.createElement(
            React.Fragment,
            null,
            React.createElement('p', { className: 'text-lg text-gray-600' }, 'Ste prihlásený. Prejdite do svojej zóny pre viac možností.'),
            React.createElement(
              'div',
              { className: 'mt-6 flex justify-center' },
              React.createElement(
                'a',
                {
                  href: 'logged-in-my-data.html', // Presmerovanie na hlavnú stránku prihlásených používateľov
                  className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200'
                },
                'Moja zóna'
              )
            )
          )
        ) : ( // Ak používateľ nie je prihlásený
          React.createElement(
            React.Fragment,
            null,
            isRegistrationOpen ? (
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
              React.createElement(
                React.Fragment,
                null,
                React.createElement(
                  'p',
                  { className: 'text-lg text-gray-600' },
                  'Registračný formulár nie je prístupný.'
                ),
                regStart && !isNaN(regStart) && now < regStart && (
                  React.createElement(
                    React.Fragment,
                    null,
                    React.createElement(
                      'p',
                      { className: 'text-md text-gray-500 mt-2' },
                      'Registrácia bude možná od:',
                      ' ',
                      React.createElement('span', { style: { whiteSpace: 'nowrap' } }, new Date(registrationStartDate).toLocaleDateString('sk-SK') || 'Neznámy dátum'),
                      ' ',
                      React.createElement('span', { style: { whiteSpace: 'nowrap' } }, new Date(registrationStartDate).toLocaleTimeString('sk-SK') || 'Neznámy čas')
                    ),
                    countdown && (
                        React.createElement('p', { className: 'text-md text-gray-500 mt-2' }, `Registrácia začne o: ${countdown}`)
                    )
                  )
                ),
                regEnd && !isNaN(regEnd) && now > regEnd && (
                  React.createElement(
                    'p',
                    { className: 'text-md text-gray-500 mt-2' },
                    'Registrácia skončila:',
                    ' ',
                    React.createElement('span', { style: { whiteSpace: 'nowrap' } }, new Date(registrationEndDate).toLocaleDateString('sk-SK') || 'Neznámy dátum'),
                    ' ',
                    React.createElement('span', { style: { whiteSpace: 'nowrap' } }, new Date(registrationEndDate).toLocaleTimeString('sk-SK') || 'Neznámy čas')
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
