// Tento súbor definuje hlavný React komponent pre registráciu dobrovoľníkov.
// Zahŕňa formulár, validáciu a ukladanie dát do Firestore.

// Importy pre potrebné Firebase funkcie
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, setDoc, serverTimestamp, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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

    const filteredCodes = countryDialCodes.filter(code =>
        code.name.toLowerCase().includes(filter.toLowerCase()) || code.dialCode.includes(filter)
    );

    const buttonClasses = `
        relative px-4 py-2 text-left w-full
        text-sm font-medium text-gray-700
        hover:bg-gray-200 focus:outline-none focus:bg-gray-200
        border-b border-gray-200 last:border-b-0
    `;

    return React.createElement(
        'div',
        {
            className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center',
        },
        React.createElement(
            'div',
            {
                ref: modalRef,
                className: 'relative bg-white rounded-lg shadow-xl max-w-sm w-full p-4 mx-4 md:mx-auto',
            },
            React.createElement(
                'div',
                { className: 'flex justify-between items-center pb-3' },
                React.createElement('h3', { className: 'text-lg font-semibold text-gray-900' }, 'Vybrať predvoľbu'),
                React.createElement('button', {
                    onClick: onClose,
                    className: 'text-gray-400 hover:text-gray-600 focus:outline-none'
                },
                    React.createElement('span', { className: 'text-2xl font-bold' }, '×')
                )
            ),
            React.createElement(
                'div',
                { className: 'mb-4' },
                React.createElement('input', {
                    type: 'text',
                    placeholder: 'Hľadať krajinu alebo kód...',
                    value: filter,
                    onChange: e => setFilter(e.target.value),
                    className: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500'
                })
            ),
            React.createElement(
                'div',
                { className: 'h-64 overflow-y-auto custom-scrollbar' },
                filteredCodes.map(code =>
                    React.createElement(
                        'button',
                        {
                            key: code.code,
                            onClick: () => {
                                onSelect(code);
                                onClose();
                            },
                            className: buttonClasses
                        },
                        React.createElement('div', { className: 'flex justify-between items-center' },
                            React.createElement('div', { className: 'flex-1 text-left truncate' },
                                `${code.name} (${code.dialCode})`
                            ),
                            selectedDialCode && selectedDialCode.code === code.code && React.createElement(
                                'div',
                                { className: 'ml-2 text-green-500 font-bold' },
                                '✓'
                            )
                        )
                    )
                )
            ),
            React.createElement(
                'div',
                { className: `mt-4 p-2 text-sm text-center rounded-md ${unlockedButtonColor}` },
                'Pre overenie telefónneho čísla musí byť formát správny.'
            )
        )
    );
};

// Hlavný komponent React
const App = () => {
    // Definícia a inicializácia stavu
    const [formData, setFormData] = React.useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: '',
        gender: '',
        birthdate: '',
        city: '',
        phone: '',
        emergencyContactName: '',
        emergencyContactPhone: '',
        notes: '',
        availability: '',
        hasCar: false,
        acceptTerms: false,
    });
    const [passwordChecks, setPasswordChecks] = React.useState(passwordStrengthCheck(''));
    const [isPasswordFocused, setIsPasswordFocused] = React.useState(false);
    const [passwordMatch, setPasswordMatch] = React.useState(false);
    const [isEmailValid, setIsEmailValid] = React.useState(true);
    const [selectedDialCode, setSelectedDialCode] = React.useState(countryDialCodes.find(c => c.code === 'SK') || countryDialCodes[0]);
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [submissionMessage, setSubmissionMessage] = React.useState('');
    const [unlockedButtonColor, setUnlockedButtonColor] = React.useState('bg-gray-200 text-gray-700');
    const [isAuthReady, setIsAuthReady] = React.useState(false);
    const [userId, setUserId] = React.useState(null);
    const db = React.useRef(null);
    const auth = React.useRef(null);
    const [firestoreData, setFirestoreData] = React.useState(null);

    // Inicializácia Firebase a prihlásenie s vlastným tokenom alebo anonymne
    React.useEffect(() => {
        try {
            const firebaseConfig = JSON.parse(window.__firebase_config);
            const app = firebase.initializeApp(firebaseConfig);
            auth.current = firebase.auth(app);
            db.current = firebase.firestore(app);
            firebase.firestore.setLogLevel('debug'); // Zapnutie debug logov pre Firestore

            const unsub = auth.current.onAuthStateChanged(async (user) => {
                if (!user) {
                    try {
                        const __initial_auth_token = window.__initial_auth_token;
                        if (__initial_auth_token) {
                            await auth.current.signInWithCustomToken(__initial_auth_token);
                        } else {
                            await auth.current.signInAnonymously();
                        }
                    } catch (error) {
                        console.error("Firebase Auth Error:", error);
                        setSubmissionMessage("Chyba pri autentifikácii. Prosím, skúste to znova. " + error.message);
                    }
                }
                setIsAuthReady(true);
                setUserId(auth.current.currentUser?.uid);
            });

            return () => unsub();
        } catch (error) {
            console.error("Firebase Initialization Error:", error);
            setSubmissionMessage("Chyba pri inicializácii aplikácie. " + error.message);
        }
    }, []);

    // Načítanie dát z Firestore pre zobrazenie
    React.useEffect(() => {
        if (db.current && userId) {
            const appId = typeof window.__app_id !== 'undefined' ? window.__app_id : 'default-app-id';
            const userDocRef = db.current.collection('artifacts').doc(appId).collection('users').doc(userId).collection('volunteerData').doc('registration');
            const unsub = onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists) {
                    setFirestoreData(docSnap.data());
                } else {
                    setFirestoreData(null);
                }
            }, (error) => {
                console.error("Firestore snapshot error:", error);
                setSubmissionMessage("Chyba pri načítavaní dát. " + error.message);
            });

            return () => unsub();
        }
    }, [userId]);

    // Obsluha zmien vstupných polí
    const handleInputChange = (event) => {
        const { name, value, type, checked } = event.target;
        setFormData(prevData => ({
            ...prevData,
            [name]: type === 'checkbox' ? checked : value
        }));

        if (name === 'password') {
            setPasswordChecks(passwordStrengthCheck(value));
            setPasswordMatch(value === formData.confirmPassword);
        }
        if (name === 'confirmPassword') {
            setPasswordMatch(value === formData.password);
        }
        if (name === 'email') {
            setIsEmailValid(isValidEmail(value));
        }
    };

    // Kontrola platnosti hesla a zmena farby tlačidla
    React.useEffect(() => {
        const allChecksPassed = Object.values(passwordChecks).every(check => check);
        if (allChecksPassed) {
            setUnlockedButtonColor('bg-blue-500 hover:bg-blue-600 text-white');
        } else {
            setUnlockedButtonColor('bg-gray-200 text-gray-700');
        }
    }, [passwordChecks]);

    // Obsluha odoslania formulára
    const handleSubmit = async (event) => {
        event.preventDefault();
        setIsSubmitting(true);
        setSubmissionMessage('');

        if (!isFormValid) {
            setSubmissionMessage('Prosím, vyplňte všetky povinné polia správne.');
            setIsSubmitting(false);
            return;
        }

        try {
            // Vytvorenie používateľa s emailom a heslom
            const userCredential = await createUserWithEmailAndPassword(auth.current, formData.email, formData.password);
            const user = userCredential.user;

            const appId = typeof window.__app_id !== 'undefined' ? window.__app_id : 'default-app-id';
            const userDocRef = db.current.collection('artifacts').doc(appId).collection('users').doc(user.uid).collection('volunteerData').doc('registration');

            // Uloženie dát do Firestore
            await setDoc(userDocRef, {
                ...formData,
                phone: `${selectedDialCode.dialCode}${formData.phone}`,
                createdAt: serverTimestamp(),
            });

            setSubmissionMessage('Registrácia bola úspešná! Ďakujeme za váš záujem.');
        } catch (error) {
            console.error("Registration error:", error);
            setSubmissionMessage(`Chyba pri registrácii: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Obsluha výberu predvoľby z modálneho okna
    const handleDialCodeSelect = (code) => {
        setSelectedDialCode(code);
    };

    // Podmienky pre aktiváciu tlačidla na odoslanie
    const isFormValid = formData.firstName && formData.lastName && isEmailValid &&
        Object.values(passwordChecks).every(check => check) && passwordMatch &&
        formData.gender && formData.birthdate && formData.city && formData.phone && formData.acceptTerms;

    // Definovanie tried pre tlačidlo na odoslanie
    const buttonClasses = `
        px-8 py-3 rounded-lg font-bold text-white transition-colors duration-200 ease-in-out
        ${isSubmitting || !isFormValid || !isAuthReady ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
    `;

    // Štýly pre šípky v selectboxoch
    const selectArrowClasses = `
        absolute inset-y-0 right-0 flex items-center pr-2
        pointer-events-none text-gray-500
    `;

    // SVG šípka
    const arrowSvg = React.createElement(
        'svg',
        {
            className: 'w-4 h-4',
            viewBox: '0 0 20 20',
            fill: 'currentColor',
            'aria-hidden': 'true'
        },
        React.createElement('path', {
            fillRule: 'evenodd',
            d: 'M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z',
            clipRule: 'evenodd'
        })
    );
    
    // Renderovanie formulára
    return React.createElement(
        'form',
        { onSubmit: handleSubmit, className: 'space-y-6' },
        // Názov formulára
        React.createElement('h2', { className: 'text-2xl font-bold text-gray-900 text-center mb-6' }, 'Registrácia dobrovoľníka'),
        
        // Správa o odoslaní formulára
        submissionMessage && React.createElement(
            'div',
            {
                className: `p-4 text-center rounded-lg ${submissionMessage.includes('Chyba') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`
            },
            submissionMessage
        ),

        // Osobné informácie
        React.createElement('div', { className: 'space-y-4' },
            React.createElement('h3', { className: 'text-xl font-semibold text-gray-900' }, 'Osobné informácie'),
            // Meno a priezvisko
            React.createElement('div', { className: 'grid md:grid-cols-2 md:gap-6' },
                React.createElement('div', { className: 'relative z-0 w-full mb-5 group' },
                    React.createElement('input', {
                        type: 'text',
                        name: 'firstName',
                        id: 'firstName',
                        value: formData.firstName,
                        onChange: handleInputChange,
                        className: 'block py-2.5 px-0 w-full text-sm text-gray-900 bg-transparent border-0 border-b-2 border-gray-300 appearance-none focus:outline-none focus:ring-0 focus:border-blue-600 peer',
                        placeholder: ' ',
                        required: true,
                    }),
                    React.createElement('label', {
                        htmlFor: 'firstName',
                        className: 'peer-focus:font-medium absolute text-sm text-gray-500 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:start-0 rtl:peer-focus:translate-x-1/4 peer-focus:text-blue-600 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6'
                    }, 'Meno'),
                ),
                React.createElement('div', { className: 'relative z-0 w-full mb-5 group' },
                    React.createElement('input', {
                        type: 'text',
                        name: 'lastName',
                        id: 'lastName',
                        value: formData.lastName,
                        onChange: handleInputChange,
                        className: 'block py-2.5 px-0 w-full text-sm text-gray-900 bg-transparent border-0 border-b-2 border-gray-300 appearance-none focus:outline-none focus:ring-0 focus:border-blue-600 peer',
                        placeholder: ' ',
                        required: true,
                    }),
                    React.createElement('label', {
                        htmlFor: 'lastName',
                        className: 'peer-focus:font-medium absolute text-sm text-gray-500 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:start-0 rtl:peer-focus:translate-x-1/4 peer-focus:text-blue-600 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6'
                    }, 'Priezvisko'),
                ),
            ),
            // Email
            React.createElement('div', { className: 'relative z-0 w-full mb-5 group' },
                React.createElement('input', {
                    type: 'email',
                    name: 'email',
                    id: 'email',
                    value: formData.email,
                    onChange: handleInputChange,
                    className: `block py-2.5 px-0 w-full text-sm text-gray-900 bg-transparent border-0 border-b-2 appearance-none focus:outline-none focus:ring-0 peer ${isEmailValid ? 'border-gray-300 focus:border-blue-600' : 'border-red-500 focus:border-red-500'}`,
                    placeholder: ' ',
                    required: true,
                }),
                React.createElement('label', {
                    htmlFor: 'email',
                    className: 'peer-focus:font-medium absolute text-sm text-gray-500 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:start-0 rtl:peer-focus:translate-x-1/4 peer-focus:text-blue-600 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6'
                }, 'Emailová adresa'),
                !isEmailValid && React.createElement('p', { className: 'mt-2 text-sm text-red-600' }, 'Prosím, zadajte platnú emailovú adresu.'),
            ),
            // Heslo a overenie hesla
            React.createElement('div', { className: 'relative z-0 w-full mb-5 group' },
                React.createElement('input', {
                    type: 'password',
                    name: 'password',
                    id: 'password',
                    value: formData.password,
                    onChange: handleInputChange,
                    onFocus: () => setIsPasswordFocused(true),
                    onBlur: () => setIsPasswordFocused(false),
                    className: 'block py-2.5 px-0 w-full text-sm text-gray-900 bg-transparent border-0 border-b-2 border-gray-300 appearance-none focus:outline-none focus:ring-0 focus:border-blue-600 peer',
                    placeholder: ' ',
                    required: true,
                }),
                React.createElement('label', {
                    htmlFor: 'password',
                    className: 'peer-focus:font-medium absolute text-sm text-gray-500 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:start-0 rtl:peer-focus:translate-x-1/4 peer-focus:text-blue-600 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6'
                }, 'Heslo'),
                isPasswordFocused && React.createElement('div', { className: 'mt-2 text-sm text-gray-600 space-y-1' },
                    React.createElement('p', { className: `flex items-center ${passwordChecks.length ? 'text-green-500' : 'text-red-500'}` },
                        React.createElement('svg', { className: 'w-4 h-4 mr-1', fill: 'currentColor', viewBox: '0 0 20 20' },
                            React.createElement('path', { fillRule: 'evenodd', d: passwordChecks.length ? 'M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z' : 'M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z', clipRule: 'evenodd' })
                        ),
                        'Minimálne 10 znakov'
                    ),
                    React.createElement('p', { className: `flex items-center ${passwordChecks.lowercase ? 'text-green-500' : 'text-red-500'}` },
                        React.createElement('svg', { className: 'w-4 h-4 mr-1', fill: 'currentColor', viewBox: '0 0 20 20' },
                            React.createElement('path', { fillRule: 'evenodd', d: passwordChecks.lowercase ? 'M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z' : 'M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z', clipRule: 'evenodd' })
                        ),
                        'Aspoň jedno malé písmeno'
                    ),
                    React.createElement('p', { className: `flex items-center ${passwordChecks.uppercase ? 'text-green-500' : 'text-red-500'}` },
                        React.createElement('svg', { className: 'w-4 h-4 mr-1', fill: 'currentColor', viewBox: '0 0 20 20' },
                            React.createElement('path', { fillRule: 'evenodd', d: passwordChecks.uppercase ? 'M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z' : 'M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z', clipRule: 'evenodd' })
                        ),
                        'Aspoň jedno veľké písmeno'
                    ),
                    React.createElement('p', { className: `flex items-center ${passwordChecks.number ? 'text-green-500' : 'text-red-500'}` },
                        React.createElement('svg', { className: 'w-4 h-4 mr-1', fill: 'currentColor', viewBox: '0 0 20 20' },
                            React.createElement('path', { fillRule: 'evenodd', d: passwordChecks.number ? 'M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z' : 'M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z', clipRule: 'evenodd' })
                        ),
                        'Aspoň jedna číslica'
                    )
                )
            ),
            React.createElement('div', { className: 'relative z-0 w-full mb-5 group' },
                React.createElement('input', {
                    type: 'password',
                    name: 'confirmPassword',
                    id: 'confirmPassword',
                    value: formData.confirmPassword,
                    onChange: handleInputChange,
                    className: `block py-2.5 px-0 w-full text-sm text-gray-900 bg-transparent border-0 border-b-2 appearance-none focus:outline-none focus:ring-0 peer ${passwordMatch ? 'border-gray-300 focus:border-blue-600' : 'border-red-500 focus:border-red-500'}`,
                    placeholder: ' ',
                    required: true,
                }),
                React.createElement('label', {
                    htmlFor: 'confirmPassword',
                    className: 'peer-focus:font-medium absolute text-sm text-gray-500 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:start-0 rtl:peer-focus:translate-x-1/4 peer-focus:text-blue-600 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6'
                }, 'Potvrdiť heslo'),
                !passwordMatch && React.createElement('p', { className: 'mt-2 text-sm text-red-600' }, 'Heslá sa nezhodujú.'),
            ),

            // Pohlavie a Dátum narodenia
            React.createElement('div', { className: 'grid md:grid-cols-2 md:gap-6' },
                React.createElement('div', { className: 'relative z-0 w-full mb-5 group' },
                    React.createElement('label', { htmlFor: 'gender', className: 'block text-sm font-medium text-gray-700 mb-2' }, 'Pohlavie'),
                    React.createElement(
                        'div',
                        { className: 'relative' },
                        React.createElement('select', {
                            id: 'gender',
                            name: 'gender',
                            value: formData.gender,
                            onChange: handleInputChange,
                            className: 'block appearance-none w-full bg-white border border-gray-300 text-gray-900 py-2 px-4 pr-8 rounded-md leading-tight focus:outline-none focus:bg-white focus:border-blue-500',
                            required: true,
                        },
                            React.createElement('option', { value: '', disabled: true }, 'Vyberte pohlavie'),
                            React.createElement('option', { value: 'male' }, 'Muž'),
                            React.createElement('option', { value: 'female' }, 'Žena'),
                            React.createElement('option', { value: 'other' }, 'Iné'),
                        ),
                        React.createElement('div', { className: selectArrowClasses },
                            arrowSvg
                        )
                    )
                ),
                React.createElement('div', { className: 'relative z-0 w-full mb-5 group' },
                    React.createElement('label', { htmlFor: 'birthdate', className: 'block text-sm font-medium text-gray-700 mb-2' }, 'Dátum narodenia'),
                    React.createElement('input', {
                        type: 'date',
                        id: 'birthdate',
                        name: 'birthdate',
                        value: formData.birthdate,
                        onChange: handleInputChange,
                        className: 'block w-full text-sm text-gray-900 bg-white border border-gray-300 rounded-md py-2 px-4 leading-tight focus:outline-none focus:bg-white focus:border-blue-500',
                        required: true,
                    }),
                ),
            ),
            // Mesto a Telefón
            React.createElement('div', { className: 'grid md:grid-cols-2 md:gap-6' },
                React.createElement('div', { className: 'relative z-0 w-full mb-5 group' },
                    React.createElement('input', {
                        type: 'text',
                        name: 'city',
                        id: 'city',
                        value: formData.city,
                        onChange: handleInputChange,
                        className: 'block py-2.5 px-0 w-full text-sm text-gray-900 bg-transparent border-0 border-b-2 border-gray-300 appearance-none focus:outline-none focus:ring-0 focus:border-blue-600 peer',
                        placeholder: ' ',
                        required: true,
                    }),
                    React.createElement('label', {
                        htmlFor: 'city',
                        className: 'peer-focus:font-medium absolute text-sm text-gray-500 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:start-0 rtl:peer-focus:translate-x-1/4 peer-focus:text-blue-600 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6'
                    }, 'Mesto'),
                ),
                React.createElement('div', { className: 'relative z-0 w-full mb-5 group flex items-center' },
                    React.createElement('div', { className: 'relative flex-shrink-0 mr-2' },
                        React.createElement('button', {
                            type: 'button',
                            onClick: () => setIsModalOpen(true),
                            className: 'flex items-center justify-between w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 border border-gray-300 rounded-lg shadow-sm hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500',
                        },
                            selectedDialCode.dialCode,
                            React.createElement(
                                'svg',
                                {
                                    className: 'ml-2 -mr-1 h-4 w-4 text-gray-500',
                                    xmlns: 'http://www.w3.org/2000/svg',
                                    viewBox: '0 0 20 20',
                                    fill: 'currentColor',
                                    'aria-hidden': 'true',
                                },
                                React.createElement('path', {
                                    fillRule: 'evenodd',
                                    d: 'M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z',
                                    clipRule: 'evenodd'
                                })
                            )
                        ),
                    ),
                    React.createElement('input', {
                        type: 'tel',
                        name: 'phone',
                        id: 'phone',
                        value: formData.phone,
                        onChange: handleInputChange,
                        className: 'block py-2.5 px-0 w-full text-sm text-gray-900 bg-transparent border-0 border-b-2 border-gray-300 appearance-none focus:outline-none focus:ring-0 focus:border-blue-600 peer',
                        placeholder: ' ',
                        required: true,
                    }),
                    React.createElement('label', {
                        htmlFor: 'phone',
                        className: 'peer-focus:font-medium absolute text-sm text-gray-500 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:start-0 rtl:peer-focus:translate-x-1/4 peer-focus:text-blue-600 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6'
                    }, 'Telefónne číslo'),
                ),
            ),
            // Informácie o núdzovom kontakte
            React.createElement('div', { className: 'space-y-4' },
                React.createElement('h3', { className: 'text-xl font-semibold text-gray-900' }, 'Informácie o núdzovom kontakte'),
                React.createElement('div', { className: 'grid md:grid-cols-2 md:gap-6' },
                    React.createElement('div', { className: 'relative z-0 w-full mb-5 group' },
                        React.createElement('input', {
                            type: 'text',
                            name: 'emergencyContactName',
                            id: 'emergencyContactName',
                            value: formData.emergencyContactName,
                            onChange: handleInputChange,
                            className: 'block py-2.5 px-0 w-full text-sm text-gray-900 bg-transparent border-0 border-b-2 border-gray-300 appearance-none focus:outline-none focus:ring-0 focus:border-blue-600 peer',
                            placeholder: ' ',
                        }),
                        React.createElement('label', {
                            htmlFor: 'emergencyContactName',
                            className: 'peer-focus:font-medium absolute text-sm text-gray-500 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:start-0 rtl:peer-focus:translate-x-1/4 peer-focus:text-blue-600 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6'
                        }, 'Meno núdzovej osoby'),
                    ),
                    React.createElement('div', { className: 'relative z-0 w-full mb-5 group' },
                        React.createElement('input', {
                            type: 'tel',
                            name: 'emergencyContactPhone',
                            id: 'emergencyContactPhone',
                            value: formData.emergencyContactPhone,
                            onChange: handleInputChange,
                            className: 'block py-2.5 px-0 w-full text-sm text-gray-900 bg-transparent border-0 border-b-2 border-gray-300 appearance-none focus:outline-none focus:ring-0 focus:border-blue-600 peer',
                            placeholder: ' ',
                        }),
                        React.createElement('label', {
                            htmlFor: 'emergencyContactPhone',
                            className: 'peer-focus:font-medium absolute text-sm text-gray-500 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:start-0 rtl:peer-focus:translate-x-1/4 peer-focus:text-blue-600 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6'
                        }, 'Telefónne číslo núdzovej osoby'),
                    ),
                ),
            ),
            // Dostupnosť a poznámky
            React.createElement('div', { className: 'space-y-4' },
                React.createElement('h3', { className: 'text-xl font-semibold text-gray-900' }, 'Špeciálne požiadavky a dostupnosť'),
                React.createElement('div', { className: 'relative z-0 w-full mb-5 group' },
                    React.createElement('label', { htmlFor: 'availability', className: 'block text-sm font-medium text-gray-700 mb-2' }, 'Kedy ste k dispozícii?'),
                    React.createElement(
                        'div',
                        { className: 'relative' },
                        React.createElement('select', {
                            id: 'availability',
                            name: 'availability',
                            value: formData.availability,
                            onChange: handleInputChange,
                            className: 'block appearance-none w-full bg-white border border-gray-300 text-gray-900 py-2 px-4 pr-8 rounded-md leading-tight focus:outline-none focus:bg-white focus:border-blue-500',
                        },
                            React.createElement('option', { value: '' }, 'Vyberte možnosť'),
                            React.createElement('option', { value: 'full_time' }, 'Plný úväzok (8:00 - 17:00)'),
                            React.createElement('option', { value: 'part_time_morning' }, 'Čiastočný úväzok (ráno)'),
                            React.createElement('option', { value: 'part_time_afternoon' }, 'Čiastočný úväzok (popoludní)'),
                            React.createElement('option', { value: 'weekends' }, 'Iba víkendy'),
                            React.createElement('option', { value: 'flexible' }, 'Flexibilný'),
                        ),
                        React.createElement('div', { className: selectArrowClasses },
                            arrowSvg
                        )
                    )
                ),
                React.createElement('div', { className: 'relative z-0 w-full mb-5 group' },
                    React.createElement('label', { htmlFor: 'notes', className: 'block text-sm font-medium text-gray-700 mb-2' }, 'Poznámky (napr. zdravotné obmedzenia, alergie)'),
                    React.createElement('textarea', {
                        name: 'notes',
                        id: 'notes',
                        rows: '4',
                        value: formData.notes,
                        onChange: handleInputChange,
                        className: 'block w-full text-sm text-gray-900 bg-white border border-gray-300 rounded-md py-2 px-4 leading-tight focus:outline-none focus:bg-white focus:border-blue-500',
                        placeholder: 'Sem napíšte svoje poznámky...'
                    }),
                ),
                React.createElement('div', { className: 'relative z-0 w-full mb-5 group' },
                    React.createElement('label', { htmlFor: 'hasCar', className: 'flex items-center text-sm font-medium text-gray-700 cursor-pointer' },
                        React.createElement('input', {
                            type: 'checkbox',
                            id: 'hasCar',
                            name: 'hasCar',
                            checked: formData.hasCar,
                            onChange: handleInputChange,
                            className: 'form-checkbox h-4 w-4 text-blue-600 transition duration-150 ease-in-out'
                        }),
                        React.createElement('span', { className: 'ml-2' }, 'Mám k dispozícii vlastné auto'),
                    )
                ),
            ),
        ),
        // Súhlas s podmienkami
        React.createElement('div', { className: 'flex items-start mb-6' },
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
        // Tlačidlo na odoslanie
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
        // Komponent modálneho okna
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

// Export hlavného komponentu
window.App = App;
