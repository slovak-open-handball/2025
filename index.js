// index.js
// Tento súbor predpokladá, že Firebase SDK je inicializovaný v <head> index.html
// a authentication.js spravuje globálnu autentifikáciu a stav používateľa.

// Main React component for the index.html page
function App() {
  const [loading, setLoading] = React.useState(true); // Loading pre dáta v App
  const [error, setError] = React.useState('');
  const [userNotificationMessage, setUserNotificationMessage] = React.useState('');
  const [registrationSettings, setRegistrationSettings] = React.useState({});
  const [categoriesExist, setCategoriesExist] = React.useState(false);
  
  // States for date and time settings
  const [registrationStartDate, setRegistrationStartDate] = React.useState(null);
  const [registrationEndDate, setRegistrationEndDate] = React.useState(null);

  // Zabezpečíme, že načítavanie sa spustí až po tom, ako je authentication.js pripravený
  React.useEffect(() => {
    const handleAuthStateReady = () => {
      console.log("index.js: Prijatá udalosť 'auth-state-changed'.");
      // Počkáme, kým sa globálne premenné nastavia
      if (window.isGlobalAuthReady) {
        console.log("index.js: Autentifikácia je pripravená.");
        fetchRegistrationSettings();
      }
    };
    
    // Ak je už autentifikácia pripravená, môžeme začať
    if (window.isGlobalAuthReady) {
      handleAuthStateReady();
    } else {
      // Inak počkáme na udalosť
      window.addEventListener('auth-state-changed', handleAuthStateReady);
    }

    return () => {
      window.removeEventListener('auth-state-changed', handleAuthStateReady);
    };
  }, []);

  // Funkcia na načítanie nastavení registrácie
  const fetchRegistrationSettings = async () => {
    try {
      if (!window.db) {
        console.error("index.js: Firestore databáza nie je inicializovaná.");
        setError('Databáza nie je pripojená.');
        setLoading(false);
        return;
      }
      const docRef = window.db.collection('settings').doc('registration');
      const docSnap = await docRef.get();

      if (docSnap.exists) {
        const data = docSnap.data();
        setRegistrationSettings(data);
        window.registrationSettings = data;
        
        // Nastavíme stavy pre dátumy, ak existujú
        if (data.registrationStart) {
            setRegistrationStartDate(data.registrationStart.toDate());
        }
        if (data.registrationEnd) {
            setRegistrationEndDate(data.registrationEnd.toDate());
        }
      } else {
        console.log("index.js: Nastavenia registrácie neboli nájdené.");
      }

      // Kontrola existencie kategórií
      const categoriesRef = window.db.collection('categories');
      const categoriesSnap = await categoriesRef.get();
      setCategoriesExist(!categoriesSnap.empty);

    } catch (e) {
      console.error("index.js: Chyba pri načítaní nastavení alebo kategórií:", e);
      setError('Chyba pri načítaní dát.');
    } finally {
      setLoading(false);
    }
  };

  // Logika pre odpočítavanie
  const [countdown, setCountdown] = React.useState('');

  React.useEffect(() => {
      const updateCountdown = () => {
        if (!registrationStartDate) return;
        const now = new Date();
        const diffInSeconds = Math.floor((registrationStartDate.getTime() - now.getTime()) / 1000);

        if (diffInSeconds < 0) {
          setCountdown('');
          return;
        }

        const days = Math.floor(diffInSeconds / (3600 * 24));
        const hours = Math.floor((diffInSeconds % (3600 * 24)) / 3600);
        const minutes = Math.floor((diffInSeconds % 3600) / 60);
        const seconds = diffInSeconds % 60;

        setCountdown(`${days}d ${hours}h ${minutes}m ${seconds}s`);
      };

      const interval = setInterval(updateCountdown, 1000);
      return () => clearInterval(interval);
  }, [registrationStartDate]);


  const now = new Date().getTime();
  const regStart = registrationStartDate ? registrationStartDate.getTime() : null;
  const regEnd = registrationEndDate ? registrationEndDate.getTime() : null;

  // Renderovanie obsahu
  if (loading) {
    return React.createElement(
      'div',
      { className: 'flex justify-center items-center h-screen' },
      React.createElement(
        'p',
        { className: 'text-lg font-semibold' },
        'Načítavam dáta...'
      )
    );
  }

  if (error) {
    return React.createElement(
      'div',
      { className: 'flex justify-center items-center h-screen' },
      React.createElement(
        'p',
        { className: 'text-lg font-semibold text-red-600' },
        `Chyba: ${error}`
      )
    );
  }

  return React.createElement(
    'div',
    { className: 'bg-gray-100 min-h-screen' },
    // Oznámenie o registrácii
    React.createElement(
      'main',
      { className: 'container mx-auto mt-8 p-4' },
      React.createElement(
        'div',
        { className: 'flex justify-center' },
        React.createElement(
          'div',
          { className: 'bg-white p-8 rounded-lg shadow-lg max-w-xl w-full text-center' },
          React.createElement(
            'h1',
            { className: 'text-4xl font-bold text-gray-800' },
            'SOH 2025 - Slovak Open Handball'
          ),
          React.createElement(
            'p',
            { className: 'mt-4 text-xl text-gray-600' },
            'Vitajte na oficiálnej stránke turnaja.'
          ),
          
          React.createElement(
            'div',
            { className: 'mt-8 p-6 bg-blue-100 rounded-lg shadow-inner' },
            (categoriesExist && regStart && now >= regStart && (!regEnd || now < regEnd)) && (
              React.createElement(
                'div',
                null,
                React.createElement(
                  'p',
                  { className: 'text-2xl font-bold text-blue-800' },
                  'Registrácia je otvorená!'
                ),
                React.createElement(
                  'a',
                  {
                    href: 'register.html',
                    className: 'mt-4 inline-block bg-blue-500 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200 text-lg'
                  },
                  'Registrujte sa na turnaj'
                )
              )
            ),
            (categoriesExist && regStart && regEnd && !isNaN(regStart) && !isNaN(regEnd) && now < regStart) && (
              React.createElement(
                'div',
                null,
                React.createElement(
                  'p',
                  { className: 'text-xl font-bold text-blue-800' },
                  'Registrácia sa ešte nezačala.'
                ),
                React.createElement(
                  'p',
                  { className: 'text-md text-gray-500 mt-2' },
                  `Registrácia začne o: ${countdown}`
                )
              )
            ),
            (categoriesExist && regEnd && !isNaN(regEnd) && now > regEnd) && (
              React.createElement(
                'p',
                { className: 'text-xl text-gray-500 mt-2' },
                'Registrácia skončila: ',
                React.createElement('span', { style: { whiteSpace: 'nowrap' } }, registrationEndDate.toLocaleDateString('sk-SK')),
                ' ',
                React.createElement('span', { style: { whiteSpace: 'nowrap' } }, registrationEndDate.toLocaleTimeString('sk-SK'))
              )
            ),
            !categoriesExist && (
              React.createElement(
                'p',
                { className: 'text-xl text-red-600 font-bold' },
                'Registrácia na turnaj zatiaľ nie je možná, pretože administrátor nevytvoril žiadne kategórie.'
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
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App, null));
