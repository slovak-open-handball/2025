const appId = 'default-app-id'; 
const firebaseConfig = {
  apiKey: "AIzaSyDj_bSTkjrquu1nyIVYW7YLbyBl1pD6YYo",
  authDomain: "prihlasovanie-4f3f3.firebaseapp.com",
  projectId: "prihlasovanie-4f3f3",
  storageBucket: "prihlasovanie-4f3f3.firebasestorage.app",
  messagingSenderId: "26454452024",
  appId: "1:26454452024:web:6954b4f90f87a3a1eb43cd"
};
const initialAuthToken = null;

// DUMMY_DOMAIN je odstránený, pretože sa už nepoužíva

function App() {
  const RECAPTCHA_SITE_KEY = "6LdJbn8rAAAAAO4C50qXTWva6ePzDlOfYwBDEDwa";

  const [app, setApp] = React.useState(null);
  const [auth, setAuth] = React.useState(null);
  const [db, setDb] = React.useState(null);
  const [user, setUser] = React.useState(null);
  const [isAuthReady, setIsAuthReady] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');

  const [email, setEmail] = React.useState(''); // Premenované z 'username' na 'email'
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [newEmail, setNewEmail] = React.useState(''); // Premenované z 'newUsername' na 'newEmail'
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmNewPassword, setConfirmNewPassword] = React.useState('');
  const [currentPassword, setCurrentPassword] = React.useState('');

  const [profileView, setProfileView] = React.useState('my-data');

  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = React.useState(false);


  const EyeIcon = React.createElement("svg", { className: "h-5 w-5 text-gray-500", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor" },
    React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M15 12a3 3 0 11-6 0 3 3 0 016 0z" }),
    React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" })
  );

  const EyeOffIcon = React.createElement("svg", { className: "h-5 w-5 text-gray-500", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor" },
    React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.274-4.057 5.064-7 9.542-7a9.95 9.95 0 011.875.175m.001 0V5m0 14v-2.175m0-10.65L12 12m-6.25 6.25L12 12m0 0l6.25-6.25M12 12l-6.25-6.25" })
  );


  React.useEffect(() => {
    try {
      if (typeof firebase === 'undefined') {
        setError("Firebase SDK nie je načítané. Skontrolujte index.html.");
        setLoading(false);
        return;
      }

      const firebaseApp = firebase.initializeApp(firebaseConfig);
      setApp(firebaseApp);

      const authInstance = firebase.auth(firebaseApp);
      setAuth(authInstance);
      setDb(firebase.firestore(firebaseApp));

      const signIn = async () => {
        try {
          if (initialAuthToken) {
            await authInstance.signInWithCustomToken(initialAuthToken);
          } else {
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

        const authLink = document.getElementById('auth-link');
        const profileLink = document.getElementById('profile-link');
        const logoutButton = document.getElementById('logout-button');
        const registerLink = document.getElementById('register-link');

        if (authLink) {
          if (currentUser) {
            authLink.classList.add('hidden');
            profileLink && profileLink.classList.remove('hidden');
            logoutButton && logoutButton.classList.remove('hidden');
            registerLink && registerLink.classList.add('hidden');
          } else {
            authLink.classList.remove('hidden');
            profileLink && profileLink.classList.add('hidden');
            logoutButton && logoutButton.classList.add('hidden');
            registerLink && registerLink.classList.remove('hidden');
          }
        }
      });

      signIn();

      return () => unsubscribe();
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

  const clearMessages = () => {
    setTimeout(() => {
      setMessage('');
      setError('');
    }, 5000);
  };

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
      return null;
    } else {
      return "Heslo musí obsahovať:\n• " + errors.join("\n• ") + ".";
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!auth) {
      setError("Firebase Auth nie je inicializovaný.");
      return;
    }
    if (!email || !password || !confirmPassword) {
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

    const recaptchaToken = await getRecaptchaToken('register');
    if (!recaptchaToken) {
      setError("Overenie reCAPTCHA zlyhalo. Prosím, skúste to znova.");
      return;
    }
    console.log("reCAPTCHA Token pre registráciu:", recaptchaToken);

    setMessage("reCAPTCHA overenie na klientovi úspešné. (Potrebné je aj serverové overenie!)");


    setLoading(true);
    try {
      // Používame email priamo
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      // Voliteľne nastavíme display name na email, alebo ponecháme tak ako je
      await userCredential.user.updateProfile({ displayName: email });
      setMessage("Registrácia úspešná! Presmerovanie na prihlasovaciu stránku...");
      setError('');
      setEmail(''); // Vyčistíme pole emailu
      setPassword('');
      setConfirmPassword('');
      window.location.href = 'login.html';
    } catch (e) {
      console.error("Chyba pri registrácii:", e);
      if (e.code === 'auth/email-already-in-use') {
        setError("E-mailová adresa už existuje. Prosím, zvoľte inú.");
      } else if (e.code === 'auth/weak-password') {
        setError("Heslo je príliš slabé. " + validatePassword(password));
      } else if (e.code === 'auth/invalid-email') {
        setError("Neplatný formát e-mailovej adresy.");
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
    if (!email || !password) {
      setError("Prosím, vyplňte e-mailovú adresu a heslo.");
      return;
    }

    const recaptchaToken = await getRecaptchaToken('login');
    if (!recaptchaToken) {
      setError("Overenie reCAPTCHA zlyhalo. Prosím, skúste to znova.");
      return;
    }
    console.log("reCAPTCHA Token pre prihlásenie:", recaptchaToken);

    setMessage("reCAPTCHA overenie na klientovi úspešné. (Potrebné je aj serverové overenie!)");


    setLoading(true);
    try {
      // Používame email priamo
      await auth.signInWithEmailAndPassword(email, password);
      setMessage("Prihlásenie úspešné! Presmerovanie na profilovú stránku...");
      setError('');
      setEmail(''); // Vyčistíme pole emailu
      setPassword('');
      window.location.href = 'logged-in.html';
    } catch (e) {
      console.error("Chyba pri prihlasovaní:", e);
      if (e.code === 'auth/invalid-credential' || e.code === 'auth/invalid-login-credentials') {
        setError("Zadané prihlasovacie údaje sú neplatné. Skontrolujte e-mailovú adresu a heslo a skúste to prosím znova.");
      } else if (e.code === 'auth/invalid-email') {
        setError("Neplatný formát e-mailovej adresy.");
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
      window.location.href = 'login.html';
    } catch (e) {
      console.error("Chyba pri odhlasovaní:", e);
      setError(`Chyba pri odhlasovaní: ${e.message}`);
    } finally {
      setLoading(false);
      clearMessages();
    }
  };

  const handleChangeEmail = async (e) => { // Premenované z handleChangeUsername
    e.preventDefault();
    if (!user) {
      setError("Nie ste prihlásený.");
      return;
    }
    if (!newEmail) {
      setError("Prosím, zadajte novú e-mailovú adresu.");
      return;
    }

    setLoading(true);
    try {
      if (user.email && currentPassword) {
        const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
        await user.reauthenticateWithCredential(credential);
      } else {
        setError("Pre zmenu e-mailovej adresy je potrebné zadať aktuálne heslo pre overenie.");
        setLoading(false);
        return;
      }

      await user.updateEmail(newEmail); // Používame updateEmail
      // Voliteľne aktualizujeme display name na nový email, alebo ponecháme tak ako je
      await user.updateProfile({ displayName: newEmail });
      setMessage("E-mailová adresa úspešne zmenená na " + newEmail);
      setError('');
      setNewEmail('');
      setCurrentPassword('');
    } catch (e) {
      console.error("Chyba pri zmene e-mailovej adresy:", e);
      if (e.code === 'auth/requires-recent-login') {
        setError("Pre túto akciu sa musíte znova prihlásiť. Prosím, odhláste sa a znova prihláste.");
      } else if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential' || e.code === 'auth/invalid-login-credentials') {
        setError("Nesprávne aktuálne heslo. Prosím, zadajte správne heslo pre overenie.");
      } else if (e.code === 'auth/invalid-email') {
        setError("Neplatný formát novej e-mailovej adresy.");
      } else if (e.code === 'auth/email-already-in-use') {
        setError("Nová e-mailová adresa už je používaná iným účtom.");
      }
      else {
        setError(`Chyba pri zmene e-mailovej adresy: ${e.message}`);
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
      } else if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential' || e.code === 'auth/invalid-login-credentials') {
        setError("Nesprávne aktuálne heslo. Prosím, zadajte správne heslo pre overenie.");
      } else {
        setError(`Chyba pri zmene hesla: ${e.message}`);
      }
    } finally {
      setLoading(false);
      clearMessages();
    }
  };

  React.useEffect(() => {
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
      logoutButton.addEventListener('click', handleLogout);
    }
    return () => {
      if (logoutButton) {
        logoutButton.removeEventListener('click', handleLogout);
      }
    };
  }, [handleLogout]);


  if (loading || !isAuthReady) {
    return (
      React.createElement("div", { className: "flex items-center justify-center min-h-screen bg-gray-100" },
        React.createElement("div", { className: "text-xl font-semibold text-gray-700" }, "Načítava sa...")
      )
    );
  }

  const currentPath = window.location.pathname.split('/').pop();

  if (currentPath === '' || currentPath === 'index.html') {
    return (
      React.createElement("div", { className: "min-h-screen bg-gray-100 flex flex-col items-center justify-center font-inter overflow-y-auto" },
        React.createElement("div", { className: "w-full max-w-md mt-20 mb-10 p-4" },
          React.createElement("div", { className: "bg-white p-8 rounded-lg shadow-xl w-full text-center" },
            React.createElement("h1", { className: "text-3xl font-bold text-gray-800 mb-4" }, "Vitajte na stránke Slovak Open Handball"),
            user ? (
              React.createElement("p", { className: "text-lg text-gray-600" }, "Ste prihlásený. Prejdite do svojej zóny pre viac možností.")
            ) : (
              React.createElement("p", { className: "text-lg text-gray-600" }, "Prosím, prihláste sa alebo sa zaregistrujte, aby ste mohli pokračovať.")
            ),
            React.createElement("div", { className: "mt-6 flex justify-center space-x-4" },
              user ? (
                React.createElement("a", {
                  href: "logged-in.html",
                  className: "bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200"
                }, "Moja zóna")
              ) : (
                React.createElement(React.Fragment, null,
                  React.createElement("a", {
                    href: "login.html",
                    className: "bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200"
                  }, "Prihlásenie"),
                  React.createElement("a", {
                    href: "register.html",
                    className: "bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200"
                  }, "Registrácia")
                )
              )
            )
          )
        )
      )
    );
  }

  if (currentPath === 'register.html') {
    return (
      React.createElement("div", { className: "min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto" },
        React.createElement("div", { className: "w-full max-w-md mt-20 mb-10 p-4" },
          React.createElement("div", { className: "bg-white p-8 rounded-lg shadow-xl w-full" },
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
            React.createElement("h1", { className: "text-3xl font-bold text-center text-gray-800 mb-6" }, "Registrácia na turnaj"),
            React.createElement("form", { onSubmit: handleRegister, className: "space-y-4" },
              React.createElement("div", null,
                React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "reg-email" }, "E-mailová adresa"),
                React.createElement("input", {
                  type: "email",
                  id: "reg-email",
                  className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500",
                  value: email,
                  onChange: (e) => setEmail(e.target.value),
                  required: true,
                  placeholder: "Zadajte svoju e-mailovú adresu",
                  autoComplete: "email"
                })
              ),
              React.createElement("div", { className: "relative" },
                React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "reg-password" }, "Heslo"),
                React.createElement("input", {
                  type: showConfirmPassword ? "text" : "password",
                  id: "reg-password",
                  className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10",
                  value: password,
                  onChange: (e) => setPassword(e.target.value),
                  onCopy: (e) => e.preventDefault(),
                  onPaste: (e) => e.preventDefault(),
                  onCut: (e) => e.preventDefault(),
                  required: true,
                  placeholder: "Zvoľte heslo (min. 10 znakov)",
                  autoComplete: "new-password"
                }),
                React.createElement("button", {
                  type: "button",
                  onClick: () => setShowConfirmPassword(!showConfirmPassword),
                  className: "absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
                },
                  showConfirmPassword ? EyeOffIcon : EyeIcon
                )
              ),
              React.createElement("div", { className: "relative" },
                React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "reg-confirm-password" }, "Potvrďte heslo"),
                React.createElement("input", {
                  type: showConfirmPassword ? "text" : "password",
                  id: "reg-confirm-password",
                  className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10",
                  value: confirmPassword,
                  onChange: (e) => setConfirmPassword(e.target.value),
                  onCopy: (e) => e.preventDefault(),
                  onPaste: (e) => e.preventDefault(),
                  onCut: (e) => e.preventDefault(),
                  required: true,
                  placeholder: "Potvrďte heslo",
                  autoComplete: "new-password"
                }),
                React.createElement("button", {
                  type: "button",
                  onClick: () => setShowConfirmPassword(!showConfirmPassword),
                  className: "absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
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
      )
    );
  }

  if (currentPath === 'login.html') {
    return (
      React.createElement("div", { className: "min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto" },
        React.createElement("div", { className: "w-full max-w-md mt-20 mb-10 p-4" },
          React.createElement("div", { className: "bg-white p-8 rounded-lg shadow-xl w-full" },
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

            React.createElement("h1", { className: "text-3xl font-bold text-center text-gray-800 mb-6" }, "Prihlásenie"),
            React.createElement("form", { onSubmit: handleLogin, className: "space-y-4" },
              React.createElement("div", null,
                React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "email" }, "E-mailová adresa"),
                React.createElement("input", {
                  type: "email",
                  id: "email",
                  className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500",
                  value: email,
                  onChange: (e) => setEmail(e.target.value),
                  required: true,
                  placeholder: "Zadajte svoju e-mailovú adresu",
                  autoComplete: "email"
                })
              ),
              React.createElement("div", { className: "relative" },
                React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "password" }, "Heslo"),
                React.createElement("input", {
                  type: showPassword ? "text" : "password",
                  id: "password",
                  className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10",
                  value: password,
                  onChange: (e) => setPassword(e.target.value),
                  onCopy: (e) => e.preventDefault(),
                  onPaste: (e) => e.preventDefault(),
                  onCut: (e) => e.preventDefault(),
                  required: true,
                  placeholder: "Zadajte heslo",
                  autoComplete: "current-password"
                }),
                React.createElement("button", {
                  type: "button",
                  onClick: () => setShowPassword(!showPassword),
                  className: "absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
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
          )
        )
      )
    );
  }

  if (currentPath === 'logged-in.html') {
    if (!user) {
      return React.createElement("div", { className: "min-h-screen bg-gray-100 flex items-center justify-center font-inter" },
        React.createElement("div", { className: "bg-white p-8 rounded-lg shadow-xl w-full max-w-md text-center" },
          React.createElement("p", { className: "text-red-500 text-lg" }, "Pre prístup k tejto stránke sa musíte prihlásiť."),
          React.createElement("button", {
            onClick: () => window.location.href = 'login.html',
            className: "mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200"
          }, "Prejsť na prihlásenie")
        )
      );
    }

    return (
      React.createElement("div", { className: "min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto" },
        React.createElement("div", { className: "w-full max-w-4xl mt-20 mb-10 p-4 flex" },
          React.createElement("div", { className: "w-1/4 bg-white p-6 rounded-lg shadow-xl mr-4" },
            React.createElement("h2", { className: "text-2xl font-bold text-gray-800 mb-4" }, "Menu"),
            React.createElement("nav", null,
              React.createElement("ul", { className: "space-y-2" },
                React.createElement("li", null,
                  React.createElement("button", {
                    onClick: () => setProfileView('my-data'),
                    className: `w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 ${
                      profileView === 'my-data' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'
                    }`
                  }, "Moje údaje")
                ),
                React.createElement("li", null,
                  React.createElement("button", {
                    onClick: () => setProfileView('change-email'), // Nový stav pre zmenu emailu
                    className: `w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 ${
                      profileView === 'change-email' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'
                    }`
                  }, "Zmeniť e-mail")
                ),
                React.createElement("li", null,
                  React.createElement("button", {
                    onClick: () => setProfileView('change-password'),
                    className: `w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 ${
                      profileView === 'change-password' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'
                    }`
                  }, "Zmeniť heslo")
                )
              )
            )
          ),

          React.createElement("div", { className: "w-3/4 bg-white p-8 rounded-lg shadow-xl" },
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

            React.createElement("h1", { className: "text-3xl font-bold text-center text-gray-800 mb-6" }, `Vitajte, ${user.displayName || 'Používateľ'}!`),
            React.createElement("div", { className: "text-center mb-6" },
              React.createElement("p", { className: "text-lg text-gray-700" },
                "Prihlásený ako: ",
                React.createElement("span", { className: "font-semibold" }, user.email || 'Neznámy používateľ')
              )
            ),

            profileView === 'my-data' && (
              React.createElement("div", { className: "space-y-4 border-t pt-4 mt-4" },
                React.createElement("h2", { className: "text-xl font-semibold text-gray-800" }, "Moje údaje"),
                React.createElement("p", { className: "text-gray-700" },
                  React.createElement("span", { className: "font-semibold" }, "E-mailová adresa: "), user.email || 'N/A'
                ),
                React.createElement("p", { className: "text-gray-700" },
                  React.createElement("span", { className: "font-semibold" }, "Zobrazované meno: "), user.displayName || 'N/A'
                )
              )
            ),

            profileView === 'change-email' && ( // Nová sekcia pre zmenu emailu
              React.createElement("form", { onSubmit: handleChangeEmail, className: "space-y-4 border-t pt-4 mt-4" },
                React.createElement("h2", { className: "text-xl font-semibold text-gray-800" }, "Zmeniť e-mailovú adresu"),
                React.createElement("div", null,
                  React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "new-email" }, "Nová e-mailová adresa"),
                  React.createElement("input", {
                    type: "email",
                    id: "new-email",
                    className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500",
                    value: newEmail,
                    onChange: (e) => setNewEmail(e.target.value),
                    required: true,
                    placeholder: "Zadajte novú e-mailovú adresu",
                    autoComplete: "email"
                  })
                ),
                React.createElement("div", { className: "relative" },
                  React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "current-password-email-change" }, "Aktuálne heslo (pre overenie)"),
                  React.createElement("input", {
                    type: showCurrentPassword ? "text" : "password",
                    id: "current-password-email-change",
                    className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10",
                    value: currentPassword,
                    onChange: (e) => setCurrentPassword(e.target.value),
                    onCopy: (e) => e.preventDefault(),
                    onPaste: (e) => e.preventDefault(),
                    onCut: (e) => e.preventDefault(),
                    required: true,
                    placeholder: "Zadajte svoje aktuálne heslo",
                    autoComplete: "current-password"
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
                  className: "bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200 mt-4",
                  disabled: loading
                }, loading ? 'Ukladám...' : 'Zmeniť e-mail')
              )
            ),

            profileView === 'change-password' && (
              React.createElement("form", { onSubmit: handleChangePassword, className: "space-y-4 border-t pt-4 mt-4" },
                React.createElement("h2", { className: "text-xl font-semibold text-gray-800" }, "Zmeniť heslo"),
                React.createElement("div", { className: "relative" },
                  React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "modal-current-password-password-change" }, "Aktuálne heslo (pre overenie)"),
                  React.createElement("input", {
                    type: showCurrentPassword ? "text" : "password",
                    id: "modal-current-password-password-change",
                    className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10",
                    value: currentPassword,
                    onChange: (e) => setCurrentPassword(e.target.value),
                    onCopy: (e) => e.preventDefault(),
                    onPaste: (e) => e.preventDefault(),
                    onCut: (e) => e.preventDefault(),
                    required: true,
                    placeholder: "Zadajte svoje aktuálne heslo",
                    autoComplete: "current-password"
                  }),
                  React.createElement("button", {
                    type: "button",
                    onClick: () => setShowCurrentPassword(!showCurrentPassword),
                    className: "absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
                  },
                    showCurrentPassword ? EyeOffIcon : EyeIcon
                  )
                ),
                React.createElement("div", { className: "relative" },
                  React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "modal-new-password" }, "Nové heslo"),
                  React.createElement("input", {
                    type: showNewPassword ? "text" : "password",
                    id: "modal-new-password",
                    className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10",
                    value: newPassword,
                    onChange: (e) => setNewPassword(e.target.value),
                    onCopy: (e) => e.preventDefault(),
                    onPaste: (e) => e.preventDefault(),
                    onCut: (e) => e.preventDefault(),
                    required: true,
                    placeholder: "Zadajte nové heslo (min. 10 znakov)",
                    autoComplete: "new-password"
                  }),
                  React.createElement("button", {
                    type: "button",
                    onClick: () => setShowNewPassword(!showNewPassword),
                    className: "absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
                  },
                    showNewPassword ? EyeOffIcon : EyeIcon
                  )
                ),
                React.createElement("div", { className: "relative" },
                  React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "modal-confirm-new-password" }, "Potvrďte nové heslo"),
                  React.createElement("input", {
                    type: showConfirmNewPassword ? "text" : "password",
                    id: "modal-confirm-new-password",
                    className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10",
                    value: confirmNewPassword,
                    onChange: (e) => setConfirmNewPassword(e.target.value),
                    onCopy: (e) => e.preventDefault(),
                    onPaste: (e) => e.preventDefault(),
                    onCut: (e) => e.preventDefault(),
                    required: true,
                    placeholder: "Potvrďte heslo",
                    autoComplete: "new-password"
                  }),
                  React.createElement("button", {
                    type: "button",
                    onClick: () => setShowConfirmNewPassword(!showConfirmNewPassword),
                    className: "absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
                  },
                    showConfirmNewPassword ? EyeOffIcon : EyeIcon
                  )
                ),
                React.createElement("button", {
                  type: "submit",
                  className: "bg-orange-500 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200 mt-4",
                  disabled: loading
                }, loading ? 'Ukladám...' : 'Zmeniť heslo')
              )
            )
          )
        )
      )
    );
  }

  return null;
}
