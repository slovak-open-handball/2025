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
    const handleDataUpdate = (event) => {
      console.log('MyDataApp: Prijatá udalosť "globalDataUpdated". Aktualizujem stav.');
      const data = event.detail; // Dáta sú teraz v event.detail
      if (data) {
        setUserProfileData(data);
        setLoading(false);
        setError('');
      } else {
        // Ak sú dáta null, ale autentifikácia je hotová, nie sú žiadne dáta.
        setUserProfileData(null);
        setLoading(false);
        setError('Nepodarilo sa načítať používateľské dáta.');
      }
    };

    // Pripojíme listener
    window.addEventListener('globalDataUpdated', handleDataUpdate);
    
    // Načítame počiatočné dáta, ak už existujú
    if (window.isGlobalAuthReady) {
        handleDataUpdate({ detail: window.globalUserProfileData });
    }

    // Cleanup funkcia, ktorá odstráni listener po odpojení komponentu
    return () => {
      window.removeEventListener('globalDataUpdated', handleDataUpdate);
    };
  }, []);

  // Funkcia na renderovanie detailov o používateľovi
  const renderUserProfile = (data) => {
    // Získame adresu, ak existuje, pre správne zobrazenie
    const billingAddress = data.billingAddress || 'Nezadaná';
    
    // Používame React.createElement na dynamické vytváranie elementov z objektu
    return React.createElement(
      'div',
      { className: 'p-6 bg-white rounded-xl shadow-lg w-full max-w-2xl mx-auto' },
      React.createElement(
        'div',
        { className: 'flex items-center space-x-4 mb-4 border-b pb-4' },
        React.createElement('div', { className: 'bg-blue-100 p-3 rounded-full' }, 
          // Jednoduchá SVG ikona používateľa
          React.createElement(
            'svg',
            { className: 'h-8 w-8 text-blue-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
            React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' })
          )
        ),
        React.createElement(
          'h2',
          { className: 'text-3xl font-bold text-gray-800' },
          'Môj profil'
        )
      ),
      
      // Detaily profilu
      React.createElement(
        'div',
        { className: 'space-y-4' },
        React.createElement(
          'p',
          { className: 'text-gray-800 text-lg' },
          React.createElement('span', { className: 'font-bold' }, 'ID používateľa:'),
          ` ${data.id}`
        ),
        React.createElement(
          'p',
          { className: 'text-gray-800 text-lg' },
          React.createElement('span', { className: 'font-bold' }, 'Rola:'),
          ` ${data.role}`
        ),
        React.createElement(
          'p',
          { className: 'text-gray-800 text-lg' },
          React.createElement('span', { className: 'font-bold' }, 'E-mail:'),
          ` ${data.email}`
        ),
        React.createElement(
          'p',
          { className: 'text-gray-800 text-lg' },
          React.createElement('span', { className: 'font-bold' }, 'Meno:'),
          ` ${data.name}`
        ),
        React.createElement(
          'p',
          { className: 'text-gray-800 text-lg' },
          React.createElement('span', { className: 'font-bold' }, 'Priezvisko:'),
          ` ${data.surname}`
        ),
        React.createElement(
          'p',
          { className: 'text-gray-800 text-lg' },
          React.createElement('span', { className: 'font-bold' }, 'Adresa bydliska:'),
          ` ${data.address}`
        ),
        React.createElement(
          'p',
          { className: 'text-gray-800 text-lg' },
          React.createElement('span', { className: 'font-bold' }, 'Telefón:'),
          ` ${data.phone}`
        ),

        // Fakturačné údaje, ak existujú
        React.createElement(
          'div',
          { className: 'mt-8 p-4 bg-gray-50 rounded-lg' },
          React.createElement(
            'h3',
            { className: 'text-xl font-bold text-gray-700 mb-2' },
            'Fakturačné údaje'
          ),
          React.createElement(
            'p',
            { className: 'text-gray-800 text-lg' },
            React.createElement('span', { className: 'font-bold' }, 'Názov klubu:'),
            ` ${data.clubName}`
          ),
          // Fakturačná adresa sa teraz berie z top-level polí, ale zobrazuje sa v tomto bloku
          billingAddress && React.createElement(
            'p',
            { className: 'text-gray-800 text-lg' },
            React.createElement('span', { className: 'font-bold' }, 'Adresa:'),
            ` ${billingAddress}`
          ),
          data.billing && data.billing.ico && React.createElement(
            'p',
            { className: 'text-gray-800 text-lg' },
            React.createElement('span', { className: 'font-bold' }, 'IČO:'),
            ` ${data.billing.ico}`
          ),
          data.billing && data.billing.dic && React.createElement(
            'p',
            { className: 'text-gray-800 text-lg' },
            React.createElement('span', { className: 'font-bold' }, 'DIČ:'),
            ` ${data.billing.dic}`
          ),
          data.billing && data.billing.icDph && React.createElement(
            'p',
            { className: 'text-gray-800 text-lg' },
            React.createElement('span', { className: 'font-bold' }, 'IČ DPH:'),
            ` ${data.billing.icDph}`
          )
        )
      )
    );
  };

  // Hlavné renderovanie komponentu
  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 py-12 flex flex-col items-center justify-start' },
    React.createElement(
      'main',
      { className: 'container mx-auto px-4' },
      loading && React.createElement(
        'div',
        { className: 'text-center text-xl text-gray-600' },
        'Načítavam dáta...'
      ),
      error && React.createElement(
        'div',
        { className: 'text-center text-xl text-red-600' },
        error
      ),
      userProfileData && renderUserProfile(userProfileData)
    )
  );
}
