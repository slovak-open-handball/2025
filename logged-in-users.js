// logged-in-users.js (teraz obsahuje UsersManagementApp pre správu používateľov)
// Tento súbor predpokladá, že firebaseConfig, initialAuthToken a appId
// sú globálne definované v <head> logged-in-users.html.

// Všetky komponenty a logika pre správu používateľov sú teraz v tomto súbore.

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

// RoleEditModal Component (converted to React.createElement)
function RoleEditModal({ show, user, onClose, onSave, loading }) {
  const [selectedRole, setSelectedRole] = React.useState(user ? user.role : 'user');
  const [isApproved, setIsApproved] = React.useState(user ? user.approved : false);

  React.useEffect(() => {
    if (user) {
      setSelectedRole(user.role);
      setIsApproved(user.approved);
    }
  }, [user]);

  if (!show || !user) return null;

  const handleSave = () => {
    // Používame user.id namiesto user.uid
    onSave(user.id, selectedRole, isApproved); 
  };

  return React.createElement(
    'div',
    { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50' },
    React.createElement(
      'div',
      { className: 'bg-white p-6 rounded-lg shadow-xl max-w-sm w-full' },
      React.createElement('h2', { className: 'text-xl font-bold mb-4' }, `Upraviť rolu pre ${user.email}`),
      React.createElement(
        'div',
        { className: 'mb-4' },
        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'role-select' }, 'Rola'),
        React.createElement(
          'select',
          {
            id: 'role-select',
            className: 'shadow border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
            value: selectedRole,
            onChange: (e) => setSelectedRole(e.target.value),
            disabled: loading,
          },
          React.createElement('option', { value: 'user' }, 'Používateľ'),
          React.createElement('option', { value: 'admin' }, 'Administrátor')
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
            disabled: loading,
          },
          loading ? 'Ukladám...' : 'Uložiť'
        )
      )
    )
  );
}

// NOVÝ KOMPONENT: ChangeEmailModal
function ChangeEmailModal({ show, user, onClose, onSave, loading }) {
  const [newEmail, setNewEmail] = React.useState('');
  const [emailTouched, setEmailTouched] = React.useState(false);
  const [emailError, setEmailError] = React.useState('');

  React.useEffect(() => {
    if (show && user) {
      setNewEmail(user.email);
      setEmailTouched(false);
      setEmailError('');
    }
  }, [show, user]);

  if (!show || !user) return null;

  // Funkcia na validáciu emailu (skopírovaná z admin-register.js)
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

  const handleFocus = () => {
    setEmailTouched(true);
  };

  const handleSave = async () => {
    if (!validateEmail(newEmail)) {
      setEmailError('Zadajte platnú e-mailovú adresu.');
      return;
    }
    if (newEmail === user.email) {
      setEmailError('Nová e-mailová adresa musí byť odlišná od pôvodnej.');
      return;
    }
    onSave(user.id, newEmail);
  };

  const isSaveDisabled = loading || !validateEmail(newEmail) || newEmail === user.email;


  return React.createElement(
    'div',
    { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50' },
    React.createElement(
      'div',
      { className: 'bg-white p-6 rounded-lg shadow-xl max-w-sm w-full' },
      React.createElement('h2', { className: 'text-xl font-bold mb-4' }, `Zmeniť e-mail pre ${user.email}`),
      React.createElement(
        'div',
        { className: 'mb-4' },
        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'new-email' }, 'Nová e-mailová adresa'),
        React.createElement('input', {
          type: 'email',
          id: 'new-email',
          className: `shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 ${emailError ? 'border-red-500' : ''}`,
          value: newEmail,
          onChange: handleEmailChange,
          onFocus: handleFocus,
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


// Main React component for the logged-in-users.html page (now for user management)
function UsersManagementApp() {
  const [app, setApp] = React.useState(null);
  const [auth, setAuth] = React.useState(null);
  const [db, setDb] = React.useState(null);
  const [user, setUser] = React.useState(undefined); // Firebase User object from onAuthStateChanged
  const [userProfileData, setUserProfileData] = React.useState(null); 
  const [isAuthReady, setIsAuthReady] = React.useState(false); // Nový stav pre pripravenosť autentifikácie
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [userNotificationMessage, setUserNotificationMessage] = React.useState('');

  const [users, setUsers] = React.useState([]);

  const [showRoleEditModal, setShowRoleEditModal] = React.useState(false);
  const [userToEditRole, setUserToEditRole] = React.useState(null);

  // NOVÉ STAVY: Pre ChangeEmailModal
  const [showChangeEmailModal, setShowChangeEmailModal] = React.useState(false);
  const [userToChangeEmail, setUserToChangeEmail] = React.useState(null);

  // ODSTRÁNENÉ: isChangingOtherUserEmail už nie je potrebný s Apps Script prístupom
  // const [isChangingOtherUserEmail, setIsChangingOtherUserEmail] = React.useState(false);


  // Zabezpečíme, že appId je definované (používame globálnu premennú)
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'; 

  // URL adresa Google Apps Scriptu, ktorú ste poskytli
  const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxlYhxOSFBAw4N2hUts_1rWxVS0PzN8GKngWofEEfGtJtK3dnjeogcBY999We-UdoMd1w/exec";


  // Effect for Firebase initialization and Auth Listener setup (runs only once)
  React.useEffect(() => {
    let unsubscribeAuth;
    let firestoreInstance;

    try {
      if (typeof firebase === 'undefined') {
        console.error("UsersManagementApp: Firebase SDK nie je načítané.");
        setError("Firebase SDK nie je načítané. Skontrolujte logged-in-users.html.");
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
          console.error("UsersManagementApp: Chyba pri počiatočnom prihlásení Firebase (s custom tokenom):", e);
          setError(`Chyba pri prihlásení: ${e.message}`);
        }
      };

      unsubscribeAuth = authInstance.onAuthStateChanged(async (currentUser) => {
        console.log("UsersManagementApp: onAuthStateChanged - Používateľ:", currentUser ? currentUser.uid : "null");
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
      console.error("UsersManagementApp: Nepodarilo sa inicializovať Firebase:", e);
      setError(`Chyba pri inicializácii Firebase: ${e.message}`);
      setLoading(false);
    }
  }, []);

  // NOVÝ EFFECT: Načítanie používateľských dát z Firestore po inicializácii Auth a DB
  React.useEffect(() => {
    let unsubscribeUserDoc;

    if (isAuthReady && db && user !== undefined) {
      // ODSTRÁNENÉ: Logika pre isChangingOtherUserEmail a podmienené presmerovanie
      if (user === null) { 
        console.log("UsersManagementApp: Auth je ready a používateľ je null, presmerovávam na login.html");
        window.location.href = 'login.html';
        return;
      }

      if (user) {
        console.log(`UsersManagementApp: Pokúšam sa načítať používateľský dokument pre UID: ${user.uid}`);
        setLoading(true);

        try {
          const userDocRef = db.collection('users').doc(user.uid);
          unsubscribeUserDoc = userDocRef.onSnapshot(docSnapshot => {
            console.log("UsersManagementApp: onSnapshot pre používateľský dokument spustený.");
            if (docSnapshot.exists) {
              const userData = docSnapshot.data();
              console.log("UsersManagementApp: Používateľský dokument existuje, dáta:", userData);

              // --- LOGIKA ODHLÁSENIA NA ZÁKLADE passwordLastChanged ---
              // Táto kontrola sa teraz vykonáva vždy, pretože zmena e-mailu je na serveri
              if (!userData.passwordLastChanged || typeof userData.passwordLastChanged.toDate !== 'function') {
                  console.error("UsersManagementApp: passwordLastChanged NIE JE platný Timestamp objekt! Typ:", typeof userData.passwordLastChanged, "Hodnota:", userData.passwordLastChanged);
                  console.log("UsersManagementApp: Okamžite odhlasujem používateľa kvôli neplatnému timestampu zmeny hesla.");
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

              console.log(`UsersManagementApp: Firestore passwordLastChanged (konvertované): ${firestorePasswordChangedTime}, Stored: ${storedPasswordChangedTime}`);

              if (storedPasswordChangedTime === 0 && firestorePasswordChangedTime !== 0) {
                  localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
                  console.log("UsersManagementApp: Inicializujem passwordLastChanged v localStorage (prvé načítanie).");
              } else if (firestorePasswordChangedTime > storedPasswordChangedTime) {
                  console.log("UsersManagementApp: Detekovaná zmena hesla na inom zariadení/relácii. Odhlasujem používateľa.");
                  auth.signOut();
                  window.location.href = 'login.html';
                  localStorage.removeItem(localStorageKey);
                  setUser(null); // Explicitne nastaviť user na null
                  setUserProfileData(null); // Explicitne nastaviť userProfileData na null
                  return;
              } else if (firestorePasswordChangedTime < storedPasswordChangedTime) {
                  console.warn("UsersManagementApp: Detekovaný starší timestamp z Firestore ako uložený. Odhlasujem používateľa (potenciálny nesúlad).");
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

              // NOVÁ LOGIKA: Odhlásenie, ak je používateľ admin a nie je schválený
              if (userData.role === 'admin' && userData.approved === false) {
                  console.log("UsersManagementApp: Používateľ je admin a nie je schválený. Odhlasujem.");
                  auth.signOut();
                  window.location.href = 'login.html';
                  setUser(null); // Explicitne nastaviť user na null
                  setUserProfileData(null); // Explicitne nastaviť userProfileData na null
                  return; // Zastav ďalšie spracovanie
              }

              setUserProfileData(userData);
              
              setLoading(false);
              setError('');

              if (typeof window.updateMenuItemsVisibility === 'function') {
                  window.updateMenuItemsVisibility(userData.role);
              }

              console.log("UsersManagementApp: Načítanie používateľských dát dokončené, loading: false");
            } else {
              console.warn("UsersManagementApp: Používateľský dokument sa nenašiel pre UID:", user.uid);
              setError("Chyba: Používateľský profil sa nenašiel alebo nemáte dostatočné oprávnenia. Skúste sa prosím znova prihlásiť.");
              setLoading(false);
              setUser(null); // Explicitne nastaviť user na null
              setUserProfileData(null); // Explicitne nastaviť userProfileData na null
            }
          }, error => {
            console.error("UsersManagementApp: Chyba pri načítaní používateľských dát z Firestore (onSnapshot error):", error);
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
            console.log("UsersManagementApp: Načítanie používateľských dát zlyhalo, loading: false");
            setUser(null); // Explicitne nastaviť user na null
            setUserProfileData(null); // Explicitne nastaviť userProfileData na null
          });
        } catch (e) {
          console.error("UsersManagementApp: Chyba pri nastavovaní onSnapshot pre používateľské dáta (try-catch):", e);
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
        console.log("UsersManagementApp: Auth ready, user undefined. Nastavujem loading na false.");
        setLoading(false);
    }

    return () => {
      if (unsubscribeUserDoc) {
        console.log("UsersManagementApp: Ruším odber onSnapshot pre používateľský dokument.");
        unsubscribeUserDoc();
      }
    };
  }, [isAuthReady, db, user, auth]); // ODSTRÁNENÁ závislosť 'isChangingOtherUserEmail'

  // Effect for updating header link visibility
  React.useEffect(() => {
    console.log(`UsersManagementApp: useEffect pre aktualizáciu odkazov hlavičky. User: ${user ? user.uid : 'null'}`);
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
        console.log("UsersManagementApp: Používateľ prihlásený. Skryté: Prihlásenie, Registrácia. Zobrazené: Moja zóna, Odhlásenie.");
      } else {
        authLink.classList.remove('hidden');
        profileLink && profileLink.classList.add('hidden');
        logoutButton && logoutButton.classList.add('hidden');
        registerLink && registerLink.classList.remove('hidden'); 
        console.log("UsersManagementApp: Používateľ odhlásený. Zobrazené: Prihlásenie, Registrácia. Skryté: Moja zóna, Odhlásenie.");
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
        console.warn("UsersManagementApp: window.showGlobalNotification nie je definovaná.");
      }
      window.location.href = 'login.html';
      setUser(null); // Explicitne nastaviť user na null
      setUserProfileData(null); // Explicitne nastaviť userProfileData na null
    } catch (e) {
      console.error("UsersManagementApp: Chyba pri odhlásení:", e);
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

  // Effect for fetching users (runs after DB and userProfileData are ready and user is admin)
  React.useEffect(() => {
    let unsubscribeUsers;

    if (db && userProfileData && userProfileData.role === 'admin' && userProfileData.approved === true) {
      console.log("UsersManagementApp: Prihlásený používateľ je schválený administrátor. Načítavam používateľov.");
      setLoading(true);
      try {
        unsubscribeUsers = db.collection('users').onSnapshot(snapshot => {
          const fetchedUsers = [];
          snapshot.forEach(doc => {
            fetchedUsers.push({ id: doc.id, ...doc.data() });
          });
          setUsers(fetchedUsers);
          setLoading(false);
          setError('');
          console.log("UsersManagementApp: Používatelia aktualizovaní z onSnapshot.");
        }, error => {
          console.error("UsersManagementApp: Chyba pri načítaní používateľov z Firestore (onSnapshot error):", error);
          setError(`Chyba pri načítaní používateľov: ${error.message}`);
          setLoading(false);
        });
      } catch (e) {
        console.error("UsersManagementApp: Chyba pri nastavovaní onSnapshot pre používateľov (try-catch):", e);
        setError(`Chyba pri nastavovaní poslucháča pre používateľov: ${e.message}`);
        setLoading(false);
      }
    } else {
        setUsers([]); // Vyčisti používateľov, ak nie je admin
    }

    return () => {
      if (unsubscribeUsers) {
        console.log("UsersManagementApp: Ruším odber onSnapshot pre používateľov.");
        unsubscribeUsers();
      }
    };
  }, [db, userProfileData]); // Závisí od db a userProfileData (pre rolu admina)

  const openConfirmationModal = (user) => {
    setUserNotificationMessage(`Používateľ ${user.email} bude zmazaný. Je potrebné ho manuálne zmazať aj vo Firebase Console.`, 'info');
  };

  const openRoleEditModal = (user) => {
    setUserToEditRole(user);
    setShowRoleEditModal(true);
  };

  const closeRoleEditModal = () => {
    setUserToEditRole(null);
    setShowRoleEditModal(false);
  };

  // NOVÁ FUNKCIA: Otvorenie ChangeEmailModal
  const openChangeEmailModal = (user) => {
    setUserToChangeEmail(user);
    setShowChangeEmailModal(true);
  };

  // NOVÁ FUNKCIA: Zatvorenie ChangeEmailModal
  const closeChangeEmailModal = () => {
    setUserToChangeEmail(null);
    setShowChangeEmailModal(false);
  };

  // NOVÁ FUNKCIA: Prepnúť stav schválenia administrátora
  const handleToggleAdminApproval = async (userToToggle) => {
    if (!db || !userProfileData || userProfileData.role !== 'admin') {
      setError("Nemáte oprávnenie na zmenu stavu schválenia.");
      return;
    }
    setLoading(true);
    setError('');
    if (typeof window.showGlobalNotification === 'function') {
        window.showGlobalNotification(''); // Vyčistíme predchádzajúcu správu
    } else {
        console.warn("UsersManagementApp: window.showGlobalNotification nie je definovaná.");
    }
    
    try {
      const newApprovedStatus = !userToToggle.approved; // Prepnúť aktuálny stav
      const userDocRef = db.collection('users').doc(userToToggle.id);
      await userDocRef.update({ approved: newApprovedStatus });

      const actionMessage = newApprovedStatus ? 'schválený' : 'odobratý prístup';
      if (typeof window.showGlobalNotification === 'function') {
        window.showGlobalNotification(`Používateľ ${userToToggle.email} bol ${actionMessage}.`, 'success');
      } else {
        console.warn("UsersManagementApp: window.showGlobalNotification nie je definovaná.");
      }

      await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('adminNotifications').add({
        message: `Používateľ ${userToToggle.email} bol ${actionMessage}.`,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        recipientId: 'all_admins',
        read: false
      });
      console.log(`Notifikácia o ${actionMessage} používateľa úspešne uložená do Firestore.`);

    } catch (e) {
      console.error("UsersManagementApp: Chyba pri zmene stavu schválenia:", e);
      setError(`Chyba pri zmene stavu schválenia: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRole = async (userId, newRole, newIsApproved) => {
    if (!db || !userProfileData || userProfileData.role !== 'admin') {
      setError("Nemáte oprávnenie na zmenu roly používateľa.");
      return;
    }
    setLoading(true);
    setError('');
    if (typeof window.showGlobalNotification === 'function') {
        window.showGlobalNotification(''); // Vyčistíme predchádzajúcu správu
    } else {
        console.warn("UsersManagementApp: window.showGlobalNotification nie je definovaná.");
    }

    try {
      const userDocRef = db.collection('users').doc(userId);
      
      const approvedStatus = (newRole === 'user') ? true : false; 

      await userDocRef.update({ role: newRole, approved: approvedStatus });
      
      if (typeof window.showGlobalNotification === 'function') {
        window.showGlobalNotification(`Rola používateľa ${userToEditRole.email} bola zmenená na ${newRole}.`, 'success');
      } else {
        console.warn("UsersManagementApp: window.showGlobalNotification nie je definovaná.");
      }
      
      closeRoleEditModal();

      if (user && user.uid === userId && newRole === 'admin' && approvedStatus === false) {
          console.log("UsersManagementApp: Rola používateľa zmenená na neschváleného admina. Odhlasujem.");
          await auth.signOut();
          window.location.href = 'login.html';
          setUser(null);
          setUserProfileData(null);
          return;
      }

      await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('adminNotifications').add({
        message: `Rola používateľa ${userToEditRole.email} bola zmenená na ${newRole}. Schválený: ${approvedStatus ? 'Áno' : 'Nie'}.`,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        recipientId: 'all_admins',
        read: false
      });
      console.log("Notifikácia o zmene roly používateľa úspešne uložená do Firestore.");

    } catch (e) {
      console.error("UsersManagementApp: Chyba pri ukladaní roly:", e);
      setError(`Chyba pri ukladaní roly: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // NOVÁ FUNKCIA: handleSaveEmail - teraz volá Google Apps Script
  const handleSaveEmail = async (userId, newEmail) => {
    if (!db || !userProfileData || userProfileData.role !== 'admin') {
      setError("Nemáte oprávnenie na zmenu e-mailovej adresy používateľa.");
      return;
    }

    // Kontrola, či sa administrátor pokúša zmeniť vlastný e-mail
    if (auth.currentUser && userId === auth.currentUser.uid) {
      setError("Nemôžete zmeniť vlastnú e-mailovú adresu prostredníctvom tejto funkcie. Použite prosím sekciu 'Môj profil' pre zmenu vlastného e-mailu.");
      setLoading(false);
      closeChangeEmailModal();
      return;
    }

    setLoading(true);
    setError('');
    if (typeof window.showGlobalNotification === 'function') {
        window.showGlobalNotification(''); // Vyčistíme predchádzajúcu správu
    } else {
        console.warn("UsersManagementApp: window.showGlobalNotification nie je definovaná.");
    }

    try {
      // Pripravíme dáta pre Google Apps Script
      const requestData = {
        action: 'changeUserEmail',
        userId: userId,
        newEmail: newEmail
      };

      // Pošleme požiadavku na Google Apps Script
      // Dôležité: V režime 'no-cors' nemôžeme čítať odpoveď servera ani posielať vlastné hlavičky Content-Type.
      // Toto sa používa len na obídenie CORS chýb, ale neposkytuje spätnú väzbu o úspechu/zlyhaní operácie na serveri.
      const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'cors', // ZMENA: Naspäť na 'cors'
        headers: { 'Content-Type': 'application/json' }, // ZMENA: Naspäť hlavička Content-Type
        body: JSON.stringify(requestData),
      });

      // V režime 'cors' môžeme čítať odpoveď servera a kontrolovať response.ok.
      const result = await response.json();

      if (response.ok && result.status === 'success') {
        // Ak Apps Script úspešne zmenil e-mail v Auth, aktualizujeme aj Firestore
        const userDocRef = db.collection('users').doc(userId);
        await userDocRef.update({ email: newEmail });

        if (typeof window.showGlobalNotification === 'function') {
          window.showGlobalNotification(`E-mail používateľa ${userToChangeEmail.email} bol úspešne zmenený na ${newEmail}.`, 'success');
        } else {
          console.warn("UsersManagementApp: window.showGlobalNotification nie je definovaná.");
        }
        closeChangeEmailModal();

        // Uložiť notifikáciu pre všetkých administrátorov
        await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('adminNotifications').add({
          message: `E-mail používateľa ${userToChangeEmail.email} bol zmenený na ${newEmail}.`,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          recipientId: 'all_admins',
          read: false
        });
        console.log("Notifikácia o zmene e-mailu používateľa úspešne uložená do Firestore.");

      } else {
        const errorMessage = result.message || 'Neznáma chyba pri zmene e-mailu.';
        setError(`Chyba pri zmene e-mailu: ${errorMessage}. Skontrolujte logy Google Apps Scriptu.`);
        if (typeof window.showGlobalNotification === 'function') {
          window.showGlobalNotification(`Chyba pri zmene e-mailu: ${errorMessage}.`, 'error');
        }
      }

    } catch (e) {
      console.error("UsersManagementApp: Chyba pri zmene e-mailu používateľa (fetch error):", e);
      setError(`Chyba pri zmene e-mailu: ${e.message}. Skontrolujte logy Google Apps Scriptu a nastavenia CORS.`);
      if (typeof window.showGlobalNotification === 'function') {
        window.showGlobalNotification(`Chyba pri zmene e-mailu: ${e.message}.`, 'error');
      }
    } finally {
      setLoading(false);
    }
  };


  // Funkcia confirmDeleteUser teraz prijíma používateľa priamo z onClick
  const confirmDeleteUser = async (userToConfirmDelete) => {
    if (!db || !userToConfirmDelete || !userProfileData || userProfileData.role !== 'admin') {
      setError("Nemáte oprávnenie na zmazanie používateľa.");
      return;
    }
    setLoading(true);
    setError('');
    if (typeof window.showGlobalNotification === 'function') {
        window.showGlobalNotification(''); // Vyčistíme predchádzajúcu správu
    } else {
        console.warn("UsersManagementApp: window.showGlobalNotification nie je definovaná.");
    }

    try {
      // Pripravíme dáta pre Google Apps Script na zmazanie používateľa
      const requestData = {
        action: 'deleteUser', // Akcia, ktorú spracuje Apps Script
        userId: userToConfirmDelete.id
      };

      // Pošleme požiadavku na Google Apps Script
      const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'cors', // ZMENA: Naspäť na 'cors'
        headers: { 'Content-Type': 'application/json' }, // ZMENA: Naspäť hlavička Content-Type
        body: JSON.stringify(requestData),
      });

      // V režime 'cors' môžeme čítať odpoveď servera a kontrolovať response.ok.
      const result = await response.json();

      if (response.ok && result.status === 'success') {
        // Ak Apps Script úspešne zmazal používateľa z Auth, zmažeme ho aj z Firestore
        await db.collection('users').doc(userToConfirmDelete.id).delete();
        console.log(`Používateľ ${userToConfirmDelete.email} zmazaný z Firestore.`);

        // Aktualizácia notifikačnej správy a otvorenie novej záložky
        if (typeof window.showGlobalNotification === 'function') {
          window.showGlobalNotification(`Používateľ ${userToConfirmDelete.email} bol úspešne zmazaný.`, 'success');
        } else {
          console.warn("UsersManagementApp: window.showGlobalNotification nie je definovaná.");
        }
      
        // Otvoriť Firebase Console v novej záložke (pôvodné riešenie)
        const projectId = firebaseConfig.projectId;
        if (projectId) {
            window.open(`https://console.firebase.google.com/project/${projectId}/authentication/users`, '_blank');
        } else {
            console.error("Chyba: Project ID pre Firebase Console nie je definované.");
        }

        // Uložiť notifikáciu pre všetkých administrátorov
        await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('adminNotifications').add({
          message: `Používateľ ${userToConfirmDelete.email} bol zmazaný.`,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          recipientId: 'all_admins',
          read: false
        });
        console.log("Notifikácia o zmazaní používateľa úspešne uložená do Firestore.");

      } else {
        const errorMessage = result.message || 'Neznáma chyba pri mazaní používateľa.';
        setError(`Chyba pri mazaní používateľa: ${errorMessage}. Skontrolujte logy Google Apps Scriptu.`);
        if (typeof window.showGlobalNotification === 'function') {
          window.showGlobalNotification(`Chyba pri mazaní používateľa: ${errorMessage}.`, 'error');
        }
      }

    } catch (e) {
      console.error("UsersManagementApp: Chyba pri mazaní používateľa (fetch error):", e);
      setError(`Chyba pri mazaní používateľa: ${e.message}. Skontrolujte logy Google Apps Scriptu a nastavenia CORS.`);
      if (typeof window.showGlobalNotification === 'function') {
        window.showGlobalNotification(`Chyba pri mazaní používateľa: ${e.message}.`, 'error');
      }
    } finally {
      setLoading(false);
    }
  };


  // Display loading state
  if (!isAuthReady || user === undefined || (user && !userProfileData) || loading) {
    if (isAuthReady && user === null) { 
        console.log("UsersManagementApp: Auth je ready a používateľ je null, presmerovávam na login.html");
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

  // If user is not admin, redirect
  if (userProfileData && userProfileData.role !== 'admin') {
    console.log("UsersManagementApp: Používateľ nie je admin a snaží sa pristupovať k správe používateľov, presmerovávam.");
    window.location.href = 'logged-in-my-data.html'; // Presmerovanie na logged-in-my-data.html
    return null;
  }

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
    React.createElement(NotificationModal, {
        message: userNotificationMessage,
        onClose: () => setUserNotificationMessage(''),
        type: error ? 'error' : 'success' // Ak je error, zobrazí sa ako chyba, inak ako úspech
    }),
    React.createElement(RoleEditModal, {
        show: showRoleEditModal,
        user: userToEditRole,
        onClose: closeRoleEditModal,
        onSave: handleSaveRole,
        loading: loading,
    }),
    // NOVINKA: Vykreslenie ChangeEmailModal
    React.createElement(ChangeEmailModal, {
        show: showChangeEmailModal,
        user: userToChangeEmail,
        onClose: closeChangeEmailModal,
        onSave: handleSaveEmail,
        loading: loading,
    }),
    React.createElement(
      'div',
      { className: 'w-full px-4 mt-20 mb-10' },
      error && React.createElement(
        'div',
        { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap', role: 'alert' },
        error
      ),
      React.createElement(
        'div',
        { className: 'bg-white p-8 rounded-lg shadow-xl w-full' },
        React.createElement('h1', { className: 'text-3xl font-bold text-center text-gray-800 mb-6' },
          'Správa používateľov'
        ),
        users.length === 0 && !loading ? (
            React.createElement('p', { className: 'text-center text-gray-600' }, 'Žiadni používatelia na zobrazenie.')
        ) : (
            React.createElement(
                'div',
                { className: 'overflow-x-auto' }, // Toto zabezpečí posuvník, ak je obsah príliš široký
                React.createElement(
                    'table',
                    { className: 'min-w-full bg-white rounded-lg shadow-md' }, // ZMENA: min-w-full zabezpečí, že tabuľka bude vždy minimálne 100% šírky rodiča
                    React.createElement(
                        'thead',
                        null,
                        React.createElement(
                            'tr',
                            { className: 'w-full bg-gray-200 text-gray-600 uppercase text-sm leading-normal' },
                            React.createElement('th', { scope: 'col', className: 'py-3 px-6 text-left w-2/6' }, 'E-mail'), // ZMENA: Pridaná šírka
                            React.createElement('th', { scope: 'col', className: 'py-3 px-6 text-left w-1/6' }, 'Meno'), // ZMENA: Pridaná šírka
                            React.createElement('th', { scope: 'col', className: 'py-3 px-6 text-left w-1/6' }, 'Rola'), // ZMENA: Pridaná šírka
                            React.createElement('th', { scope: 'col', className: 'py-3 px-6 text-left w-1/6' }, 'Schválený'), // ZMENA: Pridaná šírka
                            React.createElement('th', { scope: 'col', className: 'py-3 px-6 text-center min-w-[280px]' }, 'Akcie') // ZMENA: Pridaná min-w na th
                        )
                    ),
                    React.createElement(
                        'tbody',
                        { className: 'text-gray-600 text-sm font-light' },
                        users.map((u) => (
                            React.createElement(
                                'tr',
                                { key: u.id, className: 'border-b border-gray-200 hover:bg-gray-100' },
                                React.createElement('td', {
                                    className: `py-3 px-6 text-left whitespace-nowrap ${userProfileData && userProfileData.role === 'admin' && userProfileData.approved && user && u.id !== user.uid ? 'cursor-pointer text-blue-600 hover:text-blue-800' : 'text-gray-500'}`, // NOVINKA: Podmienené triedy
                                    onClick: userProfileData && userProfileData.role === 'admin' && userProfileData.approved && user && u.id !== user.uid ? () => openChangeEmailModal(u) : undefined // NOVINKA: Podmienený onClick handler
                                }, u.email),
                                React.createElement('td', { className: 'py-3 px-6 text-left whitespace-nowrap' }, `${u.firstName || ''} ${u.lastName || ''}`),
                                React.createElement('td', { className: 'py-3 px-6 text-left' }, u.role),
                                React.createElement('td', { className: 'py-3 px-6 text-left' }, u.approved ? 'Áno' : 'Nie'),
                                React.createElement(
                                    'td',
                                    { className: 'py-3 px-6 text-center' },
                                    React.createElement(
                                        'div',
                                        { className: 'flex item-center justify-center space-x-2' }, // ZMENA: Odstránená min-w odtiaľto
                                        // Podmienené vykresľovanie tlačidiel "Upraviť rolu" a "Zmazať"
                                        user && u.id !== user.uid && React.createElement(
                                            React.Fragment,
                                            null,
                                            React.createElement(
                                                'button',
                                                {
                                                  onClick: () => openRoleEditModal(u),
                                                  className: 'bg-green-500 hover:bg-green-600 text-white py-1 px-3 rounded-lg text-sm transition-colors duration-200',
                                                  disabled: loading,
                                                },
                                                'Upraviť rolu'
                                            ),
                                            // NOVINKA: Tlačidlo na schválenie/odobratie prístupu pre adminov
                                            u.role === 'admin' && React.createElement(
                                                'button',
                                                {
                                                  onClick: () => handleToggleAdminApproval(u),
                                                  className: `${u.approved ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-blue-500 hover:bg-blue-600'} text-white py-1 px-3 rounded-lg text-sm transition-colors duration-200`,
                                                  disabled: loading,
                                                },
                                                u.approved ? 'Odobrať prístup' : 'Schváliť'
                                            ),
                                            React.createElement(
                                                'button',
                                                {
                                                  onClick: () => confirmDeleteUser(u), // ZMENA: Priamo volá confirmDeleteUser
                                                  className: 'bg-red-500 hover:bg-red-600 text-white py-1 px-3 rounded-lg text-sm transition-colors duration-200',
                                                  disabled: loading,
                                                },
                                                'Zmazať'
                                            )
                                        )
                                    )
                                )
                            )
                        ))
                    )
                )
            )
        )
      )
    )
  );
}

// Explicitne sprístupniť komponent globálne
window.UsersManagementApp = UsersManagementApp;
