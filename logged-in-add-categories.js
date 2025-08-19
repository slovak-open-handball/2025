// logged-in-add-categories.js
// Tento súbor predpokladá, že Firebase SDK verzie 9.x.x je inicializovaný v authentication.js
// a globálne funkcie ako window.auth, window.db, showGlobalLoader sú dostupné.

// Importy pre potrebné Firebase funkcie (modulárna syntax v9)
import { getFirestore, doc, onSnapshot, setDoc, collection, addDoc, getDoc, deleteField, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";


/**
 * Lokálna funkcia pre zobrazenie notifikácií v tomto module.
 * Presunutá sem z logged-in-my-data.js pre nezávislosť štýlovania.
 */
function showLocalNotification(message, type = 'success') {
    let notificationElement = document.getElementById('local-notification');
    if (!notificationElement) {
        notificationElement = document.createElement('div');
        notificationElement.id = 'local-notification';
        notificationElement.className = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[99999] opacity-0 transition-opacity duration-300';
        document.body.appendChild(notificationElement);
    }

    const baseClasses = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[99999] transition-all duration-500 ease-in-out transform';
    let typeClasses = '';
    switch (type) {
        case 'success':
            typeClasses = 'bg-green-500 text-white';
            break;
        case 'error':
            typeClasses = 'bg-red-500 text-white';
            break;
        case 'info':
            typeClasses = 'bg-blue-500 text-white';
            break;
        default:
            typeClasses = 'bg-gray-700 text-white';
    }

    notificationElement.className = `${baseClasses} ${typeClasses} opacity-0 scale-95`;
    notificationElement.textContent = message;

    // Zobrazenie notifikácie
    setTimeout(() => {
        notificationElement.className = `${baseClasses} ${typeClasses} opacity-100 scale-100`;
    }, 10);

    // Skrytie notifikácie po 5 sekundách
    setTimeout(() => {
        notificationElement.className = `${baseClasses} ${typeClasses} opacity-0 scale-95`;
    }, 5000);
}


// NOVÝ KOMPONENT: ToggleButton
function ToggleButton({ isActive, onToggle, disabled }) {
  const bgColor = isActive ? 'bg-green-500' : 'bg-red-500';
  // Upravené triedy pre toggle button, aby sa používali základné Tailwind farby
  const toggleClasses = `relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${bgColor} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`;
  const spanClasses = `pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${isActive ? 'translate-x-5' : 'translate-x-0'}`;

  return React.createElement(
    'button',
    {
      type: 'button',
      className: toggleClasses,
      role: 'switch',
      'aria-checked': isActive,
      onClick: onToggle,
      disabled: disabled,
    },
    React.createElement('span', { className: 'sr-only' }, isActive ? 'Zapnuté' : 'Vypnuté'), // Screen reader text
    React.createElement('span', {
      'aria-hidden': 'true',
      className: spanClasses,
    })
  );
}


// AddCategoryModal Component
function AddCategoryModal({ show, onClose, onAddCategory, loading, existingCategories }) {
  const [newCategoryName, setNewCategoryName] = React.useState('');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  // Nové stavy pre aktívny/neaktívny dátum, PREDVOLENE false
  const [dateFromActive, setDateFromActive] = React.useState(false); // ZMENA: Predvolené na false
  const [dateToActive, setDateToActive] = React.useState(false);   // ZMENA: Predvolené na false

  // Resetuje stav, keď sa modálne okno otvorí alebo zmení jeho 'show' property
  React.useEffect(() => {
    if (show) {
      setNewCategoryName('');
      setDateFrom('');
      setDateTo('');
      setDateFromActive(false); // VŽDY resetovať na false pri otvorení
      setDateToActive(false);   // VŽDY resetovať na false pri otvorení
    }
  }, [show]); // Efekt sa spustí, keď sa zmení hodnota 'show'


  // Kontrola, či názov kategórie už existuje (case-insensitive) aj s dátumami
  const categoryExists = React.useMemo(() => {
    const trimmedName = newCategoryName.trim().toLowerCase();
    return existingCategories.some(cat => 
        cat.name.toLowerCase() === trimmedName &&
        cat.dateFrom === dateFrom &&
        cat.dateTo === dateTo
    );
  }, [newCategoryName, dateFrom, dateTo, existingCategories]);

  if (!show) return null;

  const handleSubmit = () => {
    if (newCategoryName.trim() === '') {
        showLocalNotification("Prosím vyplňte názov kategórie.", 'error');
        return;
    }
    // NOVÁ LOGIKA: Dátum je povinný len ak je toggle zapnutý
    if (dateFromActive && dateFrom === '') {
        showLocalNotification("Prosím vyplňte 'Dátum od', pretože je aktívny.", 'error');
        return;
    }
    if (dateToActive && dateTo === '') {
        showLocalNotification("Prosím vyplňte 'Dátum do', pretože je aktívny.", 'error');
        return;
    }
    if (dateFromActive && dateToActive && dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
        showLocalNotification("Dátum 'Od' nemôže byť po dátume 'Do'.", 'error');
        return;
    }
    // Pridanie stavov toggle buttonov do onAddCategory
    onAddCategory(newCategoryName, dateFrom, dateTo, dateFromActive, dateToActive);
  };

  // NOVÁ LOGIKA: isDisabled - názov je vždy povinný. Dátumy sú povinné, len ak sú aktívne.
  const isDisabled = loading || newCategoryName.trim() === '' || 
                     (dateFromActive && dateFrom === '') || 
                     (dateToActive && dateTo === '') || 
                     categoryExists || 
                     (dateFromActive && dateToActive && dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo));


  return React.createElement(
    'div',
    { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50' },
    React.createElement(
      'div',
      { className: 'bg-white p-6 rounded-lg shadow-xl max-w-sm w-full' },
      React.createElement('h2', { className: 'text-xl font-bold mb-4' }, 'Pridať novú kategóriu'),
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
        }),
        
        // Dátum narodenia od s toggle buttonom
        React.createElement('div', { className: 'flex items-center justify-between mt-4 mb-2' },
          React.createElement('label', { className: 'block text-gray-700 text-sm font-bold', htmlFor: 'date-from' }, 'Dátum narodenia od'),
          React.createElement(ToggleButton, {
            isActive: dateFromActive,
            onToggle: () => setDateFromActive(!dateFromActive),
            disabled: loading,
          })
        ),
        React.createElement('input', {
            type: 'date',
            id: 'date-from',
            className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
            value: dateFrom,
            onChange: (e) => setDateFrom(e.target.value),
            required: dateFromActive, // Dátum je povinný len ak je toggle zapnutý
            disabled: loading,
        }),

        // Dátum narodenia do s toggle buttonom
        React.createElement('div', { className: 'flex items-center justify-between mt-4 mb-2' },
          React.createElement('label', { className: 'block text-gray-700 text-sm font-bold', htmlFor: 'date-to' }, 'Dátum narodenia do'),
          React.createElement(ToggleButton, {
            isActive: dateToActive,
            onToggle: () => setDateToActive(!dateToActive),
            disabled: loading,
          })
        ),
        React.createElement('input', {
            type: 'date',
            id: 'date-to',
            className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
            value: dateTo,
            onChange: (e) => setDateTo(e.target.value),
            required: dateToActive, // Dátum je povinný len ak je toggle zapnutý
            disabled: loading,
        }),
        categoryExists && React.createElement( // Zobrazenie chybovej správy
          'p',
          { className: 'text-red-500 text-xs italic mt-2' },
          `Kategória s názvom "${newCategoryName.trim()}" s týmito dátumami už existuje. Zvoľte iný názov alebo dátumy.`
        )
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
            // Upravené triedy pre disabled stav
            className: `py-2 px-4 rounded-lg transition-colors duration-200 ${
                isDisabled
                  ? 'bg-white text-blue-500 border border-blue-500 opacity-50 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`,
            disabled: isDisabled, // Používame premennú isDisabled
          },
          loading ? 'Ukladám...' : 'Pridať'
        )
      )
    )
  );
}

// EditCategoryModal Component
function EditCategoryModal({ show, onClose, onSaveCategory, loading, category, existingCategories }) {
  const [editedCategoryName, setEditedCategoryName] = React.useState(category ? category.name : '');
  const [editedDateFrom, setEditedDateFrom] = React.useState(category ? category.dateFrom : '');
  const [editedDateTo, setEditedDateTo] = React.useState(category ? category.dateTo : '');
  // Nové stavy pre aktívny/neaktívny dátum, PREDVOLENE false pre spätnú kompatibilitu
  const [editedDateFromActive, setEditedDateFromActive] = React.useState(category ? (category.dateFromActive !== undefined ? category.dateFromActive : false) : false); // ZMENA: Predvolené na false
  const [editedDateToActive, setEditedDateToActive] = React.useState(category ? (category.dateToActive !== undefined ? category.dateToActive : false) : false);     // ZMENA: Predvolené na false


  React.useEffect(() => {
    if (category) {
      setEditedCategoryName(category.name);
      setEditedDateFrom(category.dateFrom || '');
      setEditedDateTo(category.dateTo || '');
      // Načítanie existujúcich hodnôt alebo predvolené na false
      setEditedDateFromActive(category.dateFromActive !== undefined ? category.dateFromActive : false); // ZMENA: Predvolené na false
      setEditedDateToActive(category.dateToActive !== undefined ? category.dateToActive : false);     // ZMENA: Predvolené na false
    }
  }, [category]);

  // Kontrola, či názov kategórie už existuje (case-insensitive) aj s dátumami
  const categoryExists = React.useMemo(() => {
    // Pridanie kontroly, či je 'category' definované
    if (!category) {
      return false; 
    }

    const trimmedName = editedCategoryName.trim().toLowerCase();
    const currentCategoryId = category.id; 

    return existingCategories.some(cat => 
        cat.id !== currentCategoryId && 
        cat.name.toLowerCase() === trimmedName &&
        cat.dateFrom === editedDateFrom &&
        cat.dateTo === editedDateTo
    );
  }, [editedCategoryName, editedDateFrom, editedDateTo, existingCategories, category]);

  if (!show || !category) return null;

  const handleSubmit = () => {
    if (editedCategoryName.trim() === '') {
        showLocalNotification("Prosím vyplňte názov kategórie.", 'error');
        return;
    }
    // NOVÁ LOGIKA: Dátum je povinný len ak je toggle zapnutý
    if (editedDateFromActive && editedDateFrom === '') {
        showLocalNotification("Prosím vyplňte 'Dátum od', pretože je aktívny.", 'error');
        return;
    }
    if (editedDateToActive && editedDateTo === '') {
        showLocalNotification("Prosím vyplňte 'Dátum do', pretože je aktívny.", 'error');
        return;
    }
    if (editedDateFromActive && editedDateToActive && editedDateFrom && editedDateTo && new Date(editedDateFrom) > new Date(editedDateTo)) {
        showLocalNotification("Dátum 'Od' nemôže byť po dátume 'Do'.", 'error');
        return;
    }
    // Pridanie stavov toggle buttonov do onSaveCategory
    onSaveCategory(category.id, editedCategoryName, editedDateFrom, editedDateTo, editedDateFromActive, editedDateToActive);
  };

  // NOVÁ LOGIKA: isDisabled - názov je vždy povinný. Dátumy sú povinné, len ak sú aktívne.
  const isDisabled = loading || editedCategoryName.trim() === '' || 
                     (editedDateFromActive && editedDateFrom === '') || 
                     (editedDateToActive && editedDateTo === '') || 
                     categoryExists || 
                     (editedDateFromActive && editedDateToActive && editedDateFrom && editedDateTo && new Date(editedDateFrom) > new Date(editedDateTo));

  return React.createElement(
    'div',
    { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50' },
    React.createElement(
      'div',
      { className: 'bg-white p-6 rounded-lg shadow-xl max-w-sm w-full' },
      React.createElement('h2', { className: 'text-xl font-bold mb-4' }, `Upraviť kategóriu: ${category.name}`),
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
        }),
        
        // Dátum narodenia od s toggle buttonom
        React.createElement('div', { className: 'flex items-center justify-between mt-4 mb-2' },
          React.createElement('label', { className: 'block text-gray-700 text-sm font-bold', htmlFor: 'edit-date-from' }, 'Dátum narodenia od'),
          React.createElement(ToggleButton, {
            isActive: editedDateFromActive,
            onToggle: () => setEditedDateFromActive(!editedDateFromActive),
            disabled: loading,
          })
        ),
        React.createElement('input', {
            type: 'date',
            id: 'edit-date-from',
            className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
            value: editedDateFrom,
            onChange: (e) => setEditedDateFrom(e.target.value),
            required: editedDateFromActive, // Dátum je povinný len ak je toggle zapnutý
            disabled: loading,
        }),

        // Dátum narodenia do s toggle buttonom
        React.createElement('div', { className: 'flex items-center justify-between mt-4 mb-2' },
          React.createElement('label', { className: 'block text-gray-700 text-sm font-bold', htmlFor: 'edit-date-to' }, 'Dátum narodenia do'),
          React.createElement(ToggleButton, {
            isActive: editedDateToActive,
            onToggle: () => setEditedDateToActive(!editedDateToActive),
            disabled: loading,
          })
        ),
        React.createElement('input', {
            type: 'date',
            id: 'edit-date-to',
            className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
            value: editedDateTo,
            onChange: (e) => setEditedDateTo(e.target.value),
            required: editedDateToActive, // Dátum je povinný len ak je toggle zapnutý
            disabled: loading,
        }),
        categoryExists && React.createElement( // Zobrazenie chybovej správy
            'p',
            { className: 'text-red-500 text-xs italic mt-2' },
            `Kategória s názvom "${editedCategoryName.trim()}" s týmito dátumami už existuje. Zvoľte iný názov alebo dátumy.`
        )
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
            // Upravené triedy pre disabled stav
            className: `py-2 px-4 rounded-lg transition-colors duration-200 ${
                isDisabled
                  ? 'bg-white text-blue-500 border border-blue-500 opacity-50 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`,
            disabled: isDisabled, // Používame premennú isDisabled
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
    { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50' },
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
  // Získame referencie na Firebase služby z globálnych premenných
  // Pre Firebase v9 pristupujeme k inštanciám cez getAuth() a getFirestore()
  const auth = getAuth(); 
  const db = getFirestore();     

  // Lokálny stav pre aktuálneho používateľa a jeho profilové dáta
  const [user, setUser] = React.useState(null); 
  const [userProfileData, setUserProfileData] = React.useState(null); 
  const [isAuthReady, setIsAuthReady] = React.useState(false); 

  const [loading, setLoading] = React.useState(true); // Loading pre dáta v AddCategoriesApp
  const [categories, setCategories] = React.useState([]); // Stav pre zoznam kategórií
  const [showAddCategoryModal, setShowAddCategoryModal] = React.useState(false); // Stav pre zobrazenie modálneho okna pridania
  const [showEditCategoryModal, setShowEditCategoryModal] = React.useState(false); // Stav pre zobrazenie modálneho okna úpravy
  const [categoryToEdit, setCategoryToEdit] = React.useState(null); // Stav pre kategóriu, ktorá sa má upraviť
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = React.useState(false); // NOVINKA: Stav pre potvrdenie zmazania
  const [categoryToDelete, setCategoryToDelete] = React.useState(null); // NOVINKA: Kategória na zmazanie

  // Zabezpečíme, že appId je definované (používame globálnu premennú)
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'; 

  // Effect pre inicializáciu a sledovanie globálneho stavu autentifikácie a profilu
  React.useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(currentUser => {
      setUser(currentUser);
      setIsAuthReady(true); // Auth je pripravené
      if (!currentUser) {
        console.log("AddCategoriesApp: Používateľ nie je prihlásený, presmerovávam na login.html.");
        window.location.href = 'login.html';
      }
    });

    // Listener pre globalDataUpdated z authentication.js
    const handleGlobalDataUpdated = (event) => {
      setUserProfileData(event.detail);
      // Skrytie globálneho loaderu po načítaní profilových dát
      if (window.hideGlobalLoader) {
        window.hideGlobalLoader();
      }
    };
    window.addEventListener('globalDataUpdated', handleGlobalDataUpdated);

    // Počiatočné nastavenie, ak už sú dáta dostupné
    if (window.isGlobalAuthReady) {
        setIsAuthReady(true);
        setUser(auth.currentUser);
        if (window.globalUserProfileData) {
            setUserProfileData(window.globalUserProfileData);
            if (window.hideGlobalLoader) {
                window.hideGlobalLoader();
            }
        }
    }


    return () => {
      unsubscribeAuth();
      window.removeEventListener('globalDataUpdated', handleGlobalDataUpdated);
    };
  }, []); // Prázdne pole závislostí, spustí sa len raz pri mountovaní

  // Effect pre načítanie používateľských dát z Firestore a kontrolu roly
  React.useEffect(() => {
    let unsubscribeUserDoc;

    if (user && db && isAuthReady) {
      console.log(`AddCategoriesApp: Pokúšam sa načítať používateľský dokument pre UID: ${user.uid}`);
      setLoading(true); // Nastavíme loading na true, kým sa načítajú dáta profilu

      try {
        // Firebase v9 syntax: doc(db, 'users', user.uid)
        const userDocRef = doc(db, 'users', user.uid);
        unsubscribeUserDoc = onSnapshot(userDocRef, docSnapshot => { // Firebase v9 syntax: onSnapshot
          if (docSnapshot.exists()) { // Firebase v9 syntax: docSnapshot.exists()
            const userData = docSnapshot.data();
            console.log("AddCategoriesApp: Používateľský dokument existuje, dáta:", userData);

            setUserProfileData(userData);
            setLoading(false);

            // Ak používateľ nie je admin, presmerujeme ho
            if (userData.role !== 'admin') {
                console.log("AddCategoriesApp: Používateľ nie je admin, presmerovávam na logged-in-my-data.html.");
                window.location.href = 'logged-in-my-data.html';
            }

          } else {
            console.warn("AddCategoriesApp: Používateľský dokument sa nenašiel pre UID:", user.uid);
            if (typeof showLocalNotification === 'function') { // Použitie lokálnej notifikácie
                showLocalNotification("Chyba: Používateľský profil sa nenašiel. Skúste sa prosím znova prihlásiť.", 'error');
            }
            setLoading(false);
            auth.signOut(); // Odhlásiť používateľa
            setUser(null);
            setUserProfileData(null);
          }
        }, error => {
          console.error("AddCategoriesApp: Chyba pri načítaní používateľských dát z Firestore (onSnapshot error):", error);
          if (typeof showLocalNotification === 'function') { // Použitie lokálnej notifikácie
            showLocalNotification(`Chyba pri načítaní používateľských dát: ${error.message}`, 'error');
          }
          setLoading(false);
          auth.signOut();
          setUser(null);
          setUserProfileData(null);
        });
      } catch (e) {
        console.error("AddCategoriesApp: Chyba pri nastavovaní onSnapshot pre používateľské dáta (try-catch):", e);
        if (typeof showLocalNotification === 'function') { // Použitie lokálnej notifikácie
            showLocalNotification(`Chyba pri nastavovaní poslucháča pre používateľské dáta: ${e.message}`, 'error');
        }
        setLoading(false);
        auth.signOut();
        setUser(null);
        setUserProfileData(null);
      }
    } else if (isAuthReady && user === null) {
        setLoading(false);
        setUserProfileData(null);
    }

    return () => {
      if (unsubscribeUserDoc) {
        console.log("AddCategoriesApp: Ruším odber onSnapshot pre používateľský dokument.");
        unsubscribeUserDoc();
      }
    };
  }, [user, db, isAuthReady, auth]);


  // Callback funkcia pre získanie referencie na dokument kategórií
  const getCategoriesDocRef = React.useCallback(() => {
    if (!db) return null; 
    // Firebase v9 syntax: doc(db, 'settings', 'categories')
    return doc(db, 'settings', 'categories');
  }, [db]);

  // Effect for fetching categories
  React.useEffect(() => {
    let unsubscribeCategories;
    const categoriesDocRef = getCategoriesDocRef();

    if (db && userProfileData && userProfileData.role === 'admin' && categoriesDocRef) {
      console.log("AddCategoriesApp: Prihlásený používateľ je admin. Načítavam kategórie z dokumentu 'categories'.");
      setLoading(true);
      try {
        unsubscribeCategories = onSnapshot(categoriesDocRef, docSnapshot => { // Firebase v9 syntax: onSnapshot
          console.log("AddCategoriesApp: onSnapshot pre dokument 'categories' spustený.");
          if (docSnapshot.exists()) { // Firebase v9 syntax: docSnapshot.exists()
            const data = docSnapshot.data();
            // Konvertujeme objekt na pole objektov { id, name, dateFrom, dateTo, dateFromActive, dateToActive }
            let fetchedCategories = Object.entries(data).map(([id, categoryValue]) => { 
                let name = '';
                let dateFrom = '';
                let dateTo = '';
                // ZMENA: Predvolené na false pre spätnú kompatibilitu, ak pole neexistuje
                let dateFromActive = false; 
                let dateToActive = false;   

                if (typeof categoryValue === 'object' && categoryValue !== null && categoryValue.name) {
                    // Nový formát: { name: "...", dateFrom: "...", dateTo: "...", dateFromActive: true/false, dateToActive: true/false }
                    name = categoryValue.name;
                    dateFrom = categoryValue.dateFrom || '';
                    dateTo = categoryValue.dateTo || '';
                    dateFromActive = categoryValue.dateFromActive !== undefined ? categoryValue.dateFromActive : false; // ZMENA: Predvolené na false
                    dateToActive = categoryValue.dateToActive !== undefined ? categoryValue.dateToActive : false;     // ZMENA: Predvolené na false
                } else if (typeof categoryValue === 'string') {
                    // Starý formát: "CategoryName" - pre spätnú kompatibilitu
                    name = categoryValue;
                    dateFrom = '';
                    dateTo = '';
                    // Tu ponechávame default false
                } else {
                    // Spracovanie neočakávaného formátu, napr. zalogovanie varovania
                    console.warn(`Neočakávaný formát dát kategórie pre ID ${id}:`, categoryValue);
                    name = `Neznáma kategória (${id})`; // Záložný názov
                    dateFrom = '';
                    dateTo = '';
                    // Tu ponechávame default false
                }
                return { id, name, dateFrom, dateTo, dateFromActive, dateToActive };
            });
            
            // Triedenie kategórií podľa názvu (abecedne/číselne)
            fetchedCategories.sort((a, b) => {
              const nameA = a.name.toLowerCase();
              const nameB = b.name.toLowerCase();

              // Skúsiť číselné porovnanie, ak sú to čísla
              const numA = parseFloat(nameA);
              const numB = parseFloat(nameB);

              if (!isNaN(numA) && !isNaN(numB)) {
                return numA - numB;
              }
              // Inak abecedné porovnanie
              if (nameA < nameB) return -1;
              if (nameA > nameB) return 1;
              return 0;
            });

            setCategories(fetchedCategories);
            console.log("AddCategoriesApp: Kategórie aktualizované z onSnapshot dokumentu, dáta:", fetchedCategories);
          } else {
            console.log("AddCategoriesApp: Dokument 'categories' neexistuje, inicializujem prázdne kategórie.");
            setCategories([]); // Dokument kategórií zatiaľ neexistuje, takže prázdny zoznam
          }
          setLoading(false);
        }, error => {
          console.error("AddCategoriesApp: Chyba pri načítaní dokumentu 'categories' z Firestore (onSnapshot error):", error);
          if (typeof showLocalNotification === 'function') { // Použitie lokálnej notifikácie
            showLocalNotification(`Chyba pri načítaní kategórií: ${error.message}`, 'error');
          }
          setLoading(false);
        });
      } catch (e) {
        console.error("AddCategoriesApp: Chyba pri nastavovaní onSnapshot pre dokument 'categories' (try-catch):", e);
        if (typeof showLocalNotification === 'function') { // Použitie lokálnej notifikácie
            showLocalNotification(`Chyba pri nastavovaní poslucháča pre kategórie: ${e.message}`, 'error');
        }
        setLoading(false);
      }
    } else {
      setCategories([]); // Vyčisti kategórie, ak nie je admin alebo nie je pripravené
    }

    return () => {
      if (unsubscribeCategories) {
        console.log("AddCategoriesApp: Ruším odber onSnapshot pre dokument 'categories'.");
        unsubscribeCategories();
      }
    };
  }, [db, userProfileData, getCategoriesDocRef]);

  // Funkcia na odoslanie notifikácie administrátorom
  const sendAdminNotification = async (notificationData) => {
    if (!db) { 
      console.error("Chyba: Databáza nie je k dispozícii pre odoslanie notifikácie.");
      return;
    }
    try {
      // Odkaz na kolekciu 'notifications'
      const notificationsCollectionRef = collection(db, 'notifications');
      const userEmail = notificationData.data.userEmail;
      const currentTimestamp = new Date().toISOString(); // Získanie aktuálnej časovej pečiatky
      const changesToAdd = []; // Toto bude pole reťazcov zmien

      // Pomocná funkcia pre formátovanie dátumu do DD. MM. YYYY
      const formatNotificationDate = (dateString) => {
        if (!dateString) return '';
        try {
          const [year, month, day] = dateString.split('-');
          return `${day}. ${month}. ${year}`;
        } catch (e) {
          console.error("Chyba pri formátovaní dátumu pre notifikáciu:", dateString, e);
          return dateString; // Vráti pôvodný reťazec v prípade chyby
        }
      };

      if (notificationData.type === 'create') {
        const { newCategoryName, dateFrom, dateTo, dateFromActive, dateToActive } = notificationData.data;
        const formattedDateFrom = formatNotificationDate(dateFrom);
        const formattedDateTo = formatNotificationDate(dateTo);

        // Názov kategórie je vždy prítomný pri vytvorení
        changesToAdd.push(`Pre kategóriu '''${newCategoryName}'`);
        changesToAdd.push(`Vytvorenie názvu kategórie: '''${newCategoryName}'`);
        
        // Dátum od a jeho aktívnosť
        if (dateFrom || dateFromActive) { // Generovať, ak je dátum alebo je aktívny
            changesToAdd.push(`Dátum od: '''${formattedDateFrom}'`);
            changesToAdd.push(`Aktívnosť pre dátum od ${formattedDateFrom || 'N/A'}: '''${dateFromActive ? 'Áno' : 'Nie'}'`);
        }
        
        // Dátum do a jeho aktívnosť
        if (dateTo || dateToActive) { // Generovať, ak je dátum alebo je aktívny
            changesToAdd.push(`Dátum do: '''${formattedDateTo}'`);
            changesToAdd.push(`Aktívnosť pre dátum do ${formattedDateTo || 'N/A'}: '''${dateToActive ? 'Áno' : 'Nie'}'`);
        }

      } else if (notificationData.type === 'edit') {
        const {
          originalCategoryName, originalDateFrom, originalDateTo, originalDateFromActive, originalDateToActive,
          newCategoryName, newDateFrom, newDateTo, newDateFromActive, newDateToActive
        } = notificationData.data;

        // Kontrola zmeny názvu
        if (originalCategoryName !== newCategoryName) {
          changesToAdd.push(`Pre kategóriu '''${newCategoryName}'`);
          changesToAdd.push(`Zmena názvu kategórie: z '${originalCategoryName}' na '${newCategoryName}'`);
        }

        // Kontrola zmeny "Dátum od"
        const formattedOriginalDateFrom = formatNotificationDate(originalDateFrom);
        const formattedNewDateFrom = formatNotificationDate(newDateFrom);
        if (formattedOriginalDateFrom !== formattedNewDateFrom || originalDateFromActive !== newDateFromActive) {
          changesToAdd.push(`Pre kategóriu '''${newCategoryName}'`); 
          if (formattedOriginalDateFrom !== formattedNewDateFrom) {
            changesToAdd.push(`Zmena dátumu od: z '${formattedOriginalDateFrom}' na '${formattedNewDateFrom}'`);
          }
          if (originalDateFromActive !== newDateFromActive) {
            changesToAdd.push(`Zmena aktívnosti pre dátum od ${formattedNewDateFrom}: z '${originalDateFromActive ? 'Áno' : 'Nie'}' na '${newDateFromActive ? 'Áno' : 'Nie'}'`);
          }
        }

        // Kontrola zmeny "Dátum do"
        const formattedOriginalDateTo = formatNotificationDate(originalDateTo);
        const formattedNewDateTo = formatNotificationDate(newDateTo);
        if (formattedOriginalDateTo !== formattedNewDateTo || originalDateToActive !== newDateToActive) {
          changesToAdd.push(`Pre kategóriu '''${newCategoryName}'`); 
          if (formattedOriginalDateTo !== formattedNewDateTo) {
            changesToAdd.push(`Zmena dátumu do: z '${formattedOriginalDateTo}' na '${formattedNewDateTo}'`);
          }
          if (originalDateToActive !== newDateToActive) {
            changesToAdd.push(`Zmena aktívnosti pre dátum do ${formattedNewDateTo}: z '${originalDateToActive ? 'Áno' : 'Nie'}' na '${newDateToActive ? 'Áno' : 'Nie'}'`);
          }
        }
      } else if (notificationData.type === 'delete') {
        changesToAdd.push(
          `Zmazanie kategórie: '''${notificationData.data.categoryName}'`
        );
      }

      // Použitie addDoc na vytvorenie nového dokumentu v kolekcii 'notifications'
      if (changesToAdd.length > 0) {
        await addDoc(notificationsCollectionRef, {
          userEmail: userEmail,
          timestamp: currentTimestamp,
          changes: changesToAdd // Pole textových reťazcov zmien
        });
        console.log("Notifikácia pre administrátorov uložená do kolekcie 'notifications'.");
      } else {
        console.log("Žiadne zmeny na uloženie notifikácií.");
      }

    } catch (e) {
      console.error("AddCategoriesApp: Chyba pri ukladaní notifikácie pre administrátorov:", e);
      if (typeof showLocalNotification === 'function') {
        showLocalNotification(`Chyba pri ukladaní notifikácie pre administrátorov: ${e.message}`, 'error');
      }
    }
  };


  // Funkcia na pridanie novej kategórie
  const handleAddCategorySubmit = async (categoryName, dateFrom, dateTo, dateFromActive, dateToActive) => { // Prijíma nové parametre
    if (!db || !user || !userProfileData || userProfileData.role !== 'admin') {
      if (typeof showLocalNotification === 'function') {
        showLocalNotification("Nemáte oprávnenie na pridanie kategórie.", 'error');
      }
      return;
    }
    const trimmedCategoryName = categoryName.trim();
    if (trimmedCategoryName === '') { // ZMENA: Iba názov je vždy povinný
      if (typeof showLocalNotification === 'function') {
        showLocalNotification("Názov kategórie nemôže byť prázdny.", 'error');
      }
      return;
    }

    // NOVÁ LOGIKA: Dátum je povinný len ak je toggle zapnutý
    if (dateFromActive && dateFrom === '') {
        showLocalNotification("Prosím vyplňte 'Dátum od', pretože je aktívny.", 'error');
        return;
    }
    if (dateToActive && dateTo === '') {
        showLocalNotification("Prosím vyplňte 'Dátum do', pretože je aktívny.", 'error');
        return;
    }
    if (dateFromActive && dateToActive && dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
        showLocalNotification("Dátum 'Od' nemôže byť po dátume 'Do'.", 'error');
        return;
    }

    setLoading(true);

    try {
      const categoriesDocRef = getCategoriesDocRef();
      if (!categoriesDocRef) { throw new Error("Referencia na dokument kategórií nie je k dispozícii."); }

      // Firebase v9 syntax: getDoc(docRef)
      const docSnapshot = await getDoc(categoriesDocRef); 
      const currentCategoriesData = docSnapshot.exists() ? docSnapshot.data() : {}; // Firebase v9 syntax: docSnapshot.exists()

      // Kontrola duplicity názvu kategórie (case-insensitive) aj s dátumami
      if (Object.values(currentCategoriesData).some(cat => 
        // Zabezpečenie, že cat.name existuje pred volaním toLowerCase()
        (typeof cat === 'object' && cat !== null && cat.name || '').toLowerCase() === trimmedCategoryName.toLowerCase() &&
        cat.dateFrom === dateFrom &&
        cat.dateTo === dateTo
      )) {
        if (typeof showLocalNotification === 'function') {
          showLocalNotification(`Kategória s názvom "${trimmedCategoryName}" s týmito dátumami už existuje. Zvoľte iný názov alebo dátumy.`, 'error');
        }
        setLoading(false);
        return;
      }

      // Generujeme náhodné ID pre názov poľa (Firebase v9 way to get a new doc ID)
      const newFieldId = doc(collection(db, 'settings')).id; 

      // Firebase v9 syntax: setDoc(docRef, data, { merge: true })
      await setDoc(categoriesDocRef, {
        [newFieldId]: {
            name: trimmedCategoryName,
            dateFrom: dateFromActive ? dateFrom : '', // Ukladáme prázdny reťazec, ak nie je aktívne
            dateTo: dateToActive ? dateTo : '',       // Ukladáme prázdny reťazec, ak nie je aktívne
            dateFromActive: dateFromActive,           // Ukladanie stavu aktivity dátumu
            dateToActive: dateToActive                // Ukladanie stavu aktivity dátumu
        }
      }, { merge: true });

      if (typeof showLocalNotification === 'function') {
        showLocalNotification("Kategória pridaná!", 'success');
      }
      setShowAddCategoryModal(false); // Zatvorí modálne okno po úspešnom pridaní

      // Odoslanie notifikácie administrátorom s e-mailovou adresou používateľa
      const userEmail = user.email;
      await sendAdminNotification({ type: 'create', data: { newCategoryName: trimmedCategoryName, dateFrom: dateFrom, dateTo: dateTo, dateFromActive: dateFromActive, dateToActive: dateToActive, userEmail: userEmail } }); // Upravené volanie

    } catch (e) {
      console.error("AddCategoriesApp: Chyba pri pridávaní kategórie:", e);
      if (typeof showLocalNotification === 'function') {
        showLocalNotification(`Chyba pri pridávaní kategórie: ${e.message}`, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  // Funkcia na úpravu kategórie
  const handleEditCategorySubmit = async (categoryId, newName, newDateFrom, newDateTo, newDateFromActive, newDateToActive) => { // Prijíma nové parametre
    if (!db || !user || !userProfileData || userProfileData.role !== 'admin') {
      if (typeof showLocalNotification === 'function') {
        showLocalNotification("Nemáte oprávnenie na úpravu kategórie.", 'error');
      }
      return;
    }
    const trimmedNewName = newName.trim();
    if (trimmedNewName === '') { // ZMENA: Iba názov je vždy povinný
      if (typeof showLocalNotification === 'function') {
        showLocalNotification("Názov kategórie nemôže byť prázdny.", 'error');
      }
      return;
    }
    // NOVÁ LOGIKA: Dátum je povinný len ak je toggle zapnutý
    if (newDateFromActive && newDateFrom === '') {
        showLocalNotification("Prosím vyplňte 'Dátum od', pretože je aktívny.", 'error');
        return;
    }
    if (newDateToActive && newDateTo === '') {
        showLocalNotification("Prosím vyplňte 'Dátum do', pretože je aktívny.", 'error');
        return;
    }
    if (newDateFromActive && newDateToActive && new Date(newDateFrom) > new Date(newDateTo)) {
        showLocalNotification("Dátum 'Od' nemôže byť po dátume 'Do'.", 'error');
        return;
    }

    setLoading(true);

    try {
      const categoriesDocRef = getCategoriesDocRef();
      if (!categoriesDocRef) { throw new Error("Referencia na dokument kategórií nie je k dispozícii."); }

      // Firebase v9 syntax: getDoc(docRef)
      const docSnapshot = await getDoc(categoriesDocRef); 
      const currentCategoriesData = docSnapshot.exists() ? docSnapshot.data() : {}; // Firebase v9 syntax: docSnapshot.exists()

      // Kontrola duplicity názvu kategórie pri úprave (okrem samotnej upravovanej kategórie)
      if (Object.entries(currentCategoriesData).some(([id, catData]) => 
            // Zabezpečenie, že catData je objekt a má vlastnosť 'name' pred volaním toLowerCase()
            (typeof catData === 'object' && catData !== null && catData.name || '').toLowerCase() === trimmedNewName.toLowerCase() &&
            catData.dateFrom === newDateFrom &&
            catData.dateTo === newDateTo &&
            id !== categoryId
        )) {
        if (typeof showLocalNotification === 'function') {
          showLocalNotification(`Kategória s názvom "${trimmedNewName}" s týmito dátumami už existuje. Zvoľte iný názov alebo dátumy.`, 'error');
        }
        setLoading(false);
        return;
      }

      // Získame pôvodný názov kategórie a dátumy pre notifikáciu
      const originalCategoryData = currentCategoriesData[categoryId];
      const originalCategoryName = originalCategoryData.name;
      const originalDateFrom = originalCategoryData.dateFrom;
      const originalDateTo = originalCategoryData.dateTo;
      const originalDateFromActive = originalCategoryData.dateFromActive !== undefined ? originalCategoryData.dateFromActive : false; // ZMENA: Predvolené na false
      const originalDateToActive = originalCategoryData.dateToActive !== undefined ? originalCategoryData.dateToActive : false;     // ZMENA: Predvolené na false

      // Firebase v9 syntax: setDoc(docRef, data, { merge: true })
      await setDoc(categoriesDocRef, {
        [categoryId]: {
            name: trimmedNewName,
            dateFrom: newDateFromActive ? newDateFrom : '', // Ukladáme prázdny reťazec, ak nie je aktívne
            dateTo: newDateToActive ? newDateTo : '',       // Ukladáme prázdny reťazec, ak nie je aktívne
            dateFromActive: newDateFromActive,              // Ukladanie stavu aktivity dátumu
            dateToActive: newDateToActive                   // Ukladanie stavu aktivity dátumu
        }
      }, { merge: true });

      if (typeof showLocalNotification === 'function') {
        showLocalNotification("Kategória aktualizovaná!", 'success');
      }
      setShowEditCategoryModal(false); // Zatvorí modálne okno po úprave
      setCategoryToEdit(null);

      // Odoslanie notifikácie administrátorom s e-mailovou adresou používateľa
      const userEmail = user.email;
      await sendAdminNotification({ 
          type: 'edit', 
          data: { 
              originalCategoryName: originalCategoryName, 
              originalDateFrom: originalDateFrom,
              originalDateTo: originalDateTo,
              originalDateFromActive: originalDateFromActive,
              originalDateToActive: originalDateToActive,
              newCategoryName: trimmedNewName, 
              newDateFrom: newDateFrom,
              newDateTo: newDateTo,
              newDateFromActive: newDateFromActive,
              newDateToActive: newDateToActive,
              userEmail: userEmail 
          } 
      }); // Upravené volanie

    } catch (e) {
      console.error("AddCategoriesApp: Chyba pri aktualizácii kategórie:", e);
      if (typeof showLocalNotification === 'function') {
        showLocalNotification(`Chyba pri aktualizácii kategórie: ${e.message}`, 'error');
      }
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
      if (typeof showLocalNotification === 'function') {
        showLocalNotification("Nemáte oprávnenie na zmazanie kategórie alebo kategória nie je vybraná.", 'error');
      }
      return;
    }

    setLoading(true);
    setShowConfirmDeleteModal(false); // Zatvorí potvrdzovací modál

    try {
      const categoriesDocRef = getCategoriesDocRef();
      if (!categoriesDocRef) { throw new Error("Referencia na dokument kategórií nie je k dispozícii."); }

      // Odstránime konkrétne pole z dokumentu pomocou deleteField() pre Firebase v9
      await setDoc(categoriesDocRef, {
        [categoryToDelete.id]: deleteField() // Používame deleteField() pre v9
      }, { merge: true }); // Používame merge: true pre bezpečné odstránenie poľa

      if (typeof showLocalNotification === 'function') {
        showLocalNotification(`Kategória ${categoryToDelete.name} bola zmazaná!`, 'success');
      }
      setCategoryToDelete(null); // Vyčistí kategóriu na zmazanie

      // Odoslanie notifikácie administrátorom s e-mailovou adresou používateľa
      const userEmail = user.email;
      await sendAdminNotification({ type: 'delete', data: { categoryName: categoryToDelete.name, userEmail: userEmail } }); // Upravené volanie

    } catch (e) {
      console.error("AddCategoriesApp: Chyba pri mazaní kategórie:", e);
      // Zobrazenie chyby pomocou lokálnej notifikácie
      if (typeof showLocalNotification === 'function') {
        showLocalNotification(`Chyba pri mazaní kategórie: ${e.message}`, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  // Pomocná funkcia pre formátovanie dátumu
  const formatDateDisplay = (dateString) => {
    if (!dateString) return '';
    try {
      const [year, month, day] = dateString.split('-');
      return `${day}. ${month}. ${year}`;
    } catch (e) {
      console.error("Chyba pri formátovaní dátumu pre zobrazenie:", dateString, e);
      return dateString; // Vráti pôvodný reťazec v prípade chyby
    }
  };

  // Zobrazenie indikátora aktivity dátumu v tabuľke
  const renderDateStatus = (dateString, isActive) => {
    const statusColor = isActive ? 'bg-green-500' : 'bg-red-500';
    // Odstránený text '(Aktívne)' alebo '(Neaktívne)'
    return React.createElement(
      'div',
      { className: 'flex items-center space-x-2' },
      React.createElement('span', { className: `inline-block h-3 w-3 rounded-full ${statusColor}` }),
      React.createElement('span', null, formatDateDisplay(dateString))
    );
  };


  // Display loading state
  // Táto časť bola odstránená, pretože globálny loader.js sa stará o zobrazenie počas počiatočného načítavania.
  // Lokálny stav 'loading' sa stále používa na riadenie interakcií v rámci komponentu (napr. disabled tlačidlá).
  if (!isAuthReady || !userProfileData) { // Pridaná kontrola userProfileData
    return null; // Návrat null, ak nie je pripravené, loader.js sa postará o zobrazenie
  }

  // Ak sa dostaneme sem, user je prihlásený, userProfileData sú načítané a rola je admin.
  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
    React.createElement(AddCategoryModal, {
        show: showAddCategoryModal,
        onClose: () => { setShowAddCategoryModal(false); }, 
        onAddCategory: handleAddCategorySubmit,
        loading: loading,
        existingCategories: categories 
    }),
    React.createElement(EditCategoryModal, {
        show: showEditCategoryModal,
        onClose: () => { setShowEditCategoryModal(false); setCategoryToEdit(null); }, 
        onSaveCategory: handleEditCategorySubmit,
        loading: loading,
        category: categoryToEdit,
        existingCategories: categories
    }),
    React.createElement(ConfirmationModal, { 
        show: showConfirmDeleteModal,
        message: categoryToDelete ? `Naozaj chcete zmazať kategóriu ${categoryToDelete.name}? Táto akcia je nevratná.` : '',
        onConfirm: handleDeleteCategory,
        onCancel: () => { setShowConfirmDeleteModal(false); setCategoryToDelete(null); },
        loading: loading,
    }),
    React.createElement(
      'div',
      { className: 'w-full max-w-3xl p-4' },
      React.createElement(
        'div',
        { className: 'bg-white p-8 rounded-lg shadow-xl w-full' },
        React.createElement('h1', { className: 'text-3xl font-bold text-center text-gray-800 mb-6' },
          'Vytvorenie kategórií' // Hlavný nadpis
        ),
        categories.length === 0 && !loading ? (
            React.createElement('p', { className: 'text-center text-gray-600' }, 'Zatiaľ neboli vytvorené žiadne kategórie.')
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
                            React.createElement('th', { scope: 'col', className: 'py-3 px-6 text-left' }, 'Dátum od'),
                            React.createElement('th', { scope: 'col', className: 'py-3 px-6 text-left' }, 'Dátum do'),
                            React.createElement('th', { scope: 'col', className: 'py-3 px-6 text-center' }, '')
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
                                // Zobrazenie dátumu od so stavom aktivity
                                React.createElement('td', { className: 'py-3 px-6 text-left whitespace-nowrap' }, renderDateStatus(cat.dateFrom, cat.dateFromActive)),
                                // Zobrazenie dátumu do so stavom aktivity
                                React.createElement('td', { className: 'py-3 px-6 text-left whitespace-nowrap' }, renderDateStatus(cat.dateTo, cat.dateToActive)),
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
                                              onClick: () => confirmDeleteCategory(cat),
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
