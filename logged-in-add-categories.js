// logged-in-add-categories.js
// Tento súbor predpokladá, že firebaseConfig, initialAuthToken a appId
// sú globálne definované v <head> logged-in-add-categories.html.

// NotificationModal Component for displaying temporary messages (converted to React.createElement)
function NotificationModal({ message, onClose, type = 'info' }) {
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
      }
    };
  }, [message, onClose]);

  if (!show && !message) return null;

  let bgColorClass;
  if (type === 'success') {
    bgColorClass = 'bg-[#3A8D41]'; // Zelená
  } else if (type === 'error') {
    bgColorClass = 'bg-red-600'; // Červená
  } else {
    bgColorClass = 'bg-blue-500'; // Predvolená modrá pre info
  }

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
        className: `${bgColorClass} text-white px-6 py-3 rounded-lg shadow-lg max-w-md w-full text-center`,
        style: { pointerEvents: 'auto' }
      },
      React.createElement('p', { className: 'font-semibold' }, message)
    )
  );
}

// AddCategoryModal Component
function AddCategoryModal({ show, onClose, onAddCategory, loading, error, notificationMessage, setNotificationMessage }) {
  const [newCategoryName, setNewCategoryName] = React.useState('');

  if (!show) return null;

  const handleSubmit = () => {
    onAddCategory(newCategoryName);
    setNewCategoryName(''); // Vyčistí pole po odoslaní
  };

  return React.createElement(
    'div',
    { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50' },
    React.createElement(
      'div',
      { className: 'bg-white p-6 rounded-lg shadow-xl max-w-sm w-full' },
      React.createElement('h2', { className: 'text-xl font-bold mb-4' }, 'Pridať novú kategóriu'),
      notificationMessage && React.createElement(NotificationModal, {
        message: notificationMessage,
        onClose: () => setNotificationMessage(''),
        type: error ? 'error' : 'success'
      }),
      React.createElement(
        'div',
        { className: 'mb-4' },
        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'new-category-name' }, 'Názov kategórie'),
        React.createElement('input', {
          type: 'text',
          id: 'new-category-name',
          className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
          value: newCategoryName,
          onChange: (e) => setNewCategoryName(e.target.value),
          required: true,
          disabled: loading,
        })
      ),
      React.createElement(
        'div',
        { className: 'flex justify-end space-x-4' },
        React.createElement(
          'button',
          {
            onClick: onClose,
            className: 'bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded-lg transition-colors duration-200',
            disabled: loading,
          },
          'Zrušiť'
        ),
        React.createElement(
          'button',
          {
            onClick: handleSubmit,
            className: `bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg transition-colors duration-200 ${loading || newCategoryName.trim() === '' ? 'opacity-50 cursor-not-allowed' : ''}`,
            disabled: loading || newCategoryName.trim() === '',
          },
          loading ? 'Ukladám...' : 'Pridať'
        )
      )
    )
  );
}

// EditCategoryModal Component
function EditCategoryModal({ show, onClose, onSaveCategory, loading, category, error, notificationMessage, setNotificationMessage }) {
  const [editedCategoryName, setEditedCategoryName] = React.useState(category ? category.name : '');

  React.useEffect(() => {
    if (category) {
      setEditedCategoryName(category.name);
    }
  }, [category]);

  if (!show || !category) return null;

  const handleSubmit = () => {
    onSaveCategory(category.id, editedCategoryName);
  };

  return React.createElement(
    'div',
    { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50' },
    React.createElement(
      'div',
      { className: 'bg-white p-6 rounded-lg shadow-xl max-w-sm w-full' },
      React.createElement('h2', { className: 'text-xl font-bold mb-4' }, `Upraviť kategóriu: ${category.name}`),
      notificationMessage && React.createElement(NotificationModal, {
        message: notificationMessage,
        onClose: () => setNotificationMessage(''),
        type: error ? 'error' : 'success'
      }),
      React.createElement(
        'div',
        { className: 'mb-4' },
        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'edit-category-name' }, 'Nový názov kategórie'),
        React.createElement('input', {
          type: 'text',
          id: 'edit-category-name',
          className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
          value: editedCategoryName,
          onChange: (e) => setEditedCategoryName(e.target.value),
          required: true,
          disabled: loading,
        })
      ),
      React.createElement(
        'div',
        { className: 'flex justify-end space-x-4' },
        React.createElement(
          'button',
          {
            onClick: onClose,
            className: 'bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded-lg transition-colors duration-200',
            disabled: loading,
          },
          'Zrušiť'
        ),
        React.createElement(
          'button',
          {
            onClick: handleSubmit,
            className: `bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg transition-colors duration-200 ${loading || editedCategoryName.trim() === '' ? 'opacity-50 cursor-not-allowed' : ''}`,
            disabled: loading || editedCategoryName.trim() === '',
          },
          loading ? 'Ukladám...' : 'Uložiť zmeny'
        )
      )
    )
  );
}

// ConfirmationModal Component (nový komponent pre potvrdenie zmazania)
function ConfirmationModal({ show, message, onConfirm, onCancel, loading }) {
  if (!show) return null;

  return React.createElement(
    'div',
    { className: 'fixed inset-0 bg-gray-600 bg-opacity50 flex justify-center items-center z-50' },
    React.createElement(
      'div',
      { className: 'bg-white p-6 rounded-lg shadow-xl max-w-sm w-full' },
      React.createElement('h2', { className: 'text-xl font-bold mb-4 text-center' }, 'Potvrdenie'),
      React.createElement('p', { className: 'mb-6 text-center' }, message),
      React.createElement(
        'div',
        { className: 'flex justify-center space-x-4' },
        React.createElement(
          'button',
          {
            onClick: onCancel,
            className: 'bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded-lg transition-colors duration-200',
            disabled: loading,
          },
          'Zrušiť'
        ),
        React.createElement(
          'button',
          {
            onClick: onConfirm,
            className: 'bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg transition-colors duration-200',
            disabled: loading,
          },
          loading ? 'Potvrdzujem...' : 'Potvrdiť'
        )
      )
    )
  );
}


// Main React component for the logged-in-add-categories.html page
function AddCategoriesApp() {
  const [app, setApp] = React.useState(null);
  const [auth, setAuth] = React.useState(null);
  const [db, setDb] = React.useState(null);
  const [user, setUser] = React.useState(undefined); // Firebase User object from onAuthStateChanged
  const [userProfileData, setUserProfileData] = React.useState(null); 
  const [isAuthReady, setIsAuthReady] = React.useState(false); // Nový stav pre pripravenosť autentifikácie
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [userNotificationMessage, setUserNotificationMessage] = React.useState('');

  const [categories, setCategories] = React.useState([]); // Stav pre zoznam kategórií
  const [showAddCategoryModal, setShowAddCategoryModal] = React.useState(false); // Stav pre zobrazenie modálneho okna pridania
  const [showEditCategoryModal, setShowEditCategoryModal] = React.useState(false); // Stav pre zobrazenie modálneho okna úpravy
  const [categoryToEdit, setCategoryToEdit] = React.useState(null); // Stav pre kategóriu, ktorá sa má upraviť
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = React.useState(false); // NOVINKA: Stav pre potvrdenie zmazania
  const [categoryToDelete, setCategoryToDelete] = React.useState(null); // NOVINKA: Kategória na zmazanie

  // Zabezpečíme, že appId je definované (používame globálnu premennú)
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'; 

  // Effect for Firebase initialization and Auth Listener setup (runs only once)
  React.useEffect(() => {
    let unsubscribeAuth;
    let firestoreInstance;

    try {
      if (typeof firebase === 'undefined') {
        console.error("AddCategoriesApp: Firebase SDK nie je načítané.");
        setError("Firebase SDK nie je načítané. Skontrolujte logged-in-add-categories.html.");
        setLoading(false);
        return;
      }

      let firebaseApp;
      // Skontrolujte, či už existuje predvolená aplikácia Firebase
      if (firebase.apps.length === 0) {
        // Používame globálne __firebase_config
        firebaseApp = firebase.initializeApp(JSON.parse(__firebase_config));
      } else {
        firebaseApp = firebase.app(); // Použite existujúcu predvolenú aplikáciu
      }
      setApp(firebaseApp);

      const authInstance = firebase.auth(firebaseApp);
      setAuth(authInstance);
      firestoreInstance = firebase.firestore(firebaseApp);
      setDb(firestoreInstance);

      const signIn = async () => {
        try {
          if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await authInstance.signInWithCustomToken(__initial_auth_token);
          }
        } catch (e) {
          console.error("AddCategoriesApp: Chyba pri počiatočnom prihlásení Firebase (s custom tokenom):", e);
          setError(`Chyba pri prihlásení: ${e.message}`);
        }
      };

      unsubscribeAuth = authInstance.onAuthStateChanged(async (currentUser) => {
        console.log("AddCategoriesApp: onAuthStateChanged - Používateľ:", currentUser ? currentUser.uid : "null");
        setUser(currentUser); // Nastaví Firebase User objekt
        setIsAuthReady(true); // Mark auth as ready after the first check
      });

      signIn();

      return () => {
        if (unsubscribeAuth) {
          unsubscribeAuth();
        }
      };
    } catch (e) {
      console.error("AddCategoriesApp: Nepodarilo sa inicializovať Firebase:", e);
      setError(`Chyba pri inicializácii Firebase: ${e.message}`);
      setLoading(false);
    }
  }, []);

  // NOVÝ EFFECT: Načítanie používateľských dát z Firestore po inicializácii Auth a DB
  React.useEffect(() => {
    let unsubscribeUserDoc;

    if (isAuthReady && db && user !== undefined) {
      if (user === null) {
        console.log("AddCategoriesApp: Auth je ready a používateľ je null, presmerovávam na login.html");
        window.location.href = 'login.html';
        return;
      }

      if (user) {
        console.log(`AddCategoriesApp: Pokúšam sa načítať používateľský dokument pre UID: ${user.uid}`);
        setLoading(true);

        try {
          const userDocRef = db.collection('users').doc(user.uid);
          unsubscribeUserDoc = userDocRef.onSnapshot(docSnapshot => {
            console.log("AddCategoriesApp: onSnapshot pre používateľský dokument spustený.");
            if (docSnapshot.exists) {
              const userData = docSnapshot.data();
              console.log("AddCategoriesApp: Používateľský dokument existuje, dáta:", userData);

              // --- OKAMŽITÉ ODHLÁSENIE, AK passwordLastChanged NIE JE PLATNÝ TIMESTAMP ---
              if (!userData.passwordLastChanged || typeof userData.passwordLastChanged.toDate !== 'function') {
                  console.error("AddCategoriesApp: passwordLastChanged NIE JE platný Timestamp objekt! Typ:", typeof userData.passwordLastChanged, "Hodnota:", userData.passwordLastChanged);
                  console.log("AddCategoriesApp: Okamžite odhlasujem používateľa kvôli neplatnému timestampu zmeny hesla.");
                  auth.signOut();
                  window.location.href = 'login.html';
                  localStorage.removeItem(`passwordLastChanged_${user.uid}`);
                  setUser(null); // Explicitne nastaviť user na null
                  setUserProfileData(null); // Explicitne nastaviť userProfileData na null
                  return;
              }

              const firestorePasswordChangedTime = userData.passwordLastChanged.toDate().getTime();
              const localStorageKey = `passwordLastChanged_${user.uid}`;
              let storedPasswordChangedTime = parseInt(localStorage.getItem(localStorageKey) || '0', 10);

              console.log(`AddCategoriesApp: Firestore passwordLastChanged (konvertované): ${firestorePasswordChangedTime}, Stored: ${storedPasswordChangedTime}`);

              if (storedPasswordChangedTime === 0 && firestorePasswordChangedTime !== 0) {
                  localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
                  console.log("AddCategoriesApp: Inicializujem passwordLastChanged v localStorage (prvé načítanie).");
              } else if (firestorePasswordChangedTime > storedPasswordChangedTime) {
                  console.log("AddCategoriesApp: Detekovaná zmena hesla na inom zariadení/relácii. Odhlasujem používateľa.");
                  auth.signOut();
                  window.location.href = 'login.html';
                  localStorage.removeItem(localStorageKey);
                  setUser(null); // Explicitne nastaviť user na null
                  setUserProfileData(null); // Explicitne nastaviť userProfileData na null
                  return;
              } else if (firestorePasswordChangedTime < storedPasswordChangedTime) {
                  console.warn("AddCategoriesApp: Detekovaný starší timestamp z Firestore ako uložený. Odhlasujem používateľa (potenciálny nesúlad).");
                  auth.signOut();
                  window.location.href = 'login.html';
                  localStorage.removeItem(localStorageKey);
                  setUser(null); // Explicitne nastaviť user na null
                  setUserProfileData(null); // Explicitne nastaviť userProfileData na null
                  return;
              } else {
                  localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
                  console.log("AddCategoriesApp: Timestampy sú rovnaké, aktualizujem localStorage.");
              }
              // --- KONIEC LOGIKY ODHLÁSENIA ---

              // NOVÁ LOGIKA: Odhlásenie, ak je používateľ admin a nie je schválený
              if (userData.role === 'admin' && userData.approved === false) {
                  console.log("AddCategoriesApp: Používateľ je admin a nie je schválený. Odhlasujem.");
                  auth.signOut();
                  window.location.href = 'login.html';
                  setUser(null); // Explicitne nastaviť user na null
                  setUserProfileData(null); // Explicitne nastaviť userProfileData na null
                  return; // Zastav ďalšie spracovanie
              }

              setUserProfileData(userData);
              
              setLoading(false);
              setError('');

              if (typeof window.updateMenuItemsVisibility === 'function') {
                  window.updateMenuItemsVisibility(userData.role);
              }

              console.log("AddCategoriesApp: Načítanie používateľských dát dokončené, loading: false");
            } else {
              console.warn("AddCategoriesApp: Používateľský dokument sa nenašiel pre UID:", user.uid);
              setError("Chyba: Používateľský profil sa nenašiel alebo nemáte dostatočné oprávnenia. Skúste sa prosím znova prihlásiť.");
              setLoading(false);
              setUser(null); // Explicitne nastaviť user na null
              setUserProfileData(null); // Explicitne nastaviť userProfileData na null
            }
          }, error => {
            console.error("AddCategoriesApp: Chyba pri načítaní používateľských dát z Firestore (onSnapshot error):", error);
            if (error.code === 'permission-denied') {
                setError(`Chyba oprávnení: Nemáte prístup k svojmu profilu. Skúste sa prosím znova prihlásiť alebo kontaktujte podporu.`);
            } else if (error.code === 'unavailable') {
                setError(`Chyba pripojenia: Služba Firestore je nedostupná. Skúste to prosím neskôr.`);
            } else if (error.code === 'unauthenticated') {
                 setError(`Chyba autentifikácie: Nie ste prihlásený. Skúste sa prosím znova prihlásiť.`);
                 if (auth) {
                    auth.signOut();
                    window.location.href = 'login.html';
                    setUser(null); // Explicitne nastaviť user na null
                    setUserProfileData(null); // Explicitne nastaviť userProfileData na null
                 }
            } else {
                setError(`Chyba pri načítaní používateľských dát: ${error.message}`);
            }
            setLoading(false);
            console.log("AddCategoriesApp: Načítanie používateľských dát zlyhalo, loading: false");
            setUser(null); // Explicitne nastaviť user na null
            setUserProfileData(null); // Explicitne nastaviť userProfileData na null
          });
        } catch (e) {
          console.error("AddCategoriesApp: Chyba pri nastavovaní onSnapshot pre používateľské dáta (try-catch):", e);
          setError(`Chyba pri nastavovaní poslucháča pre používateľské dáta: ${e.message}`);
          setLoading(false);
          setUser(null); // Explicitne nastaviť user na null
          setUserProfileData(null); // Explicitne nastaviť userProfileData na null
        }
      }
    } else if (isAuthReady && user === undefined) {
        console.log("AddCategoriesApp: Auth ready, user undefined. Nastavujem loading na false.");
        setLoading(false);
    }

    return () => {
      if (unsubscribeUserDoc) {
        console.log("AddCategoriesApp: Ruším odber onSnapshot pre používateľský dokument.");
        unsubscribeUserDoc();
      }
    };
  }, [isAuthReady, db, user, auth]);

  // Effect for fetching categories
  React.useEffect(() => {
    let unsubscribeCategories;
    if (db && userProfileData && userProfileData.role === 'admin') {
      console.log("AddCategoriesApp: Prihlásený používateľ je admin. Načítavam kategórie.");
      setLoading(true);
      try {
        // ZMENA: Cesta k kolekcii je teraz priamo 'settings/categories'
        unsubscribeCategories = db.collection('settings').collection('categories').orderBy('createdAt').onSnapshot(snapshot => {
          const fetchedCategories = [];
          snapshot.forEach(doc => {
            fetchedCategories.push({ id: doc.id, ...doc.data() });
          });
          setCategories(fetchedCategories);
          setLoading(false);
          setError('');
          console.log("AddCategoriesApp: Kategórie aktualizované z onSnapshot.");
        }, error => {
          console.error("AddCategoriesApp: Chyba pri načítaní kategórií z Firestore (onSnapshot error):", error);
          setError(`Chyba pri načítaní kategórií: ${error.message}`);
          setLoading(false);
        });
      } catch (e) {
        console.error("AddCategoriesApp: Chyba pri nastavovaní onSnapshot pre kategórie (try-catch):", e);
        setError(`Chyba pri nastavovaní poslucháča pre kategórie: ${e.message}`);
        setLoading(false);
      }
    } else {
        setCategories([]); // Vyčisti kategórie, ak nie je admin
    }

    return () => {
      if (unsubscribeCategories) {
        console.log("AddCategoriesApp: Ruším odber onSnapshot pre kategórie.");
        unsubscribeCategories();
      }
    };
  }, [db, userProfileData]); // Závisí od db a userProfileData (pre rolu admina)

  // Effect for updating header link visibility
  React.useEffect(() => {
    console.log(`AddCategoriesApp: useEffect pre aktualizáciu odkazov hlavičky. User: ${user ? user.uid : 'null'}`);
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
        console.log("AddCategoriesApp: Používateľ prihlásený. Skryté: Prihlásenie, Registrácia. Zobrazené: Moja zóna, Odhlásenie.");
      } else {
        authLink.classList.remove('hidden');
        profileLink && profileLink.classList.add('hidden');
        logoutButton && logoutButton.classList.add('hidden');
        registerLink && registerLink.classList.remove('hidden'); 
        console.log("AddCategoriesApp: Používateľ odhlásený. Zobrazené: Prihlásenie, Registrácia. Skryté: Moja zóna, Odhlásenie.");
      }
    }
  }, [user]);

  // Handle logout (needed for the header logout button)
  const handleLogout = React.useCallback(async () => {
    if (!auth) return;
    try {
      setLoading(true);
      await auth.signOut();
      setUserNotificationMessage("Úspešne odhlásený.");
      window.location.href = 'login.html';
      setUser(null); // Explicitne nastaviť user na null
      setUserProfileData(null); // Explicitne nastaviť userProfileData na null
    } catch (e) {
      console.error("AddCategoriesApp: Chyba pri odhlásení:", e);
      setError(`Chyba pri odhlásení: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [auth]);

  // Attach logout handler to the button in the header
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

  // Funkcia na pridanie novej kategórie
  const handleAddCategorySubmit = async (categoryName) => {
    if (!db || !user || !userProfileData || userProfileData.role !== 'admin') {
      setError("Nemáte oprávnenie na pridanie kategórie.");
      return;
    }
    if (categoryName.trim() === '') {
      setError("Názov kategórie nemôže byť prázdny.");
      return;
    }

    setLoading(true);
    setError('');
    setUserNotificationMessage('');

    try {
      // NOVINKA: Kontrola duplicity názvu kategórie
      // ZMENA: Cesta k kolekcii je teraz priamo 'settings/categories'
      const categoriesRef = db.collection('settings').collection('categories');
      const existingCategorySnapshot = await categoriesRef.where('name', '==', categoryName.trim()).get();

      if (!existingCategorySnapshot.empty) {
        setError(`Kategória s názvom "${categoryName.trim()}" už existuje. Zvoľte iný názov.`);
        setLoading(false);
        return;
      }

      // Ukladanie do kolekcie settings/categories
      await categoriesRef.add({
        name: categoryName.trim(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: user.uid,
        createdByName: `${userProfileData.firstName || ''} ${userProfileData.lastName || ''}`,
      });
      setUserNotificationMessage("Kategória úspešne pridaná!");
      setShowAddCategoryModal(false); // Zatvorí modálne okno po úspešnom pridaní
    } catch (e) {
      console.error("AddCategoriesApp: Chyba pri pridávaní kategórie:", e);
      setError(`Chyba pri pridávaní kategórie: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Funkcia na úpravu kategórie
  const handleEditCategorySubmit = async (categoryId, newName) => {
    if (!db || !user || !userProfileData || userProfileData.role !== 'admin') {
      setError("Nemáte oprávnenie na úpravu kategórie.");
      return;
    }
    if (newName.trim() === '') {
      setError("Názov kategórie nemôže byť prázdny.");
      return;
    }

    setLoading(true);
    setError('');
    setUserNotificationMessage('');

    try {
      // NOVINKA: Kontrola duplicity názvu kategórie pri úprave (okrem samotnej upravovanej kategórie)
      // ZMENA: Cesta k kolekcii je teraz priamo 'settings/categories'
      const categoriesRef = db.collection('settings').collection('categories');
      const existingCategorySnapshot = await categoriesRef
        .where('name', '==', newName.trim())
        .get();

      // Ak nájdeme kategóriu s rovnakým názvom, a jej ID nie je rovnaké ako ID upravovanej kategórie
      if (!existingCategorySnapshot.empty && existingCategorySnapshot.docs[0].id !== categoryId) {
        setError(`Kategória s názvom "${newName.trim()}" už existuje. Zvoľte iný názov.`);
        setLoading(false);
        return;
      }

      // ZMENA: Cesta k kolekcii je teraz priamo 'settings/categories'
      await db.collection('settings').collection('categories').doc(categoryId).update({
        name: newName.trim(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: user.uid,
        updatedByName: `${userProfileData.firstName || ''} ${userProfileData.lastName || ''}`,
      });
      setUserNotificationMessage("Kategória úspešne aktualizovaná!");
      setShowEditCategoryModal(false); // Zatvorí modálne okno po úspešnej úprave
      setCategoryToEdit(null);
    } catch (e) {
      console.error("AddCategoriesApp: Chyba pri aktualizácii kategórie:", e);
      setError(`Chyba pri aktualizácii kategórie: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Funkcia na zobrazenie potvrdzovacieho modálu pred zmazaním
  const confirmDeleteCategory = (category) => {
    setCategoryToDelete(category);
    setShowConfirmDeleteModal(true);
  };

  // Funkcia na zmazanie kategórie (volaná z potvrdzovacieho modálu)
  const handleDeleteCategory = async () => {
    if (!db || !user || !userProfileData || userProfileData.role !== 'admin' || !categoryToDelete) {
      setError("Nemáte oprávnenie na zmazanie kategórie alebo kategória nie je vybraná.");
      return;
    }

    setLoading(true);
    setError('');
    setUserNotificationMessage('');
    setShowConfirmDeleteModal(false); // Zatvorí potvrdzovací modál

    try {
      // ZMENA: Cesta k kolekcii je teraz priamo 'settings/categories'
      await db.collection('settings').collection('categories').doc(categoryToDelete.id).delete();
      setUserNotificationMessage(`Kategória "${categoryToDelete.name}" bola úspešne zmazaná!`);
      setCategoryToDelete(null); // Vyčistí kategóriu na zmazanie
    } catch (e) {
      console.error("AddCategoriesApp: Chyba pri mazaní kategórie:", e);
      setError(`Chyba pri mazaní kategórie: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Display loading state
  if (!isAuthReady || user === undefined || (user && !userProfileData) || loading) {
    if (isAuthReady && user === null) {
        console.log("AddCategoriesApp: Auth je ready a používateľ je null, presmerovávam na login.html");
        window.location.href = 'login.html';
        return null;
    }
    let loadingMessage = 'Načítavam...';
    if (isAuthReady && user && !userProfileData) {
        loadingMessage = 'Načítavam profilové dáta...';
    } else if (loading) {
        loadingMessage = 'Načítavam...';
    }

    return React.createElement(
      'div',
      { className: 'flex items-center justify-center min-h-screen bg-gray-100' },
      React.createElement('div', { className: 'text-xl font-semibold text-gray-700' }, loadingMessage)
    );
  }

  // If user is not admin, redirect
  if (userProfileData && userProfileData.role !== 'admin') {
    console.log("AddCategoriesApp: Používateľ nie je admin a snaží sa pristupovať k vytváraniu kategórií, presmerovávam.");
    window.location.href = 'logged-in-my-data.html'; // Presmerovanie na logged-in-my-data.html
    return null;
  }

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
    React.createElement(NotificationModal, {
        message: userNotificationMessage,
        onClose: () => setUserNotificationMessage(''),
        type: error ? 'error' : 'success' // Ak je error, zobrazí sa ako chyba, inak ako úspech
    }),
    React.createElement(AddCategoryModal, {
        show: showAddCategoryModal,
        onClose: () => setShowAddCategoryModal(false),
        onAddCategory: handleAddCategorySubmit,
        loading: loading,
        error: error,
        notificationMessage: userNotificationMessage,
        setNotificationMessage: setUserNotificationMessage // Pre odovzdanie funkcie na reset notifikácie
    }),
    React.createElement(EditCategoryModal, {
        show: showEditCategoryModal,
        onClose: () => { setShowEditCategoryModal(false); setCategoryToEdit(null); },
        onSaveCategory: handleEditCategorySubmit,
        loading: loading,
        category: categoryToEdit,
        error: error,
        notificationMessage: userNotificationMessage,
        setNotificationMessage: setUserNotificationMessage // Pre odovzdanie funkcie na reset notifikácie
    }),
    React.createElement(ConfirmationModal, { // NOVINKA: ConfirmationModal
        show: showConfirmDeleteModal,
        message: categoryToDelete ? `Naozaj chcete zmazať kategóriu "${categoryToDelete.name}"? Táto akcia je nevratná.` : '',
        onConfirm: handleDeleteCategory,
        onCancel: () => { setShowConfirmDeleteModal(false); setCategoryToDelete(null); },
        loading: loading,
    }),
    React.createElement(
      'div',
      { className: 'w-full max-w-4xl mt-20 mb-10 p-4' },
      error && React.createElement(
        'div',
        { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap', role: 'alert' },
        error
      ),
      React.createElement(
        'div',
        { className: 'bg-white p-8 rounded-lg shadow-xl w-full' },
        React.createElement('h1', { className: 'text-3xl font-bold text-center text-gray-800 mb-6' },
          'Vytvorenie kategórií' // Hlavný nadpis
        ),
        categories.length === 0 && !loading ? (
            React.createElement('p', { className: 'text-center text-gray-600' }, 'Zatiaľ neboli pridané žiadne kategórie.')
        ) : (
            React.createElement(
                'div',
                { className: 'overflow-x-auto' },
                React.createElement(
                    'table',
                    { className: 'min-w-full bg-white rounded-lg shadow-md' },
                    React.createElement(
                        'thead',
                        null,
                        React.createElement(
                            'tr',
                            { className: 'w-full bg-gray-200 text-gray-600 uppercase text-sm leading-normal' },
                            React.createElement('th', { scope: 'col', className: 'py-3 px-6 text-left' }, 'Názov kategórie'),
                            React.createElement('th', { scope: 'col', className: 'py-3 px-6 text-left' }, 'Vytvorené'),
                            React.createElement('th', { scope: 'col', className: 'py-3 px-6 text-left' }, 'Vytvoril'),
                            React.createElement('th', { scope: 'col', className: 'py-3 px-6 text-center' }, 'Akcie')
                        )
                    ),
                    React.createElement(
                        'tbody',
                        { className: 'text-gray-600 text-sm font-light' },
                        categories.map((cat) => (
                            React.createElement(
                                'tr',
                                { key: cat.id, className: 'border-b border-gray-200 hover:bg-gray-100' },
                                React.createElement('td', { className: 'py-3 px-6 text-left whitespace-nowrap' }, cat.name),
                                React.createElement('td', { className: 'py-3 px-6 text-left whitespace-nowrap' }, cat.createdAt ? new Date(cat.createdAt.toDate()).toLocaleString() : 'N/A'),
                                React.createElement('td', { className: 'py-3 px-6 text-left whitespace-nowrap' }, cat.createdByName || 'N/A'),
                                React.createElement(
                                    'td',
                                    { className: 'py-3 px-6 text-center' },
                                    React.createElement(
                                        'div',
                                        { className: 'flex item-center justify-center space-x-2' },
                                        React.createElement(
                                            'button',
                                            {
                                              onClick: () => { setCategoryToEdit(cat); setShowEditCategoryModal(true); },
                                              className: 'bg-yellow-500 hover:bg-yellow-600 text-white py-1 px-3 rounded-lg text-sm transition-colors duration-200',
                                              disabled: loading,
                                            },
                                            'Upraviť'
                                        ),
                                        React.createElement(
                                            'button',
                                            {
                                              onClick: () => confirmDeleteCategory(cat), // NOVINKA: Voláme confirmDeleteCategory
                                              className: 'bg-red-500 hover:bg-red-600 text-white py-1 px-3 rounded-lg text-sm transition-colors duration-200',
                                              disabled: loading,
                                            },
                                            'Zmazať'
                                        )
                                    )
                                )
                            )
                        ))
                    )
                )
            )
        )
      )
    ),
    // Zelené okrúhle tlačidlo s textom "+"
    React.createElement(
      'button',
      {
        className: 'fab-button',
        onClick: () => setShowAddCategoryModal(true), // Otvorí modálne okno na pridanie
        disabled: loading,
      },
      '+'
    )
  );
}

// Explicitne sprístupniť komponent globálne
window.AddCategoriesApp = AddCategoriesApp;
