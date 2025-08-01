// logged-in-my-data.js
// Tento súbor predpokladá, že Firebase SDK je inicializovaný v <head> logged-in-my-data.html
// a authentication.js spravuje globálnu autentifikáciu a stav používateľa.

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
    // Odstránime všetky medzery pre lepšiu manipuláciu
    const cleanedNumber = number.replace(/\s+/g, '');
    
    // Predpokladáme, že telefónne číslo začína predvoľbou (+[1-4 číslice])
    const prefixMatch = cleanedNumber.match(/^(\+\d{1,4})/);
    let prefix = '';
    let remainingNumber = cleanedNumber;

    if (prefixMatch) {
      prefix = prefixMatch[1] + ' ';
      remainingNumber = cleanedNumber.substring(prefixMatch[1].length);
    }
    
    // Rozdelíme zvyšné číslice na skupiny po troch
    const formattedRest = remainingNumber.replace(/(\d{3})/g, '$1 ').trim();
    
    return `${prefix}${formattedRest}`;
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
