// logged-in-my-data.js
// Tento súbor spravuje dynamické zobrazenie používateľských dát po prihlásení.

// Pre React potrebujeme definovať hlavný komponent.
function MyDataApp() {
  // Lokálny stav pre používateľské dáta, ktorý sa bude synchronizovať s globálnou premennou.
  const [userProfileData, setUserProfileData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  // Zabezpečíme, že appId je definované (používame globálnu premennú).
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

  // Efekt pre synchronizáciu dát. Tento kód sa spustí po prvom vykreslení a
  // vždy, keď sa zmení stav globálnej autentifikácie alebo globálne dáta profilu.
  React.useEffect(() => {
    // Ak už máme globálne dáta profilu, môžeme ich použiť okamžite.
    if (window.globalUserProfileData) {
      console.log("MyDataApp: Používam už načítané globálne dáta profilu.");
      setUserProfileData(window.globalUserProfileData);
      setLoading(false);
      return;
    }

    // Ak nie sú globálne dáta k dispozícii, ale autentifikácia je pripravená
    if (window.isGlobalAuthReady) {
      const auth = window.auth;
      const db = window.db;

      // Ak je používateľ prihlásený, nastavíme listener na globálne dáta
      if (auth.currentUser) {
        console.log("MyDataApp: Používateľ je prihlásený. Čakám na načítanie globálnych dát.");

        // Funkcia, ktorá sa spustí, keď sa zmenia globálne dáta profilu
        const handleProfileDataChange = () => {
          if (window.globalUserProfileData) {
            console.log("MyDataApp: Zistená zmena v globálnych dátach. Aktualizujem stav.");
            setUserProfileData(window.globalUserProfileData);
            setLoading(false);
          } else {
            // Ak sa dáta odstránia (napríklad pri odhlásení), resetujeme stav
            setUserProfileData(null);
            setLoading(true); // Znova začneme načítavať, ak sa dáta stratia
          }
        };

        // Vytvoríme proxy, ktorý bude sledovať zmeny na globalUserProfileData
        const originalSetter = Object.getOwnPropertyDescriptor(window, 'globalUserProfileData').set;
        Object.defineProperty(window, 'globalUserProfileData', {
          set: function(value) {
            originalSetter.call(this, value);
            handleProfileDataChange();
          },
          get: function() {
            return this._globalUserProfileData;
          }
        });
        
        // Funkcia na vyčistenie proxy pri odmontovaní komponentu
        return () => {
           // Resetovať na pôvodný setter
           Object.defineProperty(window, 'globalUserProfileData', {
            set: originalSetter,
            get: function() {
              return this._globalUserProfileData;
            }
          });
        }

      } else {
        console.warn("MyDataApp: Používateľ nie je prihlásený, presmerovanie.");
        setError('Nie ste prihlásený. Prosím, prihláste sa.');
        setLoading(false);
        // Môžete pridať presmerovanie, ak je potrebné
        // window.location.href = 'index.html';
      }
    } else {
      // Stále čakáme, ak autentifikácia ešte nie je pripravená
      console.log("MyDataApp: Čakám na pripravenosť globálnej autentifikácie...");
      setLoading(true);
    }

  }, [window.isGlobalAuthReady]); // Spustí sa, keď sa zmení stav pripravenosti autentifikácie

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
