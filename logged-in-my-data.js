// logged-in-my-data.js
// Tento súbor predpokladá, že firebaseConfig, initialAuthToken a appId
// sú globálne definované v <head> logged-in-my-data.html.

// const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec";

//const formatToDatetimeLocal = (date) => {
//  if (!date) return '';
//  const year = date.getFullYear();
//  const month = (date.getMonth() + 1).toString().padStart(2, '0');
//  const day = date.getDate().toString().padStart(2, '0');
//  const hours = date.getHours().toString().padStart(2, '0');
//  const minutes = date.getMinutes().toString().padStart(2, '0');
//  return `${year}-${month}-${day}T${hours}:${minutes}`;
//};

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

// Main React component for the logged-in-my-data.html page
function MyDataApp() {
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
  // Removed contactPhoneNumber, email states as they are no longer editable here
  const [role, setRole] = React.useState('');
  const [isApproved, setIsApproved] = React.useState(false);

  // Effect for Firebase initialization and Auth Listener setup (runs only once)
  React.useEffect(() => {
    let unsubscribeAuth;
    let firestoreInstance;

    try {
      if (typeof firebase === 'undefined') {
        console.error("MyDataApp: Firebase SDK nie je načítané.");
        setError("Firebase SDK nie je načítané. Skontrolujte logged-in-my-data.html.");
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
          console.error("MyDataApp: Chyba pri počiatočnom prihlásení Firebase (s custom tokenom):", e);
          setError(`Chyba pri prihlásení: ${e.message}`);
        }
      };

      unsubscribeAuth = authInstance.onAuthStateChanged(async (currentUser) => {
        console.log("MyDataApp: onAuthStateChanged - Používateľ:", currentUser ? currentUser.uid : "null");
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
      console.error("MyDataApp: Nepodarilo sa inicializovať Firebase:", e);
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
        console.log("MyDataApp: Auth je ready a používateľ je null, presmerovávam na login.html");
        window.location.href = 'login.html';
        return;
      }

      // Ak je používateľ prihlásený, pokús sa načítať jeho dáta z Firestore
      if (user) {
        console.log(`MyDataApp: Pokúšam sa načítať používateľský dokument pre UID: ${user.uid}`);
        // Nastavíme loading na true, pretože začíname načítavať profilové dáta
        setLoading(true); // Nastavíme loading na true tu

        try {
          const userDocRef = db.collection('users').doc(user.uid);
          unsubscribeUserDoc = userDocRef.onSnapshot(docSnapshot => {
            if (docSnapshot.exists) {
              const userData = docSnapshot.data();
              console.log("MyDataApp: Používateľský dokument existuje, dáta:", userData);

              // --- OKAMŽITÉ ODHLÁSENIE, AK passwordLastChanged NIE JE PLATNÝ TIMESTAMP ---
              // Toto je pridaná logika, ktorá sa spustí hneď po načítaní dát.
              // Ak je passwordLastChanged neplatný alebo chýba, odhlásiť.
              if (!userData.passwordLastChanged || typeof userData.passwordLastChanged.toDate !== 'function') {
                  console.error("MyDataApp: passwordLastChanged NIE JE platný Timestamp objekt! Typ:", typeof userData.passwordLastChanged, "Hodnota:", userData.passwordLastChanged);
                  console.log("MyDataApp: Okamžite odhlasujem používateľa kvôli neplatnému timestampu zmeny hesla.");
                  auth.signOut(); // Používame auth z React stavu
                  window.location.href = 'login.html';
                  localStorage.removeItem(`passwordLastChanged_${user.uid}`); // Vyčistíme localStorage
                  setUser(null); // Explicitne nastaviť user na null
                  setUserProfileData(null); // Explicitne nastaviť userProfileData na null
                  return; // Zastaviť ďalšie spracovanie
              }

              // Normal processing if passwordLastChanged is valid
              const firestorePasswordChangedTime = userData.passwordLastChanged.toDate().getTime();
              const localStorageKey = `passwordLastChanged_${user.uid}`;
              let storedPasswordChangedTime = parseInt(localStorage.getItem(localStorageKey) || '0', 10);

              console.log(`MyDataApp: Firestore passwordLastChanged (konvertované): ${firestorePasswordChangedTime}, Stored: ${storedPasswordChangedTime}`);

              if (storedPasswordChangedTime === 0 && firestorePasswordChangedTime !== 0) {
                  // First load for this user/browser, initialize localStorage and do NOT logout
                  localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
                  console.log("MyDataApp: Inicializujem passwordLastChanged v localStorage (prvé načítanie).");
                  // No return here, continue with normal data processing for the first load
              } else if (firestorePasswordChangedTime > storedPasswordChangedTime) {
                  // Password was changed on another device/session
                  console.log("MyDataApp: Detekovaná zmena hesla na inom zariadení/relácii. Odhlasujem používateľa.");
                  auth.signOut(); // Používame auth z React stavu
                  window.location.href = 'login.html';
                  localStorage.removeItem(localStorageKey); // Clear localStorage after logout
                  setUser(null); // Explicitne nastaviť user na null
                  setUserProfileData(null); // Explicitne nastaviť userProfileData na null
                  return;
              } else if (firestorePasswordChangedTime < storedPasswordChangedTime) {
                  // This should ideally not happen if Firestore is the source of truth
                  console.warn("MyDataApp: Detekovaný starší timestamp z Firestore ako uložený. Odhlasujem používateľa (potenciálny nesúlad).");
                  auth.signOut(); // Používame auth z React stavu
                  window.location.href = 'login.html';
                  localStorage.removeItem(localStorageKey);
                  setUser(null); // Explicitne nastaviť user na null
                  setUserProfileData(null); // Explicitne nastaviť userProfileData na null
                  return;
              } else {
                  // Times are equal, ensure localStorage is up-to-date
                  localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
                  console.log("MyDataApp: Timestampy sú rovnaké, aktualizujem localStorage.");
              }

              // NOVÁ LOGIKA: Odhlásenie, ak je používateľ admin a nie je schválený
              if (userData.role === 'admin' && userData.approved === false) {
                  console.log("MyDataApp: Používateľ je admin a nie je schválený. Odhlasujem.");
                  auth.signOut();
                  window.location.href = 'login.html';
                  setUser(null); // Explicitne nastaviť user na null
                  setUserProfileData(null); // Explicitne nastaviť userProfileData na null
                  return; // Zastav ďalšie spracovanie
              }

              // Continue with setting user data if not logged out
              setUserProfileData(userData); // Aktualizujeme stav userProfileData
              setLoading(false); // Stop loading po načítaní používateľských dát
              setError(''); // Vymazať chyby po úspešnom načítaní

              // Aktualizácia viditeľnosti menu po načítaní roly (volanie globálnej funkcie z left-menu.js)
              if (typeof updateMenuItemsVisibility === 'function') {
                  updateMenuItemsVisibility(userData.role);
              } else {
                  console.warn("MyDataApp: Funkcia updateMenuItemsVisibility nie je definovaná.");
              }

              console.log("MyDataApp: Načítanie používateľských dát dokončené, loading: false");
            } else {
              console.warn("MyDataApp: Používateľský dokument sa nenašiel pre UID:", user.uid);
              setError("Chyba: Používateľský profil sa nenašiel alebo nemáte dostatočné oprávnenia. Skúste sa prosím znova prihlásiť.");
              setLoading(false); // Zastaví načítavanie, aby sa zobrazila chyba
              setUser(null); // Explicitne nastaviť user na null
              setUserProfileData(null); // Explicitne nastaviť userProfileData na null
            }
          }, error => {
            console.error("MyDataApp: Chyba pri načítaní používateľských dát z Firestore (onSnapshot error):", error);
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
            setLoading(false); // Stop loading aj pri chybe
            console.log("MyDataApp: Načítanie používateľských dát zlyhalo, loading: false");
            setUser(null); // Explicitne nastaviť user na null
            setUserProfileData(null); // Explicitne nastaviť userProfileData na null
          });
        } catch (e) {
          console.error("MyDataApp: Chyba pri nastavovaní onSnapshot pre používateľské dáta (try-catch):", e);
          setError(`Chyba pri nastavovaní poslucháča pre používateľské dáta: ${e.message}`);
          setLoading(false); // Stop loading aj pri chybe
          setUser(null); // Explicitne nastaviť user na null
          setUserProfileData(null); // Explicitne nastaviť userProfileData na null
        }
      }
    } else if (isAuthReady && user === undefined) {
        console.log("MyDataApp: Auth ready, user undefined. Nastavujem loading na false.");
        setLoading(false);
    }


    return () => {
      // Zrušíme odber onSnapshot pri unmount
      if (unsubscribeUserDoc) {
        console.log("MyDataApp: Ruším odber onSnapshot pre používateľský dokument.");
        unsubscribeUserDoc();
      }
    };
  }, [isAuthReady, db, user, auth]); // Pridaná závislosť 'auth' pre použitie auth.signOut()

  // useEffect for updating header link visibility
  // Removed isRegistrationOpen dependency as it's no longer in this file
  React.useEffect(() => {
    console.log(`MyDataApp: useEffect pre aktualizáciu odkazov hlavičky. User: ${user ? user.uid : 'null'}`);
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
        console.log("MyDataApp: Používateľ prihlásený. Skryté: Prihlásenie, Registrácia. Zobrazené: Moja zóna, Odhlásenie.");
      } else { // If user is not logged in
        authLink.classList.remove('hidden');
        profileLink && profileLink.classList.add('hidden');
        logoutButton && logoutButton.classList.add('hidden');
        // Register link visibility will now be handled by register.js based on registration settings
        // For logged-in-my-data.html, if not logged in, register link should be visible by default
        registerLink && registerLink.classList.remove('hidden'); 
        console.log("MyDataApp: Používateľ odhlásený. Zobrazené: Prihlásenie, Registrácia. Skryté: Moja zóna, Odhlásenie.");
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
      setUser(null); // Explicitne nastaviť user na null
      setUserProfileData(null); // Explicitne nastaviť userProfileData na null
    } catch (e) {
      console.error("MyDataApp: Chyba pri odhlásení:", e);
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

  // Removed handleUpdateProfile as there are no input fields to update directly in this view

  // Display loading state
  // Ak je user === undefined (ešte nebola skontrolovaná autentifikácia),
  // alebo userProfileData je null (ešte neboli načítané dáta profilu), alebo loading je true, zobraz loading.
  if (!isAuthReady || user === undefined || (user && !userProfileData) || loading) {
    // Ak je užívateľ null a auth je ready, znamená to, že nie je prihlásený, presmeruj
    if (isAuthReady && user === null) {
        console.log("MyDataApp: Auth je ready a používateľ je null, presmerovávam na login.html");
        window.location.href = 'login.html';
        return null;
    }
    // Zobrazenie rôznych správ podľa stavu načítavania
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

  // Ak je userProfileData.billing.address definované, vytvoríme si premennú pre zjednodušenie
  // ZMENA: Adresa sa načíta priamo z userProfileData, nie z userProfileData.billing.address
  const street = userProfileData.street || '';
  const houseNumber = userProfileData.houseNumber || '';
  const city = userProfileData.city || '';
  const postalCode = userProfileData.postalCode || '';
  const country = userProfileData.country || '';

  const fullAddress = `${street} ${houseNumber}, ${postalCode} ${city}, ${country}`.trim();

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
    React.createElement(NotificationModal, {
        message: userNotificationMessage,
        onClose: () => setUserNotificationMessage(''),
        displayNotificationsEnabled: userProfileData?.displayNotifications // Odovzdanie propu
    }),
    React.createElement(
      'div',
      { className: 'w-full px-4 mt-20 mb-10' }, // Zmenené triedy pre konzistentný okraj
      error && React.createElement(
        'div',
        { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap', role: 'alert' },
        error
      ),
      React.createElement(
        'div',
        { className: 'bg-white p-8 rounded-lg shadow-xl w-full overflow-x-auto' }, // Pridané overflow-x-auto
        React.createElement('h1', { className: 'text-3xl font-bold text-center text-gray-800 mb-6' },
          'Moje údaje' // Zmenený hlavný nadpis
        ),
        // My Data Section
        React.createElement(
          React.Fragment,
          null,
          // Odstránený nadpis h2 "Moje údaje"
          React.createElement(
            'div', 
            { className: 'space-y-2' }, 
            React.createElement(
                'div',
                null,
                React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg whitespace-nowrap' }, // Pridané whitespace-nowrap
                    React.createElement('span', { className: 'font-bold' }, 'Meno a priezvisko:'),
                    ` ${userProfileData.firstName || ''} ${userProfileData.lastName || ''}`
                )
            ),
            // Podmienené zobrazenie telefónneho čísla len pre rolu 'user'
            userProfileData.role === 'user' && React.createElement(
              'div',
              null,
              React.createElement(
                'p',
                { className: 'text-gray-800 text-lg whitespace-nowrap' }, // Pridané whitespace-nowrap
                React.createElement('span', { className: 'font-bold' }, 'Telefónne číslo:'),
                ` ${userProfileData.contactPhoneNumber || ''}`
              )
            ),
            React.createElement(
              'div',
              null,
              React.createElement(
                'p',
                { className: 'text-gray-800 text-lg whitespace-nowrap' }, // Pridané whitespace-nowrap
                React.createElement('span', { className: 'font-bold' }, 'E-mailová adresa:'),
                ` ${userProfileData.email || user.email || ''}`
              )
            ),
            // NOVINKA: Podmienené zobrazenie fakturačnej adresy len pre rolu 'user'
            userProfileData.role === 'user' && userProfileData.billing && React.createElement(
              React.Fragment,
              null,
              // Horizontálna čiara nad nadpisom "Fakturačné údaje"
              React.createElement('hr', { className: 'my-6 border-gray-300' }), 
              React.createElement('h2', { className: 'text-2xl font-bold text-gray-800 mt-8 mb-4' }, 'Fakturačné údaje'),
              React.createElement(
                'div',
                { className: 'space-y-2' },
                userProfileData.billing.clubName && React.createElement( // Zmena: companyName na clubName
                  'div',
                  null,
                  React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg whitespace-nowrap' }, // Pridané whitespace-nowrap
                    React.createElement('span', { className: 'font-bold' }, 'Názov klubu:'), // Zmena: Názov spoločnosti na Názov klubu
                    ` ${userProfileData.billing.clubName}`
                  )
                ),
                // ZMENA: Zobrazenie adresy z hlavného objektu userProfileData
                fullAddress && React.createElement(
                  'div',
                  null,
                  React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg whitespace-nowrap' }, // Pridané whitespace-nowrap
                    React.createElement('span', { className: 'font-bold' }, 'Adresa:'),
                    ` ${fullAddress}`
                  )
                ),
                userProfileData.billing.ico && React.createElement(
                  'div',
                  null,
                  React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg whitespace-nowrap' }, // Pridané whitespace-nowrap
                    React.createElement('span', { className: 'font-bold' }, 'IČO:'),
                    ` ${userProfileData.billing.ico}`
                  )
                ),
                userProfileData.billing.dic && React.createElement(
                  'div',
                  null,
                  React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg whitespace-nowrap' }, // Pridané whitespace-nowrap
                    React.createElement('span', { className: 'font-bold' }, 'DIČ:'),
                    ` ${userProfileData.billing.dic}`
                  )
                ),
                userProfileData.billing.icDph && React.createElement(
                  'div',
                  null,
                  React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg whitespace-nowrap' }, // Pridané whitespace-nowrap
                    React.createElement('span', { className: 'font-bold' }, 'IČ DPH:'),
                    ` ${userProfileData.billing.icDph}`
                  )
                )
              )
            )
          ),
        )
      )
    )
  );
}
