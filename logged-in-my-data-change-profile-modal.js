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
    const EyeIcon = React.createElement(
        'svg',
        { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' }),
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' })
    );

    const EyeSlashIcon = React.createElement(
        'svg',
        { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.274-4.057 5.064-7 9.542-7 .47 0 .93.048 1.375.145M12 19l-.422-.422M20 20l-1.424-1.424M18.825 13.875L12 12m10-4l-1.424-1.424m-1.63 1.63l-1.92-1.92M21 12c-1.274-4.057-5.064-7-9.542-7-1.42 0-2.827.202-4.135.589M12 12c-.223 0-.445.02-.663.06' })
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
            React.createElement('input', {
                type: showPassword ? 'text' : 'password',
                name: id,
                id: id,
                className: `block w-full rounded-md border-gray-300 shadow-sm focus:border-${roleColor}-500 focus:ring-${roleColor}-500 sm:text-sm px-4 py-2 pr-10 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed transition duration-150 ease-in-out`,
                value: value,
                onChange: onChange,
                placeholder: placeholder,
                disabled: disabled,
            }),
            React.createElement(
                'div',
                { className: 'absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 cursor-pointer', onClick: toggleShowPassword },
                showPassword ? EyeSlashIcon : EyeIcon
            )
        )
    );
};

// Pomocný komponent pre dial kód modálne okno
const DialCodeModal = ({ show, onClose, onSelect, selectedDialCode, roleColor }) => {
    const [search, setSearch] = useState('');

    const filteredDialCodes = countryDialCodes.filter(country =>
        country.name.toLowerCase().includes(search.toLowerCase()) ||
        country.code.toLowerCase().includes(search.toLowerCase()) ||
        country.dialCode.includes(search)
    );

    const ModalHeader = React.createElement(
        'div',
        { className: `flex items-center justify-between p-6 rounded-t-xl`, style: { backgroundColor: roleColor } },
        React.createElement(
            'h3',
            { className: 'text-lg font-semibold text-white' },
            'Vyberte predvoľbu krajiny'
        ),
        React.createElement(
            'button',
            { type: 'button', onClick: onClose, className: 'text-white hover:text-gray-200 transition-colors' },
            React.createElement(
                'svg',
                { className: 'h-6 w-6', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M6 18L18 6M6 6l12 12' })
            )
        )
    );

    const ModalContent = React.createElement(
        'div',
        { className: 'p-6' },
        React.createElement('input', {
            type: 'text',
            placeholder: 'Hľadať krajinu alebo predvoľbu...',
            value: search,
            onChange: (e) => setSearch(e.target.value),
            className: `w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${roleColor}-500 focus:border-${roleColor}-500 mb-4 transition duration-150 ease-in-out`
        }),
        React.createElement(
            'ul',
            { className: 'max-h-64 overflow-y-auto custom-scrollbar' },
            filteredDialCodes.map((country, index) =>
                React.createElement(
                    'li',
                    {
                        key: index,
                        onClick: () => {
                            onSelect(country.dialCode);
                            onClose();
                        },
                        className: `flex items-center justify-between p-3 cursor-pointer hover:bg-gray-100 rounded-lg transition-colors ${selectedDialCode === country.dialCode ? 'bg-gray-100 font-semibold' : ''}`
                    },
                    React.createElement('span', null, `${country.name} (${country.code})`),
                    React.createElement('span', { className: `text-${roleColor}-600` }, country.dialCode)
                )
            )
        )
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


/**
 * Hlavný komponent modálneho okna pre úpravu profilu.
 * @param {object} props - Vlastnosti komponentu.
 * @param {boolean} props.show - Riadi viditeľnosť modálneho okna.
 * @param {function} props.onClose - Callback funkcia pre zatvorenie modálneho okna.
 * @param {object} props.userProfileData - Aktuálne dáta používateľského profilu.
 * @param {string} props.roleColor - Farba priradená role používateľa.
 * @param {function} props.onProfileUpdated - Callback funkcia, ktorá sa spustí po úspešnej aktualizácii profilu.
 */
export const ChangeProfileModal = ({ show, onClose, userProfileData, roleColor, onProfileUpdated }) => {
    const [originalData, setOriginalData] = useState({});
    const [formData, setFormData] = useState({});
    const [loading, setLoading] = useState(false);
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showDialCodeModal, setShowDialCodeModal] = useState(false);
    const [selectedDialCode, setSelectedDialCode] = useState(userProfileData.contactPhoneNumber ? countryDialCodes.find(c => userProfileData.contactPhoneNumber.startsWith(c.dialCode))?.dialCode : '+421');
    const [contactPhoneNumber, setContactPhoneNumber] = useState(userProfileData.contactPhoneNumber ? userProfileData.contactPhoneNumber.substring(selectedDialCode.length) : '');
    const [reauthRequired, setReauthRequired] = useState(false);

    // Načítanie počiatočných dát pri otvorení
    useEffect(() => {
        if (show && userProfileData) {
            const initialData = {
                firstName: userProfileData.firstName || '',
                lastName: userProfileData.lastName || '',
                email: userProfileData.email || '',
                contactPhoneNumber: userProfileData.contactPhoneNumber || '',
                billing: {
                    clubName: userProfileData.billing?.clubName || '',
                    street: userProfileData.billing?.street || '',
                    houseNumber: userProfileData.billing?.houseNumber || '',
                    city: userProfileData.billing?.city || '',
                    postalCode: userProfileData.billing?.postalCode || '',
                    country: userProfileData.billing?.country || '',
                    ico: userProfileData.billing?.ico || '',
                    dic: userProfileData.billing?.dic || '',
                    icDph: userProfileData.billing?.icDph || '',
                },
                role: userProfileData.role
            };
            setOriginalData(initialData);
            setFormData(initialData);
            setReauthRequired(false);
            setPassword('');
            setShowPassword(false);

            // Nastavenie predvolenej predvoľby a čísla
            const phone = userProfileData.contactPhoneNumber || '';
            const matchingDialCode = countryDialCodes
                .sort((a, b) => b.dialCode.length - a.dialCode.length)
                .find(c => phone.startsWith(c.dialCode));
            
            setSelectedDialCode(matchingDialCode ? matchingDialCode.dialCode : '+421');
            setContactPhoneNumber(matchingDialCode ? phone.substring(matchingDialCode.dialCode.length) : phone);
        }
    }, [show, userProfileData]);

    // Funkcia na zistenie, či sa formulár zmenil
    const isFormChanged = () => {
        return (
            formData.firstName !== originalData.firstName ||
            formData.lastName !== originalData.lastName ||
            (formData.email !== originalData.email && formData.email !== '') ||
            (selectedDialCode + contactPhoneNumber) !== originalData.contactPhoneNumber ||
            (formData.billing?.clubName !== originalData.billing?.clubName) ||
            (formData.billing?.street !== originalData.billing?.street) ||
            (formData.billing?.houseNumber !== originalData.billing?.houseNumber) ||
            (formData.billing?.city !== originalData.billing?.city) ||
            (formData.billing?.postalCode !== originalData.billing?.postalCode) ||
            (formData.billing?.country !== originalData.billing?.country) ||
            (formData.billing?.ico !== originalData.billing?.ico) ||
            (formData.billing?.dic !== originalData.billing?.dic) ||
            (formData.billing?.icDph !== originalData.billing?.icDph)
        );
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name.startsWith('billing.')) {
            const billingField = name.split('.')[1];
            setFormData(prevData => ({
                ...prevData,
                billing: {
                    ...prevData.billing,
                    [billingField]: value
                }
            }));
        } else {
            setFormData(prevData => ({
                ...prevData,
                [name]: value
            }));
        }
    };
    
    // Funkcia na spracovanie odoslania formulára
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        const auth = getAuth();
        const user = auth.currentUser;
        const db = getFirestore();

        if (!user) {
            window.showGlobalNotification('Používateľ nie je prihlásený.', 'error');
            setLoading(false);
            return;
        }

        try {
            // Re-autentifikácia, ak sa mení e-mail
            if (formData.email !== originalData.email) {
                if (!reauthRequired) {
                    setReauthRequired(true);
                    setLoading(false);
                    return;
                }

                if (!password) {
                    window.showGlobalNotification('Pre zmenu e-mailu je potrebné zadať heslo.', 'error');
                    setLoading(false);
                    return;
                }

                const credential = EmailAuthProvider.credential(user.email, password);
                await reauthenticateWithCredential(user, credential);
                console.log("Re-autentifikácia úspešná.");
            }

            const profileRef = doc(db, 'artifacts', window.__app_id, 'users', user.uid);
            const updatedData = {
                firstName: formData.firstName || null,
                lastName: formData.lastName || null,
                contactPhoneNumber: (selectedDialCode + contactPhoneNumber) || null,
                billing: {
                    clubName: formData.billing?.clubName || null,
                    street: formData.billing?.street || null,
                    houseNumber: formData.billing?.houseNumber || null,
                    city: formData.billing?.city || null,
                    postalCode: formData.billing?.postalCode || null,
                    country: formData.billing?.country || null,
                    ico: formData.billing?.ico || null,
                    dic: formData.billing?.dic || null,
                    icDph: formData.billing?.icDph || null,
                }
            };
            
            // Orezanie prázdnych hodnôt a nastavenie na null
            Object.keys(updatedData).forEach(key => {
                if (updatedData[key] === '') updatedData[key] = null;
            });
            if(updatedData.billing) {
                Object.keys(updatedData.billing).forEach(key => {
                    if (updatedData.billing[key] === '') updatedData.billing[key] = null;
                });
            }


            await updateDoc(profileRef, updatedData);

            // Aktualizácia e-mailu
            if (formData.email !== originalData.email && formData.email) {
                await verifyBeforeUpdateEmail(user, formData.email);
                window.showGlobalNotification('Profil bol aktualizovaný a na novú e-mailovú adresu bol odoslaný overovací e-mail. Prosím, overte ho.', 'success');
            } else {
                 window.showGlobalNotification('Profil bol úspešne aktualizovaný.', 'success');
            }

            // Aktualizácia stavu v rodičovskom komponente
            onProfileUpdated({
                ...userProfileData,
                ...updatedData,
                email: formData.email
            });
            
        } catch (error) {
            console.error('Chyba pri aktualizácii profilu:', error);
            window.showGlobalNotification(`Chyba: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    // Header modálneho okna
    const ModalHeader = React.createElement(
        'div',
        { className: `flex items-center justify-between p-6 rounded-t-xl`, style: { backgroundColor: roleColor } },
        React.createElement(
            'h3',
            { className: 'text-lg font-semibold text-white' },
            'Upraviť profil'
        ),
        React.createElement(
            'button',
            { type: 'button', onClick: onClose, className: 'text-white hover:text-gray-200 transition-colors' },
            React.createElement(
                'svg',
                { className: 'h-6 w-6', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M6 18L18 6M6 6l12 12' })
            )
        )
    );

    // Obsah modálneho okna
    const ModalContent = React.createElement(
        'div',
        { className: 'p-6' },
        React.createElement('form', { onSubmit: handleSubmit },
            React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                // Meno a priezvisko
                React.createElement('div', { className: 'mb-4' },
                    React.createElement('label', { htmlFor: 'firstName', className: 'block text-sm font-medium text-gray-700' }, 'Meno'),
                    React.createElement('input', {
                        type: 'text',
                        name: 'firstName',
                        id: 'firstName',
                        value: formData.firstName,
                        onChange: handleChange,
                        placeholder: userProfileData.firstName || '',
                        className: `mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-${roleColor}-500 focus:ring-${roleColor}-500 sm:text-sm px-4 py-2`
                    })
                ),
                React.createElement('div', { className: 'mb-4' },
                    React.createElement('label', { htmlFor: 'lastName', className: 'block text-sm font-medium text-gray-700' }, 'Priezvisko'),
                    React.createElement('input', {
                        type: 'text',
                        name: 'lastName',
                        id: 'lastName',
                        value: formData.lastName,
                        onChange: handleChange,
                        placeholder: userProfileData.lastName || '',
                        className: `mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-${roleColor}-500 focus:ring-${roleColor}-500 sm:text-sm px-4 py-2`
                    })
                ),
                // Email
                React.createElement('div', { className: 'md:col-span-2 mb-4' },
                    React.createElement('label', { htmlFor: 'email', className: 'block text-sm font-medium text-gray-700' }, 'E-mailová adresa'),
                    React.createElement('input', {
                        type: 'email',
                        name: 'email',
                        id: 'email',
                        value: formData.email,
                        onChange: handleChange,
                        placeholder: userProfileData.email || '',
                        className: `mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-${roleColor}-500 focus:ring-${roleColor}-500 sm:text-sm px-4 py-2`
                    })
                ),
                // Telefónne číslo
                React.createElement('div', { className: 'md:col-span-2 mb-4' },
                    React.createElement('label', { htmlFor: 'contactPhoneNumber', className: 'block text-sm font-medium text-gray-700' }, 'Telefónne číslo'),
                    React.createElement('div', { className: 'mt-1 flex rounded-md shadow-sm' },
                        React.createElement('div', { className: 'relative' },
                            React.createElement('button', {
                                type: 'button',
                                onClick: () => setShowDialCodeModal(true),
                                className: `relative inline-flex items-center rounded-l-md border border-r-0 border-gray-300 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:z-10 focus:border-${roleColor}-500 focus:outline-none focus:ring-1 focus:ring-${roleColor}-500 transition duration-150 ease-in-out`
                            }, selectedDialCode),
                        ),
                        React.createElement('input', {
                            type: 'text',
                            name: 'contactPhoneNumber',
                            id: 'contactPhoneNumber',
                            value: contactPhoneNumber,
                            onChange: (e) => setContactPhoneNumber(e.target.value),
                            placeholder: userProfileData.contactPhoneNumber ? userProfileData.contactPhoneNumber.substring(selectedDialCode.length) : '',
                            className: `flex-1 block w-full rounded-r-md border-gray-300 shadow-sm focus:border-${roleColor}-500 focus:ring-${roleColor}-500 sm:text-sm px-4 py-2`
                        })
                    )
                ),
                // Fakturačné údaje
                React.createElement('div', { className: 'md:col-span-2' },
                    React.createElement('h4', { className: 'text-md font-semibold text-gray-900 mb-2' }, 'Fakturačné údaje'),
                    React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                        React.createElement('div', { className: 'mb-4' },
                            React.createElement('label', { htmlFor: 'billing.clubName', className: 'block text-sm font-medium text-gray-700' }, 'Oficiálny názov klubu'),
                            React.createElement('input', {
                                type: 'text',
                                name: 'billing.clubName',
                                id: 'billing.clubName',
                                value: formData.billing?.clubName || '',
                                onChange: handleChange,
                                placeholder: userProfileData.billing?.clubName || '',
                                className: `mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-${roleColor}-500 focus:ring-${roleColor}-500 sm:text-sm px-4 py-2`
                            })
                        ),
                        React.createElement('div', { className: 'mb-4' },
                            React.createElement('label', { htmlFor: 'billing.street', className: 'block text-sm font-medium text-gray-700' }, 'Ulica'),
                            React.createElement('input', {
                                type: 'text',
                                name: 'billing.street',
                                id: 'billing.street',
                                value: formData.billing?.street || '',
                                onChange: handleChange,
                                placeholder: userProfileData.billing?.street || '',
                                className: `mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-${roleColor}-500 focus:ring-${roleColor}-500 sm:text-sm px-4 py-2`
                            })
                        ),
                        React.createElement('div', { className: 'mb-4' },
                            React.createElement('label', { htmlFor: 'billing.houseNumber', className: 'block text-sm font-medium text-gray-700' }, 'Číslo domu'),
                            React.createElement('input', {
                                type: 'text',
                                name: 'billing.houseNumber',
                                id: 'billing.houseNumber',
                                value: formData.billing?.houseNumber || '',
                                onChange: handleChange,
                                placeholder: userProfileData.billing?.houseNumber || '',
                                className: `mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-${roleColor}-500 focus:ring-${roleColor}-500 sm:text-sm px-4 py-2`
                            })
                        ),
                        React.createElement('div', { className: 'mb-4' },
                            React.createElement('label', { htmlFor: 'billing.city', className: 'block text-sm font-medium text-gray-700' }, 'Mesto'),
                            React.createElement('input', {
                                type: 'text',
                                name: 'billing.city',
                                id: 'billing.city',
                                value: formData.billing?.city || '',
                                onChange: handleChange,
                                placeholder: userProfileData.billing?.city || '',
                                className: `mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-${roleColor}-500 focus:ring-${roleColor}-500 sm:text-sm px-4 py-2`
                            })
                        ),
                        React.createElement('div', { className: 'mb-4' },
                            React.createElement('label', { htmlFor: 'billing.postalCode', className: 'block text-sm font-medium text-gray-700' }, 'PSČ'),
                            React.createElement('input', {
                                type: 'text',
                                name: 'billing.postalCode',
                                id: 'billing.postalCode',
                                value: formData.billing?.postalCode || '',
                                onChange: handleChange,
                                placeholder: userProfileData.billing?.postalCode || '',
                                className: `mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-${roleColor}-500 focus:ring-${roleColor}-500 sm:text-sm px-4 py-2`
                            })
                        ),
                        React.createElement('div', { className: 'mb-4' },
                            React.createElement('label', { htmlFor: 'billing.country', className: 'block text-sm font-medium text-gray-700' }, 'Krajina'),
                            React.createElement('input', {
                                type: 'text',
                                name: 'billing.country',
                                id: 'billing.country',
                                value: formData.billing?.country || '',
                                onChange: handleChange,
                                placeholder: userProfileData.billing?.country || '',
                                className: `mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-${roleColor}-500 focus:ring-${roleColor}-500 sm:text-sm px-4 py-2`
                            })
                        ),
                        React.createElement('div', { className: 'mb-4' },
                            React.createElement('label', { htmlFor: 'billing.ico', className: 'block text-sm font-medium text-gray-700' }, 'IČO'),
                            React.createElement('input', {
                                type: 'text',
                                name: 'billing.ico',
                                id: 'billing.ico',
                                value: formData.billing?.ico || '',
                                onChange: handleChange,
                                placeholder: userProfileData.billing?.ico || '',
                                className: `mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-${roleColor}-500 focus:ring-${roleColor}-500 sm:text-sm px-4 py-2`
                            })
                        ),
                        React.createElement('div', { className: 'mb-4' },
                            React.createElement('label', { htmlFor: 'billing.dic', className: 'block text-sm font-medium text-gray-700' }, 'DIČ'),
                            React.createElement('input', {
                                type: 'text',
                                name: 'billing.dic',
                                id: 'billing.dic',
                                value: formData.billing?.dic || '',
                                onChange: handleChange,
                                placeholder: userProfileData.billing?.dic || '',
                                className: `mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-${roleColor}-500 focus:ring-${roleColor}-500 sm:text-sm px-4 py-2`
                            })
                        ),
                        React.createElement('div', { className: 'mb-4' },
                            React.createElement('label', { htmlFor: 'billing.icDph', className: 'block text-sm font-medium text-gray-700' }, 'IČ DPH'),
                            React.createElement('input', {
                                type: 'text',
                                name: 'billing.icDph',
                                id: 'billing.icDph',
                                value: formData.billing?.icDph || '',
                                onChange: handleChange,
                                placeholder: userProfileData.billing?.icDph || '',
                                className: `mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-${roleColor}-500 focus:ring-${roleColor}-500 sm:text-sm px-4 py-2`
                            })
                        )
                    )
                )
            ),
            // Re-autentifikácia
            reauthRequired && React.createElement('div', { className: 'mt-6' },
                React.createElement(PasswordInput, {
                    id: 'password',
                    label: 'Pre overenie zadajte svoje heslo',
                    value: password,
                    onChange: (e) => setPassword(e.target.value),
                    placeholder: 'Heslo',
                    showPassword: showPassword,
                    toggleShowPassword: () => setShowPassword(!showPassword),
                    roleColor: roleColor
                })
            ),
            // Tlačidlá
            React.createElement(
                'div',
                { className: 'mt-6 flex justify-end space-x-3' },
                React.createElement('button', {
                    type: 'button',
                    onClick: onClose,
                    className: `px-6 py-2.5 rounded-full text-gray-700 hover:bg-gray-200 transition duration-150 ease-in-out`
                }, 'Zrušiť'),
                React.createElement('button', {
                    type: 'submit',
                    disabled: loading || !isFormChanged(),
                    className: `px-6 py-2.5 rounded-full shadow-lg transition-all duration-300 hover:scale-105 focus:outline-none`,
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
