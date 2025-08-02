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
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 .984-2.433 2.685-4.542 4.646-6.368M14 5a7 7 0 01-4 11.594M8.13 16.5a8.955 8.955 0 01-1.636-.576M12 9a3 3 0 100 6 3 3 0 000-6z' }),
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' }),
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M2.458 12C3.732 7.943 7.523 5 12 5c.441 0 .878.031 1.31.092m6.257.065A10.07 10.07 0 0122 12c-1.274 4.057-5.064 7-9.542 7-1.57 0-3.076-.239-4.502-.676M21 21l-1-1' })
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
            { className: 'mt-1 relative rounded-md shadow-sm' },
            React.createElement(
                'input',
                {
                    type: showPassword ? 'text' : 'password',
                    name: id,
                    id: id,
                    value: value,
                    onChange: onChange,
                    placeholder: placeholder,
                    disabled: disabled,
                    className: `block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm transition-all duration-200 ${disabled ? 'bg-gray-100 text-gray-500' : ''}`,
                    style: disabled ? { border: '1px solid #e5e7eb' } : { border: '1px solid #d1d5db' }
                }
            ),
            React.createElement(
                'div',
                { className: 'absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 cursor-pointer', onClick: toggleShowPassword },
                showPassword ? EyeIcon : EyeOffIcon
            )
        )
    );
};


/**
 * Komponent DialCodeModal pre zobrazenie zoznamu predvolieb.
 */
const DialCodeModal = ({ show, onClose, onSelect, selectedDialCode, roleColor }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredDialCodes = countryDialCodes.filter(
        (country) =>
            country.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            country.dialCode.includes(searchTerm)
    ).sort((a, b) => a.name.localeCompare(b.name));

    if (!show) return null;

    const modalContent = React.createElement(
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
            { className: 'bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 md:mx-auto overflow-hidden' },
            React.createElement(
                'div',
                { className: 'bg-gray-50 px-4 py-4 sm:px-6 flex justify-between items-center', style: { borderBottom: `2px solid ${roleColor}` } },
                React.createElement('h3', { className: 'text-lg leading-6 font-medium text-gray-900' }, 'Vyberte predvoľbu'),
                React.createElement(
                    'button',
                    { onClick: onClose, type: 'button', className: 'text-gray-400 hover:text-gray-500 transition-colors' },
                    React.createElement(
                        'svg',
                        { className: 'h-6 w-6', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M6 18L18 6M6 6l12 12' })
                    )
                )
            ),
            React.createElement(
                'div',
                { className: 'p-4' },
                React.createElement(
                    'div',
                    { className: 'relative' },
                    React.createElement(
                        'div',
                        { className: 'absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none' },
                        React.createElement(
                            'svg',
                            { className: 'h-5 w-5 text-gray-400', fill: 'currentColor', viewBox: '0 0 20 20' },
                            React.createElement('path', { fillRule: 'evenodd', d: 'M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z', clipRule: 'evenodd' })
                        )
                    ),
                    React.createElement('input', {
                        type: 'text',
                        value: searchTerm,
                        onChange: (e) => setSearchTerm(e.target.value),
                        className: 'block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 transition-all',
                        placeholder: 'Vyhľadať krajinu alebo predvoľbu',
                    })
                ),
                React.createElement(
                    'ul',
                    { className: 'mt-2 max-h-60 overflow-y-auto' },
                    filteredDialCodes.length > 0 ? (
                        filteredDialCodes.map((country) =>
                            React.createElement(
                                'li',
                                {
                                    key: country.code,
                                    onClick: () => onSelect(country.dialCode),
                                    className: `p-2 cursor-pointer hover:bg-gray-100 rounded-md flex justify-between items-center transition-colors ${selectedDialCode === country.dialCode ? 'bg-gray-200' : ''}`
                                },
                                React.createElement('span', { className: 'text-gray-900 font-medium' }, country.name),
                                React.createElement('span', { className: 'text-gray-500' }, country.dialCode)
                            )
                        )
                    ) : (
                        React.createElement('li', { className: 'text-center text-gray-500 py-4' }, 'Žiadne výsledky')
                    )
                )
            )
        )
    );

    return ReactDOM.createPortal(modalContent, document.body);
};


/**
 * Hlavný komponent modálneho okna pre úpravu profilu.
 */
export const ChangeProfileModal = ({ show, onClose, onSaveSuccess, userProfileData, roleColor }) => {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [originalEmail, setOriginalEmail] = useState('');
    const [password, setPassword] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [selectedDialCode, setSelectedDialCode] = useState('+421');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showPassword, setShowPassword] = useState(false);
    const [showDialCodeModal, setShowDialCodeModal] = useState(false);

    useEffect(() => {
        if (userProfileData) {
            setFirstName(userProfileData.firstName || '');
            setLastName(userProfileData.lastName || '');
            setEmail(userProfileData.email || '');
            setOriginalEmail(userProfileData.email || '');
            setPhoneNumber(userProfileData.phoneNumber || '');
            if (userProfileData.dialCode) {
                setSelectedDialCode(userProfileData.dialCode);
            }
        }
    }, [userProfileData]);

    const isFormChanged = () => {
        const phoneWithoutCode = userProfileData.phoneNumber?.replace(userProfileData.dialCode, '') || '';
        const currentPhoneNumber = phoneNumber.startsWith(selectedDialCode) ? phoneNumber : selectedDialCode + phoneNumber;
        
        return (
            firstName !== (userProfileData.firstName || '') ||
            lastName !== (userProfileData.lastName || '') ||
            email !== (userProfileData.email || '') ||
            currentPhoneNumber !== (userProfileData.phoneNumber || '') ||
            selectedDialCode !== (userProfileData.dialCode || '+421')
        );
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const auth = getAuth();
        const user = auth.currentUser;
        const db = getFirestore();

        if (!user) {
            setError('Používateľ nie je prihlásený.');
            setLoading(false);
            return;
        }

        const updates = {};
        if (firstName !== userProfileData.firstName) updates.firstName = firstName;
        if (lastName !== userProfileData.lastName) updates.lastName = lastName;

        // Kombinujeme dialCode a phoneNumber pred uložením
        const newPhoneNumber = phoneNumber ? selectedDialCode + phoneNumber.replace(selectedDialCode, '') : '';
        if (newPhoneNumber !== (userProfileData.phoneNumber || '')) {
            updates.phoneNumber = newPhoneNumber;
            updates.dialCode = selectedDialCode;
        }

        try {
            if (email !== originalEmail) {
                // Skontrolujeme, či heslo bolo zadané pre re-autentifikáciu
                if (!password) {
                    setError('Pre zmenu e-mailu je nutné zadať heslo.');
                    setLoading(false);
                    return;
                }
                const credential = EmailAuthProvider.credential(originalEmail, password);
                await reauthenticateWithCredential(user, credential);
                
                await verifyBeforeUpdateEmail(user, email);
                updates.email = email; // Uložíme zmenený email
            }

            if (Object.keys(updates).length > 0) {
                await updateDoc(doc(db, 'users', user.uid), updates);
                onSaveSuccess();
            } else {
                onClose(); // Žiadne zmeny, len zatvoríme modálne okno
            }
        } catch (err) {
            console.error("Chyba pri aktualizácii profilu:", err);
            if (err.code === 'auth/requires-recent-login') {
                setError('Pre vykonanie tejto akcie je potrebné sa znova prihlásiť. Skúste to prosím znova.');
            } else if (err.code === 'auth/wrong-password') {
                setError('Zadali ste nesprávne heslo. Skúste to prosím znova.');
            } else {
                setError('Nastala chyba pri ukladaní zmien. Skúste to prosím neskôr.');
            }
        } finally {
            setLoading(false);
        }
    };

    if (!show) return null;

    const ModalHeader = React.createElement(
        'div',
        { className: 'bg-gray-50 px-6 py-4 flex justify-between items-center', style: { borderBottom: `2px solid ${roleColor}` } },
        React.createElement('h3', { className: 'text-xl leading-6 font-medium text-gray-900' }, 'Upraviť profil'),
        React.createElement(
            'button',
            { onClick: onClose, type: 'button', className: 'text-gray-400 hover:text-gray-500 transition-colors' },
            React.createElement(
                'svg',
                { className: 'h-6 w-6', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M6 18L18 6M6 6l12 12' })
            )
        )
    );

    const ModalContent = React.createElement(
        'form',
        { onSubmit: handleSave, className: 'p-6' },
        error && React.createElement(
            'div',
            { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4', role: 'alert' },
            React.createElement('span', { className: 'block sm:inline' }, error)
        ),
        React.createElement(
            'div',
            { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
            React.createElement(
                'div',
                null,
                React.createElement(
                    'label',
                    { htmlFor: 'firstName', className: 'block text-sm font-medium text-gray-700' },
                    'Meno'
                ),
                React.createElement(
                    'div',
                    { className: 'mt-1' },
                    React.createElement('input', {
                        type: 'text',
                        name: 'firstName',
                        id: 'firstName',
                        placeholder: userProfileData.firstName || 'Zadajte meno',
                        onChange: (e) => setFirstName(e.target.value),
                        className: 'block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm',
                        style: { border: '1px solid #d1d5db' }
                    })
                )
            ),
            React.createElement(
                'div',
                null,
                React.createElement(
                    'label',
                    { htmlFor: 'lastName', className: 'block text-sm font-medium text-gray-700' },
                    'Priezvisko'
                ),
                React.createElement(
                    'div',
                    { className: 'mt-1' },
                    React.createElement('input', {
                        type: 'text',
                        name: 'lastName',
                        id: 'lastName',
                        placeholder: userProfileData.lastName || 'Zadajte priezvisko',
                        onChange: (e) => setLastName(e.target.value),
                        className: 'block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm',
                        style: { border: '1px solid #d1d5db' }
                    })
                )
            )
        ),
        React.createElement(
            'div',
            { className: 'mt-4' },
            React.createElement(
                'label',
                { htmlFor: 'email', className: 'block text-sm font-medium text-gray-700' },
                'E-mailová adresa'
            ),
            React.createElement(
                'div',
                { className: 'mt-1' },
                React.createElement('input', {
                    type: 'email',
                    name: 'email',
                    id: 'email',
                    placeholder: userProfileData.email || 'Zadajte e-mailovú adresu',
                    onChange: (e) => setEmail(e.target.value),
                    className: 'block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm',
                    style: { border: '1px solid #d1d5db' }
                })
            )
        ),
        React.createElement(
            'div',
            { className: 'mt-4' },
            React.createElement(
                'label',
                { htmlFor: 'phoneNumber', className: 'block text-sm font-medium text-gray-700' },
                'Telefónne číslo'
            ),
            React.createElement(
                'div',
                { className: 'mt-1 relative flex rounded-md shadow-sm' },
                React.createElement(
                    'div',
                    {
                        onClick: () => setShowDialCodeModal(true),
                        className: `inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm cursor-pointer hover:bg-gray-200 transition-colors`,
                        style: { border: '1px solid #d1d5db' }
                    },
                    React.createElement('span', null, selectedDialCode)
                ),
                React.createElement('input', {
                    type: 'tel',
                    name: 'phoneNumber',
                    id: 'phoneNumber',
                    placeholder: userProfileData.phoneNumber?.replace(userProfileData.dialCode || '', '') || 'Zadajte telefónne číslo',
                    value: phoneNumber,
                    onChange: (e) => setPhoneNumber(e.target.value),
                    className: 'flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-md focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border-gray-300',
                    style: { border: '1px solid #d1d5db' }
                })
            )
        ),
        (email !== originalEmail || !isFormChanged()) && React.createElement(
            PasswordInput,
            {
                id: 'password',
                label: 'Heslo pre overenie zmeny e-mailu',
                value: password,
                onChange: (e) => setPassword(e.target.value),
                placeholder: 'Zadajte heslo',
                showPassword: showPassword,
                toggleShowPassword: () => setShowPassword(!showPassword),
                disabled: false,
                roleColor: roleColor
            }
        ),
        React.createElement(
            'div',
            { className: 'mt-6 flex justify-end' },
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
