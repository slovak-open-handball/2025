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
  // `role` môže byť 'public', 'user', 'admin'
  // `approved` sa používa pre adminov, aby sa zabezpečilo, že ich účet bol schválený
  const pageAccessRules = {
    'index.html': { role: 'public', approved: true },
    'login.html': { role: 'public', approved: true },
    'account.html': { role: 'user', approved: true },
    'admin-register.html': { role: 'public', approved: true }, 
    'register.html': { role: 'user', approved: true },
    'logged-in-users.html': { role: 'admin', approved: true },
    'logged-in-tournament-settings.html': { role: 'admin', approved: true },
    'logged-in-add-categories.html': { role: 'admin', approved: true },
    'logged-in-all-registrations.html': { role: 'admin', approved: true },
    'logged-in-my-data.html': { role: 'user', approved: true },
    'logged-in-my-team.html': { role: 'user', approved: true },
    'logged-in-registrations.html': { role: 'user', approved: true },
    'logged-in-team-settings.html': { role: 'user', approved: true },
    'logged-in-create-team.html': { role: 'user', approved: true },
  };

  const page = currentPath.substring(currentPath.lastIndexOf('/') + 1);
  const rule = pageAccessRules[page];

  // Ak pre stránku neexistuje žiadne pravidlo, predpokladáme, že je prístupná pre všetkých.
  if (!rule) {
    console.log(`AuthManager: Žiadne pravidlo pre stránku ${page}. Prístup povolený.`);
    return true;
  }
  
  // === OPRAVA: ZABEZPEČENIE PRÍSTUPU K VEREJNÝM STRÁNKAM PRE NEPRIHLÁSENÝCH POUŽÍVATEĽOV ===
  if (rule.role === 'public') {
      console.log(`AuthManager: Stránka ${page} je verejná. Prístup povolený.`);
      return true;
  }
  
  // Ak je používateľ odhlásený, ale stránka nie je verejná, presmerujeme ho na login
  if (!userData) {
      console.log(`AuthManager: Používateľ je odhlásený a stránka ${page} nie je verejná. Presmerujem na login.`);
      return false;
  }

  // Kontrola prístupu na základe roly a schválenia
  if (userData.role === rule.role && userData.approved === rule.approved) {
    console.log(`AuthManager: Prístup k stránke ${page} povolený pre rolu ${userData.role}.`);
    return true;
  } else if (userData.role === 'admin' && rule.role === 'user' && rule.approved) {
    // Admin má vždy prístup k stránkam pre bežných používateľov
    console.log(`AuthManager: Admin prístup k stránke ${page} povolený.`);
    return true;
  }

  console.log(`AuthManager: Prístup k stránke ${page} odmietnutý pre rolu ${userData.role}.`);
  return false;
};

// Funkcia na presmerovanie na domovskú stránku
const redirectToHome = () => {
    window.location.href = 'index.html';
};

// === NOVÁ ČASŤ: Vytvorenie a správa globálnych notifikácií ===
const { useEffect, useState } = React;
const GlobalNotificationHandler = () => {
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');
  const [error, setError] = useState('');
  
  // Exportuje globálnu funkciu pre notifikácie
  useEffect(() => {
    window.showGlobalNotification = (msg, type = 'info', err = '') => {
      setMessage(msg);
      setMessageType(type);
      setError(err);
      setTimeout(() => {
        setMessage('');
        setError('');
      }, 5000); // Notifikácia zmizne po 5 sekundách
    };
  }, []);

  return React.createElement(
    'div',
    {
      className: `fixed top-0 left-0 right-0 z-[999] flex justify-center p-4 transition-transform duration-500 ease-out ${
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
  console.log("AuthManager: GlobalNotificationHandler úspešne vykreslený.");
} catch (e) {
  console.error("AuthManager: Chyba pri vykreslení GlobalNotificationHandler:", e);
}
