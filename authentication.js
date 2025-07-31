// authentication.js
// Tento súbor spravuje globálnu autentifikáciu Firebase, načítanie profilových dát používateľa,
// overovanie prístupu a nastavenie globálnych premenných pre celú aplikáciu.

// Globálne premenné, ktoré budú dostupné pre všetky ostatné skripty
window.isGlobalAuthReady = false; // Indikuje, či je Firebase Auth inicializované a prvý stav používateľa skontrolovaný
window.globalUserProfileData = null; // Obsahuje dáta profilu prihláseného používateľa
window.auth = null; // Inštancia Firebase Auth
window.db = null; // Inštancia Firebase Firestore
window.showGlobalNotification = null; // Funkcia pre zobrazenie globálnych notifikácií

// Import necessary Firebase functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Inicializácia Firebase
const initFirebase = async () => {
    try {
        const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
        const app = initializeApp(firebaseConfig);
        window.db = getFirestore(app);
        window.auth = getAuth(app);
        
        const token = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : '';
        if (token) {
            await signInWithCustomToken(window.auth, token);
        } else {
            await signInAnonymously(window.auth);
        }

        console.log("AuthManager: Firebase inicializované.");
    } catch (e) {
        console.error("AuthManager: Chyba pri inicializácii Firebase:", e);
    }
};

// Pomocná funkcia pre autorizáciu prístupu k stránkam
const checkPageAuthorization = (userData, currentPath) => {
    // Definícia prístupových pravidiel pre jednotlivé stránky
    const pageAccessRules = {
      'index.html': { role: 'public', approved: true },
      'login.html': { role: 'public', approved: true },
      'account.html': { role: 'public', approved: true },
      'admin-register.html': { role: 'public', approved: true },
      'logged-in-users.html': { role: 'admin', approved: true },
      'logged-in-tournament-settings.html': { role: 'admin', approved: true },
      'logged-in-add-categories.html': { role: 'admin', approved: true },
      'logged-in-all-registrations.html': { role: 'admin', approved: true },
      'logged-in-my-data.html': { role: 'user', approved: true },
      'logged-in-registration.html': { role: 'user', approved: true },
    };

    const rules = pageAccessRules[currentPath.split('/').pop()] || { role: 'public', approved: true };
    const userRole = userData?.role;
    
    if (rules.role === 'admin' && userRole !== 'admin') {
      return false;
    }
    if (rules.role === 'user' && !userRole) {
      return false;
    }
    
    return true;
};

// Komponent pre správu globálnych notifikácií
function GlobalNotificationHandler() {
  const [message, setMessage] = React.useState('');
  const [messageType, setMessageType] = React.useState('info'); // info, success, error
  const [error, setError] = React.useState('');
  const timeoutRef = React.useRef(null);

  // Exponujeme funkciu na zobrazenie notifikácie do globálneho okna
  React.useEffect(() => {
    window.showGlobalNotification = (msg, type = 'info', duration = 5000) => {
      setMessage(msg);
      setMessageType(type);
      setError('');
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        setMessage('');
      }, duration);
    };
    window.showGlobalError = (err, duration = 5000) => {
        setError(err);
        setMessageType('error');
        setMessage('');
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
            setError('');
        }, duration);
    };
  }, []);

  return React.createElement(
    'div',
    {
      className: `fixed top-0 left-1/2 -translate-x-1/2 z-50 flex justify-center p-4 transition-transform duration-500 ease-out ${
        (message || error) ? 'translate-y-0' : '-translate-y-full'
      }`,
      style: { pointerEvents: 'none' }
    },
    React.createElement(
      'div',
      {
        className: `${messageType === 'success' ? 'bg-[#3A8D41]' : messageType === 'error' ? 'bg-red-600' : 'bg-blue-500'} text-white px-6 py-3 rounded-lg shadow-lg max-w-md w-full text-center`,
        style: { pointerEvents: 'auto' }
      },
      React.createElement('p', { className: 'font-semibold' }, message || error)
    )
  );
}

// Vykreslíme GlobalNotificationHandler do skrytého DOM elementu
let authRoot = document.getElementById('authentication-root');
if (!authRoot) {
  authRoot = document.createElement('div');
  authRoot.id = 'authentication-root';
  authRoot.style.display = 'none'; // Skryť element
  document.body.appendChild(authRoot);
  console.log("AuthManager: Vytvoril som a pridal 'authentication-root' div do tela dokumentu.");
} else {
  console.log("AuthManager: 'authentication-root' div už existuje.");
}

try {
  // Používame ReactDOM.render pre kompatibilitu s React 17
  ReactDOM.render(
    React.createElement(GlobalNotificationHandler),
    authRoot
  );
  console.log("AuthManager: GlobalNotificationHandler úspešne vykreslený.");
} catch (e) {
  console.error("AuthManager: Chyba pri vykresľovaní GlobalNotificationHandler:", e);
}


window.addEventListener('DOMContentLoaded', async () => {
    await initFirebase();

    onAuthStateChanged(window.auth, (user) => {
        window.isGlobalAuthReady = true;
        if (user) {
            console.log("AuthManager: Používateľ prihlásený, načítavam profil.");
            const userDocRef = doc(window.db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');
            
            // onSnapshot pre real-time aktualizácie profilu
            const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    window.globalUserProfileData = { id: docSnap.id, ...docSnap.data() };
                    console.log("AuthManager: Načítaný profil používateľa:", window.globalUserProfileData);
                } else {
                    console.log("AuthManager: Žiadny profil používateľa nenájdený.");
                    window.globalUserProfileData = null;
                }
                
                // Kontrola autorizácie stránky po načítaní profilu
                if (!checkPageAuthorization(window.globalUserProfileData, window.location.pathname)) {
                    console.warn("AuthManager: Používateľ nemá oprávnenie pre túto stránku. Presmerovanie na domovskú stránku.");
                    window.location.href = 'index.html';
                }
            }, (error) => {
                console.error("AuthManager: Chyba pri načítaní profilu:", error);
                window.globalUserProfileData = null;
            });

            // Čistenie pri odhlásení
            return () => unsubscribe();
        } else {
            console.log("AuthManager: Používateľ odhlásený.");
            window.globalUserProfileData = null;
            
            // Kontrola autorizácie stránky po odhlásení
            if (!checkPageAuthorization(window.globalUserProfileData, window.location.pathname)) {
                window.location.href = 'index.html';
            }
        }
    });

    console.log("AuthManager: Listener pre zmeny stavu autentifikácie nastavený.");
});
