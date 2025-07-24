// Global application ID and Firebase configuration (should be consistent across all React apps)
// Tieto konštanty sú teraz definované v <head> logged-in-my-data.html
// const appId = '1:26454452024:web:6954b4f90f87a3a1eb43cd';
// const firebaseConfig = { ... };
// const initialAuthToken = null;

const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec";

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

// PasswordInput Component for password fields with visibility toggle (converted to React.createElement)
function PasswordInput({ id, label, value, onChange, placeholder, autoComplete, showPassword, toggleShowPassword, onCopy, onPaste, onCut, disabled, description }) {
  const EyeIcon = React.createElement(
    'svg',
    { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 5 12 5c4.638 0 8.573 2.51 9.963 7.322.034.139.034.279 0 .418A10.05 10.05 0 0112 19c-4.638 0-8.573-2.51-9.963-7.322zM15 12a3 3 0 11-6 0 3 3 0 016 0z' })
  );

  const EyeOffIcon = React.createElement(
    'svg',
    { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.274-4.057 5.064-7 9.542-7a9.95 9.95 0 011.875.175m.001 0V5m0 14v-2.175m0-10.65L12 12m-6.25 6.25L12 12m0 0l6.25-6.25M12 12l-6.25-6.25' })
  );

  return React.createElement(
    'div',
    { className: 'relative' },
    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: id }, label),
    React.createElement('input', {
      type: showPassword ? 'text' : 'password',
      id: id,
      className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10',
      value: value,
      onChange: onChange,
      onCopy: (e) => e.preventDefault(),
      onPaste: (e) => e.preventDefault(),
      onCut: (e) => e.preventDefault(),
      required: true,
      placeholder: placeholder,
      autoComplete: autoComplete,
      disabled: disabled,
    }),
    React.createElement(
      'button',
      {
        type: 'button',
        onClick: toggleShowPassword,
        className: 'absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5',
        disabled: disabled,
      },
      showPassword ? EyeOffIcon : EyeIcon
    ),
    description && React.createElement(
      'p',
      { className: 'text-gray-600 text-sm -mt-2' },
      description
    )
  );
}

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
        timerRef.current = null;
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

// ConfirmationModal Component (converted to React.createElement)
function ConfirmationModal({ message, onConfirm, onCancel }) {
  return React.createElement(
    'div',
    { className: 'modal' },
    React.createElement(
      'div',
      { className: 'modal-content text-center' },
      React.createElement('p', { className: 'text-lg font-semibold mb-6' }, message),
      React.createElement(
        'div',
        { className: 'flex justify-center space-x-4' },
        React.createElement(
          'button',
          {
            onClick: onCancel,
            className: 'px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors duration-200',
          },
          'Zrušiť'
        ),
        React.createElement(
          'button',
          {
            onClick: onConfirm,
            className: 'px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200',
          },
          'Potvrdiť'
        )
      )
    )
  );
}

// EditRoleModal Component (converted to React.createElement)
function EditRoleModal({ userToEditRole, newRole, setNewRole, closeRoleEditModal, handleUpdateUserRole, loading }) {
  return React.createElement(
    'div',
    { className: 'modal' },
    React.createElement(
      'div',
      { className: 'modal-content' },
      React.createElement('h3', { className: 'text-xl font-bold mb-4' }, `Upraviť rolu pre ${userToEditRole?.email}`),
      React.createElement(
        'div',
        { className: 'mb-4' },
        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'new-user-role' }, 'Nová rola'),
        React.createElement(
          'select',
          {
            id: 'new-user-role',
            className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
            value: newRole,
            onChange: (e) => setNewRole(e.target.value),
          },
          React.createElement('option', { value: 'user' }, 'Používateľ'),
          React.createElement('option', { value: 'admin' }, 'Administrátor')
        )
      ),
      React.createElement(
        'div',
        { className: 'flex justify-end space-x-4' },
        React.createElement(
          'button',
          {
            onClick: closeRoleEditModal,
            className: 'px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors duration-200',
          },
          'Zrušiť'
        ),
        React.createElement(
          'button',
          {
            onClick: handleUpdateUserRole,
            className: 'px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200',
            disabled: loading,
          },
          loading ? 'Ukladám...' : 'Uložiť'
        )
      )
    )
  );
}

// Main React component for the logged-in-my-data.html page
function MyDataApp() {
  const [app, setApp] = React.useState(null);
  const [auth, setAuth] = React.useState(null);
  const [db, setDb] = React.useState(null);
  const [user, setUser] = React.useState(undefined); // Firebase User object from onAuthStateChanged
  // Nový stav pre dáta používateľského profilu z Firestore
  const [userProfileData, setUserProfileData] = React.useState(null); 
  const [isAuthReady, setIsAuthReady] = React.useState(false); // Nový stav pre pripravenosť autentifikácie
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [userNotificationMessage, setUserNotificationMessage] = React.useState('');

  // User Data States - Tieto stavy sa budú aktualizovať z userProfileData
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [contactPhoneNumber, setContactPhoneNumber] = React.useState('');
  const [email, setEmail] = React.useState(''); // Bude nastavený z user.email alebo userProfileData.email
  const [role, setRole] = React.useState('');
  const [isApproved, setIsApproved] = React.useState(false);
  const [displayNotifications, setDisplayNotifications] = React.useState(true);

  // Admin Panel States
  const [allUsers, setAllUsers] = React.useState([]);
  const [showConfirmationModal, setShowConfirmationModal] = React.useState(false);
  const [userToDelete, setUserToDelete] = React.useState(null);
  const [showRoleEditModal, setShowRoleEditModal] = React.useState(false);
  const [userToEditRole, setUserToEditRole] = React.useState(null);
  const [newRole, setNewRole] = React.useState('user');

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
        console.error("MyDataApp: Firebase SDK nie je načítané.");
        setError("Firebase SDK nie je načítané. Skontrolujte logged-in-my-data.html.");
        setLoading(false);
        return;
      }

      const firebaseApp = firebase.app();
      setApp(firebaseApp);

      const authInstance = firebase.auth(firebaseApp);
      setAuth(authInstance);
      firestoreInstance = firebase.firestore(firebaseApp);
      setDb(firestoreInstance);

      const signIn = async () => {
        try {
          if (initialAuthToken) {
            await authInstance.signInWithCustomToken(initialAuthToken);
          }
          // Ak initialAuthToken nie je k dispozícii, jednoducho sa spoliehame na onAuthStateChanged,
          // ktoré detekuje pretrvávajúci stav prihlásenia (napr. z login.html).
        } catch (e) {
          console.error("MyDataApp: Chyba pri počiatočnom prihlásení Firebase (s custom tokenom):", e);
          setError(`Chyba pri prihlásení: ${e.message}`);
        }
      };

      unsubscribeAuth = authInstance.onAuthStateChanged(async (currentUser) => {
        console.log("MyDataApp: onAuthStateChanged - Používateľ:", currentUser ? currentUser.uid : "null");
        setUser(currentUser); // Nastaví Firebase User objekt
        setIsAuthReady(true); // Mark auth as ready after the first check
      });

      signIn();

      return () => {
        if (unsubscribeAuth) {
          unsubscribeAuth();
        }
      };
    } catch (e) {
      console.error("MyDataApp: Nepodarilo sa inicializovať Firebase:", e);
      setError(`Chyba pri inicializácii Firebase: ${e.message}`);
      setLoading(false);
    }
  }, []);

  // NOVÝ EFFECT: Načítanie používateľských dát z Firestore po inicializácii Auth a DB
  React.useEffect(() => {
    let unsubscribeUserDoc;

    // Spustí sa len ak je Auth pripravené, DB je k dispozícii a user je definovaný (nie undefined)
    if (isAuthReady && db && user !== undefined) {
      if (user === null) { // Ak je používateľ null (nie je prihlásený), presmeruj
        console.log("MyDataApp: Auth je ready a používateľ je null, presmerovávam na login.html");
        window.location.href = 'login.html';
        return;
      }

      // Ak je používateľ prihlásený, pokús sa načítať jeho dáta z Firestore
      if (user) {
        console.log(`MyDataApp: Pokúšam sa načítať používateľský dokument pre UID: ${user.uid}`);
        // Nastavíme loading na true, pretože začíname načítavať profilové dáta
        setLoading(true); // Nastavíme loading na true tu

        try {
          const userDocRef = db.collection('users').doc(user.uid);
          unsubscribeUserDoc = userDocRef.onSnapshot(docSnapshot => {
            console.log("MyDataApp: onSnapshot pre používateľský dokument spustený.");
            if (docSnapshot.exists) {
              const userData = docSnapshot.data();
              console.log("MyDataApp: Používateľský dokument existuje, dáta:", userData);
              setUserProfileData(userData); // Aktualizujeme nový stav userProfileData
              
              // Aktualizujeme lokálne stavy z userProfileData
              setFirstName(userData.firstName || '');
              setLastName(userData.lastName || '');
              setContactPhoneNumber(userData.contactPhoneNumber || '');
              setEmail(userData.email || user.email || ''); // Použi Firebase user email ako fallback
              setRole(userData.role || 'user');
              setIsApproved(userData.approved || false);
              setDisplayNotifications(userData.displayNotifications !== undefined ? userData.displayNotifications : true);
              
              setLoading(false); // Stop loading po načítaní používateľských dát
              setError(''); // Vymazať chyby po úspešnom načítaní

              // NOVINKA: Aktualizácia viditeľnosti menu po načítaní roly
              if (typeof window.updateMenuItemsVisibility === 'function') {
                  window.updateMenuItemsVisibility(userData.role);
              }

              console.log("MyDataApp: Načítanie používateľských dát dokončené, loading: false");
            } else {
              console.warn("MyDataApp: Používateľský dokument sa nenašiel pre UID:", user.uid);
              setError("Chyba: Používateľský profil sa nenašiel alebo nemáte dostatočné oprávnenia. Skúste sa prosím znova prihlásiť.");
              setLoading(false); // Zastaví načítavanie, aby sa zobrazila chyba
            }
          }, error => {
            console.error("MyDataApp: Chyba pri načítaní používateľských dát z Firestore (onSnapshot error):", error);
            if (error.code === 'permission-denied') {
                setError(`Chyba oprávnení: Nemáte prístup k svojmu profilu. Skúste sa prosím znova prihlásiť alebo kontaktujte podporu.`);
            } else if (error.code === 'unavailable') {
                setError(`Chyba pripojenia: Služba Firestore je nedostupná. Skúste to prosím neskôr.`);
            } else if (error.code === 'unauthenticated') {
                 setError(`Chyba autentifikácie: Nie ste prihlásený. Skúste sa prosím znova prihlásiť.`);
                 if (auth) {
                    auth.signOut();
                    window.location.href = 'login.html';
                 }
            } else {
                setError(`Chyba pri načítaní používateľských dát: ${error.message}`);
            }
            setLoading(false); // Stop loading aj pri chybe
            console.log("MyDataApp: Načítanie používateľských dát zlyhalo, loading: false");
          });
        } catch (e) {
          console.error("MyDataApp: Chyba pri nastavovaní onSnapshot pre používateľské dáta (try-catch):", e);
          setError(`Chyba pri nastavovaní poslucháča pre používateľské dáta: ${e.message}`);
          setLoading(false); // Stop loading aj pri chybe
        }
      }
    } else if (isAuthReady && user === undefined) {
        console.log("MyDataApp: Auth ready, user undefined. Nastavujem loading na false.");
        setLoading(false);
    }


    return () => {
      // Zrušíme odber onSnapshot pri unmount
      if (unsubscribeUserDoc) {
        console.log("MyDataApp: Ruším odber onSnapshot pre používateľský dokument.");
        unsubscribeUserDoc();
      }
    };
  }, [isAuthReady, db, user, auth]); // Odstránený userProfileData zo závislostí

  // Effect for loading settings (runs after DB and Auth are initialized)
  React.useEffect(() => {
    const fetchSettings = async () => {
      if (!db || !isAuthReady) {
        console.log("MyDataApp: Čakám na DB alebo Auth pre načítanie nastavení.");
        return; // Wait for DB and Auth to be initialized
      }
      try {
          console.log("MyDataApp: Pokúšam sa načítať nastavenia registrácie.");
          const settingsDocRef = db.collection('settings').doc('registration');
          const unsubscribeSettings = settingsDocRef.onSnapshot(docSnapshot => {
            console.log("MyDataApp: onSnapshot pre nastavenia registrácie spustený.");
            if (docSnapshot.exists) {
                const data = docSnapshot.data();
                console.log("MyDataApp: Nastavenia registrácie existujú, dáta:", data);
                setRegistrationStartDate(data.registrationStartDate ? formatToDatetimeLocal(data.registrationStartDate.toDate()) : '');
                setRegistrationEndDate(data.registrationEndDate ? formatToDatetimeLocal(data.registrationEndDate.toDate()) : '');
            } else {
                console.log("MyDataApp: Nastavenia registrácie sa nenašli v Firestore. Používajú sa predvolené prázdne hodnoty.");
                setRegistrationStartDate('');
                setRegistrationEndDate('');
            }
            setSettingsLoaded(true);
            console.log("MyDataApp: Načítanie nastavení dokončené, settingsLoaded: true.");
          }, error => {
            console.error("MyDataApp: Chyba pri načítaní nastavení registrácie (onSnapshot error):", error);
            setError(`Chyba pri načítaní nastavení: ${error.message}`);
            setSettingsLoaded(true); // Nastavenia sú načítané aj v prípade chyby
          });

          return () => {
            if (unsubscribeSettings) {
                console.log("MyDataApp: Ruším odber onSnapshot pre nastavenia registrácie.");
                unsubscribeSettings();
            }
          };
      } catch (e) {
          console.error("MyDataApp: Chyba pri nastavovaní onSnapshot pre nastavenia registrácie (try-catch):", e);
          setError(`Chyba pri nastavovaní poslucháča pre nastavenia: ${e.message}`);
          setSettingsLoaded(true);
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

  // useEffect for updating header link visibility
  React.useEffect(() => {
    console.log(`MyDataApp: useEffect pre aktualizáciu odkazov hlavičky. User: ${user ? user.uid : 'null'}, isRegistrationOpen: ${isRegistrationOpen}`);
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
        console.log("MyDataApp: Používateľ prihlásený. Skryté: Prihlásenie, Registrácia. Zobrazené: Moja zóna, Odhlásenie.");
      } else { // If user is not logged in
        authLink.classList.remove('hidden');
        profileLink && profileLink.classList.add('hidden');
        logoutButton && logoutButton.classList.add('hidden');
        if (isRegistrationOpen) {
          registerLink && registerLink.classList.remove('hidden');
          console.log("MyDataApp: Používateľ odhlásený, registrácia otvorená. Zobrazené: Prihlásenie, Registrácia.");
        } else {
          registerLink && registerLink.classList.add('hidden');
          console.log("MyDataApp: Používateľ odhlásený, registrácia zatvorená. Zobrazené: Prihlásenie. Skryté: Registrácia.");
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
      setUserNotificationMessage("Úspešne odhlásený.");
      window.location.href = 'login.html';
    } catch (e) {
      console.error("MyDataApp: Chyba pri odhlásení:", e);
      setError(`Chyba pri odhlásení: ${e.message}`);
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

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!db || !user) {
      setError("Databáza alebo používateľ nie je k dispozícii.");
      return;
    }
    setLoading(true);
    setError('');
    setUserNotificationMessage('');

    // Phone number validation
    const phoneRegex = /^\+\d+$/;
    if (!contactPhoneNumber || !phoneRegex.test(contactPhoneNumber)) {
        setError("Telefónne číslo kontaktnej osoby musí začínať znakom '+' a obsahovať iba číslice (napr. +421901234567).");
        setLoading(false);
        return;
    }

    try {
      const userDocRef = db.collection('users').doc(user.uid);
      await userDocRef.update({
        firstName: firstName,
        lastName: lastName,
        contactPhoneNumber: contactPhoneNumber,
        displayNotifications: displayNotifications
      });
      await user.updateProfile({ displayName: `${firstName} ${lastName}` });
      setUserNotificationMessage("Profil úspešne aktualizovaný!");
    } catch (e) {
      console.error("MyDataApp: Chyba pri aktualizácii profilu:", e);
      setError(`Chyba pri aktualizácii profilu: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!auth || !db || !user) {
      setError("Auth, databáza alebo používateľ nie je k dispozícii.");
      return;
    }
    setLoading(true);
    setError('');
    setUserNotificationMessage('');
    try {
      // 1. Delete user data from Firestore
      await db.collection('users').doc(user.uid).delete();
      console.log("MyDataApp: Používateľské dáta vymazané z Firestore.");

      // 2. Delete user from Firebase Authentication
      await user.delete();
      console.log("MyDataApp: Používateľ vymazaný z Firebase Auth.");

      setUserNotificationMessage("Účet bol úspešne zmazaný. Budete presmerovaní na prihlasovaciu stránku.");
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 3000);
    } catch (e) {
      console.error("MyDataApp: Chyba pri mazaní účtu:", e);
      setError(`Chyba pri mazaní účtu: ${e.message}. Možno sa musíte znova prihlásiť, ak ste sa prihlásili príliš dávno.`);
    } finally {
      setLoading(false);
      setShowConfirmationModal(false); // Close modal even on error
    }
  };

  const handleFetchAllUsers = React.useCallback(async () => {
    // Kontrola oprávnení teraz používa userProfileData.role
    if (!db || !userProfileData || userProfileData.role !== 'admin') {
      setError("Nemáte oprávnenie na zobrazenie používateľov.");
      setLoading(false); // Nastavíme loading na false aj tu
      return;
    }
    setLoading(true);
    setError('');
    try {
      const usersSnapshot = await db.collection('users').get();
      const usersList = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllUsers(usersList);
    } catch (e) {
      console.error("MyDataApp: Chyba pri načítaní všetkých používateľov:", e);
      setError(`Chyba pri načítaní používateľov: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [db, userProfileData]); // Závisí od userProfileData

  React.useEffect(() => {
    // Podmienka na spustenie handleFetchAllUsers závisí od userProfileData.role
    if (userProfileData && userProfileData.role === 'admin' && db) {
      handleFetchAllUsers();
    }
  }, [userProfileData, db, handleFetchAllUsers]); // Závisí od userProfileData

  const openConfirmationModal = (user) => {
    setUserToDelete(user);
    setShowConfirmationModal(true);
  };

  const closeConfirmationModal = () => {
    setUserToDelete(null);
    setShowConfirmationModal(false);
  };

  const openRoleEditModal = (user) => {
    setUserToEditRole(user);
    setNewRole(user.role); // Set current role as default
    setShowRoleEditModal(true);
  };

  const closeRoleEditModal = () => {
    setUserToEditRole(null);
    setShowRoleEditModal(false);
  };

  const handleUpdateUserRole = async () => {
    // Podmienka na kontrolu roly admina závisí od userProfileData.role
    if (!db || !userToEditRole || !userProfileData || userProfileData.role !== 'admin') {
      setError("Nemáte oprávnenie na zmenu rolí alebo chýbajú dáta.");
      return;
    }
    setLoading(true);
    setError('');
    setUserNotificationMessage('');
    try {
      const userDocRef = db.collection('users').doc(userToEditRole.id);
      await userDocRef.update({
        role: newRole,
        // Ak nastavujeme na admina, nastavíme approved na false, inak na true
        approved: newRole === 'admin' ? false : true
      });
      setUserNotificationMessage(`Rola pre ${userToEditRole.email} bola aktualizovaná na '${newRole}'.`);
      closeRoleEditModal();
      handleFetchAllUsers(); // Refresh the user list
      
      // Send email notification about role change
      try {
        const payload = {
          action: 'sendRoleChangeNotification',
          email: userToEditRole.email,
          newRole: newRole,
          isApproved: newRole === 'admin' ? false : true // Pass the approval status
        };
        console.log("MyDataApp: Odosielanie dát do Apps Script (zmena roly):", payload);
        const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        });
        console.log("MyDataApp: Požiadavka na odoslanie e-mailu o zmene roly odoslaná.");
        try {
          const responseData = await response.text();
          console.log("MyDataApp: Odpoveď z Apps Script (fetch - zmena roly) ako text:", responseData);
        } catch (jsonError) {
          console.warn("MyDataApp: Nepodarilo sa analyzovať odpoveď z Apps Script (očakávané s 'no-cors' pre JSON):", jsonError);
        }
      } catch (emailError) {
        console.error("MyDataApp: Chyba pri odosielaní e-mailu o zmene roly cez Apps Script (chyba fetch):", emailError);
      }

    } catch (e) {
      console.error("MyDataApp: Chyba pri aktualizácii roly:", e);
      setError(`Chyba pri aktualizácii roly: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveUser = async (targetUser) => {
    // Podmienka na kontrolu roly admina závisí od userProfileData.role
    if (!db || !userProfileData || userProfileData.role !== 'admin') {
      setError("Nemáte oprávnenie na schvaľovanie používateľov.");
      return;
    }
    setLoading(true);
    setError('');
    setUserNotificationMessage('');
    try {
      const userDocRef = db.collection('users').doc(targetUser.id);
      await userDocRef.update({
        approved: true
      });
      setUserNotificationMessage(`Používateľ ${targetUser.email} bol schválený.`);
      handleFetchAllUsers(); // Refresh the user list

      // Send email notification about approval
      try {
        const payload = {
          action: 'sendApprovalNotification',
          email: targetUser.email,
          firstName: targetUser.firstName,
          lastName: targetUser.lastName
        };
        console.log("MyDataApp: Odosielanie dát do Apps Script (schválenie):", payload);
        const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        });
        console.log("MyDataApp: Požiadavka na odoslanie e-mailu o schválení odoslaná.");
        try {
          const responseData = await response.text();
          console.log("MyDataApp: Odpoveď z Apps Script (fetch - schválenie) ako text:", responseData);
        } catch (jsonError) {
          console.warn("MyDataApp: Nepodarilo sa analyzovať odpoveď z Apps Script (očakávané s 'no-cors' pre JSON):", jsonError);
        }
      } catch (emailError) {
        console.error("MyDataApp: Chyba pri odosielaní e-mailu o schválení cez Apps Script (chyba fetch):", emailError);
      }

    } catch (e) {
      console.error("MyDataApp: Chyba pri schvaľovaní používateľa:", e);
      setError(`Chyba pri schvaľovaní používateľa: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

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

      if (regStart && regEnd && regStart >= regEnd) {
        setError("Dátum začiatku registrácie musí byť pred dátumom konca registrácie.");
        setLoading(false);
        return;
      }

      const settingsDocRef = db.collection('settings').doc('registration');
      await settingsDocRef.set({
        registrationStartDate: regStart ? firebase.firestore.Timestamp.fromDate(regStart) : null,
        registrationEndDate: regEnd ? firebase.firestore.Timestamp.fromDate(regEnd) : null,
      });
      setUserNotificationMessage("Nastavenia registrácie úspešne aktualizované!");
    } catch (e) {
      console.error("MyDataApp: Chyba pri aktualizácii nastavení registrácie:", e);
      setError(`Chyba pri aktualizácii nastavení: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Display loading state
  // Ak je user === undefined (ešte nebola skontrolovaná autentifikácia), alebo settingsLoaded je false,
  // alebo userProfileData je null (ešte neboli načítané dáta profilu), alebo loading je true, zobraz loading.
  if (!isAuthReady || user === undefined || !settingsLoaded || (user && !userProfileData) || loading) {
    // Ak je užívateľ null a auth je ready, znamená to, že nie je prihlásený, presmeruj
    if (isAuthReady && user === null) {
        console.log("MyDataApp: Auth je ready a používateľ je null, presmerovávam na login.html");
        window.location.href = 'login.html';
        return null;
    }
    // Zobrazenie rôznych správ podľa stavu načítavania
    let loadingMessage = 'Načítavam...';
    if (isAuthReady && user && !settingsLoaded) {
        loadingMessage = 'Načítavam...';
    } else if (isAuthReady && user && settingsLoaded && !userProfileData) {
        loadingMessage = 'Načítavam používateľské dáta...'; // Špecifická správa pre profilové dáta
    } else if (loading) { // Všeobecný stav načítavania, napr. pri odosielaní formulára
        loadingMessage = 'Načítavam...';
    }

    return React.createElement(
      'div',
      { className: 'flex items-center justify-center min-h-screen bg-gray-100' },
      React.createElement('div', { className: 'text-xl font-semibold text-gray-700' }, loadingMessage)
    );
  }

  const currentPath = window.location.pathname.split('/').pop();
  const is_admin_panel_page = currentPath === 'admin-panel.html';

  // If user is not admin and trying to access admin panel, redirect
  // Používame userProfileData.role pre kontrolu oprávnení
  if (is_admin_panel_page && userProfileData && userProfileData.role !== 'admin') {
    console.log("MyDataApp: Používateľ nie je admin a snaží sa pristupovať k admin panelu, presmerovávam.");
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
    showConfirmationModal && React.createElement(ConfirmationModal, {
        message: `Naozaj chcete zmazať účet ${userToDelete?.email}? Túto akciu nie je možné vrátiť späť.`,
        onConfirm: handleDeleteAccount,
        onCancel: closeConfirmationModal
    }),
    showRoleEditModal && React.createElement(EditRoleModal, {
        userToEditRole: userToEditRole,
        newRole: newRole,
        setNewRole: setNewRole,
        closeRoleEditModal: closeRoleEditModal,
        handleUpdateUserRole: handleUpdateUserRole,
        loading: loading
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
          is_admin_panel_page ? 'Administrátorský panel' : 'Moja zóna'
        ),
        // Používame userProfileData pre zobrazenie mena a roly
        userProfileData && React.createElement(
          'p',
          { className: 'text-lg text-gray-600 text-center mb-4' },
          `Vitajte, ${userProfileData.firstName || userProfileData.email}! Vaša rola: ${userProfileData.role === 'admin' ? 'Administrátor' : 'Používateľ'}.`,
          userProfileData.role === 'admin' && !userProfileData.approved && React.createElement(
            'span',
            { className: 'text-red-500 font-semibold ml-2' },
            '(Čaká sa na schválenie)'
          )
        ),

        // My Data Section
        !is_admin_panel_page && React.createElement(
          React.Fragment,
          null,
          React.createElement('h2', { className: 'text-2xl font-bold text-gray-800 mt-8 mb-4' }, 'Moje údaje'),
          React.createElement(
            'form',
            { onSubmit: handleUpdateProfile, className: 'space-y-4' },
            React.createElement(
              'div',
              null,
              React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'first-name' }, 'Meno'),
              React.createElement('input', {
                type: 'text',
                id: 'first-name',
                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                value: firstName,
                onChange: (e) => setFirstName(e.target.value),
                required: true,
                disabled: loading,
              })
            ),
            React.createElement(
              'div',
              null,
              React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'last-name' }, 'Priezvisko'),
              React.createElement('input', {
                type: 'text',
                id: 'last-name',
                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                value: lastName,
                onChange: (e) => setLastName(e.target.value),
                required: true,
                disabled: loading,
              })
            ),
            React.createElement(
              'div',
              null,
              React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'contact-phone' }, 'Telefónne číslo kontaktnej osoby'),
              React.createElement('input', {
                type: 'tel',
                id: 'contact-phone',
                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                value: contactPhoneNumber,
                onChange: (e) => {
                  const value = e.target.value;
                  if (value === '') {
                    setContactPhoneNumber('');
                    e.target.setCustomValidity('');
                    return;
                  }
                  if (value.length === 1 && value !== '+') {
                    e.target.setCustomValidity("Telefónne číslo musí začínať znakom '+'.");
                    e.target.reportValidity();
                    return;
                  }
                  if (value.length > 1 && !/^\+\d*$/.test(value)) {
                    e.target.setCustomValidity("Po znaku '+' sú povolené iba číslice.");
                    e.target.reportValidity();
                    return;
                  }
                  setContactPhoneNumber(value);
                  e.target.setCustomValidity('');
                },
                onInvalid: (e) => {
                  if (e.target.value.length === 0) {
                    e.target.setCustomValidity("Vyplňte prosím toto pole.");
                  } else if (e.target.value.length === 1 && e.target.value !== '+') {
                    e.target.setCustomValidity("Telefónne číslo musí začínať znakom '+'.");
                  } else if (e.target.value.length > 1 && !/^\+\d*$/.test(e.target.value)) {
                    e.target.setCustomValidity("Po znaku '+' sú povolené iba číslice.");
                  } else {
                    e.target.setCustomValidity("Telefónne číslo musí začínať znakom '+' a obsahovať iba číslice (napr. +421901234567).");
                  }
                },
                required: true,
                placeholder: '+421901234567',
                pattern: '^\\+\\d+$',
                title: 'Telefónne číslo musí začínať znakom '+' a obsahovať iba číslice (napr. +421901234567).',
                disabled: loading,
              })
            ),
            React.createElement(
              'div',
              null,
              React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'email-display' }, 'E-mailová adresa'),
              React.createElement('input', {
                type: 'email',
                id: 'email-display',
                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
                value: email,
                disabled: true, // Email is read-only
              })
            ),
            React.createElement(
              'div',
              { className: 'flex items-center mt-4' },
              React.createElement('input', {
                type: 'checkbox',
                id: 'display-notifications',
                className: 'mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded',
                checked: displayNotifications,
                onChange: (e) => setDisplayNotifications(e.target.checked),
                disabled: loading,
              }),
              React.createElement('label', { className: 'text-gray-700 text-sm', htmlFor: 'display-notifications' }, 'Zobrazovať notifikácie a oznámenia')
            ),
            React.createElement(
              'button',
              {
                type: 'submit',
                className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200',
                disabled: loading,
              },
              loading ? 'Ukladám...' : 'Uložiť zmeny'
            )
          ),
        ),

        // Admin Panel Section
        // Používame userProfileData.role pre podmienku zobrazenia admin panelu
        userProfileData && userProfileData.role === 'admin' && React.createElement(
          React.Fragment,
          null,
          React.createElement('h2', { className: 'text-2xl font-bold text-gray-800 mt-8 mb-4' }, 'Nastavenia registrácie'),
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
              'button',
              {
                type: 'submit',
                className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200',
                disabled: loading,
              },
              loading ? 'Ukladám...' : 'Aktualizovať nastavenia'
            )
          ),

          React.createElement('h2', { className: 'text-2xl font-bold text-gray-800 mt-8 mb-4' }, 'Správa používateľov'),
          React.createElement(
            'div',
            { className: 'overflow-x-auto' },
            React.createElement(
              'table',
              { className: 'min-w-full bg-white rounded-lg shadow overflow-hidden' },
              React.createElement(
                'thead',
                { className: 'bg-gray-200 text-gray-700' },
                React.createElement(
                  'tr',
                  null,
                  React.createElement('th', { className: 'py-3 px-4 text-left' }, 'E-mail'),
                  React.createElement('th', { className: 'py-3 px-4 text-left' }, 'Meno'),
                  React.createElement('th', { className: 'py-3 px-4 text-left' }, 'Rola'),
                  React.createElement('th', { className: 'py-3 px-4 text-left' }, 'Schválený'),
                  React.createElement('th', { className: 'py-3 px-4 text-left' }, 'Akcie')
                )
              ),
              React.createElement(
                'tbody',
                null,
                allUsers.map((u) => (
                  React.createElement(
                    'tr',
                    { key: u.id, className: 'border-b border-gray-200 hover:bg-gray-50' },
                    React.createElement('td', { className: 'py-3 px-4' }, u.email),
                    React.createElement('td', { className: 'py-3 px-4 whitespace-nowrap' }, `${u.firstName || ''} ${u.lastName || ''}`),
                    React.createElement('td', { className: 'py-3 px-4' }, u.role),
                    React.createElement('td', { className: 'py-3 px-4' }, u.approved ? 'Áno' : 'Nie'),
                    React.createElement(
                      'td',
                      { className: 'py-3 px-4 flex space-x-2' },
                      React.createElement(
                        'button',
                        {
                          onClick: () => openRoleEditModal(u),
                          className: 'bg-yellow-500 hover:bg-yellow-600 text-white py-1 px-3 rounded-lg text-sm transition-colors duration-200',
                          disabled: loading || u.id === user.uid, // Cannot edit own role
                        },
                        'Upraviť rolu'
                      ),
                      u.role === 'admin' && !u.approved && React.createElement(
                        'button',
                        {
                          onClick: () => handleApproveUser(u),
                          className: 'bg-green-500 hover:bg-green-600 text-white py-1 px-3 rounded-lg text-sm transition-colors duration-200',
                          disabled: loading,
                        },
                        'Schváliť'
                      ),
                      React.createElement(
                        'button',
                        {
                          onClick: () => openConfirmationModal(u),
                          className: 'bg-red-500 hover:bg-red-600 text-white py-1 px-3 rounded-lg text-sm transition-colors duration-200',
                          disabled: loading || u.id === user.uid, // Cannot delete own account here
                        },
                        'Zmazať'
                      )
                    )
                  )
                ))
              )
            )
          )
        )
      )
    )
  );
}
