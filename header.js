// header.js
// Tento súbor spravuje dynamické zobrazenie navigačných odkazov v hlavičke
// a obsluhuje akcie ako odhlásenie používateľa.

// Funkcia na načítanie hlavičky (len HTML štruktúry)
async function loadHeader() {
    try {
        const response = await fetch('header.html');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const headerHtml = await response.text();
        const headerPlaceholder = document.getElementById('header-placeholder');
        if (headerPlaceholder) {
            headerPlaceholder.innerHTML = headerHtml;
        } else {
            console.error("header.js: Nenašiel sa '#header-placeholder' element.");
        }
    } catch (error) {
        console.error("header.js: Chyba pri načítaní hlavičky:", error);
    }
}

// Funkcia pre odhlásenie
const handleLogout = async () => {
    if (window.auth) {
        try {
            await window.auth.signOut();
            window.showGlobalNotification('Úspešne ste sa odhlásili.', 'success');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        } catch (error) {
            console.error("Chyba pri odhlasovaní:", error);
            window.showGlobalNotification('Chyba pri odhlasovaní. Skúste znova.', 'error');
        }
    }
};

// React komponent na obsluhu dynamických prvkov hlavičky a notifikácií
function GlobalHeaderAndNotifications() {
  const [user, setUser] = React.useState(null);
  const [isAuthReady, setIsAuthReady] = React.useState(false);

  React.useEffect(() => {
    // Čakáme, kým bude pripravená globálna autentifikácia
    const checkAuthStatus = setInterval(() => {
      if (window.isGlobalAuthReady) {
        setIsAuthReady(true);
        setUser(window.globalUserProfileData);
        clearInterval(checkAuthStatus);

        // Nastavíme listener na zmeny v globálnom stave
        const handleGlobalStateChange = () => {
          setUser(window.globalUserProfileData);
        };
        window.addEventListener('globalStateChanged', handleGlobalStateChange);
        
        return () => {
            window.removeEventListener('globalStateChanged', handleGlobalStateChange);
        };
      }
    }, 100);
  }, []);

  React.useEffect(() => {
    if (isAuthReady) {
      // Zobrazí alebo skryje navigačné odkazy na základe stavu používateľa
      const profileLink = document.getElementById('profile-link');
      const authLink = document.getElementById('auth-link');
      const logoutButton = document.getElementById('logout-button');
      
      if (profileLink) profileLink.classList.add('hidden');
      if (authLink) authLink.classList.add('hidden');
      if (logoutButton) logoutButton.classList.add('hidden');
      
      if (user) {
        // Používateľ je prihlásený
        if (profileLink) profileLink.classList.remove('hidden');
        if (logoutButton) logoutButton.classList.remove('hidden');
      } else {
        // Používateľ nie je prihlásený
        if (authLink) authLink.classList.remove('hidden');
      }
    }
  }, [user, isAuthReady]);

  // Pridanie poslucháča udalosti pre tlačidlo odhlásenia
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
  }, []);

  return null; // Tento komponent sa stará len o logiku, nevytvára DOM elementy
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

// Načítať hlavičku HTML štruktúru ako prvú, potom vykresliť React komponent
window.onload = function() {
    loadHeader().then(() => {
        try {
            // Používame ReactDOM.render pre kompatibilitu s React 17
            ReactDOM.render(
                React.createElement(GlobalHeaderAndNotifications),
                headerRoot
            );
            console.log("Header: GlobalHeaderAndNotifications úspešne vykreslený.");
        } catch (e) {
            console.error("Header: Chyba pri vykresľovaní GlobalHeaderAndNotifications:", e);
        }
    }).catch(error => {
        console.error("Chyba pri inicializácii hlavičky:", error);
    });
};
