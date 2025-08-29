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

  // Helper funkcia na konsolidáciu všetkých členov tímu do jedného poľa
  const getAllTeamMembers = (team) => {
    const members = [];

    // Hráči
    if (team.playerDetails && team.playerDetails.length > 0) {
      team.playerDetails.forEach(player => {
        members.push({
          type: 'Hráč',
          firstName: player.firstName,
          lastName: player.lastName,
          jerseyNumber: player.jerseyNumber
        });
      });
    }

    // Členovia realizačného tímu (muži)
    if (team.menTeamMemberDetails && team.menTeamMemberDetails.length > 0) {
      team.menTeamMemberDetails.forEach(member => {
        members.push({
          type: 'Člen realizačného tímu (muž)',
          firstName: member.firstName,
          lastName: member.lastName
        });
      });
    }

    // Členky realizačného tímu (ženy)
    if (team.womenTeamMemberDetails && team.womenTeamMemberDetails.length > 0) {
      team.womenTeamMemberDetails.forEach(member => {
        members.push({
          type: 'Člen realizačného tímu (žena)',
          firstName: member.firstName,
          lastName: member.lastName
        });
      });
    }

    // Šofér (žena)
    if (team.driverDetailsFemale && team.driverDetailsFemale.length > 0) {
      team.driverDetailsFemale.forEach(driver => {
        members.push({
          type: 'Šofér (žena)',
          firstName: driver.firstName,
          lastName: driver.lastName
        });
      });
    }

    // Šofér (muž)
    if (team.driverDetailsMale && team.driverDetailsMale.length > 0) {
      team.driverDetailsMale.forEach(driver => {
        members.push({
          type: 'Šofér (muž)',
          firstName: driver.firstName,
          lastName: driver.lastName
        });
      });
    }

    return members;
  };

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
          React.createElement('div', { className: 'space-y-6' }, // Väčší priestor medzi kategóriami
            teamCategories.map(([categoryName, teamsArray]) => (
              React.createElement('div', { key: categoryName, className: 'bg-gray-50 p-6 rounded-lg shadow-md' }, // Väčší padding a shadow
                React.createElement('h2', { className: 'text-2xl font-bold text-gray-800 mb-4' }, `${categoryName} (${teamsArray.length} tímov)`), // Väčší a tučnejší nadpis
                React.createElement('div', { className: 'space-y-6' }, // Priestor medzi jednotlivými tímami v kategórii
                  teamsArray.map((team, index) => {
                    const allMembers = getAllTeamMembers(team);
                    
                    // Extrahovanie informácií o doprave, ubytovaní a balíku
                    const arrivalType = team.arrival?.type || 'Nezadané';
                    const accommodationType = team.accommodation?.type || 'Nezadané';
                    const packageName = team.packageDetails?.name || 'Nezadané';
                    
                    // Upravená podmienka pre čas príchodu s pridaným "hod."
                    const arrivalTime = (
                        (arrivalType === "verejná doprava - autobus" || arrivalType === "verejná doprava - vlak") && team.arrival?.time
                    ) ? ` (čas: ${team.arrival.time} hod.)` : '';


                    return React.createElement('div', { key: index, className: 'border-l-4 border-[#9333EA] pl-4 py-4 bg-white rounded-md shadow-sm' }, // Zmenená farba na #9333EA
                      React.createElement('p', { className: 'text-xl font-semibold text-gray-900 mb-2' }, `Názov tímu: ${team.teamName || 'Neznámy tím'}`),
                      React.createElement('p', { className: 'text-md text-gray-700' }, `Počet hráčov: ${team.players || 0}`),
                      React.createElement('p', { className: 'text-md text-gray-700 mb-2' }, `Členovia tímu: ${team.womenTeamMembers + team.menTeamMembers || 0}`),
                      
                      // Nové informácie o doprave, ubytovaní a balíku
                      React.createElement('p', { className: 'text-md text-gray-700' }, `Typ dopravy: ${arrivalType}${arrivalTime}`),
                      React.createElement('p', { className: 'text-md text-gray-700' }, `Typ ubytovania: ${accommodationType}`),
                      React.createElement('p', { className: 'text-md text-gray-700 mb-4' }, `Balík: ${packageName}`),


                      allMembers.length > 0 && (
                        React.createElement('div', { className: 'mt-4' },
                          React.createElement('h4', { className: 'text-lg font-bold text-gray-800 mb-3' }, 'Zoznam členov:'),
                          React.createElement('div', { className: 'overflow-x-auto' }, // Pre responsive tabuľku
                            React.createElement('table', { className: 'min-w-full bg-white border border-gray-200 rounded-lg' },
                              React.createElement('thead', null,
                                React.createElement('tr', { className: 'bg-gray-100 text-left text-sm font-medium text-gray-600 uppercase tracking-wider' },
                                  React.createElement('th', { className: 'py-3 px-4 border-b-2 border-gray-200' }, 'Typ člena'),
                                  React.createElement('th', { className: 'py-3 px-4 border-b-2 border-gray-200' }, 'Meno'),
                                  React.createElement('th', { className: 'py-3 px-4 border-b-2 border-gray-200' }, 'Priezvisko'),
                                  React.createElement('th', { className: 'py-3 px-4 border-b-2 border-gray-200' }, 'Číslo dresu (len hráč)'),
                                )
                              ),
                              React.createElement('tbody', { className: 'divide-y divide-gray-200' },
                                allMembers.map((member, mIndex) => (
                                  React.createElement('tr', { key: mIndex, className: 'hover:bg-gray-50' },
                                    React.createElement('td', { className: 'py-3 px-4 whitespace-nowrap text-sm text-gray-800' }, member.type),
                                    React.createElement('td', { className: 'py-3 px-4 whitespace-nowrap text-sm text-gray-800' }, member.firstName || '-'),
                                    React.createElement('td', { className: 'py-3 px-4 whitespace-nowrap text-sm text-gray-800' }, member.lastName || '-'),
                                    React.createElement('td', { className: 'py-3 px-4 whitespace-nowrap text-sm text-gray-600' }, member.jerseyNumber || '-'),
                                  )
                                ))
                              )
                            )
                          )
                        )
                      )
                    )
                  })
                )
              )
            ))
          )
        ) : (
          React.createElement('p', { className: 'text-center text-gray-600 text-lg py-8' }, 'Zatiaľ neboli vytvorené žiadne tímy pre tohto používateľa.')
        )
      )
    )
  );
}

// Explicitne sprístupniť komponent globálne
window.RostersApp = RostersApp;
