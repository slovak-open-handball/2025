// Importy pre Firebase funkcie, aby sa dali použiť v modálnom okne
import { getAuth, EmailAuthProvider, reauthenticateWithCredential, verifyBeforeUpdateEmail, updatePassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getFirestore, updateDoc, collection, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Import zoznamu predvolieb
import { countryDialCodes } from "./countryDialCodes.js";

const { useState, useEffect, useRef } = React;

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

    const filteredCodes = countryDialCodes.filter(c =>
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

    return ReactDOM.createPortal(
        React.createElement(
            'div',
            { className: 'fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-[10001] p-4' },
            React.createElement(
                'div',
                { className: 'bg-white rounded-xl shadow-xl w-full max-w-sm max-h-[80vh] overflow-y-auto', ref: modalRef },
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
                    React.createElement('input', {
                        type: 'text',
                        placeholder: 'Hľadať krajinu alebo kód...',
                        value: filter,
                        onChange: (e) => setFilter(e.target.value),
                        className: 'mt-3 w-full px-3 py-2 border rounded-lg',
                        style: {
                            borderColor: roleColor,
                            boxShadow: 'none',
                        }
                    })
                ),
                React.createElement(
                    'div',
                    { className: 'p-4' },
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
                                        className: `flex items-center justify-between p-2 cursor-pointer hover:bg-gray-100 rounded-lg transition-colors ${selectedDialCode === country.dialCode ? 'bg-blue-100 font-semibold' : ''}`
                                    },
                                    React.createElement(
                                        'span',
                                        { className: 'text-gray-700' },
                                        `${country.name} (${country.dialCode})`
                                    ),
                                    selectedDialCode === country.dialCode &&
                                    React.createElement('svg', { className: 'h-5 w-5 text-blue-500', fill: 'currentColor', viewBox: '0 0 20 20' },
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

    // Nový stav pre validáciu e-mailu v reálnom čase
    const [isEmailValid, setIsEmailValid] = useState(true);
    // Nový stav pre validáciu hesla pri zmene e-mailu
    const [isPasswordValid, setIsPasswordValid] = useState(false);

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
     * Funkcia na validáciu hesla (minimálne 10 znakov)
     * @param {string} password - Heslo na validáciu.
     * @returns {boolean} - true ak je heslo platné, inak false.
     */
    const validatePassword = (password) => {
        return password.length >= 10;
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
            setFirstName(userProfileData.firstName || '');
            setLastName(userProfileData.lastName || '');
            setEmail(userProfileData.email || '');

            const { foundDialCode, numberWithoutDialCode } = extractDialCodeAndNumber(userProfileData.contactPhoneNumber);
            setSelectedDialCode(foundDialCode);
            setPhoneNumber(formatPhoneNumberForInput(numberWithoutDialCode));

            setNewPassword('');
            setRetypePassword('');
            setCurrentPassword('');

            setIsEmailValid(true);
            setIsPasswordValid(false);

            // Nastavíme originálne dáta, ak sa zmenili
            originalData.current = {
                firstName: userProfileData.firstName || '',
                lastName: userProfileData.lastName || '',
                email: userProfileData.email || '',
                contactPhoneNumber: userProfileData.contactPhoneNumber || '',
            };
        }
    }, [show, userProfileData]);

    // Kontrola, či sa zmenil aspoň jeden údaj vo formulári
    const isFormChanged = () => {
        const currentPhoneNumber = phoneNumber.replace(/\s/g, '');
        const fullPhoneNumber = selectedDialCode + currentPhoneNumber;

        return (
            firstName !== originalData.current.firstName ||
            lastName !== originalData.current.lastName ||
            email !== originalData.current.email ||
            fullPhoneNumber !== originalData.current.contactPhoneNumber ||
            newPassword !== '' ||
            retypePassword !== '' ||
            currentPassword !== ''
        );
    };

    // Kontrola, či sa zmenilo heslo a je platné
    const isPasswordChangeValid = () => {
        return (newPassword !== '' && newPassword === retypePassword && validatePassword(newPassword));
    };

    // Kontrola, či je tlačidlo Uložiť povolené
    const isSaveButtonEnabled = () => {
        const isEmailChanged = email !== originalData.current.email;
        const isPasswordChanged = newPassword !== '';
        
        // Ak sa mení e-mail, heslo nesmie byť prázdne a musí byť validné
        if (isEmailChanged) {
             return isEmailValid && isPasswordValid && isFormChanged();
        }
        
        // Ak sa mení iba heslo, heslo musí byť platné a zadané dvakrát
        if (isPasswordChanged) {
            return isPasswordChangeValid() && currentPassword !== '' && isFormChanged();
        }
        
        // Ak sa menia iba iné údaje, stačí, že je formulár zmenený a e-mail validný
        return isFormChanged() && isEmailValid;
    };
    
    // Handler pre zmenu hesla
    const handlePasswordChange = async () => {
        if (!isPasswordChangeValid()) {
            window.showGlobalNotification('Nové heslá sa nezhodujú alebo nie sú dostatočne dlhé (min. 10 znakov).', 'error');
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

        const isEmailChanged = email !== originalData.current.email;
        const isPasswordChanged = newPassword !== '';

        if (!isFormChanged()) {
            window.showGlobalNotification('Nič sa nezmenilo.', 'error');
            setLoading(false);
            onClose();
            return;
        }

        // Zmeny profilu (meno, priezvisko, telefón)
        let profileUpdateSuccess = true;
        const updatedProfile = {
            ...userProfileData,
            firstName: firstName,
            lastName: lastName,
            contactPhoneNumber: selectedDialCode + phoneNumber.replace(/\s/g, '')
        };

        if (firstName !== originalData.current.firstName ||
            lastName !== originalData.current.lastName ||
            (selectedDialCode + phoneNumber.replace(/\s/g, '')) !== originalData.current.contactPhoneNumber) {

            try {
                const db = getFirestore();
                const userDocRef = doc(db, 'users', user.uid);
                await updateDoc(userDocRef, {
                    firstName: firstName,
                    lastName: lastName,
                    contactPhoneNumber: selectedDialCode + phoneNumber.replace(/\s/g, '')
                });
                window.showGlobalNotification('Profilové údaje boli úspešne aktualizované.', 'success');
            } catch (error) {
                console.error("Chyba pri aktualizácii profilu:", error);
                window.showGlobalNotification('Chyba pri aktualizácii profilových údajov.', 'error');
                profileUpdateSuccess = false;
            }
        }
        
        // Zmena hesla
        let passwordUpdateSuccess = true;
        if (isPasswordChanged) {
            passwordUpdateSuccess = await handlePasswordChange();
        }

        // Zmena e-mailu
        let emailUpdateSuccess = true;
        if (isEmailChanged) {
            emailUpdateSuccess = await handleEmailChange();
        }
        
        setLoading(false);
        if (profileUpdateSuccess && passwordUpdateSuccess && emailUpdateSuccess) {
            // Zavolanie onProfileUpdated z rodičovského komponentu pre aktualizáciu stavu
            // E-mail sa aktualizuje az po potvrdeni, takze ho zatial nemozeme zmenit v state
            onClose();
        }
    };
    
    const ModalHeader = React.createElement(
        'div',
        { className: 'flex justify-between items-center px-6 py-4 border-b rounded-t-xl', style: { backgroundColor: roleColor } },
        React.createElement('h3', { className: 'text-2xl font-bold text-white' }, 'Upraviť údaje'),
        React.createElement(
            'button',
            {
                onClick: onClose,
                className: 'text-white hover:text-gray-200'
            },
            React.createElement('svg', { className: 'h-6 w-6', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M6 18L18 6M6 6l12 12' })
            )
        )
    );

    const ModalContent = React.createElement(
        'div',
        { className: 'p-6' },
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
                    onChange: (e) => setFirstName(e.target.value),
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
                    onChange: (e) => setLastName(e.target.value),
                    className: 'focus:outline-none shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight',
                    style: {
                        borderColor: roleColor,
                        boxShadow: 'none'
                    }
                })
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
                        setEmail(e.target.value);
                        setIsEmailValid(validateEmail(e.target.value));
                        // Kontrolujeme, či sa e-mail zmenil, a podľa toho nastavíme isPasswordValid
                        if (e.target.value !== originalData.current.email) {
                            setIsPasswordValid(false);
                        } else {
                            // Ak sa e-mail vrátil na pôvodnú hodnotu, resetujeme validáciu hesla
                            setIsPasswordValid(true);
                        }
                    },
                    className: `focus:outline-none shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight ${!isEmailValid ? 'border-red-500' : ''}`,
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
                            className: `relative flex-shrink-0 mr-2 shadow rounded-lg`,
                            style: { borderColor: roleColor, boxShadow: 'none' }
                        },
                        React.createElement(
                            'button',
                            {
                                type: 'button',
                                onClick: () => setShowDialCodeModal(true),
                                className: `p-2 flex items-center justify-between focus:outline-none text-gray-700 rounded-lg`,
                                style: {
                                    backgroundColor: 'white',
                                    border: '1px solid',
                                    borderColor: roleColor,
                                    width: '100px'
                                }
                            },
                            React.createElement('span', { className: 'text-sm' }, selectedDialCode),
                            React.createElement('svg', { className: 'h-4 w-4 ml-1', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                                React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M19 9l-7 7-7-7' })
                            )
                        )
                    ),
                    // Zvyšok telefónneho čísla
                    React.createElement(
                        'input',
                        {
                            type: 'text',
                            id: 'phoneNumber',
                            value: phoneNumber,
                            onChange: (e) => setPhoneNumber(e.target.value),
                            className: 'focus:outline-none shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight',
                            style: {
                                borderColor: roleColor,
                                boxShadow: 'none'
                            }
                        }
                    )
                )
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
                onChange: (e) => setCurrentPassword(e.target.value),
                placeholder: 'Zadajte aktuálne heslo',
                showPassword: showPassword,
                toggleShowPassword: () => setShowPassword(!showPassword),
                disabled: loading,
                roleColor: roleColor
            }),
            // Nové heslo
            React.createElement(PasswordInput, {
                id: 'newPassword',
                label: 'Nové heslo (min. 10 znakov)',
                value: newPassword,
                onChange: (e) => setNewPassword(e.target.value),
                placeholder: 'Zadajte nové heslo',
                showPassword: showNewPassword,
                toggleShowPassword: () => setShowNewPassword(!showNewPassword),
                disabled: loading,
                roleColor: roleColor
            }),
            // Potvrdenie nového hesla
            React.createElement(PasswordInput, {
                id: 'retypePassword',
                label: 'Potvrdiť nové heslo',
                value: retypePassword,
                onChange: (e) => setRetypePassword(e.target.value),
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
                        className: `px-8 py-3 rounded-full font-bold text-lg shadow-lg transition-all duration-300 ${isSaveButtonEnabled() ? 'hover:scale-105' : ''} focus:outline-none`,
                        disabled: !isSaveButtonEnabled() || loading,
                        style: {
                            backgroundColor: roleColor,
                            color: (!isSaveButtonEnabled() || loading) ? '#9CA3AF' : 'white',
                            border: 'none',
                            cursor: (!isSaveButtonEnabled() || loading) ? 'not-allowed' : 'pointer',
                        }
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
                setSelectedDialCode(dialCode);
            },
            selectedDialCode: selectedDialCode,
            roleColor: roleColor
        })
    );

    const modal = show ? React.createElement(
        'div',
        {
            className: 'fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-[10000]',
            onClick: (e) => {
                if (e.target === e.currentTarget) {
                    onClose();
                }
            }
        },
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-xl w-full max-w-lg mx-auto overflow-hidden' },
            ModalHeader,
            ModalContent
        )
    ) : null;

    return ReactDOM.createPortal(modal, document.body);
};
