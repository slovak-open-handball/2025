// logged-in-change-name.js
// Tento súbor predpokladá, že Firebase SDK je inicializovaný v <head> logged-in-change-name.html
// a GlobalNotificationHandler v header.js spravuje globálnu autentifikáciu a stav používateľa.

// NotificationModal Component for displaying temporary messages (converted to React.createElement)
// Ponechané pre zobrazovanie správ o spätnej väzbe pre používateľa v tomto module.
function NotificationModal({ message, onClose, type = 'info' }) {
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
      }
    };
  }, [message, onClose]);

  if (!show && !message) return null;

  let bgColorClass;
  if (type === 'success') {
    bgColorClass = 'bg-[#3A8D41]'; // Zelená
  } else if (type === 'error') {
    bgColorClass = 'bg-red-600'; // Červená
  } else {
    bgColorClass = 'bg-blue-500'; // Predvolená modrá pre info
  }

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
        className: `${bgColorClass} text-white px-6 py-3 rounded-lg shadow-lg max-w-md w-full text-center`,
        style: { pointerEvents: 'auto' }
      },
      React.createElement('p', { className: 'font-semibold' }, message)
    )
  );
}

// Main React component for the logged-in-change-name.html page
function ChangeNameApp() {
  // NOVÉ: Získame referencie na Firebase služby priamo
  const app = firebase.app();
  const auth = firebase.auth(app);
  const db = firebase.firestore(app);

  // NOVÉ: Lokálny stav pre aktuálneho používateľa a jeho profilové dáta
  // Tieto stavy budú aktualizované lokálnym onAuthStateChanged a onSnapshot
  const [user, setUser] = React.useState(auth.currentUser); // Inicializovať s aktuálnym používateľom
  const [userProfileData, setUserProfileData] = React.useState(null); 

  const [loading, setLoading] = React.useState(true); // Loading pre dáta v ChangeNameApp
  const [error, setError] = React.useState('');
  // PONECHANÉ: userNotificationMessage pre lokálne notifikácie
  const [userNotificationMessage, setUserNotificationMessage] = React.useState('');

  // User Data States - Tieto stavy sa budú aktualizovať z userProfileData
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');

  // NOVINKA: Stav pre dátum uzávierky úprav dát
  const [dataEditDeadline, setDataEditDeadline] = React.useState(null);
  const [settingsLoaded, setSettingsLoaded] = React.useState(false);

  // NOVINKA: Memoizovaná hodnota pre povolenie úprav dát
  const isDataEditingAllowed = React.useMemo(() => {
    // Ak je používateľ admin, vždy povoliť úpravy
    if (userProfileData && userProfileData.role === 'admin') {
      return true;
    }
    // Inak platí pôvodná logika pre dátum uzávierky
    if (!settingsLoaded || !dataEditDeadline) return true; // Ak nastavenia nie sú načítané alebo dátum nie je definovaný, povoliť úpravy
    const now = new Date();
    const deadline = new Date(dataEditDeadline);
    return now <= deadline;
  }, [settingsLoaded, dataEditDeadline, userProfileData]); // Pridaný userProfileData do závislostí

  // NOVÉ: Lokálny Auth Listener pre ChangeNameApp
  // Tento listener zabezpečí, že ChangeNameApp reaguje na zmeny autentifikácie,
  // ale primárne odhlásenie/presmerovanie spravuje GlobalNotificationHandler.
  React.useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(currentUser => {
      console.log("ChangeNameApp: Lokálny onAuthStateChanged - Používateľ:", currentUser ? currentUser.uid : "null");
      setUser(currentUser);
      // Ak používateľ nie je prihlásený, presmerujeme ho (aj keď by to mal spraviť GNH)
      if (!currentUser) {
        console.log("ChangeNameApp: Používateľ nie je prihlásený, presmerovávam na login.html.");
        window.location.href = 'login.html';
      }
    });
    return () => unsubscribeAuth();
  }, [auth]); // Závisí od auth inštancie

  // NOVÉ: Lokálny Effect pre načítanie používateľských dát z Firestore
  // Tento efekt sa spustí, keď je používateľ prihlásený a db je k dispozícii.
  // Predpokladá sa, že passwordLastChanged a approved status sú už overené v header.js.
  React.useEffect(() => {
    let unsubscribeUserDoc;

    if (user && db) { // Spustí sa len ak je používateľ prihlásený a db je k dispozícii
      console.log(`ChangeNameApp: Pokúšam sa načítať používateľský dokument pre UID: ${user.uid}`);
      setLoading(true); // Nastavíme loading na true, kým sa načítajú dáta profilu

      try {
        const userDocRef = db.collection('users').doc(user.uid);
        unsubscribeUserDoc = userDocRef.onSnapshot(docSnapshot => {
          console.log("ChangeNameApp: onSnapshot pre používateľský dokument spustený.");
          if (docSnapshot.exists) {
            const userData = docSnapshot.data();
            console.log("ChangeNameApp: Používateľský dokument existuje, dáta:", userData);

            // --- OKAMŽITÉ ODHLÁSENIE, AK passwordLastChanged NIE JE PLATNÝ TIMESTAMP ---
            // Toto je pridaná logika, ktorá sa spustí hneď po načítaní dát.
            // Ak je passwordLastChanged neplatný alebo chýba, odhlásiť.
            if (!userData.passwordLastChanged || typeof userData.passwordLastChanged.toDate !== 'function') {
                console.error("ChangeNameApp: passwordLastChanged NIE JE platný Timestamp objekt! Typ:", typeof userData.passwordLastChanged, "Hodnota:", userData.passwordLastChanged);
                console.log("ChangeNameApp: Okamžite odhlasujem používateľa kvôli neplatnému timestampu zmeny hesla.");
                auth.signOut(); // Používame auth z React stavu
                window.location.href = 'login.html';
                localStorage.removeItem(`passwordLastChanged_${user.uid}`); // Vyčistíme localStorage
                setUser(null); // Explicitne nastaviť user na null
                setUserProfileData(null); // Explicitne nastaviť userProfileData na null
                return; // Zastaviť ďalšie spracovanie
            }

            // Normálne spracovanie, ak je passwordLastChanged platný
            const firestorePasswordChangedTime = userData.passwordLastChanged.toDate().getTime();
            const localStorageKey = `passwordLastChanged_${user.uid}`;
            let storedPasswordChangedTime = parseInt(localStorage.getItem(localStorageKey) || '0', 10);

            console.log(`ChangeNameApp: Firestore passwordLastChanged (konvertované): ${firestorePasswordChangedTime}, Uložené: ${storedPasswordChangedTime}`);

            if (storedPasswordChangedTime === 0 && firestorePasswordChangedTime !== 0) {
                // Prvé načítanie pre tohto používateľa/prehliadač, inicializuj localStorage a NEODHLASUJ
                localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
                console.log("ChangeNameApp: Inicializujem passwordLastChanged v localStorage (prvé načítanie).");
                // Nepokračujeme tu, pokračujeme s normálnym spracovaním dát pre prvé načítanie
            } else if (firestorePasswordChangedTime > storedPasswordChangedTime) {
                // Heslo bolo zmenené na inom zariadení/relácii
                console.log("ChangeNameApp: Detekovaná zmena hesla na inom zariadení/relácii. Odhlasujem používateľa.");
                auth.signOut(); // Používame auth z React stavu
                window.location.href = 'login.html';
                localStorage.removeItem(localStorageKey); // Vyčistiť localStorage po odhlásení
                setUser(null); // Explicitne nastaviť user na null
                setUserProfileData(null); // Explicitne nastaviť userProfileData na null
                return;
            } else if (firestorePasswordChangedTime < storedPasswordChangedTime) {
                // Toto by sa ideálne nemalo stať, ak je Firestore zdrojom pravdy
                console.warn("ChangeNameApp: Detekovaný starší timestamp z Firestore ako uložený. Odhlasujem používateľa (potenciálny nesúlad).");
                auth.signOut(); // Používame auth z React stavu
                window.location.href = 'login.html';
                localStorage.removeItem(localStorageKey);
                setUser(null); // Explicitne nastaviť user na null
                setUserProfileData(null); // Explicitne nastaviť userProfileData na null
                return;
            } else {
                // Časy sú rovnaké, zabezpečte, aby bol localStorage aktuálny
                localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
                console.log("ChangeNameApp: Timestampy sú rovnaké, aktualizujem localStorage.");
            }

            // NOVÁ LOGIKA: Odhlásenie, ak je používateľ admin a nie je schválený
            if (userData.role === 'admin' && userData.approved === false) {
                console.log("ChangeNameApp: Používateľ je admin a nie je schválený. Odhlasujem.");
                auth.signOut();
                window.location.href = 'login.html';
                setUser(null); // Explicitne nastaviť user na null
                setUserProfileData(null); // Explicitne nastaviť userProfileData na null
                return; // Zastav ďalšie spracovanie
            }

            setUserProfileData(userData); // Aktualizujeme stav userProfileData
            
            // Aktualizujeme lokálne stavy z userProfileData
            setFirstName(userData.firstName || '');
            setLastName(userData.lastName || '');
            
            setLoading(false); // Zastavíme načítavanie po načítaní používateľských dát
            setError(''); // Vymazať chyby po úspešnom načítaní

            // Aktualizácia viditeľnosti menu po načítaní roly (volanie globálnej funkcie z left-menu.js)
            if (typeof window.updateMenuItemsVisibility === 'function') {
                window.updateMenuItemsVisibility(userData.role);
            } else {
                console.warn("ChangeNameApp: Funkcia updateMenuItemsVisibility nie je definovaná.");
            }

            console.log("ChangeNameApp: Načítanie používateľských dát dokončené, loading: false");
          } else {
            console.warn("ChangeNameApp: Používateľský dokument sa nenašiel pre UID:", user.uid);
            setError("Chyba: Používateľský profil sa nenašiel alebo nemáte dostatočné oprávnenia. Skúste sa prosím znova prihlásiť.");
            setLoading(false); // Zastaví načítavanie, aby sa zobrazila chyba
            setUser(null); // Explicitne nastaviť user na null
            setUserProfileData(null); // Explicitne nastaviť userProfileData na null
          }
        }, error => {
          console.error("ChangeNameApp: Chyba pri načítaní používateľských dát z Firestore (onSnapshot error):", error);
          if (error.code === 'permission-denied') {
              setError(`Chyba oprávnení: Nemáte prístup k svojmu profilu. Skúste sa prosím znova prihlásiť alebo kontaktujte podporu.`);
          } else if (error.code === 'unavailable') {
              setError(`Chyba pripojenia: Služba Firestore je nedostupná. Skúste to prosím neskôr.`);
          } else if (error.code === 'unauthenticated') {
               setError(`Chyba autentifikácie: Nie ste prihlásený. Skúste sa prosím znova prihlásiť.`);
               if (auth) {
                  auth.signOut();
                  window.location.href = 'login.html';
                  setUser(null); // Explicitne nastaviť user na null
                  setUserProfileData(null); // Explicitne nastaviť userProfileData na null
               }
          } else {
              setError(`Chyba pri načítaní používateľských dát: ${error.message}`);
          }
          setLoading(false); // Zastaví načítavanie aj pri chybe
          console.log("ChangeNameApp: Načítanie používateľských dát zlyhalo, loading: false");
          setUser(null); // Explicitne nastaviť user na null
          setUserProfileData(null); // Explicitne nastaviť userProfileData na null
        });
      } catch (e) {
        console.error("ChangeNameApp: Chyba pri nastavovaní onSnapshot pre používateľské dáta (try-catch):", e);
        setError(`Chyba pri nastavovaní poslucháča pre používateľské dáta: ${e.message}`);
        setLoading(false);
        setUser(null); // Explicitne nastaviť user na null
        setUserProfileData(null); // Explicitne nastaviť userProfileData na null
      }
    } else if (user === null) {
        // Ak je user null (a už nie undefined), znamená to, že bol odhlásený.
        // Presmerovanie už by mal spraviť GlobalNotificationHandler.
        // Tu len zabezpečíme, že loading je false a dáta sú vyčistené.
        setLoading(false);
        setUserProfileData(null);
    }

    return () => {
      // Zrušíme odber onSnapshot pri unmount
      if (unsubscribeUserDoc) {
        console.log("ChangeNameApp: Ruším odber onSnapshot pre používateľský dokument.");
        unsubscribeUserDoc();
      }
    };
  }, [user, db, auth]); // Závisí od user a db (a auth pre signOut)

  // NOVINKA: Effect pre načítanie nastavení (dátum uzávierky úprav)
  React.useEffect(() => {
    let unsubscribeSettings;
    const fetchSettings = async () => {
      if (!db) {
        console.log("ChangeNameApp: Čakám na DB pre načítanie nastavení.");
        return;
      }
      try {
          console.log("ChangeNameApp: Pokúšam sa načítať nastavenia registrácie pre dátum uzávierky.");
          const settingsDocRef = db.collection('settings').doc('registration');
          unsubscribeSettings = settingsDocRef.onSnapshot(docSnapshot => {
            console.log("ChangeNameApp: onSnapshot pre nastavenia registrácie spustený.");
            if (docSnapshot.exists) {
                const data = docSnapshot.data();
                console.log("ChangeNameApp: Nastavenia registrácie existujú, dáta:", data);
                setDataEditDeadline(data.dataEditDeadline ? data.dataEditDeadline.toDate().toISOString() : null); // Používame ISO string pre konzistentnosť
            } else {
                console.log("ChangeNameApp: Nastavenia registrácie sa nenašli v Firestore. Dátum uzávierky úprav nie je definovaný.");
                setDataEditDeadline(null);
            }
            setSettingsLoaded(true);
            console.log("ChangeNameApp: Načítanie nastavení dokončené, settingsLoaded: true.");
          }, error => {
            console.error("ChangeNameApp: Chyba pri načítaní nastavení registrácie (onSnapshot error):", error);
            setError(`Chyba pri načítaní nastavení: ${error.message}`);
            setSettingsLoaded(true);
          });

          return () => {
            if (unsubscribeSettings) {
                console.log("ChangeNameApp: Ruším odber onSnapshot pre nastavenia registrácie.");
                unsubscribeSettings();
            }
          };
      } catch (e) {
          console.error("ChangeNameApp: Chyba pri nastavovaní onSnapshot pre nastavenia registrácie (try-catch):", e);
          setError(`Chyba pri nastavovaní poslucháča pre nastavenia: ${e.message}`);
          setSettingsLoaded(true);
      }
    };

    fetchSettings();
  }, [db]); // Závisí len od 'db'

  const handleUpdateName = async (e) => {
    e.preventDefault();
    // NOVINKA: Kontrola povolenia úprav dát
    if (!isDataEditingAllowed) {
      setError("Úpravy mena a priezviska sú po uzávierke zakázané.");
      return;
    }

    // NOVINKA: Kontrola, či sú polia prázdne pred odoslaním
    if (firstName.trim() === '' || lastName.trim() === '') {
        setError("Meno a priezvisko nesmú byť prázdne.");
        return;
    }

    if (!db || !user || !userProfileData) {
      setError("Databáza alebo používateľ nie je k dispozícii.");
      return;
    }
    setLoading(true);
    setError('');
    setUserNotificationMessage('');

    try {
      const userDocRef = db.collection('users').doc(user.uid);
      await userDocRef.update({
        firstName: firstName,
        lastName: lastName,
      });
      await user.updateProfile({ displayName: `${firstName} ${lastName}` });
      setUserNotificationMessage("Meno a priezvisko úspešne aktualizované!");

      // --- Logika pre ukladanie notifikácie pre administrátorov ---
      // Notifikáciu uložíme pre všetkých adminov, ak zmenu vykonal bežný používateľ.
      // Ak zmenu vykonal admin, notifikácia je pre neho.
      try {
          // Používame pevne zadané 'default-app-id' pre cestu k notifikáciám
          const appId = 'default-app-id'; 
          let notificationMessage = '';
          let notificationRecipientId = '';

          // Zmena tu: Konkrétna správa o zmene mena a priezviska
          if (userProfileData.role === 'user') {
              notificationMessage = `Používateľ ${userProfileData.email} si zmenil meno na ${firstName} a priezvisko na ${lastName}.`;
              notificationRecipientId = 'all_admins'; // Notifikácia pre všetkých administrátorov
          } else if (userProfileData.role === 'admin') {
              notificationMessage = `Administrátor ${userProfileData.email} si zmenil meno na ${firstName} a priezvisko na ${lastName}.`;
              notificationRecipientId = user.uid; // Notifikácia pre tohto konkrétneho administrátora
          }

          if (notificationMessage) {
              await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('adminNotifications').add({
                  message: notificationMessage,
                  timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                  recipientId: notificationRecipientId,
                  read: false
              });
              console.log("Notifikácia o zmene mena/priezviska úspešne uložená do Firestore.");
          }
      } catch (e) {
          console.error("ChangeNameApp: Chyba pri ukladaní notifikácie o zmene mena/priezviska:", e);
      }
      // --- Koniec logiky pre ukladania notifikácie ---

    } catch (e) {
      console.error("ChangeNameApp: Chyba pri aktualizácii mena a priezviska:", e);
      setError(`Chyba pri aktualizácii mena a priezviska: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // NOVINKA: Kontrola, či je formulár platný pre povolenie tlačidla
  const isFormValid = firstName.trim() !== '' && lastName.trim() !== '';

  // Display loading state
  if (!user || (user && !userProfileData) || !settingsLoaded || loading) {
    if (user === null) {
        console.log("ChangeNameApp: Používateľ je null, presmerovávam na login.html");
        window.location.href = 'login.html';
        return null;
    }
    let loadingMessage = 'Načítavam...';
    if (user && !settingsLoaded) { // NOVINKA: Čakanie na načítanie nastavení
        loadingMessage = 'Načítavam nastavenia...';
    } else if (user && settingsLoaded && !userProfileData) {
        loadingMessage = 'Načítavam profilové dáta...';
    } else if (loading) {
        loadingMessage = 'Ukladám zmeny...';
    }

    return React.createElement(
      'div',
      { className: 'flex items-center justify-center min-h-screen bg-gray-100' },
      React.createElement('div', { className: 'text-xl font-semibold text-gray-700' }, loadingMessage)
    );
  }

  // Redirect if user is not 'user' role
  if (userProfileData && userProfileData.role !== 'user') {
      console.log("ChangeNameApp: Používateľ nemá rolu 'user'. Presmerovávam na logged-in-my-data.html.");
      window.location.href = 'logged-in-my-data.html';
      return null;
  }

  // Dynamické triedy pre tlačidlo na základe stavu disabled
  const buttonClasses = `
    font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200
    ${loading || !isDataEditingAllowed || !isFormValid // ZMENA: Pridaná kontrola isFormValid
      ? 'bg-white text-blue-500 border border-blue-500 cursor-not-allowed' // Zakázaný stav
      : 'bg-blue-500 hover:bg-blue-700 text-white' // Aktívny stav
    }
  `;

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
    React.createElement(NotificationModal, {
        message: userNotificationMessage,
        onClose: () => setUserNotificationMessage('')
    }),
    React.createElement(
      'div',
      { className: 'w-full max-w-4xl mt-20 mb-10 p-4' },
      error && React.createElement(
        'div',
        { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap', role: 'alert' },
        error
      ),
      // NOVINKA: Správa o uzávierke úprav
      // Zobrazí sa len, ak používateľ nie je admin a úpravy nie sú povolené
      !isDataEditingAllowed && userProfileData && userProfileData.role !== 'admin' && React.createElement(
        'div',
        { className: 'bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap', role: 'alert' },
        `Úpravy mena a priezviska sú povolené len do ${dataEditDeadline ? new Date(dataEditDeadline).toLocaleDateString('sk-SK') + ' ' + new Date(dataEditDeadline).toLocaleTimeString('sk-SK') : 'nedefinovaného dátumu'}.`
      ),
      React.createElement(
        'div',
        { className: 'bg-white p-8 rounded-lg shadow-xl w-full' },
        React.createElement('h1', { className: 'text-3xl font-bold text-center text-gray-800 mb-6' },
          'Zmeniť meno a priezvisko' // Hlavný nadpis
        ),
        // Change Name Section
        React.createElement(
          React.Fragment,
          null,
          // Odstránený podnadpis h2
          React.createElement(
            'form',
            { onSubmit: handleUpdateName, className: 'space-y-4' },
            React.createElement(
              'div',
              null,
              React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'first-name' }, 'Meno'),
              React.createElement('input', {
                type: 'text',
                id: 'first-name',
                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                value: firstName,
                onChange: (e) => setFirstName(e.target.value),
                required: true,
                disabled: loading || !isDataEditingAllowed, // NOVINKA: Disabled ak je po uzávierke
              })
            ),
            React.createElement(
              'div',
              null,
              React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'last-name' }, 'Priezvisko'),
              React.createElement('input', {
                type: 'text',
                id: 'last-name',
                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                value: lastName,
                onChange: (e) => setLastName(e.target.value),
                required: true,
                disabled: loading || !isDataEditingAllowed, // NOVINKA: Disabled ak je po uzávierke
              })
            ),
            React.createElement(
              'button',
              {
                type: 'submit',
                className: buttonClasses, // Použitie dynamických tried
                disabled: loading || !isDataEditingAllowed || !isFormValid, // ZMENA: Disabled ak je po uzávierke alebo formulár nie je platný
              },
              loading ? 'Ukladám...' : 'Uložiť zmeny'
            )
          )
        )
      )
    )
  );
}

// Explicitne sprístupniť komponent globálne
window.ChangeNameApp = ChangeNameApp;
