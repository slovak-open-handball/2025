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
  increment,
  setDoc,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// NotificationModal Component
function NotificationModal({ message, onClose, type = "info" }) {
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

  if (!show) {
    return null;
  }

  const colorClasses = {
    success: "bg-green-500",
    error: "bg-red-500",
    info: "bg-blue-500",
  };
  const bgColor = colorClasses[type] || colorClasses.info;

  return React.createElement(
    "div",
    {
      className: `fixed top-4 right-4 z-50 transform transition-transform duration-500 ease-in-out ${
        show ? "translate-y-0" : "-translate-y-20"
      }`,
    },
    React.createElement(
      "div",
      { className: `shadow-lg rounded-lg max-w-sm w-full pointer-events-auto overflow-hidden` },
      React.createElement(
        "div",
        { className: `p-4 text-white ${bgColor}` },
        React.createElement(
          "div",
          { className: "flex items-center" },
          React.createElement("div", { className: "text-sm font-medium flex-1 pr-4" }, message),
          React.createElement(
            "button",
            {
              onClick: () => setShow(false),
              className: "ml-auto -mx-1.5 -my-1.5 bg-transparent text-white rounded-lg p-1.5 inline-flex h-8 w-8",
            },
            React.createElement(
              "svg",
              {
                className: "h-5 w-5",
                fill: "currentColor",
                viewBox: "0 0 20 20",
                xmlns: "http://www.w3.org/2000/svg",
              },
              React.createElement("path", {
                fillRule: "evenodd",
                d: "M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z",
                clipRule: "evenodd",
              })
            )
          )
        )
      )
    )
  );
}

// UserRow Component
function UserRow({ user, onEdit, onSave, onCancel, editedUser }) {
  const isEditing = editedUser && editedUser.uid === user.uid;

  return React.createElement(
    "tr",
    { className: "border-b transition duration-300 ease-in-out hover:bg-neutral-100" },
    React.createElement("td", { className: "whitespace-nowrap px-6 py-4 font-medium" }, user.uid),
    React.createElement("td", { className: "whitespace-nowrap px-6 py-4" }, user.lastLogin || "N/A"),
    React.createElement(
      "td",
      { className: "whitespace-nowrap px-6 py-4" },
      isEditing
        ? React.createElement(
            "input",
            {
              type: "text",
              value: editedUser.role,
              onChange: (e) => onEdit({ ...editedUser, role: e.target.value }),
              className: "rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50",
            }
          )
        : user.role
    ),
    React.createElement(
      "td",
      { className: "whitespace-nowrap px-6 py-4" },
      isEditing
        ? React.createElement(
            "textarea",
            {
              value: editedUser.notes || "",
              onChange: (e) => onEdit({ ...editedUser, notes: e.target.value }),
              className: "rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50",
            }
          )
        : user.notes
    ),
    React.createElement(
      "td",
      { className: "whitespace-nowrap px-6 py-4 text-center" },
      isEditing
        ? React.createElement(
            React.Fragment,
            null,
            React.createElement(
              "button",
              {
                onClick: () => onSave(editedUser),
                className: "bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-full transition-all duration-300 transform hover:scale-105",
              },
              "Uložiť"
            ),
            React.createElement(
              "button",
              {
                onClick: onCancel,
                className: "ml-2 bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-full transition-all duration-300 transform hover:scale-105",
              },
              "Zrušiť"
            )
          )
        : React.createElement(
            "button",
            {
              onClick: () => onEdit(user),
              className: "bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full transition-all duration-300 transform hover:scale-105",
            },
            "Upraviť"
          )
    )
  );
}

// UsersManagementApp Component
function UsersManagementApp() {
  const [users, setUsers] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [firebaseData, setFirebaseData] = React.useState(null);
  const [editedUser, setEditedUser] = React.useState(null);
  const [notification, setNotification] = React.useState({ message: '', type: 'info' });

  // Initialize Firebase and set up auth listener
  React.useEffect(() => {
    try {
      // Use global variables
      const firebaseConfig = JSON.parse(window.__firebase_config);
      const app = initializeApp(firebaseConfig);
      const db = getFirestore(app);
      const auth = getAuth(app);

      // Handle authentication with custom token or anonymously
      const handleAuth = async () => {
        try {
          if (window.__initial_auth_token) {
            await signInWithCustomToken(auth, window.__initial_auth_token);
          } else {
            await signInAnonymously(auth);
          }
        } catch (error) {
          console.error("Firebase Auth Error:", error);
          setNotification({
            message: `Chyba pri autentifikácii: ${error.message}`,
            type: "error",
          });
        }
      };

      onAuthStateChanged(auth, (user) => {
        if (user) {
          setFirebaseData({ db, auth, userId: user.uid });
        } else {
          // If not signed in, sign in again (e.g. after a sign out)
          handleAuth();
        }
      });
      // Initial authentication check
      handleAuth();
    } catch (error) {
      console.error("Firebase initialization error:", error);
      setNotification({
        message: `Chyba pri inicializácii Firebase: ${error.message}`,
        type: "error",
      });
    }
  }, []);

  // Set up Firestore listener after Firebase is initialized
  React.useEffect(() => {
    if (!firebaseData) return;

    const { db, userId, auth } = firebaseData;
    const userRef = collection(db, `artifacts/${window.__app_id}/users`);
    const q = query(userRef);

    setLoading(true);

    // Use onSnapshot for real-time updates
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const usersList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setUsers(usersList);
        setLoading(false);
        console.log("Dáta používateľov aktualizované v reálnom čase.");
      },
      (error) => {
        console.error("Chyba pri získavaní dát:", error);
        setNotification({
          message: `Chyba pri načítaní dát: ${error.message}`,
          type: "error",
        });
        setLoading(false);
      }
    );

    // Clean up the listener on unmount
    return () => unsubscribe();
  }, [firebaseData]);

  // Handler for setting a user to be edited
  const handleEdit = (user) => {
    setEditedUser(user);
  };

  // Handler for saving changes (updated to use updateDoc)
  const handleSave = async (userToSave) => {
    if (!firebaseData) {
      setNotification({
        message: "Aplikácia ešte nie je inicializovaná.",
        type: "error",
      });
      return;
    }

    const { db } = firebaseData;
    const docRef = doc(
      db,
      `artifacts/${window.__app_id}/users`,
      userToSave.id
    );

    try {
      await updateDoc(docRef, {
        role: userToSave.role,
        notes: userToSave.notes,
      });
      setNotification({
        message: "Zmeny úspešne uložené.",
        type: "success",
      });
      setEditedUser(null); // Clear edited user after saving
    } catch (e) {
      console.error("Chyba pri aktualizácii dokumentu:", e);
      setNotification({
        message: `Chyba pri ukladaní zmien: ${e.message}`,
        type: "error",
      });
    }
  };

  // Handler for cancelling edit mode
  const handleCancel = () => {
    setEditedUser(null);
  };

  return React.createElement(
    "div",
    { className: "bg-gray-100 min-h-screen py-8 font-sans" },
    React.createElement(
      NotificationModal,
      {
        message: notification.message,
        onClose: () => setNotification({ message: "", type: "info" }),
        type: notification.type,
      }
    ),
    React.createElement(
      "div",
      { className: "container mx-auto px-4" },
      React.createElement(
        "div",
        { className: "bg-white shadow-xl rounded-2xl overflow-hidden p-6 lg:p-10" },
        React.createElement(
          "h1",
          { className: "text-3xl lg:text-4xl font-extrabold text-gray-800 mb-2 text-center" },
          "Správa používateľov"
        ),
        React.createElement(
          "p",
          { className: "text-center text-gray-500 mb-8" },
          "Tu môžete upraviť roly a poznámky pre každého používateľa."
        ),
        React.createElement(
          "div",
          { className: "overflow-x-auto rounded-lg shadow-md border border-gray-200" },
          React.createElement(
            "table",
            { className: "min-w-full table-auto" },
            React.createElement(
              "thead",
              { className: "bg-gray-800 text-white" },
              React.createElement(
                "tr",
                null,
                React.createElement(
                  "th",
                  {
                    scope: "col",
                    className: "px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider rounded-tl-lg",
                  },
                  "Používateľ (UID)"
                ),
                React.createElement(
                  "th",
                  {
                    scope: "col",
                    className: "px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider",
                  },
                  "Posledné prihlásenie"
                ),
                React.createElement(
                  "th",
                  {
                    scope: "col",
                    className: "px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider",
                  },
                  "Rola"
                ),
                React.createElement(
                  "th",
                  {
                    scope: "col",
                    className: "px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider",
                  },
                  "Poznámky"
                ),
                React.createElement(
                  "th",
                  {
                    scope: "col",
                    className: "px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider rounded-tr-lg",
                  },
                  "Akcie"
                )
              )
            ),
            React.createElement(
              "tbody",
              { className: "divide-y divide-gray-200 bg-white" },
              loading
                ? React.createElement(
                    "tr",
                    null,
                    React.createElement(
                      "td",
                      { colSpan: "5", className: "text-center py-8 text-gray-500" },
                      "Načítavanie dát..."
                    )
                  )
                : users.length === 0
                  ? React.createElement(
                      "tr",
                      null,
                      React.createElement(
                        "td",
                        { colSpan: "5", className: "text-center py-8 text-gray-500" },
                        "Žiadni používatelia na zobrazenie."
                      )
                    )
                  : users.map((user) =>
                      React.createElement(UserRow, {
                        key: user.id,
                        user: user,
                        onEdit: handleEdit,
                        onSave: handleSave,
                        onCancel: handleCancel,
                        editedUser: editedUser,
                      })
                    )
            )
          )
        )
      )
    )
  );
}

// Wait for global data to be ready before rendering the app
const initializeAndRenderApp = () => {
  const rootElement = document.getElementById("users-management-root");

  if (!rootElement) {
    console.error("users-management-root element not found.");
    return;
  }

  // Check if global data is available, if not, wait
  if (!window.isGlobalAuthReady || !window.globalUserProfileData) {
    console.log(
      "logged-in-users.js: Čakám na inicializáciu autentifikácie a načítanie dát používateľa..."
    );
    return;
  }

  window.removeEventListener("globalDataUpdated", initializeAndRenderApp);

  if (typeof React === "undefined" || typeof ReactDOM === "undefined") {
    console.error(
      "Chyba: React alebo ReactDOM nie sú načítané. Skontrolujte poradie skriptov."
    );
    if (rootElement) {
      rootElement.innerHTML =
        '<div style="color: red; text-align: center; padding: 20px;">Chyba pri načítaní aplikácie. Skúste to prosím neskôr.</div>';
    }
    return;
  }

  const root = ReactDOM.createRoot(rootElement);
  root.render(React.createElement(UsersManagementApp, null));
  console.log("logged-in-users.js: React App (UsersManagementApp) vykreslená.");
};

// Vykreslíme loader a zaregistrujeme poslucháča udalostí
const rootElement = document.getElementById("users-management-root");
if (rootElement) {
  rootElement.innerHTML = `
        <div class="flex justify-center pt-16">
            <div class="animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500"></div>
        </div>
    `;
}
window.addEventListener("globalDataUpdated", initializeAndRenderApp);

// Pre prípad, že udalosť už prebehla pred zaregistrovaním poslucháča
if (window.isGlobalAuthReady && window.globalUserProfileData) {
  initializeAndRenderApp();
}
