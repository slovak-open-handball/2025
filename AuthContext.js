// AuthContext.js

import React, { createContext, useContext, useState, useEffect } from 'react';
import { validatePassword, formatToDateTimeLocal } from './utils/helpers.js'; // Import pomocných funkcií

// Vytvorenie kontextu
const AuthContext = createContext();

// Export hooku pre jednoduché použitie kontextu
export const useAuth = () => {
  return useContext(AuthContext);
};

// Konfigurácia Firebase (globálne premenné poskytnuté prostredím)
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
const RECAPTCHA_SITE_KEY = "6LdJbn8rAAAAAO4C50qXTWva6ePzDlOfYwBDEDwa"; // Vaša reCAPTCHA Site Key
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzPbN2BL4t9qRxRVmJs2CH6OGex-l-z21lg7_ULUH3249r93GKV_4B_Oenf6ydz0CyKrA/exec";

/**
 * Poskytovateľ autentifikačného kontextu.
 * Spravuje stav autentifikácie, Firebase inicializáciu a súvisiace funkcie.
 * @param {object} props - Vlastnosti komponentu.
 * @param {React.ReactNode} props.children - Podradené komponenty, ktoré budú mať prístup ku kontextu.
 */
export const AuthProvider = ({ children }) => {
  const [app, setApp] = useState(null);
  const [auth, setAuth] = useState(null);
  const [db, setDb] = useState(null);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [registrationStartDate, setRegistrationStartDate] = useState(null);
  const [registrationEndDate, setRegistrationEndDate] = useState(null);
  const [editEndDate, setEditEndDate] = useState(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [countdownMessage, setCountdownMessage] = useState('');
  const [registrationStatusChanged, setRegistrationStatusChanged] = useState(false);

  const [allUsersData, setAllUsersData] = useState([]);


  // Inicializácia Firebase a nastavenie poslucháča autentifikácie
  useEffect(() => {
    try {
      if (typeof window.firebase === 'undefined') {
        setError("Firebase SDK nie je načítané. Skontrolujte index.html.");
        setLoading(false);
        return;
      }

      const firebaseApp = window.firebase.initializeApp(firebaseConfig);
      setApp(firebaseApp);

      const authInstance = window.firebase.auth(firebaseApp);
      setAuth(authInstance);
      const firestoreInstance = window.firebase.firestore(firebaseApp);
      setDb(firestoreInstance);

      const signIn = async () => {
        try {
          if (initialAuthToken) {
            await authInstance.signInWithCustomToken(initialAuthToken);
          } else {
            // Ak nie je k dispozícii žiadny token, prihláste sa anonymne
            await authInstance.signInAnonymously();
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

        if (currentUser && firestoreInstance) {
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
              
              setUser(prevUser => ({
                ...prevUser,
                ...userData,
                displayName: userData.firstName && userData.lastName ? `${userData.firstName} ${userData.lastName}` : userData.email
              }));

              // Nastavenie globálnych premenných pre prístup z iných skriptov
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
              window.currentUserData = null;
              window.isAdminGlobal = false;
            }
          } catch (e) {
            console.error("Chyba pri načítaní roly používateľa z Firestore:", e);
            setIsAdmin(false);
            window.currentUserData = null;
            window.isAdminGlobal = false;
          } finally {
            // Informovať, že rola je načítaná (alebo nie je k dispozícii)
            // setIsRoleLoaded(true); // Táto premenná sa už nepoužíva, nahradená isAuthReady a isAdmin
            console.log("onAuthStateChanged: Autentifikácia a rola sú pripravené.");
            window.dispatchEvent(new Event('authStatusChanged')); // Spustiť udalosť pre ostatné skripty
          }
        } else {
          console.log("onAuthStateChanged: Používateľ nie je prihlásený alebo db nie je k dispozícii.");
          setIsAdmin(false);
          // setIsRoleLoaded(true); // Táto premenná sa už nepoužíva
          window.currentUserData = null;
          window.isAdminGlobal = false;
          window.dispatchEvent(new Event('authStatusChanged')); // Spustiť udalosť pre ostatné skripty
        }
      });

      signIn();

      return () => unsubscribe(); // Odhlásenie poslucháča pri odmontovaní komponentu
    } catch (e) {
      console.error("Failed to initialize Firebase:", e);
      setError(`Chyba pri inicializácii Firebase: ${e.message}`);
      setLoading(false);
    }
  }, []); // Spustí sa iba raz pri montáži komponentu


  // Načítanie nastavení turnaja z Firestore
  useEffect(() => {
    const fetchSettings = async () => {
      if (!db) return;
      try {
        const settingsDocRef = db.collection('appSettings').doc('tournamentSettings');
        const doc = await settingsDocRef.get();
        if (doc.exists) {
          const data = doc.data();
          
          const regStartDateObj = data.registrationStartDate ? data.registrationStartDate.toDate() : null; 
          const regEndDateObj = data.registrationEndDate ? data.registrationEndDate.toDate() : null;
          const edDateObj = data.editEndDate ? data.editEndDate.toDate() : null;
          
          setRegistrationStartDate(regStartDateObj); 
          setRegistrationEndDate(regEndDateObj);
          setEditEndDate(edDateObj);

        } else {
          console.log("Nastavenia turnaja neboli nájdené vo Firestore. Používam predvolené prázdne hodnoty.");
          setRegistrationStartDate(null); 
          setRegistrationEndDate(null);
          setEditEndDate(null);
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
  }, [db]); // Znovu sa spustí, keď sa zmení inštancia db


  // Odpočítavanie času registrácie
  useEffect(() => {
    let intervalId;

    const updateCountdown = () => {
      if (!settingsLoaded || (!registrationStartDate && !registrationEndDate)) {
        setCountdownMessage("Načítavam nastavenia registrácie...");
        window.isRegistrationOpenGlobal = false;
        return;
      }

      const now = new Date();
      
      const isRegistrationCurrentlyOpen = registrationStartDate && registrationEndDate && now >= registrationStartDate && now <= registrationEndDate;
      window.isRegistrationOpenGlobal = isRegistrationCurrentlyOpen; // Aktualizácia globálnej premennej

      window.dispatchEvent(new Event('authStatusChanged')); // Spustiť udalosť pre ostatné skripty

      if (isRegistrationCurrentlyOpen) {
        const timeLeft = registrationEndDate.getTime() - now.getTime();
        if (timeLeft <= 0) {
          setCountdownMessage("Registrácia je ukončená.");
          setRegistrationStatusChanged(prev => !prev); // Spustiť zmenu stavu pre re-render, ak je potrebné
          clearInterval(intervalId);
          return;
        }
        const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
        setCountdownMessage(`Registrácia sa končí za: ${days}d ${hours}h ${minutes}m ${seconds}s`);
      } 
      else if (registrationStartDate && now < registrationStartDate) {
        const timeLeft = registrationStartDate.getTime() - now.getTime();
        if (timeLeft <= 0) {
          setCountdownMessage("Registrácia je otvorená!");
          setRegistrationStatusChanged(prev => !prev);
          clearInterval(intervalId);
          return;
        }
        const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
        setCountdownMessage(`Registrácia začína za: ${days}d ${hours}h ${minutes}m ${seconds}s`);
      }
      else {
        setCountdownMessage("Registrácia je uzavretá.");
        setRegistrationStatusChanged(prev => !prev);
        clearInterval(intervalId);
      }
    };

    if (settingsLoaded) {
      updateCountdown(); // Spustiť hneď po načítaní nastavení
      intervalId = setInterval(updateCountdown, 1000); // Aktualizovať každú sekundu
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId); // Vyčistiť interval pri odmontovaní komponentu
      }
    };
  }, [settingsLoaded, registrationStartDate, registrationEndDate]); // Znovu sa spustí, keď sa zmenia nastavenia dátumov


  /**
   * Získa reCAPTCHA token pre danú akciu.
   * @param {string} action - Názov akcie pre reCAPTCHA (napr. 'login', 'register').
   * @returns {Promise<string|null>} ReCAPTCHA token alebo null v prípade chyby.
   */
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

  /**
   * Vymaže správy o úspechu a chybách po určitom čase.
   */
  const clearMessages = () => {
    setTimeout(() => {
      setMessage('');
      setError('');
    }, 5000);
  };

  /**
   * Spracuje registráciu nového používateľa.
   * @param {string} email - E-mail používateľa.
   * @param {string} password - Heslo používateľa.
   * @param {string} confirmPassword - Potvrdenie hesla.
   * @param {string} firstName - Meno používateľa.
   * @param {string} lastName - Priezvisko používateľa.
   * @param {string} contactPhoneNumber - Telefónne číslo kontaktnej osoby.
   * @param {boolean} isAdminRegistration - True, ak ide o registráciu administrátora.
   * @returns {Promise<void>}
   */
  const handleRegister = async (email, password, confirmPassword, firstName, lastName, contactPhoneNumber, isAdminRegistration = false) => {
    if (!auth || !db) {
      setError("Firebase Auth alebo Firestore nie je inicializovaný.");
      return;
    }

    if (!isAdminRegistration && settingsLoaded) {
      const now = new Date();
      const isRegistrationOpen = registrationStartDate && registrationEndDate && now >= registrationStartDate && now <= registrationEndDate;

      if (!isRegistrationOpen) {
        setError("Registrácia je momentálne uzavretá alebo ešte nezačala.");
        return;
      }
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
      await userCredential.user.updateProfile({ displayName: `${firstName} ${lastName}` });

      const userRole = isAdminRegistration ? 'admin' : 'user'; 
      const isApproved = !isAdminRegistration; // Používatelia sú automaticky schválení, admini čakajú na schválenie
      await db.collection('users').doc(userCredential.user.uid).set({
        uid: userCredential.user.uid,
        email: email,
        firstName: firstName,
        lastName: lastName,
        contactPhoneNumber: isAdminRegistration ? '' : contactPhoneNumber,
        displayName: `${firstName} ${lastName}`,
        role: userRole,
        approved: isApproved, 
        registeredAt: window.firebase.firestore.FieldValue.serverTimestamp()
      });
      console.log(`Používateľ ${email} s rolou '${userRole}' a schválením '${isApproved}' bol uložený do Firestore.`);

      // Odoslanie e-mailu cez Google Apps Script
      try {
        const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors', // Dôležité pre obídenie CORS, ak Apps Script neposiela správne hlavičky
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'sendRegistrationEmail',
            email: email,
            password: password, // Poznámka: Posielanie hesla e-mailom nie je ideálne z bezpečnostného hľadiska. Zvážte alternatívu (napr. len oznámenie o registrácii).
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

      await auth.signOut(); // Odhlásiť používateľa po registrácii

      setMessage("Registrácia úspešná! Presmerovanie na prihlasovaciu stránku...");
      setError('');
      return true; // Úspešná registrácia
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
      return false; // Neúspešná registrácia
    } finally {
      setLoading(false);
      clearMessages();
    }
  };

  /**
   * Spracuje prihlásenie používateľa.
   * @param {string} email - E-mail používateľa.
   * @param {string} password - Heslo používateľa.
   * @returns {Promise<void>}
   */
  const handleLogin = async (email, password) => {
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
        await auth.signOut(); // Odhlásiť používateľa, ak jeho dokument neexistuje
        setLoading(false);
        clearMessages();
        return false; // Neúspešné prihlásenie
      }

      const userData = userDoc.data();
      console.log("Login: Používateľské dáta z Firestore:", userData);

      // Ak je admin a nie je schválený, zakázať prihlásenie
      if (userData.role === 'admin' && userData.approved === false) { 
        setError("Váš administrátorský účet je neaktívny alebo čaká na schválenie iným administrátorom.");
        await auth.signOut(); // Odhlásiť neaktívneho admina
        setLoading(false);
        clearMessages();
        return false; // Neúspešné prihlásenie
      }

      // Aktualizovať stav používateľa v kontexte
      setUser(prevUser => ({
        ...prevUser,
        ...userData,
        displayName: userData.firstName && userData.lastName ? `${userData.firstName} ${userData.lastName}` : userData.email
      }));

      // Nastavenie globálnych premenných pre prístup z iných skriptov
      window.currentUserData = {
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: userData.firstName && userData.lastName ? `${userData.firstName} ${userData.lastName}` : currentUser.email,
        role: userData.role,
        approved: userData.approved
      };
      window.isAdminGlobal = userData.role === 'admin';
      window.dispatchEvent(new Event('authStatusChanged')); // Spustiť udalosť pre ostatné skripty


      setMessage("Prihlásenie úspešné! Presmerovanie na profilovú stránku...");
      setError('');
      return true; // Úspešné prihlásenie
    } catch (e) {
      console.error("Chyba pri prihlasovaní:", e);
      if (e.code === 'auth/invalid-credential' || e.code === 'auth/invalid-login-credentials') {
        setError("Zadané prihlasovacie údaje sú neplatné. Skontrolujte e-mailovú adresu a heslo a skúste to prosím znova.");
      } else {
        setError(`Chyba pri prihlasovaní: ${e.message}`);
      }
      return false; // Neúspešné prihlásenie
    } finally {
      setLoading(false);
      clearMessages();
    }
  };

  /**
   * Spracuje odhlásenie používateľa.
   * @returns {Promise<void>}
   */
  const handleLogout = async () => {
    if (!auth) return;
    try {
      setLoading(true);
      await auth.signOut();
      setMessage("Úspešne odhlásené.");
      setError('');
      window.currentUserData = null; // Vyčistiť globálne dáta
      window.isAdminGlobal = false; // Vyčistiť globálne dáta
      window.dispatchEvent(new Event('authStatusChanged')); // Spustiť udalosť pre ostatné skripty
      return true; // Úspešné odhlásenie
    } catch (e) {
      console.error("Chyba pri odhlasovaní:", e);
      setError(`Chyba pri odhlasovaní: ${e.message}`);
      return false; // Neúspešné odhlásenie
    } finally {
      setLoading(false);
      clearMessages();
    }
  };

  /**
   * Zmení heslo prihláseného používateľa.
   * @param {string} currentPassword - Aktuálne heslo používateľa.
   * @param {string} newPassword - Nové heslo.
   * @param {string} confirmNewPassword - Potvrdenie nového hesla.
   * @returns {Promise<void>}
   */
  const handleChangePassword = async (currentPassword, newPassword, confirmNewPassword) => {
    if (!user) {
      setError("Nie ste prihlásený.");
      return false;
    }

    // Kontrola, či je editácia povolená (len pre ne-adminov)
    const now = new Date();
    const isEditingOpen = isAdmin || (editEndDate && now <= editEndDate);
    if (!isEditingOpen) {
      setError("Editácia údajov je už uzavretá.");
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

    setLoading(true);
    try {
      const credential = window.firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
      await user.reauthenticateWithCredential(credential); // Reautentifikácia používateľa

      await user.updatePassword(newPassword);
      setMessage("Heslo úspešne zmenené!");
      setError('');
      return true; // Úspešná zmena
    } catch (e) {
      console.error("Chyba pri zmene hesla:", e);
      if (e.code === 'auth/requires-recent-login') {
        setError("Pre túto akciu sa musíte znova prihlásiť. Prosím, odhláste sa a znova prihláste.");
      } else if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential' || e.code === 'auth/invalid-login-credentials') {
        setError("Nesprávne aktuálne heslo. Prosím, zadajte správne heslo pre overenie.");
      } else {
        setError(`Chyba pri zmene hesla: ${e.message}`);
      }
      return false; // Neúspešná zmena
    } finally {
      setLoading(false);
      clearMessages();
    }
  };

  /**
   * Zmení meno a priezvisko prihláseného používateľa.
   * @param {string} newFirstName - Nové meno.
   * @param {string} newLastName - Nové priezvisko.
   * @param {string} currentPassword - Aktuálne heslo pre overenie.
   * @returns {Promise<void>}
   */
  const handleChangeName = async (newFirstName, newLastName, currentPassword) => {
    if (!user) {
      setError("Nie ste prihlásený.");
      return false;
    }

    // Kontrola, či je editácia povolená (len pre ne-adminov)
    const now = new Date();
    const isEditingOpen = isAdmin || (editEndDate && now <= editEndDate);
    if (!isEditingOpen) {
      setError("Editácia údajov je už uzavretá.");
      return false;
    }

    if (!newFirstName || !newLastName) {
      setError("Prosím, zadajte meno aj priezvisko.");
      return false;
    }

    setLoading(true);
    try {
      if (user.email && currentPassword) {
        const credential = window.firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
        await user.reauthenticateWithCredential(credential);
      } else {
        setError("Pre zmenu mena a priezviska je potrebné zadať aktuálne heslo pre overenie.");
        setLoading(false);
        return false;
      }

      const newDisplayName = `${newFirstName} ${newLastName}`;
      await user.updateProfile({ displayName: newDisplayName });
      await db.collection('users').doc(user.uid).update({ 
        firstName: newFirstName,
        lastName: newLastName,
        displayName: newDisplayName
      });
      setMessage("Meno a priezvisko úspešne zmenené na " + newDisplayName);
      setError('');
      // Aktualizovať stav používateľa v kontexte
      setUser(prevUser => ({ ...prevUser, displayName: newDisplayName, firstName: newFirstName, lastName: newLastName }));
      if (window.currentUserData) { // Aktualizovať aj globálnu premennú
        window.currentUserData.displayName = newDisplayName;
        window.dispatchEvent(new Event('authStatusChanged'));
      }
      return true; // Úspešná zmena
    } catch (e) {
      console.error("Chyba pri zmene mena a priezviska:", e);
      if (e.code === 'auth/requires-recent-login') {
        setError("Pre túto akciu sa musíte znova prihlásiť. Prosím, odhláste sa a znova prihláste.");
      } else if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential' || e.code === 'auth/invalid-login-credentials') {
        setError("Nesprávne aktuálne heslo. Prosím, zadajte správne heslo pre overenie.");
      } else {
        setError(`Chyba pri zmene mena a priezviska: ${e.message}`);
      }
      return false; // Neúspešná zmena
    } finally {
      setLoading(false);
      clearMessages();
    }
  };

  /**
   * Zmení kontaktné telefónne číslo prihláseného používateľa.
   * @param {string} newContactPhoneNumber - Nové telefónne číslo.
   * @param {string} currentPassword - Aktuálne heslo pre overenie.
   * @returns {Promise<void>}
   */
  const handleChangeContactPhoneNumber = async (newContactPhoneNumber, currentPassword) => {
    if (!user) {
      setError("Nie ste prihlásený.");
      return false;
    }

    // Kontrola, či je editácia povolená (len pre ne-adminov)
    const now = new Date();
    const isEditingOpen = isAdmin || (editEndDate && now <= editEndDate);
    if (!isEditingOpen) {
      setError("Editácia údajov je už uzavretá.");
      return false;
    }

    if (!newContactPhoneNumber) {
      setError("Prosím, zadajte nové telefónne číslo.");
      return false;
    }

    const phoneRegex = /^\+\d+$/;
    if (!phoneRegex.test(newContactPhoneNumber)) {
        setError("Telefónne číslo musí zaínať znakom '+' a obsahovať iba číslice (napr. +421901234567).");
        return false;
    }

    setLoading(true);
    try {
      if (user.email && currentPassword) {
        const credential = window.firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
        await user.reauthenticateWithCredential(credential);
      } else {
        setError("Pre zmenu telefónneho čísla je potrebné zadať aktuálne heslo pre overenie.");
        setLoading(false);
        return false;
      }

      await db.collection('users').doc(user.uid).update({ 
        contactPhoneNumber: newContactPhoneNumber
      });
      setMessage("Telefónne číslo úspešne zmenené na " + newContactPhoneNumber);
      setError('');
      // Aktualizovať stav používateľa v kontexte
      setUser(prevUser => ({ ...prevUser, contactPhoneNumber: newContactPhoneNumber }));
      return true; // Úspešná zmena
    } catch (e) {
      console.error("Chyba pri zmene telefónneho čísla:", e);
      if (e.code === 'auth/requires-recent-login') {
        setError("Pre túto akciu sa musíte znova prihlásiť. Prosím, odhláste sa a znova prihláste.");
      } else if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential' || e.code === 'auth/invalid-login-credentials') {
        setError("Nesprávne aktuálne heslo. Prosím, zadajte správne heslo pre overenie.");
      } else {
        setError(`Chyba pri zmene telefónneho čísla: ${e.message}`);
      }
      return false; // Neúspešná zmena
    } finally {
      setLoading(false);
      clearMessages();
    }
  };


  /**
   * Načíta všetkých používateľov z Firestore.
   * @returns {Promise<void>}
   */
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
      setAllUsersData(usersList); // Aktualizovať stav všetkých používateľov

    } catch (e) {
      console.error("Chyba pri získavaní používateľov z Firestore:", e);
      setError(`Chyba pri získavaní používateľov: ${e.message}`);
    } finally {
      setLoading(false);
      clearMessages();
    }
  };

  /**
   * Odstráni používateľa z databázy.
   * @param {object} userToDelete - Objekt používateľa na odstránenie.
   * @returns {Promise<void>}
   */
  const handleDeleteUser = async (userToDelete) => {
    if (!userToDelete || !db) { 
      setError("Používateľ na odstránenie nie je definovaný alebo Firebase nie je inicializovaný.");
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    try {
      // Odstránenie dokumentu používateľa z Firestore
      await db.collection('users').doc(userToDelete.uid).delete();
      setMessage(`Používateľ ${userToDelete.email} bol úspešne odstránený z databázy.`);
      
      // Znovu načítať zoznam používateľov po odstránení
      fetchAllUsers();

      // Otvoriť Firebase Console pre manuálne odstránenie z autentifikácie (ak je potrebné)
      // Poznámka: Firebase Security Rules by mali zabrániť neoprávnenému prístupu
      window.open(`https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/users?t=${new Date().getTime()}`, '_blank');

    } catch (e) {
      console.error("Chyba pri odstraňovaní používateľa z databázy:", e);
      setError(`Chyba pri odstraňovaní používateľa: ${e.message}`);
    } finally {
      setLoading(false);
      clearMessages();
    }
  };

  /**
   * Aktualizuje rolu používateľa.
   * @param {object} userToEditRole - Objekt používateľa, ktorého rola sa má upraviť.
   * @param {string} newRole - Nová rola ('user' alebo 'admin').
   * @returns {Promise<void>}
   */
  const handleUpdateUserRole = async (userToEditRole, newRole) => {
    if (!userToEditRole || !db || !newRole) {
      setError("Používateľ alebo nová rola nie sú definované.");
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    try {
      let updateData = { role: newRole };

      // Ak sa rola mení na 'user', automaticky schváliť
      if (newRole === 'user') {
        updateData.approved = true;
      }
      // Ak sa rola mení na 'admin', ponechať aktuálny stav schválenia
      else if (newRole === 'admin') {
          updateData.approved = userToEditRole.approved;
      }

      await db.collection('users').doc(userToEditRole.uid).update(updateData);
      setMessage(`Rola používateľa ${userToEditRole.email} bola úspešne zmenená na '${newRole}'.`);
      fetchAllUsers(); // Znovu načítať zoznam používateľov po zmene roly
    } catch (e) {
      console.error("Chyba pri aktualizácii roly používateľa:", e);
      setError(`Chyba pri aktualizácii roly: ${e.message}`);
    } finally {
      setLoading(false);
      clearMessages();
    }
  };

  /**
   * Schváli administrátorského používateľa.
   * @param {object} userToApprove - Objekt používateľa na schválenie.
   * @returns {Promise<void>}
   */
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
      fetchAllUsers(); // Znovu načítať zoznam používateľov po schválení
    } catch (e) {
      console.error("Chyba pri schvaľovaní používateľa:", e);
      setError(`Chyba pri schvaľovaní používateľa: ${e.message}`);
    } finally {
      setLoading(false);
      clearMessages();
    }
  };

  /**
   * Uloží nastavenia turnaja do Firestore.
   * @param {Date|null} regStartDate - Dátum začiatku registrácie.
   * @param {Date|null} regEndDate - Dátum konca registrácie.
   * @param {Date|null} edDate - Dátum konca editácie.
   * @returns {Promise<void>}
   */
  const handleSaveSettings = async (regStartDate, regEndDate, edDate) => {
    if (!db || !isAdmin) {
      setError("Nemáte oprávnenie na úpravu nastavení.");
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    try {
      const settingsDocRef = db.collection('appSettings').doc('tournamentSettings');
      
      await settingsDocRef.set({
        registrationStartDate: regStartDate ? window.firebase.firestore.Timestamp.fromDate(regStartDate) : null, 
        registrationEndDate: regEndDate ? window.firebase.firestore.Timestamp.fromDate(regEndDate) : null,
        editEndDate: edDate ? window.firebase.firestore.Timestamp.fromDate(edDate) : null,
        lastUpdated: window.firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true }); // Použiť merge, aby sa neprepisovali ostatné polia

      // Aktualizovať stav v kontexte
      setRegistrationStartDate(regStartDate); 
      setRegistrationEndDate(regEndDate);
      setEditEndDate(edDate);

      setMessage("Nastavenia turnaja úspešne uložené!");
    } catch (e) {
      console.error("Chyba pri ukladaní nastavení turnaja:", e);
      setError(`Chyba pri ukladaní nastavení: ${e.message}`);
    } finally {
      setLoading(false);
      clearMessages();
    }
  };

  // Hodnoty, ktoré budú poskytnuté kontextom
  const authContextValue = {
    app,
    auth,
    db,
    user,
    isAdmin,
    isAuthReady,
    loading,
    message,
    error,
    setMessage,
    setError,
    registrationStartDate,
    registrationEndDate,
    editEndDate,
    settingsLoaded,
    countdownMessage,
    registrationStatusChanged,
    allUsersData,
    setAllUsersData, // Pre aktualizáciu zoznamu používateľov z admin komponentov

    // Funkcie
    getRecaptchaToken,
    clearMessages,
    handleRegister,
    handleLogin,
    handleLogout,
    handleChangePassword,
    handleChangeName,
    handleChangeContactPhoneNumber,
    fetchAllUsers,
    handleDeleteUser,
    handleUpdateUserRole,
    handleApproveUser,
    handleSaveSettings,
    validatePassword, // Export validácie hesla pre formuláre
    formatToDateTimeLocal, // Export formátovania dátumu pre formuláre

    // Globálne premenné pre prístup k aktuálnemu stavu registrácie
    isRegistrationOpen: registrationStartDate && registrationEndDate && new Date() >= registrationStartDate && new Date() <= registrationEndDate,
    isEditingOpen: isAdmin || (editEndDate && new Date() <= editEndDate)
  };

  return (
    React.createElement(AuthContext.Provider, { value: authContextValue }, children)
  );
};
