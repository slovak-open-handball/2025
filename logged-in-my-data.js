// logged-in-my-data.js
// Tento súbor spravuje React komponent MyDataApp, ktorý zobrazuje
// profilové a registračné dáta prihláseného používateľa.
// Spolieha sa na to, že Firebase inštancie (auth, db) a profilové dáta
// sú už definované globálne v 'authentication.js'.

const { useState, useEffect, useCallback } = React;

// Dôležité: Importy pre reautentifikáciu, aktualizáciu e-mailu a overenie
// Predpokladáme, že tieto súbory sú správne načítané v HTML
const {
    EmailAuthProvider,
    reauthenticateWithCredential,
    updateEmail,
    sendEmailVerification
} = firebase.auth;

const {
    doc,
    setDoc
} = firebase.firestore;


/**
 * Pomocný komponent pre načítavanie dát.
 */
const Loader = () => {
    return React.createElement(
        'div',
        { className: 'flex justify-center pt-16' },
        React.createElement(
            'div',
            { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' }
        )
    );
};

/**
 * Pomocný komponent pre zobrazenie chybovej správy.
 * @param {object} props - Vlastnosti komponentu.
 * @param {string} props.message - Chybová správa na zobrazenie.
 */
const ErrorMessage = ({ message }) => {
    return React.createElement(
        'div',
        { className: 'flex justify-center pt-16' },
        React.createElement(
            'div',
            { className: 'p-8 bg-red-100 border-l-4 border-red-500 text-red-700 rounded-lg shadow-md' },
            React.createElement('p', { className: 'font-bold' }, 'Chyba'),
            React.createElement('p', null, message)
        )
    );
};

/**
 * Pomocná funkcia na formátovanie telefónneho čísla s použitím predvolieb.
 * @param {string} phoneNumber - Telefónne číslo na formátovanie.
 * @returns {string} Formátované telefónne číslo.
 */
const formatPhoneNumber = (phoneNumber) => {
    if (!phoneNumber) return '';
    const cleaned = phoneNumber.replace(/\D/g, '');
    let formatted = cleaned;
    
    // Predpokladáme, že window.countryDialCodes je globálne dostupné
    if (window.countryDialCodes) {
        // Skúsime nájsť najdlhšiu zhodu predvoľby
        const foundDialCode = window.countryDialCodes.find(item => cleaned.startsWith(item.dialCode.replace('+', '')));
        
        if (foundDialCode) {
            const dialCodeWithoutPlus = foundDialCode.dialCode.replace('+', '');
            const numberWithoutDialCode = cleaned.substring(dialCodeWithoutPlus.length);
            // Formátovanie zvyšku čísla po 3 čísliciach
            const formattedNumber = numberWithoutDialCode.replace(/(\d{3})(?=\d)/g, '$1 ');
            return `${foundDialCode.dialCode} ${formattedNumber}`;
        }
    }
    
    // Predvolené formátovanie, ak sa nenašla žiadna predvoľba
    if (cleaned.length === 10) {
        return `(${cleaned.substring(0, 3)}) ${cleaned.substring(3, 6)}-${cleaned.substring(6, 10)}`;
    }
    return cleaned.replace(/(\d{3})(?=\d)/g, '$1 ');
};

/**
 * Funkcia na získanie farby hlavičky na základe role používateľa.
 * @param {string} role - Rola používateľa ('admin', 'hall', 'user').
 * @returns {string} Hex kód farby.
 */
const getRoleColor = (role) => {
    switch (role) {
        case 'admin':
            return '#47b3ff';
        case 'hall':
            return '#b06835';
        case 'user':
            return '#9333EA';
        default:
            return '#374151';
    }
};

/**
 * Komponent pre modálne okno na úpravu fakturačných údajov.
 */
const EditBillingModal = ({ userProfileData, isOpen, onClose }) => {
    const [formData, setFormData] = useState({
        clubName: userProfileData.billing?.clubName || '',
        ico: userProfileData.billing?.ico || '',
        dic: userProfileData.billing?.dic || '',
        icDph: userProfileData.billing?.icDph || '',
        street: userProfileData.street || '',
        houseNumber: userProfileData.houseNumber || '',
        city: userProfileData.city || '',
        postalCode: userProfileData.postalCode || '',
        country: userProfileData.country || '',
    });
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);

    // Funkcia na validáciu formulára
    const validateForm = () => {
        const newErrors = {};
        let isValid = true;

        // Validácia PSČ
        const postalCodeClean = formData.postalCode.replace(/\s/g, '');
        if (postalCodeClean && !/^\d{5}$/.test(postalCodeClean)) {
            newErrors.postalCode = 'PSČ musí obsahovať presne 5 číslic.';
            isValid = false;
        }

        // Validácia IČO
        if (formData.ico && !/^\d+$/.test(formData.ico)) {
            newErrors.ico = 'IČO môže obsahovať iba číslice.';
            isValid = false;
        }

        // Validácia DIČ
        if (formData.dic && !/^\d+$/.test(formData.dic)) {
            newErrors.dic = 'DIČ môže obsahovať iba číslice.';
            isValid = false;
        }

        // Validácia IČ DPH
        if (formData.icDph && !/^[A-Z]{2}\d+$/.test(formData.icDph)) {
            newErrors.icDph = 'IČ DPH musí začínať dvoma veľkými písmenami a nasledovať musia číslice.';
            isValid = false;
        }

        setErrors(newErrors);
        return isValid;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        let newValue = value;

        // Logika pre validáciu a formátovanie
        if (name === 'postalCode') {
            const cleaned = value.replace(/\D/g, '');
            newValue = cleaned;
            if (cleaned.length > 3) {
                newValue = `${cleaned.substring(0, 3)} ${cleaned.substring(3, 5)}`;
            }
        } else if (name === 'ico' || name === 'dic') {
             newValue = value.replace(/\D/g, '');
        } else if (name === 'icDph') {
            // Kontrola formátu pre IČ DPH
            const currentIcDph = value.toUpperCase();
            if (currentIcDph.length >= 2) {
                const firstTwoChars = currentIcDph.substring(0, 2);
                const remainingChars = currentIcDph.substring(2).replace(/\D/g, '');
                newValue = `${firstTwoChars.replace(/[^A-Z]/g, '')}${remainingChars}`;
            } else {
                newValue = currentIcDph.replace(/[^A-Z]/g, '');
            }
        }

        setFormData(prevData => ({ ...prevData, [name]: newValue }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            console.error("Formulár obsahuje chyby, uloženie zablokované.");
            return;
        }

        setLoading(true);
        const db = window.db;
        const auth = window.auth;

        if (!db || !auth || !auth.currentUser) {
            console.error("Firestore nie je inicializovaný alebo používateľ nie je prihlásený.");
            setLoading(false);
            return;
        }

        const userId = auth.currentUser.uid;
        // Pevne zadefinovaná cesta na základe štruktúry databázy v 'authentication.js'
        const userDocRef = doc(db, 'users', userId);
        
        try {
            // Použitie setDoc s merge: true, aby sa aktualizovali len zadané polia
            await setDoc(userDocRef, {
                billing: {
                    clubName: formData.clubName,
                    ico: formData.ico,
                    dic: formData.dic,
                    icDph: formData.icDph,
                },
                street: formData.street,
                houseNumber: formData.houseNumber,
                city: formData.city,
                postalCode: formData.postalCode.replace(/\s/g, ''), // Uložíme PSČ bez medzery
                country: formData.country,
            }, { merge: true });
            console.log("Fakturačné údaje boli úspešne uložené!");
            onClose();
        } catch (error) {
            console.error("Chyba pri ukladaní fakturačných údajov: ", error);
            // Tu by sa mohla zobraziť chybová správa používateľovi
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const isFormValid = Object.keys(errors).length === 0 && (formData.postalCode.replace(/\s/g, '').length === 5 || formData.postalCode.replace(/\s/g, '').length === 0);
    const buttonClasses = `bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline ${!isFormValid || loading ? 'opacity-50 cursor-not-allowed' : ''}`;

    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center' },
        React.createElement(
            'div',
            { className: 'bg-white p-8 rounded-lg shadow-xl m-4 max-w-md w-full' },
            React.createElement(
                'div',
                { className: 'flex justify-end' },
                React.createElement(
                    'button',
                    { onClick: onClose, className: 'text-gray-400 hover:text-gray-600' },
                    React.createElement(
                        'svg',
                        { className: 'h-6 w-6', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M6 18L18 6M6 6l12 12' })
                    )
                )
            ),
            React.createElement(
                'form',
                { onSubmit: handleSubmit },
                React.createElement(
                    'h3',
                    { className: 'text-2xl font-bold mb-4 text-gray-800' },
                    'Upraviť fakturačné údaje'
                ),
                React.createElement('div', { className: 'mb-4' },
                    React.createElement('label', { htmlFor: 'clubName', className: 'block text-gray-700 text-sm font-bold mb-2' }, 'Názov klubu'),
                    React.createElement('input', { type: 'text', id: 'clubName', name: 'clubName', value: formData.clubName, onChange: handleChange, className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700' })
                ),
                React.createElement('div', { className: 'mb-4' },
                    React.createElement('label', { htmlFor: 'street', className: 'block text-gray-700 text-sm font-bold mb-2' }, 'Ulica'),
                    React.createElement('input', { type: 'text', id: 'street', name: 'street', value: formData.street, onChange: handleChange, className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700' })
                ),
                React.createElement('div', { className: 'mb-4' },
                    React.createElement('label', { htmlFor: 'houseNumber', className: 'block text-gray-700 text-sm font-bold mb-2' }, 'Číslo domu'),
                    React.createElement('input', { type: 'text', id: 'houseNumber', name: 'houseNumber', value: formData.houseNumber, onChange: handleChange, className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700' })
                ),
                React.createElement('div', { className: 'mb-4' },
                    React.createElement('label', { htmlFor: 'city', className: 'block text-gray-700 text-sm font-bold mb-2' }, 'Mesto'),
                    React.createElement('input', { type: 'text', id: 'city', name: 'city', value: formData.city, onChange: handleChange, className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700' })
                ),
                React.createElement('div', { className: 'mb-4' },
                    React.createElement('label', { htmlFor: 'postalCode', className: 'block text-gray-700 text-sm font-bold mb-2' }, 'PSČ'),
                    React.createElement('input', { type: 'text', id: 'postalCode', name: 'postalCode', value: formData.postalCode, onChange: handleChange, className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700', maxLength: '6' }),
                    errors.postalCode && React.createElement('p', { className: 'text-red-500 text-xs italic mt-1' }, errors.postalCode)
                ),
                React.createElement('div', { className: 'mb-4' },
                    React.createElement('label', { htmlFor: 'ico', className: 'block text-gray-700 text-sm font-bold mb-2' }, 'IČO'),
                    React.createElement('input', { type: 'text', id: 'ico', name: 'ico', value: formData.ico, onChange: handleChange, className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700' }),
                    errors.ico && React.createElement('p', { className: 'text-red-500 text-xs italic mt-1' }, errors.ico)
                ),
                React.createElement('div', { className: 'mb-4' },
                    React.createElement('label', { htmlFor: 'dic', className: 'block text-gray-700 text-sm font-bold mb-2' }, 'DIČ'),
                    React.createElement('input', { type: 'text', id: 'dic', name: 'dic', value: formData.dic, onChange: handleChange, className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700' }),
                    errors.dic && React.createElement('p', { className: 'text-red-500 text-xs italic mt-1' }, errors.dic)
                ),
                React.createElement('div', { className: 'mb-6' },
                    React.createElement('label', { htmlFor: 'icDph', className: 'block text-gray-700 text-sm font-bold mb-2' }, 'IČ DPH'),
                    React.createElement('input', { type: 'text', id: 'icDph', name: 'icDph', value: formData.icDph, onChange: handleChange, className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700' }),
                    errors.icDph && React.createElement('p', { className: 'text-red-500 text-xs italic mt-1' }, errors.icDph)
                ),
                React.createElement(
                    'div',
                    { className: 'flex items-center justify-between' },
                    React.createElement(
                        'button',
                        {
                            type: 'submit',
                            className: buttonClasses,
                            disabled: !isFormValid || loading,
                        },
                        loading ? 'Ukladám...' : 'Uložiť zmeny'
                    ),
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: onClose,
                            className: 'inline-block align-baseline font-bold text-sm text-blue-500 hover:text-blue-800',
                        },
                        'Zrušiť'
                    )
                )
            )
        )
    );
};

/**
 * Komponent pre modálne okno na úpravu kontaktných údajov.
 */
const EditContactModal = ({ userProfileData, isOpen, onClose, isUserAdmin }) => {
    const [formData, setFormData] = useState({
        firstName: userProfileData.firstName || '',
        lastName: userProfileData.lastName || '',
        email: userProfileData.email || '',
        contactPhoneNumber: userProfileData.contactPhoneNumber || '',
    });
    const [password, setPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prevData => ({ ...prevData, [name]: value }));
    };

    const handlePasswordChange = (e) => {
        setPassword(e.target.value);
        setPasswordError(''); // Clear error on change
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setPasswordError('');
        setSuccessMessage('');

        const db = window.db;
        const auth = window.auth;
        const currentUser = auth.currentUser;

        if (!db || !currentUser) {
            console.error("Firestore nie je inicializovaný alebo používateľ nie je prihlásený.");
            setLoading(false);
            return;
        }

        try {
            const credential = EmailAuthProvider.credential(currentUser.email, password);
            await reauthenticateWithCredential(currentUser, credential);
            
            const userId = currentUser.uid;
            const userDocRef = doc(db, 'users', userId);
            
            if (formData.email !== currentUser.email) {
                await updateEmail(currentUser, formData.email);
                await sendEmailVerification(currentUser, { url: window.location.href });
                setSuccessMessage('Bol Vám zaslaný verifikačný e-mail na novú adresu. Pre dokončenie zmeny kliknite na odkaz v e-maile.');
            }

            await setDoc(userDocRef, {
                firstName: formData.firstName,
                lastName: formData.lastName,
                email: formData.email,
                contactPhoneNumber: formData.contactPhoneNumber,
            }, { merge: true });

            console.log("Kontaktné údaje a/alebo e-mail boli úspešne uložené!");

            setTimeout(onClose, 3000);

        } catch (error) {
            console.error("Chyba pri overovaní hesla alebo ukladaní údajov: ", error);
            if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                setPasswordError('Nesprávne heslo. Prosím, skúste to znova.');
            } else if (error.code === 'auth/email-already-in-use') {
                setPasswordError('E-mailová adresa je už používaná iným používateľom.');
            } else {
                setPasswordError('Nastala chyba pri overovaní hesla. Skúste to neskôr.');
            }
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const isFormValid = formData.firstName && formData.lastName && formData.email && password;
    
    const buttonClasses = `
        font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline
        ${isFormValid ? 
            'bg-blue-500 hover:bg-blue-700 text-white' : 
            'bg-white text-blue-500 border border-blue-500 cursor-not-allowed'}
    `;

    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center' },
        React.createElement(
            'div',
            { className: 'bg-white p-8 rounded-lg shadow-xl m-4 max-w-md w-full' },
            React.createElement(
                'div',
                { className: 'flex justify-end' },
                React.createElement(
                    'button',
                    { onClick: onClose, className: 'text-gray-400 hover:text-gray-600' },
                    React.createElement(
                        'svg',
                        { className: 'h-6 w-6', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M6 18L18 6M6 6l12 12' })
                    )
                )
            ),
            React.createElement(
                'form',
                { onSubmit: handleSubmit },
                React.createElement(
                    'h3',
                    { className: 'text-2xl font-bold mb-4 text-gray-800' },
                    'Upraviť kontaktné údaje'
                ),
                successMessage && React.createElement(
                    'div',
                    { className: 'bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-4' },
                    React.createElement('p', null, successMessage)
                ),
                React.createElement(
                    'div',
                    { className: 'mb-4' },
                    React.createElement(
                        'label',
                        { htmlFor: 'firstName', className: 'block text-gray-700 text-sm font-bold mb-2' },
                        'Meno'
                    ),
                    React.createElement('input', {
                        type: 'text',
                        id: 'firstName',
                        name: 'firstName',
                        value: formData.firstName,
                        onChange: handleChange,
                        className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
                        disabled: loading,
                    })
                ),
                React.createElement(
                    'div',
                    { className: 'mb-4' },
                    React.createElement(
                        'label',
                        { htmlFor: 'lastName', className: 'block text-gray-700 text-sm font-bold mb-2' },
                        'Priezvisko'
                    ),
                    React.createElement('input', {
                        type: 'text',
                        id: 'lastName',
                        name: 'lastName',
                        value: formData.lastName,
                        onChange: handleChange,
                        className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
                        disabled: loading,
                    })
                ),
                React.createElement(
                    'div',
                    { className: 'mb-4' },
                    React.createElement(
                        'label',
                        { htmlFor: 'email', className: 'block text-gray-700 text-sm font-bold mb-2' },
                        'E-mailová adresa'
                    ),
                    React.createElement('input', {
                        type: 'email',
                        id: 'email',
                        name: 'email',
                        value: formData.email,
                        onChange: handleChange,
                        className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
                        disabled: loading,
                    })
                ),
                !isUserAdmin && React.createElement(
                    'div',
                    { className: 'mb-6' },
                    React.createElement(
                        'label',
                        { htmlFor: 'contactPhoneNumber', className: 'block text-gray-700 text-sm font-bold mb-2' },
                        'Telefónne číslo'
                    ),
                    React.createElement('input', {
                        type: 'text',
                        id: 'contactPhoneNumber',
                        name: 'contactPhoneNumber',
                        value: formData.contactPhoneNumber,
                        onChange: handleChange,
                        className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
                        disabled: loading,
                    })
                ),
                React.createElement(
                    'div',
                    { className: 'mb-6' },
                    React.createElement(
                        'label',
                        { htmlFor: 'current-password', className: 'block text-gray-700 text-sm font-bold mb-2' },
                        'Aktuálne heslo'
                    ),
                    React.createElement('input', {
                        type: 'password',
                        id: 'current-password',
                        name: 'current-password',
                        value: password,
                        onChange: handlePasswordChange,
                        className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
                        disabled: loading,
                        required: true,
                    }),
                    passwordError && React.createElement(
                        'p',
                        { className: 'text-red-500 text-xs italic mt-1' },
                        passwordError
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'flex items-center justify-between' },
                    React.createElement(
                        'button',
                        {
                            type: 'submit',
                            className: buttonClasses,
                            disabled: loading || !isFormValid,
                        },
                        loading ? 'Ukladám...' : 'Uložiť zmeny'
                    ),
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: onClose,
                            className: 'inline-block align-baseline font-bold text-sm text-blue-500 hover:text-blue-800',
                            disabled: loading
                        },
                        'Zrušiť'
                    )
                )
            )
        )
    );
};

/**
 * Komponent pre zobrazenie informácií o prihlásenom používateľovi.
 */
const MyDataApp = () => {
    const [userProfileData, setUserProfileData] = useState(window.globalUserProfileData);
    const [isLoading, setIsLoading] = useState(!window.globalUserProfileData);
    const [error, setError] = useState(null);
    const [isEditContactModalOpen, setIsEditContactModalOpen] = useState(false);
    const [isEditBillingModalOpen, setIsEditBillingModalOpen] = useState(false);
    
    useEffect(() => {
        // Počúva na globálnu udalosť, ktorá signalizuje, že dáta sú pripravené
        const handleGlobalDataUpdated = (event) => {
            if (event.detail) {
                setUserProfileData(event.detail);
                setIsLoading(false);
            } else {
                setError('Nie ste prihlásený. Prosím, prihláste sa, aby ste videli svoje údaje.');
                setIsLoading(false);
            }
        };

        window.addEventListener('globalDataUpdated', handleGlobalDataUpdated);

        // Ak už dáta existujú, nastavíme ich okamžite
        if (window.isGlobalAuthReady && window.globalUserProfileData) {
            setUserProfileData(window.globalUserProfileData);
            setIsLoading(false);
        } else if (window.isGlobalAuthReady && !window.globalUserProfileData) {
             setError('Nie ste prihlásený. Prosím, prihláste sa, aby ste videli svoje údaje.');
             setIsLoading(false);
        }

        return () => {
            window.removeEventListener('globalDataUpdated', handleGlobalDataUpdated);
        };
    }, []);
    
    if (isLoading) {
        return React.createElement(Loader);
    }

    if (error) {
        return React.createElement(ErrorMessage, { message: error });
    }

    if (!userProfileData) {
        return React.createElement(ErrorMessage, { message: 'Nie ste prihlásený. Prosím, prihláste sa, aby ste videli svoje údaje.' });
    }

    const isUserAdmin = userProfileData.role === 'admin';
    const headerColor = getRoleColor(userProfileData.role);

    // Komponent na zobrazenie fakturačných údajov
    const renderBillingAndAddressInfo = (data, color) => {
        const hasBillingInfo = data.billing && Object.keys(data.billing).length > 0;
        
        const postalCode = data.postalCode || '';
        const formattedPostalCode = postalCode.length === 5 ? `${postalCode.substring(0, 3)} ${postalCode.substring(3)}` : postalCode;

        return React.createElement(
            'div',
            { className: 'bg-white rounded-lg shadow-xl overflow-hidden mb-8' },
            React.createElement(
                'div',
                { className: 'p-4 text-white font-bold text-xl flex justify-between items-center', style: { backgroundColor: color } },
                React.createElement(
                    'h3',
                    null,
                    'Fakturačné údaje'
                ),
                React.createElement(
                    'button',
                    { onClick: () => setIsEditBillingModalOpen(true), className: 'text-white hover:text-gray-200 transition-colors duration-200' },
                    React.createElement(
                        'svg',
                        { className: 'h-6 w-6', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L15.232 5.232z' })
                        )
                )
            ),
            React.createElement(
                'div',
                { className: 'p-6' },
                hasBillingInfo ? 
                React.createElement(
                    React.Fragment,
                    null,
                    React.createElement(
                        'p',
                        { className: 'text-gray-800 text-lg' },
                        React.createElement('span', { className: 'font-bold' }, 'Oficiálny názov klubu:'),
                        ` ${data.billing.clubName}`
                    ),
                    React.createElement(
                        'p',
                        { className: 'text-gray-800 text-lg' },
                        React.createElement('span', { className: 'font-bold' }, 'Adresa:'),
                        ` ${data.street || ''} ${data.houseNumber || ''}, ${formattedPostalCode} ${data.city || ''}, ${data.country || ''}`.trim()
                    ),
                    React.createElement(
                        'p',
                        { className: 'text-gray-800 text-lg' },
                        React.createElement('span', { className: 'font-bold' }, 'IČO:'),
                        ` ${data.billing.ico}`
                    ),
                    React.createElement(
                        'p',
                        { className: 'text-gray-800 text-lg' },
                        React.createElement('span', { className: 'font-bold' }, 'DIČ:'),
                        ` ${data.billing.dic}`
                    ),
                    React.createElement(
                        'p',
                        { className: 'text-gray-800 text-lg' },
                        React.createElement('span', { className: 'font-bold' }, 'IČ DPH:'),
                        ` ${data.billing.icDph || '-'}`
                    )
                ) :
                React.createElement(
                    'p',
                    { className: 'text-gray-600' },
                    'Fakturačné údaje nie sú k dispozícii.'
                )
            )
        );
    };

    return React.createElement(
        'div',
        { className: 'container mx-auto p-4 md:p-8 lg:p-12 max-w-4xl' },
        React.createElement(
            'div',
            { className: 'space-y-8' },
            React.createElement(
                'div',
                { className: 'bg-white rounded-lg shadow-xl overflow-hidden' },
                React.createElement(
                    'div',
                    { className: 'p-4 text-white font-bold text-xl flex justify-between items-center', style: { backgroundColor: headerColor } },
                    React.createElement(
                        'h3',
                        null,
                        'Kontaktná osoba'
                    ),
                    React.createElement(
                        'button',
                        { onClick: () => setIsEditContactModalOpen(true), className: 'text-white hover:text-gray-200 transition-colors duration-200' },
                        React.createElement(
                            'svg',
                            { className: 'h-6 w-6', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                            React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L15.232 5.232z' })
                        )
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'p-6' },
                    React.createElement(
                        'p',
                        { className: 'text-gray-800 text-lg' },
                        React.createElement('span', { className: 'font-bold' }, 'Meno a priezvisko: '),
                        ` ${userProfileData.firstName || ''} ${userProfileData.lastName || ''}`.trim()
                    ),
                    React.createElement(
                        'p',
                        { className: 'text-gray-800 text-lg' },
                        React.createElement('span', { className: 'font-bold' }, 'E-mailová adresa:'),
                        ` ${userProfileData.email}`
                    ),
                    !isUserAdmin && React.createElement(
                        'p',
                        { className: 'text-gray-800 text-lg' },
                        React.createElement('span', { className: 'font-bold' }, 'Telefónne číslo:'),
                        ` ${formatPhoneNumber(userProfileData.contactPhoneNumber)}`
                    ),
                )
            ),
            renderBillingAndAddressInfo(userProfileData, headerColor)
        ),
        React.createElement(EditContactModal, {
            userProfileData: userProfileData,
            isOpen: isEditContactModalOpen,
            onClose: () => setIsEditContactModalOpen(false),
            isUserAdmin: isUserAdmin
        }),
        React.createElement(EditBillingModal, {
            userProfileData: userProfileData,
            isOpen: isEditBillingModalOpen,
            onClose: () => setIsEditBillingModalOpen(false)
        })
    );
};

// Explicitne sprístupniť komponent globálne
window.MyDataApp = MyDataApp;
