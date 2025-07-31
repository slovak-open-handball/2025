// authentication.js
// Tento súbor spravuje globálnu autentifikáciu Firebase, načítanie profilových dát používateľa,
// overovanie prístupu a nastavenie globálnych premenných pre celú aplikáciu.

// Globálne premenné, ktoré budú dostupné pre všetky ostatné skripty
window.isGlobalAuthReady = false; // Indikuje, či je Firebase Auth inicializované a prvý stav používateľa skontrolovaný
window.globalUserProfileData = null; // Obsahuje dáta profilu prihláseného používateľa
window.auth = null; // Inštancia Firebase Auth
window.db = null; // Inštancia Firebase Firestore

// Helper funkcia pre autorizáciu prístupu k stránkam
const checkPageAuthorization = (userData, currentPath) => {
    // Definícia prístupových pravidiel pre jednotlivé stránky
    const pageAccessRules = {
      // ZMENA: Odstránené 'index.html' z pravidiel, bude spracované ako verejná stránka
      'logged-in-users.html': { role: 'admin', approved: true },
      'logged-in-tournament-settings.html': { role: 'admin', approved: true },
      'logged-in-add-categories.html': { role: 'admin', approved: true },
      'logged-in-all-registrations.html': { role: 'admin', approved: true },
      'logged-in-my-data.html': { role: ['user', 'admin'], approved: true },
      'logged-in-my-settings.html': { role: ['user', 'admin'], approved: true },
      'logged-in-change-name.html': { role: ['user', 'admin'], approved: true },
      'logged-in-change-email.html': { role: ['user', 'admin'], approved: true },
      'logged-in-change-phone.html': { role: ['user', 'admin'], approved: true },
      'logged-in-change-password.html': { role: ['user', 'admin'], approved: true },
      'logged-in-change-billing-data.html': { role: ['user', 'admin'], approved: true },
    };

    // Získaj pravidlá pre aktuálnu stránku
    const rule = Object.keys(pageAccessRules).find(key => currentPath.includes(key));

    if (!rule) {
      // Ak stránka nie je v pravidlách (napr. index.html, login.html, account.html, register.html, admin-register.html), povoliť prístup
      console.log(`Auth: Stránka ${currentPath} nie je v pravidlách prístupu, povolený prístup.`);
      return true;
    }

    // Ak používateľ nie je prihlásený, ale stránka vyžaduje autentifikáciu, zamietni prístup
    if (!userData) {
        console.log(`Auth: Používateľ nie je prihlásený a stránka ${currentPath} vyžaduje autentifikáciu. Prístup zamietnutý.`);
        return false;
    }

    const requiredRole = pageAccessRules[rule].role;
    const requiredApproved = pageAccessRules[rule].approved;

    // Kontrola roly
    const hasRequiredRole = Array.isArray(requiredRole) 
      ? requiredRole.includes(userData.role) 
      : userData.role === requiredRole;

    // Kontrola schválenia
    const isApproved = userData.approved === true; // Musí byť explicitne true

    // Špeciálne pravidlo pre adminov: ak je rola admin, musí byť aj schválený
    if (userData.role === 'admin' && !isApproved) {
        console.log(`Auth: Admin ${userData.email} nie je schválený. Prístup zamietnutý na ${currentPath}.`);
        return false;
    }

    // Pre ostatné roly: musí mať požadovanú rolu a byť schválený (ak je to vyžadované)
    if (hasRequiredRole && (requiredApproved ? isApproved : true)) {
      console.log(`Auth: Používateľ ${userData.email} (rola: ${userData.role}, schválený: ${userData.approved}) má prístup na ${currentPath}.`);
      return true;
    }

    console.log(`Auth: Používateľ ${userData.email} (rola: ${userData.role}, schválený: ${userData.approved}) nemá prístup na ${currentPath}.`);
    return false;
};

// Hlavný komponent pre globálnu autentifikáciu a správu stavu
function AuthenticationManager() {
  const [user, setUser] = React.useState(undefined); // Firebase User object from onAuthStateChanged
  const [userProfileData, setUserProfileData] = React.useState(null); 
  const [isAuthReady, setIsAuthReady] = React.useState(false); // Lokálny stav pripravenosti autentifikácie

  // Effect pre inicializáciu Firebase a nastavenie Auth Listenera (spustí sa len raz)
  React.useEffect(() => {
    console.log("AuthManager: Spúšťam inicializáciu Firebase...");
    let unsubscribeAuth;

    try {
      if (typeof firebase === 'undefined') {
        console.error("AuthManager: Firebase SDK nie je načítané. Uistite sa, že firebase.js je načítaný pred authentication.js.");
        return;
      }

      let firebaseApp;
      if (firebase.apps.length === 0) {
        console.log("AuthManager: Inicializujem novú Firebase aplikáciu.");
        // firebaseConfig by malo byť definované globálne v HTML pred načítaním tohto skriptu
        firebaseApp = firebase.initializeApp(firebaseConfig); 
      } else {
        firebaseApp = firebase.app();
        console.warn("AuthManager: Firebase App named '[DEFAULT]' už existuje. Používam existujúcu inštanciu.");
      }
      
      window.auth = firebase.auth(firebaseApp); // Nastav globálnu inštanciu auth
      window.db = firebase.firestore(firebaseApp); // Nastav globálnu inštanciu db

      console.log("AuthManager: Firebase inicializované. Nastavujem Auth listener.");

      const signIn = async () => {
        try {
          // initialAuthToken by malo byť definované globálne v HTML pred načítaním tohto skriptu
          if (typeof initialAuthToken !== 'undefined' && initialAuthToken) {
            console.log("AuthManager: Pokúšam sa prihlásiť s custom tokenom.");
            await window.auth.signInWithCustomToken(initialAuthToken);
          } else {
            console.log("AuthManager: initialAuthToken nie je k dispozícii alebo je prázdny. Pokúšam sa prihlásiť anonymne pre verejné stránky.");
            // NOVINKA: Anonymné prihlásenie pre prístup k verejným dátam (napr. pre index.html)
            await window.auth.signInAnonymously();
          }
        } catch (e) {
          console.error("AuthManager: Chyba pri počiatočnom prihlásení Firebase (s custom tokenom alebo anonymne):", e);
        }
      };

      unsubscribeAuth = window.auth.onAuthStateChanged(async (currentUser) => {
        console.log("AuthManager: onAuthStateChanged - Používateľ:", currentUser ? currentUser.uid : "null");
        setUser(currentUser);
        setIsAuthReady(true); // Autentifikácia je pripravená po prvej kontrole
        window.isGlobalAuthReady = true; // Nastav globálny stav
      });

      signIn();

      return () => {
        if (unsubscribeAuth) {
          console.log("AuthManager: Ruším odber onAuthStateChanged.");
          unsubscribeAuth();
        }
      };
    } catch (e) {
      console.error("AuthManager: Nepodarilo sa inicializovať Firebase:", e);
    }
  }, []); // Prázdne pole závislostí zabezpečí, že sa spustí len raz

  // Effect pre načítanie profilových dát používateľa a autorizáciu
  React.useEffect(() => {
    let unsubscribeUserDoc;
    const currentPath = window.location.pathname;
    console.log("AuthManager: Spúšťam useEffect pre načítanie profilu používateľa a autorizáciu. isAuthReady:", isAuthReady, "db:", !!window.db, "user:", !!user, "currentPath:", currentPath);

    // NOVINKA: Ak je stránka index.html, login.html, account.html, register.html alebo admin-register.html, nepokračujeme v kontrole prihlásenia/presmerovaní
    if (currentPath.includes('index.html') || currentPath.includes('login.html') || currentPath.includes('account.html') || currentPath.includes('register.html') || currentPath.includes('admin-register.html')) {
        console.log(`AuthManager: Stránka ${currentPath} je verejná alebo prihlasovacia/registračná. Preskakujem kontrolu prihlásenia/presmerovania.`);
        // Ak je používateľ null (anonymný) a na verejnej stránke, nastavíme userProfileData na null
        if (user === null) {
            setUserProfileData(null);
            window.globalUserProfileData = null;
        }
        // Ak je používateľ prihlásený, ale na verejnej stránke, stále načítame jeho profil
        if (user && window.db && isAuthReady) {
            const userDocRef = window.db.collection('users').doc(user.uid);
            unsubscribeUserDoc = userDocRef.onSnapshot(docSnapshot => {
                if (docSnapshot.exists) {
                    const userData = docSnapshot.data();
                    setUserProfileData(userData);
                    window.globalUserProfileData = userData;
                    console.log("AuthManager: Načítaný profil používateľa na verejnej stránke.");
                } else {
                    console.warn("AuthManager: Profil používateľa sa nenašiel na verejnej stránke pre UID:", user.uid);
                    // Ak sa profil nenájde, ale používateľ je prihlásený, môže to byť problém.
                    // Pre verejné stránky to nie je kritické, ale môžeme ho odhlásiť.
                    // window.auth.signOut();
                    // setUser(null);
                    // setUserProfileData(null);
                    // window.globalUserProfileData = null;
                }
            }, error => {
                console.error("AuthManager: Chyba pri načítaní profilu na verejnej stránke:", error);
                // Pri chybe na verejnej stránke neodhlásime automaticky, len logujeme
            });
        }
        return () => {
            if (unsubscribeUserDoc) {
                unsubscribeUserDoc();
            }
        }; // Zastavíme ďalšie spracovanie
    }

    // Pôvodná logika pre stránky vyžadujúce autentifikáciu
    if (isAuthReady && window.db && user !== undefined) {
      if (user === null) {
        console.log("AuthManager: Používateľ je null (nie je prihlásený), presmerovávam na login.html.");
        window.location.href = 'login.html';
        return;
      }

      if (user) {
        try {
          const userDocRef = window.db.collection('users').doc(user.uid);
          unsubscribeUserDoc = userDocRef.onSnapshot(docSnapshot => {
            console.log("AuthManager: onSnapshot pre používateľský dokument spustený.");
            if (docSnapshot.exists) {
              const userData = docSnapshot.data();
              console.log("AuthManager: Používateľský profil načítaný:", userData);

              // --- OKAMŽITÉ ODHLÁSENIE, AK passwordLastChanged NIE JE PLATNÝ TIMESTAMP ---
              if (!userData.passwordLastChanged || typeof userData.passwordLastChanged.toDate !== 'function') {
                  console.error("AuthManager: passwordLastChanged NIE JE platný Timestamp objekt! Typ:", typeof userData.passwordLastChanged, "Hodnota:", userData.passwordLastChanged);
                  console.log("AuthManager: Okamžite odhlasujem používateľa kvôli neplatnému timestampu zmeny hesla.");
                  window.auth.signOut();
                  window.location.href = 'login.html';
                  localStorage.removeItem(`passwordLastChanged_${user.uid}`);
                  setUser(null); // Explicitne nastaviť user na null
                  setUserProfileData(null); // Explicitne nastaviť userProfileData na null
                  window.globalUserProfileData = null; // Resetuj globálny profil
                  return;
              }

              const firestorePasswordChangedTime = userData.passwordLastChanged.toDate().getTime();
              const localStorageKey = `passwordLastChanged_${user.uid}`;
              let storedPasswordChangedTime = parseInt(localStorage.getItem(localStorageKey) || '0', 10);

              console.log(`AuthManager: Firestore passwordLastChanged (konvertované): ${firestorePasswordChangedTime}, Stored: ${storedPasswordChangedTime}`);

              if (storedPasswordChangedTime === 0 && firestorePasswordChangedTime !== 0) {
                  localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
                  console.log("AuthManager: Inicializujem passwordLastChanged v localStorage (prvé načítanie).");
              } else if (firestorePasswordChangedTime > storedPasswordChangedTime) {
                  console.log("AuthManager: Detekovaná zmena hesla na inom zariadení/relácii. Odhlasujem používateľa.");
                  window.auth.signOut();
                  window.location.href = 'login.html';
                  localStorage.removeItem(localStorageKey);
                  setUser(null); // Explicitne nastaviť user na null
                  setUserProfileData(null); // Explicitne nastaviť userProfileData na null
                  window.globalUserProfileData = null; // Resetuj globálny profil
                  return;
              } else if (firestorePasswordChangedTime < storedPasswordChangedTime) {
                  console.warn("AuthManager: Detekovaný starší timestamp z Firestore ako uložený. Odhlasujem používateľa (potenciálny nesúlad).");
                  window.auth.signOut();
                  window.location.href = 'login.html';
                  localStorage.removeItem(localStorageKey);
                  setUser(null); // Explicitne nastaviť user na null
                  setUserProfileData(null); // Explicitne nastaviť userProfileData na null
                  window.globalUserProfileData = null; // Resetuj globálny profil
                  return;
              } else {
                  localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
              }
              // --- KONIEC LOGIKY ODHLÁSENIA ---

              // NOVÁ LOGIKA: Odhlásenie, ak je používateľ admin a nie je schválený
              if (userData.role === 'admin' && userData.approved === false) {
                  console.log("AuthManager: Používateľ je admin a nie je schválený. Odhlasujem.");
                  window.auth.signOut();
                  window.location.href = 'login.html';
                  setUser(null); // Explicitne nastaviť user na null
                  setUserProfileData(null); // Explicitne nastaviť userProfileData na null
                  window.globalUserProfileData = null; // Resetuj globálny profil
                  return; // Zastav ďalšie spracovanie
              }

              // NOVÁ LOGIKA: Autorizácia pre konkrétnu stránku
              // currentPath už je definovaný na začiatku useEffect
              if (!checkPageAuthorization(userData, currentPath)) {
                  console.log(`AuthManager: Používateľ ${userData.email} nemá oprávnenie pre stránku ${currentPath}. Presmerovávam na login.html.`);
                  window.auth.signOut();
                  window.location.href = 'login.html';
                  setUser(null);
                  setUserProfileData(null);
                  window.globalUserProfileData = null;
                  return;
              }

              setUserProfileData(userData); // Nastav lokálny stav
              window.globalUserProfileData = userData; // Nastav globálny stav
              
            } else {
              console.warn("AuthManager: Používateľský profil sa nenašiel pre UID:", user.uid);
              // Ak sa profil nenájde, ale používateľ je prihlásený, môže to byť problém. Odhlásime ho.
              console.log("AuthManager: Používateľský profil sa nenašiel. Odhlasujem používateľa.");
              window.auth.signOut();
              window.location.href = 'login.html';
              setUser(null);
              setUserProfileData(null);
              window.globalUserProfileData = null;
            }

          }, error => {
            console.error("AuthManager: Chyba pri načítaní používateľských dát z Firestore (onSnapshot error):", error);
            if (error.code === 'permission-denied' || error.code === 'unauthenticated') {
                 console.log("AuthManager: Chyba oprávnení/autentifikácie. Odhlasujem používateľa.");
                 window.auth.signOut();
                 window.location.href = 'login.html';
            } else {
                console.error(`AuthManager: Neznáma chyba pri načítaní používateľských dát: ${error.message}. Odhlasujem.`);
                window.auth.signOut();
                window.location.href = 'login.html';
            }
            setUser(null);
            setUserProfileData(null);
            window.globalUserProfileData = null;
          });
        } catch (e) {
          console.error("AuthManager: Chyba pri nastavovaní onSnapshot pre používateľské dáta (try-catch):", e);
          window.auth.signOut();
          window.location.href = 'login.html';
          setUser(null);
          setUserProfileData(null);
          window.globalUserProfileData = null;
        }
      }
    } else if (isAuthReady && user === null) {
      console.log("AuthManager: Používateľ nie je prihlásený, resetujem globálny profil.");
      setUserProfileData(null);
      window.globalUserProfileData = null;
    }

    return () => {
      if (unsubscribeUserDoc) {
        console.log("AuthManager: Ruším odber onSnapshot pre používateľský dokument.");
        unsubscribeUserDoc();
      }
    };
  }, [isAuthReady, user]); // Závisí od lokálnych stavov user a isAuthReady

  // Tento komponent nič nevykresľuje do DOMu, len spravuje globálny stav
  return null;
}

// Vykreslíme AuthenticationManager do skrytého DOM elementu
// Vytvoríme koreňový element pre React komponent, ak ešte neexistuje
let authRoot = document.getElementById('authentication-root');
if (!authRoot) {
  authRoot = document.createElement('div');
  authRoot.id = 'authentication-root';
  authRoot.style.display = 'none'; // Skryť element
  document.body.appendChild(authRoot);
  console.log("AuthManager: Vytvoril som a pridal 'authentication-root' div do tela dokumentu.");
} else {
  console.log("AuthManager: 'authentication-root' div už existuje.");
}

// Vykreslíme AuthenticationManager do tohto koreňového elementu
try {
  ReactDOM.render(
    React.createElement(AuthenticationManager),
    authRoot
  );
  console.log("AuthManager: AuthenticationManager úspešne vykreslený.");
} catch (e) {
  console.error("AuthManager: Chyba pri vykresľovaní AuthenticationManager:", e);
}
