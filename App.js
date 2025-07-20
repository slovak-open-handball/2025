import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, updatePassword, updateEmail } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, collection, query, where, onSnapshot, updateDoc, deleteDoc, addDoc, getDocs } from 'firebase/firestore';
import React, { useState, useEffect, useCallback, useMemo } from 'react';

// Globálne premenné pre Firebase konfiguráciu a token
// Tieto premenné sú poskytované prostredím Canvas
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Inicializácia Firebase aplikácie
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Komponenta pre vstup hesla s prepínaním viditeľnosti
function PasswordInput({ id, label, value, onChange, placeholder, autoComplete, showPassword, toggleShowPassword, onCopy, onPaste, onCut, disabled, description }) {
  // SVG ikony pre prepínanie viditeľnosti hesla
  const EyeIcon = (
    <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );

  const EyeOffIcon = (
    <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19.5c-4.638 0-8.573-3.007-9.963-7.178.07-.207.07-.431 0-.639C3.423 7.51 7.36 4.5 12 4.5c1.237 0 2.44.298 3.562.832M15 12a3 3 0 11-6 0 3 3 0 016 0zm-3 0l.008.008z" />
    </svg>
  );

  return (
    <div className="mb-4">
      <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          type={showPassword ? 'text' : 'password'}
          id={id}
          className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          onCopy={onCopy}
          onPaste={onPaste}
          onCut={onCut}
          disabled={disabled}
        />
        <button
          type="button"
          onClick={toggleShowPassword}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
        >
          {showPassword ? EyeIcon : EyeOffIcon}
        </button>
      </div>
      {description && <p className="text-gray-600 text-xs italic mt-1">{description}</p>}
    </div>
  );
}

// Komponenta pre zobrazenie modálneho okna
const Modal = ({ show, onClose, children, title }) => {
  if (!show) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-auto">
        {title && <h3 className="text-xl font-semibold mb-4 text-gray-800">{title}</h3>}
        {children}
        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors duration-200"
          >
            Zavrieť
          </button>
        </div>
      </div>
    </div>
  );
};

// Hlavná komponenta aplikácie
export default function App() {
  const [currentPage, setCurrentPage] = useState(window.location.pathname);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showNewConfirmPassword, setShowNewConfirmPassword] = useState(false);

  // Formulárové stavy pre registráciu
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('user'); // Defaultne 'user' pre registráciu
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [clubName, setClubName] = useState('');
  const [ico, setIco] = useState('');
  const [dic, setDic] = useState('');
  const [street, setStreet] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [isApproved, setIsApproved] = useState(false); // Pre registráciu vždy false

  // Formulárové stavy pre prihlásenie
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Stavy pre zmenu hesla a emailu
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newConfirmPassword, setNewConfirmPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');

  // Stavy pre správu používateľov (Admin panel)
  const [users, setUsers] = useState([]);
  const [userToEditRole, setUserToEditRole] = useState(null);
  const [newRole, setNewRole] = useState('user');
  const [showRoleEditModal, setShowRoleEditModal] = useState(false);

  // Stavy pre notifikácie
  const [notifications, setNotifications] = useState([]);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState('info'); // 'info', 'success', 'error'

  // Stavy pre registráciu na turnaj
  const [tournamentRegistrations, setTournamentRegistrations] = useState([]);
  const [showTournamentRegistrationModal, setShowTournamentRegistrationModal] = useState(false);
  const [selectedRegistration, setSelectedRegistration] = useState(null); // Pre detaily/schválenie

  // Stavy pre správu turnaja (Admin panel)
  const [tournamentName, setTournamentName] = useState('');
  const [tournamentDate, setTournamentDate] = useState('');
  const [tournamentLocation, setTournamentLocation] = useState('');
  const [tournaments, setTournaments] = useState([]);
  const [showTournamentForm, setShowTournamentForm] = useState(false);
  const [editingTournament, setEditingTournament] = useState(null);

  // Funkcia na zobrazenie notifikácie
  const showTemporaryNotification = useCallback((message, type = 'info', duration = 3000) => {
    setNotificationMessage(message);
    setNotificationType(type);
    setShowNotificationModal(true);
    setTimeout(() => setShowNotificationModal(false), duration);
  }, []);

  // Inicializácia Firebase a overenie tokenu
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        if (initialAuthToken) {
          await signInWithCustomToken(auth, initialAuthToken);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Chyba pri inicializácii autentifikácie:", err);
        showTemporaryNotification(`Chyba pri inicializácii autentifikácie: ${err.message}`, 'error');
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Listener pre zmeny stavu autentifikácie
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Načítanie užívateľských dát z Firestore
        const userDocRef = doc(db, `artifacts/${appId}/users/${currentUser.uid}/profile/data`);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          setUser(prevUser => ({ ...prevUser, ...userDocSnap.data() }));
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [showTemporaryNotification]);

  // Načítanie používateľov pre admina
  useEffect(() => {
    if (user && user.role === 'admin' && currentPage === '/admin-register.html') {
      const usersColRef = collection(db, `artifacts/${appId}/public/data/registrations`);
      const unsubscribe = onSnapshot(usersColRef, (snapshot) => {
        const usersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setUsers(usersList);
      }, (err) => {
        console.error("Chyba pri načítaní používateľov:", err);
        showTemporaryNotification(`Chyba pri načítaní používateľov: ${err.message}`, 'error');
      });
      return () => unsubscribe();
    }
  }, [user, currentPage, showTemporaryNotification]);

  // Načítanie notifikácií pre prihláseného používateľa
  useEffect(() => {
    if (user && user.uid && currentPage === '/logged-in.html') {
      const notificationsColRef = collection(db, `artifacts/${appId}/users/${user.uid}/notifications`);
      const q = query(notificationsColRef);
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const notificationsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Zoradenie notifikácií od najnovších po najstaršie
        setNotifications(notificationsList.sort((a, b) => b.timestamp - a.timestamp));
      }, (err) => {
        console.error("Chyba pri načítaní notifikácií:", err);
        showTemporaryNotification(`Chyba pri načítaní notifikácií: ${err.message}`, 'error');
      });
      return () => unsubscribe();
    }
  }, [user, currentPage, showTemporaryNotification]);

  // Načítanie registrácií na turnaj (pre admina)
  useEffect(() => {
    if (user && user.role === 'admin' && currentPage === '/logged-in.html') {
      const registrationsColRef = collection(db, `artifacts/${appId}/public/data/tournamentRegistrations`);
      const unsubscribe = onSnapshot(registrationsColRef, (snapshot) => {
        const regsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setTournamentRegistrations(regsList);
      }, (err) => {
        console.error("Chyba pri načítaní registrácií na turnaj:", err);
        showTemporaryNotification(`Chyba pri načítaní registrácií na turnaj: ${err.message}`, 'error');
      });
      return () => unsubscribe();
    }
  }, [user, currentPage, showTemporaryNotification]);

  // Načítanie turnajov (pre admina a zobrazenie)
  useEffect(() => {
    if (user && user.role === 'admin' && currentPage === '/logged-in.html') {
      const tournamentsColRef = collection(db, `artifacts/${appId}/public/data/tournaments`);
      const unsubscribe = onSnapshot(tournamentsColRef, (snapshot) => {
        const tournamentsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setTournaments(tournamentsList);
      }, (err) => {
        console.error("Chyba pri načítaní turnajov:", err);
        showTemporaryNotification(`Chyba pri načítaní turnajov: ${err.message}`, 'error');
      });
      return () => unsubscribe();
    }
  }, [user, currentPage, showTemporaryNotification]);

  // Funkcie pre navigáciu
  const navigate = useCallback((path) => {
    window.history.pushState({}, '', path);
    setCurrentPage(path);
    setError('');
    setSuccessMessage('');
  }, []);

  // Funkcia pre registráciu nového používateľa
  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    if (password !== confirmPassword) {
      setError('Heslá sa nezhodujú!');
      setLoading(false);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;

      // Uloženie užívateľských dát do Firestore
      const userDocRef = doc(db, `artifacts/${appId}/users/${newUser.uid}/profile/data`);
      await setDoc(userDocRef, {
        email: newUser.email,
        firstName,
        lastName,
        phone,
        clubName,
        ico,
        dic,
        street,
        zipCode,
        city,
        country,
        role: 'user', // Vždy defaultne 'user' pre bežnú registráciu
        isApproved: false, // Vždy false pre bežnú registráciu
        createdAt: new Date(),
      });

      setSuccessMessage('Registrácia bola úspešná! Boli ste prihlásený.');
      navigate('/logged-in.html'); // Presmerovanie na prihlásenú stránku
    } catch (err) {
      console.error("Chyba pri registrácii:", err);
      setError(`Chyba pri registrácii: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Funkcia pre registráciu administrátora (len pre existujúceho admina)
  const handleAdminRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    if (!user || user.role !== 'admin') {
      setError('Nemáte oprávnenie na registráciu administrátorov.');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Heslá sa nezhodujú!');
      setLoading(false);
      return;
    }

    try {
      // Vytvorenie nového používateľa (ak neexistuje)
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;

      // Uloženie užívateľských dát do verejnej kolekcie 'registrations'
      const registrationDocRef = doc(db, `artifacts/${appId}/public/data/registrations/${newUser.uid}`);
      await setDoc(registrationDocRef, {
        email: newUser.email,
        firstName,
        lastName,
        phone,
        clubName,
        ico,
        dic,
        street,
        zipCode,
        city,
        country,
        role: role, // Rola nastavená adminom
        isApproved: isApproved, // Schválenie nastavené adminom
        createdAt: new Date(),
      });

      // Uloženie užívateľských dát do ich súkromnej profilovej kolekcie
      const userProfileDocRef = doc(db, `artifacts/${appId}/users/${newUser.uid}/profile/data`);
      await setDoc(userProfileDocRef, {
        email: newUser.email,
        firstName,
        lastName,
        phone,
        clubName,
        ico,
        dic,
        street,
        zipCode,
        city,
        country,
        role: role,
        isApproved: isApproved,
        createdAt: new Date(),
      });

      setSuccessMessage(`Používateľ ${email} bol úspešne zaregistrovaný s rolou ${role}.`);
      // Vyčistenie formulára
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setFirstName('');
      setLastName('');
      setPhone('');
      setClubName('');
      setIco('');
      setDic('');
      setStreet('');
      setZipCode('');
      setCity('');
      setCountry('');
      setRole('user');
      setIsApproved(false);

    } catch (err) {
      console.error("Chyba pri registrácii administrátora:", err);
      setError(`Chyba pri registrácii: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };


  // Funkcia pre prihlásenie
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      setSuccessMessage('Prihlásenie bolo úspešné!');
      navigate('/logged-in.html');
    } catch (err) {
      console.error("Chyba pri prihlásení:", err);
      setError(`Chyba pri prihlásení: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Funkcia pre odhlásenie
  const handleLogout = async () => {
    setLoading(true);
    setError('');
    setSuccessMessage('');
    try {
      await signOut(auth);
      setSuccessMessage('Boli ste úspešne odhlásený.');
      navigate('/login.html'); // Presmerovanie na prihlasovaciu stránku
    } catch (err) {
      console.error("Chyba pri odhlásení:", err);
      setError(`Chyba pri odhlásení: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Funkcia pre reset hesla
  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      await sendPasswordResetEmail(auth, loginEmail);
      setSuccessMessage('Inštrukcie na reset hesla boli odoslané na váš e-mail.');
    } catch (err) {
      console.error("Chyba pri resete hesla:", err);
      setError(`Chyba pri resete hesla: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Funkcia pre zmenu mena a priezviska
  const handleNameChange = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    if (!user) {
      setError('Nie ste prihlásený.');
      setLoading(false);
      return;
    }

    try {
      const userDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/profile/data`);
      await updateDoc(userDocRef, {
        firstName: firstName,
        lastName: lastName,
      });
      setUser(prevUser => ({ ...prevUser, firstName, lastName }));
      setSuccessMessage('Meno a priezvisko boli úspešne zmenené.');
    } catch (err) {
      console.error("Chyba pri zmene mena/priezviska:", err);
      setError(`Chyba pri zmene mena/priezviska: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Funkcia pre zmenu hesla
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    if (newPassword !== newConfirmPassword) {
      setError('Nové heslá sa nezhodujú!');
      setLoading(false);
      return;
    }

    if (!user) {
      setError('Nie ste prihlásený.');
      setLoading(false);
      return;
    }

    try {
      // Re-autentifikácia používateľa pred zmenou hesla
      const credential = await signInWithEmailAndPassword(auth, user.email, currentPassword);
      await updatePassword(credential.user, newPassword);
      setSuccessMessage('Heslo bolo úspešne zmenené.');
      setCurrentPassword('');
      setNewPassword('');
      setNewConfirmPassword('');
    } catch (err) {
      console.error("Chyba pri zmene hesla:", err);
      setError(`Chyba pri zmene hesla: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Funkcia pre zmenu e-mailu
  const handleChangeEmail = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    if (!user) {
      setError('Nie ste prihlásený.');
      setLoading(false);
      return;
    }

    try {
      // Re-autentifikácia používateľa pred zmenou e-mailu
      const credential = await signInWithEmailAndPassword(auth, user.email, currentPassword);
      await updateEmail(credential.user, newEmail);

      // Aktualizácia e-mailu aj vo Firestore
      const userDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/profile/data`);
      await updateDoc(userDocRef, { email: newEmail });

      setUser(prevUser => ({ ...prevUser, email: newEmail }));
      setSuccessMessage('E-mail bol úspešne zmenený.');
      setNewEmail('');
      setCurrentPassword('');
    } catch (err) {
      console.error("Chyba pri zmene e-mailu:", err);
      setError(`Chyba pri zmene e-mailu: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Funkcia na vymazanie notifikácie
  const handleDeleteNotification = async (notificationId) => {
    setLoading(true);
    setError('');
    setSuccessMessage('');
    try {
      const notificationDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/notifications`, notificationId);
      await deleteDoc(notificationDocRef);
      showTemporaryNotification('Notifikácia bola úspešne vymazaná.', 'success');
    } catch (err) {
      console.error("Chyba pri mazaní notifikácie:", err);
      showTemporaryNotification(`Chyba pri mazaní notifikácie: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Funkcia na vymazanie všetkých notifikácií
  const handleDeleteAllNotifications = async () => {
    setLoading(true);
    setError('');
    setSuccessMessage('');
    try {
      const notificationsColRef = collection(db, `artifacts/${appId}/users/${user.uid}/notifications`);
      const snapshot = await getDocs(notificationsColRef);
      const batch = db.batch(); // Použitie batch pre hromadné mazanie
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      showTemporaryNotification('Všetky notifikácie boli úspešne vymazané.', 'success');
    } catch (err) {
      console.error("Chyba pri mazaní všetkých notifikácií:", err);
      showTemporaryNotification(`Chyba pri mazaní všetkých notifikácií: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };


  // Funkcia na otvorenie modálneho okna pre úpravu roly
  const openRoleEditModal = (user) => {
    setUserToEditRole(user);
    setNewRole(user.role);
    setShowRoleEditModal(true);
  };

  // Funkcia na zatvorenie modálneho okna pre úpravu roly
  const closeRoleEditModal = () => {
    setUserToEditRole(null);
    setNewRole('user');
    setShowRoleEditModal(false);
  };

  // Funkcia na aktualizáciu roly používateľa
  const handleUpdateUserRole = async () => {
    setLoading(true);
    setError('');
    setSuccessMessage('');

    if (!userToEditRole) {
      setError('Žiadny používateľ na úpravu.');
      setLoading(false);
      return;
    }

    try {
      // Aktualizácia roly vo verejnej kolekcii registrácií
      const registrationDocRef = doc(db, `artifacts/${appId}/public/data/registrations/${userToEditRole.id}`);
      await updateDoc(registrationDocRef, { role: newRole });

      // Aktualizácia roly v súkromnej profilovej kolekcii používateľa
      const userProfileDocRef = doc(db, `artifacts/${appId}/users/${userToEditRole.id}/profile/data`);
      await updateDoc(userProfileDocRef, { role: newRole });

      showTemporaryNotification(`Rola používateľa ${userToEditRole.email} bola úspešne zmenená na ${newRole}.`, 'success');
      closeRoleEditModal();
    } catch (err) {
      console.error("Chyba pri aktualizácii roly:", err);
      setError(`Chyba pri aktualizácii roly: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Funkcia na schválenie/neschválenie používateľa
  const handleToggleUserApproval = async (userToToggle) => {
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const newApprovalStatus = !userToToggle.isApproved;

      // Aktualizácia stavu schválenia vo verejnej kolekcii registrácií
      const registrationDocRef = doc(db, `artifacts/${appId}/public/data/registrations/${userToToggle.id}`);
      await updateDoc(registrationDocRef, { isApproved: newApprovalStatus });

      // Aktualizácia stavu schválenia v súkromnej profilovej kolekcii používateľa
      const userProfileDocRef = doc(db, `artifacts/${appId}/users/${userToToggle.id}/profile/data`);
      await updateDoc(userProfileDocRef, { isApproved: newApprovalStatus });

      showTemporaryNotification(`Používateľ ${userToToggle.email} bol ${newApprovalStatus ? 'schválený' : 'neschválený'}.`, 'success');
    } catch (err) {
      console.error("Chyba pri zmene stavu schválenia:", err);
      setError(`Chyba pri zmene stavu schválenia: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Funkcia na vymazanie používateľa (len pre admina)
  const handleDeleteUser = async (userToDelete) => {
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      // Najprv vymazať používateľa z Firebase Authentication
      // Toto je komplexnejšie a vyžaduje server-side logiku alebo Cloud Functions
      // Pre zjednodušenie v tomto klient-side kóde vymažeme len záznamy z Firestore.
      // V reálnej aplikácii by ste mali zabezpečiť aj zmazanie z Auth.

      // Vymazanie z verejnej kolekcie registrácií
      const registrationDocRef = doc(db, `artifacts/${appId}/public/data/registrations/${userToDelete.id}`);
      await deleteDoc(registrationDocRef);

      // Vymazanie z privátnej profilovej kolekcie používateľa
      const userProfileDocRef = doc(db, `artifacts/${appId}/users/${userToDelete.id}/profile/data`);
      await deleteDoc(userProfileDocRef);

      showTemporaryNotification(`Používateľ ${userToDelete.email} bol úspešne vymazaný.`, 'success');
    } catch (err) {
      console.error("Chyba pri mazaní používateľa:", err);
      setError(`Chyba pri mazaní používateľa: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Funkcia pre registráciu na turnaj
  const handleTournamentRegistration = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    if (!user) {
      setError('Pre registráciu na turnaj musíte byť prihlásený.');
      setLoading(false);
      return;
    }

    try {
      // Kontrola, či užívateľ už nie je zaregistrovaný
      const q = query(collection(db, `artifacts/${appId}/public/data/tournamentRegistrations`), where('userId', '==', user.uid));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        setError('Už ste zaregistrovaný na turnaj.');
        setLoading(false);
        return;
      }

      const registrationData = {
        userId: user.uid,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        clubName: user.clubName,
        ico: user.ico,
        dic: user.dic,
        street: user.street,
        zipCode: user.zipCode,
        city: user.city,
        country: user.country,
        registeredAt: new Date(),
        // Ďalšie polia špecifické pre registráciu na turnaj
      };

      await addDoc(collection(db, `artifacts/${appId}/public/data/tournamentRegistrations`), registrationData);
      showTemporaryNotification('Úspešne ste sa zaregistrovali na turnaj!', 'success');
    } catch (err) {
      console.error("Chyba pri registrácii na turnaj:", err);
      setError(`Chyba pri registrácii na turnaj: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Funkcia pre schválenie/neschválenie registrácie na turnaj
  const handleToggleTournamentApproval = async (registrationId, currentStatus) => {
    setLoading(true);
    setError('');
    setSuccessMessage('');
    try {
      const regDocRef = doc(db, `artifacts/${appId}/public/data/tournamentRegistrations`, registrationId);
      await updateDoc(regDocRef, { isApproved: !currentStatus });
      showTemporaryNotification(`Registrácia bola ${!currentStatus ? 'schválená' : 'neschválená'}.`, 'success');
    } catch (err) {
      console.error("Chyba pri zmene stavu schválenia registrácie:", err);
      showTemporaryNotification(`Chyba pri zmene stavu schválenia registrácie: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Funkcia pre vymazanie registrácie na turnaj
  const handleDeleteTournamentRegistration = async (registrationId) => {
    setLoading(true);
    setError('');
    setSuccessMessage('');
    try {
      const regDocRef = doc(db, `artifacts/${appId}/public/data/tournamentRegistrations`, registrationId);
      await deleteDoc(regDocRef);
      showTemporaryNotification('Registrácia na turnaj bola vymazaná.', 'success');
    } catch (err) {
      console.error("Chyba pri mazaní registrácie na turnaj:", err);
      showTemporaryNotification(`Chyba pri mazaní registrácie na turnaj: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Funkcie pre správu turnajov
  const handleAddTournament = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const tournamentData = {
        name: tournamentName,
        date: tournamentDate,
        location: tournamentLocation,
        createdAt: new Date(),
      };
      await addDoc(collection(db, `artifacts/${appId}/public/data/tournaments`), tournamentData);
      showTemporaryNotification('Turnaj bol úspešne pridaný!', 'success');
      setTournamentName('');
      setTournamentDate('');
      setTournamentLocation('');
      setShowTournamentForm(false);
    } catch (err) {
      console.error("Chyba pri pridávaní turnaja:", err);
      setError(`Chyba pri pridávaní turnaja: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEditTournament = (tournament) => {
    setEditingTournament(tournament);
    setTournamentName(tournament.name);
    setTournamentDate(tournament.date);
    setTournamentLocation(tournament.location);
    setShowTournamentForm(true);
  };

  const handleUpdateTournament = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    if (!editingTournament) {
      setError('Žiadny turnaj na úpravu.');
      setLoading(false);
      return;
    }

    try {
      const tournamentDocRef = doc(db, `artifacts/${appId}/public/data/tournaments`, editingTournament.id);
      await updateDoc(tournamentDocRef, {
        name: tournamentName,
        date: tournamentDate,
        location: tournamentLocation,
      });
      showTemporaryNotification('Turnaj bol úspešne aktualizovaný!', 'success');
      setEditingTournament(null);
      setTournamentName('');
      setTournamentDate('');
      setTournamentLocation('');
      setShowTournamentForm(false);
    } catch (err) {
      console.error("Chyba pri aktualizácii turnaja:", err);
      setError(`Chyba pri aktualizácii turnaja: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTournament = async (tournamentId) => {
    setLoading(true);
    setError('');
    setSuccessMessage('');
    try {
      const tournamentDocRef = doc(db, `artifacts/${appId}/public/data/tournaments`, tournamentId);
      await deleteDoc(tournamentDocRef);
      showTemporaryNotification('Turnaj bol úspešne vymazaný!', 'success');
    } catch (err) {
      console.error("Chyba pri mazaní turnaja:", err);
      setError(`Chyba pri mazaní turnaja: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Funkcia pre zobrazenie obsahu na základe aktuálnej cesty
  const renderContent = useCallback(() => {
    if (loading) {
      return (
        <div className="flex justify-center items-center h-screen">
          <div className="text-xl font-semibold text-gray-700">Načítavam...</div>
        </div>
      );
    }

    switch (currentPage) {
      case '/register.html':
        return (
          <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4 pt-16">
            <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
              <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Registrácia</h2>
              {error && <p className="text-red-500 text-center mb-4">{error}</p>}
              {successMessage && <p className="text-green-500 text-center mb-4">{successMessage}</p>}
              <form onSubmit={handleRegister}>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">E-mail</label>
                  <input
                    type="email"
                    id="email"
                    className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                    placeholder="Váš e-mail"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <PasswordInput
                  id="password"
                  label="Heslo"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Zadajte heslo"
                  autoComplete="new-password"
                  showPassword={showPassword}
                  toggleShowPassword={() => setShowPassword(!showPassword)}
                  description="Minimálne 6 znakov"
                />
                <PasswordInput
                  id="confirm-password"
                  label="Potvrdiť heslo"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Zopakujte heslo"
                  autoComplete="new-password"
                  showPassword={showConfirmPassword}
                  toggleShowPassword={() => setShowConfirmPassword(!showConfirmPassword)}
                />
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="firstName">Meno</label>
                  <input
                    type="text"
                    id="firstName"
                    className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                    placeholder="Vaše meno"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="lastName">Priezvisko</label>
                  <input
                    type="text"
                    id="lastName"
                    className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                    placeholder="Vaše priezvisko"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="phone">Telefónne číslo</label>
                  <input
                    type="tel"
                    id="phone"
                    className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                    placeholder="Napr. +4219XX XXX XXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="clubName">Názov klubu</label>
                  <input
                    type="text"
                    id="clubName"
                    className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                    placeholder="Názov vášho klubu"
                    value={clubName}
                    onChange={(e) => setClubName(e.target.value)}
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="ico">IČO</label>
                  <input
                    type="text"
                    id="ico"
                    className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                    placeholder="IČO (nepovinné)"
                    value={ico}
                    onChange={(e) => setIco(e.target.value)}
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="dic">DIČ</label>
                  <input
                    type="text"
                    id="dic"
                    className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                    placeholder="DIČ (nepovinné)"
                    value={dic}
                    onChange={(e) => setDic(e.target.value)}
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="street">Ulica a číslo</label>
                  <input
                    type="text"
                    id="street"
                    className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                    placeholder="Ulica a číslo domu"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="zipCode">PSČ</label>
                  <input
                    type="text"
                    id="zipCode"
                    className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                    placeholder="PSČ"
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value)}
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="city">Mesto</label>
                  <input
                    type="text"
                    id="city"
                    className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                    placeholder="Mesto"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>
                <div className="mb-6">
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="country">Krajina</label>
                  <input
                    type="text"
                    id="country"
                    className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                    placeholder="Krajina"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200"
                  disabled={loading}
                >
                  {loading ? 'Registrujem...' : 'Registrovať'}
                </button>
              </form>
              <p className="text-center text-gray-600 text-sm mt-4">
                Už máte účet?{' '}
                <button onClick={() => navigate('/login.html')} className="text-blue-600 hover:underline font-semibold">
                  Prihláste sa
                </button>
              </p>
            </div>
          </div>
        );

      case '/admin-register.html':
        if (!user || user.role !== 'admin') {
          return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4 pt-16">
              <div className="bg-white p-8 rounded-lg shadow-md">
                <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Prístup odmietnutý</h2>
                <p className="text-gray-700 text-center">Nemáte oprávnenie na prístup k tejto stránke.</p>
                <div className="flex justify-center mt-4">
                  <button onClick={() => navigate('/login.html')} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200">
                    Prihlásiť sa
                  </button>
                </div>
              </div>
            </div>
          );
        }
        return (
          <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4 pt-16">
            <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md mb-8">
              <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Registrácia nového admina/používateľa</h2>
              {error && <p className="text-red-500 text-center mb-4">{error}</p>}
              {successMessage && <p className="text-green-500 text-center mb-4">{successMessage}</p>}
              <form onSubmit={handleAdminRegister}>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="admin-email">E-mail</label>
                  <input
                    type="email"
                    id="admin-email"
                    className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                    placeholder="E-mail nového používateľa"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <PasswordInput
                  id="admin-password"
                  label="Heslo"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Zadajte heslo"
                  autoComplete="new-password"
                  showPassword={showPassword}
                  toggleShowPassword={() => setShowPassword(!showPassword)}
                  description="Minimálne 6 znakov"
                />
                <PasswordInput
                  id="admin-confirm-password"
                  label="Potvrdiť heslo"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Zopakujte heslo"
                  autoComplete="new-password"
                  showPassword={showConfirmPassword}
                  toggleShowPassword={() => setShowConfirmPassword(!showConfirmPassword)}
                />
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="admin-firstName">Meno</label>
                  <input
                    type="text"
                    id="admin-firstName"
                    className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                    placeholder="Meno"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="admin-lastName">Priezvisko</label>
                  <input
                    type="text"
                    id="admin-lastName"
                    className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                    placeholder="Priezvisko"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="admin-phone">Telefónne číslo</label>
                  <input
                    type="tel"
                    id="admin-phone"
                    className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                    placeholder="Telefónne číslo"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="admin-clubName">Názov klubu</label>
                  <input
                    type="text"
                    id="admin-clubName"
                    className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                    placeholder="Názov klubu"
                    value={clubName}
                    onChange={(e) => setClubName(e.target.value)}
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="admin-ico">IČO</label>
                  <input
                    type="text"
                    id="admin-ico"
                    className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                    placeholder="IČO (nepovinné)"
                    value={ico}
                    onChange={(e) => setIco(e.target.value)}
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="admin-dic">DIČ</label>
                  <input
                    type="text"
                    id="admin-dic"
                    className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                    placeholder="DIČ (nepovinné)"
                    value={dic}
                    onChange={(e) => setDic(e.target.value)}
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="admin-street">Ulica a číslo</label>
                  <input
                    type="text"
                    id="admin-street"
                    className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                    placeholder="Ulica a číslo domu"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="admin-zipCode">PSČ</label>
                  <input
                    type="text"
                    id="admin-zipCode"
                    className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                    placeholder="PSČ"
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value)}
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="admin-city">Mesto</label>
                  <input
                    type="text"
                    id="admin-city"
                    className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                    placeholder="Mesto"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="admin-country">Krajina</label>
                  <input
                    type="text"
                    id="admin-country"
                    className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                    placeholder="Krajina"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="admin-role">Rola</label>
                  <select
                    id="admin-role"
                    className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <option value="user">Používateľ</option>
                    <option value="admin">Administrátor</option>
                  </select>
                </div>
                <div className="mb-6 flex items-center">
                  <input
                    type="checkbox"
                    id="admin-isApproved"
                    className="mr-2 leading-tight"
                    checked={isApproved}
                    onChange={(e) => setIsApproved(e.target.checked)}
                  />
                  <label className="text-gray-700 text-sm font-bold" htmlFor="admin-isApproved">Schválený</label>
                </div>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200"
                  disabled={loading}
                >
                  {loading ? 'Registrujem...' : 'Registrovať používateľa'}
                </button>
              </form>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-4xl">
              <h3 className="text-2xl font-bold mb-6 text-center text-gray-800">Správa používateľov</h3>
              {users.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white rounded-lg shadow overflow-hidden">
                    <thead className="bg-gray-200 text-gray-700">
                      <tr>
                        <th className="py-3 px-4 text-left">E-mail</th>
                        <th className="py-3 px-4 text-left">Meno</th>
                        <th className="py-3 px-4 text-left">Priezvisko</th>
                        <th className="py-3 px-4 text-left">Telefón</th>
                        <th className="py-3 px-4 text-left">Klub</th>
                        <th className="py-3 px-4 text-left">IČO</th>
                        <th className="py-3 px-4 text-left">DIČ</th>
                        <th className="py-3 px-4 text-left">Ulica</th>
                        <th className="py-3 px-4 text-left">PSČ</th>
                        <th className="py-3 px-4 text-left">Mesto</th>
                        <th className="py-3 px-4 text-left">Krajina</th>
                        <th className="py-3 px-4 text-left">Rola</th>
                        <th className="py-3 px-4 text-left">Schválený</th>
                        <th className="py-3 px-4 text-left">Akcie</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((userItem) => (
                        <tr key={userItem.id} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="py-3 px-4">{userItem.email}</td>
                          <td className="py-3 px-4">{userItem.firstName}</td>
                          <td className="py-3 px-4">{userItem.lastName}</td>
                          <td className="py-3 px-4">{userItem.phone}</td>
                          <td className="py-3 px-4">{userItem.clubName}</td>
                          <td className="py-3 px-4">{userItem.ico}</td>
                          <td className="py-3 px-4">{userItem.dic}</td>
                          <td className="py-3 px-4">{userItem.street}</td>
                          <td className="py-3 px-4">{userItem.zipCode}</td>
                          <td className="py-3 px-4">{userItem.city}</td>
                          <td className="py-3 px-4">{userItem.country}</td>
                          <td className="py-3 px-4">{userItem.role}</td>
                          <td className="py-3 px-4">{userItem.isApproved ? 'Áno' : 'Nie'}</td>
                          <td className="py-3 px-4 flex space-x-2">
                            <button
                              onClick={() => openRoleEditModal(userItem)}
                              className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded-lg text-sm transition-colors duration-200"
                            >
                              Upraviť rolu
                            </button>
                            <button
                              onClick={() => handleToggleUserApproval(userItem)}
                              className={`px-3 py-1 rounded-lg text-sm transition-colors duration-200 ${userItem.isApproved ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'} text-white`}
                            >
                              {userItem.isApproved ? 'Neschváliť' : 'Schváliť'}
                            </button>
                            <button
                              onClick={() => handleDeleteUser(userItem)}
                              className="bg-red-700 hover:bg-red-800 text-white px-3 py-1 rounded-lg text-sm transition-colors duration-200"
                            >
                              Vymazať
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-600 text-center">Žiadne registračné údaje na zobrazenie alebo načítavanie...</p>
              )}
            </div>

            {/* Modálne okno pre úpravu roly */}
            {showRoleEditModal && userToEditRole && (
              <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-auto">
                  <h3 className="text-xl font-semibold mb-4">Upraviť rolu pre {userToEditRole?.email}</h3>
                  <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="new-user-role">Nová rola</label>
                    <select
                      id="new-user-role"
                      className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                    >
                      <option value="user">Používateľ</option>
                      <option value="admin">Administrátor</option>
                    </select>
                  </div>
                  <div className="flex justify-end space-x-4">
                    <button
                      onClick={closeRoleEditModal}
                      className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors duration-200"
                    >
                      Zrušiť
                    </button>
                    <button
                      onClick={handleUpdateUserRole}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
                      disabled={loading}
                    >
                      {loading ? 'Ukladám...' : 'Uložiť'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case '/login.html':
        return (
          <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4 pt-16">
            <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
              <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Prihlásenie</h2>
              {error && <p className="text-red-500 text-center mb-4">{error}</p>}
              {successMessage && <p className="text-green-500 text-center mb-4">{successMessage}</p>}
              <form onSubmit={handleLogin}>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="login-email">E-mail</label>
                  <input
                    type="email"
                    id="login-email"
                    className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                    placeholder="Váš e-mail"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                </div>
                <PasswordInput
                  id="login-password"
                  label="Heslo"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Vaše heslo"
                  autoComplete="current-password"
                  showPassword={showPassword}
                  toggleShowPassword={() => setShowPassword(!showPassword)}
                />
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200"
                  disabled={loading}
                >
                  {loading ? 'Prihlasujem...' : 'Prihlásiť sa'}
                </button>
              </form>
              <p className="text-center text-gray-600 text-sm mt-4">
                Nemáte účet?{' '}
                <button onClick={() => navigate('/register.html')} className="text-blue-600 hover:underline font-semibold">
                  Zaregistrujte sa
                </button>
              </p>
              <p className="text-center text-gray-600 text-sm mt-2">
                Zabudli ste heslo?{' '}
                <button onClick={handlePasswordReset} className="text-blue-600 hover:underline font-semibold" disabled={loading}>
                  Resetovať heslo
                </button>
              </p>
            </div>
          </div>
        );

      case '/logged-in.html':
        if (!user) {
          return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4 pt-16">
              <div className="bg-white p-8 rounded-lg shadow-md">
                <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Prístup odmietnutý</h2>
                <p className="text-gray-700 text-center">Pre zobrazenie tejto stránky sa musíte prihlásiť.</p>
                <div className="flex justify-center mt-4">
                  <button onClick={() => navigate('/login.html')} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200">
                    Prihlásiť sa
                  </button>
                </div>
              </div>
            </div>
          );
        }

        return (
          <div className="flex flex-col md:flex-row min-h-screen bg-gray-100 pt-16">
            {/* Bočné menu */}
            <div className="w-full md:w-64 bg-white shadow-md p-6">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">Menu</h3>
              <ul className="space-y-2">
                <li><button onClick={() => navigate('/logged-in.html?section=profile')} className={`block w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 ${window.location.search.includes('section=profile') || window.location.search === '' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>Moje údaje</button></li>
                <li><button onClick={() => navigate('/logged-in.html?section=change-name')} className={`block w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 ${window.location.search.includes('section=change-name') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>Zmeniť meno a priezvisko</button></li>
                <li><button onClick={() => navigate('/logged-in.html?section=change-password')} className={`block w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 ${window.location.search.includes('section=change-password') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>Zmeniť heslo</button></li>
                <li><button onClick={() => navigate('/logged-in.html?section=my-settings')} className={`block w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 ${window.location.search.includes('section=my-settings') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>Moje nastavenia</button></li>
                <li><button onClick={() => navigate('/logged-in.html?section=notifications')} className={`block w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 ${window.location.search.includes('section=notifications') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>Upozornenia ({notifications.length})</button></li>
                <li><button onClick={() => navigate('/logged-in.html?section=send-message')} className={`block w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 ${window.location.search.includes('section=send-message') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>Poslať správu</button></li>
                {user.role === 'admin' && (
                  <>
                    <li><button onClick={() => navigate('/logged-in.html?section=manage-users')} className={`block w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 ${window.location.search.includes('section=manage-users') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>Používatelia</button></li>
                    <li><button onClick={() => navigate('/logged-in.html?section=view-registrations')} className={`block w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 ${window.location.search.includes('section=view-registrations') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>Všetky tímy (registrácie)</button></li>
                    <li><button onClick={() => navigate('/logged-in.html?section=manage-tournaments')} className={`block w-full text-left py-2 px-4 rounded-lg transition-colors duration-200 ${window.location.search.includes('section=manage-tournaments') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>Nastavenie turnaja</button></li>
                  </>
                )}
              </ul>
            </div>

            {/* Hlavný obsah */}
            <div className="flex-1 p-6">
              <h2 className="text-3xl font-bold mb-6 text-gray-800">Vitajte, {user.firstName || user.email}!</h2>
              {error && <p className="text-red-500 text-center mb-4">{error}</p>}
              {successMessage && <p className="text-green-500 text-center mb-4">{successMessage}</p>}

              {/* Obsah podľa sekcie */}
              {(() => {
                const section = new URLSearchParams(window.location.search).get('section');
                switch (section) {
                  case 'profile':
                  default:
                    return (
                      <div className="bg-white p-6 rounded-lg shadow-md">
                        <h3 className="text-xl font-semibold mb-4 text-gray-800">Moje údaje</h3>
                        <p className="mb-2"><span className="font-semibold">E-mail:</span> {user.email}</p>
                        <p className="mb-2"><span className="font-semibold">Meno:</span> {user.firstName || 'N/A'}</p>
                        <p className="mb-2"><span className="font-semibold">Priezvisko:</span> {user.lastName || 'N/A'}</p>
                        <p className="mb-2"><span className="font-semibold">Telefón:</span> {user.phone || 'N/A'}</p>
                        <p className="mb-2"><span className="font-semibold">Názov klubu:</span> {user.clubName || 'N/A'}</p>
                        <p className="mb-2"><span className="font-semibold">IČO:</span> {user.ico || 'N/A'}</p>
                        <p className="mb-2"><span className="font-semibold">DIČ:</span> {user.dic || 'N/A'}</p>
                        <p className="mb-2"><span className="font-semibold">Ulica:</span> {user.street || 'N/A'}</p>
                        <p className="mb-2"><span className="font-semibold">PSČ:</span> {user.zipCode || 'N/A'}</p>
                        <p className="mb-2"><span className="font-semibold">Mesto:</span> {user.city || 'N/A'}</p>
                        <p className="mb-2"><span className="font-semibold">Krajina:</span> {user.country || 'N/A'}</p>
                        <p className="mb-2"><span className="font-semibold">Rola:</span> {user.role || 'Používateľ'}</p>
                        <p className="mb-2"><span className="font-semibold">Schválený:</span> {user.isApproved ? 'Áno' : 'Nie'}</p>
                      </div>
                    );
                  case 'change-name':
                    return (
                      <div className="bg-white p-6 rounded-lg shadow-md">
                        <h3 className="text-xl font-semibold mb-4 text-gray-800">Zmeniť meno a priezvisko</h3>
                        <form onSubmit={handleNameChange}>
                          <div className="mb-4">
                            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="change-firstName">Nové meno</label>
                            <input
                              type="text"
                              id="change-firstName"
                              className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                              value={firstName}
                              onChange={(e) => setFirstName(e.target.value)}
                              placeholder={user.firstName || ''}
                              required
                            />
                          </div>
                          <div className="mb-4">
                            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="change-lastName">Nové priezvisko</label>
                            <input
                              type="text"
                              id="change-lastName"
                              className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                              value={lastName}
                              onChange={(e) => setLastName(e.target.value)}
                              placeholder={user.lastName || ''}
                              required
                            />
                          </div>
                          <button
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200"
                            disabled={loading}
                          >
                            {loading ? 'Ukladám...' : 'Uložiť zmeny'}
                          </button>
                        </form>
                      </div>
                    );
                  case 'change-password':
                    return (
                      <div className="bg-white p-6 rounded-lg shadow-md">
                        <h3 className="text-xl font-semibold mb-4 text-gray-800">Zmeniť heslo</h3>
                        <form onSubmit={handleChangePassword}>
                          <PasswordInput
                            id="current-password"
                            label="Aktuálne heslo"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="Zadajte aktuálne heslo"
                            autoComplete="current-password"
                            showPassword={showCurrentPassword}
                            toggleShowPassword={() => setShowCurrentPassword(!showCurrentPassword)}
                            required
                          />
                          <PasswordInput
                            id="new-password"
                            label="Nové heslo"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Zadajte nové heslo"
                            autoComplete="new-password"
                            showPassword={showNewPassword}
                            toggleShowPassword={() => setShowNewPassword(!showNewPassword)}
                            description="Minimálne 6 znakov"
                            required
                          />
                          <PasswordInput
                            id="new-confirm-password"
                            label="Potvrdiť nové heslo"
                            value={newConfirmPassword}
                            onChange={(e) => setNewConfirmPassword(e.target.value)}
                            placeholder="Zopakujte nové heslo"
                            autoComplete="new-password"
                            showPassword={showNewConfirmPassword}
                            toggleShowPassword={() => setShowNewConfirmPassword(!showNewConfirmPassword)}
                            required
                          />
                          <button
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200"
                            disabled={loading}
                          >
                            {loading ? 'Ukladám...' : 'Zmeniť heslo'}
                          </button>
                        </form>
                      </div>
                    );
                  case 'my-settings':
                    return (
                      <div className="bg-white p-6 rounded-lg shadow-md">
                        <h3 className="text-xl font-semibold mb-4 text-gray-800">Moje nastavenia</h3>
                        <form onSubmit={handleChangeEmail}>
                          <div className="mb-4">
                            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="new-email">Nový e-mail</label>
                            <input
                              type="email"
                              id="new-email"
                              className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                              value={newEmail}
                              onChange={(e) => setNewEmail(e.target.value)}
                              placeholder={user.email || ''}
                              required
                            />
                          </div>
                          <PasswordInput
                            id="current-password-email"
                            label="Aktuálne heslo (pre zmenu e-mailu)"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="Zadajte aktuálne heslo"
                            autoComplete="current-password"
                            showPassword={showCurrentPassword}
                            toggleShowPassword={() => setShowCurrentPassword(!showCurrentPassword)}
                            required
                          />
                          <button
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200"
                            disabled={loading}
                          >
                            {loading ? 'Ukladám...' : 'Zmeniť e-mail'}
                          </button>
                        </form>
                      </div>
                    );
                  case 'notifications':
                    return (
                      <div className="bg-white p-6 rounded-lg shadow-md">
                        <h3 className="text-xl font-semibold mb-4 text-gray-800">Moje upozornenia</h3>
                        {notifications.length > 0 ? (
                          <>
                            <button
                              onClick={handleDeleteAllNotifications}
                              className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg mb-4 transition-colors duration-200"
                              disabled={loading}
                            >
                              {loading ? 'Mažem...' : 'Vymazať všetky upozornenia'}
                            </button>
                            <ul className="space-y-4">
                              {notifications.map((notification) => (
                                <li key={notification.id} className="border p-4 rounded-lg bg-gray-50 flex justify-between items-center">
                                  <div>
                                    <p className="text-gray-800">{notification.message}</p>
                                    <p className="text-gray-500 text-sm">
                                      {notification.timestamp ? new Date(notification.timestamp.toDate()).toLocaleString() : 'Neznámy čas'}
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => handleDeleteNotification(notification.id)}
                                    className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg text-sm transition-colors duration-200"
                                    disabled={loading}
                                  >
                                    Vymazať
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </>
                        ) : (
                          <p className="text-gray-600">Žiadne upozornenia.</p>
                        )}
                      </div>
                    );
                  case 'send-message':
                    return (
                      <div className="bg-white p-6 rounded-lg shadow-md">
                        <h3 className="text-xl font-semibold mb-4 text-gray-800">Poslať správu (Adminovi)</h3>
                        <p className="text-gray-600 mb-4">Táto funkcia bude implementovaná neskôr.</p>
                        {/* Tu by bol formulár na odoslanie správy adminovi */}
                      </div>
                    );
                  case 'manage-users':
                    if (user.role !== 'admin') return <p className="text-red-500">Nemáte oprávnenie na zobrazenie tejto sekcie.</p>;
                    return (
                      <div className="bg-white p-6 rounded-lg shadow-md">
                        <h3 className="text-xl font-semibold mb-4 text-gray-800">Správa používateľov</h3>
                        {users.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="min-w-full bg-white rounded-lg shadow overflow-hidden">
                              <thead className="bg-gray-200 text-gray-700">
                                <tr>
                                  <th className="py-3 px-4 text-left">E-mail</th>
                                  <th className="py-3 px-4 text-left">Meno</th>
                                  <th className="py-3 px-4 text-left">Priezvisko</th>
                                  <th className="py-3 px-4 text-left">Rola</th>
                                  <th className="py-3 px-4 text-left">Schválený</th>
                                  <th className="py-3 px-4 text-left">Akcie</th>
                                </tr>
                              </thead>
                              <tbody>
                                {users.map((userItem) => (
                                  <tr key={userItem.id} className="border-b border-gray-200 hover:bg-gray-50">
                                    <td className="py-3 px-4">{userItem.email}</td>
                                    <td className="py-3 px-4">{userItem.firstName}</td>
                                    <td className="py-3 px-4">{userItem.lastName}</td>
                                    <td className="py-3 px-4">{userItem.role}</td>
                                    <td className="py-3 px-4">{userItem.isApproved ? 'Áno' : 'Nie'}</td>
                                    <td className="py-3 px-4 flex space-x-2">
                                      <button
                                        onClick={() => openRoleEditModal(userItem)}
                                        className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded-lg text-sm transition-colors duration-200"
                                      >
                                        Upraviť rolu
                                      </button>
                                      <button
                                        onClick={() => handleToggleUserApproval(userItem)}
                                        className={`px-3 py-1 rounded-lg text-sm transition-colors duration-200 ${userItem.isApproved ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'} text-white`}
                                      >
                                        {userItem.isApproved ? 'Neschváliť' : 'Schváliť'}
                                      </button>
                                      <button
                                        onClick={() => handleDeleteUser(userItem)}
                                        className="bg-red-700 hover:bg-red-800 text-white px-3 py-1 rounded-lg text-sm transition-colors duration-200"
                                      >
                                        Vymazať
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-gray-600 text-center">Žiadni používatelia na zobrazenie.</p>
                        )}
                      </div>
                    );
                  case 'view-registrations':
                    if (user.role !== 'admin') return <p className="text-red-500">Nemáte oprávnenie na zobrazenie tejto sekcie.</p>;
                    return (
                      <div className="bg-white p-6 rounded-lg shadow-md">
                        <h3 className="text-xl font-semibold mb-4 text-gray-800">Všetky tímy (údaje z registračného formulára)</h3>
                        {tournamentRegistrations.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="min-w-full bg-white rounded-lg shadow overflow-hidden">
                              <thead className="bg-gray-200 text-gray-700">
                                <tr>
                                  <th className="py-3 px-4 text-left">E-mail</th>
                                  <th className="py-3 px-4 text-left">Meno</th>
                                  <th className="py-3 px-4 text-left">Priezvisko</th>
                                  <th className="py-3 px-4 text-left">Telefónne číslo</th>
                                  <th className="py-3 px-4 text-left">Oficiálny názov klubu</th>
                                  <th className="py-3 px-4 text-left">IČO</th>
                                  <th className="py-3 px-4 text-left">DIČ</th>
                                  <th className="py-3 px-4 text-left">Ulica</th>
                                  <th className="py-3 px-4 text-left">PSČ</th>
                                  <th className="py-3 px-4 text-left">Mesto</th>
                                  <th className="py-3 px-4 text-left">Krajina</th>
                                  <th className="py-3 px-4 text-left">Rola</th>
                                  <th className="py-3 px-4 text-left">Schválený</th>
                                  <th className="py-3 px-4 text-left">Akcie</th>
                                </tr>
                              </thead>
                              <tbody>
                                {tournamentRegistrations.map((reg) => (
                                  <tr key={reg.id} className="border-b border-gray-200 hover:bg-gray-50">
                                    <td className="py-3 px-4">{reg.email}</td>
                                    <td className="py-3 px-4">{reg.firstName}</td>
                                    <td className="py-3 px-4">{reg.lastName}</td>
                                    <td className="py-3 px-4">{reg.phone}</td>
                                    <td className="py-3 px-4">{reg.clubName}</td>
                                    <td className="py-3 px-4">{reg.ico}</td>
                                    <td className="py-3 px-4">{reg.dic}</td>
                                    <td className="py-3 px-4">{reg.street}</td>
                                    <td className="py-3 px-4">{reg.zipCode}</td>
                                    <td className="py-3 px-4">{reg.city}</td>
                                    <td className="py-3 px-4">{reg.country}</td>
                                    <td className="py-3 px-4">{reg.role}</td>
                                    <td className="py-3 px-4">{reg.isApproved ? 'Áno' : 'Nie'}</td>
                                    <td className="py-3 px-4 flex space-x-2">
                                      <button
                                        onClick={() => handleToggleTournamentApproval(reg.id, reg.isApproved)}
                                        className={`px-3 py-1 rounded-lg text-sm transition-colors duration-200 ${reg.isApproved ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'} text-white`}
                                      >
                                        {reg.isApproved ? 'Neschváliť' : 'Schváliť'}
                                      </button>
                                      <button
                                        onClick={() => handleDeleteTournamentRegistration(reg.id)}
                                        className="bg-red-700 hover:bg-red-800 text-white px-3 py-1 rounded-lg text-sm transition-colors duration-200"
                                      >
                                        Vymazať
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-gray-600 text-center">Žiadne registračné údaje na zobrazenie alebo načítavanie...</p>
                        )}
                      </div>
                    );
                  case 'manage-tournaments':
                    if (user.role !== 'admin') return <p className="text-red-500">Nemáte oprávnenie na zobrazenie tejto sekcie.</p>;
                    return (
                      <div className="bg-white p-6 rounded-lg shadow-md">
                        <h3 className="text-xl font-semibold mb-4 text-gray-800">Nastavenie turnaja</h3>
                        <button
                          onClick={() => {
                            setShowTournamentForm(!showTournamentForm);
                            setEditingTournament(null);
                            setTournamentName('');
                            setTournamentDate('');
                            setTournamentLocation('');
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg mb-4 transition-colors duration-200"
                        >
                          {showTournamentForm ? 'Zrušiť pridávanie/úpravu' : 'Pridať nový turnaj'}
                        </button>

                        {showTournamentForm && (
                          <form onSubmit={editingTournament ? handleUpdateTournament : handleAddTournament} className="mb-8 p-4 border rounded-lg bg-gray-50">
                            <h4 className="text-lg font-semibold mb-4">{editingTournament ? 'Upraviť turnaj' : 'Pridať nový turnaj'}</h4>
                            <div className="mb-4">
                              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="tournament-name">Názov turnaja</label>
                              <input
                                type="text"
                                id="tournament-name"
                                className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                                value={tournamentName}
                                onChange={(e) => setTournamentName(e.target.value)}
                                required
                              />
                            </div>
                            <div className="mb-4">
                              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="tournament-date">Dátum turnaja</label>
                              <input
                                type="date"
                                id="tournament-date"
                                className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                                value={tournamentDate}
                                onChange={(e) => setTournamentDate(e.target.value)}
                                required
                              />
                            </div>
                            <div className="mb-4">
                              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="tournament-location">Miesto turnaja</label>
                              <input
                                type="text"
                                id="tournament-location"
                                className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                                value={tournamentLocation}
                                onChange={(e) => setTournamentLocation(e.target.value)}
                                required
                              />
                            </div>
                            <button
                              type="submit"
                              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200"
                              disabled={loading}
                            >
                              {loading ? 'Ukladám...' : (editingTournament ? 'Aktualizovať turnaj' : 'Pridať turnaj')}
                            </button>
                          </form>
                        )}

                        <h4 className="text-xl font-semibold mb-4 text-gray-800">Zoznam turnajov</h4>
                        {tournaments.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="min-w-full bg-white rounded-lg shadow overflow-hidden">
                              <thead className="bg-gray-200 text-gray-700">
                                <tr>
                                  <th className="py-3 px-4 text-left">Názov</th>
                                  <th className="py-3 px-4 text-left">Dátum</th>
                                  <th className="py-3 px-4 text-left">Miesto</th>
                                  <th className="py-3 px-4 text-left">Akcie</th>
                                </tr>
                              </thead>
                              <tbody>
                                {tournaments.map((tournament) => (
                                  <tr key={tournament.id} className="border-b border-gray-200 hover:bg-gray-50">
                                    <td className="py-3 px-4">{tournament.name}</td>
                                    <td className="py-3 px-4">{tournament.date}</td>
                                    <td className="py-3 px-4">{tournament.location}</td>
                                    <td className="py-3 px-4 flex space-x-2">
                                      <button
                                        onClick={() => handleEditTournament(tournament)}
                                        className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded-lg text-sm transition-colors duration-200"
                                      >
                                        Upraviť
                                      </button>
                                      <button
                                        onClick={() => handleDeleteTournament(tournament.id)}
                                        className="bg-red-700 hover:bg-red-800 text-white px-3 py-1 rounded-lg text-sm transition-colors duration-200"
                                      >
                                        Vymazať
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-gray-600 text-center">Žiadne turnaje na zobrazenie.</p>
                        )}
                      </div>
                    );
                  default:
                    return (
                      <div className="bg-white p-6 rounded-lg shadow-md">
                        <h3 className="text-xl font-semibold mb-4 text-gray-800">Vitajte!</h3>
                        <p className="text-gray-700">Prosím, vyberte sekciu z menu vľavo.</p>
                        <p className="text-gray-700 mt-2">Váš ID: <span className="font-mono text-sm bg-gray-200 p-1 rounded">{user.uid}</span></p>
                      </div>
                    );
                }
              })()}
            </div>

            {/* Modálne okno pre notifikácie */}
            <Modal show={showNotificationModal} onClose={() => setShowNotificationModal(false)} title={notificationType === 'error' ? 'Chyba' : notificationType === 'success' ? 'Úspech' : 'Informácia'}>
              <p className={`text-center ${notificationType === 'error' ? 'text-red-600' : notificationType === 'success' ? 'text-green-600' : 'text-gray-800'}`}>{notificationMessage}</p>
            </Modal>

            {/* Modálne okno pre úpravu roly (zobrazené aj na logged-in.html ak je admin) */}
            {showRoleEditModal && userToEditRole && (
              <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-auto">
                  <h3 className="text-xl font-semibold mb-4">Upraviť rolu pre {userToEditRole?.email}</h3>
                  <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="new-user-role-modal">Nová rola</label>
                    <select
                      id="new-user-role-modal"
                      className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                    >
                      <option value="user">Používateľ</option>
                      <option value="admin">Administrátor</option>
                    </select>
                  </div>
                  <div className="flex justify-end space-x-4">
                    <button
                      onClick={closeRoleEditModal}
                      className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors duration-200"
                    >
                      Zrušiť
                    </button>
                    <button
                      onClick={handleUpdateUserRole}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
                      disabled={loading}
                    >
                      {loading ? 'Ukladám...' : 'Uložiť'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case '/index.html':
      case '/': // Predvolená cesta pre úvodnú stránku
        return (
          <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4 pt-16">
            <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-2xl text-center">
              <h1 className="text-4xl font-bold text-blue-700 mb-6">Vitajte na SOH 2025 - Slovak Open Handball!</h1>
              <p className="text-lg text-gray-700 mb-4">
                Pripravte sa na najväčší hádzanársky turnaj roka!
              </p>
              <p className="text-gray-600 mb-8">
                Sledujte novinky, registrujte svoje tímy a buďte súčasťou nezabudnuteľného športového zážitku.
              </p>
              <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4">
                <button
                  onClick={() => navigate('/register.html')}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105"
                >
                  Zaregistrovať sa
                </button>
                <button
                  onClick={() => navigate('/login.html')}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105"
                >
                  Prihlásiť sa
                </button>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4 pt-16">
            <div className="bg-white p-8 rounded-lg shadow-md">
              <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Stránka nenájdená</h2>
              <p className="text-gray-700 text-center">Požadovaná stránka neexistuje.</p>
              <div className="flex justify-center mt-4">
                <button onClick={() => navigate('/')} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200">
                  Ísť na domovskú stránku
                </button>
              </div>
            </div>
          </div>
        );
    }
  }, [currentPage, loading, error, successMessage, email, password, confirmPassword, firstName, lastName, phone, clubName, ico, dic, street, zipCode, city, country, role, isApproved, loginEmail, loginPassword, currentPassword, newPassword, newConfirmPassword, newEmail, users, userToEditRole, newRole, showRoleEditModal, notifications, showNotificationModal, notificationMessage, notificationType, tournamentRegistrations, tournamentName, tournamentDate, tournamentLocation, tournaments, showTournamentForm, editingTournament, user, handleRegister, handleAdminRegister, handleLogin, handlePasswordReset, handleNameChange, handleChangePassword, handleChangeEmail, handleDeleteNotification, handleDeleteAllNotifications, handleUpdateUserRole, handleToggleUserApproval, handleDeleteUser, handleTournamentRegistration, handleToggleTournamentApproval, handleDeleteTournamentRegistration, handleAddTournament, handleUpdateTournament, handleDeleteTournament, navigate, showPassword, showConfirmPassword, showCurrentPassword, showNewPassword, showNewConfirmPassword, showTemporaryNotification]);

  // Efekt pre aktualizáciu currentPage pri zmene URL
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPage(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Renderovanie komponentu
  return (
    <div className="App">
      {renderContent()}
    </div>
  );
}
