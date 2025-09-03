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
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [modalRef, onClose]);

    const filteredCodes = countryDialCodes.filter(c =>
        c.country.toLowerCase().includes(filter.toLowerCase()) ||
        c.dial_code.includes(filter)
    ).slice(0, 15); // Obmedzenie na 15 výsledkov

    const modalClasses = `fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50 transition-opacity duration-300 ${isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`;

    return React.createElement('div', { className: modalClasses },
        React.createElement('div', {
                className: 'bg-white rounded-lg shadow-xl p-4 w-11/12 md:w-1/2 lg:w-1/3 max-h-[80vh] flex flex-col',
                ref: modalRef
            },
            React.createElement('div', { className: 'flex justify-between items-center mb-4 border-b pb-2' },
                React.createElement('h3', { className: 'text-lg font-semibold text-gray-900' }, 'Vyberte predvoľbu krajiny'),
                React.createElement('button', {
                    onClick: onClose,
                    className: 'text-gray-400 hover:text-gray-600'
                }, '×')
            ),
            React.createElement('input', {
                type: 'text',
                placeholder: 'Hľadaj krajinu alebo kód...',
                className: 'w-full p-2 mb-4 border rounded-md',
                value: filter,
                onChange: (e) => setFilter(e.target.value)
            }),
            React.createElement('div', { className: 'overflow-y-auto flex-grow' },
                filteredCodes.map(code =>
                    React.createElement('div', {
                        key: code.code,
                        onClick: () => onSelect(code.dial_code),
                        className: `p-2 cursor-pointer rounded-md hover:bg-gray-200 flex justify-between items-center ${selectedDialCode === code.dial_code ? 'bg-gray-300' : ''}`
                    },
                        React.createElement('span', null, `${code.country} (${code.code})`),
                        React.createElement('span', { className: 'font-mono text-gray-600' }, code.dial_code)
                    )
                )
            ),
            React.createElement('div', { className: 'mt-4 text-center text-sm text-gray-500' },
                'Vybratá predvoľba: ' + selectedDialCode
            )
        )
    );
};

// Hlavný komponent pre registračný formulár dobrovoľníka
const App = () => {
    const [isAuthReady, setIsAuthReady] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [submitStatus, setSubmitStatus] = React.useState(null); // 'success' alebo 'error'
    const [errorMessage, setErrorMessage] = React.useState('');
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [selectedDialCode, setSelectedDialCode] = React.useState('+421');

    // Inicializácia a prihlásenie pri načítaní komponentu
    const [firebase, setFirebase] = React.useState(null);
    React.useEffect(() => {
        const initFirebase = async () => {
            try {
                // Globálne premenné z hostiteľského prostredia
                const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
                const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
                const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

                const firebaseApp = window.firebase.initializeApp(firebaseConfig);
                const auth = window.firebase.getAuth(firebaseApp);
                const db = window.firebase.getFirestore(firebaseApp);

                // Prihlásenie s vlastným tokenom alebo anonymne
                if (initialAuthToken) {
                    await window.firebase.signInWithCustomToken(auth, initialAuthToken);
                } else {
                    await window.firebase.signInAnonymously(auth);
                }

                setFirebase({ app: firebaseApp, auth, db, appId });
                setIsAuthReady(true);
                window.isGlobalAuthReady = true; // Nastavíme globálny stav
                console.log("Firebase a autentifikácia sú pripravené.");
            } catch (error) {
                console.error("Chyba pri inicializácii Firebase alebo autentifikácii:", error);
                setErrorMessage("Chyba pri inicializácii aplikácie. Skúste to prosím znova.");
                setIsAuthReady(true); // Ukončíme načítavanie aj v prípade chyby
                window.isGlobalAuthReady = true;
            }
        };

        if (typeof window.firebase !== 'undefined' && !window.isGlobalAuthReady) {
            initFirebase();
        } else if (window.isGlobalAuthReady) {
            setIsAuthReady(true);
        }
    }, []);

    const [formData, setFormData] = React.useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: '',
        dateOfBirth: '',
        street: '',
        houseNumber: '',
        postalCode: '',
        city: '',
        country: 'Slovensko', // Predvolená hodnota pre krajinu
        contactPhoneNumber: '',
        skills: [], // pole pre zručnosti
        availabilities: {}, // objekt pre dostupnosť
        acceptTerms: false,
    });

    const isFormValid = formData.firstName &&
        formData.lastName &&
        isValidEmail(formData.email) &&
        formData.password.length >= 10 &&
        /[a-z]/.test(formData.password) &&
        /[A-Z]/.test(formData.password) &&
        /[0-9]/.test(formData.password) &&
        formData.password === formData.confirmPassword &&
        formData.dateOfBirth &&
        formData.street &&
        formData.houseNumber &&
        formData.postalCode &&
        formData.city &&
        formData.contactPhoneNumber &&
        formData.acceptTerms &&
        isAuthReady;

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prevData => ({
            ...prevData,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const handleAvailabilityChange = (date) => {
        setFormData(prevData => ({
            ...prevData,
            availabilities: {
                ...prevData.availabilities,
                [date]: !prevData.availabilities[date],
            },
        }));
    };

    const handleSkillChange = (skill) => {
        setFormData(prevData => {
            const newSkills = prevData.skills.includes(skill)
                ? prevData.skills.filter(s => s !== skill)
                : [...prevData.skills, skill];
            return { ...prevData, skills: newSkills };
        });
    };

    const handleDialCodeSelect = (code) => {
        setSelectedDialCode(code);
        setIsModalOpen(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitStatus(null);
        setErrorMessage('');

        if (!firebase || !firebase.auth || !firebase.db) {
            setErrorMessage("Chyba: Firebase nie je správne inicializované.");
            setIsSubmitting(false);
            return;
        }

        try {
            const { auth, db, appId } = firebase;
            // Krok 1: Registrácia používateľa v Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
            const user = userCredential.user;

            // Vytvorenie štruktúry pre Firestore
            const volunteerData = {
                firstName: formData.firstName,
                lastName: formData.lastName,
                email: formData.email,
                dateOfBirth: formData.dateOfBirth,
                contactPhoneNumber: selectedDialCode + formData.contactPhoneNumber,
                skills: formData.skills,
                availabilities: formData.availabilities,
                address: {
                    street: formData.street,
                    houseNumber: formData.houseNumber,
                    city: formData.city,
                    postalCode: formData.postalCode,
                    country: formData.country,
                },
                createdAt: serverTimestamp(),
                // Pridáme isAdmin na false, aby sa zabezpečilo, že nie je administrátor
                isAdmin: false,
                isApproved: false,
                type: 'volunteer'
            };

            // Krok 2: Uloženie dát do Firestore v kolekcii 'users'
            const userDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/private/data/users`, user.uid);
            await setDoc(userDocRef, volunteerData);

            // Krok 3: Odoslanie e-mailu cez Apps Script s premennými z formulára
            const appsScriptUrl = 'https://script.google.com/macros/s/AKfycbygG447G4R0Y7xLz7P7l7F-n-Y4hJ6v-y6S2xK6k/exec'; // ZMEŇTE TOTO NA SVOJU VLASTNÚ URL

            const payload = {
                action: 'sendVolunteerRegistrationEmail',
                firstName: volunteerData.firstName,
                lastName: volunteerData.lastName,
                email: volunteerData.email,
                contactPhoneNumber: volunteerData.contactPhoneNumber,
                dateOfBirth: volunteerData.dateOfBirth,
                address: volunteerData.address,
                skills: volunteerData.skills,
                availabilities: volunteerData.availabilities,
            };

            const response = await fetch(appsScriptUrl, {
                method: 'POST',
                mode: 'cors',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            if (result.success) {
                setSubmitStatus('success');
            } else {
                setSubmitStatus('error');
                setErrorMessage(result.message || "Nepodarilo sa odoslať potvrdzovací e-mail.");
            }

        } catch (error) {
            console.error("Chyba pri registrácii:", error);
            setSubmitStatus('error');
            setErrorMessage("Registrácia zlyhala. Skúste to prosím znova. Ak problém pretrváva, kontaktujte podporu.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const inputClasses = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-150 ease-in-out";
    const labelClasses = "block text-sm font-medium text-gray-700";
    const groupClasses = "mb-4";
    const buttonClasses = `w-full px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${isSubmitting || !isFormValid || !isAuthReady ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'} transition duration-150 ease-in-out`;
    const unlockedButtonColor = "bg-blue-600 hover:bg-blue-700";
    const formContainerClasses = "bg-white p-6 rounded-lg shadow-md max-w-2xl mx-auto w-full";

    const passwordChecks = passwordStrengthCheck(formData.password);
    const passwordRequirementsMet = Object.values(passwordChecks).every(check => check);

    const dates = ["2025-07-28", "2025-07-29", "2025-07-30", "2025-07-31", "2025-08-01", "2025-08-02", "2025-08-03"];
    const skills = [
        "Technická podpora",
        "Zdravotná pomoc",
        "Práca s deťmi",
        "Doprava a logistika",
        "Organizačná a administratívna podpora",
        "Tvorba obsahu a social media",
        "Ubytovanie a stravovanie"
    ];

    if (errorMessage) {
        return React.createElement('div', { className: formContainerClasses },
            React.createElement('h2', { className: 'text-2xl font-bold text-center text-gray-900' }, 'Chyba'),
            React.createElement('p', { className: 'mt-4 text-center text-red-600' }, errorMessage)
        );
    }

    if (submitStatus === 'success') {
        return React.createElement('div', { className: formContainerClasses },
            React.createElement('h2', { className: 'text-2xl font-bold text-center text-green-600' }, 'Registrácia úspešná!'),
            React.createElement('p', { className: 'mt-4 text-center text-gray-800' }, 'Ďakujeme za vašu registráciu. Potvrdzujúci e-mail bol odoslaný na vašu adresu.'),
            React.createElement('p', { className: 'mt-2 text-center text-sm text-gray-600' }, 'Ešte raz ďakujeme za prejavený záujem!')
        );
    }

    if (!isAuthReady) {
        return React.createElement('div', { className: formContainerClasses },
            React.createElement('h2', { className: 'text-2xl font-bold text-center text-gray-900' }, 'Načítavam formulár...'),
            React.createElement('p', { className: 'mt-4 text-center text-gray-600' }, 'Prosím, počkajte chvíľu, kým sa aplikácia pripraví.')
        );
    }

    return React.createElement('form', { onSubmit: handleSubmit, className: formContainerClasses },
        React.createElement('h2', { className: 'text-2xl font-bold text-center text-gray-900 mb-6' }, 'Registrácia dobrovoľníka'),
        // Osobné údaje
        React.createElement('h3', { className: 'text-xl font-semibold text-gray-800 mb-4' }, 'Osobné údaje'),
        React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
            // Meno
            React.createElement('div', { className: groupClasses },
                React.createElement('label', { className: labelClasses, htmlFor: 'firstName' }, 'Meno *'),
                React.createElement('input', {
                    type: 'text',
                    id: 'firstName',
                    name: 'firstName',
                    value: formData.firstName,
                    onChange: handleInputChange,
                    required: true,
                    className: inputClasses,
                }),
            ),
            // Priezvisko
            React.createElement('div', { className: groupClasses },
                React.createElement('label', { className: labelClasses, htmlFor: 'lastName' }, 'Priezvisko *'),
                React.createElement('input', {
                    type: 'text',
                    id: 'lastName',
                    name: 'lastName',
                    value: formData.lastName,
                    onChange: handleInputChange,
                    required: true,
                    className: inputClasses,
                }),
            ),
        ),
        // Email a heslo
        React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
            React.createElement('div', { className: groupClasses },
                React.createElement('label', { className: labelClasses, htmlFor: 'email' }, 'E-mail *'),
                React.createElement('input', {
                    type: 'email',
                    id: 'email',
                    name: 'email',
                    value: formData.email,
                    onChange: handleInputChange,
                    required: true,
                    className: inputClasses,
                }),
            ),
            React.createElement('div', { className: groupClasses },
                React.createElement('label', { className: labelClasses, htmlFor: 'password' }, 'Heslo *'),
                React.createElement('input', {
                    type: 'password',
                    id: 'password',
                    name: 'password',
                    value: formData.password,
                    onChange: handleInputChange,
                    required: true,
                    className: inputClasses,
                }),
                !passwordRequirementsMet && formData.password.length > 0 &&
                React.createElement('ul', { className: 'mt-2 text-sm text-red-500 list-disc list-inside' },
                    !passwordChecks.length && React.createElement('li', null, 'Heslo musí mať aspoň 10 znakov'),
                    !passwordChecks.lowercase && React.createElement('li', null, 'Obsahuje malé písmeno'),
                    !passwordChecks.uppercase && React.createElement('li', null, 'Obsahuje veľké písmeno'),
                    !passwordChecks.number && React.createElement('li', null, 'Obsahuje číslicu')
                )
            ),
        ),
        React.createElement('div', { className: groupClasses },
            React.createElement('label', { className: labelClasses, htmlFor: 'confirmPassword' }, 'Potvrdenie hesla *'),
            React.createElement('input', {
                type: 'password',
                id: 'confirmPassword',
                name: 'confirmPassword',
                value: formData.confirmPassword,
                onChange: handleInputChange,
                required: true,
                className: inputClasses,
            }),
            formData.password !== formData.confirmPassword && formData.confirmPassword.length > 0 &&
            React.createElement('p', { className: 'mt-2 text-sm text-red-500' }, 'Heslá sa nezhodujú.')
        ),

        // Dátum narodenia a telefónne číslo
        React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
            React.createElement('div', { className: groupClasses },
                React.createElement('label', { className: labelClasses, htmlFor: 'dateOfBirth' }, 'Dátum narodenia *'),
                React.createElement('input', {
                    type: 'date',
                    id: 'dateOfBirth',
                    name: 'dateOfBirth',
                    value: formData.dateOfBirth,
                    onChange: handleInputChange,
                    required: true,
                    className: inputClasses,
                }),
            ),
            React.createElement('div', { className: groupClasses },
                React.createElement('label', { className: labelClasses, htmlFor: 'contactPhoneNumber' }, 'Telefónne číslo *'),
                React.createElement('div', { className: 'flex mt-1' },
                    React.createElement('button', {
                        type: 'button',
                        onClick: () => setIsModalOpen(true),
                        className: `flex-shrink-0 inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-l-md border border-gray-300 shadow-sm text-gray-700 ${unlockedButtonColor} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`
                    }, selectedDialCode),
                    React.createElement('input', {
                        type: 'tel',
                        id: 'contactPhoneNumber',
                        name: 'contactPhoneNumber',
                        value: formData.contactPhoneNumber,
                        onChange: handleInputChange,
                        required: true,
                        className: `flex-grow ${inputClasses.replace('mt-1', '')} rounded-l-none`,
                        placeholder: 'napr. 907 123 456',
                    }),
                )
            ),
        ),

        // Adresa
        React.createElement('h3', { className: 'text-xl font-semibold text-gray-800 mt-6 mb-4' }, 'Adresa'),
        React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
            // Ulica
            React.createElement('div', { className: groupClasses },
                React.createElement('label', { className: labelClasses, htmlFor: 'street' }, 'Ulica *'),
                React.createElement('input', {
                    type: 'text',
                    id: 'street',
                    name: 'street',
                    value: formData.street,
                    onChange: handleInputChange,
                    required: true,
                    className: inputClasses,
                }),
            ),
            // Číslo domu
            React.createElement('div', { className: groupClasses },
                React.createElement('label', { className: labelClasses, htmlFor: 'houseNumber' }, 'Číslo domu *'),
                React.createElement('input', {
                    type: 'text',
                    id: 'houseNumber',
                    name: 'houseNumber',
                    value: formData.houseNumber,
                    onChange: handleInputChange,
                    required: true,
                    className: inputClasses,
                }),
            ),
        ),
        React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
            // PSČ
            React.createElement('div', { className: groupClasses },
                React.createElement('label', { className: labelClasses, htmlFor: 'postalCode' }, 'PSČ *'),
                React.createElement('input', {
                    type: 'text',
                    id: 'postalCode',
                    name: 'postalCode',
                    value: formData.postalCode,
                    onChange: handleInputChange,
                    required: true,
                    className: inputClasses,
                }),
            ),
            // Mesto
            React.createElement('div', { className: groupClasses },
                React.createElement('label', { className: labelClasses, htmlFor: 'city' }, 'Mesto *'),
                React.createElement('input', {
                    type: 'text',
                    id: 'city',
                    name: 'city',
                    value: formData.city,
                    onChange: handleInputChange,
                    required: true,
                    className: inputClasses,
                }),
            ),
        ),
        // Krajina
        React.createElement('div', { className: groupClasses },
            React.createElement('label', { className: labelClasses, htmlFor: 'country' }, 'Krajina *'),
            React.createElement('input', {
                type: 'text',
                id: 'country',
                name: 'country',
                value: formData.country,
                onChange: handleInputChange,
                required: true,
                className: inputClasses,
            }),
        ),

        // Zručnosti
        React.createElement('h3', { className: 'text-xl font-semibold text-gray-800 mt-6 mb-4' }, 'Možnosti spolupráce'),
        React.createElement('div', { className: 'flex flex-wrap gap-2 mb-4' },
            skills.map(skill =>
                React.createElement('button', {
                    key: skill,
                    type: 'button',
                    onClick: () => handleSkillChange(skill),
                    className: `px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 ${formData.skills.includes(skill) ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`
                }, skill)
            )
        ),
        // Dostupnosť
        React.createElement('h3', { className: 'text-xl font-semibold text-gray-800 mt-6 mb-4' }, 'Vaša dostupnosť'),
        React.createElement('div', { className: 'flex flex-wrap gap-2 mb-4' },
            dates.map(date => {
                const isAvailable = formData.availabilities[date];
                const dayName = new Date(date).toLocaleDateString('sk-SK', { weekday: 'short' });
                return React.createElement('button', {
                    key: date,
                    type: 'button',
                    onClick: () => handleAvailabilityChange(date),
                    className: `px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 ${isAvailable ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`
                }, `${dayName} ${new Date(date).toLocaleDateString('sk-SK', { day: 'numeric', month: 'numeric' })}`)
            })
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
    );
};

// Export the main component
window.App = App;
