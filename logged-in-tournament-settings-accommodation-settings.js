import { doc, onSnapshot, setDoc, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Importovanie pomocných funkcií z hlavného súboru
const showNotification = window.showNotification;
const sendAdminNotification = window.sendAdminNotification;


export function AccommodationSettings({ db, userProfileData }) {
  const [accommodations, setAccommodations] = React.useState([]);
  const [showAccommodationModal, setShowAccommodationModal] = React.useState(false);
  const [currentAccommodationEdit, setCurrentAccommodationEdit] = React.useState(null); 
  const [newAccommodationType, setNewAccommodationType] = React.useState('');
  const [newAccommodationCapacity, setNewAccommodationCapacity] = React.useState(0);
  const [accommodationModalMode, setAccommodationModalMode] = React.useState('add'); 
  const [showConfirmDeleteAccommodationModal, setShowConfirmDeleteAccommodationModal] = React.useState(false);
  const [accommodationToDelete, setAccommodationToDelete] = React.useState(null);

  React.useEffect(() => {
    let unsubscribeAccommodation;
    const fetchAccommodation = async () => {
      if (!db || !userProfileData || userProfileData.role !== 'admin') {
        return;
      }

      try {
        const accommodationDocRef = doc(db, 'settings', 'accommodation');
        unsubscribeAccommodation = onSnapshot(accommodationDocRef, docSnapshot => {
          if (docSnapshot.exists()) {
            const data = docSnapshot.data();
            setAccommodations(data.types || []); 
          } else {
            setDoc(accommodationDocRef, {
              types: []
            }).then(() => {
            }).catch(e => {
              showNotification(`Chyba pri vytváraní predvolených typov ubytovania: ${e.message}`, 'error');
            });
            setAccommodations([]); 
          }
        }, error => {
          showNotification(`Chyba pri načítaní ubytovania: ${error.message}`, 'error');
        });

        return () => {
          if (unsubscribeAccommodation) {
            unsubscribeAccommodation();
          }
        };
      } catch (e) {
        showNotification(`Chyba pri nastavovaní poslucháča pre ubytovanie: ${e.message}`, 'error');
      }
    };

    fetchAccommodation();
  }, [db, userProfileData]);

  const handleOpenAddAccommodationModal = () => {
    setAccommodationModalMode('add');
    setNewAccommodationType('');
    setNewAccommodationCapacity(0);
    setCurrentAccommodationEdit(null);
    setShowAccommodationModal(true);
  };

  const handleOpenEditAccommodationModal = (accommodation) => {
    setAccommodationModalMode('edit');
    setNewAccommodationType(accommodation.type);
    setNewAccommodationCapacity(accommodation.capacity);
    setCurrentAccommodationEdit(accommodation);
    setShowAccommodationModal(true);
  };

  const handleCloseAccommodationModal = () => {
    setShowAccommodationModal(false);
    setNewAccommodationType('');
    setNewAccommodationCapacity(0);
    setCurrentAccommodationEdit(null);
    setAccommodationModalMode('add');
  };

  const handleSaveAccommodation = async () => {
    if (!db || !userProfileData || userProfileData.role !== 'admin') {
      showNotification("Nemáte oprávnenie na zmenu nastavení ubytovania.", 'error');
      return;
    }

    const trimmedType = newAccommodationType.trim();
    if (!trimmedType) {
      showNotification("Názov typu ubytovania nemôže byť prázdny.", 'error');
      return;
    }
    if (newAccommodationCapacity < 0) {
      showNotification("Kapacita ubytovania nemôže byť záporná.", 'error');
      return;
    }

    const accommodationDocRef = doc(db, 'settings', 'accommodation');

    try {
      if (accommodationModalMode === 'add') {
        if (accommodations.some(acc => acc.type === trimmedType)) {
          showNotification(`Typ ubytovania "${trimmedType}" už existuje.`, 'error');
          return;
        }
        await updateDoc(accommodationDocRef, {
          types: arrayUnion({ type: trimmedType, capacity: newAccommodationCapacity })
        });
        showNotification(`Typ ubytovania "${trimmedType}" úspešne pridaný!`, 'success');
        await sendAdminNotification({ type: 'createAccommodation', data: { type: trimmedType, capacity: newAccommodationCapacity } });
      } else if (accommodationModalMode === 'edit') {
        if (trimmedType !== currentAccommodationEdit.type && accommodations.some(acc => acc.type === trimmedType)) {
            showNotification(`Typ ubytovania "${trimmedType}" už existuje.`, 'error');
            return;
        }
        await updateDoc(accommodationDocRef, {
          types: arrayRemove(currentAccommodationEdit)
        });
        await updateDoc(accommodationDocRef, {
          types: arrayUnion({ type: trimmedType, capacity: newAccommodationCapacity })
        });
        showNotification(`Typ ubytovania "${currentAccommodationEdit.type}" úspešne zmenený na "${trimmedType}"!`, 'success');
        await sendAdminNotification({ type: 'editAccommodation', data: { originalType: currentAccommodationEdit.type, originalCapacity: currentAccommodationEdit.capacity, newType: trimmedType, newCapacity: newAccommodationCapacity } });
      }
      handleCloseAccommodationModal();
    } catch (e) {
      showNotification(`Chyba pri ukladaní ubytovania: ${e.message}`, 'error');
    }
  };

  const handleOpenConfirmDeleteAccommodationModal = (accommodation) => {
    setAccommodationToDelete(accommodation);
    setShowConfirmDeleteAccommodationModal(true);
  };

  const handleCloseConfirmDeleteAccommodationModal = () => {
    setShowConfirmDeleteAccommodationModal(false);
    setAccommodationToDelete(null);
  };

  const handleDeleteAccommodation = async () => {
    if (!db || !userProfileData || userProfileData.role !== 'admin') {
      showNotification("Nemáte oprávnenie na zmazanie ubytovania.", 'error');
      return;
    }
    if (!accommodationToDelete) return;

    try {
      const accommodationDocRef = doc(db, 'settings', 'accommodation');
      await updateDoc(accommodationDocRef, {
        types: arrayRemove(accommodationToDelete)
      });
      showNotification(`Typ ubytovania "${accommodationToDelete.type}" úspešne zmazaný!`, 'success');
      await sendAdminNotification({ type: 'deleteAccommodation', data: { deletedType: accommodationToDelete.type, deletedCapacity: accommodationToDelete.capacity } });
      handleCloseConfirmDeleteAccommodationModal();
    } catch (e) {
      showNotification(`Chyba pri mazaní ubytovania: ${e.message}`, 'error');
    }
  };

  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
        'div',
        { className: 'space-y-4 p-6 border border-gray-200 rounded-lg shadow-sm mt-8' }, 
        React.createElement('h2', { className: 'text-2xl font-semibold text-gray-700 mb-4' }, 'Nastavenia ubytovania'),
        React.createElement(
            'div',
            { className: 'space-y-3' }, 
            accommodations.length > 0 ? (
                accommodations.map((acc, index) => (
                    React.createElement(
                        'div',
                        { key: acc.type, className: 'flex justify-between items-center bg-gray-50 p-3 rounded-md shadow-sm' },
                        React.createElement('span', { className: 'text-gray-800 font-medium' }, `${acc.type} (Kapacita: ${acc.capacity})`),
                        React.createElement(
                            'div',
                            { className: 'flex space-x-2' },
                            React.createElement(
                                'button',
                                {
                                    type: 'button',
                                    onClick: () => handleOpenEditAccommodationModal(acc),
                                    className: 'bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-bold py-1 px-3 rounded-lg transition-colors duration-200 focus:outline-none focus:shadow-outline'
                                },
                                'Upraviť'
                            ),
                            React.createElement(
                                'button',
                                {
                                    type: 'button',
                                    onClick: () => handleOpenConfirmDeleteAccommodationModal(acc),
                                    className: 'bg-red-500 hover:bg-red-600 text-white text-sm font-bold py-1 px-3 rounded-lg transition-colors duration-200 focus:outline-none focus:shadow-outline'
                                },
                                'Vymazať'
                            )
                        )
                    )
                ))
            ) : (
                React.createElement('p', { className: 'text-gray-500 text-center' }, 'Zatiaľ nie sú definované žiadne typy ubytovania.')
            )
        ),
        React.createElement(
            'div',
            { className: 'flex justify-center mt-4' }, 
            React.createElement(
                'button',
                {
                    type: 'button',
                    onClick: handleOpenAddAccommodationModal,
                    className: 'bg-green-500 hover:bg-green-600 text-white font-bold p-3 rounded-full shadow-lg transition-colors duration-200 focus:outline-none focus:shadow-outline w-12 h-12 flex items-center justify-center'
                },
                React.createElement('span', { className: 'text-xl' }, '+')
            )
        )
    ),

    showAccommodationModal && React.createElement(
      'div',
      { className: 'modal' },
      React.createElement(
        'div',
        { className: 'modal-content' },
        React.createElement('h3', { className: 'text-xl font-bold mb-4' }, accommodationModalMode === 'add' ? 'Pridať nový typ ubytovania' : `Upraviť typ ubytovania: ${currentAccommodationEdit?.type}`),
        React.createElement(
          'input',
          {
            type: 'text',
            className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 mb-4',
            placeholder: 'Zadajte typ ubytovania (napr. Hotel, Škola)',
            value: newAccommodationType,
            onChange: (e) => setNewAccommodationType(e.target.value),
          }
        ),
        React.createElement(
            'input',
            {
              type: 'number',
              className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 mb-4',
              placeholder: 'Zadajte kapacitu',
              value: newAccommodationCapacity,
              onChange: (e) => setNewAccommodationCapacity(parseInt(e.target.value) || 0), 
              min: 0,
            }
          ),
        React.createElement(
          'div',
          { className: 'flex justify-end space-x-3' },
          React.createElement(
            'button',
            {
              type: 'button',
              onClick: handleCloseAccommodationModal,
              className: 'bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200'
            },
            'Zrušiť'
          ),
          React.createElement(
            'button',
            {
              type: 'button',
              onClick: handleSaveAccommodation,
              className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200'
            },
            accommodationModalMode === 'add' ? 'Pridať' : 'Uložiť'
          )
        )
      )
    ),

    showConfirmDeleteAccommodationModal && React.createElement(
      'div',
      { className: 'modal' },
      React.createElement(
        'div',
        { className: 'modal-content' },
        React.createElement('h3', { className: 'text-xl font-bold mb-4' }, 'Potvrdiť zmazanie'),
        React.createElement('p', { className: 'text-gray-700 mb-6' }, `Naozaj chcete zmazať typ ubytovania "${accommodationToDelete?.type}" (kapacita: ${accommodationToDelete?.capacity})?`),
        React.createElement(
          'div',
          { className: 'flex justify-end space-x-3' },
          React.createElement(
            'button',
            {
              type: 'button',
              onClick: handleCloseConfirmDeleteAccommodationModal,
              className: 'bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200'
            },
            'Zrušiť'
          ),
          React.createElement(
            'button',
            {
              type: 'button',
              onClick: handleDeleteAccommodation,
              className: 'bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200'
            },
            'Zmazať'
          )
        )
      )
    )
  );
}
