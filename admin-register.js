// admin-register.js
// Tento modul obsahuje hlavnú logiku a React komponent pre registráciu administrátora.
// Využíva globálne inštancie Firebase (auth, db) poskytnuté z modulu authentication.js.

// Importy pre Firebase Auth a Firestore (modulárny prístup, SDK v11)
import { createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, doc, setDoc, addDoc, serverTimestamp, getDoc, onSnapshot, updateDoc, increment } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Konštanty pre reCAPTCHA a Apps Script URL
const RECAPTCHA_SITE_KEY = "6LdJbn8rAAAAAO4C50qXTWva6ePzDlOfYwBDEDwa";
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec";

/**
 * Komponent pre zadávanie hesla s prepínačom viditeľnosti.
 * Používa dynamickú vizuálnu spätnú väzbu na základe stavu validácie hesla.
 */
function PasswordInput({ id, label, value, onChange, placeholder, autoComplete, showPassword, toggleShowPassword, onCopy, onPaste, onCut, disabled, validationStatus, onFocus }) {
    // SVG ikony pre zobrazenie/skrytie hesla
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

    const borderClass = 'border-gray-300';

    return React.createElement(
        'div',
        { className: 'mb-4' },
        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: id }, 'Heslo'),
        React.createElement(
            'div',
            { className: 'relative' },
            React.createElement('input', {
                type: showPassword ? 'text' : 'password',
                id: id,
                className: `shadow appearance-none border ${borderClass} rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10`,
                value: value,
                onChange: onChange,
                onCopy: (e) => e.preventDefault(),
                onPaste: (e) => e.preventDefault(),
                onCut: (e) => e.preventDefault(),
                required: true,
                placeholder: placeholder,
                autoComplete: 'new-password',
                disabled: disabled,
                onFocus: onFocus
            }),
            React.createElement(
                'button',
                {
                    type: 'button',
                    onClick: toggleShowPassword,
                    className: 'absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 focus:outline-none',
                    disabled: disabled,
                },
                showPassword ? EyeIcon : EyeOffIcon
            )
        )
    );
}

/**
 * Komponent pre zobrazenie notifikácií (ako dočasný box v rohu obrazovky).
 * Tento komponent sa zobrazí len na chvíľu a potom zmizne.
 */
function NotificationModal({ message, onClose, type = 'info' }) {
    const [show, setShow] = React.useState(false);
    const timerRef = React.useRef(null);

    React.useEffect(() => {
        if (message) {
            setShow(true);
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
            timerRef.current = setTimeout(() => {
                setShow(false);
                setTimeout(onClose, 500); // Wait for transition before closing
            }, 10000); // 10 sekúnd

            return () => {
                if (timerRef.current) {
                    clearTimeout(timerRef.current);
                }
            };
        }
    }, [message, onClose]);

    // Neuvádzať komponent vôbec, ak nie je k dispozícii žiadna správa
    if (!message) return null;

    let bgColorClass;
    if (type === 'success') {
        bgColorClass = 'bg-green-500';
    } else if (type === 'error') {
        bgColorClass = 'bg-red-600';
    } else {
        bgColorClass = 'bg-blue-500';
    }

    return React.createElement(
        'div',
        {
            className: `fixed bottom-4 right-4 ${bgColorClass} text-white p-4 rounded-lg shadow-lg transition-transform transform ${show ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`,
            style: { zIndex: 1000 }
        },
        React.createElement('p', { className: 'font-semibold' }, message)
    );
}

/**
 * Hlavný React komponent pre stránku registrácie administrátora.
 * Spravuje stav formulára, validáciu a komunikáciu s Firebase.
 */
function App() {
    // Získanie referencií na globálne inštancie Firebase z authentication.js
    const auth = window.auth;
    const db = window.db;
    const isAuthReady = window.isGlobalAuthReady;

    // Stavy pre správu UI a dát formulára
    const [pageLoading, setPageLoading] = React.useState(true);
    const [formSubmitting, setFormSubmitting] = React.useState(false);
    const [errorMessage, setErrorMessage] = React.useState('');
    const [successMessage, setSuccessMessage] = React.useState('');
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [confirmPassword, setConfirmPassword] = React.useState('');
    const [firstName, setFirstName] = React.useState('');
    const [lastName, setLastName] = React.useState('');
    const [showPasswordReg, setShowPasswordReg] = React.useState(false);
    const [showPasswordConf, setShowPasswordConf] = React.useState(false);
    const [recaptchaToken, setRecaptchaToken] = React.useState(null);
    const [isFormValid, setIsFormValid] = React.useState(false);
    const [passwordValidation, setPasswordValidation] = React.useState({
        length: false,
        upperCase: false,
        lowerCase: false,
        number: false,
        specialChar: false,
    });
    const [passwordMatch, setPasswordMatch] = React.useState(false);
    const recaptchaRef = React.useRef(null);
    const formRef = React.useRef(null);
    
    // Nový stav na indikáciu, že reCAPTCHA script je načítaný
    const [isRecaptchaLoaded, setIsRecaptchaLoaded] = React.useState(false);

    // Načítanie stavu autentifikácie pri načítaní stránky
    React.useEffect(() => {
        // Kontrola, či je globálny autentifikačný stav pripravený
        if (isAuthReady) {
            setPageLoading(false);
        }
    }, [isAuthReady]);

    // ReCAPTCHA V2 (checkbox)
    React.useEffect(() => {
        const loadRecaptcha = () => {
            if (typeof grecaptcha !== 'undefined' && grecaptcha.render && recaptchaRef.current) {
                grecaptcha.render(recaptchaRef.current, {
                    sitekey: RECAPTCHA_SITE_KEY,
                    callback: (token) => {
                        console.log("reCAPTCHA token acquired:", token);
                        setRecaptchaToken(token);
                    },
                    'expired-callback': () => {
                        console.log("reCAPTCHA token expired.");
                        setRecaptchaToken(null);
                    }
                });
                setIsRecaptchaLoaded(true);
            }
        };

        if (!isRecaptchaLoaded) {
            const script = document.createElement('script');
            script.src = `https://www.google.com/recaptcha/api.js?hl=sk&render=explicit`;
            script.async = true;
            script.onload = loadRecaptcha;
            document.body.appendChild(script);

            return () => {
                document.body.removeChild(script);
            };
        }
    }, [isRecaptchaLoaded]);

    const isEmailValid = React.useMemo(() => {
        // Jednoduchá kontrola formátu e-mailu
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(String(email).toLowerCase());
    }, [email]);

    React.useEffect(() => {
        const isPasswordValid = Object.values(passwordValidation).every(Boolean);
        const isPasswordsMatch = password === confirmPassword && password.length > 0;
        const areNamesValid = firstName.length > 0 && lastName.length > 0;
        const areFieldsValid = isEmailValid && areNamesValid;

        // Kontrola reCAPTCHA je zahrnutá v handleChangePassword, ale pre celkovú validáciu ju overíme tu
        const isRecaptchaValid = !!recaptchaToken;

        setIsFormValid(isPasswordValid && isPasswordsMatch && areFieldsValid && isRecaptchaValid);
    }, [email, password, confirmPassword, firstName, lastName, passwordValidation, recaptchaToken, isEmailValid]);

    const handleChangePassword = (e) => {
        const newPassword = e.target.value;
        setPassword(newPassword);
        setPasswordMatch(newPassword === confirmPassword);
        setPasswordValidation({
            length: newPassword.length >= 8,
            upperCase: /[A-Z]/.test(newPassword),
            lowerCase: /[a-z]/.test(newPassword),
            number: /[0-9]/.test(newPassword),
            specialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(newPassword),
        });
    };

    const handleConfirmPasswordChange = (e) => {
        const newConfirmPassword = e.target.value;
        setConfirmPassword(newConfirmPassword);
        setPasswordMatch(password === newConfirmPassword);
    };

    const handleRegistration = async (e) => {
        e.preventDefault();

        if (!isFormValid) {
            showNotification('Prosím, vyplňte všetky polia správne.', 'error');
            return;
        }

        setFormSubmitting(true);
        // Signalizujeme, že prebieha registrácia admina, aby sa potlačilo odhlásenie
        window.isRegisteringAdmin = true;

        try {
            // Vytvorenie používateľa pomocou Firebase
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            console.log("Používateľ úspešne zaregistrovaný v Firebase Auth:", user.uid);

            // Zápis profilových dát do Firestore s poľom `approved: false`
            await setDoc(doc(db, `users/${user.uid}`), {
                email: email,
                firstName: firstName,
                lastName: lastName,
                role: 'admin',
                approved: false,
                createdAt: serverTimestamp(),
            });

            console.log("Dáta profilu úspešne uložené vo Firestore.");

            // Odoslanie e-mailu s notifikáciou
            const emailPayload = {
                action: 'sendAdminNotification',
                email: email,
                firstName: firstName,
                lastName: lastName,
            };
            await fetch(GOOGLE_APPS_SCRIPT_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                mode: 'no-cors',
                body: JSON.stringify(emailPayload)
            });
            console.log("Notifikácia o registrácii odoslaná.");

            // Odhlásenie nového používateľa
            await signOut(auth);

            console.log("Používateľ úspešne odhlásený po registrácii.");

            showNotification('Registrácia bola úspešná. Skontrolujte svoj e-mail pre ďalšie inštrukcie.', 'success');
            
            // Po úspešnej registrácii presmerujeme používateľa na prihlasovaciu stránku
            const appYearMatch = window.location.pathname.match(/(\d{4})/);
            const appYear = appYearMatch ? appYearMatch[1] : '2025';
            const appBasePath = `/${appYear}`;
            window.location.href = `${appBasePath}/login.html?status=registration_success`;
            
        } catch (error) {
            console.error("Chyba pri registrácii:", error);
            let userMessage = "Pri registrácii nastala neočakávaná chyba.";

            switch (error.code) {
                case 'auth/email-already-in-use':
                    userMessage = 'Zadaný e-mail je už používaný. Prihláste sa, alebo použite iný e-mail.';
                    break;
                case 'auth/invalid-email':
                    userMessage = 'Nesprávny formát e-mailovej adresy.';
                    break;
                case 'auth/weak-password':
                    userMessage = 'Heslo je príliš slabé. Použite aspoň 8 znakov vrátane veľkých a malých písmen, číslic a špeciálnych znakov.';
                    break;
                default:
                    // Pre neznáme chyby pošleme detailné informácie do logov, ale používateľovi ukážeme len generickú správu
                    console.error("Detailná chyba pre vývojára:", error);
            }
            showNotification(userMessage, 'error');
        } finally {
            setFormSubmitting(false);
            window.isRegisteringAdmin = false; // Resetujeme stav
            // Resetujeme reCAPTCHA widget
            if (recaptchaRef.current && typeof grecaptcha !== 'undefined' && grecaptcha.reset) {
                grecaptcha.reset();
            }
        }
    };
    
    // Globálna funkcia na zobrazenie notifikácie
    const showNotification = (message, type) => {
        if (type === 'success') {
            setSuccessMessage(message);
            setErrorMessage('');
        } else {
            setErrorMessage(message);
            setSuccessMessage('');
        }
    };

    // Pridanie globálnej funkcie do window objektu
    React.useEffect(() => {
        window.showGlobalNotification = showNotification;
    }, []);

    // Definovanie tried pre tlačidlá na základe stavu
    const buttonClasses = `w-full rounded-lg px-6 py-3 font-semibold text-white transition-all duration-300 ease-in-out transform hover:scale-105 active:scale-95 shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
        isFormValid ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500' : 'bg-gray-400 cursor-not-allowed'
    }`;
    
    // Zobrazenie načítacieho stavu
    if (pageLoading) {
        return React.createElement(
            'div',
            { className: 'flex justify-center pt-16' },
            React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
        );
    }
    
    // Zobrazenie hlavného obsahu po načítaní
    return React.createElement(
        'div',
        { className: 'min-h-screen bg-gray-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8' },
        React.createElement(
            'div',
            { className: 'sm:mx-auto sm:w-full sm:max-w-md' },
            React.createElement('img', { className: 'mx-auto h-12 w-auto', src: 'https://placehold.co/48x48/60A5FA/ffffff?text=SOH', alt: 'SOH Logo' }),
            React.createElement('h2', { className: 'mt-6 text-center text-3xl font-extrabold text-gray-900' }, 'Registrácia nového administrátora'),
            React.createElement('p', { className: 'mt-2 text-center text-sm text-gray-600' }, 'Vyplňte formulár pre registráciu do systému.')
        ),
        React.createElement(
            'div',
            { className: 'mt-8 sm:mx-auto sm:w-full sm:max-w-md' },
            React.createElement(
                'div',
                { className: 'bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10' },
                React.createElement(
                    'form',
                    { ref: formRef, onSubmit: handleRegistration, className: 'space-y-6' },
                    // Pole pre krstné meno
                    React.createElement(
                        'div',
                        null,
                        React.createElement('label', { htmlFor: 'firstName', className: 'block text-sm font-medium text-gray-700' }, 'Krstné meno'),
                        React.createElement('input', {
                            id: 'firstName',
                            name: 'firstName',
                            type: 'text',
                            required: true,
                            value: firstName,
                            onChange: (e) => setFirstName(e.target.value),
                            className: 'mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm'
                        })
                    ),
                    // Pole pre priezvisko
                    React.createElement(
                        'div',
                        null,
                        React.createElement('label', { htmlFor: 'lastName', className: 'block text-sm font-medium text-gray-700' }, 'Priezvisko'),
                        React.createElement('input', {
                            id: 'lastName',
                            name: 'lastName',
                            type: 'text',
                            required: true,
                            value: lastName,
                            onChange: (e) => setLastName(e.target.value),
                            className: 'mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm'
                        })
                    ),
                    // Pole pre e-mail
                    React.createElement(
                        'div',
                        null,
                        React.createElement('label', { htmlFor: 'email', className: 'block text-sm font-medium text-gray-700' }, 'E-mailová adresa'),
                        React.createElement('input', {
                            id: 'email',
                            name: 'email',
                            type: 'email',
                            autoComplete: 'email',
                            required: true,
                            value: email,
                            onChange: (e) => setEmail(e.target.value),
                            className: `mt-1 block w-full rounded-lg border ${isEmailValid ? 'border-gray-300' : 'border-red-500'} shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm`
                        }),
                        !isEmailValid && email.length > 0 && React.createElement('p', { className: 'mt-2 text-sm text-red-600' }, 'Prosím, zadajte platnú e-mailovú adresu.')
                    ),
                    // Komponent pre zadávanie hesla
                    React.createElement(PasswordInput, {
                        id: 'password',
                        label: 'Heslo',
                        value: password,
                        onChange: handleChangePassword,
                        placeholder: 'Zadajte heslo',
                        autoComplete: 'new-password',
                        showPassword: showPasswordReg,
                        toggleShowPassword: () => setShowPasswordReg(!showPasswordReg),
                        disabled: formSubmitting,
                    }),
                    // Zobrazenie stavu validácie hesla
                    React.createElement(
                        'ul',
                        { className: 'list-disc list-inside text-sm text-gray-600 pl-4' },
                        React.createElement(
                            'li',
                            { className: passwordValidation.length ? 'text-green-600' : 'text-red-600' },
                            `Minimálne 8 znakov`
                        ),
                        React.createElement(
                            'li',
                            { className: passwordValidation.upperCase ? 'text-green-600' : 'text-red-600' },
                            `Aspoň jedno veľké písmeno`
                        ),
                        React.createElement(
                            'li',
                            { className: passwordValidation.lowerCase ? 'text-green-600' : 'text-red-600' },
                            `Aspoň jedno malé písmeno`
                        ),
                        React.createElement(
                            'li',
                            { className: passwordValidation.number ? 'text-green-600' : 'text-red-600' },
                            `Aspoň jedna číslica`
                        ),
                        React.createElement(
                            'li',
                            { className: passwordValidation.specialChar ? 'text-green-600' : 'text-red-600' },
                            `Aspoň jeden špeciálny znak`
                        )
                    ),
                    // Potvrdenie hesla
                    React.createElement(PasswordInput, {
                        id: 'confirmPassword',
                        label: 'Potvrdenie hesla',
                        value: confirmPassword,
                        onChange: handleConfirmPasswordChange,
                        placeholder: 'Potvrďte heslo',
                        autoComplete: 'new-password',
                        showPassword: showPasswordConf,
                        toggleShowPassword: () => setShowPasswordConf(!showPasswordConf),
                        disabled: formSubmitting,
                    }),
                    !passwordMatch && confirmPassword.length > 0 && React.createElement('p', { className: 'mt-2 text-sm text-red-600' }, 'Heslá sa nezhodujú.'),
                    // reCAPTCHA widget
                    React.createElement(
                        'div',
                        { className: 'mt-6 flex flex-col items-center' },
                        React.createElement('div', { id: 'recaptcha-container', ref: recaptchaRef })
                    ),
                    // Tlačidlo na odoslanie formulára
                    React.createElement(
                        'button',
                        {
                            type: 'submit',
                            className: buttonClasses,
                            disabled: formSubmitting || !isFormValid,
                        },
                        formSubmitting ? (
                            React.createElement(
                                'div',
                                { className: 'flex items-center justify-center' },
                                React.createElement('svg', { className: 'animate-spin -ml-1 mr-3 h-5 w-5 text-green-500', xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24' },
                                    React.createElement('circle', { className: 'opacity-25', cx: '12', cy: '12', r: '10', stroke: 'currentColor', strokeWidth: '4' }),
                                    React.createElement('path', { className: 'opacity-75', fill: 'currentColor', d: 'M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z' })
                                ),
                                'Registrujem...'
                            )
                        ) : 'Registrovať'
                    )
                )
            )
        ),
        React.createElement(NotificationModal, { message: errorMessage, onClose: () => setErrorMessage(''), type: 'error' }),
        React.createElement(NotificationModal, { message: successMessage, onClose: () => setSuccessMessage(''), type: 'success' })
    );
}

// Spustenie aplikácie po načítaní DOM
document.addEventListener('DOMContentLoaded', () => {
    // Čakáme, kým bude globálna autentifikácia pripravená
    const renderApp = () => {
        if (typeof React === 'undefined' || typeof ReactDOM === 'undefined' || typeof App === 'undefined') {
            setTimeout(renderApp, 100); // Skúsime znova po 100ms
            return;
        }

        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(React.createElement(App, null));
    };

    renderApp();
});
