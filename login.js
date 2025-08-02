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
    { className: 'mb-4' },
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
          className: 'shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:shadow-outline pr-10',
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
          tabIndex: tabIndex
        }
      ),
      React.createElement(
        'div',
        {
          className: 'absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 cursor-pointer',
          onClick: toggleShowPassword
        },
        showPassword ? EyeOffIcon : EyeIcon
      )
    ),
    description && React.createElement(
      'p',
      { className: 'text-gray-500 text-xs italic mt-1' },
      description
    )
  );
}

// ResetPasswordModal Component (converted to React.createElement)
const ResetPasswordModal = ({ show, onClose, onReset }) => {
    const [email, setEmail] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const [message, setMessage] = React.useState(null);
    const [messageType, setMessageType] = React.useState('success');

    if (!show) {
        return null;
    }

    const handleReset = async (e) => {
        e.preventDefault();
        if (!email) {
            setMessage('Zadajte prosím e-mailovú adresu.');
            setMessageType('error');
            return;
        }

        setLoading(true);
        setMessage(null);
        try {
            await sendPasswordResetEmail(window.auth, email);
            setMessage('E-mail na resetovanie hesla bol odoslaný. Skontrolujte svoju schránku.');
            setMessageType('success');
            setTimeout(() => {
                onClose();
            }, 3000); // Zatvoriť modal po 3 sekundách
        } catch (error) {
            console.error("Chyba pri odosielaní e-mailu na reset hesla:", error);
            setMessage('Nepodarilo sa odoslať e-mail. Skontrolujte e-mailovú adresu a skúste to znova.');
            setMessageType('error');
        } finally {
            setLoading(false);
        }
    };

    return React.createElement(
        'div',
        { className: 'modal' },
        React.createElement(
            'div',
            { className: 'modal-content modal-content-sm' },
            React.createElement(
                'div',
                { className: 'flex justify-between items-center pb-3' },
                React.createElement(
                    'p',
                    { className: 'text-2xl font-bold' },
                    'Resetovať heslo'
                ),
                React.createElement(
                    'div',
                    { className: 'modal-close cursor-pointer z-50', onClick: onClose },
                    React.createElement(
                        'svg',
                        { className: 'fill-current text-black', xmlns: 'http://www.w3.org/2000/svg', width: '18', height: '18', viewBox: '0 0 18 18' },
                        React.createElement('path', { d: 'M18 1.5l-1.5-1.5L9 7.5 1.5 0 0 1.5 7.5 9 0 16.5 1.5 18 9 10.5 16.5 18 18 16.5 10.5 9z' })
                    )
                )
            ),
            React.createElement(
                'div',
                null,
                React.createElement(
                    'form',
                    { onSubmit: handleReset },
                    React.createElement(
                        'div',
                        { className: 'mb-4' },
                        React.createElement(
                            'label',
                            { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'reset-email' },
                            'E-mailová adresa'
                        ),
                        React.createElement(
                            'input',
                            {
                                className: 'shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
                                id: 'reset-email',
                                type: 'email',
                                placeholder: 'Váš e-mail',
                                value: email,
                                onChange: (e) => setEmail(e.target.value),
                                tabIndex: 1
                            }
                        )
                    ),
                    message && React.createElement(
                        'div',
                        { className: `bg-${messageType === 'success' ? 'green' : 'red'}-100 border-l-4 border-${messageType === 'success' ? 'green' : 'red'}-500 text-${messageType === 'success' ? 'green' : 'red'}-700 p-4 mb-4`, role: 'alert' },
                        React.createElement(
                            'p',
                            null,
                            message
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'flex items-center justify-between' },
                        React.createElement(
                            'button',
                            {
                                className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200',
                                type: 'submit',
                                disabled: loading,
                                tabIndex: 2
                            },
                            loading ? 'Odosielam...' : 'Odoslať'
                        )
                    )
                )
            )
        )
    );
};

// Hlavná React App komponenta
const App = () => {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = React.useState(false);

  // Funkcia na kontrolu stavu autentifikácie
  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(window.auth, (user) => {
        // Ak je používateľ prihlásený, presmerujeme ho na domovskú stránku
        if (user) {
            console.log("Používateľ je už prihlásený, presmerovávam na domovskú stránku.");
            // Použijeme window.location.href pre presmerovanie
            window.location.href = 'index.html';
        } else {
            console.log("Žiaden prihlásený používateľ. Zobrazujem prihlasovací formulár.");
            setLoading(false);
        }
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
        await signInWithEmailAndPassword(window.auth, email, password);
        console.log("Prihlásenie úspešné!");
        window.showGlobalNotification("Prihlásenie úspešné!", 'success');
        // Presmerovanie prebehne v listeneri onAuthStateChanged
    } catch (err) {
        setLoading(false);
        let errorMessage = 'Nastala chyba pri prihlásení.';
        if (err.code === 'auth/invalid-email' || err.code === 'auth/user-not-found') {
            errorMessage = 'Zadaná e-mailová adresa nie je platná alebo používateľ neexistuje.';
        } else if (err.code === 'auth/wrong-password') {
            errorMessage = 'Nesprávne heslo. Skúste to znova.';
        } else if (err.code === 'auth/too-many-requests') {
            errorMessage = 'Príliš veľa neúspešných pokusov o prihlásenie. Skúste to prosím neskôr.';
        }
        setError(errorMessage);
        window.showGlobalNotification(errorMessage, 'error');
    }
  };

  if (loading) {
      return React.createElement(
          'div',
          { className: 'flex flex-col items-center justify-center min-h-screen' },
          React.createElement(
              'p',
              { className: 'text-gray-700' },
              'Kontrolujem stav prihlásenia...'
          ),
          React.createElement(
              'div',
              { className: 'animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500 mt-4' }
          )
      );
  }

  return React.createElement(
    'div',
    { className: 'w-full max-w-md' },
    React.createElement(ResetPasswordModal, {
        show: showResetPasswordModal,
        onClose: () => setShowResetPasswordModal(false),
    }),
    React.createElement(
      'form',
      {
        onSubmit: handleLogin,
        className: 'bg-white shadow-xl rounded-lg px-8 pt-6 pb-8 mb-4'
      },
      React.createElement(
        'div',
        { className: 'mb-6 text-center' },
        React.createElement(
          'h1',
          { className: 'text-3xl font-bold text-gray-800' },
          'Prihlásenie'
        )
      ),
      error && React.createElement(
        'div',
        { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-4', role: 'alert' },
        React.createElement(
          'span',
          { className: 'block sm:inline' },
          error
        )
      ),
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
            className: 'shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
            id: 'email',
            type: 'email',
            placeholder: 'Váš e-mail',
            value: email,
            onChange: (e) => setEmail(e.target.value),
            autoComplete: 'email',
            tabIndex: 1
          }
        )
      ),
      React.createElement(PasswordInput, {
          id: 'password',
          label: 'Heslo',
          value: password,
          onChange: (e) => setPassword(e.target.value),
          placeholder: 'Vaše heslo',
          autoComplete: 'current-password',
          showPassword: showPassword,
          toggleShowPassword: () => setShowPassword(!showPassword),
          tabIndex: 2
      }),
      React.createElement(
        'div',
        { className: 'flex items-center justify-between mt-6 flex-col' },
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
// Ak sa udalosť už odoslala predtým, ako sa tento skript načíta, vykreslíme ju okamžite.
window.addEventListener('globalDataUpdated', renderApp);

if (window.isGlobalAuthReady) {
    renderApp();
}
