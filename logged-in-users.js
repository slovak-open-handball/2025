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
  getDoc
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

// NOVINKA: Komponent pre potvrdzovacie modálne okno
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

function UsersManagementApp() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState({ message: '', type: 'info' });
  const [userToEdit, setUserToEdit] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);
  
  // NOVINKA: Stav pre ukladanie URL adresy Google Apps Script
  const googleScriptUrl = 'https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec';

  // Získame globálne premenné z window
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
      window.currentUserId = auth.currentUser?.uid; // Uloženie ID aktuálneho používateľa
      
      if (isUserAdmin) {
        const usersCollectionPath = `users`; 
        const usersCol = collection(db, usersCollectionPath);
        const q = query(usersCol);

        const unsubscribeUsers = onSnapshot(q, (snapshot) => {
          const usersList = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
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
    try {
      // NOVINKA: Určenie, či by mal byť používateľ schválený na základe novej roly
      const isApproved = newRole !== 'admin';

      const userDocRef = doc(db, `users`, userId);
      await updateDoc(userDocRef, {
        role: newRole,
        approved: isApproved // NOVINKA: Nastavenie approved na základe roly
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
      await deleteDoc(userDocRef);
      setNotification({ message: `Používateľ ${userToDelete.firstName} bol úspešne odstránený.`, type: 'success' });
    } catch (error) {
      console.error("Chyba pri odstraňovaní používateľa:", error);
      setNotification({ message: 'Nepodarilo sa odstrániť používateľa.', type: 'error' });
    } finally {
      setUserToDelete(null);
    }
  };

  // NOVINKA: funkcia pre odoslanie e-mailu o schválení admina
  const sendApprovalEmail = async (userEmail) => {
    if (!googleScriptUrl) {
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
  
      const response = await fetch(googleScriptUrl, {
        method: 'POST',
        mode: 'no-cors', // Dôležité pre správne fungovanie
        cache: 'no-cache',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
  
      // Pre no-cors režim nemôžeme priamo skontrolovať odpoveď,
      // ale môžeme predpokladať, že požiadavka bola odoslaná.
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
      await updateDoc(userDocRef, {
        approved: true
      });
      // NOVINKA: Po úspešnom schválení vo Firestore odošleme e-mail
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

  const getTranslatedRole = (role) => {
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
          users.map(user =>
            React.createElement(
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
                  getTranslatedRole(user.role)
                )
              ),
              React.createElement(
                'td',
                { className: 'px-6 py-4 whitespace-nowrap text-sm font-medium' },
                // NOVINKA: Kontrola, či je používateľ aktuálne prihlásený, a skrytie tlačidiel
                // NOVINKA: Zobrazenie tlačidla na schválenie, ak je rola 'admin' a 'approved' je false
                user.id !== window.currentUserId ?
                React.createElement(React.Fragment, null,
                  (user.role === 'admin' && user.approved === false) && React.createElement(
                    'button',
                    {
                      onClick: () => handleApproveAdmin(user.id, user.email),
                      className: 'bg-green-500 text-white px-4 py-2 rounded-full shadow-md hover:bg-green-600 transition-colors duration-200 ease-in-out mr-2'
                    },
                    'Schváliť'
                  ),
                  React.createElement(
                    'button',
                    {
                      onClick: () => setUserToEdit(user),
                      className: 'bg-blue-500 text-white px-4 py-2 rounded-full shadow-md hover:bg-blue-600 transition-colors duration-200 ease-in-out mr-2'
                    },
                    'Zmeniť rolu'
                  ),
                  React.createElement(
                    'button',
                    {
                      onClick: () => setUserToDelete(user),
                      className: 'bg-red-500 text-white px-4 py-2 rounded-full shadow-md hover:bg-red-600 transition-colors duration-200 ease-in-out'
                    },
                    'Odstrániť'
                  )
                ) : null
              )
            )
          )
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
