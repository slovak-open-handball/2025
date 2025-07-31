// logged-in-change-email.js
// Tento súbor obsahuje React komponent pre zmenu e-mailovej adresy prihláseného používateľa.
// Predpokladá, že firebaseConfig, initialAuthToken a appId sú globálne definované v HTML súbore.

// Komponent PasswordInput pre polia hesla s prepínaním viditeľnosti
// Akceptuje 'validationStatus' ako objekt pre detailnú vizuálnu indikáciu platnosti hesla
function PasswordInput({ id, label, value, onChange, placeholder, autoComplete, showPassword, toggleShowPassword, onCopy, onPaste, onCut, disabled, validationStatus, onFocus }) {
  // SVG ikony pre oko (zobraziť heslo) a preškrtnuté oko (skryť heslo)
  const EyeIcon = React.createElement(
    'svg',
    { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' }),
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' })
  );

  const EyeOffIcon = React.createElement(
    'svg',
    { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' }, // SVG element má fill="none"
    // Cesta pre vyplnený stred (pupila)
    React.createElement('path', { fill: 'currentColor', stroke: 'none', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' }),
    // Cesta pre vonkajší obrys oka (bez výplne)
    React.createElement('path', { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' }),
    // Cesta pre šikmú čiaru
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
        onFocus: onFocus // Pridaný onFocus prop
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


// NotificationModal Component for displaying temporary messages (converted to React.createElement)
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

  // Dynamické triedy pre farbu pozadia na základe typu správy
  let bgColorClass;
  if (type === 'success') {
    bgColorClass = 'bg-[#3A8D41]'; // Zelená
  } else if (type === 'error') {
    bgColorClass = 'bg-red-600'; // Červená
  } else {
    bgColorClass = 'bg-blue-500'; // Predvolená modrá pre info
  }

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
        className: `${bgColorClass} text-white px-6 py-3 rounded-lg shadow-lg max-w-md w-full text-center`,
        style: { pointerEvents: 'auto' }
      },
      React.createElement('p', { className: 'font-semibold' }, message)
    )
  );
}

// Funkcia na validáciu emailu
const validateEmail = (email) => {
  const atIndex = email.indexOf('@');
  if (atIndex === -1) return false;

  const domainPart = email.substring(atIndex + 1);
  const dotIndexInDomain = domainPart.indexOf('.');
  if (dotIndexInDomain === -1) return false;
  
  const lastDotIndex = email.lastIndexOf('.');
  if (lastDotIndex === -1 || lastDotIndex < atIndex) return false; 
  
  const charsAfterLastDot = email.substring(lastDotIndex + 1);
  return charsAfterLastDot.length >= 2;
};


// Main React component for the logged-in-change-email.html page
function ChangeEmailApp() {
  // NOVÉ: Získame referencie na Firebase služby priamo
  const app = firebase.app();
  const auth = firebase.auth(app);
  const db = firebase.firestore(app);

  // NOVÉ: Lokálny stav pre aktuálneho používateľa a jeho profilové dáta
  // Tieto stavy budú aktualizované lokálnym onAuthStateChanged a onSnapshot
  const [user, setUser] = React.useState(auth.currentUser); // Inicializovať s aktuálnym používateľom
  const [userProfileData, setUserProfileData] = React.useState(null); 

  const [loading, setLoading] = React.useState(true); // Loading pre dáta v ChangeEmailApp
  const [error, setError] = React.useState('');
  // PONECHANÉ: userNotificationMessage pre lokálne notifikácie
  const [userNotificationMessage, setUserNotificationMessage] = React.useState('');

  // User Data States
  const [currentEmail, setCurrentEmail] = React.useState('');
  const [newEmail, setNewEmail] = React.useState(''); // NOVINKA: Nebude sa predvypĺňať
  const [password, setPassword] = React.useState('');
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false); // Nový stav pre viditeľnosť aktuálneho hesla

  // Validation States
  const [emailTouched, setEmailTouched] = React.useState(false);
  const [emailError, setEmailError] = React.useState('');
  const [passwordError, setPasswordError] = React.useState('');

  // Zabezpečíme, že appId je definované (používame globálnu premennú)
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'; 

  // NOVÉ: Lokálny Auth Listener pre ChangeEmailApp
  // Tento listener zabezpečí, že ChangeEmailApp reaguje na zmeny autentifikácie,
  // ale primárne odhlásenie/presmerovanie spravuje GlobalNotificationHandler.
  React.useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(currentUser => {
      console.log("ChangeEmailApp: Lokálny onAuthStateChanged - Používateľ:", currentUser ? currentUser.uid : "null");
      setUser(currentUser);
      // Ak používateľ nie je prihlásený, presmerujeme ho (aj keď by to mal spraviť GNH)
      if (!currentUser) {
        console.log("ChangeEmailApp: Používateľ nie je prihlásený, presmerovávam na login.html.");
        window.location.href = 'login.html';
      }
    });
    return () => unsubscribeAuth();
  }, [auth]); // Závisí od auth inštancie

  // NOVÉ: Lokálny Effect pre načítanie používateľských dát z Firestore
  // Tento efekt sa spustí, keď je používateľ prihlásený a db je k dispozícii.
  // Predpokladá sa, že passwordLastChanged a approved status sú už overené v header.js.
  React.useEffect(() => {
    let unsubscribeUserDoc;

    if (user && db) { // Spustí sa len ak je používateľ prihlásený a db je k dispozícii
      console.log(`ChangeEmailApp: Pokúšam sa načítať používateľský dokument pre UID: ${user.uid}`);
      setLoading(true); // Nastavíme loading na true, kým sa načítajú dáta profilu

      try {
        const userDocRef = db.collection('users').doc(user.uid);
        unsubscribeUserDoc = userDocRef.onSnapshot(docSnapshot => {
          console.log("ChangeEmailApp: onSnapshot pre používateľský dokument spustený.");
          if (docSnapshot.exists) {
            const userData = docSnapshot.data();
            console.log("ChangeEmailApp: Používateľský dokument existuje, dáta:", userData);

            // --- OKAMŽITÉ ODHLÁSENIE, AK passwordLastChanged NIE JE PLATNÝ TIMESTAMP ---
            // Toto je pridaná logika, ktorá sa spustí hneď po načítaní dát.
            // Ak je passwordLastChanged neplatný alebo chýba, odhlásiť.
            if (!userData.passwordLastChanged || typeof userData.passwordLastChanged.toDate !== 'function') {
                console.error("ChangeEmailApp: passwordLastChanged NIE JE platný Timestamp objekt! Typ:", typeof userData.passwordLastChanged, "Hodnota:", userData.passwordLastChanged);
                console.log("ChangeEmailApp: Okamžite odhlasujem používateľa kvôli neplatnému timestampu zmeny hesla.");
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

            console.log(`ChangeEmailApp: Firestore passwordLastChanged (konvertované): ${firestorePasswordChangedTime}, Uložené: ${storedPasswordChangedTime}`);

            if (storedPasswordChangedTime === 0 && firestorePasswordChangedTime !== 0) {
                // Prvé načítanie pre tohto používateľa/prehliadač, inicializuj localStorage a NEODHLASUJ
                localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
                console.log("ChangeEmailApp: Inicializujem passwordLastChanged v localStorage (prvé načítanie).");
                // Nepokračujeme tu, pokračujeme s normálnym spracovaním dát pre prvé načítanie
            } else if (firestorePasswordChangedTime > storedPasswordChangedTime) {
                // Heslo bolo zmenené na inom zariadení/relácii
                console.log("ChangeEmailApp: Detekovaná zmena hesla na inom zariadení/relácii. Odhlasujem používateľa.");
                auth.signOut(); // Používame auth z React stavu
                window.location.href = 'login.html';
                localStorage.removeItem(localStorageKey); // Vyčistiť localStorage po odhlásení
                setUser(null); // Explicitne nastaviť user na null
                setUserProfileData(null); // Explicitne nastaviť userProfileData na null
                return;
            } else if (firestorePasswordChangedTime < storedPasswordChangedTime) {
                // Toto by sa ideálne nemalo stať, ak je Firestore zdrojom pravdy
                console.warn("ChangeEmailApp: Detekovaný starší timestamp z Firestore ako uložený. Odhlasujem používateľa (potenciálny nesúlad).");
                auth.signOut(); // Používame auth z React stavu
                window.location.href = 'login.html';
                localStorage.removeItem(localStorageKey);
                setUser(null); // Explicitne nastaviť user na null
                setUserProfileData(null); // Explicitne nastaviť userProfileData na null
                return;
            } else {
                // Časy sú rovnaké, zabezpečte, aby bol localStorage aktuálny
                localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
                console.log("ChangeEmailApp: Timestampy sú rovnaké, aktualizujem localStorage.");
            }

            // NOVÁ LOGIKA: Odhlásenie, ak je používateľ admin a nie je schválený
            if (userData.role === 'admin' && userData.approved === false) {
                console.log("ChangeEmailApp: Používateľ je admin a nie je schválený. Odhlasujem.");
                auth.signOut();
                window.location.href = 'login.html';
                setUser(null); // Explicitne nastaviť user na null
                setUserProfileData(null); // Explicitne nastaviť userProfileData na null
                return; // Zastav ďalšie spracovanie
            }

            setUserProfileData(userData); // Aktualizujeme stav userProfileData
            setCurrentEmail(user.email || ''); // Nastaví aktuálny e-mail z Firebase Auth
            
            setLoading(false); // Zastavíme načítavanie po načítaní používateľských dát
            setError(''); // Vymazať chyby po úspešnom načítaní

            // Aktualizácia viditeľnosti menu po načítaní roly (volanie globálnej funkcie z left-menu.js)
            if (typeof window.updateMenuItemsVisibility === 'function') {
                window.updateMenuItemsVisibility(userData.role);
            } else {
                console.warn("ChangeEmailApp: Funkcia updateMenuItemsVisibility nie je definovaná.");
            }

            console.log("ChangeEmailApp: Načítanie používateľských dát dokončené, loading: false");
          } else {
            console.warn("ChangeEmailApp: Používateľský dokument sa nenašiel pre UID:", user.uid);
            setError("Chyba: Používateľský profil sa nenašiel alebo nemáte dostatočné oprávnenia. Skúste sa prosím znova prihlásiť.");
            setLoading(false); // Zastaví načítavanie, aby sa zobrazila chyba
            setUser(null); // Explicitne nastaviť user na null
            setUserProfileData(null); // Explicitne nastaviť userProfileData na null
          }
        }, error => {
          console.error("ChangeEmailApp: Chyba pri načítaní používateľských dát z Firestore (onSnapshot error):", error);
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
          console.log("ChangeEmailApp: Načítanie používateľských dát zlyhalo, loading: false");
          setUser(null); // Explicitne nastaviť user na null
          setUserProfileData(null); // Explicitne nastaviť userProfileData na null
        });
      } catch (e) {
        console.error("ChangeEmailApp: Chyba pri nastavovaní onSnapshot pre používateľské dáta (try-catch):", e);
        setError(`Chyba pri nastavovaní poslucháča pre používateľské dáta: ${e.message}`);
        setLoading(false);
        setUser(null); // Explicitne nastaviť user na null
        setUserProfileData(null); // Explicitne nastaviť userProfileData na null
      }
    } else if (user === null) {
        // Ak je user null (a už nie undefined), znamená to, že bol odhlásený.
        // Presmerovanie už by mal spraviť GlobalNotificationHandler.
        // Tu len zabezpečíme, že loading je false a dáta sú vyčistené.
        setLoading(false);
        setUserProfileData(null);
    }

    return () => {
      if (unsubscribeUserDoc) {
        console.log("ChangeEmailApp: Ruším odber onSnapshot pre používateľský dokument.");
        unsubscribeUserDoc();
      }
    };
  }, [user, db, auth]); // Závisí od user a db (a auth pre signOut)


  // Handle for email input change
  const handleNewEmailChange = (e) => {
    const emailValue = e.target.value;
    setNewEmail(emailValue);
    if (emailTouched && emailValue.trim() !== '' && !validateEmail(emailValue)) {
      setEmailError('Zadajte platnú e-mailovú adresu.');
    } else {
      setEmailError('');
    }
  };

  const handleFocusEmail = () => {
    setEmailTouched(true);
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    setPasswordError(''); // Vyčisti chybu pri zmene hesla
  };

  // Handle form submission for email change
  const handleSubmitEmailChange = async (e) => {
    e.preventDefault();

    if (!auth || !auth.currentUser || !db) {
      setError("Chyba: Používateľ nie je prihlásený alebo databáza nie je dostupná.");
      return;
    }

    if (!validateEmail(newEmail)) {
      setEmailError('Zadajte platnú e-mailovú adresu.');
      return;
    }
    if (newEmail === currentEmail) {
      setEmailError('Nová e-mailová adresa musí byť odlišná od pôvodnej.');
      return;
    }
    if (password.length < 10) { // ZMENA: Zmenené z 6 na 10 znakov
      setPasswordError('Pre zmenu e-mailu zadajte svoje aktuálne heslo (min. 10 znakov).'); // ZMENA: Správa
      return;
    }

    setLoading(true);
    setError('');
    setUserNotificationMessage(''); // Vyčistí notifikáciu pred novým pokusom

    try {
      // Re-autentifikácia používateľa
      const credential = firebase.auth.EmailAuthProvider.credential(auth.currentUser.email, password);
      await auth.currentUser.reauthenticateWithCredential(credential);
      console.log("ChangeEmailApp: Používateľ úspešne re-autentifikovaný.");

      // Zmena e-mailu vo Firebase Authentication
      await auth.currentUser.verifyBeforeUpdateEmail(newEmail);
      console.log("ChangeEmailApp: Overovací e-mail bol odoslaný na novú adresu.");

      // NEAKTUALIZUJEME FIRESTORE HNEĎ! Firestore sa aktualizuje až po overení e-mailu používateľom
      // pomocou synchronizačnej logiky v useEffect, ktorá počúva zmeny v user.email (v logged-in-my-data.js, logged-in-users.js atď.)

      setUserNotificationMessage("Overovací e-mail bol odoslaný na novú e-mailovú adresu. Prosím, skontrolujte si soju e-mailovú schránku (vrátane spamu) a overte novú e-mailovú adresu.");
      // Reset formulára po odoslaní
      setPassword('');

    } catch (e) {
      console.error("ChangeEmailApp: Chyba pri zmene vlastného e-mailu:", e);
      let errorMessage = "Chyba pri zmene e-mailu.";
      if (e.code === 'auth/requires-recent-login') {
        errorMessage = "Pre zmenu e-mailu sa musíte znova prihlásiť. Prosím, odhláste sa a prihláste sa znova.";
      } else if (e.code === 'auth/wrong-password') {
        errorMessage = "Zadané heslo je nesprávne.";
      } else if (e.code === 'auth/invalid-email') {
        errorMessage = "Zadaná e-mailová adresa je neplatná.";
      } else if (e.code === 'auth/email-already-in-use') {
        errorMessage = "Táto e-mailová adresa je už používaná iným účtom.";
      } else {
        errorMessage = `Chyba`;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Check if form is valid for button disabled state
  // ZMENA: Podmienka pre dĺžku hesla z 6 na 10
  const isFormValid = validateEmail(newEmail) && newEmail !== currentEmail && password.length >= 10;

  // Dynamické triedy pre tlačidlo na základe stavu disabled
  const buttonClasses = `
    font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200
    ${loading || !isFormValid
      ? 'bg-white text-blue-500 border border-blue-500 cursor-not-allowed' // Zakázaný stav
      : 'bg-blue-500 hover:bg-blue-700 text-white' // Aktívny stav
    }
  `;

  // Display loading state
  if (!user || (user && !userProfileData) || loading) {
    if (user === null) { 
        console.log("ChangeEmailApp: Používateľ je null, presmerovávam na login.html");
        window.location.href = 'login.html';
        return null;
    }

    let loadingMessage = 'Načítavam...';
    if (user && !userProfileData) {
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

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
    React.createElement(NotificationModal, {
        message: userNotificationMessage,
        onClose: () => setUserNotificationMessage(''),
        type: error ? 'error' : 'success'
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
          'Zmeniť e-mailovú adresu'
        ),
        React.createElement(
            'form',
            { onSubmit: handleSubmitEmailChange, className: 'space-y-4' },
            React.createElement(
              'div',
              null,
              React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'current-email-display' }, 'Aktuálna e-mailová adresa'),
              React.createElement('input', {
                type: 'email',
                id: 'current-email-display',
                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-gray-100 cursor-not-allowed',
                value: currentEmail,
                disabled: true, // Trvalo zablokovaný
                readOnly: true, // Zabezpečí, že sa nedá meniť
                style: { cursor: 'not-allowed' } // Zmena kurzora
              })
            ),
            React.createElement(
              'div',
              null,
              React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'new-email' }, 'Nová e-mailová adresa'),
              React.createElement('input', {
                type: 'email',
                id: 'new-email',
                className: `shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 ${emailError ? 'border-red-500' : ''}`,
                value: newEmail,
                onChange: handleNewEmailChange,
                onFocus: handleFocusEmail,
                required: true,
                placeholder: 'Zadajte novú e-mailovú adresu',
                disabled: loading,
              }),
              emailError && React.createElement(
                'p',
                { className: 'text-red-500 text-xs italic mt-1' },
                emailError
              )
            ),
            // ZMENA: Použitie komponentu PasswordInput pre aktuálne heslo
            React.createElement(PasswordInput, {
              id: 'current-password',
              label: 'Aktuálne heslo',
              value: password,
              onChange: handlePasswordChange,
              required: true,
              placeholder: 'Zadajte svoje aktuálne heslo',
              disabled: loading,
              showPassword: showCurrentPassword, // Ovládanie viditeľnosti
              toggleShowPassword: () => setShowCurrentPassword(!showCurrentPassword), // Funkcia pre prepínanie
            }),
            passwordError && React.createElement(
              'p',
              { className: 'text-red-500 text-xs italic mt-1' },
              passwordError
            ),
            React.createElement(
              'button',
              {
                type: 'submit',
                className: buttonClasses,
                disabled: loading || !isFormValid,
              },
              loading ? 'Ukladám...' : 'Uložiť zmeny'
            )
          )
        )
      )
    );
}

// Explicitne sprístupniť komponent globálne
window.ChangeEmailApp = ChangeEmailApp;
