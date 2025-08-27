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
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [notificationType, setNotificationType] = useState("info");
  const notificationTimeoutRef = useRef(null);

  // Získame globálne premenné z window
  const db = window.db;
  const appId = window.appId;
  const auth = window.auth;

  useEffect(() => {
    // Pred spustením Firebase operácií skontrolujeme, či sú všetky potrebné premenné definované
    if (!db || !appId || !auth) {
        console.log("UsersManagementApp: Čakám na inicializáciu Firebase a ID aplikácie.");
        setLoading(true);
        // Neukončujeme, necháme useEffect spustiť znova, keď sa zmenia závislosti
        return;
    }

    console.log("UsersManagementApp: Firebase a ID aplikácie sú dostupné. Načítavam dáta používateľov.");

    const userId = auth.currentUser?.uid || 'anonymous';
    // Cesta ku kolekcii je teraz špecifická pre danú aplikáciu
    const usersCollectionPath = `artifacts/${appId}/public/users`;
    const usersCol = collection(db, usersCollectionPath);
    const q = query(usersCol);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersList);
      setLoading(false);
    }, (error) => {
      console.error("Chyba pri načítaní používateľov:", error);
      setLoading(false);
      showNotificationMessage('Chyba pri načítaní používateľov.', 'error');
    });

    return () => unsubscribe();
  }, [db, appId, auth]); // Pridaná závislosť na auth

  const showNotificationMessage = (message, type = 'success') => {
    setNotificationMessage(message);
    setNotificationType(type);
    setShowNotification(true);
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }
    notificationTimeoutRef.current = setTimeout(() => {
      setShowNotification(false);
      setNotificationMessage("");
    }, 5000);
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

  const userRole = users.find(u => u.id === auth.currentUser?.uid)?.isAdmin ? 'admin' : 'user';

  if (loading) {
    return React.createElement(
      'div', { className: 'flex justify-center pt-16' },
      React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
    );
  }

  if (userRole !== 'admin') {
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
    // Čakáme, kým nebudú dostupné globálne dáta z authentication.js
    if (window.isGlobalAuthReady && window.db && window.auth) {
        // Uistíme sa, že React a ReactDOM sú načítané
        if (typeof React === 'undefined' || typeof ReactDOM === 'undefined') {
            console.error("Chyba: React alebo ReactDOM nie sú načítané. Skontrolujte poradie skriptov.");
            document.getElementById('users-management-root').innerHTML = '<div style="color: red; text-align: center; padding: 20px;">Chyba pri načítaní aplikácie. Skúste to prosím neskôr.</div>';
            return;
        }

        const root = ReactDOM.createRoot(document.getElementById('users-management-root'));
        root.render(React.createElement(UsersManagementApp, null));
        console.log("logged-in-users.js: React App (UsersManagementApp) vykreslená.");
    } else {
        // Ak dáta nie sú k dispozícii, nastavíme poslucháča a vrátime sa
        console.log("logged-in-users.js: Čakám na inicializáciu autentifikácie...");
        window.addEventListener('globalDataUpdated', initializeAndRenderApp, { once: true });
        // Zobrazíme loader, kým čakáme
        const rootElement = document.getElementById('users-management-root');
        if (rootElement) {
            rootElement.innerHTML = `
                <div class="flex justify-center pt-16">
                    <div class="animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500"></div>
                </div>
            `;
        }
    }
};

// Spustíme inicializáciu pri načítaní skriptu
initializeAndRenderApp();
