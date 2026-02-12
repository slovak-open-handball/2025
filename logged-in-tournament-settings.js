import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, setDoc, Timestamp, updateDoc, arrayUnion, arrayRemove, getDoc, collection, addDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Import komponentov nastavení
import { GeneralRegistrationSettings } from './logged-in-tournament-settings-general-registration-settings.js';
import { TShirtSizeSettings } from './logged-in-tournament-settings-t-shirt-size-settings.js';
import { AccommodationSettings } from './logged-in-tournament-settings-accommodation-settings.js';
import { PackageSettings } from './logged-in-tournament-settings-package-settings.js';
import { CategorySettings } from './logged-in-tournament-settings-category-settings.js';


function TournamentSettingsApp() {
  const auth = getAuth(); 
  const db = getFirestore();     

  const [user, setUser] = React.useState(null); 
  const [userProfileData, setUserProfileData] = React.useState(null); 
  const [isAuthReady, setIsAuthReady] = React.useState(false); 

  const [tournamentStartDate, setTournamentStartDate] = React.useState('');
  const [tournamentEndDate, setTournamentEndDate] = React.useState('');
  const [activeSetting, setActiveSetting] = React.useState(null); // Nový stav pre aktívne nastavenie

  const settingComponents = [
    { id: 'general', title: 'Všeobecné nastavenia registrácie', component: GeneralRegistrationSettings },
    { id: 'tshirt', title: 'Nastavenia veľkostí tričiek', component: TShirtSizeSettings },
    { id: 'accommodation', title: 'Nastavenia ubytovania', component: AccommodationSettings },
    { id: 'package', title: 'Nastavenia balíčkov', component: PackageSettings },
    { id: 'categories', title: 'Nastavenia kategórií', component: CategorySettings },
  ];

  // Funkcia na aktualizáciu URL hashu
  const updateUrlHash = (settingId) => {
    if (settingId) {
      window.location.hash = settingId;
    } else {
      window.location.hash = '';
    }
  };

  // Funkcia na získanie nastavenia z URL hashu
  const getSettingFromHash = () => {
    const hash = window.location.hash.slice(1); // Odstránime #
    if (hash && settingComponents.some(s => s.id === hash)) {
      return hash;
    }
    return null;
  };

  // Handler pre zmenu aktívneho nastavenia
  const handleSetActiveSetting = (settingId) => {
    setActiveSetting(settingId);
    updateUrlHash(settingId);
  };

  // Handler pre návrat na hlavnú stránku
  const handleBackToMain = () => {
    setActiveSetting(null);
    updateUrlHash(null);
  };

  // Načítanie nastavenia z URL pri inicializácii
  React.useEffect(() => {
    if (isAuthReady && userProfileData?.role === 'admin') {
      const settingFromHash = getSettingFromHash();
      if (settingFromHash) {
        setActiveSetting(settingFromHash);
      }
    }
  }, [isAuthReady, userProfileData]);

  // Reakcia na zmenu URL hashu (napr. pri použití tlačidla späť v prehliadači)
  React.useEffect(() => {
    const handleHashChange = () => {
      if (isAuthReady && userProfileData?.role === 'admin') {
        const settingFromHash = getSettingFromHash();
        setActiveSetting(settingFromHash);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [isAuthReady, userProfileData]);

  React.useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(currentUser => {
      setUser(currentUser);
      setIsAuthReady(true); 
      if (!currentUser) {
        window.location.href = 'login.html';
      }
    });

    const handleGlobalDataUpdated = (event) => {
      setUserProfileData(event.detail);
    };
    window.addEventListener('globalDataUpdated', handleGlobalDataUpdated);

    if (window.isGlobalAuthReady) {
        setIsAuthReady(true);
        setUser(auth.currentUser);
        if (window.globalUserProfileData) {
            setUserProfileData(window.globalUserProfileData);
        }
    }

    return () => {
      unsubscribeAuth();
      window.removeEventListener('globalDataUpdated', handleGlobalDataUpdated);
    };
  }, [auth]); 

  React.useEffect(() => {
    let unsubscribeUserDoc;

    if (user && db && isAuthReady) {

      try {
        const userDocRef = doc(db, 'users', user.uid);
        unsubscribeUserDoc = onSnapshot(userDocRef, docSnapshot => {
          if (docSnapshot.exists()) {
            const userData = docSnapshot.data();

            if (userData.role !== 'admin') {
                window.location.href = 'logged-in-my-data.html';
                return; 
            }

            setUserProfileData(userData); 
          } else {
            showNotification("Chyba: Používateľský profil sa nenašiel. Skúste sa prosím znova prihlásiť.", 'error'); 
            auth.signOut(); 
            setUser(null);
            setUserProfileData(null);
          }
        }, error => {
          showNotification(`Chyba pri načítaní používateľských dát: ${error.message}`, 'error'); 
          auth.signOut();
          setUser(null);
          setUserProfileData(null);
        });
      } catch (e) {
        showNotification(`Chyba pri nastavovaní poslucháča pre používateľské dáta: ${e.message}`, 'error'); 
        auth.signOut();
        setUser(null);
        setUserProfileData(null);
      }
    } 
    else if (isAuthReady && user === null) {
    }

    return () => {
      if (unsubscribeUserDoc) {
        unsubscribeUserDoc();
      }
    };
  }, [user, db, isAuthReady, auth]);

    React.useEffect(() => {
        let unsubscribeSettings;
        const fetchTournamentDates = () => {
            if (!db || !userProfileData || userProfileData.role !== 'admin') {
                return;
            }
            try {
                const settingsDocRef = doc(db, 'settings', 'registration');
                unsubscribeSettings = onSnapshot(settingsDocRef, docSnapshot => {
                    if (docSnapshot.exists()) {
                        const data = docSnapshot.data();
                        setTournamentStartDate(data.tournamentStart ? formatToDatetimeLocal(data.tournamentStart.toDate()) : '');
                        setTournamentEndDate(data.tournamentEnd ? formatToDatetimeLocal(data.tournamentEnd.toDate()) : '');
                    } else {
                        setTournamentStartDate('');
                        setTournamentEndDate('');
                    }
                }, error => {
                    showNotification(`Chyba pri načítaní dátumov turnaja: ${error.message}`, 'error');
                });
            } catch (e) {
                showNotification(`Chyba pri nastavovaní poslucháča pre dátumy turnaja: ${e.message}`, 'error');
            }
        };

        fetchTournamentDates();

        return () => {
            if (unsubscribeSettings) {
                unsubscribeSettings();
            }
        };
    }, [db, userProfileData]);


  if (!userProfileData || userProfileData.role !== 'admin') {
    return null; 
  }

  return React.createElement(
    'div',
    { className: 'bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl mx-auto space-y-8' }, 
    React.createElement('h1', { className: 'text-3xl font-bold text-center text-gray-800 mb-6' },
      'Nastavenia turnaja'
    ),
    
    activeSetting ? (
      React.createElement(
        React.Fragment,
        null,
        React.createElement(
          'div',
          { className: 'flex items-center mb-4' },
          React.createElement(
            'button',
            {
              type: 'button',
              onClick: handleBackToMain, // Použitie novej funkcie
              className: 'bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200 flex items-center'
            },
            React.createElement('svg', { className: 'h-4 w-4 mr-2', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
              React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M10 19l-7-7m0 0l7-7m-7 7h18' })
            ),
            'Späť'
          )
        ),
        React.createElement(
          settingComponents.find(s => s.id === activeSetting).component,
          {
            db: db,
            userProfileData: userProfileData,
            tournamentStartDate: tournamentStartDate,
            setTournamentStartDate: setTournamentStartDate,
            tournamentEndDate: tournamentEndDate,
            setTournamentEndDate: setTournamentEndDate,
            showNotification: showNotification,
            sendAdminNotification: (notificationData) => sendAdminNotification(db, auth, notificationData),
            formatDateForDisplay: formatDateForDisplay,
            formatToDatetimeLocal: formatToDatetimeLocal,
          }
        )
      )
    ) : (
      React.createElement(
        'div',
        { className: 'space-y-4' },
        settingComponents.map(setting => (
          React.createElement(
            'button',
            {
              key: setting.id,
              onClick: () => handleSetActiveSetting(setting.id), // Použitie novej funkcie
              className: 'w-full text-left bg-blue-500 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg shadow-md transition-colors duration-200 text-xl'
            },
            setting.title
          )
        ))
      )
    )
  );
}

window.TournamentSettingsApp = TournamentSettingsApp;
