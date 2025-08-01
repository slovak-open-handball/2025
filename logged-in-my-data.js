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
    { code: 'BY', dialCode: '+375' }, { code: 'AD', dialCode: '+376' }, { code: 'SM', dialCode: '+378' },
    { code: 'VA', dialCode: '+379' }, { code: 'UA', dialCode: '+380' }, { code: 'RS', dialCode: '+381' },
    { code: 'ME', dialCode: '+382' }, { code: 'XK', dialCode: '+383' }, { code: 'HR', dialCode: '+385' },
    { code: 'SI', dialCode: '+386' }, { code: 'BA', dialCode: '+387' }, { code: 'MK', dialCode: '+389' },
    { code: 'CZ', dialCode: '+420' }, { code: 'SK', dialCode: '+421' }, { code: 'LI', dialCode: '+423' },
    { code: 'AT', dialCode: '+43' }, { code: 'GB', dialCode: '+44' }, { code: 'DK', dialCode: '+45' },
    { code: 'SE', dialCode: '+46' }, { code: 'NO', dialCode: '+47' }, { code: 'PL', dialCode: '+48' },
    { code: 'DE', dialCode: '+49' }, { code: 'PE', dialCode: '+51' }, { code: 'MX', dialCode: '+52' },
    { code: 'CU', dialCode: '+53' }, { code: 'AR', dialCode: '+54' }, { code: 'BR', dialCode: '+55' },
    { code: 'CL', dialCode: '+56' }, { code: 'CO', dialCode: '+57' }, { code: 'VE', dialCode: '+58' },
    { code: 'MY', dialCode: '+60' }, { code: 'AU', dialCode: '+61' }, { code: 'ID', dialCode: '+62' },
    { code: 'PH', dialCode: '+63' }, { code: 'NZ', dialCode: '+64' }, { code: 'SG', dialCode: '+65' },
    { code: 'TH', dialCode: '+66' }, { code: 'KZ', dialCode: '+76' }, { code: 'KZ', dialCode: '+77' },
    { code: 'JP', dialCode: '+81' }, { code: 'KR', dialCode: '+82' }, { code: 'VN', dialCode: '+84' },
    { code: 'CN', dialCode: '+86' }, { code: 'TR', dialCode: '+90' }, { code: 'IN', dialCode: '+91' },
    { code: 'PK', dialCode: '+92' }, { code: 'AF', dialCode: '+93' }, { code: 'LK', dialCode: '+94' },
    { code: 'MM', dialCode: '+95' }, { code: 'IR', dialCode: '+98' }, { code: 'MA', dialCode: '+212' },
    { code: 'EH', dialCode: '+212' }, { code: 'DZ', dialCode: '+213' }, { code: 'TN', dialCode: '+216' },
    { code: 'LY', dialCode: '+218' }, { code: 'GM', dialCode: '+220' }, { code: 'SN', dialCode: '+221' },
    { code: 'MR', dialCode: '+222' }, { code: 'ML', dialCode: '+223' }, { code: 'GN', dialCode: '+224' },
    { code: 'CI', dialCode: '+225' }, { code: 'BF', dialCode: '+226' }, { code: 'NE', dialCode: '+227' },
    { code: 'TG', dialCode: '+228' }, { code: 'BJ', dialCode: '+229' }, { code: 'MU', dialCode: '+230' },
    { code: 'LR', dialCode: '+231' }, { code: 'SL', dialCode: '+232' }, { code: 'GH', dialCode: '+233' },
    { code: 'NG', dialCode: '+234' }, { code: 'TD', dialCode: '+235' }, { code: 'CF', dialCode: '+236' },
    { code: 'CM', dialCode: '+237' }, { code: 'CV', dialCode: '+238' }, { code: 'ST', dialCode: '+239' },
    { code: 'GQ', dialCode: '+240' }, { code: 'GA', dialCode: '+241' }, { code: 'CG', dialCode: '+242' },
    { code: 'CD', dialCode: '+243' }, { code: 'AO', dialCode: '+244' }, { code: 'GW', dialCode: '+245' },
    { code: 'IO', dialCode: '+246' }, { code: 'SY', dialCode: '+963' }, { code: 'IQ', dialCode: '+964' },
    { code: 'KW', dialCode: '+965' }, { code: 'SA', dialCode: '+966' }, { code: 'OM', dialCode: '+968' },
    { code: 'YE', dialCode: '+967' }, { code: 'AE', dialCode: '+971' }, { code: 'QA', dialCode: '+974' },
    { code: 'BH', dialCode: '+973' }, { code: 'PS', dialCode: '+970' }, { code: 'IL', dialCode: '+972' },
    { code: 'JO', dialCode: '+962' }, { code: 'LB', dialCode: '+961' }, { code: 'CY', dialCode: '+357' },
    { code: 'ET', dialCode: '+251' }, { code: 'SO', dialCode: '+252' }, { code: 'DJ', dialCode: '+253' },
    { code: 'KE', dialCode: '+254' }, { code: 'TZ', dialCode: '+255' }, { code: 'UG', dialCode: '+256' },
    { code: 'BI', dialCode: '+257' }, { code: 'MZ', dialCode: '+258' }, { code: 'ZM', dialCode: '+260' },
    { code: 'MG', dialCode: '+261' }, { code: 'RE', dialCode: '+262' }, { code: 'YT', dialCode: '+262' },
    { code: 'ZW', dialCode: '+263' }, { code: 'NA', dialCode: '+264' }, { code: 'MW', dialCode: '+265' },
    { code: 'LS', dialCode: '+266' }, { code: 'BW', dialCode: '+267' }, { code: 'SZ', dialCode: '+268' },
    { code: 'KM', dialCode: '+269' }, { code: 'RW', dialCode: '+250' }, { code: 'ER', dialCode: '+291' },
    { code: 'AW', dialCode: '+297' }, { code: 'FO', dialCode: '+298' }, { code: 'GL', dialCode: '+299' },
    { code: 'GP', dialCode: '+590' }, { code: 'BL', dialCode: '+590' }, { code: 'SR', dialCode: '+597' },
    { code: 'GY', dialCode: '+592' }, { code: 'EC', dialCode: '+593' }, { code: 'GF', dialCode: '+594' },
    { code: 'PY', dialCode: '+595' }, { code: 'BO', dialCode: '+591' }, { code: 'FK', dialCode: '+500' },
    { code: 'GI', dialCode: '+350' }, { code: 'AX', dialCode: '+358' }, { code: 'SJ', dialCode: '+47' },
    { code: 'TK', dialCode: '+690' }, { code: 'TL', dialCode: '+670' }, { code: 'FJ', dialCode: '+679' },
    { code: 'PG', dialCode: '+675' }, { code: 'SB', dialCode: '+677' }, { code: 'VU', dialCode: '+678' },
    { code: 'NC', dialCode: '+687' }, { code: 'PF', dialCode: '+689' }, { code: 'PW', dialCode: '+680' },
    { code: 'WF', dialCode: '+681' }, { code: 'CK', dialCode: '+682' }, { code: 'NU', dialCode: '+683' },
    { code: 'WS', dialCode: '+685' }, { code: 'KI', dialCode: '+686' }, { code: 'TV', dialCode: '+688' },
    { code: 'TK', dialCode: '+690' }, { code: 'FM', dialCode: '+691' }, { code: 'MH', dialCode: '+692' },
    { code: 'KG', dialCode: '+996' }, { code: 'TM', dialCode: '+993' }, { code: 'TJ', dialCode: '+992' },
    { code: 'UZ', dialCode: '+998' }, { code: 'BD', dialCode: '+880' }, { code: 'MM', dialCode: '+95' },
    { code: 'TL', dialCode: '+670' }, { code: 'BN', dialCode: '+673' }, { code: 'NP', dialCode: '+977' },
    { code: 'BT', dialCode: '+975' }, { code: 'MV', dialCode: '+960' }, { code: 'PK', dialCode: '+92' },
    { code: 'LK', dialCode: '+94' }, { code: 'AF', dialCode: '+93' }, { code: 'IR', dialCode: '+98' },
    { code: 'OM', dialCode: '+968' }, { code: 'YE', dialCode: '+967' }, { code: 'AE', dialCode: '+971' },
    { code: 'QA', dialCode: '+974' }, { code: 'BH', dialCode: '+973' }, { code: 'KW', dialCode: '+965' },
    { code: 'SA', dialCode: '+966' }, { code: 'SY', dialCode: '+963' }, { code: 'IQ', dialCode: '+964' },
    { code: 'TR', dialCode: '+90' }, { code: 'CY', dialCode: '+357' }, { code: 'GE', dialCode: '+995' },
    { code: 'AZ', dialCode: '+994' }, { code: 'AM', dialCode: '+374' }, { code: 'EE', dialCode: '+372' },
    { code: 'LV', dialCode: '+371' }, { code: 'LT', dialCode: '+370' }, { code: 'MD', dialCode: '+373' },
    { code: 'BY', dialCode: '+375' }, { code: 'UA', dialCode: '+380' }, { code: 'BG', dialCode: '+359' },
    { code: 'RO', dialCode: '+40' }, { code: 'HU', dialCode: '+36' }, { code: 'SK', dialCode: '+421' },
    { code: 'CZ', dialCode: '+420' }, { code: 'PL', dialCode: '+48' }, { code: 'DE', dialCode: '+49' },
    { code: 'AT', dialCode: '+43' }, { code: 'LI', dialCode: '+423' }, { code: 'CH', dialCode: '+41' },
    { code: 'SE', dialCode: '+46' }, { code: 'NO', dialCode: '+47' }, { code: 'FI', dialCode: '+358' },
    { code: 'IS', dialCode: '+354' }, { code: 'DK', dialCode: '+45' }, { code: 'IE', dialCode: '+353' },
    { code: 'GB', dialCode: '+44' }, { code: 'PT', dialCode: '+351' }, { code: 'ES', dialCode: '+34' },
    { code: 'FR', dialCode: '+33' }, { code: 'BE', dialCode: '+32' }, { code: 'NL', dialCode: '+31' },
    { code: 'LU', dialCode: '+352' }, { code: 'MC', dialCode: '+377' }, { code: 'IT', dialCode: '+39' },
    { code: 'VA', dialCode: '+379' }, { code: 'SM', dialCode: '+378' }, { code: 'MT', dialCode: '+356' },
    { code: 'GR', dialCode: '+30' }, { code: 'AL', dialCode: '+355' }, { code: 'RS', dialCode: '+381' },
    { code: 'ME', dialCode: '+382' }, { code: 'BA', dialCode: '+387' }, { code: 'HR', dialCode: '+385' },
    { code: 'SI', dialCode: '+386' }, { code: 'MK', dialCode: '+389' }, { code: 'AD', dialCode: '+376' },
    { code: 'GI', dialCode: '+350' }, { code: 'FO', dialCode: '+298' }, { code: 'GL', dialCode: '+299' },
    { code: 'AW', dialCode: '+297' }, { code: 'AN', dialCode: '+599' }, { code: 'SX', dialCode: '+1-721' },
    { code: 'AI', dialCode: '+1-264' }, { code: 'AG', dialCode: '+1-268' }, { code: 'BS', dialCode: '+1-242' },
    { code: 'BB', dialCode: '+1-246' }, { code: 'BM', dialCode: '+1-441' }, { code: 'VG', dialCode: '+1-284' },
    { code: 'KY', dialCode: '+1-345' }, { code: 'DM', dialCode: '+1-767' }, { code: 'DO', dialCode: '+1-809' },
    { code: 'DO', dialCode: '+1-829' }, { code: 'DO', dialCode: '+1-849' }, { code: 'GD', dialCode: '+1-473' },
    { code: 'JM', dialCode: '+1-876' }, { code: 'MS', dialCode: '+1-664' }, { code: 'KN', dialCode: '+1-869' },
    { code: 'LC', dialCode: '+1-758' }, { code: 'VC', dialCode: '+1-784' }, { code: 'PR', dialCode: '+1-787' },
    { code: 'PR', dialCode: '+1-939' }, { code: 'TC', dialCode: '+1-649' }, { code: 'TT', dialCode: '+1-868' },
    { code: 'VI', dialCode: '+1-340' },
];

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

  /**
   * Funkcia na formátovanie telefónneho čísla s medzerou po predvoľbe.
   * Dynamicky určí dĺžku predvoľby.
   * @param {string} phoneNumber - Neformátované telefónne číslo.
   * @returns {string} - Formátované telefónne číslo.
   */
  const formatPhoneNumber = (phoneNumber) => {
    if (!phoneNumber) return '';
    // Odstránime všetky nečíselné znaky okrem znaku '+' na začiatku
    const cleaned = ('' + phoneNumber).replace(/[^\d+]/g, '');
  
    // Najprv sa pokúsime nájsť zhodu s najdlhšou predvoľbou
    for (const { dialCode } of countryDialCodes.sort((a, b) => b.dialCode.length - a.dialCode.length)) {
        if (cleaned.startsWith(dialCode)) {
            const localNumber = cleaned.substring(dialCode.length);
            // Pridanie medzier pre lepšiu čitateľnosť, napr. "9xx xxx xxx"
            const formattedLocal = localNumber.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
            // Spojíme predvoľbu a lokálne číslo s jednou medzerou
            return `${dialCode} ${formattedLocal}`;
        }
    }
  
    // Ak sa predvoľba nenájde, vrátime číslo bez formátovania, len s medzerami
    return cleaned.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
  };
  
  // Funkcia, ktorá zobrazuje fakturačné údaje a adresu
  const renderBillingAndAddressInfo = (data) => {
    if (!data || !data.billingInfo || !data.billingInfo.companyName) {
      return null;
    }
  
    const { companyName, ic, dic, address, city, zip, country } = data.billingInfo;
    const isCompany = data.role === 'hall' || data.role === 'admin';
  
    return (
      React.createElement(
        'div',
        { className: 'bg-white p-6 rounded-lg shadow-md' },
        React.createElement(
          'h2',
          { className: 'text-2xl font-bold mb-4 text-gray-800' },
          'Fakturačné údaje a adresa'
        ),
        React.createElement(
          'p',
          { className: 'text-gray-800 text-lg' },
          React.createElement('span', { className: 'font-bold' }, 'Oficiálny názov klubu:'),
          ` ${companyName}`
        ),
        React.createElement(
          'p',
          { className: 'text-gray-800 text-lg' },
          React.createElement('span', { className: 'font-bold' }, 'IČO:'),
          ` ${ic}`
        ),
        React.createElement(
          'p',
          { className: 'text-gray-800 text-lg' },
          React.createElement('span', { className: 'font-bold' }, 'DIČ:'),
          ` ${dic}`
        ),
        React.createElement(
          'p',
          { className: 'text-gray-800 text-lg' },
          React.createElement('span', { className: 'font-bold' }, 'Adresa:'),
          ` ${address}, ${zip} ${city}, ${country}`
        )
      )
    );
  };

  // Effect pre nastavenie event listenera na globálnu udalosť
  React.useEffect(() => {
    const handleGlobalDataUpdate = (event) => {
      const data = event.detail;
      setUserProfileData(data);
      setLoading(false);
      
      // Zmena farby hlavičky na základe roly
      const headerElement = document.querySelector('header');
      if (headerElement) {
        headerElement.style.backgroundColor = getHeaderColor(data?.role);
      }
    };

    window.addEventListener('globalDataUpdated', handleGlobalDataUpdate);
    
    // Počiatočné nastavenie, ak sú dáta už načítané
    if (window.globalUserProfileData) {
      handleGlobalDataUpdate({ detail: window.globalUserProfileData });
    } else {
      setLoading(false);
    }
    
    return () => {
      window.removeEventListener('globalDataUpdated', handleGlobalDataUpdate);
    };
  }, []); // Prázdne pole zabezpečí, že efekt sa spustí iba raz pri načítaní komponentu

  if (loading) {
    return React.createElement('div', { className: 'flex justify-center items-center h-screen' }, 'Načítavam...');
  }
  
  if (error) {
    return React.createElement('div', { className: 'flex justify-center items-center h-screen text-red-500' }, error);
  }

  if (!userProfileData) {
    return React.createElement('div', { className: 'flex justify-center items-center h-screen' }, 'Žiadne používateľské dáta.');
  }

  // Celá štruktúra stránky je vykreslená tu
  return (
    React.createElement('div', { className: 'min-h-screen bg-gray-100 p-8 pt-16' },
      React.createElement(
        'div',
        { className: 'bg-white rounded-lg shadow-md p-6 max-w-4xl mx-auto mb-8' },
        React.createElement(
          'h1',
          { className: 'text-3xl font-bold mb-4 text-gray-800' },
          'Moja zóna'
        ),
        React.createElement(
          'div',
          { className: 'mb-4' },
          React.createElement(
            'h2',
            { className: 'text-2xl font-bold mb-2 text-gray-800' },
            'Osobné údaje'
          ),
          userProfileData.role === 'admin' ? (
              // Pre admina
              React.createElement(React.Fragment, null,
                  React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg' },
                    React.createElement('span', { className: 'font-bold' }, 'Meno a priezvisko:'),
                    ` ${userProfileData.firstName} ${userProfileData.lastName}`
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
        )
      ),
      
      // Zobrazí fakturačné údaje a adresu, ak existujú
      renderBillingAndAddressInfo(userProfileData),
    )
  );
}

// Export pre možnosť načítania v HTML
window.MyDataApp = MyDataApp;
