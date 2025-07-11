// Odstránené všetky importy, pretože Firebase SDKs, React a ReactDOM sa načítavajú globálne z CDN
// Všetky funkcie sa teraz pristupujú cez globálny objekt 'firebase'

// Global variables provided by the Canvas environment (používame ich priamo)
// Ak toto spúšťate priamo na GitHub Pages, tieto premenné nebudú definované.
// Pre funkčnosť ich preto definujeme pevne.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = {
  apiKey: "AIzaSyDj_bSTkjrquu1nyIVYW7YLbyBl1pD6YYo", // AKTUALIZOVANÝ API KĽÚČ
  authDomain: "prihlasovanie-4f3f3.firebaseapp.com", // AKTUALIZOVANÁ DOMÉNA
  projectId: "prihlasovanie-4f3f3", // AKTUALIZOVANÝ PROJECT ID
  storageBucket: "prihlasovanie-4f3f3.firebasestorage.app",
  messagingSenderId: "26454452024",
  appId: "1:26454452024:web:6954b4f90f87a3a1eb43cd",
  // measurementId: "G-C3XPTT7F4D" // Odstránené, ak nie je potrebné
};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Dummy domain for internal email construction
const DUMMY_DOMAIN = "@slovakhandball.com"; // You can change this to your actual domain if you own one

// reCAPTCHA Site Key - NAHRADENE S VASIM SKUTOCNYM SITE KEYOM!
const RECAPTCHA_SITE_KEY = "6LdJbn8rAAAAAO4C50qXTWva6ePzDlOfYwBDEDwa"; // Váš skutočný SITE KEY

function App() {
  // Používame React.useState a React.useEffect namiesto importovaných
  const [app, setApp] = React.useState(null);
  const [auth, setAuth] = React.useState(null);
  const [db, setDb] = React.useState(null);
  const [user, setUser] = React.useState(null);
  const [isAuthReady, setIsAuthReady] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');
  const [recaptchaId, setRecaptchaId] = React.useState(null); // ID pre reCAPTCHA widget

  // Form states
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState(''); // Nové pre registráciu
  const [newUsername, setNewUsername] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmNewPassword, setConfirmNewPassword] = React.useState(''); // Nové pre zmenu hesla
  const [currentPassword, setCurrentPassword] = React.useState(''); // For reauthentication

  // State to manage which view is active
  const [view, setView] = React.useState('login'); // 'login', 'register', 'profile'

  // States for password visibility
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = React.useState(false);


  // SVG ikony pre zobrazenie/skrytie hesla
  const EyeIcon = React.createElement("svg", { className: "h-5 w-5 text-gray-500", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor" },
    React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M15 12a3 3 0 11-6 0 3 3 0 016 0z" }),
    React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" })
  );

  const EyeOffIcon = React.createElement("svg", { className: "h-5 w-5 text-gray-500", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor" },
    React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.274-4.057 5.064-7 9.542-7a9.95 9.95 0 011.875.175m.001 0V5m0 14v-2.175m0-10.65L12 12m-6.25 6.25L12 12m0 0l6.25-6.25M12 12l-6.25-6.25" })
  );


  React.useEffect(() => {
    try {
      // Uistite sa, že 'firebase' je definované globálne z CDN skriptov
      if (typeof firebase === 'undefined') {
        setError("Firebase SDK nie je načítané. Skontrolujte index.html.");
        setLoading(false);
        return;
      }

      const firebaseApp = firebase.initializeApp(firebaseConfig);
      setApp(firebaseApp);

      const authInstance = firebase.auth(firebaseApp);
      setAuth(authInstance);
      setDb(firebase.firestore(firebaseApp)); // Ak by ste chceli používať Firestore

      const signIn = async () => {
        try {
          if (initialAuthToken) {
            await authInstance.signInWithCustomToken(initialAuthToken);
          } else {
            // Ak nechcete automatické prihlásenie anonymného používateľa,
            // odstráňte tento riadok. Používateľ bude musieť explicitne
            // prihlásiť sa alebo zaregistrovať.
            // await authInstance.signInAnonymously();
          }
        } catch (e) {
          console.error("Firebase initial sign-in failed:", e);
          setError(`Chyba pri prihlasovaní: ${e.message}`);
        } finally {
          setLoading(false);
        }
      };

      const unsubscribe = authInstance.onAuthStateChanged((currentUser) => {
        setUser(currentUser);
        setIsAuthReady(true);
        if (loading) setLoading(false);
      });

      signIn();

      return () => unsubscribe();
    } catch (e) {
      console.error("Failed to initialize Firebase:", e);
      setError(`Chyba pri inicializácii Firebase: ${e.message}`);
      setLoading(false);
    }
  }, []);

  // Effect pre renderovanie a resetovanie reCAPTCHA widgetu
  React.useEffect(() => {
    // Skontrolujte, či je reCAPTCHA API načítané
    if (typeof grecaptcha === 'undefined' || !grecaptcha.render) {
      console.warn("reCAPTCHA API nie je načítané. Čakám na načítanie.");
      return;
    }

    const container = document.getElementById('recaptcha-container');

    // Ak sme vo formulári pre prihlásenie/registráciu a reCAPTCHA ešte nebol renderovaný
    if ((view === 'login' || view === 'register') && container && recaptchaId === null) {
      console.log("Renderujem reCAPTCHA widget...");
      const widgetId = grecaptcha.render('recaptcha-container', {
        'sitekey': RECAPTCHA_SITE_KEY,
        'callback': (token) => {
          console.log('reCAPTCHA token:', token);
        },
        'expired-callback': () => {
          console.log('reCAPTCHA vypršala');
          setError('reCAPTCHA vypršala. Prosím, skúste to znova.');
          if (recaptchaId) grecaptcha.reset(recaptchaId);
        }
      });
      setRecaptchaId(widgetId); // Uložte ID renderovaného widgetu do stavu
    }
    // Ak sme vo formulári pre prihlásenie/registráciu a reCAPTCHA už bol renderovaný, stačí ho resetovať
    else if ((view === 'login' || view === 'register') && recaptchaId !== null) {
      console.log("Resetujem existujúci reCAPTCHA widget pre zmenu pohľadu.");
      grecaptcha.reset(recaptchaId);
    }
    // Ak prejdeme na pohľad profilu (alebo iný, kde reCAPTCHA nie je potrebná)
    else if (view === 'profile' && recaptchaId !== null) {
      console.log("Resetujem a čistím reCAPTCHA widget, pretože pohľad sa zmenil na profil.");
      grecaptcha.reset(recaptchaId);
      setRecaptchaId(null); // Vyčistite ID widgetu zo stavu
    }

    // Cleanup funkcia: Spustí sa, keď sa komponent odpojí alebo pred opätovným spustením efektu
    return () => {
      // Ak je sledované ID widgetu a grecaptcha je k dispozícii, resetujte ho.
      // Toto zabraňuje chybám "reCAPTCHA has already been rendered".
      if (recaptchaId !== null && typeof grecaptcha !== 'undefined' && grecaptcha.reset) {
        console.log("Cleanup: Resetujem reCAPTCHA widget s ID:", recaptchaId);
        grecaptcha.reset(recaptchaId);
        // Dôležité: NEnastavujte recaptchaId na null tu, ak sa efekt iba opätovne spúšťa
        // kvôli zmene závislostí. Nastavenie na null je riadené explicitne pri zmene na 'profile' view.
      }
    };
  }, [view, isAuthReady, RECAPTCHA_SITE_KEY]); // Závislosti pre efekt

  const clearMessages = () => {
    setTimeout(() => {
      setMessage('');
      setError('');
    }, 5000);
  };

  // Funkcia na validáciu hesla podľa požiadaviek
  const validatePassword = (pwd) => {
    const errors = [];

    if (pwd.length < 10) {
      errors.push("minimálne 10 znakov");
    }
    if (pwd.length > 4096) {
      errors.push("maximálne 4096 znakov");
    }
    if (!/[A-Z]/.test(pwd)) {
      errors.push("aspoň jedno veľké písmeno");
    }
    if (!/[a-z]/.test(pwd)) {
      errors.push("aspoň jedno malé písmeno");
    }
    if (!/[0-9]/.test(pwd)) {
      errors.push("aspoň jednu číslicu");
    }

    if (errors.length === 0) {
      return null; // Heslo je platné
    } else {
      // Upravená formátovanie pre zobrazenie všetkých požiadaviek
      return "Heslo musí obsahovať:\n• " + errors.join("\n• ") + ".";
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!auth) {
      setError("Firebase Auth nie je inicializovaný.");
      return;
    }
    if (!username || !password || !confirmPassword) {
      setError("Prosím, vyplňte všetky polia.");
      return;
    }
    // Overenie medzier v používateľskom mene
    if (username.includes(' ')) {
      setError("Používateľské meno nesmie obsahovať medzery.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Heslá sa nezhodujú. Prosím, skontrolujte ich.");
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    // reCAPTCHA overenie
    if (typeof grecaptcha === 'undefined' || !recaptchaId || !grecaptcha.getResponse(recaptchaId)) {
      setError("Prosím, potvrďte, že nie ste robot (reCAPTCHA).");
      return;
    }
    const recaptchaToken = grecaptcha.getResponse(recaptchaId);
    console.log("reCAPTCHA Token pre registráciu:", recaptchaToken);

    // DÔLEŽITÉ: Tu by ste mali poslať 'recaptchaToken' na váš server na overenie.
    // Ak overenie na serveri zlyhá, nemali by ste povoliť registráciu.
    // Príklad (pseudo-kód pre serverové overenie):
    /*
    const serverResponse = await fetch('/verify-recaptcha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: recaptchaToken })
    });
    const data = await serverResponse.json();
    if (!data.success) {
      setError("reCAPTCHA overenie zlyhalo. Prosím, skúste to znova.");
      grecaptcha.reset(recaptchaId); // Resetovať reCAPTCHA po neúspešnom overení
      return;
    }
    */
    setMessage("reCAPTCHA overenie na klientovi úspešné. (Potrebné je aj serverové overenie!)");


    setLoading(true);
    try {
      const email = username + DUMMY_DOMAIN;
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      await userCredential.user.updateProfile({ displayName: username });
      setMessage("Registrácia úspešná! Prihlásený ako " + username);
      setError('');
      setUsername('');
      setPassword('');
      setConfirmPassword('');
      setView('profile');
      grecaptcha.reset(recaptchaId); // Resetovať reCAPTCHA po úspešnej registrácii
    } catch (e) {
      console.error("Chyba pri registrácii:", e);
      if (e.code === 'auth/email-already-in-use') {
        setError("Používateľské meno už existuje. Prosím, zvoľte iné.");
      } else if (e.code === 'auth/weak-password') {
        setError("Heslo je príliš slabé. " + validatePassword(password)); // Použijeme detailnejšiu správu
      } else {
        setError(`Chyba pri registrácii: ${e.message}`);
      }
      grecaptcha.reset(recaptchaId); // Resetovať reCAPTCHA aj pri chybe
    } finally {
      setLoading(false);
      clearMessages();
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!auth) {
      setError("Firebase Auth nie je inicializovaný.");
      return;
    }
    if (!username || !password) {
      setError("Prosím, vyplňte používateľské meno a heslo.");
      return;
    }
    // Overenie medzier v používateľskom mene
    if (username.includes(' ')) {
      setError("Používateľské meno nesmie obsahovať medzery.");
      return;
    }

    // reCAPTCHA overenie
    if (typeof grecaptcha === 'undefined' || !recaptchaId || !grecaptcha.getResponse(recaptchaId)) {
      setError("Prosím, potvrďte, že nie ste robot (reCAPTCHA).");
      return;
    }
    const recaptchaToken = grecaptcha.getResponse(recaptchaId);
    console.log("reCAPTCHA Token pre prihlásenie:", recaptchaToken);

    // DÔLEŽITÉ: Tu by ste mali poslať 'recaptchaToken' na váš server na overenie.
    // Ak overenie na serveri zlyhá, nemali by ste povoliť prihlásenie.
    /*
    const serverResponse = await fetch('/verify-recaptcha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: recaptchaToken })
    });
    const data = await serverResponse.json();
    if (!data.success) {
      setError("reCAPTCHA overenie zlyhalo. Prosím, skúste to znova.");
      grecaptcha.reset(recaptchaId);
      return;
    }
    */
    setMessage("reCAPTCHA overenie na klientovi úspešné. (Potrebné je aj serverové overenie!)");


    setLoading(true);
    try {
      const email = username + DUMMY_DOMAIN;
      await auth.signInWithEmailAndPassword(email, password);
      setMessage("Prihlásenie úspešné!");
      setError('');
      setUsername('');
      setPassword('');
      setView('profile');
      grecaptcha.reset(recaptchaId); // Resetovať reCAPTCHA po úspešnom prihlásení
    } catch (e) {
      console.error("Chyba pri prihlasovaní:", e);
      // Upravená chybová správa pre neplatné prihlasovacie údaje
      if (e.code === 'auth/invalid-credential' || e.code === 'auth/invalid-login-credentials') {
        setError("Zadané prihlasovacie údaje sú neplatné. Skontrolujte používateľské meno a heslo a skúste to prosím znova.");
      } else {
        setError(`Chyba pri prihlasovaní: ${e.message}`);
      }
      grecaptcha.reset(recaptchaId); // Resetovať reCAPTCHA aj pri chybe
    } finally {
      setLoading(false);
      clearMessages();
    }
  };

  const handleLogout = async () => {
    if (!auth) return;
    try {
      setLoading(true);
      await auth.signOut();
      setMessage("Úspešne odhlásené.");
      setError('');
      setView('login');
    } catch (e) {
      console.error("Chyba pri odhlasovaní:", e);
      setError(`Chyba pri odhlasovaní: ${e.message}`);
    } finally {
      setLoading(false);
      clearMessages();
    }
  };

  const handleChangeUsername = async (e) => {
    e.preventDefault();
    if (!user) {
      setError("Nie ste prihlásený.");
      return;
    }
    if (!newUsername) {
      setError("Prosím, zadajte nové používateľské meno.");
      return;
    }
    // Overenie medzier v novom používateľskom mene
    if (newUsername.includes(' ')) {
      setError("Nové používateľské meno nesmie obsahovať medzery.");
      return;
    }

    setLoading(true);
    try {
      if (user.email && currentPassword) {
        const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
        await user.reauthenticateWithCredential(credential);
      } else {
        setError("Pre zmenu používateľského mena je potrebné zadať aktuálne heslo pre overenie.");
        setLoading(false);
        return;
      }

      await user.updateProfile({ displayName: newUsername });
      setMessage("Používateľské meno úspešne zmenené na " + newUsername);
      setError('');
      setNewUsername('');
      setCurrentPassword('');
    } catch (e) {
      console.error("Chyba pri zmene používateľského mena:", e);
      if (e.code === 'auth/requires-recent-login') {
        setError("Pre túto akciu sa musíte znova prihlásiť. Prosím, odhláste sa a znova prihláste.");
      } else if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        setError("Nesprávne aktuálne heslo. Prosím, zadajte správne heslo pre overenie.");
      } else {
        setError(`Chyba pri zmene používateľského mena: ${e.message}`);
      }
    } finally {
      setLoading(false);
      clearMessages();
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!user) {
      setError("Nie ste prihlásený.");
      return;
    }
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setError("Prosím, vyplňte všetky polia.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("Nové heslá sa nezhodujú. Prosím, skontrolujte ich.");
      return;
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setLoading(true);
    try {
      const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
      await user.reauthenticateWithCredential(credential);

      await user.updatePassword(newPassword);
      setMessage("Heslo úspešne zmenené!");
      setError('');
      setNewPassword('');
      setConfirmNewPassword('');
      setCurrentPassword('');
    } catch (e) {
      console.error("Chyba pri zmene hesla:", e);
      if (e.code === 'auth/requires-recent-login') {
        setError("Pre túto akciu sa musíte znova prihlásiť. Prosím, odhláste sa a znova prihláste.");
      } else if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        setError("Nesprávne aktuálne heslo. Prosím, zadajte správne heslo pre overenie.");
      } else {
        setError(`Chyba pri zmene hesla: ${e.message}`);
      }
    } finally {
      setLoading(false);
      clearMessages();
    }
  };

  if (loading || !isAuthReady) {
    return (
      React.createElement("div", { className: "flex items-center justify-center min-h-screen bg-gray-100" },
        React.createElement("div", { className: "text-xl font-semibold text-gray-700" }, "Načítava sa...")
      )
    );
  }

  return (
    // HLAVNÝ KONTANIER: Upravené triedy pre lepšie zobrazenie
    React.createElement("div", { className: "min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto" }, // Odstránené p-4 a pb-10
      // Hlavička stránky s menu
      React.createElement("header", { className: "w-full bg-blue-700 text-white p-4 shadow-md fixed top-0 left-0 right-0 z-20 flex justify-between items-center" },
        React.createElement("div", { className: "flex items-center space-x-6" },
          // Odkaz na Domov
          React.createElement("a", {
            href: "index.html", // Odkaz na index.html
            className: "text-lg font-semibold hover:text-blue-200 transition-colors duration-200"
          }, "Domov")
          // Tu môžete pridať ďalšie odkazy do hlavného menu, napr.:
          // React.createElement("a", { href: "#", onClick: (e) => { e.preventDefault(); setView('about'); }, className: "text-lg font-semibold hover:text-blue-200 transition-colors duration-200" }, "O nás"),
          // React.createElement("a", { href: "#", onClick: (e) => { e.preventDefault(); setView('contact'); }, className: "text-lg font-semibold hover:text-blue-200 transition-colors duration-200" }, "Kontakt")
        ),
        // Odkaz na Prihlásenie / Odhlásenie / Profil v pravom hornom rohu
        React.createElement("div", { className: "flex items-center" },
          user ? (
            // Ak je používateľ prihlásený, zobrazí "Odhlásenie"
            React.createElement("a", {
              href: "#",
              onClick: (e) => { e.preventDefault(); handleLogout(); }, // Volá handleLogout
              className: "text-lg font-semibold hover:text-blue-200 transition-colors duration-200"
            }, "Odhlásenie")
          ) : (
            // Ak používateľ nie je prihlásený, zobrazí "Prihlásenie"
            React.createElement("a", {
              href: "login.html", // Odkaz na login.html
              className: "text-lg font-semibold hover:text-blue-200 transition-colors duration-200"
            }, "Prihlásenie")
          )
        )
      ),

      // Hlavný obsah stránky - pridané odsadenie zhora pre hlavičku
      React.createElement("div", { className: "w-full max-w-md mt-20 mb-10 p-4" }, // Pridané mt-20 pre odsadenie od hlavičky, mb-10 pre spodné odsadenie, p-4 pre vnútorné odsadenie celej sekcie
        React.createElement("div", { className: "bg-white p-8 rounded-lg shadow-xl w-full" }, // Odstránené my-8, pretože mt-20 a mb-10 sú na rodičovi
          React.createElement("h1", { className: "text-3xl font-bold text-center text-gray-800 mb-6" },
            user ? `Vitajte, ${user.displayName || 'Používateľ'}!` : (view === 'login' ? 'Prihlásenie' : 'Registrácia')
          ),

          message && (
            React.createElement("div", { className: "bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4", role: "alert" },
              message
            )
          ),
          error && (
            React.createElement("div", { className: "bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap", role: "alert" },
              error
            )
          ),

          !user ? ( // Ak používateľ nie je prihlásený
            React.createElement(React.Fragment, null, // Fragment pre tlačidlá a formuláre
              React.createElement("div", { className: "flex justify-center mb-6" },
                React.createElement("button", {
                  onClick: () => setView('login'),
                  className: `px-6 py-2 rounded-l-lg font-semibold transition-colors duration-200 ${
                    view === 'login' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`
                }, "Prihlásenie"),
                React.createElement("button", {
                  onClick: () => setView('register'),
                  className: `px-6 py-2 rounded-r-lg font-semibold transition-colors duration-200 ${
                    view === 'register' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`
                }, "Registrácia")
              ),

              view === 'login' && (
                React.createElement("form", { onSubmit: handleLogin, className: "space-y-4" },
                  React.createElement("div", null,
                    React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "username" }, "Používateľské meno"),
                    React.createElement("input", {
                      type: "text",
                      id: "username",
                      className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500",
                      value: username,
                      onChange: (e) => setUsername(e.target.value.replace(/\s/g, '')), // Odstránenie medzier
                      required: true,
                      placeholder: "Zadajte používateľské meno",
                      autoComplete: "username" // Pridaný autocomplete
                    })
                  ),
                  React.createElement("div", { className: "relative" }, // Wrapper pre ikonu oka
                    React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "password" }, "Heslo"),
                    React.createElement("input", {
                      type: showPassword ? "text" : "password",
                      id: "password",
                      className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10", // Pridaný pr-10 pre ikonu
                      value: password,
                      onChange: (e) => setPassword(e.target.value),
                      onCopy: (e) => e.preventDefault(),
                      onPaste: (e) => e.preventDefault(),
                      onCut: (e) => e.preventDefault(),
                      required: true,
                      placeholder: "Zadajte heslo",
                      autoComplete: "current-password" // Pridaný autocomplete
                    }),
                    React.createElement("button", {
                      type: "button",
                      onClick: () => setShowPassword(!showPassword),
                      className: "absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
                    },
                      showPassword ? EyeOffIcon : EyeIcon
                    )
                  ),
                  // reCAPTCHA widget pre prihlásenie
                  React.createElement("div", { id: "recaptcha-container", className: "g-recaptcha", "data-sitekey": RECAPTCHA_SITE_KEY }),
                  React.createElement("button", {
                    type: "submit",
                    className: "bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200",
                    disabled: loading
                  }, loading ? 'Prihlasujem...' : 'Prihlásiť sa')
                )
              ),

              view === 'register' && (
                React.createElement("form", { onSubmit: handleRegister, className: "space-y-4" },
                  React.createElement("div", null,
                    React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "reg-username" }, "Používateľské meno"),
                    React.createElement("input", {
                      type: "text",
                      id: "reg-username",
                      className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500",
                      value: username,
                      onChange: (e) => setUsername(e.target.value.replace(/\s/g, '')), // Odstránenie medzier
                      required: true,
                      placeholder: "Zvoľte používateľské meno",
                      autoComplete: "username" // Pridaný autocomplete
                    })
                  ),
                  React.createElement("div", { className: "relative" }, // Wrapper pre ikonu oka
                    React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "reg-password" }, "Heslo"),
                    React.createElement("input", {
                      type: showConfirmPassword ? "text" : "password", // Používame showConfirmPassword pre prvé heslo v registrácii
                      id: "reg-password",
                      className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10", // Pridaný pr-10
                      value: password,
                      onChange: (e) => setPassword(e.target.value),
                      onCopy: (e) => e.preventDefault(),
                      onPaste: (e) => e.preventDefault(),
                      onCut: (e) => e.preventDefault(),
                      required: true,
                      placeholder: "Zvoľte heslo (min. 10 znakov)", // Aktualizovaný placeholder
                      autoComplete: "new-password" // Pridaný autocomplete
                    }),
                    React.createElement("button", {
                      type: "button",
                      onClick: () => setShowConfirmPassword(!showConfirmPassword), // Prepínanie showConfirmPassword
                      className: "absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
                    },
                      showConfirmPassword ? EyeOffIcon : EyeIcon
                    )
                  ),
                  React.createElement("div", { className: "relative" }, // Wrapper pre ikonu oka
                    React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "reg-confirm-password" }, "Potvrďte heslo"),
                    React.createElement("input", {
                      type: showConfirmPassword ? "text" : "password", // Používame showConfirmPassword aj tu
                      id: "reg-confirm-password",
                      className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10", // Pridaný pr-10
                      value: confirmPassword,
                      onChange: (e) => setConfirmPassword(e.target.value),
                      onCopy: (e) => e.preventDefault(),
                      onPaste: (e) => e.preventDefault(),
                      onCut: (e) => e.preventDefault(),
                      required: true,
                      placeholder: "Potvrďte heslo",
                      autoComplete: "new-password" // Pridaný autocomplete
                    }),
                    React.createElement("button", {
                      type: "button",
                      onClick: () => setShowConfirmPassword(!showConfirmPassword), // Prepínanie showConfirmPassword
                      className: "absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
                    },
                      showConfirmPassword ? EyeOffIcon : EyeIcon
                    )
                  ),
                  // reCAPTCHA widget pre registráciu
                  React.createElement("div", { id: "recaptcha-container", className: "g-recaptcha", "data-sitekey": RECAPTCHA_SITE_KEY }),
                  React.createElement("button", {
                    type: "submit",
                    className: "bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200",
                    disabled: loading
                  }, loading ? 'Registrujem...' : 'Registrovať sa')
                )
              )
            )
          ) : ( // Ak je používateľ prihlásený - Profile View
            React.createElement("div", { className: "space-y-6" },
              React.createElement("div", { className: "text-center" },
                React.createElement("p", { className: "text-lg text-gray-700" },
                  "Prihlásený ako: ",
                  React.createElement("span", { className: "font-semibold" }, user.displayName || 'Neznámy používateľ')
                ),
                React.createElement("p", { className: "text-sm text-gray-500" },
                  "(ID: ", user.uid, ")"
                )
              ),

              // Change Username
              React.createElement("form", { onSubmit: handleChangeUsername, className: "space-y-4 border-t pt-4 mt-4" },
                React.createElement("h2", { className: "text-xl font-semibold text-gray-800" }, "Zmeniť používateľské meno"),
                React.createElement("div", null,
                  React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "new-username" }, "Nové používateľské meno"),
                  React.createElement("input", {
                    type: "text",
                    id: "new-username",
                    className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500",
                    value: newUsername,
                    onChange: (e) => setNewUsername(e.target.value.replace(/\s/g, '')), // Odstránenie medzier
                    required: true,
                    placeholder: "Zadajte nové používateľské meno",
                    autoComplete: "username" // Pridaný autocomplete
                  })
                ),
                React.createElement("div", { className: "relative" }, // Wrapper pre ikonu oka
                  React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "current-password-username-change" }, "Aktuálne heslo (pre overenie)"),
                  React.createElement("input", {
                    type: showCurrentPassword ? "text" : "password",
                    id: "current-password-username-change",
                    className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10", // Pridaný pr-10
                    value: currentPassword,
                    onChange: (e) => setCurrentPassword(e.target.value),
                    onCopy: (e) => e.preventDefault(),
                    onPaste: (e) => e.preventDefault(),
                    onCut: (e) => e.preventDefault(),
                    required: true,
                    placeholder: "Zadajte svoje aktuálne heslo",
                    autoComplete: "current-password" // Pridaný autocomplete
                  }),
                  React.createElement("button", {
                    type: "button",
                    onClick: () => setShowCurrentPassword(!showCurrentPassword),
                    className: "absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
                  },
                    showCurrentPassword ? EyeOffIcon : EyeIcon
                  )
                ),
                React.createElement("button", {
                  type: "submit",
                  className: "bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200",
                  disabled: loading
                }, loading ? 'Ukladám...' : 'Zmeniť používateľské meno')
              ),

              // Change Password
              React.createElement("form", { onSubmit: handleChangePassword, className: "space-y-4 border-t pt-4 mt-4" },
                React.createElement("h2", { className: "text-xl font-semibold text-gray-800" }, "Zmeniť heslo"),
                React.createElement("div", { className: "relative" }, // Wrapper pre ikonu oka
                  React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "new-password" }, "Nové heslo"),
                  React.createElement("input", {
                    type: showNewPassword ? "text" : "password",
                    id: "new-password",
                    className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10", // Pridaný pr-10
                    value: newPassword,
                    onChange: (e) => setNewPassword(e.target.value),
                    onCopy: (e) => e.preventDefault(),
                    onPaste: (e) => e.preventDefault(),
                    onCut: (e) => e.preventDefault(),
                    required: true,
                    placeholder: "Zadajte nové heslo (min. 10 znakov)", // Aktualizovaný placeholder
                    autoComplete: "new-password" // Pridaný autocomplete
                  }),
                  React.createElement("button", {
                    type: "button",
                    onClick: () => setShowNewPassword(!showNewPassword),
                    className: "absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
                  },
                    showNewPassword ? EyeOffIcon : EyeIcon
                  )
                ),
                React.createElement("div", { className: "relative" }, // Wrapper pre ikonu oka
                  React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "confirm-new-password" }, "Potvrďte nové heslo"),
                  React.createElement("input", {
                    type: showConfirmNewPassword ? "text" : "password", // Používame showConfirmPassword aj tu
                    id: "confirm-new-password",
                    className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10", // Pridaný pr-10
                    value: confirmNewPassword,
                    onChange: (e) => setConfirmNewPassword(e.target.value),
                    onCopy: (e) => e.preventDefault(),
                    onPaste: (e) => e.preventDefault(),
                    onCut: (e) => e.preventDefault(),
                    required: true,
                    placeholder: "Potvrďte nové heslo",
                    autoComplete: "new-password" // Pridaný autocomplete
                  }),
                  React.createElement("button", {
                    type: "button",
                    onClick: () => setShowConfirmNewPassword(!showConfirmNewPassword), // Prepínanie showConfirmPassword
                    className: "absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
                  },
                    showConfirmNewPassword ? EyeOffIcon : EyeIcon
                  )
                ),
                React.createElement("button", {
                  type: "submit",
                  className: "bg-orange-500 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200",
                  disabled: loading
                }, loading ? 'Ukladám...' : 'Zmeniť heslo')
              )
            )
          )
        )
      )
    )
  );
}

// export default App; // Odstránené export, App je teraz globálna
