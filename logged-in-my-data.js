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
  React.useEffect(() => {
    let unsubscribeUserDoc;

    // Funkcia na nastavenie listeneru
    const setupListener = () => {
      // Čakáme, kým bude globálna autentifikácia pripravená a používateľ prihlásený
      if (window.isGlobalAuthReady && db && auth && auth.currentUser) {
        console.log(`MyDataApp: Globálna autentifikácia pripravená. Pokúšame sa načítať dáta.`);
        const userId = auth.currentUser.uid;
        const userDocRef = doc(db, 'users', userId);

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
        // Ak ešte nie je prihlásený, nastavíme načítanie na true a dáta na null
        setUserProfileData(null);
        setLoading(true);
      }
    };

    // Priamo zavoláme funkciu na nastavenie listeneru
    setupListener();

    // Vrátime funkciu na odhlásenie listeneru
    return () => {
      if (unsubscribeUserDoc) {
        console.log("MyDataApp: Odhlásenie od Firestore listeneru.");
        unsubscribeUserDoc();
      }
    };

  }, [db, auth]); // Spustí sa, keď sa zmenia db alebo auth inštancie

  // Nový effect, ktorý sa spustí, keď sa zmení globálna premenná globalUserProfileData
  React.useEffect(() => {
    // Sledujeme zmeny v globálnej premennej a aktualizujeme stav komponentu
    if (window.globalUserProfileData) {
        console.log("MyDataApp: Globálne dáta používateľa boli aktualizované.");
        setUserProfileData(window.globalUserProfileData);
        setLoading(false);
    } else {
        // Ak sú dáta null, znamená to, že buď ešte nie sú načítané, alebo používateľ nie je prihlásený.
        // Ponecháme loading, ak je isGlobalAuthReady false, inak ho vypneme.
        if (window.isGlobalAuthReady) {
            setLoading(false);
            setUserProfileData(null);
        } else {
            setLoading(true);
        }
    }
  }, [window.globalUserProfileData, window.isGlobalAuthReady]);


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
