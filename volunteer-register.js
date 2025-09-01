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
    const emailRegex = /^[^@]+@[^@]+\.[^@]{2,}$/;
    return emailRegex.test(email);
};

// Komponent pre modálne okno s predvoľbami
const DialCodeModal = ({ isOpen, onClose, onSelect, selectedDialCode, unlockedButtonColor }) => {
    const [filter, setFilter] = React.useState('');
    const modalRef = React.useRef(null);

    React.useEffect(() => {
        const handleOutsideClick = (event) => {
            if (modalRef.current && !modalRef.current.contains(event.target)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleOutsideClick);
        } else {
            document.removeEventListener('mousedown', handleOutsideClick);
        }

        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
        };
    }, [isOpen, onClose]);

    // Opravená funkcia na obsluhu výberu a zatvorenia modálu
    const handleSelectAndClose = (dialCode) => {
        onSelect(dialCode);
        onClose();
    };

    const filteredCodes = countryDialCodes.filter(c =>
        c.name.toLowerCase().includes(filter.toLowerCase()) ||
        c.dialCode.includes(filter)
    );

    if (!isOpen) {
        return null;
    }

    return React.createElement(
        'div',
        {
            className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center z-50'
        },
        React.createElement(
            'div',
            {
                ref: modalRef,
                className: 'bg-white p-6 rounded-lg shadow-xl w-full max-w-sm mx-4'
            },
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mb-4' },
                React.createElement(
                    'h3',
                    { className: 'text-xl font-bold text-gray-900' },
                    'Vybrať krajinu'
                ),
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'text-gray-400 hover:text-gray-600'
                    },
                    React.createElement(
                        'svg',
                        {
                            xmlns: 'http://www.w3.org/2000/svg',
                            className: 'h-6 w-6',
                            fill: 'none',
                            viewBox: '0 0 24 24',
                            stroke: 'currentColor'
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
                { className: 'mb-4' },
                React.createElement('input', {
                    type: 'text',
                    placeholder: 'Vyhľadať krajinu...',
                    className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
                    value: filter,
                    onChange: (e) => setFilter(e.target.value),
                })
            ),
            React.createElement(
                'div',
                { className: 'overflow-y-auto max-h-64' },
                filteredCodes.length > 0 ?
                filteredCodes.map((country) =>
                    React.createElement(
                        'div',
                        {
                            key: country.code,
                            onClick: () => handleSelectAndClose(country.dialCode), // Použitie opravenej funkcie
                            className: `flex justify-between items-center py-2 px-3 rounded-lg cursor-pointer ${selectedDialCode === country.dialCode ? `bg-${unlockedButtonColor}-200` : 'hover:bg-gray-100'} transition-colors duration-200`
                        },
                        React.createElement(
                            'span',
                            { className: 'text-gray-700' },
                            country.name
                        ),
                        React.createElement(
                            'span',
                            { className: `text-gray-900 font-medium ${selectedDialCode === country.dialCode ? `text-${unlockedButtonColor}-700` : ''}` },
                            country.dialCode
                        )
                    )
                ) :
                React.createElement(
                    'div',
                    { className: 'text-center text-gray-500 py-4' },
                    'Žiadne výsledky'
                )
            )
        )
    );
};

// Hlavný komponent pre registračný formulár
function App() {
    const [formData, setFormData] = React.useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: ''
    });

    const [passwordChecks, setPasswordChecks] = React.useState(passwordStrengthCheck(''));
    const [isEmailValid, setIsEmailValid] = React.useState(false);
    const [isFormValid, setIsFormValid] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [errors, setErrors] = React.useState({});
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [selectedDialCode, setSelectedDialCode] = React.useState('+421'); // Default dial code for Slovakia
    const [unlockedButtonColor, setUnlockedButtonColor] = React.useState('emerald');

    const __app_id = 'default-app-id';
    const __firebase_config = '{"apiKey":"MOCK_API_KEY","authDomain":"MOCK_AUTH_DOMAIN","projectId":"MOCK_PROJECT_ID","storageBucket":"MOCK_STORAGE_BUCKET","messagingSenderId":"MOCK_MESSAGING_SENDER_ID","appId":"MOCK_APP_ID"}';
    const __initial_auth_token = 'MOCK_TOKEN';

    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const firebaseConfig = JSON.parse(__firebase_config);
    const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

    const [db, setDb] = React.useState(null);
    const [auth, setAuth] = React.useState(null);
    const [userId, setUserId] = React.useState(null);
    const [isAuthReady, setIsAuthReady] = React.useState(false);

    React.useEffect(() => {
        try {
            const app = window.initializeApp(firebaseConfig);
            const dbInstance = window.getFirestore(app);
            const authInstance = window.getAuth(app);
            setDb(dbInstance);
            setAuth(authInstance);

            const unsubscribe = window.onAuthStateChanged(authInstance, async (user) => {
                if (user) {
                    setUserId(user.uid);
                } else {
                    try {
                        await window.signInAnonymously(authInstance);
                    } catch (error) {
                        console.error("Anonymná autentifikácia zlyhala", error);
                    }
                }
                setIsAuthReady(true);
            });

            if (initialAuthToken) {
                window.signInWithCustomToken(authInstance, initialAuthToken).catch(error => {
                    console.error("Autentifikácia pomocou custom tokenu zlyhala", error);
                    window.signInAnonymously(authInstance);
                });
            }

            return () => unsubscribe();
        } catch (e) {
            console.error("Zlyhala inicializácia Firebase:", e);
        }
    }, [firebaseConfig, initialAuthToken]);


    // Validácia formulára
    React.useEffect(() => {
        const { firstName, lastName, email, phone, password, confirmPassword } = formData;
        const passwordChecksResult = passwordStrengthCheck(password);
        const emailValidationResult = isValidEmail(email);

        const formIsValid = firstName.trim() !== '' &&
            lastName.trim() !== '' &&
            emailValidationResult &&
            phone.trim() !== '' &&
            password.length >= 10 &&
            password === confirmPassword;

        setIsFormValid(formIsValid);
        setPasswordChecks(passwordChecksResult);
        setIsEmailValid(emailValidationResult);
    }, [formData]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handlePhoneChange = (e) => {
        const { value } = e.target;
        // Odstráni všetky nečíselné znaky
        const sanitizedValue = value.replace(/\D/g, '');
        // Orezanie na max 15 znakov (štandardný max pre medzinárodné čísla bez predvoľby)
        const trimmedValue = sanitizedValue.slice(0, 15);
        setFormData(prev => ({ ...prev, phone: trimmedValue }));
    };

    const handleDialCodeSelect = (dialCode) => {
        setSelectedDialCode(dialCode);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setErrors({});

        // Kontrola, či formulár je platný pred odoslaním
        if (!isFormValid) {
            console.error("Formulár nie je platný. Odoslanie bolo zablokované.");
            setIsSubmitting(false);
            return;
        }

        try {
            const fullPhoneNumber = `${selectedDialCode}${formData.phone}`;

            // 1. Vytvorenie používateľa v Firebase Authentication
            const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
            const user = userCredential.user;

            // 2. Uloženie profilových dát používateľa do Firestore
            const userProfileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'user-profile', 'data');
            const newUserData = {
                firstName: formData.firstName,
                lastName: formData.lastName,
                email: formData.email,
                fullPhoneNumber: fullPhoneNumber,
                timestamp: serverTimestamp(),
            };
            await setDoc(userProfileRef, newUserData);

            // 3. Uloženie role do globálnej kolekcie pre rýchly prístup
            const userRoleRef = doc(db, 'artifacts', appId, 'public', 'data', 'user-roles', user.uid);
            await setDoc(userRoleRef, {
                role: 'volunteer',
                email: formData.email,
            });

            console.log("Registrácia úspešná!", newUserData);
            window.location.href = './volunteer-success.html';

        } catch (error) {
            setIsSubmitting(false);
            console.error("Chyba pri registrácii:", error);
            const newErrors = {};
            switch (error.code) {
                case 'auth/email-already-in-use':
                    newErrors.email = 'Emailová adresa už je používaná. Skúste sa prihlásiť.';
                    break;
                case 'auth/weak-password':
                    newErrors.password = 'Heslo je príliš slabé. Použite aspoň 10 znakov, veľké písmená, malé písmená a čísla.';
                    break;
                case 'auth/invalid-email':
                    newErrors.email = 'Emailová adresa má nesprávny formát.';
                    break;
                default:
                    newErrors.general = 'Registrácia zlyhala. Skúste to prosím znova.';
            }
            setErrors(newErrors);
        }
    };

    const buttonClasses = `w-full max-w-xs py-2 px-4 rounded-full font-bold text-white transition-colors duration-200 focus:outline-none focus:shadow-outline ${isSubmitting || !isFormValid ? 'bg-gray-400 cursor-not-allowed' : `bg-${unlockedButtonColor}-500 hover:bg-${unlockedButtonColor}-600`}`;

    return React.createElement(
        'form',
        {
            className: 'space-y-6',
            onSubmit: handleSubmit
        },
        React.createElement(
            'h2',
            { className: 'text-2xl font-bold text-center text-gray-900 mb-6' },
            'Registrácia dobrovoľníka'
        ),
        Object.keys(errors).length > 0 &&
        React.createElement(
            'div',
            { className: 'bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md', role: 'alert' },
            React.createElement(
                'p',
                { className: 'font-bold' },
                'Chyba!'
            ),
            Object.values(errors).map((err, index) =>
                React.createElement('p', { key: index }, err)
            )
        ),
        React.createElement(
            'div',
            { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
            // Meno
            React.createElement(
                'div',
                null,
                React.createElement(
                    'label',
                    { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'firstName' },
                    'Meno'
                ),
                React.createElement('input', {
                    className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
                    id: 'firstName',
                    type: 'text',
                    name: 'firstName',
                    placeholder: 'Ján',
                    value: formData.firstName,
                    onChange: handleChange,
                })
            ),
            // Priezvisko
            React.createElement(
                'div',
                null,
                React.createElement(
                    'label',
                    { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'lastName' },
                    'Priezvisko'
                ),
                React.createElement('input', {
                    className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
                    id: 'lastName',
                    type: 'text',
                    name: 'lastName',
                    placeholder: 'Novák',
                    value: formData.lastName,
                    onChange: handleChange,
                })
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
                className: `shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${!isEmailValid && formData.email !== '' ? 'border-red-500' : ''}`,
                id: 'email',
                type: 'email',
                name: 'email',
                placeholder: 'email@example.com',
                value: formData.email,
                onChange: handleChange,
            }),
            !isEmailValid && formData.email !== '' && React.createElement(
                'p',
                { className: 'text-red-500 text-xs italic mt-1' },
                'Prosím, zadajte platnú emailovú adresu.'
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
                className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline',
                id: 'password',
                type: 'password',
                name: 'password',
                placeholder: '***************',
                value: formData.password,
                onChange: handleChange,
            }),
            React.createElement(
                'ul',
                { className: 'text-xs text-gray-600 space-y-1' },
                React.createElement(
                    'li',
                    { className: passwordChecks.length ? 'text-green-600' : 'text-gray-500' },
                    '✓ Minimálne 10 znakov'
                ),
                React.createElement(
                    'li',
                    { className: passwordChecks.lowercase ? 'text-green-600' : 'text-gray-500' },
                    '✓ Obsahuje malé písmeno (a-z)'
                ),
                React.createElement(
                    'li',
                    { className: passwordChecks.uppercase ? 'text-green-600' : 'text-gray-500' },
                    '✓ Obsahuje veľké písmeno (A-Z)'
                ),
                React.createElement(
                    'li',
                    { className: passwordChecks.number ? 'text-green-600' : 'text-gray-500' },
                    '✓ Obsahuje číslo (0-9)'
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
                'Potvrdenie hesla'
            ),
            React.createElement('input', {
                className: `shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${formData.password !== formData.confirmPassword && formData.confirmPassword !== '' ? 'border-red-500' : ''}`,
                id: 'confirmPassword',
                type: 'password',
                name: 'confirmPassword',
                placeholder: '***************',
                value: formData.confirmPassword,
                onChange: handleChange,
            }),
            formData.password !== formData.confirmPassword && formData.confirmPassword !== '' && React.createElement(
                'p',
                { className: 'text-red-500 text-xs italic mt-1' },
                'Heslá sa nezhodujú.'
            )
        ),
        // Telefónne číslo
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
                { className: 'flex' },
                React.createElement(
                    'button',
                    {
                        type: 'button',
                        onClick: () => setIsModalOpen(true),
                        className: `bg-gray-200 border border-gray-300 rounded-l-md px-3 py-2 text-gray-700 font-semibold focus:outline-none focus:ring-2 focus:ring-${unlockedButtonColor}-500 focus:ring-opacity-50 transition-colors duration-200`
                    },
                    selectedDialCode
                ),
                React.createElement('input', {
                    className: 'shadow appearance-none border rounded-r-md w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
                    id: 'phone',
                    type: 'tel',
                    name: 'phone',
                    placeholder: 'xxx xxx xxx',
                    value: formData.phone,
                    onChange: handlePhoneChange,
                })
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
        ),
        React.createElement(
            DialCodeModal,
            {
                isOpen: isModalOpen,
                onClose: () => setIsModalOpen(false),
                onSelect: handleDialCodeSelect,
                selectedDialCode: selectedDialCode,
                unlockedButtonColor: unlockedButtonColor
            }
        )
    );
}

// Export hlavného komponentu
window.App = App;
