// logged-in-my-data.js
// Tento súbor bol upravený tak, aby správne interpretoval štruktúru dát profilu používateľa,
// najmä pokiaľ ide o fakturačné údaje a adresu.

// Predvoľby krajín sa načítajú z globálnej premennej countryDialCodes
// definovanej v countryDialCodes.js. Pre prípad, že súbor nie je načítaný, použijeme prázdne pole.
const countryDialCodes = window.countryDialCodes || [];

// Definícia pomocných komponentov, ktoré sa používajú v App komponente
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

// Funkcia na formátovanie telefónneho čísla s medzerami
const formatPhoneNumber = (phoneNumber) => {
    if (!phoneNumber) return 'Nezadané';

    // Odstránime všetky nečíselné znaky okrem '+' na začiatku
    let cleaned = phoneNumber.replace(/[^0-9+]/g, '');
    let dialCode = '';
    let numberPart = cleaned;

    // Hľadáme najdlhšiu zhodu pre predvoľbu
    const sortedDialCodes = countryDialCodes.sort((a, b) => b.dialCode.length - a.dialCode.length);
    for (const code of sortedDialCodes) {
        if (cleaned.startsWith(code.dialCode)) {
            dialCode = code.dialCode;
            numberPart = cleaned.substring(dialCode.length);
            break;
        }
    }

    // Ak sa nájde predvoľba a zvyšná časť čísla má aspoň 9 číslic
    if (dialCode && numberPart.length >= 9) {
        // Formátujeme zvyšnú časť čísla ako `xxx xxx xxx`
        const match = numberPart.match(/^(\d{3})(\d{3})(\d{3})$/);
        if (match) {
            return `${dialCode} ${match[1]} ${match[2]} ${match[3]}`;
        }
    }

    // Ak sa nepodarilo formátovať, vrátime pôvodné číslo
    return phoneNumber;
};

// Funkcia na určenie farby hlavičky na základe roly
const getHeaderColor = (role) => {
    switch (role) {
      case 'admin':
        return '#47b3ff'; // admin
      case 'hall':
        return '#b06835'; // hall
      case 'user':
        return '#9333EA'; // user
      default:
        return '#1D4ED8'; // default
    }
};

// Funkcia na formátovanie PSČ na "xxx xx"
const formatPostalCode = (postalCode) => {
    if (!postalCode) return 'Nezadané';
    const cleaned = String(postalCode).replace(/\s/g, ''); // Odstránime medzery
    const match = cleaned.match(/^(\d{3})(\d{2})$/);
    if (match) {
        return `${match[1]} ${match[2]}`;
    }
    return postalCode; // Vráti pôvodné, ak sa nepodarí formátovať
};

// Funkcia na vykreslenie fakturačných údajov a adresy
const renderBillingAndAddressInfo = (userProfileData, headerColor) => {
    // Teraz kontrolujeme existenciu objektu 'billing' A tiež kľúčových polí pre adresu
    const hasBillingData = userProfileData && userProfileData.billing && Object.keys(userProfileData.billing).length > 0;
    const hasAddressData = userProfileData && userProfileData.street && userProfileData.city && userProfileData.postalCode && userProfileData.country;

    // Ak nie sú k dispozícii žiadne údaje, nevytvárame žiadny element.
    if (!hasBillingData && !hasAddressData) {
        return null;
    }

    // Ak existujú fakturačné údaje alebo adresa, vytvoríme samostatnú kartu
    return React.createElement(
        'div',
        { className: 'bg-white rounded-lg shadow-lg mt-8' },
        React.createElement(
            'div',
            { className: 'p-6 rounded-t-lg text-white font-bold', style: { backgroundColor: headerColor } }, // Použijeme dynamickú farbu z parametra
            React.createElement(
                'h2',
                { className: 'text-2xl' },
                'Fakturačné údaje'
            )
        ),
        React.createElement(
            'div',
            { className: 'p-6' },
            // Zobrazí fakturačné údaje
            hasBillingData && React.createElement(React.Fragment, null,
                React.createElement(
                    'p',
                    { className: 'text-gray-800' },
                    React.createElement('span', { className: 'font-bold' }, 'Oficiálny názov klubu:'),
                    ` ${userProfileData.billing.clubName}`
                )
            ),

            // Spojená fakturačná adresa
            hasAddressData && React.createElement(
                'p',
                { className: 'text-gray-800' },
                React.createElement('span', { className: 'font-bold' }, 'Adresa:'),
                ` ${userProfileData.street} ${userProfileData.houseNumber}, ${formatPostalCode(userProfileData.postalCode)} ${userProfileData.city}, ${userProfileData.country}`
            ),

            // Zobrazí ďalšie fakturačné údaje
            hasBillingData && React.createElement(React.Fragment, null,
                React.createElement(
                    'p',
                    { className: 'text-gray-800 mt-2' },
                    React.createElement('span', { className: 'font-bold' }, 'IČO:'),
                    ` ${userProfileData.billing.ico}`
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-800' },
                    React.createElement('span', { className: 'font-bold' }, 'DIČ:'),
                    ` ${userProfileData.billing.dic}`
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-800' },
                    React.createElement('span', { className: 'font-bold' }, 'IČ DPH:'),
                    ` ${userProfileData.billing.icDPH || '-'}`
                ),
            )
        )
    );
};


// Main React component for the logged-in-my-data.html page
function MyDataApp() {
    const [userProfileData, setUserProfileData] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');

    React.useEffect(() => {
        const handleDataUpdate = (event) => {
            console.log("MyDataApp: Prijatá globálna udalosť 'globalDataUpdated'. Aktualizujem stav.");
            setUserProfileData(event.detail);
            setLoading(false);
        };

        window.addEventListener('globalDataUpdated', handleDataUpdate);

        if (window.isGlobalAuthReady) {
            if (window.globalUserProfileData !== null) {
                console.log("MyDataApp: Dáta už sú dostupné pri inicializácii. Nastavujem stav.");
                setUserProfileData(window.globalUserProfileData);
            } else {
                console.log("MyDataApp: Autentifikácia dokončená, ale používateľské dáta neexistujú.");
            }
            setLoading(false);
        }

        return () => {
            window.removeEventListener('globalDataUpdated', handleDataUpdate);
        };
    }, []);

    if (loading) {
        return React.createElement(Loader, null);
    }
    
    if (error) {
        return React.createElement(ErrorMessage, { message: error });
    }

    if (!userProfileData) {
        return React.createElement(
            'div',
            { className: 'p-8 text-center text-gray-500' },
            'Neboli nájdené žiadne údaje o vašom profile.'
        );
    }

    const headerColor = getHeaderColor(userProfileData.role);

    return React.createElement(
        'div',
        { className: 'container mx-auto p-8 max-w-4xl' },
        React.createElement(
            'div',
            { className: 'bg-white rounded-lg shadow-lg' },
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
                    React.createElement('span', { className: 'font-bold' }, 'Meno a priezvisko:'),
                    ` ${userProfileData.firstName || ''} ${userProfileData.lastName || ''}`.trim()
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg' },
                    React.createElement('span', { className: 'font-bold' }, 'E-mailová adresa:'),
                    ` ${userProfileData.email}`
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg' },
                    React.createElement('span', { className: 'font-bold' }, 'Telefónne číslo:'),
                    ` ${formatPhoneNumber(userProfileData.contactPhoneNumber)}`
                ),
            )
        ),
        renderBillingAndAddressInfo(userProfileData, headerColor)
    );
}

// Export pre možnosť načítania v HTML
window.MyDataApp = MyDataApp;
