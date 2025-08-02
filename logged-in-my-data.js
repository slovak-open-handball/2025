// logged-in-my-data.js
// Tento súbor bol upravený, aby bol sám o sebe zodpovedný za načítanie dát,
// čím sa eliminuje závislosť na časovaní udalosti DOMContentLoaded a globalDataUpdated.
// Tiež bol upravený, aby používal overenie e-mailu pred jeho zmenou.

import { doc, onSnapshot, getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, EmailAuthProvider, reauthenticateWithCredential, verifyBeforeUpdateEmail, updateEmail } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";


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
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.082-1.272m6.113-1.074a3 3 0 11-4.838-3.238M15 12a3 3 0 11-6 0 3 3 0 016 0zm-2.067 2.067L22 22M2 2l20 20M12 5c4.477 0 8.268 2.943 9.542 7a9.97 9.97 0 01-1.082 1.272M7.18 10.18a3.001 3.001 0 014.18 4.18' })
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
      { className: 'relative mt-1 rounded-md shadow-sm' },
      React.createElement(
        'input',
        {
          type: showPassword ? 'text' : 'password',
          id: id,
          value: value,
          onChange: onChange,
          placeholder: placeholder,
          disabled: disabled,
          required: true,
          className: 'block w-full rounded-md border-gray-300 pr-10 focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed sm:text-sm'
        }
      ),
      React.createElement(
        'div',
        { className: 'absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer', onClick: toggleShowPassword },
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
 * Pomocný komponent pre zobrazenie chybovej/úspešnej správy.
 * @param {object} props - Vlastnosti komponentu.
 * @param {string} props.message - Správa na zobrazenie.
 * @param {boolean} [props.isSuccess=false] - Ak je true, zobrazí úspešnú správu.
 */
const ErrorMessage = ({ message, isSuccess = false }) => {
    const colorClasses = isSuccess ? 'bg-green-100 border-l-4 border-green-500 text-green-700' : 'bg-red-100 border-l-4 border-red-500 text-red-700';
    const titleText = isSuccess ? 'Úspech' : 'Chyba';

    return React.createElement(
        'div',
        { className: 'flex justify-center pt-16' },
        React.createElement(
            'div',
            { className: `p-8 ${colorClasses} rounded-lg shadow-md` },
            React.createElement('p', { className: 'font-bold' }, titleText),
            React.createElement('p', null, message)
        )
    );
};


/**
 * Hlavný React komponent MyDataApp, ktorý zobrazuje údaje profilu
 * a umožňuje ich zmenu.
 */
const MyDataApp = () => {
    const [userProfileData, setUserProfileData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [password, setPassword] = useState('');
    const [emailError, setEmailError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        const auth = getAuth();
        const db = getFirestore();

        if (!auth || !db) {
            console.error("Firebase Auth alebo Firestore nie je inicializovaný.");
            setError("Chyba pri inicializácii služieb. Skúste prosím neskôr.");
            setLoading(false);
            return;
        }

        const unsubscribeAuth = auth.onAuthStateChanged(user => {
            if (user) {
                // Správna cesta k profilovému dokumentu používateľa na základe vašich pravidiel a štruktúry databázy.
                // Načítanie dát z kolekcie 'users'
                const userDocRef = doc(db, `users/${user.uid}`);
                
                const unsubscribeFirestore = onSnapshot(userDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        setUserProfileData(docSnap.data());
                    } else {
                        // Ak dokument neexistuje, nastavíme email z auth objektu
                        setUserProfileData({ email: user.email });
                    }
                    setLoading(false);
                }, (error) => {
                    console.error("Chyba pri načítaní profilu:", error);
                    setError("Chyba pri načítaní dát profilu. Skúste to prosím neskôr.");
                    setLoading(false);
                });
                return unsubscribeFirestore;
            } else {
                console.log("Používateľ odhlásený.");
                setError("Používateľ nie je prihlásený.");
                setLoading(false);
            }
        });
        
        return () => unsubscribeAuth();
    }, []);

    const handleOpenModal = () => {
        setIsModalOpen(true);
        if (userProfileData && userProfileData.email) {
            setNewEmail(userProfileData.email);
        }
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setNewEmail('');
        setPassword('');
        setEmailError('');
        setPasswordError('');
        setSuccessMessage('');
    };

    const handleNewEmailChange = (event) => {
        setNewEmail(event.target.value);
        if (emailError) setEmailError('');
    };

    const handlePasswordChange = (event) => {
        setPassword(event.target.value);
        if (passwordError) setPasswordError('');
    };

    const validateEmail = (email) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(String(email).toLowerCase());
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setEmailError('');
        setPasswordError('');
        setSuccessMessage('');

        let hasError = false;

        if (!validateEmail(newEmail)) {
            setEmailError('Zadajte platnú e-mailovú adresu.');
            hasError = true;
        }

        if (!password) {
            setPasswordError('Prosím, zadajte svoje aktuálne heslo.');
            hasError = true;
        }

        if (hasError) {
            return;
        }
        
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) {
            setError("Používateľ nie je prihlásený.");
            return;
        }

        if (newEmail === user.email) {
            setEmailError("Nová e-mailová adresa je rovnaká ako súčasná.");
            return;
        }

        setLoading(true);

        try {
            const credential = EmailAuthProvider.credential(user.email, password);
            await reauthenticateWithCredential(user, credential);
            
            // POUŽITIE verifyBeforeUpdateEmail NAMIETO updateEmail
            // Toto odosiela overovací e-mail na novú adresu.
            await verifyBeforeUpdateEmail(user, newEmail);
            
            console.log("Overovací e-mail bol úspešne odoslaný.");
            
            setSuccessMessage("Overovací e-mail bol odoslaný na novú adresu. Prosím, overte ho pre dokončenie zmeny.");
            
            handleCloseModal();
        } catch (error) {
            setLoading(false);
            console.error("Chyba pri zmene e-mailu:", error);
            if (error.code === 'auth/wrong-password') {
                setPasswordError("Nesprávne heslo.");
            } else if (error.code === 'auth/email-already-in-use') {
                setEmailError("Táto e-mailová adresa sa už používa.");
            } else {
                setError(`Chyba: ${error.message}`);
            }
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return React.createElement(Loader, null);
    }

    // Ak je k dispozícii správa o úspechu, zobrazíme ju. Inak zobrazíme chybu, ak existuje.
    if (successMessage) {
        return React.createElement(ErrorMessage, { message: successMessage, isSuccess: true });
    }
    
    if (error) {
        return React.createElement(ErrorMessage, { message: error });
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
                    'div',
                    { className: 'flex items-center justify-between' },
                    React.createElement(
                        'p',
                        { className: 'text-gray-800 text-lg' },
                        React.createElement('span', { className: 'font-bold' }, 'E-mailová adresa:'),
                        ` ${userProfileData.email}`
                    ),
                    React.createElement(
                        'button',
                        { onClick: handleOpenModal, className: 'p-2 text-gray-500 hover:text-blue-600 rounded-full hover:bg-gray-100 transition-colors' },
                        React.createElement(
                            'svg',
                            { className: 'h-6 w-6', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                            React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L15.232 5.232z' })
                        )
                    )
                )
            )
        ),
        isModalOpen && React.createElement(
            'div',
            { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50' },
            React.createElement(
                'div',
                { className: 'relative p-8 bg-white w-96 max-w-sm m-auto flex-col flex rounded-lg shadow-xl' },
                React.createElement(
                    'div',
                    { className: 'flex justify-between items-center pb-3' },
                    React.createElement(
                        'h3',
                        { className: 'text-lg font-bold text-gray-900' },
                        'Zmeniť e-mailovú adresu'
                    ),
                    React.createElement(
                        'button',
                        { onClick: handleCloseModal, className: 'text-gray-400 hover:text-gray-500' },
                        React.createElement(
                            'span',
                            { className: 'sr-only' },
                            'Zatvoriť'
                        ),
                        React.createElement(
                            'svg',
                            { className: 'h-6 w-6', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                            React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M6 18L18 6M6 6l12 12' })
                        )
                    )
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
                                onChange: handleNewEmailChange,
                                className: `mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed sm:text-sm ${emailError ? 'border-red-500' : ''}`,
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
                            className: `w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300 disabled:cursor-not-allowed`,
                            disabled: loading || !newEmail || !password,
                        },
                        loading ? 'Odosielam...' : 'Odoslať overovací e-mail'
                    )
                )
            )
        )
    );
};

// Vykreslíme aplikáciu hneď, ako je DOM pripravený, a komponent sa postará o svoj stav
const rootElement = document.getElementById('root');
if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
    const root = ReactDOM.createRoot(rootElement);
    root.render(React.createElement(MyDataApp, null));
    console.log("logged-in-my-data.js: Aplikácia vykreslená.");
} else {
    console.error("logged-in-my-data.js: HTML element 'root' alebo React/ReactDOM nie sú dostupné.");
}

window.MyDataApp = MyDataApp;
