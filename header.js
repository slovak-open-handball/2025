// Ochrana proti zobrazeniu stránky v iframe
// Tento kód zabráni načítaniu obsahu stránky v iframe a namiesto toho zobrazí chybovú správu.
if (window.self !== window.top) {
    // Ak je stránka načítaná v iframe, zabránime jej zobrazeniu
    document.body.innerHTML = ''; // Vymaže všetok existujúci obsah tela
    document.body.style.margin = '0'; // Odstráni okraje tela
    document.body.style.overflow = 'hidden'; // Zabraňuje posúvaniu

    const errorMessageDiv = document.createElement('div');
    errorMessageDiv.textContent = 'Túto webovú stránku nie je možné zobraziť.';
    errorMessageDiv.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        color: red;
        font-size: 2em;
        font-weight: bold;
        text-align: center;
        z-index: 9999;
        font-family: 'Inter', sans-serif; /* Používame font Inter pre konzistenciu */
    `;
    document.body.appendChild(errorMessageDiv);

    // Zastavíme načítanie ďalších skriptov a obsahu, ak je to možné
    throw new Error('Page cannot be displayed in an iframe.');
}

// Global application ID and Firebase configuration (should be consistent across all React apps)
// Tieto konštanty sú teraz definované v <head> logged-in-users.html
// const appId = '1:26454452024:web:6954b4f90f87a3a1eb43cd';
// const firebaseConfig = { ... };
// const initialAuthToken = null;

const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec";

// Helper function to format a Date object into 'YYYY-MM-DDTHH:mm' local string
const formatToDatetimeLocal = (date) => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = (date.getMinutes()).toString().padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// TopRightNotificationModal Component pre zobrazenie dočasných správ v pravom hornom rohu
function TopRightNotificationModal({ message, onClose, displayNotificationsEnabled }) {
  const [show, setShow] = React.useState(false);
  const timerRef = React.useRef(null);

  React.useEffect(() => {
    // Zobrazí notifikáciu len ak je povolené zobrazovanie notifikácií a je správa
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
  }, [message, onClose, displayNotificationsEnabled]);

  // Nevykresľuje sa, ak nie je zobrazené, nie je správa ALEBO ak sú notifikácie vypnuté
  if ((!show && !message) || !displayNotificationsEnabled) {
    return null;
  }

  return React.createElement(
    'div',
    {
      className: `fixed top-4 right-4 z-50 flex justify-end p-4 transition-transform duration-500 ease-out ${
        show ? 'translate-x-0' : 'translate-x-full' // Animácia z pravej strany
      }`,
      style: { pointerEvents: 'none', maxWidth: 'calc(100% - 32px)' } // Obmedzenie šírky pre menšie obrazovky
    },
    React.createElement(
      'div',
      {
        className: 'bg-[#3A8D41] text-white px-6 py-3 rounded-lg shadow-lg max-w-xs w-full text-center', // max-w-xs pre menšiu šírku
        style: { pointerEvents: 'auto' }
      },
      React.createElement('p', { className: 'font-semibold' }, message)
    )
  );
}

// CenterConfirmationModal pre pop-up notifikácie uprostred obrazovky
function CenterConfirmationModal({ message, onClose }) {
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
        setTimeout(onClose, 500); // Daj čas na animáciu pred resetom správy
      }, 5000); // Zobrazí sa na 5 sekúnd
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

  if (!show && !message) {
    return null;
  }

  return React.createElement(
    'div',
    {
      className: `fixed inset-0 flex items-center justify-center z-50 transition-opacity duration-500 ease-out ${
        show ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`
    },
    React.createElement(
      'div',
      {
        className: 'bg-white p-6 rounded-lg shadow-xl max-w-sm w-full text-center transform transition-transform duration-500 ease-out ' +
                   `${show ? 'scale-100' : 'scale-90'}`,
        style: { pointerEvents: 'auto' } // Umožni kliknutie na modal
      },
      React.createElement('p', { className: 'font-semibold text-gray-800 text-lg' }, message)
    )
  );
}


// GlobalNotificationHandler pre zobrazenie pop-up notifikácií a správu hlavičky
function GlobalNotificationHandler() {
  const [app, setApp] = React.useState(null);
  const [auth, setAuth] = React.useState(null);
  const [db, setDb] = React.useState(null);
  const [user, setUser] = React.useState(undefined); // Firebase User object from onAuthStateChanged
  const [userProfileData, setUserProfileData] = React.useState(null); 
  const [isAuthReady, setIsAuthReady] = React.useState(false); // Nový stav pre pripravenosť autentifikácie
  
  // Dva stavy pre rôzne typy notifikácií
  const [currentTopRightMessage, setCurrentTopRightMessage] = React.useState('');
  const [currentCenterMessage, setCurrentCenterMessage] = React.useState(''); // Nový stav pre centrálnu správu

  const [displayTopRightNotificationsEnabled, setDisplayTopRightNotificationsEnabled] = React.useState(true); // Získané z userProfileData, pre top-right
  const [lastNotificationTimestamp, setLastNotificationTimestamp] = React.useState(0); // Sledovanie poslednej zobrazenej notifikácie

  // Stav pre existenciu kategórií
  const [categoriesExist, setCategoriesExist] = React.useState(false); // Predvolene na false
  // Stavy pre dátumy registrácie
  const [registrationStartDate, setRegistrationStartDate] = React.useState(null);
  const [registrationEndDate, setRegistrationEndDate] = React.useState(null);
  // Nový stav pre celkovú pripravenosť nastavení a kategórií
  const [settingsAndCategoriesLoaded, setSettingsAndCategoriesLoaded] = React.useState(false);

  // Stav pre loading v rámci GNH (pre logout)
  const [loadingGNH, setLoadingGNH] = React.useState(false);


  // Globálna funkcia na spúšťanie notifikácií z iných komponentov
  React.useEffect(() => {
    window.showGlobalNotification = (message) => {
      setCurrentCenterMessage(message); // Nastaví správu pre centrálnu notifikáciu
    };
    return () => {
      // Vyčisti globálnu funkciu pri odpojení komponentu
      if (window.showGlobalNotification === setCurrentCenterMessage) {
        window.showGlobalNotification = (message) => {
          console.warn("Global notification function called after unmount:", message);
        };
      }
    };
  }, []); // Spusti raz pri pripojení komponentu

  // Effect pre inicializáciu Firebase a nastavenie Auth Listenera (spustí sa len raz)
  React.useEffect(() => {
    let unsubscribeAuth;
    let firestoreInstance;

    try {
      if (typeof firebase === 'undefined') {
        console.error("GNH: Firebase SDK nie je načítané. Uistite sa, že firebase.js je načítaný pred header.js.");
        return;
      }

      let firebaseApp;
      // Skontrolujte, či už existuje predvolená aplikácia Firebase
      if (firebase.apps.length === 0) {
        // Používame globálne firebaseConfig a initialAuthToken
        firebaseApp = firebase.initializeApp(firebaseConfig);
      } else {
        // Ak už predvolená aplikácia existuje, použite ju
        firebaseApp = firebase.app();
      }
      setApp(firebaseApp);

      const authInstance = firebase.auth(firebaseApp);
      setAuth(authInstance);
      firestoreInstance = firebase.firestore(firebaseApp);
      setDb(firestoreInstance);

      const signIn = async () => {
        try {
          if (typeof initialAuthToken !== 'undefined' && initialAuthToken) {
            await authInstance.signInWithCustomToken(initialAuthToken);
          } else {
            // initialAuthToken nie je k dispozícii alebo je prázdny.
          }
        } catch (e) {
          console.error("GNH: Chyba pri počiatočnom prihlásení Firebase (s custom tokenom):", e);
        }
      };

      unsubscribeAuth = authInstance.onAuthStateChanged(async (currentUser) => {
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
      console.error("GNH: Nepodarilo sa inicializovať Firebase:", e);
    }
  }, []);

  // Effect pre načítanie používateľských dát (vrátane displayNotifications)
  React.useEffect(() => {
    let unsubscribeUserDoc;

    if (isAuthReady && db && user) {
      try {
        const userDocRef = db.collection('users').doc(user.uid);
        unsubscribeUserDoc = userDocRef.onSnapshot(docSnapshot => {
          if (docSnapshot.exists) {
            const userData = docSnapshot.data();
            setUserProfileData(userData);
            
            let topRightNotificationsEnabled = true; // Predvolene povolené

            // Ak je rola 'user', top-right notifikácie sa VŽDY vypnú.
            // Pre ostatné roly sa rešpektuje nastavenie 'displayNotifications' z Firestore.
            if (userData.role === 'user') {
                topRightNotificationsEnabled = false;
            } else {
                topRightNotificationsEnabled = userData.displayNotifications !== undefined ? userData.displayNotifications : true;
            }
            
            setDisplayTopRightNotificationsEnabled(topRightNotificationsEnabled);
          } else {
            // Ak sa profil nenájde, predpokladáme, že notifikácie sú povolené (predvolené správanie)
            setDisplayTopRightNotificationsEnabled(true); 
          }
        }, error => {
          console.error("GNH: Chyba pri načítaní používateľských dát z Firestore:", error);
          // V prípade chyby tiež predpokladáme, že notifikácie sú povolené, aby sa neblokovali
          setDisplayTopRightNotificationsEnabled(true);
        });
      } catch (e) {
        console.error("GNH: Chyba pri nastavovaní onSnapshot pre používateľské dáta:", e);
        setDisplayTopRightNotificationsEnabled(true);
      }
    } else if (isAuthReady && user === null) {
      // Ak nie je používateľ prihlásený, notifikácie by sa nemali zobrazovať
      setDisplayTopRightNotificationsEnabled(false);
      setCurrentTopRightMessage(''); // Vymaž aktuálnu správu, ak používateľ nie je prihlásený
      setCurrentCenterMessage(''); // Vymaž aj centrálnu správu
      setUserProfileData(null); // Zabezpečiť, že userProfileData je null
    }


    return () => {
      if (unsubscribeUserDoc) {
        unsubscribeUserDoc();
      }
    };
  }, [isAuthReady, db, user]);

  // Effect pre načítanie kategórií a dátumov registrácie
  React.useEffect(() => {
    let unsubscribeCategories;
    let unsubscribeRegistrationSettings;
    let categoriesDataLoaded = false;
    let registrationDataLoaded = false;

    const checkAllLoaded = () => {
      if (categoriesDataLoaded && registrationDataLoaded) {
        setSettingsAndCategoriesLoaded(true);
      }
    };

    if (db) {
      // Načítanie kategórií
      const categoriesDocRef = db.collection('settings').doc('categories');
      unsubscribeCategories = categoriesDocRef.onSnapshot(docSnapshot => {
        if (docSnapshot.exists && Object.keys(docSnapshot.data()).length > 0) {
          setCategoriesExist(true);
        } else {
          setCategoriesExist(false);
        }
        categoriesDataLoaded = true;
        checkAllLoaded();
      }, error => {
        console.error("GNH: Chyba pri načítaní kategórií:", error);
        setCategoriesExist(false); // V prípade chyby predpokladáme, že neexistujú
        categoriesDataLoaded = true;
        checkAllLoaded();
      });

      // Načítanie dátumov registrácie
      const registrationDocRef = db.collection('settings').doc('registration');
      unsubscribeRegistrationSettings = registrationDocRef.onSnapshot(docSnapshot => {
        if (docSnapshot.exists) {
          const data = docSnapshot.data();
          setRegistrationStartDate(data.registrationStartDate ? data.registrationStartDate.toDate() : null);
          setRegistrationEndDate(data.registrationEndDate ? data.registrationEndDate.toDate() : null);
        } else {
          setRegistrationStartDate(null);
          setRegistrationEndDate(null);
        }
        registrationDataLoaded = true;
        checkAllLoaded();
      }, error => {
        console.error("GNH: Chyba pri načítaní dátumov registrácie:", error);
        setRegistrationStartDate(null);
        setRegistrationEndDate(null);
        registrationDataLoaded = true;
        checkAllLoaded();
      });
    }

    return () => {
      if (unsubscribeCategories) {
        unsubscribeCategories();
      }
      if (unsubscribeRegistrationSettings) {
        unsubscribeRegistrationSettings();
      }
    };
  }, [db]); // Závisí len od 'db'


  // Effect pre počúvanie nových notifikácií (len pre top-right notifikácie)
  React.useEffect(() => {
    let unsubscribeNotifications;
    // appId nastavené na 'default-app-id'
    const appId = 'default-app-id'; 

    // Počúvaj na nové neprečítané notifikácie pre tohto používateľa alebo 'all_admins'
    // POZNÁMKA: Filtrujeme len neprečítané (`read: false`) notifikácie
    if (db && user && userProfileData && displayTopRightNotificationsEnabled) {
      // Načítaj posledný timestamp zobrazenej notifikácie z localStorage
      const storedLastTimestamp = localStorage.getItem(`lastNotificationTimestamp_${user.uid}`);
      if (storedLastTimestamp) {
          setLastNotificationTimestamp(parseInt(storedLastTimestamp, 10));
      } else {
          setLastNotificationTimestamp(0);
      }

      unsubscribeNotifications = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('adminNotifications')
        .where('recipientId', 'in', [user.uid, 'all_admins'])
        .where('read', '==', false) // Len neprečítané
        .orderBy('timestamp', 'desc') // Najnovšie prvé
        .limit(1) // Zaujíma nás len jedna najnovšia pre pop-up
        .onSnapshot(snapshot => {
          if (!snapshot.empty) {
            const latestUnreadNotification = snapshot.docs[0];
            const notificationData = latestUnreadNotification.data();
            const notificationTimestamp = notificationData.timestamp ? notificationData.timestamp.toDate().getTime() : 0;

            // Zobraz notifikáciu len ak je novšia ako posledná zobrazená
            // A ak má používateľ povolené zobrazovanie top-right notifikácií
            if (notificationTimestamp > lastNotificationTimestamp && displayTopRightNotificationsEnabled) {
              const isDeletedForCurrentUser = notificationData.deletedFor && notificationData.deletedFor.includes(user.uid);
              if (!isDeletedForCurrentUser) {
                setCurrentTopRightMessage(notificationData.message); // Nastavuje top-right správu
                setLastNotificationTimestamp(notificationTimestamp); // Aktualizuj timestamp poslednej zobrazenej
                localStorage.setItem(`lastNotificationTimestamp_${user.uid}`, notificationTimestamp.toString()); // Ulož do localStorage

                // Označ notifikáciu ako prečítanú, ak sa zobrazila A používateľ má povolené notifikácie
                if (displayTopRightNotificationsEnabled) { // Opakovaná kontrola pre istotu
                  db.collection('artifacts').doc(appId).collection('public').doc('data').collection('adminNotifications').doc(latestUnreadNotification.id).update({
                    read: true
                  }).catch(e => console.error("GNH: Chyba pri označovaní notifikácie ako prečítanej:", e));
                }
              }
            }
          }
        }, error => {
          console.error("GNH: Chyba pri načítaní notifikácií pre pop-up:", error);
        });
    } else if (userProfileData && displayTopRightNotificationsEnabled === false) { // Ak sú notifikácie vypnuté
        if (unsubscribeNotifications) {
            unsubscribeNotifications();
            unsubscribeNotifications = null;
        }
        setCurrentTopRightMessage(''); // Vymaž aktuálnu správu, ak používateľ vypne notifikácie
    }


    return () => {
      if (unsubscribeNotifications) {
        unsubscribeNotifications();
      }
    };
  }, [db, user, userProfileData, lastNotificationTimestamp, displayTopRightNotificationsEnabled]);

  // Effect pre aktualizáciu viditeľnosti registra-link
  React.useEffect(() => {
    const registerLink = document.getElementById('register-link');
    if (!registerLink) return;

    // Ak ešte nie sú načítané všetky nastavenia (vrátane kategórií), skryj odkaz a počkaj
    if (!settingsAndCategoriesLoaded) {
      registerLink.classList.add('hidden');
      return;
    }

    const now = new Date();
    const isRegistrationPeriod = (registrationStartDate && now >= registrationStartDate) &&
                                 (registrationEndDate ? now <= registrationEndDate : true);
    const isBeforeRegistration = (registrationStartDate && now < registrationStartDate);

    // Podmienka pre zobrazenie "Registrácia na turnaj"
    // Zobrazí sa, ak:
    // 1. Používateľ NIE JE prihlásený (user === null)
    // 2. Existujú kategórie (categoriesExist je true)
    // 3. A (je pred začiatkom registrácie ALEBO je v období registrácie)
    // Pridaná podmienka, že sa odkaz nezobrazí, ak je aktuálny čas skorší ako dátum začiatku registrácie.
    if (user === null && categoriesExist && isRegistrationPeriod) {
        registerLink.classList.remove('hidden');
    } else if (user === null && categoriesExist && isBeforeRegistration) {
        registerLink.classList.add('hidden');
    }
    else {
      registerLink.classList.add('hidden');
    }
  }, [categoriesExist, registrationStartDate, registrationEndDate, user, settingsAndCategoriesLoaded]);

  // handleLogout funkcia presunutá do GlobalNotificationHandler
  const handleLogout = React.useCallback(async () => {
    if (!auth) return;
    try {
      setLoadingGNH(true); // Nastavíme loading pre GNH
      await auth.signOut();
      if (typeof window.showGlobalNotification === 'function') {
        window.showGlobalNotification("Úspešne odhlásený.");
      }
      window.location.href = 'login.html';
      setUser(null); // Explicitne nastaviť user na null
      setUserProfileData(null); // Explicitne nastaviť userProfileData na null
    } catch (e) {
      console.error("GNH: Chyba pri odhlásení:", e);
      setCurrentCenterMessage(`Chyba pri odhlásení: ${e.message}`);
    } finally {
      setLoadingGNH(false); // Ukončíme loading pre GNH
    }
  }, [auth]);

  // Effect pre aktualizáciu viditeľnosti odkazov pre prihlásenie/profil/odhlásenie
  React.useEffect(() => {
    const authLink = document.getElementById('auth-link');
    const profileLink = document.getElementById('profile-link');
    const logoutButton = document.getElementById('logout-button');
    // registerLink je už spravovaný iným useEffectom vyššie

    if (authLink) {
      if (user) { // Ak je používateľ prihlásený
        authLink.classList.add('hidden');
        profileLink && profileLink.classList.remove('hidden');
        logoutButton && logoutButton.classList.remove('hidden');
      } else { // Ak používateľ nie je prihlásený
        authLink.classList.remove('hidden');
        profileLink && profileLink.classList.add('hidden');
        logoutButton && logoutButton.classList.add('hidden');
      }
    }
  }, [user]);

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


  return React.createElement(
    React.Fragment,
    null,
    React.createElement(TopRightNotificationModal, {
      message: currentTopRightMessage,
      onClose: () => setCurrentTopRightMessage(''),
      displayNotificationsEnabled: displayTopRightNotificationsEnabled // Prop pre top-right modal
    }),
    React.createElement(CenterConfirmationModal, { // Vykresľuje centrálnu notifikáciu
      message: currentCenterMessage,
      onClose: () => setCurrentCenterMessage('')
    })
  );
}

// Render GlobalNotificationHandler do špecifického DOM elementu
// Vytvoríme koreňový element pre React komponent, ak ešte neexistuje
let notificationRoot = document.getElementById('global-notification-root');
if (!notificationRoot) {
  notificationRoot = document.createElement('div');
  notificationRoot.id = 'global-notification-root';
  document.body.appendChild(notificationRoot);
}

// Vykreslíme GlobalNotificationHandler do tohto koreňového elementu
try {
  ReactDOM.render(
    React.createElement(GlobalNotificationHandler),
    notificationRoot
  );
} catch (e) {
  console.error("GNH: Chyba pri vykresľovaní GlobalNotificationHandler:", e);
}

// ODSTRÁNENÝ KOMPONENT UsersManagementApp
// Logika pre správu používateľov (úprava rolí, schvaľovanie, mazanie)
// bola presunutá do príslušného súboru, napr. logged-in-users.js,
// a už nie je súčasťou header.js.
