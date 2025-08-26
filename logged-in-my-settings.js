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
  const [notification, setNotification] = React.useState({ message: '', type: '' }); // Lokálny stav pre notifikácie

  // Stavy pre užívateľské dáta (nastavenia notifikácií)
  const [displayNotifications, setDisplayNotifications] = React.useState(true);

  // Funkcia na zobrazenie lokálnej notifikácie
  const showLocalNotification = (message, type = 'success') => {
    setNotification({ message, type });
    // Automatické skrytie správy po 5 sekundách
    setTimeout(() => setNotification({ message: '', type: '' }), 5000);
  };

  // Efekt pre počúvanie globálnych zmien autentifikácie a dát profilu
  React.useEffect(() => {
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
        
        setNotification({ message: '', type: '' }); // Vyčistí notifikácie po úspešnom načítaní
      } else {
        console.warn("MySettingsApp: Profilové dáta používateľa nie sú dostupné.");
        showLocalNotification("Chyba: Profil používateľa nebol nájdený alebo nemáte dostatočné povolenia.", "error");
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
      showLocalNotification("Chyba: Váš profil sa nepodarilo načítať. Skúste sa prosím odhlásiť a znova prihlásiť.", "error");
      setLoading(false);
      window.hideGlobalLoader(); // Skryjeme globálny loader aj pri chybe
    } else if (window.isGlobalAuthReady && !auth.currentUser) {
        console.log("MySettingsApp: Initial check - používateľ nie je prihlásený, ale globalAuthReady je true.");
        setLoading(false); // Ak nie je prihlásený, nie je čo načítavať
        window.hideGlobalLoader(); // Skryjeme globálny loader
        // Presmerovanie zabezpečuje authentication.js
    } else {
        window.showGlobalLoader(); // Zobrazíme globálny loader, ak ešte nie sú dáta pripravené
    }

    return () => {
      window.removeEventListener('globalDataUpdated', handleGlobalDataUpdated);
      window.hideGlobalLoader(); // Zabezpečíme skrytie loadera pri odpojení komponentu
    };
  }, [auth, db]); // Závisí od globálnych inštancií auth a db

  const handleUpdateNotificationsSetting = async () => {
    if (!db || !user) {
      showLocalNotification("Databáza alebo používateľ nie je k dispozícii.", "error");
      return;
    }
    setLoading(true);
    window.showGlobalLoader(); // Zobrazíme loader počas ukladania
    setNotification({ message: '', type: '' }); // Vyčistí predchádzajúce notifikácie

    try {
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        displayNotifications: displayNotifications
      });
      showLocalNotification("Nastavenie notifikácií úspešne aktualizované!", "success");
    } catch (e) {
      console.error("MySettingsApp: Chyba pri aktualizácii nastavenia notifikácií:", e);
      showLocalNotification(`Chyba pri aktualizácii nastavenia: ${e.message}`, "error");
    } finally {
      setLoading(false);
      window.hideGlobalLoader(); // Skryjeme loader po uložení (či už úspešnom alebo s chybou)
    }
  };

  // Zobrazovanie načítavacieho stavu alebo presmerovanie
  if (loading || (auth.currentUser && !userProfileData && !notification.message)) {
    if (!auth.currentUser && window.isGlobalAuthReady) {
        console.log("MySettingsApp: Používateľ je odhlásený po inicializácii.");
        return null; 
    }
    return null; 
  }

  // Notifikačný prvok
  const notificationElement = notification.message && React.createElement(
    'div',
    {
      className: `fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[99999] transition-all duration-500 ease-in-out transform scale-95 opacity-0 
                  ${notification.type === 'success' ? 'bg-green-500 text-white' : ''}
                  ${notification.type === 'error' ? 'bg-red-500 text-white' : ''}
                  ${notification.type === 'info' ? 'bg-blue-500 text-white' : ''}
                  ${notification.type === '' && 'bg-gray-700 text-white'}
                  `, // Default pre prípad, že type nie je definovaný
      role: 'alert',
      style: { transition: 'transform 0.5s ease-in-out, opacity 0.5s ease-in-out' } // Explicitné transition
    },
    React.createElement('strong', { className: 'font-bold' }, notification.type === 'error' ? 'Chyba! ' : (notification.type === 'success' ? 'Úspech! ' : '')),
    React.createElement('span', { className: 'block sm:inline' }, notification.message)
  );

  // Efekt pre animáciu notifikácie
  React.useEffect(() => {
    let timeoutId;
    if (notification.message) {
      const element = document.querySelector('.fixed.top-4.left-1\\/2');
      if (element) {
        // Force reflow for transition to work
        void element.offsetWidth; 
        element.style.opacity = '1';
        element.style.transform = 'translate(-50%, 0) scale(1)';
      }
    }
    return () => {
      clearTimeout(timeoutId);
    };
  }, [notification]);


  // Hlavné vykreslenie komponentu
  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
    React.createElement(
      'div',
      { className: 'w-full max-w-4xl mt-20 mb-10 p-4' },
      // Zobrazenie lokálnej notifikačnej správy (chybovej alebo úspešnej) ako pop-up
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
