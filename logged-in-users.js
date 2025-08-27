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

  let bgColor;
  let borderColor;
  let icon;
  let title;

  switch (type) {
    case 'success':
      bgColor = 'bg-green-50';
      borderColor = 'border-green-400';
      icon = (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2l4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
      title = "Úspech";
      break;
    case 'error':
      bgColor = 'bg-red-50';
      borderColor = 'border-red-400';
      icon = (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
      title = "Chyba";
      break;
    default:
      bgColor = 'bg-blue-50';
      borderColor = 'border-blue-400';
      icon = (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
      title = "Info";
  }

  return (
    <div className={`fixed bottom-4 right-4 z-50 transition-all transform ${show ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'} duration-500 ease-in-out`}>
      <div className={`flex items-center w-full max-w-sm p-4 text-gray-900 ${bgColor} rounded-lg shadow-xl border-l-4 ${borderColor}`}>
        <div className="flex-shrink-0">{icon}</div>
        <div className="ml-3 text-sm font-normal">
          <div className="font-semibold text-gray-900">{title}</div>
          {message}
        </div>
        <button
          type="button"
          className="ml-auto -mx-1.5 -my-1.5 bg-transparent text-gray-400 hover:text-gray-900 rounded-lg focus:ring-2 focus:ring-gray-300 p-1.5 hover:bg-gray-100 inline-flex items-center justify-center h-8 w-8"
          onClick={() => { setShow(false); onClose(); }}
        >
          <span className="sr-only">Zatvoriť</span>
          <svg className="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// UserRow Component
function UserRow({ user, onSelectUser, onSendEmail, isSending, isDeleting, onToggleStatus, onShowDeleteModal }) {
  const [isSendingEmail, setIsSendingEmail] = React.useState(false);
  const [isDeletingUser, setIsDeletingUser] = React.useState(false);
  const [emailError, setEmailError] = React.useState('');
  const [deleteError, setDeleteError] = React.useState('');

  const handleSendEmail = async () => {
    setIsSendingEmail(true);
    setEmailError('');
    try {
      await onSendEmail(user.id);
      setIsSendingEmail(false);
    } catch (error) {
      console.error("Chyba pri odosielaní e-mailu:", error);
      setEmailError("Nepodarilo sa odoslať e-mail.");
      setIsSendingEmail(false);
    }
  };

  const handleDeleteUser = async () => {
    setIsDeletingUser(true);
    setDeleteError('');
    try {
      await onShowDeleteModal(user);
    } catch (error) {
      console.error("Chyba pri odstraňovaní používateľa:", error);
      setDeleteError("Nepodarilo sa odstrániť používateľa.");
      setIsDeletingUser(false);
    }
  };

  return (
    <tr key={user.id} className="border-b border-gray-200 hover:bg-gray-100 transition-colors duration-200 cursor-pointer" onClick={() => onSelectUser(user)}>
      <td className="p-4 whitespace-nowrap">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center text-gray-600 font-bold text-sm">
            {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'N/A'}
          </div>
          <div>
            <div className="font-medium text-gray-900">{user.displayName || 'N/A'}</div>
            <div className="text-sm text-gray-500">{user.email || 'N/A'}</div>
          </div>
        </div>
      </td>
      <td className="p-4 whitespace-nowrap text-sm text-gray-500">
        <div className="flex items-center space-x-2">
          {user.active ? (
            <>
              <span className="w-2.5 h-2.5 bg-green-500 rounded-full"></span>
              <span>Aktívny</span>
            </>
          ) : (
            <>
              <span className="w-2.5 h-2.5 bg-red-500 rounded-full"></span>
              <span>Neaktívny</span>
            </>
          )}
        </div>
      </td>
      <td className="p-4 whitespace-nowrap text-right text-sm font-medium">
        <div className="flex items-center space-x-4">
          <button
            onClick={(e) => { e.stopPropagation(); handleSendEmail(); }}
            className={`flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white transition-colors duration-200 ${isSendingEmail ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'}`}
            disabled={isSendingEmail}
          >
            {isSendingEmail ? (
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
            )}
            Odoslať e-mail
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleStatus(user.id, !user.active); }}
            className="text-indigo-600 hover:text-indigo-900 transition-colors duration-200 text-sm font-medium"
          >
            {user.active ? 'Deaktivovať' : 'Aktivovať'}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDeleteUser(); }}
            className={`text-red-600 hover:text-red-900 transition-colors duration-200 text-sm font-medium ${isDeletingUser ? 'cursor-not-allowed' : ''}`}
            disabled={isDeletingUser}
          >
            {isDeletingUser ? 'Odstraňuje sa...' : 'Odstrániť'}
          </button>
        </div>
      </td>
    </tr>
  );
}

// DeleteConfirmationModal Component
function DeleteConfirmationModal({ user, onConfirm, onCancel, isDeleting }) {
  if (!user) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center z-50">
      <div className="relative p-8 w-96 mx-auto bg-white rounded-xl shadow-lg transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
            <svg className="h-6 w-6 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.332 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg leading-6 font-medium text-gray-900 mt-4">Odstrániť používateľa</h3>
          <div className="mt-2">
            <p className="text-sm text-gray-500">
              Naozaj chcete natrvalo odstrániť používateľa <span className="font-semibold">{user.displayName || user.email || 'neznámy používateľ'}</span>?
              Táto akcia je nevratná.
            </p>
          </div>
        </div>
        <div className="mt-5 sm:mt-6 sm:flex sm:flex-row-reverse space-y-3 sm:space-y-0 sm:space-x-3">
          <button
            onClick={() => onConfirm(user.id)}
            disabled={isDeleting}
            className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm ${isDeleting ? 'bg-red-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 focus:ring-red-500'}`}
          >
            {isDeleting ? 'Odstraňuje sa...' : 'Odstrániť'}
          </button>
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
          >
            Zrušiť
          </button>
        </div>
      </div>
    </div>
  );
}

// Main App Component
function UsersManagementApp() {
  const [users, setUsers] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedUser, setSelectedUser] = React.useState(null);
  const [notification, setNotification] = React.useState({ message: '', type: 'info' });
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [userToDelete, setUserToDelete] = React.useState(null);

  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
  const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
  const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

  const EMAIL_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec';
  const DELETE_USER_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby6wUq81pxqT-Uf_8BtN-cKHjhMDtB1V-cDBdcJElZP4VDmfa53lNfPgudsxnmQ0Y3T/exec';

  const auth = React.useRef(null);
  const db = React.useRef(null);

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
  };

  const closeNotification = () => {
    setNotification({ message: '', type: 'info' });
  };

  React.useEffect(() => {
    if (!firebaseConfig) {
      console.error("Chyba: firebaseConfig nie je definovaný.");
      return;
    }

    const app = window.firebase.initializeApp(firebaseConfig);
    db.current = window.firebase.getFirestore(app);
    auth.current = window.firebase.getAuth(app);

    const initializeAuthAndFetchData = async () => {
      try {
        if (initialAuthToken) {
          await window.firebase.signInWithCustomToken(auth.current, initialAuthToken);
        } else {
          await window.firebase.signInAnonymously(auth.current);
        }
      } catch (error) {
        console.error("Chyba pri prihlásení:", error);
        showNotification("Chyba pri inicializácii autentifikácie.", "error");
        setLoading(false);
        return;
      }

      // Začnite počúvať zmeny až po úspešnej autentifikácii
      const q = window.firebase.query(
        window.firebase.collection(db.current, `artifacts/${appId}/public/data/users`)
      );

      const unsubscribe = window.firebase.onSnapshot(q, (querySnapshot) => {
        const usersList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setUsers(usersList);
        setLoading(false);
      }, (error) => {
        console.error("Chyba pri načítaní používateľov:", error);
        showNotification("Chyba pri načítaní dát používateľa.", "error");
        setLoading(false);
      });

      return () => unsubscribe();
    };

    initializeAuthAndFetchData();
  }, [appId, firebaseConfig, initialAuthToken]);

  const toggleUserStatus = async (userId, newStatus) => {
    if (!db.current || !auth.current) {
      showNotification("Služby databázy nie sú inicializované.", "error");
      return;
    }

    const userRef = doc(db.current, `artifacts/${appId}/public/data/users`, userId);
    try {
      await updateDoc(userRef, { active: newStatus });
      showNotification("Stav používateľa bol úspešne aktualizovaný.", "success");
    } catch (error) {
      console.error("Chyba pri aktualizácii stavu používateľa:", error);
      showNotification("Nepodarilo sa aktualizovať stav používateľa.", "error");
    }
  };

  const sendEmail = async (userId) => {
    const user = users.find(u => u.id === userId);
    if (!user || !user.email) {
      showNotification("Používateľ alebo e-mail sa nenašiel.", "error");
      return;
    }

    try {
      const response = await fetch(EMAIL_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientEmail: user.email,
          subject: 'Správa od správcu',
          body: `Dobrý deň ${user.displayName || user.email}, toto je testovacia správa z nástroja na správu používateľov.`
        }),
      });

      // No-cors odpovede majú obmedzené informácie, ale môžeme predpokladať úspech ak nedošlo k chybe
      if (response.type === 'opaque') {
        showNotification("Žiadosť o odoslanie e-mailu bola úspešne odoslaná (odpoveď no-cors).", "success");
      } else if (response.ok) {
        showNotification("E-mail bol úspešne odoslaný.", "success");
      } else {
        throw new Error('Chyba pri odosielaní e-mailu.');
      }
    } catch (error) {
      console.error("Chyba pri odosielaní e-mailu:", error);
      showNotification("Nepodarilo sa odoslať e-mail. Skontrolujte prosím konzolu pre viac detailov.", "error");
    }
  };

  const showDeleteModal = (user) => {
    setUserToDelete(user);
  };

  const closeDeleteModal = () => {
    setUserToDelete(null);
  };

  const confirmDeleteUser = async (userId) => {
    setIsDeleting(true);
    closeDeleteModal();

    try {
      // 1. Odstráňte používateľa z Firebase Firestore
      const userDocRef = doc(db.current, `artifacts/${appId}/public/data/users`, userId);
      await deleteDoc(userDocRef);

      // 2. Volanie Google Apps Script na odstránenie používateľa
      const response = await fetch(DELETE_USER_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (response.type === 'opaque') {
        showNotification("Používateľ bol úspešne odstránený. Záznam bol odstránený z databázy, ale akcia skriptu nemohla byť potvrdená.", "success");
      } else if (response.ok) {
        showNotification("Používateľ bol úspešne odstránený.", "success");
      } else {
        throw new Error('Chyba pri volaní skriptu na odstránenie.');
      }
    } catch (error) {
      console.error("Chyba pri odstraňovaní používateľa:", error);
      showNotification("Nepodarilo sa odstrániť používateľa. Skontrolujte konzolu.", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 p-4 font-sans antialiased">
      <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">Správa používateľov</h1>

      <div className="bg-white rounded-xl shadow-lg overflow-hidden flex-grow flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Zoznam prihlásených používateľov</h2>
          <p className="mt-1 text-sm text-gray-500">
            Prehľad používateľov prihlásených do aplikácie. Môžete zobraziť ich stav a vykonať akcie.
          </p>
        </div>

        <div className="flex-grow overflow-x-auto">
          {loading ? (
            <div className="flex justify-center items-center p-8">
              <svg className="animate-spin h-10 w-10 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="ml-3 text-gray-600">Načítavam používateľov...</span>
            </div>
          ) : users.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Meno a e-mail</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stav</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Akcie</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    onSelectUser={setSelectedUser}
                    onSendEmail={sendEmail}
                    onToggleStatus={toggleUserStatus}
                    onShowDeleteModal={showDeleteModal}
                  />
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex justify-center items-center p-8 text-gray-500">
              <span className="text-center">Žiadni používatelia nie sú prihlásení.</span>
            </div>
          )}
        </div>
      </div>

      <NotificationModal message={notification.message} onClose={closeNotification} type={notification.type} />
      <DeleteConfirmationModal
        user={userToDelete}
        onConfirm={confirmDeleteUser}
        onCancel={closeDeleteModal}
        isDeleting={isDeleting}
      />
    </div>
  );
}

// Global initialization logic to render the React App
const initializeAndRenderApp = () => {
  const rootElement = document.getElementById('users-management-root');

  if (!window.isGlobalAuthReady || !window.globalUserProfileData) {
    console.log("logged-in-users.js: Čakám na inicializáciu autentifikácie a načítanie dát používateľa...");
    return;
  }

  window.removeEventListener('globalDataUpdated', initializeAndRenderApp);

  if (typeof React === 'undefined' || typeof ReactDOM === 'undefined' || typeof window.firebase === 'undefined') {
    console.error("Chyba: React, ReactDOM alebo Firebase nie sú načítané. Skontrolujte poradie skriptov.");
    if (rootElement) {
      rootElement.innerHTML = '<div style="color: red; text-align: center; padding: 20px;">Chyba pri načítaní aplikácie. Skúste to prosím neskôr.</div>';
    }
    return;
  }

  const root = ReactDOM.createRoot(rootElement);
  root.render(React.createElement(UsersManagementApp, null));
  console.log("logged-in-users.js: React App (UsersManagementApp) vykreslená.");
};

// Render loader and register event listener
const rootElement = document.getElementById('users-management-root');
if (rootElement) {
    rootElement.innerHTML = `
        <div class="flex justify-center pt-16">
            <div class="animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500"></div>
        </div>
    `;
}
window.addEventListener('globalDataUpdated', initializeAndRenderApp);
