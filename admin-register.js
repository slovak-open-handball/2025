const appId = '1:26454452024:web:6954b4f90f87a3a1eb43cd';
const firebaseConfig = {
  apiKey: "AIzaSyDj_bSTkjrquu1nyIVYW7YLbyBl1pD6YYo",
  authDomain: "prihlasovanie-4f3f3.firebaseapp.com",
  projectId: "prihlasovanie-4f3f3",
  storageBucket: "prihlasovanie-4f3f3.firebasestorage.app",
  messagingSenderId: "26454452024",
  appId: "1:26454452024:web:6954b4f90f87a3a1eb43cd"
};
const initialAuthToken = null;

const RECAPTCHA_SITE_KEY = "6LdJbn8rAAAAAO4C50qXTWva6ePzDlOfYwBDEDwa";
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec";

function PasswordInput({ id, label, value, onChange, placeholder, autoComplete, showPassword, toggleShowPassword, onCopy, onPaste, onCut, disabled, validationStatus }) {
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

  const borderClass = 'border-gray-300';

  return React.createElement(
    'div',
    { className: 'mb-4' },
    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: id }, label),
    React.createElement(
      'div',
      { className: 'relative' },
      React.createElement('input', {
        type: showPassword ? 'text' : 'password',
        id: id,
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
    validationStatus && React.createElement(
      'div',
      { className: `text-xs italic mt-1 text-gray-600` }, 
      'Heslo musí obsahovať:',
      React.createElement(
        'ul',
        { className: 'list-none pl-4' },
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
    bgColorClass = 'bg-green-500';
  } else if (type === 'error') {
    bgColorClass = 'bg-red-600'; 
  } else {
    bgColorClass = 'bg-blue-500'; 
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

function App() {
  const [app, setApp] = React.useState(null);
  const [auth, setAuth] = React.useState(null);
  const [db, setDb] = React.useState(null);
  const [user, setUser] = React.useState(null);
  const [isAuthReady, setIsAuthReady] = React.useState(false);
  const [pageLoading, setPageLoading] = React.useState(true); 
  const [formSubmitting, setFormSubmitting] = React.useState(false); 
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');
  const [notificationType, setNotificationType] = React.useState('info');

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [contactPhoneNumber, setContactPhoneNumber] = React.useState(''); 

  const [showPasswordReg, setShowPasswordReg] = React.useState(false);
  const [showConfirmPasswordReg, setShowConfirmPasswordReg] = React.useState(false);

  const [passwordValidationStatus, setPasswordValidationStatus] = React.useState({
    minLength: false,
    maxLength: false,
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
    isValid: false, 
  });
  const [isConfirmPasswordMatching, setIsConfirmPasswordMatching] = React.useState(false);


  React.useEffect(() => {
    let unsubscribeAuth;
    let firestoreInstance;

    try {
      if (typeof firebase === 'undefined') {
        setError("Firebase SDK nie je načítané. Skontrolujte admin-register.html.");
        setNotificationType('error');
        setPageLoading(false);
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
        setPageLoading(false);
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
      setPageLoading(false);
    }
  }, []); 
  
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

  const validatePassword = (pwd) => {
    const status = {
      minLength: pwd.length >= 10,
      maxLength: pwd.length <= 4096, 
      hasUpperCase: /[A-Z]/.test(pwd),
      hasLowerCase: /[a-z]/.test(pwd),
      hasNumber: /[0-9]/.test(pwd),
    };
    status.isValid = status.minLength && status.maxLength && status.hasUpperCase && status.hasLowerCase && status.hasNumber;
    return status;
  };

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

    setFormSubmitting(true);
    setError('');
    setNotificationType('info');
    setMessage(`Administrátorský účet pre ${email} sa registruje. Na vašu e-mailovú adresu sme poslali potvrdenie o registrácii. Pre plnú aktiváciu počkajte prosím na schválenie od iného administrátora.`);

    try {
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      await userCredential.user.updateProfile({ 
          displayName: `${firstName} ${lastName}`,
      });

      const userDataToSave = {
        uid: userCredential.user.uid,
        email: email,
        firstName: firstName,
        lastName: lastName,
        contactPhoneNumber: contactPhoneNumber,
        displayName: `${firstName} ${lastName}`,
        role: 'admin',
        approved: false,
        registeredAt: firebase.firestore.FieldValue.serverTimestamp(),
        displayNotifications: true,
        passwordLastChanged: firebase.firestore.FieldValue.serverTimestamp() 
      };

      console.log("Pokus o uloženie používateľa do Firestore s počiatočnými dátami:", userDataToSave);

      try {
        await db.collection('users').doc(userCredential.user.uid).set(userDataToSave);
        console.log(`Firestore: Používateľ ${email} s rolou 'admin' a schválením 'false' bol uložený.`);

        try {
          const payload = {
            action: 'sendRegistrationEmail',
            email: email,
            isAdmin: true, 
            firstName: firstName,
            lastName: lastName,
            contactPhoneNumber: contactPhoneNumber
          };
          console.log("Odosielanie dát do Apps Script (registračný e-mail admina):", payload);
          const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
          });
          console.log("Požiadavka na odoslanie registračného e-mailu admina odoslaná.");
          try {
            const responseData = await response.text();
            console.log("Odpoveď z Apps Script (fetch - registračný e-mail admina) ako text:", responseData);
          } catch (jsonError) {
            console.warn("Nepodarilo sa analyzovať odpoveď z Apps Script (očakávané s 'no-cors' pre JSON):", jsonError);
          }
        } catch (emailError) {
          console.error("Chyba pri odosielaní registračného e-mailu admina cez Apps Script (chyba fetch):", emailError);
        }

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

      } catch (firestoreError) {
        console.error("Chyba pri ukladaní/aktualizácii Firestore:", firestoreError);
        setError(`Chyba pri ukladaní/aktualizácii používateľa do databázy: ${firestoreError.message}. Skontrolujte bezpečnostné pravidlá Firebase.`);
        setNotificationType('error');
        setFormSubmitting(false);
        setMessage('');
        return;
      }

      setFormSubmitting(false);
      setNotificationType('success');

      await auth.signOut();
      setUser(null); 

      setTimeout(() => {
        window.location.href = 'login.html';
      }, 5000);

    } catch (e) {
      console.error("Chyba pri registrácii (Auth alebo iné):", e);
      if (e.code === 'auth/email-already-in-use') {
        setError("E-mailová adresa už existuje. Vyberte prosím inú.");
      } else if (e.code === 'auth/weak-password') {
        setError("Heslo je príliš slabé. " + e.message);
      } else if (e.code === 'auth/invalid-email') {
        setError("Neplatný formát e-mailovej adresy.");
      } else {
        setError(`Chyba pri registrácii: ${e.message}`);
      }
      setNotificationType('error');
      setFormSubmitting(false);
      setMessage('');
    }
  };

  if (pageLoading) {
    return React.createElement(
      'div',
      { className: 'flex items-center justify-center min-h-screen bg-gray-100' },
      React.createElement('div', { className: 'text-xl font-semibold text-gray-700' }, 'Načítavam...')
    );
  }

  if (message && notificationType === 'success') {
    return React.createElement(
      'div',
      { className: 'min-h-screen bg-gray-100 flex flex-col items-center justify-center font-inter overflow-y-auto' },
      React.createElement(
        'div',
        { className: 'w-full max-w-md mt-20 mb-10 p-4' },
        React.createElement(
          'div',
          { className: 'bg-green-700 text-white p-8 rounded-lg shadow-xl w-full text-center' },
          React.createElement('h1', { className: 'text-3xl font-bold text-black mb-4' }, 'Registrácia úspešná!'),
          React.createElement(
            'p',
            { className: 'text-white' },
            message
          ),
          React.createElement('p', { className: 'text-gray-200 text-sm mt-4' }, 'Presmerovanie na prihlasovaciu stránku...')
        )
      )
    );
  }

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
    (message && notificationType !== 'success') && React.createElement(NotificationModal, {
        message: message,
        onClose: () => setMessage(''),
        type: notificationType
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
              placeholder: 'Zadajte meno',
              autoComplete: 'given-name',
              disabled: formSubmitting || (message && notificationType === 'success'),
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
              placeholder: 'Zadajte priezvisko',
              autoComplete: 'family-name',
              disabled: formSubmitting || (message && notificationType === 'success'),
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
              placeholder: 'Zadajte e-mailovú adresu',
              autoComplete: 'email',
              disabled: formSubmitting || (message && notificationType === 'success'),
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
            disabled: formSubmitting || (message && notificationType === 'success'),
            validationStatus: passwordValidationStatus
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
            disabled: formSubmitting || (message && notificationType === 'success'),
          }),
          React.createElement(
            'button',
            {
              type: 'submit',
              className: 'bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200',
              disabled: formSubmitting || (message && notificationType === 'success') || !passwordValidationStatus.isValid || !isConfirmPasswordMatching,
            },
            formSubmitting ? (
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
