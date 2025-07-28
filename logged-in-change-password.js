const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec";

// Pomocná funkcia na formátovanie objektu Date do lokálneho reťazca 'YYYY-MM-DDTHH:mm'
const formatToDatetimeLocal = (date) => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// Komponent NotificationModal pre zobrazovanie dočasných správ
function NotificationModal({ message, onClose }) {
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

  return React.createElement(
    'div',
    {
      className: `fixed top-0 left-0 right-0 z-50 flex justify-center p-4 transition-transform duration-500 ease-out ${
        show ? 'translate-y-0' : '-translate-y-full'
      }`,
      style: { pointerEvents: 'none' }
    },
    React.createElement(
      'div',
      {
        className: 'bg-[#3A8D41] text-white px-6 py-3 rounded-lg shadow-lg max-w-md w-full text-center',
        style: { pointerEvents: 'auto' }
      },
      React.createElement('p', { className: 'font-semibold' }, message)
    )
  );
}

// Komponent PasswordInput pre polia hesla s prepínaním viditeľnosti
// Akceptuje 'validationStatus' ako objekt pre detailnú vizuálnu indikáciu platnosti hesla
function PasswordInput({ id, label, value, onChange, placeholder, autoComplete, showPassword, toggleShowPassword, onCopy, onPaste, onCut, disabled, validationStatus }) {
  // SVG ikony pre oko (zobraziť heslo) a preškrtnuté oko (skryť heslo) - ZJEDNOTENÉ S ADMIN-REGISTER.JS
  const EyeIcon = React.createElement(
    'svg',
    { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' }),
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' })
  );

  const EyeOffIcon = React.createElement(
    'svg',
    { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
    React.createElement('path', { fill: 'currentColor', stroke: 'none', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' }),
    React.createElement('path', { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' }),
    React.createElement('line', { x1: '21', y1: '3', x2: '3', y2: '21', stroke: 'currentColor', strokeWidth: '2' })
  );

  // Okraj inputu bude vždy predvolený (border-gray-300)
  const borderClass = 'border-gray-300';

  return React.createElement(
    'div',
    { className: 'mb-4' }, // Pridaná trieda mb-4 pre konzistentné medzery
    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: id }, label),
    React.createElement(
      'div',
      { className: 'relative' },
      React.createElement('input', {
        type: showPassword ? 'text' : 'password',
        id: id,
        // Používame len predvolenú triedu okraja
        className: `shadow appearance-none border ${borderClass} rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10`,
        value: value,
        onChange: onChange,
        onCopy: onCopy,
        onPaste: onPaste,
        onCut: onCut,
        required: true,
        placeholder: placeholder,
        autoComplete: autoComplete,
        disabled: disabled,
      }),
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: toggleShowPassword,
          className: 'absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 focus:outline-none',
          disabled: disabled,
        },
        showPassword ? EyeIcon : EyeOffIcon
      )
    ),
    // ZMENA: Podmienka pre zobrazenie popisu hesla - zobrazí sa len ak je validationStatus definovaný
    validationStatus && React.createElement(
      'div',
      { className: `text-xs italic mt-1 text-gray-600` }, // Text "Heslo musí obsahovať" je vždy sivý
      'Heslo musí obsahovať:',
      React.createElement(
        'ul',
        { className: 'list-none pl-4' }, // Používame list-none a vlastné odrážky pre dynamiku
        React.createElement(
          'li',
          { className: `flex items-center ${validationStatus.minLength ? 'text-green-600' : 'text-gray-600'}` },
          React.createElement('span', { className: 'mr-2' }, validationStatus.minLength ? '✔' : '•'),
          'aspoň 10 znakov,'
        ),
        React.createElement(
          'li',
          { className: `flex items-center ${validationStatus.hasUpperCase ? 'text-green-600' : 'text-gray-600'}` },
          React.createElement('span', { className: 'mr-2' }, validationStatus.hasUpperCase ? '✔' : '•'),
          'aspoň jedno veľké písmeno,'
        ),
        React.createElement(
          'li',
          { className: `flex items-center ${validationStatus.hasLowerCase ? 'text-green-600' : 'text-gray-600'}` },
          React.createElement('span', { className: 'mr-2' }, validationStatus.hasLowerCase ? '✔' : '•'),
          'aspoň jedno malé písmeno,'
        ),
        React.createElement(
          'li',
          { className: `flex items-center ${validationStatus.hasNumber ? 'text-green-600' : 'text-gray-600'}` },
          React.createElement('span', { className: 'mr-2' }, validationStatus.hasNumber ? '✔' : '•'),
          'aspoň jednu číslicu.'
        )
      )
    )
  );
}

// Hlavný React komponent pre stránku logged-in-change-password.html
function ChangePasswordApp() {
  const [app, setApp] = React.useState(null);
  const [auth, setAuth] = React.useState(null);
  const [db, setDb] = React.useState(null);
  const [user, setUser] = React.useState(undefined); // Objekt Firebase User z onAuthStateChanged
  const [userProfileData, setUserProfileData] = React.useState(null); 
  const [isAuthReady, setIsAuthReady] = React.useState(false); // Nový stav pre pripravenosť autentifikácie
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [userNotificationMessage, setUserNotificationMessage] = React.useState('');

  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmNewPassword, setConfirmNewPassword] = React.useState('');

  // Stavy pre viditeľnosť hesla
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = React.useState(false);

  // Stav pre výsledky validácie nového hesla (ako v admin-register.js)
  const [passwordValidationStatus, setPasswordValidationStatus] = React.useState({
    minLength: false,
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
    isValid: false, // Celková platnosť hesla
  });
  const [isConfirmPasswordMatching, setIsConfirmPasswordMatching] = React.useState(false);


  // Efekt pre inicializáciu Firebase a nastavenie poslucháča autentifikácie (spustí sa len raz)
  React.useEffect(() => {
    let unsubscribeAuth;
    let firestoreInstance;

    try {
      if (typeof firebase === 'undefined') {
        console.error("ChangePasswordApp: Firebase SDK nie je načítané.");
        setError("Firebase SDK nie je načítané. Skontrolujte logged-in-change-password.html.");
        setLoading(false);
        return;
      }

      // Získanie predvolenej Firebase aplikácie
      // POZNÁMKA: Pre správne fungovanie musí byť predvolená Firebase aplikácia
      // inicializovaná v logged-in-change-password.html (napr. firebase.initializeApp(firebaseConfig);)
      // PREDTÝM, ako sa načíta tento skript.
      const firebaseApp = firebase.app();
      setApp(firebaseApp);

      const authInstance = firebase.auth(firebaseApp);
      setAuth(authInstance);
      firestoreInstance = firebase.firestore(firebaseApp);
      setDb(firestoreInstance);

      // Funkcia pre počiatočné prihlásenie (ak existuje custom token)
      const signIn = async () => {
        try {
          // initialAuthToken je globálna premenná definovaná v HTML
          if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await authInstance.signInWithCustomToken(__initial_auth_token);
            console.log("ChangePasswordApp: Počiatočné prihlásenie s custom tokenom úspešné.");
          } else {
            console.log("ChangePasswordApp: Žiadny initialAuthToken na počiatočné prihlásenie.");
          }
        } catch (e) {
          console.error("ChangePasswordApp: Chyba pri počiatočnom prihlásení Firebase (s custom tokenom):", e);
          setError(`Chyba pri prihlásení: ${e.message}`);
        }
      };

      unsubscribeAuth = authInstance.onAuthStateChanged(async (currentUser) => {
        console.log("ChangePasswordApp: onAuthStateChanged - Používateľ:", currentUser ? currentUser.uid : "null");
        setUser(currentUser); // Nastaví Firebase User objekt
        setIsAuthReady(true); // Označí autentifikáciu ako pripravenú po prvej kontrole
      });

      signIn(); // Spustí počiatočné prihlásenie

      return () => {
        if (unsubscribeAuth) {
          unsubscribeAuth();
        }
      };
    } catch (e) {
      console.error("ChangePasswordApp: Nepodarilo sa inicializovať Firebase:", e);
      setError(`Chyba pri inicializácii Firebase: ${e.message}`);
      setLoading(false);
    }
  }, []); // Prázdne pole závislostí - spustí sa len raz pri načítaní komponentu

  // Efekt pre načítanie údajov používateľského profilu z Firestore po inicializácii autentifikácie a DB
  React.useEffect(() => {
    let unsubscribeUserDoc;

    // Spustí sa len ak je autentifikácia pripravená, DB je k dispozícii a používateľ je definovaný (nie undefined)
    if (isAuthReady && db && user !== undefined) {
      if (user === null) { // Ak je používateľ null (nie je prihlásený), presmeruj
        console.log("ChangePasswordApp: Auth je ready a používateľ je null, presmerovávam na login.html");
        window.location.href = 'login.html';
        return;
      }

      // Ak je používateľ prihlásený, pokús sa načítať jeho dáta z Firestore
      if (user) {
        console.log(`ChangePasswordApp: Pokúšam sa načítať používateľský dokument pre UID: ${user.uid}`);
        setLoading(true); // Nastavíme loading na true tu

        try {
          const userDocRef = db.collection('users').doc(user.uid);
          unsubscribeUserDoc = userDocRef.onSnapshot(docSnapshot => {
            console.log("ChangePasswordApp: onSnapshot pre používateľský dokument spustený.");
            if (docSnapshot.exists) {
              const userData = docSnapshot.data();
              console.log("ChangePasswordApp: Používateľský dokument existuje, dáta:", userData);

              // --- OKAMŽITÉ ODHLÁSENIE, AK passwordLastChanged NIE JE PLATNÝ TIMESTAMP ---
              // Toto je pridaná logika, ktorá sa spustí hneď po načítaní dát.
              // Ak je passwordLastChanged neplatný alebo chýba, odhlásiť.
              if (!userData.passwordLastChanged || typeof userData.passwordLastChanged.toDate !== 'function') {
                  console.error("ChangePasswordApp: passwordLastChanged NIE JE platný Timestamp objekt! Typ:", typeof userData.passwordLastChanged, "Hodnota:", userData.passwordLastChanged);
                  console.log("ChangePasswordApp: Okamžite odhlasujem používateľa kvôli neplatnému timestampu zmeny hesla.");
                  auth.signOut(); // Používame auth z React stavu
                  window.location.href = 'login.html';
                  localStorage.removeItem(`passwordLastChanged_${user.uid}`); // Vyčistíme localStorage
                  setUser(null); // Explicitne nastaviť user na null
                  setUserProfileData(null); // Explicitne nastaviť userProfileData na null
                  return; // Zastaviť ďalšie spracovanie
              }

              // Normálne spracovanie, ak je passwordLastChanged platný
              const firestorePasswordChangedTime = userData.passwordLastChanged.toDate().getTime();
              const localStorageKey = `passwordLastChanged_${user.uid}`;
              let storedPasswordChangedTime = parseInt(localStorage.getItem(localStorageKey) || '0', 10);

              console.log(`ChangePasswordApp: Firestore passwordLastChanged (konvertované): ${firestorePasswordChangedTime}, Uložené: ${storedPasswordChangedTime}`);

              if (storedPasswordChangedTime === 0 && firestorePasswordChangedTime !== 0) {
                  // Prvé načítanie pre tohto používateľa/prehliadač, inicializuj localStorage a NEODHLASUJ
                  localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
                  console.log("ChangePasswordApp: Inicializujem passwordLastChanged v localStorage (prvé načítanie).");
                  // Nepokračujeme tu, pokračujeme s normálnym spracovaním dát pre prvé načítanie
              } else if (firestorePasswordChangedTime > storedPasswordChangedTime) {
                  // Heslo bolo zmenené na inom zariadení/relácii
                  console.log("ChangePasswordApp: Detekovaná zmena hesla na inom zariadení/relácii. Odhlasujem používateľa.");
                  auth.signOut(); // Používame auth z React stavu
                  window.location.href = 'login.html';
                  localStorage.removeItem(localStorageKey); // Vyčistiť localStorage po odhlásení
                  setUser(null); // Explicitne nastaviť user na null
                  setUserProfileData(null); // Explicitne nastaviť userProfileData na null
                  return;
              } else if (firestorePasswordChangedTime < storedPasswordChangedTime) {
                  // Toto by sa ideálne nemalo stať, ak je Firestore zdrojom pravdy
                  console.warn("ChangePasswordApp: Detekovaný starší timestamp z Firestore ako uložený. Odhlasujem používateľa (potenciálny nesúlad).");
                  auth.signOut(); // Používame auth z React stavu
                  window.location.href = 'login.html';
                  localStorage.removeItem(localStorageKey);
                  setUser(null); // Explicitne nastaviť user na null
                  setUserProfileData(null); // Explicitne nastaviť userProfileData na null
                  return;
              } else {
                  // Časy sú rovnaké, zabezpečte, aby bol localStorage aktuálny
                  localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
                  console.log("ChangePasswordApp: Timestampy sú rovnaké, aktualizujem localStorage.");
              }

              // NOVÁ LOGIKA: Odhlásenie, ak je používateľ admin a nie je schválený
              if (userData.role === 'admin' && userData.approved === false) {
                  console.log("ChangePasswordApp: Používateľ je admin a nie je schválený. Odhlasujem.");
                  auth.signOut();
                  window.location.href = 'login.html';
                  setUser(null); // Explicitne nastaviť user na null
                  setUserProfileData(null); // Explicitne nastaviť userProfileData na null
                  return; // Zastav ďalšie spracovanie
              }

              setUserProfileData(userData); // Aktualizujeme stav userProfileData
              
              setLoading(false); // Zastavíme načítavanie po načítaní používateľských dát
              setError(''); // Vymazať chyby po úspešnom načítaní

              // Aktualizácia viditeľnosti menu po načítaní roly (volanie globálnej funkcie z left-menu.js)
              if (typeof updateMenuItemsVisibility === 'function') { // Používame priame volanie
                  updateMenuItemsVisibility(userData.role);
              } else {
                  console.warn("ChangePasswordApp: Funkcia updateMenuItemsVisibility nie je definovaná.");
              }

              console.log("ChangePasswordApp: Načítanie používateľských dát dokončené, loading: false");
            } else {
              console.warn("ChangePasswordApp: Používateľský dokument sa nenašiel pre UID:", user.uid);
              setError("Chyba: Používateľský profil sa nenašiel alebo nemáte dostatočné oprávnenia. Skúste sa prosím znova prihlásiť.");
              setLoading(false); // Zastaví načítavanie, aby sa zobrazila chyba
              setUser(null); // Explicitne nastaviť user na null
              setUserProfileData(null); // Explicitne nastaviť userProfileData na null
            }
          }, error => {
            console.error("ChangePasswordApp: Chyba pri načítaní používateľských dát z Firestore (onSnapshot error):", error);
            if (error.code === 'permission-denied') {
                setError(`Chyba oprávnení: Nemáte prístup k svojmu profilu. Skúste sa prosím znova prihlásiť alebo kontaktujte podporu.`);
            } else if (error.code === 'unavailable') {
                setError(`Chyba pripojenia: Služba Firestore je nedostupná. Skúste to prosím neskôr.`);
            } else if (error.code === 'unauthenticated') {
                 setError(`Chyba autentifikácie: Nie ste prihlásený. Skúste sa prosím znova prihlásiť.`);
                 if (auth) {
                    auth.signOut();
                    window.location.href = 'login.html';
                    setUser(null); // Explicitne nastaviť user na null
                    setUserProfileData(null); // Explicitne nastaviť userProfileData na null
                 }
            } else {
                setError(`Chyba pri načítaní používateľských dát: ${error.message}`);
            }
            setLoading(false); // Zastaví načítavanie aj pri chybe
            console.log("ChangePasswordApp: Načítanie používateľských dát zlyhalo, loading: false");
            setUser(null); // Explicitne nastaviť user na null
            setUserProfileData(null); // Explicitne nastaviť userProfileData na null
          });
        } catch (e) {
          console.error("ChangePasswordApp: Chyba pri nastavovaní onSnapshot pre používateľské dáta (try-catch):", e);
          setError(`Chyba pri nastavovaní poslucháča pre používateľské dáta: ${e.message}`);
          setLoading(false); // Zastaví načítavanie aj pri chybe
          setUser(null); // Explicitne nastaviť user na null
          setUserProfileData(null); // Explicitne nastaviť userProfileData na null
        }
      }
    } else if (isAuthReady && user === undefined) {
        console.log("ChangePasswordApp: Auth ready, user undefined. Setting loading to false.");
        setLoading(false);
    }

    return () => {
      // Zrušíme odber onSnapshot pri unmount
      if (unsubscribeUserDoc) {
        console.log("ChangePasswordApp: Ruším odber onSnapshot pre používateľský dokument.");
        unsubscribeUserDoc();
      }
    };
  }, [isAuthReady, db, user, auth]); // Závisí od isAuthReady, db, user a auth

  // Efekt pre aktualizáciu viditeľnosti odkazov v hlavičke
  React.useEffect(() => {
    console.log(`ChangePasswordApp: useEffect pre aktualizáciu odkazov v hlavičke. Používateľ: ${user ? user.uid : 'null'}`);
    // Volanie globálnej funkcie z header.js na aktualizáciu odkazov v hlavičke
    // Používame priame volanie, ako v logged-in-change-name.js
    if (typeof updateHeaderLinks === 'function') { 
        // updateHeaderLinks očakáva currentUser a isRegistrationOpenStatus
        // isRegistrationOpenStatus je interne riadený v header.js, takže môžeme poslať null alebo false
        updateHeaderLinks(user, null); 
    } else {
        console.warn("ChangePasswordApp: Funkcia updateHeaderLinks nie je definovaná v header.js.");
        // Fallback pre manuálnu aktualizáciu, ak funkcia nie je dostupná
        const authLink = document.getElementById('auth-link');
        const profileLink = document.getElementById('profile-link');
        const logoutButton = document.getElementById('logout-button');
        const registerLink = document.getElementById('register-link');

        if (authLink) {
            if (user) {
                authLink.classList.add('hidden');
                profileLink && profileLink.classList.remove('hidden');
                logoutButton && logoutButton.classList.remove('hidden');
                registerLink && registerLink.classList.add('hidden');
            } else {
                authLink.classList.remove('hidden');
                profileLink && profileLink.classList.add('hidden');
                logoutButton && logoutButton.classList.add('hidden');
                registerLink && registerLink.classList.remove('hidden');
            }
        }
    }
  }, [user]); // Závisí od objektu používateľa

  // Spracovanie odhlásenia (potrebné pre tlačidlo odhlásenia v hlavičke)
  const handleLogout = React.useCallback(async () => {
    if (!auth) return;
    try {
      setLoading(true);
      await auth.signOut();
      setUserNotificationMessage("Úspešne odhlásený.");
      window.location.href = 'login.html';
      setUser(null); // Explicitne nastaviť user na null
      setUserProfileData(null); // Explicitne nastaviť userProfileData na null
    } catch (e) {
      console.error("ChangePasswordApp: Chyba pri odhlásení:", e);
      setError(`Chyba pri odhlásení: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [auth]);

  // Pripojenie obsluhy odhlásenia k tlačidlu v hlavičke (cez event listener, nie priamo onClick)
  React.useEffect(() => {
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
      logoutButton.addEventListener('click', handleLogout);
    }
    return () => {
      if (logoutButton) {
        logoutButton.removeEventListener('click', handleLogout);
      }
    };
  }, [handleLogout]);

  // Funkcia pre validáciu hesla (teraz presne zhodná s admin-register.js)
  const validatePassword = (pwd) => {
    const status = {
      minLength: pwd.length >= 10,
      hasUpperCase: /[A-Z]/.test(pwd),
      hasLowerCase: /[a-z]/.test(pwd),
      hasNumber: /[0-9]/.test(pwd),
    };
    // Celková platnosť hesla
    status.isValid = status.minLength && status.hasUpperCase && status.hasLowerCase && status.hasNumber;
    return status;
  };

  // Effect pre validáciu hesla pri zmene 'newPassword' alebo 'confirmNewPassword'
  React.useEffect(() => {
    const pwdStatus = validatePassword(newPassword);
    setPasswordValidationStatus(pwdStatus);

    // isConfirmPasswordMatching závisí aj od celkovej platnosti nového hesla
    setIsConfirmPasswordMatching(newPassword === confirmNewPassword && newPassword.length > 0 && pwdStatus.isValid);
  }, [newPassword, confirmNewPassword]);


  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!auth || !user || !db) { // Pridaná kontrola pre db
      setError("Autentifikácia, používateľ alebo databáza nie je k dispozícii. Skúste sa znova prihlásiť.");
      return;
    }
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setError("Prosím, vyplňte všetky polia.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("Nové heslá sa nezhodujú. Prosím, skontrolujte ich.");
      return;
    }

    // Používame celkový stav platnosti z passwordValidationStatus
    if (!passwordValidationStatus.isValid) {
      setError("Nové heslo nespĺňa všetky požiadavky. Skontrolujte prosím zoznam pod heslom.");
      return;
    }

    setLoading(true);
    setError('');
    setUserNotificationMessage('');

    try {
      // Znova overiť používateľa pred zmenou hesla z bezpečnostných dôvodov
      const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
      await user.reauthenticateWithCredential(credential);
      console.log("ChangePasswordApp: Používateľ úspešne znovu overený.");

      // Aktualizovať heslo
      await user.updatePassword(newPassword);
      console.log("ChangePasswordApp: Heslo úspešne zmenené.");

      // DÔLEŽITÉ: Aktualizácia timestampu vo Firestore
      const userDocRef = db.collection('users').doc(user.uid);
      await userDocRef.update({
        passwordLastChanged: firebase.firestore.FieldValue.serverTimestamp()
      });
      console.log("ChangePasswordApp: Timestamp zmeny hesla aktualizovaný vo Firestore.");

      // Aktualizujeme aj localStorage, aby sa aktuálna relácia okamžite odhlásila
      // (aj keď by to mal zachytiť Firestore listener v header.js)
      localStorage.setItem(`passwordLastChanged_${user.uid}`, new Date().getTime().toString());


      setUserNotificationMessage("Heslo bolo úspešne zmenené. Pre vašu bezpečnosť vás odhlasujeme. Prosím, prihláste sa s novým heslom.");
      
      // Vyčistiť polia hesla
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');

      // Odhlásiť používateľa po zmene hesla z bezpečnostných dôvodov
      await auth.signOut();
      console.log("ChangePasswordApp: Používateľ odhlásený po zmene hesla.");
      
      setTimeout(() => {
        window.location.href = 'login.html'; // Presmerovanie po odhlásení
      }, 3000);

    } catch (e) {
      console.error("ChangePasswordApp: Chyba pri zmene hesla:", e);
      if (e.code === 'auth/wrong-password') {
        setError("Zadané aktuálne heslo je nesprávne.");
      } else if (e.code === 'auth/weak-password') {
        // Použijeme validatePassword pre detailnejšiu správu o slabom hesle
        const validationResults = validatePassword(newPassword);
        const errors = [];
        if (!validationResults.minLength) errors.push("aspoň 10 znakov");
        if (!validationResults.hasLowerCase) errors.push("aspoň jedno malé písmeno");
        if (!validationResults.hasUpperCase) errors.push("aspoň jedno veľké písmeno");
        if (!validationResults.hasNumber) errors.push("aspoň jednu číslicu");
        
        setError("Nové heslo je príliš slabé. Heslo musí obsahovať:\n• " + errors.join("\n• ") + ".");
      } else if (e.code === 'auth/requires-recent-login') {
        setError("Táto akcia vyžaduje nedávne prihlásenie. Prosím, odhláste sa a znova sa prihláste a skúste to znova.");
      } else {
        setError(`Chyba pri zmene hesla: ${e.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Zobrazenie stavu načítavania
  if (!isAuthReady || user === undefined || (user && !userProfileData) || loading) {
    if (isAuthReady && user === null) {
        console.log("ChangePasswordApp: Auth je ready a používateľ je null, presmerovávam na login.html");
        window.location.href = 'login.html';
        return null;
    }
    let loadingMessage = 'Načítavam...';
    if (isAuthReady && user && !userProfileData) {
        loadingMessage = 'Načítavam...';
    } else if (loading) {
        loadingMessage = 'Načítavam...';
    }

    return React.createElement(
      'div',
      { className: 'flex items-center justify-center min-h-screen bg-gray-100' },
      React.createElement('div', { className: 'text-xl font-semibold text-gray-700' }, loadingMessage)
    );
  }

  // Dynamické triedy pre tlačidlo na základe stavu disabled
  const buttonClasses = `
    font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200
    ${loading || currentPassword.length === 0 || !passwordValidationStatus.isValid || !isConfirmPasswordMatching
      ? 'bg-white text-blue-500 border border-blue-500 cursor-not-allowed' // Zakázaný stav
      : 'bg-blue-500 hover:bg-blue-700 text-white' // Aktívny stav
    }
  `;

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
    React.createElement(NotificationModal, {
        message: userNotificationMessage,
        onClose: () => setUserNotificationMessage('')
    }),
    React.createElement(
      'div',
      { className: 'w-full max-w-md mt-20 mb-10 p-4' },
      error && React.createElement(
        'div',
        { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap', role: 'alert' },
        error
      ),
      React.createElement(
        'div',
        { className: 'bg-white p-8 rounded-lg shadow-xl w-full' },
        React.createElement('h1', { className: 'text-3xl font-bold text-center text-gray-800 mb-6' },
          'Zmeniť heslo'
        ),
        React.createElement(
          'form',
          { onSubmit: handleChangePassword, className: 'space-y-4' },
          React.createElement(PasswordInput, {
            id: 'current-password',
            label: 'Aktuálne heslo',
            value: currentPassword,
            onChange: (e) => setCurrentPassword(e.target.value),
            onCopy: (e) => e.preventDefault(),
            onPaste: (e) => e.preventDefault(),
            onCut: (e) => e.preventDefault(),
            placeholder: "Zadajte aktuálne heslo",
            autoComplete: "current-password",
            showPassword: showCurrentPassword,
            toggleShowPassword: () => setShowCurrentPassword(!showCurrentPassword),
            disabled: loading,
          }),
          React.createElement(PasswordInput, {
            id: 'new-password',
            label: 'Nové heslo',
            value: newPassword,
            onChange: (e) => {
                const value = e.target.value;
                setNewPassword(value);
                // Okamžitá aktualizácia validácie
                setPasswordValidationStatus(validatePassword(value)); 
            },
            onCopy: (e) => e.preventDefault(),
            onPaste: (e) => e.preventDefault(),
            onCut: (e) => e.preventDefault(),
            placeholder: "Zadajte nové heslo (min. 10 znakov)",
            autoComplete: "new-password",
            showPassword: showNewPassword,
            toggleShowPassword: () => setShowNewPassword(!showNewPassword),
            disabled: loading,
            validationStatus: passwordValidationStatus // Odovzdanie detailného stavu validácie hesla
          }),
          React.createElement(PasswordInput, {
            id: 'confirm-new-password',
            label: 'Potvrďte nové heslo',
            value: confirmNewPassword,
            onChange: (e) => setConfirmNewPassword(e.target.value),
            onCopy: (e) => e.preventDefault(),
            onPaste: (e) => e.preventDefault(),
            onCut: (e) => e.preventDefault(),
            placeholder: "Potvrďte nové heslo",
            autoComplete: "new-password",
            showPassword: showConfirmNewPassword,
            toggleShowPassword: () => setShowConfirmNewPassword(!showConfirmNewPassword),
            disabled: loading,
          }),
          React.createElement(
            'button',
            {
              type: 'submit',
              className: buttonClasses, // Použitie dynamických tried
              disabled: loading || currentPassword.length === 0 || !passwordValidationStatus.isValid || !isConfirmPasswordMatching,
            },
            loading ? (
              React.createElement(
                'div',
                { className: 'flex items-center justify-center' },
                React.createElement('svg', { className: 'animate-spin -ml-1 mr-3 h-5 w-5 text-white', xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24' },
                  React.createElement('circle', { className: 'opacity-25', cx: '12', cy: '12', r: '10', stroke: 'currentColor', strokeWidth: '4' }),
                  React.createElement('path', { className: 'opacity-75', fill: 'currentColor', d: 'M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z' })
                ),
                'Ukladám...'
              )
            ) : 'Zmeniť heslo'
          )
        )
      )
    )
  );
}
