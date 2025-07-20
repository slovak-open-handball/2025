// js/AuthContext.js

// Initialize Firebase once globally
firebase.initializeApp(FIREBASE_CONFIG);
const app = firebase.app();
const auth = firebase.auth();
const db = firebase.firestore();
// const functions = firebase.functions(); // Uncomment if you use Firebase Functions

const AuthContext = React.createContext();

function AuthProvider({ children }) {
  const [user, setUser] = React.useState(null);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [isAuthReady, setIsAuthReady] = React.useState(false);
  const [isRoleLoaded, setIsRoleLoaded] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');

  // Global settings for registration and data editing
  const [registrationStartDate, setRegistrationStartDate] = React.useState(null);
  const [registrationEndDate, setRegistrationEndDate] = React.useState(null);
  const [userDataEditEndDate, setUserDataEditEndDate] = React.useState(null);
  const [isRegistrationOpen, setIsRegistrationOpen] = React.useState(false);
  const [countdown, setCountdown] = React.useState(null);

  // Global notifications
  const [userNotifications, setUserNotifications] = React.useState([]);
  const [userNotificationMessage, setUserNotificationMessage] = React.useState('');

  const fetchSettings = async () => {
    try {
      // ZMENA: Prístup k nastaveniam priamo z kolekcie 'settings'
      const settingsDoc = await db.collection('settings').doc('registration').get();
      if (settingsDoc.exists) {
        const data = settingsDoc.data();
        setRegistrationStartDate(data.startDate ? data.startDate.toDate() : null);
        setRegistrationEndDate(data.endDate ? data.endDate.toDate() : null);
        setUserDataEditEndDate(data.userDataEditEndDate ? data.userDataEditEndDate.toDate() : null);
      } else {
        console.warn("Registration settings document not found at expected path: settings/registration");
      }
    } catch (err) {
      console.error("Chyba pri načítavaní nastavení registrácie:", err);
      setError("Chyba pri načítavaní nastavení registrácie.");
    }
  };

  const fetchUserRole = async (uid) => {
    try {
      const userDoc = await db.collection('users').doc(uid).get();
      if (userDoc.exists) {
        setIsAdmin(userDoc.data().role === 'admin');
      } else {
        setIsAdmin(false); // Default to user if doc doesn't exist
      }
    } catch (err) {
      console.error("Chyba pri načítavaní roly používateľa:", err);
      setIsAdmin(false);
    } finally {
      setIsRoleLoaded(true);
    }
  };

  const fetchNotifications = async (uid) => {
    try {
      const userDocRef = db.collection('users').doc(uid);
      const userDoc = await userDocRef.get();
      const userData = userDoc.data();

      let alerts = [];
      if (userData && userData.systemAlerts && Array.isArray(userData.systemAlerts)) {
        alerts = userData.systemAlerts;
      }

      // ZMENA: Prístup k správam cez cestu artifacts
      const messagesSnapshot = await db.collection('artifacts').doc(APP_ID).collection('public').doc('data').collection('messages')
        .where('recipientId', '==', uid)
        .where('read', '==', false)
        .orderBy('timestamp', 'desc')
        .get();

      const unreadMessages = messagesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const allNotifications = [...alerts, ...unreadMessages].sort((a, b) => {
        const dateA = a.timestamp ? a.timestamp.toDate() : new Date(0);
        const dateB = b.timestamp ? b.timestamp.toDate() : new Date(0);
        return dateB - dateA; // Sort descending
      });

      setUserNotifications(allNotifications);
    } catch (err) {
      console.error("Chyba pri načítavaní notifikácií:", err);
      setError("Chyba pri načítavaní notifikácií.");
      setUserNotifications([]);
    }
  };

  React.useEffect(() => {
    fetchSettings();
    const intervalId = setInterval(fetchSettings, 60000); // Refresh settings every minute
    return () => clearInterval(intervalId);
  }, []);

  React.useEffect(() => {
    if (registrationStartDate && registrationEndDate) {
      const now = new Date();
      setIsRegistrationOpen(now >= registrationStartDate && now <= registrationEndDate);

      if (now < registrationStartDate) {
        setCountdown(calculateTimeLeft(registrationStartDate));
      } else {
        setCountdown(null);
      }
    } else {
      setIsRegistrationOpen(false);
      setCountdown(null);
    }

    const timer = setInterval(() => {
      if (registrationStartDate && new Date() < registrationStartDate) {
        setCountdown(calculateTimeLeft(registrationStartDate));
      } else {
        setCountdown(null);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [registrationStartDate, registrationEndDate]);

  React.useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await fetchUserRole(currentUser.uid);
        await fetchNotifications(currentUser.uid);
        const notificationInterval = setInterval(() => fetchNotifications(currentUser.uid), 30000); // Refresh notifications every 30 seconds
        return () => clearInterval(notificationInterval);
      } else {
        setIsAdmin(false);
        setIsRoleLoaded(true); // Ensure role is loaded even if no user
        setUserNotifications([]);
      }
      setIsAuthReady(true);
      // console.log("isAuthReady set to true."); // Pre diagnostiku
    });

    return () => unsubscribeAuth();
  }, []);

  const value = {
    user,
    isAdmin,
    isAuthReady,
    isRoleLoaded,
    loading,
    setLoading,
    message,
    setMessage,
    error,
    setError,
    registrationStartDate,
    registrationEndDate,
    userDataEditEndDate,
    isRegistrationOpen,
    countdown,
    userNotifications,
    setUserNotificationMessage, // This is for triggering the modal
    fetchNotifications, // Expose to allow manual refresh
    auth, // Firebase auth instance
    db,   // Firebase firestore instance
    app,  // Firebase app instance
    // functions // if you use firebase functions
  };

  return React.createElement(
    AuthContext.Provider,
    { value: value },
    children,
    React.createElement(NotificationModal, { message: userNotificationMessage, onClose: () => setUserNotificationMessage('') }),
    React.createElement(NotificationModal, { message: message, onClose: () => setMessage('') }),
    error && React.createElement(
      NotificationModal,
      { message: `Chyba: ${error}`, onClose: () => setError('') }
    )
  );
}

// Custom hook to use the AuthContext
function useAuth() {
  return React.useContext(AuthContext);
}
