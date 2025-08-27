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

// Konštanta pre Apps Script URL, ktorá je rovnaká ako v admin-register.js
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec";

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
        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2' }, 'Rola'),
        React.createElement(
          'select',
          {
            value: selectedRole,
            onChange: (e) => setSelectedRole(e.target.value),
            className: 'shadow border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500'
          },
          React.createElement('option', { value: 'pending' }, 'Čakajúci (pending)'),
          React.createElement('option', { value: 'admin' }, 'Administrátor (admin)'),
          React.createElement('option', { value: 'moderator' }, 'Moderátor (moderator)'),
          React.createElement('option', { value: 'user' }, 'Používateľ (user)')
        )
      ),
      React.createElement('div', { className: 'flex justify-end' },
        React.createElement(
          'button',
          { onClick: onClose, className: 'bg-gray-300 text-gray-800 px-4 py-2 rounded-md mr-2 hover:bg-gray-400 transition-colors' },
          'Zrušiť'
        ),
        React.createElement(
          'button',
          { onClick: handleSave, className: 'bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors' },
          'Uložiť zmeny'
        )
      )
    )
  );
}

// Funkcia na odoslanie e-mailu cez Apps Script
async function sendApprovalEmail(email, firstName, lastName, userTeams, userCategories) {
  try {
    const teamsData = userTeams.map(team => ({
      name: team.name,
      category: team.category,
      gender: team.gender,
      teamMembers: team.teamMembers,
      contactPersonName: team.contactPersonName,
      contactPersonEmail: team.contactPersonEmail,
      contactPersonPhone: team.contactPersonPhone
    }));
    
    // Zistíme názvy kategórií z IDs
    const categoryNames = userCategories.map(cat => cat.name);

    const payload = {
      action: "sendAdminApprovalEmail",
      email: email,
      firstName: firstName,
      lastName: lastName,
      teams: teamsData,
      categories: categoryNames // Posielame názvy kategórií
    };

    console.log("Odosielam požiadavku na Apps Script na schválenie e-mailu:", payload);

    const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      cache: "no-cache",
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    // Keďže je "no-cors", response.ok bude vždy false, ale status bude 0
    // a nevieme čítať telo odpovede.
    // Jediný spôsob, ako zistiť, či bola požiadavka úspešne odoslaná, je kontrolovať status 0
    // a predpokladať, že Apps Script požiadavku spracoval.
    if (response.status === 0) {
      console.log("Požiadavka na odoslanie e-mailu úspešne odoslaná. Čakám na spracovanie Apps Scriptom.");
      window.showGlobalNotification("E-mail s potvrdením bol odoslaný.","success");
      return { success: true, message: "Požiadavka na odoslanie e-mailu úspešne odoslaná." };
    } else {
      // Pre prípad, že by sa zmenil CORS mód
      console.error("Chyba pri odosielaní e-mailu, status: " + response.status);
      window.showGlobalNotification("Chyba pri odosielaní e-mailu s potvrdením.","error");
      return { success: false, message: "Chyba pri odosielaní e-mailu." };
    }
  } catch (error) {
    console.error("Chyba pri odosielaní e-mailu: ", error);
    window.showGlobalNotification("Chyba pri odosielaní e-mailu s potvrdením.","error");
    return { success: false, message: "Chyba pri odosielaní e-mailu." };
  }
}

// Funkcia na spracovanie schválenia používateľa (volaná z komponentu UserCard)
async function handleApproveUser(user, showConfirmationModal, showNotification) {
  // Zobrazí potvrdzovacie modálne okno
  showConfirmationModal({
    message: `Ste si istý, že chcete schváliť používateľa ${user.firstName} ${user.lastName} a poslať mu e-mail?`,
    onConfirm: async () => {
      try {
        const userDocRef = doc(db, 'artifacts', appId, 'users', user.id);
        
        await updateDoc(userDocRef, {
          role: 'admin',
          pendingApproval: false,
          approvedBy: auth.currentUser.uid,
          approvedAt: new Date()
        });

        // Odoslanie e-mailu
        const result = await sendApprovalEmail(user.email, user.firstName, user.lastName, user.teams, user.categories);
        
        if (result.success) {
          showNotification('Používateľ bol schválený a e-mail bol úspešne odoslaný.', 'success');
        } else {
          showNotification(result.message || 'Chyba pri odosielaní e-mailu s potvrdením.', 'error');
        }

      } catch (e) {
        console.error("Chyba pri schvaľovaní používateľa alebo posielaní e-mailu: ", e);
        showNotification('Chyba pri schvaľovaní používateľa.', 'error');
      }
    },
    onCancel: () => {
      showNotification('Schválenie bolo zrušené.', 'info');
    }
  });
}


// Komponent pre správu jednotlivých používateľov
function UserCard({ user, onApprove, onRoleChange, onDelete }) {
  const [isDeleting, setIsDeleting] = useState(false);

  // Funkcia pre volanie potvrdzovacieho modálneho okna
  const showConfirmationModal = (config) => {
    let modalRoot = document.getElementById('confirmation-modal-root');
    if (!modalRoot) {
      modalRoot = document.createElement('div');
      modalRoot.id = 'confirmation-modal-root';
      document.body.appendChild(modalRoot);
    }
    const root = ReactDOM.createRoot(modalRoot);
    root.render(React.createElement(ConfirmationModal, {
      ...config,
      onCancel: () => {
        config.onCancel();
        root.unmount();
      },
      onConfirm: async () => {
        await config.onConfirm();
        root.unmount();
      }
    }));
  };

  const handleDeleteClick = () => {
    showConfirmationModal({
      message: `Ste si istý, že chcete vymazať používateľa ${user.firstName} ${user.lastName}? Táto akcia je nezvratná.`,
      onConfirm: async () => {
        setIsDeleting(true);
        try {
          // Tu je logika premazania z Firestore
          const userDocRef = doc(db, 'artifacts', appId, 'users', user.id);
          await deleteDoc(userDocRef);
          showGlobalNotification('Používateľ bol úspešne vymazaný.', 'success');
        } catch (e) {
          console.error("Chyba pri mazaní používateľa: ", e);
          showGlobalNotification('Chyba pri mazaní používateľa.', 'error');
        } finally {
          setIsDeleting(false);
        }
      },
      onCancel: () => {
        showGlobalNotification('Mazanie používateľa bolo zrušené.', 'info');
      }
    });
  };

  return React.createElement(
    'div',
    { className: 'bg-white shadow-lg rounded-lg p-6 mb-4' },
    React.createElement('div', { className: 'flex justify-between items-center mb-4' },
      React.createElement('h3', { className: 'text-xl font-bold' }, `${user.firstName} ${user.lastName}`),
      React.createElement('span', { className: `text-sm font-semibold px-2 py-1 rounded-full ${user.role === 'pending' ? 'bg-yellow-200 text-yellow-800' : 'bg-green-200 text-green-800'}` }, user.role)
    ),
    React.createElement('div', { className: 'text-gray-600' },
      React.createElement('p', null, `E-mail: ${user.email}`),
      React.createElement('p', null, `Telefón: ${user.contactPhoneNumber || 'Nezadané'}`),
      user.createdAt && React.createElement('p', null, `Dátum registrácie: ${new Date(user.createdAt.seconds * 1000).toLocaleDateString()}`)
    ),
    user.pendingApproval && React.createElement(
      'div',
      { className: 'mt-4 pt-4 border-t border-gray-200' },
      React.createElement('h4', { className: 'font-semibold text-lg mb-2' }, 'Čaká na schválenie'),
      React.createElement('div', { className: 'flex justify-start space-x-2' },
        React.createElement(
          'button',
          {
            onClick: () => handleApproveUser(user, showConfirmationModal, showGlobalNotification), // Prepojenie na novú funkciu
            className: 'bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 transition-colors'
          },
          'Schváliť'
        ),
        React.createElement(
          'button',
          {
            onClick: handleDeleteClick,
            className: 'bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition-colors'
          },
          isDeleting ? 'Mažem...' : 'Vymazať'
        )
      )
    ),
    user.role !== 'pending' && React.createElement(
      'div',
      { className: 'mt-4 pt-4 border-t border-gray-200' },
      React.createElement(
        'button',
        {
          onClick: () => onRoleChange(user),
          className: 'bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors'
        },
        'Zmeniť rolu'
      )
    )
  );
}

// Hlavný komponent aplikácie pre správu používateľov
function UsersManagementApp() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Inicializácia Firebase a prihlásenie
  useEffect(() => {
    // Vytvorenie a inicializácia Firebase App a Firestore/Auth inštancií
    try {
      if (typeof window.firebaseApp === 'undefined') {
        const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
        window.firebaseApp = firebase.initializeApp(firebaseConfig);
        window.db = firebase.firestore(window.firebaseApp);
        window.auth = firebase.auth(window.firebaseApp);
      }
      
      const auth = window.auth;
      
      // Spracovanie prihlasovacieho tokenu
      const handleAuth = async (token) => {
        try {
          if (token) {
            await firebase.signInWithCustomToken(auth, token);
            console.log("Prihlásenie s vlastným tokenom úspešné.");
          } else {
            await firebase.signInAnonymously(auth);
            console.log("Prihlásenie anonymne úspešné.");
          }
        } catch (authError) {
          console.error("Chyba pri prihlasovaní:", authError);
          setError("Chyba pri prihlasovaní. Skúste to prosím neskôr.");
        } finally {
          setIsAuthReady(true);
        }
      };

      if (typeof __initial_auth_token !== 'undefined') {
        handleAuth(__initial_auth_token);
      } else {
        handleAuth(null);
      }

    } catch (e) {
      console.error("Inicializácia Firebase zlyhala:", e);
      setError("Inicializácia aplikácie zlyhala. Skúste to prosím neskôr.");
      setIsAuthReady(true); // Umožní zobraziť chybovú správu
    }
  }, []);

  // Načítanie používateľov z Firestore
  useEffect(() => {
    if (!isAuthReady || error) return;

    try {
      const q = query(collection(db, 'artifacts', appId, 'users'));

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const usersArray = [];
        querySnapshot.forEach((doc) => {
          usersArray.push({
            id: doc.id,
            ...doc.data()
          });
        });
        setUsers(usersArray);
        setIsLoading(false);
      }, (e) => {
        console.error("Chyba pri načítavaní používateľov: ", e);
        setError("Nepodarilo sa načítať údaje o používateľoch.");
        setIsLoading(false);
      });

      return () => unsubscribe();
    } catch (e) {
      console.error("Nastavenie poslucháča Firestore zlyhalo: ", e);
      setError("Nepodarilo sa načítať údaje o používateľoch.");
      setIsLoading(false);
    }
  }, [isAuthReady, error]);


  const handleRoleChange = async (userId, newRole) => {
    try {
      const userDocRef = doc(db, 'artifacts', appId, 'users', userId);
      await updateDoc(userDocRef, { role: newRole });
      window.showGlobalNotification('Rola bola úspešne zmenená.', 'success');
    } catch (e) {
      console.error("Chyba pri zmene roly: ", e);
      window.showGlobalNotification('Chyba pri zmene roly.', 'error');
    }
  };

  const handleOpenRoleModal = (user) => {
    setSelectedUser(user);
    setShowRoleModal(true);
  };

  if (isLoading) {
    return React.createElement(
      'div',
      { className: 'flex justify-center pt-16' },
      React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
    );
  }

  if (error) {
    return React.createElement(
      'div',
      { className: 'text-center text-red-500 pt-16' },
      `Chyba: ${error}`
    );
  }

  return React.createElement(
    'div',
    { className: 'p-4 bg-gray-100 min-h-screen' },
    React.createElement('h2', { className: 'text-3xl font-bold text-gray-800 mb-6' }, 'Správa používateľov'),
    users.length > 0 ? (
      React.createElement('div', null,
        users.map(user =>
          React.createElement(UserCard, {
            key: user.id,
            user: user,
            onApprove: (approvedUser) => handleApproveUser(approvedUser, showConfirmationModal),
            onRoleChange: handleOpenRoleModal,
            onDelete: (deletedUser) => handleDeleteUser(deletedUser, showConfirmationModal)
          })
        )
      )
    ) : (
      React.createElement(
        'p',
        { className: 'text-center text-gray-500' },
        'Žiadni používatelia na zobrazenie.'
      )
    ),
    showRoleModal && selectedUser && React.createElement(ChangeRoleModal, {
      user: selectedUser,
      onClose: () => setShowRoleModal(false),
      onRoleChange: handleRoleChange
    })
  );
}

// Vykreslíme loader a zaregistrujeme poslucháča udalostí
const rootElement = document.getElementById('users-management-root');
if (rootElement) {
    rootElement.innerHTML = `
        <div class="flex justify-center pt-16">
            <div class="animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500"></div>
        </div>
    `;
}
// Vykreslíme hlavnú aplikáciu
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(React.createElement(UsersManagementApp, null));
  console.log("logged-in-users.js: React App (UsersManagementApp) vykreslená.");
}
