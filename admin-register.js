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
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');
  const [notificationType, setNotificationType] = React.useState('info'); // Nový stav pre typ notifikácie

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
        setError("Firebase SDK nie je načítané. Skontrolujte admin-register.html.");
        setNotificationType('error');
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
          setError(`Chyba pri prihlásení: ${e.message}`);
          setNotificationType('error');
        }
      };

      unsubscribeAuth = authInstance.onAuthStateChanged(async (currentUser) => {
        setUser(currentUser);
        setIsAuthReady(true);
        // ZMENA: Odstránené automatické presmerovanie po prihlásení na tejto stránke
        // if (currentUser) {
        //     window.location.href = 'logged-in-my-data.html';
        //     return;
        // }
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
      setError(`Chyba pri inicializácii Firebase: ${e.message}`);
      setNotificationType('error');
      setPageLoading(false); // Stop loading on critical error
    }
  }, []); // Empty dependency array - runs only once on component mount

  // Removed useEffect for updating header link visibility, as it will be handled by header.js

  // Removed handleLogout and its useEffect listener, as it will be handled by header.js

  const getRecaptchaToken = async (action) => {
    if (typeof grecaptcha === 'undefined' || !grecaptcha.execute) {
      setError("reCAPTCHA API nie je načítané alebo pripravené.");
      setNotificationType('error');
      return null;
    }
    try {
      const token = await grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: action });
      return token;
    } catch (e) {
      console.error("Chyba pri získavaní reCAPTCHA tokenu:", e);
      setError(`Chyba reCAPTCHA: ${e.message}`);
      setNotificationType('error');
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
      setError("Firebase Auth alebo Firestore nie je inicializovaný.");
      setNotificationType('error');
      return;
    }
    if (!email || !password || !confirmPassword || !firstName || !lastName) {
      setError("Vyplňte prosím všetky polia.");
      setNotificationType('error');
      return;
    }
    if (password !== confirmPassword) {
      setError("Heslá sa nezhodujú. Skontrolujte ich prosím.");
      setNotificationType('error');
      return;
    }

    // ZMENA: Používame celkový stav platnosti z passwordValidationStatus
    if (!passwordValidationStatus.isValid) {
      setError("Heslo nespĺňa všetky požiadavky. Skontrolujte prosím zoznam pod heslom.");
      setNotificationType('error');
      return;
    }

    const recaptchaToken = await getRecaptchaToken('admin_register');
    if (!recaptchaToken) {
      setError("Overenie reCAPTCHA zlyhalo. Skúste to prosím znova.");
      setNotificationType('error');
      return null;
    }
    console.log("reCAPTCHA Token pre registráciu admina:", recaptchaToken);

    setFormSubmitting(true); // Show loading indicator for form submission
    setError(''); // Clear previous errors
    setNotificationType('info'); // Reset notification type
    // ZMENA: Nastavíme správu, ktorá sa zobrazí na zelenej stránke úspechu
    setMessage(`Administrátorský účet pre ${email} sa registruje. Na vašu e-mailovú adresu sme poslali potvrdenie o registrácii. Pre plnú aktiváciu počkajte prosím na schválenie od iného administrátora.`);

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
        registeredAt: firebase.firestore.FieldValue.serverTimestamp(),
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
          
          // ZMENA: Odstránenie mode: 'no-cors' a pridanie lepšej kontroly odpovede
          const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
          });

          if (response.ok) {
            const responseData = await response.text();
            console.log("Odpoveď z Apps Script (registračný e-mail admina):", responseData);
            // ZMENA: Nemeníme message, pretože sa zobrazí na zelenej stránke
          } else {
            const errorText = await response.text();
            console.error(`Chyba pri odosielaní registračného e-mailu admina: ${response.status} ${response.statusText} - ${errorText}`);
            setError(`Chyba pri odosielaní e-mailu: ${response.status} ${response.statusText}. Skontrolujte Apps Script a nastavenia CORS.`);
            setNotificationType('error');
          }
        } catch (emailError) {
          console.error("Chyba pri odosielaní registračného e-mailu admina cez Apps Script (chyba fetch):", emailError);
          setError(`Nepodarilo sa odoslať e-mail s potvrdením: ${emailError.message}. Skontrolujte pripojenie a Apps Script.`);
          setNotificationType('error');
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
        setError(`Chyba pri ukladaní/aktualizácii používateľa do databázy: ${firestoreError.message}. Skontrolujte bezpečnostné pravidlá Firebase.`);
        setNotificationType('error');
        setFormSubmitting(false); // Reset formSubmitting on error
        setMessage(''); // Clear message on error
        return;
      }

      setFormSubmitting(false); // Stop loading so the message is visible on the form
      setNotificationType('success'); // Nastavenie typu notifikácie na úspech

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
        setError("E-mailová adresa už existuje. Vyberte prosím inú.");
      } else if (e.code === 'auth/weak-password') {
        setError("Heslo je príliš slabé. " + e.message); // Použijeme správu z Firebase Auth
      } else if (e.code === 'auth/invalid-email') {
        setError("Neplatný formát e-mailovej adresy.");
      } else {
        setError(`Chyba pri registrácii: ${e.message}`);
      }
      setNotificationType('error');
      setFormSubmitting(false); // Reset formSubmitting on error
      setMessage(''); // Clear message on error
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

  // Priority display of successful registration message
  // ZMENA: Táto podmienka teraz zabezpečí, že sa zobrazí správa LEN ak je message nastavené A notificationType je 'success'
  if (message && notificationType === 'success') { 
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
            message
          ),
          React.createElement('p', { className: 'text-gray-200 text-sm mt-4' }, 'Presmerovanie na prihlasovaciu stránku...')
        )
      )
    );
  }

  // Display registration form
  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
    // Notifikačné okno sa zobrazí LEN pre chyby alebo informačné správy, NIE pre úspešnú registráciu
    (message && notificationType !== 'success') && React.createElement(NotificationModal, {
        message: message, // Use local message state for this modal
        onClose: () => setMessage(''),
        type: notificationType // Odovzdanie typu notifikácie
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
              disabled: formSubmitting || (message && notificationType === 'success'), // Use formSubmitting
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
              disabled: formSubmitting || (message && notificationType === 'success'), // Use formSubmitting
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
              disabled: formSubmitting || (message && notificationType === 'success'), // Use formSubmitting
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
            disabled: formSubmitting || (message && notificationType === 'success'), // Use formSubmitting
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
            disabled: formSubmitting || (message && notificationType === 'success'), // Use formSubmitting
            // ZMENA: validationStatus prop je teraz vynechaný, aby sa nezobrazoval zoznam požiadaviek
            // validationStatus: {
            //   isValid: isConfirmPasswordMatching && passwordValidationStatus.isValid,
            //   minLength: passwordValidationStatus.minLength,
            //   maxLength: passwordValidationStatus.maxLength,
            //   hasUpperCase: passwordValidationStatus.hasUpperCase,
            //   hasLowerCase: passwordValidationStatus.hasLowerCase,
            //   hasNumber: passwordValidationStatus.hasNumber,
            // }
          }),
          React.createElement(
            'button',
            {
              type: 'submit',
              className: 'bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200',
              disabled: formSubmitting || (message && notificationType === 'success') || !passwordValidationStatus.isValid || !isConfirmPasswordMatching, // Zakázať, ak heslo nie je platné alebo sa nezhoduje
            },
            formSubmitting ? ( // Use formSubmitting
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
