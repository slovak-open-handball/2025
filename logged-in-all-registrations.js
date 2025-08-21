// logged-in-all-registrations.js
// Tento súbor predpokladá, že Firebase SDK je inicializovaný v <head> logged-in-all-registrations.html
// a GlobalNotificationHandler v header.js spravuje globálnu autentifikáciu a stav používateľa.

// NotificationModal Component for displaying temporary messages (converted to React.createElement)
// Ponechané pre zobrazovanie správ o spätnej väzbe pre používateľa v tomto module.
function NotificationModal({ message, onClose, displayNotificationsEnabled }) {
  const [show, setShow] = React.useState(false);
  const timerRef = React.useRef(null);

  React.useEffect(() => {
    // Zobrazí notifikáciu len ak je správa A notifikácie sú povolené
    if (message && displayNotificationsEnabled) {
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
  }, [message, onClose, displayNotificationsEnabled]); // Závisí aj od displayNotificationsEnabled

  // Nezobrazovať notifikáciu, ak nie je správa ALEBO ak sú notifikácie zakázané
  if ((!show && !message) || !displayNotificationsEnabled) return null;

  return React.createElement(
    'div',
    {
      className: `fixed top-0 left-0 right-0 z-50 flex justify-center p-4 transition-transform duration-500 ease-out ${
        show ? 'translate-y-0' : '-translate-y-full'
      }`,
      style: { pointerEvents: 'none', zIndex: 1000 } // ZMENA: zIndex nastavený na 1000
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

// FilterModal Component - Modálne okno pre filtrovanie s viacnásobným výberom
function FilterModal({ isOpen, onClose, columnName, onApplyFilter, initialFilterValues, onClearFilter, uniqueColumnValues }) {
    // selectedValues je teraz pole pre viacnásobný výber
    // initialFilterValues už obsahujú hodnoty v malých písmenách, takže ich len použijeme
    const [selectedValues, setSelectedValues] = React.useState(initialFilterValues || []);

    React.useEffect(() => {
        // Inicializovať selectedValues pri otvorení modalu alebo zmene initialFilterValues
        // Zabezpečí, že pri opätovnom otvorení modalu sa nastavia správne začiarknuté polia
        setSelectedValues(initialFilterValues || []);
    }, [initialFilterValues, isOpen]);

    if (!isOpen) return null;

    const handleCheckboxChange = (value) => {
        // KĽÚČOVÁ ZMENA: Prevod hodnoty na malé písmená pre konzistentné porovnávanie
        const lowerCaseValue = String(value).toLowerCase();
        setSelectedValues(prev => {
            if (prev.includes(lowerCaseValue)) {
                return prev.filter(item => item !== lowerCaseValue); // Odstrániť, ak už je vybrané
            } else {
                return [...prev, lowerCaseValue]; // Pridať, ak nie je vybrané
            }
        });
    };

    const handleApply = () => {
        onApplyFilter(columnName, selectedValues);
        onClose();
    };

    const handleClear = () => {
        setSelectedValues([]);
        onClearFilter(columnName);
        onClose();
    };

    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50' },
        React.createElement(
            'div',
            { className: 'bg-white p-6 rounded-lg shadow-xl w-full max-w-sm' },
            React.createElement('h3', { className: 'text-lg font-semibold mb-4' }, `Filter pre ${columnName}`),
            React.createElement(
                'div',
                { className: 'max-h-60 overflow-y-auto mb-4 border border-gray-200 rounded-md p-2' },
                uniqueColumnValues.map((value, index) =>
                    React.createElement(
                        'div',
                        { key: index, className: 'flex items-center mb-2' },
                        React.createElement('input', {
                            type: 'checkbox',
                            id: `filter-${columnName}-${index}`,
                            value: value,
                            checked: selectedValues.includes(String(value).toLowerCase()), // Kontrola na malé písmená
                            onChange: () => handleCheckboxChange(value),
                            className: 'mr-2'
                        }),
                        React.createElement('label', { htmlFor: `filter-${columnName}-${index}` }, value || '(Prázdne)')
                    )
                )
            ),
            React.createElement(
                'div',
                { className: 'flex justify-end space-x-2' },
                React.createElement('button', {
                    className: 'px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300',
                    onClick: onClose
                }, 'Zrušiť'),
                React.createElement('button', {
                    className: 'px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600',
                    onClick: handleClear
                }, 'Vymazať filter'),
                React.createElement('button', {
                    className: 'px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600',
                    onClick: handleApply
                }, 'Použiť filter')
            )
        )
    );
}

// ColumnVisibilityModal Component
function ColumnVisibilityModal({ isOpen, onClose, columns, onSaveColumnVisibility }) {
    const [tempColumns, setTempColumns] = React.useState(columns);

    React.useEffect(() => {
        setTempColumns(columns);
    }, [columns, isOpen]);

    if (!isOpen) return null;

    const handleToggleVisibility = (columnId) => {
        setTempColumns(prev =>
            prev.map(col =>
                col.id === columnId ? { ...col, visible: !col.visible } : col
            )
        );
    };

    const handleSave = () => {
        onSaveColumnVisibility(tempColumns);
        onClose();
    };

    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50' },
        React.createElement(
            'div',
            { className: 'bg-white p-6 rounded-lg shadow-xl w-full max-w-md' },
            React.createElement('h3', { className: 'text-lg font-semibold mb-4' }, 'Viditeľnosť stĺpcov'),
            React.createElement(
                'div',
                { className: 'max-h-80 overflow-y-auto mb-4 border border-gray-200 rounded-md p-2' },
                tempColumns.map((col) =>
                    React.createElement(
                        'div',
                        { key: col.id, className: 'flex items-center justify-between py-2 border-b last:border-b-0' },
                        React.createElement('label', { className: 'flex items-center cursor-pointer' },
                            React.createElement('input', {
                                type: 'checkbox',
                                className: 'form-checkbox h-5 w-5 text-blue-600 mr-2',
                                checked: col.visible,
                                onChange: () => handleToggleVisibility(col.id),
                            }),
                            React.createElement('span', { className: 'text-gray-700' }, col.label)
                        )
                        // ODSTRÁNENÉ: React.createElement('span', { className: 'text-gray-500 text-sm' }, col.id)
                    )
                )
            ),
            React.createElement(
                'div',
                { className: 'flex justify-end space-x-2' },
                React.createElement('button', {
                    className: 'px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300',
                    onClick: onClose
                }, 'Zrušiť'),
                React.createElement('button', {
                    className: 'px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600',
                    onClick: handleSave
                }, 'Uložiť zmeny')
            )
        )
    );
}


// Main React component for the logged-in-all-registrations.html page
function AllRegistrationsApp({ userProfileData: initialUserProfileData }) { // Zmena: Prijímame initialUserProfileData
  // NOVÉ: Získame referencie na Firebase služby z globálnych premenných
  const auth = window.auth;
  const db = window.db;

  // NOVÉ: Lokálny stav pre aktuálneho používateľa a jeho profilové dáta
  // Tieto stavy budú aktualizované cez 'globalDataUpdated' event.
  const [user, setUser] = React.useState(auth ? auth.currentUser : null); 
  const [userProfileData, setUserProfileData] = React.useState(initialUserProfileData); 
  const [isAuthReady, setIsAuthReady] = React.useState(window.isGlobalAuthReady); // Získame globálny stav pripravenosti

  const [loadingUsers, setLoadingUsers] = React.useState(true); // NOVINKA: Oddelený stav pre načítanie používateľov
  const [loadingColumnOrder, setLoadingColumnOrder] = React.useState(true); // NOVINKA: Oddelený stav pre načítanie poradia stĺpcov
  const [error, setError] = React.useState('');
  const [userNotificationMessage, setUserNotificationMessage] = React.useState('');

  // Deklarácia stavov pre používateľov a filtrovanie
  const [allUsers, setAllUsers] = React.useState([]); 
  const [filteredUsers, setFilteredUsers] = React.useState([]);
  const [currentSort, setCurrentSort] = React.useState({ column: 'registrationDate', direction: 'desc' });
  const [filterModalOpen, setFilterModalOpen] = React.useState(false);
  const [filterColumn, setFilterColumn] = React.useState('');
  const [activeFilters, setActiveFilters] = React.useState({});
  const [uniqueColumnValues, setUniqueColumnValues] = React.useState([]);

  // NOVINKA: Stav pre poradie stĺpcov
  const defaultColumnOrder = [
    { id: 'role', label: 'Rola', type: 'string', visible: true },
    { id: 'approved', label: 'Schválený', type: 'boolean', visible: true },
    { id: 'registrationDate', label: 'Dátum registrácie', type: 'date', visible: true },
    { id: 'firstName', label: 'Meno', type: 'string', visible: true },
    { id: 'lastName', label: 'Priezvisko', type: 'string', visible: true },
    { id: 'email', label: 'Email', type: 'string', visible: true },
    { id: 'contactPhoneNumber', label: 'Tel. číslo', type: 'string', visible: true },
    { id: 'billing.clubName', label: 'Názov klubu', type: 'string', visible: true },
    { id: 'billing.ico', label: 'IČO', type: 'string', visible: true },
    { id: 'billing.dic', label: 'DIČ', type: 'string', visible: true },
    { id: 'billing.icDph', label: 'IČ DPH', type: 'string', visible: true },
    { id: 'street', label: 'Ulica', type: 'string', visible: true },
    { id: 'houseNumber', label: 'Číslo domu', type: 'string', visible: true },
    { id: 'city', label: 'Mesto', type: 'string', visible: true },
    { id: 'postalCode', label: 'PSČ', type: 'string', visible: true },
    { id: 'country', label: 'Krajina', type: 'string', visible: true },
  ];
  const [columnOrder, setColumnOrder] = React.useState(defaultColumnOrder);
  const [hoveredColumn, setHoveredColumn] = React.useState(null);
  const [showColumnVisibilityModal, setShowColumnVisibilityModal] = React.useState(false);


  // NOVÉ: Reakcia na globálne zmeny stavu autentifikácie a profilu
  React.useEffect(() => {
    const handleGlobalDataUpdate = (event) => {
      console.log("AllRegistrationsApp: Prijatá udalosť 'globalDataUpdated' v komponente.");
      setUserProfileData(event.detail);
      setUser(auth ? auth.currentUser : null); // Aktualizujeme aj objekt užívateľa
      setIsAuthReady(true); // Teraz sú dáta pripravené
    };

    window.addEventListener('globalDataUpdated', handleGlobalDataUpdate);

    // Počiatočná kontrola, ak už sú dáta dostupné pri načítaní komponentu
    if (window.isGlobalAuthReady && window.globalUserProfileData) {
        setIsAuthReady(true);
        setUser(auth ? auth.currentUser : null);
        setUserProfileData(window.globalUserProfileData);
    }
    
    // Čistenie pri odpojení komponentu
    return () => {
      window.removeEventListener('globalDataUpdated', handleGlobalDataUpdate);
    };
  }, [auth]); // Závislosť na auth inštancii

  // Effect for fetching all users from Firestore and column order
  // Spustí sa len ak je Auth pripravené, DB je k dispozícii a user je definovaný (nie undefined)
  React.useEffect(() => {
    let unsubscribeAllUsers;
    let unsubscribeColumnOrder;
    // appId by mal byť globálne dostupný z HTML
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'; 

    console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Triggered.");
    console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] State Snapshot - db:", !!db, "user:", !!user, "user.uid:", user ? user.uid : "N/A", "userProfileData:", !!userProfileData, "role:", userProfileData ? userProfileData.role : "N/A", "approved:", userProfileData ? userProfileData.approved : "N/A", "isAuthReady:", isAuthReady);

    // Kľúčová podmienka pre načítanie dát
    if (isAuthReady && db && user && user.uid && userProfileData && userProfileData.role === 'admin' && userProfileData.approved === true) {
        console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Conditions met: Approved Admin. Proceeding to fetch data.");
        setLoadingUsers(true); // Indicate loading for users
        setLoadingColumnOrder(true); // Indicate loading for column order

        // --- Načítanie poradia stĺpcov pre aktuálneho admina ---
        try {
            // Cesta pre columnOrder je teraz users/{userId}/columnOrder/columnOrder
            const columnOrderDocRef = db.collection('users').doc(user.uid).collection('columnOrder').doc('columnOrder');
            console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Attempting to set up onSnapshot for columnOrder at path:", columnOrderDocRef.path);
            unsubscribeColumnOrder = columnOrderDocRef.onSnapshot(docSnapshot => {
                console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] columnOrder onSnapshot received data. Exists:", docSnapshot.exists);
                let newOrderToSet = defaultColumnOrder; // Predvolené poradie

                if (docSnapshot.exists) {
                    const savedOrder = docSnapshot.data().order;
                    console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Raw savedOrder from Firestore:", savedOrder);

                    if (savedOrder && Array.isArray(savedOrder) && savedOrder.length > 0) {
                        let mergedOrder = [];
                        // 1. Pridajte stĺpce z savedOrder, zachovajte ich poradie a viditeľnosť
                        savedOrder.forEach(savedCol => {
                            const defaultColDef = defaultColumnOrder.find(dCol => dCol.id === savedCol.id);
                            if (defaultColDef) {
                                // Zlúčte uložené vlastnosti s predvolenými, prioritizujte uloženú viditeľnosť
                                mergedOrder.push({
                                    ...defaultColDef, // Získajte predvolený label, type atď.
                                    ...savedCol,      // Prepíšte uloženým ID, visible
                                    visible: savedCol.visible !== undefined ? savedCol.visible : true // Zabezpečte, že visible je boolean
                                });
                            } else {
                                // Ak ID uloženého stĺpca nie je v defaultColumnOrder, stále ho zahrňte
                                mergedOrder.push({ ...savedCol, visible: savedCol.visible !== undefined ? savedCol.visible : true });
                            }
                        });

                        // 2. Pridajte všetky predvolené stĺpce, ktoré NEBOLI v savedOrder
                        defaultColumnOrder.forEach(defaultCol => {
                            if (!mergedOrder.some(mCol => mCol.id === defaultCol.id)) {
                                mergedOrder.push(defaultCol); // Pridajte s jeho predvolenými vlastnosťami (vrátane visible: true)
                            }
                        });

                        newOrderToSet = mergedOrder;
                        console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Zlúčené a preusporiadané uložené poradie:", newOrderToSet);
                    } else {
                        // Dokument existuje, ale savedOrder je prázdny alebo poškodený.
                        // To znamená, že by sa mal resetovať na predvolené a uložiť.
                        console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Uložené poradie je prázdne alebo poškodené. Používam predvolené a ukladám ho.");
                        columnOrderDocRef.set({ order: defaultColumnOrder }, { merge: true })
                            .then(() => console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Uložené predvolené poradie do Firestore (prázdne/poškodené)."))
                            .catch(e => console.error("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Chyba pri ukladaní predvoleného poradia (prázdne/poškodené):", e));
                    }
                } else {
                    // Dokument neexistuje. Nastavte predvolené a uložte ho.
                    console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Dokument poradia stĺpcov neexistuje. Používam predvolené a ukladám ho.");
                    columnOrderDocRef.set({ order: defaultColumnOrder }, { merge: true })
                        .then(() => console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Uložené predvolené poradie do Firestore (dokument neexistoval)."))
                        .catch(e => console.error("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Chyba pri ukladaní predvoleného poradia (dokument neexistoval):", e));
                }
                
                setColumnOrder(newOrderToSet); // Vždy nastavte stav na základe určeného poradia
                setLoadingColumnOrder(false); // Poradie stĺpcov je načítané
            }, error => {
                console.error("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Chyba pri načítaní poradia stĺpcov z Firestore (onSnapshot error):", error);
                setError(`Chyba pri načítaní poradia stĺpcov: ${error.message}`);
                setColumnOrder(defaultColumnOrder); // Návrat na predvolené pri chybe
                setLoadingColumnOrder(false); // Načítanie poradia stĺpcov zlyhalo
            });
        } catch (e) {
            console.error("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Chyba pri nastavovaní onSnapshot pre poradie stĺpcov (try-catch):", e);
            setError(`Chyba pri inicializácii poradia stĺpcov: ${e.message}`);
            setColumnOrder(defaultColumnOrder);
            setLoadingColumnOrder(false); // Načítanie poradia stĺpcov zlyhalo
        }

        // --- Získanie všetkých používateľov z kolekcie 'users' ---
        try {
            unsubscribeAllUsers = db.collection('users').onSnapshot(snapshot => {
                const usersData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Všetci používatelia načítaní:", usersData.length, "používateľov.");
                setAllUsers(usersData);
                setFilteredUsers(usersData);
                setLoadingUsers(false); // Users are loaded
            }, error => {
                console.error("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Chyba pri načítaní všetkých používateľov z Firestore:", error);
                setError(`Chyba pri načítaní používateľov: ${error.message}`);
                setLoadingUsers(false); // Users loading failed
                setUserNotificationMessage(`Chyba pri načítaní dát: ${error.message}`);
            });
        } catch (e) {
            console.error("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Chyba pri nastavovaní onSnapshot pre všetkých používateľov (try-catch):", e);
            setError(`Chyba pri načítaní používateľov: ${e.message}`);
            setLoadingUsers(false); // Users loading failed
            setUserNotificationMessage(`Chyba pri načítaní dát: ${e.message}`);
        }
    } else if (isAuthReady && user === null) {
        console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] User is null, not fetching data. Redirecting to login.html.");
        window.location.href = 'login.html';
    } else if (isAuthReady && userProfileData && (userProfileData.role !== 'admin' || userProfileData.approved === false)) {
        console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] User is not an approved admin, not fetching data. Redirecting to my-data.html.");
        setError("Nemáte oprávnenie na zobrazenie tejto stránky. Iba schválení administrátori majú prístup.");
        setLoadingUsers(false); // Ensure loading is false if not authorized
        setLoadingColumnOrder(false); // Ensure loading is false if not authorized
        setUserNotificationMessage("Nemáte oprávnenie na zobrazenie tejto stránky.");
        window.location.href = 'logged-in-my-data.html';
    } else {
        console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Conditions not met for fetching data. Waiting for state updates.");
        // If conditions are not met, ensure loading is false if it's stuck
        if (loadingUsers) setLoadingUsers(false);
        if (loadingColumnOrder) setLoadingColumnOrder(false);
    }

    return () => {
        if (unsubscribeAllUsers) {
            console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Ruším odber onSnapshot pre všetkých používateľov.");
            unsubscribeAllUsers();
        }
        if (unsubscribeColumnOrder) {
            console.log("AllRegistrationsApp: [Effect: ColumnOrder/AllUsers] Ruším odber onSnapshot pre poradie stĺpcov.");
            unsubscribeColumnOrder();
        }
    };
  }, [db, userProfileData, isAuthReady, user]); // Dependencies: db, userProfileData, isAuthReady, user


  // Sorting logic
  const handleSort = (columnId) => {
      let direction = 'asc';
      if (currentSort.column === columnId && currentSort.direction === 'asc') {
          direction = 'desc';
      }
      setCurrentSort({ column: columnId, direction });

      const sorted = [...filteredUsers].sort((a, b) => {
          // Find the column definition to get its type
          const columnDef = columnOrder.find(col => col.id === columnId);
          // Log pre diagnostiku:
          console.log(`handleSort: Sorting by columnId: ${columnId}, Direction: ${direction}`);
          console.log(`handleSort: Found columnDef for ${columnId}:`, columnDef);

          const type = columnDef ? columnDef.type : 'string'; // Default to string if type not found

          let valA, valB;

          // Helper to get nested value
          const getNestedValue = (obj, path) => {
              return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined) ? acc[part] : undefined, obj);
          };

          if (columnId.includes('.')) {
              valA = getNestedValue(a, columnId);
              valB = getNestedValue(b, columnId);
          } else {
              valA = a[columnId];
              valB = b[columnId];
          }

          // Log hodnoty pred porovnaním
          console.log(`handleSort: Comparing values for ${columnId} (type: ${type}): A=${valA}, B=${valB}`);


          // Convert to comparable types based on column type
          if (type === 'date') {
              const dateA = valA && typeof valA.toDate === 'function' ? valA.toDate() : new Date(0);
              const dateB = valB && typeof valB.toDate === 'function' ? valB.toDate() : new Date(0);
              return direction === 'asc' ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
          } else if (type === 'boolean') {
              const boolA = Boolean(valA);
              const boolB = Boolean(valB);
              return direction === 'asc' ? (boolA === boolB ? 0 : (boolA ? 1 : -1)) : (boolA === boolB ? 0 : (boolA ? -1 : 1));
          } else if (type === 'number') {
              const numA = parseFloat(valA) || 0;
              const numB = parseFloat(valB) || 0;
              return direction === 'asc' ? numA - numB : numB - numA;
          } else { // Default to string comparison
              return direction === 'asc' ? String(valA || '').localeCompare(String(valB || '')) : String(valB || '').localeCompare(String(valA || ''));
          }
      });
      setFilteredUsers(sorted);
      // Log prvých pár zoradených používateľov
      console.log("handleSort: First 5 sorted users:", sorted.slice(0, 5).map(u => ({ id: u.id, [columnId]: getNestedValue(u, columnId) })));
  };

  // Filtering logic
  const openFilterModal = (column) => {
      console.log("AllRegistrationsApp: openFilterModal volaná pre stĺpec:", column); // NOVÝ LOG
      console.log("AllRegistrationsApp: Aktuálny stav allUsers:", allUsers); // NOVÝ DIAGNOSTICKÝ LOG

      setFilterColumn(column);
      // Získanie unikátnych hodnôt pre daný stĺpec, prevedené na string a malé písmená pre konzistentnosť
      const values = [...new Set(allUsers.map(u => {
          let val;
          if (column === 'registrationDate' && u.registrationDate && typeof u.registrationDate.toDate === 'function') {
              // Používame toLocaleString pre zobrazenie dátumu a času vo filtri
              val = u.registrationDate.toDate().toLocaleString('sk-SK');
          } else if (column.includes('.')) { // Pre vnorené polia ako billing.clubName
              const parts = column.split('.');
              let nestedVal = u;
              for (const part of parts) {
                  nestedVal = nestedVal ? nestedVal[part] : undefined;
              }
              val = nestedVal;
          } else {
              val = u[column];
          }
          // Špecifické pre boolean stĺpce (napr. 'approved')
          if (typeof val === 'boolean') {
              return val ? 'áno' : 'nie';
          }
          return String(val || '').toLowerCase(); // Všetko na malé písmená
      }))].filter(v => v !== '').sort(); // Odstrániť prázdne a zoradiť
      setUniqueColumnValues(values);
      setFilterModalOpen(true);
  };

  const closeFilterModal = () => {
      setFilterModalOpen(false);
      setFilterColumn('');
      setUniqueColumnValues([]);
  };

  const applyFilter = (column, values) => {
      // Uloženie vybraných hodnôt filtra (už sú v malých písmenách)
      setActiveFilters(prev => ({ ...prev, [column]: values }));
  };

  const clearFilter = (column) => {
      setActiveFilters(prev => {
          const newFilters = { ...prev };
          delete newFilters[column];
          return newFilters;
      });
  };

  // Effect to re-apply filters when activeFilters or allUsers change
  React.useEffect(() => {
      let currentFiltered = [...allUsers];

      Object.keys(activeFilters).forEach(column => {
          const filterValues = activeFilters[column];
          if (filterValues.length > 0) {
              currentFiltered = currentFiltered.filter(user => {
                  let userValue;
                  if (column === 'registrationDate' && user.registrationDate && typeof user.registrationDate.toDate === 'function') {
                      // Používame toLocaleString aj pre porovnanie vo filtri
                      userValue = user.registrationDate.toDate().toLocaleString('sk-SK').toLowerCase();
                  } else if (column.includes('.')) {
                      const parts = column.split('.');
                      let nestedVal = user;
                      for (const part of parts) {
                          nestedVal = nestedVal ? nestedVal[part] : undefined;
                      }
                      userValue = String(nestedVal || '').toLowerCase();
                  } else {
                      userValue = String(user[column] || '').toLowerCase();
                  }
                  // Špecifické pre boolean stĺpce (napr. 'approved')
                  if (typeof user[column] === 'boolean') {
                      userValue = user[column] ? 'áno' : 'nie';
                  }
                  return filterValues.includes(userValue);
              });
          }
      });
      setFilteredUsers(currentFiltered);
  }, [allUsers, activeFilters]);


  // Handle logout (needed for the header logout button)
  const handleLogout = React.useCallback(async () => {
    if (!auth) return;
    try {
      setLoadingUsers(true); 
      setLoadingColumnOrder(true); 
      await auth.signOut();
      setUserNotificationMessage("Úspešne odhlásený.");
      // Použijeme globálne definovanú base path
      const appBasePath = typeof window.getAppBasePath === 'function' ? window.getAppBasePath() : '';
      window.location.href = `${appBasePath}/login.html`;
      setUser(null); 
      setUserProfileData(null); 
    } catch (e) {
      console.error("AllRegistrationsApp: Chyba pri odhlásení:", e); 
      setError(`Chyba pri odhlásení: ${e.message}`);
    } finally {
      setLoadingUsers(false); 
      setLoadingColumnOrder(false); 
    }
  }, [auth]);

  // Attach logout handler to the button in the header
  React.useEffect(() => {
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
      // Odstránime starý listener, ak existuje, pre opätovné pripojenie
      // Predpokladáme, že header.js už nepripojuje listener priamo, ale len definuje funkciu.
      // Ak by aj pripojoval, tento removeEventListener je na mieste.
      logoutButton.removeEventListener('click', window.handleLogout); // Odstránime pôvodný z header.js (ak existuje)
      logoutButton.addEventListener('click', handleLogout); // Pripojíme lokálny
    }
    return () => {
      if (logoutButton) {
        logoutButton.removeEventListener('click', handleLogout);
      }
    };
  }, [handleLogout]);


  // Funkcia na presun stĺpca
  const moveColumn = async (columnId, direction) => {
    const currentIndex = columnOrder.findIndex(col => col.id === columnId);
    if (currentIndex === -1) return;

    const newColumnOrder = [...columnOrder];
    const columnToMove = newColumnOrder.splice(currentIndex, 1)[0];

    let newIndex;
    if (direction === 'left') {
      newIndex = Math.max(0, currentIndex - 1);
    } else { // 'right'
      newIndex = Math.min(newColumnOrder.length, currentIndex + 1);
    }

    newColumnOrder.splice(newIndex, 0, columnToMove);
    setColumnOrder(newColumnOrder); // Okamžitá aktualizácia lokálneho stavu

    // Uloženie nového poradia do Firestore
    if (db && user && user.uid) {
        const columnOrderDocRef = db.collection('users').doc(user.uid).collection('columnOrder').doc('columnOrder');
        try {
            await columnOrderDocRef.set({ order: newColumnOrder }, { merge: true });
            console.log("AllRegistrationsApp: Poradie stĺpcov uložené do Firestore.");
        } catch (e) {
            console.error("AllRegistrationsApp: Chyba pri ukladaní poradia stĺpcov do Firestore:", e);
            setUserNotificationMessage(`Chyba pri ukladaní poradia stĺpcov: ${e.message}`);
        }
    }
  };

  // Funkcia na uloženie viditeľnosti stĺpcov do Firestore
  const handleSaveColumnVisibility = async (updatedColumns) => {
    setColumnOrder(updatedColumns); // Okamžitá aktualizácia lokálneho stavu
    if (db && user && user.uid) {
        const columnOrderDocRef = db.collection('users').doc(user.uid).collection('columnOrder').doc('columnOrder');
        try {
            await columnOrderDocRef.set({ order: updatedColumns }, { merge: true });
            setUserNotificationMessage("Viditeľnosť stĺpcov bola úspešne uložená.", 'success');
        } catch (e) {
            console.error("AllRegistrationsApp: Chyba pri ukladaní viditeľnosti stĺpcov do Firestore:", e);
            setUserNotificationMessage(`Chyba pri ukladaní viditeľnosti stĺpcov: ${e.message}`, 'error');
        }
    }
  };

  // Display loading state
  if (!isAuthReady || user === undefined || (user && !userProfileData) || loadingUsers || loadingColumnOrder) { 
    if (isAuthReady && user === null) {
        console.log("AllRegistrationsApp: Auth je ready a používateľ je null, presmerovávam na login.html"); 
        // Použijeme globálne definovanú base path
        const appBasePath = typeof window.getAppBasePath === 'function' ? window.getAppBasePath() : '';
        window.location.href = `${appBasePath}/login.html`;
        return null; 
    }
    let loadingMessage = 'Načítavam...';
    // Simplified loading message as it's now derived from two states
    return React.createElement(
      'div',
      { className: 'flex items-center justify-center min-h-screen bg-gray-100' },
      React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' }),
      React.createElement('div', { className: 'text-xl font-semibold text-gray-700 ml-4' }, loadingMessage)
    );
  }

  // Ak používateľ nie je admin alebo nie je schválený, presmerujeme ho
  if (userProfileData.role !== 'admin' || userProfileData.approved === false) {
      console.log("AllRegistrationsApp: Používateľ nie je schválený administrátor. Presmerovávam na logged-in-my-data.html.");
      const appBasePath = typeof window.getAppBasePath === 'function' ? window.getAppBasePath() : '';
      window.location.href = `${appBasePath}/logged-in-my-data.html`;
      return null; // Zastaviť vykresľovanie
  }

  // Funkcia na formátovanie PSČ
  const formatPostalCode = (postalCode) => {
    if (!postalCode) return '-';
    const cleaned = String(postalCode).replace(/\s/g, ''); // Odstráni existujúce medzery
    if (cleaned.length === 5) {
      return `${cleaned.substring(0, 3)} ${cleaned.substring(3, 5)}`;
    }
    return postalCode; // Vráti pôvodné, ak nemá 5 číslic
  };

  // Funkcia na získanie vnorenej hodnoty
  const getNestedValue = (obj, path) => {
    return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined) ? acc[part] : undefined, obj);
  };

  // Ak je používateľ admin a schválený, zobrazíme mu tabuľku registrácií
  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
    React.createElement(NotificationModal, {
        message: userNotificationMessage,
        onClose: () => setUserNotificationMessage(''),
        displayNotificationsEnabled: userProfileData?.displayNotifications
    }),
    React.createElement(FilterModal, {
        isOpen: filterModalOpen,
        onClose: closeFilterModal,
        columnName: filterColumn,
        onApplyFilter: applyFilter,
        initialFilterValues: activeFilters[filterColumn] || [],
        onClearFilter: clearFilter,
        uniqueColumnValues: uniqueColumnValues
    }),
    React.createElement(ColumnVisibilityModal, {
        isOpen: showColumnVisibilityModal,
        onClose: () => setShowColumnVisibilityModal(false),
        columns: columnOrder,
        onSaveColumnVisibility: handleSaveColumnVisibility,
    }),
    React.createElement(
      'div',
      { className: 'w-full px-4 mt-20 mb-10' }, // Zmenené triedy pre konzistentný okraj
      error && React.createElement(
        'div',
        { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap', role: 'alert' },
        error
      ),
      React.createElement(
        'div',
        { className: 'bg-white p-8 rounded-lg shadow-xl w-full' },
        React.createElement('h1', { className: 'text-3xl font-bold text-center text-gray-800 mb-6' },
          'Všetky registrácie'
        ),
        React.createElement(
            'div',
            { className: 'flex justify-end mb-4' },
            React.createElement('button', {
                onClick: () => setShowColumnVisibilityModal(true),
                className: 'bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200'
            }, 'Upraviť stĺpce')
        ),
        // Tabuľka všetkých registrácií
        React.createElement(
            'div',
            { className: 'overflow-x-auto relative shadow-md sm:rounded-lg' },
            React.createElement(
                'table',
                { className: 'w-full text-sm text-left text-gray-500' },
                React.createElement(
                    'thead',
                    { className: 'text-xs text-gray-700 uppercase bg-gray-50' },
                    React.createElement(
                        'tr',
                        null,
                        columnOrder.filter(col => col.visible).map((col, index) => ( // Filter for visible columns
                            React.createElement('th', { 
                                key: col.id, 
                                scope: 'col', 
                                className: 'py-3 px-6 cursor-pointer relative group', // Pridaný 'group' pre hover efekt
                                onMouseEnter: () => setHoveredColumn(col.id),
                                onMouseLeave: () => setHoveredColumn(null)
                            },
                                React.createElement('div', { className: 'flex flex-col items-center justify-center h-full' }, // ZMENA: flex-col a justify-center
                                    React.createElement('div', { className: 'flex items-center space-x-1 mb-1' }, // ZMENA: Pridaný mb-1 pre medzeru pod ikonami
                                        index > 0 && React.createElement('button', { // Šípka doľava
                                            onClick: (e) => { e.stopPropagation(); moveColumn(col.id, 'left'); },
                                            className: `text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 ${hoveredColumn === col.id ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200` // ZMENA: Opacity na tlačidlách
                                        }, '←'),
                                        React.createElement('button', { 
                                            onClick: (e) => { e.stopPropagation(); openFilterModal(col.id); }, 
                                            className: `text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 ${activeFilters[col.id] && activeFilters[col.id].length > 0 ? 'opacity-100 text-blue-500' : 'opacity-0 group-hover:opacity-100'} transition-opacity duration-200` // ZMENA: Opacity na tlačidlách
                                        }, '⚙️'),
                                        index < columnOrder.filter(c => c.visible).length - 1 && React.createElement('button', { // Šípka doprava
                                            onClick: (e) => { e.stopPropagation(); moveColumn(col.id, 'right'); },
                                            className: `text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 ${hoveredColumn === col.id ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200` // ZMENA: Opacity na tlačidlách
                                        }, '→')
                                    ),
                                    React.createElement('span', { onClick: () => handleSort(col.id), className: 'flex items-center' }, // Kliknutie na text pre triedenie, pridaný flex pre ikonu filtra
                                        col.label,
                                        currentSort.column === col.id && React.createElement('span', { className: 'ml-1' }, currentSort.direction === 'asc' ? '▲' : '▼')
                                    )
                                )
                            ))
                        )
                    )
                ),
                React.createElement(
                    'tbody',
                    null,
                    filteredUsers.length === 0 ? (
                        React.createElement(
                            'tr',
                            null,
                            React.createElement('td', { colSpan: columnOrder.filter(c => c.visible).length, className: 'py-4 px-6 text-center text-gray-500' }, 'Žiadne registrácie na zobrazenie.')
                        )
                    ) : (
                        filteredUsers.map(u => (
                            React.createElement(
                                'tr',
                                { key: u.id, className: 'bg-white border-b hover:bg-gray-50' },
                                columnOrder.filter(col => col.visible).map(col => ( // Filter for visible columns
                                    React.createElement('td', { key: col.id, className: 'py-3 px-6 text-left whitespace-nowrap' },
                                        col.id === 'registrationDate' && getNestedValue(u, col.id) && typeof getNestedValue(u, col.id).toDate === 'function' ? getNestedValue(u, col.id).toDate().toLocaleString('sk-SK') :
                                        col.id === 'approved' ? (getNestedValue(u, col.id) ? 'Áno' : 'Nie') :
                                        col.id === 'postalCode' ? formatPostalCode(getNestedValue(u, col.id)) :
                                        getNestedValue(u, col.id) || '-'
                                    )
                                ))
                            )
                        ))
                    )
                )
            )
        )
      )
    )
  );
}

// Explicitne sprístupniť komponent globálne
window.AllRegistrationsApp = AllRegistrationsApp;
