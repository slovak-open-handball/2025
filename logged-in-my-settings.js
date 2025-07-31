// logged-in-my-settings.js
// Tento súbor obsahuje React komponent pre správu nastavení prihláseného používateľa.
// Predpokladá, že Firebase SDK je inicializovaný v <head> logged-in-my-settings.html.

// Komponent NotificationModal pre zobrazovanie dočasných správ
function NotificationModal({ message, onClose, type = 'info' }) {
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

  let bgColorClass;
  if (type === 'success') {
    bgColorClass = 'bg-[#3A8D41]'; // Green
  } else if (type === 'error') {
    bgColorClass = 'bg-red-600'; // Red
  } else {
    bgColorClass = 'bg-blue-500'; // Default blue for info
  }

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
        className: `${bgColorClass} text-white px-6 py-3 rounded-lg shadow-lg max-w-md w-full text-center`,
        style: { pointerEvents: 'auto' }
      },
      React.createElement('p', { className: 'font-semibold' }, message)
    )
  );
}

// Main React component for the logged-in-my-settings.html page
function MySettingsApp() {
  // NEW: Get references to Firebase services directly
  const app = firebase.app();
  const auth = firebase.auth(app);
  const db = firebase.firestore(app);

  // NEW: Local state for the current user and their profile data
  // These states will be updated by the local onAuthStateChanged and onSnapshot
  const [user, setUser] = React.useState(auth.currentUser); // Initialize with current user
  const [userProfileData, setUserProfileData] = React.useState(null); 
  const [loading, setLoading] = React.useState(true); // Loading for data in MySettingsApp
  const [error, setError] = React.useState('');
  // Retained: userNotificationMessage for local notifications
  const [userNotificationMessage, setUserNotificationMessage] = React.useState('');

  // User Data States - These states will be updated from userProfileData
  const [displayNotifications, setDisplayNotifications] = React.useState(true);

  // NEW: Local Auth Listener for MySettingsApp
  // This listener ensures that MySettingsApp reacts to authentication changes,
  // but primary logout/redirection is handled by GlobalNotificationHandler.
  React.useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(currentUser => {
      console.log("MySettingsApp: Local onAuthStateChanged - User:", currentUser ? currentUser.uid : "null");
      setUser(currentUser);
      // If user is not logged in, redirect (even if GNH should handle it)
      if (!currentUser) {
        console.log("MySettingsApp: User is not logged in, redirecting to login.html.");
        window.location.href = 'login.html';
      }
    });
    return () => unsubscribeAuth();
  }, [auth]); // Depends on auth instance

  // NEW: Local Effect for loading user data from Firestore
  // This effect will run when the user is logged in and db is available.
  // It assumes that passwordLastChanged and approved status are already verified in header.js.
  React.useEffect(() => {
    let unsubscribeUserDoc;

    if (user && db) { // Only runs if user is logged in and db is available
      console.log(`MySettingsApp: Attempting to load user document for UID: ${user.uid}`);
      setLoading(true); // Set loading to true while profile data is being loaded

      try {
        const userDocRef = db.collection('users').doc(user.uid);
        unsubscribeUserDoc = userDocRef.onSnapshot(docSnapshot => {
          console.log("MySettingsApp: onSnapshot for user document triggered.");
          if (docSnapshot.exists) {
            const userData = docSnapshot.data();
            console.log("MySettingsApp: User document exists, data:", userData);

            // *** NEW LOGIC FOR RESTRICTING ACCESS FOR 'user' ROLE ***
            if (userData.role === 'user') {
                console.log("MySettingsApp: User has 'user' role. Redirecting to logged-in-my-data.html.");
                window.location.href = 'logged-in-my-data.html';
                return; // Stop further processing
            }
            // *** END OF NEW LOGIC ***

            // --- IMMEDIATE LOGOUT IF passwordLastChanged IS NOT A VALID TIMESTAMP ---
            // This is added logic that runs immediately after data is loaded.
            // If passwordLastChanged is invalid or missing, log out.
            if (!userData.passwordLastChanged || typeof userData.passwordLastChanged.toDate !== 'function') {
                console.error("MySettingsApp: passwordLastChanged IS NOT a valid Timestamp object! Type:", typeof userData.passwordLastChanged, "Value:", userData.passwordLastChanged);
                console.log("MySettingsApp: Immediately logging out user due to invalid password change timestamp.");
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

            console.log(`MySettingsApp: Firestore passwordLastChanged (converted): ${firestorePasswordChangedTime}, Stored: ${storedPasswordChangedTime}`);

            if (storedPasswordChangedTime === 0 && firestorePasswordChangedTime !== 0) {
                // First load for this user/browser, initialize localStorage and DO NOT LOG OUT
                localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
                console.log("MySettingsApp: Initializing passwordLastChanged in localStorage (first load).");
                // Do not continue here, continue with normal data processing for first load
            } else if (firestorePasswordChangedTime > storedPasswordChangedTime) {
                // Password was changed on another device/session
                console.log("MySettingsApp: Password change detected on another device/session. Logging out user.");
                auth.signOut(); // Use auth from React state
                window.location.href = 'login.html';
                localStorage.removeItem(localStorageKey); // Clear localStorage after logout
                setUser(null); // Explicitly set user to null
                setUserProfileData(null); // Explicitly set userProfileData to null
                return;
            } else if (firestorePasswordChangedTime < storedPasswordChangedTime) {
                // This ideally should not happen if Firestore is the source of truth
                console.warn("MySettingsApp: Detected older timestamp from Firestore than stored. Logging out user (potential mismatch).");
                auth.signOut(); // Use auth from React state
                window.location.href = 'login.html';
                localStorage.removeItem(localStorageKey);
                setUser(null); // Explicitly set user to null
                setUserProfileData(null); // Explicitly set userProfileData to null
                return;
            } else {
                // Times are the same, ensure localStorage is up-to-date
                localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
                console.log("MySettingsApp: Timestamps are the same, updating localStorage.");
            }

            // NEW LOGIC: Logout if user is admin and not approved
            if (userData.role === 'admin' && userData.approved === false) {
                console.log("MySettingsApp: User is admin and not approved. Logging out.");
                auth.signOut();
                window.location.href = 'login.html';
                setUser(null); // Explicitly set user to null
                setUserProfileData(null); // Explicitly set userProfileData to null
                return; // Stop further processing
            }

            setUserProfileData(userData); // Update userProfileData state
            
            // Update local states from userProfileData
            // If displayNotifications is not explicitly set, default to true
            setDisplayNotifications(userData.displayNotifications !== undefined ? userData.displayNotifications : true);
            
            setLoading(false); // Stop loading after user data is loaded
            setError(''); // Clear errors after successful load

            // Update menu visibility after role is loaded (call global function from left-menu.js)
            if (typeof window.updateMenuItemsVisibility === 'function') {
                window.updateMenuItemsVisibility(userData.role);
            } else {
                console.warn("MySettingsApp: Function updateMenuItemsVisibility is not defined.");
            }

            console.log("MySettingsApp: User data loading complete, loading: false");
          } else {
            console.warn("MySettingsApp: User document not found for UID:", user.uid);
            setError("Error: User profile not found or you do not have sufficient permissions. Please try logging in again.");
            setLoading(false); // Stop loading so error can be displayed
            setUser(null); // Explicitly set user to null
            setUserProfileData(null); // Explicitly set userProfileData to null
          }
        }, error => {
          console.error("MySettingsApp: Error loading user data from Firestore (onSnapshot error):", error);
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
          console.log("MySettingsApp: User data loading failed, loading: false");
          setUser(null); // Explicitly set user to null
          setUserProfileData(null); // Explicitly set userProfileData to null
        });
      } catch (e) {
        console.error("MySettingsApp: Error setting up onSnapshot for user data (try-catch):", e);
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
        console.log("MySettingsApp: Unsubscribing onSnapshot for user document.");
        unsubscribeUserDoc();
      }
    };
  }, [user, db, auth]); // Depends on user and db (and auth for signOut)

  const handleUpdateNotificationsSetting = async () => {
    if (!db || !user) {
      setError("Databáza alebo používateľ nie je k dispozícii.");
      return;
    }
    setLoading(true);
    setError('');
    setUserNotificationMessage('');

    try {
      const userDocRef = db.collection('users').doc(user.uid);
      await userDocRef.update({
        displayNotifications: displayNotifications
      });
      setUserNotificationMessage("Nastavenie notifikácií úspešne aktualizované!");
    } catch (e) {
      console.error("MySettingsApp: Chyba pri aktualizácii nastavenia notifikácií:", e);
      setError(`Chyba pri aktualizácii nastavenia: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Display loading state
  if (!user || (user && !userProfileData) || loading) {
    if (user === null) {
        console.log("MySettingsApp: User is null, redirecting to login.html");
        window.location.href = 'login.html';
        return null;
    }
    let loadingMessage = 'Načítavam...';
    if (user && !userProfileData) {
        loadingMessage = 'Načítavam...';
    } else if (loading) {
        loadingMessage = 'Načítavam...';
    }

    return React.createElement(
      'div',
      { className: 'flex items-center justify-center min-h-screen bg-gray-100' },
      React.createElement('div', { className: 'text-xl font-semibold text-gray-700' }, loadingMessage)
    );
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
          'Moje nastavenia'
        ),
        React.createElement(
          React.Fragment,
          null,
          React.createElement('h2', { className: 'text-2xl font-bold text-gray-800 mt-8 mb-4' }, 'Nastavenia notifikácií'),
          React.createElement(
            'div',
            { className: 'flex items-center justify-between mt-4' },
            React.createElement('label', { className: 'text-gray-700 text-base', htmlFor: 'display-notifications-toggle' }, 'Zobrazovať notifikácie a oznámenia'),
            React.createElement(
              'label',
              { className: 'toggle-switch' },
              React.createElement('input', {
                type: 'checkbox',
                id: 'display-notifications-toggle',
                checked: displayNotifications,
                onChange: (e) => setDisplayNotifications(e.target.checked),
                disabled: loading,
              }),
              React.createElement('span', { className: 'slider' })
            )
          ),
          React.createElement(
            'button',
            {
              onClick: handleUpdateNotificationsSetting,
              className: 'mt-6 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200',
              disabled: loading,
            },
            loading ? 'Ukladám...' : 'Uložiť nastavenia notifikácií'
          )
        )
      )
    )
  );
}

// Explicitly expose the component globally
window.MySettingsApp = MySettingsApp;
