// Importy pre Firebase funkcie, aby sa dali použiť v modálnom okne
import { getAuth, EmailAuthProvider, reauthenticateWithCredential, verifyBeforeUpdateEmail, updatePassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
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
                    React.createElement('input', {
                        type: 'text',
                        placeholder: 'Hľadať krajinu alebo kód...',
                        value: filter,
                        onChange: (e) => setFilter(e.target.value),
                        className: 'mt-3 w-full px-3 py-2 border rounded-lg',
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
        // Kontrolujeme, či je pole pre e-mail neprázdne a či sa líši od pôvodnej hodnoty.
        // Pôvodnú hodnotu berieme buď z userProfileData alebo z originalData,
        // ak nebola explicitne zadaná.
        const originalEmail = originalData.current.email;
        const currentEmail = email.trim(); // Odstránime biele znaky pre porovnanie

        // Ak používateľ nevyplnil pole e-mailu, porovnávame ho s prázdnym reťazcom,
        // aby sme zistili, či nastala zmena
        if (currentEmail === '') {
            return false;
        }

        return currentEmail !== originalEmail;
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
            return isFormChanged() && isEmailValid && currentPassword.length >= 10;
        }

        // Ak sa mení iba heslo, nové heslá sa musia zhodovať, byť validné a musí byť zadané aktuálne heslo
        if (passwordChange) {
            const newPasswordStatus = validatePassword(newPassword);
            return isFormChanged() && newPasswordStatus.minLength && newPasswordStatus.hasUpperCase && newPasswordStatus.hasLowerCase && newPasswordStatus.hasNumber && newPassword === retypePassword && currentPassword.length >= 10;
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
        const db = getFirestore();
        if (!isEmailValid || !user || !currentPassword) {
            window.showGlobalNotification('Vyplňte, prosím, platný e-mail a vaše aktuálne heslo.', 'error');
            return false;
        }

        try {
            // Reautentifikácia používateľa, ak je to potrebné
            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            await reauthenticateWithCredential(user, credential);
            
            // Odoslanie verifikačného e-mailu na novú adresu
            await verifyBeforeUpdateEmail(user, email);
            
            window.showGlobalNotification('Na zmenenú e-mailovú adresu bol odoslaný potvrdzovací e-mail. Pre dokončenie zmeny kliknite na odkaz v e-maili.', 'success');
            
            // Automatické odhlásenie používateľa
            await signOut(auth);

            return true;
        } catch (error) {
            console.error("Chyba pri zmene e-mailu:", error);
            if (error.code === 'auth/wrong-password') {
                window.showGlobalNotification('Zadané aktuálne heslo je nesprávne.', 'error');
            } else if (error.code === 'auth/email-already-in-use') {
                window.showGlobalNotification('Táto e-mailová adresa sa už používa. Použite, prosím, inú adresu.', 'error');
            } else if (error.code === 'auth/requires-recent-login') {
                window.showGlobalNotification('Pre zmenu e-mailu sa musíte znova prihlásiť. Odhláste sa a prihláste znova.', 'error');
            } else {
                window.showGlobalNotification('Nepodarilo sa zmeniť e-mail. Skúste to prosím znova.', 'error');
            }
            return false;
        }
    };

    // Handler pre zmenu ostatných údajov (meno, priezvisko, telefón)
    const handleOtherDataChange = async () => {
        const db = getFirestore();
        const userDocRef = doc(db, 'users', user.uid);
        
        try {
            const changes = {};
            const notificationChanges = [];

            // Aktualizácia mena a priezviska
            if (firstName.trim() !== '' && firstName.trim() !== originalData.current.firstName) {
                changes.firstName = firstName.trim();
                notificationChanges.push(`Krstné meno zmenené na "${firstName.trim()}".`);
            }
            if (lastName.trim() !== '' && lastName.trim() !== originalData.current.lastName) {
                changes.lastName = lastName.trim();
                notificationChanges.push(`Priezvisko zmenené na "${lastName.trim()}".`);
            }
            
            // Aktualizácia telefónneho čísla
            const fullPhoneNumber = selectedDialCode + phoneNumber.replace(/\s/g, '');
            if (fullPhoneNumber !== originalData.current.contactPhoneNumber && (userProfileData.role !== 'admin' && userProfileData.role !== 'hall')) {
                changes.contactPhoneNumber = fullPhoneNumber;
                notificationChanges.push(`Telefónne číslo zmenené na "${fullPhoneNumber}".`);
            }

            if (Object.keys(changes).length > 0) {
                await updateDoc(userDocRef, changes);
                window.showGlobalNotification('Profilové údaje boli úspešne aktualizované.', 'success');
                
                // Vytvorenie notifikácie v databáze
                await addDoc(collection(db, 'notifications'), {
                    userId: user.uid,
                    changes: notificationChanges,
                    timestamp: new Date(),
                });
            }
            
            return true;
        } catch (error) {
            console.error("Chyba pri aktualizácii údajov:", error);
            window.showGlobalNotification('Nepodarilo sa aktualizovať údaje. Skúste to prosím znova.', 'error');
            return false;
        }
    };
    
    // Hlavný handler pre uloženie zmien
    const handleSaveChanges = async () => {
        setLoading(true);
        
        const changes = {
            profileChanged: isFormChanged(),
            emailChanged: isEmailChanged(),
            passwordChanged: isPasswordChanged()
        };

        if (!changes.profileChanged && !changes.emailChanged && !changes.passwordChanged) {
            window.showGlobalNotification('Nezmenili ste žiadne údaje.', 'error');
            setLoading(false);
            return;
        }

        let allChangesSuccessful = true;

        if (changes.passwordChanged) {
            const passwordSuccess = await handlePasswordChange();
            if (!passwordSuccess) {
                allChangesSuccessful = false;
            }
        }

        if (changes.emailChanged && allChangesSuccessful) {
            const emailSuccess = await handleEmailChange();
            if (!emailSuccess) {
                allChangesSuccessful = false;
            }
        }

        if (changes.profileChanged && allChangesSuccessful) {
            const otherDataSuccess = await handleOtherDataChange();
            if (!otherDataSuccess) {
                allChangesSuccessful = false;
            }
        }

        setLoading(false);
        if (allChangesSuccessful) {
            onClose();
        }
    };
    
    // Handler pre zatvorenie modálneho okna
    const handleCloseWithCheck = () => {
        if (isFormChanged()) {
            // Namiesto confirm() použijeme globálnu notifikáciu alebo vlastné modálne okno
            window.showGlobalNotification("Máte neuložené zmeny, ktoré budú stratené. Ak chcete pokračovať, kliknite na 'Zavrieť'.", "warning");
            // Po nejakom čase sa okno zavrie, ak sa nezmení názor
            setTimeout(() => {
                onClose();
            }, 3000);
        } else {
            onClose();
        }
    };

    // Nový handler, ktorý zruší...
    
    // Podmienka pre povolenie tlačidla Uložiť zmeny
    const isButtonEnabled = isSaveButtonEnabled();
    const buttonStyle = {
        backgroundColor: isButtonEnabled ? roleColor : '#d1d5db',
        color: 'white',
        cursor: isButtonEnabled ? 'pointer' : 'not-allowed',
        boxShadow: isButtonEnabled ? `0 4px 6px -1px ${roleColor}, 0 2px 4px -1px ${roleColor}` : 'none'
    };

    // Obsah modálneho okna s formulárom
    const ModalContent = React.createElement(
        'form',
        {
            className: 'p-6',
            onSubmit: (e) => {
                e.preventDefault();
                handleSaveChanges();
            }
        },
        // Osobné údaje
        React.createElement('div', { className: 'mb-6' },
            React.createElement('h3', { className: 'text-lg font-bold text-gray-800 mb-4' }, 'Osobné údaje'),
            React.createElement(
                'div',
                { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
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
                        value: firstName,
                        onChange: (e) => handleValueChange(setFirstName, e.target.value),
                        placeholder: userProfileData.firstName || 'Zadajte meno',
                        className: `shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none`,
                        style: {
                            borderColor: roleColor,
                            boxShadow: 'none'
                        }
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
                        value: lastName,
                        onChange: (e) => handleValueChange(setLastName, e.target.value),
                        placeholder: userProfileData.lastName || 'Zadajte priezvisko',
                        className: `shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none`,
                        style: {
                            borderColor: roleColor,
                            boxShadow: 'none'
                        }
                    })
                )
            ),
            // Pole pre e-mail
            React.createElement('div', { className: 'mb-4' },
                React.createElement(
                    'label',
                    { htmlFor: 'email', className: 'block text-gray-700 text-sm font-bold mb-2' },
                    'E-mail'
                ),
                React.createElement('input', {
                    type: 'email',
                    id: 'email',
                    value: email,
                    onChange: (e) => {
                        handleValueChange(setEmail, e.target.value);
                        setIsEmailValid(validateEmail(e.target.value));
                    },
                    placeholder: userProfileData.email || 'Zadajte e-mail',
                    className: `shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none`,
                    style: {
                        borderColor: isEmailValid ? roleColor : 'red',
                        boxShadow: 'none'
                    }
                }),
                !isEmailValid && email !== '' && React.createElement(
                    'p',
                    { className: 'text-red-500 text-xs italic mt-1' },
                    'Zadajte platný e-mail.'
                )
            ),
            // Podmienene zobrazenie polí pre telefónne číslo
            userProfileData.role !== 'admin' && userProfileData.role !== 'hall' &&
            React.createElement(
                'div',
                { className: 'mb-4' },
                React.createElement(
                    'label',
                    { htmlFor: 'phoneNumber', className: 'block text-gray-700 text-sm font-bold mb-2' },
                    'Telefónne číslo'
                ),
                React.createElement(
                    'div',
                    { className: 'flex items-center' },
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: () => setShowDialCodeModal(true),
                            className: 'flex items-center text-gray-700 rounded-lg py-2 px-3 mr-2',
                            style: {
                                backgroundColor: '#f3f4f6', // Light gray background
                                border: `1px solid ${roleColor}`,
                            }
                        },
                        React.createElement('span', { className: 'text-sm font-semibold' }, selectedDialCode),
                        React.createElement('svg', { className: 'h-4 w-4 ml-2 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                            React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M19 9l-7 7-7-7' })
                        )
                    ),
                    React.createElement('input', {
                        type: 'tel',
                        id: 'phoneNumber',
                        value: formatPhoneNumberForInput(phoneNumber),
                        onChange: (e) => handleValueChange(setPhoneNumber, e.target.value),
                        placeholder: originalData.current.phoneNumberWithoutDialCode || 'Zadajte telefónne číslo',
                        className: `shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none`,
                        style: {
                            borderColor: roleColor,
                            boxShadow: 'none'
                        }
                    })
                )
            ),
        ),

        // Zmena hesla (teraz vždy viditeľné)
        React.createElement('div', { className: 'mb-6' },
            React.createElement('h3', { className: 'text-lg font-bold text-gray-800 mb-4' }, 'Zmena hesla'),
            // Aktuálne heslo
            React.createElement(PasswordInput, {
                id: 'currentPassword',
                label: 'Aktuálne heslo',
                value: currentPassword,
                onChange: (e) => handleValueChange(setCurrentPassword, e.target.value),
                placeholder: 'Zadajte vaše aktuálne heslo',
                showPassword: showPassword,
                toggleShowPassword: () => setShowPassword(!showPassword),
                roleColor: roleColor
            }),
            // Nové heslo
            React.createElement(PasswordInput, {
                id: 'newPassword',
                label: 'Nové heslo',
                value: newPassword,
                onChange: (e) => handleValueChange(setNewPassword, e.target.value),
                placeholder: 'Zadajte nové heslo (min. 10 znakov)',
                showPassword: showNewPassword,
                toggleShowPassword: () => setShowNewPassword(!showNewPassword),
                roleColor: roleColor
            }),
            // Opakované nové heslo
            React.createElement(PasswordInput, {
                id: 'retypePassword',
                label: 'Zopakujte nové heslo',
                value: retypePassword,
                onChange: (e) => handleValueChange(setRetypePassword, e.target.value),
                placeholder: 'Zopakujte nové heslo',
                showPassword: showRetypePassword,
                toggleShowPassword: () => setShowRetypePassword(!showRetypePassword),
                roleColor: roleColor
            }),
            // Pravidlá pre heslo
            newPassword && React.createElement('div', { className: 'text-sm mt-2' },
                React.createElement('p', { className: `flex items-center ${validationStatus.minLength ? 'text-green-500' : 'text-gray-500'}` },
                    React.createElement('svg', { className: `w-4 h-4 mr-2`, fill: 'currentColor', viewBox: '0 0 20 20' },
                        React.createElement('path', { fillRule: 'evenodd', d: validationStatus.minLength ? 'M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z' : 'M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v5a1 1 0 002 0V6z' })
                    ),
                    'Minimálne 10 znakov'
                ),
                React.createElement('p', { className: `flex items-center ${validationStatus.hasUpperCase ? 'text-green-500' : 'text-gray-500'}` },
                    React.createElement('svg', { className: `w-4 h-4 mr-2`, fill: 'currentColor', viewBox: '0 0 20 20' },
                        React.createElement('path', { fillRule: 'evenodd', d: validationStatus.hasUpperCase ? 'M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z' : 'M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v5a1 1 0 002 0V6z' })
                    ),
                    'Aspoň jedno veľké písmeno'
                ),
                React.createElement('p', { className: `flex items-center ${validationStatus.hasLowerCase ? 'text-green-500' : 'text-gray-500'}` },
                    React.createElement('svg', { className: `w-4 h-4 mr-2`, fill: 'currentColor', viewBox: '0 0 20 20' },
                        React.createElement('path', { fillRule: 'evenodd', d: validationStatus.hasLowerCase ? 'M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z' : 'M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v5a1 1 0 002 0V6z' })
                    ),
                    'Aspoň jedno malé písmeno'
                ),
                React.createElement('p', { className: `flex items-center ${validationStatus.hasNumber ? 'text-green-500' : 'text-gray-500'}` },
                    React.createElement('svg', { className: `w-4 h-4 mr-2`, fill: 'currentColor', viewBox: '0 0 20 20' },
                        React.createElement('path', { fillRule: 'evenodd', d: validationStatus.hasNumber ? 'M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z' : 'M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v5a1 1 0 002 0V6z' })
                    ),
                    'Aspoň jedna číslica'
                )
            )
        )
    );
    
    // Hlavička modálneho okna
    const ModalHeader = React.createElement(
        'div',
        { className: 'flex justify-between items-center p-4 border-b rounded-t-xl', style: { backgroundColor: roleColor } },
        React.createElement('h3', { className: 'text-2xl font-bold text-white' }, 'Upraviť profil'),
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
    
    // Pätička modálneho okna s tlačidlom Uložiť
    const ModalFooter = React.createElement(
        'div',
        { className: 'p-4 border-t' },
        React.createElement(
            'div',
            { className: 'flex justify-end' },
            React.createElement(
                'button',
                {
                    type: 'submit',
                    className: `font-bold py-2 px-4 rounded-full transition-all duration-300 ${isButtonEnabled && !loading ? 'hover:scale-105' : ''} focus:outline-none`,
                    disabled: !isButtonEnabled || loading,
                    style: buttonStyle,
                },
                loading ? 'Ukladám...' : 'Uložiť zmeny'
            )
        )
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
            ),
            ModalFooter
        )
    ) : null;

    return React.createElement(React.Fragment, null,
        modal,
        // Podmienene zobrazenie DialCodeModal pre iné roly ako 'admin'
        userProfileData.role !== 'admin' && React.createElement(DialCodeModal, {
            show: showDialCodeModal,
            onClose: () => setShowDialCodeModal(false),
            onSelect: (dialCode) => {
                handleDialCodeChange(dialCode);
            },
            selectedDialCode: selectedDialCode,
            roleColor: roleColor
        })
    );
};
