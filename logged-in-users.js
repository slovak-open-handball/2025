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

  const typeClasses = {
    info: 'bg-blue-500',
    success: 'bg-green-500',
    error: 'bg-red-500'
  };

  return (
    React.createElement(
      'div', {
        className: `fixed bottom-5 right-5 z-50 p-4 rounded-lg text-white shadow-lg transition-transform transform ${show ? 'translate-x-0' : 'translate-x-full'} ${typeClasses[type]}`,
        style: {
          transition: 'transform 0.3s ease-in-out'
        }
      },
      React.createElement('div', {
        className: 'flex items-center'
      }, React.createElement('span', {
        className: 'mr-2'
      }, type === 'success' ? '✓' : type === 'error' ? '!' : 'ℹ'), React.createElement('p', null, message), React.createElement('button', {
        className: 'ml-4 font-bold',
        onClick: onClose
      }, 'x'))
    )
  );
}


// Komponent pre správu používateľov (UsersManagementApp)
const UsersManagementApp = () => {
  const [users, setUsers] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [notification, setNotification] = React.useState({
    message: null,
    type: 'info'
  });
  const [showModal, setShowModal] = React.useState(false);
  const [modalContent, setModalContent] = React.useState({});

  const isGlobalAuthReady = window.isGlobalAuthReady;
  const db = window.db;
  const auth = window.auth;
  const globalUserProfileData = window.globalUserProfileData;
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

  // Načítanie používateľov z Firestore
  React.useEffect(() => {
    if (!db || !isGlobalAuthReady) {
      return;
    }

    const q = collection(db, `artifacts/${appId}/public/data/users`);
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const usersData = [];
      querySnapshot.forEach((doc) => {
        usersData.push({
          id: doc.id,
          ...doc.data()
        });
      });
      setUsers(usersData);
      setLoading(false);
    }, (err) => {
      console.error("Chyba pri načítaní používateľov:", err);
      setError("Nepodarilo sa načítať používateľov.");
      setLoading(false);
      showNotification("Nepodarilo sa načítať používateľov.", 'error');
    });

    return () => unsubscribe();
  }, [db, isGlobalAuthReady, appId]);

  const showNotification = (message, type) => {
    setNotification({
      message,
      type
    });
  };

  const closeModal = () => {
    setShowModal(false);
    setModalContent({});
  };

  const handleDeactivate = async (user) => {
    if (user.id === globalUserProfileData.uid) {
      showNotification("Nemôžete deaktivovať svoj vlastný účet.", 'error');
      return;
    }
    setModalContent({
      title: "Potvrdenie deaktivácie",
      message: `Naozaj chcete deaktivovať používateľa ${user.email}?`,
      action: () => deactivateUser(user)
    });
    setShowModal(true);
  };

  const handleActivate = async (user) => {
    setModalContent({
      title: "Potvrdenie aktivácie",
      message: `Naozaj chcete aktivovať používateľa ${user.email}?`,
      action: () => activateUser(user)
    });
    setShowModal(true);
  };
  
  const handleDelete = async (user) => {
    if (user.id === globalUserProfileData.uid) {
      showNotification("Nemôžete vymazať svoj vlastný účet. Prosím, odhláste sa a požiadajte iného administrátora o vymazanie.", 'error');
      return;
    }
    setModalContent({
      title: "Potvrdenie odstránenia",
      message: `Naozaj chcete natrvalo odstrániť používateľa ${user.email} z Authentication? Táto akcia je nevratná.`,
      action: () => deleteUser(user)
    });
    setShowModal(true);
  };
  
  const deactivateUser = async (user) => {
    try {
      const userDocRef = doc(db, `artifacts/${appId}/public/data/users`, user.id);
      await updateDoc(userDocRef, {
        active: false
      });
      showNotification("Používateľ bol úspešne deaktivovaný.", 'success');
    } catch (e) {
      console.error("Chyba pri deaktivácii používateľa:", e);
      showNotification("Nepodarilo sa deaktivovať používateľa. Skúste to prosím znova.", 'error');
    }
    closeModal();
  };

  const activateUser = async (user) => {
    try {
      const userDocRef = doc(db, `artifacts/${appId}/public/data/users`, user.id);
      await updateDoc(userDocRef, {
        active: true
      });
      showNotification("Používateľ bol úspešne aktivovaný.", 'success');
    } catch (e) {
      console.error("Chyba pri aktivácii používateľa:", e);
      showNotification("Nepodarilo sa aktivovať používateľa. Skúste to prosím znova.", 'error');
    }
    closeModal();
  };
  
  const deleteUserFromFirestore = async (uid) => {
    try {
      const userDocRef = doc(db, `artifacts/${appId}/public/data/users`, uid);
      await deleteDoc(userDocRef);
      return true;
    } catch (e) {
      console.error("Chyba pri odstraňovaní používateľa z Firestore:", e);
      return false;
    }
  };
  
  const deleteUserFromFirebase = async (uid) => {
      // Aktualizovaná URL pre Google Apps Script na odstraňovanie používateľov
      const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby6wUq81pxqT-Uf_8BtN-cKHjhMDtB1V-cDBdcJElZP4VDmfa53lNfPgudsxnmQ0Y3T/exec";
      try {
          const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
              method: 'POST',
              mode: 'cors',
              cache: 'no-cache',
              headers: {
                  'Content-Type': 'application/json',
              },
              body: JSON.stringify({ action: 'deleteUser', uid: uid })
          });
          const data = await response.json();
          if (data.success) {
              return true;
          } else {
              throw new Error(data.message || 'Nepodarilo sa odstrániť používateľa z Firebase Authentication.');
          }
      } catch (error) {
          console.error("Chyba pri volaní Apps Script:", error);
          throw error;
      }
  };

  const deleteUser = async (user) => {
      try {
          showNotification("Prebieha odstraňovanie používateľa...", 'info');
          
          const isDeletedFromFirebase = await deleteUserFromFirebase(user.id);
          if (isDeletedFromFirebase) {
              const isDeletedFromFirestore = await deleteUserFromFirestore(user.id);
              if (isDeletedFromFirestore) {
                  showNotification("Používateľ bol úspešne odstránený.", 'success');
              } else {
                  showNotification("Používateľ bol odstránený z Authentication, ale nastala chyba pri odstraňovaní z databázy.", 'error');
              }
          } else {
              showNotification("Nepodarilo sa odstrániť používateľa z Authentication.", 'error');
          }
      } catch (e) {
          showNotification(`Chyba: ${e.message}`, 'error');
      }
      closeModal();
  };

  if (loading) {
    return (
      React.createElement(
        'div', {
          className: 'flex justify-center items-center h-screen'
        },
        React.createElement('div', {
          className: 'animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500'
        })
      )
    );
  }

  if (error) {
    return (
      React.createElement(
        'div', {
          className: 'text-center text-red-600 mt-10'
        },
        'Chyba: ',
        error
      )
    );
  }
  
  const usersWithRole = users.map(user => {
    const role = user.role || 'user';
    return { ...user, role };
  });

  return (
    React.createElement(
      'div', {
        className: 'container mx-auto p-4'
      },
      React.createElement(NotificationModal, {
        message: notification.message,
        onClose: () => setNotification({
          message: null
        }),
        type: notification.type
      }),
      React.createElement(
        'h1', {
          className: 'text-2xl font-bold mb-4'
        },
        'Správa prihlásených používateľov'
      ),
      React.createElement(
        'table', {
          className: 'min-w-full bg-white shadow-md rounded-lg overflow-hidden'
        },
        React.createElement(
          'thead', {
            className: 'bg-gray-200 text-gray-700'
          },
          React.createElement(
            'tr',
            null,
            React.createElement('th', {
              className: 'py-2 px-4'
            }, 'E-mail'),
            React.createElement('th', {
              className: 'py-2 px-4'
            }, 'UID'),
            React.createElement('th', {
              className: 'py-2 px-4'
            }, 'Rola'),
            React.createElement('th', {
              className: 'py-2 px-4'
            }, 'Stav'),
            React.createElement('th', {
              className: 'py-2 px-4'
            }, 'Akcie')
          )
        ),
        React.createElement(
          'tbody', {
            className: 'text-gray-600'
          },
          usersWithRole.map((user) =>
            React.createElement(
              'tr', {
                key: user.id,
                className: `border-t border-gray-200 ${user.active ? '' : 'bg-red-50'}`
              },
              React.createElement('td', {
                className: 'py-2 px-4'
              }, user.email),
              React.createElement('td', {
                className: 'py-2 px-4 break-all'
              }, user.id),
              React.createElement('td', {
                className: 'py-2 px-4'
              }, user.role),
              React.createElement(
                'td', {
                  className: 'py-2 px-4'
                },
                user.active ?
                React.createElement(
                  'span', {
                    className: 'bg-green-200 text-green-800 py-1 px-3 rounded-full text-xs'
                  },
                  'Aktívny'
                ) :
                React.createElement(
                  'span', {
                    className: 'bg-red-200 text-red-800 py-1 px-3 rounded-full text-xs'
                  },
                  'Neaktívny'
                )
              ),
              React.createElement(
                'td', {
                  className: 'py-2 px-4'
                },
                user.active ?
                React.createElement(
                  'button', {
                    onClick: () => handleDeactivate(user),
                    className: 'bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-1 px-2 rounded text-xs'
                  },
                  'Deaktivovať'
                ) :
                React.createElement(
                  'button', {
                    onClick: () => handleActivate(user),
                    className: 'bg-green-500 hover:bg-green-600 text-white font-bold py-1 px-2 rounded text-xs'
                  },
                  'Aktivovať'
                ),
                React.createElement(
                  'button', {
                    onClick: () => handleDelete(user),
                    className: 'bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-2 rounded text-xs ml-2'
                  },
                  'Odstrániť'
                )
              )
            )
          )
        )
      ),
      showModal &&
      React.createElement(
        'div', {
          className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center'
        },
        React.createElement(
          'div', {
            className: 'bg-white p-5 rounded-lg shadow-lg max-w-sm w-full'
          },
          React.createElement(
            'h3', {
              className: 'text-xl font-bold mb-4'
            },
            modalContent.title
          ),
          React.createElement(
            'p', {
              className: 'mb-4'
            },
            modalContent.message
          ),
          React.createElement(
            'div', {
              className: 'flex justify-end space-x-2'
            },
            React.createElement(
              'button', {
                onClick: closeModal,
                className: 'bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded'
              },
              'Zrušiť'
            ),
            React.createElement(
              'button', {
                onClick: () => modalContent.action(),
                className: 'bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded'
              },
              'Potvrdiť'
            )
          )
        )
      )
    )
  );
};


// Funkcia na overenie, či sú všetky potrebné globálne premenné dostupné
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

// Pre prípad, že udalosť už prebehla predtým, ako bol pridaný poslucháč
if (window.isGlobalAuthReady) {
  initializeAndRenderApp();
}
