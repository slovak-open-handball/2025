// logged-in-add-categories.js
// Tento súbor predpokladá, že Firebase SDK je inicializovaný v authentication.js
// a globálne funkcie ako showGlobalNotification a showGlobalLoader sú dostupné.

// Importy pre potrebné Firebase funkcie (modulárna syntax v9)
// Tieto importy sú potrebné, aby sa zabezpečilo, že funkcie sú dostupné pre volania
// aj keď sú inštancie auth a db globálne.
import { getFirestore, doc, onSnapshot, setDoc, collection, addDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { FieldValue } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"; // Zabezpečenie správneho importu FieldValue


// NotificationModal Component (bol odstránený, pretože sa používa globálny window.showGlobalNotification)
// Ak by bol v budúcnosti potrebný pre špecifické modálne okná, môže byť vrátený.


// AddCategoryModal Component
function AddCategoryModal({ show, onClose, onAddCategory, loading, existingCategories }) {
  const [newCategoryName, setNewCategoryName] = React.useState('');

  // Kontrola, či názov kategórie už existuje (case-insensitive)
  const categoryExists = React.useMemo(() => {
    const trimmedName = newCategoryName.trim().toLowerCase();
    return existingCategories.some(cat => cat.name.toLowerCase() === trimmedName);
  }, [newCategoryName, existingCategories]);

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
        categoryExists && React.createElement( // Zobrazenie chybovej správy
          'p',
          { className: 'text-red-500 text-xs italic mt-2' },
          `Kategória s názvom "${newCategoryName.trim()}" už existuje. Zvoľte iný názov.`
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
            className: `bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg transition-colors duration-200 ${loading || newCategoryName.trim() === '' || categoryExists ? 'opacity-50 cursor-not-allowed' : ''}`,
            disabled: loading || newCategoryName.trim() === '' || categoryExists, // Zablokovanie, ak názov existuje
          },
          loading ? 'Ukladám...' : 'Pridať'
        )
      )
    )
  );
}

// EditCategoryModal Component
function EditCategoryModal({ show, onClose, onSaveCategory, loading, category }) {
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
  const auth = getAuth(); // Používame getAuth() na získanie inštancie
  const db = getFirestore(); // Používame getFirestore() na získanie inštancie

  // Lokálny stav pre aktuálneho používateľa a jeho profilové dáta
  const [user, setUser] = React.useState(null); 
  const [userProfileData, setUserProfileData] = React.useState(null); 
  const [isAuthReady, setIsAuthReady] = React.useState(false); 

  const [loading, setLoading] = React.useState(true); // Loading pre dáta v AddCategoriesApp
  const [error, setError] = React.useState('');
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
    // Zobrazenie globálneho loaderu pri načítavaní
    // Táto časť bola odstránená, pretože sa spoliehame na loader.js pre počiatočné zobrazenie
    // a React komponenty už len riadia svoje vlastné stavy načítavania.

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
        const userDocRef = doc(db, `users/${user.uid}`);
        unsubscribeUserDoc = onSnapshot(userDocRef, docSnapshot => {
          if (docSnapshot.exists()) {
            const userData = docSnapshot.data();
            console.log("AddCategoriesApp: Používateľský dokument existuje, dáta:", userData);

            setUserProfileData(userData);
            setLoading(false);
            setError('');

            // Ak používateľ nie je admin, presmerujeme ho
            if (userData.role !== 'admin') {
                console.log("AddCategoriesApp: Používateľ nie je admin, presmerovávam na logged-in-my-data.html.");
                window.location.href = 'logged-in-my-data.html';
            }

          } else {
            console.warn("AddCategoriesApp: Používateľský dokument sa nenašiel pre UID:", user.uid);
            setError("Chyba: Používateľský profil sa nenašiel. Skúste sa prosím znova prihlásiť.");
            setLoading(false);
            auth.signOut(); // Odhlásiť používateľa
            setUser(null);
            setUserProfileData(null);
          }
        }, error => {
          console.error("AddCategoriesApp: Chyba pri načítaní používateľských dát z Firestore (onSnapshot error):", error);
          setError(`Chyba pri načítaní používateľských dát: ${error.message}`);
          setLoading(false);
          auth.signOut();
          setUser(null);
          setUserProfileData(null);
        });
      } catch (e) {
        console.error("AddCategoriesApp: Chyba pri nastavovaní onSnapshot pre používateľské dáta (try-catch):", e);
        setError(`Chyba pri nastavovaní poslucháča pre používateľské dáta: ${e.message}`);
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
    // Správna cesta: db.collection('settings').doc('categories')
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
        unsubscribeCategories = onSnapshot(categoriesDocRef, docSnapshot => {
          console.log("AddCategoriesApp: onSnapshot pre dokument 'categories' spustený.");
          if (docSnapshot.exists()) {
            const data = docSnapshot.data();
            // Konvertujeme objekt polí na pole objektov { id, name }
            let fetchedCategories = Object.entries(data).map(([id, name]) => ({ id, name }));
            
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
          setError('');
        }, error => {
          console.error("AddCategoriesApp: Chyba pri načítaní dokumentu 'categories' z Firestore (onSnapshot error):", error);
          setError(`Chyba pri načítaní kategórií: ${error.message}`);
          setLoading(false);
        });
      } catch (e) {
        console.error("AddCategoriesApp: Chyba pri nastavovaní onSnapshot pre dokument 'categories' (try-catch):", e);
        setError(`Chyba pri nastavovaní poslucháča pre kategórie: ${e.message}`);
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
  const sendAdminNotification = async (message) => {
    if (!db || !appId) {
      console.error("Chyba: Databáza alebo ID aplikácie nie je k dispozícii pre odoslanie notifikácie.");
      return;
    }
    try {
      // Používame collection() a addDoc() pre pridanie dokumentu
      const notificationsCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'adminNotifications');
      await addDoc(notificationsCollectionRef, {
        message: message,
        timestamp: FieldValue.serverTimestamp(), // OPRAVENÉ: Použitie FieldValue.serverTimestamp()
        recipientId: 'all_admins', // Notifikácia pre všetkých administrátorov
        read: false
      });
      console.log("Notifikácia pre administrátorov úspešne uložená do Firestore.");
    } catch (e) {
      console.error("AddCategoriesApp: Chyba pri ukladaní notifikácie pre administrátorov:", e);
    }
  };


  // Funkcia na pridanie novej kategórie
  const handleAddCategorySubmit = async (categoryName) => {
    if (!db || !user || !userProfileData || userProfileData.role !== 'admin') {
      if (typeof window.showGlobalNotification === 'function') {
        window.showGlobalNotification("Nemáte oprávnenie na pridanie kategórie.", 'error');
      }
      return;
    }
    const trimmedCategoryName = categoryName.trim();
    if (trimmedCategoryName === '') {
      if (typeof window.showGlobalNotification === 'function') {
        window.showGlobalNotification("Názov kategórie nemôže byť prázdny.", 'error');
      }
      return;
    }

    setLoading(true);
    setError('');

    try {
      const categoriesDocRef = getCategoriesDocRef();
      if (!categoriesDocRef) { throw new Error("Referencia na dokument kategórií nie je k dispozícii."); }

      // Načítanie aktuálneho stavu dokumentu
      const docSnapshot = await getDoc(categoriesDocRef); // OPRAVENÉ: Použitie getDoc()
      const currentCategoriesData = docSnapshot.exists() ? docSnapshot.data() : {};

      // Kontrola duplicity názvu kategórie (case-insensitive)
      if (Object.values(currentCategoriesData).some(name => name.toLowerCase() === trimmedCategoryName.toLowerCase())) {
        if (typeof window.showGlobalNotification === 'function') {
          window.showGlobalNotification(`Kategória s názvom "${trimmedCategoryName}" už existuje. Zvoľte iný názov.`, 'error');
        }
        setLoading(false);
        return;
      }

      // Generujeme náhodné ID pre názov poľa
      const newFieldId = doc(collection(db, 'settings')).id; 

      // Používame set s merge: true, aby sa dokument vytvoril, ak neexistuje, alebo aktualizoval
      // a pridalo sa nové pole s náhodným ID ako názvom a názvom kategórie ako hodnotou
      await setDoc(categoriesDocRef, {
        [newFieldId]: trimmedCategoryName
      }, { merge: true });

      if (typeof window.showGlobalNotification === 'function') {
        window.showGlobalNotification("Kategória úspešne pridaná!", 'success');
      }
      setShowAddCategoryModal(false); // Zatvorí modálne okno po úspešnom pridaní

      // Odoslanie notifikácie administrátorom s e-mailovou adresou používateľa
      const userEmail = user.email;
      await sendAdminNotification(`Používateľ ${userEmail} vytvoril kategóriu "${trimmedCategoryName}".`);

    } catch (e) {
      console.error("AddCategoriesApp: Chyba pri pridávaní kategórie:", e);
      if (typeof window.showGlobalNotification === 'function') {
        window.showGlobalNotification(`Chyba pri pridávaní kategórie: ${e.message}`, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  // Funkcia na úpravu kategórie
  const handleEditCategorySubmit = async (categoryId, newName) => {
    if (!db || !user || !userProfileData || userProfileData.role !== 'admin') {
      if (typeof window.showGlobalNotification === 'function') {
        window.showGlobalNotification("Nemáte oprávnenie na úpravu kategórie.", 'error');
      }
      return;
    }
    const trimmedNewName = newName.trim();
    if (trimmedNewName === '') {
      if (typeof window.showGlobalNotification === 'function') {
        window.showGlobalNotification("Názov kategórie nemôže byť prázdny.", 'error');
      }
      return;
    }

    setLoading(true);
    setError('');

    try {
      const categoriesDocRef = getCategoriesDocRef();
      if (!categoriesDocRef) { throw new Error("Referencia na dokument kategórií nie je k dispozícii."); }

      // Načítanie aktuálneho stavu dokumentu
      const docSnapshot = await getDoc(categoriesDocRef); // OPRAVENÉ: Použitie getDoc()
      const currentCategoriesData = docSnapshot.exists() ? docSnapshot.data() : {};

      // Kontrola duplicity názvu kategórie pri úprave (okrem samotnej upravovanej kategórie)
      if (Object.entries(currentCategoriesData).some(([id, name]) => name.toLowerCase() === trimmedNewName.toLowerCase() && id !== categoryId)) {
        if (typeof window.showGlobalNotification === 'function') {
          window.showGlobalNotification(`Kategória s názvom "${trimmedNewName}" už existuje. Zvoľte iný názov.`, 'error');
        }
        setLoading(false);
        return;
      }

      // Získame pôvodný názov kategórie pre notifikáciu
      const originalCategoryName = currentCategoriesData[categoryId];

      // Aktualizujeme konkrétne pole v dokumente
      await setDoc(categoriesDocRef, {
        [categoryId]: trimmedNewName
      }, { merge: true });

      if (typeof window.showGlobalNotification === 'function') {
        window.showGlobalNotification("Kategória úspešne aktualizovaná!", 'success');
      }
      setShowEditCategoryModal(false); // Zatvorí modálne okno po úspešnej úprave
      setCategoryToEdit(null);

      // Odoslanie notifikácie administrátorom s e-mailovou adresou používateľa
      const userEmail = user.email;
      await sendAdminNotification(`Používateľ ${userEmail} upravil názov kategórie "${originalCategoryName}" na nový názov kategórie "${trimmedNewName}".`);

    } catch (e) {
      console.error("AddCategoriesApp: Chyba pri aktualizácii kategórie:", e);
      if (typeof window.showGlobalNotification === 'function') {
        window.showGlobalNotification(`Chyba pri aktualizácii kategórie: ${e.message}`, 'error');
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
      if (typeof window.showGlobalNotification === 'function') {
        window.showGlobalNotification("Nemáte oprávnenie na zmazanie kategórie alebo kategória nie je vybraná.", 'error');
      }
      return;
    }

    setLoading(true);
    setError('');
    setShowConfirmDeleteModal(false); // Zatvorí potvrdzovací modál

    try {
      const categoriesDocRef = getCategoriesDocRef();
      if (!categoriesDocRef) { throw new Error("Referencia na dokument kategórií nie je k dispozícii."); }

      // Odstránime konkrétne pole z dokumentu
      await setDoc(categoriesDocRef, {
        [categoryToDelete.id]: FieldValue.delete() // Používame FieldValue.delete()
      }, { merge: true }); // Používame merge: true pre bezpečné odstránenie poľa

      if (typeof window.showGlobalNotification === 'function') {
        window.showGlobalNotification(`Kategória "${categoryToDelete.name}" bola úspešne zmazaná!`, 'success');
      }
      setCategoryToDelete(null); // Vyčistí kategóriu na zmazanie

      // Odoslanie notifikácie administrátorom s e-mailovou adresou používateľa
      const userEmail = user.email;
      await sendAdminNotification(`Kategória "${categoryToDelete.name}" bola zmazaná používateľom ${userEmail}.`);

    } catch (e) {
      console.error("AddCategoriesApp: Chyba pri mazaní kategórie:", e);
      if (typeof window.showGlobalNotification === 'function') {
        window.showGlobalNotification(`Chyba pri mazaní kategórie: ${e.message}`, 'error');
      }
    } finally {
      setLoading(false);
    }
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
    }),
    React.createElement(ConfirmationModal, { 
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
