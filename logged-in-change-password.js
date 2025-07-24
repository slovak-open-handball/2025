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

// PasswordInput Component for password fields with visibility toggle (converted to React.createElement)
function PasswordInput({ id, label, value, onChange, placeholder, autoComplete, showPassword, toggleShowPassword, onCopy, onPaste, onCut, disabled, description }) {
  // SVG ikony pre oko (zobraziť heslo) a oko-preškrtnuté (skryť heslo)
  const EyeIcon = React.createElement(
    'svg',
    { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
    // Cesta pre ikonu oka (viditeľné)
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 5 12 5c4.638 0 8.573 2.51 9.963 7.322.034.139.034.279 0 .418A10.05 10.05 0 0112 19c-4.638 0-8.573-2.51-9.963-7.322zM12 15a3 3 0 100-6 3 3 0 000 6z' })
  );

  const EyeOffIcon = React.createElement(
    'svg',
    { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
    // Cesta pre ikonu celého oka
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 5 12 5c4.638 0 8.573 2.51 9.963 7.322.034.139.034.279 0 .418A10.05 10.05 0 0112 19c-4.638 0-8.573-2.51-9.963-7.322zM12 15a3 3 0 100-6 3 3 0 000 6z' }),
    // Cesta pre diagonálnu čiaru preškrtnutia
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M4 20 L20 4' }) // Diagonálna čiara
  );

  return React.createElement(
    'div',
    null,
    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: id }, label),
    React.createElement(
      'div',
      { className: 'relative flex items-center' },
      React.createElement('input', {
        type: showPassword ? 'text' : 'password',
        id: id,
        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10 mb-0 mt-0',
        value: value,
        onChange: onChange,
        onCopy: (e) => e.preventDefault(),
        onPaste: (e) => e.preventDefault(),
        onCut: (e) => e.preventDefault(),
        required: true,
        placeholder: placeholder,
        autoComplete: autoComplete,
        disabled: disabled,
      }),
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: toggleShowPassword,
          className: 'absolute right-0 pr-3 flex items-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg top-1/2 -translate-y-1/2',
          disabled: disabled,
        },
        showPassword ? EyeOffIcon : EyeIcon
      )
    ),
    description && React.createElement(
      'div',
      { className: 'text-gray-600 text-sm mt-2' },
      description
    )
  );
}

// Main React component for the logged-in-change-password.html page
function ChangePasswordApp() {
  const [app, setApp] = React.useState(null);
  const [auth, setAuth] = React.useState(null);
  const [db, setDb] = React.useState(null);
  const [user, setUser] = React.useState(undefined); // Firebase User object from onAuthStateChanged
  const [userProfileData, setUserProfileData] = React.useState(null); 
  const [isAuthReady, setIsAuthReady] = React.useState(false); // Nový stav pre pripravenosť autentifikácie
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [userNotificationMessage, setUserNotificationMessage] = React.useState('');

  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmNewPassword, setConfirmNewPassword] = React.useState('');

  // States for password visibility
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = React.useState(false);

  // Effect for Firebase initialization and Auth Listener setup (runs only once)
  React.useEffect(() => {
    let unsubscribeAuth;
    let firestoreInstance;

    try {
      if (typeof firebase === 'undefined') {
        console.error("ChangePasswordApp: Firebase SDK nie je načítané.");
        setError("Firebase SDK nie je načítané. Skontrolujte logged-in-change-password.html.");
        setLoading(false);
        return;
      }

      // Získanie predvolenej Firebase aplikácie
      // POZNÁMKA: Pre správne fungovanie musí byť predvolená Firebase aplikácia
      // inicializovaná v logged-in-change-password.html (napr. firebase.initializeApp(firebaseConfig);)
      // PREDTÝM, ako sa načíta tento skript.
      const firebaseApp = firebase.app();
      setApp(firebaseApp);

      const authInstance = firebase.auth(firebaseApp);
      setAuth(authInstance);
      firestoreInstance = firebase.firestore(firebaseApp);
      setDb(firestoreInstance);

      // Funkcia pre počiatočné prihlásenie (ak existuje custom token)
      const signIn = async () => {
        try {
          // initialAuthToken je globálna premenná definovaná v HTML
          if (typeof initialAuthToken !== 'undefined' && initialAuthToken) {
            await authInstance.signInWithCustomToken(initialAuthToken);
            console.log("ChangePasswordApp: Počiatočné prihlásenie s custom tokenom úspešné.");
          } else {
            console.log("ChangePasswordApp: Žiadny initialAuthToken na počiatočné prihlásenie.");
          }
        } catch (e) {
          console.error("ChangePasswordApp: Chyba pri počiatočnom prihlásení Firebase (s custom tokenom):", e);
          setError(`Chyba pri prihlásení: ${e.message}`);
        }
      };

      unsubscribeAuth = authInstance.onAuthStateChanged(async (currentUser) => {
        console.log("ChangePasswordApp: onAuthStateChanged - Používateľ:", currentUser ? currentUser.uid : "null");
        setUser(currentUser); // Nastaví Firebase User objekt
        setIsAuthReady(true); // Označí autentifikáciu ako pripravenú po prvej kontrole
      });

      signIn(); // Spustí počiatočné prihlásenie

      return () => {
        if (unsubscribeAuth) {
          unsubscribeAuth();
        }
      };
    } catch (e) {
      console.error("ChangePasswordApp: Nepodarilo sa inicializovať Firebase:", e);
      setError(`Chyba pri inicializácii Firebase: ${e.message}`);
      setLoading(false);
    }
  }, []); // Prázdne pole závislostí - spustí sa len raz pri načítaní komponentu

  // Effect for loading user profile data from Firestore after Auth and DB are initialized
  React.useEffect(() => {
    let unsubscribeUserDoc;

    // Spustí sa len ak je Auth pripravené, DB je k dispozícii a user je definovaný (nie undefined)
    if (isAuthReady && db && user !== undefined) {
      if (user === null) { // Ak je používateľ null (nie je prihlásený), presmeruj
        console.log("ChangePasswordApp: Auth je ready a používateľ je null, presmerovávam na login.html");
        window.location.href = 'login.html';
        return;
      }

      // Ak je používateľ prihlásený, pokús sa načítať jeho dáta z Firestore
      if (user) {
        console.log(`ChangePasswordApp: Pokúšam sa načítať používateľský dokument pre UID: ${user.uid}`);
        setLoading(true); // Nastavíme loading na true tu

        try {
          const userDocRef = db.collection('users').doc(user.uid);
          unsubscribeUserDoc = userDocRef.onSnapshot(docSnapshot => {
            console.log("ChangePasswordApp: onSnapshot pre používateľský dokument spustený.");
            if (docSnapshot.exists) {
              const userData = docSnapshot.data();
              console.log("ChangePasswordApp: Používateľský dokument existuje, dáta:", userData);
              setUserProfileData(userData); // Aktualizujeme stav userProfileData
              
              setLoading(false); // Stop loading po načítaní používateľských dát
              setError(''); // Vymazať chyby po úspešnom načítaní

              // Aktualizácia viditeľnosti menu po načítaní roly (volanie globálnej funkcie z left-menu.js)
              if (typeof updateMenuItemsVisibility === 'function') { // Používame priame volanie
                  updateMenuItemsVisibility(userData.role);
              } else {
                  console.warn("ChangePasswordApp: Funkcia updateMenuItemsVisibility nie je definovaná.");
              }

              console.log("ChangePasswordApp: Načítanie používateľských dát dokončené, loading: false");
            } else {
              console.warn("ChangePasswordApp: Používateľský dokument sa nenašiel pre UID:", user.uid);
              setError("Chyba: Používateľský profil sa nenašiel alebo nemáte dostatočné oprávnenia. Skúste sa prosím znova prihlásiť.");
              setLoading(false); // Zastaví načítavanie, aby sa zobrazila chyba
            }
          }, error => {
            console.error("ChangePasswordApp: Chyba pri načítaní používateľských dát z Firestore (onSnapshot error):", error);
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
            console.log("ChangePasswordApp: Načítanie používateľských dát zlyhalo, loading: false");
          });
        } catch (e) {
          console.error("ChangePasswordApp: Chyba pri nastavovaní onSnapshot pre používateľské dáta (try-catch):", e);
          setError(`Chyba pri nastavovaní poslucháča pre používateľské dáta: ${e.message}`);
          setLoading(false); // Stop loading aj pri chybe
        }
      }
    } else if (isAuthReady && user === undefined) {
        console.log("ChangePasswordApp: Auth ready, user undefined. Setting loading to false.");
        setLoading(false);
    }

    return () => {
      // Zrušíme odber onSnapshot pri unmount
      if (unsubscribeUserDoc) {
        console.log("ChangePasswordApp: Ruším odber onSnapshot pre používateľský dokument.");
        unsubscribeUserDoc();
      }
    };
  }, [isAuthReady, db, user, auth]); // Závisí od isAuthReady, db, user a auth

  // useEffect for updating header link visibility
  React.useEffect(() => {
    console.log(`ChangePasswordApp: useEffect for updating header links. User: ${user ? user.uid : 'null'}`);
    // Volanie globálnej funkcie z header.js na aktualizáciu odkazov v hlavičke
    // Používame priame volanie, ako v logged-in-change-name.js
    if (typeof updateHeaderLinks === 'function') { 
        // updateHeaderLinks očakáva currentUser a isRegistrationOpenStatus
        // isRegistrationOpenStatus je interne riadený v header.js, takže môžeme poslať null alebo false
        updateHeaderLinks(user, null); 
    } else {
        console.warn("ChangePasswordApp: Funkcia updateHeaderLinks nie je definovaná v header.js.");
        // Fallback pre manuálnu aktualizáciu, ak funkcia nie je dostupná
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
            } else {
                authLink.classList.remove('hidden');
                profileLink && profileLink.classList.add('hidden');
                logoutButton && logoutButton.classList.add('hidden');
                registerLink && registerLink.classList.remove('hidden');
            }
        }
    }
  }, [user]); // Závisí od objektu používateľa

  // Handle logout (needed for the header logout button)
  const handleLogout = React.useCallback(async () => {
    if (!auth) return;
    try {
      setLoading(true);
      await auth.signOut();
      setUserNotificationMessage("Úspešne odhlásený.");
      window.location.href = 'login.html';
    } catch (e) {
      console.error("ChangePasswordApp: Chyba pri odhlásení:", e);
      setError(`Chyba pri odhlásení: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [auth]);

  // Attach logout handler to the button in the header (via event listener, not direct onClick)
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

  const validatePassword = (pwd) => {
    const errors = [];

    if (pwd.length < 10) {
      errors.push("minimálne 10 znakov");
    }
    if (pwd.length > 4096) {
      errors.push("maximálne 4096 znakov");
    }
    if (!/[A-Z]/.test(pwd)) {
      errors.push("aspoň jedno veľké písmeno");
    }
    if (!/[a-z]/.test(pwd)) {
      errors.push("aspoň jedno malé písmeno");
    }
    if (!/[0-9]/.test(pwd)) {
      errors.push("aspoň jednu číslicu");
    }

    if (errors.length === 0) {
      return null;
    } else {
      return "Heslo musí obsahovať:\n• " + errors.join("\n• ") + ".";
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!auth || !user) {
      setError("Autentifikácia nie je k dispozícii. Skúste sa znova prihlásiť.");
      return;
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
    setError('');
    setUserNotificationMessage('');

    try {
      // Re-authenticate user before changing password for security
      const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
      await user.reauthenticateWithCredential(credential);
      console.log("ChangePasswordApp: Používateľ úspešne znovu overený.");

      // Update password
      await user.updatePassword(newPassword);
      console.log("ChangePasswordApp: Heslo úspešne zmenené.");

      setUserNotificationMessage("Heslo bolo úspešne zmenené. Pre vašu bezpečnosť vás odhlasujeme. Prosím, prihláste sa s novým heslom.");
      
      // Clear password fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');

      // Sign out user after password change for security
      await auth.signOut();
      console.log("ChangePasswordApp: Používateľ odhlásený po zmene hesla.");
      
      setTimeout(() => {
        window.location.href = 'login.html'; // Redirect to login page
      }, 3000);

    } catch (e) {
      console.error("ChangePasswordApp: Chyba pri zmene hesla:", e);
      if (e.code === 'auth/wrong-password') {
        setError("Zadané aktuálne heslo je nesprávne.");
      } else if (e.code === 'auth/weak-password') {
        setError("Nové heslo je príliš slabé. " + validatePassword(newPassword));
      } else if (e.code === 'auth/requires-recent-login') {
        setError("Táto akcia vyžaduje nedávne prihlásenie. Prosím, odhláste sa a znova sa prihláste a skúste to znova.");
      } else {
        setError(`Chyba pri zmene hesla: ${e.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Display loading state
  if (!isAuthReady || user === undefined || (user && !userProfileData) || loading) {
    if (isAuthReady && user === null) {
        console.log("ChangePasswordApp: Auth je ready a používateľ je null, presmerovávam na login.html");
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

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
    React.createElement(NotificationModal, {
        message: userNotificationMessage,
        onClose: () => setUserNotificationMessage('')
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
          'Zmeniť heslo'
        ),
        React.createElement(
          'form',
          { onSubmit: handleChangePassword, className: 'space-y-4' },
          React.createElement(PasswordInput, {
            id: 'current-password',
            label: 'Aktuálne heslo',
            value: currentPassword,
            onChange: (e) => setCurrentPassword(e.target.value),
            onCopy: (e) => e.preventDefault(),
            onPaste: (e) => e.preventDefault(),
            onCut: (e) => e.preventDefault(),
            placeholder: "Zadajte aktuálne heslo",
            autoComplete: "current-password",
            showPassword: showCurrentPassword,
            toggleShowPassword: () => setShowCurrentPassword(!showCurrentPassword),
            disabled: loading,
          }),
          React.createElement(PasswordInput, {
            id: 'new-password',
            label: 'Nové heslo',
            value: newPassword,
            onChange: (e) => setNewPassword(e.target.value),
            onCopy: (e) => e.preventDefault(),
            onPaste: (e) => e.preventDefault(),
            onCut: (e) => e.preventDefault(),
            placeholder: "Zadajte nové heslo (min. 10 znakov)",
            autoComplete: "new-password",
            showPassword: showNewPassword,
            toggleShowPassword: () => setShowNewPassword(!showNewPassword),
            disabled: loading,
            description: React.createElement(
              React.Fragment,
              null,
              'Heslo musí obsahovať:',
              React.createElement(
                'ul',
                { className: 'list-disc list-inside ml-4' },
                React.createElement('li', null, 'aspoň jedno malé písmeno,'),
                React.createElement('li', null, 'aspoň jedno veľké písmeno,'),
                React.createElement('li', null, 'aspoň jednu číslicu.')
              )
            )
          }),
          React.createElement(PasswordInput, {
            id: 'confirm-new-password',
            label: 'Potvrďte nové heslo',
            value: confirmNewPassword,
            onChange: (e) => setConfirmNewPassword(e.target.value),
            onCopy: (e) => e.preventDefault(),
            onPaste: (e) => e.preventDefault(),
            onCut: (e) => e.preventDefault(),
            placeholder: "Potvrďte nové heslo",
            autoComplete: "new-password",
            showPassword: showConfirmNewPassword,
            toggleShowPassword: () => setShowConfirmNewPassword(!showConfirmNewPassword),
            disabled: loading,
          }),
          React.createElement(
            'button',
            {
              type: 'submit',
              className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200',
              disabled: loading,
            },
            loading ? (
              React.createElement(
                'div',
                { className: 'flex items-center justify-center' },
                React.createElement('svg', { className: 'animate-spin -ml-1 mr-3 h-5 w-5 text-white', xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24' },
                  React.createElement('circle', { className: 'opacity-25', cx: '12', cy: '12', r: '10', stroke: 'currentColor', strokeWidth: '4' }),
                  React.createElement('path', { className: 'opacity-75', fill: 'currentColor', d: 'M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z' })
                ),
                'Ukladám...'
              )
            ) : 'Zmeniť heslo'
          )
        )
      )
    )
  );
}
