// js/logged-in-page.js

function LoggedInPage() {
  const { user, isAdmin, isAuthReady, isRoleLoaded, setLoading, setError, setMessage, userNotifications } = useAuth();
  const [profileView, setProfileView] = React.useState('my-data');

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

  React.useEffect(() => {
    if (isAuthReady && !user) {
      window.location.href = 'login.html'; // Presmerovať na prihlasovaciu stránku, ak nie je overený
    }
  }, [user, isAuthReady]);

  React.useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.substring(1); // Odstráňte '#'
      if (hash) {
        setProfileView(hash);
      } else {
        setProfileView('my-data'); // Predvolené zobrazenie
      }
    };

    handleHashChange(); // Nastavte počiatočné zobrazenie
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Všimnite si, že getInitialProfileView už nie je potrebná v tomto useEffect,
  // pretože handleHashChange sa volá pri inicializácii a pri zmene hashu.
  // Ale pre istotu, ak by sa hash zmenil pred isAuthReady, alebo pre priame URL
  // bez hashu, môžeme mať fallback.
  React.useEffect(() => {
    if (isAuthReady && isRoleLoaded) {
      // Ak používateľ nie je administrátor a pokúša sa získať prístup k admin-panelu, presmerujte na my-data
      if (!isAdmin && profileView === 'admin-panel') {
        window.location.hash = '#my-data';
        setProfileView('my-data');
      }
    }
  }, [profileView, isAdmin, isAuthReady, isRoleLoaded]);


  if (!isAuthReady || !isRoleLoaded || !user) {
    return React.createElement(
        'div',
        { className: 'flex justify-center items-center h-screen-minus-header' },
        React.createElement(
          'div',
          { className: 'text-center' },
          React.createElement(
            'p',
            { className: 'text-xl font-semibold text-gray-700' },
            'Načítavam užívateľské dáta...'
          ),
          React.createElement('div', { className: 'animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mt-4' })
        )
    );
  }

  const renderProfileView = () => {
    switch (profileView) {
      case 'my-data':
        return React.createElement(MyDataComponent, {
          setLoading, setError, setMessage
        });
      case 'change-password':
        return React.createElement(ChangePasswordComponent, {
          setLoading, setError, setMessage
        });
      case 'admin-panel':
        return isAdmin ? React.createElement(AdminPanelComponent, {
          setLoading, setError, setMessage
        }) : null; // Malo by byť spracované presmerovaním cez useEffect
      case 'notifications':
        return React.createElement(NotificationsComponent, {
          userNotifications,
          setLoading, setError, setMessage,
          fetchNotifications: useAuth().fetchNotifications // Pre odoslanie funkcie na refresh
        });
      default:
        return React.createElement(MyDataComponent, {
          setLoading, setError, setMessage
        });
    }
  };

  return React.createElement(
    'div',
    { className: 'container mx-auto p-4 pt-8' },
    React.createElement(
      'h1',
      { className: 'text-3xl font-bold text-center text-blue-800 mb-6' },
      'Moja zóna'
    ),
    React.createElement(
      'div',
      { className: 'flex flex-col md:flex-row gap-4 mb-6' },
      React.createElement(
        'nav',
        { className: 'md:w-1/4 bg-white p-4 rounded-lg shadow-lg' },
        React.createElement(
          'ul',
          { className: 'space-y-2' },
          React.createElement(
            'li',
            null,
            React.createElement(
              'a',
              {
                href: '#my-data',
                className: `block px-4 py-2 rounded-lg transition-colors duration-200 ${
                  profileView === 'my-data' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-200'
                }`,
              },
              'Moje údaje'
            )
          ),
          React.createElement(
            'li',
            null,
            React.createElement(
              'a',
              {
                href: '#change-password',
                className: `block px-4 py-2 rounded-lg transition-colors duration-200 ${
                  profileView === 'change-password' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-200'
                }`,
              },
              'Zmena hesla'
            )
          ),
          React.createElement(
            'li',
            null,
            React.createElement(
              'a',
              {
                href: '#notifications',
                className: `block px-4 py-2 rounded-lg transition-colors duration-200 ${
                  profileView === 'notifications' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-200'
                }`,
              },
              'Notifikácie ',
              userNotifications.length > 0 &&
                React.createElement(
                  'span',
                  { className: 'ml-2 px-2 py-1 bg-red-500 text-white rounded-full text-xs' },
                  userNotifications.length
                )
            )
          ),
          isAdmin &&
            React.createElement(
              'li',
              null,
              React.createElement(
                'a',
                {
                  href: '#admin-panel',
                  className: `block px-4 py-2 rounded-lg transition-colors duration-200 ${
                    profileView === 'admin-panel' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-200'
                  }`,
                },
                'Admin panel'
              )
            )
        )
      ),
      React.createElement(
        'main',
        { className: 'md:w-3/4 bg-white p-6 rounded-lg shadow-lg' },
        renderProfileView()
      )
    )
  );
}

// Render the LoggedInPage component
document.addEventListener('DOMContentLoaded', () => {
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(AuthProvider, null, React.createElement(LoggedInPage, null)));
});
