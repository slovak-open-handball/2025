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
    { code: 'ME', dialCode: '+382' }, { code: 'XK', dialCode: '+383' }, { code: 'HR', dialCode: '+385' },
    { code: 'SI', dialCode: '+386' }, { code: 'BA', dialCode: '+387' }, { code: 'MK', dialCode: '+389' },
    { code: 'IT', dialCode: '+39' }, { code: 'RO', dialCode: '+40' }, { code: 'CH', dialCode: '+41' },
    { code: 'CZ', dialCode: '+420' }, { code: 'SK', dialCode: '+421' }, { code: 'LI', dialCode: '+423' },
    { code: 'GB', dialCode: '+44' }, { code: 'GG', dialCode: '+44' }, { code: 'IM', dialCode: '+44' },
    { code: 'JE', dialCode: '+44' }, { code: 'DK', dialCode: '+45' }, { code: 'SE', dialCode: '+46' },
    { code: 'NO', dialCode: '+47' }, { code: 'PL', dialCode: '+48' }, { code: 'DE', dialCode: '+49' },
    { code: 'PE', dialCode: '+51' }, { code: 'MX', dialCode: '+52' }, { code: 'CU', dialCode: '+53' },
    { code: 'AR', dialCode: '+54' }, { code: 'BR', dialCode: '+55' }, { code: 'CL', dialCode: '+56' },
    { code: 'CO', dialCode: '+57' }, { code: 'VE', dialCode: '+58' }, { code: 'MY', dialCode: '+60' },
    { code: 'AU', dialCode: '+61' }, { code: 'ID', dialCode: '+62' }, { code: 'PH', dialCode: '+63' },
    { code: 'NZ', dialCode: '+64' }, { code: 'SG', dialCode: '+65' }, { code: 'TH', dialCode: '+66' },
    { code: 'JP', dialCode: '+81' }, { code: 'KR', dialCode: '+82' }, { code: 'VN', dialCode: '+84' },
    { code: 'CN', dialCode: '+86' }, { code: 'TR', dialCode: '+90' }, { code: 'IN', dialCode: '+91' },
    { code: 'PK', dialCode: '+92' }, { code: 'AF', dialCode: '+93' }, { code: 'LK', dialCode: '+94' },
    { code: 'MM', dialCode: '+95' }, { code: 'IR', dialCode: '+98' }, { code: 'MA', dialCode: '+212' },
    { code: 'DZ', dialCode: '+213' }, { code: 'TN', dialCode: '+216' }, { code: 'LY', dialCode: '+218' },
    { code: 'GM', dialCode: '+220' }, { code: 'SN', dialCode: '+221' }, { code: 'MR', dialCode: '+222' },
    { code: 'ML', dialCode: '+223' }, { code: 'GN', dialCode: '+224' }, { code: 'CI', dialCode: '+225' },
    { code: 'BF', dialCode: '+226' }, { code: 'NE', dialCode: '+227' }, { code: 'TG', dialCode: '+228' },
    { code: 'BJ', dialCode: '+229' }, { code: 'SL', dialCode: '+232' }, { code: 'GH', dialCode: '+233' },
    { code: 'NG', dialCode: '+234' }, { code: 'TD', dialCode: '+235' }, { code: 'CF', dialCode: '+236' },
    { code: 'CM', dialCode: '+237' }, { code: 'GA', dialCode: '+241' }, { code: 'CG', dialCode: '+242' },
    { code: 'AO', dialCode: '+244' }, { code: 'GW', dialCode: '+245' }, { code: 'CV', dialCode: '+238' },
    { code: 'GQ', dialCode: '+240' }, { code: 'RW', dialCode: '+250' }, { code: 'ET', dialCode: '+251' },
    { code: 'SO', dialCode: '+252' }, { code: 'DJ', dialCode: '+253' }, { code: 'KE', dialCode: '+254' },
    { code: 'TZ', dialCode: '+255' }, { code: 'UG', dialCode: '+256' }, { code: 'BI', dialCode: '+257' },
    { code: 'MZ', dialCode: '+258' }, { code: 'ZM', dialCode: '+260' }, { code: 'ZW', dialCode: '+263' },
    { code: 'NA', dialCode: '+264' }, { code: 'MW', dialCode: '+265' }, { code: 'LS', dialCode: '+266' },
    { code: 'BW', dialCode: '+267' }, { code: 'SZ', dialCode: '+268' }, { code: 'KM', dialCode: '+269' },
    { code: 'ER', dialCode: '+291' }, { code: 'AW', dialCode: '+297' }, { code: 'FO', dialCode: '+298' },
    { code: 'GL', dialCode: '+299' }, { code: 'AI', dialCode: '+1‑264' }, { code: 'AG', dialCode: '+1‑268' },
    { code: 'BS', dialCode: '+1‑242' }, { code: 'BB', dialCode: '+1‑246' }, { code: 'BM', dialCode: '+1‑441' },
    { code: 'VG', dialCode: '+1‑284' }, { code: 'KY', dialCode: '+1‑345' }, { code: 'DM', dialCode: '+1‑767' },
    { code: 'DO', dialCode: '+1‑809' }, { code: 'DO', dialCode: '+1‑829' }, { code: 'DO', dialCode: '+1‑849' },
    { code: 'GD', dialCode: '+1‑473' }, { code: 'GP', dialCode: '+590' }, { code: 'GU', dialCode: '+1‑671' },
    { code: 'JM', dialCode: '+1‑876' }, { code: 'MQ', dialCode: '+596' }, { code: 'MS', dialCode: '+1‑664' },
    { code: 'CW', dialCode: '+599' }, { code: 'SX', dialCode: '+1‑721' }, { code: 'PR', dialCode: '+1‑787' },
    { code: 'PR', dialCode: '+1‑939' }, { code: 'KN', dialCode: '+1‑869' }, { code: 'LC', dialCode: '+1‑758' },
    { code: 'VC', dialCode: '+1‑784' }, { code: 'TT', dialCode: '+1‑868' }, { code: 'TC', dialCode: '+1‑649' },
    { code: 'VI', dialCode: '+1‑340' },
    { code: 'AS', dialCode: '+1‑684' }, { code: 'AU', dialCode: '+672' }, { code: 'CX', dialCode: '+61' },
    { code: 'CC', dialCode: '+61' }, { code: 'CK', dialCode: '+682' }, { code: 'FJ', dialCode: '+679' },
    { code: 'PF', dialCode: '+689' }, { code: 'KI', dialCode: '+686' }, { code: 'MH', dialCode: '+692' },
    { code: 'FM', dialCode: '+691' }, { code: 'NR', dialCode: '+674' }, { code: 'NC', dialCode: '+687' },
    { code: 'NU', dialCode: '+683' }, { code: 'NF', dialCode: '+672' }, { code: 'MP', dialCode: '+1‑670' },
    { code: 'PW', dialCode: '+680' }, { code: 'PG', dialCode: '+675' }, { code: 'WS', dialCode: '+685' },
    { code: 'SB', dialCode: '+677' }, { code: 'TL', dialCode: '+670' }, { code: 'TO', dialCode: '+676' },
    { code: 'TV', dialCode: '+688' }, { code: 'VU', dialCode: '+678' }, { code: 'WF', dialCode: '+681' },
    { code: 'ET', dialCode: '+298' }, { code: 'IS', dialCode: '+354' }, { code: 'AZ', dialCode: '+994' },
    { code: 'GE', dialCode: '+995' }, { code: 'TJ', dialCode: '+992' }, { code: 'TM', dialCode: '+993' },
    { code: 'UZ', dialCode: '+998' }, { code: 'BY', dialCode: '+375' }, { code: 'KZ', dialCode: '+7' },
    { code: 'KG', dialCode: '+996' }, { code: 'MN', dialCode: '+976' }, { code: 'NP', dialCode: '+977' },
    { code: 'BT', dialCode: '+975' }, { code: 'MV', dialCode: '+960' }, { code: 'BD', dialCode: '+880' },
    { code: 'KH', dialCode: '+855' }, { code: 'LA', dialCode: '+856' }, { code: 'MM', dialCode: '+95' },
    { code: 'BN', dialCode: '+673' }, { code: 'TP', dialCode: '+670' }, { code: 'HK', dialCode: '+852' },
    { code: 'MO', dialCode: '+853' }, { code: 'TW', dialCode: '+886' }, { code: 'ID', dialCode: '+62' },
    { code: 'PG', dialCode: '+675' }, { code: 'TL', dialCode: '+670' }, { code: 'SY', dialCode: '+963' },
    { code: 'JO', dialCode: '+962' }, { code: 'LB', dialCode: '+961' }, { code: 'IQ', dialCode: '+964' },
    { code: 'KW', dialCode: '+965' }, { code: 'SA', dialCode: '+966' }, { code: 'OM', dialCode: '+968' },
    { code: 'YE', dialCode: '+967' }, { code: 'AE', dialCode: '+971' }, { code: 'QA', dialCode: '+974' },
    { code: 'BH', dialCode: '+973' }, { code: 'IL', dialCode: '+972' }, { code: 'PS', dialCode: '+970' },
    { code: 'CY', dialCode: '+357' }, { code: 'AM', dialCode: '+374' }, { code: 'AF', dialCode: '+93' },
    { code: 'IR', dialCode: '+98' }, { code: 'PK', dialCode: '+92' }, { code: 'UZ', dialCode: '+998' },
    { code: 'KG', dialCode: '+996' }, { code: 'TM', dialCode: '+993' }, { code: 'TJ', dialCode: '+992' },
    { code: 'BD', dialCode: '+880' }, { code: 'LK', dialCode: '+94' }, { code: 'NP', dialCode: '+977' },
    { code: 'MV', dialCode: '+960' }, { code: 'BN', dialCode: '+673' }, { code: 'KH', dialCode: '+855' },
    { code: 'LA', dialCode: '+856' }, { code: 'MM', dialCode: '+95' }, { code: 'VN', dialCode: '+84' },
    { code: 'SG', dialCode: '+65' }, { code: 'TH', dialCode: '+66' }, { code: 'AU', dialCode: '+61' },
    { code: 'NZ', dialCode: '+64' }, { code: 'FJ', dialCode: '+679' }, { code: 'PG', dialCode: '+675' },
    { code: 'SB', dialCode: '+677' }, { code: 'VU', dialCode: '+678' }, { code: 'NC', dialCode: '+687' },
];

// Helper funkcia na formátovanie telefónneho čísla
const formatPhoneNumber = (phoneNumber) => {
    if (!phoneNumber) return '';
    const dialCode = countryDialCodes.find(c => phoneNumber.startsWith(c.dialCode));
    if (dialCode) {
        const number = phoneNumber.substring(dialCode.dialCode.length).trim();
        return `${dialCode.dialCode} ${number}`;
    }
    return phoneNumber;
};

// Komponent pre zobrazenie fakturačných údajov a adresy
const renderBillingAndAddressInfo = (userProfileData) => {
    if (!userProfileData || !userProfileData.billingAddress) return null;

    const { street, city, postalCode, country } = userProfileData.billingAddress;
    const { ICO, DIC, IC_DPH } = userProfileData.billingInfo || {};

    return React.createElement(
        'div',
        { className: 'bg-white p-6 rounded-lg shadow-md mb-6' },
        React.createElement('h2', { className: 'text-2xl font-semibold text-blue-700 mb-4' }, 'Fakturačné údaje a adresa'),
        React.createElement(
            'p',
            { className: 'text-gray-800 text-lg' },
            React.createElement('span', { className: 'font-bold' }, 'Ulica a číslo:'),
            ` ${street}`
        ),
        React.createElement(
            'p',
            { className: 'text-gray-800 text-lg' },
            React.createElement('span', { className: 'font-bold' }, 'Mesto:'),
            ` ${city}`
        ),
        React.createElement(
            'p',
            { className: 'text-gray-800 text-lg' },
            React.createElement('span', { className: 'font-bold' }, 'PSČ:'),
            ` ${postalCode}`
        ),
        React.createElement(
            'p',
            { className: 'text-gray-800 text-lg' },
            React.createElement('span', { className: 'font-bold' }, 'Krajina:'),
            ` ${country}`
        ),
        ICO && React.createElement(
            'p',
            { className: 'text-gray-800 text-lg' },
            React.createElement('span', { className: 'font-bold' }, 'IČO:'),
            ` ${ICO}`
        ),
        DIC && React.createElement(
            'p',
            { className: 'text-gray-800 text-lg' },
            React.createElement('span', { className: 'font-bold' }, 'DIČ:'),
            ` ${DIC}`
        ),
        IC_DPH && React.createElement(
            'p',
            { className: 'text-gray-800 text-lg' },
            React.createElement('span', { className: 'font-bold' }, 'IČ DPH:'),
            ` ${IC_DPH}`
        ),
    );
};

// Loader komponent pre zobrazenie stavu načítania
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

// Komponent Header
const Header = ({ headerColor }) => {
    const menuIcon = (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
            <line x1="4" x2="20" y1="12" y2="12" />
            <line x1="4" x2="20" y1="6" y2="6" />
            <line x1="4" x2="20" y1="18" y2="18" />
        </svg>
    );

    const navLinks = window.globalUserProfileData ? (
        <div className="flex items-center space-x-6">
            <a href="logged-in-my-data.html" className="text-lg font-semibold hover:text-blue-200 transition-colors duration-200">Moja zóna</a>
            <button id="logout-button" className="text-lg font-semibold hover:text-blue-200 transition-colors duration-200" onClick={() => window.handleLogout()}>Odhlásenie</button>
        </div>
    ) : (
        <div className="flex items-center space-x-6">
            <a href="login.html" className="text-lg font-semibold hover:text-blue-200 transition-colors duration-200">Prihlásenie</a>
        </div>
    );

    return (
        React.createElement('header', { className: `w-full text-white p-4 shadow-md fixed top-0 left-0 right-0 z-20 flex justify-between items-center transition-colors duration-300`, style: { backgroundColor: headerColor } },
            React.createElement('div', { className: 'flex items-center space-x-6' },
                React.createElement('a', { id: 'home-link', href: 'index.html', className: 'text-lg font-semibold hover:text-blue-200 transition-colors duration-200' }, 'Domov'),
                // Ďalšie odkazy pre prihlásených používateľov môžu ísť sem
            ),
            React.createElement('div', { className: 'flex items-center space-x-6' },
                navLinks
            )
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
        const handleDataUpdated = (event) => {
            const data = event.detail;
            if (data) {
                setUserProfileData(data);
            } else {
                setUserProfileData(null);
                // Ak sa užívateľ odhlási, mali by sme ho presmerovať
                window.location.href = 'index.html';
            }
            setLoading(false);
        };
  
        // Pridanie globálneho event listenera
        window.addEventListener('globalDataUpdated', handleDataUpdated);
    
        // Načítanie počiatočného stavu, ak už sú dáta k dispozícii
        if (window.isGlobalAuthReady) {
            handleDataUpdated({ detail: window.globalUserProfileData });
        }
  
        // Cleanup funkcia pre odstránenie listenera pri odmountovaní komponentu
        return () => {
            window.removeEventListener('globalDataUpdated', handleDataUpdated);
        };
    }, []);

    // Zobrazenie načítacieho stavu
    if (loading) {
        return React.createElement(Loader, null);
    }
  
    // Zobrazenie chybovej správy, ak sa dáta nepodarilo načítať
    if (error) {
        return React.createElement(
            'div',
            { className: 'text-center p-8 text-red-500' },
            React.createElement('p', null, error)
        );
    }

    // Ak nie sú k dispozícii dáta o používateľovi, zobrazíme jednoduchú správu
    if (!userProfileData) {
        return React.createElement(
            'div',
            { className: 'flex flex-col items-center justify-center min-h-screen' },
            React.createElement('h1', { className: 'text-3xl font-bold text-red-600 mb-4' }, 'Neoprávnený prístup'),
            React.createElement('p', { className: 'text-lg text-gray-700' }, 'Pre zobrazenie tejto stránky sa musíte prihlásiť.')
        );
    }
  
    const headerColor = getHeaderColor(userProfileData.role);
    const isAdmin = userProfileData.role === 'admin';
  
    // Ak sú dáta načítané, vykreslíme profil používateľa
    return (
        React.createElement(React.Fragment, null,
            React.createElement(Header, { headerColor }),
            React.createElement(
                'main',
                { className: 'container mx-auto p-8 mt-12 bg-white rounded-lg shadow-lg max-w-4xl' },
                React.createElement(
                    'div',
                    { className: 'bg-white p-6 rounded-lg shadow-md mb-6 border-l-4', style: { borderColor: headerColor } },
                    React.createElement('h1', { className: 'text-3xl font-bold text-gray-800 mb-4' }, 'Môj profil'),
                    isAdmin ? (
                        // Pre admina
                        React.createElement(React.Fragment, null,
                            React.createElement(
                                'p',
                                { className: 'text-gray-800 text-lg' },
                                React.createElement('span', { className: 'font-bold' }, 'Meno:'),
                                ` ${userProfileData.displayName}`
                            ),
                            React.createElement(
                                'p',
                                { className: 'text-gray-800 text-lg' },
                                React.createElement('span', { className: 'font-bold' }, 'E-mailová adresa:'),
                                ` ${userProfileData.email}`
                            )
                        )
                    ) : (
                        // Pre bežného používateľa
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
                            ),
                        )
                    )
                ),
      
                // Zobrazí fakturačné údaje a adresu, ak existujú
                renderBillingAndAddressInfo(userProfileData),
            )
        )
    );
}

// Export pre možnosť načítania v HTML
window.MyDataApp = MyDataApp;
