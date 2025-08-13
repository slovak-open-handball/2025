// register.js
// Hlavný súbor aplikácie, ktorý spravuje stav a orchestráciu medzi stránkami formulára.
// Táto verzia pridáva kontrolu na inicializáciu po prijatí globalDataUpdated a categoriesLoaded.
// NOVINKA: Pridaná logika pre automatické zatvorenie registrácie bez zobrazenia odpočtu.

// Tieto konštanty sú definované v <head> register.html a sú prístupné globálne.
const RECAPTCHA_SITE_KEY = "6LdJbn8rAAAAAO4C50qXTWva6ePzDlOfYwBDEDwa";
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec";

// Import komponentov pre stránky formulára z ich samostatných súborov
import { Page1Form, PasswordInput, CountryCodeModal } from './register-page1.js';
import { Page2Form } from './register-page2.js';
import { Page3Form } from './register-page3.js';
import { Page4Form } from './register-page4.js';
import { Page5Form } from './register-page5.js';
import { Page6Form } from './register-page6.js'; // NOVINKA: Import pre Page6Form

// Importy pre potrebné Firebase funkcie (modulárna syntax v9)
// POZNÁMKA: initializeApp, getAuth, getFirestore nie sú tu importované, pretože sa očakávajú globálne.
import { onAuthStateChanged, signOut, createUserWithEmailAndPassword } => "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, doc, onSnapshot, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";


// Pomocná funkcia na formátovanie objektu Date do lokálneho reťazca 'YYYY-MM-DDTHH:mm'
const formatToDatetimeLocal = (date) => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = (date.getHours()).toString().padStart(2, '0');
  const minutes = (date.getMinutes()).toString().padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// NotificationModal Component pre zobrazovanie dočasných správ (teraz už NIE JE definovaný tu, ale v Page5Form a Page6Form)
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

  let bgColorClass;
  if (type === 'success') {
    bgColorClass = 'bg-green-500';
  } else if (type === 'error') {
    bgColorClass = 'bg-red-600';
  } else {
    bgColorClass = 'bg-blue-500';
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
    // accommodation, arrival, packageId, packageDetails are now per-team in teamsDataFromPage4
  });
  const [selectedCategoryRows, setSelectedCategoryRows] = React.useState([{ categoryId: '', teams: 1 }]);
  const [teamsDataFromPage4, setTeamsDataFromPage4] = React.useState({});

  const [userRole, setUserRole] = React.useState('user');
  const [loading, setLoading] = React.useState(false);

  // Notifikačné stavy zostávajú v App komponente pre jeho vlastné notifikácie
  const [notificationMessage, setNotificationMessage] = React.useState('');
  const [showNotification, setShowNotification] = React.useState(false);
  const [notificationType, setNotificationType] = React.useState('info');

  const [isCountryCodeModalOpen, setIsCountryCodeModalOpen] = React.useState(false);
  const [selectedCountryDialCode, setSelectedCountryDialCode] = React.useState('+421');
  const [registrationSuccess, setRegistrationSuccess] = React.useState(false);

  const [isAuthReady, setIsAuthReady] = React.useState(false);

  const [registrationStartDate, setRegistrationStartDate] = React.useState('');
  const [registrationEndDate, setRegistrationEndDate] = React.useState('');
  const [dataEditDeadline, setDataEditDeadline] = React.useState('');
  const [rosterEditDeadline, setRosterEditDeadline] = React.useState('');
  const [numberOfPlayersInTeam, setNumberOfPlayersInTeam] = React.useState(0);
  const [numberOfImplementationTeamMembers, setNumberOfImplementationTeamMembers] = React.useState(0);

  const [settingsLoaded, setSettingsLoaded] = React.useState(false);
  const [categoriesExist, setCategoriesExist] = React.useState(true);
  const [categoriesDataFromFirestore, setCategoriesDataFromFirestore] = React.useState({});

  const [countdown, setCountdown] = React.useState(null);
  const [forceRegistrationCheck, setForceRegistrationCheck] = React.useState(0);
  const [periodicRefreshKey, setPeriodicRefreshKey] = React.useState(0);

  const [countdownEnd, setCountdownEnd] = React.useState(null);
  const countdownEndIntervalRef = React.useRef(null);

  const [isRecaptchaReady, setIsRecaptchaReady] = React.useState(false);

  const isRegisteringRef = React.useRef(false);

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

  const isRegistrationClosed = React.useMemo(() => {
    if (!settingsLoaded) return false;
    const now = new Date();
    const regEnd = registrationEndDate ? new Date(registrationEndDate) : null;
    return regEnd instanceof Date && !isNaN(regEnd) && now > regEnd;
  }, [settingsLoaded, registrationEndDate, periodicRefreshKey]);

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


  React.useEffect(() => {
    if (window.showGlobalLoader) {
      window.showGlobalLoader();
    }

    try {
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

      const unsubscribe = onAuthStateChanged(window.auth, (currentUser) => {
        setIsAuthReady(true);
        if (window.hideGlobalLoader) {
          window.hideGlobalLoader();
        }
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
  }, []);

  React.useEffect(() => {
    if (typeof window.db === 'undefined' || !isAuthReady) {
      return;
    }

    const settingsDocRef = doc(collection(window.db, 'settings'), 'registration');
    const unsubscribeSettings = onSnapshot(settingsDocRef, docSnapshot => {
      if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          setRegistrationStartDate(data.registrationStartDate ? formatToDatetimeLocal(data.registrationStartDate.toDate()) : '');
          setRegistrationEndDate(data.registrationEndDate ? formatToDatetimeLocal(data.registrationEndDate.toDate()) : '');
          setDataEditDeadline(data.dataEditDeadline ? formatToDatetimeLocal(data.dataEditDeadline.toDate()) : '');
          setRosterEditDeadline(data.rosterEditDeadline ? formatToDatetimeLocal(data.rosterEditDeadline.toDate()) : '');
          setNumberOfPlayersInTeam(data.numberOfPlayers || 0);
          setNumberOfImplementationTeamMembers(data.numberOfImplementationTeam || 0);

      } else {
          setRegistrationStartDate('');
          setRegistrationEndDate('');
          setDataEditDeadline('');
          setRosterEditDeadline('');
          setNumberOfPlayersInTeam(0);
          setNumberOfImplementationTeamMembers(0);
      }
      setSettingsLoaded(true);
    }, error => {
      setNotificationMessage(`Chyba pri načítaní nastavení: ${error.message}`);
      setShowNotification(true);
      setNotificationType('error');
      setSettingsLoaded(true);
    });

    const categoriesDocRef = doc(collection(window.db, 'settings'), 'categories');
    const unsubscribeCategories = onSnapshot(categoriesDocRef, docSnapshot => {
      if (docSnapshot.exists() && Object.keys(docSnapshot.data()).length > 0) {
        setCategoriesExist(true);
        setCategoriesDataFromFirestore(docSnapshot.data());
      } else {
        setCategoriesExist(false);
        setCategoriesDataFromFirestore({});
      }
    }, error => {
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
  }, [isAuthReady]);

  React.useEffect(() => {
    const updateCountdown = () => {
        const timeLeft = calculateTimeLeft();
        setCountdown(timeLeft);
        if (timeLeft === null) {
            if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
            }
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

  React.useEffect(() => {
    const updateCountdownEnd = () => {
      const timeLeft = calculateTimeLeftToEnd();
      setCountdownEnd(timeLeft);
      if (timeLeft === null) {
          if (countdownEndIntervalRef.current) {
              clearInterval(countdownEndIntervalRef.current);
          }
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

  React.useEffect(() => {
    const interval = setInterval(() => {
      setPeriodicRefreshKey(prev => prev + 1);
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    const checkRecaptcha = () => {
      if (window.grecaptcha && window.grecaptcha.ready) {
        window.grecaptcha.ready(() => {
          setIsRecaptchaReady(true);
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
    setNotificationType('info');
  };

  // Funkcia pre odosielanie notifikácií pre App komponent a Page1/Page2
  const dispatchAppNotification = React.useCallback((message, type = 'info') => {
    setNotificationMessage(message);
    setShowNotification(true);
    setNotificationType(type);
  }, [setNotificationMessage, setShowNotification, setNotificationType]);

  // HandleChange pre hlavné formData a teamsDataFromPage4
  const handleChange = (e) => {
    const { id, value } = e.target;

    if (id === 'teamsDataFromPage4') {
        // Spracovanie aktualizácií prichádzajúcich z TeamAccommodationAndArrival a TeamPackageSettings
        setTeamsDataFromPage4(prevTeamsData => {
            const newTeamsData = { ...prevTeamsData };
            // Ensure category and team objects exist before updating
            if (!newTeamsData[value.categoryName]) {
                newTeamsData[value.categoryName] = [];
            }
            if (!newTeamsData[value.categoryName][value.teamIndex]) {
                newTeamsData[value.categoryName][value.teamIndex] = {};
            }
            // Aktualizujeme konkrétne pole tímu
            newTeamsData[value.categoryName][value.teamIndex] = {
                ...newTeamsData[value.categoryName][value.teamIndex],
                [value.field]: value.data
            };
            return newTeamsData;
        });
    } else if (id === 'billing') {
      // Pôvodná logika pre fakturačné údaje
      setFormData(prev => ({
        ...prev,
        billing: {
          ...(prev.billing || {}), // Zabezpečí inicializáciu billing, ak chýba
          ...value // value je už objekt {id: newValue}
        }
      }));
    } else {
      // Pôvodná logika pre ostatné polia vo formData
      setFormData(prev => ({ ...prev, [id]: value }));
    }
  };


  const handleRoleChange = (e) => {
    setUserRole(e.target.value);
  };

  const getRecaptchaToken = async (action) => {
    if (typeof grecaptcha === 'undefined' || !grecaptcha.execute) {
      dispatchAppNotification("reCAPTCHA API nie je načítané alebo pripravené.", 'error');
      return null;
    }
    try {
      // Oprava: Zmena RECAPTcha_SITE_KEY na RECAPTCHA_SITE_KEY
      const token = await grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: action });
      return token;
    } catch (e) {
      dispatchAppNotification(`Chyba reCAPTCHA: ${e.message}`, 'error');
      return null;
    }
  };

  const handleNext = async (e) => {
    e.preventDefault();
    setLoading(true);
    dispatchAppNotification('', 'info'); // Vynulovanie notifikácií

    if (!isRecaptchaReady) {
      dispatchAppNotification('reCAPTCHA sa ešte nenačítalo. Skúste to prosím znova.', 'error');
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      dispatchAppNotification('Heslá sa nezhodujú.', 'error');
      setLoading(false);
      return;
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(formData.password)) {
      dispatchAppNotification('Heslo musí obsahovať aspoň jedno malé písmeno, jedno veľké písmeno a jednu číslicu.', 'error');
      setLoading(false);
      return;
    }

    const recaptchaToken = await getRecaptchaToken('page_transition');
    if (!recaptchaToken) {
        setLoading(false);
        return;
    }
    setPage(2);
    setLoading(false);
  };

  const handleNextPage2ToPage3 = async (e) => {
    e.preventDefault();
    setLoading(true);
    dispatchAppNotification('', 'info'); // Vynulovanie notifikácií

    const { clubName, ico, dic, icDph } = formData.billing;

    if (!clubName.trim()) {
        dispatchAppNotification('Oficiálny názov klubu je povinný.', 'error');
        setLoading(false);
        return;
    }

    if (!ico.trim()) {
      dispatchAppNotification('IČO je povinné.', 'error');
      setLoading(false);
      return;
    }

    if (icDph) {
      const icDphRegex = /^[A-Z]{2}[0-9]+$/;
      if (!icDphRegex.test(icDph)) {
        dispatchAppNotification('IČ DPH musí zažínať dvoma veľkými písmenami a nasledovať číslicami (napr. SK1234567890).', 'error');
        setLoading(false);
        return;
      }
    }

    const postalCodeClean = formData.postalCode.replace(/\s/g, '');
    if (postalCodeClean.length !== 5 || !/^\d{5}$/.test(postalCodeClean)) {
      dispatchAppNotification('PSČ musí mať presne 5 číslic.', 'error');
      setLoading(false);
      return;
    }

    setPage(3);
    setLoading(false);
  };

  const handleNextPage3ToPage4 = async (categoriesDataFromPage3) => {
    setLoading(true);
    dispatchAppNotification('', 'info'); // Vynulovanie notifikácií

    const transformedCategories = {};
    categoriesDataFromPage3.forEach(row => {
        const categoryName = categoriesDataFromFirestore[row.categoryId];
        if (categoryName) {
            transformedCategories[categoryName] = {
                numberOfTeams: row.teams
            };
        } else {
            console.warn(`register.js: Názov kategórie pre ID ${row.categoryId} sa nenašiel v categoriesDataFromFirestore.`);
        }
    });

    const newTeamsDataForPage4 = {};
    const clubName = formData.billing.clubName || '';

    Object.keys(transformedCategories).forEach(categoryName => {
        const numTeams = transformedCategories[categoryName].numberOfTeams;
        newTeamsDataForPage4[categoryName] = Array.from({ length: numTeams }).map((_, teamIndex) => {
            const suffix = numTeams > 1 ? ` ${String.fromCharCode('A'.charCodeAt(0) + teamIndex)}` : '';
            const generatedTeamName = `${clubName}${suffix}`;

            // Načítame existujúce dáta tímu pre zachovanie (ak existujú)
            const existingTeamData = teamsDataFromPage4[categoryName]?.[teamIndex] || {};

            return {
                teamName: generatedTeamName,
                players: existingTeamData.players !== undefined ? existingTeamData.players : '',
                teamMembers: existingTeamData.teamMembers !== undefined ? existingTeamData.teamMembers : '',
                womenTeamMembers: existingTeamData.womenTeamMembers !== undefined ? existingTeamData.womenTeamMembers : '',
                menTeamMembers: existingTeamData.menTeamMembers !== undefined ? existingTeamData.menTeamMembers : '',
                tshirts: existingTeamData.tshirts && existingTeamData.tshirts.length > 0
                    ? existingTeamData.tshirts
                    : [{ size: '', quantity: '' }],
                // NOVINKA: Inicializácia dát pre Page 5 (ubytovanie, príchod, balíček)
                accommodation: existingTeamData.accommodation || { type: '' },
                arrival: existingTeamData.arrival || { type: '', time: null },
                packageId: existingTeamData.packageId || '',
                packageDetails: existingTeamData.packageDetails || null
            };
        });
    });
    setTeamsDataFromPage4(newTeamsDataForPage4);

    setFormData(prev => ({
        ...prev,
        categories: transformedCategories
    }));

    setPage(4);
    setLoading(false);
  };

  const handleNextPage4ToPage5 = async (teamsDataFromPage4Final) => {
    setLoading(true);
    dispatchAppNotification('', 'info'); // Vynulovanie notifikácií

    setTeamsDataFromPage4(teamsDataFromPage4Final);

    setPage(5);
    setLoading(false);
  };

  // NOVINKA: Funkcia na prechod z Page 5 na Page 6
  const handleNextPage5ToPage6 = async () => {
    setLoading(true);
    dispatchAppNotification('', 'info'); // Vynulovanie notifikácií

    // Validácia Page5 (ubytovanie a príchod) sa vykoná priamo v Page5Form
    // Pokiaľ by tu bola nejaká dodatočná validácia, pridajte ju sem.

    setPage(6); // Prechod na Page 6 (súhrn)
    setLoading(false);
  };

  const handlePrev = () => {
    setPage(prevPage => prevPage - 1);
    dispatchAppNotification('', 'info'); // Vynulovanie notifikácií
  };

  // NOVINKA: Nová funkcia pre finálne odoslanie registrácie (volaná z Page6Form)
  const confirmFinalRegistration = async () => {
    setLoading(true);
    dispatchAppNotification('', 'info'); // Vynulovanie notifikácií
    isRegisteringRef.current = true;

    const fullPhoneNumber = `${selectedCountryDialCode}${formData.contactPhoneNumber}`;

    try {
      const authInstance = window.auth;
      const firestoreDb = window.db;

      if (!authInstance || !firestoreDb) {
        dispatchAppNotification('Kritická chyba: Firebase SDK nie je inicializované. Skúste to prosím znova alebo kontaktujte podporu.', 'error');
        return;
      }

      let recaptchaToken = null;
      try {
        recaptchaToken = await getRecaptchaToken('register_user');
        if (!recaptchaToken) {
          dispatchAppNotification('Overenie reCAPTCHA zlyhalo. Skúste to prosím znova.', 'error');
          return;
        }
      } catch (recaptchaError) {
          dispatchAppNotification(`Chyba reCAPTCHA: ${recaptchaError.message || "Neznáma chyba."}`, 'error');
          return;
      }

      let user = null;
      try {
        const userCredential = await createUserWithEmailAndPassword(authInstance, formData.email, formData.password);
        user = userCredential.user;

        if (!user || !user.uid) {
          dispatchAppNotification('Chyba pri vytváraní používateľského účtu (UID chýba). Skúste to prosím znova.', 'error');
          return;
        }

      } catch (authError) {
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
          dispatchAppNotification(authErrorMessage, 'error');
          return;
      }

      const userDocRef = doc(collection(firestoreDb, 'users'), user.uid);
      try {
        const teamsDataToSaveFinal = JSON.parse(JSON.stringify(teamsDataFromPage4));
        for (const categoryName in teamsDataToSaveFinal) {
            teamsDataToSaveFinal[categoryName] = teamsDataToSaveFinal[categoryName].map(team => ({
                ...team,
                players: team.players === '' ? 0 : team.players,
                womenTeamMembers: team.womenTeamMembers === '' ? 0 : team.womenTeamMembers,
                menTeamMembers: team.menTeamMembers === '' ? 0 : team.menTeamMembers,
                tshirts: team.tshirts.map(tshirt => ({
                    ...tshirt,
                    quantity: tshirt.quantity === '' ? 0 : tshirt.quantity
                })),
                // Konverzia a uloženie dát Page 5 (ubytovanie, príchod, balíček)
                accommodation: team.accommodation || { type: 'Bez ubytovania' },
                arrival: {
                    type: team.arrival?.type || 'bez dopravy',
                    time: team.arrival?.time || null
                },
                packageId: team.packageId || '',
                packageDetails: team.packageDetails || null
            }));
        }

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
          teams: teamsDataToSaveFinal, // Uložíme celú štruktúru s dátami Page 5
        });
      } catch (firestoreError) {
          let firestoreErrorMessage = 'Chyba pri ukladaní údajov. Skontrolujte bezpečnostné pravidlá Firestore.';
          if (firestoreError.code === 'permission-denied') {
              firestoreErrorMessage = 'Chyba databázy: Nemáte oprávnenie na zápis. Skontrolujte bezpečnostné pravidlá Firestore.';
          } else {
              firestoreErrorMessage = firestoreError.message || firestoreErrorMessage;
          }
          dispatchAppNotification(firestoreErrorMessage, 'error');
          try {
              if (user && authInstance && authInstance.currentUser && authInstance.currentUser.uid === user.uid) {
                  await authInstance.currentUser.delete();
              }
          } catch (deleteError) {
          }
          return;
      }

      // Volanie Google Apps Scriptu na odoslanie e-mailu
      // POZNÁMKA: Pri mode: 'no-cors' prehliadač nedokáže čítať odpoveď zo servera,
      // takže nemôžeme potvrdiť úspešnosť odoslania e-mailu na strane klienta.
      // E-mailová funkcia by mala byť odladená a testovaná na strane Apps Scriptu.
      try {
          const payload = {
            action: 'sendRegistrationEmail',
            email: formData.email,
            firstName: formData.firstName,
            lastName: formData.lastName,
            contactPhoneNumber: fullPhoneNumber,
            isAdmin: false,
            billing: {
              clubName: formData.billing.clubName,
              ico: formData.billing.ico,
              dic: formData.billing.dic,
              icDph: formData.billing.icDph,
              address: {
                street: formData.street,
                houseNumber: formData.houseNumber,
                zipCode: formData.postalCode,
                city: formData.city,
                country: formData.country
              }
            },
            categories: formData.categories,
            teams: teamsDataToSaveFinal, // Odosielame celú štruktúru tímov s novými dátami
          };
          const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors', // Zachovanie no-cors režimu
            headers: {
              'Content-Type': 'application/json', // Táto hlavička je prehliadačom ignorovaná v no-cors režime
            },
            body: JSON.stringify(payload)
          });
          // Vzhľadom na 'no-cors' režim nemôžeme overiť 'response.ok' ani čítať 'response.json()'.
          // Ak sa sem dostaneme, požiadavka bola odoslaná, ale jej výsledok je neznámy.
          console.log('E-mailová požiadavka odoslaná (status neznámy kvôli no-cors).');
      } catch (emailError) {
          console.error('Chyba pri odosielaní e-mailovej požiadavky (nemožno potvrdiť, či bol e-mail odoslaný):', emailError);
          // V no-cors režime sa táto chyba objaví len pri sieťových problémoch, nie pri chybách na serveri Apps Scriptu.
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      // Notifikácia pre používateľa je zobrazená, hoci stav e-mailu je neznámy.
      // Dôležité je, že dáta sú už uložené vo Firestore.
      dispatchAppNotification(`Ďakujeme za Vašu registráciu na turnaj Slovak Open Handball. Potvrdenie o zaregistrovaní Vášho klubu by malo byť odoslané na e-mailovú adresu ${formData.email}.`, 'success');
      setRegistrationSuccess(true);

      // Resetovanie formulára a prechod na prvú stránku po úspešnej registrácii
      setFormData({
        firstName: '', lastName: '', email: '', contactPhoneNumber: '',
        password: '', confirmPassword: '', houseNumber: '', country: '',
        city: '', postalCode: '', street: '',
        billing: { clubName: '', ico: '', dic: '', icDph: '' },
      });
      setSelectedCategoryRows([{ categoryId: '', teams: 1 }]);
      setTeamsDataFromPage4({}); // Resetujeme tímy
      setPage(1);

      setTimeout(async () => {
        if (authInstance && authInstance.currentUser) {
            await signOut(authInstance);
        }
        window.location.href = 'login.html';
      }, 20000);

    } catch (globalError) {
      let errorMessage = 'Registrácia zlyhala neočakávanou chybou. Skúste to prosím neskôr.';
      dispatchAppNotification(errorMessage, 'error');
    } finally {
      setLoading(false);
      isRegisteringRef.current = false;
    }
  };


  const isPage1FormDataEmpty = (data) => {
    if (data.firstName.trim() !== '' ||
        data.lastName.trim() !== '' ||
        data.email.trim() !== '' ||
        data.contactPhoneNumber.trim() !== '' ||
        data.password.trim() !== '' ||
        data.confirmPassword.trim() !== '') {
        return false;
    }

    if (data.houseNumber.trim() !== '' ||
        data.country.trim() !== '' ||
        data.city.trim() !== '' ||
        data.postalCode.trim() !== '' ||
        data.street.trim() !== '') {
        return false;
    }

    if (data.billing.clubName.trim() !== '' ||
        data.billing.ico.trim() !== '' ||
        data.billing.dic.trim() !== '' ||
        data.billing.icDph.trim() !== '') {
        return false;
    }

    let hasSelectedCategories = false;
    if (selectedCategoryRows && selectedCategoryRows.length > 0) {
        hasSelectedCategories = selectedCategoryRows.some(row => row.categoryId && row.teams && row.teams > 0);
    }
    if (hasSelectedCategories) {
        return false;
    }

    if (teamsDataFromPage4 && Object.keys(teamsDataFromPage4).length > 0) {
        let hasTeamDetails = false;
        for (const categoryName in teamsDataFromPage4) {
            const teamsInCategory = teamsDataFromPage4[categoryName];
            if (teamsInCategory && teamsInCategory.length > 0) {
                hasTeamDetails = teamsInCategory.some(team =>
                    team.teamName.trim() !== '' ||
                    (team.players !== undefined && team.players !== '') ||
                    (team.teamMembers !== undefined && team.teamMembers !== '') ||
                    (team.womenTeamMembers !== undefined && team.womenTeamMembers !== '') ||
                    (team.menTeamMembers !== undefined && team.menTeamMembers !== '') ||
                    (team.tshirts && team.tshirts.some(t => t.size.trim() !== '' || (t.quantity !== undefined && t.quantity !== ''))) ||
                    // NOVINKA: Kontrola pre dáta Page 5
                    (team.accommodation?.type && team.accommodation.type.trim() !== '') ||
                    (team.arrival?.type && team.arrival.type.trim() !== '') ||
                    (team.packageId && team.packageId.trim() !== '')
                );
                if (hasTeamDetails) {
                    break;
                }
            }
        }
        if (hasTeamDetails) {
            return false;
        }
    }


    return true;
  };

  const hasAnyPage1Data = !isPage1FormDataEmpty(formData);
  const now = new Date();

  const registrationStartDateObj = registrationStartDate ? new Date(registrationStartDate) : null;
  const registrationEndDateObj = registrationEndDate ? new Date(registrationEndDate) : null;

  return React.createElement(
    'div',
    { className: 'min-h-screen flex items-center justify-center bg-gray-100 p-4' },
    // NotificationModal pre App komponent zostáva tu
    !registrationSuccess && React.createElement(NotificationModal, { message: notificationMessage, onClose: closeNotification, type: notificationType }),

    !settingsLoaded || !isAuthReady ? (
      React.createElement(
        'div',
        { className: 'bg-white p-8 rounded-lg shadow-md w-full max-w-md text-center' },
        React.createElement(
          'p',
          { className: 'text-gray-600 text-lg font-semibold' },
          'Načítavam aplikáciu...'
        )
      )
    ) : registrationSuccess ? (
      React.createElement(
        'div',
        { className: 'bg-green-700 text-white p-8 rounded-lg shadow-md w-full max-w-md text-center' },
        React.createElement(
          'h2',
          { className: 'text-2xl font-bold mb-4 text-white' },
          'Registrácia úspešná!'
        ),
        React.createElement(
          'p',
          { className: 'text-white' },
          notificationMessage
        ),
        React.createElement(
          'p',
          { className: 'text-gray-200 text-sm mt-4' },
          'Budete automaticky presmerovaní na prihlasovaciu stránku.'
        )
      )
    ) : (
      (isRegistrationOpen || (isRegistrationClosed && hasAnyPage1Data)) ? (
        React.createElement(
          'div',
          { className: 'bg-white p-8 rounded-lg shadow-md w-full max-w-md' },
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
              isRegistrationClosed: isRegistrationClosed,
              registrationEndDate: registrationEndDate,
              hasAnyPage1Data: hasAnyPage1Data
            }) :
          page === 2 ?
            React.createElement(Page2Form, {
              formData: formData,
              handleChange: handleChange,
              handlePrev: handlePrev,
              handleSubmit: handleNextPage2ToPage3,
              loading: loading,
              notificationMessage: notificationMessage,
              closeNotification: closeNotification,
              userRole: userRole,
              handleRoleChange: handleRoleChange,
              NotificationModal: NotificationModal,
            }) :
          page === 3 ?
              React.createElement(Page3Form, {
                  formData: formData,
                  handlePrev: handlePrev,
                  handleNextPage3: handleNextPage3ToPage4,
                  loading: loading,
                  setLoading: setLoading,
                  notificationMessage: notificationMessage,
                  setShowNotification: setShowNotification,
                  setNotificationType: setNotificationType,
                  setRegistrationSuccess: setRegistrationSuccess,
                  isRecaptchaReady: isRecaptchaReady,
                  selectedCountryDialCode: selectedCountryDialCode,
                  NotificationModal: NotificationModal,
                  availableCategoriesMap: categoriesDataFromFirestore,
                  selectedCategoryRows: selectedCategoryRows,
                  setSelectedCategoryRows: setSelectedCategoryRows,
              }) :
          page === 4 ?
              React.createElement(Page4Form, {
                  formData: formData,
                  handlePrev: handlePrev,
                  handleNextPage4: handleNextPage4ToPage5,
                  loading: loading,
                  setLoading: setLoading,
                  notificationMessage: notificationMessage,
                  setShowNotification: setShowNotification,
                  setNotificationType: setNotificationType,
                  setRegistrationSuccess: setRegistrationSuccess,
                  isRecaptchaReady: isRecaptchaReady,
                  selectedCountryDialCode: selectedCountryDialCode,
                  NotificationModal: NotificationModal,
                  numberOfPlayersLimit: numberOfPlayersInTeam,
                  numberOfTeamMembersLimit: numberOfImplementationTeamMembers,
                  teamsDataFromPage4: teamsDataFromPage4,
                  setTeamsDataFromPage4: setTeamsDataFromPage4,
                  closeNotification: closeNotification,
                  setNotificationMessage: setNotificationMessage,
                  setShowNotification: setShowNotification,
                  setNotificationType: setNotificationType,
              }) :
          page === 5 ?
              React.createElement(Page5Form, {
                  formData: formData,
                  teamsDataFromPage4: teamsDataFromPage4,
                  availableCategoriesMap: categoriesDataFromFirestore, // Provided for completeness, might not be used directly in Page5Form logic
                  handlePrev: handlePrev,
                  handleSubmit: handleNextPage5ToPage6,
                  loading: loading,
                  setLoading: setLoading,
                  setRegistrationSuccess: setRegistrationSuccess,
                  handleChange: handleChange, // Use the updated handleChange that supports nested team data
                  isRecaptchaReady: isRecaptchaReady,
                  tournamentStartDate: registrationStartDate,
                  tournamentEndDate: registrationEndDate,
              }) :
          page === 6 ? // NOVINKA: Renderovanie Page6Form
              React.createElement(Page6Form, {
                  formData: formData,
                  teamsDataFromPage4: teamsDataFromPage4,
                  handlePrev: handlePrev,
                  handleSubmit: confirmFinalRegistration,
                  loading: loading,
                  NotificationModal: NotificationModal,
                  notificationMessage: notificationMessage,
                  closeNotification: closeNotification,
              }) : null
        )
      ) : isRegistrationClosed ? (
        React.createElement(
          'div',
          { className: 'bg-white p-8 rounded-lg shadow-md w-auto max-w-fit mx-auto text-center' },
          React.createElement(
            'h2',
            { className: 'text-2xl font-bold mb-2 text-red-600' },
            'Registrácia na turnaj je už ukončená.'
          ),
          React.createElement(
            'p',
            { className: 'text-md text-gray-700 mt-2' },
            'Registrácia bola ukončená ',
            registrationEndDateObj && React.createElement(
              'span',
              { style: { whiteSpace: 'nowrap' } },
              'dňa ',
              registrationEndDateObj.toLocaleDateString('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric' }),
              ' o ',
              registrationEndDateObj.toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' }),
              ' hod.'
            )
          )
        )
      ) : (isRegistrationOpen === false && countdown) ? (
        React.createElement(
          'div',
          { className: 'bg-white p-8 rounded-lg shadow-md w-auto max-w-fit mx-auto text-center' },
          React.createElement('h2', { className: 'text-2xl font-bold mb-2' }, 'Registračný formulár'),
          registrationStartDateObj && !isNaN(registrationStartDateObj) && now < registrationStartDateObj && (
            React.createElement(
              React.Fragment,
              null,
              React.createElement(
                'p',
                { className: 'text-md text-gray-700 mt-2' },
                'Registrácia sa spustí ',
                React.createElement(
                  'span',
                  { style: { whiteSpace: 'nowrap' } },
                  'dňa ',
                  registrationStartDateObj.toLocaleDateString('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric' }),
                  ' o ',
                  registrationStartDateObj.toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' }),
                  ' hod.'
                )
              ),
              countdown && (
                  React.createElement('p', { className: 'text-md text-gray-700 mt-2' }, React.createElement('strong', null, `Zostáva: ${countdown}`))
              )
            )
          )
        )
      ) : null
    )
  );
}

let appInitialized = false;
let globalDataUpdatedReceived = false;
let categoriesLoadedReceived = false;

function initializeRegistrationApp() {
  if (appInitialized) {
    return;
  }

  if (!globalDataUpdatedReceived || !categoriesLoadedReceived) {
    return;
  }

  const rootElement = document.getElementById('root');
  if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    appInitialized = true;

    root.render(React.createElement(App, null));

  } else {
    console.error("register.js: Element s ID 'root' nebol nájdený. React aplikácia nemôže byť renderovaná.");
  }
}

window.addEventListener('globalDataUpdated', () => {
  globalDataUpdatedReceived = true;
  initializeRegistrationApp();
});

window.addEventListener('categoriesLoaded', () => {
  categoriesLoadedReceived = true;
  initializeRegistrationApp();
});


if (window.isGlobalAuthReady && window.areCategoriesLoaded) {
  globalDataUpdatedReceived = true;
  categoriesLoadedReceived = true;
  initializeRegistrationApp();
}
