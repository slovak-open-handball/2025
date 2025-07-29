// logged-in-change-email.js
// Tento súbor obsahuje React komponent pre zmenu e-mailovej adresy prihláseného používateľa.
// Predpokladá, že firebaseConfig, initialAuthToken a appId sú globálne definované v HTML súbore.

// Komponent NotificationModal pre zobrazovanie dočasných správ
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
      }, 10000); // Zobraziť správu na 10 sekúnd
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
    bgColorClass = 'bg-[#3A8D41]'; // Zelená pre úspech
  } else if (type === 'error') {
    bgColorClass = 'bg-red-600'; // Červená pre chybu
  } else {
    bgColorClass = 'bg-blue-500'; // Predvolená modrá pre informácie
  }

  return React.createElement(
    'div',
    {
      className: `fixed top-0 left-0 right-0 z-50 flex justify-center p-4 transition-transform duration-500 ease-out ${
        show ? 'translate-y-0' : '-translate-y-full'
      }`,
      style: { pointerEvents: 'none' } // Zakáže interakciu s pozadím
    },
    React.createElement(
      'div',
      {
        className: `${bgColorClass} text-white px-6 py-3 rounded-lg shadow-lg max-w-md w-full text-center`,
        style: { pointerEvents: 'auto' } // Umožní interakciu so samotnou notifikáciou
      },
      React.createElement('p', { className: 'font-semibold' }, message)
    )
  );
}

// Hlavný React komponent pre stránku logged-in-change-email.html
function ChangeEmailApp() {
  const [app, setApp] = React.useState(null);
  const [auth, setAuth] = React.useState(null);
  const [db, setDb] = React.useState(null);
  const [user, setUser] = React.useState(undefined); // Objekt používateľa z onAuthStateChanged
  const [userProfileData, setUserProfileData] = React.useState(null); 
  const [isAuthReady, setIsAuthReady] = React.useState(false); // Stav pre pripravenosť autentifikácie
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [userNotificationMessage, setUserNotificationMessage] = React.useState('');

  // Stavy pre dáta používateľa
  const [currentEmail, setCurrentEmail] = React.useState('');
  const [newEmail, setNewEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

  // Stavy pre validáciu formulára
  const [emailTouched, setEmailTouched] = React.useState(false);
  const [emailError, setEmailError] = React.useState('');
  const [passwordError, setPasswordError] = React.useState('');

  // Zabezpečíme, že appId je definované (používame globálnu premennú)
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'; 

  // Funkcia na validáciu e-mailu
  const validateEmail = (email) => {
    const atIndex = email.indexOf('@');
    if (atIndex === -1) return false;

    const domainPart = email.substring(atIndex + 1);
    const dotIndexInDomain = domainPart.indexOf('.');
    if (dotIndexInDomain === -1) return false;
    
    const lastDotIndex = email.lastIndexOf('.');
    if (lastDotIndex === -1 || lastDotIndex < atIndex) return false; 
    
    const charsAfterLastDot = email.substring(lastDotIndex + 1);
    return charsAfterLastDot.length >= 2;
  };

  // Efekt pre inicializáciu Firebase a nastavenie poslucháča autentifikácie (spustí sa iba raz)
  React.useEffect(() => {
    let unsubscribeAuth;
    let firestoreInstance;

    try {
      if (typeof firebase === 'undefined') {
        console.error("ChangeEmailApp: Firebase SDK nie je načítané.");
        setError("Firebase SDK nie je načítané. Skontrolujte logged-in-change-email.html.");
        setLoading(false);
        return;
      }

      let firebaseApp;
      // Skontrolujte, či už existuje predvolená aplikácia Firebase
      if (firebase.apps.length === 0) {
        // Používame globálne firebaseConfig
        firebaseApp = firebase.initializeApp(firebaseConfig);
      } else {
        firebaseApp = firebase.app(); // Použite existujúcu predvolenú aplikáciu
      }
      setApp(firebaseApp);

      const authInstance = firebase.auth(firebaseApp);
      setAuth(authInstance);
      firestoreInstance = firebase.firestore(firebaseApp);
      setDb(firestoreInstance);

      const signIn = async () => {
        try {
          if (typeof initialAuthToken !== 'undefined' && initialAuthToken) {
            await authInstance.signInWithCustomToken(initialAuthToken);
          }
        } catch (e) {
          console.error("ChangeEmailApp: Chyba pri počiatočnom prihlásení Firebase (s custom tokenom):", e);
          setError(`Chyba pri prihlásení: ${e.message}`);
        }
      };

      unsubscribeAuth = authInstance.onAuthStateChanged(async (currentUser) => {
        console.log("ChangeEmailApp: onAuthStateChanged - Používateľ:", currentUser ? currentUser.uid : "null");
        setUser(currentUser); // Nastaví Firebase User objekt
        setIsAuthReady(true); // Označí autentifikáciu ako pripravenú po prvej kontrole
      });

      signIn();

      return () => {
        if (unsubscribeAuth) {
          unsubscribeAuth();
        }
      };
    } catch (e) {
      console.error("ChangeEmailApp: Nepodarilo sa inicializovať Firebase:", e);
      setError(`Chyba pri inicializácii Firebase: ${e.message}`);
      setLoading(false);
    }
  }, []);

  // Efekt pre načítanie používateľských dát z Firestore po pripravenosti autentifikácie a databázy
  React.useEffect(() => {
    let unsubscribeUserDoc;

    if (isAuthReady && db && user !== undefined) {
      if (user === null) { 
        console.log("ChangeEmailApp: Auth je ready a používateľ je null, presmerovávam na login.html");
        window.location.href = 'login.html';
        return;
      }

      if (user) {
        console.log(`ChangeEmailApp: Pokúšam sa načítať používateľský dokument pre UID: ${user.uid}`);
        setLoading(true);

        try {
          const userDocRef = db.collection('users').doc(user.uid);
          unsubscribeUserDoc = userDocRef.onSnapshot(docSnapshot => {
            console.log("ChangeEmailApp: onSnapshot pre používateľský dokument spustený.");
            if (docSnapshot.exists) {
              const userData = docSnapshot.data();
              console.log("ChangeEmailApp: Používateľský dokument existuje, dáta:", userData);

              // --- LOGIKA ODHLÁSENIA NA ZÁKLADE passwordLastChanged ---
              if (!userData.passwordLastChanged || typeof userData.passwordLastChanged.toDate !== 'function') {
                  console.error("ChangeEmailApp: passwordLastChanged NIE JE platný Timestamp objekt! Typ:", typeof userData.passwordLastChanged, "Hodnota:", userData.passwordLastChanged);
                  console.log("ChangeEmailApp: Okamžite odhlasujem používateľa kvôli neplatnému timestampu zmeny hesla.");
                  auth.signOut();
                  window.location.href = 'login.html';
                  localStorage.removeItem(`passwordLastChanged_${user.uid}`);
                  setUser(null); // Explicitne nastaviť user na null
                  setUserProfileData(null); // Explicitne nastaviť userProfileData na null
                  return;
              }

              const firestorePasswordChangedTime = userData.passwordLastChanged.toDate().getTime();
              const localStorageKey = `passwordLastChanged_${user.uid}`;
              let storedPasswordChangedTime = parseInt(localStorage.getItem(localStorageKey) || '0', 10);

              console.log(`ChangeEmailApp: Firestore passwordLastChanged (konvertované): ${firestorePasswordChangedTime}, Stored: ${storedPasswordChangedTime}`);

              if (storedPasswordChangedTime === 0 && firestorePasswordChangedTime !== 0) {
                  localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
                  console.log("ChangeEmailApp: Inicializujem passwordLastChanged v localStorage (prvé načítanie).");
              } else if (firestorePasswordChangedTime > storedPasswordChangedTime) {
                  console.log("ChangeEmailApp: Detekovaná zmena hesla na inom zariadení/relácii. Odhlasujem používateľa.");
                  auth.signOut();
                  window.location.href = 'login.html';
                  localStorage.removeItem(localStorageKey);
                  setUser(null); // Explicitne nastaviť user na null
                  setUserProfileData(null); // Explicitne nastaviť userProfileData na null
                  return;
              } else if (firestorePasswordChangedTime < storedPasswordChangedTime) {
                  console.warn("ChangeEmailApp: Detekovaný starší timestamp z Firestore ako uložený. Odhlasujem používateľa (potenciálny nesúlad).");
                  auth.signOut();
                  window.location.href = 'login.html';
                  localStorage.removeItem(localStorageKey);
                  setUser(null); // Explicitne nastaviť user na null
                  setUserProfileData(null); // Explicitne nastaviť userProfileData na null
                  return;
              } else {
                  localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
              }
              // --- KONIEC LOGIKY ODHLÁSENIA ---

              // NOVÁ LOGIKA: Synchronizácia e-mailu z Firebase Auth do Firestore
              // Ak sa e-mail v Auth líši od e-mailu vo Firestore, aktualizuj Firestore
              if (user.email && userData.email !== user.email) {
                console.log(`ChangeEmailApp: Detekovaná zmena e-mailu v Auth (${user.email}) oproti Firestore (${userData.email}). Aktualizujem Firestore.`);
                userDocRef.update({ email: user.email })
                  .then(() => console.log("ChangeEmailApp: Firestore e-mail úspešne synchronizovaný s Auth."))
                  .catch(syncError => console.error("ChangeEmailApp: Chyba pri synchronizácii e-mailu s Firestore:", syncError));
                // Aktualizujeme userData, aby sa predišlo opätovnému volaniu
                userData.email = user.email;
              }
              // --- KONIEC LOGIKY SYNCHRONIZÁCIE ---

              // NOVÁ LOGIKA: Odhlásenie, ak je používateľ admin a nie je schválený
              if (userData.role === 'admin' && userData.approved === false) {
                  console.log("ChangeEmailApp: Používateľ je admin a nie je schválený. Odhlasujem.");
                  auth.signOut();
                  window.location.href = 'login.html';
                  setUser(null); // Explicitne nastaviť user na null
                  setUserProfileData(null); // Explicitne nastaviť userProfileData na null
                  return; // Zastav ďalšie spracovanie
              }

              setUserProfileData(userData);
              setCurrentEmail(user.email || ''); // Nastaví aktuálny e-mail z Firebase Auth
              setNewEmail(''); // Ponechať prázdne pre novú e-mailovú adresu
              
              setLoading(false);
              setError('');

              if (typeof window.updateMenuItemsVisibility === 'function') {
                  window.updateMenuItemsVisibility(userData.role);
              }

              console.log("ChangeEmailApp: Načítanie používateľských dát dokončené, loading: false");
            } else {
              console.warn("ChangeEmailApp: Používateľský dokument sa nenašiel pre UID:", user.uid);
              setError("Chyba: Používateľský profil sa nenašiel alebo nemáte dostatočné oprávnenia. Skúste sa prosím znova prihlásiť.");
              setLoading(false);
              setUser(null); // Explicitne nastaviť user na null
              setUserProfileData(null); // Explicitne nastaviť userProfileData na null
            }
          }, error => {
            console.error("ChangeEmailApp: Chyba pri načítaní používateľských dát z Firestore (onSnapshot error):", error);
            if (error.code === 'permission-denied') {
                setError(`Chyba oprávnení: Nemáte prístup k svojmu profilu. Skúste sa prosím znova prihlásiť alebo kontaktujte podporu.`);
            } else if (error.code === 'unavailable') {
                setError(`Chyba pripojenia: Služba Firestore je nedostupná. Skúste to prosím neskôr.`);
            } else if (error.code === 'unauthenticated') {
                 setError(`Chyba autentifikácie: Nie ste prihlásený. Skúste sa prosím znova prihlásiť.`);
                 if (auth) {
                    auth.signOut();
                    window.location.href = 'login.html';
                    setUser(null); // Explicitne nastaviť user na null
                    setUserProfileData(null); // Explicitne nastaviť userProfileData na null
                 }
            } else {
                setError(`Chyba pri načítaní používateľských dát: ${error.message}`);
            }
            setLoading(false);
            console.log("ChangeEmailApp: Načítanie používateľských dát zlyhalo, loading: false");
            setUser(null); // Explicitne nastaviť user na null
            setUserProfileData(null); // Explicitne nastaviť userProfileData na null
          });
        } catch (e) {
          console.error("ChangeEmailApp: Chyba pri nastavovaní onSnapshot pre používateľské dáta (try-catch):", e);
          setError(`Chyba pri nastavovaní poslucháča pre používateľské dáta: ${e.message}`);
          setLoading(false);
          setUser(null); // Explicitne nastaviť user na null
          setUserProfileData(null); // Explicitne nastaviť userProfileData na null
        }
      } else { // Ak user nie je null ani undefined, ale je false (napr. po odhlásení)
          setLoading(false);
          setUserProfileData(null); // Zabezpečiť, že userProfileData je null, ak user nie je prihlásený
      }
    } else if (isAuthReady && user === undefined) {
        console.log("ChangeEmailApp: Auth ready, user undefined. Nastavujem loading na false.");
        setLoading(false);
    }

    return () => {
      if (unsubscribeUserDoc) {
        console.log("ChangeEmailApp: Ruším odber onSnapshot pre používateľský dokument.");
        unsubscribeUserDoc();
      }
    };
  }, [isAuthReady, db, user, auth]);

  // Efekt pre aktualizáciu viditeľnosti odkazov v hlavičke
  React.useEffect(() => {
    console.log(`ChangeEmailApp: useEffect pre aktualizáciu odkazov hlavičky. User: ${user ? user.uid : 'null'}`);
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
        console.log("ChangeEmailApp: Používateľ prihlásený. Skryté: Prihlásenie, Registrácia. Zobrazené: Moja zóna, Odhlásenie.");
      } else {
        authLink.classList.remove('hidden');
        profileLink && profileLink.classList.add('hidden');
        logoutButton && logoutButton.classList.add('hidden');
        registerLink && registerLink.classList.remove('hidden'); 
        console.log("ChangeEmailApp: Používateľ odhlásený. Zobrazené: Prihlásenie, Registrácia. Skryté: Moja zóna, Odhlásenie.");
      }
    }
  }, [user]);

  // Spracovanie odhlásenia (potrebné pre tlačidlo odhlásenia v hlavičke)
  const handleLogout = React.useCallback(async () => {
    if (!auth) return;
    try {
      setLoading(true);
      await auth.signOut();
      // Používame globálnu funkciu pre centrálnu notifikáciu
      if (typeof window.showGlobalNotification === 'function') {
        window.showGlobalNotification("Úspešne odhlásený.");
      } else {
        console.warn("ChangeEmailApp: window.showGlobalNotification nie je definovaná.");
      }
      window.location.href = 'login.html';
      setUser(null); // Explicitne nastaviť user na null
      setUserProfileData(null); // Explicitne nastaviť userProfileData na null
    } catch (e) {
      console.error("ChangeEmailApp: Chyba pri odhlásení:", e);
      setError(`Chyba pri odhlásení: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [auth]);

  // Pripojenie obsluhy odhlásenia k tlačidlu v hlavičke
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

  // Obsluha zmeny vstupu e-mailu
  const handleNewEmailChange = (e) => {
    const emailValue = e.target.value;
    setNewEmail(emailValue);
    if (emailTouched && emailValue.trim() !== '' && !validateEmail(emailValue)) {
      setEmailError('Zadajte platnú e-mailovú adresu.');
    } else {
      setEmailError('');
    }
  };

  const handleFocusEmail = () => {
    setEmailTouched(true);
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    setPasswordError(''); // Vyčisti chybu pri zmene hesla
  };

  // Obsluha odoslania formulára pre zmenu e-mailu
  const handleSubmitEmailChange = async (e) => {
    e.preventDefault();

    if (!auth || !auth.currentUser || !db) {
      setError("Chyba: Používateľ nie je prihlásený alebo databáza nie je dostupná.");
      return;
    }

    if (!validateEmail(newEmail)) {
      setEmailError('Zadajte platnú e-mailovú adresu.');
      return;
    }
    if (newEmail === currentEmail) {
      setEmailError('Nová e-mailová adresa musí byť odlišná od pôvodnej.');
      return;
    }
    if (password.length < 10) {
      setPasswordError('Pre zmenu e-mailu zadajte svoje aktuálne heslo (min. 10 znakov).');
      return;
    }

    setLoading(true);
    setError('');
    setUserNotificationMessage('');

    try {
      // Re-autentifikácia používateľa
      const credential = firebase.auth.EmailAuthProvider.credential(auth.currentUser.email, password);
      await auth.currentUser.reauthenticateWithCredential(credential);
      console.log("ChangeEmailApp: Používateľ úspešne re-autentifikovaný.");

      // Zmena e-mailu vo Firebase Authentication
      await auth.currentUser.verifyBeforeUpdateEmail(newEmail);
      console.log("ChangeEmailApp: Overovací e-mail bol odoslaný na novú adresu.");

      // NEAKTUALIZUJEME FIRESTORE HNEĎ! Firestore sa aktualizuje až po overení e-mailu používateľom
      // pomocou synchronizačnej logiky v useEffect, ktorá počúva zmeny v user.email (v logged-in-my-data.js, logged-in-users.js atď.)

      setUserNotificationMessage("Overovací e-mail bol odoslaný na novú adresu. Prosím, skontrolujte si schránku a overte e-mail.");
      // Reset formulára po odoslaní
      setPassword('');

    } catch (e) {
      console.error("ChangeEmailApp: Chyba pri zmene vlastného e-mailu:", e);
      let errorMessage = "Chyba pri zmene e-mailu.";
      if (e.code === 'auth/requires-recent-login') {
        errorMessage = "Pre zmenu e-mailu sa musíte znova prihlásiť. Prosím, odhláste sa a prihláste sa znova.";
      } else if (e.code === 'auth/wrong-password') {
        errorMessage = "Zadané heslo je nesprávne.";
      } else if (e.code === 'auth/invalid-email') {
        errorMessage = "Zadaná e-mailová adresa je neplatná.";
      } else if (e.code === 'auth/email-already-in-use') {
        errorMessage = "Táto e-mailová adresa je už používaná iným účtom.";
      } else {
        errorMessage = `Chyba: ${e.message}`;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Kontrola, či je formulár platný pre stav disabled tlačidla
  const isFormValid = validateEmail(newEmail) && newEmail !== currentEmail && password.length >= 6;

  // Dynamické triedy pre tlačidlo na základe stavu disabled
  const buttonClasses = `
    font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200
    ${loading || !isFormValid
      ? 'bg-white text-blue-500 border border-blue-500 cursor-not-allowed' // Zakázaný stav
      : 'bg-blue-500 hover:bg-blue-700 text-white' // Aktívny stav
    }
  `;

  // Zobrazenie stavu načítania
  if (!isAuthReady || user === undefined || (user && !userProfileData) || loading) {
    if (isAuthReady && user === null) { 
        console.log("ChangeEmailApp: Auth je ready a používateľ je null, presmerovávam na login.html");
        window.location.href = 'login.html';
        return null;
    }

    let loadingMessage = 'Načítavam...';
    if (isAuthReady && user && !userProfileData) {
        loadingMessage = 'Načítavam profilové dáta...';
    } else if (loading) {
        loadingMessage = 'Načítavam...';
    }

    return React.createElement(
      'div',
      { className: 'flex items-center justify-center min-h-screen bg-gray-100' },
      React.createElement('div', { className: 'text-xl font-semibold text-gray-700' }, loadingMessage)
    );
  }

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
    React.createElement(NotificationModal, {
        message: userNotificationMessage,
        onClose: () => setUserNotificationMessage(''),
        type: error ? 'error' : 'success'
    }),
    React.createElement(
      'div',
      { className: 'w-full max-w-md mt-20 mb-10 p-4' },
      error && React.createElement(
        'div',
        { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap', role: 'alert' },
        error
      ),
      React.createElement(
        'div',
        { className: 'bg-white p-8 rounded-lg shadow-xl w-full' },
        React.createElement('h1', { className: 'text-3xl font-bold text-center text-gray-800 mb-6' },
          'Zmeniť e-mailovú adresu'
        ),
        React.createElement(
            'form',
            { onSubmit: handleSubmitEmailChange, className: 'space-y-4' },
            // Nové pole pre aktuálnu e-mailovú adresu
            React.createElement(
              'div',
              null,
              React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'current-email' }, 'Aktuálna e-mailová adresa'),
              React.createElement('input', {
                type: 'email',
                id: 'current-email',
                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-gray-100 cursor-not-allowed',
                value: currentEmail,
                disabled: true, // Zablokovaný input
              })
            ),
            // Existujúce pole pre novú e-mailovú adresu
            React.createElement(
              'div',
              null,
              React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'new-email' }, 'Nová e-mailová adresa'),
              React.createElement('input', {
                type: 'email',
                id: 'new-email',
                className: `shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 ${emailError ? 'border-red-500' : ''}`,
                value: newEmail,
                onChange: handleNewEmailChange,
                onFocus: handleFocusEmail,
                required: true,
                placeholder: 'Zadajte novú e-mailovú adresu',
                disabled: loading,
              }),
              emailError && React.createElement(
                'p',
                { className: 'text-red-500 text-xs italic mt-1' },
                emailError
              )
            ),
            // Existujúce pole pre aktuálne heslo
            React.createElement(
              'div',
              null,
              React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'current-password' }, 'Aktuálne heslo'),
              React.createElement('input', {
                type: 'password',
                id: 'current-password',
                className: `shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 ${passwordError ? 'border-red-500' : ''}`,
                value: password,
                onChange: handlePasswordChange,
                required: true,
                placeholder: 'Zadajte svoje aktuálne heslo',
                disabled: loading,
              }),
              passwordError && React.createElement(
                'p',
                { className: 'text-red-500 text-xs italic mt-1' },
                passwordError
              )
            ),
            React.createElement(
              'button',
              {
                type: 'submit',
                className: buttonClasses,
                disabled: loading || !isFormValid,
              },
              loading ? 'Ukladám...' : 'Uložiť zmeny'
            )
          )
        )
      )
    );
}

// Explicitne sprístupniť komponent globálne
window.ChangeEmailApp = ChangeEmailApp;
