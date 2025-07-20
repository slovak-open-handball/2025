const appId = '1:26454452024:web:6954b4f90f87a3a1eb43cd'; // Globálne definované
const firebaseConfig = { // Globálne definované
  apiKey: "AIzaSyDj_bSTkjrquu1nyIVYW7YLbyBl1pD6YYo",
  authDomain: "prihlasovanie-4f3f3.firebaseapp.com",
  projectId: "prihlasovanie-4f3f3",
  storageBucket: "prihlasovanie-4f3f3.firebasestorage.app",
  messagingSenderId: "26454452024",
  appId: "1:26454452024:web:6954b4f90f87a3a1eb43cd"
};
const initialAuthToken = null; // Globálne definované

// Komponenta pre vstup hesla s prepínaním viditeľnosti
function PasswordInput({ id, label, value, onChange, placeholder, autoComplete, showPassword, toggleShowPassword, onCopy, onPaste, onCut, disabled, description }) {
  // ZMENA: Aktualizované SVG cesty pre ikony z Heroicons pre správnu funkčnosť
  const EyeIcon = (
    <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 5 12 5c4.638 0 8.573 2.51 9.963 7.322.034.139.034.279 0 .418A10.05 10.05 0 0112 19c-4.638 0-8.573-2.51-9.963-7.322zM15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );

  const EyeOffIcon = (
    <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.274-4.057 5.064-7 9.542-7a9.95 9.95 0 011.875.175m.001 0V5m0 14v-2.175m0-10.65L12 12m-6.25 6.25L12 12m0 0l6.25-6.25M12 12l-6.25-6.25" />
    </svg>
  );

  return (
    <div className="relative">
      <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor={id}>{label}</label>
      <input
        type={showPassword ? "text" : "password"}
        id={id}
        className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10"
        value={value}
        onChange={onChange}
        onCopy={(e) => e.preventDefault()}
        onPaste={(e) => e.preventDefault()}
        onCut={(e) => e.preventDefault()}
        required
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled} // Added disabled prop
      />
      <button
        type="button"
        onClick={toggleShowPassword}
        className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
        disabled={disabled} // Disabled if parent form is disabled
      >
        {showPassword ? EyeOffIcon : EyeIcon}
      </button>
      {description && ( // Render description if provided
        <p className="text-gray-600 text-sm -mt-2">
          {description}
        </p>
      )}
    </div>
  );
}

// Helper function to format a Date object into 'YYYY-MM-DDTHH:mm' local string
// This ensures the datetime-local input displays the time in the user's local timezone.
const formatToDatetimeLocal = (date) => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// NotificationModal Component
function NotificationModal({ message, onClose }) { // isVisible prop removed
  const [show, setShow] = React.useState(false);
  const timerRef = React.useRef(null); // Use a ref to store the timer ID

  React.useEffect(() => {
    // If a message is provided, show the modal and start the timer
    if (message) {
      setShow(true);
      // Clear any existing timer to prevent multiple timers running
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        setShow(false); // Trigger fade-out animation
        // Call onClose after the fade-out animation completes
        setTimeout(onClose, 500); // 500ms for slide-up/fade-out animation
      }, 10000); // Display for 10 seconds
    } else {
      // If message is empty/null, hide the modal immediately and clear timer
      setShow(false);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    // Cleanup function: clear timer when component unmounts or dependencies change
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [message, onClose]); // Re-run when message or onClose changes

  // Only render the component if 'show' is true (for animation) or if there's a message (initial render)
  if (!show && !message) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 flex justify-center p-4 transition-transform duration-500 ease-out ${
        show ? 'translate-y-0' : '-translate-y-full'
      }`}
      style={{ pointerEvents: 'none' }} // Allows clicks to pass through
    >
      <div
        className="bg-[#3A8D41] text-white px-6 py-3 rounded-lg shadow-lg max-w-md w-full text-center"
        style={{ pointerEvents: 'auto' }} // Re-enables clicks for the modal content
      >
        <p className="font-semibold">{message}</p>
      </div>
    </div>
  );
}


function App() {
  const RECAPTCHA_SITE_KEY = "6LdJbn8rAAAAAO4C50qXTWva6ePzDlOfYwBDEDwa";
  // UPDATED: Zmenená URL adresa pre Google Apps Script
  const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec"; 

  const [app, setApp] = React.useState(null);
  const [auth, setAuth] = React.useState(null);
  const [db, setDb] = React.useState(null);
  const [user, setUser] = React.useState(null);
  const [isAuthReady, setIsAuthReady] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [contactPhoneNumber, setContactPhoneNumber] = React.useState('');

  const [newPassword, setNewPassword] = React.useState('');
  const [confirmNewPassword, setNewConfirmPassword] = React.useState('');
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newFirstName, setNewFirstName] = React.useState('');
  const [newLastName, setNewLastName] = React.useState('');
  const [newContactPhoneNumber, setNewContactPhoneNumber] = React.useState('');

  // Stavy pre nastavenia dátumov a časov
  const [registrationStartDate, setRegistrationStartDate] = React.useState('');
  const [registrationEndDate, setRegistrationEndDate] = React.useState('');
  const [userDataEditEndDate, setUserDataEditEndDate] = React.useState('');
  const [settingsLoaded, setSettingsLoaded] = React.useState(false); // Indikátor načítania nastavení

  // Nový stav pre odpočítavanie
  const [countdown, setCountdown] = React.useState(null);
  // Nová stavová premenná na vynútenie prepočítania isRegistrationOpen
  const [forceRegistrationCheck, setForceRegistrationCheck] = React.useState(0);
  // Nová stavová premenná pre periodickú aktualizáciu isRegistrationOpen
  const [periodicRefreshKey, setPeriodicRefreshKey] = React.useState(0);


  const getInitialProfileView = () => {
    const hash = window.location.hash.substring(1);
    return hash || 'my-data';
  };
  const [profileView, setProfileView] = React.useState(getInitialProfileView);

  const [isAdmin, setIsAdmin] = React.useState(false);
  const [allUsersData, setAllUsersData] = React.useState([]); // State to hold all user data
  const [isRoleLoaded, setIsRoleLoaded] = React.useState(false);

  const [showPasswordReg, setShowPasswordReg] = React.useState(false);
  const [showConfirmPasswordReg, setShowConfirmPasswordReg] = React.useState(false);
  const [showPasswordLogin, setShowPasswordLogin] = React.useState(false);
  const [showCurrentPasswordChange, setShowCurrentPasswordChange] = React.useState(false);
  const [showNewPasswordChange, setShowNewPasswordChange] = React.useState(false);
  const [showConfirmNewPasswordChange, setShowConfirmNewPasswordChange] = React.useState(false);

  const [showDeleteConfirmationModal, setShowDeleteConfirmationModal] = React.useState(false);
  const [userToDelete, setUserToDelete] = React.useState(null);
  const [showRoleEditModal, setShowRoleEditModal] = React.useState(false);
  const [userToEditRole, setUserToEditRole] = React.useState(null);
  const [newRole, setNewRole] = React.useState('');

  // ZMENA: Nový stav pre upozornenia pre VŠETKÝCH používateľov
  const [userNotifications, setUserNotifications] = React.useState([]);
  // ZMENA: Odstránený showUserNotificationModal, teraz sa spravuje cez userNotificationMessage
  const [userNotificationMessage, setUserNotificationMessage] = React.useState('');

  // Nové stavy pre posielanie správ
  const [checkedRecipients, setCheckedRecipients] = React.useState({}); // ZMENA: Objekt pre začiarknuté políčka
  const [messageSubject, setMessageSubject] = React.useState('');
  const [messageContent, setMessageContent] = React.useState('');
  const [receivedMessages, setReceivedMessages] = React.useState([]);
  const [searchQuery, setSearchQuery] = React.useState(''); // NOVÉ: Stav pre vyhľadávací dotaz

  // New states to hold raw data from each collection
  const [systemAlerts, setSystemAlerts] = React.useState([]);
  // ZMENA: Odstránený stav adminDirectMessages, použijeme receivedMessages


  // Vypočítajte stav registrácie ako memoizovanú hodnotu
  const isRegistrationOpen = React.useMemo(() => {
    if (!settingsLoaded) return false; // Počkajte, kým sa načítajú nastavenia
    const now = new Date();
    const regStart = registrationStartDate ? new Date(registrationStartDate) : null;
    const regEnd = registrationEndDate ? new Date(registrationEndDate) : null;

    // Kontrola, či sú dátumy platné pred porovnaním
    const isRegStartValid = regStart instanceof Date && !isNaN(regStart);
    const isRegEndValid = regEnd instanceof Date && !isNaN(regEnd);

    return (
      (isRegStartValid ? now >= regStart : true) && // Ak regStart nie je platný, predpokladáme, že registrácia už začala
      (isRegEndValid ? now <= regEnd : true)        // Ak regEnd nie je platný, predpokladáme, že registrácia ešte neskončila
    );
  }, [settingsLoaded, registrationStartDate, registrationEndDate, forceRegistrationCheck, periodicRefreshKey]); // Pridaná závislosť periodicRefreshKey

  // Funkcia na výpočet zostávajúceho času pre odpočítavanie
  const calculateTimeLeft = React.useCallback(() => {
    const now = new Date();
    const startDate = registrationStartDate ? new Date(registrationStartDate) : null;

    // Ak startDate nie je platný dátum, alebo už je v minulosti, odpočítavanie nie je potrebné
    if (!startDate || isNaN(startDate) || now >= startDate) {
        return null; 
    }

    const difference = startDate.getTime() - now.getTime(); // Rozdiel v milisekách

    if (difference <= 0) {
        return null; // Čas už uplynul
    }

    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((difference % (1000 * 60)) / 1000);

    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  }, [registrationStartDate]);


  // Efekt pre inicializáciu Firebase a nastavenie Auth Listenera (spustí sa len raz)
  React.useEffect(() => {
    let unsubscribeAuth;
    let firestoreInstance; // Deklarujeme ju tu, aby bola dostupná v celom efekte

    try {
      if (typeof firebase === 'undefined') {
        setError("Firebase SDK nie je načítané. Skontrolujte index.html.");
        setLoading(false);
        return;
      }

      const firebaseApp = firebase.initializeApp(firebaseConfig);
      setApp(firebaseApp);

      const authInstance = firebase.auth(firebaseApp);
      setAuth(authInstance);
      firestoreInstance = firebase.firestore(firebaseApp); // Nastavíme ju tu
      setDb(firestoreInstance); // Uložíme ju do stavu

      const signIn = async () => {
        try {
          if (initialAuthToken) {
            await authInstance.signInWithCustomToken(initialAuthToken);
          } else {
            // Ak nechcete automatické prihlásenie anonymného používateľa,
            // odstráňte tento riadok. Používateľ bude musieť explicitne
            // prihlásiť sa alebo zaregistrovať.
          }
        } catch (e) {
          console.error("Firebase initial sign-in failed:", e);
          setError(`Chyba pri prihlasovaní: ${e.message}`);
        }
      };

      // Listener pre zmeny stavu autentifikácie
      unsubscribeAuth = authInstance.onAuthStateChanged(async (currentUser) => {
        setUser(currentUser);
        setIsAuthReady(true);
        setIsRoleLoaded(false); // Reset pred pokusom o načítanie roly

        if (currentUser) { // Check for currentUser first
          console.log("onAuthStateChanged: Používateľ je prihlásený. UID:", currentUser.uid);
          console.log("onAuthStateChanged: DB instance is:", firestoreInstance); // Check if db is available
          if (firestoreInstance) { // Ensure db is not null before using it
            try {
              const userDocRef = firestoreInstance.collection('users').doc(currentUser.uid);
              // ZMENA: Používame onSnapshot namiesto get() pre robustnejšie načítanie dát používateľa
              const unsubscribeUserDoc = userDocRef.onSnapshot(docSnapshot => {
                console.log("onAuthStateChanged (onSnapshot): Skúšam načítať dokument pre UID:", currentUser.uid, "Dokument existuje:", docSnapshot.exists);
                if (docSnapshot.exists) {
                  const userData = docSnapshot.data();
                  console.log("onAuthStateChanged (onSnapshot): Dáta používateľa z Firestore:", userData);
                  
                  // NOVÁ KONTROLA: Ak je admin a approved je false, okamžite odhlásiť
                  if (userData.role === 'admin' && userData.approved === false && window.location.pathname.split('/').pop() === 'logged-in.html') {
                    console.log("Admin s approved: false je prihlásený. Okamžité odhlásenie.");
                    authInstance.signOut().then(() => {
                      setUser(null);
                      window.location.href = 'login.html';
                    }).catch(e => console.error("Chyba pri odhlasovaní neoprávneného admina:", e));
                    return; // Zastaviť ďalšie spracovanie, kým sa používateľ odhlási
                  }

                  setIsAdmin(userData.role === 'admin');
                  console.log("onAuthStateChanged (onSnapshot): isAdmin nastavené na:", userData.role === 'admin');
                  
                  setUser(prevUser => ({
                    ...prevUser,
                    ...userData,
                    displayName: userData.firstName && userData.lastName ? `${userData.firstName} ${userData.lastName}` : userData.email,
                    displayNotifications: userData.displayNotifications !== undefined ? userData.displayNotifications : true
                  }));
                  setIsRoleLoaded(true); // Rola je načítaná
                } else {
                  console.log("onAuthStateChanged (onSnapshot): Dokument používateľa vo Firestore neexistuje pre UID:", currentUser.uid);
                  setIsAdmin(false);
                  setUser(prevUser => ({
                    ...prevUser,
                    displayNotifications: true
                  }));
                  setIsRoleLoaded(false); // Keep loading state if doc doesn't exist
                }
              }, error => {
                console.error("Chyba pri načítaní roly používateľa z Firestore (onSnapshot) pre UID:", currentUser.uid, error);
                setIsAdmin(false);
                setIsRoleLoaded(false); // Nastavíme, že rola je načítaná aj pri chybe
              });

              // Vráťte funkciu unsubscribe pre userDoc listener, aby sa tiež vyčistil
              // Toto je dôležité, aby sa listener vyčistil, ak sa komponent odpojí
              return () => {
                if (unsubscribeAuth) unsubscribeAuth();
                if (unsubscribeUserDoc) unsubscribeUserDoc();
              };

            } catch (e) {
              console.error("Chyba pri nastavení onSnapshot pre rolu používateľa:", e);
              setIsAdmin(false);
              setIsRoleLoaded(false);
            }
          } else {
            console.log("onAuthStateChanged: Firestore DB inštancia nie je k dispozícii.");
            setIsAdmin(false);
            setIsRoleLoaded(false);
          }
        } else {
          console.log("onAuthStateChanged: Používateľ nie je prihlásený.");
          setIsAdmin(false);
          setIsRoleLoaded(true); // Ak nie je prihlásený, rola je "načítaná" (žiadna)
        }
      });

      signIn(); // Spustí počiatočné prihlásenie

      return () => {
        if (unsubscribeAuth) {
          unsubscribeAuth(); // Vyčistenie listenera
        }
      }; 
    } catch (e) {
      console.error("Failed to initialize Firebase:", e);
      setError(`Chyba pri inicializácii Firebase: ${e.message}`);
      setLoading(false);
    }
  }, []); // Prázdne pole závislostí - spustí sa len raz pri mountovaní komponentu

  // Efekt pre načítanie nastavení (spustí sa po inicializácii DB a Auth)
  React.useEffect(() => {
    const fetchSettings = async () => {
      if (!db || !isAuthReady) {
        return; // Čakáme na inicializáciu DB a Auth
      }
      try {
          // Používame onSnapshot pre real-time aktualizácie nastavení
          const settingsDocRef = db.collection('settings').doc('registration');
          const unsubscribeSettings = settingsDocRef.onSnapshot(docSnapshot => {
            if (docSnapshot.exists) {
                const data = docSnapshot.data();
                setRegistrationStartDate(data.registrationStartDate ? formatToDatetimeLocal(data.registrationStartDate.toDate()) : '');
                setRegistrationEndDate(data.registrationEndDate ? formatToDatetimeLocal(data.registrationEndDate.toDate()) : '');
                setUserDataEditEndDate(data.userDataEditEndDate ? formatToDatetimeLocal(data.userDataEditEndDate.toDate()) : '');
            } else {
                console.log("Nastavenia registrácie neboli nájdené vo Firestore. Používam predvolené prázdne hodnoty.");
                setRegistrationStartDate('');
                setRegistrationEndDate('');
                setUserDataEditEndDate('');
            }
            setSettingsLoaded(true); // Nastavenia sú načítané, aj keď prázdne alebo s chybou
            setLoading(false); // Celkové načítanie je hotové
          }, error => {
            console.error("Chyba pri načítaní nastavení registrácie (onSnapshot):", error);
            setError(`Chyba pri načítaní nastavení: ${error.message}`);
            setSettingsLoaded(true);
            setLoading(false);
          });

          return () => unsubscribeSettings(); // Vyčistenie onSnapshot listenera pri unmount
      } catch (e) {
          console.error("Chyba pri nastavení onSnapshot pre nastavenia registrácie:", e);
          setError(`Chyba pri nastavení listenera pre nastavenia: ${e.message}`);
          setSettingsLoaded(true);
          setLoading(false);
      }
    };

    fetchSettings();
  }, [db, isAuthReady]); // Načíta nastavenia, keď je DB a Auth pripravené


  // Efekt pre odpočítavanie času (spustí sa pri zmene registrationStartDate)
  React.useEffect(() => {
    let timer;
    const updateCountdown = () => {
        const timeLeft = calculateTimeLeft();
        setCountdown(timeLeft);
        // Ak čas vypršal, vynútime prepočítanie isRegistrationOpen
        if (timeLeft === null) {
            clearInterval(timer);
            setForceRegistrationCheck(prev => prev + 1); // Zmeníme stav, aby sa isRegistrationOpen prepočítalo
        }
    };

    // Spustite odpočítavanie len ak je nastavený dátum začiatku a je v budúcnosti
    if (registrationStartDate && new Date(registrationStartDate) > new Date()) {
        updateCountdown(); // Počiatočné volanie pre okamžité zobrazenie
        timer = setInterval(updateCountdown, 1000);
    } else {
        setCountdown(null); // Vymažte odpočítavanie, ak nie je relevantné
    }

    return () => clearInterval(timer); // Vyčistenie intervalu pri unmount alebo zmene registrationStartDate
  }, [registrationStartDate, calculateTimeLeft]); // Závisí od registrationStartDate a calculateTimeLeft

  // NOVÝ useEffect pre periodickú aktualizáciu isRegistrationOpen
  React.useEffect(() => {
    const interval = setInterval(() => {
      setPeriodicRefreshKey(prev => prev + 1);
    }, 60 * 1000); // Aktualizovať každú minútu

    return () => clearInterval(interval);
  }, []); // Spustí sa len raz pri mountovaní komponentu


  // useEffect pre aktualizáciu viditeľnosti odkazov v hlavičke
  React.useEffect(() => {
    const authLink = document.getElementById('auth-link');
    const profileLink = document.getElementById('profile-link');
    const logoutButton = document.getElementById('logout-button');
    const registerLink = document.getElementById('register-link');

    if (authLink) {
      if (user) { // Ak je používateľ prihlásený
        authLink.classList.add('hidden');
        profileLink && profileLink.classList.remove('hidden');
        logoutButton && logoutButton.classList.remove('hidden');
        registerLink && registerLink.classList.add('hidden'); // Vždy skryť pre prihlásených používateľov
      } else { // Ak používateľ nie je prihlásený
        authLink.classList.remove('hidden');
        profileLink && profileLink.classList.add('hidden');
        logoutButton && logoutButton.classList.add('hidden');
        // Podmienene zobraziť/skryť odkaz registrácie v hlavičke na základe stavu registrácie
        if (isRegistrationOpen) {
          registerLink && registerLink.classList.remove('hidden');
        } else {
          registerLink && registerLink.classList.add('hidden');
        }
      }
    }
  }, [user, isRegistrationOpen]); // Spustí sa pri zmene user alebo isRegistrationOpen


  React.useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.substring(1);
      if (hash) {
        setProfileView(hash);
      } else {
        setProfileView('my-data');
      }
    };

    handleHashChange();

    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []); // Bez závislostí, aby sa spustil len raz

  // NOVÝ useEffect pre načítanie všetkých používateľov (pre administrátorov)
  React.useEffect(() => {
    let unsubscribeAllUsers;
    if (db && user && isAdmin) { // Len ak je DB pripravená, používateľ prihlásený a je admin
      console.log("Setting up real-time listener for all users for admin view.");
      const usersCollectionRef = db.collection('users');
      unsubscribeAllUsers = usersCollectionRef.onSnapshot(snapshot => {
        const usersList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          uid: doc.id // Ensure uid is also available as doc.id
        }));
        setAllUsersData(usersList);
        console.log("All users data updated:", usersList);
      }, error => {
        console.error("Chyba pri načítaní všetkých používateľov (onSnapshot):", error);
        setError(`Chyba pri načítaní používateľov: ${error.message}`);
      });
    } else {
      setAllUsersData([]); // Vyčistite dáta, ak nie je admin
    }

    return () => {
      if (unsubscribeAllUsers) {
        unsubscribeAllUsers();
        console.log("Unsubscribed from all users listener.");
      }
    };
  }, [db, user, isAdmin]); // Závisí od db, user a isAdmin


  // ZMENA: useEffect for fetching system alerts for ALL logged-in users
  React.useEffect(() => {
    let unsubscribeSystemNotifications;
    if (db && user) { // Fetch for any logged-in user
      const systemNotificationsCollectionRef = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('notifications');
      unsubscribeSystemNotifications = systemNotificationsCollectionRef
        .orderBy('timestamp', 'desc')
        .limit(20)
        .onSnapshot(snapshot => {
          const alerts = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            type: 'system_alert',
            collection: 'notifications',
            seenBy: doc.data().seenBy || [],
            dismissedBy: doc.data().dismissedBy || []
          }));
          setSystemAlerts(alerts);
        }, error => {
          console.error("Chyba pri načítaní systémových upozornení (onSnapshot):", error);
          setError(`Chyba pri načítaní systémových upozornení: ${error.message}`);
        });
    } else {
      setSystemAlerts([]);
    }
    return () => {
      if (unsubscribeSystemNotifications) unsubscribeSystemNotifications();
    };
  }, [db, appId, user]);

  // useEffect for fetching direct messages for the current user (all roles)
  React.useEffect(() => {
    let unsubscribeMessages;
    if (db && user) {
      console.log("Setting up real-time listener for received messages for UID:", user.uid);
      const messagesCollectionRef = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('messages');
      unsubscribeMessages = messagesCollectionRef
        .where('recipients', 'array-contains', user.uid)
        .orderBy('timestamp', 'desc')
        .onSnapshot(snapshot => {
          const messagesList = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            type: 'direct_message',
            collection: 'messages',
            seenBy: doc.data().seenBy || [], // Use specific seenBy for pop-up
            readBy: doc.data().readBy || [], // Keep readBy for read status
            acknowledgedBy: doc.data().acknowledgedBy || [] // NEW: Use acknowledgedBy for dismissal
          }));
          setReceivedMessages(messagesList);
          console.log("Received messages updated:", messagesList);
        }, error => {
          console.error("Chyba pri načítaní prijatých správ (onSnapshot):", error);
          setError(`Chyba pri načítaní správ: ${e.message}`);
        });
    } else {
      setReceivedMessages([]);
    }

    return () => {
      if (unsubscribeMessages) {
        unsubscribeMessages();
        console.log("Unsubscribed from received messages listener.");
      }
    };
  }, [db, user, appId]); // Závisí od db, user a appId


  // ZMENA: useEffect to combine system alerts and direct messages for ALL logged-in users
  React.useEffect(() => {
    if (!user) { // No user, no notifications
      setUserNotifications([]);
      setUserNotificationMessage(''); // Clear message when user logs out
      return;
    }

    let allRelevantAlerts = [];
    if (isAdmin) {
        allRelevantAlerts = [
            ...systemAlerts,
            ...receivedMessages
        ];
    } else { // For 'user' role, only include direct messages
        allRelevantAlerts = receivedMessages;
    }

    // Filter for the list view (only items not dismissed/acknowledged by current user)
    const filteredForList = allRelevantAlerts.filter(alert => {
      let isDismissed = false;
      if (alert.type === 'system_alert') {
        isDismissed = alert.dismissedBy && alert.dismissedBy.includes(user.uid);
      } else if (alert.type === 'direct_message') {
        isDismissed = alert.acknowledgedBy && alert.acknowledgedBy.includes(user.uid); // NEW: Use acknowledgedBy for dismissal
      }
      return !isDismissed;
    });

    // Sort by timestamp (most recent first)
    filteredForList.sort((a, b) => (b.timestamp?.toDate() || 0) - (a.timestamp?.toDate() || 0));
    setUserNotifications(filteredForList);

    // Logic for pop-up notification
    // Find the latest unseen alert that is eligible for a pop-up
    const potentialPopups = allRelevantAlerts.filter(alert => {
      let isDismissed = false;
      if (alert.type === 'system_alert') {
        isDismissed = alert.dismissedBy && alert.dismissedBy.includes(user.uid);
      } else if (alert.type === 'direct_message') {
        isDismissed = alert.acknowledgedBy && alert.acknowledgedBy.includes(user.uid);
      }
      const hasBeenSeen = alert.seenBy && alert.seenBy.includes(user.uid);
      
      // Only consider if it's not dismissed, not seen, and for admin if it's a system alert or any if direct message
      return !isDismissed && !hasBeenSeen && (isAdmin || alert.type === 'direct_message');
    });

    // Sort potential popups by timestamp to get the latest
    potentialPopups.sort((a, b) => (b.timestamp?.toDate() || 0) - (a.timestamp?.toDate() || 0));

    const latestUnseenPopup = potentialPopups[0]; // Get the very latest unseen alert

    // If there's a new latest unseen alert and the user has notifications enabled and is admin
    // AND there is currently no message being displayed in the pop-up
    if (latestUnseenPopup && user?.displayNotifications && isAdmin && !userNotificationMessage) { 
      let messageText = latestUnseenPopup.message;
      if (latestUnseenPopup.type === 'direct_message') {
        messageText = `Nová správa od ${latestUnseenPopup.senderName || 'Neznámy odosielateľ'}: ${latestUnseenPopup.subject}`;
      }
      setUserNotificationMessage(messageText);

      // Mark this alert as seen by the current user in Firestore
      const alertRef = db.collection('artifacts').doc(appId).collection('public').doc('data').collection(latestUnseenPopup.collection).doc(latestUnseenPopup.id);
      alertRef.update({
        seenBy: firebase.firestore.FieldValue.arrayUnion(user.uid)
      }).catch(e => console.error(`Error marking ${latestUnseenPopup.type} as seen:`, e));
    }
    // The NotificationModal's internal timer will handle clearing userNotificationMessage via onClose.
    // No `else if` to hide it from here, as the modal itself controls its disappearance.

  }, [user, isAdmin, db, appId, systemAlerts, receivedMessages, user?.displayNotifications, userNotificationMessage]); // Add userNotificationMessage as dependency to re-run when it's cleared


  const getRecaptchaToken = async (action) => {
    if (typeof grecaptcha === 'undefined' || !grecaptcha.execute) {
      setError("reCAPTCHA API nie je načítané alebo pripravené.");
      return null;
    }
    try {
      const token = await grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: action });
      return token;
    } catch (e) {
      console.error("Chyba pri získavaní reCAPTCHA tokenu:", e);
      setError(`Chyba reCAPTCHA: ${e.message}`);
      return null;
    }
  };

  const clearMessages = () => {
    // Táto funkcia už nie je primárne používaná pre automatické čistenie správ po presmerovaní.
    // Správy sa teraz zobrazujú po dobu trvania setTimeout.
    // Ponechaná pre potenciálne budúce využitie alebo iné typy správ.
    setTimeout(() => {
      setMessage('');
      setError('');
    }, 5000);
  };

  const validatePassword = (pwd) => {
    const errors = [];

    if (pwd.length < 10) {
      errors.push("minimálne 10 znakov");
    }
    if (pwd.length > 4096) {
      errors.push("maximálne 4096 znakov");
    }
    if (!/[A-Z]/.test(pwd)) {
      errors.push("aspoň jedno veľké písmeno");
    }
    if (!/[a-z]/.test(pwd)) {
      errors.push("aspoň jedno malé písmeno");
    }
    if (!/[0-9]/.test(pwd)) {
      errors.push("aspoň jednu číslicu");
    }

    if (errors.length === 0) {
      return null;
    } else {
      return "Heslo musí obsahovať:\n• " + errors.join("\n• ") + ".";
    }
  };

  const handleRegister = async (e, isAdminRegistration = false) => {
    e.preventDefault();
    if (!auth || !db) {
      setError("Firebase Auth alebo Firestore nie je inicializovaný.");
      return;
    }
    // Zmenená podmienka: contactPhoneNumber je vždy vyžadované
    if (!email || !password || !confirmPassword || !firstName || !lastName) {
      setError("Prosím, vyplňte všetky polia.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Heslá sa nezhodujú. Prosím, skontrolujte ich.");
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    // Validácia telefónneho čísla sa teraz aplikuje iba pre bežnú registráciu
    if (!isAdminRegistration) {
      const phoneRegex = /^\+\d+$/;
      if (!contactPhoneNumber || !phoneRegex.test(contactPhoneNumber)) {
          setError("Telefónne číslo kontaktnej osoby musí začínať znakom '+' a obsahovať iba číslice (napr. +421901234567).");
          return;
      }
    }


    const recaptchaToken = await getRecaptchaToken('register');
    if (!recaptchaToken) {
      setError("Overenie reCAPTCHA zlyhalo. Prosím, skúste to znova.");
      return null;
    }
    console.log("reCAPTCHA Token pre registráciu:", recaptchaToken);

    setLoading(true); // Zobraziť loading indikátor
    setError(''); // Clear previous errors
    
    // Set the specific message for admin registration immediately
    if (isAdminRegistration) {
      setMessage(`Administrátorský účet pre ${email} sa registruje. Na vašu e-mailovú adresu sme odoslali potvrdenie registrácie. Pre úplnú aktiváciu počkajte, prosím, na schválenie účtu iným administrátorom.`);
    } else {
      // For regular users, keep message empty for now, so the generic "Načítava sa..." from the button or general loading screen applies.
      setMessage(''); 
    }

    try {
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      await userCredential.user.updateProfile({ displayName: `${firstName} ${lastName}` });

      // Determine initial role and approval status
      let initialUserRole = 'user';
      let initialIsApproved = true; // Default for normal users, and initial for admins

      // Ak je to administrátorská registrácia, nastavíme rolu na 'user' a schválenie na 'true'
      // Neskôr sa to aktualizuje na 'admin' a 'false'
      if (isAdminRegistration) {
        initialUserRole = 'user'; 
        initialIsApproved = true; 
      }

      const userDataToSave = {
        uid: userCredential.user.uid,
        email: email,
        firstName: firstName,
        lastName: lastName,
        contactPhoneNumber: contactPhoneNumber, // Save even if empty for admin, to keep consistent schema
        displayName: `${firstName} ${lastName}`,
        role: initialUserRole, // Použijeme počiatočnú rolu
        approved: initialIsApproved, // Použijeme počiatočný stav schválenia
        registeredAt: firebase.firestore.FieldValue.serverTimestamp(),
        displayNotifications: true
      };

      console.log("Attempting to save user to Firestore with initial data:", userDataToSave); // Detailed log

      try {
        await db.collection('users').doc(userCredential.user.uid).set(userDataToSave);
        console.log(`Firestore: Používateľ ${email} s počiatočnou rolou '${initialUserRole}' a schválením '${initialIsApproved}' bol uložený.`);

        // --- PRESUNUTÁ LOGIKA ODOSIELANIA EMAILU SEM ---
        // Pokus o odoslanie e-mailu cez Apps Script hneď po uložení počiatočných dát
        try {
          const payload = {
            action: 'sendRegistrationEmail',
            email: email,
            password: password, 
            isAdmin: isAdminRegistration, 
            firstName: firstName,
            lastName: lastName,
            contactPhoneNumber: contactPhoneNumber 
          };
          console.log("Odosielam dáta na Apps Script (registračný e-mail):", payload); // Log the payload
          const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors', // VRÁTENÉ: Používame no-cors pre Apps Script
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
          });
          console.log("Žiadosť na odoslanie registračného e-mailu odoslaná.");
          // ZMENA: Pridanie try-catch pre response.json()
          try {
            // S 'no-cors' mode, response.json() will likely fail or return an empty object.
            // The important part is that the fetch request itself completes without a TypeError.
            const responseData = await response.text(); // Read as text to avoid JSON parsing errors
            console.log("Odpoveď z Apps Scriptu (fetch - registračný e-mail) ako text:", responseData); 
          } catch (jsonError) {
            console.warn("Nepodarilo sa parsovať odpoveď z Apps Scriptu (očakávané s 'no-cors' pre JSON):", jsonError);
          }
        } catch (emailError) {
          console.error("Chyba pri odosielaní registračného e-mailu cez Apps Script (fetch error):", emailError);
        }
        // --- KONIEC PRESUNUTEJ LOGIKY ---


        // Explicitné načítanie a logovanie dát po úspešnom zápise
        const userDocRef = db.collection('users').doc(userCredential.user.uid);
        let userDocSnapshot = await userDocRef.get();
        if (userDocSnapshot.exists) {
          console.log("Data loaded from Firestore immediately after initial registration:", userDocSnapshot.data());
        } else {
          console.log("User document not found in Firestore immediately after initial registration (unexpected).");
        }

        // --- NEW LOGIC FOR ADMIN REGISTRATION (AFTER EMAIL SENT) ---
        if (isAdminRegistration) {
          // Update role to admin and approved to false for admin registrations
          await db.collection('users').doc(userCredential.user.uid).update({
            role: 'admin',
            approved: false
          });
          console.log(`Firestore: Rola používateľa ${email} bola aktualizovaná na 'admin' a schválenie na 'false'.`);

          // Re-fetch and log data after the update
          userDocSnapshot = await userDocRef.get(); // Get updated snapshot
          if (userDocSnapshot.exists) {
            console.log("Data loaded from Firestore after admin role update:", userDocSnapshot.data());
          } else {
            console.log("User document not found in Firestore after admin role update (unexpected).");
          }
        }
        // --- END NEW LOGIC ---

      } catch (firestoreError) {
        console.error("Firestore Save/Update Error:", firestoreError);
        setError(`Chyba pri ukladaní/aktualizácii používateľa do databázy: ${firestoreError.message}. Skontrolujte Firebase Security Rules.`);
        setLoading(false);
        setMessage(''); // Clear message on error
        return; // Stop further execution if Firestore save fails
      }

      // Set the final success message for regular users
      if (!isAdminRegistration) {
        setMessage(`Ďakujeme za registráciu Vášho klubu na turnaj Slovak Open Handball. Na e-mailovú adresu ${email} sme odoslali potvrdenie registrácie.`);
      }
      // For admin registration, the message is already set at the beginning.
      
      setLoading(false); // Stop loading so the message is visible on the form

      // Now sign out and redirect after a delay
      await auth.signOut(); 
      setUser(null); // Explicitne nastaviť používateľa na null po odhlásení
      
      // Presmerovanie po 5 sekundách
      setTimeout(() => {
        window.location.href = 'login.html'; 
      }, 5000); 

    } catch (e) {
      console.error("Chyba pri registrácii (Auth alebo iné):", e); 
      if (e.code === 'auth/email-already-in-use') {
        setError("E-mailová adresa už existuje. Prosím, zvoľte inú.");
      } else if (e.code === 'auth/weak-password') {
        setError("Heslo je príliš slabé. " + validatePassword(password));
      } else if (e.code === 'auth/invalid-email') {
        setError("Neplatný formát e-mailovej adresy.");
      } else {
        setError(`Chyba pri registrácii: ${e.message}`);
      }
      setLoading(false); 
      setMessage(''); // Clear message on error
      clearMessages(); 
    } 
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!auth || !db) { 
      setError("Firebase Auth alebo Firestore nie je inicializovaný.");
      return;
    }
    if (!email || !password) {
      setError("Prosím, vyplňte e-mailovú adresu a heslo.");
      return;
    }

    const recaptchaToken = await getRecaptchaToken('login');
    if (!recaptchaToken) {
      setError("Overenie reCAPTCHA zlyhalo. Prosím, skúste to znova.");
      return null;
    }
    console.log("reCAPTcha Token pre prihlásenie:", recaptchaToken);

    setLoading(true);
    try {
      const userCredential = await auth.signInWithEmailAndPassword(email, password);
      const currentUser = userCredential.user;

      const userDocRef = db.collection('users').doc(currentUser.uid);
      const userDoc = await userDocRef.get();

      if (!userDoc.exists) {
        setError("Účet nebol nájdený v databáze. Kontaktujte podporu.");
        await auth.signOut(); 
        setLoading(false);
        return;
      }

      const userData = userDoc.data();
      console.log("Login: Používateľské dáta z Firestore:", userData);

      if (userData.role === 'admin' && userData.approved === false) { 
        setError("Pre úplnú aktiváciu počkajte, prosím, na schválenie účtu iným administrátorom."); 
        
        // --- NOVÁ LOGIKA: Odoslanie e-mailu pre neschváleného administrátora ---
        try {
          const payload = {
            action: 'sendAdminApprovalReminder', 
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            isAdmin: true 
          };
          console.log("Odosielam dáta na Apps Script (pripomienka schválenia admina):", payload);
          const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors', // VRÁTENÉ: Používame no-cors pre Apps Script
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
          });
          console.log("Žiadosť na odoslanie e-mailu s pripomienkou schválenia admina odoslaná.");
          // ZMENA: Pridanie try-catch pre response.json()
          try {
            const responseData = await response.text(); // Read as text to avoid JSON parsing errors
            console.log("Odpoveď z Apps Scriptu (fetch - pripomienka schválenia admina) ako text:", responseData);
          } catch (jsonError) {
            console.warn("Nepodarilo sa parsovať odpoveď z Apps Scriptu (očakávané s 'no-cors' pre JSON):", jsonError);
          }
        } catch (emailError) {
          console.error("Chyba pri odosielaní e-mailu s pripomienkou schválenia admina cez Apps Script (fetch error):", emailError);
        }
        // --- KONIEC NOVEJ LOGIKY ---

        await auth.signOut(); 
        setLoading(false);
        return;
      }

      setUser(prevUser => ({
        ...prevUser,
        ...userData,
        displayName: userData.firstName && userData.lastName ? `${userData.firstName} ${userData.lastName}` : userData.email,
        displayNotifications: userData.displayNotifications !== undefined ? userData.displayNotifications : true 
      }));


      setMessage("Prihlásenie úspešné! Presmerovanie na profilovú stránku...");
      setError('');
      setEmail('');
      setPassword('');
      
      setLoading(false); 

      setTimeout(() => {
        window.location.href = 'logged-in.html';
      }, 5000); 

    } catch (e) {
      console.error("Chyba pri prihlasovaní:", e);
      if (e.code === 'auth/invalid-credential' || e.code === 'auth/invalid-login-credentials') {
        setError("Zadané prihlasovacie údaje sú neplatné. Skontrolujte e-mailovú adresu a heslo a skúste to prosím znova.");
      } else if (e.code === 'auth/invalid-email') {
        setError("Neplatný formát e-mailovej adresy.");
      } else {
        setError(`Chyba pri prihlasovaní: ${e.message}`);
      }
      setLoading(false);
      clearMessages();
    } 
  };

  const handleLogout = async () => {
    if (!auth) return;
    try {
      setLoading(true);
      await auth.signOut();
      setMessage("Úspešne odhlásené.");
      setError('');
      window.location.href = 'login.html';
    } catch (e) {
      console.error("Chyba pri odhlasovaní:", e);
      setError(`Chyba pri odhlasovaní: ${e.message}`);
    } finally {
      setLoading(false);
      clearMessages();
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!user || !auth) { 
      setError("Nie ste prihlásený alebo Firebase Auth nie je inicializovaný.");
      return;
    }
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setError("Prosím, vyplňte všetky polia.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("Nové heslá sa nezhodujú. Prosím, skontrolujte ich.");
      return;
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setLoading(true);
    try {
      const currentUserForReauth = auth.currentUser;
      if (!currentUserForReauth) {
        setError("Aktuálny používateľ nie je k dispozícii pre reautentifikáciu.");
        setLoading(false);
        return;
      }

      const credential = firebase.auth.EmailAuthProvider.credential(currentUserForReauth.email, currentPassword);
      await currentUserForReauth.reauthenticateWithCredential(credential);

      await currentUserForReauth.updatePassword(newPassword);
      setUserNotificationMessage("Heslo úspešne zmenené!"); 
      // ZMENA: showUserNotificationModal je odstránený, spravuje sa cez userNotificationMessage
      setUserNotificationMessage("Heslo úspešne zmenené!");
      setError('');
      setNewPassword('');
      setNewConfirmPassword('');
      setCurrentPassword('');
    } catch (e) {
      console.error("Chyba pri zmene hesla:", e);
      if (e.code === 'auth/requires-recent-login') {
        setError("Pre túto akciu sa musíte znova prihlásiť. Prosím, odhláste sa a znova prihláste.");
      } else if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential' || e.code === 'auth/invalid-login-credentials') {
        setError("Nesprávne aktuálne heslo. Prosím, zadajte správne heslo pre overenie.");
      } else {
        setError(`Chyba pri zmene hesla: ${e.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChangeName = async (e) => {
    e.preventDefault();
    if (!user || !auth || !db) {
      setError("Nie ste prihlásený alebo Firebase Auth/Firestore nie je inicializovaný.");
      return;
    }
    if ((!newFirstName && !newLastName) || !currentPassword) {
      setError("Prosím, zadajte aspoň nové meno alebo priezvisko a aktuálne heslo pre overenie.");
      return;
    }

    const now = new Date();
    const editEnd = userDataEditEndDate ? new Date(userDataEditEndDate) : null;
    if (editEnd && now > editEnd) {
        setError("Úpravy vašich údajov sú už uzavreté. Boli uzavreté dňa: " + (editEnd ? editEnd.toLocaleString('sk-SK') : '-'));
        return;
    }

    setLoading(true);
    try {
      const currentUserForReauth = auth.currentUser;
      if (!currentUserForReauth) {
        setError("Aktuálny používateľ nie je k dispozícii pre reautentifikáciu.");
        setLoading(false);
        return;
      }

      const credential = firebase.auth.EmailAuthProvider.credential(currentUserForReauth.email, currentPassword);
      await currentUserForReauth.reauthenticateWithCredential(credential);

      const oldFirstName = user.firstName;
      const oldLastName = user.lastName;

      const updatedFirstName = newFirstName || oldFirstName;
      const updatedLastName = newLastName || oldLastName;
      const updatedDisplayName = `${updatedFirstName} ${updatedLastName}`;
      
      await currentUserForReauth.updateProfile({ displayName: updatedDisplayName });
      
      await db.collection('users').doc(user.uid).update({ 
        firstName: updatedFirstName, 
        lastName: updatedLastName,   
        displayName: updatedDisplayName
      });

      let changedFields = [];
      if (newFirstName && newFirstName !== oldFirstName) {
        changedFields.push(`meno z '${oldFirstName || 'nezadané'}' na '${newFirstName}'`);
      }
      if (newLastName && newLastName !== oldLastName) {
        changedFields.push(`priezvisko z '${oldLastName || 'nezadané'}' na '${newLastName}'`);
      }

      if (changedFields.length > 0) {
        const notificationMessage = `Používateľ ${user.displayName || user.email} zmenil ${changedFields.join(' a ')} vo svojom registračnom formulári.`;
        await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('notifications').add({
          message: notificationMessage,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          userId: user.uid,
          userName: user.displayName || user.email,
          type: 'user_data_change',
          details: {
            originalFirstName: oldFirstName,
            newFirstName: updatedFirstName,
            newLastName: updatedLastName,
          },
          dismissedBy: [], // Initialize as empty array
          seenBy: [] // Initialize as empty array
        });
        console.log("Admin upozornenie odoslaná pre zmenu mena.");
      }

      setUserNotificationMessage("Meno a priezvisko úspešne zmenené na " + updatedDisplayName); 
      // ZMENA: showUserNotificationModal je odstránený, spravuje sa cez userNotificationMessage
      setError('');
      setNewFirstName('');
      setNewLastName('');
      setCurrentPassword('');
      setUser(prevUser => ({
        ...prevUser,
        firstName: updatedFirstName,
        lastName: updatedLastName,
        displayName: updatedDisplayName
      }));
    } catch (e) {
      console.error("Chyba pri zmene mena a priezviska:", e);
      if (e.code === 'auth/requires-recent-login') {
        setError("Pre túto akciu sa musíte znova prihlásiť. Prosím, odhláste sa a znova prihláste.");
      } else if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential' || e.code === 'auth/invalid-login-credentials') {
        setError("Nesprávne aktuálne heslo. Prosím, zadajte správne heslo pre overenie.");
      } else {
        setError(`Chyba pri zmene mena a priezviska: ${e.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChangeContactPhoneNumber = async (e) => {
    e.preventDefault();
    if (!user || !auth || !db) { 
      setError("Nie ste prihlásený alebo Firebase Auth nie je inicializovaný.");
      return;
    }
    if (!newContactPhoneNumber) {
      setError("Prosím, zadajte nové telefónne číslo.");
      return;
    }

    const phoneRegex = /^\+\d+$/;
    if (!phoneRegex.test(newContactPhoneNumber)) {
        setError("Telefónne číslo musí začínať znakom '+' a obsahovať iba číslice (napr. +421901234567).");
        return;
    }

    const now = new Date();
    const editEnd = userDataEditEndDate ? new Date(userDataEditEndDate) : null;
    if (editEnd && now > editEnd) {
        setError("Úpravy vašich údajov sú už uzavreté. Boli uzavreté dňa: " + (editEnd ? editEnd.toLocaleString('sk-SK') : '-'));
        return;
    }

    setLoading(true);
    try {
      const currentUserForReauth = auth.currentUser;
      if (!currentUserForReauth) {
        setError("Aktuálny používateľ nie je k dispozícii pre reautentifikáciu.");
        setLoading(false);
        return;
      }

      const credential = firebase.auth.EmailAuthProvider.credential(currentUserForReauth.email, currentPassword);
      await currentUserForReauth.reauthenticateWithCredential(credential);

      const oldContactPhoneNumber = user.contactPhoneNumber;

      await db.collection('users').doc(user.uid).update({ 
        contactPhoneNumber: newContactPhoneNumber
      });

      if (newContactPhoneNumber !== oldContactPhoneNumber) {
        const notificationMessage = `Používateľ ${user.displayName || user.email} zmenil telefónne číslo z '${oldContactPhoneNumber || 'nezadané'}' na '${newContactPhoneNumber}' vo svojom registračnom formulári.`;
        await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('notifications').add({
          message: notificationMessage,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          userId: user.uid,
          userName: user.displayName || user.email,
          type: 'user_data_change',
          details: {
            originalPhoneNumber: oldContactPhoneNumber,
            newPhoneNumber: newContactPhoneNumber,
          },
          dismissedBy: [], // Initialize as empty array
          seenBy: [] // Initialize as empty array
        });
        console.log("Admin upozornenie odoslaná pre zmenu telefónneho čísla.");
      }

      setUserNotificationMessage("Telefónne číslo úspešne zmenené na " + newContactPhoneNumber); 
      // ZMENA: showUserNotificationModal je odstránený, spravuje sa cez userNotificationMessage
      setError('');
      setNewContactPhoneNumber('');
      setCurrentPassword('');
      setUser(prevUser => ({ ...prevUser, contactPhoneNumber: newContactPhoneNumber }));
    } catch (e) {
      console.error("Chyba pri zmene telefónneho čísla:", e);
      if (e.code === 'auth/requires-recent-login') {
        setError("Pre túto akciu sa musíte znova prihlásiť. Prosím, odhláste sa a znova prihláste.");
      } else if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential' || e.code === 'auth/invalid-login-credentials') {
        setError("Nesprávne aktuálne heslo. Prosím, zadajte správne heslo pre overenie.");
      } else {
        setError(`Chyba pri zmene telefónneho čísla: ${e.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Funkcia na ukladanie nastavení pre administrátora
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!db || !isAdmin) {
        setError("Nemáte oprávnenie na ukladanie nastavení.");
        return;
    }

    setLoading(true);
    setError('');

    const regStart = registrationStartDate ? new Date(registrationStartDate) : null;
    const regEnd = registrationEndDate ? new Date(registrationEndDate) : null;
    const userEditEnd = userDataEditEndDate ? new Date(userDataEditEndDate) : null;

    if (regStart && regEnd && regEnd <= regStart) {
        setError("Dátum 'Koniec registrácie' musí byť neskôr ako 'Začiatok registrácie'.");
        setLoading(false);
        clearMessages();
        return;
    }

    if (regEnd && userEditEnd && userEditEnd <= regEnd) {
        setError("Dátum 'Koniec úprav používateľských dát' musí byť neskôr ako 'Koniec registrácie'.");
        setLoading(false);
        clearMessages();
        return;
    }

    try {
        const settingsDocRef = db.collection('settings').doc('registration');
        await settingsDocRef.set({
            registrationStartDate: registrationStartDate ? firebase.firestore.Timestamp.fromDate(new Date(registrationStartDate)) : null,
            registrationEndDate: registrationEndDate ? firebase.firestore.Timestamp.fromDate(new Date(registrationEndDate)) : null,
            userDataEditEndDate: userDataEditEndDate ? firebase.firestore.Timestamp.fromDate(new Date(userDataEditEndDate)) : null
        });
        setUserNotificationMessage("Nastavenia úspešne uložené!"); 
        // ZMENA: showUserNotificationModal je odstránený, spravuje sa cez userNotificationMessage
    } catch (e) {
        console.error("Chyba pri ukladaní nastavení:", e);
        setError(`Chyba pri ukladaní nastavení: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };


  const openDeleteConfirmationModal = (user) => {
    setUserToDelete(user);
    setShowDeleteConfirmationModal(true);
  };

  const closeDeleteConfirmationModal = () => {
    setUserToDelete(null);
    setShowDeleteConfirmationModal(false);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete || !db) { 
      setError("Používateľ na odstránenie nie je definovaný alebo Firebase nie je inicializovaný.");
      return;
    }

    setLoading(true);
    setError('');
    try {
      await db.collection('users').doc(userToDelete.uid).delete();
      setUserNotificationMessage(`Používateľ ${userToDelete.email} bol úspešne odstránený z databázy Firestore. Pre úplné odstránenie účtu (vrátane prihlasovacích údajov) ho musíte manuálne odstrániť aj v konzole Firebase Authentication.`);
      // ZMENA: showUserNotificationModal je odstránený, spravuje sa cez userNotificationMessage
      
      closeDeleteConfirmationModal();
      window.open(`https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/users`, '_blank');

    } catch (e) {
      console.error("Chyba pri odstraňovaní používateľa z databázy:", e);
      setError(`Chyba pri odstraňovaní používateľa: ${e.message}. Uistite sa, že máte dostatočné Firebase Security Rules.`);
    } finally {
      setLoading(false);
    }
  };

  const openRoleEditModal = (user) => {
    setUserToEditRole(user);
    setNewRole(user.role || 'user');
    setShowRoleEditModal(true);
  };

  const closeRoleEditModal = () => {
    setUserToEditRole(null);
    setNewRole('');
    setShowRoleEditModal(false);
  };

  const handleUpdateUserRole = async () => {
    if (!userToEditRole || !db || !newRole) {
      setError("Používateľ alebo nová rola nie sú definované.");
      return;
    }

    setLoading(true);
    setError('');
    try {
      let updateData = { role: newRole };

      if (newRole === 'user') {
        updateData.approved = true;
      }
      else if (newRole === 'admin') {
          updateData.approved = userToEditRole.approved;
      }

      await db.collection('users').doc(userToEditRole.uid).update(updateData);
      setUserNotificationMessage(`Rola používateľa ${userToEditRole.email} bola úspešne zmenená na '${newRole}'.`);
      // ZMENA: showUserNotificationModal je odstránený, spravuje sa cez userNotificationMessage
      closeRoleEditModal();
    } catch (e) {
      console.error("Chyba pri aktualizácii roly používateľa:", e);
      setError(`Chyba pri aktualizácii roly: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveUser = async (userToApprove) => {
    if (!userToApprove || !db) {
      setError("Používateľ na schválenie nie je definovaný.");
      return;
    }

    setLoading(true);
    setError('');
    try {
      await db.collection('users').doc(userToApprove.uid).update({ approved: true });
      setUserNotificationMessage(`Používateľ ${userToApprove.email} bol úspešne schválený.`);
      // ZMENA: showUserNotificationModal je odstránený, spravuje sa cez userNotificationMessage
    } catch (e) {
      console.error("Chyba pri schvaľovaní používateľa:", e);
      setError(`Chyba pri schvaľovaní používateľa: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ZMENA: Funkcia na vymazanie upozornenia/správy zo zoznamu používateľa
  const dismissNotification = async (notificationId, notificationType, collectionName) => {
    if (!db || !user) {
      setError("Nie ste prihlásený alebo Firebase nie je inicializovaný.");
      return;
    }
    setLoading(true);
    setError('');

    try {
      const docRef = db.collection('artifacts').doc(appId).collection('public').doc('data').collection(collectionName).doc(notificationId);
      const docSnapshot = await docRef.get();

      if (!docSnapshot.exists) {
        setUserNotificationMessage("Upozornenie/Správa už neexistuje.");
        // ZMENA: showUserNotificationModal je odstránený, spravuje sa cez userNotificationMessage
        setLoading(false);
        return;
      }

      const data = docSnapshot.data();

      if (notificationType === 'system_alert') {
        if (!isAdmin) {
          setUserNotificationMessage("Nemáte oprávnenie na vymazanie systémových upozornení.");
          // ZMENA: showUserNotificationModal je odstránený, spravuje sa cez userNotificationMessage
          setLoading(false);
          return;
        }

        let dismissedBy = data.dismissedBy || [];
        if (!dismissedBy.includes(user.uid)) {
          dismissedBy.push(user.uid);
        }
        let seenBy = data.seenBy || [];
        if (!seenBy.includes(user.uid)) {
          seenBy.push(user.uid);
        }

        const activeAdminUids = allUsersData
          .filter(u => u.role === 'admin' && u.approved === true)
          .map(u => u.uid);

        const allAdminsDismissed = activeAdminUids.every(adminUid => dismissedBy.includes(adminUid));

        if (allAdminsDismissed) {
          await docRef.delete();
          setUserNotificationMessage("Systémové upozornenie bolo vymazané pre všetkých administrátorov.");
          // ZMENA: showUserNotificationModal je odstránený, spravuje sa cez userNotificationMessage
        } else {
          await docRef.update({
            dismissedBy: firebase.firestore.FieldValue.arrayUnion(user.uid),
            seenBy: firebase.firestore.FieldValue.arrayUnion(user.uid)
          });
          setUserNotificationMessage("Systémové upozornenie bolo vymazané z vášho zoznamu.");
          // ZMENA: showUserNotificationModal je odstránený, spravuje sa cez userNotificationMessage
        }
      } else if (notificationType === 'direct_message') {
        // ZMENA: Pre priame správy používame acknowledgedBy na vymazanie zo zoznamu
        await docRef.update({
          acknowledgedBy: firebase.firestore.FieldValue.arrayUnion(user.uid), // NEW: Mark as acknowledged
          seenBy: firebase.firestore.FieldValue.arrayUnion(user.uid)
        });
        setUserNotificationMessage("Správa bola vymazaná z vášho zoznamu.");
        // ZMENA: showUserNotificationModal je odstránený, spravuje sa cez userNotificationMessage
      }

    } catch (e) {
      console.error("Chyba pri mazaní upozornenia/správy:", e);
      setError(`Chyba pri mazaní upozornenia/správy: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // NOVÁ FUNKCIA: Označiť správu ako prečítanú (nemá ju odstrániť zo zoznamu)
  const markMessageAsRead = async (messageId) => {
    if (!db || !user) return;
    setLoading(true);
    try {
      const messageRef = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('messages').doc(messageId);
      await messageRef.update({
        readBy: firebase.firestore.FieldValue.arrayUnion(user.uid),
        seenBy: firebase.firestore.FieldValue.arrayUnion(user.uid) // Ensure it's also seen
      });
      setUserNotificationMessage("Správa bola označená ako prečítaná.");
      // ZMENA: showUserNotificationModal je odstránený, spravuje sa cez userNotificationMessage
      console.log(`Správa ${messageId} označená ako prečítaná používateľom ${user.uid}`);
    } catch (e) {
      console.error("Chyba pri označovaní správy ako prečítanej:", e);
      setError(`Chyba pri označovaní správy ako prečítanej: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClearNotifications = async () => {
    if (!db || !user) { // Any logged-in user can clear their notifications
      setError("Nie ste prihlásený alebo Firebase nie je inicializovaný.");
      return;
    }
    setLoading(true);
    setError('');
    try {
      // ZMENA: Iterujeme len cez userNotifications, ktoré sú už filtrované podľa roly
      const notificationsToDismiss = [...userNotifications]; 
      for (const alert of notificationsToDismiss) { 
        // ZMENA: Ak je to systémové upozornenie a používateľ nie je admin, preskočíme ho
        if (alert.type === 'system_alert' && !isAdmin) {
          console.log("Používateľ nie je admin, preskakujem mazanie systémového upozornenia.");
          continue; 
        }
        await dismissNotification(alert.id, alert.type, alert.collection);
      }
      setUserNotificationMessage("Všetky viditeľné upozornenia boli vymazané z môjho zoznamu.");
      // ZMENA: showUserNotificationModal je odstránený, spravuje sa cez userNotificationMessage
    } catch (e) {
      console.error("Chyba pri mazaní upozornení:", e);
      setError(`Chyba pri mazaní upozornení: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleDisplayNotifications = async (e) => {
    if (!db || !user) {
      setError("Nie ste prihlásený alebo Firebase nie je inicializovaný.");
      return;
    }
    setLoading(true);
    setError('');
    const newDisplayValue = e.target.checked;
    try {
      await db.collection('users').doc(user.uid).update({
        displayNotifications: newDisplayValue
      });
      setUser(prevUser => ({ ...prevUser, displayNotifications: newDisplayValue }));
      setUserNotificationMessage(`Zobrazovanie upozornení bolo ${newDisplayValue ? 'zapnuté' : 'vypnuté'}.`);
      // ZMENA: showUserNotificationModal je odstránený, spravuje sa cez userNotificationMessage
    } catch (e) {
      console.error("Chyba pri zmene nastavenia notifikácií:", e);
      setError(`Chyba pri zmene nastavenia notifikácií: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!db || !user || !isAdmin) {
      setError("Nemáte oprávnenie na odosielanie správ.");
      return;
    }

    const actualRecipients = Object.keys(checkedRecipients).filter(uid => checkedRecipients[uid] && uid !== user.uid);

    if (actualRecipients.length === 0) {
      setError("Prosím, vyberte aspoň jedného príjemcu.");
      return;
    }
    if (!messageSubject.trim()) {
      setError("Predmet správy nemôže byť prázdny.");
      return;
    }
    if (!messageContent.trim()) {
      setError("Obsah správy nemôže byť prázdny.");
      return;
    }

    setLoading(true);
    setError('');

    try {
      await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('messages').add({
        senderId: user.uid,
        senderName: user.displayName || user.email,
        recipients: actualRecipients,
        subject: messageSubject,
        content: messageContent,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        readBy: [], // Pole pre sledovanie, kto si správu prečítal (pre explicitné odmietnutie)
        seenBy: [], // NOVÉ: Pole pre sledovanie, kto si správu pozrel (pop-up)
        acknowledgedBy: [] // NEW: Pole pre sledovanie, kto si správu "vymazal" zo zoznamu
      });
      setUserNotificationMessage("Správa bola úspešne odoslaná!");
      // ZMENA: showUserNotificationModal je odstránený, spravuje sa cez userNotificationMessage
      setCheckedRecipients({}); // Clear all checkboxes after sending
      setMessageSubject('');
      setMessageContent('');
      setSearchQuery(''); // Clear search query
    } catch (e) {
      console.error("Chyba pri odosielaní správy:", e);
      setError(`Chyba pri odosielaní správy: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };


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

  const changeProfileView = (view) => {
    setProfileView(view);
    window.location.hash = view;
    setNewContactPhoneNumber('');
    
    if (view === 'change-name') {
        setNewFirstName('');
        setNewLastName('');
    }
    setCurrentPassword('');
    setNewPassword('');
    setNewConfirmPassword('');
  };

  // Helper functions for checkbox selection logic
  const handleToggleAll = (type) => {
    const newCheckedRecipients = { ...checkedRecipients };
    let targetUsers = [];

    if (type === 'all') {
      targetUsers = allUsersData.filter(u => u.uid !== user.uid);
    } else if (type === 'admin') {
      targetUsers = allUsersData.filter(u => u.role === 'admin' && u.uid !== user.uid);
    } else if (type === 'user') {
      targetUsers = allUsersData.filter(u => u.role === 'user' && u.uid !== user.uid);
    }

    const allOfTypeChecked = targetUsers.every(u => newCheckedRecipients[u.uid]);

    targetUsers.forEach(u => {
      newCheckedRecipients[u.uid] = !allOfTypeChecked;
    });

    setCheckedRecipients(newCheckedRecipients);
  };

  const handleIndividualRecipientChange = (uid) => {
    setCheckedRecipients(prev => ({
      ...prev,
      [uid]: !prev[uid]
    }));
  };

  const isAllChecked = React.useCallback((type) => {
    let targetUsers = [];
    if (type === 'all') {
      targetUsers = allUsersData.filter(u => u.uid !== user.uid);
    } else if (type === 'admin') {
      targetUsers = allUsersData.filter(u => u.role === 'admin' && u.uid !== user.uid);
    } else if (type === 'user') {
      targetUsers = allUsersData.filter(u => u.role === 'user' && u.uid !== user.uid);
    }

    if (targetUsers.length === 0) return false; // No users of this type to check
    return targetUsers.every(u => checkedRecipients[u.uid]);
  }, [allUsersData, checkedRecipients, user]);

  // NOVÉ: Filtrovaný zoznam používateľov na základe vyhľadávacieho dotazu
  const filteredUsers = React.useMemo(() => {
    const lowerCaseQuery = searchQuery.toLowerCase();
    return allUsersData.filter(u => 
      u.uid !== user.uid && // Exclude current user
      (u.displayName?.toLowerCase().includes(lowerCaseQuery) ||
       u.email?.toLowerCase().includes(lowerCaseQuery) ||
       u.firstName?.toLowerCase().includes(lowerCaseQuery) ||
       u.lastName?.toLowerCase().includes(lowerCaseQuery))
    );
  }, [allUsersData, searchQuery, user]);


  const currentPath = window.location.pathname.split('/').pop();
  const isRegistrationPage = currentPath === 'register.html' || currentPath === 'admin-register.html';

  // Prioritné zobrazenie správy o úspešnej registrácii na registračných stránkach
  if (isRegistrationPage && message) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center font-inter overflow-y-auto">
        <div className="w-full max-w-md mt-20 mb-10 p-4">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full text-center">
            <h1 className="text-3xl font-bold text-gray-800 mb-4">Registrácia úspešná!</h1>
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">
              {message}
            </div>
            <p className="text-lg text-gray-600">Presmerovanie na prihlasovaciu stránku...</p>
          </div>
        </div>
      </div>
    );
  }

  // Ak nie je registrácia s úspešnou správou, potom kontrolujeme ostatné stavy načítania
  if (loading || !isAuthReady || (currentPath === 'logged-in.html' && !isRoleLoaded) || !settingsLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-xl font-semibold text-gray-700">Načítava sa...</div>
      </div>
    );
  }

  if (currentPath === '' || currentPath === 'index.html') {
    const now = new Date();
    const regStart = registrationStartDate ? new Date(registrationStartDate) : null;
    const regEnd = registrationEndDate ? new Date(registrationEndDate) : null;

    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center font-inter overflow-y-auto">
        <div className="w-full max-w-md mt-20 mb-10 p-4">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full text-center">
            <h1 className="text-3xl font-bold text-gray-800 mb-4">Vitajte na stránke Slovak Open Handball</h1>
            {user ? (
              <>
                <p className="text-lg text-gray-600">Ste prihlásený. Prejdite do svojej zóny pre viac možností.</p>
                <div className="mt-6 flex justify-center">
                  <a
                    href="logged-in.html"
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200"
                  >
                    Moja zóna
                  </a>
                </div>
              </>
            ) : (
              <>
                {isRegistrationOpen ? (
                  <>
                    <p className="text-lg text-gray-600">Prosím, prihláste sa alebo sa zaregistrujte, aby ste mohli pokračovať.</p>
                    <div className="mt-6 flex justify-center space-x-4">
                      <a
                        href="login.html"
                        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200"
                      >
                        Prihlásenie
                      </a>
                      <a
                        href="register.html"
                        className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200"
                      >
                        Registrácia na turnaj
                      </a>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-lg text-gray-600">
                      Registračný formulár nie je prístupný.
                    </p>
                    {regStart && !isNaN(regStart) && now < regStart && (
                      <>
                        <p className="text-md text-gray-500 mt-2">
                          Registrácia bude možná od:{" "}
                          <span style={{ whiteSpace: 'nowrap' }}>
                            {new Date(registrationStartDate).toLocaleDateString('sk-SK')}
                          </span>{" "}
                          <span style={{ whiteSpace: 'nowap' }}>
                            {new Date(registrationStartDate).toLocaleTimeString('sk-SK')}
                          </span>
                        </p>
                        {countdown && (
                            <p className="text-md text-gray-500 mt-2">Registrácia bude spustená o: {countdown}</p>
                        )}
                      </>
                    )}
                    {regEnd && !isNaN(regEnd) && now > regEnd && (
                      <p className="text-md text-gray-500 mt-2">
                        Registrácia bola ukončená:{" "}
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
                        Prihlásenie
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

  if (isRegistrationPage) { // Simplified condition as the message check is now at the top
    const is_admin_register_page = currentPath === 'admin-register.html';

    // Ak je používateľ už prihlásený, presmerujeme ho na logged-in.html
    if (user) {
      window.location.href = 'logged-in.html';
      return null;
    }

    const now = new Date();
    const regStart = registrationStartDate ? new Date(registrationStartDate) : null;
    const regEnd = registrationEndDate ? new Date(registrationEndDate) : null;

    // Ak nie je admin registrácia a registrácia nie je otvorená, zobrazte správu
    if (!is_admin_register_page && !isRegistrationOpen) {
      return (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center font-inter overflow-y-auto">
          <div className="w-full max-w-md mt-20 mb-10 p-4">
            <div className="bg-white p-8 rounded-lg shadow-xl w-full text-center">
              <h1 className="text-3xl font-bold text-gray-800 mb-4">Registrácia na turnaj</h1>
              <p className="text-lg text-gray-600">
                Registračný formulár nie je prístupný.
              </p>
              {regStart && !isNaN(regStart) && now < regStart && (
                <>
                  <p className="text-md text-gray-500 mt-2">
                    Registrácia bude možná od:{" "}
                    <span style={{ whiteSpace: 'nowrap' }}>
                      {new Date(registrationStartDate).toLocaleDateString('sk-SK')}
                    </span>{" "}
                    <span style={{ whiteSpace: 'nowap' }}>
                      {new Date(registrationStartDate).toLocaleTimeString('sk-SK')}
                    </span>
                  </p>
                  {countdown && (
                      <p className="text-md text-gray-500 mt-2">Registrácia bude spustená o: {countdown}</p>
                  )}
                </>
              )}
              {regEnd && !isNaN(regEnd) && now > regEnd && (
                <p className="text-md text-gray-500 mt-2">
                  Registrácia bola ukončená:{" "}
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
                  href="index.html"
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200"
                >
                  Späť na úvod
                </a>
              </div>
            </div>
          </div>
        </div>
      );
    }
    
    // Zobrazenie registračného formulára s potenciálnou správou
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto">
        <div className="w-full max-w-md mt-20 mb-10 p-4">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full">
            {/* Správy a chyby sa zobrazia tu */}
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap" role="alert">
                {error}
              </div>
            )}
            {/* Message je teraz spracovaná v prioritnom bloku vyššie, tu sa už nezobrazuje */}
            <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">
              {is_admin_register_page ? "Registrácia administrátora" : "Registrácia na turnaj"}
            </h1>
            {/* Formulár je teraz jednotný pre obe stránky */}
            <form onSubmit={(e) => handleRegister(e, is_admin_register_page)} className="space-y-4">
                <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="reg-first-name">
                        {is_admin_register_page ? "Meno" : "Meno kontaktnej osoby"}
                    </label>
                    <input
                        type="text"
                        id="reg-first-name"
                        className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                        placeholder="Zadajte svoje meno"
                        autoComplete="given-name"
                        disabled={loading || !!message} // Disable if loading or message is shown
                    />
                </div>
                <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="reg-last-name">
                        {is_admin_register_page ? "Priezvisko" : "Priezvisko kontaktnej osoby"}
                    </label>
                    <input
                        type="text"
                        id="reg-last-name"
                        className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                        placeholder="Zadajte svoje priezvisko"
                        autoComplete="family-name"
                        disabled={loading || !!message} // Disable if loading or message is shown
                    />
                </div>
                {/* Conditional rendering for email and phone number based on registration type */}
                {is_admin_register_page ? (
                    // Admin registration: only email
                    <div>
                        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="reg-email">E-mailová adresa</label>
                        <input
                            type="email"
                            id="reg-email"
                            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="Zadajte svoju e-mailovú adresu"
                            autoComplete="email"
                            disabled={loading || !!message}
                        />
                    </div>
                ) : (
                    // Regular registration: phone number then email
                    <>
                        <div>
                            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="reg-phone-number">Telefónne číslo kontaktnej osoby</label>
                            <input
                                type="tel"
                                id="reg-phone-number"
                                className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                                value={contactPhoneNumber}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    const strictPhoneRegex = /^\+\d*$/;
                                    if (value === '' || strictPhoneRegex.test(value)) {
                                        setContactPhoneNumber(value);
                                    }
                                }}
                                required
                                placeholder="+421901234567"
                                pattern="^\+\d+$"
                                title="Telefónne číslo musí začínať znakom '+' a obsahovať iba číslice (napr. +421901234567)"
                                disabled={loading || !!message}
                            />
                        </div>
                        <div>
                            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="reg-email">E-mailová adresa kontaktnej osoby</label>
                            <input
                                type="email"
                                id="reg-email"
                                className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder="Zadajte svoju e-mailovú adresu"
                                autoComplete="email"
                                disabled={loading || !!message}
                            />
                        </div>
                        {/* ZMENA: Pridanie nového riadku textu */}
                        <p className="text-gray-600 text-sm mt-4">
                            E-mailová adresa bude slúžiť na všetku komunikáciu súvisiacu s turnajom - zasielanie informácií, faktúr atď.
                            <br />
                            Vytvorenie hesla umožní neskorší prístup k registračnému formuláru, v prípade potreby úpravy alebo doplnenia poskytnutých údajov.
                        </p>
                    </>
                )}
                <PasswordInput
                    id="reg-password"
                    label="Heslo"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onCopy={(e) => e.preventDefault()}
                    onPaste={(e) => e.preventDefault()}
                    onCut={(e) => e.preventDefault()}
                    placeholder="Zvoľte heslo (min. 10 znakov)"
                    autoComplete="new-password"
                    showPassword={showPasswordReg}
                    toggleShowPassword={() => setShowPasswordReg(!showPasswordReg)}
                    disabled={loading || !!message} // Disable if loading or message is shown
                    description={
                      <>
                        Heslo musí obsahovať:
                        <ul className="list-disc list-inside ml-4">
                            <li>aspoň jedno malé písmeno,</li>
                            <li>aspoň jedno veľké písmeno,</li>
                            <li>aspoň jednu číslicu.</li>
                        </ul>
                      </>
                    }
                />
                <PasswordInput
                    id="reg-confirm-password"
                    label="Potvrďte heslo"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onCopy={(e) => e.preventDefault()}
                    onPaste={(e) => e.preventDefault()}
                    onCut={(e) => e.preventDefault()}
                    placeholder="Potvrďte heslo"
                    autoComplete="new-password"
                    showPassword={showConfirmPasswordReg}
                    toggleShowPassword={() => setShowConfirmPasswordReg(!showConfirmPasswordReg)}
                    disabled={loading || !!message} // Disable if loading or message is shown
                />
                <button
                    type="submit"
                    className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200"
                    disabled={loading || !!message} // Disable button if loading or message is shown
                >
                    {loading ? (
                        <div className="flex items-center justify-center">
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Registrujem...
                        </div>
                    ) : 'Registrovať sa'}
                </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (currentPath === 'login.html') {
    // Podmienka pre zobrazenie správy po prihlásení
    if (message && currentPath === 'login.html') {
      return (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center font-inter overflow-y-auto">
          <div className="w-full max-w-md mt-20 mb-10 p-4">
            <div className="bg-white p-8 rounded-lg shadow-xl w-full text-center">
              <h1 className="text-3xl font-bold text-gray-800 mb-4">Prihlásenie úspešné!</h1>
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">
                {message}
              </div>
              <p className="text-lg text-gray-600">Presmerovanie na prihlasovaciu stránku...</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto">
        <div className="w-full max-w-md mt-20 mb-10 p-4">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full">
            {/* Správy a chyby sa zobrazia len ak nie je zobrazená špeciálna potvrdzujúca správa */}
            {(!message && error) && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap" role="alert">
                {error}
              </div>
            )}

            <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">Prihlásenie</h1>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">E-mailová adresa</label>
                <input
                  type="email"
                  id="email"
                  className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="Zadajte svoju e-mailovú adresu"
                  autoComplete="email"
                />
              </div>
              <PasswordInput
                id="password"
                label="Heslo"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onCopy={(e) => e.preventDefault()}
                onPaste={(e) => e.preventDefault()}
                onCut={(e) => e.preventDefault()}
                placeholder="Zadajte heslo"
                autoComplete="current-password"
                showPassword={showPasswordLogin}
                toggleShowPassword={() => setShowPasswordLogin(!showPasswordLogin)}
              />
              <button
                type="submit"
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200"
                disabled={loading}
              >
                {loading ? 'Prihlasujem...' : 'Prihlásiť sa'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (currentPath === 'logged-in.html') {
    if (!user) {
      window.location.href = 'login.html';
      return null;
    }

    // Kontrola pre povolenie úprav používateľských dát
    const now = new Date();
    const editEnd = userDataEditEndDate ? new Date(userDataEditEndDate) : null;
    const isEditAllowed = !editEnd || now <= editEnd;

    // Filter administrators for the send message feature
    // Now using allUsersData which is populated by the new useEffect
    const administrators = allUsersData.filter(u => u.role === 'admin' && u.uid !== user.uid);
    const regularUsers = allUsersData.filter(u => u.role === 'user' && u.uid !== user.uid);


    // Definícia admin-only zobrazení
    const adminOnlyViews = ['users', 'all-teams', 'tournament-settings', 'send-message']; // ZMENA: 'notifications' už nie je len pre adminov

    // Kontrola prístupu pre ne-administrátorov
    if (!isAdmin && adminOnlyViews.includes(profileView)) {
        return (
            <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center font-inter overflow-y-auto">
                <div className="w-full max-w-md mt-20 mb-10 p-4">
                    <div className="bg-white p-8 rounded-lg shadow-xl w-full text-center">
                        <h1 className="text-3xl font-bold text-gray-800 mb-4">Prístup je obmedzený.</h1>
                        <p className="text-lg text-gray-600">
                            Stránka, ktorú sa pokúšate zobraziť, je dostupná iba pre administrátorov turnaja.
                            Ak máte akékoľvek otázky alebo potrebujete prístup, obráťte sa na administrátora.
                        </p>
                        <div className="mt-6 flex justify-center">
                            <button
                                onClick={() => changeProfileView('my-data')}
                                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200"
                            >
                                Späť na Moje údaje
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
      <div className="min-h-screen bg-gray-100 flex flex-col font-inter overflow-y-auto">
        <div className="h-20"></div> 

        {/* ZMENA: NotificationModal je teraz riadený len cez userNotificationMessage */}
        <NotificationModal
            message={userNotificationMessage}
            onClose={() => {
                setUserNotificationMessage(''); // Toto je jediný spôsob, ako vymazať správu a skryť modal
            }}
        />

        <div className="flex flex-grow w-full pb-10">
          <div className="fixed top-20 left-0 h-[calc(100vh-theme(spacing.20))] w-[271px] bg-white p-6 rounded-lg shadow-xl overflow-y-auto z-40 ml-4">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Menu</h2>
            <nav>
              <ul className="space-y-2">
                <li>
                  <button
                    onClick={() => changeProfileView('my-data')}
                    className={`w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 whitespace-nowrap ${
                      profileView === 'my-data' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Moje údaje
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => {
                      changeProfileView('change-name');
                    }}
                    className={`w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 whitespace-nowrap ${
                        profileView === 'change-name' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Zmeniť meno a priezvisko
                  </button> 
                </li>
                <li>
                  <button
                    onClick={() => changeProfileView('change-password')}
                    className={`w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 whitespace-nowrap ${
                      profileView === 'change-password' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Zmeniť heslo
                  </button>
                </li>
                {/* NOVÁ POLOŽKA MENU: Zmena telefónneho čísla (len pre bežných používateľov) */}
                {!isAdmin && (
                  <li>
                    <button
                      onClick={() => changeProfileView('change-phone-number')}
                      className={`w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 whitespace-nowrap ${
                        profileView === 'change-phone-number' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Zmeniť telefónne číslo
                    </button>
                  </li>
                )}
                {/* ZMENA: Podmienka pre zobrazenie "Moje nastavenia" iba pre adminov */}
                {isAdmin && ( 
                  <li> 
                    <button
                      onClick={() => {
                        changeProfileView('my-settings'); 
                      }}
                      className={`w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 whitespace-nowrap ${
                        profileView === 'my-settings' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Moje nastavenia
                    </button>
                  </li>
                )}
                <li> {/* ZMENA: Upozornenia sú pre všetkých používateľov */}
                  <button
                    onClick={() => {
                      changeProfileView('notifications');
                    }}
                    className={`w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 whitespace-nowrap ${
                      profileView === 'notifications' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Upozornenia ({userNotifications.length})
                  </button>
                </li>
                {isAdmin && ( // This condition makes the entire <li> visible only for admins
                  <li>
                    <button
                      onClick={() => {
                        changeProfileView('send-message');
                      }}
                      className={`w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 whitespace-nowrap ${
                        profileView === 'send-message' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Poslať správu
                    </button>
                  </li>
                )}
                {isAdmin && (
                  <li className="my-2">
                    <hr className="border-t border-gray-300" />
                  </li>
                )}
                {isAdmin && (
                  <li>
                    <button
                      onClick={() => {
                        changeProfileView('users');
                      }}
                      className={`w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 whitespace-nowrap ${
                        profileView === 'users' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Používatelia
                    </button>
                  </li>
                )}
                {isAdmin && (
                  <li>
                    <button
                      onClick={() => {
                        changeProfileView('all-teams');
                      }}
                      className={`w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 whitespace-nowrap ${
                        profileView === 'all-teams' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Všetky tímy (registrácie)
                    </button>
                  </li>
                )}
                {isAdmin && (
                  <li>
                    <button
                      onClick={() => {
                        changeProfileView('tournament-settings'); 
                      }}
                      className={`w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 whitespace-nowrap ${
                        profileView === 'tournament-settings' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Nastavenia turnaja
                    </button>
                  </li>
                )}
              </ul>
            </nav>
          </div>

          <div className="flex-grow ml-[287px] p-8 bg-white rounded-lg shadow-xl overflow-x-auto overflow-y-auto mr-4">
            {/* Správy už nebudú zobrazené ako statický banner, ale cez NotificationModal */}
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap" role="alert">
                {error}
              </div>
            )}

            <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">Vitajte, {user.displayName || 'Používateľ'}!</h1>
            
            {profileView === 'my-data' && (
              <div className="space-y-4 border-t pt-4 mt-4">
                <h2 className="text-xl font-semibold text-gray-800">Moje údaje</h2>
                <p className="text-gray-700">
                  <span className="font-semibold">E-mailová adresa: </span>{user.email || '-'}
                </p>
                <p className="text-gray-700">
                  <span className="font-semibold">Meno a priezvisko: </span>{user.displayName || '-'}
                </p>
                {/* Telefónne číslo sa zobrazuje len pre bežných používateľov, nie pre administrátorov */}
                {!isAdmin && (
                  <p className="text-gray-700">
                    <span className="font-semibold">Telefónne číslo: </span>{user.contactPhoneNumber || '-'}
                  </p>
                )}
                {!isEditAllowed && (
                    <p className="text-red-500 text-sm mt-2">
                        Úpravy vašich údajov sú už uzavreté. Boli uzavreté dňa: {editEnd ? editEnd.toLocaleString('sk-SK') : '-'}
                    </p>
                )}
              </div>
            )}

            {profileView === 'change-password' && (
              <form onSubmit={handleChangePassword} className="space-y-4 border-t pt-4 mt-4">
                <h2 className="text-xl font-semibold text-gray-800">Zmeniť heslo</h2>
                <PasswordInput
                  id="modal-current-password-password-change"
                  label="Aktuálne heslo (pre overenie)"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  onCopy={(e) => e.preventDefault()}
                  onPaste={(e) => e.preventDefault()}
                  onCut={(e) => e.preventDefault()}
                  placeholder="Zadajte svoje aktuálne heslo"
                  autoComplete="current-password"
                  showPassword={showCurrentPasswordChange}
                  toggleShowPassword={() => setShowCurrentPasswordChange(!showCurrentPasswordChange)}
                />
                <PasswordInput
                  id="modal-new-password"
                  label="Nové heslo"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  onCopy={(e) => e.preventDefault()}
                  onPaste={(e) => e.preventDefault()}
                  onCut={(e) => e.preventDefault()}
                  placeholder="Zadajte nové heslo (min. 10 znakov)"
                  autoComplete="new-password"
                  showPassword={showNewPasswordChange}
                  toggleShowPassword={() => setShowNewPasswordChange(!showNewPasswordChange)}
                />
                <PasswordInput
                  id="modal-confirm-new-password"
                  label="Potvrďte nové heslo"
                  value={confirmNewPassword}
                  onChange={(e) => setNewConfirmPassword(e.target.value)}
                  onCopy={(e) => e.preventDefault()}
                  onPaste={(e) => e.preventDefault()}
                  onCut={(e) => e.preventDefault()}
                  placeholder="Potvrďte heslo"
                  autoComplete="new-password"
                  showPassword={showConfirmNewPasswordChange}
                  toggleShowPassword={() => setShowConfirmNewPasswordChange(!showConfirmNewPasswordChange)}
                />
                <button
                  type="submit"
                  className="bg-orange-500 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200 mt-4"
                  disabled={loading}
                >
                  {loading ? 'Ukladám...' : 'Zmeniť heslo'}
                </button>
              </form>
            )}

            {profileView === 'change-name' && (
              <form onSubmit={handleChangeName} className="space-y-4 border-t pt-4 mt-4">
                <h2 className="text-xl font-semibold text-gray-800">Zmeniť meno a priezvisko</h2>
                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="new-first-name">Nové meno</label>
                  <input
                    type="text"
                    id="new-first-name"
                    className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    placeholder="Zadajte nové meno"
                    autoComplete="given-name"
                    disabled={!isEditAllowed}
                  />
                </div>
                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="new-last-name">Nové priezvisko</label>
                  <input
                    type="text"
                    id="new-last-name"
                    className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    placeholder="Zadajte nové priezvisko"
                    autoComplete="family-name"
                    disabled={!isEditAllowed}
                  />
                </div>
                <PasswordInput
                  id="current-password-name-change"
                  label="Aktuálne heslo (pre overenie)"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  onCopy={(e) => e.preventDefault()}
                  onPaste={(e) => e.preventDefault()}
                  onCut={(e) => e.preventDefault()}
                  placeholder="Zadajte svoje aktuálne heslo"
                  autoComplete="current-password"
                  showPassword={showCurrentPasswordChange}
                  toggleShowPassword={() => setShowCurrentPasswordChange(!showCurrentPasswordChange)}
                  disabled={!isEditAllowed}
                />
                <button
                  type="submit"
                  className={`font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200 mt-4 ${
                    isEditAllowed ? 'bg-purple-500 hover:bg-purple-700 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                  disabled={loading || !isEditAllowed}
                >
                  {loading ? 'Ukladám...' : (isEditAllowed ? 'Zmeniť meno a priezvisko' : 'Úpravy sú už uzavreté')}
                </button>
                { !isEditAllowed && editEnd && (
                    <p className="text-red-500 text-sm mt-2 text-center">Úpravy boli uzavreté dňa: {editEnd.toLocaleString('sk-SK')}</p>
                )}
              </form>
            )}

            {/* NOVÁ SEKCIA: Zmena telefónneho čísla */}
            {profileView === 'change-phone-number' && (
              <form onSubmit={handleChangeContactPhoneNumber} className="space-y-4 border-t pt-4 mt-4">
                <h2 className="text-xl font-semibold text-gray-800">Zmeniť telefónne číslo</h2>
                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="new-contact-phone-number">Nové telefónne číslo</label>
                  <input
                    type="tel"
                    id="new-contact-phone-number"
                    className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                    value={newContactPhoneNumber}
                    onChange={(e) => {
                      const value = e.target.value;
                      const strictPhoneRegex = /^\+\d*$/; // Povoliť len '+' a číslice
                      if (value === '' || strictPhoneRegex.test(value)) {
                        setNewContactPhoneNumber(value); // Nastavte newContactPhoneNumber
                      }
                    }}
                    required
                    placeholder="+421901234567"
                    pattern="^\+\d+$"
                    title="Telefónne číslo musí začínať znakom '+' a obsahovať iba číslice (napr. +421901234567)"
                    disabled={!isEditAllowed}
                  />
                </div>
                <PasswordInput
                  id="current-password-phone-change"
                  label="Aktuálne heslo (pre overenie)"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  onCopy={(e) => e.preventDefault()}
                  onPaste={(e) => e.preventDefault()}
                  onCut={(e) => e.preventDefault()}
                  placeholder="Zadajte svoje aktuálne heslo"
                  autoComplete="current-password"
                  showPassword={showCurrentPasswordChange}
                  toggleShowPassword={() => setShowCurrentPasswordChange(!showCurrentPasswordChange)}
                  disabled={!isEditAllowed}
                />
                <button
                  type="submit"
                  className={`font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200 mt-4 ${
                    isEditAllowed ? 'bg-teal-500 hover:bg-teal-700 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                  disabled={loading || !isEditAllowed}
                >
                  {loading ? 'Ukladám...' : (isEditAllowed ? 'Zmeniť telefónne číslo' : 'Úpravy sú už uzavreté')}
                </button>
                { !isEditAllowed && editEnd && (
                    <p className="text-red-500 text-sm mt-2 text-center">Úpravy boli uzavreté dňa: {editEnd.toLocaleString('sk-SK')}</p>
                )}
              </form>
            )}

            {/* ZMENA: Formulár na odosielanie správ je teraz podmienený aj profileView */}
            {profileView === 'send-message' && isAdmin && (
              <form onSubmit={handleSendMessage} className="space-y-4 border-t pt-4 mt-4">
                <h2 className="text-xl font-semibold text-gray-800">Poslať správu používateľom</h2>
                <div className="space-y-2">
                  <label className="block text-gray-700 text-sm font-bold mb-2">Vyberte príjemcov</label>
                  
                  {/* "Všetci" checkbox */}
                  <div className="flex items-center mb-2">
                    <input
                      type="checkbox"
                      id="select-all"
                      className="form-checkbox h-5 w-5 text-blue-600 rounded-md"
                      checked={isAllChecked('all')}
                      onChange={() => handleToggleAll('all')}
                      disabled={loading}
                    />
                    <label htmlFor="select-all" className="ml-2 text-gray-700 font-semibold">Všetci</label>
                  </div>

                  {/* "Všetci administrátori" checkbox */}
                  <div className="flex items-center mb-2">
                    <input
                      type="checkbox"
                      id="select-all-admins"
                      className="form-checkbox h-5 w-5 text-blue-600 rounded-md"
                      checked={isAllChecked('admin')}
                      onChange={() => handleToggleAll('admin')}
                      disabled={loading}
                    />
                    <label htmlFor="select-all-admins" className="ml-2 text-gray-700 font-semibold">Všetci administrátori</label>
                  </div>
                  
                  {/* "Všetci používatelia" checkbox */}
                  <div className="flex items-center mt-4 mb-2">
                    <input
                      type="checkbox"
                      id="select-all-users"
                      className="form-checkbox h-5 w-5 text-blue-600 rounded-md"
                      checked={isAllChecked('user')}
                      onChange={() => handleToggleAll('user')}
                      disabled={loading}
                    />
                    <label htmlFor="select-all-users" className="ml-2 text-gray-700 font-semibold">Všetci používatelia</label>
                  </div>

                  {/* NOVÉ: Vyhľadávacie pole */}
                  <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="search-recipients">
                      Filtrovať používateľov
                    </label>
                    <input
                      type="text"
                      id="search-recipients"
                      className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Hľadať podľa mena, priezviska alebo e-mailu"
                      disabled={loading}
                    />
                  </div>

                  {/* Skrolovateľný zoznam individuálnych používateľov */}
                  <div className="border border-gray-300 rounded-lg p-3 max-h-60 overflow-y-auto bg-gray-50">
                    {filteredUsers.length > 0 ? (
                      <div className="space-y-1">
                        {filteredUsers.map(u => (
                          <div key={u.uid} className="flex items-center">
                            <input
                              type="checkbox"
                              id={`recipient-${u.uid}`}
                              className="form-checkbox h-4 w-4 text-indigo-600 rounded-md"
                              checked={!!checkedRecipients[u.uid]}
                              onChange={() => handleIndividualRecipientChange(u.uid)}
                              disabled={loading}
                            />
                            <label htmlFor={`recipient-${u.uid}`} className="ml-2 text-gray-700">
                              {u.displayName || u.email} ({u.role})
                            </label>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-600 text-sm">Žiadni používatelia zodpovedajúci filtru.</p>
                    )}
                  </div>

                </div>
                
                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="message-subject">
                    Predmet správy
                  </label>
                  <input
                    type="text"
                    id="message-subject"
                    className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                    value={messageSubject}
                    onChange={(e) => setMessageSubject(e.target.value)}
                    placeholder="Zadajte predmet správy"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="message-content">
                    Správa
                  </label>
                  <textarea
                    id="message-content"
                    className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 resize-y"
                    rows="7"
                    value={messageContent}
                    onChange={(e) => setMessageContent(e.target.value)}
                    placeholder="Napíšte svoju správu"
                    disabled={loading}
                  ></textarea>
                </div>
                <button
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200 mt-4"
                  disabled={loading}
                >
                  {loading ? 'Odosielam...' : 'Odoslať správu'}
                </button>
              </form>
            )}

            {profileView === 'users' && (
              <div className="space-y-4 border-t pt-4 mt-4">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Zoznam používateľov (Administrácia)</h2>
                {allUsersData.length > 0 ? (
                  <ul className="divide-y divide-gray-200">
                    {allUsersData.map((u) => (
                      <li key={u.uid} className="py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex-grow mb-2 sm:mb-0">
                          <p className="text-gray-600 text-sm">{u.email}</p>
                          <p className="text-gray-500 text-xs">Rola: {u.role || 'user'}</p> 
                          <p className="text-gray-500 text-xs">Schválený: {u.approved ? 'Áno' : 'Nie'}</p> 
                          <p className="text-gray-500 text-xs">UID: {u.uid}</p> {/* Display UID */}
                        </div>
                        {user && user.uid !== u.uid && ( 
                          <div className="flex flex-col sm:flex-row sm:space-x-2 space-y-2 sm:space-y-0">
                            {u.role === 'admin' && u.approved === false && (
                              <button
                                onClick={() => handleApproveUser(u)}
                                className="bg-green-500 hover:bg-green-700 text-white text-sm font-bold py-2 px-3 rounded-lg transition-colors duration-200"
                              >
                                Povoliť používateľa
                              </button>
                            )}
                            <button
                              onClick={() => openRoleEditModal(u)}
                              className="bg-blue-500 hover:bg-blue-700 text-white text-sm font-bold py-2 px-3 rounded-lg transition-colors duration-200"
                            >
                              Upraviť rolu
                            </button>
                            <button
                              onClick={() => openDeleteConfirmationModal(u)}
                              className="bg-red-500 hover:bg-red-700 text-white text-sm font-bold py-2 px-3 rounded-lg transition-colors duration-200"
                              disabled={u.role === 'admin' && user.uid === u.uid} // Zakázať odstránenie vlastného admin účtu
                            >
                              Odstrániť používateľa
                            </button> 
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-600">Žiadni používatelia na zobrazenie alebo načítavanie...</p>
                )}
              </div>
            )}

            {profileView === 'all-teams' && (
              <div className="space-y-4 border-t pt-4 mt-4">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Všetky tímy (údaje z registračného formulára)</h2>
                {allUsersData.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
                      <thead>
                        <tr className="bg-gray-100 border-b border-gray-200">
                          <th className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">E-mail</th>
                          <th className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Meno kontaktnej osoby</th>
                          <th className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Priezvisko kontaktnej osoby</th>
                          <th className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Telefónne číslo</th>
                          <th className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Rola</th>
                          <th className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Schválený</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allUsersData.map((u) => (
                          <tr key={u.uid} className="hover:bg-gray-50">
                            <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-800">{u.email}</td>
                            <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-800">{u.firstName || '-'}</td>
                            <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-800">{u.lastName || '-'}</td>
                            <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-800">{u.contactPhoneNumber || '-'}</td>
                            <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-800">{u.role || 'user'}</td>
                            <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-800">{u.approved ? 'Áno' : 'Nie'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-600">Žiadne registračné údaje na zobrazenie alebo načítavanie...</p>
                )}
              </div>
            )}

            {/* Sekcia nastavení pre administrátora */}
            {profileView === 'tournament-settings' && isAdmin && ( 
              <form onSubmit={handleSaveSettings} className="space-y-4 border-t pt-4 mt-4">
                <h2 className="text-xl font-semibold text-gray-800">Nastavenia turnaja</h2>
                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="reg-start-date">
                    Začiatok registrácie (dátum a čas)
                  </label>
                  <input
                    type="datetime-local"
                    id="reg-start-date"
                    className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                    value={registrationStartDate}
                    onChange={(e) => setRegistrationStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="reg-end-date">
                    Koniec registrácie (dátum a čas)
                  </label>
                  <input
                    type="datetime-local"
                    id="reg-end-date"
                    className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                    value={registrationEndDate}
                    onChange={(e) => setRegistrationEndDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="user-edit-end-date">
                    Koniec úprav používateľských dát (dátum a čas)
                  </label>
                  <input
                    type="datetime-local"
                    id="user-edit-end-date"
                    className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                    value={userDataEditEndDate}
                    onChange={(e) => setUserDataEditEndDate(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200 mt-4"
                  disabled={loading}
                >
                  {loading ? 'Ukladám...' : 'Uložiť nastavenia'}
                </button>
              </form>
            )}

            {/* Nová sekcia pre osobné nastavenia používateľa (vrátane administrátora) */}
            {profileView === 'my-settings' && user && (
              <div className="space-y-4 border-t pt-4 mt-4">
                <h2 className="text-xl font-semibold text-gray-800">Moje nastavenia</h2>
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Zobrazovať upozornenia na hornej časti obrazovky</span>
                  <label htmlFor="toggle-notifications" className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      id="toggle-notifications"
                      className="sr-only peer" 
                      checked={user?.displayNotifications ?? true}
                      onChange={handleToggleDisplayNotifications}
                      disabled={loading}
                    />
                    <div className={`w-11 h-6 rounded-full peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 transition-colors duration-200 ease-in-out
                                    ${user?.displayNotifications ? 'bg-green-600' : 'bg-red-600'}`}>
                      <div className={`after:content-[''] after:absolute after:top-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all after:duration-200 after:ease-in-out dark:border-gray-600
                                        ${user?.displayNotifications ? 'after:translate-x-full after:left-[2px]' : 'after:left-[2px]'}`}>
                      </div>
                    </div>
                  </label>
                </div>
                <p className="text-gray-600 text-sm mt-2">
                    Upozornenia v zozname (sekcia "Upozornenia") sa budú naďalej zobrazovať, kým ich individuálne nevymažete.
                </p>
              </div>
            )}

            {/* ZMENA: Notifications section for ALL logged-in users */}
            {profileView === 'notifications' && user && (
              <div className="space-y-4 border-t pt-4 mt-4">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Moje upozornenia</h2>
                {userNotifications.length > 0 ? (
                  <>
                    <button
                      onClick={handleClearNotifications}
                      className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200 mb-4"
                      disabled={loading}
                    >
                      {loading ? 'Mažem...' : 'Vymazať všetky upozornenia z môjho zoznamu'}
                    </button>
                    <ul className="divide-y divide-gray-200">
                      {userNotifications.map(alert => ( 
                        <li key={alert.id} className={`py-2 text-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center ${
                          alert.type === 'direct_message' && alert.readBy && alert.readBy.includes(user.uid) ? 'bg-gray-50' : 'bg-blue-50'
                        } rounded-lg px-4 mb-2`}>
                          <div className="flex-grow mb-2 sm:mb-0">
                            <p className="font-semibold">
                              {alert.type === 'direct_message' ? `Správa od ${alert.senderName || 'Neznámy odosielateľ'}: ${alert.subject}` : alert.message}
                            </p>
                            {alert.type === 'direct_message' && (
                                <p className="text-sm text-gray-600 whitespace-pre-wrap">{alert.content}</p>
                            )}
                            <p className="text-xs text-gray-500">
                              {alert.timestamp ? alert.timestamp.toDate().toLocaleString('sk-SK') : 'N/A'}
                            </p>
                          </div>
                          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                            {alert.type === 'direct_message' && !(alert.readBy && alert.readBy.includes(user.uid)) && (
                              <button
                                onClick={() => markMessageAsRead(alert.id)}
                                className="px-3 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors duration-200 text-sm"
                                disabled={loading}
                              >
                                Označiť ako prečítané
                              </button>
                            )}
                            <button
                              onClick={() => dismissNotification(alert.id, alert.type, alert.collection)} 
                              className="px-3 py-1 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors duration-200 text-sm"
                              disabled={loading}
                            >
                              Vymazať
                            </button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
                ) : (
                  <p className="text-gray-600">Žiadne nové upozornenia.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {showDeleteConfirmationModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center z-50">
            <div className="relative p-5 border w-96 shadow-lg rounded-md bg-white">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Potvrdiť odstránenie</h3> 
              <p className="text-gray-700 mb-6">Naozaj chcete natrvalo odstrániť používateľa {userToDelete?.email} z databázy? Táto akcia je nezvratná.</p> 
              <div className="flex justify-end space-x-4">
                <button
                  onClick={closeDeleteConfirmationModal}
                  className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors duration-200"
                >
                  Zrušiť
                </button>
                <button
                  onClick={handleDeleteUser}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200"
                  disabled={loading}
                >
                  {loading ? 'Odstraňujem...' : 'Odstrániť'}
                </button> 
              </div>
            </div>
          </div>
        )}

        {showRoleEditModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity50 overflow-y-auto h-full w-full flex justify-center items-center z-50" style={{ backdropFilter: 'blur(5px)' }}>
            <div className="relative p-5 border w-96 shadow-lg rounded-md bg-white">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Upraviť rolu pre {userToEditRole?.email}</h3>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="new-user-role">Nová rola</label>
                <select
                  id="new-user-role"
                  className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                >
                  <option value="user">Používateľ</option>
                  <option value="admin">Administrátor</option>
                </select>
              </div>
              <div className="flex justify-end space-x-4">
                <button
                  onClick={closeRoleEditModal}
                  className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors duration-200"
                >
                  Zrušiť
                </button>
                <button
                  onClick={handleUpdateUserRole}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
                  disabled={loading}
                >
                  {loading ? 'Ukladám...' : 'Uložiť'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
