// login.js
// Tento súbor predpokladá, že firebaseConfig, initialAuthToken a appId
// sú globálne definované v <head> login.html.

// Importy pre potrebné Firebase funkcie
import { onAuthStateChanged, signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"; // Nechávam importy pre prípad, že by sa opäť použili

const RECAPTCHA_SITE_KEY = "6LdJbn8rAAAAAO4C50qXTWva6ePzDlOfYwBDEDwa";

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
    React.createElement('path', { fill: 'currentColor', stroke: 'none', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' }),
    React.createElement('path', { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' }),
    React.createElement('line', { x1: '21', y1: '3', x2: '3', y2: '21', stroke: 'currentColor', strokeWidth: '2' })
  );
  
  return React.createElement(
    'div',
    { className: 'relative mb-4' },
    React.createElement(
      'label',
      { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: id },
      label
    ),
    React.createElement(
      'input',
      {
        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline transition-all duration-200 focus:ring-2 focus:ring-blue-500',
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
        tabIndex: tabIndex
      }
    ),
    description && React.createElement(
      'p',
      { className: 'text-gray-500 text-xs italic mt-1' },
      description
    ),
    React.createElement(
      'button',
      {
        type: 'button',
        onClick: toggleShowPassword,
        className: 'absolute inset-y-0 right-0 top-6 pr-3 flex items-center',
        tabIndex: -1 // Nechceme, aby bolo tlačidlo dostupné cez tab
      },
      showPassword ? EyeOffIcon : EyeIcon
    )
  );
}

// Funkcia pre zobrazenie notifikačného modalu
function NotificationModal({ show, message, type, onClose }) {
  if (!show) return null;

  const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
  const icon = type === 'success' ? '✅' : '❌';

  return React.createElement(
    'div',
    { className: 'modal' },
    React.createElement(
      'div',
      { className: `bg-white p-6 rounded-xl shadow-xl max-w-md w-full text-center ${bgColor}` },
      React.createElement(
        'p',
        { className: 'text-white text-lg font-semibold flex items-center justify-center space-x-2' },
        React.createElement('span', null, icon),
        React.createElement('span', null, message)
      ),
      React.createElement(
        'button',
        {
          className: 'mt-4 bg-white text-black px-4 py-2 rounded-lg font-semibold hover:bg-gray-200 transition-colors duration-200',
          onClick: onClose
        },
        'Zavrieť'
      )
    )
  );
}

// Modálne okno pre reset hesla
function ResetPasswordModal({ show, onClose, onReset }) {
  const [email, setEmail] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [messageType, setMessageType] = React.useState('success');
  const [loading, setLoading] = React.useState(false);

  // Funkcia pre reset hesla
  const handleReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const auth = window.auth;
      if (!auth) {
        throw new Error("Firebase Auth nie je inicializované.");
      }
      // Opravená verzia: Používame importovanú funkciu sendPasswordResetEmail
      await sendPasswordResetEmail(auth, email);
      setMessage('E-mail na reset hesla bol odoslaný. Skontrolujte si schránku vrátane spamu.');
      setMessageType('success');
      setTimeout(() => {
        onClose(); // Zatvorí modal
        setEmail(''); // Vyčistí pole
      }, 3000);
    } catch (error) {
      console.error("Chyba pri odosielaní e-mailu na reset hesla:", error);
      setMessage('Chyba: ' + error.message);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  return React.createElement(
    'div',
    { className: 'modal' },
    React.createElement(
      'div',
      { className: 'bg-white p-6 rounded-xl shadow-xl max-w-md w-full text-center' },
      React.createElement('h2', { className: 'text-2xl font-bold mb-4 text-center' }, 'Resetovať heslo'),
      React.createElement(
        'form',
        { onSubmit: handleReset },
        React.createElement(
          'div',
          { className: 'mb-4' },
          React.createElement(
            'label',
            { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'reset-email' },
            'E-mail'
          ),
          React.createElement(
            'input',
            {
              className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
              id: 'reset-email',
              type: 'email',
              placeholder: 'Zadajte svoj e-mail',
              value: email,
              onChange: (e) => setEmail(e.target.value),
              autoComplete: 'email',
              required: true
            }
          )
        ),
        message && React.createElement(
          'div',
          { className: `p-2 my-2 rounded-lg text-white ${messageType === 'success' ? 'bg-green-500' : 'bg-red-500'}` },
          message
        ),
        React.createElement(
          'div',
          { className: 'flex items-center justify-between mt-6' },
          React.createElement(
            'button',
            {
              className: `bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`,
              type: 'submit',
              disabled: loading
            },
            loading ? 'Odosielam...' : 'Odoslať e-mail'
          ),
          React.createElement(
            'button',
            {
              className: 'bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200',
              type: 'button',
              onClick: onClose
            },
            'Zrušiť'
          )
        )
      )
    )
  );
}

// Hlavný React komponent pre prihlasovaciu stránku
function App() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showNotification, setShowNotification] = React.useState(false);
  const [notificationMessage, setNotificationMessage] = React.useState('');
  const [notificationType, setNotificationType] = React.useState('error');
  const [showResetPasswordModal, setShowResetPasswordModal] = React.useState(false);
  
  // Pridal som túto funkciu na zmenu farby hlavičky, je prevzatá z index.js
  const getRoleColor = (role) => {
    switch (role) {
        case 'admin':
            return '#47b3ff';
        case 'hall':
            return '#b06835';
        case 'user':
            return '#9333EA';
        default:
            return '#1d4ed8';
    }
  };

  React.useEffect(() => {
    // Sledujeme zmeny v stave autentifikácie
    const unsubscribe = onAuthStateChanged(window.auth, async (user) => {
      console.log("login.js: onAuthStateChanged - Používateľ je", user ? "prihlásený" : "odhlásený");
      
      // Ak je používateľ prihlásený, presmerujeme ho na profilovú stránku
      if (user && window.isGlobalAuthReady) {
        console.log("login.js: Používateľ je prihlásený, presmerujem na logged-in-my-data.html");
        window.location.href = 'logged-in-my-data.html';
      }
    });

    const handleGlobalDataUpdated = (event) => {
      const userProfileData = event.detail;
      const header = document.querySelector('header');
      if (header) {
          if (userProfileData && userProfileData.role) {
              const roleColor = getRoleColor(userProfileData.role);
              header.style.backgroundColor = roleColor;
              console.log(`login.js: Nastavujem farbu hlavičky na základe roly: ${userProfileData.role}, Farba: ${roleColor}`);
          } else {
              header.style.backgroundColor = '#1d4ed8'; // Predvolená farba pre neprihlásených
              console.log("login.js: Používateľ nie je prihlásený alebo nemá rolu. Nastavujem predvolenú farbu hlavičky.");
          }
      }
    };
    
    // Zaregistrujeme listener pre globálnu udalosť
    window.addEventListener('globalDataUpdated', handleGlobalDataUpdated);

    // Clean-up funkcia pre listener
    return () => {
      unsubscribe();
      window.removeEventListener('globalDataUpdated', handleGlobalDataUpdated);
    };
  }, []);

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setNotificationMessage('');

    if (window.grecaptcha) {
      const reCaptchaToken = await new Promise((resolve) => {
        window.grecaptcha.ready(() => {
          window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'login' }).then(resolve);
        });
      });
      console.log("ReCAPTCHA token:", reCaptchaToken);
    }

    try {
      if (!window.auth) {
          throw new Error("Firebase Auth nie je inicializované.");
      }
      const userCredential = await signInWithEmailAndPassword(window.auth, email, password);
      console.log("Prihlásenie úspešné pre používateľa:", userCredential.user.email);
    } catch (error) {
      console.error("Chyba pri prihlasovaní:", error);
      setNotificationMessage('Prihlásenie zlyhalo: ' + error.message);
      setNotificationType('error');
      setShowNotification(true);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseNotification = () => {
    setShowNotification(false);
    setNotificationMessage('');
  };

  const handleToggleShowPassword = () => {
    setShowPassword(prev => !prev);
  };
  
  // Komponent pre prihlásenie
  return React.createElement(
    'div',
    { className: 'flex-grow flex items-center justify-center' },
    React.createElement(
      NotificationModal,
      {
        show: showNotification,
        message: notificationMessage,
        type: notificationType,
        onClose: handleCloseNotification
      }
    ),
    React.createElement(
      ResetPasswordModal,
      {
        show: showResetPasswordModal,
        onClose: () => setShowResetPasswordModal(false)
      }
    ),
    React.createElement(
      'div',
      { className: 'bg-white p-8 rounded-xl shadow-2xl w-full max-w-md' },
      React.createElement(
        'div',
        { className: 'flex flex-col items-center justify-center' },
        React.createElement('h2', { className: 'text-3xl font-extrabold text-gray-900 text-center mb-6' }, 'Prihlásenie'),
        React.createElement(
          'form',
          { className: 'w-full', onSubmit: handleLogin },
          React.createElement(
            'div',
            { className: 'mb-4' },
            React.createElement(
              'label',
              { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'email' },
              'E-mail'
            ),
            React.createElement(
              'input',
              {
                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline transition-all duration-200 focus:ring-2 focus:ring-blue-500',
                id: 'email',
                type: 'email',
                placeholder: 'Zadajte svoj e-mail',
                value: email,
                onChange: (e) => setEmail(e.target.value),
                autoComplete: 'email',
                required: true,
                tabIndex: 1
              }
            )
          ),
          React.createElement(
            PasswordInput,
            {
              id: 'password',
              label: 'Heslo',
              value: password,
              onChange: (e) => setPassword(e.target.value),
              placeholder: 'Zadajte heslo',
              autoComplete: 'current-password',
              showPassword: showPassword,
              toggleShowPassword: handleToggleShowPassword,
              disabled: loading,
              description: '',
              tabIndex: 2
            }
          ),
          React.createElement(
            'button',
            {
              type: 'submit',
              className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200',
              disabled: loading,
              tabIndex: 3
            },
            loading ? 'Prihlasujem...' : 'Prihlásiť'
          ),
          React.createElement(
            'div',
            { className: 'flex items-center justify-between mt-4' },
            React.createElement(
              'a',
              {
                href: '#',
                onClick: (e) => { e.preventDefault(); setShowResetPasswordModal(true); },
                className: 'inline-block align-baseline font-bold text-sm text-blue-600 hover:text-blue-800 transition-colors duration-200',
              },
              'Zabudli ste heslo?'
            )
          )
        )
      )
    )
  );
}

// Funkcia na overenie, či sú všetky potrebné globálne premenné dostupné
const checkAndRender = () => {
  if (window.React && window.ReactDOM && window.auth && window.db) {
    try {
      const root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(React.createElement(App, null));
      console.log("login.js: React App vykreslená.");
    } catch (error) {
      console.error("Chyba pri vykresľovaní React komponentu:", error);
    }
  } else {
    // Ak ešte nie sú všetky globálne premenné dostupné, skúsi to znova neskôr
    setTimeout(checkAndRender, 100);
  }
};

// Spustíme vykreslenie po načítaní stránky
window.addEventListener('load', checkAndRender);
