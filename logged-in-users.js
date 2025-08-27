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
import {
  signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";


// Globálne premenné, ktoré budú dostupné pre všetky ostatné skripty
window.isGlobalAuthReady = false;
window.globalUserProfileData = null;
window.auth = null;
window.db = null;
window.showGlobalNotification = null;

// NOTIFIKÁCIA
// NotificationModal Component
function NotificationModal({
  message,
  onClose,
  type = 'info'
}) {
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
      }, 5000); // Zobrazí sa 5 sekúnd

      return () => {
        clearTimeout(timerRef.current);
      };
    } else {
      setShow(false);
    }
  }, [message, onClose]);

  const bgColor = {
    'info': 'bg-blue-500',
    'success': 'bg-green-500',
    'warning': 'bg-yellow-500',
    'error': 'bg-red-500'
  } [type] || 'bg-blue-500';
  const icon = {
    'info': (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    'success': (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2l4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    'warning': (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    'error': (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  } [type] || null;

  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ${show ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
      }`}
    >
      <div className={`flex items-center p-4 rounded-lg shadow-lg text-white ${bgColor}`}>
        {icon}
        <span className="font-semibold">{message}</span>
        <button onClick={() => setShow(false)} className="ml-4 -mr-1">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// Global functions for notification
window.showGlobalNotification = (message, type = 'info') => {
  const root = ReactDOM.createRoot(document.getElementById('global-notification-root'));
  root.render(React.createElement(NotificationModal, {
    message: message,
    type: type,
    onClose: () => {
      // Unmount the component after it's hidden
      setTimeout(() => {
        root.unmount();
      }, 500);
    }
  }));
};


// Komponent pre správu používateľov
function UsersManagementApp() {
  const [users, setUsers] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [editingUserId, setEditingUserId] = React.useState(null);
  const [editRole, setEditRole] = React.useState('');
  const [editDisplayName, setEditDisplayName] = React.useState('');
  const [editEmail, setEditEmail] = React.useState('');
  const [sortOrder, setSortOrder] = React.useState({
    field: 'displayName',
    direction: 'asc'
  });

  // Google Apps Script URLs
  const EMAIL_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec';
  const DELETE_USER_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby6wUq81pxqT-Uf_8BtN-cKHjhMDtB1V-cDBdcJElZP4VDmfa53lNfPgudsxnmQ0Y3T/exec';

  React.useEffect(() => {
    // Čakáme, kým bude autentifikácia pripravená a používateľ prihlásený
    if (!window.isGlobalAuthReady || !window.db) {
      const handleDataUpdate = () => {
        if (window.isGlobalAuthReady && window.db) {
          window.removeEventListener('globalDataUpdated', handleDataUpdate);
          fetchUsers();
        }
      };
      window.addEventListener('globalDataUpdated', handleDataUpdate);
      return () => window.removeEventListener('globalDataUpdated', handleDataUpdate);
    }

    fetchUsers();
  }, []);

  const fetchUsers = () => {
    const q = query(collection(window.db, `artifacts/${window.appId}/public/data/users`));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const usersArray = [];
      querySnapshot.forEach((doc) => {
        const userData = doc.data();
        usersArray.push({
          id: doc.id,
          ...userData
        });
      });
      // Sort the users after fetching
      const sortedUsers = sortData(usersArray, sortOrder.field, sortOrder.direction);
      setUsers(sortedUsers);
      setLoading(false);
    }, (err) => {
      console.error("Chyba pri načítaní používateľov:", err);
      setError("Nepodarilo sa načítať používateľov.");
      setLoading(false);
    });

    return () => unsubscribe();
  };

  // Helper function for sorting
  const sortData = (data, field, direction) => {
    return [...data].sort((a, b) => {
      const aValue = a[field] || '';
      const bValue = b[field] || '';

      if (aValue < bValue) {
        return direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  };

  const handleSort = (field) => {
    setSortOrder(prev => {
      const newDirection = prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc';
      const sortedUsers = sortData(users, field, newDirection);
      setUsers(sortedUsers);
      return {
        field,
        direction: newDirection
      };
    });
  };

  const confirmAndRemoveUser = async (user) => {
    // Vytvorenie dynamického modálneho okna na potvrdenie
    const confirmed = await new Promise(resolve => {
      const confirmModal = (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full text-center">
            <h3 className="text-xl font-bold mb-4">Potvrdenie odstránenia</h3>
            <p className="mb-4">Naozaj chcete odstrániť používateľa <span className="font-semibold">{user.displayName || user.email}?</span></p>
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => resolve(true)}
                className="bg-red-500 text-white px-4 py-2 rounded-lg font-semibold shadow-md hover:bg-red-600 transition-colors"
              >
                Áno, odstrániť
              </button>
              <button
                onClick={() => resolve(false)}
                className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg font-semibold shadow-md hover:bg-gray-400 transition-colors"
              >
                Zrušiť
              </button>
            </div>
          </div>
        </div>
      );
      ReactDOM.createRoot(document.getElementById('confirmation-root')).render(confirmModal);
    });

    // Odstránenie modálneho okna
    ReactDOM.createRoot(document.getElementById('confirmation-root')).unmount();

    if (confirmed) {
      await removeUser(user);
    }
  };

  const removeUser = async (user) => {
    setIsDeleting(true);
    try {
      // Odstránenie používateľa cez Google Apps Script
      const response = await fetch(DELETE_USER_SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          userEmail: user.email,
          userId: user.id
        }),
      });

      const result = await response.json();

      if (result.status === 'success') {
        // Ak je odstránenie z Google Apps Script úspešné, odstránime ho z Firestore
        const userDocRef = doc(window.db, `artifacts/${window.appId}/public/data/users`, user.id);
        await deleteDoc(userDocRef);
        window.showGlobalNotification('Používateľ bol úspešne odstránený.', 'success');
      } else {
        window.showGlobalNotification(`Chyba pri odstraňovaní používateľa: ${result.message}`, 'error');
        console.error("Chyba pri odstraňovaní používateľa cez skript:", result.message);
      }
    } catch (err) {
      console.error("Chyba pri odstraňovaní používateľa:", err);
      window.showGlobalNotification('Nepodarilo sa odstrániť používateľa. Skúste to prosím znova.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };


  const startEdit = (user) => {
    setEditingUserId(user.id);
    setEditRole(user.role || '');
    setEditDisplayName(user.displayName || '');
    setEditEmail(user.email || '');
  };

  const cancelEdit = () => {
    setEditingUserId(null);
    setEditRole('');
    setEditDisplayName('');
    setEditEmail('');
  };

  const saveUser = async (userId) => {
    if (!editDisplayName || !editEmail || !editRole) {
      window.showGlobalNotification('Všetky polia sú povinné.', 'warning');
      return;
    }

    try {
      const userDocRef = doc(window.db, `artifacts/${window.appId}/public/data/users`, userId);
      await updateDoc(userDocRef, {
        displayName: editDisplayName,
        email: editEmail,
        role: editRole,
        // Tu môžeme pridať ďalšie polia, ktoré chceme aktualizovať
      });
      window.showGlobalNotification('Používateľ bol úspešne aktualizovaný.', 'success');
      cancelEdit();
    } catch (err) {
      console.error("Chyba pri aktualizácii používateľa:", err);
      window.showGlobalNotification('Nepodarilo sa aktualizovať používateľa. Skúste to prosím znova.', 'error');
    }
  };

  const sendWelcomeEmail = async (user) => {
    const originalButtonText = event.target.textContent;
    event.target.textContent = 'Odosielanie...';
    event.target.disabled = true;

    try {
      const response = await fetch(EMAIL_SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          to: user.email,
          subject: 'Vitajte!',
          body: `Dobrý deň ${user.displayName},\n\nVitajte vo vašej novej aplikácii!\n\nS pozdravom,\nTím`
        })
      });

      const result = await response.json();
      if (result.status === 'success') {
        window.showGlobalNotification('E-mail bol úspešne odoslaný.', 'success');
      } else {
        window.showGlobalNotification(`Chyba pri odosielaní e-mailu: ${result.message}`, 'error');
        console.error("Chyba pri odosielaní e-mailu:", result.message);
      }
    } catch (err) {
      console.error("Chyba pri odosielaní e-mailu:", err);
      window.showGlobalNotification('Nepodarilo sa odoslať e-mail. Skúste to prosím znova.', 'error');
    } finally {
      event.target.textContent = originalButtonText;
      event.target.disabled = false;
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(window.auth);
      // Presmerovanie alebo aktualizácia UI po odhlásení
      window.showGlobalNotification('Boli ste úspešne odhlásený.', 'info');
      // Môžeme presmerovať na prihlasovaciu stránku alebo zobraziť iný obsah
      // Napr. window.location.href = '/login';
    } catch (error) {
      console.error("Chyba pri odhlasovaní:", error);
      window.showGlobalNotification('Odhlasovanie zlyhalo. Skúste to prosím znova.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return <div className="text-center text-red-500 pt-16">{error}</div>;
  }

  return (
    <div className="bg-gray-100 min-h-screen p-4 sm:p-8 font-sans">
      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-lg p-6 sm:p-10 relative">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Správa používateľov</h1>
          <button
            onClick={handleLogout}
            className="bg-red-500 text-white px-4 py-2 rounded-lg font-semibold shadow-md hover:bg-red-600 transition-colors"
          >
            Odhlásiť sa
          </button>
        </div>

        {isDeleting && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl flex items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-4"></div>
              <span>Odstraňujem používateľa...</span>
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-lg shadow-md">
          <table className="min-w-full bg-white table-auto">
            <thead className="bg-gray-200 text-gray-700 uppercase text-xs sm:text-sm">
              <tr>
                <th
                  className="px-4 py-3 text-left cursor-pointer"
                  onClick={() => handleSort('displayName')}
                >
                  <div className="flex items-center">
                    Meno
                    {sortOrder.field === 'displayName' && (
                      <span className="ml-1">
                        {sortOrder.direction === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left cursor-pointer"
                  onClick={() => handleSort('email')}
                >
                  <div className="flex items-center">
                    E-mail
                    {sortOrder.field === 'email' && (
                      <span className="ml-1">
                        {sortOrder.direction === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left cursor-pointer hidden sm:table-cell"
                  onClick={() => handleSort('role')}
                >
                  <div className="flex items-center">
                    Rola
                    {sortOrder.field === 'role' && (
                      <span className="ml-1">
                        {sortOrder.direction === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left hidden lg:table-cell"
                  onClick={() => handleSort('id')}
                >
                  <div className="flex items-center">
                    ID používateľa
                    {sortOrder.field === 'id' && (
                      <span className="ml-1">
                        {sortOrder.direction === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-right">Akcie</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  {editingUserId === user.id ? (
                    <>
                      <td className="px-4 py-4">
                        <input
                          type="text"
                          value={editDisplayName}
                          onChange={(e) => setEditDisplayName(e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <input
                          type="email"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-4 hidden sm:table-cell">
                        <select
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="admin">Admin</option>
                          <option value="user">Používateľ</option>
                        </select>
                      </td>
                      <td className="px-4 py-4 hidden lg:table-cell text-gray-500 text-sm">{user.id}</td>
                      <td className="px-4 py-4 text-right whitespace-nowrap">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => saveUser(user.id)}
                            className="bg-green-500 text-white p-2 rounded-full shadow-md hover:bg-green-600 transition-colors"
                            aria-label="Uložiť"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="bg-gray-400 text-white p-2 rounded-full shadow-md hover:bg-gray-500 transition-colors"
                            aria-label="Zrušiť"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-4 font-medium text-gray-900">{user.displayName}</td>
                      <td className="px-4 py-4 text-gray-500">{user.email}</td>
                      <td className="px-4 py-4 text-gray-500 hidden sm:table-cell">{user.role}</td>
                      <td className="px-4 py-4 text-gray-500 text-sm hidden lg:table-cell">{user.id}</td>
                      <td className="px-4 py-4 text-right whitespace-nowrap">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => sendWelcomeEmail(user)}
                            className="bg-blue-500 text-white p-2 rounded-full shadow-md hover:bg-blue-600 transition-colors"
                            aria-label="Odoslať e-mail"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => startEdit(user)}
                            className="bg-yellow-500 text-white p-2 rounded-full shadow-md hover:bg-yellow-600 transition-colors"
                            aria-label="Upraviť"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                              <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                            </svg>
                          </button>
                          <button
                            onClick={() => confirmAndRemoveUser(user)}
                            className="bg-red-500 text-white p-2 rounded-full shadow-md hover:bg-red-600 transition-colors"
                            aria-label="Odstrániť"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div id="confirmation-root"></div>
      <div id="global-notification-root"></div>
    </div>
  );
}

// Inicializácia a vykreslenie React aplikácie
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

// Poslucháč udalostí zabezpečí, že aplikácia sa načíta, až keď sú globálne dáta pripravené
window.addEventListener('globalDataUpdated', initializeAndRenderApp);

// V prípade, že sú dáta už pripravené pri načítaní skriptu, zavoláme funkciu priamo
if (window.isGlobalAuthReady && window.globalUserProfileData) {
  initializeAndRenderApp();
}
