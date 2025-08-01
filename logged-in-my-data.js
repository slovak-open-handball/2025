// logged-in-my-data.js
// Tento súbor bol upravený, aby počkal na dáta odoslané globálnou udalosťou z authentication.js.
// Spravuje zobrazenie profilových a fakturačných dát na základe prijatých dát.

// Zoznam predvolieb, zoradený zostupne podľa dĺžky pre správne rozpoznávanie
const countryDialCodes = [
    { code: 'SK', dialCode: '+421' },
    { code: 'CZ', dialCode: '+420' },
    // A ďalšie predvoľby podľa potreby...
    // Pre účely príkladu stačia tieto
];

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

// Funkcia na vykreslenie fakturačných údajov a adresy
const renderBillingAndAddressInfo = (userProfileData) => {
    if (!userProfileData || (!userProfileData.billingInfo && !userProfileData.billingAddress)) {
        return null;
    }

    // Ak existujú fakturačné údaje alebo adresa, vytvoríme samostatnú kartu
    return React.createElement(
        'div',
        { className: 'bg-white rounded-lg shadow-lg mt-8' },
        React.createElement(
            'div',
            { className: 'p-6 rounded-t-lg text-white font-bold', style: { backgroundColor: '#1D4ED8' } },
            React.createElement(
                'h2',
                { className: 'text-2xl' },
                'Moje fakturačné údaje a adresa'
            )
        ),
        React.createElement(
            'div',
            { className: 'p-6' },
            // Zobrazí fakturačné údaje
            userProfileData.billingInfo && React.createElement(React.Fragment, null,
                React.createElement(
                    'h3',
                    { className: 'text-xl font-bold mb-2 text-gray-800' },
                    'Fakturačné údaje'
                ),
                React.createElement(
                    'div',
                    { className: 'p-4 bg-gray-100 rounded-lg shadow-inner mb-4' },
                    React.createElement(
                        'p',
                        { className: 'text-gray-800' },
                        React.createElement('span', { className: 'font-bold' }, 'Názov spoločnosti:'),
                        ` ${userProfileData.billingInfo.companyName}`
                    ),
                    React.createElement(
                        'p',
                        { className: 'text-gray-800' },
                        React.createElement('span', { className: 'font-bold' }, 'IČO:'),
                        ` ${userProfileData.billingInfo.ico}`
                    ),
                    React.createElement(
                        'p',
                        { className: 'text-gray-800' },
                        React.createElement('span', { className: 'font-bold' }, 'DIČ:'),
                        ` ${userProfileData.billingInfo.dic}`
                    ),
                    userProfileData.billingInfo.icDPH && React.createElement(
                        'p',
                        { className: 'text-gray-800' },
                        React.createElement('span', { className: 'font-bold' }, 'IČ DPH:'),
                        ` ${userProfileData.billingInfo.icDPH}`
                    ),
                    React.createElement(
                        'p',
                        { className: 'text-gray-800' },
                        React.createElement('span', { className: 'font-bold' }, 'Bankový účet:'),
                        ` ${userProfileData.billingInfo.bankAccount}`
                    ),
                )
            ),

            // Zobrazí fakturačnú adresu
            userProfileData.billingAddress && React.createElement(React.Fragment, null,
                React.createElement(
                    'h3',
                    { className: 'text-xl font-bold mb-2 text-gray-800' },
                    'Fakturačná adresa'
                ),
                React.createElement(
                    'div',
                    { className: 'p-4 bg-gray-100 rounded-lg shadow-inner' },
                    React.createElement(
                        'p',
                        { className: 'text-gray-800' },
                        React.createElement('span', { className: 'font-bold' }, 'Ulica a číslo:'),
                        ` ${userProfileData.billingAddress.street} ${userProfileData.billingAddress.streetNumber}`
                    ),
                    React.createElement(
                        'p',
                        { className: 'text-gray-800' },
                        React.createElement('span', { className: 'font-bold' }, 'Mesto:'),
                        ` ${userProfileData.billingAddress.city}`
                    ),
                    React.createElement(
                        'p',
                        { className: 'text-gray-800' },
                        React.createElement('span', { className: 'font-bold' }, 'PSČ:'),
                        ` ${userProfileData.billingAddress.zipCode}`
                    ),
                    React.createElement(
                        'p',
                        { className: 'text-gray-800' },
                        React.createElement('span', { className: 'font-bold' }, 'Krajina:'),
                        ` ${userProfileData.billingAddress.country}`
                    )
                )
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
                userProfileData.role === 'admin' || userProfileData.role === 'hall' ? (
                    React.createElement(React.Fragment, null,
                        React.createElement(
                            'p',
                            { className: 'text-gray-800 text-lg' },
                            React.createElement('span', { className: 'font-bold' }, 'Názov:'),
                            ` ${userProfileData.firstName}`
                        ),
                        React.createElement(
                            'p',
                            { className: 'text-gray-800 text-lg' },
                            React.createElement('span', { className: 'font-bold' }, 'E-mailová adresa:'),
                            ` ${userProfileData.email}`
                        )
                    )
                ) : (
                    React.createElement(React.Fragment, null,
                        React.createElement(
                            'p',
                            { className: 'text-gray-800 text-lg' },
                            React.createElement('span', { className: 'font-bold' }, 'Meno a priezvisko kontaktnej osoby:'),
                            ` ${userProfileData.firstName} ${userProfileData.lastName}`
                        ),
                        React.createElement(
                            'p',
                            { className: 'text-gray-800 text-lg' },
                            React.createElement('span', { className: 'font-bold' }, 'E-mailová adresa kontaktnej osoby:'),
                            ` ${userProfileData.email}`
                        ),
                        React.createElement(
                            'p',
                            { className: 'text-gray-800 text-lg' },
                            React.createElement('span', { className: 'font-bold' }, 'Telefónne číslo kontaktnej osoby:'),
                            ` ${formatPhoneNumber(userProfileData.contactPhoneNumber)}`
                        )
                    )
                )
            )
        ),
        renderBillingAndAddressInfo(userProfileData)
    );
}

// Export pre možnosť načítania v HTML
window.MyDataApp = MyDataApp;
