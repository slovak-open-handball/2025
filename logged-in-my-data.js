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
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a10.07 10.07 0 012.83-4.71m.72-1.077A10.05 10.05 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.07 10.07 0 01-2.83 4.71m-2.18-2.18L12 12m-6-6l6 6m2 2l2 2m7.5-7.5l-2.49-2.49M7.5 7.5l-2.49-2.49' })
    );

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
                name: id,
                value: value,
                onChange: onChange,
                placeholder: placeholder,
                disabled: disabled,
                className: `focus:ring-blue-500 focus:border-blue-500 block w-full pr-10 sm:text-sm border-gray-300 rounded-md bg-white ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`
            }),
            React.createElement(
                'div',
                { className: 'absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5' },
                React.createElement(
                    'button',
                    {
                        type: 'button',
                        onClick: toggleShowPassword,
                        className: 'focus:outline-none'
                    },
                    showPassword ? EyeOffIcon : EyeIcon
                )
            )
        )
    );
};

// Komponent pre modálne okno na zmenu e-mailovej adresy
const ChangeEmailModal = ({ show, onClose, userProfileData }) => {
    const [newEmail, setNewEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [emailError, setEmailError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const handleNewEmailChange = (e) => {
        setNewEmail(e.target.value);
        setEmailError('');
        setSuccessMessage('');
    };

    const handlePasswordChange = (e) => {
        setPassword(e.target.value);
        setPasswordError('');
        setSuccessMessage('');
    };

    const resetForm = () => {
        setNewEmail('');
        setPassword('');
        setEmailError('');
        setPasswordError('');
        setSuccessMessage('');
    };

    useEffect(() => {
        if (!show) {
            resetForm();
        }
    }, [show]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setEmailError('');
        setPasswordError('');

        const auth = getAuth();
        const user = auth.currentUser;

        if (!user || !userProfileData) {
            window.showGlobalNotification('Používateľ nie je prihlásený.', 'error');
            setLoading(false);
            return;
        }

        if (newEmail === userProfileData.email) {
            setEmailError('Nová e-mailová adresa sa zhoduje s aktuálnou.');
            setLoading(false);
            return;
        }

        try {
            const credential = EmailAuthProvider.credential(userProfileData.email, password);
            await reauthenticateWithCredential(user, credential);
            console.log("Re-autentifikácia úspešná.");

            await verifyBeforeUpdateEmail(user, newEmail);
            console.log("Žiadosť o zmenu e-mailu odoslaná.");

            setSuccessMessage(`Overovací e-mail bol odoslaný na adresu ${newEmail}. Pre dokončenie zmeny kliknite na odkaz v e-maili.`);
            resetForm();
            onClose(); // Zatvorenie modálneho okna po úspešnom odoslaní
            window.showGlobalNotification('Overovací e-mail bol odoslaný. Skontrolujte si schránku.', 'success');
        } catch (error) {
            console.error("Chyba pri zmene e-mailu:", error);
            if (error.code === 'auth/wrong-password') {
                setPasswordError('Nesprávne heslo. Skúste to znova.');
            } else if (error.code === 'auth/invalid-email') {
                setEmailError('Neplatný formát e-mailovej adresy.');
            } else if (error.code === 'auth/email-already-in-use') {
                setEmailError('Táto e-mailová adresa už je používaná iným účtom.');
            } else if (error.code === 'auth/requires-recent-login') {
                // Toto by sa nemalo stať, ak používame reauthenticateWithCredential, ale ako poistka
                window.showGlobalNotification('Pre túto akciu sa musíte znova prihlásiť. Odhláste sa a znova prihláste.', 'error');
            } else {
                window.showGlobalNotification(`Chyba pri zmene e-mailu: ${error.message}`, 'error');
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
        { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center z-50' },
        React.createElement(
            'div',
            { className: 'relative p-8 w-full max-w-md mx-auto bg-white rounded-xl shadow-lg' },
            React.createElement(
                'div',
                { className: 'flex justify-between items-center pb-3 border-b-2 mb-4' },
                React.createElement(
                    'h3',
                    { className: 'text-xl font-bold text-gray-900' },
                    'Zmeniť e-mailovú adresu'
                ),
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'text-gray-400 hover:text-gray-600'
                    },
                    React.createElement(
                        'svg',
                        { className: 'h-6 w-6', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M6 18L18 6M6 6l12 12' })
                    )
                )
            ),
            successMessage && React.createElement(
                'p',
                { className: 'text-green-500 text-sm mb-4' },
                successMessage
            ),
            React.createElement(
                'form',
                { onSubmit: handleSubmit, className: 'space-y-4' },
                React.createElement(
                    'div',
                    null,
                    React.createElement(
                        'label',
                        { htmlFor: 'new-email', className: 'block text-sm font-medium text-gray-700' },
                        'Nová e-mailová adresa'
                    ),
                    React.createElement('input', {
                        type: 'email',
                        id: 'new-email',
                        value: newEmail,
                        onChange: handleNewEmailChange,
                        required: true,
                        autoComplete: 'email',
                        className: 'mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm',
                        placeholder: 'Zadajte novú e-mailovú adresu',
                        disabled: loading,
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
                    onChange: handlePasswordChange,
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

// Hlavný React komponent MyDataApp
const MyDataApp = () => {
    const [userProfileData, setUserProfileData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showModal, setShowModal] = useState(false); // Stav pre zobrazenie modálneho okna

    // Pomocný komponent pre načítavanie dát
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

    // Pomocný komponent pre zobrazenie chybovej správy
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

    // Efekt pre načítanie dát z globálnych premenných
    useEffect(() => {
        const handleGlobalDataUpdate = (event) => {
            console.log('MyDataApp: Prijatá udalosť globalDataUpdated', event.detail);
            const user = event.detail;
            if (user) {
                // Keďže v rámci jednej stránky aktualizujeme len email,
                // musíme na to pamätať pri zobrazení a pri zmene farby hlavičky.
                // Farba hlavičky sa nastaví na základe roly
                const headerColor = user.role === 'admin' ? 'bg-red-600' : 'bg-blue-600';
                const headerElement = document.querySelector('header');
                if (headerElement) {
                    // Najprv odstránime všetky existujúce farby, aby sa nepárovali
                    headerElement.classList.remove('bg-blue-600', 'bg-red-600');
                    headerElement.classList.add(headerColor);
                    headerElement.classList.remove('invisible');
                }
                
                // Aktualizujeme stav s novými dátami
                setUserProfileData(user);
                setLoading(false);
            } else {
                setError("Používateľské dáta neboli nájdené alebo používateľ nie je prihlásený.");
                setLoading(false);
            }
        };

        // Nastavíme listener na udalosť
        window.addEventListener('globalDataUpdated', handleGlobalDataUpdate);

        // Počiatočné načítanie dát, ak už sú dostupné
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

    // Predpokladáme, že farba hlavičky pre všetkých bude modrá, keďže sa nejedná o admina.
    const headerColor = userProfileData?.role === 'admin' ? 'bg-red-600' : 'bg-blue-600';


    // SVG ikona ceruzky pre zmenu e-mailu
    const PencilIcon = React.createElement(
        'svg',
        { className: 'h-5 w-5 text-gray-600 hover:text-blue-500 transition-colors cursor-pointer', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' })
    );

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
                // ZMENA: Namiesto tlačidla je teraz ikona ceruzky
                React.createElement(
                    'button',
                    {
                        onClick: () => setShowModal(true),
                        className: 'text-white p-2 rounded-full hover:bg-white hover:bg-opacity-20 transition-colors focus:outline-none'
                    },
                    React.createElement(
                        'svg',
                        { className: 'h-6 w-6 text-white', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' })
                    )
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
