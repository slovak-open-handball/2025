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
    { code: 'BG', dialCode: '+359' }, { code: 'HU', dialCode: '+36' }, { code: 'LT', dialCode: '+370' },
    { code: 'LV', dialCode: '+371' }, { code: 'MD', dialCode: '+373' }, { code: 'AM', dialCode: '+374' },
    { code: 'BY', dialCode: '+375' }, { code: 'UA', dialCode: '+380' }, { code: 'RS', dialCode: '+381' },
    { code: 'ME', dialCode: '+382' }, { code: 'HR', dialCode: '+385' }, { code: 'SI', dialCode: '+386' },
    { code: 'BA', dialCode: '+387' }, { code: 'MK', dialCode: '+389' }, { code: 'IT', dialCode: '+39' },
    { code: 'RO', dialCode: '+40' }, { code: 'CH', dialCode: '+41' }, { code: 'CZ', dialCode: '+420' },
    { code: 'SK', dialCode: '+421' }, { code: 'LI', dialCode: '+423' }, { code: 'AT', dialCode: '+43' },
    { code: 'GB', dialCode: '+44' }, { code: 'DK', dialCode: '+45' }, { code: 'SE', dialCode: '+46' },
    { code: 'NO', dialCode: '+47' }, { code: 'PL', dialCode: '+48' }, { code: 'DE', dialCode: '+49' },
    { code: 'PE', dialCode: '+51' }, { code: 'MX', dialCode: '+52' }, { code: 'CU', dialCode: '+53' },
    { code: 'AR', dialCode: '+54' }, { code: 'BR', dialCode: '+55' }, { code: 'CL', dialCode: '+56' },
    { code: 'CO', dialCode: '+57' }, { code: 'VE', dialCode: '+58' }, { code: 'MY', dialCode: '+60' },
    { code: 'AU', dialCode: '+61' }, { code: 'ID', dialCode: '+62' }, { code: 'PH', dialCode: '+63' },
    { code: 'NZ', dialCode: '+64' }, { code: 'SG', dialCode: '+65' }, { code: 'TH', dialCode: '+66' },
    { code: 'TL', dialCode: '+670' }, { code: 'NF', dialCode: '+672' }, { code: 'BN', dialCode: '+673' },
    { code: 'NR', dialCode: '+674' }, { code: 'PG', dialCode: '+675' }, { code: 'TO', dialCode: '+676' },
    { code: 'SB', dialCode: '+677' }, { code: 'VU', dialCode: '+678' }, { code: 'FJ', dialCode: '+679' },
    { code: 'CK', dialCode: '+682' }, { code: 'NU', dialCode: '+683' }, { code: 'WS', dialCode: '+685' },
    { code: 'KI', dialCode: '+686' }, { code: 'NC', dialCode: '+687' }, { code: 'TV', dialCode: '+688' },
    { code: 'PF', dialCode: '+689' }, { code: 'LA', dialCode: '+856' }, { code: 'KP', dialCode: '+850' },
    { code: 'KR', dialCode: '+82' }, { code: 'JP', dialCode: '+81' }, { code: 'VN', dialCode: '+84' },
    { code: 'TW', dialCode: '+886' }, { code: 'BD', dialCode: '+880' }, { code: 'KH', dialCode: '+855' },
    { code: 'MO', dialCode: '+853' }, { code: 'HK', dialCode: '+852' }, { code: 'CN', dialCode: '+86' },
    { code: 'IN', dialCode: '+91' }, { code: 'PK', dialCode: '+92' }, { code: 'AF', dialCode: '+93' },
    { code: 'LK', dialCode: '+94' }, { code: 'MM', dialCode: '+95' }, { code: 'IQ', dialCode: '+964' },
    { code: 'IR', dialCode: '+98' }, { code: 'JO', dialCode: '+962' }, { code: 'KW', dialCode: '+965' },
    { code: 'SA', dialCode: '+966' }, { code: 'YE', dialCode: '+967' }, { code: 'OM', dialCode: '+968' },
    { code: 'PS', dialCode: '+970' }, { code: 'IL', dialCode: '+972' }, { code: 'QA', dialCode: '+974' },
    { code: 'BT', dialCode: '+975' }, { code: 'MN', dialCode: '+976' }, { code: 'NP', dialCode: '+977' },
    { code: 'TM', dialCode: '+993' }, { code: 'AZ', dialCode: '+994' }, { code: 'GE', dialCode: '+995' },
    { code: 'KG', dialCode: '+996' }, { code: 'UZ', dialCode: '+998' }, { code: 'TJ', dialCode: '+992' },
    { code: 'DZ', dialCode: '+213' }, { code: 'MA', dialCode: '+212' }, { code: 'LY', dialCode: '+218' },
    { code: 'BF', dialCode: '+226' }, { code: 'BJ', dialCode: '+229' }, { code: 'GM', dialCode: '+220' },
    { code: 'GN', dialCode: '+224' }, { code: 'CI', dialCode: '+225' }, { code: 'ML', dialCode: '+223' },
    { code: 'NE', dialCode: '+227' }, { code: 'NG', dialCode: '+234' }, { code: 'TG', dialCode: '+228' },
    { code: 'SL', dialCode: '+232' }, { code: 'GH', dialCode: '+233' }, { code: 'TD', dialCode: '+235' },
    { code: 'CF', dialCode: '+236' }, { code: 'CM', dialCode: '+237' }, { code: 'CV', dialCode: '+238' },
    { code: 'ST', dialCode: '+239' }, { code: 'GQ', dialCode: '+240' }, { code: 'GA', dialCode: '+241' },
    { code: 'CG', dialCode: '+242' }, { code: 'CD', dialCode: '+243' }, { code: 'AO', dialCode: '+244' },
    { code: 'GW', dialCode: '+245' }, { code: 'IO', dialCode: '+246' }, { code: 'SC', dialCode: '+248' },
    { code: 'SD', dialCode: '+249' }, { code: 'RW', dialCode: '+250' }, { code: 'ET', dialCode: '+251' },
    { code: 'SO', dialCode: '+252' }, { code: 'DJ', dialCode: '+253' }, { code: 'KE', dialCode: '+254' },
    { code: 'TZ', dialCode: '+255' }, { code: 'UG', dialCode: '+256' }, { code: 'BI', dialCode: '+257' },
    { code: 'MZ', dialCode: '+258' }, { code: 'ZM', dialCode: '+260' }, { code: 'MG', dialCode: '+261' },
    { code: 'RE', dialCode: '+262' }, { code: 'YT', dialCode: '+262' }, { code: 'NA', dialCode: '+264' },
    { code: 'MW', dialCode: '+265' }, { code: 'LS', dialCode: '+266' }, { code: 'BW', dialCode: '+267' },
    { code: 'SZ', dialCode: '+268' }, { code: 'KM', dialCode: '+269' }, { code: 'SH', dialCode: '+290' },
    { code: 'ER', dialCode: '+291' }, { code: 'AW', dialCode: '+297' }, { code: 'FO', dialCode: '+298' },
    { code: 'GL', dialCode: '+299' }, { code: 'GP', dialCode: '+590' }, { code: 'MF', dialCode: '+590' },
    { code: 'BO', dialCode: '+591' }, { code: 'GY', dialCode: '+592' }, { code: 'EC', dialCode: '+593' },
    { code: 'GF', dialCode: '+594' }, { code: 'PY', dialCode: '+595' }, { code: 'MQ', dialCode: '+596' },
    { code: 'SR', dialCode: '+597' }, { code: 'UY', dialCode: '+598' }, { code: 'CW', dialCode: '+599' },
    { code: 'BQ', dialCode: '+599' }, { code: 'BH', dialCode: '+973' }, { code: 'EE', dialCode: '+372' },
    { code: 'AX', dialCode: '+358' }, { code: 'SJ', dialCode: '+47' }, { code: 'GF', dialCode: '+594' },
    { code: 'PM', dialCode: '+508' }, { code: 'FK', dialCode: '+500' }, { code: 'GY', dialCode: '+592' },
    { code: 'GN', dialCode: '+224' }, { code: 'GW', dialCode: '+245' }, { code: 'SL', dialCode: '+232' },
    { code: 'EH', dialCode: '+212' }, { code: 'SY', dialCode: '+963' }, { code: 'TC', dialCode: '+1-649' },
    { code: 'AG', dialCode: '+1-268' }, { code: 'AI', dialCode: '+1-264' }, { code: 'AS', dialCode: '+1-684' },
    { code: 'BB', dialCode: '+1-246' }, { code: 'BM', dialCode: '+1-441' }, { code: 'BS', dialCode: '+1-242' },
    { code: 'DM', dialCode: '+1-767' }, { code: 'DO', dialCode: '+1-809' }, { code: 'GD', dialCode: '+1-473' },
    { code: 'GU', dialCode: '+1-671' }, { code: 'JM', dialCode: '+1-876' }, { code: 'KN', dialCode: '+1-869' },
    { code: 'KY', dialCode: '+1-345' }, { code: 'MP', dialCode: '+1-670' }, { code: 'MS', dialCode: '+1-664' },
    { code: 'PR', dialCode: '+1-787' }, { code: 'SX', dialCode: '+1-721' }, { code: 'TC', dialCode: '+1-649' },
    { code: 'TT', dialCode: '+1-868' }, { code: 'VC', dialCode: '+1-784' }, { code: 'VG', dialCode: '+1-284' },
    { code: 'VI', dialCode: '+1-340' }, { code: 'PN', dialCode: '+872' }, { code: 'CC', dialCode: '+61' },
    { code: 'CX', dialCode: '+61' }, { code: 'WF', dialCode: '+681' }, { code: 'NU', dialCode: '+683' },
    { code: 'NR', dialCode: '+674' }, { code: 'BL', dialCode: '+590' }, { code: 'CZ', dialCode: '+420' },
    { code: 'SK', dialCode: '+421' }
].sort((a, b) => b.dialCode.length - a.dialCode.length); // Zoradenie zostupne

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
    const handleDataUpdate = () => {
      console.log('MyDataApp: Prijatá udalosť "globalDataUpdated". Aktualizujem stav.');
      if (window.isGlobalAuthReady) {
          if (window.globalUserProfileData) {
            setUserProfileData(window.globalUserProfileData);
            setLoading(false);
            setError('');
          } else {
            // Ak sú dáta null, ale autentifikácia je hotová, nie sú žiadne dáta.
            setUserProfileData(null);
            setLoading(false);
            // Zobrazíme upozornenie, ak používateľ nemá profil (napr. nový používateľ)
            setError('Váš profil neobsahuje žiadne dáta. Prosím, dokončite registráciu.');
          }
      }
    };

    // Pripojíme listener na udalosť
    window.addEventListener('globalDataUpdated', handleDataUpdate);

    // Initial check in case the event was fired before the component mounted
    if (window.isGlobalAuthReady) {
      handleDataUpdate();
    } else {
      setLoading(true); // Znova nastavíme loading, ak ešte nie sme pripravení
    }

    // Funkcia pre odhlásenie listenera pri unmountovaní komponentu
    return () => {
      window.removeEventListener('globalDataUpdated', handleDataUpdate);
    };
  }, []); // Prázdne pole znamená, že efekt sa spustí len raz, pri mountovaní

  // Pomocná funkcia na formátovanie PSČ
  const formatPostalCode = (code) => {
    if (!code) return '';
    return code.replace(/(\d{3})(\d{2})/, '$1 $2');
  };

  // Pomocná funkcia na formátovanie telefónneho čísla
  const formatPhoneNumber = (number) => {
    if (!number) return '';
    // Odstránime všetky znaky okrem číslic a plus
    const cleanedNumber = number.replace(/[^\d+]/g, '');
    
    let prefix = '';
    let remainingNumber = cleanedNumber;

    // Prechádzame zoznam predvolieb a hľadáme najdlhšiu zhodu
    for (const code of countryDialCodes) {
      if (cleanedNumber.startsWith(code.dialCode)) {
        prefix = code.dialCode;
        remainingNumber = cleanedNumber.substring(code.dialCode.length);
        break; // Akonáhle nájdeme najdlhšiu zhodu, skončíme
      }
    }

    // Ak sa predvolba nenašla, ponecháme číslo bez predvoľby
    if (prefix === '') {
      remainingNumber = cleanedNumber;
    }
    
    // Rozdelíme zvyšné číslice na skupiny po troch
    const formattedRest = remainingNumber.replace(/(\d{3})/g, '$1 ').trim();
    
    return `${prefix}${formattedRest}`.trim();
  };

  // Funkcia pre renderovanie fakturačných údajov a adresy
  const renderBillingAndAddressInfo = () => {
    // Ak neexistujú žiadne fakturačné údaje ani adresa, nič nezobrazíme
    if (!userProfileData.billing && !userProfileData.street) {
        return null;
    }
    
    return React.createElement(
      'div',
      { className: 'p-6 bg-white rounded-lg shadow-md' },
      React.createElement(
        'h2',
        { className: 'text-2xl font-semibold text-blue-800 mb-4' },
        'Fakturačné údaje a adresa'
      ),
      React.createElement(
        'div',
        { className: 'space-y-2' },
        userProfileData.billing && userProfileData.billing.clubName && React.createElement(
          'p',
          { className: 'text-gray-800 text-lg' },
          React.createElement('span', { className: 'font-bold' }, 'Oficiálny názov klubu:'),
          ` ${userProfileData.billing.clubName}`
        ),
        // Zobrazenie adresy vrátane krajiny a formátovaného PSČ
        userProfileData.street && React.createElement(
            'p',
            { className: 'text-gray-800 text-lg' },
            React.createElement('span', { className: 'font-bold' }, 'Adresa:'),
            ` ${userProfileData.street} ${userProfileData.houseNumber}, ${formatPostalCode(userProfileData.postalCode)} ${userProfileData.city}, ${userProfileData.country}`
        ),
        userProfileData.billing && userProfileData.billing.ico && React.createElement(
          'p',
          { className: 'text-gray-800 text-lg' },
          React.createElement('span', { className: 'font-bold' }, 'IČO:'),
          ` ${userProfileData.billing.ico}`
        ),
        userProfileData.billing && userProfileData.billing.dic && React.createElement(
          'p',
          { className: 'text-gray-800 text-lg' },
          React.createElement('span', { className: 'font-bold' }, 'DIČ:'),
          ` ${userProfileData.billing.dic}`
        ),
        userProfileData.billing && userProfileData.billing.icDph && React.createElement(
          'p',
          { className: 'text-gray-800 text-lg' },
          React.createElement('span', { className: 'font-bold' }, 'IČ DPH:'),
          ` ${userProfileData.billing.icDph}`
        )
      )
    );
  };

  // Hlavné renderovanie komponentu
  return React.createElement(
    'div',
    { className: 'bg-gray-100 min-h-screen p-8 mt-4 md:mt-4' },
    // Loading state
    loading && React.createElement(
      'div',
      { className: 'flex items-center justify-center h-64' },
      React.createElement('div', { className: 'animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500' })
    ),

    // Error state
    error && React.createElement(
      'div',
      { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative max-w-4xl mx-auto', role: 'alert' },
      React.createElement('strong', { className: 'font-bold' }, 'Chyba! '),
      React.createElement('span', { className: 'block sm:inline' }, error)
    ),

    // Data loaded state
    !loading && !error && userProfileData && React.createElement(
      'div',
      { className: 'max-w-4xl mx-auto space-y-6' }, // Hlavný kontajner s obmedzenou šírkou
      // Pásik s dynamickou farbou (teraz v kontajneri)
      React.createElement(
          'div',
          {
              className: 'p-6 rounded-lg shadow-md',
              style: { backgroundColor: getHeaderColor(userProfileData.role), color: 'white' }
          },
          React.createElement(
              'div',
              { className: 'flex justify-between items-center' },
              React.createElement(
                  'h1',
                  { className: 'text-3xl font-bold' },
                  'Moja zóna'
              )
          )
      ),

      // Karta s osobnými údajmi
      React.createElement(
        'div',
        { className: 'p-6 bg-white rounded-lg shadow-md' },
        React.createElement(
          'h2',
          { className: 'text-2xl font-semibold text-blue-800 mb-4' },
          'Osobné údaje'
        ),
        React.createElement(
          'div',
          { className: 'space-y-2' },
          // Podmienene zobrazenie popisov pre admina, hall a ostatných
          userProfileData.role === 'hall' ? (
              // Pre Halu
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
          ) : userProfileData.role === 'admin' ? (
              // Pre administrátora
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
