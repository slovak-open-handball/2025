// register.js
// Hlavný súbor aplikácie, ktorý spravuje stav a orchestráciu medzi stránkami formulára.

// Tieto konštanty sú definované v <head> register.html a sú prístupné globálne.
const RECAPTCHA_SITE_KEY = "6LdJbn8rAAAAAO4C50qXTWva6ePzDlOfYwBDEDwa";
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec"; // Predpokladáme, že táto URL je správna pre Apps Script

// Import komponentov pre stránky formulára z ich samostatných súborov
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
function NotificationModal({ message, onClose, type = 'info' }) { // Pridaný prop 'type'
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

  // Dynamické triedy pre farbu pozadia na základe typu správy
  let bgColorClass;
  if (type === 'success') {
    bgColorClass = 'bg-green-500';
  } else if (type === 'error') {
    bgColorClass = 'bg-red-600'; // Nastavenie červenej pre chyby
  } else {
    bgColorClass = 'bg-blue-500'; // Predvolená modrá pre info
  }

  return React.createElement(
    'div',
    {
      className: `fixed bottom-4 right-4 ${bgColorClass} text-white p-4 rounded-lg shadow-lg transition-transform transform ${show ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`,
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
  const [notificationType, setNotificationType] = React.useState('info'); // Nový stav pre typ notifikácie
  const [isCountryCodeModalOpen, setIsCountryCodeModalOpen] = React.useState(false);
  const [selectedCountryDialCode, setSelectedCountryDialCode] = React.useState('+421');
  const [registrationSuccess, setRegistrationSuccess] = React.useState(false); // Nový stav pre úspešnú registráciu

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

  // Nový stav na indikáciu prebiehajúcej registrácie (používa sa aj ref pre okamžitý prístup)
  const [isRegistering, setIsRegistering] = React.useState(false);
  const isRegisteringRef = React.useRef(false); // Ref pre okamžitý prístup v onAuthStateChanged

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
        setNotificationType('error');
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
        // Táto funkcia by mala len reagovať na zmeny stavu autentifikácie, nie riadiť presmerovanie počas registrácie.
        // Presmerovanie sa riadi v handleSubmit funkcii.
        setIsAuthReady(true); // Nastavíme, že autentifikácia je pripravená
      });

      return () => unsubscribe();
    } catch (error) {
      console.error("Chyba pri inicializácii Firebase v register.js:", error);
      setNotificationMessage('Chyba pri inicializácii aplikácie.');
      setShowNotification(true);
      setNotificationType('error');
    }
  }, []); // Odstránená závislosť isRegistering, pretože ref je okamžitý

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
            setNotificationType('error');
            setSettingsLoaded(true);
          });

          return () => unsubscribeSettings();
      } catch (e) {
          console.error("register.js: Chyba pri nastavovaní onSnapshot pre nastavenia registrácie:", e);
          setNotificationMessage(`Chyba pri nastavovaní poslucháča pre nastavenia: ${e.message}`);
          setShowNotification(true);
          setNotificationType('error');
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
    setNotificationType('info'); // Reset typu notifikácie
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
      setNotificationType('error');
      return null;
    }
    try {
      const token = await grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: action });
      return token;
    } catch (e) {
      console.error("Chyba pri získavaní reCAPTCHA tokenu:", e);
      setNotificationMessage(`Chyba reCAPTCHA: ${e.message}`);
      setShowNotification(true);
      setNotificationType('error');
      return null;
    }
  };

  const handleNext = async (e) => {
    e.preventDefault();
    setLoading(true);
    setNotificationMessage('');
    setShowNotification(false);
    setNotificationType('info');

    if (!isRecaptchaReady) {
      setNotificationMessage('reCAPTCHA sa ešte nenačítalo. Skúste to prosím znova.');
      setShowNotification(true);
      setNotificationType('error');
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setNotificationMessage('Heslá sa nezhodujú.');
      setShowNotification(true);
      setNotificationType('error');
      setLoading(false);
      return;
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(formData.password)) {
      setNotificationMessage('Heslo musí obsahovať aspoň jedno malé písmeno, jedno veľké písmeno a jednu číslicu.');
      setShowNotification(true);
      setNotificationType('error');
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
    setNotificationType('info');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setNotificationMessage('');
    setShowNotification(false);
    setNotificationType('info');
    setIsRegistering(true); // Nastavenie stavu pre re-render
    isRegisteringRef.current = true; // Okamžitá aktualizácia referencie pre onAuthStateChanged

    // Validácia fakturačných údajov
    const { clubName, ico, dic, icDph } = formData.billing;

    if (!clubName.trim()) {
        setNotificationMessage('Oficiálny názov klubu je povinný.');
        setShowNotification(true);
        setNotificationType('error');
        setLoading(false);
        setIsRegistering(false);
        isRegisteringRef.current = false;
        return;
    }

    if (!ico && !dic && !icDph) {
      setNotificationMessage('Musíte zadať aspoň jedno z polí IČO, DIČ alebo IČ DPH.');
      setShowNotification(true);
      setNotificationType('error');
      setLoading(false);
      setIsRegistering(false);
      isRegisteringRef.current = false;
      return;
    }

    if (icDph) {
      const icDphRegex = /^[A-Z]{2}[0-9]+$/;
      if (!icDphRegex.test(icDph)) {
        setNotificationMessage('IČ DPH musí začínať dvoma veľkými písmenami a nasledovať číslicami (napr. SK1234567890).');
        setShowNotification(true);
        setNotificationType('error');
        setLoading(false);
        setIsRegistering(false);
        isRegisteringRef.current = false;
        return;
      }
    }

    const postalCodeClean = formData.postalCode.replace(/\s/g, '');
    if (postalCodeClean.length !== 5 || !/^\d{5}$/.test(postalCodeClean)) {
      setNotificationMessage('PSČ musí mať presne 5 číslic.');
      setShowNotification(true);
      setNotificationType('error');
      setLoading(false);
      setIsRegistering(false);
      isRegisteringRef.current = false;
      return;
    }

    const fullPhoneNumber = `${selectedCountryDialCode}${formData.contactPhoneNumber}`;
    console.log("Konštruované telefónne číslo pre odoslanie:", fullPhoneNumber); // Logovanie telefónneho čísla

    try {
      if (!auth || !db) {
        setNotificationMessage('Firebase nie je inicializované. Skúste to prosím znova.');
        setShowNotification(true);
        setNotificationType('error');
        setLoading(false);
        setIsRegistering(false);
        isRegisteringRef.current = false;
        return;
      }

      // Získanie reCAPTCHA tokenu pre finálnu registráciu (klient-side overenie)
      const recaptchaToken = await getRecaptchaToken('register_user');
      if (!recaptchaToken) {
        setLoading(false);
        setIsRegistering(false);
        isRegisteringRef.current = false;
        return; // Zastav, ak token nebol získaný
      }
      console.log("reCAPTCHA Token pre registráciu používateľa získaný (klient-side overenie).");

      // 1. Vytvorenie používateľa vo Firebase Authentication
      const userCredential = await auth.createUserWithEmailAndPassword(formData.email, formData.password);
      const user = userCredential.user;

      if (!user || !user.uid) {
        console.error("register.js: Používateľský objekt je neplatný po vytvorení účtu. UID nie je k dispozícii.");
        setNotificationMessage('Chyba pri vytváraní používateľského účtu. Skúste to prosím znova.');
        setShowNotification(true);
        setNotificationType('error');
        setLoading(false);
        setIsRegistering(false);
        isRegisteringRef.current = false;
        return;
      }
      console.log("Používateľ vytvorený v Auth s UID:", user.uid);


      // 2. Uloženie používateľských údajov do Firestore
      // Zmenená cesta pre zápis do databázy na /users/{userId}
      const userDocRef = db.collection('users').doc(user.uid);

      console.log("register.js: Pokúšam sa zapísať údaje do Firestore pre UID:", user.uid, "do cesty:", userDocRef.path);
      await userDocRef.set({
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
        registrationDate: firebase.firestore.FieldValue.serverTimestamp(),
        passwordLastChanged: firebase.firestore.FieldValue.serverTimestamp(),
      });
      console.log("Údaje používateľa úspešne zapísané do Firestore.");

      // 3. Odoslanie registračného e-mailu cez Google Apps Script (no-cors)
      try {
          const payload = {
            action: 'sendRegistrationEmail',
            email: formData.email,
            firstName: formData.firstName,
            lastName: formData.lastName,
            contactPhoneNumber: fullPhoneNumber,
            isAdmin: false, // Toto nie je administrátorská registrácia
            billing: { // Pridanie fakturačných údajov
              clubName: formData.billing.clubName,
              ico: formData.billing.ico,
              dic: formData.billing.dic,
              icDph: formData.billing.icDph,
              address: { // Adresa pre fakturačné údaje
                street: formData.street,
                houseNumber: formData.houseNumber,
                zipCode: formData.postalCode,
                city: formData.city,
                country: formData.country
              }
            }
          };
          console.log("Odosielam registračný e-mail s payloadom:", JSON.stringify(payload, null, 2)); // Pridané logovanie payloadu
          const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
          });
          console.log("Požiadavka na odoslanie registračného e-mailu odoslaná (no-cors režim).");
          try {
            // V režime 'no-cors' je odpoveď 'opaque', takže text() alebo json() zlyhá.
            // Táto časť je tu len pre konzistentnosť s admin-register.js, ale nefunguje.
            const responseData = await response.text();
            console.log("Odpoveď z Apps Script (fetch - registračný e-mail) ako text:", responseData);
          } catch (jsonError) {
            console.warn("Nepodarilo sa analyzovať odpoveď z Apps Script (očakávané s 'no-cors' pre JSON):", jsonError);
          }
      } catch (emailError) {
          console.error("Chyba pri odosielaní registračného e-mailu cez Apps Script (chyba fetch):", emailError);
      }

      // Pridanie krátkeho oneskorenia, aby sa zabezpečilo spracovanie sieťových požiadaviek
      await new Promise(resolve => setTimeout(resolve, 200)); // Oneskorenie 200ms

      // Aktualizovaná správa po úspešnej registrácii
      setNotificationMessage(`Ďakujeme za Vašu registráciu na turnaj Slovak Open Handball. Potvrdenie o zaregistrovaní Vášho klubu bolo odoslané na e-mailovú adresu ${formData.email}.`);
      setShowNotification(true);
      setNotificationType('success'); // Nastavenie typu notifikácie na úspech
      setRegistrationSuccess(true); // Nastavenie stavu úspešnej registrácie

      // 5. Explicitne odhlásiť používateľa po úspešnej registrácii a uložení dát
      try {
        await auth.signOut();
        console.log("Používateľ úspešne odhlásený po registrácii.");
      } catch (signOutError) {
        console.error("Chyba pri odhlasovaní po registrácii:", signOutError);
      }

      // Vyčistiť formulár
      setFormData({
        firstName: '', lastName: '', email: '', contactPhoneNumber: '',
        password: '', confirmPassword: '', houseNumber: '', country: '',
        city: '', postalCode: '', street: '',
        billing: { clubName: '', ico: '', dic: '', icDph: '' }
      });
      setPage(1); // Reset na prvú stránku formulára

      // Presmerovanie na prihlasovaciu stránku po dlhšom oneskorení (aby sa správa zobrazila)
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 5000); // 5 sekúnd na zobrazenie notifikácie

    } catch (error) {
      console.error('Chyba počas registrácie alebo zápisu do Firestore:', error);
      let errorMessage = 'Registrácia zlyhala. Skúste to prosím neskôr.';

      if (error.code) {
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
              case 'permission-denied': // Špecifická chyba povolenia Firestore
                  errorMessage = 'Chyba databázy: Nemáte oprávnenie na zápis. Skontrolujte bezpečnostné pravidlá Firestore.';
                  break;
              default:
                  errorMessage = error.message || errorMessage;
                  break;
          }
      } else {
          errorMessage = error.message || errorMessage;
      }
      setNotificationMessage(errorMessage);
      setShowNotification(true);
      setNotificationType('error');
    } finally {
      setLoading(false);
      setIsRegistering(false); // Ukončenie procesu registrácie
      isRegisteringRef.current = false; // Reset referencie
    }
  };

  return React.createElement(
    'div',
    { className: 'min-h-screen flex items-center justify-center bg-gray-100 p-4' },
    // Notifikačné okno sa zobrazí LEN pre chyby alebo informačné správy, NIE pre úspešnú registráciu
    !registrationSuccess && React.createElement(NotificationModal, { message: notificationMessage, onClose: closeNotification, type: notificationType }),

    // Podmienečné renderovanie formulára alebo správy o úspechu
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
    ) : registrationSuccess ? (
      // Zobrazenie úspešnej správy namiesto formulára
      React.createElement(
        'div',
        { className: 'bg-green-700 text-white p-8 rounded-lg shadow-md w-full max-w-md text-center' }, // Zmenené pozadie na tmavšiu zelenú (green-700)
        React.createElement(
          'h2',
          { className: 'text-2xl font-bold mb-4 text-black' }, // Zmenená farba textu nadpisu na čiernu
          'Registrácia úspešná!'
        ),
        React.createElement(
          'p',
          { className: 'text-white' }, // Text zostáva biely pre kontrast
          notificationMessage // Zobrazí detailnú správu z notifikácie
        ),
        React.createElement(
          'p',
          { className: 'text-gray-200 text-sm mt-4' }, // Zmenená farba pre ľahšiu čitateľnosť na tmavšom zelenom pozadí
          'Budete automaticky presmerovaní na prihlasovaciu stránku.'
        )
      )
    ) : (
      // Zobrazenie formulára, ak registrácia nebola úspešná
      page === 1 ?
        React.createElement(Page1Form, {
          formData: formData,
          handleChange: handleChange,
          handleNext: handleNext,
          loading: loading,
          notificationMessage: notificationMessage, // Notifikácia sa riadi stavom App
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
          notificationMessage: notificationMessage, // Notifikácia sa riadi stavom App
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
