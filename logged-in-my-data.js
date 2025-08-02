// Importy pre Firebase funkcie
import { getAuth, EmailAuthProvider, reauthenticateWithCredential, verifyBeforeUpdateEmail, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getFirestore, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const { useState, useEffect } = React;

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
        bgColorClass = 'bg-green-100';
        textColorClass = 'text-green-800';
    } else if (type === 'error') {
        bgColorClass = 'bg-red-100';
        textColorClass = 'text-red-800';
    } else {
        // Predvolené farby pre iné typy
        bgColorClass = 'bg-blue-100';
        textColorClass = 'text-blue-800';
    }

    // Aktualizujeme obsah a triedy
    notificationElement.innerHTML = `<p class="font-semibold">${message}</p>`;
    notificationElement.className = `fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[9999] opacity-0 transition-opacity duration-300 ${bgColorClass} ${textColorClass}`;
    
    // Zobrazíme notifikáciu (fade-in)
    setTimeout(() => {
        notificationElement.style.opacity = '1';
    }, 10);

    // Skryjeme notifikáciu po 5 sekundách (fade-out)
    setTimeout(() => {
        notificationElement.style.opacity = '0';
        setTimeout(() => {
            if (notificationElement.parentNode) {
                notificationElement.parentNode.removeChild(notificationElement);
            }
        }, 300); // Po dokončení animácie odstránime element z DOM
    }, 5000);
};

/**
 * Komponent PasswordInput pre polia hesla s prepínaním viditeľnosti.
 * Používa sa pre pole aktuálneho hesla v modálnom okne.
 */
const PasswordInput = ({ id, label, value, onChange, placeholder, showPassword, toggleShowPassword, disabled, roleColor }) => {
    // Použitie nových SVG ikon
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
    
    // Stav pre sledovanie fokusu
    const [isFocused, setIsFocused] = useState(false);

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
            { className: 'mt-1 relative rounded-lg shadow-sm' },
            React.createElement('input', {
                type: showPassword ? 'text' : 'password',
                id: id,
                name: id,
                value: value,
                onChange: onChange,
                onFocus: () => setIsFocused(true),
                onBlur: () => setIsFocused(false),
                placeholder: placeholder,
                disabled: disabled,
                className: `block w-full px-4 py-2 rounded-lg border-gray-200 pr-10 shadow-sm disabled:bg-gray-100 disabled:text-gray-500`,
                style: {
                    borderColor: isFocused ? roleColor : '',
                    outlineColor: isFocused ? roleColor : '',
                    boxShadow: isFocused ? `0 0 0 2px ${roleColor}25` : '' // Jemný tieň na focus
                }
            }),
            React.createElement(
                'button',
                {
                    type: 'button',
                    onClick: toggleShowPassword,
                    className: 'absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 focus:outline-none',
                    disabled: disabled
                },
                showPassword ? EyeIcon : EyeOffIcon
            )
        )
    );
};

/**
 * Komponent ChangeEmailModal - modálne okno pre zmenu e-mailovej adresy
 */
const ChangeEmailModal = ({ show, onClose, userProfileData, roleColor }) => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    
    // Stav pre sledovanie fokusu pre email input
    const [isEmailFocused, setIsEmailFocused] = useState(false);

    useEffect(() => {
        // Reset stavu pri zatvorení modálu
        if (!show) {
            setCurrentPassword('');
            setNewEmail('');
            setShowPassword(false);
            setLoading(false);
            setIsEmailFocused(false);
        }
    }, [show]);

    // Validácia e-mailu: musí obsahovať @, aspoň jeden znak za ním, a . s aspoň dvoma znakmi za ním
    const isEmailValid = (email) => {
        const emailRegex = /^\S+@\S+\.\S{2,}$/;
        return emailRegex.test(email);
    };

    // Validácia hesla: musí mať aspoň 10 znakov
    const isPasswordValid = (password) => {
        return password.length >= 10;
    };

    // Celková validácia formulára
    const isFormValid = isEmailValid(newEmail) && isPasswordValid(currentPassword);

    const handleEmailChange = async (e) => {
        e.preventDefault();
        setLoading(true);

        if (!isFormValid) {
            window.showGlobalNotification('Prosím, vyplňte formulár správne.', 'error');
            setLoading(false);
            return;
        }

        try {
            const auth = window.auth;
            const user = auth.currentUser;
            const credential = window.EmailAuthProvider.credential(user.email, currentPassword);

            await window.reauthenticateWithCredential(user, credential);
            console.log("Používateľ úspešne re-autentifikovaný.");

            // Použitie verifyBeforeUpdateEmail, ktoré odošle verifikačný e-mail
            await window.verifyBeforeUpdateEmail(user, newEmail);

            // Požiadavka na aktualizáciu e-mailu bola úspešne odoslaná.
            window.showGlobalNotification('Potvrďte zmenu e-mailovej adresy kliknutím na odkaz vo vašej novej e-mailovej schránke.', 'success');
            onClose();

        } catch (error) {
            let errorMessage = "Nastala chyba pri zmene e-mailovej adresy.";
            if (error.code === 'auth/wrong-password') {
                errorMessage = "Nesprávne heslo. Skúste to znova.";
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = "Neplatný formát e-mailu.";
            } else if (error.code === 'auth/requires-recent-login') {
                errorMessage = "Pre túto akciu sa musíte znova prihlásiť.";
            } else if (error.code === 'auth/email-already-in-use') {
                errorMessage = "Táto e-mailová adresa sa už používa.";
            }
            window.showGlobalNotification(errorMessage, 'error');
            console.error("Chyba pri zmene e-mailu:", error);
        } finally {
            setLoading(false);
        }
    };

    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword);
    };

    if (!show) {
        return null;
    }

    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center p-4' },
        React.createElement(
            'div',
            { className: 'relative p-8 border w-full max-w-2xl shadow-lg rounded-lg bg-white' },
            React.createElement(
                'div',
                { className: 'flex justify-between items-center pb-3 border-b-2 mb-4' },
                React.createElement(
                    'h3',
                    { className: 'text-2xl font-semibold text-gray-900' },
                    'Zmeniť e-mailovú adresu'
                ),
                React.createElement(
                    'button',
                    { onClick: onClose, className: 'text-gray-400 hover:text-gray-600' },
                    React.createElement(
                        'svg',
                        { className: 'h-6 w-6', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M6 18L18 6M6 6l12 12' })
                    )
                )
            ),
            React.createElement(
                'form',
                { onSubmit: handleEmailChange, className: 'space-y-6' },
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
                        React.createElement('input', {
                            id: 'new-email',
                            name: 'new-email',
                            type: 'email',
                            autoComplete: 'new-email',
                            required: true,
                            value: newEmail,
                            onChange: (e) => setNewEmail(e.target.value),
                            onFocus: () => setIsEmailFocused(true),
                            onBlur: () => setIsEmailFocused(false),
                            placeholder: 'Zadajte novú e-mailovú adresu',
                            disabled: loading,
                            className: 'block w-full px-4 py-2 rounded-lg border-gray-200 shadow-sm disabled:bg-gray-100 disabled:text-gray-500',
                            style: {
                                borderColor: isEmailFocused ? roleColor : '',
                                outlineColor: isEmailFocused ? roleColor : '',
                                boxShadow: isEmailFocused ? `0 0 0 2px ${roleColor}25` : ''
                            }
                        })
                    )
                ),
                React.createElement(PasswordInput, {
                    id: 'current-password',
                    label: 'Aktuálne heslo',
                    value: currentPassword,
                    onChange: (e) => setCurrentPassword(e.target.value),
                    placeholder: 'Zadajte svoje aktuálne heslo pre potvrdenie',
                    showPassword: showPassword,
                    toggleShowPassword: togglePasswordVisibility,
                    disabled: loading,
                    roleColor: roleColor
                }),
                React.createElement(
                    'div',
                    { className: 'flex justify-end space-x-3' },
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: onClose,
                            disabled: loading,
                            className: 'px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50'
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            type: 'submit',
                            disabled: loading || !isFormValid,
                            className: `px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 transition-colors duration-200`,
                            style: {
                                backgroundColor: isFormValid ? roleColor : 'white',
                                color: isFormValid ? 'white' : roleColor,
                                borderColor: isFormValid ? 'transparent' : roleColor,
                                borderWidth: isFormValid ? '0px' : '1px'
                            }
                        },
                        loading ? 'Ukladám...' : 'Uložiť zmeny'
                    )
                )
            )
        )
    );
};


/**
 * Komponenta pre zobrazenie profilových dát
 * Aplikácia bola prispôsobená pre React
 */
const MyDataApp = () => {
    // Definujeme stavy aplikácie
    const [userProfileData, setUserProfileData] = useState(window.globalUserProfileData);
    const [showModal, setShowModal] = useState(false);

    // Načítanie dát pri prvom renderovaní a nastavenie listeneru
    useEffect(() => {
        const handleDataUpdate = (event) => {
            console.log("logged-in-my-data.js: Prijatá udalosť 'globalDataUpdated'. Aktualizujem stav.");
            setUserProfileData(event.detail);
        };
        window.addEventListener('globalDataUpdated', handleDataUpdate);

        // Upratovanie pri odpojení komponentu
        return () => {
            window.removeEventListener('globalDataUpdated', handleDataUpdate);
        };
    }, []);

    // Funkcia na získanie farby na základe roly
    const getRoleColor = (role) => {
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
    
    // Zobrazíme spinner, kým sa načítajú dáta
    if (!userProfileData) {
        return React.createElement(
            'div',
            { className: 'flex justify-center pt-16' },
            React.createElement(
                'div',
                { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' }
            )
        );
    }
    
    const { role, firstName, lastName, email } = userProfileData;
    const headerColor = getRoleColor(role);

    return React.createElement(
        'div',
        { className: 'relative flex flex-col items-center pt-12' },
        React.createElement(
            'div',
            {
                className: 'w-full max-w-2xl mx-auto rounded-xl shadow-lg overflow-hidden',
                style: { marginBottom: '2rem' } // Pridaný spodný margin
            },
            React.createElement(
                'div',
                {
                    className: 'w-full p-4 text-white flex justify-between items-center',
                    style: { backgroundColor: headerColor, borderBottomLeftRadius: '0', borderBottomRightRadius: '0' }
                },
                React.createElement(
                    'h1',
                    { className: 'text-2xl font-bold' },
                    'Kontaktná osoba'
                ),
                React.createElement(
                    'button',
                    {
                        onClick: () => setShowModal(true),
                        className: 'p-2 rounded-full hover:bg-white hover:bg-opacity-20 transition-colors duration-200'
                    },
                    React.createElement(
                        'svg',
                        { className: 'h-6 w-6 text-white', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' })
                    )
                )
            ),
            React.createElement(
                'div',
                { className: 'bg-white p-8 space-y-6' },
                React.createElement(
                    'div',
                    { className: 'flex flex-col' },
                    React.createElement(
                        'p',
                        { className: 'font-bold text-gray-800 flex items-center' },
                        'Meno a priezvisko kontaktnej osoby:'
                    ),
                    React.createElement(
                        'p',
                        { className: 'text-gray-800 text-lg mt-1' },
                        `${userProfileData.firstName} ${userProfileData.lastName}`
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
            )
        ),
        React.createElement(ChangeEmailModal, {
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
