// logged-in-my-data.js
// Tento súbor spravuje React komponent MyDataApp, ktorý zobrazuje
// profilové a registračné dáta prihláseného používateľa.
// Bol upravený tak, aby správne reagoval na globálnu udalosť 'globalDataUpdated'
// a zobrazoval dáta až po ich úplnom načítaní.
// Boli pridané zmeny pre dynamickú farbu hlavičiek na základe role používateľa,
// vylepšená logika pre zobrazenie fakturačných údajov,
// pridané tlačidlo na úpravu údajov a modálne okno.
// Tieto zmeny rešpektujú pôvodnú architektúru a opravujú chybu oprávnení.

const { useState, useEffect } = React;

/**
 * Pomocný komponent pre načítavanie dát.
 */
const Loader = () => {
    return React.createElement(
        // Zmenené na vycentrovanie obsahu na vrchu obrazovky
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
        // Zmenené na vycentrovanie obsahu na vrchu obrazovky
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
 * Pomocná funkcia pre formátovanie telefónneho čísla do čitateľného formátu.
 * @param {string} phoneNumber - Telefónne číslo na formátovanie.
 * @returns {string} - Formátované telefónne číslo.
 */
const formatPhoneNumber = (phoneNumber) => {
    if (!phoneNumber) return '';
    const cleaned = ('' + phoneNumber).replace(/\D/g, '');
    const match = cleaned.match(/^(\d{4})(\d{3})(\d{3})$/);
    if (match) {
        return `+${match[1]} ${match[2]} ${match[3]}`;
    }
    return phoneNumber;
};

/**
 * Pomocný komponent na zobrazenie fakturačných a adresných údajov.
 */
const renderBillingAndAddressInfo = (userProfileData, headerColor) => {
    if (!userProfileData || userProfileData.isUserAdmin) {
        return null;
    }
    return React.createElement(
        'div',
        { className: `p-6 rounded-lg shadow-lg ${headerColor} mt-8` },
        React.createElement(
            'h3',
            { className: 'text-xl font-bold text-white mb-4' },
            'Fakturačné a adresné údaje'
        ),
        React.createElement(
            'div',
            { className: 'bg-white p-4 rounded-md shadow' },
            React.createElement(
                'p',
                { className: 'text-gray-800 text-lg' },
                React.createElement('span', { className: 'font-bold' }, 'Ulica a číslo:'),
                ` ${userProfileData.billingAddress?.street || ''} ${userProfileData.billingAddress?.houseNumber || ''}`
            ),
            React.createElement(
                'p',
                { className: 'text-gray-800 text-lg' },
                React.createElement('span', { className: 'font-bold' }, 'Mesto:'),
                ` ${userProfileData.billingAddress?.city || ''}`
            ),
            React.createElement(
                'p',
                { className: 'text-gray-800 text-lg' },
                React.createElement('span', { className: 'font-bold' }, 'PSČ:'),
                ` ${userProfileData.billingAddress?.zipCode || ''}`
            )
        )
    );
};

/**
 * Komponent na úpravu kontaktných údajov. Toto je placeholder,
 * skutočná implementácia by bola zložitejšia. Slúži na demonštráciu.
 */
const EditContactModal = ({ userProfileData, isOpen, onClose, isUserAdmin, showNotification }) => {
    if (!isOpen) return null;
    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center' },
        React.createElement(
            'div',
            { className: 'bg-white p-8 rounded-lg shadow-xl max-w-lg w-full' },
            React.createElement('h3', { className: 'text-xl font-bold mb-4' }, 'Upraviť kontaktné údaje'),
            React.createElement('p', null, 'Funkcia úpravy kontaktu bude implementovaná.'),
            React.createElement(
                'button',
                {
                    className: 'mt-4 bg-red-500 text-white py-2 px-4 rounded',
                    onClick: onClose
                },
                'Zavrieť'
            )
        )
    );
};

/**
 * Komponent na úpravu fakturačných údajov. Tiež placeholder.
 */
const EditBillingModal = ({ userProfileData, isOpen, onClose, showNotification }) => {
    if (!isOpen) return null;
    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center' },
        React.createElement(
            'div',
            { className: 'bg-white p-8 rounded-lg shadow-xl max-w-lg w-full' },
            React.createElement('h3', { className: 'text-xl font-bold mb-4' }, 'Upraviť fakturačné údaje'),
            React.createElement('p', null, 'Funkcia úpravy fakturácie bude implementovaná.'),
            React.createElement(
                'button',
                {
                    className: 'mt-4 bg-red-500 text-white py-2 px-4 rounded',
                    onClick: onClose
                },
                'Zavrieť'
            )
        )
    );
};

/**
 * Hlavný React komponent MyDataApp, ktorý zobrazuje profilové dáta.
 */
function MyDataApp() {
    const [userProfileData, setUserProfileData] = useState(window.globalUserProfileData);
    const [loading, setLoading] = useState(!window.isGlobalAuthReady);
    const [error, setError] = useState(null);
    const [isEditContactModalOpen, setIsEditContactModalOpen] = useState(false);
    const [isEditBillingModalOpen, setIsEditBillingModalOpen] = useState(false);
    const [notification, setNotification] = useState({ message: '', type: '' });

    // Funkcia na zobrazenie notifikácie, odovzdávaná modálom
    const showNotification = (message, type = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification({ message: '', type: '' }), 5000); // Skryť po 5 sekundách
    };
    
    useEffect(() => {
        const handleGlobalDataUpdate = (event) => {
            const data = event.detail;
            if (data) {
                setUserProfileData(data);
                setLoading(false);
                setError(null);
            } else {
                setUserProfileData(null);
                setLoading(false);
                setError('Profil používateľa nebol nájdený alebo nie ste prihlásený.');
            }
        };

        // Pridáme listener, ktorý bude počúvať zmeny globálnych dát.
        window.addEventListener('globalDataUpdated', handleGlobalDataUpdate);

        // Pre prípad, že udalosť už prebehla pred pripojením listenera.
        if (window.isGlobalAuthReady) {
            handleGlobalDataUpdate({ detail: window.globalUserProfileData });
        } else {
            setLoading(true);
        }

        return () => {
            window.removeEventListener('globalDataUpdated', handleGlobalDataUpdate);
        };
    }, []);

    if (loading) {
        return React.createElement(Loader, null);
    }

    if (error) {
        return React.createElement(ErrorMessage, { message: error });
    }

    const isUserAdmin = userProfileData?.isUserAdmin;
    const headerColor = isUserAdmin ? 'bg-red-600' : 'bg-blue-600';

    return React.createElement(
        'div',
        { className: 'container mx-auto px-4 sm:px-6 lg:px-8 py-8' },
        notification.message && React.createElement(
            'div',
            { className: `mb-4 p-4 rounded-md ${notification.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}` },
            notification.message
        ),
        React.createElement(
            'div',
            { className: `bg-white p-8 rounded-xl shadow-lg mt-8` },
            React.createElement(
                'div',
                { className: `p-6 rounded-lg shadow-lg ${headerColor} mb-8 flex justify-between items-center` },
                React.createElement(
                    'h2',
                    { className: 'text-2xl font-bold text-white' },
                    'Môj profil'
                ),
                React.createElement(
                    'button',
                    {
                        className: 'px-4 py-2 bg-white text-blue-600 rounded-md shadow hover:bg-gray-100 transition-colors',
                        onClick: () => setIsEditContactModalOpen(true),
                    },
                    'Upraviť'
                )
            ),
            React.createElement(
                'div',
                { className: 'space-y-4' },
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
            ),
            renderBillingAndAddressInfo(userProfileData, headerColor)
        ),
        React.createElement(EditContactModal, {
            userProfileData: userProfileData,
            isOpen: isEditContactModalOpen,
            onClose: () => setIsEditContactModalOpen(false),
            isUserAdmin: isUserAdmin,
            showNotification: showNotification,
        }),
        React.createElement(EditBillingModal, {
            userProfileData: userProfileData,
            isOpen: isEditBillingModalOpen,
            onClose: () => setIsEditBillingModalOpen(false),
            showNotification: showNotification,
        })
    );
}

// Explicitne sprístupniť komponent globálne
window.MyDataApp = MyDataApp;
