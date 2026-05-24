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

// AddCategoryModal Component - ODSTRÁNENÉ DÁTUMY
function AddCategoryModal({ show, onClose, onAddCategory, loading }) {
  const [newCategoryName, setNewCategoryName] = React.useState('');

  React.useEffect(() => {
    if (show) {
      setNewCategoryName('');
    }
  }, [show]); 

  if (!show) return null;

  const handleSubmit = async () => { 
    console.log("AddCategoryModal handleSubmit: Validating inputs.");
    if (newCategoryName.trim() === '') {
        showLocalNotification("Prosím vyplňte názov kategórie.", 'error');
        return;
    }

    console.log("AddCategoryModal handleSubmit: Client-side validation passed. Calling onAddCategory.");
    // Zavoláme bez dátumov
    const success = await onAddCategory(newCategoryName);

    if (success) {
      onClose(); 
      console.log("AddCategoryModal handleSubmit: Category added successfully, closing modal.");
    } else {
      console.log("AddCategoryModal handleSubmit: Category addition failed, modal remains open.");
    }
  };

  const isDisabled = loading || newCategoryName.trim() === '';

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
        })
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

// EditCategoryModal Component - ODSTRÁNENÉ DÁTUMY
function EditCategoryModal({ show, onClose, onSaveCategory, loading, category, existingCategories }) {
  const [editedCategoryName, setEditedCategoryName] = React.useState(category ? category.name : '');

  React.useEffect(() => {
    if (category) {
      setEditedCategoryName(category.name);
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
        cat.name.toLowerCase() === trimmedName
    );
  }, [editedCategoryName, existingCategories, category]);

  if (!show || !category) return null;

  const handleSubmit = () => {
    if (editedCategoryName.trim() === '') {
        showLocalNotification("Prosím vyplňte názov kategórie.", 'error');
        return;
    }
    onSaveCategory(category.id, editedCategoryName);
  };

  const isDisabled = loading || editedCategoryName.trim() === '' || categoryExists;

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
    const isDisabled = currentTime >= startDate;
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
            // Načítavame už len názov kategórie
            let fetchedCategories = Object.entries(data).map(([id, categoryValue]) => { 
                let name = '';

                if (typeof categoryValue === 'object' && categoryValue !== null && categoryValue.name) {
                    name = categoryValue.name;
                } else if (typeof categoryValue === 'string') {
                    name = categoryValue;
                } else {
                    console.warn(`Neočakávaný formát dát kategórie pre ID ${id}:`, categoryValue);
                    name = `Neznáma kategória (${id})`; 
                }
                return { id, name };
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

      if (notificationData.type === 'create') {
        const { newCategoryName } = notificationData.data;

        changesToAdd.push(`Vytvorenie kategórie: '''${newCategoryName}'`);

      } else if (notificationData.type === 'edit') {
        const {
          originalCategoryName,
          newCategoryName
        } = notificationData.data;

        if (originalCategoryName !== newCategoryName) {
          changesToAdd.push(`Zmena názvu kategórie: z '${originalCategoryName}' na '${newCategoryName}'`);
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


  const handleAddCategorySubmit = async (categoryName) => {
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
            name: trimmedCategoryName
        }
      }, { merge: true });

      if (typeof showLocalNotification === 'function') {
        showLocalNotification(`Kategória s názvom ${trimmedCategoryName} pridaná.`, 'success');
      }

      const userEmail = user.email;
      await sendAdminNotification({ type: 'create', data: { newCategoryName: trimmedCategoryName, userEmail: userEmail } });

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

  const handleEditCategorySubmit = async (categoryId, newName) => { 
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

      await setDoc(categoriesDocRef, {
        [categoryId]: {
            name: trimmedNewName
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
              newCategoryName: trimmedNewName, 
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
