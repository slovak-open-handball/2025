// volunteer-register.js (upravený, teraz používa globálne Firebase inštancie a je modul)
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, doc, setDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const RECAPTCHA_SITE_KEY = "6LekXLgrAAAAAB6HYeGZG-tu_N42DER2fh1aVBjF";
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec";

// Funkcia na overenie sily hesla
const validatePassword = (password) => {
    const minLength = password.length >= 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    return {
        minLength,
        hasUpperCase,
        hasLowerCase,
        hasNumber,
        hasSpecialChar,
        isValid: minLength && hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar
    };
};

function PasswordInput({ id, label, value, onChange, placeholder, autoComplete, showPassword, toggleShowPassword, onCopy, onPaste, onCut, disabled, validationStatus, onFocus }) {
    const [passwordFocused, setPasswordFocused] = React.useState(false);

    const isPasswordValid = validationStatus.isValid;
    const inputClasses = `
        mt-1 block w-full px-4 py-2 border rounded-md shadow-sm
        ${isPasswordValid ? 'border-green-400 focus:ring-green-500 focus:border-green-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'}
        ${disabled ? 'bg-gray-200 cursor-not-allowed' : 'bg-white'}
    `;

    return React.createElement(
        'div',
        { className: 'mb-4' },
        React.createElement(
            'label',
            { htmlFor: id, className: 'block text-sm font-medium text-gray-700' },
            label
        ),
        React.createElement(
            'div',
            { className: 'relative' },
            React.createElement('input', {
                type: showPassword ? 'text' : 'password',
                id: id,
                name: id,
                value: value,
                onChange: onChange,
                placeholder: placeholder,
                autoComplete: autoComplete,
                onCopy: onCopy,
                onPaste: onPaste,
                onCut: onCut,
                disabled: disabled,
                className: inputClasses,
                onFocus: () => { setPasswordFocused(true); onFocus(); },
                onBlur: () => setPasswordFocused(false)
            }),
            React.createElement('span',
                {
                    className: 'absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 cursor-pointer',
                    onClick: toggleShowPassword
                },
                React.createElement('svg', {
                    xmlns: 'http://www.w3.org/2000/svg',
                    className: 'h-5 w-5 text-gray-400 hover:text-gray-600',
                    fill: 'none',
                    viewBox: '0 0 24 24',
                    stroke: 'currentColor'
                },
                    React.createElement('path', {
                        strokeLinecap: 'round',
                        strokeLinejoin: 'round',
                        strokeWidth: '2',
                        d: showPassword ? 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' : 'M15 12a3 3 0 11-6 0 3 3 0 016 0z'
                    }),
                    React.createElement('path', {
                        strokeLinecap: 'round',
                        strokeLinejoin: 'round',
                        strokeWidth: '2',
                        d: showPassword ? 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-.417 1.157-.935 2.223-1.55 3.203' : 'M15 12a3 3 0 11-6 0 3 3 0 016 0z'
                    }),
                    React.createElement('path', {
                        strokeLinecap: 'round',
                        strokeLinejoin: 'round',
                        strokeWidth: '2',
                        d: showPassword ? 'M12 17c-4.478 0-8.268-2.943-9.542-7 .417-1.157.935-2.223 1.55-3.203' : 'M12 17c-4.478 0-8.268-2.943-9.542-7 .417-1.157.935-2.223 1.55-3.203'
                    }),
                    React.createElement('path', {
                        strokeLinecap: 'round',
                        strokeLinejoin: 'round',
                        strokeWidth: '2',
                        d: showPassword ? 'M13 14h-2M13 10h-2M16 12h-2M10 12h-2' : 'M13 14h-2M13 10h-2M16 12h-2M10 12h-2'
                    }),
                    React.createElement('path', {
                        strokeLinecap: 'round',
                        strokeLinejoin: 'round',
                        strokeWidth: '2',
                        d: showPassword ? 'M9.542 12C8.268 16.057 4.477 19 0 19' : 'M9.542 12C8.268 16.057 4.477 19 0 19'
                    })
                )
            )
        ),
        passwordFocused && React.createElement(
            'div',
            { className: 'mt-2 text-sm text-gray-600 space-y-1 p-2 rounded-md bg-gray-50' },
            React.createElement('p', { className: `flex items-center ${validationStatus.minLength ? 'text-green-500' : 'text-red-500'}` },
                React.createElement('svg', { className: 'h-4 w-4 mr-2', fill: 'currentColor', viewBox: '0 0 20 20' }, React.createElement('path', { d: validationStatus.minLength ? "M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" : "M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" })),
                'Minimálne 8 znakov'
            ),
            React.createElement('p', { className: `flex items-center ${validationStatus.hasUpperCase ? 'text-green-500' : 'text-red-500'}` },
                React.createElement('svg', { className: 'h-4 w-4 mr-2', fill: 'currentColor', viewBox: '0 0 20 20' }, React.createElement('path', { d: validationStatus.hasUpperCase ? "M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" : "M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" })),
                'Veľké písmeno'
            ),
            React.createElement('p', { className: `flex items-center ${validationStatus.hasLowerCase ? 'text-green-500' : 'text-red-500'}` },
                React.createElement('svg', { className: 'h-4 w-4 mr-2', fill: 'currentColor', viewBox: '0 0 20 20' }, React.createElement('path', { d: validationStatus.hasLowerCase ? "M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" : "M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" })),
                'Malé písmeno'
            ),
            React.createElement('p', { className: `flex items-center ${validationStatus.hasNumber ? 'text-green-500' : 'text-red-500'}` },
                React.createElement('svg', { className: 'h-4 w-4 mr-2', fill: 'currentColor', viewBox: '0 0 20 20' }, React.createElement('path', { d: validationStatus.hasNumber ? "M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" : "M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" })),
                'Číslica'
            ),
            React.createElement('p', { className: `flex items-center ${validationStatus.hasSpecialChar ? 'text-green-500' : 'text-red-500'}` },
                React.createElement('svg', { className: 'h-4 w-4 mr-2', fill: 'currentColor', viewBox: '0 0 20 20' }, React.createElement('path', { d: validationStatus.hasSpecialChar ? "M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" : "M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" })),
                'Špeciálny znak (!@#$...)'
            )
        )
    );
}

// Hlavná App komponenta pre registračný formulár
export function App() {
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [confirmPassword, setConfirmPassword] = React.useState('');
    const [firstName, setFirstName] = React.useState('');
    const [lastName, setLastName] = React.useState('');
    const [showPassword, setShowPassword] = React.useState(false);
    const [formError, setFormError] = React.useState('');
    const [successMessage, setSuccessMessage] = React.useState('');
    const [formSubmitting, setFormSubmitting] = React.useState(false);
    const [passwordTouched, setPasswordTouched] = React.useState(false);

    // Validácia hesla
    const passwordValidation = validatePassword(password);
    const passwordsMatch = password === confirmPassword;
    const isFormValid = (
        email.length > 0 &&
        firstName.length > 0 &&
        lastName.length > 0 &&
        passwordValidation.isValid &&
        passwordsMatch
    );

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setFormSubmitting(true);
        setFormError('');
        setSuccessMessage('');

        if (!window.auth || !window.db) {
            setFormError('Firebase nie je inicializovaný. Skúste obnoviť stránku.');
            setFormSubmitting(false);
            return;
        }

        if (!isFormValid) {
            setFormError('Prosím, vyplňte všetky polia a overte heslo.');
            setFormSubmitting(false);
            return;
        }

        try {
            // Vytvorenie používateľa vo Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(window.auth, email, password);
            const user = userCredential.user;

            // Uloženie profilu dobrovoľníka do Firestore
            await setDoc(doc(window.db, "artifacts", window.__app_id, "users", user.uid), {
                email: user.email,
                firstName: firstName,
                lastName: lastName,
                role: 'volunteer', // Nastavujeme rolu na 'volunteer'
                approved: true, // Nastavujeme 'approved' na true
                registrationDate: serverTimestamp(),
                lastLogin: serverTimestamp(),
            });

            // Odoslanie údajov do Google Apps Script
            const formData = new FormData();
            formData.append('email', email);
            formData.append('firstName', firstName);
            formData.append('lastName', lastName);
            formData.append('role', 'volunteer');

            await fetch(GOOGLE_APPS_SCRIPT_URL, {
                method: 'POST',
                body: formData
            });

            setSuccessMessage("Registrácia bola úspešná! Budete automaticky presmerovaný.");
            setFormSubmitting(false);

            setTimeout(() => {
                window.location.href = "index.html";
            }, 3000);

        } catch (error) {
            setFormSubmitting(false);
            switch (error.code) {
                case 'auth/email-already-in-use':
                    setFormError('E-mail je už používaný. Prosím, použite iný.');
                    break;
                case 'auth/weak-password':
                    setFormError('Heslo je príliš slabé. Použite silnejšie heslo.');
                    break;
                case 'auth/invalid-email':
                    setFormError('Neplatný formát e-mailu.');
                    break;
                default:
                    console.error("Registračná chyba:", error);
                    setFormError('Registrácia zlyhala. Skúste to prosím znova.');
                    break;
            }
        }
    };

    const buttonClasses = `
        w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white
        transition-all duration-300 ease-in-out
        ${isFormValid ? 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500' : 'bg-gray-400 cursor-not-allowed'}
    `;

    return React.createElement(
        'div',
        { className: "min-h-screen bg-gray-100 flex items-center justify-center" },
        React.createElement(
            'div',
            { className: "bg-white p-8 rounded-lg shadow-xl w-full max-w-md mx-4" },
            React.createElement(
                'h2',
                { className: "text-2xl font-bold text-center text-gray-800 mb-6" },
                'Registrácia dobrovoľníka'
            ),
            formError && React.createElement(
                'div',
                { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4', role: 'alert' },
                React.createElement('span', { className: 'block sm:inline' }, formError)
            ),
            successMessage && React.createElement(
                'div',
                { className: 'bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4', role: 'alert' },
                React.createElement('span', { className: 'block sm:inline' }, successMessage)
            ),
            React.createElement(
                'form',
                { onSubmit: handleFormSubmit, noValidate: true },
                // Meno
                React.createElement(
                    'div',
                    { className: 'mb-4' },
                    React.createElement(
                        'label',
                        { htmlFor: 'firstName', className: 'block text-sm font-medium text-gray-700' },
                        'Meno'
                    ),
                    React.createElement('input', {
                        type: 'text',
                        id: 'firstName',
                        name: 'firstName',
                        value: firstName,
                        onChange: (e) => setFirstName(e.target.value),
                        placeholder: 'Ján',
                        autoComplete: 'given-name',
                        disabled: formSubmitting || successMessage,
                        className: 'mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm'
                    })
                ),
                // Priezvisko
                React.createElement(
                    'div',
                    { className: 'mb-4' },
                    React.createElement(
                        'label',
                        { htmlFor: 'lastName', className: 'block text-sm font-medium text-gray-700' },
                        'Priezvisko'
                    ),
                    React.createElement('input', {
                        type: 'text',
                        id: 'lastName',
                        name: 'lastName',
                        value: lastName,
                        onChange: (e) => setLastName(e.target.value),
                        placeholder: 'Novák',
                        autoComplete: 'family-name',
                        disabled: formSubmitting || successMessage,
                        className: 'mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm'
                    })
                ),
                // E-mail
                React.createElement(
                    'div',
                    { className: 'mb-4' },
                    React.createElement(
                        'label',
                        { htmlFor: 'email', className: 'block text-sm font-medium text-gray-700' },
                        'E-mail'
                    ),
                    React.createElement('input', {
                        type: 'email',
                        id: 'email',
                        name: 'email',
                        value: email,
                        onChange: (e) => setEmail(e.target.value),
                        placeholder: 'vasa.emailova.adresa@priklad.sk',
                        autoComplete: 'email',
                        disabled: formSubmitting || successMessage,
                        className: 'mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm'
                    })
                ),
                // Heslo
                React.createElement(
                    PasswordInput,
                    {
                        id: 'password',
                        label: 'Heslo',
                        value: password,
                        onChange: (e) => {
                            setPassword(e.target.value);
                            setPasswordTouched(true);
                        },
                        placeholder: '••••••••',
                        autoComplete: 'new-password',
                        showPassword: showPassword,
                        toggleShowPassword: () => setShowPassword(!showPassword),
                        disabled: formSubmitting || successMessage,
                        validationStatus: passwordValidation,
                        onFocus: () => { }
                    }
                ),
                // Potvrdenie hesla
                React.createElement(
                    'div',
                    { className: 'mb-4' },
                    React.createElement(
                        'label',
                        { htmlFor: 'confirmPassword', className: 'block text-sm font-medium text-gray-700' },
                        'Potvrdenie hesla'
                    ),
                    React.createElement('input', {
                        type: showPassword ? 'text' : 'password',
                        id: 'confirmPassword',
                        name: 'confirmPassword',
                        value: confirmPassword,
                        onChange: (e) => setConfirmPassword(e.target.value),
                        placeholder: '••••••••',
                        autoComplete: 'new-password',
                        disabled: formSubmitting || successMessage,
                        className: `mt-1 block w-full px-4 py-2 border rounded-md shadow-sm
                            ${(confirmPassword.length > 0 && !passwordsMatch) ? 'border-red-500' : 'border-gray-300'}
                            focus:ring-blue-500 focus:border-blue-500 sm:text-sm`
                    }),
                    (confirmPassword.length > 0 && !passwordsMatch) && React.createElement(
                        'p',
                        { className: 'mt-2 text-sm text-red-600' },
                        'Heslá sa nezhodujú.'
                    )
                ),
                // Tlačidlo odoslať
                React.createElement(
                    'button',
                    {
                        type: 'submit',
                        disabled: !isFormValid || formSubmitting || successMessage,
                        className: buttonClasses,
                    },
                    formSubmitting ? 'Registrujem...' : 'Registrovať sa'
                )
            )
        )
    );
}
