// Odstránené všetky importy, pretože Firebase SDKs, React a ReactDOM sa načítavajú globálne z CDN
// Všetky funkcie sa teraz pristupujú cez globálny objekt 'firebase'

// Global variables provided by the Canvas environment (používame ich priamo)
// Ak toto spúšťate priamo na GitHub Pages, tieto premenné nebudú definované.
// Pre funkčnosť ich preto definujeme pevne.
const appId = 'default-app-id'; // Toto je len zástupná hodnota, pre Canvas by sa použila __app_id
const firebaseConfig = {
  apiKey: "AIzaSyDj_bSTkjrquu1nyIVYW7YLbyBl1pD6YYo",
  authDomain: "prihlasovanie-4f3f3.firebaseapp.com",
  projectId: "prihlasovanie-4f3f3",
  storageBucket: "prihlasovanie-4f3f3.firebasestorage.app",
  messagingSenderId: "26454452024",
  appId: "1:26454452024:web:6954b4f90f87a3a1eb43cd"
};
const initialAuthToken = null; // Toto je len zástupná hodnota, pre Canvas by sa použila __initial_auth_token

// Dummy domain for internal email construction
const DUMMY_DOMAIN = "@turnaj.slovak.open.handball.sk"; // Zmenená doména

// Definujeme App ako globálnu funkciu, nie ako export
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
    if (password !== confirmPassword) {
      setError("Heslá sa nezhodujú. Prosím, skontrolujte ich.");
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

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
    } catch (e) {
      console.error("Chyba pri registrácii:", e);
      if (e.code === 'auth/email-already-in-use') {
        setError("Používateľské meno už existuje. Prosím, zvoľte iné.");
      } else if (e.code === 'auth/weak-password') {
        setError("Heslo je príliš slabé. " + validatePassword(password)); // Použijeme detailnejšiu správu
      } else {
        setError(`Chyba pri registrácii: ${e.message}`);
      }
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

    setLoading(true);
    try {
      const email = username + DUMMY_DOMAIN;
      await auth.signInWithEmailAndPassword(email, password);
      setMessage("Prihlásenie úspešné!");
      setError('');
      setUsername('');
      setPassword('');
      setView('profile');
    } catch (e) {
      console.error("Chyba pri prihlasovaní:", e);
      // Upravená chybová správa pre neplatné prihlasovacie údaje
      if (e.code === 'auth/invalid-credential' || e.code === 'auth/invalid-login-credentials') {
        setError("Zadané prihlasovacie údaje sú neplatné. Skontrolujte používateľské meno a heslo a skúste to prosím znova.");
      } else {
        setError(`Chyba pri prihlasovaní: ${e.message}`);
      }
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
    React.createElement("div", { className: "min-h-screen bg-gray-100 flex flex-col items-center p-4 font-inter overflow-y-auto pb-10" }, // Odstránené justify-center, pridané overflow-y-auto a pb-10
      React.createElement("div", { className: "bg-white p-8 rounded-lg shadow-xl w-full max-w-md my-8" }, // Pridané my-8 pre vertikálny odstup
        React.createElement("h1", { className: "text-3xl font-bold text-center text-gray-800 mb-6" },
          user ? `Vitajte, ${user.displayName || 'Používateľ'}!` : "Prihlásenie / Registrácia"
        ),

        message && (
          React.createElement("div", { className: "bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4", role: "alert" },
            message
          )
        ),
        error && (
          // Pridaná trieda whitespace-pre-wrap pre správne zobrazenie nových riadkov
          React.createElement("div", { className: "bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap", role: "alert" },
            error
          )
        ),

        !user ? (
          React.createElement(React.Fragment, null,
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
                    onChange: (e) => setUsername(e.target.value),
                    required: true,
                    placeholder: "Zadajte používateľské meno"
                  })
                ),
                React.createElement("div", { className: "relative" }, // Wrapper pre ikonu oka
                  React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "password" }, "Heslo"),
                  React.createElement("input", {
                    type: showPassword ? "text" : "password",
                    id: "password",
                    className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10", // Znížené pr-10
                    value: password,
                    onChange: (e) => setPassword(e.target.value),
                    onCopy: (e) => e.preventDefault(),
                    onPaste: (e) => e.preventDefault(),
                    onCut: (e) => e.preventDefault(),
                    required: true,
                    placeholder: "Zadajte heslo"
                  }),
                  React.createElement("button", {
                    type: "button",
                    onClick: () => setShowPassword(!showPassword),
                    className: "absolute right-3 top-1/2 -translate-y-1/2 flex items-center z-10" // Upravené right-3
                  },
                    showPassword ? EyeOffIcon : EyeIcon
                  )
                ),
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
                    onChange: (e) => setUsername(e.target.value),
                    required: true,
                    placeholder: "Zvoľte používateľské meno"
                  })
                ),
                React.createElement("div", { className: "relative" }, // Wrapper pre ikonu oka
                  React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "reg-password" }, "Heslo"),
                  React.createElement("input", {
                    type: showConfirmPassword ? "text" : "password", // Používame showConfirmPassword pre prvé heslo v registrácii
                    id: "reg-password",
                    className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10", // Znížené pr-10
                    value: password,
                    onChange: (e) => setPassword(e.target.value),
                    onCopy: (e) => e.preventDefault(),
                    onPaste: (e) => e.preventDefault(),
                    onCut: (e) => e.preventDefault(),
                    required: true,
                    placeholder: "Zvoľte heslo (min. 10 znakov)"
                  }),
                  React.createElement("button", {
                    type: "button",
                    onClick: () => setShowConfirmPassword(!showConfirmPassword), // Prepínanie showConfirmPassword
                    className: "absolute right-3 top-1/2 -translate-y-1/2 flex items-center z-10" // Upravené right-3
                  },
                    showConfirmPassword ? EyeOffIcon : EyeIcon
                  )
                ),
                React.createElement("div", { className: "relative" }, // Wrapper pre ikonu oka
                  React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "reg-confirm-password" }, "Potvrďte heslo"),
                  React.createElement("input", {
                    type: showConfirmPassword ? "text" : "password", // Používame showConfirmPassword aj tu
                    id: "reg-confirm-password",
                    className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10", // Znížené pr-10
                    value: confirmPassword,
                    onChange: (e) => setConfirmPassword(e.target.value),
                    onCopy: (e) => e.preventDefault(),
                    onPaste: (e) => e.preventDefault(),
                    onCut: (e) => e.preventDefault(),
                    required: true,
                    placeholder: "Potvrďte heslo"
                  }),
                  React.createElement("button", {
                    type: "button",
                    onClick: () => setShowConfirmPassword(!showConfirmPassword), // Prepínanie showConfirmPassword
                    className: "absolute right-3 top-1/2 -translate-y-1/2 flex items-center z-10" // Upravené right-3
                  },
                    showConfirmPassword ? EyeOffIcon : EyeIcon
                  )
                ),
                React.createElement("button", {
                  type: "submit",
                  className: "bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200",
                  disabled: loading
                }, loading ? 'Registrujem...' : 'Registrovať sa')
              )
            )
          )
        ) : (
          // User is logged in - Profile View
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
                  onChange: (e) => setNewUsername(e.target.value),
                  required: true,
                  placeholder: "Zadajte nové používateľské meno"
                })
              ),
              React.createElement("div", { className: "relative" }, // Wrapper pre ikonu oka
                React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "current-password-username-change" }, "Aktuálne heslo (pre overenie)"),
                React.createElement("input", {
                  type: showCurrentPassword ? "text" : "password",
                  id: "current-password-username-change",
                  className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10", // Znížené pr-10
                  value: currentPassword,
                  onChange: (e) => setCurrentPassword(e.target.value),
                  onCopy: (e) => e.preventDefault(),
                  onPaste: (e) => e.preventDefault(),
                  onCut: (e) => e.preventDefault(),
                  required: true,
                  placeholder: "Zadajte svoje aktuálne heslo"
                }),
                React.createElement("button", {
                  type: "button",
                  onClick: () => setShowCurrentPassword(!showCurrentPassword),
                  className: "absolute right-3 top-1/2 -translate-y-1/2 flex items-center z-10" // Upravené right-3
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
                React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "current-password-password-change" }, "Aktuálne heslo"),
                React.createElement("input", {
                  type: showCurrentPassword ? "text" : "password", // Používame showCurrentPassword aj tu
                  id: "current-password-password-change",
                  className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10", // Znížené pr-10
                  value: currentPassword,
                  onChange: (e) => setCurrentPassword(e.target.value),
                  onCopy: (e) => e.preventDefault(),
                  onPaste: (e) => e.preventDefault(),
                  onCut: (e) => e.preventDefault(),
                  required: true,
                  placeholder: "Zadajte svoje aktuálne heslo"
                }),
                React.createElement("button", {
                  type: "button",
                  onClick: () => setShowCurrentPassword(!showCurrentPassword), // Prepínanie showCurrentPassword
                  className: "absolute right-3 top-1/2 -translate-y-1/2 flex items-center z-10" // Upravené right-3
                },
                  showCurrentPassword ? EyeOffIcon : EyeIcon
                )
              ),
              React.createElement("div", { className: "relative" }, // Wrapper pre ikonu oka
                React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "new-password" }, "Nové heslo"),
                React.createElement("input", {
                  type: showNewPassword ? "text" : "password",
                  id: "new-password",
                  className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10", // Znížené pr-10
                  value: newPassword,
                  onChange: (e) => setNewPassword(e.target.value),
                  onCopy: (e) => e.preventDefault(),
                  onPaste: (e) => e.preventDefault(),
                  onCut: (e) => e.preventDefault(),
                  required: true,
                  placeholder: "Zadajte nové heslo (min. 10 znakov)"
                }),
                React.createElement("button", {
                  type: "button",
                  onClick: () => setShowNewPassword(!showNewPassword),
                  className: "absolute right-3 top-1/2 -translate-y-1/2 flex items-center z-10" // Upravené right-3
                },
                  showNewPassword ? EyeOffIcon : EyeIcon
                )
              ),
              React.createElement("div", { className: "relative" }, // Wrapper pre ikonu oka
                React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "confirm-new-password" }, "Potvrďte nové heslo"),
                React.createElement("input", {
                  type: showConfirmNewPassword ? "text" : "password",
                  id: "confirm-new-password",
                  className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10", // Znížené pr-10
                  value: confirmNewPassword,
                  onChange: (e) => setConfirmNewPassword(e.target.value),
                  onCopy: (e) => e.preventDefault(),
                  onPaste: (e) => e.preventDefault(),
                  onCut: (e) => e.preventDefault(),
                  required: true,
                  placeholder: "Potvrďte nové heslo"
                }),
                React.createElement("button", {
                  type: "button",
                  onClick: () => setShowConfirmNewPassword(!showConfirmNewPassword), // Prepínanie showConfirmPassword
                  className: "absolute right-3 top-1/2 -translate-y-1/2 flex items-center z-10" // Upravené right-3
                },
                  showConfirmNewPassword ? EyeOffIcon : EyeIcon
                )
              ),
              React.createElement("button", {
                type: "submit",
                className: "bg-orange-500 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200",
                  disabled: loading
              }, loading ? 'Ukladám...' : 'Zmeniť heslo')
            ),

            // Logout Button - TOTO JE TLAČIDLO, KTORÉ HĽADÁTE
            React.createElement("div", { className: "border-t pt-4 mt-4" },
              React.createElement("button", {
                onClick: handleLogout,
                className: "bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200",
                disabled: loading
              }, loading ? 'Odhlasujem...' : 'Odhlásiť sa')
            )
          )
        )
      )
    )
  );
}

// export default App; // Odstránené export, App je teraz globálna
