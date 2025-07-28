// login.js
// Tento súbor predpokladá, že firebaseConfig, initialAuthToken a appId
// sú globálne definované v <head> login.html.

const RECAPTCHA_SITE_KEY = "6LdJbn8rAAAAAO4C50qXTWva6ePzDlOfYwBDEDwa";
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec";

// PasswordInput Component for password fields with visibility toggle (converted to React.createElement)
function PasswordInput({ id, label, value, onChange, placeholder, autoComplete, showPassword, toggleShowPassword, onCopy, onPaste, onCut, disabled, description, tabIndex }) {
  // SVG ikony pre oko (zobraziť heslo) a preškrtnuté oko (skryť heslo) - ZJEDNOTENÉ S ADMIN-REGISTER.JS
  const EyeIcon = React.createElement(
    'svg',
    { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' }),
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' })
  );

  const EyeOffIcon = React.createElement(
    'svg',
    { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
    // Cesta pre vyplnený stred (pupila)
    React.createElement('path', { fill: 'currentColor', stroke: 'none', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' }),
    // Cesta pre vonkajší obrys oka (bez výplne)
    React.createElement('path', { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' }),
    // Cesta pre šikmú čiaru
    React.createElement('line', { x1: '21', y1: '3', x2: '3', y2: '21', stroke: 'currentColor', strokeWidth: '2' })
  );

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
        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10',
        value: value,
        onChange: onChange,
        onCopy: onCopy,
        onPaste: onPaste,
        onCut: onCut,
        required: true,
        placeholder: placeholder,
        autoComplete: autoComplete,
        disabled: disabled,
        tabIndex: tabIndex,
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

// ResetPasswordModal Component
function ResetPasswordModal({ show, onClose, onSendResetEmail, loading, message, error }) {
  const [email, setEmail] = React.useState('');

  if (!show) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSendResetEmail(email);
  };

  return React.createElement(
    'div',
    { className: 'modal' }, // Používame už definované .modal štýly
    React.createElement(
      'div',
      { className: 'modal-content' }, // Používame už definované .modal-content štýly
      React.createElement('h2', { className: 'text-xl font-bold mb-4 text-gray-800' }, 'Resetovať heslo'),
      error && React.createElement(
        'div',
        { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4', role: 'alert' },
        error
      ),
      message && React.createElement( // Zelené okno s úspešnou správou
        'div',
        { className: 'bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4', role: 'alert' },
        message
      ),
      // Podmienené zobrazenie formulára a tlačidiel
      !message && React.createElement( // Skryť, ak je zobrazená úspešná správa
        'form',
        { onSubmit: handleSubmit },
        React.createElement(
          'div',
          { className: 'mb-4' },
          React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'reset-email' }, 'E-mailová adresa'),
          React.createElement('input', {
            type: 'email',
            id: 'reset-email',
            className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
            value: email,
            onChange: (e) => setEmail(e.target.value),
            required: true,
            placeholder: 'Zadajte svoju e-mailovú adresu',
            disabled: loading,
          })
        ),
        React.createElement(
          'div',
          { className: 'flex justify-end space-x-4' },
          React.createElement(
            'button',
            {
              type: 'button',
              onClick: onClose,
              className: 'bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded-lg transition-colors duration-200',
              disabled: loading,
            },
            'Zrušiť'
          ),
          React.createElement(
            'button',
            {
              type: 'submit',
              className: 'bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200',
              disabled: loading || !email,
            },
            loading ? React.createElement('svg', { className: 'animate-spin h-5 w-5 text-white inline mr-2', xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24' },
                        React.createElement('circle', { className: 'opacity-25', cx: '12', cy: '12', r: '10', stroke: 'currentColor', strokeWidth: '4' }),
                        React.createElement('path', { className: 'opacity-75', fill: 'currentColor', d: 'M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z' })
                      ) : null,
            loading ? 'Odosielam...' : 'Odoslať'
          )
        )
      )
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
  const minutes = (date.getMinutes()).toString().padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};


// Main React component for the login.html page
function App() {
  const [app, setApp] = React.useState(null);
  const [auth, setAuth] = React.useState(null);
  const [db, setDb] = React.useState(null);
  const [user, setUser] = React.useState(undefined);
  const [isAuthReady, setIsAuthReady] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [userNotificationMessage, setUserNotificationMessage] = React.useState('');

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPasswordLogin, setShowPasswordLogin] = React.useState(false);

  // States for date and time settings (pridané pre kontrolu registrácie)
  const [registrationStartDate, setRegistrationStartDate] = React.useState('');
  const [registrationEndDate, setRegistrationEndDate] = React.useState('');
  const [settingsLoaded, setSettingsLoaded] = React.useState(false);

  // Nové stavy pre reset hesla
  const [showResetPasswordModal, setShowResetPasswordModal] = React.useState(false);
  const [resetPasswordMessage, setResetPasswordMessage] = React.useState('');
  const [resetPasswordError, setResetPasswordError] = React.useState('');
  const [resetPasswordLoading, setResetPasswordLoading] = React.useState(false);


  // Calculate registration status as a memoized value (pridané pre kontrolu registrácie)
  const isRegistrationOpen = React.useMemo(() => {
    if (!settingsLoaded) return false;
    const now = new Date();
    const regStart = registrationStartDate ? new Date(registrationStartDate) : null;
    const regEnd = registrationEndDate ? new Date(registrationEndDate) : null;

    const isRegStartValid = regStart instanceof Date && !isNaN(regStart);
    const isRegEndValid = regEnd instanceof Date && !isNaN(regEnd);

    return (
      (isRegStartValid ? now >= regStart : true) &&
      (isRegEndValid ? now <= regEnd : true)
    );
  }, [settingsLoaded, registrationStartDate, registrationEndDate]);


  // Effect for Firebase initialization and Auth Listener setup (runs only once)
  React.useEffect(() => {
    let unsubscribeAuth;
    let firestoreInstance; // Deklarácia tu, aby bola dostupná v callbacku

    try {
      if (typeof firebase === 'undefined') {
        setError("Firebase SDK nie je načítané. Skontrolujte login.html.");
        return;
      }

      const firebaseApp = firebase.app(); // Používame už inicializovanú app
      setApp(firebaseApp);

      const authInstance = firebase.auth(firebaseApp);
      setAuth(authInstance);
      firestoreInstance = firebase.firestore(firebaseApp); // Priradenie tu
      setDb(firestoreInstance); // Nastavenie do stavu

      const signIn = async () => {
        try {
          // initialAuthToken je definovaný v login.html, ale pre login stránku ho nepoužívame na automatické prihlásenie
          // Používateľ sa prihlasuje explicitne cez formulár.
        } catch (e) {
          console.error("Chyba pri počiatočnom prihlásení Firebase:", e);
        }
      };

      unsubscribeAuth = authInstance.onAuthStateChanged(async (currentUser) => {
        console.log("LoginApp: onAuthStateChanged volaný. currentUser:", currentUser ? currentUser.uid : "null");
        setUser(currentUser);
        setIsAuthReady(true);
        
        if (currentUser) {
            // Používame firestoreInstance, ktorá je zaručene inicializovaná v tomto scope
            if (!firestoreInstance) { 
                console.error("LoginApp: Firestore inštancia nie je dostupná v onAuthStateChanged.");
                setError("Chyba pri inicializácii databázy. Skúste to prosím znova.");
                await authInstance.signOut();
                return;
            }
            try {
                const userDocRef = firestoreInstance.collection('users').doc(currentUser.uid);
                const userDoc = await userDocRef.get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    const firestorePasswordChangedTime = userData.passwordLastChanged ? userData.passwordLastChanged.toDate().getTime() : 0;
                    const localStorageKey = `passwordLastChanged_${currentUser.uid}`;
                    let storedPasswordChangedTime = parseInt(localStorage.getItem(localStorageKey) || '0', 10);

                    // Kontrola zmeny hesla na inom zariadení/relácii
                    if (firestorePasswordChangedTime > storedPasswordChangedTime) {
                        console.warn("LoginApp: Detekovaná zmena hesla na inom zariadení/relácii. Odhlasujem používateľa.");
                        await authInstance.signOut();
                        localStorage.removeItem(localStorageKey);
                        setUserNotificationMessage("Vaše heslo bolo zmenené na inom zariadení. Prihláste sa prosím znova.");
                        return;
                    } else if (firestorePasswordChangedTime === 0 && storedPasswordChangedTime === 0) {
                        // Ak passwordLastChanged nebolo nikdy nastavené, nastavíme ho teraz
                        await userDocRef.update({ passwordLastChanged: firebase.firestore.FieldValue.serverTimestamp() });
                        const newTimestamp = (await userDocRef.get()).data().passwordLastChanged.toDate().getTime();
                        localStorage.setItem(localStorageKey, newTimestamp.toString());
                        console.log("LoginApp: passwordLastChanged inicializovaný vo Firestore a localStorage.");
                    } else if (firestorePasswordChangedTime > 0 && storedPasswordChangedTime === 0) {
                        // Ak Firestore má timestamp, ale localStorage nie (napr. prvé prihlásenie po implementácii)
                        localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
                        console.log("LoginApp: passwordLastChanged synchronizovaný z Firestore do localStorage.");
                    } else {
                        // Timestamps match, alebo localStorage je novší, aktualizujeme localStorage pre istotu
                        localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
                    }

                    // Ak je používateľ prihlásený a všetky kontroly prejdú, presmerujeme ho
                    // Toto sa vykoná len ak užívateľ NIE JE na login.html (aby sa predišlo nekonečnému presmerovaniu)
                    if (window.location.pathname.includes('login.html')) {
                        console.log("LoginApp: Používateľ je prihlásený, ale je na login.html. Presmerovávam na logged-in-my-data.html");
                        window.location.href = 'logged-in-my-data.html';
                    }
                } else {
                    console.warn("LoginApp: Používateľský dokument sa nenašiel pre UID:", currentUser.uid, ". Odhlasujem.");
                    await authInstance.signOut(); // Odhlásiť, ak chýba dokument používateľa
                    setUserNotificationMessage("Váš používateľský profil sa nenašiel. Prihláste sa prosím znova.");
                }
            } catch (profileError) {
                console.error("LoginApp: Chyba pri načítaní používateľského profilu alebo kontrole hesla:", profileError);
                await authInstance.signOut(); // Odhlásiť pri akejkoľvek chybe profilu
                setUserNotificationMessage("Chyba pri overovaní profilu. Prihláste sa prosím znova.");
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
      console.error("Nepodarilo sa inicializovať Firebase:", e);
      setError(`Chyba pri inicializácii Firebase: ${e.message}`);
    }
  }, []);

  // Effect for loading settings (pridané pre kontrolu registrácie)
  React.useEffect(() => {
    const fetchSettings = async () => {
      if (!db || !isAuthReady) {
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
          }, error => {
            console.error("Chyba pri načítaní nastavení registrácie (onSnapshot):", error);
            setError(`Chyba pri načítaní nastavení: ${error.message}`);
            // Removed setShowNotification(true); and setNotificationType('error'); as NotificationModal is handled differently
            setSettingsLoaded(true);
          });

          return () => unsubscribeSettings();
      } catch (e) {
          console.error("Chyba pri nastavovaní onSnapshot pre nastavenia registrácie:", e);
          setError(`Chyba pri nastavovaní poslucháča pre nastavenia: ${e.message}`);
          // Removed setShowNotification(true); and setNotificationType('error'); as NotificationModal is handled differently
          setSettingsLoaded(true);
      }
    };

    fetchSettings();
  }, [db, isAuthReady]);

  // useEffect for updating header link visibility
  React.useEffect(() => {
    console.log(`LoginApp: useEffect pre aktualizáciu odkazov hlavičky. User: ${user ? user.uid : 'null'}, isRegistrationOpen: ${isRegistrationOpen}`);
    const authLink = document.getElementById('auth-link');
    const profileLink = document.getElementById('profile-link');
    const logoutButton = document.getElementById('logout-button');
    const registerLink = document.getElementById('register-link');

    if (authLink) {
      if (user) {
        authLink.classList.add('hidden');
        profileLink && profileLink.classList.remove('hidden');
        logoutButton && logoutButton.classList.remove('hidden');
        registerLink && registerLink.classList.add('hidden');
        console.log("LoginApp: Používateľ prihlásený. Skryté: Prihlásenie, Registrácia. Zobrazené: Moja zóna, Odhlásenie.");
      } else {
        authLink.classList.remove('hidden');
        profileLink && profileLink.classList.add('hidden');
        logoutButton && logoutButton.classList.add('hidden');
        if (isRegistrationOpen) {
          registerLink && registerLink.classList.remove('hidden');
          console.log("LoginApp: Používateľ odhlásený, registrácia otvorená. Zobrazené: Prihlásenie, Registrácia.");
        } else {
          registerLink && registerLink.classList.add('hidden');
          console.log("LoginApp: Používateľ odhlásený, registrácia zatvorená. Zobrazené: Prihlásenie. Skryté: Registrácia.");
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

    setLoading(true); 
    setError('');
    setUserNotificationMessage('');

    const recaptchaToken = await getRecaptchaToken('login');
    if (!recaptchaToken) {
      setError("Overenie reCAPTCHA zlyhalo. Skúste to prosím znova.");
      setLoading(false);
      return null;
    }
    console.log("reCAPTCHA Token pre prihlásenie:", recaptchaToken);

    try {
      const userCredential = await auth.signInWithEmailAndPassword(email, password);
      const currentUser = userCredential.user;

      const userDocRef = db.collection('users').doc(currentUser.uid);
      const userDoc = await userDocRef.get(); // Načítame dáta používateľa hneď po prihlásení

      if (!userDoc.exists) {
        setError("Účet sa nenašiel v databáze. Kontaktujte podporu.");
        await auth.signOut(); // Odhlásiť, ak chýba dokument používateľa
        setLoading(false);
        return;
      }
      const userData = userDoc.data();

      // NOVÁ KONTROLA: Ak je používateľ admin a nie je schválený
      if (userData.role === 'admin' && userData.approved === false) {
        setError("Pre plnú aktiváciu počkajte prosím na schválenie účtu iným administrátorom.");
        console.log("LoginApp: Používateľ je admin a nie je schválený. Odhlasujem.");
        
        // Pokus o odoslanie e-mailu adminovi o potrebe schválenia
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
            mode: 'no-cors', // Dôležité pre obchádzanie CORS, ak Apps Script neodpovedá s CORS hlavičkami
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
          });
          console.log("Požiadavka na odoslanie e-mailu s pripomienkou schválenia admina odoslaná.");
          // Vzhľadom na 'no-cors' mode, response.text() alebo .json() zlyhá.
          // Ak potrebujeme odpoveď, musíme nastaviť CORS na Apps Script.
          // Zatiaľ stačí, že požiadavka odíde.
        } catch (emailError) {
          console.error("Chyba pri odosielaní e-mailu s pripomienkou schválenia admina cez Apps Script (chyba fetch):", emailError);
        }

        await auth.signOut(); // Odhlásiť používateľa
        setLoading(false);
        return; // Zastav ďalšie spracovanie prihlásenia
      }

      // Ak používateľ nie je neschválený admin, pokračuj s prihlásením
      await userDocRef.update({
        passwordLastChanged: firebase.firestore.FieldValue.serverTimestamp()
      });
      console.log("Prihlásenie: Timestamp passwordLastChanged aktualizovaný vo Firestore.");
      
      const updatedUserDoc = await userDocRef.get(); 
      if (!updatedUserDoc.exists) {
        setError("Účet sa nenašiel v databáze po aktualizácii timestampu. Kontaktujte podporu.");
        await auth.signOut();
        setLoading(false);
        return;
      }
      const updatedUserData = updatedUserDoc.data();

      if (updatedUserData.passwordLastChanged && typeof updatedUserData.passwordLastChanged.toDate === 'function') {
        localStorage.setItem(`passwordLastChanged_${currentUser.uid}`, updatedUserData.passwordLastChanged.toDate().getTime().toString());
        console.log("Prihlásenie: localStorage passwordLastChanged aktualizovaný s presným Firestore timestampom.");
      } else {
        console.error("Prihlásenie: Nepodarilo sa získať platný passwordLastChanged z Firestore po aktualizácii.");
        await auth.signOut();
        window.location.href = 'login.html';
        return;
      }

      setUser(prevUser => ({
        ...prevUser,
        ...updatedUserData,
        displayName: updatedUserData.firstName && updatedUserData.lastName ? `${updatedUserData.firstName} ${updatedUserData.lastName}` : updatedUserData.email,
        displayNotifications: updatedUserData.displayNotifications !== undefined ? updatedUserData.displayNotifications : true
      }));

      setUserNotificationMessage("Prihlásenie úspešné! Presmerovanie na profilovú stránku...");
      setError('');
      setEmail('');
      setPassword('');
      
      setTimeout(() => {
        window.location.href = 'logged-in-my-data.html';
      }, 5000);

    } catch (e) {
      console.error("Chyba pri prihlásení:", e);
      if (e.code === 'auth/invalid-credential' || e.code === 'auth/invalid-login-credentials') {
        setError("Nepodarilo sa prihlásiť – nesprávne meno alebo heslo.");
      } else {
        setError(`Zadali ste nesprávne prihlasovacie údaje`);
      }
      setLoading(false);
    }
  };

  // Handle sending password reset email - NOVÁ FUNKCIA
  const handleSendResetEmail = async (emailToReset) => {
    if (!auth) {
      setResetPasswordError("Firebase Auth nie je inicializovaný.");
      return;
    }
    if (!emailToReset) {
      setResetPasswordError("Zadajte prosím e-mailovú adresu.");
      return;
    }

    setResetPasswordLoading(true);
    setResetPasswordError('');
    setResetPasswordMessage('');

    try {
      await auth.sendPasswordResetEmail(emailToReset);
      setResetPasswordMessage("Odkaz na resetovanie hesla bol odoslaný na vašu e-mailovú adresu. Skontrolujte si prosím doručenú poštu (vrátane spamu).");
      // Voliteľne zatvoriť modal po krátkom oneskorení
      setTimeout(() => {
        setShowResetPasswordModal(false);
        setResetPasswordMessage(''); // Vyčistiť správu po zatvorení
        setResetPasswordError(''); // Vyčistiť chybu po zatvorení
      }, 5000);
    } catch (e) {
      console.error("Chyba pri odosielaní e-mailu na resetovanie hesla:", e);
      if (e.code === 'auth/user-not-found') {
        setResetPasswordError("Používateľ s touto e-mailovou adresou nebol nájdený.");
      } else if (e.code === 'auth/invalid-email') {
        setResetPasswordError("Neplatný formát e-mailovej adresy.");
      } else {
        setResetPasswordError(`Chyba: ${e.message}`);
      }
    } finally {
      setResetPasswordLoading(false);
    }
  };


  // Display loading state (pre celú stránku)
  if (!isAuthReady || user === undefined || !settingsLoaded) { 
    if (isAuthReady && user) { 
        console.log("LoginApp: Auth je ready a používateľ je prihlásený, presmerovávam na logged-in-my-data.html");
        window.location.href = 'logged-in-my-data.html';
        return null;
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
    React.createElement(NotificationModal, {
        message: userNotificationMessage,
        onClose: () => setUserNotificationMessage('')
    }),
    React.createElement(ResetPasswordModal, { // Vykreslenie modálneho okna pre reset hesla
        show: showResetPasswordModal,
        onClose: () => {
            setShowResetPasswordModal(false);
            setResetPasswordMessage('');
            setResetPasswordError('');
        },
        onSendResetEmail: handleSendResetEmail,
        loading: resetPasswordLoading,
        message: resetPasswordMessage,
        error: resetPasswordError,
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
              tabIndex: 1
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
            tabIndex: 2,
          }),
          React.createElement(
            'button',
            {
              type: 'submit',
              className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200',
              disabled: loading,
              tabIndex: 3
            },
            loading ? 'Prihlasujem...' : 'Prihlásiť'
          ),
          React.createElement(
            'div',
            { className: 'flex items-center justify-between mt-4' },
            React.createElement(
              'a',
              {
                href: '#', // Používame # a zabránime predvolenému správaniu
                onClick: (e) => { e.preventDefault(); setShowResetPasswordModal(true); }, // Otvorí modal
                className: 'inline-block align-baseline font-bold text-sm text-blue-600 hover:text-blue-800 transition-colors duration-200',
              },
              'Zabudli ste heslo?'
            )
            // Odstránený React.createElement pre odkaz "Registrovať sa"
          )
        )
      )
    )
  );
}
