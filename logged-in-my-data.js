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
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M13.875 18.25A10.015 10.015 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.274-4.057 5.064-7 9.542-7a9.958 9.958 0 011.875.148M16 12a4 4 0 11-8 0 4 4 0 018 0z' }),
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' }),
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M13.952 13.952a2 2 0 012.828 0' })
  );
  
  return React.createElement(
    'div',
    { className: 'mt-1 relative rounded-md shadow-sm' },
    React.createElement(
      'input',
      {
        id: id,
        name: id,
        type: showPassword ? 'text' : 'password',
        value: value,
        onChange: onChange,
        disabled: disabled,
        placeholder: placeholder,
        autoComplete: id,
        required: true,
        className: `block w-full rounded-md border-gray-300 pl-3 pr-10 py-2 sm:text-sm ${focusColorClass} disabled:bg-gray-100 disabled:text-gray-500`
      }
    ),
    React.createElement(
      'div',
      { className: 'absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 cursor-pointer', onClick: toggleShowPassword },
      showPassword ? EyeOffIcon : EyeIcon
    )
  );
};


const MyDataApp = () => {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [password, setPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [buttonColorClass, setButtonColorClass] = useState('bg-blue-600 hover:bg-blue-700 focus:ring-blue-500');

    const toggleShowPassword = () => {
        setShowPassword(!showPassword);
    };

    const focusColorClass = `focus:border-blue-500 focus:ring-blue-500`;

    useEffect(() => {
        // Inicializácia Firebase a nastavenie listenera
        const auth = getAuth();
        const db = getFirestore();
        let unsubscribe = () => {};

        const authUnsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                const userDocRef = doc(db, 'users', currentUser.uid);
                // Nastavenie onSnapshot listenera pre reálne dáta
                unsubscribe = onSnapshot(userDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        setProfile(docSnap.data());
                    } else {
                        console.log("No such document!");
                    }
                    setLoading(false);
                }, (error) => {
                    console.error("Error getting user profile:", error);
                    setLoading(false);
                });
            } else {
                setUser(null);
                setProfile(null);
                setLoading(false);
            }
        });

        // Cleanup function pre odhlásenie listenerov pri unmountovaní komponentu
        return () => {
            authUnsubscribe();
            unsubscribe();
        };
    }, []);

    useEffect(() => {
        if (profile) {
            switch (profile.role) {
                case 'admin':
                    setButtonColorClass('bg-red-600 hover:bg-red-700 focus:ring-red-500');
                    break;
                case 'hall':
                    setButtonColorClass('bg-green-600 hover:bg-green-700 focus:ring-green-500');
                    break;
                default:
                    setButtonColorClass('bg-blue-600 hover:bg-blue-700 focus:ring-blue-500');
                    break;
            }
        }
    }, [profile]);

    const handleEmailUpdate = async (event) => {
        event.preventDefault();
        setPasswordError('');

        if (!user || !password || !newEmail) {
            setPasswordError('Prosím, zadajte heslo a novú e-mailovú adresu.');
            return;
        }

        try {
            // Re-autentifikácia
            const credential = EmailAuthProvider.credential(user.email, password);
            await reauthenticateWithCredential(user, credential);

            // Overenie a odoslanie overovacieho e-mailu
            await verifyBeforeUpdateEmail(user, newEmail);
            
            showGlobalNotification('Odoslali sme Vám overovací e-mail. Prosím, overte zmenu e-mailovej adresy kliknutím na odkaz v e-maili.', 'success');

            // Zatvorenie modálneho okna po odoslaní
            setIsModalOpen(false);
            setPassword('');
            setNewEmail('');

        } catch (error) {
            console.error("Chyba pri aktualizácii e-mailu:", error);
            if (error.code === 'auth/wrong-password') {
                setPasswordError('Zadané heslo je nesprávne.');
            } else {
                setPasswordError('Nastala chyba pri aktualizácii e-mailu. Skúste to prosím neskôr.');
            }
        }
    };
    
    // Zobrazí loading stav alebo upozornenie, ak dáta nie sú dostupné
    if (loading) {
        return React.createElement('div', { className: 'flex justify-center items-center h-64' },
            React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900' })
        );
    }
    
    if (!user || !profile) {
        return React.createElement('div', { className: 'text-center py-10' },
            React.createElement('h1', { className: 'text-2xl font-bold text-gray-800' }, 'Prístup odmietnutý'),
            React.createElement('p', { className: 'text-gray-600 mt-2' }, 'Pre prístup na túto stránku sa prosím prihláste.')
        );
    }

    return React.createElement(
        'div',
        { className: 'bg-white shadow-xl rounded-lg overflow-hidden' },
        React.createElement(
            'div',
            { className: `p-4 border-b ${buttonColorClass}` },
            React.createElement(
                'h2',
                { className: 'text-2xl font-bold text-white' },
                'Moja zóna'
            )
        ),
        React.createElement(
            'div',
            { className: 'p-6 space-y-4' },
            React.createElement(
                'div',
                { className: 'flex items-center space-x-4' },
                React.createElement(
                    'svg',
                    { className: 'h-12 w-12 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M5.121 17.804A13.938 13.938 0 0112 16c2.5 0 4.847.653 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 0a9 9 0 11-18 0 9 9 0 0118 0z' })
                ),
                React.createElement(
                    'div',
                    null,
                    React.createElement(
                        'h3',
                        { className: 'text-lg font-semibold' },
                        profile.name || 'Názov nebol zadaný'
                    ),
                    React.createElement(
                        'p',
                        { className: 'text-gray-600' },
                        user.email
                    ),
                    React.createElement(
                        'p',
                        { className: `text-sm font-medium ${
                            profile.role === 'admin' ? 'text-red-600' :
                            profile.role === 'hall' ? 'text-green-600' : 'text-blue-600'
                        }` },
                        'Rola: ',
                        profile.role || 'Používateľ'
                    )
                )
            ),
            React.createElement(
                'button',
                { onClick: () => setIsModalOpen(true), className: `w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${buttonColorClass} focus:outline-none focus:ring-2 focus:ring-offset-2 ` },
                'Zmeniť e-mail'
            ),
            // Modálne okno pre zmenu e-mailu
            isModalOpen && React.createElement(
                'div',
                { className: 'fixed inset-0 z-50 overflow-y-auto', 'aria-labelledby': 'modal-title', role: 'dialog', 'aria-modal': 'true' },
                React.createElement(
                    'div',
                    { className: 'flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0' },
                    // Pozadie
                    React.createElement('div', { className: 'fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity', 'aria-hidden': 'true' }),

                    // Stredový obal
                    React.createElement(
                        'span',
                        { className: 'hidden sm:inline-block sm:align-middle sm:h-screen', 'aria-hidden': 'true' },
                        '&#8203;'
                    ),

                    // Modálne okno samotné
                    React.createElement(
                        'div',
                        { className: 'inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full' },
                        React.createElement(
                            'div',
                            { className: 'bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4' },
                            React.createElement(
                                'div',
                                { className: 'sm:flex sm:items-start' },
                                React.createElement(
                                    'div',
                                    { className: 'mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left' },
                                    React.createElement(
                                        'h3',
                                        { className: 'text-lg leading-6 font-medium text-gray-900', id: 'modal-title' },
                                        'Zmeniť e-mail'
                                    ),
                                    React.createElement(
                                        'div',
                                        { className: 'mt-2' },
                                        React.createElement(
                                            'form',
                                            { onSubmit: handleEmailUpdate, className: 'space-y-4' },
                                            React.createElement(
                                                'div',
                                                null,
                                                React.createElement('label', { htmlFor: 'new-email', className: 'block text-sm font-medium text-gray-700' }, 'Nový e-mail'),
                                                React.createElement(
                                                    'div',
                                                    { className: 'mt-1' },
                                                    React.createElement('input', { id: 'new-email', name: 'new-email', type: 'email', value: newEmail, onChange: (e) => setNewEmail(e.target.value), autoComplete: 'email', required: true, className: `appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none sm:text-sm ${focusColorClass}` })
                                                )
                                            ),
                                            React.createElement(
                                                'div',
                                                null,
                                                React.createElement('label', { htmlFor: 'password', className: 'block text-sm font-medium text-gray-700' }, 'Aktuálne heslo'),
                                                React.createElement(PasswordInput, { id: 'password', value: password, onChange: (e) => setPassword(e.target.value), placeholder: 'Zadajte heslo', showPassword: showPassword, toggleShowPassword: toggleShowPassword, disabled: false, focusColorClass: focusColorClass }),
                                                passwordError && React.createElement(
                                                    'p',
                                                    { className: 'text-red-500 text-xs italic mt-1' },
                                                    passwordError
                                                )
                                            ),
                                            React.createElement(
                                                'div',
                                                { className: 'flex justify-between items-center space-x-4' },
                                                React.createElement(
                                                    'button',
                                                    {
                                                        type: 'submit',
                                                        className: `flex-1 flex justify-center py-2 px-4 rounded-md shadow-sm text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                                                          (loading || !newEmail || !password) 
                                                            ? `bg-gray-200 text-gray-400 cursor-not-allowed` 
                                                            : `text-white ${buttonColorClass}`
                                                        }`,
                                                        disabled: loading || !newEmail || !password,
                                                    },
                                                    loading ? 'Odosielam...' : 'Odoslať overovací e-mail'
                                                ),
                                                React.createElement(
                                                    'button',
                                                    {
                                                        type: 'button',
                                                        onClick: () => {
                                                            setIsModalOpen(false);
                                                            setPasswordError('');
                                                            setPassword('');
                                                            setNewEmail('');
                                                        },
                                                        className: 'flex-1 justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                                                    },
                                                    'Zrušiť'
                                                )
                                            )
                                        )
                                    )
                                )
                            )
                        )
                    )
                )
            )
        )
    );
};

// Funkcia na zabezpečenie, že aplikácia sa vykreslí iba raz a až po načítaní DOM-u
let isRendered = false; // Nový príznak na zabránenie opakovanému vykresleniu

const renderApp = () => {
    // Ak už bolo vykreslené, nič nerobíme
    if (isRendered) {
        return;
    }

    const rootElement = document.getElementById('root');
    // Kontrola, či element existuje a je stále v dokumente
    if (rootElement && document.body.contains(rootElement) && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
        try {
            // Použitie ReactDOM.createRoot
            const root = ReactDOM.createRoot(rootElement);
            root.render(React.createElement(MyDataApp, null));
            console.log("logged-in-my-data.js: Aplikácia vykreslená.");
            isRendered = true; // Označíme ako vykreslené
        } catch (error) {
            console.error("logged-in-my-data.js: Chyba pri vykreslení aplikácie:", error);
        }
    } else {
        console.error("logged-in-my-data.js: HTML element 'root' alebo React/ReactDOM nie sú dostupné, alebo element bol odstránený.");
    }
};

// Spustenie vykreslenia po načítaní DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderApp);
} else {
    renderApp();
}

// Export pre prípad, že by bol komponent potrebný inde
window.MyDataApp = MyDataApp;
