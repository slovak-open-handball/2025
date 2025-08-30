// admin-register.js (now uses global Firebase instances from authentication.js)
// Explicitly import functions for Firebase Auth and Firestore for modular access (SDK v11)
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, doc, setDoc, addDoc, serverTimestamp, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"; // Pridaný onSnapshot pre sledovanie zmien
import { updateDoc, increment } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"; // NEW: Pridané updateDoc a increment

// const RECAPTCHA_SITE_KEY = "6Lc_H4QrAAAAANF7p_2Kz8Rj-JtDqjGg3X2K4i3R";
// const RECAPTCHA_SITE_KEY = "6LekXLgrAAAAAB6HYeGZG-tu_N42DER2fh1aVBjF";
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec";

// PasswordInput Component for password fields with visibility toggle (converted to React.createElement)
// Added 'validationStatus' prop for detailed visual indication of password validity
function PasswordInput({ id, label, value, onChange, placeholder, autoComplete, showPassword, toggleShowPassword, onCopy, onPaste, onCut, disabled, validationStatus, onFocus }) { // Added onFocus prop
  // Corrected SVG icons for eye (show password) and crossed-out eye (hide password)
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

  // Input border will always be default (border-gray-300)
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
        onCopy: (e) => e.preventDefault(), // Prevent copying
        onPaste: (e) => e.preventDefault(), // Prevent pasting
        onCut: (e) => e.preventDefault(),   // Prevent cutting
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
    // CHANGE: Condition for displaying password description - only shown if validationStatus is defined
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

// NotificationModal Component for displaying temporary messages (converted to React.createElement)
function NotificationModal({ message, onClose, type = 'info' }) { // Added 'type' prop
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

  // Dynamic classes for background color based on message type
  let bgColorClass;
  if (type === 'success') {
    bgColorClass = 'bg-green-500';
  } else if (type === 'error') {
    bgColorClass = 'bg-red-600'; // Setting red for errors
  } else {
    bgColorClass = 'bg-blue-500'; // Default blue for info
  }

  return React.createElement(
    'div',
    {
      className: `fixed bottom-4 right-4 ${bgColorClass} text-white p-4 rounded-lg shadow-lg transition-transform transform ${show ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`,
      style: { zIndex: 1000 }
    },
    React.createElement('p', { className: 'font-semibold' }, message)
  );
}

// Main React component for the admin registration page
function App() {
  // Get references to Firebase services and global data from authentication.js
  const auth = window.auth;
  const db = window.db;
  const user = window.globalUserProfileData; // Use global user profile
  const isAuthReady = window.isGlobalAuthReady; // Use global authentication ready state

  const [pageLoading, setPageLoading] = React.useState(true); // New state for initial page loading
  const [formSubmitting, setFormSubmitting] = React.useState(false); // New state for form submission

  // CHANGE: Using 'errorMessage' for errors and 'successMessage' for the success page message
  const [errorMessage, setErrorMessage] = React.useState(''); // For errors (red box and modal)
  const [successMessage, setSuccessMessage] = React.useState(''); // For the green success page
  
  // NEW: State for storing admin count from Firestore
  const [adminCount, setAdminCount] = React.useState(0);

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');

  const [showPasswordReg, setShowPasswordReg] = React.useState(false);
  const [showConfirmPasswordReg, setShowConfirmPasswordReg] = React.useState(false);

  // New states for password validation
  const [passwordValidationStatus, setPasswordValidationStatus] = React.useState({
    minLength: false,
    maxLength: false, // maxLength is still checked, but not displayed in the list
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
    isValid: false, // Overall password validity
  });
  const [isConfirmPasswordMatching, setIsConfirmPasswordMatching] = React.useState(false);
  // NEW: State for tracking whether the "Confirm password" input has been touched
  const [confirmPasswordTouched, setConfirmPasswordTouched] = React.useState(false);
  // NEW: State for tracking whether the "Email" input has been touched
  const [emailTouched, setEmailTouched] = React.useState(false);


  // Effect for Firebase initialization and Auth Listener setup (runs only once)
  React.useEffect(() => {
    // Wait until auth and db instances are available from authentication.js
    if (auth && db && isAuthReady) { // Also wait for isAuthReady
      setPageLoading(false); // Page je teraz plne načítaná (auth a db sú pripravené)

      // Pridanie sledovania hodnoty adminCount z Firestore, aby sa načítala hneď a potom pri každej zmene
      const settingsDocRef = doc(db, 'settings', 'adminCount');
      const unsubscribe = onSnapshot(settingsDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const count = docSnap.data().count;
          setAdminCount(count); // NEW: Update the adminCount state
//          console.log(`Hodnota adminCount: ${count}`); // Vypíše sa aj pri prvom načítaní aj pri zmene
        } else {
          setAdminCount(0); // NEW: Set to 0 if the document doesn't exist
          console.log("Dokument 'settings/adminCount' neexistuje.");
        }
      });

      // Vráťte funkciu na odhlásenie odberu, aby sa predišlo úniku pamäte
      return () => unsubscribe();

    } else {
        console.log("AdminRegisterApp: Čakám na inicializáciu Auth a DB v authentication.js.");
    }
  }, [auth, db, isAuthReady]); // Závisí od auth, db a isAuthReady (globálne inštancie)


  const getRecaptchaToken = async (action) => {
    if (typeof grecaptcha === 'undefined' || !grecaptcha.execute) {
      setErrorMessage("reCAPTCHA API nie je načítané alebo pripravené.");
      return null;
    }
    try {
      const token = await grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: action });
      return token;
    } catch (e) {
      console.error("Chyba pri získavaní reCAPTCHA tokenu:", e);
      setErrorMessage(`reCAPTCHA Chyba: ${e.message}`);
      return null;
    }
  };

  // CHANGE: validatePassword now returns an object with individual requirement statuses
  const validatePassword = (pwd) => {
    const status = {
      minLength: pwd.length >= 10,
      maxLength: pwd.length <= 4096, // maxLength is still checked, but not displayed in the list
      hasUpperCase: /[A-Z]/.test(pwd),
      hasLowerCase: /[a-z]/.test(pwd),
      hasNumber: /[0-9]/.test(pwd),
    };
    // Overall validity depends on all conditions including maxLength
    status.isValid = status.minLength && status.maxLength && status.hasUpperCase && status.hasLowerCase && status.hasNumber;
    return status;
  };

  // NEW: Function to validate email
  const validateEmail = (email) => {
    // Check for '@'
    const atIndex = email.indexOf('@');
    if (atIndex === -1) return false;

    // Check for '.' after '@'
    const domainPart = email.substring(atIndex + 1);
    const dotIndexInDomain = domainPart.indexOf('.');
    if (dotIndexInDomain === -1) return false;

    // Check for at least two characters after the last dot in the domain
    const lastDotIndex = email.lastIndexOf('.');
    if (lastDotIndex === -1 || lastDotIndex < atIndex) return false;
    
    const charsAfterLastDot = email.substring(lastDotIndex + 1);
    return charsAfterLastDot.length >= 2;
  };

  // Effect for password validation on 'password' or 'confirmPassword' change
  React.useEffect(() => {
    const pwdStatus = validatePassword(password);
    setPasswordValidationStatus(pwdStatus);

    setIsConfirmPasswordMatching(password === confirmPassword && password.length > 0 && pwdStatus.isValid);
  }, [password, confirmPassword]);


  const handleRegisterAdmin = async (e) => {
    e.preventDefault();
    if (!auth || !db) {
      setErrorMessage("Firebase Auth alebo Firestore nie je inicializovaný.");
      return;
    }
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password || !confirmPassword) {
      setErrorMessage("Vyplňte prosím všetky povinné polia.");
      return;
    }
    if (!validateEmail(email)) {
      setErrorMessage("Zadajte platnú e-mailovú adresu.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Heslá sa nezhodujú. Skontrolujte ich prosím.");
      return;
    }

    // CHANGE: Using overall validity status from passwordValidationStatus
    if (!passwordValidationStatus.isValid) {
      setErrorMessage("Heslo nespĺňa všetky požiadavky. Skontrolujte prosím zoznam pod heslom.");
      return;
    }

    const recaptchaToken = await getRecaptchaToken('admin_register');
    if (!recaptchaToken) {
      setErrorMessage("Overenie reCAPTCHA zlyhalo. Skúste to prosím znova.");
      return; // Return here as there's an error
    }
    console.log("reCAPTCHA Token pre registráciu admina:", recaptchaToken);

    setFormSubmitting(true); // Show loading indicator for form submission
    setErrorMessage(''); // Clear previous errors
    setSuccessMessage(''); // Clear any previous success message

    // NEW: Set global flag that admin registration is in progress
    window.isRegisteringAdmin = true;

    try {
      // --- ZMENA: Upravená podmienka. Ak je počet adminov menší ako 2, nastav schválenie na true. Inak na false. ---
      const approvedStatus = adminCount < 2; // CHANGE: Changed condition to < 2
      console.log(`Počet adminov je ${adminCount}, preto bude status schválenia: ${approvedStatus}`);
      // --------------------------------------------------------------------------

      // Corrected: Use createUserWithEmailAndPassword as a top-level function with 'auth' instance
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      // CHANGE: Set role to 'admin' and approved to 'true' directly on first write
      const userDataToSave = {
        email: email,
        firstName: firstName,
        lastName: lastName,
        displayName: `${firstName} ${lastName}`, // Added displayName
        role: 'admin', // Directly set as admin
        approved: approvedStatus, // NEW: Use the dynamically determined status
        registrationDate: serverTimestamp(), // Corrected: Use serverTimestamp() from modular import
        displayNotifications: true,
        passwordLastChanged: serverTimestamp() // Corrected: Use serverTimestamp() from modular import
      };

      console.log("Attempting to save user to Firestore with initial data:", userDataToSave);

      try {
        // Corrected: Use doc and setDoc functions
        const userDocRef = doc(db, 'users', userCredential.user.uid);
        await setDoc(userDocRef, userDataToSave);
        console.log(`Firestore: Používateľ ${email} s rolou 'admin' a schválením '${approvedStatus}' bol uložený.`);

        // NEW: Zväčšenie hodnoty adminCount o 1 po uložení používateľa
        // Ak je schválený, zvýšime počet. Inak nie.
        if (approvedStatus) {
          const settingsDocRef = doc(db, 'settings', 'adminCount');
          await updateDoc(settingsDocRef, {
            count: increment(1)
          });
          console.log('Hodnota adminCount bola úspešne zvýšená o 1 v Firestore.');
        } else {
          console.log('Používateľ nebol schválený, hodnota adminCount nebola zvýšená.');
        }

        // --------------------------------------------------------------------------

        // Attempt to send email via Apps Script immediately after saving initial data
        try {
          const payload = {
            action: 'sendRegistrationEmail',
            email: email,
            isAdmin: true,
            firstName: firstName,
            lastName: lastName,
          };
          console.log("Odosielam údaje do Apps Script (e-mail o registrácii admina):", payload);
          
          // CHANGE: Add mode: 'no-cors'
          const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            mode: 'no-cors', // Important for Apps Script to prevent CORS errors
            body: JSON.stringify(payload)
          });

          // With mode: 'no-cors', response.ok will always be false and response.status will be 0.
          // Therefore, we must assume success if there is no network error.
          // If you need success verification, it is better to use CORS and configure Apps Script correctly.
          console.log("Odpoveď z Apps Script (e-mail o registrácii admina) s no-cors:", response);

        } catch (emailError) {
          console.error("Chyba pri odosielaní e-mailu o registrácii admina cez Apps Script (fetch error):", emailError);
          // CHANGE: Set errorMessage for this secondary error
          setErrorMessage(`Registrácia prebehla úspešne, ale nepodarilo sa odoslať potvrdzovací e-mail: ${emailError.message}. Skontrolujte pripojenie a Apps Script.`);
        }

        // --- Logic for saving notification for administrators ---
        try {
            // const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'; // This is no longer needed for the 'notifications' collection
            const notificationMessage = approvedStatus
              ? `Nový administrátor ${email} sa zaregistroval a bol automaticky schválený.`
              : `Nový používateľ ${email} sa zaregistroval ako administrátor.`;
            const notificationRecipientId = 'all_admins'; 

            // ZMENA: Ukladanie do kolekcie /notifications/ s náhodným ID
            const notificationsCollectionRef = collection(db, 'notifications');
            await addDoc(notificationsCollectionRef, {
                message: notificationMessage,
                timestamp: serverTimestamp(), // Corrected: Use serverTimestamp() from modular import
                recipientId: notificationRecipientId,
                read: false
            });
            console.log("Oznámenie o novej registrácii administrátora bolo úspešne uložené do Firestore do kolekcie /notifications/.");
        } catch (e) {
            console.error("App: Chyba pri ukladaní oznámenia o registrácii administrátora do /notifications/:", e);
        }
        // --- End logic for saving notification ---

      } catch (firestoreError) {
        console.error("Chyba pri ukladaní/aktualizácii Firestore:", firestoreError);
        setErrorMessage(`Chyba pri ukladaní/aktualizácii používateľa do databázy: ${firestoreError.message}. Skontrolujte bezpečnostné pravidlá Firebase.`);
        setFormSubmitting(false); // Reset formSubmitting on error
        window.isRegisteringAdmin = false; // Reset global flag on error
        return;
      }

      // CHANGE: Set successMessage only after all successful steps
      const successMessageText = approvedStatus
        ? `Administrátorský účet pre ${email} bol vytvorený a automaticky schválený.`
        : `Administrátorský účet pre ${email} bol vytvorený. Čaká sa na schválenie iným administrátorom.`;
      setSuccessMessage(successMessageText);
      setFormSubmitting(false); // Stop loading so the message is visible on the form

      // user will be null after signOut, no need to set explicitly

      // NEW: Redirect after 20 seconds, same as register.js
      setTimeout(async () => {
        console.log("Presmerovanie. Odhlasujem používateľa (oneskorené o 20s).");
        if (auth && auth.currentUser) {
            await auth.signOut();
        }
        window.isRegisteringAdmin = false; // Reset global flag after redirect
        window.location.href = 'login.html';
      }, 20000); // 20-sekundové oneskorenie

    } catch (e) {
      console.error("Chyba počas registrácie (Auth alebo iné):", e);
      if (e.code === 'auth/email-already-in-use') {
        setErrorMessage("E-mailová adresa už existuje. Vyberte prosím inú.");
      } else if (e.code === 'auth/weak-password') {
        setErrorMessage("Heslo je príliš slabé. " + e.message); // Use message from Firebase Auth
      } else if (e.code === 'auth/invalid-email') {
        setErrorMessage("Neplatný formát e-mailovej adresy.");
      } else {
        setErrorMessage(`Chyba pri registrácii: ${e.message}`);
      }
      setFormSubmitting(false); // Reset formSubmitting on error
      window.isRegisteringAdmin = false; // Reset global flag on error
    }
  };

  // NEW: Check overall form validity
  const isFormValid = firstName.trim() !== '' &&
                      lastName.trim() !== '' &&
                      email.trim() !== '' &&
                      validateEmail(email) && // Email format check
                      passwordValidationStatus.isValid &&
                      isConfirmPasswordMatching;

  // Display initial page loading state
  if (pageLoading) {
    return React.createElement(
      'div',
      { className: 'flex items-center justify-center min-h-screen bg-gray-100' },
      React.createElement('div', { className: 'text-xl font-semibold text-gray-700' }, 'Načítavam...')
    );
  }

  // Priority display of successful registration message (green page)
  // CHANGE: Check 'successMessage' instead of 'message' and 'notificationType'
  if (successMessage) { 
    return React.createElement(
      'div',
      { className: 'min-h-screen bg-gray-100 flex flex-col items-center justify-center font-inter overflow-y-auto' },
      React.createElement(
        'div',
        { className: 'w-full max-w-md mt-20 mb-10 p-4' },
        React.createElement(
          'div',
          { className: 'bg-green-700 text-white p-8 rounded-lg shadow-xl w-full text-center' }, // Changed background to darker green (green-700)
          React.createElement('h1', { className: 'text-3xl font-bold text-center text-gray-800 mb-6' }, 'Registrácia úspešná!'), // Changed heading text color to black
          React.createElement(
            'p',
            { className: 'text-white' }, // Text remains white for contrast
            successMessage
          ),
          React.createElement('p', { className: 'text-gray-200 text-sm mt-4' }, 'Presmerovanie na prihlasovaciu stránku (20s)...')
        )
      )
    );
  }

  // Dynamic classes for button based on disabled state
  const buttonClasses = `
    font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200
    ${formSubmitting || successMessage || !isFormValid // CHANGE: Use isFormValid
      ? 'bg-white text-green-500 border border-green-500 cursor-not-allowed' // Disabled state
      : 'bg-green-500 hover:bg-green-700 text-white' // Active state
    }
  `;

  // Display registration form
  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
    // Notification window will be displayed ONLY for errors (errorMessage)
    errorMessage && React.createElement(NotificationModal, {
        message: errorMessage, // Use errorMessage for modal window
        onClose: () => setErrorMessage(''), // Clear errorMessage on modal close
        type: 'error' // Type is always 'error' for this notification
    }),
    React.createElement(
      'div',
      { className: 'w-full max-w-md mt-20 mb-10 p-4' },
      React.createElement(
        'div',
        { className: 'bg-white p-8 rounded-lg shadow-xl w-full' },
        // Red alert box for errors (above the form)
        errorMessage && React.createElement(
          'div',
          { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap', role: 'alert' },
          errorMessage
        ),
        React.createElement('h1', { className: 'text-3xl font-bold text-center text-gray-800 mb-6' }, 'Registrácia administrátora'),
        React.createElement(
          'form',
          { onSubmit: handleRegisterAdmin, className: 'space-y-4' },
          React.createElement(
            'div',
            null,
            React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'reg-first-name' }, 'Meno'),
            React.createElement('input', {
              type: 'text',
              id: 'reg-first-name',
              className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
              value: firstName,
              onChange: (e) => setFirstName(e.target.value),
              required: true,
              placeholder: 'Zadajte svoje meno',
              autoComplete: 'given-name',
              disabled: formSubmitting || successMessage, // Disable if form is submitting or success message is displayed
            })
          ),
          React.createElement(
            'div',
            null,
            React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'reg-last-name' }, 'Priezvisko'),
            React.createElement('input', {
              type: 'text',
              id: 'reg-last-name',
              className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
              value: lastName,
              onChange: (e) => setLastName(e.target.value),
              required: true,
              placeholder: 'Zadajte svoje priezvisko',
              autoComplete: 'family-name',
              disabled: formSubmitting || successMessage, // Disable if form is submitting or success message is displayed
            })
          ),
          React.createElement(
            'div',
            null,
            React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'reg-email' }, 'E-mailová adresa'),
            React.createElement('input', {
              type: 'email',
              id: 'reg-email',
              className: `shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 ${emailTouched && email.trim() !== '' && !validateEmail(email) ? 'border-red-500' : ''}`, // CHANGE: red border for invalid email
              value: email,
              onChange: (e) => setEmail(e.target.value),
              onFocus: () => setEmailTouched(true), // NEW: Sets touched state
              required: true,
              placeholder: 'Zadajte svoju e-mailovú adresu',
              autoComplete: 'email',
              disabled: formSubmitting || successMessage, // Disable if form is submitting or success message is displayed
            }),
            // NEW: Display message for invalid email
            emailTouched && email.trim() !== '' && !validateEmail(email) &&
            React.createElement(
              'p',
              { className: 'text-red-500 text-xs italic mt-1' },
              'Zadajte platnú e-mailovú adresu.'
            )
          ),
          React.createElement(PasswordInput, {
            id: 'reg-password',
            label: 'Heslo',
            value: password,
            onChange: (e) => setPassword(e.target.value),
            onCopy: (e) => e.preventDefault(),
            onPaste: (e) => e.preventDefault(),
            onCut: (e) => e.preventDefault(),
            placeholder: 'Zvoľte si heslo',
            autoComplete: 'new-password',
            showPassword: showPasswordReg,
            toggleShowPassword: () => setShowPasswordReg(!showPasswordReg),
            disabled: formSubmitting || successMessage, // Disable if form is submitting or success message is displayed
            validationStatus: passwordValidationStatus // Pass detailed password validation status
          }),
          React.createElement(PasswordInput, {
            id: 'reg-confirm-password',
            label: 'Potvrdiť heslo',
            value: confirmPassword,
            onChange: (e) => {
                setConfirmPassword(e.target.value);
                setConfirmPasswordTouched(true); // Set touched state
            },
            onFocus: () => setConfirmPasswordTouched(true), // Set touched state on focus
            onCopy: (e) => e.preventDefault(),
            onPaste: (e) => e.preventDefault(),
            onCut: (e) => e.preventDefault(),
            placeholder: 'Potvrďte heslo',
            autoComplete: 'new-password',
            showPassword: showConfirmPasswordReg,
            toggleShowPassword: () => setShowConfirmPasswordReg(!showConfirmPasswordReg),
            disabled: formSubmitting || successMessage, // Disable if form is submitting or success message is displayed
          }),
          // NEW: Display "Passwords do not match" message
          !isConfirmPasswordMatching && confirmPassword.length > 0 && confirmPasswordTouched &&
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
              disabled: formSubmitting || successMessage || !isFormValid, // CHANGE: Use isFormValid
            },
            formSubmitting ? ( // Use formSubmitting
              React.createElement(
                'div',
                { className: 'flex items-center justify-center' },
                React.createElement('svg', { className: 'animate-spin -ml-1 mr-3 h-5 w-5 text-green-500', xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24' }, // Spinner color changed to green
                  React.createElement('circle', { className: 'opacity-25', cx: '12', cy: '12', r: '10', stroke: 'currentColor', strokeWidth: '4' }),
                  React.createElement('path', { className: 'opacity-75', fill: 'currentColor', d: 'M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z' })
                ),
                'Registrujem...'
              )
            ) : 'Registrovať'
          )
        )
      )
    )
  );
}

// Export the component globally to be rendered by admin-register.html
window.App = App;
