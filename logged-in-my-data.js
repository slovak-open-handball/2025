// logged-in-my-data.js
// Tento súbor predpokladá, že Firebase SDK je inicializovaný v <head> logged-in-my-data.html
// a authentication.js spravuje globálnu autentifikáciu a stav používateľa.

// Importy pre prácu s Firebase
import { getAuth, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, collection, addDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Main React component for the logged-in-my-data.html page
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
  const userId = auth?.currentUser?.uid || 'anonymous';
  
  // Efekt pre načítanie používateľských dát z Firestore
  // Tento efekt sa spustí, až keď je globálna autentifikácia pripravená.
  React.useEffect(() => {
    let unsubscribeUserDoc;

    // Čakáme, kým bude globálna autentifikácia pripravená a používateľ prihlásený
    if (window.isGlobalAuthReady && db && auth && auth.currentUser) {
      console.log(`MyDataApp: Globálna autentifikácia pripravená. Pokúšam sa načítať používateľský dokument pre UID: ${auth.currentUser.uid}`);
      setLoading(true); // Nastavíme loading na true, kým sa načítajú dáta profilu

      try {
        // Používame priamo globálnu referenciu na Firestore a autentifikáciu
        const userDocRef = doc(db, 'artifacts', appId, 'users', auth.currentUser.uid);
        
        unsubscribeUserDoc = onSnapshot(userDocRef, docSnapshot => {
          if (docSnapshot.exists()) {
            const userData = docSnapshot.data();
            console.log("MyDataApp: Používateľský dokument existuje, dáta:", userData);

            // Aktualizácia emailu vo Firestore, ak sa nezhoduje s Auth emailom
            if (auth.currentUser && auth.currentUser.email && userData.email !== auth.currentUser.email) {
              console.log(`MyDataApp: Detekovaný nesúlad emailov. Firestore: ${userData.email}, Auth: ${auth.currentUser.email}. Aktualizujem Firestore.`);
              updateDoc(userDocRef, { email: auth.currentUser.email })
                .then(async () => {
                  console.log("MyDataApp: Email vo Firestore úspešne aktualizovaný na základe Auth emailu.");
                  // Použijeme globálnu notifikáciu
                  if (typeof window.showGlobalNotification === 'function') {
                    window.showGlobalNotification("E-mailová adresa bola úspešne aktualizovaná!");
                  }
                })
                .catch(err => {
                  console.error("MyDataApp: Chyba pri aktualizácii emailu vo Firestore:", err);
                  if (typeof window.showGlobalNotification === 'function') {
                    window.showGlobalNotification("Chyba pri aktualizácii e-mailu. Skúste to prosím neskôr.", "error");
                  }
                });
            }

            setUserProfileData(userData);
            setError('');
          } else {
            console.log("MyDataApp: Používateľský dokument neexistuje. Vytvorím ho.");
            const defaultUserData = { email: auth.currentUser.email, createdAt: new Date() };
            setDoc(userDocRef, defaultUserData)
              .then(() => {
                console.log("MyDataApp: Vytvorený nový dokument používateľa.");
                setUserProfileData(defaultUserData);
                setError('');
              })
              .catch(err => {
                console.error("MyDataApp: Chyba pri vytváraní dokumentu používateľa:", err);
                setError('Chyba pri načítaní alebo vytváraní profilu používateľa.');
              });
          }
          setLoading(false);
        }, (error) => {
          console.error("MyDataApp: Chyba pri načítaní dokumentu používateľa:", error);
          setError('Chyba pri načítaní profilu používateľa.');
          setLoading(false);
        });

      } catch (e) {
        console.error("MyDataApp: Všeobecná chyba pri pokuse o načítanie dokumentu:", e);
        setError('Došlo k chybe pri načítavaní dát. Skúste to prosím neskôr.');
        setLoading(false);
      }
    } else if (window.isGlobalAuthReady && !auth.currentUser) {
        // Ak je auth pripravená ale používateľ nie je prihlásený
        setLoading(false);
        setError('Pre zobrazenie tejto stránky musíte byť prihlásený.');
    }

    return () => {
      if (unsubscribeUserDoc) {
        unsubscribeUserDoc();
      }
    };
  }, [window.isGlobalAuthReady]); // Spustí sa, keď sa zmení stav globálnej autentifikácie

  // Zobrazí loading stav
  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Zobrazí chybu, ak nejaká nastala
  if (error) {
    return (
      <div className="flex justify-center items-center h-full">
        <p className="text-red-500 text-lg">{error}</p>
      </div>
    );
  }

  // Zobrazí obsah stránky
  return React.createElement(
    'div',
    { className: 'flex flex-col md:flex-row min-h-screen bg-gray-100' },
    React.createElement(
        'div',
        { className: 'flex-1 p-8 md:ml-64 mt-8 md:mt-0' }, // Margin pre ľavé menu
        React.createElement(
          'div',
          { className: 'bg-white p-6 rounded-xl shadow-lg' },
          React.createElement(
            'h2',
            { className: 'text-3xl font-bold text-gray-900 mb-6 border-b-2 border-blue-500 pb-2' },
            'Moje Údaje'
          ),
          userProfileData && React.createElement(
            'div',
            { className: 'space-y-6' },
            React.createElement(
              'div',
              { className: 'bg-blue-50 p-4 rounded-lg' },
              React.createElement(
                'h3',
                { className: 'text-xl font-semibold text-blue-800 mb-2' },
                'Osobné informácie'
              ),
              React.createElement(
                'div',
                { className: 'space-y-2' },
                React.createElement(
                  'p',
                  { className: 'text-gray-800 text-lg' },
                  React.createElement('span', { className: 'font-bold' }, 'ID používateľa:'),
                  ` ${userId}`
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg' },
                    React.createElement('span', { className: 'font-bold' }, 'Meno:'),
                    ` ${userProfileData.name || 'Nezadané'}`
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg' },
                    React.createElement('span', { className: 'font-bold' }, 'Priezvisko:'),
                    ` ${userProfileData.surname || 'Nezadané'}`
                ),
                React.createElement(
                  'p',
                  { className: 'text-gray-800 text-lg' },
                  React.createElement('span', { className: 'font-bold' }, 'Email:'),
                  ` ${userProfileData.email || 'Nezadané'}`
                ),
                userProfileData.phoneNumber && React.createElement(
                  'p',
                  { className: 'text-gray-800 text-lg' },
                  React.createElement('span', { className: 'font-bold' }, 'Telefónne číslo:'),
                  ` ${userProfileData.phoneNumber}`
                )
              )
            ),
            userProfileData.billing && React.createElement(
              'div',
              { className: 'bg-green-50 p-4 rounded-lg' },
              React.createElement(
                'h3',
                { className: 'text-xl font-semibold text-green-800 mb-2' },
                'Fakturačné údaje'
              ),
              React.createElement(
                'div',
                { className: 'space-y-2' },
                React.createElement(
                  'p',
                  { className: 'text-gray-800 text-lg' },
                  React.createElement('span', { className: 'font-bold' }, 'Adresa:'),
                  ` ${userProfileData.billing.address || 'Nezadané'}`
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
          )
        )
    )
  );
}

// Explicitne sprístupniť komponent globálne
window.MyDataApp = MyDataApp;

// Ak je definovaný, inicializovať aplikáciu
if (typeof __initial_auth_token !== 'undefined' && typeof __firebase_config !== 'undefined' && typeof window.MyDataApp !== 'undefined') {
    const firebaseConfig = JSON.parse(__firebase_config);
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);

    // Nastavenie globálnych premenných pre autentifikáciu
    window.auth = auth;
    window.db = db;

    // Prihlásiť sa pomocou custom tokenu alebo anonymne
    const handleAuth = async () => {
        try {
            if (typeof __initial_auth_token !== 'undefined') {
                await signInWithCustomToken(auth, __initial_auth_token);
            } else {
                await signInAnonymously(auth);
            }
            window.isGlobalAuthReady = true;
            console.log("Autentifikácia pre MyDataApp úspešná.");
        } catch (error) {
            console.error("Chyba pri autentifikácii pre MyDataApp:", error);
            window.isGlobalAuthReady = true; // Stále označíme ako pripravené, ale používateľ bude odhlásený
        }
    };

    // Spustiť autentifikáciu a potom renderovať React aplikáciu
    window.onload = async () => {
        await handleAuth();
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(React.createElement(MyDataApp));
        console.log("React App MyDataApp vykreslená.");
    };
}
