const appId = 'default-app-id'; 
const firebaseConfig = {
  apiKey: "AIzaSyDj_bSTkjrquu1nyIVYW7YLbyBl1pD6YYo",
  authDomain: "prihlasovanie-4f3f3.firebaseapp.com",
  projectId: "prihlasovanie-4f3f3",
  storageBucket: "prihlasovanie-4f3f3.firebasestorage.app",
  messagingSenderId: "26454452024",
  appId: "1:26454452024:web:6954b4f90f87a3a1eb43cd"
};
const initialAuthToken = null;

// Komponenta pre vstup hesla s prepínaním viditeľnosti
function PasswordInput({ id, label, value, onChange, placeholder, autoComplete, showPassword, toggleShowPassword, onCopy, onPaste, onCut }) {
  const EyeIcon = (
    <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
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
        onCopy={onCopy}
        onPaste={onPaste}
        onCut={onCut}
        required
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        onClick={toggleShowPassword}
        className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
      >
        {showPassword ? EyeOffIcon : EyeIcon}
      </button>
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


function App() {
  const RECAPTCHA_SITE_KEY = "6LdJbn8rAAAAAO4C50qXTWva6ePzDlOfYwBDEDwa";
  const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzPbN2BL4t9qRxRVmJs2CH6OGex-l-z21lg7_ULUH3249r93GKV_4B_Oenf6ydz0CyKrA/exec"; 

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
  const [allUsersData, setAllUsersData] = React.useState([]);
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

    const difference = startDate.getTime() - now.getTime(); // Rozdiel v milisekundách

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
      const firestoreInstance = firebase.firestore(firebaseApp);
      setDb(firestoreInstance);

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
      const unsubscribe = authInstance.onAuthStateChanged(async (currentUser) => {
        setUser(currentUser);
        setIsAuthReady(true);
        setIsRoleLoaded(false);

        if (currentUser && firestoreInstance) {
          console.log("onAuthStateChanged: Používateľ je prihlásený, načítavam rolu a ďalšie dáta z Firestore...");
          try {
            const userDocRef = firestoreInstance.collection('users').doc(currentUser.uid);
            const userDoc = await userDocRef.get();
            if (userDoc.exists) {
              const userData = userDoc.data();
              console.log("onAuthStateChanged: Dáta používateľa z Firestore:", userData);
              setIsAdmin(userData.role === 'admin');
              console.log("onAuthStateChanged: isAdmin nastavené na:", userData.role === 'admin');
              
              setUser(prevUser => ({
                ...prevUser,
                ...userData,
                displayName: userData.firstName && userData.lastName ? `${userData.firstName} ${userData.lastName}` : userData.email
              }));

            } else {
              console.log("onAuthStateChanged: Dokument používateľa vo Firestore neexistuje.");
              setIsAdmin(false);
            }
          } catch (e) {
            console.error("Chyba pri načítaní roly používateľa z Firestore:", e);
            setIsAdmin(false);
          } finally {
            setIsRoleLoaded(true);
          }
        } else {
          console.log("onAuthStateChanged: Používateľ nie je prihlásený alebo db nie je k dispozícii.");
          setIsAdmin(false);
          setIsRoleLoaded(true);
        }
      });

      signIn(); // Spustí počiatočné prihlásenie

      return () => unsubscribe(); // Vyčistenie listenera
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
        if ((hash === 'users' || hash === 'all-teams') && isAdmin) {
          fetchAllUsers();
        }
      } else {
        setProfileView('my-data');
      }
    };

    handleHashChange();

    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [isAdmin]);

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
    if (!email || !password || !confirmPassword || !firstName || !lastName || (!isAdminRegistration && !contactPhoneNumber)) {
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

    if (!isAdminRegistration) {
      const phoneRegex = /^\+\d+$/;
      if (!phoneRegex.test(contactPhoneNumber)) {
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
    try {
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      await userCredential.user.updateProfile({ displayName: `${firstName} ${lastName}` });

      const userRole = isAdminRegistration ? 'admin' : 'user'; 
      const isApproved = !isAdminRegistration; 
      await db.collection('users').doc(userCredential.user.uid).set({
        uid: userCredential.user.uid,
        email: email,
        firstName: firstName,
        lastName: lastName,
        contactPhoneNumber: isAdminRegistration ? '' : contactPhoneNumber,
        displayName: `${firstName} ${lastName}`,
        role: userRole,
        approved: isApproved, 
        registeredAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      console.log(`Používateľ ${email} s rolou '${userRole}' a schválením '${isApproved}' bol uložený do Firestore.`);

      try {
        const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors', 
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'sendRegistrationEmail',
            email: email,
            password: password, 
            isAdmin: isAdminRegistration,
            firstName: firstName,
            lastName: lastName,
            contactPhoneNumber: isAdminRegistration ? '' : contactPhoneNumber
          })
        });
        console.log("Žiadosť na odoslanie e-mailu odoslaná.");
      } catch (emailError) {
        console.error("Chyba pri odosielaní e-mailu cez Apps Script:", emailError);
      }

      await auth.signOut();

      setMessage("Registrácia úspešná! Presmerovanie na prihlasovaciu stránku...");
      setError('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setFirstName('');
      setLastName('');
      setContactPhoneNumber('');
      window.location.href = 'login.html'; 
    } catch (e) {
      console.error("Chyba pri registrácii:", e);
      if (e.code === 'auth/email-already-in-use') {
        setError("E-mailová adresa už existuje. Prosím, zvoľte inú.");
      } else if (e.code === 'auth/weak-password') {
        setError("Heslo je príliš slabé. " + validatePassword(password));
      } else if (e.code === 'auth/invalid-email') {
        setError("Neplatný formát e-mailovej adresy.");
      } else {
        setError(`Chyba pri registrácii: ${e.message}`);
      }
    } finally {
      setLoading(false);
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
        clearMessages();
        return;
      }

      const userData = userDoc.data();
      console.log("Login: Používateľské dáta z Firestore:", userData);

      if (userData.role === 'admin' && userData.approved === false) { 
        setError("Váš administrátorský účet je neaktívny alebo čaká na schválenie iným administrátorom.");
        await auth.signOut(); 
        setLoading(false);
        clearMessages();
        return;
      }

      setUser(prevUser => ({
        ...prevUser,
        ...userData,
        displayName: userData.firstName && userData.lastName ? `${userData.firstName} ${userData.lastName}` : userData.email
      }));


      setMessage("Prihlásenie úspešné! Presmerovanie na profilovú stránku...");
      setError('');
      setEmail('');
      setPassword('');
      window.location.href = 'logged-in.html';
    } catch (e) {
      console.error("Chyba pri prihlasovaní:", e);
      if (e.code === 'auth/invalid-credential' || e.code === 'auth/invalid-login-credentials') {
        setError("Zadané prihlasovacie údaje sú neplatné. Skontrolujte e-mailovú adresu a heslo a skúste to prosím znova.");
      } else if (e.code === 'auth/invalid-email') {
        setError("Neplatný formát e-mailovej adresy.");
      } else {
        setError(`Chyba pri prihlasovaní: ${e.message}`);
      }
    } finally {
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
    if (!user) {
      setError("Nie ste prihlásený.");
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
      const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
      await user.reauthenticateWithCredential(credential);

      await user.updatePassword(newPassword);
      setMessage("Heslo úspešne zmenené!");
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
      clearMessages();
    }
  };

  const fetchAllUsers = async () => {
    setLoading(true);
    setError('');
    try {
      if (!db) {
        setError("Firestore nie je inicializovaný.");
        return;
      }
      const usersCollectionRef = db.collection('users');
      const snapshot = await usersCollectionRef.get();
      const usersList = snapshot.docs.map(doc => doc.data());
      setAllUsersData(usersList);

    } catch (e) {
      console.error("Chyba pri získavaní používateľov z Firestore:", e);
      setError(`Chyba pri získavaní používateľov: ${e.message}`);
    } finally {
      setLoading(false);
      clearMessages();
    }
  };

  const handleChangeName = async (e) => {
    e.preventDefault();
    if (!user) {
      setError("Nie ste prihlásený.");
      return;
    }
    // Zmenená validácia: vyžaduje aspoň jedno z mien A aktuálne heslo
    if ((!newFirstName && !newLastName) || !currentPassword) {
      setError("Prosím, zadajte aspoň nové meno alebo priezvisko a aktuálne heslo pre overenie.");
      return;
    }

    // Kontrola, či je povolená úprava dát
    const now = new Date();
    const editEnd = userDataEditEndDate ? new Date(userDataEditEndDate) : null;
    if (editEnd && now > editEnd) {
        setError("Úpravy vašich údajov sú už uzavreté.");
        return;
    }

    setLoading(true);
    try {
      // Reautentifikácia je potrebná vždy, keďže sa menia citlivé údaje
      const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
      await user.reauthenticateWithCredential(credential);

      const updatedDisplayName = `${newFirstName || user.firstName} ${newLastName || user.lastName}`;
      await user.updateProfile({ displayName: updatedDisplayName });
      await db.collection('users').doc(user.uid).update({ 
        firstName: newFirstName || user.firstName, // Ak je prázdne, ponechá starú hodnotu
        lastName: newLastName || user.lastName,   // Ak je prázdne, ponechá starú hodnotu
        displayName: updatedDisplayName
      });
      setMessage("Meno a priezvisko úspešne zmenené na " + updatedDisplayName);
      setError('');
      setNewFirstName('');
      setNewLastName('');
      setCurrentPassword('');
      setUser(prevUser => ({
        ...prevUser,
        firstName: newFirstName || prevUser.firstName,
        lastName: newLastName || prevUser.lastName,
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
      clearMessages();
    }
  };

  const handleChangeContactPhoneNumber = async (e) => {
    e.preventDefault();
    if (!user) {
      setError("Nie ste prihlásený.");
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

    // Kontrola, či je povolená úprava dát
    const now = new Date();
    const editEnd = userDataEditEndDate ? new Date(userDataEditEndDate) : null;
    if (editEnd && now > editEnd) {
        setError("Úpravy vašich údajov sú už uzavreté.");
        return;
    }

    setLoading(true);
    try {
      if (user.email && currentPassword) {
        const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
        await user.reauthenticateWithCredential(credential);
      } else {
        setError("Pre zmenu telefónneho čísla je potrebné zadať aktuálne heslo pre overenie.");
        setLoading(false);
        return;
      }

      await db.collection('users').doc(user.uid).update({ 
        contactPhoneNumber: newContactPhoneNumber
      });
      setMessage("Telefónne číslo úspešne zmenené na " + newContactPhoneNumber);
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
      clearMessages();
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
    setMessage('');

    // Konvertovať dátumy na Date objekty pre validáciu
    const regStart = registrationStartDate ? new Date(registrationStartDate) : null;
    const regEnd = registrationEndDate ? new Date(registrationEndDate) : null;
    const userEditEnd = userDataEditEndDate ? new Date(userDataEditEndDate) : null;

    // Validácia 1: Koniec registrácie musí byť po začiatku registrácie
    if (regStart && regEnd && regEnd <= regStart) {
        setError("Dátum 'Koniec registrácie' musí byť neskôr ako 'Začiatok registrácie'.");
        setLoading(false);
        clearMessages();
        return;
    }

    // Validácia 2: Koniec úprav používateľských dát musí byť po konci registrácie
    if (regEnd && userEditEnd && userEditEnd <= regEnd) {
        setError("Dátum 'Koniec úprav používateľských dát' musí byť neskôr ako 'Koniec registrácie'.");
        setLoading(false);
        clearMessages();
        return;
    }

    try {
        const settingsDocRef = db.collection('settings').doc('registration');
        await settingsDocRef.set({
            // Pri ukladaní vytvárame Timestamp z Date objektu, ktorý je vytvorený z datetime-local stringu.
            // new Date() s datetime-local stringom sa interpretuje ako lokálny čas.
            // Timestamp.fromDate() potom tento lokálny čas správne prekonvertuje na UTC pre uloženie.
            registrationStartDate: registrationStartDate ? firebase.firestore.Timestamp.fromDate(new Date(registrationStartDate)) : null,
            registrationEndDate: registrationEndDate ? firebase.firestore.Timestamp.fromDate(new Date(registrationEndDate)) : null,
            userDataEditEndDate: userDataEditEndDate ? firebase.firestore.Timestamp.fromDate(new Date(userDataEditEndDate)) : null
        });
        setMessage("Nastavenia úspešne uložené!");
    } catch (e) {
        console.error("Chyba pri ukladaní nastavení:", e);
        setError(`Chyba pri ukladaní nastavení: ${e.message}`);
    } finally {
      setLoading(false);
      clearMessages();
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
    setMessage('');
    try {
      await db.collection('users').doc(userToDelete.uid).delete();
      setMessage(`Používateľ ${userToDelete.email} bol úspešne odstránený z databázy.`);
      
      closeDeleteConfirmationModal();
      fetchAllUsers();

      window.open(`https://console.firebase.google.com/project/prihlasovanie-4f3f3/authentication/users?t=${new Date().getTime()}`, '_blank');

    } catch (e) {
      console.error("Chyba pri odstraňovaní používateľa z databázy:", e);
      setError(`Chyba pri odstraňovaní používateľa: ${e.message}`);
    } finally {
      setLoading(false);
      clearMessages();
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
    setMessage('');
    try {
      let updateData = { role: newRole };

      if (newRole === 'user') {
        updateData.approved = true;
      }
      else if (newRole === 'admin') {
          updateData.approved = userToEditRole.approved;
      }

      await db.collection('users').doc(userToEditRole.uid).update(updateData);
      setMessage(`Rola používateľa ${userToEditRole.email} bola úspešne zmenená na '${newRole}'.`);
      fetchAllUsers();
      closeRoleEditModal();
    } catch (e) {
      console.error("Chyba pri aktualizácii roly používateľa:", e);
      setError(`Chyba pri aktualizácii roly: ${e.message}`);
    } finally {
      setLoading(false);
      clearMessages();
    }
  };

  const handleApproveUser = async (userToApprove) => {
    if (!userToApprove || !db) {
      setError("Používateľ na schválenie nie je definovaný.");
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    try {
      await db.collection('users').doc(userToApprove.uid).update({ approved: true });
      setMessage(`Používateľ ${userToApprove.email} bol úspešne schválený.`);
      fetchAllUsers();
    } catch (e) {
      console.error("Chyba pri schvaľovaní používateľa:", e);
      setError(`Chyba pri schvaľovaní používateľa: ${e.message}`);
    } finally {
      setLoading(false);
      clearMessages();
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
    if ((view === 'users' || view === 'all-teams') && isAdmin) {
      fetchAllUsers();
    }
    setNewContactPhoneNumber('');
    
    if (view === 'change-name') {
        setNewFirstName('');
        setNewLastName('');
    }
    setCurrentPassword('');
    setNewPassword('');
    setNewConfirmPassword('');
  };


  if (loading || !isAuthReady || (window.location.pathname.split('/').pop() === 'logged-in.html' && !isRoleLoaded) || !settingsLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-xl font-semibold text-gray-700">Načítava sa...</div>
      </div>
    );
  }

  const currentPath = window.location.pathname.split('/').pop();

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
                <p className="text-lg text-gray-600">Ste prihlásený. Voľbou "Klub" otvoríte ďalšie možnosti.</p>
                <div className="mt-6 flex justify-center">
                  <a
                    href="logged-in.html"
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200"
                  >
                    Klub
                  </a>
                </div>
              </>
            ) : (
              <>
                {isRegistrationOpen ? (
                  <>
                    <p className="text-lg text-gray-600">Prosím, prihláste sa alebo sa&nbsp;zaregistrujte, aby ste mohli pokračovať.</p>
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
                        <p className="text-md text-gray-500 mt-2">Registrácia bude možná od: {new Date(registrationStartDate).toLocaleString('sk-SK')}</p>
                        {countdown && (
                            <p className="text-md text-gray-500 mt-2">Registrácia bude spustená o: {countdown}</p>
                        )}
                      </>
                    )}
                    {regEnd && !isNaN(regEnd) && now > regEnd && (
                      <p className="text-md text-gray-500 mt-2">Registrácia bola ukončená: {new Date(registrationEndDate).toLocaleString('sk-SK')}</p>
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

  if (currentPath === 'register.html' || currentPath === 'admin-register.html') {
    if (user) {
      window.location.href = 'logged-in.html';
      return null;
    }

    const is_admin_register_page = currentPath === 'admin-register.html';
    const now = new Date();
    const regStart = registrationStartDate ? new Date(registrationStartDate) : null;
    const regEnd = registrationEndDate ? new Date(registrationEndDate) : null;

    // Registrácia je otvorená, ak nie je nastavený začiatok, alebo je už po začiatku
    // A zároveň nie je nastavený koniec, alebo je ešte pred koncom
    // isRegistrationOpen je už definované vyššie pomocou useMemo
    // const isRegistrationOpen = (!regStart || now >= regStart) && (!regEnd || now <= regEnd); // Už definované

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
                  <p className="text-md text-gray-500 mt-2">Registrácia bude možná od: {new Date(registrationStartDate).toLocaleString('sk-SK')}</p>
                  {countdown && (
                      <p className="text-md text-gray-500 mt-2">Registrácia bude spustená o: {countdown}</p>
                  )}
                </>
              )}
              {regEnd && !isNaN(regEnd) && now > regEnd && (
                <p className="text-md text-gray-500 mt-2">Registrácia bola ukončená: {new Date(registrationEndDate).toLocaleString('sk-SK')}</p>
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

    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto">
        <div className="w-full max-w-md mt-20 mb-10 p-4">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full">
            {message && (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">
                {message}
              </div>
            )}
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap" role="alert">
                {error}
              </div>
            )}
            <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">
              {is_admin_register_page ? "Registrácia administrátora" : "Registrácia na turnaj"}
            </h1>
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
                />
              </div>
              {!is_admin_register_page && (
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
                  />
                </div>
              )}
              {!is_admin_register_page && (
                <p className="text-gray-600 text-sm mt-4">
                  E-mailová adresa bude slúžiť na všetku komunikáciu súvisiacu s turnajom - zasielanie informácií, faktúr atď.
                </p>
              )}
              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="reg-email">
                  {is_admin_register_page ? "E-mailová adresa" : "E-mailová adresa kontaktnej osoby"}
                </label>
                <input
                  type="email"
                  id="reg-email"
                  className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="Zadajte svoju e-mailovú adresu"
                  autoComplete="email"
                />
              </div>
              {!is_admin_register_page && (
                <p className="text-gray-600 text-sm mt-4">
                  E-mailová adresa a heslo budú potrebné na prípadnú neskoršiu úpravu údajov poskytnutých v tomto registračnom formulári.
                </p>
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
              />
              <button
                type="submit"
                className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200"
                disabled={loading}
              >
                {loading ? 'Registrujem...' : 'Registrovať sa'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (currentPath === 'login.html') {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto">
        <div className="w-full max-w-md mt-20 mb-10 p-4">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full">
            {message && (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">
                {message}
              </div>
            )}
            {error && (
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

    return (
      <div className="min-h-screen bg-gray-100 flex flex-col font-inter overflow-y-auto">
        <div className="h-20"></div> 

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
                    onClick={() => changeProfileView('change-password')}
                    className={`w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 whitespace-nowrap ${
                      profileView === 'change-password' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Zmeniť heslo
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
                        changeProfileView('settings');
                      }}
                      className={`w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 whitespace-nowrap ${
                        profileView === 'settings' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Nastavenia
                    </button>
                  </li>
                )}
              </ul>
            </nav>
          </div>

          <div className="flex-grow ml-[287px] p-8 bg-white rounded-lg shadow-xl overflow-x-auto overflow-y-auto mr-4">
            {message && (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">
                {message}
              </div>
            )}
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
                  <span className="font-semibold">E-mailová adresa: </span>{user.email || 'N/A'}
                </p>
                <p className="text-gray-700">
                  <span className="font-semibold">Meno a priezvisko: </span>{user.displayName || 'N/A'}
                </p>
                {!isAdmin && ( 
                  <p className="text-gray-700">
                    <span className="font-semibold">Telefónne číslo: </span>{user.contactPhoneNumber || 'N/A'}
                  </p>
                )}
                {!isEditAllowed && (
                    <p className="text-red-500 text-sm mt-2">
                        Úpravy vašich údajov sú už uzavreté. Boli uzavreté dňa: {editEnd ? editEnd.toLocaleString('sk-SK') : 'N/A'}
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
                  placeholder="Zadajte aktuálne heslo"
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
                  placeholder="Zadajte aktuálne heslo"
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
                      const strictPhoneRegex = /^\+\d*$/;
                      if (value === '' || strictPhoneRegex.test(value)) {
                        setNewContactPhoneNumber(value);
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
                  placeholder="Zadajte aktuálne heslo"
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
                            <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-800">{u.firstName || 'N/A'}</td>
                            <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-800">{u.lastName || 'N/A'}</td>
                            <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-800">{u.contactPhoneNumber || 'N/A'}</td>
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
            {profileView === 'settings' && isAdmin && (
              <form onSubmit={handleSaveSettings} className="space-y-4 border-t pt-4 mt-4">
                <h2 className="text-xl font-semibold text-gray-800">Nastavenia systému</h2>
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
