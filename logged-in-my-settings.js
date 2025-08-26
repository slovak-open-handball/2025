// logged-in-my-settings.js
// Tento súbor obsahuje React komponent pre správu nastavení prihláseného používateľa.
// Predpokladá, že Firebase SDK je inicializovaný v authentication.js a globálne sprístupnený.

// Importy pre modulárny Firestore
import { doc, updateDoc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// Main React component for the logged-in-my-settings.html page
function MySettingsApp() {
  // Prístup k globálnym inštanciám Firebase z window objektu
  const auth = window.auth;
  const db = window.db;

  // Lokálne stavy pre data používateľa a načítanie
  const [user, setUser] = React.useState(null); // Bude aktualizované z globalDataUpdated
  const [userProfileData, setUserProfileData] = React.useState(null);
  const [loading, setLoading] = React.useState(true); // Loading pre data v MySettingsApp
  const [error, setError] = React.useState(''); // Lokálny stav pre chybové správy
  const [successMessage, setSuccessMessage] = React.useState('');

  // Stavy pre užívateľské dáta (nastavenia notifikácií)
  const [displayNotifications, setDisplayNotifications] = React.useState(true);

  // Efekt pre počúvanie globálnych zmien autentifikácie a dát profilu
  React.useEffect(() => {
    // Zobrazíme globálny loader pri štarte efektu
    window.showGlobalLoader();

    const handleGlobalDataUpdated = (event) => {
      console.log("MySettingsApp: Prijatá udalosť 'globalDataUpdated'.");
      const globalUser = auth.currentUser; // Získame aktuálneho používateľa priamo z globálneho auth
      const globalProfileData = event.detail;

      setUser(globalUser);
      setUserProfileData(globalProfileData);
      setLoading(false); // Ukončíme loading, keď sú dáta prijaté
      window.hideGlobalLoader(); // Skryjeme globálny loader po načítaní dát

      if (!globalUser) {
        console.log("MySettingsApp: Používateľ je odhlásený. Presmerovávam.");
        // Presmerovanie by mal primárne riadiť authentication.js, ale pre istotu
        if (window.location.pathname.includes('/logged-in-')) {
            window.location.href = 'login.html';
        }
        return;
      }

      if (globalProfileData) {
        console.log(`MySettingsApp: Spracovávam profilové dáta pre UID: ${globalUser.uid}`);
        
        // Logika pre presmerovanie 'user' role
        if (globalProfileData.role === 'user') {
            console.log("MySettingsApp: Používateľ má rolu 'user'. Presmerovávam na logged-in-my-data.html.");
            window.location.href = 'logged-in-my-data.html';
            return;
        }

        // Aktualizácia lokálnych stavov z userProfileData
        setDisplayNotifications(globalProfileData.displayNotifications !== undefined ? globalProfileData.displayNotifications : true);
        
        setError(''); // Vyčistí chyby po úspešnom načítaní
        setSuccessMessage('');
      } else {
        console.warn("MySettingsApp: Profilové dáta používateľa nie sú dostupné.");
        setError("Chyba: Profil používateľa nebol nájdený alebo nemáte dostatočné povolenia.");
        setSuccessMessage(''); 
      }
    };

    // Pridanie listenera pre globálne aktualizácie dát
    window.addEventListener('globalDataUpdated', handleGlobalDataUpdated);

    // Initial check if data is already available (e.g., after a page refresh)
    if (window.isGlobalAuthReady && window.globalUserProfileData) {
      console.log("MySettingsApp: Initial check - globálne dáta sú už pripravené.");
      handleGlobalDataUpdated({ detail: window.globalUserProfileData });
    } else if (window.isGlobalAuthReady && !window.globalUserProfileData && auth.currentUser) {
      // Ak je authReady, ale profilové dáta chýbajú, a používateľ je prihlásený,
      // znamená to problém s načítaním profilu v authentication.js.
      console.warn("MySettingsApp: Initial check - Firebase Auth je pripravený, ale globalUserProfileData chýba pre prihláseného používateľa.");
      setError("Chyba: Váš profil sa nepodarilo načítať. Skúste sa prosím odhlásiť a znova prihlásiť.");
      setLoading(false);
      window.hideGlobalLoader(); // Skryjeme globálny loader aj pri chybe
    } else if (window.isGlobalAuthReady && !auth.currentUser) {
        console.log("MySettingsApp: Initial check - používateľ nie je prihlásený, ale globalAuthReady je true.");
        setLoading(false); // Ak nie je prihlásený, nie je čo načítavať
        window.hideGlobalLoader(); // Skryjeme globálny loader
        // Presmerovanie zabezpečuje authentication.js
    } else {
        // Ak dáta nie sú pripravené a ani nie je prihlásený používateľ, zobrazíme globálny loader
        // už je volané na začiatku useEffectu
    }

    return () => {
      window.removeEventListener('globalDataUpdated', handleGlobalDataUpdated);
      window.hideGlobalLoader(); // Zabezpečíme skrytie loadera pri odpojení komponentu
    };
  }, [auth, db]); // Závisí od globálnych inštancií auth a db

  const handleUpdateNotificationsSetting = async () => {
    if (!db || !user) {
      setError("Databáza alebo používateľ nie je k dispozícii.");
      setSuccessMessage(''); 
      return;
    }
    setLoading(true);
    window.showGlobalLoader(); // Zobrazíme loader počas ukladania
    setError(''); // Vyčistí predchádzajúce chyby
    setSuccessMessage(''); 

    try {
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        displayNotifications: displayNotifications
      });
      setSuccessMessage("Nastavenie notifikácií aktualizované!");
      // Automatické skrytie správy po 5 sekundách
      setTimeout(() => setSuccessMessage(''), 5000); 
    } catch (e) {
      console.error("MySettingsApp: Chyba pri aktualizácii nastavenia notifikácií:", e);
      setError(`Chyba pri aktualizácii nastavenia: ${e.message}`);
      // Automatické skrytie správy po 5 sekundách
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoading(false);
      window.hideGlobalLoader(); // Skryjeme loader po uložení (či už úspešnom alebo s chybou)
    }
  };

  // Renderovanie obsahu, ak nie je stav `loading` true
  // Ak je loading, automaticky sa zobrazí globálny loader volaný v useEffecte
  if (loading) {
    return null; // Nič nevykresľujeme, necháme globálny loader, aby sa staral o zobrazenie
  }

  // Ak existuje chyba alebo úspešná správa, zobrazíme ju ako pop-up
  const notificationElement = (error || successMessage) && React.createElement(
    'div',
    { 
      // Triedy pre pop-up okno v hornej strednej časti obrazovky
      className: `fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-lg shadow-lg text-white text-center transition-all duration-300 transform 
                  ${error ? 'bg-red-500' : 'bg-green-500'}`,
      role: 'alert' 
    },
    error && React.createElement('strong', { className: 'font-bold' }, 'Chyba! '),
    successMessage && React.createElement('strong', { className: 'font-bold' }, ''),
    React.createElement('span', { className: 'block sm:inline' }, error || successMessage)
  );

  // Hlavné vykreslenie komponentu
  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
    React.createElement(
      'div',
      { className: 'w-full max-w-4xl mt-20 mb-10 p-4' },
      notificationElement,
      React.createElement(
        'div',
        { className: 'bg-white p-8 rounded-lg shadow-xl w-full' },
        React.createElement('h1', { className: 'text-3xl font-bold text-center text-gray-800 mb-6' },
          'Moje nastavenia'
        ),
        React.createElement(
          React.Fragment,
          null,
          React.createElement('h2', { className: 'text-2xl font-bold text-gray-800 mt-8 mb-4' }, 'Nastavenia notifikácií'),
          React.createElement(
            'div',
            { className: 'flex items-center justify-between mt-4' },
            React.createElement('label', { className: 'text-gray-700 text-base', htmlFor: 'display-notifications-toggle' }, 'Zobrazovať notifikácie a oznámenia'),
            React.createElement(
              'label',
              { className: 'toggle-switch' },
              React.createElement('input', {
                type: 'checkbox',
                id: 'display-notifications-toggle',
                checked: displayNotifications,
                onChange: (e) => setDisplayNotifications(e.target.checked),
                disabled: loading,
              }),
              React.createElement('span', { className: 'slider' })
            )
          ),
          React.createElement(
            'button',
            {
              onClick: handleUpdateNotificationsSetting,
              className: 'mt-6 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200',
              disabled: loading,
            },
            loading ? 'Ukladám...' : 'Uložiť nastavenia notifikácií'
          )
        )
      )
    )
  );
}

// Explicitne sprístupníme komponent globálne
window.MySettingsApp = MySettingsApp;
