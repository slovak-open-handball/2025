// logged-in-my-data.js
// Tento súbor predpokladá, že Firebase SDK je inicializovaný v <head> logged-in-my-data.html
// a authentication.js spravuje globálnu autentifikáciu a stav používateľa.
// Zoznam predvolieb pre telefónne čísla sa teraz načíta z 'countryDialCodes.js'.

// Funkcia na formátovanie telefónneho čísla
const formatPhoneNumber = (phoneNumber) => {
    // Zoznam predvolieb sa teraz načítava z globálnej premennej.
    const countryDialCodes = window.countryDialCodes || [];

    if (!phoneNumber) return '-';

    // Pokúsime sa nájsť predvoľbu
    const foundCode = countryDialCodes.find(item => phoneNumber.startsWith(item.dialCode));
    if (foundCode) {
        const numberWithoutDialCode = phoneNumber.substring(foundCode.dialCode.length);
        return `${foundCode.dialCode} ${numberWithoutDialCode.replace(/(\d{3})(?=\d)/g, '$1 ')}`;
    }

    // Ak predvoľba nebola nájdená, formátujeme len číslo
    return phoneNumber.replace(/(\d{3})(?=\d)/g, '$1 ');
};

// Nová funkcia na formátovanie PSČ na "xxx xx"
const formatPostalCode = (postalCode) => {
    if (!postalCode || postalCode.length !== 5) {
        return postalCode || '-';
    }
    return `${postalCode.substring(0, 3)} ${postalCode.substring(3, 5)}`;
};

// Pomocná funkcia na renderovanie fakturačných údajov a adresy
const renderBillingAndAddressInfo = (userProfileData, headerColor) => {
    // Upravená podmienka: Skontrolujeme, či existujú nejaké zmysluplné údaje
    const hasBillingData = userProfileData.billing && Object.values(userProfileData.billing).some(value => value);
    const hasAddressData = userProfileData.address && Object.values(userProfileData.address).some(value => value);

    if (!hasBillingData && !hasAddressData) {
        return null;
    }

    const { billing, address } = userProfileData;

    // Vytvoríme formátovanú adresu s formátovaným PSČ
    const formattedAddress = address ? `${address.street || ''} ${address.houseNumber || ''}, ${formatPostalCode(address.postalCode)} ${address.city || ''}, ${address.country || ''}`.trim() : null;

    return React.createElement(
        'div',
        // Použitie inline štýlu pre farbu borderu
        { className: 'bg-white rounded-lg shadow-lg p-6 mt-6 border-t-4', style: { borderColor: headerColor } },
        React.createElement(
            'h2',
            { className: 'text-2xl font-semibold mb-4 text-gray-800' },
            'Fakturačné údaje'
        ),
        billing && React.createElement(
            'div',
            { className: 'space-y-4 text-gray-700' }, // Upravené na space-y-4 pre konzistentnosť
            React.createElement(
                'div',
                null,
                React.createElement('p', { className: 'font-bold text-gray-800' }, 'Oficiálny názov klubu:'),
                React.createElement('p', { className: 'text-lg mt-1' }, `${billing.clubName || billing.companyName || '-'}`)
            ),
            // Zobrazenie spojenej adresy pod názvom klubu
            formattedAddress && React.createElement(
                'div',
                null,
                React.createElement('p', { className: 'font-bold text-gray-800' }, 'Adresa:'),
                React.createElement('p', { className: 'text-lg mt-1' }, formattedAddress)
            ),
            React.createElement(
                'div',
                null,
                React.createElement('p', { className: 'font-bold text-gray-800' }, 'IČO:'),
                React.createElement('p', { className: 'text-lg mt-1' }, `${billing.ico || billing.companyId || '-'}`)
            ),
            // Opravené pole 'dic' namiesto 'taxId'
            React.createElement(
                'div',
                null,
                React.createElement('p', { className: 'font-bold text-gray-800' }, 'DIČ:'),
                React.createElement('p', { className: 'text-lg mt-1' }, `${billing.dic || '-'}`)
            ),
            // Opravené pole 'icdph' namiesto 'vatId'
            React.createElement(
                'div',
                null,
                React.createElement('p', { className: 'font-bold text-gray-800' }, 'IČ DPH:'),
                React.createElement('p', { className: 'text-lg mt-1' }, `${billing.icdph || '-'}`)
            ),
        )
    );
};

// Main React component for the logged-in-my-data.html page
function MyDataApp() {
    // Lokálny stav pre používateľské údaje, ktoré sa načítajú po globálnej autentifikácii
    const [userProfileData, setUserProfileData] = React.useState(null);
    const [loading, setLoading] = React.useState(true); // Loading stav pre údaje
    const [error, setError] = React.useState('');
    
    // Zabezpečíme, že appId je definované (používame globálnu premennú)
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'; 

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
  
    // Effect pre nastavenie event listenera na globálnu udalosť
    React.useEffect(() => {
        // Funkcia, ktorá sa zavolá, keď sa údaje aktualizujú
        const handleDataUpdate = (event) => {
            const data = event.detail;
            if (data) {
                // Rekonštruujeme objekt pre konzistentné zobrazenie
                const processedData = {
                    ...data,
                    address: {
                        street: data.street,
                        houseNumber: data.houseNumber,
                        city: data.city,
                        postalCode: data.postalCode,
                        country: data.country
                    },
                    billing: data.billing || null
                };
                setUserProfileData(processedData);
                setError('');
            } else {
                console.error("MyDataApp: Používateľské údaje neboli nájdené.");
                setUserProfileData(null);
                setError('Používateľské údaje neboli nájdené.');
            }
            // loading sa vždy vypne, aby sa predišlo nekonečnému načítavaniu
            setLoading(false);
        };

        window.addEventListener('globalDataUpdated', handleDataUpdate);

        return () => {
            window.removeEventListener('globalDataUpdated', handleDataUpdate);
        };
    }, []);

    // Loader komponent so špecifickými štýlmi
    const Loader = () => React.createElement(
        'div',
        { className: 'flex flex-col items-center justify-center min-h-[calc(100vh-64px)]' },
        React.createElement(
            'div',
            {
                // Zmenené triedy pre lepšiu viditeľnosť rotujúcej časti a menšiu hrúbku
                className: 'ease-linear rounded-full border-4 border-gray-200 border-t-4 border-t-blue-500 h-12 w-12 mb-4 animate-spin'
            }
        ),
        React.createElement('p', { className: 'text-gray-600' }, 'Načítavam údaje...')
    );

    if (loading) {
        return React.createElement(Loader, null);
    }

    if (error) {
        return React.createElement(
            'div',
            { className: 'text-center p-8 text-red-500' },
            React.createElement('p', null, error)
        );
    }

    // Komponent pre jednotné zobrazenie osobných údajov
    const renderPersonalData = (data) => {
        if (!data) return null;

        const isUser = data.role === 'user';

        return React.createElement(
            'div',
            { className: 'space-y-4 text-gray-700' }, // Pridáme vertikálny priestor medzi jednotlivé polia
            React.createElement(
                'div',
                null,
                React.createElement('p', { className: 'font-bold text-gray-800' }, 'Meno a priezvisko:'),
                React.createElement('p', { className: 'text-lg mt-1' }, `${data.firstName || '-'} ${data.lastName || ''}`)
            ),
            React.createElement(
                'div',
                null,
                React.createElement('p', { className: 'font-bold text-gray-800' }, 'E-mailová adresa:'),
                React.createElement('p', { className: 'text-lg mt-1' }, data.email || '-')
            ),
            isUser && React.createElement(
                'div',
                null,
                React.createElement('p', { className: 'font-bold text-gray-800' }, 'Telefónne číslo kontaktnej osoby:'),
                React.createElement('p', { className: 'text-lg mt-1' }, formatPhoneNumber(data.contactPhoneNumber) || '-')
            )
        );
    };


    const headerColor = getHeaderColor(userProfileData.role);

    // Nový hlavný kontajner s jednotnou šírkou pre celú sekciu
    return React.createElement(
        'div',
        { className: 'container mx-auto p-8 mt-12 max-w-2xl' },
        React.createElement(
            'div',
            {
                className: `p-4 rounded-t-lg text-white text-center`,
                style: { backgroundColor: headerColor }
            },
            React.createElement(
                'h1',
                { className: 'text-3xl font-bold' },
                'Moja zóna'
            )
        ),
        React.createElement(
            'div',
            { className: 'bg-white rounded-b-lg shadow-lg p-6' },
            React.createElement(
                'h2',
                { className: 'text-2xl font-semibold mb-4 text-gray-800' },
                'Osobné údaje'
            ),
            renderPersonalData(userProfileData)
        ),
        
        // Funkciu renderBillingAndAddressInfo voláme iba vtedy, ak existujú nejaké zmysluplné údaje
        (userProfileData.billing || userProfileData.address) && renderBillingAndAddressInfo(userProfileData, headerColor)
    );
}

// Export pre možnosť načítania v HTML
window.MyDataApp = MyDataApp;
