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

  // Funkcia, ktorá formátuje telefónne číslo
  const formatPhoneNumber = (number) => {
      if (!number) return '';
      // Odstránime všetky medzery, pomlčky, zátvorky a iné nečíselné znaky okrem '+'
      const cleanNumber = number.replace(/[^\d+]/g, '');

      // Skontrolujeme, či číslo začína predvoľbou "+421"
      const countryCodeMatch = cleanNumber.match(/^(\+421)(\d+)/);
      if (countryCodeMatch) {
          const countryCode = countryCodeMatch[1];
          const restOfNumber = countryCodeMatch[2];
          // Rozdelíme zvyšok čísla na skupiny po troch
          const formattedRest = restOfNumber.replace(/(\d{3})(?=\d)/g, '$1 ');
          return `${countryCode} ${formattedRest}`;
      }

      // Ak číslo nezačína predvoľbou "+421", rozdelíme ho na skupiny po troch
      return cleanNumber.replace(/(\d{3})(?=\d)/g, '$1 ');
  };

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
    
    // Formátovanie dátumu registrácie na zobrazenie dátumu a času
    let registrationDateAndTime = 'N/A';
    if (userProfileData.registrationDate) {
        const dateObject = new Date(userProfileData.registrationDate.seconds * 1000);
        const formattedDate = dateObject.toLocaleDateString();
        const formattedTime = dateObject.toLocaleTimeString();
        registrationDateAndTime = `${formattedDate}, ${formattedTime}`;
    }

    // Funkcia na formátovanie PSČ
    const formatPostalCode = (code) => {
        if (code && code.length === 5) {
            return `${code.substring(0, 3)} ${code.substring(3)}`;
        }
        return code || '';
    };

    // Funkcia na spojenie adresy do jedného riadku z top-level polí
    const formatAddress = (street, houseNumber, city, postalCode, country) => {
        const streetParts = [];
        if (street) streetParts.push(street);
        if (houseNumber) streetParts.push(houseNumber);
        const streetAndNumber = streetParts.join(' ');

        const cityParts = [];
        if (postalCode) cityParts.push(formatPostalCode(postalCode));
        if (city) cityParts.push(city);
        const cityAndPostalCode = cityParts.join(' ');

        const finalAddressParts = [];
        if (streetAndNumber) finalAddressParts.push(streetAndNumber);
        if (cityAndPostalCode) finalAddressParts.push(cityAndPostalCode);
        if (country) finalAddressParts.push(country);

        return finalAddressParts.join(', ');
    };

    // Vytvorenie adresného reťazca z top-level polí
    const billingAddress = formatAddress(
      userProfileData.street,
      userProfileData.houseNumber,
      userProfileData.city,
      userProfileData.postalCode,
      userProfileData.country
    );
    
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
        // Rozloženie v jednom stĺpci s menšou medzerou medzi sekciami
        { className: 'space-y-6 md:space-y-8' },
        // Kontaktné údaje
        (userProfileData.firstName || userProfileData.lastName || userProfileData.email || userProfileData.contactPhoneNumber || userProfileData.registrationDate) && React.createElement(
            'div',
            // Menšia medzera medzi položkami v tejto sekcii
            { className: 'space-y-2' },
            React.createElement(
                'h2',
                { className: 'text-2xl font-semibold text-gray-800' },
                'Kontaktné údaje'
            ),
            (userProfileData.firstName || userProfileData.lastName) && React.createElement(
                'p',
                { className: 'text-gray-800 text-lg' },
                React.createElement('span', { className: 'font-bold' }, 'Meno a priezvisko:'),
                ` ${userProfileData.firstName || ''} ${userProfileData.lastName || ''}`
            ),
            userProfileData.email && React.createElement(
                'p',
                { className: 'text-gray-800 text-lg' },
                React.createElement('span', { className: 'font-bold' }, 'E-mailová adresa:'),
                ` ${userProfileData.email}`
            ),
            userProfileData.contactPhoneNumber && React.createElement(
                'p',
                { className: 'text-gray-800 text-lg' },
                React.createElement('span', { className: 'font-bold' }, 'Telefónne číslo:'),
                ` ${formatPhoneNumber(userProfileData.contactPhoneNumber)}`
            ),
            // Dátum a čas registrácie
            userProfileData.registrationDate && React.createElement(
              'p',
              { className: 'text-gray-800 text-lg' },
              React.createElement('span', { className: 'font-bold' }, 'Dátum a čas registrácie:'),
              ` ${registrationDateAndTime}`
            )
        ),
        // Fakturačné údaje
        (userProfileData.billing || billingAddress) && React.createElement(
          'div',
          // Menšia medzera medzi položkami v tejto sekcii
          { className: 'space-y-2' },
          React.createElement(
            'h2',
            { className: 'text-2xl font-semibold text-gray-800' },
            'Fakturačné údaje'
          ),
          // Zobrazenie názvu klubu na prvom mieste
          userProfileData.billing && userProfileData.billing.clubName && React.createElement(
            'p',
            { className: 'text-gray-800 text-lg' },
            React.createElement('span', { className: 'font-bold' }, 'Názov klubu:'),
            ` ${userProfileData.billing.clubName}`
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

  // Hlavné renderovanie komponentu
  return React.createElement(
    'div',
    { className: 'flex-1 p-4 md:p-8' },
    renderContent()
  );
}

// Explicitne sprístupniť komponent globálne
window.MyDataApp = MyDataApp;
