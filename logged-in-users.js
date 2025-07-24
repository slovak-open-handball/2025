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
function ConfirmationModal({ message, onConfirm, onCancel }) {
  return React.createElement(
    'div',
    { className: 'modal' },
    React.createElement(
      'div',
      { className: 'modal-content text-center' },
      React.createElement('p', { className: 'text-lg font-semibold mb-6' }, message),
      React.createElement(
        'div',
        { className: 'flex justify-center space-x-4' },
        React.createElement(
          'button',
          {
            onClick: onCancel,
            className: 'px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors duration-200',
          },
          'Zrušiť'
        ),
        React.createElement(
          'button',
          {
            onClick: onConfirm,
            className: 'px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200',
          },
          'Potvrdiť'
        )
      )
    )
  );
}

// EditRoleModal Component (converted to React.createElement)
function EditRoleModal({ userToEditRole, newRole, setNewRole, closeRoleEditModal, handleUpdateUserRole, loading }) {
  return React.createElement(
    'div',
    { className: 'modal' },
    React.createElement(
      'div',
      { className: 'modal-content' },
      React.createElement('h3', { className: 'text-xl font-bold mb-4' }, `Upraviť rolu pre ${userToEditRole?.email}`),
      React.createElement(
        'div',
        { className: 'mb-4' },
        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'new-user-role' }, 'Nová rola'),
        React.createElement(
          'select',
          {
            id: 'new-user-role',
            className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
            value: newRole,
            onChange: (e) => setNewRole(e.target.value),
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
            onClick: closeRoleEditModal,
            className: 'px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors duration-200',
          },
          'Zrušiť'
        ),
        React.createElement(
          'button',
          {
            onClick: handleUpdateUserRole,
            className: 'px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200',
            disabled: loading,
          },
          loading ? 'Ukladám...' : 'Uložiť'
        )
      )
    )
  );
}

// Main React component for the logged-in-users.html page
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

  // Admin Panel States
  const [allUsers, setAllUsers] = React.useState([]);
  const [showConfirmationModal, setShowConfirmationModal] = React.useState(false);
  const [userToDelete, setUserToDelete] = React.useState(null);
  const [showRoleEditModal, setShowRoleEditModal] = React.useState(false);
  const [userToEditRole, setUserToEditRole] = React.useState(null);
  const [newRole, setNewRole] = React.useState('user');

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

      const firebaseApp = firebase.app();
      setApp(firebaseApp);

      const authInstance = firebase.auth(firebaseApp);
      setAuth(authInstance);
      firestoreInstance = firebase.firestore(firebaseApp);
      setDb(firestoreInstance);

      const signIn = async () => {
        try {
          if (initialAuthToken) {
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
      if (user === null) { // Ak je používateľ null (nie je prihlásený), presmeruj
        console.log("UsersManagementApp: Auth je ready a používateľ je null, presmerovávam na login.html");
        window.location.href = 'login.html';
        return;
      }

      // Ak je používateľ prihlásený, pokús sa načítať jeho dáta z Firestore
      if (user) {
        console.log(`UsersManagementApp: Pokúšam sa načítať používateľský dokument pre UID: ${user.uid}`);
        setLoading(true); // Nastavíme loading na true tu

        try {
          const userDocRef = db.collection('users').doc(user.uid);
          unsubscribeUserDoc = userDocRef.onSnapshot(docSnapshot => {
            console.log("UsersManagementApp: onSnapshot pre používateľský dokument spustený.");
            if (docSnapshot.exists) {
              const userData = docSnapshot.data();
              console.log("UsersManagementApp: Používateľský dokument existuje, dáta:", userData);
              setUserProfileData(userData); // Aktualizujeme nový stav userProfileData
              
              setLoading(false); // Stop loading po načítaní používateľských dát
              setError(''); // Vymazať chyby po úspešnom načítaní

              // NOVINKA: Aktualizácia viditeľnosti menu po načítaní roly
              if (typeof window.updateMenuItemsVisibility === 'function') {
                  window.updateMenuItemsVisibility(userData.role);
              }

              console.log("UsersManagementApp: Načítanie používateľských dát dokončené, loading: false");
            } else {
              console.warn("UsersManagementApp: Používateľský dokument sa nenašiel pre UID:", user.uid);
              setError("Chyba: Používateľský profil sa nenašiel alebo nemáte dostatočné oprávnenia. Skúste sa prosím znova prihlásiť.");
              setLoading(false); // Zastaví načítavanie, aby sa zobrazila chyba
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
                 }
            } else {
                setError(`Chyba pri načítaní používateľských dát: ${error.message}`);
            }
            setLoading(false); // Stop loading aj pri chybe
            console.log("UsersManagementApp: Načítanie používateľských dát zlyhalo, loading: false");
          });
        } catch (e) {
          console.error("UsersManagementApp: Chyba pri nastavovaní onSnapshot pre používateľské dáta (try-catch):", e);
          setError(`Chyba pri nastavovaní poslucháča pre používateľské dáta: ${e.message}`);
          setLoading(false); // Stop loading aj pri chybe
        }
      }
    } else if (isAuthReady && user === undefined) {
        console.log("UsersManagementApp: Auth ready, user undefined. Nastavujem loading na false.");
        setLoading(false);
    }


    return () => {
      // Zrušíme odber onSnapshot pri unmount
      if (unsubscribeUserDoc) {
        console.log("UsersManagementApp: Ruším odber onSnapshot pre používateľský dokument.");
        unsubscribeUserDoc();
      }
    };
  }, [isAuthReady, db, user, auth]);

  // useEffect for updating header link visibility (remains for consistency)
  React.useEffect(() => {
    console.log(`UsersManagementApp: useEffect pre aktualizáciu odkazov hlavičky. User: ${user ? user.uid : 'null'}`);
    const authLink = document.getElementById('auth-link');
    const profileLink = document.getElementById('profile-link');
    const logoutButton = document.getElementById('logout-button');
    const registerLink = document.getElementById('register-link'); // Registračný link je stále relevantný

    if (authLink) {
      if (user) { // Ak je používateľ prihlásený
        authLink.classList.add('hidden');
        profileLink && profileLink.classList.remove('hidden');
        logoutButton && logoutButton.classList.remove('hidden');
        registerLink && registerLink.classList.add('hidden');
        console.log("UsersManagementApp: Používateľ prihlásený. Skryté: Prihlásenie, Registrácia. Zobrazené: Moja zóna, Odhlásenie.");
      } else { // Ak používateľ nie je prihlásený
        authLink.classList.remove('hidden');
        profileLink && profileLink.classList.add('hidden');
        logoutButton && logoutButton.classList.add('hidden');
        registerLink && registerLink.classList.remove('hidden'); // Zobraziť registračný odkaz, ak nie je prihlásený
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

  const handleDeleteAccount = async (targetUser) => { // Modified to accept targetUser
    if (!auth || !db || !user || !targetUser) {
      setError("Auth, databáza alebo používateľ nie je k dispozícii.");
      return;
    }
    setLoading(true);
    setError('');
    setUserNotificationMessage('');
    try {
      // 1. Delete user data from Firestore
      await db.collection('users').doc(targetUser.id).delete();
      console.log("UsersManagementApp: Používateľské dáta vymazané z Firestore.");

      // If deleting own account, also delete from Firebase Auth
      if (user.uid === targetUser.id) {
        await user.delete();
        console.log("UsersManagementApp: Používateľ vymazaný z Firebase Auth.");
        setUserNotificationMessage("Váš účet bol úspešne zmazaný. Budete presmerovaní na prihlasovaciu stránku.");
        setTimeout(() => {
          window.location.href = 'login.html';
        }, 3000);
      } else {
        setUserNotificationMessage(`Účet ${targetUser.email} bol úspešne zmazaný.`);
        handleFetchAllUsers(); // Refresh the user list for admin
      }
    } catch (e) {
      console.error("UsersManagementApp: Chyba pri mazaní účtu:", e);
      setError(`Chyba pri mazaní účtu: ${e.message}. Možno sa musíte znova prihlásiť, ak ste sa prihlásili príliš dávno.`);
    } finally {
      setLoading(false);
      setShowConfirmationModal(false); // Close modal even on error
    }
  };

  const handleFetchAllUsers = React.useCallback(async () => {
    // Kontrola oprávnení teraz používa userProfileData.role
    if (!db || !userProfileData || userProfileData.role !== 'admin') {
      setError("Nemáte oprávnenie na zobrazenie používateľov.");
      setLoading(false); // Nastavíme loading na false aj tu
      return;
    }
    setLoading(true);
    setError('');
    try {
      const usersSnapshot = await db.collection('users').get();
      const usersList = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllUsers(usersList);
    } catch (e) {
      console.error("UsersManagementApp: Chyba pri načítaní všetkých používateľov:", e);
      setError(`Chyba pri načítaní používateľov: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [db, userProfileData]); // Závisí od userProfileData

  React.useEffect(() => {
    // Podmienka na spustenie handleFetchAllUsers závisí od userProfileData.role
    if (userProfileData && userProfileData.role === 'admin' && db) {
      handleFetchAllUsers();
    }
  }, [userProfileData, db, handleFetchAllUsers]); // Závisí od userProfileData

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
    setNewRole(user.role); // Set current role as default
    setShowRoleEditModal(true);
  };

  const closeRoleEditModal = () => {
    setUserToEditRole(null);
    setShowRoleEditModal(false);
  };

  const handleUpdateUserRole = async () => {
    // Podmienka na kontrolu roly admina závisí od userProfileData.role
    if (!db || !userToEditRole || !userProfileData || userProfileData.role !== 'admin') {
      setError("Nemáte oprávnenie na zmenu rolí alebo chýbajú dáta.");
      return;
    }
    setLoading(true);
    setError('');
    setUserNotificationMessage('');
    try {
      const userDocRef = db.collection('users').doc(userToEditRole.id);
      await userDocRef.update({
        role: newRole,
        // Ak nastavujeme na admina, nastavíme approved na false, inak na true
        approved: newRole === 'admin' ? false : true
      });
      setUserNotificationMessage(`Rola pre ${userToEditRole.email} bola aktualizovaná na '${newRole}'.`);
      closeRoleEditModal();
      handleFetchAllUsers(); // Refresh the user list
      
      // Send email notification about role change
      try {
        const payload = {
          action: 'sendRoleChangeNotification',
          email: userToEditRole.email,
          newRole: newRole,
          isApproved: newRole === 'admin' ? false : true // Pass the approval status
        };
        console.log("UsersManagementApp: Odosielanie dát do Apps Script (zmena roly):", payload);
        const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        });
        console.log("UsersManagementApp: Požiadavka na odoslanie e-mailu o zmene roly odoslaná.");
        try {
          const responseData = await response.text();
          console.log("UsersManagementApp: Odpoveď z Apps Script (fetch - zmena roly) ako text:", responseData);
        } catch (jsonError) {
          console.warn("UsersManagementApp: Nepodarilo sa analyzovať odpoveď z Apps Script (očakávané s 'no-cors' pre JSON):", jsonError);
        }
      } catch (emailError) {
        console.error("UsersManagementApp: Chyba pri odosielaní e-mailu o zmene roly cez Apps Script (chyba fetch):", emailError);
      }

    } catch (e) {
      console.error("UsersManagementApp: Chyba pri aktualizácii roly:", e);
      setError(`Chyba pri aktualizácii roly: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveUser = async (targetUser) => {
    // Podmienka na kontrolu roly admina závisí od userProfileData.role
    if (!db || !userProfileData || userProfileData.role !== 'admin') {
      setError("Nemáte oprávnenie na schvaľovanie používateľov.");
      return;
    }
    setLoading(true);
    setError('');
    setUserNotificationMessage('');
    try {
      const userDocRef = db.collection('users').doc(targetUser.id);
      await userDocRef.update({
        approved: true
      });
      setUserNotificationMessage(`Používateľ ${targetUser.email} bol schválený.`);
      handleFetchAllUsers(); // Refresh the user list

      // Send email notification about approval
      try {
        const payload = {
          action: 'sendApprovalNotification',
          email: targetUser.email,
          firstName: targetUser.firstName,
          lastName: targetUser.lastName
        };
        console.log("UsersManagementApp: Odosielanie dát do Apps Script (schválenie):", payload);
        const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        });
        console.log("UsersManagementApp: Požiadavka na odoslanie e-mailu o schválení odoslaná.");
        try {
          const responseData = await response.text();
          console.log("UsersManagementApp: Odpoveď z Apps Script (fetch - schválenie) ako text:", responseData);
        } catch (jsonError) {
          console.warn("UsersManagementApp: Nepodarilo sa analyzovať odpoveď z Apps Script (očakávané s 'no-cors' pre JSON):", jsonError);
        }
      } catch (emailError) {
        console.error("UsersManagementApp: Chyba pri odosielaní e-mailu o schválení cez Apps Script (chyba fetch):", emailError);
      }

    } catch (e) {
      console.error("UsersManagementApp: Chyba pri schvaľovaní používateľa:", e);
      setError(`Chyba pri schvaľovaní používateľa: ${e.message}`);
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
        onClose: () => setUserNotificationMessage('')
    }),
    showConfirmationModal && React.createElement(ConfirmationModal, {
        message: `Naozaj chcete zmazať účet ${userToDelete?.email}? Túto akciu nie je možné vrátiť späť.`,
        onConfirm: () => handleDeleteAccount(userToDelete), // Pass userToDelete
        onCancel: closeConfirmationModal
    }),
    showRoleEditModal && React.createElement(EditRoleModal, {
        userToEditRole: userToEditRole,
        newRole: newRole,
        setNewRole: setNewRole,
        closeRoleEditModal: closeRoleEditModal,
        handleUpdateUserRole: handleUpdateUserRole,
        loading: loading
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
        // Tento riadok bol odstránený podľa požiadavky:
        // userProfileData && React.createElement(
        //   'p',
        //   { className: 'text-lg text-gray-600 text-center mb-4' },
        //   `Vitajte, ${userProfileData.firstName || userProfileData.email}! Vaša rola: ${userProfileData.role === 'admin' ? 'Administrátor' : 'Používateľ'}.`
        // ),
        React.createElement('h2', { className: 'text-2xl font-bold text-gray-800 mt-8 mb-4' }, 'Zoznam používateľov'),
        React.createElement(
          'div',
          { className: 'overflow-x-auto' },
          React.createElement(
            'table',
            { className: 'min-w-full bg-white rounded-lg shadow overflow-hidden' },
            React.createElement(
              'thead',
              { className: 'bg-gray-200 text-gray-700' },
              React.createElement(
                'tr',
                null,
                React.createElement('th', { className: 'py-3 px-4 text-left' }, 'E-mail'),
                React.createElement('th', { className: 'py-3 px-4 text-left' }, 'Meno'),
                React.createElement('th', { className: 'py-3 px-4 text-left' }, 'Rola'),
                React.createElement('th', { className: 'py-3 px-4 text-left' }, 'Schválený'),
                React.createElement('th', { className: 'py-3 px-4 text-left' }, 'Akcie')
              )
            ),
            React.createElement(
              'tbody',
              null,
              allUsers.map((u) => (
                React.createElement(
                  'tr',
                  { key: u.id, className: 'border-b border-gray-200 hover:bg-gray-50' },
                  React.createElement('td', { className: 'py-3 px-4' }, u.email),
                  React.createElement('td', { className: 'py-3 px-4 whitespace-nowrap' }, `${u.firstName || ''} ${u.lastName || ''}`),
                  React.createElement('td', { className: 'py-3 px-4' }, u.role),
                  React.createElement('td', { className: 'py-3 px-4' }, u.approved ? 'Áno' : 'Nie'),
                  React.createElement(
                    'td',
                    { className: 'py-3 px-4 flex space-x-2' },
                    // Podmienka na zobrazenie tlačidiel "Upraviť rolu" a "Zmazať"
                    // Tlačidlá sa nezobrazia, ak je používateľ aktuálne prihlásený (user.uid === u.id)
                    user && user.uid !== u.id && React.createElement(
                      React.Fragment,
                      null,
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
  );
}
