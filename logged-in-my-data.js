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

  const [isAdmin, setIsAdmin] = React.useState(false); // New state for isAdmin
  const [userDataEditEndDate, setUserDataEditEndDate] = React.useState(''); // New state for edit end date
  const [settingsLoaded, setSettingsLoaded] = React.useState(false); // New state for settings loaded


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


  // Effect for Firebase initialization and Auth Listener setup
  React.useEffect(() => {
    let unsubscribeAuth;
    let unsubscribeFirestore = null;

    try {
      if (typeof firebase === 'undefined') {
        console.error("Firebase SDK nie je načítané. Skontrolujte logged-in-my-data.html.");
        setError("Firebase SDK nie je načítané.");
        setPageLoading(false);
        return;
      }

      // Initialize Firebase app only once
      let firebaseAppInstance;
      try {
        firebaseAppInstance = firebase.app(); // Try to get default app
      } catch (e) {
        firebaseAppInstance = firebase.initializeApp(firebaseConfig); // Initialize if not already
      }
      setApp(firebaseAppInstance);

      const authInstance = firebase.auth(firebaseAppInstance);
      setAuth(authInstance);
      const firestoreInstance = firebase.firestore(firebaseAppInstance);
      setDb(firestoreInstance);

      // Listen for auth state changes
      unsubscribeAuth = authInstance.onAuthStateChanged(async (currentUser) => {
        if (!currentUser) {
            // User is NOT authenticated, redirect to login page
            console.log("Používateľ nie je prihlásený, presmerovanie na login.html");
            window.location.href = 'login.html';
            return;
        }

        // User IS authenticated
        setUser(currentUser);
        setIsAuthReady(true); // Auth state has been determined

        // Fetch user data from Firestore
        if (firestoreInstance) {
            const userDocRef = firestoreInstance.collection('users').doc(currentUser.uid);
            unsubscribeFirestore = userDocRef.onSnapshot(docSnapshot => {
                if (docSnapshot.exists) {
                    const data = docSnapshot.data();
                    setUserData(data);
                    setFirstName(data.firstName || '');
                    setLastName(data.lastName || '');
                    setContactPhoneNumber(data.contactPhoneNumber || '');
                    setDisplayNotifications(data.displayNotifications !== undefined ? data.displayNotifications : true);
                    setIsAdmin(data.role === 'admin'); // Set isAdmin state
                    setPageLoading(false); // Data loaded, stop page loading
                } else {
                    console.warn("Používateľský dokument sa nenašiel vo Firestore. Vynútené odhlásenie.");
                    setError("Používateľské dáta sa nenašli. Kontaktujte podporu.");
                    authInstance.signOut(); // Force logout if data is missing
                    setPageLoading(false); // Stop page loading
                }
            }, err => {
                console.error("Chyba pri načítaní používateľských dát z Firestore:", err);
                setError(`Chyba pri načítaní dát: ${err.message}`);
                authInstance.signOut(); // Force logout on Firestore error
                setPageLoading(false); // Stop page loading
            });
        } else {
            console.warn("Firestore inštancia nie je dostupná po prihlásení.");
            setError("Chyba: Databázové služby nie sú dostupné.");
            setPageLoading(false);
        }
      });

      // Attempt initial sign-in if token exists (this is non-blocking for onAuthStateChanged)
      if (initialAuthToken) {
        authInstance.signInWithCustomToken(initialAuthToken).catch(e => {
          console.error("Chyba pri počiatočnom prihlásení Firebase s tokenom:", e);
          // Do not redirect here, onAuthStateChanged will handle if it fails to sign in.
        });
      }

      return () => {
        // Cleanup function for both auth and firestore listeners
        if (unsubscribeAuth) {
          unsubscribeAuth();
        }
        if (unsubscribeFirestore) {
          unsubscribeFirestore();
        }
      };
    } catch (e) {
      console.error("Nepodarilo sa inicializovať Firebase:", e);
      setError(`Chyba pri inicializácii Firebase: ${e.message}`);
      setPageLoading(false);
      // If Firebase initialization itself fails, redirect to login.
      window.location.href = 'login.html';
    }
  }, []); // Empty dependency array - runs only once on component mount

  // Effect for loading settings (runs after DB and Auth are initialized)
  React.useEffect(() => {
    const fetchSettings = async () => {
      if (!db || !isAuthReady) {
        return; // Wait for DB and Auth to be initialized
      }
      try {
          const settingsDocRef = db.collection('settings').doc('registration');
          const unsubscribeSettings = settingsDocRef.onSnapshot(docSnapshot => {
            if (docSnapshot.exists) {
                const data = docSnapshot.data();
                setUserDataEditEndDate(data.userDataEditEndDate ? formatToDatetimeLocal(data.userDataEditEndDate.toDate()) : '');
            } else {
                console.log("Nastavenia registrácie neboli nájdené vo Firestore. Používam predvolené prázdne hodnoty.");
                setUserDataEditEndDate('');
            }
            setSettingsLoaded(true); // Nastavenia sú načítané, aj keď prázdne alebo s chybou
          }, error => {
            console.error("Chyba pri načítaní nastavení registrácie (onSnapshot):", error);
            setError(`Chyba pri načítaní nastavení: ${error.message}`);
            setSettingsLoaded(true);
          });

          return () => unsubscribeSettings(); // Vyčistenie onSnapshot listenera pri unmount
      } catch (e) {
          console.error("Chyba pri nastavení onSnapshot pre nastavenia registrácie:", e);
          setError(`Chyba pri nastavení listenera pre nastavenia: ${e.message}`);
          setSettingsLoaded(true);
      }
    };

    fetchSettings();
  }, [db, isAuthReady]);


  // Display initial page loading state
  if (pageLoading || !isAuthReady || !settingsLoaded) {
    return React.createElement(
      'div',
      { className: 'flex items-center justify-center min-h-screen bg-gray-100' },
      React.createElement('div', { className: 'text-xl font-semibold text-gray-700' }, 'Načítavam údaje...')
    );
  }

  // If user is null AFTER isAuthReady is true and pageLoading is false, it means they were redirected by onAuthStateChanged.
  if (!user) {
    return null; // Don't render anything, as a redirect should have occurred.
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

    const now = new Date();
    const editEnd = userDataEditEndDate ? new Date(userDataEditEndDate) : null;
    if (editEnd && now > editEnd) {
        setError("Úpravy vašich údajov sú už uzavreté. Boli uzavreté dňa: " + (editEnd ? editEnd.toLocaleString('sk-SK') : '-'));
        setFormSubmitting(false);
        return;
    }

    try {
      const phoneRegex = /^\+\d+$/;
      if (!isAdmin && (!contactPhoneNumber || !phoneRegex.test(contactPhoneNumber))) { // Only validate phone for non-admins
          setError("Telefónne číslo kontaktnej osoby musí začínať znakom '+' a obsahovať iba číslice (napr. +421901234567).");
          setFormSubmitting(false);
          return;
      }

      const oldFirstName = userData.firstName;
      const oldLastName = userData.lastName;
      const oldContactPhoneNumber = userData.contactPhoneNumber;

      const updatedFirstName = firstName;
      const updatedLastName = lastName;
      const updatedContactPhoneNumber = contactPhoneNumber;

      const updatedDisplayName = `${updatedFirstName} ${updatedLastName}`;

      // Update Firebase Auth profile display name
      if (user.displayName !== updatedDisplayName) {
        await user.updateProfile({ displayName: updatedDisplayName });
      }

      // Update Firestore document
      await db.collection('users').doc(user.uid).update({
        firstName: updatedFirstName,
        lastName: updatedLastName,
        contactPhoneNumber: updatedContactPhoneNumber,
        displayNotifications: displayNotifications,
        displayName: updatedDisplayName // Ensure display name is also updated in Firestore
      });

      // Send notification to admins if data changed (excluding displayNotifications)
      let changedFields = [];
      if (updatedFirstName !== oldFirstName) {
        changedFields.push(`meno z '${oldFirstName || 'nezadané'}' na '${updatedFirstName}'`);
      }
      if (updatedLastName !== oldLastName) {
        changedFields.push(`priezvisko z '${oldLastName || 'nezadané'}' na '${updatedLastName}'`);
      }
      if (!isAdmin && updatedContactPhoneNumber !== oldContactPhoneNumber) { // Only notify for phone change if not admin
        changedFields.push(`telefónne číslo z '${oldContactPhoneNumber || 'nezadané'}' na '${updatedContactPhoneNumber}'`);
      }

      if (changedFields.length > 0) {
        const notificationMessage = `Používateľ ${user.email} zmenil ${changedFields.join(' a ')} vo svojom registračnom formulári.`;
        await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('notifications').add({
          message: notificationMessage,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          userId: user.uid,
          userName: user.displayName || user.email,
          type: 'user_data_change',
          details: {
            originalFirstName: oldFirstName,
            newFirstName: updatedFirstName,
            originalLastName: oldLastName,
            newLastName: updatedLastName,
            originalPhoneNumber: oldContactPhoneNumber,
            newPhoneNumber: updatedContactPhoneNumber,
          },
          dismissedBy: [],
          seenBy: []
        });
        console.log("Admin upozornenie odoslaná pre zmenu používateľských dát.");
      }


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
      } else if (e.code === 'auth/requires-recent-login') {
        setError("Pre túto akciu sa musíte znova prihlásiť. Prosím, odhláste sa a znova prihláste.");
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

  const handleToggleDisplayNotifications = async (e) => {
    if (!db || !user) {
      setError("Nie ste prihlásený alebo Firebase nie je inicializovaný.");
      return;
    }
    setFormSubmitting(true); // Use formSubmitting for this action
    setError('');
    const newDisplayValue = e.target.checked;
    try {
      await db.collection('users').doc(user.uid).update({
        displayNotifications: newDisplayValue
      });
      setUser(prevUser => ({ ...prevUser, displayNotifications: newDisplayValue }));
      setMessage(`Zobrazovanie upozornení bolo ${newDisplayValue ? 'zapnuté' : 'vypnuté'}.`);
    } catch (e) {
      console.error("Chyba pri zmene nastavenia notifikácií:", e);
      setError(`Chyba pri zmene nastavenia notifikácií: ${e.message}`);
    } finally {
      setFormSubmitting(false);
    }
  };

  const now = new Date();
  const isEditAllowed = !userDataEditEndDate || now <= new Date(userDataEditEndDate);

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
              disabled: formSubmitting || !isEditAllowed
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
              disabled: formSubmitting || !isEditAllowed
            })
          ),
          // Conditional rendering for phone number based on isAdmin
          !isAdmin && React.createElement(
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
              disabled: formSubmitting || !isEditAllowed,
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
              onChange: handleToggleDisplayNotifications, // Use the dedicated handler
              disabled: formSubmitting
            }),
            React.createElement('label', { className: 'text-gray-700 text-sm', htmlFor: 'displayNotifications' }, 'Zobrazovať notifikácie')
          ),
          React.createElement(
            'button',
            {
              type: 'submit',
              className: `font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200 mt-4 ${
                isEditAllowed ? 'bg-blue-500 hover:bg-blue-700 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`,
              disabled: formSubmitting || !isEditAllowed
            },
            formSubmitting ? 'Ukladám...' : (isEditAllowed ? 'Uložiť zmeny profilu' : 'Úpravy sú už uzavreté')
          ),
          !isEditAllowed && React.createElement(
            'p',
            { className: 'text-red-500 text-sm mt-2 text-center' },
            `Úpravy boli uzavreté dňa: ${new Date(userDataEditEndDate).toLocaleString('sk-SK')}`
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
