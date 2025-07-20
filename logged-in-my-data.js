// Global application ID and Firebase configuration (should be consistent across all React apps)
const appId = '1:26454452024:web:6954b4f90f87a3a1eb43cd';
const firebaseConfig = {
  apiKey: "AIzaSyDj_bSTkjrquu1nyIVYW7YLbyBl1pD6YYo",
  authDomain: "prihlasovanie-4f3f3.firebaseapp.com",
  projectId: "prihlasovanie-4f3f3",
  storageBucket: "prihlasovanie-4f3f3.firebasestorage.app",
  messagingSenderId: "26454452024",
  appId: "1:26454452024:web:6954b4f90f87a3a1eb43cd"
};
const initialAuthToken = null; // Global authentication token

// NotificationModal Component for displaying temporary messages (converted to React.createElement)
function NotificationModal({ message, onClose }) {
  const [show, setShow] = React.useState(false);
  const timerRef = React.useRef(null);

  React.useEffect(() => {
    if (message) {
      setShow(true);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        setShow(false);
        setTimeout(onClose, 500);
      }, 10000);
    } else {
      setShow(false);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [message, onClose]);

  if (!show && !message) return null;

  return React.createElement(
    'div',
    {
      className: `fixed top-0 left-0 right-0 z-50 flex justify-center p-4 transition-transform duration-500 ease-out ${
        show ? 'translate-y-0' : '-translate-y-full'
      }`,
      style: { pointerEvents: 'none' }
    },
    React.createElement(
      'div',
      {
        className: 'bg-[#3A8D41] text-white px-6 py-3 rounded-lg shadow-lg max-w-md w-full text-center',
        style: { pointerEvents: 'auto' }
      },
      React.createElement('p', { className: 'font-semibold' }, message)
    )
  );
}

// Main React component for the logged-in-my-data.html page
function MyDataApp() {
  const [app, setApp] = React.useState(null);
  const [auth, setAuth] = React.useState(null);
  const [db, setDb] = React.useState(null);
  const [user, setUser] = React.useState(null);
  const [isAuthReady, setIsAuthReady] = React.useState(false); // Indicates if auth state has been determined
  const [pageLoading, setPageLoading] = React.useState(true); // Initial page loading state
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');

  const [userData, setUserData] = React.useState(null);
  const [isAdmin, setIsAdmin] = React.useState(false); // State for isAdmin

  // Effect for Firebase initialization and Auth Listener setup
  React.useEffect(() => {
    let unsubscribeAuth;
    let unsubscribeFirestore = null;
    console.log("MyDataApp: useEffect spustený.");

    try {
      if (typeof firebase === 'undefined') {
        console.error("MyDataApp: Firebase SDK nie je načítané. Skontrolujte logged-in-my-data.html.");
        setError("Firebase SDK nie je načítané.");
        setPageLoading(false);
        return;
      }

      let firebaseAppInstance;
      try {
        firebaseAppInstance = firebase.app(); // Try to get default app instance
        console.log("MyDataApp: Získaná existujúca Firebase app inštancia.");
      } catch (e) {
        // If default app doesn't exist, initialize it with a specific name
        firebaseAppInstance = firebase.initializeApp(firebaseConfig, 'mydataApp');
        console.log("MyDataApp: Inicializovaná nová Firebase app inštancia s názvom 'mydataApp'.");
      }
      setApp(firebaseAppInstance);

      const authInstance = firebase.auth(firebaseAppInstance);
      setAuth(authInstance);
      const firestoreInstance = firebase.firestore(firebaseAppInstance);
      setDb(firestoreInstance);
      console.log("MyDataApp: Firebase Auth a Firestore inštancie nastavené.");

      // Listen for auth state changes
      unsubscribeAuth = authInstance.onAuthStateChanged(async (currentUser) => {
        console.log("MyDataApp: onAuthStateChanged volaný. currentUser:", currentUser ? currentUser.uid : "null");
        setUser(currentUser); // Set user state
        setIsAuthReady(true); // Auth state has been determined

        if (!currentUser) {
            // User is NOT authenticated, redirect to login page
            console.log("MyDataApp: Používateľ nie je prihlásený, presmerovanie na login.html.");
            window.location.href = 'login.html';
            setPageLoading(false); // Stop loading as we are redirecting
            return;
        }

        // User IS authenticated
        console.log("MyDataApp: Používateľ je prihlásený. Načítavam dáta z Firestore.");
        // Fetch user data from Firestore
        if (firestoreInstance) {
            const userDocRef = firestoreInstance.collection('users').doc(currentUser.uid);
            unsubscribeFirestore = userDocRef.onSnapshot(docSnapshot => {
                console.log("MyDataApp: Firestore onSnapshot pre používateľské dáta.");
                if (docSnapshot.exists) {
                    const data = docSnapshot.data();
                    setUserData(data);
                    setIsAdmin(data.role === 'admin'); // Set isAdmin state
                    setPageLoading(false); // Data loaded, stop page loading
                    console.log("MyDataApp: Používateľské dáta načítané a pageLoading nastavené na false.");
                } else {
                    console.warn("MyDataApp: Používateľský dokument sa nenašiel vo Firestore. Vynútené odhlásenie.");
                    setError("Používateľské dáta sa nenašli. Kontaktujte podporu.");
                    authInstance.signOut(); // Force logout if data is missing
                    setPageLoading(false); // Stop page loading
                }
            }, err => {
                console.error("MyDataApp: Chyba pri načítaní používateľských dát z Firestore:", err);
                setError(`Chyba pri načítaní dát: ${err.message}`);
                authInstance.signOut(); // Force logout on Firestore error
                setPageLoading(false); // Stop page loading
            });
        } else {
            console.warn("MyDataApp: Firestore inštancia nie je dostupná po prihlásení.");
            setError("Chyba: Databázové služby nie sú dostupné.");
            setPageLoading(false);
        }
      });

      // Attempt initial sign-in if token exists (this is non-blocking for onAuthStateChanged)
      if (initialAuthToken) {
        console.log("MyDataApp: Pokus o prihlásenie s initialAuthToken.");
        authInstance.signInWithCustomToken(initialAuthToken).catch(e => {
          console.error("MyDataApp: Chyba pri počiatočnom prihlásení Firebase s tokenom:", e);
        });
      }
      console.log("MyDataApp: useEffect nastavený.");

      return () => {
        // Cleanup function for both auth and firestore listeners
        console.log("MyDataApp: Cleanup funkcia spustená.");
        if (unsubscribeAuth) {
          unsubscribeAuth();
          console.log("MyDataApp: onAuthStateChanged odhlásený.");
        }
        if (unsubscribeFirestore) {
          unsubscribeFirestore();
          console.log("MyDataApp: Firestore onSnapshot odhlásený.");
        }
      };
    }
    catch (e) {
      console.error("MyDataApp: Nepodarilo sa inicializovať Firebase v useEffect:", e);
      setError(`Chyba pri inicializácii Firebase: ${e.message}`);
      setPageLoading(false);
      window.location.href = 'login.html'; // Redirect on critical Firebase init error
    }
  }, []); // Empty dependency array - runs only once on component mount

  // Display initial page loading state
  // We wait for isAuthReady to be true before deciding to show content or redirect.
  if (pageLoading || !isAuthReady) {
    console.log("MyDataApp: Zobrazujem načítavaciu obrazovku. pageLoading:", pageLoading, "isAuthReady:", isAuthReady);
    return React.createElement(
      'div',
      { className: 'flex items-center justify-center min-h-screen bg-gray-100' },
      React.createElement('div', { className: 'text-xl font-semibold text-gray-700' }, 'Načítavam údaje...')
    );
  }

  // If user is null AFTER isAuthReady is true, it means onAuthStateChanged determined no user is logged in.
  // The redirect should have already happened in the onAuthStateChanged callback.
  // This block acts as a safeguard, though ideally, it shouldn't be reached if the redirect works.
  if (!user) {
    console.log("MyDataApp: Používateľ je null po inicializácii isAuthReady. Presmerovanie by už malo prebehnúť.");
    return null; // Don't render anything, as a redirect should have occurred.
  }

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
    React.createElement(NotificationModal, {
      message: message,
      onClose: () => setMessage('')
    }),
    React.createElement(
      'div',
      { className: 'w-full max-w-2xl mt-20 mb-10 p-4' },
      React.createElement(
        'div',
        { className: 'bg-white p-8 rounded-lg shadow-xl w-full' },
        error && React.createElement(
          'div',
          { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap', role: 'alert' },
          error
        ),
        React.createElement('h1', { className: 'text-3xl font-bold text-center text-gray-800 mb-6' }, 'Moje údaje'),

        // Display Profile Information
        React.createElement('h2', { className: 'text-2xl font-semibold text-gray-800 mb-4' }, 'Informácie o profile'),
        React.createElement(
          'div',
          { className: 'space-y-4 mb-8' },
          React.createElement(
            'div',
            null,
            React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2' }, 'Meno'),
            React.createElement('p', { className: 'bg-gray-100 p-3 rounded-lg text-gray-800' }, userData?.firstName || 'Nezadané')
          ),
          React.createElement(
            'div',
            null,
            React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2' }, 'Priezvisko'),
            React.createElement('p', { className: 'bg-gray-100 p-3 rounded-lg text-gray-800' }, userData?.lastName || 'Nezadané')
          ),
          // Conditional display for phone number based on isAdmin
          !isAdmin && React.createElement(
            'div',
            null,
            React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2' }, 'Telefónne číslo'),
            React.createElement('p', { className: 'bg-gray-100 p-3 rounded-lg text-gray-800' }, userData?.contactPhoneNumber || 'Nezadané')
          ),
          React.createElement(
            'div',
            null,
            React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2' }, 'E-mailová adresa'),
            React.createElement('p', { className: 'bg-gray-100 p-3 rounded-lg text-gray-800' }, user?.email || 'Neznámy e-mail')
          ),
          React.createElement(
            'div',
            null,
            React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2' }, 'Rola'),
            React.createElement('p', { className: 'bg-gray-100 p-3 rounded-lg text-gray-800' }, isAdmin ? 'Administrátor' : 'Používateľ')
          ),
          React.createElement(
            'div',
            null,
            React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2' }, 'Zobrazovať notifikácie'),
            React.createElement('p', { className: 'bg-gray-100 p-3 rounded-lg text-gray-800' }, userData?.displayNotifications ? 'Áno' : 'Nie')
          )
        )
      )
    )
  );
}
