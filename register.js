// register.js
// Hlavný súbor aplikácie, ktorý spravuje stav a orchestráciu medzi stránkami formulára.

// Tieto konštanty sú definované v <head> register.html a sú prístupné globálne.
const RECAPTCHA_SITE_KEY = "6LdJbn8rAAAAAO4C50qXTWva6ePzDlOfYwBDEDwa";
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec"; // Predpokladáme, že táto URL je správna pre Apps Script

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

// NotificationModal Component for displaying temporary messages (converted to React.createElement)
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

// Import komponentov pre stránky formulára z ich samostatných súborov
// Predpokladáme, že tieto súbory budú existovať vedľa register.js
// Ak ich nemáte, budete ich musieť vytvoriť s obsahom uvedeným nižšie.
import { Page1Form, PasswordInput, CountryCodeModal } from './register-page1.js';
import { Page2Form } from './register-page2.js';


// Hlavný komponent aplikácie
function App() {
  const [page, setPage] = React.useState(1);
  const [formData, setFormData] = React.useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    contactPhoneNumber: '',
    adminCode: '',
    userRole: 'user', // Predvolená rola
    approved: false, // Predvolený stav schválenia
    isAdmin: false, // Indikátor, či ide o registráciu admina
    billing: { // Fakturačné údaje
      companyName: '',
      street: '',
      city: '',
      postalCode: '',
      ico: '',
      dic: '',
      icDph: '',
    },
  });
  const [loading, setLoading] = React.useState(false);
  const [registrationSuccess, setRegistrationSuccess] = React.useState(false);
  const [notificationMessage, setNotificationMessage] = React.useState('');
  const [selectedCountryDialCode, setSelectedCountryDialCode] = React.useState('+421'); // Predvolený kód pre Slovensko
  const [isRegistrationOpen, setIsRegistrationOpen] = React.useState(true); // Predvolene otvorená
  const [registrationStartDate, setRegistrationStartDate] = React.useState(null);
  const [countdown, setCountdown] = React.useState('');
  const [isRecaptchaReady, setIsRecaptchaReady] = React.useState(false);


  // Načítanie stavu registrácie a dátumu uzávierky z Firestore
  React.useEffect(() => {
    const db = firebase.firestore();
    const settingsDocRef = db.collection('artifacts').doc('appId').collection('public').doc('data').collection('settings').doc('registration');

    const unsubscribe = settingsDocRef.onSnapshot(doc => {
      if (doc.exists) {
        const data = doc.data();
        setIsRegistrationOpen(data.isOpen);
        setRegistrationStartDate(data.startDate ? data.startDate.toDate() : null);
      } else {
        console.log("Dokument nastavení registrácie neexistuje.");
        setIsRegistrationOpen(true); // Predvolene otvorená, ak nastavenia chýbajú
      }
    }, error => {
      console.error("Chyba pri načítaní nastavení registrácie:", error);
      setNotificationMessage('Chyba pri načítaní nastavení registrácie.');
      setIsRegistrationOpen(true); // Predvolene otvorená v prípade chyby
    });

    return () => unsubscribe();
  }, []);

  // Odpočítavanie do začiatku registrácie
  React.useEffect(() => {
    let timer;
    if (registrationStartDate && !isRegistrationOpen) {
      timer = setInterval(() => {
        const now = new Date();
        const diff = registrationStartDate.getTime() - now.getTime();

        if (diff <= 0) {
          setIsRegistrationOpen(true);
          setCountdown('');
          clearInterval(timer);
        } else {
          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
          const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);
          setCountdown(`Registrácia začína o: ${days}d ${hours}h ${minutes}m ${seconds}s`);
        }
      }, 1000);
    }

    return () => clearInterval(timer);
  }, [registrationStartDate, isRegistrationOpen]);

  // ReCAPTCHA inicializácia
  React.useEffect(() => {
    if (typeof grecaptcha !== 'undefined' && grecaptcha.enterprise) {
      grecaptcha.enterprise.ready(function() {
        setIsRecaptchaReady(true);
        console.log("reCAPTCHA Enterprise je pripravená.");
      });
    } else {
      console.warn("reCAPTCHA Enterprise API nie je načítané.");
    }
  }, []);


  const handleChange = (e) => {
    const { id, value, type, checked } = e.target;

    if (id.startsWith('billing.')) {
      const billingField = id.split('.')[1];
      setFormData(prev => ({
        ...prev,
        billing: {
          ...prev.billing,
          [billingField]: value,
        },
      }));
    } else if (type === 'checkbox') {
      setFormData(prev => ({
        ...prev,
        [id]: checked,
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [id]: value,
      }));
    }
  };

  const handleNext = () => {
    setPage(2);
    setNotificationMessage(''); // Vyčisti notifikáciu pri prechode na ďalšiu stránku
  };

  const handlePrev = () => {
    setPage(1);
    setNotificationMessage(''); // Vyčisti notifikáciu pri návrate
  };

  const closeNotification = () => {
    setNotificationMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setNotificationMessage('');

    if (!isRegistrationOpen) {
      setNotificationMessage('Registrácia je momentálne uzavretá.');
      setLoading(false);
      return;
    }

    // Overenie reCAPTCHA tokenu pred odoslaním
    if (!isRecaptchaReady) {
      setNotificationMessage('reCAPTCHA nie je pripravená. Skúste to prosím znova.');
      setLoading(false);
      return;
    }

    try {
      const recaptchaToken = await grecaptcha.enterprise.execute(RECAPTCHA_SITE_KEY, { action: 'register' });
      console.log("reCAPTCHA token získaný.");

      // Získanie referencie na Firebase Auth
      const auth = firebase.auth();
      const db = firebase.firestore();

      // 1. Vytvorenie používateľa vo Firebase Authentication
      const userCredential = await auth.createUserWithEmailAndPassword(formData.email, formData.password);
      const user = userCredential.user;
      console.log("Používateľ vytvorený vo Firebase Auth:", user.uid);

      // 2. Uloženie profilových dát do Firestore
      const userDocRef = db.collection('users').doc(user.uid);
      const passwordLastChanged = firebase.firestore.Timestamp.now(); // Zaznamenaj čas zmeny hesla
      
      await userDocRef.set({
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        contactPhoneNumber: selectedCountryDialCode + formData.contactPhoneNumber.replace(/\s/g, ''), // Uložiť číslo bez medzier
        role: formData.userRole,
        approved: formData.userRole === 'user' ? true : false, // Používatelia sú automaticky schválení, admini nie
        registrationDate: firebase.firestore.FieldValue.serverTimestamp(),
        passwordLastChanged: passwordLastChanged, // Uložiť čas zmeny hesla
        billing: formData.billing, // Uložiť celý billing objekt
      });
      console.log("Profilové dáta uložené do Firestore.");

      // Uložiť čas zmeny hesla aj do localStorage
      localStorage.setItem(`passwordLastChanged_${user.uid}`, passwordLastChanged.toDate().getTime().toString());


      // 3. Odoslanie e-mailu cez Google Apps Script
      const dataToSend = {
        action: 'registerUser',
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        contactPhoneNumber: selectedCountryDialCode + formData.contactPhoneNumber.replace(/\s/g, ''), // Poslať číslo bez medzier
        adminCode: formData.adminCode,
        role: formData.userRole,
        approved: formData.userRole === 'user' ? true : false,
        isAdmin: formData.isAdmin,
        gRecaptchaToken: recaptchaToken,
        billing: formData.billing, // Posielame celý billing objekt
      };

      const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8', // Dôležité pre Apps Script
        },
        body: JSON.stringify(dataToSend),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Chyba z Apps Scriptu:", errorText);
        throw new Error(`Chyba pri odosielaní e-mailu: ${errorText}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || 'Nepodarilo sa odoslať e-mail.');
      }

      setRegistrationSuccess(true);
      setNotificationMessage('Registrácia bola úspešná! Skontrolujte si e-mail pre potvrdenie.');

    } catch (error) {
      console.error("Chyba pri registrácii:", error);
      let errorMessage = 'Chyba pri registrácii. Skúste to prosím znova.';
      if (error.code) {
        switch (error.code) {
          case 'auth/email-already-in-use':
            errorMessage = 'E-mail je už zaregistrovaný. Použite iný e-mail alebo sa prihláste.';
            break;
          case 'auth/invalid-email':
            errorMessage = 'Neplatný formát e-mailu.';
            break;
          case 'auth/weak-password':
            errorMessage = 'Heslo je príliš slabé.';
            break;
          case 'auth/network-request-failed':
            errorMessage = 'Chyba siete. Skontrolujte pripojenie.';
            break;
          default:
            errorMessage = `Chyba pri registrácii: ${error.message}`;
        }
      } else if (error.message.includes("reCAPTCHA")) {
        errorMessage = "Chyba reCAPTCHA overenia. Skúste to prosím znova.";
      } else if (error.message.includes("Nepodarilo sa odoslať e-mail.")) {
        errorMessage = "Registrácia bola úspešná, ale nepodarilo sa odoslať potvrdzovací e-mail. Skúste sa prihlásiť.";
      }
      setNotificationMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return React.createElement(
    'div',
    { className: 'flex justify-center items-start min-h-screen pt-10 pb-10' }, // Zmenené na items-start a pridané pt-10 pb-10
    registrationSuccess ? (
      React.createElement(
        'div',
        { className: 'bg-white p-8 rounded-lg shadow-xl text-center max-w-md w-full' },
        React.createElement('h2', { className: 'text-2xl font-bold text-green-600 mb-4' }, 'Registrácia úspešná!'),
        React.createElement('p', { className: 'text-gray-700 mb-6' }, 'Ďakujeme za vašu registráciu. Potvrdzovací e-mail bol odoslaný na vašu adresu.'),
        React.createElement(
          'a',
          {
            href: 'login.html',
            className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200'
          },
          'Prejsť na prihlásenie'
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
          NotificationModal: NotificationModal, // Pass NotificationModal
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
          userRole: formData.userRole, // Pass userRole from formData
          handleRoleChange: (e) => handleChange({ target: { id: 'userRole', value: e.target.value } }), // Update userRole
          NotificationModal: NotificationModal, // Pass NotificationModal
        })
    )
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App, null));
