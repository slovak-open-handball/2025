// login.js
import { onAuthStateChanged, signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
const RECAPTCHA_SITE_KEY = "6LekXLgrAAAAAB6HYeGZG-tu_N42DER2fh1aVBjF";
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
function PasswordInput({ id, label, value, onChange, placeholder, autoComplete, showPassword, toggleShowPassword, onCopy, onPaste, onCut, disabled, description, tabIndex }) {
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
                showPassword ? EyeIcon : EyeOffIcon
            )
        ),
        description && React.createElement(
            'p',
            { className: 'text-gray-600 text-xs mt-1' },
            description
        )
    );
}
const isEmailValid = (email) => {
    const re = /\S+@\S+\.\S{2,}/;
    return re.test(email);
};
const ResetPasswordForm = ({ onCancel }) => {
    const [email, setEmail] = React.useState('');
    const [message, setMessage] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState('');
    const handleResetPassword = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        setError('');
        if (!isEmailValid(email)) {
            setError('Prosím, zadajte platnú e-mailovú adresu.');
            setLoading(false);
            return;
        }
        try {
            if (!window.auth) {
                return;
            }
            await sendPasswordResetEmail(window.auth, email);
            setMessage('Odkaz na obnovenie hesla bol odoslaný na váš e-mail.');
        } catch (err) {
            if (err.code === 'auth/user-not-found') {
                setError('Nepodarilo sa nájsť účet s touto e-mailovou adresou.');
            } else {
                setError('Chyba: E-mail na obnovenie hesla sa nepodarilo odoslať. Skúste to znova.');
            }
        } finally {
            setLoading(false);
        }
    };
    const isSendButtonDisabled = loading || !isEmailValid(email);
    return React.createElement(
        'div',
        { className: 'bg-white shadow-md rounded-lg px-8 pt-6 pb-8 mb-4' },
        React.createElement('h2', { className: 'text-2xl font-bold mb-4 text-center' }, 'Obnovenie hesla'),
        React.createElement(
            'form',
            { onSubmit: handleResetPassword },
            React.createElement(
                'div',
                { className: 'mb-4' },
                React.createElement(
                    'label',
                    { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'email-reset' },
                    'E-mailová adresa'
                ),
                React.createElement(
                    'input',
                    {
                        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline transition-colors duration-200',
                        id: 'email-reset',
                        type: 'email',
                        placeholder: 'Zadajte e-mailovú adresu',
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
                        className: `font-bold py-2 px-4 rounded-lg shadow-lg transition duration-300 ease-in-out focus:outline-none focus:shadow-outline w-full
                          ${isSendButtonDisabled
                            ? 'bg-white text-blue-500 border-2 border-blue-500 cursor-not-allowed'
                            : 'bg-blue-500 hover:bg-blue-600 text-white transform hover:scale-105'
                          }`,
                        disabled: isSendButtonDisabled,
                        tabIndex: 2
                    },
                    loading ? 'Odosielam...' : 'Odoslať'
                )
            ),
            React.createElement(
                'button',
                {
                    type: 'button',
                    onClick: onCancel,
                    className: 'bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200 w-full mt-4',
                    tabIndex: 3
                },
                'Zrušiť'
            ),
            message && React.createElement(
                'p',
                { className: 'text-sm mt-4 text-center text-green-600' },
                message
            ),
            error && React.createElement(
                'p',
                { className: 'text-sm mt-4 text-center text-red-600' },
                error
            )
        )
    );
};
const App = () => {
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState('');
    const [showPassword, setShowPassword] = React.useState(false);
    const [showResetPasswordForm, setShowResetPasswordForm] = React.useState(false);
    const [unapprovedAdminMessage, setUnapprovedAdminMessage] = React.useState('');
    const toggleShowPassword = () => {
        setShowPassword(prevShowPassword => !prevShowPassword);
    };
    const isPasswordValid = (password) => {
        return password.length >= 10;
    };
    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setUnapprovedAdminMessage(''); 
        try {
            if (!window.auth) {
                throw new Error("Firebase Auth nie je inicializovaný.");
            }
            const userCredential = await signInWithEmailAndPassword(window.auth, email, password);
            try {
                if (userCredential && userCredential.user && window.db) {
                    const userDocRef = doc(window.db, 'users', userCredential.user.uid);
                    await updateDoc(userDocRef, {
                        lastLoginAt: new Date()
                    });
                }
            } catch (firestoreErr) {
            }
        } catch (err) {
            if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
                setError('Nesprávny e-mail alebo heslo.');
            } else if (err.code === 'auth/invalid-email') {
                setError('Neplatný formát e-mailu.');
            } else {
                setError('Zadali ste nesprávne používateľské meno alebo heslo. Skúste to znova.');
            }
        } finally {
            setLoading(false);
        }
    };
    const isButtonDisabled = loading || !isEmailValid(email) || !isPasswordValid(password);
    React.useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const status = urlParams.get('status');
        if (status === 'unapproved_admin') {
            setUnapprovedAdminMessage("Váš účet bol zaregistrovaný ako administrátorský. Prosím, počkajte na schválenie. O stave vášho účtu vás budeme informovať.");            
            const timer = setTimeout(() => {
                setUnapprovedAdminMessage(''); 
                const newUrl = window.location.origin + window.location.pathname;
                window.history.replaceState({}, document.title, newUrl);
            }, 10000);
            return () => clearTimeout(timer);
        } else {
            setUnapprovedAdminMessage('');
        }
        const header = document.querySelector('header');
        if (header) {
            header.classList.remove('invisible');
            header.classList.add('bg-blue-800');
        }
    }, []); 
    return React.createElement(
        'div',
        { className: 'w-full max-w-md' },
        showResetPasswordForm ? (
            React.createElement(ResetPasswordForm, { onCancel: () => setShowResetPasswordForm(false) })
        ) : (
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
                unapprovedAdminMessage && React.createElement(
                    'div',
                    { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap', role: 'alert' },
                    React.createElement(
                        'span',
                        { className: 'block sm:inline' },
                        unapprovedAdminMessage
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
                            'E-mailová adresa'
                        ),
                        React.createElement(
                            'input',
                            {
                                className: 'shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:shadow-outline transition-colors duration-200',
                                id: 'email',
                                type: 'email',
                                placeholder: 'Zadajte e-mailovú adresu',
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
                        placeholder: 'Zadajte heslo',
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
                                className: `font-bold py-2 px-4 rounded-lg shadow-lg transition duration-300 ease-in-out focus:outline-none focus:shadow-outline w-full
                                          ${isButtonDisabled
                                    ? 'bg-white text-blue-500 border-2 border-blue-500 cursor-not-allowed'
                                    : 'bg-blue-500 hover:bg-blue-600 text-white transform hover:scale-105'
                                }`,
                                disabled: isButtonDisabled,
                                tabIndex: 3
                            },
                            loading ? 'Prihlasujem...' : 'Prihlásiť'
                        ),
                        React.createElement(
                            'a',
                            {
                                href: '#',
                                onClick: (e) => { e.preventDefault(); setShowResetPasswordForm(true); },
                                className: 'inline-block align-baseline font-bold text-sm text-blue-600 hover:text-blue-800 transition-colors duration-200 mt-4',
                            },
                            'Zabudli ste heslo?'
                        )
                    )
                )
            )
        )
    );
};
const renderApp = () => {
    try {
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(React.createElement(App, null));
    } catch (error) {
    }
};
if (window.isGlobalAuthReady) {
    renderApp();
} else {
    window.addEventListener('globalDataUpdated', renderApp);
}
