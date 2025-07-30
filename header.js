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

// ZMENA: Premenovaný komponent pre notifikácie v pravom hornom rohu
function TopRightNotificationModal({ message, onClose, displayNotificationsEnabled }) {
  const [show, setShow] = React.useState(false);
  const timerRef = React.useRef(null);

  React.useEffect(() => {
    // Diagnostický výpis: Sledujeme, kedy sa useEffect aktivuje a s akými hodnotami
    console.log("TopRightNotificationModal (header.js): useEffect triggered. Message:", message, "Display Enabled:", displayNotificationsEnabled); 

    // Zobrazí notifikáciu len ak je povolené zobrazovanie notifikácií a je správa
    if (message && displayNotificationsEnabled) {
      console.log("TopRightNotificationModal (header.js): Showing notification because message and display are enabled."); 
      setShow(true);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        console.log("TopRightNotificationModal (header.js): Hiding notification after timeout."); 
        setShow(false);
        setTimeout(onClose, 500);
      }, 10000);
    } else {
      console.log("TopRightNotificationModal (header.js): Hiding notification (either no message or display is disabled)."); 
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

  // Diagnostický výpis: Sledujeme, kedy sa komponent vykresľuje a aký má stav
  console.log("TopRightNotificationModal (header.js): render. Current show state:", show, "Message:", message, "Display Enabled:", displayNotificationsEnabled); 

  // Nevykresľuje sa, ak nie je zobrazené, nie je správa ALEBO ak sú notifikácie vypnuté
  if ((!show && !message) || !displayNotificationsEnabled) {
    console.log("TopRightNotificationModal (header.js): Returning null (not rendering the UI)."); 
    return null;
  }

  return React.createElement(
    'div',
    {
      // ZMENA: Triedy pre pozíciu v pravom hornom rohu
      className: `fixed top-4 right-4 z-50 flex justify-end p-4 transition-transform duration-500 ease-out ${
        show ? 'translate-x-0' : 'translate-x-full' // Animácia z pravej strany
      }`,
      style: { pointerEvents: 'none', maxWidth: 'calc(100% - 32px)' } // Obmedzenie šírky pre menšie obrazovky
    },
    React.createElement(
      'div',
      {
        className: 'bg-[#3A8D41] text-white px-6 py-3 rounded-lg shadow-lg max-w-xs w-full text-center', // ZMENA: max-w-xs pre menšiu šírku
        style: { pointerEvents: 'auto' }
      },
      React.createElement('p', { className: 'font-semibold' }, message)
    )
  );
}

// NOVÝ KOMPONENT: CenterConfirmationModal pre pop-up notifikácie uprostred obrazovky
function CenterConfirmationModal({ message, onClose }) {
  const [show, setShow] = React.useState(false);
  const timerRef = React.useRef(null);

  React.useEffect(() => {
    console.log("CenterConfirmationModal (header.js): useEffect triggered. Message:", message);
    if (message) {
      setShow(true);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        console.log("CenterConfirmationModal (header.js): Hiding notification after timeout.");
        setShow(false);
        setTimeout(onClose, 500); // Daj čas na animáciu pred resetom správy
      }, 5000); // Zobrazí sa na 5 sekúnd
    } else {
      console.log("CenterConfirmationModal (header.js): Hiding notification (no message).");
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
    console.log("CenterConfirmationModal (header.js): Returning null (not rendering the UI).");
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


// ConfirmationModal Component (converted to React.createElement)
function ConfirmationModal({ show, message, onConfirm, onCancel, loading }) {
  if (!show) return null;

  return React.createElement(
    'div',
    { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50' },
    React.createElement(
      'div',
      { className: 'bg-white p-6 rounded-lg shadow-xl max-w-sm w-full text-center' },
      React.createElement('p', { className: 'text-lg font-semibold mb-4' }, message),
      React.createElement(
        'div',
        { className: 'flex justify-center space-x-4' },
        React.createElement(
          'button',
          {
            onClick: onCancel,
            className: 'bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded-lg transition-colors duration-200',
            disabled: loading,
          },
          'Zrušiť'
        ),
        React.createElement(
          'button',
          {
            onClick: onConfirm,
            className: 'bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg transition-colors duration-200',
            disabled: loading,
          },
          loading ? 'Potvrdzujem...' : 'Potvrdiť'
        )
      )
    )
  );
}

// RoleEditModal Component (converted to React.createElement)
function RoleEditModal({ show, user, onClose, onSave, loading }) {
  const [selectedRole, setSelectedRole] = React.useState(user ? user.role : 'user');
  const [isApproved, setIsApproved] = React.useState(user ? user.approved : false);

  React.useEffect(() => {
    if (user) {
      setSelectedRole(user.role);
      setIsApproved(user.approved);
    }
  }, [user]);

  if (!show || !user) return null;

  const handleSave = () => {
    // Používame user.id namiesto user.uid
    onSave(user.id, selectedRole, isApproved); 
  };

  return React.createElement(
    'div',
    { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50' },
    React.createElement(
      'div',
      { className: 'bg-white p-6 rounded-lg shadow-xl max-w-sm w-full' },
      React.createElement('h2', { className: 'text-xl font-bold mb-4' }, `Upraviť rolu pre ${user.email}`),
      React.createElement(
        'div',
        { className: 'mb-4' },
        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'role-select' }, 'Rola'),
        React.createElement(
          'select',
          {
            id: 'role-select',
            className: 'shadow border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
            value: selectedRole,
            onChange: (e) => setSelectedRole(e.target.value),
            disabled: loading,
          },
          React.createElement('option', { value: 'user' }, 'Používateľ'),
          React.createElement('option', { value: 'admin' }, 'Administrátor')
        )
      ),
      // ODSTRÁNENÉ: Checkbox pre schválenie sa už nezobrazuje
      React.createElement(
        'div',
        { className: 'flex justify-end space-x-4' },
        React.createElement(
          'button',
          {
            onClick: onClose,
            className: 'bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded-lg transition-colors duration-200',
            disabled: loading,
          },
          'Zrušiť'
        ),
        React.createElement(
          'button',
          {
            onClick: handleSave,
            className: 'bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg transition-colors duration-200',
            disabled: loading,
          },
          loading ? 'Ukladám...' : 'Uložiť'
        )
      )
    )
  );
}


// NOVÝ KOMPONENT: GlobalNotificationHandler pre zobrazenie pop-up notifikácií
function GlobalNotificationHandler() {
  const [app, setApp] = React.useState(null);
  const [auth, setAuth] = React.useState(null);
  const [db, setDb] = React.useState(null);
  const [user, setUser] = React.useState(undefined); // Firebase User object from onAuthStateChanged
  const [userProfileData, setUserProfileData] = React.useState(null); 
  const [isAuthReady, setIsAuthReady] = React.useState(false); // Nový stav pre pripravenosť autentifikácie
  
  // ZMENA: Dva stavy pre rôzne typy notifikácií
  const [currentTopRightMessage, setCurrentTopRightMessage] = React.useState('');
  const [currentCenterMessage, setCurrentCenterMessage] = React.useState(''); // Nový stav pre centrálnu správu

  const [displayTopRightNotificationsEnabled, setDisplayTopRightNotificationsEnabled] = React.useState(true); // Získané z userProfileData, pre top-right
  const [lastNotificationTimestamp, setLastNotificationTimestamp] = React.useState(0); // Sledovanie poslednej zobrazenej notifikácie

  // NOVINKA: Globálna funkcia na spúšťanie notifikácií z iných komponentov
  // ZMENA: Táto funkcia teraz nastavuje správu pre centrálnu notifikáciu
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

  // Effect for Firebase initialization and Auth Listener setup (runs only once)
  React.useEffect(() => {
    console.log("GNH: Spúšťam inicializáciu Firebase...");
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
        console.log("GNH: Inicializujem novú Firebase aplikáciu.");
        firebaseApp = firebase.initializeApp(firebaseConfig);
      } else {
        // Ak už predvolená aplikácia existuje, použite ju
        firebaseApp = firebase.app();
        console.warn("GNH: Firebase App named '[DEFAULT]' už existuje. Používam existujúcu inštanciu.");
      }
      setApp(firebaseApp);

      const authInstance = firebase.auth(firebaseApp);
      setAuth(authInstance);
      firestoreInstance = firebase.firestore(firebaseApp);
      setDb(firestoreInstance);
      console.log("GNH: Firebase inicializované. Nastavujem Auth listener.");

      const signIn = async () => {
        try {
          if (typeof initialAuthToken !== 'undefined' && initialAuthToken) {
            console.log("GNH: Pokúšam sa prihlásiť s custom tokenom.");
            await authInstance.signInWithCustomToken(initialAuthToken);
          } else {
            console.log("GNH: initialAuthToken nie je k dispozícii alebo je prázdny.");
          }
        } catch (e) {
          console.error("GNH: Chyba pri počiatočnom prihlásení Firebase (s custom tokenom):", e);
        }
      };

      unsubscribeAuth = authInstance.onAuthStateChanged(async (currentUser) => {
        console.log("GNH: onAuthStateChanged - Používateľ:", currentUser ? currentUser.uid : "null");
        setUser(currentUser);
        setIsAuthReady(true);
      });

      signIn();

      return () => {
        if (unsubscribeAuth) {
          console.log("GNH: Ruším odber onAuthStateChanged.");
          unsubscribeAuth();
        }
      };
    } catch (e) {
      console.error("GNH: Nepodarilo sa inicializovať Firebase:", e);
    }
  }, []);

  // Effect for fetching userProfileData (including displayNotifications)
  React.useEffect(() => {
    let unsubscribeUserDoc;
    console.log("GNH: Spúšťam useEffect pre načítanie profilu používateľa. isAuthReady:", isAuthReady, "db:", !!db, "user:", !!user);

    if (isAuthReady && db && user) {
      try {
        const userDocRef = db.collection('users').doc(user.uid);
        unsubscribeUserDoc = userDocRef.onSnapshot(docSnapshot => {
          console.log("GNH: onSnapshot pre používateľský dokument spustený.");
          if (docSnapshot.exists) {
            const userData = docSnapshot.data();
            console.log("GNH: Používateľský profil načítaný:", userData);
            setUserProfileData(userData);
            
            let topRightNotificationsEnabled = true; // Predvolene povolené

            // ZMENA: Ak je rola 'user', top-right notifikácie sa VŽDY vypnú.
            // Pre ostatné roly sa rešpektuje nastavenie 'displayNotifications' z Firestore.
            if (userData.role === 'user') {
                console.log("GNH: Používateľ je typu 'user', top-right notifikácie budú vypnuté (prepisujem displayNotifications).");
                topRightNotificationsEnabled = false;
            } else {
                topRightNotificationsEnabled = userData.displayNotifications !== undefined ? userData.displayNotifications : true;
                console.log(`GNH: Používateľ je typu '${userData.role}', displayTopRightNotificationsEnabled nastavené na:`, topRightNotificationsEnabled);
            }
            
            setDisplayTopRightNotificationsEnabled(topRightNotificationsEnabled);
            console.log("GNH: displayTopRightNotificationsEnabled nastavené na:", topRightNotificationsEnabled);
          } else {
            console.warn("GNH: Používateľský profil sa nenašiel pre UID:", user.uid);
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
      console.log("GNH: Používateľ nie je prihlásený, nastavujem displayTopRightNotificationsEnabled na false.");
      setDisplayTopRightNotificationsEnabled(false);
      setCurrentTopRightMessage(''); // Vymaž aktuálnu správu, ak používateľ nie je prihlásený
      setCurrentCenterMessage(''); // Vymaž aj centrálnu správu
      setUserProfileData(null); // Zabezpečiť, že userProfileData je null
    }


    return () => {
      if (unsubscribeUserDoc) {
        console.log("GNH: Ruším odber onSnapshot pre používateľský dokument.");
        unsubscribeUserDoc();
      }
    };
  }, [isAuthReady, db, user]);

  // Effect for listening to new notifications (only for top-right notifications)
  React.useEffect(() => {
    let unsubscribeNotifications;
    // ZMENA: appId nastavené na 'default-app-id'
    const appId = 'default-app-id'; 
    console.log("GNH: Spúšťam useEffect pre top-right notifikácie. db:", !!db, "user:", !!user, "userProfileData:", !!userProfileData, "displayTopRightNotificationsEnabled:", displayTopRightNotificationsEnabled);

    // Počúvaj na nové neprečítané notifikácie pre tohto používateľa alebo 'all_admins'
    // POZNÁMKA: Filtrujeme len neprečítané (`read: false`) notifikácie
    if (db && user && userProfileData && displayTopRightNotificationsEnabled) { // ZMENA: Kontrolujeme displayTopRightNotificationsEnabled
      console.log("GNH: Podmienky pre načítanie top-right notifikácií splnené.");
      // Načítaj posledný timestamp zobrazenej notifikácie z localStorage
      const storedLastTimestamp = localStorage.getItem(`lastNotificationTimestamp_${user.uid}`);
      if (storedLastTimestamp) {
          setLastNotificationTimestamp(parseInt(storedLastTimestamp, 10));
          console.log("GNH: Načítaný lastNotificationTimestamp z localStorage:", storedLastTimestamp);
      } else {
          console.log("GNH: lastNotificationTimestamp v localStorage nenájdený, inicializujem na 0.");
      }

      unsubscribeNotifications = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('adminNotifications')
        .where('recipientId', 'in', [user.uid, 'all_admins'])
        .where('read', '==', false) // Len neprečítané
        .orderBy('timestamp', 'desc') // Najnovšie prvé
        .limit(1) // Zaujíma nás len jedna najnovšia pre pop-up
        .onSnapshot(snapshot => {
          console.log("GNH: onSnapshot pre adminNotifications spustený.");
          if (!snapshot.empty) {
            const latestUnreadNotification = snapshot.docs[0];
            const notificationData = latestUnreadNotification.data();
            const notificationTimestamp = notificationData.timestamp ? notificationData.timestamp.toDate().getTime() : 0;
            console.log("GNH: Najnovšia neprečítaná notifikácia:", notificationData, "Timestamp:", notificationTimestamp, "Last shown:", lastNotificationTimestamp);

            // Zobraz notifikáciu len ak je novšia ako posledná zobrazená
            // A ak má používateľ povolené zobrazovanie top-right notifikácií
            if (notificationTimestamp > lastNotificationTimestamp && displayTopRightNotificationsEnabled) { // ZMENA: Kontrola displayTopRightNotificationsEnabled
              const isDeletedForCurrentUser = notificationData.deletedFor && notificationData.deletedFor.includes(user.uid);
              if (!isDeletedForCurrentUser) {
                setCurrentTopRightMessage(notificationData.message); // ZMENA: Nastavuje top-right správu
                setLastNotificationTimestamp(notificationTimestamp); // Aktualizuj timestamp poslednej zobrazenej
                localStorage.setItem(`lastNotificationTimestamp_${user.uid}`, notificationTimestamp.toString()); // Ulož do localStorage
                console.log("GNH: Zobrazujem novú top-right notifikáciu a aktualizujem timestamp.");

                // ZMENA: Označ notifikáciu ako prečítanú, ak sa zobrazila A používateľ má povolené notifikácie
                if (displayTopRightNotificationsEnabled) { // Opakovaná kontrola pre istotu
                  console.log("GNH: Označujem notifikáciu ako prečítanú (read: true). ID:", latestUnreadNotification.id);
                  db.collection('artifacts').doc(appId).collection('public').doc('data').collection('adminNotifications').doc(latestUnreadNotification.id).update({
                    read: true
                  }).catch(e => console.error("GNH: Chyba pri označovaní notifikácie ako prečítanej:", e));
                }
              } else {
                console.log("GNH: Notifikácia je označená ako vymazaná pre aktuálneho používateľa, nezobrazujem.");
              }
            } else {
              console.log("GNH: Notifikácia nie je novšia alebo top-right notifikácie sú vypnuté, nezobrazujem pop-up.");
            }
          } else {
            console.log("GNH: Žiadne neprečítané top-right notifikácie na zobrazenie.");
          }
        }, error => {
          console.error("GNH: Chyba pri načítaní notifikácií pre pop-up:", error);
        });
    } else if (userProfileData && displayTopRightNotificationsEnabled === false) { // Ak sú notifikácie vypnuté
        console.log("GNH: Top-right notifikácie sú vypnuté v profile používateľa. Zrušujem odber a čistím správu.");
        if (unsubscribeNotifications) {
            unsubscribeNotifications();
            unsubscribeNotifications = null;
        }
        setCurrentTopRightMessage(''); // Vymaž aktuálnu správu, ak používateľ vypne notifikácie
    } else {
        console.log("GNH: Podmienky pre načítanie top-right notifikácií nesplnené (napr. nie je prihlásený alebo chýbajú dáta profilu).");
    }


    return () => {
      if (unsubscribeNotifications) {
        console.log("GNH: Ruším odber onSnapshot pre notifikácie.");
        unsubscribeNotifications();
      }
    };
  }, [db, user, userProfileData, lastNotificationTimestamp, displayTopRightNotificationsEnabled]); // Závisí aj od lastNotificationTimestamp a displayTopRightNotificationsEnabled

  return React.createElement(
    React.Fragment,
    null,
    React.createElement(TopRightNotificationModal, {
      message: currentTopRightMessage,
      onClose: () => setCurrentTopRightMessage(''),
      displayNotificationsEnabled: displayTopRightNotificationsEnabled // Prop pre top-right modal
    }),
    React.createElement(CenterConfirmationModal, { // NOVINKA: Vykresľuje centrálnu notifikáciu
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
  console.log("GNH: Vytvoril som a pridal 'global-notification-root' div do tela dokumentu.");
} else {
  console.log("GNH: 'global-notification-root' div už existuje.");
}

// Vykreslíme GlobalNotificationHandler do tohto koreňového elementu
try {
  ReactDOM.render(
    React.createElement(GlobalNotificationHandler),
    notificationRoot
  );
  console.log("GNH: GlobalNotificationHandler úspešne vykreslený.");
} catch (e) {
  console.error("GNH: Chyba pri vykresľovaní GlobalNotificationHandler:", e);
}


// Pôvodný kód pre UsersManagementApp a jeho globálne sprístupnenie zostáva nezmenený
// Main React component for the logged-in-users.html page
// ZMENA: Premenované z UsersApp na UsersManagementApp, aby zodpovedalo názvu v logged-in-users.html
// a presunuté mimo funkcie, aby bolo globálne dostupné.
function UsersManagementApp() {
  // ZMENA: Podmienka na spustenie, keď NIE JE na stránke logged-in-users.html
  if (window.location.pathname.includes('logged-in-users.html')) {
    console.log("UsersManagementApp (header.js): Detekovaná stránka logged-in-users.html. Nebudem spúšťať komponent pre hlavičku.");
    return null; // Nespúšťať komponent, ak je na správcovskej stránke
  }

  // Ak sa sem dostaneme, znamená to, že NIE SME na logged-in-users.html, takže pokračujeme vo vykresľovaní
  console.log("UsersManagementApp (header.js): Nie je na stránke logged-in-users.html. Spúšťam komponent pre hlavičku.");


  const [app, setApp] = React.useState(null);
  const [auth, setAuth] = React.useState(null);
  const [db, setDb] = React.useState(null);
  const [user, setUser] = React.useState(undefined); // Firebase User object from onAuthStateChanged
  const [userProfileData, setUserProfileData] = React.useState(null); 
  const [isAuthReady, setIsAuthReady] = React.useState(false); // Nový stav pre pripravenosť autentifikácie
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  // ZMENA: userNotificationMessage stav bol odstránený, pretože sa používa globálna funkcia

  const [users, setUsers] = React.useState([]);
  const [showConfirmationModal, setShowConfirmationModal] = React.useState(false);
  const [userToDelete, setUserToDelete] = React.useState(null);
  const [showRoleEditModal, setShowRoleEditModal] = React.useState(false);
  const [userToEditRole, setUserToEditRole] = React.useState(null);

  // ZMENA: appId nastavené na 'default-app-id'
  const appId = 'default-app-id'; 

  // Effect for Firebase initialization and Auth Listener setup (runs only once)
  React.useEffect(() => {
    let unsubscribeAuth;
    let firestoreInstance;

    try {
      if (typeof firebase === 'undefined') {
        console.error("UsersManagementApp: Firebase SDK nie je načítané."); // Zmena logu
        setError("Firebase SDK nie je načítané. Skontrolujte logged-in-users.html."); // Zmena logu
        setLoading(false);
        return;
      }

      let firebaseApp;
      // ZMENA: Používame globálnu premennú firebaseConfig namiesto __firebase_config
      if (firebase.apps.length === 0) {
        firebaseApp = firebase.initializeApp(firebaseConfig);
      } else {
        firebaseApp = firebase.app();
      }
      setApp(firebaseApp);

      const authInstance = firebase.auth(firebaseApp);
      setAuth(authInstance);
      firestoreInstance = firebase.firestore(firebaseApp);
      setDb(firestoreInstance);

      const signIn = async () => {
        try {
          // ZMENA: Používame globálnu premennú initialAuthToken namiesto __initial_auth_token
          if (typeof initialAuthToken !== 'undefined' && initialAuthToken) {
            await authInstance.signInWithCustomToken(initialAuthToken);
          }
        } catch (e) {
          console.error("UsersManagementApp: Chyba pri počiatočnom prihlásení Firebase:", e); // Zmena logu
          setError(`Chyba pri prihlásení: ${e.message}`);
        }
      };

      unsubscribeAuth = authInstance.onAuthStateChanged(async (currentUser) => {
        console.log("UsersManagementApp: onAuthStateChanged - Používateľ:", currentUser ? currentUser.uid : "null"); // Zmena logu
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
      console.error("UsersManagementApp: Nepodarilo sa inicializovať Firebase:", e); // Zmena logu
      setError(`Chyba pri inicializácii Firebase: ${e.message}`);
      setLoading(false);
    }
  }, []);

  // NOVÝ EFFECT: Načítanie používateľských dát z Firestore po inicializácii Auth a DB
  React.useEffect(() => {
    let unsubscribeUserDoc;

    if (isAuthReady && db && user !== undefined) {
      if (user === null) {
        console.log("UsersManagementApp: Auth je ready a používateľ je null, presmerovávam na login.html"); // Zmena logu
        window.location.href = 'login.html';
        return;
      }

      if (user) {
        console.log(`UsersManagementApp: Pokúšam sa načítať používateľský dokument pre UID: ${user.uid}`); // Zmena logu
        setLoading(true);

        try {
          const userDocRef = db.collection('users').doc(user.uid);
          unsubscribeUserDoc = userDocRef.onSnapshot(docSnapshot => {
            console.log("UsersManagementApp: onSnapshot pre používateľský dokument spustený."); // Zmena logu
            if (docSnapshot.exists) {
              const userData = docSnapshot.data();
              console.log("UsersManagementApp: Používateľský dokument existuje, dáta:", userData); // Zmena logu

              // --- OKAMŽITÉ ODHLÁSENIE, AK passwordLastChanged NIE JE PLATNÝ TIMESTAMP ---
              if (!userData.passwordLastChanged || typeof userData.passwordLastChanged.toDate !== 'function') {
                  console.error("UsersManagementApp: passwordLastChanged NIE JE platný Timestamp objekt! Typ:", typeof userData.passwordLastChanged, "Hodnota:", userData.passwordLastChanged); // Zmena logu
                  console.log("UsersManagementApp: Okamžite odhlasujem používateľa kvôli neplatnému timestampu zmeny hesla."); // Zmena logu
                  auth.signOut();
                  window.location.href = 'login.html';
                  localStorage.removeItem(`passwordLastChanged_${user.uid}`);
                  setUser(null); // Explicitne nastaviť user na null
                  setUserProfileData(null); // Explicitne nastaviť userProfileData na null
                  return;
              }

              const firestorePasswordChangedTime = userData.passwordLastChanged.toDate().getTime();
              const localStorageKey = `passwordLastChanged_${user.uid}`;
              let storedPasswordChangedTime = parseInt(localStorage.getItem(localStorageKey) || '0', 10);

              console.log(`UsersManagementApp: Firestore passwordLastChanged (konvertované): ${firestorePasswordChangedTime}, Stored: ${storedPasswordChangedTime}`); // Zmena logu

              if (storedPasswordChangedTime === 0 && firestorePasswordChangedTime !== 0) {
                  localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
                  console.log("UsersManagementApp: Inicializujem passwordLastChanged v localStorage (prvé načítanie)."); // Zmena logu
              } else if (firestorePasswordChangedTime > storedPasswordChangedTime) {
                  console.log("UsersManagementApp: Detekovaná zmena hesla na inom zariadení/relácii. Odhlasujem používateľa."); // Zmena logu
                  auth.signOut();
                  window.location.href = 'login.html';
                  localStorage.removeItem(localStorageKey);
                  setUser(null); // Explicitne nastaviť user na null
                  setUserProfileData(null); // Explicitne nastaviť userProfileData na null
                  return;
              } else if (firestorePasswordChangedTime < storedPasswordChangedTime) {
                  console.warn("UsersManagementApp: Detekovaný starší timestamp z Firestore ako uložený. Odhlasujem používateľa (potenciálny nesúlad)."); // Zmena logu
                  auth.signOut();
                  window.location.href = 'login.html';
                  localStorage.removeItem(localStorageKey);
                  setUser(null); // Explicitne nastaviť user na null
                  setUserProfileData(null); // Explicitne nastaviť userProfileData na null
                  return;
              } else {
                  localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
              }
              // --- KONIEC LOGIKY ODHLÁSENIA ---

              // NOVÁ LOGIKA: Odhlásenie, ak je používateľ admin a nie je schválený
              if (userData.role === 'admin' && userData.approved === false) {
                  console.log("UsersManagementApp: Používateľ je admin a nie je schválený. Odhlasujem."); // Zmena logu
                  auth.signOut();
                  window.location.href = 'login.html';
                  setUser(null); // Explicitne nastaviť user na null
                  setUserProfileData(null); // Explicitne nastaviť userProfileData na null
                  return; // Zastav ďalšie spracovanie
              }

              setUserProfileData(userData);
              
              setLoading(false);
              setError('');

              if (typeof window.updateMenuItemsVisibility === 'function') {
                  window.updateMenuItemsVisibility(userData.role);
              }

              console.log("UsersManagementApp: Načítanie používateľských dát dokončené, loading: false"); // Zmena logu
            } else {
              console.warn("UsersManagementApp: Používateľský dokument sa nenašiel pre UID:", user.uid); // Zmena logu
              setError("Chyba: Používateľský profil sa nenašiel alebo nemáte dostatočné oprávnenia. Skúste sa prosím znova prihlásiť.");
              setLoading(false);
              setUser(null); // Explicitne nastaviť user na null
              setUserProfileData(null); // Explicitne nastaviť userProfileData na null
            }
          }, error => {
            console.error("UsersManagementApp: Chyba pri načítaní používateľských dát z Firestore (onSnapshot error):", error); // Zmena logu
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
                setError(`Chyba pri načítaní používateľských dát: ${e.message}`);
            }
            setLoading(false);
            console.log("UsersManagementApp: Načítanie používateľských dát zlyhalo, loading: false"); // Zmena logu
            setUser(null); // Explicitne nastaviť user na null
            setUserProfileData(null); // Explicitne nastaviť userProfileData na null
          });
        } catch (e) {
          console.error("UsersManagementApp: Chyba pri nastavovaní onSnapshot pre používateľské dáta (try-catch):", e); // Zmena logu
          setError(`Chyba pri nastavovaní poslucháča pre používateľské dáta: ${e.message}`);
          setLoading(false);
          setUser(null); // Explicitne nastaviť user na null
          setUserProfileData(null); // Explicitne nastaviť userProfileData na null
        }
      } else { // Ak user nie je null ani undefined, ale je false (napr. po odhlásení)
          setLoading(false);
          setUserProfileData(null); // Zabezpečiť, že userProfileData je null, ak user nie je prihlásený
      }
    } else if (isAuthReady && user === undefined) {
        console.log("UsersManagementApp: Auth ready, user undefined. Nastavujem loading na false."); // Zmena logu
        setLoading(false);
    }

    return () => {
      if (unsubscribeUserDoc) {
        console.log("UsersManagementApp: Ruším odber onSnapshot pre používateľský dokument."); // Zmena logu
        unsubscribeUserDoc();
      }
    };
  }, [isAuthReady, db, user, auth]); // Pridaná závislosť 'auth' pre použitie auth.signOut()

  // Effect for updating header link visibility
  React.useEffect(() => {
    console.log(`UsersManagementApp: useEffect pre aktualizáciu odkazov hlavičky. User: ${user ? user.uid : 'null'}`); // Zmena logu
    const authLink = document.getElementById('auth-link');
    const profileLink = document.getElementById('profile-link');
    const logoutButton = document.getElementById('logout-button');
    const registerLink = document.getElementById('register-link'); // Opravené, bolo document = document.getElementById

    if (authLink) {
      if (user) {
        authLink.classList.add('hidden');
        profileLink && profileLink.classList.remove('hidden');
        logoutButton && logoutButton.classList.remove('hidden');
        registerLink && registerLink.classList.add('hidden');
        console.log("UsersManagementApp: Používateľ prihlásený. Skryté: Prihlásenie, Registrácia. Zobrazené: Moja zóna, Odhlásenie."); // Zmena logu
      } else {
        authLink.classList.remove('hidden');
        profileLink && profileLink.classList.add('hidden');
        logoutButton && logoutButton.classList.add('hidden');
        registerLink && registerLink.classList.remove('hidden'); 
        console.log("UsersManagementApp: Používateľ odhlásený. Zobrazené: Prihlásenie, Registrácia. Skryté: Moja zóna, Odhlásenie."); // Zmena logu
      }
    }
  }, [user]);

  // Handle logout (needed for the header logout button)
  const handleLogout = React.useCallback(async () => {
    if (!auth) return;
    try {
      setLoading(true);
      await auth.signOut();
      // ZMENA: Používame globálnu funkciu pre centrálnu notifikáciu
      if (typeof window.showGlobalNotification === 'function') {
        window.showGlobalNotification("Úspešne odhlásený.");
      } else {
        console.warn("UsersManagementApp: window.showGlobalNotification nie je definovaná.");
      }
      window.location.href = 'login.html';
      setUser(null); // Explicitne nastaviť user na null
      setUserProfileData(null); // Explicitne nastaviť userProfileData na null
    } catch (e) {
      console.error("UsersManagementApp: Chyba pri odhlásení:", e); // Zmena logu
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

  // Effect for fetching users (runs after DB and userProfileData are ready and user is admin)
  React.useEffect(() => {
    let unsubscribeUsers;

    if (db && userProfileData && userProfileData.role === 'admin' && userProfileData.approved === true) {
      console.log("UsersManagementApp: Prihlásený používateľ je schválený administrátor. Načítavam používateľov."); // Zmena logu
      setLoading(true);
      try {
        unsubscribeUsers = db.collection('users').onSnapshot(snapshot => {
          const fetchedUsers = [];
          snapshot.forEach(doc => {
            fetchedUsers.push({ id: doc.id, ...doc.data() });
          });
          setUsers(fetchedUsers);
          setLoading(false);
          setError('');
          console.log("UsersManagementApp: Používatelia aktualizovaní z onSnapshot."); // Zmena logu
        }, error => {
          console.error("UsersManagementApp: Chyba pri načítaní používateľov z Firestore (onSnapshot error):", error); // Zmena logu
          setError(`Chyba pri načítaní používateľov: ${error.message}`); // Používame error.message
          setLoading(false);
        });
      } catch (e) {
        console.error("UsersManagementApp: Chyba pri nastavovaní onSnapshot pre používateľov (try-catch):", e); // Zmena logu
        setError(`Chyba pri nastavovaní poslucháča pre používateľov: ${e.message}`);
        setLoading(false);
      }
    } else {
        setUsers([]); // Vyčisti používateľov, ak nie je admin
    }

    return () => {
      if (unsubscribeUsers) {
        console.log("UsersManagementApp: Ruším odber onSnapshot pre používateľov."); // Zmena logu
        unsubscribeUsers();
      }
    };
  }, [db, userProfileData]); // Závisí od db a userProfileData (pre rolu admina)

  const openConfirmationModal = (user) => {
    setUserToDelete(user);
    setShowConfirmationModal(true);
  };

  const closeConfirmationModal = () => {
    setUserToDelete(null);
    setShowConfirmationModal(false);
  };

  const openRoleEditModal = (user) => {
    setUserToEditRole(user);
    setShowRoleEditModal(true);
  };

  const closeRoleEditModal = () => {
    setUserToEditRole(null);
    setShowRoleEditModal(false);
  };

  // NOVÁ FUNKCIA: Prepnúť stav schválenia administrátora
  const handleToggleAdminApproval = async (userToToggle) => {
    if (!db || !userProfileData || userProfileData.role !== 'admin') {
      setError("Nemáte oprávnenie na zmenu stavu schválenia.");
      return;
    }
    setLoading(true);
    setError('');
    // ZMENA: Používame globálnu funkciu pre centrálnu notifikáciu
    if (typeof window.showGlobalNotification === 'function') {
        window.showGlobalNotification(''); // Vyčistíme predchádzajúcu správu
    } else {
        console.warn("UsersManagementApp: window.showGlobalNotification nie je definovaná.");
    }
    
    try {
      const newApprovedStatus = !userToToggle.approved; // Prepnúť aktuálny stav
      const userDocRef = db.collection('users').doc(userToToggle.id);
      await userDocRef.update({ approved: newApprovedStatus });

      const actionMessage = newApprovedStatus ? 'schválený' : 'odstránený prístup';
      // ZMENA: Používame globálnu funkciu pre centrálnu notifikáciu
      if (typeof window.showGlobalNotification === 'function') {
        window.showGlobalNotification(`Používateľ ${userToToggle.email} bol ${actionMessage}.`);
      } else {
        console.warn("UsersManagementApp: window.showGlobalNotification nie je definovaná.");
      }

      // Uložiť notifikáciu pre všetkých administrátorov (toto pôjde do top-right pre adminov)
      await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('adminNotifications').add({
        message: `Používateľ ${userToToggle.email} bol ${actionMessage}.`,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        recipientId: 'all_admins',
        read: false
      });
      console.log(`Notifikácia o ${actionMessage} používateľa úspešne uložená do Firestore.`); // Zmena logu

    } catch (e) {
      console.error("UsersManagementApp: Chyba pri zmene stavu schválenia:", e); // Zmena logu
      setError(`Chyba pri zmene stavu schválenia: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRole = async (userId, newRole, newIsApproved) => {
    if (!db || !userProfileData || userProfileData.role !== 'admin') {
      setError("Nemáte oprávnenie na zmenu roly používateľa.");
      return;
    }
    setLoading(true);
    setError('');
    // ZMENA: Používame globálnu funkciu pre centrálnu notifikáciu
    if (typeof window.showGlobalNotification === 'function') {
        window.showGlobalNotification(''); // Vyčistíme predchádzajúcu správu
    } else {
        console.warn("UsersManagementApp: window.showGlobalNotification nie je definovaná.");
    }

    try {
      const userDocRef = db.collection('users').doc(userId);
      
      // Ak sa rola mení na 'user', approved sa nastaví na true.
      // Ak sa rola mení na 'admin', approved sa nastaví na false.
      const approvedStatus = (newRole === 'user') ? true : false; 

      await userDocRef.update({ role: newRole, approved: approvedStatus });
      // ZMENA: Používame globálnu funkciu pre centrálnu notifikáciu
      if (typeof window.showGlobalNotification === 'function') {
        window.showGlobalNotification(`Rola používateľa ${userToEditRole.email} bola zmenená na ${newRole}.`);
      } else {
        console.warn("UsersManagementApp: window.showGlobalNotification nie je definovaná.");
      }
      closeRoleEditModal();

      // Ak sa používateľovi zmenila rola na admin a nie je schválený, odhlásime ho
      if (user && user.uid === userId && newRole === 'admin' && approvedStatus === false) {
          console.log("UsersManagementApp: Rola používateľa zmenená na neschváleného admina. Odhlasujem."); // Zmena logu
          await auth.signOut();
          window.location.href = 'login.html';
          setUser(null); // Explicitne nastaviť user na null
          setUserProfileData(null); // Explicitne nastaviť userProfileData na null
          return; // Zastav ďalšie spracovanie
      }

      // Uložiť notifikáciu pre všetkých administrátorov (toto pôjde do top-right pre adminov)
      await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('adminNotifications').add({
        message: `Rola používateľa ${userToEditRole.email} bola zmenená na ${newRole}. Schválený: ${approvedStatus ? 'Áno' : 'Nie'}.`,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        recipientId: 'all_admins',
        read: false
      });
      console.log("Notifikácia o zmene roly používateľa úspešne uložená do Firestore."); // Zmena logu

    } catch (e) {
      console.error("UsersManagementApp: Chyba pri ukladaní roly:", e); // Zmena logu
      setError(`Chyba pri ukladaní roly: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!db || !userToDelete || !userProfileData || userProfileData.role !== 'admin') {
      setError("Nemáte oprávnenie na zmazanie používateľa.");
      return;
    }
    setLoading(true);
    setError('');
    // ZMENA: Používame globálnu funkciu pre centrálnu notifikáciu
    if (typeof window.showGlobalNotification === 'function') {
        window.showGlobalNotification(''); // Vyčistíme predchádzajúcu správu
    } else {
        console.warn("UsersManagementApp: window.showGlobalNotification nie je definovaná.");
    }

    try {
      // 1. Zmazať používateľa z Firestore
      await db.collection('users').doc(userToDelete.id).delete();
      console.log(`Používateľ ${userToDelete.email} zmazaný z Firestore.`); // Zmena logu

      // 2. Aktualizácia notifikačnej správy a presmerovanie na Firebase Console
      // ZMENA: Používame globálnu funkciu pre centrálnu notifikáciu
      if (typeof window.showGlobalNotification === 'function') {
        window.showGlobalNotification(`Používateľ ${userToDelete.email} bol zmazaný z databázy. Prosím, zmažte ho aj manuálne vo Firebase Console.`);
      } else {
        console.warn("UsersManagementApp: window.showGlobalNotification nie je definovaná.");
      }
      closeConfirmationModal();

      // Otvoriť novú záložku s Firebase Console
      window.open('https://console.firebase.google.com/project/prihlasovanie-4f3f3/authentication/users', '_blank');

      // Uložiť notifikáciu pre všetkých administrátorov (toto pôjde do top-right pre adminov)
      await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('adminNotifications').add({
        message: `Používateľ ${userToDelete.email} bol zmazaný z databázy. Je potrebné ho manuálne zmazať aj z autentifikácie.`,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        recipientId: 'all_admins',
        read: false
      });
      console.log("Notifikácia o zmazaní používateľa úspešne uložená do Firestore."); // Zmena logu

    } catch (e) {
      console.error("UsersManagementApp: Chyba pri mazaní používateľa (Firestore):", e); // Zmena logu
      setError(`Chyba pri mazaní používateľa: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Display loading state
  if (!isAuthReady || user === undefined || (user && !userProfileData) || loading) {
    if (isAuthReady && user === null) {
        console.log("UsersManagementApp: Auth je ready a používateľ je null, presmerovávam na login.html"); // Zmena logu
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

  // If user is not admin, redirect
  if (userProfileData && userProfileData.role !== 'admin') {
    console.log("UsersManagementApp: Používateľ nie je admin a snaží sa pristupovať k správe používateľov, presmerovávam."); // Zmena logu
    window.location.href = 'logged-in-my-data.html'; // Presmerovanie na logged-in-my-data.html
    return null;
  }

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
    // ZMENA: Odstránené vykresľovanie TopRightNotificationModal z UsersManagementApp
    // React.createElement(TopRightNotificationModal, { ... }), // TOTO BOLO ODSTRÁNENÉ
    React.createElement(ConfirmationModal, {
        show: showConfirmationModal,
        message: `Naozaj chcete zmazať používateľa ${userToDelete ? userToDelete.email : ''}?`,
        onConfirm: handleDeleteUser,
        onCancel: closeConfirmationModal,
        loading: loading,
    }),
    React.createElement(RoleEditModal, {
        show: showRoleEditModal,
        user: userToEditRole,
        onClose: closeRoleEditModal,
        onSave: handleSaveRole,
        loading: loading,
    }),
    React.createElement(
      'div',
      { className: 'w-full px-4 mt-20 mb-10' }, // ZMENA: Removed max-w-4xl, added px-4
      error && React.createElement(
        'div',
        { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap', role: 'alert' },
        error
      ),
      React.createElement(
        'div',
        { className: 'bg-white p-8 rounded-lg shadow-xl w-full' },
        React.createElement('h1', { className: 'text-3xl font-bold text-center text-gray-800 mb-6' },
          'Správa používateľov'
        ),
        users.length === 0 && !loading ? (
            React.createElement('p', { className: 'text-center text-gray-600' }, 'Žiadni používatelia na zobrazenie.')
        ) : (
            React.createElement(
                'div',
                { className: 'overflow-x-auto' }, // Toto zabezpečí posuvník, ak je obsah príliš široký
                React.createElement(
                    'table',
                    { className: 'min-w-full bg-white rounded-lg shadow-md' }, // ZMENA: min-w-full zabezpečí, že tabuľka bude vždy minimálne 100% šírky rodiča
                    React.createElement(
                        'thead',
                        null,
                        React.createElement(
                            'tr',
                            { className: 'w-full bg-gray-200 text-gray-600 uppercase text-sm leading-normal' },
                            React.createElement('th', { scope: 'col', className: 'py-3 px-6 text-left w-2/6' }, 'E-mail'), // ZMENA: Pridaná šírka
                            React.createElement('th', { scope: 'col', className: 'py-3 px-6 text-left w-1/6' }, 'Meno'), // ZMENA: Pridaná šírka
                            React.createElement('th', { scope: 'col', className: 'py-3 px-6 text-left w-1/6' }, 'Rola'), // ZMENA: Pridaná šírka
                            React.createElement('th', { scope: 'col', className: 'py-3 px-6 text-left w-1/6' }, 'Schválený'), // ZMENA: Pridaná šírka
                            React.createElement('th', { scope: 'col', className: 'py-3 px-6 text-center min-w-[280px]' }, 'Akcie') // ZMENA: Pridaná min-w na th
                        )
                    ),
                    React.createElement(
                        'tbody',
                        { className: 'text-gray-600 text-sm font-light' },
                        users.map((u) => (
                            React.createElement(
                                'tr',
                                { key: u.id, className: 'border-b border-gray-200 hover:bg-gray-100' },
                                React.createElement('td', { className: 'py-3 px-6 text-left whitespace-nowrap' }, u.email),
                                React.createElement('td', { className: 'py-3 px-6 text-left whitespace-nowrap' }, `${u.firstName || ''} ${u.lastName || ''}`),
                                React.createElement('td', { className: 'py-3 px-6 text-left' }, u.role),
                                React.createElement('td', { className: 'py-3 px-6 text-left' }, u.approved ? 'Áno' : 'Nie'),
                                React.createElement(
                                    'td',
                                    { className: 'py-3 px-6 text-center' },
                                    React.createElement(
                                        'div',
                                        { className: 'flex item-center justify-center space-x-2' }, // ZMENA: Odstránená min-w odtiaľto
                                        // Podmienené vykresľovanie tlačidiel "Upraviť rolu" a "Zmazať"
                                        user && u.id !== user.uid && React.createElement(
                                            React.Fragment,
                                            null,
                                            React.createElement(
                                                'button',
                                                {
                                                  onClick: () => openRoleEditModal(u),
                                                  className: 'bg-green-500 hover:bg-green-600 text-white py-1 px-3 rounded-lg text-sm transition-colors duration-200',
                                                  disabled: loading,
                                                },
                                                'Upraviť rolu'
                                            ),
                                            // NOVINKA: Tlačidlo na schválenie/odobratie prístupu pre adminov
                                            u.role === 'admin' && React.createElement(
                                                'button',
                                                {
                                                  onClick: () => handleToggleAdminApproval(u),
                                                  className: `${u.approved ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-blue-500 hover:bg-blue-600'} text-white py-1 px-3 rounded-lg text-sm transition-colors duration-200`,
                                                  disabled: loading,
                                                },
                                                u.approved ? 'Odobrať prístup' : 'Schváliť'
                                            ),
                                            React.createElement(
                                                'button',
                                                {
                                                  onClick: () => openConfirmationModal(u),
                                                  className: 'bg-red-500 hover:bg-red-600 text-white py-1 px-3 rounded-lg text-sm transition-colors duration-200',
                                                  disabled: loading,
                                                },
                                                'Zmazať'
                                            )
                                        )
                                    )
                                )
                            )
                        ))
                    )
                )
            )
        )
      )
    )
  );
}

// Explicitne sprístupniť komponent globálne
window.UsersManagementApp = UsersManagementApp;
