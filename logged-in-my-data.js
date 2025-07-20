// Global application ID and Firebase configuration (should be consistent across all React apps)
const appId = '1:26454452024:web:6954b4f90f87a3a1eb43cd';
const firebaseConfig = {
  apiKey: "AIzaSyDj_bSTkjrquu1nyIVYW7YLbyBl1pD6YYo",
  authDomain: "prihlasovanie-4f3f3.firebaseapp.com",
  projectId: "prihlasovanie-4f3f3",
  storageBucket: "prihlasovanie-4f3f3.firebasestorage.app",
  messagingSenderId: "26454452024",
  appId: "1:26454452024:web:6954b4f90f87a3a1eb43cd"
};
const initialAuthToken = null; // Global authentication token

const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec";

// PasswordInput Component for password fields with visibility toggle (converted to React.createElement)
function PasswordInput({ id, label, value, onChange, placeholder, autoComplete, showPassword, toggleShowPassword, onCopy, onPaste, onCut, disabled, description }) {
  const EyeIcon = React.createElement(
    'svg',
    { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 5 12 5c4.638 0 8.573 2.51 9.963 7.322.034.139.034.279 0 .418A10.05 10.05 0 0112 19c-4.638 0-8.573-2.51-9.963-7.322zM15 12a3 3 0 11-6 0 3 3 0 016 0z' })
  );

  const EyeOffIcon = React.createElement(
    'svg',
    { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.274-4.057 5.064-7 9.542-7a9.95 9.95 0 011.875.175m.001 0V5m0 14v-2.175m0-10.65L12 12m-6.25 6.25L12 12m0 0l6.25-6.25M12 12l-6.25-6.25' })
  );

  return React.createElement(
    'div',
    { className: 'relative' },
    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: id }, label),
    React.createElement('input', {
      type: showPassword ? 'text' : 'password',
      id: id,
      className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10',
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
        className: 'absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5',
        disabled: disabled,
      },
      showPassword ? EyeOffIcon : EyeIcon
    ),
    description && React.createElement(
      'div', // Changed from 'p' to 'div' to resolve DOM nesting warning
      { className: 'text-gray-600 text-sm -mt-2' },
      description
    )
  );
}

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

// Custom Modal component for confirmations (e.g., delete account)
function ConfirmationModal({ show, title, message, onConfirm, onCancel, confirmButtonText, cancelButtonText, loading }) {
  if (!show) return null;

  return React.createElement(
    'div',
    { className: 'modal' },
    React.createElement(
      'div',
      { className: 'modal-content max-w-md mx-auto p-6 bg-white rounded-lg shadow-xl text-center' },
      React.createElement('h3', { className: 'text-2xl font-bold text-gray-800 mb-4' }, title),
      React.createElement('p', { className: 'text-gray-700 mb-6' }, message),
      React.createElement(
        'div',
        { className: 'flex justify-center space-x-4' },
        React.createElement(
          'button',
          {
            onClick: onCancel,
            className: 'px-6 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors duration-200',
            disabled: loading
          },
          cancelButtonText || 'Zrušiť'
        ),
        React.createElement(
          'button',
          {
            onClick: onConfirm,
            className: 'px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200',
            disabled: loading
          },
          loading ? 'Spracúvam...' : (confirmButtonText || 'Potvrdiť')
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
  const [user, setUser] = React.useState(null);
  const [isAuthReady, setIsAuthReady] = React.useState(false);
  const [pageLoading, setPageLoading] = React.useState(true); // Initial page loading
  const [formSubmitting, setFormSubmitting] = React.useState(false); // For form submissions
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');

  const [userData, setUserData] = React.useState(null);
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [contactPhoneNumber, setContactPhoneNumber] = React.useState('');
  const [displayNotifications, setDisplayNotifications] = React.useState(true);

  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmNewPassword, setConfirmNewPassword] = React.useState('');
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = React.useState(false);

  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Effect for Firebase initialization and Auth Listener setup
  React.useEffect(() => {
    let unsubscribeAuth;
    let firestoreInstance;

    try {
      if (typeof firebase === 'undefined') {
        setError("Firebase SDK nie je načítané. Skontrolujte logged-in-my-data.html.");
        setPageLoading(false);
        return;
      }

      const firebaseApp = firebase.initializeApp(firebaseConfig);
      setApp(firebaseApp);

      const authInstance = firebase.auth(firebaseApp);
      setAuth(authInstance);
      firestoreInstance = firebase.firestore(firebaseApp);
      setDb(firestoreInstance);

      // No immediate redirect in signIn. Let onAuthStateChanged handle it.
      const signIn = async () => {
        try {
          if (initialAuthToken) {
            await authInstance.signInWithCustomToken(initialAuthToken);
          }
          // If no initialAuthToken, just let onAuthStateChanged handle the current user state.
        } catch (e) {
          console.error("Chyba pri počiatočnom prihlásení Firebase:", e);
          setError(`Chyba pri prihlásení: ${e.message}`);
          // Do not redirect here, let onAuthStateChanged decide.
        }
      };

      unsubscribeAuth = authInstance.onAuthStateChanged(async (currentUser) => {
        setUser(currentUser);
        setIsAuthReady(true); // Auth state has been determined

        if (!currentUser) {
            // If user is not authenticated, redirect to login page
            window.location.href = 'login.html';
            return; // Stop further execution in this effect
        } else {
            // User is authenticated, now fetch their data
            if (db) { // Ensure db is available
                const userDocRef = db.collection('users').doc(currentUser.uid);
                const unsubscribeFirestore = userDocRef.onSnapshot(docSnapshot => {
                    if (docSnapshot.exists) {
                        const data = docSnapshot.data();
                        setUserData(data);
                        setFirstName(data.firstName || '');
                        setLastName(data.lastName || '');
                        setContactPhoneNumber(data.contactPhoneNumber || '');
                        setDisplayNotifications(data.displayNotifications !== undefined ? data.displayNotifications : true);
                    } else {
                        console.warn("Používateľský dokument sa nenašiel vo Firestore.");
                        setError("Používateľské dáta sa nenašli. Kontaktujte podporu.");
                        authInstance.signOut(); // Force logout if data is missing
                    }
                    setPageLoading(false); // Data loaded (or not found), stop page loading
                }, err => {
                    console.error("Chyba pri načítaní používateľských dát z Firestore:", err);
                    setError(`Chyba pri načítaní dát: ${err.message}`);
                    setPageLoading(false); // Stop page loading on error
                });
                return () => unsubscribeFirestore(); // Clean up Firestore listener
            } else {
                // If db is not yet available, but user is authenticated, wait for db
                // This case should be rare if db is set in the same effect.
                setPageLoading(false); // Still set to false to avoid infinite loading if db never becomes available
            }
        }
      });

      signIn(); // Initiate sign-in attempt

      return () => {
        if (unsubscribeAuth) {
          unsubscribeAuth();
        }
      };
    } catch (e) {
      console.error("Nepodarilo sa inicializovať Firebase:", e);
      setError(`Chyba pri inicializácii Firebase: ${e.message}`);
      setPageLoading(false);
      window.location.href = 'login.html'; // Redirect on critical Firebase init error
    }
  }, [db]); // Depend on db to ensure it's initialized before trying to fetch data

  // Display initial page loading state
  if (pageLoading || !isAuthReady) {
    return React.createElement(
      'div',
      { className: 'flex items-center justify-center min-h-screen bg-gray-100' },
      React.createElement('div', { className: 'text-xl font-semibold text-gray-700' }, 'Načítavam údaje...')
    );
  }

  // If user is not authenticated after initial check (and not loading), redirect
  // This check is now redundant because onAuthStateChanged handles the redirect.
  // Keeping it for clarity, but it should ideally not be reached if onAuthStateChanged works.
  if (!user) {
    return null; // Should have been redirected by useEffect
  }

  const validatePassword = (pwd) => {
    const errors = [];
    if (pwd.length < 10) errors.push("aspoň 10 znakov");
    if (pwd.length > 4096) errors.push("maximálne 4096 znakov");
    if (!/[A-Z]/.test(pwd)) errors.push("aspoň jedno veľké písmeno");
    if (!/[a-z]/.test(pwd)) errors.push("aspoň jedno malé písmeno");
    if (!/[0-9]/.test(pwd)) errors.push("aspoň jednu číslicu");
    return errors.length === 0 ? null : "Heslo musí obsahovať:\n• " + errors.join("\n• ") + ".";
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!user || !db) return;

    setFormSubmitting(true);
    setError('');
    setMessage('');

    try {
      const phoneRegex = /^\+\d+$/;
      if (!contactPhoneNumber || !phoneRegex.test(contactPhoneNumber)) {
          setError("Telefónne číslo kontaktnej osoby musí začínať znakom '+' a obsahovať iba číslice (napr. +421901234567).");
          setFormSubmitting(false);
          return;
      }

      await db.collection('users').doc(user.uid).update({
        firstName: firstName,
        lastName: lastName,
        contactPhoneNumber: contactPhoneNumber,
        displayNotifications: displayNotifications
      });
      setMessage("Profil bol úspešne aktualizovaný!");
    } catch (e) {
      console.error("Chyba pri aktualizácii profilu:", e);
      setError(`Chyba pri aktualizácii profilu: ${e.message}`);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!user || !auth) return;

    if (newPassword !== confirmNewPassword) {
      setError("Nové heslá sa nezhodujú.");
      return;
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setFormSubmitting(true);
    setError('');
    setMessage('');

    try {
      const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
      await user.reauthenticateWithCredential(credential);
      await user.updatePassword(newPassword);

      setMessage("Heslo bolo úspešne zmenené!");
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (e) {
      console.error("Chyba pri zmene hesla:", e);
      if (e.code === 'auth/wrong-password') {
        setError("Nesprávne aktuálne heslo. Skúste to prosím znova.");
      } else if (e.code === 'auth/weak-password') {
        setError("Nové heslo je príliš slabé. " + validatePassword(newPassword));
      } else {
        setError(`Chyba pri zmene hesla: ${e.message}`);
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || !auth || !db) return;

    setIsDeleting(true);
    setError('');
    setMessage('');

    try {
      // Re-authenticate user before deleting (important security step)
      // For simplicity, we'll assume the user is still recently authenticated.
      // In a real app, you might ask for password again.
      
      // Delete user document from Firestore first
      await db.collection('users').doc(user.uid).delete();
      console.log("Používateľský dokument bol zmazaný z Firestore.");

      // Delete user from Firebase Authentication
      await user.delete();
      console.log("Používateľský účet bol zmazaný z Firebase Auth.");

      setMessage("Váš účet bol úspešne zmazaný. Budete presmerovaní na prihlasovaciu stránku.");
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 3000);

    } catch (e) {
      console.error("Chyba pri mazaní účtu:", e);
      if (e.code === 'auth/requires-recent-login') {
        setError("Pre zmazanie účtu sa prosím znova prihláste (bezpečnostné opatrenie).");
        auth.signOut(); // Force logout
      } else {
        setError(`Chyba pri mazaní účtu: ${e.message}`);
      }
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
    React.createElement(NotificationModal, {
      message: message,
      onClose: () => setMessage('')
    }),
    React.createElement(ConfirmationModal, {
      show: showDeleteModal,
      title: "Potvrdenie zmazania účtu",
      message: "Naozaj chcete zmazať svoj účet? Táto akcia je nezvratná a všetky vaše údaje budú natrvalo odstránené.",
      onConfirm: handleDeleteAccount,
      onCancel: () => setShowDeleteModal(false),
      confirmButtonText: "Áno, zmazať",
      cancelButtonText: "Zrušiť",
      loading: isDeleting
    }),
    React.createElement(
      'div',
      { className: 'w-full max-w-2xl mt-20 mb-10 p-4' },
      React.createElement(
        'div',
        { className: 'bg-white p-8 rounded-lg shadow-xl w-full' },
        error && React.createElement(
          'div',
          { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap', role: 'alert' },
          error
        ),
        React.createElement('h1', { className: 'text-3xl font-bold text-center text-gray-800 mb-6' }, 'Moje údaje'),

        // Profile Update Form
        React.createElement('h2', { className: 'text-2xl font-semibold text-gray-800 mb-4' }, 'Upraviť profil'),
        React.createElement(
          'form',
          { onSubmit: handleUpdateProfile, className: 'space-y-4 mb-8' },
          React.createElement(
            'div',
            null,
            React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'firstName' }, 'Meno'),
            React.createElement('input', {
              type: 'text',
              id: 'firstName',
              className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
              value: firstName,
              onChange: (e) => setFirstName(e.target.value),
              required: true,
              disabled: formSubmitting
            })
          ),
          React.createElement(
            'div',
            null,
            React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'lastName' }, 'Priezvisko'),
            React.createElement('input', {
              type: 'text',
              id: 'lastName',
              className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
              value: lastName,
              onChange: (e) => setLastName(e.target.value),
              required: true,
              disabled: formSubmitting
            })
          ),
          React.createElement(
            'div',
            null,
            React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'contactPhoneNumber' }, 'Telefónne číslo'),
            React.createElement('input', {
              type: 'tel',
              id: 'contactPhoneNumber',
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
              disabled: formSubmitting,
            })
          ),
          React.createElement(
            'div',
            null,
            React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'emailDisplay' }, 'E-mailová adresa'),
            React.createElement('input', {
              type: 'email',
              id: 'emailDisplay',
              className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 bg-gray-100 cursor-not-allowed leading-tight focus:outline-none',
              value: user ? user.email : '',
              disabled: true // Email cannot be changed directly here
            })
          ),
          React.createElement(
            'div',
            { className: 'flex items-center mt-4' },
            React.createElement('input', {
              type: 'checkbox',
              id: 'displayNotifications',
              className: 'mr-2 leading-tight',
              checked: displayNotifications,
              onChange: (e) => setDisplayNotifications(e.target.checked),
              disabled: formSubmitting
            }),
            React.createElement('label', { className: 'text-gray-700 text-sm', htmlFor: 'displayNotifications' }, 'Zobrazovať notifikácie')
          ),
          React.createElement(
            'button',
            {
              type: 'submit',
              className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200',
              disabled: formSubmitting
            },
            formSubmitting ? 'Ukladám...' : 'Uložiť zmeny profilu'
          )
        ),

        // Change Password Form
        React.createElement('h2', { className: 'text-2xl font-semibold text-gray-800 mb-4' }, 'Zmeniť heslo'),
        React.createElement(
          'form',
          { onSubmit: handleChangePassword, className: 'space-y-4 mb-8' },
          React.createElement(PasswordInput, {
            id: 'currentPassword',
            label: 'Aktuálne heslo',
            value: currentPassword,
            onChange: (e) => setCurrentPassword(e.target.value),
            placeholder: 'Zadajte aktuálne heslo',
            autoComplete: 'current-password',
            showPassword: showCurrentPassword,
            toggleShowPassword: () => setShowCurrentPassword(!showCurrentPassword),
            disabled: formSubmitting
          }),
          React.createElement(PasswordInput, {
            id: 'newPassword',
            label: 'Nové heslo',
            value: newPassword,
            onChange: (e) => setNewPassword(e.target.value),
            placeholder: 'Zadajte nové heslo (min. 10 znakov)',
            autoComplete: 'new-password',
            showPassword: showNewPassword,
            toggleShowPassword: () => setShowNewPassword(!showNewPassword),
            disabled: formSubmitting,
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
            ),
          }),
          React.createElement(PasswordInput, {
            id: 'confirmNewPassword',
            label: 'Potvrdiť nové heslo',
            value: confirmNewPassword,
            onChange: (e) => setConfirmNewPassword(e.target.value),
            placeholder: 'Potvrďte nové heslo',
            autoComplete: 'new-password',
            showPassword: showConfirmNewPassword,
            toggleShowPassword: () => setShowConfirmNewPassword(!showConfirmNewPassword),
            disabled: formSubmitting
          }),
          React.createElement(
            'button',
            {
              type: 'submit',
              className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200',
              disabled: formSubmitting
            },
            formSubmitting ? 'Mení sa heslo...' : 'Zmeniť heslo'
          )
        ),

        // Delete Account Section
        React.createElement('h2', { className: 'text-2xl font-semibold text-gray-800 mb-4' }, 'Zmazať účet'),
        React.createElement(
          'div',
          { className: 'flex justify-center' },
          React.createElement(
            'button',
            {
              onClick: () => setShowDeleteModal(true),
              className: 'bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200',
              disabled: formSubmitting || isDeleting
            },
            'Zmazať účet'
          )
        )
      )
    )
  );
}
