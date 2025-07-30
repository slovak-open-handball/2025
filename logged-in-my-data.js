// logged-in-my-data.js
// Tento súbor predpokladá, že firebaseConfig, initialAuthToken a appId
// sú globálne definované v <head> logged-in-my-data.html.
// A tiež, že Firebase SDK je už načítané a inicializované.

// Už nepotrebujeme NotificationModal tu, pretože GlobalNotificationHandler v header.js sa o to postará.
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

// Main React component for the logged-in-my-data.html page
function MyDataApp() {
  // Firebase inštancie sú teraz globálne dostupné z header.js po jeho načítaní
  const [auth, setAuth] = React.useState(null);
  const [db, setDb] = React.useState(null);
  const [user, setUser] = React.useState(undefined); // Firebase User object from onAuthStateChanged
  const [userProfileData, setUserProfileData] = React.useState(null); 
  const [isAuthReady, setIsAuthReady] = React.useState(false); // Nový stav pre pripravenosť autentifikácie
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  // userNotificationMessage je teraz spravovaná globálne cez window.showGlobalNotification

  // Zabezpečíme, že appId je definované (používame globálnu premennú)
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'; 

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

      // Získanie predvolenej Firebase aplikácie. Predpokladá sa, že je inicializovaná v HTML.
      const firebaseApp = firebase.app();
      const authInstance = firebase.auth(firebaseApp);
      const firestoreInstance = firebase.firestore(firebaseApp);
      
      setAuth(authInstance);
      setDb(firestoreInstance);

      // Už sa nesnažíme prihlásiť s custom tokenom tu, spoliehame sa na header.js
      // a na pretrvávajúci stav prihlásenia.
      unsubscribeAuth = authInstance.onAuthStateChanged(async (currentUser) => {
        console.log("MyDataApp: onAuthStateChanged - Používateľ:", currentUser ? currentUser.uid : "null");
        setUser(currentUser); // Nastaví Firebase User objekt
        setIsAuthReady(true); // Označí autentifikáciu ako pripravenú po prvej kontrole
      });

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

  // Effect for fetching userProfileData from Firestore
  React.useEffect(() => {
    let unsubscribeUserDoc;

    if (isAuthReady && db && user !== undefined) {
      if (user === null) { 
        console.log("MyDataApp: Auth je ready a používateľ je null, presmerovávam na login.html");
        window.location.href = 'login.html';
        return;
      }

      if (user) {
        console.log(`MyDataApp: Pokúšam sa načítať používateľský dokument pre UID: ${user.uid}`);
        setLoading(true);

        try {
          const userDocRef = db.collection('users').doc(user.uid);
          unsubscribeUserDoc = userDocRef.onSnapshot(docSnapshot => {
            if (docSnapshot.exists) {
              const userData = docSnapshot.data();
              console.log("MyDataApp: Používateľský dokument existuje, dáta:", userData);

              const justLoggedIn = sessionStorage.getItem('justLoggedIn') === 'true';

              if (!justLoggedIn) {
                  if (!userData.passwordLastChanged || typeof userData.passwordLastChanged.toDate !== 'function') {
                      console.error("MyDataApp: passwordLastChanged NIE JE platný Timestamp objekt! Typ:", typeof userData.passwordLastChanged, "Hodnota:", userData.passwordLastChanged);
                      console.log("MyDataApp: Okamžite odhlasujem používateľa kvôli neplatnému timestampu zmeny hesla.");
                      auth.signOut();
                      window.location.href = 'login.html';
                      localStorage.removeItem(`passwordLastChanged_${user.uid}`);
                      setUser(null);
                      setUserProfileData(null);
                      return;
                  }

                  const firestorePasswordChangedTime = userData.passwordLastChanged.toDate().getTime();
                  const localStorageKey = `passwordLastChanged_${user.uid}`;
                  let storedPasswordChangedTime = parseInt(localStorage.getItem(localStorageKey) || '0', 10);

                  console.log(`MyDataApp: Firestore passwordLastChanged (konvertované): ${firestorePasswordChangedTime}, Stored: ${storedPasswordChangedTime}`);

                  if (firestorePasswordChangedTime > storedPasswordChangedTime) {
                      console.log("MyDataApp: Detekovaná zmena hesla na inom zariadení/relácii. Odhlasujem používateľa.");
                      auth.signOut();
                      window.location.href = 'login.html';
                      localStorage.removeItem(localStorageKey);
                      setUser(null);
                      setUserProfileData(null);
                      return;
                  } else if (firestorePasswordChangedTime < storedPasswordChangedTime) {
                      console.warn("MyDataApp: Detekovaný starší timestamp z Firestore ako uložený. Odhlasujem používateľa (potenciálny nesúlad).");
                      auth.signOut();
                      window.location.href = 'login.html';
                      localStorage.removeItem(localStorageKey);
                      setUser(null);
                      setUserProfileData(null);
                      return;
                  } else {
                      localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
                  }
              } else {
                  const firestorePasswordChangedTime = userData.passwordLastChanged ? userData.passwordLastChanged.toDate().getTime() : 0;
                  const localStorageKey = `passwordLastChanged_${user.uid}`;
                  localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
                  console.log("MyDataApp: justLoggedIn je true. Aktualizujem localStorage passwordLastChanged, ale neodhlasujem.");
              }

              if (!justLoggedIn && userData.role === 'admin' && userData.approved === false) {
                  console.log("MyDataApp: Používateľ je admin a nie je schválený. Odhlasujem.");
                  auth.signOut();
                  window.location.href = 'login.html';
                  setUser(null);
                  setUserProfileData(null);
                  return;
              } else if (justLoggedIn && userData.role === 'admin' && userData.approved === false) {
                  console.warn("MyDataApp: justLoggedIn je true. Používateľ je neschválený admin, ale neodhlasujem okamžite. Zobrazím správu.");
                  // Používame globálnu funkciu pre notifikácie
                  if (typeof window.showGlobalNotification === 'function') {
                      window.showGlobalNotification("Váš administrátorský účet čaká na schválenie. Počkajte prosím na aktiváciu.");
                  }
                  sessionStorage.removeItem('justLoggedIn');
              }

              if (user && user.email && userData.email !== user.email) {
                console.log(`MyDataApp: Detekovaný nesúlad emailov. Firestore: ${userData.email}, Auth: ${user.email}. Aktualizujem Firestore.`);
                userDocRef.update({ email: user.email })
                  .then(async () => {
                    console.log("MyDataApp: Email vo Firestore úspešne aktualizovaný na základe Auth emailu.");
                    // Používame globálnu funkciu pre notifikácie
                    if (typeof window.showGlobalNotification === 'function') {
                        window.showGlobalNotification("E-mailová adresa bola úspešne aktualizovaná!");
                    }

                    try {
                        await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('adminNotifications').add({
                            message: `E-mail používateľa ${user.email} bol automaticky aktualizovaný.`,
                            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                            recipientId: 'all_admins',
                            read: false
                        });
                        console.log("MyDataApp: Notifikácia o automatickej aktualizácii e-mailu pre adminov úspešne uložená do Firestore.");
                    } catch (notificationError) {
                        console.error("MyDataApp: Chyba pri ukladaní notifikácie pre adminov o zmene e-mailu:", notificationError);
                    }
                  })
                  .catch(updateError => {
                    console.error("MyDataApp: Chyba pri aktualizácii emailu vo Firestore:", updateError);
                  });
              }

              setUserProfileData(userData);
              setLoading(false);
              setError('');

              if (typeof updateMenuItemsVisibility === 'function') {
                  updateMenuItemsVisibility(userData.role);
              } else {
                  console.warn("MyDataApp: Funkcia updateMenuItemsVisibility nie je definovaná.");
              }

              if (justLoggedIn) {
                  sessionStorage.removeItem('justLoggedIn');
                  console.log("MyDataApp: Príznak 'justLoggedIn' vyčistený po úspešnom načítaní dát.");
              }

              console.log("MyDataApp: Načítanie používateľských dát dokončené, loading: false");
            } else {
              console.warn("MyDataApp: Používateľský dokument sa nenašiel pre UID:", user.uid);
              setError("Chyba: Používateľský profil sa nenašiel alebo nemáte dostatočné oprávnenia. Skúste sa prosím znova prihlásiť.");
              setLoading(false);
              auth.signOut();
              window.location.href = 'login.html';
              localStorage.removeItem(`passwordLastChanged_${user.uid}`);
              setUser(null);
              setUserProfileData(null);
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
                    setUser(null);
                    setUserProfileData(null);
                 }
            } else {
                setError(`Chyba pri načítaní používateľských dát: ${error.message}`);
            }
            setLoading(false);
            console.log("MyDataApp: Načítanie používateľských dát zlyhalo, loading: false");
            if (sessionStorage.getItem('justLoggedIn') !== 'true') {
                auth.signOut();
                window.location.href = 'login.html';
                localStorage.removeItem(`passwordLastChanged_${user.uid}`);
            } else {
                console.warn("MyDataApp: justLoggedIn je true. Chyba pri načítaní dát, ale neodhlasujem okamžite.");
                sessionStorage.removeItem('justLoggedIn');
            }
            setUser(null);
            setUserProfileData(null);
          });
        } catch (e) {
          console.error("MyDataApp: Chyba pri nastavovaní onSnapshot pre používateľské dáta (try-catch):", e);
          setError(`Chyba pri nastavovaní poslucháča pre používateľské dáta: ${e.message}`);
          setLoading(false);
          if (sessionStorage.getItem('justLoggedIn') !== 'true') {
              auth.signOut();
              window.location.href = 'login.html';
              localStorage.removeItem(`passwordLastChanged_${user.uid}`);
          } else {
              console.warn("MyDataApp: justLoggedIn je true. Chyba pri nastavovaní onSnapshot, ale neodhlasujem okamžite.");
              sessionStorage.removeItem('justLoggedIn');
          }
          setUser(null);
          setUserProfileData(null);
        }
      }
    } else if (isAuthReady && user === undefined) {
        console.log("MyDataApp: Auth ready, user undefined. Nastavujem loading na false.");
        setLoading(false);
    }

    return () => {
      if (unsubscribeUserDoc) {
        console.log("MyDataApp: Ruším odber onSnapshot pre používateľský dokument.");
        unsubscribeUserDoc();
      }
    };
  }, [isAuthReady, db, user, auth]);

  // Helper function to format postal code
  const formatPostalCode = (code) => {
    if (code && code.length === 5 && /^\d{5}$/.test(code)) {
      return `${code.substring(0, 3)} ${code.substring(3, 5)}`;
    }
    return code; // Return original if not 5 digits or not numeric
  };

  // Display loading state
  if (!isAuthReady || user === undefined || (user && !userProfileData) || loading) {
    if (isAuthReady && user === null) {
        console.log("MyDataApp: Auth je ready a používateľ je null, presmerovávam na login.html");
        window.location.href = 'login.html';
        return null;
    }
    let loadingMessage = 'Načítavam...';
    if (isAuthReady && user && !userProfileData) {
        loadingMessage = 'Načítavam...';
    } else if (loading) {
        loadingMessage = 'Načítavam...';
    }

    return React.createElement(
      'div',
      { className: 'flex items-center justify-center min-h-screen bg-gray-100' },
      React.createElement('div', { className: 'text-xl font-semibold text-gray-700' }, loadingMessage)
    );
  }

  const street = userProfileData.street || '';
  const houseNumber = userProfileData.houseNumber || '';
  const city = userProfileData.city || '';
  const postalCode = userProfileData.postalCode || '';
  const country = userProfileData.country || '';

  const formattedPostalCode = formatPostalCode(postalCode);

  const fullAddress = `${street} ${houseNumber}, ${formattedPostalCode} ${city}, ${country}`.trim();

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
    // NotificationModal je teraz spravovaný globálne v header.js
    React.createElement(
      'div',
      { className: 'w-full px-4 mt-20 mb-10' },
      error && React.createElement(
        'div',
        { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap', role: 'alert' },
        error
      ),
      React.createElement(
        'div',
        { className: 'bg-white p-8 rounded-lg shadow-xl' },
        React.createElement('h1', { className: 'text-3xl font-bold text-center text-gray-800 mb-6' },
          'Moje údaje'
        ),
        React.createElement(
          React.Fragment,
          null,
          React.createElement(
            'div', 
            { className: 'space-y-2' }, 
            React.createElement(
                'div',
                null,
                React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg whitespace-nowrap' },
                    React.createElement('span', { className: 'font-bold' }, 'Meno a priezvisko:'),
                    ` ${userProfileData.firstName || ''} ${userProfileData.lastName || ''}`
                )
            ),
            userProfileData.role === 'user' && React.createElement(
              'div',
              null,
              React.createElement(
                'p',
                { className: 'text-gray-800 text-lg whitespace-nowrap' },
                React.createElement('span', { className: 'font-bold' }, 'Telefónne číslo:'),
                ` ${userProfileData.contactPhoneNumber || ''}`
              )
            ),
            React.createElement(
              'div',
              null,
              React.createElement(
                'p',
                { className: 'text-gray-800 text-lg whitespace-nowrap' },
                React.createElement('span', { className: 'font-bold' }, 'E-mailová adresa:'),
                ` ${userProfileData.email || user.email || ''}`
              )
            ),
            userProfileData.role === 'user' && userProfileData.billing && React.createElement(
              React.Fragment,
              null,
              React.createElement('hr', { className: 'my-6 border-gray-300' }), 
              React.createElement('h2', { className: 'text-2xl font-bold text-gray-800 mt-8 mb-4' }, 'Fakturačné údaje'),
              React.createElement(
                'div',
                { className: 'space-y-2' },
                userProfileData.billing.clubName && React.createElement(
                  'div',
                  null,
                  React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg whitespace-nowrap' },
                    React.createElement('span', { className: 'font-bold' }, 'Názov klubu:'),
                    ` ${userProfileData.billing.clubName}`
                  )
                ),
                fullAddress && React.createElement(
                  'div',
                  null,
                  React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg whitespace-nowrap' },
                    React.createElement('span', { className: 'font-bold' }, 'Adresa:'),
                    ` ${fullAddress}`
                  )
                ),
                userProfileData.billing.ico && React.createElement(
                  'div',
                  null,
                  React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg whitespace-nowrap' },
                    React.createElement('span', { className: 'font-bold' }, 'IČO:'),
                    ` ${userProfileData.billing.ico}`
                  )
                ),
                userProfileData.billing.dic && React.createElement(
                  'div',
                  null,
                  React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg whitespace-nowrap' },
                    React.createElement('span', { className: 'font-bold' }, 'DIČ:'),
                    ` ${userProfileData.billing.dic}`
                  )
                ),
                userProfileData.billing.icDph && React.createElement(
                  'div',
                  null,
                  React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg whitespace-nowrap' },
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

// Explicitne sprístupniť komponent globálne
window.MyDataApp = MyDataApp;
