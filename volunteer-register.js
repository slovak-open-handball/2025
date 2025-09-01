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

// Pomocná funkcia na validáciu emailu
const isValidEmail = (email) => {
    // Regex pre overenie platného formátu emailu
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
        email: '',
        password: '',
        confirmPassword: '',
        phone: '',
        category: 'player',
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
        if (!isValidEmail(formData.email)) errors.email = 'Zadajte platný email.';
        if (passwordStrengthCheck(formData.password).strength < 3) errors.password = 'Heslo je príliš slabé.';
        if (formData.password !== formData.confirmPassword) errors.confirmPassword = 'Heslá sa nezhodujú.';
        // Telefónne číslo je voliteľné, validácia zatiaľ nie je potrebná
        
        setFormErrors(errors);
        setIsFormValid(Object.keys(errors).length === 0 && formData.name && formData.email && formData.password && formData.confirmPassword);
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
                phone: formData.phone,
                role: 'volunteer', // Priradená rola 'volunteer'
                category: formData.category,
                createdAt: serverTimestamp(),
            };

            await setDoc(userProfileRef, userProfileData);

            setSuccessMessage("Registrácia dobrovoľníka bola úspešná! Môžete sa prihlásiť.");
            setFormData({ name: '', email: '', password: '', confirmPassword: '', phone: '', category: 'player' });

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
                    'Celé meno'
                ),
                React.createElement('input', {
                    className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
                    id: 'name',
                    type: 'text',
                    name: 'name',
                    placeholder: 'Ján Novák',
                    value: formData.name,
                    onChange: handleInputChange,
                    required: true,
                }),
                formErrors.name && React.createElement(
                    'p',
                    { className: 'text-red-500 text-xs italic mt-1' },
                    formErrors.name
                )
            ),
            // Email
            React.createElement(
                'div',
                null,
                React.createElement(
                    'label',
                    { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'email' },
                    'Email'
                ),
                React.createElement('input', {
                    className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
                    id: 'email',
                    type: 'email',
                    name: 'email',
                    placeholder: 'jan.novak@example.com',
                    value: formData.email,
                    onChange: handleInputChange,
                    required: true,
                }),
                formErrors.email && React.createElement(
                    'p',
                    { className: 'text-red-500 text-xs italic mt-1' },
                    formErrors.email
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
                    placeholder: '********',
                    value: formData.password,
                    onChange: handleInputChange,
                    required: true,
                    autoComplete: 'new-password'
                }),
                React.createElement(PasswordStrengthIndicator, { password: formData.password }),
                formErrors.password && React.createElement(
                    'p',
                    { className: 'text-red-500 text-xs italic mt-1' },
                    formErrors.password
                )
            ),
            // Potvrdenie hesla
            React.createElement(
                'div',
                null,
                React.createElement(
                    'label',
                    { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'confirmPassword' },
                    'Potvrdenie hesla'
                ),
                React.createElement('input', {
                    className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
                    id: 'confirmPassword',
                    type: 'password',
                    name: 'confirmPassword',
                    placeholder: '********',
                    value: formData.confirmPassword,
                    onChange: handleInputChange,
                    required: true,
                    autoComplete: 'new-password'
                }),
                formErrors.confirmPassword && React.createElement(
                    'p',
                    { className: 'text-red-500 text-xs italic mt-1' },
                    formErrors.confirmPassword
                )
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
            // Kategória dobrovoľníka
            React.createElement(
                'div',
                null,
                React.createElement(
                    'label',
                    { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'category' },
                    'Vyberte kategóriu'
                ),
                React.createElement(
                    'select',
                    {
                        className: 'shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
                        id: 'category',
                        name: 'category',
                        value: formData.category,
                        onChange: handleInputChange,
                    },
                    React.createElement('option', { value: 'player' }, 'Hráč'),
                    React.createElement('option', { value: 'coach' }, 'Tréner'),
                    React.createElement('option', { value: 'volunteer' }, 'Dobrovoľník'),
                )
            ),
            // Tlačidlo na odoslanie
            React.createElement(
                'div',
                { className: 'flex justify-center' },
                React.createElement(
                    'button',
                    {
                        type: 'submit',
                        className: `w-full sm:w-auto bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full focus:outline-none focus:shadow-outline transition duration-300 ease-in-out transform ${isSubmitting || !isFormValid ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`,
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
