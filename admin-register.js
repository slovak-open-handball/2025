// admin-register.js (now uses global Firebase instances from authentication.js)
// Explicitly import functions for Firebase Auth and Firestore for modular access (SDK v11)
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, doc, setDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const RECAPTCHA_SITE_KEY = "6LdJbn8rAAAAAO4C50qXTWva6ePzDlOfYwBDEDwa";
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec";

// PasswordInput Component for password fields with visibility toggle (converted to React.createElement)
// Added 'validationStatus' prop for detailed visual indication of password validity
function PasswordInput({ id, label, value, onChange, placeholder, autoComplete, showPassword, toggleShowPassword, onCopy, onPaste, onCut, disabled, validationStatus, onFocus }) { // Added onFocus prop
  // SVG icons for eye (show password) and crossed-out eye (hide password)
  const EyeIcon = React.createElement(
    'svg',
    { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' }),
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-.173.692-.387 1.343-.64 1.956M15 12a3 3 0 11-6 0 3 3 0 016 0z' })
  );

  const EyeOffIcon = React.createElement(
    'svg',
    { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 .963-2.126 2.457-4.045 4.37-5.698M16.52 14.53a3 3 0 10-4.24-4.24m-2.437 2.438a3 3 0 104.242 4.242M10.5 12.5a3 3 0 116 0 3 3 0 01-6 0z' }),
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M12 5c4.478 0 8.268 2.943 9.542 7-.963 2.126-2.457 4.045-4.37 5.698' })
  );

  return React.createElement(
    'div',
    { className: 'mb-4 relative' },
    React.createElement(
      'label',
      { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: id },
      label
    ),
    preDescription && React.createElement(
      'p',
      { className: 'text-gray-500 text-xs italic mb-2' },
      preDescription
    ),
    React.createElement(
      'input',
      {
        className: `shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${validationStatus === 'invalid' ? 'border-red-500' : ''}`,
        id: id,
        type: showPassword ? 'text' : 'password',
        placeholder: placeholder,
        value: value,
        onChange: onChange,
        autoComplete: autoComplete,
        disabled: disabled,
        onCopy: onCopy,
        onPaste: onPaste,
        onCut: onCut,
        onFocus: onFocus
      }
    ),
    React.createElement(
      'div',
      {
        className: 'absolute inset-y-0 right-0 top-6 pr-3 flex items-center text-sm leading-5 cursor-pointer',
        onClick: toggleShowPassword
      },
      showPassword ? EyeOffIcon : EyeIcon
    ),
    validationStatus === 'invalid' && React.createElement(
      'p',
      { className: 'text-red-500 text-xs italic mt-1' },
      'Nesprávny formát.'
    ),
    validationStatus === 'valid' && React.createElement(
      'p',
      { className: 'text-green-500 text-xs italic mt-1' },
      'Heslo je platné.'
    )
  );
}


// NotificationModal Component
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
        setTimeout(onClose, 500); // Wait for fade-out transition
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
  let borderColorClass;
  if (type === 'success') {
    bgColorClass = 'bg-green-500';
    borderColorClass = 'border-green-700';
  } else if (type === 'error') {
    bgColorClass = 'bg-red-600';
    borderColorClass = 'border-red-800';
  } else {
    bgColorClass = 'bg-blue-500';
    borderColorClass = 'border-blue-700';
  }

  return React.createElement(
    'div',
    {
      className: `fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[100] transition-all duration-500 ease-in-out ${message ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`,
      style: { pointerEvents: message ? 'auto' : 'none' }
    },
    React.createElement(
      'div',
      { className: `p-6 rounded-lg text-white font-bold text-center border-b-4 ${bgColorClass} ${borderColorClass} shadow-xl` },
      message
    )
  );
}

// Main App component
export function App() {
  const [formData, setFormData] = React.useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [formSubmitting, setFormSubmitting] = React.useState(false);
  const [successMessage, setSuccessMessage] = React.useState('');
  const [notificationMessage, setNotificationMessage] = React.useState('');
  const [notificationType, setNotificationType] = React.useState('info');

  const showPasswordState = React.useState(false);
  const confirmShowPasswordState = React.useState(false);

  // Získanie referencií na Firebase z globálneho window objektu
  const auth = typeof window !== 'undefined' ? window.auth : null;
  const db = typeof window !== 'undefined' ? window.db : null;

  const getRecaptchaToken = async (action) => {
    if (typeof grecaptcha === 'undefined' || !grecaptcha.execute) {
      console.error("reCAPTCHA API nie je načítané alebo pripravené.");
      return null;
    }
    try {
      const token = await grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: action });
      return token;
    } catch (e) {
      console.error("Chyba pri získavaní reCAPTCHA tokenu:", e);
      return null;
    }
  };

  const handleCreateAdminUser = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setNotificationMessage('');
    setNotificationType('info');

    if (!auth || !db) {
      console.error("Firebase Auth alebo Firestore nie je k dispozícii.");
      setNotificationMessage('Chyba: Služby nie sú dostupné.');
      setNotificationType('error');
      setFormSubmitting(false);
      return;
    }

    try {
      const recaptchaToken = await getRecaptchaToken('admin_registration');
      if (!recaptchaToken) {
        setNotificationMessage('reCAPTCHA overenie zlyhalo. Skúste to znova.');
        setNotificationType('error');
        setFormSubmitting(false);
        return;
      }

      // Check for password matching
      if (formData.password !== formData.confirmPassword) {
        setNotificationMessage('Heslá sa nezhodujú.');
        setNotificationType('error');
        setFormSubmitting(false);
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;

      if (!user) {
        throw new Error("Používateľ nebol vytvorený.");
      }

      // Vytvorenie záznamu v kolekcii 'users' (rovnaká logika ako v register.js)
      const userDocRef = doc(db, "users", user.uid);
      const registrationData = {
        name: formData.name,
        email: formData.email,
        registrationDate: serverTimestamp(),
        // Pridaj ďalšie potrebné polia pre administrátora, napr. role: 'admin'
        role: 'admin',
        approved: false, // NOVINKA: Nastavenie approved na false
        recaptchaToken: recaptchaToken,
        ipAddress: '', // IP adresa sa získa na serveri
        isDeleted: false,
        formStep: 7, // Nastavenie na finálny krok
        lastUpdated: serverTimestamp(),
      };

      await setDoc(userDocRef, registrationData);

      setSuccessMessage('Administrátorský účet bol úspešne vytvorený.');
      setNotificationType('success');
      setNotificationMessage('Registrácia prebehla úspešne.');

      // Odošlite e-mail pomocou Google Apps Script Web App
      try {
        const emailData = {
          recipientEmail: formData.email,
          name: formData.name,
          subject: 'Vaša registrácia admin účtu SOH 2025',
          template: 'admin_registration_success',
        };
        const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors', // Dôležité pre Google Apps Script
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(emailData),
        });
        console.log('Žiadosť o odoslanie e-mailu odoslaná.');
      } catch (emailError) {
        console.error('Chyba pri odosielaní e-mailu:', emailError);
      }

    } catch (error) {
      console.error("Chyba pri vytváraní administrátorského účtu:", error);
      let errorMessage = "Chyba pri vytváraní účtu. Skúste to znova.";
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'E-mail je už použitý.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Neplatný e-mail.';
          break;
        case 'auth/weak-password':
          errorMessage = 'Heslo je príliš slabé.';
          break;
        default:
          errorMessage = error.message;
          break;
      }
      setNotificationMessage(errorMessage);
      setNotificationType('error');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const closeNotification = () => {
    setNotificationMessage('');
  };

  const isFormValid = formData.name.trim() !== '' && formData.email.trim() !== '' && formData.password.trim() !== '' && formData.password === formData.confirmPassword;

  const buttonClasses = `w-full py-3 px-6 rounded-lg text-lg font-bold transition-all duration-200 ease-in-out transform ${
    isFormValid ? 'bg-blue-600 hover:bg-blue-800 text-white shadow-lg scale-105 hover:scale-110 cursor-pointer' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
  }`;

  return React.createElement(
    'div',
    { className: 'bg-white p-8 rounded-lg shadow-lg max-w-xl mx-auto my-12' },
    React.createElement(
      'h1',
      { className: 'text-2xl font-bold text-center text-gray-800 mb-6' },
      'Registrácia administrátora'
    ),
    successMessage ? (
      React.createElement(
        'div',
        { className: 'text-center text-green-500 font-bold' },
        successMessage
      )
    ) : (
      React.createElement(
        'form',
        { onSubmit: handleCreateAdminUser },
        React.createElement(
          'div',
          { className: 'mb-4' },
          React.createElement(
            'label',
            { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'name' },
            'Meno a Priezvisko'
          ),
          React.createElement('input', {
            className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
            id: 'name',
            type: 'text',
            placeholder: 'Meno a Priezvisko',
            value: formData.name,
            onChange: handleInputChange,
            autoComplete: 'name',
            required: true,
          })
        ),
        React.createElement(
          'div',
          { className: 'mb-4' },
          React.createElement(
            'label',
            { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'email' },
            'E-mail'
          ),
          React.createElement('input', {
            className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
            id: 'email',
            type: 'email',
            placeholder: 'E-mail',
            value: formData.email,
            onChange: handleInputChange,
            autoComplete: 'email',
            required: true,
          })
        ),
        React.createElement(PasswordInput, {
          id: 'password',
          label: 'Heslo',
          placeholder: 'Zadajte heslo',
          value: formData.password,
          onChange: handleInputChange,
          autoComplete: 'new-password',
          showPassword: showPasswordState[0],
          toggleShowPassword: () => showPasswordState[1](!showPasswordState[0]),
          validationStatus: formData.password.length > 0 && formData.password.length < 6 ? 'invalid' : 'valid',
          onCopy: (e) => e.preventDefault(),
          onPaste: (e) => e.preventDefault(),
          onCut: (e) => e.preventDefault()
        }),
        React.createElement(PasswordInput, {
          id: 'confirmPassword',
          label: 'Znova heslo',
          placeholder: 'Zadajte heslo znova',
          value: formData.confirmPassword,
          onChange: handleInputChange,
          autoComplete: 'new-password',
          showPassword: confirmShowPasswordState[0],
          toggleShowPassword: () => confirmShowPasswordState[1](!confirmShowPasswordState[0]),
          onCopy: (e) => e.preventDefault(),
          onPaste: (e) => e.preventDefault(),
          onCut: (e) => e.preventDefault(),
          validationStatus: formData.confirmPassword.length > 0 && formData.password !== formData.confirmPassword ? 'invalid' : 'valid'
        }),
        React.createElement(
          'div',
          { className: 'flex items-center justify-between mt-6' },
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
                'Odosielanie...'
              )
            ) : (
              'Vytvoriť administrátorský účet'
            )
          )
        )
      )
    ),
    React.createElement(NotificationModal, {
      message: notificationMessage,
      onClose: closeNotification,
      type: notificationType
    })
  );
}
