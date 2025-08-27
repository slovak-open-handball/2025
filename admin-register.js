// admin-register.js
// Tento modul obsahuje hlavnú logiku a React komponent pre registráciu administrátora.
// Využíva globálne inštancie Firebase (auth, db) poskytnuté z modulu authentication.js.

// Importy pre Firebase Auth a Firestore (modulárny prístup, SDK v11)
import { createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, doc, setDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: id }, label),
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
                autoComplete: autoComplete,
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
        ),
        // Zobrazenie zoznamu požiadaviek na heslo, ak je stav validácie definovaný
        validationStatus && React.createElement(
            'div',
            { className: `text-xs italic mt-1 text-gray-600` },
            'Heslo musí obsahovať:',
            React.createElement(
                'ul',
                { className: 'list-none pl-4' },
                React.createElement(
                    'li',
                    { className: `flex items-center ${validationStatus.minLength ? 'text-green-600' : 'text-gray-600'}` },
                    React.createElement('span', { className: 'mr-2' }, validationStatus.minLength ? '✔' : '•'),
                    'aspoň 10 znakov,'
                ),
                React.createElement(
                    'li',
                    { className: `flex items-center ${validationStatus.hasUpperCase ? 'text-green-600' : 'text-gray-600'}` },
                    React.createElement('span', { className: 'mr-2' }, validationStatus.hasUpperCase ? '✔' : '•'),
                    'aspoň jedno veľké písmeno,'
                ),
                React.createElement(
                    'li',
                    { className: `flex items-center ${validationStatus.hasLowerCase ? 'text-green-600' : 'text-gray-600'}` },
                    React.createElement('span', { className: 'mr-2' }, validationStatus.hasLowerCase ? '✔' : '•'),
                    'aspoň jedno malé písmeno,'
                ),
                React.createElement(
                    'li',
                    { className: `flex items-center ${validationStatus.hasNumber ? 'text-green-600' : 'text-gray-600'}` },
                    React.createElement('span', { className: 'mr-2' }, validationStatus.hasNumber ? '✔' : '•'),
                    'aspoň jednu číslicu.'
                )
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
    const [showConfirmPasswordReg, setShowConfirmPasswordReg] = React.useState(false);
    
    // Stavy pre sledovanie validácie hesla a e-mailu
    const [passwordValidationStatus, setPasswordValidationStatus] = React.useState({
        minLength: false,
        maxLength: false,
        hasUpperCase: false,
        hasLowerCase: false,
        hasNumber: false,
        isValid: false,
    });
    const [isConfirmPasswordMatching, setIsConfirmPasswordMatching] = React.useState(false);
    const [confirmPasswordTouched, setConfirmPasswordTouched] = React.useState(false);
    const [emailTouched, setEmailTouched] = React.useState(false);

    // Efekt pre overenie pripravenosti Firebase inštancií
    React.useEffect(() => {
        if (auth && db && isAuthReady) {
            setPageLoading(false);
        } else {
            console.log("AdminRegisterApp: Waiting for Auth and DB initialization from authentication.js.");
        }
    }, [auth, db, isAuthReady]);

    // Efekt pre validáciu hesla pri každej zmene
    React.useEffect(() => {
        const pwdStatus = validatePassword(password);
        setPasswordValidationStatus(pwdStatus);
        setIsConfirmPasswordMatching(password === confirmPassword && password.length > 0 && pwdStatus.isValid);
    }, [password, confirmPassword]);

    // Asynchrónna funkcia pre spracovanie registrácie
    const handleRegisterAdmin = async (e) => {
        e.preventDefault();
        
        // Predbežná kontrola, či sú Firebase inštancie k dispozícii
        if (!auth || !db) {
            setErrorMessage("Firebase Auth alebo Firestore nie je inicializovaný.");
            return;
        }
        
        // Kontrola, či sú všetky polia vyplnené
        if (!firstName.trim() || !lastName.trim() || !email.trim() || !password || !confirmPassword) {
            setErrorMessage("Vyplňte prosím všetky povinné polia.");
            return;
        }
        
        // Validácia e-mailu a hesla
        if (!validateEmail(email)) {
            setErrorMessage("Zadajte platnú e-mailovú adresu.");
            return;
        }
        if (password !== confirmPassword) {
            setErrorMessage("Heslá sa nezhodujú. Skontrolujte ich prosím.");
            return;
        }
        if (!passwordValidationStatus.isValid) {
            setErrorMessage("Heslo nespĺňa všetky požiadavky. Skontrolujte prosím zoznam pod heslom.");
            return;
        }
        
        // Získanie reCAPTCHA tokenu na overenie, že nejde o robota
        const recaptchaToken = await getRecaptchaToken('admin_register');
        if (!recaptchaToken) {
            return;
        }
        console.log("reCAPTCHA Token pre registráciu admina:", recaptchaToken);

        // Začiatok odosielania formulára, zobrazenie spinnera
        setFormSubmitting(true);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            // Krok 1: Vytvorenie používateľa vo Firebase Authentication
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);

            // Krok 2: Uloženie počiatočných údajov používateľa do Firestore
            const userDataToSave = {
                email: email,
                firstName: firstName,
                lastName: lastName,
                displayName: `${firstName} ${lastName}`,
                role: 'admin',
                approved: false, // Nový administrátor čaká na schválenie
                registrationDate: serverTimestamp(),
                displayNotifications: true,
                passwordLastChanged: serverTimestamp()
            };

            console.log("Attempting to save user to Firestore with initial data:", userDataToSave);

            try {
                // Nový používateľ sa ukladá na rovnaké miesto ako v register.js
                const userId = userCredential.user.uid;
                const userDocRef = doc(db, 'users', userId);
                await setDoc(userDocRef, userDataToSave);
                console.log(`Firestore: User ${email} with role 'admin' and approval 'false' was saved to the 'users' collection.`);
            } catch (firestoreError) {
                console.error("Error saving/updating Firestore:", firestoreError);
                setErrorMessage(`Chyba pri ukladaní používateľa do databázy: ${firestoreError.message}. Skontrolujte bezpečnostné pravidlá Firebase.`);
                // Odhlásenie pri chybe, aby sa zabránilo nekonečnej slučke
                await signOut(auth);
                return;
            }
            
            // Krok 3: Poslanie notifikácie na Google Apps Script (e-mail)
            try {
                const payload = {
                    action: 'sendRegistrationEmail',
                    email: email,
                    isAdmin: true,
                    firstName: firstName,
                    lastName: lastName,
                };
                console.log("Sending data to Apps Script (admin registration email):", payload);
                
                await fetch(GOOGLE_APPS_SCRIPT_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    mode: 'no-cors',
                    body: JSON.stringify(payload)
                });

                console.log("Response from Apps Script (admin registration email) with no-cors: OK");

            } catch (emailError) {
                console.error("Error sending admin registration email via Apps Script (fetch error):", emailError);
                setErrorMessage(`Registrácia úspešná, ale nepodarilo sa odoslať potvrdzovací e-mail: ${emailError.message}.`);
            }
            
            // Krok 4: Uloženie notifikácie do Firestore pre ostatných administrátorov
            try {
                const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
                const notificationMessage = `Nový administrátor ${email} sa zaregistroval a čaká na schválenie.`;
                const adminNotificationsCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'adminNotifications');
                
                await addDoc(adminNotificationsCollectionRef, {
                    message: notificationMessage,
                    timestamp: serverTimestamp(),
                    recipientId: 'all_admins',
                    read: false
                });
                console.log("Notification about new administrator registration successfully saved to Firestore.");
            } catch (e) {
                console.error("App: Error saving notification about administrator registration:", e);
            }

            // Nastavenie správy o úspešnej registrácii a zastavenie spinnera
            setSuccessMessage(`Administrátorský účet pre ${email} sa registruje. Na vašu e-mailovú adresu sme poslali potvrdenie o registrácii. Pre plnú aktiváciu počkajte prosím na schválenie od iného administrátora.`);

            // Odhlásenie, aby nový admin nebol automaticky prihlásený.
            // Toto sa vykoná až po úspešnom zápise do databázy a odoslaní e-mailu.
            await signOut(auth);

        } catch (e) {
            console.error("Error during registration (Auth or other):", e);
            // Spracovanie chýb z Firebase Auth
            if (e.code === 'auth/email-already-in-use') {
                setErrorMessage("E-mailová adresa už existuje. Vyberte prosím inú.");
            } else if (e.code === 'auth/weak-password') {
                setErrorMessage("Heslo je príliš slabé. " + e.message);
            } else if (e.code === 'auth/invalid-email') {
                setErrorMessage("Neplatný formát e-mailovej adresy.");
            } else {
                setErrorMessage(`Chyba pri registrácii: ${e.message}`);
            }
        } finally {
             // Vždy zastaviť načítavanie po pokuse o registráciu
            setFormSubmitting(false);
        }
    };

    // Funkcia na validáciu hesla podľa požiadaviek
    const validatePassword = (pwd) => {
        const status = {
            minLength: pwd.length >= 10,
            maxLength: pwd.length <= 4096,
            hasUpperCase: /[A-Z]/.test(pwd),
            hasLowerCase: /[a-z]/.test(pwd),
            hasNumber: /[0-9]/.test(pwd),
        };
        status.isValid = status.minLength && status.maxLength && status.hasUpperCase && status.hasLowerCase && status.hasNumber;
        return status;
    };

    // Funkcia na validáciu e-mailovej adresy
    const validateEmail = (email) => {
        const atIndex = email.indexOf('@');
        if (atIndex === -1) return false;

        const domainPart = email.substring(atIndex + 1);
        const dotIndexInDomain = domainPart.indexOf('.');
        if (dotIndexInDomain === -1) return false;
        
        const lastDotIndex = email.lastIndexOf('.');
        if (lastDotIndex === -1 || lastDotIndex < atIndex) return false;
        
        const charsAfterLastDot = email.substring(lastDotIndex + 1);
        return charsAfterLastDot.length >= 2;
    };

    // Funkcia na získanie reCAPTCHA tokenu
    const getRecaptchaToken = async (action) => {
        if (typeof grecaptcha === 'undefined' || !grecaptcha.execute) {
            setErrorMessage("reCAPTCHA API nie je načítané alebo pripravené.");
            return null;
        }
        try {
            const token = await grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: action });
            return token;
        } catch (e) {
            console.error("Chyba pri získavaní reCAPTCHA tokenu:", e);
            setErrorMessage(`Chyba reCAPTCHA: ${e.message}`);
            return null;
        }
    };

    // Celková kontrola platnosti formulára
    const isFormValid = firstName.trim() !== '' &&
        lastName.trim() !== '' &&
        email.trim() !== '' &&
        validateEmail(email) &&
        passwordValidationStatus.isValid &&
        isConfirmPasswordMatching;

    // Zobrazenie načítavacej obrazovky pri inicializácii
    if (pageLoading) {
        return React.createElement(
            'div',
            { className: 'flex items-center justify-center min-h-screen bg-gray-100' },
            React.createElement('div', { className: 'text-xl font-semibold text-gray-700' }, 'Načítavam...')
        );
    }

    // Zobrazenie stránky s úspešným dokončením registrácie
    if (successMessage) {
        return React.createElement(
            'div',
            { className: 'min-h-screen bg-gray-100 flex flex-col items-center justify-center font-inter overflow-y-auto' },
            React.createElement(
                'div',
                { className: 'w-full max-w-md mt-20 mb-10 p-4' },
                React.createElement(
                    'div',
                    { className: 'bg-green-700 text-white p-8 rounded-lg shadow-xl w-full text-center' },
                    React.createElement('h1', { className: 'text-3xl font-bold text-center text-white mb-6' }, 'Registrácia úspešná!'),
                    React.createElement(
                        'p',
                        { className: 'text-white' },
                        successMessage
                    ),
                    React.createElement(
                        'button',
                        {
                            onClick: () => { window.location.href = 'login.html'; },
                            className: 'mt-6 bg-white text-green-700 font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200 hover:bg-gray-200'
                        },
                        'Prejsť na prihlásenie'
                    )
                )
            )
        );
    }

    // Dynamické triedy pre tlačidlo
    const buttonClasses = `
        font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200
        ${formSubmitting || !isFormValid
            ? 'bg-white text-green-500 border border-green-500 cursor-not-allowed'
            : 'bg-green-500 hover:bg-green-700 text-white'
        }
    `;

    // Zobrazenie registračného formulára
    return React.createElement(
        'div',
        { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
        // Zobrazenie modálneho okna pre notifikácie
        errorMessage && React.createElement(NotificationModal, {
            message: errorMessage,
            onClose: () => setErrorMessage(''),
            type: 'error'
        }),
        React.createElement(
            'div',
            { className: 'w-full max-w-md mt-20 mb-10 p-4' },
            React.createElement(
                'div',
                { className: 'bg-white p-8 rounded-lg shadow-xl w-full' },
                // Zobrazenie chybového hlásenia nad formulárom
                errorMessage && React.createElement(
                    'div',
                    { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap', role: 'alert' },
                    errorMessage
                ),
                React.createElement('h1', { className: 'text-3xl font-bold text-center text-gray-800 mb-6' }, 'Registrácia administrátora'),
                React.createElement(
                    'form',
                    { onSubmit: handleRegisterAdmin, className: 'space-y-4' },
                    // Polia formulára
                    React.createElement(
                        'div',
                        null,
                        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'reg-first-name' }, 'Meno'),
                        React.createElement('input', {
                            type: 'text',
                            id: 'reg-first-name',
                            className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                            value: firstName,
                            onChange: (e) => setFirstName(e.target.value),
                            required: true,
                            placeholder: 'Zadajte svoje meno',
                            autoComplete: 'given-name',
                            disabled: formSubmitting,
                        })
                    ),
                    React.createElement(
                        'div',
                        null,
                        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'reg-last-name' }, 'Priezvisko'),
                        React.createElement('input', {
                            type: 'text',
                            id: 'reg-last-name',
                            className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                            value: lastName,
                            onChange: (e) => setLastName(e.target.value),
                            required: true,
                            placeholder: 'Zadajte svoje priezvisko',
                            autoComplete: 'family-name',
                            disabled: formSubmitting,
                        })
                    ),
                    React.createElement(
                        'div',
                        null,
                        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'reg-email' }, 'E-mailová adresa'),
                        React.createElement('input', {
                            type: 'email',
                            id: 'reg-email',
                            className: `shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 ${emailTouched && email.trim() !== '' && !validateEmail(email) ? 'border-red-500' : ''}`,
                            value: email,
                            onChange: (e) => setEmail(e.target.value),
                            onFocus: () => setEmailTouched(true),
                            required: true,
                            placeholder: 'Zadajte svoju e-mailovú adresu',
                            autoComplete: 'email',
                            disabled: formSubmitting,
                        }),
                        emailTouched && email.trim() !== '' && !validateEmail(email) &&
                        React.createElement(
                            'p',
                            { className: 'text-red-500 text-xs italic mt-1' },
                            'Zadajte platnú e-mailovú adresu.'
                        )
                    ),
                    // Komponent pre zadanie hesla
                    React.createElement(PasswordInput, {
                        id: 'reg-password',
                        label: 'Heslo',
                        value: password,
                        onChange: (e) => setPassword(e.target.value),
                        onCopy: (e) => e.preventDefault(),
                        onPaste: (e) => e.preventDefault(),
                        onCut: (e) => e.preventDefault(),
                        placeholder: 'Zvoľte si heslo',
                        autoComplete: 'new-password',
                        showPassword: showPasswordReg,
                        toggleShowPassword: () => setShowPasswordReg(!showPasswordReg),
                        disabled: formSubmitting,
                        validationStatus: passwordValidationStatus
                    }),
                    // Komponent pre potvrdenie hesla
                    React.createElement(PasswordInput, {
                        id: 'reg-confirm-password',
                        label: 'Potvrdiť heslo',
                        value: confirmPassword,
                        onChange: (e) => {
                            setConfirmPassword(e.target.value);
                            setConfirmPasswordTouched(true);
                        },
                        onFocus: () => setConfirmPasswordTouched(true),
                        onCopy: (e) => e.preventDefault(),
                        onPaste: (e) => e.preventDefault(),
                        onCut: (e) => e.preventDefault(),
                        placeholder: 'Potvrďte heslo',
                        autoComplete: 'new-password',
                        showPassword: showConfirmPasswordReg,
                        toggleShowPassword: () => setShowConfirmPasswordReg(!showConfirmPasswordReg),
                        disabled: formSubmitting,
                    }),
                    // Zobrazenie chybového hlásenia, ak sa heslá nezhodujú
                    !isConfirmPasswordMatching && confirmPassword.length > 0 && confirmPasswordTouched &&
                    React.createElement(
                        'p',
                        { className: 'text-red-500 text-xs italic mt-1' },
                        'Heslá sa nezhodujú'
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
        )
    );
}

// Exportovanie komponentu, aby bol dostupný pre iné moduly
window.App = App;
