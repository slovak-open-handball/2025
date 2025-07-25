// Global application ID and Firebase configuration (should be consistent across all React apps)
// Tieto konštanty sú teraz definované v <head> register.html a sú prístupné globálne.
// Odstránené opakované deklarácie.

const RECAPTCHA_SITE_KEY = "6LdJbn8rAAAAAO4C50qXTWva6ePzDlOfYwBDEDwa"; // Opravený preklep: RECAPTcha_SITE_KEY na RECAPTCHA_SITE_KEY
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
      }
    };
  }, [message, onClose]);

  if (!show && !message) return null;

  return React.createElement(
    'div',
    {
      className: `modal ${show ? 'block' : 'hidden'}`,
      style: { display: show ? 'flex' : 'none' } // Explicitné zobrazenie/skrytie
    },
    React.createElement(
      'div',
      {
        className: `modal-content transition-all duration-300 ${show ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full'}`
      },
      React.createElement(
        'p',
        { className: 'text-lg text-center' },
        message
      ),
      React.createElement(
        'button',
        {
          className: 'mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full',
          onClick: () => {
            setShow(false);
            setTimeout(onClose, 300); // Dajte čas na animáciu pred zatvorením
          }
        },
        'Zavrieť'
      )
    )
  );
}

// PasswordInput Component for password fields with visibility toggle (converted to React.createElement)
function PasswordInput({ id, label, value, onChange, placeholder, autoComplete, showPassword, toggleShowPassword, onCopy, onPaste, onCut, disabled, description, tabIndex }) {
  const EyeIcon = React.createElement(
    'svg',
    { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' }),
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' })
  );

  const EyeOffIcon = React.createElement(
    'svg',
    { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22' })
  );

  return React.createElement(
    'div',
    { className: 'mb-4' },
    React.createElement(
      'label',
      { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: id },
      label
    ),
    React.createElement(
      'div',
      { className: 'relative' },
      React.createElement('input', {
        type: showPassword ? 'text' : 'password',
        id: id,
        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10',
        value: value,
        onChange: onChange,
        onCopy: onCopy,
        onPaste: onPaste,
        onCut: onCut,
        required: true,
        placeholder: placeholder,
        autoComplete: autoComplete,
        disabled: disabled,
        tabIndex: tabIndex
      }),
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: toggleShowPassword,
          className: 'absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5',
          tabIndex: -1
        },
        showPassword ? EyeIcon : EyeOffIcon
      )
    ),
    description && React.createElement(
      'p',
      { className: 'text-gray-600 text-xs italic mt-1' },
      description
    )
  );
}

// Global Firebase and Firestore instances (initialized once)
let app, auth, db;

// Initialize Firebase and set up auth listener
const initializeFirebase = () => {
  if (typeof firebase !== 'undefined' && typeof __firebase_config !== 'undefined') {
    try {
      let firebaseApp;
      try {
        firebaseApp = firebase.app();
      } catch (e) {
        firebaseApp = firebase.initializeApp(JSON.parse(__firebase_config));
      }

      app = firebaseApp;
      auth = firebase.auth(app);
      db = firebase.firestore(app);

      firebase.auth().onAuthStateChanged(user => {
        if (user) {
          console.log("Firebase Auth State Changed: User is signed in.", user.uid);
        } else {
          console.log("Firebase Auth State Changed: No user is signed in.");
        }
      });

      console.log("Firebase initialized successfully in register.js");
    } catch (error) {
      console.error("Error initializing Firebase in register.js:", error);
    }
  } else {
    console.error("Firebase SDK or __firebase_config is not available.");
  }
};

// Call initialization when the script loads
initializeFirebase();

// Assuming Page1Form and CountryCodeModal are loaded globally from register-page1.js
// If using module imports, you would do:
// import { Page1Form } from './register-page1.js';
// import { Page2Form } from './register-page2.js';

// Main App Component for Registration
function App() {
  const [step, setStep] = React.useState(1);
  const [formData, setFormData] = React.useState({
    firstName: '',
    lastName: '',
    email: '',
    contactPhoneNumber: '',
    password: '',
    confirmPassword: '',
    billingAddress: '',
    billingCity: '',
    billingZip: '',
    billingCountry: '',
    isAdmin: false,
  });
  const [loading, setLoading] = React.useState(false);
  const [notificationMessage, setNotificationMessage] = React.useState('');
  const [isCountryCodeModalOpen, setIsCountryCodeModalOpen] = React.useState(false);
  const [selectedCountryDialCode, setSelectedCountryDialCode] = React.useState('+421'); // Predvolená predvoľba pre Slovensko

  const closeNotification = () => setNotificationMessage('');

  const handleChange = (e) => {
    const { id, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [id]: type === 'checkbox' ? checked : value
    }));
  };

  const handleNext = (e) => {
    e.preventDefault();
    const { password, confirmPassword } = formData;

    if (password !== confirmPassword) {
      setNotificationMessage('Heslá sa nezhodujú!');
      return;
    }
    if (password.length < 6) {
      setNotificationMessage('Heslo musí mať aspoň 6 znakov!');
      return;
    }
    if (!/[a-z]/.test(password)) {
      setNotificationMessage('Heslo musí obsahovať aspoň jedno malé písmeno!');
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setNotificationMessage('Heslo musí obsahovať aspoň jedno veľké písmeno!');
      return;
    }
    if (!/[0-9]/.test(password)) {
      setNotificationMessage('Heslo musí obsahovať aspoň jednu číslicu!');
      return;
    }

    setStep(2);
  };

  const handlePrev = () => {
    setStep(1);
  };

  const handleSubmit = async (e, recaptchaToken) => {
    e.preventDefault();
    setLoading(true);
    setNotificationMessage('');

    try {
      // 1. Firebase Authentication: Create user with email and password
      const userCredential = await auth.createUserWithEmailAndPassword(formData.email, formData.password);
      const user = userCredential.user;
      console.log('Firebase user created:', user.uid);

      // 2. Save user profile to Firestore
      const userProfileRef = db.collection('artifacts').doc(__app_id).collection('users').doc(user.uid);
      await userProfileRef.set({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        contactPhoneNumber: selectedCountryDialCode + formData.contactPhoneNumber, // Uloženie s predvoľbou
        role: formData.isAdmin ? 'admin' : 'user', // Nastavenie roly
        billing: {
          address: formData.billingAddress,
          city: formData.billingCity,
          zip: formData.billingZip,
          country: formData.billingCountry,
        },
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      console.log('User profile saved to Firestore for:', user.uid);

      // 3. Send registration email via Google Apps Script
      const emailPayload = {
        action: 'sendRegistrationEmail',
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        contactPhoneNumber: selectedCountryDialCode + formData.contactPhoneNumber, // S predvoľbou
        isAdmin: formData.isAdmin,
        billing: {
          address: formData.billingAddress,
          city: formData.billingCity,
          zip: formData.billingZip,
          country: formData.billingCountry,
        },
        recaptchaToken: recaptchaToken // Pass reCAPTCHA token
      };

      const scriptResponse = await fetch(GOOGLE_APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailPayload),
      });

      const scriptResult = await scriptResponse.json();

      if (scriptResult.success) {
        setNotificationMessage('Registrácia úspešná! Skontrolujte si e-mail pre potvrdenie.');
        console.log('Email sent successfully:', scriptResult.message);
        // Po úspešnej registrácii presmerovať alebo vyčistiť formulár
        setTimeout(() => {
          window.location.href = 'login.html'; // Presmerovanie na prihlasovaciu stránku
        }, 3000);
      } else {
        setNotificationMessage(`Registrácia úspešná, ale chyba pri odosielaní e-mailu: ${scriptResult.error}`);
        console.error('Error sending email:', scriptResult.error);
      }

    } catch (error) {
      console.error('Registration error:', error);
      let errorMessage = 'Nastala chyba pri registrácii.';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'E-mailová adresa je už zaregistrovaná.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Heslo je príliš slabé. Použite aspoň 6 znakov.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Neplatný formát e-mailovej adresy.';
      }
      setNotificationMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return React.createElement(
    'div',
    { className: 'min-h-screen flex items-center justify-center bg-gray-100 p-4' },
    step === 1 ?
      React.createElement(Page1Form, {
        formData: formData,
        handleChange: handleChange,
        handleNext: handleNext,
        loading: loading,
        notificationMessage: notificationMessage,
        closeNotification: closeNotification,
        isCountryCodeModalOpen: isCountryCodeModalOpen,
        setIsCountryCodeModalOpen: setIsCountryCodeModalOpen,
        setSelectedCountryDialCode: setSelectedCountryDialCode,
        selectedCountryDialCode: selectedCountryDialCode,
        PasswordInput: PasswordInput,
        NotificationModal: NotificationModal
      }) :
      React.createElement(Page2Form, {
        formData: formData,
        handleChange: handleChange,
        handlePrev: handlePrev,
        handleSubmit: handleSubmit,
        loading: loading,
        notificationMessage: notificationMessage,
        closeNotification: closeNotification,
        NotificationModal: NotificationModal, // Pass NotificationModal to Page2Form
        RECAPTCHA_SITE_KEY: RECAPTCHA_SITE_KEY // Pass RECAPTCHA_SITE_KEY to Page2Form
      })
  );
}

// Render the App component
if (typeof ReactDOM !== 'undefined' && document.getElementById('root')) {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(React.createElement(App, null));
  console.log("register.js: React App vykreslená.");
} else {
  console.error("register.js: ReactDOM alebo element 'root' nie je k dispozícii pre vykreslenie React App.");
}
