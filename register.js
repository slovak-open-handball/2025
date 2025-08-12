// register.js
// Hlavný súbor aplikácie, ktorý spravuje stav a orchestráciu medzi stránkami formulára.
// Táto verzia pridáva kontrolu na inicializáciu po prijatí globalDataUpdated a categoriesLoaded.
// NOVINKA: Pridaná logika pre automatické zatvorenie registrácie bez zobrazenia odpočtu.

// Tieto konštanty sú definované v <head> register.html a sú prístupné globálne.
const RECAPTCHA_SITE_KEY = "6LdJbn8rAAAAAO4C50qXTWva6ePzDlOfYwBDEDwa";
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec"; // Predpokladáme, že táto URL je správna pre Apps Script

// Import komponentov pre stránky formulára z ich samostatných súborov
import { Page1Form, PasswordInput, CountryCodeModal } from './register-page1.js';
import { Page2Form } from './register-page2.js';
import { Page3Form } from './register-page3.js'; // NOVINKA: Import pre Page3Form
import { Page4Form } from './register-page4.js'; // NOVINKA: Import pre Page4Form

// Importy pre potrebné Firebase funkcie (modulárna syntax v9)
// POZNÁMKA: initializeApp, getAuth, getFirestore nie sú tu importované, pretože sa očakávajú globálne.
import { onAuthStateChanged, signOut, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, doc, onSnapshot, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";


// Pomocná funkcia na formátovanie objektu Date do lokálneho reťazca 'YYYY-MM-DDTHH:mm'
const formatToDatetimeLocal = (date) => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = (date.getMinutes()).toString().padStart(2, '0');
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
  // NOVINKA: Stav pre dáta z Page3 (selectedCategoryRows)
  const [selectedCategoryRows, setSelectedCategoryRows] = React.useState([{ categoryId: '', teams: 1 }]);
  // NOVINKA: Stav pre dáta z Page4 (details o tímoch) - Teraz bude zdrojom pravdy pre Page4Form
  const [teamsDataFromPage4, setTeamsDataFromPage4] = React.useState({});

  const [userRole, setUserRole] = React.useState('user'); // Predvolená rola
  const [loading, setLoading] = React.useState(false);
  const [notificationMessage, setNotificationMessage] = React.useState('');
  const [showNotification, setShowNotification] = React.useState(false);
  const [notificationType, setNotificationType] = React.useState('info'); // Nový stav pre typ notifikácie
  const [isCountryCodeModalOpen, setIsCountryCodeModalOpen] = React.useState(false);
  const [selectedCountryDialCode, setSelectedCountryDialCode] = React.useState('+421');
  const [registrationSuccess, setRegistrationSuccess] = React.useState(false); // Nový stav pre úspešnú registráciu

  // Firebase stav - Spoliehame sa na globálne inštancie, len sledujeme pripravenosť
  const [isAuthReady, setIsAuthReady] = React.useState(false); 

  const [registrationStartDate, setRegistrationStartDate] = React.useState('');
  const [registrationEndDate, setRegistrationEndDate] = React.useState('');
  const [dataEditDeadline, setDataEditDeadline] = React.useState(''); 
  const [rosterEditDeadline, setRosterEditDeadline] = React.useState(''); 
  // NOVINKA: Stavy pre počet hráčov a členov realizačného tímu načítané z nastavení
  const [numberOfPlayersInTeam, setNumberOfPlayersInTeam] = React.useState(0);
  const [numberOfImplementationTeamMembers, setNumberOfImplementationTeamMembers] = React.useState(0);

  const [settingsLoaded, setSettingsLoaded] = React.useState(false);
  const [categoriesExist, setCategoriesExist] = React.useState(true); // NOVINKA: Stav pre existenciu kategórií
  const [categoriesDataFromFirestore, setCategoriesDataFromFirestore] = React.useState({}); // NOVINKA: Pre uloženie kategórií z Firestore

  // Nové stavy pre odpočet a vynútenie prepočtu
  const [countdown, setCountdown] = React.useState(null);
  const [forceRegistrationCheck, setForceRegistrationCheck] = React.useState(0);
  const [periodicRefreshKey, setPeriodicRefreshKey] = React.useState(0);

  // NOVINKA: Stav pre odpočet do konca registrácie
  const [countdownEnd, setCountdownEnd] = React.useState(null);
  const countdownEndIntervalRef = React.useRef(null);

  // Nový stav pre reCAPTCHA pripravenosť
  const [isRecaptchaReady, setIsRecaptchaReady] = React.useState(false);

  // Nový stav na indikáciu prebiehajúcej registrácie (používa sa aj ref pre okamžitý prístup)
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

  // NOVINKA: Stav pre kontrolu, či je registrácia už zatvorená (po dátume ukončenia)
  const isRegistrationClosed = React.useMemo(() => {
    if (!settingsLoaded) return false;
    const now = new Date();
    const regEnd = registrationEndDate ? new Date(registrationEndDate) : null;
    return regEnd instanceof Date && !isNaN(regEnd) && now > regEnd;
  }, [settingsLoaded, registrationEndDate, periodicRefreshKey]);

  // NOVINKA: Stav pre kontrolu, či je terajší čas skorší ako čas otvorenia registrácie
  const isBeforeRegistrationStart = React.useMemo(() => {
    if (!settingsLoaded) return false;
    const now = new Date();
    const regStart = registrationStartDate ? new Date(registrationStartDate) : null;
    return regStart instanceof Date && !isNaN(regStart) && now < regStart;
  }, [settingsLoaded, registrationStartDate, periodicRefreshKey]);


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
  
  // NOVÁ FUNKCIA: na výpočet zostávajúceho času do konca registrácie
  const calculateTimeLeftToEnd = React.useCallback(() => {
      const now = new Date();
      const endDate = registrationEndDate ? new Date(registrationEndDate) : null;

      if (!endDate || isNaN(endDate) || now >= endDate) {
          return null;
      }

      const difference = endDate.getTime() - now.getTime();

      if (difference <= 0) {
          return null;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  }, [registrationEndDate]);


  // Inicializácia autentifikácie (už sa nespúšťa initializeApp ani signIn, očakáva sa z globálu)
  React.useEffect(() => {
    if (window.showGlobalLoader) {
      window.showGlobalLoader();
    }

    try {
      // Skontrolujeme, či window.auth existuje, inak je to chyba v inicializácii register.html
      if (typeof window.auth === 'undefined') {
        console.error("register.js: window.auth nie je definované. Firebase Auth nebolo správne inicializované v register.html.");
        setNotificationMessage('Chyba pri inicializácii autentifikácie: Firebase Auth chýba.');
        setShowNotification(true);
        setNotificationType('error');
        if (window.hideGlobalLoader) {
          window.hideGlobalLoader();
        }
        return;
      }

      // Používame onAuthStateChanged z globálneho window.auth
      const unsubscribe = onAuthStateChanged(window.auth, (currentUser) => {
        setIsAuthReady(true); // Nastavíme, že autentifikácia je pripravená
        if (window.hideGlobalLoader) {
          window.hideGlobalLoader();
        }
        console.log("register.js: onAuthStateChanged - Auth je pripravené.");
      });

      return () => {
        unsubscribe();
        if (window.hideGlobalLoader) {
          window.hideGlobalLoader();
        }
      };
    } catch (error) {
      console.error("Chyba pri inicializácii Firebase Auth v register.js:", error);
      setNotificationMessage('Chyba pri inicializácii autentifikácie.');
      setShowNotification(true);
      setNotificationType('error');
      if (window.hideGlobalLoader) {
        window.hideGlobalLoader();
      }
    }
  }, []); // Závislosť [] pre spustenie len raz pri mountovaní

  // Načítanie a počúvanie stavu registrácie a kategórií z Firestore
  React.useEffect(() => {
    // Čakáme, kým bude FireStore DB pripravené a Auth bude pripravené
    if (typeof window.db === 'undefined' || !isAuthReady) {
      console.log("register.js: FireStore DB nie je definované alebo Auth nie je pripravené. Nezačínám načítavať nastavenia/kategórie.");
      return;
    }
    console.log("register.js: Načítavam nastavenia a kategórie z Firestore.");

    // Načítanie nastavení registrácie
    const settingsDocRef = doc(collection(window.db, 'settings'), 'registration');
    const unsubscribeSettings = onSnapshot(settingsDocRef, docSnapshot => {
      if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          setRegistrationStartDate(data.registrationStartDate ? formatToDatetimeLocal(data.registrationStartDate.toDate()) : '');
          setRegistrationEndDate(data.registrationEndDate ? formatToDatetimeLocal(data.registrationEndDate.toDate()) : '');
          setDataEditDeadline(data.dataEditDeadline ? formatToDatetimeLocal(data.dataEditDeadline.toDate()) : '');
          setRosterEditDeadline(data.rosterEditDeadline ? formatToDatetimeLocal(data.rosterEditDeadline.toDate()) : '');
          // NOVINKA: Načítanie počtu hráčov a členov realizačného tímu
          setNumberOfPlayersInTeam(data.numberOfPlayers || 0);
          setNumberOfImplementationTeamMembers(data.numberOfImplementationTeam || 0);
          console.log("register.js: Nastavenia registrácie úspešne načítané.");
      } else {
          console.warn("register.js: Nastavenia registrácie sa nenašli v Firestore. Používajú sa predvolené prázdne hodnoty.");
          setRegistrationStartDate('');
          setRegistrationEndDate('');
          setDataEditDeadline('');
          setRosterEditDeadline('');
          setNumberOfPlayersInTeam(0);
          setNumberOfImplementationTeamMembers(0);
      }
      setSettingsLoaded(true);
    }, error => {
      console.error("register.js: Chyba pri načítaní nastavení registrácie (onSnapshot):", error);
      setNotificationMessage(`Chyba pri načítaní nastavení: ${error.message}`);
      setShowNotification(true);
      setNotificationType('error');
      setSettingsLoaded(true);
    });

    // Načítanie kategórií
    const categoriesDocRef = doc(collection(window.db, 'settings'), 'categories');
    const unsubscribeCategories = onSnapshot(categoriesDocRef, docSnapshot => { 
      if (docSnapshot.exists() && Object.keys(docSnapshot.data()).length > 0) { 
        setCategoriesExist(true);
        setCategoriesDataFromFirestore(docSnapshot.data()); // Uložiť načítané kategórie
        console.log("register.js: Kategórie úspešne načítané.");
      } else {
        setCategoriesExist(false);
        setCategoriesDataFromFirestore({}); // Vyprázdniť kategórie
        console.warn("register.js: Kategórie sa nenašli v Firestore.");
      }
    }, error => {
      console.error("register.js: Chyba pri načítaní kategórií (onSnapshot):", error);
      // Ak nastane chyba pri načítaní kategórií, predpokladáme, že neexistujú
      setCategoriesExist(false); 
      setCategoriesDataFromFirestore({});
      setNotificationMessage(`Chyba pri načítaní kategórií: ${error.message}`);
      setShowNotification(true);
      setNotificationType('error');
    });


    return () => {
      unsubscribeSettings();
      unsubscribeCategories();
    };
  }, [isAuthReady]); // Zmenená závislosť na isAuthReady

  // Effect pre odpočet do začiatku registrácie
  React.useEffect(() => {
    const updateCountdown = () => {
        const timeLeft = calculateTimeLeft();
        setCountdown(timeLeft);
        if (timeLeft === null) {
            if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
            }
            // Vynútime prepočet stavu, aby sa aplikácia okamžite aktualizovala
            setForceRegistrationCheck(prev => prev + 1); 
        }
    };

    if (registrationStartDate && new Date(registrationStartDate) > new Date()) {
        updateCountdown();
        countdownIntervalRef.current = setInterval(updateCountdown, 1000);
    } else {
        setCountdown(null);
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
        }
    }

    return () => {
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
        }
    };
  }, [registrationStartDate, calculateTimeLeft]);

  // NOVINKA: Effect pre odpočet do konca registrácie
  React.useEffect(() => {
    const updateCountdownEnd = () => {
      const timeLeft = calculateTimeLeftToEnd();
      setCountdownEnd(timeLeft);
      if (timeLeft === null) {
          if (countdownEndIntervalRef.current) {
              clearInterval(countdownEndIntervalRef.current);
          }
          // Vynútime prepočet stavu, aby sa aplikácia okamžite aktualizovala
          setPeriodicRefreshKey(prev => prev + 1);
      }
    };

    if (registrationEndDate && new Date(registrationEndDate) > new Date()) {
        updateCountdownEnd();
        countdownEndIntervalRef.current = setInterval(updateCountdownEnd, 1000);
    } else {
        setCountdownEnd(null);
        if (countdownEndIntervalRef.current) {
            clearInterval(countdownEndIntervalRef.current);
        }
    }

    return () => {
        if (countdownEndIntervalRef.current) {
            clearInterval(countdownEndIntervalRef.current);
        }
    };
  }, [registrationEndDate, calculateTimeLeftToEnd]);

  // NOVINKA: Upravený useEffect pre periodickú aktualizáciu, teraz už je to len pre fallback
  React.useEffect(() => {
    const interval = setInterval(() => {
      setPeriodicRefreshKey(prev => prev + 1);
    }, 60 * 1000); // Každú minútu

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
        ...prev, // Zachovať ostatné polia formData
        billing: { // Aktualizovať iba billing objekt
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
    console.log("register.js: reCAPTCHA Token pre prechod stránky získaný (klient-side overenie).");
    setPage(2);
    setLoading(false); // Ukončiť načítavanie po prechode na ďalšiu stránku
  };

  // NOVINKA: Funkcia pre prechod z Page2 na Page3
  const handleNextPage2ToPage3 = async (e) => {
    e.preventDefault();
    setLoading(true);
    setNotificationMessage('');
    setShowNotification(false);
    setNotificationType('info');

    // Validácia fakturačných údajov (presunuté z handleFinalSubmit)
    const { clubName, ico, dic, icDph } = formData.billing;

    if (!clubName.trim()) {
        setNotificationMessage('Oficiálny názov klubu je povinný.');
        setShowNotification(true);
        setNotificationType('error');
        setLoading(false);
        return;
    }

    if (!ico && !dic && !icDph) {
      setNotificationMessage('Musíte zadať aspoň jedno z polí IČO, DIČ alebo IČ DPH.');
      setShowNotification(true);
      setNotificationType('error');
      setLoading(false);
      return;
    }

    if (icDph) {
      const icDphRegex = /^[A-Z]{2}[0-9]+$/;
      if (!icDphRegex.test(icDph)) {
        setNotificationMessage('IČ DPH musí začínať dvoma veľkými písmenami a nasledovať číslicami (napr. SK1234567890).');
        setShowNotification(true);
        setNotificationType('error');
        setLoading(false);
        return;
      }
    }

    const postalCodeClean = formData.postalCode.replace(/\s/g, '');
    if (postalCodeClean.length !== 5 || !/^\d{5}$/.test(postalCodeClean)) {
      setNotificationMessage('PSČ musí mať presne 5 číslic.');
      setShowNotification(true);
      setNotificationType('error');
      setLoading(false);
      return;
    }

    // Ak prejde validácia, prejdeme na stranu 3
    setPage(3);
    setLoading(false);
  };

  // NOVINKA: Funkcia pre prechod z Page3 na Page4
  const handleNextPage3ToPage4 = async (categoriesDataFromPage3) => {
    setLoading(true);
    setNotificationMessage('');
    setShowNotification(false);
    setNotificationType('info');

    // Transformačná logika pre dáta kategórií
    // Z selectedCategoryRows (formát z Page3: [{ categoryId: 'cat1_id', teams: 2 }, ...])
    // Prevedieme na formát pre Page4: { 'Názov Kategórie 1': { numberOfTeams: 2 }, 'Názov Kategórie 2': { numberOfTeams: 1 }, ... }
    const transformedCategories = {};
    categoriesDataFromPage3.forEach(row => {
        // Získame názov kategórie z categoriesDataFromFirestore
        const categoryName = categoriesDataFromFirestore[row.categoryId];
        if (categoryName) {
            transformedCategories[categoryName] = {
                numberOfTeams: row.teams
            };
        } else {
            console.warn(`register.js: Názov kategórie pre ID ${row.categoryId} sa nenašiel v categoriesDataFromFirestore.`);
        }
    });

    console.log("App.js: Transformed categories for Page4:", transformedCategories); // Logovanie transformovaných kategórií

    // NOVINKA: Inicializácia newTeamsDataForPage4 (jediný zdroj pravdy) priamo tu v App komponente
    const newTeamsDataForPage4 = {}; // Použijeme nový objekt, aby sme predišli priamym mutáciám
    const clubName = formData.billing.clubName || '';

    Object.keys(transformedCategories).forEach(categoryName => {
        const numTeams = transformedCategories[categoryName].numberOfTeams;
        newTeamsDataForPage4[categoryName] = Array.from({ length: numTeams }).map((_, teamIndex) => {
            const suffix = numTeams > 1 ? ` ${String.fromCharCode('A'.charCodeAt(0) + teamIndex)}` : '';
            const generatedTeamName = `${clubName}${suffix}`;
            
            // Zachovať existujúce dáta, ak už existujú pre túto kategóriu a index tímu
            // DÔLEŽITÉ: Použijeme existujúce teamsDataFromPage4 na záchranu už zadaných hodnôt
            const existingTeamData = teamsDataFromPage4[categoryName]?.[teamIndex] || {};

            return {
                teamName: generatedTeamName, // Vždy pregenerujte názov
                players: existingTeamData.players !== undefined ? existingTeamData.players : '', // Inicializácia na prázdny reťazec
                teamMembers: existingTeamData.teamMembers !== undefined ? existingTeamData.teamMembers : '', // Inicializácia na prázdny reťazec
                womenTeamMembers: existingTeamData.womenTeamMembers !== undefined ? existingTeamData.womenTeamMembers : '',
                menTeamMembers: existingTeamData.menTeamMembers !== undefined ? existingTeamData.menTeamMembers : '',
                // NOVINKA: Inicializácia tshirts pre každý tím
                tshirts: existingTeamData.tshirts && existingTeamData.tshirts.length > 0
                    ? existingTeamData.tshirts
                    : [{ size: '', quantity: '' }]
            };
        });
    });
    setTeamsDataFromPage4(newTeamsDataForPage4); // Nastavíme inicializované dáta tímov

    setFormData(prev => ({
        ...prev,
        categories: transformedCategories // Uloženie transformovaných kategórií
    }));

    // Prejdeme na stranu 4
    setPage(4);
    setLoading(false);
  };

  const handlePrev = () => {
    setPage(prevPage => prevPage - 1); // Upravené pre prechod na predchádzajúcu stránku
    setNotificationMessage('');
    setShowNotification(false);
    setNotificationType('info');
  };

  // NOVINKA: Pôvodná handleSubmit premenovaná na handleFinalSubmit
  const handleFinalSubmit = async (teamsDataToSave) => { // Prijíma finálne dáta tímov z Page4Form
    setLoading(true);
    setNotificationMessage('');
    setShowNotification(false);
    setNotificationType('info');
    isRegisteringRef.current = true; // Okamžitá aktualizácia referencie pre onAuthStateChanged

    const fullPhoneNumber = `${selectedCountryDialCode} ${formData.contactPhoneNumber}`;
    console.log("App.js: Konštruované telefónne číslo pre odoslanie (finálne):", fullPhoneNumber); // Logovanie telefónneho čísla

    try {
      // Prístup ku globálnym inštanciám Firebase Auth a Firestore
      const authInstance = window.auth;
      const firestoreDb = window.db;

      if (!authInstance || !firestoreDb) {
        console.error("App.js: === KRITICKÁ CHYBA === Firebase Auth (window.auth) alebo Firestore (window.db) nie sú GLOBÁLNE dostupné PRI ODOSTLANÍ. authInstance:", authInstance, "firestoreDb:", firestoreDb);
        setNotificationMessage('Kritická chyba: Firebase SDK nie je inicializované. Skúste to prosím znova alebo kontaktujte podporu.');
        setShowNotification(true);
        setNotificationType('error');
        return; 
      }
      console.log("App.js: Firebase Auth a Firestore sú dostupné a pripravené.");

      let recaptchaToken = null;
      try {
        recaptchaToken = await getRecaptchaToken('register_user');
        if (!recaptchaToken) {
          console.warn("App.js: reCAPTCHA Token nebol získaný. Zastavujem registráciu.");
          setNotificationMessage('Overenie reCAPTCHA zlyhalo. Skúste to prosím znova.');
          setShowNotification(true);
          setNotificationType('error');
          return; 
        }
        console.log("App.js: reCAPTCHA Token pre registráciu používateľa získaný.");
      } catch (recaptchaError) {
          console.error("App.js: Chyba pri získavaní reCAPTCHA tokenu:", recaptchaError);
          setNotificationMessage(`Chyba reCAPTCHA: ${recaptchaError.message || "Neznáma chyba."}`);
          setShowNotification(true);
          setNotificationType('error');
          return;
      }

      console.log("App.js: Pokúšam sa vytvoriť používateľa v Authentication...");
      let user = null;
      try {
        const userCredential = await createUserWithEmailAndPassword(authInstance, formData.email, formData.password);
        user = userCredential.user;

        if (!user || !user.uid) {
          console.error("App.js: Používateľský objekt je neplatný po vytvorení účtu. UID nie je k dispozícii.");
          setNotificationMessage('Chyba pri vytváraní používateľského účtu (UID chýba). Skúste to prosím znova.');
          setShowNotification(true);
          setNotificationType('error');
          return; 
        }
        console.log("App.js: Používateľ úspešne vytvorený v Auth s UID:", user.uid);

      } catch (authError) {
          console.error("App.js: Chyba pri vytváraní používateľa v Authentication:", authError);
          let authErrorMessage = 'Chyba pri vytváraní používateľského účtu. Skúste to prosím znova.';
          if (authError.code) {
              switch (authError.code) {
                  case 'auth/email-already-in-use':
                      authErrorMessage = 'Zadaná e-mailová adresa je už používaná.';
                      break;
                  case 'auth/invalid-email':
                      authErrorMessage = 'Neplatný formát e-mailovej adresy.';
                      break;
                  case 'auth/weak-password':
                      authErrorMessage = 'Heslo je príliš slabé. Použite silnejšie heslo.';
                      break;
                  default:
                      authErrorMessage = authError.message || authErrorMessage;
                      break;
              }
          } else {
              authErrorMessage = authError.message || authErrorMessage;
          }
          setNotificationMessage(authErrorMessage);
          setShowNotification(true);
          setNotificationType('error');
          return;
      }

      const userDocRef = doc(collection(firestoreDb, 'users'), user.uid);
      console.log("App.js: Pokúšam sa zapísať údaje do Firestore pre UID:", user.uid, "do cesty:", userDocRef.path);
      try {
        await setDoc(userDocRef, {
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
          role: userRole,
          approved: true,
          registrationDate: serverTimestamp(),
          passwordLastChanged: serverTimestamp(),
          categories: formData.categories,
          teams: teamsDataToSave,
        });
        console.log("App.js: Údaje používateľa úspešne zapísané do Firestore.");
      } catch (firestoreError) {
          console.error("App.js: Chyba pri zápise údajov do Firestore:", firestoreError);
          let firestoreErrorMessage = 'Chyba pri ukladaní údajov. Skontrolujte bezpečnostné pravidlá Firestore.';
          if (firestoreError.code === 'permission-denied') {
              firestoreErrorMessage = 'Chyba databázy: Nemáte oprávnenie na zápis. Skontrolujte bezpečnostné pravidlá Firestore.';
          } else {
              firestoreErrorMessage = firestoreError.message || firestoreErrorMessage;
          }
          setNotificationMessage(firestoreErrorMessage);
          setShowNotification(true);
          setNotificationType('error');
          // Dôležité: Ak zápis do Firestore zlyhá, odstráňte používateľa z Auth, aby ste predišli osiroteným účtom.
          try {
              if (user && authInstance && authInstance.currentUser && authInstance.currentUser.uid === user.uid) {
                  await authInstance.currentUser.delete(); // Odstráňte používateľa z Auth
                  console.warn("App.js: Používateľ z Auth bol odstránený kvôli zlyhaniu zápisu do Firestore.");
              } else {
                console.warn("App.js: Používateľ z Auth nebol odstránený po zlyhaní zápisu do Firestore (buď neexistuje, alebo bol už odhlásený/zmenený).");
              }
          } catch (deleteError) {
              console.error("App.js: Chyba pri odstraňovaní používateľa z Auth po zlyhaní Firestore zápisu:", deleteError);
          }
          return;
      }

      console.log("App.js: Pokúšam sa odoslať registračný e-mail.");
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
            },
            categories: formData.categories, // Pridanie kategórií do emailu
            teams: teamsDataToSave, // NOVINKA: Pridanie finálnych dát o tímoch do emailu
          };
          console.log("App.js: Odosielam registračný e-mail s payloadom:", JSON.stringify(payload, null, 2)); // Pridané logovanie payloadu
          const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors', // Opaque response
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
          });
          console.log("App.js: Požiadavka na odoslanie registračného e-mailu odoslaná (no-cors režim).");
          // V režime 'no-cors' je odpoveď 'opaque', takže response.text() alebo response.json() zlyhá.
          // Tieto riadky sú tu pre logovanie pokusu, ale neočakáva sa plná odpoveď.
          console.log("App.js: Ak je 'no-cors' režim, výsledok fetchu nemusí byť dostupný. Pokračujem.");
      } catch (emailError) {
          console.error("App.js: Chyba pri odosielaní registračného e-mailu cez Apps Script (chyba fetch):", emailError);
          // Návrat z funkcie kvôli zlyhaniu emailu by nebol správny, pretože registrácia už prebehla
      }

      // Pridanie krátkeho oneskorenia, aby sa zabezpečilo spracovanie sieťových požiadaviek
      await new Promise(resolve => setTimeout(resolve, 200)); // Oneskorenie 200ms

      // Aktualizovaná správa po úspešnej registrácii
      setNotificationMessage(`Ďakujeme za registráciu na turnaj Slovak Open Handball. Potvrdenie o zaregistrovaní Vášho klubu bolo odoslané na e-mailovú adresu ${formData.email}.`);
      setShowNotification(true);
      setNotificationType('success'); // Nastavenie typu notifikácie na úspech
      setRegistrationSuccess(true); // Nastavenie stavu úspešnej registrácie

      // 5. Explicitne odhlásiť používateľa po úspešnej registrácii a uložení dát
      console.log("App.js: Registrácia úspešná, pokúšam sa odhlásiť používateľa.");
      try {
        if (authInstance && authInstance.currentUser) { // Skontrolujte, či existuje prihlásený používateľ
          await signOut(authInstance); // Používame globálnu inštanciu Firebase Auth
          console.log("App.js: Používateľ úspešne odhlásený po registrácii.");
        } else {
          console.warn("App.js: Používateľ nebol prihlásený alebo už bol odhlásený, preskakujem odhlásenie.");
        }
      } catch (signOutError) {
        console.error("App.js: Chyba pri odhlasovaní po registrácii:", signOutError);
      }

      // Vyčistiť formulár
      console.log("App.js: Resetujem formulárové dáta a presmerovávam na prihlasovaciu stránku.");
      setFormData({
        firstName: '', lastName: '', email: '', contactPhoneNumber: '',
        password: '', confirmPassword: '', houseNumber: '', country: '',
        city: '', postalCode: '', street: '',
        billing: { clubName: '', ico: '', dic: '', icDph: '' }
      });
      // NOVINKA: Vyčistenie stavu selectedCategoryRows a teamsDataFromPage4
      setSelectedCategoryRows([{ categoryId: '', teams: 1 }]);
      setTeamsDataFromPage4({}); // Vyčistíme aj dáta tímov
      setPage(1); // Reset na prvú stránku formulára

      // Presmerovanie na prihlasovaciu stránku po dlhšom oneskorení (aby sa správa zobrazila)
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 20000); // 20 sekúnd na zobrazenie notifikácie

    } catch (globalError) { // Záchytný blok pre akékoľvek neočakávané chyby
      console.error('App.js: NEČAKANÁ CHYBA POČAS REGISTRÁCIE (pravdepodobne z chyby Promise mimo priameho await):', globalError);
      let errorMessage = 'Registrácia zlyhala neočakávanou chybou. Skúste to prosím neskôr.';
      // Tu môžete pridať ďalšie podmienky pre globalError.code, ak je to potrebné
      setNotificationMessage(errorMessage);
      setShowNotification(true);
      setNotificationType('error');
    } finally {
      setLoading(false);
      isRegisteringRef.current = false; // Reset referencie
      console.log("App.js: handleFinalSubmit finished.");
    }
  };

  return React.createElement(
    'div',
    { className: 'min-h-screen flex items-center justify-center bg-gray-100 p-4' },
    // Notifikačné okno sa zobrazí LEN pre chyby alebo informačné správy, NIE pre úspešnú registráciu
    !registrationSuccess && React.createElement(NotificationModal, { message: notificationMessage, onClose: closeNotification, type: notificationType }),

    // Podmienečné renderovanie formulára alebo správy o úspechu
    // Používame globálny loader namiesto lokálneho spinneru
    !settingsLoaded || !isAuthReady ? (
      // Zobrazenie správy o načítavaní, kým sa aplikácia nenačíta
      React.createElement(
        'div',
        { className: 'bg-white p-8 rounded-lg shadow-md w-full max-w-md text-center' },
        React.createElement(
          'p',
          { className: 'text-gray-600 text-lg font-semibold' },
          'Načítava sa aplikácia...'
        )
      )
    ) : registrationSuccess ? (
      // Zobrazenie úspešnej správy namiesto formulára
      React.createElement(
        'div',
        { className: 'bg-green-700 text-white p-8 rounded-lg shadow-md w-full max-w-md text-center' }, // Zmenené pozadie na tmavšiu zelenú (green-700)
        React.createElement(
          'h2',
          { className: 'text-2xl font-bold mb-4 text-white' }, // Text nadpisu zostáva biely pre lepší kontrast
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
          'O pár sekúnd prebehne automatické presmerovanie na prihlasovaciu stránku.'
        )
      )
    ) : (
      // NOVINKA: Podmienené zobrazenie správy o kategóriách/registrácii
      (!categoriesExist && (isBeforeRegistrationStart || isRegistrationOpen)) ? (
        React.createElement(
          'div',
          { className: 'bg-white p-8 rounded-lg shadow-md w-full max-w-md text-center' },
          React.createElement(
            'p',
            { className: 'text-red-600 text-lg font-semibold' },
            'Nie je možné sa zaregistrovať na turnaj Slovak Open Handball, pretože v systéme nie sú definované žiadne kategórie.'
          )
        )
      ) : (
        // Zobrazenie formulára, ak registrácia nebola úspešná
        page === 1 ?
          React.createElement(
            'div', // Obalový div pre Page1Form
            { className: 'bg-white p-8 rounded-lg shadow-md w-full max-w-md' },
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
              isRegistrationClosed: isRegistrationClosed, // Odovzdávame stav registrácie
              registrationEndDate: registrationEndDate // NOVINKA: Odovzdávame registrationEndDate
            })
          ) :
        page === 2 ? // NOVINKA: Kontrola pre stranu 2
          React.createElement(
            'div', // Obalový div pre Page2Form
            { className: 'bg-white p-8 rounded-lg shadow-md w-full max-w-md' },
            React.createElement(Page2Form, {
              formData: formData,
              handleChange: handleChange,
              handlePrev: handlePrev,
              // NOVINKA: Zmena handleSubmit na handleNextPage2ToPage3 pre prechod na stranu 3
              handleSubmit: handleNextPage2ToPage3, 
              loading: loading,
              notificationMessage: notificationMessage, // Notifikácia sa riadi stavom App
              closeNotification: closeNotification,
              userRole: userRole,
              handleRoleChange: handleRoleChange,
              NotificationModal: NotificationModal,
            })
          ) :
        page === 3 ? // NOVINKA: Zobrazenie Page3Form
            React.createElement(
                'div', // Obalový div pre Page3Form
                { className: 'bg-white p-8 rounded-lg shadow-md w-full max-w-md' },
                React.createElement(Page3Form, {
                    formData: formData,
                    handlePrev: handlePrev,
                    handleNextPage3: handleNextPage3ToPage4, // NOVINKA: Prop pre prechod na stranu 4
                    loading: loading,
                    setLoading: setLoading, // Page3Form bude spravovať svoj loading stav
                    notificationMessage: notificationMessage,
                    setShowNotification: setShowNotification,
                    setNotificationType: setNotificationType,
                    setRegistrationSuccess: setRegistrationSuccess,
                    isRecaptchaReady: isRecaptchaReady,
                    selectedCountryDialCode: selectedCountryDialCode,
                    NotificationModal: NotificationModal,
                    availableCategoriesMap: categoriesDataFromFirestore, // Odovzdanie načítaných kategórií do Page3Form
                    selectedCategoryRows: selectedCategoryRows, // NOVINKA: Odovzdanie stavu pre kategórie
                    setSelectedCategoryRows: setSelectedCategoryRows, // NOVINKA: Odovzdanie setter funkcie
                })
            ) :
        page === 4 ? // NOVINKA: Zobrazenie Page4Form
            React.createElement(
                'div', // Obalový div pre Page4Form
                { className: 'bg-white p-8 rounded-lg shadow-md w-full max-w-md' },
                React.createElement(Page4Form, {
                    formData: formData, // formData obsahuje selectedCategoryRows ako formData.categories
                    handlePrev: handlePrev,
                    handleSubmit: handleFinalSubmit, // Finálne odoslanie formulára
                    loading: loading,
                    setLoading: setLoading,
                    notificationMessage: notificationMessage,
                    setShowNotification: setShowNotification,
                    setNotificationType: setNotificationType,
                    setRegistrationSuccess: setRegistrationSuccess,
                    isRecaptchaReady: isRecaptchaReady,
                    selectedCountryDialCode: selectedCountryDialCode,
                    NotificationModal: NotificationModal,
                    numberOfPlayersLimit: numberOfPlayersInTeam, // NOVINKA: Limit pre hráčov
                    numberOfTeamMembersLimit: numberOfImplementationTeamMembers, // NOVINKA: Limit pre členov realizačného tímu
                    teamsDataFromPage4: teamsDataFromPage4, // DÔLEŽITÉ: Posielame aktuálny stav dát tímov
                    setTeamsDataFromPage4: setTeamsDataFromPage4, // Setter pre dáta tímov
                    closeNotification: closeNotification, // Odovzdanie closeNotification do Page4Form
                })
            ) : null
      )
    )
  );
}

// Premenná na sledovanie, či už bola aplikácia inicializovaná
let appInitialized = false;
// Premenná na sledovanie, či už bola udalosť globalDataUpdated prijatá
let globalDataUpdatedReceived = false;
// NOVINKA: Premenná na sledovanie, či už bola udalosť categoriesLoaded prijatá
let categoriesLoadedReceived = false;

// Funkcia na inicializáciu a renderovanie React aplikácie
function initializeRegistrationApp() {
  if (appInitialized) {
    console.log("register.js: Aplikácia už bola inicializovaná, preskakujem.");
    return;
  }
  
  // NOVINKA: Kombinovaná kontrola pre obe udalosti
  if (!globalDataUpdatedReceived || !categoriesLoadedReceived) {
    console.log("register.js: Čakám na všetky potrebné udalosti ('globalDataUpdated' a 'categoriesLoaded')...");
    return;
  }

  const rootElement = document.getElementById('root');
  if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    appInitialized = true; // Označíme ako inicializované hneď, aby sa predišlo opakovanému vstupu

    // Priame vykreslenie React aplikácie
    root.render(React.createElement(App, null));
    console.log("register.js: React aplikácia úspešne inicializovaná a renderovaná.");

  } else {
    console.error("register.js: Element s ID 'root' nebol nájdený. React aplikácia nemôže byť renderovaná.");
  }
}

// Počúvame na udalosť 'globalDataUpdated', ktorá je odoslaná z authentication.js
window.addEventListener('globalDataUpdated', () => {
  console.log("register.js: Prijatá udalosť 'globalDataUpdated'.");
  globalDataUpdatedReceived = true; // Označíme, že udalosť bola prijatá
  initializeRegistrationApp();
});

// NOVINKA: Počúvame na udalosť 'categoriesLoaded', ktorá je odoslaná z header.js
window.addEventListener('categoriesLoaded', () => {
  console.log("register.js: Prijatá udalosť 'categoriesLoaded'.");
  categoriesLoadedReceived = true; // Označíme, že kategórie boli prijaté
  initializeRegistrationApp();
});


// NOVINKA: Ak sa stránka načíta po tom, čo už boli odoslané obe udalosti, inicializujeme aplikáciu okamžite.
// Toto je záložná možnosť, ak sa udalosti spustia skôr, ako React component začne počúvať.
if (window.isGlobalAuthReady && window.areCategoriesLoaded) {
  console.log("register.js: Všetky globálne dáta a kategórie sú už inicializované. Spúšťam React aplikáciu okamžite.");
  globalDataUpdatedReceived = true;
  categoriesLoadedReceived = true;
  initializeRegistrationApp();
}
