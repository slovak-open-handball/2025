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
            'div',
            { className: 'mt-1 relative rounded-md shadow-sm' },
            React.createElement(
                'input',
                {
                    id: id,
                    type: showPassword ? 'text' : 'password',
                    value: value,
                    onChange: onChange,
                    placeholder: placeholder,
                    disabled: disabled,
                    // Pridaná trieda py-2 pre jednotnú výšku s tlačidlami
                    className: `mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 sm:text-sm transition duration-150 ease-in-out px-4 py-2 ${
                        disabled ? 'bg-gray-100 cursor-not-allowed' : ''
                    }`,
                    style: disabled ? {} : { borderColor: roleColor, borderWidth: '1px' }
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
                        className: 'text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                    },
                    showPassword ? EyeOffIcon : EyeIcon
                )
            )
        )
    );
};

/**
 * Komponent DialCodeModal pre výber medzinárodnej predvoľby.
 */
const DialCodeModal = ({ show, onClose, onSelect, selectedDialCode, roleColor }) => {
    if (!show) return null;

    const [searchQuery, setSearchQuery] = useState('');

    // Filter country codes based on search query
    const filteredCodes = countryDialCodes.filter(c =>
        (c.name && c.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.dialCode && c.dialCode.includes(searchQuery))
    );

    return ReactDOM.createPortal(
        React.createElement('div', {
            className: 'fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-[11000]',
            onClick: (e) => {
                if (e.target === e.currentTarget) onClose();
            }
        },
            React.createElement('div', { className: 'bg-white rounded-xl shadow-xl w-full max-w-sm max-h-[80vh] mx-4 overflow-y-auto' },
                React.createElement('div', { className: 'p-4 border-b border-gray-200 sticky top-0 bg-white z-10' },
                    React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, 'Vyberte predvoľbu'),
                    React.createElement('button', {
                        className: 'absolute top-2 right-2 text-gray-400 hover:text-gray-600',
                        onClick: onClose
                    },
                        React.createElement('svg', { className: 'h-6 w-6', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                            React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M6 18L18 6M6 6l12 12' })
                        )
                    ),
                    React.createElement('div', { className: 'mt-4' },
                        React.createElement(
                            'input',
                            {
                                type: 'text',
                                placeholder: 'Hľadať krajinu alebo predvoľbu...',
                                value: searchQuery,
                                onChange: (e) => setSearchQuery(e.target.value),
                                className: `w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500`
                            }
                        )
                    )
                ),
                React.createElement('div', { className: 'p-4' },
                    filteredCodes.length > 0 ? (
                        filteredCodes.map((country, index) =>
                            React.createElement('div', {
                                key: index,
                                className: `flex justify-between items-center px-3 py-2 cursor-pointer rounded-lg hover:bg-gray-100 transition-colors duration-200 ${selectedDialCode === country.dialCode ? 'bg-indigo-100 font-semibold' : ''}`,
                                onClick: () => {
                                    onSelect(country.dialCode);
                                    onClose();
                                }
                            },
                                React.createElement('span', { className: 'text-gray-800' }, `${country.name}`),
                                React.createElement('span', { className: 'text-gray-600' }, country.dialCode)
                            )
                        )
                    ) : (
                        React.createElement('div', { className: 'text-center text-gray-500 py-4' }, 'Žiadne výsledky')
                    )
                )
            )
        ),
        document.body
    );
};

/**
 * Komponenta modálneho okna na zmenu údajov profilu.
 */
export const ChangeProfileModal = ({ show, onClose, onSaveSuccess, userProfileData, roleColor }) => {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [selectedDialCode, setSelectedDialCode] = useState(userProfileData?.phoneNumber?.startsWith('+') ? userProfileData?.phoneNumber?.split(' ')[0] : '+421');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [modalError, setModalError] = useState('');
    const [showDialCodeModal, setShowDialCodeModal] = useState(false);

    // Initializácia a resetovanie stavov pri otvorení modálneho okna
    useEffect(() => {
        if (show) {
            // Vstupné polia nebudú predvyplnené, namiesto toho použijeme zástupný text (placeholder)
            setFirstName('');
            setLastName('');
            setEmail('');
            setPhoneNumber('');
            setPassword('');
            setModalError('');
            setLoading(false);
        }
    }, [show]);

    // Uloží zmeny v profile
    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        setModalError('');

        const auth = getAuth();
        const user = auth.currentUser;
        const db = getFirestore();

        if (!user) {
            setModalError('Používateľ nie je prihlásený.');
            setLoading(false);
            return;
        }

        try {
            // Overenie hesla pred akoukoľvek zmenou
            const credential = EmailAuthProvider.credential(user.email, password);
            await reauthenticateWithCredential(user, credential);

            const updates = {};
            const originalEmail = userProfileData?.email;
            let emailUpdatePending = false;

            // Kontrola, ktoré polia boli zmenené a pridanie do objektu updates
            if (firstName.trim() !== '' && firstName !== userProfileData.firstName) {
                updates.firstName = firstName.trim();
            }
            if (lastName.trim() !== '' && lastName !== userProfileData.lastName) {
                updates.lastName = lastName.trim();
            }
            if (email.trim() !== '' && email !== userProfileData.email) {
                await verifyBeforeUpdateEmail(user, email);
                emailUpdatePending = true;
                window.showGlobalNotification('Na zadanú e-mailovú adresu bol odoslaný overovací e-mail. Pre dokončenie zmeny prosím overte novú adresu.', 'info');
            }
            if (phoneNumber.trim() !== '' && phoneNumber !== userProfileData.phoneNumber) {
                updates.phoneNumber = `${selectedDialCode} ${phoneNumber.trim()}`;
            }

            // Aktualizácia profilu vo Firestore
            if (Object.keys(updates).length > 0) {
                const userDocRef = doc(db, "users", user.uid);
                await updateDoc(userDocRef, updates);
                onSaveSuccess();
            } else if (emailUpdatePending) {
                // Ak sa zmenil len email a už bol odoslaný overovací e-mail,
                // stačí zavolať onSaveSuccess bez aktualizácie Firestore
                 onSaveSuccess();
            } else {
                setModalError('Žiadne zmeny na uloženie.');
            }

        } catch (error) {
            console.error("Chyba pri aktualizácii profilu:", error);
            if (error.code === 'auth/wrong-password') {
                setModalError('Zadali ste nesprávne heslo.');
            } else if (error.code === 'auth/requires-recent-login') {
                setModalError('Pre zmenu údajov je potrebné sa znovu prihlásiť.');
            } else if (error.code === 'auth/invalid-email') {
                setModalError('Zadaný e-mail nie je platný.');
            } else if (error.code === 'auth/email-already-in-use') {
                setModalError('Zadaný e-mail je už používaný iným účtom.');
            } else {
                setModalError('Nepodarilo sa uložiť zmeny. Skúste to prosím neskôr.');
            }
        } finally {
            setLoading(false);
        }
    };

    const ModalHeader = React.createElement('div', {
        className: `flex items-center justify-between p-4 md:p-6 rounded-t-xl text-white`,
        style: { backgroundColor: roleColor }
    },
        React.createElement('h3', { className: 'text-xl md:text-2xl font-bold' }, 'Upraviť profil'),
        React.createElement('button', {
            onClick: onClose,
            className: 'text-white hover:text-gray-200 transition-colors duration-200'
        },
            React.createElement('svg', { className: 'h-6 w-6', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M6 18L18 6M6 6l12 12' })
            )
        )
    );

    const ModalContent = React.createElement('div', { className: 'p-4 md:p-6' },
        React.createElement('form', { onSubmit: handleSave },
            // Chybová správa
            modalError && React.createElement('div', { className: 'bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md', role: 'alert' },
                React.createElement('p', null, modalError)
            ),
            // Meno a Priezvisko
            React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                // Meno
                React.createElement('div', null,
                    React.createElement('label', { htmlFor: 'firstName', className: 'block text-sm font-medium text-gray-700' }, 'Meno'),
                    React.createElement('input', {
                        type: 'text',
                        name: 'firstName',
                        id: 'firstName',
                        value: firstName,
                        onChange: (e) => setFirstName(e.target.value),
                        placeholder: userProfileData?.firstName || 'Zadajte meno',
                        // Pridaná trieda py-2 pre jednotnú výšku s tlačidlami
                        className: `mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 sm:text-sm transition duration-150 ease-in-out px-4 py-2`,
                        style: { borderColor: roleColor, borderWidth: '1px' }
                    })
                ),
                // Priezvisko
                React.createElement('div', null,
                    React.createElement('label', { htmlFor: 'lastName', className: 'block text-sm font-medium text-gray-700' }, 'Priezvisko'),
                    React.createElement('input', {
                        type: 'text',
                        name: 'lastName',
                        id: 'lastName',
                        value: lastName,
                        onChange: (e) => setLastName(e.target.value),
                        placeholder: userProfileData?.lastName || 'Zadajte priezvisko',
                        // Pridaná trieda py-2 pre jednotnú výšku s tlačidlami
                        className: `mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 sm:text-sm transition duration-150 ease-in-out px-4 py-2`,
                        style: { borderColor: roleColor, borderWidth: '1px' }
                    })
                )
            ),
            // E-mailová adresa
            React.createElement('div', { className: 'mt-4' },
                React.createElement('label', { htmlFor: 'email', className: 'block text-sm font-medium text-gray-700' }, 'E-mailová adresa'),
                React.createElement('input', {
                    type: 'email',
                    name: 'email',
                    id: 'email',
                    value: email,
                    onChange: (e) => setEmail(e.target.value),
                    placeholder: userProfileData?.email || 'Zadajte e-mail',
                    // Pridaná trieda py-2 pre jednotnú výšku s tlačidlami
                    className: `mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 sm:text-sm transition duration-150 ease-in-out px-4 py-2`,
                    style: { borderColor: roleColor, borderWidth: '1px' }
                })
            ),
            // Telefónne číslo
            userProfileData?.role !== 'admin' &&
            React.createElement('div', { className: 'mt-4' },
                React.createElement('label', { htmlFor: 'phoneNumber', className: 'block text-sm font-medium text-gray-700' }, 'Telefónne číslo'),
                React.createElement('div', { className: 'mt-1 flex rounded-md shadow-sm' },
                    React.createElement('span', {
                        onClick: () => setShowDialCodeModal(true),
                        className: 'inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm cursor-pointer hover:bg-gray-100 transition-colors duration-200',
                        style: { borderColor: roleColor }
                    }, selectedDialCode),
                    React.createElement('input', {
                        type: 'text',
                        name: 'phoneNumber',
                        id: 'phoneNumber',
                        value: phoneNumber,
                        onChange: (e) => setPhoneNumber(e.target.value),
                        placeholder: userProfileData?.phoneNumber?.split(' ').length > 1 ? userProfileData?.phoneNumber.substring(userProfileData?.phoneNumber?.indexOf(' ') + 1) : 'Zadajte telefónne číslo',
                        // Pridaná trieda py-2 pre jednotnú výšku s tlačidlami
                        className: `flex-1 block w-full rounded-none rounded-r-md sm:text-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 transition duration-150 ease-in-out px-4 py-2`,
                        style: { borderColor: roleColor, borderWidth: '1px', borderLeftWidth: '0px' }
                    })
                )
            ),

            // Heslo pre overenie
            React.createElement('div', { className: 'mt-4' },
                React.createElement(PasswordInput, {
                    id: 'password',
                    label: 'Heslo pre overenie zmien',
                    value: password,
                    onChange: (e) => setPassword(e.target.value),
                    placeholder: 'Zadajte heslo',
                    showPassword: showPassword,
                    toggleShowPassword: () => setShowPassword(!showPassword),
                    roleColor: roleColor
                })
            ),

            // Tlačidlá
            React.createElement('div', { className: 'mt-6 flex justify-end gap-3' },
                React.createElement('button', {
                    type: 'button',
                    onClick: onClose,
                    className: 'px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 focus:outline-none',
                    style: {
                        backgroundColor: 'white',
                        color: roleColor,
                        border: `2px solid ${roleColor}`,
                    }
                }, 'Zrušiť'),
                React.createElement('button', {
                    type: 'submit',
                    disabled: loading,
                    className: `px-4 py-2 text-sm font-medium rounded-md text-white transition-colors duration-200 focus:outline-none`,
                    style: {
                        backgroundColor: roleColor,
                        color: 'white',
                        border: 'none',
                    }
                }, loading ? 'Ukladám...' : 'Uložiť zmeny')
            )
        ),
        React.createElement(DialCodeModal, {
            show: showDialCodeModal,
            onClose: () => setShowDialCodeModal(false),
            onSelect: (code) => {
                setSelectedDialCode(code);
                // Pri výbere novej predvoľby resetujeme pole s telefónnym číslom
                setPhoneNumber('');
            },
            selectedDialCode: selectedDialCode,
            roleColor: roleColor
        })
    );
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
