// logged-in-my-data.js
// Tento súbor bol opravený, aby správne spracovával inicializáciu Firebase
// a dynamicky zobrazoval profilové údaje a funkcie pre zmenu e-mailu.

import { doc, onSnapshot, getFirestore, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, EmailAuthProvider, reauthenticateWithCredential, verifyBeforeUpdateEmail, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const { useState, useEffect, useCallback } = React;

/**
 * Komponent PasswordInput pre polia hesla s prepínaním viditeľnosti.
 * Používa sa pre pole aktuálneho hesla v modálnom okne.
 */
const PasswordInput = ({ id, label, value, onChange, placeholder, showPassword, toggleShowPassword, disabled, focusColorClass }) => {
  // SVG ikony pre oko (zobraziť heslo) a preškrtnuté oko (skryť heslo)
  const EyeIcon = React.createElement(
    'svg',
    { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: showPassword ? 'M13.875 18.25a1.5 1.5 0 01-2.75 0' : 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' }),
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: showPassword ? 'M10 12a2 2 0 100-4 2 2 0 000 4z' : 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-.255.836-.615 1.637-1.077 2.394M12 5v.01M15.54 15.54a5 5 0 01-7.08 0M5.071 19.929c-1.424-1.424-1.424-3.743 0-5.167' }),
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: showPassword ? 'M12 12c-1.332 0-2.4-1.068-2.4-2.4a2.4 2.4 0 012.4-2.4c1.332 0 2.4 1.068 2.4 2.4 0 1.332-1.068 2.4-2.4 2.4z' : 'M12 18s-4-6-4-6-4 6-4 6' })
  );
  
  const EyeOffIcon = React.createElement(
    'svg',
    { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M13.875 18.25a1.5 1.5 0 01-2.75 0M21 21L3 3M8 8l4 4m6-4l-4 4' }),
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
        required: true,
        disabled: disabled,
        className: `block w-full pr-10 pl-3 py-2 border border-gray-300 rounded-md leading-5 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 ${focusColorClass} focus:border-${focusColorClass} sm:text-sm transition-colors duration-200`
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
 * Modálne okno pre zmenu e-mailovej adresy.
 */
const ChangeEmailModal = ({ show, onClose, userProfileData }) => {
    const [newEmail, setNewEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [emailError, setEmailError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // Resetuje formulár pri otvorení/zatvorení modálu
    useEffect(() => {
        if (!show) {
            setNewEmail('');
            setPassword('');
            setEmailError('');
            setPasswordError('');
            setShowPassword(false);
            setLoading(false);
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

    const isFormValid = newEmail && password && newEmail !== userProfileData.email;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isFormValid) return;

        setLoading(true);
        setEmailError('');
        setPasswordError('');
        
        try {
            const auth = getAuth();
            const user = auth.currentUser;

            if (!user) {
                throw new Error('Používateľ nie je prihlásený.');
            }

            // Krok 1: Re-autentifikácia
            const credential = EmailAuthProvider.credential(user.email, password);
            await reauthenticateWithCredential(user, credential);
            
            // Krok 2: Overenie novej e-mailovej adresy a jej aktualizácia
            await verifyBeforeUpdateEmail(user, newEmail);
            
            // Krok 3: Aktualizácia e-mailu v Firestore
            const db = getFirestore();
            const userDocRef = doc(db, 'users', user.uid);
            await updateDoc(userDocRef, { email: newEmail });
            
            window.showGlobalNotification(`Na Váš nový e-mail ${newEmail} bol odoslaný overovací odkaz. Prosím, kliknite naň pre dokončenie zmeny.`, 'success');
            onClose(); // Zatvorenie modálu po úspešnom odoslaní
        } catch (error) {
            console.error("Chyba pri zmene e-mailu:", error);
            if (error.code === 'auth/wrong-password') {
                setPasswordError('Zadali ste nesprávne heslo. Skúste to prosím znova.');
            } else if (error.code === 'auth/email-already-in-use') {
                setEmailError('Táto e-mailová adresa sa už používa.');
            } else if (error.code === 'auth/requires-recent-login') {
                setPasswordError('Pre túto akciu sa musíte znovu prihlásiť. Prosím, odhláste sa a prihláste znova.');
            } else {
                window.showGlobalNotification(`Chyba pri zmene e-mailu: ${error.message}`, 'error');
            }
        } finally {
            setLoading(false);
        }
    };
    
    // Farba tlačidla
    const buttonColorClass = isFormValid ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500' : 'bg-white text-gray-400 border border-gray-300 cursor-not-allowed';
    const buttonClasses = `w-full flex justify-center py-2 px-4 rounded-md shadow-sm text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${buttonColorClass}`;

    if (!show) return null;

    return React.createElement(
        'div',
        { className: 'fixed inset-0 z-50 overflow-y-auto' },
        React.createElement(
            'div',
            { className: 'flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0' },
            React.createElement('div', { className: 'fixed inset-0 transition-opacity', 'aria-hidden': 'true', onClick: onClose }, React.createElement('div', { className: 'absolute inset-0 bg-gray-500 opacity-75' })),
            React.createElement('span', { className: 'hidden sm:inline-block sm:align-middle sm:h-screen', 'aria-hidden': 'true' }, '​'),
            React.createElement(
                'div',
                {
                    className: 'inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6',
                    role: 'dialog',
                    'aria-modal': 'true',
                    'aria-labelledby': 'modal-headline'
                },
                React.createElement(
                    'div',
                    null,
                    React.createElement(
                        'h3',
                        { className: 'text-lg leading-6 font-medium text-gray-900', id: 'modal-headline' },
                        'Zmeniť e-mailovú adresu'
                    ),
                    React.createElement(
                        'div',
                        { className: 'mt-2' },
                        React.createElement('p', { className: 'text-sm text-gray-500' }, 'Pre dokončenie zmeny e-mailu zadajte svoju novú e-mailovú adresu a aktuálne heslo. Na novú adresu bude odoslaný overovací e-mail.'),
                        React.createElement(
                            'form',
                            { onSubmit: handleSubmit, className: 'mt-4 space-y-4' },
                            React.createElement('div', null,
                                React.createElement(
                                    'label',
                                    { htmlFor: 'new-email', className: 'block text-sm font-medium text-gray-700' },
                                    'Nová e-mailová adresa'
                                ),
                                React.createElement(
                                    'div',
                                    { className: 'mt-1' },
                                    React.createElement('input', {
                                        type: 'email',
                                        id: 'new-email',
                                        value: newEmail,
                                        onChange: handleEmailChange,
                                        required: true,
                                        className: 'appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm',
                                        placeholder: 'novy.email@priklad.sk',
                                        disabled: loading,
                                    })
                                ),
                                emailError && React.createElement('p', { className: 'text-red-500 text-xs italic mt-1' }, emailError)
                            ),
                            React.createElement(PasswordInput, {
                                id: 'current-password-modal',
                                label: 'Aktuálne heslo',
                                value: password,
                                onChange: handlePasswordChange,
                                required: true,
                                placeholder: 'Zadajte svoje aktuálne heslo',
                                disabled: loading,
                                showPassword: showPassword,
                                toggleShowPassword: () => setShowPassword(!showPassword),
                                focusColorClass: 'focus:ring-blue-500 focus:border-blue-500'
                            }),
                            passwordError && React.createElement('p', { className: 'text-red-500 text-xs italic mt-1' }, passwordError),
                            React.createElement(
                                'button',
                                {
                                    type: 'submit',
                                    className: buttonClasses,
                                    disabled: !isFormValid || loading,
                                },
                                loading ? 'Odosielam...' : 'Odoslať overovací e-mail'
                            )
                        )
                    ),
                ),
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
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [showModal, setShowModal] = useState(false);

    // useEffect pre načítanie dát a nastavenie listenrov
    useEffect(() => {
        // Funkcia, ktorá sa spustí, keď je autentifikácia pripravená
        const handleGlobalDataUpdate = (event) => {
            console.log('MyDataApp: Prijatá udalosť "globalDataUpdated".');
            const data = event.detail;
            if (data) {
                setUserProfileData(data);
                setIsAuthReady(true);
                setLoading(false);
            } else {
                setError("Používateľské dáta neboli nájdené.");
                setLoading(false);
                setIsAuthReady(true);
            }
        };

        // Pridáme listener na udalosť z authentication.js
        window.addEventListener('globalDataUpdated', handleGlobalDataUpdate);

        // Skontrolujeme, či sú dáta už dostupné v globálnej premennej
        if (window.globalUserProfileData) {
            handleGlobalDataUpdate({ detail: window.globalUserProfileData });
        } else {
            // Ak nie sú dostupné, čakáme na udalosť
            // A ak ešte nebola inicializovaná autentifikácia, nastavíme to na false
            setIsAuthReady(false);
        }

        // Cleanup funkcia, ktorá odstráni listener
        return () => {
            window.removeEventListener('globalDataUpdated', handleGlobalDataUpdate);
        };
    }, []);

    // useEffect pre nastavenie Firestore listenera po pripravenosti autentifikácie
    useEffect(() => {
        let unsubscribe = () => {};
        if (isAuthReady && window.auth && window.auth.currentUser && window.db) {
            console.log("MyDataApp: Nastavujem Firestore listener pre profilové dáta.");
            const userDocRef = doc(window.db, 'users', window.auth.currentUser.uid);
            
            // Nastavenie onSnapshot listenera na aktuálny profil
            unsubscribe = onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    setUserProfileData({ id: docSnap.id, ...docSnap.data() });
                } else {
                    setError("Profil používateľa nebol nájdený v databáze.");
                }
                setLoading(false);
            }, (err) => {
                console.error("Chyba pri načítaní dát z Firestore:", err);
                setError("Chyba pri načítaní profilových dát.");
                setLoading(false);
            });
        } else if (isAuthReady && !window.auth.currentUser) {
            // Ak je auth pripravené, ale nie je prihlásený používateľ,
            // nastavíme stav na načítanie dokončené
            setLoading(false);
        }

        return () => {
            console.log("MyDataApp: Odstránim Firestore listener.");
            unsubscribe();
        };
    }, [isAuthReady]);


    if (loading) {
        return React.createElement(Loader, null);
    }

    if (error) {
        return React.createElement(ErrorMessage, { message: error });
    }

    // Predpokladáme, že farba hlavičky pre všetkých bude modrá, ak nie je admin.
    const headerColor = userProfileData && userProfileData.role === 'admin' ? 'bg-red-600' : 'bg-blue-600';

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
                    { className: 'flex items-center space-x-2' },
                    React.createElement(
                        'p',
                        { className: 'text-gray-800 text-lg' },
                        React.createElement('span', { className: 'font-bold' }, 'E-mailová adresa:'),
                        ` ${userProfileData.email}`
                    ),
                    React.createElement(
                        'button',
                        {
                            onClick: () => setShowModal(true),
                            className: 'px-3 py-1 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                        },
                        'Zmeniť'
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
    // Renderovanie sa vykoná, ale komponent bude čakať na dáta.
    root.render(React.createElement(MyDataApp, null));
    console.log("logged-in-my-data.js: Aplikácia vykreslená.");
} else {
    console.error("logged-in-my-data.js: HTML element 'root' alebo React/ReactDOM nie sú dostupné.");
}

// Explicitne sprístupníme komponent pre ladenie alebo externé použitie
window.MyDataApp = MyDataApp;
