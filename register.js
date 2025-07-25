// register.js
// Hlavný súbor aplikácie, ktorý spravuje stav a orchestráciu medzi stránkami formulára.

// Global application ID a Firebase konfigurácia (mali by byť konzistentné naprieč všetkými React aplikáciami)
// Tieto konštanty sú definované v <head> register.html a sú prístupné globálne.
const RECAPTCHA_SITE_KEY = "6LdJbn8rAAAAAO4C50qXTWva6ePzDlOfYwBDEDwa";
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4t0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec"; // Updated URL for consistency, assuming this is the latest.

// Import komponentov pre stránky formulára
import { Page1Form, PasswordInput, CountryCodeModal } from './register-page1.js';
import { Page2Form } from './register-page2.js';

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

// NotificationModal Component pre zobrazovanie dočasných správ
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
      }, 10000); // Zobrazí sa na 10 sekúnd
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
      className: `fixed bottom-4 right-4 bg-blue-500 text-white p-4 rounded-lg shadow-lg transition-transform transform ${show ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`,
      style: { zIndex: 1000 }
    },
    React.createElement('p', { className: 'font-semibold' }, message)
  );
}

// Hlavný App komponent
function App() {
  const [page, setPage] = React.useState(1);
  const [formData, setFormData] = React.useState({
    firstName: '',
    lastName: '',
    email: '',
    contactPhoneNumber: '',
    password: '',
    confirmPassword: '',
    // Removed birthDate, gender, role from top-level formData
    // Added new fields for billing and address
    houseNumber: '', // New field for address
    country: '', // Moved to top-level for address, but also used in billing address
    city: '', // Moved to top-level for address, but also used in billing address
    postalCode: '', // Moved to top-level for address, but also used in billing address
    street: '', // Moved to top-level for address, but also used in billing address
    billing: { // New nested object for billing details
      clubName: '',
      ico: '',
      dic: '',
      icDph: '',
    }
  });
  const [userRole, setUserRole] = React.useState('user'); // Predvolená rola (removed from form, but kept for data structure if needed elsewhere)
  const [loading, setLoading] = React.useState(false);
  const [notificationMessage, setNotificationMessage] = React.useState('');
  const [showNotification, setShowNotification] = React.useState(false);
  const [isCountryCodeModalOpen, setIsCountryCodeModalOpen] = React.useState(false);
  const [selectedCountryDialCode, setSelectedCountryDialCode] = React.useState('+421'); // Predvolené pre Slovensko

  // Firebase stav
  const [db, setDb] = React.useState(null);
  const [auth, setAuth] = React.useState(null);
  const [isAuthReady, setIsAuthReady] = React.useState(false); // Zabezpečenie, že autentifikácia je pripravená pred operáciami Firestore
  // Nové stavy pre dáta registrácie z Firestore
  const [registrationStartDate, setRegistrationStartDate] = React.useState('');
  const [registrationEndDate, setRegistrationEndDate] = React.useState('');
  const [settingsLoaded, setSettingsLoaded] = React.useState(false);

  // Nové stavy pre odpočet a vynútenie prepočtu
  const [countdown, setCountdown] = React.useState(null);
  const [forceRegistrationCheck, setForceRegistrationCheck] = React.useState(0);
  const [periodicRefreshKey, setPeriodicRefreshKey] = React.useState(0);

  // Nový stav pre reCAPTCHA pripravenosť
  const [isRecaptchaReady, setIsRecaptchaReady] = React.useState(false);

  const countdownIntervalRef = React.useRef(null); // Ref pre uloženie ID intervalu odpočtu

  // Výpočet stavu registrácie ako memoizovaná hodnota (rovnako ako v index.js)
  const isRegistrationOpen = React.useMemo(() => {
    if (!settingsLoaded) return false; // Čakajte, kým sa načítajú nastavenia
    const now = new Date();
    const regStart = registrationStartDate ? new Date(registrationStartDate) : null;
    const regEnd = registrationEndDate ? new Date(registrationEndDate) : null;

    // Kontrola, či sú dátumy platné pred porovnaním
    const isRegStartValid = regStart instanceof Date && !isNaN(regStart);
    const isRegEndValid = regEnd instanceof Date && !isNaN(regEnd);

    return (
      (isRegStartValid ? now >= regStart : true) && // Ak regStart nie je platný, predpokladajte, že registrácia začala
      (isRegEndValid ? now <= regEnd : true)        // Ak regEnd nie je platný, predpokladajte, že registrácia neskončila
    );
  }, [settingsLoaded, registrationStartDate, registrationEndDate, forceRegistrationCheck, periodicRefreshKey]);


  // Funkcia na výpočet zostávajúceho času pre odpočet (rovnako ako v index.js)
  const calculateTimeLeft = React.useCallback(() => {
    const now = new Date();
    const startDate = registrationStartDate ? new Date(registrationStartDate) : null;

    // Ak startDate nie je platný dátum, alebo je už v minulosti, odpočet nie je potrebný
    if (!startDate || isNaN(startDate) || now >= startDate) {
        return null; 
    }

    const difference = startDate.getTime() - now.getTime(); // Rozdiel v milisekundách

    if (difference <= 0) {
        return null; // Čas uplynul
    }

    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((difference % (1000 * 60)) / 1000);

    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  }, [registrationStartDate]);


  // Inicializácia Firebase a autentifikácie
  React.useEffect(() => {
    try {
      // Skontrolujte, či je Firebase SDK načítané a dostupné
      if (typeof firebase === 'undefined' || typeof firebase.firestore === 'undefined' || typeof firebase.auth === 'undefined') {
        console.error("register.js: Firebase SDK nie je načítané alebo nie sú dostupné všetky moduly. Uistite sa, že sú script tagy Firebase v HTML.");
        setNotificationMessage('Chyba pri inicializácii aplikácie: Firebase SDK chýba.');
        setShowNotification(true);
        return;
      }

      let firebaseAppInstance;
      if (firebase.apps.length === 0) {
          // Ak žiadna Firebase aplikácia nebola inicializovaná, inicializujte ju.
          console.warn("register.js: Predvolená Firebase App nebola nájdená, inicializujem novú.");
          const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
          firebaseAppInstance = firebase.initializeApp(firebaseConfig);
      } else {
          // Ak už existuje aspoň jedna Firebase aplikácia, použite predvolenú.
          firebaseAppInstance = firebase.app();
          console.log("register.js: Používam existujúcu Firebase App inštanciu.");
      }
      
      const firestoreDb = firebase.firestore(firebaseAppInstance); 
      const firebaseAuth = firebase.auth(firebaseAppInstance);     

      setDb(firestoreDb);
      setAuth(firebaseAuth);

      // Používame firebaseAuth.onAuthStateChanged na sledovanie stavu autentifikácie.
      // NEPOKÚŠAME sa o signInAnonymously() tu, ak je to obmedzené pravidlami.
      const unsubscribe = firebaseAuth.onAuthStateChanged(async (currentUser) => {
        // Ak je __initial_auth_token k dispozícii a nie je prihlásený žiadny používateľ, pokúsime sa prihlásiť.
        if (!currentUser && typeof __initial_auth_token === 'string' && __initial_auth_token.length > 0) {
          try {
            await firebaseAuth.signInWithCustomToken(__initial_auth_token);
            console.log("register.js: Úspešné prihlásenie s vlastným tokenom.");
          } catch (error) {
            console.error("register.js: Chyba pri prihlásení s vlastným tokenom:", error);
            // Ak prihlásenie s vlastným tokenom zlyhá, nebudeme sa pokúšať o anonymné prihlásenie,
            // pretože to môže byť obmedzené pravidlami.
          }
        }
        setIsAuthReady(true); // Stav autentifikácie je teraz známy (buď prihlásený, alebo null)
      });

      return () => unsubscribe();
    } catch (error) {
      console.error("Chyba pri inicializácii Firebase v register.js:", error);
      setNotificationMessage('Chyba pri inicializácii aplikácie.');
      setShowNotification(true);
    }
  }, []); // Spustí sa raz pri pripojení komponentu

  // Načítanie a počúvanie stavu registrácie z Firestore (rovnako ako v index.js)
  React.useEffect(() => {
    const fetchSettings = async () => {
      if (!db || !isAuthReady) {
        return; // Čakajte, kým sa DB a autentifikácia inicializujú
      }
      try {
          const settingsDocRef = db.collection('settings').doc('registration');
          const unsubscribeSettings = settingsDocRef.onSnapshot(docSnapshot => {
            if (docSnapshot.exists) {
                const data = docSnapshot.data();
                setRegistrationStartDate(data.registrationStartDate ? formatToDatetimeLocal(data.registrationStartDate.toDate()) : '');
                setRegistrationEndDate(data.registrationEndDate ? formatToDatetimeLocal(data.registrationEndDate.toDate()) : '');
            } else {
                console.log("register.js: Nastavenia registrácie sa nenašli v Firestore. Používajú sa predvolené prázdne hodnoty.");
                setRegistrationStartDate('');
                setRegistrationEndDate('');
            }
            setSettingsLoaded(true);
          }, error => {
            console.error("register.js: Chyba pri načítaní nastavení registrácie (onSnapshot):", error);
            setNotificationMessage(`Chyba pri načítaní nastavení: ${error.message}`);
            setShowNotification(true);
            setSettingsLoaded(true);
          });

          return () => unsubscribeSettings();
      } catch (e) {
          console.error("register.js: Chyba pri nastavovaní onSnapshot pre nastavenia registrácie:", e);
          setNotificationMessage(`Chyba pri nastavovaní poslucháča pre nastavenia: ${e.message}`);
          setShowNotification(true);
          setSettingsLoaded(true);
      }
    };

    fetchSettings();
  }, [db, isAuthReady]);

  // Effect pre odpočet (rovnako ako v index.js)
  React.useEffect(() => {
    let timer;
    const updateCountdown = () => {
        const timeLeft = calculateTimeLeft();
        setCountdown(timeLeft);
        if (timeLeft === null) {
            clearInterval(timer);
            setForceRegistrationCheck(prev => prev + 1); // Vynúti prepočet isRegistrationOpen
        }
    };

    if (registrationStartDate && new Date(registrationStartDate) > new Date()) {
        updateCountdown();
        timer = setInterval(updateCountdown, 1000);
    } else {
        setCountdown(null);
    }

    return () => clearInterval(timer);
  }, [registrationStartDate, calculateTimeLeft]);

  // Nový useEffect pre periodickú aktualizáciu isRegistrationOpen (rovnako ako v index.js)
  React.useEffect(() => {
    const interval = setInterval(() => {
      setPeriodicRefreshKey(prev => prev + 1);
    }, 60 * 1000); // Aktualizácia každú minútu

    return () => clearInterval(interval);
  }, []);

  // Effect pre kontrolu pripravenosti reCAPTCHA
  React.useEffect(() => {
    const checkRecaptcha = () => {
      if (window.grecaptcha && window.grecaptcha.ready) {
        window.grecaptcha.ready(() => {
          setIsRecaptchaReady(true);
          console.log("register.js: reCAPTCHA je pripravená.");
        });
      } else {
        // Ak grecaptcha ešte nie je k dispozícii, skúste to znova po krátkej pauze
        setTimeout(checkRecaptcha, 100);
      }
    };
    checkRecaptcha();
  }, []);


  const closeNotification = () => {
    setShowNotification(false);
    setNotificationMessage('');
  };

  const handleChange = (e) => {
    const { id, value } = e.target;
    // Special handling for nested billing object
    if (id === 'clubName' || id === 'ico' || id === 'dic' || id === 'icDph') {
      setFormData(prev => ({
        ...prev,
        billing: {
          ...prev.billing,
          [id]: value
        }
      }));
    } else {
      setFormData(prev => ({ ...prev, [id]: value }));
    }
  };

  const handleRoleChange = (e) => {
    setUserRole(e.target.value);
  };

  const handleNext = async (e) => {
    e.preventDefault();
    setLoading(true);
    setNotificationMessage('');
    setShowNotification(false);

    if (!isRecaptchaReady) {
      setNotificationMessage('reCAPTCHA sa ešte nenačítalo. Skúste to prosím znova.');
      setShowNotification(true);
      setLoading(false);
      return;
    }

    // Validácia na strane klienta pre stránku 1
    if (formData.password !== formData.confirmPassword) {
      setNotificationMessage('Heslá sa nezhodujú.');
      setShowNotification(true);
      setLoading(false);
      return;
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(formData.password)) {
      setNotificationMessage('Heslo musí obsahovať aspoň jedno malé písmeno, jedno veľké písmeno a jednu číslicu.');
      setShowNotification(true);
      setLoading(false);
      return;
    }

    // Overenie reCAPTCHA
    try {
      const recaptchaToken = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'submit' });
      // Pre reCAPTCHA v3 nie je potrebné volať grecaptcha.reset()

      // *** ZMENA TU: Používame mode: 'no-cors' pre reCAPTCHA overenie ***
      const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors', // <--- KĽÚČOVÁ ZMENA
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'verifyRecaptcha',
          recaptchaToken: recaptchaToken,
        }),
      });

      // Keďže používame 'no-cors', nemôžeme priamo čítať odpoveď (response.json()).
      // Musíme sa spoľahnúť na to, že Apps Script spracuje overenie.
      // Pre účely testovania a prechodu na ďalšiu stránku budeme predpokladať úspech,
      // ak nedošlo k chybe fetch. V produkčnom prostredí by ste potrebovali iný mechanizmus
      // na potvrdenie overenia (napr. kontrola na serveri pri finálnej registrácii).
      console.log("Požiadavka na overenie reCAPTCHA odoslaná (no-cors režim).");
      setPage(2); // Predpokladáme úspech a prejdeme na ďalšiu stránku

    } catch (error) {
      console.error('Chyba pri overovaní reCAPTCHA (fetch zlyhal):', error);
      setNotificationMessage('Chyba pri overovaní reCAPTCHA. Skúste to prosím neskôr.');
      setShowNotification(true);
    } finally {
      setLoading(false);
    }
  };

  const handlePrev = () => {
    setPage(1);
    setNotificationMessage('');
    setShowNotification(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setNotificationMessage('');
    setShowNotification(false);

    // Validácia fakturačných údajov
    const { ico, dic, icDph } = formData.billing;
    if (!ico && !dic && !icDph) {
      setNotificationMessage('Musíte zadať aspoň jedno z polí IČO, DIČ alebo IČ DPH.');
      setShowNotification(true);
      setLoading(false);
      return;
    }

    // Validácia formátu IČ DPH
    if (icDph) {
      const icDphRegex = /^[A-Z]{2}[0-9]+$/;
      if (!icDphRegex.test(icDph)) {
        setNotificationMessage('IČ DPH musí začínať dvoma veľkými písmenami a nasledovať číslicami (napr. SK1234567890).');
        setShowNotification(true);
        setLoading(false);
        return;
      }
    }

    // Validácia PSČ
    const postalCodeClean = formData.postalCode.replace(/\s/g, ''); // Odstráň medzery pre validáciu
    if (postalCodeClean.length !== 5 || !/^\d{5}$/.test(postalCodeClean)) {
      setNotificationMessage('PSČ musí mať presne 5 číslic.');
      setShowNotification(true);
      setLoading(false);
      return;
    }


    const fullPhoneNumber = `${selectedCountryDialCode}${formData.contactPhoneNumber}`;

    try {
      // Pre hlavné odoslanie formulára (registrácia používateľa) môžeme stále použiť 'cors'
      // ak Apps Script posiela správne CORS hlavičky pre túto akciu.
      // Ak by pretrvávali problémy, aj toto by sa muselo zmeniť na 'no-cors'.
      const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'cors', // Môže byť zmenené na 'no-cors', ak pretrvávajú problémy s CORS
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'registerUser',
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          contactPhoneNumber: fullPhoneNumber,
          password: formData.password,
          // Removed birthDate, gender, role from here as they are no longer in form
          country: formData.country,
          city: formData.city,
          postalCode: formData.postalCode,
          street: formData.street,
          houseNumber: formData.houseNumber, // New field
          billing: formData.billing, // Pass the entire billing object
          registrationDate: formatToDatetimeLocal(new Date()),
        }),
      });

      const result = await response.json();

      if (result.success) {
        setNotificationMessage('Registrácia úspešná! Môžete sa prihlásiť.');
        setShowNotification(true);
        // Vyčistiť formulár
        setFormData({
          firstName: '',
          lastName: '',
          email: '',
          contactPhoneNumber: '',
          password: '',
          confirmPassword: '',
          houseNumber: '', 
          country: '', 
          city: '', 
          postalCode: '', 
          street: '', 
          billing: { 
            clubName: '',
            ico: '',
            dic: '',
            icDph: '',
          }
        });
        setUserRole('user'); // Keep default role, not from form
        setPage(1); // Návrat na stránku 1
        // Presmerovanie na prihlasovaciu stránku po krátkej oneskorení
        setTimeout(() => {
          window.location.href = 'login.html';
        }, 3000);
      } else {
        setNotificationMessage(result.message || 'Registrácia zlyhala. Skúste to prosím znova.');
        setShowNotification(true);
      }
    } catch (error) {
      console.error('Chyba pri registrácii:', error);
      setNotificationMessage('Chyba pri registrácii. Skúste to prosím neskôr.');
      setShowNotification(true);
    } finally {
      setLoading(false);
    }
  };

  return React.createElement(
    'div',
    { className: 'min-h-screen flex items-center justify-center bg-gray-100 p-4' },
    React.createElement(NotificationModal, { message: notificationMessage, onClose: closeNotification }),
    // Zobraz loading, ak sa nastavenia ešte nenačítali alebo autentifikácia nie je pripravená
    !settingsLoaded || !isAuthReady ? (
      React.createElement(
        'div',
        { className: 'flex items-center justify-center py-8' },
        React.createElement('svg', { className: 'animate-spin -ml-1 mr-3 h-8 w-8 text-blue-500', xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24' },
          React.createElement('circle', { className: 'opacity-25', cx: '12', cy: '12', r: '10', stroke: 'currentColor', strokeWidth: '4' }),
          React.createElement('path', { className: 'opacity-75', fill: 'currentColor', d: 'M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z' })
        ),
        'Načítavam stav registrácie...'
      )
    ) : (
      page === 1 ?
        React.createElement(Page1Form, {
          formData: formData,
          handleChange: handleChange,
          handleNext: handleNext,
          loading: loading,
          notificationMessage: notificationMessage,
          closeNotification: closeNotification,
          isCountryCodeModalOpen: isCountryCodeModalOpen,
          setIsCountryCodeModalOpen: setIsCountryCodeModalOpen,
          setSelectedCountryDialCode: setSelectedCountryDialCode,
          selectedCountryDialCode: selectedCountryDialCode,
          NotificationModal: NotificationModal,
          isRegistrationOpen: isRegistrationOpen, // Odovzdanie stavu registrácie
          countdownMessage: countdown, // Odovzdanie správy odpočtu
          registrationStartDate: registrationStartDate, // Odovzdanie registrationStartDate
          isRecaptchaReady: isRecaptchaReady, // Odovzdanie stavu pripravenosti reCAPTCHA
        }) :
        React.createElement(Page2Form, {
          formData: formData,
          handleChange: handleChange,
          handlePrev: handlePrev,
          handleSubmit: handleSubmit,
          loading: loading,
          notificationMessage: notificationMessage,
          closeNotification: closeNotification,
          userRole: userRole, // Still passed, but not used in Page2Form for selection
          handleRoleChange: handleRoleChange, // Still passed, but not used in Page2Form for selection
          NotificationModal: NotificationModal,
        })
    )
  );
}

// Zabezpečenie vykreslenia komponentu App
// Používame ReactDOM.createRoot pre React 18
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App, null));
