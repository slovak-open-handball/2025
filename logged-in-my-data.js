// logged-in-my-data.js
// Tento súbor obsahuje React komponent MyDataApp a jeho pomocné komponenty.
// Komponent sa vykreslí, až keď `authentication.js` odošle udalosť `globalDataUpdated`.

// Importy pre Firebase funkcie
import { getAuth, EmailAuthProvider, reauthenticateWithCredential, verifyBeforeUpdateEmail, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getFirestore, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const { useState, useEffect } = React;

/**
 * Komponent pre načítavanie dát.
 * Zobrazuje animovanú ikonu načítavania.
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
 * Komponent pre zobrazenie chybovej správy.
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
    const EyeIcon = React.createElement(
        'svg',
        { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' }),
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' })
    );
    const EyeOffIcon = React.createElement(
        'svg',
        { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.085-2.228' }),
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M10.82 5.072A9.954 9.954 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.05 10.05 0 01-1.218 2.458' }),
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M14.654 11.233a3 3 0 10-4.242-4.242M1.45 1.45l21.1 21.1' })
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
            'div',
            { className: 'mt-1 relative rounded-md shadow-sm' },
            React.createElement(
                'input',
                {
                    type: showPassword ? 'text' : 'password',
                    id: id,
                    name: id,
                    value: value,
                    onChange: onChange,
                    required: true,
                    placeholder: placeholder,
                    disabled: disabled,
                    className: `appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${disabled ? 'bg-gray-100' : ''}`
                }
            ),
            React.createElement(
                'div',
                {
                    className: 'absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer',
                    onClick: toggleShowPassword
                },
                showPassword ? EyeOffIcon : EyeIcon
            )
        )
    );
};

/**
 * Modálne okno na zmenu e-mailovej adresy.
 * Celá logika zmeny e-mailu je presunutá sem, aby bola nezávislá a opakovateľne použiteľná.
 */
const ChangeEmailModal = ({ show, onClose, userProfileData }) => {
    const [newEmail, setNewEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [emailError, setEmailError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [currentStep, setCurrentStep] = useState(1); // 1: Zadanie nového e-mailu a hesla, 2: Zobrazenie notifikácie
    const [emailChangeSuccess, setEmailChangeSuccess] = useState(false);

    useEffect(() => {
        if (!show) {
            setNewEmail('');
            setPassword('');
            setEmailError('');
            setPasswordError('');
            setLoading(false);
            setCurrentStep(1);
            setEmailChangeSuccess(false);
        }
    }, [show]);

    const handleEmailChange = (e) => {
        setNewEmail(e.target.value);
        if (emailError) setEmailError('');
    };

    const handlePasswordChange = (e) => {
        setPassword(e.target.value);
        if (passwordError) setPasswordError('');
    };

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

        const auth = window.auth;
        const currentUser = auth.currentUser;
        if (!currentUser) {
            setPasswordError('Používateľ nie je prihlásený.');
            setLoading(false);
            return;
        }

        try {
            const credential = window.EmailAuthProvider.credential(currentUser.email, password);
            await window.reauthenticateWithCredential(currentUser, credential);
            
            await window.verifyBeforeUpdateEmail(currentUser, newEmail);
            
            // Po úspešnom odoslaní overovacieho e-mailu aktualizujeme stav
            setEmailChangeSuccess(true);
            setCurrentStep(2);
            if (window.showGlobalNotification) {
                window.showGlobalNotification('Overovací e-mail bol odoslaný na vašu novú adresu. Pre dokončenie zmeny kliknite na odkaz v e-maile.', 'success');
            }

        } catch (error) {
            console.error("Chyba pri zmene e-mailu:", error);
            if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                setPasswordError('Zadané heslo je nesprávne.');
            } else if (error.code === 'auth/email-already-in-use') {
                setEmailError('Táto e-mailová adresa sa už používa iným účtom.');
            } else {
                setEmailError('Nastala neočakávaná chyba. Skúste to prosím neskôr.');
            }
        } finally {
            setLoading(false);
        }
    };
    
    // Farby pre tlačidlá
    const buttonColorClass = 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500';
    const buttonClasses = `w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 \
                          ${loading || !newEmail || !password ? 'bg-gray-400 cursor-not-allowed' : buttonColorClass}`;

    return React.createElement(
        'div',
        { className: `fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full ${show ? 'flex' : 'hidden'} justify-center items-center` },
        React.createElement(
            'div',
            { className: 'relative p-8 w-full max-w-lg bg-white rounded-xl shadow-lg' },
            React.createElement(
                'div',
                { className: 'flex justify-between items-center pb-3' },
                React.createElement(
                    'h3',
                    { className: 'text-xl font-semibold text-gray-900' },
                    'Zmeniť e-mailovú adresu'
                ),
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center'
                    },
                    React.createElement(
                        'svg',
                        { className: 'w-5 h-5', fill: 'currentColor', viewBox: '0 0 20 20', xmlns: 'http://www.w3.org/2000/svg' },
                        React.createElement('path', { fillRule: 'evenodd', d: 'M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z', clipRule: 'evenodd' })
                    )
                )
            ),
            currentStep === 1 && React.createElement(
                'form',
                { onSubmit: handleSubmit, className: 'space-y-4' },
                React.createElement('div', { className: 'mt-2' },
                    React.createElement('label', { className: 'block text-gray-700' }, `Aktuálny e-mail: ${userProfileData?.email || ''}`)
                ),
                React.createElement('div', { className: 'space-y-4' },
                    React.createElement('label', { htmlFor: 'new-email', className: 'block text-sm font-medium text-gray-700' }, 'Nová e-mailová adresa'),
                    React.createElement('input', {
                        type: 'email',
                        id: 'new-email',
                        value: newEmail,
                        onChange: handleEmailChange,
                        className: 'mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2',
                        placeholder: 'Zadajte novú e-mailovú adresu',
                        disabled: loading
                    }),
                    emailError && React.createElement('p', { className: 'text-red-500 text-xs italic mt-1' }, emailError)
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
                    toggleShowPassword: () => setShowPassword(!showPassword)
                }),
                passwordError && React.createElement('p', { className: 'text-red-500 text-xs italic mt-1' }, passwordError),
                React.createElement(
                    'button',
                    {
                        type: 'submit',
                        className: buttonClasses,
                        disabled: loading || !newEmail || !password,
                    },
                    loading ? 'Odosielam...' : 'Odoslať overovací e-mail'
                )
            ),
            currentStep === 2 && React.createElement(
                'div',
                { className: 'text-center' },
                React.createElement(
                    'svg',
                    { className: 'mx-auto h-16 w-16 text-green-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M9 12l2 2l4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' })
                ),
                React.createElement(
                    'p',
                    { className: 'mt-4 text-lg font-medium text-gray-900' },
                    'Overovací e-mail bol odoslaný!'
                ),
                React.createElement(
                    'p',
                    { className: 'mt-2 text-sm text-gray-500' },
                    'Pre dokončenie zmeny e-mailovej adresy, prosím, skontrolujte svoju novú e-mailovú schránku a kliknite na overovací odkaz.'
                ),
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'mt-5 w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:text-sm'
                    },
                    'Zavrieť'
                )
            )
        )
    );
};

/**
 * Hlavný React komponent MyDataApp.
 * Zobrazuje profilové údaje používateľa a umožňuje zobraziť modálne okno na zmenu e-mailu.
 */
const MyDataApp = () => {
    const [userProfileData, setUserProfileData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        // Funkcia, ktorá sa spustí, keď sa aktualizujú globálne dáta používateľa
        const handleGlobalDataUpdate = (event) => {
            console.log("MyDataApp: Prijaté globálne dáta:", event.detail);
            if (event.detail) {
                setUserProfileData(event.detail);
                setError(null);
            } else {
                setError("Nie je možné načítať profilové dáta. Uistite sa, že ste prihlásený.");
            }
            setLoading(false);
        };

        // Pridanie listenera na udalosť globalDataUpdated
        window.addEventListener('globalDataUpdated', handleGlobalDataUpdate);

        // Kontrola, či už dáta existujú pre prípad, že udalosť prebehla predtým, ako bol komponent pripravený
        if (window.globalUserProfileData) {
            handleGlobalDataUpdate({ detail: window.globalUserProfileData });
        }

        // Clean-up funkcia pre odstránenie listenera
        return () => {
            window.removeEventListener('globalDataUpdated', handleGlobalDataUpdate);
        };
    }, []);

    // Zobrazenie načítavacieho komponentu, ak sa dáta ešte načítavajú
    if (loading) {
        return React.createElement(Loader, null);
    }

    // Zobrazenie chybového komponentu, ak nastala chyba
    if (error) {
        return React.createElement(ErrorMessage, { message: error });
    }
    
    // Zobrazenie hlavnej aplikácie s profilovými údajmi
    // Predpokladáme, že farba hlavičky pre všetkých bude modrá, keďže sa nejedná o admina.
    const headerColor = 'bg-blue-600';
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
                    'p',
                    { className: 'text-gray-800 text-lg' },
                    React.createElement('span', { className: 'font-bold' }, 'Aktuálna e-mailová adresa:'),
                    ` ${userProfileData.email}`
                ),
                React.createElement(
                    'button',
                    {
                        onClick: () => setShowModal(true),
                        className: 'mt-6 w-full flex justify-center py-2 px-4 rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
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

// Explicitne sprístupníme komponent pre ladenie alebo externé použitie
// Vlastné vykresľovanie sa bude spúšťať z logged-in-my-data.html
window.MyDataApp = MyDataApp;
