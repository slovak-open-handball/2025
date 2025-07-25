// Global application ID and Firebase configuration (should be consistent across all React apps)
// Tieto konštanty sú teraz definované v <head> login.html
// const appId = '1:26454552024:web:6954b4f90f87a3a1eb43cd';
// const firebaseConfig = { ... };
// const initialAuthToken = null;

const RECAPTCHA_SITE_KEY = "6LdJbn8rAAAAAO4C50qXTWva6ePzDlOfYwBDEDwa";
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec";

// PasswordInput Component for password fields with visibility toggle (converted to React.createElement)
function PasswordInput({ id, label, value, onChange, placeholder, autoComplete, showPassword, toggleShowPassword, onCopy, onPaste, onCut, disabled, description, tabIndex }) { // Pridaný tabIndex
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
    // Cesta pre ikonu celého oka
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 5 12 5c4.638 0 8.573 2.51 9.963 7.322.034.139.034.279 0 .418A10.05 10.05 0 0112 19c-4.638 0-8.573-2.51-9.963-7.322zM12 15a3 3 0 100-6 3 3 0 000 6z' }),
    // Cesta pre diagonálnu čiaru preškrtnutia (pridaná pre štýl "celé oko s preškrtnutím")
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M4 20 L20 4' })
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
        tabIndex: tabIndex, // Pridaný tabIndex pre input
      }),
      React.createElement(
        'span', // Zostáva 'span'
        {
          onClick: toggleShowPassword,
          // Odstránené focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 pre odstránenie modrého orámovania
          // Pridané focus:outline-none pre úplné odstránenie predvoleného obrysu
          className: 'absolute right-0 inset-y-0 my-auto px-3 flex items-center focus:outline-none rounded-lg cursor-pointer', // Pridaný cursor-pointer pre vizuálnu indikáciu klikateľnosti
          // Odstránené role="button" a aria-label, aby sa zabránilo nechcenému zameraniu
          tabIndex: -1 // Zabezpečí, že element nebude v poradí tabulátorov
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
  const [loading, setLoading] = React.useState(true); // Tento stav bude riadiť zobrazenie "Načítavam..."
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
          // Nechceme nastaviť error hneď pri počiatočnom prihlásení, ak len nie je token
          // setError(`Zadali ste nesprávne prihlasovacie údaje`);
        }
      };

      unsubscribeAuth = authInstance.onAuthStateChanged(async (currentUser) => {
        console.log("LoginApp: onAuthStateChanged volaný. currentUser:", currentUser ? currentUser.uid : "null");
        setUser(currentUser); // Set user state to null or user object
        setIsAuthReady(true); // Mark auth as ready after the first check
        setLoading(false); // Auth state checked, stop loading for initial page load
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
            setLoading(false); // Nastavenia sú načítané aj v prípade chyby
          });

          return () => unsubscribeSettings();
      } catch (e) {
          console.error("Chyba pri nastavovaní onSnapshot pre nastavenia registrácie:", e);
          setError(`Chyba pri nastavovaní poslucháča pre nastavenia: ${e.message}`);
          setLoading(false); // Nastavenia sú načítané aj v prípade chyby
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

    // Okamžité nastavenie loading na true, aby sa formulár schoval
    setLoading(true); 
    setError(''); // Clear previous errors
    setUserNotificationMessage(''); // Clear previous messages

    const recaptchaToken = await getRecaptchaToken('login');
    if (!recaptchaToken) {
      setError("Overenie reCAPTCHA zlyhalo. Skúste to prosím znova.");
      setLoading(false); // Reset loading na false, ak recaptcha zlyhá
      return null;
    }
    console.log("reCAPTCHA Token pre prihlásenie:", recaptchaToken);

    try {
      const userCredential = await auth.signInWithEmailAndPassword(email, password);
      const currentUser = userCredential.user;

      const userDocRef = db.collection('users').doc(currentUser.uid);
      
      // DÔLEŽITÉ: Aktualizácia timestampu passwordLastChanged pri úspešnom prihlásení
      await userDocRef.update({
        passwordLastChanged: firebase.firestore.FieldValue.serverTimestamp()
      });
      console.log("Prihlásenie: Timestamp passwordLastChanged aktualizovaný vo Firestore.");
      
      // Získame aktualizované dáta po update, aby sme získali vyhodnotený serverTimestamp
      const updatedUserDoc = await userDocRef.get(); 
      if (!updatedUserDoc.exists) {
        setError("Účet sa nenašiel v databáze po aktualizácii timestampu. Kontaktujte podporu.");
        await auth.signOut();
        setLoading(false);
        return;
      }
      const updatedUserData = updatedUserDoc.data();

      // Uložíme presný serverTimestamp do localStorage
      if (updatedUserData.passwordLastChanged && typeof updatedUserData.passwordLastChanged.toDate === 'function') {
        localStorage.setItem(`passwordLastChanged_${currentUser.uid}`, updatedUserData.passwordLastChanged.toDate().getTime().toString());
        console.log("Prihlásenie: localStorage passwordLastChanged aktualizovaný s presným Firestore timestampom.");
      } else {
        console.error("Prihlásenie: Nepodarilo sa získať platný passwordLastChanged z Firestore po aktualizácii.");
        // Ak sa nepodarí získať platný timestamp, pre istotu odhlásiť
        await auth.signOut();
        window.location.href = 'login.html';
        return;
      }

      if (updatedUserData.role === 'admin' && updatedUserData.approved === false) {
        setError("Pre plnú aktiváciu počkajte prosím na schválenie účtu iným administrátorom.");

        // Send email for unapproved administrator
        try {
          const payload = {
            action: 'sendAdminApprovalReminder',
            email: updatedUserData.email,
            firstName: updatedUserData.firstName,
            lastName: updatedUserData.lastName,
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
        ...updatedUserData, // Používame updatedUserData, nie pôvodné userData
        displayName: updatedUserData.firstName && updatedUserData.lastName ? `${updatedUserData.firstName} ${updatedUserData.lastName}` : updatedUserData.email,
        displayNotifications: updatedUserData.displayNotifications !== undefined ? updatedUserData.displayNotifications : true
      }));

      setUserNotificationMessage("Prihlásenie úspešné! Presmerovanie na profilovú stránku...");
      setError('');
      setEmail('');
      setPassword('');
      
      setLoading(false); // ZMENA: Nastavíme loading na false hneď po úspešnom prihlásení

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
      setLoading(false); // Reset loading na false, ak prihlásenie zlyhá
    }
  };

  // Display loading state (pre celú stránku)
  // Ak je user === undefined (ešte nebola skontrolovaná autentifikácia)
  // ALEBO !settingsLoaded (nastavenia sa ešte načítavajú),
  // zobraz loading.
  if (!isAuthReady || user === undefined || !settingsLoaded) { 
    // Ak je user objekt (prihlásený) a auth je ready, znamená to, že je prihlásený, presmeruj
    if (isAuthReady && user) { 
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

  // Vykreslenie prihlasovacieho formulára (iba ak nie je prihlásený a nie je zobrazená úspešná správa)
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
              tabIndex: 1 // Explicitne nastaví poradie tabulátorov pre pole e-mailu
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
            tabIndex: 2, // Nastaví tabIndex pre heslo na 2
          }),
          React.createElement(
            'button',
            {
              type: 'submit',
              className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200',
              disabled: loading, // Tlačidlo je disabled, ak sa načítava
              tabIndex: 3 // Nastaví tabIndex pre tlačidlo na 3
            },
            // Text tlačidla sa zmení na "Prihlasujem..." iba ak je loading true
            loading ? 'Prihlasujem...' : 'Prihlásiť'
          )
        )
      )
    )
  );
}
