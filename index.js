// Global application ID and Firebase configuration (should be consistent across all React apps)
const appId = '1:26454452024:web:6954b4f90f87a3a1eb43cd';
const firebaseConfig = {
  apiKey: "AIzaSyDj_bSTkjrquu1nyIVYW7YLbyBl1pD6YYo",
  authDomain: "prihlasovanie-4f3f3.firebaseapp.com",
  projectId: "prihlasovanie-4f3f3",
  storageBucket: "prihlasovanie-4f3f3.firebasestorage.app",
  messagingSenderId: "26454452024",
  appId: "1:26454452024:web:6954b4f90f87a3a1eb43cd"
};
const initialAuthToken = null; // Global authentication token

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

// NotificationModal Component for displaying temporary messages
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
        timerRef.current = null;
      }
    };
  }, [message, onClose]);

  if (!show && !message) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 flex justify-center p-4 transition-transform duration-500 ease-out ${
        show ? 'translate-y-0' : '-translate-y-full'
      }`}
      style={{ pointerEvents: 'none' }}
    >
      <div
        className="bg-[#3A8D41] text-white px-6 py-3 rounded-lg shadow-lg max-w-md w-full text-center"
        style={{ pointerEvents: 'auto' }}
      >
        <p className="font-semibold">{message}</p>
      </div>
    </div>
  );
}

// Main React component for the index.html page
function App() {
  const [app, setApp] = React.useState(null);
  const [auth, setAuth] = React.useState(null);
  const [db, setDb] = React.useState(null);
  const [user, setUser] = React.useState(null);
  const [isAuthReady, setIsAuthReady] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [userNotificationMessage, setUserNotificationMessage] = React.useState('');

  // States for date and time settings
  const [registrationStartDate, setRegistrationStartDate] = React.useState('');
  const [registrationEndDate, setRegistrationEndDate] = React.useState('');
  const [settingsLoaded, setSettingsLoaded] = React.useState(false);

  // New state for countdown
  const [countdown, setCountdown] = React.useState(null);
  // New state variable to force recalculation of isRegistrationOpen
  const [forceRegistrationCheck, setForceRegistrationCheck] = React.useState(0);
  // New state variable for periodic update of isRegistrationOpen
  const [periodicRefreshKey, setPeriodicRefreshKey] = React.useState(0);

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
      (isRegStartValid ? now >= regStart : true) && // If regStart is not valid, assume registration has started
      (isRegEndValid ? now <= regEnd : true)        // If regEnd is not valid, assume registration has not ended
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

  // Effect for Firebase initialization and Auth Listener setup (runs only once)
  React.useEffect(() => {
    let unsubscribeAuth;
    let firestoreInstance;

    try {
      if (typeof firebase === 'undefined') {
        setError("Firebase SDK is not loaded. Check index.html.");
        setLoading(false);
        return;
      }

      const firebaseApp = firebase.initializeApp(firebaseConfig);
      setApp(firebaseApp);

      const authInstance = firebase.auth(firebaseApp);
      setAuth(authInstance);
      firestoreInstance = firebase.firestore(firebaseApp);
      setDb(firestoreInstance);

      const signIn = async () => {
        try {
          if (initialAuthToken) {
            await authInstance.signInWithCustomToken(initialAuthToken);
          } else {
            // No anonymous sign-in for index.js, user will explicitly log in
          }
        } catch (e) {
          console.error("Firebase initial sign-in failed:", e);
          setError(`Login error: ${e.message}`);
        }
      };

      unsubscribeAuth = authInstance.onAuthStateChanged(async (currentUser) => {
        setUser(currentUser);
        setIsAuthReady(true);
        if (currentUser && firestoreInstance) {
          try {
            const userDocRef = firestoreInstance.collection('users').doc(currentUser.uid);
            const unsubscribeUserDoc = userDocRef.onSnapshot(docSnapshot => {
              if (docSnapshot.exists) {
                const userData = docSnapshot.data();
                setUser(prevUser => ({
                  ...prevUser,
                  ...userData,
                  displayName: userData.firstName && userData.lastName ? `${userData.firstName} ${userData.lastName}` : userData.email,
                  displayNotifications: userData.displayNotifications !== undefined ? userData.displayNotifications : true
                }));
              } else {
                setUser(prevUser => ({
                  ...prevUser,
                  displayNotifications: true
                }));
              }
            }, error => {
              console.error("Error loading user data from Firestore (onSnapshot):", error);
            });
            return () => {
              if (unsubscribeAuth) unsubscribeAuth();
              if (unsubscribeUserDoc) unsubscribeUserDoc();
            };
          } catch (e) {
            console.error("Error setting up onSnapshot for user data:", e);
          }
        }
      });

      signIn();

      return () => {
        if (unsubscribeAuth) {
          unsubscribeAuth();
        }
      };
    } catch (e) {
      console.error("Failed to initialize Firebase:", e);
      setError(`Error initializing Firebase: ${e.message}`);
      setLoading(false);
    }
  }, []);

  // Effect for loading settings (runs after DB and Auth are initialized)
  React.useEffect(() => {
    const fetchSettings = async () => {
      if (!db || !isAuthReady) {
        return; // Wait for DB and Auth to be initialized
      }
      try {
          const settingsDocRef = db.collection('settings').doc('registration');
          const unsubscribeSettings = settingsDocRef.onSnapshot(docSnapshot => {
            if (docSnapshot.exists) {
                const data = docSnapshot.data();
                setRegistrationStartDate(data.registrationStartDate ? formatToDatetimeLocal(data.registrationStartDate.toDate()) : '');
                setRegistrationEndDate(data.registrationEndDate ? formatToDatetimeLocal(data.registrationEndDate.toDate()) : '');
            } else {
                console.log("Registration settings not found in Firestore. Using default empty values.");
                setRegistrationStartDate('');
                setRegistrationEndDate('');
            }
            setSettingsLoaded(true);
            setLoading(false);
          }, error => {
            console.error("Error loading registration settings (onSnapshot):", error);
            setError(`Error loading settings: ${error.message}`);
            setSettingsLoaded(true);
            setLoading(false);
          });

          return () => unsubscribeSettings();
      } catch (e) {
          console.error("Error setting up onSnapshot for registration settings:", e);
          setError(`Error setting up listener for settings: ${e.message}`);
          setSettingsLoaded(true);
          setLoading(false);
      }
    };

    fetchSettings();
  }, [db, isAuthReady]);

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

  // useEffect for updating header link visibility (simplified for index.html)
  React.useEffect(() => {
    const authLink = document.getElementById('auth-link');
    const profileLink = document.getElementById('profile-link');
    const logoutButton = document.getElementById('logout-button');
    const registerLink = document.getElementById('register-link');

    if (authLink) {
      if (user) { // If user is logged in
        authLink.classList.add('hidden');
        profileLink && profileLink.classList.remove('hidden');
        logoutButton && logoutButton.classList.remove('hidden');
        registerLink && registerLink.classList.add('hidden');
      } else { // If user is not logged in
        authLink.classList.remove('hidden');
        profileLink && profileLink.classList.add('hidden');
        logoutButton && logoutButton.classList.add('hidden');
        if (isRegistrationOpen) {
          registerLink && registerLink.classList.remove('hidden');
        } else {
          registerLink && registerLink.classList.add('hidden');
        }
      }
    }
  }, [user, isRegistrationOpen]);

  // Handle logout (needed for the header logout button)
  const handleLogout = React.useCallback(async () => {
    if (!auth) return;
    try {
      setLoading(true);
      await auth.signOut();
      setUserNotificationMessage("Successfully logged out.");
      window.location.href = 'login.html';
    } catch (e) {
      console.error("Logout error:", e);
      setError(`Logout error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [auth]);

  // Attach logout handler to the button in the header
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
  }, [handleLogout]);


  // Display loading state
  if (loading || !isAuthReady || !settingsLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-xl font-semibold text-gray-700">Loading...</div>
      </div>
    );
  }

  const now = new Date();
  const regStart = registrationStartDate ? new Date(registrationStartDate) : null;
  const regEnd = registrationEndDate ? new Date(registrationEndDate) : null;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center font-inter overflow-y-auto">
      {/* Notification Modal */}
      <NotificationModal
          message={userNotificationMessage}
          onClose={() => setUserNotificationMessage('')}
      />
      {/* Error display */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap" role="alert">
          {error}
        </div>
      )}

      <div className="w-full max-w-md mt-20 mb-10 p-4">
        <div className="bg-white p-8 rounded-lg shadow-xl w-full text-center">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">Welcome to Slovak Open Handball</h1>
          {user ? (
            <>
              <p className="text-lg text-gray-600">You are logged in. Go to your zone for more options.</p>
              <div className="mt-6 flex justify-center">
                <a
                  href="logged-in.html"
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200"
                >
                  My Zone
                </a>
              </div>
            </>
          ) : (
            <>
              {isRegistrationOpen ? (
                <>
                  <p className="text-lg text-gray-600">Please log in or register to continue.</p>
                  <div className="mt-6 flex justify-center space-x-4">
                    <a
                      href="login.html"
                      className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200"
                    >
                      Login
                    </a>
                    <a
                      href="register.html"
                      className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200"
                    >
                      Tournament Registration
                    </a>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-lg text-gray-600">
                    Registration form is not accessible.
                  </p>
                  {regStart && !isNaN(regStart) && now < regStart && (
                    <>
                      <p className="text-md text-gray-500 mt-2">
                        Registration will be possible from:{" "}
                        <span style={{ whiteSpace: 'nowrap' }}>
                          {new Date(registrationStartDate).toLocaleDateString('sk-SK')}
                        </span>{" "}
                        <span style={{ whiteSpace: 'nowap' }}>
                          {new Date(registrationStartDate).toLocaleTimeString('sk-SK')}
                        </span>
                      </p>
                      {countdown && (
                          <p className="text-md text-gray-500 mt-2">Registration will start in: {countdown}</p>
                      )}
                    </>
                  )}
                  {regEnd && !isNaN(regEnd) && now > regEnd && (
                    <p className="text-md text-gray-500 mt-2">
                      Registration ended:{" "}
                      <span style={{ whiteSpace: 'nowrap' }}>
                        {new Date(registrationEndDate).toLocaleDateString('sk-SK')}
                      </span>{" "}
                      <span style={{ whiteSpace: 'nowrap' }}>
                        {new Date(registrationEndDate).toLocaleTimeString('sk-SK')}
                      </span>
                    </p>
                  )}
                  <div className="mt-6 flex justify-center">
                    <a
                      href="login.html"
                      className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200"
                    >
                      Login
                    </a>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
