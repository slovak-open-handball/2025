// Global application ID and Firebase configuration (should be consistent across all React apps)
// Tieto konštanty sú teraz definované v <head> logged-in-users.html
// const appId = '1:26454452024:web:6954b4f90f87a3a1eb43cd';
// const firebaseConfig = { ... };
// const initialAuthToken = null;

const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec";

// Helper function to format a Date object into 'YYYY-MM-DDTHH:mm' local string
const formatToDatetimeLocal = (date) => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

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
        timerRef.current = null;
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

// ConfirmationModal Component (converted to React.createElement)
function ConfirmationModal({ show, message, onConfirm, onCancel, loading }) {
  if (!show) return null;

  return React.createElement(
    'div',
    { className: 'modal' },
    React.createElement(
      'div',
      { className: 'modal-content text-center' },
      React.createElement('p', { className: 'text-lg font-semibold mb-6' }, message),
      React.createElement(
        'div',
        { className: 'flex justify-around' },
        React.createElement(
          'button',
          {
            onClick: onConfirm,
            className: 'bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200',
            disabled: loading,
          },
          loading ? 'Potvrdzujem...' : 'Áno'
        ),
        React.createElement(
          'button',
          {
            onClick: onCancel,
            className: 'bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg transition-colors duration-200 ml-4',
            disabled: loading,
          },
          'Nie'
        )
      )
    )
  );
}

// RoleEditModal Component (converted to React.createElement)
function RoleEditModal({ show, user, currentRole, onSave, onCancel, loading }) {
  const [selectedRole, setSelectedRole] = React.useState(currentRole);

  React.useEffect(() => {
    setSelectedRole(currentRole);
  }, [currentRole]);

  if (!show || !user) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(user.uid, selectedRole);
  };

  return React.createElement(
    'div',
    { className: 'modal' },
    React.createElement(
      'div',
      { className: 'modal-content' },
      React.createElement('h2', { className: 'text-2xl font-bold mb-4' }, `Upraviť rolu pre ${user.email}`),
      React.createElement(
        'form',
        { onSubmit: handleSubmit },
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
              type: 'button',
              onClick: onCancel,
              className: 'bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg transition-colors duration-200',
              disabled: loading,
            },
            'Zrušiť'
          ),
          React.createElement(
            'button',
            {
              type: 'submit',
              className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200',
              disabled: loading,
            },
            loading ? 'Ukladám...' : 'Uložiť'
          )
        )
      )
    )
  );
}

// Main React component for the logged-in-users.html page
function UsersApp() {
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
  const [currentRoleForEdit, setCurrentRoleForEdit] = React.useState('');

  // Effect for Firebase initialization and Auth Listener setup (runs only once)
  React.useEffect(() => {
    let unsubscribeAuth;
    let firestoreInstance;

    try {
      if (typeof firebase === 'undefined') {
        console.error("UsersApp: Firebase SDK nie je načítané.");
        setError("Firebase SDK nie je načítané. Skontrolujte logged-in-users.html.");
        setLoading(false);
        return;
      }

      let firebaseApp;
      // Skontrolujte, či už existuje predvolená aplikácia Firebase
      if (firebase.apps.length === 0) {
        // Používame globálne __firebase_config
        firebaseApp = firebase.initializeApp(JSON.parse(__firebase_config));
      } else {
        // Ak už predvolená aplikácia existuje, použite ju
        firebaseApp = firebase.app();
        console.warn("UsersApp: Firebase App named '[DEFAULT]' already exists. Using existing app instance.");
      }
      setApp(firebaseApp);

      const authInstance = firebase.auth(firebaseApp);
      setAuth(authInstance);
      firestoreInstance = firebase.firestore(firebaseApp);
      setDb(firestoreInstance);

      const signIn = async () => {
        try {
          // Používame globálne __initial_auth_token
          if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await authInstance.signInWithCustomToken(__initial_auth_token);
          }
        } catch (e) {
          console.error("UsersApp: Chyba pri počiatočnom prihlásení Firebase (s custom tokenom):", e);
          setError(`Chyba pri prihlásení: ${e.message}`);
        }
      };

      unsubscribeAuth = authInstance.onAuthStateChanged(async (currentUser) => {
        console.log("UsersApp: onAuthStateChanged - Používateľ:", currentUser ? currentUser.uid : "null");
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
      console.error("UsersApp: Nepodarilo sa inicializovať Firebase:", e);
      setError(`Chyba pri inicializácii Firebase: ${e.message}`);
      setLoading(false);
    }
  }, []);

  // NOVÝ EFFECT: Načítanie používateľských dát z Firestore po inicializácii Auth a DB
  React.useEffect(() => {
    let unsubscribeUserDoc;

    // Spustí sa len ak je Auth pripravené, DB je k dispozícii a user je definovaný (nie undefined)
    if (isAuthReady && db && user !== undefined) {
      if (user === null) { // Ak je používateľ null (nie je prihlásený), presmeruj
        console.log("UsersApp: Auth je ready a používateľ je null, presmerovávam na login.html");
        window.location.href = 'login.html';
        return;
      }

      // Ak je používateľ prihlásený, pokús sa načítať jeho dáta z Firestore
      if (user) {
        console.log(`UsersApp: Pokúšam sa načítať používateľský dokument pre UID: ${user.uid}`);
        setLoading(true); // Nastavíme loading na true tu

        try {
          const userDocRef = db.collection('users').doc(user.uid);
          unsubscribeUserDoc = userDocRef.onSnapshot(docSnapshot => {
            console.log("UsersApp: onSnapshot pre používateľský dokument spustený.");
            if (docSnapshot.exists) {
              const userData = docSnapshot.data();
              console.log("UsersApp: Používateľský dokument existuje, dáta:", userData);

              // --- OKAMŽITÉ ODHLÁSENIE, AK passwordLastChanged NIE JE PLATNÝ TIMESTAMP ---
              if (!userData.passwordLastChanged || typeof userData.passwordLastChanged.toDate !== 'function') {
                  console.error("UsersApp: passwordLastChanged NIE JE platný Timestamp objekt! Typ:", typeof userData.passwordLastChanged, "Hodnota:", userData.passwordLastChanged);
                  console.log("UsersApp: Okamžite odhlasujem používateľa kvôli neplatnému timestampu zmeny hesla.");
                  auth.signOut();
                  window.location.href = 'login.html';
                  localStorage.removeItem(`passwordLastChanged_${user.uid}`);
                  return;
              }

              const firestorePasswordChangedTime = userData.passwordLastChanged.toDate().getTime();
              const localStorageKey = `passwordLastChanged_${user.uid}`;
              let storedPasswordChangedTime = parseInt(localStorage.getItem(localStorageKey) || '0', 10);

              console.log(`UsersApp: Firestore passwordLastChanged (konvertované): ${firestorePasswordChangedTime}, Stored: ${storedPasswordChangedTime}`);

              if (storedPasswordChangedTime === 0 && firestorePasswordChangedTime !== 0) {
                  localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
                  console.log("UsersApp: Inicializujem passwordLastChanged v localStorage (prvé načítanie).");
              } else if (firestorePasswordChangedTime > storedPasswordChangedTime) {
                  console.log("UsersApp: Detekovaná zmena hesla na inom zariadení/relácii. Odhlasujem používateľa.");
                  auth.signOut();
                  window.location.href = 'login.html';
                  localStorage.removeItem(localStorageKey);
                  return;
              } else {
                  localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
                  console.log("UsersApp: Timestampy sú rovnaké, aktualizujem localStorage.");
              }
              // --- KONIEC LOGIKY ODHLÁSENIA ---

              setUserProfileData(userData); // Aktualizujeme nový stav userProfileData
              
              setLoading(false); // Stop loading po načítaní používateľských dát
              setError(''); // Vymazať chyby po úspešnom načítaní

              // NOVINKA: Aktualizácia viditeľnosti menu po načítaní roly
              if (typeof window.updateMenuItemsVisibility === 'function') {
                  window.updateMenuItemsVisibility(userData.role);
              }

              console.log("UsersApp: Načítanie používateľských dát dokončené, loading: false");
            } else {
              console.warn("UsersApp: Používateľský dokument sa nenašiel pre UID:", user.uid);
              setError("Chyba: Používateľský profil sa nenašiel alebo nemáte dostatočné oprávnenia. Skúste sa prosím znova prihlásiť.");
              setLoading(false); // Zastaví načítavanie, aby sa zobrazila chyba
            }
          }, error => {
            console.error("UsersApp: Chyba pri načítaní používateľských dát z Firestore (onSnapshot error):", error);
            if (error.code === 'permission-denied') {
                setError(`Chyba oprávnení: Nemáte prístup k svojmu profilu. Skúste sa prosím znova prihlásiť alebo kontaktujte podporu.`);
            } else if (error.code === 'unavailable') {
                setError(`Chyba pripojenia: Služba Firestore je nedostupná. Skúste to prosím neskôr.`);
            } else if (error.code === 'unauthenticated') {
                 setError(`Chyba autentifikácie: Nie ste prihlásený. Skúste sa prosím znova prihlásiť.`);
                 if (auth) {
                    auth.signOut();
                    window.location.href = 'login.html';
                 }
            } else {
                setError(`Chyba pri načítaní používateľských dát: ${error.message}`); // Používame e.message pre konzistentnosť
            }
            setLoading(false); // Stop loading aj pri chybe
            console.log("UsersApp: Načítanie používateľských dát zlyhalo, loading: false");
          });
        } catch (e) {
          console.error("UsersApp: Chyba pri nastavovaní onSnapshot pre používateľské dáta (try-catch):", e);
          setError(`Chyba pri nastavovaní poslucháča pre používateľské dáta: ${e.message}`);
          setLoading(false); // Stop loading aj pri chybe
        }
      }
    } else if (isAuthReady && user === undefined) {
        console.log("UsersApp: Auth ready, user undefined. Nastavujem loading na false.");
        setLoading(false);
    }


    return () => {
      // Zrušíme odber onSnapshot pri unmount
      if (unsubscribeUserDoc) {
        console.log("UsersApp: Ruším odber onSnapshot pre používateľský dokument.");
        unsubscribeUserDoc();
      }
    };
  }, [isAuthReady, db, user, auth]);

  // Effect for updating header link visibility (remains for consistency)
  React.useEffect(() => {
    console.log(`UsersApp: useEffect pre aktualizáciu odkazov hlavičky. User: ${user ? user.uid : 'null'}`);
    const authLink = document.getElementById('auth-link');
    const profileLink = document.getElementById('profile-link');
    const logoutButton = document.getElementById('logout-button');
    const registerLink = document.getElementById('register-link');

    if (authLink) {
      if (user) { // Ak je používateľ prihlásený
        authLink.classList.add('hidden');
        profileLink && profileLink.classList.remove('hidden');
        logoutButton && logoutButton.classList.remove('hidden');
        registerLink && registerLink.classList.add('hidden');
        console.log("UsersApp: Používateľ prihlásený. Skryté: Prihlásenie, Registrácia. Zobrazené: Moja zóna, Odhlásenie.");
      } else { // Ak používateľ nie je prihlásený
        authLink.classList.remove('hidden');
        profileLink && profileLink.classList.add('hidden');
        logoutButton && logoutButton.classList.add('hidden');
        registerLink && registerLink.classList.remove('hidden'); // Zobraziť registračný odkaz, ak nie je prihlásený
        console.log("UsersApp: Používateľ odhlásený. Zobrazené: Prihlásenie, Registrácia. Skryté: Moja zóna, Odhlásenie.");
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
    } catch (e) {
      console.error("UsersApp: Chyba pri odhlásení:", e);
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
      console.log("UsersApp: Prihlásený používateľ je schválený administrátor. Načítavam používateľov.");
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
          console.log("UsersApp: Používatelia aktualizovaní z onSnapshot.");
        }, error => {
          console.error("UsersApp: Chyba pri načítaní používateľov z Firestore (onSnapshot error):", error);
          setError(`Chyba pri načítaní používateľov: ${error.message}`);
          setLoading(false);
        });
      } catch (e) {
        console.error("UsersApp: Chyba pri nastavovaní onSnapshot pre používateľov (try-catch):", e);
        setError(`Chyba pri nastavovaní poslucháča pre používateľov: ${e.message}`);
        setLoading(false);
      }
    } else {
        setUsers([]); // Vyčisti používateľov, ak nie je admin
    }

    return () => {
      if (unsubscribeUsers) {
        console.log("UsersApp: Ruším odber onSnapshot pre používateľov.");
        unsubscribeUsers();
      }
    };
  }, [db, userProfileData]); // Závisí od db a userProfileData (pre rolu admina)

  // Modals handlers
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
    setCurrentRoleForEdit(user.role);
    setShowRoleEditModal(true);
  };

  const closeRoleEditModal = () => {
    setUserToEditRole(null);
    setCurrentRoleForEdit('');
    setShowRoleEditModal(false);
  };

  const handleApproveUser = async (userToApprove) => {
    if (!db || !user || !userProfileData || userProfileData.role !== 'admin') {
      setError("Nemáte oprávnenie na schválenie používateľa.");
      return;
    }
    setLoading(true);
    setError('');
    setUserNotificationMessage('');
    try {
      const userDocRef = db.collection('users').doc(userToApprove.id);
      await userDocRef.update({ approved: true });
      setUserNotificationMessage(`Používateľ ${userToApprove.email} bol úspešne schválený.`);

      // --- Logika pre ukladanie notifikácie pre administrátorov ---
      try {
          const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
          const notificationMessage = `Administrátor ${userProfileData.email} schválil používateľa ${userToApprove.email}.`;
          const notificationRecipientId = 'all_admins'; 

          await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('adminNotifications').add({
              message: notificationMessage,
              timestamp: firebase.firestore.FieldValue.serverTimestamp(),
              recipientId: notificationRecipientId,
              read: false
          });
          console.log("Notifikácia o schválení používateľa úspešne uložená do Firestore.");
      } catch (e) {
          console.error("UsersApp: Chyba pri ukladaní notifikácie o schválení používateľa:", e);
      }
      // --- Koniec logiky pre ukladanie notifikácie ---

    } catch (e) {
      console.error("UsersApp: Chyba pri schvaľovaní používateľa:", e);
      setError(`Chyba pri schvaľovaní používateľa: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    closeRoleEditModal();
    if (!db || !user || !userProfileData || userProfileData.role !== 'admin') {
      setError("Nemáte oprávnenie na zmenu roly.");
      return;
    }
    setLoading(true);
    setError('');
    setUserNotificationMessage('');
    try {
      const userDocRef = db.collection('users').doc(userId);
      await userDocRef.update({ role: newRole });
      setUserNotificationMessage(`Rola používateľa ${userToEditRole.email} bola zmenená na ${newRole}.`);

      // --- Logika pre ukladanie notifikácie pre administrátorov ---
      try {
          const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
          const notificationMessage = `Administrátor ${userProfileData.email} zmenil rolu používateľa ${userToEditRole.email} na '${newRole}'.`;
          const notificationRecipientId = 'all_admins'; 

          await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('adminNotifications').add({
              message: notificationMessage,
              timestamp: firebase.firestore.FieldValue.serverTimestamp(),
              recipientId: notificationRecipientId,
              read: false
          });
          console.log("Notifikácia o zmene roly používateľa úspešne uložená do Firestore.");
      } catch (e) {
          console.error("UsersApp: Chyba pri ukladaní notifikácie o zmene roly:", e);
      }
      // --- Koniec logiky pre ukladanie notifikácie ---

    } catch (e) {
      console.error("UsersApp: Chyba pri zmene roly používateľa:", e);
      setError(`Chyba pri zmene roly používateľa: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    closeConfirmationModal();
    if (!db || !user || !userProfileData || userProfileData.role !== 'admin' || !userToDelete) {
      setError("Nemáte oprávnenie na zmazanie používateľa alebo používateľ nie je vybraný.");
      return;
    }
    setLoading(true);
    setError('');
    setUserNotificationMessage('');
    try {
      // Zmazať používateľa z Firestore
      await db.collection('users').doc(userToDelete.id).delete();
      // Pokúsiť sa zmazať používateľa aj z Firebase Authentication (vyžaduje admin SDK na serveri)
      // Pre jednoduchosť a bezpečnosť v klientskom kóde to tu priamo nerobíme.
      // Ak by sa to robilo, bolo by to cez Cloud Function alebo server.
      setUserNotificationMessage(`Používateľ ${userToDelete.email} bol úspešne zmazaný.`);

      // --- Logika pre ukladanie notifikácie pre administrátorov ---
      try {
          const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
          const notificationMessage = `Administrátor ${userProfileData.email} zmazal používateľa ${userToDelete.email}.`;
          const notificationRecipientId = 'all_admins'; 

          await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('adminNotifications').add({
              message: notificationMessage,
              timestamp: firebase.firestore.FieldValue.serverTimestamp(),
              recipientId: notificationRecipientId,
              read: false
          });
          console.log("Notifikácia o zmazaní používateľa úspešne uložená do Firestore.");
      } catch (e) {
          console.error("UsersApp: Chyba pri ukladaní notifikácie o zmazaní používateľa:", e);
      }
      // --- Koniec logiky pre ukladanie notifikácie ---

    } catch (e) {
      console.error("UsersApp: Chyba pri mazaní používateľa:", e);
      setError(`Chyba pri mazaní používateľa: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Display loading state
  if (!isAuthReady || user === undefined || (user && !userProfileData) || loading) {
    if (isAuthReady && user === null) {
        console.log("UsersApp: Auth je ready a používateľ je null, presmerovávam na login.html");
        window.location.href = 'login.html';
        return null;
    }
    let loadingMessage = 'Načítavam aplikáciu...';
    if (isAuthReady && user && !userProfileData) {
        loadingMessage = 'Načítavam používateľské dáta...';
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
    console.log("UsersApp: Používateľ nie je schválený administrátor, presmerovávam.");
    window.location.href = 'logged-in-my-data.html'; // Presmerovanie na logged-in-my-data.html
    return null;
  }

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
    React.createElement(NotificationModal, {
        message: userNotificationMessage,
        onClose: () => setUserNotificationMessage('')
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
        currentRole: currentRoleForEdit,
        onSave: handleRoleChange,
        onCancel: closeRoleEditModal,
        loading: loading,
    }),
    React.createElement(
      'div',
      { className: 'w-full max-w-4xl mt-20 mb-10 p-4' },
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
        React.createElement(
          'div',
          { className: 'overflow-x-auto' },
          React.createElement(
            'table',
            { className: 'min-w-full bg-white rounded-lg shadow-md' },
            React.createElement(
              'thead',
              null,
              React.createElement(
                'tr',
                { className: 'w-full bg-gray-200 text-gray-600 uppercase text-sm leading-normal' },
                React.createElement('th', { className: 'py-3 px-6 text-left' }, 'E-mail'),
                React.createElement('th', { className: 'py-3 px-6 text-left' }, 'Meno'),
                React.createElement('th', { className: 'py-3 px-6 text-left' }, 'Priezvisko'),
                React.createElement('th', { className: 'py-3 px-6 text-left' }, 'Rola'),
                React.createElement('th', { className: 'py-3 px-6 text-left' }, 'Schválený'),
                React.createElement('th', { className: 'py-3 px-6 text-center' }, 'Akcie')
              )
            ),
            React.createElement(
              'tbody',
              { className: 'text-gray-600 text-sm font-light' },
              users.length === 0 ? (
                React.createElement(
                  'tr',
                  null,
                  React.createElement('td', { colSpan: '6', className: 'py-3 px-6 text-center' }, 'Žiadni používatelia na zobrazenie.')
                )
              ) : (
                users.map(u => (
                  React.createElement(
                    'tr',
                    { key: u.id, className: 'border-b border-gray-200 hover:bg-gray-100' },
                    React.createElement('td', { className: 'py-3 px-6 text-left whitespace-nowrap' }, u.email),
                    React.createElement('td', { className: 'py-3 px-6 text-left' }, u.firstName),
                    React.createElement('td', { className: 'py-3 px-6 text-left' }, u.lastName),
                    React.createElement('td', { className: 'py-3 px-6 text-left' }, u.role),
                    React.createElement('td', { className: 'py-3 px-6 text-left' }, u.approved ? 'Áno' : 'Nie'),
                    React.createElement(
                      'td',
                      { className: 'py-3 px-6 text-center' },
                      React.createElement(
                        'div',
                        { className: 'flex item-center justify-center space-x-2' },
                        React.createElement(
                          'button',
                          {
                            onClick: () => openRoleEditModal(u),
                            className: 'bg-yellow-500 hover:bg-yellow-600 text-white py-1 px-3 rounded-lg text-sm transition-colors duration-200',
                            disabled: loading,
                          },
                          'Upraviť rolu'
                        ),
                        u.role === 'admin' && !u.approved && React.createElement(
                          'button',
                          {
                            onClick: () => handleApproveUser(u),
                            className: 'bg-green-500 hover:bg-green-600 text-white py-1 px-3 rounded-lg text-sm transition-colors duration-200',
                            disabled: loading,
                          },
                          'Schváliť'
                        ),
                        React.createElement(
                          'button',
                          {
                            onClick: () => openConfirmationModal(u),
                            className: 'bg-red-500 hover:bg-red-600 text-white py-1 px-3 rounded-lg text-sm transition-colors duration-200',
                            disabled: loading,
                          },
                          'Zmazať'
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
