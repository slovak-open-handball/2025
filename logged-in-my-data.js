// logged-in-my-data.js
// Tento súbor spravuje React komponent MyDataApp, ktorý zobrazuje
// profilové a registračné dáta prihláseného používateľa.
// Bol upravený, aby správne reagoval na globálnu udalosť 'globalDataUpdated'
// a zobrazoval dáta až po ich úplnom načítaní.

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
    const digits = phoneNumber.replace(/\D/g, '');

    // Použijeme databázu predvolieb z countryDialCodes.js
    if (window.countryDialCodes) {
        const countryDialCodes = window.countryDialCodes.sort((a, b) => b.dialCode.length - a.dialCode.length);
        for (const country of countryDialCodes) {
            if (phoneNumber.startsWith(country.dialCode)) {
                const numberWithoutPrefix = phoneNumber.substring(country.dialCode.length).trim().replace(/\D/g, '');
                
                if (numberWithoutPrefix.length === 9) {
                    const part1 = numberWithoutPrefix.substring(0, 3);
                    const part2 = numberWithoutPrefix.substring(3, 6);
                    const part3 = numberWithoutPrefix.substring(6, 9);
                    return `${country.dialCode} ${part1} ${part2} ${part3}`;
                }
            }
        }
    }

    // Ak nemá predvoľbu alebo sa nenašla v databáze, ale má 9 číslic, formátujeme ho ako lokálne číslo.
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
    // Skontrolujeme, či existujú fakturačné údaje alebo údaje o adrese.
    const hasBillingData = userProfileData.billing && (userProfileData.billing.clubName || userProfileData.billing.ico || userProfileData.billing.dic || userProfileData.billing.icdph);
    const hasAddressData = userProfileData.street;

    // Zobrazíme sekciu iba ak máme nejaké dáta na zobrazenie.
    if (!hasBillingData && !hasAddressData) {
        return null;
    }
    
    // Nová logika pre formátovanie adresy bez čiarky za ulicou a mestom.
    let addressParts = [];

    // Ulica a číslo domu
    const streetAndNumber = [userProfileData.street, userProfileData.houseNumber].filter(Boolean).join(' ');
    if (streetAndNumber) {
        addressParts.push(streetAndNumber);
    }

    // PSČ a Mesto - upravené poradie a čiarka za mestom
    let postalCodeAndCity = '';
    if (userProfileData.postalCode) {
        const formattedPostalCode = userProfileData.postalCode.length === 5 ?
            `${userProfileData.postalCode.substring(0, 3)} ${userProfileData.postalCode.substring(3, 5)}` :
            userProfileData.postalCode;
        postalCodeAndCity += formattedPostalCode;
    }
    if (userProfileData.city) {
        if (postalCodeAndCity) {
             postalCodeAndCity += ' ';
        }
        postalCodeAndCity += userProfileData.city;
    }
    if (postalCodeAndCity.trim() !== '') {
        addressParts.push(postalCodeAndCity);
    }

    // Krajina
    if (userProfileData.country) {
        addressParts.push(userProfileData.country);
    }

    const formattedAddress = addressParts.filter(Boolean).join(', ');

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
            // Podmienene vykreslíme údaje o fakturácii, ak existujú.
            hasBillingData && React.createElement(
                'div',
                null,
                // Upravený text na "Oficiálny názov klubu"
                React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg' },
                    React.createElement('span', { className: 'font-bold' }, 'Oficiálny názov klubu:'),
                    ` ${userProfileData.billing.clubName || '-'}`
                ),
                // Presunutý riadok s adresou pod "Oficiálny názov klubu"
                hasAddressData && React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg' },
                    React.createElement('span', { className: 'font-bold' }, 'Adresa:'),
                    ` ${formattedAddress}`
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg' },
                    React.createElement('span', { className: 'font-bold' }, 'IČO:'),
                    ` ${userProfileData.billing.ico || '-'}`
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg' },
                    React.createElement('span', { className: 'font-bold' }, 'DIČ:'),
                    ` ${userProfileData.billing.dic || '-'}`
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg' },
                    React.createElement('span', { className: 'font-bold' }, 'IČ DPH:'),
                    ` ${userProfileData.billing.icdph || '-'}`
                )
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
        // Obalíme hlavný obsah do kontajnera, aby bol vycentrovaný a odsadili sme ho od vrchu
        'div',
        { className: 'flex flex-col items-center mt-8 mb-8' },
        React.createElement(
            'div',
            { className: 'w-full max-w-4xl p-8 bg-white rounded-xl shadow-2xl space-y-8' },
            React.createElement(
                'div',
                // Odstránené sivé pozadie a tieň
                { className: 'bg-white rounded-lg overflow-hidden shadow-md' },
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
        )
    );
};

// Export pre možnosť načítania v HTML
window.MyDataApp = MyDataApp;
