// js/logged-in-page.js

function LoggedInPage() {
  const { user, isAdmin, isAuthReady, isRoleLoaded, setLoading, setError, setMessage, userNotifications } = useAuth();
  const [profileView, setProfileView] = React.useState('my-data');

  React.useEffect(() => {
    if (isAuthReady && !user) {
      window.location.href = 'login.html'; // Redirect to login if not authenticated
    }
  }, [user, isAuthReady]);

  React.useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.substring(1); // Remove the '#'
      if (hash) {
        setProfileView(hash);
      } else {
        setProfileView('my-data'); // Default view
      }
    };

    handleHashChange(); // Set initial view
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const getInitialProfileView = (hash) => {
    if (!hash) {
      return 'my-data';
    }
    const cleanHash = hash.substring(1);
    if (['my-data', 'change-password', 'notifications'].includes(cleanHash)) {
      return cleanHash;
    }
    if (cleanHash === 'admin-panel' && isAdmin) {
      return 'admin-panel';
    }
    return 'my-data'; // Fallback
  };

  React.useEffect(() => {
    if (isAuthReady && isRoleLoaded) {
      // If user is not admin and tries to access admin-panel, redirect to my-data
      if (!isAdmin && profileView === 'admin-panel') {
        window.location.hash = '#my-data';
        setProfileView('my-data');
      }
    }
  }, [profileView, isAdmin, isAuthReady, isRoleLoaded]);


  if (!isAuthReady || !isRoleLoaded || !user) {
    return (
        <div className="flex justify-center items-center h-screen-minus-header">
          <div className="text-center">
            <p className="text-xl font-semibold text-gray-700">Načítavam užívateľské dáta...</p>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mt-4"></div>
          </div>
        </div>
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
        }) : null; // Should be handled by useEffect redirect
      case 'notifications':
        return React.createElement(NotificationsComponent, {
          userNotifications,
          setLoading, setError, setMessage
        });
      default:
        return React.createElement(MyDataComponent, {
          setLoading, setError, setMessage
        });
    }
  };

  return (
    <div className="container mx-auto p-4 pt-8">
      <h1 className="text-3xl font-bold text-center text-blue-800 mb-6">Moja zóna</h1>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <nav className="md:w-1/4 bg-white p-4 rounded-lg shadow-lg">
          <ul className="space-y-2">
            <li>
              <a
                href="#my-data"
                className={`block px-4 py-2 rounded-lg transition-colors duration-200 ${
                  profileView === 'my-data' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                Moje údaje
              </a>
            </li>
            <li>
              <a
                href="#change-password"
                className={`block px-4 py-2 rounded-lg transition-colors duration-200 ${
                  profileView === 'change-password' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                Zmena hesla
              </a>
            </li>
            <li>
              <a
                href="#notifications"
                className={`block px-4 py-2 rounded-lg transition-colors duration-200 ${
                  profileView === 'notifications' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                Notifikácie {userNotifications.length > 0 && <span className="ml-2 px-2 py-1 bg-red-500 text-white rounded-full text-xs">{userNotifications.length}</span>}
              </a>
            </li>
            {isAdmin && (
              <li>
                <a
                  href="#admin-panel"
                  className={`block px-4 py-2 rounded-lg transition-colors duration-200 ${
                    profileView === 'admin-panel' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Admin panel
                </a>
              </li>
            )}
          </ul>
        </nav>

        <main className="md:w-3/4 bg-white p-6 rounded-lg shadow-lg">
          {renderProfileView()}
        </main>
      </div>
    </div>
  );
}

// Render the LoggedInPage component
document.addEventListener('DOMContentLoaded', () => {
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(AuthProvider, null, React.createElement(LoggedInPage, null)));
});
