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

// Komponenty pre notifikácie a modálne okná
function TopRightNotificationModal({ message, onClose, displayNotificationsEnabled }) {
  const [isVisible, setIsVisible] = React.useState(!!message);

  React.useEffect(() => {
    let timer;
    if (message) {
      setIsVisible(true);
      timer = setTimeout(() => {
        setIsVisible(false);
        onClose();
      }, 5000); // Zobrazí sa na 5 sekúnd
    } else {
      setIsVisible(false);
    }
    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!displayNotificationsEnabled || !isVisible) {
    return null;
  }

  return React.createElement(
    'div',
    {
      className: `fixed top-2 right-2 z-[100] flex justify-end p-4 transition-transform duration-500 ease-out ${
        isVisible ? 'translate-x-0' : 'translate-x-full'
      }`
    },
    React.createElement(
      'div',
      {
        className: 'bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg max-w-sm w-full text-center'
      },
      React.createElement('p', { className: 'font-semibold' }, message)
    )
  );
}


function CenterConfirmationModal({ message, onClose, onConfirm }) {
  const [isVisible, setIsVisible] = React.useState(!!message);

  React.useEffect(() => {
    setIsVisible(!!message);
  }, [message]);

  if (!isVisible) {
    return null;
  }

  return React.createElement(
    'div',
    {
      className: `fixed inset-0 z-[100] flex items-center justify-center p-4 transition-transform duration-500 ease-out`,
      style: { backgroundColor: 'rgba(0, 0, 0, 0.5)' }
    },
    React.createElement(
      'div',
      { className: 'bg-white text-gray-800 px-6 py-4 rounded-lg shadow-xl max-w-sm w-full text-center' },
      React.createElement('p', { className: 'font-semibold mb-4' }, message),
      React.createElement('div', { className: 'flex justify-around' },
        React.createElement('button', {
          onClick: onConfirm,
          className: 'bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200'
        }, 'Áno'),
        React.createElement('button', {
          onClick: onClose,
          className: 'bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200'
        }, 'Zrušiť')
      )
    )
  );
}


// Hlavný globálny komponent, ktorý sa bude renderovať do hlavičky
function GlobalHeaderAndNotifications() {
  const [currentTopRightMessage, setCurrentTopRightMessage] = React.useState('');
  const [currentCenterMessage, setCurrentCenterMessage] = React.useState('');
  const [displayTopRightNotificationsEnabled, setDisplayTopRightNotificationsEnabled] = React.useState(false);


  // Funkcia na odhlásenie používateľa
  const handleLogout = React.useCallback(async () => {
    if (window.auth) {
      try {
        await window.auth.signOut();
        console.log("Header: Používateľ bol úspešne odhlásený.");
        // Presmerovanie na login.html je teraz spracované v authentication.js cez onAuthStateChanged
      } catch (error) {
        console.error("Header: Chyba pri odhlásení:", error);
        // showGlobalNotification je definované v authentication.js a dostupné globálne
        if (window.showGlobalNotification) {
            window.showGlobalNotification(`Chyba pri odhlásení: ${error.message}`, 'error');
        }
      }
    } else {
      console.error("Header: Inštancia Firebase Auth nie je k dispozícii.");
    }
  }, []);

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
  // Používame createRoot pre React 18
  const root = ReactDOM.createRoot(headerRoot);
  root.render(
    React.createElement(GlobalHeaderAndNotifications)
  );
  console.log("Header: GlobalHeaderAndNotifications úspešne vykreslený pomocou createRoot.");
} catch (e) {
  console.error("Header: Chyba pri vykresľovaní GlobalHeaderAndNotifications:", e);
}
