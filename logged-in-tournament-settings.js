import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, setDoc, Timestamp, updateDoc, arrayUnion, arrayRemove, getDoc, collection, addDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Všetky pomocné funkcie sú teraz priamo v tomto súbore
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
  
  if (dateOrTimestamp instanceof Timestamp) {
    date = dateOrTimestamp.toDate();
  } else if (dateOrTimestamp instanceof Date) {
    date = dateOrTimestamp;
  } else {
    return 'nezadané';
  }

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

const showNotification = (message, type = 'success', duration = 5000) => {
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
    }, duration);
};

const sendAdminNotification = async (db, auth, notificationData) => {
    if (!db || !auth.currentUser || !auth.currentUser.email) { 
      console.warn("sendAdminNotification: Nemám prístup k databáze alebo k používateľovi.");
      return;
    }
    try {
      const notificationsCollectionRef = collection(db, 'notifications');
      let changesContent;
      const userEmail = auth.currentUser.email;

      if (notificationData.type === 'createSize') {
        changesContent = `Vytvorenie novej veľkosti trička: '''${notificationData.data.newSizeValue}'`;
      } else if (notificationData.type === 'editSize') {
        changesContent = `Zmena veľkosti trička z: '${notificationData.data.originalSize}' na '${notificationData.data.newSizeValue}'`;
      } else if (notificationData.type === 'deleteSize') {
        changesContent = `Zmazanie veľkosti trička: '''${notificationData.data.deletedSize}'`;
      } else if (notificationData.type === 'updateSettings') {
        changesContent = notificationData.data.changesMade.split(';').map(change => change.trim()).filter(change => change !== ''); 
      } else if (notificationData.type === 'createAccommodation') { 
        changesContent = `Vytvorenie typu ubytovania: '''${notificationData.data.type} s kapacitou ${notificationData.data.capacity}'`;
      } else if (notificationData.type === 'editAccommodation') { 
        changesContent = `Zmena ubytovania z: '${notificationData.data.originalType} (kapacita: ${notificationData.data.originalCapacity})' na '${notificationData.data.newType} (kapacita: ${notificationData.data.newCapacity})'`;
      } else if (notificationData.type === 'deleteAccommodation') { 
        changesContent = `Zmazanie typu ubytovania: '''${notificationData.data.deletedType} (kapacita: ${notificationData.data.deletedCapacity})'`;
      } else if (notificationData.type === 'createPackage') {
        changesContent = `Vytvorenie nového balíčka: '''${notificationData.data.name} s cenou ${notificationData.data.price}€'`;
      } else if (notificationData.type === 'editPackage') {
        const originalPackage = notificationData.data.originalPackage;
        const newPackage = notificationData.data.newPackage;
        const changes = [];

        if (!originalPackage || !newPackage) {
            console.error("sendAdminNotification: Chýbajú pôvodné alebo nové dáta balíčka pre notifikáciu 'editPackage'.");
            changesContent = [`Úprava balíčka '${notificationData.data.originalName || 'Neznámy názov'}'. Podrobnosti o zmene nie sú k dispozícii.`];
            await addDoc(notificationsCollectionRef, {
                userEmail: userEmail,
                changes: changesContent,
                timestamp: Timestamp.fromDate(new Date()),
                recipientId: 'all_admins'
            });
            return; 
        }

        if (originalPackage.name !== newPackage.name) {
          changes.push(`Názov: '${originalPackage.name}' -> '${newPackage.name}'`);
        }
        if (originalPackage.price !== newPackage.price) {
          changes.push(`Cena: ${originalPackage.price}€ -> ${newPackage.price}€`);
        }

        const mealTypes = ['breakfast', 'lunch', 'dinner', 'refreshment'];
        
        const originalMealDates = Object.keys(originalPackage.meals || {}).filter(key => !isNaN(new Date(key)));
        const newMealDates = Object.keys(newPackage.meals || {}).filter(key => !isNaN(new Date(key)));
        const allDates = new Set([...originalMealDates, ...newMealDates]);
        const sortedDates = Array.from(allDates).sort();

        sortedDates.forEach(date => {
            mealTypes.forEach(mealType => {
                const oldStatus = (originalPackage.meals && originalPackage.meals[date] && originalPackage.meals[date][mealType] === 1);
                const newStatus = (newPackage.meals && newPackage.meals[date] && newPackage.meals[date][mealType] === 1);
                const displayDate = new Date(date).toLocaleDateString('sk-SK');
                const mealName = mealType === 'breakfast' ? 'Raňajky' : mealType === 'lunch' ? 'Obed' : mealType === 'dinner' ? 'Večera' : 'Občerstvenie';

                if (oldStatus !== newStatus) {
                    if (newStatus) {
                        changes.push(`Pre ${displayDate} bol pridaný ${mealName}.`);
                    } else {
                        changes.push(`Pre ${displayDate} bolo odobraté ${mealName}.`);
                    }
                }
            });
        });

        const oldParticipantCard = (originalPackage.meals && originalPackage.meals.participantCard === 1);
        const newParticipantCard = (newPackage.meals && newPackage.meals.participantCard === 1);

        if (oldParticipantCard !== newParticipantCard) {
            if (newParticipantCard) {
                changes.push('Účastnícka karta bola pridaná.');
            } else {
                changes.push('Účastnícka karta bola odobratá.');
            }
        }
        
        changesContent = changes;
      } else if (notificationData.type === 'deletePackage') {
        changesContent = `Zmazanie balíčka: '''${notificationData.data.deletedName} (cena: ${notificationData.data.deletedPrice}€)'`;
      }

      await addDoc(notificationsCollectionRef, {
        userEmail: userEmail,
        changes: changesContent,
        timestamp: Timestamp.fromDate(new Date()),
        recipientId: 'all_admins'
      });
    } catch (e) {
      showNotification(`Chyba pri ukladaní notifikácie pre administrátorov: ${e.message}`, 'error');
    }
};

// Komponent pre vlastné modálne okno
const UnsavedChangesModal = ({ isOpen, onConfirm, onCancel, message }) => {
    if (!isOpen) return null;
    
    return React.createElement(
        'div',
        {
            className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100000]',
            onClick: (e) => {
                if (e.target === e.currentTarget) onCancel();
            }
        },
        React.createElement(
            'div',
            { className: 'bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden' },
            React.createElement(
                'div',
                { className: 'p-6' },
                React.createElement('h3', { className: 'text-xl font-bold text-gray-900 mb-4' },
                    'Neuložené zmeny'
                ),
                React.createElement('p', { className: 'text-gray-600 mb-6' },
                    message || 'Máte neuložené zmeny. Naozaj chcete opustiť túto stránku?'
                ),
                React.createElement(
                    'div',
                    { className: 'flex justify-end gap-3' },
                    React.createElement(
                        'button',
                        {
                            onClick: onCancel,
                            className: 'px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition-colors'
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            onClick: onConfirm,
                            className: 'px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors'
                        },
                        'Opustiť'
                    )
                )
            )
        )
    );
};

// Import komponentov nastavení
import { GeneralRegistrationSettings } from './logged-in-tournament-settings-general-registration-settings.js';
import { TShirtSizeSettings } from './logged-in-tournament-settings-t-shirt-size-settings.js';
import { AccommodationSettings } from './logged-in-tournament-settings-accommodation-settings.js';
import { PackageSettings } from './logged-in-tournament-settings-package-settings.js';
import { CategorySettings } from './logged-in-tournament-settings-category-settings.js';

function TournamentSettingsApp() {
  const app = initializeApp(window.firebaseConfig);
  const auth = getAuth(app); 
  const db = getFirestore(app);     

  const [user, setUser] = React.useState(null); 
  const [userProfileData, setUserProfileData] = React.useState(null); 
  const [isAuthReady, setIsAuthReady] = React.useState(false); 

  const [tournamentStartDate, setTournamentStartDate] = React.useState('');
  const [tournamentEndDate, setTournamentEndDate] = React.useState('');
  const [activeSetting, setActiveSetting] = React.useState(null);
  const [activeCategoryId, setActiveCategoryId] = React.useState(null);
  
  // Stav pre modálne okno
  const [modalState, setModalState] = React.useState({
      isOpen: false,
      pendingAction: null,
      pendingHash: null,
      message: ''
  });
  
  // Stav pre neuložené zmeny v CategorySettings
  const [categorySettingsHasChanges, setCategorySettingsHasChanges] = React.useState(false);

  const settingComponents = [
    { id: 'general', title: 'Všeobecné nastavenia registrácie', component: GeneralRegistrationSettings },
    { id: 'tshirt', title: 'Nastavenia veľkostí tričiek', component: TShirtSizeSettings },
    { id: 'accommodation', title: 'Nastavenia ubytovania', component: AccommodationSettings },
    { id: 'package', title: 'Nastavenia balíčkov', component: PackageSettings },
    { id: 'categories', title: 'Nastavenia kategórií', component: CategorySettings },
  ];

  // Funkcia na aktualizáciu URL hashu - HIERARCHICKÝ FORMÁT
  const updateUrlHash = (settingId, categoryId = null) => {
    if (settingId && categoryId) {
      window.location.hash = `${settingId}/category-${categoryId}`;
    } else if (settingId) {
      window.location.hash = settingId;
    } else {
      window.location.hash = '';
    }
  };

  // Funkcia na získanie nastavenia z URL hashu
  const getSettingFromHash = () => {
    const hash = window.location.hash.slice(1);
    if (!hash) return null;
    
    const parts = hash.split('/');
    const settingId = parts[0];
    
    if (settingId && settingComponents.some(s => s.id === settingId)) {
      return settingId;
    }
    return null;
  };

  // Funkcia na získanie ID kategórie z URL hashu
  const getCategoryIdFromHash = () => {
    const hash = window.location.hash.slice(1);
    if (!hash) return null;
    
    const parts = hash.split('/');
    if (parts.length > 1 && parts[1].startsWith('category-')) {
      return parts[1].replace('category-', '');
    }
    return null;
  };

  // Handler pre zmenu aktívneho nastavenia
  const handleSetActiveSetting = (settingId) => {
    setActiveSetting(settingId);
    setActiveCategoryId(null);
    updateUrlHash(settingId);
  };

  // Handler pre návrat na hlavnú stránku - S MODÁLNYM OKNOM
  const handleBackToMain = () => {
    // Kontrola, či má CategorySettings neuložené zmeny
    if (activeSetting === 'categories' && categorySettingsHasChanges) {
      setModalState({
        isOpen: true,
        pendingAction: () => {
          setActiveSetting(null);
          setActiveCategoryId(null);
          updateUrlHash(null);
          setCategorySettingsHasChanges(false);
          setModalState({ isOpen: false, pendingAction: null, pendingHash: null, message: '' });
        },
        pendingHash: null,
        message: 'Máte neuložené zmeny v nastaveniach kategórií. Naozaj chcete opustiť túto sekciu?'
      });
    } else {
      setActiveSetting(null);
      setActiveCategoryId(null);
      updateUrlHash(null);
    }
  };

  // Handler pre výber kategórie (bude volaný z CategorySettings)
  const handleSelectCategory = (categorySlug, categoryId) => {
    setActiveCategoryId(categorySlug);
    updateUrlHash('categories', categorySlug);
  };

  // Handler pre zmeny v CategorySettings
  const handleCategorySettingsHasChanges = (hasChanges) => {
    setCategorySettingsHasChanges(hasChanges);
  };

  // Načítanie nastavenia z URL pri inicializácii
  React.useEffect(() => {
    if (isAuthReady && userProfileData?.role === 'admin') {
      const settingFromHash = getSettingFromHash();
      const categoryFromHash = getCategoryIdFromHash();
      
      if (settingFromHash) {
        setActiveSetting(settingFromHash);
        if (settingFromHash === 'categories' && categoryFromHash) {
          setActiveCategoryId(categoryFromHash);
        }
      }
    }
  }, [isAuthReady, userProfileData]);

  // VLASTNÉ RIEŠENIE PRE ZMENY URL - namiesto hashchange listenera
  React.useEffect(() => {
    const checkAndHandleHashChange = (newHash) => {
      if (!isAuthReady || userProfileData?.role !== 'admin') return;
      
      const settingFromHash = getSettingFromHash();
      const categoryFromHash = getCategoryIdFromHash();
      
      // Kontrola, či opúšťame CategorySettings s neuloženými zmenami
      if (activeSetting === 'categories' && 
          settingFromHash !== 'categories' && 
          categorySettingsHasChanges) {
        
        // Zabrániť predvolenému správaniu
        setModalState({
          isOpen: true,
          pendingAction: () => {
            setActiveSetting(settingFromHash);
            if (settingFromHash === 'categories' && categoryFromHash) {
              setActiveCategoryId(categoryFromHash);
            } else {
              setActiveCategoryId(null);
            }
            setCategorySettingsHasChanges(false);
            setModalState({ isOpen: false, pendingAction: null, pendingHash: null, message: '' });
          },
          pendingHash: newHash,
          message: 'Máte neuložené zmeny v nastaveniach kategórií. Naozaj chcete opustiť túto sekciu?'
        });
        
        // Vrátime URL späť na pôvodnú
        const currentHash = 'categories' + (activeCategoryId ? `/category-${activeCategoryId}` : '');
        setTimeout(() => {
          window.location.hash = currentHash;
        }, 0);
        
        return true; // Zmena bola zablokovaná
      }
      
      // Normálne spracovanie zmeny
      setActiveSetting(settingFromHash);
      if (settingFromHash === 'categories' && categoryFromHash) {
        setActiveCategoryId(categoryFromHash);
      } else {
        setActiveCategoryId(null);
      }
      
      return false; // Zmena prebehla normálne
    };

    // Sledovanie zmien URL cez popstate
    const handlePopState = () => {
      const hash = window.location.hash.slice(1);
      checkAndHandleHashChange(hash);
    };

    // Prepísanie history.pushState a history.replaceState
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
      const result = originalPushState.apply(this, args);
      setTimeout(() => {
        const hash = window.location.hash.slice(1);
        checkAndHandleHashChange(hash);
      }, 0);
      return result;
    };

    history.replaceState = function(...args) {
      const result = originalReplaceState.apply(this, args);
      setTimeout(() => {
        const hash = window.location.hash.slice(1);
        checkAndHandleHashChange(hash);
      }, 0);
      return result;
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    };
  }, [isAuthReady, userProfileData, activeSetting, activeCategoryId, categorySettingsHasChanges]);

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

    return () => {
      if (unsubscribeUserDoc) {
        unsubscribeUserDoc();
      }
    };
  }, [user, db, isAuthReady, auth]);

  React.useEffect(() => {
    let unsubscribeSettings;
    const fetchTournamentDates = () => {
      if (!db || !userProfileData || userProfileData.role !== 'admin') {
        return;
      }
      try {
        const settingsDocRef = doc(db, 'settings', 'registration');
        unsubscribeSettings = onSnapshot(settingsDocRef, docSnapshot => {
          if (docSnapshot.exists()) {
            const data = docSnapshot.data();
            setTournamentStartDate(data.tournamentStart ? formatToDatetimeLocal(data.tournamentStart.toDate()) : '');
            setTournamentEndDate(data.tournamentEnd ? formatToDatetimeLocal(data.tournamentEnd.toDate()) : '');
          } else {
            setTournamentStartDate('');
            setTournamentEndDate('');
          }
        }, error => {
          showNotification(`Chyba pri načítaní dátumov turnaja: ${error.message}`, 'error');
        });
      } catch (e) {
        showNotification(`Chyba pri nastavovaní poslucháča pre dátumy turnaja: ${e.message}`, 'error');
      }
    };

    fetchTournamentDates();

    return () => {
      if (unsubscribeSettings) {
        unsubscribeSettings();
      }
    };
  }, [db, userProfileData]);

  // Potvrdenie odchodu z modálneho okna
  const handleConfirmLeave = () => {
    if (modalState.pendingAction) {
      modalState.pendingAction();
    } else if (modalState.pendingHash) {
      window.location.hash = modalState.pendingHash;
      setModalState({ isOpen: false, pendingAction: null, pendingHash: null, message: '' });
    }
  };

  // Zrušenie odchodu z modálneho okna
  const handleCancelLeave = () => {
    setModalState({ isOpen: false, pendingAction: null, pendingHash: null, message: '' });
  };

  if (!userProfileData || userProfileData.role !== 'admin') {
    return null; 
  }

  return React.createElement(
    React.Fragment,
    null,
    // Vlastné modálne okno
    React.createElement(UnsavedChangesModal, {
        isOpen: modalState.isOpen,
        onConfirm: handleConfirmLeave,
        onCancel: handleCancelLeave,
        message: modalState.message
    }),
    React.createElement(
      'div',
      { className: 'bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl mx-auto space-y-8' }, 
      React.createElement('h1', { className: 'text-3xl font-bold text-center text-gray-800 mb-6' },
        'Nastavenia turnaja'
      ),
      
      activeSetting ? (
        React.createElement(
          React.Fragment,
          null,
          React.createElement(
            'div',
            { className: 'flex items-center mb-4' },
            React.createElement(
              'button',
              {
                type: 'button',
                onClick: handleBackToMain,
                className: 'bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200 flex items-center'
              },
              React.createElement('svg', { className: 'h-4 w-4 mr-2', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M10 19l-7-7m0 0l7-7m-7 7h18' })
              ),
              'Späť'
            )
          ),
          React.createElement(
            settingComponents.find(s => s.id === activeSetting).component,
            {
              db: db,
              userProfileData: userProfileData,
              tournamentStartDate: tournamentStartDate,
              setTournamentStartDate: setTournamentStartDate,
              tournamentEndDate: tournamentEndDate,
              setTournamentEndDate: setTournamentEndDate,
              showNotification: showNotification,
              sendAdminNotification: (notificationData) => sendAdminNotification(db, auth, notificationData),
              formatDateForDisplay: formatDateForDisplay,
              formatToDatetimeLocal: formatToDatetimeLocal,
              initialCategoryId: activeSetting === 'categories' ? activeCategoryId : null,
              onSelectCategory: handleSelectCategory,
              onHasChangesChange: handleCategorySettingsHasChanges
            }
          )
        )
      ) : (
        React.createElement(
          'div',
          { className: 'space-y-4' },
          settingComponents.map(setting => (
            React.createElement(
              'button',
              {
                key: setting.id,
                onClick: () => handleSetActiveSetting(setting.id),
                className: 'w-full text-left bg-blue-500 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg shadow-md transition-colors duration-200 text-xl'
              },
              setting.title
            )
          ))
        )
      )
    )
  );
}

window.TournamentSettingsApp = TournamentSettingsApp;
