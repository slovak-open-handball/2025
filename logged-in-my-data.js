// logged-in-my-data.js
// Tento súbor bol upravený, aby vždy synchronizoval e-mailovú adresu v profile používateľa
// s aktuálnou e-mailovou adresou v Firebase Authentication a farba hlavičky sa mení podľa roly.

import { doc, onSnapshot, getFirestore, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, EmailAuthProvider, reauthenticateWithCredential, verifyBeforeUpdateEmail, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const { useState, useEffect } = React;

/**
 * Komponent PasswordInput pre polia hesla s prepínaním viditeľnosti.
 * Používa sa pre pole aktuálneho hesla v modálnom okne.
 */
const PasswordInput = ({ id, label, value, onChange, placeholder, showPassword, toggleShowPassword, disabled, focusColorClass }) => {
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
          autoComplete: "current-password", // Pridané pre lepšiu použiteľnosť
          // Upravené štýly inputu pre rovnakú výšku ako tlačidlo
          className: `block w-full rounded-md border-gray-300 pr-10 shadow-sm disabled:bg-gray-100 disabled:cursor-not-allowed sm:text-sm transition-all duration-200 ease-in-out py-2 px-3 ${focusColorClass}`
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
 * Nový komponent pre pop-up notifikácie.
 * @param {object} props - Vlastnosti komponentu.
 * @param {string} props.message - Správa na zobrazenie.
 * @param {string} props.type - Typ správy ('success' alebo 'error').
 * @param {function} props.onClose - Funkcia na zavretie pop-upu.
 */
const NotificationPopup = ({ message, type, onClose }) => {
  const isSuccess = type === 'success';
  const colorClasses = isSuccess ? 'bg-green-100 border-green-500 text-green-700' : 'bg-red-100 border-red-500 text-red-700';
  const titleText = isSuccess ? 'Úspech' : 'Chyba';

  useEffect(() => {
    // Automaticky zavrieť pop-up po 5 sekundách
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onClose, message]);

  return React.createElement(
    'div',
    { className: `fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-full mx-auto p-4 rounded-xl shadow-lg flex items-start space-x-4 transition-transform duration-300 transform scale-100 border-l-4 ${colorClasses}` },
    React.createElement(
      'div',
      { className: 'flex-shrink-0' },
      isSuccess
        ? React.createElement(
            'svg',
            { className: 'h-6 w-6 text-green-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
            React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M9 12l2 2l4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' })
          )
        : React.createElement(
            'svg',
            { className: 'h-6 w-6 text-red-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
            React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z' })
          )
    ),
    React.createElement(
      'div',
      { className: 'flex-1' },
      React.createElement(
        'p',
        { className: 'text-sm font-medium' },
        titleText
      ),
      React.createElement(
        'p',
        { className: 'mt-1 text-sm' },
        message
      )
    )
  );
};

/**
 * Vráti farbu hlavičky na základe roly používateľa.
 * @param {string} role - Rola používateľa ('admin', 'hall', 'user', atď.).
 * @returns {string} Hexadecimálny kód farby.
 */
const getHeaderColor = (role) => {
    switch (role) {
        case 'admin':
            return '#47b3ff'; // Farba pre admina
        case 'hall':
            return '#b06835'; // Farba pre halu
        case 'user':
            return '#9333EA'; // Farba pre bežného používateľa
        default:
            return '#1D4ED8'; // Predvolená farba (bg-blue-800)
    }
};

/**
 * Vráti Tailwind CSS triedy pre farbu tlačidla na základe roly používateľa.
 * @param {string} role - Rola používateľa ('admin', 'hall', 'user', atď.).
 * @returns {string} Tailwind CSS triedy.
 */
const getButtonColor = (role) => {
    switch (role) {
        case 'admin':
            return 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-500';
        case 'hall':
            return 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500';
        case 'user':
            return 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500';
        default:
            return 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500';
    }
};

/**
 * Vráti Tailwind CSS triedy pre farbu focusu na základe roly používateľa.
 * @param {string} role - Rola používateľa ('admin', 'hall', 'user', atď.).
 * @returns {string} Tailwind CSS triedy.
 */
const getFocusColor = (role) => {
    switch (role) {
        case 'admin':
            return 'focus:ring-blue-500 focus:border-blue-500';
        case 'hall':
            return 'focus:ring-amber-500 focus:border-amber-500';
        case 'user':
            return 'focus:ring-purple-500 focus:border-purple-500';
        default:
            return 'focus:ring-blue-500 focus:border-blue-500';
    }
};


/**
 * Hlavný React komponent MyDataApp, ktorý zobrazuje údaje profilu
 * a umožňuje ich zmenu.
 */
const MyDataApp = () => {
    const [userProfileData, setUserProfileData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [password, setPassword] = useState('');
    const [emailError, setEmailError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [currentAuthEmail, setCurrentAuthEmail] = useState('');
    const [notification, setNotification] = useState({ message: '', type: '', visible: false });

    // Stav pre dynamickú farbu ikony ceruzky
    const [pencilHover, setPencilHover] = useState(false);

    useEffect(() => {
        const auth = getAuth();
        const db = getFirestore();

        if (!auth || !db) {
            console.error("Firebase Auth alebo Firestore nie je inicializovaný.");
            setNotification({ message: "Chyba pri inicializácii služieb. Skúste prosím neskôr.", type: "error", visible: true });
            setLoading(false);
            return;
        }

        const unsubscribeAuth = onAuthStateChanged(auth, user => {
            if (user) {
                setCurrentAuthEmail(user.email);
                const userDocRef = doc(db, `users/${user.uid}`);
                
                const unsubscribeFirestore = onSnapshot(userDocRef, (docSnap) => {
                    const latestAuthEmail = user.email;
                    
                    if (docSnap.exists()) {
                        const firestoreData = docSnap.data();
                        const latestFirestoreEmail = firestoreData.email;

                        if (latestAuthEmail !== latestFirestoreEmail) {
                            console.log("Synchronizujem e-mail: Auth a Firestore sa líšia.");
                            updateDoc(userDocRef, { email: latestAuthEmail })
                                .then(() => console.log("E-mail vo Firestore bol úspešne aktualizovaný."))
                                .catch(e => console.error("Chyba pri aktualizácii e-mailu vo Firestore:", e));
                        }

                        setUserProfileData(firestoreData);
                    } else {
                        setUserProfileData({ email: latestAuthEmail });
                    }
                    setLoading(false);
                }, (error) => {
                    console.error("Chyba pri načítaní profilu:", error);
                    setNotification({ message: "Chyba pri načítaní dát profilu. Skúste to prosím neskôr.", type: "error", visible: true });
                    setLoading(false);
                });
                return unsubscribeFirestore;
            } else {
                console.log("Používateľ odhlásený.");
                setNotification({ message: "Používateľ nie je prihlásený.", type: "error", visible: true });
                setLoading(false);
            }
        });
        
        return () => unsubscribeAuth();
    }, []);

    const handleOpenModal = () => {
        setIsModalOpen(true);
        setNewEmail(''); 
        setPassword(''); // Dôležité: Reset hesla pri otvorení modalu
        setEmailError('');
        setPasswordError('');
        setNotification({ message: '', type: '', visible: false }); // Vymazať predchádzajúce notifikácie
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setNewEmail('');
        setPassword('');
        setEmailError('');
        setPasswordError('');
        setNotification({ message: '', type: '', visible: false });
    };

    // Nová funkcia pre zatvorenie modalu po kliknutí mimo neho
    const handleOverlayClick = (e) => {
      if (e.target === e.currentTarget) {
        handleCloseModal();
      }
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
        setNotification({ message: '', type: '', visible: false });

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
            setNotification({ message: "Používateľ nie je prihlásený.", type: "error", visible: true });
            return;
        }

        if (newEmail === user.email) {
            setEmailError("Nová e-mailová adresa je rovnaká ako súčasná.");
            return;
        }

        setLoading(true);

        try {
            console.log("Pokúšam sa o re-autentifikáciu s heslom...");
            const credential = EmailAuthProvider.credential(user.email, password);
            await reauthenticateWithCredential(user, credential);
            console.log("Re-autentifikácia úspešná.");
            
            await verifyBeforeUpdateEmail(user, newEmail);
            
            console.log("Overovací e-mail bol úspešne odoslaný.");
            
            setNotification({ message: "Overovací e-mail bol odoslaný na novú adresu. Prosím, overte ho pre dokončenie zmeny.", type: "success", visible: true });
            
            handleCloseModal();
        } catch (error) {
            setLoading(false);
            console.error("Chyba pri zmene e-mailu:", error);

            if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
                setNotification({ message: "Nesprávne heslo. Skúste to prosím znova.", type: "error", visible: true });
            } else if (error.code === 'auth/email-already-in-use') {
                setNotification({ message: "Táto e-mailová adresa sa už používa.", type: "error", visible: true });
            } else {
                setNotification({ message: `Chyba: ${error.message}`, type: "error", visible: true });
            }
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return React.createElement(Loader, null);
    }
    
    const role = userProfileData?.role || 'default';
    const headerColor = getHeaderColor(role);
    const buttonColorClass = getButtonColor(role);
    const focusColorClass = getFocusColor(role);

    return React.createElement(
        'div',
        { className: 'container mx-auto px-4 sm:px-6 lg:px-8 py-8' },
        notification.visible && React.createElement(NotificationPopup, {
            message: notification.message,
            type: notification.type,
            onClose: () => setNotification({ ...notification, visible: false })
        }),
        React.createElement(
            'div',
            { className: `p-6 shadow-lg rounded-t-xl`, style: { backgroundColor: headerColor } },
            React.createElement(
                'h2',
                { className: 'text-2xl font-bold text-white' },
                'Môj profil'
            )
        ),
        React.createElement(
            'div',
            { className: `bg-white p-8 rounded-b-xl shadow-lg` },
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
                        { 
                          onClick: handleOpenModal, 
                          className: 'p-2 rounded-full hover:bg-gray-100 transition-colors',
                          onMouseEnter: () => setPencilHover(true),
                          onMouseLeave: () => setPencilHover(false),
                        },
                        React.createElement(
                            'svg',
                            { 
                                className: 'h-6 w-6 transition-colors',
                                style: { color: pencilHover ? headerColor : '#6b7280' },
                                fill: 'none', 
                                viewBox: '0 0 24 24', 
                                stroke: 'currentColor' 
                            },
                            React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L15.232 5.232z' })
                        )
                    )
                )
            )
        ),
        isModalOpen && React.createElement(
            'div',
            { 
              className: 'fixed inset-0 bg-gray-600 bg-opacity-75 overflow-y-auto h-full w-full flex items-center justify-center z-40 transition-opacity duration-300',
              onClick: handleOverlayClick, // Pridaný listener pre kliknutie na pozadie
            },
            React.createElement(
                'div',
                { 
                  className: 'relative p-8 bg-white w-full max-w-md m-auto rounded-xl shadow-2xl transition-transform duration-300 transform scale-100',
                  onClick: e => e.stopPropagation(), // Zastaví šírenie udalosti, aby sa modal nezatvoril pri kliknutí do vnútra
                },
                React.createElement(
                    'div',
                    { className: 'flex justify-between items-center pb-4 border-b border-gray-200' },
                    React.createElement(
                        'h3',
                        { className: 'text-2xl font-bold text-gray-900' },
                        'Zmeniť e-mailovú adresu'
                    ),
                    React.createElement(
                        'button',
                        { onClick: handleCloseModal, className: 'text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors' },
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
                    { onSubmit: handleSubmit, className: 'mt-6 space-y-4' },
                    React.createElement(
                        'div',
                        null,
                        React.createElement(
                            'label',
                            { htmlFor: 'current-email', className: 'block text-sm font-medium text-gray-700' },
                            'Aktuálna e-mailová adresa'
                        ),
                        React.createElement(
                            'input',
                            {
                                type: 'email',
                                id: 'current-email',
                                value: currentAuthEmail,
                                disabled: true,
                                className: 'mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-gray-100 text-gray-500 cursor-not-allowed sm:text-sm py-2 px-3'
                            }
                        )
                    ),
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
                                className: `mt-1 block w-full rounded-md border-gray-300 shadow-sm disabled:bg-gray-100 disabled:cursor-not-allowed sm:text-sm transition-all duration-200 ease-in-out py-2 px-3 ${emailError ? 'border-red-500 focus:ring-red-500' : focusColorClass}`,
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
                        focusColorClass: passwordError ? 'border-red-500 focus:ring-red-500' : focusColorClass,
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
        )
    );
};

const rootElement = document.getElementById('root');
if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
    const root = ReactDOM.createRoot(rootElement);
    root.render(React.createElement(MyDataApp, null));
    console.log("logged-in-my-data.js: Aplikácia vykreslená.");
} else {
    console.error("logged-in-my-data.js: HTML element 'root' alebo React/ReactDOM nie sú dostupné.");
}

window.MyDataApp = MyDataApp;
