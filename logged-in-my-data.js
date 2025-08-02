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
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.274-4.057 5.064-7 9.542-7 1.488 0 2.942.31 4.257.875M16 12a4 4 0 11-8 0 4 4 0 018 0z' }),
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M16 12a4 4 0 01-4 4m4-4a4 4 0 00-4-4m4 4h4m-4 0a4 4 0 01-4-4m4 4v4m-4 0a4 4 0 01-4-4m4 4a4 4 0 004-4m-4 4h-4' }),
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' })
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
            React.createElement(
                'input',
                {
                    type: showPassword ? 'text' : 'password',
                    id: id,
                    name: id,
                    value: value,
                    onChange: onChange,
                    disabled: disabled,
                    placeholder: placeholder,
                    required: true,
                    className: 'appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-150 ease-in-out'
                }
            ),
            React.createElement(
                'div',
                { className: 'absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 cursor-pointer', onClick: toggleShowPassword },
                showPassword ? EyeOffIcon : EyeIcon
            )
        )
    );
};

/**
 * Komponent pre zobrazenie notifikácie v modálnom okne.
 */
const NotificationModal = ({ show, onClose, message, type = 'success' }) => {
  if (!show) return null;

  let bgColor, textColor, borderColor, icon;
  
  // Priradíme farby na základe typu notifikácie
  if (type === 'success') {
    bgColor = 'bg-green-100';
    textColor = 'text-green-700';
    borderColor = 'border-green-400';
    icon = React.createElement(
      'svg', { className: 'h-6 w-6 text-green-600', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
      React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' })
    );
  } else { // type === 'error'
    bgColor = 'bg-red-100';
    textColor = 'text-red-700';
    borderColor = 'border-red-400';
    icon = React.createElement(
      'svg', { className: 'h-6 w-6 text-red-600', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
      React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z' })
    );
  }

  return React.createElement(
    'div',
    { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center z-50' },
    React.createElement(
      'div',
      { className: `p-8 max-w-lg mx-auto ${bgColor} rounded-lg shadow-xl border-t-4 ${borderColor}` },
      React.createElement(
        'div',
        { className: 'flex items-center' },
        React.createElement('div', { className: 'flex-shrink-0' }, icon),
        React.createElement('div', { className: 'ml-3' }, React.createElement('p', { className: `text-sm leading-5 font-medium ${textColor}` }, message))
      ),
      React.createElement(
        'div',
        { className: 'mt-4 text-center' },
        React.createElement(
          'button',
          {
            onClick: onClose,
            className: 'inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out'
          },
          'Zatvoriť'
        )
      )
    )
  );
};

/**
 * Komponent pre modálne okno na zmenu e-mailu.
 */
const ChangeEmailModal = ({ show, onClose, userProfileData }) => {
    const [newEmail, setNewEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNotification, setShowNotification] = useState(false);
    const [notificationMessage, setNotificationMessage] = useState('');
    const [notificationType, setNotificationType] = useState('success');

    useEffect(() => {
        if (!show) {
            setNewEmail('');
            setPassword('');
        }
    }, [show]);

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const auth = getAuth();
            const user = auth.currentUser;
            const credential = EmailAuthProvider.credential(user.email, password);
            
            // Re-autentifikácia používateľa
            await reauthenticateWithCredential(user, credential);
            
            // Verifikácia a aktualizácia e-mailu
            await verifyBeforeUpdateEmail(user, newEmail);

            setNotificationMessage('Overovací e-mail bol odoslaný. Prosím, skontrolujte si e-mailovú schránku pre dokončenie zmeny.');
            setNotificationType('success');
            setShowNotification(true);
            onClose();

        } catch (error) {
            console.error("Chyba pri zmene e-mailu:", error);
            let errorMessage = 'Vyskytla sa chyba pri zmene e-mailu. Skúste to prosím neskôr.';
            if (error.code === 'auth/wrong-password') {
                errorMessage = 'Zadali ste nesprávne heslo. Skúste to znova.';
            } else if (error.code === 'auth/requires-recent-login') {
                errorMessage = 'Pre túto akciu je potrebné sa znova prihlásiť. Prosím, odhláste sa a opäť prihláste.';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Zadaná e-mailová adresa má neplatný formát.';
            } else if (error.code === 'auth/email-already-in-use') {
                errorMessage = 'Táto e-mailová adresa sa už používa iným účtom.';
            }
            
            setNotificationMessage(errorMessage);
            setNotificationType('error');
            setShowNotification(true);
        } finally {
            setLoading(false);
        }
    };
    
    // Zatvorenie notifikačného modálu
    const handleCloseNotification = () => {
        setShowNotification(false);
    };

    if (!show) return null;

    const isFormValid = newEmail && password;
    const buttonClasses = `w-full flex justify-center py-2 px-4 rounded-md shadow-sm text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 
                           ${isFormValid ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`;

    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center z-50' },
        React.createElement(
            'div',
            { className: 'bg-white p-8 rounded-xl shadow-lg w-full max-w-md mx-4' },
            React.createElement(
                'h3',
                { className: 'text-2xl font-bold mb-6 text-gray-800 text-center' },
                'Zmeniť e-mailovú adresu'
            ),
            React.createElement(
                'form',
                { onSubmit: handleFormSubmit },
                React.createElement(
                    'div',
                    { className: 'mb-4' },
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
                            name: 'new-email',
                            value: newEmail,
                            onChange: (e) => setNewEmail(e.target.value),
                            placeholder: 'Zadajte novú e-mailovú adresu',
                            required: true,
                            disabled: loading,
                            className: 'mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-150 ease-in-out'
                        }
                    )
                ),
                React.createElement(PasswordInput, {
                    id: 'current-password-change-email',
                    label: 'Aktuálne heslo',
                    value: password,
                    onChange: (e) => setPassword(e.target.value),
                    placeholder: 'Zadajte svoje aktuálne heslo',
                    disabled: loading,
                    showPassword: showCurrentPassword,
                    toggleShowPassword: () => setShowCurrentPassword(!showCurrentPassword)
                }),
                React.createElement(
                    'div',
                    { className: 'flex justify-end space-x-4 mt-6' },
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: onClose,
                            className: 'inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out'
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            type: 'submit',
                            className: buttonClasses,
                            disabled: loading || !isFormValid
                        },
                        loading ? 'Odosielam...' : 'Uložiť zmeny'
                    )
                )
            )
        ),
        React.createElement(NotificationModal, {
            show: showNotification,
            onClose: handleCloseNotification,
            message: notificationMessage,
            type: notificationType
        })
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
 * Hlavný React komponent MyDataApp, ktorý zobrazuje profil používateľa a umožňuje zmeniť e-mail.
 */
const MyDataApp = () => {
    const [userProfileData, setUserProfileData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        // Zabezpečíme, že globálne premenné existujú pre prácu s Firebase
        const initializeFirebase = () => {
            if (window.auth && window.db) {
                console.log("logged-in-my-data.js: Firebase Auth a Firestore sú dostupné.");
                
                // Nastavíme listener pre zmeny v autentifikácii
                const auth = window.auth;
                onAuthStateChanged(auth, (user) => {
                    if (user) {
                        const db = window.db;
                        const userRef = doc(db, "users", user.uid);
                        
                        // Ak máme ID používateľa, počúvame zmeny v jeho dokumente
                        const unsubscribe = onSnapshot(userRef, (docSnap) => {
                            if (docSnap.exists()) {
                                const data = docSnap.data();
                                setUserProfileData({ ...data, email: user.email }); // Pripojíme aktuálny e-mail z Auth
                                console.log("logged-in-my-data.js: Profilové dáta aktualizované z Firestore.");
                            } else {
                                console.log("logged-in-my-data.js: Profil používateľa nebol nájdený v databáze.");
                                setUserProfileData({ email: user.email }); // Zobrazíme aspoň e-mail
                            }
                            setLoading(false);
                        }, (error) => {
                            console.error("logged-in-my-data.js: Chyba pri načítaní dát:", error);
                            setError('Chyba pri načítaní profilových dát.');
                            setLoading(false);
                        });
                        
                        // Vrátime funkciu na odhlásenie listenera
                        return () => unsubscribe();
                    } else {
                        // Používateľ je odhlásený, resetujeme stav
                        setUserProfileData(null);
                        setLoading(false);
                        console.log("logged-in-my-data.js: Používateľ je odhlásený.");
                    }
                });
                
            } else {
                console.error("logged-in-my-data.js: Firebase Auth alebo Firestore nie sú inicializované. Skúšam znova...");
                // Ak ešte nie sú inicializované, počkáme na udalosť a skúsime to znova
                window.addEventListener('globalDataUpdated', initializeFirebase, { once: true });
                setLoading(true); // Zatiaľ ostávame v stave načítavania
            }
        };

        // Spustíme inicializáciu
        initializeFirebase();

        // Očistíme event listener, ak komponent unmountuje
        return () => {
            // Unsubscribe sa volá už v onAuthStateChanged listeneri
        };
    }, []);

    if (loading) {
        return React.createElement(Loader, null);
    }

    if (error) {
        return React.createElement(ErrorMessage, { message: error });
    }

    if (!userProfileData) {
        return React.createElement(ErrorMessage, { message: "Používateľ nie je prihlásený." });
    }

    const headerColor = 'bg-blue-600';

    return React.createElement(
        // Zmena: Použitie triedy 'max-w-xl' na obmedzenie šírky kontajnera
        'div',
        { className: 'container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-xl' },
        React.createElement(
            'div',
            { className: 'bg-white p-8 rounded-xl shadow-lg mt-8' },
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
                        className: 'bg-white text-blue-600 font-semibold py-2 px-4 rounded-full shadow-md hover:bg-blue-100 transition-colors duration-200'
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
                    ` ${userProfileData.firstName || 'Nezadané'}`
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg' },
                    React.createElement('span', { className: 'font-bold' }, 'Priezvisko:'),
                    ` ${userProfileData.lastName || 'Nezadané'}`
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
