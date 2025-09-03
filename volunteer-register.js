// Tento súbor definuje hlavný React komponent pre registráciu dobrovoľníkov.
// Zahŕňa formulár, validáciu a ukladanie dát do Firestore.

// Importy pre potrebné Firebase funkcie
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, setDoc, serverTimestamp, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Import zoznamu predvolieb z externého súboru
import { countryDialCodes } from "./countryDialCodes.js";

// Placeholder URL pre tvoj Google Apps Script
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec";

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
    const emailRegex = /^[^@]+@[^@]+\.[^@]{2,}$/;
    return emailRegex.test(email);
};

// Komponent pre modálne okno s predvoľbami
const DialCodeModal = ({ isOpen, onClose, onSelect, selectedDialCode, unlockedButtonColor }) => {
    const [filter, setFilter] = React.useState('');

    const modalRef = React.useRef();

    React.useEffect(() => {
        function handleClickOutside(event) {
            if (modalRef.current && !modalRef.current.contains(event.target)) {
                onClose();
            }
        }
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen, onClose]);

    if (!isOpen) {
        return null;
    }

    const filteredCodes = countryDialCodes.filter(c =>
        c.country.toLowerCase().includes(filter.toLowerCase()) ||
        c.code.includes(filter)
    );

    return (
        React.createElement(
            'div',
            {
                className: 'fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50'
            },
            React.createElement(
                'div',
                {
                    ref: modalRef,
                    className: `bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden max-h-[80vh] w-96 relative`
                },
                React.createElement(
                    'div',
                    { className: 'p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center' },
                    React.createElement('h3', { className: 'text-lg font-semibold text-gray-900 dark:text-gray-100' }, 'Vyberte predvoľbu krajiny'),
                    React.createElement('button', {
                        onClick: onClose,
                        className: 'p-1 rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                    },
                        React.createElement('span', { className: 'sr-only' }, 'Zatvoriť'),
                        React.createElement('svg', {
                            className: 'h-6 w-6',
                            xmlns: 'http://www.w3.org/2000/svg',
                            fill: 'none',
                            viewBox: '0 0 24 24',
                            stroke: 'currentColor',
                            'aria-hidden': 'true'
                        },
                            React.createElement('path', {
                                strokeLinecap: 'round',
                                strokeLinejoin: 'round',
                                strokeWidth: '2',
                                d: 'M6 18L18 6M6 6l12 12'
                            })
                        )
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'p-4' },
                    React.createElement(
                        'input',
                        {
                            type: 'text',
                            placeholder: 'Hľadať krajinu...',
                            value: filter,
                            onChange: (e) => setFilter(e.target.value),
                            className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100'
                        }
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'overflow-y-auto px-4 pb-4' },
                    filteredCodes.map((country) =>
                        React.createElement(
                            'div',
                            {
                                key: country.code,
                                onClick: () => onSelect(country.code),
                                className: `p-2 my-1 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${selectedDialCode === country.code ? 'bg-blue-100 dark:bg-blue-900' : ''}`
                            },
                            React.createElement('span', { className: 'font-semibold text-gray-900 dark:text-gray-100' }, country.country),
                            React.createElement('span', { className: 'ml-2 text-gray-500 dark:text-gray-400' }, country.code)
                        )
                    )
                )
            )
        )
    );
};


// Hlavný React komponent pre registráciu
const App = ({ isAuthReady, userId, db, auth }) => {
    // Definícia počiatočného stavu formulára
    const initialFormData = {
        action: 'sendVolunteerRegistrationEmail',
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: '',
        contactPhoneNumber: '',
        addressStreet: '',
        addressHouseNumber: '',
        addressCity: '',
        addressPostalCode: '',
        addressCountry: 'Slovensko',
        dateOfBirth: '',
        skills: [],
        availabilities: {},
        globalNote: '',
        acceptTerms: false,
    };

    const [formData, setFormData] = React.useState(initialFormData);
    const [errors, setErrors] = React.useState({});
    const [passwordStrength, setPasswordStrength] = React.useState({
        length: false,
        lowercase: false,
        uppercase: false,
        number: false,
    });
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [submitMessage, setSubmitMessage] = React.useState({ text: '', type: '' });
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [selectedDialCode, setSelectedDialCode] = React.useState(countryDialCodes[0].code);
    const [availabilitiesData, setAvailabilitiesData] = React.useState({});
    const [showPassword, setShowPassword] = React.useState(false);
    const [passwordError, setPasswordError] = React.useState('');

    // Preklad a zoradenie názvov zručností
    const skillOptions = [
        'Organizačný tím',
        'Technická podpora',
        'Zdravotnícka služba',
        'Mediálna podpora',
        'Fotograf/Video',
        'Iné'
    ];

    // Funkcia na spracovanie zmien v dostupnosti
    const handleAvailabilityChange = (event) => {
        const { id, checked } = event.target;
        setFormData(prevData => ({
            ...prevData,
            availabilities: {
                ...prevData.availabilities,
                [id]: checked
            }
        }));
    };

    // Preklad a zoradenie názvov dní pre dostupnosť
    const getSlovakDayNames = () => {
        const today = new Date();
        const dates = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            const dayOfWeek = date.getDay();
            const dayName = ['Ned', 'Pon', 'Ut', 'Str', 'Štv', 'Pia', 'Sob'][dayOfWeek];
            const formattedDate = `${dayName} ${date.getDate()}. ${date.getMonth() + 1}.`;
            const isoDate = date.toISOString().split('T')[0];
            dates.push({
                display: formattedDate,
                iso: isoDate
            });
        }
        return dates;
    };

    const availabilityDays = getSlovakDayNames();

    // Dynamické triedy pre tlačidlo
    const buttonClasses = `
        px-6 py-3 rounded-full text-white font-semibold transition-all duration-300 ease-in-out
        ${isSubmitting || !isAuthReady || Object.keys(errors).length > 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-300'}
    `;

    // Farby tlačidiel pre mobilné rozhranie
    const unlockedButtonColor = 'bg-blue-500';

    // Spracovanie zmeny vstupov
    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        if (name === 'skills') {
            setFormData(prevData => {
                const newSkills = checked
                    ? [...prevData.skills, value]
                    : prevData.skills.filter(skill => skill !== value);
                return { ...prevData, skills: newSkills };
            });
        } else if (name === 'acceptTerms') {
            setFormData(prevData => ({ ...prevData, [name]: checked }));
        } else {
            setFormData(prevData => ({ ...prevData, [name]: value }));
        }

        // Validácia po zmene
        if (name === 'email') {
            if (!isValidEmail(value)) {
                setErrors(prevErrors => ({ ...prevErrors, email: 'Zadajte platnú e-mailovú adresu.' }));
            } else {
                setErrors(prevErrors => {
                    const newErrors = { ...prevErrors };
                    delete newErrors.email;
                    return newErrors;
                });
            }
        }
        if (name === 'password') {
            setPasswordStrength(passwordStrengthCheck(value));
            if (value !== formData.confirmPassword) {
                setPasswordError('Heslá sa nezhodujú.');
            } else {
                setPasswordError('');
            }
        }
        if (name === 'confirmPassword') {
            if (value !== formData.password) {
                setPasswordError('Heslá sa nezhodujú.');
            } else {
                setPasswordError('');
            }
        }
    };

    // Validácia formulára pred odoslaním
    const validateForm = () => {
        const newErrors = {};
        if (!formData.firstName) newErrors.firstName = 'Meno je povinné.';
        if (!formData.lastName) newErrors.lastName = 'Priezvisko je povinné.';
        if (!isValidEmail(formData.email)) newErrors.email = 'Zadajte platnú e-mailovú adresu.';
        if (!formData.password) newErrors.password = 'Heslo je povinné.';
        if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Heslá sa musia zhodovať.';
        }
        if (!formData.contactPhoneNumber) newErrors.contactPhoneNumber = 'Telefónne číslo je povinné.';
        if (!formData.addressStreet || !formData.addressHouseNumber || !formData.addressCity || !formData.addressPostalCode) {
            newErrors.address = 'Vyplňte, prosím, celú adresu.';
        }
        if (!formData.dateOfBirth) newErrors.dateOfBirth = 'Dátum narodenia je povinný.';
        if (Object.keys(formData.availabilities).length === 0 || Object.values(formData.availabilities).every(val => !val)) {
            newErrors.availabilities = 'Vyberte aspoň jeden deň dostupnosti.';
        }
        if (!formData.acceptTerms) {
            newErrors.acceptTerms = 'Musíte súhlasiť so spracovaním osobných údajov.';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const isFormValid = Object.values(passwordStrength).every(Boolean) &&
        Object.keys(errors).length === 0 &&
        !isSubmitting &&
        formData.firstName.trim() !== '' &&
        formData.lastName.trim() !== '' &&
        isValidEmail(formData.email) &&
        formData.password.trim() !== '' &&
        formData.confirmPassword.trim() !== '' &&
        formData.password === formData.confirmPassword &&
        formData.contactPhoneNumber.trim() !== '' &&
        formData.addressStreet.trim() !== '' &&
        formData.addressHouseNumber.trim() !== '' &&
        formData.addressCity.trim() !== '' &&
        formData.addressPostalCode.trim() !== '' &&
        formData.dateOfBirth.trim() !== '' &&
        formData.acceptTerms;

    // Funkcia na spracovanie odoslania formulára
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm() || !isAuthReady) {
            setSubmitMessage({ text: 'Prosím, opravte chyby vo formulári.', type: 'error' });
            return;
        }

        setIsSubmitting(true);
        setSubmitMessage({ text: '', type: '' });

        try {
            // Vytvorenie používateľa vo Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
            const user = userCredential.user;

            // Vytvorenie objektu adresy pre Google Apps Script
            const addressDataForScript = {
                street: formData.addressStreet,
                houseNumber: formData.addressHouseNumber,
                city: formData.addressCity,
                postalCode: formData.addressPostalCode,
                country: formData.addressCountry,
            };

            // Vytvorenie JSON payload pre Apps Script
            const payload = {
                action: 'sendVolunteerRegistrationEmail',
                firstName: formData.firstName,
                lastName: formData.lastName,
                email: formData.email,
                contactPhoneNumber: selectedDialCode + formData.contactPhoneNumber,
                dateOfBirth: formData.dateOfBirth,
                skills: formData.skills,
                availabilities: formData.availabilities,
                address: addressDataForScript, // ODOSLANIE ADRESY AKO JEDEN OBJEKT
                globalNote: formData.globalNote,
            };

            // Odoslanie dát do Google Apps Script
            const scriptResponse = await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'cors',
                cache: 'no-cache',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            const result = await scriptResponse.json();
            if (!result.success) {
                throw new Error(result.message);
            }

            // Uloženie dát dobrovoľníka do Firestore
            const volunteerDocRef = doc(db, 'artifacts', userId, 'volunteers', user.uid);
            await setDoc(volunteerDocRef, {
                firstName: formData.firstName,
                lastName: formData.lastName,
                email: formData.email,
                contactPhoneNumber: selectedDialCode + formData.contactPhoneNumber,
                dateOfBirth: formData.dateOfBirth,
                address: addressDataForScript,
                skills: formData.skills,
                availabilities: formData.availabilities,
                globalNote: formData.globalNote,
                createdAt: serverTimestamp(),
            });

            setSubmitMessage({ text: 'Registrácia bola úspešná! Skontrolujte si e-mail.', type: 'success' });
            setFormData(initialFormData);
            setErrors({});
            setPasswordStrength(passwordStrengthCheck(''));

        } catch (error) {
            setSubmitMessage({ text: `Chyba pri registrácii: ${error.message}`, type: 'error' });
            console.error('Registration error:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDialCodeSelect = (code) => {
        setSelectedDialCode(code);
        setIsModalOpen(false);
    };

    // JSX pre renderovanie formulára
    return (
        React.createElement(
            'form',
            { onSubmit: handleSubmit, className: 'flex flex-col space-y-6 max-w-2xl mx-auto p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 font-sans' },
            React.createElement(
                'div',
                { className: 'text-center' },
                React.createElement('h2', { className: 'text-3xl font-bold text-gray-900 dark:text-gray-100' }, 'Registrácia dobrovoľníka'),
                React.createElement('p', { className: 'mt-2 text-lg text-gray-600 dark:text-gray-400' }, 'Pridajte sa k tímu Slovak Open Handball!')
            ),
            // Global Message
            submitMessage.text && React.createElement(
                'div',
                {
                    className: `p-4 rounded-xl text-sm font-semibold text-center ${submitMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`
                },
                submitMessage.text
            ),
            // Contact Information Section
            React.createElement('div', { className: 'space-y-4' },
                React.createElement('h3', { className: 'text-xl font-semibold text-gray-900 dark:text-gray-100 border-b pb-2' }, 'Kontaktné údaje'),
                React.createElement(
                    'div',
                    { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                    // First Name
                    React.createElement(
                        'div',
                        { className: 'space-y-1' },
                        React.createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300', htmlFor: 'firstName' }, 'Meno *'),
                        React.createElement('input', {
                            type: 'text',
                            id: 'firstName',
                            name: 'firstName',
                            value: formData.firstName,
                            onChange: handleInputChange,
                            className: 'input-field',
                            required: true
                        }),
                        errors.firstName && React.createElement('p', { className: 'text-red-500 text-xs mt-1' }, errors.firstName)
                    ),
                    // Last Name
                    React.createElement(
                        'div',
                        { className: 'space-y-1' },
                        React.createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300', htmlFor: 'lastName' }, 'Priezvisko *'),
                        React.createElement('input', {
                            type: 'text',
                            id: 'lastName',
                            name: 'lastName',
                            value: formData.lastName,
                            onChange: handleInputChange,
                            className: 'input-field',
                            required: true
                        }),
                        errors.lastName && React.createElement('p', { className: 'text-red-500 text-xs mt-1' }, errors.lastName)
                    )
                ),
                // E-mail
                React.createElement(
                    'div',
                    { className: 'space-y-1' },
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300', htmlFor: 'email' }, 'E-mail *'),
                    React.createElement('input', {
                        type: 'email',
                        id: 'email',
                        name: 'email',
                        value: formData.email,
                        onChange: handleInputChange,
                        className: 'input-field',
                        required: true
                    }),
                    errors.email && React.createElement('p', { className: 'text-red-500 text-xs mt-1' }, errors.email)
                ),
                // Password
                React.createElement(
                    'div',
                    { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                    React.createElement(
                        'div',
                        { className: 'space-y-1' },
                        React.createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300', htmlFor: 'password' }, 'Heslo *'),
                        React.createElement('div', { className: 'relative' },
                            React.createElement('input', {
                                type: showPassword ? 'text' : 'password',
                                id: 'password',
                                name: 'password',
                                value: formData.password,
                                onChange: handleInputChange,
                                className: 'input-field pr-10',
                                required: true
                            }),
                            React.createElement('button', {
                                type: 'button',
                                onClick: () => setShowPassword(!showPassword),
                                className: 'absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5'
                            }, showPassword ? 'Skryť' : 'Zobraziť')
                        ),
                        React.createElement('ul', { className: 'list-disc list-inside text-gray-500 text-xs mt-2' },
                            React.createElement('li', { className: passwordStrength.length ? 'text-green-500' : 'text-gray-500' }, 'minimálne 10 znakov'),
                            React.createElement('li', { className: passwordStrength.lowercase ? 'text-green-500' : 'text-gray-500' }, 'aspoň 1 malé písmeno'),
                            React.createElement('li', { className: passwordStrength.uppercase ? 'text-green-500' : 'text-gray-500' }, 'aspoň 1 veľké písmeno'),
                            React.createElement('li', { className: passwordStrength.number ? 'text-green-500' : 'text-gray-500' }, 'aspoň 1 číslo')
                        )
                    ),
                    // Confirm Password
                    React.createElement(
                        'div',
                        { className: 'space-y-1' },
                        React.createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300', htmlFor: 'confirmPassword' }, 'Potvrdiť heslo *'),
                        React.createElement('input', {
                            type: showPassword ? 'text' : 'password',
                            id: 'confirmPassword',
                            name: 'confirmPassword',
                            value: formData.confirmPassword,
                            onChange: handleInputChange,
                            className: 'input-field',
                            required: true
                        }),
                        passwordError && React.createElement('p', { className: 'text-red-500 text-xs mt-1' }, passwordError)
                    )
                ),
                // Phone Number
                React.createElement(
                    'div',
                    { className: 'space-y-1' },
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300', htmlFor: 'contactPhoneNumber' }, 'Telefónne číslo *'),
                    React.createElement('div', { className: 'flex rounded-md shadow-sm' },
                        React.createElement('button', {
                            type: 'button',
                            onClick: () => setIsModalOpen(true),
                            className: 'inline-flex items-center px-3 rounded-l-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                        }, selectedDialCode),
                        React.createElement('input', {
                            type: 'tel',
                            id: 'contactPhoneNumber',
                            name: 'contactPhoneNumber',
                            value: formData.contactPhoneNumber,
                            onChange: handleInputChange,
                            className: 'flex-1 block w-full rounded-none rounded-r-md input-field border-l-0',
                            required: true
                        })
                    ),
                    errors.contactPhoneNumber && React.createElement('p', { className: 'text-red-500 text-xs mt-1' }, errors.contactPhoneNumber)
                ),
                // Date of Birth
                React.createElement(
                    'div',
                    { className: 'space-y-1' },
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300', htmlFor: 'dateOfBirth' }, 'Dátum narodenia *'),
                    React.createElement('input', {
                        type: 'date',
                        id: 'dateOfBirth',
                        name: 'dateOfBirth',
                        value: formData.dateOfBirth,
                        onChange: handleInputChange,
                        className: 'input-field',
                        required: true
                    }),
                    errors.dateOfBirth && React.createElement('p', { className: 'text-red-500 text-xs mt-1' }, errors.dateOfBirth)
                )
            ),
            // Address Section
            React.createElement('div', { className: 'space-y-4' },
                React.createElement('h3', { className: 'text-xl font-semibold text-gray-900 dark:text-gray-100 border-b pb-2' }, 'Adresa'),
                // Street
                React.createElement(
                    'div',
                    { className: 'space-y-1' },
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300', htmlFor: 'addressStreet' }, 'Ulica *'),
                    React.createElement('input', {
                        type: 'text',
                        id: 'addressStreet',
                        name: 'addressStreet',
                        value: formData.addressStreet,
                        onChange: handleInputChange,
                        className: 'input-field',
                        required: true
                    })
                ),
                // House Number and Postal Code
                React.createElement(
                    'div',
                    { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                    React.createElement(
                        'div',
                        { className: 'space-y-1' },
                        React.createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300', htmlFor: 'addressHouseNumber' }, 'Číslo domu *'),
                        React.createElement('input', {
                            type: 'text',
                            id: 'addressHouseNumber',
                            name: 'addressHouseNumber',
                            value: formData.addressHouseNumber,
                            onChange: handleInputChange,
                            className: 'input-field',
                            required: true
                        })
                    ),
                    React.createElement(
                        'div',
                        { className: 'space-y-1' },
                        React.createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300', htmlFor: 'addressPostalCode' }, 'PSČ *'),
                        React.createElement('input', {
                            type: 'text',
                            id: 'addressPostalCode',
                            name: 'addressPostalCode',
                            value: formData.addressPostalCode,
                            onChange: handleInputChange,
                            className: 'input-field',
                            required: true
                        })
                    )
                ),
                // City
                React.createElement(
                    'div',
                    { className: 'space-y-1' },
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300', htmlFor: 'addressCity' }, 'Mesto *'),
                    React.createElement('input', {
                        type: 'text',
                        id: 'addressCity',
                        name: 'addressCity',
                        value: formData.addressCity,
                        onChange: handleInputChange,
                        className: 'input-field',
                        required: true
                    }),
                    errors.address && React.createElement('p', { className: 'text-red-500 text-xs mt-1' }, errors.address)
                ),
                // Country (read-only for this form)
                React.createElement(
                    'div',
                    { className: 'space-y-1' },
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300', htmlFor: 'addressCountry' }, 'Krajina *'),
                    React.createElement('input', {
                        type: 'text',
                        id: 'addressCountry',
                        name: 'addressCountry',
                        value: formData.addressCountry,
                        onChange: handleInputChange,
                        className: 'input-field cursor-not-allowed bg-gray-50 dark:bg-gray-700',
                        readOnly: true
                    })
                )
            ),
            // Skills Section
            React.createElement('div', { className: 'space-y-4' },
                React.createElement('h3', { className: 'text-xl font-semibold text-gray-900 dark:text-gray-100 border-b pb-2' }, 'Možnosti spolupráce'),
                React.createElement('p', { className: 'text-sm text-gray-500 dark:text-gray-400' }, 'Vyberte oblasti, v ktorých by ste chceli pomôcť:'),
                React.createElement(
                    'div',
                    { className: 'mt-4 grid grid-cols-1 md:grid-cols-2 gap-2' },
                    skillOptions.map(skill => (
                        React.createElement('div', { key: skill, className: 'flex items-center' },
                            React.createElement('input', {
                                type: 'checkbox',
                                id: `skill-${skill}`,
                                name: 'skills',
                                value: skill,
                                checked: formData.skills.includes(skill),
                                onChange: handleInputChange,
                                className: 'form-checkbox h-4 w-4 text-blue-600 rounded'
                            }),
                            React.createElement('label', { className: 'ml-2 text-sm text-gray-700 dark:text-gray-300', htmlFor: `skill-${skill}` }, skill)
                        )
                    ))
                )
            ),
            // Availability Section
            React.createElement('div', { className: 'space-y-4' },
                React.createElement('h3', { className: 'text-xl font-semibold text-gray-900 dark:text-gray-100 border-b pb-2' }, 'Dostupnosť *'),
                React.createElement('p', { className: 'text-sm text-gray-500 dark:text-gray-400' }, 'Vyberte dni v týždni, kedy ste k dispozícii:'),
                React.createElement(
                    'div',
                    { className: 'mt-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2' },
                    availabilityDays.map(day => (
                        React.createElement('div', { key: day.iso, className: 'flex items-center' },
                            React.createElement('input', {
                                type: 'checkbox',
                                id: day.iso,
                                name: 'availabilities',
                                checked: formData.availabilities[day.iso] || false,
                                onChange: handleAvailabilityChange,
                                className: 'form-checkbox h-4 w-4 text-blue-600 rounded'
                            }),
                            React.createElement('label', { className: 'ml-2 text-sm text-gray-700 dark:text-gray-300', htmlFor: day.iso }, day.display)
                        )
                    ))
                ),
                errors.availabilities && React.createElement('p', { className: 'text-red-500 text-xs mt-1' }, errors.availabilities)
            ),
            // Global Note Section
            React.createElement('div', { className: 'space-y-4' },
                React.createElement('h3', { className: 'text-xl font-semibold text-gray-900 dark:text-gray-100 border-b pb-2' }, 'Poznámka'),
                React.createElement(
                    'textarea',
                    {
                        id: 'globalNote',
                        name: 'globalNote',
                        value: formData.globalNote,
                        onChange: handleInputChange,
                        rows: '4',
                        className: 'w-full input-field',
                        placeholder: 'Sem môžete pridať akékoľvek ďalšie poznámky...'
                    }
                )
            ),
            // Terms and Conditions
            React.createElement(
                'div',
                { className: 'flex items-center' },
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
            errors.acceptTerms && React.createElement('p', { className: 'text-red-500 text-xs mt-1 text-center' }, errors.acceptTerms),
            // Submit Button
            React.createElement(
                'div',
                { className: 'flex justify-center' },
                React.createElement(
                    'button',
                    {
                        type: 'submit',
                        className: buttonClasses,
                        disabled: isSubmitting || !isFormValid || !isAuthReady,
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
        )
    );
};

// Export the main component
window.App = App;
