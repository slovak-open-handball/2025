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
  const [categoriesExist, setCategoriesExist] = React.useState(false);
  const [countdown, setCountdown] = React.useState('');

  // State pre globálne nastavenia registrácie
  const [registrationSettings, setRegistrationSettings] = React.useState({
    registrationOpen: false,
    regStart: null,
    regEnd: null
  });

  // Effect hook na načítanie nastavení registrácie a kategórií z Firestore
  React.useEffect(() => {
    // Čakáme, kým bude Firebase Auth pripravené
    if (!isAuthReady) {
      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);

        const settingsDocRef = db.collection('settings').doc('registrationDates');
        const settingsDoc = await settingsDocRef.get();
        if (settingsDoc.exists) {
          const data = settingsDoc.data();
          const regStart = data.registrationStartDate?.toDate();
          const regEnd = data.registrationEndDate?.toDate();
          setRegistrationStartDate(regStart ? formatToDatetimeLocal(regStart) : '');
          setRegistrationEndDate(regEnd ? formatToDatetimeLocal(regEnd) : '');

          const now = new Date();
          const isOpen = regStart && regEnd && now >= regStart && now <= regEnd;

          // Aktualizácia globálnej premennej
          window.registrationSettings = {
            registrationOpen: isOpen,
            regStart: regStart,
            regEnd: regEnd
          };
          window.dispatchEvent(new Event('registration-settings-changed'));

        } else {
          console.log("IndexApp: Dokument s nastaveniami registrácií nebol nájdený.");
          window.registrationSettings = { registrationOpen: false, regStart: null, regEnd: null };
          window.dispatchEvent(new Event('registration-settings-changed'));
        }

        const categoriesQuery = await db.collection('categories').limit(1).get();
        setCategoriesExist(!categoriesQuery.empty);
        if (!categoriesQuery.empty) {
          console.log("IndexApp: Kategórie existujú.");
        } else {
          console.log("IndexApp: Kategórie neexistujú.");
        }

        setLoading(false);
      } catch (err) {
        console.error("IndexApp: Chyba pri načítaní dát z Firestore:", err);
        setError("Nepodarilo sa načítať dáta o registrácii a kategóriách.");
        setLoading(false);
      }
    };

    loadData();

    // Nastavenie časovača pre odpočítavanie
    const countdownInterval = setInterval(() => {
      const now = new Date();
      const regStart = registrationSettings.regStart;
      const regEnd = registrationSettings.regEnd;

      if (regStart && now < regStart) {
        const diff = regStart.getTime() - now.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setCountdown(`${days}d ${hours}h ${minutes}m ${seconds}s`);
      } else {
        setCountdown('');
      }
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [db, isAuthReady]);

  // Ak sa prebiehajú dáta, zobrazíme loading indikátor
  if (loading) {
    return React.createElement(
      'div',
      { className: 'flex justify-center items-center min-h-screen' },
      React.createElement('div', { className: 'text-center' },
        React.createElement('p', { className: 'text-xl font-semibold text-gray-700' }, 'Načítavam dáta...')
      )
    );
  }

  // Ak sa vyskytla chyba, zobrazíme chybovú správu
  if (error) {
    return React.createElement(
      'div',
      { className: 'flex justify-center items-center min-h-screen' },
      React.createElement('div', { className: 'text-center' },
        React.createElement('p', { className: 'text-xl font-semibold text-red-500' }, error)
      )
    );
  }

  const { registrationOpen, regStart, regEnd } = registrationSettings;
  const now = new Date();
  
  return React.createElement(
    'div',
    { className: 'bg-gray-100 min-h-screen p-4 sm:p-8' },
    React.createElement(
      'div',
      { className: 'max-w-4xl mx-auto' },
      React.createElement(
        'div',
        { className: 'bg-white rounded-lg shadow-md p-6 sm:p-8 text-center' },
        React.createElement('h1', { className: 'text-3xl sm:text-4xl font-bold text-gray-800 mb-4' }, 'Vitajte na Slovak Open Handball 2025'),
        React.createElement('p', { className: 'text-lg sm:text-xl text-gray-600' }, 'Prehľad registrácie na turnaj'),
        React.createElement('div', { className: 'mt-8 border-t pt-8 border-gray-200' },
          registrationOpen && React.createElement(
            'div',
            null,
            React.createElement('p', { className: 'text-2xl font-bold text-green-600' }, 'Registrácia je otvorená!'),
            React.createElement('p', { className: 'text-md text-gray-500 mt-2' }, `Registrácia končí: ${new Date(regEnd).toLocaleDateString('sk-SK')} ${new Date(regEnd).toLocaleTimeString('sk-SK')}`)
          ),
          !registrationOpen && regStart && now < regStart && (
            React.createElement(
              'div',
              null,
              React.createElement('p', { className: 'text-2xl font-bold text-yellow-600' }, 'Registrácia ešte nezačala'),
              React.createElement('p', { className: 'text-md text-gray-500 mt-2' }, `Registrácia začne o: ${countdown}`)
            )
          ),
          !registrationOpen && regEnd && now > regEnd && (
            React.createElement(
              'div',
              null,
              React.createElement('p', { className: 'text-2xl font-bold text-red-600' }, 'Registrácia skončila'),
              React.createElement('p', { className: 'text-md text-gray-500 mt-2' }, `Registrácia bola uzavretá: ${new Date(regEnd).toLocaleDateString('sk-SK')} ${new Date(regEnd).toLocaleTimeString('sk-SK')}`)
            )
          ),
          !categoriesExist && (
            React.createElement(
              'div',
              null,
              React.createElement('p', { className: 'text-2xl font-bold text-red-600' }, 'Žiadne kategórie nie sú vytvorené!'),
              React.createElement('p', { className: 'text-md text-gray-500 mt-2' }, 'Registrácia nie je možná, kým administrátor nevytvorí aspoň jednu kategóriu.')
            )
          ),
          user ? (
            React.createElement(
              'div',
              { className: 'mt-6 flex flex-col items-center' },
              React.createElement('p', { className: 'text-xl text-gray-700' }, `Ste prihlásený ako: ${user.displayName}`),
              user.role === 'admin' && (
                React.createElement('div', { className: 'mt-4' },
                  React.createElement('a', { href: 'logged-in-tournament-settings.html', className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200' }, 'Nastavenia turnaja')
                )
              )
            )
          ) : (
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
