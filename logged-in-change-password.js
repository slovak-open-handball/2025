// logged-in-change-password.js
// Tento súbor obsahuje React komponent pre zmenu hesla prihláseného používateľa.
// Predpokladá, že Firebase SDK je inicializovaný v <head> logged-in-change-password.html.

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

  let bgColorClass;
  if (type === 'success') {
    bgColorClass = 'bg-[#3A8D41]'; // Green
  } else if (type === 'error') {
    bgColorClass = 'bg-red-600'; // Red
  } else {
    bgColorClass = 'bg-blue-500'; // Default blue for info
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

// Komponent PasswordInput pre polia hesla s prepínaním viditeľnosti
// Akceptuje 'validationStatus' ako objekt pre detailnú vizuálnu indikáciu platnosti hesla
function PasswordInput({ id, label, value, onChange, placeholder, autoComplete, showPassword, toggleShowPassword, onCopy, onPaste, onCut, disabled, validationStatus, onFocus }) {
  // SVG ikony pre oko (zobraziť heslo) a preškrtnuté oko (skryť heslo)
  const EyeIcon = React.createElement(
    'svg',
    { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' }),
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' })
  );

  const EyeOffIcon = React.createElement(
    'svg',
    { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
    React.createElement('path', { fill: 'currentColor', stroke: 'none', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' }),
    React.createElement('path', { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' }),
    React.createElement('line', { x1: '21', y1: '3', x2: '3', y2: '21', stroke: 'currentColor', strokeWidth: '2' })
  );

  // Okraj inputu bude vždy predvolený (border-gray-300)
  const borderClass = 'border-gray-300';

  return React.createElement(
    'div',
    { className: 'mb-4' }, // Added mb-4 class for consistent spacing
    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: id }, label),
    React.createElement(
      'div',
      { className: 'relative' },
      React.createElement('input', {
        type: showPassword ? 'text' : 'password',
        id: id,
        // Using only the default border class
        className: `shadow appearance-none border ${borderClass} rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10`,
        value: value,
        onChange: onChange,
        onCopy: onCopy,
        onPaste: onPaste,
        onCut: onCut,
        required: true,
        placeholder: placeholder,
        autoComplete: autoComplete,
        disabled: disabled,
        onFocus: onFocus // Added onFocus prop
      }),
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: toggleShowPassword,
          className: 'absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 focus:outline-none',
          disabled: disabled,
        },
        showPassword ? EyeIcon : EyeOffIcon
      )
    ),
    // Change: Condition for displaying password description - only displays if validationStatus is defined
    validationStatus && React.createElement(
      'div',
      { className: `text-xs italic mt-1 text-gray-600` }, // Text "Heslo musí obsahovať" is always gray
      'Heslo musí obsahovať:',
      React.createElement(
        'ul',
        { className: 'list-none pl-4' }, // Using list-none and custom bullets for dynamism
        React.createElement(
          'li',
          { className: `flex items-center ${validationStatus.minLength ? 'text-green-600' : 'text-gray-600'}` },
          React.createElement('span', { className: 'mr-2' }, validationStatus.minLength ? '✔' : '•'),
          'aspoň 10 znakov,'
        ),
        React.createElement(
          'li',
          { className: `flex items-center ${validationStatus.hasUpperCase ? 'text-green-600' : 'text-gray-600'}` },
          React.createElement('span', { className: 'mr-2' }, validationStatus.hasUpperCase ? '✔' : '•'),
          'aspoň jedno veľké písmeno,'
        ),
        React.createElement(
          'li',
          { className: `flex items-center ${validationStatus.hasLowerCase ? 'text-green-600' : 'text-gray-600'}` },
          React.createElement('span', { className: 'mr-2' }, validationStatus.hasLowerCase ? '✔' : '•'),
          'aspoň jedno malé písmeno,'
        ),
        React.createElement(
          'li',
          { className: `flex items-center ${validationStatus.hasNumber ? 'text-green-600' : 'text-gray-600'}` },
          React.createElement('span', { className: 'mr-2' }, validationStatus.hasNumber ? '✔' : '•'),
          'aspoň jednu číslicu.'
        )
      )
    )
  );
}

// Main React component for the logged-in-change-password.html page
function ChangePasswordApp() {
  // New: Get references to Firebase services directly
  const app = firebase.app();
  const auth = firebase.auth(app);
  const db = firebase.firestore(app);

  // New: Local state for the current user and their profile data
  // These states will be updated by the local onAuthStateChanged and onSnapshot
  const [user, setUser] = React.useState(auth.currentUser); // Initialize with current user
  const [userProfileData, setUserProfileData] = React.useState(null); 
  const [loading, setLoading] = React.useState(true); // Loading for data in ChangePasswordApp
  const [error, setError] = React.useState('');
  // Retained: userNotificationMessage for local notifications
  const [userNotificationMessage, setUserNotificationMessage] = React.useState('');

  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmNewPassword, setConfirmNewPassword] = React.useState('');

  // States for password visibility
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = React.useState(false);

  // State for new password validation results (as in admin-register.js)
  const [passwordValidationStatus, setPasswordValidationStatus] = React.useState({
    minLength: false,
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
    isValid: false, // Overall password validity
  });
  const [isConfirmPasswordMatching, setIsConfirmPasswordMatching] = React.useState(false);
  // New: State to track if the "Confirm new password" input has been touched
  const [confirmPasswordTouched, setConfirmPasswordTouched] = React.useState(false);

  // New: Local Auth Listener for ChangePasswordApp
  // This listener ensures that ChangePasswordApp reacts to authentication changes,
  // but primary logout/redirection is handled by GlobalNotificationHandler.
  React.useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(currentUser => {
      console.log("ChangePasswordApp: Local onAuthStateChanged - User:", currentUser ? currentUser.uid : "null");
      setUser(currentUser);
      // If user is not logged in, redirect (even if GNH should handle it)
      if (!currentUser) {
        console.log("ChangePasswordApp: User is not logged in, redirecting to login.html.");
        window.location.href = 'login.html';
      }
    });
    return () => unsubscribeAuth();
  }, [auth]); // Depends on auth instance

  // New: Local Effect for loading user data from Firestore
  // This effect will run when the user is logged in and db is available.
  // It assumes that passwordLastChanged and approved status are already verified in header.js.
  React.useEffect(() => {
    let unsubscribeUserDoc;

    if (user && db) { // Only runs if user is logged in and db is available
      console.log(`ChangePasswordApp: Attempting to load user document for UID: ${user.uid}`);
      setLoading(true); // Set loading to true while profile data is being loaded

      try {
        const userDocRef = db.collection('users').doc(user.uid);
        unsubscribeUserDoc = userDocRef.onSnapshot(docSnapshot => {
          console.log("ChangePasswordApp: onSnapshot for user document triggered.");
          if (docSnapshot.exists) {
            const userData = docSnapshot.data();
            console.log("ChangePasswordApp: User document exists, data:", userData);

            // --- IMMEDIATE LOGOUT IF passwordLastChanged IS NOT A VALID TIMESTAMP ---
            // This is added logic that runs immediately after data is loaded.
            // If passwordLastChanged is invalid or missing, log out.
            if (!userData.passwordLastChanged || typeof userData.passwordLastChanged.toDate !== 'function') {
                console.error("ChangePasswordApp: passwordLastChanged IS NOT a valid Timestamp object! Type:", typeof userData.passwordLastChanged, "Value:", userData.passwordLastChanged);
                console.log("ChangePasswordApp: Immediately logging out user due to invalid password change timestamp.");
                auth.signOut(); // Use auth from React state
                window.location.href = 'login.html';
                localStorage.removeItem(`passwordLastChanged_${user.uid}`); // Clear localStorage
                setUser(null); // Explicitly set user to null
                setUserProfileData(null); // Explicitly set userProfileData to null
                return; // Stop further processing
            }

            // Normal processing if passwordLastChanged is valid
            const firestorePasswordChangedTime = userData.passwordLastChanged.toDate().getTime();
            const localStorageKey = `passwordLastChanged_${user.uid}`;
            let storedPasswordChangedTime = parseInt(localStorage.getItem(localStorageKey) || '0', 10);

            console.log(`ChangePasswordApp: Firestore passwordLastChanged (converted): ${firestorePasswordChangedTime}, Stored: ${storedPasswordChangedTime}`);

            if (storedPasswordChangedTime === 0 && firestorePasswordChangedTime !== 0) {
                // First load for this user/browser, initialize localStorage and DO NOT LOG OUT
                localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
                console.log("ChangePasswordApp: Initializing passwordLastChanged in localStorage (first load).");
                // Do not continue here, continue with normal data processing for first load
            } else if (firestorePasswordChangedTime > storedPasswordChangedTime) {
                // Password was changed on another device/session
                console.log("ChangePasswordApp: Password change detected on another device/session. Logging out user.");
                auth.signOut(); // Use auth from React state
                window.location.href = 'login.html';
                localStorage.removeItem(localStorageKey); // Clear localStorage after logout
                setUser(null); // Explicitly set user to null
                setUserProfileData(null); // Explicitly set userProfileData to null
                return;
            } else if (firestorePasswordChangedTime < storedPasswordChangedTime) {
                // This ideally should not happen if Firestore is the source of truth
                console.warn("ChangePasswordApp: Detected older timestamp from Firestore than stored. Logging out user (potential mismatch).");
                auth.signOut(); // Use auth from React state
                window.location.href = 'login.html';
                localStorage.removeItem(localStorageKey);
                setUser(null); // Explicitly set user to null
                setUserProfileData(null); // Explicitly set userProfileData to null
                return;
            } else {
                // Times are the same, ensure localStorage is up-to-date
                localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
                console.log("ChangePasswordApp: Timestamps are the same, updating localStorage.");
            }

            // NEW LOGIC: Logout if user is admin and not approved
            if (userData.role === 'admin' && userData.approved === false) {
                console.log("ChangePasswordApp: User is admin and not approved. Logging out.");
                auth.signOut();
                window.location.href = 'login.html';
                setUser(null); // Explicitly set user to null
                setUserProfileData(null); // Explicitly set userProfileData to null
                return; // Stop further processing
            }

            setUserProfileData(userData); // Update userProfileData state
            
            setLoading(false); // Stop loading after user data is loaded
            setError(''); // Clear errors after successful load

            // Update menu visibility after role is loaded (call global function from left-menu.js)
            if (typeof window.updateMenuItemsVisibility === 'function') {
                window.updateMenuItemsVisibility(userData.role);
            } else {
                console.warn("ChangePasswordApp: Function updateMenuItemsVisibility is not defined.");
            }

            console.log("ChangePasswordApp: User data loading complete, loading: false");
          } else {
            console.warn("ChangePasswordApp: User document not found for UID:", user.uid);
            setError("Error: User profile not found or you do not have sufficient permissions. Please try logging in again.");
            setLoading(false); // Stop loading so error can be displayed
            setUser(null); // Explicitly set user to null
            setUserProfileData(null); // Explicitly set userProfileData to null
          }
        }, error => {
          console.error("ChangePasswordApp: Error loading user data from Firestore (onSnapshot error):", error);
          if (error.code === 'permission-denied') {
              setError(`Permission error: You do not have access to your profile. Please try logging in again or contact support.`);
          } else if (error.code === 'unavailable') {
              setError(`Connection error: Firestore service is unavailable. Please try again later.`);
          } else if (error.code === 'unauthenticated') {
               setError(`Authentication error: You are not logged in. Please try logging in again.`);
               if (auth) {
                  auth.signOut();
                  window.location.href = 'login.html';
                  setUser(null); // Explicitly set user to null
                  setUserProfileData(null); // Explicitly set userProfileData to null
               }
          } else {
              setError(`Error loading user data: ${error.message}`);
          }
          setLoading(false); // Stop loading even on error
          console.log("ChangePasswordApp: User data loading failed, loading: false");
          setUser(null); // Explicitly set user to null
          setUserProfileData(null); // Explicitly set userProfileData to null
        });
      } catch (e) {
        console.error("ChangePasswordApp: Error setting up onSnapshot for user data (try-catch):", e);
        setError(`Error setting up listener for user data: ${e.message}`);
        setLoading(false);
        setUser(null); // Explicitly set user to null
        setUserProfileData(null); // Explicitly set userProfileData to null
      }
    } else if (user === null) {
        // If user is null (and not undefined), it means they have been logged out.
        // Redirection should already be handled by GlobalNotificationHandler.
        // Here, we just ensure loading is false and data is cleared.
        setLoading(false);
        setUserProfileData(null);
    }

    return () => {
      if (unsubscribeUserDoc) {
        console.log("ChangePasswordApp: Unsubscribing onSnapshot for user document.");
        unsubscribeUserDoc();
      }
    };
  }, [user, db, auth]); // Depends on user and db (and auth for signOut)

  // Function for password validation (now exactly matching admin-register.js)
  const validatePassword = (pwd) => {
    const status = {
      minLength: pwd.length >= 10,
      hasUpperCase: /[A-Z]/.test(pwd),
      hasLowerCase: /[a-z]/.test(pwd),
      hasNumber: /[0-9]/.test(pwd),
    };
    // Overall password validity
    status.isValid = status.minLength && status.hasUpperCase && status.hasLowerCase && status.hasNumber;
    return status;
  };

  // Effect for password validation when 'newPassword' or 'confirmNewPassword' changes
  React.useEffect(() => {
    const pwdStatus = validatePassword(newPassword);
    setPasswordValidationStatus(pwdStatus);

    // isConfirmPasswordMatching depends on the overall validity of the new password as well
    setIsConfirmPasswordMatching(newPassword === confirmNewPassword && newPassword.length > 0 && pwdStatus.isValid);
  }, [newPassword, confirmNewPassword]);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!auth || !user || !db) { // Added check for db
      setError("Authentication, user or database is not available. Please try logging in again.");
      return;
    }
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setError("Please fill in all fields.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("New passwords do not match. Please check them.");
      return;
    }

    // Use the overall validity status from passwordValidationStatus
    if (!passwordValidationStatus.isValid) {
      setError("The new password does not meet all requirements. Please check the list below the password field.");
      return;
    }

    setLoading(true);
    setError('');
    setUserNotificationMessage('');

    try {
      // Re-authenticate user before changing password for security reasons
      const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
      await user.reauthenticateWithCredential(credential);
      console.log("ChangePasswordApp: User successfully re-authenticated.");

      // Update password
      await user.updatePassword(newPassword);
      console.log("ChangePasswordApp: Password successfully changed.");

      // IMPORTANT: Update timestamp in Firestore
      const userDocRef = db.collection('users').doc(user.uid);
      await userDocRef.update({
        passwordLastChanged: firebase.firestore.FieldValue.serverTimestamp()
      });
      console.log("ChangePasswordApp: Password change timestamp updated in Firestore.");

      // Update localStorage as well, so the current session logs out immediately
      // (even if the Firestore listener in header.js should catch it)
      localStorage.setItem(`passwordLastChanged_${user.uid}`, new Date().getTime().toString());

      setUserNotificationMessage("Password successfully changed. For your security, you are being logged out. Please log in with your new password.");
      
      // Clear password fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');

      // Log out user after password change for security reasons
      await auth.signOut();
      console.log("ChangePasswordApp: User logged out after password change.");
      
      setTimeout(() => {
        window.location.href = 'login.html'; // Redirect after logout
      }, 3000);

    } catch (e) {
      console.error("ChangePasswordApp: Error changing password:", e);
      if (e.code === 'auth/wrong-password') {
        setError("The current password entered is incorrect.");
      } else if (e.code === 'auth/weak-password') {
        // Use validatePassword for a more detailed weak password message
        const validationResults = validatePassword(newPassword);
        const errors = [];
        if (!validationResults.minLength) errors.push("at least 10 characters");
        if (!validationResults.hasLowerCase) errors.push("at least one lowercase letter");
        if (!validationResults.hasUpperCase) errors.push("at least one uppercase letter");
        if (!validationResults.hasNumber) errors.push("at least one digit");
        
        setError("The new password is too weak. The password must contain:\n• " + errors.join("\n• ") + ".");
      } else if (e.code === 'auth/requires-recent-login') {
        setError("This action requires a recent login. Please log out and log in again and try again.");
      } else {
        setError(`Error changing password: ${e.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Display loading state
  if (!user || (user && !userProfileData) || loading) {
    if (user === null) {
        console.log("ChangePasswordApp: User is null, redirecting to login.html");
        window.location.href = 'login.html';
        return null;
    }
    let loadingMessage = 'Loading...';
    if (user && !userProfileData) {
        loadingMessage = 'Loading...';
    } else if (loading) {
        loadingMessage = 'Loading...';
    }

    return React.createElement(
      'div',
      { className: 'flex items-center justify-center min-h-screen bg-gray-100' },
      React.createElement('div', { className: 'text-xl font-semibold text-gray-700' }, loadingMessage)
    );
  }

  // Redirect if user is not 'user' role
  if (userProfileData && userProfileData.role !== 'user') {
      console.log("ChangePasswordApp: User does not have 'user' role. Redirecting to logged-in-my-data.html.");
      window.location.href = 'logged-in-my-data.html';
      return null;
  }

  // Dynamic classes for the button based on disabled state
  const buttonClasses = `
    font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200
    ${loading || currentPassword.length === 0 || !passwordValidationStatus.isValid || !isConfirmPasswordMatching
      ? 'bg-white text-blue-500 border border-blue-500 cursor-not-allowed' // Disabled state
      : 'bg-blue-500 hover:bg-blue-700 text-white' // Active state
    }
  `;

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
            onChange: (e) => {
                const value = e.target.value;
                setNewPassword(value);
                // Immediate validation update
                setPasswordValidationStatus(validatePassword(value)); 
            },
            onCopy: (e) => e.preventDefault(),
            onPaste: (e) => e.preventDefault(),
            onCut: (e) => e.preventDefault(),
            placeholder: "Zadajte nové heslo (min. 10 znakov)",
            autoComplete: "new-password",
            showPassword: showNewPassword,
            toggleShowPassword: () => setShowNewPassword(!showNewPassword),
            disabled: loading,
            validationStatus: passwordValidationStatus // Pass detailed password validation status
          }),
          React.createElement(PasswordInput, {
            id: 'confirm-new-password',
            label: 'Potvrďte nové heslo',
            value: confirmNewPassword,
            onChange: (e) => {
                setConfirmNewPassword(e.target.value);
                setConfirmPasswordTouched(true); // Set touched state
            },
            onFocus: () => setConfirmPasswordTouched(true), // Set touched state on focus
            onCopy: (e) => e.preventDefault(),
            onPaste: (e) => e.preventDefault(),
            onCut: (e) => e.preventDefault(),
            placeholder: "Potvrďte nové heslo",
            autoComplete: "new-password",
            showPassword: showConfirmNewPassword,
            toggleShowPassword: () => setShowConfirmNewPassword(!showConfirmNewPassword),
            disabled: loading,
          }),
          // New: Display "Passwords do not match" message
          !isConfirmPasswordMatching && confirmNewPassword.length > 0 && confirmPasswordTouched &&
          React.createElement(
            'p',
            { className: 'text-red-500 text-xs italic mt-1' },
            'Heslá sa nezhodujú'
          ),
          React.createElement(
            'button',
            {
              type: 'submit',
              className: buttonClasses, // Use dynamic classes
              disabled: loading || currentPassword.length === 0 || !passwordValidationStatus.isValid || !isConfirmPasswordMatching,
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

// Explicitly expose the component globally
window.ChangePasswordApp = ChangePasswordApp;
