// login.js
// Tento súbor predpokladá, že firebaseConfig, initialAuthToken a appId
// sú globálne definované v <head> login.html.
// Bol upravený tak, aby sa zachovalo pôvodné rozloženie s textom "Zabudli ste heslo?" pod tlačidlom "Prihlásiť"
// a aby sa React aplikácia vykreslila až po prijatí udalosti z authentication.js, ktorá signalizuje, že
// globálne dáta sú pripravené.

// Importy pre potrebné Firebase funkcie
import { onAuthStateChanged, signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const RECAPTCHA_SITE_KEY = "6LdJbn8rAAAAAO4C50qXTWva6ePzDlOfYwBDEDwa";

// PasswordInput Component for password fields with visibility toggle (converted to React.createElement)
function PasswordInput({ id, label, value, onChange, placeholder, autoComplete, showPassword, toggleShowPassword, onCopy, onPaste, onCut, disabled, description, tabIndex }) {
    const EyeIcon = React.createElement(
    'svg',
    { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2, d: showPassword ? 'M13.875 18.25h-3.75m3.75 0a9.208 9.208 0 01-3.75 0m3.75 0c.264-.47.45-.98.544-1.503l.635-3.175m-5.464 4.678h-3.75m3.75 0c-.264-.47-.45-.98-.544-1.503l-.635-3.175m5.464 4.678c1.328 0 2.585-.367 3.666-1.026a10.875 10.875 0 00-7.332 0c1.081.659 2.338 1.026 3.666 1.026zM20 12c-1.2 2.652-3.15 4.968-5.753 6.643a12.008 12.008 0 01-8.494 0c-2.603-1.675-4.553-3.991-5.753-6.643a1.5 1.5 0 010-1.5c1.2-2.652 3.15-4.968 5.753-6.643a12.008 12.008 0 018.494 0c2.603 1.675 4.553 3.991 5.753 6.643a1.5 1.5 0 010 1.5z' : 'M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'}
    ));
    const EyeSlashIcon = React.createElement(
    'svg',
    { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2, d: 'M13.875 18.25h-3.75m3.75 0c1.328 0 2.585-.367 3.666-1.026a10.875 10.875 0 00-7.332 0c1.081.659 2.338 1.026 3.666 1.026zM15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c.66 0 1.304.148 1.926.425M21.542 12c-1.274 4.057-5.064 7-9.542 7-.66 0-1.304-.148-1.926-.425M17.962 13.568a9.42 9.42 0 00-5.96-1.568m-.91 3.51a3 3 0 00-1.88-2.618M4.22 8.76l1.24 1.405M18.78 15.24l-1.24-1.405M10.15 18.76l-1.24-1.405M15.85 5.24l-1.24 1.405'}
    ));

    return React.createElement(
        'div',
        { className: 'mb-6' },
        React.createElement(
            'label',
            { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: id },
            label
        ),
        React.createElement(
            'div',
            { className: 'relative' },
            React.createElement(
                'input',
                {
                    className: 'shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:shadow-outline transition-colors duration-200',
                    id: id,
                    type: showPassword ? 'text' : 'password',
                    placeholder: placeholder,
                    value: value,
                    onChange: onChange,
                    autoComplete: autoComplete,
                    onCopy: onCopy,
                    onPaste: onPaste,
                    onCut: onCut,
                    disabled: disabled,
                    tabIndex: tabIndex,
                }
            ),
            React.createElement(
                'div',
                {
                    className: 'absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer',
                    onClick: toggleShowPassword
                },
                showPassword ? EyeIcon : EyeSlashIcon
            )
        ),
        description && React.createElement(
            'p',
            { className: 'text-gray-600 text-xs mt-1' },
            description
        )
    );
}

// ResetPasswordModal Component (converted to React.createElement)
const ResetPasswordModal = ({ show, onClose }) => {
  const [email, setEmail] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    if (!email) {
      setMessage('Prosím, zadajte platnú e-mailovú adresu.');
      setLoading(false);
      return;
    }
    try {
      if (!window.auth) {
        console.error("Firebase Auth nie je inicializovaný.");
        return;
      }
      await sendPasswordResetEmail(window.auth, email);
      setMessage('Odkaz na obnovenie hesla bol odoslaný na váš e-mail.');
    } catch (error) {
      console.error("Chyba pri odosielaní e-mailu na obnovenie hesla:", error);
      setMessage('Chyba: E-mail na obnovenie hesla sa nepodarilo odoslať. Skúste to znova.');
    } finally {
      setLoading(false);
    }
  };

  if (!show) {
    return null;
  }

  return React.createElement(
    'div',
    { className: 'modal' },
    React.createElement(
      'div',
      { className: 'modal-content modal-content-sm' },
      React.createElement('h2', { className: 'text-2xl font-bold mb-4' }, 'Obnovenie hesla'),
      React.createElement(
        'form',
        { onSubmit: handleResetPassword },
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
              className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline transition-colors duration-200',
              id: 'email',
              type: 'email',
              placeholder: 'Zadajte svoj e-mail',
              value: email,
              onChange: (e) => setEmail(e.target.value),
              disabled: loading,
              tabIndex: 1
            }
          )
        ),
        React.createElement(
          'div',
          { className: 'flex items-center justify-between' },
          React.createElement(
            'button',
            {
              type: 'submit',
              className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200',
              disabled: loading,
              tabIndex: 2
            },
            loading ? 'Odosielam...' : 'Odoslať'
          ),
          React.createElement(
            'button',
            {
              type: 'button',
              onClick: onClose,
              className: 'bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200',
              disabled: loading,
              tabIndex: 3
            },
            'Zrušiť'
          )
        )
      ),
      message && React.createElement(
        'p',
        { className: 'text-sm mt-4', style: { color: message.startsWith('Chyba') ? 'red' : 'green' } },
        message
      )
    )
  );
};

// Hlavný komponent aplikácie pre prihlasovaciu stránku (prevedený na React.createElement)
const App = () => {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = React.useState(false);

  // Funkcia na prepínanie viditeľnosti hesla
  const toggleShowPassword = () => {
    setShowPassword(prevShowPassword => !prevShowPassword);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (!window.auth) {
        throw new Error("Firebase Auth nie je inicializovaný.");
      }
      await signInWithEmailAndPassword(window.auth, email, password);
      // Ak je prihlásenie úspešné, onAuthStateChanged listener v authentication.js
      // sa postará o presmerovanie na index.html.
    } catch (err) {
      console.error("Chyba pri prihlásení:", err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Nesprávny e-mail alebo heslo.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Neplatný formát e-mailu.');
      } else {
        setError('Pri prihlásení došlo k chybe. Skúste to znova.');
      }
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    const authListener = onAuthStateChanged(window.auth, (user) => {
      if (user) {
        console.log("login.js: Používateľ je prihlásený. Presmerovávam na index.html.");
        window.location.href = 'index.html';
      }
    });

    return () => authListener();
  }, []);

  return React.createElement(
    'div',
    { className: 'w-full max-w-md' },
    React.createElement(ResetPasswordModal, { show: showResetPasswordModal, onClose: () => setShowResetPasswordModal(false) }),
    React.createElement(
      'div',
      { className: 'bg-white shadow-md rounded-lg px-8 pt-6 pb-8 mb-4' },
      React.createElement(
        'div',
        { className: 'flex justify-center mb-6' },
        React.createElement(
          'h1',
          { className: 'text-3xl font-bold text-gray-800' },
          'Prihlásenie'
        )
      ),
      React.createElement(
        'form',
        { onSubmit: handleLogin, className: 'space-y-4' },
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
              className: 'shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:shadow-outline transition-colors duration-200',
              id: 'email',
              type: 'email',
              placeholder: 'Zadajte Váš e-mail',
              value: email,
              onChange: (e) => setEmail(e.target.value),
              disabled: loading,
              autoComplete: 'username',
              tabIndex: 1
            }
          )
        ),
        React.createElement(PasswordInput, {
          id: 'password',
          label: 'Heslo',
          value: password,
          onChange: (e) => setPassword(e.target.value),
          placeholder: 'Zadajte Vaše heslo',
          autoComplete: 'current-password',
          showPassword: showPassword,
          toggleShowPassword: toggleShowPassword,
          disabled: loading,
          tabIndex: 2
        }),
        error && React.createElement(
          'div',
          { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative', role: 'alert' },
          React.createElement(
            'span',
            { className: 'block sm:inline' },
            error
          )
        ),
        React.createElement(
          'div',
          { className: 'flex items-center justify-between flex-col' },
          React.createElement(
            'button',
            {
              type: 'submit',
              className: 'bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg shadow-lg transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:shadow-outline w-full',
              disabled: loading,
              tabIndex: 3
            },
            loading ? 'Prihlasujem...' : 'Prihlásiť'
          ),
          React.createElement(
            'a',
            {
              href: '#',
              onClick: (e) => { e.preventDefault(); setShowResetPasswordModal(true); },
              className: 'inline-block align-baseline font-bold text-sm text-blue-600 hover:text-blue-800 transition-colors duration-200 mt-4',
            },
            'Zabudli ste heslo?'
          )
        )
      )
    )
  );
};

// Funkcia na overenie, či sú všetky potrebné globálne premenné dostupné
const renderApp = () => {
    try {
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(React.createElement(App, null));
        console.log("login.js: React App vykreslená po prijatí udalosti 'globalDataUpdated'.");
    } catch (error) {
        console.error("Chyba pri vykresľovaní React komponentu:", error);
    }
};

// Počkajte na udalosť 'globalDataUpdated' predtým, ako vykreslíme aplikáciu.
// Ak sa udalosť už odohrala, vykreslíme okamžite.
if (window.isGlobalAuthReady) {
    renderApp();
} else {
    window.addEventListener('globalDataUpdated', renderApp);
}

// Pridáme poslucháča udalosti 'globalDataUpdated' pre načítanie hlavičky.
// Tým sa zabezpečí, že hlavička bude mať prístup k aktuálnemu stavu autentifikácie.
window.addEventListener('globalDataUpdated', () => {
  // Načítanie header.js po inicializácii autentifikácie
  const headerScript = document.createElement('script');
  headerScript.type = 'module';
  headerScript.src = 'header.js';
  document.body.appendChild(headerScript);
});
