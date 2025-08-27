// logged-in-users.js (teraz obsahuje UsersManagementApp pre správu používateľov)
// Tento súbor predpokladá, že firebaseConfig, initialAuthToken a appId
// sú globálne definované v <head> logged-in-users.html.
// Všetky komponenty a logika pre správu používateľov sú teraz v tomto súbore.

// Imports pre potrebné Firebase funkcie
import {
  collection,
  query,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Získanie React hookov z globálneho objektu React
const { useState, useEffect, useRef } = React;

// TODO: Nahraďte túto URL vašou skutočnou URL pre Apps Script
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec";

/**
 * Komponenta pre notifikácie.
 * @param {object} props
 * @param {string} props.message - Správa, ktorá sa zobrazí v notifikácii.
 * @param {function} props.onClose - Funkcia, ktorá sa zavolá po zatvorení notifikácie.
 * @param {string} [props.type='info'] - Typ notifikácie ('success', 'error', 'info').
 */
function NotificationModal({ message, onClose, type = 'info' }) {
  const [show, setShow] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (message) {
      setShow(true);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        setShow(false);
        setTimeout(onClose, 500); // Počká na prechod pred zatvorením
      }, 10000);

      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      };
    } else {
      setShow(false);
    }
  }, [message, onClose]);

  if (!message) return null;

  let bgColorClass;
  if (type === 'success') {
    bgColorClass = 'bg-green-500';
  } else if (type === 'error') {
    bgColorClass = 'bg-red-600';
  } else {
    bgColorClass = 'bg-blue-500';
  }

  return React.createElement(
    'div', {
      className: `fixed bottom-4 right-4 ${bgColorClass} text-white p-4 rounded-lg shadow-lg transition-transform transform ${show ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`,
      style: {
        zIndex: 1000
      }
    },
    React.createElement('p', {
      className: 'font-semibold'
    }, message)
  );
}

/**
 * Hlavný komponent React pre stránku so zoznamom prihlásených používateľov.
 * Spravuje stav používateľov, ich úpravu a odosielanie notifikácií.
 */
function UsersManagementApp() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');
  const [isCurrentUserAdmin, setIsCurrentUserAdmin] = useState(false);

  const db = window.db;
  const isAuthReady = window.isGlobalAuthReady;
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
  const auth = window.auth;

  // Efekt na načítanie používateľov z Firestore
  useEffect(() => {
    // Čakáme, kým bude autentifikácia pripravená
    if (!db || !isAuthReady) {
      console.log("UsersManagementApp: Čakám na inicializáciu DB a autentifikácie.");
      return;
    }

    // overíme, či je aktuálny používateľ admin
    const fetchUserRole = async () => {
      const userDocRef = doc(db, 'users', auth.currentUser.uid);
      const docSnap = await getDoc(userDocRef);
      if (docSnap.exists() && docSnap.data().role === 'admin') {
        setIsCurrentUserAdmin(true);
      } else {
        setIsCurrentUserAdmin(false);
      }
      setLoading(false);
    };

    fetchUserRole();


    console.log("UsersManagementApp: Autentifikácia a DB sú pripravené, začínam načítavať používateľov.");

    const usersCollectionRef = collection(db, 'users');
    const unsubscribe = onSnapshot(usersCollectionRef, (snapshot) => {
      console.log("UsersManagementApp: Nové dáta používateľov prijaté.");
      const usersList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersList);
      setLoading(false);
    }, (error) => {
      console.error("UsersManagementApp: Chyba pri načítavaní používateľov:", error);
      setMessage('Chyba pri načítavaní používateľov.');
      setMessageType('error');
      setLoading(false);
    });

    return () => {
      console.log("UsersManagementApp: onSnapshot poslucháč odpojený.");
      unsubscribe();
    };
  }, [db, isAuthReady]);


  /**
   * Pomocná funkcia na odosielanie notifikácií na Google Apps Script.
   * Využíva režim no-cors na obchádzanie chýb pri volaní.
   * @param {string} email - E-mailová adresa príjemcu.
   * @param {string} status - Stav schválenia ('schválený' alebo 'zamietnutý').
   */
  const sendAdminApprovalEmail = async (email, status) => {
    const payload = {
      action: 'sendAdminApprovalEmail',
      recipientEmail: email,
      status: status
    };

    console.log("Odosielam dáta na Apps Script (notifikácia o schválení/zamietnutí):", payload);

    try {
      await fetch(GOOGLE_APPS_SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'no-cors', // Použitie režimu no-cors podľa princípu v admin-register.js
        body: JSON.stringify(payload)
      });
      console.log("Odpoveď z Apps Script (notifikácia o schválení) s no-cors: OK");
    } catch (emailError) {
      console.error("Chyba pri odosielaní e-mailu cez Apps Script:", emailError);
      setMessage(`Nepodarilo sa odoslať potvrdzovací e-mail: ${emailError.message}.`);
      setMessageType('error');
    }
  };


  /**
   * Spracuje schválenie alebo zamietnutie používateľa.
   * @param {string} userId - ID používateľa vo Firestore.
   * @param {boolean} approvedStatus - Nový stav schválenia (true/false).
   * @param {string} userEmail - E-mailová adresa používateľa pre notifikáciu.
   */
  const handleUpdateUserStatus = async (userId, approvedStatus, userEmail) => {
    if (!db) {
      setMessage("Chyba: Firestore nie je inicializovaný.");
      setMessageType('error');
      return;
    }

    try {
      const userDocRef = doc(db, 'users', userId);
      await updateDoc(userDocRef, {
        approved: approvedStatus,
      });

      console.log(`Používateľ ${userId} úspešne aktualizovaný na stav schválený: ${approvedStatus}.`);
      setMessage(`Používateľ úspešne ${approvedStatus ? 'schválený' : 'zamietnutý'}.`);
      setMessageType('success');

      // Odoslanie notifikácie na Apps Script po úspešnej aktualizácii
      await sendAdminApprovalEmail(userEmail, approvedStatus ? 'schválený' : 'zamietnutý');

    } catch (e) {
      console.error("Chyba pri aktualizácii stavu používateľa:", e);
      setMessage('Chyba pri aktualizácii stavu používateľa.');
      setMessageType('error');
    }
  };


  /**
   * Odstráni používateľa zo systému.
   * @param {string} userId - ID používateľa vo Firestore.
   * @param {string} userEmail - E-mailová adresa používateľa.
   */
  const handleDeleteUser = async (userId, userEmail) => {
    if (!db) {
      setMessage("Chyba: Firestore nie je inicializovaný.");
      setMessageType('error');
      return;
    }

    try {
      // Potvrdzovacie okno s vlastným UI
      const confirmed = window.confirm(`Naozaj chcete odstrániť používateľa s e-mailom ${userEmail}?`);
      if (!confirmed) {
        return;
      }

      await deleteDoc(doc(db, 'users', userId));

      setMessage(`Používateľ ${userEmail} bol úspešne odstránený.`);
      setMessageType('success');
    } catch (e) {
      console.error("Chyba pri odstraňovaní používateľa:", e);
      setMessage(`Chyba pri odstraňovaní používateľa: ${e.message}.`);
      setMessageType('error');
    }
  };

  if (loading) {
    return React.createElement(
      'div', {
        className: 'flex justify-center pt-16'
      },
      React.createElement('div', {
        className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500'
      })
    );
  }

  // Ak nie je admin, zobrazíme chybovú správu
  if (!isCurrentUserAdmin) {
    return React.createElement(
      'div', {
        className: 'flex justify-center items-center h-screen bg-gray-100 p-4'
      },
      React.createElement(
        'div', {
          className: 'text-center p-8 bg-white rounded-lg shadow-md'
        },
        React.createElement('h1', {
          className: 'text-2xl font-bold text-gray-800'
        }, 'Prístup odmietnutý'),
        React.createElement('p', {
          className: 'mt-4 text-gray-600'
        }, 'Nemáte oprávnenie na zobrazenie tejto stránky. Len administrátori majú prístup k správe používateľov.')
      )
    );
  }

  // Komponent pre správu používateľov
  return React.createElement(
    'div', {
      className: 'bg-gray-100 min-h-screen py-8 font-inter'
    },
    React.createElement(NotificationModal, {
      message: message,
      onClose: () => setMessage(''),
      type: messageType
    }),
    React.createElement(
      'div', {
        className: 'container mx-auto px-4'
      },
      React.createElement('h1', {
        className: 'text-3xl font-bold text-gray-800 text-center mb-8'
      }, 'Správa používateľov'),

      React.createElement(
        'div', {
          className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
        },
        users.map(user =>
          React.createElement(
            'div', {
              key: user.id,
              className: `bg-white p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 transform hover:-translate-y-1 ${user.role === 'admin' ? 'border-2 border-blue-500' : user.approved ? 'border-2 border-green-500' : 'border-2 border-yellow-500'}`
            },
            React.createElement('h2', {
              className: 'text-xl font-semibold text-gray-800 break-words'
            }, user.displayName || user.email),
            React.createElement('p', {
              className: 'text-sm text-gray-500 break-words'
            }, user.email),
            React.createElement('p', {
              className: 'mt-2 text-sm text-gray-600'
            }, React.createElement('strong', null, 'Rola: '), user.role),
            React.createElement('p', {
              className: `text-sm font-semibold mt-1 ${user.approved ? 'text-green-500' : 'text-yellow-500'}`
            }, user.approved ? 'Stav: Schválený' : 'Stav: Čaká na schválenie'),
            React.createElement('p', {
              className: 'text-xs text-gray-400 mt-2 break-all'
            }, `ID: ${user.id}`),

            // Tlačidlá pre akcie
            React.createElement(
              'div', {
                className: 'mt-4 flex flex-col md:flex-row gap-2'
              },
              !user.approved && user.role !== 'admin' &&
              React.createElement(
                'button', {
                  onClick: () => handleUpdateUserStatus(user.id, true, user.email),
                  className: 'bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors'
                },
                'Schváliť'
              ),
              user.role !== 'admin' &&
              React.createElement(
                'button', {
                  onClick: () => handleDeleteUser(user.id, user.email),
                  className: 'bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors'
                },
                'Odstrániť'
              )
            )
          )
        )
      )
    )
  );
}

// Exportovanie komponentu, aby bol dostupný pre iné moduly
window.UsersManagementApp = UsersManagementApp;
