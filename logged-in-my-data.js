// Importy pre Firebase funkcie
import { getAuth, EmailAuthProvider, reauthenticateWithCredential, verifyBeforeUpdateEmail, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getFirestore, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Import zoznamu predvolieb
import { countryDialCodes } from "./countryDialCodes.js";

const { useState, useEffect, useRef } = React;

/**
 * Globálna funkcia pre zobrazenie notifikácií
 * Vytvorí a spravuje modálne okno pre správy o úspechu alebo chybách
 */
window.showGlobalNotification = (message, type = 'success') => {
    let notificationElement = document.getElementById('global-notification');

    // Ak element ešte neexistuje, vytvoríme ho a pridáme do tela dokumentu
    if (!notificationElement) {
        notificationElement = document.createElement('div');
        notificationElement.id = 'global-notification';
        // Používame Tailwind CSS triedy pre štýlovanie a animácie
        notificationElement.className = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[9999] opacity-0 transition-opacity duration-300';
        document.body.appendChild(notificationElement);
    }

    // Určíme farby na základe typu správy
    let bgColorClass, textColorClass;
    if (type === 'success') {
        bgColorClass = 'bg-green-100';
        textColorClass = 'text-green-800';
    } else if (type === 'error') {
        bgColorClass = 'bg-red-100';
        textColorClass = 'text-red-800';
    } else {
        // Predvolené farby pre iné typy
        bgColorClass = 'bg-blue-100';
        textColorClass = 'text-blue-800';
    }

    // Aktualizujeme obsah a triedy
    notificationElement.innerHTML = `<p class="font-semibold">${message}</p>`;
    notificationElement.className = `fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[9999] opacity-0 transition-opacity duration-300 ${bgColorClass} ${textColorClass}`;

    // Zobrazíme notifikáciu (fade-in)
    setTimeout(() => {
        notificationElement.style.opacity = '1';
    }, 10);

    // Skryjeme notifikáciu po 5 sekundách (fade-out)
    setTimeout(() => {
        notificationElement.style.opacity = '0';
        setTimeout(() => {
            if (notificationElement.parentNode) {
                notificationElement.parentNode.removeChild(notificationElement);
            }
        }, 300); // Po dokončení animácie odstránime element z DOM
    }, 5000);
};

/**
 * Komponent PasswordInput pre polia hesla s prepínaním viditeľnosti.
 * Používa sa pre pole aktuálneho hesla v modálnom okne.
 */
const PasswordInput = ({ id, label, value, onChange, placeholder, showPassword, toggleShowPassword, disabled, roleColor }) => {
    // Použitie nových SVG ikon
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

    // Stav pre sledovanie fokusu
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
                    boxShadow: isFocused ? `0 0 0 2px ${roleColor}25` : '' // Jemný tieň na focus
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
const DialCodeModal = ({ show, onClose, onSelect }) => {
    // Vytvoríme referenciu pre pole, aby sme ho mohli použiť pre vyhľadávanie
    const inputRef = useRef(null);

    // Stav pre vyhľadávací filter
    const [filter, setFilter] = useState('');

    useEffect(() => {
        // Keď sa modálne okno otvorí, nastavíme fokus na input pole
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

    // Filter zoznamu predvolieb na základe vstupu používateľa
    const filteredDialCodes = countryDialCodes.filter(
        (country) =>
            country.code.toLowerCase().includes(filter.toLowerCase()) ||
            country.dialCode.toLowerCase().includes(filter.toLowerCase())
    );

    return React.createElement(
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
                filteredDialCodes.map((country, index) =>
                    React.createElement(
                        'button',
                        {
                            key: index,
                            onClick: () => onSelect(country.dialCode),
                            className: 'px-2 py-1 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors duration-200',
                        },
                        `${country.code} (${country.dialCode})`
                    )
                )
            ),
        )
    );
};

/**
 * Komponent ChangeProfileModal - modálne okno pre zmenu e-mailovej adresy, mena, priezviska a telefónneho čísla
 */
const ChangeProfileModal = ({ show, onClose, userProfileData, roleColor }) => {
    // Inicializácia stavov s prázdnymi reťazcami, aby sa polia nepredvyplnili
    const [currentPassword, setCurrentPassword] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newFirstName, setNewFirstName] = useState('');
    const [newLastName, setNewLastName] = useState('');
    const [newPhoneNumber, setNewPhoneNumber] = useState(''); // Nové pole pre telefónne číslo
    const [showDialCodeModal, setShowDialCodeModal] = useState(false); // Stav pre zobrazenie modálu s predvoľbami
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [selectedDialCode, setSelectedDialCode] = useState('');

    // Stavy pre sledovanie fokusu
    const [isEmailFocused, setIsEmailFocused] = useState(false);
    const [isFirstNameFocused, setIsFirstNameFocused] = useState(false);
    const [isLastNameFocused, setIsLastNameFocused] = useState(false);
    const [isPhoneNumberFocused, setIsPhoneNumberFocused] = useState(false); // Nový stav pre fokus telefónneho čísla

    useEffect(() => {
        // Reset stavu pri zatvorení modálu
        if (!show) {
            setCurrentPassword('');
            setNewEmail('');
            setNewFirstName('');
            setNewLastName('');
            setNewPhoneNumber('');
            setSelectedDialCode('');
            setLoading(false);
            setShowPassword(false);
            setIsEmailFocused(false);
            setIsFirstNameFocused(false);
            setIsLastNameFocused(false);
            setIsPhoneNumberFocused(false);
        } else {
             // Nastavíme predvolený dial code pri otvorení modálu, ak nejaký existuje
            if (userProfileData.contactPhoneNumber) {
                // Skúsime nájsť predvoľbu v existujúcom čísle a oddeliť ju
                let foundDialCode = countryDialCodes.find(c => userProfileData.contactPhoneNumber.startsWith(c.dialCode));
                if (foundDialCode) {
                    setSelectedDialCode(foundDialCode.dialCode);
                    setNewPhoneNumber(userProfileData.contactPhoneNumber.substring(foundDialCode.dialCode.length).trim());
                } else {
                    // Ak sa nenašla predvoľba, nastavíme ju na prázdno
                    setSelectedDialCode('');
                    setNewPhoneNumber(userProfileData.contactPhoneNumber);
                }
            }
        }
    }, [show, userProfileData]);

    // Validácia e-mailu
    const isEmailValid = (email) => {
        const emailRegex = /^\S+@\S+\.\S{2,}$/;
        return emailRegex.test(email);
    };

    // Validácia hesla
    const isPasswordValid = (password) => {
        return password.length >= 10;
    };

    // Validácia telefónneho čísla
    const isPhoneNumberValid = (phoneNumber) => {
        // Jednoduchá validácia, že číslo obsahuje len číslice a má aspoň 9 znakov (Slovenské čísla)
        const phoneRegex = /^\+?(\d[\s-]?){9,15}$/;
        return phoneRegex.test(phoneNumber);
    };

    // Kontrola, či nastali nejaké zmeny
    const hasNameChanged = (newFirstName !== '' && newFirstName !== userProfileData?.firstName) || (newLastName !== '' && newLastName !== userProfileData?.lastName);
    const hasEmailChanged = newEmail !== '' && newEmail !== userProfileData?.email;
    const hasPhoneNumberChanged = newPhoneNumber !== '' && `${selectedDialCode}${newPhoneNumber}` !== userProfileData?.contactPhoneNumber;

    // Celková validácia formulára pre tlačidlo "Uložiť"
    const isFormValid = hasNameChanged || (hasEmailChanged && isEmailValid(newEmail) && isPasswordValid(currentPassword)) || (hasPhoneNumberChanged && isPhoneNumberValid(`${selectedDialCode}${newPhoneNumber}`));


    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        // Ak sa nič nezmenilo, zobrazíme notifikáciu a zatvoríme modál
        if (!hasNameChanged && !hasEmailChanged && !hasPhoneNumberChanged) {
            window.showGlobalNotification('Žiadne zmeny na uloženie.', 'info');
            setLoading(false);
            onClose();
            return;
        }

        try {
            // Inicializujeme objekt pre aktualizácie mena, priezviska a telefónneho čísla
            const updates = {};
            // Skontrolujeme, či bolo zmenené meno
            if (newFirstName !== '' && newFirstName !== userProfileData.firstName) {
                updates.firstName = newFirstName;
            }
            // Skontrolujeme, či bolo zmenené priezvisko
            if (newLastName !== '' && newLastName !== userProfileData.lastName) {
                updates.lastName = newLastName;
            }
            // Skontrolujeme, či bolo zmenené telefónne číslo
            if (newPhoneNumber !== '' && `${selectedDialCode}${newPhoneNumber}` !== userProfileData.contactPhoneNumber) {
                updates.contactPhoneNumber = `${selectedDialCode}${newPhoneNumber}`;
            }

            // Ak existujú nejaké zmeny v mene, priezvisku alebo telefónnom čísle, uložíme ich
            if (Object.keys(updates).length > 0) {
                const db = window.db;
                const userDocRef = doc(db, 'users', userProfileData.id);
                await updateDoc(userDocRef, updates);
                window.showGlobalNotification('Profilové údaje boli úspešne zmenené.', 'success');
            }

            // Zmena e-mailu (vyžaduje re-autentifikáciu a heslo)
            if (hasEmailChanged) {
                 if (!isPasswordValid(currentPassword)) {
                    window.showGlobalNotification('Pre zmenu e-mailu je potrebné platné heslo.', 'error');
                    setLoading(false);
                    return;
                }
                const auth = window.auth;
                const user = auth.currentUser;
                const credential = window.EmailAuthProvider.credential(user.email, currentPassword);

                await window.reauthenticateWithCredential(user, credential);
                await window.verifyBeforeUpdateEmail(user, newEmail);
                window.showGlobalNotification('Potvrďte zmenu e-mailovej adresy kliknutím na odkaz vo vašej novej e-mailovej schránke.', 'success');
            }

            // Zavrieme modálne okno po úspešnej zmene, alebo ak sa nič nezmenilo
            onClose();

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

    // Funkcia na zatvorenie modálneho okna pri kliknutí mimo neho
    const handleOutsideClick = (e) => {
        if (e.target.id === 'modal-backdrop') {
            onClose();
        }
    };

    if (!show) {
        return null;
    }

    // Stav pre placeholder, aby bol dynamický, ale hodnota inputu prázdna
    const firstNamePlaceholder = userProfileData?.firstName || 'Meno';
    const lastNamePlaceholder = userProfileData?.lastName || 'Priezvisko';
    const emailPlaceholder = userProfileData?.email || 'e-mail@priklad.sk';
    const phoneNumberPlaceholder = userProfileData?.contactPhoneNumber || ''; // Prázdny placeholder pre tel. číslo

    return React.createElement(
        'div',
        {
            id: 'modal-backdrop',
            className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center p-4',
            onClick: handleOutsideClick
        },
        React.createElement(
            'div',
            { className: 'relative p-8 border w-full max-w-2xl shadow-lg rounded-lg bg-white' },
            React.createElement(
                'div',
                { className: 'flex justify-between items-center pb-3 border-b-2 mb-4' },
                React.createElement(
                    'h3',
                    { className: 'text-2xl font-semibold text-gray-900' },
                    'Upraviť profil'
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
                'form',
                { onSubmit: handleFormSubmit, className: 'space-y-6' },
                // Pole pre meno
                React.createElement(
                    'div',
                    null,
                    React.createElement(
                        'label',
                        { htmlFor: 'new-first-name', className: 'block text-sm font-medium text-gray-700' },
                        'Meno'
                    ),
                    React.createElement(
                        'div',
                        { className: 'mt-1' },
                        React.createElement('input', {
                            id: 'new-first-name',
                            name: 'new-first-name',
                            type: 'text',
                            value: newFirstName,
                            onChange: (e) => setNewFirstName(e.target.value),
                            onFocus: () => setIsFirstNameFocused(true),
                            onBlur: () => setIsFirstNameFocused(false),
                            placeholder: firstNamePlaceholder,
                            disabled: loading,
                            className: 'block w-full px-4 py-2 rounded-lg border-gray-200 shadow-sm disabled:bg-gray-100 disabled:text-gray-500',
                            style: {
                                borderColor: isFirstNameFocused ? roleColor : '',
                                outlineColor: isFirstNameFocused ? roleColor : '',
                                boxShadow: isFirstNameFocused ? `0 0 0 2px ${roleColor}25` : ''
                            }
                        })
                    )
                ),
                // Pole pre priezvisko
                React.createElement(
                    'div',
                    null,
                    React.createElement(
                        'label',
                        { htmlFor: 'new-last-name', className: 'block text-sm font-medium text-gray-700' },
                        'Priezvisko'
                    ),
                    React.createElement(
                        'div',
                        { className: 'mt-1' },
                        React.createElement('input', {
                            id: 'new-last-name',
                            name: 'new-last-name',
                            type: 'text',
                            value: newLastName,
                            onChange: (e) => setNewLastName(e.target.value),
                            onFocus: () => setIsLastNameFocused(true),
                            onBlur: () => setIsLastNameFocused(false),
                            placeholder: lastNamePlaceholder,
                            disabled: loading,
                            className: 'block w-full px-4 py-2 rounded-lg border-gray-200 shadow-sm disabled:bg-gray-100 disabled:text-gray-500',
                            style: {
                                borderColor: isLastNameFocused ? roleColor : '',
                                outlineColor: isLastNameFocused ? roleColor : '',
                                boxShadow: isLastNameFocused ? `0 0 0 2px ${roleColor}25` : ''
                            }
                        })
                    )
                ),
                // Podmienečne zobrazenie poľa pre telefónne číslo
                userProfileData.contactPhoneNumber && React.createElement(
                    'div',
                    null,
                    React.createElement(
                        'label',
                        { htmlFor: 'new-phone-number', className: 'block text-sm font-medium text-gray-700' },
                        'Telefónne číslo'
                    ),
                    React.createElement(
                        'div',
                        { className: 'mt-1 flex rounded-lg shadow-sm border border-gray-200 focus-within:ring-2',
                           style: {
                               borderColor: isPhoneNumberFocused ? roleColor : '',
                               outlineColor: isPhoneNumberFocused ? roleColor : '',
                               boxShadow: isPhoneNumberFocused ? `0 0 0 2px ${roleColor}25` : ''
                           }
                        },
                        React.createElement(
                            'button',
                            {
                                type: 'button',
                                onClick: () => setShowDialCodeModal(true),
                                disabled: loading,
                                className: 'px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 border-r border-gray-200 rounded-l-lg hover:bg-gray-100 disabled:opacity-50'
                            },
                            selectedDialCode || 'Predvoľba'
                        ),
                        React.createElement('input', {
                            id: 'new-phone-number',
                            name: 'new-phone-number',
                            type: 'tel', // Používame typ tel pre lepšiu klávesnicu na mobiloch
                            value: newPhoneNumber,
                            onChange: (e) => setNewPhoneNumber(e.target.value),
                            onFocus: () => setIsPhoneNumberFocused(true),
                            onBlur: () => setIsPhoneNumberFocused(false),
                            placeholder: phoneNumberPlaceholder,
                            disabled: loading,
                            className: 'flex-1 block w-full px-4 py-2 rounded-r-lg disabled:bg-gray-100 disabled:text-gray-500 border-none focus:ring-0',
                        })
                    )
                ),
                // Pole pre e-mail
                React.createElement(
                    'div',
                    null,
                    React.createElement(
                        'label',
                        { htmlFor: 'new-email', className: 'block text-sm font-medium text-gray-700' },
                        'Nová e-mailová adresa'
                    ),
                    React.createElement(
                        'div',
                        { className: 'mt-1' },
                        React.createElement('input', {
                            id: 'new-email',
                            name: 'new-email',
                            type: 'email',
                            autoComplete: 'new-email',
                            value: newEmail,
                            onChange: (e) => setNewEmail(e.target.value),
                            onFocus: () => setIsEmailFocused(true),
                            onBlur: () => setIsEmailFocused(false),
                            placeholder: emailPlaceholder,
                            disabled: loading,
                            className: 'block w-full px-4 py-2 rounded-lg border-gray-200 shadow-sm disabled:bg-gray-100 disabled:text-gray-500',
                            style: {
                                borderColor: isEmailFocused ? roleColor : '',
                                outlineColor: isEmailFocused ? roleColor : '',
                                boxShadow: isEmailFocused ? `0 0 0 2px ${roleColor}25` : ''
                            }
                        })
                    )
                ),
                // Pole pre aktuálne heslo
                React.createElement(PasswordInput, {
                    id: 'current-password',
                    label: 'Aktuálne heslo (pre potvrdenie zmien)',
                    value: currentPassword,
                    onChange: (e) => setCurrentPassword(e.target.value),
                    placeholder: 'Zadajte svoje aktuálne heslo',
                    showPassword: showPassword,
                    toggleShowPassword: togglePasswordVisibility,
                    disabled: loading,
                    roleColor: roleColor
                }),
                React.createElement(
                    'div',
                    { className: 'flex justify-end space-x-3' },
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: onClose,
                            disabled: loading,
                            className: 'px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50'
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            type: 'submit',
                            disabled: loading || (!hasNameChanged && !hasEmailChanged && !hasPhoneNumberChanged) || (hasEmailChanged && (!isEmailValid(newEmail) || !isPasswordValid(currentPassword))),
                            className: `px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 transition-colors duration-200 ${loading || (!hasNameChanged && !hasEmailChanged && !hasPhoneNumberChanged) || (hasEmailChanged && (!isEmailValid(newEmail) || !isPasswordValid(currentPassword))) ? 'cursor-not-allowed' : ''}`,
                            style: {
                                backgroundColor: isFormValid ? roleColor : 'white',
                                color: isFormValid ? 'white' : roleColor,
                                borderColor: isFormValid ? 'transparent' : roleColor,
                                borderWidth: isFormValid ? '0px' : '1px'
                            }
                        },
                        loading ? 'Ukladám...' : 'Uložiť zmeny'
                    )
                )
            )
        ),
        React.createElement(DialCodeModal, {
            show: showDialCodeModal,
            onClose: () => setShowDialCodeModal(false),
            onSelect: (dialCode) => {
                setSelectedDialCode(dialCode);
                setShowDialCodeModal(false);
            },
        })
    );
};


/**
 * Komponenta pre zobrazenie profilových dát
 * Aplikácia bola prispôsobená pre React
 */
const MyDataApp = () => {
    // Definujeme stavy aplikácie
    const [userProfileData, setUserProfileData] = useState(window.globalUserProfileData);
    const [showModal, setShowModal] = useState(false);

    // Načítanie dát pri prvom renderovaní a nastavenie listeneru
    useEffect(() => {
        const handleDataUpdate = (event) => {
            console.log("logged-in-my-data.js: Prijatá udalosť 'globalDataUpdated'. Aktualizujem stav.");
            setUserProfileData(event.detail);
        };
        window.addEventListener('globalDataUpdated', handleDataUpdate);

        // Upratovanie pri odpojení komponentu
        return () => {
            window.removeEventListener('globalDataUpdated', handleDataUpdate);
        };
    }, []);

    // Funkcia na získanie farby na základe roly
    const getRoleColor = (role) => {
        switch (role) {
            case 'admin':
                return '#47b3ff'; // Farba pre admina
            case 'hall':
                return '#b06835'; // Farba pre halu
            case 'user':
                return '#9333EA'; // Farba pre bežného používateľa
            default:
                return '#1D4ED8'; // Predvolená farba (bg-blue-800)
        }
    };

    // Zobrazíme spinner, kým sa načítajú dáta
    if (!userProfileData) {
        return React.createElement(
            'div',
            { className: 'flex justify-center pt-16' },
            React.createElement(
                'div',
                { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' }
            )
        );
    }

    const { role, firstName, lastName, email, contactPhoneNumber } = userProfileData;
    const headerColor = getRoleColor(role);

    return React.createElement(
        'div',
        { className: 'relative flex flex-col items-center pt-12' },
        React.createElement(
            'div',
            {
                className: 'w-full max-w-2xl mx-auto rounded-xl shadow-lg overflow-hidden',
                style: { marginBottom: '2rem' } // Pridaný spodný margin
            },
            React.createElement(
                'div',
                {
                    className: 'w-full p-4 text-white flex justify-between items-center',
                    style: { backgroundColor: headerColor, borderBottomLeftRadius: '0', borderBottomRightRadius: '0' }
                },
                React.createElement(
                    'h1',
                    { className: 'text-2xl font-bold' },
                    'Kontaktná osoba'
                ),
                React.createElement(
                    'button',
                    {
                        onClick: () => setShowModal(true),
                        className: 'p-2 rounded-full hover:bg-white hover:bg-opacity-20 transition-colors duration-200'
                    },
                    React.createElement(
                        'svg',
                        { className: 'h-6 w-6 text-white', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' })
                    )
                )
            ),
            React.createElement(
                'div',
                { className: 'bg-white p-8 space-y-6' },
                React.createElement(
                    'div',
                    { className: 'flex flex-col' },
                    React.createElement(
                        'p',
                        { className: 'font-bold text-gray-800 flex items-center' },
                        'Meno a priezvisko kontaktnej osoby:'
                    ),
                    React.createElement(
                        'p',
                        { className: 'text-gray-800 text-lg mt-1' },
                        `${userProfileData.firstName} ${userProfileData.lastName}`
                    )
                ),
                // Zobrazíme telefónne číslo, iba ak existuje
                userProfileData.contactPhoneNumber && React.createElement(
                    'div',
                    { className: 'flex flex-col' },
                    React.createElement(
                        'p',
                        { className: 'font-bold text-gray-800 flex items-center' },
                        'Telefónne číslo:'
                    ),
                    React.createElement(
                        'p',
                        { className: 'text-gray-800 text-lg mt-1' },
                        `${userProfileData.contactPhoneNumber}`
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'flex flex-col' },
                    React.createElement(
                        'p',
                        { className: 'font-bold text-gray-800 flex items-center' },
                        'E-mailová adresa kontaktnej osoby:'
                    ),
                    React.createElement(
                        'p',
                        { className: 'text-gray-800 text-lg mt-1' },
                        `${userProfileData.email}`
                    )
                )
            )
        ),
        React.createElement(ChangeProfileModal, {
            show: showModal,
            onClose: () => setShowModal(false),
            userProfileData: userProfileData,
            roleColor: headerColor
        })
    );
};

// Renderovanie aplikácie do DOM
const rootElement = document.getElementById('root');
if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
    const root = ReactDOM.createRoot(rootElement);
    root.render(React.createElement(MyDataApp, null));
    console.log("logged-in-my-data.js: Aplikácia vykreslená.");
} else {
    console.error("logged-in-my-data.js: HTML element 'root' alebo React/ReactDOM nie sú dostupné.");
}

// Explicitne sprístupníme komponent pre ladenie alebo externé použitie
window.MyDataApp = MyDataApp;
