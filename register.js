const RECAPTCHA_SITE_KEY = "6LdJbn8rAAAAAO4C50qXTWva6ePzDlOfYwBDEDwa";
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec";

import { Page1Form, PasswordInput, CountryCodeModal } from './register-page1.js';
import { Page2Form } from './register-page2.js';
import { Page3Form } from './register-page3.js';
import { Page4Form } from './register-page4.js';
import { Page5Form } from './register-page5.js';
import { Page6Form } from './register-page6.js';
import { Page7Form } from './register-page7.js';

import { onAuthStateChanged, signOut, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, doc, onSnapshot, setDoc, serverTimestamp, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const formatToDatetimeLocal = (date) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '';
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${day}. ${month}. ${year} ${hours}:${minutes}`;
};

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
  const [selectedCategoryRows, setSelectedCategoryRows] = React.useState([{ categoryId: '', teams: 1 }]);
  const [teamsDataFromPage4, setTeamsDataFromPage4] = React.useState({});
  // NOVINKA: Stav pre globálnu poznámku
  const [globalNote, setGlobalNote] = React.useState('');

  const [userRole, setUserRole] = React.useState('user');
  const [loading, setLoading] = React.useState(false);

  const [notificationMessage, setNotificationMessage] = React.useState('');
  const [showNotification, setShowNotification] = React.useState(false);
  const [notificationType, setNotificationType] = React.useState('info');

  const [isCountryCodeModalOpen, setIsCountryCodeModalOpen] = React.useState(false);
  const [selectedCountryDialCode, setSelectedCountryDialCode] = React.useState('+421');
  const [registrationSuccess, setRegistrationSuccess] = React.useState(false);

  const [isAuthReady, setIsAuthReady] = React.useState(window.isGlobalAuthReady || false);

  const [registrationStartDate, setRegistrationStartDate] = React.useState(null);
  const [registrationEndDate, setRegistrationEndDate] = React.useState(null);
  const [dataEditDeadline, setDataEditDeadline] = React.useState(null);
  const [rosterEditDeadline, setRosterEditDeadline] = React.useState(null);
  const [numberOfPlayersInTeam, setNumberOfPlayersInTeam] = React.useState(0);
  const [numberOfImplementationTeamMembers, setNumberOfImplementationTeamMembers] = React.useState(0);

  const [settingsLoaded, setSettingsLoaded] = React.useState(false);
  const [categoriesExist, setCategoriesExist] = React.useState(false);
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
    const regStart = registrationStartDate;
    const regEnd = registrationEndDate;

    const isRegStartValid = regStart instanceof Date && !isNaN(regStart.getTime());
    const isRegEndValid = regEnd instanceof Date && !isNaN(regEnd.getTime());

    return (
      (isRegStartValid ? now >= regStart : true) &&
      (isRegEndValid ? now <= regEnd : true)
    );
  }, [settingsLoaded, registrationStartDate, registrationEndDate, forceRegistrationCheck, periodicRefreshKey]);

  const isRegistrationClosed = React.useMemo(() => {
    if (!settingsLoaded) return false;
    const now = new Date();
    const regEnd = registrationEndDate;
    return regEnd instanceof Date && !isNaN(regEnd.getTime()) && now > regEnd;
  }, [settingsLoaded, registrationEndDate, periodicRefreshKey]);

  const isBeforeRegistrationStart = React.useMemo(() => {
    if (!settingsLoaded) return false;
    const now = new Date();
    // ZMENA: regStart je už Date objekt alebo null
    const regStart = registrationStartDate;
    return regStart instanceof Date && !isNaN(regStart.getTime()) && now < regStart;
  }, [settingsLoaded, registrationStartDate, periodicRefreshKey]);


  const calculateTimeLeft = React.useCallback(() => {
    const now = new Date();
    // ZMENA: startDate je už Date objekt alebo null
    const startDate = registrationStartDate;

    if (!startDate || !(startDate instanceof Date) || isNaN(startDate.getTime()) || now >= startDate) {
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
      // ZMENA: endDate je už Date objekt alebo null
      const endDate = registrationEndDate;

      if (!endDate || !(endDate instanceof Date) || isNaN(endDate.getTime()) || now >= endDate) {
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
    const handleGlobalDataUpdated = () => {
      setIsAuthReady(true);
      if (window.hideGlobalLoader) {
        window.hideGlobalLoader();
      }
    };

    if (window.isGlobalAuthReady) {
      setIsAuthReady(true);
      if (window.hideGlobalLoader) {
        window.hideGlobalLoader();
      }
    } else {
      window.addEventListener('globalDataUpdated', handleGlobalDataUpdated);
    }

    return () => {
      window.removeEventListener('globalDataUpdated', handleGlobalDataUpdated);
    };
  }, []);


  React.useEffect(() => {
    if (typeof window.db === 'undefined' || !isAuthReady) {
      return;
    }

    const settingsDocRef = doc(collection(window.db, 'settings'), 'registration');
    const unsubscribeSettings = onSnapshot(settingsDocRef, docSnapshot => {
      if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          setRegistrationStartDate(data.registrationStartDate ? data.registrationStartDate.toDate() : null);
          setRegistrationEndDate(data.registrationEndDate ? data.registrationEndDate.toDate() : null);
          setDataEditDeadline(data.dataEditDeadline ? data.dataEditDeadline.toDate() : null);
          setRosterEditDeadline(data.rosterEditDeadline ? data.rosterEditDeadline.toDate() : null);
          setNumberOfPlayersInTeam(data.numberOfPlayers || 0);
          setNumberOfImplementationTeamMembers(data.numberOfImplementationTeam || 0);

      } else {
          setRegistrationStartDate(null);
          setRegistrationEndDate(null);
          setDataEditDeadline(null);
          setRosterEditDeadline(null);
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
      if (docSnapshot.exists() && docSnapshot.data() && Object.keys(docSnapshot.data()).length > 0) {
        const rawCategoriesData = docSnapshot.data();
        const formattedCategories = {};
        Object.entries(rawCategoriesData).forEach(([id, value]) => {
          if (typeof value === 'object' && value !== null && value.name) {
            formattedCategories[id] = value;
          } else if (typeof value === 'string') {
            formattedCategories[id] = { name: value };
          }
        });
        setCategoriesExist(true);
        setCategoriesDataFromFirestore(formattedCategories);
      } else {
        setCategoriesExist(false);
        setCategoriesDataFromFirestore({});
      }
      window.dispatchEvent(new Event('categoriesLoaded'));
    }, error => {
      console.error("Chyba pri načítaní kategórií z Firestore:", error);
      setCategoriesExist(false);
      setCategoriesDataFromFirestore({});
      setNotificationMessage(`Chyba pri načítaní kategórií: ${error.message}`);
      setShowNotification(true);
      setNotificationType('error');
      window.dispatchEvent(new Event('categoriesLoaded'));
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
            setPeriodicRefreshKey(prev => prev + 1);
        }
    };

    if (registrationStartDate && (registrationStartDate instanceof Date) && !isNaN(registrationStartDate.getTime()) && new Date() < registrationStartDate) {
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

    if (registrationEndDate && (registrationEndDate instanceof Date) && !isNaN(registrationEndDate.getTime()) && new Date() < registrationEndDate) {
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
    }, 100);

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

  const dispatchAppNotification = React.useCallback((message, type = 'info') => {
    setNotificationMessage(message);
    setShowNotification(true);
    setNotificationType(type);
  }, [setNotificationMessage, setShowNotification, setNotificationType]);

  const handleGranularTeamsDataChange = React.useCallback((categoryName, teamIndex, field, data) => {
    setTeamsDataFromPage4(prevTeamsData => {
        const newTeamsData = { ...prevTeamsData };

        if (typeof categoryName !== 'string' || categoryName.trim() === '') {
            console.warn("Pokus o aktualizáciu teamsDataFromPage4 s neplatným názvom kategórie:", categoryName);
            return prevTeamsData;
        }

        if (!newTeamsData[categoryName]) {
            newTeamsData[categoryName] = [];
        }
        if (!newTeamsData[categoryName][teamIndex]) {
            newTeamsData[categoryName][teamIndex] = {};
        }

        if (field === 'arrival') {
            const currentArrival = newTeamsData[categoryName][teamIndex].arrival || {};
            const updatedArrival = { ...currentArrival, ...data };
            if (updatedArrival.type !== 'vlastná doprava') {
                updatedArrival.drivers = null;
            }
            newTeamsData[categoryName][teamIndex] = {
                ...newTeamsData[categoryName][teamIndex],
                [field]: updatedArrival
            };
        } else if (field === 'accommodation' || field === 'packageDetails' || field === 'playerDetails' || field === 'womenTeamMemberDetails' || field === 'menTeamMemberDetails' || field === 'driverDetailsMale' || field === 'driverDetailsFemale') { // NOVINKA: Pridané driverDetailsMale a driverDetailsFemale
            newTeamsData[categoryName][teamIndex] = {
                ...newTeamsData[categoryName][teamIndex],
                [field]: data
            };
        } else {
            newTeamsData[categoryName][teamIndex] = {
                ...newTeamsData[categoryName][teamIndex],
                [field]: data
            };
        }
        return newTeamsData;
    });
  }, []);

  const handleChange = (e) => {
    const { id, value } = e.target;

    if (id === 'billing') {
      setFormData(prev => ({
        ...prev,
        billing: {
          ...(prev.billing || {}),
          ...value
        }
      }));
    } else {
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
    dispatchAppNotification('', 'info');

    if (!isRecaptchaReady) {
      dispatchAppNotification('reCAPTCHA sa ešte nenačítalo. Skúste to prosím znova.', 'error');
      setLoading(false);
      return;
    }

    if (!categoriesExist) {
      dispatchAppNotification('Registrácia nie je možná, pretože neboli definované žiadne kategórie.', 'error');
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
    dispatchAppNotification('', 'info');

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
    dispatchAppNotification('', 'info');

    const transformedCategories = {};
    categoriesDataFromPage3.forEach(row => {
        const categoryData = categoriesDataFromFirestore[row.categoryId];
        const categoryName = (typeof categoryData === 'object' && categoryData !== null && categoryData.name)
            ? categoryData.name
            : categoryData;

        if (categoryName && typeof categoryName === 'string' && categoryName.trim() !== '') {
            transformedCategories[categoryName] = {
                numberOfTeams: row.teams
            };
        } else {
            console.warn(`register.js: Názov kategórie pre ID ${row.categoryId} sa nenašiel v categoriesDataFromFirestore alebo je neplatný. Kategória bude preskočená.`);
        }
    });

    const newTeamsDataForPage4 = {};
    const clubName = formData.billing.clubName || '';

    Object.keys(transformedCategories).forEach(categoryName => {
        const numTeams = transformedCategories[categoryName].numberOfTeams;

        const existingCategoryTeams = Array.isArray(teamsDataFromPage4[categoryName]) ? teamsDataFromPage4[categoryName] : [];

        newTeamsDataForPage4[categoryName] = Array.from({ length: numTeams }).map((_, teamIndex) => {
            const suffix = numTeams > 1 ? ` ${String.fromCharCode('A'.charCodeAt(0) + teamIndex)}` : '';
            const generatedTeamName = `${clubName}${suffix}`;

            const existingTeamData = existingCategoryTeams[teamIndex] || {};

            return {
                teamName: generatedTeamName,
                players: existingTeamData.players !== undefined ? existingTeamData.players : '',
                womenTeamMembers: existingTeamData.womenTeamMembers !== undefined ? existingTeamData.womenTeamMembers : '',
                menTeamMembers: existingTeamData.menTeamMembers !== undefined ? existingTeamData.menTeamMembers : '',
                tshirts: existingTeamData.tshirts && existingTeamData.tshirts.length > 0
                    ? existingTeamData.tshirts
                    : [{ size: '', quantity: '' }],
                accommodation: existingTeamData.accommodation || { type: '' },
                arrival: existingTeamData.arrival || { type: '', time: null, drivers: null },
                packageId: existingTeamData.packageId || '',
                packageDetails: existingTeamData.packageDetails || null,
                playerDetails: existingTeamData.playerDetails || Array.from({ length: parseInt(existingTeamData.players, 10) || 0 }).map(() => ({
                    jerseyNumber: '', firstName: '', lastName: '', dateOfBirth: '', isRegistered: false, registrationNumber: '',
                    address: { street: '', houseNumber: '', city: '', postalCode: '', country: '' }
                })),
                womenTeamMemberDetails: existingTeamData.womenTeamMemberDetails || Array.from({ length: parseInt(existingTeamData.womenTeamMembers, 10) || 0 }).map(() => ({
                    firstName: '', lastName: '', dateOfBirth: '',
                    address: { street: '', houseNumber: '', city: '', postalCode: '', country: '' }
                })),
                menTeamMemberDetails: existingTeamData.menTeamMemberDetails || Array.from({ length: parseInt(existingTeamData.menTeamMembers, 10) || 0 }).map(() => ({
                    firstName: '', lastName: '', dateOfBirth: '',
                    address: { street: '', houseNumber: '', city: '', postalCode: '', country: '' }
                })),
                // NOVINKA: Inicializácia driverDetailsMale a driverDetailsFemale
                driverDetailsMale: existingTeamData.driverDetailsMale || Array.from({ length: existingTeamData.arrival?.drivers?.male || 0 }).map(() => ({
                    firstName: '', lastName: '', dateOfBirth: '',
                    address: { street: '', houseNumber: '', city: '', postalCode: '', country: '' }
                })),
                driverDetailsFemale: existingTeamData.driverDetailsFemale || Array.from({ length: existingTeamData.arrival?.drivers?.female || 0 }).map(() => ({
                    firstName: '', lastName: '', dateOfBirth: '',
                    address: { street: '', houseNumber: '', city: '', postalCode: '', country: '' }
                })),
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
    dispatchAppNotification('', 'info');

    setTeamsDataFromPage4(teamsDataFromPage4Final);

    setPage(5);
    setLoading(false);
  };

  const handleNextPage5ToPage6 = async (finalTeamsDataFromPage5) => {
    setLoading(true);
    dispatchAppNotification('', 'info');

    setTeamsDataFromPage4(finalTeamsDataFromPage5);

    setPage(6);
    setLoading(false);
  };

  // ZMENA: handleNextPage6ToPage7 teraz prijíma aj globalNote
  const handleNextPage6ToPage7 = async (finalTeamsDataFromPage6, currentGlobalNote) => {
    setLoading(true);
    dispatchAppNotification('', 'info');

    setTeamsDataFromPage4(finalTeamsDataFromPage6);
    setGlobalNote(currentGlobalNote); // Uložíme globalNote do stavu App komponentu

    setPage(7);
    setLoading(false);
  };

  const handlePrev = (dataToPreserve = null) => {
    if (dataToPreserve && dataToPreserve.currentFormData) {
        setFormData(dataToPreserve.currentFormData);
    }
    if (dataToPreserve && dataToPreserve.currentTeamsDataFromPage4) {
        setTeamsDataFromPage4(dataToPreserve.currentTeamsDataFromPage4);
    }
    // NOVINKA: Ak sa vraciame zo stránky s poznámkou, aktualizujeme globalNote
    if (dataToPreserve && dataToPreserve.currentGlobalNote !== undefined) {
        setGlobalNote(dataToPreserve.currentGlobalNote);
    }
    setPage(prevPage => prevPage - 1);
    dispatchAppNotification('', 'info');
  };

  // ZMENA: handleSaveTeamsDataAndPrev teraz prijíma aj globalNote
  const handleSaveTeamsDataAndPrev = (updatedTeamsData, currentGlobalNote) => {
    setTeamsDataFromPage4(updatedTeamsData);
    setGlobalNote(currentGlobalNote); // Uložíme globalNote do stavu App komponentu
    setPage(prevPage => prevPage - 1);
    dispatchAppNotification('', 'info');
  };


  // ZMENA: confirmFinalRegistration teraz prijíma globalNote
  const confirmFinalRegistration = async (finalTeamsDataFromPage7, finalGlobalNote) => {
    setLoading(true);
    dispatchAppNotification('', 'info');
    isRegisteringRef.current = true;

    const fullPhoneNumber = `${selectedCountryDialCode} ${formData.contactPhoneNumber}`;

    let teamsDataToSaveFinal = JSON.parse(JSON.stringify(finalTeamsDataFromPage7));

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
        for (const categoryName in teamsDataToSaveFinal) {
            const currentTeamsInCategory = Array.isArray(teamsDataToSaveFinal[categoryName]) ? teamsDataToSaveFinal[categoryName] : [];
            teamsDataToSaveFinal[categoryName] = currentTeamsInCategory.map(team => {
                const updatedTeam = { ...team };

                updatedTeam.players = updatedTeam.players === '' ? 0 : updatedTeam.players;
                updatedTeam.womenTeamMembers = updatedTeam.womenTeamMembers === '' ? 0 : updatedTeam.womenTeamMembers;
                updatedTeam.menTeamMembers = updatedTeam.menTeamMembers === '' ? 0 : updatedTeam.menTeamMembers;

                updatedTeam.tshirts = updatedTeam.tshirts.map(tshirt => ({
                    ...tshirt,
                    quantity: tshirt.quantity === '' ? 0 : tshirt.quantity
                }));

                updatedTeam.accommodation = updatedTeam.accommodation || { type: 'Bez ubytovania' };
                if (updatedTeam.accommodation.type === '') updatedTeam.accommodation.type = 'Bez ubytovania';

                updatedTeam.arrival = updatedTeam.arrival || { type: 'bez dopravy', time: null, drivers: null };
                if (updatedTeam.arrival.type === '') updatedTeam.arrival.type = 'bez dopravy';

                if (updatedTeam.arrival.type === 'vlastná doprava') {
                    updatedTeam.arrival.drivers = {
                        male: updatedTeam.arrival.drivers?.male !== undefined ? updatedTeam.arrival.drivers.male : 0,
                        female: updatedTeam.arrival.drivers?.female !== undefined ? updatedTeam.arrival.drivers.female : 0
                    };
                } else {
                    updatedTeam.arrival.drivers = null;
                }

                if (updatedTeam.packageId === '') updatedTeam.packageId = null;
                if (!updatedTeam.packageDetails) updatedTeam.packageDetails = null;

                updatedTeam.playerDetails = updatedTeam.playerDetails?.map(p => ({
                    ...p,
                    jerseyNumber: p.jerseyNumber || '',
                    firstName: p.firstName || '',
                    lastName: p.lastName || '',
                    dateOfBirth: p.dateOfBirth || '',
                    registrationNumber: p.registrationNumber || '',
                    address: {
                        street: p.address?.street || '',
                        houseNumber: p.address?.houseNumber || '',
                        city: p.address?.city || '',
                        postalCode: p.address?.postalCode || '',
                        country: p.address?.country || '',
                    }
                })) || [];

                updatedTeam.womenTeamMemberDetails = updatedTeam.womenTeamMemberDetails?.map(m => ({
                    ...m,
                    firstName: m.firstName || '',
                    lastName: m.lastName || '',
                    dateOfBirth: m.dateOfBirth || '',
                    address: {
                        street: m.address?.street || '',
                        houseNumber: m.address?.houseNumber || '',
                        city: m.address?.city || '',
                        postalCode: m.address?.postalCode || '',
                        country: m.address?.country || '',
                    }
                })) || [];

                updatedTeam.menTeamMemberDetails = updatedTeam.menTeamMemberDetails?.map(m => ({
                    ...m,
                    firstName: m.firstName || '',
                    lastName: m.lastName || '',
                    dateOfBirth: m.dateOfBirth || '',
                    address: {
                        street: m.address?.street || '',
                        houseNumber: m.address?.houseNumber || '',
                        city: m.address?.city || '',
                        postalCode: m.address?.postalCode || '',
                        country: m.address?.country || '',
                    }
                })) || [];

                // NOVINKA: Normalizácia driverDetailsMale a driverDetailsFemale
                updatedTeam.driverDetailsMale = updatedTeam.driverDetailsMale?.map(d => ({
                    ...d,
                    firstName: d.firstName || '', lastName: d.lastName || '', dateOfBirth: d.dateOfBirth || '',
                    address: {
                        street: d.address?.street || '', houseNumber: d.address?.houseNumber || '',
                        city: d.address?.city || '', postalCode: d.address?.postalCode || '', country: d.address?.country || '',
                    }
                })) || [];
                updatedTeam.driverDetailsFemale = updatedTeam.driverDetailsFemale?.map(d => ({
                    ...d,
                    firstName: d.firstName || '', lastName: d.lastName || '', dateOfBirth: d.dateOfBirth || '',
                    address: {
                        street: d.address?.street || '', houseNumber: d.address?.houseNumber || '',
                        city: d.address?.city || '', postalCode: d.address?.postalCode || '', country: d.address?.country || '',
                    }
                })) || [];

                return updatedTeam;
            });
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
          teams: teamsDataToSaveFinal,
          note: finalGlobalNote || '' // NOVINKA: Uloženie poznámky zo samostatného propu
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
            teams: teamsDataToSaveFinal,
            globalNote: finalGlobalNote // NOVINKA: Odoslanie globalNote do Apps Scriptu
          };
          const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
          });
          console.log('E-mailová požiadavka odoslaná (status neznámy kvôli no-cors).');
      } catch (emailError) {
          console.error('Chyba pri odosielaní e-mailovej požiadavky (nemožno potvrdiť, či bol e-mail odoslaný):', emailError);
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      dispatchAppNotification(`Ďakujeme za vašu registráciu na turnaj Slovak Open Handball. Potvrdenie o zaregistrovaní vášho klubu bolo odoslané na e-mailovú adresu ${formData.email}.`, 'success');
      setRegistrationSuccess(true);

      setFormData({
        firstName: '', lastName: '', email: '', contactPhoneNumber: '',
        password: '', confirmPassword: '', houseNumber: '', country: '',
        city: '', postalCode: '', street: '',
        billing: { clubName: '', ico: '', dic: '', icDph: '' },
      });
      setSelectedCategoryRows([{ categoryId: '', teams: 1 }]);
      setTeamsDataFromPage4({});
      setGlobalNote(''); // NOVINKA: Reset globálnej poznámky
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
            // NOVINKA: Ignorujeme 'globalNote' ak sa tam náhodou dostane
            if (categoryName === 'globalNote') {
                continue;
            }
            if (teamsInCategory && teamsInCategory.length > 0) {
                hasTeamDetails = teamsInCategory.some(team =>
                    team.teamName.trim() !== '' ||
                    (team.players !== undefined && team.players !== '') ||
                    (team.womenTeamMembers !== undefined && team.womenTeamMembers !== '') ||
                    (team.menTeamMembers !== undefined && team.menTeamMembers !== '') ||
                    (team.tshirts && team.tshirts.some(t => t.size.trim() !== '' || (t.quantity !== undefined && t.quantity !== ''))) ||
                    (team.accommodation?.type && team.accommodation.type.trim() !== '') ||
                    (team.arrival?.type && team.arrival.type.trim() !== '') ||
                    (team.packageId && team.packageId.trim() !== '') ||
                    (team.arrival?.drivers && (team.arrival.drivers.male !== undefined || team.arrival.drivers.female !== undefined)) ||
                    (team.playerDetails && team.playerDetails.some(p =>
                        p.jerseyNumber !== '' || p.firstName.trim() !== '' || p.lastName.trim() !== '' || p.dateOfBirth.trim() !== '' || p.registrationNumber.trim() !== '' ||
                        (p.address && (p.address.street.trim() !== '' || p.address.houseNumber.trim() !== '' || p.address.city.trim() !== '' || p.address.postalCode.trim() !== '' || p.address.country.trim() !== ''))
                    )) ||
                    (team.womenTeamMemberDetails && team.womenTeamMemberDetails.some(m =>
                        m.firstName.trim() !== '' || m.lastName.trim() !== '' || m.dateOfBirth.trim() !== '' ||
                        (m.address && (m.address.street.trim() !== '' || m.address.houseNumber.trim() !== '' || m.address.city.trim() !== '' || m.address.postalCode.trim() !== '' || m.address.country.trim() !== ''))
                    )) ||
                    (team.menTeamMemberDetails && team.menTeamMemberDetails.some(m =>
                        m.firstName.trim() !== '' || m.lastName.trim() !== '' || m.dateOfBirth.trim() !== '' ||
                        (m.address && (m.address.street.trim() !== '' || m.address.houseNumber.trim() !== '' || m.address.city.trim() !== '' || m.address.postalCode.trim() !== '' || m.address.country.trim() !== ''))
                    )) ||
                    // NOVINKA: Kontrola pre detaily šoférov
                    (team.driverDetailsMale && team.driverDetailsMale.some(d =>
                        d.firstName.trim() !== '' || d.lastName.trim() !== '' || d.dateOfBirth.trim() !== '' ||
                        (d.address && (d.address.street.trim() !== '' || d.address.houseNumber.trim() !== '' || d.address.city.trim() !== '' || d.address.postalCode.trim() !== '' || d.address.country.trim() !== ''))
                    )) ||
                    (team.driverDetailsFemale && team.driverDetailsFemale.some(d =>
                        d.firstName.trim() !== '' || d.lastName.trim() !== '' || d.dateOfBirth.trim() !== '' ||
                        (d.address && (d.address.street.trim() !== '' || d.address.houseNumber.trim() !== '' || d.address.city.trim() !== '' || d.address.postalCode.trim() !== '' || d.address.country.trim() !== ''))
                    ))
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
    // NOVINKA: Kontrola, či poznámka nie je prázdna (teraz ako samostatný stav)
    if (globalNote.trim() !== '') {
        return false;
    }


    return true;
  };

  const hasAnyPage1Data = !isPage1FormDataEmpty(formData);
  const now = new Date();


  const mainContainerWidthClass = (page === 6 || page === 7) ? 'max-w-6xl' : 'max-w-md';

  React.useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }, [page]);

  return React.createElement(
    'div',
    { className: `min-h-screen flex flex-col items-center justify-start bg-gray-100 p-4` },
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
      isBeforeRegistrationStart ? (
        React.createElement(
          'div',
          { className: 'bg-white p-8 rounded-lg shadow-md w-auto max-w-fit mx-auto text-center' },
          React.createElement('h2', { className: 'text-2xl font-bold mb-2' }, 'Registračný formulár'),
          registrationStartDate && !isNaN(registrationStartDate.getTime()) && React.createElement(
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
                registrationStartDate.toLocaleDateString('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric' }),
                ' o ',
                registrationStartDate.toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' }),
                ' hod.'
              )
            ),
            countdown && (
                React.createElement('p', { className: 'text-md text-gray-700 mt-2' }, React.createElement('strong', null, `Zostáva: ${countdown}`))
            )
          )
        )
      ) : isRegistrationClosed && !hasAnyPage1Data ? (
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
            registrationEndDate && !isNaN(registrationEndDate.getTime()) && React.createElement(
              'span',
              { style: { whiteSpace: 'nowrap' } },
              'dňa ',
              registrationEndDate.toLocaleDateString('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric' }),
              ' o ',
              registrationEndDate.toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' }),
              ' hod.'
            )
          )
        )
      ) : (!categoriesExist && isRegistrationOpen) ? (
        React.createElement(
            'div',
            { className: 'bg-white p-8 rounded-lg shadow-md w-auto max-w-fit mx-auto text-center' },
            React.createElement(
                'h2',
                { className: 'text-2xl font-bold mb-2 text-red-600' },
                'Registrácia momentálne nie je možná.'
            ),
            React.createElement(
                'p',
                { className: 'text-md text-gray-700 mt-2' },
                'Pre spustenie registrácie musia byť definované kategórie.'
            )
        )
      ) : (
        React.createElement(
          'div',
          { className: `bg-white p-8 rounded-lg shadow-md w-full ${mainContainerWidthClass}` },
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
              hasAnyPage1Data: hasAnyPage1Data,
              categoriesExist: categoriesExist
            }) :
          page === 2 ?
            React.createElement(Page2Form, {
              formData: formData,
              handleChange: handleChange,
              handlePrev: () => handlePrev({ currentFormData: formData, currentTeamsDataFromPage4: teamsDataFromPage4, currentGlobalNote: globalNote }), // NOVINKA: Odovzdanie globalNote
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
                  handlePrev: () => handlePrev({ currentFormData: formData, currentTeamsDataFromPage4: teamsDataFromPage4, currentGlobalNote: globalNote }), // NOVINKA: Odovzdanie globalNote
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
                  handlePrev: () => handlePrev({ currentFormData: formData, currentTeamsDataFromPage4: teamsDataFromPage4, currentGlobalNote: globalNote }), // NOVINKA: Odovzdanie globalNote
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
                  availableCategoriesMap: categoriesDataFromFirestore,
                  handlePrev: () => handlePrev({ currentFormData: formData, currentTeamsDataFromPage4: teamsDataFromPage4, currentGlobalNote: globalNote }), // NOVINKA: Odovzdanie globalNote
                  handleSubmit: handleNextPage5ToPage6,
                  loading: loading,
                  setLoading: setLoading,
                  setRegistrationSuccess: setRegistrationSuccess,
                  handleChange: handleChange,
                  setTeamsDataFromPage4: setTeamsDataFromPage4,
                  onGranularTeamsDataChange: handleGranularTeamsDataChange,
                  isRecaptchaReady: isRecaptchaReady,
                  tournamentStartDate: registrationStartDate,
                  tournamentEndDate: registrationEndDate,
              }) :
          page === 6 ?
              React.createElement(Page6Form, {
                  teamsDataFromPage4: teamsDataFromPage4,
                  globalNote: globalNote, // NOVINKA: Odovzdanie globalNote ako samostatného propu
                  setGlobalNote: setGlobalNote, // NOVINKA: Odovzdanie setteru pre globalNote
                  handlePrev: () => handlePrev({ currentFormData: formData, currentTeamsDataFromPage4: teamsDataFromPage4, currentGlobalNote: globalNote }), // NOVINKA: Odovzdanie globalNote
                  handleSubmit: handleNextPage6ToPage7, // Zmena volanej funkcie
                  loading: loading,
                  NotificationModal: NotificationModal,
                  notificationMessage: notificationMessage,
                  closeNotification: closeNotification,
                  numberOfPlayersLimit: numberOfPlayersInTeam,
                  numberOfTeamMembersLimit: numberOfImplementationTeamMembers,
                  dataEditDeadline: dataEditDeadline,
                  setNotificationMessage: setNotificationMessage,
                  setNotificationType: setNotificationType,
                  notificationType: notificationType,
                  onSaveAndPrev: handleSaveTeamsDataAndPrev, // ZMENA: handleSaveTeamsDataAndPrev teraz prijíma globalNote
                  availableCategoriesMap: categoriesDataFromFirestore,
              }) :
          page === 7 ?
              React.createElement(Page7Form, {
                  formData: formData,
                  teamsDataFromPage4: teamsDataFromPage4,
                  globalNote: globalNote, // NOVINKA: Odovzdanie globalNote do Page7Form
                  handlePrev: () => handlePrev({ currentFormData: formData, currentTeamsDataFromPage4: teamsDataFromPage4, currentGlobalNote: globalNote }), // NOVINKA: Odovzdanie globalNote
                  handleSubmit: confirmFinalRegistration, // ZMENA: handleSubmit teraz očakáva aj globalNote
                  loading: loading,
                  NotificationModal: NotificationModal,
                  notificationMessage: notificationMessage,
                  closeNotification: closeNotification,
                  notificationType: notificationType,
                  selectedCountryDialCode: selectedCountryDialCode,
              }) : null
        )
      )
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
