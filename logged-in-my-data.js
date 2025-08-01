// logged-in-my-data.js
// Tento súbor predpokladá, že Firebase SDK je inicializovaný v <head> logged-in-my-data.html
// a authentication.js spravuje globálnu autentifikáciu a stav používateľa.

// Zoznam predvolieb, zoradený zostupne podľa dĺžky pre správne rozpoznávanie
const countryDialCodes = [
    { code: 'US', dialCode: '+1' }, { code: 'CA', dialCode: '+1' }, { code: 'RU', dialCode: '+7' },
    { code: 'EG', dialCode: '+20' }, { code: 'ZA', dialCode: '+27' }, { code: 'GR', dialCode: '+30' },
    { code: 'NL', dialCode: '+31' }, { code: 'BE', dialCode: '+32' }, { code: 'FR', dialCode: '+33' },
    { code: 'ES', dialCode: '+34' }, { code: 'GI', dialCode: '+350' }, { code: 'PT', dialCode: '+351' },
    { code: 'IE', dialCode: '+353' }, { code: 'IS', dialCode: '+354' }, { code: 'AL', dialCode: '+355' },
    { code: 'MT', dialCode: '+356' }, { code: 'CY', dialCode: '+357' }, { code: 'FI', dialCode: '+358' },
    { code: 'BG', dialCode: '+359' }, { code: 'LT', dialCode: '+370' }, { code: 'LV', dialCode: '+371' },
    { code: 'EE', dialCode: '+372' }, { code: 'MD', dialCode: '+373' }, { code: 'AM', dialCode: '+374' },
    { code: 'BY', dialCode: '+375' }, { code: 'AD', dialCode: '+376' }, { code: 'MC', dialCode: '+377' },
    { code: 'SM', dialCode: '+378' }, { code: 'UA', dialCode: '+380' }, { code: 'RS', dialCode: '+381' },
    { code: 'ME', dialCode: '+382' }, { code: 'HR', dialCode: '+385' }, { code: 'SI', dialCode: '+386' },
    { code: 'BA', dialCode: '+387' }, { code: 'SK', dialCode: '+421' }, { code: 'CZ', dialCode: '+420' },
    { code: 'LI', dialCode: '+423' }, { code: 'AT', dialCode: '+43' }, { code: 'GB', dialCode: '+44' },
    { code: 'DK', dialCode: '+45' }, { code: 'SE', dialCode: '+46' }, { code: 'NO', dialCode: '+47' },
    { code: 'PL', dialCode: '+48' }, { code: 'DE', dialCode: '+49' }, { code: 'PE', dialCode: '+51' },
    { code: 'MX', dialCode: '+52' }, { code: 'CU', dialCode: '+53' }, { code: 'AR', dialCode: '+54' },
    { code: 'BR', dialCode: '+55' }, { code: 'CL', dialCode: '+56' }, { code: 'CO', dialCode: '+57' },
    { code: 'VE', dialCode: '+58' }, { code: 'MY', dialCode: '+60' }, { code: 'AU', dialCode: '+61' },
    { code: 'ID', dialCode: '+62' }, { code: 'PH', dialCode: '+63' }, { code: 'NZ', dialCode: '+64' },
    { code: 'SG', dialCode: '+65' }, { code: 'TH', dialCode: '+66' }, { code: 'TZ', dialCode: '+255' },
    { code: 'KE', dialCode: '+254' }, { code: 'ZM', dialCode: '+260' }, { code: 'ZW', dialCode: '+263' },
    { code: 'NG', dialCode: '+234' }, { code: 'GH', dialCode: '+233' }, { code: 'MA', dialCode: '+212' },
    { code: 'DZ', dialCode: '+213' }, { code: 'TR', dialCode: '+90' }, { code: 'JP', dialCode: '+81' },
    { code: 'KR', dialCode: '+82' }, { code: 'CN', dialCode: '+86' }, { code: 'IN', dialCode: '+91' },
    { code: 'IR', dialCode: '+98' }, { code: 'AF', dialCode: '+93' }, { code: 'DZ', dialCode: '+213' },
    { code: 'AO', dialCode: '+244' }, { code: 'BJ', dialCode: '+229' }, { code: 'BW', dialCode: '+267' },
    { code: 'BF', dialCode: '+226' }, { code: 'BI', dialCode: '+257' }, { code: 'CM', dialCode: '+237' },
    { code: 'CV', dialCode: '+238' }, { code: 'CF', dialCode: '+236' }, { code: 'TD', dialCode: '+235' },
    { code: 'KM', dialCode: '+269' }, { code: 'CG', dialCode: '+242' }, { code: 'CD', dialCode: '+243' },
    { code: 'CI', dialCode: '+225' }, { code: 'DJ', dialCode: '+253' }, { code: 'GQ', dialCode: '+240' },
    { code: 'ER', dialCode: '+291' }, { code: 'ET', dialCode: '+251' }, { code: 'GA', dialCode: '+241' },
    { code: 'GM', dialCode: '+220' }, { code: 'GN', dialCode: '+224' }, { code: 'GW', dialCode: '+245' },
    { code: 'KE', dialCode: '+254' }, { code: 'LS', dialCode: '+266' }, { code: 'LR', dialCode: '+231' },
    { code: 'LY', dialCode: '+218' }, { code: 'MG', dialCode: '+261' }, { code: 'MW', dialCode: '+265' },
    { code: 'ML', dialCode: '+223' }, { code: 'MR', dialCode: '+222' }, { code: 'MU', dialCode: '+230' },
    { code: 'YT', dialCode: '+262' }, { code: 'MZ', dialCode: '+258' }, { code: 'NA', dialCode: '+264' },
    { code: 'NE', dialCode: '+227' }, { code: 'NG', dialCode: '+234' }, { code: 'RW', dialCode: '+250' },
    { code: 'SH', dialCode: '+290' }, { code: 'ST', dialCode: '+239' }, { code: 'SN', dialCode: '+221' },
    { code: 'SC', dialCode: '+248' }, { code: 'SL', dialCode: '+232' }, { code: 'SO', dialCode: '+252' },
    { code: 'ZA', dialCode: '+27' }, { code: 'SS', dialCode: '+211' }, { code: 'SD', dialCode: '+249' },
    { code: 'SZ', dialCode: '+268' }, { code: 'TZ', dialCode: '+255' }, { code: 'TG', dialCode: '+228' },
    { code: 'TN', dialCode: '+216' }, { code: 'UG', dialCode: '+256' }, { code: 'EH', dialCode: '+212' },
    { code: 'ZM', dialCode: '+260' }, { code: 'ZW', dialCode: '+263' }
];

// Funkcia na formátovanie telefónneho čísla
const formatPhoneNumber = (phoneNumber) => {
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

// Pomocná funkcia na renderovanie fakturačných údajov a adresy
const renderBillingAndAddressInfo = (userProfileData) => {
    if (!userProfileData || (!userProfileData.billing && !userProfileData.address)) {
        return null;
    }

    const { billing, address } = userProfileData;

    // Vytvoríme formátovanú adresu
    const formattedAddress = address ? `${address.street || ''} ${address.houseNumber || ''}, ${address.postalCode || ''} ${address.city || ''}, ${address.country || ''}`.trim() : null;

    return React.createElement(
        'div',
        { className: 'bg-white rounded-lg shadow-lg p-6 mt-6 max-w-2xl mx-auto border-t-4 border-purple-500' },
        React.createElement(
            'h2',
            { className: 'text-2xl font-semibold mb-4 text-gray-800' },
            'Fakturačné údaje'
        ),
        billing && React.createElement(
            'div',
            { className: 'space-y-2 text-gray-700' },
            React.createElement(
                'p',
                { className: 'text-lg' },
                React.createElement('span', { className: 'font-bold' }, 'Oficiálny názov klubu:'),
                ` ${billing.clubName || billing.companyName || '-'}`
            ),
            // Zobrazenie spojenej adresy pod názvom klubu
            formattedAddress && React.createElement(
                'p',
                { className: 'text-lg' },
                React.createElement('span', { className: 'font-bold' }, 'Adresa:'),
                ` ${formattedAddress}`
            ),
            React.createElement(
                'p',
                { className: 'text-lg' },
                React.createElement('span', { className: 'font-bold' }, 'IČO:'),
                ` ${billing.ico || billing.companyId || '-'}`
            ),
            // Opravené pole 'dic' namiesto 'taxId'
            React.createElement(
                'p',
                { className: 'text-lg' },
                React.createElement('span', { className: 'font-bold' }, 'DIČ:'),
                ` ${billing.dic || '-'}`
            ),
            // Opravené pole 'icdph' namiesto 'vatId'
            React.createElement(
                'p',
                { className: 'text-lg' },
                React.createElement('span', { className: 'font-bold' }, 'IČ DPH:'),
                ` ${billing.icdph || '-'}`
            ),
        )
    );
};

// Main React component for the logged-in-my-data.html page
function MyDataApp() {
    // Lokálny stav pre používateľské dáta, ktoré sa načítajú po globálnej autentifikácii
    const [userProfileData, setUserProfileData] = React.useState(null); 
    const [loading, setLoading] = React.useState(true); // Loading stav pre dáta
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
        // Funkcia, ktorá sa zavolá, keď sa dáta aktualizujú
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
                console.error("MyDataApp: Používateľské dáta neboli nájdené.");
                setUserProfileData(null);
                setError('Používateľské dáta neboli nájdené.');
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
                className: 'loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-12 w-12 mb-4 animate-spin'
            }
        ),
        React.createElement('p', { className: 'text-gray-600' }, 'Načítavam dáta...')
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

        return React.createElement(
            React.Fragment,
            null,
            React.createElement(
                'p',
                { className: 'text-gray-800 text-lg' },
                React.createElement('span', { className: 'font-bold' }, 'Meno a priezvisko kontaktnej osoby:'),
                ` ${data.firstName || '-'} ${data.lastName || ''}`
            ),
            React.createElement(
                'p',
                { className: 'text-gray-800 text-lg' },
                React.createElement('span', { className: 'font-bold' }, 'E-mailová adresa kontaktnej osoby:'),
                ` ${data.email || '-'}`
            ),
            React.createElement(
                'p',
                { className: 'text-gray-800 text-lg' },
                React.createElement('span', { className: 'font-bold' }, 'Telefónne číslo kontaktnej osoby:'),
                ` ${formatPhoneNumber(data.contactPhoneNumber) || '-'}`
            )
        );
    };

    return React.createElement(
        'div',
        { className: 'container mx-auto p-8 mt-12 bg-gray-50 rounded-lg shadow-lg max-w-4xl' },
        React.createElement(
            'div',
            {
                className: `p-4 rounded-t-lg text-white text-center`,
                style: { backgroundColor: getHeaderColor(userProfileData.role) }
            },
            React.createElement(
                'h1',
                { className: 'text-3xl font-bold' },
                'Moja zóna'
            )
        ),
        React.createElement(
            'div',
            { className: 'bg-white rounded-b-lg shadow-lg p-6 max-w-2xl mx-auto' },
            React.createElement(
                'h2',
                { className: 'text-2xl font-semibold mb-4 text-gray-800' },
                'Osobné údaje'
            ),
            React.createElement(
                'div',
                { className: 'space-y-2' },
                renderPersonalData(userProfileData)
            )
        ),
        
        renderBillingAndAddressInfo(userProfileData),
    );
}

// Export pre možnosť načítania v HTML
window.MyDataApp = MyDataApp;
