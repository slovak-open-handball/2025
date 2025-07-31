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
            setError('Profil používateľa nebol nájdený alebo nie ste prihlásený.');
          }
      }
    };
    
    // Pridáme listener na udalosť 'globalDataUpdated'
    window.addEventListener('globalDataUpdated', handleDataUpdate);
    
    // Pri inicializácii komponentu skontrolujeme aj aktuálny stav, pre prípad, že dáta boli načítané ešte predtým,
    // ako sa nastavil listener
    if (window.isGlobalAuthReady) {
      handleDataUpdate();
    } else {
      // Ak globálna autentifikácia nie je hotová, nastavíme loading na true
      setLoading(true);
    }

    // Funkcia na vyčistenie, ktorá sa volá, keď sa komponent odmontuje
    return () => {
      window.removeEventListener('globalDataUpdated', handleDataUpdate);
    };

  }, []); // Prázdne pole závislostí zabezpečí, že sa effect spustí len raz

  // Funkcia, ktorá renderuje buď loading obrazovku, error, alebo dáta
  function renderContent() {
    if (loading) {
      return React.createElement(
        'div',
        { className: 'flex justify-center items-center h-full' },
        React.createElement(
          'div',
          { className: 'animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900' }
        )
      );
    }

    if (error) {
      return React.createElement(
        'div',
        { className: 'flex justify-center items-center h-full text-red-500 text-xl' },
        error
      );
    }

    if (!userProfileData) {
        return React.createElement(
            'div',
            { className: 'flex justify-center items-center h-full text-gray-500 text-xl' },
            'Žiadne dáta profilu na zobrazenie.'
        );
    }
    
    // Formátovanie dátumu registrácie
    const registrationDate = userProfileData.registrationDate ? 
      new Date(userProfileData.registrationDate.seconds * 1000).toLocaleDateString() : 'N/A';

    // Renderujeme dáta, ak sú k dispozícii
    return React.createElement(
      'div',
      { className: 'bg-white p-6 md:p-8 rounded-xl shadow-lg w-full max-w-4xl mx-auto' },
      React.createElement(
        'h1',
        { className: 'text-3xl md:text-4xl font-bold text-gray-900 mb-6 border-b-2 pb-4' },
        'Môj Profil'
      ),
      React.createElement(
        'div',
        { className: 'grid md:grid-cols-2 gap-6 md:gap-8' },
        // Osobné údaje
        React.createElement(
          'div',
          { className: 'space-y-4' },
          React.createElement(
            'h2',
            { className: 'text-2xl font-semibold text-gray-800' },
            'Osobné údaje'
          ),
          React.createElement(
            'p',
            { className: 'text-gray-800 text-lg' }, 
            React.createElement('span', { className: 'font-bold' }, 'Meno:'),
            ` ${userProfileData.firstName}`
          ),
          React.createElement(
            'p',
            { className: 'text-gray-800 text-lg' }, 
            React.createElement('span', { className: 'font-bold' }, 'Priezvisko:'),
            ` ${userProfileData.lastName}`
          ),
          React.createElement(
            'p',
            { className: 'text-gray-800 text-lg' }, 
            React.createElement('span', { className: 'font-bold' }, 'E-mail:'),
            ` ${userProfileData.email}`
          ),
          userProfileData.uid && React.createElement(
            'p',
            { className: 'text-gray-800 text-lg' },
            React.createElement('span', { className: 'font-bold' }, 'UID:'),
            ` ${userProfileData.uid}`
          ),
          userProfileData.displayName && React.createElement(
            'p',
            { className: 'text-gray-800 text-lg' }, 
            React.createElement('span', { className: 'font-bold' }, 'Zobrazované meno:'),
            ` ${userProfileData.displayName}`
          )
        ),
        // Adresa
        (userProfileData.street || userProfileData.city || userProfileData.postalCode) && React.createElement(
          'div',
          { className: 'space-y-4' },
          React.createElement(
            'h2',
            { className: 'text-2xl font-semibold text-gray-800' },
            'Adresa'
          ),
          userProfileData.street && React.createElement(
            'p',
            { className: 'text-gray-800 text-lg' },
            React.createElement('span', { className: 'font-bold' }, 'Ulica:'),
            ` ${userProfileData.street}`
          ),
          userProfileData.city && React.createElement(
            'p',
            { className: 'text-gray-800 text-lg' },
            React.createElement('span', { className: 'font-bold' }, 'Mesto:'),
            ` ${userProfileData.city}`
          ),
          userProfileData.postalCode && React.createElement(
            'p',
            { className: 'text-gray-800 text-lg' },
            React.createElement('span', { className: 'font-bold' }, 'PSČ:'),
            ` ${userProfileData.postalCode}`
          )
        ),
        // Kontaktné údaje
        (userProfileData.phone || userProfileData.countryPhoneNumbers) && React.createElement(
            'div',
            { className: 'space-y-4' },
            React.createElement(
                'h2',
                { className: 'text-2xl font-semibold text-gray-800' },
                'Kontaktné údaje'
            ),
            userProfileData.phone && React.createElement(
                'p',
                { className: 'text-gray-800 text-lg' },
                React.createElement('span', { className: 'font-bold' }, 'Telefón:'),
                ` ${userProfileData.phone}`
            ),
            userProfileData.countryPhoneNumbers && Object.keys(userProfileData.countryPhoneNumbers).map(country => (
                React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg', key: country },
                    React.createElement('span', { className: 'font-bold' }, `Telefón (${country.toUpperCase()}):`),
                    ` ${userProfileData.countryPhoneNumbers[country]}`
                )
            ))
        ),
        // Ďalšie údaje
        (userProfileData.clubName || userProfileData.registrationDate) && React.createElement(
            'div',
            { className: 'space-y-4' },
            React.createElement(
                'h2',
                { className: 'text-2xl font-semibold text-gray-800' },
                'Ďalšie údaje'
            ),
            userProfileData.clubName && React.createElement(
                'p',
                { className: 'text-gray-800 text-lg' },
                React.createElement('span', { className: 'font-bold' }, 'Názov klubu:'),
                ` ${userProfileData.clubName}`
            ),
            userProfileData.registrationDate && React.createElement(
                'p',
                { className: 'text-gray-800 text-lg' },
                React.createElement('span', { className: 'font-bold' }, 'Dátum registrácie:'),
                ` ${registrationDate}`
            )
        ),
        // Fakturačné údaje, ak existujú
        userProfileData.billing && React.createElement(
          'div',
          { className: 'space-y-4' },
          React.createElement(
            'h2',
            { className: 'text-2xl font-semibold text-gray-800' },
            'Fakturačné údaje'
          ),
          userProfileData.billing.companyName && React.createElement(
            'p',
            { className: 'text-gray-800 text-lg' },
            React.createElement('span', { className: 'font-bold' }, 'Názov spoločnosti:'),
            ` ${userProfileData.billing.companyName}`
          ),
          userProfileData.billing.street && React.createElement(
            'p',
            { className: 'text-gray-800 text-lg' },
            React.createElement('span', { className: 'font-bold' }, 'Ulica:'),
            ` ${userProfileData.billing.street}`
          ),
          userProfileData.billing.city && React.createElement(
            'p',
            { className: 'text-gray-800 text-lg' },
            React.createElement('span', { className: 'font-bold' }, 'Mesto:'),
            ` ${userProfileData.billing.city}`
          ),
          userProfileData.billing.zipCode && React.createElement(
            'p',
            { className: 'text-gray-800 text-lg' },
            React.createElement('span', { className: 'font-bold' }, 'PSČ:'),
            ` ${userProfileData.billing.zipCode}`
          ),
          userProfileData.billing.country && React.createElement(
            'p',
            { className: 'text-gray-800 text-lg' },
            React.createElement('span', { className: 'font-bold' }, 'Krajina:'),
            ` ${userProfileData.billing.country}`
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
      )
    );
  }

  // Hlavné renderovanie komponentu
  return React.createElement(
    'div',
    { className: 'flex-1 p-4 md:p-8' },
    renderContent()
  );
}

// Explicitne sprístupniť komponent globálne
window.MyDataApp = MyDataApp;
