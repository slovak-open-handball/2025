// index.js
// Tento súbor predpokladá, že Firebase SDK je inicializovaný v <head> index.html
// a authentication.js spravuje globálnu autentifikáciu a stav používateľa.

// Importy pre Firebase SDK
import { getFirestore, doc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
  const [categoriesExist, setCategoriesExist] = React.useState(false);

  // Funkcie na načítanie dát z Firebase
  const fetchRegistrationSettings = async () => {
    if (!db) {
      console.warn("index.js: Databáza nie je k dispozícii. Nemôžem načítať nastavenia.");
      return;
    }
    setLoading(true);
    try {
      // OPRAVA: Použitie nového API pre Firestore `collection(db, ...)`
      const settingsRef = collection(db, 'artifacts', 'soh2025-2s0o2h5', 'public', 'data', 'registrationSettings');
      const settingsSnapshot = await getDocs(settingsRef);
      if (!settingsSnapshot.empty) {
        const settingsData = settingsSnapshot.docs[0].data();
        setRegistrationStartDate(settingsData.start_date.toDate());
        setRegistrationEndDate(settingsData.end_date.toDate());
      }
    } catch (e) {
      console.error("index.js: Chyba pri načítaní nastavení registrácie:", e);
      setError('Chyba pri načítaní nastavení registrácie.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    if (!db) {
      console.warn("index.js: Databáza nie je k dispozícii. Nemôžem načítať kategórie.");
      return;
    }
    try {
      // OPRAVA: Použitie nového API pre Firestore `collection(db, ...)`
      const categoriesRef = collection(db, 'artifacts', 'soh2025-2s0o2h5', 'public', 'data', 'categories');
      const categoriesSnapshot = await getDocs(categoriesRef);
      setCategoriesExist(!categoriesSnapshot.empty);
    } catch (e) {
      console.error("index.js: Chyba pri načítaní kategórií:", e);
    }
  };

  // Načítanie dát po pripravenosti autentifikácie
  React.useEffect(() => {
    const handleAuthStateReady = () => {
      if (isAuthReady && db) {
        fetchRegistrationSettings();
        fetchCategories();
      }
    };
    
    // Pridanie poslucháča na globálnu udalosť
    window.addEventListener('auth-state-changed', handleAuthStateReady);

    // Odstránenie poslucháča pri unmount
    return () => {
      window.removeEventListener('auth-state-changed', handleAuthStateReady);
    };
  }, [isAuthReady, db]);

  // Handle countdown logic
  const [countdown, setCountdown] = React.useState('');
  const [now, setNow] = React.useState(new Date());

  React.useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    if (registrationStartDate && now < registrationStartDate) {
      const diff = registrationStartDate.getTime() - now.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setCountdown(`${days}d ${hours}h ${minutes}m ${seconds}s`);
    } else {
      setCountdown('');
    }
  }, [now, registrationStartDate]);

  // Vykreslenie komponentu
  if (loading) {
    return React.createElement('div', { className: 'flex justify-center items-center h-screen' }, 'Načítavam...');
  }

  if (error) {
    return React.createElement('div', { className: 'flex justify-center items-center h-screen text-red-500' }, `Chyba: ${error}`);
  }

  const regStart = registrationStartDate ? new Date(registrationStartDate).getTime() : null;
  const regEnd = registrationEndDate ? new Date(registrationEndDate).getTime() : null;

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex items-center justify-center p-4' },
    React.createElement(
      'div',
      { className: 'bg-white shadow-xl rounded-lg p-8 w-full max-w-2xl text-center' },
      React.createElement(
        'h1',
        { className: 'text-3xl font-bold text-gray-800 mb-2' },
        'SOH 2025'
      ),
      React.createElement(
        'p',
        { className: 'text-xl text-gray-600 mb-6' },
        'Slovak Open Handball'
      ),
      React.createElement(
        'p',
        { className: 'text-xl font-bold text-gray-700 mb-4' },
        'Prihlásenie'
      ),
      React.createElement(
        'div',
        { className: 'border-t border-gray-200 pt-6' },
        !user && (
          React.createElement(
            React.Fragment,
            null,
            (!regStart || now < regStart) && (
              React.createElement(
                'p',
                { className: 'text-md text-gray-500 mt-2' },
                `Registrácia začne o: ${countdown}`
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
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App, null));
