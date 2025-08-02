// logged-in-my-data.js
// Tento súbor bol upravený tak, aby okrem zobrazenia profilových údajov
// umožňoval aj zmenu e-mailovej adresy prihláseného používateľa prostredníctvom modálneho okna.
// Logika zmeny e-mailu bola prenesená z z-logged-in-change-email.js.
// Kód bol aktualizovaný, aby bol odolnejší voči chybám s "undefined" premennými.
// Bola pridaná aktualizovaná funkcia pre zobrazenie farebných notifikácií.
// Farba hlavičky sa teraz mení dynamicky na základe roly používateľa.

// Importy pre Firebase funkcie
import { getAuth, EmailAuthProvider, reauthenticateWithCredential, verifyBeforeUpdateEmail, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getFirestore, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const { useState, useEffect } = React;

/**
 * Globálna funkcia pre zobrazenie notifikácií
 * Vytvorí a spravuje modálne okno pre správy o úspechu alebo chybách
 */
window.showGlobalNotification = (message, type = 'success') => {
    let notificationElement = document.getElementById('global-notification');
    
    // Ak element ešte neexistuje, vytvoríme ho a pridáme do tela dokumentu
    if (!notificationElement) {
        notificationElement = document.createElement('div');
        notificationElement.id = 'global-notification';
        // Používame Tailwind CSS triedy pre štýlovanie a animácie
        notificationElement.className = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[9999] opacity-0 transition-opacity duration-300';
        document.body.appendChild(notificationElement);
    }
    
    // Určíme farby na základe typu správy
    let bgColorClass, textColorClass;
    if (type === 'success') {
        bgColorClass = 'bg-green-100';
        textColorClass = 'text-green-800';
    } else if (type === 'error') {
        bgColorClass = 'bg-red-100';
        textColorClass = 'text-red-800';
    } else {
        // Predvolené farby pre iné typy
        bgColorClass = 'bg-blue-100';
        textColorClass = 'text-blue-800';
    }

    // Aktualizujeme obsah a triedy
    notificationElement.innerHTML = `<p class="font-semibold">${message}</p>`;
    notificationElement.className = `fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[9999] opacity-0 transition-opacity duration-300 ${bgColorClass} ${textColorClass}`;
    
    // Zobrazíme notifikáciu (fade-in)
    setTimeout(() => {
        notificationElement.style.opacity = '1';
    }, 10);

    // Skryjeme notifikáciu po 5 sekundách (fade-out)
    setTimeout(() => {
        notificationElement.style.opacity = '0';
        setTimeout(() => {
            if (notificationElement.parentNode) {
                notificationElement.parentNode.removeChild(notificationElement);
            }
        }, 300); // Po dokončení animácie odstránime element z DOM
    }, 5000);
};

/**
 * Komponent PasswordInput pre polia hesla s prepínaním viditeľnosti.
 * Používa sa pre pole aktuálneho hesla v modálnom okne.
 */
const PasswordInput = ({ id, label, value, onChange, placeholder, showPassword, toggleShowPassword, disabled }) => {
    // Použitie nových SVG ikon
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
        { className: 'relative' },
        React.createElement(
            'label',
            { htmlFor: id, className: 'block text-sm font-medium text-gray-700' },
            label
        ),
        React.createElement(
            'div',
            { className: 'mt-1 relative rounded-md shadow-sm' },
            React.createElement(
                'input',
                {
                    id: id,
                    type: showPassword ? 'text' : 'password',
                    className: 'appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm',
                    value: value,
                    onChange: onChange,
                    placeholder: placeholder,
                    required: true,
                    disabled: disabled
                }
            ),
            React.createElement(
                'div',
                { className: 'absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 cursor-pointer', onClick: toggleShowPassword },
                showPassword ? EyeIcon : EyeOffIcon
            )
        )
    );
};

/**
 * Komponent pre modálne okno na zmenu e-mailovej adresy.
 */
const ChangeEmailModal = ({ show, onClose, userProfileData }) => {
    const [newEmail, setNewEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [emailError, setEmailError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        // Reset formulára, keď sa modal zatvorí
        if (!show) {
            setNewEmail('');
            setPassword('');
            setEmailError('');
            setPasswordError('');
            setShowPassword(false);
        }
    }, [show]);

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setEmailError('');
        setPasswordError('');

        const auth = getAuth();
        const user = auth.currentUser;

        if (!user || !user.email) {
            window.showGlobalNotification('Používateľ nie je prihlásený alebo jeho e-mail nie je dostupný.', 'error');
            setLoading(false);
            return;
        }

        if (newEmail === user.email) {
            setEmailError('Nová e-mailová adresa je rovnaká ako stará.');
            setLoading(false);
            return;
        }

        try {
            const credential = EmailAuthProvider.credential(user.email, password);
            await reauthenticateWithCredential(user, credential);

            await verifyBeforeUpdateEmail(user, newEmail);

            const db = getFirestore();
            const userDocRef = doc(db, 'users', user.uid);
            await updateDoc(userDocRef, {
                email: newEmail,
            });

            window.showGlobalNotification('Overovací e-mail bol odoslaný. Prosím, skontrolujte si svoju schránku a potvrďte novú adresu.', 'success');
            onClose(); // Zatvoriť modálne okno po úspešnom odoslaní
        } catch (error) {
            console.error("Chyba pri zmene e-mailu:", error);
            let message = 'Vyskytla sa chyba pri zmene e-mailu.';
            if (error.code === 'auth/wrong-password') {
                message = 'Zadané heslo je nesprávne.';
                setPasswordError(message);
            } else if (error.code === 'auth/email-already-in-use') {
                message = 'Zadaný e-mail už používa iný účet.';
                setEmailError(message);
            } else if (error.code === 'auth/requires-recent-login') {
                message = 'Pre túto akciu sa musíte znova prihlásiť.';
            } else if (error.code === 'auth/invalid-email') {
                message = 'Formát e-mailovej adresy nie je platný.';
                setEmailError(message);
            } else if (error.message.includes('A network error')) {
                message = 'Problém s pripojením k sieti. Skúste to prosím znova.';
            }
            window.showGlobalNotification(message, 'error');
        } finally {
            setLoading(false);
        }
    };

    if (!show) {
        return null;
    }

    const buttonClasses = `w-full flex justify-center py-2 px-4 rounded-md shadow-sm text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2
                           ${(loading || !newEmail || !password)
                             ? 'bg-white text-gray-400 border border-gray-300 cursor-not-allowed'
                             : `text-white bg-blue-600 hover:bg-blue-700 focus:ring-blue-500`
                           }`;

    return React.createElement(
        'div',
        { className: 'fixed inset-0 z-50 flex items-center justify-center overflow-x-hidden overflow-y-auto outline-none focus:outline-none bg-gray-900 bg-opacity-50 backdrop-blur-sm' },
        React.createElement(
            'div',
            { className: 'relative w-auto my-6 mx-auto max-w-lg' },
            React.createElement(
                'div',
                { className: 'relative flex flex-col w-full bg-white border-0 rounded-lg shadow-lg outline-none focus:outline-none' },
                // Hlavička modalu
                React.createElement(
                    'div',
                    { className: 'flex items-start justify-between p-5 border-b border-solid border-gray-300 rounded-t' },
                    React.createElement(
                        'h3',
                        { className: 'text-2xl font-semibold text-gray-900' },
                        'Zmeniť e-mailovú adresu'
                    ),
                    React.createElement(
                        'button',
                        { className: 'p-1 ml-auto bg-transparent border-0 text-gray-600 float-right text-3xl leading-none font-semibold outline-none focus:outline-none', onClick: onClose },
                        React.createElement('span', { className: 'text-gray-600 h-6 w-6 text-2xl block outline-none focus:outline-none' }, '×')
                    )
                ),
                // Telo modalu
                React.createElement(
                    'div',
                    { className: 'relative p-6 flex-auto' },
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
                                React.createElement('input', {
                                    id: 'new-email',
                                    type: 'email',
                                    value: newEmail,
                                    onChange: (e) => setNewEmail(e.target.value),
                                    placeholder: 'Zadajte novú e-mailovú adresu',
                                    className: 'appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm',
                                    disabled: loading,
                                    required: true
                                })
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
                            'button',
                            {
                                type: 'submit',
                                className: buttonClasses,
                                disabled: loading || !newEmail || !password,
                            },
                            loading ? 'Odosielam...' : 'Odoslať overovací e-mail'
                        )
                    )
                )
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

// Funkcia na získanie farby hlavičky na základe roly
const getHeaderColor = (role) => {
    switch (role) {
        case 'admin':
            return 'bg-[#47b3ff]';
        case 'hall':
            return 'bg-[#b06835]';
        case 'user':
            return 'bg-[#9333EA]';
        default:
            return 'bg-blue-800';
    }
};

/**
 * Hlavný React komponent MyDataApp, ktorý zobrazuje profil používateľa.
 */
const MyDataApp = () => {
    const [userProfileData, setUserProfileData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showModal, setShowModal] = useState(false);

    // Načítanie globálnych dát
    useEffect(() => {
        const handleGlobalDataUpdate = () => {
            console.log('MyDataApp: Prijatá udalosť "globalDataUpdated".');
            if (window.globalUserProfileData) {
                setUserProfileData(window.globalUserProfileData);
                setLoading(false);
                setError(null);
            } else {
                setUserProfileData(null);
                setLoading(false);
                setError('Používateľské dáta neboli nájdené. Skúste sa prihlásiť.');
            }
        };

        window.addEventListener('globalDataUpdated', handleGlobalDataUpdate);

        if (window.globalUserProfileData) {
            handleGlobalDataUpdate();
        }

        return () => {
            window.removeEventListener('globalDataUpdated', handleGlobalDataUpdate);
        };
    }, []);

    if (loading) {
        return React.createElement(Loader, null);
    }

    if (error || !userProfileData) {
        return React.createElement(ErrorMessage, { message: error || 'Používateľské dáta neboli nájdené.' });
    }

    const headerColorClass = getHeaderColor(userProfileData.role);

    const PencilIcon = React.createElement(
        'svg',
        {
            xmlns: 'http://www.w3.org/2000/svg',
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: '2',
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            className: 'w-6 h-6 ml-auto cursor-pointer text-white hover:text-blue-200 transition-colors duration-200',
            onClick: () => setShowModal(true)
        },
        React.createElement('path', { d: 'M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z' }),
        React.createElement('path', { d: 'm15 5 4 4' })
    );

    return React.createElement(
        'div',
        { className: 'container mx-auto px-4 sm:px-6 lg:px-8 py-8' },
        React.createElement(
            'div',
            { className: `bg-white p-8 rounded-xl shadow-lg mt-8` },
            React.createElement(
                'div',
                { className: `p-6 rounded-lg shadow-lg ${headerColorClass} mb-8 flex items-center` },
                React.createElement(
                    'h2',
                    { className: 'text-2xl font-bold text-white flex-grow' },
                    'Môj profil'
                ),
                PencilIcon
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
