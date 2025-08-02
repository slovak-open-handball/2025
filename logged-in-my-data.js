// logged-in-my-data.js
// Tento súbor bol upravený tak, aby okrem zobrazenia profilových údajov
// umožňoval aj zmenu e-mailovej adresy prihláseného používateľa prostredníctvom modálneho okna.
// Všetky komponenty a logika sú teraz zahrnuté v jednom súbore, čo rieši chybu definície.

// Importy pre Firebase funkcie
import { getAuth, EmailAuthProvider, reauthenticateWithCredential, verifyBeforeUpdateEmail, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getFirestore, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const { useState, useEffect } = React;

/**
 * Pomocný komponent pre načítavanie dát.
 */
const Loader = () => {
    return React.createElement(
        'div',
        { className: 'flex justify-center items-center h-screen' },
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
 * Komponent PasswordInput pre polia hesla s prepínaním viditeľnosti.
 * Používa sa pre pole aktuálneho hesla v modálnom okne.
 */
const PasswordInput = ({ id, label, value, onChange, placeholder, showPassword, toggleShowPassword, disabled, focusColorClass }) => {
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
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.274-4.057 5.064-7 9.542-7 1.258 0 2.476.195 3.633.578M15 12a3 3 0 11-6 0 3 3 0 016 0z' }),
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M10.828 10.828a2 2 0 002.828 2.828m7.536-7.536l-9.284 9.284m0 0L2.95 2.95M12 5c4.478 0 8.268 2.943 9.542 7-.457 1.481-.987 2.83-1.638 4.053' })
  );

  return React.createElement(
    'div',
    { className: 'relative' },
    React.createElement('label', { htmlFor: id, className: 'block text-sm font-medium text-gray-700' }, label),
    React.createElement(
      'div',
      { className: 'mt-1 relative rounded-md shadow-sm' },
      React.createElement(
        'input',
        {
          id: id,
          type: showPassword ? 'text' : 'password',
          value: value,
          onChange: onChange,
          placeholder: placeholder,
          disabled: disabled,
          className: `block w-full rounded-md border-gray-300 pr-10 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm transition-colors duration-200 ${focusColorClass || 'focus:border-blue-500 focus:ring-blue-500'}`,
        }
      ),
      React.createElement(
        'div',
        { className: 'absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer', onClick: toggleShowPassword },
        showPassword ? EyeOffIcon : EyeIcon
      )
    )
  );
};


/**
 * Modálne okno pre zmenu e-mailovej adresy.
 * Obsahuje re-autentifikáciu a logiku aktualizácie e-mailu.
 */
const ChangeEmailModal = ({ show, onClose, userProfileData }) => {
    const [newEmail, setNewEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [emailError, setEmailError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (show) {
            setNewEmail(userProfileData.email);
            setPassword('');
            setEmailError('');
            setPasswordError('');
            setShowPassword(false);
        }
    }, [show, userProfileData]);

    const handleFormSubmit = async (event) => {
        event.preventDefault();
        setEmailError('');
        setPasswordError('');

        if (!newEmail || !password) {
            setEmailError(!newEmail ? 'E-mailová adresa je povinná.' : '');
            setPasswordError(!password ? 'Heslo je povinné.' : '');
            return;
        }

        setLoading(true);

        try {
            const auth = getAuth();
            const user = auth.currentUser;

            if (!user) {
                throw new Error('Používateľ nie je prihlásený.');
            }

            const credential = EmailAuthProvider.credential(user.email, password);

            await reauthenticateWithCredential(user, credential);

            if (newEmail !== user.email) {
                await verifyBeforeUpdateEmail(user, newEmail);
            } else {
                window.showGlobalNotification("Nová e-mailová adresa je rovnaká ako súčasná. Zmeny neboli uložené.", "info");
                setLoading(false);
                onClose();
                return;
            }
            
            // Po úspešnej re-autentifikácii a odoslaní overovacieho e-mailu aktualizujeme Firestore
            const db = getFirestore();
            const userDocRef = doc(db, "users", user.uid);
            await updateDoc(userDocRef, { email: newEmail });

            window.showGlobalNotification("Overovací e-mail bol odoslaný na vašu novú adresu. Pre dokončenie zmeny kliknite na odkaz v e-maile.", "success");
            onClose();

        } catch (error) {
            console.error("Chyba pri zmene e-mailu:", error);
            if (error.code === 'auth/wrong-password') {
                setPasswordError('Nesprávne heslo. Prosím, skontrolujte ho.');
            } else if (error.code === 'auth/invalid-email') {
                setEmailError('Neplatný formát e-mailovej adresy.');
            } else if (error.code === 'auth/email-already-in-use') {
                setEmailError('Táto e-mailová adresa už je používaná iným účtom.');
            } else {
                window.showGlobalNotification(`Chyba pri zmene e-mailu: ${error.message}`, "error");
            }
        } finally {
            setLoading(false);
        }
    };

    if (!show) {
        return null;
    }

    const buttonColorClass = 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500';

    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50' },
        React.createElement(
            'div',
            { className: 'relative p-8 w-full max-w-lg mx-auto bg-white rounded-xl shadow-lg transform transition-all' },
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mb-6' },
                React.createElement(
                    'h3',
                    { className: 'text-xl font-bold text-gray-900' },
                    'Zmeniť e-mailovú adresu'
                ),
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'text-gray-400 hover:text-gray-600 transition-colors duration-200'
                    },
                    React.createElement('span', { className: 'sr-only' }, 'Zavrieť'),
                    React.createElement(
                        'svg',
                        { className: 'h-6 w-6', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M6 18L18 6M6 6l12 12' })
                    )
                )
            ),
            React.createElement(
                'form',
                { onSubmit: handleFormSubmit, className: 'space-y-6' },
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
                        React.createElement(
                            'input',
                            {
                                id: 'new-email',
                                name: 'new-email',
                                type: 'email',
                                value: newEmail,
                                onChange: (e) => setNewEmail(e.target.value),
                                required: true,
                                disabled: loading,
                                className: 'block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm',
                                placeholder: 'novy.email@domena.sk'
                            }
                        )
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
                    onChange: (e) => setPassword(e.target.value),
                    required: true,
                    placeholder: 'Zadajte svoje aktuálne heslo',
                    disabled: loading,
                    showPassword: showPassword,
                    toggleShowPassword: () => setShowPassword(!showPassword),
                }),
                passwordError && React.createElement(
                    'p',
                    { className: 'text-red-500 text-xs italic mt-1' },
                    passwordError
                ),
                React.createElement(
                    'div',
                    { className: 'mt-6' },
                    React.createElement(
                        'button',
                        {
                            type: 'submit',
                            className: `w-full flex justify-center py-2 px-4 rounded-md shadow-sm text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 
                            ${(loading || !newEmail || !password) 
                              ? `bg-white text-gray-400 border border-gray-300 cursor-not-allowed` 
                              : `text-white ${buttonColorClass}`
                            }`,
                            disabled: loading || !newEmail || !password,
                        },
                        loading ? 'Odosielam...' : 'Odoslať overovací e-mail'
                    )
                )
            )
        )
    );
};


/**
 * Hlavný React komponent MyDataApp, ktorý zobrazuje profilové údaje
 * a spravuje stav modálneho okna pre zmenu e-mailu.
 */
const MyDataApp = () => {
    const [userProfileData, setUserProfileData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        const handleGlobalDataUpdate = (event) => {
            if (event.detail) {
                setUserProfileData(event.detail);
                setLoading(false);
            } else {
                setError('Používateľ nie je prihlásený alebo dáta neboli načítané.');
                setLoading(false);
            }
        };

        // Pridáme listener, ktorý reaguje na zmeny globálnych dát
        window.addEventListener('globalDataUpdated', handleGlobalDataUpdate);

        // Počas prvej inicializácie skontrolujeme, či dáta už existujú
        if (window.globalUserProfileData) {
            handleGlobalDataUpdate({ detail: window.globalUserProfileData });
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

    if (!userProfileData) {
        return React.createElement(ErrorMessage, { message: 'Nie sú dostupné žiadne profilové dáta.' });
    }

    const headerColor = 'bg-blue-600';

    return React.createElement(
        'div',
        { className: 'container mx-auto px-4 sm:px-6 lg:px-8 py-8' },
        React.createElement(
            'div',
            { className: `bg-white p-8 rounded-xl shadow-lg mt-8` },
            React.createElement(
                'div',
                { className: `p-6 rounded-lg shadow-lg ${headerColor} mb-8 flex justify-between items-center` },
                React.createElement(
                    'h2',
                    { className: 'text-2xl font-bold text-white' },
                    'Môj profil'
                ),
                React.createElement(
                    'button',
                    {
                        onClick: () => setShowModal(true),
                        className: 'bg-white text-blue-600 hover:bg-blue-50 transition-colors duration-200 font-medium py-2 px-4 rounded-lg shadow-md'
                    },
                    'Zmeniť e-mail'
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
                    'p',
                    { className: 'text-gray-800 text-lg' },
                    React.createElement('span', { className: 'font-bold' }, 'Aktuálna e-mailová adresa:'),
                    ` ${userProfileData.email}`
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
