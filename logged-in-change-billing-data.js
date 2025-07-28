// logged-in-change-billing-data.js
// Tento súbor predpokladá, že Firebase je už inicializované v logged-in-change-billing-data.html
// a že __app_id a __initial_auth_token sú globálne dostupné z prostredia Canvas.

const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec";

const formatToDatetimeLocal = (date) => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// NotificationModal Component for displaying temporary messages (converted to React.createElement)
function NotificationModal({ message, onClose }) {
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

// Main React component for the logged-in-change-billing-data.html page
function ChangeBillingDataApp() { // ZMENA: Názov komponentu z BillingDataApp na ChangeBillingDataApp
  const [app, setApp] = React.useState(null);
  const [auth, setAuth] = React.useState(null);
  const [db, setDb] = React.useState(null);
  const [user, setUser] = React.useState(undefined); // Firebase User object from onAuthStateChanged
  const [userProfileData, setUserProfileData] = React.useState(null); 
  const [isAuthReady, setIsAuthReady] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [userNotificationMessage, setUserNotificationMessage] = React.useState('');

  // States for billing data
  const [clubName, setClubName] = React.useState('');
  const [ico, setIco] = React.useState('');
  const [dic, setDic] = React.useState('');
  const [icDph, setIcDph] = React.useState('');

  // Effect for Firebase instance retrieval and Auth Listener setup (runs only once)
  React.useEffect(() => {
    let unsubscribeAuth;

    try {
      if (typeof firebase === 'undefined') {
        console.error("ChangeBillingDataApp: Firebase SDK nie je načítané."); // ZMENA: Console log
        setError("Firebase SDK nie je načítané. Skontrolujte logged-in-change-billing-data.html."); // ZMENA: Error správa
        setLoading(false);
        return;
      }
      
      // Získame už inicializovanú Firebase aplikáciu
      const firebaseApp = firebase.app();
      setApp(firebaseApp);

      const authInstance = firebase.auth(firebaseApp);
      setAuth(authInstance);
      const firestoreInstance = firebase.firestore(firebaseApp);
      setDb(firestoreInstance);

      const signIn = async () => {
        try {
          // Používame globálne poskytnutý __initial_auth_token
          if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await authInstance.signInWithCustomToken(__initial_auth_token);
          } else {
            // Prihlásenie anonymne, ak nie je poskytnutý custom token (pre testovanie v Canvas)
            await authInstance.signInAnonymously();
          }
        } catch (e) {
          console.error("ChangeBillingDataApp: Chyba pri počiatočnom prihlásení Firebase:", e); // ZMENA: Console log
          setError(`Chyba pri prihlásení: ${e.message}`);
        }
      };

      unsubscribeAuth = authInstance.onAuthStateChanged(async (currentUser) => {
        console.log("ChangeBillingDataApp: onAuthStateChanged - Používateľ:", currentUser ? currentUser.uid : "null"); // ZMENA: Console log
        setUser(currentUser);
        setIsAuthReady(true);
      });

      signIn();

      return () => {
        if (unsubscribeAuth) {
          unsubscribeAuth();
        }
      };
    } catch (e) {
      console.error("ChangeBillingDataApp: Nepodarilo sa získať Firebase inštancie:", e); // ZMENA: Console log
      setError(`Chyba pri inicializácii Firebase: ${e.message}`);
      setLoading(false);
    }
  }, []);

  // Effect for fetching user profile data and billing data
  React.useEffect(() => {
    let unsubscribeUserDoc;

    if (isAuthReady && db && user !== undefined) {
      if (user === null) {
        console.log("ChangeBillingDataApp: Auth je ready a používateľ je null, presmerovávam na login.html"); // ZMENA: Console log
        window.location.href = 'login.html';
        return;
      }

      if (user) {
        console.log(`ChangeBillingDataApp: Pokúšam sa načítať používateľský dokument pre UID: ${user.uid}`); // ZMENA: Console log
        setLoading(true);

        try {
          const userDocRef = db.collection('users').doc(user.uid);
          unsubscribeUserDoc = userDocRef.onSnapshot(docSnapshot => {
            if (docSnapshot.exists) {
              const userData = docSnapshot.data();
              console.log("ChangeBillingDataApp: Používateľský dokument existuje, dáta:", userData); // ZMENA: Console log

              // --- OKAMŽITÉ ODHLÁSENIE, AK passwordLastChanged NIE JE PLATNÝ TIMESTAMP ---
              if (!userData.passwordLastChanged || typeof userData.passwordLastChanged.toDate !== 'function') {
                  console.error("ChangeBillingDataApp: passwordLastChanged NIE JE platný Timestamp objekt! Typ:", typeof userData.passwordLastChanged, "Hodnota:", userData.passwordLastChanged); // ZMENA: Console log
                  console.log("ChangeBillingDataApp: Okamžite odhlasujem používateľa kvôli neplatnému timestampu zmeny hesla."); // ZMENA: Console log
                  auth.signOut();
                  window.location.href = 'login.html';
                  localStorage.removeItem(`passwordLastChanged_${user.uid}`);
                  return;
              }

              const firestorePasswordChangedTime = userData.passwordLastChanged.toDate().getTime();
              const localStorageKey = `passwordLastChanged_${user.uid}`;
              let storedPasswordChangedTime = parseInt(localStorage.getItem(localStorageKey) || '0', 10);

              console.log(`ChangeBillingDataApp: Firestore passwordLastChanged (konvertované): ${firestorePasswordChangedTime}, Stored: ${storedPasswordChangedTime}`); // ZMENA: Console log

              if (storedPasswordChangedTime === 0 && firestorePasswordChangedTime !== 0) {
                  localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
                  console.log("ChangeBillingDataApp: Inicializujem passwordLastChanged v localStorage (prvé načítanie)."); // ZMENA: Console log
              } else if (firestorePasswordChangedTime > storedPasswordChangedTime) {
                  console.log("ChangeBillingDataApp: Detekovaná zmena hesla na inom zariadení/relácii. Odhlasujem používateľa."); // ZMENA: Console log
                  auth.signOut();
                  window.location.href = 'login.html';
                  localStorage.removeItem(localStorageKey);
                  return;
              } else if (firestorePasswordChangedTime < storedPasswordChangedTime) {
                  console.warn("ChangeBillingDataApp: Detekovaný starší timestamp z Firestore ako uložený. Odhlasujem používateľa (potenciálny nesúlad)."); // ZMENA: Console log
                  auth.signOut();
                  window.location.href = 'login.html';
                  localStorage.removeItem(localStorageKey);
                  return;
              } else {
                  localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
                  console.log("ChangeBillingDataApp: Timestampy sú rovnaké, aktualizujem localStorage."); // ZMENA: Console log
              }
              // --- KONIEC LOGIKY ODHLÁSENIA ---

              setUserProfileData(userData);
              
              // Set billing data states
              setClubName(userData.billing?.clubName || '');
              setIco(userData.billing?.ico || '');
              setDic(userData.billing?.dic || '');
              setIcDph(userData.billing?.icDph || '');

              setLoading(false);
              setError('');

              if (typeof window.updateMenuItemsVisibility === 'function') {
                  window.updateMenuItemsVisibility(userData.role);
              }

              console.log("ChangeBillingDataApp: Načítanie používateľských dát dokončené, loading: false"); // ZMENA: Console log
            } else {
              console.warn("ChangeBillingDataApp: Používateľský dokument sa nenašiel pre UID:", user.uid); // ZMENA: Console log
              setError("Chyba: Používateľský profil sa nenašiel alebo nemáte dostatočné oprávnenia. Skúste sa prosím znova prihlásiť.");
              setLoading(false);
            }
          }, error => {
            console.error("ChangeBillingDataApp: Chyba pri načítaní používateľských dát z Firestore (onSnapshot error):", error); // ZMENA: Console log
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
            setLoading(false);
            console.log("ChangeBillingDataApp: Načítanie používateľských dát zlyhalo, loading: false"); // ZMENA: Console log
          });
        } catch (e) {
          console.error("ChangeBillingDataApp: Chyba pri nastavovaní onSnapshot pre používateľské dáta (try-catch):", e); // ZMENA: Console log
          setError(`Chyba pri nastavovaní poslucháča pre používateľské dáta: ${e.message}`);
          setLoading(false);
        }
      }
    } else if (isAuthReady && user === undefined) {
        console.log("ChangeBillingDataApp: Auth ready, user undefined. Nastavujem loading na false."); // ZMENA: Console log
        setLoading(false);
    }


    return () => {
      if (unsubscribeUserDoc) {
        console.log("ChangeBillingDataApp: Ruším odber onSnapshot pre používateľský dokument."); // ZMENA: Console log
        unsubscribeUserDoc();
      }
    };
  }, [isAuthReady, db, user, auth]);

  // useEffect for updating header link visibility
  React.useEffect(() => {
    console.log(`ChangeBillingDataApp: useEffect pre aktualizáciu odkazov hlavičky. User: ${user ? user.uid : 'null'}`); // ZMENA: Console log
    const authLink = document.getElementById('auth-link');
    const profileLink = document.getElementById('profile-link');
    const logoutButton = document.getElementById('logout-button');
    const registerLink = document.getElementById('register-link');

    if (authLink) {
      if (user) {
        authLink.classList.add('hidden');
        profileLink && profileLink.classList.remove('hidden');
        logoutButton && logoutButton.classList.remove('hidden');
        registerLink && registerLink.classList.add('hidden');
        console.log("ChangeBillingDataApp: Používateľ prihlásený. Skryté: Prihlásenie, Registrácia. Zobrazené: Moja zóna, Odhlásenie."); // ZMENA: Console log
      } else {
        authLink.classList.remove('hidden');
        profileLink && profileLink.classList.add('hidden');
        logoutButton && logoutButton.classList.add('hidden');
        registerLink && registerLink.classList.remove('hidden'); 
        console.log("ChangeBillingDataApp: Používateľ odhlásený. Zobrazené: Prihlásenie, Registrácia. Skryté: Moja zóna, Odhlásenie."); // ZMENA: Console log
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
      console.error("ChangeBillingDataApp: Chyba pri odhlásení:", e); // ZMENA: Console log
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

  const handleUpdateBillingData = async (e) => {
    e.preventDefault();
    if (!db || !user) {
      setError("Databáza alebo používateľ nie je k dispozícii.");
      return;
    }
    setLoading(true);
    setError('');
    setUserNotificationMessage('');

    try {
      const userDocRef = db.collection('users').doc(user.uid);
      await userDocRef.update({
        billing: {
          clubName: clubName,
          ico: ico,
          dic: dic,
          icDph: icDph
        }
      });
      setUserNotificationMessage("Fakturačné údaje úspešne aktualizované!");
    } catch (e) {
      console.error("ChangeBillingDataApp: Chyba pri aktualizácii fakturačných údajov:", e); // ZMENA: Console log
      setError(`Chyba pri aktualizácii fakturačných údajov: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Display loading state
  if (!isAuthReady || user === undefined || (user && !userProfileData) || loading) {
    if (isAuthReady && user === null) {
        console.log("ChangeBillingDataApp: Auth je ready a používateľ je null, presmerovávam na login.html"); // ZMENA: Console log
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

  // Redirect if user is not 'user' role
  if (userProfileData && userProfileData.role !== 'user') {
      console.log("ChangeBillingDataApp: Používateľ nemá rolu 'user'. Presmerovávam na logged-in-my-data.html."); // ZMENA: Console log
      window.location.href = 'logged-in-my-data.html';
      return null;
  }

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
      React.createElement(
        'div',
        { className: 'bg-white p-8 rounded-lg shadow-xl w-full' },
        React.createElement('h1', { className: 'text-3xl font-bold text-center text-gray-800 mb-6' },
          'Zmeniť fakturačné údaje'
        ),
        React.createElement(
          'form',
          { onSubmit: handleUpdateBillingData, className: 'space-y-4' },
          React.createElement(
            'div',
            null,
            React.createElement('label', { htmlFor: 'clubName', className: 'block text-gray-700 text-sm font-bold mb-2' }, 'Názov klubu (ak je to relevantné)'),
            React.createElement('input', {
              type: 'text',
              id: 'clubName',
              className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline transition-all duration-200',
              value: clubName,
              onChange: (e) => setClubName(e.target.value),
              disabled: loading,
            })
          ),
          React.createElement(
            'div',
            null,
            React.createElement('label', { htmlFor: 'ico', className: 'block text-gray-700 text-sm font-bold mb-2' }, 'IČO'),
            React.createElement('input', {
              type: 'text',
              id: 'ico',
              className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline transition-all duration-200',
              value: ico,
              onChange: (e) => setIco(e.target.value),
              disabled: loading,
            })
          ),
          React.createElement(
            'div',
            null,
            React.createElement('label', { htmlFor: 'dic', className: 'block text-gray-700 text-sm font-bold mb-2' }, 'DIČ'),
            React.createElement('input', {
              type: 'text',
              id: 'dic',
              className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline transition-all duration-200',
              value: dic,
              onChange: (e) => setDic(e.target.value),
              disabled: loading,
            })
          ),
          React.createElement(
            'div',
            null,
            React.createElement('label', { htmlFor: 'icDph', className: 'block text-gray-700 text-sm font-bold mb-2' }, 'IČ DPH'),
            React.createElement('input', {
              type: 'text',
              id: 'icDph',
              className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline transition-all duration-200',
              value: icDph,
              onChange: (e) => setIcDph(e.target.value),
              disabled: loading,
            })
          ),
          React.createElement(
            'button',
            {
              type: 'submit',
              className: 'mt-6 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200',
              disabled: loading,
            },
            loading ? 'Ukladám...' : 'Uložiť fakturačné údaje'
          )
        )
      )
    )
  );
}

// Explicitne sprístupniť komponent globálne
window.ChangeBillingDataApp = ChangeBillingDataApp; // ZMENA: Názov komponentu
