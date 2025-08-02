// logged-in-my-data.js
// Tento súbor spravuje React komponent MyDataApp, ktorý zobrazuje
// profilové a registračné dáta prihláseného používateľa.
// Spolieha sa na to, že Firebase inštancie (auth, db) a profilové dáta
// sú už definované globálne v 'authentication.js'.

const { useState, useEffect, useCallback } = React;
import { EmailAuthProvider, reauthenticateWithCredential, updateEmail, sendEmailVerification } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

/**
 * Pomocná funkcia na určenie farby podľa role používateľa.
 * @param {string[]} roles - Pole rolí používateľa.
 * @returns {string} Hexadecimálny kód farby.
 */
const getRoleColor = (roles) => {
    if (!roles || roles.length === 0) {
        return '#1D4ED8'; // Predvolená farba (bg-blue-800)
    }
    if (roles.includes('admin')) {
        return '#47b3ff'; // Farba pre admina
    }
    if (roles.includes('hall')) {
        return '#b06835'; // Farba pre halu
    }
    // Ak nie je admin alebo hala, predpokladame bežného používateľa
    return '#9333EA'; // Farba pre bežného používateľa
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
 * Komponent pre pole hesla s prepínaním viditeľnosti.
 * Presunutý mimo hlavných komponentov, aby sa predišlo strate fokusu.
 * @param {object} props - Vlastnosti komponentu.
 * @param {string} props.id - ID poľa.
 * @param {string} props.label - Text popisu poľa.
 * @param {string} props.value - Hodnota poľa.
 * @param {function} props.onChange - Funkcia pre zmenu hodnoty.
 * @param {string} props.placeholder - Zástupný text.
 * @param {boolean} props.disabled - Či je pole zablokované.
 * @param {boolean} props.showPassword - Či sa má heslo zobraziť.
 * @param {function} props.toggleShowPassword - Funkcia na prepínanie viditeľnosti.
 */
const PasswordInput = ({ id, label, value, onChange, placeholder, disabled, showPassword, toggleShowPassword }) => {
    const EyeIcon = React.createElement(
        'svg',
        { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' }),
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7C20.477 16.057 16.688 19 12 19c-4.688 0-8.477-2.943-9.542-7z' })
    );

    const EyeOffIcon = React.createElement(
        'svg',
        { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 .255-.785.528-1.554.825-2.298M18.175 13.875A10.05 10.05 0 0122 12c-1.274-4.057-5.064-7-9.542-7a9.998 9.998 0 00-2.298.825' }),
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' })
    );

    return React.createElement(
        'div',
        { className: 'relative mb-4' },
        React.createElement(
            'label',
            { htmlFor: id, className: 'block text-sm font-medium text-gray-700' },
            label
        ),
        React.createElement('input', {
            type: showPassword ? 'text' : 'password',
            id: id,
            name: id,
            value: value,
            onChange: onChange,
            placeholder: placeholder,
            disabled: disabled,
            className: `mt-1 block w-full pr-10 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${disabled ? 'bg-gray-100' : ''}`,
        }),
        React.createElement(
            'button',
            {
                type: 'button',
                onClick: toggleShowPassword,
                className: 'absolute inset-y-0 right-0 top-6 pr-3 flex items-center text-sm leading-5',
                'aria-label': showPassword ? 'Skryť heslo' : 'Zobraziť heslo',
                disabled: disabled,
            },
            showPassword ? EyeOffIcon : EyeIcon
        )
    );
};

/**
 * Komponent pre editáciu kontaktných údajov (Modal).
 * Ponechané bez zmien, len pre štruktúru
 */
const EditContactModal = ({ userProfileData, isOpen, onClose, isUserAdmin }) => {
    return null;
};

/**
 * Komponent pre editáciu fakturačných údajov (Modal).
 * Ponechané bez zmien, len pre štruktúru
 */
const EditBillingModal = ({ userProfileData, isOpen, onClose }) => {
    return null;
};

/**
 * NOVÝ Komponent pre zmenu e-mailovej adresy.
 * @param {object} props - Vlastnosti komponentu.
 * @param {boolean} props.isOpen - Či je modál otvorený.
 * @param {function} props.onClose - Funkcia na zatvorenie modálu.
 * @param {string[]} props.userRoles - Role prihláseného používateľa pre farebnú schému tlačidla.
 */
const ChangeEmailModal = ({ isOpen, onClose, userRoles }) => {
    const [newEmail, setNewEmail] = useState('');
    const [password, setPassword] = useState('');
    const [emailError, setEmailError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showCurrentPassword, setShowCurrentPassword] = useState(false); // Stav pre zobrazenie/skrytie hesla
    
    // Získanie inštancií z globálneho objektu
    const auth = window.auth;

    const showGlobalNotification = useCallback((message, type) => {
        if (window.showGlobalNotification) {
            window.showGlobalNotification(message, type);
        } else {
            console.error('showGlobalNotification function is not available.');
        }
    }, []);

    const handleNewEmailChange = (e) => {
        const email = e.target.value;
        setNewEmail(email);
        if (email.length > 0 && !/\S+@\S+\.\S+/.test(email)) {
            setEmailError('Zadajte platnú e-mailovú adresu.');
        } else {
            setEmailError('');
        }
    };

    const handlePasswordChange = (e) => {
        setPassword(e.target.value);
        if (e.target.value.length === 0) {
            setPasswordError('Heslo nemôže byť prázdne.');
        } else {
            setPasswordError('');
        }
    };

    const isFormValid = newEmail.length > 0 && password.length > 0 && emailError === '' && passwordError === '';

    const handleEmailChange = async (e) => {
        e.preventDefault();
        setLoading(true);
        setEmailError('');
        setPasswordError('');

        if (!auth || !auth.currentUser || !auth.currentUser.email) {
            showGlobalNotification('Používateľ nie je prihlásený alebo jeho e-mail nie je dostupný.', 'error');
            setLoading(false);
            return;
        }

        const user = auth.currentUser;

        try {
            // 1. Reautentifikácia používateľa s aktuálnym heslom
            const credential = EmailAuthProvider.credential(user.email, password);
            await reauthenticateWithCredential(user, credential);
            console.log('Používateľ úspešne reautentifikovaný.');

            // 2. Aktualizácia e-mailovej adresy pomocou Firebase Authentication
            // Táto funkcia odošle overovací e-mail na novú adresu
            await updateEmail(user, newEmail);
            console.log('E-mailová adresa bola úspešne zmenená. Bol odoslaný overovací e-mail.');

            // 3. Odošlite notifikáciu o úspechu. Zmena je dokončená až po kliknutí na odkaz.
            showGlobalNotification('E-mailová adresa bola úspešne zmenená. Na novú e-mailovú adresu bol odoslaný overovací e-mail.', 'success');
            
            // Po odoslaní e-mailu zatvoríme modál
            onClose();

        } catch (error) {
            console.error('Chyba pri zmene e-mailovej adresy:', error);

            if (error.code === 'auth/wrong-password') {
                setPasswordError('Zadané heslo je nesprávne.');
            } else if (error.code === 'auth/email-already-in-use') {
                setEmailError('Táto e-mailová adresa už je používaná iným účtom.');
            } else if (error.code === 'auth/requires-recent-login') {
                showGlobalNotification('Pre vykonanie tejto akcie sa musíte znova prihlásiť. Skúste to prosím znova.', 'error');
            } else if (error.code === 'auth/invalid-email') {
                setEmailError('Zadaná e-mailová adresa nie je platná.');
            } else {
                showGlobalNotification(`Chyba: ${error.message}`, 'error');
            }
        } finally {
            setLoading(false);
        }
    };
    
    if (!isOpen) return null;

    // Získanie farby podľa role pre tlačidlo
    const roleColor = getRoleColor(userRoles);

    return React.createElement(
        'div',
        { className: "fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center z-50" },
        React.createElement(
            'div',
            { className: "relative p-8 bg-white w-96 max-w-lg mx-auto rounded-lg shadow-2xl" },
            React.createElement(
                'div',
                { className: "flex justify-between items-center mb-4 border-b pb-2" },
                React.createElement(
                    'h3',
                    { className: "text-2xl font-bold text-gray-800" },
                    "Zmeniť e-mail"
                ),
                React.createElement(
                    'button',
                    { onClick: onClose, className: "text-gray-500 hover:text-gray-700 text-3xl leading-none" },
                    '×'
                )
            ),
            React.createElement(
                'form',
                { onSubmit: handleEmailChange },
                React.createElement(
                    'div',
                    { className: "mb-4" },
                    React.createElement('label', { htmlFor: 'new-email', className: 'block text-sm font-medium text-gray-700' }, 'Nová e-mailová adresa'),
                    React.createElement('input', {
                        type: 'email',
                        id: 'new-email',
                        value: newEmail,
                        onChange: handleNewEmailChange,
                        className: `mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${emailError ? 'border-red-500' : ''}`,
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
                    id: 'current-password-change-email',
                    label: 'Aktuálne heslo',
                    value: password,
                    onChange: handlePasswordChange,
                    placeholder: 'Zadajte svoje aktuálne heslo',
                    disabled: loading,
                    showPassword: showCurrentPassword,
                    toggleShowPassword: () => setShowCurrentPassword(!showCurrentPassword),
                }),
                passwordError && React.createElement(
                    'p',
                    { className: 'text-red-500 text-xs italic mt-1' },
                    passwordError
                ),
                React.createElement(
                    'div',
                    { className: "flex justify-end mt-6 space-x-4" },
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: onClose,
                            className: "px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        },
                        "Zrušiť"
                    ),
                    React.createElement(
                        'button',
                        {
                            type: 'submit',
                            className: `px-4 py-2 text-sm font-medium text-white rounded-md shadow-sm transition duration-150 ease-in-out ${!isFormValid || loading ? 'bg-gray-400 cursor-not-allowed' : ''}`,
                            style: { backgroundColor: isFormValid ? roleColor : 'rgb(156 163 175)' },
                            disabled: loading || !isFormValid,
                        },
                        loading ? 'Ukladám...' : 'Uložiť zmeny'
                    )
                )
            )
        )
    );
};

const MyDataApp = () => {
    const { useState, useEffect, useCallback } = React;
    const [userProfileData, setUserProfileData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isEditContactModalOpen, setIsEditContactModalOpen] = useState(false);
    const [isEditBillingModalOpen, setIsEditBillingModal] = useState(false);
    const [isChangeEmailModalOpen, setIsChangeEmailModalOpen] = useState(false);
    const [isUserAdmin, setIsUserAdmin] = useState(false);

    const formatPhoneNumber = (number) => {
        // Implementácia pre formátovanie telefónneho čísla
        if (!number) return '';
        const cleaned = ('' + number).replace(/\D/g, '');
        const match = cleaned.match(/^(\d{4})(\d{3})(\d{3})$/);
        if (match) {
            return `+${match[1]} ${match[2]} ${match[3]}`;
        }
        return number;
    };

    /**
     * Vykreslí hlavičku s dynamickou farbou podľa role.
     * @param {string} headerColor - Hex kód farby.
     */
    const renderHeader = (headerColor) => {
        return React.createElement(
            'div',
            { className: `text-white p-4 rounded-t-lg flex justify-between items-center`, style: { backgroundColor: headerColor } },
            React.createElement(
                'h2',
                { className: 'text-2xl font-bold' },
                'Moje údaje'
            )
        );
    };

    const renderContactInfo = (userProfileData, headerColor) => {
        if (!userProfileData) return null;

        return React.createElement(
            'div',
            { className: 'bg-white rounded-lg shadow-xl p-6 mt-4' },
            React.createElement(
                'div',
                { className: 'flex justify-between items-center' },
                React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, 'Kontaktné údaje'),
                React.createElement('button', {
                    onClick: () => setIsEditContactModalOpen(true),
                    className: 'text-blue-600 hover:text-blue-800 font-medium'
                }, 'Upraviť')
            ),
            React.createElement(
                'div',
                { className: 'mt-4 space-y-2' },
                React.createElement('p', { className: 'text-gray-800 text-lg' },
                    React.createElement('span', { className: 'font-bold' }, 'Meno a priezvisko: '),
                    ` ${userProfileData.firstName || ''} ${userProfileData.lastName || ''}`.trim()
                ),
                React.createElement('p', { className: 'text-gray-800 text-lg' },
                    React.createElement('span', { className: 'font-bold' }, 'E-mailová adresa:'),
                    ` ${userProfileData.email}`
                ),
                (!isUserAdmin && userProfileData.contactPhoneNumber) && React.createElement('p', { className: 'text-gray-800 text-lg' },
                    React.createElement('span', { className: 'font-bold' }, 'Telefónne číslo:'),
                    ` ${formatPhoneNumber(userProfileData.contactPhoneNumber)}`
                ),
                React.createElement(
                    'button',
                    {
                        onClick: () => setIsChangeEmailModalOpen(true),
                        className: 'mt-4 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md shadow-sm hover:bg-red-700'
                    },
                    'Zmeniť e-mailovú adresu'
                )
            )
        );
    };

    const renderBillingAndAddressInfo = (userProfileData) => {
        if (!userProfileData || !userProfileData.billingAddress) return null;

        const { street, city, zipCode, country } = userProfileData.billingAddress;

        return React.createElement(
            'div',
            { className: 'bg-white rounded-lg shadow-xl p-6 mt-4' },
            React.createElement(
                'div',
                { className: 'flex justify-between items-center' },
                React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, 'Fakturačné údaje'),
                React.createElement('button', {
                    onClick: () => setIsEditBillingModal(true),
                    className: 'text-blue-600 hover:text-blue-800 font-medium'
                }, 'Upraviť')
            ),
            React.createElement(
                'div',
                { className: 'mt-4 space-y-2' },
                React.createElement('p', { className: 'text-gray-800 text-lg' },
                    React.createElement('span', { className: 'font-bold' }, 'Adresa:'),
                    ` ${street}, ${city}, ${zipCode}`
                ),
                React.createElement('p', { className: 'text-gray-800 text-lg' },
                    React.createElement('span', { className: 'font-bold' }, 'Štát:'),
                    ` ${country}`
                ),
            )
        );
    };

    useEffect(() => {
        const handleDataUpdated = (event) => {
            const data = event.detail;
            if (data) {
                setUserProfileData(data);
                setIsUserAdmin(data.roles && data.roles.includes('admin'));
                setError(null);
            } else {
                setError('Nepodarilo sa načítať profilové dáta.');
            }
            setLoading(false);
        };

        window.addEventListener('globalDataUpdated', handleDataUpdated);

        // Pre prípad, že dáta sú už načítané pri prvom vykreslení
        if (window.globalUserProfileData) {
            handleDataUpdated({ detail: window.globalUserProfileData });
        } else if (window.isGlobalAuthReady) {
            setLoading(false);
            setError('Používateľské dáta neboli nájdené.');
        }

        return () => {
            window.removeEventListener('globalDataUpdated', handleDataUpdated);
        };
    }, []);

    if (loading) {
        return React.createElement(Loader, null);
    }

    if (error) {
        return React.createElement(ErrorMessage, { message: error });
    }

    const headerColor = getRoleColor(userProfileData?.roles);

    return React.createElement(
        'div',
        { className: 'container mx-auto p-4 md:p-8' },
        React.createElement('div', { className: 'max-w-4xl mx-auto' },
            renderHeader(headerColor),
            React.createElement('div', { className: 'bg-white rounded-b-lg shadow-xl' },
                React.createElement('div', { className: 'p-6' },
                    React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, 'Používateľský profil'),
                    React.createElement('div', { className: 'mt-4 space-y-2' },
                        React.createElement('p', { className: 'text-gray-800 text-lg' },
                            React.createElement('span', { className: 'font-bold' }, 'Meno a priezvisko: '),
                            ` ${userProfileData.firstName || ''} ${userProfileData.lastName || ''}`.trim()
                        ),
                        React.createElement('p', { className: 'text-gray-800 text-lg' },
                            React.createElement('span', { className: 'font-bold' }, 'E-mailová adresa:'),
                            ` ${userProfileData.email}`
                        ),
                        !isUserAdmin && (userProfileData.contactPhoneNumber) && React.createElement('p', { className: 'text-gray-800 text-lg' },
                            React.createElement('span', { className: 'font-bold' }, 'Telefónne číslo:'),
                            ` ${formatPhoneNumber(userProfileData.contactPhoneNumber)}`
                        ),
                    )
                )
            ),
            renderContactInfo(userProfileData, headerColor),
            renderBillingAndAddressInfo(userProfileData)
        ),
        React.createElement(EditContactModal, {
            userProfileData: userProfileData,
            isOpen: isEditContactModalOpen,
            onClose: () => setIsEditContactModalOpen(false),
            isUserAdmin: isUserAdmin
        }),
        React.createElement(EditBillingModal, {
            userProfileData: userProfileData,
            isOpen: isEditBillingModalOpen,
            onClose: () => setIsEditBillingModal(false)
        }),
        React.createElement(ChangeEmailModal, {
            isOpen: isChangeEmailModalOpen,
            onClose: () => setIsChangeEmailModalOpen(false),
            userRoles: userProfileData?.roles
        })
    );
};

// Explicitne sprístupniť komponent globálne
window.MyDataApp = MyDataApp;
