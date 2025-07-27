// logged-in-all-registrations.js
// Tento súbor predpokladá, že firebaseConfig, initialAuthToken a appId
// sú globálne definované v <head> logged-in-all-registrations.html.

const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec";

// NotificationModal Component for displaying temporary messages (converted to React.createElement)
// Pridaný prop 'displayNotificationsEnabled'
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

// Main React component for the logged-in-all-registrations.html page
function AllRegistrationsApp() { // Zmena: MyDataApp na AllRegistrationsApp
  const [app, setApp] = React.useState(null);
  const [auth, setAuth] = React.useState(null);
  const [db, setDb] = React.useState(null);
  const [user, setUser] = React.useState(undefined); // Firebase User object from onAuthStateChanged
  // Nový stav pre dáta používateľského profilu z Firestore
  const [userProfileData, setUserProfileData] = React.useState(null); 
  const [isAuthReady, setIsAuthReady] = React.useState(false); // Nový stav pre pripravenosť autentifikácie
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [userNotificationMessage, setUserNotificationMessage] = React.useState('');

  // User Data States - Tieto stavy sa budú aktualizovať z userProfileData
  const [role, setRole] = React.useState('');
  const [isApproved, setIsApproved] = React.useState(false);

  // Effect for Firebase initialization and Auth Listener setup (runs only once)
  React.useEffect(() => {
    let unsubscribeAuth;
    let firestoreInstance;

    try {
      if (typeof firebase === 'undefined') {
        console.error("AllRegistrationsApp: Firebase SDK nie je načítané."); // Zmena logu
        setError("Firebase SDK nie je načítané. Skontrolujte logged-in-all-registrations.html."); // Zmena logu
        setLoading(false);
        return;
      }

      const firebaseApp = firebase.app();
      setApp(firebaseApp);

      const authInstance = firebase.auth(firebaseApp);
      setAuth(authInstance);
      firestoreInstance = firebase.firestore(firebaseApp);
      setDb(firestoreInstance);

      const signIn = async () => {
        try {
          if (initialAuthToken) {
            await authInstance.signInWithCustomToken(initialAuthToken);
          }
          // Ak initialAuthToken nie je k dispozícii, jednoducho sa spoliehame na onAuthStateChanged,
          // ktoré detekuje pretrvávajúci stav prihlásenia (napr. z login.html).
        } catch (e) {
          console.error("AllRegistrationsApp: Chyba pri počiatočnom prihlásení Firebase (s custom tokenom):", e); // Zmena logu
          setError(`Chyba pri prihlásení: ${e.message}`);
        }
      };

      unsubscribeAuth = authInstance.onAuthStateChanged(async (currentUser) => {
        console.log("AllRegistrationsApp: onAuthStateChanged - Používateľ:", currentUser ? currentUser.uid : "null"); // Zmena logu
        setUser(currentUser); // Nastaví Firebase User objekt
        setIsAuthReady(true); // Mark auth as ready after the first check
      });

      signIn();

      return () => {
        if (unsubscribeAuth) {
          unsubscribeAuth();
        }
      };
    } catch (e) {
      console.error("AllRegistrationsApp: Nepodarilo sa inicializovať Firebase:", e); // Zmena logu
      setError(`Chyba pri inicializácii Firebase: ${e.message}`);
      setLoading(false);
    }
  }, []);

  // NOVÝ EFFECT: Načítanie používateľských dát z Firestore po inicializácii Auth a DB
  React.useEffect(() => {
    let unsubscribeUserDoc;

    // Spustí sa len ak je Auth pripravené, DB je k dispozícii a user je definovaný (nie undefined)
    if (isAuthReady && db && user !== undefined) {
      if (user === null) { // Ak je používateľ null (nie je prihlásený), presmeruj
        console.log("AllRegistrationsApp: Auth je ready a používateľ je null, presmerovávam na login.html"); // Zmena logu
        window.location.href = 'login.html';
        return;
      }

      // Ak je používateľ prihlásený, pokús sa načítať jeho dáta z Firestore
      if (user) {
        console.log(`AllRegistrationsApp: Pokúšam sa načítať používateľský dokument pre UID: ${user.uid}`); // Zmena logu
        // Nastavíme loading na true, pretože začíname načítavať profilové dáta
        setLoading(true); // Nastavíme loading na true tu

        try {
          const userDocRef = db.collection('users').doc(user.uid);
          unsubscribeUserDoc = userDocRef.onSnapshot(docSnapshot => {
            if (docSnapshot.exists) {
              const userData = docSnapshot.data();
              console.log("AllRegistrationsApp: Používateľský dokument existuje, dáta:", userData); // Zmena logu

              // --- OKAMŽITÉ ODHLÁSENIE, AK passwordLastChanged NIE JE PLATNÝ TIMESTAMP ---
              // Toto je pridaná logika, ktorá sa spustí hneď po načítaní dát.
              // Ak je passwordLastChanged neplatný alebo chýba, odhlásiť.
              if (!userData.passwordLastChanged || typeof userData.passwordLastChanged.toDate !== 'function') {
                  console.error("AllRegistrationsApp: passwordLastChanged NIE JE platný Timestamp objekt! Typ:", typeof userData.passwordLastChanged, "Hodnota:", userData.passwordLastChanged); // Zmena logu
                  console.log("AllRegistrationsApp: Okamžite odhlasujem používateľa kvôli neplatnému timestampu zmeny hesla."); // Zmena logu
                  auth.signOut(); // Používame auth z React stavu
                  window.location.href = 'login.html';
                  localStorage.removeItem(`passwordLastChanged_${user.uid}`); // Vyčistíme localStorage
                  return; // Zastaviť ďalšie spracovanie
              }

              // Normal processing if passwordLastChanged is valid
              const firestorePasswordChangedTime = userData.passwordLastChanged.toDate().getTime();
              const localStorageKey = `passwordLastChanged_${user.uid}`;
              let storedPasswordChangedTime = parseInt(localStorage.getItem(localStorageKey) || '0', 10);

              console.log(`AllRegistrationsApp: Firestore passwordLastChanged (konvertované): ${firestorePasswordChangedTime}, Stored: ${storedPasswordChangedTime}`); // Zmena logu

              if (storedPasswordChangedTime === 0 && firestorePasswordChangedTime !== 0) {
                  // First load for this user/browser, initialize localStorage and do NOT logout
                  localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
                  console.log("AllRegistrationsApp: Inicializujem passwordLastChanged v localStorage (prvé načítanie)."); // Zmena logu
                  // No return here, continue with normal data processing for the first load
              } else if (firestorePasswordChangedTime > storedPasswordChangedTime) {
                  // Password was changed on another device/session
                  console.log("AllRegistrationsApp: Detekovaná zmena hesla na inom zariadení/relácii. Odhlasujem používateľa."); // Zmena logu
                  auth.signOut(); // Používame auth z React stavu
                  window.location.href = 'login.html';
                  localStorage.removeItem(localStorageKey); // Clear localStorage after logout
                  return;
              } else if (firestorePasswordChangedTime < storedPasswordChangedTime) {
                  // This should ideally not happen if Firestore is the source of truth
                  console.warn("AllRegistrationsApp: Detekovaný starší timestamp z Firestore ako uložený. Odhlasujem používateľa (potenciálny nesúlad)."); // Zmena logu
                  auth.signOut(); // Používame auth z React stavu
                  window.location.href = 'login.html';
                  localStorage.removeItem(localStorageKey);
                  return;
              } else {
                  // Times are equal, ensure localStorage is up-to-date
                  localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
                  console.log("AllRegistrationsApp: Timestampy sú rovnaké, aktualizujem localStorage."); // Zmena logu
              }

              setUserProfileData(userData); // Aktualizujeme stav userProfileData
              setLoading(false); // Stop loading po načítaní používateľských dát
              setError(''); // Vymazať chyby po úspešnom načítaní

              // Aktualizácia viditeľnosti menu po načítaní roly (volanie globálnej funkcie z left-menu.js)
              if (typeof updateMenuItemsVisibility === 'function') {
                  updateMenuItemsVisibility(userData.role);
              } else {
                  console.warn("AllRegistrationsApp: Funkcia updateMenuItemsVisibility nie je definovaná."); // Zmena logu
              }

              console.log("AllRegistrationsApp: Načítanie používateľských dát dokončené, loading: false"); // Zmena logu
            } else {
              console.warn("AllRegistrationsApp: Používateľský dokument sa nenašiel pre UID:", user.uid); // Zmena logu
              setError("Chyba: Používateľský profil sa nenašiel alebo nemáte dostatočné oprávnenia. Skúste sa prosím znova prihlásiť.");
              setLoading(false); // Zastaví načítavanie, aby sa zobrazila chyba
            }
          }, error => {
            console.error("AllRegistrationsApp: Chyba pri načítaní používateľských dát z Firestore (onSnapshot error):", error); // Zmena logu
            if (error.code === 'permission-denied') {
                setError(`Chyba oprávnení: Nemáte prístup k svojmu profilu. Skúste sa prosím znova prihlásiť alebo kontaktujte podporu.`);
            } else if (error.code === 'unavailable') {
                setError(`Chyba pripojenia: Služba Firestore je nedostupná. Skúste to prosím neskôr.`);
            } else if (error.code === 'unauthenticated') {
                 setError(`Chyba autentifikácie: Nie ste prihlásený. Skúste sa prosím znova prihlásiť.`);
                 if (auth) {
                    auth.signOut();
                    window.location.href = 'login.html';
                 }
            } else {
                setError(`Chyba pri načítaní používateľských dát: ${error.message}`);
            }
            setLoading(false); // Stop loading aj pri chybe
            console.log("AllRegistrationsApp: Načítanie používateľských dát zlyhalo, loading: false"); // Zmena logu
          });
        } catch (e) {
          console.error("AllRegistrationsApp: Chyba pri nastavovaní onSnapshot pre používateľské dáta (try-catch):", e); // Zmena logu
          setError(`Chyba pri nastavovaní poslucháča pre používateľské dáta: ${e.message}`);
          setLoading(false); // Stop loading aj pri chybe
        }
      }
    } else if (isAuthReady && user === undefined) {
        console.log("AllRegistrationsApp: Auth ready, user undefined. Nastavujem loading na false."); // Zmena logu
        setLoading(false);
    }


    return () => {
      // Zrušíme odber onSnapshot pri unmount
      if (unsubscribeUserDoc) {
        console.log("AllRegistrationsApp: Ruším odber onSnapshot pre používateľský dokument."); // Zmena logu
        unsubscribeUserDoc();
      }
    };
  }, [isAuthReady, db, user, auth]);

  // useEffect for updating header link visibility
  React.useEffect(() => {
    console.log(`AllRegistrationsApp: useEffect pre aktualizáciu odkazov hlavičky. User: ${user ? user.uid : 'null'}`); // Zmena logu
    const authLink = document.getElementById('auth-link');
    const profileLink = document.getElementById('profile-link');
    const logoutButton = document.getElementById('logout-button');
    const registerLink = document.getElementById('register-link');

    if (authLink) {
      if (user) { // If user is logged in
        authLink.classList.add('hidden');
        profileLink && profileLink.classList.remove('hidden');
        logoutButton && logoutButton.classList.remove('hidden');
        registerLink && registerLink.classList.add('hidden');
        console.log("AllRegistrationsApp: Používateľ prihlásený. Skryté: Prihlásenie, Registrácia. Zobrazené: Moja zóna, Odhlásenie."); // Zmena logu
      } else { // If user is not logged in
        authLink.classList.remove('hidden');
        profileLink && profileLink.classList.add('hidden');
        logoutButton && logoutButton.classList.add('hidden');
        // Register link visibility will now be handled by register.js based on registration settings
        // For logged-in-all-registrations.html, if not logged in, register link should be visible by default
        registerLink && registerLink.classList.remove('hidden'); 
        console.log("AllRegistrationsApp: Používateľ odhlásený. Zobrazené: Prihlásenie, Registrácia. Skryté: Moja zóna, Odhlásenie."); // Zmena logu
      }
    }
  }, [user]);

  // Handle logout (needed for the header logout button)
  const handleLogout = React.useCallback(async () => {
    if (!auth) return;
    try {
      setLoading(true);
      await auth.signOut();
      setUserNotificationMessage("Úspešne odhlásený.");
      window.location.href = 'login.html';
    } catch (e) {
      console.error("AllRegistrationsApp: Chyba pri odhlásení:", e); // Zmena logu
      setError(`Chyba pri odhlásení: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [auth]);

  // Attach logout handler to the button in the header
  React.useEffect(() => {
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
      logoutButton.addEventListener('click', handleLogout);
    }
    return () => {
      if (logoutButton) {
        logoutButton.removeEventListener('click', handleLogout);
      }
    };
  }, [handleLogout]);

  // Display loading state
  if (!isAuthReady || user === undefined || (user && !userProfileData) || loading) {
    if (isAuthReady && user === null) {
        console.log("AllRegistrationsApp: Auth je ready a používateľ je null, presmerovávam na login.html"); // Zmena logu
        window.location.href = 'login.html';
        return null;
    }
    let loadingMessage = 'Načítavam...';
    if (isAuthReady && user && !userProfileData) {
        loadingMessage = 'Načítavam...'; // Špecifická správa pre profilové dáta
    } else if (loading) { // Všeobecný stav načítavania, napr. pri odosielaní formulára
        loadingMessage = 'Načítavam...';
    }

    return React.createElement(
      'div',
      { className: 'flex items-center justify-center min-h-screen bg-gray-100' },
      React.createElement('div', { className: 'text-xl font-semibold text-gray-700' }, loadingMessage)
    );
  }

  // Ak používateľ nie je admin alebo nie je schválený, zobrazíme mu chybu
  if (userProfileData.role !== 'admin' || userProfileData.approved === false) {
      return React.createElement(
          'div',
          { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
          React.createElement(NotificationModal, {
              message: userNotificationMessage,
              onClose: () => setUserNotificationMessage(''),
              displayNotificationsEnabled: userProfileData?.displayNotifications
          }),
          React.createElement(
              'div',
              { className: 'w-full max-w-4xl mt-20 mb-10 p-4' },
              React.createElement(
                  'div',
                  { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4', role: 'alert' },
                  error || "Nemáte oprávnenie na zobrazenie tejto stránky. Iba schválení administrátori majú prístup."
              )
          )
      );
  }

  // Ak je používateľ admin a schválený, zobrazíme mu tabuľku registrácií
  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
    React.createElement(NotificationModal, {
        message: userNotificationMessage,
        onClose: () => setUserNotificationMessage(''),
        displayNotificationsEnabled: userProfileData?.displayNotifications
    }),
    React.createElement(
      'div',
      { className: 'w-full max-w-7xl mt-20 mb-10 p-4' },
      error && React.createElement(
        'div',
        { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap', role: 'alert' },
        error
      ),
      React.createElement(
        'div',
        { className: 'bg-white p-8 rounded-lg shadow-xl w-full' },
        React.createElement('h1', { className: 'text-3xl font-bold text-center text-gray-800 mb-6' },
          'Všetky registrácie' // Zmenený hlavný nadpis
        ),
        // Tu by bol kód pre tabuľku registrácií
        React.createElement(
            'p',
            { className: 'text-gray-700 text-center text-xl' },
            'Tabuľka všetkých registrácií sa tu zobrazí po implementácii logiky načítania a zobrazenia dát.'
        )
      )
    )
  );
}

// Explicitne sprístupniť komponent globálne
window.AllRegistrationsApp = AllRegistrationsApp;
