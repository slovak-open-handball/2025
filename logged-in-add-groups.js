// logged-in-add-groups.js
// Tento súbor obsahuje React komponent pre správu nastavení prihláseného používateľa.
// Predpokladá, že Firebase SDK je inicializovaný v authentication.js a globálne sprístupnený.

// Importy pre modulárny Firestore
import { doc, updateDoc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// Main React component for the logged-in-my-settings.html page
function MySettingsApp() {
  // Prístup k globálnym inštanciám Firebase z window objektu
  const auth = window.auth;
  const db = window.db;

  // Lokálne stavy pre data používateľa a načítanie
  const [user, setUser] = React.useState(null); // Bude aktualizované z globalDataUpdated
  const [userProfileData, setUserProfileData] = React.useState(null);
  const [loading, setLoading] = React.useState(true); // Loading pre data v MySettingsApp
  const [error, setError] = React.useState(''); // Lokálny stav pre chybové správy
  const [successMessage, setSuccessMessage] = React.useState('');

  // Efekt pre počúvanie globálnych zmien autentifikácie a dát profilu
  React.useEffect(() => {
    const handleGlobalDataUpdated = (event) => {
      console.log("MySettingsApp: Prijatá udalosť 'globalDataUpdated'.");
      const globalUser = auth.currentUser; // Získame aktuálneho používateľa priamo z globálneho auth
      const globalProfileData = event.detail;

      setUser(globalUser);
      setUserProfileData(globalProfileData);
      setLoading(false); // Ukončíme loading, keď sú dáta prijaté

      if (!globalUser) {
        console.log("MySettingsApp: Používateľ je odhlásený. Presmerovávam.");
        if (window.location.pathname.includes('/logged-in-')) {
            window.location.href = 'login.html';
        }
        return;
      }

      if (globalProfileData) {
        console.log(`MySettingsApp: Spracovávam profilové dáta pre UID: ${globalUser.uid}`);
        
        // Logika pre presmerovanie 'user' role
        if (globalProfileData.role === 'user') {
            console.log("MySettingsApp: Používateľ má rolu 'user'. Presmerovávam na logged-in-my-data.html.");
            window.location.href = 'logged-in-my-data.html';
            return;
        }
        
        setError(''); // Vyčistí chyby po úspešnom načítaní
        setSuccessMessage('');
      } else {
        console.warn("MySettingsApp: Profilové dáta používateľa nie sú dostupné.");
        setError("Chyba: Profil používateľa nebol nájdený alebo nemáte dostatočné povolenia.");
        setSuccessMessage(''); 
      }
    };

    // Pridanie listenera pre globálne aktualizácie dát
    window.addEventListener('globalDataUpdated', handleGlobalDataUpdated);

    // Initial check if data is already available (e.g., after a page refresh)
    if (window.isGlobalAuthReady && window.globalUserProfileData) {
      console.log("MySettingsApp: Initial check - globálne dáta sú už pripravené.");
      handleGlobalDataUpdated({ detail: window.globalUserProfileData });
    } else if (window.isGlobalAuthReady && !window.globalUserProfileData && auth.currentUser) {
      console.warn("MySettingsApp: Initial check - Firebase Auth je pripravený, ale globalUserProfileData chýba pre prihláseného používateľa.");
      setError("Chyba: Váš profil sa nepodarilo načítať. Skúste sa prosím odhlásiť a znova prihlásiť.");
      setLoading(false);
    } else if (window.isGlobalAuthReady && !auth.currentUser) {
        console.log("MySettingsApp: Initial check - používateľ nie je prihlásený, ale globalAuthReady je true.");
        setLoading(false); // Ak nie je prihlásený, nie je čo načítavať
    }
    
    return () => {
      window.removeEventListener('globalDataUpdated', handleGlobalDataUpdated);
    };
  }, [auth, db]); // Závisí od globálnych inštancií auth a db

  // Renderovanie loadera, ak je stav `loading` true
  if (loading) {
    return React.createElement(
      'div',
      { className: 'flex justify-center items-center h-screen pt-16' },
      React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
    );
  }

  // Ak existuje chyba alebo úspešná správa, zobrazíme ju ako pop-up
  const notificationElement = (error || successMessage) && React.createElement(
    'div',
    { 
      className: `fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-lg shadow-lg text-white text-center transition-all duration-300 transform 
                  ${error ? 'bg-red-500' : 'bg-green-500'}`,
      role: 'alert' 
    },
    error && React.createElement('strong', { className: 'font-bold' }, 'Chyba! '),
    successMessage && React.createElement('strong', { className: 'font-bold' }, ''),
    React.createElement('span', { className: 'block sm:inline' }, error || successMessage)
  );

  // Hlavné vykreslenie komponentu
  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
    React.createElement(
      'div',
      { className: 'w-full max-w-4xl mt-20 mb-10 p-4' },
      notificationElement,
      React.createElement(
        'div',
        { className: 'bg-white p-8 rounded-lg shadow-xl w-full' },
        React.createElement('h1', { className: 'text-3xl font-bold text-center text-gray-800 mb-6' },
          'Vytvorenie skupín'
        ),
        React.createElement(
          React.Fragment,
          null,
          // Sem príde logika pre vytváranie skupín, zatiaľ je to prázdne
          React.createElement('p', {className: 'text-center text-gray-600'}, 'Táto sekcia bude slúžiť na vytváranie a správu skupín.')
        )
      )
    )
  );
}

// Explicitne sprístupníme komponent globálne
window.MySettingsApp = MySettingsApp;
