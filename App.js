// Odstránené všetky importy, pretože Firebase SDKs, React a ReactDOM sa načítavajú globálne z CDN
// import React, { useState, useEffect } from 'react';
// import { initializeApp, getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider, getFirestore } from 'firebase/app';
// Všetky funkcie sa teraz pristupujú cez globálny objekt 'firebase'

// Global variables provided by the Canvas environment (používame ich priamo)
// Ak toto spúšťate priamo na GitHub Pages, tieto premenné nebudú definované.
// Pre funkčnosť ich preto definujeme pevne.
const appId = 'default-app-id'; // Toto je len zástupná hodnota, pre Canvas by sa použila __app_id
const firebaseConfig = {
  apiKey: "AIzaSyB_hlvVpnG-9VAr-VGXiT8J7DuPXx8k-eA",
  authDomain: "prihlasovanie-a3f5f.firebaseapp.com",
  projectId: "prihlasovanie-a3f5f",
  storageBucket: "prihlasovanie-a3f5f.firebasestorage.app",
  messagingSenderId: "181851240506",
  appId: "1:181851240506:web:768e27fb15b805ee7b9d03",
  measurementId: "G-C3XPTT7F4D"
};
const initialAuthToken = null; // Toto je len zástupná hodnota, pre Canvas by sa použila __initial_auth_token

// Dummy domain for internal email construction
const DUMMY_DOMAIN = "@slovakhandball.com";

// Definujeme App ako globálnu funkciu, nie ako export
function App() {
  // Používame React.useState a React.useEffect namiesto importovaných
  const [app, setApp] = React.useState(null);
  const [auth, setAuth] = React.useState(null);
  const [db, setDb] = React.useState(null);
  const [user, setUser] = React.useState(null);
  const [isAuthReady, setIsAuthReady] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');

  // Form states
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [newUsername, setNewUsername] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [currentPassword, setCurrentPassword] = React.useState(''); // For reauthentication

  // State to manage which view is active
  const [view, setView] = React.useState('login'); // 'login', 'register', 'profile'

  React.useEffect(() => {
    try {
      // Uistite sa, že 'firebase' je definované globálne z CDN skriptov
      if (typeof firebase === 'undefined') {
        setError("Firebase SDK nie je načítané. Skontrolujte index.html.");
        setLoading(false);
        return;
      }

      const firebaseApp = firebase.initializeApp(firebaseConfig);
      setApp(firebaseApp);

      const authInstance = firebase.auth(firebaseApp);
      setAuth(authInstance);
      setDb(firebase.firestore(firebaseApp)); // Ak by ste chceli používať Firestore

      const signIn = async () => {
        try {
          if (initialAuthToken) {
            await authInstance.signInWithCustomToken(initialAuthToken);
          } else {
            await authInstance.signInAnonymously();
          }
        } catch (e) {
          console.error("Firebase initial sign-in failed:", e);
          setError(`Chyba pri prihlasovaní: ${e.message}`);
        } finally {
          setLoading(false);
        }
      };

      const unsubscribe = authInstance.onAuthStateChanged((currentUser) => {
        setUser(currentUser);
        setIsAuthReady(true);
        if (loading) setLoading(false);
      });

      signIn();

      return () => unsubscribe();
    } catch (e) {
      console.error("Failed to initialize Firebase:", e);
      setError(`Chyba pri inicializácii Firebase: ${e.message}`);
      setLoading(false);
    }
  }, []);

  const clearMessages = () => {
    setTimeout(() => {
      setMessage('');
      setError('');
    }, 5000);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!auth) {
      setError("Firebase Auth nie je inicializovaný.");
      return;
    }
    if (!username || !password) {
      setError("Prosím, vyplňte používateľské meno a heslo.");
      return;
    }
    // Zmena minimálnej dĺžky hesla na 5 znakov
    if (password.length < 5) {
      setError("Heslo je príliš slabé. Musí mať aspoň 5 znakov.");
      return;
    }

    const email = username + DUMMY_DOMAIN;

    try {
      setLoading(true);
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      await userCredential.user.updateProfile({ displayName: username });
      setMessage("Registrácia úspešná! Prihlásený ako " + username);
      setError('');
      setUsername('');
      setPassword('');
      setView('profile');
    } catch (e) {
      console.error("Chyba pri registrácii:", e);
      if (e.code === 'auth/email-already-in-use') {
        setError("Používateľské meno už existuje. Prosím, zvoľte iné.");
      } else if (e.code === 'auth/weak-password') {
        setError("Heslo je príliš slabé. Musí mať aspoň 5 znakov."); // Upravená správa
      } else {
        setError(`Chyba pri registrácii: ${e.message}`);
      }
    } finally {
      setLoading(false);
      clearMessages();
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!auth) {
      setError("Firebase Auth nie je inicializovaný.");
      return;
    }
    if (!username || !password) {
      setError("Prosím, vyplňte používateľské meno a heslo.");
      return;
    }

    const email = username + DUMMY_DOMAIN;

    try {
      setLoading(true);
      await auth.signInWithEmailAndPassword(email, password);
      setMessage("Prihlásenie úspešné!");
      setError('');
      setUsername('');
      setPassword('');
      setView('profile');
    } catch (e) {
      console.error("Chyba pri prihlasovaní:", e);
      if (e.code === 'auth/invalid-credential') {
        setError("Nesprávne používateľské meno alebo heslo.");
      } else {
        setError(`Chyba pri prihlasovaní: ${e.message}`);
      }
    } finally {
      setLoading(false);
      clearMessages();
    }
  };

  const handleLogout = async () => {
    if (!auth) return;
    try {
      setLoading(true);
      await auth.signOut();
      setMessage("Úspešne odhlásené.");
      setError('');
      setView('login');
    } catch (e) {
      console.error("Chyba pri odhlasovaní:", e);
      setError(`Chyba pri odhlasovaní: ${e.message}`);
    } finally {
      setLoading(false);
      clearMessages();
    }
  };

  const handleChangeUsername = async (e) => {
    e.preventDefault();
    if (!user) {
      setError("Nie ste prihlásený.");
      return;
    }
    if (!newUsername) {
      setError("Prosím, zadajte nové používateľské meno.");
      return;
    }

    try {
      setLoading(true);
      if (user.email && currentPassword) {
        // Používame firebase.auth.EmailAuthProvider namiesto importovaného
        const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
        await user.reauthenticateWithCredential(credential);
      } else {
        setError("Pre zmenu používateľského mena je potrebné zadať aktuálne heslo pre overenie.");
        setLoading(false);
        return;
      }

      await user.updateProfile({ displayName: newUsername });
      setMessage("Používateľské meno úspešne zmenené na " + newUsername);
      setError('');
      setNewUsername('');
      setCurrentPassword('');
    } catch (e) {
      console.error("Chyba pri zmene používateľského mena:", e);
      if (e.code === 'auth/requires-recent-login') {
        setError("Pre túto akciu sa musíte znova prihlásiť. Prosím, odhláste sa a znova prihláste.");
      } else if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        setError("Nesprávne aktuálne heslo. Prosím, zadajte správne heslo pre overenie.");
      } else {
        setError(`Chyba pri zmene používateľského mena: ${e.message}`);
      }
    } finally {
      setLoading(false);
      clearMessages();
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!user) {
      setError("Nie ste prihlásený.");
      return;
    }
    if (!newPassword || !currentPassword) {
      setError("Prosím, zadajte nové heslo a aktuálne heslo.");
      return;
    }
    // Zmena minimálnej dĺžky hesla na 5 znakov
    if (newPassword.length < 5) {
      setError("Nové heslo musí mať aspoň 5 znakov.");
      return;
    }

    try {
      setLoading(true);
      const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
      await user.reauthenticateWithCredential(credential);

      await user.updatePassword(newPassword);
      setMessage("Heslo úspešne zmenené!");
      setError('');
      setNewPassword('');
      setCurrentPassword('');
    } catch (e) {
      console.error("Chyba pri zmene hesla:", e);
      if (e.code === 'auth/requires-recent-login') {
        setError("Pre túto akciu sa musíte znova prihlásiť. Prosím, odhláste sa a znova prihláste.");
      } else if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        setError("Nesprávne aktuálne heslo. Prosím, zadajte správne heslo pre overenie.");
      } else {
        setError(`Chyba pri zmene hesla: ${e.message}`);
      }
    } finally {
      setLoading(false);
      clearMessages();
    }
  };

  if (loading || !isAuthReady) {
    return (
      React.createElement("div", { className: "flex items-center justify-center min-h-screen bg-gray-100" },
        React.createElement("div", { className: "text-xl font-semibold text-gray-700" }, "Načítava sa...")
      )
    );
  }

  return (
    React.createElement("div", { className: "min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 font-inter" },
      React.createElement("div", { className: "bg-white p-8 rounded-lg shadow-xl w-full max-w-md" },
        React.createElement("h1", { className: "text-3xl font-bold text-center text-gray-800 mb-6" },
          user ? `Vitajte, ${user.displayName || 'Používateľ'}!` : "Prihlásenie / Registrácia"
        ),

        message && (
          React.createElement("div", { className: "bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4", role: "alert" },
            message
          )
        ),
        error && (
          React.createElement("div", { className: "bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4", role: "alert" },
            error
          )
        ),

        !user ? (
          React.createElement(React.Fragment, null,
            React.createElement("div", { className: "flex justify-center mb-6" },
              React.createElement("button", {
                onClick: () => setView('login'),
                className: `px-6 py-2 rounded-l-lg font-semibold transition-colors duration-200 ${
                  view === 'login' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`
              }, "Prihlásenie"),
              React.createElement("button", {
                onClick: () => setView('register'),
                className: `px-6 py-2 rounded-r-lg font-semibold transition-colors duration-200 ${
                  view === 'register' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`
              }, "Registrácia")
            ),

            view === 'login' && (
              React.createElement("form", { onSubmit: handleLogin, className: "space-y-4" },
                React.createElement("div", null,
                  React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "username" }, "Používateľské meno"),
                  React.createElement("input", {
                    type: "text",
                    id: "username",
                    className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500",
                    value: username,
                    onChange: (e) => setUsername(e.target.value),
                    required: true,
                    placeholder: "Zadajte používateľské meno"
                  })
                ),
                React.createElement("div", null,
                  React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "password" }, "Heslo"),
                  React.createElement("input", {
                    type: "password",
                    id: "password",
                    className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500",
                    value: password,
                    onChange: (e) => setPassword(e.target.value),
                    required: true,
                    placeholder: "Zadajte heslo"
                  })
                ),
                React.createElement("button", {
                  type: "submit",
                  className: "bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200",
                  disabled: loading
                }, loading ? 'Prihlasujem...' : 'Prihlásiť sa')
              )
            ),

            view === 'register' && (
              React.createElement("form", { onSubmit: handleRegister, className: "space-y-4" },
                React.createElement("div", null,
                  React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "reg-username" }, "Používateľské meno"),
                  React.createElement("input", {
                    type: "text",
                    id: "reg-username",
                    className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500",
                    value: username,
                    onChange: (e) => setUsername(e.target.value),
                    required: true,
                    placeholder: "Zvoľte používateľské meno"
                  })
                ),
                React.createElement("div", null,
                  React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "reg-password" }, "Heslo"),
                  React.createElement("input", {
                    type: "password",
                    id: "reg-password",
                    className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500",
                    value: password,
                    onChange: (e) => setPassword(e.target.value),
                    required: true,
                    placeholder: "Zvoľte heslo (min. 5 znakov)" // Upravená správa
                  })
                ),
                React.createElement("button", {
                  type: "submit",
                  className: "bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200",
                  disabled: loading
                }, loading ? 'Registrujem...' : 'Registrovať sa')
              )
            )
          )
        ) : (
          // User is logged in - Profile View
          React.createElement("div", { className: "space-y-6" },
            React.createElement("div", { className: "text-center" },
              React.createElement("p", { className: "text-lg text-gray-700" },
                "Prihlásený ako: ",
                React.createElement("span", { className: "font-semibold" }, user.displayName || 'Neznámy používateľ')
              ),
              React.createElement("p", { className: "text-sm text-gray-500" },
                "(ID: ", user.uid, ")"
              )
            ),

            // Change Username
            React.createElement("form", { onSubmit: handleChangeUsername, className: "space-y-4 border-t pt-4 mt-4" },
              React.createElement("h2", { className: "text-xl font-semibold text-gray-800" }, "Zmeniť používateľské meno"),
              React.createElement("div", null,
                React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "new-username" }, "Nové používateľské meno"),
                React.createElement("input", {
                  type: "text",
                  id: "new-username",
                  className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500",
                  value: newUsername,
                  onChange: (e) => setNewUsername(e.target.value),
                  required: true,
                  placeholder: "Zadajte nové používateľské meno"
                })
              ),
              React.createElement("div", null,
                React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "current-password-username-change" }, "Aktuálne heslo (pre overenie)"),
                React.createElement("input", {
                  type: "password",
                  id: "current-password-username-change",
                  className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500",
                  value: currentPassword,
                  onChange: (e) => setCurrentPassword(e.target.value),
                  required: true,
                  placeholder: "Zadajte svoje aktuálne heslo"
                })
              ),
              React.createElement("button", {
                type: "submit",
                className: "bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200",
                disabled: loading
              }, loading ? 'Ukladám...' : 'Zmeniť používateľské meno')
            ),

            // Change Password
            React.createElement("form", { onSubmit: handleChangePassword, className: "space-y-4 border-t pt-4 mt-4" },
              React.createElement("h2", { className: "text-xl font-semibold text-gray-800" }, "Zmeniť heslo"),
              React.createElement("div", null,
                React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "new-password" }, "Nové heslo"),
                React.createElement("input", {
                  type: "password",
                  id: "new-password",
                  className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500",
                  value: newPassword,
                  onChange: (e) => setNewPassword(e.target.value),
                  required: true,
                  placeholder: "Zadajte nové heslo (min. 5 znakov)" // Upravená správa
                })
              ),
              React.createElement("div", null,
                React.createElement("label", { className: "block text-gray-700 text-sm font-bold mb-2", htmlFor: "current-password-password-change" }, "Aktuálne heslo (pre overenie)"),
                React.createElement("input", {
                  type: "password",
                  id: "current-password-password-change",
                  className: "shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500",
                  value: currentPassword,
                  onChange: (e) => setCurrentPassword(e.target.value),
                  required: true,
                  placeholder: "Zadajte svoje aktuálne heslo"
                })
              ),
              React.createElement("button", {
                type: "submit",
                className: "bg-orange-500 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200",
                disabled: loading
              }, loading ? 'Ukladám...' : 'Zmeniť heslo')
            )
          )
        )
      )
    )
  );
}

// export default App; // Odstránené export, App je teraz globálna
