// logged-in-users.js (teraz obsahuje UsersManagementApp pre správu používateľov)
// Tento súbor predpokladá, že firebaseConfig, initialAuthToken a appId
// sú globálne definované v <head> logged-in-users.html.
// Všetky komponenty a logika pre správu používateľov sú teraz v tomto súbore.

// Imports for necessary Firebase functions
import {
  collection,
  query,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  increment,
  setDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// NotificationModal Component
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

  const baseClasses = "fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[99999] transition-opacity duration-300";
  const typeClasses = {
    'info': 'bg-blue-500 text-white',
    'success': 'bg-green-500 text-white',
    'warning': 'bg-yellow-500 text-black',
    'error': 'bg-red-500 text-white',
  };

  const notificationClass = `${baseClasses} ${typeClasses[type]} ${show ? 'opacity-100' : 'opacity-0'}`;

  return React.createElement(
    'div',
    { className: notificationClass },
    React.createElement('span', null, message)
  );
}

// Global notification function
window.showGlobalNotification = (message, type = 'success') => {
  let notificationElement = document.getElementById('global-notification-root');
  if (!notificationElement) {
    notificationElement = document.createElement('div');
    notificationElement.id = 'global-notification-root';
    document.body.appendChild(notificationElement);
  }

  const root = ReactDOM.createRoot(notificationElement);
  root.render(React.createElement(NotificationModal, { message, type, onClose: () => root.render(null) }));
};

const { useState, useEffect, useRef } = React;

// Komponent pre potvrdzovacie modálne okno
function ConfirmationModal({ message, onConfirm, onCancel }) {
  return React.createElement(
    'div',
    { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center z-50' },
    React.createElement(
      'div',
      { className: 'bg-white p-8 rounded-lg shadow-xl w-96' },
      React.createElement('h2', { className: 'text-xl font-bold mb-4' }, 'Potvrdenie'),
      React.createElement('p', { className: 'mb-6' }, message),
      React.createElement('div', { className: 'flex justify-end' },
        React.createElement(
          'button',
          {
            onClick: onCancel,
            className: 'bg-gray-300 text-gray-800 px-4 py-2 rounded-md mr-2 hover:bg-gray-400 transition-colors'
          },
          'Zrušiť'
        ),
        React.createElement(
          'button',
          {
            onClick: onConfirm,
            className: 'bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition-colors'
          },
          'Potvrdiť'
        )
      )
    )
  );
}

// Komponent pre modálne okno na zmenu roly
function ChangeRoleModal({ user, onClose, onRoleChange }) {
  const [selectedRole, setSelectedRole] = useState(user.role);

  const handleSave = () => {
    onRoleChange(user.id, selectedRole);
    onClose();
  };

  return React.createElement(
    'div',
    { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center z-50' },
    React.createElement(
      'div',
      { className: 'bg-white p-8 rounded-lg shadow-xl w-96' },
      React.createElement('h2', { className: 'text-2xl font-bold mb-4' }, `Zmeniť rolu pre ${user.firstName} ${user.lastName}`),
      React.createElement('div', { className: 'mb-4' },
        ['admin', 'user', 'hall'].map(role =>
          React.createElement('div', { key: role, className: 'flex items-center mb-2' },
            React.createElement('input', {
              type: 'radio',
              id: role,
              name: 'role',
              value: role,
              checked: selectedRole === role,
              onChange: (e) => setSelectedRole(e.target.value),
              className: 'form-radio h-4 w-4 text-indigo-600 transition duration-150 ease-in-out'
            }),
            React.createElement('label', { htmlFor: role, className: 'ml-2 text-gray-700' },
              role === 'admin' ? 'Administrátor' : role === 'hall' ? 'Športová hala' : 'Používateľ'
            )
          )
        )
      ),
      React.createElement('div', { className: 'flex justify-end' },
        React.createElement(
          'button',
          {
            onClick: onClose,
            className: 'bg-gray-300 text-gray-800 px-4 py-2 rounded-md mr-2'
          },
          'Zrušiť'
        ),
        React.createElement(
          'button',
          {
            onClick: handleSave,
            className: 'bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700'
          },
          'Uložiť'
        )
      )
    )
  );
}

// Nový komponent pre modálne okno na filtrovanie rolí
function FilterRolesModal({ onClose, onApplyFilter, initialRoles }) {
    const [selectedRoles, setSelectedRoles] = useState(initialRoles);

    const handleRoleChange = (role) => {
        setSelectedRoles(prevRoles =>
            prevRoles.includes(role)
                ? prevRoles.filter(r => r !== role)
                : [...prevRoles, role]
        );
    };

    const handleApply = () => {
        onApplyFilter(selectedRoles);
        onClose();
    };

    const handleClear = () => {
        onApplyFilter([]);
        onClose();
    };

    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center z-50' },
        React.createElement(
            'div',
            { className: 'bg-white p-8 rounded-lg shadow-xl w-96' },
            React.createElement('h2', { className: 'text-2xl font-bold mb-4' }, 'Filtrovať podľa roly'),
            React.createElement('div', { className: 'mb-4' },
                React.createElement('div', { className: 'flex items-center mb-2' },
                    React.createElement('input', {
                        type: 'checkbox',
                        id: 'filter-admin',
                        checked: selectedRoles.includes('admin'),
                        onChange: () => handleRoleChange('admin'),
                        className: 'form-checkbox h-4 w-4 text-indigo-600'
                    }),
                    React.createElement('label', { htmlFor: 'filter-admin', className: 'ml-2 text-gray-700' }, 'Administrátor')
                ),
                React.createElement('div', { className: 'flex items-center mb-2' },
                    React.createElement('input', {
                        type: 'checkbox',
                        id: 'filter-hall',
                        checked: selectedRoles.includes('hall'),
                        onChange: () => handleRoleChange('hall'),
                        className: 'form-checkbox h-4 w-4 text-indigo-600'
                    }),
                    React.createElement('label', { htmlFor: 'filter-hall', className: 'ml-2 text-gray-700' }, 'Športová hala')
                ),
                React.createElement('div', { className: 'flex items-center mb-2' },
                    React.createElement('input', {
                        type: 'checkbox',
                        id: 'filter-user',
                        checked: selectedRoles.includes('user'),
                        onChange: () => handleRoleChange('user'),
                        className: 'form-checkbox h-4 w-4 text-indigo-600'
                    }),
                    React.createElement('label', { htmlFor: 'filter-user', className: 'ml-2 text-gray-700' }, 'Používateľ')
                )
            ),
            React.createElement('div', { className: 'flex justify-end' },
                React.createElement(
                    'button',
                    {
                        onClick: handleClear,
                        className: 'bg-red-500 text-white px-4 py-2 rounded-md mr-2'
                    },
                    'Vymazať filter'
                ),
                React.createElement(
                    'button',
                    {
                        onClick: onClose,
                        className: 'bg-gray-300 text-gray-800 px-4 py-2 rounded-md mr-2'
                    },
                    'Zrušiť'
                ),
                React.createElement(
                    'button',
                    {
                        onClick: handleApply,
                        className: 'bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700'
                    },
                    'Potvrdiť'
                )
            )
        )
    );
}

function UsersManagementApp() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState({ message: '', type: 'info' });
  const [userToEdit, setUserToEdit] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);
  const [oldestAdminId, setOldestAdminId] = useState(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState([]);
  
  const googleScriptUrl_for_email = 'https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec';
  const db = window.db;
  const appId = window.appId;
  const auth = window.auth;
  const globalUserProfileData = window.globalUserProfileData;

  // Default deadlines
  const DEFAULT_DATA_EDIT_DEADLINE = new Date('2025-08-29T14:00:00Z'); // August 29, 2025 at 4:00:00 PM UTC+2
  const DEFAULT_ROSTER_EDIT_DEADLINE = new Date('2025-09-14T20:00:00Z'); // September 14, 2025 at 10:00:00 PM UTC+2

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      if (!globalUserProfileData) {
        console.log("UsersManagementApp: Dáta používateľa nie sú dostupné.");
        setLoading(false);
        return;
      }
      
      const isUserAdmin = globalUserProfileData?.role === 'admin' && globalUserProfileData?.approved === true;
      window.isCurrentUserAdmin = isUserAdmin;
      window.currentUserId = auth.currentUser?.uid;
      
      if (isUserAdmin) {
        const usersCollectionPath = `users`; 
        const usersCol = collection(db, usersCollectionPath);
        
        // Nový onSnapshot poslucháč pre okamžité zobrazenie adminCount
        const adminCountRef = doc(db, `settings`, `adminCount`);
        const unsubscribeAdminCount = onSnapshot(adminCountRef, (adminCountSnap) => {
          if (adminCountSnap.exists()) {
            console.log('Aktuálna hodnota adminCount:', adminCountSnap.data().count);
          } else {
            console.log('Dokument adminCount neexistuje.');
          }
        }, (error) => {
          console.error("Chyba pri načítaní adminCount:", error);
        });
        
        const q = query(usersCol);
        
        const unsubscribeUsers = onSnapshot(q, async (snapshot) => { // Added async here
          const usersList = await Promise.all(snapshot.docs.map(async docSnapshot => { // Used Promise.all for async operations
            const userData = {
              id: docSnapshot.id,
              ...docSnapshot.data()
            };

            // Check and set default deadlines for 'user' role
            if (userData.role === 'user') { // Corrected condition here
                let needsUpdate = false;
                if (!userData.dataEditDeadline) {
                    userData.dataEditDeadline = DEFAULT_DATA_EDIT_DEADLINE;
                    needsUpdate = true;
                }
                if (!userData.rosterEditDeadline) {
                    userData.rosterEditDeadline = DEFAULT_ROSTER_EDIT_DEADLINE;
                    needsUpdate = true;
                }

                if (needsUpdate) {
                    // Update the document in Firestore if new fields were added
                    await updateDoc(doc(db, `users`, userData.id), {
                        dataEditDeadline: userData.dataEditDeadline,
                        rosterEditDeadline: userData.rosterEditDeadline
                    });
                }
            }
            return userData;
          }));
          
          const adminUsers = usersList.filter(user => user.role === 'admin' && user.approved === true);
          if (adminUsers.length > 0) {
            adminUsers.sort((a, b) => {
              const dateA = a.registrationDate?.seconds ? new Date(a.registrationDate.seconds * 1000 + (a.registrationDate.nanoseconds || 0) / 1000000) : new Date(0);
              const dateB = b.registrationDate?.seconds ? new Date(b.registrationDate.seconds * 1000 + (b.registrationDate.nanoseconds || 0) / 1000000) : new Date(0);
              return dateA - dateB;
            });
            setOldestAdminId(adminUsers[0].id);
          } else {
            setOldestAdminId(null);
          }
          
          setUsers(usersList);
          setLoading(false);
        }, (error) => {
          console.error("Chyba pri načítaní používateľov:", error);
          setLoading(false);
          setNotification({ message: 'Chyba pri načítaní používateľov.', type: 'error' });
        });
        
        // Čistiaca funkcia na odhlásenie oboch poslucháčov
        return () => {
          unsubscribeUsers();
          unsubscribeAdminCount();
        };
      } else {
        setLoading(false);
      }
    };

    fetchData();
  }, [globalUserProfileData]);

  const handleChangeRole = async (userId, newRole) => {
    try {
      // 1. Získame referencie na dokumenty a ich dáta
      const userDocRef = doc(db, `users`, userId);
      const userSnap = await getDoc(userDocRef);
      if (!userSnap.exists()) {
        setNotification({ message: 'Používateľ nebol nájdený.', type: 'error' });
        return;
      }
      const oldRole = userSnap.data().role;
      const wasApproved = userSnap.data().approved; // Získame pôvodný stav schválenia
      
      // 2. Skontrolujeme, či došlo k zmene roly z 'admin'
      const isApproved = newRole !== 'admin';
      
      // Ak meníme rolu z 'admin' na inú a používateľ bol schválený, znížime počítadlo adminov
      if (oldRole === 'admin' && newRole !== 'admin' && wasApproved) {
        const adminCountRef = doc(db, `settings`, `adminCount`);
        const adminCountSnap = await getDoc(adminCountRef);

        const currentAdminCount = adminCountSnap.exists() ? adminCountSnap.data().count : 0;
        const newCount = Math.max(1, currentAdminCount - 1);
        
        console.log(`Aktuálna hodnota adminCount: ${currentAdminCount}`);
        console.log(`Nová hodnota adminCount: ${newCount}`);
          
        await updateDoc(adminCountRef, {
            count: newCount
        });
      }

      await updateDoc(userDocRef, {
        role: newRole,
        approved: isApproved
      });
      
      setNotification({ message: `Rola používateľa bola úspešne zmenená na ${newRole}.`, type: 'success' });
    } catch (error) {
      console.error("Chyba pri zmene roly používateľa:", error);
      setNotification({ message: 'Nepodarilo sa zmeniť rolu používateľa.', type: 'error' });
    }
  };
  
  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      const userDocRef = doc(db, `users`, userToDelete.id);
      
      if (userToDelete.role === 'admin' && userToDelete.approved === true) {
        const adminCountRef = doc(db, `settings`, `adminCount`);
        const adminCountSnap = await getDoc(adminCountRef);
        
        const currentAdminCount = adminCountSnap.exists() ? adminCountSnap.data().count : 0;
        const newCount = Math.max(1, currentAdminCount - 1);

        console.log(`Aktuálna hodnota adminCount: ${currentAdminCount}`);
        console.log(`Nová hodnota adminCount: ${newCount}`);
        
        await updateDoc(adminCountRef, {
            count: newCount
        });
      }
      
      await deleteDoc(userDocRef);

      // Pridaná funkčnosť: Po úspešnom odstránení používateľa otvoríme novú kartu s Firebase Console
      // Spoliehame sa na globálne definovaný window.firebaseConfig
      if (window.firebaseConfig && window.firebaseConfig.projectId) {
        const projectId = window.firebaseConfig.projectId;
        const firebaseConsoleUrl = `https://console.firebase.google.com/project/${projectId}/authentication/users`;
        window.open(firebaseConsoleUrl, '_blank');
      } else {
        console.error("Firebase projectId nie je k dispozícii. Uistite sa, že 'firebaseConfig' je globálne definovaný.");
      }

      setNotification({ message: `Používateľ ${userToDelete.firstName} bol úspešne odstránený.`, type: 'success' });
    } catch (error) {
      console.error("Chyba pri odstraňovaní používateľa:", error);
      setNotification({ message: 'Nepodarilo sa odstrániť používateľa.', type: 'error' });
    } finally {
      setUserToDelete(null);
    }
  };

  const sendApprovalEmail = async (userEmail) => {
    if (!googleScriptUrl_for_email) {
      console.error("Google Apps Script URL nie je definovaná.");
      setNotification({ message: 'Chyba: URL skriptu nebola nájdená.', type: 'error' });
      return;
    }
  
    try {
      const payload = {
        action: 'sendAdminApprovalEmail',
        email: userEmail,
        firstName: users.find(u => u.email === userEmail)?.firstName,
        lastName: users.find(u => u.email === userEmail)?.lastName,
      };
  
      const response = await fetch(googleScriptUrl_for_email, {
        method: 'POST',
        mode: 'no-cors',
        cache: 'no-cache',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
  
      console.log('Požiadavka na odoslanie e-mailu odoslaná.');
      setNotification({ message: `E-mail o schválení bol odoslaný na ${userEmail}.`, type: 'success' });
    } catch (error) {
      console.error("Chyba pri odosielaní e-mailu o schválení:", error);
      setNotification({ message: 'Nepodarilo sa odoslať e-mail o schválení.', type: 'error' });
    }
  };
  

  const handleApproveAdmin = async (userId, userEmail) => {
    try {
      const userDocRef = doc(db, `users`, userId);
      const adminCountRef = doc(db, `settings`, `adminCount`);
      
      await updateDoc(userDocRef, {
        approved: true
      });
      
      const adminCountSnap = await getDoc(adminCountRef);
      
      if (adminCountSnap.exists()) {
        const currentAdminCount = adminCountSnap.data().count;
        console.log(`Aktuálna hodnota adminCount: ${currentAdminCount}`);
        
        await updateDoc(adminCountRef, {
          count: increment(1)
        });
      } else {
        console.log('Dokument adminCount neexistuje, vytvárame ho s hodnotou 1.');
        await setDoc(adminCountRef, {
          count: 1
        });
      }
      
      await sendApprovalEmail(userEmail);
      
      setNotification({ message: `Admin bol úspešne schválený a e-mail bol odoslaný.`, type: 'success' });
    } catch (error) {
      console.error("Chyba pri schvaľovaní admina:", error);
      setNotification({ message: 'Nepodarilo sa schváliť admina.', type: 'error' });
    }
  };

  const getRoleColor = (role) => {
      switch (role) {
          case 'admin':
              return '#47b3ff';
          case 'hall':
              return '#b06835';
          case 'user':
              return '#9333EA';
          default:
              return '#1D4ED8';
      }
  };

  const getTranslatedRole = (role, isUserOldestAdmin, isCurrentUserOldestAdmin) => {
      if (isUserOldestAdmin && isCurrentUserOldestAdmin) {
          return 'Superadministrátor';
      }
      switch (role) {
          case 'admin':
              return 'Administrátor';
          case 'hall':
              return 'Športová hala';
              case 'user':
              return 'Používateľ';
          default:
              return role;
      }
  };

  const formatDate = (date) => {
    if (!date) return '-';
    // Firebase Timestamp object handling
    if (date.toDate) {
      date = date.toDate();
    }
    // Check if it's a valid Date object
    if (!(date instanceof Date) || isNaN(date)) {
        return '-';
    }
    return date.toLocaleDateString('sk-SK', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };


  if (loading) {
    return React.createElement(
      'div', { className: 'flex justify-center pt-16' },
      React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
    );
  }

  if (window.isCurrentUserAdmin === false) {
    return React.createElement(
      'div', { className: 'flex items-center justify-center h-full' },
      React.createElement('h1', { className: 'text-3xl font-bold text-gray-700' }, 'Nemáte oprávnenie na zobrazenie tejto stránky.')
    );
  }
  
  const isCurrentUserOldestAdmin = globalUserProfileData?.id === oldestAdminId;
  
  // Funkcia na triedenie používateľov
  const sortUsers = (usersList) => {
      const oldestAdmin = usersList.find(u => u.id === oldestAdminId);
      const currentUser = usersList.find(u => u.id === window.currentUserId);
      const otherUsers = usersList.filter(u => u.id !== oldestAdminId && u.id !== window.currentUserId);

      // Triedenie ostatných používateľov podľa slovenskej abecedy
      otherUsers.sort((a, b) => {
          const lastNameComparison = a.lastName.localeCompare(b.lastName, 'sk');
          if (lastNameComparison !== 0) {
              return lastNameComparison;
          }
          return a.firstName.localeCompare(b.firstName, 'sk');
      });

      // Zostavenie finálneho poľa
      const sortedList = [];
      if (oldestAdmin) {
          sortedList.push(oldestAdmin);
      }
      if (currentUser && currentUser.id !== oldestAdminId) {
          sortedList.push(currentUser);
      }
      return [...sortedList, ...otherUsers];
  };

  const sortedUsers = sortUsers(users);
  
  const filteredUsers = selectedRoles.length > 0 ? sortedUsers.filter(user => selectedRoles.includes(user.role)) : sortedUsers;

  return React.createElement(
    'div',
    { className: 'flex-grow p-4 md:p-8 bg-gray-100 rounded-lg shadow-inner' },
    React.createElement('h1', { className: 'text-3xl font-bold text-gray-800 mb-6' }, 'Správa používateľov'),
    React.createElement(
      'div',
      { className: 'overflow-x-auto bg-white rounded-lg shadow' },
      React.createElement(
        'table',
        { className: 'min-w-full divide-y divide-gray-200' },
        React.createElement(
          'thead',
          { className: 'bg-gray-50' },
          React.createElement(
            'tr',
            null,
            React.createElement('th', { className: 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider' }, 'Meno'),
            React.createElement('th', { className: 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider' }, 'E-mail'),
            React.createElement('th', { className: 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer', onClick: () => setShowFilterModal(true) }, 'Rola'),
            (window.isCurrentUserAdmin) && React.createElement('th', { className: 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider' }, 'Úprava údajov'),
            (window.isCurrentUserAdmin) && React.createElement('th', { className: 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider' }, 'Úprava súpisiek'),
            React.createElement('th', { className: 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider' }, 'Akcie')
          )
        ),
        React.createElement(
          'tbody',
          { className: 'bg-white divide-y divide-gray-200' },
          filteredUsers.map(user => {
            const isNotCurrentUser = user.id !== window.currentUserId;
            const isUserOldestAdmin = user.id === oldestAdminId;
            const canChangeRole = window.isCurrentUserAdmin && isNotCurrentUser && !isUserOldestAdmin;
            
            // Logika na skrytie riadku pre ostatných používateľov
            if (isUserOldestAdmin && !isCurrentUserOldestAdmin) {
              return null;
            }
            
            return React.createElement(
              'tr',
              { key: user.id },
              React.createElement('td', { className: 'px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900' }, `${user.firstName} ${user.lastName}`),
              React.createElement('td', { className: 'px-6 py-4 whitespace-nowrap text-sm text-gray-500' }, user.email),
              React.createElement(
                'td',
                { className: 'px-6 py-4 whitespace-nowrap text-sm' },
                React.createElement(
                  'span',
                  { style: { color: getRoleColor(user.role) }, className: 'font-semibold' },
                  getTranslatedRole(user.role, isUserOldestAdmin, isCurrentUserOldestAdmin)
                )
              ),
              (window.isCurrentUserAdmin) && React.createElement('td', { className: 'px-6 py-4 whitespace-nowrap text-sm text-gray-500' }, formatDate(user.dataEditDeadline)),
              (window.isCurrentUserAdmin) && React.createElement('td', { className: 'px-6 py-4 whitespace-nowrap text-sm text-gray-500' }, formatDate(user.rosterEditDeadline)),
              React.createElement(
                'td',
                { className: 'px-6 py-4 whitespace-nowrap text-sm font-medium' },
                // Akcie s tlacitkami su podmienene na zaklade roly a schvalenia
                isNotCurrentUser ?
                  React.createElement(React.Fragment, null,
                    // Tlacidlo "Schvalit" je viditelne pre schvalenych adminov a len pre Neschvalenych adminov
                    (window.isCurrentUserAdmin && user.role === 'admin' && !user.approved) && React.createElement(
                      'button',
                      {
                        onClick: () => handleApproveAdmin(user.id, user.email),
                        className: 'bg-green-500 text-white px-4 py-2 rounded-full shadow-md hover:bg-green-600 transition-colors duration-200 ease-in-out mr-2'
                      },
                      'Schváliť'
                    ),
                    // Tlacidlo "Upravit rolu" je viditelne pre schvalenych adminov (okrem najstarsiho) a pre neschvalenych adminov
                    ((canChangeRole) || (window.isCurrentUserAdmin && user.role === 'admin' && !user.approved)) && React.createElement(
                      'button',
                      {
                        onClick: () => setUserToEdit(user),
                        className: 'bg-blue-500 text-white px-4 py-2 rounded-full shadow-md hover:bg-blue-600 transition-colors duration-200 ease-in-out mr-2'
                      },
                      'Upraviť rolu'
                    )
                  ) : null,
                // Tlačidlo "Odstrániť" sa zobrazí len pre superadministrátora, a to pre všetkých ostatných používateľov okrem neho samotného
                (isCurrentUserOldestAdmin && user.id !== window.currentUserId) && React.createElement(
                  'button',
                  {
                    onClick: () => setUserToDelete(user),
                    className: 'bg-red-500 text-white px-4 py-2 rounded-full shadow-md hover:bg-red-600 transition-colors duration-200 ease-in-out ml-2'
                  },
                  'Odstrániť'
                )
              )
            )
          })
        )
      )
    ),
    React.createElement(NotificationModal, { message: notification.message, onClose: () => setNotification({ message: '', type: 'info' }), type: notification.type }),
    userToEdit && React.createElement(ChangeRoleModal, {
      user: userToEdit,
      onClose: () => setUserToEdit(null),
      onRoleChange: handleChangeRole
    }),
    userToDelete && React.createElement(ConfirmationModal, {
      message: `Naozaj chcete odstrániť používateľa ${userToDelete.firstName} ${userToDelete.lastName}? Táto akcia je nezvratná.`,
      onConfirm: handleDeleteUser,
      onCancel: () => setUserToDelete(null)
    }),
    showFilterModal && React.createElement(FilterRolesModal, {
        onClose: () => setShowFilterModal(false),
        onApplyFilter: (roles) => {
            setSelectedRoles(roles);
            setShowFilterModal(false);
        },
        initialRoles: selectedRoles
    })
  );
}

// Funkcia na inicializáciu a vykreslenie React aplikácie
const initializeAndRenderApp = () => {
  const rootElement = document.getElementById('users-management-root');

  if (!window.isGlobalAuthReady || !window.globalUserProfileData) {
    console.log("logged-in-users.js: Čakám na inicializáciu autentifikácie a načítanie dát používateľa...");
    return;
  }

  window.removeEventListener('globalDataUpdated', initializeAndRenderApp);

  if (typeof React === 'undefined' || typeof ReactDOM === 'undefined') {
    console.error("Chyba: React alebo ReactDOM nie sú načítané. Skontrolujte poradie skriptov.");
    if (rootElement) {
      rootElement.innerHTML = '<div style="color: red; text-align: center; padding: 20px;">Chyba pri načítaní aplikácie. Skúste to prosím neskôr.</div>';
    }
    return;
  }

  const root = ReactDOM.createRoot(rootElement);
  root.render(React.createElement(UsersManagementApp, null));
  console.log("logged-in-users.js: React App (UsersManagementApp) vykreslená.");
};

// Vykreslíme loader a zaregistrujeme poslucháča udalostí
const rootElement = document.getElementById('users-management-root');
if (rootElement) {
    rootElement.innerHTML = `
        <div class="flex justify-center pt-16">
            <div class="animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500"></div>
        </div>
    `;
}
window.addEventListener('globalDataUpdated', initializeAndRenderApp);

// Pre prípad, že udalosť už prebehla
if (window.isGlobalAuthReady && window.globalUserProfileData) {
    console.log('logged-in-users.js: Globálne dáta už existujú. Vykresľujem aplikáciu okamžite.');
    initializeAndRenderApp();
}
