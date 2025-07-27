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

// Hlavný komponent aplikácie
function App() {
  const [page, setPage] = React.useState(1);
  const [formData, setFormData] = React.useState({
    firstName: '',
    lastName: '',
    email: '',
    contactPhoneNumber: '',
    password: '',
    confirmPassword: '',
    role: 'player', // Predvolená rola
    billingDetails: {
      companyName: '',
      ico: '',
      dic: '',
      icDph: '',
      street: '',
      city: '',
      postalCode: '',
      country: ''
    }
  });
  const [loading, setLoading] = React.useState(false);
  const [notificationMessage, setNotificationMessage] = React.useState('');
  const [notificationType, setNotificationType] = React.useState('success'); // Nový stav pre typ notifikácie
  const [selectedCountryDialCode, setSelectedCountryDialCode] = React.useState('+421'); // Predvolená predvoľba pre Slovensko
  const [isCountryCodeModalOpen, setIsCountryCodeModalOpen] = React.useState(false);
  const [isRegistrationOpen, setIsRegistrationOpen] = React.useState(null); // null = načítava sa, true/false = stav
  const [registrationStartDate, setRegistrationStartDate] = React.useState(null);
  const [countdown, setCountdown] = React.useState('');
  const [isRecaptchaReady, setIsRecaptchaReady] = React.useState(false);

  // Načítanie stavu registrácie z Google Apps Script
  React.useEffect(() => {
    const fetchRegistrationStatus = async () => {
      try {
        const response = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?action=getRegistrationStatus`);
        const data = await response.json();
        setIsRegistrationOpen(data.isOpen);
        setRegistrationStartDate(data.startDate); // Uložíme startDate
      } catch (error) {
        console.error('Chyba pri načítaní stavu registrácie:', error);
        setNotificationMessage('Chyba pri načítaní stavu registrácie.');
        setNotificationType('error'); // Nastavíme typ na chybu
        setIsRegistrationOpen(false); // V prípade chyby predpokladáme, že registrácia nie je otvorená
      }
    };

    fetchRegistrationStatus();
    // Refresh status every 5 minutes (adjust as needed)
    const interval = setInterval(fetchRegistrationStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Countdown timer effect
  React.useEffect(() => {
    let timer;
    if (isRegistrationOpen === false && registrationStartDate) {
      const calculateCountdown = () => {
        const now = new Date().getTime();
        const startDate = new Date(registrationStartDate).getTime();
        const distance = startDate - now;

        if (distance < 0) {
          setCountdown('');
          // Ak sa registrácia už mala začať, ale stav je stále false, vynútiť refresh
          if (isRegistrationOpen === false) {
            console.log("Countdown: Registrácia sa mala začať, vynucujem opätovné načítanie stavu.");
            // Môžete tu spustiť opätovné načítanie stavu alebo presmerovať
            // window.location.reload(); // Alebo len zmeniť stav na true, ak je to logické
          }
          return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        setCountdown(`${days}d ${hours}h ${minutes}m ${seconds}s`);
      };

      calculateCountdown(); // Initial call
      timer = setInterval(calculateCountdown, 1000);
    } else {
      setCountdown('');
    }

    return () => clearInterval(timer);
  }, [isRegistrationOpen, registrationStartDate]);

  // reCAPTCHA v3
  React.useEffect(() => {
    const loadRecaptcha = () => {
      if (typeof grecaptcha !== 'undefined' && grecaptcha.enterprise) {
        grecaptcha.enterprise.ready(function() {
          setIsRecaptchaReady(true);
          console.log("reCAPTCHA Enterprise je pripravená.");
        });
      } else {
        console.warn("reCAPTCHA Enterprise skript ešte nie je načítaný.");
      }
    };

    // Ak už je načítaný, zavoláme ho hneď, inak pridáme listener
    if (document.readyState === 'complete') {
      loadRecaptcha();
    } else {
      window.addEventListener('load', loadRecaptcha);
      return () => window.removeEventListener('load', loadRecaptcha);
    }
  }, []);

  const closeNotification = () => {
    setNotificationMessage('');
    setNotificationType('success'); // Reset na predvolený typ
  };

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleRoleChange = (role) => {
    setFormData(prev => ({ ...prev, role }));
  };

  const validatePage1 = () => {
    const { firstName, lastName, email, contactPhoneNumber, password, confirmPassword } = formData;

    if (!firstName || !lastName || !email || !contactPhoneNumber || !password || !confirmPassword) {
      setNotificationMessage('Prosím, vyplňte všetky povinné polia na prvej strane.');
      setNotificationType('error'); // Nastavíme typ na chybu
      return false;
    }

    if (password !== confirmPassword) {
      setNotificationMessage('Heslá sa nezhodujú.');
      setNotificationType('error'); // Nastavíme typ na chybu
      return false;
    }

    // Validácia hesla (rovnaká ako v PasswordInput)
    const passwordRules = [
      { text: 'aspoň 10 znakov', met: password.length >= 10 },
      { text: 'aspoň jedno malé písmeno', met: /[a-z]/.test(password) },
      { text: 'aspoň jedno veľké písmeno', met: /[A-Z]/.test(password) },
      { text: 'aspoň jednu číslicu', met: /\d/.test(password) },
    ];

    const allPasswordRulesMet = passwordRules.every(rule => rule.met);
    if (!allPasswordRulesMet) {
      setNotificationMessage('Heslo nespĺňa všetky požiadavky.');
      setNotificationType('error'); // Nastavíme typ na chybu
      return false;
    }

    return true;
  };

  const handleNext = (e) => {
    e.preventDefault();
    if (validatePage1()) {
      setPage(2);
      setNotificationMessage(''); // Vyčistíme notifikáciu pri prechode na ďalšiu stranu
      setNotificationType('success'); // Reset na predvolený typ
    }
  };

  const handlePrev = () => {
    setPage(1);
    setNotificationMessage(''); // Vyčistíme notifikáciu pri návrate
    setNotificationType('success'); // Reset na predvolený typ
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);
    setNotificationMessage('');
    setNotificationType('success'); // Reset na predvolený typ

    try {
      // Získanie reCAPTCHA tokenu
      const token = await grecaptcha.enterprise.execute(RECAPTCHA_SITE_KEY, { action: 'register' });

      const payload = {
        action: 'register',
        ...formData,
        contactPhoneNumber: selectedCountryDialCode + formData.contactPhoneNumber, // Spojíme predvoľbu a číslo
        recaptchaToken: token, // Pridáme reCAPTCHA token
      };

      const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (result.status === 'success') {
        setNotificationMessage('Registrácia bola úspešná! Skontrolujte si e-mail pre ďalšie inštrukcie.');
        setNotificationType('success'); // Nastavíme typ na úspech
        setPage(3); // Prechod na stránku úspešnej registrácie
        // Vyčistenie formulára po úspešnej registrácii
        setFormData({
          firstName: '',
          lastName: '',
          email: '',
          contactPhoneNumber: '',
          password: '',
          confirmPassword: '',
          role: 'player',
          billingDetails: {
            companyName: '',
            ico: '',
            dic: '',
            icDph: '',
            street: '',
            city: '',
            postalCode: '',
            country: ''
          }
        });
      } else {
        setNotificationMessage(result.message || 'Registrácia zlyhala. Skúste to prosím znova.');
        setNotificationType('error'); // Nastavíme typ na chybu
      }
    } catch (error) {
      console.error('Chyba pri odosielaní formulára:', error);
      setNotificationMessage('Nastala chyba pri odosielaní formulára. Skúste to prosím neskôr.');
      setNotificationType('error'); // Nastavíme typ na chybu
    } finally {
      setLoading(false);
    }
  };

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex items-center justify-center font-inter py-10 px-4 sm:px-6 lg:px-8' },
    React.createElement(
      NotificationModal,
      {
        message: notificationMessage,
        onClose: closeNotification,
        type: notificationType // Odovzdávame typ notifikácie
      }
    ),
    page === 3 ? (
      React.createElement(
        'div',
        { className: 'bg-white p-8 rounded-lg shadow-md w-full max-w-md text-center' },
        React.createElement('h2', { className: 'text-2xl font-bold text-green-600 mb-4' }, 'Registrácia úspešná!'),
        React.createElement('p', { className: 'text-gray-700 mb-6' }, 'Ďakujeme za vašu registráciu. Potvrdenie a ďalšie inštrukcie boli odoslané na vašu e-mailovú adresu.'),
        React.createElement(
          'a',
          {
            href: 'login.html',
            className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200 inline-block'
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
          userRole: formData.role, // Odovzdávame rolu z formData
          handleRoleChange: handleRoleChange,
          NotificationModal: NotificationModal,
        })
    )
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App, null));
