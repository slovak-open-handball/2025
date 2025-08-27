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
              role === 'admin' ? 'Administr\u00e1tor' : role === 'hall' ? '\u0160portov\u00e1 hala' : 'Pou\u017E\u00edvate\u013E'
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

function UsersManagementApp() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState({ message: '', type: 'info' });
  const [userToEdit, setUserToEdit] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);
  const [oldestAdminId, setOldestAdminId] = useState(null);
  
  const googleScriptUrl_for_email = 'https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec';
  const db = window.db;
  const appId = window.appId;
  const auth = window.auth;
  const globalUserProfileData = window.globalUserProfileData;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      if (!globalUserProfileData) {
        console.log("UsersManagementApp: D\u00e1ta pou\u017E\u00edvate\u013Ea nie s\u00fa dostupn\u00e9.");
        setLoading(false);
        return;
      }
      
      const isUserAdmin = globalUserProfileData?.role === 'admin' && globalUserProfileData?.approved === true;
      window.isCurrentUserAdmin = isUserAdmin;
      window.currentUserId = auth.currentUser?.uid;
      
      if (isUserAdmin) {
        const usersCollectionPath = `users`; 
        const usersCol = collection(db, usersCollectionPath);
        const q = query(usersCol);

        const unsubscribeUsers = onSnapshot(q, (snapshot) => {
          const usersList = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
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
          console.error("Chyba pri na\u010D\u00edtan\u00ed pou\u017E\u00EDvate\u013Eov:", error);
          setLoading(false);
          setNotification({ message: 'Chyba pri na\u010D\u00edtan\u00ed pou\u017E\u00EDvate\u013Eov.', type: 'error' });
        });
        return () => unsubscribeUsers();
      } else {
        setLoading(false);
      }
    };

    fetchData();
  }, [globalUserProfileData]);

  const handleChangeRole = async (userId, newRole) => {
    try {
      // Logic to decrement adminCount if the role is changed from admin to something else
      const userDocRef = doc(db, `users`, userId);
      const userSnap = await getDoc(userDocRef);
      const oldRole = userSnap.data().role;
      
      const isApproved = newRole !== 'admin';
      
      await updateDoc(userDocRef, {
        role: newRole,
        approved: isApproved
      });
      
      if (oldRole === 'admin' && newRole !== 'admin') {
        const adminCountRef = doc(db, `settings`, `adminCount`);
        const adminCountSnap = await getDoc(adminCountRef);
        if (adminCountSnap.exists()) {
          await updateDoc(adminCountRef, {
            count: increment(-1)
          });
        }
      }
      
      setNotification({ message: `Rola pou\u017E\u00EDvate\u013Ea bola \u00faspe\u0161ne zmenen\u00e1 na ${newRole}.`, type: 'success' });
    } catch (error) {
      console.error("Chyba pri zmene roly pou\u017E\u00EDvate\u013Ea:", error);
      setNotification({ message: 'Nepodarilo sa zmeni\u0165 rolu pou\u017E\u00EDvate\u013Ea.', type: 'error' });
    }
  };
  
  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      const userDocRef = doc(db, `users`, userToDelete.id);
      
      // Check if the user being deleted is an admin
      if (userToDelete.role === 'admin') {
        const adminCountRef = doc(db, `settings`, `adminCount`);
        const adminCountSnap = await getDoc(adminCountRef);
        
        if (adminCountSnap.exists()) {
          // Decrement the admin count
          await updateDoc(adminCountRef, {
            count: increment(-1)
          });
        }
      }
      
      await deleteDoc(userDocRef);

      const payload = {
        action: 'deleteUser',
        uid: userToDelete.id,
      };

      const response = await fetch('https://script.google.com/macros/s/AKfycby6wUq81pxqT-Uf_8BtN-cKHjhMDtB1V-cDBdcJElZP4VDmfa53lNfPgudsxnmQ0Y3T/exec', {
        method: 'POST',
        mode: 'no-cors',
        cache: 'no-cache',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log('Po\u017Eiadavka na odstr\u00e1nenie pou\u017E\u00edvate\u013Ea odoslan\u00e1.');
      setNotification({ message: `Pou\u017E\u00edvate\u013E ${userToDelete.firstName} bol \u00faspe\u0161ne odstr\u00e1nen\u00fd.`, type: 'success' });
    } catch (error) {
      console.error("Chyba pri odstra\u0148ovan\u00ed pou\u017E\u00EDvate\u013Ea:", error);
      setNotification({ message: 'Nepodarilo sa odstr\u00e1ni\u0165 pou\u017E\u00edvate\u013Ea.', type: 'error' });
    } finally {
      setUserToDelete(null);
    }
  };

  const sendApprovalEmail = async (userEmail) => {
    if (!googleScriptUrl_for_email) {
      console.error("Google Apps Script URL nie je definovan\u00e1.");
      setNotification({ message: 'Chyba: URL skriptu nebola n\u00e1jden\u00e1.', type: 'error' });
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
  
      console.log('Po\u017Eiadavka na odoslanie e-mailu odoslan\u00e1.');
      setNotification({ message: `E-mail o schv\u00e1len\u00ed bol odoslan\u00fd na ${userEmail}.`, type: 'success' });
    } catch (error) {
      console.error("Chyba pri odosielan\u00ed e-mailu o schv\u00e1len\u00ed:", error);
      setNotification({ message: 'Nepodarilo sa odosla\u0165 e-mail o schv\u00e1len\u00ed.', type: 'error' });
    }
  };
  

  const handleApproveAdmin = async (userId, userEmail) => {
    try {
      // 1. Z\u00edskame referencie na dokumenty
      const userDocRef = doc(db, `users`, userId);
      const adminCountRef = doc(db, `settings`, `adminCount`);
      
      // 2. Schv\u00e1lime pou\u017E\u00edvate\u013Ea
      await updateDoc(userDocRef, {
        approved: true
      });
      
      // 3. Z\u00edskame aktu\u00e1lny stav po\u010D\u00edtadla adminov
      const adminCountSnap = await getDoc(adminCountRef);
      
      if (adminCountSnap.exists()) {
        // Ak dokument existuje, zv\u00fd\u0161ime jeho hodnotu
        await updateDoc(adminCountRef, {
          count: increment(1)
        });
      } else {
        // Ak neexistuje, vytvor\u00edme ho a nastav\u00edme po\u010Diato\u010Dn\u00fa hodnotu na 1
        await setDoc(adminCountRef, {
          count: 1
        });
      }
      
      // 4. Po\u0161leme e-mail
      await sendApprovalEmail(userEmail);
      
      // 5. Zobraz\u00edme notifik\u00e1ciu
      setNotification({ message: `Admin bol \u00faspe\u0161ne schv\u00e1len\u00fd a e-mail bol odoslan\u00fd.`, type: 'success' });
    } catch (error) {
      console.error("Chyba pri schva\u013Eovan\u00ed admina:", error);
      setNotification({ message: 'Nepodarilo sa schv\u00e1li\u0165 admina.', type: 'error' });
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
          return 'Superadministr\u00e1tor';
      }
      switch (role) {
          case 'admin':
              return 'Administr\u00e1tor';
          case 'hall':
              return '\u0160portov\u00e1 hala';
              case 'user':
              return 'Pou\u017E\u00edvate\u013E';
          default:
              return role;
      }
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
      React.createElement('h1', { className: 'text-3xl font-bold text-gray-700' }, 'Nem\u00e1te opr\u00e1vnenie na zobrazenie tejto str\u00e1nky.')
    );
  }
  
  const isCurrentUserOldestAdmin = window.currentUserId === oldestAdminId;
  
  // Zjednodu\u0161en\u00e1 podmienka pre odstra\u0148ovanie. Superadministr\u00e1tor m\u00f4\u017Ee odstr\u00e1ni\u0165 kohoko\u013Evek okrem seba.
  const canDeleteUser = isCurrentUserOldestAdmin && (user => user.id !== window.currentUserId);


  // Funkcia na triedenie pou\u017E\u00edvate\u013Eov
  const sortUsers = (usersList) => {
      const oldestAdmin = usersList.find(u => u.id === oldestAdminId);
      const currentUser = usersList.find(u => u.id === window.currentUserId);
      const otherUsers = usersList.filter(u => u.id !== oldestAdminId && u.id !== window.currentUserId);

      // Triedenie ostatn\u00fdch pou\u017E\u00edvate\u013Eov pod\u013Ea slovenskej abecedy
      otherUsers.sort((a, b) => {
          const lastNameComparison = a.lastName.localeCompare(b.lastName, 'sk');
          if (lastNameComparison !== 0) {
              return lastNameComparison;
          }
          return a.firstName.localeCompare(b.firstName, 'sk');
      });

      // Zostavenie fin\u00e1lneho po\u013Ea
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

  return React.createElement(
    'div',
    { className: 'flex-grow p-4 md:p-8 bg-gray-100 rounded-lg shadow-inner' },
    React.createElement('h1', { className: 'text-3xl font-bold text-gray-800 mb-6' }, 'Spr\u00e1va pou\u017E\u00edvate\u013Eov'),
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
            React.createElement('th', { className: 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider' }, 'Rola'),
            React.createElement('th', { className: 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider' }, 'Akcie')
          )
        ),
        React.createElement(
          'tbody',
          { className: 'bg-white divide-y divide-gray-200' },
          sortedUsers.map(user => {
            const isNotCurrentUser = user.id !== window.currentUserId;
            const isUserOldestAdmin = user.id === oldestAdminId;
            const canChangeRole = window.isCurrentUserAdmin && isNotCurrentUser && !isUserOldestAdmin;
            const canDelete = isCurrentUserOldestAdmin && isNotCurrentUser;
            
            // Logika na skrytie riadku pre ostatn\u00fdch pou\u017E\u00edvate\u013Eov
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
              React.createElement(
                'td',
                { className: 'px-6 py-4 whitespace-nowrap text-sm font-medium' },
                isNotCurrentUser ?
                  React.createElement(React.Fragment, null,
                    (window.isCurrentUserAdmin && user.role === 'admin' && user.approved === false) && React.createElement(
                      'button',
                      {
                        onClick: () => handleApproveAdmin(user.id, user.email),
                        className: 'bg-green-500 text-white px-4 py-2 rounded-full shadow-md hover:bg-green-600 transition-colors duration-200 ease-in-out mr-2'
                      },
                      'Schv\u00e1li\u0165'
                    ),
                    (canChangeRole) && React.createElement(
                      'button',
                      {
                        onClick: () => setUserToEdit(user),
                        className: 'bg-blue-500 text-white px-4 py-2 rounded-full shadow-md hover:bg-blue-600 transition-colors duration-200 ease-in-out mr-2'
                      },
                      'Zmeni\u0165 rolu'
                    ),
                    (canDelete) &&
                    React.createElement(
                      'button',
                      {
                        onClick: () => setUserToDelete(user),
                        className: 'bg-red-500 text-white px-4 py-2 rounded-full shadow-md hover:bg-red-600 transition-colors duration-200 ease-in-out'
                      },
                      'Odstr\u00e1ni\u0165'
                    )
                  ) : null
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
      message: `Naozaj chcete odstr\u00e1ni\u0165 pou\u017E\u00edvate\u013Ea ${userToDelete.firstName} ${userToDelete.lastName}? T\u00e1to akcia je nezvratn\u00e1.`,
      onConfirm: handleDeleteUser,
      onCancel: () => setUserToDelete(null)
    })
  );
}

// Funkcia na inicializ\u00e1ciu a vykreslenie React aplik\u00e1cie
const initializeAndRenderApp = () => {
  const rootElement = document.getElementById('users-management-root');

  if (!window.isGlobalAuthReady || !window.globalUserProfileData) {
    console.log("logged-in-users.js: \u010cak\u00e1m na inicializ\u00e1ciu autentifik\u00e1cie a na\u010D\u00edtanie d\u00e1t pou\u017E\u00edvate\u013Ea...");
    return;
  }

  window.removeEventListener('globalDataUpdated', initializeAndRenderApp);

  if (typeof React === 'undefined' || typeof ReactDOM === 'undefined') {
    console.error("Chyba: React alebo ReactDOM nie s\u00fa na\u010D\u00edtan\u00e9. Skontrolujte poradie skriptov.");
    if (rootElement) {
      rootElement.innerHTML = '<div style="color: red; text-align: center; padding: 20px;">Chyba pri na\u010D\u00edtan\u00ed aplik\u00e1cie. Sk\u00faste to pros\u00edm nesk\u00f4r.</div>';
    }
    return;
  }

  const root = ReactDOM.createRoot(rootElement);
  root.render(React.createElement(UsersManagementApp, null));
  console.log("logged-in-users.js: React App (UsersManagementApp) vykreslen\u00e1.");
};

// Vykresl\u00edme loader a zaregistrujeme posluch\u00e1\u010Da udalost\u00ed
const rootElement = document.getElementById('users-management-root');
if (rootElement) {
    rootElement.innerHTML = `
        <div class="flex justify-center pt-16">
            <div class="animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500"></div>
        </div>
    `;
}
window.addEventListener('globalDataUpdated', initializeAndRenderApp);

// Pre pr\u00edpad, \u017Ee udalos\u0165 u\u017E prebehla
if (window.isGlobalAuthReady && window.globalUserProfileData) {
    console.log('logged-in-users.js: Glob\u00e1lne d\u00e1ta u\u017E existuj\u00fa. Vykres\u013Eujem aplik\u00e1ciu okam\u017Eite.');
    initializeAndRenderApp();
}
