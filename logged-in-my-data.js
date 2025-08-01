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
            setError('Žiadne profilové dáta neboli nájdené. Skúste sa znova prihlásiť.');
          }
      }
    };
    
    // Pridáme listener na globálnu udalosť
    window.addEventListener('globalDataUpdated', handleDataUpdate);

    // Počiatočná synchronizácia, ak už sú dáta dostupné pri prvom vykreslení
    // Toto je dôležité, ak sa udalosti spustia pred pripojením listenera
    if (window.isGlobalAuthReady) {
        handleDataUpdate();
    }
    
    // Cleanup funkcia pre odstránenie listenera
    return () => {
        window.removeEventListener('globalDataUpdated', handleDataUpdate);
    };
  }, []);

  // Funkcia na zobrazenie obsahu profilu
  const renderProfileContent = () => {
    if (!userProfileData) {
      return React.createElement(
        'div',
        { className: 'text-center p-8 bg-red-100 rounded-lg shadow-md' },
        React.createElement('h2', { className: 'text-2xl font-bold text-red-700' }, 'Chyba'),
        React.createElement('p', { className: 'mt-4 text-red-600' }, error || 'Profilové dáta sa nepodarilo načítať. Skúste sa, prosím, odhlásiť a znova prihlásiť.')
      );
    }
    
    // Dáta pre zobrazenie
    const { email, name, role, registration, clubName, billingAddress } = userProfileData;

    return React.createElement(
      'div',
      { className: 'bg-white rounded-lg shadow-xl p-8 max-w-2xl mx-auto' },
      React.createElement('h2', { className: 'text-3xl font-bold text-blue-800 mb-6 text-center' }, `Moja zóna - ${name}`),
      React.createElement(
        'div',
        { className: 'space-y-4' },
        React.createElement(
          'div',
          { className: 'p-4 bg-gray-50 rounded-lg border border-gray-200' },
          React.createElement('h3', { className: 'text-2xl font-semibold text-blue-700 mb-2' }, 'Osobné údaje'),
          React.createElement(
            'p',
            { className: 'text-gray-800 text-lg' },
            React.createElement('span', { className: 'font-bold' }, 'Meno:'),
            ` ${name}`
          ),
          React.createElement(
            'p',
            { className: 'text-gray-800 text-lg' },
            React.createElement('span', { className: 'font-bold' }, 'E-mail:'),
            ` ${email}`
          ),
          React.createElement(
            'p',
            { className: 'text-gray-800 text-lg' },
            React.createElement('span', { className: 'font-bold' }, 'Rola:'),
            ` ${role || 'Nezadaná'}`
          )
        ),
        React.createElement(
          'div',
          { className: 'p-4 bg-gray-50 rounded-lg border border-gray-200' },
          React.createElement('h3', { className: 'text-2xl font-semibold text-blue-700 mb-2' }, 'Registrácia'),
          registration && React.createElement(
            'p',
            { className: 'text-gray-800 text-lg' },
            React.createElement('span', { className: 'font-bold' }, 'Stav:'),
            ` ${registration.status || 'Nezadaný'}`
          ),
          registration && React.createElement(
            'p',
            { className: 'text-gray-800 text-lg' },
            React.createElement('span', { className: 'font-bold' }, 'Kategória:'),
            ` ${registration.category || 'Nezadaná'}`
          )
        ),
        React.createElement(
          'div',
          { className: 'p-4 bg-gray-50 rounded-lg border border-gray-200' },
          React.createElement('h3', { className: 'text-2xl font-semibold text-blue-700 mb-2' }, 'Fakturačné údaje'),
          clubName && React.createElement(
            'p',
            { className: 'text-gray-800 text-lg' },
            React.createElement('span', { className: 'font-bold' }, 'Klub:'),
            ` ${clubName}`
          ),
          // Fakturačná adresa sa teraz berie z top-level polí, ale zobrazuje sa v tomto bloku
          billingAddress && React.createElement(
            'p',
            { className: 'text-gray-800 text-lg' },
            React.createElement('span', { className: 'font-bold' }, 'Adresa:'),
            ` ${billingAddress}`
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
      )
    );
  }

  // Zobrazenie načítacieho stavu
  if (loading) {
    return React.createElement(
      'div',
      { className: 'flex justify-center items-center min-h-screen' },
      React.createElement('div', { className: 'text-xl text-blue-600' }, 'Načítavam profilové dáta...')
    );
  }

  // Hlavné renderovanie komponentu
  return React.createElement(
    'div',
    { className: 'flex flex-col items-center justify-center p-4' },
    renderProfileContent()
  );
}

// Exportujeme komponent, aby bol dostupný globálne, nielen v module
window.MyDataApp = MyDataApp;
