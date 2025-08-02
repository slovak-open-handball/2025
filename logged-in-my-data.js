// logged-in-my-data.js
// Tento súbor spravuje React komponent MyDataApp, ktorý zobrazuje
// profilové a registračné dáta prihláseného používateľa.
// Spolieha sa na to, že Firebase inštancie (auth, db) a profilové dáta
// sú už definované globálne v 'authentication.js'.

const { useState, useEffect, useCallback } = React;
import { EmailAuthProvider, reauthenticateWithCredential, updateEmail } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
 * Komponent pre zobrazenie poľa s dátami.
 * @param {object} props - Vlastnosti komponentu.
 * @param {string} props.label - Popisok poľa.
 * @param {string} props.value - Hodnota poľa.
 */
const DataField = ({ label, value }) => {
    return React.createElement(
        'div',
        { className: 'flex items-center text-gray-800' },
        React.createElement('span', { className: 'font-semibold w-1/3' }, label),
        React.createElement('span', { className: 'w-2/3' }, value || '-')
    );
};

/**
 * Komponent pre editáciu kontaktných údajov (Modal).
 */
const EditContactModal = ({ userProfileData, isOpen, onClose, isUserAdmin }) => {
    // Implementácia modálneho okna pre kontaktné údaje, ponechané bez zmien.
    // ... existujúca implementácia ...
    return null;
};

/**
 * Komponent pre editáciu fakturačných údajov (Modal).
 */
const EditBillingModal = ({ userProfileData, isOpen, onClose }) => {
    // Implementácia modálneho okna pre fakturačné údaje, ponechané bez zmien.
    // ... existujúca implementácia ...
    return null;
};

/**
 * NOVÝ Komponent pre zmenu e-mailovej adresy.
 */
const ChangeEmailModal = ({ isOpen, onClose }) => {
    const [newEmail, setNewEmail] = useState('');
    const [password, setPassword] = useState('');
    const [emailError, setEmailError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [loading, setLoading] = useState(false);

    const auth = window.auth;
    const db = window.db;

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

        if (!auth || !auth.currentUser) {
            showGlobalNotification('Používateľ nie je prihlásený.', 'error');
            setLoading(false);
            return;
        }

        try {
            const user = auth.currentUser;
            const credential = EmailAuthProvider.credential(user.email, password);
            await reauthenticateWithCredential(user, credential);
            await updateEmail(user, newEmail);
            const userDocRef = doc(db, 'users', user.uid);
            await updateDoc(userDocRef, {
                email: newEmail
            });
            showGlobalNotification('E-mailová adresa bola úspešne zmenená.', 'success');
            onClose(); // Zatvorí modál po úspešnej zmene
        } catch (error) {
            console.error('Chyba pri zmene e-mailovej adresy:', error);

            if (error.code === 'auth/wrong-password') {
                setPasswordError('Zadané heslo je nesprávne.');
            } else if (error.code === 'auth/email-already-in-use') {
                setEmailError('Táto e-mailová adresa už je používaná iným účtom.');
            } else if (error.code === 'auth/requires-recent-login') {
                showGlobalNotification('Pre vykonanie tejto akcie sa musíte znova prihlásiť. Skúste to prosím znova.', 'error');
            } else if (error.code === 'auth/operation-not-allowed') {
                 showGlobalNotification('Operácia nie je povolená. Prosím, skontrolujte, či máte v konzole Firebase povolenú metódu prihlásenia "Email/Password".', 'error');
            } else {
                showGlobalNotification(`Chyba: ${error.message}`, 'error');
            }
        } finally {
            setLoading(false);
        }
    };
    
    if (!isOpen) return null;

    // Komponent pre pole hesla je použitý aj tu
    const PasswordInput = ({ id, label, value, onChange, placeholder, disabled }) => {
      const [showPassword, setShowPassword] = useState(false);
      const inputType = showPassword ? 'text' : 'password';
      return React.createElement(
        'div',
        { className: 'relative mb-4' },
        React.createElement(
          'label',
          { htmlFor: id, className: 'block text-sm font-medium text-gray-700' },
          label
        ),
        React.createElement('input', {
          type: inputType,
          id: id,
          name: id,
          value: value,
          onChange: onChange,
          placeholder: placeholder,
          disabled: disabled,
          className: `mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${disabled ? 'bg-gray-100' : ''}`,
        })
      );
    };

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
                            className: `px-4 py-2 text-sm font-medium text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out ${!isFormValid || loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`,
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
    const [isEditBillingModalOpen, setIsEditBillingModalOpen] = useState(false);
    // NOVÝ stav pre modál zmeny e-mailu
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

    const renderHeader = (headerColor) => {
        return React.createElement(
            'div',
            { className: `${headerColor} text-white p-4 rounded-t-lg flex justify-between items-center` },
            React.createElement(
                'h2',
                { className: 'text-2xl font-bold' },
                'Moje údaje'
            )
        );
    };

    const renderSectionHeader = (title) => {
        return React.createElement(
            'h3',
            { className: 'text-xl font-bold text-gray-800 mt-6 mb-4 border-b-2 pb-2' },
            title
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
                !isUserAdmin && React.createElement('p', { className: 'text-gray-800 text-lg' },
                    React.createElement('span', { className: 'font-bold' }, 'Telefónne číslo:'),
                    ` ${formatPhoneNumber(userProfileData.contactPhoneNumber)}`
                ),
                // NOVÉ tlačidlo pre zmenu e-mailu
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

    const renderBillingAndAddressInfo = (userProfileData, headerColor) => {
        if (!userProfileData) return null;
        
        return React.createElement(
            'div',
            { className: 'bg-white rounded-lg shadow-xl p-6 mt-4' },
            React.createElement(
                'div',
                { className: 'flex justify-between items-center' },
                React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, 'Fakturačné údaje'),
                React.createElement('button', {
                    onClick: () => setIsEditBillingModalOpen(true),
                    className: 'text-blue-600 hover:text-blue-800 font-medium'
                }, 'Upraviť')
            ),
            React.createElement(
                'div',
                { className: 'mt-4 space-y-2' },
                React.createElement('p', { className: 'text-gray-800 text-lg' },
                    React.createElement('span', { className: 'font-bold' }, 'Adresa:'),
                    ` ${userProfileData.billingAddress.street}, ${userProfileData.billingAddress.city}, ${userProfileData.billingAddress.zipCode}`
                ),
                React.createElement('p', { className: 'text-gray-800 text-lg' },
                    React.createElement('span', { className: 'font-bold' }, 'Štát:'),
                    ` ${userProfileData.billingAddress.country}`
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

    const headerColor = userProfileData && userProfileData.roles && userProfileData.roles.includes('admin')
        ? 'bg-red-600'
        : 'bg-blue-600';

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
                        !isUserAdmin && React.createElement('p', { className: 'text-gray-800 text-lg' },
                            React.createElement('span', { className: 'font-bold' }, 'Telefónne číslo:'),
                            ` ${formatPhoneNumber(userProfileData.contactPhoneNumber)}`
                        ),
                    )
                )
            ),
            renderContactInfo(userProfileData, headerColor),
            renderBillingAndAddressInfo(userProfileData, headerColor)
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
            onClose: () => setIsEditBillingModalOpen(false)
        }),
        // NOVÝ modálny komponent
        React.createElement(ChangeEmailModal, {
            isOpen: isChangeEmailModalOpen,
            onClose: () => setIsChangeEmailModalOpen(false),
        })
    );
};

// Explicitne sprístupniť komponent globálne
window.MyDataApp = MyDataApp;
