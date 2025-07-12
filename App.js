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
  // Nové stavy pre meno a priezvisko
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  // NOVÉ: Stav pre telefónne číslo kontaktnej osoby (pre registráciu)
  const [contactPhoneNumber, setContactPhoneNumber] = React.useState('');

  const [newPassword, setNewPassword] = React.useState('');
  const [confirmNewPassword, setConfirmNewPassword] = React.useState('');
  const [currentPassword, setCurrentPassword] = React.useState('');
  // Nové stavy pre zmenu mena a priezviska
  const [newFirstName, setNewFirstName] = React.useState('');
  const [newLastName, setNewLastName] = React.useState('');
  // NOVÉ: Stav pre nové telefónne číslo (pre zmenu)
  const [newContactPhoneNumber, setNewContactPhoneNumber] = React.useState('');


  // Inicializácia profileView na základe URL hash alebo defaultne na 'my-data'
  const getInitialProfileView = () => {
    const hash = window.location.hash.substring(1); // Odstráni '#'
    return hash || 'my-data';
  };
  const [profileView, setProfileView] = React.useState(getInitialProfileView);

  const [isAdmin, setIsAdmin] = React.useState(false); // Stav pre administrátorské oprávnenia
  const [allUsersData, setAllUsersData] = React.useState([]); // Stav pre zoznam všetkých používateľov
  const [isRoleLoaded, setIsRoleLoaded] = React.useState(false); // Nový stav pre indikáciu načítania roly

  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = React.useState(false);

  // NOVÉ: Stavové premenné pre modálne okná
  const [showDeleteConfirmationModal, setShowDeleteConfirmationModal] = React.useState(false);
  const [userToDelete, setUserToDelete] = React.useState(null);
  const [showRoleEditModal, setShowRoleEditModal] = React.useState(false);
  const [userToEditRole, setUserToEditRole] = React.useState(null);
  const [newRole, setNewRole] = React.useState('');

  // NOVÉ: Stavy pre nastavenia dátumov (globálne, pre logiku registrácie)
  const [registrationStartDate, setRegistrationStartDate] = React.useState(null); // NOVÉ: Dátum začiatku registrácie
  const [registrationEndDate, setRegistrationEndDate] = React.useState(null); 
  const [editEndDate, setEditEndDate] = React.useState(null); 
  const [settingsLoaded, setSettingsLoaded] = React.useState(false);

  // NOVÉ: Lokálne stavy pre input polia v sekcii nastavení
  const [tempRegistrationStartDate, setTempRegistrationStartDate] = React.useState(''); // NOVÉ: Dočasný stav pre input
  const [tempRegistrationEndDate, setTempRegistrationEndDate] = React.useState('');
  const [tempEditEndDate, setTempEditEndDate] = React.useState('');

  // NOVÉ: Stav pre text odpočítavania
  const [countdownMessage, setCountdownMessage] = React.useState('');
  // NOVÉ: Stav pre vynútenie re-renderu na základe zmeny stavu registrácie
  const [registrationStatusChanged, setRegistrationStatusChanged] = React.useState(false);


  const EyeIcon = React.createElement("svg", { className: "h-5 w-5 text-gray-500", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor" },
    React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M15 12a3 3 0 11-6 0 3 3 0 016 0z" }),
    React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" })
  );

  const EyeOffIcon = React.createElement("svg", { className: "h-5 w-5 text-gray-500", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor" },
    React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.274-4.057 5.064-7 9.542-7a9.95 9.95 0 011.875.175m.001 0V5m0 14v-2.175m0-10.65L12 12m-6.25 6.25L12 12m0 0l6.25-6.25M12 12l-6.25-6.25" })
  );

  // NOVÁ POMOCNÁ FUNKCIA: Formátuje Date objekt na reťazec pre datetime-local input
  // Zabezpečuje, že sa zobrazí čas v lokálnom časovom pásme prehliadača (ktorý by mal byť UTC+2)
  const formatToDateTimeLocal = (date) => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Header Component (definovaný v rámci App pre jednoduchosť)
  const Header = ({ user, isAdmin, handleLogout, isAuthReady }) => {
    return (
      React.createElement("header", { className: "fixed top-0 left-0 right-0 bg-white shadow-md p-4 flex items-center justify-between z-50 rounded-b-lg" },
        React.createElement("div", { className: "text-xl font-bold text-gray-800" }, "Slovak Open Handball"),
        React.createElement("div", { className: "flex items-center space-x-4" },
          isAuthReady && !user && ( // Nie je prihlásený
            React.createElement("a", {
              href: "login.html",
              className: "text-blue-600 hover:text-blue-800 font-semibold"
            }, "Prihlásenie")
          ),
          isAuthReady && user && ( // Prihlásený
            React.createElement("a", {
              href: "logged-in.html",
              className: "text-blue-600 hover:text-blue-800 font-semibold"
            }, "Moja zóna")
          ),
          isAuthReady && user && ( // Prihlásený
            React.createElement("button", {
              onClick: handleLogout,
              className: "bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
            }, "Odhlásenie")
          )
        )
      )
    );
  };


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
        } finally {
          setLoading(false);
        }
      };

      const unsubscribe = authInstance.onAuthStateChanged(async (currentUser) => {
        setUser(currentUser);
        setIsAuthReady(true);
        setIsRoleLoaded(false); // Resetovať stav načítania roly pri zmene používateľa

        // Načítanie administrátorských oprávnení a ďalších údajov z Firestore
        if (currentUser && firestoreInstance) { // Používame firestoreInstance priamo
          console.log("onAuthStateChanged: Používateľ je prihlásený, načítavam rolu a ďalšie dáta z Firestore...");
          try {
            const userDocRef = firestoreInstance.collection('users').doc(currentUser.uid);
            const userDoc = await userDocRef.get();
            if (userDoc.exists) {
              const userData = userDoc.data();
              console.log("onAuthStateChanged: Dáta používateľa z Firestore:", userData);
              const userIsAdmin = userData.role === 'admin';
              setIsAdmin(userIsAdmin);
              console.log("onAuthStateChanged: isAdmin nastavené na:", userIsAdmin);
              
              // Aktualizovať objekt používateľa o dáta z Firestore
              // Vytvoríme nový objekt, aby sme nespôsobili priamu mutáciu
              setUser(prevUser => ({
                ...prevUser,
                ...userData, // Pridá všetky polia z Firestore dokumentu (vrátane firstName, lastName, contactPhoneNumber, role, approved)
                displayName: userData.firstName && userData.lastName ? `${userData.firstName} ${userData.lastName}` : userData.email // Aktualizuje displayName
              }));

              // GLOBÁLNA PREMENNÁ PRE HLAVIČKU
              window.currentUserData = {
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: userData.firstName && userData.lastName ? `${userData.firstName} ${userData.lastName}` : currentUser.email,
                role: userData.role,
                approved: userData.approved
              };
              window.isAdminGlobal = userIsAdmin;


            } else {
              console.log("onAuthStateChanged: Dokument používateľa vo Firestore neexistuje.");
              setIsAdmin(false);
              // GLOBÁLNA PREMENNÁ PRE HLAVIČKU
              window.currentUserData = null;
              window.isAdminGlobal = false;
            }
          } catch (e) {
            console.error("Chyba pri načítaní roly používateľa z Firestore:", e);
            setIsAdmin(false); // Predpokladáme, že nie je admin v prípade chyby
            // GLOBÁLNA PREMENNÁ PRE HLAVIČKU
            window.currentUserData = null;
            window.isAdminGlobal = false;
          } finally {
            setIsRoleLoaded(true); // Rola bola načítaná (alebo sa zistilo, že dokument neexistuje)
            console.log("onAuthStateChanged: isRoleLoaded nastavené na true.");
            // Spustiť udalosť po načítaní všetkých dát pre hlavičku
            window.dispatchEvent(new Event('authStatusChanged'));
          }
        } else {
          console.log("onAuthStateChanged: Používateľ nie je prihlásený alebo db nie je k dispozícii.");
          setIsAdmin(false);
          setIsRoleLoaded(true); // Ak nie je používateľ alebo db, rola je "načítaná" ako nie-admin
          // GLOBÁLNA PREMENNÁ PRE HLAVIČKU
          window.currentUserData = null;
          window.isAdminGlobal = false;
          // Spustiť udalosť po načítaní všetkých dát pre hlavičku
          window.dispatchEvent(new Event('authStatusChanged'));
        }
      });

      signIn();

      return () => unsubscribe();
    } catch (e) {
      console.error("Failed to initialize Firebase:", e);
      setError(`Chyba pri inicializácii Firebase: ${e.message}`);
      setLoading(false);
    }
  }, []); 

  // Effect pre načítanie profileView z URL hash pri načítaní stránky
  React.useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.substring(1);
      if (hash) {
        setProfileView(hash);
        // Ak je hash 'users' alebo 'all-teams' a používateľ je admin, načítaj používateľov
        if ((hash === 'users' || hash === 'all-teams') && isAdmin) {
          fetchAllUsers();
        }
      } else {
        setProfileView('my-data');
      }
    };

    // Nastavte počiatočný stav na základe aktuálneho hashu
    handleHashChange();

    // Pridajte poslucháča pre zmeny hashu
    window.addEventListener('hashchange', handleHashChange);

    // Vyčistenie poslucháča pri odpojení komponentu
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [isAdmin]); 

  // NOVÝ useEffect pre načítanie nastavení
  React.useEffect(() => {
    const fetchSettings = async () => {
      if (!db) return;
      try {
        const settingsDocRef = db.collection('appSettings').doc('tournamentSettings');
        const doc = await settingsDocRef.get();
        if (doc.exists) {
          const data = doc.data();
          
          // Konvertovať Firestore Timestamp na Date objekty
          const regStartDateObj = data.registrationStartDate ? data.registrationStartDate.toDate() : null; 
          const regEndDateObj = data.registrationEndDate ? data.registrationEndDate.toDate() : null;
          const edDateObj = data.editEndDate ? data.editEndDate.toDate() : null;
          
          setRegistrationStartDate(regStartDateObj); 
          setRegistrationEndDate(regEndDateObj);
          setEditEndDate(edDateObj);

          // Pre lokálne stavy inputov konvertujeme Date objekt na ISO string
          // POUŽÍVAME NOVÚ FUNKCIU formatToDateTimeLocal
          setTempRegistrationStartDate(formatToDateTimeLocal(regStartDateObj)); 
          setTempRegistrationEndDate(formatToDateTimeLocal(regEndDateObj));
          setTempEditEndDate(formatToDateTimeLocal(edDateObj));

        } else {
          console.log("Nastavenia turnaja neboli nájdené vo Firestore. Používam predvolené prázdne hodnoty.");
          // Ak dokument neexistuje, inicializovať lokálne stavy na prázdne
          setRegistrationStartDate(null); 
          setRegistrationEndDate(null);
          setEditEndDate(null);
          setTempRegistrationStartDate(''); 
          setTempRegistrationEndDate('');
          setTempEditEndDate('');
        }
      } catch (e) {
        console.error("Chyba pri načítaní nastavení turnaja:", e);
        setError(`Chyba pri načítaní nastavení: ${e.message}`);
      } finally {
        setSettingsLoaded(true);
      }
    };

    if (db) {
      fetchSettings();
    }
  }, [db]); 

  // NOVÝ useEffect pre odpočítavanie
  React.useEffect(() => {
    let intervalId;

    const updateCountdown = () => {
      if (!settingsLoaded || (!registrationStartDate && !registrationEndDate)) {
        setCountdownMessage("Načítavam nastavenia registrácie...");
        window.isRegistrationOpenGlobal = false; // Nastavíme na false, kým sa nenačítajú
        return;
      }

      const now = new Date();
      
      // Registrácia je otvorená, ak je 'teraz' medzi začiatkom a koncom
      const isRegistrationCurrentlyOpen = registrationStartDate && registrationEndDate && now >= registrationStartDate && now <= registrationEndDate;
      window.isRegistrationOpenGlobal = isRegistrationCurrentlyOpen; // Aktualizácia globálnej premennej

      // Spustiť udalosť, aby hlavička reagovala na zmenu stavu registrácie
      window.dispatchEvent(new Event('authStatusChanged'));

      // Ak je registrácia otvorená
      if (isRegistrationCurrentlyOpen) {
        const timeLeft = registrationEndDate.getTime() - now.getTime();
        if (timeLeft <= 0) {
          setCountdownMessage("Registrácia je ukončená.");
          setRegistrationStatusChanged(prev => !prev); // Prepne stav pre vynútenie re-renderu
          clearInterval(intervalId);
          return;
        }
        const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
        setCountdownMessage(`Registrácia sa končí za: ${days}d ${hours}h ${minutes}m ${seconds}s`);
      } 
      // Ak registrácia ešte nezačala
      else if (registrationStartDate && now < registrationStartDate) {
        const timeLeft = registrationStartDate.getTime() - now.getTime();
        if (timeLeft <= 0) {
          setCountdownMessage("Registrácia je otvorená!");
          setRegistrationStatusChanged(prev => !prev); // Prepne stav pre vynútenie re-renderu
          clearInterval(intervalId);
          return;
        }
        const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
        setCountdownMessage(`Registrácia začína za: ${days}d ${hours}h ${minutes}m ${seconds}s`);
      }
      // Ak registrácia už skončila
      else {
        setCountdownMessage("Registrácia je uzavretá.");
        setRegistrationStatusChanged(prev => !prev); // Prepne stav pre vynútenie re-renderu
        clearInterval(intervalId);
      }
    };

    if (settingsLoaded) {
      updateCountdown(); // Okamžitá aktualizácia pri načítaní nastavení
      intervalId = setInterval(updateCountdown, 1000); // Aktualizácia každú sekundu
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId); // Vyčistenie intervalu pri odpojení komponentu
      }
    };
  }, [settingsLoaded, registrationStartDate, registrationEndDate]); 


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
      errors.push("jedno veľké písmeno");
    }
    if (!/[a-z]/.test(pwd)) {
      errors.push("jedno malé písmeno");
    }
    if (!/[0-9]/.test(pwd)) {
      errors.push("jednu číslicu");
    }

    if (errors.length === 0) {
      return null;
    } else {
      return "Heslo musí obsahovať aspoň:\n• " + errors.join("\n• ") + ".";
    }
  };

  const handleRegister = async (e, isAdminRegistration = false) => {
    e.preventDefault();
    if (!auth || !db) {
      setError("Firebase Auth alebo Firestore nie je inicializovaný.");
      return;
    }

    // NOVÁ KONTROLA: Registrácia povolená od/do (neplatí pre admin-register.html)
    if (!isAdminRegistration && settingsLoaded) {
      const now = new Date();
      // Registrácia je otvorená, ak je 'teraz' medzi začiatkom a koncom
      const isRegistrationOpen = registrationStartDate && registrationEndDate && now >= registrationStartDate && now <= registrationEndDate;

      if (!isRegistrationOpen) {
        setError("Registrácia je momentálne uzavretá alebo ešte nezačala.");
        return;
      }
    }

    // NOVÉ: Pridané overenie contactPhoneNumber
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

    // NOVÉ: Validácia telefónneho čísla - prvý znak "+" a zvyšné iba čísla (len pre bežnú registráciu)
    if (!isAdminRegistration) {
      const phoneRegex = /^\+\d+$/; // Regex pre '+' nasledovaný jednou alebo viacerými číslicami
      if (!phoneRegex.test(contactPhoneNumber)) {
          setError("Telefónne číslo kontaktnej osoby musí zaínať znakom '+' a obsahovať iba číslice (napr. +421901234567).");
          return;
      }
    }

    const recaptchaToken = await getRecaptchaToken('register');
    if (!recaptchaToken) {
      setError("Overenie reCAPTCHA zlyhalo. Prosím, skúste to znova.");
      return;
    }
    console.log("reCAPTCHA Token pre registráciu:", recaptchaToken);

    setLoading(true);
    try {
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      // Nastavíme display name na kombináciu mena a priezviska
      await userCredential.user.updateProfile({ displayName: `${firstName} ${lastName}` });

      // Uloženie údajov používateľa do Firestore
      const userRole = isAdminRegistration ? 'admin' : 'user'; 
      const isApproved = !isAdminRegistration; 
      await db.collection('users').doc(userCredential.user.uid).set({
        uid: userCredential.user.uid,
        email: email,
        firstName: firstName, // Uloženie mena
        lastName: lastName,   // Uloženie priezvisko
        contactPhoneNumber: isAdminRegistration ? '' : contactPhoneNumber, // NOVÉ: Uloženie telefónneho čísla (prázdne pre admina)
        displayName: `${firstName} ${lastName}`, // Uloženie kombinovaného mena
        role: userRole,
        approved: isApproved, 
        registeredAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      console.log(`Používateľ ${email} s rolou '${userRole}' a schválením '${isApproved}' bol uložený do Firestore.`);

      // --- ODOSLANIE E-MAILU CEZ GOOGLE APPS SCRIPT ---
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
            firstName: firstName, // Pridané pre e-mail
            lastName: lastName,   // Pridané pre e-mail
            contactPhoneNumber: isAdminRegistration ? '' : contactPhoneNumber // NOVÉ: Pridané pre e-mail
          })
        });
        console.log("Žiadosť na odoslanie e-mailu odoslaná.");
      } catch (emailError) {
        console.error("Chyba pri odosielaní e-mailu cez Apps Script:", emailError);
      }
      // --- KONIEC ODOSIELANIA E-MAILU ---

      await auth.signOut();

      setMessage("Registrácia úspešná! Presmerovanie na prihlasovaciu stránku...");
      setError('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setFirstName(''); // Vyčistenie polí
      setLastName('');  // Vyčistenie polí
      setContactPhoneNumber(''); // NOVÉ: Vyčistenie poľa
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
      return;
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

      // Aktualizujeme objekt používateľa o dáta z Firestore
      setUser(prevUser => ({
        ...prevUser,
        ...userData,
        displayName: userData.firstName && userData.lastName ? `${userData.firstName} ${userData.lastName}` : userData.email
      }));

      // GLOBÁLNA PREMENNÁ PRE HLAVIČKU
      window.currentUserData = {
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: userData.firstName && userData.lastName ? `${userData.firstName} ${userData.lastName}` : currentUser.email,
        role: userData.role,
        approved: userData.approved
      };
      window.isAdminGlobal = userData.role === 'admin';
      window.dispatchEvent(new Event('authStatusChanged'));


      setMessage("Prihlásenie úspešné! Presmerovanie na profilovú stránku...");
      setError('');
      setEmail('');
      setPassword('');
      window.location.href = 'logged-in.html';
    } catch (e) {
      console.error("Chyba pri prihlasovaní:", e);
      if (e.code === 'auth/invalid-credential' || e.code === 'auth/invalid-login-credentials') {
        setError("Zadané prihlasovacie údaje sú neplatné. Skontrolujte e-mailovú adresu a heslo a skúste to prosím znova.");
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
      // GLOBÁLNA PREMENNÁ PRE HLAVIČKU
      window.currentUserData = null;
      window.isAdminGlobal = false;
      window.dispatchEvent(new Event('authStatusChanged'));

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

    // NOVÁ KONTROLA: Editácia údajov povolená do (len pre bežných používateľov)
    if (!isAdmin && settingsLoaded && editEndDate) { 
      const now = new Date();
      if (now > editEndDate) { 
        setError("Editácia údajov je už uzavretá.");
        return;
      }
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
      setConfirmNewPassword('');
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

  // Funkcia na získanie všetkých používateľov z Firestore
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

  // Funkcia na zmenu mena a priezviska
  const handleChangeName = async (e) => {
    e.preventDefault();
    if (!user) {
      setError("Nie ste prihlásený.");
      return;
    }

    // NOVÁ KONTROLA: Editácia údajov povolená do (len pre bežných používateľov)
    if (!isAdmin && settingsLoaded && editEndDate) { 
      const now = new Date();
      if (now > editEndDate) { 
        setError("Editácia údajov je už uzavretá.");
        return;
      }
    }

    if (!newFirstName || !newLastName) {
      setError("Prosím, zadajte meno aj priezvisko.");
      return;
    }

    setLoading(true);
    try {
      if (user.email && currentPassword) {
        const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
        await user.reauthenticateWithCredential(credential);
      } else {
        setError("Pre zmenu mena a priezviska je potrebné zadať aktuálne heslo pre overenie.");
        setLoading(false);
        return;
      }

      const newDisplayName = `${newFirstName} ${newLastName}`;
      await user.updateProfile({ displayName: newDisplayName });
      // Aktualizácia mena a priezviska aj vo Firestore
      await db.collection('users').doc(user.uid).update({ 
        firstName: newFirstName,
        lastName: newLastName,
        displayName: newDisplayName
      });
      setMessage("Meno a priezvisko úspešne zmenené na " + newDisplayName);
      setError('');
      setNewFirstName('');
      setNewLastName('');
      setCurrentPassword('');
      // Aktualizujeme aj lokálny stav `user` v Reactu
      setUser(prevUser => ({ ...prevUser, displayName: newDisplayName, firstName: newFirstName, lastName: newLastName }));
      // Aktualizujeme aj globálnu premennú pre hlavičku
      if (window.currentUserData) {
        window.currentUserData.displayName = newDisplayName;
        window.dispatchEvent(new Event('authStatusChanged'));
      }

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

  // NOVÁ FUNKCIA: Zmena telefónneho čísla
  const handleChangeContactPhoneNumber = async (e) => {
    e.preventDefault();
    if (!user) {
      setError("Nie ste prihlásený.");
      return;
    }

    // NOVÁ KONTROLA: Editácia údajov povolená do (len pre bežných používateľov)
    if (!isAdmin && settingsLoaded && editEndDate) { 
      const now = new Date();
      if (now > editEndDate) { 
        setError("Editácia údajov je už uzavretá.");
        return;
      }
    }

    if (!newContactPhoneNumber) {
      setError("Prosím, zadajte nové telefónne číslo.");
      return;
    }

    // Validácia telefónneho čísla
    const phoneRegex = /^\+\d+$/;
    if (!phoneRegex.test(newContactPhoneNumber)) {
        setError("Telefónne číslo musí zaínať znakom '+' a obsahovať iba číslice (napr. +421901234567).");
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

      // Aktualizácia telefónneho čísla vo Firestore
      await db.collection('users').doc(user.uid).update({ 
        contactPhoneNumber: newContactPhoneNumber
      });
      setMessage("Telefónne číslo úspešne zmenené na " + newContactPhoneNumber);
      setError('');
      setNewContactPhoneNumber('');
      setCurrentPassword('');
      // Aktualizovať lokálny stav používateľa po úspešnej zmene
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


  // Funkcie pre modálne okná
  const openDeleteConfirmationModal = (user) => {
    setUserToDelete(user);
    setShowDeleteConfirmationModal(true);
  };

  const closeDeleteConfirmationModal = () => {
    setUserToDelete(null);
    setShowDeleteConfirmationModal(false);
  };

  // Upravená funkcia handleDeleteUser pre úplné odstránenie
  const handleDeleteUser = async () => {
    if (!userToDelete || !db) { 
      setError("Používateľ na odstránenie nie je definovaný alebo Firebase nie je inicializovaný.");
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    try {
      // Úplné odstránenie dokumentu používateľa z Firestore
      await db.collection('users').doc(userToDelete.uid).delete();
      setMessage(`Používateľ ${userToDelete.email} bol úspešne odstránený z databázy.`);
      
      closeDeleteConfirmationModal(); // Zavrie modálne okno PRED otvorením novej karty
      fetchAllUsers(); // Obnovenie zoznamu používateľov po odstránení

      // Otvorenie Firebase Console v novej karte po úspešnom odstránení
      // Pridávame parameter 't=' s aktuálnym časom, aby sa vynútilo načítanie stránky
      window.open(`https://console.firebase.google.com/project/prihlasovanie-4f3f3/authentication/users?t=${new Date().getTime()}`, '_blank');

    } catch (e) {
      console.error("Chyba pri odstraňovaní používateľa z databázy:", e);
      setError(`Chyba pri odstraňovaní používateľa: ${e.message}`);
    } finally {
      setLoading(false); // Nastavíme loading na false aj v prípade chyby, aby sa UI neodblokovalo
      clearMessages();
    }
  };

  const openRoleEditModal = (user) => {
    setUserToEditRole(user);
    setNewRole(user.role || 'user'); // Predvyplniť aktuálnou rolou
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

      // Ak sa nová rola nastavuje na 'user', automaticky schváliť
      if (newRole === 'user') {
        updateData.approved = true;
      }
      // Ak sa rola nastavuje na 'admin', zachovať existujúci stav schválenia používateľa.
      // Toto zahŕňa prípady, keď bol používateľ neschválený admin (zostane neschválený)
      // alebo schválený používateľ/admin (zostane schválený).
      else if (newRole === 'admin') {
          updateData.approved = userToEditRole.approved; // Zachovať existujúci stav schválenia
      }


      await db.collection('users').doc(userToEditRole.uid).update(updateData);
      setMessage(`Rola používateľa ${userToEditRole.email} bola úspešne zmenená na '${newRole}'.`);
      // Obnovenie zoznamu používateľov po zmene roly
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

  // Funkcia na schválenie používateľa (nastaví approved na true)
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
      fetchAllUsers(); // Obnovenie zoznamu používateľov
    } catch (e) {
      console.error("Chyba pri schvaľovaní používateľa:", e);
      setError(`Chyba pri schvaľovaní používateľa: ${e.message}`);
    } finally {
      setLoading(false);
      clearMessages();
    }
  };

  // NOVÁ FUNKCIA: Uloženie nastavení turnaja
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!db || !isAdmin) {
      setError("Nemáte oprávnenie na úpravu nastavení.");
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    try {
      const settingsDocRef = db.collection('appSettings').doc('tournamentSettings');
      
      // Konvertujeme tempRegistrationStartDate, tempRegistrationEndDate a tempEditEndDate na Date objekty
      // a tie potom na Firestore Timestamp
      const regStartDateToSave = tempRegistrationStartDate ? new Date(tempRegistrationStartDate) : null; 
      const regEndDateToSave = tempRegistrationEndDate ? new Date(tempRegistrationEndDate) : null;
      const edDateToSave = tempEditEndDate ? new Date(tempEditEndDate) : null;

      await settingsDocRef.set({
        registrationStartDate: regStartDateToSave ? firebase.firestore.Timestamp.fromDate(regStartDateToSave) : null, 
        registrationEndDate: regEndDateToSave ? firebase.firestore.Timestamp.fromDate(regEndDateToSave) : null,
        editEndDate: edDateToSave ? firebase.firestore.Timestamp.fromDate(edDateToSave) : null,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true }); // Použiť merge, aby sa prepísali len zadané polia

      // Po úspešnom uložení aktualizujeme globálne stavy s Date objektmi
      setRegistrationStartDate(regStartDateToSave); 
      setRegistrationEndDate(regEndDateToSave);
      setEditEndDate(edDateToSave);

      setMessage("Nastavenia turnaja úspešne uložené!");
    } catch (e) {
      console.error("Chyba pri ukladaní nastavení turnaja:", e);
      setError(`Chyba pri ukladaní nastavení: ${e.message}`);
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

  // Funkcia pre zmenu zobrazenia profilu a aktualizáciu URL hash
  const changeProfileView = (view) => {
    setProfileView(view);
    window.location.hash = view; // Aktualizácia URL hash
    if ((view === 'users' || view === 'all-teams') && isAdmin) { // Zmena: Volanie fetchAllUsers aj pre 'all-teams'
      fetchAllUsers();
    }
    // NOVÁ ZMENA: Vyčistiť pole pre telefónne číslo, aby sa nepredvyplňovalo
    setNewContactPhoneNumber(''); // Vyčistiť pole pri každej zmene zobrazenia
    
    // Vyčistíme polia pre zmenu mena/priezviska, aby sa nepredvyplňovali
    if (view === 'change-name') {
        setNewFirstName('');
        setNewLastName('');
    }
    // Vyčistíme pole pre aktuálne heslo pri zmene záložky
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
  };


  if (loading || !isAuthReady || (window.location.pathname.split('/').pop() === 'logged-in.html' && !isRoleLoaded) || !settingsLoaded) {
    return (
      React.createElement("div", { className: "flex items-center justify-center min-h-screen bg-gray-100" },
        React.createElement("div", { className: "text-xl font-semibold text-gray-700" }, "Načítava sa...")
      )
    );
  }

  const currentPath = window.location.pathname.split('/').pop();
  const now = new Date();
  const isRegistrationOpen = registrationStartDate && registrationEndDate && now >= registrationStartDate && now <= registrationEndDate;
  const isEditingOpen = isAdmin || (editEndDate && now <= editEndDate); 

  let pageContent = null;

  if (currentPath === '' || currentPath === 'index.html') {
    const h1Element = React.createElement("h1", { className: "text-3xl font-bold text-gray-800 mb-4" }, "Vitajte na stránke Slovak Open Handball");

    let conditionalContent;
    if (user) {
      conditionalContent = React.createElement(React.Fragment, null,
        React.createElement("p", { className: "text-lg text-gray-600" }, "Ste prihlásený. Prejdite do svojej zóny pre viac možností."),
        React.createElement("div", { className: "mt-6 flex justify-center" },
          React.createElement("a", {
            href: "logged-in.html",
            className: "bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200"
          }, "Moja zón")
        )
      );
    } else {
      conditionalContent = React.createElement(React.Fragment, null,
        React.createElement("p", { className: "text-lg text-gray-600" }, "Prosím, prihláste sa alebo sa zaregistrujte, aby ste mohli pokračovali."),
        React.createElement("div", { className: "mt-6 flex justify-center space-x-4" },
          React.createElement("a", {
            href: "login.html",
            className: "bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200"
          }, "Prihlásenie"),
          // Zmena: Podmienené zobrazenie tlačidla "Registrácia na turnaj"
          isRegistrationOpen && (
            React.createElement("a", {
              href: "register.html",
              className: "bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200"
            }, "Registrácia na turnaj")
          )
        ),
        // NOVÉ: Zobrazenie odpočítavania
        React.createElement("div", { className: "mt-6 text-center text-gray-700 font-semibold" },
          countdownMessage
        )
      );
    }
    pageContent = React.createElement("div", { className: "w-full max-w-md p-4" },
      React.createElement("div", { className: "bg-white p-8 rounded-lg shadow-xl w-full text-center" },
        h1Element,
        conditionalContent
      )
    );
  } else if (currentPath === 'register.html' || currentPath === 'admin-register.html') {
    // Ak je používateľ prihlásený, presmerovať na logged-in.html
    if (user) {
      window.location.href = 'logged-in.html';
      return null; 
    }

    const is_admin_register_page = currentPath === 'admin-register.html';
    // NOVÁ LOGIKA: Pre admin registráciu sú obmedzenia vypnuté.
    // Pre bežnú registráciu sa použije isRegistrationOpen.
    const isRegistrationAllowed = is_admin_register_page || isRegistrationOpen;

    pageContent = React.createElement("div", { className: "w-full max-w-md p-4" },
      React.createElement("div", { className: "bg-white p-8 rounded-lg shadow-xl w-full" },
        React.createElement("h1", { className: "text-3xl font-bold text-center text-gray-800 mb-6" },
          is_admin_register_page ? "Registrácia administrátora" : "Registrácia na turnaj"
        ),
        isRegistrationAllowed ? ( 
          React.createElement("form", { onSubmit: (e) => handleRegister(e, is_admin_register_page), className: "space-y-4" },
            React.createElement("div", null,
              React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "reg-first-name" },
                is_admin_register_page ? "Meno" : "Meno kontaktnej osoby" 
              ),
              React.createElement("input", {
                type: "text",
                id: "reg-first-name",
                className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500",
                value: firstName,
                onChange: (e) => setFirstName(e.target.value),
                required: true,
                placeholder: "Zadajte svoje meno",
                autoComplete: "given-name"
              })
            ),
            React.createElement("div", null,
              React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "reg-last-name" },
                is_admin_register_page ? "Priezvisko" : "Priezvisko kontaktnej osoby" 
              ),
              React.createElement("input", {
                type: "text",
                id: "reg-last-name",
                className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500",
                value: lastName,
                onChange: (e) => setLastName(e.target.value),
                required: true,
                placeholder: "Zadajte svoje priezvisko",
                autoComplete: "family-name"
              })
            ),
            // NOVÉ: Pole pre telefónne číslo kontaktnej osoby (len pre bežnú registráciu)
            !is_admin_register_page && (
              React.createElement("div", null,
                React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "reg-phone-number" }, "Telefónne číslo kontaktnej osoby"),
                React.createElement("input", {
                  type: "tel", 
                  id: "reg-phone-number",
                  className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500",
                  value: contactPhoneNumber,
                  onChange: (e) => {
                    const value = e.target.value;
                    const strictPhoneRegex = /^\+\d*$/;
                    if (value === '' || strictPhoneRegex.test(value)) {
                      setContactPhoneNumber(value);
                    }
                  },
                  required: true,
                  placeholder: "+421901234567", 
                  pattern: "^\\+\\d+$", 
                  title: "Telefónne číslo musí zaínať znakom '+' a obsahovať iba číslice (napr. +421901234567)" 
                })
              )
            ),
            // Text "E-mailová adresa bude slúžiť..." presunutý sem
            React.createElement("p", { className: "text-gray-600 text-sm mt-4" }, 
              is_admin_register_page 
                ? "Po odoslaní registračného formuláru už NIE JE možné zmeniť e-mailovú adresu."
                : "E-mailová adresa bude slúžiť na všetku komunikáciu súvisiacu s turnajom - zasielanie informácií, faktúr atď. Po odoslaní registračného formuláru už NIE JE možné zmeniť e-mailovú adresu."
            ),
            React.createElement("div", null,
              React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "reg-email" }, 
                is_admin_register_page ? "E-mailová adresa" : "E-mailová adresa kontaktnej osoby" 
              ),
              React.createElement("input", {
                type: "email",
                id: "reg-email",
                className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500",
                value: email,
                onChange: (e) => setEmail(e.target.value),
                required: true,
                placeholder: "Zadajte svoju e-mailovú adresu",
                autoComplete: "email"
              })
            ),
            // Text "E-mailová adresa a heslo sú potrebné..." presunutý sem
            !is_admin_register_page && (
              React.createElement("p", { className: "text-gray-600 text-sm mt-4" }, 
                "E-mailová adresa a heslo sú potrebné na editáciu údajov poskytnutých v tomto registračnom formulári a na správu turnajového účtu."
              )
            ),
            React.createElement("div", { className: "relative" },
              React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "reg-password" }, "Heslo"),
              React.createElement("input", {
                type: showConfirmPassword ? "text" : "password",
                id: "reg-password",
                className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10",
                value: password,
                onChange: (e) => setPassword(e.target.value),
                onCopy: (e) => e.preventDefault(),
                onPaste: (e) => e.preventDefault(),
                onCut: (e) => e.preventDefault(),
                required: true,
                placeholder: "Zvoľte heslo (min. 10 znakov)",
                autoComplete: "new-password"
              }),
              React.createElement("button", {
                type: "button",
                onClick: () => setShowConfirmPassword(!showConfirmPassword),
                className: "absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
              },
                showConfirmPassword ? EyeOffIcon : EyeIcon
              )
            ),
            React.createElement("div", { className: "relative" },
              React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "reg-confirm-password" }, "Potvrďte heslo"),
              React.createElement("input", {
                type: showConfirmPassword ? "text" : "password",
                id: "reg-confirm-password",
                className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10",
                value: confirmPassword,
                onChange: (e) => setConfirmPassword(e.target.value),
                onCopy: (e) => e.preventDefault(),
                onPaste: (e) => e.preventDefault(),
                onCut: (e) => e.preventDefault(),
                required: true,
                placeholder: "Potvrďte heslo",
                autoComplete: "new-password"
              }),
              React.createElement("button", {
                type: "button",
                onClick: () => setShowConfirmPassword(!showConfirmPassword),
                className: "absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
              },
                showConfirmPassword ? EyeOffIcon : EyeIcon
              )
            ),
            message && (
              React.createElement("div", { className: "bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4", role: "alert" },
                message
              )
            ),
            error && (
              React.createElement("div", { className: "bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap", role: "alert" },
                error
              )
            ),
            React.createElement("button", {
              type: "submit",
              className: "bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200",
              disabled: loading
            }, loading ? 'Registrujem...' : 'Registrovať sa')
          )
        ) : (
          React.createElement("div", { className: "text-center text-gray-700 text-lg" },
            React.createElement("p", null, "Registrácia na turnaj je momentálne uzavretá alebo ešte nezačala."),
            registrationStartDate && React.createElement("p", null, `Registrácia povolená od: ${registrationStartDate.toLocaleString('sk-SK')}`),
            registrationEndDate && React.createElement("p", null, `Registrácia povolená do: ${registrationEndDate.toLocaleString('sk-SK')}`)
          )
        )
      )
    );
  } else if (currentPath === 'login.html') {
    pageContent = React.createElement("div", { className: "w-full max-w-md p-4" },
      React.createElement("div", { className: "bg-white p-8 rounded-lg shadow-xl w-full" },
        message && (
          React.createElement("div", { className: "bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4", role: "alert" },
            message
          )
        ),
        error && (
          React.createElement("div", { className: "bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap", role: "alert" },
            error
          )
        ),

        React.createElement("h1", { className: "text-3xl font-bold text-center text-gray-800 mb-6" }, "Prihlásenie"),
        React.createElement("form", { onSubmit: handleLogin, className: "space-y-4" },
          React.createElement("div", null,
            React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "email" }, "E-mailová adresa"),
            React.createElement("input", {
              type: "email",
              id: "email",
              className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500",
              value: email,
              onChange: (e) => setEmail(e.target.value),
              required: true,
              placeholder: "Zadajte svoju e-mailovú adresu",
              autoComplete: "email"
            })
          ),
          React.createElement("div", { className: "relative" },
            React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "password" }, "Heslo"),
            React.createElement("input", {
              type: showPassword ? "text" : "password",
              id: "password",
              className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10",
              value: password,
              onChange: (e) => setPassword(e.target.value),
              onCopy: (e) => e.preventDefault(),
              onPaste: (e) => e.preventDefault(),
              onCut: (e) => e.preventDefault(),
              required: true,
              placeholder: "Zadajte heslo",
              autoComplete: "current-password"
            }),
            React.createElement("button", {
              type: "button",
              onClick: () => setShowPassword(!showPassword),
              className: "absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
            },
              showPassword ? EyeOffIcon : EyeIcon
            )
          ),
          React.createElement("button", {
            type: "submit",
            className: "bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200",
            disabled: loading
          }, loading ? 'Prihlasujem...' : 'Prihlásiť sa')
        )
      )
    );
  } else if (currentPath === 'logged-in.html') {
    if (!user) {
      // Automatické presmerovanie na login.html, ak používateľ nie je prihlásený
      window.location.href = 'login.html';
      return null; 
    }

    pageContent = (
      React.createElement("div", { className: "flex flex-grow w-full pb-10" }, 
        // Ľavé menu (fixné)
        React.createElement("div", { className: "fixed top-20 left-0 h-[calc(100vh-theme(spacing.20))] w-[271px] bg-white p-6 rounded-lg shadow-xl overflow-y-auto z-40 ml-4" }, 
          React.createElement("h2", { className: "text-2xl font-bold text-gray-800 mb-4" }, "Menu"),
          React.createElement("nav", null,
            React.createElement("ul", { className: "space-y-2" },
              React.createElement("li", null,
                React.createElement("button", {
                  onClick: () => changeProfileView('my-data'),
                  className: `w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 whitespace-nowrap ${
                    profileView === 'my-data' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'
                  }`
                }, "Moje údaje")
              ),
              React.createElement("li", null,
                React.createElement("button", {
                  onClick: () => changeProfileView('change-password'),
                  className: `w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 whitespace-nowrap ${
                    profileView === 'change-password' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'
                  }`
                }, "Zmeniť heslo")
              ),
              React.createElement("li", null,
                React.createElement("button", {
                  onClick: () => {
                    changeProfileView('change-name');
                  },
                  className: `w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 whitespace-nowrap ${
                      profileView === 'change-name' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'
                  }`
                }, "Zmeniť meno a priezvisko") 
              ),
              !isAdmin && (
                React.createElement("li", null,
                  React.createElement("button", {
                    onClick: () => changeProfileView('change-phone-number'),
                    className: `w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 whitespace-nowrap ${
                      profileView === 'change-phone-number' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'
                    }`
                  }, "Zmeniť telefónne číslo")
                )
              ),
              isAdmin && (
                React.createElement("li", null,
                  React.createElement("button", {
                    onClick: () => {
                      changeProfileView('users');
                    },
                    className: `w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 whitespace-nowrap ${
                      profileView === 'users' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'
                    }`
                  }, "Používatelia")
                )
              ),
              isAdmin && (
                React.createElement("li", null,
                  React.createElement("button", {
                    onClick: () => {
                      changeProfileView('all-teams');
                    },
                    className: `w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 whitespace-nowrap ${
                      profileView === 'all-teams' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'
                    }`
                  }, "Všetky tímy (registrácie)")
                )
              ),
              isAdmin && (
                React.createElement("li", null,
                  React.createElement("button", {
                    onClick: () => {
                      changeProfileView('settings');
                    },
                    className: `w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 whitespace-nowrap ${
                      profileView === 'settings' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'
                    }`
                  }, "Nastavenia")
                )
              )
            )
          )
        ),

        // Pravý obsah (posuvný)
        React.createElement("div", { className: "flex-grow ml-[287px] p-8 bg-white rounded-lg shadow-xl overflow-x-auto overflow-y-auto mr-4" }, 
          message && (
            React.createElement("div", { className: "bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4", role: "alert" },
              message
            )
          ),
          error && (
            React.createElement("div", { className: "bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap", role: "alert" },
              error
            )
          ),

          React.createElement("h1", { className: "text-3xl font-bold text-center text-gray-800 mb-6" }, `Vitajte, ${user.displayName || 'Používateľ'}!`),
          
          profileView === 'my-data' && (
            React.createElement("div", { className: "space-y-4 border-t pt-4 mt-4" },
              React.createElement("h2", { className: "text-xl font-semibold text-gray-800" }, "Moje údaje"),
              React.createElement("p", { className: "text-gray-700" },
                React.createElement("span", { className: "font-semibold" }, "E-mailová adresa: "), user.email || '-'
              ),
              React.createElement("p", { className: "text-gray-700" },
                React.createElement("span", { className: "font-semibold" }, "Meno a priezvisko: "), user.displayName || '-'
              ),
              !isAdmin && ( 
                React.createElement("p", { className: "text-gray-700" },
                  React.createElement("span", { className: "font-semibold" }, "Telefónne číslo: "), user.contactPhoneNumber || '-'
                )
              )
            )
          ),

          profileView === 'change-password' && (
            isEditingOpen ? (
              React.createElement("form", { onSubmit: handleChangePassword, className: "space-y-4 border-t pt-4 mt-4" },
                React.createElement("h2", { className: "text-xl font-semibold text-gray-800" }, "Zmeniť heslo"),
                React.createElement("div", { className: "relative" },
                  React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "modal-current-password-password-change" }, "Aktuálne heslo (pre overenie)"),
                  React.createElement("input", {
                    type: showCurrentPassword ? "text" : "password",
                    id: "modal-current-password-password-change",
                    className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10",
                    value: currentPassword,
                    onChange: (e) => setCurrentPassword(e.target.value),
                    onCopy: (e) => e.preventDefault(),
                    onPaste: (e) => e.preventDefault(),
                    onCut: (e) => e.preventDefault(),
                    required: true,
                    placeholder: "Zadajte svoje aktuálne heslo",
                    autoComplete: "current-password"
                  }),
                  React.createElement("button", {
                    type: "button",
                    onClick: () => setShowCurrentPassword(!showCurrentPassword),
                    className: "absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
                  },
                    showCurrentPassword ? EyeOffIcon : EyeIcon
                  )
                ),
                React.createElement("div", { className: "relative" },
                  React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "modal-new-password" }, "Nové heslo"),
                  React.createElement("input", {
                    type: showNewPassword ? "text" : "password",
                    id: "modal-new-password",
                    className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10",
                    value: newPassword,
                    onChange: (e) => setNewPassword(e.target.value),
                    onCopy: (e) => e.preventDefault(),
                    onPaste: (e) => e.preventDefault(),
                    onCut: (e) => e.preventDefault(),
                    required: true,
                    placeholder: "Zadajte nové heslo (min. 10 znakov)",
                    autoComplete: "new-password"
                  }),
                  React.createElement("button", {
                    type: "button",
                    onClick: () => setShowNewPassword(!showNewPassword),
                    className: "absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
                  },
                    showNewPassword ? EyeOffIcon : EyeIcon
                  )
                ),
                React.createElement("div", { className: "relative" },
                  React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "modal-confirm-new-password" }, "Potvrďte nové heslo"),
                  React.createElement("input", {
                    type: showConfirmNewPassword ? "text" : "password",
                    id: "modal-confirm-new-password",
                    className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10",
                    value: confirmNewPassword,
                    onChange: (e) => setConfirmNewPassword(e.target.value),
                    onCopy: (e) => e.preventDefault(),
                    onPaste: (e) => e.preventDefault(),
                    onCut: (e) => e.preventDefault(),
                    required: true,
                    placeholder: "Potvrďte heslo",
                    autoComplete: "new-password"
                  }),
                  React.createElement("button", {
                    type: "button",
                    onClick: () => setShowConfirmNewPassword(!showConfirmNewPassword),
                    className: "absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
                  },
                    showConfirmNewPassword ? EyeOffIcon : EyeIcon
                  )
                ),
                React.createElement("button", {
                  type: "submit",
                  className: "bg-orange-500 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200 mt-4",
                  disabled: loading
                }, loading ? 'Ukladám...' : 'Zmeniť heslo')
              )
            ) : (
              React.createElement("div", { className: "text-center text-gray-700 text-lg" },
                React.createElement("p", null, "Editácia údajov je momentálne uzavretá."),
                editEndDate && React.createElement("p", null, `Editácia bola povolená do: ${editEndDate.toLocaleString('sk-SK')}`)
              )
            )
          ),

          profileView === 'change-name' && (
            isEditingOpen ? (
              React.createElement("form", { onSubmit: handleChangeName, className: "space-y-4 border-t pt-4 mt-4" },
                React.createElement("h2", { className: "text-xl font-semibold text-gray-800" }, "Zmeniť meno a priezvisko"),
                React.createElement("div", null,
                  React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "new-first-name" }, "Nové meno"),
                  React.createElement("input", {
                    type: "text",
                    id: "new-first-name",
                    className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500",
                    value: newFirstName,
                    onChange: (e) => setNewFirstName(e.target.value),
                    required: true,
                    placeholder: "Zadajte nové meno",
                    autoComplete: "given-name"
                  })
                ),
                React.createElement("div", null,
                  React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "new-last-name" }, "Nové priezvisko"),
                  React.createElement("input", {
                    type: "text",
                    id: "new-last-name",
                    className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500",
                    value: newLastName,
                    onChange: (e) => setNewLastName(e.target.value),
                    required: true,
                    placeholder: "Zadajte nové priezvisko",
                    autoComplete: "family-name"
                  })
                ),
                React.createElement("div", { className: "relative" },
                  React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "current-password-name-change" }, "Aktuálne heslo (pre overenie)"),
                  React.createElement("input", {
                    type: showCurrentPassword ? "text" : "password",
                    id: "current-password-name-change",
                    className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10",
                    value: currentPassword,
                    onChange: (e) => setCurrentPassword(e.target.value),
                    onCopy: (e) => e.preventDefault(),
                    onPaste: (e) => e.preventDefault(),
                    onCut: (e) => e.preventDefault(),
                    required: true,
                    placeholder: "Zadajte svoje aktuálne heslo",
                    autoComplete: "current-password"
                  }),
                  React.createElement("button", {
                    type: "button",
                    onClick: () => setShowCurrentPassword(!showCurrentPassword),
                    className: "absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
                  },
                    showCurrentPassword ? EyeOffIcon : EyeIcon
                  )
                ),
                React.createElement("button", {
                  type: "submit",
                  className: "bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200 mt-4",
                  disabled: loading
                }, loading ? 'Ukladám...' : 'Zmeniť meno a priezvisko')
              )
            ) : (
              React.createElement("div", { className: "text-center text-gray-700 text-lg" },
                React.createElement("p", null, "Editácia údajov je momentálne uzavretá."),
                editEndDate && React.createElement("p", null, `Editácia bola povolená do: ${editEndDate.toLocaleString('sk-SK')}`)
              )
            )
          ),

          // NOVÁ SEKCIA: Zmena telefónneho čísla
          profileView === 'change-phone-number' && (
            isEditingOpen ? (
              React.createElement("form", { onSubmit: handleChangeContactPhoneNumber, className: "space-y-4 border-t pt-4 mt-4" },
                React.createElement("h2", { className: "text-xl font-semibold text-gray-800" }, "Zmeniť telefónne číslo"),
                React.createElement("div", null,
                  React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "new-contact-phone-number" }, "Nové telefónne číslo"),
                  React.createElement("input", {
                    type: "tel",
                    id: "new-contact-phone-number",
                    className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500",
                    value: newContactPhoneNumber,
                    onChange: (e) => {
                      const value = e.target.value;
                      const strictPhoneRegex = /^\+\d*$/;
                      if (value === '' || strictPhoneRegex.test(value)) {
                        setNewContactPhoneNumber(value);
                      }
                    },
                    required: true,
                    placeholder: "+421901234567",
                    pattern: "^\\+\\d+$",
                    title: "Telefónne číslo musí zaínať znakom '+' a obsahovať iba číslice (napr. +421901234567)"
                  })
                ),
                React.createElement("div", { className: "relative" },
                  React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "current-password-phone-change" }, "Aktuálne heslo (pre overenie)"),
                  React.createElement("input", {
                    type: showCurrentPassword ? "text" : "password",
                    id: "current-password-phone-change",
                    className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10",
                    value: currentPassword,
                    onChange: (e) => setCurrentPassword(e.target.value),
                    onCopy: (e) => e.preventDefault(),
                    onPaste: (e) => e.preventDefault(),
                    onCut: (e) => e.preventDefault(),
                    required: true,
                    placeholder: "Zadajte svoje aktuálne heslo",
                    autoComplete: "current-password"
                  }),
                  React.createElement("button", {
                    type: "button",
                    onClick: () => setShowCurrentPassword(!showCurrentPassword),
                    className: "absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
                  },
                    showCurrentPassword ? EyeOffIcon : EyeIcon
                  )
                ),
                React.createElement("button", {
                  type: "submit",
                  className: "bg-teal-500 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200 mt-4",
                  disabled: loading
                }, loading ? 'Ukladám...' : 'Zmeniť telefónne číslo')
              )
            ) : (
              React.createElement("div", { className: "text-center text-gray-700 text-lg" },
                React.createElement("p", null, "Editácia údajov je momentálne uzavretá."),
                editEndDate && React.createElement("p", null, `Editácia bola povolená do: ${editEndDate.toLocaleString('sk-SK')}`)
              )
            )
          ),

          profileView === 'users' && (
            React.createElement("div", { className: "space-y-4 border-t pt-4 mt-4" },
              React.createElement("h2", { className: "text-xl font-semibold text-gray-800 mb-4" }, "Zoznam používateľov (Administrácia)"),
              allUsersData.length > 0 ? (
                React.createElement("ul", { className: "divide-y divide-gray-200" },
                  allUsersData.map((u) =>
                    React.createElement("li", { key: u.uid, className: "py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between" },
                      React.createElement("div", { className: "flex-grow mb-2 sm:mb-0" },
                        React.createElement("p", { className: "text-gray-600 text-sm" }, u.email),
                        React.createElement("p", { className: "text-gray-500 text-xs" }, `Rola: ${u.role || 'user'}`), 
                        React.createElement("p", { className: "text-gray-500 text-xs" }, `Schválený: ${u.approved ? 'Áno' : 'Nie'}`) 
                      ),
                      user && user.uid !== u.uid && ( 
                        React.createElement("div", { className: "flex flex-col sm:flex-row sm:space-x-2 space-y-2 sm:space-y-0" },
                          u.role === 'admin' && u.approved === false && (
                            React.createElement("button", {
                              onClick: () => handleApproveUser(u),
                              className: "bg-green-500 hover:bg-green-700 text-white text-sm font-bold py-2 px-3 rounded-lg transition-colors duration-200"
                            }, "Povoliť používateľa")
                          ),
                          React.createElement("button", {
                            onClick: () => openRoleEditModal(u),
                            className: "bg-blue-500 hover:bg-blue-700 text-white text-sm font-bold py-2 px-3 rounded-lg transition-colors duration-200"
                          }, "Upraviť rolu"),
                          React.createElement("button", { 
                            onClick: () => openDeleteConfirmationModal(u), 
                            className: "bg-red-500 hover:bg-red-700 text-white text-sm font-bold py-2 px-3 rounded-lg transition-colors duration-200"
                          }, "Odstrániť používateľa") 
                        )
                      )
                    )
                  )
                ) : (
                  React.createElement("p", { className: "text-gray-600" }, "Žiadni používatelia na zobrazenie alebo načítavanie...")
                )
              )
            )
          ),

          // NOVÁ SEKCIA: Všetky tímy (registrácie)
          profileView === 'all-teams' && (
            React.createElement("div", { className: "space-y-4 border-t pt-4 mt-4" },
              React.createElement("h2", { className: "text-xl font-semibold text-gray-800 mb-4" }, "Všetky tímy (údaje z registračného formulára)"),
              allUsersData.length > 0 ? (
                React.createElement("div", { className: "overflow-x-auto" },
                  React.createElement("table", { className: "min-w-full bg-white border border-gray-200 rounded-lg shadow-sm" },
                    React.createElement("thead", null,
                      React.createElement("tr", { className: "bg-gray-100 border-b border-gray-200" },
                        React.createElement("th", { className: "py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider" }, "E-mail"),
                        React.createElement("th", { className: "py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider" }, "Meno kontaktnej osoby"),
                        React.createElement("th", { className: "py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider" }, "Priezvisko kontaktnej osoby"),
                        React.createElement("th", { className: "py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider" }, "Telefónne číslo"),
                        React.createElement("th", { className: "py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider" }, "Rola"),
                        React.createElement("th", { className: "py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider" }, "Schválený")
                      )
                    ),
                    React.createElement("tbody", { className: "divide-y divide-gray-200" },
                      allUsersData.map((u) => (
                        React.createElement("tr", { key: u.uid, className: "hover:bg-gray-50" },
                          React.createElement("td", { className: "py-3 px-4 whitespace-nowrap text-sm text-gray-800" }, u.email),
                          React.createElement("td", { className: "py-3 px-4 whitespace-nowrap text-sm text-gray-800" }, u.firstName || '-'),
                          React.createElement("td", { className: "py-3 px-4 whitespace-nowrap text-sm text-gray-800" }, u.lastName || '-'),
                          React.createElement("td", { className: "py-3 px-4 whitespace-nowrap text-sm text-gray-800" }, u.contactPhoneNumber || '-'),
                          React.createElement("td", { className: "py-3 px-4 whitespace-nowrap text-sm text-gray-800" }, u.role || 'user'),
                          React.createElement("td", { className: "py-3 px-4 whitespace-nowrap text-sm text-gray-800" }, u.approved ? 'Áno' : 'Nie')
                        )
                      ))
                    )
                  )
                ) : (
                  React.createElement("p", { className: "text-gray-600" }, "Žiadne registračné údaje na zobrazenie alebo načítavanie...")
                )
              )
            )
          ),

          // NOVÁ SEKCIA: Nastavenia (len pre admina)
          profileView === 'settings' && isAdmin && (
            React.createElement("div", { className: "space-y-4 border-t pt-4 mt-4" },
              React.createElement("h2", { className: "text-xl font-semibold text-gray-800 mb-4" }, "Nastavenia turnaja"),
              React.createElement("form", { onSubmit: handleSaveSettings, className: "space-y-4" },
                React.createElement("div", null,
                  React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "registration-start-date" }, "Registrácia povolená od:"), 
                  React.createElement("input", {
                    type: "datetime-local",
                    id: "registration-start-date",
                    className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500",
                    value: tempRegistrationStartDate, 
                    onChange: (e) => setTempRegistrationStartDate(e.target.value), 
                    required: true
                  })
                ),
                React.createElement("div", null,
                  React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "registration-end-date" }, "Registrácia povolená do:"),
                  React.createElement("input", {
                    type: "datetime-local",
                    id: "registration-end-date",
                    className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500",
                    value: tempRegistrationEndDate, 
                    onChange: (e) => setTempRegistrationEndDate(e.target.value), 
                    required: true
                  })
                ),
                React.createElement("div", null,
                  React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "edit-end-date" }, "Editácia údajov povolená do:"),
                  React.createElement("input", {
                    type: "datetime-local",
                    id: "edit-end-date",
                    className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500",
                    value: tempEditEndDate, 
                    onChange: (e) => setTempEditEndDate(e.target.value), 
                    required: true
                  })
                ),
                React.createElement("button", {
                  type: "submit",
                  className: "bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200 mt-4",
                  disabled: loading
                }, loading ? 'Ukladám nastavenia...' : 'Uložiť nastavenia')
              )
            )
          )
        )
      )
    );
  }

  return (
    React.createElement("div", { className: "min-h-screen bg-gray-100 flex flex-col font-inter overflow-y-auto" },
      React.createElement(Header, { user: user, isAdmin: isAdmin, handleLogout: handleLogout, isAuthReady: isAuthReady }),
      React.createElement("div", { className: "flex-grow pt-20 flex justify-center items-start" }, // Pridané pt-20 a flex pre centrovanie
        pageContent
      ),

      // Modálne okno pre potvrdenie odstránenia
      showDeleteConfirmationModal && (
        React.createElement("div", { className: "fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center z-50" },
          React.createElement("div", { className: "relative p-5 border w-96 shadow-lg rounded-md bg-white" },
            React.createElement("h3", { className: "text-lg font-bold text-gray-900 mb-4" }, "Potvrdiť odstránenie"), 
            React.createElement("p", { className: "text-gray-700 mb-6" }, `Naozaj chcete natrvalo odstrániť používateľa ${userToDelete?.email} z databázy? Táto akcia je nezvratná.`), 
            React.createElement("div", { className: "flex justify-end space-x-4" },
              React.createElement("button", {
                onClick: closeDeleteConfirmationModal,
                className: "px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors duration-200"
              }, "Zrušiť"),
              React.createElement("button", {
                onClick: handleDeleteUser,
                className: "px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200",
                disabled: loading
              }, loading ? 'Odstraňujem...' : 'Odstrániť') 
            )
          )
        )
      ),

      // Modálne okno pre úpravu roly
      showRoleEditModal && (
        React.createElement("div", { className: "fixed inset-0 bg-gray-600 bg-opacity50 overflow-y-auto h-full w-full flex justify-center items-center z-50" },
          React.createElement("div", { className: "relative p-5 border w-96 shadow-lg rounded-md bg-white" },
            React.createElement("h3", { className: "text-lg font-bold text-gray-900 mb-4" }, `Upraviť rolu pre ${userToEditRole?.email}`),
            React.createElement("div", { className: "mb-4" },
              React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "new-user-role" }, "Nová rola"),
              React.createElement("select", {
                id: "new-user-role",
                className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500",
                value: newRole,
                onChange: (e) => setNewRole(e.target.value)
              },
                React.createElement("option", { value: "user" }, "Používateľ"),
                React.createElement("option", { value: "admin" }, "Administrátor")
              )
            ),
            React.createElement("div", { className: "flex justify-end space-x-4" },
              React.createElement("button", {
                onClick: closeRoleEditModal,
                className: "px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors duration-200"
              }, "Zrušiť"),
              React.createElement("button", {
                onClick: handleUpdateUserRole,
                className: "px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200",
                disabled: loading
              }, loading ? 'Ukladám...' : 'Uložiť')
            )
          )
        )
      )
    )
  );
}
