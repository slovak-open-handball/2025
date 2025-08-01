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

  // Efekt pre nastavenie event listenera na globálnu udalosť
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
            setError('Žiadne používateľské dáta neboli nájdené. Skúste sa prihlásiť znova.');
          }
      }
    };

    // Pridáme listener na globálnu udalosť
    window.addEventListener('globalDataUpdated', handleDataUpdate);

    // Initial check in case the event fired before the listener was attached
    if (window.isGlobalAuthReady) {
        handleDataUpdate();
    }

    // Cleanup funkcia pre odstránenie listenera
    return () => {
        window.removeEventListener('globalDataUpdated', handleDataUpdate);
    };
  }, []); // [] zabezpečí, že sa useEffect spustí iba raz pri načítaní komponentu

  // Pomocná funkcia na formátovanie Firebase Timestamp na čitateľný reťazec
  const formatDate = (timestamp) => {
    if (!timestamp || !timestamp.seconds) return 'N/A';
    const date = new Date(timestamp.seconds * 1000);
    return `${date.toLocaleDateString('sk-SK')} ${date.toLocaleTimeString('sk-SK')}`;
  };

  // Renderovanie na základe stavu
  if (loading) {
    return React.createElement(
      'div',
      { className: 'flex justify-center items-center h-screen bg-gray-100' },
      React.createElement(
        'div',
        { className: 'text-center' },
        React.createElement(
          'svg',
          { className: 'animate-spin h-12 w-12 text-blue-500 mx-auto', xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24' },
          React.createElement('circle', { className: 'opacity-25', cx: '12', cy: '12', r: '10', stroke: 'currentColor', strokeWidth: '4' }),
          React.createElement('path', { className: 'opacity-75', fill: 'currentColor', d: 'M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z' })
        ),
        React.createElement('p', { className: 'mt-4 text-gray-600' }, 'Načítavam dáta...')
      )
    );
  }

  if (error) {
    return React.createElement(
      'div',
      { className: 'flex justify-center items-center h-screen bg-gray-100' },
      React.createElement(
        'div',
        { className: 'p-8 bg-white rounded-lg shadow-md text-center max-w-sm' },
        React.createElement('h2', { className: 'text-2xl font-bold text-red-600 mb-4' }, 'Chyba'),
        React.createElement('p', { className: 'text-gray-700' }, error)
      )
    );
  }

  // Prehľadné zobrazenie všetkých dostupných dát
  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 p-4 md:p-8' },
    React.createElement(
      'div',
      { className: 'container mx-auto mt-8' },
      userProfileData ? (
        React.createElement(
          'div',
          { className: 'bg-white rounded-lg shadow-xl overflow-hidden' },
          // Header sekcie
          React.createElement(
            'div',
            { className: 'bg-blue-600 text-white p-6' },
            React.createElement('h1', { className: 'text-3xl font-bold' }, `Moja zóna - ${userProfileData.firstName} ${userProfileData.lastName}`),
            React.createElement('p', { className: 'mt-2 text-blue-200' }, 'Prehľad vašich profilových a registračných údajov.'),
            React.createElement(
              'div',
              { className: 'mt-4 flex flex-wrap gap-4 text-sm' },
              React.createElement('span', { className: 'bg-blue-800 text-white px-3 py-1 rounded-full' }, `Rola: ${userProfileData.role || 'N/A'}`),
              React.createElement('span', { className: `px-3 py-1 rounded-full font-semibold ${userProfileData.approved ? 'bg-green-500' : 'bg-red-500'}` }, userProfileData.approved ? 'Schválený' : 'Neschválený'),
            )
          ),
          
          // Sekcie s dátami
          React.createElement(
            'div',
            { className: 'p-6 space-y-8' },
            // Osobné údaje
            React.createElement(
              'div',
              { className: 'border-b pb-6 border-gray-200' },
              React.createElement('h2', { className: 'text-2xl font-semibold text-gray-700 mb-4' }, 'Osobné údaje'),
              React.createElement(
                'div',
                { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                React.createElement('p', { className: 'text-gray-800 text-lg' }, React.createElement('span', { className: 'font-bold' }, 'Meno:'), ` ${userProfileData.firstName || 'N/A'}`),
                React.createElement('p', { className: 'text-gray-800 text-lg' }, React.createElement('span', { className: 'font-bold' }, 'Priezvisko:'), ` ${userProfileData.lastName || 'N/A'}`),
                React.createElement('p', { className: 'text-gray-800 text-lg' }, React.createElement('span', { className: 'font-bold' }, 'E-mail:'), ` ${userProfileData.email || 'N/A'}`),
                React.createElement('p', { className: 'text-gray-800 text-lg' }, React.createElement('span', { className: 'font-bold' }, 'Telefón:'), ` ${userProfileData.contactPhoneNumber || 'N/A'}`),
              )
            ),

            // Adresa
            React.createElement(
              'div',
              { className: 'border-b pb-6 border-gray-200' },
              React.createElement('h2', { className: 'text-2xl font-semibold text-gray-700 mb-4' }, 'Adresa'),
              React.createElement(
                'div',
                { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                React.createElement('p', { className: 'text-gray-800 text-lg' }, React.createElement('span', { className: 'font-bold' }, 'Ulica:'), ` ${userProfileData.street || 'N/A'}`),
                React.createElement('p', { className: 'text-gray-800 text-lg' }, React.createElement('span', { className: 'font-bold' }, 'Číslo domu:'), ` ${userProfileData.houseNumber || 'N/A'}`),
                React.createElement('p', { className: 'text-gray-800 text-lg' }, React.createElement('span', { className: 'font-bold' }, 'Mesto:'), ` ${userProfileData.city || 'N/A'}`),
                React.createElement('p', { className: 'text-gray-800 text-lg' }, React.createElement('span', { className: 'font-bold' }, 'PSČ:'), ` ${userProfileData.postalCode || 'N/A'}`),
                React.createElement('p', { className: 'text-gray-800 text-lg' }, React.createElement('span', { className: 'font-bold' }, 'Krajina:'), ` ${userProfileData.country || 'N/A'}`),
              )
            ),

            // Fakturačné údaje (ak existujú)
            userProfileData.billing && React.createElement(
              'div',
              { className: 'border-b pb-6 border-gray-200' },
              React.createElement('h2', { className: 'text-2xl font-semibold text-gray-700 mb-4' }, 'Fakturačné údaje'),
              React.createElement(
                'div',
                { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                userProfileData.billing.clubName && React.createElement(
                  'p',
                  { className: 'text-gray-800 text-lg' },
                  React.createElement('span', { className: 'font-bold' }, 'Názov klubu:'),
                  ` ${userProfileData.billing.clubName}`
                ),
                userProfileData.billing.ico && React.createElement(
                  'p',
                  { className: 'text-gray-800 text-lg' },
                  React.createElement('span', { className: 'font-bold' }, 'IČO:'),
                  ` ${userProfileData.billing.ico}`
                ),
                userProfileData.billing.dic && React.createElement(
                  'p',
                  { className: 'text-gray-800 text-lg' },
                  React.createElement('span', { className: 'font-bold' }, 'DIČ:'),
                  ` ${userProfileData.billing.dic}`
                ),
                userProfileData.billing.icDph && React.createElement(
                  'p',
                  { className: 'text-gray-800 text-lg' },
                  React.createElement('span', { className: 'font-bold' }, 'IČ DPH:'),
                  ` ${userProfileData.billing.icDph}`
                )
              )
            ),

            // Administratívne údaje
            React.createElement(
              'div',
              null,
              React.createElement('h2', { className: 'text-2xl font-semibold text-gray-700 mb-4' }, 'Administratívne údaje'),
              React.createElement(
                'div',
                { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                React.createElement(
                  'p',
                  { className: 'text-gray-800 text-lg' },
                  React.createElement('span', { className: 'font-bold' }, 'ID používateľa:'),
                  ` ${userProfileData.id || 'N/A'}`
                ),
                React.createElement(
                  'p',
                  { className: 'text-gray-800 text-lg' },
                  React.createElement('span', { className: 'font-bold' }, 'Dátum registrácie:'),
                  ` ${formatDate(userProfileData.registrationDate)}`
                ),
                React.createElement(
                  'p',
                  { className: 'text-gray-800 text-lg' },
                  React.createElement('span', { className: 'font-bold' }, 'Heslo naposledy zmenené:'),
                  ` ${formatDate(userProfileData.passwordLastChanged)}`
                ),
              )
            ),
          )
        )
      ) : (
        // Ak používateľ nie je prihlásený, zobrazíme výzvu
        React.createElement(
          'div',
          { className: 'p-8 bg-white rounded-lg shadow-md text-center max-w-sm mx-auto' },
          React.createElement('h2', { className: 'text-2xl font-bold text-gray-800 mb-4' }, 'Nie ste prihlásený'),
          React.createElement('p', { className: 'text-gray-700' }, 'Prosím, prihláste sa, aby ste videli svoje dáta.'),
          React.createElement('a', { href: 'login.html', className: 'mt-4 inline-block bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200' }, 'Prihlásenie')
        )
      )
    )
  );
}

// Global scope export so it can be used in the HTML file
window.MyDataApp = MyDataApp;
