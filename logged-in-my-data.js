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
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M2.458 12C3.73...'})
    );
    const EyeSlashIcon = React.createElement(
        'svg',
        { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.92-9.547-7-1.279-4.08 2.404-7.531 5.922-7.531h.001c1.233 0 2.441.385 3.535 1.157M16.125 18.825A10.05 10.05 0 0018 19c4.478 0 8.268-2.92 9.547-7 1.279-4.08-2.404-7.531-5.922-7.531h-.001c-1.233 0-2.441.385-3.535 1.157M12 16a4 4 0 100-8 4 4 0 000 8z' }),
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' })
    );

    return React.createElement(
        'div',
        { className: 'mb-4' },
        React.createElement(
            'label',
            { htmlFor: id, className: 'block text-sm font-medium text-gray-700' },
            label
        ),
        React.createElement(
            'div',
            { className: 'relative mt-1 rounded-md shadow-sm' },
            React.createElement(
                'input',
                {
                    type: showPassword ? 'text' : 'password',
                    id: id,
                    name: id,
                    value: value,
                    onChange: onChange,
                    placeholder: placeholder,
                    disabled: disabled,
                    className: 'block w-full rounded-md border-gray-300 pr-10 focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed px-3 py-2' + (disabled ? ' border-gray-200' : ' border-gray-300'),
                }
            ),
            React.createElement(
                'div',
                { className: 'absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5' },
                React.createElement(
                    'button',
                    {
                        type: 'button',
                        onClick: toggleShowPassword,
                        className: 'focus:outline-none'
                    },
                    showPassword ? EyeSlashIcon : EyeIcon
                )
            )
        )
    );
};

/**
 * Komponent pre zobrazenie modálneho okna pre výber predvolieb krajín.
 */
export const DialCodeModal = ({ show, onClose, onSelect, selectedDialCode, roleColor }) => {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredCodes = countryDialCodes.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.dialCode.includes(searchQuery)
    ).sort((a, b) => a.name.localeCompare(b.name));

    if (!show) return null;

    const modalContent = React.createElement(
        'div',
        { className: 'bg-white rounded-xl shadow-xl w-full max-w-sm mx-auto overflow-hidden' },
        // Modal Header
        React.createElement(
            'div',
            { className: 'px-6 py-4 flex justify-between items-center', style: { backgroundColor: roleColor } },
            React.createElement(
                'h3',
                { className: 'text-lg font-semibold text-white' },
                'Vybrať predvoľbu krajiny'
            ),
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
        // Search Input
        React.createElement(
            'div',
            { className: 'p-4' },
            React.createElement(
                'input',
                {
                    type: 'text',
                    value: searchQuery,
                    onChange: (e) => setSearchQuery(e.target.value),
                    placeholder: 'Vyhľadať krajinu...',
                    className: 'w-full px-3 py-2 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500'
                }
            )
        ),
        // Dial Code List
        React.createElement(
            'div',
            { className: 'overflow-y-auto max-h-80 px-4 pb-4' },
            filteredCodes.map((code) =>
                React.createElement(
                    'div',
                    {
                        key: code.code,
                        onClick: () => { onSelect(code.dialCode); onClose(); },
                        className: `flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors duration-200 ${selectedDialCode === code.dialCode ? `bg-gray-200` : 'hover:bg-gray-100'}`
                    },
                    React.createElement(
                        'span',
                        { className: 'font-medium text-gray-800' },
                        `${code.name} (${code.dialCode})`
                    )
                )
            )
        )
    );

    return ReactDOM.createPortal(
        React.createElement(
            'div',
            {
                className: 'fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-[10001]',
                onClick: (e) => e.target === e.currentTarget && onClose(),
            },
            modalContent
        ),
        document.body
    );
};


/**
 * Komponent pre modálne okno na zmenu profilových údajov používateľa.
 */
export const ChangeProfileModal = ({ show, onClose, onSaveSuccess, userProfileData, roleColor }) => {
    const [formData, setFormData] = useState({
        firstName: userProfileData?.firstName || '',
        lastName: userProfileData?.lastName || '',
        email: userProfileData?.email || '',
        phoneNumber: userProfileData?.phoneNumber || '',
        password: '',
    });
    const [passwordConfirm, setPasswordConfirm] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedDialCode, setSelectedDialCode] = useState(() => {
        // Inicializácia predvoľby z telefónneho čísla
        if (userProfileData?.phoneNumber) {
            const phoneNumber = userProfileData.phoneNumber;
            for (const code of countryDialCodes) {
                if (phoneNumber.startsWith(code.dialCode)) {
                    return code.dialCode;
                }
            }
        }
        return '+421'; // Predvolená hodnota
    });
    const [showDialCodeModal, setShowDialCodeModal] = useState(false);
    const auth = getAuth();
    const db = getFirestore();

    // Efekt na aktualizáciu formulára, keď sa zmenia dáta používateľa
    useEffect(() => {
        if (userProfileData) {
            setFormData({
                firstName: userProfileData.firstName || '',
                lastName: userProfileData.lastName || '',
                email: userProfileData.email || '',
                phoneNumber: userProfileData.phoneNumber || '',
                password: '',
            });
            setPasswordConfirm('');
            setError('');
            // Aktualizácia dial code, ak sa zmení telefónne číslo
            if (userProfileData.phoneNumber) {
                const phoneNumber = userProfileData.phoneNumber;
                let foundCode = '+421';
                for (const code of countryDialCodes) {
                    if (phoneNumber.startsWith(code.dialCode)) {
                        foundCode = code.dialCode;
                        break;
                    }
                }
                setSelectedDialCode(foundCode);
            }
        }
    }, [userProfileData]);

    const handleFormChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const isFormValid = () => {
        if (!formData.firstName || !formData.lastName) {
            setError('Meno a priezvisko sú povinné polia.');
            return false;
        }

        if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            setError('Zadali ste neplatnú e-mailovú adresu.');
            return false;
        }

        if (formData.password && formData.password.length < 6) {
            setError('Heslo musí mať aspoň 6 znakov.');
            return false;
        }

        if (formData.password !== passwordConfirm) {
            setError('Heslá sa nezhodujú.');
            return false;
        }

        if (userProfileData.role !== 'admin' && formData.phoneNumber && !/^\d+$/.test(formData.phoneNumber)) {
            setError('Telefónne číslo môže obsahovať iba číslice.');
            return false;
        }

        setError('');
        return true;
    };
    
    const isFormChanged = () => {
        // Porovnanie s pôvodnými dátami
        const isFirstNameChanged = formData.firstName !== userProfileData.firstName;
        const isLastNameChanged = formData.lastName !== userProfileData.lastName;
        const isEmailChanged = formData.email !== userProfileData.email;
        const isPhoneNumberChanged = userProfileData.role !== 'admin' && (formData.phoneNumber ? `${selectedDialCode} ${formData.phoneNumber}` : '') !== userProfileData.phoneNumber;
        const isPasswordChanged = formData.password.length > 0;
        
        return isFirstNameChanged || isLastNameChanged || isEmailChanged || isPhoneNumberChanged || isPasswordChanged;
    };

    const handleSave = async () => {
        if (!isFormValid()) {
            return;
        }

        setLoading(true);
        const user = auth.currentUser;
        if (!user) {
            window.showGlobalNotification('Používateľ nie je prihlásený.', 'error');
            setLoading(false);
            return;
        }

        const userDocRef = doc(db, 'users', user.uid);
        const updates = {};
        let emailChanged = false;

        if (formData.firstName !== userProfileData.firstName) updates.firstName = formData.firstName;
        if (formData.lastName !== userProfileData.lastName) updates.lastName = formData.lastName;
        
        // Formátovanie telefónneho čísla
        const newPhoneNumber = formData.phoneNumber ? `${selectedDialCode} ${formData.phoneNumber}` : '';
        if (userProfileData.role !== 'admin' && newPhoneNumber !== userProfileData.phoneNumber) {
            updates.phoneNumber = newPhoneNumber;
        }

        try {
            // Re-autentifikácia je potrebná na citlivé zmeny, ako je e-mail
            if (formData.email && formData.email !== user.email) {
                if (!formData.password) {
                    setError('Pre zmenu e-mailu musíte zadať aktuálne heslo.');
                    setLoading(false);
                    return;
                }
                const credential = EmailAuthProvider.credential(user.email, formData.password);
                await reauthenticateWithCredential(user, credential);
                emailChanged = true;
                await verifyBeforeUpdateEmail(user, formData.email);
            }
            
            // Aktualizácia Firestore
            if (Object.keys(updates).length > 0) {
                 await updateDoc(userDocRef, updates);
            }
           
            setLoading(false);
            onSaveSuccess();
            window.showGlobalNotification('Profilové údaje boli úspešne zmenené.', 'success');
            
            if (emailChanged) {
                window.showGlobalNotification('Na zadanú e-mailovú adresu bol odoslaný overovací e-mail. Pre dokončenie zmeny e-mailu je potrebné ju overiť.', 'info');
            }

        } catch (err) {
            console.error("Chyba pri ukladaní profilu:", err);
            setLoading(false);

            if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                setError('Zadali ste nesprávne používateľské meno alebo heslo. Skúste to znova.');
            } else if (err.code === 'auth/email-already-in-use') {
                 setError('Táto e-mailová adresa je už používaná iným účtom.');
            } else {
                 setError('Nepodarilo sa uložiť zmeny. Skúste to prosím neskôr.');
            }
        }
    };

    // Vytvorenie hlavičky modálneho okna
    const ModalHeader = React.createElement(
        'div',
        { className: 'px-6 py-4 flex justify-between items-center', style: { backgroundColor: roleColor } },
        React.createElement(
            'h3',
            { className: 'text-lg font-semibold text-white' },
            'Upraviť profil'
        ),
        React.createElement(
            'button',
            { onClick: onClose, className: 'text-white hover:text-gray-200' },
            React.createElement(
                'svg',
                { className: 'h-6 w-6', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M6 18L18 6M6 6l12 12' })
            )
        )
    );

    // Vytvorenie obsahu modálneho okna
    const ModalContent = React.createElement(
        'div',
        { className: 'p-6 space-y-6' },
        error && React.createElement(
            'div',
            { className: 'bg-red-100 text-red-800 p-3 rounded-lg mb-4 text-sm' },
            error
        ),
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
                    onChange: handleFormChange,
                    className: 'mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2' // Pridaná trieda pre výšku
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
                    onChange: handleFormChange,
                    className: 'mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2' // Pridaná trieda pre výšku
                }
            )
        ),
        // E-mail
        React.createElement(
            'div',
            { className: 'mb-4' },
            React.createElement(
                'label',
                { htmlFor: 'email', className: 'block text-sm font-medium text-gray-700' },
                'E-mailová adresa kontaktnej osoby'
            ),
            React.createElement(
                'input',
                {
                    type: 'email',
                    id: 'email',
                    name: 'email',
                    value: formData.email,
                    onChange: handleFormChange,
                    className: 'mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2' // Pridaná trieda pre výšku
                }
            )
        ),
        // Telefónne číslo
        userProfileData.role !== 'admin' && React.createElement(
            'div',
            { className: 'mb-4' },
            React.createElement(
                'label',
                { htmlFor: 'phoneNumber', className: 'block text-sm font-medium text-gray-700' },
                'Telefónne číslo'
            ),
            React.createElement(
                'div',
                { className: 'mt-1 flex rounded-md shadow-sm' },
                React.createElement(
                    'span',
                    {
                        className: `inline-flex items-center px-3 py-2 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm cursor-pointer`, // Upravené py-2
                        style: { backgroundColor: roleColor, color: 'white' },
                        onClick: () => setShowDialCodeModal(true)
                    },
                    selectedDialCode
                ),
                React.createElement(
                    'input',
                    {
                        type: 'tel',
                        id: 'phoneNumber',
                        name: 'phoneNumber',
                        value: formData.phoneNumber.replace(selectedDialCode + ' ', ''),
                        onChange: handleFormChange,
                        className: 'flex-1 block w-full rounded-none rounded-r-md border-gray-300 focus:border-blue-500 focus:ring-blue-500 px-3 py-2' // Upravené py-2
                    }
                )
            )
        ),
        // Potvrdenie hesla pre zmenu e-mailu
        React.createElement(PasswordInput, {
            id: 'password',
            label: 'Aktuálne heslo (pre zmenu e-mailu)',
            value: formData.password,
            onChange: handleFormChange,
            placeholder: 'Zadajte vaše heslo',
            showPassword: showPassword,
            toggleShowPassword: () => setShowPassword(!showPassword),
            disabled: loading,
            roleColor: roleColor
        }),
        React.createElement(PasswordInput, {
            id: 'passwordConfirm',
            label: 'Potvrdenie hesla',
            value: passwordConfirm,
            onChange: (e) => setPasswordConfirm(e.target.value),
            placeholder: 'Zopakujte heslo',
            showPassword: showPasswordConfirm,
            toggleShowPassword: () => setShowPasswordConfirm(!showPasswordConfirm),
            disabled: loading,
            roleColor: roleColor
        }),
        // Tlačidlá akcie
        React.createElement(
            'div',
            { className: 'flex justify-end space-x-4 mt-6' },
            React.createElement(
                'button',
                {
                    type: 'button',
                    onClick: onClose,
                    disabled: loading,
                    className: 'px-6 py-3 rounded-xl font-semibold transition-all duration-300',
                    style: loading
                        ? {
                              backgroundColor: 'white',
                              color: roleColor,
                              border: `2px solid ${roleColor}`,
                          }
                        : {
                              backgroundColor: 'white',
                              color: roleColor,
                              border: `2px solid ${roleColor}`,
                          }
                },
                'Zrušiť'
            ),
            React.createElement(
                'button',
                {
                    type: 'button',
                    onClick: handleSave,
                    disabled: loading || !isFormChanged(),
                    className: `px-6 py-3 rounded-xl font-semibold shadow-md transition-all duration-300 transform disabled:opacity-50 ${!loading && isFormChanged() ? 'hover:scale-105' : ''}`,
                    style: {
                        backgroundColor: (loading || !isFormChanged()) ? 'white' : roleColor,
                        color: (loading || !isFormChanged()) ? roleColor : 'white',
                        border: (loading || !isFormChanged()) ? `2px solid ${roleColor}` : 'none',
                        cursor: (loading || !isFormChanged()) ? 'not-allowed' : 'pointer',
                    }
                },
                loading ? 'Ukladám...' : 'Uložiť zmeny'
            )
        ),
        React.createElement(DialCodeModal, {
            show: showDialCodeModal,
            onClose: () => setShowDialCodeModal(false),
            onSelect: (code) => {
                setSelectedDialCode(code);
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
