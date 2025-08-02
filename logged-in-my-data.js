// logged-in-my-data.js
// Tento súbor bol upravený, aby vždy synchronizoval e-mailovú adresu v profile používateľa
// s aktuálnou e-mailovou adresou v Firebase Authentication a farba hlavičky sa mení podľa roly.
// Kľúčová zmena: Notifikačný systém bol presunutý do tohto súboru, aby sa zabránilo
// konfliktu s priamou manipuláciou s DOM, čo by mohlo spôsobiť chybu "removeChild".

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
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M13.875 18.725A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.274-4.057 5.064-7 9.542-7 1.232 0 2.443.295 3.558.835M15 12a3 3 0 11-6 0 3 3 0 016 0zm-1 0a2 2 0 10-4 0 2 2 0 004 0z' }),
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M21 21l-1.5-1.5M16.5 16.5L21 21M3 3l-1.5 1.5' })
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
                    className: `block w-full rounded-md border-gray-300 pr-10 focus:outline-none sm:text-sm
                                ${focusColorClass}
                                ${disabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'text-gray-900'}
                    `
                }
            ),
            React.createElement(
                'div',
                { className: 'absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5' },
                React.createElement(
                    'button',
                    {
                        type: 'button',
                        onClick: toggleShowPassword,
                        className: 'focus:outline-none'
                    },
                    showPassword ? EyeOffIcon : EyeIcon
                )
            )
        )
    );
};

const MyDataApp = () => {
    // Definícia globálnych premenných, ak ešte neexistujú
    const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

    // Stav pre aplikáciu
    const [user, setUser] = useState(null);
    const [profileData, setProfileData] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [userRole, setUserRole] = useState('user');
    const [buttonColorClass, setButtonColorClass] = useState('bg-blue-600 hover:bg-blue-700 focus:ring-blue-500');

    // Kľúčové zmeny pre notifikácie:
    const [notificationMessage, setNotificationMessage] = useState('');
    const [notificationType, setNotificationType] = useState('success');

    // Pridanie globálne dostupných premenných do window
    const auth = getAuth();
    const db = getFirestore();
    window.auth = auth;
    window.db = db;

    // Funkcia na zobrazenie notifikácie
    const showNotification = (message, type = 'success') => {
        setNotificationMessage(message);
        setNotificationType(type);
        setTimeout(() => {
            setNotificationMessage('');
        }, 5000);
    };

    // Získanie referencií na dokumenty
    const userDocRef = user ? doc(db, 'artifacts', appId, 'users', user.uid) : null;
    const registrationsCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'registrations');

    // Efekt pre autentifikáciu
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                console.log("MyDataApp: Používateľ prihlásený, UID:", currentUser.uid);
            } else {
                setUser(null);
                setProfileData(null);
                console.log("MyDataApp: Používateľ odhlásený.");
            }
            setIsAuthReady(true);
        });

        // Cleanup funkcia pre odhlásenie listenera
        return () => unsubscribe();
    }, [auth]);

    // Efekt pre načítanie profilu a synchronizáciu emailu
    useEffect(() => {
        if (!userDocRef || !isAuthReady) return;

        const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setProfileData(data);
                setUserRole(data.role || 'user');
                console.log("MyDataApp: Načítané profilové dáta:", data);

                // Synchronizácia emailu z Firebase Auth do profilu v Firestore
                if (data.email !== user.email) {
                    console.log("MyDataApp: Email v profile sa nezhoduje s autentifikáciou. Synchronizujem.");
                    updateDoc(userDocRef, { email: user.email })
                        .then(() => {
                            showNotification('Email v profile bol úspešne synchronizovaný s vaším overeným emailom.', 'success');
                        })
                        .catch(error => {
                            console.error("MyDataApp: Chyba pri synchronizácii emailu:", error);
                            showNotification('Chyba pri synchronizácii emailu.', 'error');
                        });
                }
            } else {
                console.log("MyDataApp: Profil pre používateľa nebol nájdený!");
                setProfileData(null);
            }
        }, (error) => {
            console.error("MyDataApp: Chyba pri načítaní profilu:", error);
        });

        // Cleanup funkcia pre odhlásenie listenera
        return () => unsubscribe();
    }, [userDocRef, isAuthReady, user]);

    // Efekt pre zmenu farby podľa roly
    useEffect(() => {
        switch (userRole) {
            case 'admin':
                setButtonColorClass('bg-red-600 hover:bg-red-700 focus:ring-red-500');
                break;
            case 'moderator':
                setButtonColorClass('bg-green-600 hover:bg-green-700 focus:ring-green-500');
                break;
            default:
                setButtonColorClass('bg-blue-600 hover:bg-blue-700 focus:ring-blue-500');
                break;
        }
    }, [userRole]);

    // Handlery pre interakcie s formulárom
    const handleEmailUpdate = async (e) => {
        e.preventDefault();
        setLoading(true);
        setPasswordError('');

        if (!newEmail) {
            setPasswordError('Prosím, zadajte nový email.');
            setLoading(false);
            return;
        }

        if (newEmail === user.email) {
            setPasswordError('Nový email musí byť odlišný od aktuálneho.');
            setLoading(false);
            return;
        }

        try {
            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            await reauthenticateWithCredential(user, credential);
            await verifyBeforeUpdateEmail(user, newEmail);

            setModalOpen(false);
            showNotification('Overovací e-mail bol odoslaný. Skontrolujte si schránku.', 'success');
            console.log('MyDataApp: Overovací e-mail bol odoslaný.');
        } catch (error) {
            console.error("MyDataApp: Chyba pri aktualizácii e-mailu:", error);
            if (error.code === 'auth/wrong-password') {
                setPasswordError('Nesprávne heslo. Skúste znova.');
            } else {
                showNotification(`Chyba pri zmene e-mailu: ${error.message}`, 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleEmailChangeClick = () => {
        setModalOpen(true);
        setCurrentPassword('');
        setNewEmail('');
        setPasswordError('');
    };

    const toggleShowPassword = () => {
        setShowPassword(!showPassword);
    };

    if (!isAuthReady) {
        return React.createElement(
            'div',
            { className: 'flex justify-center items-center h-screen' },
            React.createElement(
                'div',
                { className: 'animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500' }
            )
        );
    }

    if (!user || !profileData) {
        // Zobrazenie správy, ak nie je používateľ alebo profilové dáta
        // Tento stav by sa nemal stať, ak je header.js správne nastavený
        return React.createElement(
            'div',
            { className: 'text-center p-8' },
            React.createElement(
                'h2',
                { className: 'text-2xl font-semibold text-gray-800' },
                'Prístup odmietnutý'
            ),
            React.createElement(
                'p',
                { className: 'mt-2 text-gray-600' },
                'Pre prístup do tejto sekcie sa prosím prihláste.'
            )
        );
    }

    // Komponent pre notifikácie (lokálny)
    const Notification = () => {
        if (!notificationMessage) return null;

        const bgColor = notificationType === 'success' ? 'bg-green-500' : 'bg-red-500';
        const icon = notificationType === 'success' ? '✔' : '✖';

        return React.createElement(
            'div',
            {
                className: `fixed top-20 right-5 z-50 p-4 rounded-md shadow-lg text-white max-w-sm w-full transition-transform duration-300 ease-out transform translate-x-0 ${bgColor}`
            },
            React.createElement(
                'div',
                { className: 'flex items-center space-x-2' },
                React.createElement(
                    'span',
                    { className: 'text-lg font-bold' },
                    icon
                ),
                React.createElement(
                    'p',
                    { className: 'text-sm font-medium' },
                    notificationMessage
                )
            )
        );
    };

    return React.createElement(
        'div',
        { className: 'min-h-screen' },
        React.createElement(Notification, null),
        React.createElement(
            'div',
            { className: 'bg-white shadow rounded-lg p-6 max-w-xl mx-auto mt-10' },
            React.createElement(
                'div',
                { className: 'flex items-center space-x-4' },
                React.createElement(
                    'div',
                    { className: 'w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-2xl text-gray-600 font-bold' },
                    profileData.firstName ? profileData.firstName[0].toUpperCase() : '?'
                ),
                React.createElement(
                    'div',
                    { className: 'flex-1' },
                    React.createElement(
                        'h1',
                        { className: 'text-2xl font-bold text-gray-900' },
                        `${profileData.firstName || ''} ${profileData.lastName || ''}`
                    ),
                    React.createElement(
                        'p',
                        { className: 'text-sm text-gray-500' },
                        `Email: ${user.email}`
                    )
                )
            ),
            React.createElement(
                'div',
                { className: 'mt-8' },
                React.createElement(
                    'h2',
                    { className: 'text-xl font-semibold text-gray-800' },
                    'Osobné údaje'
                ),
                React.createElement(
                    'ul',
                    { className: 'mt-4 space-y-4 text-gray-700' },
                    React.createElement(
                        'li',
                        null,
                        React.createElement('span', { className: 'font-medium' }, 'Meno: '),
                        profileData.firstName
                    ),
                    React.createElement(
                        'li',
                        null,
                        React.createElement('span', { className: 'font-medium' }, 'Priezvisko: '),
                        profileData.lastName
                    ),
                    React.createElement(
                        'li',
                        null,
                        React.createElement('span', { className: 'font-medium' }, 'E-mail: '),
                        React.createElement(
                            'span',
                            { className: 'font-semibold' },
                            user.email
                        ),
                        React.createElement(
                            'button',
                            {
                                onClick: handleEmailChangeClick,
                                className: 'ml-3 text-sm text-blue-600 hover:text-blue-800 font-medium'
                            },
                            'Zmeniť'
                        )
                    )
                )
            )
        ),
        modalOpen && React.createElement(
            'div',
            { className: 'fixed inset-0 z-50 overflow-y-auto' },
            React.createElement(
                'div',
                { className: 'flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0' },
                React.createElement(
                    'div',
                    {
                        className: 'fixed inset-0 transition-opacity',
                        onClick: () => setModalOpen(false)
                    },
                    React.createElement('div', { className: 'absolute inset-0 bg-gray-500 opacity-75' })
                ),
                React.createElement(
                    'span',
                    { className: 'hidden sm:inline-block sm:align-middle sm:h-screen' },
                    '​'
                ),
                React.createElement(
                    'div',
                    {
                        className: 'inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6'
                    },
                    React.createElement(
                        'div',
                        { className: 'sm:flex sm:items-start' },
                        React.createElement(
                            'div',
                            { className: 'mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full' },
                            React.createElement(
                                'h3',
                                { className: 'text-lg leading-6 font-medium text-gray-900' },
                                'Zmena e-mailovej adresy'
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
                                        React.createElement(
                                            'label',
                                            { htmlFor: 'newEmail', className: 'block text-sm font-medium text-gray-700' },
                                            'Nový e-mail'
                                        ),
                                        React.createElement(
                                            'div',
                                            { className: 'mt-1' },
                                            React.createElement('input', {
                                                type: 'email',
                                                id: 'newEmail',
                                                name: 'newEmail',
                                                value: newEmail,
                                                onChange: (e) => setNewEmail(e.target.value),
                                                placeholder: 'novy.email@domena.sk',
                                                className: `block w-full rounded-md border-gray-300 shadow-sm focus:border-${buttonColorClass.split('-')[1]}-500 focus:ring-${buttonColorClass.split('-')[1]}-500 sm:text-sm`
                                            })
                                        )
                                    ),
                                    React.createElement(PasswordInput, {
                                        id: 'current-password',
                                        label: 'Aktuálne heslo',
                                        value: currentPassword,
                                        onChange: (e) => setCurrentPassword(e.target.value),
                                        placeholder: 'Zadajte svoje aktuálne heslo',
                                        showPassword: showPassword,
                                        toggleShowPassword: toggleShowPassword,
                                        disabled: loading,
                                        focusColorClass: `focus:border-${buttonColorClass.split('-')[1]}-500 focus:ring-${buttonColorClass.split('-')[1]}-500`
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
                                                (loading || !newEmail || !currentPassword)
                                                    ? `bg-white text-gray-400 border border-gray-300 cursor-not-allowed`
                                                    : `text-white ${buttonColorClass}`
                                            }`,
                                            disabled: loading || !newEmail || !currentPassword,
                                        },
                                        loading ? 'Odosielam...' : 'Odoslať overovací e-mail'
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

const rootElement = document.getElementById('root');
if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
    const root = ReactDOM.createRoot(rootElement);
    root.render(React.createElement(MyDataApp, null));
    console.log("logged-in-my-data.js: Aplikácia vykreslená.");
} else {
    console.error("logged-in-my-data.js: HTML element 'root' alebo React/ReactDOM nie sú dostupné.");
}

window.MyDataApp = MyDataApp;
