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
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.274-4.057 5.064-7 9.542-7a10.05 10.05 0 015.875 1.95M15 12a3 3 0 11-6 0 3 3 0 016 0z' }),
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M19.95 12.35l-7.39 7.39M4.05 12.35l7.39-7.39' })
    );

    return React.createElement(
        'div',
        { className: 'mb-4 relative' },
        React.createElement('label', { htmlFor: id, className: 'block text-sm font-medium text-gray-700' }, label),
        React.createElement(
            'div',
            { className: 'mt-1 relative rounded-md shadow-sm' },
            React.createElement('input', {
                type: showPassword ? 'text' : 'password',
                id: id,
                name: id,
                value: value,
                onChange: onChange,
                placeholder: placeholder,
                disabled: disabled,
                className: `block w-full rounded-md border-gray-300 pr-10 focus:ring-${roleColor} focus:border-${roleColor} sm:text-sm pl-4 py-2 h-10 ${disabled ? 'bg-gray-100' : ''}`, // <-- Upravené triedy
                style: { borderColor: disabled ? '#E5E7EB' : roleColor + '60' }
            }),
            React.createElement(
                'div',
                {
                    className: 'absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer',
                    onClick: toggleShowPassword
                },
                showPassword ? EyeIcon : EyeOffIcon
            )
        )
    );
};

/**
 * Komponent pre výber predvoľby telefónneho čísla
 */
export const DialCodeModal = ({ show, onClose, onSelect, selectedDialCode, roleColor }) => {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredDialCodes = countryDialCodes.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.dialCode.includes(searchQuery)
    );

    const ModalContent = React.createElement(
        'div',
        { className: 'p-4' },
        React.createElement(
            'input',
            {
                type: 'text',
                placeholder: 'Hľadať krajinu alebo kód...',
                className: `w-full px-4 py-2 mb-4 border rounded-md focus:outline-none focus:ring-2 focus:ring-${roleColor}`,
                value: searchQuery,
                onChange: (e) => setSearchQuery(e.target.value)
            }
        ),
        React.createElement(
            'ul',
            { className: 'max-h-60 overflow-y-auto' },
            filteredDialCodes.map(c =>
                React.createElement(
                    'li',
                    {
                        key: c.code,
                        className: `flex justify-between items-center px-4 py-2 cursor-pointer hover:bg-gray-100 rounded-md ${selectedDialCode === c.dialCode ? 'bg-gray-200' : ''}`,
                        onClick: () => {
                            onSelect(c.dialCode);
                            onClose();
                        }
                    },
                    React.createElement('span', { className: 'font-medium' }, c.name),
                    React.createElement('span', { className: 'text-gray-500' }, c.dialCode)
                )
            )
        )
    );

    if (!show) return null;

    return ReactDOM.createPortal(
        React.createElement(
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
                { className: 'bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 overflow-hidden' },
                React.createElement(
                    'div',
                    { className: 'flex justify-between items-center p-4 border-b' },
                    React.createElement('h3', { className: 'text-xl font-bold' }, 'Vybrať predvoľbu'),
                    React.createElement(
                        'button',
                        { onClick: onClose, className: 'text-gray-400 hover:text-gray-600' },
                        React.createElement('span', { className: 'text-2xl' }, '×')
                    )
                ),
                ModalContent
            )
        ),
        document.body
    );
};

/**
 * Hlavný komponent modálneho okna pre zmenu profilu.
 */
export const ChangeProfileModal = ({ show, onClose, onSaveSuccess, userProfileData, roleColor }) => {
    const [firstName, setFirstName] = useState(userProfileData.firstName || '');
    const [lastName, setLastName] = useState(userProfileData.lastName || '');
    const [email, setEmail] = useState(userProfileData.email || '');
    const [phoneNumber, setPhoneNumber] = useState(userProfileData.phoneNumber || '');
    const [password, setPassword] = useState('');
    const [verifyPassword, setVerifyPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showPassword, setShowPassword] = useState(false);
    const [showVerifyPassword, setShowVerifyPassword] = useState(false);
    const [showDialCodeModal, setShowDialCodeModal] = useState(false);

    // Načítanie a nastavenie predvoleného dialCode na základe userProfileData.phoneNumber alebo prvého zo zoznamu
    const defaultDialCode = countryDialCodes.find(c => (userProfileData.dialCode || '').startsWith(c.dialCode))?.dialCode || countryDialCodes[0]?.dialCode;
    const [selectedDialCode, setSelectedDialCode] = useState(defaultDialCode);

    useEffect(() => {
        // Obnovenie stavu, keď sa zobrazí modálne okno, pre prípad, že sa údaje zmenili inde
        if (show) {
            setFirstName(userProfileData.firstName || '');
            setLastName(userProfileData.lastName || '');
            setEmail(userProfileData.email || '');
            setPhoneNumber((userProfileData.phoneNumber || '').startsWith(userProfileData.dialCode)
                ? (userProfileData.phoneNumber || '').substring(userProfileData.dialCode.length)
                : userProfileData.phoneNumber || '');
            setSelectedDialCode(userProfileData.dialCode || defaultDialCode);
            setPassword('');
            setVerifyPassword('');
            setError(null);
        }
    }, [show, userProfileData]);

    const isFormChanged = () => {
        const originalPhoneNumberWithoutDialCode = (userProfileData.phoneNumber || '').startsWith(userProfileData.dialCode)
            ? (userProfileData.phoneNumber || '').substring(userProfileData.dialCode.length)
            : userProfileData.phoneNumber || '';

        return (
            firstName !== (userProfileData.firstName || '') ||
            lastName !== (userProfileData.lastName || '') ||
            email !== (userProfileData.email || '') ||
            phoneNumber !== originalPhoneNumberWithoutDialCode ||
            selectedDialCode !== (userProfileData.dialCode || defaultDialCode) ||
            password.length > 0 ||
            verifyPassword.length > 0
        );
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const auth = getAuth();
        const db = getFirestore();
        const user = auth.currentUser;

        if (!user) {
            setError('Používateľ nie je prihlásený.');
            setLoading(false);
            return;
        }

        if (password !== verifyPassword) {
            setError('Heslá sa nezhodujú.');
            setLoading(false);
            return;
        }

        const updates = {};
        let needsReauthentication = false;
        let needsEmailUpdate = false;

        const newEmail = email.trim();
        if (newEmail && newEmail !== userProfileData.email) {
            needsEmailUpdate = true;
            needsReauthentication = true; // Zmena e-mailu si vyžaduje re-autentifikáciu
        }

        if (password && password.length > 0) {
            // Re-autentifikácia je potrebná aj na zmenu hesla, ale to sa spravuje iným spôsobom
            // Pre zjednodušenie to necháme v tomto bloku, aj keď to nemusí byť najlepšia prax
            // V reálnom scenári by ste použili updatePassword(user, password)
        }

        if (needsReauthentication) {
            if (!password) {
                setError('Pre zmenu e-mailu je potrebné zadať aktuálne heslo.');
                setLoading(false);
                return;
            }
            try {
                const credential = EmailAuthProvider.credential(userProfileData.email, password);
                await reauthenticateWithCredential(user, credential);
                if (needsEmailUpdate) {
                    await verifyBeforeUpdateEmail(user, newEmail);
                    window.showGlobalNotification('Pre dokončenie zmeny e-mailu skontrolujte svoju novú e-mailovú adresu.', 'success');
                }
            } catch (err) {
                setError('Chyba pri re-autentifikácii: ' + err.message);
                setLoading(false);
                return;
            }
        }

        // Ak sa heslo zmenilo, ale nie email, nemusíme volať re-autentifikáciu
        // V tomto príklade sa na zmenu hesla zameriavame len na re-autentifikáciu, ale reálne by sa volala iná funkcia
        // Ak sa heslo zmenilo, mali by sme volať updatePassword, ale z dôvodu zjednodušenia tu to zatiaľ neimplementujeme
        
        if (firstName !== userProfileData.firstName) updates.firstName = firstName;
        if (lastName !== userProfileData.lastName) updates.lastName = lastName;

        // Ak sa mení telefónne číslo alebo predvoľba, uložíme ich spoločne
        const fullPhoneNumber = selectedDialCode + phoneNumber;
        if (fullPhoneNumber !== userProfileData.phoneNumber) {
            updates.dialCode = selectedDialCode;
            updates.phoneNumber = fullPhoneNumber;
        }


        if (Object.keys(updates).length > 0) {
            const userDocRef = doc(db, "users", user.uid);
            try {
                await updateDoc(userDocRef, updates);
                onSaveSuccess();
            } catch (err) {
                setError('Chyba pri ukladaní údajov: ' + err.message);
            }
        } else if (!needsEmailUpdate) {
            onClose();
        }

        setLoading(false);
    };

    const ModalHeader = React.createElement(
        'div',
        { className: 'flex justify-between items-center p-6 border-b' },
        React.createElement('h3', { className: 'text-xl font-bold' }, 'Upraviť profil'),
        React.createElement(
            'button',
            { onClick: onClose, className: 'text-gray-400 hover:text-gray-600' },
            React.createElement('span', { className: 'text-2xl' }, '×')
        )
    );

    const ModalContent = React.createElement(
        'form',
        { className: 'p-6 space-y-4', onSubmit: handleSave },
        error && React.createElement('div', { className: 'bg-red-100 text-red-700 p-3 rounded-md mb-4' }, error),
        
        // Meno
        React.createElement(
            'div',
            null,
            React.createElement('label', { htmlFor: 'firstName', className: 'block text-sm font-medium text-gray-700' }, 'Meno'),
            React.createElement('input', {
                type: 'text',
                id: 'firstName',
                value: firstName,
                onChange: (e) => setFirstName(e.target.value),
                className: `mt-1 block w-full border-gray-300 rounded-md shadow-sm pl-4 pr-10 focus:ring-${roleColor} focus:border-${roleColor} sm:text-sm py-2 h-10`, // <-- Upravené triedy
                style: { borderColor: roleColor + '60' }
            })
        ),
        // Priezvisko
        React.createElement(
            'div',
            null,
            React.createElement('label', { htmlFor: 'lastName', className: 'block text-sm font-medium text-gray-700' }, 'Priezvisko'),
            React.createElement('input', {
                type: 'text',
                id: 'lastName',
                value: lastName,
                onChange: (e) => setLastName(e.target.value),
                className: `mt-1 block w-full border-gray-300 rounded-md shadow-sm pl-4 pr-10 focus:ring-${roleColor} focus:border-${roleColor} sm:text-sm py-2 h-10`, // <-- Upravené triedy
                style: { borderColor: roleColor + '60' }
            })
        ),
        // Email
        React.createElement(
            'div',
            null,
            React.createElement('label', { htmlFor: 'email', className: 'block text-sm font-medium text-gray-700' }, 'E-mailová adresa'),
            React.createElement('input', {
                type: 'email',
                id: 'email',
                value: email,
                onChange: (e) => setEmail(e.target.value),
                className: `mt-1 block w-full border-gray-300 rounded-md shadow-sm pl-4 pr-10 focus:ring-${roleColor} focus:border-${roleColor} sm:text-sm py-2 h-10`, // <-- Upravené triedy
                style: { borderColor: roleColor + '60' }
            })
        ),
        // Telefónne číslo
        React.createElement(
            'div',
            null,
            React.createElement('label', { htmlFor: 'phoneNumber', className: 'block text-sm font-medium text-gray-700' }, 'Telefónne číslo'),
            React.createElement(
                'div',
                { className: 'mt-1 flex rounded-md shadow-sm' },
                React.createElement(
                    'div',
                    {
                        className: `inline-flex items-center px-3 rounded-l-md border border-r-0 text-gray-500 cursor-pointer transition-colors duration-200 py-2 h-10`, // <-- Upravené triedy
                        style: { borderColor: roleColor + '60' },
                        onClick: () => setShowDialCodeModal(true)
                    },
                    selectedDialCode
                ),
                React.createElement('input', {
                    type: 'tel',
                    id: 'phoneNumber',
                    value: phoneNumber,
                    onChange: (e) => setPhoneNumber(e.target.value),
                    className: `flex-1 block w-full rounded-none rounded-r-md border-gray-300 focus:ring-${roleColor} focus:border-${roleColor} sm:text-sm py-2 h-10`, // <-- Upravené triedy
                    style: { borderColor: roleColor + '60' }
                })
            )
        ),
        // Heslo pre overenie zmeny emailu
        React.createElement(PasswordInput, {
            id: 'password',
            label: 'Heslo pre overenie zmeny (ak meníte e-mail)',
            value: password,
            onChange: (e) => setPassword(e.target.value),
            placeholder: 'Zadajte vaše aktuálne heslo',
            showPassword: showPassword,
            toggleShowPassword: () => setShowPassword(!showPassword),
            roleColor: roleColor
        }),

        React.createElement(
            'div',
            { className: 'flex justify-end pt-4' },
            React.createElement(
                'button',
                {
                    type: 'button',
                    onClick: onClose,
                    className: `mr-2 px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 focus:outline-none`,
                    style: {
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
                    type: 'submit',
                    disabled: loading || !isFormChanged(),
                    className: `px-4 py-2 text-sm font-medium rounded-md text-white transition-colors duration-200 focus:outline-none`,
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
