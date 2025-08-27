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

  // Dynamic classes for background color based on message type
  let bgColorClass;
  if (type === 'success') {
    bgColorClass = 'bg-[#3A8D41]';
  } else if (type === 'error') {
    bgColorClass = 'bg-red-600';
  } else {
    bgColorClass = 'bg-blue-500';
  }

  return React.createElement(
    'div', {
      className: `fixed top-0 left-0 right-0 z-50 flex justify-center p-4 transition-transform duration-500 ease-out ${
        show ? 'translate-y-0' : '-translate-y-full'
      }`,
      style: {
        pointerEvents: 'none'
      }
    },
    React.createElement(
      'div', {
        className: `${bgColorClass} text-white px-6 py-3 rounded-lg shadow-lg max-w-md w-full text-center relative`,
        style: {
          pointerEvents: 'auto'
        }
      },
      React.createElement('p', {
        className: 'font-semibold'
      }, message)
    )
  );
}

// RoleEditModal Component
function RoleEditModal({ show, user, onClose, onSave, loading }) {
  const [selectedRole, setSelectedRole] = React.useState(user ? user.role : 'user');
  const [isApproved, setIsApproved] = React.useState(user ? user.approved : false);

  React.useEffect(() => {
    if (user) {
      setSelectedRole(user.role);
      setIsApproved(user.approved);
    }
  }, [user]);

  if (!show || !user) return null;

  const handleSave = () => {
    onSave(user.id, selectedRole, isApproved);
  };

  return React.createElement(
    'div', {
      className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center z-50'
    },
    React.createElement(
      'div', {
        className: 'bg-white p-6 rounded-lg shadow-xl max-w-sm w-full'
      },
      React.createElement('h3', {
        className: 'text-xl font-semibold text-gray-800 mb-4'
      }, `Upraviť rolu pre: ${user.email}`),
      React.createElement(
        'div', {
          className: 'mb-4'
        },
        React.createElement('label', {
          className: 'block text-gray-700 text-sm font-bold mb-2',
          htmlFor: 'role-select'
        }, 'Rola'),
        React.createElement(
          'select', {
            id: 'role-select',
            className: 'shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
            value: selectedRole,
            onChange: (e) => setSelectedRole(e.target.value)
          },
          React.createElement('option', {
            value: 'user'
          }, 'Používateľ'),
          React.createElement('option', {
            value: 'admin'
          }, 'Admin'),
          React.createElement('option', {
            value: 'super_admin'
          }, 'Super Admin')
        )
      ),
      React.createElement(
        'div', {
          className: 'mb-4'
        },
        React.createElement('label', {
          className: 'block text-gray-700 text-sm font-bold mb-2'
        }, 'Stav overenia'),
        React.createElement(
          'div', {
            className: 'flex items-center'
          },
          React.createElement('input', {
            type: 'checkbox',
            id: 'isApproved',
            checked: isApproved,
            onChange: (e) => setIsApproved(e.target.checked),
            className: 'mr-2 leading-tight'
          }),
          React.createElement('label', {
            htmlFor: 'isApproved',
            className: 'text-sm'
          }, 'Overený účet')
        )
      ),
      React.createElement(
        'div', {
          className: 'flex justify-end space-x-2'
        },
        React.createElement(
          'button', {
            onClick: onClose,
            className: `bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded-lg transition-colors duration-200 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`,
            disabled: loading
          },
          'Zrušiť'
        ),
        React.createElement(
          'button', {
            onClick: handleSave,
            className: `bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg transition-colors duration-200 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`,
            disabled: loading
          },
          loading ? 'Ukladám...' : 'Uložiť zmeny'
        )
      )
    )
  );
}

// ConfirmationModal Component
function ConfirmationModal({ show, message, onConfirm, onCancel, loading }) {
  if (!show) return null;

  return React.createElement(
    'div', {
      className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center z-50'
    },
    React.createElement(
      'div', {
        className: 'bg-white p-6 rounded-lg shadow-xl max-w-sm w-full'
      },
      React.createElement('p', {
        className: 'text-gray-800 text-lg font-semibold mb-4'
      }, message),
      React.createElement(
        'div', {
          className: 'flex justify-end space-x-2'
        },
        React.createElement(
          'button', {
            onClick: onCancel,
            className: `bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded-lg transition-colors duration-200 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`,
            disabled: loading
          },
          'Zrušiť'
        ),
        React.createElement(
          'button', {
            onClick: onConfirm,
            className: `bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg transition-colors duration-200 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`,
            disabled: loading
          },
          loading ? 'Odstraňujem...' : 'Odstrániť'
        )
      )
    )
  );
}

// UsersManagementApp Component
function UsersManagementApp() {
  const [users, setUsers] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [roleEditUser, setRoleEditUser] = React.useState(null);
  const [deleteUser, setDeleteUser] = React.useState(null);
  const [notificationMessage, setNotificationMessage] = React.useState('');
  const [notificationType, setNotificationType] = React.useState('info');
  const [currentUserRole, setCurrentUserRole] = React.useState('user');
  const [isAuthReady, setIsAuthReady] = React.useState(false);

  // Function to display a notification
  const showNotification = (message, type = 'info') => {
    setNotificationMessage(message);
    setNotificationType(type);
  };

  React.useEffect(() => {
    // Wait until authentication is ready from authentication.js
    const handleAuthReady = () => {
      console.log("UsersManagementApp: Authentication ready.");
      setIsAuthReady(true);
      if (window.globalUserProfileData) {
        setCurrentUserRole(window.globalUserProfileData.role);
      }
    };

    if (window.isGlobalAuthReady) {
      handleAuthReady();
    } else {
      window.addEventListener('globalDataUpdated', handleAuthReady);
    }

    return () => {
      window.removeEventListener('globalDataUpdated', handleAuthReady);
    };
  }, []);

  React.useEffect(() => {
    // New check to ensure __app_id is available
    if (!isAuthReady || !window.db || !window.globalUserProfileData || typeof window.__app_id === 'undefined') {
      console.log("UsersManagementApp: Waiting for authentication and database initialization...");
      return;
    }

    const userId = window.globalUserProfileData.id;
    const userRole = window.globalUserProfileData.role;
    
    // If the user is not an admin or super admin, redirect them
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      window.showGlobalNotification('Nemáte oprávnenie na zobrazenie tejto stránky.', 'error');
      // Optionally redirect
      // window.location.href = 'index.html'; 
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    // Create a reference to the users collection
    const usersCollectionRef = collection(window.db, 'artifacts', window.__app_id, 'public', 'data', 'users');
    const q = query(usersCollectionRef);

    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
      const usersList = [];
      const userDocPromises = [];

      querySnapshot.forEach(doc => {
          const userData = {
              id: doc.id,
              ...doc.data()
          };
          usersList.push(userData);
          // For a super admin, also fetch private data if it exists
          if (userRole === 'super_admin') {
              userDocPromises.push(getDoc(doc(window.db, 'artifacts', window.__app_id, 'users', userData.id, 'data', 'profile')));
          }
      });

      // If a super admin, wait for private data to be loaded
      if (userRole === 'super_admin') {
          const userDocs = await Promise.all(userDocPromises);
          userDocs.forEach((userDoc, index) => {
              if (userDoc.exists()) {
                  usersList[index].privateProfile = userDoc.data();
              }
          });
      }

      setUsers(usersList);
      setLoading(false);
    }, (err) => {
      console.error("Chyba pri načítaní používateľov:", err);
      setError('Chyba pri načítaní používateľov.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isAuthReady, typeof window.__app_id !== 'undefined' ? window.__app_id : '']);

  // Functions for user actions
  const handleRoleSave = async (userId, newRole, isApproved) => {
    if (!window.db) {
      showNotification('Databáza nie je inicializovaná.', 'error');
      return;
    }
    setLoading(true);
    try {
      const userRef = doc(window.db, 'artifacts', window.__app_id, 'public', 'data', 'users', userId);
      await updateDoc(userRef, {
        role: newRole,
        approved: isApproved
      });
      showNotification('Rola používateľa bola úspešne aktualizovaná.', 'success');
      setRoleEditUser(null);
    } catch (e) {
      console.error("Chyba pri aktualizácii roly: ", e);
      showNotification('Chyba pri aktualizácii roly.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteUser = (user) => {
    setDeleteUser(user);
  };

  const handleDeleteUser = async () => {
    if (!deleteUser || !window.db) {
      showNotification('Databáza nie je inicializovaná.', 'error');
      return;
    }
    setLoading(true);
    try {
      // Get a reference to the user based on their ID
      const userRef = doc(window.db, 'artifacts', window.__app_id, 'public', 'data', 'users', deleteUser.id);
      await deleteDoc(userRef);
      showNotification('Používateľ bol úspešne odstránený.', 'success');
      setDeleteUser(null);
    } catch (e) {
      console.error("Chyba pri odstraňovaní používateľa: ", e);
      showNotification('Chyba pri odstraňovaní používateľa.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openRoleEditModal = (user) => {
    setRoleEditUser(user);
  };

  const closeRoleEditModal = () => {
    setRoleEditUser(null);
  };

  const closeDeleteConfirmation = () => {
    setDeleteUser(null);
  };

  if (!isAuthReady) {
    return React.createElement(
      'div', {
        className: 'flex items-center justify-center min-h-screen'
      },
      React.createElement(
        'div', {
          className: 'text-center'
        },
        React.createElement('div', {
          className: 'animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto'
        }),
        React.createElement('p', {
          className: 'mt-4 text-gray-500'
        }, 'Načítavam aplikáciu...')
      )
    );
  }

  // Ensure visibility only for admins and super admins
  if (currentUserRole !== 'admin' && currentUserRole !== 'super_admin') {
    return React.createElement(
      'div', {
        className: 'flex items-center justify-center min-h-screen'
      },
      React.createElement('p', {
        className: 'text-gray-600 text-lg font-semibold'
      }, 'Nemáte oprávnenie na zobrazenie tejto stránky.')
    );
  }

  return React.createElement(
    'div', {
      className: 'container mx-auto p-4'
    },
    React.createElement('h1', {
      className: 'text-3xl font-bold text-gray-800 mb-6'
    }, 'Správa používateľov'),
    loading && users.length === 0 ?
    React.createElement(
      'div', {
        className: 'text-center p-8'
      },
      React.createElement('div', {
        className: 'animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto'
      }),
      React.createElement('p', {
        className: 'mt-4 text-gray-500'
      }, 'Načítavam zoznam používateľov...')
    ) :
    error ?
    React.createElement('div', {
      className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative',
      role: 'alert'
    }, error) :
    users.length > 0 ?
    React.createElement(
      'div', {
        className: 'overflow-x-auto bg-white shadow-md rounded-lg'
      },
      React.createElement(
        'table', {
          className: 'min-w-full divide-y divide-gray-200'
        },
        React.createElement(
          'thead', {
            className: 'bg-gray-50'
          },
          React.createElement(
            'tr',
            null,
            React.createElement(
              'th', {
                className: 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
              },
              'Email'
            ),
            React.createElement(
              'th', {
                className: 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
              },
              'Rola'
            ),
            React.createElement(
              'th', {
                className: 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
              },
              'Overený'
            ),
            React.createElement(
              'th', {
                className: 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
              },
              'Akcie'
            )
          )
        ),
        React.createElement(
          'tbody', {
            className: 'bg-white divide-y divide-gray-200'
          },
          users.map(u =>
            React.createElement(
              'tr', {
                key: u.id
              },
              React.createElement(
                'td', {
                  className: 'px-6 py-4 whitespace-nowrap'
                },
                React.createElement('div', {
                  className: 'text-sm text-gray-900'
                }, u.email)
              ),
              React.createElement(
                'td', {
                  className: 'px-6 py-4 whitespace-nowrap'
                },
                React.createElement(
                  'span', {
                    className: 'px-2 inline-flex text-xs leading-5 font-semibold rounded-full'
                  },
                  u.role
                )
              ),
              React.createElement(
                'td', {
                  className: 'px-6 py-4 whitespace-nowrap'
                },
                u.approved ?
                React.createElement('span', {
                  className: 'text-green-500'
                }, 'Áno') :
                React.createElement('span', {
                  className: 'text-red-500'
                }, 'Nie')
              ),
              React.createElement(
                'td', {
                  className: 'px-6 py-4 whitespace-nowrap text-right text-sm font-medium'
                },
                React.createElement(
                  'div', {
                    className: 'flex items-center space-x-2'
                  },
                  React.createElement(
                    'button', {
                      onClick: () => openRoleEditModal(u),
                      className: 'bg-green-500 hover:bg-green-600 text-white py-1 px-3 rounded-lg text-sm transition-colors duration-200',
                      disabled: loading,
                    },
                    'Upraviť rolu'
                  ),
                  React.createElement(
                    'button', {
                      onClick: () => confirmDeleteUser(u),
                      className: 'bg-red-500 hover:bg-red-600 text-white py-1 px-3 rounded-lg text-sm transition-colors duration-200',
                      disabled: loading,
                    },
                    'Zmazať'
                  )
                )
              )
            )
          )
        )
      )
    ) :
    React.createElement('div', {
      className: 'text-center p-8 text-gray-500'
    }, 'Nenašli sa žiadni používatelia.'),

    React.createElement(RoleEditModal, {
      show: !!roleEditUser,
      user: roleEditUser,
      onClose: closeRoleEditModal,
      onSave: handleRoleSave,
      loading: loading
    }),

    React.createElement(ConfirmationModal, {
      show: !!deleteUser,
      message: `Naozaj chcete odstrániť používateľa ${deleteUser?.email}?`,
      onConfirm: handleDeleteUser,
      onCancel: closeDeleteConfirmation,
      loading: loading
    }),

    React.createElement(NotificationModal, {
      message: notificationMessage,
      onClose: () => setNotificationMessage(''),
      type: notificationType
    })
  );
}

// Explicitne sprístupniť komponent globálne
window.UsersManagementApp = UsersManagementApp;

// Funkcia na spustenie React aplikácie po načítaní DOM
async function initializeApp() {
  // Čakáme, kým budú dostupné globálne dáta z authentication.js
  await new Promise(resolve => {
    if (window.isGlobalAuthReady) {
      resolve();
    } else {
      window.addEventListener('globalDataUpdated', resolve, {
        once: true
      });
    }
  });

  // Uistíme sa, že React a ReactDOM sú načítané
  if (typeof React === 'undefined' || typeof ReactDOM === 'undefined') {
    console.error("Chyba: React alebo ReactDOM nie sú načítané. Skontrolujte poradie skriptov.");
    document.getElementById('users-management-root').innerHTML = '<div style="color: red; text-align: center; padding: 20px;">Chyba pri načítaní aplikácie. Skúste to prosím neskôr.</div>';
    return;
  }
  // Zabezpečíme, že UsersManagementApp komponent je definovaný
  if (typeof UsersManagementApp === 'undefined') {
    console.error("Chyba: Komponent UsersManagementApp nie je definovaný.");
    document.getElementById('users-management-root').innerHTML = '<div style="color: red; text-align: center; padding: 20px;">Chyba pri načítaní komponentu aplikácie.</div>';
    return;
  }

  const root = ReactDOM.createRoot(document.getElementById('users-management-root'));
  root.render(React.createElement(UsersManagementApp, null));
  console.log("logged-in-users.js: React App (UsersManagementApp) vykreslená.");
}

// Spustíme inicializačnú funkciu, keď je DOM plne načítaný
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
