// Global application ID and Firebase configuration (should be consistent across all React apps)
// Tieto konštanty sú teraz definované v <head> logged-in-tournament-settings.html
// const appId = '1:26454452024:web:6954b4f90f87a3a1eb43cd';
// const firebaseConfig = { ... };
// const initialAuthToken = null;

// const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec";

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

// NotificationModal Component for displaying temporary messages (converted to React.createElement)
function NotificationModal({ message, onClose }) {
  const [show, setShow] = React.useState(false);
  const timerRef = React.useRef(null);

  React.useEffect(() => {
    if (message) {
      setShow(true);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        setShow(false);
        setTimeout(onClose, 500);
      }, 10000);
    } else {
      setShow(false);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [message, onClose]);

  if (!show && !message) return null;

  return React.createElement(
    'div',
    {
      className: `fixed top-0 left-0 right-0 z-50 flex justify-center p-4 transition-transform duration-500 ease-out ${
        show ? 'translate-y-0' : '-translate-y-full'
      }`,
      style: { pointerEvents: 'none' }
    },
    React.createElement(
      'div',
      {
        className: 'bg-[#3A8D41] text-white px-6 py-3 rounded-lg shadow-lg max-w-md w-full text-center',
        style: { pointerEvents: 'auto' }
      },
      React.createElement('p', { className: 'font-semibold' }, message)
    )
  );
}

// Main React component for the logged-in-tournament-settings.html page
function TournamentSettingsApp() {
  // NEW: Get references to Firebase services directly
  const app = firebase.app();
  const auth = firebase.auth(app);
  const db = firebase.firestore(app);

  // NEW: Local state for the current user and their profile data
  // These states will be updated by the local onAuthStateChanged and onSnapshot
  const [user, setUser] = React.useState(auth.currentUser); // Initialize with current user
  const [userProfileData, setUserProfileData] = React.useState(null); 
  const [loading, setLoading] = React.useState(true); // Loading for data in TournamentSettingsApp
  const [error, setError] = React.useState('');
  // Retained: userNotificationMessage for local notifications
  const [userNotificationMessage, setUserNotificationMessage] = React.useState('');

  // States for date and time settings
  const [registrationStartDate, setRegistrationStartDate] = React.useState('');
  const [registrationEndDate, setRegistrationEndDate] = React.useState('');
  const [dataEditDeadline, setDataEditDeadline] = React.useState(''); // NOVÝ STAV: Dátum uzávierky úprav dát
  const [settingsLoaded, setSettingsLoaded] = React.useState(false);

  // New state for countdown
  const [countdown, setCountdown] = React.useState(null);
  // New state variable to force recalculation of isRegistrationOpen
  const [forceRegistrationCheck, setForceRegistrationCheck] = React.useState(0);
  // New state variable for periodic update of isRegistrationOpen
  const [periodicRefreshKey, setPeriodicRefreshKey] = React.useState(0);

  // Používame pevne zadané 'default-app-id' pre cestu k notifikáciám
  const appId = 'default-app-id'; 

  // Calculate registration status as a memoized value
  const isRegistrationOpen = React.useMemo(() => {
    if (!settingsLoaded) return false; // Wait until settings are loaded
    const now = new Date();
    const regStart = registrationStartDate ? new Date(registrationStartDate) : null;
    const regEnd = registrationEndDate ? new Date(registrationEndDate) : null;

    // Check if dates are valid before comparison
    const isRegStartValid = regStart instanceof Date && !isNaN(regStart);
    const isRegEndValid = regEnd instanceof Date && !isNaN(regEnd);

    return (
      (isRegStartValid ? now >= regStart : true) && // Ak regStart nie je platný, predpokladáme, že registrácia začala
      (isRegEndValid ? now <= regEnd : true)        // Ak regEnd nie je platný, predpokladáme, že registrácia neskončila
    );
  }, [settingsLoaded, registrationStartDate, registrationEndDate, forceRegistrationCheck, periodicRefreshKey]);

  // Function to calculate remaining time for countdown
  const calculateTimeLeft = React.useCallback(() => {
    const now = new Date();
    const startDate = registrationStartDate ? new Date(registrationStartDate) : null;

    // If startDate is not a valid date, or is already in the past, no countdown is needed
    if (!startDate || isNaN(startDate) || now >= startDate) {
        return null;
    }

    const difference = startDate.getTime() - now.getTime(); // Difference in milliseconds

    if (difference <= 0) {
        return null; // Time has passed
    }

    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((difference % (1000 * 60)) / 1000);

    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  }, [registrationStartDate]);

  // NEW: Local Auth Listener for TournamentSettingsApp
  // This listener ensures that TournamentSettingsApp reacts to authentication changes,
  // but primary logout/redirection is handled by GlobalNotificationHandler.
  React.useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(currentUser => {
      console.log("TournamentSettingsApp: Local onAuthStateChanged - User:", currentUser ? currentUser.uid : "null");
      setUser(currentUser);
      // If user is not logged in, redirect (even if GNH should handle it)
      if (!currentUser) {
        console.log("TournamentSettingsApp: User is not logged in, redirecting to login.html.");
        window.location.href = 'login.html';
      }
    });
    return () => unsubscribeAuth();
  }, [auth]); // Depends on auth instance

  // NEW: Local Effect for loading user data from Firestore
  // This effect will run when the user is logged in and db is available.
  // It assumes that passwordLastChanged and approved status are already verified by a global handler.
  React.useEffect(() => {
    let unsubscribeUserDoc;

    if (user && db) { // Only runs if user is logged in and db is available
      console.log(`TournamentSettingsApp: Attempting to load user document for UID: ${user.uid}`);
      setLoading(true); // Set loading to true while profile data is being loaded

      try {
        const userDocRef = db.collection('users').doc(user.uid);
        unsubscribeUserDoc = userDocRef.onSnapshot(docSnapshot => {
          console.log("TournamentSettingsApp: onSnapshot for user document triggered.");
          if (docSnapshot.exists) {
            const userData = docSnapshot.data();
            console.log("TournamentSettingsApp: User document exists, data:", userData);

            // --- IMMEDIATE LOGOUT IF passwordLastChanged IS NOT A VALID TIMESTAMP ---
            // This is added logic that runs immediately after data is loaded.
            // If passwordLastChanged is invalid or missing, log out.
            if (!userData.passwordLastChanged || typeof userData.passwordLastChanged.toDate !== 'function') {
                console.error("TournamentSettingsApp: passwordLastChanged IS NOT a valid Timestamp object! Type:", typeof userData.passwordLastChanged, "Value:", userData.passwordLastChanged);
                console.log("TournamentSettingsApp: Immediately logging out user due to invalid password change timestamp.");
                auth.signOut(); // Use auth from React state
                window.location.href = 'login.html';
                localStorage.removeItem(`passwordLastChanged_${user.uid}`); // Clear localStorage
                setUser(null); // Explicitly set user to null
                setUserProfileData(null); // Explicitly set userProfileData to null
                return; // Stop further processing
            }

            // Normal processing if passwordLastChanged is valid
            const firestorePasswordChangedTime = userData.passwordLastChanged.toDate().getTime();
            const localStorageKey = `passwordLastChanged_${user.uid}`;
            let storedPasswordChangedTime = parseInt(localStorage.getItem(localStorageKey) || '0', 10);

            console.log(`TournamentSettingsApp: Firestore passwordLastChanged (converted): ${firestorePasswordChangedTime}, Stored: ${storedPasswordChangedTime}`);

            if (storedPasswordChangedTime === 0 && firestorePasswordChangedTime !== 0) {
                // First load for this user/browser, initialize localStorage and DO NOT LOG OUT
                localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
                console.log("TournamentSettingsApp: Initializing passwordLastChanged in localStorage (first load).");
                // Do not continue here, continue with normal data processing for first load
            } else if (firestorePasswordChangedTime > storedPasswordChangedTime) {
                // Password was changed on another device/session
                console.log("TournamentSettingsApp: Password change detected on another device/session. Logging out user.");
                auth.signOut(); // Use auth from React state
                window.location.href = 'login.html';
                localStorage.removeItem(localStorageKey); // Clear localStorage after logout
                setUser(null); // Explicitly set user to null
                setUserProfileData(null); // Explicitly set userProfileData to null
                return;
            } else if (firestorePasswordChangedTime < storedPasswordChangedTime) {
                // This ideally should not happen if Firestore is the source of truth
                console.warn("TournamentSettingsApp: Detected older timestamp from Firestore than stored. Logging out user (potential mismatch).");
                auth.signOut(); // Use auth from React state
                window.location.href = 'login.html';
                localStorage.removeItem(localStorageKey);
                setUser(null); // Explicitly set user to null
                setUserProfileData(null); // Explicitly set userProfileData to null
                return;
            } else {
                // Times are the same, ensure localStorage is up-to-date
                localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
                console.log("TournamentSettingsApp: Timestamps are the same, updating localStorage.");
            }

            // NEW LOGIC: Logout if user is admin and not approved
            if (userData.role === 'admin' && userData.approved === false) {
                console.log("TournamentSettingsApp: User is admin and not approved. Logging out.");
                auth.signOut();
                window.location.href = 'login.html';
                setUser(null); // Explicitly set user to null
                setUserProfileData(null); // Explicitly set userProfileData to null
                return; // Stop further processing
            }

            setUserProfileData(userData); // Update userProfileData state
            
            setLoading(false); // Stop loading after user data is loaded
            setError(''); // Clear errors after successful load

            // Update menu visibility after role is loaded (call global function from left-menu.js)
            if (typeof window.updateMenuItemsVisibility === 'function') {
                window.updateMenuItemsVisibility(userData.role);
            } else {
                console.warn("TournamentSettingsApp: Function updateMenuItemsVisibility is not defined.");
            }

            console.log("TournamentSettingsApp: User data loading complete, loading: false");
          } else {
            console.warn("TournamentSettingsApp: User document not found for UID:", user.uid);
            setError("Error: User profile not found or you do not have sufficient permissions. Please try logging in again.");
            setLoading(false); // Stop loading so error can be displayed
            setUser(null); // Explicitly set user to null
            setUserProfileData(null); // Explicitly set userProfileData to null
          }
        }, error => {
          console.error("TournamentSettingsApp: Error loading user data from Firestore (onSnapshot error):", error);
          if (error.code === 'permission-denied') {
              setError(`Permission error: You do not have access to your profile. Please try logging in again or contact support.`);
          } else if (error.code === 'unavailable') {
              setError(`Connection error: Firestore service is unavailable. Please try again later.`);
          } else if (error.code === 'unauthenticated') {
               setError(`Authentication error: You are not logged in. Please try logging in again.`);
               if (auth) {
                  auth.signOut();
                  window.location.href = 'login.html';
                  setUser(null); // Explicitly set user to null
                  setUserProfileData(null); // Explicitly set userProfileData to null
               }
          } else {
              setError(`Error loading user data: ${error.message}`);
          }
          setLoading(false); // Stop loading even on error
          console.log("TournamentSettingsApp: User data loading failed, loading: false");
          setUser(null); // Explicitly set user to null
          setUserProfileData(null); // Explicitly set userProfileData to null
        });
      } catch (e) {
        console.error("TournamentSettingsApp: Error setting up onSnapshot for user data (try-catch):", e);
        setError(`Error setting up listener for user data: ${e.message}`);
        setLoading(false); // Stop loading even on error
        setUser(null); // Explicitly set user to null
        setUserProfileData(null); // Explicitly set userProfileData to null
      }
    } else if (user === null) {
        // If user is null (and not undefined), it means they have been logged out.
        // Redirection should already be handled by GlobalNotificationHandler.
        // Here, we just ensure loading is false and data is cleared.
        setLoading(false);
        setUserProfileData(null);
    }

    return () => {
      // Unsubscribe from onSnapshot on unmount
      if (unsubscribeUserDoc) {
        console.log("TournamentSettingsApp: Unsubscribing onSnapshot for user document.");
        unsubscribeUserDoc();
      }
    };
  }, [user, db, auth]); // Depends on user and db (and auth for signOut)

  // Effect for loading settings (runs after DB and Auth are initialized)
  React.useEffect(() => {
    const fetchSettings = async () => {
      if (!db) {
        console.log("TournamentSettingsApp: Čakám na DB pre načítanie nastavení.");
        return; // Wait for DB to be initialized
      }
      try {
          console.log("TournamentSettingsApp: Pokúšam sa načítať nastavenia registrácie.");
          const settingsDocRef = db.collection('settings').doc('registration');
          const unsubscribeSettings = settingsDocRef.onSnapshot(docSnapshot => {
            console.log("TournamentSettingsApp: onSnapshot pre nastavenia registrácie spustený.");
            if (docSnapshot.exists) {
                const data = docSnapshot.data();
                console.log("TournamentSettingsApp: Nastavenia registrácie existujú, dáta:", data);
                setRegistrationStartDate(data.registrationStartDate ? formatToDatetimeLocal(data.registrationStartDate.toDate()) : '');
                setRegistrationEndDate(data.registrationEndDate ? formatToDatetimeLocal(data.registrationEndDate.toDate()) : '');
                setDataEditDeadline(data.dataEditDeadline ? formatToDatetimeLocal(data.dataEditDeadline.toDate()) : ''); // NOVINKA: Načítanie dátumu uzávierky úprav
            } else {
                console.log("TournamentSettingsApp: Nastavenia registrácie sa nenašli v Firestore. Používajú sa predvolené prázdne hodnoty.");
                setRegistrationStartDate('');
                setRegistrationEndDate('');
                setDataEditDeadline(''); // NOVINKA: Nastavenie prázdnej hodnoty
            }
            setSettingsLoaded(true);
            console.log("TournamentSettingsApp: Načítanie nastavení dokončené, settingsLoaded: true.");
          }, error => {
            console.error("TournamentSettingsApp: Chyba pri načítaní nastavení registrácie (onSnapshot error):", error);
            setError(`Chyba pri načítaní nastavení: ${error.message}`);
            setSettingsLoaded(true); // Nastavenia sú načítané aj v prípade chyby
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
      }
    };

    fetchSettings();
  }, [db]);

  // Effect for countdown (runs when registrationStartDate changes)
  React.useEffect(() => {
    let timer;
    const updateCountdown = () => {
        const timeLeft = calculateTimeLeft();
        setCountdown(timeLeft);
        if (timeLeft === null) {
            clearInterval(timer);
            setForceRegistrationCheck(prev => prev + 1);
        }
    };

    if (registrationStartDate && new Date(registrationStartDate) > new Date()) {
        updateCountdown();
        timer = setInterval(updateCountdown, 1000);
    } else {
        setCountdown(null);
    }

    return () => clearInterval(timer);
  }, [registrationStartDate, calculateTimeLeft]);

  // New useEffect for periodic update of isRegistrationOpen
  React.useEffect(() => {
    const interval = setInterval(() => {
      setPeriodicRefreshKey(prev => prev + 1);
    }, 60 * 1000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  const handleUpdateRegistrationSettings = async (e) => {
    e.preventDefault();
    // Podmienka na kontrolu roly admina závisí od userProfileData.role
    if (!db || !userProfileData || userProfileData.role !== 'admin') {
      setError("Nemáte oprávnenie na zmenu nastavení registrácie.");
      return;
    }
    setLoading(true);
    setError('');
    setUserNotificationMessage('');

    try {
      const regStart = registrationStartDate ? new Date(registrationStartDate) : null;
      const regEnd = registrationEndDate ? new Date(registrationEndDate) : null;
      const dataEditDead = dataEditDeadline ? new Date(dataEditDeadline) : null; // NOVINKA: Prevod na Date objekt

      if (regStart && regEnd && regStart >= regEnd) {
        setError("Dátum začiatku registrácie musí byť pred dátumom konca registrácie.");
        setLoading(false);
        return;
      }
      // NOVINKA: Validácia dátumu uzávierky úprav
      if (dataEditDead && regEnd && dataEditDead < regEnd) {
        setError("Dátum uzávierky úprav dát nemôže byť pred dátumom konca registrácie.");
        setLoading(false);
        return;
      }


      const settingsDocRef = db.collection('settings').doc('registration');
      await settingsDocRef.set({
        registrationStartDate: regStart ? firebase.firestore.Timestamp.fromDate(regStart) : null,
        registrationEndDate: regEnd ? firebase.firestore.Timestamp.fromDate(regEnd) : null,
        dataEditDeadline: dataEditDead ? firebase.firestore.Timestamp.fromDate(dataEditDead) : null, // NOVINKA: Uloženie dátumu uzávierky úprav
      });
      setUserNotificationMessage("Nastavenia registrácie úspešne aktualizované!");

      // --- Logika pre ukladanie notifikácie pre administrátorov ---
      try {
          // Používame pevne zadanú premennú appId z vonkajšieho scope
          await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('adminNotifications').add({
              message: `Nastavenia registrácie boli aktualizované. Začiatok: ${regStart ? regStart.toLocaleDateString('sk-SK') + ' ' + regStart.toLocaleTimeString('sk-SK') : 'N/A'}, Koniec: ${regEnd ? regEnd.toLocaleDateString('sk-SK') + ' ' + regEnd.toLocaleTimeString('sk-SK') : 'N/A'}. Uzávierka úprav dát: ${dataEditDead ? dataEditDead.toLocaleDateString('sk-SK') + ' ' + dataEditDead.toLocaleTimeString('sk-SK') : 'N/A'}.`,
              timestamp: firebase.firestore.FieldValue.serverTimestamp(),
              recipientId: 'all_admins', // Notifikácia pre všetkých administrátorov
              read: false
          });
          console.log("Notifikácia o aktualizácii nastavení registrácie úspešne uložená do Firestore.");
      } catch (e) {
          console.error("TournamentSettingsApp: Chyba pri ukladaní notifikácie o aktualizácii nastavení registrácie:", e);
      }
      // --- Koniec logiky pre ukladania notifikácie ---

    } catch (e) {
      console.error("TournamentSettingsApp: Chyba pri aktualizácii nastavení registrácie:", e);
      setError(`Chyba pri aktualizácii nastavenia: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Display loading state
  if (!user || (user && !userProfileData) || !settingsLoaded || loading) {
    if (user === null) {
        console.log("TournamentSettingsApp: User is null, redirecting to login.html");
        window.location.href = 'login.html';
        return null;
    }
    let loadingMessage = 'Načítavam...';
    if (user && !userProfileData) {
        loadingMessage = 'Načítavam...';
    } else if (!settingsLoaded) {
        loadingMessage = 'Načítavam nastavenia...';
    } else if (loading) {
        loadingMessage = 'Načítavam...';
    }

    return React.createElement(
      'div',
      { className: 'flex items-center justify-center min-h-screen bg-gray-100' },
      React.createElement('div', { className: 'text-xl font-semibold text-gray-700' }, loadingMessage)
    );
  }

  // If user is not admin, redirect
  if (userProfileData && userProfileData.role !== 'admin') {
    console.log("TournamentSettingsApp: Používateľ nie je admin a snaží sa pristupovať k nastaveniam turnaja, presmerovávam.");
    window.location.href = 'logged-in-my-data.html'; // Presmerovanie na logged-in-my-data.html
    return null;
  }

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
    React.createElement(NotificationModal, {
        message: userNotificationMessage,
        onClose: () => setUserNotificationMessage('')
    }),
    React.createElement(
      'div',
      { className: 'w-full max-w-4xl mt-20 mb-10 p-4' },
      error && React.createElement(
        'div',
        { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap', role: 'alert' },
        error
      ),
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
          // NOVINKA: Pole pre dátum uzávierky úprav dát
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
