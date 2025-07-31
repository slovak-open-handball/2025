// logged-in-notifications.js
// Tento súbor obsahuje React komponent pre správu notifikácií prihláseného používateľa.
// Predpokladá, že Firebase SDK je inicializovaný v <head> logged-in-notifications.html.

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
    bgColorClass = 'bg-blue-500'; // Default blue for info
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
  // NEW: Get references to Firebase services directly
  const app = firebase.app();
  const auth = firebase.auth(app);
  const db = firebase.firestore(app);

  // NEW: Local state for the current user and their profile data
  // These states will be updated by the local onAuthStateChanged and onSnapshot
  const [user, setUser] = React.useState(auth.currentUser); // Initialize with current user
  const [userProfileData, setUserProfileData] = React.useState(null); 
  const [loading, setLoading] = React.useState(true); // Loading for data in NotificationsApp
  const [error, setError] = React.useState('');
  // Retained: userNotificationMessage for local notifications
  const [userNotificationMessage, setUserNotificationMessage] = React.useState('');

  const [notifications, setNotifications] = React.useState([]);
  const [allAdminUids, setAllAdminUids] = React.useState([]); // New state for storing UIDs of all administrators

  // NEW STATES FOR DELETE ALL NOTIFICATIONS MODAL
  const [showDeleteAllConfirmationModal, setShowDeleteAllConfirmationModal] = React.useState(false);
  const [deleteUnreadToo, setDeleteUnreadToo] = React.useState(false);


  // NEW: Local Auth Listener for NotificationsApp
  // This listener ensures that NotificationsApp reacts to authentication changes,
  // but primary logout/redirection is handled by GlobalNotificationHandler.
  React.useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(currentUser => {
      console.log("NotificationsApp: Local onAuthStateChanged - User:", currentUser ? currentUser.uid : "null");
      setUser(currentUser);
      // If user is not logged in, redirect (even if GNH should handle it)
      if (!currentUser) {
        console.log("NotificationsApp: User is not logged in, redirecting to login.html.");
        window.location.href = 'login.html';
      }
    });
    return () => unsubscribeAuth();
  }, [auth]); // Depends on auth instance

  // NEW: Local Effect for loading user data from Firestore
  // This effect will run when the user is logged in and db is available.
  // It assumes that passwordLastChanged and approved status are already verified in header.js.
  React.useEffect(() => {
    let unsubscribeUserDoc;

    if (user && db) { // Only runs if user is logged in and db is available
      console.log(`NotificationsApp: Attempting to load user document for UID: ${user.uid}`);
      setLoading(true); // Set loading to true while profile data is being loaded

      try {
        const userDocRef = db.collection('users').doc(user.uid);
        unsubscribeUserDoc = userDocRef.onSnapshot(docSnapshot => {
          console.log("NotificationsApp: onSnapshot for user document triggered.");
          if (docSnapshot.exists) {
            const userData = docSnapshot.data();
            console.log("NotificationsApp: User document exists, data:", userData);

            // --- IMMEDIATE LOGOUT IF passwordLastChanged IS NOT A VALID TIMESTAMP ---
            // This is added logic that runs immediately after data is loaded.
            // If passwordLastChanged is invalid or missing, log out.
            if (!userData.passwordLastChanged || typeof userData.passwordLastChanged.toDate !== 'function') {
                console.error("NotificationsApp: passwordLastChanged IS NOT a valid Timestamp object! Type:", typeof userData.passwordLastChanged, "Value:", userData.passwordLastChanged);
                console.log("NotificationsApp: Immediately logging out user due to invalid password change timestamp.");
                auth.signOut(); // Use auth from React state
                window.location.href = 'login.html';
                localStorage.removeItem(`passwordLastChanged_${user.uid}`); // Clear localStorage
                setUser(null); // Explicitly set user to null
                setUserProfileData(null); // Explicitly set userProfileData to null
                return; // Stop further processing
            }

            // Normal processing if passwordLastChanged is valid
            const firestorePasswordChangedTime = userData.passwordLastChanged.toDate().getTime();
            const localStorageKey = `passwordLastChanged_${user.uid}`;
            let storedPasswordChangedTime = parseInt(localStorage.getItem(localStorageKey) || '0', 10);

            console.log(`NotificationsApp: Firestore passwordLastChanged (converted): ${firestorePasswordChangedTime}, Stored: ${storedPasswordChangedTime}`);

            if (storedPasswordChangedTime === 0 && firestorePasswordChangedTime !== 0) {
                // First load for this user/browser, initialize localStorage and DO NOT LOG OUT
                localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
                console.log("NotificationsApp: Initializing passwordLastChanged in localStorage (first load).");
                // Do not continue here, continue with normal data processing for first load
            } else if (firestorePasswordChangedTime > storedPasswordChangedTime) {
                // Password was changed on another device/session
                console.log("NotificationsApp: Password change detected on another device/session. Logging out user.");
                auth.signOut(); // Use auth from React state
                window.location.href = 'login.html';
                localStorage.removeItem(localStorageKey); // Clear localStorage after logout
                setUser(null); // Explicitly set user to null
                setUserProfileData(null); // Explicitly set userProfileData to null
                return;
            } else if (firestorePasswordChangedTime < storedPasswordChangedTime) {
                // This ideally should not happen if Firestore is the source of truth
                console.warn("NotificationsApp: Detected older timestamp from Firestore than stored. Logging out user (potential mismatch).");
                auth.signOut(); // Use auth from React state
                window.location.href = 'login.html';
                localStorage.removeItem(localStorageKey);
                setUser(null); // Explicitly set user to null
                setUserProfileData(null); // Explicitly set userProfileData to null
                return;
            } else {
                // Times are the same, ensure localStorage is up-to-date
                localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
                console.log("NotificationsApp: Timestamps are the same, updating localStorage.");
            }

            // NEW LOGIC: Logout if user is admin and not approved
            if (userData.role === 'admin' && userData.approved === false) {
                console.log("NotificationsApp: User is admin and not approved. Logging out.");
                auth.signOut();
                window.location.href = 'login.html';
                setUser(null); // Explicitly set user to null
                setUserProfileData(null); // Explicitly set userProfileData to null
                return; // Stop further processing
            }

            setUserProfileData(userData); // Update userProfileData state
            
            setLoading(false); // Stop loading after user data is loaded
            setError(''); // Clear errors after successful load

            // Update menu visibility after role is loaded (call global function from left-menu.js)
            if (typeof window.updateMenuItemsVisibility === 'function') {
                window.updateMenuItemsVisibility(userData.role);
            } else {
                console.warn("NotificationsApp: Function updateMenuItemsVisibility is not defined.");
            }

            console.log("NotificationsApp: User data loading complete, loading: false");
          } else {
            console.warn("NotificationsApp: User document not found for UID:", user.uid);
            setError("Error: User profile not found or you do not have sufficient permissions. Please try logging in again.");
            setLoading(false); // Stop loading so error can be displayed
            setUser(null); // Explicitly set user to null
            setUserProfileData(null); // Explicitly set userProfileData to null
          }
        }, error => {
          console.error("NotificationsApp: Error loading user data from Firestore (onSnapshot error):", error);
          if (error.code === 'permission-denied') {
              setError(`Permission error: You do not have access to your profile. Please try logging in again or contact support.`);
          } else if (error.code === 'unavailable') {
              setError(`Connection error: Firestore service is unavailable. Please try again later.`);
          } else if (error.code === 'unauthenticated') {
               setError(`Authentication error: You are not logged in. Please try logging in again.`);
               if (auth) {
                  auth.signOut();
                  window.location.href = 'login.html';
                  setUser(null); // Explicitly set user to null
                  setUserProfileData(null); // Explicitly set userProfileData to null
               }
          } else {
              setError(`Error loading user data: ${error.message}`);
          }
          setLoading(false); // Stop loading even on error
          console.log("NotificationsApp: User data loading failed, loading: false");
          setUser(null); // Explicitly set user to null
          setUserProfileData(null); // Explicitly set userProfileData to null
        });
      } catch (e) {
        console.error("NotificationsApp: Error setting up onSnapshot for user data (try-catch):", e);
        setError(`Error setting up listener for user data: ${e.message}`);
        setLoading(false); // Stop loading even on error
        setUser(null); // Explicitly set user to null
        setUserProfileData(null); // Explicitly set userProfileData to null
      }
    } else if (user === null) {
        // If user is null (and not undefined), it means they have been logged out.
        // Redirection should already be handled by GlobalNotificationHandler.
        // Here, we just ensure loading is false and data is cleared.
        setLoading(false);
        setUserProfileData(null);
    }

    return () => {
      // Unsubscribe from onSnapshot on unmount
      if (unsubscribeUserDoc) {
        console.log("NotificationsApp: Unsubscribing onSnapshot for user document.");
        unsubscribeUserDoc();
      }
    };
  }, [user, db, auth]); // Depends on user and db (and auth for signOut)

  // Effect for fetching all admin Uids
  React.useEffect(() => {
    let unsubscribeAdmins;
    if (db) {
      try {
        unsubscribeAdmins = db.collection('users')
          .where('role', '==', 'admin')
          .where('approved', '==', true)
          .onSnapshot(snapshot => {
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
  }, [db]);


  // Effect for fetching notifications (runs after DB, userProfileData, user and allAdminUids are ready)
  React.useEffect(() => {
    let unsubscribeNotifications;

    // Use fixed 'default-app-id' for notification path
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'; 

    if (db && userProfileData && userProfileData.role === 'admin' && userProfileData.approved === true && user && allAdminUids.length > 0) {
      console.log("NotificationsApp: Logged-in user is an approved administrator. Loading notifications.");
      setLoading(true);
      try {
        // Load notifications for this admin, or for 'all_admins', sorted by timestamp (newest first)
        unsubscribeNotifications = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('adminNotifications')
          .where('recipientId', 'in', [user.uid, 'all_admins']) // Filter by current admin's ID OR 'all_admins'
          .onSnapshot(snapshot => {
            const fetchedNotifications = [];
            snapshot.forEach(doc => {
              const data = doc.data();
              // Display notification only if it's not marked as deleted for the current user
              const isDeletedForCurrentUser = data.deletedFor && data.deletedFor.includes(user.uid);
              if (!isDeletedForCurrentUser) {
                fetchedNotifications.push({
                  id: doc.id,
                  ...data,
                  timestamp: data.timestamp ? data.timestamp.toDate() : null // Convert Timestamp to Date object
                });
              }
            });
            // Sort notifications from newest to oldest
            fetchedNotifications.sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0));
            setNotifications(fetchedNotifications);
            setLoading(false);
            setError('');
            console.log("NotificationsApp: Notifications updated from onSnapshot.");
          }, error => {
            console.error("NotificationsApp: Error loading notifications from Firestore (onSnapshot error):", error);
            setError(`Error loading notifications: ${error.message}`);
            setLoading(false);
          });
      } catch (e) {
        console.error("NotificationsApp: Error setting up onSnapshot for notifications (try-catch):", e);
        setError(`Error setting up listener for notifications: ${e.message}`);
        setLoading(false);
      }
    } else {
        setNotifications([]); // Clear notifications if not admin
    }

    return () => {
      if (unsubscribeNotifications) {
        console.log("NotificationsApp: Unsubscribing onSnapshot for notifications.");
        unsubscribeNotifications();
      }
    };
  }, [db, userProfileData, user, allAdminUids]); // Depends on db, userProfileData (for admin role), user (for UID) and allAdminUids

  const handleMarkAsRead = async (notificationId) => {
    if (!db || !user || !userProfileData || userProfileData.role !== 'admin') {
      setError("You do not have permission to mark the notification as read.");
      return;
    }
    setLoading(true);
    setError('');
    try {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('adminNotifications').doc(notificationId).update({
        read: true
      });
      setUserNotificationMessage("Notification marked as read.");
    } catch (e) {
      console.error("NotificationsApp: Error marking notification as read:", e);
      setError(`Error marking notification as read: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNotification = async (notificationId) => {
    if (!db || !user || !userProfileData || userProfileData.role !== 'admin' || !user.uid) {
      setError("You do not have permission to delete the notification.");
      return;
    }
    setLoading(true);
    setError('');
    try {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const notificationRef = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('adminNotifications').doc(notificationId);

      // Load current state of the notification
      const doc = await notificationRef.get();
      if (!doc.exists) {
        setUserNotificationMessage("Notification has been deleted for you."); // Updated message
        setLoading(false);
        return;
      }

      const notificationData = doc.data();
      let deletedFor = notificationData.deletedFor || [];

      // Add the current administrator's ID to the 'deletedFor' list
      if (!deletedFor.includes(user.uid)) {
        deletedFor.push(user.uid);
      }

      // If all administrators "deleted" this notification, delete it completely
      if (allAdminUids.length > 0 && deletedFor.length >= allAdminUids.length) {
        await notificationRef.delete();
        setUserNotificationMessage("Notification has been deleted for you."); // Updated message
        console.log(`Notification ${notificationId} has been completely deleted from the database.`);
      } else {
        // Otherwise, just update the 'deletedFor' field
        await notificationRef.update({
          deletedFor: deletedFor
        });
        setUserNotificationMessage("Notification has been deleted for you."); // Updated message
        console.log(`Notification ${notificationId} has been hidden for user ${user.uid}.`);
      }
    } catch (e) {
      console.error("NotificationsApp: Error deleting notification:", e);
      setError(`Error deleting notification: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // NEW FUNCTION: Mark all unread notifications as read
  const handleMarkAllAsRead = async () => {
    if (!db || !user || !userProfileData || userProfileData.role !== 'admin') {
      setError("You do not have permission to mark notifications as read.");
      return;
    }
    setLoading(true);
    setError('');
    try {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const unreadNotifications = notifications.filter(n => !n.read);

      if (unreadNotifications.length === 0) {
        setUserNotificationMessage("No unread notifications to mark.");
        setLoading(false);
        return;
      }

      // Create a batch operation for more efficient updates
      const batch = db.batch();
      unreadNotifications.forEach(notification => {
        const notificationRef = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('adminNotifications').doc(notification.id);
        batch.update(notificationRef, { read: true });
      });

      await batch.commit();
      setUserNotificationMessage("All unread notifications have been marked as read.");
    } catch (e) {
      console.error("NotificationsApp: Error marking all notifications as read:", e);
      setError(`Error marking all notifications as read: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Original handleDeleteAllNotifications function, now opens the modal
  const handleDeleteAllNotificationsClick = () => {
    setShowDeleteAllConfirmationModal(true);
    setDeleteUnreadToo(false); // Reset checkbox when modal opens
  };

  // NEW FUNCTION: Delete all notifications (confirmed action)
  const confirmDeleteAllNotifications = async () => {
    if (!db || !user || !userProfileData || userProfileData.role !== 'admin' || !user.uid) {
      setError("You do not have permission to delete all notifications.");
      return;
    }
    setLoading(true);
    setError('');
    try {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      
      let notificationsToProcess = notifications;
      if (!deleteUnreadToo) {
        notificationsToProcess = notifications.filter(n => n.read); // Delete only read ones
      }

      if (notificationsToProcess.length === 0) {
        setUserNotificationMessage("No notifications to delete.");
        setLoading(false);
        setShowDeleteAllConfirmationModal(false);
        return;
      }

      const batch = db.batch();
      notificationsToProcess.forEach(notification => {
        const notificationRef = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('adminNotifications').doc(notification.id);
        
        let deletedFor = notification.deletedFor || [];
        if (!deletedFor.includes(user.uid)) {
          deletedFor.push(user.uid);
        }

        if (allAdminUids.length > 0 && deletedFor.length >= allAdminUids.length) {
          batch.delete(notificationRef); // Complete deletion
        } else {
          batch.update(notificationRef, { deletedFor: deletedFor }); // Update deletedFor
        }
      });

      await batch.commit();
      setUserNotificationMessage("All selected notifications have been deleted.");
      setShowDeleteAllConfirmationModal(false); // Close modal after successful action
    } catch (e) {
      console.error("NotificationsApp: Error deleting all notifications:", e);
      setError(`Error deleting all notifications: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };


  // Display loading state
  if (!user || (user && !userProfileData) || loading) {
    if (user === null) {
        console.log("NotificationsApp: User is null, redirecting to login.html");
        window.location.href = 'login.html';
        return null;
    }
    let loadingMessage = 'Loading...';
    if (user && !userProfileData) {
        loadingMessage = 'Loading...';
    } else if (loading) {
        loadingMessage = 'Loading...';
    }

    return React.createElement(
      'div',
      { className: 'flex items-center justify-center min-h-screen bg-gray-100' },
      React.createElement('div', { className: 'text-xl font-semibold text-gray-700' }, loadingMessage)
    );
  }

  // If user is not admin, redirect
  if (userProfileData && (userProfileData.role !== 'admin' || userProfileData.approved !== true)) {
    console.log("NotificationsApp: User is not an approved administrator, redirecting.");
    window.location.href = 'logged-in-my-data.html'; // Redirect to logged-in-my-data.html
    return null;
  }

  // Conditions for displaying buttons
  const hasAtLeastTwoNotifications = notifications.length >= 2;
  const hasAtLeastTwoUnreadNotifications = notifications.filter(n => !n.read).length >= 2;

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
    React.createElement(NotificationModal, {
        message: userNotificationMessage,
        onClose: () => setUserNotificationMessage('')
    }),
    React.createElement(ConfirmationModal, {
        show: showDeleteAllConfirmationModal,
        message: "Are you sure you want to delete all notifications?",
        onConfirm: confirmDeleteAllNotifications,
        onCancel: () => setShowDeleteAllConfirmationModal(false),
        loading: loading,
        showCheckbox: notifications.some(n => !n.read), // Show checkbox only if unread notifications exist
        checkboxLabel: "Delete unread notifications too",
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
        // NEW: "Mark all as read" and "Delete all" buttons
        (hasAtLeastTwoNotifications || hasAtLeastTwoUnreadNotifications) && React.createElement(
          'div',
          { className: 'flex justify-center space-x-4 mb-6' },
          hasAtLeastTwoUnreadNotifications && React.createElement(
            'button',
            {
              onClick: handleMarkAllAsRead,
              className: 'bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200',
              disabled: loading,
            },
            'Označiť všetky ako prečítané'
          ),
          hasAtLeastTwoNotifications && React.createElement(
            'button',
            {
              onClick: handleDeleteAllNotificationsClick, // CHANGE: Calls new function to open modal
              className: 'bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200',
              disabled: loading,
            },
            'Vymazať všetky'
          )
        ),
        notifications.length === 0 && !loading ? (
            React.createElement('p', { className: 'text-center text-gray-600' }, 'Žiadne upozornenia.')
        ) : (
            React.createElement(
                'div',
                { className: 'space-y-4' },
                notifications.map(notification => (
                    React.createElement(
                        'div',
                        { 
                            key: notification.id, 
                            className: `p-4 rounded-lg shadow-md flex justify-between items-center ${notification.read ? 'bg-gray-100 text-gray-600' : 'bg-blue-50 text-blue-800 border border-blue-200'}` 
                        },
                        React.createElement(
                            'div',
                            { className: 'flex-1' },
                            React.createElement('p', { className: 'font-semibold' }, notification.message),
                            notification.timestamp && React.createElement('p', { className: 'text-sm text-gray-500' }, 
                                `Dňa: ${notification.timestamp.toLocaleDateString('sk-SK')} o ${notification.timestamp.toLocaleTimeString('sk-SK')}`
                            )
                        ),
                        React.createElement(
                            'div',
                            { className: 'flex space-x-2 ml-4' },
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
                                'Vymazať' // CHANGE: Button text
                            )
                        )
                    )
                ))
            )
        )
      )
    )
  );
}

// Explicitly expose the component globally
window.NotificationsApp = NotificationsApp;
