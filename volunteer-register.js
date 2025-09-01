import './authentication.js';
// volunteer-register.js
// Obsahuje logiku pre registráciu dobrovoľníkov

// Explicitne importujte funkcie pre Firebase Auth a Firestore pre modulárny prístup (SDK v11)
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Google Apps Script URL pre synchronizáciu dát
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec";

// React komponenta pre zadávanie hesla
function PasswordInput({ id, label, value, onChange, placeholder, autoComplete, showPassword, toggleShowPassword, onCopy, onPaste, onCut, disabled, validationStatus, onFocus }) {
    // Ikony pre zobrazenie/skrytie hesla
    const eyeIcon = React.createElement(
        'svg',
        {
            xmlns: 'http://www.w3.org/2000/svg',
            viewBox: '0 0 24 24',
            fill: 'currentColor',
            className: 'w-5 h-5'
        },
        React.createElement('path', { d: 'M12 15a3 3 0 100-6 3 3 0 000 6z' }),
        React.createElement('path', {
            'fillRule': 'evenodd',
            d: 'M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.972 0 9.187 3.223 10.675 7.697a1.75 1.75 0 000 1.056c-1.487 4.475-5.702 7.697-10.674 7.697-4.973 0-9.188-3.223-10.675-7.697a1.75 1.75 0 000-1.056zM12 17.25a5.25 5.25 0 100-10.5 5.25 5.25 0 000 10.5z',
            'clipRule': 'evenodd'
        })
    );
    const eyeSlashIcon = React.createElement(
        'svg',
        {
            xmlns: 'http://www.w3.org/2000/svg',
            viewBox: '0 0 24 24',
            fill: 'currentColor',
            className: 'w-5 h-5'
        },
        React.createElement('path', { d: 'M3.53 2.47a.75.75 0 00-1.06 1.06l18 18a.75.75 0 101.06-1.06l-18-18z' }),
        React.createElement('path', {
            'fillRule': 'evenodd',
            d: 'M22.625 10.758a1.75 1.75 0 000-1.516c-1.487-4.475-5.702-7.697-10.674-7.697-1.995 0-3.856.425-5.597 1.144a.75.75 0 00-.735 1.342 1.75 1.75 0 01-.796.883C.811 9.92 1.95 12.448 3.447 13.945a.75.75 0 001.06 1.06l18.001-18zM12.001 20.25c-2.483 0-4.757-.751-6.738-1.996a.75.75 0 00-.515.656c-1.488 4.475-5.702 7.697-10.675 7.697a1.75 1.75 0 01-1.285-.544.75.75 0 00-1.06 1.06l18 18a.75.75 0 001.06 1.06z',
            'clipRule': 'evenodd'
        })
    );

    let borderColor = 'border-gray-300';
    let ringColor = 'ring-gray-300';
    if (validationStatus === 'valid') {
        borderColor = 'border-green-500';
        ringColor = 'ring-green-500';
    } else if (validationStatus === 'invalid') {
        borderColor = 'border-red-500';
        ringColor = 'ring-red-500';
    }

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
            { className: 'relative mt-1 rounded-md shadow-sm' },
            React.createElement('input', {
                type: showPassword ? 'text' : 'password',
                id: id,
                name: id,
                value: value,
                onChange: onChange,
                onCut: onCut,
                onCopy: onCopy,
                onPaste: onPaste,
                onFocus: onFocus,
                placeholder: placeholder,
                autoComplete: autoComplete,
                disabled: disabled,
                className: `block w-full rounded-md border-0 py-2.5 px-4 text-gray-900 ring-1 ring-inset ${ringColor} placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 pr-10 transition duration-300 ${borderColor}`
            }),
            React.createElement(
                'button',
                {
                    type: 'button',
                    onClick: toggleShowPassword,
                    className: 'absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 text-gray-500 hover:text-blue-600 transition duration-300',
                    disabled: disabled
                },
                showPassword ? eyeSlashIcon : eyeIcon
            )
        )
    );
}

// Hlavný komponent aplikácie
function App() {
    const [firstName, setFirstName] = React.useState('');
    const [lastName, setLastName] = React.useState('');
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [confirmPassword, setConfirmPassword] = React.useState('');
    const [successMessage, setSuccessMessage] = React.useState('');
    const [errorMessage, setErrorMessage] = React.useState('');
    const [formSubmitting, setFormSubmitting] = React.useState(false);

    // Stavy pre validáciu hesla
    const [passwordFocused, setPasswordFocused] = React.useState(false);
    const [passwordValid, setPasswordValid] = React.useState(false);
    const [confirmPasswordTouched, setConfirmPasswordTouched] = React.useState(false);

    // Stavy pre zobrazenie/skrytie hesla
    const [showPassword, setShowPassword] = React.useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

    // Regulárne výrazy pre validáciu hesla
    const hasNumber = /[0-9]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    const hasMinLength = password.length >= 8;

    const isPasswordValid = hasNumber && hasLowercase && hasUppercase && hasSpecialChar && hasMinLength;
    const isConfirmPasswordMatching = password === confirmPassword;
    const isFormValid = isPasswordValid && isConfirmPasswordMatching && firstName.trim() !== '' && lastName.trim() !== '' && email.trim() !== '';

    React.useEffect(() => {
        setPasswordValid(isPasswordValid);
    }, [isPasswordValid]);

    const handlePasswordChange = (e) => {
        const newPassword = e.target.value;
        setPassword(newPassword);
        if (confirmPasswordTouched) {
            setConfirmPasswordTouched(true);
        }
    };

    const handleConfirmPasswordChange = (e) => {
        const newConfirmPassword = e.target.value;
        setConfirmPassword(newConfirmPassword);
        setConfirmPasswordTouched(true);
    };

    const toggleShowPassword = () => setShowPassword(!showPassword);
    const toggleShowConfirmPassword = () => setShowConfirmPassword(!showConfirmPassword);

    // Obsluha formulára
    const handleRegister = async (event) => {
        event.preventDefault();
        setFormSubmitting(true);
        setErrorMessage('');
        setSuccessMessage('');

        if (!isFormValid) {
            setErrorMessage('Prosím, vyplňte všetky polia správne.');
            setFormSubmitting(false);
            return;
        }

        try {
            const auth = window.auth;
            const db = window.db;

            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            await setDoc(doc(db, "artifacts", window.appId, "users", user.uid, "userProfile", "profile"), {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                email: email.trim(),
                role: 'volunteer',
                approved: true,
                registrationDate: serverTimestamp(),
            });

            // Odoslanie dát do Google Apps Script pre synchronizáciu
            const formData = new FormData();
            formData.append('firstName', firstName.trim());
            formData.append('lastName', lastName.trim());
            formData.append('email', email.trim());
            formData.append('role', 'volunteer');
            formData.append('timestamp', new Date().toISOString());

            const scriptResponse = await fetch(GOOGLE_APPS_SCRIPT_URL, {
                method: 'POST',
                body: formData
            });

            if (!scriptResponse.ok) {
                console.error("Chyba pri odosielaní dát do Google Apps Script.");
                setErrorMessage('Registrácia bola úspešná, ale nastala chyba pri synchronizácii dát. Skúste to neskôr.');
            } else {
                setSuccessMessage('Registrácia bola úspešná! Vitajte v tíme dobrovoľníkov.');
                setFirstName('');
                setLastName('');
                setEmail('');
                setPassword('');
                setConfirmPassword('');
                setPasswordFocused(false);
                setPasswordValid(false);
                setConfirmPasswordTouched(false);
            }

        } catch (error) {
            console.error("Chyba pri registrácii:", error);
            let errorMessageText = 'Nepodarilo sa zaregistrovať. Prosím, skúste to znova.';
            if (error.code === 'auth/email-already-in-use') {
                errorMessageText = 'Tento e-mail je už použitý. Prosím, použite iný e-mail.';
            } else if (error.code === 'auth/invalid-email') {
                errorMessageText = 'Neplatný formát e-mailu. Prosím, zadajte platný e-mail.';
            }
            setErrorMessage(errorMessageText);
        } finally {
            setFormSubmitting(false);
        }
    };

    // Dynamické triedy pre tlačidlo
    const buttonClasses = `w-full rounded-md px-4 py-2.5 font-bold transition duration-300 transform ${
        isFormValid && !formSubmitting ? 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105' : 'bg-gray-400 text-gray-700 cursor-not-allowed'
    }`;

    // Renderovanie celého komponentu pomocou React.createElement
    return React.createElement(
        'div',
        { className: 'w-full max-w-lg mx-auto bg-white rounded-lg shadow-lg p-8 transition-transform transform scale-100 md:scale-105' },
        React.createElement(
            'h1',
            { className: 'text-2xl font-bold text-center text-gray-800 mb-6' },
            'Registrácia dobrovoľníkov'
        ),
        React.createElement(
            'p',
            { className: 'text-center text-gray-600 mb-8' },
            'Vitajte v tíme! Pripojte sa k nám a pomôžte nám zorganizovať skvelý turnaj.'
        ),
        successMessage && React.createElement(
            'div',
            { className: 'bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-md relative mb-4', role: 'alert' },
            React.createElement('span', { className: 'block sm:inline' }, successMessage)
        ),
        errorMessage && React.createElement(
            'div',
            { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md relative mb-4', role: 'alert' },
            React.createElement('span', { className: 'block sm:inline' }, errorMessage)
        ),
        React.createElement(
            'form',
            { onSubmit: handleRegister, className: 'space-y-6' },
            React.createElement(
                'div',
                null,
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
                    required: true,
                    className: 'mt-1 block w-full rounded-md border-0 py-2.5 px-4 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 transition duration-300'
                })
            ),
            React.createElement(
                'div',
                null,
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
                    required: true,
                    className: 'mt-1 block w-full rounded-md border-0 py-2.5 px-4 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 transition duration-300'
                })
            ),
            React.createElement(
                'div',
                null,
                React.createElement(
                    'label',
                    { htmlFor: 'email', className: 'block text-sm font-medium text-gray-700' },
                    'E-mailová adresa'
                ),
                React.createElement('input', {
                    type: 'email',
                    id: 'email',
                    name: 'email',
                    value: email,
                    onChange: (e) => setEmail(e.target.value),
                    placeholder: 'vas.email@example.sk',
                    required: true,
                    className: 'mt-1 block w-full rounded-md border-0 py-2.5 px-4 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 transition duration-300'
                })
            ),
            React.createElement(
                'div',
                null,
                React.createElement(PasswordInput, {
                    id: 'password',
                    label: 'Heslo',
                    value: password,
                    onChange: handlePasswordChange,
                    onFocus: () => setPasswordFocused(true),
                    placeholder: 'Zadajte heslo',
                    autoComplete: 'new-password',
                    showPassword: showPassword,
                    toggleShowPassword: toggleShowPassword,
                    disabled: formSubmitting || successMessage,
                    validationStatus: password.length > 0 ? (isPasswordValid ? 'valid' : 'invalid') : ''
                }),
                passwordFocused && !isPasswordValid && React.createElement(
                    'ul',
                    { className: 'text-sm mt-2 text-gray-500' },
                    React.createElement('li', { className: `flex items-center ${hasMinLength ? 'text-green-500' : 'text-red-500'}` },
                        React.createElement('span', { className: 'mr-2' }, hasMinLength ? '✓' : '✗'), ' Minimálne 8 znakov'
                    ),
                    React.createElement('li', { className: `flex items-center ${hasLowercase ? 'text-green-500' : 'text-red-500'}` },
                        React.createElement('span', { className: 'mr-2' }, hasLowercase ? '✓' : '✗'), ' Malé písmeno'
                    ),
                    React.createElement('li', { className: `flex items-center ${hasUppercase ? 'text-green-500' : 'text-red-500'}` },
                        React.createElement('span', { className: 'mr-2' }, hasUppercase ? '✓' : '✗'), ' Veľké písmeno'
                    ),
                    React.createElement('li', { className: `flex items-center ${hasNumber ? 'text-green-500' : 'text-red-500'}` },
                        React.createElement('span', { className: 'mr-2' }, hasNumber ? '✓' : '✗'), ' Číslo'
                    ),
                    React.createElement('li', { className: `flex items-center ${hasSpecialChar ? 'text-green-500' : 'text-red-500'}` },
                        React.createElement('span', { className: 'mr-2' }, hasSpecialChar ? '✓' : '✗'), ' Špeciálny znak'
                    )
                )
            ),
            React.createElement(
                'div',
                null,
                React.createElement(PasswordInput, {
                    id: 'confirmPassword',
                    label: 'Potvrdenie hesla',
                    value: confirmPassword,
                    onChange: handleConfirmPasswordChange,
                    placeholder: 'Zopakujte heslo',
                    autoComplete: 'new-password',
                    showPassword: showConfirmPassword,
                    toggleShowPassword: toggleShowConfirmPassword,
                    disabled: formSubmitting || successMessage,
                    validationStatus: confirmPasswordTouched && confirmPassword.length > 0 ? (isConfirmPasswordMatching ? 'valid' : 'invalid') : ''
                }),
                !isConfirmPasswordMatching && confirmPassword.length > 0 && confirmPasswordTouched &&
                React.createElement(
                    'p',
                    { className: 'text-red-500 text-xs italic mt-1' },
                    'Heslá sa nezhodujú'
                ),
            ),
            React.createElement(
                'button',
                {
                    type: 'submit',
                    className: buttonClasses,
                    disabled: formSubmitting || successMessage || !isFormValid,
                },
                formSubmitting ? (
                    React.createElement(
                        'svg',
                        { className: 'animate-spin -ml-1 mr-3 h-5 w-5 text-white inline-block', xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24' },
                        React.createElement('circle', { className: 'opacity-25', cx: '12', cy: '12', r: '10', stroke: 'currentColor', 'strokeWidth': '4' }),
                        React.createElement('path', { className: 'opacity-75', fill: 'currentColor', d: 'M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z' })
                    )
                ) : null,
                'Registrovať'
            )
        )
    );
}

// Ensure the component is available globally
window.App = App;
