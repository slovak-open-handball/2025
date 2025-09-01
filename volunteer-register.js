// volunteer-register.js
// Tento súbor definuje hlavný React komponent pre registráciu dobrovoľníkov.
// Zahŕňa formulár, validáciu a ukladanie dát do Firestore.

// Importy pre potrebné Firebase funkcie
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Funkcia na overenie sily hesla
const passwordStrengthCheck = (password) => {
    let strength = 0;
    const checks = {
        length: password.length >= 8,
        lowercase: /[a-z]/.test(password),
        uppercase: /[A-Z]/.test(password),
        number: /[0-9]/.test(password),
        specialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };
    Object.values(checks).forEach(check => {
        if (check) strength++;
    });
    return { ...checks, strength };
};

// Pomocná funkcia na validáciu emailu podľa špecifických požiadaviek
const isValidEmail = (email) => {
    // Regex, ktorý spĺňa požiadavky:
    // 1. Musí obsahovať znak "@"
    // 2. Za "@" nasleduje aspoň jeden znak
    // 3. Potom nasleduje znak "."
    // 4. Za "." nasledujú aspoň dva znaky
    const emailRegex = /^[^@]+@[^@]+\.[^@]{2,}$/;
    return emailRegex.test(email);
};

// Komponent pre zobrazenie sily hesla
function PasswordStrengthIndicator({ password }) {
    const { length, lowercase, uppercase, number, specialChar, strength } = passwordStrengthCheck(password);
    const getBarColor = (s) => {
        if (s <= 1) return 'bg-red-500';
        if (s <= 3) return 'bg-orange-400';
        return 'bg-green-500';
    };
    const getStrengthText = (s) => {
        if (s === 0) return 'Veľmi slabé';
        if (s === 1) return 'Slabé';
        if (s === 2) return 'Stredné';
        if (s === 3) return 'Silné';
        return 'Veľmi silné';
    };

    if (password.length === 0) return null;

    return React.createElement(
        'div',
        { className: 'mt-2' },
        React.createElement(
            'div',
            { className: 'flex gap-1 h-2 rounded-full overflow-hidden' },
            React.createElement('div', { className: `w-1/5 h-full ${strength >= 1 ? getBarColor(strength) : 'bg-gray-200'}` }),
            React.createElement('div', { className: `w-1/5 h-full ${strength >= 2 ? getBarColor(strength) : 'bg-gray-200'}` }),
            React.createElement('div', { className: `w-1/5 h-full ${strength >= 3 ? getBarColor(strength) : 'bg-gray-200'}` }),
            React.createElement('div', { className: `w-1/5 h-full ${strength >= 4 ? getBarColor(strength) : 'bg-gray-200'}` }),
            React.createElement('div', { className: `w-1/5 h-full ${strength >= 5 ? getBarColor(strength) : 'bg-gray-200'}` })
        ),
        React.createElement(
            'p',
            { className: `text-xs mt-1 ${getBarColor(strength)} font-medium` },
            getStrengthText(strength)
        ),
        React.createElement(
            'ul',
            { className: 'text-xs text-gray-500 mt-2 list-disc list-inside space-y-1' },
            React.createElement('li', { className: `text-${length ? 'green' : 'red'}-500` }, 'Minimálne 8 znakov'),
            React.createElement('li', { className: `text-${uppercase && lowercase ? 'green' : 'red'}-500` }, 'Veľké a malé písmená'),
            React.createElement('li', { className: `text-${number ? 'green' : 'red'}-500` }, 'Číslo'),
            React.createElement('li', { className: `text-${specialChar ? 'green' : 'red'}-500` }, 'Špeciálny znak')
        )
    );
}

// Hlavný komponent React aplikácie
function App() {
    const [formData, setFormData] = React.useState({
        name: '',
        surname: '',
        email: '',
        password: '',
        confirmPassword: '',
        phone: '',
    });
    const [formErrors, setFormErrors] = React.useState({});
    const [isFormValid, setIsFormValid] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [successMessage, setSuccessMessage] = React.useState('');
    const [errorMessage, setErrorMessage] = React.useState('');

    // Validácia formulára
    React.useEffect(() => {
        const errors = {};
        if (!formData.name) errors.name = 'Meno je povinné.';
        if (!formData.surname) errors.surname = 'Priezvisko je povinné.';
        if (formData.email && !isValidEmail(formData.email)) errors.email = 'Zadajte platnú e-mailovú adresu.';
        if (formData.password && passwordStrengthCheck(formData.password).strength < 3) errors.password = 'Heslo je príliš slabé.';
        if (formData.confirmPassword && formData.password !== formData.confirmPassword) errors.confirmPassword = 'Heslá sa nezhodujú.';

        setFormErrors(errors);
        setIsFormValid(
            !!formData.name &&
            !!formData.surname &&
            !!formData.email &&
            !!formData.password &&
            !!formData.confirmPassword &&
            Object.keys(errors).length === 0
        );
    }, [formData]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handlePhoneChange = (e) => {
        // Jednoduché odstránenie všetkých nečíslic
        const formattedPhone = e.target.value.replace(/[^0-9+]/g, '');
        setFormData(prev => ({ ...prev, phone: formattedPhone }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMessage('');
        setSuccessMessage('');
        setIsSubmitting(true);

        try {
            // Použijeme globálne `auth` a `db` z `authentication.js`
            const auth = window.auth;
            const db = window.db;

            if (!auth || !db) {
                throw new Error("Služby Firebase nie sú inicializované. Skúste obnoviť stránku.");
            }

            // 1. Vytvorenie používateľa v Firebase Authentication
            const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
            const user = userCredential.user;
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

            // 2. Uloženie profilu používateľa do Firestore v súkromnej kolekcii
            const userProfileRef = doc(db, `artifacts/${appId}/users/${user.uid}/profile`, user.uid);

            const userProfileData = {
                uid: user.uid,
                email: formData.email,
                name: formData.name,
                surname: formData.surname,
                phone: formData.phone,
                role: 'volunteer', // Priradená rola 'volunteer'
                createdAt: serverTimestamp(),
            };

            await setDoc(userProfileRef, userProfileData);

            setSuccessMessage("Registrácia dobrovoľníka bola úspešná! Môžete sa prihlásiť.");
            setFormData({ name: '', surname: '', email: '', password: '', confirmPassword: '', phone: '' });

        } catch (error) {
            console.error("Chyba pri registrácii:", error);
            let userFriendlyMessage = "Chyba pri registrácii. Skúste to prosím znova.";
            if (error.code === 'auth/email-already-in-use') {
                userFriendlyMessage = "Tento email už je zaregistrovaný.";
            } else if (error.code === 'auth/weak-password') {
                userFriendlyMessage = "Zadané heslo je príliš slabé.";
            } else if (error.message.includes("Firebase")) {
                userFriendlyMessage = `Chyba pri registrácii: ${error.message}`;
            }
            setErrorMessage(userFriendlyMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Dynamické triedy pre tlačidlo na základe stavu
    const buttonClasses = isSubmitting || !isFormValid ?
        'w-full sm:w-auto bg-white text-[#1D4ED8] border border-[#1D4ED8] font-bold py-2 px-4 rounded-full focus:outline-none focus:shadow-outline cursor-not-allowed' :
        'w-full sm:w-auto bg-[#1D4ED8] text-white font-bold py-2 px-4 rounded-full focus:outline-none focus:shadow-outline transition duration-300 ease-in-out transform hover:scale-105';

    // UI pre registračný formulár
    return React.createElement(
        'div',
        { className: 'p-4' },
        React.createElement(
            'h1',
            { className: 'text-3xl font-bold text-center text-gray-800 mb-6' },
            'Registrácia Dobrovoľníka'
        ),
        React.createElement(
            'p',
            { className: 'text-center text-gray-600 mb-8' },
            'Vyplňte, prosím, formulár na registráciu ako dobrovoľník.'
        ),
        successMessage && React.createElement(
            'div',
            { className: 'bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded mb-6', role: 'alert' },
            React.createElement('p', { className: 'font-bold' }, 'Úspech!'),
            React.createElement('p', null, successMessage)
        ),
        errorMessage && React.createElement(
            'div',
            { className: 'bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded mb-6', role: 'alert' },
            React.createElement('p', { className: 'font-bold' }, 'Chyba!'),
            React.createElement('p', null, errorMessage)
        ),
        React.createElement(
            'form',
            { onSubmit: handleSubmit, className: 'space-y-6' },
            // Meno
            React.createElement(
                'div',
                null,
                React.createElement(
                    'label',
                    { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'name' },
                    'Meno'
                ),
                React.createElement('input', {
                    className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
                    id: 'name',
                    type: 'text',
                    name: 'name',
                    placeholder: 'Zadajte svoje meno',
                    value: formData.name,
                    onChange: handleInputChange,
                    required: true,
                })
            ),
            // Priezvisko
            React.createElement(
                'div',
                null,
                React.createElement(
                    'label',
                    { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'surname' },
                    'Priezvisko'
                ),
                React.createElement('input', {
                    className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
                    id: 'surname',
                    type: 'text',
                    name: 'surname',
                    placeholder: 'Zadajte svoje priezvisko',
                    value: formData.surname,
                    onChange: handleInputChange,
                    required: true,
                })
            ),
            // Email
            React.createElement(
                'div',
                null,
                React.createElement(
                    'label',
                    { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'email' },
                    'E-mailová adresa'
                ),
                React.createElement('input', {
                    className: `shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${formData.email && !isValidEmail(formData.email) ? 'border-red-500' : ''}`,
                    id: 'email',
                    type: 'email',
                    name: 'email',
                    placeholder: 'Zadajte svoju e-mailovú adresu',
                    value: formData.email,
                    onChange: handleInputChange,
                    required: true,
                }),
                formData.email && !isValidEmail(formData.email) && React.createElement(
                    'p',
                    { className: 'text-red-500 text-xs italic mt-1' },
                    'Zadajte platnú e-mailovú adresu.'
                )
            ),
            // Heslo
            React.createElement(
                'div',
                null,
                React.createElement(
                    'label',
                    { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'password' },
                    'Heslo'
                ),
                React.createElement('input', {
                    className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
                    id: 'password',
                    type: 'password',
                    name: 'password',
                    placeholder: 'Zvoľte si heslo',
                    value: formData.password,
                    onChange: handleInputChange,
                    required: true,
                    autoComplete: 'new-password'
                }),
                React.createElement(PasswordStrengthIndicator, { password: formData.password })
            ),
            // Potvrdenie hesla
            React.createElement(
                'div',
                null,
                React.createElement(
                    'label',
                    { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'confirmPassword' },
                    'Potvrdiť heslo'
                ),
                React.createElement('input', {
                    className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
                    id: 'confirmPassword',
                    type: 'password',
                    name: 'confirmPassword',
                    placeholder: 'Potvrďte heslo',
                    value: formData.confirmPassword,
                    onChange: handleInputChange,
                    required: true,
                    autoComplete: 'new-password'
                })
            ),
            // Telefónne číslo
            React.createElement(
                'div',
                null,
                React.createElement(
                    'label',
                    { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'phone' },
                    'Telefónne číslo (voliteľné)'
                ),
                React.createElement('input', {
                    className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
                    id: 'phone',
                    type: 'tel',
                    name: 'phone',
                    placeholder: '+421 9xx xxx xxx',
                    value: formData.phone,
                    onChange: handlePhoneChange,
                })
            ),
            // Tlačidlo na odoslanie
            React.createElement(
                'div',
                { className: 'flex justify-center' },
                React.createElement(
                    'button',
                    {
                        type: 'submit',
                        className: buttonClasses,
                        disabled: isSubmitting || !isFormValid
                    },
                    isSubmitting ? 'Registrujem...' : 'Registrovať sa'
                )
            )
        )
    );
}

// Export hlavného komponentu
window.App = App;
