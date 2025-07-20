// js/register.js

// Hlavný React komponent pre stránku register.html
function RegisterPage() {
  const [app, setApp] = React.useState(null);
  const [auth, setAuth] = React.useState(null);
  const [db, setDb] = React.useState(null);
  const [user, setUser] = React.useState(null); // Sledujeme, či je používateľ prihlásený
  const [isAuthReady, setIsAuthReady] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [contactPhoneNumber, setContactPhoneNumber] = React.useState('');

  const [registrationStartDate, setRegistrationStartDate] = React.useState('');
  const [registrationEndDate, setRegistrationEndDate] = React.useState('');
  const [settingsLoaded, setSettingsLoaded] = React.useState(false);

  const [countdown, setCountdown] = React.useState(null);
  const [forceRegistrationCheck, setForceRegistrationCheck] = React.useState(0);
  const [periodicRefreshKey, setPeriodicRefreshKey] = React.useState(0);

  const [showPasswordReg, setShowPasswordReg] = React.useState(false);
  const [showConfirmPasswordReg, setShowConfirmPasswordReg] = React.useState(false);

  // Vypočítajte stav registrácie ako memoizovanú hodnotu
  const isRegistrationOpen = React.useMemo(() => {
    if (!settingsLoaded) return false; // Počkajte, kým sa načítajú nastavenia
    const now = new Date();
    const regStart = registrationStartDate ? new Date(registrationStartDate) : null;
    const regEnd = registrationEndDate ? new Date(registrationEndDate) : null;

    const isRegStartValid = regStart instanceof Date && !isNaN(regStart);
    const isRegEndValid = regEnd instanceof Date && !isNaN(regEnd);

    return (
      (isRegStartValid ? now >= regStart : true) &&
      (isRegEndValid ? now <= regEnd : true)
    );
  }, [settingsLoaded, registrationStartDate, registrationEndDate, forceRegistrationCheck, periodicRefreshKey]);

  // Efekt pre inicializáciu Firebase
  React.useEffect(() => {
    let unsubscribeAuth;
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

      unsubscribeAuth = authInstance.onAuthStateChanged((currentUser) => {
        setUser(currentUser);
        setIsAuthReady(true);
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

  // Efekt pre načítanie nastavení
  React.useEffect(() => {
    const fetchSettings = async () => {
      if (!db || !isAuthReady) {
        return;
      }
      try {
          const settingsDocRef = db.collection('settings').doc('registration');
          const unsubscribeSettings = settingsDocRef.onSnapshot(docSnapshot => {
            if (docSnapshot.exists) {
                const data = docSnapshot.data();
                setRegistrationStartDate(data.registrationStartDate ? formatToDatetimeLocal(data.registrationStartDate.toDate()) : '');
                setRegistrationEndDate(data.registrationEndDate ? formatToDatetimeLocal(data.registrationEndDate.toDate()) : '');
            } else {
                console.log("Nastavenia registrácie neboli nájdené vo Firestore.");
                setRegistrationStartDate('');
                setRegistrationEndDate('');
            }
            setSettingsLoaded(true);
            setLoading(false);
          }, error => {
            console.error("Chyba pri načítaní nastavení registrácie (onSnapshot):", error);
            setError(`Chyba pri načítaní nastavení: ${error.message}`);
            setSettingsLoaded(true);
            setLoading(false);
          });
          return () => unsubscribeSettings();
      } catch (e) {
          console.error("Chyba pri nastavení onSnapshot pre nastavenia registrácie:", e);
          setError(`Chyba pri nastavení listenera pre nastavenia: ${e.message}`);
          setSettingsLoaded(true);
          setLoading(false);
      }
    };
    fetchSettings();
  }, [db, isAuthReady]);

  // Efekt pre odpočítavanie času
  React.useEffect(() => {
    let timer;
    const updateCountdown = () => {
        const timeLeft = calculateTimeLeft(registrationStartDate);
        setCountdown(timeLeft);
        if (timeLeft === null) {
            clearInterval(timer);
            setForceRegistrationCheck(prev => prev + 1);
        }
    };

    if (registrationStartDate && new Date(registrationStartDate) > new Date()) {
        updateCountdown();
        timer = setInterval(updateCountdown, 1000);
    } else {
        setCountdown(null);
    }
    return () => clearInterval(timer);
  }, [registrationStartDate]);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setPeriodicRefreshKey(prev => prev + 1);
    }, 60 * 1000);
    return () => clearInterval(interval);
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

  const validatePassword = (pwd) => {
    const errors = [];
    if (pwd.length < 10) errors.push("minimálne 10 znakov");
    if (pwd.length > 4096) errors.push("maximálne 4096 znakov");
    if (!/[A-Z]/.test(pwd)) errors.push("aspoň jedno veľké písmeno");
    if (!/[a-z]/.test(pwd)) errors.push("aspoň jedno malé písmeno");
    if (!/[0-9]/.test(pwd)) errors.push("aspoň jednu číslicu");
    return errors.length === 0 ? null : "Heslo musí obsahovať:\n• " + errors.join("\n• ") + ".";
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!auth || !db) {
      setError("Firebase Auth alebo Firestore nie je inicializovaný.");
      return;
    }
    if (!email || !password || !confirmPassword || !firstName || !lastName || !contactPhoneNumber) {
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

    const phoneRegex = /^\+\d+$/;
    if (!contactPhoneNumber || !phoneRegex.test(contactPhoneNumber)) {
        setError("Telefónne číslo kontaktnej osoby musí začínať znakom '+' a obsahovať iba číslice (napr. +421901234567).");
        return;
    }

    const recaptchaToken = await getRecaptchaToken('register');
    if (!recaptchaToken) {
      setError("Overenie reCAPTCHA zlyhalo. Prosím, skúste to znova.");
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      await userCredential.user.updateProfile({ displayName: `${firstName} ${lastName}` });

      const userDataToSave = {
        uid: userCredential.user.uid,
        email: email,
        firstName: firstName,
        lastName: lastName,
        contactPhoneNumber: contactPhoneNumber,
        displayName: `${firstName} ${lastName}`,
        role: 'user',
        approved: true,
        registeredAt: firebase.firestore.FieldValue.serverTimestamp(),
        displayNotifications: true
      };

      await db.collection('users').doc(userCredential.user.uid).set(userDataToSave);

      try {
        const payload = {
          action: 'sendRegistrationEmail',
          email: email,
          password: password,
          isAdmin: false,
          firstName: firstName,
          lastName: lastName,
          contactPhoneNumber: contactPhoneNumber
        };
        await fetch(GOOGLE_APPS_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (emailError) {
        console.error("Chyba pri odosielaní registračného e-mailu cez Apps Script:", emailError);
      }

      setMessage(`Ďakujeme za registráciu Vášho klubu na turnaj Slovak Open Handball. Na e-mailovú adresu ${email} sme odoslali potvrdenie registrácie.`);
      setLoading(false);

      await auth.signOut();
      setUser(null);

      setTimeout(() => {
        window.location.href = 'login.html';
      }, 5000);

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
      setLoading(false);
      setMessage('');
    }
  };

  // Ak je používateľ už prihlásený, presmerujeme ho na logged-in.html
  if (user) {
    window.location.href = 'logged-in.html';
    return null;
  }

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

  // Prioritné zobrazenie správy o úspešnej registrácii
  if (message) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center font-inter overflow-y-auto">
        <div className="w-full max-w-md mt-20 mb-10 p-4">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full text-center">
            <h1 className="text-3xl font-bold text-gray-800 mb-4">Registrácia úspešná!</h1>
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">
              {message}
            </div>
            <p className="text-lg text-gray-600">Presmerovanie na prihlasovaciu stránku...</p>
          </div>
        </div>
      </div>
    );
  }

  // Ak nie je registrácia otvorená, zobrazte správu
  if (!isRegistrationOpen) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center font-inter overflow-y-auto">
        <div className="w-full max-w-md mt-20 mb-10 p-4">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full text-center">
            <h1 className="text-3xl font-bold text-gray-800 mb-4">Registrácia na turnaj</h1>
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
                href="index.html"
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200"
              >
                Späť na úvod
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Zobrazenie registračného formulára
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto">
      <div className="w-full max-w-md mt-20 mb-10 p-4">
        <div className="bg-white p-8 rounded-lg shadow-xl w-full">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap" role="alert">
              {error}
            </div>
          )}
          <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">Registrácia na turnaj</h1>
          <form onSubmit={handleRegister} className="space-y-4">
              <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="reg-first-name">
                      Meno kontaktnej osoby
                  </label>
                  <input
                      type="text"
                      id="reg-first-name"
                      className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      placeholder="Zadajte svoje meno"
                      autoComplete="given-name"
                      disabled={loading || !!message}
                  />
              </div>
              <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="reg-last-name">
                      Priezvisko kontaktnej osoby
                  </label>
                  <input
                      type="text"
                      id="reg-last-name"
                      className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      placeholder="Zadajte svoje priezvisko"
                      autoComplete="family-name"
                      disabled={loading || !!message}
                  />
              </div>
              <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="reg-phone-number">Telefónne číslo kontaktnej osoby</label>
                  <input
                      type="tel"
                      id="reg-phone-number"
                      className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                      value={contactPhoneNumber}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '') {
                          setContactPhoneNumber('');
                          e.target.setCustomValidity('');
                          return;
                        }
                        if (value.length === 1 && value !== '+') {
                          e.target.setCustomValidity("Telefónne číslo musí začínať znakom '+'.");
                          e.target.reportValidity();
                          return;
                        }
                        if (value.length > 1 && !/^\+\d*$/.test(value)) {
                          e.target.setCustomValidity("Za znakom '+' sú povolené iba číslice.");
                          e.target.reportValidity();
                          return;
                        }
                        setContactPhoneNumber(value);
                        e.target.setCustomValidity('');
                      }}
                      onInvalid={(e) => {
                          if (e.target.value.length === 0) {
                            e.target.setCustomValidity("Prosím, vyplňte toto pole.");
                          } else if (e.target.value.length === 1 && e.target.value !== '+') {
                            e.target.setCustomValidity("Telefónne číslo musí začínať znakom '+'.");
                          } else if (e.target.value.length > 1 && !/^\+\d*$/.test(e.target.value)) {
                            e.target.setCustomValidity("Za znakom '+' sú povolené iba číslice.");
                          } else {
                            e.target.setCustomValidity("Telefónne číslo musí začínať znakom '+' a obsahovať iba číslice (napr. +421901234567).");
                          }
                      }}
                      required
                      placeholder="+421901234567"
                      pattern="^\+\d+$"
                      title="Telefónne číslo musí začínať znakom '+' a obsahovať iba číslice (napr. +421901234567)."
                      disabled={loading || !!message}
                  />
              </div>
              <p className="text-gray-600 text-sm -mt-2">
                  E-mailová adresa bude slúžiť na všetku komunikáciu súvisiacu s turnajom - zasielanie informácií, faktúr atď.
              </p>
              <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="reg-email">E-mailová adresa kontaktnej osoby</label>
                  <input
                      type="email"
                      id="reg-email"
                      className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="Zadajte svoju e-mailovú adresu"
                      autoComplete="email"
                      disabled={loading || !!message}
                  />
              </div>
              <p className="text-gray-600 text-sm">
                  Vytvorenie hesla umožní neskorší prístup k registračnému formuláru, v prípade potreby úpravy alebo doplnenia poskytnutých údajov.
              </p>
              <PasswordInput
                  id="reg-password"
                  label="Heslo"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onCopy={(e) => e.preventDefault()}
                  onPaste={(e) => e.preventDefault()}
                  onCut={(e) => e.preventDefault()}
                  placeholder="Zvoľte heslo (min. 10 znakov)"
                  autoComplete="new-password"
                  showPassword={showPasswordReg}
                  toggleShowPassword={() => setShowPasswordReg(!showPasswordReg)}
                  disabled={loading || !!message}
                  description={
                    <>
                      Heslo musí obsahovať:
                      <ul className="list-disc list-inside ml-4">
                          <li>aspoň jedno malé písmeno,</li>
                          <li>aspoň jedno veľké písmeno,</li>
                          <li>aspoň jednu číslicu.</li>
                      </ul>
                    </>
                  }
              />
              <PasswordInput
                  id="reg-confirm-password"
                  label="Potvrďte heslo"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onCopy={(e) => e.preventDefault()}
                  onPaste={(e) => e.preventDefault()}
                  onCut={(e) => e.preventDefault()}
                  placeholder="Potvrďte heslo"
                  autoComplete="new-password"
                  showPassword={showConfirmPasswordReg}
                  toggleShowPassword={() => setShowConfirmPasswordReg(!showConfirmPasswordReg)}
                  disabled={loading || !!message}
              />
              <button
                  type="submit"
                  className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200"
                  disabled={loading || !!message}
              >
                  {loading ? (
                      <div className="flex items-center justify-center">
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Registrujem...
                      </div>
                  ) : 'Registrovať sa'}
              </button>
          </form>
        </div>
      </div>
    </div>
  );
}
