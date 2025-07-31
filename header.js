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

// Global application ID and Firebase configuration
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;


import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithCustomToken, signInAnonymously, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Inicializácia Firebase
const app = initializeApp(firebaseConfig);
window.auth = getAuth(app);
window.db = getFirestore(app);

// Funkcia na overenie a prihlásenie pomocou custom tokenu alebo anonymne
const authenticateUser = async () => {
  try {
    if (initialAuthToken) {
      await signInWithCustomToken(window.auth, initialAuthToken);
      console.log("AuthManager: Prihlásenie pomocou custom tokenu úspešné.");
    } else {
      await signInAnonymously(window.auth);
      console.log("AuthManager: Prihlásenie anonymne úspešné.");
    }
  } catch (error) {
    console.error("AuthManager: Chyba pri autentifikácii:", error);
    // Pri chybe sa pokúsime o anonymné prihlásenie pre prístup k verejným dátam
    await signInAnonymously(window.auth);
  }
};

// Pomocné komponenty pre modálne okná
const TopRightNotificationModal = ({ message, onClose, displayNotificationsEnabled }) => {
  if (!message || !displayNotificationsEnabled) return null;
  return React.createElement(
    'div',
    {
      className: 'fixed top-16 right-4 z-50 p-4 bg-white rounded-lg shadow-lg max-w-sm',
      style: { transition: 'opacity 0.5s ease-in-out' }
    },
    React.createElement('div', { className: 'flex items-center' },
      React.createElement('div', { className: 'ml-3 text-sm font-medium text-gray-900' }, message),
      React.createElement('button', {
        onClick: onClose,
        className: 'ml-auto text-gray-400 hover:text-gray-900'
      }, '×')
    )
  );
};

const CenterConfirmationModal = ({ message, onClose }) => {
  if (!message) return null;
  return React.createElement(
    'div',
    { className: 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50' },
    React.createElement(
      'div',
      { className: 'bg-white p-8 rounded-lg shadow-xl max-w-sm text-center' },
      React.createElement('p', { className: 'text-lg font-semibold mb-4' }, message),
      React.createElement('button', {
        onClick: onClose,
        className: 'bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded transition-colors'
      }, 'Zavrieť')
    )
  );
};


// Hlavná komponenta pre hlavičku a notifikácie
function GlobalHeaderAndNotifications() {
  const [currentTopRightMessage, setCurrentTopRightMessage] = React.useState('');
  const [currentCenterMessage, setCurrentCenterMessage] = React.useState('');
  const [displayTopRightNotificationsEnabled, setDisplayTopRightNotificationsEnabled] = React.useState(true);

  // Funkcia na zobrazenie globálnej notifikácie
  window.showGlobalNotification = (message, type = 'info', duration = 5000) => {
    setCurrentTopRightMessage(message);
    const timeout = setTimeout(() => {
      setCurrentTopRightMessage('');
    }, duration);
    return () => clearTimeout(timeout);
  };
  
  // === NOVÁ FUNKCIA: Zobrazenie potvrdzovacieho modalu ===
  const showCenterConfirmation = (message) => {
    setCurrentCenterMessage(message);
  };
  
  // === NOVÁ FUNKCIA: Odhlásenie ===
  const handleLogout = async () => {
    try {
        await signOut(window.auth);
        console.log("Používateľ bol úspešne odhlásený.");
        window.location.href = '/'; // Presmerovanie na hlavnú stránku
    } catch (error) {
        console.error("Chyba pri odhlásení:", error);
        // showGlobalNotification(`Chyba pri odhlásení: ${error.message}`, 'error');
        showCenterConfirmation(`Chyba pri odhlásení: ${error.message}`);
    }
  };

  // === ZMENA: Správne spracovanie stavu autentifikácie a aktualizácia DOM ===
  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(window.auth, async (user) => {
      console.log("AuthManager: Stav autentifikácie sa zmenil.", user);

      let profileData = null;
      let userRole = 'public';
      
      const registerLink = document.getElementById('register-link');
      const profileLink = document.getElementById('profile-link');
      const authLink = document.getElementById('auth-link');
      const logoutButton = document.getElementById('logout-button');
      
      // Skryť všetky relevantné odkazy
      if(registerLink) registerLink.classList.add('hidden');
      if(profileLink) profileLink.classList.add('hidden');
      if(authLink) authLink.classList.add('hidden');
      if(logoutButton) logoutButton.classList.add('hidden');
      
      if (user) {
        // Používateľ je prihlásený, pokúsime sa načítať jeho profil
        const userDocRef = doc(window.db, 'users', user.uid);
        try {
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            profileData = userDoc.data();
            userRole = profileData.role;
            window.globalUserProfileData = profileData;
            console.log("AuthManager: Údaje používateľa načítané.", profileData);

            if(userRole === 'admin' && profileLink) {
              profileLink.href = 'logged-in-users.html';
              profileLink.textContent = 'Admin zóna';
              profileLink.classList.remove('hidden');
            } else if (userRole === 'user' && profileLink) {
              profileLink.href = 'logged-in-my-data.html';
              profileLink.textContent = 'Moja zóna';
              profileLink.classList.remove('hidden');
            }
          } else {
            console.log("AuthManager: Dokument používateľa neexistuje, nastavujem defaultný profil.");
            window.globalUserProfileData = { role: 'user', approved: false, email: user.email };
          }
          if(logoutButton) logoutButton.classList.remove('hidden');
        } catch (e) {
          console.error("AuthManager: Chyba pri načítavaní profilu používateľa:", e);
          window.globalUserProfileData = null;
        }

        // Zobraziť odkaz na registráciu iba pre bežných používateľov
        if (registerLink && userRole === 'user') {
          registerLink.classList.remove('hidden');
        }
      } else {
        // Používateľ nie je prihlásený, zobrazíme Prihlásenie
        if (authLink) authLink.classList.remove('hidden');
        // Pre neprihláseného používateľa sa zobrazí aj registrácia na turnaj
        if (registerLink) registerLink.classList.remove('hidden');
      }

      window.isGlobalAuthReady = true;
      // Odpálime udalosť, aby ostatné skripty vedeli, že sa môžu spustiť
      window.dispatchEvent(new Event('auth-state-changed'));
    });

    return () => unsubscribe();
  }, []);

  // === ZMENA: Priradenie event listeneru k tlačidlu Odhlásenie ===
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

// Vykreslíme GlobalHeaderAndNotifications do špecifického DOM elementu
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
  console.error("Header: Chyba pri vykreslení GlobalHeaderAndNotifications:", e);
}
