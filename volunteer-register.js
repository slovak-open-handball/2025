// Tento súbor definuje hlavný React komponent pre registráciu dobrovoľníkov.
// Zahŕňa formulár, validáciu a ukladanie dát do Firestore.

// Importy pre potrebné Firebase funkcie
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Import zoznamu predvolieb z externého súboru
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
    const emailRegex = /^[^@]+@[^@]+\.[^@]{2,}$/;;
    return emailRegex.test(email);
};

// Komponent pre modálne okno s predvoľbami
const DialCodeModal = ({ isOpen, onClose, onSelect, selectedDialCode, unlockedButtonColor }) => {
    const [filter, setFilter] = React.useState('');

    // Získanie farby pre podsvietenie a zaškrtávacie políčko
    const filteredCodes = countryDialCodes.filter(c =>
        c.name.toLowerCase().includes(filter.toLowerCase()) ||
        c.dialCode.includes(filter)
    ).slice(0, 50); // Limit the list for better performance

    const getDialCodeClasses = (code) => {
        return `py-2 px-4 cursor-pointer hover:bg-gray-100 flex justify-between items-center rounded-lg ${selectedDialCode.dialCode === code.dialCode ? `bg-blue-100 ${unlockedButtonColor} ` : ''}`;
    };

    if (!isOpen) {
        return null;
    }

    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center p-4 z-50' },
        React.createElement(
            'div',
            { className: 'bg-white p-6 rounded-lg shadow-xl w-full max-w-sm' },
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mb-4' },
                React.createElement('h3', { className: 'text-lg font-bold' }, 'Vyberte predvoľbu'),
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'text-gray-500 hover:text-gray-800'
                    },
                    'X'
                )
            ),
            React.createElement('input', {
                type: 'text',
                placeholder: 'Hľadať krajinu alebo kód...',
                className: 'w-full p-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500',
                value: filter,
                onChange: (e) => setFilter(e.target.value)
            }),
            React.createElement(
                'ul',
                { className: 'max-h-60 overflow-y-auto' },
                filteredCodes.map(c =>
                    React.createElement(
                        'li',
                        {
                            key: c.code,
                            className: getDialCodeClasses(c),
                            onClick: () => {
                                onSelect(c);
                                onClose();
                            }
                        },
                        React.createElement('span', null, c.name),
                        React.createElement('span', { className: 'font-semibold' }, c.dialCode)
                    )
                )
            )
        )
    );
};

// The main registration form component
const App = () => {
    const [formData, setFormData] = React.useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: '', // Nové pole pre potvrdenie hesla
        phone: '',
        gender: '',
        birthDate: '',
        acceptTerms: false,
    });
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [authError, setAuthError] = React.useState(null);
    const [successMessage, setSuccessMessage] = React.useState(null);
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [selectedDialCode, setSelectedDialCode] = React.useState({ name: 'Slovenská republika', code: 'SK', dialCode: '+421' });

    // Function to handle form input changes
    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    // Function to handle phone number changes
    const handlePhoneChange = (e) => {
        const { value } = e.target;
        // Allows only digits and spaces, formats into blocks of 3
        const formatted = value.replace(/\D/g, '').replace(/(\d{3})(?=\d)/g, '$1 ');
        setFormData(prev => ({ ...prev, phone: formatted }));
    };

    // Function to handle dial code selection from modal
    const handleDialCodeSelect = (code) => {
        setSelectedDialCode(code);
    };

    // Form submission handler
    const handleSubmit = async (e) => {
        e.preventDefault();
        setAuthError(null);
        setSuccessMessage(null);
        setIsSubmitting(true);

        // Concatenate full phone number
        const fullPhoneNumber = `${selectedDialCode.dialCode}${formData.phone.replace(/\s/g, '')}`;

        try {
            // Create user with email and password
            const authResult = await createUserWithEmailAndPassword(window.auth, formData.email, formData.password);
            const user = authResult.user;
            console.log("Používateľ úspešne vytvorený:", user.uid);

            // Save form data to Firestore
            await setDoc(doc(window.db, `artifacts/${window.appId}/users/${user.uid}/volunteer-data/registration`), {
                firstName: formData.firstName,
                lastName: formData.lastName,
                email: formData.email,
                fullPhoneNumber: fullPhoneNumber,
                gender: formData.gender,
                birthDate: formData.birthDate,
                registrationDate: serverTimestamp(),
            });

            setSuccessMessage("Registrácia bola úspešná! Ďakujeme.");
            setFormData({
                firstName: '',
                lastName: '',
                email: '',
                password: '',
                confirmPassword: '',
                phone: '',
                gender: '',
                birthDate: '',
                acceptTerms: false,
            });

        } catch (error) {
            console.error("Chyba pri registrácii:", error);
            // Translate common Firebase errors for user
            let errorMessage = "Chyba pri registrácii. Skúste to prosím znova.";
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = "Tento e-mail už je použitý. Prosím, použite iný.";
            } else if (error.code === 'auth/weak-password') {
                errorMessage = "Heslo je príliš slabé. Prosím, použite silnejšie.";
            }
            setAuthError(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Live validation
    const passwordChecks = passwordStrengthCheck(formData.password);
    const isPasswordValid = Object.values(passwordChecks).every(Boolean) && formData.password === formData.confirmPassword;
    const isFormValid =
        formData.firstName &&
        formData.lastName &&
        isValidEmail(formData.email) &&
        isPasswordValid &&
        formData.phone.replace(/\s/g, '').length >= 9 && // Simple check for phone length
        formData.gender &&
        formData.birthDate &&
        formData.acceptTerms;

    const unlockedButtonColor = 'bg-blue-600 hover:bg-blue-700 text-white';
    const lockedButtonColor = 'bg-gray-400 text-gray-700 cursor-not-allowed';
    const buttonClasses = `mt-6 font-bold py-2 px-4 rounded-full focus:outline-none focus:shadow-outline transition-all duration-300 ${isFormValid ? unlockedButtonColor : lockedButtonColor}`;

    // Main component rendering
    return React.createElement(
        'form',
        {
            className: 'bg-white p-8 rounded-lg shadow-lg w-full max-w-xl mx-auto',
            onSubmit: handleSubmit,
        },
        // Display user messages
        authError && React.createElement(
            'div',
            { className: 'bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-lg', role: 'alert' },
            React.createElement('p', { className: 'font-bold' }, 'Chyba'),
            React.createElement('p', null, authError)
        ),
        successMessage && React.createElement(
            'div',
            { className: 'bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-4 rounded-lg', role: 'alert' },
            React.createElement('p', { className: 'font-bold' }, 'Úspešné!'),
            React.createElement('p', null, successMessage)
        ),
        // Heading
        React.createElement('h2', { className: 'text-2xl font-bold mb-6 text-center text-gray-800' }, 'Registrácia dobrovoľníka'),
        // First Name
        React.createElement(
            'div',
            { className: 'mb-4' },
            React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'firstName' }, 'Meno'),
            React.createElement('input', {
                className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
                id: 'firstName',
                type: 'text',
                name: 'firstName',
                placeholder: 'Zadajte svoje meno',
                value: formData.firstName,
                onChange: handleInputChange,
            }),
        ),
        // Last Name
        React.createElement(
            'div',
            { className: 'mb-4' },
            React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'lastName' }, 'Priezvisko'),
            React.createElement('input', {
                className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
                id: 'lastName',
                type: 'text',
                name: 'lastName',
                placeholder: 'Zadajte svoje priezvisko',
                value: formData.lastName,
                onChange: handleInputChange,
            }),
        ),
        // Email
        React.createElement(
            'div',
            { className: 'mb-4' },
            React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'email' }, 'E-mailová adresa'),
            React.createElement('input', {
                className: `shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${isValidEmail(formData.email) || formData.email === '' ? '' : 'border-red-500'}`,
                id: 'email',
                type: 'email',
                name: 'email',
                placeholder: 'Zadajte svoju e-mailovú adresu',
                value: formData.email,
                onChange: handleInputChange,
            }),
            (!isValidEmail(formData.email) && formData.email !== '') && React.createElement(
                'p',
                { className: 'text-red-500 text-xs italic mt-1' },
                'Prosím, zadajte platnú e-mailovú adresu.'
            )
        ),
        // Password
        React.createElement(
            'div',
            { className: 'mb-4' },
            React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'password' }, 'Heslo'),
            React.createElement('input', {
                className: `shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline`,
                id: 'password',
                type: 'password',
                name: 'password',
                placeholder: 'Zvoľte si heslo',
                value: formData.password,
                onChange: handleInputChange,
            }),
            React.createElement(
                'div',
                { className: 'mt-2 text-xs text-gray-600 italic' },
                React.createElement('p', { className: 'text-gray-900' }, 'Heslo musí obsahovať:'),
                React.createElement('p', { className: `flex items-center ${passwordChecks.length ? 'text-green-500' : 'text-gray-500'}` },
                    React.createElement('span', { className: 'mr-1' }, passwordChecks.length ? '✔' : '•'), ' aspoň 10 znakov,'
                ),
                React.createElement('p', { className: `flex items-center ${passwordChecks.lowercase ? 'text-green-500' : 'text-gray-500'}` },
                    React.createElement('span', { className: 'mr-1' }, passwordChecks.lowercase ? '✔' : '•'), ' aspoň jedno veľké písmeno,'
                ),
                React.createElement('p', { className: `flex items-center ${passwordChecks.uppercase ? 'text-green-500' : 'text-gray-500'}` },
                    React.createElement('span', { className: 'mr-1' }, passwordChecks.uppercase ? '✔' : '•'), ' aspoň jedno malé písmeno,'
                ),
                React.createElement('p', { className: `flex items-center ${passwordChecks.number ? 'text-green-500' : 'text-gray-500'}` },
                    React.createElement('span', { className: 'mr-1' }, passwordChecks.number ? '✔' : '•'), ' aspoň jednu číslicu.'
                )
            )
        ),
        // Confirm Password
        React.createElement(
            'div',
            { className: 'mb-4' },
            React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'confirmPassword' }, 'Potvrdiť heslo'),
            React.createElement('input', {
                className: `shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${formData.confirmPassword !== '' && formData.password !== formData.confirmPassword ? 'border-red-500' : ''}`,
                id: 'confirmPassword',
                type: 'password',
                name: 'confirmPassword',
                placeholder: 'Potvrďte heslo',
                value: formData.confirmPassword,
                onChange: handleInputChange,
            }),
            (formData.confirmPassword !== '' && formData.password !== formData.confirmPassword) && React.createElement(
                'p',
                { className: 'text-red-500 text-xs italic mt-1' },
                'Heslá sa nezhodujú.'
            )
        ),
        // Gender and Birth Date
        React.createElement(
            'div',
            { className: 'flex space-x-4 mb-4' },
            // Gender
            React.createElement(
                'div',
                { className: 'w-1/2' },
                React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'gender' }, 'Pohlavie'),
                React.createElement(
                    'select',
                    {
                        className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
                        id: 'gender',
                        name: 'gender',
                        value: formData.gender,
                        onChange: handleInputChange,
                    },
                    React.createElement('option', { value: '' }, 'Vyberte...'),
                    React.createElement('option', { value: 'male' }, 'Muž'),
                    React.createElement('option', { value: 'female' }, 'Žena'),
                    React.createElement('option', { value: 'other' }, 'Iné')
                )
            ),
            // Birth Date
            React.createElement(
                'div',
                { className: 'w-1/2' },
                React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'birthDate' }, 'Dátum narodenia'),
                React.createElement('input', {
                    className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
                    id: 'birthDate',
                    type: 'date',
                    name: 'birthDate',
                    value: formData.birthDate,
                    onChange: handleInputChange,
                }),
            )
        ),
        // Phone
        React.createElement(
            'div',
            { className: 'mb-4' },
            React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'phone' }, 'Telefónne číslo'),
            React.createElement(
                'div',
                { className: 'flex' },
                React.createElement(
                    'button',
                    {
                        type: 'button',
                        onClick: () => setIsModalOpen(true),
                        className: 'bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 px-3 rounded-l-lg border-t border-b border-l border-gray-300 focus:outline-none transition-all duration-300'
                    },
                    selectedDialCode.dialCode
                ),
                React.createElement('input', {
                    className: 'shadow appearance-none border rounded-r-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
                    id: 'phone',
                    type: 'tel',
                    name: 'phone',
                    placeholder: 'xxx xxx xxx',
                    value: formData.phone,
                    onChange: handlePhoneChange,
                }),
            ),
        ),
        // Accept Terms Checkbox
        React.createElement(
            'div',
            { className: 'mb-6 flex items-center' },
            React.createElement('input', {
                type: 'checkbox',
                id: 'acceptTerms',
                name: 'acceptTerms',
                checked: formData.acceptTerms,
                onChange: handleInputChange,
                className: 'form-checkbox h-4 w-4 text-blue-600 transition duration-150 ease-in-out'
            }),
            React.createElement('label', { className: 'ml-2 block text-gray-900 text-sm', htmlFor: 'acceptTerms' },
                'Súhlasím so spracovaním osobných údajov na účely prípravy dobrovoľníckej zmluvy'
            )
        ),
        // Submit Button
        React.createElement(
            'div',
            { className: 'flex justify-center' },
            React.createElement(
                'button',
                {
                    type: 'submit',
                    className: buttonClasses,
                    disabled: isSubmitting || !isFormValid,
                },
                isSubmitting ? 'Registrujem...' : 'Registrovať sa'
            ),
        ),
        // Modal component
        React.createElement(
            DialCodeModal,
            {
                isOpen: isModalOpen,
                onClose: () => setIsModalOpen(false),
                onSelect: handleDialCodeSelect,
                selectedDialCode: selectedDialCode,
                unlockedButtonColor: unlockedButtonColor,
            }
        ),
    );
};

// Export the main component
window.App = App;
