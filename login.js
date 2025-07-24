// Global application ID and Firebase configuration (should be consistent across all React apps)
// Tieto konštanty sú teraz definované v <head> login.html
// const appId = '1:26454552024:web:6954b4f90f87a3a1eb43cd';
// const firebaseConfig = { ... };
// const initialAuthToken = null;

const RECAPTCHA_SITE_KEY = "6LdJbn8rAAAAAO4C50qXTWva6ePzDlOfYwBDEDwa";
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec";

// PasswordInput Component for password fields with visibility toggle (converted to React.createElement)
function PasswordInput({ id, label, value, onChange, placeholder, autoComplete, showPassword, toggleShowPassword, onCopy, onPaste, onCut, disabled, description }) {
  // SVG icons for eye (show password) and eye-off (hide password)
  const EyeIcon = React.createElement(
    'svg',
    { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
    // Cesta pre ikonu oka (viditeľné)
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 5 12 5c4.638 0 8.573 2.51 9.963 7.322.034.139.034.279 0 .418A10.05 10.05 0 0112 19c-4.638 0-8.573-2.51-9.963-7.322zM12 15a3 3 0 100-6 3 3 0 000 6z' })
  );

  const EyeOffIcon = React.createElement(
    'svg',
    { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
    // Vylepšená cesta pre ikonu preškrtnutého oka (eye-slash) pre lepší vizuál
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.274-4.057 5.064-7 9.542-7a9.95 9.95 0 011.875.175m.001 0V5m0 14v-2.175m0-10.65L12 12m-6.25 6.25L12 12m0 0l6.25-6.25M12 12l-6.25-6.25' })
  );

  return React.createElement(
    'div',
    null, // Odstránené 'relative' z tohto divu
    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: id }, label),
    React.createElement(
      'div',
      { className: 'relative flex items-center' }, // Pridané 'flex items-center' pre tento kontajner
      React.createElement('input', {
        type: showPassword ? 'text' : 'password',
        id: id,
        // Zmenené pr-10 na pr-12 pre viac miesta pre ikonu
        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-12 mb-0 mt-0',
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
          // Odstránené focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 pre odstránenie modrého orámovania
          // Pridané focus:outline-none pre úplné odstránenie predvoleného obrysu
          className: 'absolute right-0 inset-y-0 my-auto px-3 flex items-center focus:outline-none rounded-lg',
          disabled: disabled,
        },
        showPassword ? EyeOffIcon : EyeIcon
      )
    ),
    description && React.createElement(
      'p',
      { className: 'text-gray-600 text-sm mt-2' }, // Zmenené z -mt-2 na mt-2 pre konzistentnosť s register.js
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


// Main React component for the login.html page
function App() {
  const [app, setApp] = React.useState(null);
  const [auth, setAuth] = React.useState(null);
  const [db, setDb] = React.useState(null);
  const [user, setUser] = React.useState(undefined); // Inicializácia na undefined
  const [isAuthReady, setIsAuthReady] = React.useState(false); // Nový stav pre pripravenosť autentifikácie
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [userNotificationMessage, setUserNotificationMessage] = React.useState('');

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPasswordLogin, setShowPasswordLogin] = React.useState(false);

  // States for date and time settings (pridané pre kontrolu registrácie)
  const [registrationStartDate, setRegistrationStartDate] = React.useState('');
  const [registrationEndDate, setRegistrationEndDate] = React.useState('');
  const [settingsLoaded, setSettingsLoaded] = React.useState(false); // Nový stav pre načítanie nastavení

  // Calculate registration status as a memoized value (pridané pre kontrolu registrácie)
  const isRegistrationOpen = React.useMemo(() => {
    if (!settingsLoaded) return false; // Počkáme, kým sa načítajú nastavenia
    const now = new Date();
    const regStart = registrationStartDate ? new Date(registrationStartDate) : null;
    const regEnd = registrationEndDate ? new Date(registrationEndDate) : null;

    // Skontrolujeme, či sú dátumy platné pred porovnaním
    const isRegStartValid = regStart instanceof Date && !isNaN(regStart);
    const isRegEndValid = regEnd instanceof Date && !isNaN(regEnd);

    return (
      (isRegStartValid ? now >= regStart : true) && // Ak regStart nie je platný, predpokladáme, že registrácia začala
      (isRegEndValid ? now <= regEnd : true)        // Ak regEnd nie je platný, predpokladáme, že registrácia neskončila
    );
  }, [settingsLoaded, registrationStartDate, registrationEndDate]);


  // Effect for Firebase initialization and Auth Listener setup (runs only once)
  React.useEffect(() => {
    let unsubscribeAuth;
    let firestoreInstance;

    try {
      if (typeof firebase === 'undefined') {
        setError("Firebase SDK nie je načítané. Skontrolujte login.html.");
        setLoading(false);
        return;
      }

      // Získanie predvolenej Firebase aplikácie
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
          } else {
            // No anonymous sign-in for login.js, user will explicitly log in
          }
        } catch (e) {
          console.error("Chyba pri počiatočnom prihlásení Firebase:", e);
          setError(`Zadali ste nesprávne prihlasovacie údaje`);
        }
      };

      unsubscribeAuth = authInstance.onAuthStateChanged(async (currentUser) => {
        console.log("LoginApp: onAuthStateChanged volaný. currentUser:", currentUser ? currentUser.uid : "null");
        setUser(currentUser); // Set user state to null or user object
        setIsAuthReady(true); // Mark auth as ready after the first check
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

  // Effect for loading settings (pridané pre kontrolu registrácie)
  React.useEffect(() => {
    const fetchSettings = async () => {
      if (!db || !isAuthReady) {
        return; // Počkáme na inicializáciu DB a Auth
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
            setSettingsLoaded(true); // Nastavenia sú načítané
          }, error => {
            console.error("Chyba pri načítaní nastavení registrácie (onSnapshot):", error);
            setError(`Chyba pri načítaní nastavení: ${error.message}`);
            setSettingsLoaded(true); // Nastavenia sú načítané aj v prípade chyby
          });

          return () => unsubscribeSettings();
      } catch (e) {
          console.error("Chyba pri nastavovaní onSnapshot pre nastavenia registrácie:", e);
          setError(`Chyba pri nastavovaní poslucháča pre nastavenia: ${e.message}`);
          setSettingsLoaded(true); // Nastavenia sú načítané aj v prípade chyby
      }
    };

    fetchSettings();
  }, [db, isAuthReady]); // Závisí od db a isAuthReady


  // useEffect for updating header link visibility
  React.useEffect(() => {
    console.log(`LoginApp: useEffect pre aktualizáciu odkazov hlavičky. User: ${user ? user.uid : 'null'}, isRegistrationOpen: ${isRegistrationOpen}`);
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
        console.log("LoginApp: Používateľ prihlásený. Skryté: Prihlásenie, Registrácia. Zobrazené: Moja zóna, Odhlásenie.");
      } else { // Ak používateľ nie je prihlásený
        authLink.classList.remove('hidden');
        profileLink && profileLink.classList.add('hidden');
        logoutButton && logoutButton.classList.add('hidden');
        // Na prihlasovacej stránke zobraziť odkaz na registráciu len ak je registrácia otvorená
        if (isRegistrationOpen) {
          registerLink && registerLink.classList.remove('hidden');
          console.log("LoginApp: Používateľ odhlásený, registrácia otvorená. Zobrazené: Prihlásenie, Registrácia.");
        } else {
          registerLink && registerLink.classList.add('hidden');
          console.log("LoginApp: Používateľ odhlásený, registrácia zatvorená. Zobrazené: Prihlásenie. Skryté: Registrácia.");
        }
      }
    }
  }, [user, isRegistrationOpen]); // Spustí sa pri zmene používateľa alebo stavu registrácie

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

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!auth || !db) { 
      setError("Firebase Auth alebo Firestore nie je inicializovaný.");
      return;
    }
    if (!email || !password) {
      setError("Zadajte prosím svoju e-mailovú adresu a heslo.");
      return;
    }

    const recaptchaToken = await getRecaptchaToken('login');
    if (!recaptchaToken) {
      setError("Overenie reCAPTCHA zlyhalo. Skúste to prosím znova.");
      return null;
    }
    console.log("reCAPTCHA Token pre prihlásenie:", recaptchaToken);

    setLoading(true);
    setError(''); // Clear previous errors
    setUserNotificationMessage(''); // Clear previous messages
    try {
      const userCredential = await auth.signInWithEmailAndPassword(email, password);
      const currentUser = userCredential.user;

      const userDocRef = db.collection('users').doc(currentUser.uid);
      const userDoc = await userDocRef.get();

      if (!userDoc.exists) {
        setError("Účet sa nenašiel v databáze. Kontaktujte podporu.");
        await auth.signOut(); 
        setLoading(false);
        return;
      }

      const userData = userDoc.data();
      console.log("Prihlásenie: Používateľské dáta z Firestore:", userData);

      if (userData.role === 'admin' && userData.approved === false) { 
        setError("Pre plnú aktiváciu počkajte prosím na schválenie účtu iným administrátorom."); 
        
        // Send email for unapproved administrator
        try {
          const payload = {
            action: 'sendAdminApprovalReminder', 
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            isAdmin: true 
          };
          console.log("Odosielanie dát do Apps Script (pripomienka schválenia admina):", payload);
          const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors', 
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
          });
          console.log("Požiadavka na odoslanie e-mailu s pripomienkou schválenia admina odoslaná.");
          try {
            const responseData = await response.text();
            console.log("Odpoveď z Apps Script (fetch - pripomienka schválenia admina) ako text:", responseData);
          } catch (jsonError) {
            console.warn("Nepodarilo sa analyzovať odpoveď z Apps Script (očakávané s 'no-cors' pre JSON):", jsonError);
          }
        } catch (emailError) {
          console.error("Chyba pri odosielaní e-mailu s pripomienkou schválenia admina cez Apps Script (chyba fetch):", emailError);
        }

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

      setUserNotificationMessage("Prihlásenie úspešné! Presmerovanie na profilovú stránku...");
      setError('');
      setEmail('');
      setPassword('');
      
      setLoading(false); 

      setTimeout(() => {
        window.location.href = 'logged-in-my-data.html'; // ZMENA: Presmerovanie na logged-in-my-data.html
      }, 5000); 

    } catch (e) {
      console.error("Chyba pri prihlásení:", e);
      // ZMENA: Upravená chybová správa pre nesprávne prihlasovacie údaje
      if (e.code === 'auth/invalid-credential' || e.code === 'auth/invalid-login-credentials') {
        setError("Nepodarilo sa prihlásiť – nesprávne meno alebo heslo.");
      } else {
        setError(`Zadali ste nesprávne prihlasovacie údaje`);
      }
      setLoading(false);
    } 
  };

  // Display loading state
  // Ak je user === undefined (ešte nebola skontrolovaná autentifikácia) alebo loading je true, zobraz loading.
  // Ak je user objekt (prihlásený), presmeruj.
  if (!isAuthReady || loading || user === undefined || !settingsLoaded) { // Čakáme na všetky závislosti
    if (isAuthReady && user) { // Ak je user objekt a auth je ready, znamená to, že je prihlásený, presmeruj
        console.log("LoginApp: Auth je ready a používateľ je prihlásený, presmerovávam na logged-in-my-data.html");
        window.location.href = 'logged-in-my-data.html'; // ZMENA: Presmerovanie na logged-in-my-data.html
        return null; // Nič nevykresľuj počas presmerovania
    }
    return React.createElement(
      'div',
      { className: 'flex items-center justify-center min-h-screen bg-gray-100' },
      React.createElement('div', { className: 'text-xl font-semibold text-gray-700' }, 'Načítavam...')
    );
  }

  // Ak je user === null (definitívne odhlásený) a loading je false, pokračuj vo vykresľovaní prihlasovacieho formulára.
  // Ak je prítomná správa o úspešnom prihlásení, zobraz ju a spracuj presmerovanie.
  if (userNotificationMessage && userNotificationMessage.includes("Prihlásenie úspešné!")) {
    return React.createElement(
      'div',
      { className: 'min-h-screen bg-gray-100 flex flex-col items-center justify-center font-inter overflow-y-auto' },
      React.createElement(
        'div',
        { className: 'w-full max-w-md mt-20 mb-10 p-4' },
        React.createElement(
          'div',
          { className: 'bg-white p-8 rounded-lg shadow-xl w-full text-center' },
          React.createElement('h1', { className: 'text-3xl font-bold text-gray-800 mb-4' }, 'Prihlásenie úspešné!'),
          React.createElement(
            'div',
            { className: 'bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4', role: 'alert' },
            userNotificationMessage
          ),
          React.createElement('p', { className: 'text-lg text-gray-600' }, 'Presmerovanie na profilovú stránku...')
        )
      )
    );
  }

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
    // Notification Modal (for success messages after login)
    React.createElement(NotificationModal, {
        message: userNotificationMessage,
        onClose: () => setUserNotificationMessage('') // Clear message when modal closes
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
        React.createElement('h1', { className: 'text-3xl font-bold text-center text-gray-800 mb-6' }, 'Prihlásenie'),
        React.createElement(
          'form',
          { onSubmit: handleLogin, className: 'space-y-4' },
          React.createElement(
            'div',
            null,
            React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'email' }, 'E-mailová adresa'),
            React.createElement('input', {
              type: 'email',
              id: 'email',
              className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
              value: email,
              onChange: (e) => setEmail(e.target.value),
              required: true,
              placeholder: 'Zadajte svoju e-mailovú adresu',
              autoComplete: 'email',
            })
          ),
          React.createElement(PasswordInput, {
            id: 'password',
            label: 'Heslo',
            value: password,
            onChange: (e) => setPassword(e.target.value),
            onCopy: (e) => e.preventDefault(),
            onPaste: (e) => e.preventDefault(),
            onCut: (e) => e.preventDefault(),
            placeholder: 'Zadajte heslo',
            autoComplete: 'current-password',
            showPassword: showPasswordLogin,
            toggleShowPassword: () => setShowPasswordLogin(!showPasswordLogin),
          }),
          React.createElement(
            'button',
            {
              type: 'submit',
              className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200',
              disabled: loading,
            },
            loading ? 'Prihlasujem...' : 'Prihlásiť'
          )
        )
      )
    )
  );
}
