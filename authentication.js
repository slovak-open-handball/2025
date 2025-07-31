// authentication.js

// Tento súbor spravuje globálnu autentifikáciu Firebase, načítanie profilových dát používateľa,
// overovanie prístupu a nastavenie globálnych premenných pre celú aplikáciu.

// Globálne premenné, ktoré budú dostupné pre všetky ostatné skripty
window.isGlobalAuthReady = false; // Indikuje, či je Firebase Auth inicializované a prvý stav používateľa skontrolovaný
window.globalUserProfileData = null; // Obsahuje dáta profilu prihláseného používateľa
window.auth = null; // Inštancia Firebase Auth
window.db = null; // Inštancia Firebase Firestore
window.showGlobalNotification = null; // Funkcia pre zobrazenie globálnych notifikácií
window.formatToDatetimeLocal = null; // Globálna funkcia pre formátovanie dátumu

// Helper funkcia pre autorizáciu prístupu k stránkam
const checkPageAuthorization = (userData, currentPath) => {
    // ... existujúca funkcia checkPageAuthorization ...
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
    if (!requiredAccess) {
        console.warn(`AuthManager: Pravidlá prístupu pre stránku ${currentPageName} nenájdené. Predpokladám verejný prístup.`);
        return true;
    }
    if (requiredAccess.role === 'public') {
        return true;
    }
    if (!userData) {
        console.log(`AuthManager: Prístup zamietnutý pre ${currentPageName}. Používateľ nie je prihlásený.`);
        // Toto je hlavná zmena - ak používateľ nie je prihlásený, ale snaží sa dostať na chránenú stránku, presmerujeme ho na login.
        return false; 
    }
    if (requiredAccess.approved && !userData.approved) {
        console.log(`AuthManager: Prístup zamietnutý pre ${currentPageName}. Používateľ ${userData.email} nie je schválený.`);
        return false;
    }
    if (Array.isArray(requiredAccess.role)) {
        if (!requiredAccess.role.includes(userData.role)) {
            console.log(`AuthManager: Prístup zamietnutý pre ${currentPageName}. Používateľ ${userData.email} nemá rolu '${userData.role}', ale vyžaduje sa jedna z [${requiredAccess.role.join(', ')}].`);
            return false;
        }
    } else {
        if (userData.role !== requiredAccess.role) {
            console.log(`AuthManager: Prístup zamietnutý pre ${currentPageName}. Používateľ ${userData.email} má rolu '${userData.role}', ale vyžaduje sa '${requiredAccess.role}'.`);
            return false;
        }
    }
    console.log(`AuthManager: Prístup povolený pre ${currentPageName}.`);
    return true;
};

// Helper funkcia pre formátovanie objektu dátumu na 'YYYY-MM-DDTHH:mm'
window.formatToDatetimeLocal = (date) => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};


// Komponent pre globálne notifikácie v strede obrazovky
function GlobalNotificationHandler() {
  // ... existujúci kód GlobalNotificationHandler ...
  const [message, setMessage] = React.useState('');
  const [messageType, setMessageType] = React.useState('info');
  const [error, setError] = React.useState('');

  window.showGlobalNotification = (msg, type = 'info') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => {
      setMessage('');
      setError('');
    }, 5000);
  };

  if (!message && !error) {
    return null;
  }

  return React.createElement(
    'div',
    {
      className: `fixed inset-x-0 bottom-4 z-50 flex justify-center p-4 transition-transform duration-500 ease-out ${
        (message || error) ? 'translate-y-0' : 'translate-y-full'
      }`,
      style: { pointerEvents: 'none' }
    },
    React.createElement(
      'div',
      {
        className: `${messageType === 'success' ? 'bg-[#3A8D41]' : messageType === 'error' ? 'bg-red-600' : 'bg-[#3A8D41]'} text-white px-6 py-3 rounded-lg shadow-lg max-w-md w-full text-center`,
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

// === ZMENA: Používame createRoot pre React 18 ===
try {
  const root = ReactDOM.createRoot(authRoot);
  root.render(
    React.createElement(GlobalNotificationHandler)
  );
  console.log("AuthManager: GlobalNotificationHandler úspešne vykreslený pomocou createRoot.");
} catch (e) {
  console.error("AuthManager: Chyba pri vykresľovaní GlobalNotificationHandler:", e);
}


// --- Inicializácia Firebase ---
console.log("AuthManager: Spúšťam inicializáciu Firebase.");

// Nová, vylepšená inicializácia Firebase pomocou v7 namespaced prístupu
const app = typeof firebaseConfig !== 'undefined'
  ? (!firebase.apps.length ? firebase.initializeApp(firebaseConfig) : firebase.app())
  : null;

if (app) {
    // Sprístupnenie globálnych premenných
    window.auth = app.auth();
    window.db = app.firestore();

    // Počkáme, kým sa overí stav prihlásenia
    app.auth().onAuthStateChanged(async (user) => {
        console.log("AuthManager: onAuthStateChanged - používateľ je teraz:", user ? user.email : 'neprihlásený');
        if (user) {
            console.log(`AuthManager: Prihlásený používateľ s UID: ${user.uid}. Načítavam profil...`);
            const userDocRef = app.firestore().collection("users").doc(user.uid);
            try {
                const docSnap = await userDocRef.get();
                if (docSnap.exists) {
                    window.globalUserProfileData = docSnap.data();
                    console.log("AuthManager: Profil používateľa úspešne načítaný:", window.globalUserProfileData);
                } else {
                    console.warn("AuthManager: Profil používateľa nebol nájdený v databáze. Nastavujem predvolené dáta.");
                    window.globalUserProfileData = {
                        uid: user.uid,
                        email: user.email,
                        role: 'user',
                        approved: false,
                        displayName: user.email.split('@')[0],
                    };
                }
            } catch (error) {
                console.error("AuthManager: Chyba pri načítaní profilu používateľa:", error);
                window.showGlobalNotification(`Chyba pri načítaní profilu: ${error.message}`, 'error');
            }
        } else {
            console.log("AuthManager: Používateľ nie je prihlásený. Globálny profil je null.");
            window.globalUserProfileData = null;
            // Presmerovanie na login.html po odhlásení
            if (window.location.pathname.endsWith('login.html') === false) {
                 window.location.href = 'login.html';
            }
        }

        // Nastavíme globálny stav pripravenosti
        window.isGlobalAuthReady = true;
        console.log("AuthManager: Nastavil som isGlobalAuthReady na true.");

        // Skontrolujeme prístup k aktuálnej stránke po prihlásení/odhlásení
        const currentPath = window.location.pathname;
        if (!checkPageAuthorization(window.globalUserProfileData, currentPath)) {
             // Ak prístup nie je povolený, presmerujeme
            console.log("AuthManager: Prístup k stránke zamietnutý, presmerúvam na login.html.");
            window.location.href = 'login.html';
        }
    });

    console.log("AuthManager: Firebase inicializované a listener spustený.");
} else {
    console.error("AuthManager: Firebase nebol inicializovaný, chýba firebaseConfig.");
    window.isGlobalAuthReady = true; // Zabezpečíme, že aplikácia pobeží aj bez Firebase
}
