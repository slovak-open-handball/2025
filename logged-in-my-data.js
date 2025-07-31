// logged-in-my-data.js
// Tento súbor predpokladá, že Firebase SDK je inicializovaný v <head> logged-in-my-data.html
// a authentication.js spravuje globálnu autentifikáciu a stav používateľa.

// Hlavný React komponent pre stránku logged-in-my-data.html
function MyDataApp() {
  // Získame referencie na Firebase služby a globálne dáta z authentication.js
  const auth = window.auth;
  const db = window.db;

  // Lokálny stav pre používateľské dáta, ktoré sa načítavajú po globálnej autentifikácii
  const [userProfileData, setUserProfileData] = React.useState(null); 
  const [loading, setLoading] = React.useState(true); // Loading pre dáta v MyDataApp
  const [error, setError] = React.useState('');

  // Zabezpečíme, že appId je definované (používame globálnu premennú)
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'; 

  // Effect pre načítanie používateľských dát z Firestore
  // Tento efekt sa spustí, až keď je globálna autentifikácia pripravená.
  React.useEffect(() => {
    let unsubscribeUserDoc;

    // Čakáme, kým bude globálna autentifikácia pripravená a používateľ prihlásený
    // Pridávame kontrolu existencie db a auth
    if (window.isGlobalAuthReady && db && auth && auth.currentUser) {
      console.log(`MyDataApp: Globálna autentifikácia pripravená. Pokúšam sa načítať dáta používateľa.`);
      
      // Opravená cesta k dokumentu profilu, aby sedela s Firebase pravidlami
      const userDocRef = doc(db, 'users', auth.currentUser.uid);

      unsubscribeUserDoc = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const profileData = docSnap.data();
          setUserProfileData(profileData);
          console.log("MyDataApp: Dáta profilu používateľa načítané.", profileData);
        } else {
          console.log("MyDataApp: Dokument používateľa neexistuje.");
          setError('Profil používateľa nebol nájdený.');
        }
        setLoading(false);
      }, (err) => {
        console.error("MyDataApp: Chyba pri načítaní dát používateľa:", err);
        setError('Chyba pri načítaní dát profilu.');
        setLoading(false);
      });
    } else if (window.isGlobalAuthReady && !auth.currentUser) {
      // Ak je autentifikácia pripravená, ale používateľ nie je prihlásený,
      // presmerujeme ho na index, čo je spravované v authentication.js,
      // ale tu to môžeme pre istotu zachytiť tiež.
      setLoading(false);
      setError('Nie ste prihlásený. Presmerovanie...');
    }

    // Cleanup funkcia pre onSnapshot listener
    return () => {
      if (unsubscribeUserDoc) {
        unsubscribeUserDoc();
      }
    };
  }, [window.isGlobalAuthReady, db, auth]); // Dôležité: Spustiť znova, keď sa zmenia tieto hodnoty

  // Funkcia na zobrazenie a skrytie detailov fakturácie
  const toggleBillingDetails = () => {
    const billingDetails = document.getElementById('billing-details');
    if (billingDetails) {
      billingDetails.classList.toggle('hidden');
    }
  };

  if (loading) {
    return React.createElement('div', { className: 'flex justify-center items-center h-full' }, 
      React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500' })
    );
  }

  if (error) {
    return React.createElement('div', { className: 'text-center text-red-500 font-bold p-8' }, error);
  }

  if (!userProfileData) {
    return React.createElement('div', { className: 'text-center text-gray-500 p-8' }, 'Žiadne dáta na zobrazenie.');
  }

  return (
    React.createElement('div', { className: 'p-4 md:p-8 space-y-8 max-w-4xl mx-auto' },
      React.createElement('div', { className: 'bg-white rounded-lg shadow-xl p-6 md:p-8' },
        React.createElement('h2', { className: 'text-3xl font-bold text-blue-800 mb-6 border-b-2 border-blue-200 pb-2' }, 'Môj profil'),
        React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-6' },
          React.createElement('div', { className: 'space-y-2' },
            React.createElement('p', { className: 'text-gray-800 text-lg' }, React.createElement('span', { className: 'font-bold' }, 'Meno:'), ` ${userProfileData.firstName}`),
            React.createElement('p', { className: 'text-gray-800 text-lg' }, React.createElement('span', { className: 'font-bold' }, 'Priezvisko:'), ` ${userProfileData.lastName}`),
            React.createElement('p', { className: 'text-gray-800 text-lg' }, React.createElement('span', { className: 'font-bold' }, 'Email:'), ` ${userProfileData.email}`)
          ),
          React.createElement('div', { className: 'space-y-2' },
            React.createElement('p', { className: 'text-gray-800 text-lg' }, React.createElement('span', { className: 'font-bold' }, 'Telefón:'), ` ${userProfileData.contactPhoneNumber || 'Nezadané'}`),
            React.createElement('p', { className: 'text-gray-800 text-lg' }, React.createElement('span', { className: 'font-bold' }, 'Rola:'), ` ${userProfileData.role}`)
          )
        ),
        React.createElement('div', { className: 'mt-8 pt-6 border-t-2 border-blue-200' },
          React.createElement('button', {
            onClick: toggleBillingDetails,
            className: 'bg-blue-600 text-white font-bold py-2 px-4 rounded-lg shadow hover:bg-blue-700 transition duration-300 ease-in-out'
          }, 'Fakturačné údaje'),
          React.createElement('div', { id: 'billing-details', className: 'hidden mt-4 p-6 bg-blue-50 rounded-lg border border-blue-200' },
            !userProfileData.billing || Object.keys(userProfileData.billing).length === 0 ? (
              React.createElement('p', { className: 'text-gray-600' }, 'Žiadne fakturačné údaje neboli zadané.')
            ) : (
              React.createElement(React.Fragment, null,
                React.createElement('div', null,
                  React.createElement('p', { className: 'text-gray-800 text-lg whitespace-nowrap' }, React.createElement('span', { className: 'font-bold' }, 'Spoločnosť:'), ` ${userProfileData.billing.companyName}`)
                ),
                React.createElement('div', null,
                  React.createElement('p', { className: 'text-gray-800 text-lg whitespace-nowrap' }, React.createElement('span', { className: 'font-bold' }, 'Ulica:'), ` ${userProfileData.billing.street}`)
                ),
                React.createElement('div', null,
                  React.createElement('p', { className: 'text-gray-800 text-lg whitespace-nowrap' }, React.createElement('span', { className: 'font-bold' }, 'Mesto:'), ` ${userProfileData.billing.city}`)
                ),
                React.createElement('div', null,
                  React.createElement('p', { className: 'text-gray-800 text-lg whitespace-nowrap' }, React.createElement('span', { className: 'font-bold' }, 'PSČ:'), ` ${userProfileData.billing.postalCode}`)
                ),
                React.createElement('div', null,
                  React.createElement('p', { className: 'text-gray-800 text-lg whitespace-nowrap' }, React.createElement('span', { className: 'font-bold' }, 'Krajina:'), ` ${userProfileData.billing.country}`)
                ),
                userProfileData.billing.ico && React.createElement('div', null,
                  React.createElement('p', { className: 'text-gray-800 text-lg whitespace-nowrap' }, React.createElement('span', { className: 'font-bold' }, 'IČO:'), ` ${userProfileData.billing.ico}`)
                ),
                userProfileData.billing.dic && React.createElement('div', null,
                  React.createElement('p', { className: 'text-gray-800 text-lg whitespace-nowrap' }, React.createElement('span', { className: 'font-bold' }, 'DIČ:'), ` ${userProfileData.billing.dic}`)
                ),
                userProfileData.billing.icDph && React.createElement('div', null,
                  React.createElement('p', { className: 'text-gray-800 text-lg whitespace-nowrap' }, React.createElement('span', { className: 'font-bold' }, 'IČ DPH:'), ` ${userProfileData.billing.icDph}`)
                )
              )
            )
          )
        )
      )
    )
  );
}

// Explicitne sprístupniť komponent globálne
window.MyDataApp = MyDataApp;
