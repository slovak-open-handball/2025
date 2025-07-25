// register.js
// Hlavný súbor aplikácie, ktorý spravuje stav a orchestráciu medzi stránkami formulára.

// Global application ID a Firebase konfigurácia (mali by byť konzistentné naprieč všetkými React aplikáciami)
// Tieto konštanty sú definované v <head> register.html a sú prístupné globálne.
const RECAPTCHA_SITE_KEY = "6LdJbn8rAAAAAO4C50qXTWva6ePzDlOfYwBDEDwa";
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec";

// ODSTRÁNENÉ: Firebase SDKs importy, pretože sa teraz načítavajú globálne cez script tagy v HTML
// import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
// import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
// import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Import komponentov pre stránky formulára
// Tieto súbory musia byť tiež upravené, aby nepoužívali modulárne importy Firebase,
// ale pristupovali k nemu globálne, ak by ho potrebovali.
// V tomto prípade sú Page1Form a Page2Form len UI komponenty, takže ich importy sú v poriadku.
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
  const [isRegistrationOpen, setIsRegistrationOpen] = React.useState(null); // null pre načítavanie, true/false po kontrole
  const [countdownMessage, setCountdownMessage] = React.useState(''); // Nový stav pre správu odpočtu

  // Recaptcha ref
  const recaptchaRef = React.useRef(null);
  const countdownIntervalRef = React.useRef(null); // Ref pre uloženie ID intervalu odpočtu

  // Inicializácia Firebase a autentifikácie
  React.useEffect(() => {
    try {
      // Skontrolujte, či je Firebase SDK načítané
      if (typeof firebase === 'undefined' || typeof firebase.firestore === 'undefined' || typeof firebase.auth === 'undefined') {
        console.error("register.js: Firebase SDK nie je načítané alebo nie sú dostupné všetky moduly. Uistite sa, že sú script tagy Firebase v HTML.");
        setNotificationMessage('Chyba pri inicializácii aplikácie: Firebase SDK chýba.');
        setShowNotification(true);
        return;
      }

      let firebaseApp;
      // Ak už predvolená aplikácia existuje (napr. inicializovaná header.js), použite ju
      if (firebase.apps.length > 0 && firebase.app().name === '[DEFAULT]') {
          firebaseApp = firebase.app();
          console.log("register.js: Používam existujúcu Firebase App inštanciu.");
      } else {
          // Inak inicializujte novú aplikáciu
          const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
          firebaseApp = firebase.initializeApp(firebaseConfig);
          console.log("register.js: Inicializujem novú Firebase App inštanciu.");
      }
      
      const firestoreDb = firebase.firestore(firebaseApp);
      const firebaseAuth = firebase.auth(firebaseApp);

      setDb(firestoreDb);
      setAuth(firebaseAuth);

      // Používame firebaseAuth.onAuthStateChanged namiesto onAuthStateChanged (z importu)
      const unsubscribe = firebaseAuth.onAuthStateChanged(async (currentUser) => {
        if (!currentUser && typeof __initial_auth_token !== 'undefined') {
          try {
            await firebaseAuth.signInWithCustomToken(__initial_auth_token);
          } catch (error) {
            console.error("Chyba pri prihlásení s vlastným tokenom:", error);
            try {
              await firebaseAuth.signInAnonymously();
            } catch (anonError) {
              console.error("Chyba pri anonymnom prihlásení:", anonError);
            }
          }
        } else if (!currentUser) {
          try {
            await firebaseAuth.signInAnonymously();
          } catch (anonError) {
            console.error("Chyba pri anonymnom prihlásení:", anonError);
            }
          }
        setIsAuthReady(true); // Stav autentifikácie je teraz známy
      });

      return () => unsubscribe();
    } catch (error) {
      console.error("Chyba pri inicializácii Firebase v register.js:", error);
      setNotificationMessage('Chyba pri inicializácii aplikácie.');
      setShowNotification(true);
    }
  }, []); // Spustí sa raz pri pripojení komponentu

  // Načítanie a počúvanie stavu registrácie z Firestore
  React.useEffect(() => {
    if (!db || !isAuthReady) {
      return; // Čakajte, kým sa Firebase inicializuje a stav autentifikácie bude pripravený
    }

    // Cesta k dokumentu nastavení registrácie, zosúladená s header.js a screenshotom
    // Dokument je v kolekcii 'settings' s ID 'registration'
    const docRef = db.collection('settings').doc('registration');

    // Nastavenie poslucháča v reálnom čase pre nastavenia registrácie
    // Používame docRef.onSnapshot namiesto onSnapshot (z importu)
    const unsubscribe = docRef.onSnapshot((docSnap) => {
      // --- DEBUGGING LOGS ---
      console.log("register.js: Inside onSnapshot callback. Received docSnap:", docSnap);
      console.log("register.js: Type of docSnap:", typeof docSnap);
      if (docSnap) {
        console.log("register.js: docSnap.exists property type:", typeof docSnap.exists);
        // This check will confirm if docSnap is indeed a DocumentSnapshot from Firebase
        console.log("register.js: docSnap instanceof firebase.firestore.DocumentSnapshot:", docSnap instanceof firebase.firestore.DocumentSnapshot);
      }
      // --- END DEBUGGING LOGS ---

      // Získanie aktuálneho času v UTC milisekundách pre presné porovnanie
      const nowUtcMs = Date.now(); 
      let isOpen = true;
      let msg = '';

      // Vždy vyčistite existujúci interval pri každej zmene stavu registrácie
      if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
      }
      setCountdownMessage(''); // Reset správy odpočtu

      // Robustnejšia kontrola, či je docSnap platný DocumentSnapshot
      if (docSnap && typeof docSnap.exists === 'function' && docSnap instanceof firebase.firestore.DocumentSnapshot) {
        if (docSnap.exists()) {
          const data = docSnap.data();
          // Konverzia dátumov z Firestore Timestamp na UTC milisekundy
          const registrationStartDateMs = data.registrationStartDate ? data.registrationStartDate.toMillis() : null;
          const registrationEndDateMs = data.registrationEndDate ? data.registrationEndDate.toMillis() : null;

          // Kontrola platnosti dátumov a stavu registrácie
          const isRegStartValid = registrationStartDateMs !== null && !isNaN(registrationStartDateMs);
          const isRegEndValid = registrationEndDateMs !== null && !isNaN(registrationEndDateMs);

          if (isRegStartValid && nowUtcMs < registrationStartDateMs) {
            isOpen = false;
            msg = 'Registrácia ešte nezačala.';
            
            // Spustenie odpočtu
            const updateCountdown = () => {
                const remainingMs = registrationStartDateMs - Date.now();
                if (remainingMs <= 0) {
                    clearInterval(countdownIntervalRef.current);
                    countdownIntervalRef.current = null;
                    setCountdownMessage('');
                    // Ak odpočet skončil, znovu vyhodnoťte stav registrácie (spustí sa onSnapshot)
                    // Toto zabezpečí automatické sprístupnenie formulára
                } else {
                    const seconds = Math.floor((remainingMs / 1000) % 60);
                    const minutes = Math.floor((remainingMs / (1000 * 60)) % 60);
                    const hours = Math.floor((remainingMs / (1000 * 60 * 60)) % 24);
                    const days = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
                    setCountdownMessage(`Otvorenie o: ${days}d ${hours}h ${minutes}m ${seconds}s`);
                }
            };

            updateCountdown(); // Prvé volanie pre okamžité zobrazenie
            countdownIntervalRef.current = setInterval(updateCountdown, 1000); // Aktualizácia každú sekundu

          } else if (isRegEndValid && nowUtcMs > registrationEndDateMs) {
            isOpen = false;
            const endDate = new Date(registrationEndDateMs);
            // Formátovanie dátumu a času pre zobrazenie
            const formattedEndDate = `${endDate.toLocaleDateString('sk-SK')} ${endDate.toLocaleTimeString('sk-SK')}`;
            msg = `Registrácia je momentálne uzavretá. Ukončená: ${formattedEndDate}.`;
          } else if (!isRegStartValid && !isRegEndValid) {
            // Ak nie sú definované ani začiatok ani koniec, registrácia je otvorená
            isOpen = true;
            msg = 'Nastavenia registrácie neboli nájdené. Registrácia je predvolene otvorená.';
            console.warn("Nastavenia registrácie neboli nájdené vo Firestore. Predvolene otvorená registrácia.");
          } else if (!isRegStartValid && isRegEndValid && nowUtcMs <= registrationEndDateMs) {
            // Ak je definovaný len koniec a aktuálny čas je pred ním
            isOpen = true;
            msg = '';
          } else if (isRegStartValid && !isRegEndValid && nowUtcMs >= registrationStartDateMs) {
            // Ak je definovaný len začiatok a aktuálny čas je po ňom
            isOpen = true;
            msg = '';
          }
          // Ak sú oba definované a aktuálny čas je medzi nimi, isOpen zostáva true
          // Ak sú oba definované a aktuálny čas je mimo, už to bolo spracované vyššie
          
        } else { // docSnap exists() is false, meaning the document does not exist
          // Ak dokument nastavení neexistuje, predpokladajte, že registrácia je predvolene otvorená
          isOpen = true;
          msg = 'Nastavenia registrácie neboli nájdené. Registrácia je predvolene otvorená.';
          console.warn("Nastavenia registrácie neboli nájdené vo Firestore. Predvolene otvorená registrácia.");
        }
      } else { // docSnap is not a valid DocumentSnapshot or is null/undefined
        console.error("register.js: Invalid docSnap received by onSnapshot:", docSnap);
        // Fallback to open registration in case of unexpected snapshot format
        isOpen = true;
        msg = 'Chyba pri načítaní nastavení registrácie. Registrácia je predvolene otvorená.';
        setShowNotification(true); // Zobraziť upozornenie
      }

      setIsRegistrationOpen(isOpen);
      setNotificationMessage(msg);
      setShowNotification(msg !== ''); // Zobraziť upozornenie iba ak existuje správa
    }, (error) => {
      console.error("Chyba pri počúvaní zmien stavu registrácie:", error);
      setNotificationMessage('Chyba pri aktualizácii stavu registrácie v reálnom čase.');
      setShowNotification(true);
      setIsRegistrationOpen(true); // Núdzové riešenie na otvorenie v prípade chyby
    });

    return () => {
        unsubscribe(); // Vyčistiť poslucháča pri odpojení komponentu
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current); // Vyčistiť aj interval odpočtu
        }
    };
  }, [db, isAuthReady]); // Závisí od db a isAuthReady

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
        countdownMessage: countdownMessage, // Odovzdanie správy odpočtu
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
      }),
    // reCAPTCHA skript - zabezpečte, aby bol načítaný raz a bol globálne dostupný
    React.createElement('script', { src: `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`, async: true, defer: true }),
    React.createElement('div', { id: 'recaptcha-badge', className: 'g-recaptcha', 'data-sitekey': RECAPTCHA_SITE_KEY, 'data-size': 'invisible', 'data-callback': 'onRecaptchaSuccess', 'data-badge': 'bottomleft' })
  );
}

// Zabezpečenie vykreslenia komponentu App
// Používame ReactDOM.createRoot pre React 18
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App, null));
