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
// Tieto konštanty sú teraz definované v <head> príslušného HTML súboru
// const appId = '1:26454452024:web:6954b4f40f87a3a1eb43cd';
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
        show ? 'translate-x-0' : 'translate-x-full'
      }`,
      style: { pointerEvents: 'none', maxWidth: 'calc(100% - 32px)' }
    },
    React.createElement(
      'div',
      {
        className: 'bg-[#3A8D41] text-white px-6 py-3 rounded-lg shadow-lg max-w-xs w-full text-center',
        style: { pointerEvents: 'auto' }
      },
      React.createElement('p', { className: 'font-semibold' }, message)
    )
  );
}

// Komponent pre pop-up notifikácie uprostred obrazovky
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
        setTimeout(onClose, 500);
      }, 5000);
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
        style: { pointerEvents: 'auto' }
      },
      React.createElement('p', { className: 'font-semibold text-gray-800 text-lg' }, message)
    )
  );
}

// Hlavný komponent pre globálnu hlavičku a notifikácie
function GlobalHeaderAndNotifications() {
  const [currentTopRightMessage, setCurrentTopRightMessage] = React.useState('');
  const [currentCenterMessage, setCurrentCenterMessage] = React.useState('');
  const [displayTopRightNotificationsEnabled, setDisplayTopRightNotificationsEnabled] = React.useState(true);
  const [lastNotificationTimestamp, setLastNotificationTimestamp] = React.useState(0);

  const [categoriesExist, setCategoriesExist] = React.useState(false);
  const [registrationStartDate, setRegistrationStartDate] = React.useState(null);
  const [registrationEndDate, setRegistrationEndDate] = React.useState(null);
  const [settingsAndCategoriesLoaded, setSettingsAndCategoriesLoaded] = React.useState(false);

  const [loadingHeader, setLoadingHeader] = React.useState(false); // Loading stav pre hlavičku (napr. pri odhlásení)

  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'; 

  // Globálna funkcia na spúšťanie centrálnych notifikácií z iných komponentov
  React.useEffect(() => {
    window.showGlobalNotification = (message) => {
      setCurrentCenterMessage(message);
    };
    return () => {
      if (window.showGlobalNotification === setCurrentCenterMessage) {
        window.showGlobalNotification = (message) => {
          console.warn("Global notification function called after unmount:", message);
        };
      }
    };
  }, []);

  // Effect pre načítanie nastavení (kategórie, dátumy registrácie)
  React.useEffect(() => {
    let unsubscribeCategories;
    let unsubscribeRegistrationSettings;
    let categoriesDataLoaded = false;
    let registrationDataLoaded = false;

    const checkAllLoaded = () => {
      if (categoriesDataLoaded && registrationDataLoaded) {
        setSettingsAndCategoriesLoaded(true);
        console.log("Header: Všetky nastavenia a kategórie načítané.");
      }
    };

    // Čakáme, kým bude db inštancia dostupná z authentication.js
    if (window.db) {
      // Načítanie kategórií
      const categoriesDocRef = window.db.collection('settings').doc('categories');
      unsubscribeCategories = categoriesDocRef.onSnapshot(docSnapshot => {
        if (docSnapshot.exists && Object.keys(docSnapshot.data()).length > 0) {
          setCategoriesExist(true);
          console.log("Header: Kategórie existujú.");
        } else {
          setCategoriesExist(false);
          console.log("Header: Žiadne kategórie neexistujú.");
        }
        categoriesDataLoaded = true;
        checkAllLoaded();
      }, error => {
        console.error("Header: Chyba pri načítaní kategórií:", error);
        setCategoriesExist(false);
        categoriesDataLoaded = true;
        checkAllLoaded();
      });

      // Načítanie dátumov registrácie
      const registrationDocRef = window.db.collection('settings').doc('registration');
      unsubscribeRegistrationSettings = registrationDocRef.onSnapshot(docSnapshot => {
        if (docSnapshot.exists) {
          const data = docSnapshot.data();
          setRegistrationStartDate(data.registrationStartDate ? data.registrationStartDate.toDate() : null);
          setRegistrationEndDate(data.registrationEndDate ? data.registrationEndDate.toDate() : null);
          console.log("Header: Dátumy registrácie načítané.");
        } else {
          setRegistrationStartDate(null);
          setRegistrationEndDate(null);
          console.log("Header: Dátumy registrácie neexistujú.");
        }
        registrationDataLoaded = true;
        checkAllLoaded();
      }, error => {
        console.error("Header: Chyba pri načítaní dátumov registrácie:", error);
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
  }, [window.db]); // Závisí od globálnej db inštancie

  // Effect pre načítanie nastavení notifikácií a počúvanie nových notifikácií
  React.useEffect(() => {
    let unsubscribeNotifications;

    // Čakáme, kým bude globálna autentifikácia pripravená a db inštancia dostupná
    if (window.isGlobalAuthReady && window.db && window.auth && window.auth.currentUser) {
      const user = window.auth.currentUser;
      const userProfile = window.globalUserProfileData; // Získame profil z globálneho stavu

      let topRightNotificationsEnabled = true; // Predvolene povolené

      if (userProfile) {
        if (userProfile.role === 'user') {
            console.log("Header: Používateľ je typu 'user', top-right notifikácie budú vypnuté.");
            topRightNotificationsEnabled = false;
        } else {
            topRightNotificationsEnabled = userProfile.displayNotifications !== undefined ? userProfile.displayNotifications : true;
            console.log(`Header: Používateľ je typu '${userProfile.role}', displayTopRightNotificationsEnabled nastavené na:`, topRightNotificationsEnabled);
        }
      }
      setDisplayTopRightNotificationsEnabled(topRightNotificationsEnabled);

      // Načítaj posledný timestamp zobrazenej notifikácie z localStorage
      const storedLastTimestamp = localStorage.getItem(`lastNotificationTimestamp_${user.uid}`);
      if (storedLastTimestamp) {
          setLastNotificationTimestamp(parseInt(storedLastTimestamp, 10));
          console.log("Header: Načítaný lastNotificationTimestamp z localStorage:", storedLastTimestamp);
      } else {
          console.log("Header: lastNotificationTimestamp v localStorage nenájdený, inicializujem na 0.");
      }

      if (topRightNotificationsEnabled) { // Len ak sú notifikácie povolené
        unsubscribeNotifications = window.db.collection('artifacts').doc(appId).collection('public').doc('data').collection('adminNotifications')
          .where('recipientId', 'in', [user.uid, 'all_admins'])
          .where('read', '==', false)
          .orderBy('timestamp', 'desc')
          .limit(1)
          .onSnapshot(snapshot => {
            console.log("Header: onSnapshot pre adminNotifications spustený.");
            if (!snapshot.empty) {
              const latestUnreadNotification = snapshot.docs[0];
              const notificationData = latestUnreadNotification.data();
              const notificationTimestamp = notificationData.timestamp ? notificationData.timestamp.toDate().getTime() : 0;
              console.log("Header: Najnovšia neprečítaná notifikácia:", notificationData, "Timestamp:", notificationTimestamp, "Last shown:", lastNotificationTimestamp);

              if (notificationTimestamp > lastNotificationTimestamp) {
                const isDeletedForCurrentUser = notificationData.deletedFor && notificationData.deletedFor.includes(user.uid);
                if (!isDeletedForCurrentUser) {
                  setCurrentTopRightMessage(notificationData.message);
                  setLastNotificationTimestamp(notificationTimestamp);
                  localStorage.setItem(`lastNotificationTimestamp_${user.uid}`, notificationTimestamp.toString());
                  console.log("Header: Zobrazujem novú top-right notifikáciu a aktualizujem timestamp.");

                  // Označ notifikáciu ako prečítanú
                  window.db.collection('artifacts').doc(appId).collection('public').doc('data').collection('adminNotifications').doc(latestUnreadNotification.id).update({
                    read: true
                  }).catch(e => console.error("Header: Chyba pri označovaní notifikácie ako prečítanej:", e));
                } else {
                  console.log("Header: Notifikácia je označená ako vymazaná pre aktuálneho používateľa, nezobrazujem.");
                }
              } else {
                console.log("Header: Notifikácia nie je novšia, nezobrazujem pop-up.");
              }
            } else {
              console.log("Header: Žiadne neprečítané top-right notifikácie na zobrazenie.");
            }
          }, error => {
            console.error("Header: Chyba pri načítaní notifikácií pre pop-up:", error);
          });
      }
    } else {
        // Ak nie je prihlásený, alebo chýbajú dáta, vypni notifikácie
        setDisplayTopRightNotificationsEnabled(false);
        setCurrentTopRightMessage('');
    }

    return () => {
      if (unsubscribeNotifications) {
        console.log("Header: Ruším odber onSnapshot pre notifikácie.");
        unsubscribeNotifications();
      }
    };
  }, [window.isGlobalAuthReady, window.db, window.auth, window.globalUserProfileData, lastNotificationTimestamp, displayTopRightNotificationsEnabled]);


  // Funkcia na aktualizáciu viditeľnosti odkazov v menu
  const updateHeaderLinksVisibility = React.useCallback(() => {
    const authLink = document.getElementById('auth-link');
    const profileLink = document.getElementById('profile-link');
    const logoutButton = document.getElementById('logout-button');
    const registerLink = document.getElementById('register-link');

    const user = window.auth ? window.auth.currentUser : null;
    const userProfileData = window.globalUserProfileData;

    // Logika pre "Registrácia na turnaj"
    if (registerLink && settingsAndCategoriesLoaded) {
      const now = new Date();
      const isRegistrationPeriod = (registrationStartDate && now >= registrationStartDate) &&
                                   (registrationEndDate ? now <= registrationEndDate : true);
      const isBeforeRegistration = (registrationStartDate && now < registrationStartDate);

      if (user === null && categoriesExist && isRegistrationPeriod) {
          registerLink.classList.remove('hidden');
          console.log("Header: 'Registrácia na turnaj' je zobrazená.");
      } else if (user === null && categoriesExist && isBeforeRegistration) {
          registerLink.classList.add('hidden');
          console.log("Header: 'Registrácia na turnaj' je skrytá, pretože registrácia ešte nezačala.");
      } else {
          registerLink.classList.add('hidden');
          console.log("Header: 'Registrácia na turnaj' je skrytá.");
      }
    } else if (registerLink && !settingsAndCategoriesLoaded) {
        registerLink.classList.add('hidden');
        console.log("Header: Čakám na načítanie nastavení a kategórií, 'Registrácia na turnaj' je skrytá.");
    }


    // Logika pre prihlásenie/profil/odhlásenie
    if (authLink) {
      if (user && userProfileData) { // Ak je používateľ prihlásený a máme jeho profil
        authLink.classList.add('hidden');
        profileLink && profileLink.classList.remove('hidden');
        logoutButton && logoutButton.classList.remove('hidden');
        console.log("Header: Používateľ prihlásený. Skryté: Prihlásenie. Zobrazené: Moja zóna, Odhlásenie.");
      } else { // Ak používateľ nie je prihlásený alebo ešte nemáme profil
        authLink.classList.remove('hidden');
        profileLink && profileLink.classList.add('hidden');
        logoutButton && logoutButton.classList.add('hidden');
        console.log("Header: Používateľ odhlásený. Zobrazené: Prihlásenie. Skryté: Moja zóna, Odhlásenie.");
      }
    }
  }, [window.isGlobalAuthReady, window.auth, window.globalUserProfileData, categoriesExist, registrationStartDate, registrationEndDate, settingsAndCategoriesLoaded]);


  // Effect pre volanie aktualizácie odkazov pri zmene globálnych stavov
  React.useEffect(() => {
    updateHeaderLinksVisibility();
  }, [updateHeaderLinksVisibility]);


  // Funkcia na odhlásenie používateľa
  const handleLogout = React.useCallback(async () => {
    if (!window.auth) return;
    try {
      setLoadingHeader(true);
      await window.auth.signOut();
      if (typeof window.showGlobalNotification === 'function') {
        window.showGlobalNotification("Úspešne odhlásený.");
      }
      window.location.href = 'login.html';
    } catch (e) {
      console.error("Header: Chyba pri odhlásení:", e);
      setCurrentCenterMessage(`Chyba pri odhlásení: ${e.message}`);
    } finally {
      setLoadingHeader(false);
    }
  }, []);

  // Pripojenie event listenera na tlačidlo odhlásenia
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
      displayNotificationsEnabled: displayTopRightNotificationsEnabled
    }),
    React.createElement(CenterConfirmationModal, {
      message: currentCenterMessage,
      onClose: () => setCurrentCenterMessage('')
    })
  );
}

// Render GlobalHeaderAndNotifications do špecifického DOM elementu
let headerRoot = document.getElementById('header-notification-root');
if (!headerRoot) {
  headerRoot = document.createElement('div');
  headerRoot.id = 'header-notification-root';
  document.body.appendChild(headerRoot);
  console.log("Header: Vytvoril som a pridal 'header-notification-root' div do tela dokumentu.");
} else {
  console.log("Header: 'header-notification-root' div už existuje.");
}

try {
  ReactDOM.render(
    React.createElement(GlobalHeaderAndNotifications),
    headerRoot
  );
  console.log("Header: GlobalHeaderAndNotifications úspešne vykreslený.");
} catch (e) {
  console.error("Header: Chyba pri vykresľovaní GlobalHeaderAndNotifications:", e);
}
