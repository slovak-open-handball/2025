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
        'svg', { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' }),
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' })
    );

    const EyeSlashIcon = React.createElement(
        'svg', { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M13.875 18.75a10.5 10.5 0 01-10.5-10.5M10.5 7.5a4.5 4.5 0 014.5 4.5m-4.5 0a4.5 4.5 0 01-4.5-4.5M1.5 4.5l21 15m-15-6h6' })
    );

    return React.createElement('div', { className: 'relative' },
        React.createElement('label', { htmlFor: id, className: `block text-sm font-medium ${disabled ? 'text-gray-400' : 'text-gray-700'}` }, label),
        React.createElement('div', { className: 'mt-1 relative rounded-md shadow-sm' },
            React.createElement('input', {
                id: id,
                type: showPassword ? 'text' : 'password',
                value: value,
                onChange: onChange,
                placeholder: placeholder,
                disabled: disabled,
                className: `block w-full rounded-md border-gray-300 pr-10 focus:border-${roleColor}-500 focus:ring-${roleColor}-500 sm:text-sm p-2 ${disabled ? 'bg-gray-100' : ''}`
            }),
            React.createElement('div', {
                className: 'absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer',
                onClick: toggleShowPassword
            }, showPassword ? EyeSlashIcon : EyeIcon)
        )
    );
};

/**
 * Komponent na výber telefónnej predvoľby.
 */
const DialCodeModal = ({ show, onClose, onSelect, selectedDialCode, roleColor }) => {
    if (!show) return null;

    const [filter, setFilter] = useState('');
    const modalRef = useRef(null);

    const filteredCodes = countryDialCodes.filter(c =>
        c.name.toLowerCase().includes(filter.toLowerCase()) ||
        c.dialCode.includes(filter)
    );

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (modalRef.current && !modalRef.current.contains(event.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    return ReactDOM.createPortal(
        React.createElement('div', { className: 'fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-[11000]' },
            React.createElement('div', { ref: modalRef, className: 'bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6 overflow-hidden' },
                React.createElement('h3', { className: 'text-xl font-bold mb-4 text-gray-800' }, 'Vybrať predvoľbu'),
                React.createElement('input', {
                    type: 'text',
                    placeholder: 'Vyhľadať krajinu alebo kód...',
                    className: 'w-full px-4 py-2 mb-4 rounded-lg border border-gray-300 focus:outline-none focus:ring-2',
                    style: { borderColor: roleColor, focusRingColor: roleColor },
                    value: filter,
                    onChange: (e) => setFilter(e.target.value)
                }),
                React.createElement('div', { className: 'max-h-60 overflow-y-auto custom-scrollbar' },
                    filteredCodes.map(country =>
                        React.createElement('div', {
                            key: country.dialCode,
                            className: `flex justify-between items-center p-2 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors duration-150 ${selectedDialCode === country.dialCode ? 'bg-gray-200' : ''}`,
                            onClick: () => { onSelect(country.dialCode); onClose(); }
                        },
                            React.createElement('span', { className: 'text-sm font-medium' }, country.name),
                            React.createElement('span', { className: 'text-sm text-gray-500' }, country.dialCode)
                        )
                    )
                ),
                React.createElement('button', {
                    className: `mt-4 w-full py-2 px-4 rounded-lg text-white font-medium transition-all duration-200 hover:brightness-110`,
                    style: { backgroundColor: roleColor },
                    onClick: onClose
                }, 'Zavrieť')
            )
        ),
        document.body
    );
};

/**
 * Modálny komponent pre zmenu profilových údajov a hesla.
 */
export const ChangeProfileModal = ({ show, onClose, userProfileData, roleColor }) => {
    const auth = window.auth;
    const db = window.db;

    const [firstName, setFirstName] = useState(userProfileData.first_name || '');
    const [lastName, setLastName] = useState(userProfileData.last_name || '');
    const [email, setEmail] = useState(userProfileData.email || '');
    const [phone, setPhone] = useState(userProfileData.phone?.split(' ')[1] || '');
    const [selectedDialCode, setSelectedDialCode] = useState(userProfileData.phone?.split(' ')[0] || countryDialCodes.find(c => c.code === 'SK')?.dialCode);
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [reauthRequired, setReauthRequired] = useState(false);
    const [showDialCodeModal, setShowDialCodeModal] = useState(false);
    const [error, setError] = useState(null);

    // Synchronizácia lokálneho stavu s globálnymi dátami
    useEffect(() => {
        setFirstName(userProfileData.first_name || '');
        setLastName(userProfileData.last_name || '');
        setEmail(userProfileData.email || '');
        setPhone(userProfileData.phone?.split(' ')[1] || '');
        setSelectedDialCode(userProfileData.phone?.split(' ')[0] || countryDialCodes.find(c => c.code === 'SK')?.dialCode);
        setReauthRequired(false);
        setError(null);
    }, [userProfileData]);

    const isFormChanged = () => {
        const currentPhone = phone ? `${selectedDialCode} ${phone}` : '';
        return (
            firstName !== userProfileData.first_name ||
            lastName !== userProfileData.last_name ||
            email !== userProfileData.email ||
            currentPhone !== (userProfileData.phone || '')
        );
    };

    const handleUpdateProfile = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError(null);

        const user = auth.currentUser;
        if (!user) {
            window.showGlobalNotification('Používateľ nie je prihlásený.', 'error');
            setLoading(false);
            return;
        }

        const updatedData = {
            first_name: firstName,
            last_name: lastName,
            phone: phone ? `${selectedDialCode} ${phone}` : '',
        };

        const originalEmail = userProfileData.email;
        const isEmailChanged = email !== originalEmail;

        try {
            if (isEmailChanged) {
                // Ak sa mení e-mail, najskôr sa pokúsime re-autentifikovať
                if (!password) {
                    setError('Pre zmenu e-mailovej adresy je nutné zadať heslo.');
                    setReauthRequired(true);
                    setLoading(false);
                    return;
                }
                const credential = EmailAuthProvider.credential(originalEmail, password);
                await reauthenticateWithCredential(user, credential);
                await verifyBeforeUpdateEmail(user, email);
                window.showGlobalNotification('Potvrďte zmenu e-mailu kliknutím na odkaz vo vašej schránke.', 'info');
                // Aktualizácia e-mailu v databáze po re-autentifikácii
                updatedData.email = email;
            }

            // Aktualizácia dát v Firestore
            await updateDoc(doc(db, "users", user.uid), updatedData);

            if (!isEmailChanged) {
                window.showGlobalNotification('Profil bol úspešne aktualizovaný!', 'success');
            }

            onClose();
        } catch (e) {
            console.error("Chyba pri aktualizácii profilu alebo e-mailu:", e);
            if (e.code === 'auth/wrong-password') {
                setError('Zadané heslo je nesprávne.');
            } else if (e.code === 'auth/email-already-in-use') {
                setError('E-mailová adresa je už používaná iným účtom.');
            } else if (e.code === 'auth/requires-recent-login') {
                // Toto by sa nemalo stať, ak robíme re-autentifikáciu, ale pre istotu
                setError('Pre túto akciu sa musíte znova prihlásiť.');
            } else {
                setError('Nepodarilo sa aktualizovať profil. Skúste to prosím neskôr.');
            }
        } finally {
            setLoading(false);
        }
    };

    const ModalHeader = React.createElement('div', {
        className: `flex items-center justify-between p-4 sm:p-6 border-b`,
        style: { borderColor: roleColor, backgroundColor: '#F9FAFB' }
    },
        React.createElement('h3', { className: 'text-2xl font-semibold text-gray-900' }, 'Upraviť profil'),
        React.createElement('button', {
            type: 'button',
            className: `text-gray-400 hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center`,
            onClick: onClose
        },
            React.createElement('svg', { className: 'w-5 h-5', fill: 'currentColor', viewBox: '0 0 20 20' },
                React.createElement('path', { fillRule: 'evenodd', d: 'M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z', clipRule: 'evenodd' })
            )
        )
    );

    const ModalContent = React.createElement('div', { className: 'p-4 sm:p-6' },
        error && React.createElement('div', { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4', role: 'alert' },
            React.createElement('strong', { className: 'font-bold' }, 'Chyba! '),
            React.createElement('span', { className: 'block sm:inline' }, error)
        ),
        React.createElement('form', { onSubmit: handleUpdateProfile },
            React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                React.createElement('div', null,
                    React.createElement('label', { htmlFor: 'first_name', className: 'block text-sm font-medium text-gray-700' }, 'Meno'),
                    React.createElement('input', { type: 'text', id: 'first_name', value: firstName, onChange: (e) => setFirstName(e.target.value), className: `mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-${roleColor}-500 focus:ring-${roleColor}-500 sm:text-sm p-2` })
                ),
                React.createElement('div', null,
                    React.createElement('label', { htmlFor: 'last_name', className: 'block text-sm font-medium text-gray-700' }, 'Priezvisko'),
                    React.createElement('input', { type: 'text', id: 'last_name', value: lastName, onChange: (e) => setLastName(e.target.value), className: `mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-${roleColor}-500 focus:ring-${roleColor}-500 sm:text-sm p-2` })
                )
            ),
            React.createElement('div', { className: 'mt-4' },
                React.createElement('label', { htmlFor: 'email', className: 'block text-sm font-medium text-gray-700' }, 'E-mailová adresa'),
                React.createElement('input', { type: 'email', id: 'email', value: email, onChange: (e) => { setEmail(e.target.value); setReauthRequired(e.target.value !== userProfileData.email); }, className: `mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-${roleColor}-500 focus:ring-${roleColor}-500 sm:text-sm p-2` })
            ),
            React.createElement('div', { className: 'mt-4' },
                React.createElement('label', { htmlFor: 'phone', className: 'block text-sm font-medium text-gray-700' }, 'Telefónne číslo'),
                React.createElement('div', { className: 'mt-1 flex rounded-md shadow-sm' },
                    React.createElement('div', { className: 'relative' },
                        React.createElement('button', {
                            type: 'button',
                            className: 'inline-flex items-center rounded-l-md border border-r-0 border-gray-300 bg-gray-50 px-3 text-gray-500 text-sm focus:outline-none',
                            style: { borderColor: roleColor },
                            onClick: () => setShowDialCodeModal(true)
                        }, selectedDialCode || '+421'),
                    ),
                    React.createElement('input', { type: 'tel', id: 'phone', value: phone, onChange: (e) => setPhone(e.target.value), className: `flex-1 block w-full rounded-r-md border-gray-300 focus:border-${roleColor}-500 focus:ring-${roleColor}-500 sm:text-sm p-2` })
                )
            ),
            reauthRequired && React.createElement('div', { className: 'mt-4' },
                React.createElement(PasswordInput, {
                    id: 'current-password',
                    label: 'Heslo pre overenie (kvôli zmene e-mailu)',
                    value: password,
                    onChange: (e) => setPassword(e.target.value),
                    placeholder: 'Zadajte vaše heslo',
                    showPassword: showPassword,
                    toggleShowPassword: () => setShowPassword(!showPassword),
                    roleColor: roleColor
                })
            ),
            React.createElement('div', { className: 'mt-6 flex justify-end' },
                React.createElement('button', {
                    type: 'button',
                    className: 'mr-3 inline-flex justify-center rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2',
                    onClick: onClose
                }, 'Zrušiť'),
                React.createElement('button', {
                    type: 'submit',
                    disabled: loading || !isFormChanged(),
                    className: `inline-flex justify-center rounded-md py-2 px-4 text-sm font-medium shadow-sm focus:outline-none`,
                    style: {
                        backgroundColor: (loading || !isFormChanged()) ? '#E5E7EB' : roleColor,
                        color: (loading || !isFormChanged()) ? '#9CA3AF' : 'white',
                        border: 'none',
                        cursor: (loading || !isFormChanged()) ? 'not-allowed' : 'pointer',
                    }
                },
                    loading ? 'Ukladám...' : 'Uložiť zmeny'
                )
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

    const modal = show ? React.createElement(
        'div', {
            className: 'fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-[10000]',
            onClick: (e) => {
                if (e.target === e.currentTarget) {
                    onClose();
                }
            }
        },
        React.createElement(
            'div', { className: 'bg-white rounded-xl shadow-xl w-full max-w-lg mx-auto overflow-hidden' },
            ModalHeader,
            ModalContent
        )
    ) : null;

    return ReactDOM.createPortal(modal, document.body);
};
