// Importy pre Firebase funkcie, aby sa dali použiť v modálnom okne
import { getAuth, EmailAuthProvider, reauthenticateWithCredential, verifyBeforeUpdateEmail } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
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

    const [isFocused, setIsFocused] = useState(false);

    return React.createElement(
        'div',
        { className: 'relative' },
        React.createElement(
            'label',
            { htmlFor: id, className: 'block text-sm font-medium text-gray-700' },
            label
        ),
        React.createElement(
            'div',
            { className: 'mt-1 relative rounded-lg shadow-sm' },
            React.createElement('input', {
                type: showPassword ? 'text' : 'password',
                id: id,
                name: id,
                value: value,
                onChange: onChange,
                onFocus: () => setIsFocused(true),
                onBlur: () => setIsFocused(false),
                placeholder: placeholder,
                disabled: disabled,
                className: `block w-full px-4 py-2 rounded-lg border-gray-200 pr-10 shadow-sm disabled:bg-gray-100 disabled:text-gray-500`,
                style: {
                    borderColor: isFocused ? roleColor : '',
                    outlineColor: isFocused ? roleColor : '',
                    boxShadow: isFocused ? `0 0 0 2px ${roleColor}25` : ''
                }
            }),
            React.createElement(
                'button',
                {
                    type: 'button',
                    onClick: toggleShowPassword,
                    className: 'absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 focus:outline-none',
                    disabled: disabled
                },
                showPassword ? EyeIcon : EyeOffIcon
            )
        )
    );
};

/**
 * Komponent pre modálne okno s predvoľbami telefónnych čísiel
 */
const DialCodeModal = ({ show, onClose, onSelect, selectedDialCode, roleColor }) => {
    const inputRef = useRef(null);
    const [filter, setFilter] = useState('');

    useEffect(() => {
        if (show && inputRef.current) {
            inputRef.current.focus();
        }
    }, [show]);

    const handleOutsideClick = (e) => {
        if (e.target.id === 'dialcode-modal-backdrop') {
            onClose();
        }
    };

    if (!show) {
        return null;
    }

    const filteredDialCodes = countryDialCodes.filter(
        (country) =>
            country.code.toLowerCase().includes(filter.toLowerCase()) ||
            country.dialCode.toLowerCase().includes(filter.toLowerCase())
    );

    return ReactDOM.createPortal(
        React.createElement(
            'div',
            {
                id: 'dialcode-modal-backdrop',
                className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center p-4',
                onClick: handleOutsideClick,
            },
            React.createElement(
                'div',
                { className: 'relative p-4 border w-full max-w-sm shadow-lg rounded-lg bg-white' },
                React.createElement(
                    'div',
                    { className: 'flex justify-between items-center pb-3 border-b-2 mb-4' },
                    React.createElement(
                        'h3',
                        { className: 'text-xl font-semibold text-gray-900' },
                        'Vyberte predvoľbu'
                    ),
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
                    'div',
                    { className: 'mb-4' },
                    React.createElement('input', {
                        ref: inputRef,
                        type: 'text',
                        placeholder: 'Vyhľadať...',
                        value: filter,
                        onChange: (e) => setFilter(e.target.value),
                        className: 'w-full px-4 py-2 border rounded-lg',
                    })
                ),
                React.createElement(
                    'div',
                    { className: 'grid grid-cols-3 gap-2 overflow-y-auto max-h-80' },
                    filteredDialCodes.map((country, index) => {
                        const isSelected = country.dialCode === selectedDialCode;
                        const buttonClass = `px-2 py-1 rounded-lg text-sm font-medium transition-colors duration-200 ${isSelected
                            ? 'text-white'
                            : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                        }`;
                        const buttonStyle = isSelected ? { backgroundColor: roleColor } : {};

                        return React.createElement(
                            'button',
                            {
                                key: index,
                                onClick: () => onSelect(country.dialCode),
                                className: buttonClass,
                                style: buttonStyle,
                            },
                            `${country.code} (${country.dialCode})`
                        );
                    })
                )
            )
        ),
        document.body
    );
};

/**
 * Komponent ChangeProfileModal - modálne okno pre zmenu e-mailovej adresy, mena, priezviska a telefónneho čísla
 */
export const ChangeProfileModal = ({ show, onClose, userProfileData, roleColor }) => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newFirstName, setNewFirstName] = useState('');
    const [newLastName, setNewLastName] = useState('');
    const [newPhoneNumber, setNewPhoneNumber] = useState('');
    const [showDialCodeModal, setShowDialCodeModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const [originalDialCode, setOriginalDialCode] = useState('');
    const [originalPhoneNumberWithoutDialCode, setOriginalPhoneNumberWithoutDialCode] = useState('');

    const [selectedDialCode, setSelectedDialCode] = useState(() => {
        if (userProfileData?.contactPhoneNumber) {
            const sortedDialCodes = [...countryDialCodes].sort((a, b) => b.dialCode.length - a.dialCode.length);
            const foundDialCode = sortedDialCodes.find(c => userProfileData.contactPhoneNumber.startsWith(c.dialCode));
            return foundDialCode ? foundDialCode.dialCode : '';
        }
        return '';
    });

    const [isEmailFocused, setIsEmailFocused] = useState(false);
    const [isFirstNameFocused, setIsFirstNameFocused] = useState(false);
    const [isLastNameFocused, setIsLastNameFocused] = useState(false);
    const [isPhoneNumberFocused, setIsPhoneNumberFocused] = useState(false);

    useEffect(() => {
        if (show) {
            setNewFirstName('');
            setNewLastName('');
            setNewEmail('');
            setCurrentPassword('');
            setNewPhoneNumber('');

            if (userProfileData?.contactPhoneNumber) {
                const sortedDialCodes = [...countryDialCodes].sort((a, b) => b.dialCode.length - a.dialCode.length);
                const foundDialCode = sortedDialCodes.find(c => userProfileData.contactPhoneNumber.startsWith(c.dialCode));

                if (foundDialCode) {
                    const numberWithoutCode = userProfileData.contactPhoneNumber.replace(foundDialCode.dialCode, '').trim();
                    setSelectedDialCode(foundDialCode.dialCode);
                    setOriginalDialCode(foundDialCode.dialCode);
                    setOriginalPhoneNumberWithoutDialCode(numberWithoutCode);
                } else {
                    setSelectedDialCode('');
                    setOriginalDialCode('');
                    setOriginalPhoneNumberWithoutDialCode(userProfileData.contactPhoneNumber);
                }
            } else {
                setSelectedDialCode('');
                setOriginalDialCode('');
                setOriginalPhoneNumberWithoutDialCode('');
            }
        }
    }, [show, userProfileData]);

    const isEmailValid = (email) => {
        const emailRegex = /^\S+@\S+\.\S{2,}$/;
        return emailRegex.test(email);
    };

    const isPasswordValid = (password) => {
        return password.length >= 10;
    };

    const handlePhoneNumberChange = (e) => {
        const cleanedValue = e.target.value.replace(/\D/g, '');
        let formattedValue = '';
        for (let i = 0; i < cleanedValue.length; i++) {
            if (i > 0 && i % 3 === 0) {
                formattedValue += ' ';
            }
            formattedValue += cleanedValue[i];
        }
        setNewPhoneNumber(formattedValue);
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        const hasNameChanged = (newFirstName !== '' && newFirstName !== userProfileData.firstName) || (newLastName !== '' && newLastName !== userProfileData.lastName);
        const hasEmailChanged = newEmail !== '' && newEmail !== userProfileData.email;
        const phonePart = newPhoneNumber || originalPhoneNumberWithoutDialCode;
        const newPhone = phonePart.replace(/\s/g, '');
        const originalPhone = originalPhoneNumberWithoutDialCode.replace(/\s/g, '');
        const hasPhoneNumberChanged = newPhone !== originalPhone;
        const hasDialCodeChanged = selectedDialCode !== originalDialCode;
        const hasAnyChanges = hasNameChanged || hasEmailChanged || hasPhoneNumberChanged || hasDialCodeChanged;

        if (!hasAnyChanges) {
            window.showGlobalNotification('Žiadne zmeny na uloženie.', 'info');
            setLoading(false);
            onClose();
            return;
        }

        try {
            const updates = {};
            if (hasNameChanged) {
                if (newFirstName !== '' && newFirstName !== userProfileData.firstName) updates.firstName = newFirstName;
                if (newLastName !== '' && newLastName !== userProfileData.lastName) updates.lastName = newLastName;
            }
            if (hasPhoneNumberChanged || hasDialCodeChanged) {
                updates.contactPhoneNumber = `${selectedDialCode}${newPhone}`;
            }

            if (Object.keys(updates).length > 0) {
                const db = getFirestore(window.app);
                const userDocRef = doc(db, 'users', userProfileData.id);
                await updateDoc(userDocRef, updates);
                window.showGlobalNotification('Profilové údaje boli úspešne zmenené.', 'success');
            }

            if (hasEmailChanged) {
                if (!isPasswordValid(currentPassword)) {
                    window.showGlobalNotification('Pre zmenu e-mailu je potrebné platné heslo.', 'error');
                    setLoading(false);
                    return;
                }
                const auth = getAuth(window.app);
                const user = auth.currentUser;
                const credential = EmailAuthProvider.credential(user.email, currentPassword);
                await reauthenticateWithCredential(user, credential);
                await verifyBeforeUpdateEmail(user, newEmail);
                window.showGlobalNotification('Potvrďte zmenu e-mailovej adresy kliknutím na odkaz vo vašej novej e-mailovej schránke.', 'success');
            }
            onClose();
            window.dispatchEvent(new CustomEvent('globalDataUpdated'));
        } catch (error) {
            let errorMessage = "Nastala chyba pri ukladaní zmien.";
            if (error.code === 'auth/wrong-password') {
                errorMessage = "Nesprávne heslo. Skúste to znova.";
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = "Neplatný formát e-mailu.";
            } else if (error.code === 'auth/requires-recent-login') {
                errorMessage = "Pre zmenu e-mailu sa musíte znova prihlásiť.";
            } else if (error.code === 'auth/email-already-in-use') {
                errorMessage = "Táto e-mailová adresa sa už používa.";
            }
            window.showGlobalNotification(errorMessage, 'error');
            console.error("Chyba pri zmene profilu:", error);
        } finally {
            setLoading(false);
        }
    };

    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword);
    };

    const handleOutsideClick = (e) => {
        if (e.target.id === 'modal-backdrop') {
            onClose();
        }
    };

    if (!show) {
        return null;
    }

    const firstNamePlaceholder = userProfileData?.firstName || 'Meno';
    const lastNamePlaceholder = userProfileData?.lastName || 'Priezvisko';
    const emailPlaceholder = userProfileData?.email || 'e-mail@priklad.sk';
    const phoneNumberWithoutCode = originalPhoneNumberWithoutDialCode ? originalPhoneNumberWithoutDialCode.replace(/(\d{3})(?=\d)/g, '$1 ') : 'Zadajte telefónne číslo';
    const phoneNumberPlaceholder = newPhoneNumber || phoneNumberWithoutCode;

    const hasAnyChanges = (newFirstName !== '' && newFirstName !== userProfileData.firstName) || (newLastName !== '' && newLastName !== userProfileData.lastName) || (newEmail !== '' && newEmail !== userProfileData.email) || (newPhoneNumber !== '' && newPhoneNumber.replace(/\s/g, '') !== originalPhoneNumberWithoutDialCode.replace(/\s/g, '')) || selectedDialCode !== originalDialCode;

    return ReactDOM.createPortal(
        React.createElement(
            'div',
            { id: 'modal-backdrop', className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center p-4', onClick: handleOutsideClick },
            React.createElement(
                'div',
                { className: 'relative p-8 border w-full max-w-lg shadow-lg rounded-lg bg-white transform transition-all' },
                React.createElement(
                    'div',
                    { className: `${roleColor} -mt-8 -mx-8 mb-4 px-8 py-4 rounded-t-lg flex justify-between items-center text-white` },
                    React.createElement('h3', { className: 'text-2xl font-semibold' }, 'Upraviť profil'),
                    React.createElement(
                        'button',
                        { onClick: onClose, className: 'text-white hover:text-gray-200' },
                        React.createElement(
                            'svg',
                            { className: 'h-6 w-6', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                            React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M6 18L18 6M6 6l12 12' })
                        )
                    )
                ),
                React.createElement(
                    'form',
                    { onSubmit: handleFormSubmit },
                    React.createElement(
                        'div',
                        { className: 'grid grid-cols-1 md:grid-cols-2 gap-4 mb-4' },
                        React.createElement('div', { className: 'flex flex-col' },
                            React.createElement('label', { htmlFor: 'newFirstName', className: 'block text-sm font-medium text-gray-700' }, 'Meno'),
                            React.createElement('input', {
                                type: 'text',
                                id: 'newFirstName',
                                value: newFirstName,
                                onChange: (e) => setNewFirstName(e.target.value),
                                placeholder: firstNamePlaceholder,
                                onFocus: () => setIsFirstNameFocused(true),
                                onBlur: () => setIsFirstNameFocused(false),
                                className: `mt-1 w-full px-4 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-opacity-50`,
                                style: { borderColor: isFirstNameFocused ? roleColor : '', boxShadow: isFirstNameFocused ? `0 0 0 2px ${roleColor}25` : '' }
                            })
                        ),
                        React.createElement('div', { className: 'flex flex-col' },
                            React.createElement('label', { htmlFor: 'newLastName', className: 'block text-sm font-medium text-gray-700' }, 'Priezvisko'),
                            React.createElement('input', {
                                type: 'text',
                                id: 'newLastName',
                                value: newLastName,
                                onChange: (e) => setNewLastName(e.target.value),
                                placeholder: lastNamePlaceholder,
                                onFocus: () => setIsLastNameFocused(true),
                                onBlur: () => setIsLastNameFocused(false),
                                className: `mt-1 w-full px-4 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-opacity-50`,
                                style: { borderColor: isLastNameFocused ? roleColor : '', boxShadow: isLastNameFocused ? `0 0 0 2px ${roleColor}25` : '' }
                            })
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'mb-4' },
                        React.createElement('label', { htmlFor: 'newEmail', className: 'block text-sm font-medium text-gray-700' }, 'E-mailová adresa'),
                        React.createElement('input', {
                            type: 'email',
                            id: 'newEmail',
                            value: newEmail,
                            onChange: (e) => setNewEmail(e.target.value),
                            placeholder: emailPlaceholder,
                            onFocus: () => setIsEmailFocused(true),
                            onBlur: () => setIsEmailFocused(false),
                            className: `mt-1 w-full px-4 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-opacity-50`,
                            style: { borderColor: isEmailFocused ? roleColor : '', boxShadow: isEmailFocused ? `0 0 0 2px ${roleColor}25` : '' }
                        })
                    ),
                    React.createElement(
                        'div',
                        { className: 'mb-4' },
                        React.createElement('label', { htmlFor: 'newPhoneNumber', className: 'block text-sm font-medium text-gray-700' }, 'Telefónne číslo'),
                        React.createElement('div', { className: 'flex mt-1 rounded-lg shadow-sm' },
                            React.createElement(
                                'button',
                                {
                                    type: 'button',
                                    onClick: () => setShowDialCodeModal(true),
                                    className: 'flex-shrink-0 inline-flex items-center px-4 rounded-l-lg border border-gray-300 bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200'
                                },
                                React.createElement('span', null, selectedDialCode || 'Vybrať'),
                                React.createElement('svg', { className: 'h-4 w-4 ml-2', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                                    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M19 9l-7 7-7-7' })
                                )
                            ),
                            React.createElement('input', {
                                type: 'tel',
                                id: 'newPhoneNumber',
                                value: newPhoneNumber,
                                onChange: handlePhoneNumberChange,
                                placeholder: phoneNumberPlaceholder,
                                onFocus: () => setIsPhoneNumberFocused(true),
                                onBlur: () => setIsPhoneNumberFocused(false),
                                className: `flex-1 block w-full px-4 py-2 rounded-r-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-opacity-50`,
                                style: { borderColor: isPhoneNumberFocused ? roleColor : '', boxShadow: isPhoneNumberFocused ? `0 0 0 2px ${roleColor}25` : '' }
                            })
                        )
                    ),
                    React.createElement(PasswordInput, {
                        id: 'current-password',
                        label: 'Aktuálne heslo (pre potvrdenie zmien)',
                        value: currentPassword,
                        onChange: (e) => setCurrentPassword(e.target.value),
                        placeholder: 'Aktuálne heslo',
                        showPassword: showPassword,
                        toggleShowPassword: togglePasswordVisibility,
                        roleColor: roleColor
                    }),
                    React.createElement(
                        'div',
                        { className: 'mt-6 flex justify-end gap-2' },
                        React.createElement(
                            'button',
                            {
                                type: 'button',
                                onClick: onClose,
                                className: 'px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-100'
                            },
                            'Zrušiť'
                        ),
                        React.createElement(
                            'button',
                            {
                                type: 'submit',
                                disabled: loading || !hasAnyChanges,
                                className: `px-6 py-2 rounded-lg text-white font-medium transition-colors duration-200 ${loading || !hasAnyChanges ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`
                            },
                            loading ? 'Ukladám...' : 'Uložiť zmeny'
                        )
                    )
                ),
                React.createElement(DialCodeModal, {
                    show: showDialCodeModal,
                    onClose: () => setShowDialCodeModal(false),
                    onSelect: (code) => setSelectedDialCode(code),
                    selectedDialCode: selectedDialCode,
                    roleColor: roleColor
                })
            )
        ),
        document.body
    );
};
