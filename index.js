// Global application ID and Firebase configuration (should be consistent across all React apps)
const appId = '1:26454452024:web:6954b4f90f87a3a1eb43cd';
const firebaseConfig = {
  apiKey: "AIzaSyDj_bSTkjrquu1nyIVYW7YLbyBl1pD6YYo",
  authDomain: "prihlasovanie-4f3f3.firebaseapp.com",
  projectId: "prihlasovanie-4f3f3",
  storageBucket: "prihlasovanie-4f3f3.firebasestorage.app",
  messagingSenderId: "26454452024",
  appId: "1:26454452024:web:6954b4f90f87a3a1eb43cd"
};
const initialAuthToken = null; // Global authentication token

// Helper function to format a Date object into 'YYYY-MM-DDTHH:mm' local string
const formatToDatetimeLocal = (date) => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// Helper function to parse 'YYYY-MM-DDTHH:mm' local string into a Date object
const parseDatetimeLocal = (datetimeLocalString) => {
  if (!datetimeLocalString) return null;
  const [datePart, timePart] = datetimeLocalString.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);
  // Používame UTC pre konzistentnosť a potom prispôsobíme lokálnemu času
  const date = new Date(Date.UTC(year, month - 1, day, hours, minutes));
  return date;
};

// Inicializácia Firebase
let app;
let db;
let auth;
let userId = null; // Pre uloženie ID používateľa

try {
  app = firebase.initializeApp(firebaseConfig);
  auth = firebase.auth(app);
  db = firebase.firestore(app);
  console.log("index.js: Predvolená Firebase aplikácia inicializovaná.");

  // Prihlásenie používateľa
  if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
    auth.signInWithCustomToken(__initial_auth_token)
      .then((userCredential) => {
        userId = userCredential.user.uid;
        console.log("index.js: Používateľ prihlásený pomocou custom tokenu:", userId);
        // Po prihlásení inicializujte hlavičku
        if (typeof loadHeaderAndInitializeLogic === 'function') {
            loadHeaderAndInitializeLogic();
        }
      })
      .catch((error) => {
        console.error("index.js: Chyba pri prihlásení pomocou custom tokenu:", error);
        // Ak zlyhá custom token, skúste anonymné prihlásenie
        auth.signInAnonymously()
          .then((userCredential) => {
            userId = userCredential.user.uid;
            console.log("index.js: Používateľ prihlásený anonymne:", userId);
            // Po prihlásení inicializujte hlavičku
            if (typeof loadHeaderAndInitializeLogic === 'function') {
                loadHeaderAndInitializeLogic();
            }
          })
          .catch((anonError) => {
            console.error("index.js: Chyba pri anonymnom prihlásení:", anonError);
          });
      });
  } else {
    auth.signInAnonymously()
      .then((userCredential) => {
        userId = userCredential.user.uid;
        console.log("index.js: Používateľ prihlásený anonymne (žiadny custom token):", userId);
        // Po prihlásení inicializujte hlavičku
        if (typeof loadHeaderAndInitializeLogic === 'function') {
            loadHeaderAndInitializeLogic();
        }
      })
      .catch((error) => {
        console.error("index.js: Chyba pri anonymnom prihlásení:", error);
      });
  }

} catch (e) {
  console.error("index.js: Chyba pri inicializácii Firebase:", e);
}

// React komponenta pre domovskú stránku
function App() {
  const [registrationSettings, setRegistrationSettings] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [countdown, setCountdown] = React.useState(null);

  React.useEffect(() => {
    if (!db) {
      setError("Firebase Firestore nie je inicializovaný.");
      setLoading(false);
      return;
    }

    const docRef = db.collection('settings').doc('registration');
    const unsubscribe = docRef.onSnapshot(docSnapshot => {
      if (docSnapshot.exists) {
        const data = docSnapshot.data();
        setRegistrationSettings(data);
        console.log("Nastavenia registrácie načítané:", data);
      } else {
        console.log("Dokument nastavení registrácie neexistuje.");
        setRegistrationSettings(null);
      }
      setLoading(false);
    }, err => {
      console.error("Chyba pri načítaní nastavení registrácie:", err);
      setError("Chyba pri načítaní nastavení registrácie.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db]);

  React.useEffect(() => {
    if (registrationSettings && registrationSettings.registrationStartDate) {
      const calculateCountdown = () => {
        const now = new Date();
        const startDate = registrationSettings.registrationStartDate.toDate();
        const diff = startDate.getTime() - now.getTime();

        if (diff > 0) {
          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
          const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);
          setCountdown(`${days}d ${hours}h ${minutes}m ${seconds}s`);
        } else {
          setCountdown(null);
        }
      };

      calculateCountdown();
      const interval = setInterval(calculateCountdown, 1000);
      return () => clearInterval(interval);
    }
  }, [registrationSettings]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-xl text-gray-700">Načítavam nastavenia registrácie...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-xl text-red-500">{error}</p>
      </div>
    );
  }

  const registrationStartDate = registrationSettings?.registrationStartDate?.toDate();
  const registrationEndDate = registrationSettings?.registrationEndDate?.toDate();
  const now = new Date();

  const isRegistrationOpen = (
    (registrationStartDate ? now >= registrationStartDate : true) &&
    (registrationEndDate ? now <= registrationEndDate : true)
  );

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center py-10">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-2xl w-full text-center border-t-4 border-blue-500">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-4">Vitajte na Slovak Open Handball 2025</h1>
        <p className="text-lg text-gray-700 mb-6">
          Pripravte sa na najväčšiu hádzanársku udalosť roka!
        </p>

        {registrationSettings && (
          <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg shadow-inner">
            <h2 className="text-2xl font-bold text-blue-800 mb-4">Stav registrácie</h2>
            {isRegistrationOpen ? (
              <>
                <p className="text-xl text-green-600 font-semibold mb-2">Registrácia je otvorená!</p>
                <p className="text-md text-gray-600">
                  Prihláste sa a zaregistrujte svoj tím.
                </p>
                <p className="text-md text-gray-500 mt-2">
                  Registrácia končí: <span style={{ whiteSpace: 'nowrap' }}>{new Date(registrationEndDate).toLocaleDateString('sk-SK') || 'Neznámy dátum'}</span> <span style={{ whiteSpace: 'nowrap' }}>{new Date(registrationEndDate).toLocaleTimeString('sk-SK') || 'Neznámy čas'}</span>
                </p>
                <div className="mt-6 flex justify-center space-x-4">
                  <a
                    href="register.html"
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200"
                  >
                    Registrovať sa
                  </a>
                  <a
                    href="login.html"
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200"
                  >
                    Prihlásenie
                  </a>
                </div>
              </>
            ) : (
              <>
                <p className="text-xl text-red-600 font-semibold mb-2">Registrácia je momentálne zatvorená.</p>
                {registrationStartDate && !isNaN(registrationStartDate) && now < registrationStartDate && (
                  <>
                    <p className="text-md text-gray-500 mt-2">
                      Registrácia začína: <span style={{ whiteSpace: 'nowrap' }}>{new Date(registrationStartDate).toLocaleDateString('sk-SK') || 'Neznámy dátum'}</span> <span style={{ whiteSpace: 'nowrap' }}>{new Date(registrationStartDate).toLocaleTimeString('sk-SK') || 'Neznámy čas'}</span>
                    </p>
                    {countdown && (
                      <p className="text-md text-gray-500 mt-2">Registrácia začne o: {countdown}</p>
                    )}
                  </>
                )}
                {registrationEndDate && !isNaN(registrationEndDate) && now > registrationEndDate && (
                  <p className="text-md text-gray-500 mt-2">
                    Registrácia skončila: <span style={{ whiteSpace: 'nowrap' }}>{new Date(registrationEndDate).toLocaleDateString('sk-SK') || 'Neznámy dátum'}</span> <span style={{ whiteSpace: 'nowrap' }}>{new Date(registrationEndDate).toLocaleTimeString('sk-SK') || 'Neznámy čas'}</span>
                  </p>
                )}
                <div className="mt-6 flex justify-center">
                  <a
                    href="login.html"
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200"
                  >
                    Prihlásenie
                  </a>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
