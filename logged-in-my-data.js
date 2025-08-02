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
    } else {
        // Predvolené pre informácie
        bgColorClass = 'bg-gray-800';
        textColorClass = 'text-white';
    }

    // Aplikujeme štýly a zobrazíme notifikáciu
    notificationElement.className = `fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[9999] opacity-0 transition-opacity duration-300 ${bgColorClass} ${textColorClass}`;
    notificationElement.textContent = message;

    // Animácia fade-in a fade-out
    setTimeout(() => {
        notificationElement.style.opacity = '1';
    }, 10);
    setTimeout(() => {
        notificationElement.style.opacity = '0';
    }, 5000);
};

// Funkcia na overenie formátu telefónneho čísla (základná kontrola)
const isValidPhoneNumber = (phoneNumber) => {
    const phoneRegex = /^\+\d{1,4}\d{4,14}$/;
    return phoneRegex.test(phoneNumber);
};

// Načítanie Firebase Config z globálnej premennej
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};

// Inicializácia Firebase, ak už nebola
let app;
let db;
let auth;
try {
    app = firebase.getApp();
} catch (e) {
    app = firebase.initializeApp(firebaseConfig);
}
db = firebase.getFirestore(app);
auth = firebase.getAuth(app);


// Komponent pre inputbox na heslo s prepínaním viditeľnosti
const PasswordInput = ({ value, onChange, placeholder, required = true }) => {
    const [showPassword, setShowPassword] = useState(false);
    return React.createElement(
        'div',
        { className: 'relative' },
        React.createElement('input', {
            type: showPassword ? 'text' : 'password',
            value: value,
            onChange: onChange,
            placeholder: placeholder,
            required: required,
            className: 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition-all duration-200'
        }),
        React.createElement(
            'span',
            {
                className: 'absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-gray-400',
                onClick: () => setShowPassword(!showPassword)
            },
            showPassword ?
                React.createElement(
                    'svg',
                    { className: 'h-5 w-5', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-2.668m4.945-3.66A9.97 9.97 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.05 10.05 0 01-1.272 2.766m-1.745-1.745c-.171-.171-.354-.343-.54-.515m-.385-.385c-.186-.172-.37-.343-.556-.515M12 9a3 3 0 100 6 3 3 0 000-6z' })
                ) :
                React.createElement(
                    'svg',
                    { className: 'h-5 w-5', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' }),
                    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' })
                )
        )
    );
};

// Komponent pre modálne okno s výberom telefónnej predvoľby
const DialCodeModal = ({ show, onClose, onSelect }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const modalRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (modalRef.current && !modalRef.current.contains(event.target)) {
                onClose();
            }
        };

        if (show) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [show, onClose]);

    if (!show) {
        return null;
    }

    const filteredDialCodes = countryDialCodes.filter(country =>
        country.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        country.dial_code.includes(searchTerm)
    );

    return ReactDOM.createPortal(
        React.createElement(
            'div',
            { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-[1000] flex justify-center items-center p-4' },
            React.createElement(
                'div',
                { ref: modalRef, className: 'relative bg-white rounded-lg shadow-xl w-full max-w-sm md:max-w-md lg:max-w-lg p-6' },
                React.createElement('h3', { className: 'text-2xl font-bold mb-4 text-center' }, 'Vybrať predvoľbu'),
                React.createElement('input', {
                    type: 'text',
                    placeholder: 'Hľadať krajinu alebo kód...',
                    className: 'w-full px-4 py-2 mb-4 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500',
                    value: searchTerm,
                    onChange: (e) => setSearchTerm(e.target.value)
                }),
                React.createElement(
                    'ul',
                    { className: 'max-h-60 overflow-y-auto border border-gray-200 rounded-lg' },
                    filteredDialCodes.map((country, index) =>
                        React.createElement(
                            'li',
                            {
                                key: index,
                                className: 'flex justify-between items-center px-4 py-2 hover:bg-gray-100 cursor-pointer transition-colors duration-200',
                                onClick: () => {
                                    onSelect(country.dial_code);
                                    onClose();
                                }
                            },
                            React.createElement('span', null, `${country.name} (${country.code})`),
                            React.createElement('span', { className: 'font-bold text-gray-600' }, country.dial_code)
                        )
                    )
                ),
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'mt-4 w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors duration-200'
                    },
                    'Zavrieť'
                )
            )
        ),
        document.body
    );
};


// Komponent pre modálne okno na zmenu profilu
const ChangeProfileModal = ({ show, onClose, userProfileData, roleColor }) => {
    const [name, setName] = useState(userProfileData.name);
    const [surname, setSurname] = useState(userProfileData.surname);
    const [email, setEmail] = useState(userProfileData.email);
    const [phoneNumber, setPhoneNumber] = useState(''); // Zmenené: inicializované na prázdny reťazec
    const [dialCode, setDialCode] = useState(userProfileData.contactPhoneNumber?.split(' ')[0] || countryDialCodes[0].dial_code);
    const [password, setPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showDialCodeModal, setShowDialCodeModal] = useState(false);

    const [isSaving, setIsSaving] = useState(false);
    const [showReauth, setShowReauth] = useState(false);

    useEffect(() => {
        if (show) {
            setName(userProfileData.name);
            setSurname(userProfileData.surname);
            setEmail(userProfileData.email);
            setPhoneNumber(userProfileData.contactPhoneNumber?.split(' ')[1] || ''); // Zmenené: inicializované na časť bez predvoľby
            setDialCode(userProfileData.contactPhoneNumber?.split(' ')[0] || countryDialCodes[0].dial_code);
            setPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setIsSaving(false);
            setShowReauth(false);
        }
    }, [show, userProfileData]);

    if (!show) {
        return null;
    }

    const handleSave = async () => {
        setIsSaving(true);
        const user = auth.currentUser;

        if (!user) {
            window.showGlobalNotification('Používateľ nie je prihlásený.', 'error');
            setIsSaving(false);
            return;
        }

        const changes = {};
        if (name !== userProfileData.name) changes.name = name;
        if (surname !== userProfileData.surname) changes.surname = surname;

        let newPhoneNumber = '';
        if (phoneNumber) {
            newPhoneNumber = `${dialCode}${phoneNumber.replace(/\s/g, '')}`;
        }

        if (newPhoneNumber && newPhoneNumber !== userProfileData.contactPhoneNumber?.replace(/\s/g, '')) {
            changes.contactPhoneNumber = newPhoneNumber;
        } else if (!phoneNumber && userProfileData.contactPhoneNumber) {
            changes.contactPhoneNumber = '';
        }

        const promises = [];

        // Kontrola zmeny e-mailu
        if (email !== userProfileData.email) {
            if (!password) {
                window.showGlobalNotification('Pre zmenu e-mailu je potrebné zadať aktuálne heslo.', 'error');
                setIsSaving(false);
                setShowReauth(true);
                return;
            }

            try {
                const credential = EmailAuthProvider.credential(user.email, password);
                await reauthenticateWithCredential(user, credential);
                promises.push(verifyBeforeUpdateEmail(user, email).then(() => {
                    window.showGlobalNotification('E-mail bol úspešne zmenený. Pre potvrdenie kliknite na odkaz, ktorý bol odoslaný na vašu novú e-mailovú adresu.', 'success');
                }));
            } catch (error) {
                console.error("Chyba pri zmene e-mailu:", error);
                window.showGlobalNotification('Chyba pri overovaní alebo zmene e-mailu. Skontrolujte prosím heslo.', 'error');
                setIsSaving(false);
                return;
            }
        }

        // Kontrola zmeny hesla
        if (newPassword) {
            if (newPassword !== confirmPassword) {
                window.showGlobalNotification('Nové heslá sa nezhodujú.', 'error');
                setIsSaving(false);
                return;
            }
            if (newPassword.length < 6) {
                window.showGlobalNotification('Nové heslo musí mať aspoň 6 znakov.', 'error');
                setIsSaving(false);
                return;
            }
            if (!password) {
                window.showGlobalNotification('Pre zmenu hesla je potrebné zadať aktuálne heslo.', 'error');
                setIsSaving(false);
                setShowReauth(true);
                return;
            }

            try {
                const credential = EmailAuthProvider.credential(user.email, password);
                await reauthenticateWithCredential(user, credential);
                promises.push(firebase.updatePassword(user, newPassword).then(() => {
                    window.showGlobalNotification('Heslo bolo úspešne zmenené.', 'success');
                }));
            } catch (error) {
                console.error("Chyba pri zmene hesla:", error);
                window.showGlobalNotification('Chyba pri overovaní alebo zmene hesla. Skontrolujte prosím aktuálne heslo.', 'error');
                setIsSaving(false);
                return;
            }
        }

        // Kontrola zmien v profile
        if (Object.keys(changes).length > 0) {
            const userDocRef = doc(db, 'users', user.uid);
            promises.push(updateDoc(userDocRef, changes).then(() => {
                window.showGlobalNotification('Profil bol úspešne aktualizovaný.', 'success');
                // Aktualizácia globálnych dát
                window.globalUserProfileData = { ...window.globalUserProfileData, ...changes };
                // Odpálenie udalosti pre ostatné komponenty
                window.dispatchEvent(new Event('globalDataUpdated'));
            }));
        }

        Promise.all(promises)
            .then(() => {
                onClose();
            })
            .catch(error => {
                console.error("Chyba pri ukladaní zmien:", error);
                window.showGlobalNotification('Chyba pri ukladaní zmien.', 'error');
            })
            .finally(() => {
                setIsSaving(false);
            });
    };

    return ReactDOM.createPortal(
        React.createElement(
            'div',
            { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-[1000] flex justify-center items-center p-4' },
            React.createElement(
                'div',
                { className: 'relative bg-white rounded-lg shadow-xl w-full max-w-lg p-8' },
                React.createElement(
                    'div',
                    { className: 'flex justify-between items-center pb-3 border-b-2 mb-4' },
                    React.createElement('h3', { className: 'text-2xl font-bold' }, 'Upraviť profil'),
                    React.createElement(
                        'button',
                        {
                            onClick: onClose,
                            className: 'text-gray-400 hover:text-gray-600'
                        },
                        React.createElement(
                            'svg',
                            { className: 'h-6 w-6', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                            React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M6 18L18 6M6 6l12 12' })
                        )
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'space-y-4' },
                    // Meno
                    React.createElement(
                        'div',
                        { className: 'flex flex-col' },
                        React.createElement('label', { className: 'text-sm font-medium text-gray-700' }, 'Meno'),
                        React.createElement('input', {
                            type: 'text',
                            value: name,
                            onChange: (e) => setName(e.target.value),
                            placeholder: userProfileData.name, // Placeholder
                            className: 'mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition-all duration-200'
                        })
                    ),
                    // Priezvisko
                    React.createElement(
                        'div',
                        { className: 'flex flex-col' },
                        React.createElement('label', { className: 'text-sm font-medium text-gray-700' }, 'Priezvisko'),
                        React.createElement('input', {
                            type: 'text',
                            value: surname,
                            onChange: (e) => setSurname(e.target.value),
                            placeholder: userProfileData.surname, // Placeholder
                            className: 'mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition-all duration-200'
                        })
                    ),
                    // E-mail
                    React.createElement(
                        'div',
                        { className: 'flex flex-col' },
                        React.createElement('label', { className: 'text-sm font-medium text-gray-700' }, 'E-mailová adresa'),
                        React.createElement('input', {
                            type: 'email',
                            value: email,
                            onChange: (e) => setEmail(e.target.value),
                            placeholder: userProfileData.email,
                            className: 'mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition-all duration-200'
                        })
                    ),
                    // Telefónne číslo
                    React.createElement(
                        'div',
                        { className: 'flex flex-col' },
                        React.createElement('label', { className: 'text-sm font-medium text-gray-700' }, 'Telefónne číslo'),
                        React.createElement(
                            'div',
                            { className: 'mt-1 flex rounded-lg shadow-sm' },
                            React.createElement(
                                'button',
                                {
                                    type: 'button',
                                    onClick: () => setShowDialCodeModal(true),
                                    className: `inline-flex items-center px-4 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-sm ${roleColor} transition-colors duration-200`
                                },
                                dialCode
                            ),
                            React.createElement('input', {
                                type: 'text',
                                value: phoneNumber,
                                onChange: (e) => setPhoneNumber(e.target.value),
                                placeholder: userProfileData.contactPhoneNumber, // Zmenené: placeholder
                                className: 'flex-1 min-w-0 block w-full px-4 py-2 rounded-none rounded-r-lg focus:ring-blue-500 focus:border-blue-500 transition-all duration-200'
                            })
                        )
                    ),
                    // Pole pre heslo pri zmene e-mailu
                    email !== userProfileData.email && showReauth && React.createElement(
                        'div',
                        { className: 'flex flex-col' },
                        React.createElement('label', { className: 'text-sm font-medium text-gray-700' }, 'Aktuálne heslo'),
                        React.createElement(PasswordInput, {
                            value: password,
                            onChange: (e) => setPassword(e.target.value),
                            placeholder: 'Zadajte vaše aktuálne heslo',
                            required: true
                        })
                    ),
                    // Zmena hesla
                    React.createElement('hr', { className: 'my-4 border-gray-200' }),
                    React.createElement('h4', { className: 'text-lg font-semibold' }, 'Zmeniť heslo'),
                    React.createElement(
                        'div',
                        { className: 'flex flex-col' },
                        React.createElement('label', { className: 'text-sm font-medium text-gray-700' }, 'Nové heslo'),
                        React.createElement(PasswordInput, {
                            value: newPassword,
                            onChange: (e) => setNewPassword(e.target.value),
                            placeholder: 'Zadajte nové heslo (aspoň 6 znakov)',
                            required: false
                        })
                    ),
                    React.createElement(
                        'div',
                        { className: 'flex flex-col' },
                        React.createElement('label', { className: 'text-sm font-medium text-gray-700' }, 'Potvrdiť nové heslo'),
                        React.createElement(PasswordInput, {
                            value: confirmPassword,
                            onChange: (e) => setConfirmPassword(e.target.value),
                            placeholder: 'Potvrďte nové heslo',
                            required: false
                        })
                    ),
                    (newPassword || confirmPassword) && React.createElement(
                        'div',
                        { className: 'flex flex-col' },
                        React.createElement('label', { className: 'text-sm font-medium text-gray-700' }, 'Aktuálne heslo'),
                        React.createElement(PasswordInput, {
                            value: password,
                            onChange: (e) => setPassword(e.target.value),
                            placeholder: 'Zadajte vaše aktuálne heslo',
                            required: true
                        })
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'mt-6 flex justify-end gap-3' },
                    React.createElement(
                        'button',
                        {
                            onClick: onClose,
                            className: 'px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors duration-200'
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            onClick: handleSave,
                            disabled: isSaving,
                            className: `px-6 py-2 rounded-lg text-white font-medium transition-all duration-200 ${roleColor} ${isSaving ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg'}`
                        },
                        isSaving ? 'Ukladám...' : 'Uložiť zmeny'
                    )
                ),
                React.createElement(DialCodeModal, {
                    show: showDialCodeModal,
                    onClose: () => setShowDialCodeModal(false),
                    onSelect: (code) => {
                        setDialCode(code);
                        if (phoneNumber === '') {
                           // Ak je pole prázdne, môžeme ponechať len predvoľbu
                        }
                    }
                })
            )
        ),
        document.body
    );
};

// Funkcia na určenie farby podľa roly
const getRoleColor = (role) => {
    switch (role) {
        case 'admin':
            return 'bg-red-600 hover:bg-red-700';
        case 'hall':
            return 'bg-yellow-500 hover:bg-yellow-600';
        default:
            return 'bg-blue-600 hover:bg-blue-700';
    }
};

const MyDataApp = () => {
    const [userProfileData, setUserProfileData] = useState(window.globalUserProfileData || null);
    const [showModal, setShowModal] = useState(false);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [headerColor, setHeaderColor] = useState('bg-blue-600 hover:bg-blue-700');

    // Inicializácia a prihlásenie po overení
    useEffect(() => {
        const initAuth = async () => {
            const auth = getAuth(app);
            try {
                if (typeof __initial_auth_token !== 'undefined') {
                    await signInWithCustomToken(auth, __initial_auth_token);
                } else {
                    await signInAnonymously(auth);
                }
            } catch (error) {
                console.error("Chyba pri autentifikácii:", error);
            }
            setIsAuthReady(true);
        };
        initAuth();
    }, []);

    // Načítanie a sledovanie dát profilu
    useEffect(() => {
        if (!isAuthReady || !auth.currentUser) return;

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                const unsubscribeSnapshot = onSnapshot(doc(db, "users", user.uid), (doc) => {
                    if (doc.exists()) {
                        const data = doc.data();
                        const color = getRoleColor(data.role);
                        setUserProfileData(data);
                        setHeaderColor(color);
                        // Vytvorenie a aktualizácia globálnych dát
                        window.globalUserProfileData = data;
                        window.dispatchEvent(new Event('globalDataUpdated'));
                        console.log("Dáta používateľa úspešne načítané:", data);
                    } else {
                        console.error("Žiadne takéto dáta pre používateľa!");
                    }
                }, (error) => {
                    console.error("Chyba pri načítaní profilu:", error);
                });
                return () => unsubscribeSnapshot();
            } else {
                console.log("Používateľ je odhlásený");
                setUserProfileData(null);
            }
        });

        return () => unsubscribe();
    }, [isAuthReady]);

    // Posielanie dát do hlavičky
    useEffect(() => {
        if (userProfileData && typeof window.updateHeaderProfileData === 'function') {
            window.updateHeaderProfileData(userProfileData);
        }
    }, [userProfileData]);


    if (!userProfileData) {
        return React.createElement(
            'div',
            { className: 'flex justify-center pt-16' },
            React.createElement('div', { className: `${headerColor} animate-spin rounded-full h-32 w-32 border-b-4` })
        );
    }

    return React.createElement(
        'div',
        { className: 'bg-white p-6 rounded-xl shadow-lg mt-8 md:mt-16' },
        React.createElement(
            'div',
            { className: 'flex justify-between items-center mb-6' },
            React.createElement('h2', { className: 'text-3xl font-bold text-gray-800' }, 'Moje údaje'),
            React.createElement(
                'button',
                {
                    onClick: () => setShowModal(true),
                    className: `flex items-center px-4 py-2 text-white rounded-lg shadow-md transition-all duration-200 ${headerColor} hover:shadow-lg`
                },
                React.createElement(
                    'svg',
                    { className: 'h-5 w-5 mr-2', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' })
                ),
                'Upraviť'
            )
        ),
        React.createElement(
            'div',
            { className: 'space-y-4' },
            React.createElement(
                'div',
                { className: 'flex flex-col' },
                React.createElement(
                    'p',
                    { className: 'font-bold text-gray-800' },
                    'Meno:'
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg mt-1' },
                    `${userProfileData.name}`
                )
            ),
            React.createElement(
                'div',
                { className: 'flex flex-col' },
                React.createElement(
                    'p',
                    { className: 'font-bold text-gray-800' },
                    'Priezvisko:'
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg mt-1' },
                    `${userProfileData.surname}`
                )
            ),
            React.createElement(
                'div',
                { className: 'flex flex-col' },
                React.createElement(
                    'p',
                    { className: 'font-bold text-gray-800 flex items-center' },
                    'Telefónne číslo:'
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg mt-1' },
                    `${userProfileData.contactPhoneNumber}`
                )
            ),
            React.createElement(
                'div',
                { className: 'flex flex-col' },
                React.createElement(
                    'p',
                    { className: 'font-bold text-gray-800 flex items-center' },
                    'E-mailová adresa kontaktnej osoby:'
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg mt-1' },
                    `${userProfileData.email}`
                )
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
