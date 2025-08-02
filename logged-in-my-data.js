// logged-in-my-data.js
// Tento súbor spravuje React komponent MyDataApp, ktorý zobrazuje
// profilové a registračné dáta prihláseného používateľa.
// Bol upravený tak, aby ukladal zmeny do Cloud Firestore a reagoval na zmeny v reálnom čase,
// pričom využíva globálne inštancie Firebase z 'authentication.js'.

const { useState, useEffect } = React;

/**
 * Pomocný komponent pre načítavanie dát.
 */
const Loader = () => {
    return React.createElement(
        'div',
        { className: 'flex justify-center pt-16' },
        React.createElement(
            'div',
            { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' }
        )
    );
};

/**
 * Pomocný komponent pre zobrazenie chybovej správy.
 * @param {object} props - Vlastnosti komponentu.
 * @param {string} props.message - Chybová správa na zobrazenie.
 */
const ErrorMessage = ({ message }) => {
    return React.createElement(
        'div',
        { className: 'flex justify-center pt-16' },
        React.createElement(
            'div',
            { className: 'p-8 bg-red-100 border-l-4 border-red-500 text-red-700 rounded-lg shadow-md' },
            React.createElement('p', { className: 'font-bold' }, 'Chyba'),
            React.createElement('p', null, message)
        )
    );
};

/**
 * Pomocná funkcia na formátovanie telefónneho čísla s použitím predvolieb.
 * @param {string} phoneNumber - Telefónne číslo na formátovanie.
 * @returns {string} Formátované telefónne číslo.
 */
const formatPhoneNumber = (phoneNumber) => {
    if (!phoneNumber) return '';

    const cleaned = phoneNumber.replace(/\D/g, '');

    const foundDialCode = window.countryDialCodes.find(item => {
        const dialCodeWithoutPlus = item.dialCode.replace('+', '');
        return cleaned.startsWith(dialCodeWithoutPlus);
    });

    if (foundDialCode) {
        const dialCodeWithoutPlus = foundDialCode.dialCode.replace('+', '');
        const numberWithoutDialCode = cleaned.substring(dialCodeWithoutPlus.length);
        const formattedNumber = numberWithoutDialCode.replace(/(\d{3})(?=\d)/g, '$1 ');
        
        return `${foundDialCode.dialCode} ${formattedNumber}`;
    }

    const match = cleaned.match(/^(\d{4})(\d{3})(\d{3})$/);
    if (match) {
        return `+${match[1]} ${match[2]} ${match[3]}`;
    }

    return phoneNumber;
};

/**
 * Funkcia na získanie farby hlavičky na základe role používateľa.
 * @param {string} role - Rola používateľa ('admin', 'hall', 'user').
 * @returns {string} Hex kód farby.
 */
const getRoleColor = (role) => {
    switch (role) {
        case 'admin':
            return '#47b3ff';
        case 'hall':
            return '#b06835';
        case 'user':
            return '#9333EA';
        default:
            return '#374151';
    }
};

/**
 * Komponent pre modálne okno na úpravu fakturačných údajov.
 */
const EditBillingModal = ({ userProfileData, isOpen, onClose }) => {
    const [formData, setFormData] = useState({
        clubName: userProfileData.billing?.clubName || '',
        ico: userProfileData.billing?.ico || '',
        dic: userProfileData.billing?.dic || '',
        icDph: userProfileData.billing?.icDph || '',
        street: userProfileData.street || '',
        houseNumber: userProfileData.houseNumber || '',
        city: userProfileData.city || '',
        postalCode: userProfileData.postalCode || '',
        country: userProfileData.country || '',
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prevData => ({ ...prevData, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const db = window.db;
        const auth = window.auth;

        if (!db || !auth || !auth.currentUser) {
            console.error("Firestore nie je inicializovaný alebo používateľ nie je prihlásený.");
            return;
        }

        const userId = auth.currentUser.uid;
        // Pevne zadefinovaná cesta na základe štruktúry databázy v 'authentication.js'
        const userDocRef = doc(db, 'users', userId);
        
        try {
            // Použitie setDoc s merge: true, aby sa aktualizovali len zadané polia
            await setDoc(userDocRef, {
                billing: {
                    clubName: formData.clubName,
                    ico: formData.ico,
                    dic: formData.dic,
                    icDph: formData.icDph,
                },
                street: formData.street,
                houseNumber: formData.houseNumber,
                city: formData.city,
                postalCode: formData.postalCode,
                country: formData.country,
            }, { merge: true });
            console.log("Fakturačné údaje boli úspešne uložené!");
            onClose();
        } catch (error) {
            console.error("Chyba pri ukladaní fakturačných údajov: ", error);
            // Tu by sa mohla zobraziť chybová správa používateľovi
        }
    };

    if (!isOpen) return null;

    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center' },
        React.createElement(
            'div',
            { className: 'bg-white p-8 rounded-lg shadow-xl m-4 max-w-md w-full' },
            React.createElement(
                'div',
                { className: 'flex justify-end' },
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
                { onSubmit: handleSubmit },
                React.createElement(
                    'h3',
                    { className: 'text-2xl font-bold mb-4 text-gray-800' },
                    'Upraviť fakturačné údaje'
                ),
                React.createElement('div', { className: 'mb-4' },
                    React.createElement('label', { htmlFor: 'clubName', className: 'block text-gray-700 text-sm font-bold mb-2' }, 'Názov klubu'),
                    React.createElement('input', { type: 'text', id: 'clubName', name: 'clubName', value: formData.clubName, onChange: handleChange, className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700' })
                ),
                React.createElement('div', { className: 'mb-4' },
                    React.createElement('label', { htmlFor: 'street', className: 'block text-gray-700 text-sm font-bold mb-2' }, 'Ulica'),
                    React.createElement('input', { type: 'text', id: 'street', name: 'street', value: formData.street, onChange: handleChange, className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700' })
                ),
                React.createElement('div', { className: 'mb-4' },
                    React.createElement('label', { htmlFor: 'houseNumber', className: 'block text-gray-700 text-sm font-bold mb-2' }, 'Číslo domu'),
                    React.createElement('input', { type: 'text', id: 'houseNumber', name: 'houseNumber', value: formData.houseNumber, onChange: handleChange, className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700' })
                ),
                React.createElement('div', { className: 'mb-4' },
                    React.createElement('label', { htmlFor: 'city', className: 'block text-gray-700 text-sm font-bold mb-2' }, 'Mesto'),
                    React.createElement('input', { type: 'text', id: 'city', name: 'city', value: formData.city, onChange: handleChange, className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700' })
                ),
                React.createElement('div', { className: 'mb-4' },
                    React.createElement('label', { htmlFor: 'postalCode', className: 'block text-gray-700 text-sm font-bold mb-2' }, 'PSČ'),
                    React.createElement('input', { type: 'text', id: 'postalCode', name: 'postalCode', value: formData.postalCode, onChange: handleChange, className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700' })
                ),
                React.createElement('div', { className: 'mb-4' },
                    React.createElement('label', { htmlFor: 'ico', className: 'block text-gray-700 text-sm font-bold mb-2' }, 'IČO'),
                    React.createElement('input', { type: 'text', id: 'ico', name: 'ico', value: formData.ico, onChange: handleChange, className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700' })
                ),
                React.createElement('div', { className: 'mb-4' },
                    React.createElement('label', { htmlFor: 'dic', className: 'block text-gray-700 text-sm font-bold mb-2' }, 'DIČ'),
                    React.createElement('input', { type: 'text', id: 'dic', name: 'dic', value: formData.dic, onChange: handleChange, className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700' })
                ),
                React.createElement('div', { className: 'mb-6' },
                    React.createElement('label', { htmlFor: 'icDph', className: 'block text-gray-700 text-sm font-bold mb-2' }, 'IČ DPH'),
                    React.createElement('input', { type: 'text', id: 'icDph', name: 'icDph', value: formData.icDph, onChange: handleChange, className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700' })
                ),
                React.createElement(
                    'div',
                    { className: 'flex items-center justify-between' },
                    React.createElement(
                        'button',
                        {
                            type: 'submit',
                            className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline',
                        },
                        'Uložiť zmeny'
                    ),
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: onClose,
                            className: 'inline-block align-baseline font-bold text-sm text-blue-500 hover:text-blue-800',
                        },
                        'Zrušiť'
                    )
                )
            )
        )
    );
};

/**
 * Komponent pre modálne okno na úpravu kontaktných údajov.
 */
const EditContactModal = ({ userProfileData, isOpen, onClose, isUserAdmin }) => {
    const [formData, setFormData] = useState({
        firstName: userProfileData.firstName || '',
        lastName: userProfileData.lastName || '',
        contactPhoneNumber: userProfileData.contactPhoneNumber || '',
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prevData => ({ ...prevData, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const db = window.db;
        const auth = window.auth;

        if (!db || !auth || !auth.currentUser) {
            console.error("Firestore nie je inicializovaný alebo používateľ nie je prihlásený.");
            return;
        }
        
        const userId = auth.currentUser.uid;
        // Pevne zadefinovaná cesta na základe štruktúry databázy v 'authentication.js'
        const userDocRef = doc(db, 'users', userId);

        try {
            await setDoc(userDocRef, {
                firstName: formData.firstName,
                lastName: formData.lastName,
                contactPhoneNumber: formData.contactPhoneNumber,
            }, { merge: true });
            console.log("Kontaktné údaje boli úspešne uložené!");
            onClose();
        } catch (error) {
            console.error("Chyba pri ukladaní kontaktných údajov: ", error);
        }
    };

    if (!isOpen) return null;

    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center' },
        React.createElement(
            'div',
            { className: 'bg-white p-8 rounded-lg shadow-xl m-4 max-w-md w-full' },
            React.createElement(
                'div',
                { className: 'flex justify-end' },
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
                { onSubmit: handleSubmit },
                React.createElement(
                    'h3',
                    { className: 'text-2xl font-bold mb-4 text-gray-800' },
                    'Upraviť kontaktné údaje'
                ),
                React.createElement(
                    'div',
                    { className: 'mb-4' },
                    React.createElement(
                        'label',
                        { htmlFor: 'firstName', className: 'block text-gray-700 text-sm font-bold mb-2' },
                        'Meno'
                    ),
                    React.createElement('input', {
                        type: 'text',
                        id: 'firstName',
                        name: 'firstName',
                        value: formData.firstName,
                        onChange: handleChange,
                        className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
                    })
                ),
                React.createElement(
                    'div',
                    { className: 'mb-4' },
                    React.createElement(
                        'label',
                        { htmlFor: 'lastName', className: 'block text-gray-700 text-sm font-bold mb-2' },
                        'Priezvisko'
                    ),
                    React.createElement('input', {
                        type: 'text',
                        id: 'lastName',
                        name: 'lastName',
                        value: formData.lastName,
                        onChange: handleChange,
                        className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
                    })
                ),
                !isUserAdmin && React.createElement(
                    'div',
                    { className: 'mb-6' },
                    React.createElement(
                        'label',
                        { htmlFor: 'contactPhoneNumber', className: 'block text-gray-700 text-sm font-bold mb-2' },
                        'Telefónne číslo'
                    ),
                    React.createElement('input', {
                        type: 'text',
                        id: 'contactPhoneNumber',
                        name: 'contactPhoneNumber',
                        value: formData.contactPhoneNumber,
                        onChange: handleChange,
                        className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
                    })
                ),
                React.createElement(
                    'div',
                    { className: 'flex items-center justify-between' },
                    React.createElement(
                        'button',
                        {
                            type: 'submit',
                            className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline',
                        },
                        'Uložiť zmeny'
                    ),
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: onClose,
                            className: 'inline-block align-baseline font-bold text-sm text-blue-500 hover:text-blue-800',
                        },
                        'Zrušiť'
                    )
                )
            )
        )
    );
};

/**
 * Komponent pre zobrazenie informácií o prihlásenom používateľovi.
 */
const MyDataApp = () => {
    const [userProfileData, setUserProfileData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isEditContactModalOpen, setIsEditContactModalOpen] = useState(false);
    const [isEditBillingModalOpen, setIsEditBillingModalOpen] = useState(false);
    
    useEffect(() => {
        // Počúva na globálnu udalosť, ktorá signalizuje, že dáta sú pripravené
        const handleGlobalDataUpdated = (event) => {
            if (event.detail) {
                setUserProfileData(event.detail);
                setIsLoading(false);
            } else {
                setError('Nie ste prihlásený. Prosím, prihláste sa, aby ste videli svoje údaje.');
                setIsLoading(false);
            }
        };

        window.addEventListener('globalDataUpdated', handleGlobalDataUpdated);

        // Ak už dáta existujú, nastavíme ich okamžite
        if (window.isGlobalAuthReady && window.globalUserProfileData) {
            setUserProfileData(window.globalUserProfileData);
            setIsLoading(false);
        } else if (window.isGlobalAuthReady && !window.globalUserProfileData) {
             setError('Nie ste prihlásený. Prosím, prihláste sa, aby ste videli svoje údaje.');
             setIsLoading(false);
        }

        return () => {
            window.removeEventListener('globalDataUpdated', handleGlobalDataUpdated);
        };
    }, []);
    
    if (isLoading) {
        return React.createElement(Loader);
    }

    if (error) {
        return React.createElement(ErrorMessage, { message: error });
    }

    if (!userProfileData) {
        return React.createElement(ErrorMessage, { message: 'Nie ste prihlásený. Prosím, prihláste sa, aby ste videli svoje údaje.' });
    }

    const isUserAdmin = userProfileData.role === 'admin';
    const headerColor = getRoleColor(userProfileData.role);

    // Komponent na zobrazenie fakturačných údajov
    const renderBillingAndAddressInfo = (data, color) => {
        const hasBillingInfo = data.billing && Object.keys(data.billing).length > 0;
        
        const postalCode = data.postalCode || '';
        const formattedPostalCode = postalCode.length === 5 ? `${postalCode.substring(0, 3)} ${postalCode.substring(3)}` : postalCode;

        return React.createElement(
            'div',
            { className: 'bg-white rounded-lg shadow-xl overflow-hidden mb-8' },
            React.createElement(
                'div',
                { className: 'p-4 text-white font-bold text-xl flex justify-between items-center', style: { backgroundColor: color } },
                React.createElement(
                    'h3',
                    null,
                    'Fakturačné údaje'
                ),
                React.createElement(
                    'button',
                    { onClick: () => setIsEditBillingModalOpen(true), className: 'text-white hover:text-gray-200 transition-colors duration-200' },
                    React.createElement(
                        'svg',
                        { className: 'h-6 w-6', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L15.232 5.232z' })
                    )
                )
            ),
            React.createElement(
                'div',
                { className: 'p-6' },
                hasBillingInfo ? 
                React.createElement(
                    React.Fragment,
                    null,
                    React.createElement(
                        'p',
                        { className: 'text-gray-800 text-lg' },
                        React.createElement('span', { className: 'font-bold' }, 'Oficiálny názov klubu:'),
                        ` ${data.billing.clubName}`
                    ),
                    React.createElement(
                        'p',
                        { className: 'text-gray-800 text-lg' },
                        React.createElement('span', { className: 'font-bold' }, 'Adresa:'),
                        ` ${data.street || ''} ${data.houseNumber || ''}, ${formattedPostalCode} ${data.city || ''}, ${data.country || ''}`.trim()
                    ),
                    React.createElement(
                        'p',
                        { className: 'text-gray-800 text-lg' },
                        React.createElement('span', { className: 'font-bold' }, 'IČO:'),
                        ` ${data.billing.ico}`
                    ),
                    React.createElement(
                        'p',
                        { className: 'text-gray-800 text-lg' },
                        React.createElement('span', { className: 'font-bold' }, 'DIČ:'),
                        ` ${data.billing.dic}`
                    ),
                    React.createElement(
                        'p',
                        { className: 'text-gray-800 text-lg' },
                        React.createElement('span', { className: 'font-bold' }, 'IČ DPH:'),
                        ` ${data.billing.icDph || '-'}`
                    )
                ) :
                React.createElement(
                    'p',
                    { className: 'text-gray-600' },
                    'Fakturačné údaje nie sú k dispozícii.'
                )
            )
        );
    };

    return React.createElement(
        'div',
        { className: 'container mx-auto p-4 md:p-8 lg:p-12 max-w-4xl' },
        React.createElement(
            'div',
            { className: 'space-y-8' },
            React.createElement(
                'div',
                { className: 'bg-white rounded-lg shadow-xl overflow-hidden' },
                React.createElement(
                    'div',
                    { className: 'p-4 text-white font-bold text-xl flex justify-between items-center', style: { backgroundColor: headerColor } },
                    React.createElement(
                        'h3',
                        null,
                        'Kontaktná osoba'
                    ),
                    React.createElement(
                        'button',
                        { onClick: () => setIsEditContactModalOpen(true), className: 'text-white hover:text-gray-200 transition-colors duration-200' },
                        React.createElement(
                            'svg',
                            { className: 'h-6 w-6', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                            React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L15.232 5.232z' })
                        )
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'p-6' },
                    React.createElement(
                        'p',
                        { className: 'text-gray-800 text-lg' },
                        React.createElement('span', { className: 'font-bold' }, 'Meno a priezvisko: '),
                        ` ${userProfileData.firstName || ''} ${userProfileData.lastName || ''}`.trim()
                    ),
                    React.createElement(
                        'p',
                        { className: 'text-gray-800 text-lg' },
                        React.createElement('span', { className: 'font-bold' }, 'E-mailová adresa:'),
                        ` ${userProfileData.email}`
                    ),
                    !isUserAdmin && React.createElement(
                        'p',
                        { className: 'text-gray-800 text-lg' },
                        React.createElement('span', { className: 'font-bold' }, 'Telefónne číslo:'),
                        ` ${formatPhoneNumber(userProfileData.contactPhoneNumber)}`
                    ),
                )
            ),
            renderBillingAndAddressInfo(userProfileData, headerColor)
        ),
        React.createElement(EditContactModal, {
            userProfileData: userProfileData,
            isOpen: isEditContactModalOpen,
            onClose: () => setIsEditContactModalOpen(false),
            isUserAdmin: isUserAdmin
        }),
        React.createElement(EditBillingModal, {
            userProfileData: userProfileData,
            isOpen: isEditBillingModalOpen,
            onClose: () => setIsEditBillingModalOpen(false)
        })
    );
};

// Export pre možnosť načítania v HTML
window.MyDataApp = MyDataApp;
