// logged-in-notifications.js
// Tento súbor obsahuje React komponent pre správu notifikácií prihláseného používateľa.
// Predpokladá, že Firebase SDK je inicializovaný v <head> logged-in-notifications.html
// prostredníctvom authentication.js.

// Importy pre potrebné Firebase funkcie z verzie 11.6.1
import { getAuth, onAuthStateChanged} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, collection, query, where, updateDoc, deleteDoc, writeBatch, arrayUnion, arrayRemove, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

function ToggleSection({ label, checked, onChange, disabled }) {
  return React.createElement(CustomToggle, {
    checked,
    onChange,
    label,
    disabled
  });
}

function CustomToggle({ checked, onChange, label, disabled }) {
  return React.createElement(
    'div', { className: 'flex items-center justify-between' },
    React.createElement('span', { className: 'text-lg font-semibold text-gray-700' }, label),
    React.createElement(
      'label', { className: 'relative inline-flex items-center cursor-pointer' },
      React.createElement('input', {
        type: 'checkbox',
        checked: checked,
        onChange: onChange,
        className: 'sr-only peer',
        disabled: disabled,
      }),
      React.createElement('div', {
        className: `
          w-11 h-6 rounded-full
          transition-colors duration-200 ease-in-out
          peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300
          peer-checked:after:translate-x-full peer-checked:after:border-white
          after:content-[''] after:absolute after:top-[2px] after:left-[2px]
          after:bg-white after:border after:border-gray-300 after:rounded-full
          after:h-5 after:w-5
          after:transition-transform after:duration-200 after:ease-in-out
          ${checked ? 'bg-[#47b3ff]' : 'bg-gray-200'}
        `
      })
    )
  );
}

// NotificationModal Component for displaying temporary messages (converted to React.createElement)
function NotificationModal({ message, onClose, type = 'info' }) {
  const [show, setShow] = React.useState(false);
  const timerRef = React.useRef(null);

  React.useEffect(() => {
    if (message) {
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
  }, [message, onClose]);

  if (!show && !message) return null;

  let bgColorClass;
  if (type === 'success') {
    bgColorClass = 'bg-[#3A8D41]'; // Green
  } else if (type === 'error') {
    bgColorClass = 'bg-red-600'; // Red
  } else {
    bgColorClass = 'bg-blue-500'; // Default blue for info - but this case should not be reached with the new logic
  }

  return React.createElement(
    'div',
    {
      className: `fixed top-0 left-0 right-0 z-50 flex justify-center p-4 transition-transform duration-500 ease-out ${
        show ? 'translate-y-0' : '-translate-y-full'
      }`,
      style: { pointerEvents: 'none' }
    },
    React.createElement(
      'div',
      {
        className: `${bgColorClass} text-white px-6 py-3 rounded-lg shadow-lg max-w-md w-full text-center`,
        style: { pointerEvents: 'auto' }
      },
      React.createElement('p', { className: 'font-semibold' }, message)
    )
  );
}

// NEW COMPONENT: ConfirmationModal for action confirmation
function ConfirmationModal({ show, message, onConfirm, onCancel, loading, showCheckbox, checkboxLabel, onCheckboxChange, checkboxChecked }) {
  if (!show) return null;

  return React.createElement(
    'div',
    { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50' },
    React.createElement(
      'div',
      { className: 'bg-white p-6 rounded-lg shadow-xl max-w-sm w-full text-center' },
      React.createElement('p', { className: 'text-lg font-semibold mb-4' }, message),
      showCheckbox && React.createElement(
        'div',
        { className: 'flex items-center justify-center mb-4' },
        React.createElement('input', {
          type: 'checkbox',
          id: 'confirm-checkbox',
          checked: checkboxChecked,
          onChange: onCheckboxChange,
          className: 'mr-2'
        }),
        React.createElement('label', { htmlFor: 'confirm-checkbox', className: 'text-gray-700' }, checkboxLabel)
      ),
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


// Main React component for the logged-in-notifications.html page
function NotificationsApp() {
  // Use global Firebase instances provided by authentication.js
  const auth = React.useRef(getAuth()).current; // Ensure auth is consistent
  const db = React.useRef(getFirestore()).current; // Ensure db is consistent

  // Local state for the current user and their profile data,
  // derived from global state once authentication.js sets it up.
  const [user, setUser] = React.useState(null); // Will be updated by globalDataUpdated
  const [userProfileData, setUserProfileData] = React.useState(null); 
  const [loading, setLoading] = React.useState(true); // Loading for data in NotificationsApp
  const [error, setError] = React.useState('');
  const [userNotificationMessage, setUserNotificationMessage] = React.useState('');
  const [userNotificationType, setUserNotificationType] = React.useState('success'); // Predvolený stav pre typ notifikácie na 'success'

  // NEW STATE FOR NOTIFICATIONS TOGGLE
  const [displayNotifications, setDisplayNotifications] = React.useState(false);
  const [displayTeamBubbles, setDisplayTeamBubbles] = React.useState(false);

  const [notifications, setNotifications] = React.useState([]);
  const [allAdminUids, setAllAdminUids] = React.useState([]); // New state for storing UIDs of all administrators

  // NOVÉ STAVY PRE OBNOVU A VÝBER OZNÁMENÍ
  const [selectedNotificationsToRestore, setSelectedNotificationsToRestore] = React.useState(new Set());
  const [showRestoreConfirmationModal, setShowRestoreConfirmationModal] = React.useState(false);
  const [showRestoreView, setShowRestoreView] = React.useState(false); // ZMENA: Nový stav pre zobrazenie/skrytie obnovovacích oznámení
  const [areAllRestorableSelected, setAreAllRestorableSelected] = React.useState(false); // NOVÉ: Stav pre tlačidlo "Označiť všetky"

  // STAVY PRE MODÁLNE OKNO VYMAZANIE VŠETKÝCH NOTIFIKÁCIÍ
  const [showDeleteAllConfirmationModal, setShowDeleteAllConfirmationModal] = React.useState(false);
  const [deleteUnreadToo, setDeleteUnreadToo] = React.useState(false);


  // Listen for globalDataUpdated event from authentication.js
  React.useEffect(() => {
    const handleGlobalDataUpdated = (event) => {
      console.log("NotificationsApp: Received 'globalDataUpdated' event.");
      const globalUser = auth.currentUser; // Get current user from global auth instance
      const globalProfileData = event.detail;

      setUser(globalUser);
      setUserProfileData(globalProfileData);
      
      // If global auth is ready and we have profile data, then loading for initial setup is done.
      if (window.isGlobalAuthReady && globalUser && globalProfileData) {
        setLoading(false);
        // NEW: Set initial state for the toggle switch
        // This is now handled by the separate onSnapshot listener
      } else if (window.isGlobalAuthReady && !globalUser) {
        // If auth is ready but no user, redirect (this should be handled by authentication.js primarily)
        console.log("NotificationsApp: User is not logged in via global state, redirecting to login.html.");
        window.location.href = 'login.html';
      }
      // If globalProfileData exists, but user is not an approved admin, redirect
      if (globalProfileData && (globalProfileData.role !== 'admin' || globalProfileData.approved !== true)) {
        console.log("NotificationsApp: User is not an approved administrator via global state, redirecting.");
        window.location.href = 'logged-in-my-data.html';
      }
    };

    // Ensure we are listening for global data updates
    window.addEventListener('globalDataUpdated', handleGlobalDataUpdated);

    // Initial check in case event already fired before component mounted
    // If globalAuthReady and globalUserProfileData are already set, use them directly
    if (window.isGlobalAuthReady && window.globalUserProfileData) {
        handleGlobalDataUpdated({ detail: window.globalUserProfileData });
    } else if (window.isGlobalAuthReady && !window.globalUserProfileData) {
        // If auth is ready but no user data (meaning user is logged out or not approved)
        handleGlobalDataUpdated({ detail: null });
    } else {
        setLoading(true);
    }


    return () => {
      window.removeEventListener('globalDataUpdated', handleGlobalDataUpdated);
    };
  }, [auth]); // Depends on auth instance

    // NEW EFFECT: Listen for real-time updates to the 'displayNotifications' field
    React.useEffect(() => {
        let unsubscribeUserDoc;
    
        if (db && user) {
            console.log("NotificationsApp: Setting up onSnapshot for user settings (displayNotifications + displayTeamBubbles).");
    
            const userDocRef = doc(db, 'users', user.uid);
            unsubscribeUserDoc = onSnapshot(userDocRef, (docSnapshot) => {
                if (docSnapshot.exists()) {
                    const data = docSnapshot.data();
    
                    // displayNotifications
                    if (data.hasOwnProperty('displayNotifications')) {
                        setDisplayNotifications(data.displayNotifications);
                    }
    
                    // displayTeamBubbles – NOVÉ
                    if (data.hasOwnProperty('displayTeamBubbles')) {
                        setDisplayTeamBubbles(data.displayTeamBubbles);
                        console.log("displayTeamBubbles updated:", data.displayTeamBubbles);
                    } else {
                        // Ak pole ešte neexistuje → nastavíme default (napr. true)
                        // Toto sa vykoná iba raz – pri prvom načítaní
                        updateDoc(userDocRef, { displayTeamBubbles: true })
                            .then(() => console.log("Initialized displayTeamBubbles = true"))
                            .catch(err => console.error("Failed to init displayTeamBubbles:", err));
                    }
                }
            }, (error) => {
                console.error("Error listening to user document:", error);
                setUserNotificationMessage(`Chyba pri načítaní nastavení: ${error.message}`);
                setUserNotificationType('error');
            });
        }
    
        return () => {
            if (unsubscribeUserDoc) {
                unsubscribeUserDoc();
            }
        };
    }, [db, user]);

  // Effect for fetching all admin Uids
  React.useEffect(() => {
    let unsubscribeAdmins;
    if (db && window.isGlobalAuthReady) { // Only run if db is available and auth is ready
      try {
        const adminQuery = query(collection(db, 'users'), where('role', '==', 'admin'), where('approved', '==', true));
        unsubscribeAdmins = onSnapshot(adminQuery, snapshot => {
          const adminUids = [];
          snapshot.forEach(doc => {
            adminUids.push(doc.id);
          });
          setAllAdminUids(adminUids);
          console.log("NotificationsApp: List of approved administrators updated:", adminUids);
        }, error => {
          console.error("NotificationsApp: Error loading list of administrators:", error);
        });
      } catch (e) {
        console.error("NotificationsApp: Error setting up listener for administrators:", e);
      }
    }
    return () => {
      if (unsubscribeAdmins) {
        unsubscribeAdmins();
      }
    };
  }, [db, window.isGlobalAuthReady]); // Depends on db and global auth ready state


  // NOVÝ KÓD: Listener pre aktualizácie notifikácií
  React.useEffect(() => {
    let unsubscribeNotifications;
    // Len ak je používateľ schválený administrátor a máme jeho UID, tak načítame notifikácie
    if (db && userProfileData && userProfileData.role === 'admin' && userProfileData.approved === true && user) {
      console.log("NotificationsApp: Prihlásený používateľ je schválený administrátor. Načítavam notifikácie.");
      try {
        const notificationsCollectionRef = collection(db, 'notifications');
        
        // onSnapshot na real-time aktualizácie
        unsubscribeNotifications = onSnapshot(notificationsCollectionRef, snapshot => {
          const fetchedNotifications = [];
          snapshot.forEach(document => {
            const data = document.data();
            const isDeletedForCurrentUser = data.deletedBy && data.deletedBy.includes(user.uid);

            let timestamp = null;
              if (data.timestamp) {
                if (typeof data.timestamp.toDate === 'function') {
                  timestamp = data.timestamp.toDate();
                } else if (typeof data.timestamp === 'number') {
                  timestamp = new Date(data.timestamp);
                } else if (typeof data.timestamp === 'string') {
                  const parsed = new Date(data.timestamp);
                  if (!isNaN(parsed.getTime())) {
                    timestamp = parsed;
                  }
                }
              }
            
            // Notifikácia sa načíta, aj keď je "vymazaná" pre aktuálneho používateľa,
            // aby sa dala zobraziť možnosť obnovenia.
            fetchedNotifications.push({
                id: document.id,
                ...data,
                // Notifikácia je "prečítaná" ak je user.uid v seenBy poli
                read: data.seenBy && data.seenBy.includes(user.uid), 
                // Pridáme stav, či je vymazaná pre aktuálneho používateľa
                deletedByMe: isDeletedForCurrentUser,
                timestamp: data.timestamp?.toDate?.() ?? (typeof data.timestamp === 'number' ? new Date(data.timestamp) : null),
            });
          });
          // Zoraď notifikácie od najnovších po najstaršie
          fetchedNotifications.sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0));
          setNotifications(fetchedNotifications);
          setError('');
          console.log("NotificationsApp: Upozornenia aktualizované z onSnapshot.");
        }, error => {
          console.error("NotificationsApp: Chyba pri načítaní upozornení z Firestore (onSnapshot chyba):", error);
          setError(`Chyba pri načítaní upozornení: ${error.message}`);
        });
      } catch (e) {
        console.error("NotificationsApp: Chyba pri nastavovaní onSnapshot pre upozornenia (try-catch):", e);
        setError(`Chyba pri nastavení poslucháča pre upozornenia: ${e.message}`);
      }
    } else {
        setNotifications([]); // Vymaž notifikácie, ak nie je admin alebo nie sú dáta pripravené
        if (window.isGlobalAuthReady && userProfileData && (userProfileData.role !== 'admin' || userProfileData.approved !== true)) {
            setLoading(false);
        }
    }

    // Odhlásenie z listenera pri zrušení komponentu
    return () => {
      if (unsubscribeNotifications) {
        console.log("NotificationsApp: Odhlasujem onSnapshot pre notifikácie.");
        unsubscribeNotifications();
      }
    };
  }, [db, userProfileData, user]);

  const handleToggleTeamBubbles = async () => {
    if (!db || !user || !user.uid) {
        setUserNotificationMessage("Chyba: Nie sú dostupné dáta používateľa alebo databázy.");
        setUserNotificationType('error');
        return;
    }

    setLoading(true);
    setError('');

    try {
        const userRef = doc(db, 'users', user.uid);
        const newState = !displayTeamBubbles;

        await updateDoc(userRef, { 
            displayTeamBubbles: newState 
        });

        // onSnapshot to automaticky zachytí a aktualizuje stav
        setUserNotificationMessage(
            newState 
                ? "Zobrazovanie informácií o tíme (bublinky) bolo zapnuté." 
                : "Zobrazovanie informácií o tíme (bublinky) bolo vypnuté."
        );
        setUserNotificationType('success');
    } catch (e) {
        console.error("Error updating displayTeamBubbles:", e);
        setError(`Chyba pri zmene nastavenia bubliniek: ${e.message}`);
        setUserNotificationType('error');
    } finally {
        setLoading(false);
    }
  };

  // NEW HANDLER: For updating the displayNotifications field
  const handleToggleNotifications = async () => {
    if (!db || !user || !user.uid) {
        setUserNotificationMessage("Chyba: Nie sú dostupné dáta používateľa alebo databázy.");
        setUserNotificationType('error');
        return;
    }
    setLoading(true);
    setError('');
    try {
        const userRef = doc(db, 'users', user.uid);
        const newToggleState = !displayNotifications;
        await updateDoc(userRef, { displayNotifications: newToggleState });
        // The state will now be updated by the onSnapshot listener, not here directly
        setUserNotificationMessage(newToggleState ? "Zobrazovanie notifikácií bolo zapnuté." : "Zobrazovanie notifikácií bolo vypnuté.");
        setUserNotificationType('success');
    } catch (e) {
        console.error("NotificationsApp: Error updating displayNotifications:", e);
        setError(`Chyba pri aktualizácii nastavenia notifikácií: ${e.message}`);
        setUserNotificationType('error');
    } finally {
        setLoading(false);
    }
  };


  const handleMarkAsRead = async (notificationId) => {
    if (!db || !user || !userProfileData || userProfileData.role !== 'admin' || !user.uid) {
      setUserNotificationMessage("Nemáte oprávnenie označiť upozornenie ako prečítané.");
      setUserNotificationType('error'); 
      return;
    }
    setLoading(true);
    setError('');
    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, {
        seenBy: arrayUnion(user.uid)
      });
      setUserNotificationMessage("Upozornenie označené ako prečítané.");
      setUserNotificationType('success'); 
    } catch (e) {
      console.error("NotificationsApp: Error marking notification as read:", e);
      setError(`Chyba pri označení upozornenia ako prečítaného: ${e.message}`);
      setUserNotificationType('error'); 
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNotification = async (notificationId) => {
    if (!db || !user || !userProfileData || userProfileData.role !== 'admin' || !user.uid) {
      setUserNotificationMessage("Nemáte oprávnenie odstrániť upozornenie.");
      setUserNotificationType('error'); 
      return;
    }
    setLoading(true);
    setError('');
    try {
      const notificationRef = doc(db, 'notifications', notificationId);

      const docSnap = await getDoc(notificationRef);
      if (!docSnap.exists()) {
        setUserNotificationMessage("Upozornenie bolo odstránené pre vás.");
        setUserNotificationType('success'); 
        setLoading(false);
        return;
      }

      const notificationData = docSnap.data();
      let deletedBy = notificationData.deletedBy || [];

      if (!deletedBy.includes(user.uid)) {
        deletedBy.push(user.uid);
      }
      
      if (allAdminUids.length > 0 && deletedBy.length >= allAdminUids.length) {
        await deleteDoc(notificationRef);
        setUserNotificationMessage("Upozornenie bolo úplne odstránené.");
        setUserNotificationType('success'); 
        console.log(`Notification ${notificationId} has been completely deleted from the database.`);
      } else {
        await updateDoc(notificationRef, {
          deletedBy: arrayUnion(user.uid)
        });
        setUserNotificationMessage("Upozornenie bolo odstránené pre vás.");
        setUserNotificationType('success'); 
        console.log(`Notification ${notificationId} has been hidden for user ${user.uid}.`);
      }
    } catch (e) {
      console.error("NotificationsApp: Error deleting notification:", e);
      setError(`Chyba pri odstránení upozornenia: ${e.message}`);
      setUserNotificationType('error'); 
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!db || !user || !userProfileData || userProfileData.role !== 'admin' || !user.uid) {
      setUserNotificationMessage("Nemáte oprávnenie označiť upozornenia ako prečítané.");
      setUserNotificationType('error'); 
      return;
    }
    setLoading(true);
    setError('');
    try {
      const unreadNotifications = notifications.filter(n => !n.read && !n.deletedByMe);

      if (unreadNotifications.length === 0) {
        setUserNotificationMessage("Žiadne neprečítané upozornenia na označenie.");
        setUserNotificationType('success'); 
        setLoading(false);
        return;
      }

      const batch = writeBatch(db);
      unreadNotifications.forEach(notification => {
        const notificationRef = doc(db, 'notifications', notification.id);
        batch.update(notificationRef, { seenBy: arrayUnion(user.uid) });
      });

      await batch.commit();
      setUserNotificationMessage("Všetky neprečítané upozornenia boli označené ako prečítané.");
      setUserNotificationType('success'); 
    } catch (e) {
      console.error("NotificationsApp: Error marking all notifications as read:", e);
      setError(`Chyba pri označení všetkých upozornení ako prečítaných: ${e.message}`);
      setUserNotificationType('error'); 
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAllNotificationsClick = () => {
    setShowDeleteAllConfirmationModal(true);
    setDeleteUnreadToo(false); // Reset checkbox when modal opens
  };

  const confirmDeleteAllNotifications = async () => {
    if (!db || !user || !userProfileData || userProfileData.role !== 'admin' || !user.uid) {
      setUserNotificationMessage("Nemáte oprávnenie odstrániť všetky upozornenia.");
      setUserNotificationType('error'); 
      return;
    }
    setLoading(true);
    setError('');
    try {
      let notificationsToProcess = notifications.filter(n => !n.deletedByMe);
      if (!deleteUnreadToo) {
        notificationsToProcess = notificationsToProcess.filter(n => n.read);
      }

      if (notificationsToProcess.length === 0) {
        setUserNotificationMessage("Žiadne upozornenia na odstránenie.");
        setUserNotificationType('success'); 
        setLoading(false);
        setShowDeleteAllConfirmationModal(false);
        return;
      }

      const batch = writeBatch(db);
      notificationsToProcess.forEach(notification => {
        const notificationRef = doc(db, 'notifications', notification.id);
        
        let deletedBy = notification.deletedBy || [];
        if (!deletedBy.includes(user.uid)) {
          deletedBy.push(user.uid);
        }

        if (allAdminUids.length > 0 && deletedBy.length >= allAdminUids.length) {
          batch.delete(notificationRef);
        } else {
          batch.update(notificationRef, { deletedBy: arrayUnion(user.uid) });
        }
      });

      await batch.commit();
      setUserNotificationMessage("Všetky vybrané upozornenia boli odstránené.");
      setUserNotificationType('success'); 
      setShowDeleteAllConfirmationModal(false);
    } catch (e) {
      console.error("NotificationsApp: Error deleting all notifications:", e);
      setError(`Chyba pri odstránení všetkých upozornení: ${e.message}`);
      setUserNotificationType('error'); 
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationSelectionChange = (notificationId, isChecked) => {
    setSelectedNotificationsToRestore(prev => {
      const newSet = new Set(prev);
      if (isChecked) {
        newSet.add(notificationId);
      } else {
        newSet.delete(notificationId);
      }

      // NOVÉ: Aktualizujeme stav 'areAllRestorableSelected'
      const restorableNotifications = notifications.filter(n => n.deletedByMe);
      if (restorableNotifications.length > 0 && newSet.size === restorableNotifications.length) {
        setAreAllRestorableSelected(true);
      } else {
        setAreAllRestorableSelected(false);
      }
      return newSet;
    });
  };

  // ZMENA: Upravená logika pre tlačidlo "Obnoviť"
  const handleRestoreButtonAction = async () => {
    // Ak je režim obnovy zapnutý a existujú vybrané notifikácie
    if (showRestoreView && selectedNotificationsToRestore.size > 0) {
      await confirmRestoreSelectedNotifications(); // Spustí obnovu vybraných
      setShowRestoreView(false); // Po obnove skryjeme režim obnovy
      setSelectedNotificationsToRestore(new Set()); // Vymažeme výber
      setAreAllRestorableSelected(false); // NOVÉ: Zrušíme "Označiť všetky"
    } else if (showRestoreView && selectedNotificationsToRestore.size === 0) {
      // Ak je režim obnovy zapnutý, ale nič nie je vybrané, zatvoríme režim
      setShowRestoreView(false);
      setSelectedNotificationsToRestore(new Set()); // Vymažeme výber
      setAreAllRestorableSelected(false); // NOVÉ: Zrušíme "Označiť všetky"
    } else {
      // Ak režim obnovy nie je zapnutý, zapneme ho
      setShowRestoreView(true);
      // NOVÉ: Nastavíme 'Označiť všetky' podľa predvoleného stavu (napr. nič nie je vybrané)
      const restorableNotifications = notifications.filter(n => n.deletedByMe);
      if (restorableNotifications.length > 0 && selectedNotificationsToRestore.size === restorableNotifications.length) {
        setAreAllRestorableSelected(true);
      } else {
        setAreAllRestorableSelected(false);
      }
    }
  };

  // NOVÁ FUNKCIA: Označenie/Odznačenie všetkých obnoviteľných notifikácií
  const handleSelectAllRestorable = () => {
    const restorableNotifications = notifications.filter(n => n.deletedByMe);
    if (areAllRestorableSelected) {
      setSelectedNotificationsToRestore(new Set());
      setAreAllRestorableSelected(false);
    } else {
      const allRestorableIds = new Set(restorableNotifications.map(n => n.id));
      setSelectedNotificationsToRestore(allRestorableIds);
      setAreAllRestorableSelected(true);
    }
  };

  // ZMENA: Pôvodná funkcia confirmRestoreSelectedNotifications je teraz len interná pre batch operáciu
  const confirmRestoreSelectedNotifications = async () => {
    if (!db || !user || !user.uid) {
      setUserNotificationMessage("Chyba: Nie sú dostupné dáta používateľa alebo databázy.");
      setUserNotificationType('error');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const batch = writeBatch(db);
      selectedNotificationsToRestore.forEach(notificationId => {
        const notificationRef = doc(db, 'notifications', notificationId);
        batch.update(notificationRef, { deletedBy: arrayRemove(user.uid) });
      });
      await batch.commit();
      setUserNotificationMessage("Vybrané upozornenia boli úspešne obnovené.");
      setUserNotificationType('success');
    } catch (e) {
      console.error("NotificationsApp: Error restoring selected notifications:", e);
      setError(`Chyba pri obnovení upozornení: ${e.message}`);
      setUserNotificationType('error');
    } finally {
      setLoading(false);
    }
  };


  // Helper function to render text with specific styling based on single quotes
  function renderStyledText(text) {
    const parts = [];
    let lastIndex = 0;
    const quoteIndices = [];
    for (let i = 0; i < text.length; i++) {
      if (text[i] === "'") {
        quoteIndices.push(i);
      }
    }

    // No special styling if less than 2 quotes
    if (quoteIndices.length < 2) {
      return React.createElement('span', null, text);
    }

    // Process first italic part
    const firstQuote = quoteIndices[0];
    const secondQuote = quoteIndices[1];
    
    // Part before first quote
    if (firstQuote > lastIndex) {
      parts.push(React.createElement('span', { key: `part-before-italic-${lastIndex}` }, text.substring(lastIndex, firstQuote)));
    }
    // Italic part
    parts.push(React.createElement('em', { key: `italic-part-${firstQuote}`, className: 'italic' }, text.substring(firstQuote + 1, secondQuote)));
    lastIndex = secondQuote + 1;

    // Process second bold part if enough quotes
    if (quoteIndices.length >= 4) {
      const thirdQuote = quoteIndices[2];
      const fourthQuote = quoteIndices[3];

      // Part between second and third quote
      if (thirdQuote > lastIndex) {
        parts.push(React.createElement('span', { key: `part-between-italic-bold-${lastIndex}` }, text.substring(lastIndex, thirdQuote)));
      }
      // Bold part
      parts.push(React.createElement('strong', { key: `bold-part-${thirdQuote}`, className: 'font-bold' }, text.substring(thirdQuote + 1, fourthQuote)));
      lastIndex = fourthQuote + 1;
    }

    // Remaining part of the text
    if (lastIndex < text.length) {
      parts.push(React.createElement('span', { key: `remaining-part-${lastIndex}` }, text.substring(lastIndex)));
    }
    
    return parts;
  }


  // Display loading state
  if (loading) {
    let loadingMessage = 'Načítavam...'; // Default loading message
    if (!window.isGlobalAuthReady) {
        loadingMessage = 'Prebieha inicializácia autentifikácie...';
    } else if (window.isGlobalAuthReady && !user) {
        loadingMessage = 'Čakám na dáta používateľa...';
    } else if (user && !userProfileData) {
        loadingMessage = 'Načítavam profil používateľa...';
    } else if (loading) { // This `loading` refers to the component's own loading state
        loadingMessage = 'Načítavam upozornenia...';
    }

    return React.createElement(
      'div',
      { className: 'flex items-center justify-center min-h-screen bg-gray-100' },
      React.createElement('div', { className: 'text-xl font-semibold text-gray-700' }, loadingMessage)
    );
  }

  // If user is null (not logged in), redirect (should be handled by globalDataUpdated listener)
  if (!user) {
    console.log("NotificationsApp: Používateľ nie je prihlásený, presmerovanie na login.html");
    window.location.href = 'login.html';
    return null;
  }

  // If user is not an approved admin, redirect (should be handled by globalDataUpdated listener)
  if (userProfileData && (userProfileData.role !== 'admin' || userProfileData.approved !== true)) {
    console.log("NotificationsApp: Používateľ nie je schválený administrátor, presmerovanie.");
    window.location.href = 'logged-in-my-data.html'; // Redirect to logged-in-my-data.html
    return null;
  }

  // Filter notifications based on whether they are deleted by the current user and if restore view is active
  const displayedNotifications = showRestoreView 
    ? notifications.filter(n => n.deletedByMe) // If in restore view, show only notifications deleted by me
    : notifications.filter(n => !n.deletedByMe); // Otherwise, show only those not deleted by me

  // Check if there are any active notifications that can be seen (not deleted by me)
  const hasActiveNotifications = notifications.some(n => !n.deletedByMe);
  const hasUnreadNotifications = notifications.some(n => !n.read && !n.deletedByMe);
  const hasDeletedByMeNotifications = notifications.some(n => n.deletedByMe); // If there are *any* notifications deleted by me

  // ZMENA: Text tlačidla pre obnovu
  const restoreButtonText = showRestoreView 
    ? (selectedNotificationsToRestore.size > 0 ? `Obnoviť vybrané (${selectedNotificationsToRestore.size})` : 'Zatvoriť obnovu') 
    : 'Obnoviť upozornenia';


  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
    React.createElement(NotificationModal, {
        message: userNotificationMessage,
        onClose: () => setUserNotificationMessage(''),
        type: userNotificationType
    }),
    React.createElement(ConfirmationModal, {
        show: showDeleteAllConfirmationModal,
        message: "Naozaj chcete odstrániť všetky upozornenia?",
        onConfirm: confirmDeleteAllNotifications,
        onCancel: () => setShowDeleteAllConfirmationModal(false),
        loading: loading,
        showCheckbox: hasUnreadNotifications,
        checkboxLabel: "Odstrániť aj neprečítané upozornenia",
        onCheckboxChange: (e) => setDeleteUnreadToo(e.target.checked),
        checkboxChecked: deleteUnreadToo
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
          'Upozornenia'
        ),
        // Toggle switch pre notifikácie

        React.createElement('div', { className: 'space-y-6 mb-8' },
          React.createElement(ToggleSection, {
            label: 'Zobrazovať upozornenia',
            checked: displayNotifications,
            onChange: handleToggleNotifications,
            disabled: loading
          }),
          React.createElement(ToggleSection, {
            label: 'Zobrazovať informácie o tíme (bublinky)',
            checked: displayTeamBubbles,
            onChange: handleToggleTeamBubbles,
            disabled: loading
          })
        ),

        // Skupina tlačidiel
        (hasActiveNotifications || hasDeletedByMeNotifications) && React.createElement(
          'div',
          { className: 'flex flex-wrap justify-center gap-4 mb-6' },
          hasUnreadNotifications && React.createElement(
            'button',
            {
              onClick: handleMarkAllAsRead,
              className: 'bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200',
              disabled: loading,
            },
            'Označiť všetky ako prečítané'
          ),
          hasActiveNotifications && !showRestoreView && React.createElement(
            'button',
            {
              onClick: handleDeleteAllNotificationsClick,
              className: 'bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200',
              disabled: loading,
            },
            'Vymazať všetky'
          ),
          hasDeletedByMeNotifications && React.createElement(
            'button',
            {
                onClick: handleRestoreButtonAction,
                className: `text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200 ${
                    restoreButtonText === 'Zatvoriť obnovu' 
                    ? 'bg-red-500 hover:bg-red-600' 
                    : 'bg-[#47b3ff] hover:bg-[#3A9ACD]'
                }`,
                disabled: loading,
            },
            restoreButtonText
          ),
          // Tlačidlo "Označiť všetky / Odznač všetky" pre režim obnovy
          showRestoreView && displayedNotifications.length > 0 && React.createElement(
            'button',
            {
              onClick: handleSelectAllRestorable,
              className: 'bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200',
              disabled: loading,
            },
            areAllRestorableSelected ? 'Odznačiť všetky' : 'Označiť všetky'
          )
        ),
        displayedNotifications.length === 0 && !loading ? (
            React.createElement('p', { className: 'text-center text-gray-600' }, 'Žiadne upozornenia.')
        ) : (
            React.createElement(
                'div',
                { className: 'space-y-4' },
                displayedNotifications.map(notification => {
                    React.createElement(
                      'div',
                      { 
                        key: notification.id, 
                        className: `p-4 rounded-lg shadow-md flex flex-col justify-between items-start 
                            ${notification.deletedByMe ? 'bg-yellow-50 text-yellow-800 border border-yellow-200' : 
                               (notification.read ? 'bg-gray-100 text-gray-600' : 'bg-green-50 text-green-800 border border-green-200')}` 
                      },
                      React.createElement(
                        'div',
                        { className: 'flex-1 mb-2 w-full' },
                        // Checkbox pre obnovu ak je notifikácia deletedByMe A sme v režime obnovy
                        notification.deletedByMe && showRestoreView && React.createElement(
                          'div',
                          { className: 'flex items-center mb-2' },
                          React.createElement('input', {
                            type: 'checkbox',
                            checked: selectedNotificationsToRestore.has(notification.id),
                            onChange: (e) => handleNotificationSelectionChange(notification.id, e.target.checked),
                            className: 'form-checkbox h-4 w-4 text-indigo-600 mr-2'
                          }),
                          React.createElement('p', { className: 'text-sm text-yellow-800' }, 'Vymazané (zaškrtnite pre obnovenie)')
                        ),
                        React.createElement('p', { className: 'text-base text-gray-700 mb-2' },
                          `Používateľ ${notification.userEmail || 'Neznámy používateľ'} zmenil tento údaj:`
                        ),
                        
                        // OPRAVENÁ KONTROLA: Viac flexibilná kontrola pre rôzne typy notifikácií
                        (() => {
                          // 1. Pre notifikácie s polom changes (pôvodný formát)
                          if (notification.changes && Array.isArray(notification.changes) && notification.changes.length > 0) {
                            return React.createElement('ul', { className: 'list-disc list-inside space-y-1' },
                              notification.changes.map((change, index) => (
                                React.createElement('li', { key: index }, renderStyledText(change))
                              ))
                            );
                          }
                          
                          // 2. Pre notifikácie z AccommodationSettings (nový formát)
                          else if (notification.type && notification.data) {
                            let notificationContent = null;
                            
                            switch (notification.type) {
                              case 'createAccommodation':
                                notificationContent = React.createElement('div', { className: 'space-y-2' },
                                  React.createElement('p', { className: 'font-medium text-blue-700' }, 'Pridané nové ubytovanie:'),
                                  React.createElement('ul', { className: 'list-disc list-inside ml-4' },
                                    React.createElement('li', null, `Typ: ${notification.data.type}`),
                                    React.createElement('li', null, `Kapacita: ${notification.data.capacity}`)
                                  )
                                );
                                break;
                                
                              case 'editAccommodation':
                                notificationContent = React.createElement('div', { className: 'space-y-2' },
                                  React.createElement('p', { className: 'font-medium text-orange-700' }, 'Upravené ubytovanie:'),
                                  React.createElement('ul', { className: 'list-disc list-inside ml-4' },
                                    React.createElement('li', null, `Pôvodný typ: ${notification.data.originalType} → Nový typ: ${notification.data.newType}`),
                                    React.createElement('li', null, `Pôvodná kapacita: ${notification.data.originalCapacity} → Nová kapacita: ${notification.data.newCapacity}`)
                                  )
                                );
                                break;
                                
                              case 'deleteAccommodation':
                                notificationContent = React.createElement('div', { className: 'space-y-2' },
                                  React.createElement('p', { className: 'font-medium text-red-700' }, 'Odstránené ubytovanie:'),
                                  React.createElement('ul', { className: 'list-disc list-inside ml-4' },
                                    React.createElement('li', null, `Typ: ${notification.data.deletedType}`),
                                    React.createElement('li', null, `Kapacita: ${notification.data.deletedCapacity}`)
                                  )
                                );
                                break;
                                
                              default:
                                notificationContent = React.createElement('div', { className: 'space-y-2' },
                                  React.createElement('p', { className: 'font-medium text-gray-700' }, 'Zmena nastavení:'),
                                  React.createElement('pre', { 
                                    className: 'bg-gray-100 p-2 rounded text-sm overflow-x-auto',
                                    style: { whiteSpace: 'pre-wrap', wordWrap: 'break-word' }
                                  }, JSON.stringify(notification.data, null, 2))
                                );
                            }
                            
                            return notificationContent;
                          }
                          
                          // 3. Pre ostatné notifikácie alebo žiadne zmeny
                          else {
                            // Skontrolujme ďalšie možné formáty
                            if (notification.message) {
                              return React.createElement('p', { className: 'text-gray-700' }, notification.message);
                            } else if (notification.content) {
                              return React.createElement('p', { className: 'text-gray-700' }, notification.content);
                            } else {
                              return React.createElement('p', { className: 'text-gray-500 italic' }, 'Žiadne zmeny');
                            }
                          }
                        })(),
                        
                        notification.timestamp && React.createElement('p', { className: 'text-sm text-gray-500 mt-2' }, 
                          `Dňa: ${notification.timestamp.toLocaleDateString('sk-SK')} o ${notification.timestamp.toLocaleTimeString('sk-SK')}`
                        )
                      ),
                      // Tlačidlá sa zobrazia, len ak notifikácia nie je deletedByMe (mimo režimu obnovy)
                      !notification.deletedByMe && React.createElement(
                        'div',
                        { className: 'flex justify-end space-x-2 mt-2 w-full' },
                        !notification.read && React.createElement(
                          'button',
                          {
                            onClick: () => handleMarkAsRead(notification.id),
                            className: 'bg-green-500 hover:bg-green-600 text-white py-1 px-3 rounded-lg text-sm transition-colors duration-200',
                            disabled: loading,
                          },
                          'Označiť ako prečítané'
                        ),
                        React.createElement(
                          'button',
                          {
                            onClick: () => handleDeleteNotification(notification.id),
                            className: 'bg-red-500 hover:bg-red-600 text-white py-1 px-3 rounded-lg text-sm transition-colors duration-200',
                            disabled: loading,
                          },
                          'Vymazať'
                        )
                      )
                    );
                })
            )
        )
      )
    )
  );
}

// Explicitly expose the component globally
window.NotificationsApp = NotificationsApp;
