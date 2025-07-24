// Global application ID and Firebase configuration (should be consistent across all React apps)
// Tieto konštanty sú teraz definované v <head> logged-in-my-data.html
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

// Main React component for the logged-in-my-data.html page
function MyDataApp() {
  const [app, setApp] = React.useState(null);
  const [auth, setAuth] = React.useState(null);
  const [db, setDb] = React.useState(null);
  const [user, setUser] = React.useState(undefined); // Firebase User object from onAuthStateChanged
  // Nový stav pre dáta používateľského profilu z Firestore
  const [userProfileData, setUserProfileData] = React.useState(null); 
  const [isAuthReady, setIsAuthReady] = React.useState(false); // Nový stav pre pripravenosť autentifikácie
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [userNotificationMessage, setUserNotificationMessage] = React.useState('');

  // User Data States - Tieto stavy sa budú aktualizovať z userProfileData
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [contactPhoneNumber, setContactPhoneNumber] = React.useState('');
  const [email, setEmail] = React.useState(''); // Bude nastavený z user.email alebo userProfileData.email
  const [role, setRole] = React.useState('');
  const [isApproved, setIsApproved] = React.useState(false);
  // Removed displayNotifications state from here

  const [showConfirmationModal, setShowConfirmationModal] = React.useState(false);
  const [userToDelete, setUserToDelete] = React.useState(null); // Used for own account deletion

  // Effect for Firebase initialization and Auth Listener setup (runs only once)
  React.useEffect(() => {
    let unsubscribeAuth;
    let firestoreInstance;

    try {
      if (typeof firebase === 'undefined') {
        console.error("MyDataApp: Firebase SDK nie je načítané.");
        setError("Firebase SDK nie je načítané. Skontrolujte logged-in-my-data.html.");
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
          // Ak initialAuthToken nie je k dispozícii, jednoducho sa spoliehame na onAuthStateChanged,
          // ktoré detekuje pretrvávajúci stav prihlásenia (napr. z login.html).
        } catch (e) {
          console.error("MyDataApp: Chyba pri počiatočnom prihlásení Firebase (s custom tokenom):", e);
          setError(`Chyba pri prihlásení: ${e.message}`);
        }
      };

      unsubscribeAuth = authInstance.onAuthStateChanged(async (currentUser) => {
        console.log("MyDataApp: onAuthStateChanged - Používateľ:", currentUser ? currentUser.uid : "null");
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
      console.error("MyDataApp: Nepodarilo sa inicializovať Firebase:", e);
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
        console.log("MyDataApp: Auth je ready a používateľ je null, presmerovávam na login.html");
        window.location.href = 'login.html';
        return;
      }

      // Ak je používateľ prihlásený, pokús sa načítať jeho dáta z Firestore
      if (user) {
        console.log(`MyDataApp: Pokúšam sa načítať používateľský dokument pre UID: ${user.uid}`);
        // Nastavíme loading na true, pretože začíname načítavať profilové dáta
        setLoading(true); // Nastavíme loading na true tu

        try {
          const userDocRef = db.collection('users').doc(user.uid);
          unsubscribeUserDoc = userDocRef.onSnapshot(docSnapshot => {
            console.log("MyDataApp: onSnapshot pre používateľský dokument spustený.");
            if (docSnapshot.exists) {
              const userData = docSnapshot.data();
              console.log("MyDataApp: Používateľský dokument existuje, dáta:", userData);
              setUserProfileData(userData); // Aktualizujeme nový stav userProfileData
              
              // Aktualizujeme lokálne stavy z userProfileData
              setFirstName(userData.firstName || '');
              setLastName(userData.lastName || '');
              setContactPhoneNumber(userData.contactPhoneNumber || '');
              setEmail(userData.email || user.email || ''); // Použi Firebase user email ako fallback
              setRole(userData.role || 'user');
              setIsApproved(userData.approved || false);
              // Removed setDisplayNotifications from here
              
              setLoading(false); // Stop loading po načítaní používateľských dát
              setError(''); // Vymazať chyby po úspešnom načítaní

              // NOVINKA: Aktualizácia viditeľnosti menu po načítaní roly
              if (typeof window.updateMenuItemsVisibility === 'function') {
                  window.updateMenuItemsVisibility(userData.role);
              }

              console.log("MyDataApp: Načítanie používateľských dát dokončené, loading: false");
            } else {
              console.warn("MyDataApp: Používateľský dokument sa nenašiel pre UID:", user.uid);
              setError("Chyba: Používateľský profil sa nenašiel alebo nemáte dostatočné oprávnenia. Skúste sa prosím znova prihlásiť.");
              setLoading(false); // Zastaví načítavanie, aby sa zobrazila chyba
            }
          }, error => {
            console.error("MyDataApp: Chyba pri načítaní používateľských dát z Firestore (onSnapshot error):", error);
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
            console.log("MyDataApp: Načítanie používateľských dát zlyhalo, loading: false");
          });
        } catch (e) {
          console.error("MyDataApp: Chyba pri nastavovaní onSnapshot pre používateľské dáta (try-catch):", e);
          setError(`Chyba pri nastavovaní poslucháča pre používateľské dáta: ${e.message}`);
          setLoading(false); // Stop loading aj pri chybe
        }
      }
    } else if (isAuthReady && user === undefined) {
        console.log("MyDataApp: Auth ready, user undefined. Nastavujem loading na false.");
        setLoading(false);
    }


    return () => {
      // Zrušíme odber onSnapshot pri unmount
      if (unsubscribeUserDoc) {
        console.log("MyDataApp: Ruším odber onSnapshot pre používateľský dokument.");
        unsubscribeUserDoc();
      }
    };
  }, [isAuthReady, db, user, auth]);

  // useEffect for updating header link visibility
  // Removed isRegistrationOpen dependency as it's no longer in this file
  React.useEffect(() => {
    console.log(`MyDataApp: useEffect pre aktualizáciu odkazov hlavičky. User: ${user ? user.uid : 'null'}`);
    const authLink = document.getElementById('auth-link');
    const profileLink = document.getElementById('profile-link');
    const logoutButton = document.getElementById('logout-button');
    const registerLink = document.getElementById('register-link');

    if (authLink) {
      if (user) { // If user is logged in
        authLink.classList.add('hidden');
        profileLink && profileLink.classList.remove('hidden');
        logoutButton && logoutButton.classList.remove('hidden');
        registerLink && registerLink.classList.add('hidden');
        console.log("MyDataApp: Používateľ prihlásený. Skryté: Prihlásenie, Registrácia. Zobrazené: Moja zóna, Odhlásenie.");
      } else { // If user is not logged in
        authLink.classList.remove('hidden');
        profileLink && profileLink.classList.add('hidden');
        logoutButton && logoutButton.classList.add('hidden');
        // Register link visibility will now be handled by register.js based on registration settings
        // For logged-in-my-data.html, if not logged in, register link should be visible by default
        registerLink && registerLink.classList.remove('hidden'); 
        console.log("MyDataApp: Používateľ odhlásený. Zobrazené: Prihlásenie, Registrácia. Skryté: Moja zóna, Odhlásenie.");
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
      console.error("MyDataApp: Chyba pri odhlásení:", e);
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

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!db || !user) {
      setError("Databáza alebo používateľ nie je k dispozícii.");
      return;
    }
    setLoading(true);
    setError('');
    setUserNotificationMessage('');

    // Phone number validation
    const phoneRegex = /^\+\d+$/;
    if (!contactPhoneNumber || !phoneRegex.test(contactPhoneNumber)) {
        setError("Telefónne číslo kontaktnej osoby musí začínať znakom '+' a obsahovať iba číslice (napr. +421901234567).");
        setLoading(false);
        return;
    }

    try {
      const userDocRef = db.collection('users').doc(user.uid);
      await userDocRef.update({
        firstName: firstName,
        lastName: lastName,
        contactPhoneNumber: contactPhoneNumber,
        // Removed displayNotifications from here
      });
      await user.updateProfile({ displayName: `${firstName} ${lastName}` });
      setUserNotificationMessage("Profil úspešne aktualizovaný!");
    } catch (e) {
      console.error("MyDataApp: Chyba pri aktualizácii profilu:", e);
      setError(`Chyba pri aktualizácii profilu: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!auth || !db || !user) {
      setError("Auth, databáza alebo používateľ nie je k dispozícii.");
      return;
    }
    setLoading(true);
    setError('');
    setUserNotificationMessage('');
    try {
      // 1. Delete user data from Firestore
      await db.collection('users').doc(user.uid).delete();
      console.log("MyDataApp: Používateľské dáta vymazané z Firestore.");

      // 2. Delete user from Firebase Authentication
      await user.delete();
      console.log("MyDataApp: Používateľ vymazaný z Firebase Auth.");

      setUserNotificationMessage("Účet bol úspešne zmazaný. Budete presmerovaní na prihlasovaciu stránku.");
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 3000);
    } catch (e) {
      console.error("MyDataApp: Chyba pri mazaní účtu:", e);
      setError(`Chyba pri mazaní účtu: ${e.message}. Možno sa musíte znova prihlásiť, ak ste sa prihlásili príliš dávno.`);
    } finally {
      setLoading(false);
      setShowConfirmationModal(false); // Close modal even on error
    }
  };

  const openConfirmationModal = () => { // Simplified, no user param needed for own account
    setUserToDelete(user); // Set current user for deletion
    setShowConfirmationModal(true);
  };

  const closeConfirmationModal = () => {
    setUserToDelete(null);
    setShowConfirmationModal(false);
  };

  // Display loading state
  // Ak je user === undefined (ešte nebola skontrolovaná autentifikácia),
  // alebo userProfileData je null (ešte neboli načítané dáta profilu), alebo loading je true, zobraz loading.
  if (!isAuthReady || user === undefined || (user && !userProfileData) || loading) {
    // Ak je užívateľ null a auth je ready, znamená to, že nie je prihlásený, presmeruj
    if (isAuthReady && user === null) {
        console.log("MyDataApp: Auth je ready a používateľ je null, presmerovávam na login.html");
        window.location.href = 'login.html';
        return null;
    }
    // Zobrazenie rôznych správ podľa stavu načítavania
    let loadingMessage = 'Načítavam aplikáciu...';
    if (isAuthReady && user && !userProfileData) {
        loadingMessage = 'Načítavam používateľské dáta...'; // Špecifická správa pre profilové dáta
    } else if (loading) { // Všeobecný stav načítavania, napr. pri odosielaní formulára
        loadingMessage = 'Načítavam...';
    }

    return React.createElement(
      'div',
      { className: 'flex items-center justify-center min-h-screen bg-gray-100' },
      React.createElement('div', { className: 'text-xl font-semibold text-gray-700' }, loadingMessage)
    );
  }

  // No admin panel page check here, as this file is only for "My Data"
  // If user is not admin and trying to access admin panel, redirect is handled in specific admin pages

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
    React.createElement(NotificationModal, {
        message: userNotificationMessage,
        onClose: () => setUserNotificationMessage('')
    }),
    showConfirmationModal && React.createElement(ConfirmationModal, {
        message: `Naozaj chcete zmazať svoj účet (${userToDelete?.email})? Túto akciu nie je možné vrátiť späť.`,
        onConfirm: handleDeleteAccount,
        onCancel: closeConfirmationModal
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
          'Moja zóna'
        ),
        // Používame userProfileData pre zobrazenie mena a roly
        userProfileData && React.createElement(
          'p',
          { className: 'text-lg text-gray-600 text-center mb-4' },
          `Vitajte, ${userProfileData.firstName || userProfileData.email}! Vaša rola: ${userProfileData.role === 'admin' ? 'Administrátor' : 'Používateľ'}.`,
          userProfileData.role === 'admin' && !userProfileData.approved && React.createElement(
            'span',
            { className: 'text-red-500 font-semibold ml-2' },
            '(Čaká sa na schválenie)'
          )
        ),

        // My Data Section
        React.createElement(
          React.Fragment,
          null,
          React.createElement('h2', { className: 'text-2xl font-bold text-gray-800 mt-8 mb-4' }, 'Moje údaje'),
          React.createElement(
            'form',
            { onSubmit: handleUpdateProfile, className: 'space-y-4' },
            React.createElement(
              'div',
              null,
              React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'first-name' }, 'Meno'),
              React.createElement('input', {
                type: 'text',
                id: 'first-name',
                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                value: firstName,
                onChange: (e) => setFirstName(e.target.value),
                required: true,
                disabled: loading,
              })
            ),
            React.createElement(
              'div',
              null,
              React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'last-name' }, 'Priezvisko'),
              React.createElement('input', {
                type: 'text',
                id: 'last-name',
                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                value: lastName,
                onChange: (e) => setLastName(e.target.value),
                required: true,
                disabled: loading,
              })
            ),
            React.createElement(
              'div',
              null,
              React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'contact-phone' }, 'Telefónne číslo kontaktnej osoby'),
              React.createElement('input', {
                type: 'tel',
                id: 'contact-phone',
                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                value: contactPhoneNumber,
                onChange: (e) => {
                  const value = e.target.value;
                  if (value === '') {
                    setContactPhoneNumber('');
                    e.target.setCustomValidity('');
                    return;
                  }
                  if (value.length === 1 && value !== '+') {
                    e.target.setCustomValidity("Telefónne číslo musí začínať znakom '+'.");
                    e.target.reportValidity();
                    return;
                  }
                  if (value.length > 1 && !/^\+\d*$/.test(value)) {
                    e.target.setCustomValidity("Po znaku '+' sú povolené iba číslice.");
                    e.target.reportValidity();
                    return;
                  }
                  setContactPhoneNumber(value);
                  e.target.setCustomValidity('');
                },
                onInvalid: (e) => {
                  if (e.target.value.length === 0) {
                    e.target.setCustomValidity("Vyplňte prosím toto pole.");
                  } else if (e.target.value.length === 1 && e.target.value !== '+') {
                    e.target.setCustomValidity("Telefónne číslo musí začínať znakom '+'.");
                  } else if (e.target.value.length > 1 && !/^\+\d*$/.test(e.target.value)) {
                    e.target.setCustomValidity("Po znaku '+' sú povolené iba číslice.");
                  } else {
                    e.target.setCustomValidity("Telefónne číslo musí začínať znakom '+' a obsahovať iba číslice (napr. +421901234567).");
                  }
                },
                required: true,
                placeholder: '+421901234567',
                pattern: '^\\+\\d+$',
                title: 'Telefónne číslo musí začínať znakom '+' a obsahovať iba číslice (napr. +421901234567).',
                disabled: loading,
              })
            ),
            React.createElement(
              'div',
              null,
              React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'email-display' }, 'E-mailová adresa'),
              React.createElement('input', {
                type: 'email',
                id: 'email-display',
                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
                value: email,
                disabled: true, // Email is read-only
              })
            ),
            // Removed the display notifications checkbox from here
            React.createElement(
              'button',
              {
                type: 'submit',
                className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200',
                disabled: loading,
              },
              loading ? 'Ukladám...' : 'Uložiť zmeny'
            )
            // The "Zmazať účet" button was already removed
          ),
        )
      )
    )
  );
}
