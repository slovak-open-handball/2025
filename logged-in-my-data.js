// logged-in-my-data.js
// Tento súbor spravuje React komponent MyDataApp, ktorý zobrazuje
// profilové a registračné dáta prihláseného používateľa.
// Bol opravený, aby správne reagoval na globálnu udalosť 'globalDataUpdated'
// a zobrazoval dáta až po ich úplnom načítaní.

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
            React.createElement('p', { className: 'text-xl font-bold' }, 'Chyba'),
            React.createElement('p', { className: 'mt-2' }, message)
        )
    );
};

/**
 * Pomocná funkcia na formátovanie telefónneho čísla.
 * @param {string} phoneNumber - Telefónne číslo na formátovanie.
 * @returns {string} Formátované číslo.
 */
const formatPhoneNumber = (phoneNumber) => {
    // Vráti prázdny reťazec, ak číslo nie je platné.
    if (!phoneNumber || typeof phoneNumber !== 'string') return '';
    
    // Zistíme, či je telefónne číslo vo formáte s predvoľbou.
    const hasPrefix = phoneNumber.startsWith('+');
    const digits = phoneNumber.replace(/\D/g, '');

    // Ak má predvoľbu a má dostatočnú dĺžku, sformátujeme ho.
    if (hasPrefix && digits.length > 4) {
        // Získame predvoľbu (napr. +421) a zvyšok čísla
        const prefix = digits.substring(0, digits.length - 9);
        const number = digits.substring(digits.length - 9);
        
        const part1 = number.substring(0, 3);
        const part2 = number.substring(3, 6);
        const part3 = number.substring(6, 9);
        
        return `+${prefix} ${part1} ${part2} ${part3}`;
    }

    // Ak nemá predvoľbu, ale má 9 číslic, formátujeme ho ako lokálne číslo.
    if (digits.length === 9) {
        const part1 = digits.substring(0, 3);
        const part2 = digits.substring(3, 6);
        const part3 = digits.substring(6, 9);
        return `${part1} ${part2} ${part3}`;
    }

    // Vrátime pôvodné číslo, ak formát nevyhovuje.
    return phoneNumber;
};

/**
 * Pomocný komponent na vykreslenie informácií o fakturačnej adrese.
 * @param {object} userProfileData - Dáta profilu používateľa.
 * @param {string} headerColor - Farba hlavičky pre vizuálnu konzistenciu.
 */
const renderBillingAndAddressInfo = (userProfileData, headerColor) => {
    const isUserAdmin = userProfileData && userProfileData.role === 'admin';
    const isUserTeamLeader = userProfileData && userProfileData.isTeamLeader === true;

    // Zobrazíme sekciu iba pre administrátorov alebo vedúcich tímov
    if (!isUserAdmin && !isUserTeamLeader) {
        return null;
    }
    
    // Skontrolujeme, či existujú fakturačné údaje
    if (!userProfileData.billingInfo || !userProfileData.billingAddress) {
        return null;
    }

    // Spojíme informácie o adrese pre prehľadnejšie zobrazenie
    const formattedAddress = [
        userProfileData.billingAddress.street,
        userProfileData.billingAddress.city,
        userProfileData.billingAddress.zip,
        userProfileData.billingAddress.country
    ].filter(Boolean).join(', ');

    return React.createElement(
        'div',
        { className: 'mt-8 bg-white rounded-lg shadow-md overflow-hidden' },
        React.createElement(
            'div',
            { className: 'p-4 text-white font-bold', style: { backgroundColor: headerColor } },
            React.createElement(
                'h2',
                { className: 'text-2xl' },
                'Fakturačné údaje'
            )
        ),
        React.createElement(
            'div',
            { className: 'p-6' },
            React.createElement(
                'p',
                { className: 'text-gray-800 text-lg' },
                React.createElement('span', { className: 'font-bold' }, 'Názov spoločnosti:'),
                ` ${userProfileData.billingInfo.companyName}`
            ),
            React.createElement(
                'p',
                { className: 'text-gray-800 text-lg' },
                React.createElement('span', { className: 'font-bold' }, 'IČO:'),
                ` ${userProfileData.billingInfo.companyId}`
            ),
            React.createElement(
                'p',
                { className: 'text-gray-800 text-lg' },
                React.createElement('span', { className: 'font-bold' }, 'DIČ:'),
                ` ${userProfileData.billingInfo.companyTaxId}`
            ),
            React.createElement(
                'p',
                { className: 'text-gray-800 text-lg' },
                React.createElement('span', { className: 'font-bold' }, 'Adresa:'),
                ` ${formattedAddress}`
            )
        )
    );
};

/**
 * Pomocná funkcia, ktorá vráti farbu na základe roly používateľa.
 * @param {string} role - Rola používateľa ('admin', 'hall', 'user', atď.).
 * @returns {string} - Hex kód farby.
 */
const getRoleColor = (role) => {
    const defaultColor = '#4299E1'; // Modrá pre bežného používateľa

    switch (role) {
        case 'admin':
            return '#47b3ff'; // Farba pre admina
        case 'hall':
            return '#b06835'; // Farba pre halu
        case 'user':
            return '#9333EA'; // Farba pre bežného používateľa
        default:
            return defaultColor; // Predvolená farba, ak rola nie je definovaná
    }
};

/**
 * Hlavný React komponent pre zobrazenie používateľských dát.
 */
const MyDataApp = () => {
    const [userProfileData, setUserProfileData] = useState(window.globalUserProfileData);
    const [isLoading, setIsLoading] = useState(!window.globalUserProfileData);
    const [error, setError] = useState(null);

    useEffect(() => {
        const handleDataUpdate = (event) => {
            const data = event.detail;
            if (data) {
                setUserProfileData(data);
                setIsLoading(false);
            } else {
                setError("Chyba: Dáta používateľa nie sú dostupné. Ste prihlásený?");
                setIsLoading(false);
            }
        };

        // Ak už dáta máme, nemusíme čakať.
        if (window.globalUserProfileData) {
             setIsLoading(false);
        }

        window.addEventListener('globalDataUpdated', handleDataUpdate);

        // Odstránime listener pri unmountovaní komponentu
        return () => {
            window.removeEventListener('globalDataUpdated', handleDataUpdate);
        };
    }, []);

    // Ak ešte čakáme na dáta, zobrazíme loader
    if (isLoading) {
        return React.createElement(Loader, null);
    }
    
    // Ak nastala chyba, presmerujeme na prihlasovaciu stránku
    if (error) {
        window.location.href = 'login.html';
        return React.createElement(Loader, null); // Zobrazíme loader, kým prebieha presmerovanie
    }

    // Ak nie sú dáta, ale nie je ani chyba, presmerujeme
    if (!userProfileData) {
        window.location.href = 'login.html';
        return React.createElement(Loader, null); // Zobrazíme loader kým prebieha presmerovanie
    }

    // Podmienené zobrazenie na základe roly
    const isUserAdmin = userProfileData.role === 'admin';
    const headerColor = getRoleColor(userProfileData.role);

    return React.createElement(
        'div',
        { className: 'w-full max-w-4xl p-8 bg-white rounded-xl shadow-2xl space-y-8' },
        React.createElement(
            'div',
            { className: 'bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg shadow-md text-white p-6' },
            React.createElement(
                'h1',
                { className: 'text-3xl md:text-4xl font-extrabold' },
                `Moja zóna`
            ),
            React.createElement(
                'p',
                { className: 'mt-2 text-lg font-light' },
                'Prehľad vašich osobných údajov a registrácií.'
            )
        ),
        React.createElement(
            'div',
            { className: 'bg-gray-100 rounded-lg shadow-inner overflow-hidden' },
            React.createElement(
                'div',
                { className: 'p-4 text-white font-bold', style: { backgroundColor: headerColor } },
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
