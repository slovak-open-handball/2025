// Global application ID and Firebase configuration (should be consistent across all React apps)
// Tieto konštanty sú teraz definované v <head> register.html a sú prístupné globálne.
// Odstránené opakované deklarácie.

const RECAPTCHA_SITE_KEY = "6LdJbn8rAAAAAO4C50qXTWva6ePzDlOfYwBDEDwa";
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec";

// Helper function to format a Date object into 'YYYY-MM-DDTHH:mm' local string
// Presunuté mimo komponentu App, aby bolo globálne dostupné
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
  // SVG ikony pre oko (zobraziť heslo) a oko-preškrtnuté (skryť heslo)
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

// Main React component for the register.html page
function App() {
  const [app, setApp] = React.useState(null);
  const [auth, setAuth] = React.useState(null);
  const [db, setDb] = React.useState(null);
  const [user, setUser] = React.useState(undefined); // Inicializácia na undefined
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [userNotificationMessage, setUserNotificationMessage] = React.useState('');

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [contactPhoneNumber, setContactPhoneNumber] = React.useState('');

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

  // States for password visibility
  const [showPasswordReg, setShowPasswordReg] = React.useState(false);
  const [showConfirmPasswordReg, setShowConfirmPasswordReg] = React.useState(false);

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
        setError("Firebase SDK nie je načítané. Skontrolujte register.html.");
        setLoading(false);
        return;
      }

      let firebaseApp;
      // Skontrolujte, či už existuje predvolená aplikácia Firebase
      if (firebase.apps.length === 0) {
        // Používame globálne __firebase_config
        firebaseApp = firebase.initializeApp(JSON.parse(__firebase_config));
      } else {
        firebaseApp = firebase.app(); // Použite existujúcu predvolenú aplikáciu
      }
      setApp(firebaseApp);

      const authInstance = firebase.auth(firebaseApp);
      setAuth(authInstance);
      firestoreInstance = firebase.firestore(firebaseApp);
      setDb(firestoreInstance);

      const signIn = async () => {
        try {
          // Používame globálne __initial_auth_token
          if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await authInstance.signInWithCustomToken(__initial_auth_token);
          } else {
            // No anonymous sign-in for register.js, user will explicitly register or log in
          }
        } catch (e) {
          console.error("Chyba pri počiatočnom prihlásení Firebase:", e);
          setError(`Chyba pri prihlásení: ${e.message}`);
        }
      };

      unsubscribeAuth = authInstance.onAuthStateChanged(async (currentUser) => {
        console.log("RegisterApp: onAuthStateChanged - Používateľ:", currentUser ? currentUser.uid : "null");
        setUser(currentUser);
        // Ak je používateľ prihlásený, presmerujte ho
        if (currentUser) {
            window.location.href = 'logged-in-my-data.html';
            return; // Zastaviť ďalšie vykresľovanie pre tento komponent
        }
        setLoading(false); // Auth state checked, stop loading
      });

      signIn();

      return () => {
        if (unsubscribeAuth) {
          unsubscribeAuth();
        }
      };
    } catch (e) {
      console.error("Nepodarilo sa inicializovať Firebase:", e);
      setError(`Chyba pri inicializácii Firebase: ${e.message}`);
      setLoading(false);
    }
  }, []); // Empty dependency array - runs only once on component mount


  // Effect for loading settings (runs after DB and Auth are initialized)
  React.useEffect(() => {
    const fetchSettings = async () => {
      if (!db || user !== null) { // Wait for DB and user to be explicitly null (not logged in)
        return;
      }
      try {
          const settingsDocRef = db.collection('settings').doc('registration');
          const unsubscribeSettings = settingsDocRef.onSnapshot(docSnapshot => {
            if (docSnapshot.exists) {
                const data = docSnapshot.data();
                setRegistrationStartDate(data.registrationStartDate ? formatToDatetimeLocal(data.registrationStartDate.toDate()) : '');
                setRegistrationEndDate(data.registrationEndDate ? formatToDatetimeLocal(data.registrationEndDate.toDate()) : '');
            } else {
                console.log("Nastavenia registrácie sa nenašli v Firestore. Používajú sa predvolené prázdne hodnoty.");
                setRegistrationStartDate('');
                setRegistrationEndDate('');
            }
            setSettingsLoaded(true);
            // setLoading(false); // Moved to authStateChanged
          }, error => {
            console.error("Chyba pri načítaní nastavení registrácie (onSnapshot):", error);
            setError(`Chyba pri načítaní nastavení: ${error.message}`);
            setSettingsLoaded(true);
            // setLoading(false); // Moved to authStateChanged
          });

          return () => unsubscribeSettings();
      } catch (e) {
          console.error("Chyba pri nastavovaní onSnapshot pre nastavenia registrácie:", e);
          setError(`Chyba pri nastavovaní poslucháča pre nastavenia: ${e.message}`);
          setSettingsLoaded(true);
          // setLoading(false); // Moved to authStateChanged
      }
    };

    fetchSettings();
  }, [db, user]); // Depend on db and user (to ensure user is null before fetching settings)

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
    console.log(`RegisterApp: useEffect pre aktualizáciu odkazov hlavičky. User: ${user ? user.uid : 'null'}, isRegistrationOpen: ${isRegistrationOpen}`);
    const authLink = document.getElementById('auth-link');
    const profileLink = document.getElementById('profile-link');
    const logoutButton = document.getElementById('logout-button');
    const registerLink = document.getElementById('register-link');

    if (authLink) {
      if (user) { // If user is logged in
        authLink.classList.add('hidden');
        profileLink && profileLink.classList.remove('hidden');
        logoutButton && logoutButton.classList.remove('hidden');
        registerLink && registerLink.classList.add('hidden'); // Always hide for logged-in users
        console.log("RegisterApp: Používateľ prihlásený. Skryté: Prihlásenie, Registrácia. Zobrazené: Moja zóna, Odhlásenie.");
      } else { // If user is not logged in
        authLink.classList.remove('hidden');
        profileLink && profileLink.classList.add('hidden');
        logoutButton && logoutButton.classList.add('hidden');
        if (isRegistrationOpen) {
          registerLink && registerLink.classList.remove('hidden');
          console.log("RegisterApp: Používateľ odhlásený, registrácia otvorená. Zobrazené: Prihlásenie, Registrácia.");
        } else {
          registerLink && registerLink.classList.add('hidden');
          console.log("RegisterApp: Používateľ odhlásený, registrácia zatvorená. Zobrazené: Prihlásenie. Skryté: Registrácia.");
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
      console.error("Chyba pri odhlásení:", e);
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

    // Phone number validation applies only for regular registration
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

    setLoading(true);
    setError('');
    
    if (isAdminRegistration) {
      setUserNotificationMessage(`Administrátorský účet pre ${email} sa registruje. Na vašu e-mailovú adresu sme odoslali potvrdenie registrácie. Pre úplnú aktiváciu počkajte, prosím, na schválenie účtu iným administrátorom.`);
    } else {
      setUserNotificationMessage(''); 
    }

    try {
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      await userCredential.user.updateProfile({ displayName: `${firstName} ${lastName}` });

      let initialUserRole = 'user';
      let initialIsApproved = true;

      if (isAdminRegistration) {
        initialUserRole = 'user'; 
        initialIsApproved = true; 
      }

      const userDataToSave = {
        uid: userCredential.user.uid,
        email: email,
        firstName: firstName,
        lastName: lastName,
        contactPhoneNumber: contactPhoneNumber,
        displayName: `${firstName} ${lastName}`,
        role: initialUserRole,
        approved: initialIsApproved,
        registeredAt: firebase.firestore.FieldValue.serverTimestamp(),
        displayNotifications: true
      };

      console.log("Attempting to save user to Firestore with initial data:", userDataToSave);

      try {
        await db.collection('users').doc(userCredential.user.uid).set(userDataToSave);
        console.log(`Firestore: Používateľ ${email} s počiatočnou rolou '${initialUserRole}' a schválením '${initialIsApproved}' bol uložený.`);

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
          console.log("Odosielam dáta na Apps Script (registračný e-mail):", payload);
          const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
          });
          console.log("Žiadosť na odoslanie registračného e-mailu odoslaná.");
          try {
            const responseData = await response.text();
            console.log("Odpoveď z Apps Scriptu (fetch - registračný e-mail) ako text:", responseData); 
          } catch (jsonError) {
            console.warn("Nepodarilo sa parsovať odpoveď z Apps Scriptu (očakávané s 'no-cors' pre JSON):", jsonError);
          }
        } catch (emailError) {
          console.error("Chyba pri odosielaní registračného e-mailu cez Apps Script (fetch error):", emailError);
        }

        if (isAdminRegistration) {
          await db.collection('users').doc(userCredential.user.uid).update({
            role: 'admin',
            approved: false
          });
          console.log(`Firestore: Rola používateľa ${email} bola aktualizovaná na 'admin' a schválenie na 'false'.`);
        }

      } catch (firestoreError) {
        console.error("Firestore Save/Update Error:", firestoreError);
        setError(`Chyba pri ukladaní/aktualizácii používateľa do databázy: ${firestoreError.message}. Skontrolujte Firebase Security Rules.`);
        setLoading(false);
        setUserNotificationMessage('');
        return;
      }

      if (!isAdminRegistration) {
        setUserNotificationMessage(`Ďakujeme za registráciu Vášho klubu na turnaj Slovak Open Handball. Na e-mailovú adresu ${email} sme odoslali potvrdenie registrácie.`);
      }
      
      setLoading(false);

      await auth.signOut(); 
      setUser(null);
      
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
      setUserNotificationMessage('');
    } 
  };

  const currentPath = window.location.pathname.split('/').pop();
  const isRegistrationPage = currentPath === 'register.html' || currentPath === 'admin-register.html';
  const is_admin_register_page = currentPath === 'admin-register.html';

  // Prioritné zobrazenie správy o úspešnej registrácii na registračných stránkach
  if (isRegistrationPage && userNotificationMessage) {
    return React.createElement(
      'div',
      { className: 'min-h-screen bg-gray-100 flex flex-col items-center justify-center font-inter overflow-y-auto' },
      React.createElement(
        'div',
        { className: 'w-full max-w-md mt-20 mb-10 p-4' },
        React.createElement(
          'div',
          { className: 'bg-white p-8 rounded-lg shadow-xl w-full text-center' },
          React.createElement('h1', { className: 'text-3xl font-bold text-gray-800 mb-4' }, 'Registrácia úspešná!'),
          React.createElement(
            'div',
            { className: 'bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4', role: 'alert' },
            userNotificationMessage
          ),
          React.createElement('p', { className: 'text-lg text-gray-600' }, 'Presmerovanie na prihlasovaciu stránku...')
        )
      )
    );
  }

  // Ak nie je registrácia s úspešnou správou, potom kontrolujeme ostatné stavy načítania
  if (loading || user === undefined || !settingsLoaded) {
    return React.createElement(
      'div',
      { className: 'flex items-center justify-center min-h-screen bg-gray-100' },
      React.createElement('div', { className: 'text-xl font-semibold text-gray-700' }, 'Načítavam...')
    );
  }

  // Ak je používateľ už prihlásený, presmerujeme ho
  if (user) {
    window.location.href = 'logged-in-my-data.html';
    return null;
  }

  const now = new Date();
  const regStart = registrationStartDate ? new Date(registrationStartDate) : null;
  const regEnd = registrationEndDate ? new Date(registrationEndDate) : null;

  // Ak nie je admin registrácia a registrácia nie je otvorená, zobrazte správu
  if (!is_admin_register_page && !isRegistrationOpen) {
    return React.createElement(
      'div',
      { className: 'min-h-screen bg-gray-100 flex flex-col items-center justify-center font-inter overflow-y-auto' },
      React.createElement(
        'div',
        { className: 'w-full max-w-md mt-20 mb-10 p-4' },
        React.createElement(
          'div',
          { className: 'bg-white p-8 rounded-lg shadow-xl w-full text-center' },
          React.createElement('h1', { className: 'text-3xl font-bold text-gray-800 mb-4' }, 'Registrácia na turnaj'),
          React.createElement(
            'p',
            { className: 'text-lg text-gray-600' },
            'Registračný formulár nie je prístupný.'
          ),
          regStart && !isNaN(regStart) && now < regStart && (
            React.createElement(
              React.Fragment,
              null,
              React.createElement(
                'p',
                { className: 'text-md text-gray-500 mt-2' },
                'Registrácia bude možná od:',
                ' ',
                React.createElement('span', { style: { whiteSpace: 'nowrap' } }, new Date(registrationStartDate).toLocaleDateString('sk-SK')),
                ' ',
                React.createElement('span', { style: { whiteSpace: 'nowrap' } }, new Date(registrationStartDate).toLocaleTimeString('sk-SK'))
              ),
              countdown && (
                  React.createElement('p', { className: 'text-md text-gray-500 mt-2' }, `Registrácia začne o: ${countdown}`)
              )
            )
          ),
          regEnd && !isNaN(regEnd) && now > regEnd && (
            React.createElement(
              'p',
              { className: 'text-md text-gray-500 mt-2' },
              'Registrácia skončila:',
              ' ',
              React.createElement('span', { style: { whiteSpace: 'nowrap' } }, new Date(registrationEndDate).toLocaleDateString('sk-SK')),
              ' ',
              React.createElement('span', { style: { whiteSpace: 'nowrap' } }, new Date(registrationEndDate).toLocaleTimeString('sk-SK'))
            )
          ),
          React.createElement(
            'div',
            { className: 'mt-6 flex justify-center' },
            React.createElement(
              'a',
              {
                href: 'index.html',
                className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200'
              },
              'Späť na úvod'
            )
          )
        )
      )
    );
  }
    
  // Zobrazenie registračného formulára s potenciálnou správou
  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
    React.createElement(
      'div',
      { className: 'w-full max-w-md mt-20 mb-10 p-4' },
      React.createElement(
        'div',
        { className: 'bg-white p-8 rounded-lg shadow-xl w-full' },
        error && React.createElement(
          'div',
          { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap', role: 'alert' },
          error
        ),
        React.createElement('h1', { className: 'text-3xl font-bold text-center text-gray-800 mb-6' },
          is_admin_register_page ? "Registrácia administrátora" : "Registrácia na turnaj"
        ),
        React.createElement(
          'form',
          { onSubmit: (e) => handleRegister(e, is_admin_register_page), className: 'space-y-4' },
          React.createElement(
            'div',
            null,
            React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'reg-first-name' },
              is_admin_register_page ? "Meno" : "Meno kontaktnej osoby"
            ),
            React.createElement('input', {
              type: 'text',
              id: 'reg-first-name',
              className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
              value: firstName,
              onChange: (e) => setFirstName(e.target.value),
              required: true,
              placeholder: "Zadajte svoje meno",
              autoComplete: "given-name",
              disabled: loading || !!userNotificationMessage,
            })
          ),
          React.createElement(
            'div',
            null,
            React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'reg-last-name' },
              is_admin_register_page ? "Priezvisko" : "Priezvisko kontaktnej osoby"
            ),
            React.createElement('input', {
              type: 'text',
              id: 'reg-last-name',
              className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
              value: lastName,
              onChange: (e) => setLastName(e.target.value),
              required: true,
              placeholder: "Zadajte svoje priezvisko",
              autoComplete: "family-name",
              disabled: loading || !!userNotificationMessage,
            })
          ),
          is_admin_register_page ? (
            React.createElement(
              'div',
              null,
              React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'reg-email' }, 'E-mailová adresa'),
              React.createElement('input', {
                type: 'email',
                id: 'reg-email',
                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                value: email,
                onChange: (e) => setEmail(e.target.value),
                required: true,
                placeholder: "Zadajte svoju e-mailovú adresu",
                autoComplete: "email",
                disabled: loading || !!userNotificationMessage,
              })
            )
          ) : (
            React.createElement(
              React.Fragment,
              null,
              React.createElement(
                'div',
                null,
                React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'reg-phone-number' }, 'Telefónne číslo kontaktnej osoby'),
                React.createElement('input', {
                  type: 'tel',
                  id: 'reg-phone-number',
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
                      e.target.setCustomValidity("Za znakom '+' sú povolené iba číslice.");
                      e.target.reportValidity();
                      return;
                    }
                    setContactPhoneNumber(value);
                    e.target.setCustomValidity('');
                  },
                  onInvalid: (e) => {
                    if (e.target.value.length === 0) {
                      e.target.setCustomValidity("Prosím, vyplňte toto pole.");
                    } else if (e.target.value.length === 1 && e.target.value !== '+') {
                      e.target.setCustomValidity("Telefónne číslo musí začínať znakom '+'.");
                    } else if (e.target.value.length > 1 && !/^\+\d*$/.test(e.target.value)) {
                      e.target.setCustomValidity("Za znakom '+' sú povolené iba číslice.");
                    } else {
                      e.target.setCustomValidity("Telefónne číslo musí začínať znakom '+' a obsahovať iba číslice (napr. +421901234567).");
                    }
                  },
                  required: true,
                  placeholder: "+421901234567",
                  pattern: "^\\+\\d+$",
                  title: "Telefónne číslo musí začínať znakom '+' a obsahovať iba číslice (napr. +421901234567).",
                  disabled: loading || !!userNotificationMessage,
                })
              ),
              React.createElement(
                'p',
                { className: 'text-gray-600 text-sm -mt-2' },
                'E-mailová adresa bude slúžiť na všetku komunikáciu súvisiacu s turnajom - zasielanie informácií, faktúr atď.'
              ),
              React.createElement(
                'div',
                null,
                React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'reg-email' }, 'E-mailová adresa kontaktnej osoby'),
                React.createElement('input', {
                  type: 'email',
                  id: 'reg-email',
                  className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                  value: email,
                  onChange: (e) => setEmail(e.target.value),
                  required: true,
                  placeholder: "Zadajte svoju e-mailovú adresu",
                  autoComplete: "email",
                  disabled: loading || !!userNotificationMessage,
                })
              ),
              React.createElement(
                'p',
                { className: 'text-gray-600 text-sm' },
                'Vytvorenie hesla umožní neskorší prístup k registračnému formuláru, v prípade potreby úpravy alebo doplnenia poskytnutých údajov.'
              )
            )
          ),
          React.createElement(PasswordInput, {
            id: 'reg-password',
            label: 'Heslo',
            value: password,
            onChange: (e) => setPassword(e.target.value),
            onCopy: (e) => e.preventDefault(),
            onPaste: (e) => e.preventDefault(),
            onCut: (e) => e.preventDefault(),
            placeholder: "Zvoľte heslo (min. 10 znakov)",
            autoComplete: "new-password",
            showPassword: showPasswordReg,
            toggleShowPassword: () => setShowPasswordReg(!showPasswordReg),
            disabled: loading || !!userNotificationMessage,
            description: React.createElement(
              React.Fragment,
              null,
              'Heslo musí obsahovať:',
              React.createElement(
                'ul',
                { className: 'list-disc list-inside ml-4' },
                React.createElement('li', null, 'aspoň jedno malé písmeno,'),
                React.createElement('li', null, 'aspoň jedno veľké písmeno,'),
                React.createElement('li', null, 'aspoň jednu číslicu.')
              )
            )
          }),
          React.createElement(PasswordInput, {
            id: 'reg-confirm-password',
            label: 'Potvrďte heslo',
            value: confirmPassword,
            onChange: (e) => setConfirmPassword(e.target.value),
            onCopy: (e) => e.preventDefault(),
            onPaste: (e) => e.preventDefault(),
            onCut: (e) => e.preventDefault(),
            placeholder: "Potvrďte heslo",
            autoComplete: "new-password",
            showPassword: showConfirmPasswordReg,
            toggleShowPassword: () => setShowConfirmPasswordReg(!showConfirmPasswordReg),
            disabled: loading || !!userNotificationMessage,
          }),
          React.createElement(
            'button',
            {
              type: 'submit',
              className: 'bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200',
              disabled: loading || !!userNotificationMessage,
            },
            loading ? (
              React.createElement(
                'div',
                { className: 'flex items-center justify-center' },
                React.createElement('svg', { className: 'animate-spin -ml-1 mr-3 h-5 w-5 text-white', xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24' },
                  React.createElement('circle', { className: 'opacity-25', cx: '12', cy: '12', r: '10', stroke: 'currentColor', strokeWidth: '4' }),
                  React.createElement('path', { className: 'opacity-75', fill: 'currentColor', d: 'M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z' })
                ),
                'Registrujem...'
              )
            ) : 'Registrovať sa'
          )
        )
      )
    )
  );
}

// Render the React application after the App component is defined
// This ensures that App is available when ReactDOM.createRoot is called.
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App, null));
