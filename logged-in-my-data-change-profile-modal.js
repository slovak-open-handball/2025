// Importy pre Firebase funkcie, aby sa dali použiť v modálnom okne
import { getAuth, EmailAuthProvider, reauthenticateWithCredential, verifyBeforeUpdateEmail, updatePassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getFirestore, updateDoc, collection, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Import zoznamu predvolieb
import { countryDialCodes } from "./countryDialCodes.js";

const { useState, useEffect, useRef } = React;

/**
 * Funkcia na zosvetlenie farby o dané percento.
 * @param {string} hex - Hex kód farby (napr. "#RRGGBB").
 * @param {number} percent - Percento zosvetlenia (napr. 80).
 * @returns {string} - Nový hex kód zosvetlenej farby.
 */
const lightenColor = (hex, percent) => {
    let r = parseInt(hex.slice(1, 3), 16),
        g = parseInt(hex.slice(3, 5), 16),
        b = parseInt(hex.slice(5, 7), 16);

    r = Math.min(255, r + (255 - r) * (percent / 100));
    g = Math.min(255, g + (255 - g) * (percent / 100));
    b = Math.min(255, b + (255 - b) * (percent / 100));

    return `#${(Math.round(r)).toString(16).padStart(2, '0')}${(Math.round(g)).toString(16).padStart(2, '0')}${(Math.round(b)).toString(16).padStart(2, '0')}`;
};

/**
 * Komponent PasswordInput pre polia hesla s prepínaním viditeľnosti.
 */
export const PasswordInput = ({ id, label, value, onChange, placeholder, showPassword, toggleShowPassword, disabled, roleColor }) => {
    // Použitie SVG ikon pre zobrazenie/skrytie hesla
    const EyeIcon = React.createElement(
        'svg',
        { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' }),
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' })
    );

    const EyeOffIcon = React.createElement(
        'svg',
        { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
        React.createElement('path', { fill: 'currentColor', stroke: 'none', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' }),
        React.createElement('path', { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' }),
        React.createElement('line', { x1: '21', y1: '3', x2: '3', y2: '21', stroke: 'currentColor', strokeWidth: '2' })
    );

    return React.createElement(
        'div',
        { className: 'mb-4' },
        React.createElement(
            'label',
            { htmlFor: id, className: 'block text-gray-700 text-sm font-bold mb-2' },
            label
        ),
        React.createElement(
            'div',
            { className: 'relative' },
            React.createElement('input', {
                type: showPassword ? 'text' : 'password',
                id: id,
                name: id,
                value: value,
                onChange: onChange,
                placeholder: placeholder,
                disabled: disabled,
                className: `focus:outline-none shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight`,
                // Pridanie štýlov pre orámovanie, aby sa zhodovalo s poľom pre telefónne číslo
                style: {
                    borderColor: roleColor,
                    boxShadow: 'none',
                    cursor: disabled ? 'not-allowed' : 'text'
                }
            }),
            React.createElement(
                'button',
                {
                    type: 'button',
                    onClick: toggleShowPassword,
                    className: 'absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5',
                    disabled: disabled,
                    style: {
                        color: roleColor,
                        // Zmena kurzora na 'not-allowed' pri disabled
                        cursor: disabled ? 'not-allowed' : 'pointer'
                    }
                },
                showPassword ? EyeOffIcon : EyeIcon
            )
        )
    );
};

/**
 * Komponent pre výber predvoľby krajiny.
 */
const DialCodeModal = ({ show, onClose, onSelect, selectedDialCode, roleColor }) => {
    const [filter, setFilter] = useState('');
    const modalRef = useRef(null);

    // Vytvorenie kópie a zoradenie podľa názvu krajiny predtým, než sa zoznam prefiltruje
    const sortedCodes = [...countryDialCodes].sort((a, b) => a.name.localeCompare(b.name, 'sk', { sensitivity: 'base' }));

    const filteredCodes = sortedCodes.filter(c =>
        (c.name && c.name.toLowerCase().includes(filter.toLowerCase())) ||
        (c.dialCode && c.dialCode.toLowerCase().includes(filter.toLowerCase()))
    );

    useEffect(() => {
        const handleOutsideClick = (event) => {
            if (modalRef.current && !modalRef.current.contains(event.target)) {
                onClose();
            }
        };

        if (show) {
            document.addEventListener('mousedown', handleOutsideClick);
        }

        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
        };
    }, [show, onClose]);

    if (!show) return null;

    // Vypočítame svetlejšiu farbu pre pozadie
    const lighterRoleColor = lightenColor(roleColor, 80);

    return ReactDOM.createPortal(
        React.createElement(
            'div',
            { className: 'fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-[10001] p-4' },
            React.createElement(
                'div',
                { className: 'bg-white rounded-xl shadow-xl w-full max-w-sm max-h-[80vh] overflow-y-auto flex flex-col', ref: modalRef },
                React.createElement(
                    'div',
                    { className: 'p-4 border-b border-gray-200 sticky top-0 bg-white z-10' },
                    React.createElement(
                        'div',
                        { className: 'flex justify-between items-center' },
                        React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, 'Vybrať predvoľbu'),
                        React.createElement(
                            'button',
                            {
                                onClick: onClose,
                                className: 'text-gray-500 hover:text-gray-700'
                            },
                            React.createElement('svg', { className: 'h-6 w-6', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                                React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M6 18L18 6M6 6l12 12' })
                            )
                        )
                    ),
                    // Upravený riadok pre odstránenie orámovania pri fokuse
                    React.createElement('input', {
                        type: 'text',
                        placeholder: 'Hľadať krajinu alebo kód...',
                        value: filter,
                        onChange: (e) => setFilter(e.target.value),
                        className: 'mt-3 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-transparent',
                        style: {
                            borderColor: roleColor,
                            boxShadow: 'none'
                        }
                    })
                ),
                React.createElement(
                    'div',
                    { className: 'p-4 overflow-y-auto h-full' },
                    React.createElement(
                        'ul',
                        { className: 'divide-y divide-gray-200' },
                        filteredCodes.length > 0 ? (
                            filteredCodes.map((country, index) =>
                                React.createElement(
                                    'li',
                                    {
                                        key: index,
                                        onClick: () => {
                                            onSelect(country.dialCode);
                                            onClose();
                                        },
                                        // Dynamické štýly pre vybranú položku
                                        className: `flex items-center justify-between p-2 cursor-pointer hover:bg-gray-100 rounded-lg transition-colors`,
                                        style: selectedDialCode === country.dialCode ? { backgroundColor: lighterRoleColor, fontWeight: '600' } : {}
                                    },
                                    React.createElement(
                                        'span',
                                        { className: 'text-gray-700' },
                                        `${country.name} (${country.dialCode})`
                                    ),
                                    selectedDialCode === country.dialCode &&
                                    React.createElement('svg', { className: 'h-5 w-5', fill: 'currentColor', viewBox: '0 0 20 20', style: { color: roleColor } },
                                        React.createElement('path', { fillRule: 'evenodd', d: 'M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z', clipRule: 'evenodd' })
                                    )
                                )
                            )
                        ) : (
                            React.createElement('li', { className: 'p-2 text-gray-500' }, 'Nenašli sa žiadne výsledky.')
                        )
                    )
                )
            )
        ),
        document.body
    );
};


/**
 * Hlavný komponent modálneho okna pre zmenu profilu.
 */
export const ChangeProfileModal = ({ show, onClose, userProfileData, roleColor }) => {
    // Definícia stavov pre polia formulára
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [phoneNumber, setPhoneNumber] = useState(''); // Toto bude uchovávať iba číslo bez predvoľby
    const [newPassword, setNewPassword] = useState('');
    const [retypePassword, setRetypePassword] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');

    const [showPassword, setShowPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showRetypePassword, setShowRetypePassword] = useState(false);

    const [loading, setLoading] = useState(false);
    const [showDialCodeModal, setShowDialCodeModal] = useState(false);
    const [selectedDialCode, setSelectedDialCode] = useState('');

    // Stav pre validáciu hesla
    const [validationStatus, setValidationStatus] = useState({
        minLength: false,
        hasUpperCase: false,
        hasLowerCase: false,
        hasNumber: false
    });

    // Nový stav pre validáciu e-mailu v reálnom čase
    const [isEmailValid, setIsEmailValid] = useState(true);
    // Ref pre sledovanie, či ide o počiatočné načítanie formulára
    const isInitialLoad = useRef(true);

    const auth = getAuth();
    const user = auth.currentUser;

    const originalData = useRef({
        firstName: userProfileData.firstName || '',
        lastName: userProfileData.lastName || '',
        email: userProfileData.email || '',
        contactPhoneNumber: userProfileData.contactPhoneNumber || '',
    });

    /**
     * Funkcia na validáciu e-mailovej adresy
     * @param {string} email - E-mailová adresa na validáciu.
     * @returns {boolean} - true ak je formát platný alebo reťazec je prázdny, inak false.
     */
    const validateEmail = (email) => {
        // Kontrola, či je pole prázdne, ak áno, považujeme ho za platné
        if (email === '') {
            return true;
        }
        // Regulárny výraz na kontrolu:
        // 1. Aspoň jeden znak pred @
        // 2. @
        // 3. Aspoň jeden znak po @
        // 4. .
        // 5. Aspoň dva znaky po .
        const emailRegex = /^.+@.+\..{2,}$/;
        return emailRegex.test(email);
    };

    /**
     * Funkcia na validáciu hesla
     * @param {string} password - Heslo na validáciu.
     * @returns {object} - Objekt s pravidlami validácie.
     */
    const validatePassword = (password) => {
        const minLength = password.length >= 10;
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumber = /[0-9]/.test(password);

        return { minLength, hasUpperCase, hasLowerCase, hasNumber };
    }

    // Funkcia na extrahovanie predvoľby a čísla z reťazca
    const extractDialCodeAndNumber = (contactNumber) => {
        // Zoradíme predvoľby od najdlhšej po najkratšiu
        const sortedDialCodes = [...countryDialCodes].sort((a, b) => b.dialCode.length - a.dialCode.length);
        let foundDialCode = '';
        let numberWithoutDialCode = contactNumber || '';

        // Skúsime nájsť predvoľbu v čísle
        for (const country of sortedDialCodes) {
            if (contactNumber && contactNumber.startsWith(country.dialCode)) {
                foundDialCode = country.dialCode;
                numberWithoutDialCode = contactNumber.substring(country.dialCode.length);
                break;
            }
        }

        // Ak sa nenašla žiadna predvoľba, použijeme defaultnú pre Slovensko
        if (!foundDialCode) {
            foundDialCode = countryDialCodes.find(c => c.code === 'SK')?.dialCode || countryDialCodes[0].dialCode;
        }

        return { foundDialCode, numberWithoutDialCode };
    };

    /**
     * Formátuje telefónne číslo s medzerami po troch čísliciach.
     * @param {string} value - Vstupný reťazec čísla.
     * @returns {string} - Formátovaný reťazec čísla.
     */
    const formatPhoneNumberForInput = (value) => {
        if (!value) return '';
        const cleaned = value.replace(/\s/g, ''); // Odstráni všetky medzery
        return cleaned.match(/.{1,3}/g)?.join(' ') || '';
    };

    // useEffect pre inicializáciu stavov pri zobrazení modálneho okna
    useEffect(() => {
        if (show && userProfileData) {
            // Inicializujeme stavy na prázdne reťazce, aby sa hodnoty zobrazili ako placeholder
            setFirstName('');
            setLastName('');
            setEmail('');
            setPhoneNumber('');

            const { foundDialCode, numberWithoutDialCode } = extractDialCodeAndNumber(userProfileData.contactPhoneNumber);
            setSelectedDialCode(foundDialCode);

            setNewPassword('');
            setRetypePassword('');
            setCurrentPassword('');

            // Reset validácie hesla
            setValidationStatus({
                minLength: false,
                hasUpperCase: false,
                hasLowerCase: false,
                hasNumber: false
            });

            setIsEmailValid(true);

            // Nastavíme originálne dáta, ktoré použijeme pre placeholder text
            originalData.current = {
                firstName: userProfileData.firstName || '',
                lastName: userProfileData.lastName || '',
                email: userProfileData.email || '',
                contactPhoneNumber: userProfileData.contactPhoneNumber || '',
                phoneNumberWithoutDialCode: numberWithoutDialCode
            };

             isInitialLoad.current = true;
        }
    }, [show, userProfileData]);

    // useEffect pre validáciu nového hesla
    useEffect(() => {
        const status = validatePassword(newPassword);
        setValidationStatus(status);
    }, [newPassword]);


    // Kontrola, či sa zmenil aspoň jeden údaj vo formulári
    const isFormChanged = () => {
        if (isInitialLoad.current) {
            return false;
        }

        const currentFirstName = firstName === '' ? originalData.current.firstName : firstName;
        const currentLastName = lastName === '' ? originalData.current.lastName : lastName;
        const currentPhoneNumber = phoneNumber === '' ? originalData.current.phoneNumberWithoutDialCode : phoneNumber.replace(/\s/g, '');
        const fullPhoneNumber = selectedDialCode + currentPhoneNumber;
        const currentEmail = email === '' ? originalData.current.email : email;

        // Funkcia na normalizáciu hodnôt pre bezpečné porovnanie,
        // ošetruje undefined/null a biele znaky.
        const getNormalizedValue = (value) => {
            return String(value || '').replace(/\s/g, '');
        };

        // Porovnávame aktuálny stav s pôvodnými dátami, ktoré sú v placeholderoch
        return (
            getNormalizedValue(currentFirstName) !== getNormalizedValue(originalData.current.firstName) ||
            getNormalizedValue(currentLastName) !== getNormalizedValue(originalData.current.lastName) ||
            getNormalizedValue(fullPhoneNumber) !== getNormalizedValue(originalData.current.contactPhoneNumber) ||
            getNormalizedValue(currentEmail) !== getNormalizedValue(originalData.current.email) ||
            newPassword !== '' ||
            retypePassword !== ''
        );
    };

     // Nový handler, ktorý zruší počiatočný stav načítania
    const handleValueChange = (setter, value) => {
        isInitialLoad.current = false;
        setter(value);
    };

    // Handler pre zmenu predvoľby, ktorý zaznamená zmenu formulára
    const handleDialCodeChange = (dialCode) => {
        isInitialLoad.current = false;
        setSelectedDialCode(dialCode);
    };

    // Kontrola, či sa mení e-mail
    const isEmailChanged = () => {
        return email !== '';
    };

    // Kontrola, či sa mení heslo
    const isPasswordChanged = () => {
        return newPassword !== '';
    };

    // Kontrola, či je tlačidlo Uložiť povolené
    const isSaveButtonEnabled = () => {
        const emailChange = isEmailChanged();
        const passwordChange = isPasswordChanged();

        // Ak sa mení e-mail, musí byť zadané aktuálne heslo s minimálne 10 znakmi
        if (emailChange) {
            return isFormChanged() && isEmailValid && validatePassword(currentPassword).minLength;
        }

        // Ak sa mení iba heslo, nové heslá sa musia zhodovať, byť validné a musí byť zadané aktuálne heslo
        if (passwordChange) {
            const newPasswordStatus = validatePassword(newPassword);
            return isFormChanged() &&
                   newPasswordStatus.minLength &&
                   newPasswordStatus.hasUpperCase &&
                   newPasswordStatus.hasLowerCase &&
                   newPasswordStatus.hasNumber &&
                   newPassword === retypePassword &&
                   validatePassword(currentPassword).minLength;
        }

        // Ak sa menia iba ostatné údaje, stačí, že sa niečo zmenilo a e-mail je platný
        return isFormChanged() && isEmailValid;
    };

    // Handler pre zmenu hesla
    const handlePasswordChange = async () => {
        const newPasswordStatus = validatePassword(newPassword);
        if (!newPasswordStatus.minLength || !newPasswordStatus.hasUpperCase || !newPasswordStatus.hasLowerCase || !newPasswordStatus.hasNumber || newPassword !== retypePassword) {
            window.showGlobalNotification('Nové heslá sa nezhodujú alebo nespĺňajú požiadavky na komplexnosť.', 'error');
            return false;
        }

        try {
            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            await reauthenticateWithCredential(user, credential);
            await updatePassword(user, newPassword);
            window.showGlobalNotification('Heslo bolo úspešne zmenené.', 'success');
            return true;
        } catch (error) {
            console.error("Chyba pri zmene hesla:", error);
            if (error.code === 'auth/wrong-password') {
                window.showGlobalNotification('Zadané aktuálne heslo je nesprávne.', 'error');
            } else if (error.code === 'auth/requires-recent-login') {
                window.showGlobalNotification('Pre zmenu hesla sa musíte znova prihlásiť. Odhláste sa a prihláste znova.', 'error');
            } else {
                window.showGlobalNotification('Nepodarilo sa zmeniť heslo. Skúste to prosím znova.', 'error');
            }
            return false;
        }
    };

    // Handler pre zmenu e-mailu
    const handleEmailChange = async () => {
        try {
            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            await reauthenticateWithCredential(user, credential);
            await verifyBeforeUpdateEmail(user, email);
            window.showGlobalNotification('Na zmenenú e-mailovú adresu bol odoslaný potvrdzovací e-mail. Pre dokončenie zmeny kliknite na odkaz v e-maili.', 'success');
            return true;
        } catch (error) {
            console.error("Chyba pri zmene e-mailu:", error);
            if (error.code === 'auth/wrong-password') {
                 window.showGlobalNotification('Zadané aktuálne heslo je nesprávne.', 'error');
            } else if (error.code === 'auth/email-already-in-use') {
                 window.showGlobalNotification('Táto e-mailová adresa je už používaná iným účtom.', 'error');
            } else {
                 window.showGlobalNotification('Nepodarilo sa zmeniť e-mail. Skúste to prosím znova.', 'error');
            }
            return false;
        }
    };

    // Handler pre uloženie zmien
    const handleSaveChanges = async () => {
        setLoading(true);

        const emailChanged = isEmailChanged();
        const passwordChanged = isPasswordChanged();

        if (!isFormChanged()) {
            window.showGlobalNotification('Nič sa nezmenilo.', 'error');
            setLoading(false);
            onClose();
            return;
        }

        let profileUpdateSuccess = true;

        const updatedData = {};
        const changes = []; // Premenované pole pre formátované notifikácie

        // Kontrola zmien a príprava dát
        if (firstName !== '' && firstName !== originalData.current.firstName) {
            updatedData.firstName = firstName;
            changes.push(`Zmena mena: z '${originalData.current.firstName}' na '${firstName}'`);
        }
        if (lastName !== '' && lastName !== originalData.current.lastName) {
            updatedData.lastName = lastName;
            changes.push(`Zmena priezviska: z '${originalData.current.lastName}' na '${lastName}'`);
        }

        // Logika pre telefónne číslo platí len pre ne-adminov
        if (userProfileData.role !== 'admin') {
            const currentPhoneNumberWithoutDialCode = phoneNumber === '' ? originalData.current.phoneNumberWithoutDialCode : phoneNumber.replace(/\s/g, '');
            const fullPhoneNumber = selectedDialCode + currentPhoneNumberWithoutDialCode;
            if (fullPhoneNumber !== originalData.current.contactPhoneNumber) {
                updatedData.contactPhoneNumber = fullPhoneNumber;
                changes.push(`Zmena telefónneho čísla: z '${originalData.current.contactPhoneNumber}' na '${fullPhoneNumber}'`);
            }
        }

        if (Object.keys(updatedData).length > 0) {
            try {
                const db = getFirestore();
                const userDocRef = doc(db, 'users', user.uid);
                await updateDoc(userDocRef, updatedData);

                // Vytvorenie notifikácie pre správcu, ak došlo k zmenám
                if (changes.length > 0) {
                    await addDoc(collection(db, 'notifications'), {
                        userEmail: userProfileData.email, // Používame userEmail namiesto userId a userName
                        changes: changes, // Pole správ
                        timestamp: new Date(), // Používame timestamp namiesto createdAt
                    });
                }

                window.showGlobalNotification('Profilové údaje boli úspešne aktualizované.', 'success');
            } catch (error) {
                console.error("Chyba pri aktualizácii profilu:", error);
                window.showGlobalNotification('Chyba pri aktualizácii profilových údajov.', 'error');
                profileUpdateSuccess = false;
            }
        }

        // Zmena hesla
        let passwordUpdateSuccess = true;
        if (passwordChanged) {
            passwordUpdateSuccess = await handlePasswordChange();
        }

        // Zmena e-mailu
        let emailUpdateSuccess = true;
        if (emailChanged) {
            emailUpdateSuccess = await handleEmailChange();
        }

        setLoading(false);
        if (profileUpdateSuccess && passwordUpdateSuccess && emailUpdateSuccess) {
            onClose();
        }
    };

    // Handler na zatvorenie modalu s kontrolou zmien
    const handleCloseWithCheck = () => {
        if (isFormChanged()) {
            onClose(); // Zatvorenie modalu
            // Zobrazíme notifikáciu s krátkym oneskorením, aby sa modal stihol zavrieť
            setTimeout(() => {
                window.showGlobalNotification('Údaje neboli aktualizované!', 'error');
            }, 50);
        } else {
            // Ak sa žiadne zmeny neuskutočnili, modal sa zatvorí bez upozornenia
            onClose();
        }
    };

    const ModalHeader = React.createElement(
        'div',
        { className: 'flex justify-between items-center px-6 py-4 border-b rounded-t-xl sticky top-0 z-10', style: { backgroundColor: roleColor } },
        React.createElement('h3', { className: 'text-2xl font-bold text-white' }, 'Upraviť údaje'),
        React.createElement(
            'button',
            {
                onClick: handleCloseWithCheck, // Používame upravený handler
                className: 'text-white hover:text-gray-200'
            },
            React.createElement('svg', { className: 'h-6 w-6', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M6 18L18 6M6 6l12 12' })
            )
        )
    );

    // určíme dynamické štýly pre tlačidlo
    const isButtonEnabled = isSaveButtonEnabled();
    const buttonStyle = {
        backgroundColor: isButtonEnabled ? roleColor : 'white',
        color: isButtonEnabled ? 'white' : roleColor,
        border: isButtonEnabled ? 'none' : `2px solid ${roleColor}`,
        cursor: isButtonEnabled && !loading ? 'pointer' : 'not-allowed',
        boxShadow: isButtonEnabled ? '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' : 'none',
    };

    const ModalContent = React.createElement(
        'div',
        { className: 'p-6 h-full overflow-y-auto' }, // Pridaná trieda 'h-full' a 'overflow-y-auto'
        // Zobrazenie chybovej správy, ak je e-mail neplatný
        !isEmailValid && React.createElement(
            'div',
            { className: 'bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-lg', role: 'alert' },
            React.createElement('p', { className: 'font-bold' }, 'Chybný formát e-mailu!'),
            React.createElement('p', null, 'Prosím, zadajte platnú e-mailovú adresu.')
        ),
        // Formulár
        React.createElement(
            'form',
            {
                onSubmit: (e) => {
                    e.preventDefault();
                    handleSaveChanges();
                }
            },
            // Meno
            React.createElement(
                'div',
                { className: 'mb-4' },
                React.createElement(
                    'label',
                    { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'firstName' },
                    'Meno'
                ),
                React.createElement('input', {
                    type: 'text',
                    id: 'firstName',
                    value: firstName,
                    onChange: (e) => handleValueChange(setFirstName, e.target.value),
                    placeholder: originalData.current.firstName, // Hodnota ako placeholder
                    className: 'focus:outline-none shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight',
                    style: {
                        borderColor: roleColor,
                        boxShadow: 'none'
                    }
                })
            ),
            // Priezvisko
            React.createElement(
                'div',
                { className: 'mb-4' },
                React.createElement(
                    'label',
                    { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'lastName' },
                    'Priezvisko'
                ),
                React.createElement('input', {
                    type: 'text',
                    id: 'lastName',
                    value: lastName,
                    onChange: (e) => handleValueChange(setLastName, e.target.value),
                    placeholder: originalData.current.lastName, // Hodnota ako placeholder
                    className: 'focus:outline-none shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight',
                    style: {
                        borderColor: roleColor,
                        boxShadow: 'none'
                    }
                })
            ),
            // Telefónne číslo
            userProfileData.role !== 'admin' && React.createElement(
                'div',
                { className: 'mb-4' },
                React.createElement(
                    'label',
                    { className: 'block text-gray-700 text-sm font-bold mb-2' },
                    'Telefónne číslo'
                ),
                React.createElement(
                    'div',
                    { className: 'flex' },
                    // Predvoľba krajiny
                    React.createElement(
                        'div',
                        {
                            className: `relative flex-shrink-0 shadow`,
                            style: { borderColor: roleColor, boxShadow: 'none' }
                        },
                        React.createElement(
                            'button',
                            {
                                type: 'button',
                                onClick: () => setShowDialCodeModal(true),
                                className: `p-2 flex items-center justify-between focus:outline-none text-gray-700 rounded-l-lg`,
                                style: {
                                    backgroundColor: 'white',
                                    border: '1px solid',
                                    borderColor: roleColor,
                                    borderRight: 'none',
                                    borderRadius: '0.5rem 0 0 0.5rem', // Použijeme Tailwind triedy
                                    width: '80px' // Zmenšená šírka tlačidla
                                }
                            },
                            React.createElement('span', { className: 'text-sm' }, selectedDialCode),
                            React.createElement('svg', { className: 'h-4 w-4 ml-1', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                                React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M19 9l-7 7-7-7' })
                            )
                        )
                    ),
                    // Zvyšok telefónneho čísla s novou logikou pre formátovanie
                    React.createElement(
                        'input',
                        {
                            type: 'text',
                            id: 'phoneNumber',
                            value: phoneNumber,
                            onChange: (e) => {
                                handleValueChange(setPhoneNumber, e.target.value);
                                // Odstránime všetky znaky, ktoré nie sú číslice
                                const cleanedValue = e.target.value.replace(/[^\d]/g, '');
                                // Formátujeme číslo pridaním medzier po troch čísliciach
                                const formattedValue = cleanedValue.match(/.{1,3}/g)?.join(' ') || '';
                                setPhoneNumber(formattedValue);
                            },
                            placeholder: formatPhoneNumberForInput(originalData.current.phoneNumberWithoutDialCode), // Hodnota ako placeholder
                            className: 'focus:outline-none shadow appearance-none border rounded-r-lg w-full py-2 px-3 text-gray-700 leading-tight',
                            style: {
                                borderColor: roleColor,
                                boxShadow: 'none',
                                borderLeft: 'none',
                                borderRadius: '0 0.5rem 0.5rem 0' // Použijeme Tailwind triedy
                            }
                        }
                    )
                )
            ),
            // E-mailová adresa
            React.createElement(
                'div',
                { className: 'mb-4' },
                React.createElement(
                    'label',
                    { className: `block text-sm font-bold mb-2 ${isEmailValid ? 'text-gray-700' : 'text-red-500'}`, htmlFor: 'email' },
                    'E-mailová adresa'
                ),
                React.createElement('input', {
                    type: 'email',
                    id: 'email',
                    value: email,
                    onChange: (e) => {
                        handleValueChange(setEmail, e.target.value);
                        setIsEmailValid(validateEmail(e.target.value));
                    },
                    placeholder: originalData.current.email, // Hodnota ako placeholder
                    className: `focus:outline-none shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight ${!isEmailValid ? 'border-red-500' : ''}`,
                    style: {
                        borderColor: roleColor,
                        boxShadow: 'none'
                    }
                })
            ),

            // Polia pre zmenu hesla (už nie sú podmienene)
            React.createElement('hr', { className: 'my-6' }),
            React.createElement(
                'div',
                { className: 'text-lg font-bold text-gray-800 mb-4' },
                'Zmeniť heslo'
            ),
            // Aktuálne heslo
            React.createElement(PasswordInput, {
                id: 'currentPassword',
                label: 'Aktuálne heslo',
                value: currentPassword,
                onChange: (e) => handleValueChange(setCurrentPassword, e.target.value),
                placeholder: 'Zadajte aktuálne heslo',
                showPassword: showPassword,
                toggleShowPassword: () => setShowPassword(!showPassword),
                disabled: loading,
                roleColor: roleColor
            }),
            // Nové heslo
            React.createElement(PasswordInput, {
                id: 'newPassword',
                label: 'Nové heslo',
                value: newPassword,
                onChange: (e) => handleValueChange(setNewPassword, e.target.value),
                placeholder: 'Zadajte nové heslo',
                showPassword: showNewPassword,
                toggleShowPassword: () => setShowNewPassword(!showNewPassword),
                disabled: loading,
                roleColor: roleColor
            }),
            // Podmienky pre heslo
             React.createElement(
                'div',
                { className: `text-xs italic mt-1 text-gray-600` },
                'Heslo musí obsahovať:',
                React.createElement(
                    'ul',
                    { className: 'list-none pl-4' },
                    React.createElement(
                        'li',
                        { className: `flex items-center ${validationStatus.minLength ? 'text-green-600' : 'text-gray-600'}` },
                        React.createElement('span', { className: 'mr-2' }, validationStatus.minLength ? '✔' : '•'),
                        'aspoň 10 znakov,'
                    ),
                    React.createElement(
                        'li',
                        { className: `flex items-center ${validationStatus.hasUpperCase ? 'text-green-600' : 'text-gray-600'}` },
                        React.createElement('span', { className: 'mr-2' }, validationStatus.hasUpperCase ? '✔' : '•'),
                        'aspoň jedno veľké písmeno,'
                    ),
                    React.createElement(
                        'li',
                        { className: `flex items-center ${validationStatus.hasLowerCase ? 'text-green-600' : 'text-gray-600'}` },
                        React.createElement('span', { className: 'mr-2' }, validationStatus.hasLowerCase ? '✔' : '•'),
                        'aspoň jedno malé písmeno,'
                    ),
                    React.createElement(
                        'li',
                        { className: `flex items-center ${validationStatus.hasNumber ? 'text-green-600' : 'text-gray-600'}` },
                        React.createElement('span', { className: 'mr-2' }, validationStatus.hasNumber ? '✔' : '•'),
                        'aspoň jednu číslicu.'
                    )
                )
            ),
            // Potvrdenie nového hesla
            React.createElement(PasswordInput, {
                id: 'retypePassword',
                label: 'Potvrdiť nové heslo',
                value: retypePassword,
                onChange: (e) => handleValueChange(setRetypePassword, e.target.value),
                placeholder: 'Zadajte znova nové heslo',
                showPassword: showRetypePassword,
                toggleShowPassword: () => setShowRetypePassword(!showRetypePassword),
                disabled: loading,
                roleColor: roleColor
            }),

            // Tlačidlo na uloženie zmien
            React.createElement(
                'div',
                { className: 'flex justify-end mt-6' },
                React.createElement(
                    'button',
                    {
                        type: 'submit',
                        className: `px-8 py-3 rounded-full font-bold text-lg transition-all duration-300 ${isButtonEnabled ? 'hover:scale-105' : ''} focus:outline-none`,
                        disabled: !isButtonEnabled || loading,
                        style: buttonStyle,
                    },
                    loading ? 'Ukladám...' : 'Uložiť zmeny'
                )
            )
        ),
        // Podmienene zobrazenie DialCodeModal pre iné roly ako 'admin'
        userProfileData.role !== 'admin' && React.createElement(DialCodeModal, {
            show: showDialCodeModal,
            onClose: () => setShowDialCodeModal(false),
            onSelect: (dialCode) => {
                handleDialCodeChange(dialCode); // Používame novú funkciu
            },
            selectedDialCode: selectedDialCode,
            roleColor: roleColor
        })
    );

    const modal = show ? React.createElement(
        'div',
        {
            className: 'fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-[10000] p-4',
            onClick: (e) => {
                if (e.target === e.currentTarget) {
                    handleCloseWithCheck();
                }
            }
        },
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-xl w-full max-w-lg mx-auto flex flex-col max-h-[90vh]' },
            ModalHeader,
            React.createElement('div', {className: 'flex-grow overflow-y-auto'},
                ModalContent
            )
        )
    ) : null;

    return ReactDOM.createPortal(modal, document.body);
};
