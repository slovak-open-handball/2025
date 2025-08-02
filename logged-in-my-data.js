// logged-in-my-data.js
// Tento súbor bol upravený tak, aby okrem zobrazenia profilových údajov
// umožňoval aj zmenu e-mailovej adresy prihláseného používateľa prostredníctvom modálneho okna.
// Logika zmeny e-mailu bola prenesená z z-logged-in-change-email.js.

// Importy pre Firebase funkcie
import { getAuth, EmailAuthProvider, reauthenticateWithCredential, verifyBeforeUpdateEmail, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getFirestore, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const { useState, useEffect } = React;

/**
 * Komponent PasswordInput pre polia hesla s prepínaním viditeľnosti.
 * Používa sa pre pole aktuálneho hesla v modálnom okne.
 */
const PasswordInput = ({ id, label, value, onChange, placeholder, showPassword, toggleShowPassword, disabled }) => {
    // Použitie nových SVG ikon, ktoré ste poskytli
    const EyeIcon = React.createElement(
        'svg',
        { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' }),
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' })
    );

    const EyeOffIcon = React.createElement(
        'svg',
        { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 .96-3.15 3.597-5.594 6.347-7.143M15 12a3 3 0 11-6 0 3 3 0 016 0z' }),
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M17.601 13.916C18.665 14.15 19 12 19 12c-1.274-4.057-5.064-7-9.542-7-1.428 0-2.81 0.444-4.075 1.25' }),
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M10 14l2-2' })
    );

    return React.createElement(
        'div',
        { className: 'mb-4' },
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
                name: id,
                value: value,
                onChange: onChange,
                placeholder: placeholder,
                autoComplete: 'current-password',
                required: true,
                disabled: disabled,
                className: `appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${disabled ? 'bg-gray-50' : ''}`
            }),
            React.createElement(
                'div',
                {
                    className: 'absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 cursor-pointer',
                    onClick: toggleShowPassword
                },
                showPassword ? EyeOffIcon : EyeIcon
            )
        )
    );
};

// Modálne okno pre zmenu e-mailovej adresy
const ChangeEmailModal = ({ show, onClose, userProfileData }) => {
    const [newEmail, setNewEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [emailError, setEmailError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // Resetuje stav formulára po otvorení/zatvorení modálu
    useEffect(() => {
        if (!show) {
            setNewEmail('');
            setPassword('');
            setEmailError('');
            setPasswordError('');
            setShowPassword(false);
        } else {
            setNewEmail(userProfileData.email);
        }
    }, [show, userProfileData.email]);

    // Funkcia na re-autentifikáciu a zmenu e-mailu
    const handleChangeEmail = async (e) => {
        e.preventDefault();
        setLoading(true);
        setEmailError('');
        setPasswordError('');

        const auth = getAuth();
        const user = auth.currentUser;

        if (!user) {
            setPasswordError('Používateľ nie je prihlásený.');
            setLoading(false);
            return;
        }

        if (newEmail === user.email) {
            setEmailError('Nová e-mailová adresa je rovnaká ako aktuálna.');
            setLoading(false);
            return;
        }

        try {
            // Re-autentifikácia je potrebná pre zmenu citlivých údajov
            const credential = EmailAuthProvider.credential(user.email, password);
            await reauthenticateWithCredential(user, credential);

            // Ak je re-autentifikácia úspešná, pokúsime sa zmeniť e-mail
            await verifyBeforeUpdateEmail(user, newEmail);

            // Ak je zmena e-mailu úspešná, aktualizujeme aj Firestore
            const db = getFirestore();
            const userDocRef = doc(db, "users", user.uid);
            await updateDoc(userDocRef, { email: newEmail });

            window.showGlobalNotification('Odkaz na overenie novej e-mailovej adresy bol odoslaný. Skontrolujte svoju e-mailovú schránku.', 'success');
            onClose();
        } catch (error) {
            console.error('Chyba pri zmene e-mailu:', error);
            if (error.code === 'auth/wrong-password') {
                setPasswordError('Nesprávne heslo. Skúste to prosím znova.');
            } else if (error.code === 'auth/invalid-email') {
                setEmailError('Neplatný formát e-mailu.');
            } else if (error.code === 'auth/requires-recent-login') {
                setPasswordError('Pre túto akciu sa musíte znova prihlásiť. Odhláste sa a prihláste sa znova.');
            } else if (error.code === 'auth/email-already-in-use') {
                setEmailError('Táto e-mailová adresa je už používaná iným účtom.');
            } else {
                window.showGlobalNotification(`Chyba pri zmene e-mailu: ${error.message}`, 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    if (!show) return null;

    const buttonColorClass = 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500';

    return React.createElement(
        'div',
        { className: 'fixed inset-0 z-50 flex items-center justify-center bg-gray-800 bg-opacity-75 transition-opacity' },
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-2xl p-8 max-w-md w-full mx-4 transform transition-all scale-100' },
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mb-6' },
                React.createElement(
                    'h3',
                    { className: 'text-2xl font-bold text-gray-900' },
                    'Zmeniť e-mail'
                ),
                React.createElement(
                    'button',
                    { onClick: onClose, className: 'text-gray-400 hover:text-gray-600 transition-colors' },
                    React.createElement(
                        'svg',
                        { className: 'h-6 w-6', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M6 18L18 6M6 6l12 12' })
                    )
                )
            ),
            React.createElement(
                'form',
                { onSubmit: handleChangeEmail },
                React.createElement(
                    'div',
                    { className: 'mb-4' },
                    React.createElement(
                        'label',
                        { htmlFor: 'new-email', className: 'block text-sm font-medium text-gray-700' },
                        'Nová e-mailová adresa'
                    ),
                    React.createElement('input', {
                        type: 'email',
                        id: 'new-email',
                        value: newEmail,
                        onChange: (e) => setNewEmail(e.target.value),
                        required: true,
                        autoComplete: 'email',
                        placeholder: 'Zadajte novú e-mailovú adresu',
                        disabled: loading,
                        className: `mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${disabled ? 'bg-gray-50' : ''}`
                    }),
                    emailError && React.createElement(
                        'p',
                        { className: 'text-red-500 text-xs italic mt-1' },
                        emailError
                    )
                ),
                React.createElement(PasswordInput, {
                    id: 'current-password',
                    label: 'Aktuálne heslo',
                    value: password,
                    onChange: (e) => setPassword(e.target.value),
                    placeholder: 'Zadajte svoje aktuálne heslo',
                    showPassword: showPassword,
                    toggleShowPassword: () => setShowPassword(!showPassword),
                    disabled: loading
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
                          (loading || !newEmail || !password) 
                            ? `bg-white text-gray-400 border border-gray-300 cursor-not-allowed` 
                            : `text-white ${buttonColorClass}`
                        }`,
                        disabled: loading || !newEmail || !password,
                    },
                    loading ? 'Odosielam...' : 'Odoslať overovací e-mail'
                )
            )
        )
    );
};

/**
 * Hlavný React komponent MyDataApp.
 * Zobrazuje profilové údaje používateľa a tlačidlo pre zmenu e-mailovej adresy.
 */
const MyDataApp = () => {
    const [userProfileData, setUserProfileData] = useState(window.globalUserProfileData || null);
    const [loading, setLoading] = useState(!window.isGlobalAuthReady);
    const [error, setError] = useState(null);
    const [showModal, setShowModal] = useState(false);

    // Načítanie dát po inicializácii a pri ich zmene
    useEffect(() => {
        const handleGlobalDataUpdate = () => {
            console.log('MyDataApp: Prijatá udalosť globalDataUpdated.');
            if (window.globalUserProfileData) {
                setUserProfileData(window.globalUserProfileData);
                setLoading(false);
            } else {
                setError('Nepodarilo sa načítať profilové dáta. Skúste sa prosím prihlásiť znova.');
                setLoading(false);
            }
        };

        if (window.isGlobalAuthReady) {
            handleGlobalDataUpdate();
        }

        window.addEventListener('globalDataUpdated', handleGlobalDataUpdate);

        return () => {
            window.removeEventListener('globalDataUpdated', handleGlobalDataUpdate);
        };
    }, []);

    // Zobrazenie načítavacej obrazovky alebo chyby
    if (loading) {
        return React.createElement(Loader, null);
    }

    if (error || !userProfileData) {
        return React.createElement(ErrorMessage, { message: error || 'Chyba: Dáta používateľa nie sú dostupné.' });
    }

    // --- LOGIKA NA ZMENU FARBY HLAVIČKY NA ZÁKLADE ROLY ---
    // Definuje farbu hlavičky podľa roly používateľa.
    let headerColor = '';
    switch (userProfileData.role) {
        case 'admin':
            headerColor = '#47b3ff'; // Farba pre admina
            break;
        case 'hall':
            headerColor = '#b06835'; // Farba pre halu
            break;
        case 'user':
            headerColor = '#9333EA'; // Farba pre bežného používateľa
            break;
        default:
            headerColor = '#1D4ED8'; // Predvolená farba
            break;
    }
    // ----------------------------------------------------

    return React.createElement(
        'div',
        { className: 'container mx-auto px-4 sm:px-6 lg:px-8 py-8' },
        React.createElement(
            'div',
            { className: `bg-white p-8 rounded-xl shadow-lg mt-8` },
            React.createElement(
                'div',
                // Použitie dynamického štýlu na nastavenie farby pozadia
                { className: `p-6 rounded-lg shadow-lg mb-8`, style: { backgroundColor: headerColor } },
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
                    'p',
                    { className: 'text-gray-800 text-lg' },
                    React.createElement('span', { className: 'font-bold' }, 'Aktuálna e-mailová adresa:'),
                    ` ${userProfileData.email}`
                ),
                React.createElement(
                    'button',
                    {
                        onClick: () => setShowModal(true),
                        className: 'mt-4 px-4 py-2 bg-purple-600 text-white font-medium text-sm rounded-md shadow-sm hover:bg-purple-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500'
                    },
                    'Zmeniť e-mail'
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
