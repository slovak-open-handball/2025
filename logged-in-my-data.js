// logged-in-my-data.js
// Tento súbor spravuje React komponent MyDataApp, ktorý zobrazuje
// profilové a registračné dáta prihláseného používateľa.
// Bol upravený, aby správne reagoval na globálnu udalosť 'globalDataUpdated'
// a zobrazoval dáta až po ich úplnom načítaní.

// Predvoľby krajín sa načítajú z globálnej premennej countryDialCodes
// definovanej v countryDialCodes.js.
const countryDialCodes = window.countryDialCodes || [];

const { useState, useEffect } = React;

/**
 * Pomocný komponent pre načítavanie dát.
 */
const Loader = () => {
    return React.createElement(
        'div',
        { className: 'flex justify-center items-center h-screen' },
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
        { className: 'flex justify-center items-center h-screen' },
        React.createElement(
            'div',
            { className: 'p-8 bg-red-100 border-l-4 border-red-500 text-red-700 rounded-lg shadow-md max-w-md' },
            React.createElement('p', { className: 'font-bold' }, 'Chyba pri načítaní dát'),
            React.createElement('p', null, message)
        )
    );
};

/**
 * Pomocná funkcia na formátovanie telefónneho čísla.
 * @param {string} phoneNumber - Telefónne číslo na formátovanie.
 * @returns {string} Formátované telefónne číslo.
 */
const formatPhoneNumber = (phoneNumber) => {
    if (!phoneNumber) return '';
    const code = countryDialCodes.find(c => phoneNumber.startsWith(c.dial_code));
    if (code) {
        return `(${code.dial_code}) ${phoneNumber.substring(code.dial_code.length)}`;
    }
    return phoneNumber;
};

/**
 * Pomocný komponent na vykreslenie informácií o adrese a fakturácii.
 * @param {object} userProfileData - Profilové dáta používateľa.
 * @param {string} headerColor - Farba hlavičky.
 * @returns {object} React element.
 */
const renderBillingAndAddressInfo = (userProfileData, headerColor) => {
    // S kontrolou voliteľných reťazcov predchádzame chybám pri prázdnych dátach
    const hasAddress = userProfileData?.address?.street || userProfileData?.address?.city || userProfileData?.address?.zip || userProfileData?.address?.country;
    const hasBilling = userProfileData?.billingAddress?.companyName || userProfileData?.billingAddress?.ico || userProfileData?.billingAddress?.dic || userProfileData?.billingAddress?.icdph;

    const isUserAdmin = userProfileData?.role === 'admin';

    // Ak používateľ nie je admin a nemá žiadne registračné dáta
    if (!isUserAdmin && !hasAddress && !hasBilling) {
        return null; // Nič nevraciame, ak nie sú žiadne dáta
    }

    return React.createElement(
        'div',
        { className: 'bg-white rounded-lg shadow-xl overflow-hidden mb-6' },
        React.createElement(
            'div',
            { className: 'p-6 rounded-t-lg text-white font-bold', style: { backgroundColor: headerColor } },
            React.createElement(
                'h2',
                { className: 'text-2xl' },
                'Adresa a fakturačné údaje'
            )
        ),
        React.createElement(
            'div',
            { className: 'p-6' },
            // Zobrazíme sekciu s adresou, iba ak sú k nej dáta a používateľ nie je admin
            (!isUserAdmin && hasAddress) && React.createElement(
                'div',
                { className: 'mb-6' },
                React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg' },
                    React.createElement('span', { className: 'font-bold' }, 'Adresa:'),
                    ` ${userProfileData.address.street || ''}, ${userProfileData.address.city || ''}, ${userProfileData.address.zip || ''}, ${userProfileData.address.country || ''}`.trim().replace(/^,?\s*|,?\s*$/g, '') // Odstráni prebytočné čiarky
                )
            ),
            // Zobrazíme sekciu s fakturačnými údajmi, iba ak sú k nej dáta
            hasBilling && React.createElement(
                'div',
                null,
                React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg' },
                    React.createElement('span', { className: 'font-bold' }, 'Názov spoločnosti:'),
                    ` ${userProfileData.billingAddress.companyName || ''}`
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg' },
                    React.createElement('span', { className: 'font-bold' }, 'IČO:'),
                    ` ${userProfileData.billingAddress.ico || ''}`
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg' },
                    React.createElement('span', { className: 'font-bold' }, 'DIČ:'),
                    ` ${userProfileData.billingAddress.dic || ''}`
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg' },
                    React.createElement('span', { className: 'font-bold' }, 'IČ DPH:'),
                    ` ${userProfileData.billingAddress.icdph || ''}`
                )
            )
        )
    );
};

/**
 * Hlavný React komponent pre stránku "Moja zóna".
 */
const MyDataApp = () => {
    const [userProfileData, setUserProfileData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Načítanie používateľských dát z globálnej premennej po prvej inicializácii
    // a po každej zmene stavu autentifikácie.
    useEffect(() => {
        // Počúvanie na udalosť 'globalDataUpdated'
        const handleGlobalDataUpdate = () => {
            const data = window.globalUserProfileData;
            console.log("MyDataApp: Prijatá udalosť globalDataUpdated. Dáta:", data);
            if (data) {
                setUserProfileData(data);
                setLoading(false);
            } else {
                // Ak sú dáta null (napr. pri odhlásení), môžeme zobraziť chybu alebo presmerovať
                // V tomto prípade zobrazíme chybovú správu
                setUserProfileData(null);
                setError("Používateľské dáta nie sú dostupné. Skúste sa prosím prihlásiť.");
                setLoading(false);
            }
        };

        window.addEventListener('globalDataUpdated', handleGlobalDataUpdate);

        // Kontrola pri prvej renderi, pre prípad, že udalosť už bola vyslaná
        if (window.globalUserProfileData) {
            setUserProfileData(window.globalUserProfileData);
            setLoading(false);
        } else if (window.isGlobalAuthReady) {
            // Ak je auth pripravené, ale dáta nie sú, znamená to chybu alebo odhlásenie
            setError("Používateľské dáta nie sú dostupné. Skúste sa prosím prihlásiť.");
            setLoading(false);
        }

        // Cleanup funkcia pre odstránenie event listenera
        return () => {
            window.removeEventListener('globalDataUpdated', handleGlobalDataUpdate);
        };
    }, []);

    // Zobrazenie načítavača, kým sa dáta načítavajú
    if (loading) {
        return React.createElement(Loader);
    }

    // Zobrazenie chybovej správy, ak sa vyskytla chyba
    if (error) {
        return React.createElement(ErrorMessage, { message: error });
    }

    // Zobrazenie profilu, ak máme dáta
    const headerColor = userProfileData?.role === 'admin' ? '#47b3ff' : userProfileData?.role === 'hall' ? '#b06835' : '#9333EA';
    const isUserAdmin = userProfileData?.role === 'admin';

    return React.createElement(
        'div',
        { className: 'container mx-auto px-4 py-8' },
        React.createElement(
            'div',
            { className: 'bg-white rounded-lg shadow-xl overflow-hidden mb-6' },
            React.createElement(
                'div',
                { className: 'p-6 rounded-t-lg text-white font-bold', style: { backgroundColor: headerColor } },
                React.createElement(
                    'h2',
                    { className: 'text-2xl' },
                    'Môj profil'
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
                // Podmienene vykreslí riadok s telefónnym číslom, ak používateľ nie je admin
                !isUserAdmin && React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg' },
                    React.createElement('span', { className: 'font-bold' }, 'Telefónne číslo:'),
                    ` ${formatPhoneNumber(userProfileData.contactPhoneNumber)}`
                ),
            )
        ),
        renderBillingAndAddressInfo(userProfileData, headerColor)
    );
};

// Export pre možnosť načítania v HTML
window.MyDataApp = MyDataApp;
