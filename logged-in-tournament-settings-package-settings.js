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
    // Upravené: Vytvoríme nový dátum v lokálnej časovej zóne z komponentov existujúceho dátumu,
    // aby sa predišlo problémom s posunom kvôli UTC/časovej zóne.
    const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    
    let currentDate = startDate;
    while (currentDate <= endDate) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return dates;
  };

  const tournamentDays = React.useMemo(() => {
    if (!tournamentStartDate || !tournamentEndDate) return [];
    // Vytvoríme kópie dátumov, aby sme nemodifikovali originálne stavy
    return getDaysBetween(new Date(tournamentStartDate), new Date(tournamentEndDate));
  }, [tournamentStartDate, tournamentEndDate]);

  React.useEffect(() => {
    if (tournamentDays.length > 0) {
      // Ak sa zmenia dni turnaja, skontrolujeme a prípadne aktualizujeme jedlá
      const newPackageMeals = {};
      const newPackageRefreshments = [];
      const hasRefreshments = packages.some(p => p.refreshments?.length > 0);
      const hasParticipantCard = packages.some(p => p.hasParticipantCard);

      setShowRefreshmentColumn(hasRefreshments);
      setHasParticipantCard(hasParticipantCard);

      tournamentDays.forEach(day => {
        newPackageMeals[day.toISOString().split('T')[0]] = false;
        newPackageRefreshments.push({
          date: day,
          name: '',
          price: 0,
        });
      });

      // Ak sme v móde úpravy, načítame existujúce dáta
      if (currentPackageEdit) {
        const updatedMeals = { ...newPackageMeals };
        currentPackageEdit.meals.forEach(mealDate => {
          const dateStr = new Date(mealDate.seconds * 1000).toISOString().split('T')[0];
          if (updatedMeals[dateStr] !== undefined) {
            updatedMeals[dateStr] = true;
          }
        });
        setPackageMeals(updatedMeals);
        
        const updatedRefreshments = tournamentDays.map(day => {
          const matchingRefreshment = currentPackageEdit.refreshments?.find(r => 
            new Date(r.date.seconds * 1000).toISOString().split('T')[0] === day.toISOString().split('T')[0]
          );
          return {
            date: day,
            name: matchingRefreshment?.name || '',
            price: matchingRefreshment?.price || 0,
          };
        });
        setPackageRefreshments(updatedRefreshments);
      } else {
        setPackageMeals(newPackageMeals);
        setPackageRefreshments(newPackageRefreshments);
      }
    }
  }, [tournamentDays, currentPackageEdit]);
  
  React.useEffect(() => {
    let unsubscribePackages;
    const fetchPackages = async () => {
      if (!db || userProfileData.role !== 'admin') {
        return;
      }
      try {
        const packagesCollectionRef = collection(db, 'settings', 'packages', 'list');
        unsubscribePackages = onSnapshot(packagesCollectionRef, docSnapshot => {
          const fetchedPackages = docSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setPackages(fetchedPackages);
          
          const hasRefreshments = fetchedPackages.some(p => p.refreshments?.length > 0);
          const hasParticipantCard = fetchedPackages.some(p => p.hasParticipantCard);

          setShowRefreshmentColumn(hasRefreshments);
          setHasParticipantCard(hasParticipantCard);
        });
      } catch (e) {
        showNotification('Chyba pri načítaní balíkov.', 'error');
        console.error("Error loading packages: ", e);
      }
    };

    if (db && userProfileData) {
      fetchPackages();
    }

    return () => {
      if (unsubscribePackages) {
        unsubscribePackages();
      }
    };
  }, [db, userProfileData]);

  const handleOpenAddPackageModal = () => {
    setPackageModalMode('add');
    setCurrentPackageEdit(null);
    setNewPackageName('');
    setNewPackagePrice(0);
    setPackageMeals({});
    setPackageRefreshments(tournamentDays.map(day => ({
      date: day,
      name: '',
      price: 0,
    })));
    setShowPackageModal(true);
  };

  const handleOpenEditPackageModal = (pkg) => {
    setPackageModalMode('edit');
    setCurrentPackageEdit(pkg);
    setNewPackageName(pkg.name);
    setNewPackagePrice(pkg.price);
    setHasParticipantCard(pkg.hasParticipantCard);

    // Načítanie existujúcich jedál
    const newPackageMeals = {};
    tournamentDays.forEach(day => {
      newPackageMeals[day.toISOString().split('T')[0]] = false;
    });
    pkg.meals.forEach(mealDate => {
      const dateStr = new Date(mealDate.seconds * 1000).toISOString().split('T')[0];
      if (newPackageMeals[dateStr] !== undefined) {
        newPackageMeals[dateStr] = true;
      }
    });
    setPackageMeals(newPackageMeals);

    // Načítanie existujúcich občerstvení
    const updatedRefreshments = tournamentDays.map(day => {
      const matchingRefreshment = pkg.refreshments?.find(r => 
        new Date(r.date.seconds * 1000).toISOString().split('T')[0] === day.toISOString().split('T')[0]
      );
      return {
        date: day,
        name: matchingRefreshment?.name || '',
        price: matchingRefreshment?.price || 0,
      };
    });
    setPackageRefreshments(updatedRefreshments);

    setShowPackageModal(true);
  };

  const handleClosePackageModal = () => {
    setShowPackageModal(false);
    setCurrentPackageEdit(null);
  };
  
  const handleSavePackage = async () => {
    if (!newPackageName.trim()) {
      showNotification('Názov balíčka je povinný.', 'error');
      return;
    }
    if (newPackagePrice < 0) {
      showNotification('Cena nemôže byť záporná.', 'error');
      return;
    }
    if (!db) {
        showNotification('Databáza nie je k dispozícii.', 'error');
        return;
    }

    const mealsToSave = Object.entries(packageMeals)
      .filter(([date, isChecked]) => isChecked)
      .map(([date]) => Timestamp.fromDate(new Date(date)));
    
    const refreshmentsToSave = packageRefreshments.map(r => ({
      date: Timestamp.fromDate(r.date),
      name: r.name,
      price: r.price,
    }));

    const packageData = {
      name: newPackageName.trim(),
      price: newPackagePrice,
      meals: mealsToSave,
      refreshments: refreshmentsToSave,
      hasParticipantCard: hasParticipantCard,
    };
    
    try {
      if (packageModalMode === 'add') {
        const packagesCollectionRef = collection(db, 'settings', 'packages', 'list');
        await addDoc(packagesCollectionRef, packageData);
        showNotification('Balíček úspešne pridaný!', 'success');
        sendAdminNotification({ message: `Bol pridaný nový balíček: ${newPackageName}` });
      } else {
        const packageDocRef = doc(db, 'settings', 'packages', 'list', currentPackageEdit.id);
        await updateDoc(packageDocRef, packageData);
        showNotification('Balíček úspešne aktualizovaný!', 'success');
        sendAdminNotification({ message: `Bol upravený balíček: ${newPackageName}` });
      }
      handleClosePackageModal();
    } catch (e) {
      showNotification('Chyba pri ukladaní balíčka.', 'error');
      console.error("Error saving package: ", e);
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
    if (!packageToDelete) return;

    try {
      const packageDocRef = doc(db, 'settings', 'packages', 'list', packageToDelete.id);
      await deleteDoc(packageDocRef);
      showNotification(`Balíček "${packageToDelete.name}" bol úspešne zmazaný.`, 'success');
      sendAdminNotification({ message: `Bol zmazaný balíček: ${packageToDelete.name}` });
      handleCloseConfirmDeletePackageModal();
    } catch (e) {
      showNotification('Chyba pri mazaní balíčka.', 'error');
      console.error("Error deleting package: ", e);
    }
  };

  const handleMealChange = (date) => {
    setPackageMeals(prev => ({
      ...prev,
      [date]: !prev[date],
    }));
  };

  const handleRefreshmentChange = (dayIndex, field, value) => {
    setPackageRefreshments(prev => prev.map((item, index) => 
      index === dayIndex ? { ...item, [field]: value } : item
    ));
  };
  
  return React.createElement(
    'div',
    { className: 'p-6 bg-gray-100 rounded-lg shadow-md' },
    React.createElement('h2', { className: 'text-2xl font-bold mb-4 text-gray-800' }, 'Balíčky pre turnaj'),
    React.createElement('p', { className: 'text-gray-600 mb-6' }, `Turnaj je naplánovaný od ${tournamentDays.length > 0 ? tournamentDays[0].toLocaleDateString('sk-SK') : 'nezadané'} do ${tournamentDays.length > 0 ? tournamentDays[tournamentDays.length - 1].toLocaleDateString('sk-SK') : 'nezadané'}.`),
    
    // Zobrazí tabuľku so všetkými balíčkami
    React.createElement(
      'div',
      { className: 'overflow-x-auto' },
      packages.length > 0 ? (
        React.createElement(
          'table',
          { className: 'min-w-full bg-white rounded-lg shadow-sm' },
          React.createElement(
            'thead',
            { className: 'bg-gray-200' },
            React.createElement(
              'tr',
              null,
              React.createElement('th', { className: 'py-2 px-4 border-b font-semibold text-left text-gray-600' }, 'Názov'),
              React.createElement('th', { className: 'py-2 px-4 border-b font-semibold text-left text-gray-600' }, 'Cena (€)'),
              React.createElement('th', { className: 'py-2 px-4 border-b font-semibold text-left text-gray-600' }, 'Obsahuje lístok'),
              React.createElement('th', { className: 'py-2 px-4 border-b font-semibold text-left text-gray-600' }, 'Jedlá'),
              showRefreshmentColumn && React.createElement('th', { className: 'py-2 px-4 border-b font-semibold text-left text-gray-600' }, 'Občerstvenie'),
              React.createElement('th', { className: 'py-2 px-4 border-b font-semibold text-left text-gray-600' }, 'Akcie')
            )
          ),
          React.createElement(
            'tbody',
            null,
            packages.map(pkg => (
              React.createElement(
                'tr',
                { key: pkg.id, className: 'hover:bg-gray-50' },
                React.createElement('td', { className: 'py-2 px-4 border-b text-gray-700' }, pkg.name),
                React.createElement('td', { className: 'py-2 px-4 border-b text-gray-700' }, pkg.price),
                React.createElement('td', { className: 'py-2 px-4 border-b text-gray-700' }, pkg.hasParticipantCard ? 'Áno' : 'Nie'),
                React.createElement('td', { className: 'py-2 px-4 border-b text-gray-700' }, pkg.meals.length > 0 ? pkg.meals.map(meal => new Date(meal.seconds * 1000).toLocaleDateString('sk-SK')).join(', ') : 'Žiadne'),
                showRefreshmentColumn && React.createElement('td', { className: 'py-2 px-4 border-b text-gray-700' }, pkg.refreshments?.length > 0 ? pkg.refreshments.map(r => r.name).join(', ') : 'Žiadne'),
                React.createElement(
                  'td',
                  { className: 'py-2 px-4 border-b text-gray-700' },
                  React.createElement(
                    'div',
                    { className: 'flex space-x-2' },
                    React.createElement(
                      'button',
                      {
                        onClick: () => handleOpenEditPackageModal(pkg),
                        className: 'text-blue-500 hover:text-blue-700 transition-colors duration-200'
                      },
                      'Upraviť'
                    ),
                    React.createElement(
                      'button',
                      {
                        onClick: () => handleOpenConfirmDeletePackageModal(pkg),
                        className: 'text-red-500 hover:text-red-700 transition-colors duration-200'
                      },
                      'Zmazať'
                    )
                  )
                )
              )
            ))
          )
        )
      ) : (
        React.createElement('p', { className: 'text-gray-500' }, 'Žiadne balíčky neboli pridané.')
      )
    ),

    React.createElement(
      'button',
      {
        onClick: handleOpenAddPackageModal,
        className: 'mt-6 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors duration-200'
      },
      'Pridať nový balíček'
    ),

    showPackageModal && React.createElement(
      'div',
      { className: 'modal' },
      React.createElement(
        'div',
        { className: 'modal-content' },
        React.createElement('h3', { className: 'text-xl font-bold mb-4' }, packageModalMode === 'add' ? 'Pridať nový balíček' : 'Upraviť balíček'),
        
        React.createElement(
          'div',
          { className: 'mb-4' },
          React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'package-name' }, 'Názov balíčka'),
          React.createElement('input', {
            type: 'text',
            id: 'package-name',
            className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
            value: newPackageName,
            onChange: (e) => setNewPackageName(e.target.value),
          })
        ),
        
        React.createElement(
          'div',
          { className: 'mb-4' },
          React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'package-price' }, 'Cena (€)'),
          React.createElement('input', {
            type: 'number',
            id: 'package-price',
            className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
            value: newPackagePrice,
            onChange: (e) => setNewPackagePrice(parseFloat(e.target.value) || 0),
          })
        ),

        React.createElement(
          'div',
          { className: 'mb-4' },
          React.createElement(
            'label', 
            { className: 'flex items-center text-gray-700 text-sm font-bold' },
            React.createElement('input', {
              type: 'checkbox',
              checked: hasParticipantCard,
              onChange: (e) => setHasParticipantCard(e.target.checked),
              className: 'form-checkbox h-5 w-5 text-blue-600 rounded-lg',
            }),
            React.createElement('span', { className: 'ml-2' }, 'Balíček obsahuje účastnícky lístok'),
          )
        ),

        // Jedlá
        React.createElement('h4', { className: 'text-lg font-bold mt-4 mb-2' }, 'Jedlá'),
        React.createElement(
          'div',
          { className: 'grid grid-cols-2 md:grid-cols-4 gap-4 mb-4' },
          tournamentDays.map(day => (
            React.createElement(
              'div',
              { key: day.toISOString().split('T')[0], className: 'flex items-center space-x-2' },
              React.createElement('input', {
                type: 'checkbox',
                checked: !!packageMeals[day.toISOString().split('T')[0]],
                onChange: () => handleMealChange(day.toISOString().split('T')[0]),
                className: 'form-checkbox h-5 w-5 text-blue-600 rounded-lg',
              }),
              React.createElement('span', { className: 'text-gray-700' }, day.toLocaleDateString('sk-SK'))
            )
          ))
        ),

        // Občerstvenie
        React.createElement('h4', { className: 'text-lg font-bold mt-4 mb-2' }, 'Občerstvenie'),
        React.createElement(
          'div',
          { className: 'grid grid-cols-1 gap-4 mb-4' },
          packageRefreshments.map((item, index) => (
            React.createElement(
              'div',
              { key: index, className: 'p-4 border border-gray-300 rounded-lg flex flex-col md:flex-row md:items-center space-y-2 md:space-y-0 md:space-x-4' },
              React.createElement('span', { className: 'font-semibold text-gray-700 w-full md:w-auto' }, item.date.toLocaleDateString('sk-SK')),
              React.createElement('div', { className: 'flex-grow' }, 
                React.createElement('input', {
                  type: 'text',
                  placeholder: 'Názov občerstvenia',
                  value: item.name,
                  onChange: (e) => handleRefreshmentChange(index, 'name', e.target.value),
                  className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                })
              ),
              React.createElement('div', { className: 'flex-grow' },
                React.createElement('input', {
                  type: 'number',
                  placeholder: 'Cena (€)',
                  value: item.price,
                  onChange: (e) => handleRefreshmentChange(index, 'price', parseFloat(e.target.value) || 0),
                  className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                  min: 0,
                })
              )
            )
          ))
        ),
        
        // Tlačidlá
        React.createElement(
          'div',
          { className: 'flex justify-end space-x-3' },
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
        React.createElement('p', { className: 'text-gray-700 mb-6' }, `Naozaj chcete zmazať balíček \"${packageToDelete?.name}\" (cena: ${packageToDelete?.price} €)?`),
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
