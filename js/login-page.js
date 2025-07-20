// js/login-page.js

function LoginPage() {
  // Získajte auth, loading, setLoading, setMessage, setError, isAuthReady, user z AuthContext
  const { auth, loading, setLoading, setMessage, setError, isAuthReady, user } = useAuth();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);

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

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      await auth.signInWithEmailAndPassword(email, password);
      setMessage('Prihlásenie úspešné! Presmeruvávam...');
      setTimeout(() => {
        window.location.href = 'logged-in.html';
      }, 1000);
    } catch (err) {
      console.error("Chyba pri prihlasovaní:", err);
      let errorMessage = 'Nastala chyba pri prihlasovaní.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        errorMessage = 'Nesprávny email alebo heslo.';
      } else if (err.code === 'auth/too-many-requests') {
        errorMessage = 'Príliš veľa neúspešných pokusov o prihlásenie. Skúste to neskôr alebo resetujte heslo.';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'Neplatný formát emailu.';
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
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
        'Prihlásenie'
      ),
      React.createElement(
        'form',
        { onSubmit: handleLogin },
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
            autoComplete: 'username',
          })
        ),
        React.createElement(PasswordInput, {
          id: 'password',
          label: 'Heslo',
          value: password,
          onChange: (e) => setPassword(e.target.value),
          placeholder: 'Vaše heslo',
          autoComplete: 'current-password',
          showPassword: showPassword,
          toggleShowPassword: () => setShowPassword(!showPassword),
          disabled: loading,
        }),
        React.createElement(
          'div',
          { className: 'flex items-center justify-between mt-6' },
          React.createElement(
            'button',
            {
              type: 'submit',
              className: 'bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200',
              disabled: loading,
            },
            loading ? 'Prihlasujem...' : 'Prihlásiť sa'
          ),
          React.createElement(
            'a',
            { href: 'register.html', className: 'inline-block align-baseline font-bold text-sm text-blue-600 hover:text-blue-800' },
            'Nemáte účet? Zaregistrujte sa'
          )
        )
      )
    )
  );
}

// Render the LoginPage component
document.addEventListener('DOMContentLoaded', () => {
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(AuthProvider, null, React.createElement(LoginPage, null)));
});
