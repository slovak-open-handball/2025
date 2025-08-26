// logged-in-my-settings.js
// Tento súbor obsahuje React komponent pre správu nastavení prihláseného používateľa.
// Predpokladá, že Firebase SDK je inicializovaný v authentication.js a globálne sprístupnený.

// Main React component for the logged-in-my-settings.html page
function MySettingsApp() {
  // Prístup k globálnym inštanciám Firebase z window objektu
  const auth = window.auth;
  const db = window.db;

  // Lokálne stavy pre data používateľa a načítanie
  const [user, setUser] = React.useState(null); // Bude aktualizované z globalDataUpdated
  const [userProfileData, setUserProfileData] = React.useState(null);
  const [loading, setLoading] = React.useState(true); // Loading pre data v MySettingsApp
  const [error, setError] = React.useState('');

  // Stavy pre užívateľské dáta (nastavenia notifikácií)
  const [displayNotifications, setDisplayNotifications] = React.useState(true);

  // Efekt pre počúvanie globálnych zmien autentifikácie a dát profilu
  React.useEffect(() => {
    // Unsubscribe funkcia z onSnapshot v authentication.js, nie v tomto komponente
    // let unsubscribeUserDoc; // Túto premennú už nebudeme používať lokálne

    const handleGlobalDataUpdated = (event) => {
      console.log("MySettingsApp: Prijatá udalosť 'globalDataUpdated'.");
      const globalUser = auth.currentUser; // Získame aktuálneho používateľa priamo z globálneho auth
      const globalProfileData = event.detail;

      setUser(globalUser);
      setUserProfileData(globalProfileData);
      setLoading(false); // Ukončíme loading, keď sú dáta prijaté

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

        // ODSTRÁNENÉ: Volanie window.updateMenuItemsVisibility, pretože táto funkcia je spravovaná v logged-in-left-menu.js
        // a MySettingsApp nemá priamy vplyv na jej vykonanie ani ju priamo nevolá.
        // Logika pre zobrazenie/skrytie položiek menu je riadená v logged-in-left-menu.js
        // prostredníctvom jeho listenera na globalDataUpdated.
        
        setError(''); // Vyčistí chyby po úspešnom načítaní
      } else {
        console.warn("MySettingsApp: Profilové dáta používateľa nie sú dostupné.");
        setError("Chyba: Profil používateľa nebol nájdený alebo nemáte dostatočné povolenia.");
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
    } else if (window.isGlobalAuthReady && !auth.currentUser) {
        console.log("MySettingsApp: Initial check - používateľ nie je prihlásený, ale globalAuthReady je true.");
        setLoading(false); // Ak nie je prihlásený, nie je čo načítavať
        // Presmerovanie zabezpečuje authentication.js
    }

    return () => {
      window.removeEventListener('globalDataUpdated', handleGlobalDataUpdated);
      // Odstránený unsubscribeUserDoc, pretože onSnapshot je spravovaný v authentication.js
    };
  }, [auth, db]); // Závisí od globálnych inštancií auth a db

  const handleUpdateNotificationsSetting = async () => {
    if (!db || !user) {
      setError("Databáza alebo používateľ nie je k dispozícii.");
      // Používame globálnu funkciu pre notifikácie
      if (window.showGlobalNotification) {
          window.showGlobalNotification("Databáza alebo používateľ nie je k dispozícii.", "error");
      }
      return;
    }
    setLoading(true);
    setError('');

    try {
      const userDocRef = db.collection('users').doc(user.uid);
      await userDocRef.update({
        displayNotifications: displayNotifications
      });
      // Používame globálnu funkciu pre notifikácie
      if (window.showGlobalNotification) {
          window.showGlobalNotification("Nastavenie notifikácií úspešne aktualizované!", "success");
      }
    } catch (e) {
      console.error("MySettingsApp: Chyba pri aktualizácii nastavenia notifikácií:", e);
      setError(`Chyba pri aktualizácii nastavenia: ${e.message}`);
      // Používame globálnu funkciu pre notifikácie
      if (window.showGlobalNotification) {
          window.showGlobalNotification(`Chyba pri aktualizácii nastavenia: ${e.message}`, "error");
      }
    } finally {
      setLoading(false);
    }
  };

  // Zobrazovanie načítavacieho stavu alebo presmerovanie
  if (loading || (auth.currentUser && !userProfileData && !error)) {
    // Ak user nie je null, ale userProfileData ešte nie je načítané, zobrazíme loader
    // Ak error nie je prázdny, znamená to, že nastala chyba a môžeme ju zobraziť.
    // Ak auth.currentUser je null, authentication.js by mal presmerovať.
    if (!auth.currentUser && window.isGlobalAuthReady) {
        // Ak je authReady, ale currentUser je null, znamená to, že používateľ je odhlásený.
        // authentication.js by ho mal presmerovať na login.html.
        console.log("MySettingsApp: Používateľ je odhlásený po inicializácii.");
        return null; // Nenecháme React komponent renderovať nič
    }

    return React.createElement(
      'div',
      { className: 'flex items-center justify-center min-h-screen bg-gray-100' },
      React.createElement('div', { className: 'text-xl font-semibold text-gray-700' }, 'Načítavam nastavenia...')
    );
  }

  // Ak existuje chyba a loading je false, zobrazíme chybu
  if (error && !loading) {
    return React.createElement(
      'div',
      { className: 'min-h-screen bg-gray-100 flex flex-col items-center justify-center font-inter p-4' },
      React.createElement(
        'div',
        { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative max-w-lg w-full text-center', role: 'alert' },
        React.createElement('strong', { className: 'font-bold' }, 'Chyba! '),
        React.createElement('span', { className: 'block sm:inline whitespace-pre-wrap' }, error)
      )
    );
  }

  // Hlavné vykreslenie komponentu
  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
    React.createElement(
      'div',
      { className: 'w-full max-w-4xl mt-20 mb-10 p-4' },
      // Chyby sa už zobrazujú cez globálne notifikácie, ale pre perzistentné chyby zostane táto oblasť
      error && React.createElement(
        'div',
        { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap', role: 'alert' },
        error
      ),
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
