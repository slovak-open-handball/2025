import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Funkcie showNotification a sendAdminNotification sa očakávajú ako props z nadradeného komponentu.
// Preto ich tu neimportujeme ani nedefinujeme.


export function PackageSettings({ db, userProfileData, tournamentStartDate, tournamentEndDate, showNotification, sendAdminNotification }) {
  const [packages, setPackages] = React.useState([]);
  const [showPackageModal, setShowPackageModal] = React.useState(false);
  const [currentPackageEdit, setCurrentPackageEdit] = React.useState(null);
  const [newPackageName, setNewPackageName] = React.useState('');
  const [newPackagePrice, setNewPackagePrice] = React.useState(0);
  const [packageModalMode, setPackageModalMode] = React.useState('add');
  const [showConfirmDeletePackageModal, setShowConfirmDeletePackageModal] = React.useState(false);
  const [packageToDelete, setPackageToDelete] = React.useState(null);

  // packageMeals bude teraz obsahovať aj informácie o občerstvení (0 alebo 1)
  const [packageMeals, setPackageMeals] = React.useState({});
  // packageRefreshments sa už nepoužíva pre túto logiku, ale ponechávam deklaráciu, ak by bolo v iných častiach kódu
  const [packageRefreshments, setPackageRefreshments] = React.useState([]);

  // Nový stav pre ovládanie viditeľnosti stĺpca občerstvenia
  const [showRefreshmentColumn, setShowRefreshmentColumn] = React.useState(false);


  const getDaysBetween = (start, end) => {
    const dates = [];
    let currentDate = new Date(start);
    while (currentDate <= end) {
      dates.push(currentDate.toISOString().split('T')[0]); // YYYY-MM-DD
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return dates;
  };

  const tournamentDays = React.useMemo(() => {
    const startDate = tournamentStartDate ? new Date(tournamentStartDate) : null;
    const endDate = tournamentEndDate ? new Date(tournamentEndDate) : null;
    if (startDate && endDate && !isNaN(startDate) && !isNaN(endDate)) {
        return getDaysBetween(startDate, endDate);
    }
    return [];
  }, [tournamentStartDate, tournamentEndDate]);


  React.useEffect(() => {
    let unsubscribePackages;
    const fetchPackages = async () => {
        if (!db || !userProfileData || userProfileData.role !== 'admin') {
            return;
        }
        try {
            const packagesCollectionRef = collection(db, 'settings', 'packages', 'list');
            unsubscribePackages = onSnapshot(packagesCollectionRef, (snapshot) => {
                const fetchedPackages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setPackages(fetchedPackages);
            }, (error) => {
                // Obranná kontrola pre showNotification
                if (typeof showNotification === 'function') {
                    showNotification(`Chyba pri načítaní balíčkov: ${error.message}`, 'error');
                } else {
                    console.error("Chyba pri načítaní balíčkov a showNotification nie je funkcia:", error);
                }
            });
        } catch (e) {
            // Obranná kontrola pre showNotification
            if (typeof showNotification === 'function') {
                showNotification(`Chyba pri nastavovaní poslucháča pre balíčky: ${e.message}`, 'error');
            } else {
                console.error("Chyba pri nastavovaní poslucháča pre balíčky a showNotification nie je funkcia:", e);
            }
        }

        return () => {
            if (unsubscribePackages) {
                unsubscribePackages();
            }
        };
    };

    fetchPackages();
  }, [db, userProfileData, showNotification]);


  const handleOpenAddPackageModal = () => {
    setPackageModalMode('add');
    setNewPackageName('');
    setNewPackagePrice(0);
    setPackageMeals({}); // Reset na prázdny objekt pre nové balíčky
    setPackageRefreshments([]); // Reset na prázdne pole
    setCurrentPackageEdit(null);
    setShowPackageModal(true);
    setShowRefreshmentColumn(false); // Predvolene skryť pri pridávaní nového balíčka
  };

  const handleOpenEditPackageModal = (pkg) => {
    setPackageModalMode('edit');
    setNewPackageName(pkg.name);
    setNewPackagePrice(pkg.price);
    // Pri editácii, ak meals chýbajú, inicializujte ich na prázdne objekty/polia
    setPackageMeals(pkg.meals || {});
    // Stará štruktúra občerstvenia sa už nepoužíva
    setPackageRefreshments([]); 
    setCurrentPackageEdit(pkg);
    setShowPackageModal(true);
    // Ak existuje aspoň jeden záznam s občerstvením, zobrazíme stĺpec
    const hasRefreshment = tournamentDays.some(date => (pkg.meals || {})[date]?.refreshment === 1);
    setShowRefreshmentColumn(hasRefreshment);
  };

  const handleClosePackageModal = () => {
    setShowPackageModal(false);
    setNewPackageName('');
    setNewPackagePrice(0);
    setPackageMeals({});
    setPackageRefreshments([]);
    setCurrentPackageEdit(null);
    setPackageModalMode('add');
    setShowRefreshmentColumn(false); // Skryť pri zatvorení modálu
  };

  // Upravená funkcia pre zmenu stavu checkboxu pre jedlá A občerstvenie
  const handleMealChange = (date, mealType, isChecked) => {
    setPackageMeals(prevMeals => ({
      ...prevMeals,
      [date]: {
        ...(prevMeals[date] || {}),
        [mealType]: isChecked ? 1 : 0 // Ak je začiarknuté, nastavíme 1, inak 0
      }
    }));
  };

  // Tieto funkcie sa už nebudú používať, pretože občerstvenie je teraz súčasťou packageMeals
  const handleAddRefreshment = (date) => { /* Neaktívne */ };
  const handleRemoveRefreshment = (date, itemIndex) => { /* Neaktívne */ };
  const handleRefreshmentItemChange = (date, itemIndex, field, value) => { /* Neaktívne */ };


  const handleSavePackage = async () => {
    // Obranná kontrola
    if (typeof showNotification !== 'function') {
        console.error("DEBUG: showNotification prop is not a function in handleSavePackage!");
        return; 
    }
    if (typeof sendAdminNotification !== 'function') {
        console.error("DEBUG: sendAdminNotification prop is not a function in handleSavePackage!");
    }

    if (!db || !userProfileData || userProfileData.role !== 'admin') {
      showNotification("Nemáte oprávnenie na zmenu nastavení balíčkov.", 'error');
      return;
    }

    const trimmedName = newPackageName.trim();
    if (!trimmedName) {
      showNotification("Názov balíčka nemôže byť prázdny.", 'error');
      return;
    }
    if (newPackagePrice < 0) {
      showNotification("Cena balíčka nemôže byť záporná.", 'error');
      return;
    }

    // Odstránená validácia pre packageRefreshments, pretože sa zmenila štruktúra
    // for (const dayRefreshment of packageRefreshments) {
    //     for (const item of dayRefreshment.items) {
    //         if (!item.name.trim() || isNaN(item.price) || item.price < 0) {
    //             showNotification("Každé občerstvenie musí mať názov a nezápornú cenu.", 'error');
    //             return;
    //         }
    //     }
    // }


    const packagesCollectionRef = collection(db, 'settings', 'packages', 'list');

    try {
      if (packageModalMode === 'add') {
        if (packages.some(pkg => pkg.name === trimmedName)) {
          showNotification(`Balíček "${trimmedName}" už existuje.`, 'error');
          return;
        }
        await addDoc(packagesCollectionRef, {
          name: trimmedName,
          price: newPackagePrice,
          meals: packageMeals, // Uloží sa aj informácia o občerstvení tu
          refreshments: [], // Občerstvenie sa už nebude ukladať samostatne
          createdAt: Timestamp.fromDate(new Date())
        });
        showNotification(`Balíček "${trimmedName}" úspešne pridaný!`, 'success');
        if (typeof sendAdminNotification === 'function') {
            await sendAdminNotification({ type: 'createPackage', data: { name: trimmedName, price: newPackagePrice } });
        }
      } else if (packageModalMode === 'edit') {
        if (trimmedName !== currentPackageEdit.name && packages.some(pkg => pkg.name === trimmedName)) {
            showNotification(`Balíček "${trimmedName}" už existuje.`, 'error');
            return;
        }
        const packageDocRef = doc(db, 'settings', 'packages', 'list', currentPackageEdit.id);
        await updateDoc(packageDocRef, {
          name: trimmedName,
          price: newPackagePrice,
          meals: packageMeals, // Uloží sa aj informácia o občerstvení tu
          refreshments: [], // Občerstvenie sa už nebude ukladať samostatne
          updatedAt: Timestamp.fromDate(new Date())
        });
        showNotification(`Balíček "${currentPackageEdit.name}" úspešne zmenený na "${trimmedName}"!`, 'success');
        if (typeof sendAdminNotification === 'function') {
            await sendAdminNotification({ type: 'editPackage', data: { originalName: currentPackageEdit.name, originalPrice: currentPackageEdit.price, newName: trimmedName, newPrice: newPackagePrice } });
        }
      }
      handleClosePackageModal();
    } catch (e) {
      showNotification(`Chyba pri ukladaní balíčka: ${e.message}`, 'error');
    }
  };

  const handleOpenConfirmDeletePackageModal = (pkg) => {
    setPackageToDelete(pkg);
    setShowConfirmDeletePackageModal(true);
  };

  const handleCloseConfirmDeletePackageModal = () => {
    setShowConfirmDeletePackageModal(false);
    setPackageToDelete(null);
  };

  const handleDeletePackage = async () => {
    // Obranná kontrola
    if (typeof showNotification !== 'function') {
        console.error("DEBUG: showNotification prop is not a function in handleDeletePackage!");
        console.error("Chyba: Nemáte oprávnenie na zmazanie balíčka (showNotification not available).");
        return; 
    }
    if (typeof sendAdminNotification !== 'function') {
        console.error("DEBUG: sendAdminNotification prop is not a function in handleDeletePackage!");
    }

    if (!db || !userProfileData || userProfileData.role !== 'admin') {
      showNotification("Nemáte oprávnenie na zmazanie balíčka.", 'error');
      return;
    }
    if (!packageToDelete) return;

    try {
      const packageDocRef = doc(db, 'settings', 'packages', 'list', packageToDelete.id);
      await deleteDoc(packageDocRef);
      showNotification(`Balíček "${packageToDelete.name}" úspešne zmazaný!`, 'success');
      if (typeof sendAdminNotification === 'function') {
        await sendAdminNotification({ type: 'deletePackage', data: { deletedName: packageToDelete.name, deletedPrice: packageToDelete.price } });
      }
      handleCloseConfirmDeletePackageModal();
    } catch (e) {
      showNotification(`Chyba pri mazaní balíčka: ${e.message}`, 'error');
    }
  };


  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
        'div',
        { className: 'space-y-4 p-6 border border-gray-200 rounded-lg shadow-sm mt-8' },
        React.createElement('h2', { className: 'text-2xl font-semibold text-gray-700 mb-4' }, 'Nastavenia balíčkov (stravovanie a občerstvenie)'),
        React.createElement(
            'div',
            { className: 'space-y-3' },
            packages.length > 0 ? (
                packages.map((pkg) => (
                    React.createElement(
                        'div',
                        { key: pkg.id, className: 'flex justify-between items-center bg-gray-50 p-3 rounded-md shadow-sm' },
                        React.createElement('span', { className: 'text-gray-800 font-medium' }, `${pkg.name} (Cena: ${pkg.price}€)`),
                        React.createElement(
                            'div',
                            { className: 'flex space-x-2' },
                            React.createElement(
                                'button',
                                {
                                    type: 'button',
                                    onClick: () => handleOpenEditPackageModal(pkg),
                                    className: 'bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-bold py-1 px-3 rounded-lg transition-colors duration-200 focus:outline-none focus:shadow-outline'
                                },
                                'Upraviť'
                            ),
                            React.createElement(
                                'button',
                                {
                                    type: 'button',
                                    onClick: () => handleOpenConfirmDeletePackageModal(pkg),
                                    className: 'bg-red-500 hover:bg-red-600 text-white text-sm font-bold py-1 px-3 rounded-lg transition-colors duration-200 focus:outline-none focus:shadow-outline'
                                },
                                'Vymazať'
                            )
                        )
                    )
                ))
            ) : (
                React.createElement('p', { className: 'text-gray-500 text-center' }, 'Zatiaľ nie sú definované žiadne balíčky.')
            )
        ),
        React.createElement(
            'div',
            { className: 'flex justify-center mt-4' },
            React.createElement(
                'button',
                {
                    type: 'button',
                    onClick: handleOpenAddPackageModal,
                    className: 'bg-green-500 hover:bg-green-600 text-white font-bold p-3 rounded-full shadow-lg transition-colors duration-200 focus:outline-none focus:shadow-outline w-12 h-12 flex items-center justify-center'
                },
                React.createElement('span', { className: 'text-xl' }, '+')
            )
        )
    ),

    showPackageModal && React.createElement(
      'div',
      { className: 'modal' },
      React.createElement(
        'div',
        { className: 'modal-content' },
        React.createElement('h3', { className: 'text-xl font-bold mb-4' }, packageModalMode === 'add' ? 'Pridať nový balíček' : `Upraviť balíček: ${currentPackageEdit?.name}`),
        
        // Nový label pre Názov balíčka
        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'newPackageName' }, 'Názov balíčka'),
        React.createElement(
          'input',
          {
            type: 'text',
            id: 'newPackageName', // Pridané ID pre label
            className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 mb-4',
            placeholder: 'Zadajte názov balíčka',
            value: newPackageName,
            onChange: (e) => setNewPackageName(e.target.value),
          }
        ),
        
        // Nový label a úprava pre Cenu balíčka s "€"
        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'newPackagePrice' }, 'Cena balíčka'),
        React.createElement(
            'div',
            { className: 'flex items-center mb-4' }, // Flexbox na zarovnanie inputu a "€"
            React.createElement(
                'input',
                {
                  type: 'number',
                  id: 'newPackagePrice', // Pridané ID pre label
                  className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 mr-2', // Pridaný pravý margin
                  placeholder: 'Zadajte cenu balíčka',
                  value: newPackagePrice,
                  onChange: (e) => setNewPackagePrice(parseFloat(e.target.value) || 0),
                  min: 0,
                  step: 0.01
                }
            ),
            React.createElement('span', { className: 'text-gray-700 font-semibold text-lg' }, '€') // Znak Euro
        ),

        React.createElement('h4', { className: 'text-lg font-semibold mb-2' }, 'Stravovanie na deň:'),
        tournamentDays.length > 0 ? (
            React.createElement(
                React.Fragment, // Použijeme Fragment na zoskupenie tabuľky a checkboxu
                null,
                React.createElement(
                    'div',
                    { className: 'overflow-x-auto mb-4' }, // Pre responzívnosť tabuľky na menších obrazovkách
                    React.createElement(
                        'table',
                        { className: 'min-w-full bg-white border border-gray-200 rounded-lg shadow-sm' },
                        React.createElement(
                            'thead',
                            null,
                            React.createElement(
                                'tr',
                                { className: 'bg-gray-100' },
                                React.createElement('th', { className: 'py-2 px-1 border-b text-left text-sm font-semibold text-gray-600 w-1/4' }, 'Dátum'),
                                React.createElement('th', { className: 'py-2 px-1 border-b text-center text-sm font-semibold text-gray-600' }, 'Raňajky'),
                                React.createElement('th', { className: 'py-2 px-1 border-b text-center text-sm font-semibold text-gray-600' }, 'Obed'),
                                React.createElement('th', { className: 'py-2 px-1 border-b text-center text-sm font-semibold text-gray-600' }, 'Večera'), 
                                showRefreshmentColumn && React.createElement('th', { className: 'py-2 px-1 border-b text-center text-sm font-semibold text-gray-600' }, 'Občerstvenie') 
                            )
                        ),
                        React.createElement(
                            'tbody',
                            null,
                            tournamentDays.map(date => (
                                React.createElement(
                                    'tr',
                                    { key: date, className: 'hover:bg-gray-50' },
                                    React.createElement('td', { className: 'py-2 px-1 border-b text-gray-700' },
                                        new Date(date).toLocaleDateString('sk-SK'),
                                        React.createElement('br'),
                                        React.createElement('span', {className: 'text-xs text-gray-500'}, new Date(date).toLocaleDateString('sk-SK', { weekday: 'long' }))
                                    ),
                                    React.createElement('td', { className: 'py-2 px-1 border-b text-center' },
                                        React.createElement('input', {
                                            type: 'checkbox',
                                            className: 'form-checkbox h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500',
                                            checked: packageMeals[date]?.breakfast === 1,
                                            onChange: (e) => handleMealChange(date, 'breakfast', e.target.checked),
                                        })
                                    ),
                                    React.createElement('td', { className: 'py-2 px-1 border-b text-center' },
                                        React.createElement('input', {
                                            type: 'checkbox',
                                            className: 'form-checkbox h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500',
                                            checked: packageMeals[date]?.lunch === 1,
                                            onChange: (e) => handleMealChange(date, 'lunch', e.target.checked),
                                        })
                                    ),
                                    React.createElement('td', { className: 'py-2 px-1 border-b text-center' },
                                        React.createElement('input', {
                                            type: 'checkbox',
                                            className: 'form-checkbox h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500',
                                            checked: packageMeals[date]?.dinner === 1,
                                            onChange: (e) => handleMealChange(date, 'dinner', e.target.checked),
                                        })
                                    ),
                                    showRefreshmentColumn && React.createElement('td', { className: 'py-2 px-1 border-b text-center' },
                                        React.createElement('input', {
                                            type: 'checkbox',
                                            className: 'form-checkbox h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500',
                                            checked: packageMeals[date]?.refreshment === 1,
                                            onChange: (e) => handleMealChange(date, 'refreshment', e.target.checked),
                                        })
                                    )
                                )
                            )
                        ))
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'flex items-center mt-4' },
                    React.createElement('input', {
                        type: 'checkbox',
                        id: 'toggleRefreshmentColumn',
                        className: 'form-checkbox h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500',
                        checked: showRefreshmentColumn,
                        onChange: (e) => setShowRefreshmentColumn(e.target.checked),
                    }),
                    React.createElement('label', { htmlFor: 'toggleRefreshmentColumn', className: 'ml-2 text-gray-700' }, 'Zobraziť stĺpec Občerstvenie')
                )
            )
        ) : (
            React.createElement('p', { className: 'text-gray-500 text-center' }, 'Pre konfiguráciu stravovania najprv nastavte dátumy začiatku a konca turnaja vo všeobecných nastaveniach.')
        ),

        React.createElement(
          'div',
          { className: 'flex justify-end space-x-3 mt-4' },
          React.createElement(
            'button',
            {
              type: 'button',
              onClick: handleClosePackageModal,
              className: 'bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200'
            },
            'Zrušiť'
          ),
          React.createElement(
            'button',
            {
              type: 'button',
              onClick: handleSavePackage,
              className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200'
            },
            packageModalMode === 'add' ? 'Pridať' : 'Uložiť'
          )
        )
      )
    ),

    showConfirmDeletePackageModal && React.createElement(
      'div',
      { className: 'modal' },
      React.createElement(
        'div',
        { className: 'modal-content' },
        React.createElement('h3', { className: 'text-xl font-bold mb-4' }, 'Potvrdiť zmazanie'),
        React.createElement('p', { className: 'text-gray-700 mb-6' }, `Naozaj chcete zmazať balíček "${packageToDelete?.name}" (cena: ${packageToDelete?.price}€)?`),
        React.createElement(
          'div',
          { className: 'flex justify-end space-x-3' },
          React.createElement(
            'button',
            {
              type: 'button',
              onClick: handleCloseConfirmDeletePackageModal,
              className: 'bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200'
            },
            'Zrušiť'
          ),
          React.createElement(
            'button',
            {
              type: 'button',
              onClick: handleDeletePackage,
              className: 'bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200'
            },
            'Zmazať'
          )
        )
      )
    )
  );
}
