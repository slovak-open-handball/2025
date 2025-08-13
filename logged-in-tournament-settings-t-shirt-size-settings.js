import { doc, onSnapshot, setDoc, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Funkcie showNotification a sendAdminNotification sa očakávajú ako props z nadradeného komponentu.
// Preto ich tu neimportujeme ani nedefinujeme.

export function TShirtSizeSettings({ db, userProfileData, showNotification, sendAdminNotification }) {
  const [tshirtSizes, setTshirtSizes] = React.useState([]);
  const [showSizeModal, setShowSizeModal] = React.useState(false);
  const [currentSizeEdit, setCurrentSizeEdit] = React.useState(null); 
  const [newSizeValue, setNewSizeValue] = React.useState('');
  const [modalMode, setModalMode] = React.useState('add'); 

  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = React.useState(false);
  const [sizeToDelete, setSizeToDelete] = React.useState(null);

  React.useEffect(() => {
    let unsubscribeTshirtSizes;
    const fetchTshirtSizes = async () => {
      if (!db || !userProfileData || userProfileData.role !== 'admin') {
        return;
      }

      try {
        const tshirtSizesDocRef = doc(db, 'settings', 'sizeTshirts');
        unsubscribeTshirtSizes = onSnapshot(tshirtSizesDocRef, docSnapshot => {
          if (docSnapshot.exists()) {
            const data = docSnapshot.data();
            setTshirtSizes(data.sizes || []);
          } else {
            setDoc(tshirtSizesDocRef, {
              sizes: [
                '134 - 140',
                '146 - 152',
                '158 - 164',
                'XS',
                'S',
                'M',
                'L',
                'XL',
                'XXL',
                'XXXL'
              ]
            }).then(() => {
              // Notifikácia pri úspešnom vytvorení predvolených veľkostí
              if (typeof showNotification === 'function') {
                showNotification("Predvolené veľkosti tričiek boli vytvorené.", 'success');
              }
            }).catch(e => {
              if (typeof showNotification === 'function') {
                showNotification(`Chyba pri vytváraní predvolených veľkostí tričiek: ${e.message}`, 'error');
              } else {
                console.error("Chyba pri vytváraní predvolených veľkostí tričiek a showNotification nie je funkcia:", e);
              }
            });
            setTshirtSizes([]); 
          }
        }, error => {
          if (typeof showNotification === 'function') {
            showNotification(`Chyba pri načítaní veľkostí tričiek: ${error.message}`, 'error');
          } else {
            console.error("Chyba pri načítaní veľkostí tričiek a showNotification nie je funkcia:", error);
          }
        });

        return () => {
          if (unsubscribeTshirtSizes) {
            unsubscribeTshirtSizes();
          }
        };
      } catch (e) {
        if (typeof showNotification === 'function') {
          showNotification(`Chyba pri nastavovaní poslucháča pre veľkosti tričiek: ${e.message}`, 'error');
        } else {
          console.error("Chyba pri nastavovaní poslucháča pre veľkosti tričiek a showNotification nie je funkcia:", e);
        }
      }
    };

    fetchTshirtSizes();
  }, [db, userProfileData, showNotification]); // Zabezpečujeme re-render ak sa zmení showNotification (ak by sa menilo)

  const handleOpenAddSizeModal = () => {
    setModalMode('add');
    setNewSizeValue('');
    setCurrentSizeEdit(null);
    setShowSizeModal(true);
  };

  const handleOpenEditSizeModal = (size) => {
    setModalMode('edit');
    setNewSizeValue(size);
    setCurrentSizeEdit(size);
    setShowSizeModal(true);
  };

  const handleCloseSizeModal = () => {
    setShowSizeModal(false);
    setNewSizeValue('');
    setCurrentSizeEdit(null);
    setModalMode('add');
  };

  const handleSaveSize = async () => {
    // Obranná kontrola
    if (typeof showNotification !== 'function') {
        console.error("DEBUG: showNotification prop is not a function in handleSaveSize!");
        return; 
    }
    if (typeof sendAdminNotification !== 'function') {
        console.error("DEBUG: sendAdminNotification prop is not a function in handleSaveSize!");
    }

    if (!db || !userProfileData || userProfileData.role !== 'admin') {
      showNotification("Nemáte oprávnenie na zmenu nastavení veľkostí tričiek.", 'error');
      return;
    }

    const trimmedNewSize = newSizeValue.trim();
    if (!trimmedNewSize) {
      showNotification("Názov veľkosti nemôže byť prázdny.", 'error');
      return;
    }

    const tshirtSizesDocRef = doc(db, 'settings', 'sizeTshirts');

    try {
      if (modalMode === 'add') {
        if (tshirtSizes.includes(trimmedNewSize)) {
          showNotification(`Veľkosť "${trimmedNewSize}" už existuje.`, 'error');
          return;
        }
        await updateDoc(tshirtSizesDocRef, {
          sizes: arrayUnion(trimmedNewSize)
        });
        showNotification(`Veľkosť "${trimmedNewSize}" úspešne pridaná!`, 'success');
        if (typeof sendAdminNotification === 'function') {
            await sendAdminNotification({ type: 'createSize', data: { newSizeValue: trimmedNewSize } });
        }
      } else if (modalMode === 'edit') {
        if (trimmedNewSize !== currentSizeEdit && tshirtSizes.includes(trimmedNewSize)) {
            showNotification(`Veľkosť "${trimmedNewSize}" už existuje.`, 'error');
            return;
        }
        await updateDoc(tshirtSizesDocRef, {
          sizes: arrayRemove(currentSizeEdit)
        });
        await updateDoc(tshirtSizesDocRef, {
          sizes: arrayUnion(trimmedNewSize)
        });
        showNotification(`Veľkosť "${currentSizeEdit}" úspešne zmenená na "${trimmedNewSize}"!`, 'success');
        if (typeof sendAdminNotification === 'function') {
            await sendAdminNotification({ type: 'editSize', data: { originalSize: currentSizeEdit, newSizeValue: trimmedNewSize } });
        }
      }
      handleCloseSizeModal();
    } catch (e) {
      showNotification(`Chyba pri ukladaní veľkosti trička: ${e.message}`, 'error');
    }
  };

  const handleOpenConfirmDeleteModal = (size) => {
    setSizeToDelete(size);
    setShowConfirmDeleteModal(true);
  };

  const handleCloseConfirmDeleteModal = () => {
    setShowConfirmDeleteModal(false);
    setSizeToDelete(null);
  };

  const handleDeleteSize = async () => {
    // Obranná kontrola (toto je riadok 160, ak je kód nekomprimovaný)
    if (typeof showNotification !== 'function') {
        console.error("DEBUG: showNotification prop is not a function in handleDeleteSize!");
        // Ak showNotification nie je funkcia, aspoň zalogujeme chybu
        console.error("Chyba: Nemáte oprávnenie na zmazanie veľkosti trička (showNotification not available).");
        return; // Zastaví ďalšie vykonávanie funkcie
    }
    if (typeof sendAdminNotification !== 'function') {
        console.error("DEBUG: sendAdminNotification prop is not a function in handleDeleteSize!");
    }


    if (!db || !userProfileData || userProfileData.role !== 'admin') {
      showNotification("Nemáte oprávnenie na zmazanie veľkosti trička.", 'error');
      return;
    }
    if (!sizeToDelete) return;

    try {
      const tshirtSizesDocRef = doc(db, 'settings', 'sizeTshirts');
      await updateDoc(tshirtSizesDocRef, {
        sizes: arrayRemove(sizeToDelete)
      });
      showNotification(`Veľkosť "${sizeToDelete}" úspešne zmazaná!`, 'success');
      if (typeof sendAdminNotification === 'function') {
        await sendAdminNotification({ type: 'deleteSize', data: { deletedSize: sizeToDelete } });
      }
      handleCloseConfirmDeleteModal();
    } catch (e) {
      showNotification(`Chyba pri mazaní veľkosti trička: ${e.message}`, 'error');
    }
  };

  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
        'div',
        { className: 'space-y-4 p-6 border border-gray-200 rounded-lg shadow-sm mt-8' }, 
        React.createElement('h2', { className: 'text-2xl font-semibold text-gray-700 mb-4' }, 'Nastavenia veľkostí tričiek'),
        React.createElement(
            'div',
            { className: 'space-y-3' }, 
            tshirtSizes.length > 0 ? (
                tshirtSizes.map((size, index) => (
                    React.createElement(
                        'div',
                        { key: size, className: 'flex justify-between items-center bg-gray-50 p-3 rounded-md shadow-sm' },
                        React.createElement('span', { className: 'text-gray-800 font-medium' }, size),
                        React.createElement(
                            'div',
                            { className: 'flex space-x-2' },
                            React.createElement(
                                'button',
                                {
                                    type: 'button',
                                    onClick: () => handleOpenEditSizeModal(size),
                                    className: 'bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-bold py-1 px-3 rounded-lg transition-colors duration-200 focus:outline-none focus:shadow-outline'
                                },
                                'Upraviť'
                            ),
                            React.createElement(
                                'button',
                                {
                                    type: 'button',
                                    onClick: () => handleOpenConfirmDeleteModal(size),
                                    className: 'bg-red-500 hover:bg-red-600 text-white text-sm font-bold py-1 px-3 rounded-lg transition-colors duration-200 focus:outline-none focus:shadow-outline'
                                },
                                'Vymazať'
                            )
                        )
                    )
                ))
            ) : (
                React.createElement('p', { className: 'text-gray-500 text-center' }, 'Zatiaľ nie sú definované žiadne veľkosti tričiek.')
            )
        ),
        React.createElement(
            'div',
            { className: 'flex justify-center mt-4' }, 
            React.createElement(
                'button',
                {
                    type: 'button',
                    onClick: handleOpenAddSizeModal,
                    className: 'bg-green-500 hover:bg-green-600 text-white font-bold p-3 rounded-full shadow-lg transition-colors duration-200 focus:outline-none focus:shadow-outline w-12 h-12 flex items-center justify-center' 
                },
                React.createElement('span', { className: 'text-xl' }, '+')
            )
        )
    ),

    showSizeModal && React.createElement(
      'div',
      { className: 'modal' },
      React.createElement(
        'div',
        { className: 'modal-content' },
        React.createElement('h3', { className: 'text-xl font-bold mb-4' }, modalMode === 'add' ? 'Pridať novú veľkosť' : `Upraviť veľkosť: ${currentSizeEdit}`),
        React.createElement(
          'input',
          {
            type: 'text',
            className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 mb-4',
            placeholder: 'Zadajte názov veľkosti (napr. S, M, 134-140)',
            value: newSizeValue,
            onChange: (e) => setNewSizeValue(e.target.value),
          }
        ),
        React.createElement(
          'div',
          { className: 'flex justify-end space-x-3' },
          React.createElement(
            'button',
            {
              type: 'button',
              onClick: handleCloseSizeModal,
              className: 'bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200'
            },
            'Zrušiť'
          ),
          React.createElement(
            'button',
            {
              type: 'button',
              onClick: handleSaveSize,
              className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200'
            },
            modalMode === 'add' ? 'Pridať' : 'Uložiť'
          )
        )
      )
    ),

    showConfirmDeleteModal && React.createElement(
      'div',
      { className: 'modal' },
      React.createElement(
        'div',
        { className: 'modal-content' },
        React.createElement('h3', { className: 'text-xl font-bold mb-4' }, 'Potvrdiť zmazanie'),
        React.createElement('p', { className: 'text-gray-700 mb-6' }, `Naozaj chcete zmazať veľkosť "${sizeToDelete}"?`),
        React.createElement(
          'div',
          { className: 'flex justify-end space-x-3' },
          React.createElement(
            'button',
            {
              type: 'button',
              onClick: handleCloseConfirmDeleteModal,
              className: 'bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200'
            },
            'Zrušiť'
          ),
          React.createElement(
            'button',
            {
              type: 'button',
              onClick: handleDeleteSize,
              className: 'bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200'
            },
            'Zmazať'
          )
        )
      )
    )
  );
}
