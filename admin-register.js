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

// PasswordInput Component for password fields with visibility toggle (converted to React.createElement)
// Pridaný prop 'validationStatus' pre detailnú vizuálnu indikáciu platnosti hesla
function PasswordInput({ id, label, value, onChange, placeholder, autoComplete, showPassword, toggleShowPassword, onCopy, onPaste, onCut, disabled, validationStatus }) {
  // SVG ikony pre oko (zobraziť heslo) a preškrtnuté oko (skryť heslo) - ZJEDNOTENÉ S REGISTER.JS
  const EyeIcon = React.createElement(
    'svg',
    { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' }),
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' })
  );

  const EyeOffIcon = React.createElement(
    'svg',
    { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
    React.createElement('path', { fill: 'currentColor', stroke: 'none', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' }),
    React.createElement('path', { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' }),
    React.createElement('line', { x1: '21', y1: '3', x2: '3', y2: '21', stroke: 'currentColor', strokeWidth: '2' })
  );

  // Okraj inputu bude vždy predvolený (border-gray-300)
  const borderClass = 'border-gray-300';

  return React.createElement(
    'div',
    { className: 'mb-4' }, // Pridaná trieda mb-4 pre konzistentné medzery
    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: id }, label),
    React.createElement(
      'div',
      { className: 'relative' },
      React.createElement('input', {
        type: showPassword ? 'text' : 'password',
        id: id,
        // Používame len predvolenú triedu okraja
        className: `shadow appearance-none border ${borderClass} rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10`,
        value: value,
        onChange: onChange,
        onCopy: onCopy,
        onPaste: onPaste,
        onCut: onCut,
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
          className: 'absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 focus:outline-none',
          disabled: disabled,
        },
        showPassword ? EyeIcon : EyeOffIcon
      )
    ),
    // ZMENA: Podmienka pre zobrazenie popisu hesla - zobrazí sa len ak je validationStatus definovaný
    validationStatus && React.createElement(
      'div',
      { className: `text-xs italic mt-1 text-gray-600` }, // Text "Heslo musí obsahovať" je vždy sivý
      'Heslo musí obsahovať:',
      React.createElement(
        'ul',
        { className: 'list-none pl-4' }, // Používame list-none a vlastné odrážky pre dynamiku
        React.createElement(
          'li',
          { className: `flex items-center ${validationStatus.minLength ? 'text-green-600' : 'text-gray-600'}` },
          React.createElement('span', { className: 'mr-2' }, validationStatus.minLength ? '✔' : '•'),
          'aspoň 10 znakov,'
        ),
        React.createElement(
          'li',
          { className: `flex items-center ${validationStatus.hasUpperCase ? 'text-green-600' : 'text-gray-600'}` },
          React.createElement('span', { className: 'mr-2' }, validationStatus.hasUpperCase ? '✔' : '•'),
          'aspoň jedno veľké písmeno,'
        ),
        React.createElement(
          'li',
          { className: `flex items-center ${validationStatus.hasLowerCase ? 'text-green-600' : 'text-gray-600'}` },
          React.createElement('span', { className: 'mr-2' }, validationStatus.hasLowerCase ? '✔' : '•'),
          'aspoň jedno malé písmeno,'
        ),
        React.createElement(
          'li',
          { className: `flex items-center ${validationStatus.hasNumber ? 'text-green-600' : 'text-gray-600'}` },
          React.createElement('span', { className: 'mr-2' }, validationStatus.hasNumber ? '✔' : '•'),
          'aspoň jednu číslicu.'
        )
      )
    )
  );
}

// NotificationModal Component for displaying temporary messages (converted to React.createElement)
function NotificationModal({ message, onClose, type = 'info' }) { // Pridaný prop 'type'
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

  // Dynamické triedy pre farbu pozadia na základe typu správy
  let bgColorClass;
  if (type === 'success') {
    bgColorClass = 'bg-green-500';
  } else if (type === 'error') {
    bgColorClass = 'bg-red-600'; // Nastavenie červenej pre chyby
  } else {
    bgColorClass = 'bg-blue-500'; // Predvolená modrá pre info
  }

  return React.createElement(
    'div',
    {
      className: `fixed bottom-4 right-4 ${bgColorClass} text-white p-4 rounded-lg shadow-lg transition-transform transform ${show ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`,
      style: { zIndex: 1000 }
    },
    React.createElement('p', { className: 'font-semibold' }, message)
  );
}

// Main React component for the admin registration page
function App() {
  const [app, setApp] = React.useState(null);
  const [auth, setAuth] = React.useState(null);
  const [db, setDb] = React.useState(null);
  const [user, setUser] = React.useState(null);
  const [isAuthReady, setIsAuthReady] = React.useState(false);
  const [pageLoading, setPageLoading] = React.useState(true); // New state for initial page loading
  const [formSubmitting, setFormSubmitting] = React.useState(false); // New state for form submission

  // ZMENA: Používame 'errorMessage' pre chyby a 'successMessage' pre správu na zelenej stránke
  const [errorMessage, setErrorMessage] = React.useState(''); // Pre chyby (červený box a modál)
  const [successMessage, setSuccessMessage] = React.useState(''); // Pre zelenú stránku úspechu

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  // contactPhoneNumber is not required for admin registration, but kept for consistent data structure
  const [contactPhoneNumber, setContactPhoneNumber] = React.useState(''); 

  const [showPasswordReg, setShowPasswordReg] = React.useState(false);
  const [showConfirmPasswordReg, setShowConfirmPasswordReg] = React.useState(false);

  // Nové stavy pre validáciu hesla
  const [passwordValidationStatus, setPasswordValidationStatus] = React.useState({
    minLength: false,
    maxLength: false, // maxLength sa stále kontroluje, ale nezobrazuje sa v zozname
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
    isValid: false, // Celková platnosť hesla
  });
  const [isConfirmPasswordMatching, setIsConfirmPasswordMatching] = React.useState(false);


  // Effect for Firebase initialization and Auth Listener setup (runs only once)
  React.useEffect(() => {
    let unsubscribeAuth;
    let firestoreInstance;

    try {
      if (typeof firebase === 'undefined') {
        setErrorMessage("Firebase SDK nie je načítané. Skontrolujte admin-register.html.");
        setPageLoading(false); // Stop loading on critical error
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
            // No anonymous sign-in for admin-register.js, user will explicitly register
          }
        } catch (e) {
          console.error("Chyba pri počiatočnom prihlásení Firebase:", e);
          setErrorMessage(`Chyba pri prihlásení: ${e.message}`);
        }
      };

      unsubscribeAuth = authInstance.onAuthStateChanged(async (currentUser) => {
        setUser(currentUser);
        setIsAuthReady(true);
        setPageLoading(false); // Page is now fully loaded (auth is ready)
      });

      signIn();

      return () => {
        if (unsubscribeAuth) {
          unsubscribeAuth();
        }
      };
    } catch (e) {
      console.error("Nepodarilo sa inicializovať Firebase:", e);
      setErrorMessage(`Chyba pri inicializácii Firebase: ${e.message}`);
      setPageLoading(false); // Stop loading on critical error
    }
  }, []); // Empty dependency array - runs only once on component mount

  const getRecaptchaToken = async (action) => {
    if (typeof grecaptcha === 'undefined' || !grecaptcha.execute) {
      setErrorMessage("reCAPTCHA API nie je načítané alebo pripravené.");
      return null;
    }
    try {
      const token = await grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: action });
      return token;
    } catch (e) {
      console.error("Chyba pri získavaní reCAPTCHA tokenu:", e);
      setErrorMessage(`Chyba reCAPTCHA: ${e.message}`);
      return null;
    }
  };

  // ZMENA: validatePassword teraz vracia objekt so stavmi jednotlivých požiadaviek
  const validatePassword = (pwd) => {
    const status = {
      minLength: pwd.length >= 10,
      maxLength: pwd.length <= 4096, // Táto podmienka sa stále kontroluje
      hasUpperCase: /[A-Z]/.test(pwd),
      hasLowerCase: /[a-z]/.test(pwd),
      hasNumber: /[0-9]/.test(pwd),
    };
    // Celková platnosť závisí od všetkých podmienok vrátane maxLength
    status.isValid = status.minLength && status.maxLength && status.hasUpperCase && status.hasLowerCase && status.hasNumber;
    return status;
  };

  // Effect pre validáciu hesla pri zmene 'password' alebo 'confirmPassword'
  React.useEffect(() => {
    const pwdStatus = validatePassword(password);
    setPasswordValidationStatus(pwdStatus);

    setIsConfirmPasswordMatching(password === confirmPassword && password.length > 0 && pwdStatus.isValid);
  }, [password, confirmPassword]);


  const handleRegisterAdmin = async (e) => {
    e.preventDefault();
    if (!auth || !db) {
      setErrorMessage("Firebase Auth alebo Firestore nie je inicializovaný.");
      return;
    }
    if (!email || !password || !confirmPassword || !firstName || !lastName) {
      setErrorMessage("Vyplňte prosím všetky polia.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Heslá sa nezhodujú. Skontrolujte ich prosím.");
      return;
    }

    // ZMENA: Používame celkový stav platnosti z passwordValidationStatus
    if (!passwordValidationStatus.isValid) {
      setErrorMessage("Heslo nespĺňa všetky požiadavky. Skontrolujte prosím zoznam pod heslom.");
      return;
    }

    const recaptchaToken = await getRecaptchaToken('admin_register');
    if (!recaptchaToken) {
      setErrorMessage("Overenie reCAPTCHA zlyhalo. Skúste to prosím znova.");
      return; // Return here as there's an error
    }
    console.log("reCAPTCHA Token pre registráciu admina:", recaptchaToken);

    setFormSubmitting(true); // Show loading indicator for form submission
    setErrorMessage(''); // Clear previous errors
    setSuccessMessage(''); // Clear any previous success message


    try {
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      // Pridáme passwordLastChanged k updateProfile, aby sa zaznamenal čas zmeny hesla
      await userCredential.user.updateProfile({ 
          displayName: `${firstName} ${lastName}`,
      });

      // ZMENA: Nastavenie role na 'admin' a approved na 'false' priamo pri prvom zápise
      const userDataToSave = {
        uid: userCredential.user.uid,
        email: email,
        firstName: firstName,
        lastName: lastName,
        contactPhoneNumber: contactPhoneNumber, // Will be empty for admin register, but kept for schema consistency
        displayName: `${firstName} ${lastName}`,
        role: 'admin', // Priamo nastavené ako admin
        approved: false, // Priamo nastavené ako neschválený admin
        registrationDate: firebase.firestore.FieldValue.serverTimestamp(),
        displayNotifications: true,
        passwordLastChanged: firebase.firestore.FieldValue.serverTimestamp() // Pridané pre sledovanie zmeny hesla
      };

      console.log("Pokus o uloženie používateľa do Firestore s počiatočnými dátami:", userDataToSave);

      try {
        await db.collection('users').doc(userCredential.user.uid).set(userDataToSave);
        console.log(`Firestore: Používateľ ${email} s rolou 'admin' a schválením 'false' bol uložený.`);

        // Attempt to send email via Apps Script immediately after saving initial data
        try {
          const payload = {
            action: 'sendRegistrationEmail',
            email: email,
            isAdmin: true, // This is an admin registration
            firstName: firstName,
            lastName: lastName,
            contactPhoneNumber: contactPhoneNumber
          };
          console.log("Odosielanie dát do Apps Script (registračný e-mail admina):", payload);
          
          // ZMENA: Pridanie mode: 'no-cors'
          const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            mode: 'no-cors', // Dôležité pre Apps Script, aby sa predišlo CORS chybám
            body: JSON.stringify(payload)
          });

          // Pri mode: 'no-cors', response.ok bude vždy false a response.status bude 0.
          // Preto musíme predpokladať úspech, ak nedôjde k chybe siete.
          // Ak potrebujete overenie úspechu, je lepšie použiť CORS a správne nastaviť Apps Script.
          console.log("Odpoveď z Apps Script (registračný e-mail admina) s no-cors:", response);

        } catch (emailError) {
          console.error("Chyba pri odosielaní registračného e-mailu admina cez Apps Script (chyba fetch):", emailError);
          // ZMENA: Nastavíme errorMessage pre túto sekundárnu chybu
          setErrorMessage(`Registrácia úspešná, ale nepodarilo sa odoslať e-mail s potvrdením: ${emailError.message}. Skontrolujte pripojenie a Apps Script.`);
        }

        // --- Logika pre ukladanie notifikácie pre administrátorov ---
        try {
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
            const notificationMessage = `Nový administrátor ${email} sa zaregistroval a čaká na schválenie.`;
            const notificationRecipientId = 'all_admins'; 

            await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('adminNotifications').add({
                message: notificationMessage,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                recipientId: notificationRecipientId,
                read: false
            });
            console.log("Notifikácia o novej registrácii administrátora úspešne uložená do Firestore.");
        } catch (e) {
            console.error("App: Chyba pri ukladaní notifikácie o registrácii administrátora:", e);
        }
        // --- Koniec logiky pre ukladanie notifikácie ---

      } catch (firestoreError) {
        console.error("Chyba pri ukladaní/aktualizácii Firestore:", firestoreError);
        setErrorMessage(`Chyba pri ukladaní/aktualizácii používateľa do databázy: ${firestoreError.message}. Skontrolujte bezpečnostné pravidlá Firebase.`);
        setFormSubmitting(false); // Reset formSubmitting on error
        return;
      }

      // ZMENA: Nastavíme successMessage až po všetkých úspešných krokoch
      setSuccessMessage(`Administrátorský účet pre ${email} sa registruje. Na vašu e-mailovú adresu sme poslali potvrdenie o registrácii. Pre plnú aktiváciu počkajte prosím na schválenie od iného administrátora.`);
      setFormSubmitting(false); // Stop loading so the message is visible on the form

      // Now sign out and redirect after a delay
      await auth.signOut();
      setUser(null); // Explicitne set user to null after logout

      // Redirect after 5 seconds
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 5000);

    } catch (e) {
      console.error("Chyba pri registrácii (Auth alebo iné):", e);
      if (e.code === 'auth/email-already-in-use') {
        setErrorMessage("E-mailová adresa už existuje. Vyberte prosím inú.");
      } else if (e.code === 'auth/weak-password') {
        setErrorMessage("Heslo je príliš slabé. " + e.message); // Použijeme správu z Firebase Auth
      } else if (e.code === 'auth/invalid-email') {
        setErrorMessage("Neplatný formát e-mailovej adresy.");
      } else {
        setErrorMessage(`Chyba pri registrácii: ${e.message}`);
      }
      setFormSubmitting(false); // Reset formSubmitting on error
    }
  };

  // Display initial page loading state
  if (pageLoading) {
    return React.createElement(
      'div',
      { className: 'flex items-center justify-center min-h-screen bg-gray-100' },
      React.createElement('div', { className: 'text-xl font-semibold text-gray-700' }, 'Načítavam...')
    );
  }

  // Priority display of successful registration message (zelená stránka)
  // ZMENA: Kontrolujeme 'successMessage' namiesto 'message' a 'notificationType'
  if (successMessage) { 
    return React.createElement(
      'div',
      { className: 'min-h-screen bg-gray-100 flex flex-col items-center justify-center font-inter overflow-y-auto' },
      React.createElement(
        'div',
        { className: 'w-full max-w-md mt-20 mb-10 p-4' },
        React.createElement(
          'div',
          { className: 'bg-green-700 text-white p-8 rounded-lg shadow-xl w-full text-center' }, // Zmenené pozadie na tmavšiu zelenú (green-700)
          React.createElement('h1', { className: 'text-3xl font-bold text-black mb-4' }, 'Registrácia úspešná!'), // Zmenená farba textu nadpisu na čiernu
          React.createElement(
            'p',
            { className: 'text-white' }, // Text zostáva biely pre kontrast
            successMessage
          ),
          React.createElement('p', { className: 'text-gray-200 text-sm mt-4' }, 'Presmerovanie na prihlasovaciu stránku...')
        )
      )
    );
  }

  // Dynamické triedy pre tlačidlo na základe stavu disabled
  const buttonClasses = `
    font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200
    ${formSubmitting || successMessage || !passwordValidationStatus.isValid || !isConfirmPasswordMatching
      ? 'bg-white text-green-500 border border-green-500 cursor-not-allowed' // Zakázaný stav
      : 'bg-green-500 hover:bg-green-700 text-white' // Aktívny stav
    }
  `;

  // Display registration form
  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
    // Notifikačné okno sa zobrazí LEN pre chyby (errorMessage)
    errorMessage && React.createElement(NotificationModal, {
        message: errorMessage, // Používame errorMessage pre modálne okno
        onClose: () => setErrorMessage(''), // Vymažeme errorMessage pri zatvorení modálu
        type: 'error' // Typ je vždy 'error' pre túto notifikáciu
    }),
    React.createElement(
      'div',
      { className: 'w-full max-w-md mt-20 mb-10 p-4' },
      React.createElement(
        'div',
        { className: 'bg-white p-8 rounded-lg shadow-xl w-full' },
        // Červený alert box pre chyby (nad formulárom)
        errorMessage && React.createElement(
          'div',
          { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap', role: 'alert' },
          errorMessage
        ),
        React.createElement('h1', { className: 'text-3xl font-bold text-center text-gray-800 mb-6' }, 'Registrácia administrátora'),
        React.createElement(
          'form',
          { onSubmit: handleRegisterAdmin, className: 'space-y-4' },
          React.createElement(
            'div',
            null,
            React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'reg-first-name' }, 'Meno'),
            React.createElement('input', {
              type: 'text',
              id: 'reg-first-name',
              className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
              value: firstName,
              onChange: (e) => setFirstName(e.target.value),
              required: true,
              placeholder: 'Zadajte svoje meno',
              autoComplete: 'given-name',
              disabled: formSubmitting || successMessage, // Zakázať, ak sa formulár odosiela alebo je zobrazená správa o úspechu
            })
          ),
          React.createElement(
            'div',
            null,
            React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'reg-last-name' }, 'Priezvisko'),
            React.createElement('input', {
              type: 'text',
              id: 'reg-last-name',
              className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
              value: lastName,
              onChange: (e) => setLastName(e.target.value),
              required: true,
              placeholder: 'Zadajte svoje priezvisko',
              autoComplete: 'family-name',
              disabled: formSubmitting || successMessage, // Zakázať, ak sa formulár odosiela alebo je zobrazená správa o úspechu
            })
          ),
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
              disabled: formSubmitting || successMessage, // Zakázať, ak sa formulár odosiela alebo je zobrazená správa o úspechu
            })
          ),
          React.createElement(PasswordInput, {
            id: 'reg-password',
            label: 'Heslo',
            value: password,
            onChange: (e) => setPassword(e.target.value),
            onCopy: (e) => e.preventDefault(),
            onPaste: (e) => e.preventDefault(),
            onCut: (e) => e.preventDefault(),
            placeholder: 'Zvoľte si heslo',
            autoComplete: 'new-password',
            showPassword: showPasswordReg,
            toggleShowPassword: () => setShowPasswordReg(!showPasswordReg),
            disabled: formSubmitting || successMessage, // Zakázať, ak sa formulár odosiela alebo je zobrazená správa o úspechu
            validationStatus: passwordValidationStatus // Odovzdanie detailného stavu validácie hesla
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
            disabled: formSubmitting || successMessage, // Zakázať, ak sa formulár odosiela alebo je zobrazená správa o úspechu
          }),
          React.createElement(
            'button',
            {
              type: 'submit',
              className: buttonClasses, // Použitie dynamických tried
              disabled: formSubmitting || successMessage || !passwordValidationStatus.isValid || !isConfirmPasswordMatching, // Zakázať, ak heslo nie je platné alebo sa nezhoduje
            },
            formSubmitting ? ( // Use formSubmitting
              React.createElement(
                'div',
                { className: 'flex items-center justify-center' },
                React.createElement('svg', { className: 'animate-spin -ml-1 mr-3 h-5 w-5 text-green-500', xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24' }, // Farba spinneru zmenená na zelenú
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
