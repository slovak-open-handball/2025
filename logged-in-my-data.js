// logged-in-my-data.js
// Tento súbor predpokladá, že Firebase SDK je inicializovaný v <head> logged-in-my-data.html
// a authentication.js spravuje globálnu autentifikáciu a stav používateľa.

// Main React component for the logged-in-my-data.html page
function MyDataApp() {
  // Získame referencie na Firebase služby a globálne dáta z authentication.js
  const auth = window.auth;
  const db = window.db;

  // Lokálny stav pre používateľské dáta
  const [userProfileData, setUserProfileData] = React.useState(null); 
  const [loading, setLoading] = React.useState(true); // Loading stav pre dáta
  const [error, setError] = React.useState('');

  // Zabezpečíme, že appId je definované (používame globálnu premennú)
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'; 

  // Effect pre načítanie používateľských dát z Firestore
  // Tento effect sa spúšťa len raz, po prihlásení používateľa
  React.useEffect(() => {
    let unsubscribeUserDoc;
    
    // Čakáme, kým bude globálna autentifikácia pripravená a používateľ prihlásený
    // Používame setTimeout, aby sme sa uistili, že `window.auth` a `window.db` sú už inicializované z `authentication.js`
    const checkAuthAndFetchData = () => {
        if (window.isGlobalAuthReady && window.auth && window.auth.currentUser) {
            console.log(`MyDataApp: Globálna autentifikácia pripravená. Spúšťam vlastný Firestore listener.`);
            const userId = window.auth.currentUser.uid;
            const userDocRef = doc(window.db, 'users', userId);

            // Nastavíme real-time listener na dáta používateľa
            unsubscribeUserDoc = onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    console.log("MyDataApp: Dáta používateľa z Firestore načítané.");
                    setUserProfileData(docSnap.data());
                    setLoading(false);
                    setError('');
                } else {
                    console.warn("MyDataApp: Profil používateľa nebol nájdený.");
                    setUserProfileData(null);
                    setLoading(false);
                    setError('Profil používateľa nebol nájdený.');
                }
            }, (err) => {
                console.error("MyDataApp: Chyba pri načítaní dát:", err);
                setError('Chyba pri načítaní profilu.');
                setLoading(false);
            });
        } else {
            // Ak ešte nie je prihlásený, opakujeme kontrolu o 100ms neskôr
            if (!window.isGlobalAuthReady) {
                setTimeout(checkAuthAndFetchData, 100);
            } else {
                console.log("MyDataApp: Používateľ nie je prihlásený, nebudeme načítavať dáta.");
                setUserProfileData(null);
                setLoading(false);
            }
        }
    };
    
    // Spustíme prvú kontrolu
    checkAuthAndFetchData();

    // Vrátime funkciu na odhlásenie listeneru
    return () => {
      if (unsubscribeUserDoc) {
        console.log("MyDataApp: Odhlásenie od Firestore listeneru.");
        unsubscribeUserDoc();
      }
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
          React.createElement(
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
