// Importy pre Firebase funkcie, aby sa dali použiť v modálnom okne
import { getAuth, EmailAuthProvider, reauthenticateWithCredential, verifyBeforeUpdateEmail, updatePassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getFirestore, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
                className: `shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight`,
                // Pridanie štýlov pre orámovanie, aby sa zhodovalo s poľom pre telefónne číslo
                style: {
                    borderColor: roleColor,
                    // Odstránenie čierneho rámika pri focus
                    boxShadow: 'none',
                    // Zmena farby rámika pri focus
                    outlineColor: roleColor,
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
                            // Odstránenie čierneho rámika pri focus
                            boxShadow: 'none',
                            // Zmena farby rámika pri focus
                            outlineColor: roleColor
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
     * @param {string} value - Telefónne číslo ako reťazec.
     * @returns {string} - Formátovaný reťazec.
     */
    const formatPhoneNumber = (value) => {
        // Odstráni všetky nečíselné znaky
        const cleanValue = value.replace(/\D/g, '');
        // Pridá medzery po každých troch čísliciach
        let formattedValue = '';
        for (let i = 0; i < cleanValue.length; i++) {
            if (i > 0 && i % 3 === 0) {
                formattedValue += ' ';
            }
            formattedValue += cleanValue[i];
        }
        return formattedValue;
    };

    /**
     * Spracováva zmeny v inpute telefónneho čísla, filtruje znaky a formátuje reťazec.
     * @param {object} event - Objekt udalosti z inputu.
     */
    const handlePhoneNumberChange = (event) => {
        const { value, selectionStart } = event.target;
        // Odstráni všetky nečíselné znaky z hodnoty, vrátane medzier
        const cleanValue = value.replace(/\s/g, '');

        // Zastaví sa, ak hodnota obsahuje nečíselné znaky, okrem backspace
        if (!/^\d*$/.test(cleanValue) && event.nativeEvent.inputType !== 'deleteContentBackward') {
            return;
        }

        const formattedValue = formatPhoneNumber(cleanValue);
        setPhoneNumber(formattedValue);

        // Logika pre korekciu pozície kurzora
        if (event.nativeEvent.inputType === 'deleteContentBackward') {
            // Vypočítame novú pozíciu kurzora po vymazaní
            let newSelectionStart = selectionStart;
            // Ak kurzor bol pred medzerou, presunieme ho o jedno dozadu
            if (formattedValue.charAt(selectionStart - 1) === ' ' && formattedValue.length > 0) {
                newSelectionStart--;
            }
            // Nastavíme kurzor
            setTimeout(() => event.target.setSelectionRange(newSelectionStart, newSelectionStart), 0);
        } else {
            // Upravíme pozíciu kurzora pri vkladaní textu
            let newSelectionStart = selectionStart;
            if ((selectionStart > 0 && selectionStart % 4 === 0) && formattedValue.charAt(selectionStart - 1) === ' ') {
                newSelectionStart++;
            }
            setTimeout(() => event.target.setSelectionRange(newSelectionStart, newSelectionStart), 0);
        }
    };

    // Nová funkcia pre e-mail input handler
    const handleEmailChange = (e) => {
        const newEmail = e.target.value;
        setEmail(newEmail);
        setIsEmailValid(validateEmail(newEmail));
    };


    useEffect(() => {
        // Obnovenie stavov pri zobrazení modálu na prázdne reťazce
        if (show) {
            setFirstName('');
            setLastName('');
            setEmail('');
            setPhoneNumber('');
            setNewPassword('');
            setRetypePassword('');
            setCurrentPassword('');
            setShowPassword(false);
            setShowNewPassword(false);
            setShowRetypePassword(false);
            setIsEmailValid(true); // Reset validácie

            originalData.current = {
                firstName: userProfileData.firstName || '',
                lastName: userProfileData.lastName || '',
                email: userProfileData.email || '',
                contactPhoneNumber: userProfileData.contactPhoneNumber || '',
            };

            // Inicializácia predvoľby a telefónneho čísla
            const { foundDialCode, numberWithoutDialCode } = extractDialCodeAndNumber(userProfileData.contactPhoneNumber);
            setSelectedDialCode(foundDialCode);
            // Telefónne číslo sa NEPRED-VYPLŇUJE, ale použije sa v placeholderi
            setPhoneNumber(''); 
        }
    }, [show, userProfileData]);

    // Kontrola, či sa zmenili nejaké dáta
    const isFormChanged = () => {
        const hasDataChanged = (
            (firstName !== '' && firstName !== originalData.current.firstName) ||
            (lastName !== '' && lastName !== originalData.current.lastName) ||
            (email !== '' && email !== originalData.current.email) ||
            (userProfileData.role !== 'admin' && phoneNumber !== '' && `${selectedDialCode}${phoneNumber.replace(/\s/g, '')}` !== originalData.current.contactPhoneNumber) ||
            (userProfileData.role !== 'admin' && selectedDialCode !== extractDialCodeAndNumber(originalData.current.contactPhoneNumber).foundDialCode && phoneNumber === '')
        );

        const hasPasswordChanged = newPassword !== '' || retypePassword !== '' || currentPassword !== '';

        return hasDataChanged || hasPasswordChanged;
    };


    // Funkcia na uloženie zmien
    const handleSave = async () => {
        if (!isFormChanged()) {
            window.showGlobalNotification('Žiadne zmeny na uloženie.', 'info');
            return;
        }

        // Kontrola platnosti e-mailu pred uložením
        if (email !== '' && !isEmailValid) {
            window.showGlobalNotification('Prosím, zadajte platný formát e-mailovej adresy.', 'error');
            return;
        }

        // Kontrola, či sa menia citlivé údaje
        const isEmailChanged = email !== '' && email !== originalData.current.email;
        const isPasswordChanged = newPassword !== '';

        if ((isEmailChanged || isPasswordChanged) && !currentPassword) {
             window.showGlobalNotification('Pre zmenu e-mailu alebo hesla je potrebné zadať aktuálne heslo.', 'error');
             return;
        }

        setLoading(true);
        const db = getFirestore();
        const userRef = doc(db, "users", user.uid);

        try {
            // Reautentifikácia len ak sa menia citlivé údaje
            if (isEmailChanged || isPasswordChanged) {
                const credential = EmailAuthProvider.credential(user.email, currentPassword);
                await reauthenticateWithCredential(user, credential);
            }

            // Aktualizácia e-mailu
            if (isEmailChanged) {
                await verifyBeforeUpdateEmail(user, email);
                window.showGlobalNotification('Potvrďte zmenu e-mailu kliknutím na odkaz vo svojej novej e-mailovej schránke.', 'info');
            }

            // Zmena hesla
            if (isPasswordChanged) {
                if (newPassword !== retypePassword) {
                    window.showGlobalNotification('Nové heslá sa nezhodujú.', 'error');
                    setLoading(false);
                    return;
                }
                await updatePassword(user, newPassword);
                window.showGlobalNotification('Heslo bolo úspešne zmenené.', 'success');
            }

            // Aktualizácia ostatných údajov
            const updatedData = {};

            if (firstName !== '') updatedData.firstName = firstName;
            if (lastName !== '') updatedData.lastName = lastName;

            // Logika pre aktualizáciu telefónneho čísla
            if (userProfileData.role !== 'admin' && (phoneNumber !== '' || selectedDialCode !== extractDialCodeAndNumber(originalData.current.contactPhoneNumber).foundDialCode)) {
                 // Ak bolo zadané nové číslo, použije sa, inak sa použije pôvodné
                const newPhoneNumberValue = phoneNumber !== '' ? `${selectedDialCode}${phoneNumber.replace(/\s/g, '')}` : originalData.current.contactPhoneNumber;
                 // Ak bola zmenená iba predvoľba a číslo nebolo zadané, použije sa pôvodné číslo s novou predvoľbou
                if (phoneNumber === '' && selectedDialCode !== extractDialCodeAndNumber(originalData.current.contactPhoneNumber).foundDialCode) {
                    updatedData.contactPhoneNumber = `${selectedDialCode}${extractDialCodeAndNumber(originalData.current.contactPhoneNumber).numberWithoutDialCode.trim()}`;
                } else if (phoneNumber !== '') {
                    updatedData.contactPhoneNumber = `${selectedDialCode}${phoneNumber.replace(/\s/g, '')}`;
                }
            }


            if (Object.keys(updatedData).length > 0) {
                 await updateDoc(userRef, updatedData);
            }

            // Úspešné uloženie, zatvoríme modálne okno a zobrazíme notifikáciu.
            window.showGlobalNotification('Profil bol úspešne aktualizovaný.', 'success');
            onClose();

        } catch (error) {
            console.error("Chyba pri ukladaní údajov:", error);
            // Zobrazíme notifikáciu s chybovou správou
            let errorMessage = "Nepodarilo sa uložiť zmeny. Skúste to prosím znova.";
            if (error.code === 'auth/wrong-password') {
                errorMessage = "Zadané heslo je nesprávne.";
            } else if (error.code === 'auth/email-already-in-use') {
                errorMessage = "Tento e-mail sa už používa.";
            } else {
                 errorMessage = `Chyba pri ukladaní údajov: ${error.message}`;
            }
            window.showGlobalNotification(errorMessage, 'error');

        } finally {
            setLoading(false);
        }
    };


    const ModalHeader = React.createElement(
        'div',
        { className: 'flex justify-between items-center p-6 border-b border-gray-200' },
        React.createElement(
            'h2',
            { className: 'text-2xl font-bold text-gray-800' },
            'Upraviť profil'
        ),
        React.createElement(
            'button',
            {
                onClick: onClose,
                className: 'text-gray-500 hover:text-gray-700'
            },
            React.createElement(
                'svg',
                { className: 'h-6 w-6', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M6 18L18 6M6 6l12 12' })
            )
        )
    );

    // Vytvorenie placeholderu pre telefónne číslo s formátovaním
    const { numberWithoutDialCode } = extractDialCodeAndNumber(userProfileData.contactPhoneNumber);
    const formattedPhoneNumberPlaceholder = formatPhoneNumber(numberWithoutDialCode);


    const ModalContent = React.createElement(
        'div',
        { className: 'p-6 max-h-[70vh] overflow-y-auto' },
        React.createElement(
            'div',
            { className: 'mb-4' },
            React.createElement('label', { htmlFor: 'firstName', className: 'block text-gray-700 text-sm font-bold mb-2' }, 'Meno'),
            React.createElement('input', {
                type: 'text',
                id: 'firstName',
                value: firstName,
                onChange: (e) => setFirstName(e.target.value),
                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight',
                placeholder: userProfileData.firstName || 'Zadajte meno',
                // Pridanie štýlov pre orámovanie, aby sa zhodovalo s poľom pre telefónne číslo
                style: {
                    borderColor: roleColor,
                    // Odstránenie čierneho rámika pri focus
                    boxShadow: 'none',
                    // Zmena farby rámika pri focus
                    outlineColor: roleColor
                }
            })
        ),
        React.createElement(
            'div',
            { className: 'mb-4' },
            React.createElement('label', { htmlFor: 'lastName', className: 'block text-gray-700 text-sm font-bold mb-2' }, 'Priezvisko'),
            React.createElement('input', {
                type: 'text',
                id: 'lastName',
                value: lastName,
                onChange: (e) => setLastName(e.target.value),
                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight',
                placeholder: userProfileData.lastName || 'Zadajte priezvisko',
                // Pridanie štýlov pre orámovanie, aby sa zhodovalo s poľom pre telefónne číslo
                style: {
                    borderColor: roleColor,
                    // Odstránenie čierneho rámika pri focus
                    boxShadow: 'none',
                    // Zmena farby rámika pri focus
                    outlineColor: roleColor
                }
            })
        ),
        // Podmienene zobrazenie telefónneho čísla pre iné roly ako 'admin'
        userProfileData.role !== 'admin' && React.createElement(
            'div',
            { className: 'mb-4' },
            React.createElement('label', { htmlFor: 'phoneNumber', className: 'block text-gray-700 text-sm font-bold mb-2' }, 'Telefónne číslo'),
            React.createElement(
                'div',
                { className: 'flex' },
                React.createElement(
                    'button',
                    {
                        type: 'button',
                        onClick: () => setShowDialCodeModal(true),
                        className: `flex-shrink-0 z-10 inline-flex items-center py-2.5 px-4 text-sm font-medium text-center bg-white border-t border-b border-l rounded-l-lg hover:bg-gray-200`,
                        style: {
                            color: roleColor,
                            borderColor: roleColor,
                            boxShadow: 'none',
                            outlineColor: roleColor,
                        }
                    },
                    selectedDialCode
                ),
                React.createElement('input', {
                    type: 'tel',
                    id: 'phoneNumber',
                    value: phoneNumber,
                    onChange: handlePhoneNumberChange, // Použijeme novú funkciu pre formátovanie
                    className: 'rounded-none rounded-r-lg bg-white border-t border-b border-r text-gray-900 block flex-1 min-w-0 w-full text-sm p-2.5',
                    placeholder: formattedPhoneNumberPlaceholder || 'Zadajte telefónne číslo',
                    style: {
                        borderColor: roleColor,
                        boxShadow: 'none',
                        outlineColor: roleColor
                    }
                })
            )
        ),
        React.createElement(
            'div',
            { className: 'mb-4' },
            React.createElement('label', { htmlFor: 'email', className: 'block text-gray-700 text-sm font-bold mb-2' }, 'E-mail'),
            React.createElement('input', {
                type: 'email',
                id: 'email',
                value: email,
                onChange: handleEmailChange, // Nový handler pre real-time validáciu
                className: `shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight ${email !== '' && !isEmailValid ? 'border-red-500' : ''}`,
                placeholder: userProfileData.email || 'Zadajte e-mail',
                // Pridanie štýlov pre orámovanie, aby sa zhodovalo s poľom pre telefónne číslo
                style: {
                    borderColor: (email !== '' && !isEmailValid) ? '#EF4444' : roleColor,
                    // Odstránenie čierneho rámika pri focus
                    boxShadow: 'none',
                    // Zmena farby rámika pri focus
                    outlineColor: roleColor
                }
            }),
            email !== '' && !isEmailValid && React.createElement(
                'p',
                { className: 'text-red-500 text-xs italic mt-1' },
                'Prosím, zadajte platný formát e-mailovej adresy.'
            )
        ),
        // Aktuálne heslo je teraz vždy zobrazené pod e-mailom
        React.createElement(PasswordInput, {
            id: 'currentPassword',
            label: 'Aktuálne heslo (pre potvrdenie zmien e-mailu alebo hesla)',
            value: currentPassword,
            onChange: (e) => setCurrentPassword(e.target.value),
            placeholder: 'Zadajte aktuálne heslo',
            showPassword: showPassword,
            toggleShowPassword: () => setShowPassword(!showPassword),
            roleColor: roleColor
        }),
        React.createElement(
            'div',
            { className: 'mt-6 pt-4 border-t border-gray-200' },
            React.createElement(PasswordInput, {
                id: 'newPassword',
                label: 'Nové heslo (voliteľné)',
                value: newPassword,
                onChange: (e) => setNewPassword(e.target.value),
                placeholder: 'Zadajte nové heslo',
                showPassword: showNewPassword,
                toggleShowPassword: () => setShowNewPassword(!showNewPassword),
                roleColor: roleColor
            }),
            React.createElement(PasswordInput, {
                id: 'retypePassword',
                label: 'Znovu zadajte nové heslo',
                value: retypePassword,
                onChange: (e) => setRetypePassword(e.target.value),
                placeholder: 'Zopakujte nové heslo',
                showPassword: showRetypePassword,
                toggleShowPassword: () => setShowRetypePassword(!showRetypePassword),
                disabled: !newPassword,
                roleColor: roleColor
            })
        ),
        React.createElement(
            'div',
            { className: 'flex justify-end mt-6' },
            React.createElement(
                'button',
                {
                    onClick: handleSave,
                    disabled: loading || !isFormChanged() || !isEmailValid, // Pridaná podmienka pre email validáciu
                    className: `font-bold py-2 px-4 rounded-lg`,
                    style: {
                        backgroundColor: (loading || !isFormChanged() || !isEmailValid) ? '#E5E7EB' : roleColor,
                        color: (loading || !isFormChanged() || !isEmailValid) ? '#9CA3AF' : 'white',
                        border: 'none',
                        cursor: (loading || !isFormChanged() || !isEmailValid) ? 'not-allowed' : 'pointer',
                    }
                },
                loading ? 'Ukladám...' : 'Uložiť zmeny'
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
    // Pridanie `onClick` handlera pre zatvorenie pri kliknutí mimo okna
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
