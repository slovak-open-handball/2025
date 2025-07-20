// js/register-page.js

function RegisterPage() {
  const { auth, db, loading, setLoading, setMessage, setError, isRegistrationOpen, isAuthReady, user, countdown } = useAuth();

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [passwordError, setPasswordError] = React.useState('');
  const [recaptchaToken, setRecaptchaToken] = React.useState('');

  // Redirect if already logged in
  React.useEffect(() => {
    if (user && isAuthReady) {
      window.location.href = 'logged-in.html';
    }
  }, [user, isAuthReady]);

  React.useEffect(() => {
    if (window.grecaptcha && recaptchaToken === '') {
      window.grecaptcha.ready(function() {
        window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'register' }).then(function(token) {
          setRecaptchaToken(token);
        });
      });
    }
  }, [recaptchaToken]); // Re-execute if token is cleared

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');
    setPasswordError('');

    if (password !== confirmPassword) {
      setPasswordError('Heslá sa nezhodujú.');
      setLoading(false);
      return;
    }

    const validationMsg = validatePassword(password);
    if (validationMsg) {
      setPasswordError(validationMsg);
      setLoading(false);
      return;
    }

    if (!recaptchaToken) {
      setError('reCAPTCHA token nebol získaný. Skúste to prosím znova.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors', // Dôležité pre Google Apps Script
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          action: 'verifyRecaptcha',
          token: recaptchaToken
        })
      });

      // Kvôli 'no-cors' nemôžeme priamo čítať odpoveď.
      // Predpokladáme úspech alebo sa spoliehame na server-side logovanie.
      // Realisticky by sme mali mať proxy alebo povolený CORS na Apps Script.
      // Pre demonštráciu to budeme predpokladať ako úspešné.
      // Ak by sa reCaptcha overovala na vašom backend serveri, tu by ste poslali token na váš server.

      // Namietko: Ak nemôžeme overiť, prejdeme ďalej, čo nie je ideálne pre bezpečnosť.
      // Pre produkciu by reCAPTCHA Overenie malo byť na serveri!

      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      await db.collection('users').doc(userCredential.user.uid).set({
        email: email,
        role: 'user', // Default role
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      setMessage('Registrácia úspešná! Boli ste prihlásení.');
      setTimeout(() => {
        window.location.href = 'logged-in.html';
      }, 1000);

    } catch (err) {
      console.error("Chyba pri registrácii:", err);
      let errorMessage = 'Nastala chyba pri registrácii.';
      if (err.code === 'auth/email-already-in-use') {
        errorMessage = 'Zadaný email už je zaregistrovaný.';
      } else if (err.code === 'auth/weak-password') {
        errorMessage = 'Heslo je príliš slabé.';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'Neplatný formát emailu.';
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
      // Reset reCAPTCHA for next attempt
      if (window.grecaptcha && typeof window.grecaptcha.reset === 'function') {
         window.grecaptcha.reset();
         setRecaptchaToken(''); // Clear token after use
      }
    }
  };

  if (!isAuthReady || (user && isAuthReady)) {
    return (
        <div className="flex justify-center items-center h-screen-minus-header">
          <div className="text-center">
            <p className="text-xl font-semibold text-gray-700">Načítavam aplikáciu...</p>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mt-4"></div>
          </div>
        </div>
    );
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">Registrácia</h2>
        {!isRegistrationOpen && (
          <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4" role="alert">
            <p className="font-bold">Registrácia je momentálne zatvorená.</p>
            {countdown && <p>Registrácia začína za: {countdown}</p>}
            <p>Môžete sa vrátiť na <a href="index.html" className="text-yellow-800 underline">domovskú stránku</a>.</p>
          </div>
        )}

        <form onSubmit={handleRegister}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
              placeholder="Váš email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={loading || !isRegistrationOpen}
            />
          </div>
          <PasswordInput
            id="password"
            label="Heslo"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min. 8 znakov, veľké/malé písmeno, číslo, znak"
            autoComplete="new-password"
            showPassword={showPassword}
            toggleShowPassword={() => setShowPassword(!showPassword)}
            disabled={loading || !isRegistrationOpen}
            description={passwordError || "Heslo musí mať aspoň 8 znakov, veľké a malé písmeno, číslo a špeciálny znak."}
          />
          <PasswordInput
            id="confirm-password"
            label="Potvrdiť Heslo"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Zopakujte heslo"
            autoComplete="new-password"
            showPassword={showPassword} // Use the same showPassword state for both
            toggleShowPassword={() => setShowPassword(!showPassword)}
            disabled={loading || !isRegistrationOpen}
          />

          {passwordError && <p className="text-red-500 text-sm mb-4">{passwordError}</p>}
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          {message && <p className="text-green-600 text-sm mb-4">{message}</p>}

          <div className="g-recaptcha" data-sitekey={RECAPTCHA_SITE_KEY} data-callback="setRecaptchaToken"></div>
          {/* Note: The setRecaptchaToken function needs to be globally accessible if data-callback is used */}
          {/* For React, it's better to render the script and use ref or onload callback to get token */}
          {/* For simplicity with direct ReactDOM.render, let's assume global access or manual token handling */}
          {/* For this example, we'll ensure window.setRecaptchaToken exists or adjust if using modules */}
            <script>
                // This function needs to be globally available for reCAPTCHA to call it
                window.setRecaptchaToken = function(token) {
                    const rootInstance = ReactDOM.createRoot(document.getElementById('root'));
                    rootInstance.render(React.createElement(AuthProvider, null, React.createElement(RegisterPage, { initialRecaptchaToken: token })));
                };
            </script>


          <div className="flex items-center justify-between mt-6">
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200"
              disabled={loading || !isRegistrationOpen || !recaptchaToken}
            >
              {loading ? 'Registrujem...' : 'Zaregistrovať sa'}
            </button>
            <a href="login.html" className="inline-block align-baseline font-bold text-sm text-blue-600 hover:text-blue-800">
              Už máte účet? Prihláste sa
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}

// Render the RegisterPage component
document.addEventListener('DOMContentLoaded', () => {
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(AuthProvider, null, React.createElement(RegisterPage, null)));
});
