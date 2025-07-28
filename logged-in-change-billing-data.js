// Global application ID and Firebase configuration (should be consistent across all React apps)
// Tieto konštanty sú teraz definované v <head> logged-in-change-billing-data.html
// const appId = '1:26454452024:web:6954b4f90f87a3a1eb43cd';
// const firebaseConfig = { ... };
// const initialAuthToken = null;

// const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec";

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
function ChangeBillingDataApp() {
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
  // States for address
  const [street, setStreet] = React.useState('');
  const [houseNumber, setHouseNumber] = React.useState('');
  const [city, setCity] = React.useState('');
  const [postalCode, setPostalCode] = React.useState('');
  const [country, setCountry] = React.useState('');

  // States for validation errors
  const [icoError, setIcoError] = React.useState('');
  const [dicError, setDicError] = React.useState('');
  const [icDphError, setIcDphError] = React.useState('');
  const [postalCodeError, setPostalCodeError] = React.useState('');

  // NOVINKA: Stav pre dátum uzávierky úprav dát
  const [dataEditDeadline, setDataEditDeadline] = React.useState(null);
  const [settingsLoaded, setSettingsLoaded] = React.useState(false);

  // NOVINKA: Memoizovaná hodnota pre povolenie úprav dát
  const isDataEditingAllowed = React.useMemo(() => {
    if (!settingsLoaded || !dataEditDeadline) return true; // Ak nastavenia nie sú načítané alebo dátum nie je definovaný, povoliť úpravy
    const now = new Date();
    const deadline = new Date(dataEditDeadline);
    return now <= deadline;
  }, [settingsLoaded, dataEditDeadline]);


  // Effect for Firebase instance retrieval and Auth Listener setup (runs only once)
  React.useEffect(() => {
    let unsubscribeAuth;

    try {
      if (typeof firebase === 'undefined') {
        console.error("ChangeBillingDataApp: Firebase SDK nie je načítané.");
        setError("Firebase SDK nie je načítané. Skontrolujte logged-in-change-billing-data.html.");
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
          if (typeof initialAuthToken !== 'undefined' && initialAuthToken) {
            await authInstance.signInWithCustomToken(initialAuthToken);
          } 
        } catch (e) {
          console.error("ChangeBillingDataApp: Chyba pri počiatočnom prihlásení Firebase:", e);
          setError(`Chyba pri prihlásení: ${e.message}`);
        }
      };

      unsubscribeAuth = authInstance.onAuthStateChanged(async (currentUser) => {
        console.log("ChangeBillingDataApp: onAuthStateChanged - Používateľ:", currentUser ? currentUser.uid : "null");
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
      console.error("ChangeBillingDataApp: Nepodarilo sa získať Firebase inštancie:", e);
      setError(`Chyba pri inicializácii Firebase: ${e.message}`);
      setLoading(false);
    }
  }, []);

  // Effect for fetching user profile data and billing data
  React.useEffect(() => {
    let unsubscribeUserDoc;

    if (isAuthReady && db && user !== undefined) {
      if (user === null) {
        console.log("ChangeBillingDataApp: Auth je ready a používateľ je null, presmerovávam na login.html");
        window.location.href = 'login.html';
        return;
      }

      if (user) {
        console.log(`ChangeBillingDataApp: Pokúšam sa načítať používateľský dokument pre UID: ${user.uid}`);
        setLoading(true);

        try {
          const userDocRef = db.collection('users').doc(user.uid);
          unsubscribeUserDoc = userDocRef.onSnapshot(docSnapshot => {
            if (docSnapshot.exists) {
              const userData = docSnapshot.data();
              console.log("ChangeBillingDataApp: Používateľský dokument existuje, dáta:", userData);

              // --- OKAMŽITÉ ODHLÁSENIE, AK passwordLastChanged NIE JE PLATNÝ TIMESTAMP ---
              if (!userData.passwordLastChanged || typeof userData.passwordLastChanged.toDate !== 'function') {
                  console.error("ChangeBillingDataApp: passwordLastChanged NIE JE platný Timestamp objekt! Typ:", typeof userData.passwordLastChanged, "Hodnota:", userData.passwordLastChanged);
                  console.log("ChangeBillingDataApp: Okamžite odhlasujem používateľa kvôli neplatnému timestampu zmeny hesla.");
                  auth.signOut();
                  window.location.href = 'login.html';
                  localStorage.removeItem(`passwordLastChanged_${user.uid}`);
                  return;
              }

              const firestorePasswordChangedTime = userData.passwordLastChanged.toDate().getTime();
              const localStorageKey = `passwordLastChanged_${user.uid}`;
              let storedPasswordChangedTime = parseInt(localStorage.getItem(localStorageKey) || '0', 10);

              console.log(`ChangeBillingDataApp: Firestore passwordLastChanged (konvertované): ${firestorePasswordChangedTime}, Stored: ${storedPasswordChangedTime}`);

              if (storedPasswordChangedTime === 0 && firestorePasswordChangedTime !== 0) {
                  localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
                  console.log("ChangeBillingDataApp: Inicializujem passwordLastChanged v localStorage (prvé načítanie).");
              } else if (firestorePasswordChangedTime > storedPasswordChangedTime) {
                  console.log("ChangeBillingDataApp: Detekovaná zmena hesla na inom zariadení/relácii. Odhlasujem používateľa.");
                  auth.signOut();
                  window.location.href = 'login.html';
                  localStorage.removeItem(localStorageKey);
                  return;
              } else if (firestorePasswordChangedTime < storedPasswordChangedTime) {
                  console.warn("ChangeBillingDataApp: Detekovaný starší timestamp z Firestore ako uložený. Odhlasujem používateľa (potenciálny nesúlad).");
                  auth.signOut();
                  window.location.href = 'login.html';
                  localStorage.removeItem(localStorageKey);
                  return;
              } else {
                  localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
                  console.log("ChangeBillingDataApp: Timestampy sú rovnaké, aktualizujem localStorage.");
              }
              // --- KONIEC LOGIKY ODHLÁSENIA ---

              setUserProfileData(userData);
              
              // Set billing data states
              setClubName(userData.billing?.clubName || '');
              setIco(userData.billing?.ico || '');
              setDic(userData.billing?.dic || '');
              setIcDph(userData.billing?.icDph || '');
              // NAČÍTANIE HODNÔT ADRESY Z userProfileData
              setStreet(userData.street || '');
              setHouseNumber(userData.houseNumber || '');
              setCity(userData.city || '');
              // Automaticky formátovať PSČ po načítaní
              setPostalCode(formatAndValidatePostalCode(userData.postalCode || '').formattedValue);
              setCountry(userData.country || '');


              setLoading(false);
              setError('');

              if (typeof window.updateMenuItemsVisibility === 'function') {
                  window.updateMenuItemsVisibility(userData.role);
              }

              console.log("ChangeBillingDataApp: Načítanie používateľských dát dokončené, loading: false");
            } else {
              console.warn("ChangeBillingDataApp: Používateľský dokument sa nenašiel pre UID:", user.uid);
              setError("Chyba: Používateľský profil sa nenašiel alebo nemáte dostatočné oprávnenia. Skúste sa prosím znova prihlásiť.");
              setLoading(false);
            }
          }, error => {
            console.error("ChangeBillingDataApp: Chyba pri načítaní používateľských dát z Firestore (onSnapshot error):", error);
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
            console.log("ChangeBillingDataApp: Načítanie používateľských dát zlyhalo, loading: false");
          });
        } catch (e) {
          console.error("ChangeBillingDataApp: Chyba pri nastavovaní onSnapshot pre používateľské dáta (try-catch):", e);
          setError(`Chyba pri nastavovaní poslucháča pre používateľské dáta: ${e.message}`);
          setLoading(false);
        }
      }
    } else if (isAuthReady && user === undefined) {
        console.log("ChangeBillingDataApp: Auth ready, user undefined. Nastavujem loading na false.");
        setLoading(false);
    }


    return () => {
      if (unsubscribeUserDoc) {
        console.log("ChangeBillingDataApp: Ruším odber onSnapshot pre používateľský dokument.");
        unsubscribeUserDoc();
      }
    };
  }, [isAuthReady, db, user, auth]);

  // NOVINKA: Effect pre načítanie nastavení (dátum uzávierky úprav)
  React.useEffect(() => {
    const fetchSettings = async () => {
      if (!db || !isAuthReady) {
        console.log("ChangeBillingDataApp: Čakám na DB alebo Auth pre načítanie nastavení.");
        return;
      }
      try {
          console.log("ChangeBillingDataApp: Pokúšam sa načítať nastavenia registrácie pre dátum uzávierky.");
          const settingsDocRef = db.collection('settings').doc('registration');
          const unsubscribeSettings = settingsDocRef.onSnapshot(docSnapshot => {
            console.log("ChangeBillingDataApp: onSnapshot pre nastavenia registrácie spustený.");
            if (docSnapshot.exists) {
                const data = docSnapshot.data();
                console.log("ChangeBillingDataApp: Nastavenia registrácie existujú, dáta:", data);
                setDataEditDeadline(data.dataEditDeadline ? formatToDatetimeLocal(data.dataEditDeadline.toDate()) : null);
            } else {
                console.log("ChangeBillingDataApp: Nastavenia registrácie sa nenašli v Firestore. Dátum uzávierky úprav nie je definovaný.");
                setDataEditDeadline(null);
            }
            setSettingsLoaded(true);
            console.log("ChangeBillingDataApp: Načítanie nastavení dokončené, settingsLoaded: true.");
          }, error => {
            console.error("ChangeBillingDataApp: Chyba pri načítaní nastavení registrácie (onSnapshot error):", error);
            setError(`Chyba pri načítaní nastavení: ${error.message}`);
            setSettingsLoaded(true);
          });

          return () => {
            if (unsubscribeSettings) {
                console.log("ChangeBillingDataApp: Ruším odber onSnapshot pre nastavenia registrácie.");
                unsubscribeSettings();
            }
          };
      } catch (e) {
          console.error("ChangeBillingDataApp: Chyba pri nastavovaní onSnapshot pre nastavenia registrácie (try-catch):", e);
          setError(`Chyba pri nastavovaní poslucháča pre nastavenia: ${e.message}`);
          setSettingsLoaded(true);
      }
    };

    fetchSettings();
  }, [db, isAuthReady]);

  // useEffect for updating header link visibility
  React.useEffect(() => {
    console.log(`ChangeBillingDataApp: useEffect pre aktualizáciu odkazov hlavičky. User: ${user ? user.uid : 'null'}`);
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
        console.log("ChangeBillingDataApp: Používateľ prihlásený. Skryté: Prihlásenie, Registrácia. Zobrazené: Moja zóna, Odhlásenie.");
      } else {
        authLink.classList.remove('hidden');
        profileLink && profileLink.classList.add('hidden');
        logoutButton && logoutButton.classList.add('hidden');
        registerLink && registerLink.classList.remove('hidden'); 
        console.log("ChangeBillingDataApp: Používateľ odhlásený. Zobrazené: Prihlásenie, Registrácia. Skryté: Moja zóna, Odhlásenie.");
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
      console.error("ChangeBillingDataApp: Chyba pri odhlásení:", e);
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

  // VALIDATION FUNCTIONS
  const validateIco = (value) => {
    // IČO - len čísla
    if (value && !/^\d+$/.test(value)) {
      return 'IČO môže obsahovať iba čísla.';
    }
    return '';
  };

  const validateDic = (value) => {
    // DIČ - len čísla
    if (value && !/^\d+$/.test(value)) {
      return 'DIČ môže obsahovať iba čísla.';
    }
    return '';
  };

  const validateIcDph = (value) => {
    // IČ DPH - prvé dva znaky veľké písmeno bez diakritiky, potom len čísla
    // Kontrola, či neobsahuje diakritiku (rozšírený rozsah znakov, ktoré nie sú A-Z)
    const diacriticsRegex = /[^\u0041-\u005A\u0030-\u0039]/g; // Povolené len A-Z a 0-9

    if (value) { // Ak hodnota nie je prázdna
      const firstTwoChars = value.substring(0, 2);
      const remainingChars = value.substring(2);

      // Kontrola diakritiky v prvých dvoch znakoch
      if (firstTwoChars.match(diacriticsRegex)) {
        return 'Prvé dva znaky IČ DPH nesmú obsahovať diakritiku.';
      }

      // Kontrola, či prvé dva znaky sú veľké písmená a zvyšok sú čísla
      if (!/^[A-Z]{2}$/.test(firstTwoChars) || (remainingChars && !/^\d*$/.test(remainingChars))) {
        return 'IČ DPH musí začínať dvoma veľkými písmenami (bez diakritiky) nasledovanými číslami.';
      }
    }
    return '';
  };

  const formatAndValidatePostalCode = (value) => {
    // PSČ - len čísla, automatická medzera po treťom znaku, za medzerou ešte presne dva znaky
    let cleanedValue = value.replace(/\D/g, ''); // Odstránime všetky nečíselné znaky
    let formattedValue = cleanedValue;
    let errorMsg = '';

    if (cleanedValue.length > 3) {
      formattedValue = cleanedValue.substring(0, 3) + ' ' + cleanedValue.substring(3, 5);
    }

    // Validácia formátu XXXXX
    if (cleanedValue.length > 0 && cleanedValue.length !== 5) {
        errorMsg = 'PSČ musí mať presne 5 číslic.';
    } else if (cleanedValue.length === 5 && !/^\d{5}$/.test(cleanedValue)) {
        errorMsg = 'PSČ môže obsahovať iba čísla.';
    }

    return { formattedValue, errorMsg };
  };


  const handleUpdateBillingData = async (e) => {
    e.preventDefault();

    // Re-validate all fields before submission
    const newIcoError = validateIco(ico);
    const newDicError = validateDic(dic);
    const newIcDphError = validateIcDph(icDph);
    const { errorMsg: newPostalCodeError } = formatAndValidatePostalCode(postalCode); // Use the errorMsg from formatter

    setIcoError(newIcoError);
    setDicError(newDicError);
    setIcDphError(newIcDphError);
    setPostalCodeError(newPostalCodeError);

    // If any validation error exists, prevent submission
    if (newIcoError || newDicError || newIcDphError || newPostalCodeError) {
      setUserNotificationMessage("Prosím, opravte chyby vo formulári.");
      return;
    }
    // NOVINKA: Kontrola povolenia úprav dát
    if (!isDataEditingAllowed) {
      setError("Úpravy fakturačných údajov sú po uzávierke zakázané.");
      return;
    }

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
        },
        // AKTUALIZÁCIA ADRESNÝCH ÚDAJOV PRIAMO V KORENI POUŽÍVATEĽSKÉHO DOKUMENTU
        street: street,
        houseNumber: houseNumber,
        city: city,
        postalCode: postalCode.replace(/\s/g, ''), // Uložiť PSČ bez medzery
        country: country
      });
      setUserNotificationMessage("Fakturačné údaje úspešne aktualizované!");

      // --- Logika pre ukladanie notifikácie pre administrátorov ---
      try {
          // Používame pevne zadané 'default-app-id' pre cestu k notifikáciám
          const appId = 'default-app-id'; 
          let notificationMessage = '';
          let notificationRecipientId = '';

          // Konkrétna správa o zmene fakturačných údajov
          if (userProfileData.role === 'user') {
              notificationMessage = `Používateľ ${userProfileData.email} si zmenil fakturačné údaje (názov klubu: ${clubName}, IČO: ${ico}, DIČ: ${dic}, IČ DPH: ${icDph}, adresa: ${street} ${houseNumber}, ${postalCode} ${city}, ${country}).`;
              notificationRecipientId = 'all_admins'; // Notifikácia pre všetkých administrátorov
          } else if (userProfileData.role === 'admin') {
              notificationMessage = `Administrátor ${userProfileData.email} si zmenil fakturačné údaje (názov klubu: ${clubName}, IČO: ${ico}, DIČ: ${dic}, IČ DPH: ${icDph}, adresa: ${street} ${houseNumber}, ${postalCode} ${city}, ${country}).`;
              notificationRecipientId = user.uid; // Notifikácia pre tohto konkrétneho administrátora
          }

          if (notificationMessage) {
              await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('adminNotifications').add({
                  message: notificationMessage,
                  timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                  recipientId: notificationRecipientId,
                  read: false
              });
              console.log("Notifikácia o zmene fakturačných údajov úspešne uložená do Firestore.");
          }
      } catch (e) {
          console.error("ChangeBillingDataApp: Chyba pri ukladaní notifikácie o zmene fakturačných údajov:", e);
      }
      // --- Koniec logiky pre ukladania notifikácie ---

    } catch (e) {
      console.error("ChangeBillingDataApp: Chyba pri aktualizácii fakturačných údajov:", e);
      setError(`Chyba pri aktualizácii fakturačných údajov: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Display loading state
  if (!isAuthReady || user === undefined || !settingsLoaded || (user && !userProfileData) || loading) {
    if (isAuthReady && user === null) {
        console.log("ChangeBillingDataApp: Auth je ready a používateľ je null, presmerovávam na login.html");
        window.location.href = 'login.html';
        return null;
    }
    let loadingMessage = 'Načítavam...';
    if (isAuthReady && user && !settingsLoaded) { // NOVINKA: Čakanie na načítanie nastavení
        loadingMessage = 'Načítavam nastavenia...';
    } else if (isAuthReady && user && settingsLoaded && !userProfileData) {
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
      console.log("ChangeBillingDataApp: Používateľ nemá rolu 'user'. Presmerovávam na logged-in-my-data.html.");
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
      { className: 'w-full max-w-md mt-20 mb-10 p-4' },
      error && React.createElement(
        'div',
        { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap', role: 'alert' },
        error
      ),
      // NOVINKA: Správa o uzávierke úprav
      !isDataEditingAllowed && React.createElement(
        'div',
        { className: 'bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap', role: 'alert' },
        `Úpravy fakturačných údajov sú povolené len do ${dataEditDeadline ? new Date(dataEditDeadline).toLocaleDateString('sk-SK') + ' ' + new Date(dataEditDeadline).toLocaleTimeString('sk-SK') : 'nedefinovaného dátumu'}.`
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
          // Oficiálny názov klubu
          React.createElement(
            'div',
            null,
            React.createElement('label', { htmlFor: 'clubName', className: 'block text-gray-700 text-sm font-bold mb-2' }, 'Oficiálny názov klubu'),
            React.createElement('input', {
              type: 'text',
              id: 'clubName',
              className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline transition-all duration-200',
              value: clubName,
              onChange: (e) => setClubName(e.target.value),
              disabled: loading || !isDataEditingAllowed, // NOVINKA: Disabled ak je po uzávierke
            })
          ),
          // IČO
          React.createElement(
            'div',
            null,
            React.createElement('label', { htmlFor: 'ico', className: 'block text-gray-700 text-sm font-bold mb-2' }, 'IČO'),
            React.createElement('input', {
              type: 'text',
              id: 'ico',
              className: `shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline transition-all duration-200 ${icoError ? 'border-red-500' : ''}`,
              value: ico,
              onChange: (e) => {
                // Obmedzenie na len čísla
                const numericValue = e.target.value.replace(/\D/g, '');
                setIco(numericValue);
                setIcoError(validateIco(numericValue));
              },
              disabled: loading || !isDataEditingAllowed, // NOVINKA: Disabled ak je po uzávierke
            }),
            icoError && React.createElement('p', { className: 'text-red-500 text-xs italic mt-1', style: { wordBreak: 'break-all' } }, icoError)
          ),
          // DIČ
          React.createElement(
            'div',
            null,
            React.createElement('label', { htmlFor: 'dic', className: 'block text-gray-700 text-sm font-bold mb-2' }, 'DIČ'),
            React.createElement('input', {
              type: 'text',
              id: 'dic',
              className: `shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline transition-all duration-200 ${dicError ? 'border-red-500' : ''}`,
              value: dic,
              onChange: (e) => {
                // Obmedzenie na len čísla
                const numericValue = e.target.value.replace(/\D/g, '');
                setDic(numericValue);
                setDicError(validateDic(numericValue));
              },
              disabled: loading || !isDataEditingAllowed, // NOVINKA: Disabled ak je po uzávierke
            }),
            dicError && React.createElement('p', { className: 'text-red-500 text-xs italic mt-1', style: { wordBreak: 'break-all' } }, dicError)
          ),
          // IČ DPH
          React.createElement(
            'div',
            null,
            React.createElement('label', { htmlFor: 'icDph', className: 'block text-gray-700 text-sm font-bold mb-2' }, 'IČ DPH'),
            React.createElement('input', {
              type: 'text',
              id: 'icDph',
              className: `shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline transition-all duration-200 ${icDphError ? 'border-red-500' : ''}`,
              value: icDph,
              onChange: (e) => {
                // Obmedzenie na prvé dva znaky veľké písmená (bez diakritiky), potom len čísla
                let inputValue = e.target.value.toUpperCase();
                let filteredValue = '';

                if (inputValue.length > 0) {
                    // Prvé dva znaky: len veľké písmená bez diakritiky
                    const firstTwo = inputValue.substring(0, 2).replace(/[^A-Z]/g, '');
                    filteredValue += firstTwo;

                    // Zvyšné znaky: len čísla
                    if (inputValue.length > 2) {
                        const remaining = inputValue.substring(2).replace(/\D/g, '');
                        filteredValue += remaining;
                    }
                }
                
                setIcDph(filteredValue);
                setIcDphError(validateIcDph(filteredValue));
              },
              disabled: loading || !isDataEditingAllowed, // NOVINKA: Disabled ak je po uzávierke
            }),
            icDphError && React.createElement('p', { className: 'text-red-500 text-xs italic mt-1', style: { wordBreak: 'break-all' } }, icDphError)
          ),
          // Ulica
          React.createElement(
            'div',
            null,
            React.createElement('label', { htmlFor: 'street', className: 'block text-gray-700 text-sm font-bold mb-2' }, 'Ulica'),
            React.createElement('input', {
              type: 'text',
              id: 'street',
              className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline transition-all duration-200',
              value: street,
              onChange: (e) => setStreet(e.target.value),
              disabled: loading || !isDataEditingAllowed, // NOVINKA: Disabled ak je po uzávierke
            })
          ),
          // Popisné číslo
          React.createElement(
            'div',
            null,
            React.createElement('label', { htmlFor: 'houseNumber', className: 'block text-gray-700 text-sm font-bold mb-2' }, 'Popisné číslo'),
            React.createElement('input', {
              type: 'text',
              id: 'houseNumber',
              className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline transition-all duration-200',
              value: houseNumber,
              onChange: (e) => setHouseNumber(e.target.value),
              disabled: loading || !isDataEditingAllowed, // NOVINKA: Disabled ak je po uzávierke
            })
          ),
          // Mesto
          React.createElement(
            'div',
            null,
            React.createElement('label', { htmlFor: 'city', className: 'block text-gray-700 text-sm font-bold mb-2' }, 'Mesto'),
            React.createElement('input', {
              type: 'text',
              id: 'city',
              className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline transition-all duration-200',
              value: city,
              onChange: (e) => setCity(e.target.value),
              disabled: loading || !isDataEditingAllowed, // NOVINKA: Disabled ak je po uzávierke
            })
          ),
          // PSČ
          React.createElement(
            'div',
            null,
            React.createElement('label', { htmlFor: 'postalCode', className: 'block text-gray-700 text-sm font-bold mb-2' }, 'PSČ'),
            React.createElement('input', {
              type: 'text',
              id: 'postalCode',
              className: `shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline transition-all duration-200 ${postalCodeError ? 'border-red-500' : ''}`,
              value: postalCode,
              onChange: (e) => {
                const { formattedValue, errorMsg } = formatAndValidatePostalCode(e.target.value);
                setPostalCode(formattedValue);
                setPostalCodeError(errorMsg);
              },
              maxLength: 6, // 5 číslic + 1 medzera
              disabled: loading || !isDataEditingAllowed, // NOVINKA: Disabled ak je po uzávierke
            }),
            postalCodeError && React.createElement('p', { className: 'text-red-500 text-xs italic mt-1', style: { wordBreak: 'break-all' } }, postalCodeError)
          ),
          // Štát
          React.createElement(
            'div',
            null,
            React.createElement('label', { htmlFor: 'country', className: 'block text-gray-700 text-sm font-bold mb-2' }, 'Štát'),
            React.createElement('input', {
              type: 'text',
              id: 'country',
              className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline transition-all duration-200',
              value: country,
              onChange: (e) => setCountry(e.target.value),
              disabled: loading || !isDataEditingAllowed, // NOVINKA: Disabled ak je po uzávierke
            })
          ),
          React.createElement(
            'button',
            {
              type: 'submit',
              className: 'mt-6 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200',
              disabled: loading || !isDataEditingAllowed, // NOVINKA: Disabled ak je po uzávierke
            },
            loading ? 'Ukladám...' : 'Uložiť fakturačné údaje'
          )
        )
      )
    )
  );
}

// Explicitne sprístupniť komponent globálne
window.ChangeBillingDataApp = ChangeBillingDataApp;
