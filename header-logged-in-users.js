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
// Tieto konštanty by mali byť definované v <head> každej HTML stránky, ktorá používa tento skript.
// Príklad:
// <script>
//     const appId = '1:26454452024:web:6954b4f90f87a3a1eb43cd';
//     const firebaseConfig = {
//       apiKey: "AIzaSyDj_bSTkjrquu1nyIVYW7YLbyBl1pD6YYo",
//       authDomain: "prihlasovanie-4f3f3.firebaseapp.com",
//       projectId: "prihlasovanie-4f3f3",
//       storageBucket: "prihlasovanie-4f3f3.firebasestorage.app",
//       messagingSenderId: "26454452024",
//       appId: "1:26454452024:web:6954b4f90f87a3a1eb43cd"
//     };
//     const initialAuthToken = null;
// </script>

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

// Komponent pre notifikácie v pravom hornom rohu
function TopRightNotificationModal({ message, onClose, displayNotificationsEnabled }) {
  const [show, setShow] = React.useState(false);
  const timerRef = React.useRef(null);

  React.useEffect(() => {
    console.log("TopRightNotificationModal (header.js): useEffect triggered. Message:", message, "Display Enabled:", displayNotificationsEnabled); 

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

  console.log("TopRightNotificationModal (header.js): render. Current show state:", show, "Message:", message, "Display Enabled:", displayNotificationsEnabled); 

  if ((!show && !message) || !displayNotificationsEnabled) {
    console.log("TopRightNotificationModal (header.js): Returning null (not rendering the UI)."); 
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

// Komponent pre pop-up notifikácie uprostred obrazovky
function CenterConfirmationModal({ message, onClose, type = 'info' }) {
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
  }, [message, onClose, type]); // Pridaný type do závislostí

  if (!show && !message) {
    console.log("CenterConfirmationModal (header.js): Returning null (not rendering the UI).");
    return null;
  }

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
      className: `fixed inset-0 flex items-center justify-center z-50 transition-opacity duration-500 ease-out ${
        show ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`
    },
    React.createElement(
      'div',
      {
        className: `${bgColorClass} text-white p-6 rounded-lg shadow-xl max-w-sm w-full text-center transform transition-transform duration-500 ease-out ` +
                   `${show ? 'scale-100' : 'scale-90'}`,
        style: { pointerEvents: 'auto' } // Umožni kliknutie na modal
      },
      React.createElement('p', { className: 'font-semibold text-lg' }, message)
    )
  );
}


// ConfirmationModal Component (konvertovaný na React.createElement)
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

// RoleEditModal Component (konvertovaný na React.createElement)
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


// Globálny komponent pre spracovanie notifikácií a základnej autentifikácie
function GlobalNotificationHandler() {
  const [app, setApp] = React.useState(null);
  const [auth, setAuth] = React.useState(null);
  const [db, setDb] = React.useState(null);
  const [user, setUser] = React.useState(undefined); // Firebase User object from onAuthStateChanged
  const [userProfileData, setUserProfileData] = React.useState(null); 
  const [isAuthReady, setIsAuthReady] = React.useState(false); // Nový stav pre pripravenosť autentifikácie
  
  // Stavy pre rôzne typy notifikácií
  const [currentTopRightMessage, setCurrentTopRightMessage] = React.useState('');
  const [currentCenterMessage, setCurrentCenterMessage] = React.useState({ message: '', type: 'info' }); // Objekt s message a type

  const [displayTopRightNotificationsEnabled, setDisplayTopRightNotificationsEnabled] = React.useState(true); // Získané z userProfileData, pre top-right
  const [lastNotificationTimestamp, setLastNotificationTimestamp] = React.useState(0); // Sledovanie poslednej zobrazenej notifikácie

  // Globálna funkcia na spúšťanie notifikácií z iných komponentov
  React.useEffect(() => {
    window.showGlobalNotification = (message, type = 'info') => {
      setCurrentCenterMessage({ message, type }); // Nastaví správu a typ pre centrálnu notifikáciu
    };
    return () => {
      if (window.showGlobalNotification === setCurrentCenterMessage) {
        window.showGlobalNotification = (message) => {
          console.warn("Global notification function called after unmount:", message);
        };
      }
    };
  }, []);

  // Effect pre inicializáciu Firebase a nastavenie Auth Listenera (spustí sa len raz)
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
      if (firebase.apps.length === 0) {
        console.log("GNH: Inicializujem novú Firebase aplikáciu.");
        firebaseApp = firebase.initializeApp(firebaseConfig); // Používame globálne firebaseConfig
      } else {
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

  // Effect pre načítanie userProfileData (vrátane displayNotifications)
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
            setDisplayTopRightNotificationsEnabled(true); 
          }
        }, error => {
          console.error("GNH: Chyba pri načítaní používateľských dát z Firestore:", error);
          setDisplayTopRightNotificationsEnabled(true);
        });
      } catch (e) {
        console.error("GNH: Chyba pri nastavovaní onSnapshot pre používateľské dáta:", e);
        setDisplayTopRightNotificationsEnabled(true);
      }
    } else if (isAuthReady && user === null) {
      console.log("GNH: Používateľ nie je prihlásený, nastavujem displayTopRightNotificationsEnabled na false.");
      setDisplayTopRightNotificationsEnabled(false);
      setCurrentTopRightMessage('');
      setCurrentCenterMessage({ message: '', type: 'info' });
      setUserProfileData(null);
    }


    return () => {
      if (unsubscribeUserDoc) {
        console.log("GNH: Ruším odber onSnapshot pre používateľský dokument.");
        unsubscribeUserDoc();
      }
    };
  }, [isAuthReady, db, user]);

  // Effect pre počúvanie nových notifikácií (len pre top-right notifikácie)
  React.useEffect(() => {
    let unsubscribeNotifications;
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'; // Používame globálnu premennú __app_id
    console.log("GNH: Spúšťam useEffect pre top-right notifikácie. db:", !!db, "user:", !!user, "userProfileData:", !!userProfileData, "displayTopRightNotificationsEnabled:", displayTopRightNotificationsEnabled);

    if (db && user && userProfileData && displayTopRightNotificationsEnabled) {
      console.log("GNH: Podmienky pre načítanie top-right notifikácií splnené.");
      const storedLastTimestamp = localStorage.getItem(`lastNotificationTimestamp_${user.uid}`);
      if (storedLastTimestamp) {
          setLastNotificationTimestamp(parseInt(storedLastTimestamp, 10));
          console.log("GNH: Načítaný lastNotificationTimestamp z localStorage:", storedLastTimestamp);
      } else {
          console.log("GNH: lastNotificationTimestamp v localStorage nenájdený, inicializujem na 0.");
      }

      unsubscribeNotifications = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('adminNotifications')
        .where('recipientId', 'in', [user.uid, 'all_admins'])
        .where('read', '==', false)
        .orderBy('timestamp', 'desc')
        .limit(1)
        .onSnapshot(snapshot => {
          console.log("GNH: onSnapshot pre adminNotifications spustený.");
          if (!snapshot.empty) {
            const latestUnreadNotification = snapshot.docs[0];
            const notificationData = latestUnreadNotification.data();
            const notificationTimestamp = notificationData.timestamp ? notificationData.timestamp.toDate().getTime() : 0;
            console.log("GNH: Najnovšia neprečítaná notifikácia:", notificationData, "Timestamp:", notificationTimestamp, "Last shown:", lastNotificationTimestamp);

            if (notificationTimestamp > lastNotificationTimestamp && displayTopRightNotificationsEnabled) {
              const isDeletedForCurrentUser = notificationData.deletedFor && notificationData.deletedFor.includes(user.uid);
              if (!isDeletedForCurrentUser) {
                setCurrentTopRightMessage(notificationData.message);
                setLastNotificationTimestamp(notificationTimestamp);
                localStorage.setItem(`lastNotificationTimestamp_${user.uid}`, notificationTimestamp.toString());
                console.log("GNH: Zobrazujem novú top-right notifikáciu a aktualizujem timestamp.");

                if (displayTopRightNotificationsEnabled) {
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
    } else if (userProfileData && displayTopRightNotificationsEnabled === false) {
        console.log("GNH: Top-right notifikácie sú vypnuté v profile používateľa. Zrušujem odber a čistím správu.");
        if (unsubscribeNotifications) {
            unsubscribeNotifications();
            unsubscribeNotifications = null;
        }
        setCurrentTopRightMessage('');
    } else {
        console.log("GNH: Podmienky pre načítanie top-right notifikácií nesplnené (napr. nie je prihlásený alebo chýbajú dáta profilu).");
    }


    return () => {
      if (unsubscribeNotifications) {
        console.log("GNH: Ruším odber onSnapshot pre notifikácie.");
        unsubscribeNotifications();
      }
    };
  }, [db, user, userProfileData, lastNotificationTimestamp, displayTopRightNotificationsEnabled]);

  return React.createElement(
    React.Fragment,
    null,
    React.createElement(TopRightNotificationModal, {
      message: currentTopRightMessage,
      onClose: () => setCurrentTopRightMessage(''),
      displayNotificationsEnabled: displayTopRightNotificationsEnabled
    }),
    React.createElement(CenterConfirmationModal, {
      message: currentCenterMessage.message,
      onClose: () => setCurrentCenterMessage({ message: '', type: 'info' }),
      type: currentCenterMessage.type
    })
  );
}

// Vykreslenie GlobalNotificationHandler do špecifického DOM elementu
let notificationRoot = document.getElementById('global-notification-root');
if (!notificationRoot) {
  notificationRoot = document.createElement('div');
  notificationRoot.id = 'global-notification-root';
  document.body.appendChild(notificationRoot);
  console.log("GNH: Vytvoril som a pridal 'global-notification-root' div do tela dokumentu.");
} else {
  console.log("GNH: 'global-notification-root' div už existuje.");
}

try {
  ReactDOM.render(
    React.createElement(GlobalNotificationHandler),
    notificationRoot
  );
  console.log("GNH: GlobalNotificationHandler úspešne vykreslený.");
} catch (e) {
  console.error("GNH: Chyba pri vykresľovaní GlobalNotificationHandler:", e);
}


// ODSTRÁNENÝ KÓD: Pôvodná definícia a vykresľovanie UsersManagementApp z header.js
// Tento komponent patrí výhradne do logged-in-users.js
// function UsersManagementApp() { ... }
// window.UsersManagementApp = UsersManagementApp; // Toto už nie je potrebné v header.js

// ODSTRÁNENÝ KÓD: Podmienené vykresľovanie UsersManagementApp z header.js
// Akýkoľvek komponent, ktorý patrí na konkrétnu stránku, by sa mal vykresľovať
// priamo v jej hlavnom JavaScript súbore (napr. logged-in-users.js).
// if (!window.location.href.includes('logged-in-users.html')) { ... }
