// Global application ID and Firebase configuration (should be consistent across all React apps)
// Tieto konštanty sú teraz definované v <head> logged-in-users.html
// const appId = '1:26454452024:web:6954b4f90f87a3a1eb43cd';
// const firebaseConfig = { ... };
// const initialAuthToken = null;

// const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec";

// Helper function to format a Date object into 'YYYY-MM-DDTHH:mm' local string
// const formatToDatetimeLocal = (date) => {
//  if (!date) return '';
//  const year = date.getFullYear();
//  const month = (date.getMonth() + 1).toString().padStart(2, '0');
//  const day = date.getDate().toString().padStart(2, '0');
//  const hours = date.getHours().toString().padStart(2, '0');
//  const minutes = date.getMinutes().toString().padStart(2, '0');
//  return `${year}-${month}-${day}T${hours}:${minutes}`;
//};

// NotificationModal Component for displaying temporary messages (converted to React.createElement)
function NotificationModal({ message, onClose, displayNotificationsEnabled }) {
  const [show, setShow] = React.useState(false);
  const timerRef = React.useRef(null);

  React.useEffect(() => {
    // Zobrazí notifikáciu len ak je povolené zobrazovanie notifikácií
    if (message && displayNotificationsEnabled) {
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
  }, [message, onClose, displayNotificationsEnabled]); // ZÁVISLOSŤ: Pridaný displayNotificationsEnabled

  // Nevykresľuje sa, ak nie je zobrazené alebo ak sú notifikácie vypnuté
  if (!show && !message || !displayNotificationsEnabled) return null;

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

// ConfirmationModal Component (converted to React.createElement)
function ConfirmationModal({ show, message, onConfirm, onCancel, loading }) {
  if (!show) return null;

  return React.createElement(
    'div',
    { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50' },
    React.createElement(
      'div',
      { className: 'bg-white p-6 rounded-lg shadow-xl max-w-sm w-full text-center' },
      React.createElement('p', { className: 'text-lg font-semibold mb-4' }, message),
      React.createElement(
        'div',
        { className: 'flex justify-center space-x-4' },
        React.createElement(
          'button',
          {
            onClick: onCancel,
            className: 'bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded-lg transition-colors duration-200',
            disabled: loading,
          },
          'Zrušiť'
        ),
        React.createElement(
          'button',
          {
            onClick: onConfirm,
            className: 'bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg transition-colors duration-200',
            disabled: loading,
          },
          loading ? 'Potvrdzujem...' : 'Potvrdiť'
        )
      )
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
      // ODSTRÁNENÉ: Checkbox pre schválenie sa už nezobrazuje
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


// Main React component for the logged-in-users.html page
// ZMENA: Premenované z UsersApp na UsersManagementApp, aby zodpovedalo názvu v logged-in-users.html
// a presunuté mimo funkcie, aby bolo globálne dostupné.
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
  const [showConfirmationModal, setShowConfirmationModal] = React.useState(false);
  const [userToDelete, setUserToDelete] = React.useState(null);
  const [showRoleEditModal, setShowRoleEditModal] = React.useState(false);
  const [userToEditRole, setUserToEditRole] = React.useState(null);

  // Používame pevne zadané 'default-app-id' pre cestu k notifikáciám
  const appId = 'default-app-id'; 

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
      // ZMENA: Používame globálnu premennú firebaseConfig namiesto __firebase_config
      if (firebase.apps.length === 0) {
        firebaseApp = firebase.initializeApp(firebaseConfig);
      } else {
        firebaseApp = firebase.app();
      }
      setApp(firebaseApp);

      const authInstance = firebase.auth(firebaseApp);
      setAuth(authInstance);
      firestoreInstance = firebase.firestore(firebaseApp);
      setDb(firestoreInstance);

      const signIn = async () => {
        try {
          // ZMENA: Používame globálnu premennú initialAuthToken namiesto __initial_auth_token
          if (typeof initialAuthToken !== 'undefined' && initialAuthToken) {
            await authInstance.signInWithCustomToken(initialAuthToken);
          }
        } catch (e) {
          console.error("UsersManagementApp: Chyba pri počiatočnom prihlásení Firebase:", e);
          setError(`Chyba pri prihlásení: ${e.message}`);
        }
      };

      unsubscribeAuth = authInstance.onAuthStateChanged(async (currentUser) => {
        console.log("UsersManagementApp: onAuthStateChanged - Používateľ:", currentUser ? currentUser.uid : "null");
        setUser(currentUser);
        setIsAuthReady(true);
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

              // --- OKAMŽITÉ ODHLÁSENIE, AK passwordLastChanged NIE JE PLATNÝ TIMESTAMP ---
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
                  return;
              } else if (firestorePasswordChangedTime < storedPasswordChangedTime) {
                  console.warn("UsersManagementApp: Detekovaný starší timestamp z Firestore ako uložený. Odhlasujem používateľa (potenciálny nesúlad).");
                  auth.signOut();
                  window.location.href = 'login.html';
                  localStorage.removeItem(localStorageKey);
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
  }, [isAuthReady, db, user, auth]);

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
      setUserNotificationMessage("Úspešne odhlásený.");
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
    setUserToDelete(user);
    setShowConfirmationModal(true);
  };

  const closeConfirmationModal = () => {
    setUserToDelete(null);
    setShowConfirmationModal(false);
  };

  const openRoleEditModal = (user) => {
    setUserToEditRole(user);
    setShowRoleEditModal(true);
  };

  const closeRoleEditModal = () => {
    setUserToEditRole(null);
    setShowRoleEditModal(false);
  };

  // NOVÁ FUNKCIA: Prepnúť stav schválenia administrátora
  const handleToggleAdminApproval = async (userToToggle) => {
    if (!db || !userProfileData || userProfileData.role !== 'admin') {
      setError("Nemáte oprávnenie na zmenu stavu schválenia.");
      return;
    }
    setLoading(true);
    setError('');
    setUserNotificationMessage('');
    try {
      const newApprovedStatus = !userToToggle.approved; // Prepnúť aktuálny stav
      const userDocRef = db.collection('users').doc(userToToggle.id);
      await userDocRef.update({ approved: newApprovedStatus });

      const actionMessage = newApprovedStatus ? 'schválený' : 'odstránený prístup';
      setUserNotificationMessage(`Používateľ ${userToToggle.email} bol ${actionMessage}.`);

      // Uložiť notifikáciu pre všetkých administrátorov
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
    setUserNotificationMessage('');
    try {
      const userDocRef = db.collection('users').doc(userId);
      
      // Ak sa rola mení na 'user', approved sa nastaví na true.
      // Ak sa rola mení na 'admin', approved sa nastaví na false.
      const approvedStatus = (newRole === 'user') ? true : false; 

      await userDocRef.update({ role: newRole, approved: approvedStatus });
      setUserNotificationMessage(`Rola používateľa ${userToEditRole.email} bola zmenená na ${newRole}.`);
      closeRoleEditModal();

      // Ak sa používateľovi zmenila rola na admin a nie je schválený, odhlásime ho
      if (user && user.uid === userId && newRole === 'admin' && approvedStatus === false) {
          console.log("UsersManagementApp: Rola používateľa zmenená na neschváleného admina. Odhlasujem.");
          await auth.signOut();
          window.location.href = 'login.html';
          return; // Zastav ďalšie spracovanie
      }

      // Uložiť notifikáciu pre všetkých administrátorov
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

  const handleDeleteUser = async () => {
    if (!db || !userToDelete || !userProfileData || userProfileData.role !== 'admin') {
      setError("Nemáte oprávnenie na zmazanie používateľa.");
      return;
    }
    setLoading(true);
    setError('');
    setUserNotificationMessage('');
    try {
      // 1. Zmazať používateľa z Firestore
      await db.collection('users').doc(userToDelete.id).delete();
      console.log(`Používateľ ${userToDelete.email} zmazaný z Firestore.`);

      // 2. Aktualizácia notifikačnej správy a presmerovanie na Firebase Console
      setUserNotificationMessage(`Používateľ ${userToDelete.email} bol zmazaný z databázy. Prosím, zmažte ho aj manuálne vo Firebase Console.`);
      closeConfirmationModal();

      // Otvoriť novú záložku s Firebase Console
      window.open('https://console.firebase.google.com/project/prihlasovanie-4f3f3/authentication/users', '_blank');

      // Uložiť notifikáciu pre všetkých administrátorov
      await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('adminNotifications').add({
        message: `Používateľ ${userToDelete.email} bol zmazaný z databázy. Je potrebné ho manuálne zmazať aj z autentifikácie.`,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        recipientId: 'all_admins',
        read: false
      });
      console.log("Notifikácia o zmazaní používateľa úspešne uložená do Firestore.");

    } catch (e) {
      console.error("UsersManagementApp: Chyba pri mazaní používateľa (Firestore):", e);
      setError(`Chyba pri mazaní používateľa: ${e.message}`);
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
        loadingMessage = 'Načítavam...';
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
  if (userProfileData && (userProfileData.role !== 'admin' || userProfileData.approved !== true)) {
    console.log("UsersManagementApp: Používateľ nie je schválený administrátor a snaží sa pristupovať k správe používateľov, presmerovávam.");
    window.location.href = 'logged-in-my-data.html'; // Presmerovanie na logged-in-my-data.html
    return null;
  }

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
    // ZMENA: Odovzdávame displayNotificationsEnabled z userProfileData
    React.createElement(NotificationModal, {
        message: userNotificationMessage,
        onClose: () => setUserNotificationMessage(''),
        displayNotificationsEnabled: userProfileData.displayNotifications // Pridaný prop
    }),
    React.createElement(ConfirmationModal, {
        show: showConfirmationModal,
        message: `Naozaj chcete zmazať používateľa ${userToDelete ? userToDelete.email : ''}?`,
        onConfirm: handleDeleteUser,
        onCancel: closeConfirmationModal,
        loading: loading,
    }),
    React.createElement(RoleEditModal, {
        show: showRoleEditModal,
        user: userToEditRole,
        onClose: closeRoleEditModal,
        onSave: handleSaveRole,
        loading: loading,
    }),
    React.createElement(
      'div',
      { className: 'w-full px-4 mt-20 mb-10 flex justify-center' }, // ZMENA: Odstránené mx-auto, pridané flex justify-center
      error && React.createElement(
        'div',
        { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap', role: 'alert' },
        error
      ),
      React.createElement(
        'div',
        { className: 'bg-white p-8 rounded-lg shadow-xl inline-block' }, // ZMENA: Pridané inline-block
        React.createElement('h1', { className: 'text-3xl font-bold text-center text-gray-800 mb-6' },
          'Správa používateľov'
        ),
        users.length === 0 && !loading ? (
            React.createElement('p', { className: 'text-center text-gray-600' }, 'Žiadni používatelia na zobrazenie.')
        ) : (
            React.createElement(
                'div',
                { className: 'overflow-x-auto' }, // Ponecháme overflow-x-auto ako zálohu
                React.createElement(
                    'table',
                    { className: 'bg-white rounded-lg shadow-md table-auto' }, // ZMENA: Odstránené w-full
                    React.createElement(
                        'thead',
                        null,
                        React.createElement(
                            'tr',
                            { className: 'w-full bg-gray-200 text-gray-600 uppercase text-sm leading-normal' },
                            React.createElement('th', { className: 'py-3 px-6 text-left' }, 'E-mail'),
                            React.createElement('th', { className: 'py-3 px-6 text-left' }, 'Meno'),
                            React.createElement('th', { className: 'py-3 px-6 text-left' }, 'Rola'),
                            React.createElement('th', { className: 'py-3 px-6 text-left' }, 'Schválený'),
                            React.createElement('th', { className: 'py-3 px-6 text-center whitespace-nowrap' }, 'Akcie')
                        )
                    ),
                    React.createElement(
                        'tbody',
                        { className: 'text-gray-600 text-sm font-light' },
                        users.map((u) => (
                            React.createElement(
                                'tr',
                                { key: u.id, className: 'border-b border-gray-200 hover:bg-gray-100' },
                                React.createElement('td', { className: 'py-3 px-6 text-left whitespace-nowrap' }, u.email),
                                React.createElement('td', { className: 'py-3 px-6 text-left whitespace-nowrap' }, `${u.firstName || ''} ${u.lastName || ''}`),
                                React.createElement('td', { className: 'py-3 px-6 text-left whitespace-nowrap' }, u.role),
                                React.createElement('td', { className: 'py-3 px-6 text-left whitespace-nowrap' }, u.approved ? 'Áno' : 'Nie'),
                                React.createElement(
                                    'td',
                                    { className: 'py-3 px-6 text-center' },
                                    React.createElement(
                                        'div',
                                        { className: 'flex item-center justify-center space-x-2 whitespace-nowrap' },
                                        // Podmienené vykresľovanie tlačidiel "Upraviť rolu" a "Zmazať"
                                        user && u.id !== user.uid && React.createElement(
                                            React.Fragment,
                                            null,
                                            React.createElement(
                                                'button',
                                                {
                                                  onClick: () => openRoleEditModal(u),
                                                  className: 'bg-green-500 hover:bg-green-600 text-white py-1 px-3 rounded-lg text-sm transition-colors duration-200 whitespace-nowrap',
                                                  disabled: loading,
                                                },
                                                'Upraviť rolu'
                                            ),
                                            // NOVINKA: Tlačidlo na schválenie/odobratie prístupu pre adminov
                                            u.role === 'admin' && React.createElement(
                                                'button',
                                                {
                                                  onClick: () => handleToggleAdminApproval(u),
                                                  className: `${u.approved ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-blue-500 hover:bg-blue-600'} text-white py-1 px-3 rounded-lg text-sm transition-colors duration-200 whitespace-nowrap`,
                                                  disabled: loading,
                                                },
                                                u.approved ? 'Odobrať prístup' : 'Schváliť'
                                            ),
                                            React.createElement(
                                                'button',
                                                {
                                                  onClick: () => openConfirmationModal(u),
                                                  className: 'bg-red-500 hover:bg-red-600 text-white py-1 px-3 rounded-lg text-sm transition-colors duration-200 whitespace-nowrap',
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
