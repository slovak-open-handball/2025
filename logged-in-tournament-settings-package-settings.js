import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, Timestamp, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";


export function PackageSettings({ db, userProfileData, tournamentStartDate, tournamentEndDate, showNotification, sendAdminNotification }) {
  const [packages, setPackages] = React.useState([]);
  const [showPackageModal, setShowPackageModal] = React.useState(false);
  const [currentPackageEdit, setCurrentPackageEdit] = React.useState(null);
  const [newPackageName, setNewPackageName] = React.useState('');
  const [newPackagePrice, setNewPackagePrice] = React.useState(0);
  const [packageModalMode, setPackageModalMode] = React.useState('add');
  const [showConfirmDeletePackageModal, setShowConfirmDeletePackageModal] = React.useState(false);
  const [packageToDelete, setPackageToDelete] = React.useState(null);

  const [packageMeals, setPackageMeals] = React.useState({});
  const [packageRefreshments, setPackageRefreshments] = React.useState([]);

  const [showRefreshmentColumn, setShowRefreshmentColumn] = React.useState(false);
  const [hasParticipantCard, setHasParticipantCard] = React.useState(false);


  const getDaysBetween = (start, end) => {
    const dates = [];
    let currentDate = new Date(start);
    // Nastavíme čas na začiatok dňa, aby sa predišlo chybám pri porovnávaní dátumov
    currentDate.setHours(0, 0, 0, 0); 
    const endDateAdjusted = new Date(end);
    endDateAdjusted.setHours(0, 0, 0, 0);

    while (currentDate <= endDateAdjusted) {
      dates.push(currentDate.toISOString().split('T')[0]);
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
                fetchedPackages.sort((a, b) => a.name.localeCompare(b.name));
                setPackages(fetchedPackages);
            }, (error) => {
                if (typeof showNotification === 'function') {
                    showNotification(`Chyba pri načítaní balíčkov: ${error.message}`, 'error');
                } else {
                    console.error("Chyba pri načítaní balíčkov a showNotification nie je funkcia:", error);
                }
            });
        } catch (e) {
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

  // Nový useEffect na aktualizáciu balíčkov pri zmene dátumov turnaja
  React.useEffect(() => {
    const updatePackagesBasedOnTournamentDates = async () => {
      // Skontrolujeme, či sú splnené všetky predpoklady
      if (!db || !userProfileData || userProfileData.role !== 'admin' || !tournamentStartDate || !tournamentEndDate) {
        return; 
      }

      const packagesCollectionRef = collection(db, 'settings', 'packages', 'list');
      const querySnapshot = await getDocs(packagesCollectionRef); // Získame aktuálne balíčky priamo z DB

      const newTournamentDays = tournamentDays; // Dni odvodené z aktuálnych dátumov turnaja (props)

      querySnapshot.forEach(async (pkgDoc) => {
        const pkgData = pkgDoc.data();
        const currentMeals = pkgData.meals || {}; // Aktuálne jedlá uložené v tomto dokumente balíčka
        const updatedMeals = {}; // Objekt na zostavenie novej štruktúry jedál
        
        // 1. Spracovanie účastníckej karty oddelene
        if (currentMeals.participantCard === 1) {
            updatedMeals.participantCard = 1;
        }

        // 2. Identifikácia 'starých' dní turnaja z aktuálnej štruktúry jedál
        // Filtrujeme 'participantCard', pretože to nie je dátum
        const oldMealDays = Object.keys(currentMeals).filter(day => day !== 'participantCard').sort();

        // 3. Porovnanie trvania starého a nového turnaja
        if (oldMealDays.length === newTournamentDays.length) {
          // Prípad 1: Rovnaký počet dní - potenciálny posun dátumov
          oldMealDays.forEach((oldDay, index) => {
            const newDay = newTournamentDays[index];
            const oldDayMeals = currentMeals[oldDay] || { breakfast: 0, lunch: 0, dinner: 0, refreshment: 0 };
            updatedMeals[newDay] = oldDayMeals; // Mapujeme nastavenia starých jedál na nové dni
          });
        } else {
          // Prípad 2: Rozdielny počet dní - zmena trvania (predĺžené alebo skrátené)
          // Zachováme prekrývajúce sa dni a vynulujeme nové / odstránime staré dni
          newTournamentDays.forEach(day => {
            if (currentMeals[day]) {
              // Ak nový deň existoval v starých jedlách, ponecháme jeho nastavenia
              updatedMeals[day] = currentMeals[day];
            } else {
              // Ak ide o skutočne nový deň (ktorý nebol v starých jedlách), inicializujeme ho na všetky 0
              updatedMeals[day] = { breakfast: 0, lunch: 0, dinner: 0, refreshment: 0 };
            }
          });
          // Dni zo 'oldMealDays', ktoré už nie sú v 'newTournamentDays', sa implicitne odstránia.
        }
        
        // 4. Záverečná kontrola skutočných zmien pred aktualizáciou Firestore
        // Porovnáme stringifikované verzie na detekciu hĺbkovej rovnosti
        const mealsAreIdentical = JSON.stringify(currentMeals) === JSON.stringify(updatedMeals);
        
        if (!mealsAreIdentical) { // Aktualizujeme iba v prípade, že existuje rozdiel
          try {
            await updateDoc(doc(db, 'settings', 'packages', 'list', pkgDoc.id), {
              meals: updatedMeals,
              updatedAt: Timestamp.fromDate(new Date())
            });
            console.log(`Balíček "${pkgData.name}" bol aktualizovaný na nové dátumy turnaja.`);
          } catch (error) {
            console.error(`Chyba pri aktualizácii balíčka "${pkgData.name}":`, error);
            showNotification(`Chyba pri aktualizácii balíčka "${pkgData.name}" s novými dátumami: ${error.message}`, 'error');
          }
        }
      });
    };

    updatePackagesBasedOnTournamentDates();
  }, [tournamentStartDate, tournamentEndDate, db, userProfileData]); // Závislosti pre React.useEffect


  const handleOpenAddPackageModal = () => {
    setPackageModalMode('add');
    setNewPackageName('');
    setNewPackagePrice(0);
    setPackageMeals({}); // Reset meals for new package
    setPackageRefreshments([]);
    setCurrentPackageEdit(null);
    setShowPackageModal(true);
    setShowRefreshmentColumn(false);
    setHasParticipantCard(false);
  };

  const handleOpenEditPackageModal = (pkg) => {
    setPackageModalMode('edit');
    setNewPackageName(pkg.name);
    setNewPackagePrice(pkg.price);
    // Pri úprave balíčka inicializujeme meals pre všetky dni turnaja
    const initialMeals = {};
    tournamentDays.forEach(day => {
        initialMeals[day] = pkg.meals[day] || { breakfast: 0, lunch: 0, dinner: 0, refreshment: 0 };
    });
    // Zachovať participantCard z pôvodného balíčka, ak existuje
    if (pkg.meals?.participantCard === 1) {
        initialMeals.participantCard = 1;
    } else {
        delete initialMeals.participantCard; // Uistite sa, že nie je nastavené na 0, ak nebolo pôvodne
    }
    setPackageMeals(initialMeals);
    
    setPackageRefreshments([]); // Refreshments are not currently managed via UI, keeping this for future expansion
    setCurrentPackageEdit(pkg);
    setShowPackageModal(true);
    const hasRefreshment = tournamentDays.some(date => (pkg.meals || {})[date]?.refreshment === 1);
    setShowRefreshmentColumn(hasRefreshment);
    setHasParticipantCard(pkg.meals?.participantCard === 1);
  };

  const handleClosePackageModal = () => {
    setShowPackageModal(false);
    setNewPackageName('');
    setNewPackagePrice(0);
    setPackageMeals({});
    setPackageRefreshments([]);
    setCurrentPackageEdit(null);
    setPackageModalMode('add');
    setShowRefreshmentColumn(false);
    setHasParticipantCard(false);
  };

  const handleMealChange = (date, mealType, isChecked) => {
    setPackageMeals(prevMeals => ({
      ...prevMeals,
      [date]: {
        ...(prevMeals[date] || {}),
        [mealType]: isChecked ? 1 : 0
      }
    }));
  };

  const handleParticipantCardChange = (isChecked) => {
    setHasParticipantCard(isChecked);
    setPackageMeals(prevMeals => ({
      ...prevMeals,
      participantCard: isChecked ? 1 : 0
    }));
  };

  const handleAddRefreshment = (date) => { };
  const handleRemoveRefreshment = (date, itemIndex) => { };
  const handleRefreshmentItemChange = (date, itemIndex, field, value) => { };


  const handleSavePackage = async () => {
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


    const packagesCollectionRef = collection(db, 'settings', 'packages', 'list');

    try {
      const mealsToSave = { ...packageMeals };
      if (hasParticipantCard) {
        mealsToSave.participantCard = 1;
      } else {
        delete mealsToSave.participantCard; // Odstrániť, ak nie je začiarknutá
      }


      if (packageModalMode === 'add') {
        if (packages.some(pkg => pkg.name === trimmedName)) {
          showNotification(`Balíček "${trimmedName}" už existuje.`, 'error');
          return;
        }
        await addDoc(packagesCollectionRef, {
          name: trimmedName,
          price: newPackagePrice,
          meals: mealsToSave,
          refreshments: [],
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
        
        const originalPkgData = currentPackageEdit || {};
        originalPkgData.meals = originalPkgData.meals || {}; 
        originalPkgData.name = originalPkgData.name || ''; 
        originalPkgData.price = originalPkgData.price || 0; 

        const newPkgData = { 
            id: originalPkgData.id, 
            name: trimmedName,
            price: newPackagePrice,
            meals: mealsToSave,
            refreshments: [], 
        };


        await updateDoc(packageDocRef, {
          name: trimmedName,
          price: newPackagePrice,
          meals: mealsToSave,
          refreshments: [],
          updatedAt: Timestamp.fromDate(new Date())
        });
        showNotification(`Balíček "${currentPackageEdit.name}" úspešne zmenený na "${trimmedName}"!`, 'success');
        if (typeof sendAdminNotification === 'function') {
            await sendAdminNotification({ 
                type: 'editPackage', 
                data: { 
                    originalPackage: originalPkgData, 
                    newPackage: newPkgData, 
                } 
            });
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
      // Opravené volanie: voláme správnu funkciu pre zatvorenie modalu balíčkov
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
                        { key: pkg.id, className: 'flex justify-between items-center bg-gray-50 p-3 rounded-md shadow-sm mb-2 flex-wrap' },
                        React.createElement('span', { className: 'text-gray-800 font-medium w-full md:w-auto' }, `${pkg.name} - ${pkg.price} €`),
                        React.createElement(
                            'div',
                            { className: 'text-sm text-gray-600 w-full mt-2 md:mt-0' },
                            // Filtrujeme iba dni, ktoré sú v aktuálnych tournamentDays
                            Object.keys(pkg.meals || {})
                                .filter(date => date !== 'participantCard' && tournamentDays.includes(date))
                                .sort()
                                .map(date => {
                                const mealsForDay = pkg.meals[date];
                                const includedItems = [];
                                if (mealsForDay && mealsForDay.breakfast === 1) includedItems.push('raňajky');
                                if (mealsForDay && mealsForDay.lunch === 1) includedItems.push('obed');
                                if (mealsForDay && mealsForDay.dinner === 1) includedItems.push('večera');
                                if (mealsForDay && mealsForDay.refreshment === 1) includedItems.push('občerstvenie');

                                if (includedItems.length > 0) {
                                    const displayDate = new Date(date).toLocaleDateString('sk-SK', { weekday: 'short', day: 'numeric', month: 'numeric' });
                                    return React.createElement('p', { key: date, className: 'ml-4' }, `${displayDate}: ${includedItems.join(', ')}`);
                                }
                                return null;
                            }),
                            (pkg.meals && pkg.meals.participantCard === 1) &&
                                React.createElement('p', { className: 'ml-4 font-bold text-gray-700' }, 'zahŕňa účastnícku kartu')
                        ),
                        React.createElement(
                            'div',
                            { className: 'flex space-x-2 mt-2 w-full md:w-auto md:mt-0 md:ml-auto justify-end' },
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
        
        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'newPackageName' }, 'Názov balíčka'),
        React.createElement(
          'input',
          {
            type: 'text',
            id: 'newPackageName',
            className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 mb-4',
            placeholder: 'Zadajte názov balíčka',
            value: newPackageName,
            onChange: (e) => setNewPackageName(e.target.value),
          }
        ),
        
        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'newPackagePrice' }, 'Cena balíčka'),
        React.createElement(
            'div',
            { className: 'flex items-center mb-4' },
            React.createElement(
                'input',
                {
                  type: 'number',
                  id: 'newPackagePrice',
                  className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 mr-2',
                  placeholder: 'Zadajte cenu balíčka',
                  value: newPackagePrice,
                  onChange: (e) => setNewPackagePrice(parseFloat(e.target.value) || 0),
                  min: 0,
                  step: 0.01
                }
            ),
            React.createElement('span', { className: 'text-gray-700 font-semibold text-lg' }, '€')
        ),

        React.createElement('h4', { className: 'text-lg font-semibold mb-2' }, 'Stravovanie na deň:'),
        tournamentDays.length > 0 ? (
            React.createElement(
                React.Fragment,
                null,
                React.createElement(
                    'div',
                    { className: 'overflow-x-auto mb-4' },
                    React.createElement(
                        'table',
                        { className: 'min-w-full bg-white border border-gray-200 rounded-lg shadow-sm' },
                        React.createElement(
                            'thead',
                            null,
                            React.createElement(
                                'tr',
                                { className: 'bg-gray-100' },
                                React.createElement('th', { className: 'py-2 px-1 border-b text-left text-sm font-semibold text-gray-600 whitespace-nowrap' }, 'Dátum'),
                                React.createElement('th', { className: 'py-2 px-1 border-b text-center text-sm font-semibold text-gray-600 whitespace-nowrap' }, 'raňajky'),
                                React.createElement('th', { className: 'py-2 px-1 border-b text-center text-sm font-semibold text-gray-600 whitespace-nowrap' }, 'obed'),
                                React.createElement('th', { className: 'py-2 px-1 border-b text-center text-sm font-semibold text-gray-600 whitespace-nowrap' }, 'večera'),
                                showRefreshmentColumn && React.createElement('th', { className: 'py-2 px-1 border-b text-center text-sm font-semibold text-gray-600 whitespace-nowrap' }, 'občerstvenie')
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
                                        React.createElement('span', {className: 'text-xs text-gray-500'}, new Date(date).toLocaleDateString('sk-SK', { weekday: 'short' }))
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
                    React.createElement('label', { htmlFor: 'toggleRefreshmentColumn', className: 'ml-2 text-gray-700' }, 'zobraziť stĺpec občerstvenie')
                )
            )
        ) : (
            React.createElement('p', { className: 'text-gray-500 text-center' }, 'Pre konfiguráciu stravovania najprv nastavte dátumy začiatku a konca turnaja vo všeobecných nastaveniach.')
        ),

        React.createElement(
            'div',
            { className: 'flex items-center mt-4 border-t border-gray-200 pt-4' },
            React.createElement('input', {
                type: 'checkbox',
                id: 'hasParticipantCard',
                className: 'form-checkbox h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500',
                checked: hasParticipantCard,
                onChange: (e) => handleParticipantCardChange(e.target.checked),
            }),
            React.createElement('label', { htmlFor: 'hasParticipantCard', className: 'ml-2 text-gray-700 font-bold' }, 'zahŕňa účastnícku kartu')
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
        React.createElement('p', { className: 'text-gray-700 mb-6' }, `Naozaj chcete zmazať balíček "${packageToDelete?.name}" (cena: ${packageToDelete?.price} €)?`),
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
