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
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [onClose, modalRef]);
    const filteredCodes = countryDialCodes.filter(c =>
        c.name.toLowerCase().includes(filter.toLowerCase()) ||
        c.dialCode.includes(filter)
    ).slice(0, 50);
    const getDialCodeClasses = (code) => {
        return `py-2 px-4 cursor-pointer hover:bg-gray-100 flex justify-between items-center rounded-lg ${selectedDialCode.dialCode === code.dialCode ? `bg-blue-100 ${unlockedButtonColor} ` : ''}`;
    };
    if (!isOpen) return null;
    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center p-4 z-50' },
        React.createElement(
            'div',
            { className: 'bg-white p-6 rounded-lg shadow-xl w-full max-w-sm', ref: modalRef },
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
                            onClick: () => { onSelect(c); onClose(); }
                        },
                        React.createElement('span', null, c.name),
                        React.createElement('span', { className: 'font-semibold' }, c.dialCode)
                    )
                )
            )
        )
    );
};

const formatPostalCode = (value) => {
    const cleanedValue = value.replace(/\D/g, '');
    const limitedValue = cleanedValue.slice(0, 5);
    if (limitedValue.length > 3) {
        return `${limitedValue.slice(0, 3)} ${limitedValue.slice(3)}`;
    }
    return limitedValue;
};

const callGoogleAppsScript = async (data) => {
    try {
        await fetch(
            "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec",
            {
                method: "POST",
                mode: "no-cors",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    action: "sendVolunteerRegistrationEmail",
                    ...data,
                }),
            }
        );
        console.log("Request sent successfully");
    } catch (error) {
        console.error("Error calling Google Apps Script:", error);
    }
};

// Funkcia na generovanie dátumov medzi `tournamentStart` a `tournamentEnd`
const generateDatesBetween = (startDate, endDate) => {
    const dates = [];
    const currentDate = new Date(startDate);
    const lastDate = new Date(endDate);
    while (currentDate <= lastDate) {
        dates.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
    }
    return dates;
};

// Hlavný komponent
const App = () => {
    const [formData, setFormData] = React.useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: '',
        phone: '',
        gender: '',
        birthDate: '',
        street: '',
        houseNumber: '',
        city: '',
        postalCode: '',
        country: '',
        tshirtSize: '',
        acceptTerms: false,
        volunteerRoles: [],
        selectedDates: [],
    });
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [authError, setAuthError] = React.useState(null);
    const [success, setSuccess] = React.useState(false);
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [selectedDialCode, setSelectedDialCode] = React.useState({ name: 'Slovenská republika', code: 'SK', dialCode: '+421' });
    const [tshirtSizes, setTshirtSizes] = React.useState([]);
    const [isSizesLoading, setIsSizesLoading] = React.useState(true);
    const [isAuthReady, setIsAuthReady] = React.useState(false);
    const [availableDates, setAvailableDates] = React.useState([]);
    const [isDatesLoading, setIsDatesLoading] = React.useState(true);
    const [timeoutId, setTimeoutId] = React.useState(null);

    // Načítanie veľkostí tričiek
    React.useEffect(() => {
        const waitForAuth = () => {
            if (window.isGlobalAuthReady) {
                setIsAuthReady(true);
                fetchTshirtSizes();
                if (timeoutId) clearTimeout(timeoutId);
            } else {
                const id = setTimeout(waitForAuth, 100);
                setTimeoutId(id);
            }
        };
        const fetchTshirtSizes = () => {
            const db = window.db;
            const docRef = doc(db, 'settings/sizeTshirts');
            const unsubscribe = onSnapshot(docRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data && data.sizes && Array.isArray(data.sizes)) {
                        setTshirtSizes(data.sizes);
                    } else {
                        console.error("Dokument veľkostí tričiek neobsahuje pole 'sizes' alebo má nesprávny formát.");
                    }
                } else {
                    console.log("Dokument veľkostí tričiek nebol nájdený!");
                }
                setIsSizesLoading(false);
            }, (error) => {
                console.error("Chyba pri načítavaní veľkostí tričiek:", error);
                setIsSizesLoading(false);
            });
            return () => unsubscribe();
        };
        waitForAuth();
        return () => {
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, []);

    // Načítanie dátumov z Firestore
    React.useEffect(() => {
        const fetchTournamentDates = () => {
            const db = window.db;
            const docRef = doc(db, 'settings/registration');
            const unsubscribe = onSnapshot(docRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.tournamentStart && data.tournamentEnd) {
                        const dates = generateDatesBetween(data.tournamentStart.toDate(), data.tournamentEnd.toDate());
                        setAvailableDates(dates);
                    }
                }
                setIsDatesLoading(false);
            }, (error) => {
                console.error("Chyba pri načítavaní dátumov:", error);
                setIsDatesLoading(false);
            });
            return () => unsubscribe();
        };
        fetchTournamentDates();
    }, []);

    // Funkcia na spracovanie zmien v checkboxoch pre dátumy
    const handleDateSelection = (date) => {
        const dateString = date.toISOString().split('T')[0];
        setFormData(prev => {
            const newDates = prev.selectedDates.includes(dateString)
                ? prev.selectedDates.filter(d => d !== dateString)
                : [...prev.selectedDates, dateString];
            return { ...prev, selectedDates: newDates };
        });
    };

    // Funkcia na spracovanie zmien v inputoch
    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    // Funkcia na spracovanie zmien v checkboxoch pre dobrovoľnícke roly
    const handleVolunteerRoleChange = (e) => {
        const { value, checked } = e.target;
        setFormData(prev => {
            const newRoles = checked
                ? [...prev.volunteerRoles, value]
                : prev.volunteerRoles.filter(role => role !== value);
            return { ...prev, volunteerRoles: newRoles };
        });
    };

    // Funkcia na spracovanie zmien v telefónnom čísle
    const handlePhoneChange = (e) => {
        const input = e.target;
        const { value, selectionStart } = input;
        const cleanedValue = value.replace(/\D/g, '');
        const formattedValue = cleanedValue.replace(/(\d{3})(?=\d)/g, '$1 ');
        const spacesBefore = (value.slice(0, selectionStart).match(/\s/g) || []).length;
        const spacesAfter = (formattedValue.slice(0, selectionStart).match(/\s/g) || []).length;
        const spaceDiff = spacesAfter - spacesBefore;
        setFormData(prev => ({ ...prev, phone: formattedValue }));
        setTimeout(() => {
            input.selectionStart = selectionStart + spaceDiff;
            input.selectionEnd = selectionStart + spaceDiff;
        }, 0);
    };

    // Funkcia na spracovanie zmien v PSČ
    const handlePostalCodeChange = (e) => {
        const formattedValue = formatPostalCode(e.target.value);
        setFormData(prev => ({ ...prev, postalCode: formattedValue }));
    };

    // Funkcia na spracovanie výberu predvoľby
    const handleDialCodeSelect = (code) => {
        setSelectedDialCode(code);
    };

    // Funkcia na odoslanie formulára
    const handleSubmit = async (e) => {
        e.preventDefault();
        setAuthError(null);
        setIsSubmitting(true);
        const fullPhoneNumber = `${selectedDialCode.dialCode}${formData.phone.replace(/\s/g, '')}`;
        try {
            const auth = window.auth;
            const db = window.db;
            const authResult = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
            const user = authResult.user;
            console.log("Používateľ úspešne vytvorený:", user.uid);
            await setDoc(doc(db, `users/${user.uid}`), {
                firstName: formData.firstName,
                lastName: formData.lastName,
                email: formData.email,
                fullPhoneNumber: fullPhoneNumber,
                role: 'volunteer',
                approved: true,
                street: formData.street,
                houseNumber: formData.houseNumber,
                city: formData.city,
                postalCode: formData.postalCode,
                country: formData.country,
                gender: formData.gender,
                birthDate: formData.birthDate,
                tshirtSize: formData.tshirtSize,
                volunteerRoles: formData.volunteerRoles,
                selectedDates: formData.selectedDates,
                registrationDate: serverTimestamp(),
            });
            setSuccess(true);
            setFormData({
                firstName: '',
                lastName: '',
                email: '',
                password: '',
                confirmPassword: '',
                phone: '',
                gender: '',
                birthDate: '',
                street: '',
                houseNumber: '',
                city: '',
                postalCode: '',
                country: '',
                tshirtSize: '',
                acceptTerms: false,
                volunteerRoles: [],
                selectedDates: [],
            });
            await callGoogleAppsScript({
                firstName: formData.firstName,
                lastName: formData.lastName,
                email: formData.email,
                contactPhoneNumber: fullPhoneNumber,
                address: {
                    street: formData.street,
                    houseNumber: formData.houseNumber,
                    city: formData.city,
                    postalCode: formData.postalCode,
                    country: formData.country,
                },
                dateOfBirth: formData.birthDate,
                skills: formData.volunteerRoles,
                selectedDates: formData.selectedDates,
            });
        } catch (error) {
            console.error("Chyba pri registrácii:", error);
            let errorMessage = "Chyba pri registrácii. Skúste to prosím znova.";
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = "Tento e-mail už je použitý. Prosím, zadajte iný.";
            } else if (error.code === 'auth/weak-password') {
                errorMessage = "Heslo je príliš slabé. Prosím, zadajte silnejšie.";
            }
            setAuthError(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Validácia formulára
    const passwordChecks = passwordStrengthCheck(formData.password);
    const isPasswordValid = Object.values(passwordChecks).every(Boolean) && formData.password === formData.confirmPassword;
    const isFormValid =
        formData.firstName &&
        formData.lastName &&
        isValidEmail(formData.email) &&
        isPasswordValid &&
        formData.phone.replace(/\s/g, '').length >= 9 &&
        formData.street &&
        formData.houseNumber &&
        formData.city &&
        formData.postalCode.replace(/\s/g, '').length === 5 &&
        formData.country &&
        formData.gender &&
        formData.birthDate &&
        formData.tshirtSize &&
        formData.acceptTerms &&
        formData.volunteerRoles.length > 0 &&
        formData.selectedDates.length > 0;

    const unlockedButtonColor = 'bg-blue-600 hover:bg-blue-700 text-white';
    const lockedButtonColor = 'bg-white text-blue-600 border border-blue-600 cursor-not-allowed';
    const buttonClasses = `mt-6 font-bold py-2 px-4 rounded-full focus:outline-none focus:shadow-outline transition-all duration-300 ${isFormValid ? unlockedButtonColor : lockedButtonColor}`;

    // Zistenie správneho popisu na základe pohlavia
    const getVolunteerLabel = () => {
        if (formData.gender === 'female') {
            return 'Môžem byť nápomocná';
        } else if (formData.gender === 'male') {
            return 'Môžem byť nápomocný';
        } else {
            return 'Môžem byť nápomocný/-á';
        }
    };

    const volunteerLabel = getVolunteerLabel();

    // Možnosti pre dobrovoľnícke role
    const volunteerOptions = [
        'Registrácia',
        'Organizácia v hale',
        'VIP občerstvenie',
        'Fan shop',
        'Stolík/zápisy stretnutí',
        'Občerstvenie pre deti'
    ];

    // Renderovanie
    if (success) {
        return React.createElement(
            'div',
            { className: 'bg-green-500 text-white p-8 rounded-lg shadow-lg w-full max-w-xl mx-auto flex items-center justify-center h-96' },
            React.createElement(
                'p',
                { className: 'text-2xl font-bold text-center' },
                'Ďakujeme za vyplnenie prihlášky dobrovoľníka. Na zadanú e-mailovú adresu bola odoslaná kópia údajov poskytnutých v registračnom formulári. V prípade potreby vás budeme pred turnajom kontaktovať.'
            )
        );
    }

    return React.createElement(
        'form',
        {
            className: 'bg-white p-8 rounded-lg w-full max-w-xl mx-auto',
            onSubmit: handleSubmit,
        },
        // Nadpis
        React.createElement('h2', { className: 'text-2xl font-bold mb-6 text-center text-gray-800' }, 'Registrácia dobrovoľníka'),

        // Meno
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

        // Priezvisko
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

        // E-mail
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
            ),
            React.createElement(
                'p',
                { className: 'text-xs text-gray-500 mt-1' },
                'E-mailová adresa a heslo budú potrebné na prípadnú neskoršiu úpravu údajov poskytnutých v tomto registračnom formulári.'
            )
        ),

        // Heslo
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

        // Potvrdenie hesla
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

        // Adresa trvalého bydliska
        React.createElement(
            'div',
            { className: 'mb-4' },
            React.createElement('h3', { className: 'block text-gray-700 text-lg font-bold mb-2' }, 'Adresa trvalého bydliska'),
        ),

        // Ulica
        React.createElement(
            'div',
            { className: 'mb-4' },
            React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'street' }, 'Ulica'),
            React.createElement('input', {
                className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
                id: 'street',
                type: 'text',
                name: 'street',
                placeholder: 'Zadajte ulicu',
                value: formData.street,
                onChange: handleInputChange,
            }),
        ),

        // Popisné číslo
        React.createElement(
            'div',
            { className: 'mb-4' },
            React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'houseNumber' }, 'Popisné číslo'),
            React.createElement('input', {
                className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
                id: 'houseNumber',
                type: 'text',
                name: 'houseNumber',
                placeholder: 'Zadajte popisné číslo',
                value: formData.houseNumber,
                onChange: handleInputChange,
            }),
        ),

        // Mesto/obec
        React.createElement(
            'div',
            { className: 'mb-4' },
            React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'city' }, 'Mesto/obec'),
            React.createElement('input', {
                className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
                id: 'city',
                type: 'text',
                name: 'city',
                placeholder: 'Zadajte mesto alebo obec',
                value: formData.city,
                onChange: handleInputChange,
            }),
        ),

        // PSČ
        React.createElement(
            'div',
            { className: 'mb-4' },
            React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'postalCode' }, 'PSČ'),
            React.createElement('input', {
                className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
                id: 'postalCode',
                type: 'text',
                name: 'postalCode',
                placeholder: 'xxx xx',
                value: formData.postalCode,
                onChange: handlePostalCodeChange,
            }),
        ),

        // Krajina
        React.createElement(
            'div',
            { className: 'mb-4' },
            React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'country' }, 'Krajina'),
            React.createElement('input', {
                className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
                id: 'country',
                type: 'text',
                name: 'country',
                placeholder: 'Zadajte krajinu',
                value: formData.country,
                onChange: handleInputChange,
            }),
        ),

        // Pohlavie a Dátum narodenia
        React.createElement(
            'div',
            { className: 'flex space-x-4 mb-4' },
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
                )
            ),
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

        // Dobrovoľnícke role
        React.createElement(
            'div',
            { className: 'mb-4' },
            React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2' }, volunteerLabel),
            React.createElement(
                'div',
                { className: 'grid grid-cols-1 sm:grid-cols-2 gap-2' },
                volunteerOptions.map(option => {
                    const isSelected = formData.volunteerRoles.includes(option);
                    return React.createElement(
                        'label',
                        {
                            key: option,
                            className: `flex items-center bg-gray-100 p-2 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors duration-200 ${isSelected ? 'bg-blue-200' : ''}`
                        },
                        React.createElement('input', {
                            type: 'checkbox',
                            name: 'volunteerRoles',
                            value: option,
                            checked: isSelected,
                            onChange: handleVolunteerRoleChange,
                            className: 'form-checkbox h-4 w-4 text-blue-600'
                        }),
                        React.createElement('span', { className: 'ml-2 text-gray-700 text-sm' }, option)
                    );
                })
            )
        ),

        // Výber dátumov
        React.createElement(
            'div',
            { className: 'mb-4' },
            React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2' }, 'Vyberte dátumy, kedy môžete pomôcť'),
            React.createElement(
                'div',
                { className: 'grid grid-cols-1 sm:grid-cols-2 gap-2' },
                availableDates.map((date, index) => {
                    const dateString = date.toISOString().split('T')[0];
                    const isSelected = formData.selectedDates.includes(dateString);
                    return React.createElement(
                        'label',
                        {
                            key: index,
                            className: `flex items-center bg-gray-100 p-2 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors duration-200 ${isSelected ? 'bg-blue-200' : ''}`
                        },
                        React.createElement('input', {
                            type: 'checkbox',
                            checked: isSelected,
                            onChange: () => handleDateSelection(date),
                            className: 'form-checkbox h-4 w-4 text-blue-600'
                        }),
                        React.createElement(
                            'span',
                            { className: 'ml-2 text-gray-700 text-sm' },
                            date.toLocaleDateString('sk-SK')
                        )
                    );
                })
            )
        ),

        // Veľkosť trička
        React.createElement(
            'div',
            { className: 'mb-4' },
            React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'tshirtSize' }, 'Veľkosť trička'),
            React.createElement(
                'select',
                {
                    className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
                    id: 'tshirtSize',
                    name: 'tshirtSize',
                    value: formData.tshirtSize,
                    onChange: handleInputChange,
                    disabled: isSizesLoading,
                },
                isSizesLoading
                    ? React.createElement('option', { value: '' }, 'Načítavam veľkosti...')
                    : React.createElement('option', { value: '' }, 'Vyberte veľkosť...'),
                tshirtSizes.map(size =>
                    React.createElement('option', { key: size, value: size }, size)
                )
            )
        ),

        // Telefónne číslo
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
                        className: 'bg-white hover:bg-gray-100 text-gray-700 font-semibold py-2 px-3 rounded-l-lg border-t border-b border-l border-gray-300 focus:outline-none transition-all duration-300 flex items-center justify-between gap-2'
                    },
                    React.createElement('span', null, selectedDialCode.dialCode),
                    React.createElement('svg', {
                        xmlns: "http://www.w3.org/2000/svg",
                        className: "h-4 w-4 text-gray-500",
                        viewBox: "0 0 20 20",
                        fill: "currentColor"
                    },
                        React.createElement('path', {
                            fillRule: "evenodd",
                            d: "M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z",
                            clipRule: "evenodd"
                        })
                    )
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

        // Súhlas so spracovaním údajov
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
                'Súhlasím so spracovaním osobných údajov na účely prípravy dobrovoľníckej zmluvy.'
            )
        ),

        // Zobrazenie chybových hlášok
        authError && React.createElement(
            'div',
            { className: 'bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-lg', role: 'alert' },
            React.createElement('p', { className: 'font-bold' }, 'Chyba'),
            React.createElement('p', null, authError)
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

        // Modálne okno pre výber predvoľby
        React.createElement(DialCodeModal, {
            isOpen: isModalOpen,
            onClose: () => setIsModalOpen(false),
            onSelect: handleDialCodeSelect,
            selectedDialCode: selectedDialCode,
            unlockedButtonColor: unlockedButtonColor,
        }),
    );
};

// Export hlavného komponentu
window.App = App;
