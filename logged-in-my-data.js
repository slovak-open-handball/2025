// Importy pre Firebase funkcie
import { getAuth, EmailAuthProvider, reauthenticateWithCredential, verifyBeforeUpdateEmail, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getFirestore, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Import zoznamu predvolieb
import { countryDialCodes } from "./countryDialCodes.js";

const { useState, useEffect, useRef } = React;

/**
 * Globálna funkcia pre zobrazenie notifikácií
 * Vytvorí a spravuje modálne okno pre správy o úspechu alebo chybách
 */
window.showGlobalNotification = (message, type = 'success') => {
    let notificationElement = document.getElementById('global-notification');

    // Ak element ešte neexistuje, vytvoríme ho a pridáme do tela dokumentu
    if (!notificationElement) {
        notificationElement = document.createElement('div');
        notificationElement.id = 'global-notification';
        // Používame Tailwind CSS triedy pre štýlovanie a animácie
        notificationElement.className = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[9999] opacity-0 transition-opacity duration-300';
        document.body.appendChild(notificationElement);
    }

    // Určíme farby na základe typu správy
    let bgColorClass, textColorClass;
    if (type === 'success') {
        bgColorClass = 'bg-green-500';
        textColorClass = 'text-white';
    } else if (type === 'error') {
        bgColorClass = 'bg-red-500';
        textColorClass = 'text-white';
    } else { // Predvolené pre 'info' alebo iné
        bgColorClass = 'bg-blue-500';
        textColorClass = 'text-white';
    }

    // Nastavíme obsah a triedy
    notificationElement.textContent = message;
    notificationElement.className = `fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[9999] opacity-0 transition-opacity duration-300 ${bgColorClass} ${textColorClass}`;

    // Zobrazenie notifikácie
    requestAnimationFrame(() => {
        notificationElement.classList.add('opacity-100', 'translate-y-0');
        notificationElement.classList.remove('opacity-0', '-translate-y-full');
    });

    // Skrytie notifikácie po 5 sekundách
    setTimeout(() => {
        notificationElement.classList.add('opacity-0', '-translate-y-full');
        notificationElement.classList.remove('opacity-100', 'translate-y-0');
    }, 5000);
};

// Funkcia na re-autentifikáciu používateľa
const reauthenticateUser = async (currentPassword) => {
    const auth = getAuth();
    const user = auth.currentUser;
    const credentials = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credentials);
};

// Funkcia na aktualizáciu dát používateľa vo Firestore
const updateUserProfile = async (uid, newProfileData) => {
    const db = getFirestore();
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, newProfileData);
};

// Komponent pre input hesla s možnosťou zobrazenia/skrytia
const PasswordInput = ({ value, onChange }) => {
    const [showPassword, setShowPassword] = useState(false);
    return React.createElement(
        'div',
        { className: 'relative' },
        React.createElement('input', {
            type: showPassword ? 'text' : 'password',
            className: 'w-full px-4 py-2 mt-2 rounded-lg border-2 border-gray-300 focus:outline-none focus:border-blue-500',
            placeholder: 'Zadajte svoje aktuálne heslo',
            value: value,
            onChange: (e) => onChange(e.target.value)
        }),
        React.createElement(
            'button', {
            type: 'button',
            onClick: () => setShowPassword(!showPassword),
            className: 'absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5'
        },
        React.createElement('svg', {
            className: 'h-6 w-6 text-gray-500',
            fill: 'none',
            viewBox: '0 0 24 24',
            stroke: 'currentColor'
        },
        React.createElement('path', {
            'strokeLinecap': 'round',
            'strokeLinejoin': 'round',
            'strokeWidth': '2',
            'd': showPassword ? 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.924-10-7 1.732-4.076 5.522-7 10-7s8.268 2.924 10 7c-.287.491-.595.969-.915 1.436M9 12a3 3 0 116 0 3 3 0 01-6 0z' : 'M15 12a3 3 0 11-6 0 3 3 0 016 0z'
        }),
        React.createElement('path', {
            'strokeLinecap': 'round',
            'strokeLinejoin': 'round',
            'strokeWidth': '2',
            'd': showPassword ? 'M10 12a2 2 0 114 0 2 2 0 01-4 0z' : 'M2.458 12C3.732 7.924 7.522 5 12 5c4.478 0 8.268 2.924 10 7-.287.491-.595.969-.915 1.436M9 12a3 3 0 116 0 3 3 0 01-6 0z'
        }))
        )
    );
};

// Komponent pre modálne okno na výber telefónnej predvoľby
const DialCodeModal = ({ show, onClose, onSelect }) => {
    if (!show) return null;

    const [searchTerm, setSearchTerm] = useState('');
    const filteredCodes = countryDialCodes.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.code.includes(searchTerm)
    );

    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-[10000]' },
        React.createElement(
            'div',
            { className: 'relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white' },
            React.createElement(
                'div',
                { className: 'mt-3 text-center' },
                React.createElement(
                    'h3',
                    { className: 'text-lg leading-6 font-medium text-gray-900' },
                    'Vyberte predvoľbu krajiny'
                ),
                React.createElement(
                    'div',
                    { className: 'mt-2 px-7 py-3' },
                    React.createElement('input', {
                        type: 'text',
                        className: 'w-full px-4 py-2 rounded-lg border-2 border-gray-300 focus:outline-none focus:border-blue-500',
                        placeholder: 'Hľadať krajinu alebo kód...',
                        value: searchTerm,
                        onChange: (e) => setSearchTerm(e.target.value)
                    }),
                    React.createElement(
                        'ul',
                        { className: 'mt-4 h-64 overflow-y-auto' },
                        filteredCodes.map((c) =>
                            React.createElement(
                                'li',
                                {
                                    key: c.code,
                                    className: 'cursor-pointer p-2 hover:bg-gray-200 rounded-md',
                                    onClick: () => { onSelect(c.code); onClose(); }
                                },
                                `${c.name} (${c.code})`
                            )
                        )
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'items-center px-4 py-3' },
                    React.createElement(
                        'button',
                        {
                            onClick: onClose,
                            className: 'px-4 py-2 bg-red-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-300'
                        },
                        'Zavrieť'
                    )
                )
            )
        )
    );
};

// Hlavný komponent modálneho okna pre úpravu profilu
const ChangeProfileModal = ({ show, onClose, userProfileData, roleColor }) => {
    if (!show) return null;

    const [firstName, setFirstName] = useState(userProfileData.contactFirstName || '');
    const [lastName, setLastName] = useState(userProfileData.contactLastName || '');
    const [email, setEmail] = useState(userProfileData.email || '');
    const [password, setPassword] = useState('');
    const [phoneNumber, setPhoneNumber] = useState(userProfileData.contactPhoneNumber || '');
    const [dialCode, setDialCode] = useState(userProfileData.countryDialCode || '+421');
    const [showDialCodeModal, setShowDialCodeModal] = useState(false);
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');

    const hasChanges =
        firstName !== (userProfileData.contactFirstName || '') ||
        lastName !== (userProfileData.contactLastName || '') ||
        email !== (userProfileData.email || '') ||
        phoneNumber !== (userProfileData.contactPhoneNumber || '') ||
        dialCode !== (userProfileData.countryDialCode || '+421');

    const handleUpdate = async (e) => {
        e.preventDefault();
        setErrors({});
        const newErrors = {};

        if (!firstName) newErrors.firstName = 'Meno je povinné.';
        if (!lastName) newErrors.lastName = 'Priezvisko je povinné.';
        if (!email) newErrors.email = 'E-mail je povinný.';
        if (!phoneNumber) newErrors.phoneNumber = 'Telefónne číslo je povinné.';
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        if (hasChanges && !password) {
            newErrors.password = 'Zadajte svoje aktuálne heslo pre potvrdenie zmien.';
            setErrors(newErrors);
            return;
        }

        setIsSubmitting(true);
        setLoadingMessage('Prebieha overenie hesla...');

        try {
            if (hasChanges) {
                // Krok 1: Re-autentifikácia
                const auth = getAuth();
                const user = auth.currentUser;
                const credentials = EmailAuthProvider.credential(user.email, password);
                await reauthenticateWithCredential(user, credentials);

                // Krok 2: Overenie a aktualizácia emailu
                if (email !== userProfileData.email) {
                    setLoadingMessage('Prebieha zmena e-mailovej adresy...');
                    await verifyBeforeUpdateEmail(user, email);
                    window.showGlobalNotification('Odkaz na zmenu e-mailovej adresy bol odoslaný na novú e-mailovú adresu. Potvrďte zmenu kliknutím na odkaz.', 'success');
                }

                // Krok 3: Aktualizácia profilových dát
                setLoadingMessage('Prebieha aktualizácia profilu...');
                const updates = {
                    contactFirstName: firstName,
                    contactLastName: lastName,
                    contactPhoneNumber: phoneNumber,
                    countryDialCode: dialCode,
                    email: email, // Aktualizácia emailu len v profile, nie v auth
                    lastUpdatedAt: new Date()
                };

                await updateUserProfile(user.uid, updates);
                window.showGlobalNotification('Profil bol úspešne aktualizovaný.', 'success');
                onClose();
            } else {
                window.showGlobalNotification('Žiadne zmeny na uloženie.', 'info');
                onClose();
            }

        } catch (error) {
            console.error("Chyba pri aktualizácii profilu:", error);
            if (error.code === 'auth/wrong-password') {
                setErrors({ password: 'Zadané heslo je nesprávne.' });
            } else if (error.code === 'auth/email-already-in-use') {
                setErrors({ email: 'Táto e-mailová adresa sa už používa.' });
            } else {
                window.showGlobalNotification(`Chyba pri aktualizácii: ${error.message}`, 'error');
            }
        } finally {
            setIsSubmitting(false);
            setLoadingMessage('');
        }
    };

    const isMobile = window.innerWidth <= 768; // Jednoduchá kontrola pre mobilné zariadenia
    const modalStyle = isMobile ? { top: '50px', transform: 'translate(-50%, 0)' } : {};

    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-[10000] flex justify-center items-center p-4' },
        React.createElement(
            'div',
            {
                className: 'relative p-8 rounded-lg shadow-lg bg-white w-full max-w-lg mx-auto transform transition-all duration-300 scale-100',
                style: modalStyle
            },
            React.createElement(
                'button',
                {
                    className: 'absolute top-4 right-4 text-gray-500 hover:text-gray-800',
                    onClick: onClose
                },
                React.createElement(
                    'svg',
                    { className: 'h-6 w-6', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                    React.createElement('path', { 'strokeLinecap': 'round', 'strokeLinejoin': 'round', 'strokeWidth': '2', 'd': 'M6 18L18 6M6 6l12 12' })
                )
            ),
            React.createElement(
                'div',
                {
                    className: `text-white text-center rounded-t-lg p-4 -mt-8 -mx-8 mb-8 ${roleColor}`
                },
                React.createElement(
                    'h2',
                    { className: 'text-2xl font-bold' },
                    'Upraviť profil'
                )
            ),
            React.createElement('form', { onSubmit: handleUpdate },
                React.createElement('div', { className: 'mb-4' },
                    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'firstName' }, 'Meno'),
                    React.createElement('input', {
                        type: 'text',
                        id: 'firstName',
                        className: 'w-full px-4 py-2 rounded-lg border-2 border-gray-300 focus:outline-none focus:border-blue-500',
                        value: firstName,
                        onChange: (e) => setFirstName(e.target.value)
                    }),
                    errors.firstName && React.createElement('p', { className: 'text-red-500 text-xs italic' }, errors.firstName)
                ),
                React.createElement('div', { className: 'mb-4' },
                    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'lastName' }, 'Priezvisko'),
                    React.createElement('input', {
                        type: 'text',
                        id: 'lastName',
                        className: 'w-full px-4 py-2 rounded-lg border-2 border-gray-300 focus:outline-none focus:border-blue-500',
                        value: lastName,
                        onChange: (e) => setLastName(e.target.value)
                    }),
                    errors.lastName && React.createElement('p', { className: 'text-red-500 text-xs italic' }, errors.lastName)
                ),
                React.createElement('div', { className: 'mb-4' },
                    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'phoneNumber' }, 'Telefónne číslo'),
                    React.createElement('div', { className: 'flex' },
                        React.createElement(
                            'button',
                            {
                                type: 'button',
                                className: 'px-4 py-2 rounded-l-lg bg-gray-200 hover:bg-gray-300 focus:outline-none flex items-center',
                                onClick: () => setShowDialCodeModal(true)
                            },
                            React.createElement('span', { className: 'mr-2' }, dialCode),
                            React.createElement('svg', { className: 'h-4 w-4 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                                React.createElement('path', { 'strokeLinecap': 'round', 'strokeLinejoin': 'round', 'strokeWidth': '2', 'd': 'M19 9l-7 7-7-7' })
                            )
                        ),
                        React.createElement('input', {
                            type: 'text',
                            id: 'phoneNumber',
                            // Upravené triedy - odstránený "border" a "border-2 border-gray-300"
                            className: 'w-full px-4 py-2 rounded-r-lg bg-gray-100 focus:outline-none focus:bg-white focus:border-blue-500',
                            value: phoneNumber,
                            onChange: (e) => setPhoneNumber(e.target.value)
                        })
                    ),
                    errors.phoneNumber && React.createElement('p', { className: 'text-red-500 text-xs italic mt-2' }, errors.phoneNumber)
                ),
                React.createElement('div', { className: 'mb-4' },
                    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'email' }, 'Nová e-mailová adresa'),
                    React.createElement('input', {
                        type: 'email',
                        id: 'email',
                        className: 'w-full px-4 py-2 rounded-lg border-2 border-gray-300 focus:outline-none focus:border-blue-500',
                        value: email,
                        onChange: (e) => setEmail(e.target.value)
                    }),
                    errors.email && React.createElement('p', { className: 'text-red-500 text-xs italic' }, errors.email)
                ),
                React.createElement('div', { className: 'mb-4' },
                    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'password' }, 'Aktuálne heslo (pre potvrdenie zmien)'),
                    React.createElement(PasswordInput, {
                        value: password,
                        onChange: setPassword
                    }),
                    errors.password && React.createElement('p', { className: 'text-red-500 text-xs italic' }, errors.password)
                ),
                React.createElement(
                    'div',
                    { className: 'flex justify-between items-center mt-6' },
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            className: 'px-4 py-2 bg-gray-300 text-gray-700 rounded-lg shadow-md hover:bg-gray-400 transition duration-300',
                            onClick: onClose
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            type: 'submit',
                            className: `px-4 py-2 text-white font-bold rounded-lg shadow-md transition duration-300 ${isSubmitting || !hasChanges ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'}`,
                            disabled: isSubmitting || !hasChanges
                        },
                        isSubmitting ? React.createElement(
                            'div',
                            { className: 'flex items-center' },
                            React.createElement('div', { className: 'animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2' }),
                            'Ukladám...'
                        ) : 'Uložiť zmeny'
                    )
                )
            ),
            isSubmitting && loadingMessage && React.createElement('div', { className: 'absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg' },
                React.createElement(
                    'p',
                    { className: 'text-lg font-semibold text-gray-700' },
                    loadingMessage
                )
            ),
            React.createElement(DialCodeModal, {
                show: showDialCodeModal,
                onClose: () => setShowDialCodeModal(false),
                onSelect: (code) => setDialCode(code)
            })
        )
    );
};

// Zobrazenie dát profilu
const ProfileDataSection = ({ label, value }) => {
    return React.createElement(
        'div',
        { className: 'flex justify-between items-center py-2 border-b last:border-b-0' },
        React.createElement(
            'p',
            { className: 'font-bold text-gray-600' },
            label
        ),
        React.createElement(
            'p',
            { className: 'text-gray-800' },
            value
        )
    );
};

// Hlavný komponent aplikácie
const MyDataApp = () => {
    const [userProfileData, setUserProfileData] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [headerColor, setHeaderColor] = useState('bg-blue-500');

    // Listener pre globálne dáta
    useEffect(() => {
        // Funkcia, ktorá spracováva aktualizáciu globálnych dát
        const handleGlobalDataUpdate = (event) => {
            const data = event.detail;
            if (data) {
                setUserProfileData(data);
                // Nastavenie farby hlavičky na základe roly
                setHeaderColor(getRoleColor(data.role));
            } else {
                setUserProfileData(null);
            }
        };

        // Pridanie a odstránenie listenera
        window.addEventListener('globalDataUpdated', handleGlobalDataUpdate);
        return () => window.removeEventListener('globalDataUpdated', handleGlobalDataUpdate);
    }, []);


    // Nastavenie počiatočných dát
    useEffect(() => {
        if (window.globalUserProfileData) {
            setUserProfileData(window.globalUserProfileData);
            setHeaderColor(getRoleColor(window.globalUserProfileData.role));
        }
    }, []);

    const getRoleColor = (role) => {
        switch (role) {
            case 'admin':
                return 'bg-red-600';
            case 'hall':
                return 'bg-green-600';
            case 'user':
            default:
                return 'bg-blue-600';
        }
    };


    if (!userProfileData) {
        return React.createElement(
            'div',
            { className: 'flex justify-center pt-16' },
            React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-t-4 border-blue-500 border-opacity-50' })
        );
    }

    return React.createElement(
        'div',
        { className: 'bg-white p-8 rounded-lg shadow-lg max-w-2xl mx-auto my-12' },
        React.createElement(
            'div',
            { className: `p-6 text-white rounded-t-lg -mt-8 -mx-8 mb-8 ${headerColor}` },
            React.createElement(
                'div',
                { className: 'flex items-center justify-between' },
                React.createElement(
                    'h1',
                    { className: 'text-3xl font-bold' },
                    'Moja zóna'
                ),
                React.createElement(
                    'button',
                    {
                        className: 'bg-white text-gray-800 px-4 py-2 rounded-full shadow-md hover:bg-gray-100 transition duration-300 text-sm font-semibold',
                        onClick: () => setShowModal(true)
                    },
                    'Upraviť profil'
                )
            )
        ),
        React.createElement(
            'div',
            { className: 'space-y-4' },
            React.createElement(
                ProfileDataSection,
                {
                    label: 'Meno a Priezvisko',
                    value: `${userProfileData.contactFirstName} ${userProfileData.contactLastName}`
                }
            ),
            React.createElement(
                ProfileDataSection,
                {
                    label: 'Telefónne číslo',
                    value: `${userProfileData.countryDialCode} ${userProfileData.contactPhoneNumber}`
                }
            ),
            React.createElement(
                ProfileDataSection,
                {
                    label: 'E-mailová adresa',
                    value: `${userProfileData.email}`
                }
            )
        ),
        React.createElement(ChangeProfileModal, {
            show: showModal,
            onClose: () => setShowModal(false),
            userProfileData: userProfileData,
            roleColor: headerColor
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
