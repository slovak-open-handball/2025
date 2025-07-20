// js/admin-register-page.js

function AdminRegisterPage() {
  // Získajte auth, db, loading, setLoading, setMessage, setError, isAuthReady, user, isAdmin, isRoleLoaded z AuthContext
  const { auth, db, loading, setLoading, setMessage, setError, isAuthReady, user, isAdmin, isRoleLoaded } = useAuth();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [passwordError, setPasswordError] = React.useState('');
  const [adminExists, setAdminExists] = React.useState(false);

  React.useEffect(() => {
    if (!db) return; // Ensure Firestore is initialized
    const checkAdminStatus = async () => {
      try {
        const adminSnapshot = await db.collection('users').where('role', '==', 'admin').limit(1).get();
        setAdminExists(!adminSnapshot.empty);
      } catch (err) {
        console.error("Chyba pri kontrole existencie admina:", err);
      }
    };
    checkAdminStatus();
  }, [db]);

  // Presmerovanie, ak je prihlásený ako administrátor alebo ak žiadny administrátor neexistuje (aby sa zabránilo ne-adminovi vo vytváraní)
  React.useEffect(() => {
    if (isAuthReady && isRoleLoaded) {
      if (user && isAdmin) {
        setMessage('Už ste prihlásení ako administrátor.');
        setTimeout(() => window.location.href = 'logged-in.html', 1500);
      } else if (user && !isAdmin) {
        setError('Nemáte oprávnenie na registráciu administrátora.');
        setTimeout(() => window.location.href = 'index.html', 1500);
      }
      // Ak žiadny používateľ a administrátor už existuje, presmerovať na prihlásenie
      if (!user && adminExists && isRoleLoaded) {
        setError('Administrátor už existuje. Prihláste sa prosím.');
        setTimeout(() => window.location.href = 'login.html', 1500);
      }
    }
  }, [user, isAdmin, isAuthReady, isRoleLoaded, adminExists, setError, setMessage]);


  const handleAdminRegister = async (e) => {
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

    try {
      // Povoliť registráciu administrátora len vtedy, ak žiadny administrátor neexistuje
      const adminSnapshot = await db.collection('users').where('role', '==', 'admin').limit(1).get();
      if (!adminSnapshot.empty) {
        setError('Administrátor už existuje. Nového administrátora nemôžete zaregistrovať týmto spôsobom.');
        setLoading(false);
        return;
      }

      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      await db.collection('users').doc(userCredential.user.uid).set({
        email: email,
        role: 'admin',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      setMessage('Administrátor úspešne zaregistrovaný a prihlásený!');
      setTimeout(() => {
        window.location.href = 'logged-in.html';
      }, 1000);

    } catch (err) {
      console.error("Chyba pri registrácii administrátora:", err);
      let errorMessage = 'Nastala chyba pri registrácii administrátora.';
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
    }
  };

  // Zobrazenie načítavacej obrazovky, kým nie je overený stav autentifikácie a roly
  if (!isAuthReady || !isRoleLoaded || (user && isAdmin) || (adminExists && !user)) {
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
        'Registrácia Administrátora'
      ),
      !adminExists ?
        React.createElement(
          'p',
          { className: 'text-green-600 text-center mb-4' },
          'Žiadny administrátor neexistuje. Môžete vytvoriť prvého administrátora.'
        ) :
        React.createElement(
          'p',
          { className: 'text-red-600 text-center mb-4' },
          'Administrátor už existuje. Túto stránku by ste nemali vidieť, ak nie ste prihlásený ako admin.'
        ),
      adminExists && !isAdmin && React.createElement('div', { className: 'text-red-600 text-center mb-4' }, 'Nemáte oprávnenie na prístup.'),
      !adminExists &&
        React.createElement(
          'form',
          { onSubmit: handleAdminRegister },
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
              placeholder: 'Email administrátora',
              value: email,
              onChange: (e) => setEmail(e.target.value),
              required: true,
              autoComplete: 'email',
              disabled: loading,
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
            disabled: loading,
            description: passwordError || 'Heslo musí mať aspoň 8 znakov, veľké a malé písmeno, číslo a špeciálny znak.',
          }),
          React.createElement(PasswordInput, {
            id: 'confirm-password',
            label: 'Potvrdiť Heslo',
            value: confirmPassword,
            onChange: (e) => setConfirmPassword(e.target.value),
            placeholder: 'Zopakujte heslo',
            autoComplete: 'new-password',
            showPassword: showPassword,
            toggleShowPassword: () => setShowPassword(!showPassword),
            disabled: loading,
          }),
          passwordError && React.createElement('p', { className: 'text-red-500 text-sm mb-4' }, passwordError),
          error && React.createElement('p', { className: 'text-red-500 text-sm mb-4' }, error),
          message && React.createElement('p', { className: 'text-green-600 text-sm mb-4' }, message),
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
              loading ? 'Registrujem...' : 'Vytvoriť Administrátora'
            )
          )
        )
    )
  );
}

// Render the AdminRegisterPage component
document.addEventListener('DOMContentLoaded', () => {
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(AuthProvider, null, React.createElement(AdminRegisterPage, null)));
});
