// logged-in-my-data.js
// Tento súbor spravuje React komponent MyDataApp, ktorý zobrazuje
// profilové a registračné dáta prihláseného používateľa.
// Bol upravený, aby správne reagoval na globálnu udalosť 'globalDataUpdated'
// a zobrazoval dáta až po ich úplnom načítaní.
// Boli pridané zmeny pre dynamickú farbu hlavičiek na základe role používateľa,
// vylepšená logika pre zobrazenie fakturačných údajov,
// pridané tlačidlo na úpravu údajov a modálne okno.

const { useState, useEffect, useCallback } = React;

// Overenie, či sú všetky potrebné globálne premenné dostupné
if (typeof firebaseConfig === 'undefined' || typeof __initial_auth_token === 'undefined' || typeof __app_id === 'undefined') {
    console.error("Firebase config, auth token, or app ID are not defined globally.");
    // Zobrazíme chybovú správu pre používateľa, ak globálne premenné chýbajú
    window.onload = () => {
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(React.createElement('div', { className: 'text-center text-red-500 p-4' }, 'Chyba pri inicializácii aplikácie.'));
    };
    throw new Error("Firebase config, auth token, or app ID must be defined globally.");
}

// Inicializácia Firebase
const firebaseApp = firebase.initializeApp(JSON.parse(firebaseConfig));
const auth = firebase.auth(firebaseApp);
const db = firebase.firestore(firebaseApp);

// Prihlásenie používateľa pomocou custom tokenu
if (typeof __initial_auth_token !== 'undefined') {
    auth.signInWithCustomToken(__initial_auth_token).catch((error) => {
        console.error("Failed to sign in with custom token:", error);
    });
} else {
    auth.signInAnonymously().catch((error) => {
        console.error("Failed to sign in anonymously:", error);
    });
}

// GLOBÁLNE POMOCNÉ FUNKCIE
/**
 * @param {string} phoneNumber - Telefónne číslo
 * @returns {string} - Naformátované telefónne číslo
 */
const formatPhoneNumber = (phoneNumber) => {
    // Ak je telefónne číslo prázdne alebo nedefinované, vráť prázdny reťazec
    if (!phoneNumber) {
        return '';
    }

    const cleaned = phoneNumber.replace(/\D/g, '');
    let formatted = cleaned;
    let foundDialCode = false;

    // Predpokladáme, že countryDialCodes je globálne definovaný
    if (window.countryDialCodes && Array.isArray(window.countryDialCodes)) {
        // Skúsime nájsť predvoľbu
        for (const code of window.countryDialCodes) {
            if (cleaned.startsWith(code.dialCode.replace(/\D/g, ''))) {
                const dialCodeWithoutPlus = code.dialCode.replace('+', '');
                const numberWithoutDialCode = cleaned.substring(dialCodeWithoutPlus.length);
                formatted = `${code.dialCode} ${numberWithoutDialCode.replace(/(\d{3})(?=\d)/g, '$1 ')}`;
                foundDialCode = true;
                break;
            }
        }
    }

    // Ak sa nenašla žiadna predvoľba, použijeme predvolené formátovanie
    if (!foundDialCode) {
        // Pokúsime sa formátovať ako slovenské číslo
        if (cleaned.length === 9) {
            formatted = `+421 ${cleaned.replace(/(\d{3})(?=\d)/g, '$1 ')}`;
        } else if (cleaned.length === 10) {
             formatted = cleaned.replace(/(\d{4})(?=\d)/g, '$1 ');
        } else {
            formatted = cleaned.replace(/(\d{3})(?=\d)/g, '$1 ');
        }
    }

    return formatted.trim();
};

const RoleTag = ({ role, color }) => {
    return React.createElement(
        'span',
        { className: `ml-2 inline-flex items-center px-3 py-0.5 rounded-full text-sm font-medium ${color}` },
        role
    );
};

const renderBillingAndAddressInfo = (userProfileData, headerColor) => {
    const isUserAdmin = userProfileData.role === 'admin';
    const isBillingInfoComplete = userProfileData.billingAddress && userProfileData.billingAddress.street && userProfileData.billingAddress.city && userProfileData.billingAddress.zip && userProfileData.billingAddress.country;
    const hasCompanyInfo = userProfileData.companyName || userProfileData.companyID || userProfileData.vatID;

    // Príprava dát pre zobrazenie
    const billingAddress = userProfileData.billingAddress || {};
    const companyName = userProfileData.companyName || '';
    const companyID = userProfileData.companyID || '';
    const vatID = userProfileData.vatID || '';
    const isSlovakAddress = billingAddress.country === 'Slovensko';

    // Logika zobrazenia pre adminov alebo ak údaje nie sú kompletné
    if (isUserAdmin || (!isBillingInfoComplete && !hasCompanyInfo)) {
        return React.createElement(
            'div',
            { className: 'bg-white p-6 rounded-lg shadow-md mb-6' },
            React.createElement(
                'div',
                { className: `flex items-center justify-between mb-4 border-b-2 ${headerColor} pb-2` },
                React.createElement(
                    'h2',
                    { className: 'text-2xl font-semibold text-gray-800' },
                    'Fakturačné a adresné údaje'
                ),
            ),
            React.createElement(
                'div',
                { className: 'flex items-center text-red-500' },
                React.createElement('span', { className: 'mr-2' }, '⚠️'),
                'Fakturačné údaje nie sú k dispozícii.'
            )
        );
    }
    
    return React.createElement(
        'div',
        { className: 'bg-white p-6 rounded-lg shadow-md mb-6' },
        React.createElement(
            'div',
            { className: `flex items-center justify-between mb-4 border-b-2 ${headerColor} pb-2` },
            React.createElement(
                'h2',
                { className: 'text-2xl font-semibold text-gray-800' },
                'Fakturačné a adresné údaje'
            ),
        ),
        React.createElement(
            'div',
            { className: 'space-y-4' },
            hasCompanyInfo && React.createElement(
                'div',
                { className: 'p-4 bg-gray-100 rounded-md' },
                React.createElement('h3', { className: 'text-xl font-bold mb-2' }, 'Údaje o spoločnosti'),
                companyName && React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg' },
                    React.createElement('span', { className: 'font-bold' }, 'Názov spoločnosti:'),
                    ` ${companyName}`
                ),
                companyID && React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg' },
                    React.createElement('span', { className: 'font-bold' }, 'IČO:'),
                    ` ${companyID}`
                ),
                isSlovakAddress && vatID && React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg' },
                    React.createElement('span', { className: 'font-bold' }, 'IČ DPH:'),
                    ` ${vatID}`
                )
            ),
            isBillingInfoComplete && React.createElement(
                'div',
                { className: 'p-4 bg-gray-100 rounded-md' },
                React.createElement('h3', { className: 'text-xl font-bold mb-2' }, 'Fakturačná adresa'),
                React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg' },
                    React.createElement('span', { className: 'font-bold' }, 'Ulica a číslo:'),
                    ` ${billingAddress.street}`
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg' },
                    React.createElement('span', { className: 'font-bold' }, 'Mesto:'),
                    ` ${billingAddress.city}`
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg' },
                    React.createElement('span', { className: 'font-bold' }, 'PSČ:'),
                    ` ${billingAddress.zip}`
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg' },
                    React.createElement('span', { className: 'font-bold' }, 'Krajina:'),
                    ` ${billingAddress.country}`
                )
            )
        )
    );
};

// Komponenta EditContactModal pre úpravu kontaktných údajov
const EditContactModal = ({ userProfileData, isOpen, onClose }) => {
    const [firstName, setFirstName] = useState(userProfileData.firstName || '');
    const [lastName, setLastName] = useState(userProfileData.lastName || '');
    const [phoneNumber, setPhoneNumber] = useState(userProfileData.contactPhoneNumber || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    // Synchronizácia stavu modalu s props
    useEffect(() => {
        setFirstName(userProfileData.firstName || '');
        setLastName(userProfileData.lastName || '');
        setPhoneNumber(userProfileData.contactPhoneNumber || '');
        setError(null);
        setSuccess(false);
    }, [userProfileData, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(false);

        try {
            const user = auth.currentUser;
            if (!user) {
                throw new Error('Používateľ nie je prihlásený.');
            }

            const userDocRef = db.collection(`artifacts/${__app_id}/users`).doc(user.uid);
            await userDocRef.update({
                firstName: firstName,
                lastName: lastName,
                contactPhoneNumber: phoneNumber,
            });

            setSuccess(true);
            setTimeout(() => {
                onClose();
            }, 2000);
        } catch (err) {
            console.error("Chyba pri aktualizácii údajov:", err);
            setError('Nepodarilo sa uložiť zmeny. Skúste to prosím znova.');
        } finally {
            setLoading(false);
        }
    };

    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50' },
        React.createElement(
            'div',
            { className: 'relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white' },
            React.createElement(
                'div',
                { className: 'mt-3 text-center' },
                React.createElement(
                    'h3',
                    { className: 'text-lg leading-6 font-medium text-gray-900' },
                    'Upraviť kontaktné údaje'
                ),
                React.createElement(
                    'form',
                    { onSubmit: handleSubmit, className: 'mt-2 space-y-4' },
                    React.createElement(
                        'div',
                        null,
                        React.createElement('label', { htmlFor: 'firstName', className: 'block text-sm font-medium text-gray-700 text-left' }, 'Meno'),
                        React.createElement('input', {
                            type: 'text',
                            id: 'firstName',
                            value: firstName,
                            onChange: (e) => setFirstName(e.target.value),
                            className: 'mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm',
                            required: true
                        })
                    ),
                    React.createElement(
                        'div',
                        null,
                        React.createElement('label', { htmlFor: 'lastName', className: 'block text-sm font-medium text-gray-700 text-left' }, 'Priezvisko'),
                        React.createElement('input', {
                            type: 'text',
                            id: 'lastName',
                            value: lastName,
                            onChange: (e) => setLastName(e.target.value),
                            className: 'mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm',
                            required: true
                        })
                    ),
                    React.createElement(
                        'div',
                        null,
                        React.createElement('label', { htmlFor: 'phoneNumber', className: 'block text-sm font-medium text-gray-700 text-left' }, 'Telefónne číslo'),
                        React.createElement('input', {
                            type: 'tel',
                            id: 'phoneNumber',
                            value: phoneNumber,
                            onChange: (e) => setPhoneNumber(e.target.value),
                            className: 'mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm',
                        })
                    ),
                    error && React.createElement(
                        'p',
                        { className: 'text-red-500 text-sm' },
                        error
                    ),
                    success && React.createElement(
                        'p',
                        { className: 'text-green-500 text-sm' },
                        'Zmeny boli úspešne uložené!'
                    ),
                    React.createElement(
                        'div',
                        { className: 'mt-4 flex justify-end gap-2' },
                        React.createElement(
                            'button',
                            {
                                type: 'button',
                                onClick: onClose,
                                className: 'px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300'
                            },
                            'Zrušiť'
                        ),
                        React.createElement(
                            'button',
                            {
                                type: 'submit',
                                className: 'px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400',
                                disabled: loading
                            },
                            loading ? 'Ukladám...' : 'Uložiť'
                        )
                    )
                )
            )
        )
    );
};

const MyDataApp = () => {
    const [userProfileData, setUserProfileData] = useState(window.globalUserProfileData);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    useEffect(() => {
        const handleDataUpdate = (event) => {
            console.log("MyDataApp: Prijaté nové dáta, aktualizujem stav.", event.detail);
            setUserProfileData(event.detail);
        };
        window.addEventListener('globalDataUpdated', handleDataUpdate);
        return () => {
            window.removeEventListener('globalDataUpdated', handleDataUpdate);
        };
    }, []);

    // Zobrazenie loaderu, ak dáta ešte neboli načítané
    if (!userProfileData) {
        return React.createElement(Loader, null);
    }

    const isUserAdmin = userProfileData.role === 'admin';
    const headerColor = isUserAdmin ? 'border-red-500' : 'border-blue-500';

    const handleEditClick = useCallback(() => {
        setIsEditModalOpen(true);
    }, []);

    const EditButton = () => (
        React.createElement(
            'button',
            {
                onClick: handleEditClick,
                className: 'px-4 py-2 text-sm font-semibold rounded-lg shadow-md transition-colors duration-200 bg-blue-500 text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
            },
            'Upraviť údaje'
        )
    );

    return React.createElement(
        'div',
        { className: 'container mx-auto p-4 sm:p-6 lg:p-8' },
        React.createElement(
            'h1',
            { className: 'text-3xl font-bold text-gray-800 mb-6' },
            'Moje osobné údaje',
            React.createElement(RoleTag, { role: userProfileData.role, color: isUserAdmin ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800' })
        ),
        React.createElement(
            'div',
            { className: 'grid grid-cols-1 md:grid-cols-2 gap-6' },
            React.createElement(
                'div',
                { className: 'bg-white p-6 rounded-lg shadow-md mb-6' },
                React.createElement(
                    'div',
                    { className: `flex items-center justify-between mb-4 border-b-2 ${headerColor} pb-2` },
                    React.createElement(
                        'h2',
                        { className: 'text-2xl font-semibold text-gray-800' },
                        'Kontaktné údaje'
                    ),
                    React.createElement(EditButton, null)
                ),
                React.createElement(
                    'div',
                    { className: 'space-y-2' },
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
                    // Podmienene vykreslí riadok s telefónnym číslom, ak používateľ nie je admin
                    !isUserAdmin && userProfileData.contactPhoneNumber && React.createElement(
                        'p',
                        { className: 'text-gray-800 text-lg' },
                        React.createElement('span', { className: 'font-bold' }, 'Telefónne číslo:'),
                        ` ${formatPhoneNumber(userProfileData.contactPhoneNumber)}`
                    )
                )
            ),
            renderBillingAndAddressInfo(userProfileData, headerColor)
        ),
        React.createElement(EditContactModal, {
            userProfileData: userProfileData,
            isOpen: isEditModalOpen,
            onClose: () => setIsEditModalOpen(false)
        })
    );
};

// Export pre možnosť načítania v HTML
window.MyDataApp = MyDataApp;
