// authentication.js
// Tento súbor spravuje globálnu autentifikáciu Firebase, načítanie profilových dát používateľa,
// overovanie prístupu a nastavenie globálnych premenných pre celú aplikáciu.

// Globálne premenné, ktoré budú dostupné pre všetky ostatné skripty
window.isGlobalAuthReady = false; // Indikuje, či je Firebase Auth inicializované a prvý stav používateľa skontrolovaný
window.globalUserProfileData = null; // Obsahuje dáta profilu prihláseného používateľa
window.auth = null; // Inštancia Firebase Auth
window.db = null; // Inštancia Firebase Firestore
window.showGlobalNotification = null; // Funkcia pre zobrazenie globálnych notifikácií

// Helper funkcia pre autorizáciu prístupu k stránkam
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
      'logged-in-my-data.html': { role: ['user', 'admin'], approved: true },
      'logged-in-my-settings.html': { role: ['user', 'admin'], approved: true },
      'logged-in-change-name.html': { role: ['user', 'admin'], approved: true },
      'logged-in-change-phone.html': { role: ['user', 'admin'], approved: true },
      'logged-in-change-email.html': { role: ['user', 'admin'], approved: true },
      'logged-in-change-password.html': { role: ['user', 'admin'], approved: true },
      'logged-in-notifications.html': { role: ['user', 'admin'], approved: true },
      'logged-in-soh-chat.html': { role: ['user', 'admin'], approved: true },
    };

    const currentPageName = currentPath.substring(currentPath.lastIndexOf('/') + 1);
    const requiredAccess = pageAccessRules[currentPageName];

    // Ak stránka nie je v pravidlách (napr. neexistuje), predpokladáme, že je verejná
    if (!requiredAccess) {
        console.warn(`AuthManager: Pravidlá prístupu pre stránku ${currentPageName} nenájdené. Predpokladám verejný prístup.`);
        return true;
    }

    // Ak je stránka verejná, prístup je povolený pre všetkých (aj neautentifikovaných)
    if (requiredAccess.role === 'public') {
        return true;
    }

    // Pre prihlásené stránky
    if (!userData) {
        console.log(`AuthManager: Prístup zamietnutý pre ${currentPageName}. Používateľ nie je prihlásený.`);
        return false; // Používateľ nie je prihlásený
    }

    // Kontrola schválenia
    if (requiredAccess.approved && !userData.approved) {
        console.log(`AuthManager: Prístup zamietnutý pre ${currentPageName}. Používateľ ${userData.email} nie je schválený.`);
        return false; // Používateľ nie je schválený
    }

    // Kontrola roly
    const userRole = userData.role;
    if (Array.isArray(requiredAccess.role)) {
        if (!requiredAccess.role.includes(userRole)) {
            console.log(`AuthManager: Prístup zamietnutý pre ${currentPageName}. Rola ${userRole} nemá prístup. Vyžaduje sa: ${requiredAccess.role.join(', ')}.`);
            return false;
        }
    } else if (requiredAccess.role !== userRole) {
        console.log(`AuthManager: Prístup zamietnutý pre ${currentPageName}. Rola ${userRole} nemá prístup. Vyžaduje sa: ${requiredAccess.role}.`);
        return false;
    }

    console.log(`AuthManager: Prístup povolený pre ${currentPageName} pre rolu ${userRole}.`);
    return true;
};


// Global Notification Handler (pre React.createElement)
function GlobalNotificationHandler() {
  const [user, setUser] = React.useState(null);
  const [userProfileData, setUserProfileData] = React.useState(null);
  const [isAuthReady, setIsAuthReady] = React.useState(false);
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [messageType, setMessageType] = React.useState('info');
  const timerRef = React.useRef(null);

  // Expose showGlobalNotification function globally
  React.useEffect(() => {
    window.showGlobalNotification = (msg, type = 'info') => {
      setMessage(msg);
      setMessageType(type);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        setMessage('');
        setMessageType('info');
      }, 10000); // Zobraziť na 10 sekúnd
    };

    return () => {
      window.showGlobalNotification = null;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  // Firebase Initialization and Auth State Listener
  React.useEffect(() => {
    let unsubscribeUserDoc;
    let authInstance, dbInstance; // Používame dočasné názvy, aby sa predišlo kolízii s globálnymi window.auth/db

    try {
      const app = firebase.initializeApp(firebaseConfig);
      authInstance = firebase.auth(app);
      dbInstance = firebase.firestore(app);
      window.auth = authInstance; // Make auth instance globally available
      window.db = dbInstance;     // Make db instance globally available
      console.log("AuthManager: Firebase inicializovaný a globálne premenné nastavené.");
    } catch (e) {
      console.error("AuthManager: Chyba pri inicializácii Firebase:", e);
      setError(`Chyba pri inicializácii aplikácie: ${e.message}`);
      setIsAuthReady(true); // Nastavíme ako pripravené, aj keď s chybou, aby sa neblokovalo
      return;
    }

    const handleAuthStateChange = async (currentUser) => {
      console.log("AuthManager: onAuthStateChanged - Používateľ:", currentUser ? currentUser.uid : "null");
      setUser(currentUser); // Update local user state
      window.isGlobalAuthReady = true; // Auth je pripravené
      setIsAuthReady(true); // Update local isAuthReady state

      // Clear previous user profile data and unsubscribe if user changes
      setUserProfileData(null);
      window.globalUserProfileData = null;
      if (unsubscribeUserDoc) {
        unsubscribeUserDoc();
        unsubscribeUserDoc = null;
      }

      if (currentUser) {
        // Check passwordLastChanged only for non-anonymous users
        if (!currentUser.isAnonymous) {
            // Check passwordLastChanged
            const userDocRef = dbInstance.collection('users').doc(currentUser.uid);
            unsubscribeUserDoc = userDocRef.onSnapshot(docSnapshot => {
                if (docSnapshot.exists) {
                    const userData = docSnapshot.data();
                    // console.log("AuthManager: Používateľský dokument existuje, dáta:", userData); // Removed for brevity

                    // Validate passwordLastChanged
                    if (!userData.passwordLastChanged || typeof userData.passwordLastChanged.toDate !== 'function') {
                        console.error("AuthManager: passwordLastChanged NIE JE platný Timestamp objekt! Odhlasujem používateľa.");
                        authInstance.signOut();
                        window.location.href = 'login.html';
                        localStorage.removeItem(`passwordLastChanged_${currentUser.uid}`);
                        return;
                    }

                    const firestorePasswordChangedTime = userData.passwordLastChanged.toDate().getTime();
                    const localStorageKey = `passwordLastChanged_${currentUser.uid}`;
                    let storedPasswordChangedTime = parseInt(localStorage.getItem(localStorageKey) || '0', 10);

                    if (firestorePasswordChangedTime > storedPasswordChangedTime) {
                        console.log("AuthManager: Detekovaná zmena hesla na inom zariadení/relácii. Odhlasujem používateľa.");
                        authInstance.signOut();
                        window.location.href = 'login.html';
                        localStorage.removeItem(localStorageKey);
                        return;
                    } else {
                        // Update localStorage to ensure it's current
                        localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
                    }

                    // Check if admin user is approved
                    if (userData.role === 'admin' && userData.approved === false) {
                        console.log("AuthManager: Používateľ je admin a nie je schválený. Odhlasujem.");
                        authInstance.signOut();
                        window.location.href = 'login.html';
                        return;
                    }

                    setUserProfileData(userData);
                    window.globalUserProfileData = userData;
                    setError(''); // Clear any previous errors
                    // Trigger custom event for other components to react to profile data changes
                    window.dispatchEvent(new CustomEvent('globalProfileDataChanged'));

                } else {
                    console.warn("AuthManager: Používateľský dokument sa nenašiel pre UID:", currentUser.uid, "Odhlásenie.");
                    // If profile doesn't exist for a non-anonymous user, log them out
                    authInstance.signOut();
                    window.location.href = 'login.html';
                }
            }, error => {
                console.error("AuthManager: Chyba pri načítaní používateľských dát z Firestore (onSnapshot error):", error);
                setError(`Chyba pri načítaní používateľských dát: ${error.message}`);
                // If there's a permission error, it might be due to security rules.
                // For non-anonymous users, this is a critical error.
                authInstance.signOut();
                window.location.href = 'login.html';
            });
        } else {
            // Anonymous user, do not fetch userProfileData from Firestore
            console.log("AuthManager: Prihlásený anonymný používateľ. Nebudú sa načítavať profilové dáta z Firestore.");
            setUserProfileData({ role: 'anonymous', approved: true }); // Provide a minimal profile for anonymous users
            window.globalUserProfileData = { role: 'anonymous', approved: true };
            window.dispatchEvent(new CustomEvent('globalProfileDataChanged'));
        }
      } else {
        // User is null (not logged in or logged out)
        console.log("AuthManager: Používateľ nie je prihlásený, resetujem globálny profil.");
        setUserProfileData(null);
        window.globalUserProfileData = null;
        window.dispatchEvent(new CustomEvent('globalProfileDataChanged'));
      }

      // After auth state changes and data is potentially loaded, check page authorization
      const currentPath = window.location.pathname;
      const isAuthorized = checkPageAuthorization(window.globalUserProfileData, currentPath);

      if (!isAuthorized) {
        console.log(`AuthManager: Používateľ nemá prístup k ${currentPath}. Presmerovávam.`);
        // Redirect based on whether user is logged in or not
        if (currentUser) {
          // Logged in but unauthorized (e.g., non-admin trying to access admin page)
          window.location.href = 'logged-in-my-data.html';
        } else {
          // Not logged in and trying to access a restricted page
          window.location.href = 'login.html';
        }
      }
    };

    // Main listener for Firebase Auth state changes
    const unsubscribeAuth = authInstance.onAuthStateChanged(handleAuthStateChange);

    // Initial sign-in (anonymous or custom token)
    // Only attempt initial sign-in if no user is currently authenticated
    if (!authInstance.currentUser) {
        console.log("AuthManager: Žiadny aktuálny používateľ, pokúšam sa o počiatočné prihlásenie.");
        (async () => {
            try {
                if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                    await authInstance.signInWithCustomToken(__initial_auth_token);
                    console.log("AuthManager: Prihlásenie s custom tokenom úspešné.");
                } else {
                    await authInstance.signInAnonymously();
                    console.log("AuthManager: Anonymné prihlásenie úspešné.");
                }
            } catch (e) {
                console.error("AuthManager: Chyba pri počiatočnom prihlásení Firebase (s custom tokenom alebo anonymne):", e);
                // If anonymous sign-in fails, it's a critical issue for public pages.
                // Display error and prevent further operations.
                setError(`Chyba pri prihlásení: ${e.message}. Skúste to prosím neskôr.`);
                // Do not redirect here, let the onAuthStateChanged handle the null user.
            }
        })();
    } else {
        // If already authenticated, manually trigger the handler to process the current user
        // and ensure page authorization is checked.
        console.log("AuthManager: Používateľ už je prihlásený, spúšťam handleAuthStateChange manuálne.");
        handleAuthStateChange(authInstance.currentUser);
    }


    return () => {
      unsubscribeAuth();
      if (unsubscribeUserDoc) {
        unsubscribeUserDoc();
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      window.showGlobalNotification = null; // Clean up global function
    };
  }, []); // Empty dependency array means this runs once on mount

  // This component renders the global notification modal
  return React.createElement(
    'div',
    {
      className: `fixed top-0 left-0 right-0 z-[9999] flex justify-center p-4 transition-transform duration-500 ease-out ${
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
// Vytvoríme koreňový element pre React komponent, ak ešte neexistuje
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

// Vykreslíme GlobalNotificationHandler do tohto koreňového elementu
try {
  ReactDOM.render(
    React.createElement(GlobalNotificationHandler),
    authRoot
  );
  console.log("AuthManager: GlobalNotificationHandler vykreslený do 'authentication-root'.");
} catch (e) {
  console.error("AuthManager: Chyba pri vykresľovaní GlobalNotificationHandler:", e);
}
