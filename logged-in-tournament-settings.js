import { getFirestore, doc, onSnapshot, setDoc, Timestamp, updateDoc, arrayUnion, arrayRemove, getDoc, collection, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";


const formatToDatetimeLocal = (date) => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const formatDateForDisplay = (dateOrTimestamp) => {
  let date;
  if (!dateOrTimestamp) return 'nezadané';
  
  // Pridana kontrola pre Firebase Timestamp
  if (dateOrTimestamp instanceof Timestamp) {
    date = dateOrTimestamp.toDate();
  } else if (dateOrTimestamp instanceof Date) {
    date = dateOrTimestamp;
  } else {
    // Ak to nie je ani Timestamp, ani Date, je to neplatný vstup
    return 'nezadané';
  }

  // Dôležitá kontrola: Overenie, či je objekt Date platný (nie "Invalid Date")
  if (isNaN(date.getTime())) {
      return 'nezadané';
  }

  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  return `${day}. ${month}. ${year} ${hours}:${minutes} hod.`;
};

const showNotification = (message, type = 'success') => {
    let notificationElement = document.getElementById('global-notification'); 
    
    if (!notificationElement) {
        notificationElement = document.createElement('div');
        notificationElement.id = 'global-notification';
        document.body.appendChild(notificationElement);
    }

    const baseClasses = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[99999] transition-all duration-500 ease-in-out transform';
    let typeClasses = '';

    if (type === 'success') {
        typeClasses = 'bg-green-500 text-white';
    } else if (type === 'error') {
        typeClasses = 'bg-red-500 text-white';
    } else {
        typeClasses = 'bg-blue-500 text-white';
    }

    notificationElement.className = `${baseClasses} ${typeClasses} opacity-0 scale-95`;
    notificationElement.textContent = message;

    setTimeout(() => {
        notificationElement.classList.add('opacity-100', 'scale-100', 'pointer-events-auto');
    }, 10);

    setTimeout(() => {
        notificationElement.classList.remove('opacity-100', 'scale-100', 'pointer-events-auto');
    }, 5000);
};


function TournamentSettingsApp() {
  const auth = getAuth(); 
  const db = getFirestore();     

  const [user, setUser] = React.useState(null); 
  const [userProfileData, setUserProfileData] = React.useState(null); 
  const [isAuthReady, setIsAuthReady] = React.useState(false); 

  const [registrationStartDate, setRegistrationStartDate] = React.useState('');
  const [registrationEndDate, setRegistrationEndDate] = React.useState('');
  const [dataEditDeadline, setDataEditDeadline] = React.useState(''); 
  const [rosterEditDeadline, setRosterEditDeadline] = React.useState(''); 
  const [numberOfPlayers, setNumberOfPlayers] = React.useState(0);
  const [numberOfImplementationTeam, setNumberOfImplementationTeam] = React.useState(0);
  // NOVINKA: Stavy pre dátum začiatku a konca turnaja
  const [tournamentStartDate, setTournamentStartDate] = React.useState('');
  const [tournamentEndDate, setTournamentEndDate] = React.useState('');

  const [tshirtSizes, setTshirtSizes] = React.useState([]);
  const [showSizeModal, setShowSizeModal] = React.useState(false);
  const [currentSizeEdit, setCurrentSizeEdit] = React.useState(null); 
  const [newSizeValue, setNewSizeValue] = React.useState('');
  const [modalMode, setModalMode] = React.useState('add'); 

  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = React.useState(false);
  const [sizeToDelete, setSizeToDelete] = React.useState(null);

  const [accommodations, setAccommodations] = React.useState([]);
  const [showAccommodationModal, setShowAccommodationModal] = React.useState(false);
  const [currentAccommodationEdit, setCurrentAccommodationEdit] = React.useState(null); 
  const [newAccommodationType, setNewAccommodationType] = React.useState('');
  const [newAccommodationCapacity, setNewAccommodationCapacity] = React.useState(0);
  const [accommodationModalMode, setAccommodationModalMode] = React.useState('add'); 
  const [showConfirmDeleteAccommodationModal, setShowConfirmDeleteAccommodationModal] = React.useState(false);
  const [accommodationToDelete, setAccommodationToDelete] = React.useState(null);


  const isRegistrationOpen = React.useMemo(() => {
    const now = new Date();
    const regStart = registrationStartDate ? new Date(registrationStartDate) : null;
    const regEnd = registrationEndDate ? new Date(registrationEndDate) : null;

    const isRegStartValid = regStart instanceof Date && !isNaN(regStart);
    const isRegEndValid = regEnd instanceof Date && !isNaN(regEnd);

    return (isRegStartValid ? now >= regStart : true) && (isRegEndValid ? now <= regEnd : true);
  }, [registrationStartDate, registrationEndDate]);

  const isFrozenForEditing = React.useMemo(() => {
    const now = new Date();
    const regStart = registrationStartDate ? new Date(registrationStartDate) : null;
    return regStart instanceof Date && !isNaN(regStart) && now >= regStart;
  }, [registrationStartDate]);


  React.useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(currentUser => {
      setUser(currentUser);
      setIsAuthReady(true); 
      if (!currentUser) {
        window.location.href = 'login.html';
      }
    });

    const handleGlobalDataUpdated = (event) => {
      setUserProfileData(event.detail);
    };
    window.addEventListener('globalDataUpdated', handleGlobalDataUpdated);

    if (window.isGlobalAuthReady) {
        setIsAuthReady(true);
        setUser(auth.currentUser);
        if (window.globalUserProfileData) {
            setUserProfileData(window.globalUserProfileData);
        }
    }

    return () => {
      unsubscribeAuth();
      window.removeEventListener('globalDataUpdated', handleGlobalDataUpdated);
    };
  }, [auth]); 

  React.useEffect(() => {
    let unsubscribeUserDoc;

    if (user && db && isAuthReady) {

      try {
        const userDocRef = doc(db, 'users', user.uid);
        unsubscribeUserDoc = onSnapshot(userDocRef, docSnapshot => {
          if (docSnapshot.exists()) {
            const userData = docSnapshot.data();

            if (userData.role !== 'admin') {
                window.location.href = 'logged-in-my-data.html';
                return; 
            }

            setUserProfileData(userData); 
          } else {
            showNotification("Chyba: Používateľský profil sa nenašiel. Skúste sa prosím znova prihlásiť.", 'error'); 
            auth.signOut(); 
            setUser(null);
            setUserProfileData(null);
          }
        }, error => {
          showNotification(`Chyba pri načítaní používateľských dát: ${error.message}`, 'error'); 
          auth.signOut();
          setUser(null);
          setUserProfileData(null);
        });
      } catch (e) {
        showNotification(`Chyba pri nastavovaní poslucháča pre používateľské dáta: ${e.message}`, 'error'); 
        auth.signOut();
        setUser(null);
        setUserProfileData(null);
      }
    } 
    else if (isAuthReady && user === null) {
    }

    return () => {
      if (unsubscribeUserDoc) {
        unsubscribeUserDoc();
      }
    };
  }, [user, db, isAuthReady, auth]);

  React.useEffect(() => {
    let unsubscribeSettings;
    const fetchSettings = async () => {
      if (!db || !userProfileData || userProfileData.role !== 'admin') {
        return; 
      }
      try {
          const settingsDocRef = doc(db, 'settings', 'registration');
          unsubscribeSettings = onSnapshot(settingsDocRef, docSnapshot => {
            if (docSnapshot.exists()) {
                const data = docSnapshot.data();
                setRegistrationStartDate(data.registrationStartDate ? formatToDatetimeLocal(data.registrationStartDate.toDate()) : '');
                setRegistrationEndDate(data.registrationEndDate ? formatToDatetimeLocal(data.registrationEndDate.toDate()) : '');
                setDataEditDeadline(data.dataEditDeadline ? formatToDatetimeLocal(data.dataEditDeadline.toDate()) : ''); 
                setRosterEditDeadline(data.rosterEditDeadline ? formatToDatetimeLocal(data.rosterEditDeadline.toDate()) : ''); 
                setNumberOfPlayers(data.numberOfPlayers || 0);
                setNumberOfImplementationTeam(data.numberOfImplementationTeam || 0);
                // NOVINKA: Načítanie dátumu začiatku a konca turnaja
                setTournamentStartDate(data.tournamentStart ? formatToDatetimeLocal(data.tournamentStart.toDate()) : '');
                setTournamentEndDate(data.tournamentEnd ? formatToDatetimeLocal(data.tournamentEnd.toDate()) : '');

            } else {
                setRegistrationStartDate('');
                setRegistrationEndDate('');
                setDataEditDeadline(''); 
                setRosterEditDeadline(''); 
                setNumberOfPlayers(0);
                setNumberOfImplementationTeam(0);
                // NOVINKA: Inicializácia dátumu začiatku a konca turnaja, ak neexistujú
                setTournamentStartDate('');
                setTournamentEndDate('');
            }
          }, error => {
            showNotification(`Chyba pri načítaní nastavení: ${error.message}`, 'error'); 
          });

          return () => {
            if (unsubscribeSettings) {
                unsubscribeSettings();
            }
          };
      } catch (e) {
          showNotification(`Chyba pri nastavovaní poslucháča pre nastavenia: ${e.message}`, 'error'); 
      }
    };

    fetchSettings();
  }, [db, userProfileData]); 

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
            }).catch(e => {
              showNotification(`Chyba pri vytváraní predvolených veľkostí tričiek: ${e.message}`, 'error');
            });
            setTshirtSizes([]); 
          }
        }, error => {
          showNotification(`Chyba pri načítaní veľkostí tričiek: ${error.message}`, 'error');
        });

        return () => {
          if (unsubscribeTshirtSizes) {
            unsubscribeTshirtSizes();
          }
        };
      } catch (e) {
        showNotification(`Chyba pri nastavovaní poslucháča pre veľkosti tričiek: ${e.message}`, 'error');
      }
    };

    fetchTshirtSizes();
  }, [db, userProfileData]);

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

  const sendAdminNotification = async (notificationData) => {
    if (!db || !user || !user.email) { 
      return;
    }
    try {
      const notificationsCollectionRef = collection(db, 'notifications');
      let changesMessage = '';
      const userEmail = user.email;

      if (notificationData.type === 'createSize') {
        changesMessage = `Vytvorenie novej veľkosti trička: '''${notificationData.data.newSizeValue}'`;
      } else if (notificationData.type === 'editSize') {
        changesMessage = `Zmena veľkosti trička z: '${notificationData.data.originalSize}' na '${notificationData.data.newSizeValue}'`;
      } else if (notificationData.type === 'deleteSize') {
        changesMessage = `Zmazanie veľkosti trička: '''${notificationData.data.deletedSize}'`;
      } else if (notificationData.type === 'updateSettings') {
        changesMessage = `${notificationData.data.changesMade}`; 
      } else if (notificationData.type === 'createAccommodation') { 
        changesMessage = `Vytvorenie typu ubytovania: '${notificationData.data.type}' s kapacitou '${notificationData.data.capacity}'`;
      } else if (notificationData.type === 'editAccommodation') { 
        changesMessage = `Zmena ubytovania z: '${notificationData.data.originalType}' (kapacita: ${notificationData.data.originalCapacity}) na '${notificationData.data.newType}' (kapacita: ${notificationData.data.newCapacity})`;
      } else if (notificationData.type === 'deleteAccommodation') { 
        changesMessage = `Zmazanie typu ubytovania: '${notificationData.data.deletedType}' (kapacita: ${notificationData.data.deletedCapacity})`;
      }

      await addDoc(notificationsCollectionRef, {
        userEmail: userEmail,
        changes: changesMessage,
        timestamp: Timestamp.fromDate(new Date()),
        recipientId: 'all_admins'
      });
    } catch (e) {
      showNotification(`Chyba pri ukladaní notifikácie pre administrátorov: ${e.message}`, 'error');
    }
  };


  const handleUpdateRegistrationSettings = async (e) => {
    e.preventDefault();
    if (!db || !userProfileData || userProfileData.role !== 'admin' || !user) {
      showNotification("Nemáte oprávnenie na zmenu nastavení registrácie.", 'error'); 
      return;
    }
    
    try {
      const regStart = registrationStartDate ? new Date(registrationStartDate) : null;
      const regEnd = registrationEndDate ? new Date(registrationEndDate) : null;
      const dataEditDead = dataEditDeadline ? new Date(dataEditDeadline) : null; 
      const rosterEditDead = rosterEditDeadline ? new Date(rosterEditDeadline) : null; 
      // NOVINKA: Konverzia dátumu začiatku a konca turnaja na Date objekty
      const tourStart = tournamentStartDate ? new Date(tournamentStartDate) : null;
      const tourEnd = tournamentEndDate ? new Date(tournamentEndDate) : null;

      if (regStart && regEnd && regStart >= regEnd) {
        showNotification("Dátum začiatku registrácie musí byť pred dátumom konca registrácie.", 'error'); 
        return;
      }
      if (dataEditDead && regEnd && dataEditDead < regEnd) {
        showNotification("Dátum uzávierky úprav dát nemôže byť pred dátumom konca registrácie.", 'error'); 
        return;
      }
      if (rosterEditDead && dataEditDead && rosterEditDead < dataEditDead) {
        showNotification("Dátum uzávierky úprav súpisiek nemôže byť pred dátumom uzávierky úprav používateľských dát.", 'error');
        return;
      }
      // NOVINKA: Validácia pre dátumy turnaja
      if (tourStart && tourEnd && tourStart >= tourEnd) {
        showNotification("Dátum začiatku turnaja musí byť pred dátumom konca turnaja.", 'error');
        return;
      }


      if (numberOfPlayers < 0) {
        showNotification("Počet hráčov nemôže byť záporný.", 'error');
        return;
      }
      if (numberOfImplementationTeam < 0) {
        showNotification("Počet členov realizačného tímu nemôže byť záporný.", 'error');
        return;
      }

      const settingsDocRef = doc(db, 'settings', 'registration');
      const oldSettingsDoc = await getDoc(settingsDocRef);
      const oldData = oldSettingsDoc.exists() ? oldSettingsDoc.data() : {};
      let changes = [];

      if ((oldData.registrationStartDate ? oldData.registrationStartDate.toMillis() : null) !== (regStart ? Timestamp.fromDate(regStart).toMillis() : null)) {
          changes.push(`Dátum začiatku registrácie z '${formatDateForDisplay(oldData.registrationStartDate)}' na '${formatDateForDisplay(regStart)}'`);
      }
      if ((oldData.registrationEndDate ? oldData.registrationEndDate.toMillis() : null) !== (regEnd ? Timestamp.fromDate(regEnd).toMillis() : null)) {
          changes.push(`Dátum konca registrácie z '${formatDateForDisplay(oldData.registrationEndDate)}' na '${formatDateForDisplay(regEnd)}'`);
      }
      if ((oldData.dataEditDeadline ? oldData.dataEditDeadline.toMillis() : null) !== (dataEditDead ? Timestamp.fromDate(dataEditDead).toMillis() : null)) {
          changes.push(`Uzávierka úprav dát z '${formatDateForDisplay(oldData.dataEditDeadline)}' na '${formatDateForDisplay(dataEditDead)}'`);
      }
      if ((oldData.rosterEditDeadline ? oldData.rosterEditDeadline.toMillis() : null) !== (rosterEditDead ? Timestamp.fromDate(rosterEditDead).toMillis() : null)) {
          changes.push(`Uzávierka úprav súpisiek z '${formatDateForDisplay(oldData.rosterEditDeadline)}' na '${formatDateForDisplay(rosterEditDead)}'`);
      }
      // NOVINKA: Sledovanie zmien pre dátumy turnaja
      if ((oldData.tournamentStart ? oldData.tournamentStart.toMillis() : null) !== (tourStart ? Timestamp.fromDate(tourStart).toMillis() : null)) {
          changes.push(`Dátum začiatku turnaja z '${formatDateForDisplay(oldData.tournamentStart)}' na '${formatDateForDisplay(tourStart)}'`);
      }
      if ((oldData.tournamentEnd ? oldData.tournamentEnd.toMillis() : null) !== (tourEnd ? Timestamp.fromDate(tourEnd).toMillis() : null)) {
          changes.push(`Dátum konca turnaja z '${formatDateForDisplay(oldData.tournamentEnd)}' na '${formatDateForDisplay(tourEnd)}'`);
      }


      if (oldData.numberOfPlayers !== numberOfPlayers) {
          changes.push(`Maximálny počet hráčov v tíme z '${oldData.numberOfPlayers || 0}' na '${numberOfPlayers}'`);
      }
      if (oldData.numberOfImplementationTeam !== numberOfImplementationTeam) {
          changes.push(`Maximálny počet členov realizačného tímu z '${oldData.numberOfImplementationTeam || 0}' na '${numberOfImplementationTeam}'`);
      }

      await setDoc(settingsDocRef, {
        registrationStartDate: regStart ? Timestamp.fromDate(regStart) : null,
        registrationEndDate: regEnd ? Timestamp.fromDate(regEnd) : null,
        dataEditDeadline: dataEditDead ? Timestamp.fromDate(dataEditDead) : null, 
        rosterEditDeadline: rosterEditDead ? Timestamp.fromDate(rosterEditDead) : null, 
        numberOfPlayers: numberOfPlayers,
        numberOfImplementationTeam: numberOfImplementationTeam,
        // NOVINKA: Uloženie dátumu začiatku a konca turnaja
        tournamentStart: tourStart ? Timestamp.fromDate(tourStart) : null,
        tournamentEnd: tourEnd ? Timestamp.fromDate(tourEnd) : null,
      });
      
      showNotification("Nastavenia registrácie úspešne aktualizované!", 'success'); 

      if (changes.length > 0) {
          await sendAdminNotification({
              type: 'updateSettings',
              data: {
                  changesMade: changes.join('; ')
              }
          });
      }

    } catch (e) {
      showNotification(`Chyba pri aktualizácii nastavenia: ${e.message}`, 'error'); 
    }
  };

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
    if (!db || !userProfileData || userProfileData.role !== 'admin' || !user) {
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
        await sendAdminNotification({ type: 'createSize', data: { newSizeValue: trimmedNewSize } });
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
        await sendAdminNotification({ type: 'editSize', data: { originalSize: currentSizeEdit, newSizeValue: trimmedNewSize } });
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
    if (!db || !userProfileData || userProfileData.role !== 'admin' || !user) {
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
      await sendAdminNotification({ type: 'deleteSize', data: { deletedSize: sizeToDelete } });
      handleCloseConfirmDeleteModal();
    } catch (e) {
      showNotification(`Chyba pri mazaní veľkosti trička: ${e.message}`, 'error');
    }
  };

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
    if (!db || !userProfileData || userProfileData.role !== 'admin' || !user) {
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
    if (!db || !userProfileData || userProfileData.role !== 'admin' || !user) {
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


  if (!userProfileData || userProfileData.role !== 'admin') {
    return null; 
  }

  return React.createElement(
    'div',
    { className: 'bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl mx-auto space-y-8' }, 
    React.createElement('h1', { className: 'text-3xl font-bold text-center text-gray-800 mb-6' },
      'Nastavenia turnaja'
    ),
    React.createElement(
      'form',
      { onSubmit: handleUpdateRegistrationSettings, className: 'space-y-4 p-6 border border-gray-200 rounded-lg shadow-sm' }, 
      React.createElement('h2', { className: 'text-2xl font-semibold text-gray-700 mb-4' }, 'Všeobecné nastavenia registrácie'),
      React.createElement(
        'div',
        null,
        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'reg-start-date' }, 'Dátum a čas začiatku registrácie'),
        React.createElement('input', {
          type: 'datetime-local',
          id: 'reg-start-date',
          className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
          value: registrationStartDate,
          onChange: (e) => setRegistrationStartDate(e.target.value),
        })
      ),
      React.createElement(
        'div',
        null,
        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'reg-end-date' }, 'Dátum a čas konca registrácie'),
        React.createElement('input', {
          type: 'datetime-local',
          id: 'reg-end-date',
          className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
          value: registrationEndDate,
          onChange: (e) => setRegistrationEndDate(e.target.value),
        })
      ),
      React.createElement(
        'div',
        null,
        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'data-edit-deadline' }, 'Dátum a čas uzávierky úprav používateľských dát'),
        React.createElement('input', {
          type: 'datetime-local',
          id: 'data-edit-deadline',
          className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
          value: dataEditDeadline,
          onChange: (e) => setDataEditDeadline(e.target.value),
        })
      ),
      React.createElement(
        'div',
        null,
        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'roster-edit-deadline' }, 'Dátum a čas uzávierky úprav súpisiek klubov/tímov'),
        React.createElement('input', {
          type: 'datetime-local',
          id: 'roster-edit-deadline',
          className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
          value: rosterEditDeadline,
          onChange: (e) => setRosterEditDeadline(e.target.value),
        })
      ),
      React.createElement(
        'div',
        null,
        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'tournament-start' }, 'Dátum a čas - začiatok turnaja'),
        React.createElement('input', {
          type: 'datetime-local',
          id: 'tournament-start',
          className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
          value: tournamentStartDate,
          onChange: (e) => setTournamentStartDate(e.target.value),
        })
      ),
      React.createElement(
        'div',
        null,
        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'tournament-end' }, 'Dátum a čas - koniec turnaja'),
        React.createElement('input', {
          type: 'datetime-local',
          id: 'tournament-end',
          className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
          value: tournamentEndDate,
          onChange: (e) => setTournamentEndDate(e.target.value),
        })
      ),
      React.createElement(
        'div',
        null,
        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'number-of-players' }, 'Maximálny počet hráčov v tíme'),
        React.createElement('input', {
          type: 'number',
          id: 'number-of-players',
          className: `shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 ${isFrozenForEditing ? 'bg-gray-200 cursor-not-allowed' : ''}`, 
          value: numberOfPlayers,
          onChange: (e) => setNumberOfPlayers(parseInt(e.target.value) || 0), 
          min: 0, 
          disabled: isFrozenForEditing, 
        })
      ),
      React.createElement(
        'div',
        null,
        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'number-of-implementation-team' }, 'Maximálny počet členov realizačného tímu'),
        React.createElement('input', {
          type: 'number',
          id: 'number-of-implementation-team',
          className: `shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 ${isFrozenForEditing ? 'bg-gray-200 cursor-not-allowed' : ''}`, 
          value: numberOfImplementationTeam,
          onChange: (e) => setNumberOfImplementationTeam(parseInt(e.target.value) || 0), 
          min: 0, 
          disabled: isFrozenForEditing, 
        })
      ),
      React.createElement(
        'button',
        {
          type: 'submit',
          className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200',
        },
        'Aktualizovať nastavenia'
      )
    ),

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

window.TournamentSettingsApp = TournamentSettingsApp;
