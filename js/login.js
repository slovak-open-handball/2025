// js/login.js

// Hlavný React komponent pre stránku login.html
function LoginPage() {
  const [app, setApp] = React.useState(null);
  const [auth, setAuth] = React.useState(null);
  const [db, setDb] = React.useState(null);
  const [isAuthReady, setIsAuthReady] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

  const [showPasswordLogin, setShowPasswordLogin] = React.useState(false);

  // Efekt pre inicializáciu Firebase
  React.useEffect(() => {
    try {
      if (typeof firebase === 'undefined') {
        setError("Firebase SDK nie je načítané. Skontrolujte HTML.");
        setLoading(false);
        return;
      }

      const firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
      setApp(firebaseApp);

      const authInstance = firebase.auth(firebaseApp);
      setAuth(authInstance);
      const firestoreInstance = firebase.firestore(firebaseApp);
      setDb(firestoreInstance);

      // Listener pre zmeny stavu autentifikácie
      const unsubscribeAuth = authInstance.onAuthStateChanged((currentUser) => {
        // Ak je používateľ už prihlásený, presmerujeme ho
        if (currentUser) {
          window.location.href = 'logged-in.html';
        }
        setIsAuthReady(true);
        setLoading(false); // Nastavíme loading na false po inicializácii Auth
      });

      return () => {
        if (unsubscribeAuth) unsubscribeAuth();
      };
    } catch (e) {
      console.error("Failed to initialize Firebase:", e);
      setError(`Chyba pri inicializácii Firebase: ${e.message}`);
      setLoading(false);
    }
  }, []);

  const getRecaptchaToken = async (action) => {
    if (typeof grecaptcha === 'undefined' || !grecaptcha.execute) {
      setError("reCAPTCHA API nie je načítané alebo pripravené.");
      return null;
    }
    try {
      const token = await grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: action });
      return token;
    } catch (e) {
      console.error("Chyba pri získavaní reCAPTCHA tokenu:", e);
      setError(`Chyba reCAPTCHA: ${e.message}`);
      return null;
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!auth || !db) {
      setError("Firebase Auth alebo Firestore nie je inicializovaný.");
      return;
    }
    if (!email || !password) {
      setError("Prosím, vyplňte e-mailovú adresu a heslo.");
      return;
    }

    const recaptchaToken = await getRecaptchaToken('login');
    if (!recaptchaToken) {
      setError("Overenie reCAPTCHA zlyhalo. Prosím, skúste to znova.");
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const userCredential = await auth.signInWithEmailAndPassword(email, password);
      const currentUser = userCredential.user;

      const userDocRef = db.collection('users').doc(currentUser.uid);
      const userDoc = await userDocRef.get();

      if (!userDoc.exists) {
        setError("Účet nebol nájdený v databáze. Kontaktujte podporu.");
        await auth.signOut();
        setLoading(false);
        return;
      }

      const userData = userDoc.data();

      if (userData.role === 'admin' && userData.approved === false) {
        setError("Pre úplnú aktiváciu počkajte, prosím, na schválenie účtu iným administrátorom.");

        try {
          const payload = {
            action: 'sendAdminApprovalReminder',
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            isAdmin: true
          };
          await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        } catch (emailError) {
          console.error("Chyba pri odosielaní e-mailu s pripomienkou schválenia admina cez Apps Script:", emailError);
        }

        await auth.signOut();
        setLoading(false);
        return;
      }

      setMessage("Prihlásenie úspešné! Presmerovanie na profilovú stránku...");
      setLoading(false);

      setTimeout(() => {
        window.location.href = 'logged-in.html';
      }, 5000);

    } catch (e) {
      console.error("Chyba pri prihlasovaní:", e);
      if (e.code === 'auth/invalid-credential' || e.code === 'auth/invalid-login-credentials') {
        setError("Zadané prihlasovacie údaje sú neplatné. Skontrolujte e-mailovú adresu a heslo a skúste to prosím znova.");
      } else if (e.code === 'auth/invalid-email') {
        setError("Neplatný formát e-mailovej adresy.");
      } else {
        setError(`Chyba pri prihlasovaní: ${e.message}`);
      }
      setLoading(false);
    }
  };

  if (loading || !isAuthReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-xl font-semibold text-gray-700">Načítava sa...</div>
      </div>
    );
  }

  // Podmienka pre zobrazenie správy po úspešnom prihlásení
  if (message) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center font-inter overflow-y-auto">
        <div className="w-full max-w-md mt-20 mb-10 p-4">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full text-center">
            <h1 className="text-3xl font-bold text-gray-800 mb-4">Prihlásenie úspešné!</h1>
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">
              {message}
            </div>
            <p className="text-lg text-gray-600">Presmerovanie na profilovú stránku...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto">
      <div className="w-full max-w-md mt-20 mb-10 p-4">
        <div className="bg-white p-8 rounded-lg shadow-xl w-full">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap" role="alert">
              {error}
            </div>
          )}

          <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">Prihlásenie</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">E-mailová adresa</label>
              <input
                type="email"
                id="email"
                className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Zadajte svoju e-mailovú adresu"
                autoComplete="email"
              />
            </div>
            <PasswordInput
              id="password"
              label="Heslo"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onCopy={(e) => e.preventDefault()}
              onPaste={(e) => e.preventDefault()}
              onCut={(e) => e.preventDefault()}
              placeholder="Zadajte heslo"
              autoComplete="current-password"
              showPassword={showPasswordLogin}
              toggleShowPassword={() => setShowPasswordLogin(!showPasswordLogin)}
            />
            <button
              type="submit"
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200"
              disabled={loading}
            >
              {loading ? 'Prihlasujem...' : 'Prihlásiť sa'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
