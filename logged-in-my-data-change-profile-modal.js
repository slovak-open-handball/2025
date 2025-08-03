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
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.274-4.057 5.064-7 9.542-7a10.05 10.05 0 012.324.316m-2.146 1.834a3 3 0 10-4.47 4.47m.006.006L18 21m-7.062-7.062a3 3 0 11-4.243-4.243m4.243 4.243z' }),
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M9.879 16.121A3 3 0 1012 14v2m-3.121-3.121l4.242 4.242m-4.242 0a6 6 0 008.485-8.485m-4.242-4.242l4.242 4.242' })
    );

    return React.createElement(
        'div',
        { className: 'relative' },
        React.createElement(
            'label',
            { htmlFor: id, className: `block text-sm font-medium mb-1 ${disabled ? 'text-gray-400' : 'text-gray-700'}` },
            label
        ),
        React.createElement(
            'div',
            { className: 'relative' },
            React.createElement(
                'input',
                {
                    type: showPassword ? 'text' : 'password',
                    id: id,
                    value: value,
                    onChange: onChange,
                    placeholder: placeholder,
                    disabled: disabled,
                    className: `w-full px-4 py-2 pr-10 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[${roleColor}] transition-colors duration-200 ${disabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`
                }
            ),
            React.createElement(
                'button',
                {
                    type: 'button',
                    onClick: toggleShowPassword,
                    className: `absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 focus:outline-none ${disabled ? 'cursor-not-allowed' : ''}`,
                    disabled: disabled
                },
                showPassword ? EyeIcon : EyeOffIcon
            )
        )
    );
};


/**
 * Komponent pre výber predvoľby krajiny v modálnom okne.
 * @param {{show: boolean, onClose: function, onSelect: function, selectedDialCode: string, roleColor: string}} props
 */
const DialCodeModal = ({ show, onClose, onSelect, selectedDialCode, roleColor }) => {
    if (!show) return null;

    const [filter, setFilter] = useState('');
    const modalRef = useRef(null);

    // Zoznam predvolieb, ktoré filtrujeme
    const filteredCodes = countryDialCodes.filter(c =>
        c.name.toLowerCase().includes(filter.toLowerCase()) ||
        c.dialCode.includes(filter)
    );

    // Efekt na správu zatvorenia modálneho okna pomocou klávesy Esc
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        const handleOutsideClick = (e) => {
            if (modalRef.current && !modalRef.current.contains(e.target)) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        document.addEventListener('mousedown', handleOutsideClick);
        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.removeEventListener('mousedown', handleOutsideClick);
        };
    }, [onClose]);

    // Vracia modálne okno pomocou ReactDOM.createPortal, aby sa vykreslilo mimo hlavného DOM uzla
    return ReactDOM.createPortal(
        React.createElement(
            'div',
            {
                className: 'fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-[10001]',
                onClick: (e) => e.stopPropagation() // Zastavenie šírenia udalosti kliknutia na pozadie
            },
            React.createElement(
                'div',
                {
                    ref: modalRef,
                    className: 'bg-white rounded-xl shadow-xl w-full max-w-sm max-h-[80vh] mx-4 md:mx-auto overflow-hidden flex flex-col'
                },
                // Hlavička modálneho okna
                React.createElement(
                    'div',
                    { className: `flex justify-between items-center px-4 py-3 text-white sticky top-0 rounded-t-xl`, style: { backgroundColor: roleColor } },
                    React.createElement('h3', { className: 'text-lg font-semibold' }, 'Vyberte predvoľbu'),
                    React.createElement(
                        'button',
                        { onClick: onClose, className: 'text-white hover:text-gray-200 transition-colors' },
                        React.createElement('svg', { className: 'h-6 w-6', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                            React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M6 18L18 6M6 6l12 12' })
                        )
                    )
                ),
                // Pole pre vyhľadávanie
                React.createElement(
                    'div',
                    { className: 'p-4 border-b border-gray-200' },
                    React.createElement(
                        'input',
                        {
                            type: 'text',
                            placeholder: 'Hľadať krajinu alebo kód...',
                            className: 'w-full px-4 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500',
                            value: filter,
                            onChange: (e) => setFilter(e.target.value)
                        }
                    )
                ),
                // Telo modálneho okna (zoznam predvolieb)
                React.createElement(
                    'div',
                    { className: 'flex-1 overflow-y-auto' },
                    filteredCodes.map((country, index) =>
                        React.createElement(
                            'button',
                            {
                                key: index,
                                onClick: () => {
                                    onSelect(country.dialCode);
                                    onClose();
                                },
                                className: 'w-full text-left px-4 py-3 flex justify-between items-center hover:bg-gray-100 transition-colors duration-150',
                            },
                            React.createElement('span', { className: 'font-medium text-gray-800' }, country.name),
                            React.createElement('span', { className: 'text-gray-500' }, country.dialCode)
                        )
                    )
                )
            )
        ),
        document.body
    );
};


/**
 * Hlavný komponent modálneho okna pre zmenu profilu.
 */
export const ChangeProfileModal = ({ show, onClose, userProfileData, roleColor, onSaveSuccess }) => {
    const { email, name, phone, birthdate, address, city, postcode, country, gender } = userProfileData;

    // Súbor stavov na ukladanie pôvodných a nových hodnôt formulára
    const [newEmail, setNewEmail] = useState(email);
    const [newPhone, setNewPhone] = useState(phone?.substring(phone.indexOf(" ")).trim() || '');
    const [newBirthdate, setNewBirthdate] = useState(birthdate || '');
    const [newAddress, setNewAddress] = useState(address || '');
    const [newCity, setNewCity] = useState(city || '');
    const [newPostcode, setNewPostcode] = useState(postcode || '');
    const [newCountry, setNewCountry] = useState(country || '');
    const [newGender, setNewGender] = useState(gender || '');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Stavy pre prepínanie viditeľnosti hesiel
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

    // Stavy pre modálne okno výberu predvoľby
    const [showDialCodeModal, setShowDialCodeModal] = useState(false);
    const [selectedDialCode, setSelectedDialCode] = useState(phone?.substring(0, phone.indexOf(" ")) || '+421');


    // Efekt na resetovanie stavov formulára pri zmene prop `show`
    useEffect(() => {
        if (show) {
            setNewEmail(email);
            setNewPhone(phone?.substring(phone.indexOf(" ")).trim() || '');
            setNewBirthdate(birthdate || '');
            setNewAddress(address || '');
            setNewCity(city || '');
            setNewPostcode(postcode || '');
            setNewCountry(country || '');
            setNewGender(gender || '');
            setSelectedDialCode(phone?.substring(0, phone.indexOf(" ")) || '+421');

            setCurrentPassword('');
            setNewPassword('');
            setConfirmNewPassword('');
            setError('');
        }
    }, [show, userProfileData]);

    // Funkcia na kontrolu, či sa formulár zmenil
    const isFormChanged = () => {
        const phoneWithDialCode = `${selectedDialCode} ${newPhone}`.trim();
        return (
            newEmail !== email ||
            phoneWithDialCode !== (phone || '') ||
            newBirthdate !== (birthdate || '') ||
            newAddress !== (address || '') ||
            newCity !== (city || '') ||
            newPostcode !== (postcode || '') ||
            newCountry !== (country || '') ||
            newGender !== (gender || '') ||
            (newPassword !== '' && newPassword === confirmNewPassword)
        );
    };

    // Funkcia na overenie zmien hesla
    const isPasswordChanged = () => {
        return newPassword !== '' || currentPassword !== '';
    };

    // Funkcia na odoslanie formulára
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const auth = getAuth();
        const user = auth.currentUser;

        if (!user) {
            setError('Používateľ nie je prihlásený.');
            setLoading(false);
            return;
        }

        // Overenie hesiel, ak sa menia
        if (isPasswordChanged()) {
            if (!currentPassword) {
                setError('Pre zmenu hesla musíte zadať aktuálne heslo.');
                setLoading(false);
                return;
            }
            if (newPassword !== confirmNewPassword) {
                setError('Nové heslá sa nezhodujú.');
                setLoading(false);
                return;
            }
        }

        try {
            // Re-autentifikácia pre citlivé operácie
            if (isPasswordChanged() || newEmail !== email) {
                const credential = EmailAuthProvider.credential(user.email, currentPassword);
                await reauthenticateWithCredential(user, credential);
            }

            // Aktualizácia e-mailu
            if (newEmail !== email) {
                await verifyBeforeUpdateEmail(user, newEmail);
                window.showGlobalNotification('Pre potvrdenie zmeny e-mailu skontrolujte svoju novú e-mailovú adresu.', 'success');
            }

            // Aktualizácia hesla
            if (newPassword !== '' && newPassword === confirmNewPassword) {
                await user.updatePassword(newPassword);
                window.showGlobalNotification('Heslo bolo úspešne zmenené.', 'success');
            }

            // Aktualizácia profilových dát vo Firestore
            const userDocRef = doc(getFirestore(), "users", user.uid);
            const phoneWithDialCode = `${selectedDialCode} ${newPhone}`.trim();

            await updateDoc(userDocRef, {
                email: newEmail,
                phone: phoneWithDialCode,
                birthdate: newBirthdate,
                address: newAddress,
                city: newCity,
                postcode: newPostcode,
                country: newCountry,
                gender: newGender,
            });

            window.showGlobalNotification('Profilové dáta boli úspešne aktualizované.', 'success');
            onSaveSuccess(); // Zavolanie funkcie pre úspešné uloženie
            onClose();

        } catch (err) {
            console.error("Chyba pri aktualizácii profilu:", err);
            if (err.code === 'auth/wrong-password') {
                setError('Aktuálne heslo je nesprávne.');
            } else if (err.code === 'auth/email-already-in-use') {
                setError('Zadaný e-mail už používa iný účet.');
            } else if (err.code === 'auth/requires-recent-login') {
                setError('Táto operácia je citlivá a vyžaduje nedávne prihlásenie. Prosím, znova sa prihláste.');
            } else {
                setError('Nastala chyba pri aktualizácii profilu: ' + err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    // Obsah modálneho okna
    const ModalHeader = React.createElement(
        'div',
        { className: `flex justify-between items-center px-6 py-4 text-white`, style: { backgroundColor: roleColor } },
        React.createElement('h2', { className: 'text-xl font-bold' }, 'Upraviť profil'),
        React.createElement(
            'button',
            { onClick: onClose, className: 'text-white hover:text-gray-200 transition-colors' },
            React.createElement('svg', { className: 'h-6 w-6', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M6 18L18 6M6 6l12 12' })
            )
        )
    );

    const ModalContent = React.createElement(
        'div',
        { className: 'p-6 space-y-4 overflow-y-auto max-h-[70vh] md:max-h-[60vh]' },
        error && React.createElement(
            'div',
            { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md relative', role: 'alert' },
            React.createElement('span', { className: 'block sm:inline' }, error)
        ),
        // E-mail (needitovateľné, iba sa zobrazí)
        React.createElement(
            'div',
            null,
            React.createElement(
                'label',
                { htmlFor: 'email', className: 'block text-sm font-medium text-gray-700 mb-1' },
                'E-mail'
            ),
            React.createElement(
                'input',
                {
                    type: 'email',
                    id: 'email',
                    value: newEmail,
                    onChange: (e) => setNewEmail(e.target.value),
                    className: 'w-full px-4 py-2 rounded-md border border-gray-300 bg-gray-100 text-gray-400 focus:outline-none cursor-not-allowed',
                    disabled: true
                }
            )
        ),

        // Telefónne číslo
        React.createElement(
            'div',
            null,
            React.createElement(
                'label',
                { htmlFor: 'phone', className: 'block text-sm font-medium text-gray-700 mb-1' },
                'Telefónne číslo'
            ),
            React.createElement(
                'div',
                { className: 'flex items-center mt-1' },
                React.createElement(
                    'button',
                    {
                        type: 'button',
                        onClick: () => setShowDialCodeModal(true),
                        className: `bg-gray-200 px-4 py-2 rounded-l-md font-medium text-gray-700 hover:bg-gray-300 focus:outline-none`,
                        style: { backgroundColor: roleColor }
                    },
                    selectedDialCode
                ),
                // Upravené triedy pre odstránenie ľavého okraja
                React.createElement(
                    'input',
                    {
                        type: 'text',
                        id: 'phone',
                        value: newPhone,
                        onChange: (e) => setNewPhone(e.target.value),
                        className: `w-full px-4 py-2 rounded-r-md border-y border-r border-gray-300 focus:outline-none focus:ring-2 focus:ring-[${roleColor}]`,
                        placeholder: 'Telefónne číslo'
                    }
                )
            )
        ),

        // Dátum narodenia
        React.createElement(
            'div',
            null,
            React.createElement(
                'label',
                { htmlFor: 'birthdate', className: 'block text-sm font-medium text-gray-700 mb-1' },
                'Dátum narodenia'
            ),
            React.createElement(
                'input',
                {
                    type: 'date',
                    id: 'birthdate',
                    value: newBirthdate,
                    onChange: (e) => setNewBirthdate(e.target.value),
                    className: 'w-full px-4 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500'
                }
            )
        ),

        // Adresa
        React.createElement(
            'div',
            null,
            React.createElement(
                'label',
                { htmlFor: 'address', className: 'block text-sm font-medium text-gray-700 mb-1' },
                'Adresa'
            ),
            React.createElement(
                'input',
                {
                    type: 'text',
                    id: 'address',
                    value: newAddress,
                    onChange: (e) => setNewAddress(e.target.value),
                    className: 'w-full px-4 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500',
                    placeholder: 'Ulica a číslo domu'
                }
            )
        ),

        // Mesto
        React.createElement(
            'div',
            null,
            React.createElement(
                'label',
                { htmlFor: 'city', className: 'block text-sm font-medium text-gray-700 mb-1' },
                'Mesto'
            ),
            React.createElement(
                'input',
                {
                    type: 'text',
                    id: 'city',
                    value: newCity,
                    onChange: (e) => setNewCity(e.target.value),
                    className: 'w-full px-4 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500',
                    placeholder: 'Mesto'
                }
            )
        ),

        // PSČ
        React.createElement(
            'div',
            null,
            React.createElement(
                'label',
                { htmlFor: 'postcode', className: 'block text-sm font-medium text-gray-700 mb-1' },
                'PSČ'
            ),
            React.createElement(
                'input',
                {
                    type: 'text',
                    id: 'postcode',
                    value: newPostcode,
                    onChange: (e) => setNewPostcode(e.target.value),
                    className: 'w-full px-4 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500',
                    placeholder: 'PSČ'
                }
            )
        ),

        // Krajina
        React.createElement(
            'div',
            null,
            React.createElement(
                'label',
                { htmlFor: 'country', className: 'block text-sm font-medium text-gray-700 mb-1' },
                'Krajina'
            ),
            React.createElement(
                'input',
                {
                    type: 'text',
                    id: 'country',
                    value: newCountry,
                    onChange: (e) => setNewCountry(e.target.value),
                    className: 'w-full px-4 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500',
                    placeholder: 'Krajina'
                }
            )
        ),

        // Pohlavie
        React.createElement(
            'div',
            null,
            React.createElement(
                'label',
                { htmlFor: 'gender', className: 'block text-sm font-medium text-gray-700 mb-1' },
                'Pohlavie'
            ),
            React.createElement(
                'select',
                {
                    id: 'gender',
                    value: newGender,
                    onChange: (e) => setNewGender(e.target.value),
                    className: 'w-full px-4 py-2 rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'
                },
                React.createElement('option', { value: '' }, 'Vyberte pohlavie'),
                React.createElement('option', { value: 'Muž' }, 'Muž'),
                React.createElement('option', { value: 'Žena' }, 'Žena'),
                React.createElement('option', { value: 'Iné' }, 'Iné')
            )
        ),

        // Sekcia pre zmenu hesla
        React.createElement(
            'div',
            { className: 'pt-4 border-t border-gray-200' },
            React.createElement('h3', { className: 'text-lg font-semibold text-gray-800 mb-4' }, 'Zmena hesla'),
            React.createElement(PasswordInput, {
                id: 'currentPassword',
                label: 'Aktuálne heslo',
                value: currentPassword,
                onChange: (e) => setCurrentPassword(e.target.value),
                placeholder: 'Zadajte aktuálne heslo',
                showPassword: showCurrentPassword,
                toggleShowPassword: () => setShowCurrentPassword(!showCurrentPassword)
            }),
            React.createElement(PasswordInput, {
                id: 'newPassword',
                label: 'Nové heslo',
                value: newPassword,
                onChange: (e) => setNewPassword(e.target.value),
                placeholder: 'Zadajte nové heslo',
                showPassword: showNewPassword,
                toggleShowPassword: () => setShowNewPassword(!showNewPassword),
                disabled: !currentPassword
            }),
            React.createElement(PasswordInput, {
                id: 'confirmNewPassword',
                label: 'Potvrdiť nové heslo',
                value: confirmNewPassword,
                onChange: (e) => setConfirmNewPassword(e.target.value),
                placeholder: 'Potvrďte nové heslo',
                showPassword: showConfirmNewPassword,
                toggleShowPassword: () => setShowConfirmNewPassword(!showConfirmNewPassword),
                disabled: !currentPassword
            })
        ),

        // Tlačidlo na uloženie
        React.createElement(
            'button',
            {
                type: 'submit',
                onClick: handleSubmit,
                disabled: loading || !isFormChanged(),
                className: `w-full mt-4 px-6 py-3 rounded-lg font-bold transition-all duration-200 focus:outline-none`,
                style: {
                    backgroundColor: (loading || !isFormChanged()) ? '#E5E7EB' : roleColor,
                    color: (loading || !isFormChanged()) ? '#9CA3AF' : 'white',
                    border: 'none',
                    cursor: (loading || !isFormChanged()) ? 'not-allowed' : 'pointer',
                }
            },
            loading ? 'Ukladám...' : 'Uložiť zmeny'
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
