// header.js
// Ochrana proti zobrazeniu stránky v iframe
if (window.self !== window.top) {
    document.body.innerHTML = '';
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';
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
        font-family: 'Inter', sans-serif;
    `;
    document.body.appendChild(errorMessageDiv);
    throw new Error('Page cannot be displayed in an iframe.');
}

// Dôležité: Všetky globálne premenné a funkcie sú teraz definované v `authentication.js`
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec";

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

// Komponent pre potvrdzovacie modálne okná v strede obrazovky
function CenterConfirmationModal({ message, onClose }) {
  // ... existujúci kód CenterConfirmationModal ...
  const [show, setShow] = React.useState(false);
  const handleClose = () => {
      setShow(false);
      onClose(); // Call the parent's onClose handler
  };

  React.useEffect(() => {
      if (message) {
          setShow(true);
      } else {
          setShow(false);
      }
  }, [message]);

  if (!show) {
      return null;
  }

  return React.createElement(
      'div',
      { className: 'modal' },
      React.createElement(
          'div',
          { className: 'modal-content' },
          React.createElement('p', { className: 'text-xl font-bold' }, message),
          React.createElement(
              'button',
              {
                  onClick: handleClose,
                  className: 'mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors duration-200'
              },
              'Zatvoriť'
          )
      )
  );
}

// Hlavný komponent, ktorý spravuje stav a notifikácie
function GlobalHeaderAndNotifications() {
    const [isAuthReady, setIsAuthReady] = React.useState(window.isGlobalAuthReady);
    const [user, setUser] = React.useState(window.globalUserProfileData);
    const [currentTopRightMessage, setCurrentTopRightMessage] = React.useState('');
    const [currentCenterMessage, setCurrentCenterMessage] = React.useState('');
    const [displayTopRightNotificationsEnabled, setDisplayTopRightNotificationsEnabled] = React.useState(true);

    const checkAndShowLinks = React.useCallback((currentUser) => {
        const registerLink = document.getElementById('register-link');
        const profileLink = document.getElementById('profile-link');
        const authLink = document.getElementById('auth-link');
        const logoutButton = document.getElementById('logout-button');
        const adminLinks = document.querySelectorAll('.admin-link');

        if (registerLink) { registerLink.classList.remove('hidden'); }
        if (currentUser) {
            if (profileLink) { profileLink.classList.remove('hidden'); }
            if (authLink) { authLink.classList.add('hidden'); }
            if (logoutButton) { logoutButton.classList.remove('hidden'); }
            // Skryť registračné tlačidlo, ak je používateľ prihlásený, ak je to potrebné
            if (registerLink) { registerLink.classList.add('hidden'); }

            // Zobraziť admin linky len pre adminov
            adminLinks.forEach(link => {
                if (currentUser.role === 'admin') {
                    link.classList.remove('hidden');
                } else {
                    link.classList.add('hidden');
                }
            });
        } else {
            if (profileLink) { profileLink.classList.add('hidden'); }
            if (authLink) { authLink.classList.remove('hidden'); }
            if (logoutButton) { logoutButton.classList.add('hidden'); }
            adminLinks.forEach(link => link.classList.add('hidden'));
        }
    }, []);

    const handleLogout = React.useCallback(async () => {
        if (!window.auth) {
            console.error("Firebase Auth nie je inicializovaný.");
            return;
        }
        try {
            await firebase.signOut(window.auth);
            console.log("Používateľ bol úspešne odhlásený.");
            window.location.href = 'index.html';
        } catch (error) {
            console.error("Chyba pri odhlasovaní:", error);
        }
    }, []);

    React.useEffect(() => {
        // Zabezpečíme, že globálny listener je nastavený iba raz v authentication.js
        const handleAuthChange = (user) => {
            console.log("GlobalHeaderAndNotifications: Prijal som zmenu stavu autentifikácie.");
            setUser(window.globalUserProfileData);
            setIsAuthReady(window.isGlobalAuthReady);
            checkAndShowLinks(window.globalUserProfileData);
        };
        // Keďže `onAuthStateChanged` je spustený v `authentication.js`,
        // tento komponent už len reaguje na zmeny globálnych premenných.
        const interval = setInterval(() => {
            if (window.isGlobalAuthReady) {
                // Toto zabezpečí, že sa komponent aktualizuje, keď sa zmenia globálne premenné.
                setUser(window.globalUserProfileData);
                setIsAuthReady(true);
                checkAndShowLinks(window.globalUserProfileData);
                clearInterval(interval);
            }
        }, 100);

        // Nastavíme globálne funkcie pre notifikácie
        // Toto prepíše placeholder funkciu a nastaví skutočný handler
        window.showTopRightNotification = (message) => {
            setCurrentTopRightMessage(message);
        };
        window.showCenterConfirmation = (message) => {
            setCurrentCenterMessage(message);
        };

        const logoutButton = document.getElementById('logout-button');
        if (logoutButton) {
            logoutButton.addEventListener('click', handleLogout);
        }

        return () => {
            if (logoutButton) {
                logoutButton.removeEventListener('click', handleLogout);
            }
        };
    }, [checkAndShowLinks, handleLogout]);

    React.useEffect(() => {
        checkAndShowLinks(user);
    }, [user, checkAndShowLinks]);

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

// === ZMENA: Používame createRoot pre React 18 ===
try {
    const root = ReactDOM.createRoot(headerRoot);
    root.render(
        React.createElement(GlobalHeaderAndNotifications)
    );
    console.log("Header: GlobalHeaderAndNotifications úspešne vykreslený pomocou createRoot.");
} catch (e) {
    console.error("Header: Chyba pri vykresľovaní GlobalHeaderAndNotifications:", e);
}
