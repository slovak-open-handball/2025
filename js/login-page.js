// js/login-page.js

function LoginPage() {
  // Získajte auth, loading, setLoading, setMessage, setError, isAuthReady, user z AuthContext
  const { auth, loading, setLoading, setMessage, setError, isAuthReady, user } = useAuth();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);

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
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">Prihlásenie</h2>
        <form onSubmit={handleLogin}>
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
              autoComplete="username"
            />
          </div>
          <PasswordInput
            id="password"
            label="Heslo"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Vaše heslo"
            autoComplete="current-password"
            showPassword={showPassword}
            toggleShowPassword={() => setShowPassword(!showPassword)}
            disabled={loading}
          />
          <div className="flex items-center justify-between mt-6">
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200"
              disabled={loading}
            >
              {loading ? 'Prihlasujem...' : 'Prihlásiť sa'}
            </button>
            <a href="register.html" className="inline-block align-baseline font-bold text-sm text-blue-600 hover:text-blue-800">
              Nemáte účet? Zaregistrujte sa
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}

// Render the LoginPage component
document.addEventListener('DOMContentLoaded', () => {
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(AuthProvider, null, React.createElement(LoginPage, null)));
});
