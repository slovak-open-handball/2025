// register.js
// Hlavný súbor aplikácie, ktorý spravuje stav a orchestráciu medzi stránkami formulára.

// Global application ID a Firebase konfigurácia (mali by byť konzistentné naprieč všetkými React aplikáciami)
// Tieto konštanty sú definované v <head> register.html a sú prístupné globálne.
const RECAPTCHA_SITE_KEY = "6LdJbn8rAAAAAO4C50qXTWva6ePzDlOfYwBDEDwa";
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec";

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
    birthDate: '',
    gender: '',
    country: '',
    city: '',
    postalCode: '',
    street: '',
  });
  const [userRole, setUserRole] = React.useState('user'); // Predvolená rola
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

  // Recaptcha ref
  const recaptchaRef = React.useRef(null);
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


  const closeNotification = () => {
    setShowNotification(false);
    setNotificationMessage('');
  };

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleRoleChange = (e) => {
    setUserRole(e.target.value);
  };

  const handleNext = async (e) => {
    e.preventDefault();
    setLoading(true);
    setNotificationMessage('');
    setShowNotification(false);

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
    const recaptchaToken = await recaptchaRef.current.executeAsync();
    recaptchaRef.current.reset(); // Reset reCAPTCHA po vykonaní

    try {
      const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'verifyRecaptcha',
          recaptchaToken: recaptchaToken,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setPage(2);
      } else {
        setNotificationMessage('reCAPTCHA overenie zlyhalo. Skúste to prosím znova.');
        setShowNotification(true);
      }
    } catch (error) {
      console.error('Chyba pri overovaní reCAPTCHA:', error);
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

    // Validácia dátumu narodenia (musí mať aspoň 18 rokov)
    const birthDate = new Date(formData.birthDate);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age < 18) {
      setNotificationMessage('Musíte mať aspoň 18 rokov pre registráciu.');
      setShowNotification(true);
      setLoading(false);
      return;
    }

    const fullPhoneNumber = `${selectedCountryDialCode}${formData.contactPhoneNumber}`;

    try {
      const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'cors',
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
          birthDate: formData.birthDate, // YYYY-MM-DD formát
          gender: formData.gender,
          country: formData.country,
          city: formData.city,
          postalCode: formData.postalCode,
          street: formData.street,
          role: userRole,
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
          birthDate: '',
          gender: '',
          country: '',
          city: '',
          postalCode: '',
          street: '',
        });
        setUserRole('user');
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
        }) :
        React.createElement(Page2Form, {
          formData: formData,
          handleChange: handleChange,
          handlePrev: handlePrev,
          handleSubmit: handleSubmit,
          loading: loading,
          notificationMessage: notificationMessage,
          closeNotification: closeNotification,
          userRole: userRole,
          handleRoleChange: handleRoleChange,
          NotificationModal: NotificationModal,
        })
    ),
    // reCAPTCHA skript - zabezpečte, aby bol načítaný raz a bol globálne dostupný
    React.createElement('script', { src: `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`, async: true, defer: true }),
    React.createElement('div', { id: 'recaptcha-badge', className: 'g-recaptcha', 'data-sitekey': RECAPTCHA_SITE_KEY, 'data-size': 'invisible', 'data-callback': 'onRecaptchaSuccess', 'data-badge': 'bottomleft' })
  );
}

// Zabezpečenie vykreslenia komponentu App
// Používame ReactDOM.createRoot pre React 18
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App, null));
