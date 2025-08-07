// logged-in-tournament-settings.js
// Tento súbor predpokladá, že Firebase SDK verzie 9.x.x je inicializovaný v authentication.js
// a globálne funkcie ako window.auth, window.db, window.showGlobalLoader sú dostupné.

// Importy pre potrebné Firebase funkcie (modulárna syntax v9)
import { getFirestore, doc, onSnapshot, setDoc, collection, addDoc, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";


// Helper function to format a Date object into 'YYYY-MM-DDTHH:mm' local string
const formatToDatetimeLocal = (date) => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

/**
 * Lokálna funkcia pre zobrazenie notifikácií v tomto module.
 * Vytvorí a spravuje modálne okno pre správy o úspechu alebo chybách.
 * Používa rovnaké štýly ako globálna notifikácia v logged-in-my-data.js.
 */
const showLocalNotification = (message, type = 'success') => {
    let notificationElement = document.getElementById('global-notification'); 
    
    // Ak element ešte neexistuje, vytvoríme ho a pridáme do tela dokumentu
    if (!notificationElement) {
        notificationElement = document.createElement('div');
        notificationElement.id = 'global-notification';
        document.body.appendChild(notificationElement);
    }

    // Základné triedy pre pozíciu a prechod, rovnaké ako v logged-in-my-data.js
    const baseClasses = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[99999] transition-all duration-500 ease-in-out transform flex items-center space-x-2';
    let typeClasses = '';

    // Nastavíme farbu pozadia na základe typu notifikácie
    if (type === 'success') {
        typeClasses = 'bg-[#3A8D41] text-white'; // Zelená pre úspech
    } else if (type === 'error') {
        typeClasses = 'bg-red-600 text-white'; // Červená pre chybu
    } else {
        typeClasses = 'bg-blue-500 text-white'; // Predvolená modrá pre info
    }

    // Nastavíme triedy elementu
    notificationElement.className = `${baseClasses} ${typeClasses} opacity-0 scale-95`;
    notificationElement.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            ${type === 'success' 
                ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />'
                : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />'}
        </svg>
        <span>${message}</span>
    `;

    // Zobrazenie notifikácie
    setTimeout(() => {
        notificationElement.classList.add('opacity-100', 'scale-100', 'pointer-events-auto');
    }, 10);

    // Skrytie notifikácie po 7.5 sekundách (aby sa zhodovalo s globálnou)
    setTimeout(() => {
        notificationElement.classList.remove('opacity-100', 'scale-100', 'pointer-events-auto');
    }, 7500);
};


// Main React component for the logged-in-tournament-settings.html page
function TournamentSettingsApp() {
  // Získame referencie na Firebase služby z globálnych premenných
  const auth = window.auth; 
  const db = window.db;     

  // Lokálny stav pre aktuálneho používateľa a jeho profilové dáta
  const [user, setUser] = React.useState(auth ? auth.currentUser : null); 
  const [userProfileData, setUserProfileData] = React.useState(window.globalUserProfileData); 
  const [isAuthReady, setIsAuthReady] = React.useState(window.isGlobalAuthReady); 

  const [loading, setLoading] = React.useState(true); // Loading pre dáta v TournamentSettingsApp

  // States for date and time settings
  const [registrationStartDate, setRegistrationStartDate] = React.useState('');
  const [registrationEndDate, setRegistrationEndDate] = React.useState('');
  const [dataEditDeadline, setDataEditDeadline] = React.useState(''); // NOVÝ STAV: Dátum uzávierky úprav dát
  const [settingsLoaded, setSettingsLoaded] = React.useState(false);

  // Effect pre inicializáciu a sledovanie globálneho stavu autentifikácie a profilu
  React.useEffect(() => {
    // Listener pre globalDataUpdated z authentication.js
    const handleGlobalDataUpdated = (event) => {
      setUser(auth.currentUser); // Aktualizujeme user state
      setUserProfileData(event.detail);
      setIsAuthReady(true); // Auth je pripravené
      // Skrytie globálneho loaderu po načítaní profilových dát
      if (window.hideGlobalLoader) {
        window.hideGlobalLoader();
      }
    };
    window.addEventListener('globalDataUpdated', handleGlobalDataUpdated);

    // Počiatočné nastavenie, ak už sú dáta dostupné
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
      window.removeEventListener('globalDataUpdated', handleGlobalDataUpdated);
    };
  }, [auth]); // Závisí od auth inštancie

  // Effect pre načítanie používateľských dát z Firestore a kontrolu roly
  React.useEffect(() => {
    let unsubscribeUserDoc;

    if (user && db && isAuthReady) {
      console.log(`TournamentSettingsApp: Pokúšam sa načítať používateľský dokument pre UID: ${user.uid}`);
      setLoading(true); // Nastavíme loading na true, kým sa načítajú dáta profilu

      try {
        const userDocRef = doc(db, 'users', user.uid);
        unsubscribeUserDoc = onSnapshot(userDocRef, docSnapshot => {
          console.log("TournamentSettingsApp: onSnapshot pre používateľský dokument spustený.");
          if (docSnapshot.exists()) {
            const userData = docSnapshot.data();
            console.log("TournamentSettingsApp: Používateľský dokument existuje, dáta:", userData);

            // Ak používateľ nie je admin, presmerujeme ho
            if (userData.role !== 'admin') {
                console.log("TournamentSettingsApp: Používateľ nie je admin, presmerovávam na logged-in-my-data.html.");
                window.location.href = 'logged-in-my-data.html';
                return; // Ukončíme funkciu po presmerovaní
            }

            setUserProfileData(userData); // Update userProfileData state
            setLoading(false); // Stop loading after user data is loaded

          } else {
            console.warn("TournamentSettingsApp: Používateľský dokument sa nenašiel pre UID:", user.uid);
            showLocalNotification("Chyba: Používateľský profil sa nenašiel. Skúste sa prosím znova prihlásiť.", 'error');
            setLoading(false);
            auth.signOut(); // Odhlásiť používateľa
            setUser(null);
            setUserProfileData(null);
          }
        }, error => {
          console.error("TournamentSettingsApp: Chyba pri načítaní používateľských dát z Firestore (onSnapshot error):", error);
          showLocalNotification(`Chyba pri načítaní používateľských dát: ${error.message}`, 'error');
          setLoading(false);
          auth.signOut();
          setUser(null);
          setUserProfileData(null);
        });
      } catch (e) {
        console.error("TournamentSettingsApp: Chyba pri nastavovaní onSnapshot pre používateľské dáta (try-catch):", e);
        showLocalNotification(`Chyba pri nastavovaní poslucháča pre používateľské dáta: ${e.message}`, 'error');
        setLoading(false);
        auth.signOut();
        setUser(null);
        setUserProfileData(null);
      }
    } else if (isAuthReady && user === null) {
        setLoading(false);
        setUserProfileData(null);
    }

    return () => {
      if (unsubscribeUserDoc) {
        console.log("TournamentSettingsApp: Ruším odber onSnapshot pre používateľský dokument.");
        unsubscribeUserDoc();
      }
    };
  }, [user, db, isAuthReady, auth]);

  // Effect for loading settings (runs after DB and Auth are initialized and user is admin)
  React.useEffect(() => {
    let unsubscribeSettings;
    const fetchSettings = async () => {
      if (!db || !userProfileData || userProfileData.role !== 'admin') {
        console.log("TournamentSettingsApp: Čakám na DB alebo admin rolu pre načítanie nastavení.");
        return; 
      }
      try {
          console.log("TournamentSettingsApp: Pokúšam sa načítať nastavenia registrácie.");
          const settingsDocRef = doc(db, 'settings', 'registration');
          unsubscribeSettings = onSnapshot(settingsDocRef, docSnapshot => {
            console.log("TournamentSettingsApp: onSnapshot pre nastavenia registrácie spustený.");
            if (docSnapshot.exists()) {
                const data = docSnapshot.data();
                console.log("TournamentSettingsApp: Nastavenia registrácie existujú, dáta:", data);
                setRegistrationStartDate(data.registrationStartDate ? formatToDatetimeLocal(data.registrationStartDate.toDate()) : '');
                setRegistrationEndDate(data.registrationEndDate ? formatToDatetimeLocal(data.registrationEndDate.toDate()) : '');
                setDataEditDeadline(data.dataEditDeadline ? formatToDatetimeLocal(data.dataEditDeadline.toDate()) : ''); 
            } else {
                console.log("TournamentSettingsApp: Nastavenia registrácie sa nenašli v Firestore. Používajú sa predvolené prázdne hodnoty.");
                setRegistrationStartDate('');
                setRegistrationEndDate('');
                setDataEditDeadline(''); 
            }
            setSettingsLoaded(true);
            setLoading(false); // Nastavenia sú načítané, aj keď prázdne
            console.log("TournamentSettingsApp: Načítanie nastavení dokončené, settingsLoaded: true.");
          }, error => {
            console.error("TournamentSettingsApp: Chyba pri načítaní nastavení registrácie (onSnapshot error):", error);
            showLocalNotification(`Chyba pri načítaní nastavení: ${error.message}`, 'error');
            setSettingsLoaded(true); 
            setLoading(false);
          });

          return () => {
            if (unsubscribeSettings) {
                console.log("TournamentSettingsApp: Ruším odber onSnapshot pre nastavenia registrácie.");
                unsubscribeSettings();
            }
          };
      } catch (e) {
          console.error("TournamentSettingsApp: Chyba pri nastavovaní onSnapshot pre nastavenia registrácie (try-catch):", e);
          showLocalNotification(`Chyba pri nastavovaní poslucháča pre nastavenia: ${e.message}`, 'error');
          setSettingsLoaded(true);
          setLoading(false);
      }
    };

    fetchSettings();
  }, [db, userProfileData]); // Závisí od db a userProfileData (pre rolu)


  const handleUpdateRegistrationSettings = async (e) => {
    e.preventDefault();
    if (!db || !userProfileData || userProfileData.role !== 'admin') {
      showLocalNotification("Nemáte oprávnenie na zmenu nastavení registrácie.", 'error');
      return;
    }
    setLoading(true);
    
    try {
      const regStart = registrationStartDate ? new Date(registrationStartDate) : null;
      const regEnd = registrationEndDate ? new Date(registrationEndDate) : null;
      const dataEditDead = dataEditDeadline ? new Date(dataEditDeadline) : null; 

      if (regStart && regEnd && regStart >= regEnd) {
        showLocalNotification("Dátum začiatku registrácie musí byť pred dátumom konca registrácie.", 'error');
        setLoading(false);
        return;
      }
      if (dataEditDead && regEnd && dataEditDead < regEnd) {
        showLocalNotification("Dátum uzávierky úprav dát nemôže byť pred dátumom konca registrácie.", 'error');
        setLoading(false);
        return;
      }

      const settingsDocRef = doc(db, 'settings', 'registration');
      await setDoc(settingsDocRef, {
        registrationStartDate: regStart ? Timestamp.fromDate(regStart) : null,
        registrationEndDate: regEnd ? Timestamp.fromDate(regEnd) : null,
        dataEditDeadline: dataEditDead ? Timestamp.fromDate(dataEditDead) : null, 
      });
      
      showLocalNotification("Nastavenia registrácie úspešne aktualizované!", 'success');

    } catch (e) {
      console.error("TournamentSettingsApp: Chyba pri aktualizácii nastavení registrácie:", e);
      showLocalNotification(`Chyba pri aktualizácii nastavenia: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Display loading state
  if (!isAuthReady || loading || !userProfileData) {
    return React.createElement(
      'div',
      { className: 'flex items-center justify-center min-h-screen bg-gray-100' },
      React.createElement('div', { className: 'text-xl font-semibold text-gray-700' }, 'Načítavam nastavenia...')
    );
  }

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
    React.createElement(
      'div',
      { className: 'w-full max-w-4xl mt-20 mb-10 p-4' },
      React.createElement(
        'div',
        { className: 'bg-white p-8 rounded-lg shadow-xl w-full' },
        React.createElement('h1', { className: 'text-3xl font-bold text-center text-gray-800 mb-6' },
          'Nastavenia turnaja'
        ),
        React.createElement(
          'form',
          { onSubmit: handleUpdateRegistrationSettings, className: 'space-y-4' },
          React.createElement(
            'div',
            null,
            React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'reg-start-date' }, 'Dátum a čas začiatku registrácie'),
            React.createElement('input', {
              type: 'datetime-local',
              id: 'reg-start-date',
              className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
              value: registrationStartDate,
              onChange: (e) => setRegistrationStartDate(e.target.value),
              disabled: loading,
            })
          ),
          React.createElement(
            'div',
            null,
            React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'reg-end-date' }, 'Dátum a čas konca registrácie'),
            React.createElement('input', {
              type: 'datetime-local',
              id: 'reg-end-date',
              className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
              value: registrationEndDate,
              onChange: (e) => setRegistrationEndDate(e.target.value),
              disabled: loading,
            })
          ),
          React.createElement(
            'div',
            null,
            React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'data-edit-deadline' }, 'Dátum a čas uzávierky úprav používateľských dát'),
            React.createElement('input', {
              type: 'datetime-local',
              id: 'data-edit-deadline',
              className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
              value: dataEditDeadline,
              onChange: (e) => setDataEditDeadline(e.target.value),
              disabled: loading,
            })
          ),
          React.createElement(
            'button',
            {
              type: 'submit',
              className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200',
              disabled: loading,
            },
            loading ? 'Ukladám...' : 'Aktualizovať nastavenia'
          )
        )
      )
    )
  );
}

// Explicitne sprístupniť komponent globálne
window.TournamentSettingsApp = TournamentSettingsApp;
