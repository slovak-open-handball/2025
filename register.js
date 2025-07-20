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

const RECAPTCHA_SITE_KEY = "6LdJbn8rAAAAAO4C50qXTWva6ePzDlOfYwBDEDwa";
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

// Main React component for the registration page
function App() {
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

  const [showPasswordReg, setShowPasswordReg] = React.useState(false);
  const [showConfirmPasswordReg, setShowConfirmPasswordReg] = React.useState(false);

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
        setError("Firebase SDK nie je načítané. Skontrolujte register.html.");
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
            // No anonymous sign-in for register.js, user will explicitly register
          }
        } catch (e) {
          console.error("Chyba pri počiatočnom prihlásení Firebase:", e);
          setError(`Chyba pri prihlásení: ${e.message}`);
        }
      };

      unsubscribeAuth = authInstance.onAuthStateChanged(async (currentUser) => {
        setUser(currentUser);
        setIsAuthReady(true);
        // If user is already logged in, redirect them to logged-in.html
        if (currentUser) {
            window.location.href = 'logged-in.html';
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
                console.log("Nastavenia registrácie sa nenašli v Firestore. Používajú sa predvolené prázdne hodnoty.");
                setRegistrationStartDate('');
                setRegistrationEndDate('');
            }
            setSettingsLoaded(true);
            setLoading(false);
          }, error => {
            console.error("Chyba pri načítaní nastavení registrácie (onSnapshot):", error);
            setError(`Chyba pri načítaní nastavení: ${error.message}`);
            setSettingsLoaded(true);
            setLoading(false);
          });

          return () => unsubscribeSettings();
      } catch (e) {
          console.error("Chyba pri nastavovaní onSnapshot pre nastavenia registrácie:", e);
          setError(`Chyba pri nastavovaní poslucháča pre nastavenia: ${e.message}`);
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

  // useEffect for updating header link visibility (simplified for register.html)
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
        // On registration page, always show register link if not logged in (regardless of registration open status)
        registerLink && registerLink.classList.remove('hidden');
      }
    }
  }, [user]); // Runs on user change

  // Handle logout (needed for the header logout button)
  const handleLogout = React.useCallback(async () => {
    if (!auth) return;
    try {
      setLoading(true);
      await auth.signOut();
      setMessage("Úspešne odhlásený.");
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
      errors.push("aspoň 10 znakov");
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
    // Changed condition: contactPhoneNumber is always required
    if (!email || !password || !confirmPassword || !firstName || !lastName) {
      setError("Vyplňte prosím všetky polia.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Heslá sa nezhodujú. Skontrolujte ich prosím.");
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    // Phone number validation now applies only to regular registration
    if (!isAdminRegistration) {
      const phoneRegex = /^\+\d+$/;
      if (!contactPhoneNumber || !phoneRegex.test(contactPhoneNumber)) {
          setError("Telefónne číslo kontaktnej osoby musí začínať znakom '+' a obsahovať iba číslice (napr. +421901234567).");
          return;
      }
    }


    const recaptchaToken = await getRecaptchaToken('register');
    if (!recaptchaToken) {
      setError("Overenie reCAPTCHA zlyhalo. Skúste to prosím znova.");
      return null;
    }
    console.log("reCAPTCHA Token pre registráciu:", recaptchaToken);

    setLoading(true); // Show loading indicator
    setError(''); // Clear previous errors
    
    // Set the specific message for admin registration immediately
    if (isAdminRegistration) {
      setMessage(`Administrátorský účet pre ${email} sa registruje. Na vašu e-mailovú adresu sme poslali potvrdenie o registrácii. Pre plnú aktiváciu počkajte prosím na schválenie od iného administrátora.`);
    } else {
      // For regular users, keep message empty for now, so the generic "Loading..." from the button or general loading screen applies.
      setMessage(''); 
    }

    try {
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      await userCredential.user.updateProfile({ displayName: `${firstName} ${lastName}` });

      // Determine initial role and approval status
      let initialUserRole = 'user';
      let initialIsApproved = true; // Default for normal users, and initial for admins

      // If it's an administrator registration, set role to 'user' and approved to 'true'
      // This will be updated to 'admin' and 'false' later
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
        role: initialUserRole, // Use initial role
        approved: initialIsApproved, // Use initial approval status
        registeredAt: firebase.firestore.FieldValue.serverTimestamp(),
        displayNotifications: true
      };

      console.log("Pokus o uloženie používateľa do Firestore s počiatočnými dátami:", userDataToSave); // Detailed log

      try {
        await db.collection('users').doc(userCredential.user.uid).set(userDataToSave);
        console.log(`Firestore: Používateľ ${email} s počiatočnou rolou '${initialUserRole}' a schválením '${initialIsApproved}' bol uložený.`);

        // --- Moved email sending logic here ---
        // Attempt to send email via Apps Script immediately after saving initial data
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
          console.log("Odosielanie dát do Apps Script (registračný e-mail):", payload); // Log the payload
          const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors', // Returned: Using no-cors for Apps Script
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
          });
          console.log("Požiadavka na odoslanie registračného e-mailu odoslaná.");
          try {
            const responseData = await response.text(); // Read as text to avoid JSON parsing errors
            console.log("Odpoveď z Apps Script (fetch - registračný e-mail) ako text:", responseData); 
          } catch (jsonError) {
            console.warn("Nepodarilo sa analyzovať odpoveď z Apps Script (očakávané s 'no-cors' pre JSON):", jsonError);
          }
        } catch (emailError) {
          console.error("Chyba pri odosielaní registračného e-mailu cez Apps Script (chyba fetch):", emailError);
        }
        // --- End of moved logic ---


        // Explicitly load and log data after successful write
        const userDocRef = db.collection('users').doc(userCredential.user.uid);
        let userDocSnapshot = await userDocRef.get();
        if (userDocSnapshot.exists) {
          console.log("Dáta načítané z Firestore ihneď po počiatočnej registrácii:", userDocSnapshot.data());
        } else {
          console.log("Dokument používateľa sa nenašiel v Firestore ihneď po počiatočnej registrácii (neočakávané).");
        }

        // --- New logic for admin registration (after email sent) ---
        if (isAdminRegistration) {
          // Update role to admin and approved to false for admin registrations
          await db.collection('users').doc(userCredential.user.uid).update({
            role: 'admin',
            approved: false
          });
          console.log(`Firestore: rola používateľa ${email} bola aktualizovaná na 'admin' a schválené na 'false'.`);

          // Re-fetch and log data after the update
          userDocSnapshot = await userDocRef.get(); // Get updated snapshot
          if (userDocSnapshot.exists) {
            console.log("Dáta načítané z Firestore po aktualizácii roly admina:", userDocSnapshot.data());
          } else {
            console.log("Dokument používateľa sa nenašiel v Firestore po aktualizácii roly admina (neočakávané).");
          }
        }
        // --- End of new logic ---

      } catch (firestoreError) {
        console.error("Chyba pri ukladaní/aktualizácii Firestore:", firestoreError);
        setError(`Chyba pri ukladaní/aktualizácii používateľa do databázy: ${firestoreError.message}. Skontrolujte bezpečnostné pravidlá Firebase.`);
        setLoading(false);
        setMessage(''); // Clear message on error
        return; // Stop further execution if Firestore save fails
      }

      // Set the final success message for regular users
      if (!isAdminRegistration) {
        setMessage(`Ďakujeme za registráciu vášho klubu na turnaj Slovak Open Handball. Potvrdenie o registrácii sme poslali na ${email}.`);
      }
      // For admin registration, the message is already set at the beginning.
      
      setLoading(false); // Stop loading so the message is visible on the form

      // Now sign out and redirect after a delay
      await auth.signOut(); 
      setUser(null); // Explicitly set user to null after logout
      
      // Redirect after 5 seconds
      setTimeout(() => {
        window.location.href = 'login.html'; 
      }, 5000); 

    } catch (e) {
      console.error("Chyba pri registrácii (Auth alebo iné):", e); 
      if (e.code === 'auth/email-already-in-use') {
        setError("E-mailová adresa už existuje. Vyberte prosím inú.");
      } else if (e.code === 'auth/weak-password') {
        setError("Heslo je príliš slabé. " + validatePassword(password));
      } else if (e.code === 'auth/invalid-email') {
        setError("Neplatný formát e-mailovej adresy.");
      } else {
        setError(`Chyba pri registrácii: ${e.message}`);
      }
      setLoading(false); 
      setMessage(''); // Clear message on error
    } 
  };

  // Display loading state
  if (loading || !isAuthReady || user) { // If user is already logged in, show loading and redirect
    if (user) {
        window.location.href = 'logged-in.html'; // Redirect if already logged in
        return null; // Don't render anything while redirecting
    }
    return React.createElement(
      'div',
      { className: 'flex items-center justify-center min-h-screen bg-gray-100' },
      React.createElement('div', { className: 'text-xl font-semibold text-gray-700' }, 'Načítavam...')
    );
  }

  // Priority display of successful registration message on registration pages
  if (message) {
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
            message
          ),
          React.createElement('p', { className: 'text-lg text-gray-600' }, 'Presmerovanie na prihlasovaciu stránku...')
        )
      )
    );
  }

  const currentPath = window.location.pathname.split('/').pop();
  const is_admin_register_page = currentPath === 'admin-register.html';

  const now = new Date();
  const regStart = registrationStartDate ? new Date(registrationStartDate) : null;
  const regEnd = registrationEndDate ? new Date(registrationEndDate) : null;

  // If it's not admin registration and registration is not open, display message
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

  // Display registration form
  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
    React.createElement(NotificationModal, {
        message: message, // Use local message state for this modal
        onClose: () => setMessage('')
    }),
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
              placeholder: 'Zadajte svoje meno',
              autoComplete: 'given-name',
              disabled: loading || !!message,
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
              placeholder: 'Zadajte svoje priezvisko',
              autoComplete: 'family-name',
              disabled: loading || !!message,
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
                placeholder: 'Zadajte svoju e-mailovú adresu',
                autoComplete: 'email',
                disabled: loading || !!message,
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
                  disabled: loading || !!message,
                })
              ),
              React.createElement(
                'p',
                { className: 'text-gray-600 text-sm -mt-2' },
                'E-mailová adresa bude použitá pre všetku komunikáciu súvisiacu s turnajom - zasielanie informácií, faktúr atď.'
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
                  placeholder: 'Zadajte svoju e-mailovú adresu',
                  autoComplete: 'email',
                  disabled: loading || !!message,
                })
              ),
              React.createElement(
                'p',
                { className: 'text-gray-600 text-sm' },
                'Vytvorenie hesla umožní neskorší prístup k registračného formuláru, ak potrebujete upraviť alebo doplniť poskytnuté údaje.'
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
            placeholder: 'Zvoľte si heslo (min. 10 znakov)',
            autoComplete: 'new-password',
            showPassword: showPasswordReg,
            toggleShowPassword: () => setShowPasswordReg(!showPasswordReg),
            disabled: loading || !!message,
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
            ),
          }),
          React.createElement(PasswordInput, {
            id: 'reg-confirm-password',
            label: 'Potvrdiť heslo',
            value: confirmPassword,
            onChange: (e) => setConfirmPassword(e.target.value),
            onCopy: (e) => e.preventDefault(),
            onPaste: (e) => e.preventDefault(),
            onCut: (e) => e.preventDefault(),
            placeholder: 'Potvrďte heslo',
            autoComplete: 'new-password',
            showPassword: showConfirmPasswordReg,
            toggleShowPassword: () => setShowConfirmPasswordReg(!showConfirmPasswordReg),
            disabled: loading || !!message,
          }),
          React.createElement(
            'button',
            {
              type: 'submit',
              className: 'bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200',
              disabled: loading || !!message,
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
            ) : 'Registrovať'
          )
        )
      )
    )
  );
}
