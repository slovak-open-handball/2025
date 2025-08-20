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

// NOVINKA: Pomocná funkcia pre generovanie tried CSS pre tlačidlá v modálnych oknách (py-2 px-4)
const getModalButtonClasses = (originalBgColorClass, disabledState) => {
  const baseClasses = 'py-2 px-4 rounded-lg transition-colors duration-200';
  const colorMatch = originalBgColorClass.match(/bg-(.+)-(\d+)/);

  if (disabledState && colorMatch) {
    const colorName = colorMatch[1];
    const colorShade = colorMatch[2];
    // Pre zablokovaný stav: biely podklad, farba obrysu a textu zodpovedá pôvodnej farbe výplne.
    return `${baseClasses} bg-white border border-${colorName}-${colorShade} text-${colorName}-${colorShade} opacity-50 cursor-not-allowed hover:cursor-not-allowed`;
  } else {
    // Pre aktívny stav: pôvodný podklad, efekt pri hoveri a farba textu.
    // Špeciálne ošetrenie pre sivé tlačidlá, ktoré používajú text-gray-800, nie text-white.
    if (originalBgColorClass.includes('bg-gray-')) {
      return `${baseClasses} ${originalBgColorClass} ${originalBgColorClass.replace('bg-', 'hover:bg-')} text-gray-800`;
    } else {
      return `${baseClasses} ${originalBgColorClass} ${originalBgColorClass.replace('bg-', 'hover:bg-')} text-white`;
    }
  }
};

// NOVINKA: Pomocná funkcia pre generovanie tried CSS pre tlačidlá v tabuľke (py-1 px-3)
const getTableButtonClasses = (originalBgColorClass, disabledState) => {
  const baseClasses = 'py-1 px-3 rounded-lg text-sm transition-colors duration-200';
  const colorMatch = originalBgColorClass.match(/bg-(.+)-(\d+)/);
  if (disabledState && colorMatch) {
    const colorName = colorMatch[1];
    const colorShade = colorMatch[2];
    return `${baseClasses} bg-white border border-${colorName}-${colorShade} text-${colorName}-${colorShade} opacity-50 cursor-not-allowed hover:cursor-not-allowed`;
  } else {
    const hoverBgClass = originalBgColorClass.replace('bg-', 'hover:bg-');
    return `${baseClasses} ${originalBgColorClass} ${hoverBgClass} text-white`;
  }
};


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
function AddCategoryModal({ show, onClose, onAddCategory, loading }) {
  const [newCategoryName, setNewCategoryName] = React.useState('');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [dateFromActive, setDateFromActive] = React.useState(false); 
  const [dateToActive, setDateToActive] = React.useState(false);   

  React.useEffect(() => {
    if (show) {
      setNewCategoryName('');
      setDateFrom('');
      setDateTo('');
      setDateFromActive(false); 
      setDateToActive(false);   
    }
  }, [show]); 


  if (!show) return null;

  const handleSubmit = async () => { 
    console.log("AddCategoryModal handleSubmit: Validating inputs.");
    if (newCategoryName.trim() === '') {
        showLocalNotification("Prosím vyplňte názov kategórie.", 'error');
        return;
    }
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

    console.log("AddCategoryModal handleSubmit: Client-side validation passed. Calling onAddCategory.");
    const success = await onAddCategory(newCategoryName, dateFrom, dateTo, dateFromActive, dateToActive);

    if (success) {
      onClose(); 
      console.log("AddCategoryModal handleSubmit: Category added successfully, closing modal.");
    } else {
      console.log("AddCategoryModal handleSubmit: Category addition failed, modal remains open.");
    }
  };

  const isDisabled = loading || newCategoryName.trim() === '' || 
                     (dateFromActive && dateFrom === '') || 
                     (dateToActive && dateTo === '') || 
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
            required: dateFromActive,
            disabled: loading,
        }),

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
            required: dateToActive,
            disabled: loading,
        }),

      ),
      React.createElement(
        'div',
        { className: 'flex justify-end space-x-4' },
        React.createElement(
          'button',
          {
            onClick: onClose,
            className: getModalButtonClasses('bg-gray-300', loading),
            disabled: loading,
          },
          'Zrušiť'
        ),
        React.createElement(
          'button',
          {
            onClick: handleSubmit,
            className: getModalButtonClasses('bg-blue-500', isDisabled),
            disabled: isDisabled,
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
  const [editedDateFromActive, setEditedDateFromActive] = React.useState(category ? (category.dateFromActive !== undefined ? category.dateFromActive : false) : false); 
  const [editedDateToActive, setEditedDateToActive] = React.useState(category ? (category.dateToActive !== undefined ? category.dateToActive : false) : false);     

  React.useEffect(() => {
    if (category) {
      setEditedCategoryName(category.name);
      setEditedDateFrom(category.dateFrom || '');
      setEditedDateTo(category.dateTo || '');
      setEditedDateFromActive(category.dateFromActive !== undefined ? category.dateFromActive : false); 
      setEditedDateToActive(category.dateToActive !== undefined ? category.dateToActive : false);     
    }
  }, [category]);

  const categoryExists = React.useMemo(() => {
    if (!category) {
      return false; 
    }

    const trimmedName = editedCategoryName.trim().toLowerCase();
    const currentCategoryId = category.id; 

    if (!Array.isArray(existingCategories)) {
      console.error("EditCategoryModal: existingCategories is NOT an array!", existingCategories);
      return false;
    }

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
    onSaveCategory(category.id, editedCategoryName, editedDateFrom, editedDateTo, editedDateFromActive, editedDateToActive);
  };

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
            required: editedDateFromActive,
            disabled: loading,
        }),

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
            required: editedDateToActive,
            disabled: loading,
        }),
        categoryExists && React.createElement(
            'p',
            { className: 'text-red-500 text-xs italic mt-2' },
            `Kategória s názvom ${editedCategoryName.trim()} už existuje. Zvoľte iný názov.`
        )
      ),
      React.createElement(
        'div',
        { className: 'flex justify-end space-x-4' },
        React.createElement(
          'button',
          {
            onClick: onClose,
            className: getModalButtonClasses('bg-gray-300', loading),
            disabled: loading,
          },
          'Zrušiť'
        ),
        React.createElement(
          'button',
          {
            onClick: handleSubmit,
            className: getModalButtonClasses('bg-blue-500', isDisabled),
            disabled: isDisabled,
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
            className: getModalButtonClasses('bg-gray-300', loading),
            disabled: loading,
          },
          'Zrušiť'
        ),
        React.createElement(
          'button',
          {
            onClick: onConfirm,
            className: getModalButtonClasses('bg-red-500', loading),
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
  const auth = getAuth(); 
  const db = getFirestore();     

  const [user, setUser] = React.useState(null); 
  const [userProfileData, setUserProfileData] = React.useState(null); 
  const [isAuthReady, setIsAuthReady] = React.useState(false); 

  const [loading, setLoading] = React.useState(true); 
  const [categories, setCategories] = React.useState([]); 
  const [showAddCategoryModal, setShowAddCategoryModal] = React.useState(false); 
  const [showEditCategoryModal, setShowEditCategoryModal] = React.useState(false); 
  const [categoryToEdit, setCategoryToEdit] = React.useState(null); 
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = React.useState(false); 
  const [categoryToDelete, setCategoryToDelete] = React.useState(null); 

  const [registrationStartDate, setRegistrationStartDate] = React.useState(null);

  // NOVINKA: Stav pre aktuálny čas, ktorý sa bude aktualizovať každú sekundu
  const [currentTime, setCurrentTime] = React.useState(new Date());

  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'; 

  React.useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(currentUser => {
      setUser(currentUser);
      setIsAuthReady(true); 
      if (!currentUser) {
        console.log("AddCategoriesApp: Používateľ nie je prihlásený, presmerovávam na login.html.");
        window.location.href = 'login.html';
      }
    });

    const handleGlobalDataUpdated = (event) => {
      setUserProfileData(event.detail);
      if (window.hideGlobalLoader) {
        window.hideGlobalLoader();
      }
    };
    window.addEventListener('globalDataUpdated', handleGlobalDataUpdated);

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
  }, []); 

  React.useEffect(() => {
    let unsubscribeUserDoc;

    if (user && db && isAuthReady) {
      console.log(`AddCategoriesApp: Pokúšam sa načítať používateľský dokument pre UID: ${user.uid}`);
      setLoading(true); 

      try {
        const userDocRef = doc(db, 'users', user.uid);
        unsubscribeUserDoc = onSnapshot(userDocRef, docSnapshot => { 
          console.log("AddCategoriesApp: Používateľský dokument existuje, dáta:", docSnapshot.data());

          if (docSnapshot.exists()) { 
            const userData = docSnapshot.data();
            setUserProfileData(userData);
            setLoading(false);

            if (userData.role !== 'admin') {
                console.log("AddCategoriesApp: Používateľ nie je admin, presmerovávam na logged-in-my-data.html.");
                window.location.href = 'logged-in-my-data.html';
            }

          } else {
            console.warn("AddCategoriesApp: Používateľský dokument sa nenašiel pre UID:", user.uid);
            if (typeof showLocalNotification === 'function') { 
                showLocalNotification("Chyba: Používateľský profil sa nenašiel. Skúste sa prosím znova prihlásiť.", 'error');
            }
            setLoading(false);
            auth.signOut(); 
            setUser(null);
            setUserProfileData(null);
          }
        }, error => {
          console.error("AddCategoriesApp: Chyba pri načítaní používateľských dát z Firestore (onSnapshot error):", error);
          if (typeof showLocalNotification === 'function') { 
            showLocalNotification(`Chyba pri načítaní používateľských dát: ${error.message}`, 'error');
          }
          setLoading(false);
          auth.signOut();
          setUser(null);
          setUserProfileData(null);
        });
      } catch (e) {
        console.error("AddCategoriesApp: Chyba pri nastavovaní onSnapshot pre používateľské dáta (try-catch):", e);
        if (typeof showLocalNotification === 'function') { 
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

  React.useEffect(() => {
    let unsubscribeRegistration;
    if (db) {
      const registrationDocRef = doc(db, 'settings', 'registration');
      unsubscribeRegistration = onSnapshot(registrationDocRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          if (data.registrationStartDate) {
            setRegistrationStartDate(data.registrationStartDate);
            console.log("Dátum začiatku registrácie načítaný:", data.registrationStartDate);
          } else {
            setRegistrationStartDate(null);
            console.log("Pole 'registrationStartDate' sa v dokumente settings/registration nenašlo.");
          }
        } else {
          setRegistrationStartDate(null);
          console.log("Dokument settings/registration neexistuje.");
        }
      }, (error) => {
        console.error("Chyba pri načítaní dátumu začiatku registrácie:", error);
        showLocalNotification(`Chyba pri načítaní dátumu registrácie: ${error.message}`, 'error');
        setRegistrationStartDate(null);
      });
    }

    return () => {
      if (unsubscribeRegistration) {
        unsubscribeRegistration();
      }
    };
  }, [db]); 

  // NOVINKA: Timer pre automatické zablokovanie tlačidiel
  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date()); // Aktualizujeme aktuálny čas každú sekundu
    }, 1000); // Každú sekundu

    return () => clearInterval(timer); // Vyčistenie pri odmontovaní komponentu
  }, []); 

  // NOVINKA: Určenie, či majú byť tlačidlá zablokované na základe dátumu
  const areAllButtonsDisabledByDate = React.useMemo(() => {
    if (!registrationStartDate || typeof registrationStartDate.seconds === 'undefined') {
      console.log("areAllButtonsDisabledByDate: registrationStartDate nie je definované alebo nie je Timestamp. Buttons UNBLOCKED.");
      return false; 
    }
    const startDate = new Date(registrationStartDate.seconds * 1000); 
    console.log(`areAllButtonsDisabledByDate: Aktuálny čas: ${currentTime.toLocaleString()}, Dátum zablokovania: ${startDate.toLocaleString()}`);
    const isDisabled = currentTime >= startDate;
    console.log(`areAllButtonsDisabledByDate: Výsledok porovnania (isDisabled): ${isDisabled}.`);
    return isDisabled;
  }, [registrationStartDate, currentTime]); 


  const getCategoriesDocRef = React.useCallback(() => {
    if (!db) return null; 
    return doc(db, 'settings', 'categories');
  }, [db]);

  React.useEffect(() => {
    let unsubscribeCategories;
    const categoriesDocRef = getCategoriesDocRef();

    if (db && userProfileData && userProfileData.role === 'admin' && categoriesDocRef) {
      console.log("AddCategoriesApp: Prihlásený používateľ je admin. Načítavam kategórie z dokumentu 'categories'.");
      setLoading(true);
      try {
        unsubscribeCategories = onSnapshot(categoriesDocRef, docSnapshot => { 
          console.log("AddCategoriesApp: onSnapshot pre dokument 'categories' spustený.");
          if (docSnapshot.exists()) { 
            const data = docSnapshot.data();
            let fetchedCategories = Object.entries(data).map(([id, categoryValue]) => { 
                let name = '';
                let dateFrom = '';
                let dateTo = '';
                let dateFromActive = false; 
                let dateToActive = false;   

                if (typeof categoryValue === 'object' && categoryValue !== null && categoryValue.name) {
                    name = categoryValue.name;
                    dateFrom = categoryValue.dateFrom || '';
                    dateTo = categoryValue.dateTo || '';
                    dateFromActive = categoryValue.dateFromActive !== undefined ? categoryValue.dateFromActive : false; 
                    dateToActive = categoryValue.dateToActive !== undefined ? categoryValue.dateToActive : false;     
                } else if (typeof categoryValue === 'string') {
                    name = categoryValue;
                    dateFrom = '';
                    dateTo = '';
                } else {
                    console.warn(`Neočakávaný formát dát kategórie pre ID ${id}:`, categoryValue);
                    name = `Neznáma kategória (${id})`; 
                    dateFrom = '';
                    dateTo = '';
                }
                return { id, name, dateFrom, dateTo, dateFromActive, dateToActive };
            });

            fetchedCategories.sort((a, b) => {
              const nameA = a.name.toLowerCase();
              const nameB = b.name.toLowerCase();

              const numA = parseFloat(nameA);
              const numB = parseFloat(nameB);

              if (!isNaN(numA) && !isNaN(numB)) {
                return numA - numB;
              }
              if (nameA < nameB) return -1;
              if (nameA > nameB) return 1;
              return 0;
            });

            setCategories(fetchedCategories);
            console.log("AddCategoriesApp: Kategórie aktualizované z onSnapshot dokumentu, dáta:", fetchedCategories);
          } else {
            console.log("AddCategoriesApp: Dokument 'categories' neexistuje, inicializujem prázdne kategórie.");
            setCategories([]); 
          }
          setLoading(false);
        }, error => {
          console.error("AddCategoriesApp: Chyba pri načítaní dokumentu 'categories' z Firestore (onSnapshot error):", error);
          if (typeof showLocalNotification === 'function') { 
            showLocalNotification(`Chyba pri načítaní kategórií: ${error.message}`, 'error');
          }
          setLoading(false);
        });
      } catch (e) {
        console.error("AddCategoriesApp: Chyba pri nastavovaní onSnapshot pre dokument 'categories' (try-catch):", e);
        if (typeof showLocalNotification === 'function') { 
            showLocalNotification(`Chyba pri nastavovaní poslucháča pre kategórie: ${e.message}`, 'error');
        }
        setLoading(false);
      }
    } else {
      setCategories([]); 
    }

    return () => {
      if (unsubscribeCategories) {
        console.log("AddCategoriesApp: Ruším odber onSnapshot pre dokument 'categories'.");
        unsubscribeCategories();
      }
    };
  }, [db, userProfileData, getCategoriesDocRef]);

  const sendAdminNotification = async (notificationData) => {
    if (!db) { 
      console.error("Chyba: Databáza nie je k dispozícii pre odoslanie notifikácie.");
      return;
    }
    try {
      const notificationsCollectionRef = collection(db, 'notifications');
      const userEmail = user.email; // Používame priamo user.email, ktorý by mal byť dostupný
      const currentTimestamp = new Date().toISOString(); 
      const changesToAdd = []; 

      const formatNotificationDate = (dateString) => {
        if (!dateString) return '';
        try {
          const [year, month, day] = dateString.split('-');
          return `${day}. ${month}. ${year}`;
        } catch (e) {
          console.error("Chyba pri formátovaní dátumu pre notifikáciu:", dateString, e);
          return dateString; 
        }
      };

      if (notificationData.type === 'create') {
        const { newCategoryName, dateFrom, dateTo, dateFromActive, dateToActive } = notificationData.data;
        const formattedDateFrom = formatNotificationDate(dateFrom);
        const formattedDateTo = formatNotificationDate(dateTo);

        changesToAdd.push(`Pre kategóriu '''${newCategoryName}'`);
        changesToAdd.push(`Vytvorenie názvu kategórie: '''${newCategoryName}'`);

        if (dateFrom || dateFromActive) { 
            changesToAdd.push(`Dátum od: '''${formattedDateFrom}'`);
            changesToAdd.push(`Aktívnosť pre dátum od ${formattedDateFrom || 'N/A'}: '''${dateFromActive ? 'Áno' : 'Nie'}'`);
        }

        if (dateTo || dateToActive) { 
            changesToAdd.push(`Dátum do: '''${formattedDateTo}'`);
            changesToAdd.push(`Aktívnosť pre dátum do ${formattedDateTo || 'N/A'}: '''${dateToActive ? 'Áno' : 'Nie'}'`); 
        }

      } else if (notificationData.type === 'edit') {
        const {
          originalCategoryName, originalDateFrom, originalDateTo, originalDateFromActive, originalDateToActive,
          newCategoryName, newDateFrom, newDateTo, newDateFromActive, newDateToActive
        } = notificationData.data;

        if (originalCategoryName !== newCategoryName) {
          changesToAdd.push(`Pre kategóriu '''${newCategoryName}'`);
          changesToAdd.push(`Zmena názvu kategórie: z '${originalCategoryName}' na '${newCategoryName}'`);
        }

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

      if (changesToAdd.length > 0) {
        await addDoc(notificationsCollectionRef, {
          userEmail: userEmail,
          timestamp: currentTimestamp,
          changes: arrayUnion(...changesToAdd) // Používame arrayUnion na pridanie viacerých zmien
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


  const handleAddCategorySubmit = async (categoryName, dateFrom, dateTo, dateFromActive, dateToActive) => {
    console.log("handleAddCategorySubmit: Starting category submission for name:", categoryName);
    if (!db || !user || !userProfileData || userProfileData.role !== 'admin') {
      if (typeof showLocalNotification === 'function') {
        showLocalNotification("Nemáte oprávnenie na pridanie kategórie.", 'error');
      }
      console.log("handleAddCategorySubmit: Insufficient permissions. Returning false.");
      return false; 
    }
    const trimmedCategoryName = categoryName.trim();
    if (trimmedCategoryName === '') { 
      if (typeof showLocalNotification === 'function') {
        showLocalNotification("Názov kategórie nemôže byť prázdny.", 'error');
      }
      console.log("handleAddCategorySubmit: Category name is empty. Returning false.");
      return false; 
    }

    if (dateFromActive && dateFrom === '') {
        showLocalNotification("Prosím vyplňte 'Dátum od', pretože je aktívny.", 'error');
        console.log("handleAddCategorySubmit: DateFrom active but empty. Returning false.");
        return false; 
    }
    if (dateToActive && dateTo === '') {
        showLocalNotification("Prosím vyplňte 'Dátum do', pretože je aktívny.", 'error');
        console.log("handleAddCategorySubmit: DateTo active but empty. Returning false.");
        return false; 
    }
    if (dateFromActive && dateToActive && dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
        showLocalNotification("Dátum 'Od' nemôže byť po dátume 'Do'.", 'error');
        console.log("handleAddCategorySubmit: DateFrom after DateTo. Returning false.");
        return false; 
    }

    setLoading(true);

    try {
      const categoriesDocRef = getCategoriesDocRef();
      if (!categoriesDocRef) { throw new Error("Referencia na dokument kategórií nie je k dispozícii."); }

      const docSnapshot = await getDoc(categoriesDocRef); 
      const currentCategoriesData = docSnapshot.exists() ? docSnapshot.data() : {}; 

      console.log("handleAddCategorySubmit: Checking for duplicate name in current data.");
      if (Object.values(currentCategoriesData).some(cat => 
        (typeof cat === 'object' && cat !== null && cat.name || '').toLowerCase() === trimmedCategoryName.toLowerCase()
      )) {
        if (typeof showLocalNotification === 'function') {
          showLocalNotification(`Kategória s názvom ${trimmedCategoryName} už existuje. Zvoľte iný názov.`, 'error');
        }
        console.log("handleAddCategorySubmit: Server-side duplicate detected for name:", trimmedCategoryName, ". Returning false.");
        setLoading(false); 
        return false; 
      }

      const newFieldId = doc(collection(db, 'settings')).id; 

      await setDoc(categoriesDocRef, {
        [newFieldId]: {
            name: trimmedCategoryName,
            dateFrom: dateFromActive ? dateFrom : '', 
            dateTo: dateToActive ? dateTo : '',       
            dateFromActive: dateFromActive,           
            dateToActive: dateToActive                
        }
      }, { merge: true });

      if (typeof showLocalNotification === 'function') {
        showLocalNotification(`Kategória s názvom ${trimmedCategoryName} pridaná.`, 'success');
      }

      const userEmail = user.email;
      await sendAdminNotification({ type: 'create', data: { newCategoryName: trimmedCategoryName, dateFrom: dateFrom, dateTo: dateTo, dateFromActive: dateFromActive, dateToActive: dateToActive, userEmail: userEmail } });

      return true; 

    } catch (e) {
      console.error("AddCategoriesApp: Chyba pri pridávaní kategórie:", e);
      if (typeof showLocalNotification === 'function') {
        showLocalNotification(`Chyba pri pridávaní kategórie: ${e.message}`, 'error');
      }
      console.log("handleAddCategorySubmit: Error during submission. Returning false.");
      return false; 
    } finally {
      setLoading(false);
    }
  };

  const handleEditCategorySubmit = async (categoryId, newName, newDateFrom, newDateTo, newDateFromActive, newDateToActive) => { 
    if (!db || !user || !userProfileData || userProfileData.role !== 'admin') {
      if (typeof showLocalNotification === 'function') {
        showLocalNotification("Nemáte oprávnenie na úpravu kategórie.", 'error');
      }
      return;
    }
    const trimmedNewName = newName.trim();
    if (trimmedNewName === '') { 
      if (typeof showLocalNotification === 'function') {
        showLocalNotification("Názov kategórie nemôže byť prázdny.", 'error');
      }
      return;
    }
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

      const docSnapshot = await getDoc(categoriesDocRef); 
      const currentCategoriesData = docSnapshot.exists() ? docSnapshot.data() : {}; 

      if (Object.entries(currentCategoriesData).some(([id, catData]) => 
            (typeof catData === 'object' && catData !== null && catData.name || '').toLowerCase() === trimmedNewName.toLowerCase() &&
            id !== categoryId 
        )) {
        if (typeof showLocalNotification === 'function') {
          showLocalNotification(`Kategória s názvom ${trimmedNewName} už existuje. Zvoľte iný názov.`, 'error');
        }
        setLoading(false);
        return;
      }

      const originalCategoryData = currentCategoriesData[categoryId];
      const originalCategoryName = originalCategoryData.name;
      const originalDateFrom = originalCategoryData.dateFrom;
      const originalDateTo = originalCategoryData.dateTo;
      const originalDateFromActive = originalCategoryData.dateFromActive !== undefined ? originalCategoryData.dateFromActive : false; 
      const originalDateToActive = originalCategoryData.dateToActive !== undefined ? originalCategoryData.dateToActive : false;     

      await setDoc(categoriesDocRef, {
        [categoryId]: {
            name: trimmedNewName,
            dateFrom: newDateFromActive ? newDateFrom : '', 
            dateTo: newDateToActive ? newDateTo : '',       
            dateFromActive: newDateFromActive,              
            dateToActive: newDateToActive                   
        }
      }, { merge: true });

      if (typeof showLocalNotification === 'function') {
        showLocalNotification("Kategória aktualizovaná!", 'success');
      }
      setShowEditCategoryModal(false); 
      setCategoryToEdit(null);

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
      }); 

    } catch (e) {
      console.error("AddCategoriesApp: Chyba pri aktualizácii kategórie:", e);
      if (typeof showLocalNotification === 'function') {
        showLocalNotification(`Chyba pri aktualizácii kategórie: ${e.message}`, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteCategory = (category) => {
    setCategoryToDelete(category);
    setShowConfirmDeleteModal(true);
  };

  const handleDeleteCategory = async () => {
    if (!db || !user || !userProfileData || userProfileData.role !== 'admin' || !categoryToDelete) {
      if (typeof showLocalNotification === 'function') {
        showLocalNotification("Nemáte oprávnenie na zmazanie kategórie alebo kategória nie je vybraná.", 'error');
      }
      return;
    }

    setLoading(true);
    setShowConfirmDeleteModal(false); 

    try {
      const categoriesDocRef = getCategoriesDocRef();
      if (!categoriesDocRef) { throw new Error("Referencia na dokument kategórií nie je k dispozícii."); }

      await setDoc(categoriesDocRef, {
        [categoryToDelete.id]: deleteField()
      }, { merge: true });

      if (typeof showLocalNotification === 'function') {
        showLocalNotification(`Kategória ${categoryToDelete.name} bola zmazaná.`, 'success');
      }
      setCategoryToDelete(null);

      const userEmail = user.email;
      await sendAdminNotification({ type: 'delete', data: { categoryName: categoryToDelete.name, userEmail: userEmail } });

    } catch (e) {
      console.error("AddCategoriesApp: Chyba pri mazaní kategórie:", e);
      if (typeof showLocalNotification === 'function') {
        showLocalNotification(`Chyba pri mazaní kategórie: ${e.message}`, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDateDisplay = (dateString) => {
    if (!dateString) return '';
    try {
      const [year, month, day] = dateString.split('-');
      return `${day}. ${month}. ${year}`;
    } catch (e) {
      console.error("Chyba pri formátovaní dátumu pre zobrazenie:", dateString, e);
      return dateString;
    }
  };

  const renderDateStatus = (dateString, isActive) => {
    const statusColor = isActive ? 'bg-green-500' : 'bg-red-500';
    return React.createElement(
      'div',
      { className: 'flex items-center space-x-2' },
      React.createElement('span', { className: `inline-block h-3 w-3 rounded-full ${statusColor}` }),
      React.createElement('span', null, formatDateDisplay(dateString))
    );
  };

  if (!isAuthReady || !userProfileData) {
    return null;
  }

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
    React.createElement(AddCategoryModal, {
        show: showAddCategoryModal,
        onClose: () => { setShowAddCategoryModal(false); }, 
        onAddCategory: handleAddCategorySubmit,
        loading: loading,
    }),
    React.createElement(EditCategoryModal, {
        show: showEditCategoryModal,
        onClose: () => { setShowEditCategoryModal(false); setCategoryToEdit(null); }, 
        onSaveCategory: handleEditCategorySubmit,
        loading: loading,
        category: categoryToEdit,
        existingCategories: categories,
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
          'Vytvorenie kategórií'
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
                                React.createElement('td', { className: 'py-3 px-6 text-left whitespace-nowrap' }, renderDateStatus(cat.dateFrom, cat.dateFromActive)),
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
                                              className: getTableButtonClasses('bg-yellow-500', loading || areAllButtonsDisabledByDate),
                                              disabled: loading || areAllButtonsDisabledByDate,
                                            },
                                            'Upraviť'
                                        ),
                                        React.createElement(
                                            'button',
                                            {
                                              onClick: () => confirmDeleteCategory(cat),
                                              className: getTableButtonClasses('bg-red-500', loading || areAllButtonsDisabledByDate),
                                              disabled: loading || areAllButtonsDisabledByDate,
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
    React.createElement(
      'button',
      {
        className: `fixed bottom-4 right-4 h-14 w-14 flex items-center justify-center rounded-full text-2xl shadow-lg transition-colors duration-200 z-50 ${
            (loading || areAllButtonsDisabledByDate)
              ? 'bg-white border border-green-500 text-green-500 opacity-50 cursor-not-allowed hover:cursor-not-allowed'
              : 'bg-green-500 hover:bg-green-600 text-white'
        }`,
        onClick: () => setShowAddCategoryModal(true),
        disabled: loading || areAllButtonsDisabledByDate,
      },
      '+'
    )
  );
}

// Explicitne sprístupniť komponent globálne
window.AddCategoriesApp = AddCategoriesApp;
