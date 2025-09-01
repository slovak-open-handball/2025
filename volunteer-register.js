// volunteer-register.js
// Tento súbor definuje hlavný React komponent pre registráciu dobrovoľníkov.
// Zahŕňa formulár, validáciu a ukladanie dát do Firestore.

// Importy pre potrebné Firebase funkcie
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
// Import zoznamu predvolieb pre telefónne čísla
import { countryDialCodes } from "./countryDialCodes.js";

// Funkcia na overenie sily hesla
const passwordStrengthCheck = (password) => {
    const checks = {
        length: password.length >= 10,
        lowercase: /[a-z]/.test(password),
        uppercase: /[A-Z]/.test(password),
        number: /[0-9]/.test(password),
    };
    return checks;
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
    const [selectedDialCode, setSelectedDialCode] = React.useState('+421');
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
        if (!formData.phone) errors.phone = 'Telefónne číslo je povinné.';
        if (formData.email && !isValidEmail(formData.email)) errors.email = 'Zadajte platnú e-mailovú adresu.';
        
        const passwordChecks = passwordStrengthCheck(formData.password);
        if (!passwordChecks.length || !passwordChecks.lowercase || !passwordChecks.uppercase || !passwordChecks.number) {
            errors.password = 'Heslo nespĺňa všetky podmienky.';
        }
        
        if (formData.confirmPassword && formData.password !== formData.confirmPassword) errors.confirmPassword = 'Heslá sa nezhodujú.';

        setFormErrors(errors);
        setIsFormValid(
            !!formData.name &&
            !!formData.surname &&
            !!formData.email &&
            !!formData.password &&
            !!formData.confirmPassword &&
            !!formData.phone && // Telefónne číslo je teraz povinné
            Object.keys(errors).length === 0
        );
    }, [formData]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handlePhoneChange = (e) => {
        // Odstránenie všetkých nečíslic
        const formattedPhone = e.target.value.replace(/[^0-9+]/g, '');
        setFormData(prev => ({ ...prev, phone: formattedPhone }));
    };

    const handleDialCodeChange = (e) => {
        setSelectedDialCode(e.target.value);
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
            
            // Kombinácia predvoľby a telefónneho čísla
            const fullPhoneNumber = `${selectedDialCode}${formData.phone.startsWith('+') ? formData.phone.slice(1) : formData.phone}`;

            const userProfileData = {
                uid: user.uid,
                email: formData.email,
                name: formData.name,
                surname: formData.surname,
                phone: fullPhoneNumber,
                role: 'volunteer', // Priradená rola 'volunteer'
                createdAt: serverTimestamp(),
            };

            await setDoc(userProfileRef, userProfileData);

            setSuccessMessage("Registrácia dobrovoľníka bola úspešná! Môžete sa prihlásiť.");
            setFormData({ name: '', surname: '', email: '', password: '', confirmPassword: '', phone: '' });
            setSelectedDialCode('+421');

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
            'Prídi nás podporiť a pomôcť pri organizácii turnaja, prihlás sa ako dobrovoľník. Prosím vyplň formulár. Ďakujeme :)'
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
                // Nový textový indikátor sily hesla
                React.createElement(
                    'div',
                    { className: 'mt-2 text-sm italic text-gray-500' },
                    React.createElement(
                        'p',
                        { className: 'mb-1 text-gray-700' },
                        'Heslo musí obsahovať:'
                    ),
                    React.createElement(
                        'ul',
                        { className: 'list-none p-0 m-0 space-y-1' },
                        React.createElement(
                            'li',
                            { className: `flex items-center space-x-2 ${passwordStrengthCheck(formData.password).length ? 'text-green-500' : 'text-gray-500'}` },
                            React.createElement('span', { className: 'text-lg leading-none' }, passwordStrengthCheck(formData.password).length ? '✔' : '•'),
                            React.createElement('span', null, 'aspoň 10 znakov')
                        ),
                        React.createElement(
                            'li',
                            { className: `flex items-center space-x-2 ${passwordStrengthCheck(formData.password).uppercase ? 'text-green-500' : 'text-gray-500'}` },
                            React.createElement('span', { className: 'text-lg leading-none' }, passwordStrengthCheck(formData.password).uppercase ? '✔' : '•'),
                            React.createElement('span', null, 'aspoň jedno veľké písmeno')
                        ),
                        React.createElement(
                            'li',
                            { className: `flex items-center space-x-2 ${passwordStrengthCheck(formData.password).lowercase ? 'text-green-500' : 'text-gray-500'}` },
                            React.createElement('span', { className: 'text-lg leading-none' }, passwordStrengthCheck(formData.password).lowercase ? '✔' : '•'),
                            React.createElement('span', null, 'aspoň jedno malé písmeno')
                        ),
                        React.createElement(
                            'li',
                            { className: `flex items-center space-x-2 ${passwordStrengthCheck(formData.password).number ? 'text-green-500' : 'text-gray-500'}` },
                            React.createElement('span', { className: 'text-lg leading-none' }, passwordStrengthCheck(formData.password).number ? '✔' : '•'),
                            React.createElement('span', null, 'aspoň jednu číslicu')
                        )
                    )
                )
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
                }),
                // Zobrazenie chyby, ak sa heslá nezhodujú
                (formData.confirmPassword.length > 0 && formData.password !== formData.confirmPassword) && React.createElement(
                    'p',
                    { className: 'text-red-500 text-xs italic mt-1' },
                    'Heslá sa nezhodujú'
                )
            ),
            // Telefónne číslo s predvoľbou
            React.createElement(
                'div',
                null,
                React.createElement(
                    'label',
                    { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'phone' },
                    'Telefónne číslo'
                ),
                React.createElement(
                    'div',
                    { className: 'flex items-center space-x-2' },
                    React.createElement(
                        'select',
                        {
                            className: 'shadow border rounded py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
                            value: selectedDialCode,
                            onChange: handleDialCodeChange,
                        },
                        countryDialCodes.map((country, index) =>
                            React.createElement(
                                'option',
                                { key: index, value: country.dialCode },
                                `${country.name} (${country.dialCode})`
                            )
                        )
                    ),
                    React.createElement('input', {
                        className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
                        id: 'phone',
                        type: 'tel',
                        name: 'phone',
                        placeholder: 'xxx xxx xxx',
                        value: formData.phone,
                        onChange: handlePhoneChange,
                        required: true,
                    })
                ),
                formErrors.phone && React.createElement(
                    'p',
                    { className: 'text-red-500 text-xs italic mt-1' },
                    formErrors.phone
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
