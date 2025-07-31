// logged-in-my-data.js
// Tento súbor spravuje dynamické zobrazenie používateľských dát po prihlásení.

// Pre React potrebujeme definovať hlavný komponent.
function MyDataApp() {
  const [userProfileData, setUserProfileData] = React.useState(null);
  const [loading, setLoading] = React.useState(true); // Začíname v stave načítavania
  const [error, setError] = React.useState('');

  // Efekt na nastavenie poslucháča udalostí po prvom vykreslení
  React.useEffect(() => {
    const handleProfileDataLoaded = () => {
      console.log("MyDataApp: Udalosť 'profileDataLoaded' bola prijatá.");
      const data = window.globalUserProfileData;
      if (data) {
        setUserProfileData(data);
        setLoading(false);
      } else {
        setError('Chyba: Dáta profilu neboli k dispozícii.');
        setLoading(false);
      }
    };

    // Pridá poslucháč na globálnu udalosť
    window.addEventListener('profileDataLoaded', handleProfileDataLoaded);

    // Ak už sú dáta profilu k dispozícii v čase renderovania (napríklad pri horúcej výmene modulov), použijeme ich.
    if (window.globalUserProfileData) {
        handleProfileDataLoaded();
    }

    // Funkcia na vyčistenie poslucháča
    return () => {
      window.removeEventListener('profileDataLoaded', handleProfileDataLoaded);
    };
  }, []); // Prázdne pole závislostí zabezpečí, že sa spustí len raz

  // Zobrazenie načítavania
  if (loading) {
    return React.createElement(
      'div',
      { className: 'flex justify-center items-center h-full' },
      React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500' })
    );
  }

  // Zobrazenie chyby
  if (error) {
    return React.createElement(
      'div',
      { className: 'text-center text-red-500 p-8' },
      React.createElement('p', { className: 'text-xl font-semibold' }, error)
    );
  }

  // Zobrazenie dát, ak existujú
  if (!userProfileData) {
    return React.createElement(
        'div',
        { className: 'text-center text-gray-500 p-8' },
        React.createElement('p', { className: 'text-xl font-semibold' }, 'Žiadne údaje profilu neboli nájdené.')
      );
  }

  // Ak sú dáta načítané, vykreslíme profil
  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8' },
    React.createElement(
      'div',
      { className: 'max-w-4xl mx-auto' },
      React.createElement(
        'div',
        { className: 'bg-white shadow-xl rounded-2xl p-6 sm:p-8 lg:p-10' },
        React.createElement(
          'h1',
          { className: 'text-3xl sm:text-4xl font-bold text-blue-800 mb-6 sm:mb-8 text-center' },
          'Moja zóna'
        ),
        React.createElement(
          'div',
          { className: 'grid grid-cols-1 md:grid-cols-2 gap-8' },
          // Osobné údaje
          React.createElement(
            'div',
            { className: 'bg-gray-50 rounded-xl p-6 shadow-inner' },
            React.createElement(
              'h2',
              { className: 'text-2xl font-semibold text-blue-700 mb-4 border-b-2 border-blue-200 pb-2' },
              'Osobné údaje'
            ),
            React.createElement(
              'div',
              { className: 'space-y-4' },
              React.createElement(
                'p',
                { className: 'text-gray-800 text-lg whitespace-nowrap' },
                React.createElement('span', { className: 'font-bold' }, 'ID používateľa:'),
                ` ${userProfileData.uid}`
              ),
              React.createElement(
                'p',
                { className: 'text-gray-800 text-lg whitespace-nowrap' },
                React.createElement('span', { className: 'font-bold' }, 'Email:'),
                ` ${userProfileData.email}`
              ),
              React.createElement(
                'p',
                { className: 'text-gray-800 text-lg whitespace-nowrap' },
                React.createElement('span', { className: 'font-bold' }, 'Meno:'),
                ` ${userProfileData.firstName}`
              ),
              React.createElement(
                'p',
                { className: 'text-gray-800 text-lg whitespace-nowrap' },
                React.createElement('span', { className: 'font-bold' }, 'Priezvisko:'),
                ` ${userProfileData.lastName}`
              )
            )
          ),
          // Fakturačné údaje
          React.createElement(
            'div',
            { className: 'bg-gray-50 rounded-xl p-6 shadow-inner' },
            React.createElement(
              'h2',
              { className: 'text-2xl font-semibold text-blue-700 mb-4 border-b-2 border-blue-200 pb-2' },
              'Fakturačné údaje'
            ),
            React.createElement(
              'div',
              { className: 'space-y-4' },
              userProfileData.billing.companyName && React.createElement(
                'div',
                null,
                React.createElement(
                  'p',
                  { className: 'text-gray-800 text-lg whitespace-nowrap' },
                  React.createElement('span', { className: 'font-bold' }, 'Názov spoločnosti:'),
                  ` ${userProfileData.billing.companyName}`
                )
              ),
              userProfileData.billing.ico && React.createElement(
                'div',
                null,
                React.createElement(
                  'p',
                  { className: 'text-gray-800 text-lg whitespace-nowrap' },
                  React.createElement('span', { className: 'font-bold' }, 'IČO:'),
                  ` ${userProfileData.billing.ico}`
                )
              ),
              userProfileData.billing.dic && React.createElement(
                'div',
                null,
                React.createElement(
                  'p',
                  { className: 'text-gray-800 text-lg whitespace-nowrap' },
                  React.createElement('span', { className: 'font-bold' }, 'DIČ:'),
                  ` ${userProfileData.billing.dic}`
                )
              ),
              userProfileData.billing.icDph && React.createElement(
                'div',
                null,
                React.createElement(
                  'p',
                  { className: 'text-gray-800 text-lg whitespace-nowrap' },
                  React.createElement('span', { className: 'font-bold' }, 'IČ DPH:'),
                  ` ${userProfileData.billing.icDph}`
                )
              )
            )
          )
        )
      )
    )
  );
}

// Exportujeme komponent pre globálne použitie
window.MyDataApp = MyDataApp;
