// logged-in-tournament-settings.js
// Tento súbor predpokladá, že Firebase SDK verzie 9.x.x je inicializovaný v authentication.js
// a globálne funkcie ako window.auth, window.db, window.showGlobalNotification a window.showGlobalLoader sú dostupné.

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
  const [error, setError] = React.useState('');

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
            setError(''); // Clear errors after successful load

          } else {
            console.warn("TournamentSettingsApp: Používateľský dokument sa nenašiel pre UID:", user.uid);
            if (typeof window.showGlobalNotification === 'function') {
                window.showGlobalNotification("Chyba: Používateľský profil sa nenašiel. Skúste sa prosím znova prihlásiť.", 'error');
            }
            setLoading(false);
            auth.signOut(); // Odhlásiť používateľa
            setUser(null);
            setUserProfileData(null);
          }
        }, error => {
          console.error("TournamentSettingsApp: Chyba pri načítaní používateľských dát z Firestore (onSnapshot error):", error);
          if (typeof window.showGlobalNotification === 'function') {
            window.showGlobalNotification(`Chyba pri načítaní používateľských dát: ${error.message}`, 'error');
          }
          setLoading(false);
          auth.signOut();
          setUser(null);
          setUserProfileData(null);
        });
      } catch (e) {
        console.error("TournamentSettingsApp: Chyba pri nastavovaní onSnapshot pre používateľské dáta (try-catch):", e);
        if (typeof window.showGlobalNotification === 'function') {
            window.showGlobalNotification(`Chyba pri nastavovaní poslucháča pre používateľské dáta: ${e.message}`, 'error');
        }
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
            setError(`Chyba pri načítaní nastavení: ${error.message}`);
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
          setError(`Chyba pri nastavovaní poslucháča pre nastavenia: ${e.message}`);
          setSettingsLoaded(true);
          setLoading(false);
      }
    };

    fetchSettings();
  }, [db, userProfileData]); // Závisí od db a userProfileData (pre rolu)


  const handleUpdateRegistrationSettings = async (e) => {
    e.preventDefault();
    if (!db || !userProfileData || userProfileData.role !== 'admin') {
      if (typeof window.showGlobalNotification === 'function') {
        window.showGlobalNotification("Nemáte oprávnenie na zmenu nastavení registrácie.", 'error');
      }
      return;
    }
    setLoading(true);
    setError('');
    
    try {
      const regStart = registrationStartDate ? new Date(registrationStartDate) : null;
      const regEnd = registrationEndDate ? new Date(registrationEndDate) : null;
      const dataEditDead = dataEditDeadline ? new Date(dataEditDeadline) : null; 

      if (regStart && regEnd && regStart >= regEnd) {
        setError("Dátum začiatku registrácie musí byť pred dátumom konca registrácie.");
        setLoading(false);
        return;
      }
      if (dataEditDead && regEnd && dataEditDead < regEnd) {
        setError("Dátum uzávierky úprav dát nemôže byť pred dátumom konca registrácie.");
        setLoading(false);
        return;
      }

      const settingsDocRef = doc(db, 'settings', 'registration');
      await setDoc(settingsDocRef, {
        registrationStartDate: regStart ? Timestamp.fromDate(regStart) : null,
        registrationEndDate: regEnd ? Timestamp.fromDate(regEnd) : null,
        dataEditDeadline: dataEditDead ? Timestamp.fromDate(dataEditDead) : null, 
      });
      
      if (typeof window.showGlobalNotification === 'function') {
        window.showGlobalNotification("Nastavenia registrácie úspešne aktualizované!", 'success');
      }

    } catch (e) {
      console.error("TournamentSettingsApp: Chyba pri aktualizácii nastavení registrácie:", e);
      setError(`Chyba pri aktualizácii nastavenia: ${e.message}`);
      if (typeof window.showGlobalNotification === 'function') {
        window.showGlobalNotification(`Chyba pri aktualizácii nastavenia: ${e.message}`, 'error');
      }
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
    error && React.createElement(
      'div',
      { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap', role: 'alert' },
      error
    ),
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
