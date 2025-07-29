// logged-in-change-email.js
// Tento súbor obsahuje React komponent pre zmenu e-mailovej adresy prihláseného používateľa.
// Predpokladá, že firebaseConfig, initialAuthToken a appId sú globálne definované v HTML súbore.

// NotificationModal Component for displaying temporary messages (converted to React.createElement)
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

  // Dynamické triedy pre farbu pozadia na základe typu správy
  let bgColorClass;
  if (type === 'success') {
    bgColorClass = 'bg-[#3A8D41]'; // Zelená
  } else if (type === 'error') {
    bgColorClass = 'bg-red-600'; // Červená
  } else {
    bgColorClass = 'bg-blue-500'; // Predvolená modrá pre info
  }

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
        className: `${bgColorClass} text-white px-6 py-3 rounded-lg shadow-lg max-w-md w-full text-center`,
        style: { pointerEvents: 'auto' }
      },
      React.createElement('p', { className: 'font-semibold' }, message)
    )
  );
}

// MyEmailChangeModal Component pre zmenu vlastného e-mailu (presunuté z logged-in-users.js)
function MyEmailChangeModal({ show, currentEmail, onClose, onSave, loading, error: modalError, message: modalMessage }) {
  const [newEmail, setNewEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [emailTouched, setEmailTouched] = React.useState(false);
  const [emailError, setEmailError] = React.useState('');
  const [passwordError, setPasswordError] = React.useState('');

  React.useEffect(() => {
    if (show) {
      setNewEmail(currentEmail);
      setPassword('');
      setEmailTouched(false);
      setEmailError('');
      setPasswordError('');
    }
  }, [show, currentEmail]);

  if (!show) return null;

  // Funkcia na validáciu emailu
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

  const handleEmailChange = (e) => {
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

  const handleSave = async () => {
    if (!validateEmail(newEmail)) {
      setEmailError('Zadajte platnú e-mailovú adresu.');
      return;
    }
    if (newEmail === currentEmail) {
      setEmailError('Nová e-mailová adresa musí byť odlišná od pôvodnej.');
      return;
    }
    if (password.length < 6) { // Firebase vyžaduje min. 6 znakov pre heslo
      setPasswordError('Pre zmenu e-mailu zadajte svoje aktuálne heslo (min. 6 znakov).');
      return;
    }
    onSave(newEmail, password);
  };

  const isSaveDisabled = loading || !validateEmail(newEmail) || newEmail === currentEmail || password.length < 6;

  return React.createElement(
    'div',
    { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50' },
    React.createElement(
      'div',
      { className: 'bg-white p-6 rounded-lg shadow-xl max-w-sm w-full' },
      React.createElement('h2', { className: 'text-xl font-bold mb-4' }, `Zmeniť moju e-mailovú adresu`),
      modalError && React.createElement( // Zobrazenie chýb z rodičovského komponentu
        'p',
        { className: 'text-red-500 text-xs italic mb-2' },
        modalError
      ),
      modalMessage && React.createElement( // Zobrazenie správ z rodičovského komponentu
        'p',
        { className: 'text-green-600 text-xs italic mb-2' },
        modalMessage
      ),
      React.createElement(
        'div',
        { className: 'mb-4' },
        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'my-new-email' }, 'Nová e-mailová adresa'),
        React.createElement('input', {
          type: 'email',
          id: 'my-new-email',
          className: `shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 ${emailError ? 'border-red-500' : ''}`,
          value: newEmail,
          onChange: handleEmailChange,
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
      React.createElement(
        'div',
        { className: 'mb-4' },
        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'my-current-password' }, 'Aktuálne heslo'),
        React.createElement('input', {
          type: 'password',
          id: 'my-current-password',
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
        'div',
        { className: 'flex justify-end space-x-4' },
        React.createElement(
          'button',
          {
            onClick: onClose,
            className: 'bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded-lg transition-colors duration-200',
            disabled: loading,
          },
          'Zrušiť'
        ),
        React.createElement(
          'button',
          {
            onClick: handleSave,
            className: 'bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg transition-colors duration-200',
            disabled: isSaveDisabled,
          },
          loading ? 'Ukladám...' : 'Zmeniť'
        )
      )
    )
  );
}


// Main React component for the logged-in-change-email.html page
function ChangeEmailApp() {
  const [app, setApp] = React.useState(null);
  const [auth, setAuth] = React.useState(null);
  const [db, setDb] = React.useState(null);
  const [user, setUser] = React.useState(undefined); // Firebase User object from onAuthStateChanged
  const [userProfileData, setUserProfileData] = React.useState(null); 
  const [isAuthReady, setIsAuthReady] = React.useState(false); // Nový stav pre pripravenosť autentifikácie
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [userNotificationMessage, setUserNotificationMessage] = React.useState('');

  // User Data States - Tieto stavy sa budú aktualizovať z userProfileData
  const [currentEmail, setCurrentEmail] = React.useState(''); // Bude nastavený z user.email alebo userProfileData.email

  // NOVINKA: Stavy pre MyEmailChangeModal
  const [showMyEmailModal, setShowMyEmailModal] = React.useState(false);
  const [myEmailModalError, setMyEmailModalError] = React.useState('');
  const [myEmailModalMessage, setMyEmailModalMessage] = React.useState('');

  // Zabezpečíme, že appId je definované (používame globálnu premennú)
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'; 


  // Effect for Firebase initialization and Auth Listener setup (runs only once)
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
        setIsAuthReady(true); // Mark auth as ready after the first check
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

  // NOVÝ EFFECT: Načítanie používateľských dát z Firestore po inicializácii Auth a DB
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

  // Effect for updating header link visibility
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

  // Handle logout (needed for the header logout button)
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

  // NOVÁ FUNKCIA: Otvorenie MyEmailChangeModal
  const openMyEmailModal = () => {
    setMyEmailModalError('');
    setMyEmailModalMessage('');
    setShowMyEmailModal(true);
  };

  // NOVÁ FUNKCIA: Zatvorenie MyEmailChangeModal
  const closeMyEmailModal = () => {
    setShowMyEmailModal(false);
    setMyEmailModalError('');
    setMyEmailModalMessage('');
  };

  // NOVÁ FUNKCIA: handleSaveMyEmail - pre zmenu vlastného e-mailu (presunuté z logged-in-users.js)
  const handleSaveMyEmail = async (newEmail, password) => {
    if (!auth || !auth.currentUser || !db) {
      setMyEmailModalError("Chyba: Používateľ nie je prihlásený alebo databáza nie je dostupná.");
      return;
    }

    setLoading(true);
    setMyEmailModalError('');
    setMyEmailModalMessage('');

    try {
      // Re-autentifikácia používateľa
      const credential = firebase.auth.EmailAuthProvider.credential(auth.currentUser.email, password);
      await auth.currentUser.reauthenticateWithCredential(credential);
      console.log("ChangeEmailApp: Používateľ úspešne re-autentifikovaný.");

      // Zmena e-mailu vo Firebase Authentication
      // Namiesto updateEmail voláme verifyBeforeUpdateEmail, ak je povolená ochrana pred enumeráciou e-mailov.
      await auth.currentUser.verifyBeforeUpdateEmail(newEmail);
      console.log("ChangeEmailApp: Overovací e-mail bol odoslaný na novú adresu.");

      // NEAKTUALIZUJEME FIRESTORE HNEĎ! Firestore sa aktualizuje až po overení e-mailu používateľom
      // pomocou synchronizačnej logiky v useEffect, ktorá počúva zmeny v user.email.

      setMyEmailModalMessage("Overovací e-mail bol odoslaný na novú adresu. Prosím, skontrolujte si schránku a overte e-mail.");
      if (typeof window.showGlobalNotification === 'function') {
        window.showGlobalNotification("Overovací e-mail bol odoslaný na novú adresu. Prosím, overte e-mail.", 'info');
      }
      // Po odoslaní overovacieho e-mailu môžete modál zavrieť po krátkej dobe
      setTimeout(() => {
        closeMyEmailModal();
      }, 3000); // Dlhší čas, aby si používateľ prečítal správu

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
      setMyEmailModalError(errorMessage);
      if (typeof window.showGlobalNotification === 'function') {
        window.showGlobalNotification(errorMessage, 'error');
      }
    } finally {
      setLoading(false);
    }
  };


  // Display loading state
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
    // NOVINKA: Vykreslenie MyEmailChangeModal pre vlastnú zmenu e-mailu
    user && React.createElement(MyEmailChangeModal, {
        show: showMyEmailModal,
        currentEmail: currentEmail, // Používame aktuálny e-mail zo stavu
        onClose: closeMyEmailModal,
        onSave: handleSaveMyEmail,
        loading: loading,
        error: myEmailModalError,
        message: myEmailModalMessage,
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
          'Zmeniť e-mail'
        ),
        // Tlačidlo pre zmenu vlastného e-mailu
        React.createElement(
            'div',
            { className: 'flex justify-center mb-6' },
            React.createElement(
                'button',
                {
                    onClick: openMyEmailModal,
                    className: 'bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200 shadow-md',
                    disabled: loading,
                },
                'Zmeniť môj e-mail'
            )
        ),
        React.createElement(
            'p',
            { className: 'text-center text-gray-600' },
            `Váš aktuálny e-mail: ${currentEmail}`
        )
      )
    )
  );
}

// Explicitne sprístupniť komponent globálne
window.ChangeEmailApp = ChangeEmailApp;
