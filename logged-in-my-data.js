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
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.274-4.057 5.064-7 9.542-7 .583 0 1.155.06 1.711.166M21.725 18.825a10.05 10.05 0 01-1.711.166C16.477 19 12.687 16.057 11.413 12.001' }),
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' })
    );

    return React.createElement(
        'div',
        { className: 'relative mt-4' },
        React.createElement(
            'label',
            { htmlFor: id, className: 'block text-sm font-medium text-gray-700' },
            label
        ),
        React.createElement(
            'input',
            {
                type: showPassword ? 'text' : 'password',
                id: id,
                value: value,
                onChange: onChange,
                placeholder: placeholder,
                autoComplete: id,
                required: true,
                disabled: disabled,
                className: `mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`
            }
        ),
        React.createElement(
            'button',
            {
                type: 'button',
                onClick: toggleShowPassword,
                className: 'absolute inset-y-0 right-0 pr-3 flex items-center mt-6 text-sm leading-5',
                'aria-label': showPassword ? 'Skryť heslo' : 'Zobraziť heslo'
            },
            showPassword ? EyeOffIcon : EyeIcon
        )
    );
};

/**
 * Komponent pre modálne okno na zmenu e-mailovej adresy.
 * @param {object} props - Vlastnosti komponentu.
 * @param {boolean} props.show - Riadi viditeľnosť modálneho okna.
 * @param {function} props.onClose - Funkcia na zatvorenie modálneho okna.
 * @param {object} props.userProfileData - Dáta profilu používateľa.
 */
const ChangeEmailModal = ({ show, onClose, userProfileData }) => {
    const [loading, setLoading] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [password, setPassword] = useState('');
    const [emailError, setEmailError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [auth, setAuth] = useState(null);

    // Initializácia Firebase Auth
    useEffect(() => {
        if (window.auth) {
            setAuth(window.auth);
        } else {
            console.error("Firebase Auth nie je inicializovaný.");
        }
    }, []);

    // Overenie formulára
    const isFormValid = newEmail && password && !emailError && !passwordError;

    // Funkcia na spracovanie odoslania formulára
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setEmailError('');
        setPasswordError('');

        if (!auth) {
            console.error("Auth nie je dostupné.");
            setLoading(false);
            return;
        }

        if (newEmail === userProfileData.email) {
            setEmailError('Nová e-mailová adresa musí byť odlišná od aktuálnej.');
            setLoading(false);
            return;
        }

        try {
            const user = auth.currentUser;
            const credential = EmailAuthProvider.credential(user.email, password);

            // Re-autentifikácia používateľa
            await reauthenticateWithCredential(user, credential);
            console.log("Používateľ úspešne re-autentifikovaný.");

            // Odoslanie overovacieho e-mailu na novú adresu
            await verifyBeforeUpdateEmail(user, newEmail);
            console.log("Odoslaný overovací e-mail na novú adresu.");

            // Aktualizácia profilu používateľa vo Firestore s dočasným e-mailom
            const db = getFirestore();
            const userDocRef = doc(db, 'artifacts', window.__app_id, 'users', userProfileData.id);
            await updateDoc(userDocRef, {
                email: newEmail,
            });

            window.showGlobalNotification('Odkaz na zmenu e-mailu bol odoslaný na novú adresu. Pre dokončenie procesu potvrďte zmenu prostredníctvom odkazu.', 'success');
            onClose(); // Zatvorenie modálneho okna po úspešnom odoslaní
        } catch (error) {
            console.error("Chyba pri zmene e-mailu:", error);
            if (error.code === 'auth/wrong-password') {
                setPasswordError('Zadané heslo je nesprávne.');
            } else if (error.code === 'auth/invalid-email') {
                setEmailError('Neplatný formát e-mailovej adresy.');
            } else if (error.code === 'auth/requires-recent-login') {
                window.showGlobalNotification('Pre túto akciu sa musíte znova prihlásiť. Odhláste sa a prihláste znova.', 'error');
            } else {
                window.showGlobalNotification(`Chyba: ${error.message}`, 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    if (!show) {
        return null;
    }

    const buttonColorClass = (isFormValid)
        ? `bg-blue-600 hover:bg-blue-700`
        : `bg-white text-gray-400 border border-gray-300 cursor-not-allowed`;

    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center' },
        React.createElement(
            'div',
            { className: 'relative p-8 border w-96 shadow-lg rounded-md bg-white' },
            React.createElement(
                'div',
                { className: 'text-center' },
                React.createElement(
                    'h3',
                    { className: 'text-2xl font-bold text-gray-900 mb-4' },
                    'Zmeniť e-mailovú adresu'
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
                        React.createElement(
                            'input',
                            {
                                type: 'email',
                                id: 'new-email',
                                value: newEmail,
                                onChange: (e) => setNewEmail(e.target.value),
                                required: true,
                                className: `mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`,
                                placeholder: 'Zadajte novú e-mailovú adresu',
                                disabled: loading,
                            }
                        ),
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
                            className: `w-full flex justify-center py-2 px-4 rounded-md shadow-sm text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${buttonColorClass}`,
                            disabled: loading || !isFormValid,
                        },
                        loading ? 'Odosielam...' : 'Odoslať overovací e-mail'
                    )
                ),
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'mt-4 text-sm font-medium text-gray-500 hover:text-gray-700'
                    },
                    'Zavrieť'
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


/**
 * Hlavný React komponent MyDataApp, ktorý zobrazuje profil používateľa.
 */
const MyDataApp = () => {
    const [userProfileData, setUserProfileData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [auth, setAuth] = useState(null);

    // Načítanie globálnych premenných z `authentication.js`
    useEffect(() => {
        const handleGlobalDataUpdate = () => {
            const user = window.auth.currentUser;
            if (window.isGlobalAuthReady && user) {
                // Sledujeme zmeny profilových dát v reálnom čase
                const db = getFirestore();
                const userDocRef = doc(db, 'artifacts', window.__app_id, 'users', user.uid);
                const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setUserProfileData({ id: docSnap.id, ...data });

                        // Synchronizácia emailu z Firestore s Firebase Auth
                        if (user.email !== data.email) {
                            console.log("Synchronizujem email z Firestore s Firebase Auth.");
                            updateDoc(userDocRef, { email: user.email })
                                .then(() => console.log("Email úspešne zosynchronizovaný."))
                                .catch(err => console.error("Chyba pri synchronizácii emailu:", err));
                        }

                    } else {
                        console.log("Profil používateľa nebol nájdený!");
                        setError("Profil používateľa sa nenašiel.");
                    }
                    setLoading(false);
                }, (err) => {
                    console.error("Chyba pri načítaní profilu:", err);
                    setError("Chyba pri načítaní profilu. Skúste to prosím znova.");
                    setLoading(false);
                });

                return () => unsubscribe();
            } else if (window.isGlobalAuthReady && !user) {
                // Ak používateľ nie je prihlásený, presmerujeme ho na prihlasovaciu stránku
                window.location.href = 'login.html';
            } else {
                // Ak ešte nie sme pripravení, počkáme na ďalšiu udalosť
                console.log("Stav autentifikácie ešte nie je pripravený, čakám na 'globalDataUpdated'.");
            }
        };

        window.addEventListener('globalDataUpdated', handleGlobalDataUpdate);

        // Voláme raz pre prípad, že už dáta máme
        handleGlobalDataUpdate();

        // Nastavíme inštanciu auth, ak je dostupná
        if (window.auth) {
            setAuth(window.auth);
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
        return null;
    }

    // Určenie farby hlavičky na základe roly
    let headerColor = 'bg-blue-600';
    if (userProfileData && userProfileData.role) {
        switch (userProfileData.role) {
            case 'admin':
                headerColor = 'bg-red-600';
                break;
            case 'trener':
                headerColor = 'bg-green-600';
                break;
            default:
                headerColor = 'bg-blue-600';
                break;
        }
    }
    
    // SVG ikona ceruzky
    const PencilIcon = React.createElement(
      'svg',
      {
        className: 'h-5 w-5 text-gray-600 hover:text-blue-500 transition-colors duration-200',
        fill: 'none',
        viewBox: '0 0 24 24',
        stroke: 'currentColor'
      },
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
                    { className: 'flex justify-between items-center text-lg text-gray-800' },
                    React.createElement(
                        'div',
                        null,
                        React.createElement('span', { className: 'font-bold' }, 'Aktuálna e-mailová adresa:'),
                        ` ${userProfileData.email}`
                    ),
                    React.createElement(
                        'button',
                        {
                            onClick: () => setShowModal(true),
                            className: 'p-2 rounded-full hover:bg-gray-100 transition-colors duration-200'
                        },
                        PencilIcon
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
