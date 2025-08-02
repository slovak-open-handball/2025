// login.js
// Tento súbor predpokladá, že firebaseConfig, initialAuthToken a appId
// sú globálne definované v <head> login.html.
// Bol upravený, aby sa React aplikácia vykreslila až po načítaní všetkých globálnych závislostí.

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
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 .264-.852.585-1.666.953-2.433m7.447-3.045a3.003 3.003 0 01-2.906 2.906m7.88-1.572a9.96 9.96 0 00-6.38-2.944M12 5c4.478 0 8.268 2.943 9.542 7a10.05 10.05 0 01-2.433 3.868M15 12a3 3 0 11-6 0 3 3 0 016 0z' }),
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' }),
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M10 14L2 6' })
  );
  
  // Zabezpečíme, aby input nebol autocomplete pri prihlasovaní
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
        className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
        id: id,
        type: showPassword ? 'text' : 'password',
        placeholder: placeholder,
        value: value,
        onChange: onChange,
        autoComplete: 'new-password', // Použijeme 'new-password', aby sa zabránilo ukladaniu hesla
        onCopy: onCopy,
        onPaste: onPaste,
        onCut: onCut,
        disabled: disabled,
        tabIndex: tabIndex,
        // Dôležitý atribút, ktorý hovorí prehliadaču, že toto pole je nové a nemá ho automaticky dopĺňať
        name: 'password'
      }),
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: toggleShowPassword,
          className: 'absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5',
        },
        showPassword ? EyeOffIcon : EyeIcon
      )
    ),
    description && React.createElement(
        'p',
        { className: 'text-xs text-gray-500 mt-1' },
        description
    )
  );
}

// GlobalModal component (prerobený na React.createElement)
const GlobalModal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;

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
                    title
                ),
                React.createElement(
                    'button',
                    { onClick: onClose, className: 'modal-close cursor-pointer z-50' },
                    React.createElement(
                        'svg',
                        { className: 'fill-current text-black', xmlns: 'http://www.w3.org/2000/svg', width: '18', height: '18', viewBox: '0 0 18 18' },
                        React.createElement('path', { d: 'M14.53 4.53l-1.06-1.06L9 7.94 4.53 3.47 3.47 4.53 7.94 9l-4.47 4.47 1.06 1.06L9 10.06l4.47 4.47 1.06-1.06L10.06 9z' })
                    )
                )
            ),
            React.createElement(
                'div',
                null,
                children
            )
        )
    );
};

// Hlavný React komponent pre prihlasovaciu stránku
function App() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState('');
  const [showResetPasswordModal, setShowResetPasswordModal] = React.useState(false);
  const [resetEmail, setResetEmail] = React.useState('');
  const auth = window.auth;

  // Funkcia na obsluhu prihlásenia
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!email || !password) {
      setError('E-mail a heslo sú povinné.');
      setLoading(false);
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      console.log('Prihlásenie bolo úspešné!');
      window.showGlobalNotification('Prihlásenie bolo úspešné!', 'success');
      // Presmerovanie na domovskú stránku po úspešnom prihlásení
      window.location.href = 'index.html';
    } catch (err) {
      console.error('Chyba pri prihlasovaní:', err);
      // Firebase kód chyby
      let errorMessage = 'Nastala neznáma chyba. Skúste to prosím znova.';
      switch (err.code) {
        case 'auth/invalid-email':
          errorMessage = 'Neplatný formát e-mailu.';
          break;
        case 'auth/user-not-found':
          errorMessage = 'Používateľ s týmto e-mailom neexistuje.';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Nesprávne heslo.';
          break;
        case 'auth/invalid-credential':
          errorMessage = 'Nesprávne prihlasovacie údaje.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Príliš veľa neúspešných pokusov o prihlásenie. Skúste to prosím neskôr.';
          break;
      }
      setError(errorMessage);
      window.showGlobalNotification(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    if (!resetEmail) {
        window.showGlobalNotification('Zadajte prosím e-mailovú adresu pre obnovenie hesla.', 'error');
        return;
    }
    
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      window.showGlobalNotification('E-mail na obnovenie hesla bol odoslaný. Skontrolujte si schránku.', 'success');
      setShowResetPasswordModal(false);
      setResetEmail('');
    } catch (err) {
        console.error('Chyba pri odosielaní e-mailu na obnovenie hesla:', err);
        let errorMessage = 'Nastala chyba pri odosielaní e-mailu. Skúste to prosím znova.';
        if (err.code === 'auth/invalid-email') {
            errorMessage = 'Neplatná e-mailová adresa.';
        } else if (err.code === 'auth/user-not-found') {
            errorMessage = 'Pre zadanú e-mailovú adresu neexistuje používateľský účet.';
        }
        window.showGlobalNotification(errorMessage, 'error');
    }
  };


  return React.createElement(
    'div',
    { className: 'w-full max-w-lg mx-auto p-8' },
    React.createElement(GlobalModal, {
        isOpen: showResetPasswordModal,
        onClose: () => setShowResetPasswordModal(false),
        title: 'Obnovenie hesla'
    },
    React.createElement('form', { onSubmit: handlePasswordReset, className: 'space-y-4' },
        React.createElement('p', null, 'Zadajte vašu e-mailovú adresu a my vám pošleme odkaz na obnovenie hesla.'),
        React.createElement('input', {
            type: 'email',
            value: resetEmail,
            onChange: (e) => setResetEmail(e.target.value),
            placeholder: 'E-mail',
            className: 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring focus:border-blue-300',
            required: true
        }),
        React.createElement('div', { className: 'flex justify-end space-x-2 mt-4' },
            React.createElement('button', {
                type: 'button',
                onClick: () => setShowResetPasswordModal(false),
                className: 'px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300'
            }, 'Zrušiť'),
            React.createElement('button', {
                type: 'submit',
                className: 'px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600'
            }, 'Odoslať')
        )
    )
    ),
    React.createElement(
      'div',
      { className: 'w-full bg-white rounded-xl shadow-2xl p-8' },
      React.createElement(
        'div',
        { className: 'flex justify-center' },
        React.createElement(
          'h1',
          { className: 'text-3xl font-bold text-gray-900 mb-6' },
          'Prihlásenie'
        )
      ),
      React.createElement(
        'form',
        { onSubmit: handleLogin },
        React.createElement(
          'div',
          { className: 'mb-4' },
          React.createElement(
            'label',
            { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'email' },
            'E-mailová adresa'
          ),
          React.createElement('input', {
            className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
            id: 'email',
            type: 'email',
            placeholder: 'Váš e-mail',
            value: email,
            onChange: (e) => setEmail(e.target.value),
            autoComplete: 'email',
            disabled: loading,
            tabIndex: 1
          })
        ),
        React.createElement(PasswordInput, {
            id: 'password',
            label: 'Heslo',
            value: password,
            onChange: (e) => setPassword(e.target.value),
            placeholder: '**************',
            autoComplete: 'current-password',
            showPassword: showPassword,
            toggleShowPassword: () => setShowPassword(!showPassword),
            disabled: loading,
            tabIndex: 2
        }),
        error && React.createElement(
          'div',
          { className: 'mb-4 p-4 text-sm text-red-700 bg-red-100 rounded-lg', role: 'alert' },
          error
        ),
        React.createElement(
          'div',
          { className: 'flex items-center justify-between' },
          React.createElement(
            'button',
            {
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
    setTimeout(checkAndRender, 50);
  }
};

// Spustenie vykreslenia po načítaní všetkých globálnych premenných
window.addEventListener('DOMContentLoaded', () => {
  checkAndRender();
});
