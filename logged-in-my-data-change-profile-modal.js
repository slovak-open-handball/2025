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
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M13.875 18.25V12m6.5-7.75l-4.5 4.5m-3 3l-4.5 4.5M2.458 12C3.732 7.943 7.523 5 12 5c.675 0 1.334.053 1.98.158M12 19c-4.477 0-8.268-2.943-9.542-7 1.274-4.057 5.064-7 9.542-7 1.055 0 2.079.127 3.067.355m2.846 2.846l4.243 4.243m-7.042-7.042l-4.243-4.243' })
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
                className: `shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${disabled ? 'bg-gray-100' : ''}`,
                // Zmena kurzora na 'not-allowed' pri disabled
                style: { cursor: disabled ? 'not-allowed' : 'text' }
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
                                className: 'text-gray-500 hover:text-gray-700 focus:outline-none'
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
                        className: 'mt-3 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2',
                        style: { borderColor: roleColor, focusRingColor: roleColor }
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
    const [phoneNumber, setPhoneNumber] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [retypePassword, setRetypePassword] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');

    const [showPassword, setShowPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showRetypePassword, setShowRetypePassword] = useState(false);

    const [loading, setLoading] = useState(false);
    const [showDialCodeModal, setShowDialCodeModal] = useState(false);
    const [selectedDialCode, setSelectedDialCode] = useState(userProfileData.dialCode || (countryDialCodes.find(c => c.code === 'SK')?.dialCode || countryDialCodes[0].dialCode));

    const auth = getAuth();
    const user = auth.currentUser;

    const originalData = useRef({
        firstName: userProfileData.firstName || '',
        lastName: userProfileData.lastName || '',
        email: userProfileData.email || '',
        contactPhoneNumber: userProfileData.contactPhoneNumber || '',
        dialCode: userProfileData.dialCode || (countryDialCodes.find(c => c.code === 'SK')?.dialCode || countryDialCodes[0].dialCode)
    });

    useEffect(() => {
        // Obnovenie stavov pri zobrazení modálu na prázdne reťazce
        if (show) {
            setFirstName('');
            setLastName('');
            setEmail('');
            setPhoneNumber('');
            setSelectedDialCode(userProfileData.dialCode || (countryDialCodes.find(c => c.code === 'SK')?.dialCode || countryDialCodes[0].dialCode));
            setNewPassword('');
            setRetypePassword('');
            setCurrentPassword('');
            setShowPassword(false);
            setShowNewPassword(false);
            setShowRetypePassword(false);

            originalData.current = {
                firstName: userProfileData.firstName || '',
                lastName: userProfileData.lastName || '',
                email: userProfileData.email || '',
                contactPhoneNumber: userProfileData.contactPhoneNumber || '',
                dialCode: userProfileData.dialCode || (countryDialCodes.find(c => c.code === 'SK')?.dialCode || countryDialCodes[0].dialCode)
            };
        }
    }, [show, userProfileData]);

    // Kontrola, či sa zmenili nejaké dáta
    const isFormChanged = () => {
        const hasDataChanged = (
            (firstName !== '' && firstName !== originalData.current.firstName) ||
            (lastName !== '' && lastName !== originalData.current.lastName) ||
            (email !== '' && email !== originalData.current.email) ||
            (userProfileData.role !== 'admin' && phoneNumber !== '' && (selectedDialCode + phoneNumber.replace(/\s/g, '')) !== originalData.current.contactPhoneNumber) ||
            (userProfileData.role !== 'admin' && phoneNumber === '' && selectedDialCode !== originalData.current.dialCode)
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
            if (userProfileData.role !== 'admin' && (phoneNumber !== '' || selectedDialCode !== originalData.current.dialCode)) {
                let newPhoneNumber = phoneNumber.replace(/\s/g, ''); // odstránenie medzier z nového čísla
                
                // Ak sa zmenila len predvoľba, použijeme pôvodné číslo (bez starej predvoľby)
                if (phoneNumber === '' && selectedDialCode !== originalData.current.dialCode) {
                    const originalNumberWithoutDialCode = originalData.current.contactPhoneNumber.startsWith(originalData.current.dialCode)
                        ? originalData.current.contactPhoneNumber.substring(originalData.current.dialCode.length).trim()
                        : originalData.current.contactPhoneNumber;
                    newPhoneNumber = originalNumberWithoutDialCode.replace(/\s/g, '');
                }

                updatedData.contactPhoneNumber = `${selectedDialCode}${newPhoneNumber}`;
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
                className: 'text-gray-500 hover:text-gray-700 focus:outline-none'
            },
            React.createElement(
                'svg',
                { className: 'h-6 w-6', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M6 18L18 6M6 6l12 12' })
            )
        )
    );

    // Vytvorenie placeholderu pre telefónne číslo s formátovaním
    const originalPhoneNumber = userProfileData.contactPhoneNumber;
    let phoneNumberPlaceholder = 'Zadajte telefónne číslo';

    if (originalPhoneNumber) {
        let numberToFormat = originalPhoneNumber;
        const currentDialCode = selectedDialCode || userProfileData.dialCode;

        if (originalPhoneNumber.startsWith(currentDialCode)) {
            numberToFormat = originalPhoneNumber.substring(currentDialCode.length).trim();
        } else if (originalData.current.dialCode && originalPhoneNumber.startsWith(originalData.current.dialCode)) {
            numberToFormat = originalPhoneNumber.substring(originalData.current.dialCode.length).trim();
        }
        
        // Odstránenie všetkých nečíselných znakov a formátovanie
        const cleanedNumber = numberToFormat.replace(/\D/g, '');
        phoneNumberPlaceholder = cleanedNumber.replace(/(\d{3})(?=\d)/g, '$1 ');
    }

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
                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
                placeholder: userProfileData.firstName || 'Zadajte meno',
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
                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
                placeholder: userProfileData.lastName || 'Zadajte priezvisko',
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
                        className: `flex-shrink-0 z-10 inline-flex items-center py-2.5 px-4 text-sm font-medium text-center text-gray-900 bg-gray-100 border border-gray-300 rounded-l-lg hover:bg-gray-200 focus:outline-none`,
                        style: {
                            color: roleColor,
                            borderColor: roleColor
                        }
                    },
                    selectedDialCode
                ),
                React.createElement('input', {
                    type: 'tel',
                    id: 'phoneNumber',
                    value: phoneNumber,
                    onChange: (e) => setPhoneNumber(e.target.value),
                    className: 'rounded-none rounded-r-lg bg-gray-50 border border-gray-300 text-gray-900 focus:ring-blue-500 focus:border-blue-500 block flex-1 min-w-0 w-full text-sm p-2.5',
                    placeholder: phoneNumberPlaceholder,
                    style: { borderColor: roleColor }
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
                onChange: (e) => setEmail(e.target.value),
                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
                placeholder: userProfileData.email || 'Zadajte e-mail',
            })
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
                    disabled: loading || !isFormChanged(),
                    className: `font-bold py-2 px-4 rounded-lg focus:outline-none`,
                    style: {
                        backgroundColor: (loading || !isFormChanged()) ? '#E5E7EB' : roleColor,
                        color: (loading || !isFormChanged()) ? '#9CA3AF' : 'white',
                        border: 'none',
                        cursor: (loading || !isFormChanged()) ? 'not-allowed' : 'pointer',
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
