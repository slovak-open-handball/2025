// logged-in-template.js
// Tento súbor slúži ako generická šablóna pre hlavný obsah prihlásených stránok.
// Predpokladá, že Firebase SDK verzie 9.x.x je inicializovaný v authentication.js
// a globálne funkcie ako window.auth, window.db, showLocalNotification sú dostupné.

// V tomto generickom komponente nebudeme priamo importovať Firestore alebo Auth,
// predpokladáme, že window.db a window.auth sú globálne dostupné z authentication.js
// Ak by ste však potrebovali špecifické funkcie Firestore (napr. doc, collection),
// mali by ste ich importovať z "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"

// Príklad prístupu ku globálnym premenným (pre ilustračné účely, nie sú nevyhnutné pre tento prázdny template)
const db = window.db;
const auth = window.auth;
const showLocalNotification = window.showLocalNotification || function(msg, type) { console.log(`Notification (${type}): ${msg}`); };


// Hlavný React komponent pre generickú šablónu obsahu
function MainContentApp() {
  const [userProfileData, setUserProfileData] = React.useState(null);
  const [isAuthReady, setIsAuthReady] = React.useState(false);
  const [loading, setLoading] = React.useState(true); // Loader

  // Efekt pre sledovanie stavu autentifikácie a načítania profilu používateľa
  React.useEffect(() => {
    // Overíme, či sú globálne premenné už dostupné
    if (window.isGlobalAuthReady) {
      setIsAuthReady(true);
      if (window.globalUserProfileData) {
        setUserProfileData(window.globalUserProfileData);
        setLoading(false); // Skryjeme loader, ak sú dáta pripravené
      } else {
        // Ak dáta nie sú hneď dostupné, môžeme počkať na event alebo ich načítať
        console.log("MainContentApp: isGlobalAuthReady je true, ale globalUserProfileData nie je načítané. Čakám na event.");
      }
    }

    // Listener pre globálne aktualizácie dát profilu
    const handleGlobalDataUpdated = (event) => {
      setUserProfileData(event.detail);
      setLoading(false); // Skryjeme loader po načítaní dát
    };
    window.addEventListener('globalDataUpdated', handleGlobalDataUpdated);

    // Dôležité: Ak je používateľ odhlásený, presmerujeme ho
    const unsubscribeAuth = auth.onAuthStateChanged(currentUser => {
      if (!currentUser) {
        console.log("MainContentApp: Používateľ nie je prihlásený, presmerovávam na login.html.");
        window.location.href = 'login.html';
      }
    });

    return () => {
      // Vyčistenie listenerov pri odmontovaní komponentu
      window.removeEventListener('globalDataUpdated', handleGlobalDataUpdated);
      unsubscribeAuth();
    };
  }, []);

  // Zobrazí loader, kým nie je používateľský profil načítaný
  if (loading || !isAuthReady || !userProfileData) {
    return React.createElement(
        'div',
        { className: 'flex justify-center items-center h-full' },
        React.createElement(
            'div',
            { className: 'animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500' }
        )
    );
  }

  // Zobrazenie obsahu stránky
  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
    React.createElement(
      'div',
      { className: 'w-full max-w-3xl p-4' },
      React.createElement(
        'div',
        { className: 'bg-white p-8 rounded-lg shadow-xl w-full text-center' },
        React.createElement('h1', { className: 'text-3xl font-bold text-gray-800 mb-6' },
          `Vitajte na ${userProfileData.role === 'admin' ? 'Administrátorskej stránke' : 'Vašej stránke'}, ${userProfileData.displayName || userProfileData.email}!`
        ),
        React.createElement('p', { className: 'text-gray-600' },
          'Toto je generická šablóna obsahu. Ak chcete načítať iný obsah, upravte volanie `loadAndRenderMainContent` v `logged-in-template.html`.'
        )
      )
    )
  );
}

// Explicitne sprístupniť komponent globálne
window.MainContentApp = MainContentApp;
