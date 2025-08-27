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

// NOVINKA: Komponent pre modálne okno na zmenu roly
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
  const [userToEdit, setUserToEdit] = useState(null); // NOVINKA: Stav pre modálne okno

  // Získame globálne premenné z window
  const db = window.db;
  const appId = window.appId;
  const auth = window.auth;
  const globalUserProfileData = window.globalUserProfileData;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      if (!globalUserProfileData) {
        // Toto by sa nemalo stať, ak sa komponent spúšťa po udalosti,
        // ale pre istotu to ponecháme.
        console.log("UsersManagementApp: Dáta používateľa nie sú dostupné.");
        setLoading(false);
        return;
      }
      
      // UPRAVENÉ: Zmeníme kontrolu na základe tvojich pravidiel Firebase
      const isUserAdmin = globalUserProfileData?.role === 'admin' && globalUserProfileData?.approved === true;
      window.isCurrentUserAdmin = isUserAdmin;

      if (isUserAdmin) {
        // Ak je používateľ admin, začneme načítavať zoznam používateľov
        const usersCollectionPath = `users`; 
        const usersCol = collection(db, usersCollectionPath);
        const q = query(usersCol);

        const unsubscribeUsers = onSnapshot(q, (snapshot) => {
          const usersList = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setUsers(usersList);
          setLoading(false); // Skryjeme loader po načítaní dát
        }, (error) => {
          console.error("Chyba pri načítaní používateľov:", error);
          setLoading(false);
          setNotification({ message: 'Chyba pri načítaní používateľov.', type: 'error' });
        });
        return () => unsubscribeUsers();
      } else {
        // Ak nie je admin, skryjeme loader a zobrazíme "nemáte oprávnenie"
        setLoading(false);
      }
    };

    fetchData();
  }, [globalUserProfileData]);

  // UPRAVENÉ: Funkcia na zmenu roly cez modálne okno
  const handleChangeRole = async (userId, newRole) => {
    try {
      const userDocRef = doc(db, `users`, userId);
      await updateDoc(userDocRef, {
        role: newRole
      });
      setNotification({ message: `Rola používateľa bola zmenená na ${newRole}.`, type: 'success' });
    } catch (error) {
      console.error("Chyba pri zmene roly používateľa:", error);
      setNotification({ message: 'Nepodarilo sa zmeniť rolu používateľa.', type: 'error' });
    }
  };

  // PÔVODNÉ: handleToggleAdmin a handleDeleteUser sú odstránené, namiesto nich je nový handleChangeRole
  // A je odstránené tlačidlo "Odstrániť"

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
  
  // NOVINKA: Funkcia na získanie farby roly
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

  // NOVINKA: Funkcia na preklad názvov rolí
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
                // UPRAVENÉ: Zmena štýlu pre rolu
                React.createElement(
                  'span',
                  { style: { color: getRoleColor(user.role) }, className: 'font-semibold' },
                  getTranslatedRole(user.role)
                )
              ),
              React.createElement(
                'td',
                { className: 'px-6 py-4 whitespace-nowrap text-sm font-medium' },
                React.createElement(
                  'button',
                  {
                    onClick: () => setUserToEdit(user),
                    className: 'bg-blue-500 text-white px-4 py-2 rounded-full shadow-md hover:bg-blue-600 transition-colors duration-200 ease-in-out'
                  },
                  'Zmeniť rolu'
                )
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
    })
  );
}

// Funkcia na inicializáciu a vykreslenie React aplikácie
const initializeAndRenderApp = () => {
  const rootElement = document.getElementById('users-management-root');

  // Počkáme, kým sa globálne dáta používateľa nenahrajú
  if (!window.isGlobalAuthReady || !window.globalUserProfileData) {
    console.log("logged-in-users.js: Čakám na inicializáciu autentifikácie a načítanie dát používateľa...");
    return; // Zastavíme sa a počkáme na udalosť
  }

  // Ak už bol poslucháč nastavený, odstránime ho, aby sme sa vyhli opakovanému volaniu
  window.removeEventListener('globalDataUpdated', initializeAndRenderApp);

  // Uistíme sa, že React a ReactDOM sú načítané
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
