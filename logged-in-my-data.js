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
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 .96-3.13 3.493-5.594 6.326-6.815M21.75 12C20.476 7.943 16.685 5 12 5c-.99 0-1.95.147-2.875.432M10.125 15a3 3 0 10-4.24-4.24m4.24 4.24L10.125 15z' }),
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' }),
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' })
  );
  
  const icon = showPassword ? EyeOffIcon : EyeIcon;

  return React.createElement(
    'div',
    { className: 'relative' },
    React.createElement(
      'label',
      { htmlFor: id, className: 'sr-only' },
      label
    ),
    React.createElement(
      'input',
      {
        id: id,
        name: id,
        type: showPassword ? 'text' : 'password',
        required: true,
        value: value,
        onChange: onChange,
        disabled: disabled,
        placeholder: placeholder,
        className: `block w-full rounded-md border-0 py-1.5 pr-10 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset ${focusColorClass} sm:text-sm sm:leading-6 disabled:bg-gray-50 disabled:text-gray-500`
      }
    ),
    React.createElement(
      'div',
      {
        className: 'absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer',
        onClick: toggleShowPassword
      },
      icon
    )
  );
};

/**
 * Komponent pre zobrazenie animovaného načítania.
 */
const Loader = ({ className = "text-white" }) => {
    return React.createElement(
        'svg',
        { className: `animate-spin h-5 w-5 ${className}`, xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24' },
        React.createElement('circle', { className: 'opacity-25', cx: '12', cy: '12', r: '10', stroke: 'currentColor', strokeWidth: '4' }),
        React.createElement('path', { className: 'opacity-75', fill: 'currentColor', d: 'M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z' })
    );
};

const NotificationPopup = ({ message, type, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      if (onClose) onClose();
    }, 5000); // Skryť po 5 sekundách

    return () => clearTimeout(timer);
  }, [onClose]);

  if (!isVisible) return null;

  const bgColor = type === 'error' ? 'bg-red-500' : 'bg-green-500';

  return React.createElement(
    'div',
    {
      className: `fixed bottom-4 right-4 p-4 rounded-lg text-white shadow-lg transition-opacity duration-300 ${bgColor}`,
      style: { opacity: isVisible ? 1 : 0, transition: 'opacity 0.5s ease-in-out' }
    },
    React.createElement('p', null, message)
  );
};

/**
 * Hlavná React aplikácia pre stránku Moja zóna.
 * Spravuje stav, zobrazuje používateľské dáta a formulár na zmenu e-mailu.
 */
const MyDataApp = () => {
    const [user, setUser] = useState(null);
    const [newEmail, setNewEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [emailError, setEmailError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [notification, setNotification] = useState(null);
    const [roleColor, setRoleColor] = useState('bg-blue-600');
    const [buttonColorClass, setButtonColorClass] = useState('bg-blue-600 hover:bg-blue-700 focus:ring-blue-500');

    const focusColorClass = buttonColorClass.replace('bg-', 'focus:ring-');

    // Funkcia na zobrazenie notifikácie
    const showNotification = (message, type = 'success') => {
        setNotification({ message, type });
    };

    // Funkcia na zatvorenie notifikácie
    const closeNotification = () => {
        setNotification(null);
    };

    useEffect(() => {
        const auth = typeof window !== 'undefined' ? window.auth : null;
        if (!auth) {
            console.error("Firebase Auth nie je inicializované.");
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                const db = typeof window !== 'undefined' ? window.db : null;
                if (db) {
                    const userDocRef = doc(db, "users", currentUser.uid);
                    onSnapshot(userDocRef, (docSnap) => {
                        if (docSnap.exists()) {
                            const userData = docSnap.data();
                            setUser({ uid: currentUser.uid, ...userData });
                            setNewEmail(userData.email);

                            // Dynamicky nastaviť farbu podľa roly
                            let colorClass = 'bg-blue-600';
                            switch (userData.role) {
                                case 'admin':
                                    colorClass = 'bg-red-600';
                                    break;
                                case 'organizer':
                                    colorClass = 'bg-indigo-600';
                                    break;
                                case 'trainer':
                                    colorClass = 'bg-green-600';
                                    break;
                                default:
                                    colorClass = 'bg-blue-600';
                                    break;
                            }
                            setRoleColor(colorClass);
                            setButtonColorClass(colorClass.replace('bg-', 'bg-') + ' hover:' + colorClass.replace('bg-', 'bg-').replace('600', '700') + ' focus:ring-' + colorClass.replace('bg-', '').replace('600', '500'));
                        } else {
                            console.log("Dáta používateľa nenájdené vo Firestore.");
                        }
                    });
                } else {
                    console.error("Firestore nie je inicializované.");
                }
            } else {
                console.log("Používateľ nie je prihlásený.");
                setUser(null);
                setNewEmail('');
            }
        });

        return () => unsubscribe();
    }, []);

    const handleEmailChange = (e) => {
        setNewEmail(e.target.value);
    };

    const handlePasswordChange = (e) => {
        setPassword(e.target.value);
    };

    const toggleShowPassword = () => {
        setShowPassword(!showPassword);
    };

    const handleEmailUpdate = async (e) => {
        e.preventDefault();
        setEmailError('');
        setPasswordError('');
        setLoading(true);
    
        const auth = getAuth();
        const currentUser = auth.currentUser;
        
        if (!currentUser) {
            setEmailError("Používateľ nie je prihlásený.");
            setLoading(false);
            return;
        }

        if (newEmail === user.email) {
            setEmailError("Nový e-mail je rovnaký ako starý.");
            setLoading(false);
            return;
        }
    
        try {
            // Re-autentifikácia používateľa
            const credential = EmailAuthProvider.credential(user.email, password);
            await reauthenticateWithCredential(currentUser, credential);
            
            // Odoslanie overovacieho e-mailu na novú adresu
            await verifyBeforeUpdateEmail(currentUser, newEmail);

            // Aktualizácia e-mailu vo Firestore
            const db = getFirestore();
            const userDocRef = doc(db, "users", currentUser.uid);
            await updateDoc(userDocRef, {
                email: newEmail,
                email_verified: false, // Nastaviť na false, kým sa overí
                updatedAt: new Date().toISOString()
            });

            showNotification('Overovací e-mail bol úspešne odoslaný. Skontrolujte si schránku a potvrďte zmenu.', 'success');
            setNewEmail('');
            setPassword('');
        } catch (error) {
            console.error("Chyba pri zmene e-mailu:", error);
            if (error.code === 'auth/wrong-password') {
                setPasswordError('Nesprávne heslo. Skúste to znova.');
            } else if (error.code === 'auth/invalid-email') {
                setEmailError('Neplatný formát e-mailu.');
            } else if (error.code === 'auth/email-already-in-use') {
                setEmailError('Táto e-mailová adresa sa už používa iným účtom.');
            } else if (error.code === 'auth/requires-recent-login') {
                setPasswordError('Pre túto akciu je potrebné sa nedávno prihlásiť. Skúste to prosím znova.');
            } else {
                showNotification(`Chyba pri zmene e-mailu: ${error.message}`, 'error');
            }
        } finally {
            setLoading(false);
        }
    };
    

    if (!user) {
        return React.createElement(
            'div',
            { className: 'flex justify-center items-center h-screen' },
            React.createElement(Loader, { className: 'text-gray-600' })
        );
    }
    
    return React.createElement(
        'div',
        { className: 'min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4' },
        notification && React.createElement(NotificationPopup, { ...notification, onClose: closeNotification }),
        React.createElement(
            'div',
            { className: 'w-full max-w-2xl bg-white shadow-xl rounded-lg overflow-hidden' },
            React.createElement(
                'div',
                { className: `p-8 text-center text-white ${roleColor}` },
                React.createElement(
                    'h1',
                    { className: 'text-3xl font-bold' },
                    'Moje dáta a profil'
                ),
                React.createElement(
                    'p',
                    { className: 'mt-2 text-lg' },
                    `Vitajte, ${user.firstName} ${user.lastName}!`
                )
            ),
            React.createElement(
                'div',
                { className: 'p-8 space-y-6' },
                React.createElement(
                    'div',
                    null,
                    React.createElement(
                        'h2',
                        { className: 'text-xl font-semibold text-gray-800' },
                        'Profil'
                    ),
                    React.createElement(
                        'div',
                        { className: 'mt-4 border-t border-gray-200 pt-4' },
                        React.createElement(
                            'dl',
                            { className: 'divide-y divide-gray-100' },
                            React.createElement(
                                'div',
                                { className: 'px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0' },
                                React.createElement(
                                    'dt',
                                    { className: 'text-sm font-medium leading-6 text-gray-900' },
                                    'E-mailová adresa'
                                ),
                                React.createElement(
                                    'dd',
                                    { className: 'mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0' },
                                    user.email
                                )
                            ),
                            React.createElement(
                                'div',
                                { className: 'px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0' },
                                React.createElement(
                                    'dt',
                                    { className: 'text-sm font-medium leading-6 text-gray-900' },
                                    'Rola'
                                ),
                                React.createElement(
                                    'dd',
                                    { className: 'mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0 capitalize' },
                                    user.role || 'Používateľ'
                                )
                            ),
                            React.createElement(
                                'div',
                                { className: 'px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0' },
                                React.createElement(
                                    'dt',
                                    { className: 'text-sm font-medium leading-6 text-gray-900' },
                                    'UID'
                                ),
                                React.createElement(
                                    'dd',
                                    { className: 'mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0' },
                                    user.uid
                                )
                            ),
                        )
                    )
                ),
                React.createElement(
                    'form',
                    { onSubmit: handleEmailUpdate, className: 'space-y-6' },
                    React.createElement(
                        'div',
                        { className: 'mt-4' },
                        React.createElement(
                            'label',
                            { htmlFor: 'newEmail', className: 'block text-sm font-medium leading-6 text-gray-900' },
                            'Zmeniť e-mail'
                        ),
                        React.createElement(
                            'div',
                            { className: 'mt-2' },
                            React.createElement('input', {
                                id: 'newEmail',
                                name: 'newEmail',
                                type: 'email',
                                autoComplete: 'email',
                                required: true,
                                value: newEmail,
                                onChange: handleEmailChange,
                                placeholder: 'Zadajte nový e-mail',
                                className: `block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset ${focusColorClass} sm:text-sm sm:leading-6`
                            })
                        ),
                        React.createElement(
                            'p',
                            { className: 'text-red-500 text-xs italic mt-1' },
                            emailError
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'mt-4' },
                        React.createElement(
                            'label',
                            { htmlFor: 'password', className: 'block text-sm font-medium leading-6 text-gray-900' },
                            'Aktuálne heslo pre overenie'
                        ),
                        React.createElement(
                            'div',
                            { className: 'mt-2' },
                            React.createElement(PasswordInput, {
                                id: 'password',
                                label: 'Aktuálne heslo',
                                value: password,
                                onChange: handlePasswordChange,
                                placeholder: 'Zadajte vaše aktuálne heslo',
                                showPassword: showPassword,
                                toggleShowPassword: toggleShowPassword,
                                disabled: loading,
                                focusColorClass: focusColorClass
                            })
                        ),
                        React.createElement(
                            'p',
                            { className: 'text-red-500 text-xs italic mt-1' },
                            passwordError
                        )
                    ),
                    React.createElement(
                        'button',
                        {
                            type: 'submit',
                            className: `w-full flex justify-center py-2 px-4 rounded-md shadow-sm text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 \n                            ${
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
