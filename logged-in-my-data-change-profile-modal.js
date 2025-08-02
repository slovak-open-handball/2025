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
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.274-4.057 5.064-7 9.542-7a10.05 10.05 0 011.875.175M16.99 16.99L21.5 21.5M10.125 7.125L12 9M7.5 12a4.5 4.5 0 119 0' })
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
                className: `mt-1 block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none sm:text-sm ${
                    disabled ? 'bg-gray-100 border-gray-200' : 'border-gray-300 focus:ring-2 focus:ring-offset-1'
                }`,
                style: disabled ? {} : { 'border-color': roleColor, 'ring-color': roleColor }
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
                className: 'w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-1',
                style: { 'focus-ring-color': roleColor }
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

    useEffect(() => {
        if (show && userProfileData) {
            // Inicializácia formulára s existujúcimi dátami
            const initialPhoneNumber = userProfileData.contactPhoneNumber || '';
            let dialCode = '+421'; // Predvolená predvoľba
            let phoneNumber = initialPhoneNumber;

            // Nájdeme predvoľbu v zozname
            // Najprv zoradíme predvoľby od najdlhšej, aby sme správne identifikovali napr. +421 a nie len +4
            const sortedDialCodes = [...countryDialCodes].sort((a, b) => b.dialCode.length - a.dialCode.length);
            const foundDialCode = sortedDialCodes.find(c => initialPhoneNumber.startsWith(c.dialCode));

            if (foundDialCode) {
                dialCode = foundDialCode.dialCode;
                phoneNumber = initialPhoneNumber.substring(dialCode.length);
            }

            const initialFormData = {
                firstName: userProfileData.firstName || '',
                lastName: userProfileData.lastName || '',
                contactPhoneNumber: phoneNumber,
                email: userProfileData.email || ''
            };
            setFormData(initialFormData);
            setInitialData(initialFormData);
            setSelectedDialCode(dialCode);
            setHasAnyChanges(false);
            setIsReauthRequired(false);
            setPassword('');
            setEmailChangeStatus(null);
        }
    }, [show, userProfileData]);

    // Kontrola zmien vo formulári
    useEffect(() => {
        if (show) {
            const currentFullPhoneNumber = selectedDialCode + formData.contactPhoneNumber;
            const initialFullPhoneNumber = initialData.contactPhoneNumber ? initialData.contactPhoneNumber : (initialData.dialCode + initialData.contactPhoneNumber);

            const changes =
                formData.firstName !== initialData.firstName ||
                formData.lastName !== initialData.lastName ||
                currentFullPhoneNumber !== initialFullPhoneNumber ||
                (formData.email !== initialData.email && password); // Zmena: zmena emailu sa považuje za zmenu iba vtedy, ak je zadané heslo

            setHasAnyChanges(changes);

            // Kontrola, či sa zmenil e-mail pre potrebu re-autentifikácie
            if (formData.email !== initialData.email) {
                setIsReauthRequired(true);
            } else {
                setIsReauthRequired(false);
            }
        }
    }, [formData, initialData, selectedDialCode, show, password]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prevData => ({ ...prevData, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        const auth = getAuth();
        const db = getFirestore();
        const user = auth.currentUser;

        if (!user) {
            window.showGlobalNotification("Používateľ nie je prihlásený.", "error");
            setLoading(false);
            return;
        }

        try {
            // Re-autentifikácia, ak je potrebná zmena e-mailu
            if (isReauthRequired) {
                const credential = EmailAuthProvider.credential(user.email, password);
                await reauthenticateWithCredential(user, credential);
            }

            // Aktualizácia profilu vo Firestore
            const userDocRef = doc(db, 'users', user.uid);
            await updateDoc(userDocRef, {
                firstName: formData.firstName,
                lastName: formData.lastName,
                contactPhoneNumber: selectedDialCode + formData.contactPhoneNumber,
            });

            // Aktualizácia e-mailu vo Firebase Auth, ak sa zmenil
            if (isReauthRequired) {
                await verifyBeforeUpdateEmail(user, formData.email);
                setEmailChangeStatus('overenie_odoslané');
            }

            onSaveSuccess();

        } catch (error) {
            console.error("Chyba pri aktualizácii profilu:", error);
            if (error.code === 'auth/wrong-password') {
                window.showGlobalNotification("Zadali ste nesprávne heslo.", "error");
            } else if (error.code === 'auth/email-already-in-use') {
                window.showGlobalNotification("Zadaný e-mail sa už používa.", "error");
            } else {
                window.showGlobalNotification(`Chyba pri aktualizácii: ${error.message}`, "error");
            }
        } finally {
            setLoading(false);
        }
    };

    if (!show) return null;

    const modal = React.createElement(
        'div',
        { className: 'fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-[10000] p-4 sm:p-0' },
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-xl w-full max-w-lg mx-auto overflow-hidden animate-fade-in-down' },
            // Modal header s dynamickou farbou
            React.createElement(
                'div',
                { style: { backgroundColor: roleColor }, className: `px-6 py-4 flex justify-between items-center rounded-t-xl` },
                React.createElement('h3', { className: 'text-lg font-bold text-white' }, 'Upraviť údaje'),
                React.createElement(
                    'button',
                    { onClick: onClose, className: 'text-white hover:text-gray-200' },
                    React.createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', className: 'h-6 w-6', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                      React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M6 18L18 6M6 6l12 12' })
                    )
                )
            ),
            // Modal body
            React.createElement(
                'form',
                { onSubmit: handleSubmit, className: 'p-6' },
                React.createElement(
                    'div',
                    { className: 'grid grid-cols-1 gap-y-4' },
                    React.createElement(
                        'div',
                        null,
                        React.createElement(
                            'label',
                            { htmlFor: 'firstName', className: 'block text-sm font-medium text-gray-700' },
                            'Meno'
                        ),
                        React.createElement('input', {
                            type: 'text',
                            id: 'firstName',
                            name: 'firstName',
                            value: formData.firstName,
                            onChange: handleChange,
                            className: 'mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:border-transparent sm:text-sm',
                            style: { 'focus-ring-color': roleColor }
                        })
                    ),
                    React.createElement(
                        'div',
                        null,
                        React.createElement(
                            'label',
                            { htmlFor: 'lastName', className: 'block text-sm font-medium text-gray-700' },
                            'Priezvisko'
                        ),
                        React.createElement('input', {
                            type: 'text',
                            id: 'lastName',
                            name: 'lastName',
                            value: formData.lastName,
                            onChange: handleChange,
                            className: 'mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:border-transparent sm:text-sm',
                            style: { 'focus-ring-color': roleColor }
                        })
                    ),
                    React.createElement(
                        'div',
                        null,
                        React.createElement(
                            'label',
                            { htmlFor: 'contactPhoneNumber', className: 'block text-sm font-medium text-gray-700' },
                            'Telefónne číslo'
                        ),
                        React.createElement(
                            'div',
                            { className: 'mt-1 flex rounded-md shadow-sm' },
                            React.createElement(
                                'div',
                                { className: 'relative' },
                                React.createElement(
                                    'button',
                                    {
                                        type: 'button',
                                        onClick: () => setShowDialCodeModal(true),
                                        className: 'inline-flex items-center px-3 py-2 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm hover:bg-gray-100 transition-colors duration-200'
                                    },
                                    selectedDialCode
                                )
                            ),
                            React.createElement('input', {
                                type: 'text',
                                id: 'contactPhoneNumber',
                                name: 'contactPhoneNumber',
                                value: formData.contactPhoneNumber,
                                onChange: handleChange,
                                className: 'flex-1 block w-full rounded-none rounded-r-md px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-1 sm:text-sm',
                                style: { 'focus-ring-color': roleColor }
                            })
                        )
                    ),
                    React.createElement(
                        'div',
                        null,
                        React.createElement(
                            'label',
                            { htmlFor: 'email', className: 'block text-sm font-medium text-gray-700' },
                            'E-mailová adresa'
                        ),
                        React.createElement('input', {
                            type: 'email',
                            id: 'email',
                            name: 'email',
                            value: formData.email,
                            onChange: handleChange,
                            className: 'mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:border-transparent sm:text-sm',
                            style: { 'focus-ring-color': roleColor }
                        })
                    ),
                    React.createElement(PasswordInput, {
                        id: "password",
                        label: "Heslo pre potvrdenie",
                        value: password,
                        onChange: (e) => setPassword(e.target.value),
                        placeholder: "Zadajte vaše heslo",
                        showPassword: showPassword,
                        toggleShowPassword: () => setShowPassword(!showPassword),
                        disabled: loading,
                        roleColor: roleColor
                    }),
                    emailChangeStatus === 'overenie_odoslané' && React.createElement(
                        'div',
                        { className: 'mt-4 text-sm text-yellow-600' },
                        'Potvrdenie e-mailu: Overovací e-mail bol odoslaný na vašu novú adresu. Ak ho nevidíte, skontrolujte spamovú zložku.'
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'mt-6 flex justify-end gap-2' },
                    // Tlačidlo "Zrušiť" má pevnú bledosivú farbu pozadia
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: onClose,
                            className: 'px-6 py-2 rounded-lg text-gray-800 font-medium bg-gray-200 hover:bg-gray-300 transition-colors duration-200'
                        },
                        'Zrušiť'
                    ),
                    // Tlačidlo "Uložiť zmeny" má dynamické štýly podľa stavu a roly
                    React.createElement(
                        'button',
                        {
                            type: 'submit',
                            disabled: loading || !hasAnyChanges,
                            className: `px-6 py-2 rounded-lg font-medium transition-colors duration-200 ${loading || !hasAnyChanges ? 'cursor-not-allowed' : ''}`,
                            style: loading || !hasAnyChanges
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
    );
    return ReactDOM.createPortal(modal, document.body);
};
