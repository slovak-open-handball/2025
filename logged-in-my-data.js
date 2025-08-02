// logged-in-my-data.js
// Tento súbor bol upravený tak, aby okrem zobrazenia profilových údajov
// umožňoval aj zmenu e-mailovej adresy prihláseného používateľa prostredníctvom modálneho okna.
// Logika zmeny e-mailu bola prenesená z z-logged-in-change-email.js.

// Importy pre Firebase funkcie
import { getAuth, EmailAuthProvider, reauthenticateWithCredential, verifyBeforeUpdateEmail, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getFirestore, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const { useState, useEffect } = React;

/**
 * SVG ikony pre oko (zobraziť heslo) a preškrtnuté oko (skryť heslo)
 * Boli upravené na základe požiadavky používateľa.
 */
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

/**
 * Komponent PasswordInput pre polia hesla s prepínaním viditeľnosti.
 * Používa sa pre pole aktuálneho hesla v modálnom okne.
 */
const PasswordInput = ({ id, label, value, onChange, placeholder, showPassword, toggleShowPassword, disabled, passwordError }) => {
  return React.createElement(
    'div',
    { className: 'relative' },
    React.createElement(
      'label',
      { htmlFor: id, className: 'block text-sm font-medium text-gray-700' },
      label
    ),
    React.createElement(
      'div',
      { className: 'mt-1 relative rounded-md shadow-sm' },
      React.createElement('input', {
        type: showPassword ? 'text' : 'password',
        id: id,
        value: value,
        onChange: onChange,
        className: `block w-full rounded-md border-gray-300 pr-10 focus:outline-none sm:text-sm ${
          passwordError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'focus:ring-blue-500 focus:border-blue-500'
        } ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`,
        placeholder: placeholder,
        required: true,
        disabled: disabled,
        autoComplete: "current-password"
      }),
      React.createElement(
        'div',
        { className: 'absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 cursor-pointer', onClick: toggleShowPassword },
        showPassword ? EyeOffIcon : EyeIcon
      )
    )
  );
};

/**
 * Pomocný komponent pre načítavanie dát.
 */
const Loader = () => {
    return React.createElement(
        'div',
        { className: 'flex justify-center pt-16' },
        React.createElement(
            'div',
            { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' }
        )
    );
};

/**
 * Pomocný komponent pre zobrazenie chybovej správy.
 * @param {object} props - Vlastnosti komponentu.
 * @param {string} props.message - Chybová správa na zobrazenie.
 */
const ErrorMessage = ({ message }) => {
    return React.createElement(
        'div',
        { className: 'flex justify-center pt-16' },
        React.createElement(
            'div',
            { className: 'p-8 bg-red-100 border-l-4 border-red-500 text-red-700 rounded-lg shadow-md' },
            React.createElement('p', { className: 'font-bold' }, 'Chyba'),
            React.createElement('p', null, message)
        )
    );
};

/**
 * Modálne okno pre zmenu e-mailovej adresy
 */
const ChangeEmailModal = ({ show, onClose, userProfileData }) => {
    const [newEmail, setNewEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [emailError, setEmailError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const auth = getAuth();
    const db = getFirestore();

    const handleNewEmailChange = (e) => {
        setNewEmail(e.target.value);
        setEmailError('');
    };

    const handlePasswordChange = (e) => {
        setPassword(e.target.value);
        setPasswordError('');
    };

    const isFormValid = newEmail && password && newEmail !== userProfileData.email;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setEmailError('');
        setPasswordError('');
        
        if (newEmail === userProfileData.email) {
            setEmailError('Nová e-mailová adresa musí byť odlišná od aktuálnej.');
            setLoading(false);
            return;
        }

        try {
            const credential = EmailAuthProvider.credential(auth.currentUser.email, password);
            await reauthenticateWithCredential(auth.currentUser, credential);

            await verifyBeforeUpdateEmail(auth.currentUser, newEmail);
            
            // Po úspešnom odoslaní overovacieho e-mailu
            window.showGlobalNotification('Overovací e-mail bol odoslaný na novú adresu. Skontrolujte si e-mailovú schránku.', 'success');
            onClose();

        } catch (error) {
            console.error("Chyba pri zmene e-mailu:", error);
            if (error.code === 'auth/wrong-password') {
                setPasswordError('Nesprávne heslo. Skúste to znova.');
            } else if (error.code === 'auth/invalid-email') {
                setEmailError('Neplatný formát e-mailovej adresy.');
            } else if (error.code === 'auth/email-already-in-use') {
                setEmailError('Táto e-mailová adresa už je používaná iným účtom.');
            } else {
                window.showGlobalNotification('Nastala neočakávaná chyba. Skúste to znova. ' + error.message, 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    const buttonColorClass = 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500';

    if (!show) {
        return null;
    }

    return React.createElement(
        'div',
        { className: 'fixed inset-0 z-50 overflow-y-auto', 'aria-labelledby': 'modal-title', role: 'dialog', 'aria-modal': 'true' },
        React.createElement('div', { className: 'flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0' },
            React.createElement('div', { className: 'fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity', 'aria-hidden': 'true' }),
            React.createElement('span', { className: 'hidden sm:inline-block sm:align-middle sm:h-screen', 'aria-hidden': 'true' }, '​'),
            React.createElement('div', { className: 'inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6' },
                React.createElement('div', null,
                    React.createElement('div', { className: 'sm:flex sm:items-start' },
                        React.createElement('div', { className: 'mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10' },
                            React.createElement('svg', { className: 'h-6 w-6 text-blue-600', xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', 'aria-hidden': 'true' },
                                React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' })
                            )
                        ),
                        React.createElement('div', { className: 'mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left' },
                            React.createElement('h3', { className: 'text-lg leading-6 font-medium text-gray-900', id: 'modal-title' }, 'Zmeniť e-mailovú adresu'),
                            React.createElement('div', { className: 'mt-2' },
                                React.createElement('p', { className: 'text-sm text-gray-500' }, 'Pre overenie vašej identity prosím zadajte svoje aktuálne heslo a novú e-mailovú adresu. Na novú adresu bude odoslaný overovací e-mail.')
                            )
                        )
                    )
                ),
                React.createElement(
                    'form',
                    { onSubmit: handleSubmit, className: 'mt-5 space-y-4' },
                    React.createElement(
                        'div',
                        null,
                        React.createElement(
                            'label',
                            { htmlFor: 'new-email', className: 'block text-sm font-medium text-gray-700' },
                            'Nová e-mailová adresa'
                        ),
                        React.createElement(
                            'div',
                            { className: 'mt-1' },
                            React.createElement('input', {
                                id: 'new-email',
                                name: 'new-email',
                                type: 'email',
                                autoComplete: 'email',
                                required: true,
                                value: newEmail,
                                onChange: handleNewEmailChange,
                                className: `appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none sm:text-sm ${
                                  emailError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                                } ${loading ? 'bg-gray-100 cursor-not-allowed' : ''}`,
                                placeholder: 'Zadajte novú e-mailovú adresu',
                                disabled: loading,
                            }),
                        ),
                        emailError && React.createElement(
                            'p',
                            { className: 'text-red-500 text-xs italic mt-1' },
                            emailError
                        )
                    ),
                    React.createElement(PasswordInput, {
                        id: 'current-password-modal',
                        label: 'Aktuálne heslo',
                        value: password,
                        onChange: handlePasswordChange,
                        placeholder: 'Zadajte svoje aktuálne heslo',
                        showPassword: showPassword,
                        toggleShowPassword: () => setShowPassword(!showPassword),
                        disabled: loading,
                        passwordError: passwordError
                    }),
                    passwordError && React.createElement(
                        'p',
                        { className: 'text-red-500 text-xs italic mt-1' },
                        passwordError
                    ),
                    React.createElement(
                        'button',
                        {
                            type: 'submit',
                            className: `w-full flex justify-center py-2 px-4 rounded-md shadow-sm text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 
                            ${
                              (loading || !isFormValid)
                                ? `bg-white text-gray-400 border border-gray-300 cursor-not-allowed`
                                : `text-white ${buttonColorClass}`
                            }`,
                            disabled: loading || !isFormValid,
                        },
                        loading ? 'Odosielam...' : 'Odoslať overovací e-mail'
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'mt-5 sm:mt-6' },
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            className: 'inline-flex justify-center w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:text-sm',
                            onClick: onClose
                        },
                        'Zrušiť'
                    )
                )
            )
        )
    );
};

/**
 * Hlavný React komponent MyDataApp, ktorý zobrazuje profil používateľa.
 */
const MyDataApp = () => {
    const [userProfileData, setUserProfileData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showModal, setShowModal] = useState(false);
    
    // Načítame údaje o používateľovi z globálneho stavu
    useEffect(() => {
        const handleGlobalDataUpdate = (event) => {
            const data = event.detail;
            console.log("MyDataApp: Global data updated event received.", data);
            if (data) {
                setUserProfileData(data);
                // Synchronizujeme email z Firebase Auth s profilovými dátami vo Firestore
                const auth = getAuth();
                const db = getFirestore();
                if (auth.currentUser && auth.currentUser.email !== data.email) {
                    console.log('MyDataApp: Synchronizácia e-mailu, auth:', auth.currentUser.email, 'profil:', data.email);
                    const userDocRef = doc(db, "users", auth.currentUser.uid);
                    updateDoc(userDocRef, { email: auth.currentUser.email })
                        .then(() => {
                            console.log("E-mail v profile úspešne aktualizovaný podľa Firebase Auth.");
                        })
                        .catch(e => {
                            console.error("Chyba pri aktualizácii e-mailu v profile:", e);
                        });
                }
            }
            setLoading(false);
        };
        
        window.addEventListener('globalDataUpdated', handleGlobalDataUpdate);

        // Pri prvej inicializácii použijeme už existujúce dáta, ak sú dostupné
        if (window.globalUserProfileData) {
            handleGlobalDataUpdate({ detail: window.globalUserProfileData });
        } else {
            setLoading(false);
        }

        return () => {
            window.removeEventListener('globalDataUpdated', handleGlobalDataUpdate);
        };
    }, []);

    if (loading) {
        return React.createElement(Loader, null);
    }

    if (error) {
        return React.createElement(ErrorMessage, { message: error });
    }

    // Ak nie je prihlásený, zobrazíme len správu, nebudeme prehadzovať na inú stránku
    if (!userProfileData) {
        return React.createElement(ErrorMessage, { message: "Používateľ nie je prihlásený alebo neboli nájdené jeho dáta." });
    }

    // Farba hlavičky sa mení podľa roly používateľa, ak je rola definovaná.
    const headerColor = userProfileData.role === 'admin' ? 'bg-red-600' : 'bg-blue-600';

    return React.createElement(
        'div',
        { className: 'container mx-auto px-4 sm:px-6 lg:px-8 py-8' },
        React.createElement(
            'div',
            { className: `bg-white p-8 rounded-xl shadow-lg mt-8` },
            React.createElement(
                'div',
                { className: `p-6 rounded-lg shadow-lg ${headerColor} mb-8` },
                React.createElement(
                    'h2',
                    { className: 'text-2xl font-bold text-white' },
                    'Môj profil'
                )
            ),
            React.createElement(
                'div',
                { className: 'space-y-4' },
                React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg' },
                    React.createElement('span', { className: 'font-bold' }, 'Meno:'),
                    ` ${userProfileData.firstName}`
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg' },
                    React.createElement('span', { className: 'font-bold' }, 'Priezvisko:'),
                    ` ${userProfileData.lastName}`
                ),
                React.createElement(
                    'div',
                    { className: 'flex items-center justify-between text-gray-800 text-lg' },
                    React.createElement(
                        'p',
                        { className: 'flex-grow' },
                        React.createElement('span', { className: 'font-bold' }, 'E-mailová adresa:'),
                        ` ${userProfileData.email}`
                    ),
                    React.createElement(
                        'button',
                        {
                            onClick: () => setShowModal(true),
                            className: 'ml-4 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                        },
                        'Zmeniť e-mail'
                    )
                )
            )
        ),
        React.createElement(ChangeEmailModal, {
            show: showModal,
            onClose: () => setShowModal(false),
            userProfileData: userProfileData
        })
    );
};

// Renderovanie aplikácie do DOM
const rootElement = document.getElementById('root');
if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
    const root = ReactDOM.createRoot(rootElement);
    root.render(React.createElement(MyDataApp, null));
    console.log("logged-in-my-data.js: Aplikácia vykreslená.");
} else {
    console.error("logged-in-my-data.js: HTML element 'root' alebo React/ReactDOM nie sú dostupné.");
}

// Explicitne sprístupníme komponent pre ladenie alebo externé použitie
window.MyDataApp = MyDataApp;
