// logged-in-my-data.js
// Tento súbor bol upravený, aby vždy synchronizoval e-mailovú adresu v profile používateľa
// s aktuálnou e-mailovou adresou v Firebase Authentication a farba hlavičky sa mení podľa roly.
// Kód bol refaktorovaný, aby bol odolnejší voči DOM chybám a race conditions
// pri načítavaní dát.

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
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M13.875 18.04C15.175 17.587 16.38 16.892 17.472 16.03a11.95 11.95 0 003.545-4.032m-8.545 4.032a3 3 0 11-6 0 3 3 0 016 0zm-6-4.032a11.95 11.95 0 013.545-4.032m-8.545 4.032L2.458 12C3.732 7.943 7.523 5 12 5c1.472 0 2.894.27 4.248.775M4.887 9.113A11.95 11.95 0 0112 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7a11.95 11.95 0 01-7.113-2.887z' }),
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M12 12V1M12 23V12' })
    );

    return React.createElement(
        'div',
        { className: 'relative' },
        React.createElement(
            'input',
            {
                type: showPassword ? 'text' : 'password',
                id: id,
                name: id,
                value: value,
                onChange: onChange,
                placeholder: placeholder,
                disabled: disabled,
                className: `w-full px-3 py-2 border rounded-md shadow-sm transition-colors duration-200 focus:outline-none focus:ring-2 ${focusColorClass} disabled:bg-gray-100 disabled:text-gray-500`
            }
        ),
        React.createElement(
            'button',
            {
                type: 'button',
                onClick: toggleShowPassword,
                className: 'absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5',
                'aria-label': showPassword ? 'Skryť heslo' : 'Zobraziť heslo'
            },
            showPassword ? EyeOffIcon : EyeIcon
        )
    );
};

/**
 * Hlavný komponent aplikácie, ktorý spravuje stav a logiku pre zobrazenie a aktualizáciu používateľských dát.
 */
const MyDataApp = () => {
    const [newEmail, setNewEmail] = useState('');
    const [password, setPassword] = useState('');
    const [emailError, setEmailError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [userEmail, setUserEmail] = useState('');
    const [profileData, setProfileData] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Načítame globálne farby z authentication.js, ktoré závisia od roly používateľa
    const buttonColorClass = window.globalUserProfileData?.role === 'admin' ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500' : 'bg-lime-600 hover:bg-lime-700 focus:ring-lime-500';
    const focusColorClass = window.globalUserProfileData?.role === 'admin' ? 'focus:ring-blue-500 focus:border-blue-500' : 'focus:ring-lime-500 focus:border-lime-500';

    useEffect(() => {
        // Tento listener čaká, kým authentication.js nenačíta dáta o používateľovi.
        // Tým sa zabezpečí, že komponent nezačne pracovať s neexistujúcimi dátami a nespôsobí chyby.
        const handleGlobalDataUpdate = (event) => {
            const userData = event.detail;
            console.log("MyDataApp: Prijatá udalosť globalDataUpdated. Dáta:", userData);

            setIsAuthReady(true);
            if (userData) {
                setProfileData(userData);
                setUserEmail(userData.email);
            } else {
                setProfileData(null);
                setUserEmail('');
            }
        };

        window.addEventListener('globalDataUpdated', handleGlobalDataUpdate);

        // Cleanup funkcia pre event listener
        return () => {
            window.removeEventListener('globalDataUpdated', handleGlobalDataUpdate);
        };
    }, []);

    // Effect pre nastavenie Firestore listenera, ktorý sleduje zmeny v profile používateľa
    useEffect(() => {
        let unsubscribe = () => {};

        // Listener nastavíme len ak je pripravená autentifikácia a existuje userId
        if (isAuthReady && window.db && window.auth?.currentUser?.uid) {
            const userDocRef = doc(window.db, 'profiles', window.auth.currentUser.uid);
            unsubscribe = onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = { id: docSnap.id, ...docSnap.data() };
                    console.log("MyDataApp: Firestore dáta boli aktualizované:", data);
                    setProfileData(data);
                    setUserEmail(data.email);
                } else {
                    console.log("MyDataApp: Dokument používateľa neexistuje v Firestore.");
                    setProfileData(null);
                }
            }, (error) => {
                console.error("MyDataApp: Chyba pri načítaní dát z Firestore:", error);
            });
        }

        // Cleanup funkcia, ktorá sa spustí pri odpojení komponentu, aby sa zrušil listener
        return () => unsubscribe();
    }, [isAuthReady]);


    const toggleShowPassword = () => {
        setShowPassword(!showPassword);
    };

    const openModal = () => {
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setPassword('');
        setEmailError('');
        setPasswordError('');
    };

    const handleEmailUpdate = async (event) => {
        event.preventDefault();
        setLoading(true);
        setEmailError('');
        setPasswordError('');

        if (newEmail === userEmail) {
            setEmailError('Nový e-mail nemôže byť rovnaký ako starý.');
            setLoading(false);
            return;
        }

        if (!password) {
            setPasswordError('Prosím, zadajte svoje aktuálne heslo.');
            setLoading(false);
            return;
        }

        try {
            const auth = getAuth();
            const user = auth.currentUser;

            if (!user) {
                throw new Error('Používateľ nie je prihlásený.');
            }

            const credential = EmailAuthProvider.credential(user.email, password);
            await reauthenticateWithCredential(user, credential);
            
            // overenie emailu pred aktualizáciou
            await verifyBeforeUpdateEmail(user, newEmail);

            window.showGlobalNotification('Overovací e-mail bol odoslaný. Prosím, skontrolujte svoju schránku.', 'success');
            closeModal();

        } catch (error) {
            console.error("Chyba pri aktualizácii e-mailu:", error);
            if (error.code === 'auth/wrong-password') {
                setPasswordError('Nesprávne heslo. Skúste to znova.');
            } else if (error.code === 'auth/invalid-email' || error.code === 'auth/email-already-in-use') {
                setEmailError('Neplatný e-mail alebo e-mail už je použitý.');
            } else {
                window.showGlobalNotification(`Chyba: ${error.message}`, 'error');
            }
        } finally {
            setLoading(false);
        }
    };


    const renderUserDetails = () => {
        if (!isAuthReady) {
            return React.createElement(
                'div',
                { className: 'flex justify-center items-center py-12' },
                React.createElement(
                    'div',
                    { className: 'loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-12 w-12 mr-4' },
                ),
                React.createElement('span', null, 'Načítavam používateľské dáta...'),
            );
        }

        if (!profileData) {
            return React.createElement(
                'div',
                { className: 'text-center py-12 text-gray-500' },
                'Dáta profilu sa nepodarilo načítať. Skúste sa prosím odhlásiť a znovu prihlásiť.'
            );
        }
        
        return React.createElement(
            'div',
            { className: 'bg-white shadow-lg rounded-lg p-6 sm:p-8 md:p-10 mb-8' },
            React.createElement(
                'h2',
                { className: 'text-2xl sm:text-3xl font-bold text-gray-800 mb-6 border-b pb-4' },
                'Môj profil'
            ),
            React.createElement(
                'div',
                { className: 'space-y-4' },
                React.createElement(
                    'div',
                    { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                    // Meno a priezvisko
                    React.createElement(
                        'div',
                        null,
                        React.createElement(
                            'label',
                            { className: 'block text-sm font-medium text-gray-700' },
                            'Meno a priezvisko'
                        ),
                        React.createElement(
                            'p',
                            { className: 'mt-1 text-lg font-semibold text-gray-900' },
                            `${profileData.firstName} ${profileData.lastName}`
                        )
                    ),
                    // Email
                    React.createElement(
                        'div',
                        null,
                        React.createElement(
                            'label',
                            { className: 'block text-sm font-medium text-gray-700' },
                            'E-mail'
                        ),
                        React.createElement(
                            'div',
                            { className: 'mt-1 flex items-center justify-between' },
                            React.createElement(
                                'p',
                                { className: 'text-lg font-semibold text-gray-900' },
                                userEmail
                            ),
                            React.createElement(
                                'button',
                                {
                                    type: 'button',
                                    onClick: openModal,
                                    className: `ml-4 px-3 py-1 text-sm font-medium rounded-md text-white transition-colors duration-200 ${buttonColorClass}`
                                },
                                'Zmeniť'
                            )
                        )
                    )
                ),
                // Rodné číslo a rola
                React.createElement(
                    'div',
                    { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                    // Rodné číslo
                    React.createElement(
                        'div',
                        null,
                        React.createElement(
                            'label',
                            { className: 'block text-sm font-medium text-gray-700' },
                            'Rodné číslo'
                        ),
                        React.createElement(
                            'p',
                            { className: 'mt-1 text-lg font-semibold text-gray-900' },
                            profileData.pid
                        )
                    ),
                    // Rola
                    React.createElement(
                        'div',
                        null,
                        React.createElement(
                            'label',
                            { className: 'block text-sm font-medium text-gray-700' },
                            'Rola'
                        ),
                        React.createElement(
                            'p',
                            { className: 'mt-1 text-lg font-semibold text-gray-900 capitalize' },
                            profileData.role
                        )
                    )
                )
            )
        );
    };

    return React.createElement(
        'div',
        { className: 'min-h-screen' },
        React.createElement(
            'div',
            { className: 'container mx-auto px-4 sm:px-6 lg:px-8 py-8' },
            renderUserDetails(),
            isModalOpen && React.createElement(
                'div',
                { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-30 flex items-center justify-center' },
                React.createElement(
                    'div',
                    { className: 'relative p-8 bg-white w-96 max-w-lg mx-auto rounded-lg shadow-xl' },
                    React.createElement(
                        'button',
                        {
                            onClick: closeModal,
                            className: 'absolute top-3 right-3 text-gray-400 hover:text-gray-600'
                        },
                        React.createElement(
                            'svg',
                            { className: 'h-6 w-6', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                            React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M6 18L18 6M6 6l12 12' })
                        )
                    ),
                    React.createElement(
                        'h3',
                        { className: 'text-2xl font-bold text-gray-900 mb-4' },
                        'Zmeniť e-mail'
                    ),
                    React.createElement(
                        'p',
                        { className: 'text-sm text-gray-500 mb-6' },
                        'Pre zmenu e-mailovej adresy je potrebné overiť vašu identitu zadaním aktuálneho hesla a novej e-mailovej adresy. Na novú adresu vám bude zaslaný overovací e-mail.'
                    ),
                    React.createElement(
                        'form',
                        { onSubmit: handleEmailUpdate, className: 'space-y-6' },
                        React.createElement(
                            'div',
                            null,
                            React.createElement(
                                'label',
                                { htmlFor: 'new-email', className: 'block text-sm font-medium text-gray-700' },
                                'Nová e-mailová adresa'
                            ),
                            React.createElement(
                                'div',
                                { className: 'mt-1' },
                                React.createElement(
                                    'input',
                                    {
                                        type: 'email',
                                        id: 'new-email',
                                        value: newEmail,
                                        onChange: (e) => setNewEmail(e.target.value),
                                        placeholder: 'novy.email@example.com',
                                        required: true,
                                        disabled: loading,
                                        className: `w-full px-3 py-2 border rounded-md shadow-sm transition-colors duration-200 focus:outline-none focus:ring-2 ${focusColorClass} disabled:bg-gray-100 disabled:text-gray-500`
                                    }
                                )
                            ),
                            emailError && React.createElement(
                                'p',
                                { className: 'text-red-500 text-xs italic mt-1' },
                                emailError
                            )
                        ),
                        React.createElement(
                            'div',
                            null,
                            React.createElement(
                                'label',
                                { htmlFor: 'current-password', className: 'block text-sm font-medium text-gray-700' },
                                'Aktuálne heslo'
                            ),
                            React.createElement(
                                'div',
                                { className: 'mt-1' },
                                React.createElement(PasswordInput, {
                                    id: 'current-password',
                                    value: password,
                                    onChange: (e) => setPassword(e.target.value),
                                    placeholder: '••••••••',
                                    showPassword: showPassword,
                                    toggleShowPassword: toggleShowPassword,
                                    disabled: loading,
                                    focusColorClass: focusColorClass
                                })
                            ),
                            passwordError && React.createElement(
                                'p',
                                { className: 'text-red-500 text-xs italic mt-1' },
                                passwordError
                            )
                        ),
                        React.createElement(
                            'button',
                            {
                                type: 'submit',
                                className: `w-full flex justify-center py-2 px-4 rounded-md shadow-sm text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 
                                ${
                                  (loading || !newEmail || !password) 
                                    ? `bg-gray-200 text-gray-400 border border-gray-300 cursor-not-allowed` 
                                    : `text-white ${buttonColorClass}`
                                }`,
                                disabled: loading || !newEmail || !password,
                            },
                            loading ? 'Odosielam...' : 'Odoslať overovací e-mail'
                        )
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
