// js/register-page.js

function RegisterPage() {
  const { auth, db, loading, setLoading, setMessage, setError, isRegistrationOpen, isAuthReady, user, countdown } = useAuth();

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [passwordError, setPasswordError] = React.useState('');
  const [recaptchaToken, setRecaptchaToken] = React.useState('');

  // Expose setRecaptchaToken globally for the reCAPTCHA callback
  React.useEffect(() => {
    window._setRecaptchaTokenFromPage = setRecaptchaToken;
    return () => {
      delete window._setRecaptchaTokenFromPage; // Clean up on unmount
    };
  }, [setRecaptchaToken]);

  // Volanie updateHeaderLinks po inicializácii Firebase a overení stavu autentifikácie
  React.useEffect(() => {
    if (isAuthReady) {
      // Funkcia updateHeaderLinks je globálne dostupná
      if (typeof updateHeaderLinks === 'function') {
        updateHeaderLinks();
      } else {
        console.warn("Global updateHeaderLinks function not found.");
      }
    }
  }, [isAuthReady, user]); // Závisí od isAuthReady a user na aktualizáciu odkazov

  // Presmerovanie, ak je používateľ už prihlásený
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
      // Overenie reCAPTCHA na strane servera (simulácia - v produkcii by to mal byť váš backend)
      // Kvôli 'no-cors' nemôžeme priamo čítať odpoveď.
      // Predpokladáme úspech alebo sa spoliehame na server-side logovanie.
      // Realisticky by sme mali mať proxy alebo povolený CORS na Apps Script.
      // Pre demonštráciu to budeme predpokladať ako úspešné.
      // Ak by sa reCaptcha overovala na vašom backend serveri, tu by ste poslali token na váš server.
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

      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      await db.collection('users').doc(userCredential.user.uid).set({
        email: email,
        role: 'user', // Predvolená rola
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
      // Reset reCAPTCHA pre ďalší pokus
      if (window.grecaptcha && typeof window.grecaptcha.reset === 'function') {
         window.grecaptcha.reset();
         setRecaptchaToken(''); // Vyčistiť token po použití
      }
    }
  };

  // Zobrazenie načítavacej obrazovky, kým nie je overený stav autentifikácie
  if (!isAuthReady || (user && isAuthReady)) {
    return React.createElement(
      'div',
      { className: 'flex justify-center items-center h-screen-minus-header' },
      React.createElement(
        'div',
        { className: 'text-center' },
        React.createElement(
          'p',
          { className: 'text-xl font-semibold text-gray-700' },
          'Načítavam aplikáciu...'
        ),
        React.createElement('div', { className: 'animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mt-4' })
      )
    );
  }

  return React.createElement(
    'div',
    { className: 'flex justify-center items-center min-h-screen bg-gray-100 p-4' },
    React.createElement(
      'div',
      { className: 'bg-white p-8 rounded-lg shadow-lg w-full max-w-md' },
      React.createElement(
        'h2',
        { className: 'text-2xl font-bold text-center text-gray-800 mb-6' },
        'Registrácia'
      ),
      !isRegistrationOpen &&
        React.createElement(
          'div',
          { className: 'bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4', role: 'alert' },
          React.createElement('p', { className: 'font-bold' }, 'Registrácia je momentálne zatvorená.'),
          countdown && React.createElement('p', null, 'Registrácia začína za: ', countdown),
          React.createElement(
            'p',
            null,
            'Môžete sa vrátiť na ',
            React.createElement('a', { href: 'index.html', className: 'text-yellow-800 underline' }, 'domovskú stránku'),
            '.'
          )
        ),
      React.createElement(
        'form',
        { onSubmit: handleRegister },
        React.createElement(
          'div',
          { className: 'mb-4' },
          React.createElement(
            'label',
            { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'email' },
            'Email'
          ),
          React.createElement('input', {
            type: 'email',
            id: 'email',
            className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
            placeholder: 'Váš email',
            value: email,
            onChange: (e) => setEmail(e.target.value),
            required: true,
            autoComplete: 'email',
            disabled: loading || !isRegistrationOpen,
          })
        ),
        React.createElement(PasswordInput, {
          id: 'password',
          label: 'Heslo',
          value: password,
          onChange: (e) => setPassword(e.target.value),
          placeholder: 'Min. 8 znakov, veľké/malé písmeno, číslo, znak',
          autoComplete: 'new-password',
          showPassword: showPassword,
          toggleShowPassword: () => setShowPassword(!showPassword),
          disabled: loading || !isRegistrationOpen,
          description: passwordError || 'Heslo musí mať aspoň 8 znakov, veľké a malé písmeno, číslo a špeciálny znak.',
        }),
        React.createElement(PasswordInput, {
          id: 'confirm-password',
          label: 'Potvrdiť Heslo',
          value: confirmPassword,
          onChange: (e) => setConfirmPassword(e.target.value),
          placeholder: 'Zopakujte heslo',
          autoComplete: 'new-password',
          showPassword: showPassword, // Použite rovnaký stav pre potvrdenie
          toggleShowPassword: () => setShowPassword(!showPassword),
          disabled: loading || !isRegistrationOpen,
        }),
        passwordError && React.createElement('p', { className: 'text-red-500 text-sm mb-4' }, passwordError),
        error && React.createElement('p', { className: 'text-red-500 text-sm mb-4' }, error),
        message && React.createElement('p', { className: 'text-green-600 text-sm mb-4' }, message),
        React.createElement('div', { className: 'g-recaptcha', 'data-sitekey': RECAPTCHA_SITE_KEY, 'data-callback': 'setRecaptchaToken' }),
        /* Funkcia setRecaptchaToken je teraz definovaná globálne v register.html */
        React.createElement(
          'div',
          { className: 'flex items-center justify-between mt-6' },
          React.createElement(
            'button',
            {
              type: 'submit',
              className: 'bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200',
              disabled: loading || !isRegistrationOpen || !recaptchaToken,
            },
            loading ? 'Registrujem...' : 'Zaregistrovať sa'
          ),
          React.createElement(
            'a',
            { href: 'login.html', className: 'inline-block align-baseline font-bold text-sm text-blue-600 hover:text-blue-800' },
            'Už máte účet? Prihláste sa'
          )
        )
      )
    )
  );
}

// Render the RegisterPage component
document.addEventListener('DOMContentLoaded', () => {
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(AuthProvider, null, React.createElement(RegisterPage, null)));
});
