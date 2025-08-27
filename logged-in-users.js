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
  increment, // Pridaný import pre funkciu increment
  setDoc,
  getDocs,
  where,
  runTransaction
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
function ConfirmationModal({ message, onConfirm, onCancel, isSaving }) {
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
            disabled: isSaving,
            className: `bg-gray-300 text-gray-800 px-4 py-2 rounded-md mr-2 transition-colors ${isSaving ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-400'}`
          },
          'Zrušiť'
        ),
        React.createElement(
          'button',
          {
            onClick: onConfirm,
            disabled: isSaving,
            className: `bg-red-500 text-white px-4 py-2 rounded-md transition-colors ${isSaving ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-600'}`
          },
          isSaving ? 'Odstraňujem...' : 'Potvrdiť'
        )
      )
    )
  );
}

// Komponent pre modálne okno na zmenu roly
function ChangeRoleModal({ user, onClose, onRoleChange, isSaving }) {
  const [selectedRole, setSelectedRole] = useState(user.role);

  const handleSave = () => {
    onRoleChange(user.id, selectedRole);
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
              disabled: isSaving,
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
            disabled: isSaving,
            className: `bg-gray-300 text-gray-800 px-4 py-2 rounded-md mr-2 ${isSaving ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-400'}`
          },
          'Zrušiť'
        ),
        React.createElement(
          'button',
          {
            onClick: handleSave,
            disabled: isSaving,
            className: `bg-indigo-600 text-white px-4 py-2 rounded-md ${isSaving ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-700'}`
          },
          isSaving ? 'Ukladám...' : 'Uložiť'
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
  const [isSaving, setIsSaving] = useState(false); // Nový stav na sledovanie prebiehajúcich operácií
  
  const googleScriptUrl_for_email = 'https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec';
  const db = window.db;
  const appId = window.appId;
  const auth = window.auth;
  const globalUserProfileData = window.globalUserProfileData;

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
          console.error("Chyba pri načítaní používateľov:", error);
          setLoading(false);
          setNotification({ message: 'Chyba pri načítaní používateľov.', type: 'error' });
        });
        return () => unsubscribeUsers();
      } else {
        setLoading(false);
      }
    };

    fetchData();
  }, [globalUserProfileData]);

  const handleChangeRole = async (userId, newRole) => {
    setIsSaving(true); // Začiatok ukladania
    try {
        const userDocRef = doc(db, `users`, userId);
        const adminCountRef = doc(db, `settings`, `adminCount`);
        
        await runTransaction(db, async (transaction) => {
            const userSnap = await transaction.get(userDocRef);
            if (!userSnap.exists()) {
                throw new Error("Používateľ nebol nájdený.");
            }
            const oldRole = userSnap.data().role;
            const wasApproved = userSnap.data().approved;
            const isApproved = newRole === 'admin';
            
            // Update the user document
            transaction.update(userDocRef, { role: newRole, approved: isApproved });

            // Zjednodušená logika pre aktualizáciu adminCount
            if (oldRole === 'admin' && wasApproved && !isApproved) {
                // Zmena z schváleného admina na inú rolu, dekrementujeme
                transaction.update(adminCountRef, { count: increment(-1) });
            } else if (oldRole !== 'admin' && isApproved) {
                // Zmena na schváleného admina, inkrementujeme
                transaction.update(adminCountRef, { count: increment(1) });
            }
        });

        setNotification({ message: `Rola používateľa bola úspešne zmenená na ${newRole}.`, type: 'success' });
        setUserToEdit(null); // Zavrie modálne okno po úspešnom uložení
    } catch (error) {
        console.error("Chyba pri zmene roly používateľa:", error);
        setNotification({ message: 'Nepodarilo sa zmeniť rolu používateľa.', type: 'error' });
    } finally {
        setIsSaving(false); // Ukončenie ukladania
    }
  };
  
  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setIsSaving(true); // Začiatok ukladania
    try {
        const userDocRef = doc(db, `users`, userToDelete.id);
        const adminCountRef = doc(db, `settings`, `adminCount`);

        await runTransaction(db, async (transaction) => {
            const userSnap = await transaction.get(userDocRef);
            if (!userSnap.exists()) {
                throw new Error("User not found");
            }
            
            // Ak bol používateľ schválený admin, dekrementujeme count
            if (userSnap.data().role === 'admin' && userSnap.data().approved === true) {
                transaction.update(adminCountRef, { count: increment(-1) });
            }
            // Delete the user document
            transaction.delete(userDocRef);
        });
      
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

      console.log('Požiadavka na odstránenie používateľa odoslaná.');
      setNotification({ message: `Používateľ ${userToDelete.firstName} bol úspešne odstránený.`, type: 'success' });
    } catch (error) {
      console.error("Chyba pri odstraňovaní používateľa:", error);
      setNotification({ message: 'Nepodarilo sa odstrániť používateľa.', type: 'error' });
    } finally {
      setUserToDelete(null); // Zavrie modálne okno po dokončení
      setIsSaving(false); // Ukončenie ukladania
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
    setIsSaving(true); // Začiatok ukladania
    try {
        const userDocRef = doc(db, `users`, userId);
        const adminCountRef = doc(db, `settings`, `adminCount`);
        
        await runTransaction(db, async (transaction) => {
            transaction.update(userDocRef, { approved: true });
            transaction.update(adminCountRef, { count: increment(1) });
        });
      
      // Send email and notification after the transaction
      await sendApprovalEmail(userEmail);
      setNotification({ message: `Admin bol úspešne schválený a e-mail bol odoslaný.`, type: 'success' });
    } catch (error) {
      console.error("Chyba pri schvaľovaní admina:", error);
      setNotification({ message: 'Nepodarilo sa schváliť admina.', type: 'error' });
    } finally {
        setIsSaving(false); // Ukončenie ukladania
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
                        disabled: isSaving, // Deaktivuje tlačidlo počas ukladania
                        className: `bg-green-500 text-white px-4 py-2 rounded-full shadow-md transition-colors duration-200 ease-in-out mr-2 ${isSaving ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-600'}`
                      },
                      isSaving ? 'Schvaľujem...' : 'Schváliť'
                    ),
                    // Tlacidlo "Upravit rolu" je viditelne pre schvalenych adminov (okrem najstarsiho) a pre neschvalenych adminov
                    ((canChangeRole) || (window.isCurrentUserAdmin && user.role === 'admin' && !user.approved)) && React.createElement(
                      'button',
                      {
                        onClick: () => setUserToEdit(user),
                        disabled: isSaving, // Deaktivuje tlačidlo počas ukladania
                        className: `bg-blue-500 text-white px-4 py-2 rounded-full shadow-md transition-colors duration-200 ease-in-out mr-2 ${isSaving ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'}`
                      },
                      isSaving ? 'Prebieha úprava...' : 'Upraviť rolu'
                    )
                  ) : null,
                // Tlačidlo "Odstrániť" sa zobrazí len pre superadministrátora, a to pre všetkých ostatných používateľov okrem neho samotného
                (isCurrentUserOldestAdmin && user.id !== window.currentUserId) && React.createElement(
                  'button',
                  {
                    onClick: () => setUserToDelete(user),
                    disabled: isSaving, // Deaktivuje tlačidlo počas ukladania
                    className: `bg-red-500 text-white px-4 py-2 rounded-full shadow-md transition-colors duration-200 ease-in-out ml-2 ${isSaving ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-600'}`
                  },
                  isSaving ? 'Odstraňujem...' : 'Odstrániť'
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
      onRoleChange: handleChangeRole,
      isSaving: isSaving
    }),
    userToDelete && React.createElement(ConfirmationModal, {
      message: `Naozaj chcete odstrániť používateľa ${userToDelete.firstName} ${userToDelete.lastName}? Táto akcia je nezvratná.`,
      onConfirm: handleDeleteUser,
      onCancel: () => setUserToDelete(null),
      isSaving: isSaving
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
