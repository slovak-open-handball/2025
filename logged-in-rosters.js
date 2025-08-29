// logged-in-rosters.js
// Tento súbor predpokladá, že Firebase SDK verzie 9.x.x je inicializovaný v authentication.js
// a globálne funkcie ako window.auth, window.db, showGlobalLoader sú dostupné.

// Importy pre potrebné Firebase funkcie (modulárna syntax v9)
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";


/**
 * Lokálna funkcia pre zobrazenie notifikácií v tomto module.
 * Presunutá sem z logged-in-my-data.js pre nezávislosť štýlovania.
 * Aj keď sa v tejto verzii nepoužíva, je tu pre prípadné budúce využitie.
 */
function showLocalNotification(message, type = 'success') {
    let notificationElement = document.getElementById('local-notification');
    if (!notificationElement) {
        notificationElement = document.createElement('div');
        notificationElement.id = 'local-notification';
        notificationElement.className = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[99999] opacity-0 transition-opacity duration-300';
        document.body.appendChild(notificationElement);
    }

    const baseClasses = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[99999] transition-all duration-500 ease-in-out transform';
    let typeClasses = '';
    switch (type) {
        case 'success':
            typeClasses = 'bg-green-500 text-white';
            break;
        case 'error':
            typeClasses = 'bg-red-500 text-white';
            break;
        case 'info':
            typeClasses = 'bg-blue-500 text-white';
            break;
        default:
            typeClasses = 'bg-gray-700 text-white';
    }

    notificationElement.className = `${baseClasses} ${typeClasses} opacity-0 scale-95`;
    notificationElement.textContent = message;

    // Zobrazenie notifikácie
    setTimeout(() => {
        notificationElement.className = `${baseClasses} ${typeClasses} opacity-100 scale-100`;
    }, 10);

    // Skrytie notifikácie po 5 sekundách
    setTimeout(() => {
        notificationElement.className = `${baseClasses} ${typeClasses} opacity-0 scale-95`;
    }, 5000);
}


// Main React component for the logged-in-rosters.html page
function RostersApp() {
  const auth = getAuth(); 
  const db = getFirestore();     

  const [user, setUser] = React.useState(null); 
  const [userProfileData, setUserProfileData] = React.useState(null); 
  const [isAuthReady, setIsAuthReady] = React.useState(false); 
  const [teamsData, setTeamsData] = React.useState({}); // Nový stav pre dáta tímov

  // Loading stav pre používateľský profil
  const [loading, setLoading] = React.useState(true); 

  // Používateľské ID pre Firebase App ID
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'; 

  React.useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(currentUser => {
      setUser(currentUser);
      setIsAuthReady(true); 
    });

    const handleGlobalDataUpdated = (event) => {
      setUserProfileData(event.detail);
      if (window.hideGlobalLoader) {
        window.hideGlobalLoader();
      }
    };
    window.addEventListener('globalDataUpdated', handleGlobalDataUpdated);

    if (window.isGlobalAuthReady) {
        setIsAuthReady(true);
        setUser(auth.currentUser);
        if (window.globalUserProfileData) {
            setUserProfileData(window.globalUserProfileData);
            if (window.hideGlobalLoader) {
                window.hideGlobalLoader();
            }
        }
    }

    return () => {
      unsubscribeAuth();
      window.removeEventListener('globalDataUpdated', handleGlobalDataUpdated);
    };
  }, []); 

  React.useEffect(() => {
    let unsubscribeUserDoc;

    if (user && db && isAuthReady) {
      console.log(`RostersApp: Pokúšam sa načítať používateľský dokument pre UID: ${user.uid}`);
      setLoading(true); 

      try {
        const userDocRef = doc(db, 'users', user.uid);
        unsubscribeUserDoc = onSnapshot(userDocRef, docSnapshot => { 
          if (docSnapshot.exists()) { 
            const userData = docSnapshot.data();
            console.log("RostersApp: Používateľský dokument existuje, dáta:", userData); // Log celej dátovej štruktúry
            setUserProfileData(userData);
            
            // Extrahovanie a nastavenie dát tímov
            if (userData.teams) {
                setTeamsData(userData.teams);
            } else {
                setTeamsData({}); // Ak teams neexistuje, nastavíme prázdny objekt
            }

            setLoading(false);
          } else {
            console.warn("RostersApp: Používateľský dokument sa nenašiel pre UID:", user.uid);
            setLoading(false);
          }
        }, error => {
          console.error("RostersApp: Chyba pri načítaní používateľských dát z Firestore (onSnapshot error):", error);
          setLoading(false);
        });
      } catch (e) {
        console.error("RostersApp: Chyba pri nastavovaní onSnapshot pre používateľské dáta (try-catch):", e);
        setLoading(false);
      }
    } else if (isAuthReady && user === null) {
        setLoading(false);
        setUserProfileData(null);
        setTeamsData({});
    }

    return () => {
      if (unsubscribeUserDoc) {
        console.log("RostersApp: Ruším odber onSnapshot pre používateľský dokument.");
        unsubscribeUserDoc();
      }
    };
  }, [user, db, isAuthReady, auth]);


  if (!isAuthReady || !userProfileData) {
    // Ak autentifikácia alebo profil ešte nie sú pripravené, zobrazíme prázdnu stránku
    // alebo loader, ktorý je už v logged-in-rosters.html
    return null;
  }

  // Prevod objektu teamsData na pole pre jednoduchšie mapovanie vo React komponente
  const teamCategories = Object.entries(teamsData);

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
    React.createElement(
      'div',
      { className: 'w-full max-w-3xl p-4' },
      React.createElement(
        'div',
        { className: 'bg-white p-8 rounded-lg shadow-xl w-full' },
        React.createElement('h1', { className: 'text-3xl font-bold text-center text-gray-800 mb-6' },
          'Súpiska tímov'
        ),
        
        teamCategories.length > 0 ? (
          React.createElement('div', { className: 'space-y-4' },
            teamCategories.map(([categoryName, teamsArray]) => (
              React.createElement('div', { key: categoryName, className: 'bg-gray-50 p-4 rounded-lg shadow-sm' },
                React.createElement('h2', { className: 'text-xl font-semibold text-gray-700 mb-2' }, `${categoryName} (${teamsArray.length} tímov)`),
                React.createElement('div', { className: 'space-y-2 ml-4' },
                  teamsArray.map((team, index) => (
                    React.createElement('div', { key: index, className: 'border-l-4 border-blue-500 pl-4 py-2' },
                      React.createElement('p', { className: 'font-medium text-gray-800' }, `Názov tímu: ${team.teamName || 'Neznámy tím'}`),
                      React.createElement('p', { className: 'text-sm text-gray-600' }, `Počet hráčov: ${team.players || 0}`),
                      React.createElement('p', { className: 'text-sm text-gray-600' }, `Počet členov tímu (ženy): ${team.womenTeamMembers || 0}`),
                      React.createElement('p', { className: 'text-sm text-gray-600' }, `Počet členov tímu (muži): ${team.menTeamMembers || 0}`),
                      // Môžeš pridať ďalšie detaily tímu podľa potreby
                      // Napr. zobrazenie hráčov
                      team.playerDetails && team.playerDetails.length > 0 && (
                          React.createElement('div', { className: 'mt-2' },
                              React.createElement('h4', { className: 'text-md font-semibold text-gray-700' }, 'Hráči:'),
                              React.createElement('ul', { className: 'list-disc list-inside text-sm text-gray-600' },
                                  team.playerDetails.map((player, pIndex) => (
                                      React.createElement('li', { key: pIndex }, `${player.firstName} ${player.lastName} (číslo dresu: ${player.jerseyNumber || 'N/A'})`)
                                  ))
                              )
                          )
                      ),
                      // Zobrazenie členov tímu (ženy)
                      team.womenTeamMemberDetails && team.womenTeamMemberDetails.length > 0 && (
                          React.createElement('div', { className: 'mt-2' },
                              React.createElement('h4', { className: 'text-md font-semibold text-gray-700' }, 'Členky tímu (ženy):'),
                              React.createElement('ul', { className: 'list-disc list-inside text-sm text-gray-600' },
                                  team.womenTeamMemberDetails.map((member, mIndex) => (
                                      React.createElement('li', { key: mIndex }, `${member.firstName} ${member.lastName}`)
                                  ))
                              )
                          )
                      ),
                       // Zobrazenie členov tímu (muži)
                       team.menTeamMemberDetails && team.menTeamMemberDetails.length > 0 && (
                          React.createElement('div', { className: 'mt-2' },
                              React.createElement('h4', { className: 'text-md font-semibold text-gray-700' }, 'Členovia tímu (muži):'),
                              React.createElement('ul', { className: 'list-disc list-inside text-sm text-gray-600' },
                                  team.menTeamMemberDetails.map((member, mIndex) => (
                                      React.createElement('li', { key: mIndex }, `${member.firstName} ${member.lastName}`)
                                  ))
                              )
                          )
                      )
                    )
                  ))
                )
              )
            ))
          )
        ) : (
          React.createElement('p', { className: 'text-center text-gray-600' }, 'Zatiaľ neboli vytvorené žiadne tímy.')
        )
      )
    )
  );
}

// Explicitne sprístupniť komponent globálne
window.RostersApp = RostersApp;
