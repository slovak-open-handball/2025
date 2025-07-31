// logged-in-my-data.js
// Tento súbor spravuje dynamické zobrazenie používateľských dát po prihlásení.

// Pre React potrebujeme definovať hlavný komponent.
function MyDataApp() {
  // Lokálne stavy pre dáta používateľa, stav načítavania a chyby.
  const [userProfileData, setUserProfileData] = React.useState(null); 
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  // Zabezpečíme, že appId je definované (používame globálnu premennú).
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

  // Efekt pre načítanie používateľských dát z Firestore.
  // Tento efekt sa spustí, až keď je globálna autentifikácia pripravená
  // a je zistený prihlásený používateľ.
  React.useEffect(() => {
    let unsubscribeUserDoc;

    // Počkáme, kým bude globálna autentifikácia pripravená a používateľ prihlásený
    // Akonáhle je pripravená, spustíme logiku načítania.
    if (window.isGlobalAuthReady) {
        const auth = window.auth;
        const db = window.db;

        if (auth.currentUser) {
            console.log(`MyDataApp: Používateľ je prihlásený (${auth.currentUser.uid}). Načítavam profil...`);
            const userId = auth.currentUser.uid;
            
            // Cesta k dokumentu v Firestore
            const userDocPath = `/artifacts/${appId}/users/${userId}/profile/data`;
            const userDocRef = window.doc(db, userDocPath);

            // Nastavíme listener na zmeny v dokumente
            unsubscribeUserDoc = window.onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    console.log("MyDataApp: Dáta profilu boli úspešne načítané:", data);
                    setUserProfileData(data);
                } else {
                    console.warn("MyDataApp: Dokument s používateľskými dátami neexistuje. Vytváram prázdny dokument.");
                    // Ak dokument neexistuje, vytvoríme ho s prázdnymi hodnotami
                    window.setDoc(userDocRef, {
                        email: auth.currentUser.email,
                        firstName: '',
                        lastName: '',
                        billing: {
                            companyName: '',
                            ico: '',
                            dic: '',
                            icDph: ''
                        }
                    }).then(() => {
                        console.log("MyDataApp: Prázdny dokument bol vytvorený.");
                    }).catch(err => {
                        console.error("MyDataApp: Chyba pri vytváraní dokumentu:", err);
                        setError('Chyba pri vytváraní profilu používateľa.');
                    });
                }
                setLoading(false);
            }, (error) => {
                console.error("MyDataApp: Chyba pri načítaní profilu používateľa:", error);
                setError('Chyba pri načítaní profilu. Skúste to prosím znova.');
                setLoading(false);
            });
        } else {
            // Ak nie je prihlásený, nastavíme stav ako nenačítaný a chybový.
            console.error("MyDataApp: Používateľ nie je prihlásený, nemôžem načítať profil.");
            setError('Nie ste prihlásený. Prosím, prihláste sa.');
            setLoading(false);
        }
    } else {
        // Ak ešte nie je globálna autentifikácia pripravená, skúsime to znova neskôr.
        console.log("MyDataApp: Čakám na pripravenosť globálnej autentifikácie...");
    }

    // Funkcia pre odhlásenie listenera
    return () => {
        if (unsubscribeUserDoc) {
            console.log("MyDataApp: Odhlasujem listener z Firestore.");
            unsubscribeUserDoc();
        }
    };
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
                ` ${window.auth.currentUser.uid}`
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
