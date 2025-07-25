// register.js
// Hlavný súbor aplikácie, ktorý spravuje stav a orchestráciu medzi stránkami formulára.

// Tieto konštanty sú definované v <head> register.html a sú prístupné globálne.
const RECAPTCHA_SITE_KEY = "6LdJbn8rAAAAAO4C50qXTWva6ePzDlOfYwBDEDwa";
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec"; // Predpokladáme, že táto URL je správna pre Apps Script

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
  const [userRole, setUserRole] = React.useState('user'); // Predvolená rola
  const [loading, setLoading] = React.useState(false);
  const [notificationMessage, setNotificationMessage] = React.useState('');
  const [showNotification, setShowNotification] = React.useState(false);
  const [isCountryCodeModalOpen, setIsCountryCodeModalOpen] = React.useState(false);
  const [selectedCountryDialCode, setSelectedCountryDialCode] = React.useState('+421');

  // Firebase stav
  const [db, setDb] = React.useState(null);
  const [auth, setAuth] = React.useState(null);
  const [isAuthReady, setIsAuthReady] = React.useState(false);
  const [registrationStartDate, setRegistrationStartDate] = React.useState('');
  const [registrationEndDate, setRegistrationEndDate] = React.useState('');
  const [settingsLoaded, setSettingsLoaded] = React.useState(false);

  // Nové stavy pre odpočet a vynútenie prepočtu
  const [countdown, setCountdown] = React.useState(null);
  const [forceRegistrationCheck, setForceRegistrationCheck] = React.useState(0);
  const [periodicRefreshKey, setPeriodicRefreshKey] = React.useState(0);

  // Nový stav pre reCAPTCHA pripravenosť
  const [isRecaptchaReady, setIsRecaptchaReady] = React.useState(false);

  const countdownIntervalRef = React.useRef(null);

  const isRegistrationOpen = React.useMemo(() => {
    if (!settingsLoaded) return false;
    const now = new Date();
    const regStart = registrationStartDate ? new Date(registrationStartDate) : null;
    const regEnd = registrationEndDate ? new Date(registrationEndDate) : null;

    const isRegStartValid = regStart instanceof Date && !isNaN(regStart);
    const isRegEndValid = regEnd instanceof Date && !isNaN(regEnd);

    return (
      (isRegStartValid ? now >= regStart : true) &&
      (isRegEndValid ? now <= regEnd : true)
    );
  }, [settingsLoaded, registrationStartDate, registrationEndDate, forceRegistrationCheck, periodicRefreshKey]);


  const calculateTimeLeft = React.useCallback(() => {
    const now = new Date();
    const startDate = registrationStartDate ? new Date(registrationStartDate) : null;

    if (!startDate || isNaN(startDate) || now >= startDate) {
        return null;
    }

    const difference = startDate.getTime() - now.getTime();

    if (difference <= 0) {
        return null;
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
      if (typeof firebase === 'undefined' || typeof firebase.firestore === 'undefined' || typeof firebase.auth === 'undefined') {
        console.error("register.js: Firebase SDK nie je načítané alebo nie sú dostupné všetky moduly. Uistite sa, že sú script tagy Firebase v HTML.");
        setNotificationMessage('Chyba pri inicializácii aplikácie: Firebase SDK chýba.');
        setShowNotification(true);
        return;
      }

      let firebaseAppInstance;
      if (firebase.apps.length === 0) {
          console.warn("register.js: Predvolená Firebase App nebola nájdená, inicializujem novú.");
          const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
          firebaseAppInstance = firebase.initializeApp(firebaseConfig);
      } else {
          firebaseAppInstance = firebase.app();
          console.log("register.js: Používam existujúcu Firebase App inštanciu.");
      }

      const firestoreDb = firebase.firestore(firebaseAppInstance);
      const firebaseAuth = firebase.auth(firebaseAppInstance);

      setDb(firestoreDb);
      setAuth(firebaseAuth);

      const unsubscribe = firebaseAuth.onAuthStateChanged(async (currentUser) => {
        if (!currentUser && typeof __initial_auth_token === 'string' && __initial_auth_token.length > 0) {
          try {
            await firebaseAuth.signInWithCustomToken(__initial_auth_token);
            console.log("register.js: Úspešné prihlásenie s vlastným tokenom.");
          } catch (error) {
            console.error("register.js: Chyba pri prihlásení s vlastným tokenom:", error);
          }
        }
        setIsAuthReady(true);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error("Chyba pri inicializácii Firebase v register.js:", error);
      setNotificationMessage('Chyba pri inicializácii aplikácie.');
      setShowNotification(true);
    }
  }, []);

  // Načítanie a počúvanie stavu registrácie z Firestore
  React.useEffect(() => {
    const fetchSettings = async () => {
      if (!db || !isAuthReady) {
        return;
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

  // Effect pre odpočet
  React.useEffect(() => {
    let timer;
    const updateCountdown = () => {
        const timeLeft = calculateTimeLeft();
        setCountdown(timeLeft);
        if (timeLeft === null) {
            clearInterval(timer);
            setForceRegistrationCheck(prev => prev + 1);
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

  // Nový useEffect pre periodickú aktualizáciu isRegistrationOpen
  React.useEffect(() => {
    const interval = setInterval(() => {
      setPeriodicRefreshKey(prev => prev + 1);
    }, 60 * 1000);

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

  // Pomocná funkcia pre získanie reCAPTCHA tokenu (prevzatá z admin-register.js)
  const getRecaptchaToken = async (action) => {
    if (typeof grecaptcha === 'undefined' || !grecaptcha.execute) {
      setNotificationMessage("reCAPTCHA API nie je načítané alebo pripravené.");
      setShowNotification(true);
      return null;
    }
    try {
      const token = await grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: action });
      return token;
    } catch (e) {
      console.error("Chyba pri získavaní reCAPTCHA tokenu:", e);
      setNotificationMessage(`Chyba reCAPTCHA: ${e.message}`);
      setShowNotification(true);
      return null;
    }
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

    // Získanie reCAPTCHA tokenu pre prechod na ďalšiu stránku (klient-side overenie)
    const recaptchaToken = await getRecaptchaToken('page_transition');
    if (!recaptchaToken) {
        setLoading(false);
        return; // Zastav, ak token nebol získaný
    }
    console.log("reCAPTCHA Token pre prechod stránky získaný (klient-side overenie).");
    setPage(2);
    setLoading(false); // Ukončiť načítavanie po prechode na ďalšiu stránku
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
    const { clubName, ico, dic, icDph } = formData.billing;

    if (!clubName.trim()) {
        setNotificationMessage('Oficiálny názov klubu je povinný.');
        setShowNotification(true);
        setLoading(false);
        return;
    }

    if (!ico && !dic && !icDph) {
      setNotificationMessage('Musíte zadať aspoň jedno z polí IČO, DIČ alebo IČ DPH.');
      setShowNotification(true);
      setLoading(false);
      return;
    }

    if (icDph) {
      const icDphRegex = /^[A-Z]{2}[0-9]+$/;
      if (!icDphRegex.test(icDph)) {
        setNotificationMessage('IČ DPH musí začínať dvoma veľkými písmenami a nasledovať číslicami (napr. SK1234567890).');
        setShowNotification(true);
        setLoading(false);
        return;
      }
    }

    const postalCodeClean = formData.postalCode.replace(/\s/g, '');
    if (postalCodeClean.length !== 5 || !/^\d{5}$/.test(postalCodeClean)) {
      setNotificationMessage('PSČ musí mať presne 5 číslic.');
      setShowNotification(true);
      setLoading(false);
      return;
    }

    const fullPhoneNumber = `${selectedCountryDialCode}${formData.contactPhoneNumber}`;

    try {
      if (!auth || !db) {
        setNotificationMessage('Firebase nie je inicializované. Skúste to prosím znova.');
        setShowNotification(true);
        setLoading(false);
        return;
      }

      // Získanie reCAPTCHA tokenu pre finálnu registráciu (klient-side overenie)
      const recaptchaToken = await getRecaptchaToken('register_user');
      if (!recaptchaToken) {
        setLoading(false);
        return; // Zastav, ak token nebol získaný
      }
      console.log("reCAPTCHA Token pre registráciu používateľa získaný (klient-side overenie).");

      // 1. Vytvorenie používateľa vo Firebase Authentication
      const userCredential = await auth.createUserWithEmailAndPassword(formData.email, formData.password);
      const user = userCredential.user;

      // 2. Uloženie používateľských údajov do Firestore
      // Používame __app_id pre štruktúru kolekcie
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      await db.collection('artifacts').doc(appId).collection('users').doc(user.uid).set({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        contactPhoneNumber: fullPhoneNumber,
        country: formData.country,
        city: formData.city,
        postalCode: formData.postalCode,
        street: formData.street,
        houseNumber: formData.houseNumber,
        billing: formData.billing,
        role: userRole, // Predvolená rola 'user'
        approved: true,
        registrationDate: firebase.firestore.FieldValue.serverTimestamp(), // Použitie serverového časového údaja
      });

      // 3. Odoslanie registračného e-mailu cez Google Apps Script (no-cors)
      try {
          const payload = {
            action: 'sendRegistrationEmail',
            email: formData.email,
            firstName: formData.firstName,
            lastName: formData.lastName,
            // Ďalšie údaje, ak sú potrebné pre e-mail
          };
          console.log("Odosielanie dát do Apps Script (registračný e-mail):", payload);
          const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors', // Používame 'no-cors', pretože nepotrebujeme čítať odpoveď
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
          });
          console.log("Požiadavka na odoslanie registračného e-mailu odoslaná (no-cors režim).");
          // V režime no-cors nemôžeme čítať odpoveď, takže nečakáme na response.json()
      } catch (emailError) {
          console.error("Chyba pri odosielaní registračného e-mailu cez Apps Script (chyba fetch):", emailError);
          // Táto chyba neblokuje registráciu, len odoslanie e-mailu
      }

      setNotificationMessage('Registrácia úspešná! Budete presmerovaní na prihlasovaciu stránku.');
      setShowNotification(true);

      // Vyčistiť formulár
      setFormData({
        firstName: '', lastName: '', email: '', contactPhoneNumber: '',
        password: '', confirmPassword: '', houseNumber: '', country: '',
        city: '', postalCode: '', street: '',
        billing: { clubName: '', ico: '', dic: '', icDph: '' }
      });
      setPage(1); // Návrat na stránku 1

      // Presmerovanie na prihlasovaciu stránku po krátkej oneskorení
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 3000);

    } catch (error) {
      console.error('Chyba pri registrácii do Firebase:', error);
      let errorMessage = 'Registrácia zlyhala. Skúste to prosím neskôr.';

      // Konkrétnejšie chybové správy z Firebase Auth
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'Zadaná e-mailová adresa je už používaná.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Neplatný formát e-mailovej adresy.';
          break;
        case 'auth/weak-password':
          errorMessage = 'Heslo je príliš slabé. Použite silnejšie heslo.';
          break;
        default:
          // Pre ostatné chyby zobrazíme všeobecnú správu
          errorMessage = error.message || errorMessage;
          break;
      }
      setNotificationMessage(errorMessage);
      setShowNotification(true);
    } finally {
      setLoading(false);
    }
  };

  return React.createElement(
    'div',
    { className: 'min-h-screen flex items-center justify-center bg-gray-100 p-4' },
    React.createElement(NotificationModal, { message: notificationMessage, onClose: closeNotification }),
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
          isRegistrationOpen: isRegistrationOpen,
          countdownMessage: countdown,
          registrationStartDate: registrationStartDate,
          isRecaptchaReady: isRecaptchaReady,
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
    )
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App, null));

// --- Obsah register-page1.js (pretože je importovaný a meníme ho tu priamo) ---

// Zoznam krajín a ich predvolieb pre telefónne číslo (rozšírený a zoradený)
const countryCodes = [
  { code: 'AF', dialCode: '+93' }, { code: 'AG', dialCode: '+1‑268' }, { code: 'AI', dialCode: '+1‑264' },
  { code: 'AL', dialCode: '+355' }, { code: 'AM', dialCode: '+374' }, { code: 'AO', dialCode: '+244' },
  { code: 'AQ', dialCode: '+672' }, { code: 'AR', dialCode: '+54' }, { code: 'AS', dialCode: '+1‑684' },
  { code: 'AT', dialCode: '+43' }, { code: 'AU', dialCode: '+61' }, { code: 'AW', dialCode: '+297' },
  { code: 'AX', dialCode: '+358' }, { code: 'AZ', dialCode: '+994' }, { code: 'BA', dialCode: '+387' },
  { code: 'BB', dialCode: '+1‑246' }, { code: 'BD', dialCode: '+880' }, { code: 'BE', dialCode: '+32' },
  { code: 'BF', dialCode: '+226' }, { code: 'BG', dialCode: '+359' }, { code: 'BH', dialCode: '+973' },
  { code: 'BI', dialCode: '+257' }, { code: 'BJ', dialCode: '+229' }, { code: 'BL', dialCode: '+590' }, // Opravený preklep: dialleCode na dialCode
  { code: 'BM', dialCode: '+1‑441' }, { code: 'BN', dialCode: '+673' }, { code: 'BO', dialCode: '+591' },
  { code: 'BQ', dialCode: '+599' }, { code: 'BR', dialCode: '+55' }, { code: 'BS', dialCode: '+1‑242' },
  { code: 'BT', dialCode: '+975' }, { code: 'BW', dialCode: '+267' }, { code: 'BY', dialCode: '+375' },
  { code: 'BZ', dialCode: '+501' }, { code: 'CA', dialCode: '+1' }, { code: 'CC', dialCode: '+61' },
  { code: 'CD', dialCode: '+243' }, { code: 'CF', dialCode: '+236' }, { code: 'CG', dialCode: '+242' },
  { code: 'CH', dialCode: '+41' }, { code: 'CI', dialCode: '+225' }, { code: 'CK', dialCode: '+682' },
  { code: 'CL', dialCode: '+56' }, { code: 'CM', dialCode: '+237' }, { code: 'CN', dialCode: '+86' },
  { code: 'CO', dialCode: '+57' }, { code: 'CR', dialCode: '+506' }, { code: 'CU', dialCode: '+53' },
  { code: 'CV', dialCode: '+238' }, { code: 'CW', dialCode: '+599' }, { code: 'CX', dialCode: '+61' },
  { code: 'CY', dialCode: '+357' }, { code: 'CZ', dialCode: '+420' }, { code: 'DE', dialCode: '+49' },
  { code: 'DJ', dialCode: '+253' }, { code: 'DK', dialCode: '+45' }, { code: 'DM', dialCode: '+1‑767' },
  { code: 'DO', dialCode: '+1‑809' }, { code: 'DZ', dialCode: '+213' }, { code: 'EC', dialCode: '+593' },
  { code: 'EE', dialCode: '+372' }, { code: 'EG', dialCode: '+20' }, { code: 'EH', dialCode: '+212' },
  { code: 'ER', dialCode: '+291' }, { code: 'ES', dialCode: '+34' }, { code: 'ET', dialCode: '+251' },
  { code: 'FI', dialCode: '+358' }, { code: 'FJ', dialCode: '+679' }, { code: 'FK', dialCode: '+500' },
  { code: 'FM', dialCode: '+691' }, { code: 'FO', dialCode: '+298' }, { code: 'FR', dialCode: '+33' },
  { code: 'GA', dialCode: '+241' }, { code: 'GB', dialCode: '+44' }, { code: 'GD', dialCode: '+1‑473' },
  { code: 'GE', dialCode: '+995' }, { code: 'GF', dialCode: '+594' }, { code: 'GG', dialCode: '+44' },
  { code: 'GH', dialCode: '+233' }, { code: 'GI', dialCode: '+350' }, { code: 'GL', dialCode: '+299' },
  { code: 'GM', dialCode: '+220' }, { code: 'GN', dialCode: '+224' }, { code: 'GP', dialCode: '+590' },
  { code: 'GQ', dialCode: '+240' }, { code: 'GR', dialCode: '+30' }, { code: 'GT', dialCode: '+502' },
  { code: 'GU', dialCode: '+1‑671' }, { code: 'GW', dialCode: '+245' }, { code: 'GY', dialCode: '+592' },
  { code: 'HK', dialCode: '+852' }, { code: 'HN', dialCode: '+504' }, { code: 'HR', dialCode: '+385' },
  { code: 'HT', dialCode: '+509' }, { code: 'HU', dialCode: '+36' }, { code: 'ID', dialCode: '+62' },
  { code: 'IE', dialCode: '+353' }, { code: 'IL', dialCode: '+972' }, { code: 'IM', dialCode: '+44' },
  { code: 'IN', dialCode: '+91' }, { code: 'IO', dialCode: '+246' }, { code: 'IQ', dialCode: '+964' },
  { code: 'IR', dialCode: '+98' }, { code: 'IS', dialCode: '+354' }, { code: 'IT', dialCode: '+39' },
  { code: 'JE', dialCode: '+44' }, { code: 'JM', dialCode: '+1‑876' }, { code: 'JO', dialCode: '+962' },
  { code: 'JP', dialCode: '+81' }, { code: 'KE', dialCode: '+254' }, { code: 'KG', dialCode: '+996' },
  { code: 'KH', dialCode: '+855' }, { code: 'KI', dialCode: '+686' }, { code: 'KM', dialCode: '+269' },
  { code: 'KN', dialCode: '+1‑869' }, { code: 'KP', dialCode: '+850' }, { code: 'KR', dialCode: '+82' },
  { code: 'KW', dialCode: '+965' }, { code: 'KY', dialCode: '+1‑345' }, { code: 'KZ', dialCode: '+7' },
  { code: 'LA', dialCode: '+856' }, { code: 'LB', dialCode: '+961' }, { code: 'LC', dialCode: '+1‑758' },
  { code: 'LI', dialCode: '+423' }, { code: 'LK', dialCode: '+94' }, { code: 'LR', dialCode: '+231' },
  { code: 'LS', dialCode: '+266' }, { code: 'LT', dialCode: '+370' }, { code: 'LU', dialCode: '+352' },
  { code: 'LV', dialCode: '+371' }, { code: 'LY', dialCode: '+218' }, { code: 'MA', dialCode: '+212' },
  { code: 'MC', dialCode: '+377' }, { code: 'MD', dialCode: '+373' }, { code: 'ME', dialCode: '+382' },
  { code: 'MF', dialCode: '+590' }, { code: 'MG', dialCode: '+261' }, { code: 'MH', dialCode: '+692' },
  { code: 'MK', dialCode: '+389' }, { code: 'ML', dialCode: '+223' }, { code: 'MM', dialCode: '+95' },
  { code: 'MN', dialCode: '+976' }, { code: 'MO', dialCode: '+853' }, { code: 'MP', dialCode: '+1‑670' },
  { code: 'MQ', dialCode: '+596' }, { code: 'MR', dialCode: '+222' }, { code: 'MS', dialCode: '+1‑664' },
  { code: 'MT', dialCode: '+356' }, { code: 'MU', dialCode: '+230' }, { code: 'MV', dialCode: '+960' },
  { code: 'MW', dialCode: '+265' }, { code: 'MX', dialCode: '+52' }, { code: 'MY', dialCode: '+60' },
  { code: 'MZ', dialCode: '+258' }, { code: 'NA', dialCode: '+264' }, { code: 'NC', dialCode: '+687' },
  { code: 'NE', dialCode: '+227' }, { code: 'NF', dialCode: '+672' }, { code: 'NG', dialCode: '+234' },
  { code: 'NI', dialCode: '+505' }, { code: 'NL', dialCode: '+31' }, { code: 'NO', dialCode: '+47' },
  { code: 'NP', dialCode: '+977' }, { code: 'NR', dialCode: '+674' }, { code: 'NU', dialCode: '+683' },
  { code: 'NZ', dialCode: '+64' }, { code: 'OM', dialCode: '+968' }, { code: 'PA', dialCode: '+507' },
  { code: 'PE', dialCode: '+51' }, { code: 'PF', dialCode: '+689' }, { code: 'PG', dialCode: '+675' },
  { code: 'PH', dialCode: '+63' }, { code: 'PK', dialCode: '+92' }, { code: 'PL', dialCode: '+48' },
  { code: 'PM', dialCode: '+508' }, { code: 'PR', dialCode: '+1‑787' }, { code: 'PS', dialCode: '+970' },
  { code: 'PT', dialCode: '+351' }, { code: 'PW', dialCode: '+680' }, { code: 'PY', dialCode: '+595' },
  { code: 'QA', dialCode: '+974' }, { code: 'RE', dialCode: '+262' }, { code: 'RO', dialCode: '+40' },
  { code: 'RS', dialCode: '+381' }, { code: 'RU', dialCode: '+7' }, { code: 'RW', dialCode: '+250' },
  { code: 'SA', dialCode: '+966' }, { code: 'SB', dialCode: '+677' }, { code: 'SC', dialCode: '+248' },
  { code: 'SD', dialCode: '+249' }, { code: 'SE', dialCode: '+46' }, { code: 'SG', dialCode: '+65' },
  { code: 'SH', dialCode: '+290' }, { code: 'SI', dialCode: '+386' }, { code: 'SJ', dialCode: '+47' },
  { code: 'SK', dialCode: '+421' }, { code: 'SL', dialCode: '+232' }, { code: 'SM', dialCode: '+378' },
  { code: 'SN', dialCode: '+221' }, { code: 'SO', dialCode: '+252' }, { code: 'SR', dialCode: '+597' },
  { code: 'SS', dialCode: '+211' }, { code: 'ST', dialCode: '+239' }, { code: 'SV', dialCode: '+503' },
  { code: 'SX', dialCode: '+1‑721' }, { code: 'SY', dialCode: '+963' }, { code: 'SZ', dialCode: '+268' },
  { code: 'TC', dialCode: '+1‑649' }, { code: 'TD', dialCode: '+235' }, { code: 'TG', dialCode: '+228' },
  { code: 'TH', dialCode: '+66' }, { code: 'TJ', dialCode: '+992' }, { code: 'TK', dialCode: '+690' },
  { code: 'TL', dialCode: '+670' }, { code: 'TM', dialCode: '+993' }, { code: 'TN', dialCode: '+216' },
  { code: 'TO', dialCode: '+676' }, { code: 'TR', dialCode: '+90' }, { code: 'TT', dialCode: '+1‑868' },
  { code: 'TV', dialCode: '+688' }, { code: 'TW', dialCode: '+886' }, { code: 'TZ', dialCode: '+255' },
  { code: 'UA', dialCode: '+380' }, { code: 'UG', dialCode: '+256' }, { code: 'US', dialCode: '+1' },
  { code: 'UY', dialCode: '+598' }, { code: 'UZ', dialCode: '+998' }, { code: 'VA', dialCode: '+379' },
  { code: 'VC', dialCode: '+1‑784' }, { code: 'VE', dialCode: '+58' }, { code: 'VG', dialCode: '+1‑284' },
  { code: 'VI', dialCode: '+1‑340' }, { code: 'VN', dialCode: '+84' }, { code: 'VU', dialCode: '+678' },
  { code: 'WF', dialCode: '+681' }, { code: 'WS', dialCode: '+685' }, { code: 'YE', dialCode: '+967' },
  { code: 'YT', dialCode: '+262' }, { code: 'ZA', dialCode: '+27' }, { code: 'ZM', dialCode: '+260' },
  { code: 'ZW', dialCode: '+263' },
].sort((a, b) => a.code.localeCompare(b.code)); // Zoradenie podľa kódu krajiny

// PasswordInput Component pre polia hesla s prepínačom viditeľnosti
export function PasswordInput({ id, label, value, onChange, placeholder, autoComplete, showPassword, toggleShowPassword, onCopy, onPaste, onCut, disabled, description, tabIndex }) {
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

  return React.createElement(
    'div',
    { className: 'mb-4' },
    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: id }, label),
    React.createElement(
      'div',
      { className: 'relative' },
      React.createElement('input', {
        type: showPassword ? 'text' : 'password',
        id: id,
        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10',
        value: value,
        onChange: onChange,
        onCopy: onCopy,
        onPaste: onPaste,
        onCut: onCut,
        required: true,
        placeholder: placeholder,
        autoComplete: autoComplete,
        disabled: disabled,
        tabIndex: tabIndex
      }),
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: toggleShowPassword,
          className: 'absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 focus:outline-none',
          tabIndex: -1,
          disabled: disabled,
        },
        showPassword ? EyeIcon : EyeOffIcon
      )
    ),
    // Oprava: Zmenené <p> na <div> pre popis hesla, aby sa zabránilo chybe DOM nesting.
    description && React.createElement('div', { className: 'text-gray-600 text-xs italic mt-1' }, description)
  );
}

// CountryCodeModal Component pre výber predvoľby telefónneho čísla
export function CountryCodeModal({ isOpen, onClose, onSelect, selectedCode, disabled }) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [tempSelectedCode, setTempSelectedCode] = React.useState(selectedCode);
  const modalRef = React.useRef(null);

  React.useEffect(() => {
    if (isOpen) {
      setTempSelectedCode(selectedCode);
      // Reset searchTerm when modal opens
      setSearchTerm(''); 
    }
  }, [isOpen, selectedCode]);

  React.useEffect(() => {
    const handleOutsideClick = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    } else {
      document.removeEventListener('mousedown', handleOutsideClick);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Filter countries based on searchTerm. If searchTerm is empty, all countries are shown.
  const filteredCountries = countryCodes.filter(country =>
    country.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    country.dialCode.includes(searchTerm)
  );

  const handleConfirm = () => {
    onSelect(tempSelectedCode);
    onClose();
  };

  return React.createElement(
    'div',
    { className: 'modal' },
    React.createElement(
      'div',
      {
        className: 'modal-content bg-white p-6 rounded-lg shadow-xl w-11/12 max-w-md mx-auto',
        ref: modalRef
      },
      React.createElement(
        'h3',
        { className: 'text-xl font-bold mb-4 text-center' },
        'Vyberte predvoľbu krajiny'
      ),
      React.createElement('input', {
        type: 'text',
        placeholder: 'Hľadať podľa kódu alebo predvoľby...',
        className: 'w-full p-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500',
        value: searchTerm,
        onChange: (e) => setSearchTerm(e.target.value),
      }),
      React.createElement(
        'div',
        { className: 'grid grid-cols-4 gap-2 max-h-60 overflow-y-auto p-2' },
        filteredCountries.map((country) =>
          React.createElement(
            'button',
            {
              key: country.code,
              className: `p-2 text-sm rounded-lg border transition-colors duration-200
                          ${tempSelectedCode === country.dialCode ? 'bg-blue-500 text-white border-blue-600' : 'bg-gray-100 hover:bg-blue-200 text-gray-800 border-gray-300'}`,
              onClick: () => {
                setTempSelectedCode(country.dialCode);
              },
              disabled: disabled,
            },
            `${country.code} ${country.dialCode}`
          )
        )
      ),
      React.createElement(
        'div',
        { className: 'flex justify-end space-x-4 mt-6' },
        React.createElement(
          'button',
          {
            onClick: onClose,
            className: 'bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200',
            disabled: disabled,
          },
          'Zatvoriť'
        ),
        React.createElement(
          'button',
          {
            onClick: handleConfirm,
            className: 'bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200',
            disabled: disabled,
          },
          'OK'
        )
      )
    )
  );
}

// Page1Form Component
export function Page1Form({ formData, handleChange, handleNext, loading, notificationMessage, closeNotification, isCountryCodeModalOpen, setIsCountryCodeModalOpen, setSelectedCountryDialCode, selectedCountryDialCode, NotificationModal, isRegistrationOpen, countdownMessage, registrationStartDate, isRecaptchaReady }) {
  // Stavy pre viditeľnosť hesla
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  // Funkcie na prepínanie viditeľnosti hesla
  const toggleShowPassword = () => setShowPassword(prev => !prev);
  const toggleShowConfirmPassword = () => setShowConfirmPassword(prev => !prev);

  // ChevronDown ikona (ekvivalent Lucide React - inline SVG)
  const ChevronDown = React.createElement(
    'svg',
    {
      xmlns: 'http://www.w3.org/24/04/svg',
      width: '24',
      height: '24',
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: '2',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      className: 'lucide lucide-chevron-down h-5 w-5 ml-2'
    },
    React.createElement('path', { d: 'm6 9 6 6 6-6' })
  );

  // Získanie aktuálneho času pre zobrazenie dátumu
  const now = new Date();
  // Používame prop registrationStartDate, nie formData.registrationStartDate
  const registrationStartDateObj = registrationStartDate ? new Date(registrationStartDate) : null; 

  return React.createElement(
    'div',
    { className: 'bg-white p-8 rounded-lg shadow-md w-full max-w-md' },
    React.createElement(NotificationModal, { message: notificationMessage, onClose: closeNotification }),

    // Podmienené zobrazenie nadpisu alebo správy
    isRegistrationOpen === false && countdownMessage ? (
      React.createElement(
        'div',
        { className: 'text-center text-gray-800 text-lg py-4' }, // Odstránená trieda 'font-semibold'
        React.createElement('h2', { className: 'text-2xl font-bold mb-2' }, 'Registračný formulár nie je prístupný.'),
        registrationStartDateObj && !isNaN(registrationStartDateObj) && now < registrationStartDateObj && (
          React.createElement(
            React.Fragment,
            null,
            React.createElement(
              'p',
              { className: 'text-md text-gray-700 mt-2' },
              'Registrácia bude možná od:',
              ' ',
              React.createElement('span', { style: { whiteSpace: 'nowrap' } }, registrationStartDateObj.toLocaleDateString('sk-SK')),
              ' ',
              React.createElement('span', { style: { whiteSpace: 'nowrap' } }, registrationStartDateObj.toLocaleTimeString('sk-SK'))
            ),
            countdownMessage && (
                React.createElement('p', { className: 'text-md text-gray-700 mt-2' }, `Registrácia začne o: ${countdownMessage}`)
            )
          )
        )
      )
    ) : isRegistrationOpen === null ? ( // Stav načítavania
      React.createElement(
        'div',
        { className: 'flex items-center justify-center py-8' },
        React.createElement('svg', { className: 'animate-spin -ml-1 mr-3 h-8 w-8 text-blue-500', xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24' },
          React.createElement('circle', { className: 'opacity-25', cx: '12', cy: '12', r: '10', stroke: 'currentColor', strokeWidth: '4' }),
          React.createElement('path', { className: 'opacity-75', fill: 'currentColor', d: 'M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z' })
        ),
        'Načítavam stav registrácie...'
      )
    ) : ( // Registrácia je otvorená alebo už skončila (správa je v notificationMessage)
      React.createElement(
        React.Fragment,
        null,
        React.createElement(
          'h2',
          { className: 'text-2xl font-bold mb-6 text-center text-gray-800' },
          'Registrácia - strana 1' // Zmena nadpisu
        ),
        React.createElement(
          'form',
          { onSubmit: handleNext, className: 'space-y-4' },
          React.createElement(
            'div',
            { className: 'mb-4' }, // Pridaná medzera
            React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'firstName' }, 'Meno kontaktnej osoby'),
            React.createElement('input', {
              type: 'text',
              id: 'firstName',
              className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
              value: formData.firstName,
              onChange: handleChange,
              required: true,
              placeholder: 'Zadajte vaše meno',
              tabIndex: 1,
              disabled: loading || !isRegistrationOpen || !isRecaptchaReady // Zakázať, ak reCAPTCHA nie je pripravená
            })
          ),
          React.createElement(
            'div',
            { className: 'mb-4' }, // Pridaná medzera
            React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'lastName' }, 'Priezvisko kontaktnej osoby'),
            React.createElement('input', {
              type: 'text',
              id: 'lastName',
              className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
              value: formData.lastName,
              onChange: handleChange,
              required: true,
              placeholder: 'Zadajte vaše priezvisko',
              tabIndex: 2,
              disabled: loading || !isRegistrationOpen || !isRecaptchaReady // Zakázať, ak reCAPTCHA nie je pripravená
            })
          ),
          React.createElement(
            'div',
            { className: 'mb-4' }, // Pridaná medzera
            React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'email' }, 'E-mailová adresa kontaktnej osoby'),
            React.createElement('input', {
              type: 'email',
              id: 'email',
              className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
              value: formData.email,
              onChange: handleChange,
              required: true,
              placeholder: 'Zadajte svoju e-mailovú adresu',
              autoComplete: 'email',
              tabIndex: 3,
              disabled: loading || !isRegistrationOpen || !isRecaptchaReady // Zakázať, ak reCAPTCHA nie je pripravená
            })
          ),
          React.createElement(
            'div',
            { className: 'mb-4' }, // Pridaná medzera
            React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'contactPhoneNumber' }, 'Telefónne číslo kontaktnej osoby'),
            React.createElement(
              'div',
              { className: 'flex shadow appearance-none border rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all duration-200' }, // Pridané shadow appearance-none
              React.createElement(
                'button',
                {
                  type: 'button',
                  className: 'bg-white text-gray-800 font-bold py-2 px-3 rounded-l-lg focus:outline-none flex-shrink-0 flex items-center', // Biele pozadie, bez pravého orámovania
                  onClick: () => setIsCountryCodeModalOpen(true),
                  tabIndex: 4,
                  disabled: loading || !isRegistrationOpen || !isRecaptchaReady // Zakázať, ak reCAPTCHA nie je pripravená
                },
                selectedCountryDialCode || '+XXX',
                ChevronDown
              ),
              React.createElement('input', {
                type: 'tel',
                id: 'contactPhoneNumber',
                className: 'appearance-none w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none bg-white rounded-r-lg', // Bez orámovania, biele pozadie
                value: formData.contactPhoneNumber,
                onChange: (e) => {
                  // Filtrujeme iba číslice
                  const re = /^[0-9\b]+$/; // Povoliť iba číslice a backspace
                  if (e.target.value === '' || re.test(e.target.value)) {
                    handleChange(e); // Ak je hodnota prázdna alebo obsahuje iba číslice, aktualizujeme stav
                  }
                },
                required: true,
                placeholder: 'Zadajte telefónne číslo',
                tabIndex: 5,
                disabled: loading || !isRegistrationOpen || !isRecaptchaReady // Zakázať, ak reCAPTCHA nie je pripravená
              })
            )
          ),
          React.createElement(PasswordInput, {
            id: 'password',
            label: 'Heslo',
            value: formData.password,
            onChange: handleChange,
            onCopy: (e) => e.preventDefault(),
            onPaste: (e) => e.preventDefault(),
            onCut: (e) => e.preventDefault(),
            placeholder: 'Zadajte heslo',
            autoComplete: 'new-password',
            description: React.createElement(
              React.Fragment,
              null,
              'Heslo musí obsahovať:',
              React.createElement(
                'ul',
                { className: 'list-disc list-inside ml-4' },
                React.createElement('li', null, 'aspoň jedno malé písmeno,'),
                React.createElement('li', null, 'aspoň jedno veľké písmeno,'),
                React.createElement('li', null, 'aspoň jednu číslicu.')
              )
            ),
            tabIndex: 6,
            disabled: loading || !isRegistrationOpen || !isRecaptchaReady, // Zakázať, ak reCAPTCHA nie je pripravená
            showPassword: showPassword, // Odovzdanie stavu
            toggleShowPassword: toggleShowPassword // Odovzdanie funkcie
          }),
          React.createElement(PasswordInput, {
            id: 'confirmPassword',
            label: 'Potvrdiť heslo',
            value: formData.confirmPassword,
            onChange: handleChange,
            onCopy: (e) => e.preventDefault(),
            onPaste: (e) => e.preventDefault(),
            onCut: (e) => e.preventDefault(),
            placeholder: 'Zadajte heslo znova',
            autoComplete: 'new-password',
            tabIndex: 7,
            disabled: loading || !isRegistrationOpen || !isRecaptchaReady, // Zakázať, ak reCAPTCHA nie je pripravená
            showPassword: showConfirmPassword, // Odovzdanie stavu
            toggleShowPassword: toggleShowConfirmPassword // Odovzdanie funkcie
          }),
          React.createElement(
            'button',
            {
              type: 'submit',
              className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200',
              disabled: loading || !isRegistrationOpen || !isRecaptchaReady, // Zakázať, ak reCAPTCHA nie je pripravená
              tabIndex: 8
            },
            loading ? React.createElement(
              'div',
              { className: 'flex items-center justify-center' },
              React.createElement('svg', { className: 'animate-spin -ml-1 mr-3 h-5 w-5 text-white', xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24' },
                React.createElement('circle', { className: 'opacity-25', cx: '12', cy: '12', r: '10', stroke: 'currentColor', strokeWidth: '4' }),
                React.createElement('path', { className: 'opacity-75', fill: 'currentColor', d: 'M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z' })
              ),
              'Ďalej...'
            ) : 'Ďalej'
          )
        )
      )
    ),
    React.createElement(CountryCodeModal, {
      isOpen: isCountryCodeModalOpen,
      onClose: () => setIsCountryCodeModalOpen(false),
      onSelect: setSelectedCountryDialCode,
      selectedCode: selectedCountryDialCode,
      disabled: loading || !isRegistrationOpen || !isRecaptchaReady, // Zakázať, ak reCAPTCHA nie je pripravená
    })
  );
}
