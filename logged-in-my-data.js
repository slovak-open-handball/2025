// logged-in-my-data.js
// Tento súbor predpokladá, že firebaseConfig, initialAuthToken a appId
// sú globálne definované v <head> logged-in-my-data.html.

// const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec";

// const formatToDatetimeLocal = (date) => {
//  if (!date) return '';
//  const year = date.getFullYear();
//  const month = (date.getMonth() + 1).toString().padStart(2, '0');
//  const day = date.getDate().toString().padStart(2, '0');
//  const hours = date.getHours().toString().padStart(2, '0');
//  const minutes = (date.getMinutes()).toString().padStart(2, '0');
//  return `${year}-${month}-${day}T${hours}:${minutes}`;
// };

// ZMENA: Odstránený lokálny komponent NotificationModal.
// Notifikácie sú teraz riadené globálne cez header.js.

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
  // ZMENA: userNotificationMessage sa už nepoužíva priamo pre lokálny modal, ale pre globálny
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
        console.error("MyDataApp: Firebase SDK není načteno.");
        setError("Firebase SDK není načteno. Zkontrolujte logged-in-my-data.html.");
        setLoading(false);
        return;
      }

      // Získání předvolené Firebase aplikace. Předpokládá se, že je inicializována v HTML.
      const firebaseApp = firebase.app();
      setApp(firebaseApp);

      const authInstance = firebase.auth(firebaseApp);
      setAuth(authInstance);
      firestoreInstance = firebase.firestore(firebaseApp);
      setDb(firestoreInstance);

      const signIn = async () => {
        try {
          // ZMENA: Používáme globální proměnnou initialAuthToken
          if (typeof initialAuthToken !== 'undefined' && initialAuthToken) {
            await authInstance.signInWithCustomToken(initialAuthToken);
          }
          // Pokud initialAuthToken není k dispozici, jednoduše se spoléháme na onAuthStateChanged,
          // které detekuje přetrvávající stav přihlášení (např. z login.html).
        } catch (e) {
          console.error("MyDataApp: Chyba při počátečním přihlášení Firebase (s custom tokenem):", e);
          setError(`Chyba při přihlášení: ${e.message}`);
        }
      };

      unsubscribeAuth = authInstance.onAuthStateChanged(async (currentUser) => {
        console.log("MyDataApp: onAuthStateChanged - Uživatel:", currentUser ? currentUser.uid : "null");
        setUser(currentUser); // Nastaví Firebase User objekt
        setIsAuthReady(true); // Označí autentifikaci jako připravenou po první kontrole
      });

      signIn();

      return () => {
        if (unsubscribeAuth) {
          unsubscribeAuth();
        }
      };
    } catch (e) {
      console.error("MyDataApp: Nepodařilo se inicializovat Firebase:", e);
      setError(`Chyba při inicializaci Firebase: ${e.message}`);
      setLoading(false);
    }
  }, []);

  // NOVÝ EFFECT: Načítání uživatelských dat z Firestore po inicializaci Auth a DB
  React.useEffect(() => {
    let unsubscribeUserDoc;

    // Spustí se jen pokud je Auth připraveno, DB je k dispozici a user je definován (ne undefined)
    if (isAuthReady && db && user !== undefined) {
      if (user === null) { // Pokud je uživatel null (není přihlášen), přesměruj
        console.log("MyDataApp: Auth je ready a uživatel je null, přesměrovávám na login.html");
        window.location.href = 'login.html';
        return;
      }

      // Pokud je uživatel přihlášen, pokus se načíst jeho data z Firestore
      if (user) {
        console.log(`MyDataApp: Pokouším se načíst uživatelský dokument pro UID: ${user.uid}`);
        // Nastavíme loading na true, protože začínáme načítat profilová data
        setLoading(true); // Nastavíme loading na true zde

        try {
          const userDocRef = db.collection('users').doc(user.uid);
          unsubscribeUserDoc = userDocRef.onSnapshot(docSnapshot => {
            if (docSnapshot.exists) {
              const userData = docSnapshot.data();
              console.log("MyDataApp: Uživatelský dokument existuje, data:", userData);

              // ODSTRANĚNÁ LOGIKA: passwordLastChanged kontrola a odhlašování
              // Tato logika je nyní centralizována v header.js (GlobalNotificationHandler).

              // ODSTRANĚNÁ LOGIKA: Odhlášení, pokud je uživatel admin a není schválen
              // Tato logika je nyní centralizována v header.js (GlobalNotificationHandler).

              // Continue with setting user data if not logged out
              setUserProfileData(userData); // Aktualizujeme stav userProfileData
              setLoading(false); // Stop loading po načtení uživatelských dat
              setError(''); // Vymazat chyby po úspěšném načtení

              // Aktualizace viditelnosti menu po načtení role (volání globální funkce z left-menu.js)
              if (typeof updateMenuItemsVisibility === 'function') {
                  updateMenuItemsVisibility(userData.role);
              } else {
                  console.warn("MyDataApp: Funkce updateMenuItemsVisibility není definována.");
              }

              console.log("MyDataApp: Načítání uživatelských dat dokončeno, loading: false");
            } else {
              console.warn("MyDataApp: Uživatelský dokument se nenašel pro UID:", user.uid);
              setError("Chyba: Uživatelský profil se nenašel nebo nemáte dostatečná oprávnění. Zkuste se prosím znovu přihlásit.");
              setLoading(false); // Zastaví načítání, aby se zobrazila chyba
              setUser(null); // Explicitně nastavit user na null
              setUserProfileData(null); // Explicitně nastavit userProfileData na null
            }
          }, error => {
            console.error("MyDataApp: Chyba při načítání uživatelských dat z Firestore (onSnapshot error):", error);
            if (error.code === 'permission-denied') {
                setError(`Chyba oprávnění: Nemáte přístup ke svému profilu. Zkuste se prosím znovu přihlásit nebo kontaktujte podporu.`);
            } else if (error.code === 'unavailable') {
                setError(`Chyba připojení: Služba Firestore je nedostupná. Zkuste to prosím později.`);
            } else if (error.code === 'unauthenticated') {
                 setError(`Chyba autentifikace: Nejste přihlášen. Zkuste se prosím znovu přihlásit.`);
                 if (auth) {
                    auth.signOut();
                    window.location.href = 'login.html';
                    setUser(null); // Explicitně nastavit user na null
                    setUserProfileData(null); // Explicitně nastavit userProfileData na null
                 }
            } else {
                setError(`Chyba při načítání uživatelských dat: ${error.message}`);
            }
            setLoading(false); // Stop loading i při chybě
            console.log("MyDataApp: Načítání uživatelských dat selhalo, loading: false");
            setUser(null); // Explicitně nastavit user na null
            setUserProfileData(null); // Explicitně nastavit userProfileData na null
          });
        } catch (e) {
          console.error("MyDataApp: Chyba při nastavování onSnapshot pro uživatelská data (try-catch):", e);
          setError(`Chyba při nastavování posluchače pro uživatelská data: ${e.message}`);
          setLoading(false); // Stop loading i při chybě
          setUser(null); // Explicitně nastavit user na null
          setUserProfileData(null); // Explicitně nastavit userProfileData na null
        }
      }
    } else if (isAuthReady && user === undefined) {
        console.log("MyDataApp: Auth ready, user undefined. Nastavuji loading na false.");
        setLoading(false);
    }


    return () => {
      // Zrušíme odběr onSnapshot při unmount
      if (unsubscribeUserDoc) {
        console.log("MyDataApp: Ruším odběr onSnapshot pro uživatelský dokument.");
        unsubscribeUserDoc();
      }
    };
  }, [isAuthReady, db, user, auth]); // Přidaná závislost 'auth' pro použití auth.signOut()

  // ODSTRANĚNÝ useEffect pro aktualizaci odkazů záhlaví
  // Tato logika je nyní plně řízena v header.js

  // ODSTRANĚNÝ handleLogout a jeho připojení k tlačítku
  // Odhlášení je nyní plně řízeno v header.js

  // Removed handleUpdateProfile as there are no input fields to update directly in this view

  // Helper function to format postal code
  const formatPostalCode = (code) => {
    if (code && code.length === 5 && /^\d{5}$/.test(code)) {
      return `${code.substring(0, 3)} ${code.substring(3, 5)}`;
    }
    return code; // Return original if not 5 digits or not numeric
  };

  // Display loading state
  // Pokud je user === undefined (ještě nebyla zkontrolována autentifikace),
  // nebo userProfileData je null (ještě nebyla načtena data profilu), nebo loading je true, zobraz loading.
  if (!isAuthReady || user === undefined || (user && !userProfileData) || loading) {
    // Pokud je uživatel null a auth je ready, znamená to, že není přihlášen, přesměruj
    if (isAuthReady && user === null) {
        console.log("MyDataApp: Auth je ready a uživatel je null, přesměrovávám na login.html");
        window.location.href = 'login.html';
        return null;
    }
    // Zobrazení různých zpráv podle stavu načítání
    let loadingMessage = 'Načítám...';
    if (isAuthReady && user && !userProfileData) {
        loadingMessage = 'Načítám...'; // Specifická zpráva pro profilová data
    } else if (loading) { // Obecný stav načítání, např. při odesílání formuláře
        loadingMessage = 'Načítám...';
    }

    return React.createElement(
      'div',
      { className: 'flex items-center justify-center min-h-screen bg-gray-100' },
      React.createElement('div', { className: 'text-xl font-semibold text-gray-700' }, loadingMessage)
    );
  }

  // Pokud je userProfileData.billing.address definováno, vytvoříme si proměnnou pro zjednodušení
  // ZMENA: Adresa se načte přímo z userProfileData, nikoli z userProfileData.billing.address
  const street = userProfileData.street || '';
  const houseNumber = userProfileData.houseNumber || '';
  const city = userProfileData.city || '';
  const postalCode = userProfileData.postalCode || '';
  const country = userProfileData.country || '';

  // Apply formatting to postalCode
  const formattedPostalCode = formatPostalCode(postalCode);

  const fullAddress = `${street} ${houseNumber}, ${formattedPostalCode} ${city}, ${country}`.trim();

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
    // ZMENA: Odstraněno volání lokálního NotificationModal.
    // Globální NotificationModal je vykreslen v header.js.
    React.createElement(
      'div',
      { className: 'w-full px-4 mt-20 mb-10' }, // Změněné třídy pro konzistentní okraj
      error && React.createElement(
        'div',
        { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap', role: 'alert' },
        error
      ),
      React.createElement(
        'div',
        { className: 'bg-white p-8 rounded-lg shadow-xl' }, // ZMENA: Odstraněno w-full a overflow-x-auto
        React.createElement('h1', { className: 'text-3xl font-bold text-center text-gray-800 mb-6' },
          'Moje údaje' // Změněný hlavní nadpis
        ),
        // My Data Section
        React.createElement(
          React.Fragment,
          null,
          // Odstraněný nadpis h2
          React.createElement(
            'div', 
            { className: 'space-y-2' }, 
            React.createElement(
                'div',
                null,
                React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg whitespace-nowrap' }, // Přidáno whitespace-nowrap
                    React.createElement('span', { className: 'font-bold' }, 'Jméno a příjmení:'),
                    ` ${userProfileData.firstName || ''} ${userProfileData.lastName || ''}`
                )
            ),
            // Podmíněné zobrazení telefonního čísla jen pro roli 'user'
            userProfileData.role === 'user' && React.createElement(
              'div',
              null,
              React.createElement(
                'p',
                { className: 'text-gray-800 text-lg whitespace-nowrap' }, // Přidáno whitespace-nowrap
                React.createElement('span', { className: 'font-bold' }, 'Telefonní číslo:'),
                ` ${userProfileData.contactPhoneNumber || ''}`
              )
            ),
            React.createElement(
              'div',
              null,
              React.createElement(
                'p',
                { className: 'text-gray-800 text-lg whitespace-nowrap' }, // Přidáno whitespace-nowrap
                React.createElement('span', { className: 'font-bold' }, 'E-mailová adresa:'),
                // ZMENA: E-mailová adresa se načítá z user.email (Authentication)
                ` ${user.email || ''}`
              )
            ),
            // NOVINKA: Podmíněné zobrazení fakturační adresy jen pro roli 'user'
            userProfileData.role === 'user' && userProfileData.billing && React.createElement(
              React.Fragment,
              null,
              // Horizontální čára nad nadpisem "Fakturační údaje"
              React.createElement('hr', { className: 'my-6 border-gray-300' }), 
              React.createElement('h2', { className: 'text-2xl font-bold text-gray-800 mt-8 mb-4' }, 'Fakturační údaje'),
              React.createElement(
                'div',
                { className: 'space-y-2' },
                userProfileData.billing.clubName && React.createElement( // Změna: companyName na clubName
                  'div',
                  null,
                  React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg whitespace-nowrap' }, // Přidáno whitespace-nowrap
                    React.createElement('span', { className: 'font-bold' }, 'Název klubu:'), // Změna: Název společnosti na Název klubu
                    ` ${userProfileData.billing.clubName}`
                  )
                ),
                // ZMENA: Zobrazení adresy z hlavního objektu userProfileData
                fullAddress && React.createElement(
                  'div',
                  null,
                  React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg whitespace-nowrap' }, // Přidáno whitespace-nowrap
                    React.createElement('span', { className: 'font-bold' }, 'Adresa:'),
                    ` ${fullAddress}`
                  )
                ),
                userProfileData.billing.ico && React.createElement(
                  'div',
                  null,
                  React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg whitespace-nowrap' }, // Přidáno whitespace-nowrap
                    React.createElement('span', { className: 'font-bold' }, 'IČO:'),
                    ` ${userProfileData.billing.ico}`
                  )
                ),
                userProfileData.billing.dic && React.createElement(
                  'div',
                  null,
                  React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg whitespace-nowrap' }, // Přidáno whitespace-nowrap
                    React.createElement('span', { className: 'font-bold' }, 'DIČ:'),
                    ` ${userProfileData.billing.dic}`
                  )
                ),
                userProfileData.billing.icDph && React.createElement(
                  'div',
                  null,
                  React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg whitespace-nowrap' }, // Přidáno whitespace-nowrap
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

// Explicitně zpřístupnit komponent globálně
window.MyDataApp = MyDataApp;
