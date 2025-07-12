// App.js (Hlavný, samostatný súbor)

// Odstránené všetky importy pre lokálne súbory, pretože všetok kód je teraz v tomto súbore.
// Firebase SDKs, React a ReactDOM sa načítavajú globálne z CDN v index.html.

// Global variables provided by the Canvas environment (používame ich priamo)
// Ak toto spúšťate priamo na GitHub Pages, tieto premenné nebudú definované.
// Pre funkčnosť ich preto definujeme pevne.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = {
  apiKey: "AIzaSyDj_bSTkjrquu1nyIVYW7YLbyBl1pD6YYo",
  authDomain: "prihlasovanie-4f3f3.firebaseapp.com",
  projectId: "prihlasovanie-4f3f3",
  storageBucket: "prihlasovanie-4f3f3.firebasestorage.app",
  messagingSenderId: "26454452024",
  appId: "1:26454452024:web:6954b4f90f87a3a1eb43cd"
};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// reCAPTCHA Site Key - NAHRADENE S VASIM SKUTOCNYM SITE KEYOM!
const RECAPTCHA_SITE_KEY = "6LdJbn8rAAAAAO4C50qXTWva6ePzDlOfYwBDEDwa"; // Váš skutočný SITE KEY
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzPbN2BL4t9qRxRVmJs2CH6OGex-l-z21lg7_ULUH3249r93GKV_4B_Oenf6ydz0CyKrA/exec";

// --- Pomocné ikony (pôvodne z utils/icons.js) ---
const EyeIcon = React.createElement("svg", { className: "h-5 w-5 text-gray-500", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor" },
  React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M15 12a3 3 0 11-6 0 3 3 0 016 0z" }),
  React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" })
);

const EyeOffIcon = React.createElement("svg", { className: "h-5 w-5 text-gray-500", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor" },
  React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.274-4.057 5.064-7 9.542-7a9.95 9.95 0 011.875.175m.001 0V5m0 14v-2.175m0-10.65L12 12m-6.25 6.25L12 12m0 0l6.25-6.25M12 12l-6.25-6.25" })
);

// --- Pomocné funkcie (pôvodne z utils/helpers.js) ---
const formatToDateTimeLocal = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const year = String(d.getFullYear());
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// --- AuthContext Logic (pôvodne z AuthContext.js) ---
const AuthContext = React.createContext();

const AuthProvider = ({ children }) => {
  const [app, setApp] = React.useState(null);
  const [auth, setAuth] = React.useState(null);
  const [db, setDb] = React.useState(null);
  const [user, setUser] = React.useState(null);
  const [isAuthReady, setIsAuthReady] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [allUsersData, setAllUsersData] = React.useState([]);

  // Tournament settings states
  const [registrationStartDate, setRegistrationStartDate] = React.useState(null);
  const [registrationEndDate, setRegistrationEndDate] = React.useState(null);
  const [editEndDate, setEditEndDate] = React.useState(null);
  const [isRegistrationOpen, setIsRegistrationOpen] = React.useState(false);
  const [isEditingOpen, setIsEditingOpen] = React.useState(false);

  // Clear messages after a delay
  const clearMessages = React.useCallback(() => {
    setTimeout(() => {
      setMessage('');
      setError('');
    }, 5000);
  }, []);

  // Password validation function
  const validatePassword = (pwd) => {
    const errors = [];
    if (pwd.length < 10) errors.push("minimálne 10 znakov");
    if (pwd.length > 4096) errors.push("maximálne 4096 znakov");
    if (!/[A-Z]/.test(pwd)) errors.push("aspoň jedno veľké písmeno");
    if (!/[a-z]/.test(pwd)) errors.push("aspoň jedno malé písmeno");
    if (!/[0-9]/.test(pwd)) errors.push("aspoň jednu číslicu");
    return errors.length === 0 ? null : "Heslo musí obsahovať:\n• " + errors.join("\n• ") + ".";
  };

  // reCAPTCHA v3 token acquisition
  const getRecaptchaToken = React.useCallback(async (action) => {
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
  }, []);

  // Firebase Initialization and Auth State Listener
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
      setDb(firebase.firestore(firebaseApp));

      const signIn = async () => {
        try {
          if (initialAuthToken) {
            await authInstance.signInWithCustomToken(initialAuthToken);
          } else {
            // No anonymous sign-in by default
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
        if (loading) setLoading(false);

        if (currentUser) {
          // Fetch user's role from Firestore
          const userDocRef = firebase.firestore(firebaseApp).collection('users').doc(currentUser.uid);
          const userDoc = await userDocRef.get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            setIsAdmin(userData.role === 'admin');
            // Update user object with custom data
            setUser(prevUser => ({ ...prevUser, ...userData }));
          } else {
            setIsAdmin(false);
          }
        } else {
          setIsAdmin(false);
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

  // Fetch tournament settings and users on auth ready
  React.useEffect(() => {
    if (isAuthReady && db) {
      const settingsDocRef = db.collection('settings').doc('tournamentSettings');
      const unsubscribeSettings = settingsDocRef.onSnapshot((doc) => {
        if (doc.exists) {
          const settings = doc.data();
          setRegistrationStartDate(settings.registrationStartDate ? settings.registrationStartDate.toDate() : null);
          setRegistrationEndDate(settings.registrationEndDate ? settings.registrationEndDate.toDate() : null);
          setEditEndDate(settings.editEndDate ? settings.editEndDate.toDate() : null);

          const now = new Date();
          setIsRegistrationOpen(now >= (settings.registrationStartDate?.toDate() || new Date(0)) && now <= (settings.registrationEndDate?.toDate() || new Date(8640000000000000)));
          setIsEditingOpen(now <= (settings.editEndDate?.toDate() || new Date(8640000000000000)));
        }
      }, (err) => {
        console.error("Error fetching settings:", err);
        setError("Chyba pri načítaní nastavení turnaja.");
      });

      // Fetch all users for admin panel
      const usersCollectionRef = db.collection('users');
      const unsubscribeUsers = usersCollectionRef.onSnapshot((snapshot) => {
        const usersList = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
        setAllUsersData(usersList);
      }, (err) => {
        console.error("Error fetching users:", err);
        setError("Chyba pri načítaní zoznamu používateľov.");
      });

      return () => {
        unsubscribeSettings();
        unsubscribeUsers();
      };
    }
  }, [isAuthReady, db]);

  // --- Authentication Handlers ---
  const handleRegister = React.useCallback(async (email, password, confirmPassword, firstName, lastName, contactPhoneNumber, isAdminRegistration = false) => {
    if (!auth || !db) {
      setError("Firebase Auth/Firestore nie je inicializovaný.");
      return false;
    }
    if (!email || !password || !confirmPassword || !firstName || !lastName || !contactPhoneNumber) {
      setError("Prosím, vyplňte všetky polia.");
      return false;
    }
    if (password !== confirmPassword) {
      setError("Heslá sa nezhodujú. Prosím, skontrolujte ich.");
      return false;
    }
    if (email.includes(' ')) {
      setError("E-mail nesmie obsahovať medzery.");
      return false;
    }
    if (firstName.includes(' ') || lastName.includes(' ')) {
      setError("Meno a priezvisko nesmú obsahovať medzery.");
      return false;
    }
    if (!contactPhoneNumber.match(/^\+\d+$/)) {
      setError("Telefónne číslo musí začínať '+' a obsahovať iba číslice.");
      return false;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return false;
    }

    const recaptchaToken = await getRecaptchaToken('register');
    if (!recaptchaToken) {
      setError("Overenie reCAPTCHA zlyhalo. Prosím, skúste to znova.");
      return false;
    }

    setLoading(true);
    try {
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      const newUser = userCredential.user;

      // Save user data to Firestore
      const userDocRef = db.collection('users').doc(newUser.uid);
      await userDocRef.set({
        email: newUser.email,
        firstName,
        lastName,
        contactPhoneNumber,
        role: isAdminRegistration ? 'admin' : 'user',
        approved: isAdminRegistration ? false : true, // Admin accounts need approval
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      await newUser.updateProfile({ displayName: `${firstName} ${lastName}` });

      setMessage("Registrácia úspešná!");
      setError('');

      // Send email via Google Apps Script
      await fetch(GOOGLE_APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newUser.email,
          firstName,
          lastName,
          contactPhoneNumber,
          isAdmin: isAdminRegistration
        })
      });

      return true;
    } catch (e) {
      console.error("Chyba pri registrácii:", e);
      if (e.code === 'auth/email-already-in-use') {
        setError("E-mail už existuje. Prosím, zvoľte iný.");
      } else if (e.code === 'auth/weak-password') {
        setError("Heslo je príliš slabé. " + validatePassword(password));
      } else {
        setError(`Chyba pri registrácii: ${e.message}`);
      }
      return false;
    } finally {
      setLoading(false);
      clearMessages();
    }
  }, [auth, db, getRecaptchaToken, clearMessages, validatePassword]);

  const handleLogin = React.useCallback(async (email, password) => {
    if (!auth || !db) {
      setError("Firebase Auth/Firestore nie je inicializovaný.");
      return false;
    }
    if (!email || !password) {
      setError("Prosím, vyplňte e-mail a heslo.");
      return false;
    }

    const recaptchaToken = await getRecaptchaToken('login');
    if (!recaptchaToken) {
      setError("Overenie reCAPTCHA zlyhalo. Prosím, skúste to znova.");
      return false;
    }

    setLoading(true);
    try {
      const userCredential = await auth.signInWithEmailAndPassword(email, password);
      const loggedInUser = userCredential.user;

      // Fetch user's data from Firestore to check approval status
      const userDocRef = db.collection('users').doc(loggedInUser.uid);
      const userDoc = await userDocRef.get();

      if (userDoc.exists) {
        const userData = userDoc.data();
        if (!userData.approved && userData.role === 'admin') {
          await auth.signOut(); // Log out unapproved admin
          setError("Váš administrátorský účet ešte nebol schválený. Kontaktujte prosím hlavného administrátora.");
          return false;
        }
        setMessage("Prihlásenie úspešné!");
        setError('');
        return true;
      } else {
        await auth.signOut(); // Log out if no Firestore data
        setError("Používateľské údaje neboli nájdené. Prosím, kontaktujte podporu.");
        return false;
      }
    } catch (e) {
      console.error("Chyba pri prihlasovaní:", e);
      if (e.code === 'auth/invalid-credential' || e.code === 'auth/invalid-login-credentials' || e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password') {
        setError("Nesprávny e-mail alebo heslo. Skontrolujte svoje údaje a skúste to znova.");
      } else {
        setError(`Chyba pri prihlasovaní: ${e.message}`);
      }
      return false;
    } finally {
      setLoading(false);
      clearMessages();
    }
  }, [auth, db, getRecaptchaToken, clearMessages]);

  const handleLogout = React.useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    try {
      await auth.signOut();
      setMessage("Úspešne odhlásené.");
      setError('');
      window.location.href = 'login.html'; // Redirect to login page
    } catch (e) {
      console.error("Chyba pri odhlasovaní:", e);
      setError(`Chyba pri odhlasovaní: ${e.message}`);
    } finally {
      setLoading(false);
      clearMessages();
    }
  }, [auth, clearMessages]);

  const reauthenticateUser = React.useCallback(async (currentPassword) => {
    if (!user || !user.email) {
      setError("Nie ste prihlásený alebo váš e-mail nie je dostupný.");
      return false;
    }
    if (!currentPassword) {
      setError("Pre overenie je potrebné zadať aktuálne heslo.");
      return false;
    }

    try {
      setLoading(true);
      const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
      await user.reauthenticateWithCredential(credential);
      return true;
    } catch (e) {
      console.error("Chyba pri opätovnom overení:", e);
      if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        setError("Nesprávne aktuálne heslo. Prosím, zadajte správne heslo pre overenie.");
      } else if (e.code === 'auth/requires-recent-login') {
        setError("Pre túto akciu sa musíte znova prihlásiť. Prosím, odhláste sa a znova prihláste.");
      } else {
        setError(`Chyba pri opätovnom overení: ${e.message}`);
      }
      return false;
    } finally {
      setLoading(false);
      clearMessages();
    }
  }, [user, clearMessages]);

  const handleChangePassword = React.useCallback(async (newPassword, confirmNewPassword, currentPassword) => {
    if (!user) {
      setError("Nie ste prihlásený.");
      return false;
    }
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setError("Prosím, vyplňte všetky polia.");
      return false;
    }
    if (newPassword !== confirmNewPassword) {
      setError("Nové heslá sa nezhodujú. Prosím, skontrolujte ich.");
      return false;
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      return false;
    }

    const reauthenticated = await reauthenticateUser(currentPassword);
    if (!reauthenticated) return false;

    try {
      setLoading(true);
      await user.updatePassword(newPassword);
      setMessage("Heslo úspešne zmenené!");
      setError('');
      return true;
    } catch (e) {
      console.error("Chyba pri zmene hesla:", e);
      setError(`Chyba pri zmene hesla: ${e.message}`);
      return false;
    } finally {
      setLoading(false);
      clearMessages();
    }
  }, [user, reauthenticateUser, clearMessages, validatePassword]);

  const handleChangeName = React.useCallback(async (newFirstName, newLastName, currentPassword) => {
    if (!user || !db) {
      setError("Nie ste prihlásený alebo Firestore nie je inicializovaný.");
      return false;
    }
    if (!newFirstName || !newLastName || !currentPassword) {
      setError("Prosím, vyplňte všetky polia.");
      return false;
    }
    if (newFirstName.includes(' ') || newLastName.includes(' ')) {
      setError("Meno a priezvisko nesmú obsahovať medzery.");
      return false;
    }

    const reauthenticated = await reauthenticateUser(currentPassword);
    if (!reauthenticated) return false;

    setLoading(true);
    try {
      // Update display name in Auth
      await user.updateProfile({ displayName: `${newFirstName} ${newLastName}` });

      // Update name in Firestore user document
      const userDocRef = db.collection('users').doc(user.uid);
      await userDocRef.update({
        firstName: newFirstName,
        lastName: newLastName
      });

      setMessage("Meno a priezvisko úspešne zmenené!");
      setError('');
      // Update local user state
      setUser(prevUser => ({ ...prevUser, displayName: `${newFirstName} ${newLastName}`, firstName: newFirstName, lastName: newLastName }));
      return true;
    } catch (e) {
      console.error("Chyba pri zmene mena:", e);
      setError(`Chyba pri zmene mena: ${e.message}`);
      return false;
    } finally {
      setLoading(false);
      clearMessages();
    }
  }, [user, db, reauthenticateUser, clearMessages]);

  const handleChangeContactPhoneNumber = React.useCallback(async (newContactPhoneNumber, currentPassword) => {
    if (!user || !db) {
      setError("Nie ste prihlásený alebo Firestore nie je inicializovaný.");
      return false;
    }
    if (!newContactPhoneNumber || !currentPassword) {
      setError("Prosím, vyplňte nové telefónne číslo a aktuálne heslo.");
      return false;
    }
    if (!newContactPhoneNumber.match(/^\+\d+$/)) {
      setError("Telefónne číslo musí začínať '+' a obsahovať iba číslice.");
      return false;
    }

    const reauthenticated = await reauthenticateUser(currentPassword);
    if (!reauthenticated) return false;

    setLoading(true);
    try {
      const userDocRef = db.collection('users').doc(user.uid);
      await userDocRef.update({
        contactPhoneNumber: newContactPhoneNumber
      });
      setMessage("Telefónne číslo úspešne zmenené!");
      setError('');
      // Update local user state
      setUser(prevUser => ({ ...prevUser, contactPhoneNumber: newContactPhoneNumber }));
      return true;
    } catch (e) {
      console.error("Chyba pri zmene telefónneho čísla:", e);
      setError(`Chyba pri zmene telefónneho čísla: ${e.message}`);
      return false;
    } finally {
      setLoading(false);
      clearMessages();
    }
  }, [user, db, reauthenticateUser, clearMessages]);

  const fetchAllUsers = React.useCallback(async () => {
    if (!db || !isAdmin) {
      setError("Nemáte oprávnenie na zobrazenie zoznamu používateľov.");
      return;
    }
    setLoading(true);
    try {
      const usersSnapshot = await db.collection('users').get();
      const usersList = usersSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
      setAllUsersData(usersList);
      setError('');
    } catch (e) {
      console.error("Chyba pri načítaní všetkých používateľov:", e);
      setError(`Chyba pri načítaní používateľov: ${e.message}`);
    } finally {
      setLoading(false);
      clearMessages();
    }
  }, [db, isAdmin, clearMessages]);

  const handleDeleteUser = React.useCallback(async (userToDelete) => {
    if (!db || !isAdmin || !auth) {
      setError("Nemáte oprávnenie na odstránenie používateľa.");
      return;
    }
    if (!userToDelete || !userToDelete.uid) {
      setError("Používateľ na odstránenie nie je platný.");
      return;
    }
    if (user.uid === userToDelete.uid) {
      setError("Nemôžete odstrániť svoj vlastný účet cez administráciu.");
      return;
    }

    setLoading(true);
    try {
      // Delete user from Firestore first
      await db.collection('users').doc(userToDelete.uid).delete();
      setMessage(`Používateľ ${userToDelete.email} bol úspešne odstránený z Firestore.`);
      // Note: Deleting from Auth needs a Cloud Function or Admin SDK on a server.
      // For this client-side app, we rely on the Cloud Function to delete from Auth.
      // If no Cloud Function, you would need to implement a server-side call here.
      setMessage(`Používateľ ${userToDelete.email} bol úspešne odstránený.`);
      // Update local state
      setAllUsersData(prevData => prevData.filter(u => u.uid !== userToDelete.uid));
      setError('');
    } catch (e) {
      console.error("Chyba pri odstraňovaní používateľa:", e);
      setError(`Chyba pri odstraňovaní používateľa: ${e.message}`);
    } finally {
      setLoading(false);
      clearMessages();
    }
  }, [db, isAdmin, auth, user, clearMessages]);

  const handleUpdateUserRole = React.useCallback(async (userToUpdate, role) => {
    if (!db || !isAdmin) {
      setError("Nemáte oprávnenie na zmenu roly používateľa.");
      return;
    }
    if (!userToUpdate || !userToUpdate.uid || !role) {
      setError("Používateľ alebo rola nie sú platné.");
      return;
    }
    if (user.uid === userToUpdate.uid) {
      setError("Nemôžete zmeniť svoju vlastnú rolu cez administráciu.");
      return;
    }

    setLoading(true);
    try {
      const userDocRef = db.collection('users').doc(userToUpdate.uid);
      await userDocRef.update({ role: role });
      setMessage(`Rola používateľa ${userToUpdate.email} bola úspešne zmenená na ${role}.`);
      setError('');
      // Update local state
      setAllUsersData(prevData => prevData.map(u => u.uid === userToUpdate.uid ? { ...u, role: role } : u));
    } catch (e) {
      console.error("Chyba pri aktualizácii roly používateľa:", e);
      setError(`Chyba pri aktualizácii roly: ${e.message}`);
    } finally {
      setLoading(false);
      clearMessages();
    }
  }, [db, isAdmin, user, clearMessages]);

  const handleApproveUser = React.useCallback(async (userToApprove) => {
    if (!db || !isAdmin) {
      setError("Nemáte oprávnenie na schválenie používateľa.");
      return;
    }
    if (!userToApprove || !userToApprove.uid) {
      setError("Používateľ na schválenie nie je platný.");
      return;
    }

    setLoading(true);
    try {
      const userDocRef = db.collection('users').doc(userToApprove.uid);
      await userDocRef.update({ approved: true });
      setMessage(`Používateľ ${userToApprove.email} bol úspešne schválený.`);
      setError('');
      // Update local state
      setAllUsersData(prevData => prevData.map(u => u.uid === userToApprove.uid ? { ...u, approved: true } : u));
    } catch (e) {
      console.error("Chyba pri schvaľovaní používateľa:", e);
      setError(`Chyba pri schvaľovaní používateľa: ${e.message}`);
    } finally {
      setLoading(false);
      clearMessages();
    }
  }, [db, isAdmin, clearMessages]);

  const handleSaveSettings = React.useCallback(async (regStartDate, regEndDate, edDate) => {
    if (!db || !isAdmin) {
      setError("Nemáte oprávnenie na uloženie nastavení.");
      return;
    }
    if (!regStartDate || !regEndDate || !edDate) {
      setError("Prosím, vyplňte všetky dátumy nastavení.");
      return;
    }
    if (regStartDate > regEndDate) {
      setError("Dátum začiatku registrácie nemôže byť po dátume konca registrácie.");
      return;
    }
    if (regEndDate < regStartDate) {
      setError("Dátum konca registrácie nemôže byť pred dátumom začiatku registrácie.");
      return;
    }
    if (edDate < regEndDate) {
      setError("Dátum konca editácie nemôže byť pred dátumom konca registrácie.");
      return;
    }

    setLoading(true);
    try {
      const settingsDocRef = db.collection('settings').doc('tournamentSettings');
      await settingsDocRef.set({
        registrationStartDate: firebase.firestore.Timestamp.fromDate(regStartDate),
        registrationEndDate: firebase.firestore.Timestamp.fromDate(regEndDate),
        editEndDate: firebase.firestore.Timestamp.fromDate(edDate)
      }, { merge: true });
      setMessage("Nastavenia turnaja boli úspešne uložené!");
      setError('');
    } catch (e) {
      console.error("Chyba pri ukladaní nastavení:", e);
      setError(`Chyba pri ukladaní nastavení: ${e.message}`);
    } finally {
      setLoading(false);
      clearMessages();
    }
  }, [db, isAdmin, clearMessages]);

  return (
    React.createElement(AuthContext.Provider, { value: {
      app, auth, db, user, isAdmin, loading, message, error, isAuthReady,
      allUsersData, registrationStartDate, registrationEndDate, editEndDate,
      isRegistrationOpen, isEditingOpen,
      handleLogin, handleRegister, handleLogout,
      handleChangePassword, handleChangeName, handleChangeContactPhoneNumber,
      fetchAllUsers, handleDeleteUser, handleUpdateUserRole, handleApproveUser, handleSaveSettings,
      setMessage, setError, setLoading, setAllUsersData, // Expose setters for direct manipulation if needed
      formatToDateTimeLocal // Expose helper function
    }}, children)
  );
};

const useAuth = () => React.useContext(AuthContext);
// --- End AuthContext Logic ---

// --- Komponenty (pôvodne zo samostatných súborov) ---

// components/Header.js
const Header = ({ user, isAdmin, handleLogout, isAuthReady }) => {
  const currentPath = window.location.pathname.split('/').pop();
  const isHomePage = currentPath === '' || currentPath === 'index.html';
  const isLoginPage = currentPath === 'login.html';
  const isRegisterPage = currentPath === 'register.html';
  const isAdminRegisterPage = currentPath === 'admin-register.html';

  return (
    React.createElement("header", { className: "w-full bg-blue-700 text-white p-4 shadow-md fixed top-0 left-0 right-0 z-20 flex justify-between items-center" },
      React.createElement("div", { className: "flex items-center space-x-6" },
        React.createElement("a", {
          href: "index.html",
          className: "text-lg font-semibold hover:text-blue-200 transition-colors duration-200"
        }, "Domov"),
        !user && !isRegisterPage && !isAdminRegisterPage && React.createElement("a", {
          href: "register.html",
          className: "text-lg font-semibold hover:text-blue-200 transition-colors duration-200"
        }, "Registrácia na turnaj")
      ),
      React.createElement("div", { className: "flex items-center space-x-6" },
        user && React.createElement("a", {
          href: "logged-in.html",
          className: "text-lg font-semibold hover:text-blue-200 transition-colors duration-200"
        }, "Moja zóna"),
        !user && !isLoginPage && React.createElement("a", {
          href: "login.html",
          className: "text-lg font-semibold hover:text-blue-200 transition-colors duration-200"
        }, "Prihlásenie"),
        user && React.createElement("button", {
          onClick: handleLogout,
          className: "text-lg font-semibold hover:text-blue-200 transition-colors duration-200"
        }, "Odhlásenie")
      )
    )
  );
};

// pages/HomePage.js
const HomePage = () => {
  return (
    React.createElement("div", { className: "flex items-center justify-center min-h-[calc(100vh-theme(spacing.20))] w-full" },
      React.createElement("div", { className: "text-3xl font-bold text-gray-800" },
        "Vitajte na stránke Slovak Open Handball 2025"
      )
    )
  );
};

// pages/RegisterPage.js
const RegisterPage = ({ isAdminRegisterPage = false }) => {
  const { loading, error, message, handleRegister, isRegistrationOpen, registrationStartDate, registrationEndDate, setError } = useAuth();

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [contactPhoneNumber, setContactPhoneNumber] = React.useState('');

  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    const success = await handleRegister(email, password, confirmPassword, firstName, lastName, contactPhoneNumber, isAdminRegisterPage);
    if (success) {
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setFirstName('');
      setLastName('');
      setContactPhoneNumber('');
    }
  };

  return (
    React.createElement("div", { className: "w-full max-w-md my-8 p-4" },
      React.createElement("div", { className: "bg-white p-8 rounded-lg shadow-xl w-full" },
        React.createElement("h1", { className: "text-3xl font-bold text-center text-gray-800 mb-6" },
          isAdminRegisterPage ? "Registrácia administrátora" : "Registrácia na turnaj"
        ),

        !isAdminRegisterPage && !isRegistrationOpen ? (
          React.createElement("div", { className: "text-center text-red-600 text-lg" },
            React.createElement("p", null, "Registrácia je momentálne uzavretá."),
            registrationStartDate && registrationEndDate && React.createElement("p", null, `Registrácia je povolená od ${registrationStartDate.toLocaleString('sk-SK')} do ${registrationEndDate.toLocaleString('sk-SK')}.`)
          )
        ) : (
          React.createElement("form", { onSubmit: onSubmit, className: "space-y-4" },
            React.createElement("div", null,
              React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "email" }, "E-mail"),
              React.createElement("input", {
                type: "email",
                id: "email",
                className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500",
                value: email,
                onChange: (e) => setEmail(e.target.value.replace(/\s/g, '')),
                required: true,
                placeholder: "Zadajte e-mail",
                autoComplete: "email"
              })
            ),
            React.createElement("div", { className: "relative" },
              React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "password" }, "Heslo"),
              React.createElement("input", {
                type: showPassword ? "text" : "password",
                id: "password",
                className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10",
                value: password,
                onChange: (e) => setPassword(e.target.value),
                onCopy: (e) => e.preventDefault(),
                onPaste: (e) => e.preventDefault(),
                onCut: (e) => e.preventDefault(),
                required: true,
                placeholder: "Zadajte heslo (min. 10 znakov)",
                autoComplete: "new-password"
              }),
              React.createElement("button", {
                type: "button",
                onClick: () => setShowPassword(!showPassword),
                className: "absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
              },
                showPassword ? EyeOffIcon : EyeIcon
              )
            ),
            React.createElement("div", { className: "relative" },
              React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "confirm-password" }, "Potvrďte heslo"),
              React.createElement("input", {
                type: showConfirmPassword ? "text" : "password",
                id: "confirm-password",
                className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10",
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
            React.createElement("div", null,
              React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "first-name" }, "Meno kontaktnej osoby"),
              React.createElement("input", {
                type: "text",
                id: "first-name",
                className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500",
                value: firstName,
                onChange: (e) => setFirstName(e.target.value.replace(/\s/g, '')),
                required: true,
                placeholder: "Zadajte meno",
                autoComplete: "given-name"
              })
            ),
            React.createElement("div", null,
              React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "last-name" }, "Priezvisko kontaktnej osoby"),
              React.createElement("input", {
                type: "text",
                id: "last-name",
                className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500",
                value: lastName,
                onChange: (e) => setLastName(e.target.value.replace(/\s/g, '')),
                required: true,
                placeholder: "Zadajte priezvisko",
                autoComplete: "family-name"
              })
            ),
            React.createElement("div", null,
              React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "contact-phone-number" }, "Telefónne číslo kontaktnej osoby"),
              React.createElement("input", {
                type: "tel",
                id: "contact-phone-number",
                className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500",
                value: contactPhoneNumber,
                onChange: (e) => {
                  const value = e.target.value;
                  if (value === '') {
                    setContactPhoneNumber('');
                    setError('');
                  } else if (value[0] !== '+') {
                    setError("Telefónne číslo musí začínať znakom +.");
                    setContactPhoneNumber(value);
                  } else if (!/^\+\d*$/.test(value)) {
                    setError("Telefónne číslo musí zaínať znakom '+' a obsahovať iba číslice (napr. +421901234567).");
                    setContactPhoneNumber(value);
                  } else {
                    setContactPhoneNumber(value);
                    setError('');
                  }
                },
                required: true,
                placeholder: "+421901234567",
                pattern: "^\\+\\d+$",
                title: "Telefónne číslo musí zaínať znakom '+' a obsahovať iba číslice (napr. +421901234567)"
              })
            ),
            React.createElement("button", {
              type: "submit",
              className: "bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200 mt-4",
              disabled: loading
            }, loading ? 'Registrujem...' : 'Registrovať sa')
          )
        )
      )
    )
  );
};

// pages/LoginPage.js
const LoginPage = () => {
  const { loading, error, message, handleLogin, setError } = useAuth();

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    const success = await handleLogin(email, password);
    if (success) {
      setEmail('');
      setPassword('');
      window.location.href = 'logged-in.html'; // Presmerovanie po úspešnom prihlásení
    }
  };

  return (
    React.createElement("div", { className: "w-full max-w-md my-8 p-4" },
      React.createElement("div", { className: "bg-white p-8 rounded-lg shadow-xl w-full" },
        React.createElement("h1", { className: "text-3xl font-bold text-center text-gray-800 mb-6" }, "Prihlásenie"),
        React.createElement("form", { onSubmit: onSubmit, className: "space-y-4" },
          React.createElement("div", null,
            React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "email" }, "E-mail"),
            React.createElement("input", {
              type: "email",
              id: "email",
              className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500",
              value: email,
              onChange: (e) => setEmail(e.target.value),
              required: true,
              placeholder: "Zadajte e-mail",
              autoComplete: "email"
            })
          ),
          React.createElement("div", { className: "relative" },
            React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "password" }, "Heslo"),
            React.createElement("input", {
              type: showPassword ? "text" : "password",
              id: "password",
              className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10",
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
            className: "bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200 mt-4",
            disabled: loading
          }, loading ? 'Prihlasujem...' : 'Prihlásiť sa')
        ),
      )
    )
  );
};

// components/profile/MyData.js
const MyData = () => {
  const { user, isAdmin } = useAuth();

  if (!user) {
    return React.createElement("div", { className: "text-center text-gray-700 text-lg" }, "Nie ste prihlásený.");
  }

  return (
    React.createElement("div", { className: "space-y-4" },
      React.createElement("h2", { className: "text-xl font-semibold text-gray-800" }, "Moje údaje"),
      React.createElement("div", { className: "bg-gray-50 p-4 rounded-lg shadow-sm" },
        React.createElement("p", { className: "text-gray-700" },
          React.createElement("strong", null, "E-mail:"), " ", user.email
        ),
        React.createElement("p", { className: "text-gray-700" },
          React.createElement("strong", null, "Meno:"), " ", user.firstName || 'N/A'
        ),
        React.createElement("p", { className: "text-gray-700" },
          React.createElement("strong", null, "Priezvisko:"), " ", user.lastName || 'N/A'
        ),
        React.createElement("p", { className: "text-gray-700" },
          React.createElement("strong", null, "Telefónne číslo:"), " ", user.contactPhoneNumber || 'N/A'
        ),
        React.createElement("p", { className: "text-gray-700" },
          React.createElement("strong", null, "Rola:"), " ", user.role || 'user'
        ),
        React.createElement("p", { className: "text-gray-700" },
          React.createElement("strong", null, "Schválený:"), " ", user.approved ? 'Áno' : 'Nie'
        )
      )
    )
  );
};

// components/profile/ChangePassword.js
const ChangePassword = () => {
  const { loading, error, message, handleChangePassword, isEditingOpen, editEndDate } = useAuth();

  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmNewPassword, setConfirmNewPassword] = React.useState('');

  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = React.useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    const success = await handleChangePassword(newPassword, confirmNewPassword, currentPassword);
    if (success) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    }
  };

  return (
    isEditingOpen ? (
      React.createElement("form", { onSubmit: onSubmit, className: "space-y-4 border-t pt-4 mt-4" },
        React.createElement("h2", { className: "text-xl font-semibold text-gray-800" }, "Zmeniť heslo"),
        React.createElement("div", { className: "relative" },
          React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "current-password" }, "Aktuálne heslo"),
          React.createElement("input", {
            type: showCurrentPassword ? "text" : "password",
            id: "current-password",
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
          React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "new-password" }, "Nové heslo"),
          React.createElement("input", {
            type: showNewPassword ? "text" : "password",
            id: "new-password",
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
          React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "confirm-new-password" }, "Potvrďte nové heslo"),
          React.createElement("input", {
            type: showConfirmNewPassword ? "text" : "password",
            id: "confirm-new-password",
            className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10",
            value: confirmNewPassword,
            onChange: (e) => setConfirmNewPassword(e.target.value),
            onCopy: (e) => e.preventDefault(),
            onPaste: (e) => e.preventDefault(),
            onCut: (e) => e.preventDefault(),
            required: true,
            placeholder: "Potvrďte nové heslo",
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
  );
};

// components/profile/ChangeName.js
const ChangeName = () => {
  const { loading, error, message, handleChangeName, isEditingOpen, editEndDate } = useAuth();

  const [newFirstName, setNewFirstName] = React.useState('');
  const [newLastName, setNewLastName] = React.useState('');
  const [currentPassword, setCurrentPassword] = React.useState('');

  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    const success = await handleChangeName(newFirstName, newLastName, currentPassword);
    if (success) {
      setNewFirstName('');
      setNewLastName('');
      setCurrentPassword('');
    }
  };

  return (
    isEditingOpen ? (
      React.createElement("form", { onSubmit: onSubmit, className: "space-y-4 border-t pt-4 mt-4" },
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
  );
};

// components/profile/ChangePhoneNumber.js
const ChangePhoneNumber = () => {
  const { loading, error, message, handleChangeContactPhoneNumber, isEditingOpen, editEndDate, setError } = useAuth();

  const [newContactPhoneNumber, setNewContactPhoneNumber] = React.useState('');
  const [currentPassword, setCurrentPassword] = React.useState('');

  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    const success = await handleChangeContactPhoneNumber(newContactPhoneNumber, currentPassword);
    if (success) {
      setNewContactPhoneNumber('');
      setCurrentPassword('');
    }
  };

  return (
    isEditingOpen ? (
      React.createElement("form", { onSubmit: onSubmit, className: "space-y-4 border-t pt-4 mt-4" },
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
              if (value === '') {
                setNewContactPhoneNumber('');
                setError('');
              } else if (value[0] !== '+') {
                setError("Telefónne číslo musí začínať znakom +.");
                setNewContactPhoneNumber(value);
              } else if (!/^\+\d*$/.test(value)) {
                setError("Telefónne číslo musí zaínať znakom '+' a obsahovať iba číslice (napr. +421901234567).");
                setNewContactPhoneNumber(value);
              } else {
                setContactPhoneNumber(value);
                setError('');
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
  );
};

// components/modals/DeleteConfirmationModal.js
const DeleteConfirmationModal = ({ show, userToDelete, onClose, onConfirm, loading }) => {
  if (!show) return null;

  return (
    React.createElement("div", { className: "modal" },
      React.createElement("div", { className: "modal-content" },
        React.createElement("span", { className: "close-button", onClick: onClose }, "\u00d7"),
        React.createElement("h2", { className: "text-xl font-semibold text-gray-800 mb-4" }, "Potvrdiť odstránenie"),
        React.createElement("p", { className: "mb-4 text-gray-700" },
          `Naozaj chcete odstrániť používateľa `,
          React.createElement("strong", null, userToDelete?.email),
          `? Táto akcia je nevratná.`
        ),
        React.createElement("div", { className: "flex justify-end space-x-4" },
          React.createElement("button", {
            onClick: onClose,
            className: "px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors duration-200"
          }, "Zrušiť"),
          React.createElement("button", {
            onClick: onConfirm,
            className: "px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200",
            disabled: loading
          }, loading ? 'Odstraňujem...' : 'Odstrániť')
        )
      )
    )
  );
};

// components/modals/RoleEditModal.js
const RoleEditModal = ({ show, userToEditRole, newRole, setNewRole, onClose, onConfirm, loading }) => {
  if (!show) return null;

  return (
    React.createElement("div", { className: "modal" },
      React.createElement("div", { className: "modal-content" },
        React.createElement("span", { className: "close-button", onClick: onClose }, "\u00d7"),
        React.createElement("h2", { className: "text-xl font-semibold text-gray-800 mb-4" }, "Upraviť rolu používateľa"),
        React.createElement("p", { className: "mb-4 text-gray-700" },
          `Upravujete rolu pre: `,
          React.createElement("strong", null, userToEditRole?.email)
        ),
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
            onClick: onClose,
            className: "px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors duration-200"
          }, "Zrušiť"),
          React.createElement("button", {
            onClick: onConfirm,
            className: "px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200",
            disabled: loading
          }, loading ? 'Ukladám...' : 'Uložiť')
        )
      )
    )
  );
};

// components/admin/UserList.js
const UserList = () => {
  const { user, loading, handleDeleteUser, handleUpdateUserRole, handleApproveUser, allUsersData } = useAuth(); // Removed fetchAllUsers from destructuring

  const [showDeleteConfirmationModal, setShowDeleteConfirmationModal] = React.useState(false);
  const [userToDelete, setUserToDelete] = React.useState(null);
  const [showRoleEditModal, setShowRoleEditModal] = React.useState(false);
  const [userToEditRole, setUserToEditRole] = React.useState(null);
  const [newRole, setNewRole] = React.useState('');

  // REMOVED: React.useEffect(() => { fetchAllUsers(); }, [fetchAllUsers]);
  // Data is now fetched and updated by the onSnapshot listener in AuthContext.

  const openDeleteConfirmationModal = (u) => {
    setUserToDelete(u);
    setShowDeleteConfirmationModal(true);
  };

  const closeDeleteConfirmationModal = () => {
    setUserToDelete(null);
    setShowDeleteConfirmationModal(false);
  };

  const confirmDeleteUser = async () => {
    await handleDeleteUser(userToDelete);
    closeDeleteConfirmationModal();
  };

  const openRoleEditModal = (u) => {
    setUserToEditRole(u);
    setNewRole(u.role || 'user');
    setShowRoleEditModal(true);
  };

  const closeRoleEditModal = () => {
    setUserToEditRole(null);
    setNewRole('');
    setShowRoleEditModal(false);
  };

  const confirmUpdateUserRole = async () => {
    await handleUpdateUserRole(userToEditRole, newRole);
    closeRoleEditModal();
  };

  return (
    React.createElement("div", { className: "space-y-4 border-t pt-4 mt-4" },
      React.createElement("h2", { className: "text-xl font-semibold text-gray-800 mb-4" }, "Zoznam používateľov (Administrácia)"),
      allUsersData.length > 0 ? (
        React.createElement(React.Fragment, null,
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
          )
        )
      ) : React.createElement("p", { className: "text-gray-600" }, "Žiadni používatelia na zobrazenie alebo načítavanie..."),

      React.createElement(DeleteConfirmationModal, {
        show: showDeleteConfirmationModal,
        userToDelete: userToDelete,
        onClose: closeDeleteConfirmationModal,
        onConfirm: confirmDeleteUser,
        loading: loading
      }),

      React.createElement(RoleEditModal, {
        show: showRoleEditModal,
        userToEditRole: userToEditRole,
        newRole: newRole,
        setNewRole: setNewRole,
        onClose: closeRoleEditModal,
        onConfirm: confirmUpdateUserRole,
        loading: loading
      })
    )
  );
};

// components/admin/TeamList.js
const TeamList = () => {
  const { allUsersData } = useAuth(); // Removed fetchAllUsers from destructuring

  // REMOVED: React.useEffect(() => { fetchAllUsers(); }, [fetchAllUsers]);
  // Data is now fetched and updated by the onSnapshot listener in AuthContext.

  return (
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
                React.createElement("th", { className: "py-3 px-4 whitespace-nowrap text-sm text-gray-800" }, "Rola"),
                React.createElement("th", { className: "py-3 px-4 whitespace-nowrap text-sm text-gray-800" }, "Schválený")
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
        )
      ) : React.createElement("p", { className: "text-gray-600" }, "Žiadne registračné údaje na zobrazenie alebo načítavanie...")
    )
  );
};

// components/admin/Settings.js
const Settings = () => {
  const {
    loading,
    error,
    message,
    isAdmin,
    handleSaveSettings,
    registrationStartDate,
    registrationEndDate,
    editEndDate,
    formatToDateTimeLocal
  } = useAuth();

  const [tempRegistrationStartDate, setTempRegistrationStartDate] = React.useState('');
  const [tempRegistrationEndDate, setTempRegistrationEndDate] = React.useState('');
  const [tempEditEndDate, setTempEditEndDate] = React.useState('');

  React.useEffect(() => {
    setTempRegistrationStartDate(formatToDateTimeLocal(registrationStartDate));
    setTempRegistrationEndDate(formatToDateTimeLocal(registrationEndDate));
    setTempEditEndDate(formatToDateTimeLocal(editEndDate));
  }, [registrationStartDate, registrationEndDate, editEndDate, formatToDateTimeLocal]);

  const onSubmit = async (e) => {
    e.preventDefault();
    const regStartDateObj = tempRegistrationStartDate ? new Date(tempRegistrationStartDate) : null;
    const regEndDateObj = tempRegistrationEndDate ? new Date(tempRegistrationEndDate) : null;
    const edDateObj = tempEditEndDate ? new Date(tempEditEndDate) : null;

    await handleSaveSettings(regStartDateObj, regEndDateObj, edDateObj);
  };

  if (!isAdmin) {
    return React.createElement("div", { className: "text-center text-gray-700 text-lg" }, "Nemáte oprávnenie na zobrazenie tejto stránky.");
  }

  return (
    React.createElement("div", { className: "space-y-4 border-t pt-4 mt-4" },
      React.createElement("h2", { className: "text-xl font-semibold text-gray-800 mb-4" }, "Nastavenia turnaja"),
      React.createElement("form", { onSubmit: onSubmit, className: "space-y-4" },
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
  );
};

// pages/LoggedInPage.js
const LoggedInPage = () => {
  const { user, isAdmin, loading, message, error, handleLogout } = useAuth();

  const [profileView, setProfileView] = React.useState(() => {
    const hash = window.location.hash.substring(1);
    return hash || 'my-data';
  });

  React.useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.substring(1);
      setProfileView(hash || 'my-data');
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const changeProfileView = (view) => {
    setProfileView(view);
    window.location.hash = view;
  };

  if (!user) {
    window.location.href = 'login.html';
    return null;
  }

  return (
    React.createElement("div", { className: "min-h-screen bg-gray-100 flex flex-col font-inter overflow-y-auto" },
      React.createElement(Header, { user: user, isAdmin: isAdmin, handleLogout: handleLogout, isAuthReady: true }),

      React.createElement("div", { className: "flex-grow pt-20 flex justify-center items-start" },
        React.createElement("div", { className: "flex flex-grow w-full pb-10" },
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
                    onClick: () => changeProfileView('change-name'),
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
                      onClick: () => changeProfileView('users'),
                      className: `w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 whitespace-nowrap ${
                        profileView === 'users' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'
                      }`
                    }, "Používatelia")
                  )
                ),
                isAdmin && (
                  React.createElement("li", null,
                    React.createElement("button", {
                      onClick: () => changeProfileView('all-teams'),
                      className: `w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 whitespace-nowrap ${
                        profileView === 'all-teams' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'
                      }`
                    }, "Všetky tímy (registrácie)")
                  )
                ),
                isAdmin && (
                  React.createElement("li", null,
                    React.createElement("button", {
                      onClick: () => changeProfileView('settings'),
                      className: `w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 whitespace-nowrap ${
                        profileView === 'settings' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'
                      }`
                    }, "Nastavenia")
                  )
                )
              )
            )
          ),

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

            profileView === 'my-data' && React.createElement(MyData, null),
            profileView === 'change-password' && React.createElement(ChangePassword, null),
            profileView === 'change-name' && React.createElement(ChangeName, null),
            profileView === 'change-phone-number' && !isAdmin && React.createElement(ChangePhoneNumber, null),
            profileView === 'users' && isAdmin && React.createElement(UserList, null),
            profileView === 'all-teams' && isAdmin && React.createElement(TeamList, null),
            profileView === 'settings' && isAdmin && React.createElement(Settings, null)
          )
        )
      )
    )
  );
};

// --- Hlavný komponent aplikácie ---
// Odstránený `export default`
function App() {
  // Získanie globálneho stavu a funkcií z AuthContextu
  const { loading, isAuthReady, user, error, message } = useAuth();

  // Získanie aktuálnej cesty URL
  const currentPath = window.location.pathname.split('/').pop();

  // Zobrazenie načítavacej obrazovky, kým sa inicializuje autentifikácia a nastavenia
  if (loading || !isAuthReady) {
    return (
      React.createElement("div", { className: "flex items-center justify-center min-h-screen bg-gray-100" },
        React.createElement("div", { className: "text-xl font-semibold text-gray-700" }, "Načítava sa...")
      )
    );
  }

  // Podmienené renderovanie stránok na základe aktuálnej URL
  let pageContent = null;
  if (currentPath === '' || currentPath === 'index.html') {
    pageContent = React.createElement(HomePage, null);
  } else if (currentPath === 'register.html') {
    pageContent = React.createElement(RegisterPage, { isAdminRegisterPage: false });
  } else if (currentPath === 'admin-register.html') {
    pageContent = React.createElement(RegisterPage, { isAdminRegisterPage: true });
  } else if (currentPath === 'login.html') {
    pageContent = React.createElement(LoginPage, null);
  } else if (currentPath === 'logged-in.html') {
    // LoggedInPage už obsahuje vlastnú logiku presmerovania, ak používateľ nie je prihlásený
    pageContent = React.createElement(LoggedInPage, null);
  } else {
    // Stránka 404 alebo presmerovanie na domovskú stránku
    pageContent = React.createElement("div", { className: "flex items-center justify-center min-h-screen bg-gray-100" },
      React.createElement("div", { className: "text-xl font-semibold text-gray-700" }, "Stránka nebola nájdená.")
    );
  }

  return (
    React.createElement(React.Fragment, null,
      // Hlavička je teraz renderovaná priamo v AppContent, aby bola konzistentná na všetkých stránkach
      // s výnimkou logged-in.html, kde je renderovaná v rámci LoggedInPage
      currentPath !== 'logged-in.html' && React.createElement(Header, { user: user, isAdmin: user?.role === 'admin', handleLogout: () => window.location.href = 'login.html', isAuthReady: isAuthReady }), // Jednoduchá verzia pre ne-logged-in stránky
      
      // Kontajner pre obsah stránky
      React.createElement("div", { className: `flex justify-center items-start ${currentPath === 'logged-in.html' ? '' : 'min-h-screen pt-20'}` },
        // Zobrazenie globálnych správ o úspechu alebo chybách (ak nie sú špecifické pre komponent)
        // Tieto správy sa zobrazia nad obsahom stránky
        message && (
          React.createElement("div", { className: "fixed top-20 left-1/2 -translate-x-1/2 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative z-50 w-full max-w-md text-center", role: "alert" },
            message
          )
        ),
        error && (
          React.createElement("div", { className: "fixed top-20 left-1/2 -translate-x-1/2 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative z-50 w-full max-w-md text-center whitespace-pre-wrap", role: "alert" },
            error
          )
        ),
        pageContent // Renderovanie aktuálneho obsahu stránky
      )
    )
  );
}

// Vykreslenie hlavného komponentu React do DOM
// Uistite sa, že v index.html máte <div id="root"></div>
// a že react.production.min.js, react-dom.production.min.js a babel.min.js sú načítané PRED týmto skriptom.
ReactDOM.render(
  React.createElement(AuthProvider, null,
    React.createElement(App, null)
  ),
  document.getElementById('root')
);
