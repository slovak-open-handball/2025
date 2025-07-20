// firebaseConfig.js
import { appId, firebaseConfig, initialAuthToken, GOOGLE_APPS_SCRIPT_URL, RECAPTCHA_SITE_KEY } from './firebaseConfig.js';
// helpers.js
import { formatToDatetimeLocal, validatePassword, getRecaptchaToken } from './helpers.js';

// Firebase Modular SDK Imports
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, EmailAuthProvider } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, addDoc, getDocs, serverTimestamp, FieldValue, orderBy, limit } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';


// components
import PasswordInput from './PasswordInput.js';
import NotificationModal from './NotificationModal.js';

// views
import MyDataView from './MyDataView.js';
import ChangeNameView from './ChangeNameView.js';
import ChangePasswordView from './ChangePasswordView.js';
import ChangePhoneNumberView from './ChangePhoneNumberView.js';
import MySettingsView from './MySettingsView.js';
import NotificationsView from './NotificationsView.js';
import SendMessageView from './SendMessageView.js';
import UsersView from './UsersView.js';
import AllTeamsView from './AllTeamsView.js';
import TournamentSettingsView from './TournamentSettingsView.js';

// modals
import DeleteConfirmationModal from './DeleteConfirmationModal.js';
import RoleEditModal from './RoleEditModal.js';


function App() {
  const [app, setApp] = React.useState(null);
  const [auth, setAuth] = React.useState(null);
  const [db, setDb] = React.useState(null);
  const [user, setUser] = React.useState(null);
  const [isAuthReady, setIsAuthReady] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [message, setMessage] = React.useState(''); // For registration/login success messages
  const [error, setError] = React.useState(''); // For general errors

  // States for registration/login forms (kept here as they are used across multiple pages)
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [contactPhoneNumber, setContactPhoneNumber] = React.useState('');

  // States for profile changes (can be passed to specific views)
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmNewPassword, setNewConfirmPassword] = React.useState('');
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newFirstName, setNewFirstName] = React.useState('');
  const [newLastName, setNewLastName] = React.useState('');
  const [newContactPhoneNumber, setNewContactPhoneNumber] = React.useState('');

  // States for date/time settings (admin only)
  const [registrationStartDate, setRegistrationStartDate] = React.useState('');
  const [registrationEndDate, setRegistrationEndDate] = React.useState('');
  const [userDataEditEndDate, setUserDataEditEndDate] = React.useState('');
  const [settingsLoaded, setSettingsLoaded] = React.useState(false);

  // Countdown state
  const [countdown, setCountdown] = React.useState(null);
  const [forceRegistrationCheck, setForceRegistrationCheck] = React.useState(0);
  const [periodicRefreshKey, setPeriodicRefreshKey] = React.useState(0);

  // Profile view state (for logged-in.html navigation)
  const getInitialProfileView = () => {
    const hash = window.location.hash.substring(1);
    return hash || 'my-data';
  };
  const [profileView, setProfileView] = React.useState(getInitialProfileView);

  // Admin and user data states
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [allUsersData, setAllUsersData] = React.useState([]);
  const [isRoleLoaded, setIsRoleLoaded] = React.useState(false);

  // Password visibility states (can be passed to PasswordInput component)
  const [showPasswordReg, setShowPasswordReg] = React.useState(false);
  const [showConfirmPasswordReg, setShowConfirmPasswordReg] = React.useState(false);
  const [showPasswordLogin, setShowPasswordLogin] = React.useState(false);
  const [showCurrentPasswordChange, setShowCurrentPasswordChange] = React.useState(false);
  const [showNewPasswordChange, setShowNewPasswordChange] = React.useState(false);
  const [showConfirmNewPasswordChange, setShowConfirmNewPasswordChange] = React.useState(false);

  // Modal states
  const [showDeleteConfirmationModal, setShowDeleteConfirmationModal] = React.useState(false);
  const [userToDelete, setUserToDelete] = React.useState(null);
  const [showRoleEditModal, setShowRoleEditModal] = React.useState(false);
  const [userToEditRole, setUserToEditRole] = React.useState(null);
  const [newRole, setNewRole] = React.useState('');

  // Notification states
  const [userNotifications, setUserNotifications] = React.useState([]);
  const [userNotificationMessage, setUserNotificationMessage] = React.useState('');

  // Message sending states (admin only)
  const [checkedRecipients, setCheckedRecipients] = React.useState({});
  const [messageSubject, setMessageSubject] = React.useState('');
  const [messageContent, setMessageContent] = React.useState('');
  const [receivedMessages, setReceivedMessages] = React.useState([]);
  const [searchQuery, setSearchQuery] = React.useState('');

  // Raw data from Firestore collections
  const [systemAlerts, setSystemAlerts] = React.useState([]);

  // Memoized registration status
  const isRegistrationOpen = React.useMemo(() => {
    if (!settingsLoaded) return false;
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

  // Callback for countdown calculation
  const calculateTimeLeft = React.useCallback(() => {
    const now = new Date();
    const startDate = registrationStartDate ? new Date(registrationStartDate) : null;

    if (!startDate || isNaN(startDate) || now >= startDate) {
        return null;
    }

    const difference = startDate.getTime() - now.getTime();

    if (difference <= 0) {
        return null;
    }

    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((difference % (1000 * 60)) / 1000);

    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  }, [registrationStartDate]);


  // Effect for Firebase initialization and Auth Listener
  React.useEffect(() => {
    let unsubscribeAuth;
    let firestoreInstance;

    try {
      // Initialize Firebase app
      const firebaseApp = initializeApp(firebaseConfig);
      setApp(firebaseApp);

      // Get Auth and Firestore instances
      const authInstance = getAuth(firebaseApp);
      setAuth(authInstance);
      firestoreInstance = getFirestore(firebaseApp);
      setDb(firestoreInstance);

      const signIn = async () => {
        try {
          if (initialAuthToken) {
            await signInWithCustomToken(authInstance, initialAuthToken);
          } else {
            await signInAnonymously(authInstance); // Sign in anonymously if no custom token
          }
        } catch (e) {
          console.error("Firebase initial sign-in failed:", e);
          setError(`Chyba pri prihlasovaní: ${e.message}`);
        }
      };

      unsubscribeAuth = onAuthStateChanged(authInstance, async (currentUser) => {
        setUser(currentUser);
        setIsAuthReady(true);
        setIsRoleLoaded(false);

        if (currentUser) {
          if (firestoreInstance) {
            const userDocRef = doc(firestoreInstance, 'users', currentUser.uid);
            const unsubscribeUserDoc = onSnapshot(userDocRef, docSnapshot => {
              if (docSnapshot.exists()) {
                const userData = docSnapshot.data();
                if (userData.role === 'admin' && userData.approved === false && window.location.pathname.split('/').pop() === 'logged-in.html') {
                  console.log("Admin s approved: false je prihlásený. Okamžité odhlásenie.");
                  authInstance.signOut().then(() => {
                    setUser(null);
                    window.location.href = 'login.html';
                  }).catch(e => console.error("Chyba pri odhlasovaní neoprávneného admina:", e));
                  return;
                }

                setIsAdmin(userData.role === 'admin');
                setUser(prevUser => ({
                  ...prevUser,
                  ...userData,
                  displayName: userData.firstName && userData.lastName ? `${userData.firstName} ${userData.lastName}` : userData.email,
                  displayNotifications: userData.displayNotifications !== undefined ? userData.displayNotifications : true
                }));
                setIsRoleLoaded(true);
              } else {
                console.log("onAuthStateChanged (onSnapshot): Dokument používateľa vo Firestore neexistuje pre UID:", currentUser.uid);
                setIsAdmin(false);
                setUser(prevUser => ({
                  ...prevUser,
                  displayNotifications: true
                }));
                setIsRoleLoaded(false);
              }
            }, error => {
              console.error("Chyba pri načítaní roly používateľa z Firestore (onSnapshot) pre UID:", currentUser.uid, error);
              setIsAdmin(false);
              setIsRoleLoaded(false);
            });
            return () => {
              if (unsubscribeAuth) unsubscribeAuth();
              if (unsubscribeUserDoc) unsubscribeUserDoc();
            };
          } else {
            console.log("onAuthStateChanged: Firestore DB inštancia nie je k dispozícii.");
            setIsAdmin(false);
            setIsRoleLoaded(false);
          }
        } else {
          console.log("onAuthStateChanged: Používateľ nie je prihlásený.");
          setIsAdmin(false);
          setIsRoleLoaded(true);
        }
      });

      signIn();

      return () => {
        if (unsubscribeAuth) {
          unsubscribeAuth();
        }
      };
    } catch (e) {
      console.error("Failed to initialize Firebase:", e);
      setError(`Chyba pri inicializácii Firebase: ${e.message}`);
      setLoading(false);
    }
  }, []);

  // Effect for loading settings
  React.useEffect(() => {
    const fetchSettings = async () => {
      if (!db || !isAuthReady) {
        return;
      }
      try {
          const settingsDocRef = doc(db, 'settings', 'registration');
          const unsubscribeSettings = onSnapshot(settingsDocRef, docSnapshot => {
            if (docSnapshot.exists()) {
                const data = docSnapshot.data();
                setRegistrationStartDate(data.registrationStartDate ? formatToDatetimeLocal(data.registrationStartDate.toDate()) : '');
                setRegistrationEndDate(data.registrationEndDate ? formatToDatetimeLocal(data.registrationEndDate.toDate()) : '');
                setUserDataEditEndDate(data.userDataEditEndDate ? formatToDatetimeLocal(data.userDataEditEndDate.toDate()) : '');
            } else {
                console.log("Nastavenia registrácie neboli nájdené vo Firestore. Používam predvolené prázdne hodnoty.");
                setRegistrationStartDate('');
                setRegistrationEndDate('');
                setUserDataEditEndDate('');
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

  // Effect for countdown timer
  React.useEffect(() => {
    let timer;
    const updateCountdown = () => {
        const timeLeft = calculateTimeLeft();
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
  }, [registrationStartDate, calculateTimeLeft]);

  // Effect for periodic refresh of isRegistrationOpen
  React.useEffect(() => {
    const interval = setInterval(() => {
      setPeriodicRefreshKey(prev => prev + 1);
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  // Effect for updating header link visibility
  React.useEffect(() => {
    const authLink = document.getElementById('auth-link');
    const profileLink = document.getElementById('profile-link');
    const logoutButton = document.getElementById('logout-button');
    const registerLink = document.getElementById('register-link');

    if (authLink) {
      if (user) {
        authLink.classList.add('hidden');
        profileLink && profileLink.classList.remove('hidden');
        logoutButton && logoutButton.classList.remove('hidden');
        registerLink && registerLink.classList.add('hidden');
      } else {
        authLink.classList.remove('hidden');
        profileLink && profileLink.classList.add('hidden');
        logoutButton && logoutButton.classList.add('hidden');
        if (isRegistrationOpen) {
          registerLink && registerLink.classList.remove('hidden');
        } else {
          registerLink && registerLink.classList.add('hidden');
        }
      }
    }
  }, [user, isRegistrationOpen]);

  // Effect for handling URL hash changes
  React.useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.substring(1);
      if (hash) {
        setProfileView(hash);
      } else {
        setProfileView('my-data');
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  // Effect for fetching all users (for administrators)
  React.useEffect(() => {
    let unsubscribeAllUsers;
    if (db && user && isAdmin) {
      const usersCollectionRef = collection(db, 'users');
      unsubscribeAllUsers = onSnapshot(usersCollectionRef, snapshot => {
        const usersList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          uid: doc.id
        }));
        setAllUsersData(usersList);
      }, error => {
        console.error("Chyba pri načítaní všetkých používateľov (onSnapshot):", error);
        setError(`Chyba pri načítaní používateľov: ${error.message}`);
      });
    } else {
      setAllUsersData([]);
    }
    return () => {
      if (unsubscribeAllUsers) {
        unsubscribeAllUsers();
      }
    };
  }, [db, user, isAdmin]);

  // Effect for fetching system alerts for ALL logged-in users
  React.useEffect(() => {
    let unsubscribeSystemNotifications;
    if (db && user) {
      const systemNotificationsCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'notifications');
      unsubscribeSystemNotifications = onSnapshot(
        query(systemNotificationsCollectionRef, orderBy('timestamp', 'desc'), limit(20)),
        snapshot => {
          const alerts = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            type: 'system_alert',
            collection: 'notifications',
            seenBy: doc.data().seenBy || [],
            dismissedBy: doc.data().dismissedBy || []
          }));
          setSystemAlerts(alerts);
        }, error => {
          console.error("Chyba pri načítaní systémových upozornení (onSnapshot):", error);
          setError(`Chyba pri načítaní systémových upozornení: ${error.message}`);
        }
      );
    } else {
      setSystemAlerts([]);
    }
    return () => {
      if (unsubscribeSystemNotifications) unsubscribeSystemNotifications();
    };
  }, [db, appId, user]);

  // Effect for fetching direct messages for the current user (all roles)
  React.useEffect(() => {
    let unsubscribeMessages;
    if (db && user) {
      const messagesCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'messages');
      unsubscribeMessages = onSnapshot(
        query(messagesCollectionRef, where('recipients', 'array-contains', user.uid), orderBy('timestamp', 'desc')),
        snapshot => {
          const messagesList = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            type: 'direct_message',
            collection: 'messages',
            seenBy: doc.data().seenBy || [],
            readBy: doc.data().readBy || [],
            acknowledgedBy: doc.data().acknowledgedBy || []
          }));
          setReceivedMessages(messagesList);
        }, error => {
          console.error("Chyba pri načítaní prijatých správ (onSnapshot):", error);
          setError(`Chyba pri načítaní správ: ${error.message}`);
        }
      );
    } else {
      setReceivedMessages([]);
    }

    return () => {
      if (unsubscribeMessages) {
        unsubscribeMessages();
      }
    };
  }, [db, user, appId]);

  // Effect to combine system alerts and direct messages for ALL logged-in users
  React.useEffect(() => {
    if (!user) {
      setUserNotifications([]);
      setUserNotificationMessage('');
      return;
    }

    let allRelevantAlerts = [];
    if (isAdmin) {
        allRelevantAlerts = [
            ...systemAlerts,
            ...receivedMessages
        ];
    } else {
        allRelevantAlerts = receivedMessages;
    }

    const filteredForList = allRelevantAlerts.filter(alert => {
      let isDismissed = false;
      if (alert.type === 'system_alert') {
        isDismissed = alert.dismissedBy && alert.dismissedBy.includes(user.uid);
      } else if (alert.type === 'direct_message') {
        isDismissed = alert.acknowledgedBy && alert.acknowledgedBy.includes(user.uid);
      }
      return !isDismissed;
    });

    filteredForList.sort((a, b) => (b.timestamp?.toDate() || 0) - (a.timestamp?.toDate() || 0));
    setUserNotifications(filteredForList);

    const potentialPopups = allRelevantAlerts.filter(alert => {
      let isDismissed = false;
      if (alert.type === 'system_alert') {
        isDismissed = alert.dismissedBy && alert.dismissedBy.includes(user.uid);
      } else if (alert.type === 'direct_message') {
        isDismissed = alert.acknowledgedBy && alert.acknowledgedBy.includes(user.uid);
      }
      const hasBeenSeen = alert.seenBy && alert.seenBy.includes(user.uid);
      
      return !isDismissed && !hasBeenSeen && (isAdmin || alert.type === 'direct_message');
    });

    potentialPopups.sort((a, b) => (b.timestamp?.toDate() || 0) - (a.timestamp?.toDate() || 0));

    const latestUnseenPopup = potentialPopups[0];

    if (latestUnseenPopup && user?.displayNotifications && !userNotificationMessage) { 
      let messageText = latestUnseenPopup.message;
      if (latestUnseenPopup.type === 'direct_message') {
        messageText = `Nová správa od ${latestUnseenPopup.senderName || 'Neznámy odosielateľ'}: ${latestUnseenPopup.subject}`;
      }
      setUserNotificationMessage(messageText);

      const alertRef = doc(db, 'artifacts', appId, 'public', 'data', latestUnseenPopup.collection, latestUnseenPopup.id);
      updateDoc(alertRef, {
        seenBy: FieldValue.arrayUnion(user.uid)
      }).catch(e => console.error(`Error marking ${latestUnseenPopup.type} as seen:`, e));
    }

  }, [user, isAdmin, db, appId, systemAlerts, receivedMessages, user?.displayNotifications, userNotificationMessage]);


  const clearMessages = () => {
    setTimeout(() => {
      setMessage('');
      setError('');
    }, 5000);
  };

  const handleRegister = async (e, isAdminRegistration = false) => {
    e.preventDefault();
    if (!auth || !db) {
      setError("Firebase Auth alebo Firestore nie je inicializovaný.");
      return;
    }
    if (!email || !password || !confirmPassword || !firstName || !lastName) {
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

    if (!isAdminRegistration) {
      const phoneRegex = /^\+\d+$/;
      if (!contactPhoneNumber || !phoneRegex.test(contactPhoneNumber)) {
          setError("Telefónne číslo kontaktnej osoby musí začínať znakom '+' a obsahovať iba číslice (napr. +421901234567).");
          return;
      }
    }

    const recaptchaToken = await getRecaptchaToken('register', RECAPTCHA_SITE_KEY);
    if (!recaptchaToken) {
      setError("Overenie reCAPTCHA zlyhalo. Prosím, skúste to znova.");
      return null;
    }

    setLoading(true);
    setError('');
    
    if (isAdminRegistration) {
      setMessage(`Administrátorský účet pre ${email} sa registruje. Na vašu e-mailovú adresu sme odoslali potvrdenie registrácie. Pre úplnú aktiváciu počkajte, prosím, na schválenie účtu iným administrátorom.`);
    } else {
      setMessage(''); 
    }

    try {
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      await userCredential.user.updateProfile({ displayName: `${firstName} ${lastName}` });

      let initialUserRole = 'user';
      let initialIsApproved = true;

      if (isAdminRegistration) {
        initialUserRole = 'user'; 
        initialIsApproved = true; 
      }

      const userDataToSave = {
        uid: userCredential.user.uid,
        email: email,
        firstName: firstName,
        lastName: lastName,
        contactPhoneNumber: contactPhoneNumber,
        displayName: `${firstName} ${lastName}`,
        role: initialUserRole,
        approved: initialIsApproved,
        registeredAt: serverTimestamp(),
        displayNotifications: true
      };

      try {
        await setDoc(doc(db, 'users', userCredential.user.uid), userDataToSave);

        try {
          const payload = {
            action: 'sendRegistrationEmail',
            email: email,
            password: password, 
            isAdmin: isAdminRegistration, 
            firstName: firstName,
            lastName: lastName,
            contactPhoneNumber: contactPhoneNumber 
          };
          const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
          });
          try {
            await response.text();
          } catch (jsonError) {
            console.warn("Nepodarilo sa parsovať odpoveď z Apps Scriptu (očakávané s 'no-cors' pre JSON):", jsonError);
          }
        } catch (emailError) {
          console.error("Chyba pri odosielaní registračného e-mailu cez Apps Script (fetch error):", emailError);
        }

        if (isAdminRegistration) {
          await updateDoc(doc(db, 'users', userCredential.user.uid), {
            role: 'admin',
            approved: false
          });
        }

      } catch (firestoreError) {
        console.error("Firestore Save/Update Error:", firestoreError);
        setError(`Chyba pri ukladaní/aktualizácii používateľa do databázy: ${firestoreError.message}. Skontrolujte Firebase Security Rules.`);
        setLoading(false);
        setMessage('');
        return;
      }

      if (!isAdminRegistration) {
        setMessage(`Ďakujeme za registráciu Vášho klubu na turnaj Slovak Open Handball. Na e-mailovú adresu ${email} sme odoslali potvrdenie registrácie.`);
      }
      
      setLoading(false);

      await auth.signOut(); 
      setUser(null);
      
      setTimeout(() => {
        window.location.href = 'login.html'; 
      }, 5000); 

    } catch (e) {
      console.error("Chyba pri registrácii (Auth alebo iné):", e); 
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
      clearMessages(); 
    } 
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!auth || !db) { 
      setError("Firebase Auth alebo Firestore nie je inicializovaný.");
      return;
    }
    if (!email || !password) {
      setError("Prosím, vyplňte e-mailovú adresu a heslo.");
      return;
    }

    const recaptchaToken = await getRecaptchaToken('login', RECAPTCHA_SITE_KEY);
    if (!recaptchaToken) {
      setError("Overenie reCAPTCHA zlyhalo. Prosím, skúste to znova.");
      return null;
    }

    setLoading(true);
    try {
      const userCredential = await auth.signInWithEmailAndPassword(email, password);
      const currentUser = userCredential.user;

      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        setError("Účet nebol nájdený v databáze. Kontaktujte podporu.");
        await auth.signOut(); 
        setLoading(false);
        return;
      }

      const userData = userDoc.data();

      if (userData.role === 'admin' && userData.approved === false) { 
        setError("Pre úplnú aktiváciu počkajte, prosím, na schválenie účtu iným administrátorom."); 
        
        try {
          const payload = {
            action: 'sendAdminApprovalReminder', 
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            isAdmin: true 
          };
          const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
          });
          try {
            await response.text();
          } catch (jsonError) {
            console.warn("Nepodarilo sa parsovať odpoveď z Apps Scriptu (očakávané s 'no-cors' pre JSON):", jsonError);
          }
        } catch (emailError) {
          console.error("Chyba pri odosielaní e-mailu s pripomienkou schválenia admina cez Apps Script (fetch error):", emailError);
        }

        await auth.signOut(); 
        setLoading(false);
        return;
      }

      setUser(prevUser => ({
        ...prevUser,
        ...userData,
        displayName: userData.firstName && userData.lastName ? `${userData.firstName} ${userData.lastName}` : userData.email,
        displayNotifications: userData.displayNotifications !== undefined ? userData.displayNotifications : true 
      }));

      setMessage("Prihlásenie úspešné! Presmerovanie na profilovú stránku...");
      setError('');
      setEmail('');
      setPassword('');
      
      setLoading(false); 

      setTimeout(() => {
        window.location.href = 'logged-in.html';
      }, 5000); 

    } catch (e) {
      console.error("Chyba pri prihlasovaní:", e);
      if (e.code === 'auth/invalid-credential' || e.code === 'auth/invalid-login-credentials') {
        setError("Zadané prihlasovacie údaje sú neplatné. Skontrolujte e-mailovú adresu a heslo a skúste to prosím znova.");
      } else if (e.code === 'auth/invalid-email') {
        setError("Neplatný formát e-mailovej adresy.");
      } else {
        setError(`Chyba pri prihlasovaní: ${e.message}`);
      }
      setLoading(false);
      clearMessages();
    } 
  };

  const handleLogout = async () => {
    if (!auth) return;
    try {
      setLoading(true);
      await auth.signOut();
      setMessage("Úspešne odhlásené.");
      setError('');
      window.location.href = 'login.html';
    } catch (e) {
      console.error("Chyba pri odhlasovaní:", e);
      setError(`Chyba pri odhlasovaní: ${e.message}`);
    } finally {
      setLoading(false);
      clearMessages();
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!user || !auth) { 
      setError("Nie ste prihlásený alebo Firebase Auth nie je inicializovaný.");
      return;
    }
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setError("Prosím, vyplňte všetky polia.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("Nové heslá sa nezhodujú. Prosím, skontrolujte ich.");
      return;
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setLoading(true);
    try {
      const currentUserForReauth = auth.currentUser;
      if (!currentUserForReauth) {
        setError("Aktuálny používateľ nie je k dispozícii pre reautentifikáciu.");
        setLoading(false);
        return;
      }

      const credential = EmailAuthProvider.credential(currentUserForReauth.email, currentPassword);
      await currentUserForReauth.reauthenticateWithCredential(credential);

      await currentUserForReauth.updatePassword(newPassword);
      setUserNotificationMessage("Heslo úspešne zmenené!"); 
      setError('');
      setNewPassword('');
      setNewConfirmPassword('');
      setCurrentPassword('');
    } catch (e) {
      console.error("Chyba pri zmene hesla:", e);
      if (e.code === 'auth/requires-recent-login') {
        setError("Pre túto akciu sa musíte znova prihlásiť. Prosím, odhláste sa a znova prihláste.");
      } else if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential' || e.code === 'auth/invalid-login-credentials') {
        setError("Nesprávne aktuálne heslo. Prosím, zadajte správne heslo pre overenie.");
      } else {
        setError(`Chyba pri zmene hesla: ${e.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChangeName = async (e) => {
    e.preventDefault();
    if (!user || !auth || !db) {
      setError("Nie ste prihlásený alebo Firebase Auth/Firestore nie je inicializovaný.");
      return;
    }
    if ((!newFirstName && !newLastName) || !currentPassword) {
      setError("Prosím, zadajte aspoň nové meno alebo priezvisko a aktuálne heslo pre overenie.");
      return;
    }

    const now = new Date();
    const editEnd = userDataEditEndDate ? new Date(userDataEditEndDate) : null;
    const isEditAllowed = !editEnd || now <= editEnd;
    if (!isEditAllowed) {
        setError("Úpravy vašich údajov sú už uzavreté. Boli uzavreté dňa: " + (editEnd ? editEnd.toLocaleString('sk-SK') : '-'));
        return;
    }

    setLoading(true);
    try {
      const currentUserForReauth = auth.currentUser;
      if (!currentUserForReauth) {
        setError("Aktuálny používateľ nie je k dispozícii pre reautentifikáciu.");
        setLoading(false);
        return;
      }

      const credential = EmailAuthProvider.credential(currentUserForReauth.email, currentPassword);
      await currentUserForReauth.reauthenticateWithCredential(credential);

      const oldFirstName = user.firstName;
      const oldLastName = user.lastName;

      const updatedFirstName = newFirstName || oldFirstName;
      const updatedLastName = newLastName || oldLastName;
      const updatedDisplayName = `${updatedFirstName} ${updatedLastName}`;
      
      await currentUserForReauth.updateProfile({ displayName: updatedDisplayName });
      
      await updateDoc(doc(db, 'users', user.uid), { 
        firstName: updatedFirstName, 
        lastName: updatedLastName,   
        displayName: updatedDisplayName
      });

      let changedFields = [];
      if (newFirstName && newFirstName !== oldFirstName) {
        changedFields.push(`meno z '${oldFirstName || 'nezadané'}' na '${newFirstName}'`);
      }
      if (newLastName && newLastName !== oldLastName) {
        changedFields.push(`priezvisko z '${oldLastName || 'nezadané'}' na '${newLastName}'`);
      }

      if (changedFields.length > 0) {
        const notificationMessage = `Používateľ ${user.displayName || user.email} zmenil ${changedFields.join(' a ')} vo svojom registračnom formulári.`;
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'notifications'), {
          message: notificationMessage,
          timestamp: serverTimestamp(),
          userId: user.uid,
          userName: user.displayName || user.email,
          type: 'user_data_change',
          details: {
            originalFirstName: oldFirstName,
            newFirstName: updatedFirstName,
            newLastName: updatedLastName,
          },
          dismissedBy: [],
          seenBy: []
        });
      }

      setUserNotificationMessage("Meno a priezvisko úspešne zmenené na " + updatedDisplayName); 
      setError('');
      setNewFirstName('');
      setNewLastName('');
      setCurrentPassword('');
      setUser(prevUser => ({
        ...prevUser,
        firstName: updatedFirstName,
        lastName: updatedLastName,
        displayName: updatedDisplayName
      }));
    } catch (e) {
      console.error("Chyba pri zmene mena a priezviska:", e);
      if (e.code === 'auth/requires-recent-login') {
        setError("Pre túto akciu sa musíte znova prihlásiť. Prosím, odhláste sa a znova prihláste.");
      } else if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential' || e.code === 'auth/invalid-login-credentials') {
        setError("Nesprávne aktuálne heslo. Prosím, zadajte správne heslo pre overenie.");
      } else {
        setError(`Chyba pri zmene mena a priezviska: ${e.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChangeContactPhoneNumber = async (e) => {
    e.preventDefault();
    if (!user || !auth || !db) { 
      setError("Nie ste prihlásený alebo Firebase Auth nie je inicializovaný.");
      return;
    }
    if (!newContactPhoneNumber) {
      setError("Prosím, zadajte nové telefónne číslo.");
      return;
    }

    const phoneRegex = /^\+\d+$/;
    if (!phoneRegex.test(newContactPhoneNumber)) {
        setError("Telefónne číslo musí začínať znakom '+' a obsahovať iba číslice (napr. +421901234567).");
        return;
    }

    const now = new Date();
    const editEnd = userDataEditEndDate ? new Date(userDataEditEndDate) : null;
    const isEditAllowed = !editEnd || now <= editEnd;
    if (!isEditAllowed) {
        setError("Úpravy vašich údajov sú už uzavreté. Boli uzavreté dňa: " + (editEnd ? editEnd.toLocaleString('sk-SK') : '-'));
        return;
    }

    setLoading(true);
    try {
      const currentUserForReauth = auth.currentUser;
      if (!currentUserForReauth) {
        setError("Aktuálny používateľ nie je k dispozícii pre reautentifikáciu.");
        setLoading(false);
        return;
      }

      const credential = EmailAuthProvider.credential(currentUserForReauth.email, currentPassword);
      await currentUserForReauth.reauthenticateWithCredential(credential);

      const oldContactPhoneNumber = user.contactPhoneNumber;

      await updateDoc(doc(db, 'users', user.uid), { 
        contactPhoneNumber: newContactPhoneNumber
      });

      if (newContactPhoneNumber !== oldContactPhoneNumber) {
        const notificationMessage = `Používateľ ${user.displayName || user.email} zmenil telefónne číslo z '${oldContactPhoneNumber || 'nezadané'}' na '${newContactPhoneNumber}' vo svojom registračnom formulári.`;
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'notifications'), {
          message: notificationMessage,
          timestamp: serverTimestamp(),
          userId: user.uid,
          userName: user.displayName || user.email,
          type: 'user_data_change',
          details: {
            originalPhoneNumber: oldContactPhoneNumber,
            newPhoneNumber: newContactPhoneNumber,
          },
          dismissedBy: [],
          seenBy: []
        });
      }

      setUserNotificationMessage("Telefónne číslo úspešne zmenené na " + newContactPhoneNumber); 
      setError('');
      setNewContactPhoneNumber('');
      setCurrentPassword('');
      setUser(prevUser => ({ ...prevUser, contactPhoneNumber: newContactPhoneNumber }));
    } catch (e) {
      console.error("Chyba pri zmene telefónneho čísla:", e);
      if (e.code === 'auth/requires-recent-login') {
        setError("Pre túto akciu sa musíte znova prihlásiť. Prosím, odhláste sa a znova prihláste.");
      } else if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential' || e.code === 'auth/invalid-login-credentials') {
        setError("Nesprávne aktuálne heslo. Prosím, zadajte správne heslo pre overenie.");
      } else {
        setError(`Chyba pri zmene telefónneho čísla: ${e.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!db || !isAdmin) {
        setError("Nemáte oprávnenie na ukladanie nastavení.");
        return;
    }

    setLoading(true);
    setError('');

    const regStart = registrationStartDate ? new Date(registrationStartDate) : null;
    const regEnd = registrationEndDate ? new Date(registrationEndDate) : null;
    const userEditEnd = userDataEditEndDate ? new Date(userDataEditEndDate) : null;

    if (regStart && regEnd && regEnd <= regStart) {
        setError("Dátum 'Koniec registrácie' musí byť neskôr ako 'Začiatok registrácie'.");
        setLoading(false);
        clearMessages();
        return;
    }

    if (regEnd && userEditEnd && userEditEnd <= regEnd) {
        setError("Dátum 'Koniec úprav používateľských dát' musí byť neskôr ako 'Koniec registrácie'.");
        setLoading(false);
        clearMessages();
        return;
    }

    try {
        const settingsDocRef = doc(db, 'settings', 'registration');
        await setDoc(settingsDocRef, {
            registrationStartDate: registrationStartDate ? new Date(registrationStartDate) : null,
            registrationEndDate: registrationEndDate ? new Date(registrationEndDate) : null,
            userDataEditEndDate: userDataEditEndDate ? new Date(userDataEditEndDate) : null
        });
        setUserNotificationMessage("Nastavenia úspešne uložené!"); 
    } catch (e) {
        console.error("Chyba pri ukladaní nastavení:", e);
        setError(`Chyba pri ukladaní nastavení: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };


  const openDeleteConfirmationModal = (user) => {
    setUserToDelete(user);
    setShowDeleteConfirmationModal(true);
  };

  const closeDeleteConfirmationModal = () => {
    setUserToDelete(null);
    setShowDeleteConfirmationModal(false);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete || !db) { 
      setError("Používateľ na odstránenie nie je definovaný alebo Firebase nie je inicializovaný.");
      return;
    }

    setLoading(true);
    setError('');
    try {
      await deleteDoc(doc(db, 'users', userToDelete.uid));
      setUserNotificationMessage(`Používateľ ${userToDelete.email} bol úspešne odstránený z databázy Firestore. Pre úplné odstránenie účtu (vrátane prihlasovacích údajov) ho musíte manuálne odstrániť aj v konzole Firebase Authentication.`);
      
      closeDeleteConfirmationModal();
      window.open(`https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/users`, '_blank');

    } catch (e) {
      console.error("Chyba pri odstraňovaní používateľa z databázy:", e);
      setError(`Chyba pri odstraňovaní používateľa: ${e.message}. Uistite sa, že máte dostatočné Firebase Security Rules.`);
    } finally {
      setLoading(false);
    }
  };

  const openRoleEditModal = (user) => {
    setUserToEditRole(user);
    setNewRole(user.role || 'user');
    setShowRoleEditModal(true);
  };

  const closeRoleEditModal = () => {
    setUserToEditRole(null);
    setNewRole('');
    setShowRoleEditModal(false);
  };

  const handleUpdateUserRole = async () => {
    if (!userToEditRole || !db || !newRole) {
      setError("Používateľ alebo nová rola nie sú definované.");
      return;
    }

    setLoading(true);
    setError('');
    try {
      let updateData = { role: newRole };

      if (newRole === 'user') {
        updateData.approved = true;
      }
      else if (newRole === 'admin') {
          updateData.approved = userToEditRole.approved;
      }

      await updateDoc(doc(db, 'users', userToEditRole.uid), updateData);
      setUserNotificationMessage(`Rola používateľa ${userToEditRole.email} bola úspešne zmenená na '${newRole}'.`);
      closeRoleEditModal();
    } catch (e) {
      console.error("Chyba pri aktualizácii roly používateľa:", e);
      setError(`Chyba pri aktualizácii roly: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveUser = async (userToApprove) => {
    if (!userToApprove || !db) {
      setError("Používateľ na schválenie nie je definovaný.");
      return;
    }

    setLoading(true);
    setError('');
    try {
      await updateDoc(doc(db, 'users', userToApprove.uid), { approved: true });
      setUserNotificationMessage(`Používateľ ${userToApprove.email} bol úspešne schválený.`);
    } catch (e) {
      console.error("Chyba pri schvaľovaní používateľa:", e);
      setError(`Chyba pri schvaľovaní používateľa: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const dismissNotification = async (notificationId, notificationType, collectionName) => {
    if (!db || !user) {
      setError("Nie ste prihlásený alebo Firebase nie je inicializovaný.");
      return;
    }
    setLoading(true);
    setError('');

    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', collectionName, notificationId);
      const docSnapshot = await getDoc(docRef);

      if (!docSnapshot.exists()) {
        setUserNotificationMessage("Upozornenie/Správa už neexistuje.");
        setLoading(false);
        return;
      }

      const data = docSnapshot.data();

      if (notificationType === 'system_alert') {
        if (!isAdmin) {
          setUserNotificationMessage("Nemáte oprávnenie na vymazanie systémových upozornení.");
          setLoading(false);
          return;
        }

        let dismissedBy = data.dismissedBy || [];
        if (!dismissedBy.includes(user.uid)) {
          dismissedBy.push(user.uid);
        }
        let seenBy = data.seenBy || [];
        if (!seenBy.includes(user.uid)) {
          seenBy.push(user.uid);
        }

        const activeAdminUids = allUsersData
          .filter(u => u.role === 'admin' && u.approved === true)
          .map(u => u.uid);

        const allAdminsDismissed = activeAdminUids.every(adminUid => dismissedBy.includes(adminUid));

        if (allAdminsDismissed) {
          await deleteDoc(docRef);
          setUserNotificationMessage("Systémové upozornenie bolo vymazané pre všetkých administrátorov.");
        } else {
          await updateDoc(docRef, {
            dismissedBy: FieldValue.arrayUnion(user.uid),
            seenBy: FieldValue.arrayUnion(user.uid)
          });
          setUserNotificationMessage("Systémové upozornenie bolo vymazané z vášho zoznamu.");
        }
      } else if (notificationType === 'direct_message') {
        await updateDoc(docRef, {
          acknowledgedBy: FieldValue.arrayUnion(user.uid),
          seenBy: FieldValue.arrayUnion(user.uid)
        });
        setUserNotificationMessage("Správa bola vymazaná z vášho zoznamu.");
      }

    } catch (e) {
      console.error("Chyba pri mazaní upozornenia/správy:", e);
      setError(`Chyba pri mazaní upozornenia/správy: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const markMessageAsRead = async (messageId) => {
    if (!db || !user) return;
    setLoading(true);
    try {
      const messageRef = doc(db, 'artifacts', appId, 'public', 'data', 'messages', messageId);
      await updateDoc(messageRef, {
        readBy: FieldValue.arrayUnion(user.uid),
        seenBy: FieldValue.arrayUnion(user.uid)
      });
      setUserNotificationMessage("Správa bola označená ako prečítaná.");
    } catch (e) {
      console.error("Chyba pri označovaní správy ako prečítanej:", e);
      setError(`Chyba pri označovaní správy ako prečítanej: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClearNotifications = async () => {
    if (!db || !user) {
      setError("Nie ste prihlásený alebo Firebase nie je inicializovaný.");
      return;
    }
    setLoading(true);
    setError('');
    try {
      const notificationsToDismiss = [...userNotifications]; 
      for (const alert of notificationsToDismiss) { 
        if (alert.type === 'system_alert' && !isAdmin) {
          continue; 
        }
        await dismissNotification(alert.id, alert.type, alert.collection);
      }
      setUserNotificationMessage("Všetky viditeľné upozornenia boli vymazané z môjho zoznamu.");
    } catch (e) {
      console.error("Chyba pri mazaní upozornení:", e);
      setError(`Chyba pri mazaní upozornení: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleDisplayNotifications = async (e) => {
    if (!db || !user) {
      setError("Nie ste prihlásený alebo Firebase nie je inicializovaný.");
      return;
    }
    setLoading(true);
    setError('');
    const newDisplayValue = e.target.checked;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayNotifications: newDisplayValue
      });
      setUser(prevUser => ({ ...prevUser, displayNotifications: newDisplayValue }));
      setUserNotificationMessage(`Zobrazovanie upozornení bolo ${newDisplayValue ? 'zapnuté' : 'vypnuté'}.`);
    } catch (e) {
      console.error("Chyba pri zmene nastavenia notifikácií:", e);
      setError(`Chyba pri zmene nastavenia notifikácií: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!db || !user || !isAdmin) {
      setError("Nemáte oprávnenie na odosielanie správ.");
      return;
    }

    const actualRecipients = Object.keys(checkedRecipients).filter(uid => checkedRecipients[uid] && uid !== user.uid);

    if (actualRecipients.length === 0) {
      setError("Prosím, vyberte aspoň jedného príjemcu.");
      return;
    }
    if (!messageSubject.trim()) {
      setError("Predmet správy nemôže byť prázdny.");
      return;
    }
    if (!messageContent.trim()) {
      setError("Obsah správy nemôže byť prázdny.");
      return;
    }

    setLoading(true);
    setError('');

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'messages'), {
        senderId: user.uid,
        senderName: user.displayName || user.email,
        recipients: actualRecipients,
        subject: messageSubject,
        content: messageContent,
        timestamp: serverTimestamp(),
        readBy: [],
        seenBy: [],
        acknowledgedBy: []
      });
      setUserNotificationMessage("Správa bola úspešne odoslaná!");
      setCheckedRecipients({});
      setMessageSubject('');
      setMessageContent('');
      setSearchQuery('');
    } catch (e) {
      console.error("Chyba pri odosielaní správy:", e);
      setError(`Chyba pri odosielaní správy: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };


  React.useEffect(() => {
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
      logoutButton.addEventListener('click', handleLogout);
    }
    return () => {
      if (logoutButton) {
        logoutButton.removeEventListener('click', handleLogout);
      }
    };
  }, [handleLogout]);

  const changeProfileView = (view) => {
    setProfileView(view);
    window.location.hash = view;
    setNewContactPhoneNumber('');
    
    if (view === 'change-name') {
        setNewFirstName('');
        setNewLastName('');
    }
    setCurrentPassword('');
    setNewPassword('');
    setNewConfirmPassword('');
  };

  const handleToggleAll = (type) => {
    const newCheckedRecipients = { ...checkedRecipients };
    let targetUsers = [];

    if (type === 'all') {
      targetUsers = allUsersData.filter(u => u.uid !== user.uid);
    } else if (type === 'admin') {
      targetUsers = allUsersData.filter(u => u.role === 'admin' && u.uid !== user.uid);
    } else if (type === 'user') {
      targetUsers = allUsersData.filter(u => u.role === 'user' && u.uid !== user.uid);
    }

    const allOfTypeChecked = targetUsers.every(u => newCheckedRecipients[u.uid]);

    targetUsers.forEach(u => {
      newCheckedRecipients[u.uid] = !allOfTypeChecked;
    });

    setCheckedRecipients(newCheckedRecipients);
  };

  const handleIndividualRecipientChange = (uid) => {
    setCheckedRecipients(prev => ({
      ...prev,
      [uid]: !prev[uid]
    }));
  };

  const isAllChecked = React.useCallback((type) => {
    let targetUsers = [];
    if (type === 'all') {
      targetUsers = allUsersData.filter(u => u.uid !== user.uid);
    } else if (type === 'admin') {
      targetUsers = allUsersData.filter(u => u.role === 'admin' && u.uid !== user.uid);
    } else if (type === 'user') {
      targetUsers = allUsersData.filter(u => u.role === 'user' && u.uid !== user.uid);
    }

    if (targetUsers.length === 0) return false;
    return targetUsers.every(u => checkedRecipients[u.uid]);
  }, [allUsersData, checkedRecipients, user]);

  const filteredUsers = React.useMemo(() => {
    const lowerCaseQuery = searchQuery.toLowerCase();
    return allUsersData.filter(u => 
      u.uid !== user.uid &&
      (u.displayName?.toLowerCase().includes(lowerCaseQuery) ||
       u.email?.toLowerCase().includes(lowerCaseQuery) ||
       u.firstName?.toLowerCase().includes(lowerCaseQuery) ||
       u.lastName?.toLowerCase().includes(lowerCaseQuery))
    );
  }, [allUsersData, searchQuery, user]);


  const currentPath = window.location.pathname.split('/').pop();
  const isRegistrationPage = currentPath === 'register.html' || currentPath === 'admin-register.html';

  if (isRegistrationPage && message) {
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

  if (loading || !isAuthReady || (currentPath === 'logged-in.html' && !isRoleLoaded) || !settingsLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-xl font-semibold text-gray-700">Načítava sa...</div>
      </div>
    );
  }

  if (currentPath === '' || currentPath === 'index.html') {
    const now = new Date();
    const regStart = registrationStartDate ? new Date(registrationStartDate) : null;
    const regEnd = registrationEndDate ? new Date(registrationEndDate) : null;

    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center font-inter overflow-y-auto">
        <div className="w-full max-w-md mt-20 mb-10 p-4">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full text-center">
            <h1 className="text-3xl font-bold text-gray-800 mb-4">Vitajte na stránke Slovak Open Handball</h1>
            {user ? (
              <>
                <p className="text-lg text-gray-600">Ste prihlásený. Prejdite do svojej zóny pre viac možností.</p>
                <div className="mt-6 flex justify-center">
                  <a
                    href="logged-in.html"
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200"
                  >
                    Moja zóna
                  </a>
                </div>
              </>
            ) : (
              <>
                {isRegistrationOpen ? (
                  <>
                    <p className="text-lg text-gray-600">Prosím, prihláste sa alebo sa zaregistrujte, aby ste mohli pokračovať.</p>
                    <div className="mt-6 flex justify-center space-x-4">
                      <a
                        href="login.html"
                        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200"
                      >
                        Prihlásenie
                      </a>
                      <a
                        href="register.html"
                        className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200"
                      >
                        Registrácia na turnaj
                      </a>
                    </div>
                  </>
                ) : (
                  <>
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
                          <span style={{ whiteSpace: 'nowap' }}>
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
                        href="login.html"
                        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200"
                      >
                        Prihlásenie
                      </a>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isRegistrationPage) {
    const is_admin_register_page = currentPath === 'admin-register.html';

    if (user) {
      window.location.href = 'logged-in.html';
      return null;
    }

    const now = new Date();
    const regStart = registrationStartDate ? new Date(registrationStartDate) : null;
    const regEnd = registrationEndDate ? new Date(registrationEndDate) : null;

    if (!is_admin_register_page && !isRegistrationOpen) {
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
                    <span style={{ whiteSpace: 'nowap' }}>
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
    
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto">
        <div className="w-full max-w-md mt-20 mb-10 p-4">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full">
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap" role="alert">
                {error}
              </div>
            )}
            <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">
              {is_admin_register_page ? "Registrácia administrátora" : "Registrácia na turnaj"}
            </h1>
            <form onSubmit={(e) => handleRegister(e, is_admin_register_page)} className="space-y-4">
                <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="reg-first-name">
                        {is_admin_register_page ? "Meno" : "Meno kontaktnej osoby"}
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
                        {is_admin_register_page ? "Priezvisko" : "Priezvisko kontaktnej osoby"}
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
                {is_admin_register_page ? (
                    <div>
                        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="reg-email">E-mailová adresa</label>
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
                ) : (
                    <>
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
                    </>
                )}
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

  if (currentPath === 'login.html') {
    if (message && currentPath === 'login.html') {
      return (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center font-inter overflow-y-auto">
          <div className="w-full max-w-md mt-20 mb-10 p-4">
            <div className="bg-white p-8 rounded-lg shadow-xl w-full text-center">
              <h1 className="text-3xl font-bold text-gray-800 mb-4">Prihlásenie úspešné!</h1>
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">
                {message}
              </div>
              <p className="text-lg text-gray-600">Presmerovanie na prihlasovaciu stránku...</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto">
        <div className="w-full max-w-md mt-20 mb-10 p-4">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full">
            {(!message && error) && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap" role="alert">
                {error}
              </div>
            )}

            <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">Prihlásenie</h1>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">E-mailová adresa</label>
                <input
                  type="email"
                  id="email"
                  className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="Zadajte svoju e-mailovú adresu"
                  autoComplete="email"
                />
              </div>
              <PasswordInput
                id="password"
                label="Heslo"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onCopy={(e) => e.preventDefault()}
                onPaste={(e) => e.preventDefault()}
                onCut={(e) => e.preventDefault()}
                placeholder="Zadajte heslo"
                autoComplete="current-password"
                showPassword={showPasswordLogin}
                toggleShowPassword={() => setShowPasswordLogin(!showPasswordLogin)}
              />
              <button
                type="submit"
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200"
                disabled={loading}
              >
                {loading ? 'Prihlasujem...' : 'Prihlásiť sa'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (currentPath === 'logged-in.html') {
    if (!user) {
      window.location.href = 'login.html';
      return null;
    }

    const now = new Date();
    const isEditAllowed = !userDataEditEndDate || now <= new Date(userDataEditEndDate);

    const administrators = allUsersData.filter(u => u.role === 'admin' && u.uid !== user.uid);
    const regularUsers = allUsersData.filter(u => u.role === 'user' && u.uid !== user.uid);

    const adminOnlyViews = ['users', 'all-teams', 'tournament-settings', 'send-message'];

    if (!isAdmin && adminOnlyViews.includes(profileView)) {
        return (
            <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center font-inter overflow-y-auto">
                <div className="w-full max-w-md mt-20 mb-10 p-4">
                    <div className="bg-white p-8 rounded-lg shadow-xl w-full text-center">
                        <h1 className="text-3xl font-bold text-gray-800 mb-4">Prístup je obmedzený.</h1>
                        <p className="text-lg text-gray-600">
                            Stránka, ktorú sa pokúšate zobraziť, je dostupná iba pre administrátorov turnaja.
                            Ak máte akékoľvek otázky alebo potrebujete prístup, obráťte sa na administrátora.
                        </p>
                        <div className="mt-6 flex justify-center">
                            <button
                                onClick={() => changeProfileView('my-data')}
                                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200"
                            >
                                Späť na Moje údaje
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
      <div className="min-h-screen bg-gray-100 flex flex-col font-inter overflow-y-auto">
        <div className="h-20"></div> 

        <NotificationModal
            message={userNotificationMessage}
            onClose={() => {
                setUserNotificationMessage('');
            }}
        />

        <div className="flex flex-grow w-full pb-10">
          <div className="fixed top-20 left-0 h-[calc(100vh-theme(spacing.20))] w-[271px] bg-white p-6 rounded-lg shadow-xl overflow-y-auto z-40 ml-4">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Menu</h2>
            <nav>
              <ul className="space-y-2">
                <li>
                  <button
                    onClick={() => changeProfileView('my-data')}
                    className={`w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 whitespace-nowrap ${
                      profileView === 'my-data' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Moje údaje
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => {
                      changeProfileView('change-name');
                    }}
                    className={`w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 whitespace-nowrap ${
                        profileView === 'change-name' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Zmeniť meno a priezvisko
                  </button> 
                </li>
                <li>
                  <button
                    onClick={() => changeProfileView('change-password')}
                    className={`w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 whitespace-nowrap ${
                      profileView === 'change-password' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Zmeniť heslo
                  </button>
                </li>
                {!isAdmin && (
                  <li>
                    <button
                      onClick={() => changeProfileView('change-phone-number')}
                      className={`w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 whitespace-nowrap ${
                        profileView === 'change-phone-number' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Zmeniť telefónne číslo
                    </button>
                  </li>
                )}
                {isAdmin && ( 
                  <li> 
                    <button
                      onClick={() => {
                        changeProfileView('my-settings'); 
                      }}
                      className={`w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 whitespace-nowrap ${
                        profileView === 'my-settings' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Moje nastavenia
                    </button>
                  </li>
                )}
                <li>
                  <button
                    onClick={() => {
                      changeProfileView('notifications');
                    }}
                    className={`w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 whitespace-nowrap ${
                      profileView === 'notifications' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Upozornenia ({userNotifications.length})
                  </button>
                </li>
                {isAdmin && (
                  <li>
                    <button
                      onClick={() => {
                        changeProfileView('send-message');
                      }}
                      className={`w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 whitespace-nowrap ${
                        profileView === 'send-message' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Poslať správu
                    </button>
                  </li>
                )}
                {isAdmin && (
                  <li className="my-2">
                    <hr className="border-t border-gray-300" />
                  </li>
                )}
                {isAdmin && (
                  <li>
                    <button
                      onClick={() => {
                        changeProfileView('users');
                      }}
                      className={`w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 whitespace-nowrap ${
                        profileView === 'users' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Používatelia
                    </button>
                  </li>
                )}
                {isAdmin && (
                  <li>
                    <button
                      onClick={() => {
                        changeProfileView('all-teams');
                      }}
                      className={`w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 whitespace-nowrap ${
                        profileView === 'all-teams' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Všetky tímy (registrácie)
                    </button>
                  </li>
                )}
                {isAdmin && (
                  <li>
                    <button
                      onClick={() => {
                        changeProfileView('tournament-settings'); 
                      }}
                      className={`w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 whitespace-nowrap ${
                        profileView === 'tournament-settings' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Nastavenia turnaja
                    </button>
                  </li>
                )}
              </ul>
            </nav>
          </div>

          <div className="flex-grow ml-[287px] p-8 bg-white rounded-lg shadow-xl overflow-x-auto overflow-y-auto mr-4">
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap" role="alert">
                {error}
              </div>
            )}

            <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">Vitajte, {user.displayName || 'Používateľ'}!</h1>
            
            {profileView === 'my-data' && (
              <MyDataView 
                user={user} 
                isEditAllowed={isEditAllowed} 
                userDataEditEndDate={userDataEditEndDate} 
                isAdmin={isAdmin}
              />
            )}

            {profileView === 'change-password' && (
              <ChangePasswordView
                user={user}
                auth={auth}
                loading={loading}
                setError={setError}
                setUserNotificationMessage={setUserNotificationMessage}
                currentPassword={currentPassword}
                setCurrentPassword={setCurrentPassword}
                newPassword={newPassword}
                setNewPassword={setNewPassword}
                confirmNewPassword={confirmNewPassword}
                setNewConfirmPassword={setNewConfirmPassword}
                showCurrentPasswordChange={showCurrentPasswordChange}
                setShowCurrentPasswordChange={setShowCurrentPasswordChange}
                showNewPasswordChange={showNewPasswordChange}
                setShowNewPasswordChange={setShowNewPasswordChange}
                showConfirmNewPasswordChange={showConfirmNewPasswordChange}
                setShowConfirmNewPasswordChange={setShowConfirmNewPasswordChange}
                handleChangePassword={handleChangePassword}
              />
            )}

            {profileView === 'change-name' && (
              <ChangeNameView
                user={user}
                auth={auth}
                db={db}
                appId={appId}
                loading={loading}
                setError={setError}
                setUserNotificationMessage={setUserNotificationMessage}
                isEditAllowed={isEditAllowed}
                userDataEditEndDate={userDataEditEndDate}
                currentPassword={currentPassword}
                setCurrentPassword={setCurrentPassword}
                newFirstName={newFirstName}
                setNewFirstName={setNewFirstName}
                newLastName={newLastName}
                setNewLastName={setNewLastName}
                showCurrentPasswordChange={showCurrentPasswordChange}
                setShowCurrentPasswordChange={setShowCurrentPasswordChange}
                handleChangeName={handleChangeName}
              />
            )}

            {profileView === 'change-phone-number' && (
              <ChangePhoneNumberView
                user={user}
                auth={auth}
                db={db}
                appId={appId}
                loading={loading}
                setError={setError}
                setUserNotificationMessage={setUserNotificationMessage}
                isEditAllowed={isEditAllowed}
                userDataEditEndDate={userDataEditEndDate}
                currentPassword={currentPassword}
                setCurrentPassword={setCurrentPassword}
                newContactPhoneNumber={newContactPhoneNumber}
                setNewContactPhoneNumber={setNewContactPhoneNumber}
                showCurrentPasswordChange={showCurrentPasswordChange}
                setShowCurrentPasswordChange={setShowCurrentPasswordChange}
                handleChangeContactPhoneNumber={handleChangeContactPhoneNumber}
              />
            )}

            {profileView === 'send-message' && isAdmin && (
              <SendMessageView
                user={user}
                db={db}
                appId={appId}
                loading={loading}
                setError={setError}
                setUserNotificationMessage={setUserNotificationMessage}
                allUsersData={allUsersData}
                checkedRecipients={checkedRecipients}
                setCheckedRecipients={setCheckedRecipients}
                messageSubject={messageSubject}
                setMessageSubject={setMessageSubject}
                messageContent={messageContent}
                setMessageContent={setMessageContent}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                filteredUsers={filteredUsers}
                handleSendMessage={handleSendMessage}
                handleToggleAll={handleToggleAll}
                handleIndividualRecipientChange={handleIndividualRecipientChange}
                isAllChecked={isAllChecked}
              />
            )}

            {profileView === 'users' && isAdmin && (
              <UsersView
                user={user}
                db={db}
                loading={loading}
                setError={setError}
                setUserNotificationMessage={setUserNotificationMessage}
                allUsersData={allUsersData}
                openDeleteConfirmationModal={openDeleteConfirmationModal}
                openRoleEditModal={openRoleEditModal}
                handleApproveUser={handleApproveUser}
              />
            )}

            {profileView === 'all-teams' && isAdmin && (
              <AllTeamsView
                allUsersData={allUsersData}
              />
            )}

            {profileView === 'tournament-settings' && isAdmin && (
              <TournamentSettingsView
                db={db}
                isAdmin={isAdmin}
                loading={loading}
                setError={setError}
                setUserNotificationMessage={setUserNotificationMessage}
                registrationStartDate={registrationStartDate}
                setRegistrationStartDate={setRegistrationStartDate}
                registrationEndDate={registrationEndDate}
                setRegistrationEndDate={setRegistrationEndDate}
                userDataEditEndDate={userDataEditEndDate}
                setUserDataEditEndDate={setUserDataEditEndDate}
                handleSaveSettings={handleSaveSettings}
              />
            )}

            {profileView === 'my-settings' && user && (
              <MySettingsView
                user={user}
                db={db}
                loading={loading}
                setError={setError}
                setUserNotificationMessage={setUserNotificationMessage}
                handleToggleDisplayNotifications={handleToggleDisplayNotifications}
              />
            )}

            {profileView === 'notifications' && user && (
              <NotificationsView
                user={user}
                db={db}
                appId={appId}
                isAdmin={isAdmin}
                loading={loading}
                setError={setError}
                setUserNotificationMessage={setUserNotificationMessage}
                userNotifications={userNotifications}
                dismissNotification={dismissNotification}
                markMessageAsRead={markMessageAsRead}
                handleClearNotifications={handleClearNotifications}
              />
            )}
          </div>
        </div>

        {showDeleteConfirmationModal && (
          <DeleteConfirmationModal
            userToDelete={userToDelete}
            loading={loading}
            closeDeleteConfirmationModal={closeDeleteConfirmationModal}
            handleDeleteUser={handleDeleteUser}
          />
        )}

        {showRoleEditModal && (
          <RoleEditModal
            userToEditRole={userToEditRole}
            newRole={newRole}
            setNewRole={setNewRole}
            loading={loading}
            closeRoleEditModal={closeRoleEditModal}
            handleUpdateUserRole={handleUpdateUserRole}
          />
        )}
      </div>
    );
  }

  return null;
}

// Render the App component into the root element
// This part is crucial for the React app to initialize
// It's placed outside the App component function to avoid re-rendering issues
// and to ensure it runs once the DOM is ready and React is loaded.
if (typeof React === 'undefined' || typeof ReactDOM === 'undefined') {
  console.error("Chyba: React alebo ReactDOM nie sú načítané. Skontrolujte poradie skriptov.");
  document.getElementById('root').innerHTML = '<div style="color: red; text-align: center; padding: 20px;">Chyba pri načítaní aplikácie. Skúste to prosím neskôr.</div>';
} else {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(React.createElement(App, null));
}
