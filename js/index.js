// js/index.js

// Hlavný React komponent pre stránku index.html
function IndexPage() {
  const [app, setApp] = React.useState(null);
  const [auth, setAuth] = React.useState(null);
  const [db, setDb] = React.useState(null);
  const [user, setUser] = React.useState(null);
  const [isAuthReady, setIsAuthReady] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  // Stavy pre nastavenia dátumov a časov
  const [registrationStartDate, setRegistrationStartDate] = React.useState('');
  const [registrationEndDate, setRegistrationEndDate] = React.useState('');
  const [settingsLoaded, setSettingsLoaded] = React.useState(false); // Indikátor načítania nastavení

  // Nový stav pre odpočítavanie
  const [countdown, setCountdown] = React.useState(null);
  // Nová stavová premenná na vynútenie prepočítania isRegistrationOpen
  const [forceRegistrationCheck, setForceRegistrationCheck] = React.useState(0);
  // Nová stavová premenná pre periodickú aktualizáciu isRegistrationOpen
  const [periodicRefreshKey, setPeriodicRefreshKey] = React.useState(0);

  // Vypočítajte stav registrácie ako memoizovanú hodnotu
  const isRegistrationOpen = React.useMemo(() => {
    if (!settingsLoaded) return false; // Počkajte, kým sa načítajú nastavenia
    const now = new Date();
    const regStart = registrationStartDate ? new Date(registrationStartDate) : null;
    const regEnd = registrationEndDate ? new Date(registrationEndDate) : null;

    // Kontrola, či sú dátumy platné pred porovnaním
    const isRegStartValid = regStart instanceof Date && !isNaN(regStart);
    const isRegEndValid = regEnd instanceof Date && !isNaN(regEnd);

    return (
      (isRegStartValid ? now >= regStart : true) && // Ak regStart nie je platný, predpokladáme, že registrácia už začala
      (isRegEndValid ? now <= regEnd : true)        // Ak regEnd nie je platný, predpokladáme, že registrácia ešte neskončila
    );
  }, [settingsLoaded, registrationStartDate, registrationEndDate, forceRegistrationCheck, periodicRefreshKey]); // Pridaná závislosť periodicRefreshKey

  // Efekt pre inicializáciu Firebase a nastavenie Auth Listenera (spustí sa len raz)
  React.useEffect(() => {
    let unsubscribeAuth;

    try {
      if (typeof firebase === 'undefined') {
        setError("Firebase SDK nie je načítané. Skontrolujte index.html.");
        setLoading(false);
        return;
      }

      const firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
      setApp(firebaseApp);

      const authInstance = firebase.auth(firebaseApp);
      setAuth(authInstance);
      const firestoreInstance = firebase.firestore(firebaseApp);
      setDb(firestoreInstance);

      const signIn = async () => {
        try {
          if (INITIAL_AUTH_TOKEN) {
            await authInstance.signInWithCustomToken(INITIAL_AUTH_TOKEN);
          } else {
            // Pre index.html sa neprihlasujeme automaticky anonymne,
            // ale len sledujeme stav prihlásenia.
          }
        } catch (e) {
          console.error("Firebase initial sign-in failed:", e);
          setError(`Chyba pri prihlasovaní: ${e.message}`);
        }
      };

      // Listener pre zmeny stavu autentifikácie
      unsubscribeAuth = authInstance.onAuthStateChanged(async (currentUser) => {
        setUser(currentUser);
        setIsAuthReady(true);
        setLoading(false); // Nastavíme loading na false po inicializácii Auth
      });

      signIn(); // Spustí počiatočné prihlásenie (ak existuje token)

      return () => {
        if (unsubscribeAuth) {
          unsubscribeAuth(); // Vyčistenie listenera
        }
      };
    } catch (e) {
      console.error("Failed to initialize Firebase:", e);
      setError(`Chyba pri inicializácii Firebase: ${e.message}`);
      setLoading(false);
    }
  }, []); // Prázdne pole závislostí - spustí sa len raz pri mountovaní komponentu

  // Efekt pre načítanie nastavení (spustí sa po inicializácii DB a Auth)
  React.useEffect(() => {
    const fetchSettings = async () => {
      if (!db || !isAuthReady) {
        return; // Čakáme na inicializáciu DB a Auth
      }
      try {
          // Používame onSnapshot pre real-time aktualizácie nastavení
          const settingsDocRef = db.collection('settings').doc('registration');
          const unsubscribeSettings = settingsDocRef.onSnapshot(docSnapshot => {
            if (docSnapshot.exists) {
                const data = docSnapshot.data();
                setRegistrationStartDate(data.registrationStartDate ? formatToDatetimeLocal(data.registrationStartDate.toDate()) : '');
                setRegistrationEndDate(data.registrationEndDate ? formatToDatetimeLocal(data.registrationEndDate.toDate()) : '');
            } else {
                console.log("Nastavenia registrácie neboli nájdené vo Firestore. Používam predvolené prázdne hodnoty.");
                setRegistrationStartDate('');
                setRegistrationEndDate('');
            }
            setSettingsLoaded(true); // Nastavenia sú načítané, aj keď prázdne alebo s chybou
            setLoading(false); // Celkové načítanie je hotové
          }, error => {
            console.error("Chyba pri načítaní nastavení registrácie (onSnapshot):", error);
            setError(`Chyba pri načítaní nastavení: ${error.message}`);
            setSettingsLoaded(true);
            setLoading(false);
          });

          return () => unsubscribeSettings(); // Vyčistenie onSnapshot listenera pri unmount
      } catch (e) {
          console.error("Chyba pri nastavení onSnapshot pre nastavenia registrácie:", e);
          setError(`Chyba pri nastavení listenera pre nastavenia: ${e.message}`);
          setSettingsLoaded(true);
          setLoading(false);
      }
    };

    fetchSettings();
  }, [db, isAuthReady]); // Načíta nastavenia, keď je DB a Auth pripravené

  // Efekt pre odpočítavanie času (spustí sa pri zmene registrationStartDate)
  React.useEffect(() => {
    let timer;
    const updateCountdown = () => {
        const timeLeft = calculateTimeLeft(registrationStartDate); // Používame globálnu funkciu
        setCountdown(timeLeft);
        // Ak čas vypršal, vynútime prepočítanie isRegistrationOpen
        if (timeLeft === null) {
            clearInterval(timer);
            setForceRegistrationCheck(prev => prev + 1); // Zmeníme stav, aby sa isRegistrationOpen prepočítalo
        }
    };

    // Spustite odpočítavanie len ak je nastavený dátum začiatku a je v budúcnosti
    if (registrationStartDate && new Date(registrationStartDate) > new Date()) {
        updateCountdown(); // Počiatočné volanie pre okamžité zobrazenie
        timer = setInterval(updateCountdown, 1000);
    } else {
        setCountdown(null); // Vymažte odpočítavanie, ak nie je relevantné
    }

    return () => clearInterval(timer); // Vyčistenie intervalu pri unmount alebo zmene registrationStartDate
  }, [registrationStartDate, calculateTimeLeft]); // Závisí od registrationStartDate a calculateTimeLeft

  // NOVÝ useEffect pre periodickú aktualizáciu isRegistrationOpen
  React.useEffect(() => {
    const interval = setInterval(() => {
      setPeriodicRefreshKey(prev => prev + 1);
    }, 60 * 1000); // Aktualizovať každú minútu

    return () => clearInterval(interval);
  }, []); // Spustí sa len raz pri mountovaní komponentu

  // Renderovanie obsahu pre index.html
  const now = new Date();
  const regStart = registrationStartDate ? new Date(registrationStartDate) : null;
  const regEnd = registrationEndDate ? new Date(registrationEndDate) : null;

  if (loading || !isAuthReady || !settingsLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-xl font-semibold text-gray-700">Načítava sa...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center font-inter overflow-y-auto">
      <div className="w-full max-w-md mt-20 mb-10 p-4">
        <div className="bg-white p-8 rounded-lg shadow-xl w-full text-center">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">Vitajte na stránke Slovak Open Handball</h1>
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap" role="alert">
              {error}
            </div>
          )}
          {user ? (
            <>
              <p className="text-lg text-gray-600">Ste prihlásený. Prejdite do svojej zóny pre viac možností.</p>
              <div className="mt-6 flex justify-center">
                <a
                  href="logged-in.html"
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200"
                >
                  Moja zóna
                </a>
              </div>
            </>
          ) : (
            <>
              {isRegistrationOpen ? (
                <>
                  <p className="text-lg text-gray-600">Prosím, prihláste sa alebo sa zaregistrujte, aby ste mohli pokračovať.</p>
                  <div className="mt-6 flex justify-center space-x-4">
                    <a
                      href="login.html"
                      className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200"
                    >
                      Prihlásenie
                    </a>
                    <a
                      href="register.html"
                      className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200"
                    >
                      Registrácia na turnaj
                    </a>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-lg text-gray-600">
                    Registračný formulár nie je prístupný.
                  </p>
                  {regStart && !isNaN(regStart) && now < regStart && (
                    <>
                      <p className="text-md text-gray-500 mt-2">
                        Registrácia bude možná od:{" "}
                        <span style={{ whiteSpace: 'nowrap' }}>
                          {new Date(registrationStartDate).toLocaleDateString('sk-SK')}
                        </span>{" "}
                        <span style={{ whiteSpace: 'nowrap' }}>
                          {new Date(registrationStartDate).toLocaleTimeString('sk-SK')}
                        </span>
                      </p>
                      {countdown && (
                          <p className="text-md text-gray-500 mt-2">Registrácia bude spustená o: {countdown}</p>
                      )}
                    </>
                  )}
                  {regEnd && !isNaN(regEnd) && now > regEnd && (
                    <p className="text-md text-gray-500 mt-2">
                      Registrácia bola ukončená:{" "}
                      <span style={{ whiteSpace: 'nowrap' }}>
                        {new Date(registrationEndDate).toLocaleDateString('sk-SK')}
                      </span>{" "}
                      <span style={{ whiteSpace: 'nowrap' }}>
                        {new Date(registrationEndDate).toLocaleTimeString('sk-SK')}
                      </span>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
