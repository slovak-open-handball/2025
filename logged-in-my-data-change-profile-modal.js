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

    return React.createElement(
        'div',
        { className: 'relative' },
        React.createElement(
            'label',
            { htmlFor: id, className: 'block text-sm font-medium text-gray-700' },
            label
        ),
        React.createElement(
            'input',
            {
                type: showPassword ? 'text' : 'password',
                id: id,
                value: value,
                onChange: onChange,
                placeholder: placeholder,
                disabled: disabled,
                className: `mt-1 block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-0 sm:text-sm ${
                    disabled ? 'bg-gray-100 border-gray-200' : 'border-gray-300 focus:border-transparent'
                }`,
                style: disabled ? {} : { 'borderColor': roleColor }
            }
        ),
        React.createElement(
            'button',
            {
                type: 'button',
                onClick: toggleShowPassword,
                className: 'absolute inset-y-0 right-0 flex items-center pr-3 pt-5 text-gray-500 hover:text-gray-700',
                disabled: disabled
            },
            showPassword ? EyeOffIcon : EyeIcon
        )
    );
};

/**
 * Komponent pre výber predvoľby krajiny.
 */
const DialCodeModal = ({ show, onClose, onSelect, selectedDialCode, roleColor }) => {
    const [searchQuery, setSearchQuery] = useState('');

    // Opravená logika filtra pre nový formát dát v countryDialCodes
    const filteredCodes = countryDialCodes.filter(c =>
        (c.name && c.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.dialCode && c.dialCode.includes(searchQuery))
    );

    const ModalHeader = React.createElement(
        'div',
        { className: `px-6 py-4 rounded-t-xl text-white`, style: { backgroundColor: roleColor } },
        React.createElement('h3', { className: 'text-lg font-bold' }, 'Vyberte predvoľbu krajiny')
    );

    const SearchInput = React.createElement(
        'div',
        { className: 'p-4' },
        React.createElement(
            'input',
            {
                type: 'text',
                placeholder: 'Hľadať krajinu alebo predvoľbu...',
                value: searchQuery,
                onChange: (e) => setSearchQuery(e.target.value),
                className: 'w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500'
            }
        )
    );

    const CodesList = React.createElement(
        'ul',
        { className: 'max-h-72 overflow-y-auto' },
        filteredCodes.map(country =>
            React.createElement(
                'li',
                {
                    key: country.code,
                    onClick: () => {
                        onSelect(country.dialCode);
                        onClose(); // Zatvoríme modálne okno po výbere
                    },
                    className: `flex justify-between items-center px-4 py-2 cursor-pointer transition-colors duration-200 hover:bg-gray-100 ${selectedDialCode === country.dialCode ? 'bg-blue-100 font-semibold' : ''}`
                },
                React.createElement('span', null, `${country.name} (${country.dialCode})`),
                selectedDialCode === country.dialCode && React.createElement(
                    'svg',
                    { className: 'h-5 w-5 text-blue-600', xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 20 20', fill: 'currentColor' },
                    React.createElement('path', { fillRule: 'evenodd', d: 'M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z', clipRule: 'evenodd' })
                )
            )
        )
    );

    return show
        ? ReactDOM.createPortal(
              React.createElement(
                  'div',
                  { className: 'fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-[10000]' },
                  React.createElement(
                      'div',
                      { className: 'bg-white rounded-xl shadow-xl w-full max-w-sm mx-auto overflow-hidden' },
                      ModalHeader,
                      SearchInput,
                      CodesList,
                      React.createElement(
                          'div',
                          { className: 'p-4 flex justify-end border-t border-gray-200' },
                          React.createElement(
                              'button',
                              { onClick: onClose, className: 'px-4 py-2 rounded-md text-gray-700 font-medium bg-gray-200 hover:bg-gray-300' },
                              'Zatvoriť'
                          )
                      )
                  )
              ),
              document.body
          )
        : null;
};

/**
 * Modálne okno pre zmenu profilu
 */
export const ChangeProfileModal = ({ show, onClose, onSaveSuccess, userProfileData, roleColor }) => {
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        contactPhoneNumber: '',
        email: ''
    });
    const [initialData, setInitialData] = useState({});
    const [loading, setLoading] = useState(false);
    const [hasAnyChanges, setHasAnyChanges] = useState(false);
    const [isReauthRequired, setIsReauthRequired] = useState(false);
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [emailChangeStatus, setEmailChangeStatus] = useState(null);
    const [showDialCodeModal, setShowDialCodeModal] = useState(false);
    const [selectedDialCode, setSelectedDialCode] = useState('+421'); // Predvolená predvoľba pre Slovensko
    const [emailError, setEmailError] = useState(null); // Nový stav pre chybu e-mailu
    const [reauthError, setReauthError] = useState(null); // Nový stav pre chybu overenia hesla
    const [passwordError, setPasswordError] = useState(null); // Nový stav pre chybu hesla

    const isUserAdmin = userProfileData.role === 'admin';

    useEffect(() => {
        if (show && userProfileData) {
            // Inicializácia formulára s pôvodnými dátami, aby boli predvyplnené
            setFormData({
                firstName: userProfileData.firstName || '',
                lastName: userProfileData.lastName || '',
                contactPhoneNumber: userProfileData.contactPhoneNumber || '',
                email: userProfileData.email || ''
            });

            // Uložíme pôvodné dáta pre porovnanie zmien
            const initialPhoneNumber = userProfileData.contactPhoneNumber || '';
            let dialCode = '+421';
            let phoneNumber = initialPhoneNumber;

            const sortedDialCodes = [...countryDialCodes].sort((a, b) => b.dialCode.length - a.dialCode.length);
            const foundDialCode = sortedDialCodes.find(c => initialPhoneNumber.startsWith(c.dialCode));

            if (foundDialCode) {
                dialCode = foundDialCode.dialCode;
                phoneNumber = initialPhoneNumber.substring(dialCode.length);
            }

            // Odstránenie medzier z pôvodného telefónneho čísla
            phoneNumber = phoneNumber.replace(/\s/g, '');

            setInitialData({
                firstName: userProfileData.firstName || '',
                lastName: userProfileData.lastName || '',
                contactPhoneNumber: phoneNumber,
                email: userProfileData.email || ''
            });
            setSelectedDialCode(dialCode);
            setHasAnyChanges(false);
            setIsReauthRequired(false);
            setPassword('');
            setEmailChangeStatus(null);
            setEmailError(null); // Reset chyby e-mailu pri otvorení modalu
            setReauthError(null); // Reset chyby overenia hesla
            setPasswordError(null); // Reset chyby hesla
        }
    }, [show, userProfileData]);

    // Kontrola zmien vo formulári
    useEffect(() => {
        if (show) {
            // Pred porovnaním odstránime medzery z oboch čísel
            const cleanedCurrentPhone = formData.contactPhoneNumber.replace(/\s/g, '');
            const cleanedInitialPhone = initialData.contactPhoneNumber;

            const hasFirstNameChanged = formData.firstName !== initialData.firstName;
            const hasLastNameChanged = formData.lastName !== initialData.lastName;
            const hasPhoneNumberChanged = isUserAdmin ? false : (cleanedCurrentPhone !== cleanedInitialPhone || selectedDialCode !== (initialData.contactPhoneNumber.startsWith(selectedDialCode) ? selectedDialCode : '+421'));
            const hasEmailChanged = formData.email !== initialData.email;

            const changes = hasFirstNameChanged || hasLastNameChanged || hasPhoneNumberChanged || hasEmailChanged;
            setHasAnyChanges(changes);

            // Podmienka pre odomknutie tlačidla
            // Tlačidlo je aktívne, ak nastala akákoľvek zmena a ak sa mení email, heslo musí mať min. 10 znakov
            const isEmailValid = formData.email === initialData.email || (validateEmail(formData.email) && formData.email.length >= 10);
            const isPasswordValid = hasEmailChanged ? password.length >= 10 : true;
            
            // Tlačidlo "Uložiť zmeny" je aktívne, ak nastala aspoň jedna zmena
            // a ak sa mení e-mail, heslo musí byť zadané a musí mať minimálne 10 znakov.
            const buttonEnabled = changes && (!hasEmailChanged || (isPasswordValid && password.length >= 10));

            // Nastavíme stav na základe validácie hesla
            if (hasEmailChanged && password.length > 0 && password.length < 10) {
                setPasswordError('Heslo musí mať aspoň 10 znakov.');
            } else {
                setPasswordError(null);
            }
        }
    }, [formData, initialData, selectedDialCode, show, password, isUserAdmin]);

    /**
     * Funkcia na formátovanie telefónneho čísla.
     * Prijíma iba číslice a pridáva medzeru po každých troch znakoch.
     */
    const formatPhoneNumber = (value) => {
        if (!value) return value;
        const onlyNums = value.replace(/[^\d]/g, ''); // Zoskupí číslice po troch a oddelí ich medzerou
        return onlyNums.match(/.{1,3}/g)?.join(' ') || '';
    };

    /**
     * Funkcia na validáciu formátu e-mailu.
     * Kontroluje:
     * - prítomnosť "@" a "."
     * - aspoň 1 znak po "@"
     * - aspoň 2 znaky po "."
     */
    const validateEmail = (email) => {
        // Regulačný výraz pre overenie formátu: "a@b.c" kde 'a', 'b' a 'c' majú aspoň určenú dĺžku.
        const emailRegex = new RegExp(/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/);
        return emailRegex.test(email);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'contactPhoneNumber') {
            // Odstránime nečíselné znaky
            const onlyNums = value.replace(/[^\d]/g, '');
            // Ak je dĺžka väčšia ako 9, skrátime na 9
            const maxLength = 9;
            const trimmedValue = onlyNums.length > maxLength ? onlyNums.substring(0, maxLength) : onlyNums;
            setFormData(prev => ({
                ...prev,
                [name]: formatPhoneNumber(trimmedValue)
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                [name]: value
            }));
        }

        // Ak sa zmení e-mail, skontrolujeme validáciu e-mailu a nastavíme emailError
        if (name === 'email') {
            if (value !== initialData.email) {
                if (validateEmail(value)) {
                    setEmailError(null);
                } else {
                    setEmailError('Zadajte platnú e-mailovú adresu.');
                }
            } else {
                setEmailError(null);
            }
        }
    };
    
    // Nová funkcia pre zmenu hesla
    const handlePasswordChange = (e) => {
        const newPassword = e.target.value;
        setPassword(newPassword);
    
        // Validácia hesla - aspoň 10 znakov
        if (formData.email !== initialData.email) {
            if (newPassword.length > 0 && newPassword.length < 10) {
                setPasswordError('Heslo musí mať aspoň 10 znakov.');
            } else {
                setPasswordError(null);
            }
        } else {
            setPasswordError(null);
        }
        setReauthError(null);
    };
    
    // Funkcia na prepínanie viditeľnosti hesla
    const toggleShowPassword = () => {
        setShowPassword(prev => !prev);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        setReauthError(null);

        const auth = getAuth();
        const user = auth.currentUser;
        const db = getFirestore();

        if (!user) {
            setLoading(false);
            console.error("Používateľ nie je prihlásený.");
            return;
        }

        // Overenie, či došlo k zmene e-mailu
        const hasEmailChanged = formData.email !== initialData.email;

        // Ak sa mení e-mail, vyžadujeme overenie hesla
        if (hasEmailChanged) {
            if (!password || password.length < 10) {
                setLoading(false);
                setPasswordError('Heslo je povinné a musí mať aspoň 10 znakov pre zmenu e-mailu.');
                return;
            }

            try {
                const credential = EmailAuthProvider.credential(user.email, password);
                await reauthenticateWithCredential(user, credential);
                
                // Ak je overenie úspešné, pokračujeme so zmenou e-mailu
                await verifyBeforeUpdateEmail(user, formData.email);
                setEmailChangeStatus('overenie');

                // Aktualizácia ostatných údajov vo Firestore
                const userDocRef = doc(db, 'users', user.uid);
                const updatedFields = {};

                if (formData.firstName !== initialData.firstName) updatedFields.firstName = formData.firstName;
                if (formData.lastName !== initialData.lastName) updatedFields.lastName = formData.lastName;
                
                // Aktualizujeme telefónne číslo iba ak používateľ nie je admin
                if (!isUserAdmin) {
                    const cleanedCurrentPhone = formData.contactPhoneNumber.replace(/\s/g, '');
                    const cleanedInitialPhone = initialData.contactPhoneNumber;

                    if (cleanedCurrentPhone !== cleanedInitialPhone || selectedDialCode !== (initialData.contactPhoneNumber.startsWith(selectedDialCode) ? selectedDialCode : '+421')) {
                        updatedFields.contactPhoneNumber = `${selectedDialCode}${cleanedCurrentPhone}`;
                    }
                }

                if (Object.keys(updatedFields).length > 0) {
                    await updateDoc(userDocRef, updatedFields);
                }
                
                onSaveSuccess();
            } catch (error) {
                setLoading(false);
                console.error("Chyba pri overení hesla alebo zmene e-mailu:", error);
                
                if (error.code === 'auth/wrong-password') {
                    setReauthError('Zadali ste nesprávne používateľské meno alebo heslo. Skúste to znova.');
                } else {
                    setReauthError(`Chyba: ${error.message}`);
                }
                return;
            }
        } else {
            // Ak sa e-mail nemení, aktualizujeme len ostatné údaje
            try {
                const userDocRef = doc(db, 'users', user.uid);
                const updatedFields = {};

                if (formData.firstName !== initialData.firstName) updatedFields.firstName = formData.firstName;
                if (formData.lastName !== initialData.lastName) updatedFields.lastName = formData.lastName;
                
                // Aktualizujeme telefónne číslo iba ak používateľ nie je admin
                if (!isUserAdmin) {
                    const cleanedCurrentPhone = formData.contactPhoneNumber.replace(/\s/g, '');
                    const cleanedInitialPhone = initialData.contactPhoneNumber;

                    if (cleanedCurrentPhone !== cleanedInitialPhone || selectedDialCode !== (initialData.contactPhoneNumber.startsWith(selectedDialCode) ? selectedDialCode : '+421')) {
                        updatedFields.contactPhoneNumber = `${selectedDialCode}${cleanedCurrentPhone}`;
                    }
                }

                if (Object.keys(updatedFields).length > 0) {
                    await updateDoc(userDocRef, updatedFields);
                }

                onSaveSuccess();
            } catch (error) {
                setLoading(false);
                console.error("Chyba pri aktualizácii profilu:", error);
                // Tu môžete zobraziť notifikáciu o chybe
                window.showGlobalNotification(`Chyba pri ukladaní údajov: ${error.message}`, 'error');
            }
        }
        setLoading(false);
    };

    const isEmailValidForSubmit = formData.email === initialData.email || (validateEmail(formData.email) && !emailError);

    const isButtonDisabled = !hasAnyChanges || loading || emailError || (formData.email !== initialData.email && (password.length < 10 || passwordError));


    const ModalHeader = React.createElement(
        'div',
        { className: `px-6 py-4 rounded-t-xl text-white`, style: { backgroundColor: roleColor } },
        React.createElement('h3', { className: 'text-lg font-bold' }, 'Upraviť profil')
    );

    const ModalContent = React.createElement(
        'form',
        { className: 'p-6', onSubmit: handleSave },
        // Zobrazíme notifikáciu, ak sa čaká na overenie e-mailu
        emailChangeStatus === 'overenie' && React.createElement(
            'div',
            { className: 'p-4 mb-4 text-sm text-green-700 bg-green-100 rounded-lg', role: 'alert' },
            'Na novú e-mailovú adresu bol odoslaný potvrdzovací e-mail. Pre dokončenie zmeny kliknite na odkaz v ňom.'
        ),
        // Zobrazíme notifikáciu o chybe overenia hesla
        reauthError && React.createElement(
            'div',
            { className: 'p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg', role: 'alert' },
            reauthError
        ),
        // Formulárové polia
        React.createElement(
            'div',
            { className: 'grid grid-cols-1 md:grid-cols-2 gap-4 mb-4' },
            // Meno
            React.createElement(
                'div',
                { className: 'mb-4' },
                React.createElement(
                    'label',
                    { htmlFor: 'firstName', className: 'block text-sm font-medium text-gray-700' },
                    'Meno'
                ),
                React.createElement(
                    'input',
                    {
                        type: 'text',
                        id: 'firstName',
                        name: 'firstName',
                        value: formData.firstName,
                        onChange: handleChange,
                        className: `mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-0 sm:text-sm`,
                        style: { 'borderColor': roleColor }
                    }
                )
            ),
            // Priezvisko
            React.createElement(
                'div',
                { className: 'mb-4' },
                React.createElement(
                    'label',
                    { htmlFor: 'lastName', className: 'block text-sm font-medium text-gray-700' },
                    'Priezvisko'
                ),
                React.createElement(
                    'input',
                    {
                        type: 'text',
                        id: 'lastName',
                        name: 'lastName',
                        value: formData.lastName,
                        onChange: handleChange,
                        className: `mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-0 sm:text-sm`,
                        style: { 'borderColor': roleColor }
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
                { htmlFor: 'email', className: 'block text-sm font-medium text-gray-700' },
                'E-mailová adresa'
            ),
            React.createElement(
                'input',
                {
                    type: 'email',
                    id: 'email',
                    name: 'email',
                    value: formData.email,
                    onChange: handleChange,
                    className: `mt-1 block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-0 sm:text-sm ${emailError ? 'border-red-500' : 'border-gray-300'}`,
                    style: { 'borderColor': emailError ? '#ef4444' : roleColor }
                }
            ),
            emailError && React.createElement(
                'p',
                { className: 'mt-2 text-sm text-red-600' },
                emailError
            )
        ),
        // Pole pre heslo, ktoré sa zobrazí, ak sa zmení email
        formData.email !== initialData.email && React.createElement(
            'div',
            { className: 'mb-4' },
            React.createElement(
                PasswordInput,
                {
                    id: 'password',
                    label: 'Heslo pre overenie zmeny e-mailu',
                    value: password,
                    onChange: handlePasswordChange,
                    placeholder: 'Zadajte heslo',
                    showPassword: showPassword,
                    toggleShowPassword: toggleShowPassword,
                    roleColor: roleColor
                }
            ),
            passwordError && React.createElement(
                'p',
                { className: 'mt-2 text-sm text-red-600' },
                passwordError
            )
        ),
        // Telefónne číslo - zobrazí sa len ak používateľ nie je admin
        !isUserAdmin && React.createElement(
            'div',
            { className: 'mb-6' },
            React.createElement(
                'label',
                { htmlFor: 'contactPhoneNumber', className: 'block text-sm font-medium text-gray-700' },
                'Telefónne číslo'
            ),
            React.createElement(
                'div',
                { className: 'mt-1 relative rounded-md shadow-sm' },
                React.createElement(
                    'div',
                    { className: 'absolute inset-y-0 left-0 flex items-center' },
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: () => setShowDialCodeModal(true),
                            className: 'flex items-center gap-1 h-full py-0 pl-3 pr-2 text-gray-500 bg-gray-50 rounded-l-md border border-r-0 border-gray-300 hover:bg-gray-100 transition-colors duration-200'
                        },
                        selectedDialCode,
                        React.createElement(
                            'svg',
                            { xmlns: 'http://www.w3.org/2000/svg', className: 'h-4 w-4', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                            React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M19 9l-7 7-7-7' })
                        )
                    )
                ),
                React.createElement(
                    'input',
                    {
                        type: 'text',
                        id: 'contactPhoneNumber',
                        name: 'contactPhoneNumber',
                        value: formData.contactPhoneNumber,
                        onChange: handleChange,
                        className: `block w-full pl-[5.5rem] pr-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-0 sm:text-sm`,
                        placeholder: '9xx xxx xxx',
                        maxLength: 11,
                        style: { 'borderColor': roleColor }
                    }
                )
            )
        ),
        React.createElement(
            'div',
            { className: 'flex justify-end space-x-3' },
            React.createElement(
                'button',
                {
                    type: 'button',
                    onClick: onClose,
                    className: 'px-6 py-2 rounded-lg font-medium transition-colors duration-200 bg-gray-200 text-gray-700 hover:bg-gray-300'
                },
                'Zrušiť'
            ),
            React.createElement(
                'button',
                {
                    type: 'submit',
                    disabled: isButtonDisabled,
                    className: `px-6 py-2 rounded-lg font-medium transition-colors duration-200 ${isButtonDisabled ? 'cursor-not-allowed' : ''}`,
                    style: isButtonDisabled
                        ? {
                              backgroundColor: 'white',
                              color: roleColor,
                              border: `2px solid ${roleColor}`,
                          }
                        : {
                              backgroundColor: roleColor,
                              color: 'white',
                              border: 'none',
                          }
                },
                loading ? 'Ukladám...' : 'Uložiť zmeny'
            )
        ),
        React.createElement(DialCodeModal, {
            show: showDialCodeModal,
            onClose: () => setShowDialCodeModal(false),
            onSelect: (code) => setSelectedDialCode(code),
            selectedDialCode: selectedDialCode,
            roleColor: roleColor
        })
    );

    const modal = React.createElement(
        'div',
        { className: 'fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-[10000]' },
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-xl w-full max-w-lg mx-auto overflow-hidden' },
            ModalHeader,
            ModalContent
        )
    );

    return ReactDOM.createPortal(modal, document.body);
};
