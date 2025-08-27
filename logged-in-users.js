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

function UsersManagementApp() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const notificationTimeoutRef = useRef(null);

  const db = window.db;
  const appId = window.appId;
  const auth = window.auth;

  useEffect(() => {
    const fetchData = async () => {
      // Pred spustením akejkoľvek operácie skontrolujeme, či sú globálne premenné dostupné
      if (!db || !appId || !auth || !auth.currentUser) {
        console.log("UsersManagementApp: Čakám na inicializáciu Firebase a ID aplikácie.");
        setLoading(true);
        return;
      }
      
      try {
        // Načítanie roly používateľa
        const userDocRef = doc(db, `artifacts/${appId}/public/users`, auth.currentUser.uid);
        const docSnapshot = await getDoc(userDocRef);
        const userRoleData = docSnapshot.data();
        const isAdmin = userRoleData?.isAdmin;
        window.isCurrentUserAdmin = isAdmin;

        if (isAdmin) {
          // Ak je používateľ admin, začneme načítavať zoznam používateľov
          const usersCollectionPath = `artifacts/${appId}/public/users`;
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
            window.showGlobalNotification('Chyba pri načítaní používateľov.', 'error');
          });
          return () => unsubscribeUsers();
        } else {
          // Ak nie je admin, skryjeme loader a zobrazíme "nemáte oprávnenie"
          setLoading(false);
        }
      } catch (error) {
        console.error("Chyba pri načítaní dát v UsersManagementApp:", error);
        setLoading(false);
        window.showGlobalNotification('Chyba pri overení oprávnení alebo načítaní dát.', 'error');
      }
    };

    fetchData();
  }, [db, appId, auth]);


  const showNotificationMessage = (message, type = 'success') => {
    window.showGlobalNotification(message, type);
  };

  const handleToggleAdmin = async (user) => {
    try {
      const userDocRef = doc(db, `artifacts/${appId}/public/users`, user.id);
      await updateDoc(userDocRef, {
        isAdmin: !user.isAdmin
      });
      showNotificationMessage(`Status administrátora pre ${user.displayName} bol úspešne zmenený.`);
    } catch (error) {
      console.error("Chyba pri zmene statusu administrátora:", error);
      showNotificationMessage('Nepodarilo sa zmeniť status administrátora.', 'error');
    }
  };

  const handleDeleteUser = async (userIdToDelete) => {
    try {
      const userDocRef = doc(db, `artifacts/${appId}/public/users`, userIdToDelete);
      await deleteDoc(userDocRef);
      showNotificationMessage('Používateľ bol úspešne odstránený.');
    } catch (error) {
      console.error("Chyba pri odstraňovaní používateľa:", error);
      showNotificationMessage('Nepodarilo sa odstrániť používateľa.', 'error');
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
            React.createElement('th', { className: 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider' }, 'ID používateľa'),
            React.createElement('th', { className: 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider' }, 'E-mail'),
            React.createElement('th', { className: 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider' }, 'Admin'),
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
              React.createElement('td', { className: 'px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900' }, user.displayName),
              React.createElement('td', { className: 'px-6 py-4 whitespace-nowrap text-sm text-gray-500' }, user.id),
              React.createElement('td', { className: 'px-6 py-4 whitespace-nowrap text-sm text-gray-500' }, user.email),
              React.createElement(
                'td',
                { className: 'px-6 py-4 whitespace-nowrap text-sm' },
                React.createElement(
                  'span',
                  { className: `px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.isAdmin ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}` },
                  user.isAdmin ? 'Áno' : 'Nie'
                )
              ),
              React.createElement(
                'td',
                { className: 'px-6 py-4 whitespace-nowrap text-sm font-medium' },
                React.createElement(
                  'button',
                  {
                    onClick: () => handleToggleAdmin(user),
                    className: 'text-indigo-600 hover:text-indigo-900 mr-4',
                  },
                  'Zmeniť status'
                ),
                React.createElement(
                  'button',
                  {
                    onClick: () => handleDeleteUser(user.id),
                    className: 'text-red-600 hover:text-red-900',
                  },
                  'Odstrániť'
                )
              )
            )
          )
        )
      )
    ),
    React.createElement(NotificationModal, { message: notificationMessage, onClose: () => setShowNotification(false), type: notificationType })
  );
}

// Funkcia na inicializáciu a vykreslenie React aplikácie
const initializeAndRenderApp = () => {
    const rootElement = document.getElementById('users-management-root');
    // Ak dáta nie sú k dispozícii, zobrazíme loader a nastavíme poslucháča
    if (!window.isGlobalAuthReady || !window.db || !window.auth) {
        console.log("logged-in-users.js: Čakám na inicializáciu autentifikácie...");
        if (rootElement) {
            rootElement.innerHTML = `
                <div class="flex justify-center pt-16">
                    <div class="animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500"></div>
                </div>
            `;
        }
        window.addEventListener('globalDataUpdated', initializeAndRenderApp);
        return;
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

// Spustíme inicializáciu pri načítaní skriptu
initializeAndRenderApp();
